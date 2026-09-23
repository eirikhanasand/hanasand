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
  let profile: any = { ...actor, characterization: { victims: [{ value: 'Profile-only historical company' }] } };
  const runs: any[] = [], deltas: any[] = [];
  const store = { saveActorEnrichmentRun: (run: any) => runs.push(run), listSources: () => [], getActorProfile: () => profile,
    queryActorEnrichmentCaptures: async () => [capture], saveActorProfile: (p: any) => { profile = p; }, saveEvidenceDelta: (d: any) => deltas.push(d) };
  const options = { store, fetch: async (_input: any, init: any) => {
    const prompt = JSON.parse(init.body).prompt;
    expect(prompt).not.toContain('Profile-only historical company');
    expect(prompt).not.toContain('existingFacts');
    expect(prompt).toContain(quote);
    return Response.json({ message: JSON.stringify({ facts: [fact] }) });
  } };
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
    saveActorEnrichmentRun() {}, savePlan(plan: any) { expect(plan.tasks[0].planning.maxItemsPerFetch).toBe(20); expect(plan.tasks[0].availableAt).toBeUndefined(); expect(plan.tasks[0].planning.actorEnrichment.actorId).toBe(actor.id); }, saveRun() {}, getActorProfile: () => actor,
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

test('persists reviewed empty evidence but leaves failed evidence available for retry', async () => {
  const runs: any[] = []; let calls = 0;
  const second = { ...capture, id: 'capture-two' };
  const store = { saveActorEnrichmentRun: (run: any) => runs.push(structuredClone(run)), listSources: () => [], getActorProfile: () => actor,
    queryActorEnrichmentCaptures: async () => [capture, second], flush: async () => {} };
  await enrichActor({ store, fetch: async () => Response.json({ message: ++calls === 1 ? '{"facts":[]}' : '{"unexpected":true}' }) }, actor);
  expect(calls).toBe(3);
  expect(runs.at(-1)).toMatchObject({ status: 'failed', reviewedCaptureIds: [capture.id], error: 'Hanasand AI returned an invalid facts response' });
  expect(runs.some(run => run.status === 'running' && run.reviewedCaptureIds.includes(capture.id))).toBe(true);
});
test('retries malformed model output before recording a review', async () => {
  const runs: any[] = []; let calls = 0;
  const store = { saveActorEnrichmentRun: (run: any) => runs.push(structuredClone(run)), listSources: () => [], getActorProfile: () => actor,
    queryActorEnrichmentCaptures: async () => [capture] };
  await enrichActor({ store, fetch: async () => Response.json({ message: ++calls === 1 ? 'not JSON' : '{"facts":[]}' }) }, actor);
  expect(calls).toBe(2);
  expect(runs.at(-1)).toMatchObject({ status: 'completed', newFacts: 0, reviewedCaptureIds: [capture.id] });
});

test('bare fact arrays mark empty evidence reviewed and allow the next grounded capture', async () => {
  const runs: any[] = [], deltas: any[] = []; let calls = 0;
  const second = { ...capture, id: 'capture-two' };
  const store = { saveActorEnrichmentRun: (run: any) => runs.push(structuredClone(run)), listSources: () => [], getActorProfile: () => actor,
    queryActorEnrichmentCaptures: async () => [capture, second], saveActorProfile() {}, saveEvidenceDelta: (delta: any) => deltas.push(delta) };
  await enrichActor({ store, fetch: async () => Response.json({ message: ++calls === 1 ? '```json\n[]\n```' : JSON.stringify([fact]) }) }, actor);
  expect(calls).toBe(2);
  expect(runs.at(-1)).toMatchObject({ status: 'completed', newFacts: 1, reviewedCaptureIds: [capture.id, second.id] });
  expect(deltas[0].captureIds).toEqual([second.id]);
});

test.each([null, { ...fact, quote: undefined }, { ...fact, value: 7 }])('bare arrays still reject malformed facts: %j', async invalid => {
  const runs: any[] = [];
  const store = { saveActorEnrichmentRun: (run: any) => runs.push(structuredClone(run)), listSources: () => [], getActorProfile: () => actor,
    queryActorEnrichmentCaptures: async () => [capture], saveActorProfile() { throw Error('Invalid facts must not be saved'); } };
  await enrichActor({ store, fetch: async () => Response.json({ message: JSON.stringify([invalid]) }) }, actor);
  expect(runs.at(-1)).toMatchObject({ status: 'failed', reviewedCaptureIds: [], error: 'Hanasand AI returned an invalid facts response' });
});

test('retries a temporary HTTP model failure without losing pending evidence', async () => {
  const runs: any[] = []; let calls = 0;
  const store = { saveActorEnrichmentRun: (run: any) => runs.push(structuredClone(run)), listSources: () => [], getActorProfile: () => actor,
    queryActorEnrichmentCaptures: async () => [capture] };
  await enrichActor({ store, fetch: async () => ++calls === 1 ? new Response('', { status: 503 }) : Response.json({ message: '{"facts":[]}' }) }, actor);
  expect(calls).toBe(2);
  expect(runs.at(-1)).toMatchObject({ status: 'completed', reviewedCaptureIds: [capture.id] });
});

test('actor discovery collects beyond the ordinary two-item sweep without changing ordinary limits', async () => {
  const { InMemoryScraperStore } = await import('../storage/memoryStore.ts');
  const { FocusedFrontier } = await import('../frontier/frontier.ts');
  const { createCollectionPlan } = await import('../planner/intelligencePlanner.ts');
  const { executeScheduledCollectionRun } = await import('../ops/scheduledCollection.ts');
  const { source } = await import('./helpers/apiSourceFixtures.ts');
  for (const enrichment of [false, true]) {
    const store = new InMemoryScraperStore(), frontier = new FocusedFrontier();
    const feed = source({ metadata: { sourceFamily: 'public_news_search', maxItemsPerFetch: 4 }, url: 'https://example.test/search?q={query}' });
    store.saveSource(feed);
    const at = new Date().toISOString();
    const plan = createCollectionPlan({ id: 'request', query: 'BrainCipher ransomware', entityType: 'free_text', includeClearWeb: true, includeTelegram: false, includeDarknetMetadata: false, budgetClass: 'broad_daily_sweep', maxTasks: 1, createdAt: at, requesterId: 'test', reason: 'Discover evidence' } as any, [feed], frontier);
    store.savePlan({ ...plan, tasks: plan.tasks.map(task => ({ ...task, runId: 'run', planning: { ...task.planning, maxItemsPerFetch: 20, ...(enrichment ? { actorEnrichment: { actorId: 'actor' } } : {}) } })) });
    store.saveRun({ id: 'run', planId: plan.id, requestId: 'request', status: 'queued', trigger: 'automated', createdAt: at, startedAt: at, updatedAt: at, taskCount: plan.tasks.length, captureCount: 0, incidentCount: 0 } as any);
    const items = Array.from({ length: 6 }, (_, i) => `<item><title>BrainCipher attacked Company ${i}</title><link>https://example.test/article/${i}</link><description>BrainCipher ransomware attacked Company ${i} and claimed theft of customer records.</description><pubDate>${new Date().toUTCString()}</pubDate></item>`).join('');
    const result = await executeScheduledCollectionRun({ store, frontier, maxItemsPerTask: 2, fetch: async () => new Response(`<rss><channel>${items}</channel></rss>`, { headers: { 'content-type': 'application/rss+xml' } }) }, 'run');
    expect(result.captureIds).toHaveLength(enrichment ? 6 : 2);
  }
});
