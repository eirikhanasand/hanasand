import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, rm, stat, unlink, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const root = await mkdtemp(join(tmpdir(), 'hanasand-db-backups-'))
const backupDir = join(root, 'backups')
const binDir = join(root, 'bin')
const statePath = join(backupDir, '.backup-state.json')
const lockPath = join(backupDir, '.operation.lock')
const commandLog = join(root, 'commands.log')

await Bun.$`mkdir -p ${backupDir} ${binDir}`
await installFakePostgresTools()

process.env.PATH = `${binDir}:${process.env.PATH}`
process.env.DB = 'hanasand'
process.env.DB_HOST = '127.0.0.1'
process.env.DB_PORT = '5432'
process.env.DB_USER = 'backup_operator'
process.env.DB_PASSWORD = 'test-password'
process.env.VM_API_TOKEN = 'test-token'
process.env.DB_BACKUP_DIR = backupDir
process.env.DB_BACKUP_STATE_PATH = statePath
process.env.DB_BACKUP_LOCK_PATH = lockPath
process.env.DB_BACKUP_RETENTION_DAYS = '1'
process.env.DB_BACKUP_SCHEDULE = '23 2 * * *'
process.env.DB_BACKUP_ENABLED = 'true'
process.env.DB_BACKUP_TEST_COMMAND_LOG = commandLog
process.env.HANASAND_RELEASE_COMMIT = 'test-release-commit'

const backups = await import('../src/utils/db/backups.ts')

