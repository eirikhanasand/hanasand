import run from '#db'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { createHash } from 'node:crypto'

type QueryProps = {
    limit?: string
}

export async function getRecentTests(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const { limit } = (req.query as QueryProps) ?? {}
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50)
    const result = await run(
        `${selectRecentTestsSql()}
         LIMIT $1`,
        [safeLimit]
    )
    return res.send(result.rows)
}

export async function getMyRecentTests(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const ownerId = req.headers.id as string | undefined
    const { limit } = (req.query as QueryProps) ?? {}
    const quotaIdentity = ownerId ? null : anonymousQuotaIdentity(req)
    if (!ownerId && !quotaIdentity) return res.status(400).send({ error: 'Missing user id.' })

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50)
    const result = await run(
        `${selectRecentTestsSql(ownerId ? 'WHERE tests.owner_id = $1' : 'WHERE tests.quota_identity = $1')}
         LIMIT $2`,
        [ownerId || quotaIdentity, safeLimit]
    )
    return res.send(result.rows)
}

function selectRecentTestsSql(where = '') {
    return `
        SELECT
            tests.*,
            latest.summary AS latest_run_summary,
            latest.run_number AS latest_run_number,
            previous.summary AS previous_run_summary,
            CASE
                WHEN latest.summary ? 'duration' AND previous.summary ? 'duration'
                THEN ((previous.summary->'duration'->>'p95')::float - (latest.summary->'duration'->>'p95')::float)
                ELSE NULL
            END AS p95_delta_ms
        FROM load_tests tests
        LEFT JOIN LATERAL (
            SELECT summary, run_number, started_at
            FROM load_test_runs
            WHERE test_id = tests.id
            ORDER BY started_at DESC
            LIMIT 1
        ) latest ON TRUE
        LEFT JOIN LATERAL (
            SELECT summary
            FROM load_test_runs
            WHERE url = tests.url
              AND (
                latest.started_at IS NULL
                OR started_at < latest.started_at
              )
            ORDER BY started_at DESC
            LIMIT 1
        ) previous ON TRUE
        ${where}
        ORDER BY tests.created_at DESC
    `
}

function anonymousQuotaIdentity(req: FastifyRequest) {
    const clientId = headerValue(req.headers['x-load-test-client-id'])
    if (!clientId) return null
    return `anon:${createHash('sha256').update([
        clientId,
        clientIp(req),
        headerValue(req.headers['user-agent']),
    ].join('|')).digest('hex').slice(0, 32)}`
}

function headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || '' : value || ''
}

function clientIp(req: FastifyRequest) {
    const forwarded = headerValue(req.headers['x-forwarded-for'])
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown'
}
