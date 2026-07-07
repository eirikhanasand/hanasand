import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'

type ErrorQuery = {
    limit?: string
    surface?: string
    status?: string
    code?: string
    q?: string
    includeExpected?: string
}

export async function getErrorEvents(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) return res.status(401).send({ error: 'Unauthorized.' })
    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) return res.status(403).send({ error: 'Missing system_admin role.' })

    const query = req.query as ErrorQuery
    const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500)
    const status = Number(query.status || 0)
    const normalizedStatus = Number.isFinite(status) && status >= 400 ? status : null
    const surface = normalizeFilter(query.surface)
    const code = normalizeFilter(query.code)
    const q = typeof query.q === 'string' && query.q.trim() ? query.q.trim().slice(0, 120) : null
    const includeExpected = ['1', 'true', 'yes'].includes(String(query.includeExpected || '').toLowerCase())

    const [httpRows, authRows, trafficRows, summary] = await Promise.all([
        run(`
            SELECT
                ('log-' || id::text) AS id,
                'api' AS source,
                service,
                metadata->>'surface' AS surface,
                metadata->>'method' AS method,
                metadata->>'path' AS path,
                NULLIF(metadata->>'status_code', '')::int AS status_code,
                metadata->>'error_code' AS error_code,
                metadata->>'error_message' AS message,
                metadata->>'request_id' AS request_id,
                metadata->>'user_id' AS user_id,
                level,
                created_at
            FROM service_logs
            WHERE metadata->>'category' = 'http_response_error'
              AND ($1::text IS NULL OR metadata->>'surface' = $1)
              AND ($2::int IS NULL OR NULLIF(metadata->>'status_code', '')::int = $2)
              AND ($3::text IS NULL OR metadata->>'error_code' = $3)
              AND ($4::text IS NULL OR message ILIKE '%' || $4 || '%' OR metadata::text ILIKE '%' || $4 || '%')
              AND ($5::boolean OR NOT ${expectedHttpProbePredicate()})
              AND ($5::boolean OR NOT ${scannerHttpProbePredicate()})
            ORDER BY created_at DESC
            LIMIT $6
        `, [surface, normalizedStatus, code, q, includeExpected, limit]),
        run(`
            SELECT
                ('login-' || id::text) AS id,
                'auth' AS source,
                'hanasand-api' AS service,
                'auth' AS surface,
                'POST' AS method,
                '/api/auth/login/:id' AS path,
                CASE
                    WHEN reason = 'bad_password' THEN 401
                    WHEN reason = 'deactivated' THEN 403
                    WHEN reason = 'rate_limited' THEN 429
                    WHEN reason IN ('unknown_user', 'deleted') THEN 404
                    WHEN reason = 'session_issue_failed' THEN 503
                    WHEN reason = 'unexpected_error' THEN 500
                    ELSE 400
                END AS status_code,
                reason AS error_code,
                reason AS message,
                '' AS request_id,
                user_id,
                CASE WHEN status = 'success' THEN 'info' ELSE 'warn' END AS level,
                created_at
            FROM login_events
            WHERE status <> 'success'
              AND ($1::text IS NULL OR $1 = 'auth')
              AND ($2::int IS NULL OR CASE
                    WHEN reason = 'bad_password' THEN 401
                    WHEN reason = 'deactivated' THEN 403
                    WHEN reason = 'rate_limited' THEN 429
                    WHEN reason IN ('unknown_user', 'deleted') THEN 404
                    WHEN reason = 'session_issue_failed' THEN 503
                    WHEN reason = 'unexpected_error' THEN 500
                    ELSE 400
                END = $2)
              AND ($3::text IS NULL OR reason = $3)
              AND ($4::text IS NULL OR user_id ILIKE '%' || $4 || '%' OR reason ILIKE '%' || $4 || '%')
            ORDER BY created_at DESC
            LIMIT $5
        `, [surface, normalizedStatus, code, q, limit]),
        run(`
            SELECT
                ('traffic-' || id::text) AS id,
                'traffic' AS source,
                'frontend' AS service,
                'website' AS surface,
                method,
                path,
                status AS status_code,
                ('http_' || status::text) AS error_code,
                (method || ' ' || path || ' responded with ' || status::text) AS message,
                '' AS request_id,
                '' AS user_id,
                CASE WHEN status >= 500 THEN 'error' ELSE 'warn' END AS level,
                created_at
            FROM traffic_events
            WHERE status >= 400
              AND ($1::text IS NULL OR $1 = 'website')
              AND ($2::int IS NULL OR status = $2)
              AND ($3::text IS NULL OR ('http_' || status::text) = $3)
              AND ($4::text IS NULL OR path ILIKE '%' || $4 || '%')
              AND ($5::boolean OR NOT ${expectedTrafficProbePredicate()})
              AND ($5::boolean OR NOT ${scannerTrafficProbePredicate()})
            ORDER BY created_at DESC
            LIMIT $6
        `, [surface, normalizedStatus, code, q, includeExpected, Math.min(limit, 100)]),
        run(`
            WITH raw_events AS (
                SELECT metadata->>'surface' AS surface, NULLIF(metadata->>'status_code', '')::int AS status_code, metadata->>'error_code' AS error_code, metadata->>'path' AS path, created_at
                FROM service_logs
                WHERE metadata->>'category' = 'http_response_error'
                  AND ($1::boolean OR NOT ${expectedHttpProbePredicate()})
                UNION ALL
                SELECT 'auth', CASE
                    WHEN reason = 'bad_password' THEN 401
                    WHEN reason = 'deactivated' THEN 403
                    WHEN reason = 'rate_limited' THEN 429
                    WHEN reason IN ('unknown_user', 'deleted') THEN 404
                    WHEN reason = 'session_issue_failed' THEN 503
                    WHEN reason = 'unexpected_error' THEN 500
                    ELSE 400
                END, reason, '/api/auth/login/:id', created_at
                FROM login_events
                WHERE status <> 'success'
                UNION ALL
                SELECT 'website', status, ('http_' || status::text), path, created_at
                FROM traffic_events
                WHERE status >= 400
                  AND ($1::boolean OR NOT ${expectedTrafficProbePredicate()})
            ),
            scanner_stats AS (
                SELECT
                    COUNT(*) FILTER (WHERE ${scannerProjectSummaryPredicate()})::int AS project_scans,
                    COUNT(*) FILTER (WHERE ${scannerShareSummaryPredicate()})::int AS share_scans
                FROM raw_events
            ),
            events AS (
                SELECT *
                FROM raw_events
                WHERE $1::boolean OR NOT (${scannerProjectSummaryPredicate()} OR ${scannerShareSummaryPredicate()})
            ),
            stats AS (
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS last_hour,
                    COUNT(*) FILTER (WHERE status_code >= 500)::int AS server_errors,
                    COUNT(*) FILTER (WHERE status_code BETWEEN 400 AND 499)::int AS client_errors
                FROM events
            ),
            status_counts AS (
                SELECT COALESCE(jsonb_agg(jsonb_build_object('status_code', status_code, 'count', count) ORDER BY count DESC), '[]'::jsonb) AS rows
                FROM (
                    SELECT status_code, COUNT(*)::int AS count
                    FROM events
                    GROUP BY status_code
                ) grouped
            ),
            surface_counts AS (
                SELECT COALESCE(jsonb_agg(jsonb_build_object('surface', surface, 'count', count) ORDER BY count DESC), '[]'::jsonb) AS rows
                FROM (
                    SELECT COALESCE(surface, 'api') AS surface, COUNT(*)::int AS count
                    FROM events
                    GROUP BY COALESCE(surface, 'api')
                ) grouped
            ),
            code_counts AS (
                SELECT COALESCE(jsonb_agg(jsonb_build_object('error_code', error_code, 'count', count) ORDER BY count DESC), '[]'::jsonb) AS rows
                FROM (
                    SELECT COALESCE(NULLIF(error_code, ''), 'uncategorized') AS error_code, COUNT(*)::int AS count
                    FROM events
                    GROUP BY COALESCE(NULLIF(error_code, ''), 'uncategorized')
                ) grouped
            )
            SELECT
                stats.total,
                stats.last_hour,
                stats.server_errors,
                stats.client_errors,
                status_counts.rows AS status_counts,
                surface_counts.rows AS surface_counts,
                code_counts.rows AS code_counts,
                scanner_stats.project_scans,
                scanner_stats.share_scans
            FROM stats, status_counts, surface_counts, code_counts, scanner_stats
        `, [includeExpected]),
    ])

    const errors = [...httpRows.rows, ...authRows.rows, ...trafficRows.rows]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit)

    return res.send({
        generated_at: new Date().toISOString(),
        summary: summary.rows[0] || emptySummary(),
        errors,
    })
}

