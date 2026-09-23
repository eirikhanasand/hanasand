import { afterAll, expect, test } from 'bun:test'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backupWorkerCall } from '../src/utils/db/backupWorkerClient.ts'

const root = await mkdtemp(join(tmpdir(), 'backup-socket-'))
const socket = join(root, 'worker.sock')
process.env.DB_BACKUP_WORKER_SOCKET = socket
const calls: unknown[] = []
const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const input = JSON.parse(body)
    calls.push(input)
    if (input.method === 'create') {
        res.writeHead(409).end(JSON.stringify({ error: 'Another backup is running.' }))
    } else res.end(JSON.stringify({ value: [{ file: 'verified.dump' }] }))
})
await new Promise<void>(resolve => server.listen(socket, resolve))
afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
    delete process.env.DB_BACKUP_WORKER_SOCKET
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
