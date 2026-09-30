import { createServer } from 'node:http'
import { closeDatabase, withEventDatabase } from '#db'
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
let shuttingDown = false
let stopProcessing: () => Promise<void> = async () => {}

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
    }))
})
healthServer.listen(healthPort, '0.0.0.0')

stopProcessing = startLogProcessor(async () => {
    processingStartedAt = Date.now()
    try {
        // Keep all service-log work on this dedicated process. Run the fresh
        // lane first, then let catch-up service durable history and its FIFO.
        const didLiveWork = await withEventDatabase(processLiveLogs)
        const didStoredWork = await withEventDatabase(processStoredLogs)
        lastSuccessfulTickAt = Date.now()
        consecutiveFailures = 0
        return didLiveWork || didStoredWork
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
}, () => {}, () => settings.intervalMs)

async function shutdown() {
    if (shuttingDown) return
    shuttingDown = true
    await stopProcessing()
    await new Promise<void>(resolve => healthServer.close(() => resolve()))
    await closeDatabase()
}

process.once('SIGTERM', () => { void shutdown() })
process.once('SIGINT', () => { void shutdown() })
