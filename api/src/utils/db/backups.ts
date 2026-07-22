import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { chmod, mkdir, open, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

type BackupLocation = 'local'
type BackupOperationKind = 'backup' | 'verify' | 'restore_drill'
type BackupOperationStatus = 'running' | 'succeeded' | 'failed' | 'interrupted'

type IntegritySummary = {
    schemas: number
    tables: number
    estimatedRows: number
}

type BackupMetadata = {
    schemaVersion: 'hanasand.database_backup.v1'
    file: string
    database: string
    createdAt: string
    verifiedAt: string
    checksumSha256: string
    sizeBytes: number
    durationMs: number
    archiveEntries: number
    sourceIntegrity: IntegritySummary
    releaseCommit: string | null
}

type RetentionOutcome = {
    policyDays: number
    examined: number
    deleted: number
    deletedBytes: number
    cutoffAt: string
}

export type BackupOperation = {
    id: string
    kind: BackupOperationKind
    trigger: 'manual' | 'schedule'
    actorId: string
    status: BackupOperationStatus
    stage: string
    startedAt: string
    finishedAt: string | null
    durationMs: number | null
    file: string | null
    targetDatabase: string | null
    checksumSha256: string | null
    sizeBytes: number | null
    archiveEntries: number | null
    sourceIntegrity: IntegritySummary | null
    restoredIntegrity: IntegritySummary | null
    targetRemoved: boolean | null
    retention: RetentionOutcome | null
    error: string | null
    releaseCommit: string | null
}

type BackupState = {
    schemaVersion: 'hanasand.database_backup_state.v1'
    configuration: {
        enabled: boolean
        paused: boolean
        schedule: string
        timezone: 'UTC'
        nextRunAt: string | null
        retentionDays: number
        storageTarget: string
        statePath: string
        scheduleError: string | null
        updatedAt: string
    }
    operations: BackupOperation[]
}

type BackupCandidate = {
    file: string
    path: string
    mtime: Date
    sizeBytes: number
    location: BackupLocation
    metadata: BackupMetadata | null
}

type DatabaseProbe = {
    ok: true
    database: string
    sizeBytes: number | null
} | {
    ok: false
    database: string
    error: string
}

export type BackupServiceStatus = {
    id: string
    name: string
    status: string
    error?: string | null
    dbSize?: string
    totalStorage?: string
    lastBackup?: string | null
    lastAttempt?: string | null
    lastSuccess?: string | null
    lastFailure?: string | null
    lastError?: string | null
    nextBackup?: string | null
    schedule?: string
    scheduleTimezone?: string
    scheduleEnabled?: boolean
    retention?: string | null
    retentionOutcome?: RetentionOutcome | null
    storageTarget?: string | null
    statePath?: string | null
    latestFile?: string | null
    latestSize?: string | null
    latestDuration?: string | null
    latestChecksum?: string | null
    latestVerifiedAt?: string | null
    healthCheck?: string | null
    releaseCommit?: string | null
    currentOperation?: BackupOperation | null
    operations: BackupOperation[]
}

export type BackupFileEntry = {
    service: string
    file: string
    mtime?: string | null
    size?: string
    sizeBytes?: number
    location?: BackupLocation
    checksumSha256?: string | null
    verifiedAt?: string | null
    verified: boolean
    releaseCommit?: string | null
}

const BACKUP_EXTENSIONS = ['.dump', '.backup', '.sql', '.tar', '.gz']
const DEFAULT_BACKUP_DIR = process.env.NODE_ENV === 'production' ? '/var/lib/hanasand/backups/database' : path.join(tmpdir(), 'hanasand-backups', 'database')
const DEFAULT_BACKUP_SCHEDULE = '23 2 * * *'
const DEFAULT_RETENTION_DAYS = 14
const MAX_OPERATION_HISTORY = 100
export const DATABASE_BACKUP_JOB_ID = 'api-database-backup'
const activeOperationIds = new Set<string>()
let initialization: Promise<void> | null = null

export async function collectDatabaseBackupServices(): Promise<BackupServiceStatus[]> {
    await ensureInitialized()
    const database = databaseName()
    const state = await readState()
    const probe = await probeDatabase()
    const files = filterServiceFiles(await listBackupCandidates(), database)
    const latest = files[0] || null
    const storageSize = files.reduce((sum, file) => sum + file.sizeBytes, 0)
    const operations = [...state.operations].reverse().slice(0, 30)
    const lastAttempt = operations[0] || null
    const lastSuccess = operations.find(operation => operation.status === 'succeeded') || null
    const lastFailure = operations.find(operation => ['failed', 'interrupted'].includes(operation.status)) || null
    const lastBackup = operations.find(operation => operation.kind === 'backup' && operation.status === 'succeeded') || null
    const lastRetention = operations.find(operation => operation.kind === 'backup' && operation.retention)?.retention || null
    const currentOperation = operations.find(operation => operation.status === 'running') || null
    const scheduleError = state.configuration.scheduleError
    const error = probe.ok ? scheduleError : probe.error

    return [{
        id: `${slug(database)}_database`,
        name: `${database}_database`,
        status: currentOperation ? 'Running' : error ? 'Unavailable' : latest?.metadata ? 'Healthy' : latest ? 'Needs verification' : 'Available',
        error,
        dbSize: probe.ok && probe.sizeBytes !== null ? formatBytes(probe.sizeBytes) : undefined,
        totalStorage: formatBytes(storageSize),
        lastBackup: lastBackup?.finishedAt || latest?.metadata?.createdAt || null,
        lastAttempt: lastAttempt?.startedAt || null,
        lastSuccess: lastSuccess?.finishedAt || null,
        lastFailure: lastFailure?.finishedAt || null,
        lastError: lastFailure?.error || null,
        nextBackup: state.configuration.enabled ? state.configuration.nextRunAt : null,
        schedule: state.configuration.schedule,
        scheduleTimezone: state.configuration.timezone,
        scheduleEnabled: state.configuration.enabled,
        retention: `${state.configuration.retentionDays} days`,
        retentionOutcome: lastRetention,
        storageTarget: state.configuration.storageTarget,
        statePath: state.configuration.statePath,
        latestFile: latest?.file || null,
        latestSize: latest ? formatBytes(latest.sizeBytes) : null,
        latestDuration: latest?.metadata ? formatDuration(latest.metadata.durationMs) : null,
        latestChecksum: latest?.metadata?.checksumSha256 || null,
        latestVerifiedAt: latest?.metadata?.verifiedAt || null,
        healthCheck: latest?.metadata ? 'Latest archive passed checksum and pg_restore verification' : latest ? 'Latest archive has not been verified' : 'No backup archive exists yet',
        releaseCommit: latest?.metadata?.releaseCommit || releaseCommit(),
        currentOperation,
        operations,
    }]
}

export async function listDatabaseBackupFiles(service?: string, date?: string): Promise<BackupFileEntry[]> {
    await ensureInitialized()
    const files = await listBackupCandidates()
    const normalizedService = service ? slug(service.replace(/_database$/, '')) : ''
    const normalizedDate = date ? date.trim() : ''

    return files
        .filter(file => !normalizedService || slug(file.file).includes(normalizedService))
        .filter(file => !normalizedDate || file.file.includes(normalizedDate) || file.mtime.toISOString().startsWith(normalizedDate))
        .map(file => ({
            service: serviceFromFilename(file.file),
            file: file.file,
            mtime: file.mtime.toISOString(),
            size: formatBytes(file.sizeBytes),
            sizeBytes: file.sizeBytes,
            location: file.location,
            checksumSha256: file.metadata?.checksumSha256 || null,
            verifiedAt: file.metadata?.verifiedAt || null,
            verified: Boolean(file.metadata),
            releaseCommit: file.metadata?.releaseCommit || null,
        }))
}

export async function createDatabaseBackup(options: { actorId?: string, trigger?: 'manual' | 'schedule' } = {}) {
    return runOperation('backup', options, async(operation, updateStage) => {
        const dir = backupDirectory()
        const database = databaseName()
        const file = `${slug(database)}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.dump`
        const destination = path.join(dir, file)
        const partial = `${destination}.partial`
        let renamed = false

        try {
            await updateStage('dumping')
            await runBackupCommand('pg_dump', [
                '--format=custom',
                '--no-owner',
                '--no-privileges',
                ...connectionArgs(),
                '--dbname', database,
                '--file', partial,
            ])

            await updateStage('verifying_archive')
            const archive = await inspectArchive(partial)
            const info = await stat(partial)
            if (!info.isFile() || info.size <= 0) {
                throw new BackupOperationError('Backup archive is empty and was not published.', 500)
            }
            const checksumSha256 = await checksumFile(partial)
            await rename(partial, destination)
            await chmod(destination, 0o600)
            renamed = true

            const verifiedAt = new Date().toISOString()
            const metadata: BackupMetadata = {
                schemaVersion: 'hanasand.database_backup.v1',
                file,
                database,
                createdAt: operation.startedAt,
                verifiedAt,
                checksumSha256,
                sizeBytes: info.size,
                durationMs: Date.now() - Date.parse(operation.startedAt),
                archiveEntries: archive.entries,
                sourceIntegrity: archive.integrity,
                releaseCommit: releaseCommit(),
            }
            await writeJsonAtomic(metadataPath(destination), metadata)

            await updateStage('applying_retention')
            const retention = await applyRetention(file)
            return {
                stage: 'complete',
                file,
                checksumSha256,
                sizeBytes: info.size,
                archiveEntries: archive.entries,
                sourceIntegrity: archive.integrity,
                retention,
            }
        } finally {
            if (!renamed) await unlink(partial).catch(() => undefined)
        }
    })
}

export async function verifyDatabaseBackupFile(file: string, actorId = 'system_admin') {
    return runOperation('verify', { actorId, trigger: 'manual' }, async(_operation, updateStage) => {
        const backup = await resolveBackupFile(file)
        await updateStage('verifying_archive')
        const archive = await inspectArchive(backup)
        const checksumSha256 = await checksumFile(backup)
        const info = await stat(backup)
        const existing = await readMetadata(backup)
        if (existing?.checksumSha256 && existing.checksumSha256 !== checksumSha256) {
            throw new BackupOperationError('Backup checksum does not match its persisted verification metadata.', 409)
        }

        const sourceIntegrity = existing?.sourceIntegrity || archive.integrity
        const metadata: BackupMetadata = {
            schemaVersion: 'hanasand.database_backup.v1',
            file: path.basename(backup),
            database: existing?.database || databaseName(),
            createdAt: existing?.createdAt || info.mtime.toISOString(),
            verifiedAt: new Date().toISOString(),
            checksumSha256,
            sizeBytes: info.size,
            durationMs: existing?.durationMs || 0,
            archiveEntries: archive.entries,
            sourceIntegrity,
            releaseCommit: existing?.releaseCommit || releaseCommit(),
        }
        await writeJsonAtomic(metadataPath(backup), metadata)
        return {
            stage: 'complete',
            file: path.basename(backup),
            checksumSha256,
            sizeBytes: info.size,
            archiveEntries: archive.entries,
            sourceIntegrity,
        }
    })
}

export async function restoreDatabaseBackupFile(input: {
    file: string
    targetDatabase: string
    confirmation: string
    actorId?: string
}) {
    const targetDatabase = normalizeRestoreTarget(input.targetDatabase)
    if (input.confirmation !== `RESTORE ${targetDatabase}`) {
        throw new BackupOperationError(`Confirmation must exactly match RESTORE ${targetDatabase}.`, 400)
    }
    if (targetDatabase === databaseName()) {
        throw new BackupOperationError('Restore drills cannot target the live database.', 400)
    }

    return runOperation('restore_drill', { actorId: input.actorId, trigger: 'manual', targetDatabase }, async(_operation, updateStage) => {
        const backup = await resolveBackupFile(input.file)
        const existing = await readMetadata(backup)
        let created = false
        let workError: unknown = null
        let cleanupError: unknown = null
        let archiveEntries = 0
        let checksumSha256 = ''
        let sourceIntegrity: IntegritySummary | null = null
        let restoredIntegrity: IntegritySummary | null = null

        try {
            await updateStage('verifying_archive')
            const archive = await inspectArchive(backup)
            archiveEntries = archive.entries
            checksumSha256 = await checksumFile(backup)
            if (existing?.checksumSha256 && existing.checksumSha256 !== checksumSha256) {
                throw new BackupOperationError('Backup checksum does not match its persisted verification metadata.', 409)
            }

            await updateStage('creating_isolated_database')
            await runBackupCommand('createdb', [
                ...connectionArgs(),
                '--maintenance-db', 'postgres',
                targetDatabase,
            ])
            created = true

            await updateStage('restoring')
            await runBackupCommand('pg_restore', [
                '--exit-on-error',
                '--no-owner',
                '--no-privileges',
                ...connectionArgs(),
                '--dbname', targetDatabase,
                backup,
            ])

            await updateStage('checking_integrity')
            restoredIntegrity = await queryIntegrity(targetDatabase)
            sourceIntegrity = existing?.sourceIntegrity || archive.integrity
            if (restoredIntegrity.tables !== sourceIntegrity.tables) {
                throw new BackupOperationError(`Restore drill integrity failed: expected ${sourceIntegrity.tables} user tables and restored ${restoredIntegrity.tables}.`, 500)
            }
        } catch (error) {
            workError = error
        }

        if (created) {
            try {
                await updateStage('removing_isolated_database')
            } catch (error) {
                workError ||= error
            }
            try {
                await runBackupCommand('dropdb', [
                    ...connectionArgs(),
                    '--maintenance-db', 'postgres',
                    '--if-exists',
                    '--force',
                    targetDatabase,
                ])
            } catch (error) {
                cleanupError = error
            }
        }

        if (workError) throw workError
        if (cleanupError) throw new BackupOperationError('Restore drill completed but the isolated target database could not be removed.', 500)
        if (!restoredIntegrity) throw new BackupOperationError('Restore drill did not produce integrity evidence.', 500)

        const info = await stat(backup)
        return {
            stage: 'complete',
            file: path.basename(backup),
            checksumSha256,
            sizeBytes: info.size,
            archiveEntries,
            sourceIntegrity,
            restoredIntegrity,
            targetRemoved: true,
        }
    })
}

export async function runDueDatabaseBackup(now = new Date()) {
    await ensureInitialized()
    const state = await readState()
    const nextRunAt = state.configuration.nextRunAt ? Date.parse(state.configuration.nextRunAt) : Number.NaN
    if (!state.configuration.enabled || !Number.isFinite(nextRunAt) || nextRunAt > now.getTime()) return null

    let advanceSchedule = true
    try {
        return await createDatabaseBackup({ actorId: 'scheduler', trigger: 'schedule' })
    } catch (error) {
        if (error instanceof BackupOperationError && error.statusCode === 409) advanceSchedule = false
        throw error
    } finally {
        if (advanceSchedule) {
            const latest = await readState()
            latest.configuration.nextRunAt = computeNextBackupRun(latest.configuration.schedule, now).toISOString()
            latest.configuration.updatedAt = new Date().toISOString()
            await writeState(latest)
        }
    }
}

export async function setDatabaseBackupSchedulePaused(paused: boolean) {
    await ensureInitialized()
    const state = await readState()
    state.configuration.paused = paused
    state.configuration.enabled = scheduleEnabled() && !paused && !state.configuration.scheduleError
    if (state.configuration.enabled && (!state.configuration.nextRunAt || Date.parse(state.configuration.nextRunAt) <= Date.now())) {
        state.configuration.nextRunAt = computeNextBackupRun(state.configuration.schedule).toISOString()
    }
    state.configuration.updatedAt = new Date().toISOString()
    await writeState(state)
}

export function computeNextBackupRun(schedule: string, after = new Date()) {
    const parsed = parseDailySchedule(schedule)
    if (!parsed) throw new BackupOperationError('Backup schedule must be a fixed UTC minute and hour, for example 23 2 * * *.', 500)
    const next = new Date(after.getTime())
    next.setUTCSeconds(0, 0)
    next.setUTCHours(parsed.hour, parsed.minute, 0, 0)
    if (next.getTime() <= after.getTime()) next.setUTCDate(next.getUTCDate() + 1)
    return next
}

export class BackupOperationError extends Error {
    statusCode: number

    constructor(message: string, statusCode = 500) {
        super(message)
        this.statusCode = statusCode
    }
}

export function sanitizeBackupError(error: unknown) {
    if (error instanceof BackupOperationError) return error.message
    const err = error as { code?: string, message?: string }
    const code = err?.code || ''
    const message = err?.message || String(error || '')
    const lower = message.toLowerCase()

    if (code === '28P01' || lower.includes('password authentication failed')) {
        return 'The backup service cannot authenticate to PostgreSQL. Check DB_USER and DB_PASSWORD for the API service.'
    }
    if (['pg_dump', 'pg_restore', 'psql', 'createdb', 'dropdb'].some(command => lower.includes(command))
        && (lower.includes('not found') || lower.includes('enoent') || lower.includes('cannot find'))) {
        return 'The backup service cannot find PostgreSQL client tools in the API runtime.'
    }
    if (lower.includes('missing essential environment variables') || lower.includes('db_password') || lower.includes('db_host')) {
        return 'The backup service is missing database connection configuration. Set DB_HOST, DB_USER, and DB_PASSWORD for the API service.'
    }
    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', '08000', '08001', '08003', '08006'].includes(code)
        || lower.includes('timeout')
        || lower.includes('connection refused')
        || lower.includes('getaddrinfo')) {
        return 'The backup service cannot reach PostgreSQL. Check DB_HOST, DB_PORT, and network access from the API service.'
    }
    if (code === '42501' || lower.includes('permission denied')) {
        return 'The backup service lacks permission for the requested database operation.'
    }
    return 'The backup service needs attention. Check API logs for the database backup operation.'
}

