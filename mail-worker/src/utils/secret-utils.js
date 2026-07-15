const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBase64Url(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function deriveKey(secret) {
    const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(secret));
    return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function getSecret(c) {
    const secret = c.env.mail_config_secret || c.env.jwt_secret;
    if (!secret) throw new Error('缺少 mail_config_secret 或 jwt_secret，无法加密邮件服务商配置');
    return secret;
}

export async function encryptJson(c, value) {
    const key = await deriveKey(getSecret(c));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        textEncoder.encode(JSON.stringify(value || {}))
    );
    return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptJson(c, value, fallback = {}) {
    if (!value) return fallback;
    if (!value.startsWith('v1.')) {
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }
    const [, ivPart, dataPart] = value.split('.');
    try {
        const key = await deriveKey(getSecret(c));
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: fromBase64Url(ivPart) },
            key,
            fromBase64Url(dataPart)
        );
        return JSON.parse(textDecoder.decode(decrypted));
    } catch (error) {
        throw new Error(`邮件服务商配置解密失败：${error.message}`);
    }
}

export function maskSecret(value) {
    if (!value) return '';
    const text = String(value);
    if (text.length <= 8) return '********';
    return `${text.slice(0, 5)}******${text.slice(-3)}`;
}

export function isMaskedSecret(value) {
    return typeof value === 'string' && value.includes('******');
}
