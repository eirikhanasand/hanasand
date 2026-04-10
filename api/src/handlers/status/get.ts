import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

type MonitorRow = {
    service: string
    check_name: string
    status: 'up' | 'degraded' | 'down'
    latency_ms: number
    message: string | null
    checked_at: string
    uptime_30d: string
}

export default async function getStatus(_req: FastifyRequest, res: FastifyReply) {
    const result = await run(`
        WITH latest AS (
            SELECT DISTINCT ON (service, check_name)
                service, check_name, status, latency_ms, message, checked_at
            FROM service_monitor_results
            ORDER BY service, check_name, checked_at DESC
        ),
        uptime AS (
            SELECT
                service,
                check_name,
                ROUND(
                    100.0 * COUNT(*) FILTER (WHERE status = 'up')
                    / NULLIF(COUNT(*), 0),
                    2
                ) AS uptime_30d
            FROM service_monitor_results
            WHERE checked_at >= NOW() - INTERVAL '30 days'
            GROUP BY service, check_name
        )
        SELECT latest.*, COALESCE(uptime.uptime_30d, 0)::text AS uptime_30d
        FROM latest
        LEFT JOIN uptime USING (service, check_name)
        ORDER BY latest.service ASC, latest.check_name ASC
    `)

    const checks = result.rows as MonitorRow[]
    const overall = checks.length && checks.every(check => check.status === 'up')
        ? 'up'
        : checks.some(check => check.status === 'down')
            ? 'down'
            : 'degraded'

    return res.send({
        overall,
        generated_at: new Date().toISOString(),
        checks,
    })
}