async function runOperation(
    kind: BackupOperationKind,
    input: { actorId?: string, trigger?: 'manual' | 'schedule', targetDatabase?: string },
    work: (operation: BackupOperation, updateStage: (stage: string) => Promise<void>) => Promise<Partial<BackupOperation>>,
) {
    await ensureInitialized()
    const operation: BackupOperation = {
        id: randomUUID(),
        kind,
        trigger: input.trigger || 'manual',
        actorId: input.actorId || 'system_admin',
        status: 'running',
        stage: 'starting',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        durationMs: null,
        file: null,
        targetDatabase: input.targetDatabase || null,
        checksumSha256: null,
        sizeBytes: null,
        archiveEntries: null,
        sourceIntegrity: null,
        restoredIntegrity: null,
        targetRemoved: null,
        retention: null,
        error: null,
        releaseCommit: releaseCommit(),
    }
    const releaseLock = await acquireOperationLock(operation)
    try {
        const state = await readState()
        state.operations.push(operation)
        state.operations = state.operations.slice(-MAX_OPERATION_HISTORY)
        await writeState(state)
        const patch = await work(operation, async(stage) => {
            await patchOperation(operation.id, { stage })
        })
        const finishedAt = new Date().toISOString()
        return await patchOperation(operation.id, {
            ...patch,
            status: 'succeeded',
            stage: 'complete',
            finishedAt,
            durationMs: Date.parse(finishedAt) - Date.parse(operation.startedAt),
            error: null,
        })
    } catch (error) {
        const finishedAt = new Date().toISOString()
        await patchOperation(operation.id, {
            status: 'failed',
            stage: 'failed',
            finishedAt,
            durationMs: Date.parse(finishedAt) - Date.parse(operation.startedAt),
            error: sanitizeBackupError(error),
        }).catch(() => undefined)
        if (error instanceof BackupOperationError) throw error
        throw new BackupOperationError(sanitizeBackupError(error), 500)
    } finally {
        await releaseLock()
    }
}

