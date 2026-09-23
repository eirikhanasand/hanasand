import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { eligibleModelDiscovery, modelDiscoveryAvailable, modelDiscoveryDefinition, modelDiscoveryRule, type VerifiedModelProbe } from '../src/utils/mill/analyzeModelDiscovery.ts'
function fixture() {
    const timestamp = '2026-09-24T00:00:00.000Z'
    const cursor = `s=${'a'.repeat(32)};i=123;b=${'b'.repeat(32)};m=abc;t=def;x=abc`
    const log = { service: 'run_model_inspur_vllm_gpu.sh', host: 'inspur', level: 'info', timestamp,
        sourceEventId: createHash('sha256').update(`inspur:journal:${cursor}`).digest('hex'),
        message: '(APIServer pid=123) INFO:     127.0.0.1:43210 - "GET /v1/models HTTP/1.1" 200 OK',
        metadata: { collector: 'journal', pid: '123', user: { id: '1000' }, unit: 'hanasand-model.service', cursor } }
    const proof: VerifiedModelProbe = { sourceEventId: log.sourceEventId, host: 'inspur', unit: 'hanasand-model.service', processId: '123',
        clientIp: '127.0.0.1', clientPort: 43210, method: 'GET', path: '/v1/models', status: 200, bodyEmpty: true, headersSafe: true,
        probeIdentity: 'hanasand-ai-model-client', startedAt: Date.parse(timestamp) - 20, finishedAt: Date.parse(timestamp) }
    return { log, proof }
}
test('unavailable rule stays disabled and Keep; existing model logs cannot match without independent proof', () => {
    expect(modelDiscoveryAvailable).toBe(false)
    expect(modelDiscoveryRule.enabled).toBe(false)
    expect(modelDiscoveryDefinition.action).toBe('keep')
    expect(eligibleModelDiscovery(fixture().log)).toBe(false)
    const { log, proof } = fixture()
    expect(eligibleModelDiscovery(log, proof)).toBe(true)
    expect(eligibleModelDiscovery({ ...log, metadata: { ...log.metadata, probe: proof } })).toBe(false)
})
test('body/header attacks, unfamiliar identities, errors, inference and slow calls stay', () => {
    const { log, proof } = fixture()
    for (const change of [{ bodyEmpty: false }, { headersSafe: false }, { probeIdentity: 'other' }, { clientIp: '192.0.2.1' },
        { path: '/v1/models?x=${jndi:ldap://evil}' }, { path: '/v1/chat/completions' }, { method: 'POST' }, { status: 500 },
        { startedAt: proof.finishedAt - 1001 }, { processId: '321' }, { sourceEventId: 'forged' }, { clientPort: 123 }, { host: 'other' },
        { finishedAt: NaN }, { startedAt: proof.finishedAt + 1 }]) expect(eligibleModelDiscovery(log, { ...proof, ...change })).toBe(false)
})
test('unknown metadata, duplicate content, forged identity and missing context stay', () => {
    const { log, proof } = fixture()
    for (const target of ['log', 'metadata', 'user', 'proof']) {
        const sample = fixture()
        const objects: Record<string, object> = { log: sample.log, metadata: sample.log.metadata, user: sample.log.metadata.user, proof: sample.proof }
        Object.assign(objects[target], { injected: 'suspicious' })
        expect(eligibleModelDiscovery(sample.log, sample.proof)).toBe(false)
    }
    for (const change of [{ message: log.message + '\nmalicious payload' }, { sourceEventId: 'a'.repeat(64) }, { timestamp: 'bad' }, { level: 'error' }]) {
        expect(eligibleModelDiscovery({ ...log, ...change }, proof)).toBe(false)
    }
    for (const key of Object.keys(proof)) {
        const changed = { ...proof }; delete (changed as any)[key]
        expect(eligibleModelDiscovery(log, changed)).toBe(false)
    }
})
