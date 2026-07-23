import { describe, expect, test } from "bun:test";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { activatePublicCanarySources, runCanaryCollectionCycle } from "../ops/canaryCollection.ts";
import { fetchItems } from "../ops/canaryHelpers.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { source } from "./helpers/apiSourceFixtures.ts";

describe("public collection boundary", () => {
  test("reconciles corrected portfolio configuration without erasing runtime evidence", () => {
    const store = new InMemoryScraperStore();
    store.saveSource({
      ...source({
        id: "src_reconciled", name: "Old name", url: "https://old.example.test/feed", status: "active",
        legalNotes: "Old notes", metadata: { productionCollection: true, lastCanaryFetchMode: "native_live_http" }
      }),
      health: { status: "healthy", checkedAt: "2026-07-22T12:00:00.000Z", lastUsefulAt: "2026-07-22T12:00:00.000Z" },
      crawlState: { retryCount: 0, nextEligibleAt: "2026-07-22T13:00:00.000Z" }
    });

    const result = activatePublicCanarySources({
      store,
      now: "2026-07-23T00:00:00.000Z",
      portfolio: [{
        id: "src_reconciled", name: "Correct publisher feed", url: "https://publisher.example.test/feed", status: "paused",
        type: "rss", accessMethod: "public_http", risk: "low", trustScore: 0.9, crawlFrequencySeconds: 3600,
        legalNotes: "Publisher-operated public feed",
        metadata: { productionCollection: true, canaryPortfolio: true, publisherReference: "https://publisher.example.test" }
      }]
    });

    expect(result.alreadyActive).toEqual(["src_reconciled"]);
    expect(store.getSource("src_reconciled")).toMatchObject({
      name: "Correct publisher feed", url: "https://publisher.example.test/feed", status: "active",
      legalNotes: "Publisher-operated public feed",
      metadata: { lastCanaryFetchMode: "native_live_http", publisherReference: "https://publisher.example.test" },
      health: { checkedAt: "2026-07-22T12:00:00.000Z", lastUsefulAt: "2026-07-22T12:00:00.000Z" },
      crawlState: { retryCount: 0, nextEligibleAt: "2026-07-22T13:00:00.000Z" }
    });
  });

  test("never routes restricted or private-network targets through public fetch", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "restricted", type: "tor_metadata", url: "http://metadata-listing.onion", status: "active", risk: "restricted", governance: { metadataOnly: true } }));
    let fetchCount = 0;
    const cycle = await runCanaryCollectionCycle({ store, frontier: new FocusedFrontier(), maxSources: 1, maxTasks: 1, fetch: async () => { fetchCount++; throw new Error("must not fetch"); } });
    expect(cycle.activeSourceCount).toBe(0);
    expect(fetchCount).toBe(0);

    await expect(fetchItems(source({ url: "http://127.0.0.1/admin" }), { targetUrl: "http://127.0.0.1/admin" }, fetch, "native_live_http", new Date().toISOString(), 1_024)).rejects.toThrow("public fetch policy blocked target");
  });

  test("collects low-risk public HTTP sources that retain only metadata and safe excerpts", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ governance: { approvalRequired: false, approvalState: "approved", metadataOnly: true }, metadata: { productionCollection: true, contentPolicy: "metadata_and_safe_excerpt_only" } }));
    let fetchCount = 0;
    const cycle = await runCanaryCollectionCycle({
      store,
      frontier: new FocusedFrontier(),
      maxSources: 1,
      maxTasks: 1,
      fetch: async () => {
        fetchCount++;
        return new Response("<rss><channel></channel></rss>", { headers: { "content-type": "application/rss+xml" } });
      }
    });

    expect(cycle).toMatchObject({ activeSourceCount: 1, completedTaskCount: 1, failedTaskCount: 0 });
    expect(fetchCount).toBe(1);
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

  test("runs shared and exact-tenant sources while preserving tenant run scope", async () => {
    const generatedAt = "2026-07-22T12:00:00.000Z";
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "shared", tenantId: undefined, url: "https://example.test/shared.xml" }));
    store.saveSource(source({ id: "tenant-a", tenantId: "tenant_a", url: "https://example.test/tenant-a.xml" }));
    store.saveSource(source({ id: "tenant-b", tenantId: "tenant_b", url: "https://example.test/tenant-b.xml" }));
    const fetched: string[] = [];
    const feed = (url: string) => `<rss><channel><item><title>APT29 public campaign report</title><link>${url}/report</link><description>APT29 targeted government victims with credential theft malware and command infrastructure.</description><pubDate>${generatedAt}</pubDate></item></channel></rss>`;
    const cycle = await runCanaryCollectionCycle({
      store,
      frontier: new FocusedFrontier(),
      tenantId: "tenant_a",
      maxSources: 3,
      maxTasks: 3,
      now: () => generatedAt,
      fetch: async (url: string) => {
        fetched.push(url);
        return new Response(feed(url), { headers: { "content-type": "application/rss+xml" } });
      }
    });

    expect(fetched.sort()).toEqual(["https://example.test/shared.xml", "https://example.test/tenant-a.xml"]);
    expect(cycle).toMatchObject({ tenantId: "tenant_a", activeSourceCount: 2, queuedTaskCount: 2, insertedCaptureCount: 2 });
    expect(store.getPlan(cycle.planId)).toMatchObject({ tenantId: "tenant_a" });
    expect(store.getRun(cycle.runId)).toMatchObject({ tenantId: "tenant_a", sourceCount: 2, captureCount: 2 });
    expect(store.listCaptures().map((capture: any) => [capture.sourceId, capture.tenantId]).sort()).toEqual([
      ["shared", undefined],
      ["tenant-a", "tenant_a"]
    ]);

    const globalStore = new InMemoryScraperStore();
    globalStore.saveSource(source({ id: "shared", tenantId: undefined, url: "https://example.test/shared.xml" }));
    globalStore.saveSource(source({ id: "tenant-a", tenantId: "tenant_a", url: "https://example.test/tenant-a.xml" }));
    const globalFetched: string[] = [];
    const globalCycle = await runCanaryCollectionCycle({
      store: globalStore,
      frontier: new FocusedFrontier(),
      maxSources: 2,
      maxTasks: 2,
      now: () => generatedAt,
      fetch: async (url: string) => {
        globalFetched.push(url);
        return new Response(feed(url), { headers: { "content-type": "application/rss+xml" } });
      }
    });
    expect(globalFetched).toEqual(["https://example.test/shared.xml"]);
    expect(globalStore.getRun(globalCycle.runId)).toMatchObject({ tenantId: undefined, sourceCount: 1 });
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

  test("captures structured ransomware group profiles without manufacturing incidents", async () => {
    const groups = source({
      id: "src_seed_ransomwarelive_groups", type: "api", url: "https://data.ransomware.live/groups.json",
      catalog: { canonicalId: "community:ransomwarelive:groups" }, metadata: { extractionProfile: "ransomware_group_metadata", canaryPortfolio: true }
    });
    const payload = JSON.stringify(Array.from({ length: 25 }, (_, index) => ({ name: `Quiet Example ${index}`, _victim_count: index + 1, locations: [{ type: "Chat", fqdn: `${"a".repeat(56)}.onion` }] })));
    const items = await fetchItems(groups, { id: "task_groups", targetUrl: groups.url }, async () => new Response(payload, { headers: { "content-type": "application/json" } }), "native_live_http", "2026-07-20T00:00:00.000Z", 512_000, 12_000, 1);
    expect(items).toHaveLength(24);
    expect(items[0]).toMatchObject({ metadata: { fetchProvenance: { maxBytes: 2_000_000 }, extractionProfile: "ransomware_group_metadata" } });

    const store = new InMemoryScraperStore();
    store.saveSource(groups);
    const cycle = await runCanaryCollectionCycle({ store, frontier: new FocusedFrontier(), maxSources: 1, maxTasks: 1, maxItemsPerTask: 1, now: () => "2026-07-20T00:00:00.000Z", fetch: async () => new Response(payload, { headers: { "content-type": "application/json" } }) });
    expect(cycle).toMatchObject({ insertedCaptureCount: 24, incidentCount: 0, skippedLowValueCount: 0 });
    expect(store.listExtractedEntities()).toContainEqual(expect.objectContaining({ type: "channel_type", value: "Chat" }));
    expect(store.listExtractedEntities().some((entity: any) => ["communication_channel", "buyer_seller_communication", "monetization_path", "profitability_signal"].includes(entity.type))).toBe(false);
    expect(cycle.health.promotionYield).toBe(0);
  });
});
