import { expect, test, mock } from 'bun:test'
import Fastify from 'fastify'

let details: unknown[] = [{ device_eth0_ipv4_address: '192.0.2.10' }]
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: any) => ({ valid: Boolean(req.headers.id), id: req.headers.id }) }))
mock.module('../src/utils/vms/access.ts', () => ({ requireVmAccess: async () => ({ id: 'member' }) }))
mock.module('../src/utils/vms/syncUserCertificatesToVm.ts', () => ({ default: async () => { throw new Error('Internal service authentication failed') } }))
mock.module('../src/utils/logs/recordLog.ts', () => ({ default: async () => {} }))
mock.module('../src/utils/db.ts', () => ({ default: async (sql: string) => ({ rows: sql.includes('FROM vm_details') ? details : [{ id: 'certificate', name: 'Laptop' }] }) }))
const { default: getConnection } = await import('../src/handlers/vms/getConnection.ts')
const app = Fastify()
app.get('/vm/:id/connection', getConnection)

test('valid website session loads access metadata even if internal certificate sync fails', async () => {
    const response = await app.inject({ url: '/vm/cashflow/connection', headers: { id: 'member' } })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ vmName: 'cashflow', username: 'cashflow', vmIp: '192.0.2.10', certificateCount: 1 })
    expect(response.json().sshCommand).toContain('ssh cashflow@')
})
test('only website authentication failure returns 401', async () => {
    expect((await app.inject('/vm/cashflow/connection')).statusCode).toBe(401)
    details = []
    expect((await app.inject({ url: '/vm/cashflow/connection', headers: { id: 'member' } })).statusCode).toBe(503)
})
