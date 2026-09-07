import assert from 'node:assert/strict'
import { mock, setSystemTime } from 'bun:test'

const now = Date.now()
const check = { service: 'core', check_name: 'API health', status: 'up', latency_ms: 12, message: null, checked_at: new Date(now).toISOString(), uptime_30d: '100' }
const snapshot = { overall: 'up', generated_at: check.checked_at, checks: [check], history: [{ service: 'core', check_name: 'API health', date: check.checked_at.slice(0, 10), status: 'up', incident_ids: [] }], incidents: [] }
let fail = false
const run = async (sql: string) => {
    if (sql.startsWith('CREATE TABLE')) return { rows: [] }
    if (sql.startsWith('SELECT payload')) return { rows: [{ payload: snapshot, updated_at: new Date(now) }] }
    if (fail) throw new Error('database unavailable')
    return { rows: [check] }
}
mock.module('../src/utils/db.ts', () => ({ default: run, withTransaction: () => { throw new Error('Fresh persisted history must not be rebuilt') } }))
const { default: handler } = await import('../src/handlers/status/get.ts')
const reply = { header() { return this }, send(value: any) { return value } }
setSystemTime(now)
await handler({ query: {} } as any, reply as any)
await new Promise(resolve => setTimeout(resolve, 0))
const first = await handler({ query: {} } as any, reply as any)
assert.equal(first.history_available, true)
assert.equal(first.checks.length, 1)
assert.equal(first.history.length, 1)
fail = true
setSystemTime(now + 16_000)
const failed = await handler({ query: {} } as any, reply as any)
assert.equal(failed.monitoring, 'unavailable')
assert.equal(failed.generated_at, first.generated_at)
assert.equal(failed.checks[0].checked_at, first.checks[0].checked_at)
assert.equal(failed.history.length, 1)
setSystemTime()
console.log('Status loader preserves persisted evidence through database failure.')