async function patchOperation(id: string, patch: Partial<BackupOperation>) {
    const state = await readState()
    const index = state.operations.findIndex(operation => operation.id === id)
    if (index < 0) throw new BackupOperationError('Backup operation audit record was not found.', 500)
    state.operations[index] = { ...state.operations[index], ...patch }
    await writeState(state)
    return state.operations[index]
}

async function acquireOperationLock(operation: BackupOperation) {
    const lock = lockPath()
    let handle
    let created = false
    try {
        handle = await open(lock, 'wx', 0o600)
        created = true
        await handle.writeFile(JSON.stringify({ id: operation.id, kind: operation.kind, startedAt: operation.startedAt, pid: process.pid }))
        await handle.close()
    } catch (error) {
        await handle?.close().catch(() => undefined)
        if (created) await unlink(lock).catch(() => undefined)
        if (isCode(error, 'EEXIST')) {
            throw new BackupOperationError('Another backup, verification, or restore operation is already running.', 409)
        }
        throw error
    }
    activeOperationIds.add(operation.id)
    return async() => {
        activeOperationIds.delete(operation.id)
        await unlink(lock).catch(error => {
            if (!isCode(error, 'ENOENT')) throw error
        })
    }
}

async function ensureInitialized() {
    initialization ||= initializeState()
    return initialization
}

