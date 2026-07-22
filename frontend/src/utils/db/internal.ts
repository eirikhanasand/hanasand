'use server'

import { requestService } from '@/utils/monitoring/serviceApi'

export type DatabaseOverview = {
    status: 'healthy' | 'unavailable'
    generatedAt: string
    clusterCount: number | null
    databaseCount: number | null
    totalSizeBytes: number | null
    activeQueries: number | null
    averageQuerySeconds: number | null
    longRunningThresholdSeconds: number
    longestQuery?: DatabaseQueryActivity | null
    queries: DatabaseQueryActivity[]
    health: {
        message: string
        detail?: string
        category?: 'auth' | 'network' | 'permission' | 'unknown'
    }
    clusters: Array<{
        id: string
        name: string
        engine?: string
        version?: string
        host?: string
        activeQueries: number
        totalSizeBytes: number
        databaseCount: number
        error?: string | null
        databases: Array<{
            name: string
            sizeBytes: number
            tableCount: number | null
            activeConnections?: number
            tables?: Array<{ schema: string, name: string, estimatedRows: number | null }>
        }>
    }>
}

export type DatabaseQueryActivity = {
    database: string | null
    user: string | null
    state: string | null
    durationSeconds: number | null
    waitEventType: string | null
    waitEvent: string | null
    query: string | null
    isLongRunning: boolean
}

export type BackupService = {
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
    retentionOutcome?: BackupRetentionOutcome | null
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

export type BackupRetentionOutcome = {
    policyDays: number
    examined: number
    deleted: number
    deletedBytes: number
    cutoffAt: string
}

export type BackupIntegrity = {
    schemas: number
    tables: number
    estimatedRows: number
}

export type BackupOperation = {
    id: string
    kind: 'backup' | 'verify' | 'restore_drill'
    trigger: 'manual' | 'schedule'
    actorId: string
    status: 'running' | 'succeeded' | 'failed' | 'interrupted'
    stage: string
    startedAt: string
    finishedAt: string | null
    durationMs: number | null
    file: string | null
    targetDatabase: string | null
    checksumSha256: string | null
    sizeBytes: number | null
    archiveEntries: number | null
    sourceIntegrity: BackupIntegrity | null
    restoredIntegrity: BackupIntegrity | null
    targetRemoved: boolean | null
    retention: BackupRetentionOutcome | null
    error: string | null
    releaseCommit: string | null
}

export type BackupFile = {
    service: string
    file: string
    mtime?: string | null
    size?: string
    sizeBytes?: number
    location?: 'local' | 'remote'
    checksumSha256?: string | null
    verifiedAt?: string | null
    verified: boolean
    releaseCommit?: string | null
}

export type DatabaseQueryResult = {
    rows: Record<string, unknown>[]
    rowCount: number
    fields: string[]
}

export type DatabaseHealth = {
    ok: boolean
    database?: string
    checked_at?: string
    message?: string
}

export async function getDatabaseOverview() {
    return await requestService<DatabaseOverview>('internal', 'db')
}

export async function getDatabaseHealth() {
    return await requestService<DatabaseHealth>('internal', 'db/health')
}

export async function runDatabaseSql(sql: string) {
    return await requestService<DatabaseQueryResult>('internal', 'db/query', {
        method: 'POST',
        body: JSON.stringify({ sql }),
    })
}

export async function getDatabaseRows(schema: string, table: string, limit: number) {
    const params = new URLSearchParams({ schema, table, limit: String(limit) })
    return await requestService<DatabaseQueryResult>('internal', `db/rows?${params.toString()}`)
}

export async function getBackupServices() {
    return await requestService<BackupService[]>('internal', 'backup')
}

export async function getBackupFiles(service?: string, date?: string) {
    const params = new URLSearchParams()
    if (service) params.set('service', service)
    if (date) params.set('date', date)
    const suffix = params.toString()
    return await requestService<BackupFile[]>('internal', `backup/files${suffix ? `?${suffix}` : ''}`)
}

export async function triggerDatabaseBackup() {
    return await requestService<{ message: string, operation: BackupOperation }>('internal', 'backup', {
        method: 'POST',
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10 * 60 * 1000),
    })
}

export async function verifyDatabaseBackup(file: string) {
    return await requestService<{ message: string, operation: BackupOperation }>('internal', 'backup/verify', {
        method: 'POST',
        body: JSON.stringify({ file }),
        signal: AbortSignal.timeout(10 * 60 * 1000),
    })
}

export async function restoreDatabaseBackup(file: string, targetDatabase: string, confirmation: string) {
    return await requestService<{ message: string, operation: BackupOperation }>('internal', 'backup/restore', {
        method: 'POST',
        body: JSON.stringify({ file, targetDatabase, confirmation }),
        signal: AbortSignal.timeout(10 * 60 * 1000),
    })
}
