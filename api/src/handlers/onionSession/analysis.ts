import { createHash } from 'node:crypto'

export type SandboxThreatAssociation = {
    name: string
    category: 'actor' | 'malware' | 'ransomware' | 'tool' | 'campaign'
    confidence: 'high' | 'medium' | 'low'
    evidence: string
    source: 'rendered_page' | 'tool_context' | 'decoded_script'
}

export type InspectedSandboxScript = {
    id: string
    src: string
    inlineBytes: number
    obfuscationScore: number
    reasons: string[]
    sample: string
    sha256: string
}

const MAX_SCRIPT_SAMPLE = 3200
export const THREAT_ASSOCIATION_TERMS: Array<{ name: string; category: SandboxThreatAssociation['category']; pattern: RegExp; context?: RegExp }> = [
    { name: 'LockBit', category: 'ransomware', pattern: /\block\s*bit\b/i },
    { name: 'ALPHV / BlackCat', category: 'ransomware', pattern: /\b(?:alphv|black\s*cat)\b/i },
    { name: 'Clop', category: 'ransomware', pattern: /\bcl0?p\b/i },
    { name: 'Akira', category: 'ransomware', pattern: /\bakira\b/i },
    { name: 'Black Basta', category: 'ransomware', pattern: /\bblack\s*basta\b/i },
    { name: 'Lazarus', category: 'actor', pattern: /\blazarus\b/i },
    { name: 'APT29 / Cozy Bear', category: 'actor', pattern: /\b(?:apt29|cozy\s*bear)\b/i },
    { name: 'APT28 / Fancy Bear', category: 'actor', pattern: /\b(?:apt28|fancy\s*bear)\b/i },
    { name: 'Scattered Spider', category: 'actor', pattern: /\bscattered\s*spider\b/i },
    { name: 'FIN7', category: 'actor', pattern: /\bfin7\b/i },
    { name: 'TA505', category: 'actor', pattern: /\bta505\b/i },
    { name: 'QakBot', category: 'malware', pattern: /\b(?:qakbot|qbot)\b/i },
    { name: 'Emotet', category: 'malware', pattern: /\bemotet\b/i },
    { name: 'TrickBot', category: 'malware', pattern: /\btrickbot\b/i },
    { name: 'IcedID', category: 'malware', pattern: /\bicedid\b/i },
    { name: 'Cobalt Strike', category: 'tool', pattern: /\bcobalt\s*strike\b/i },
    { name: 'SocGholish', category: 'malware', pattern: /\bsocgholish\b/i },
    { name: 'Lumma', category: 'malware', pattern: /\blumma\b/i },
    { name: 'RedLine', category: 'malware', pattern: /\bred\s*line\b/i },
    { name: 'AsyncRAT', category: 'malware', pattern: /\basync\s*rat\b/i },
    { name: 'Agent Tesla', category: 'malware', pattern: /\bagent\s*tesla\b/i },
    { name: 'FormBook', category: 'malware', pattern: /\bformbook\b/i },
    { name: 'Vidar', category: 'malware', pattern: /\bvidar\b/i, context: /\b(?:vidar\s+(?:stealer|malware|payload|c2|ioc|infection)|(?:stealer|malware|payload|c2|ioc|infection)\s+vidar)\b/i },
    { name: 'SmokeLoader', category: 'malware', pattern: /\bsmoke\s*loader\b/i },
    { name: 'DarkGate', category: 'malware', pattern: /\bdarkgate\b/i },
    { name: 'Remcos', category: 'malware', pattern: /\bremcos\b/i },
]

const BLOCKED_SANDBOX_HOSTS = new Set([
    'localhost',
    'metadata.google.internal',
    'metadata',
])

const BLOCKED_SANDBOX_HOST_SUFFIXES = [
    '.local',
    '.localhost',
    '.internal',
    '.lan',
]

