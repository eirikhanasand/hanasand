import { expect, test } from 'bun:test';
import { enrichActor, groundedAdditions, explicitVictimRelation } from '../ops/actorEnrichmentWorker.ts';
import { handleActorEnrichmentRequest } from '../api/actorEnrichmentRoutes.ts';
const quote = 'BrainCipher attacked Example Corporation with malicious software in September.';
const actor = { id: 'actor-one', canonicalName: 'BrainCipher', tenantId: 'default', aliases: [], characterization: {} };
const capture = { id: 'capture-one', sourceId: 'news', url: 'https://example.com/news', collectedAt: new Date().toISOString(), metadata: { normalizedEvidence: { text: quote } } };
const fact = { kind: 'victim', value: 'Example Corporation', quote };
test('accepts new quoted facts and rejects repeats, invented quotes, and other actors', () => {
  expect(groundedAdditions(actor, capture, [fact])).toHaveLength(1);
  expect(groundedAdditions(actor, { ...capture, body: undefined, metadata: { normalizedEvidence: { text: 'BrainCipher Ransomware attacked Example Corporation yesterday.' } } }, [{ kind: 'malware', value: 'BrainCipher Ransomware', quote: 'BrainCipher Ransomware attacked Example Corporation yesterday.' }])).toHaveLength(0);
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
test('flushes fresh collection evidence before querying it for enrichment', async () => {
  let pending = false;
  let readFresh = false;
  const store = {
    saveActorEnrichmentRun() {}, savePlan(plan: any) { expect(plan.tasks[0].availableAt).toBeUndefined(); expect(plan.tasks[0].planning.actorEnrichment.actorId).toBe(actor.id); }, saveRun() {}, getActorProfile: () => actor,
    listSources: () => [{ id: 'search', name: 'Public news', type: 'rss', status: 'active', url: 'https://example.com/?q={query}', accessMethod: 'public_http', risk: 'low', legalNotes: 'Public news', metadata: { sourceFamily: 'public_news_search' }, crawlState: { nextEligibleAt: '2099-01-01T00:00:00Z' } }],
    flush: async () => { pending = false; },
    queryActorEnrichmentCaptures: async (profile: any) => { expect(pending).toBe(false); expect(profile.captureIds).toContain(capture.id); readFresh = true; return []; },
  };
  const { FocusedFrontier } = await import('../frontier/frontier.ts');
  await enrichActor({ store, frontier: new FocusedFrontier(), runExecutor: async () => { pending = true; return { status: 'completed', captureIds: [capture.id] }; } }, actor);
  expect(readFresh).toBe(true);
});

test('health measures hourly productivity despite an isolated model failure', async () => {
  const store = { queryIntelWorkerHealth: async () => ({ collection: { at: new Date().toISOString() }, enrichment: [
    { status: 'failed', updatedAt: new Date().toISOString(), error: 'Model unavailable' },
    { status: 'completed', updatedAt: new Date().toISOString(), newFacts: 2, wordsAdded: 30, changedActorIds: ['actor-one'] },
  ] }) };
  const response = await handleActorEnrichmentRequest(new Request('http://localhost/v1/intel/operations/health'), { store } as any);
  expect((await response!.json()).enrichment).toMatchObject({ critical: false, workerRunning: true, profilesEditedLastHour: 1, newFactsLastHour: 2, error: 'Model unavailable' });
});
test('retries a temporary model connection response without accepting it as evidence', async () => {
  const runs: any[] = []; let calls = 0;
  const store = { saveActorEnrichmentRun: (run: any) => runs.push(run), listSources: () => [], getActorProfile: () => actor,
    queryActorEnrichmentCaptures: async () => [capture], saveActorProfile() {}, saveEvidenceDelta() {} };
  await enrichActor({ store, fetch: async () => Response.json(++calls === 1 ? { status: 'connecting', message: 'Hanasand AI is connecting.' } : { message: JSON.stringify({ facts: [fact] }) }) }, actor);
  expect(calls).toBe(2);
  expect(runs.at(-1)).toMatchObject({ status: 'completed', newFacts: 1 });
});

test('victim evidence requires an attack relationship, not a publisher, tool or generic mention', () => {
  expect(explicitVictimRelation(['Blacknevas'], 'Mefa Group', 'BlackNevas Targets Turkish Industrial Leader Mefa Group')).toBe(true);
  expect(explicitVictimRelation(['Doommageddon'], 'SITTNAK Lojistik A.Ş.', 'Doommageddon Strikes SITTNAK Lojistik A.Ş.')).toBe(true);
  expect(explicitVictimRelation(['M3rx'], 'AusProof', 'Exclusive: AusProof allegedly breached by M3rx ransomware')).toBe(true);
  expect(explicitVictimRelation(['APT28'], 'Trellix', 'Trellix APT28’s Stealthy Multi-Stage Campaign Leveraging CVE')).toBe(false);
  expect(explicitVictimRelation(['APT28'], 'PixyNetLoader', 'APT28 PixyNetLoader Evolves with PNG Steganography')).toBe(false);
  expect(explicitVictimRelation(['Termite'], 'ClickFix', 'Termite ransomware breaches linked to ClickFix CastleRAT attacks')).toBe(false);
  expect(explicitVictimRelation(['Sandworm'], 'OT environments', 'Sandworm uses pre-compromised OT environments instead of zero-days to escalate OT attacks')).toBe(false);
});