async function initializeState() {
    await mkdir(backupDirectory(), { recursive: true, mode: 0o700 })
    await chmod(backupDirectory(), 0o700)
    const state = await readStateFile()
    const now = new Date().toISOString()
    for (const operation of state.operations) {
        if (operation.status === 'running' && !activeOperationIds.has(operation.id)) {
            operation.status = 'interrupted'
            operation.stage = 'interrupted'
            operation.finishedAt = now
            operation.durationMs = Math.max(0, Date.parse(now) - Date.parse(operation.startedAt))
            operation.error = 'The API restarted before this operation reached a terminal state.'
        }
    }
    await unlink(lockPath()).catch(error => {
        if (!isCode(error, 'ENOENT')) throw error
    })
    syncConfiguration(state)
    await writeState(state)
}

async function readState() {
    return readStateFile()
}

async function readStateFile(): Promise<BackupState> {
    try {
        const parsed = JSON.parse(await readFile(statePath(), 'utf8')) as Partial<BackupState>
        if (parsed.schemaVersion !== 'hanasand.database_backup_state.v1' || !Array.isArray(parsed.operations) || !parsed.configuration) {
            throw new BackupOperationError('Backup operation state is invalid; the audit ledger was not overwritten.', 500)
        }
        return parsed as BackupState
    } catch (error) {
        if (!isCode(error, 'ENOENT')) throw error
        return defaultState()
    }
}

