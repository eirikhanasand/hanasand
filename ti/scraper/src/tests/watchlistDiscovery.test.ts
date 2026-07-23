import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pinnedPublicAdvisoryLookup, resolvePublicAdvisoryTarget } from "../api/exposureQueueRoutes.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { executeScheduledCollectionRun, recoverCollectionRuns } from "../ops/scheduledCollection.ts";
import { scheduleWatchlistDiscoveryRuns } from "../ops/watchlistDiscovery.ts";
import { handleApiRequest } from "../api/server.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { source } from "./helpers/apiSourceFixtures.ts";

describe("scheduled organization watchlist discovery", () => {
  test("fetches tenant-scoped public evidence and never retains provider hits as evidence", async () => {
    const generatedAt = new Date().toISOString();
    const publishedAt = new Date(Date.parse(generatedAt) - 3_600_000).toISOString();
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.saveSource(provider());
    store.saveDwmWatchlist(watchlist("watch_ntnu", "tenant_ntnu", "org_ntnu", "NTNU"));
    store.saveDwmWatchlist(watchlist("watch_tine", "tenant_tine", "org_tine", "Tine"));

    const fetcher = async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("news.google.test/rss/search")) {
        const term = decodeURIComponent(url).includes("NTNU") ? "NTNU" : "Tine";
        return response(`<rss><channel><item><title>${term} supplier cyberattack and data breach</title><description>${term} reports a supplier cyberattack compromised public records and credentials.</description><link>https://reports.example.test/${term.toLowerCase()}</link><pubDate>${publishedAt}</pubDate></item></channel></rss>`, url, "application/rss+xml");
      }
      if (url.endsWith("/robots.txt")) return response("", url, "text/plain", 404);
      if (url.endsWith("/ntnu")) return response(`<!doctype html><html><head><title>NTNU supplier cyberattack</title><meta property="article:published_time" content="${publishedAt}"></head><body><main><h1>NTNU supplier cyberattack</h1><p>NTNU reports that a supplier cyberattack compromised names and email addresses. The security incident was contained and public guidance was issued.</p></main></body></html>`, url, "text/html");
      if (url.endsWith("/manual")) return response(`<!doctype html><html><head><title>Manual Corp cyberattack</title><time datetime="${publishedAt}">Published</time></head><body><main><h1>Manual Corp cyberattack</h1><p>Manual Corp reports that a supplier cyberattack caused a data breach affecting public records.</p></main></body></html>`, url, "text/html");
      return response("<html><head><title>Other dairy report</title></head><body>A supplier cyberattack affected another company, not the monitored organization.</body></html>", url, "text/html");
    };
    const runExecutor = (runId: string) => executeScheduledCollectionRun({ store, frontier, fetch: fetcher, maxConcurrentTasks: 1, maxItemsPerTask: 4 }, runId);
    const first = await scheduleWatchlistDiscoveryRuns({ store, frontier, runExecutor, maxTasks: 5 }, generatedAt);

    expect(first.scheduledRunCount).toBe(2);
    expect(store.listCaptures()).toHaveLength(1);
    expect(store.listCaptures()[0]).toMatchObject({
      tenantId: "tenant_ntnu",
      url: "https://reports.example.test/ntnu",
      publishedAt,
      sensitive: false,
      metadata: {
        organizationId: "org_ntnu",
        sourceFamily: "public_advisory",
        scheduledWatchlistDiscovery: true,
        matchedWatchlistTerms: [{ id: "term_watch_ntnu", watchlistId: "watch_ntnu", value: "NTNU" }],
        discoveryProvider: { sourceId: "src_google_news_query", retainedAsEvidence: false }
      }
    });
    expect(store.listCaptures()[0].sourceId).not.toBe("src_google_news_query");
    expect(JSON.stringify(store.listCaptures()[0])).not.toContain(" OR ");
    expect(store.getSource(store.listCaptures()[0].sourceId)).toMatchObject({ tenantId: undefined, type: "static_web", url: "https://reports.example.test/", status: "candidate", metadata: { sourceFamily: "public_advisory", productionCollection: false } });
    expect(store.getSource(store.listCaptures()[0].sourceId)?.metadata?.organizationId).toBeUndefined();
    expect(store.listSourceHealthObservations()).toContainEqual(expect.objectContaining({ tenantId: "tenant_ntnu", sourceId: store.listCaptures()[0].sourceId, success: true, useful: true }));
    expect(store.listSourceHealthObservations()).toContainEqual(expect.objectContaining({ tenantId: "tenant_ntnu", sourceId: "src_google_news_query", success: true }));
    expect(store.listSourceHealthObservations()).toContainEqual(expect.objectContaining({ tenantId: "tenant_tine", sourceId: "src_google_news_query", success: true }));
    expect(store.listDwmAlerts()).toEqual([]);
    expect(store.listRuns().every((run) => (run.exposureClaimCount ?? 0) === 0)).toBe(true);

    store.saveOrganization({ id: "org_manual", tenantId: "tenant_manual", name: "Manual monitor", status: "active" });
    store.saveOrganizationMember({ id: "member_manual", userId: "analyst-test", organizationId: "org_manual", role: "analyst", status: "active" });
    const scheduledCapture = store.listCaptures()[0];
    const manual = await handleApiRequest(new Request("http://local/v1/dwm/exposure-claims/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer valid-test-session", id: "analyst-test" },
      body: JSON.stringify({ tenantId: "tenant_manual", organizationId: "org_manual", items: [{ company: "Manual Corp", sourceFamily: "public_advisory", url: "https://reports.example.test/manual" }] })
    }), { store, frontier, fetch: fetcher, authApiBase: "http://auth.test/api", authFetch: async () => Response.json({ id: "analyst-test", roles: [{ id: "analyst" }] }) } as any);
    expect(await manual.json()).toMatchObject({ accepted: 1, rejected: 0 });
    const manualCapture = store.listCaptures().find((capture) => capture.metadata?.organizationId === "org_manual")!;
    expect(manualCapture).toMatchObject({ tenantId: "tenant_manual", url: "https://reports.example.test/manual" });
    expect(manualCapture.sourceId).toBe(scheduledCapture.sourceId);
    expect(manualCapture.id).not.toBe(scheduledCapture.id);
    expect(store.listSources()).toHaveLength(2);

    const captureIds = store.listCaptures().map((capture) => capture.id);
    const second = await scheduleWatchlistDiscoveryRuns({ store, frontier, runExecutor, maxTasks: 5 }, generatedAt);
    expect(second).toMatchObject({ scheduledRunCount: 0, reason: "already_scheduled" });
    expect(store.listCaptures().map((capture) => capture.id)).toEqual(captureIds);
  });

  test("reuses the DNS-pinned public advisory boundary", async () => {
    let resolutions = 0;
    const publicAddress = { address: "93.184.216.34", family: 4 };
    const validated = await resolvePublicAdvisoryTarget("https://reports.example.com/incident", async () => ++resolutions === 1 ? [publicAddress] : [{ address: "127.0.0.1", family: 4 }]);
    const pinned = await new Promise<{ address: string; family: number }>((resolve, reject) => pinnedPublicAdvisoryLookup(validated.addresses)("reports.example.com", { family: 0, hints: 0, all: false } as any, (cause, address, family) => cause ? reject(cause) : resolve({ address: String(address), family: Number(family) })));
    expect(pinned).toEqual(publicAddress);
    expect(resolutions).toBe(1);
  });

  test("does not let a provider timestamp rescue an undated publisher page", async () => {
    const generatedAt = new Date().toISOString();
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.saveSource(provider());
    store.saveDwmWatchlist(watchlist("watch_undated", "tenant_undated", "org_undated", "Undated Corp"));
    const fetcher = async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("news.google.test/rss/search")) return response(`<rss><channel><item><title>Undated Corp data breach</title><description>Undated Corp reports a security incident.</description><link>https://reports.example.test/undated</link><pubDate>${generatedAt}</pubDate></item></channel></rss>`, url, "application/rss+xml");
      if (url.endsWith("/robots.txt")) return response("", url, "text/plain", 404);
      return response("<html><head><title>Undated Corp data breach</title></head><body>Undated Corp reports a security incident and compromised records.</body></html>", url, "text/html");
    };
    const runExecutor = (runId: string) => executeScheduledCollectionRun({ store, frontier, fetch: fetcher, maxConcurrentTasks: 1 }, runId);

    await scheduleWatchlistDiscoveryRuns({ store, frontier, runExecutor, maxTasks: 1 }, generatedAt);

    expect(store.listCaptures()).toEqual([]);
    expect(store.listSources().map((item) => item.id)).toEqual(["src_google_news_query"]);
  });

  test("persists provider failure and bounded retry without duplicate scheduling", async () => {
    const generatedAt = new Date().toISOString();
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.saveSource(provider());
    store.saveDwmWatchlist(watchlist("watch_failure", "tenant_failure", "org_failure", "Failure Corp"));
    const runExecutor = (runId: string) => executeScheduledCollectionRun({
      store,
      frontier,
      fetch: async () => { throw new Error("provider unavailable"); },
      maxConcurrentTasks: 1
    }, runId);

    const first = await scheduleWatchlistDiscoveryRuns({ store, frontier, runExecutor, maxTasks: 1 }, generatedAt);
    const run = store.getRun((first.runIds ?? [])[0]);
    expect(run).toMatchObject({ status: "queued", failedTaskCount: 1, retryScheduledCount: 1, nextAttemptAt: expect.any(String) });
    expect(store.listSourceHealthObservations()).toContainEqual(expect.objectContaining({ sourceId: "src_google_news_query", success: false, useful: false, failureReason: "provider unavailable" }));
    expect(store.getSource("src_google_news_query")?.crawlState).toMatchObject({ retryCount: 1, nextEligibleAt: expect.any(String) });
    expect(await scheduleWatchlistDiscoveryRuns({ store, frontier, runExecutor, maxTasks: 1 }, generatedAt)).toMatchObject({ scheduledRunCount: 0, reason: "already_scheduled" });
    expect(store.listPlans()).toHaveLength(1);
  });

  test("rehydrates one queued job and does not duplicate it after restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "watchlist-discovery-"));
    const snapshotPath = join(dir, "store.json");
    const generatedAt = new Date().toISOString();
    try {
      const store = new FileBackedScraperStore({ snapshotPath });
      store.saveSource(provider());
      store.saveDwmWatchlist(watchlist("watch_restart", "tenant_restart", "org_restart", "Restart Corp"));
      const first = await scheduleWatchlistDiscoveryRuns({ store, frontier: new FocusedFrontier(), runExecutor: async () => undefined, maxTasks: 1 }, generatedAt);
      const runIds = first.runIds ?? [];
      expect(first.scheduledRunCount).toBe(1);

      const restarted = new FileBackedScraperStore({ snapshotPath });
      const recovered: string[] = [];
      expect(recoverCollectionRuns({ store: restarted, execute: (runId: string) => recovered.push(runId) }, new Date(Date.parse(generatedAt) + 60_000))).toEqual({ scheduled: runIds, failed: [] });
      expect(recovered).toEqual(runIds);
      expect(await scheduleWatchlistDiscoveryRuns({ store: restarted, frontier: new FocusedFrontier(), runExecutor: async () => undefined, maxTasks: 1 }, generatedAt)).toMatchObject({ scheduledRunCount: 0, reason: "already_scheduled" });
      expect(restarted.listPlans()).toHaveLength(1);
      expect(restarted.listRuns()).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("does not query a term that was paused after scheduling", async () => {
    const generatedAt = new Date().toISOString();
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.saveSource(provider());
    const active = watchlist("watch_paused", "tenant_paused", "org_paused", "Paused Corp");
    store.saveDwmWatchlist(active);
    const queued: string[] = [];
    await scheduleWatchlistDiscoveryRuns({ store, frontier, runExecutor: async (runId: string) => queued.push(runId), maxTasks: 1 }, generatedAt);
    store.saveDwmWatchlist({ ...active, status: "paused" });
    let fetchCount = 0;

    const run = await executeScheduledCollectionRun({ store, frontier, fetch: async () => { fetchCount++; return response("", "https://unused.example.test", "text/plain"); } }, queued[0]);

    expect(run).toMatchObject({ status: "completed", completedTaskCount: 1, captureCount: 0 });
    expect(fetchCount).toBe(0);
    expect(store.listSourceHealthObservations()).toEqual([]);
  });

});

function provider() {
  return source({
    id: "src_google_news_query",
    name: "Verified public news query",
    type: "rss",
    url: "https://news.google.test/rss/search?q={query}",
    crawlFrequencySeconds: 86_400,
    metadata: { sourceFamily: "public_news_search", productionCollection: true, maxItemsPerFetch: 4 }
  });
}

function watchlist(id: string, tenantId: string, organizationId: string, value: string) {
  return { id, tenantId, organizationId, name: value, status: "active", terms: [{ id: `term_${id}`, value, kind: "company" }], createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };
}

function response(body: string, url: string, contentType: string, status = 200) {
  const value = new Response(body, { status, headers: { "content-type": contentType } });
  Object.defineProperty(value, "url", { value: url });
  return value;
}
