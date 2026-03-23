import config from '#constants'
import fp from 'fastify-plugin'
import getStats from './queries/stats.ts'
import getDocker from './queries/docker.ts'

export default fp(async (fastify) => {
    async function refreshQueries() {
        const stats = getStats()
        const docker = getDocker()
        fastify.stats = Buffer.from(JSON.stringify(stats))
        fastify.docker = Buffer.from(JSON.stringify(docker))
        fastify.log.info('Cached queries refreshed')
    }

    refreshQueries()
    setInterval(refreshQueries, config.CACHE_TTL_HOT)
})
