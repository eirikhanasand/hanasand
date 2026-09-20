import config from '#constants'
import fp from 'fastify-plugin'
import getStats from './queries/stats.ts'
import getDocker from './queries/docker.ts'
import systemVms from './queries/systemVms.ts'
import { runTrackedBackgroundJob } from '../backgroundJobRuntime.ts'

export default fp(async (fastify) => {
    let refreshing = false
    async function refreshQueries() {
        if (refreshing) return
        refreshing = true
        try {
            const [stats, docker, inventory] = await Promise.all([
                getStats(),
                getDocker(),
                systemVms().catch(error => { fastify.log.warn({ error }, 'VM snapshot refresh failed'); return null })
            ])

            fastify.stats = Buffer.from(JSON.stringify(stats))
            fastify.docker = Buffer.from(JSON.stringify(docker))
            if (inventory) fastify.systemSnapshot = Buffer.from(JSON.stringify({ systemTelemetry: stats.data, dockerTelemetry: docker.data, ...inventory, generated_at: new Date().toISOString() }))
            fastify.log.debug('Cached queries refreshed')
        } catch (error) {
            fastify.log.warn({ error }, 'Cached query refresh failed')
        } finally {
            refreshing = false
        }
    }

    await runTrackedBackgroundJob('api-hot-cache-refresh', refreshQueries)
    const timer = setInterval(() => void runTrackedBackgroundJob('api-hot-cache-refresh', refreshQueries), config.CACHE_TTL_HOT)
    fastify.addHook('onClose', async () => { clearInterval(timer) })
})
