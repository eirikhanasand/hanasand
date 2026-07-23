import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { reconcilePublicSourceProductivity } from "../ops/canaryActivation.ts";
import { runCanaryCollectionCycle, startCanaryCollectionLoop } from "../ops/canaryCollection.ts";
import { runSourceFeedDiscoveryCycle } from "../ops/sourceFeedDiscovery.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { hashContent } from "../utils.ts";
import { source } from "./helpers/apiSourceFixtures.ts";

const generatedAt = "2026-07-23T12:00:00.000Z";
const nextYear = "2027-07-23T12:00:00.000Z";

describe("scheduled public feed discovery", () => {
  test("uses bounded global publisher workflows and remains restart-idempotent", async () => {
    const directory = mkdtempSync(join(tmpdir(), "source-feed-discovery-"));
    const snapshotPath = join(directory, "store.json");
    try {
      const store = new FileBackedScraperStore({ snapshotPath });
      usefulCapture(store, "global-parent", undefined, "run-global", [
        "https://publisher.example/articles/newer",
        "https://news.example/report",
        "https://redirect.example/post",
        "https://user:secret@auth.example/report",
        "https://auth.example/report?token=secret",
        "https://127.0.0.1/private"
      ]);
      usefulCapture(store, "default-parent", "default", "run-default", ["https://default.example/report"]);
      usefulCapture(store, "customer-parent", "customer-a", "run-customer", ["https://customer.example/report"]);

      let active = 0, maxActive = 0;
      const fetched: string[] = [];
      const fetcher = async (input: string | URL | Request) => {
        const url = String(input instanceof Request ? input.url : input);
        fetched.push(url); active++; maxActive = Math.max(maxActive, active);
        await Promise.resolve();
        try {
          if (url === "https://redirect.example/post") {
            return response("", url, "text/html", 302, { location: "https://127.0.0.1/internal" });
          }
          if (url.includes("publisher.example")) return response(feedLink("https://feeds.example/security.xml/"), url, "text/html");
          if (url.includes("news.example")) return response(feedLink("https://FEEDS.example/security.xml"), url, "text/html");
          if (url.toLowerCase().includes("feeds.example/security.xml")) return response(rss("CVE-2026-1000", "https://vendor.example/CVE-2026-1000", generatedAt), url, "application/rss+xml");
          throw new Error(`unexpected fetch ${url}`);
        } finally {
          active--;
        }
      };
      const loop = startCanaryCollectionLoop({
        store,
        frontier: new FocusedFrontier(),
        enabled: false,
        sourceIds: ["no-canary-source"],
        scheduleWatchlistDiscovery: false,
        sourceFeedDiscoveryMaxReferences: 3,
        sourceFeedDiscoveryMaxConcurrent: 2,
        sourceFeedDiscoveryFetch: fetcher,
        now: () => generatedAt
      });
      loop.setEnabled(true);
      await loop.runOnce();
      await loop.stop();
      const discovery = loop.getState().latestResult.sourceFeedDiscovery;

      expect(discovery).toMatchObject({
        status: "completed",
        processedPublisherCount: 3,
        importedSourceCount: 1,
        duplicateSourceCount: 1,
        revalidatedSourceCount: 0,
        failedPublisherCount: 1
      });
      expect(maxActive).toBeLessThanOrEqual(2);
      expect(fetched.some((url) => /default|customer|auth|127\.0\.0\.1/.test(url))).toBe(false);
      expect(store.listPlans().filter((plan: any) => plan.requestId === "req_source_feed_discovery")).toHaveLength(3);
      expect(store.listPlans().find((plan: any) => plan.publisherKey === "https://publisher.example/")).toMatchObject({
        request: { referenceUrl: "https://publisher.example/articles/newer" },
        nextEligibleAt: expect.any(String)
      });
      expect(store.listSources().filter((row: any) => row.metadata?.sourceFeedDiscovery?.workflow === "req_source_feed_discovery")).toHaveLength(1);
      expect(store.listSources().find((row: any) => row.metadata?.sourceFeedDiscovery)).toMatchObject({
        status: "candidate",
        countsAsCoverage: false,
        metadata: { productionCollection: false, sourcePortfolioQualificationState: "pending_sustained_productivity" }
      });

      const restarted = new FileBackedScraperStore({ snapshotPath });
      let restartFetches = 0;
      const restartedLoop = startCanaryCollectionLoop({
        store: restarted,
        frontier: new FocusedFrontier(),
        enabled: false,
        sourceIds: ["no-canary-source"],
        scheduleWatchlistDiscovery: false,
        sourceFeedDiscoveryFetch: async () => { restartFetches++; throw new Error("workflow is not due"); },
        now: () => generatedAt
      });
      restartedLoop.setEnabled(true);
      await restartedLoop.runOnce();
      await restartedLoop.stop();
      expect(restartedLoop.getState().latestResult.sourceFeedDiscovery).toMatchObject({ status: "skipped", reason: "not_due", processedPublisherCount: 0 });
      expect(restartFetches).toBe(0);
      expect(restarted.listPlans().filter((plan: any) => plan.requestId === "req_source_feed_discovery")).toHaveLength(3);

      const defaultLoop = startCanaryCollectionLoop({
        store: restarted,
        frontier: new FocusedFrontier(),
        tenantId: "default",
        includeSharedSources: false,
        enabled: false,
        sourceIds: ["no-canary-source"],
        scheduleWatchlistDiscovery: false,
        sourceFeedDiscoveryFetch: async () => { throw new Error("default lane must not discover"); },
        now: () => generatedAt
      });
      defaultLoop.setEnabled(true);
      await defaultLoop.runOnce();
      await defaultLoop.stop();
      expect(defaultLoop.getState().latestResult.sourceFeedDiscovery.reason).toBe("disabled_for_tenant_scheduler_lane");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("keeps discovery candidate-only until two useful retained collection cycles", async () => {
    const store = new InMemoryScraperStore();
    usefulCapture(store, "parent", undefined, "run-parent", ["https://candidate.example/feed.xml"]);
    const discovered = await runSourceFeedDiscoveryCycle({
      store,
      sourceFeedDiscoveryFetch: async (input: string | URL | Request) =>
        response(rss("CVE-2026-2000", "https://candidate.example/CVE-2026-2000", generatedAt), String(input), "application/rss+xml")
    }, generatedAt);
    expect(discovered.importedSourceCount).toBe(1);
    const candidate = store.listSources().find((row: any) => row.metadata?.sourceFeedDiscovery);
    expect(candidate).toMatchObject({ status: "candidate", countsAsCoverage: false, metadata: { productionCollection: false } });
    expect(store.listCaptures().filter((capture: any) => capture.sourceId === candidate.id)).toHaveLength(0);
    for (const [index, checkedAt] of ["2026-07-23T13:00:00.000Z", "2026-07-23T14:00:00.000Z"].entries()) {
      const runId = `explicitly-not-useful-${index}`;
      store.saveCapture({
        id: `not-useful-capture-${index}`,
        sourceId: candidate.id,
        url: `https://candidate.example/not-useful-${index}`,
        collectedAt: checkedAt,
        publishedAt: checkedAt,
        contentHash: hashContent(`not useful ${index}`),
        mediaType: "text/plain",
        storageKind: "inline_text",
        body: "Retained but explicitly non-useful content.",
        sensitive: false,
        metadata: { runId }
      });
      store.saveSourceHealthObservation({
        id: `not-useful-health-${index}`,
        sourceId: candidate.id,
        collectionRunId: runId,
        checkedAt,
        status: "healthy",
        success: true,
        useful: false,
        captureCount: 1
      });
    }

    let version = 0;
    const collect = (at: string) => runCanaryCollectionCycle({
      store,
      frontier: new FocusedFrontier(),
      sourceIds: [candidate.id],
      scheduleSourceFeedDiscovery: false,
      maxSources: 1,
      maxTasks: 1,
      maxItemsPerTask: 4,
      now: () => at,
      fetch: async (input: string | URL | Request) => {
        version++;
        return response(rss(`CVE-2026-20${version}1`, `https://candidate.example/CVE-2026-20${version}1`, at), String(input), "application/rss+xml");
      }
    });

    const first = await collect("2026-07-24T12:00:01.000Z");
    expect(first).toMatchObject({ completedTaskCount: 1, insertedCaptureCount: 1 });
    expect(store.getSource(candidate.id)).toMatchObject({
      status: "candidate",
      countsAsCoverage: false,
      metadata: { productionCollection: false, sourcePortfolioProductiveCheckCount: 1 }
    });

    const second = await collect("2026-07-25T12:00:02.000Z");
    expect(second).toMatchObject({ completedTaskCount: 1, insertedCaptureCount: 1 });
    expect(store.getSource(candidate.id)).toMatchObject({
      status: "active",
      countsAsCoverage: true,
      metadata: { productionCollection: true, sourcePortfolioQualificationState: "sustained_productive", sourcePortfolioProductiveCheckCount: 2 }
    });
    expect(new Set(store.listSourceHealthObservations().filter((row: any) => row.sourceId === candidate.id && row.useful).map((row: any) => row.collectionRunId)).size).toBe(2);
  });

  test("backs off failed candidates and retires only after their full activity window", async () => {
    const failedStore = new InMemoryScraperStore();
    usefulCapture(failedStore, "parent-failed", undefined, "run-parent-failed", ["https://failed.example/feed.xml"]);
    await runSourceFeedDiscoveryCycle({
      store: failedStore,
      sourceFeedDiscoveryFetch: async (input: string | URL | Request) =>
        response(rss("CVE-2026-3000", "https://failed.example/CVE-2026-3000", generatedAt), String(input), "application/rss+xml")
    }, generatedAt);
    const failedCandidate = failedStore.listSources().find((row: any) => row.metadata?.sourceFeedDiscovery);
    await runCanaryCollectionCycle({
      store: failedStore,
      frontier: new FocusedFrontier(),
      sourceIds: [failedCandidate.id],
      scheduleSourceFeedDiscovery: false,
      maxSources: 1,
      maxTasks: 1,
      now: () => "2026-07-24T12:00:01.000Z",
      fetch: async () => { throw new Error("publisher unavailable"); }
    });
    expect(failedStore.getSource(failedCandidate.id)).toMatchObject({
      status: "candidate",
      crawlState: { retryCount: 1, backoffUntil: expect.any(String), nextEligibleAt: expect.any(String) }
    });

    const retirementStore = new InMemoryScraperStore();
    const retiring = {
      ...source({
        id: "retiring-candidate",
        url: "https://retiring.example/feed.xml",
        status: "candidate",
        crawlFrequencySeconds: 86_400,
        governance: { approvalState: "approved", approvalRequired: false, metadataOnly: false },
        metadata: {
          productionCollection: false,
          activityWindowSeconds: 365 * 86_400,
          sourcePortfolioVerification: { outcome: "content_parsed", observedItemCount: 2 }
        },
        crawlState: { retryCount: 4, backoffUntil: "2026-07-23T13:00:00.000Z", nextEligibleAt: "2026-07-23T13:00:00.000Z" }
      })
    };
    retirementStore.saveSource(retiring);
    for (let index = 0; index < 10; index++) {
      const checkedAt = new Date(Date.parse("2025-07-24T12:00:00.000Z") + index * 40 * 86_400_000).toISOString();
      retirementStore.saveSourceHealthObservation({
        id: `retirement-health-${index}`,
        sourceId: retiring.id,
        collectionRunId: `retirement-run-${index}`,
        checkedAt,
        status: "healthy",
        success: true,
        useful: false,
        captureCount: 0
      });
    }
    expect(reconcilePublicSourceProductivity({ store: retirementStore, now: generatedAt }).retired).toEqual([
      { sourceId: retiring.id, attemptCount: 10, productiveCheckCount: 0 }
    ]);
    expect(retirementStore.getSource(retiring.id)).toMatchObject({
      status: "retired",
      metadata: {
        sourcePortfolioStatus: "retired_unproductive",
        sourcePortfolioMonitoringWindowSeconds: 365 * 86_400
      }
    });
  });
});

function usefulCapture(store: any, sourceId: string, tenantId: string | undefined, runId: string, urls: string[]) {
  store.saveSource(source({
    id: sourceId,
    tenantId,
    url: `https://${sourceId}.example/feed.xml`,
    status: "active",
    crawlState: { retryCount: 0, nextEligibleAt: nextYear },
    metadata: { productionCollection: true }
  }));
  store.saveSourceHealthObservation({
    id: `health-${sourceId}`,
    tenantId,
    sourceId,
    collectionRunId: runId,
    checkedAt: generatedAt,
    status: "healthy",
    success: true,
    useful: true,
    captureCount: 1
  });
  store.saveCapture({
    id: `capture-${sourceId}`,
    tenantId,
    sourceId,
    url: urls[0],
    collectedAt: generatedAt,
    publishedAt: generatedAt,
    contentHash: hashContent(`${sourceId}:${urls.join(":")}`),
    mediaType: "text/plain",
    storageKind: "inline_text",
    body: "Retained useful public publisher evidence.",
    sensitive: false,
    metadata: {
      runId,
      reportTimestamps: urls.slice(1).map((referenceUrl) => ({ role: "publisher", timestamp: generatedAt, referenceUrl }))
    }
  });
}

function feedLink(url: string) {
  return `<!doctype html><html><head><link type="application/rss+xml" href="${url}" rel="alternate"></head><body>Public security report.</body></html>`;
}

function rss(title: string, link: string, publishedAt: string) {
  return `<rss><channel><item><title>${title} remote code execution vulnerability</title><link>${link}</link><description>${title} is a critical vulnerability allowing remote code execution against affected systems.</description><pubDate>${publishedAt}</pubDate></item></channel></rss>`;
}

function response(body: string, url: string, contentType: string, status = 200, headers: Record<string, string> = {}) {
  const result = new Response(body, { status, headers: { "content-type": contentType, ...headers } });
  Object.defineProperty(result, "url", { value: url });
  return result;
}
