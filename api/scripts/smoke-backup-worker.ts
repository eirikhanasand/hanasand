import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, access, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'

if (process.env.DB !== 'schema_lock_test') throw new Error('Requires the disposable schema_lock_test database')
const root = await mkdtemp(join(tmpdir(), 'backup-worker-proof-'))
const directory = join(root, 'backups')
const bin = join(root, 'bin')
await mkdir(bin)
await writeFile(join(bin, 'pg_dump'), '#!/bin/sh\ntouch "$BACKUP_PROOF_ROOT/started"\nwhile [ ! -f "$BACKUP_PROOF_ROOT/release" ]; do sleep 0.1; done\nexec /usr/bin/pg_dump "$@"\n', { mode: 0o700 })
const env = { ...process.env, DB_BACKUP_WORKER: '1', DB_BACKUP_DIR: directory,
    DB_BACKUP_STATE_PATH: join(directory, '.backup-state.json'), DB_BACKUP_WORKER_SOCKET: join(directory, '.worker.sock'),
    DB_BACKUP_ENABLED: 'false', BACKUP_PROOF_ROOT: root, PATH: `${bin}:${process.env.PATH}` }
Object.assign(process.env, { DB_BACKUP_WORKER_SOCKET: env.DB_BACKUP_WORKER_SOCKET })
const { backupWorkerCall } = await import('../src/utils/db/backupWorkerClient.ts')
const worker = spawn(process.execPath, ['src/backupWorker.ts'], { env, stdio: ['ignore', 'inherit', 'inherit'] })
let client: ReturnType<typeof spawn> | undefined
async function until(check: () => Promise<unknown>, timeout = 15000) {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
        try { if (await check()) return } catch { /* Worker may still be starting. */ }
        await Bun.sleep(50)
    }
    throw new Error('Timed out waiting for backup proof')
}
try {
    await until(async () => { await backupWorkerCall('files', []); return true })
    client = spawn(process.execPath, ['-e', 'import { createDatabaseBackup } from \'./src/utils/db/backups.ts\'; await createDatabaseBackup({actorId:\'isolated-test\'})'], {
        env: { ...env, DB_BACKUP_WORKER: '0' }, stdio: 'ignore',
    })
    await until(async () => { await access(join(root, 'started')); return true })
    const stateFile = join(directory, '.backup-state.json')
    const current = JSON.parse(await readFile(stateFile, 'utf8')).operations.at(-1)
    assert.equal(current.status, 'running')
    client.kill('SIGKILL')
    await new Promise(resolve => client!.once('exit', resolve))
    const conflict = await backupWorkerCall('create', [{}]).catch(error => error)
    assert.equal(conflict.statusCode, 409)
    const second = spawn(process.execPath, ['src/backupWorker.ts'], { env, stdio: 'ignore' })
    assert.notEqual(await new Promise(resolve => second.once('exit', resolve)), 0, 'second worker must not take ownership')
    assert.equal(JSON.parse(await readFile(stateFile, 'utf8')).operations.at(-1).id, current.id)
    await backupWorkerCall('pause', [true])
    await writeFile(join(root, 'release'), '')
    await until(async () => JSON.parse(await readFile(stateFile, 'utf8')).operations.at(-1).status === 'succeeded')
    const final = JSON.parse(await readFile(stateFile, 'utf8'))
    assert.equal(final.operations.length, 1)
    assert.equal(final.configuration.paused, true)
    assert.equal(final.operations[0].id, current.id)
    assert.ok(final.operations[0].checksumSha256)
    assert.ok(final.operations[0].archiveEntries > 0)
    console.log('Backup survived client termination; second owner refused; archive verified; pause and audit state preserved.')
} finally {
    client?.kill('SIGKILL')
    worker.kill('SIGTERM')
    await new Promise(resolve => worker.once('exit', resolve))
    delete process.env.DB_BACKUP_WORKER_SOCKET
    await rm(root, { recursive: true, force: true })
}
