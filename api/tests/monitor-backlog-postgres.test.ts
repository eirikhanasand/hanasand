import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import run from '../src/utils/db.ts'

test('retired discovery parents are not overdue work; active, missing, and other-tenant parents still alert', async () => {
    const source = await readFile(new URL('../src/utils/status/monitor.ts', import.meta.url), 'utf8')
    const query = source.match(/\(SELECT count\(\*\)::int FROM threat_intel\.workflow_records\s+WHERE record_type = 'collection_plan'[\s\S]+?\) AS overdue_discovery/)![0]
        .replaceAll('threat_intel.workflow_records', 'workflow_records').replaceAll('threat_intel.sources', 'sources')
    const result = await run(`WITH sources(id, tenant_id, record) AS (
        VALUES ('active', NULL::text, '{"status":"active"}'::jsonb),
               ('retired', NULL::text, '{"status":"retired"}'::jsonb),
               ('shared', 'other-tenant', '{"status":"retired"}'::jsonb)
    ), workflow_records(id, tenant_id, record_type, record) AS (
        SELECT 'source-feed-discovery-plan_' || parent, NULL::text, 'collection_plan',
            jsonb_build_object('parentSourceId', parent, 'status', 'failed', 'consecutiveFailureCount', 1, 'nextEligibleAt', NOW() - INTERVAL '1 hour')
        FROM unnest(ARRAY['active', 'retired', 'missing', 'shared']) AS parent
    ) SELECT ${query}`)
    expect(result.rows[0].overdue_discovery).toBe(3)
})
