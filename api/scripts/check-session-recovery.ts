import assert from 'node:assert/strict'
import { mock } from 'bun:test'
let replica = true
let writes = 0
const timestamp = new Date(Date.now() - 3600_000).toISOString()
mock.module('#db', () => ({ default: async (sql: string) => {
    if (sql.includes('FROM tokens')) return { rows: [{ token_id: 1, id: 'probe', token: 'test-token', user_agent: 'Browser', timestamp, database_read_only: replica }] }
    if (sql.includes('FROM users')) return { rows: [{ id: 'probe', active: true }] }
    if (sql.includes('FROM roles')) return { rows: [] }
    if (sql.includes('UPDATE tokens')) { writes++; return { rows: [] } }
    throw new Error('Unexpected query')
} }))
const { validateSession } = await import('../src/utils/auth/session.ts')
const recovered = await validateSession({ id: 'probe', token: 'test-token' })
assert(recovered)
assert.equal(writes, 0, 'Replica sessions must work before monitoring notices the switch')
assert.equal(Date.parse(recovered.refreshed.expires_at), Date.parse(timestamp) + 24 * 3600_000)
replica = false
assert(await validateSession({ id: 'probe', token: 'test-token' }))
assert.equal(writes, 1, 'Primary validation resumes normal session refresh')
console.log('Actual replica role preserves session validation and hard expiry before monitor convergence.')
