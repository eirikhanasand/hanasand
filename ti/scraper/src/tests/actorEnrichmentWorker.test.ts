import { expect, test } from 'bun:test';
import { enrichActor, groundedAdditions } from '../ops/actorEnrichmentWorker.ts';
import { handleActorEnrichmentRequest } from '../api/actorEnrichmentRoutes.ts';
const quote = 'BrainCipher attacked Example Corporation with malicious software in September.';
const actor = { id: 'actor-one', canonicalName: 'BrainCipher', tenantId: 'default', aliases: [], characterization: {} };
const capture = { id: 'capture-one', sourceId: 'news', url: 'https://example.com/news', collectedAt: new Date().toISOString(), metadata: { normalizedEvidence: { text: quote } } };
const fact = { kind: 'victim', value: 'Example Corporation', quote };
test('accepts new quoted facts and rejects repeats, invented quotes, and other actors', () => {
  expect(groundedAdditions(actor, capture, [fact])).toHaveLength(1);
  expect(groundedAdditions({ ...actor, characterization: { victims: [{ value: fact.value }] } }, capture, [fact])).toHaveLength(0);
  expect(groundedAdditions(actor, capture, [{ ...fact, quote: quote + ' New unsupported information.' }])).toHaveLength(0);
  expect(groundedAdditions({ ...actor, canonicalName: 'OtherActor' }, capture, [fact])).toHaveLength(0);
});
test('persists GPU facts and reports zero productivity for a repeated response', async () => {
  let profile: any = actor;
  const runs: any[] = [], deltas: any[] = [];
  const store = { saveActorEnrichmentRun: (run: any) => runs.push(run), listSources: () => [], getActorProfile: () => profile,
    queryActorEnrichmentCaptures: async () => [capture], saveActorProfile: (p: any) => { profile = p; }, saveEvidenceDelta: (d: any) => deltas.push(d) };
  const options = { store, fetch: async () => Response.json({ message: JSON.stringify({ facts: [fact] }) }) };
  await enrichActor(options, actor);
  expect(runs.at(-1)).toMatchObject({ status: 'completed', newFacts: 1, changedActorIds: [actor.id] });
  expect(deltas[0].captureIds).toEqual([capture.id]);
  await enrichActor(options, actor);
  expect(runs.at(-1)).toMatchObject({ status: 'completed', newFacts: 0, wordsAdded: 0 });
  await enrichActor({ ...options, fetch: async () => new Response('', { status: 503 }) }, actor);
  expect(runs.at(-1)).toMatchObject({ status: 'failed', error: 'Hanasand AI returned 503' });
});
test('collection becomes critical after five minutes; rephrasing is not enrichment health', async () => {
  for (const age of [299, 301]) {
    const store = { queryIntelWorkerHealth: async () => ({ collection: { at: new Date(Date.now() - age * 1000).toISOString() }, enrichment: [{ status: 'completed', updatedAt: new Date().toISOString(), newFacts: 0, wordsAdded: 0 }] }) };
    const response = await handleActorEnrichmentRequest(new Request('http://localhost/v1/intel/operations/health'), { store } as any);
    const body = await response!.json();
    expect(body.collection.critical).toBe(age > 300);
    expect(body.enrichment.critical).toBe(true);
    expect(body.enrichment.workerRunning).toBe(true);
  }
});
