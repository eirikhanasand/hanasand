import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const backupDir = await mkdtemp(join(tmpdir(), 'hanasand-db-backups-'))

process.env.DB = 'hanasand'
process.env.DB_HOST = '127.0.0.1'
process.env.DB_PORT = '1'
process.env.DB_PASSWORD = 'not-a-real-password'
process.env.DB_TIMEOUT_MS = '50'
process.env.VM_API_TOKEN = 'test-token'
process.env.DB_BACKUP_DIR = backupDir
process.env.DB_BACKUP_RETENTION_DAYS = '14'
process.env.DB_BACKUP_NEXT_AT = '2026-07-04T01:00:00.000Z'
delete process.env.DB_RESTORE_ENABLED

const backups = await import('../src/utils/db/backups.ts')

try {
    const emptyFiles = await backups.listDatabaseBackupFiles('hanasand')
    assert.deepEqual(emptyFiles, [], 'empty backup directory should not fake backup files')

    await writeFile(join(backupDir, 'hanasand-2026-07-03T00-00-00-000Z.dump'), 'backup-bytes')
    const files = await backups.listDatabaseBackupFiles('hanasand')
    assert.equal(files.length, 1, 'backup files route should expose real files from DB_BACKUP_DIR')
    assert.equal(files[0].service, 'hanasand_database', 'backup file service should match database slug')
    assert.equal(files[0].location, 'local', 'backup file should report local storage')
    assert.match(files[0].size || '', /B$/, 'backup file should include measured size')

    const unavailable = await backups.collectDatabaseBackupServices()
    assert.equal(unavailable.length, 1, 'backup status should return the primary database target')
    assert.equal(unavailable[0].status, 'Unavailable', 'failed local DB probe should be an unavailable state')
    assert.doesNotMatch(unavailable[0].error || '', /not-a-real-password|password authentication failed for user/i, 'status error should not expose raw credentials or postgres auth internals')
    assert.match(unavailable[0].retention || '', /14 days/, 'backup status should report retention config')
    assert.equal(unavailable[0].nextBackup, '2026-07-04T01:00:00.000Z', 'backup status should report schedule config')

    await assert.rejects(
        () => backups.restoreDatabaseBackupFile('hanasand-2026-07-03T00-00-00-000Z.dump'),
        /Restore is disabled until DB_RESTORE_ENABLED=true/,
        'restore must stay disabled until explicitly enabled',
    )

    assert.match(backups.sanitizeBackupError(new Error('password authentication failed for user "hanasand"')), /cannot authenticate to PostgreSQL/i)
    assert.doesNotMatch(backups.sanitizeBackupError(new Error('password authentication failed for user "hanasand"')), /"hanasand"|password authentication failed for user/i)

    const routeSource = await readFile(new URL('../src/routes.ts', import.meta.url), 'utf8')
    const handlerSource = await readFile(new URL('../src/handlers/database/backups.ts', import.meta.url), 'utf8')
    assert.match(routeSource, /fastify\.get\('\/backup', getDatabaseBackups\)/, 'GET /backup route should be wired')
    assert.match(routeSource, /fastify\.post\('\/backup', postDatabaseBackup\)/, 'POST /backup route should be wired')
    assert.match(routeSource, /fastify\.get\('\/backup\/files', getDatabaseBackupFiles\)/, 'GET /backup/files route should be wired')
    assert.match(routeSource, /fastify\.post\('\/backup\/restore', postDatabaseBackupRestore\)/, 'POST /backup/restore route should be wired')
    assert.match(handlerSource, /requireBackupAccess/, 'backup routes should require system admin access')

    console.log('Database backup API checks passed.')
} finally {
    await rm(backupDir, { recursive: true, force: true })
}
