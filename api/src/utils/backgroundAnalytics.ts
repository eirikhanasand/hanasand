import type { FastifyBaseLogger } from 'fastify'
import { warmTrafficStatistics } from '../handlers/traffic/legacy.ts'
import { refreshTrafficHistory } from './traffic/history.ts'
import { warmLogSnapshots, refreshLogSnapshots } from './logs/warm.ts'
import { warmRuleHitSnapshots } from './events/warmRuleHits.ts'

export async function startBackgroundAnalytics(logger: Pick<FastifyBaseLogger, 'warn'>) {
    // Recovery servers answer requested reads; they must not continuously scan
    // the primary or their recovering replica to populate unused local caches.
    if (process.env.RECOVERY_ESSENTIAL_ONLY === '1') return () => {}
    await warmLogSnapshots()
    const stopLogs = refreshLogSnapshots()
    if (process.env.AUTH_SERVICE_ONLY === '1') return stopLogs
    await warmRuleHitSnapshots(logger).catch(error => logger.warn({ error }, 'Rule hit snapshots will retry in the background'))
    await new Promise(resolve => setTimeout(resolve, 1000))
    await warmRuleHitSnapshots(logger, true).catch(error => logger.warn({ error }, 'Rule hit snapshots will retry in the background'))
    const ruleHits = setInterval(() => {
        void warmRuleHitSnapshots(logger).catch(error => logger.warn({ error }, 'Rule hit snapshot refresh failed'))
    }, 10_000)
    ruleHits.unref()
    await warmTrafficStatistics().catch(error => logger.warn({ error }, 'Traffic startup snapshots will retry in the background'))
    const stopTraffic = refreshTrafficHistory()
    const timer = setInterval(() => {
        void warmTrafficStatistics().catch(error => logger.warn({ error }, 'Traffic snapshot refresh failed'))
    }, 30000)
    timer.unref()
    return () => { stopLogs(); stopTraffic(); clearInterval(timer); clearInterval(ruleHits) }
}