function defaultState(): BackupState {
    const schedule = configuredSchedule()
    const scheduleError = parseDailySchedule(schedule) ? null : 'Backup schedule must be a fixed UTC minute and hour, for example 23 2 * * *.'
    return {
        schemaVersion: 'hanasand.database_backup_state.v1',
        configuration: {
            enabled: scheduleEnabled() && !scheduleError,
            paused: false,
            schedule,
            timezone: 'UTC',
            nextRunAt: scheduleError ? null : computeNextBackupRun(schedule).toISOString(),
            retentionDays: configuredRetentionDays(),
            storageTarget: path.resolve(backupDirectory()),
            statePath: path.resolve(statePath()),
            scheduleError,
            updatedAt: new Date().toISOString(),
        },
        operations: [],
    }
}

function syncConfiguration(state: BackupState) {
    const schedule = configuredSchedule()
    const scheduleError = parseDailySchedule(schedule) ? null : 'Backup schedule must be a fixed UTC minute and hour, for example 23 2 * * *.'
    const changed = state.configuration.schedule !== schedule
    const paused = Boolean(state.configuration.paused)
    state.configuration = {
        enabled: scheduleEnabled() && !paused && !scheduleError,
        paused,
        schedule,
        timezone: 'UTC',
        nextRunAt: scheduleError ? null : changed || !state.configuration.nextRunAt ? computeNextBackupRun(schedule).toISOString() : state.configuration.nextRunAt,
        retentionDays: configuredRetentionDays(),
        storageTarget: path.resolve(backupDirectory()),
        statePath: path.resolve(statePath()),
        scheduleError,
        updatedAt: new Date().toISOString(),
    }
}

