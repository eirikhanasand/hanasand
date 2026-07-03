import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { presentBackup, presentBackupLoadError, redactBackupDetails } from '../src/app/dashboard/db/backups/backupPresentation.ts'

const backupPage = await readFile(new URL('../src/app/dashboard/db/backups/backupPage.tsx', import.meta.url), 'utf8')
const routePage = await readFile(new URL('../src/app/dashboard/db/backups/page.tsx', import.meta.url), 'utf8')
const legacyRedirect = await readFile(new URL('../src/app/dashboard/backup/page.tsx', import.meta.url), 'utf8')
const frontendApi = await readFile(new URL('../src/utils/db/internal.ts', import.meta.url), 'utf8')
const apiRoutes = await readFile(new URL('../../api/src/routes.ts', import.meta.url), 'utf8')

const healthy = presentBackup({
    id: 'primary_database',
    name: 'primary_database',
    status: 'Healthy',
    lastBackup: '2026-07-02T10:00:00.000Z',
    nextBackup: '2026-07-03T10:00:00.000Z',
    retention: '14 days',
    storageTarget: 's3://backups/primary',
    latestFile: 'primary-2026-07-02.dump',
    latestSize: '42 MB',
    latestDuration: '23s',
    healthCheck: 'Verified',
})

assert.equal(healthy.healthLabel, 'Healthy', 'success state should report healthy')
assert.equal(healthy.restoreReady, true, 'success state should allow restore browsing')
assert.equal(healthy.retention, '14 days', 'success state should preserve retention')
assert.equal(healthy.storageTarget, 's3://backups/primary', 'success state should preserve storage target')

const unavailable = presentBackup({
    id: 'primary_database',
    name: 'primary_database',
    status: 'Unavailable',
    error: 'password authentication failed for user "hanasand"',
    lastBackup: null,
    nextBackup: null,
})

assert.equal(unavailable.healthLabel, 'Unavailable', 'auth failure should report unavailable')
assert.equal(unavailable.restoreReady, false, 'auth failure should disable restore')
assert.match(unavailable.safeError || '', /cannot authenticate to the database/i, 'auth failure should be summarized safely')
assert.doesNotMatch(unavailable.safeError || '', /password authentication failed|hanasand/i, 'safe error should not dump raw postgres auth internals')
assert.match(unavailable.restoreDisabledReason || '', /until backup status and files can be verified/i, 'auth failure should explain disabled restore')

const empty = presentBackup({
    id: 'primary_database',
    name: 'primary_database',
    status: 'Available',
    lastBackup: null,
    nextBackup: null,
})

assert.equal(empty.restoreReady, false, 'no-backups-yet state should disable restore')
assert.match(empty.restoreDisabledReason || '', /until at least one backup file exists/i, 'no-backups-yet should explain disabled restore')
assert.equal(empty.latestFile, 'Not reported', 'unsupported latest file should be honest observable-only state')

const loadError = presentBackupLoadError('Error: password authentication failed for user "hanasand"')
assert.match(loadError.safeError, /cannot authenticate to the database/i, 'route load error should become actionable')
assert.equal(redactBackupDetails('password authentication failed for user "hanasand"'), 'password authentication failed for configured database user', 'technical details should redact postgres user')
assert.match(presentBackupLoadError('Backup storage directory is not available. Set DB_BACKUP_DIR.').safeError, /Backup storage is not configured/i, 'storage blocker should be actionable')
assert.match(presentBackupLoadError('pg_dump exited with code 1').safeError, /cannot run pg_dump/i, 'missing pg_dump should be actionable')
assert.match(presentBackupLoadError('Restore is disabled until DB_RESTORE_ENABLED=true is set for the API service.').safeError, /Restore is disabled in the API service/i, 'restore-disabled API blocker should be actionable')

assert.match(routePage, /<DashboardHeader[\s\S]*title='Database Backups'/, 'route should own the single page header')
assert.doesNotMatch(backupPage, /DashboardHeader/, 'client page should not render a duplicate page header')
assert.match(routePage, /loadError=\{typeof backups === 'string' \? backups : ''\}/, 'route should preserve backup API errors')
assert.match(frontendApi, /requestService<BackupService\[\]>\('internal', 'backup'\)/, 'frontend should call the internal /backup status route')
assert.match(frontendApi, /requestService<BackupFile\[\]>\('internal', `backup\/files/, 'frontend should call the internal /backup/files route')
assert.match(frontendApi, /requestService<\{ message: string \}>\('internal', 'backup'/, 'frontend should call the internal POST /backup action route')
assert.match(frontendApi, /requestService<\{ message: string \}>\('internal', 'backup\/restore'/, 'frontend should call the internal /backup/restore route')
assert.match(apiRoutes, /fastify\.get\('\/backup', getDatabaseBackups\)/, 'API should expose GET /backup')
assert.match(apiRoutes, /fastify\.post\('\/backup', postDatabaseBackup\)/, 'API should expose POST /backup')
assert.match(apiRoutes, /fastify\.get\('\/backup\/files', getDatabaseBackupFiles\)/, 'API should expose GET /backup/files')
assert.match(apiRoutes, /fastify\.post\('\/backup\/restore', postDatabaseBackupRestore\)/, 'API should expose POST /backup/restore')
assert.match(backupPage, /presentations\.map/, 'backup actions should render inside each backup target card')
assert.match(backupPage, /restoreDisabledReason/, 'restore disabled state should carry a visible reason')
assert.match(backupPage, /Technical details/, 'raw details should be behind progressive disclosure')
assert.match(backupPage, /Open logs/, 'error state should link operators to logs')
assert.match(backupPage, /return 'Never'/, 'missing last backup should render as never, not a loading promise')
assert.match(backupPage, /return 'No schedule configured'/, 'missing next backup should render as a configured-state message')
assert.doesNotMatch(backupPage, /password authentication failed for user/, 'main UI should not hard-code raw postgres auth errors')
assert.match(legacyRedirect, /redirect\('\/dashboard\/db\/backups'\)/, '/dashboard/backup should land on the backup operations page')

console.log('Backup operations checks passed.')
