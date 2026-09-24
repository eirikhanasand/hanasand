import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export type DatabaseStorage = {
    sampledAt: string
    host: string
    stale?: boolean
    disk: { totalBytes: number, availableBytes: number, dailyGrowthBytes: number | null, daysUntilFull: number | null, sampleSeconds: number }
    instances: Array<{
        id: string
        engine: string
        status: 'healthy' | 'unhealthy' | 'unavailable'
        databases: Array<{ name: string, sizeBytes: number, connections: number | null, replica?: boolean, memory?: boolean }>
    }>
}

export async function readDatabaseStorage(): Promise<DatabaseStorage | null> {
    try {
        const path = process.env.DB_STORAGE_METRICS_FILE || join(dirname(process.env.HOST_METRICS_FILE || '/host/var/lib/hanasand/metrics/host.json'), 'databases.json')
        const result = JSON.parse(await readFile(path, 'utf8')) as DatabaseStorage
        if (!Array.isArray(result.instances) || !Number.isFinite(result.disk?.availableBytes) || !Number.isFinite(Date.parse(result.sampledAt))) return null
        const age = Date.now() - Date.parse(result.sampledAt)
        return { ...result, stale: age > 180_000 || age < -5000 }
    } catch {
        return null
    }
}
