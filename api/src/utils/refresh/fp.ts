import config from '#constants'
import fp from 'fastify-plugin'
import getStats from './queries/stats.ts'
import getDocker from './queries/docker.ts'

export default fp(async (fastify) => {
    async function refreshQueries() {
        try {
            const [stats, docker] = await Promise.all([
                getStats(),
                getDocker()
            ])

            fastify.stats = Buffer.from(JSON.stringify(stats))
            fastify.docker = Buffer.from(JSON.stringify(docker))
            fastify.log.debug('Cached queries refreshed')
        } catch (error) {
            fastify.log.warn({ error }, 'Cached query refresh failed')
        }
    }

    void refreshQueries()
    setInterval(refreshQueries, config.CACHE_TTL_HOT)
})
