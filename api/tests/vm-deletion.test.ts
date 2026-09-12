import { beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const day = 86400000
let now = 0
let vm: any
let instance: any
let failAt = ''
let removed = 0
let starts = 0
let tail = Promise.resolve()
const clone = (value: any) => structuredClone(value)
mock.module('../src/constants.ts', () => ({ default: { vm_host_id: 'inspur' } }))
mock.module('../src/utils/db.ts', () => ({
    withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => {
        const prior = tail
        let release!: () => void
        tail = new Promise(resolve => { release = resolve })
        await prior
        try { return await work() } finally { release() }
    },
    default: async (sql: string, params: any[] = []) => {
        if (sql.startsWith('SELECT *')) return { rows: vm ? [clone(vm)] : [] }
        if (sql.startsWith('SELECT name')) {
            const eligible = vm && (sql.includes('delete_after <=') ? Date.parse(vm.delete_after) <= now : sql.includes('delete_after >') ? Date.parse(vm.delete_after) > now : vm.deleted_at)
            return { rows: eligible ? [{ name: vm.name }] : [] }
        }
        if (sql.includes('SET deleted_at = NOW()')) Object.assign(vm, { deleted_at: new Date(now).toISOString(), delete_after: new Date(now + 30 * day).toISOString(), deletion_restore: JSON.parse(params[1]), deletion_error: null })
        else if (sql.includes('SET deleted_at = NULL')) {
            if (failAt === 'restore-db') throw new Error('Database write failed')
            Object.assign(vm, { deleted_at: null, delete_after: null, deletion_restore: null, deletion_error: null })
        } else if (sql.startsWith('UPDATE vms SET deletion_error')) vm.deletion_error = params[1] ?? null
        else if (sql.startsWith('DELETE FROM vms')) vm = null
        else if (!sql.startsWith('DELETE FROM vm_shutdown')) throw new Error(`Unexpected SQL: ${sql}`)
        return { rows: vm ? [clone(vm)] : [] }
    },
}))
mock.module('../src/utils/vms/lxd.ts', () => ({
    getLocalLxdInstance: async () => { if (!instance) throw new Error('Missing instance'); return clone(instance) },
    setLocalLxdInstanceState: async (_name: string, action: string) => {
        if (failAt === action) throw new Error(`Failed to ${action}`)
        if (action === 'start') starts++
        if (action === 'stop' && instance.ephemeral) throw new Error('Would destroy ephemeral disk')
        instance.status = action === 'start' ? 'Running' : 'Stopped'
    },
    lxdRequest: async (path: string, options: any = {}) => {
        if (path.includes('?recursion')) {
            if (failAt === 'host') throw new Error('Host unavailable')
            return { metadata: instance ? [{ name: instance.name }] : [] }
        }
        if (options.method === 'PATCH') {
            Object.assign(instance, options.body)
            return {}
        }
        if (options.method === 'DELETE') {
            if (failAt === 'purge') throw new Error('Disk delete failed')
            removed++; instance = null
            return {}
        }
        throw new Error(`Unexpected LXD request: ${path}`)
    },
}))
mock.module('../src/utils/vms/access.ts', () => ({ vmViewer: async (req: any, res: any) => {
    if (!req.headers.id) { res.status(401).send({ error: 'Unauthorized' }); return null }
    return { id: req.headers.id, admin: req.headers.id === 'admin' }
} }))
mock.module('../src/utils/systemEvent.ts', () => ({ recordSystemEvent: async () => {} }))
const { scheduleVmDeletion, restoreVm, maintainDeletedVms, deletionMarker } = await import('../src/utils/vms/deletion.ts')
const { default: deleteVM, restoreVM } = await import('../src/handlers/vms/delete.ts')
const app = Fastify()
app.delete('/vm/:id', deleteVM)
app.post('/vm/:id/restore', restoreVM)

beforeEach(() => {
    now = Date.parse('2026-09-12T12:00:00Z'); removed = 0; starts = 0; failAt = ''
    vm = { name: 'cashflow', primary_host: 'inspur', deleted_at: null, delete_after: null, deletion_restore: null }
    instance = { name: 'cashflow', status: 'Running', ephemeral: true, config: { 'boot.autostart': 'true', 'limits.cpu': '2' } }
})

test('requires an administrator and the exact typed VM name before changing anything', async () => {
    for (const [id, confirmation, status] of [['', 'cashflow', 401], ['member', 'cashflow', 403], ['admin', 'Cashflow', 400], ['admin', 'cashflow ', 400], ['admin', '', 400]] as const) {
        expect((await app.inject({ method: 'DELETE', url: '/vm/cashflow', headers: { id }, payload: { confirmation } })).statusCode).toBe(status)
        expect(vm.deleted_at).toBeNull()
        expect(instance.status).toBe('Running')
    }
    expect((await app.inject({ method: 'DELETE', url: '/vm/cashflow', headers: { id: 'admin' }, payload: { confirmation: 'cashflow' } })).statusCode).toBe(200)
})

test('preserves the disk, disables startup, and retries without extending the 30-day deadline', async () => {
    await scheduleVmDeletion('cashflow', 'cashflow')
    const deadline = vm.delete_after
    expect(Date.parse(deadline) - now).toBe(30 * day)
    expect(instance.status).toBe('Stopped')
    expect(instance.ephemeral).toBe(false)
    expect(instance.config[deletionMarker]).toBe(deadline)
    expect(instance.config['boot.autostart']).toBe('false')
    now += 5 * day
    await scheduleVmDeletion('cashflow', 'cashflow')
    await maintainDeletedVms()
    expect(vm.delete_after).toBe(deadline)
    expect(removed).toBe(0)
})

test('one restore request returns the VM to its previous state and cancels expiry', async () => {
    await scheduleVmDeletion('cashflow', 'cashflow')
    now += 29 * day
    expect((await app.inject({ method: 'POST', url: '/vm/cashflow/restore', headers: { id: 'member' } })).statusCode).toBe(403)
    expect((await app.inject({ method: 'POST', url: '/vm/cashflow/restore', headers: { id: 'admin' } })).statusCode).toBe(200)
    expect(vm.deleted_at).toBeNull()
    expect(instance.status).toBe('Running')
    expect(instance.ephemeral).toBe(true)
    expect(instance.config['boot.autostart']).toBe('true')
    expect(instance.config['limits.cpu']).toBe('2')
    now += 10 * day
    await maintainDeletedVms()
    expect(removed).toBe(0)
    expect(starts).toBe(1)
})

test('failed stop keeps recovery information and the original deadline for retry', async () => {
    failAt = 'stop'
    await expect(scheduleVmDeletion('cashflow', 'cashflow')).rejects.toThrow('Failed to stop')
    expect(vm.deletion_restore).not.toBeNull()
    expect(vm.deletion_error).toBe('Failed to stop')
    const deadline = vm.delete_after
    failAt = ''; now += day
    await maintainDeletedVms()
    expect(instance.status).toBe('Stopped')
    expect(vm.delete_after).toBe(deadline)
    expect(vm.deletion_error).toBeNull()
})

test('failed restore keeps the VM stopped and recoverable', async () => {
    await scheduleVmDeletion('cashflow', 'cashflow')
    failAt = 'restore-db'
    await expect(restoreVm('cashflow')).rejects.toThrow('Database write failed')
    expect(vm.deleted_at).not.toBeNull()
    expect(instance.status).toBe('Stopped')
    expect(instance.config[deletionMarker]).toBe(vm.delete_after)
    expect(instance.ephemeral).toBe(false)
})

test('expiry boundary is enforced under the same lock as restore, and disk failures are retried', async () => {
    await scheduleVmDeletion('cashflow', 'cashflow')
    now += 30 * day - 1
    await maintainDeletedVms()
    expect(removed).toBe(0)
    now++
    failAt = 'purge'
    await expect(restoreVm('cashflow')).rejects.toThrow('recovery period has ended')
    await expect(maintainDeletedVms()).rejects.toThrow('Could not finish')
    expect(vm).not.toBeNull()
    failAt = 'host'
    await expect(maintainDeletedVms()).rejects.toThrow('Could not finish')
    expect(vm).not.toBeNull()
    failAt = ''
    await maintainDeletedVms()
    expect(removed).toBe(1)
    expect(vm).toBeNull()
})

test('restoring before expiry prevents a concurrent retention job from deleting the VM', async () => {
    await scheduleVmDeletion('cashflow', 'cashflow')
    now += 29 * day
    await Promise.all([restoreVm('cashflow'), maintainDeletedVms()])
    expect(vm.deleted_at).toBeNull()
    expect(removed).toBe(0)
})
