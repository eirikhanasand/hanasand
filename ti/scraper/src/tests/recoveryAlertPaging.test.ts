import { expect, test } from 'bun:test';
import { PostgresScraperStore } from '../storage/postgresScraperStore.ts';
test('durable alert pages read the alert table and expose the first continuation cursor', async () => {
  const store = Object.create(PostgresScraperStore.prototype) as PostgresScraperStore;
  const sql = { unsafe: async (query: string, values: unknown[]) => {
    expect(query).toContain('FROM threat_intel.alerts');
    expect(values[0]).toBe('probe');
    if (query.includes('count(*)')) return [{ total: 2 }];
    expect(values.at(-1)).toBe(2);
    return ['alert-a', 'alert-b'].map(id => ({ id, updated_at: '2026-09-06T00:00:00Z', record: { id, tenantId: 'probe' } }));
  } };
  Object.assign(store, { sql });
  const page = await store.queryWorkflowRecordsPage({ recordType: 'alert', tenantId: 'probe', limit: 1 });
  expect(page.records).toHaveLength(1);
  expect(page.records[0].id).toBe('alert-a');
  expect(page.total).toBe(2);
  expect(page.nextCursor).toBeTruthy();
});
