import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
let allowed = true
let fail = false
let probes = 0
let host = 'inspur'
let snapshot = { name: 'cashflow', last_checked: '2026-07-22T15:34:00Z', limits_memory: '2GB' }
mock.module('../src/constants.ts', () => ({ default: { vm_host_id: 'inspur' } }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true }) }))
mock.module('../src/utils/vms/access.ts', () => ({ requireVmAccess: async (_req: unknown, reply: { code: (n: number) => { send: (v: unknown) => void } }) => {
    if (allowed) return { name: 'cashflow' }
    reply.code(404).send({ error: 'VM not found.' })
    return null
} }))
mock.module('../src/utils/vms/status.ts', () => ({ withLiveVmStatus: async (row: unknown) => row }))
mock.module('../src/utils/db.ts', () => ({ default: async (sql: string) => ({ rows: [sql.includes('primary_host') ? { primary_host: host } : snapshot] }) }))
mock.module('../src/utils/vms/lxd.ts', () => ({ refreshLocalLxdDetails: async (_name: string, strict: boolean) => {
    probes++
    expect(strict).toBe(true)
    if (fail) throw new Error('host unavailable')
    snapshot = { ...snapshot, last_checked: '2026-09-13T12:00:00Z', limits_memory: '4GB' }
} }))
const { default: handler } = await import('../src/handlers/vms/getVMDetails.ts')

test('explicit refresh persists and returns new host details, while failures and denied access preserve the snapshot', async () => {
    const app = Fastify()
    app.get('/details/:name', handler)
    try {
        expect((await app.inject('/details/cashflow')).json().last_checked).toBe('2026-07-22T15:34:00Z')
        expect(probes).toBe(0)
        const updated = await app.inject('/details/cashflow?refresh=1')
        expect(updated.statusCode).toBe(200)
        expect(updated.headers['cache-control']).toBe('no-store')
        expect(updated.json().limits_memory).toBe('4GB')
        fail = true
        expect((await app.inject('/details/cashflow?refresh=1')).statusCode).toBe(503)
        expect(snapshot.last_checked).toBe('2026-09-13T12:00:00Z')
        host = 'another-host'
        expect((await app.inject('/details/cashflow?refresh=1')).statusCode).toBe(503)
        allowed = false
        expect((await app.inject('/details/cashflow?refresh=1')).statusCode).toBe(404)
        expect(probes).toBe(2)
    } finally { await app.close() }
})
