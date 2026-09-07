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
            SUM(hits) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')::int AS hits_hour,
            SUM(hits) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS hits_today,
            SUM(hits) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS hits_last_week,
            SUM(hits) FILTER (WHERE created_at >= date_trunc('month', NOW()))::int AS hits_this_month,
            SUM(hits)::int AS hits_total
        FROM traffic_aggregate_events
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
            SUM(hits)::int AS hits,
            MAX(last_seen)::text AS last_seen,
            MIN(first_seen)::text AS created_at
        FROM traffic_aggregate_events
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
            ROUND((SUM(hits)::numeric / 60.0), 3)::float AS tps
        FROM traffic_aggregate_events
        WHERE domain <> ''
          AND created_at >= NOW() - INTERVAL '60 seconds'
        GROUP BY domain
        ORDER BY tps DESC
        LIMIT 20
    `)

    return res.send(result.rows)
}

export async function getLegacyTrafficIps(_req: FastifyRequest, res: FastifyReply) {
    return res.send((await trafficActors('ip', 'user_agent', 'most_common_user_agent')).rows)
}

export async function getLegacyTrafficUserAgents(_req: FastifyRequest, res: FastifyReply) {
    return res.send((await trafficActors('user_agent', 'ip', 'most_common_ip')).rows)
}

function trafficActors(actor: 'ip' | 'user_agent', related: 'ip' | 'user_agent', relatedLabel: string) {
    return safeQuery(`
        WITH grouped AS MATERIALIZED (
            SELECT ${actor}, ${related}, path, SUM(hits)::bigint AS hits
            FROM traffic_aggregate_events WHERE ${actor} <> ''
            GROUP BY ${actor}, ${related}, path
        ), leaders AS (
            SELECT ${actor}, SUM(hits)::bigint AS hits FROM grouped
            GROUP BY ${actor} ORDER BY hits DESC LIMIT 20
        )
        SELECT leaders.*,
            COALESCE((SELECT ${related} FROM grouped WHERE grouped.${actor}=leaders.${actor} AND ${related}<>''
                GROUP BY ${related} ORDER BY SUM(hits) DESC, ${related} LIMIT 1), '') AS ${relatedLabel},
            COALESCE((SELECT json_agg(json_build_object('path', p.path, 'hits', p.hits) ORDER BY p.hits DESC)
                FROM (SELECT path, SUM(hits)::bigint AS hits FROM grouped
                    WHERE grouped.${actor}=leaders.${actor} AND path<>'' GROUP BY path) p), '[]'::json) AS top_paths
        FROM leaders ORDER BY hits DESC
    `)
}

export async function getLegacyTrafficDomains(_req: FastifyRequest, res: FastifyReply) {
    const result = await safeQuery(`
        SELECT domain
        FROM traffic_aggregate_events
        WHERE domain <> ''
        GROUP BY domain
        ORDER BY MAX(last_seen) DESC, SUM(hits) DESC
        LIMIT 50
    `)

    return res.send({ domains: result.rows.map((row: { domain: string }) => row.domain) })
}

export async function getLegacyTrafficMetrics(req: FastifyRequest, res: FastifyReply) {
    const domain = readQueryString(req, 'domain') || null
    const top = (expression: string) => `COALESCE((SELECT json_agg(t) FROM (
        SELECT ${expression} AS key, SUM(hits)::bigint AS count FROM traffic_scope
        WHERE ${expression} <> '' GROUP BY ${expression} ORDER BY count DESC LIMIT 10
    ) t), '[]'::json)`
    const result = await safeQuery(`
        WITH traffic_scope AS MATERIALIZED (
            SELECT * FROM traffic_aggregate_events WHERE ($1::text IS NULL OR domain=$1)
        )
        SELECT COALESCE(SUM(hits),0)::bigint AS total_requests,
            COALESCE(ROUND(SUM(time_total)/NULLIF(SUM(hits),0)),0) AS avg_request_time,
            COALESCE(1.0 * SUM(hits) FILTER (WHERE status>=400)/NULLIF(SUM(hits),0),0)::float AS error_rate,
            ${top('method')} AS top_methods,
            ${top('status::text')} AS top_status_codes,
            ${top('domain')} AS top_domains,
            ${top('user_agent')} AS top_browsers,
            ${top('path')} AS top_paths,
            COALESCE((SELECT json_agg(t) FROM (
                SELECT path AS key, ROUND(SUM(time_total)/NULLIF(SUM(hits),0)) AS avg_time
                FROM traffic_scope WHERE path<>'' GROUP BY path ORDER BY avg_time DESC LIMIT 10
            ) t), '[]'::json) AS top_slow_paths,
            COALESCE((SELECT json_agg(t) FROM (
                SELECT path AS key,SUM(hits)::bigint AS count FROM traffic_scope
                WHERE path<>'' AND status>=400 GROUP BY path ORDER BY count DESC LIMIT 10
            ) t), '[]'::json) AS top_error_paths,
            COALESCE((SELECT json_agg(t) FROM (
                SELECT date_trunc('hour',created_at)::text AS key,SUM(hits)::bigint AS count
                FROM traffic_scope WHERE created_at>=NOW()-INTERVAL '24 hours'
                GROUP BY date_trunc('hour',created_at) ORDER BY key
            ) t), '[]'::json) AS requests_over_time
        FROM traffic_scope
    `, [domain])
    return res.send({ ...emptyMetrics, ...result.rows[0] })
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
            SELECT COALESCE(SUM(hits), 0)::bigint AS total
            FROM traffic_aggregate_events
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
    } catch (error) {
        throw Object.assign(new Error('Traffic statistics are temporarily unavailable', { cause: error }), { statusCode: 503 })
    }
}

