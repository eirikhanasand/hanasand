import { expect, test } from 'bun:test'
import { eligibleMongoConnection } from '../src/utils/mill/analyzeMongo.ts'

const log = { host: 'inspur/cashflow', service: 'mongodb', level: 'info', sourceEventId: 'mongo:123' }
const event = { s: 'I', c: 'NETWORK', id: 22943, msg: 'Connection accepted', attr: { remote: '127.0.0.1:55250', connectionId: 123, connectionCount: 7 } }
const match = (change = {}, envelope = {}) => eligibleMongoConnection({ ...log, message: JSON.stringify({ ...event, ...change }), ...envelope })

test('drops only the known informational local connection messages', () => {
    expect(match()).toBe(true)
    expect(match({ id: 22944, msg: 'Connection ended' })).toBe(true)
    expect(match({ id: 51800, msg: 'client metadata', attr: { remote: '[::1]:1234', doc: { application: { name: 'mongosh 2.8.1' }, driver: { name: 'nodejs|mongosh' } } } })).toBe(true)
})
test('retains errors, failures and authentication events even with an info envelope', () => {
    for (const s of ['W', 'E', 'F', 'D']) expect(match({ s })).toBe(false)
    for (const level of ['warn', 'error', 'fatal', 'debug']) expect(match({}, { level })).toBe(false)
    for (const attr of [{ error: 'failed' }, { ok: 0 }, { nested: { success: false } }, { status: 'timeout' }]) {
        expect(match({ attr: { ...event.attr, ...attr } })).toBe(false)
        expect(match({}, { metadata: attr })).toBe(false)
    }
    expect(match({ c: 'ACCESS', id: 10483900, msg: 'Connection not authenticating' })).toBe(false)
    expect(match({ c: 'ACCESS', msg: 'Authentication failed' })).toBe(false)
})
test('retains other hosts, services, tenants, clients, malformed and unknown events', () => {
    for (const envelope of [{ host: 'inspur' }, { service: 'speedrun-mongo' }, { sourceEventId: undefined }, { metadata: { organizationId: 'customer' } }, { metadata: { tenantId: 'customer' } }, { message: 'not json' }, { message: 'null' }]) expect(match({}, envelope)).toBe(false)
    for (const remote of ['10.0.0.1:123', '127.0.0.1.attacker:123', undefined]) expect(match({ attr: { ...event.attr, remote } })).toBe(false)
    expect(match({ id: 6788700, msg: 'Received first command on ingress connection since session start or auth handshake' })).toBe(false)
    expect(match({ id: 22430, msg: 'WiredTiger message' })).toBe(false)
    expect(match({ msg: 'Connection failed' })).toBe(false)
    expect(match({ id: 51800, msg: 'client metadata' })).toBe(false)
    expect(match({ attr: { ...event.attr, unknown: true } })).toBe(false)
})