async function writeState(state: BackupState) {
    await writeJsonAtomic(statePath(), state)
}

async function writeJsonAtomic(file: string, value: unknown) {
    await mkdir(path.dirname(file), { recursive: true })
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, file)
    await chmod(file, 0o600)
}

async function probeDatabase(): Promise<DatabaseProbe> {
    const database = databaseName()
    try {
        const { queryOnce } = await import('#db')
        const result = await queryOnce('SELECT current_database() AS database, pg_database_size(current_database())::text AS size_bytes')
        const row = result.rows[0] as { database?: string, size_bytes?: string | number | null } | undefined
        return { ok: true, database: row?.database || database, sizeBytes: toNumber(row?.size_bytes) }
    } catch (error) {
        return { ok: false, database, error: sanitizeBackupError(error) }
    }
}

async function listBackupCandidates() {
    const dir = backupDirectory()
    const entries = await readdir(dir, { withFileTypes: true }).catch(error => {
        if (isCode(error, 'ENOENT')) return []
        throw error
    })
    const files = await Promise.all(entries
        .filter(entry => entry.isFile() && BACKUP_EXTENSIONS.some(extension => entry.name.toLowerCase().endsWith(extension)))
        .map(async(entry): Promise<BackupCandidate | null> => {
            const filePath = path.join(dir, entry.name)
            try {
                const info = await stat(filePath)
                return {
                    file: entry.name,
                    path: filePath,
                    mtime: info.mtime,
                    sizeBytes: info.size,
                    location: 'local',
                    metadata: await readMetadata(filePath),
                }
            } catch {
                return null
            }
        }))
    return files.filter((file): file is BackupCandidate => Boolean(file)).sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
}

