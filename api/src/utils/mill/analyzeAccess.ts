import ipaddr from 'ipaddr.js'

export const accessRuleId = 'http.routine_access.v1'
export const accessRule = {
    id: accessRuleId, version: '1', name: 'Routine successful requests', family: 'HTTP', severity: 'high', enabled: false,
    explanation: 'Count ordinary GET/200 requests by IP and drop the individual logs. Keep bodies, suspicious requests and security activity. Alert above 50 requests in a rolling minute.',
    evidence: ['source IP', 'request count', 'rolling time window'],
}
export const accessDefinition = { match: 'all' as const, conditions: [], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: { windowMinutes: 1, requestThreshold: 50 } }

const protectedPath = /(?:^|[/_.-])(?:auth|login|logout|signin|signup|admin|management|organizations|account|password|token|session|support|audit|security|webhook|payment|billing|stripe)(?:[/_.?-]|$)/i
// eslint-disable-next-line no-control-regex -- Control bytes are unsafe in access metadata.
const suspicious = /(?:[\x00-\x08\x0a-\x1f\x7f]|\.\.[/\\]|<\s*script|\$\{|\bunion\s+(?:all\s+)?select\b|\bsleep\s*\(|\/etc\/passwd|\/\.env|jndi:)/i
const ordinaryHeaders = new Set(['host', 'accept', 'accept-encoding', 'accept-language', 'cache-control', 'connection', 'content-length', 'user-agent', 'referer', 'if-none-match', 'if-modified-since', 'pragma', 'priority', 'upgrade-insecure-requests', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site', 'sec-fetch-user', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip', 'via', 'x-request-id', 'traceparent', 'tracestate'])
export function ordinaryAccessPath(value: unknown): boolean {
    if (typeof value !== 'string' || !value || value.length > 8192) return false
    let decoded = value
    try { for (let i = 0; i < 2; i++) decoded = decodeURIComponent(decoded) } catch { return false }
    return !protectedPath.test(decoded) && !suspicious.test(decoded)
}

// Inspect at the HTTP boundary, before redaction. Store only the decision, never
// authorization values or request bodies. Unknown headers conservatively retain.
export function inspectAccess(req: { url: string, headers: Record<string, string | string[] | undefined>, body?: unknown }) {
    const bodyEmpty = req.body === undefined || req.body === null
    const headersSafe = Object.entries(req.headers).every(([key, value]) => ordinaryHeaders.has(key.toLowerCase())
        && !suspicious.test(String(value || '')) && String(value || '').length <= 4096)
    return { version: 1, bodyEmpty: bodyEmpty && !req.headers['transfer-encoding'] && Number(req.headers['content-length'] || 0) === 0,
        headersSafe, pathSafe: ordinaryAccessPath(req.url) }
}

export type AccessEvent = { key: string, ip: string, timestamp: string, path: string, method: string, status: number,
    inspection?: { version?: number, bodyEmpty?: boolean, headersSafe?: boolean, pathSafe?: boolean }, protected?: boolean }
export function eligibleAccess(event: AccessEvent) {
    if (event.protected || event.method !== 'GET' || event.status !== 200 || typeof event.ip !== 'string' || typeof event.timestamp !== 'string' || !event.key || !ordinaryAccessPath(event.path)
        || !Number.isFinite(Date.parse(event.timestamp)) || !ipaddr.isValid(event.ip)) return false
    const check = event.inspection
    if (check && (check.bodyEmpty === false || check.headersSafe === false || check.pathSafe === false)) return false
    return (check?.version === 1 && check.bodyEmpty === true && check.headersSafe === true && check.pathSafe === true)
}

export function accessFromLog(log: { service: string, level: string, metadata?: Record<string, unknown>, sourceEventId?: string, timestamp?: string }): AccessEvent | null {
    const metadata = log.metadata || {}
    // Only collector-authenticated access records, not arbitrary application JSON.
    if (metadata.organizationId || metadata.tenantId || log.level !== 'info' || !/^(?:cdn|hanasand[-_]api|api)$/.test(log.service)) return null
    const structured = metadata.structured as Record<string, unknown> | undefined
    const access = structured?.access as AccessEvent | undefined
    if (!access || structured?.msg !== 'http_access' || typeof access.key !== 'string') return null
    if (!access.key.startsWith('http-api:') && !access.key.startsWith('http-cdn:')) return null
    return { ...access, timestamp: log.timestamp || access.timestamp }
}
