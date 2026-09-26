import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

export const cdnRefreshRuleId = 'cdn.successful_cache_refresh.v1'
export const cdnRefreshRule = {
    id: cdnRefreshRuleId, version: '1', name: 'Successful CDN cache refreshes', family: 'System', severity: 'low', enabled: false,
    explanation: 'Count verified successful hot-cache refresh completions from the CDN. Require an exact completion envelope, normal duration and normal cadence. Keep legacy messages, errors, slow or unusually frequent refreshes and all unexpected fields.',
    evidence: ['host', 'container', 'completion status', 'duration', 'refresh interval'],
}
const equals = (path: string, value: string) => ({ path, operator: 'equals' as const, value, caseSensitive: true })
export const cdnRefreshDefinition = { match: 'all' as const, stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep',
    conditions: [equals('service', 'cdn'), equals('level', 'info'), { path: 'host', operator: 'regex' as const, caseSensitive: true, value: '^(inspur|ovhcloud)$' },
        equals('metadata.stream', 'stdout'), equals('metadata.structured.level', '30'),
        equals('metadata.structured.msg', 'Hot cached queries refreshed'), equals('metadata.structured.refresh.status', '200')],
    parameters: { maxDurationMs: 1000, minIntervalMs: 5000, maxIntervalMs: 10000 } }

export type CdnRefreshLog = { service: string, host?: string, level: string, message: string, metadata?: Record<string, unknown>, sourceEventId?: string, timestamp?: string }
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)))

export function verifyCdnRefreshEvidence(log: CdnRefreshLog): boolean {
    if (!exact(log, ['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'])
        || ![log.service, log.host, log.level].every(value => typeof value === 'string' && value.length > 0)
        || typeof log.message !== 'string' || !log.timestamp || !Number.isFinite(Date.parse(log.timestamp))) return false
    const metadata = log.metadata
    if (!exact(metadata, ['collector', 'container_id', 'stream', 'structured']) || metadata.collector !== 'docker' || !['stdout', 'stderr'].includes(String(metadata.stream))
        || typeof metadata.container_id !== 'string' || !/^[a-f0-9]{12,64}$/.test(metadata.container_id)) return false
    const row = metadata.structured
    if (!exact(row, ['level', 'time', 'pid', 'hostname', 'refresh', 'msg']) || !Number.isInteger(row.level) || typeof row.msg !== 'string'
        || !Number.isSafeInteger(row.pid) || Number(row.pid) < 1 || !Number.isSafeInteger(row.time)
        || typeof row.hostname !== 'string' || !/^[a-zA-Z0-9._-]{1,253}$/.test(row.hostname)
        || Math.abs(Date.parse(log.timestamp) - Number(row.time)) > 1000) return false
    const proof = row.refresh
    if (!exact(proof, ['version', 'status', 'durationMs', 'intervalMs']) || proof.version !== 1 || !Number.isInteger(proof.status)
        || typeof proof.durationMs !== 'number' || !Number.isFinite(proof.durationMs) || proof.durationMs < 0
        || !(proof.intervalMs === null || typeof proof.intervalMs === 'number' && Number.isFinite(proof.intervalMs) && proof.intervalMs >= 0)) return false
    try {
        const original = JSON.parse(log.message)
        if (JSON.stringify(original) !== log.message || !isDeepStrictEqual(original, row)) return false
    } catch { return false }
    return log.sourceEventId === createHash('sha256').update(`${log.host}:docker:${metadata.container_id}:${log.timestamp}:${log.message}`).digest('hex')
}

export function validCdnRefreshParameters(value: unknown): value is typeof cdnRefreshDefinition.parameters {
    return exact(value, ['maxDurationMs', 'minIntervalMs', 'maxIntervalMs'])
        && Object.values(value).every(number => typeof number === 'number' && Number.isSafeInteger(number) && number >= 1)
        && Number(value.maxDurationMs) <= 60000 && Number(value.minIntervalMs) <= 3600000 && Number(value.maxIntervalMs) <= 3600000
        && Number(value.minIntervalMs) <= Number(value.maxIntervalMs)
}
export function eligibleCdnRefresh(log: CdnRefreshLog, parameters: unknown): boolean {
    if (!validCdnRefreshParameters(parameters) || !verifyCdnRefreshEvidence(log)) return false
    const proof = (log.metadata!.structured as Record<string, unknown>).refresh as Record<string, unknown>
    return typeof proof.intervalMs === 'number' && Number(proof.durationMs) <= parameters.maxDurationMs
        && proof.intervalMs >= parameters.minIntervalMs && proof.intervalMs <= parameters.maxIntervalMs
}