try {
    assert.deepEqual(await backups.listDatabaseBackupFiles('hanasand'), [], 'empty storage must not fabricate backup files')

    const oldFile = join(backupDir, 'hanasand-2026-01-01T00-00-00-000Z.dump')
    await writeFile(oldFile, 'expired archive')
    const oldTime = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    await utimes(oldFile, oldTime, oldTime)

    const created = await backups.createDatabaseBackup({ actorId: 'admin-1' })
    assert.equal(created.status, 'succeeded', 'backup must only return success after dump verification and retention')
    assert.equal(created.kind, 'backup')
    assert.equal(created.actorId, 'admin-1')
    assert.equal(created.releaseCommit, 'test-release-commit')
    assert.match(created.checksumSha256 || '', /^[a-f0-9]{64}$/)
    assert.ok((created.sizeBytes || 0) > 0)
    assert.ok((created.archiveEntries || 0) > 0)
    assert.equal(created.sourceIntegrity?.tables, 2, 'archive comments about tables must not inflate restored table counts')
    assert.equal(created.retention?.deleted, 1, 'retention must delete an expired real archive')
    await assert.rejects(stat(oldFile), /ENOENT/)

    const files = await backups.listDatabaseBackupFiles('hanasand')
    assert.equal(files.length, 1)
    assert.equal(files[0].verified, true)
    assert.equal(files[0].checksumSha256, created.checksumSha256)
    assert.equal(files[0].releaseCommit, 'test-release-commit')
    assert.ok(await stat(`${join(backupDir, created.file!)}.metadata.json`), 'verified backup must have persisted sidecar evidence')

    const verified = await backups.verifyDatabaseBackupFile(created.file!, 'admin-1')
    assert.equal(verified.status, 'succeeded')
    assert.equal(verified.kind, 'verify')

    await writeFile(lockPath, 'held by another operation')
    await assert.rejects(
        () => backups.createDatabaseBackup({ actorId: 'admin-2' }),
        /already running/,
        'overlapping operation must be rejected by the durable exclusive lock',
    )
    await unlink(lockPath)

    process.env.DB_BACKUP_TEST_FAIL = 'pg_dump'
    await assert.rejects(() => backups.createDatabaseBackup({ actorId: 'admin-1' }), /needs attention/)
    delete process.env.DB_BACKUP_TEST_FAIL
    let status = (await backups.collectDatabaseBackupServices())[0]
    const failed = status.operations.find(operation => operation.kind === 'backup' && operation.status === 'failed')
    assert.ok(failed?.finishedAt, 'failed backup must have a persisted terminal audit record')
    assert.equal(failed?.file, null, 'failed backup must not be reported as a completed archive')
    assert.ok(status.lastFailure)
    assert.ok(status.lastError)

    assert.match(status.nextBackup || '', /^\d{4}-\d{2}-\d{2}T/)
    const dueAt = new Date(Date.parse(status.nextBackup!) + 1000)
    const scheduled = await backups.runDueDatabaseBackup(dueAt)
    assert.equal(scheduled?.status, 'succeeded', 'due scheduler cycle must execute a real backup')
    assert.equal(scheduled?.trigger, 'schedule')
    status = (await backups.collectDatabaseBackupServices())[0]
    assert.ok(Date.parse(status.nextBackup!) > dueAt.getTime(), 'next run must be advanced from persisted schedule evidence')

    const drillFile = scheduled!.file!
    const targetDatabase = 'restore_drill_release_check'
    await assert.rejects(
        () => backups.restoreDatabaseBackupFile({ file: drillFile, targetDatabase, confirmation: 'wrong' }),
        /Confirmation must exactly match/,
    )
    await assert.rejects(
        () => backups.restoreDatabaseBackupFile({ file: drillFile, targetDatabase: 'hanasand', confirmation: 'RESTORE hanasand' }),
        /must start with restore_drill_|cannot target the live database/,
    )
    const drill = await backups.restoreDatabaseBackupFile({
        file: drillFile,
        targetDatabase,
        confirmation: `RESTORE ${targetDatabase}`,
        actorId: 'admin-1',
    })
    assert.equal(drill.status, 'succeeded')
    assert.equal(drill.kind, 'restore_drill')
    assert.equal(drill.targetRemoved, true)
    assert.equal(drill.restoredIntegrity?.schemas, drill.sourceIntegrity?.schemas)
    assert.equal(drill.restoredIntegrity?.tables, drill.sourceIntegrity?.tables)
    const commands = await readFile(commandLog, 'utf8')
    assert.match(commands, /createdb .*restore_drill_release_check/)
    assert.match(commands, /dropdb .*restore_drill_release_check/)
    assert.doesNotMatch(commands, /createdb .* hanasand(?:\n|$)/, 'restore drill must never create or target the live database name')

    const failedCleanupTarget = 'restore_drill_cleanup_failure'
    process.env.DB_BACKUP_TEST_FAIL = 'pg_restore'
    process.env.DB_BACKUP_TEST_DROP_FAIL = 'true'
    await assert.rejects(
        () => backups.restoreDatabaseBackupFile({
            file: drillFile,
            targetDatabase: failedCleanupTarget,
            confirmation: `RESTORE ${failedCleanupTarget}`,
            actorId: 'admin-1',
        }),
        error => {
            assert.match(String(error), /Restore drill failed:/)
            assert.match(String(error), /Cleanup failed;/)
            assert.match(String(error), /was not removed/)
            return true
        },
    )
    delete process.env.DB_BACKUP_TEST_FAIL
    delete process.env.DB_BACKUP_TEST_DROP_FAIL
    status = (await backups.collectDatabaseBackupServices())[0]
    const failedCleanup = status.operations.find(operation => operation.targetDatabase === failedCleanupTarget)
    assert.equal(failedCleanup?.status, 'failed')
    assert.equal(failedCleanup?.targetRemoved, false)
    assert.match(failedCleanup?.error || '', /Restore drill failed:.*Cleanup failed;.*was not removed/)
    assert.match(await readFile(commandLog, 'utf8'), /dropdb .*restore_drill_cleanup_failure/, 'cleanup must still be attempted after restore failure')

    const persisted = JSON.parse(await readFile(statePath, 'utf8'))
    persisted.operations.push({
        ...persisted.operations[0],
        id: 'interrupted-operation',
        kind: 'backup',
        status: 'running',
        stage: 'dumping',
        startedAt: new Date(Date.now() - 1000).toISOString(),
        finishedAt: null,
        durationMs: null,
        error: null,
    })
    await writeFile(statePath, `${JSON.stringify(persisted, null, 2)}\n`)
    await writeFile(lockPath, 'stale process lock')
    const restarted = await import(`../src/utils/db/backups.ts?restart=${Date.now()}`)
    const afterRestart = (await restarted.collectDatabaseBackupServices())[0]
    const interrupted = afterRestart.operations.find(operation => operation.id === 'interrupted-operation')
    assert.equal(interrupted?.status, 'interrupted', 'restart must turn an orphaned running record into a durable failure')
    assert.match(interrupted?.error || '', /restarted before/)
    await assert.rejects(stat(lockPath), /ENOENT/, 'restart recovery must clear the stale operation lock')

    const routeSource = await readFile(new URL('../src/routes.ts', import.meta.url), 'utf8')
    const handlerSource = await readFile(new URL('../src/handlers/database/backups.ts', import.meta.url), 'utf8')
    assert.match(routeSource, /fastify\.get\('\/backup', getDatabaseBackups\)/)
    assert.match(routeSource, /fastify\.post\('\/backup', postDatabaseBackup\)/)
    assert.match(routeSource, /fastify\.post\('\/backup\/verify', postDatabaseBackupVerify\)/)
    assert.match(routeSource, /fastify\.post\('\/backup\/restore', postDatabaseBackupRestore\)/)
    assert.match(handlerSource, /hasRole\(req, res, 'system_admin'\)/, 'every backup route must require system_admin authorization')
    assert.match(handlerSource, /targetDatabase: req\.body\.targetDatabase/)
    assert.match(handlerSource, /confirmation: req\.body\.confirmation/)

    assert.match(backups.sanitizeBackupError(new Error('password authentication failed for user "hanasand"')), /cannot authenticate to PostgreSQL/i)
    assert.doesNotMatch(backups.sanitizeBackupError(new Error('password authentication failed for user "hanasand"')), /"hanasand"|password authentication failed for user/i)

    console.log('Database backup, retention, verification, schedule, restart, and isolated restore checks passed.')
} finally {
    await rm(root, { recursive: true, force: true })
}

