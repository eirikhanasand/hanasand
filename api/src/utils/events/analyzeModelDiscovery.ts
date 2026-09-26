import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { STATUS_CODES } from 'node:http'

export const modelDiscoveryRuleId = 'model.verified_discovery_probes.v1'
export const modelDiscoveryAvailable = false
export const modelDiscoveryConfigured = () => /^[a-f0-9]{64}$/.test(process.env.MODEL_PROBE_PROOF_KEY || '')
export const modelDiscoveryUnavailableReason = 'Model probe verification is not configured. Unverified model requests are stored.'
export const modelDiscoveryRule = {
    id: modelDiscoveryRuleId, version: '1', name: 'Verified model discovery probes', family: 'HTTP', severity: 'low', enabled: false,
    explanation: 'Retain signed originals separately for native model discovery probes matching this rule’s saved request and timing criteria.',
    evidence: ['collector identity', 'signed caller completion', 'server listener identity', 'request inspection', 'duration', 'response status'],
}
const equals = (path: string, value: string) => ({ path, operator: 'equals' as const, value, caseSensitive: true })
export const modelDiscoveryDefinition = {
    match: 'all' as const, stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep',
    conditions: [{ path: 'message', operator: 'regex' as const, caseSensitive: true,
        value: '^\\(APIServer pid=[1-9]\\d*\\) INFO: +[^ ]+ - "GET /v1/models\\?hanasand_probe=[a-f0-9-]{36} HTTP/1\\.1" 200 OK$' },
    equals('host', 'inspur'), equals('service', 'run_model_inspur_vllm_gpu.sh'), equals('level', 'info'),
    equals('metadata.unit', 'hanasand-model.service'), equals('metadata.user.id', '1000'),
    equals('metadata.model_probe.caller', 'hanasand-ai-model-client'), equals('metadata.model_probe.clientIp', '127.0.0.1'),
    equals('metadata.model_probe.serverIp', '127.0.0.1'), equals('metadata.model_probe.method', 'GET'),
    equals('metadata.model_probe.status', '200'), equals('metadata.model_probe.model', 'hanasand'),
    equals('metadata.model_probe.responseRoot', 'Qwen/Qwen2.5-Coder-7B-Instruct'),
    { path: 'metadata.model_probe.serverPort', operator: 'regex' as const, caseSensitive: true, value: '^1808[1-8]$' },
    { path: 'metadata.model_probe.path', operator: 'regex' as const, caseSensitive: true, value: '^/v1/models\\?hanasand_probe=[a-f0-9-]{36}$' }],
    parameters: { maxDurationMs: 1000, minIntervalMs: 5000, maxIntervalMs: 40000 },
}
type Row = Record<string, unknown>
export const exactModelFields = (value: unknown, keys: string[]): value is Row => Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)))
export type ModelProbeLog = { service: string, host?: string, level: string, message: string, metadata?: Row, sourceEventId?: string, timestamp?: string }
export const modelProofFields = ['version', 'nonce', 'host', 'caller', 'method', 'path', 'clientIp', 'clientPort', 'serverIp', 'serverPort',
    'serverPid', 'logSha256', 'startedAt', 'finishedAt', 'previousStartedAt', 'status', 'bodyEmpty', 'responseSha256', 'model', 'responseRoot']
