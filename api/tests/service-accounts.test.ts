import { beforeEach, expect, mock, test } from 'bun:test'
let authenticated = true
let administrator = true
let writes: string[] = []
const query = async (sql: string) => { writes.push(sql); return { rows: [{ id: 'svc_fixture' }] } }
mock.module('#db', () => ({ default: query, withTransaction: async (work: any) => work(query) }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authenticated, id: 'actor' }) }))
mock.module('#utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: administrator }) }))
mock.module('#utils/auth/apiKeys.ts', () => ({ createApiKey: async (input: any) => ({ apiKey: { ownerId: input.ownerId, scopes: input.scopes }, secret: 'once' }), listApiKeys: async () => [] }))
mock.module('#utils/systemEvent.ts', () => ({ recordSystemEvent: async () => {} }))
const { postServiceAccount, deleteServiceAccount } = await import('../src/handlers/serviceAccounts.ts')
const reply = () => ({ statusCode: 200, body: null as any, header() { return this }, status(value: number) { this.statusCode = value; return this }, send(value: any) { this.body = value; return this } })
const body = { name: 'Health monitor', scopes: [{ method: 'GET', route: '/api/service-accounts/self' }] }
beforeEach(() => { authenticated = true; administrator = true; writes = [] })
test('creation rejects signed-out and non-administrative users without writes', async () => {
    for (const [auth, admin, status] of [[false, true, 401], [true, false, 403]]) {
        authenticated = Boolean(auth); administrator = Boolean(admin)
        const res = reply(); await postServiceAccount({ body } as any, res as any)
        expect(res.statusCode).toBe(status); expect(writes).toHaveLength(0)
    }
})
test('creation cannot accept a wildcard or arbitrary admin endpoint', async () => {
    const res = reply(); await postServiceAccount({ body: { ...body, scopes: [{ method: 'POST', route: '/api/role' }] } } as any, res as any)
    expect(res.statusCode).toBe(400); expect(writes).toHaveLength(0)
})
test('creation uses a separate service identity and returns the secret once', async () => {
    const res = reply(); await postServiceAccount({ body } as any, res as any)
    expect(res.statusCode).toBe(201); expect(res.body.apiKey.ownerId.startsWith('svc_')).toBe(true)
    expect(writes[0]).toContain("'service'"); expect(res.body.secret).toBe('once')
    expect(writes.some(sql => sql.includes('user_roles'))).toBe(false)
})
test('deletion revokes all credentials and retains audit identity', async () => {
    const res = reply(); await deleteServiceAccount({ params: { id: 'svc_fixture' } } as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(writes.some(sql => sql.includes('active = FALSE'))).toBe(true)
    expect(writes.some(sql => sql.includes('enabled = FALSE'))).toBe(true)
    expect(writes.some(sql => sql.includes('revoked_at = NOW()'))).toBe(true)
    expect(writes.some(sql => sql.startsWith('DELETE'))).toBe(false)
})
