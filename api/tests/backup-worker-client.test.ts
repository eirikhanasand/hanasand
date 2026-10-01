import { afterAll, expect, test } from 'bun:test'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backupWorkerCall } from '../src/utils/db/backupWorkerClient.ts'

const root = await mkdtemp(join(tmpdir(), 'backup-socket-'))
const socket = join(root, 'worker.sock')
const previousWorkerSetting = process.env.DB_BACKUP_WORKER
const targetDatabase = process.env.DB || 'hanasand'
process.env.DB_BACKUP_WORKER_SOCKET = socket
process.env.DB_BACKUP_WORKER = '0'
const calls: unknown[] = []
const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const input = JSON.parse(body)
    calls.push(input)
    if (input.method === 'create') {
        res.writeHead(409).end(JSON.stringify({ error: 'Another backup is running.' }))
    } else if (input.method === 'restore-live') res.end(JSON.stringify({ value: { kind: 'restore_live', file: 'verified.dump' } }))
    else res.end(JSON.stringify({ value: [{ file: 'verified.dump' }] }))
})
await new Promise<void>(resolve => server.listen(socket, resolve))
afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
    delete process.env.DB_BACKUP_WORKER_SOCKET
    if (previousWorkerSetting === undefined) delete process.env.DB_BACKUP_WORKER
    else process.env.DB_BACKUP_WORKER = previousWorkerSetting
    await rm(root, { recursive: true })
})
test('API delegates backup reads without touching worker state', async () => {
    const { listDatabaseBackupFiles } = await import('../src/utils/db/backups.ts')
    expect(await listDatabaseBackupFiles('hanasand')).toEqual([{ file: 'verified.dump' }])
    expect(calls[0]).toEqual({ method: 'files', args: ['hanasand', null] })
})
test('worker conflicts preserve their status and do not fall back to local exports', async () => {
    const error = await backupWorkerCall('create', [{}]).catch(error => error)
    expect(error.statusCode).toBe(409)
    expect(error.message).toBe('Another backup is running.')
})
test('live restore requests are sent to the dedicated backup worker operation', async () => {
    const { restoreDatabaseBackupToLive } = await import('../src/utils/db/backups.ts')
    const result = await restoreDatabaseBackupToLive({ file: 'verified.dump', confirmation: `RESTORE ${targetDatabase}`, actorId: 'admin-1' })
    expect(result).toEqual({ kind: 'restore_live', file: 'verified.dump' })
    expect(calls.at(-1)).toEqual({
        method: 'restore-live',
        args: [{ file: 'verified.dump', confirmation: `RESTORE ${targetDatabase}`, actorId: 'admin-1' }],
    })
})