export function sandboxUrlSafety(value: string, options: { allowLocalTargets?: boolean } = {}): { ok: true } | { ok: false; reason: string } {
    let parsed: URL
    try {
        parsed = new URL(value)
    } catch {
        return { ok: false, reason: 'invalid URL' }
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { ok: false, reason: 'only http and https URLs are allowed' }
    }

    if (parsed.username || parsed.password) {
        return { ok: false, reason: 'embedded credentials are not allowed' }
    }

    const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (!host) return { ok: false, reason: 'missing hostname' }
    if (!options.allowLocalTargets && BLOCKED_SANDBOX_HOSTS.has(host)) return { ok: false, reason: 'internal hostname' }
    if (!options.allowLocalTargets && BLOCKED_SANDBOX_HOST_SUFFIXES.some(suffix => host.endsWith(suffix))) {
        return { ok: false, reason: 'internal hostname suffix' }
    }
    if (!options.allowLocalTargets && (isBlockedIPv4Host(host) || isBlockedIPv6Host(host))) {
        return { ok: false, reason: 'private or local network address' }
    }

    return { ok: true }
}

export function summarizeDeobfuscationTask(script: InspectedSandboxScript) {
    const decoded = decodeScriptSample(script.sample)
    const joined = [script.sample, decoded.preview].join('\n')
    const indicators = extractIndicators(joined)
    const maliciousReasons = [
        indicators.ips.length || indicators.domains.length ? 'decoded network indicators' : '',
        /document\.write|location\.href|window\.location|fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/i.test(joined) ? 'browser redirect or network call' : '',
        /powershell|cmd\.exe|wscript|mshta|download|payload|stealer|wallet|seed phrase/i.test(joined) ? 'payload or credential-theft language' : '',
        script.reasons.includes('dynamic execution') ? 'dynamic execution' : '',
    ].filter(Boolean)

    return {
        scriptId: script.id,
        source: script.src || 'inline',
        webcrackReady: Boolean(script.sample),
        sample: script.sample,
        sha256: script.sha256,
        decodedPreview: decoded.preview,
        decodedTransforms: decoded.transforms,
        indicators,
        threatAssociations: extractThreatAssociations(joined, 'decoded_script'),
        assessment: maliciousReasons.length ? 'suspicious' : 'unknown',
        summary: maliciousReasons.length
            ? `Decoded script remains suspicious: ${maliciousReasons.join(', ')}.`
            : 'Decoded sample did not expose a high-confidence payload in the extracted window.',
    }
}

