import type { FastifyBaseLogger } from 'fastify'
import { warmTrafficStatistics } from '../handlers/traffic/legacy.ts'
import { refreshTrafficHistory } from './traffic/history.ts'
import { warmLogSnapshots, refreshLogSnapshots } from './logs/warm.ts'
import { warmRuleHitSnapshots } from './events/warmRuleHits.ts'

function refreshRuleHitsInBackground(logger: Pick<FastifyBaseLogger, 'warn'>) {
    let active = true
    let first = true
    let timer: ReturnType<typeof setTimeout>
    const refresh = async () => {
        try { await warmRuleHitSnapshots(logger, !first) }
        catch (error) { logger.warn({ error }, 'Rule hit snapshot refresh failed') }
        first = false
        if (!active) return
        timer = setTimeout(() => { void refresh() }, first ? 10_000 : 1_000)
        timer.unref()
    }
    timer = setTimeout(() => { void refresh() }, 1_000)
    timer.unref()
    return () => { active = false; clearTimeout(timer) }
}

export async function startBackgroundAnalytics(logger: Pick<FastifyBaseLogger, 'warn'>) {
    // Recovery servers answer requested reads; they must not continuously scan
    // the primary or their recovering replica to populate unused local caches.
    if (process.env.RECOVERY_ESSENTIAL_ONLY === '1') return () => {}
    await warmLogSnapshots()
    const stopLogs = refreshLogSnapshots()
    if (process.env.AUTH_SERVICE_ONLY === '1') return stopLogs
    const stopRuleHits = refreshRuleHitsInBackground(logger)
    await warmTrafficStatistics().catch(error => logger.warn({ error }, 'Traffic startup snapshots will retry in the background'))
    const stopTraffic = refreshTrafficHistory()
    const timer = setInterval(() => {
        void warmTrafficStatistics().catch(error => logger.warn({ error }, 'Traffic snapshot refresh failed'))
    }, 30000)
    timer.unref()
    return () => { stopLogs(); stopTraffic(); clearInterval(timer); stopRuleHits() }
}
