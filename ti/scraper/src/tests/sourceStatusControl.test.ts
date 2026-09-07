import { expect, test } from 'bun:test';
import { buildSourceOperationsSnapshot } from '../api/sourceOperations.ts';
import { updateSource } from '../api/sourceRoutes.ts';
import { evaluateSourceForCollection } from '../policy/collectionPolicy.ts';
import type { ApiServerOptions } from '../api/serverTypes.ts';
import type { SourceRecord } from '../types.ts';

test('administrator source activation persists and deactivation stops collection eligibility', async () => {
  let source = { id: 'source', tenantId: 'default', name: 'Public feed', url: 'https://example.com/feed', type: 'rss', accessMethod: 'public_http', status: 'candidate', risk: 'low', trustScore: 0.7, legalNotes: 'Public feed collection basis.', crawlFrequencySeconds: 3600 } as SourceRecord;
  let role = 'system_admin';
  const options = { authApiBase: 'http://auth.test/api', authFetch: async () => Response.json({ id: 'operator', roles: [{ id: role }] }), store: { getSource: () => source, saveSource: (value: SourceRecord) => { source = value; return value; } } } as unknown as ApiServerOptions;
  const request = (status: string, tenantId = 'default') => new Request('http://scraper.test/v1/sources/source', { method: 'PATCH', headers: { id: 'operator', authorization: 'Bearer session', 'content-type': 'application/json' }, body: JSON.stringify({ status, tenantId }) });
  for (const admin of ['system_admin', 'administrator', 'admin']) {
    role = admin;
    expect((await updateSource(request('active'), options, source.id)).status).toBe(200);
    expect(source.status).toBe('active');
    expect(evaluateSourceForCollection(source).allowed).toBe(true);
    expect((await updateSource(request('paused'), options, source.id)).status).toBe(200);
    expect(evaluateSourceForCollection(source).allowed).toBe(false);
  }
  expect((await updateSource(request('active', 'other-tenant'), options, source.id)).status).toBe(404);
  role = 'viewer';
  expect((await updateSource(request('active'), options, source.id)).status).toBe(403);
  expect(source.status).toBe('paused');
  role = 'system_admin';
  source = { ...source, risk: 'medium' };
  expect((await updateSource(request('active'), options, source.id)).status).toBe(400);
  expect(source.status).toBe('paused');
});


test('operator inventory bypasses cached lifecycle status after source changes', async () => {
  let reads = 0;
  const store = { querySourceOperationalPage: async (input: { _skipCache?: boolean }) => {
    expect(input._skipCache).toBe(true);
    reads += 1;
    return { sources: [], total: 0 };
  } };
  await buildSourceOperationsSnapshot(store, { limit: 50 });
  await buildSourceOperationsSnapshot(store, { limit: 50 });
  expect(reads).toBe(2);
});
