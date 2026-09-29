import { beforeEach, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
let row: any, readOnly = false
const queries: Array<{ sql: string, values?: unknown[] }> = []
const token = randomUUID()
mock.module('#db', () => ({ default: async (sql: string, values?: unknown[]) => {
    queries.push({ sql, values })
    if (sql.includes('UPDATE tokens')) return { rows: [{ timestamp: new Date().toISOString() }] }
    return { rows: row ? [{ ...row }] : [] }
} }))
mock.module('../src/utils/recovery.ts', () => ({ recoveryReadOnly: () => readOnly }))
const { validateSession } = await import('../src/utils/auth/session.ts')
beforeEach(() => {
    queries.length = 0; readOnly = false
    row = { token_id: 1, id: 'member', token, user_agent: '', timestamp: new Date(Date.now() - 10000).toISOString(), session_user: { id: 'member', active: true }, session_roles: [{ id: 'system_admin' }] }
})
test('parallel fresh requests still validate access without repeating timestamp writes', async () => {
    const result = await Promise.all(Array.from({ length: 10 }, () => validateSession({ id: 'member', token })))
    expect(result.every(Boolean)).toBe(true)
    expect(queries).toHaveLength(10)
    expect(queries.every(({ sql }) => sql.includes('t.revoked_at IS NULL') && sql.includes('u.active IS TRUE'))).toBe(true)
    expect(result[0]!.refreshed.expires_at).toBe(new Date(Date.parse(row.timestamp) + 86400000).toISOString())
    row.session_roles = []
    expect((await validateSession({ id: 'member', token }))!.roles).toEqual([])
    row = undefined
    expect(await validateSession({ id: 'member', token })).toBeNull()
})
test('organization membership is checked by the session query', async () => {
    row.organization_member = true
    const member = await validateSession({ id: 'member', token, organizationSlug: 'hanasand' })
    expect(member?.organizationMember).toBe(true)
    expect(queries).toHaveLength(1)
    expect(queries[0].sql).toContain('EXISTS (')
    expect(queries[0].values).toEqual(['member', token, 'hanasand'])

    queries.length = 0
    row.organization_member = false
    expect((await validateSession({ id: 'member', token, organizationSlug: 'hanasand' }))?.organizationMember).toBe(false)
    expect(queries).toHaveLength(1)
})
test('older active sessions refresh with an atomic age guard; expired and read-only sessions never write', async () => {
    row.timestamp = new Date(Date.now() - 60000).toISOString()
    const result = await validateSession({ id: 'member', token })
    expect(queries[1].sql).toContain('timestamp <= NOW() - INTERVAL \'30 seconds\'')
    expect(Date.parse(result!.refreshed.expires_at)).toBeGreaterThan(Date.now() + 86399000)
    queries.length = 0; readOnly = true
    await validateSession({ id: 'member', token })
    expect(queries).toHaveLength(1)
    queries.length = 0; row.timestamp = new Date(Date.now() - 90000000).toISOString()
    expect(await validateSession({ id: 'member', token })).toBeNull()
    expect(queries).toHaveLength(1)
})
