import { describe, expect, test } from "bun:test";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { runCanaryCollectionCycle } from "../ops/canaryCollection.ts";
import { fetchItems } from "../ops/canaryHelpers.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { source } from "./helpers/apiSourceFixtures.ts";

describe("public collection boundary", () => {
  test("never routes restricted or private-network targets through public fetch", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "restricted", type: "tor_metadata", url: "http://metadata-listing.onion", status: "active", risk: "restricted", governance: { metadataOnly: true } }));
    let fetchCount = 0;
    const cycle = await runCanaryCollectionCycle({ store, frontier: new FocusedFrontier(), maxSources: 1, maxTasks: 1, fetch: async () => { fetchCount++; throw new Error("must not fetch"); } });
    expect(cycle.activeSourceCount).toBe(0);
    expect(fetchCount).toBe(0);

    await expect(fetchItems(source({ url: "http://127.0.0.1/admin" }), { targetUrl: "http://127.0.0.1/admin" }, fetch, "native_live_http", new Date().toISOString(), 1_024)).rejects.toThrow("public fetch policy blocked target");
  });
});