async function readMetadata(backup: string): Promise<BackupMetadata | null> {
    try {
        const parsed = JSON.parse(await readFile(metadataPath(backup), 'utf8')) as BackupMetadata
        return parsed.schemaVersion === 'hanasand.database_backup.v1' && parsed.file === path.basename(backup) ? parsed : null
    } catch {
        return null
    }
}

async function resolveBackupFile(file: string) {
    const basename = path.basename(file)
    if (basename !== file || !BACKUP_EXTENSIONS.some(extension => basename.toLowerCase().endsWith(extension))) {
        throw new BackupOperationError('Restore file must be a backup filename from the configured backup directory.', 400)
    }
    const fullPath = path.join(backupDirectory(), basename)
    const info = await stat(fullPath).catch(() => null)
    if (!info?.isFile()) throw new BackupOperationError('Backup file was not found in the configured backup directory.', 404)
    return fullPath
}

async function inspectArchive(file: string) {
    const output = await runBackupCommand('pg_restore', ['--list', file])
    const lines = output.split('\n')
    const entries = lines.filter(line => line.trim() && !line.trim().startsWith(';')).length
    if (!entries) throw new BackupOperationError('Backup archive contains no restorable entries.', 500)
    const tableLines = lines.filter(line => /\bTABLE\b/.test(line) && !/TABLE DATA/.test(line))
    const schemas = new Set(tableLines.map(line => {
        const fields = line.trim().split(/\s+/)
        return fields[fields.indexOf('TABLE') + 1]
    }).filter(Boolean))
    return {
        entries,
        integrity: { schemas: schemas.size, tables: tableLines.length, estimatedRows: 0 },
    }
}

async function queryIntegrity(database: string): Promise<IntegritySummary> {
    const sql = 'SELECT json_build_object(\'schemas\', COUNT(DISTINCT schemaname), \'tables\', COUNT(*), \'estimatedRows\', COALESCE(SUM(n_live_tup), 0))::text FROM pg_stat_user_tables'
    const output = await runBackupCommand('psql', [
        ...connectionArgs(),
        '--dbname', database,
        '--no-align',
        '--tuples-only',
        '--set', 'ON_ERROR_STOP=1',
        '--command', sql,
    ])
    const line = output.split('\n').map(value => value.trim()).find(Boolean)
    if (!line) throw new BackupOperationError('Database integrity query returned no evidence.', 500)
    try {
        const parsed = JSON.parse(line) as Record<string, unknown>
        return {
            schemas: Number(parsed.schemas || 0),
            tables: Number(parsed.tables || 0),
            estimatedRows: Number(parsed.estimatedRows || 0),
        }
    } catch {
        throw new BackupOperationError('Database integrity query returned invalid evidence.', 500)
    }
}

async function checksumFile(file: string) {
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(file)) hash.update(chunk)
    return hash.digest('hex')
}

