import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import { cachedLogQuery } from '#utils/logs/cache.ts'
import { rollupLogCountsSql } from '#utils/logs/counts.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'

type ServiceCount = { service: string, count: number }
type MostActiveServices = { last_24h: ServiceCount[], total: ServiceCount[] }

const RECENT_TTL_MS = 30_000
const TOTAL_TTL_MS = 240_000

export function loadCachedMostActiveServices(): Promise<MostActiveServices> {
    return Promise.all([
        cachedLogQuery('most-active-services:24h', RECENT_TTL_MS, queryRecentServices),
        cachedLogQuery('most-active-services:total', TOTAL_TTL_MS, queryAllTimeServices),
    ]).then(([last_24h, total]) => ({ last_24h, total }))
}

export function startMostActiveServicesRefresh() {
    const timer = setInterval(() => { void loadCachedMostActiveServices().catch(() => undefined) }, RECENT_TTL_MS)
    timer.unref()
    return () => clearInterval(timer)
}

export async function getMostActiveServices(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) return res.status(401).send({ error: 'Unauthorized.' })
    if (!(await hasRole(req, res, 'system_admin')).valid) return res.status(403).send({ error: 'Missing system_admin role.' })

    try {
        return res.send(await loadCachedMostActiveServices())
    } catch (error) {
        return res.status(503).send({ error: error instanceof Error ? error.message : 'Most active services are unavailable.' })
    }
}

async function queryRecentServices(): Promise<ServiceCount[]> {
    return withTransaction(async query => {
        await query('SET LOCAL statement_timeout = \'8s\'')
        const timeWhere = 'event_timestamp >= NOW() - INTERVAL \'24 hours\''
        const where = ['organization_id = ANY(ARRAY(SELECT o.id FROM organizations o WHERE o.status = \'active\'))']
        const rollup = rollupLogCountsSql(where, timeWhere)
        if (!rollup) throw new Error('Recent service counts are unavailable.')
        const result = await query(`SELECT service, SUM(count)::int AS count
            FROM (${rollup}) recent
            WHERE service IS NOT NULL
            GROUP BY service
            ORDER BY count DESC, service ASC
            LIMIT 10`)
        return result.rows as ServiceCount[]
    })
}

async function queryAllTimeServices(): Promise<ServiceCount[]> {
    return withTransaction(async query => {
        await query('SET LOCAL statement_timeout = \'8s\'')
        const result = await query(`SELECT service, SUM(event_count)::int AS count
            FROM log_counts events
            WHERE bucket_seconds = 86400
              AND organization_id = ANY(ARRAY(SELECT o.id FROM organizations o WHERE o.status = 'active'))
              AND service IS NOT NULL
            GROUP BY service
            HAVING SUM(event_count) > 0
            ORDER BY count DESC, service ASC
            LIMIT 10`)
        return result.rows as ServiceCount[]
    })
}
