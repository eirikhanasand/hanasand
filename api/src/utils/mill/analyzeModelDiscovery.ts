import { createHash } from 'node:crypto'

export const modelDiscoveryRuleId = 'model.verified_discovery_probes.v1'
// Existing vLLM access records omit request headers/body, elapsed time and probe
// identity. Keep the rule unavailable until independent boundary proof exists.
export const modelDiscoveryAvailable = false
export const modelDiscoveryUnavailableReason = 'Model access logs do not yet provide independently verified probe identity and request inspection. This rule cannot be enabled until that evidence is collected.'
export const modelDiscoveryRule = {
    id: modelDiscoveryRuleId, version: '1', name: 'Verified model discovery probes', family: 'HTTP', severity: 'low', enabled: false,
    explanation: modelDiscoveryUnavailableReason,
    evidence: ['collector identity', 'independent probe receipt', 'request inspection', 'duration', 'response status'],
}
export const modelDiscoveryDefinition = { match: 'all' as const, conditions: [], stage: 'analyze' as const, action: 'keep' as 'drop' | 'keep', parameters: {} }
type Row = Record<string, unknown>
const exact = (value: unknown, keys: string[]): value is Row => Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)))
export type ModelProbeLog = { service: string, host?: string, level: string, message: string, metadata?: Row, sourceEventId?: string, timestamp?: string }
// This parameter must come from an independently verified boundary observation,
// never from fields supplied in the access log or by an ingestion caller.
export type VerifiedModelProbe = {
    sourceEventId: string, host: string, unit: string, processId: string, clientIp: string, clientPort: number,
    method: string, path: string, status: number, bodyEmpty: boolean, headersSafe: boolean,
    probeIdentity: string, startedAt: number, finishedAt: number,
}
export function eligibleModelDiscovery(log: ModelProbeLog, verified?: VerifiedModelProbe): boolean {
    if (!verified || !exact(verified, ['sourceEventId', 'host', 'unit', 'processId', 'clientIp', 'clientPort', 'method', 'path', 'status', 'bodyEmpty',
        'headersSafe', 'probeIdentity', 'startedAt', 'finishedAt']) || !exact(log, ['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'])
        || log.host !== 'inspur' || log.service !== 'run_model_inspur_vllm_gpu.sh' || log.level !== 'info'
        || typeof log.message !== 'string' || !log.timestamp || !Number.isFinite(Date.parse(log.timestamp))) return false
    const metadata = log.metadata
    if (!exact(metadata, ['collector', 'pid', 'user', 'unit', 'cursor']) || metadata.collector !== 'journal'
        || metadata.unit !== 'hanasand-model.service' || !exact(metadata.user, ['id']) || metadata.user.id !== '1000'
        || typeof metadata.cursor !== 'string' || !/^s=[0-9a-f]{32};i=[0-9a-f]+;b=[0-9a-f]{32};m=[0-9a-f]+;t=[0-9a-f]+;x=[0-9a-f]+$/.test(metadata.cursor)) return false
    const match = /^\(APIServer pid=([1-9]\d*)\) INFO: +127\.0\.0\.1:([1-9]\d*) - "GET \/v1\/models HTTP\/1\.1" 200 OK$/.exec(log.message)
    if (!match || metadata.pid !== match[1] || verified.processId !== match[1] || Number(match[2]) > 65535
        || verified.clientPort !== Number(match[2]) || verified.clientIp !== '127.0.0.1' || verified.host !== log.host
        || verified.unit !== metadata.unit || verified.sourceEventId !== log.sourceEventId
        || verified.method !== 'GET' || verified.path !== '/v1/models' || verified.status !== 200
        || verified.bodyEmpty !== true || verified.headersSafe !== true || verified.probeIdentity !== 'hanasand-ai-model-client'
        || !Number.isSafeInteger(verified.startedAt) || !Number.isSafeInteger(verified.finishedAt)
        || verified.finishedAt < verified.startedAt || verified.finishedAt - verified.startedAt > 1000
        || Date.parse(log.timestamp) < verified.startedAt || Date.parse(log.timestamp) > verified.finishedAt + 1000) return false
    return log.sourceEventId === createHash('sha256').update(`${log.host}:journal:${metadata.cursor}`).digest('hex')
}
