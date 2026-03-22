import config from '#constants'
import fp from 'fastify-plugin'
import getStats from './queries/stats.ts'

export default fp(async (fastify) => {
    async function refreshQueries() {
        const stats = getStats()
        fastify.stats = Buffer.from(JSON.stringify(stats))
        fastify.log.info('Cached queries refreshed')
    }

    refreshQueries()
    setInterval(refreshQueries, config.CACHE_TTL_HOT)
})
