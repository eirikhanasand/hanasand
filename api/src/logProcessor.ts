import { createServer } from 'node:http'
import { closeDatabase, withEventDatabase } from '#db'
import { processStoredLogs } from '#utils/events/processLogs.ts'
import { startLogProcessor } from '#utils/events/processor.ts'
import { readLogCatchupSettings } from '#utils/events/catchupLimit.ts'

const settings = readLogCatchupSettings()
const release = process.env.HANASAND_RELEASE_COMMIT || 'unknown'
const healthPort = Number(process.env.LOG_PROCESSOR_HEALTH_PORT) || 8099
const unhealthyAfterMs = 120_000
const restartAfterFailures = 10
let lastSuccessfulTickAt: number | null = null
let consecutiveFailures = 0
let shuttingDown = false
let stopProcessing: () => Promise<void> = async () => {}

const healthServer = createServer((request, response) => {
    if (request.url?.split('?')[0] !== '/health') {
        response.statusCode = 404
        response.end('Not found')
        return
    }
    const stale = lastSuccessfulTickAt === null || Date.now() - lastSuccessfulTickAt > unhealthyAfterMs
    const ok = !shuttingDown && !stale && consecutiveFailures < restartAfterFailures
    response.statusCode = ok ? 200 : 503
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({
        ok,
        service: 'log-processor',
        release,
        lastSuccessfulTickAt: lastSuccessfulTickAt === null ? null : new Date(lastSuccessfulTickAt).toISOString(),
        consecutiveFailures,
    }))
})
healthServer.listen(healthPort, '0.0.0.0')

stopProcessing = startLogProcessor(async () => {
    try {
        const didWork = await withEventDatabase(processStoredLogs)
        lastSuccessfulTickAt = Date.now()
        consecutiveFailures = 0
        return didWork
    } catch (error) {
        consecutiveFailures++
        console.error('Durable log processor pass failed.', error)
        if (consecutiveFailures >= restartAfterFailures) {
            console.error(`Durable log processor reached ${restartAfterFailures} consecutive failures; restarting.`)
            setTimeout(() => process.exit(1), 0)
        }
        throw error
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
