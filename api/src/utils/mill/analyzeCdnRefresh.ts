import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

export const cdnRefreshRuleId = 'cdn.successful_cache_refresh.v1'
export const cdnRefreshRule = {
    id: cdnRefreshRuleId, version: '1', name: 'Successful CDN cache refreshes', family: 'System', severity: 'low', enabled: false,
    explanation: 'Count verified successful hot-cache refresh completions from the CDN. Require an exact completion envelope, normal duration and normal cadence. Keep legacy messages, errors, slow or unusually frequent refreshes and all unexpected fields.',
    evidence: ['host', 'container', 'completion status', 'duration', 'refresh interval'],
}
export const cdnRefreshDefinition = { match: 'all' as const, conditions: [], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: {} }
export type CdnRefreshLog = { service: string, host?: string, level: string, message: string, metadata?: Record<string, unknown>, sourceEventId?: string, timestamp?: string }
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)))

export function eligibleCdnRefresh(log: CdnRefreshLog): boolean {
    if (!exact(log, ['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'])
        || log.service !== 'cdn' || !['inspur', 'ovhcloud'].includes(log.host || '') || log.level !== 'info'
        || typeof log.message !== 'string' || !log.timestamp || !Number.isFinite(Date.parse(log.timestamp))) return false
    const metadata = log.metadata
    if (!exact(metadata, ['collector', 'container_id', 'stream', 'structured']) || metadata.collector !== 'docker' || metadata.stream !== 'stdout'
        || typeof metadata.container_id !== 'string' || !/^[a-f0-9]{12,64}$/.test(metadata.container_id)) return false
    const row = metadata.structured
    if (!exact(row, ['level', 'time', 'pid', 'hostname', 'refresh', 'msg']) || row.level !== 30 || row.msg !== 'Hot cached queries refreshed'
        || !Number.isSafeInteger(row.pid) || Number(row.pid) < 1 || !Number.isSafeInteger(row.time)
        || typeof row.hostname !== 'string' || !/^[a-zA-Z0-9._-]{1,253}$/.test(row.hostname)
        || Math.abs(Date.parse(log.timestamp) - Number(row.time)) > 1000) return false
    const proof = row.refresh
    if (!exact(proof, ['version', 'status', 'durationMs', 'intervalMs']) || proof.version !== 1 || proof.status !== 200
        || typeof proof.durationMs !== 'number' || !Number.isFinite(proof.durationMs) || proof.durationMs < 0 || proof.durationMs > 1000
        || typeof proof.intervalMs !== 'number' || !Number.isFinite(proof.intervalMs) || proof.intervalMs < 5000 || proof.intervalMs > 10000) return false
    try {
        const original = JSON.parse(log.message)
        if (JSON.stringify(original) !== log.message || !isDeepStrictEqual(original, row)) return false
    } catch { return false }
    return log.sourceEventId === createHash('sha256').update(`${log.host}:docker:${metadata.container_id}:${log.timestamp}:${log.message}`).digest('hex')
}
