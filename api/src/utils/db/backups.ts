import { spawn } from 'node:child_process'
import { mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

type BackupLocation = 'local' | 'remote'

type BackupCandidate = {
    file: string
    path: string
    mtime: Date
    sizeBytes: number
    location: BackupLocation
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
    nextBackup?: string | null
    retention?: string | null
    storageTarget?: string | null
    latestFile?: string | null
    latestSize?: string | null
    latestDuration?: string | null
    healthCheck?: string | null
}

export type BackupFileEntry = {
    service: string
    file: string
    mtime?: string | null
    size?: string
    location?: BackupLocation
}

type BackupCommandResult = {
    file: string
    size: string
    duration: string
}

const BACKUP_EXTENSIONS = ['.dump', '.backup', '.sql', '.tar', '.gz']
const DEFAULT_BACKUP_DIR = '/var/backups/hanasand/database'

export async function collectDatabaseBackupServices(): Promise<BackupServiceStatus[]> {
    const database = databaseName()
    const serviceId = `${slug(database)}_database`
    const storageTarget = backupStorageTarget()
    const probe = await probeDatabase()
    const files = await listBackupCandidates()
    const serviceFiles = filterServiceFiles(files, database)
    const latest = serviceFiles[0] || null
    const storageSize = serviceFiles.reduce((sum, file) => sum + file.sizeBytes, 0)

    if (!probe.ok) {
        return [{
            id: serviceId,
            name: `${database}_database`,
            status: 'Unavailable',
            error: probe.error,
            lastBackup: latest?.mtime.toISOString() || null,
            nextBackup: nextBackupFromSchedule(),
            retention: backupRetention(),
            storageTarget,
            latestFile: latest?.file || null,
            latestSize: latest ? formatBytes(latest.sizeBytes) : null,
            totalStorage: storageSize ? formatBytes(storageSize) : undefined,
            healthCheck: 'Database connection failed',
        }]
    }

    return [{
        id: serviceId,
        name: `${database}_database`,
        status: latest ? 'Healthy' : 'Available',
        error: null,
        dbSize: probe.sizeBytes === null ? undefined : formatBytes(probe.sizeBytes),
        totalStorage: storageSize ? formatBytes(storageSize) : '0 B',
        lastBackup: latest?.mtime.toISOString() || null,
        nextBackup: nextBackupFromSchedule(),
        retention: backupRetention(),
        storageTarget,
        latestFile: latest?.file || null,
        latestSize: latest ? formatBytes(latest.sizeBytes) : null,
        latestDuration: latest ? durationFromFilename(latest.file) : null,
        healthCheck: latest ? 'Latest backup file is indexed' : 'No backup file indexed yet',
    }]
}

export async function listDatabaseBackupFiles(service?: string, date?: string): Promise<BackupFileEntry[]> {
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
            location: file.location,
        }))
}

export async function createDatabaseBackup(): Promise<BackupCommandResult> {
    const startedAt = Date.now()
    const dir = backupDirectory()
    await mkdir(dir, { recursive: true })

    const database = databaseName()
    const file = `${slug(database)}-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`
    const destination = path.join(dir, file)

    await runBackupCommand('pg_dump', [
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '--host', process.env.DB_HOST || '127.0.0.1',
        '--port', process.env.DB_PORT || '5432',
        '--username', process.env.DB_USER || 'hanasand',
        '--dbname', database,
        '--file', destination,
    ])

    const info = await stat(destination)
    return {
        file,
        size: formatBytes(info.size),
        duration: formatDuration(Date.now() - startedAt),
    }
}

export async function restoreDatabaseBackupFile(file: string): Promise<{ message: string }> {
    if (process.env.DB_RESTORE_ENABLED !== 'true') {
        throw new BackupOperationError('Restore is disabled until DB_RESTORE_ENABLED=true is set for the API service.', 409)
    }

    const backup = await resolveBackupFile(file)
    await runBackupCommand('pg_restore', [
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        '--host', process.env.DB_HOST || '127.0.0.1',
        '--port', process.env.DB_PORT || '5432',
        '--username', process.env.DB_USER || 'hanasand',
        '--dbname', databaseName(),
        backup,
    ])

    return { message: `Restore completed from ${path.basename(backup)}.` }
}

export class BackupOperationError extends Error {
    statusCode: number

    constructor(message: string, statusCode = 500) {
        super(message)
        this.statusCode = statusCode
    }
}

