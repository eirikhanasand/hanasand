import { beforeEach, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
let row: any, readOnly = false
const queries: string[] = []
const token = randomUUID()
mock.module('../src/utils/db.ts', () => ({ default: async (sql: string) => {
    queries.push(sql)
    if (sql.includes('UPDATE tokens')) return { rows: [{ timestamp: new Date().toISOString() }] }
    return { rows: row ? [{ ...row }] : [] }
} }))
mock.module('../src/utils/resilience.ts', () => ({ recoveryReadOnly: () => readOnly }))
const { validateSession } = await import('../src/utils/auth/session.ts')
beforeEach(() => {
    queries.length = 0; readOnly = false
    row = { token_id: 1, id: 'member', token, user_agent: '', timestamp: new Date(Date.now() - 10000).toISOString(), session_user: { id: 'member', active: true }, session_roles: [{ id: 'system_admin' }] }
})
test('parallel fresh requests still validate access without repeating timestamp writes', async () => {
    const result = await Promise.all(Array.from({ length: 10 }, () => validateSession({ id: 'member', token })))
    expect(result.every(Boolean)).toBe(true)
    expect(queries).toHaveLength(10)
    expect(queries.every(sql => sql.includes('t.revoked_at IS NULL') && sql.includes('u.active IS TRUE'))).toBe(true)
    expect(result[0]!.refreshed.expires_at).toBe(new Date(Date.parse(row.timestamp) + 86400000).toISOString())
    row.session_roles = []
    expect((await validateSession({ id: 'member', token }))!.roles).toEqual([])
    row = undefined
    expect(await validateSession({ id: 'member', token })).toBeNull()
})
test('older active sessions refresh with an atomic age guard; expired and read-only sessions never write', async () => {
    row.timestamp = new Date(Date.now() - 60000).toISOString()
    const result = await validateSession({ id: 'member', token })
    expect(queries[1]).toContain('timestamp <= NOW() - INTERVAL \'30 seconds\'')
    expect(Date.parse(result!.refreshed.expires_at)).toBeGreaterThan(Date.now() + 86399000)
    queries.length = 0; readOnly = true
    await validateSession({ id: 'member', token })
    expect(queries).toHaveLength(1)
    queries.length = 0; row.timestamp = new Date(Date.now() - 90000000).toISOString()
    expect(await validateSession({ id: 'member', token })).toBeNull()
    expect(queries).toHaveLength(1)
})
