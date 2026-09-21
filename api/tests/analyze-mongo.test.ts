import { expect, test } from 'bun:test'
import { eligibleMongoPing, mongoCommandFromLog, mongoReconDefinition } from '../src/utils/mill/analyzeMongo.ts'
import { normalizeLogEvent } from '../src/utils/mill/logEvent.ts'

const log = { host: 'inspur/cashflow', service: 'mongodb', level: 'info', sourceEventId: 'mongo:123' }
const event = { t: { $date: '2026-09-21T14:00:00Z' }, s: 'I', c: 'COMMAND', id: 51803, ctx: 'conn123', msg: 'Slow query', attr: { type: 'command', command: { ping: 1, $db: 'admin' }, remote: '127.0.0.1:55250', durationMillis: 0, reslen: 17 } }
const make = (change = {}, envelope = {}) => ({ ...log, message: JSON.stringify({ ...event, ...change }), ...envelope })
const match = (change = {}, envelope = {}) => eligibleMongoPing(make(change, envelope))

test('only completed successful ping-only commands can drop; retain client metadata', () => {
    expect(match()).toEqual({ ip: '127.0.0.1', database: 'admin', timestamp: event.t.$date })
    expect(match({ id: 22943, c: 'NETWORK', msg: 'Connection accepted' })).toBeNull()
    expect(match({ id: 22944, c: 'NETWORK', msg: 'Connection ended' })).toBeNull()
    expect(match({ id: 51800, c: 'NETWORK', msg: 'client metadata' })).toBeNull()
    for (const name of ['listDatabases', 'listCollections', 'find', 'aggregate', 'usersInfo', 'rolesInfo', 'hello']) {
        const next = make({ attr: { ...event.attr, command: { [name]: 1, $db: 'admin' } } })
        expect(eligibleMongoPing(next)).toBeNull()
        expect(mongoCommandFromLog(next)?.name).toBe(name)
    }
    expect(match({ attr: { ...event.attr, command: { ping: 1, listDatabases: 1, $db: 'admin' } } })).toBeNull()
})
test('failure, missing completion evidence and malformed or foreign data always retain', () => {
    for (const s of ['W', 'E', 'F', 'D1']) expect(match({ s })).toBeNull()
    for (const level of ['warn', 'error', 'fatal', 'debug']) expect(match({}, { level })).toBeNull()
    for (const attr of [{ errCode: 13 }, { errName: 'Unauthorized' }, { ok: 0 }, { reslen: undefined }, { durationMillis: undefined }, { durationMillis: -1 }, { remote: 'unknown' }]) expect(match({ attr: { ...event.attr, ...attr } })).toBeNull()
    for (const metadata of [{ error: 'failure' }, { status: 'timeout' }, { organizationId: 'tenant' }, { tenantId: 'tenant' }]) expect(match({}, { metadata })).toBeNull()
    for (const envelope of [{ host: 'other' }, { service: 'other' }, { sourceEventId: undefined }, { message: 'invalid' }, { message: 'null' }]) expect(match({}, envelope)).toBeNull()
    expect(match({ t: {} })).toBeNull()
    expect(match({ truncated: {} })).toBeNull()
})
test('ping metadata is narrowly validated and enumeration is normalized for rule matching', () => {
    const command = { ...event.attr.command, lsid: { id: { $uuid: '12345678-1234-1234-1234-123456789abc' } }, comment: 'safe-test' }
    expect(match({ attr: { ...event.attr, command } })).not.toBeNull()
    for (const extra of [{ comment: { listDatabases: 1 } }, { comment: '<script>' }, { lsid: { ping: 1 } }, { unknown: true }]) expect(match({ attr: { ...event.attr, command: { ...command, ...extra } } })).toBeNull()
    const normalized = normalizeLogEvent({ ...make({ attr: { ...event.attr, command: { listDatabases: 1, nameOnly: true, $db: 'admin' } } }), id: 123, created_at: event.t.$date })
    expect(normalized.event_type).toBe('database')
    expect(normalized.action).toBe('listDatabases')
    expect(normalized.outcome).toBe('success')
    expect(normalized.mongo).toMatchObject({ database: 'admin', connection: 'conn123', clientIp: '127.0.0.1' })
    expect(new RegExp(mongoReconDefinition.conditions[1].value).test(normalized.action)).toBe(true)
})