async function installFakePostgresTools() {
    const scripts: Record<string, string> = {
        pg_dump: `#!/bin/sh
if [ "$DB_BACKUP_TEST_FAIL" = "pg_dump" ]; then echo "pg_dump failed" >&2; exit 1; fi
previous=""
output=""
for argument in "$@"; do
  if [ "$previous" = "--file" ]; then output="$argument"; fi
  previous="$argument"
done
printf 'verified custom archive bytes' > "$output"
`,
        pg_restore: `#!/bin/sh
if [ "$DB_BACKUP_TEST_FAIL" = "pg_restore" ] && [ "$1" != "--list" ]; then echo "pg_restore failed" >&2; exit 1; fi
if [ "$1" = "--list" ]; then
  printf '; archive\n1; 0 0 SCHEMA - public owner\n2; 1259 1 TABLE public users owner\n3; 1259 2 TABLE public audit_events owner\n4; 0 0 COMMENT - TABLE public users owner\n5; 0 1 TABLE DATA public users owner\n6; 0 2 TABLE DATA public audit_events owner\n'
fi
`,
        psql: `#!/bin/sh
if [ "$DB_BACKUP_TEST_FAIL" = "psql" ]; then echo "psql failed" >&2; exit 1; fi
printf '{"schemas":1,"tables":2,"estimatedRows":5}\n'
`,
        createdb: `#!/bin/sh
printf 'createdb %s\n' "$*" >> "$DB_BACKUP_TEST_COMMAND_LOG"
if [ "$DB_BACKUP_TEST_FAIL" = "createdb" ]; then exit 1; fi
`,
        dropdb: `#!/bin/sh
printf 'dropdb %s\n' "$*" >> "$DB_BACKUP_TEST_COMMAND_LOG"
if [ "$DB_BACKUP_TEST_FAIL" = "dropdb" ] || [ "$DB_BACKUP_TEST_DROP_FAIL" = "true" ]; then exit 1; fi
`,
    }
    for (const [name, source] of Object.entries(scripts)) {
        const file = join(binDir, name)
        await writeFile(file, source)
        await chmod(file, 0o755)
    }
}
