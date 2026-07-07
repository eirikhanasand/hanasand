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
    nextBackup?: string | null
    retention?: string | null
    storageTarget?: string | null
    latestFile?: string | null
    latestSize?: string | null
    latestDuration?: string | null
    healthCheck?: string | null
}

export type BackupFile = {
    service: string
    file: string
    mtime?: string | null
    size?: string
    location?: 'local' | 'remote'
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
    return await requestService<{ message: string }>('internal', 'backup', {
        method: 'POST',
        body: JSON.stringify({}),
    })
}

export async function restoreDatabaseBackup(service: string, file: string) {
    return await requestService<{ message: string }>('internal', 'backup/restore', {
        method: 'POST',
        body: JSON.stringify({ service, file }),
    })
}
