import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'

type TrafficMetric = 'path' | 'ip' | 'user_agent' | 'domain'

const emptyMetrics = {
    total_requests: 0,
    avg_request_time: 0,
    error_rate: 0,
    top_methods: [],
    top_status_codes: [],
    top_domains: [],
    top_os: [],
    top_browsers: [],
    requests_over_time: [],
    top_error_paths: [],
    top_slow_paths: [],
    top_paths: [],
}

const metricColumns: Record<TrafficMetric, string> = {
    path: 'path',
    ip: 'ip',
    user_agent: 'user_agent',
    domain: 'domain',
}

export async function getLegacyTrafficSummary(req: FastifyRequest, res: FastifyReply) {
    const metric = readQueryString(req, 'metric') || 'path'
    if (!isTrafficMetric(metric)) {
        return res.status(400).send({
            error: 'Unsupported traffic summary metric.',
            allowed: ['path', 'ip', 'user_agent', 'domain'],
        })
    }

    const column = metricColumns[metric]
    const result = await safeQuery(`
        SELECT
            ${column} AS value,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')::int AS hits_hour,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS hits_today,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS hits_last_week,
            COUNT(*)::int AS hits_total
        FROM traffic_events
        WHERE ${column} <> ''
        GROUP BY ${column}
        ORDER BY hits_today DESC, hits_last_week DESC, hits_total DESC
        LIMIT 20
    `)

    return res.send(result.rows)
}

export async function getLegacyTrafficRecent(_req: FastifyRequest, res: FastifyReply) {
    const result = await safeQuery(`
        SELECT
            path AS value,
            path,
            'path' AS metric,
            COUNT(*)::int AS hits,
            MAX(created_at)::text AS last_seen,
            MIN(created_at)::text AS created_at
        FROM traffic_events
        WHERE path <> ''
        GROUP BY path
        ORDER BY last_seen DESC
        LIMIT 40
    `)

    return res.send(result.rows)
}

export async function getLegacyTrafficTps(_req: FastifyRequest, res: FastifyReply) {
    const result = await safeQuery(`
        SELECT
            domain AS name,
            ROUND((COUNT(*)::numeric / 60.0), 3)::float AS tps
        FROM traffic_events
        WHERE domain <> ''
          AND created_at >= NOW() - INTERVAL '60 seconds'
        GROUP BY domain
        ORDER BY tps DESC
        LIMIT 20
    `)

    return res.send(result.rows)
}

export async function getLegacyTrafficIps(_req: FastifyRequest, res: FastifyReply) {
    const result = await safeQuery(`
        WITH ranked_paths AS (
            SELECT ip, path, COUNT(*)::int AS hits
            FROM traffic_events
            WHERE ip <> '' AND path <> ''
            GROUP BY ip, path
        ),
        ranked_agents AS (
            SELECT DISTINCT ON (ip) ip, user_agent AS most_common_user_agent
            FROM (
                SELECT ip, user_agent, COUNT(*) AS hits
                FROM traffic_events
                WHERE ip <> '' AND user_agent <> ''
                GROUP BY ip, user_agent
            ) agents
            ORDER BY ip, hits DESC
        )
        SELECT
            events.ip,
            COUNT(*)::int AS hits,
            COALESCE(ranked_agents.most_common_user_agent, '') AS most_common_user_agent,
            COALESCE(
                json_agg(json_build_object('path', ranked_paths.path, 'hits', ranked_paths.hits) ORDER BY ranked_paths.hits DESC)
                    FILTER (WHERE ranked_paths.path IS NOT NULL),
                '[]'::json
            ) AS top_paths
        FROM traffic_events events
        LEFT JOIN ranked_paths ON ranked_paths.ip = events.ip
        LEFT JOIN ranked_agents ON ranked_agents.ip = events.ip
        WHERE events.ip <> ''
        GROUP BY events.ip, ranked_agents.most_common_user_agent
        ORDER BY hits DESC
        LIMIT 20
    `)

    return res.send(result.rows)
}

