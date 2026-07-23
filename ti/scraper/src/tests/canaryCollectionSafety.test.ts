import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { findSearchCaptures } from "../api/searchCaptureIndex.ts";
import { runCanaryCollectionCycle, startCanaryCollectionLoop } from "../ops/canaryCollection.ts";
import { reconcilePublicSourceProductivity } from "../ops/canaryActivation.ts";
import { fetchItems } from "../ops/canaryHelpers.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { source } from "./helpers/apiSourceFixtures.ts";
import { fixtureCapture } from "./helpers/storageFixtures.ts";

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

    expect(cycle).toMatchObject({ activeSourceCount: 2, deferredDueSourceCount: 1, queuedTaskCount: 2, leasedTaskCount: 2, completedTaskCount: 2, remainingQueuedTaskCount: 0 });
    expect(fetched).toHaveLength(2);
    expect(frontier.snapshot()).toHaveLength(0);
    expect(store.getSource("c")?.health?.checkedAt).toBeUndefined();
  });

  test("supersedes an unleased queued task after a competing run covers the same source job", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "covered", url: "https://example.test/covered.xml", crawlFrequencySeconds: 900 }));
    const strandedFrontier = new FocusedFrontier();
    const lease = strandedFrontier.next.bind(strandedFrontier);
    let leaseUnavailable = true;
    strandedFrontier.next = ((...args: any[]) => {
      if (leaseUnavailable) {
        leaseUnavailable = false;
        return undefined;
      }
      return lease(...args);
    }) as any;
    let networkExecutionCount = 0;
    const feed = "<rss><channel><item><title>APT29 malware campaign</title><link>https://example.test/report</link><description>APT29 targeted government victims with malware and command infrastructure.</description><pubDate>Thu, 23 Jul 2026 12:00:00 GMT</pubDate></item></channel></rss>";

    const loop = startCanaryCollectionLoop({
      store,
      frontier: strandedFrontier,
      enabled: false,
      maxSources: 1,
      maxTasks: 1,
      now: () => "2026-07-23T12:00:00.000Z",
      fetch: async () => { throw new Error("deferred task must not fetch"); }
    });
    loop.setEnabled(true, { approvedBy: "source-accounting-test" });
    await loop.runOnce();
    const deferred = loop.getState().latestResult;
    expect(loop.getState()).toMatchObject({ successCount: 0, errorCount: 0, deferredCount: 1, latestResult: { status: "queued" } });
    await loop.stop();
    const competing = await runCanaryCollectionCycle({
      store,
      frontier: new FocusedFrontier(),
      maxSources: 1,
      maxTasks: 1,
      now: () => "2026-07-23T12:01:00.000Z",
      fetch: async () => {
        networkExecutionCount++;
        return new Response(feed, { headers: { "content-type": "application/rss+xml" } });
      }
    });
    const reconciled = await runCanaryCollectionCycle({
      store,
      frontier: strandedFrontier,
      maxSources: 1,
      maxTasks: 1,
      now: () => "2026-07-23T12:02:00.000Z",
      fetch: async () => { throw new Error("covered task must not refetch"); }
    });

    expect(deferred).toMatchObject({ status: "queued", queuedTaskCount: 1, leasedTaskCount: 0, completedTaskCount: 0, failedTaskCount: 0, remainingQueuedTaskCount: 1 });
    expect(store.getRun(deferred.runId)).toMatchObject({ status: "superseded", completedTaskCount: 0, supersededTaskCount: 1 });
    expect(competing).toMatchObject({ status: "completed", completedTaskCount: 1, insertedCaptureCount: 1, remainingQueuedTaskCount: 0 });
    expect(reconciled).toMatchObject({ status: "completed", supersededTaskCount: 1, queuedTaskCount: 0, remainingQueuedTaskCount: 0 });
    expect(networkExecutionCount).toBe(1);
    expect(strandedFrontier.snapshot()).toHaveLength(0);
    expect(Date.parse(store.getSource("covered")!.crawlState!.nextEligibleAt!)).toBeGreaterThan(Date.parse("2026-07-23T12:02:00.000Z"));
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

  test("drains the production-shaped exact-default fleet without crossing tenant scope", async () => {
    const store = new InMemoryScraperStore();
    for (let index = 0; index < 131; index++) {
      store.saveSource(source({
        id: `default-${String(index).padStart(3, "0")}`,
        tenantId: "default",
        url: `https://default.example.test/${index}.xml`,
        crawlFrequencySeconds: index < 5 ? 900 : 3_600,
        metadata: { productionCollection: true }
      }));
    }
    store.saveSource(source({ id: "global", tenantId: undefined, url: "https://global.example.test/feed.xml", metadata: { productionCollection: true } }));
    store.saveSource(source({ id: "customer", tenantId: "customer", url: "https://customer.example.test/feed.xml", metadata: { productionCollection: true } }));
    const fetched: string[] = [];
    const frontier = new FocusedFrontier({ maxQueueSize: 10_000 });
    const cycles: Awaited<ReturnType<typeof runCanaryCollectionCycle>>[] = [];
    for (let index = 0; index < 3; index++) {
      const at = new Date(Date.parse("2026-07-23T12:00:00.000Z") + index * 300_000).toISOString();
      cycles.push(await runCanaryCollectionCycle({
        store,
        frontier,
        tenantId: "default",
        includeSharedSources: false,
        maxSources: 60,
        maxTasks: 60,
        maxConcurrentTasks: 2,
        queueLimit: 10_000,
        now: () => at,
        fetch: async (url: string) => {
          fetched.push(url);
          return new Response("<rss><channel></channel></rss>", { headers: { "content-type": "application/rss+xml" } });
        }
      }));
    }

    expect(cycles.map((cycle) => [cycle.activeSourceCount, cycle.deferredDueSourceCount])).toEqual([[60, 71], [60, 11], [11, 0]]);
    expect(fetched).toHaveLength(131);
    expect(fetched.every((url) => url.startsWith("https://default.example.test/"))).toBe(true);
    expect(new Set(store.listSourceHealthObservations().map((row) => row.sourceId))).toHaveLength(131);
    expect(frontier.snapshot()).toHaveLength(0);
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

  test("uses each feed's declared publishing activity window for relevance", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "slow-feed", url: "https://security.example.org/feed.xml", metadata: { productionCollection: true, activityWindowSeconds: 365 * 86_400 } }));
    const feed = "<rss><channel><item><title>CVE-2026-4242 security advisory</title><link>https://security.example.org/advisories/4242</link><description>A critical vulnerability allows remote attackers to exploit affected systems; the vendor published remediation and detection guidance.</description><pubDate>2026-01-01T00:00:00Z</pubDate></item></channel></rss>";
    const cycle = await runCanaryCollectionCycle({
      store,
      frontier: new FocusedFrontier(),
      maxSources: 1,
      maxTasks: 1,
      now: () => "2026-07-23T12:00:00.000Z",
      fetch: async () => new Response(feed, { headers: { "content-type": "application/rss+xml" } })
    });

    expect(cycle).toMatchObject({ insertedCaptureCount: 1, skippedLowValueCount: 0 });
  });

  test("keeps current low-cadence multilingual intelligence in collection and search", async () => {
    const store = new InMemoryScraperStore();
    const publishedAt = "2026-01-15T00:00:00Z";
    const items = new Map([
      ["fi", ["CVE-2026-4101 haavoittuvuus tietoturvapäivityksessä", "Vakava haavoittuvuus mahdollistaa etähyökkäyksen, ja toimittaja julkaisi korjauksen sekä suojautumisohjeet."]],
      ["sv", ["CVE-2026-4102 sårbarhet och säkerhetsbrist", "En kritisk sårbarhet möjliggör fjärrangrepp mot berörda system; leverantören har publicerat uppdatering och skyddsåtgärder."]],
      ["pl", ["CVE-2026-4103 podatność w komponencie sieciowym", "Krytyczna podatność umożliwia zdalny cyberatak na systemy; producent opublikował poprawkę oraz zalecenia bezpieczeństwa."]],
      ["fr", ["CVE-2026-4104 vulnérabilité critique", "Cette vulnérabilité permet une cyberattaque à distance contre les systèmes concernés; le fournisseur publie un correctif et des mesures de protection."]],
      ["nl", ["CVE-2026-4105 kwetsbaarheid in netwerkdienst", "Een kritieke kwetsbaarheid maakt een cyberaanval op getroffen systemen mogelijk; de leverancier publiceerde een update en beschermingsadvies."]]
    ]);
    for (const language of items.keys()) {
      store.saveSource(source({
        id: `multilingual-${language}`,
        tenantId: "default",
        url: `https://security.example.org/${language}.xml`,
        metadata: { productionCollection: true, queryClass: "threat-intel", sourceFamily: "clear_web" }
      }));
    }
    const cycle = await runCanaryCollectionCycle({
      store,
      frontier: new FocusedFrontier(),
      tenantId: "default",
      maxSources: items.size,
      maxTasks: items.size,
      now: () => "2026-07-23T12:00:00.000Z",
      fetch: async (url: string) => {
        const language = url.match(/\/([a-z]{2})\.xml$/)?.[1] ?? "";
        const [title, description] = items.get(language) ?? [];
        return new Response(`<rss><channel><item><title>${title}</title><link>${url}/advisory</link><description>${description}</description><pubDate>${publishedAt}</pubDate></item></channel></rss>`, { headers: { "content-type": "application/rss+xml" } });
      }
    });

    expect(cycle).toMatchObject({ insertedCaptureCount: 5, skippedLowValueCount: 0 });
    for (const [title] of items.values()) {
      const cve = title.match(/CVE-\d{4}-\d+/)?.[0] ?? "";
      expect(findSearchCaptures(store, cve, 1, "default")).toHaveLength(1);
    }
  });

  test("retires public Telegram and Tor feeds only after a full scheduled activity window without new captures", () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "unproductive", metadata: { productionCollection: true, canaryPortfolio: true }, crawlFrequencySeconds: 86_400 }));
    store.saveSource(source({ id: "telegram-unproductive", type: "telegram_public", url: "https://t.me/publicinteltest", metadata: { productionCollection: true, canaryPortfolio: true, collectionMode: "public_web_preview" }, governance: { approvalRequired: true, approvalState: "approved", approvedAt: "2026-06-01T00:00:00.000Z", approvedBy: "reviewer" }, crawlFrequencySeconds: 86_400 }));
    store.saveSource(source({ id: "tor-unproductive", type: "tor_metadata", accessMethod: "approved_proxy", risk: "restricted", url: `http://${"a".repeat(56)}.onion/`, metadata: { productionCollection: true, sourcePortfolioVerification: { outcome: "content_parsed" } }, governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-06-01T00:00:00.000Z", approvedBy: "reviewer" }, crawlFrequencySeconds: 86_400 }));
    store.saveSource(source({ id: "tor-productive", type: "tor_metadata", accessMethod: "approved_proxy", risk: "restricted", url: `http://${"c".repeat(56)}.onion/`, metadata: { productionCollection: true, sourcePortfolioVerification: { outcome: "content_parsed" } }, governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-06-01T00:00:00.000Z", approvedBy: "reviewer" }, crawlFrequencySeconds: 86_400 }));
    store.saveSource(source({ id: "tor-transport", type: "tor_metadata", accessMethod: "approved_proxy", risk: "high", url: `http://${"b".repeat(56)}.onion/`, metadata: { productionCollection: true, transportCanary: true }, governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-06-01T00:00:00.000Z", approvedBy: "reviewer" }, crawlFrequencySeconds: 86_400 }));
    for (const sourceId of ["unproductive", "telegram-unproductive", "tor-unproductive", "tor-productive", "tor-transport"]) {
      for (let index = 0; index < 31; index++) {
        const productive = sourceId === "tor-productive" && [10, 20].includes(index);
        store.saveSourceHealthObservation({
          id: `${sourceId}-${index}`,
          sourceId,
          collectionRunId: `run-${sourceId}-${index}`,
          checkedAt: new Date(Date.parse("2026-06-23T12:00:00.000Z") + index * 86_400_000).toISOString(),
          status: "healthy",
          success: true,
          useful: productive,
          captureCount: productive ? 1 : 0
        });
      }
    }
    for (const index of [10, 20]) {
      store.saveCapture(fixtureCapture({
        id: `capture-tor-productive-${index}`,
        sourceId: "tor-productive",
        body: `Productive Tor evidence ${index}`,
        collectedAt: new Date(Date.parse("2026-06-23T12:00:00.000Z") + index * 86_400_000).toISOString(),
        metadata: { runId: `run-tor-productive-${index}` }
      }));
    }

    const first = reconcilePublicSourceProductivity({ store, now: "2026-07-23T12:00:00.000Z" });
    const second = reconcilePublicSourceProductivity({ store, now: "2026-07-23T13:00:00.000Z" });

    expect(first.retired).toEqual([
      { sourceId: "unproductive", attemptCount: 31, productiveCheckCount: 0 },
      { sourceId: "telegram-unproductive", attemptCount: 31, productiveCheckCount: 0 },
      { sourceId: "tor-unproductive", attemptCount: 31, productiveCheckCount: 0 }
    ]);
    expect(["unproductive", "telegram-unproductive", "tor-unproductive"].every((id) => store.getSource(id)?.status === "retired")).toBe(true);
    expect(store.getSource("tor-productive")?.status).toBe("active");
    expect(store.getSource("tor-transport")?.status).toBe("active");
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

  test("runtime loops isolate global and exact-default scheduling across restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "source-scheduler-scope-"));
    const snapshotPath = join(dir, "store.json");
    const firstAt = "2026-07-23T12:00:00.000Z";
    const fetched: string[] = [];
    const fetcher = async (url: string) => {
      fetched.push(url);
      return new Response(`<rss><channel><item><title>APT29 campaign at ${url}</title><link>${url}/report</link><description>APT29 targeted government victims with credential theft malware and command infrastructure.</description><pubDate>${firstAt}</pubDate></item></channel></rss>`, { headers: { "content-type": "application/rss+xml" } });
    };
    const start = (store: FileBackedScraperStore, at: string) => {
      const frontier = new FocusedFrontier({ maxQueueSize: 4 });
      const global = startCanaryCollectionLoop({ store, frontier, enabled: false, scheduleSourceFeedDiscovery: false, maxSources: 1, maxTasks: 1, maxConcurrentTasks: 1, queueLimit: 4, now: () => at, fetch: fetcher });
      const exactDefault = startCanaryCollectionLoop({ store, frontier, enabled: false, tenantId: "default", includeSharedSources: false, scheduleWatchlistDiscovery: false, scheduleSourceFeedDiscovery: false, maxSources: 1, maxTasks: 1, maxConcurrentTasks: 1, queueLimit: 4, now: () => at, fetch: fetcher });
      global.setEnabled(true);
      exactDefault.setEnabled(true);
      return { global, exactDefault };
    };

    try {
      const store = new FileBackedScraperStore({ snapshotPath });
      store.saveSource(source({ id: "global", tenantId: undefined, url: "https://global.example.com/feed.xml", metadata: { productionCollection: true } }));
      store.saveSource(source({ id: "default", tenantId: "default", url: "https://default.example.com/feed.xml", metadata: { productionCollection: true } }));
      store.saveSource(source({ id: "customer", tenantId: "customer", url: "https://customer.example.com/feed.xml", metadata: { productionCollection: true } }));
      const first = start(store, firstAt);
      await first.global.runOnce();
      await first.exactDefault.runOnce();
      await first.global.stop();
      await first.exactDefault.stop();

      expect(fetched.sort()).toEqual(["https://default.example.com/feed.xml", "https://global.example.com/feed.xml"]);
      expect(store.listPlans().filter((plan: any) => plan.tasks.length).map((plan: any) => [plan.tenantId, plan.tasks[0].tenantId, plan.tasks[0].sourceId]).sort()).toEqual([
        [undefined, undefined, "global"],
        ["default", "default", "default"]
      ]);
      expect(store.listRuns().filter((run: any) => run.sourceCount).map((run: any) => [run.tenantId, run.sourceCount]).sort()).toEqual([
        [undefined, 1],
        ["default", 1]
      ]);
      expect(store.listCaptures().map((capture: any) => [capture.sourceId, capture.tenantId]).sort()).toEqual([
        ["default", "default"],
        ["global", undefined]
      ]);

      const restarted = new FileBackedScraperStore({ snapshotPath });
      const second = start(restarted, "2026-07-23T12:05:00.000Z");
      await second.global.runOnce();
      await second.exactDefault.runOnce();
      await second.global.stop();
      await second.exactDefault.stop();
      expect(fetched).toHaveLength(2);
      expect(restarted.listCaptures()).toHaveLength(2);
      expect(restarted.listPlans().flatMap((plan: any) => plan.tasks).some((task: any) => task.sourceId === "customer")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
