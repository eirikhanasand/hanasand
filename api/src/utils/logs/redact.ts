const secretKey = /password|passwd|token|secret|cookie|authorization|api[_-]?key|private[_-]?key/i
const credentialFlags: Record<string, string[]> = {
    curl: ['-u', '-U', '--user', '--proxy-user', '--oauth2-bearer'],
    sshpass: ['-p'], mysql: ['-p'], mariadb: ['-p'], 'redis-cli': ['-a'],
}
const programName = (value: string) => value.split(/[/\\]/).at(-1)?.replace(/\.exe$/i, '').toLowerCase() || ''
const regexEscape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function redactLogText(value: string) {
    return value
        // Redact the entire quoted header, including additional cookie pairs.
        .replace(/(["'])((?:proxy-)?authorization|cookie|set-cookie)\s*[:=]\s*[^\r\n]*?\1/gi, '$1$2: [REDACTED]$1')
        .replace(/^(\s*(?:cookie|set-cookie)\s*:\s*)[^\r\n]*/gim, '$1[REDACTED]')
        .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@')
        .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_.=-]+/gi, '$1 [REDACTED]')
        .replace(/((?:--[\w-]*(?:password|passwd|token|secret|api[_-]?key|authorization|cookie)[\w-]*\s+)|(?:\b[\w-]*(?:password|passwd|token|secret|api[_-]?key|authorization|cookie)[\w-]*["']?\s*[=:]\s*))(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s&;,'"]+)/gi, '$1[REDACTED]')
        .replace(/(^|[\s;&|'"()])((?:[^\s'";&|()]*[/\\])?(?:curl|sshpass|mysql|mariadb|redis-cli)(?:\.exe)?)(\s+[^;\r\n]*)/gi, (_match, prefix, executable, args) => {
            for (const flag of credentialFlags[programName(executable)] || []) {
                const escaped = regexEscape(flag)
                args = args.replace(new RegExp(`(^|\\s)(${escaped})(?:=|\\s+)(?:"[^"\\r\\n]*"|'[^'\\r\\n]*'|[^\\s'";&|]+)`, 'g'), '$1$2 [REDACTED]')
                if (flag.length === 2) args = args.replace(new RegExp(`(^|\\s)(${escaped})([^\\s'";&|]+)`, 'g'), '$1$2[REDACTED]')
            }
            return `${prefix}${executable}${args}`
        })
}

function redactArguments(value: string[]) {
    const flags = credentialFlags[programName(value[0] || '')] || []
    let hideNext = false
    return value.map(argument => {
        if (hideNext) { hideNext = false; return '[REDACTED]' }
        if (flags.includes(argument) || (/^--?[\w-]+$/.test(argument) && secretKey.test(argument))) hideNext = true
        const attached = flags.find(flag => argument.startsWith(`${flag}=`) || (flag.length === 2 && argument.startsWith(flag) && argument.length > flag.length))
        return attached ? `${attached}[REDACTED]` : redactLogText(argument)
    })
}

// Preserve command structure and observable behavior while removing common
// credential forms from both raw service logs and normalized Mill evidence.
export function redactLogValue(value: unknown): unknown {
    if (typeof value === 'string') return redactLogText(value)
    if (Array.isArray(value)) return value.every(child => typeof child === 'string') ? redactArguments(value) : value.map(redactLogValue)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, secretKey.test(key) ? '[REDACTED]' : redactLogValue(child)]))
}
