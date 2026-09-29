import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { cachedLogQuery } from '#utils/logs/cache.ts'

type SampleRow = { sampled_at: string, pps: number, eps: number, historical_eps: number, npps: number, remaining: number }
const METRICS_CACHE_TTL_MS = 5000
let metricsSchema: Promise<void> | undefined
let lastCleanupAt = 0

export type LogMetrics = {
    generated_at: string
    current: { pps: number, eps: number, historical_eps: number, npps: number, remaining: number, thresholds: { npps_below: boolean, eps_above: boolean, pps_below: boolean }, alert: boolean }
    history: SampleRow[]
}

export function loadCachedLogMetrics() {
    return cachedLogQuery('throughput-metrics', METRICS_CACHE_TTL_MS, queryLogMetrics)
}

export function startLogMetricsRefresh() {
    const timer = setInterval(() => { void loadCachedLogMetrics().catch(() => undefined) }, METRICS_CACHE_TTL_MS)
    timer.unref()
    return () => clearInterval(timer)
}

export async function getLogMetrics(req: FastifyRequest, res: FastifyReply) {
    const publicRequest = (req.query as { public?: string }).public === '1'
    if (!publicRequest) {
        const { valid } = await tokenWrapper(req, res)
        if (!valid) return res.status(401).send({ error: 'Unauthorized.' })
        if (!(await hasRole(req, res, 'system_admin')).valid) return res.status(403).send({ error: 'Missing system_admin role.' })
    }
    try {
        return res.send(await loadCachedLogMetrics())
    } catch (error) {
        return res.status(503).send({ error: error instanceof Error ? error.message : 'Metrics unavailable.' })
    }
}

async function queryLogMetrics(): Promise<LogMetrics> {
    metricsSchema ??= run(`CREATE TABLE IF NOT EXISTS log_throughput_samples (
            sampled_at TIMESTAMPTZ PRIMARY KEY,
            checked_count BIGINT NOT NULL,
            pps DOUBLE PRECISION NOT NULL,
            eps DOUBLE PRECISION NOT NULL,
            historical_eps DOUBLE PRECISION NOT NULL,
            npps DOUBLE PRECISION NOT NULL,
            remaining BIGINT NOT NULL
        )`).then(() => undefined).catch(error => { metricsSchema = undefined; throw error })
    await metricsSchema
    const current = (await run(`
            SELECT c.checked_count, c.updated_at, COALESCE((p.payload->>'remaining')::bigint, 0) AS remaining
            FROM log_processing_cursors c
            LEFT JOIN log_catchup_progress p ON p.id = TRUE
            WHERE c.name = 'service_logs'
        `)).rows[0]
    const now = new Date()
    const previous = (await run('SELECT checked_count, sampled_at FROM log_throughput_samples ORDER BY sampled_at DESC LIMIT 1')).rows[0]
    const elapsed = previous ? Math.max(1, (now.getTime() - new Date(previous.sampled_at).getTime()) / 1000) : 0
    const checked = Number(current?.checked_count || 0)
    const pps = previous && checked >= Number(previous.checked_count) ? (checked - Number(previous.checked_count)) / elapsed : 0
    const epsResult = await run('SELECT COUNT(*)::int AS count FROM service_logs WHERE created_at >= NOW() - make_interval(secs => 10)')
    const eps = Number(epsResult.rows[0]?.count || 0) / 10
    const historical_eps = Math.max(0, pps - eps)
    const npps = pps > 0 ? (eps + historical_eps) / pps : 0
    await run('INSERT INTO log_throughput_samples (sampled_at,checked_count,pps,eps,historical_eps,npps,remaining) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (sampled_at) DO NOTHING', [now, checked, pps, eps, historical_eps, npps, Number(current?.remaining || 0)])
    if (Date.now() - lastCleanupAt >= 60 * 60_000) {
        await run('DELETE FROM log_throughput_samples WHERE sampled_at < NOW() - INTERVAL \'24 hours\'')
        lastCleanupAt = Date.now()
    }
    const history = (await run(`
        WITH samples AS (
            SELECT date_bin(INTERVAL '5 minutes', sampled_at, TIMESTAMPTZ '1970-01-01 00:00:00+00') AS bucket_start,
                pps, eps, historical_eps, npps, remaining
            FROM log_throughput_samples
            WHERE sampled_at >= NOW() - INTERVAL '24 hours'
        )
        SELECT bucket_start + INTERVAL '5 minutes' AS sampled_at,
            AVG(pps)::double precision AS pps,
            AVG(eps)::double precision AS eps,
            AVG(historical_eps)::double precision AS historical_eps,
            AVG(npps)::double precision AS npps,
            MAX(remaining)::bigint AS remaining
        FROM samples
        WHERE bucket_start >= date_bin(INTERVAL '5 minutes', NOW() - INTERVAL '24 hours', TIMESTAMPTZ '1970-01-01 00:00:00+00') + INTERVAL '5 minutes'
            AND bucket_start + INTERVAL '5 minutes' <= NOW()
        GROUP BY bucket_start
        ORDER BY bucket_start ASC
    `)).rows as SampleRow[]
    return {
        generated_at: now.toISOString(),
        current: { pps, eps, historical_eps, npps, remaining: Number(current?.remaining || 0), thresholds: { npps_below: npps < 100, eps_above: eps > 100, pps_below: pps < 200 }, alert: npps < 100 || eps > 100 || pps < 200 },
        history,
    }
}

export async function getPublicLogMetrics(req: FastifyRequest, res: FastifyReply) {
    return getLogMetrics({ ...req, query: { ...(req.query as object), public: '1' } } as FastifyRequest, res)
}
