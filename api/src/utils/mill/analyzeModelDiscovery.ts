import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const modelDiscoveryRuleId = 'model.verified_discovery_probes.v1'
export const modelDiscoveryAvailable = false // Seeds stay disabled; configuration and explicit activation are required.
export const modelDiscoveryConfigured = () => /^[a-f0-9]{64}$/.test(process.env.MODEL_PROBE_PROOF_KEY || '')
export const modelDiscoveryUnavailableReason = 'Model probe verification is not configured. Unverified model requests are stored.'
export const modelDiscoveryRule = {
    id: modelDiscoveryRuleId, version: '1', name: 'Verified model discovery probes', family: 'HTTP', severity: 'low', enabled: false,
    explanation: 'Retain signed originals separately for successful, bounded native model discovery probes verified against the server process.',
    evidence: ['collector identity', 'signed caller completion', 'server listener identity', 'request inspection', 'duration', 'response status'],
}
export const modelDiscoveryDefinition = { match: 'all' as const, conditions: [], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: {} }
type Row = Record<string, unknown>
export const exactModelFields = (value: unknown, keys: string[]): value is Row => Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)))
export type ModelProbeLog = { service: string, host?: string, level: string, message: string, metadata?: Row, sourceEventId?: string, timestamp?: string }
export const modelProofFields = ['version', 'nonce', 'host', 'caller', 'method', 'path', 'clientIp', 'clientPort', 'serverIp', 'serverPort',
    'serverPid', 'logSha256', 'startedAt', 'finishedAt', 'previousStartedAt', 'status', 'bodyEmpty', 'responseSha256', 'model']
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
export function eligibleModelDiscovery(log: ModelProbeLog, key = process.env.MODEL_PROBE_PROOF_KEY || ''): boolean {
    if (!exactModelFields(log, ['service', 'host', 'level', 'message', 'metadata', 'sourceEventId', 'timestamp'])
        || log.host !== 'inspur' || log.service !== 'run_model_inspur_vllm_gpu.sh' || log.level !== 'info'
        || typeof log.message !== 'string' || !log.timestamp || !Number.isFinite(Date.parse(log.timestamp))) return false
    const meta = log.metadata
    if (!exactModelFields(meta, ['collector', 'pid', 'user', 'unit', 'cursor', 'model_probe']) || meta.collector !== 'journal'
        || meta.unit !== 'hanasand-model.service' || !exactModelFields(meta.user, ['id']) || meta.user.id !== '1000'
        || typeof meta.cursor !== 'string' || !/^s=[0-9a-f]{32};i=[0-9a-f]+;b=[0-9a-f]{32};m=[0-9a-f]+;t=[0-9a-f]+;x=[0-9a-f]+$/.test(meta.cursor)) return false
    const proof = meta.model_probe
    if (!exactModelFields(proof, [...modelProofFields, 'headers', 'mac']) || !exactModelFields(proof.headers, ['host', 'accept', 'connection'])
        || !validModelProofMac(proof, key)) return false
    const match = /^\(APIServer pid=([1-9]\d*)\) INFO: +127\.0\.0\.1:([1-9]\d*) - "GET (\/v1\/models\?hanasand_probe=([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})) HTTP\/1\.1" 200 OK$/.exec(log.message)
    if (!match || meta.pid !== match[1] || proof.serverPid !== match[1] || Number(match[2]) > 65535
        || proof.version !== 1 || proof.nonce !== match[4] || proof.path !== match[3] || proof.clientPort !== Number(match[2])
        || proof.clientIp !== '127.0.0.1' || proof.serverIp !== '127.0.0.1' || proof.host !== log.host
        || proof.caller !== 'hanasand-ai-model-client' || proof.method !== 'GET' || proof.model !== 'hanasand'
        || typeof proof.serverPort !== 'number' || !Number.isInteger(proof.serverPort) || proof.serverPort < 18081 || proof.serverPort > 18088
        || proof.headers.host !== `127.0.0.1:${proof.serverPort}` || proof.headers.accept !== 'application/json' || proof.headers.connection !== 'close'
        || proof.status !== 200 || proof.bodyEmpty !== true || typeof proof.responseSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(proof.responseSha256)
        || ![proof.startedAt, proof.finishedAt, proof.previousStartedAt].every(value => typeof value === 'number' && Number.isSafeInteger(value))) return false
    const start = proof.startedAt as number, finish = proof.finishedAt as number, previous = proof.previousStartedAt as number
    if (finish < start || finish - start > 1000 || start - previous < 5000 || start - previous > 40000
        || Date.parse(log.timestamp) < start || Date.parse(log.timestamp) > finish + 1000
        || proof.logSha256 !== modelLogDigest(log, meta.cursor)) return false
    return log.sourceEventId === createHash('sha256').update(`${log.host}:journal:${meta.cursor}`).digest('hex')
}
