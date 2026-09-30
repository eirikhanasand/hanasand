import { afterEach, expect, mock, test } from 'bun:test'
let identity = { valid: true, id: 'user-one' }
let membershipRole: string | undefined
let calls: Array<{ sql: string, params?: unknown[] }> = []
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => identity }))
mock.module('#db', () => ({ default: async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params })
    return { rows: sql.includes('JOIN organizations o ON o.id = m.organization_id') ? (membershipRole ? [{ organization_id: params?.[1], organization_status: 'active', membership_status: 'active', role: membershipRole }] : []) : [{ id: 'cashflow', name: 'Cashflow', member_count: 2, last_active_at: '2026-09-19T10:30:00Z' }] }
} }))
const { getManagementOrganizations } = await import('../src/handlers/managementOrganizations')
afterEach(() => { calls = []; membershipRole = undefined; identity = { valid: true, id: 'user-one' } })
async function request(query: { access?: string, internalPages?: string } = {}) {
    const reply = { code: 200, payload: null as any, header() { return this }, status(code: number) { this.code = code; return this }, send(payload: any) { this.payload = payload; return this } }
    await getManagementOrganizations({ query } as any, reply as any)
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
    expect(calls[0].sql).toContain('m.status = \'active\'')
    expect(calls[0].sql).toContain('m.status = \'active\'')
    expect(calls[0].sql).toContain('o.status = \'active\'')
    expect(calls[0].sql).toContain('u.active = TRUE')
})
test('Hanasand owners and editors receive the organization list', async () => {
    membershipRole = 'editor'
    const response = await request()
    expect(response.code).toBe(200)
    expect(response.payload.organizations[0].name).toBe('Cashflow')
    expect(calls).toHaveLength(2)
    expect(response.payload.organizations[0].last_active_at).toBe('2026-09-19T10:30:00Z')
    expect(calls[1].sql).toContain('o.status <> \'deleted\'')
    expect(calls[1].sql).toContain('e.outcome = \'success\'')
    expect(calls[1].sql).toContain('k.organization_id = o.id')
})
test('internal pages accept active Hanasand members while organization listing stays manager-only', async () => {
    membershipRole = 'editor'
    expect((await request({ internalPages: '1' })).payload).toEqual({ allowed: true, canEdit: true })
    expect(calls).toHaveLength(1)
    calls = []; membershipRole = 'owner'
    expect((await request({ internalPages: '1' })).payload).toEqual({ allowed: true, canEdit: true })
    calls = []; membershipRole = 'reader'
    expect((await request({ internalPages: '1' })).payload).toEqual({ allowed: true, canEdit: false })
    calls = []
    expect((await request({ access: '1' })).payload).toEqual({ allowed: false })
    expect(calls).toHaveLength(1)
})
test('general organization access checks keep the admin membership capability', async () => {
    membershipRole = 'admin'
    expect((await request({ access: '1' })).payload).toEqual({ allowed: true })
    expect(calls).toHaveLength(1)
})
