export type BackgroundJobRuntime = {
    id: string
    running: boolean
    runCount: number
    failureCount: number
    lastRunAt: string | null
    lastSuccessAt: string | null
    lastFinishedAt: string | null
    lastError: string | null
    averageRuntimeMs: number | null
    currentRunStartedAt: string | null
    logExcerpt: string | null
}

const runtime = new Map<string, BackgroundJobRuntime>()

export async function runTrackedBackgroundJob<T>(id: string, work: () => Promise<T> | T): Promise<T> {
    const record = ensureRecord(id)
    const startedAt = Date.now()
    record.running = true
    record.lastRunAt = new Date(startedAt).toISOString()
    record.currentRunStartedAt = record.lastRunAt
    record.lastError = null

    try {
        const result = await work()
        const finishedAt = new Date().toISOString()
        const durationMs = Date.now() - startedAt
        record.runCount += 1
        record.lastSuccessAt = finishedAt
        record.lastFinishedAt = finishedAt
        record.averageRuntimeMs = rollingAverage(record.averageRuntimeMs, durationMs, record.runCount)
        record.logExcerpt = `Completed in ${durationMs}ms.`
        return result
    } catch (error) {
        const finishedAt = new Date().toISOString()
        const durationMs = Date.now() - startedAt
        record.runCount += 1
        record.failureCount += 1
        record.lastFinishedAt = finishedAt
        record.lastError = error instanceof Error ? error.message : String(error)
        record.averageRuntimeMs = rollingAverage(record.averageRuntimeMs, durationMs, record.runCount)
        record.logExcerpt = record.lastError
        throw error
    } finally {
        record.running = false
        record.currentRunStartedAt = null
    }
}

export function getBackgroundJobRuntime(id: string): BackgroundJobRuntime {
    return { ...ensureRecord(id) }
}

export function listBackgroundJobRuntime() {
    return [...runtime.values()].map(record => ({ ...record }))
}

function ensureRecord(id: string): BackgroundJobRuntime {
    const existing = runtime.get(id)
    if (existing) return existing
    const created: BackgroundJobRuntime = {
        id,
        running: false,
        runCount: 0,
        failureCount: 0,
        lastRunAt: null,
        lastSuccessAt: null,
        lastFinishedAt: null,
        lastError: null,
        averageRuntimeMs: null,
        currentRunStartedAt: null,
        logExcerpt: null,
    }
    runtime.set(id, created)
    return created
}

function rollingAverage(current: number | null, next: number, count: number) {
    if (!current || count <= 1) return next
    return Math.round(((current * (count - 1)) + next) / count)
}
