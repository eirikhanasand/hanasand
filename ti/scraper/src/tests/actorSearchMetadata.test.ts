import { expect, test } from 'bun:test';
import { searchResponse } from '../api/searchRoute.ts';
import { actorIdentity, seedActorIdentityCatalog, InMemoryScraperStore, FocusedFrontier } from './apiTestHarness.ts';

test('cached and refreshed searches preserve catalog dates and cited descriptions', async () => {
  const store = new InMemoryScraperStore();
  const identity = { ...actorIdentity('G0016', 'APT29'), createdAt: '2014-11-17T00:00:00.000Z', modifiedAt: '2026-08-05T00:00:00.000Z', description: 'Catalog account.(Citation: Example 2026)', referenceSources: [{ name: 'Example 2026', url: 'https://example.com/report' }] };
  seedActorIdentityCatalog(store, [identity]);
  for (const cached of [true, false]) {
    const url = new URL(`http://localhost/v1/intel/search?q=apt29${cached ? '&cached=true' : ''}`);
    const response = await searchResponse(new Request(url), { store, frontier: new FocusedFrontier() }, url);
    expect(response.status).toBe(200);
    const result = await response.json() as any;
    expect(result.actorIdentity.candidates[0]).toMatchObject({ createdAt: identity.createdAt, modifiedAt: identity.modifiedAt, description: identity.description, referenceSources: identity.referenceSources });
  }
});
