import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
let viewer: { id: string; admin: boolean } | null = { id: 'owner', admin: false }
let vm: { owner: string; organization_id?: string; deleted_at?: string } | null = { owner: 'owner' }
let org: { id: string; name: string } | null = { id: 'cashflow-org', name: 'Cashflow' }
let writes: string[] = []
mock.module('../src/utils/vms/access.ts', () => ({ vmViewer: async (_req: unknown, res: { status: (n: number) => { send: (v: unknown) => void } }) => {
    if (!viewer) res.status(401).send({ error: 'Unauthorized' })
    return viewer
} }))
mock.module('../src/utils/db.ts', () => ({ withTransaction: async (work: (q: (sql: string) => Promise<unknown>) => Promise<unknown>) => work(async sql => {
    if (sql.startsWith('SELECT * FROM vms')) return { rows: vm ? [vm] : [] }
    if (sql.includes('SELECT o.id')) return { rows: org ? [org] : [] }
    writes.push(sql); return { rows: [] }
}) }))
const { default: assign } = await import('../src/handlers/vms/organization.ts')
const app = Fastify()
app.put('/vm/:id/organization', assign)
const request = () => app.inject({ method: 'PUT', url: '/vm/personal/organization', payload: { organizationId: 'cashflow-org' } })
test('personal owner can transfer to an organization with an audit event and no individual grants', async () => {
    writes = []
    expect((await request()).statusCode).toBe(200)
    expect(writes[0]).toContain('access_users = \'[]\'::jsonb')
    expect(writes[1]).toContain('vm.organization_assigned')
})
test('transfer rejects another owner, unavailable membership and an already organizational VM', async () => {
    writes = []; vm = { owner: 'someone-else' }
    expect((await request()).statusCode).toBe(404)
    vm = { owner: 'owner' }; org = null
    expect((await request()).statusCode).toBe(403)
    org = { id: 'cashflow-org', name: 'Cashflow' }; vm.organization_id = 'existing'
    expect((await request()).statusCode).toBe(409)
    vm = { owner: 'owner', deleted_at: '2026-09-14' }
    expect((await request()).statusCode).toBe(409)
    expect(writes).toEqual([])
    viewer = null
    expect((await request()).statusCode).toBe(401)
})
