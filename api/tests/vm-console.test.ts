import { test, expect, mock } from 'bun:test'
import { withLiveVmStatus } from '../src/utils/vms/status.ts'

test('VM status comes from a live check, never the saved running state', async () => {
    const vm = { name: 'cashflow', status: 'RUNNING', last_checked: '2026-06-20' }
    expect((await withLiveVmStatus(vm, async () => ({ status: 'Stopped' }))).status).toBe('STOPPED')
    expect((await withLiveVmStatus(vm, async () => { throw new Error('Connection refused') })).status).toBe('OFFLINE')
    expect((await withLiveVmStatus(vm, async () => ({ status: 'Running' }))).status).toBe('RUNNING')
})

let valid = true
let admin = false
mock.module('../src/utils/auth/session.ts', () => ({ validateSession: async ({ id }: { id: string }) => valid ? { user: { id } } : null }))
mock.module('../src/utils/loadSQL.ts', () => ({ loadSQL: async () => 'role-query' }))
mock.module('../src/utils/db.ts', () => ({ default: async (sql: string) => ({ rows: sql === 'role-query' ? [{ has_role: admin }] : [{ owner: 'owner', created_by: 'creator', access_users: ['member'] }] }) }))
mock.module('../src/utils/resilience.ts', () => ({ recoveryReadOnly: () => false }))
mock.module('../src/utils/vms/lxd.ts', () => ({ lxdRequest: async () => { throw new Error('Unexpected host access') } }))
const { consoleAccess } = await import('../src/handlers/vms/console.ts')
const { consoleUsername } = await import('../src/utils/vms/lxdConsole.ts')

test('console requires an active session and VM ownership, sharing or verified admin role', async () => {
    for (const id of ['owner', 'creator', 'member']) expect(await consoleAccess('cashflow', id, 'test')).toBe(true)
    expect(await consoleAccess('cashflow', 'stranger', 'test')).toBe(false)
    valid = false
    expect(await consoleAccess('cashflow', 'member', 'test')).toBe(false)
    valid = true
    admin = true
    expect(await consoleAccess('cashflow', 'admin', 'test')).toBe(true)
})

test('Linux accounts are distinct, safe names and cannot select a privileged system account', () => {
    for (const id of ['root', 'eiriktest', 'a; rm -rf /', 'alice@example.com']) {
        expect(consoleUsername(id)).toMatch(/^hs-[a-z0-9-]+-[a-f0-9]{10}$/)
        expect(consoleUsername(id).length).toBeLessThanOrEqual(32)
    }
    expect(consoleUsername('A')).not.toBe(consoleUsername('a'))
})
