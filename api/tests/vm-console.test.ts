import { test, expect, mock } from 'bun:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withLiveVmStatus } from '../src/utils/vms/status.ts'

test('VM status comes from a live check, never the saved running state', async () => {
    const vm = { name: 'cashflow', status: 'RUNNING', last_checked: '2026-06-20' }
    expect((await withLiveVmStatus(vm, async () => ({ status: 'Stopped' }))).status).toBe('STOPPED')
    expect((await withLiveVmStatus(vm, async () => { throw new Error('Connection refused') })).status).toBe('OFFLINE')
    expect((await withLiveVmStatus(vm, async () => ({ status: 'Running' }))).status).toBe('RUNNING')
})

let valid = true
let admin = false
let deleted = false
mock.module('../src/utils/auth/session.ts', () => ({ validateSession: async ({ id }: { id: string }) => valid ? { user: { id } } : null }))
mock.module('../src/utils/loadSQL.ts', () => ({ loadSQL: async () => 'role-query' }))
mock.module('../src/utils/db.ts', () => ({ default: async (sql: string, params: string[] = []) => ({ rows: sql.includes('SELECT vm_user_has_access') ? [{ allowed: ['owner', 'creator', 'member'].includes(params[1]) }] : sql === 'role-query' ? [{ has_role: admin }] : [{ owner: 'owner', created_by: 'creator', access_users: ['member'], deleted_at: deleted ? new Date() : null }] }) }))
mock.module('../src/utils/resilience.ts', () => ({ recoveryReadOnly: () => false }))
mock.module('../src/utils/vms/lxd.ts', () => ({ lxdRequest: async () => { throw new Error('Unexpected host access') } }))
const { consoleAccess } = await import('../src/handlers/vms/console.ts')
const { consoleUsername, consoleLoginScript } = await import('../src/utils/vms/lxdConsole.ts')

test('console requires an active session and VM ownership, sharing or verified admin role', async () => {
    for (const id of ['owner', 'creator', 'member']) expect(await consoleAccess('cashflow', id, 'test')).toBe(true)
    expect(await consoleAccess('cashflow', 'stranger', 'test')).toBe(false)
    valid = false
    expect(await consoleAccess('cashflow', 'member', 'test')).toBe(false)
    valid = true
    admin = true
    expect(await consoleAccess('cashflow', 'admin', 'test')).toBe(true)
})

test('console uses the existing VM account and rejects unsafe account names', () => {
    expect(consoleUsername('cashflow')).toBe('cashflow')
    expect(consoleUsername('my-vm')).toBe('my-vm')
    for (const name of ['root', 'nobody', '', '-admin', 'a; rm -rf /', 'alice@example.com', 'a'.repeat(65)]) {
        expect(() => consoleUsername(name)).toThrow('Invalid VM login account.')
    }
})

test('login requires an existing non-system account and never creates a user', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'console-login-'))
    try {
        await writeFile(join(directory, 'getent'), '#!/bin/sh\nexit "$ACCOUNT_MISSING"\n', { mode: 0o700 })
        await writeFile(join(directory, 'id'), '#!/bin/sh\nprintf "%s" "$ACCOUNT_UID"\n', { mode: 0o700 })
        await writeFile(join(directory, 'runuser'), '#!/bin/sh\nprintf "%s %s" "$1" "$2"\n', { mode: 0o700 })
        for (const [missing, uid, allowed] of [['0', '1001', true], ['1', '1001', false], ['0', '0', false], ['0', '999', false], ['0', '65534', false]] as const) {
            const process = Bun.spawn(['/bin/sh', '-c', consoleLoginScript, 'hanasand-console', 'cashflow'], {
                env: { PATH: directory, ACCOUNT_MISSING: missing, ACCOUNT_UID: uid }, stdout: 'pipe', stderr: 'pipe',
            })
            expect(await process.exited === 0).toBe(allowed)
            const output = await new Response(process.stdout).text()
            expect(output).toBe(allowed ? '--login cashflow' : '')
        }
    } finally { await rm(directory, { recursive: true, force: true }) }
})

test('pending deletion denies console access even to administrators', async () => {
    deleted = true
    admin = true
    expect(await consoleAccess('cashflow', 'admin', 'test')).toBe(false)
    expect(await consoleAccess('cashflow', 'owner', 'test')).toBe(false)
    deleted = false
})
