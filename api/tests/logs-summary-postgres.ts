// Opt-in PostgreSQL check. Fixture CTEs shadow production table names; no rows are written.
import { mock } from 'bun:test'
import assert from 'node:assert/strict'
import run, { closeDatabase } from '../src/utils/db.ts'
const execute = run
let summarySql = ''
const capture = async (sql: string) => {
    if (sql.includes('WITH raw_events')) summarySql = sql
    return { rows: [] }
}
mock.module('../src/utils/db.ts', () => ({ default: capture, withTransaction: async (work: any) => work(capture) }))
const { loadErrorEvents } = await import('../src/handlers/logs/errors.ts')
await loadErrorEvents({})
assert.ok(summarySql)
const fixtures = `service_logs AS (
    SELECT jsonb_build_object('category', 'http_response_error', 'surface', 'api',
        'status_code', status::text, 'error_code', code, 'path', path, 'user_agent', agent) AS metadata,
        NOW() - age AS created_at
    FROM (VALUES
        (500, 'failed', '/api/example', 'browser', INTERVAL '2 hours'),
        (400, 'invalid', '/api/example', 'browser', INTERVAL '10 minutes'),
        (404, 'project_not_found', '/api/project/x', 'browser', INTERVAL '10 minutes'),
        (401, 'invalid_session', '/api/docker', 'hanasand_internal', INTERVAL '10 minutes')
    ) row(status, code, path, agent, age)
), login_events AS (
    SELECT 'failure'::text AS status, 'bad_password'::text AS reason, NOW() AS created_at
), traffic_events AS (
    SELECT status, path, user_agent, NOW() AS created_at
    FROM (VALUES
        (503, '/example', 'browser'),
        (404, '/api/project/x', 'browser'),
        (404, '/api/share/x', 'browser'),
        (404, '/api/docker', 'hanasand_internal'),
        (200, '/example', 'browser')
    ) row(status, path, user_agent)
), `
try {
    for (const includeExpected of [false, true]) {
        const { rows: [summary] } = await execute(summarySql.replace('WITH raw_events', `WITH ${fixtures}raw_events`), [includeExpected])
        assert.equal(summary.total, includeExpected ? 9 : 4)
        assert.equal(summary.last_hour, includeExpected ? 8 : 3)
        assert.equal(summary.server_errors, 2)
        assert.equal(summary.client_errors, includeExpected ? 7 : 2)
        assert.equal(summary.project_scans, 2)
        assert.equal(summary.share_scans, 1)
        for (const key of ['status_counts', 'surface_counts', 'code_counts']) {
            assert.equal(summary[key].reduce((total: number, row: any) => total + row.count, 0), summary.total)
        }
    }
    console.log('Log summary PostgreSQL fixtures passed: totals, time window, scanners, probes, distributions.')
} finally { await closeDatabase() }