async function applyRetention(currentFile: string): Promise<RetentionOutcome> {
    const retentionDays = configuredRetentionDays()
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    const files = await listBackupCandidates()
    let deleted = 0
    let deletedBytes = 0
    for (const file of files) {
        if (file.file === currentFile || file.mtime >= cutoff) continue
        await unlink(file.path)
        await unlink(metadataPath(file.path)).catch(error => {
            if (!isCode(error, 'ENOENT')) throw error
        })
        deleted += 1
        deletedBytes += file.sizeBytes
    }
    return {
        policyDays: retentionDays,
        examined: files.length,
        deleted,
        deletedBytes,
        cutoffAt: cutoff.toISOString(),
    }
}

function runBackupCommand(command: string, args: string[]) {
    return new Promise<string>((resolve, reject) => {
        const child = spawn(command, args, {
            env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || '' },
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        const output: string[] = []
        const errors: string[] = []
        let settled = false
        child.stdout.on('data', chunk => output.push(String(chunk)))
        child.stderr.on('data', chunk => errors.push(String(chunk)))
        child.on('error', error => {
            if (settled) return
            settled = true
            reject(new BackupOperationError(sanitizeBackupError(error), 500))
        })
        child.on('close', code => {
            if (settled) return
            settled = true
            if (code === 0) resolve(output.join(''))
            else reject(new BackupOperationError(sanitizeBackupError(errors.join('\n') || `${command} exited with code ${code}`), 500))
        })
    })
}

function connectionArgs() {
    return [
        '--host', process.env.DB_HOST || '127.0.0.1',
        '--port', process.env.DB_PORT || '5432',
        '--username', process.env.DB_USER || 'hanasand',
    ]
}

function normalizeRestoreTarget(value: string) {
    const normalized = String(value || '').trim().toLowerCase()
    if (!/^restore_drill_[a-z0-9_]{1,48}$/.test(normalized)) {
        throw new BackupOperationError('Restore target must start with restore_drill_ and contain only lowercase letters, numbers, or underscores.', 400)
    }
    return normalized
}

function backupDirectory() {
    return process.env.DB_BACKUP_DIR || process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR
}

function statePath() {
    return process.env.DB_BACKUP_STATE_PATH || path.join(backupDirectory(), '.backup-state.json')
}

function lockPath() {
    return process.env.DB_BACKUP_LOCK_PATH || path.join(backupDirectory(), '.operation.lock')
}

function metadataPath(backup: string) {
    return `${backup}.metadata.json`
}

function databaseName() {
    return process.env.DB || 'hanasand'
}

function configuredSchedule() {
    return String(process.env.DB_BACKUP_SCHEDULE || DEFAULT_BACKUP_SCHEDULE).trim().replace(/\s+/g, ' ')
}

function scheduleEnabled() {
    return process.env.DB_BACKUP_ENABLED !== 'false'
}

function configuredRetentionDays() {
    const value = Number(process.env.DB_BACKUP_RETENTION_DAYS || process.env.BACKUP_RETENTION_DAYS || DEFAULT_RETENTION_DAYS)
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_RETENTION_DAYS
}

function parseDailySchedule(schedule: string) {
    const match = schedule.match(/^(\d{1,2}) (\d{1,2}) \* \* \*$/)
    if (!match) return null
    const minute = Number(match[1])
    const hour = Number(match[2])
    return minute >= 0 && minute <= 59 && hour >= 0 && hour <= 23 ? { minute, hour } : null
}

function releaseCommit() {
    const value = String(process.env.HANASAND_RELEASE_COMMIT || '').trim()
    return value && value !== 'unknown' ? value : null
}

function filterServiceFiles(files: BackupCandidate[], database: string) {
    const normalized = slug(database)
    return files.filter(file => slug(file.file).includes(normalized))
}

function serviceFromFilename(file: string) {
    return `${slug(file.split('-')[0] || databaseName())}_database`
}

function formatBytes(value: number) {
    if (!Number.isFinite(value) || value <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let amount = value
    let unit = 0
    while (amount >= 1024 && unit < units.length - 1) {
        amount /= 1024
        unit += 1
    }
    return `${amount.toFixed(amount >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatDuration(ms: number) {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.round(ms / 60000)}m`
}

function toNumber(value: string | number | null | undefined) {
    if (value === null || value === undefined) return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

function isCode(error: unknown, code: string) {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === code)
}

function slug(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}
