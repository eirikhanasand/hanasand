import { beforeEach, expect, mock, test } from 'bun:test'

let queries = 0
let allowed = false
mock.module('../src/utils/loadSQL.ts', () => ({ loadSQL: async () => 'role query' }))
mock.module('../src/utils/db.ts', () => ({ default: async () => { queries++; return { rows: [{ has_role: allowed }] } } }))
const { default: hasRole } = await import('../src/utils/auth/hasRole.ts')
const reply = { log: { error() {} } } as any
beforeEach(() => { queries = 0; allowed = false })
const request = () => ({ headers: { id: 'actor' }, rateLimitSession: { user: { id: 'actor' }, roles: [{ id: 'system_admin' }] } })

test('uses only current-request roles for the same verified identity', async () => {
    expect(await hasRole(request() as any, reply, 'system_admin')).toEqual({ valid: true })
    expect((await hasRole(request() as any, reply, 'user_admin')).valid).toBe(false)
    expect(queries).toBe(0)
    const revoked = request()
    revoked.rateLimitSession.roles = []
    expect((await hasRole(revoked as any, reply, 'system_admin')).valid).toBe(false)
    expect(queries).toBe(0)
})
test('impersonation checks the effective user, never actor privileges', async () => {
    const impersonated = request()
    impersonated.headers.id = 'target'
    expect((await hasRole(impersonated as any, reply, 'system_admin')).valid).toBe(false)
    expect(queries).toBe(1)
})
test('API key owners and requests without a checked session still query current roles', async () => {
    allowed = true
    expect((await hasRole({ ...request(), apiKeyAuth: { ownerId: 'key-owner' } } as any, reply, 'system_admin')).valid).toBe(true)
    expect((await hasRole({ headers: { id: 'actor' } } as any, reply, 'system_admin')).valid).toBe(true)
    expect(queries).toBe(2)
})
