import ipaddr from 'ipaddr.js'
import { matchesMillRule, type MillCondition } from './conditions.ts'
import { isDeepStrictEqual } from 'node:util'

export const accessRuleId = 'http.routine_access.v1'
export const accessRule = {
    id: accessRuleId, version: '1', name: 'Routine successful requests', family: 'HTTP', severity: 'low', enabled: false,
    explanation: 'Count ordinary GET/200 requests by IP and drop the individual logs. Keep bodies, suspicious requests and security activity. Alert above 50 requests in a rolling minute.',
    evidence: ['source IP', 'request count', 'rolling time window'],
}
export const accessDefinition = { match: 'all' as const, conditions: [
    { path: 'method', operator: 'equals', value: 'GET', caseSensitive: true },
    { path: 'status', operator: 'equals', value: '200' },
    { path: 'service', operator: 'regex', value: '^(?:http-traffic|cdn|hanasand[-_]api|api|hanasand-api-[1-4])$', caseSensitive: true },
    { path: 'originHost', operator: 'regex', value: '^(?:native|inspur|ovhcloud)$', caseSensitive: true },
] as MillCondition[], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: { windowMinutes: 1, requestThreshold: 50 } }

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
    inspection?: { version?: number, bodyEmpty?: boolean, headersSafe?: boolean, pathSafe?: boolean }, protected?: boolean, service?: string, originHost?: string }
export function accessPolicyContext(event: AccessEvent) { return { ...event, service: event.service || 'http-traffic', originHost: event.originHost || 'native' } }
export function eligibleAccess(event: AccessEvent, definition: { conditions: MillCondition[] } = accessDefinition) {
    return validAccessEvidence(event) && matchesMillRule(accessPolicyContext(event), definition.conditions)
}
function validAccessEvidence(event: AccessEvent) {
    if (event.protected || typeof event.method !== 'string' || !/^[A-Z]+$/.test(event.method) || !Number.isInteger(event.status) || event.status < 100 || event.status >= 400 || typeof event.ip !== 'string' || typeof event.timestamp !== 'string' || !event.key || !ordinaryAccessPath(event.path)
        || !Number.isFinite(Date.parse(event.timestamp)) || !ipaddr.isValid(event.ip)) return false
    const check = event.inspection
    if (check && (check.bodyEmpty === false || check.headersSafe === false || check.pathSafe === false)) return false
    return (check?.version === 1 && check.bodyEmpty === true && check.headersSafe === true && check.pathSafe === true)
}

type AccessLog = { service: string, level: string, host?: string, message?: string, metadata?: Record<string, unknown>, sourceEventId?: string, timestamp?: string }
const fields = (value: unknown, allowed: string[]): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key)))

// Replica records must match the producer's complete envelope. Unknown fields or
// disagreement with the original message retain the record, even with status 200.
function standardReplicaAccess(log: AccessLog): boolean {
    const metadata = log.metadata
    if (!fields(metadata, ['collector', 'container_id', 'stream', 'structured']) || metadata.collector !== 'docker' || metadata.stream !== 'stdout'
        || !/^[a-f0-9]{12,64}$/.test(String(metadata.container_id))
        || !/^[a-f0-9]{64}$/.test(log.sourceEventId || '') || typeof log.message !== 'string') return false
    const row = metadata.structured
    if (!fields(row, ['level', 'time', 'pid', 'hostname', 'reqId', 'access', 'req', 'msg']) || row.level !== 30 || row.msg !== 'http_access'
        || !Number.isSafeInteger(row.pid) || Number(row.pid) < 1 || !Number.isSafeInteger(row.time)
        || typeof row.hostname !== 'string' || !/^[a-zA-Z0-9._-]{1,253}$/.test(row.hostname)
        || typeof row.reqId !== 'string' || !/^[a-f0-9-]{36}$/i.test(row.reqId)) return false
    const access = row.access, req = row.req
    if (!fields(access, ['key', 'ip', 'timestamp', 'path', 'method', 'status', 'inspection'])
        || !fields(access.inspection, ['version', 'bodyEmpty', 'headersSafe', 'pathSafe'])
        || !fields(req, ['method', 'url', 'remoteAddress']) || req.method !== access.method || req.url !== access.path
        || typeof req.url !== 'string' || !/^\/[a-zA-Z0-9/_~.-]*$/.test(req.url)
        || access.key !== `http-api:${row.reqId}` || typeof access.timestamp !== 'string' || Date.parse(access.timestamp) !== row.time
        || (req.remoteAddress !== undefined && (typeof req.remoteAddress !== 'string' || !ipaddr.isValid(req.remoteAddress)))) return false
    if (!validAccessEvidence(access as AccessEvent)) return false
    try {
        const original = JSON.parse(log.message)
        // The logger emits compact JSON. Reject duplicate keys and alternative
        // encodings that parsing could otherwise erase from the retained evidence.
        return JSON.stringify(original) === log.message && isDeepStrictEqual(original, row)
    } catch { return false }
}

export function accessFromLog(log: AccessLog, definition: { conditions: MillCondition[] } = accessDefinition): AccessEvent | null {
    const event = verifiedAccessFromLog(log)
    return event && eligibleAccess(event, definition) ? event : null
}

export function verifiedAccessFromLog(log: AccessLog): AccessEvent | null {
    const metadata = log.metadata || {}
    const replica = /^hanasand-api-[1-4]$/.test(log.service)
    // Only collector-authenticated access records, not arbitrary application JSON.
    if (metadata.organizationId || metadata.tenantId || log.level !== 'info') return null
    if (replica && !standardReplicaAccess(log)) return null
    const structured = metadata.structured as Record<string, unknown> | undefined
    const access = structured?.access as AccessEvent | undefined
    if (!access || structured?.msg !== 'http_access' || typeof access.key !== 'string') return null
    if (!access.key.startsWith('http-api:') && !access.key.startsWith('http-cdn:')) return null
    return validAccessEvidence(access) ? { ...access, timestamp: log.timestamp || access.timestamp, service: log.service, originHost: replica ? log.host || '' : 'native' } : null
}
