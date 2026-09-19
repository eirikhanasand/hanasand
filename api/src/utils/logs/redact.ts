const secretKey = /password|passwd|token|secret|cookie|authorization|api[_-]?key|private[_-]?key/i

export function redactLogText(value: string) {
    return value
        .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@')
        .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_.=-]+/gi, '$1 [REDACTED]')
        .replace(/((?:--[\w-]*(?:password|passwd|token|secret|api[_-]?key|authorization|cookie)[\w-]*\s+)|(?:\b[\w-]*(?:password|passwd|token|secret|api[_-]?key|authorization|cookie)[\w-]*["']?\s*[=:]\s*))(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s&;,]+)/gi, '$1[REDACTED]')
}

// Preserve command structure and observable behavior while removing common
// credential forms from both raw service logs and normalized Mill evidence.
export function redactLogValue(value: unknown): unknown {
    if (typeof value === 'string') return redactLogText(value)
    if (Array.isArray(value)) return value.map((child, index) => typeof value[index - 1] === 'string' && /^--?[\w-]+$/.test(value[index - 1]) && secretKey.test(value[index - 1]) ? '[REDACTED]' : redactLogValue(child))
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, secretKey.test(key) ? '[REDACTED]' : redactLogValue(child)]))
}
