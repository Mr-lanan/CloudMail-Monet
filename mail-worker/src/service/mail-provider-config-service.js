import { decryptJson, encryptJson, isMaskedSecret, maskSecret } from '../utils/secret-utils';

export const providerNames = ['resend', 'mailersend', 'brevo', 'postmark', 'ses'];
export const secretFields = new Set([
    'apiKey',
    'serverToken',
    'accessKeyId',
    'secretAccessKey',
    'sessionToken'
]);

function normalizeDomain(domain) {
    return String(domain || '').trim().replace(/^@/, '').toLowerCase();
}

function defaultDomainConfig() {
    return {
        resend: { enabled: 0, apiKey: '' },
        mailersend: { enabled: 0, apiKey: '' },
        brevo: { enabled: 0, apiKey: '' },
        postmark: { enabled: 0, serverToken: '', messageStream: 'outbound' },
        ses: {
            enabled: 0,
            accessKeyId: '',
            secretAccessKey: '',
            sessionToken: '',
            region: 'us-east-1'
        }
    };
}

function mergeProvider(existing = {}, incoming = {}) {
    if (incoming?.clear === true) return {};
    const merged = { ...existing };
    for (const [key, value] of Object.entries(incoming || {})) {
        if (key === 'clear') continue;
        if (secretFields.has(key)) {
            if (value === '' || value == null || isMaskedSecret(value)) continue;
        }
        merged[key] = value;
    }
    return merged;
}

export function normalizePriority(value) {
    const input = Array.isArray(value) ? value : String(value || '').split(',');
    const result = [];
    for (const item of input) {
        const name = String(item || '').trim().toLowerCase();
        if (providerNames.includes(name) && !result.includes(name)) result.push(name);
    }
    for (const name of providerNames) {
        if (!result.includes(name)) result.push(name);
    }
    return result;
}

const service = {
    async decode(c, encryptedValue, legacyResendTokens = {}) {
        const configs = await decryptJson(c, encryptedValue, {});
        for (const [domain, token] of Object.entries(legacyResendTokens || {})) {
            const normalized = normalizeDomain(domain);
            if (!normalized || !token) continue;
            configs[normalized] ||= defaultDomainConfig();
            if (!configs[normalized].resend?.apiKey) {
                configs[normalized].resend = { enabled: 1, apiKey: token };
            }
        }
        return configs;
    },

    async encode(c, configs) {
        return encryptJson(c, configs || {});
    },

    async mergeAndEncode(c, encryptedValue, legacyResendTokens, incoming) {
        const current = await this.decode(c, encryptedValue, legacyResendTokens);
        for (const [rawDomain, domainIncoming] of Object.entries(incoming || {})) {
            const domain = normalizeDomain(rawDomain);
            if (!domain) continue;
            if (domainIncoming?.clear === true) {
                delete current[domain];
                continue;
            }
            const existingDomain = current[domain] || defaultDomainConfig();
            const mergedDomain = { ...existingDomain };
            for (const name of providerNames) {
                if (domainIncoming?.[name]) {
                    mergedDomain[name] = mergeProvider(existingDomain[name], domainIncoming[name]);
                }
            }
            current[domain] = mergedDomain;
        }
        return this.encode(c, current);
    },

    mask(configs) {
        const result = structuredClone(configs || {});
        for (const domainConfig of Object.values(result)) {
            for (const provider of Object.values(domainConfig || {})) {
                if (!provider || typeof provider !== 'object') continue;
                for (const key of secretFields) {
                    if (provider[key]) provider[key] = maskSecret(provider[key]);
                }
            }
        }
        return result;
    },

    getDomainConfig(configs, domain) {
        const normalized = normalizeDomain(domain);
        return configs?.[normalized] || null;
    },

    defaultDomainConfig
};

export default service;