export function sanitizeBackupError(error: unknown) {
    const err = error as { code?: string, message?: string }
    const code = err?.code || ''
    const message = err?.message || String(error || '')
    const lower = message.toLowerCase()

    if (code === '28P01' || lower.includes('password authentication failed')) {
        return 'The backup service cannot authenticate to PostgreSQL. Check DB_USER and DB_PASSWORD for the API service.'
    }

    if (lower.includes('pg_dump') && (lower.includes('not found') || lower.includes('enoent') || lower.includes('cannot find'))) {
        return 'The backup service cannot find pg_dump. Install PostgreSQL client tools in the API runtime.'
    }

    if (lower.includes('pg_restore') && (lower.includes('not found') || lower.includes('enoent') || lower.includes('cannot find'))) {
        return 'The backup service cannot find pg_restore. Install PostgreSQL client tools in the API runtime.'
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

    if (lower.includes('backup storage directory')) {
        return message
    }

    if (lower.includes('restore is disabled')) {
        return message
    }

    return 'The backup service needs attention. Check API logs for the database backup operation.'
}

async function probeDatabase(): Promise<DatabaseProbe> {
    const database = databaseName()
    try {
        const { queryOnce } = await import('#db')
        const result = await queryOnce('SELECT current_database() AS database, pg_database_size(current_database())::text AS size_bytes')
        const row = result.rows[0] as { database?: string, size_bytes?: string | number | null } | undefined
        return {
            ok: true,
            database: row?.database || database,
            sizeBytes: toNumber(row?.size_bytes),
        }
    } catch (error) {
        return {
            ok: false,
            database,
            error: sanitizeBackupError(error),
        }
    }
}

async function listBackupCandidates() {
    const dir = backupDirectory()
    try {
        const entries = await readdir(dir, { withFileTypes: true })
        const files = await Promise.all(entries
            .filter(entry => entry.isFile() && BACKUP_EXTENSIONS.some(ext => entry.name.toLowerCase().endsWith(ext)))
            .map(async (entry): Promise<BackupCandidate | null> => {
                const filePath = path.join(dir, entry.name)
                try {
                    const info = await stat(filePath)
                    return {
                        file: entry.name,
                        path: filePath,
                        mtime: info.mtime,
                        sizeBytes: info.size,
                        location: 'local',
                    }
                } catch {
                    return null
                }
            }))
        return files
            .filter((file): file is BackupCandidate => Boolean(file))
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    } catch {
        return []
    }
}

async function resolveBackupFile(file: string) {
    const basename = path.basename(file)
    if (basename !== file) {
        throw new BackupOperationError('Restore file must be a backup filename from the configured backup directory.', 400)
    }

    const fullPath = path.join(backupDirectory(), basename)
    const info = await stat(fullPath).catch(() => null)
    if (!info?.isFile()) {
        throw new BackupOperationError('Restore file was not found in the configured backup directory.', 404)
    }

    return fullPath
}

function runBackupCommand(command: string, args: string[]) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, {
            env: {
                ...process.env,
                PGPASSWORD: process.env.DB_PASSWORD || '',
            },
            stdio: ['ignore', 'ignore', 'pipe'],
        })
        const errors: string[] = []

        child.stderr.on('data', chunk => {
            errors.push(String(chunk))
        })
        child.on('error', error => {
            reject(new BackupOperationError(sanitizeBackupError(error), 500))
        })
        child.on('close', code => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new BackupOperationError(sanitizeBackupError(errors.join('\n') || `${command} exited with code ${code}`), 500))
        })
    })
}

function backupDirectory() {
    return process.env.DB_BACKUP_DIR || process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR
}

function backupStorageTarget() {
    return process.env.DB_BACKUP_STORAGE_TARGET
        || process.env.BACKUP_STORAGE_TARGET
        || process.env.S3_BACKUP_BUCKET
        || backupDirectory()
}

function backupRetention() {
    if (process.env.DB_BACKUP_RETENTION) return process.env.DB_BACKUP_RETENTION
    if (process.env.DB_BACKUP_RETENTION_DAYS) return `${process.env.DB_BACKUP_RETENTION_DAYS} days`
    if (process.env.BACKUP_RETENTION_DAYS) return `${process.env.BACKUP_RETENTION_DAYS} days`
    return 'Not configured'
}

function databaseName() {
    return process.env.DB || 'hanasand'
}

function nextBackupFromSchedule() {
    return process.env.DB_BACKUP_NEXT_AT || process.env.BACKUP_NEXT_AT || process.env.DB_BACKUP_SCHEDULE || process.env.BACKUP_SCHEDULE || null
}

function filterServiceFiles(files: BackupCandidate[], database: string) {
    const normalized = slug(database)
    const matching = files.filter(file => slug(file.file).includes(normalized))
    return matching.length ? matching : files
}

function serviceFromFilename(file: string) {
    const first = file.split('-')[0] || databaseName()
    return `${slug(first)}_database`
}

function durationFromFilename(file: string) {
    const match = file.match(/(?:duration|took)-([0-9]+(?:ms|s|m))/i)
    return match?.[1] || null
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
    const precision = amount >= 10 || unit === 0 ? 0 : 1
    return `${amount.toFixed(precision)} ${units[unit]}`
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

function slug(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}
