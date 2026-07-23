const CUSTOMER_OUTBOUND_REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
    [/(discord(?:app)?\.com\/api\/webhooks\/[^/\s"']+\/)[^/\s"']+/gi, '$1...'],
    [/(api\/webhooks\/[^/\s"']+\/)[^/\s"']+/gi, '$1...'],
    [/\b(?:https?|socks5?):\/\/[^\s"'<>]*(?:\.onion|\.i2p)(?:[^\s"'<>]*)?/gi, '[restricted source]'],
    [/\b[a-z0-9-]{3,56}\.(?:onion|i2p)(?:\/[^\s"'<>]*)?/gi, '[restricted source]'],
    [/\bmetadata:\/\/darkweb\/[^\s"'<>]*/gi, '[restricted source]'],
    [/\bfreenet:[^\s"'<>]*/gi, '[restricted source]'],
    [/\b(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog)\/[a-z0-9_+/-]+/gi, '[contact redacted]'],
    [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[contact redacted]'],
    [/(^|[^\w])@[a-z0-9_]{3,32}\b/gi, '$1[contact redacted]'],
    [/\b(?:telegram|signal|session|tox|jabber|xmpp)\s*[:=]\s*[^\s,;]+/gi, '[contact redacted]'],
    [/\b\d+:[A-Z0-9_-]{20,}\b/gi, '[credential redacted]'],
    [/\b(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[credentials-redacted]@'],
    [/([?&])(?:token|secret|password|key|credential|api[_-]?key)=[^&\s"']+/gi, '$1redacted'],
    [/\b(?:api[_ -]?key|key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|private[_ -]?key|password|passwd|session[_ -]?string|token|secret|credential|authorization|cookie)\s*[:=]\s*["']?[^\s,;"'}]+["']?/gi, '[credential redacted]'],
    [/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, '[credential redacted]'],
    [/\b(?:sk|rk|pk)_[A-Za-z0-9_-]{16,}\b/g, '[credential redacted]'],
    [/(?<![A-Za-z0-9.-])(?!\d{4}-\d{2}-\d{2}(?:T|\b))(?!\d{1,3}(?:\.\d{1,3}){3}\b)\+?\d[\d\s().-]{7,}\d/g, '[phone redacted]'],
]

export function sanitizeCustomerOutboundText(value: string) {
    return CUSTOMER_OUTBOUND_REDACTIONS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
}

export function containsUnsafeCustomerOutboundText(value: unknown): boolean {
    if (typeof value === 'string') return sanitizeCustomerOutboundText(value) !== value
    if (Array.isArray(value)) return value.some(containsUnsafeCustomerOutboundText)
    return Boolean(value && typeof value === 'object'
        && Object.values(value as Record<string, unknown>).some(containsUnsafeCustomerOutboundText))
}

export function canonicalJson(value: unknown) {
    return JSON.stringify(canonicalValue(value))
}

function canonicalValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(item => item === undefined ? null : canonicalValue(item))
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined && typeof item !== 'function' && typeof item !== 'symbol')
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, item]) => [key, canonicalValue(item)]))
}
