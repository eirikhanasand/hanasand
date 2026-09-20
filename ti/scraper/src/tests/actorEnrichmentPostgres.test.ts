import { expect, test } from 'bun:test';
import { SQL } from 'bun';
import { PostgresScraperStore } from '../storage/postgresScraperStore.ts';

const databaseUrl = Bun.env.TI_TEST_DATABASE_URL;
(databaseUrl ? test : test.skip)('moves past reviewed evidence and retains discovered evidence across runs', async () => {
  const sql = new SQL(databaseUrl!, { max: 1 });
  try {
    // Connection-local tables exercise the production query without changing durable records.
    await sql.unsafe('CREATE TEMP TABLE enrichment_attempts (record_type text, tenant_id text, record jsonb)');
    await sql.unsafe('CREATE TEMP TABLE enrichment_captures (id text, tenant_id text, collected_at timestamptz, record jsonb)');
    const text = 'BrainCipher attacked Example Corporation with malicious software in September.';
    for (const [id, tenant, sensitive] of [['reviewed', 'default', false], ['pending', null, false], ['foreign', 'another', false], ['private', 'default', true]] as const) {
      await sql`INSERT INTO enrichment_captures VALUES (${id}, ${tenant}, now(), ${JSON.stringify({ id, body: text, sensitive })}::text::jsonb)`;
    }
    await sql`INSERT INTO enrichment_attempts VALUES ('actor_enrichment_run', 'default', ${JSON.stringify({ actorId: 'actor', discoveredCaptureIds: ['reviewed', 'pending', 'foreign', 'private'], reviewedCaptureIds: ['reviewed'] })}::text::jsonb)`;
    await sql`INSERT INTO enrichment_attempts VALUES ('actor_enrichment_run', 'another', ${JSON.stringify({ actorId: 'actor', reviewedCaptureIds: ['pending'] })}::text::jsonb)`;
    const isolated = (parts: TemplateStringsArray, ...values: any[]) => sql.unsafe(parts.map((part, i) => (i ? `$${i}` : '') + part).join('').replaceAll('threat_intel.workflow_records', 'pg_temp.enrichment_attempts').replaceAll('threat_intel.captures', 'pg_temp.enrichment_captures'), values);
    const query = () => PostgresScraperStore.prototype.queryActorEnrichmentCaptures.call({ sql: isolated } as any, { id: 'actor', tenantId: 'default', captureIds: ['reviewed'] });
    expect((await query()).map((row: any) => row.id)).toEqual(['pending']);
    await sql`INSERT INTO enrichment_attempts VALUES ('actor_enrichment_run', 'default', ${JSON.stringify({ actorId: 'actor', reviewedCaptureIds: ['pending'] })}::text::jsonb)`;
    expect(await query()).toEqual([]);
  } finally { await sql.close(); }
});