function expectedHttpProbePredicate() {
    return `(
        metadata->>'user_agent' = 'hanasand_internal'
        AND NULLIF(metadata->>'status_code', '')::int IN (401, 404)
        AND (
            metadata->>'path' = '/api/docker'
            OR metadata->>'path' = '/api/stats'
            OR metadata->>'path' ~ '^/api/vm/[^/]+/start$'
        )
    )`
}

function expectedTrafficProbePredicate() {
    return `(
        user_agent = 'hanasand_internal'
        AND status IN (401, 404)
        AND (
            path = '/api/docker'
            OR path = '/api/stats'
            OR path ~ '^/api/vm/[^/]+/start$'
        )
    )`
}

function scannerHttpProbePredicate() {
    return `(
        NULLIF(metadata->>'status_code', '')::int = 404
        AND (
            metadata->>'error_code' = 'project_not_found'
            OR metadata->>'error_code' = 'share_not_found'
            OR metadata->>'path' ~ '^/api/project/[^/]+$'
            OR metadata->>'path' ~ '^/api/share(/tree)?/[^/]+$'
        )
    )`
}

function scannerTrafficProbePredicate() {
    return `(
        status = 404
        AND (
            path ~ '^/api/project/[^/]+$'
            OR path ~ '^/api/share(/tree)?/[^/]+$'
        )
    )`
}

function scannerProjectSummaryPredicate() {
    return '(status_code = 404 AND (error_code = \'project_not_found\' OR path ~ \'^/api/project/[^/]+$\'))'
}

function scannerShareSummaryPredicate() {
    return '(status_code = 404 AND (error_code = \'share_not_found\' OR path ~ \'^/api/share(/tree)?/[^/]+$\'))'
}

function normalizeFilter(value: string | undefined) {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : ''
    return text && text !== 'all' ? text.slice(0, 120) : null
}

function emptySummary() {
    return {
        total: 0,
        last_hour: 0,
        server_errors: 0,
        client_errors: 0,
        status_counts: [],
        surface_counts: [],
        code_counts: [],
        project_scans: 0,
        share_scans: 0,
    }
}
