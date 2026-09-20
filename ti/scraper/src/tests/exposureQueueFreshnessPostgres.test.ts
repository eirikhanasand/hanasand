import { expect, test } from "bun:test";
import { PostgresScraperStore } from "../storage/postgresScraperStore.ts";
import { source } from "./helpers/apiSourceFixtures.ts";
import { fixtureCapture } from "./helpers/storageFixtures.ts";

const databaseUrl = Bun.env.TI_TEST_DATABASE_URL;

(databaseUrl ? test : test.skip)("keeps exposure source freshness independent of pagination and refreshes quiet checks", async () => {
  const store = await PostgresScraperStore.create({ databaseUrl });
  const marker = `HA50135fixture-${crypto.randomUUID()}`;
  try {
    for (const [label, at] of [["newest", "2026-09-19T12:00:00Z"], ["older", "2026-09-19T11:00:00Z"]]) {
      const id = `${marker}-${label}`;
      store.saveSource(source({ id, url: `https://example.test/${id}`, name: `Victim feed ${marker}`, health: { status: "healthy", lastSuccessAt: at } }));
      store.saveCapture(fixtureCapture({ id: `capture_${id}`, contentHash: `hash_${id}`, sourceId: id, collectedAt: at, publishedAt: at,
        metadata: { leakSite: { actorName: "Example", victimName: id } } }));
    }
    await store.flush();
    const input = { tenantId: "default", filters: { q: marker }, limit: 1, offset: 0, global: true };
    const first = await store.queryExposureQueuePage(input);
    expect(first.captures[0].sourceId).toBe(`${marker}-newest`);
    const checkedAt = "2026-09-20T02:00:00.000Z";
    store.saveSource({ ...store.getSource(`${marker}-older`)!, health: { status: "healthy", lastSuccessAt: checkedAt } });
    await store.flush();
    await Promise.all([...(store as any).exposureQueuePageCache.values()].map((entry: any) => entry.refreshing));
    for (const offset of [0, 1, 10]) {
      const page = await store.queryExposureQueuePage({ ...input, offset });
      expect(new Date(String(page.latestCollectionCheckAt)).toISOString()).toBe(checkedAt);
      expect(page.total).toBe(2);
    }
  } finally { await store.close(); }
});