export function modelProofPayload(proof: Row): string {
    const headers = proof.headers as Row | undefined
    return JSON.stringify([...modelProofFields.map(key => proof[key]), headers?.host, headers?.accept, headers?.connection])
}
export function modelProofMac(proof: Row, key: string): string {
    return createHmac('sha256', Buffer.from(key, 'hex')).update(modelProofPayload(proof)).digest('hex')
}
export function validModelProofMac(proof: Row, key: string): boolean {
    return /^[a-f0-9]{64}$/.test(key) && typeof proof.mac === 'string' && /^[a-f0-9]{64}$/.test(proof.mac)
        && timingSafeEqual(Buffer.from(proof.mac, 'hex'), Buffer.from(modelProofMac(proof, key), 'hex'))
}
export function modelLogDigest(log: ModelProbeLog, cursor: string): string {
    const meta = log.metadata || {}, user = meta.user as Row | undefined
    return createHash('sha256').update(JSON.stringify([log.service, log.host, log.level, log.message, log.sourceEventId, log.timestamp,
        meta.collector, meta.pid, user?.id, meta.unit, cursor])).digest('hex')
}
// This authenticates observations only. It does not decide which traffic a rule keeps.
export function verifyModelDiscoveryEvidence(log: ModelProbeLog, key = process.env.MODEL_PROBE_PROOF_KEY || ''): boolean {
    if (!exactModelFields(log, ['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'])
        || ![log.host, log.service, log.level].every(value => typeof value === 'string' && value.length > 0)
        || typeof log.message !== 'string' || !log.timestamp || !Number.isFinite(Date.parse(log.timestamp))) return false
    const meta = log.metadata
    if (!exactModelFields(meta, ['collector', 'pid', 'user', 'unit', 'cursor', 'model_probe']) || meta.collector !== 'journal'
        || typeof meta.unit !== 'string' || !exactModelFields(meta.user, ['id']) || typeof meta.user.id !== 'string'
        || typeof meta.cursor !== 'string' || !/^s=[0-9a-f]{32};i=[0-9a-f]+;b=[0-9a-f]{32};m=[0-9a-f]+;t=[0-9a-f]+;x=[0-9a-f]+$/.test(meta.cursor)) return false
    const proof = meta.model_probe
    if (!exactModelFields(proof, [...modelProofFields, 'headers', 'mac']) || !exactModelFields(proof.headers, ['host', 'accept', 'connection'])
        || !validModelProofMac(proof, key)) return false
    const match = /^\(APIServer pid=([1-9]\d*)\) INFO: +([0-9.]+):([1-9]\d*) - "([A-Z]+) (\S+) HTTP\/1\.1" ([1-5]\d\d) ([A-Za-z ]+)$/.exec(log.message)
    if (!match || match[7] !== STATUS_CODES[Number(match[6])] || meta.pid !== match[1] || proof.serverPid !== match[1] || Number(match[3]) > 65535
        || proof.version !== 1 || typeof proof.nonce !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(proof.nonce)
        || proof.path !== match[5] || proof.clientPort !== Number(match[3]) || proof.clientIp !== match[2] || proof.host !== log.host
        || proof.method !== match[4] || proof.status !== Number(match[6])
        || ![proof.caller, proof.model, proof.responseRoot, proof.serverIp].every(value => typeof value === 'string' && value.length > 0)
        || typeof proof.serverPort !== 'number' || !Number.isInteger(proof.serverPort) || proof.serverPort < 1 || proof.serverPort > 65535
        || proof.headers.host !== `${proof.serverIp}:${proof.serverPort}` || proof.headers.accept !== 'application/json' || proof.headers.connection !== 'close'
        || proof.bodyEmpty !== true || typeof proof.responseSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(proof.responseSha256)
        || ![proof.startedAt, proof.finishedAt].every(value => typeof value === 'number' && Number.isSafeInteger(value))
        || !(proof.previousStartedAt === null || typeof proof.previousStartedAt === 'number' && Number.isSafeInteger(proof.previousStartedAt))) return false
    let request: URL
    try { request = new URL(proof.path as string, 'http://probe.local') } catch { return false }
    if (request.searchParams.getAll('hanasand_probe').length !== 1 || request.searchParams.get('hanasand_probe') !== proof.nonce) return false
    const start = proof.startedAt as number, finish = proof.finishedAt as number
    if (finish < start || proof.previousStartedAt !== null && (proof.previousStartedAt as number) > start
        || Date.parse(log.timestamp) < start || Date.parse(log.timestamp) > finish + 1000
        || proof.logSha256 !== modelLogDigest(log, meta.cursor)) return false
    return log.sourceEventId === createHash('sha256').update(`${log.host}:journal:${meta.cursor}`).digest('hex')
}
export function validModelDiscoveryParameters(value: unknown): value is typeof modelDiscoveryDefinition.parameters {
    return exactModelFields(value, ['maxDurationMs', 'minIntervalMs', 'maxIntervalMs'])
        && Object.values(value).every(number => typeof number === 'number' && Number.isSafeInteger(number) && number >= 1)
        && Number(value.maxDurationMs) <= 60000 && Number(value.minIntervalMs) <= 3600000 && Number(value.maxIntervalMs) <= 3600000
        && Number(value.minIntervalMs) <= Number(value.maxIntervalMs)
}
export function eligibleModelDiscovery(log: ModelProbeLog, parameters: unknown, key = process.env.MODEL_PROBE_PROOF_KEY || ''): boolean {
    if (!validModelDiscoveryParameters(parameters) || !verifyModelDiscoveryEvidence(log, key)) return false
    const proof = log.metadata!.model_probe as Row
    if (typeof proof.previousStartedAt !== 'number') return false
    const duration = Number(proof.finishedAt) - Number(proof.startedAt), interval = Number(proof.startedAt) - proof.previousStartedAt
    return duration <= parameters.maxDurationMs && interval >= parameters.minIntervalMs && interval <= parameters.maxIntervalMs
}
