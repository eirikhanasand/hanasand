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
        databases: Array<{ name: string, sizeBytes: number | null, connections: number | null, replica?: boolean, memory?: boolean, tableCount?: number | null, tables?: Array<{ schema: string, name: string, sizeBytes: number, estimatedRows: number, columns: string[], lastWriteObservedAt: string | null }> }>
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

let redisWrites: { at: number, values: Record<string, number> } = { at: 0, values: {} }
export async function readRedisWrites() {
    if (Date.now() - redisWrites.at < 5000) return redisWrites.values
    try {
        const path = process.env.DB_STORAGE_METRICS_FILE || join(dirname(process.env.HOST_METRICS_FILE || '/host/var/lib/hanasand/metrics/host.json'), 'databases.json')
        const values = JSON.parse(await readFile(join(dirname(path), 'database-redis-writes.json'), 'utf8')) as Record<string, number>
        redisWrites = { at: Date.now(), values }
    } catch { redisWrites = { at: Date.now(), values: {} } }
    return redisWrites.values
}
