import { createServer } from 'node:http'
import { closeDatabase, withEventDatabase, withPriorityEventDatabase } from '#db'
import { processLiveLogs, processStoredLogs } from '#utils/events/processLogs.ts'
import { startLogProcessor } from '#utils/events/processor.ts'
import { readLogCatchupSettings } from '#utils/events/catchupLimit.ts'
import { isLogProcessorHealthy } from '#utils/events/processorHealth.ts'

const settings = readLogCatchupSettings()
const release = process.env.HANASAND_RELEASE_COMMIT || 'unknown'
const healthPort = Number(process.env.LOG_PROCESSOR_HEALTH_PORT) || 8099
const restartAfterFailures = 10
let lastSuccessfulTickAt: number | null = null
let processingStartedAt: number | null = null
let consecutiveFailures = 0
let lastLiveTickAt: number | null = null
let liveProcessingStartedAt: number | null = null
let liveConsecutiveFailures = 0
let shuttingDown = false
let stopLiveProcessing: () => Promise<void> = async () => {}
let stopStoredProcessing: () => Promise<void> = async () => {}

const healthServer = createServer((request, response) => {
    if (request.url?.split('?')[0] !== '/health') {
        response.statusCode = 404
        response.end('Not found')
        return
    }
    const now = Date.now()
    const ok = isLogProcessorHealthy({
        shuttingDown,
        lastSuccessfulTickAt,
        processingStartedAt,
        consecutiveFailures,
        lastLiveTickAt,
        liveProcessingStartedAt,
        liveConsecutiveFailures,
    }, now)
    response.statusCode = ok ? 200 : 503
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({
        ok,
        service: 'log-processor',
        release,
        lastSuccessfulTickAt: lastSuccessfulTickAt === null ? null : new Date(lastSuccessfulTickAt).toISOString(),
        processingStartedAt: processingStartedAt === null ? null : new Date(processingStartedAt).toISOString(),
        consecutiveFailures,
        lastLiveTickAt: lastLiveTickAt === null ? null : new Date(lastLiveTickAt).toISOString(),
        liveProcessingStartedAt: liveProcessingStartedAt === null ? null : new Date(liveProcessingStartedAt).toISOString(),
        liveConsecutiveFailures,
    }))
})
healthServer.listen(healthPort, '0.0.0.0')

stopLiveProcessing = startLogProcessor(async () => {
    liveProcessingStartedAt = Date.now()
    try {
        const didLiveWork = await withPriorityEventDatabase(processLiveLogs)
        lastLiveTickAt = Date.now()
        liveConsecutiveFailures = 0
        return didLiveWork
    } catch (error) {
        liveConsecutiveFailures++
        console.error('Priority log processor pass failed.', error)
        if (liveConsecutiveFailures >= restartAfterFailures) {
            console.error(`Priority log processor reached ${restartAfterFailures} consecutive failures; restarting.`)
            setTimeout(() => process.exit(1), 0)
        }
        throw error
    } finally {
        liveProcessingStartedAt = null
    }
}, () => {}, () => Math.min(250, settings.intervalMs), () => performance.now(), 250)

stopStoredProcessing = startLogProcessor(async () => {
    processingStartedAt = Date.now()
    try {
        const didStoredWork = await withEventDatabase(processStoredLogs)
        lastSuccessfulTickAt = Date.now()
        consecutiveFailures = 0
        return didStoredWork
    } catch (error) {
        consecutiveFailures++
        console.error('Durable log processor pass failed.', error)
        if (consecutiveFailures >= restartAfterFailures) {
            console.error(`Durable log processor reached ${restartAfterFailures} consecutive failures; restarting.`)
            setTimeout(() => process.exit(1), 0)
        }
        throw error
    } finally {
        processingStartedAt = null
    }
}, () => {}, () => readLogCatchupSettings().intervalMs)

async function shutdown() {
    if (shuttingDown) return
    shuttingDown = true
    await Promise.all([stopLiveProcessing(), stopStoredProcessing()])
    await new Promise<void>(resolve => healthServer.close(() => resolve()))
    await closeDatabase()
}

process.once('SIGTERM', () => { void shutdown() })
process.once('SIGINT', () => { void shutdown() })
