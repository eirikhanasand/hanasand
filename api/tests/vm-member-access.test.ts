import { expect, test, mock } from 'bun:test'
import Fastify from 'fastify'
import { readFile } from 'node:fs/promises'

const queries: Array<{ sql: string, params: unknown[] }> = []
let existing: any = null
let provisioned = ''
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: any) => ({ valid: Boolean(req.headers.id), id: req.headers.id }) }))
mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async (req: any) => ({ valid: req.headers.id === 'admin' }) }))
mock.module('../src/utils/auth/internalToken.ts', () => ({ default: () => false }))
mock.module('../src/constants.ts', () => ({ default: { vm_host_id: 'inspur' } }))
mock.module('../src/utils/vms/lxd.ts', () => ({ canUseLocalLxd: async () => true, provisionLocalLxdInstance: async (name: string) => { provisioned = name } }))
mock.module('../src/utils/vms/syncUserCertificatesToVm.ts', () => ({ default: async () => {} }))
mock.module('../src/utils/logs/recordLog.ts', () => ({ default: async () => {} }))
mock.module('../src/utils/systemEvent.ts', () => ({ recordSystemEvent: async () => {} }))
mock.module('../src/utils/docker/engine.ts', () => ({ isRuntimeLogSourceAvailable: () => false, listRuntimeContainers: async () => [] }))
mock.module('../src/utils/loadSQL.ts', () => ({ loadSQL: async (file: string) => readFile(new URL(`../src/queries/${file}`, import.meta.url), 'utf8') }))
mock.module('../src/utils/db.ts', () => ({ default: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    if (/SELECT name, owner, created_by, access_users FROM vms|SELECT name, owner, created_by, access_users\s+FROM vms/.test(sql)) return { rows: existing ? [existing] : [] }
    return { rows: /INSERT INTO vms/.test(sql) ? [{ name: params[0], owner: params[1] }] : [] }
} }))
const { default: getVM } = await import('../src/handlers/vms/get.ts')
const { default: getMetrics } = await import('../src/handlers/metrics/getMetrics.ts')
const { default: getDocker } = await import('../src/handlers/docker/getDocker.ts')
const { default: getVMDetails } = await import('../src/handlers/vms/getVMDetails.ts')
const { default: getVMMetrics } = await import('../src/handlers/vms/metrics/get.ts')
const { default: getConnection } = await import('../src/handlers/vms/getConnection.ts')
const { default: postVM } = await import('../src/handlers/vms/post.ts')

const app = Fastify()
app.decorate('stats', JSON.stringify({ host: { memoryPercent: 12 } }))
app.decorate('docker', JSON.stringify({ containers: [{ name: 'private-host-container' }] }))
app.get('/vms', getVM); app.get('/vms/:user', getVM); app.get('/vm/:id', getVM)
app.get('/metrics', getMetrics); app.get('/docker', getDocker)
app.get('/vm/:id/metrics', getVMMetrics); app.get('/vm/:name/details', getVMDetails); app.get('/vm/:id/connection', getConnection)
app.get('/vm/metrics', getVMMetrics); app.post('/vm', postVM)

test('members see only their VM scope, and host metrics remain admin-only', async () => {
    expect((await app.inject('/vms')).statusCode).toBe(401)
    expect((await app.inject({ url: '/vms/other', headers: { id: 'member' } })).statusCode).toBe(403)
    await app.inject({ url: '/vms', headers: { id: 'member' } })
    expect(queries.at(-1)?.params).toEqual(['member'])
    expect(queries.at(-1)?.sql).toContain('v.access_users ? $1')
    await app.inject({ url: '/vm/metrics', headers: { id: 'member' } })
    expect(queries.at(-1)?.sql).toContain('JOIN vms v')
    expect(queries.at(-1)?.params).toEqual(['member'])
    for (const url of ['/metrics', '/docker']) {
        expect((await app.inject({ url, headers: { id: 'member' } })).statusCode).toBe(403)
        expect((await app.inject({ url, headers: { id: 'admin' } })).statusCode).toBe(200)
    }
})
test('another user cannot inspect or connect to a VM; explicit access still works', async () => {
    existing = { name: 'private', owner: 'owner', created_by: 'owner', access_users: ['collaborator'] }
    for (const url of ['/vm/private', '/vm/private/metrics', '/vm/private/details', '/vm/private/connection']) {
        expect((await app.inject({ url, headers: { id: 'other' } })).statusCode).toBe(404)
    }
    for (const id of ['owner', 'collaborator', 'admin']) expect((await app.inject({ url: '/vm/private/metrics', headers: { id } })).statusCode).toBe(200)
})
test('member creation provisions their VM and cannot take over an existing name', async () => {
    existing = null; provisioned = ''; queries.length = 0
    const created = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'my-vm', owner: 'victim', created_by: 'victim' } })
    expect(created.statusCode).toBe(201)
    expect(created.json().owner).toBe('member')
    expect(provisioned).toBe('my-vm')
    expect(queries.find(q => /INSERT INTO vms/.test(q.sql))?.sql).toContain('DO NOTHING')
    existing = { name: 'private', owner: 'victim', created_by: 'victim', access_users: [] }; queries.length = 0; provisioned = ''
    expect((await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'private' } })).statusCode).toBe(409)
    expect(queries.every(q => !/UPDATE|DELETE|INSERT/.test(q.sql))).toBe(true)
    expect(provisioned).toBe('')
})
