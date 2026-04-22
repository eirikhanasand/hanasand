'use server'

import { requestService } from '@/utils/monitoring/serviceApi'

export type DatabaseOverview = {
    generatedAt: string
    clusterCount: number
    databaseCount: number
    totalSizeBytes: number
    activeQueries: number
    averageQuerySeconds?: number | null
    longestQuery?: {
        query?: string
        durationSeconds?: number | null
        database?: string
        state?: string
    } | null
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
            tableCount: number
            activeConnections?: number
        }>
    }>
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
}

export type BackupFile = {
    service: string
    file: string
    mtime?: string | null
    size?: string
    location?: 'local' | 'remote'
}

export async function getDatabaseOverview() {
    return await requestService<DatabaseOverview>('internal', 'db')
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
