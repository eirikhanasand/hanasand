import { afterEach, expect, mock, test } from 'bun:test'
let identity = { valid: true, id: 'user-one' }
let allowed = false
let calls: Array<{ sql: string, params?: unknown[] }> = []
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => identity }))
mock.module('#db', () => ({ default: async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params })
    return { rows: sql.includes('SELECT 1') ? (allowed ? [{ allowed: 1 }] : []) : [{ id: 'cashflow', name: 'Cashflow', member_count: 2 }] }
} }))
const { getManagementOrganizations } = await import('../src/handlers/managementOrganizations')
afterEach(() => { calls = []; allowed = false; identity = { valid: true, id: 'user-one' } })
async function request(access?: string) {
    const reply = { code: 200, payload: null as any, header() { return this }, status(code: number) { this.code = code; return this }, send(payload: any) { this.payload = payload; return this } }
    await getManagementOrganizations({ query: { access } } as any, reply as any)
    return reply
}
test('anonymous requests cannot query organizations', async () => {
    identity.valid = false
    expect((await request()).code).toBe(401)
    expect(calls).toHaveLength(0)
})
test('Cashflow and other organization administrators cannot list organizations', async () => {
    expect((await request()).code).toBe(403)
    expect(calls).toHaveLength(1)
    expect(calls[0].params).toEqual(['user-one', '3e735e7b-4d7f-444d-9806-231fa26cfcec'])
    expect(calls[0].sql).toContain("m.role IN ('owner', 'admin')")
    expect(calls[0].sql).toContain("m.status = 'active'")
    expect(calls[0].sql).toContain("o.status = 'active'")
    expect(calls[0].sql).toContain('u.active = TRUE')
})
test('Hanasand administrators receive the organization list', async () => {
    allowed = true
    const response = await request()
    expect(response.code).toBe(200)
    expect(response.payload.organizations[0].name).toBe('Cashflow')
    expect(calls).toHaveLength(2)
})
test('navigation access checks do not load or expose the list', async () => {
    allowed = true
    expect((await request('1')).payload).toEqual({ allowed: true })
    expect(calls).toHaveLength(1)
})
