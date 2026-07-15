import { Resend } from 'resend';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import mailProviderConfigService, { normalizePriority } from './mail-provider-config-service';
import emailUtils from '../utils/email-utils';

function arrayBufferToBase64(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

function base64ToUint8Array(value) {
    const clean = String(value || '').replace(/^data:[^;]+;base64,/, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function attachmentContent(item) {
    if (item.content) return String(item.content).replace(/^data:[^;]+;base64,/, '');
    if (item.buff) return arrayBufferToBase64(item.buff);
    if (item.path) {
        const response = await fetch(item.path);
        if (!response.ok) throw new Error(`读取附件失败：${item.filename || item.path}`);
        return arrayBufferToBase64(await response.arrayBuffer());
    }
    throw new Error(`附件缺少内容：${item.filename || 'unknown'}`);
}

async function normalizeAttachments(items = []) {
    const list = [];
    for (const item of items) {
        if (!item) continue;
        const contentId = String(item.contentId || '').replace(/^<|>$/g, '');
        list.push({
            filename: item.filename || 'attachment',
            content: await attachmentContent(item),
            contentType: item.contentType || item.mimeType || item.type || 'application/octet-stream',
            contentId,
            inline: Boolean(contentId)
        });
    }
    return list;
}

function headersToObject(headers = []) {
    const result = {};
    for (const item of headers) {
        if (item?.name && item?.value) result[item.name] = item.value;
    }
    return result;
}

function headersToArray(headers = []) {
    return headers.filter(item => item?.name && item?.value).map(item => ({
        Name: item.name,
        Value: item.value
    }));
}

function inlineImagesAsDataUri(html, attachments) {
    let result = html || '';
    for (const item of attachments.filter(att => att.inline)) {
        const dataUri = `data:${item.contentType};base64,${item.content}`;
        result = result.split(`cid:${item.contentId}`).join(dataUri);
    }
    return result;
}

async function parseError(response, provider) {
    let message = `${provider} 请求失败（HTTP ${response.status}）`;
    try {
        const data = await response.json();
        message = data?.message || data?.error?.message || data?.error || message;
    } catch {
        const text = await response.text().catch(() => '');
        if (text) message = text.slice(0, 500);
    }
    throw new Error(message);
}

async function sendResend(config, message) {
    const resend = new Resend(config.apiKey);
    const payload = {
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments.map(item => ({
            filename: item.filename,
            content: item.content,
            contentType: item.contentType,
            contentId: item.contentId || undefined
        }))
    };
    if (message.headers.length) payload.headers = headersToObject(message.headers);
    const result = await resend.emails.send(payload);
    if (result.error) throw new Error(result.error.message || 'Resend 发送失败');
    return { id: result.data?.id || '', raw: result.data };
}

async function sendMailerSend(config, message) {
    const response = await fetch('https://api.mailersend.com/v1/email', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: { email: message.fromEmail, name: message.fromName },
            to: message.to.map(email => ({ email })),
            subject: message.subject,
            text: message.text,
            html: message.html,
            attachments: message.attachments.map(item => ({
                filename: item.filename,
                content: item.content,
                disposition: item.inline ? 'inline' : 'attachment',
                id: item.contentId || undefined
            }))
        })
    });
    if (!response.ok) await parseError(response, 'MailerSend');
    return { id: response.headers.get('x-message-id') || '', raw: null };
}

async function sendBrevo(config, message) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': config.apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sender: { email: message.fromEmail, name: message.fromName },
            to: message.to.map(email => ({ email })),
            subject: message.subject,
            textContent: message.text,
            htmlContent: inlineImagesAsDataUri(message.html, message.attachments),
            attachment: message.attachments.filter(item => !item.inline).map(item => ({
                content: item.content,
                name: item.filename
            }))
        })
    });
    if (!response.ok) await parseError(response, 'Brevo');
    const data = await response.json();
    return { id: data.messageId || data.messageIds?.[0] || '', raw: data };
}

async function sendPostmark(config, message) {
    const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
            'X-Postmark-Server-Token': config.serverToken,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify({
            From: message.from,
            To: message.to.join(','),
            Subject: message.subject,
            TextBody: message.text,
            HtmlBody: message.html,
            MessageStream: config.messageStream || 'outbound',
            Headers: headersToArray(message.headers),
            Attachments: message.attachments.map(item => ({
                Name: item.filename,
                Content: item.content,
                ContentType: item.contentType,
                ContentID: item.contentId ? `cid:${item.contentId}` : undefined
            }))
        })
    });
    if (!response.ok) await parseError(response, 'Postmark');
    const data = await response.json();
    return { id: data.MessageID || '', raw: data };
}

async function sendSes(config, message) {
    const client = new SESv2Client({
        region: config.region || 'us-east-1',
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            sessionToken: config.sessionToken || undefined
        }
    });
    const simple = {
        Subject: { Data: message.subject, Charset: 'UTF-8' },
        Body: {
            Html: { Data: message.html || '', Charset: 'UTF-8' },
            Text: { Data: message.text || '', Charset: 'UTF-8' }
        },
        Headers: headersToArray(message.headers),
        Attachments: message.attachments.map(item => ({
            RawContent: base64ToUint8Array(item.content),
            FileName: item.filename,
            ContentDisposition: item.inline ? 'INLINE' : 'ATTACHMENT',
            ContentId: item.contentId || undefined,
            ContentTransferEncoding: 'BASE64',
            ContentType: item.contentType
        }))
    };
    const result = await client.send(new SendEmailCommand({
        FromEmailAddress: message.from,
        Destination: { ToAddresses: message.to },
        Content: { Simple: simple }
    }));
    return { id: result.MessageId || '', raw: result };
}

function isConfigured(provider, config) {
    if (!config || Number(config.enabled) !== 1) return false;
    if (provider === 'resend' || provider === 'mailersend' || provider === 'brevo') return Boolean(config.apiKey);
    if (provider === 'postmark') return Boolean(config.serverToken);
    if (provider === 'ses') return Boolean(config.accessKeyId && config.secretAccessKey && config.region);
    return false;
}

const senders = {
    resend: sendResend,
    mailersend: sendMailerSend,
    brevo: sendBrevo,
    postmark: sendPostmark,
    ses: sendSes
};

const service = {
    async send(c, settingRow, sendForm) {
        const domain = emailUtils.getDomain(sendForm.fromEmail);
        const configs = await mailProviderConfigService.decode(c, settingRow.mailProviders, settingRow.resendTokens);
        const domainConfig = mailProviderConfigService.getDomainConfig(configs, domain);
        const priority = normalizePriority(settingRow.providerPriority);
        const attachments = await normalizeAttachments(sendForm.attachments);
        const headers = Object.entries(sendForm.headers || {}).map(([name, value]) => ({ name, value }));
        const message = {
            ...sendForm,
            from: `${sendForm.fromName} <${sendForm.fromEmail}>`,
            attachments,
            headers
        };
        const attempts = [];
        for (const provider of priority) {
            const config = domainConfig?.[provider];
            if (!isConfigured(provider, config)) continue;
            try {
                const result = await senders[provider](config, message);
                return { ...result, provider, attempts };
            } catch (error) {
                attempts.push({ provider, error: error.message });
            }
        }
        if (!domainConfig) {
            throw new Error(`域名 ${domain} 尚未配置任何站外发件服务商`);
        }
        if (!attempts.length) {
            throw new Error(`域名 ${domain} 没有已启用且配置完整的发件服务商`);
        }
        throw new Error(`所有发件服务商均失败：${attempts.map(item => `${item.provider}: ${item.error}`).join('；')}`);
    }
};

export default service;
