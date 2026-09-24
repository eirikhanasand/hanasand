import { isDeepStrictEqual } from 'node:util'
import ipaddr from 'ipaddr.js'
import type { CdnRefreshLog } from './analyzeCdnRefresh.ts'

export const cdnDeliveryRuleId = 'cdn.telemetry_deliveries.v1'
export const cdnDeliveryRule = {
    id: cdnDeliveryRuleId, version: '1', name: 'Successful traffic report deliveries', family: 'HTTP', severity: 'low', enabled: false,
    explanation: 'Count and drop exact successful CDN traffic-report delivery envelopes. Keep original proxy/application requests and traffic records, which identify the real client. Keep failures, unexpected content, detections and Store matches. Delivery success does not classify the reported traffic as safe.',
    evidence: ['collector host', 'CDN container', 'delivery request ID', 'delivery outcome'],
}
const equals = (path: string, value: string) => ({ path, operator: 'equals' as const, value, caseSensitive: true })
export const cdnDeliveryDefinition = {
    match: 'all' as const, stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: {},
    conditions: [equals('service', 'cdn'), equals('host', 'inspur'), equals('level', 'info'),
        equals('metadata.collector', 'docker'), equals('metadata.stream', 'stdout'),
        equals('metadata.structured.level', '30'), equals('metadata.structured.msg', 'http_access'),
        equals('metadata.structured.access.method', 'POST'), equals('metadata.structured.access.path', '/api/traffic'),
        equals('metadata.structured.access.status', '201'), equals('metadata.structured.access.ip', '172.26.0.1'),
        equals('metadata.structured.access.inspection.version', '1'), equals('metadata.structured.access.inspection.bodyEmpty', 'false'),
        equals('metadata.structured.access.inspection.headersSafe', 'false'), equals('metadata.structured.access.inspection.pathSafe', 'true')],
}
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)))

// These are delivery envelopes, not original client requests or report bodies.
// Unknown content must remain available for inspection. Provenance comes from
// the authenticated collector; source IDs remain usable after timestamp storage
// loses Docker's sub-millisecond precision during historical reprocessing.
export function verifyCdnDeliveryEnvelope(log: CdnRefreshLog): boolean {
    if (!exact(log, ['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'])
        || ![log.service, log.host, log.level].every(value => typeof value === 'string' && value.length > 0)
        || !/^[a-f0-9]{64}$/.test(log.sourceEventId || '') || typeof log.message !== 'string'
        || typeof log.timestamp !== 'string' || !Number.isFinite(Date.parse(log.timestamp))) return false
    const metadata = log.metadata
    if (!exact(metadata, ['collector', 'container_id', 'stream', 'structured']) || metadata.collector !== 'docker'
        || typeof metadata.container_id !== 'string' || !/^[a-f0-9]{12,64}$/.test(metadata.container_id)) return false
    const row = metadata.structured
    if (!exact(row, ['level', 'time', 'pid', 'hostname', 'reqId', 'access', 'msg'])
        || row.level !== 30 || !Number.isSafeInteger(row.time) || !Number.isFinite(new Date(Number(row.time)).getTime()) || !Number.isSafeInteger(row.pid) || Number(row.pid) < 1
        || typeof row.hostname !== 'string' || !/^[a-f0-9]{12,64}$/.test(row.hostname) || !metadata.container_id.startsWith(row.hostname)
        || typeof row.reqId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.reqId)
        || Math.abs(Date.parse(log.timestamp) - Number(row.time)) > 1000) return false
    const access = row.access
    if (!exact(access, ['key', 'method', 'path', 'status', 'ip', 'timestamp', 'inspection'])
        || access.key !== `http-cdn:${row.reqId}` || typeof access.method !== 'string' || typeof access.path !== 'string'
        || !Number.isInteger(access.status) || Number(access.status) < 200 || Number(access.status) >= 300 || typeof access.ip !== 'string' || !ipaddr.isValid(access.ip)
        || typeof access.timestamp !== 'string' || new Date(Number(row.time)).toISOString() !== access.timestamp
        || !exact(access.inspection, ['version', 'bodyEmpty', 'headersSafe', 'pathSafe']) || access.inspection.version !== 1
        || !['bodyEmpty', 'headersSafe', 'pathSafe'].every(key => typeof (access.inspection as Record<string, unknown>)[key] === 'boolean')) return false
    try {
        const original = JSON.parse(log.message)
        return JSON.stringify(original) === log.message && isDeepStrictEqual(original, row)
    } catch { return false }
}
