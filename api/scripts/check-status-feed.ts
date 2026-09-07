import assert from 'node:assert/strict'
import { mock, setSystemTime } from 'bun:test'

const now = Date.now()
const check = { service: 'core', check_name: 'API health', status: 'up', latency_ms: 12, message: null, checked_at: new Date(now).toISOString(), uptime_30d: '100' }
const snapshot = { overall: 'up', generated_at: check.checked_at, checks: [check], history: [{ service: 'core', check_name: 'API health', date: check.checked_at.slice(0, 10), status: 'up', incident_ids: [] }], incidents: [] }
let fail = false
let persisted = false
let releaseHistory!: () => void
const blockedHistory = new Promise<void>(resolve => { releaseHistory = resolve })
const run = async (sql: string) => {
    if (sql.startsWith('CREATE TABLE')) return { rows: [] }
    if (sql.startsWith('SELECT payload')) return { rows: persisted ? [{ payload: snapshot, updated_at: new Date(now) }] : [] }
    if (sql.includes('90 days')) await blockedHistory
    if (fail) throw new Error('database unavailable')
    return { rows: [check] }
}
mock.module('../src/utils/db.ts', () => ({ default: run, withTransaction: async () => { await blockedHistory } }))
const target = process.env.STATUS_HANDLER_FILE || '../src/handlers/status/get.ts'
const { default: cold } = await import(target + '?cold')
const reply = { header() { return this }, send(value: any) { return value } }
setSystemTime(now)
const first = await Promise.race([
    cold({ query: {} } as any, reply as any),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Current checks waited for blocked history')), 500)),
])
assert.equal(first.checks.length, 1)
assert.equal(first.checks[0].checked_at, check.checked_at)
assert.equal(first.history_available, false)
releaseHistory()
// Simulate a process restart: only the durable snapshot is available.
persisted = true
const { default: restarted } = await import(target + '?restart')
await restarted({ query: {} } as any, reply as any)
await new Promise(resolve => setTimeout(resolve, 0))
const restored = await restarted({ query: {} } as any, reply as any)
assert.equal(restored.history_available, true)
assert.equal(restored.history.length, 1)
fail = true
setSystemTime(now + 16_000)
const failed = await restarted({ query: {} } as any, reply as any)
assert.equal(failed.monitoring, 'unavailable')
assert.equal(failed.generated_at, restored.generated_at)
assert.equal(failed.checks[0].checked_at, restored.checks[0].checked_at)
assert.deepEqual(failed.history, restored.history)
setSystemTime()
console.log('Current checks bypass blocked history; persisted evidence survives restart and database failure.')