export async function getLegacyTrafficUserAgents(_req: FastifyRequest, res: FastifyReply) {
    const result = await safeQuery(`
        WITH ranked_paths AS (
            SELECT user_agent, path, COUNT(*)::int AS hits
            FROM traffic_events
            WHERE user_agent <> '' AND path <> ''
            GROUP BY user_agent, path
        ),
        ranked_ips AS (
            SELECT DISTINCT ON (user_agent) user_agent, ip AS most_common_ip
            FROM (
                SELECT user_agent, ip, COUNT(*) AS hits
                FROM traffic_events
                WHERE user_agent <> '' AND ip <> ''
                GROUP BY user_agent, ip
            ) ips
            ORDER BY user_agent, hits DESC
        )
        SELECT
            events.user_agent,
            COUNT(*)::int AS hits,
            COALESCE(ranked_ips.most_common_ip, '') AS most_common_ip,
            COALESCE(
                json_agg(json_build_object('path', ranked_paths.path, 'hits', ranked_paths.hits) ORDER BY ranked_paths.hits DESC)
                    FILTER (WHERE ranked_paths.path IS NOT NULL),
                '[]'::json
            ) AS top_paths
        FROM traffic_events events
        LEFT JOIN ranked_paths ON ranked_paths.user_agent = events.user_agent
        LEFT JOIN ranked_ips ON ranked_ips.user_agent = events.user_agent
        WHERE events.user_agent <> ''
        GROUP BY events.user_agent, ranked_ips.most_common_ip
        ORDER BY hits DESC
        LIMIT 20
    `)

    return res.send(result.rows)
}

export async function getLegacyTrafficDomains(_req: FastifyRequest, res: FastifyReply) {
    const result = await safeQuery(`
        SELECT domain
        FROM traffic_events
        WHERE domain <> ''
        GROUP BY domain
        ORDER BY MAX(created_at) DESC, COUNT(*) DESC
        LIMIT 50
    `)

    return res.send({ domains: result.rows.map((row: { domain: string }) => row.domain) })
}

export async function getLegacyTrafficMetrics(_req: FastifyRequest, res: FastifyReply) {
    const [summary, methods, statusCodes, domains, browsers, paths, slowPaths, errorPaths, overTime] = await Promise.all([
        safeQuery(`
            SELECT
                COUNT(*)::int AS total_requests,
                COALESCE(ROUND(AVG(request_time_ms))::int, 0) AS avg_request_time,
                COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE status >= 500) / NULLIF(COUNT(*), 0), 2)::float, 0) AS error_rate
            FROM traffic_events
        `),
        topCountQuery('method'),
        topCountQuery('status::text'),
        topCountQuery('domain'),
        topCountQuery('user_agent'),
        topCountQuery('path'),
        safeQuery(`
            SELECT path AS key, COALESCE(ROUND(AVG(request_time_ms))::int, 0) AS avg_time
            FROM traffic_events
            WHERE path <> ''
            GROUP BY path
            ORDER BY avg_time DESC
            LIMIT 10
        `),
        safeQuery(`
            SELECT path AS key, COUNT(*)::int AS count
            FROM traffic_events
            WHERE status >= 500 AND path <> ''
            GROUP BY path
            ORDER BY count DESC
            LIMIT 10
        `),
        safeQuery(`
            SELECT date_trunc('hour', created_at)::text AS key, COUNT(*)::int AS count
            FROM traffic_events
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY date_trunc('hour', created_at)
            ORDER BY key ASC
        `),
    ])

    return res.send({
        ...emptyMetrics,
        ...(summary.rows[0] || {}),
        top_methods: methods.rows,
        top_status_codes: statusCodes.rows,
        top_domains: domains.rows,
        top_os: [],
        top_browsers: browsers.rows,
        requests_over_time: overTime.rows,
        top_error_paths: errorPaths.rows,
        top_slow_paths: slowPaths.rows,
        top_paths: paths.rows,
    })
}

