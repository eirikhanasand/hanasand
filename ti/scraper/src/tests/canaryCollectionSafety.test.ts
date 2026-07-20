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

  test("runs only explicitly selected due sources", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "first", tenantId: "default", url: "https://example.test/first.xml", status: "active" }));
    store.saveSource(source({ id: "selected", tenantId: "default", url: "https://example.test/selected.xml", status: "active" }));
    const fetched: string[] = [];
    const cycle = await runCanaryCollectionCycle({
      store,
      frontier: new FocusedFrontier(),
      tenantId: "default",
      sourceIds: ["selected"],
      maxSources: 1,
      maxTasks: 1,
      fetch: async (url: string) => {
        fetched.push(url);
        return new Response("<rss><channel></channel></rss>", { headers: { "content-type": "application/rss+xml" } });
      }
    });

    expect(cycle.activeSourceCount).toBe(1);
    expect(fetched).toEqual(["https://example.test/selected.xml"]);
  });

  test("keeps the official CISA catalog bounded without truncating its JSON envelope", async () => {
    const cisa = source({
      id: "src_seed_cisa_known_exploited_vulns",
      type: "api",
      url: "https://www.cisa.gov/kev.json",
      catalog: { canonicalId: "gov:us:cisa:known-exploited-vulnerabilities" }
    });
    const payload = JSON.stringify({
      vulnerabilities: Array.from({ length: 60 }, (_, index) => ({ cveID: `CVE-2026-${4242 + index}`, vulnerabilityName: "Example exploited vulnerability", dateAdded: "2026-06-21" })),
      padding: "x".repeat(600_000)
    });
    const items = await fetchItems(cisa, { id: "task_cisa", targetUrl: cisa.url }, async () => new Response(payload, { headers: { "content-type": "application/json" } }), "native_live_http", "2026-06-22T00:00:00.000Z", 512_000, 12_000, 60);

    expect(items).toHaveLength(60);
    expect(items[0]).toMatchObject({ title: "CVE-2026-4242", metadata: { fetchProvenance: { maxBytes: 4_000_000, truncated: false } } });

    const store = new InMemoryScraperStore();
    store.saveSource(cisa);
    const oldEntry = JSON.stringify({ vulnerabilities: [{ cveID: "CVE-2024-4242", vendorProject: "Vendor", product: "Product", vulnerabilityName: "Example exploited vulnerability", dateAdded: "2024-01-01", shortDescription: "An actively exploited vulnerability allows a remote attacker to compromise affected systems." }] });
    const cycle = await runCanaryCollectionCycle({ store, frontier: new FocusedFrontier(), maxSources: 1, maxTasks: 1, maxItemsPerTask: 1, now: () => "2026-06-22T00:00:00.000Z", fetch: async () => new Response(oldEntry, { headers: { "content-type": "application/json" } }) });
    expect(cycle).toMatchObject({ insertedCaptureCount: 1, skippedLowValueCount: 0 });
  });
});