export function decodeScriptSample(sample: string) {
    const transforms: string[] = []
    const decoded: string[] = []
    for (const match of sample.matchAll(/['"`]([A-Za-z0-9+/]{40,}={0,2})['"`]/g)) {
        const value = match[1]
        try {
            const output = Buffer.from(value, 'base64').toString('utf8')
            if (looksPrintable(output)) {
                transforms.push('base64 string')
                decoded.push(output)
            }
        } catch {
            // Ignore invalid base64 candidates; obfuscated pages often contain many decoys.
        }
    }
    const unescaped = sample
        .replace(/\\x([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
        .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    if (unescaped !== sample) {
        transforms.push('hex/unicode escapes')
        decoded.push(unescaped)
    }

    return {
        transforms: Array.from(new Set(transforms)),
        preview: decoded.join('\n').replace(/\s+/g, ' ').trim().slice(0, 1200),
    }
}

export function inspectScript(script: { src: string; inline: string }, index: number): InspectedSandboxScript {
    const value = script.inline || ''
    const longStringCount = (value.match(/["'`][A-Za-z0-9+/=]{80,}["'`]/g) || []).length
    const evalCount = (value.match(/\b(eval|Function|setTimeout|setInterval)\s*\(/g) || []).length
    const atobCount = (value.match(/\b(atob|btoa|unescape|decodeURIComponent)\s*\(/g) || []).length
    const hexEscapeCount = (value.match(/\\x[0-9a-f]{2}|\\u[0-9a-f]{4}/gi) || []).length
    const charCodeCount = (value.match(/fromCharCode|charCodeAt/g) || []).length
    const entropyHint = value.length > 600 ? Math.min(3, Math.floor(uniqueRatio(value) * 4)) : 0
    const obfuscationScore = longStringCount + evalCount + atobCount + Math.min(3, Math.floor(hexEscapeCount / 8)) + charCodeCount + entropyHint
    return {
        id: `script_${index + 1}`,
        src: script.src,
        inlineBytes: value.length,
        obfuscationScore,
        reasons: [
            longStringCount ? 'long encoded strings' : '',
            evalCount ? 'dynamic execution' : '',
            atobCount ? 'base64/URI decoding' : '',
            hexEscapeCount ? 'hex/unicode escapes' : '',
            charCodeCount ? 'character-code construction' : '',
        ].filter(Boolean),
        sample: value ? value.slice(0, MAX_SCRIPT_SAMPLE) : '',
        sha256: createHash('sha256').update(script.src || value).digest('hex'),
    }
}

export function extractIndicators(value: string) {
    const domains = value.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi) || []
    const ips = (value.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [])
        .filter(ip => ip.split('.').every(part => Number(part) >= 0 && Number(part) <= 255))
    const urls = value.match(/https?:\/\/[^\s"'<>]+/gi) || []
    return {
        domains: Array.from(new Set(domains.map(item => item.toLowerCase()).filter(isUsefulDomainIndicator))).slice(0, 80),
        ips: Array.from(new Set(ips)).slice(0, 80),
        urls: Array.from(new Set(urls.filter(isUsefulUrlIndicator))).slice(0, 80),
    }
}

export function extractThreatAssociations(value: string, source: SandboxThreatAssociation['source']) {
    const normalized = value.replace(/\s+/g, ' ')
    const found: SandboxThreatAssociation[] = []
    for (const term of THREAT_ASSOCIATION_TERMS) {
        const match = term.pattern.exec(normalized)
        if (!match || match.index === undefined) continue
        const evidence = evidenceWindow(normalized, match.index, match[0].length)
        const hasThreatContext = term.context ? term.context.test(evidence) : /\b(?:attributed|associated|linked|campaign|operator|ransomware|malware|detected|family|actor)\b/i.test(evidence)
        if (!hasThreatContext && source !== 'decoded_script') continue
        const confidence = hasThreatContext ? 'high' : 'low'
        found.push({
            name: term.name,
            category: term.category,
            confidence,
            evidence,
            source,
        })
    }
    const seen = new Set<string>()
    return found.filter(item => {
        const key = `${item.name}:${item.category}:${item.source}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    }).slice(0, 12)
}

const GENERIC_DOTTED_IDENTIFIERS = new Set([
    'document.createelement',
    'document.body',
    'document.head',
    'document.cookie',
    'document.location',
    'window.location',
    'window.history',
    'object.assign',
    'object.create',
    'json.parse',
    'json.stringify',
    'console.log',
    'el.style',
    'el.textcontent',
    'element.style',
])

function isUsefulDomainIndicator(value: string) {
    if (GENERIC_DOTTED_IDENTIFIERS.has(value)) return false
    if (/^(?:document|window|object|array|string|number|console|json|math|element|el|node|event|navigator|location|history|localstorage|sessionstorage)\./i.test(value)) return false
    return true
}

function isUsefulUrlIndicator(value: string) {
    try {
        return isUsefulDomainIndicator(new URL(value).hostname.toLowerCase())
    } catch {
        return false
    }
}

function evidenceWindow(value: string, index: number, length: number) {
    return value
        .slice(Math.max(0, index - 120), Math.min(value.length, index + length + 120))
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 260)
}

function looksPrintable(value: string) {
    const printable = Array.from(value).filter(character => {
        const code = character.charCodeAt(0)
        return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)
    }).length
    return printable >= 20 && printable / Math.max(1, value.length) > 0.75
}

function uniqueRatio(value: string) {
    if (!value) return 0
    return new Set(value).size / value.length
}

function isBlockedIPv4Host(host: string) {
    const parts = host.split('.')
    if (parts.length !== 4 || parts.some(part => !/^\d+$/.test(part))) return false
    const octets = parts.map(Number)
    if (octets.some(octet => octet < 0 || octet > 255)) return false
    const [a, b] = octets
    return a === 0
        || a === 10
        || a === 127
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168)
        || (a === 100 && b >= 64 && b <= 127)
        || a >= 224
}

function isBlockedIPv6Host(host: string) {
    if (!host.includes(':')) return false
    const normalized = host.toLowerCase()
    const mappedIPv4 = ipv4FromMappedIPv6(normalized)
    if (mappedIPv4 && isBlockedIPv4Host(mappedIPv4)) return true
    return normalized === '::'
        || normalized === '::1'
        || normalized.startsWith('fc')
        || normalized.startsWith('fd')
        || normalized.startsWith('fe80:')
        || normalized.startsWith('ff')
}

function ipv4FromMappedIPv6(host: string) {
    const match = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host)
    if (!match) return ''
    const high = Number.parseInt(match[1], 16)
    const low = Number.parseInt(match[2], 16)
    if ([high, low].some(part => !Number.isFinite(part) || part < 0 || part > 0xffff)) return ''
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.')
}