export async function getLegacyTrafficRecords(req: FastifyRequest, res: FastifyReply) {
    const query = req.query as { limit?: string, page?: string, domain?: string }
    const limit = Math.min(Math.max(Number(query.limit || 50), 1), 200)
    const page = Math.max(Number(query.page || 1), 1)
    const offset = (page - 1) * limit
    const domain = typeof query.domain === 'string' && query.domain.trim() ? query.domain.trim() : null
    const [records, total] = await Promise.all([
        safeQuery(`
            SELECT
                id,
                user_agent,
                domain,
                path,
                method,
                referer,
                request_time_ms AS request_time,
                status,
                country_iso,
                created_at AS timestamp
            FROM traffic_events
            WHERE ($1::text IS NULL OR domain = $1)
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        `, [domain, limit, offset]),
        safeQuery(`
            SELECT COUNT(*)::int AS total
            FROM traffic_events
            WHERE ($1::text IS NULL OR domain = $1)
        `, [domain]),
    ])

    return res.send({ result: records.rows, total: Number(total.rows[0]?.total || 0) })
}

export async function getLegacyTrafficLive(_req: FastifyRequest, res: FastifyReply) {
    res.hijack()
    const raw = res.raw
    raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    })

    let closed = false
    let lastSeenId = 0
    const initialWindowStartedAt = new Date(Date.now() - 2 * 60 * 1000)

    const send = (event: string, data: unknown) => {
        if (closed) return
        raw.write(`event: ${event}\n`)
        raw.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    const sendBatch = async () => {
        const result = await safeQuery(`
            WITH recent AS (
                SELECT id, country_iso, created_at
                FROM traffic_events
                WHERE country_iso <> ''
                  AND id > $1
                  AND ($1::bigint > 0 OR created_at >= $2)
                ORDER BY created_at ASC
                LIMIT 1000
            )
            SELECT country_iso AS iso, COUNT(*)::int AS count, MAX(id)::text AS max_id, MAX(created_at)::text AS timestamp
            FROM recent
            GROUP BY country_iso
            ORDER BY count DESC
            LIMIT 40
        `, [lastSeenId, initialWindowStartedAt])

        if (result.rows.length) {
            lastSeenId = Math.max(lastSeenId, ...result.rows.map((row: { max_id: string }) => Number(row.max_id || 0)))
            send('traffic', result.rows)
        } else {
            raw.write(': heartbeat\n\n')
        }
    }

    send('ready', { status: 'connected' })
    void sendBatch()

    const interval = setInterval(() => {
        void sendBatch().catch(error => {
            send('traffic-error', {
                message: error instanceof Error ? error.message : 'Traffic stream query failed',
            })
        })
    }, 3000)

    raw.on('close', () => {
        closed = true
        clearInterval(interval)
    })
}

export function getLegacyBlocklistOverview(_req: FastifyRequest, res: FastifyReply) {
    return res.send([])
}

function readQueryString(req: FastifyRequest, key: string) {
    const query = req.query as Record<string, string | string[] | undefined>
    const value = query[key]

    if (Array.isArray(value)) {
        return value[0]
    }

    return value
}

function isTrafficMetric(value: string): value is TrafficMetric {
    return value === 'path' || value === 'ip' || value === 'user_agent' || value === 'domain'
}

async function safeQuery(query: string, params: Array<string | number | boolean | string[] | Date | null> = []) {
    try {
        return await run(query, params)
    } catch {
        return { rows: [] }
    }
}

function topCountQuery(expression: string) {
    return safeQuery(`
        SELECT ${expression} AS key, COUNT(*)::int AS count
        FROM traffic_events
        WHERE ${expression} <> ''
        GROUP BY ${expression}
        ORDER BY count DESC
        LIMIT 10
    `)
}
