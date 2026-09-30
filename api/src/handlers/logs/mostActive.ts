import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import { cachedLogQuery } from '#utils/logs/cache.ts'
import { rollupLogCountsSql } from '#utils/logs/counts.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'

type Severity = 'low' | 'medium' | 'high' | 'critical'
type ServiceCount = { service: string, count: number }
type SeverityCounts = Record<Severity, number>
type ScopeSummary = { services: ServiceCount[], severities: SeverityCounts }
type LogsDashboardSummary = { last_24h: ScopeSummary, total: ScopeSummary }
type SummaryRow = { kind: 'service' | 'severity', name: string, count: number | string }

const emptySeverityCounts = (): SeverityCounts => ({ low: 0, medium: 0, high: 0, critical: 0 })

const RECENT_TTL_MS = 30_000
const TOTAL_TTL_MS = 240_000

export function loadCachedMostActiveServices(): Promise<LogsDashboardSummary> {
    return Promise.all([
        cachedLogQuery('most-active-services:24h', RECENT_TTL_MS, queryRecentSummary),
        cachedLogQuery('most-active-services:total', TOTAL_TTL_MS, queryAllTimeSummary),
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

async function queryRecentSummary(): Promise<ScopeSummary> {
    return withTransaction(async query => {
        await query('SET LOCAL statement_timeout = \'8s\'')
        const timeWhere = 'event_timestamp >= NOW() - INTERVAL \'24 hours\''
        const where = ['organization_id = ANY(ARRAY(SELECT o.id FROM organizations o WHERE o.status = \'active\'))']
        const rollup = rollupLogCountsSql(where, timeWhere)
        if (!rollup) throw new Error('Recent log counts are unavailable.')
        const result = await query(`WITH counts AS MATERIALIZED (${rollup})
            SELECT 'service'::text AS kind, service AS name, SUM(count)::bigint AS count
            FROM counts
            WHERE service IS NOT NULL
            GROUP BY service
            UNION ALL
            SELECT 'severity'::text AS kind, severity AS name, SUM(count)::bigint AS count
            FROM counts
            WHERE severity IS NOT NULL
            GROUP BY severity`)
        return buildScopeSummary(result.rows as SummaryRow[])
    })
}

async function queryAllTimeSummary(): Promise<ScopeSummary> {
    return withTransaction(async query => {
        await query('SET LOCAL statement_timeout = \'8s\'')
        const result = await query(`WITH counts AS MATERIALIZED (
                SELECT severity, service, event_count AS count
                FROM log_counts events
                WHERE bucket_seconds = 86400
                  AND organization_id = ANY(ARRAY(SELECT o.id FROM organizations o WHERE o.status = 'active'))
            )
            SELECT 'service'::text AS kind, service AS name, SUM(count)::bigint AS count
            FROM counts
            WHERE service IS NOT NULL
            GROUP BY service
            HAVING SUM(count) > 0
            UNION ALL
            SELECT 'severity'::text AS kind, severity AS name, SUM(count)::bigint AS count
            FROM counts
            WHERE severity IS NOT NULL
            GROUP BY severity`)
        return buildScopeSummary(result.rows as SummaryRow[])
    })
}

function buildScopeSummary(rows: SummaryRow[]): ScopeSummary {
    const services = rows
        .filter(row => row.kind === 'service')
        .map(row => ({ service: row.name, count: Number(row.count) }))
        .sort((a, b) => b.count - a.count || a.service.localeCompare(b.service))
        .slice(0, 10)
    const severities = emptySeverityCounts()
    for (const row of rows) {
        if (row.kind === 'severity' && Object.hasOwn(severities, row.name)) severities[row.name as Severity] = Number(row.count)
    }
    return { services, severities }
}
