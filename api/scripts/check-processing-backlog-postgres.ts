import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { withTransaction, closeDatabase } from '../src/utils/db.ts'

// All writes are connection-local temporary fixtures, never application tables.
const source = await readFile(process.argv[2] || new URL('../src/utils/status/monitor.ts', import.meta.url), 'utf8')
const sql = source.split("check('threat-intelligence', 'Processing backlog'")[1].split('await run(`')[1].split('`)')[0]
    .replaceAll('threat_intel.', 'pg_temp.').replaceAll('public.dwm_webhook_deliveries', 'pg_temp.dwm_webhook_deliveries')
try {
    await withTransaction(async query => {
        await query(`
            CREATE TEMP TABLE workflow_records(record_type text, id text, tenant_id text, updated_at timestamptz, record jsonb) ON COMMIT DROP;
            CREATE TEMP TABLE sources(id text, tenant_id text, collection_executable boolean, record jsonb) ON COMMIT DROP;
            CREATE TEMP TABLE captures(source_id text, tenant_id text) ON COMMIT DROP;
            CREATE TEMP TABLE dwm_webhook_deliveries(destination_id text, idempotency_key text, status text, updated_at timestamptz) ON COMMIT DROP;
        `)
        const empty = (await query(sql)).rows[0]
        assert.deepEqual(Object.values(empty), [0, 0, 0, 0, 0, 0])
        for (const [id, state, minutes, version] of [
            ['completed', 'queued', 180, 'v4'], ['completed', 'done', 5, 'v4'],
            ['active', 'queued', 180, 'v4'], ['active', 'running', 60, 'v4'],
            ['recent', 'retrying', 10, 'v4'],
            ['old', 'queued', 240, 'v3'], ['missing-version', 'queued', 300, null],
            [null, 'queued', 200, 'v4'], [null, 'running', 120, 'v4'],
        ] as const) {
            await query(`INSERT INTO workflow_records VALUES ('analyst_metadata_review_task', $1, NULL, NOW()-$2::int*INTERVAL '1 minute', $3::jsonb)`,
                [String(id) + minutes, minutes, JSON.stringify({ id, state, promptVersion: version ? 'ti.automatic_intelligence_review.prompt.' + version : null, recordKind: 'automatic_intelligence_review_task' })])
        }
        for (const [id, tenant, captureTenant, approved] of [
            ['global', null, null, false], ['tenant', 'a', 'a', false],
            ['wrong-tenant', 'a', 'b', false], ['null-is-not-empty', null, '', false],
            ['approved', null, null, true],
        ] as const) {
            await query('INSERT INTO sources VALUES ($1,$2,true,$3::jsonb)', [id, tenant, JSON.stringify({ metadata: { sourceFeedDiscovery: {}, automaticSourceReview: { state: approved ? 'approved' : 'pending' } } })])
            await query('INSERT INTO captures VALUES ($1,$2),($1,$2)', [id, captureTenant])
        }
        await query(`
            INSERT INTO sources VALUES ('retired',NULL,false,'{"status":"retired"}');
            INSERT INTO workflow_records VALUES
            ('collection_plan','source-feed-discovery-plan_active',NULL,NOW(),'{"status":"failed","consecutiveFailureCount":1,"nextEligibleAt":"2020-01-01T00:00:00Z"}'),
            ('collection_plan','source-feed-discovery-plan_retired',NULL,NOW(),'{"status":"failed","consecutiveFailureCount":1,"nextEligibleAt":"2020-01-01T00:00:00Z","parentSourceId":"retired"}'),
            ('evaluation_benchmark','evaluation',NULL,NOW()-INTERVAL '5 hours','{"status":"annotating","protocol":{"version":"ti.independent_extraction_benchmark.v4"}}');
            INSERT INTO dwm_webhook_deliveries VALUES
            (NULL,'recovered','failed',NOW()-INTERVAL '2 hours'),
            (NULL,'recovered','delivered',NOW()-INTERVAL '1 hour'),
            ('a','pending','failed',NOW()-INTERVAL '1 hour');
        `)
        assert.deepEqual((await query(sql)).rows[0], {
            stale_reviews: 2, oldest_review_age_minutes: 120, overdue_discovery: 1,
            stalled_evaluations: 1, unreviewed_sources: 2, recent_delivery_failures: 1,
        })
        await query(`INSERT INTO workflow_records VALUES ('analyst_metadata_review_task','latest',NULL,NOW(),
            '{"id":"active","state":"done","promptVersion":"ti.automatic_intelligence_review.prompt.v4","recordKind":"automatic_intelligence_review_task"}')`)
        assert.equal((await query(sql)).rows[0].stale_reviews, 1)
    })
    console.log('PASS: empty backlog, latest-state deduplication, obsolete prompts, null IDs, tenant isolation, capture existence, retired parents, evaluations and recovered deliveries.')
} finally { await closeDatabase() }
