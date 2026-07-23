import { describe, expect, test } from "bun:test";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { runCanaryCollectionCycle } from "../ops/canaryCollection.ts";
import { reconcilePublicSourceProductivity } from "../ops/canaryActivation.ts";
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

  test("caps tasks before enqueue so completed runs leave no orphan queue", async () => {
    const store = new InMemoryScraperStore();
    for (const id of ["a", "b", "c"]) store.saveSource(source({ id, url: `https://example.test/${id}.xml` }));
    const frontier = new FocusedFrontier();
    const fetched: string[] = [];

    const cycle = await runCanaryCollectionCycle({
      store,
      frontier,
      maxSources: 3,
      maxTasks: 2,
      now: () => "2026-07-23T12:00:00.000Z",
      fetch: async (url: string) => {
        fetched.push(url);
        return new Response("<rss><channel></channel></rss>", { headers: { "content-type": "application/rss+xml" } });
      }
    });

    expect(cycle).toMatchObject({ activeSourceCount: 2, queuedTaskCount: 2, leasedTaskCount: 2, completedTaskCount: 2, remainingQueuedTaskCount: 0 });
    expect(fetched).toHaveLength(2);
    expect(frontier.snapshot()).toHaveLength(0);
    expect(store.getSource("c")?.health?.checkedAt).toBeUndefined();
  });

  test("defers due sources instead of overflowing a saturated queue", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "due", url: "https://example.test/due.xml" }));
    const frontier = new FocusedFrontier({ maxQueueSize: 2 });
    for (const id of ["existing-a", "existing-b"]) frontier.enqueueTask({ id, sourceId: id, sourceType: "rss", targetUrl: `https://example.test/${id}`, queuedAt: "2026-07-23T10:00:00.000Z", retryCount: 0 });
    let fetchCount = 0;

    const cycle = await runCanaryCollectionCycle({
      store,
      frontier,
      queueLimit: 2,
      maxSources: 1,
      maxTasks: 1,
      now: () => "2026-07-23T12:00:00.000Z",
      fetch: async () => {
        fetchCount++;
        return new Response("<rss><channel></channel></rss>", { headers: { "content-type": "application/rss+xml" } });
      }
    });

    expect(cycle).toMatchObject({ activeSourceCount: 0, deferredDueSourceCount: 1, queuedTaskCount: 0, availableQueueSlots: 0, backpressureState: "throttled" });
    expect(fetchCount).toBe(0);
    expect(frontier.snapshot().map((item: any) => item.id).sort()).toEqual(["existing-a", "existing-b"]);
  });

  test("does not refresh useful or content timestamps for duplicate-only checks", async () => {
    const store = new InMemoryScraperStore();
    const feed = "<rss><channel><item><title>APT29 campaign report</title><link>https://example.test/report</link><description>APT29 targeted government victims with malware and command infrastructure.</description><pubDate>Wed, 22 Jul 2026 10:00:00 GMT</pubDate></item></channel></rss>";
    store.saveSource(source({ id: "truthful", url: "https://example.test/truthful.xml" }));
    const first = await runCanaryCollectionCycle({ store, frontier: new FocusedFrontier(), maxSources: 1, maxTasks: 1, now: () => "2026-07-22T12:00:00.000Z", fetch: async () => new Response(feed, { headers: { "content-type": "application/rss+xml" } }) });
    const firstSource = structuredClone(store.getSource("truthful"));
    const second = await runCanaryCollectionCycle({ store, frontier: new FocusedFrontier(), maxSources: 1, maxTasks: 1, now: () => "2026-07-23T12:00:00.000Z", fetch: async () => new Response(feed, { headers: { "content-type": "application/rss+xml" } }) });
    const observations = store.listSourceHealthObservations().filter((row: any) => row.sourceId === "truthful");

    expect(first.insertedCaptureCount).toBe(1);
    expect(second.duplicateCaptureCount).toBe(1);
    expect(observations.map((row: any) => [row.captureCount, row.useful])).toEqual([[1, true], [0, false]]);
    expect(store.getSource("truthful")).toMatchObject({
      lastSeenAt: firstSource?.lastSeenAt,
      health: { lastContentAt: firstSource?.health?.lastContentAt, lastUsefulAt: firstSource?.health?.lastUsefulAt }
    });
  });

  test("retires low-risk public feeds only after a real activity window without new captures", () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "unproductive", metadata: { productionCollection: true, canaryPortfolio: true }, crawlFrequencySeconds: 86_400 }));
    for (let index = 0; index < 11; index++) {
      store.saveSourceHealthObservation({
        id: `unproductive-${index}`,
        sourceId: "unproductive",
        checkedAt: new Date(Date.parse("2026-06-01T00:00:00.000Z") + index * 3 * 86_400_000).toISOString(),
        status: "healthy",
        success: true,
        useful: true,
        captureCount: 0
      });
    }

    const first = reconcilePublicSourceProductivity({ store, now: "2026-07-23T12:00:00.000Z" });
    const second = reconcilePublicSourceProductivity({ store, now: "2026-07-23T13:00:00.000Z" });

    expect(first.retired).toEqual([{ sourceId: "unproductive", attemptCount: 11, productiveCheckCount: 0 }]);
    expect(store.getSource("unproductive")).toMatchObject({ status: "retired", metadata: { sourcePortfolioStatus: "retired_unproductive" } });
    expect(second.retired).toEqual([]);
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
