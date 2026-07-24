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
import {
  AUTOMATIC_REVIEW_RESPONSE_SCHEMA,
  runAutomaticReviewCycle,
  syncAutomaticReviewQueue
} from "../api/automaticReviewRoutes.ts";
import { SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION, SOURCE_AUTOMATIC_REVIEW_SCHEMA, automaticSourceReviewIdentity, hasApprovedAutomaticSourceReview } from "../policy/sourceAutomaticReview.ts";

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

  test("follows one bounded security-reference hop to a new publisher feed", async () => {
    const store = new InMemoryScraperStore();
    usefulCapture(store, "reporter-parent", undefined, "run-reporter-parent", ["https://reporter.example/research/new-campaign"]);
    const fetched: string[] = [];
    const discovery = await runSourceFeedDiscoveryCycle({
      store,
      sourceFeedDiscoveryMaxFeedsPerReference: 2,
      sourceFeedDiscoveryFetch: async (input: string | URL | Request) => {
        const url = String(input instanceof Request ? input.url : input);
        fetched.push(url);
        if (url === "https://reporter.example/research/new-campaign") {
          return response(
            `<html><body>
              <a href="https://vendor.example/security/advisories/CVE-2026-4242">Vendor security advisory</a>
              <a href="https://marketing.example/company">Company profile</a>
              <a href="https://127.0.0.1/security">Internal security page</a>
              <a href="https://user:secret@auth.example/security">Authenticated security page</a>
            </body></html>${"x".repeat(600_000)}`,
            url,
            "text/html"
          );
        }
        if (url === "https://vendor.example/security/advisories/CVE-2026-4242") {
          return response(feedLink("https://vendor.example/security/feed.xml"), url, "text/html");
        }
        if (url === "https://vendor.example/security/feed.xml") {
          return response(rss("CVE-2026-4242", "https://vendor.example/security/advisories/CVE-2026-4242", generatedAt), url, "application/rss+xml");
        }
        throw new Error(`unexpected fetch ${url}`);
      }
    }, generatedAt);

    expect(discovery).toMatchObject({
      status: "completed",
      importedSourceCount: 1,
      failedPublisherCount: 0
    });
    expect(fetched).toEqual([
      "https://reporter.example/research/new-campaign",
      "https://vendor.example/security/advisories/CVE-2026-4242",
      "https://vendor.example/security/feed.xml"
    ]);
    expect(store.listSources().find((row: any) => row.metadata?.sourceFeedDiscovery)).toMatchObject({
      url: "https://vendor.example/security/feed.xml",
      status: "candidate",
      countsAsCoverage: false,
      metadata: { productionCollection: false }
    });
  });

  test("keeps a proven feed when an optional related link fails and blocks secret redirects", async () => {
    const store = new InMemoryScraperStore();
    usefulCapture(store, "safe-redirect-parent", undefined, "run-safe-redirect", ["https://publisher.example/security"]);
    const fetched: string[] = [];
    const discovery = await runSourceFeedDiscoveryCycle({
      store,
      sourceFeedDiscoveryFetch: async (input: string | URL | Request) => {
        const url = String(input instanceof Request ? input.url : input);
        fetched.push(url);
        if (url === "https://publisher.example/security") return response(
          `<html><head><link type="application/rss+xml" href="/security.xml" rel="alternate"></head>
            <body><a href="https://related.example/security">Related security research</a></body></html>`,
          url,
          "text/html"
        );
        if (url === "https://publisher.example/security.xml") return response(
          rss("CVE-2026-5000", "https://publisher.example/CVE-2026-5000", generatedAt),
          url,
          "application/rss+xml"
        );
        if (url === "https://related.example/security") return response("", url, "text/html", 302, {
          location: "https://related.example/security?token=must-not-be-sent"
        });
        throw new Error(`unexpected fetch ${url}`);
      }
    }, generatedAt);

    expect(discovery).toMatchObject({ importedSourceCount: 1, failedPublisherCount: 0 });
    expect(fetched).toContain("https://related.example/security");
    expect(fetched.some((url) => url.includes("must-not-be-sent"))).toBe(false);
  });

  test("discovers and verifies public Telegram channels without private access", async () => {
    const store = new InMemoryScraperStore();
    usefulCapture(store, "telegram-reporter", undefined, "run-telegram-reporter", ["https://reporter.example/research/apt29"]);
    const fetched: string[] = [];
    const discovery = await runSourceFeedDiscoveryCycle({
      store,
      sourceFeedDiscoveryFetch: async (input: string | URL | Request) => {
        const url = String(input instanceof Request ? input.url : input);
        fetched.push(url);
        if (url === "https://reporter.example/research/apt29") {
          return response(
            `<html><body>
              <a href="https://t.me/Public_Threat_Intel">Public threat channel</a>
              <a href="https://t.me/+PrivateInvite">Private invite</a>
              <a href="https://t.me/Public_Threat_Intel/42">One message</a>
              <a href="https://telegram.dog/not-supported">Unsupported Telegram mirror</a>
            </body></html>`,
            url,
            "text/html"
          );
        }
        if (url === "https://t.me/s/public_threat_intel") {
          return response(`
            <html><body><section>
              <div class="tgme_widget_message" data-post="public_threat_intel/42">
                <div class="tgme_widget_message_text">APT29 used malware and exploited CVE-2026-4242 in a current phishing campaign.</div>
                <time datetime="${generatedAt}"></time>
              </div>
            </section></body></html>`, url, "text/html");
        }
        throw new Error(`unexpected fetch ${url}`);
      }
    }, generatedAt);

    expect(discovery).toMatchObject({
      status: "completed",
      importedSourceCount: 1,
      failedPublisherCount: 0
    });
    expect(fetched).toEqual([
      "https://reporter.example/research/apt29",
      "https://t.me/s/public_threat_intel"
    ]);
    expect(store.listSources().find((row: any) => row.metadata?.sourceFeedDiscovery)).toMatchObject({
      type: "telegram_public",
      url: "https://t.me/public_threat_intel",
      accessMethod: "public_http",
      status: "candidate",
      countsAsCoverage: false,
      metadata: {
        sourceFamily: "public_telegram",
        collectionMode: "public_web_preview",
        productionCollection: false
      }
    });
  });

  test("bounds stuck auxiliary work before the canonical run and remains restart-idempotent", async () => {
    const directory = mkdtempSync(join(tmpdir(), "source-feed-discovery-timeout-"));
    const snapshotPath = join(directory, "store.json");
    try {
      const store = new FileBackedScraperStore({ snapshotPath });
      usefulCapture(store, "stuck-parent", undefined, "run-stuck-parent", ["https://stuck-publisher.example/report"]);
      store.saveSource(source({ id: "canonical-source", url: "https://canonical.example/feed.xml", status: "active", metadata: { productionCollection: true } }));
      store.saveSource(source({
        id: "watchlist-provider",
        url: "https://news.example/rss/search?q={query}",
        status: "active",
        metadata: { sourceFamily: "public_news_search", productionCollection: true }
      }));
      store.saveDwmWatchlist({
        id: "watch-stuck",
        tenantId: "tenant-watch",
        organizationId: "org-watch",
        name: "Stuck Corp",
        status: "active",
        terms: [{ id: "term-stuck", value: "Stuck Corp", kind: "company" }],
        createdAt: generatedAt,
        updatedAt: generatedAt
      });
      let discoveryFetchCount = 0, watchlistExecutionCount = 0, canonicalFetchCount = 0;
      const loop = startCanaryCollectionLoop({
        store,
        frontier: new FocusedFrontier(),
        enabled: false,
        sourceIds: ["canonical-source"],
        maxSources: 1,
        maxTasks: 1,
        sourceFeedDiscoveryMaxReferences: 1,
        sourceFeedDiscoveryCycleTimeoutMs: 10,
        sourceFeedDiscoveryFetch: async () => {
          discoveryFetchCount++;
          return await new Promise<Response>(() => undefined);
        },
        runExecutor: async () => {
          watchlistExecutionCount++;
          return await new Promise<never>(() => undefined);
        },
        fetch: async (input: string | URL | Request) => {
          canonicalFetchCount++;
          return response("<rss><channel></channel></rss>", String(input), "application/rss+xml");
        },
        now: () => generatedAt
      });
      loop.setEnabled(true);
      await loop.runOnce();

      expect(loop.getState()).toMatchObject({
        running: false,
        cycleCount: 1,
        successCount: 1,
        nextCycleAt: expect.any(String),
        latestResult: {
          status: "completed",
          sourceFeedDiscovery: { failedPublisherCount: 1, processedPublisherCount: 1 },
          watchlistDiscovery: { scheduledRunCount: 1 }
        }
      });
      expect({ discoveryFetchCount, watchlistExecutionCount, canonicalFetchCount }).toEqual({
        discoveryFetchCount: 1,
        watchlistExecutionCount: 1,
        canonicalFetchCount: 1
      });
      expect(store.listRuns().filter((run: any) => run.requestId === "req_public_canary")).toContainEqual(
        expect.objectContaining({ tenantId: undefined, status: "completed", completedTaskCount: 1 })
      );
      const discoveryPlan = store.listPlans().find((plan: any) => plan.requestId === "req_source_feed_discovery");
      expect(discoveryPlan).toMatchObject({
        status: "failed",
        attemptCount: 1,
        consecutiveFailureCount: 1,
        nextEligibleAt: expect.any(String),
        result: { outcome: "fetch_failed", error: "Public feed discovery cycle timed out." },
        audit: [{ at: generatedAt, outcome: "fetch_failed" }]
      });
      expect(store.listPlans().filter((plan: any) => plan.request?.requesterId === "scheduled-watchlist-discovery")).toHaveLength(1);
      await loop.stop();

      const restarted = new FileBackedScraperStore({ snapshotPath });
      const restartedLoop = startCanaryCollectionLoop({
        store: restarted,
        frontier: new FocusedFrontier(),
        enabled: false,
        sourceIds: ["canonical-source"],
        maxSources: 1,
        maxTasks: 1,
        sourceFeedDiscoveryFetch: async () => { discoveryFetchCount++; throw new Error("failed discovery plan must back off"); },
        runExecutor: async () => { watchlistExecutionCount++; throw new Error("durable watchlist plan must not duplicate"); },
        fetch: async () => response("<rss><channel></channel></rss>", "https://canonical.example/feed.xml", "application/rss+xml"),
        now: () => "2026-07-23T12:01:00.000Z"
      });
      restartedLoop.setEnabled(true);
      await restartedLoop.runOnce();
      await restartedLoop.stop();

      expect({ discoveryFetchCount, watchlistExecutionCount }).toEqual({ discoveryFetchCount: 1, watchlistExecutionCount: 1 });
      expect(restarted.listPlans().filter((plan: any) => plan.requestId === "req_source_feed_discovery")).toHaveLength(1);
      expect(restarted.listPlans().filter((plan: any) => plan.request?.requesterId === "scheduled-watchlist-discovery")).toHaveLength(1);
      expect(restarted.getPlan(discoveryPlan.id)).toMatchObject({ attemptCount: 1, audit: [{ at: generatedAt, outcome: "fetch_failed" }] });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("requires persisted AI source review and two useful retained cycles across restart", async () => {
    const directory = mkdtempSync(join(tmpdir(), "source-ai-review-"));
    const snapshotPath = join(directory, "store.json");
    try {
      const store = new FileBackedScraperStore({ snapshotPath });
      const hosts = ["relevant", "irrelevant", "malformed", "timeout"];
      usefulCapture(store, "parent", undefined, "run-parent", hosts.map((host) => `https://${host}.example/feed.xml`));
      const discovered = await runSourceFeedDiscoveryCycle({
        store,
        sourceFeedDiscoveryMaxReferences: 4,
        sourceFeedDiscoveryFetch: async (input: string | URL | Request) => {
          const url = String(input);
          const host = new URL(url).hostname.split(".")[0];
          return response(rss(`CVE-2026-${host.length}000`, `https://${host}.example/CVE-2026-${host.length}000`, generatedAt), url, "application/rss+xml");
        }
      }, generatedAt);
      expect(discovered.importedSourceCount).toBe(4);
      const candidates = Object.fromEntries(store.listSources()
        .filter((row: any) => row.metadata?.sourceFeedDiscovery)
        .map((row: any) => [new URL(row.url).hostname.split(".")[0], row]));
      expect(Object.keys(candidates).sort()).toEqual(hosts.sort());

      const versions = new Map<string, number>();
      const collect = (activeStore: any, at: string, selected = hosts) => runCanaryCollectionCycle({
        store: activeStore,
        frontier: new FocusedFrontier(),
        sourceIds: selected.map((host) => candidates[host].id),
        scheduleSourceFeedDiscovery: false,
        maxSources: selected.length,
        maxTasks: selected.length,
        maxItemsPerTask: 4,
        now: () => at,
        fetch: async (input: string | URL | Request) => {
          const url = String(input);
          const host = new URL(url).hostname.split(".")[0];
          const version = (versions.get(host) ?? 0) + 1;
          versions.set(host, version);
          return response(rss(`CVE-2026-${host.length}${version}01`, `https://${host}.example/CVE-2026-${host.length}${version}01`, at), url, "application/rss+xml");
        }
      });

      const first = await collect(store, "2026-07-24T12:00:01.000Z");
      expect(first).toMatchObject({ completedTaskCount: 4, insertedCaptureCount: 4 });
      expect(Object.values(candidates).every((candidate: any) => store.getSource(candidate.id)?.status === "candidate")).toBe(true);

      const modelCalls = new Map<string, number>();
      const review = await runAutomaticReviewCycle({ store } as any, {
        now: "2026-07-24T12:01:00.000Z",
        allTenants: true,
        limit: 8,
        concurrency: 1,
        modelVersion: "hanasand",
        aiBase: "http://ai.test",
        clock: () => "2026-07-24T12:01:00.000Z",
        fetcher: async (_input, init) => {
          const request = JSON.parse(String(init?.body));
          expect(request).toMatchObject({
            schemaVersion: "ti.automatic_intelligence_review.request.v6",
            promptVersion: SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION,
            subject: { type: "source" }
          });
          const host = Object.entries(candidates).find(([, candidate]: any) => candidate.id === request.subject.id)?.[0] ?? "";
          modelCalls.set(host, (modelCalls.get(host) ?? 0) + 1);
          if (host === "timeout") throw new Error("model timeout");
          if (host === "malformed") return Response.json({ status: "completed", provider: "hanasand-ai", model: "hanasand-inspur", conversationId: "malformed-conversation", decision: {} });
          return completedSourceReview(request, host === "relevant");
        }
      });
      expect(review).toMatchObject({ queued: 8, attempted: 8 });
      expect(store.getSource(candidates.relevant.id)).toMatchObject({
        status: "candidate",
        metadata: {
          productionCollection: false,
          automaticSourceReview: {
            state: "approved",
            promptVersion: SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION,
            configuredModelVersion: "hanasand",
            requestSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            runtimeIdentity: { status: "completed", model: "hanasand-inspur" },
            decision: { action: "confirm", claimValidity: "supported" }
          }
        }
      });
      expect(store.getSource(candidates.irrelevant.id)).toMatchObject({
        status: "rejected",
        countsAsCoverage: false,
        crawlState: { backoffUntil: expect.any(String) },
        metadata: { automaticSourceReview: { state: "rejected", decision: { action: "reject", claimValidity: "invalid" } } }
      });
      expect(store.getSource(candidates.malformed.id)?.metadata?.automaticSourceReview).toBeUndefined();
      expect(store.getSource(candidates.timeout.id)?.metadata?.automaticSourceReview).toBeUndefined();
      const sourceRetries = store.listAnalystMetadataReviewTasks()
        .filter((task: any) => [candidates.malformed.id, candidates.timeout.id].includes(task.subject?.sourceId));
      expect(sourceRetries.every((task: any) => task.promptVersion === SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION)).toBe(true);
      for (const candidate of [candidates.malformed, candidates.timeout]) {
        expect(sourceRetries.some((task: any) => task.subject.sourceId === candidate.id && task.state === "retrying")).toBe(true);
      }
      const restarted = new FileBackedScraperStore({ snapshotPath });
      const persistedTaskCount = restarted.listAnalystMetadataReviewTasks().filter((item: any) => item.recordKind === "automatic_intelligence_review_task").length;
      const beforeRetry = await runAutomaticReviewCycle({ store: restarted } as any, {
        now: "2026-07-24T12:01:01.000Z",
        allTenants: true,
        limit: 4,
        modelVersion: "hanasand",
        aiBase: "http://ai.test",
        fetcher: async () => { throw new Error("no review is due"); }
      });
      expect(beforeRetry).toMatchObject({ queued: 0, attempted: 0 });
      expect(restarted.listAnalystMetadataReviewTasks().filter((item: any) => item.recordKind === "automatic_intelligence_review_task")).toHaveLength(persistedTaskCount);

      const second = await collect(restarted, "2026-07-25T12:02:00.000Z", ["relevant", "malformed", "timeout"]);
      expect(second).toMatchObject({ completedTaskCount: 3, insertedCaptureCount: 3 });
      expect(restarted.getSource(candidates.relevant.id)).toMatchObject({
        status: "active",
        countsAsCoverage: true,
        metadata: { productionCollection: true, sourcePortfolioQualificationState: "sustained_productive", sourcePortfolioProductiveCheckCount: 2 }
      });
      for (const host of ["malformed", "timeout"]) {
        expect(restarted.getSource(candidates[host].id)).toMatchObject({
          status: "candidate",
          countsAsCoverage: false,
          metadata: { productionCollection: false, sourcePortfolioQualificationState: "pending_sustained_productivity", sourcePortfolioProductiveCheckCount: 2 }
        });
      }
      expect(modelCalls).toEqual(new Map([["irrelevant", 1], ["malformed", 1], ["relevant", 1], ["timeout", 1]]));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("preserves a concurrent public-source approval through its second productive collection", async () => {
    const store = new InMemoryScraperStore();
    const candidate = source({
      id: "concurrent-public-review",
      status: "candidate",
      type: "rss",
      url: "https://concurrent.example/feed.xml",
      accessMethod: "public_http",
      risk: "low",
      crawlFrequencySeconds: 60,
      governance: { approvalRequired: false, approvalState: "approved", metadataOnly: false },
      metadata: {
        productionCollection: false,
        sourcePortfolioVerification: {
          verifiedAt: generatedAt,
          legalBasisVerifiedAt: generatedAt,
          outcome: "content_parsed",
          observedItemCount: 2
        }
      }
    });
    store.saveSource(candidate);
    let version = 0;
    const collect = (at: string, approve = false) => runCanaryCollectionCycle({
      store,
      frontier: new FocusedFrontier(),
      sourceIds: [candidate.id],
      scheduleSourceFeedDiscovery: false,
      maxSources: 1,
      maxTasks: 1,
      now: () => at,
      fetch: async () => {
        if (approve) approveSourceReview(store, candidate.id);
        version++;
        return response(rss(`CVE-2026-90${version}`, `https://concurrent.example/CVE-2026-90${version}`, at), candidate.url, "application/rss+xml");
      }
    });

    expect(await collect("2026-07-24T12:00:00.000Z")).toMatchObject({ completedTaskCount: 1, insertedCaptureCount: 1 });
    expect(await collect("2026-07-24T12:02:00.000Z", true)).toMatchObject({ completedTaskCount: 1, insertedCaptureCount: 1 });
    expect(store.getSource(candidate.id)).toMatchObject({
      status: "active",
      countsAsCoverage: true,
      metadata: {
        automaticSourceReview: { state: "approved" },
        sourcePortfolioQualificationState: "sustained_productive",
        sourcePortfolioProductiveCheckCount: 2
      }
    });
  });

  test("automatically re-reviews an uncertain source only after backoff and newer useful evidence", async () => {
    const store = new InMemoryScraperStore();
    const candidate = source({
      id: "uncertain-source-review",
      status: "candidate",
      type: "rss",
      url: "https://uncertain-review.example/feed.xml",
      accessMethod: "public_http",
      risk: "low",
      crawlFrequencySeconds: 60,
      governance: { approvalRequired: false, approvalState: "approved", metadataOnly: false },
      metadata: {
        productionCollection: false,
        sourcePortfolioVerification: {
          verifiedAt: generatedAt,
          legalBasisVerifiedAt: generatedAt,
          outcome: "content_parsed",
          observedItemCount: 3
        }
      }
    });
    store.saveSource(candidate);
    let version = 0;
    const collect = (at: string) => runCanaryCollectionCycle({
      store,
      frontier: new FocusedFrontier(),
      sourceIds: [candidate.id],
      scheduleSourceFeedDiscovery: false,
      maxSources: 1,
      maxTasks: 1,
      now: () => at,
      fetch: async () => {
        version++;
        return response(rss(`CVE-2026-91${version}`, `https://uncertain-review.example/CVE-2026-91${version}`, at), candidate.url, "application/rss+xml");
      }
    });

    await collect("2026-07-24T12:00:00.000Z");
    const firstReview = await runAutomaticReviewCycle({ store } as any, {
      now: "2026-07-24T12:01:00.000Z",
      clock: () => "2026-07-24T12:01:00.000Z",
      allTenants: true,
      modelVersion: "hanasand",
      aiBase: "http://ai.test",
      fetcher: async (_input, init) => uncertainSourceReview(JSON.parse(String(init?.body)))
    });
    expect(firstReview).toMatchObject({ queued: 1, attempted: 1 });
    expect(store.getSource(candidate.id)).toMatchObject({
      status: "candidate",
      crawlState: { backoffUntil: "2026-07-25T12:01:00.000Z" },
      metadata: { automaticSourceReview: { state: "needs_review", nextReviewAt: "2026-07-25T12:01:00.000Z", selectedEvidenceIds: [expect.any(String)] } }
    });
    const firstTaskId = store.getSource(candidate.id)?.metadata?.automaticSourceReview?.taskId;

    const noNewEvidence = await runAutomaticReviewCycle({ store } as any, {
      now: "2026-07-25T12:01:00.000Z",
      allTenants: true,
      modelVersion: "hanasand",
      aiBase: "http://ai.test",
      fetcher: async () => { throw new Error("no newer evidence should mean no model call"); }
    });
    expect(noNewEvidence).toMatchObject({ queued: 0, attempted: 0 });

    await collect("2026-07-25T12:02:00.000Z");
    let reReviewCalls = 0;
    const reReview = await runAutomaticReviewCycle({ store } as any, {
      now: "2026-07-25T12:03:00.000Z",
      clock: () => "2026-07-25T12:03:00.000Z",
      allTenants: true,
      modelVersion: "hanasand",
      aiBase: "http://ai.test",
      fetcher: async (_input, init) => {
        reReviewCalls++;
        return completedSourceReview(JSON.parse(String(init?.body)), true);
      }
    });
    expect(reReview).toMatchObject({ queued: 1, attempted: 1 });
    expect(reReviewCalls).toBe(1);
    expect(store.getSource(candidate.id)?.metadata?.automaticSourceReview).toMatchObject({ state: "approved" });
    expect(store.getSource(candidate.id)?.metadata?.automaticSourceReview?.taskId).not.toBe(firstTaskId);
    expect(await runAutomaticReviewCycle({ store } as any, {
      now: "2026-07-25T12:03:01.000Z",
      allTenants: true,
      modelVersion: "hanasand",
      aiBase: "http://ai.test",
      fetcher: async () => { throw new Error("approved review must be restart-idempotent"); }
    })).toMatchObject({ queued: 0, attempted: 0 });

    const previousModel = Bun.env.HANASAND_AI_MODEL;
    Bun.env.HANASAND_AI_MODEL = "hanasand";
    try {
      await collect("2026-07-25T12:04:00.000Z");
    } finally {
      if (previousModel === undefined) delete Bun.env.HANASAND_AI_MODEL;
      else Bun.env.HANASAND_AI_MODEL = previousModel;
    }
    expect(store.getSource(candidate.id)).toMatchObject({
      status: "active",
      countsAsCoverage: true,
      metadata: { sourcePortfolioProductiveCheckCount: 3, automaticSourceReview: { state: "approved" } }
    });
  });

  test("preserves an existing source-v6 nonterminal while binding its current source identity", async () => {
    const store = new InMemoryScraperStore();
    const candidate = reviewableCandidate(store, "source-v6-nonterminal");
    expect(syncAutomaticReviewQueue({ store } as any, {
      allTenants: true,
      now: "2026-07-24T12:00:00.000Z",
      modelVersion: "hanasand"
    })).toBe(1);
    const current = store.listAnalystMetadataReviewTasks()
      .find((task: any) => task.recordKind === "automatic_intelligence_review_task" && task.subject.sourceId === candidate.id);
    const { sourceIdentitySha256: _newField, ...legacyV6Task } = current;
    store.saveAnalystMetadataReviewTask(legacyV6Task);
    let modelCalls = 0;

    const cycle = await runAutomaticReviewCycle({ store } as any, {
      now: "2026-07-24T12:01:00.000Z",
      clock: () => "2026-07-24T12:01:00.000Z",
      allTenants: true,
      modelVersion: "hanasand",
      aiBase: "http://ai.test",
      fetcher: async (_input, init) => {
        modelCalls++;
        return completedSourceReview(JSON.parse(String(init?.body)), true);
      }
    });

    expect(cycle).toMatchObject({ superseded: 0, queued: 0, attempted: 1, results: [{ state: "terminal" }] });
    expect(modelCalls).toBe(1);
    expect(store.getAnalystMetadataReviewTask(current.id)?.sourceIdentitySha256).toMatch(/^[a-f0-9]{64}$/);
    expect(store.getSource(candidate.id)?.metadata?.automaticSourceReview).toMatchObject({
      state: "approved",
      promptVersion: SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION
    });
    const approved = store.getSource(candidate.id)!;
    expect(hasApprovedAutomaticSourceReview(approved, "hanasand")).toBe(true);
    expect(hasApprovedAutomaticSourceReview({ ...approved, url: "https://replacement.example/feed.xml" }, "hanasand")).toBe(false);
    expect(hasApprovedAutomaticSourceReview({ ...approved, tenantId: "replacement-tenant" }, "hanasand")).toBe(false);
    expect(hasApprovedAutomaticSourceReview({
      ...approved,
      metadata: {
        ...approved.metadata,
        automaticSourceReview: {
          ...approved.metadata.automaticSourceReview,
          sourceIdentity: {
            ...approved.metadata.automaticSourceReview.sourceIdentity,
            canonicalFeedKey: "https://replacement.example/feed.xml"
          }
        }
      }
    }, "hanasand")).toBe(false);
  });

  test("automatically re-reviews a legacy source-v6 approval once to bind its current identity", async () => {
    const store = new InMemoryScraperStore();
    const candidate = reviewableCandidate(store, "source-v6-approval");
    const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => completedSourceReview(JSON.parse(String(init?.body)), true);

    expect(await runAutomaticReviewCycle({ store } as any, {
      now: "2026-07-24T12:00:00.000Z",
      clock: () => "2026-07-24T12:00:00.000Z",
      allTenants: true,
      modelVersion: "hanasand",
      aiBase: "http://ai.test",
      fetcher
    })).toMatchObject({ queued: 1, attempted: 1, results: [{ state: "terminal" }] });
    const firstTaskId = store.getSource(candidate.id)?.metadata?.automaticSourceReview?.taskId;
    const approved = store.getSource(candidate.id)!;
    const { sourceIdentity: _identity, ...legacyReview } = approved.metadata.automaticSourceReview;
    store.saveSource({ ...approved, metadata: { ...approved.metadata, automaticSourceReview: legacyReview } });
    expect(hasApprovedAutomaticSourceReview(store.getSource(candidate.id), "hanasand")).toBe(false);

    let modelCalls = 0;
    const rebound = await runAutomaticReviewCycle({ store } as any, {
      now: "2026-07-24T12:01:00.000Z",
      clock: () => "2026-07-24T12:01:00.000Z",
      allTenants: true,
      modelVersion: "hanasand",
      aiBase: "http://ai.test",
      fetcher: async (input, init) => {
        modelCalls++;
        return fetcher(input, init);
      }
    });

    expect(rebound).toMatchObject({ queued: 1, attempted: 1, results: [{ state: "terminal" }] });
    expect(modelCalls).toBe(1);
    const reboundSource = store.getSource(candidate.id)!;
    const reboundReview = reboundSource.metadata.automaticSourceReview;
    expect(hasApprovedAutomaticSourceReview(reboundSource, "hanasand")).toBe(true);
    expect(reboundReview.state).toBe("approved");
    expect(reboundReview.taskId).not.toBe(firstTaskId);
    expect(reboundReview.sourceIdentity).toEqual(automaticSourceReviewIdentity(reboundSource));
    expect(await runAutomaticReviewCycle({ store } as any, {
      now: "2026-07-24T12:02:00.000Z",
      allTenants: true,
      modelVersion: "hanasand",
      fetcher: async () => { throw new Error("identity-bound approval must be restart-idempotent"); }
    })).toMatchObject({ queued: 0, attempted: 0 });
  });

  test("supersedes reassigned source tasks before the model call and before decision persistence", async () => {
    const beforeCallStore = new InMemoryScraperStore();
    const beforeCall = reviewableCandidate(beforeCallStore, "reassigned-before-review");
    await runAutomaticReviewCycle({ store: beforeCallStore } as any, {
      now: "2026-07-24T12:00:00.000Z",
      clock: () => "2026-07-24T12:00:00.000Z",
      allTenants: true,
      modelVersion: "hanasand",
      aiBase: "http://ai.test",
      fetcher: async () => { throw new Error("temporary model timeout"); }
    });
    beforeCallStore.saveSource({
      ...beforeCallStore.getSource(beforeCall.id)!,
      tenantId: "customer-replacement",
      url: "https://replacement.example/feed.xml",
      createdAt: "2026-07-24T12:00:30.000Z",
      updatedAt: "2026-07-24T12:00:30.000Z"
    });
    let staleModelCalls = 0;
    const staleRetry = await runAutomaticReviewCycle({ store: beforeCallStore } as any, {
      now: "2026-07-24T12:02:00.000Z",
      clock: () => "2026-07-24T12:02:00.000Z",
      allTenants: true,
      modelVersion: "hanasand",
      aiBase: "http://ai.test",
      fetcher: async () => {
        staleModelCalls++;
        throw new Error("stale task must not reach the model");
      }
    });
    expect(staleRetry).toMatchObject({ attempted: 1, results: [{ state: "terminal", outcome: "superseded" }] });
    expect(staleModelCalls).toBe(0);

    const beforeWriteStore = new InMemoryScraperStore();
    const beforeWrite = reviewableCandidate(beforeWriteStore, "reassigned-before-write");
    let writeRaceCalls = 0;
    const writeRace = await runAutomaticReviewCycle({ store: beforeWriteStore } as any, {
      now: "2026-07-24T13:00:00.000Z",
      clock: () => "2026-07-24T13:00:00.000Z",
      allTenants: true,
      modelVersion: "hanasand",
      aiBase: "http://ai.test",
      fetcher: async (_input, init) => {
        writeRaceCalls++;
        const current = beforeWriteStore.getSource(beforeWrite.id)!;
        beforeWriteStore.saveSource({
          ...current,
          tenantId: "customer-during-review",
          url: "https://during-review.example/feed.xml",
          createdAt: "2026-07-24T13:00:01.000Z",
          updatedAt: "2026-07-24T13:00:01.000Z"
        });
        return completedSourceReview(JSON.parse(String(init?.body)), true);
      }
    });
    expect(writeRace).toMatchObject({ attempted: 1, results: [{ state: "terminal", outcome: "superseded" }] });
    expect(writeRaceCalls).toBe(1);
    expect(beforeWriteStore.getSource(beforeWrite.id)?.metadata?.automaticSourceReview).toBeUndefined();
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

function reviewableCandidate(store: InMemoryScraperStore, sourceId: string) {
  usefulCapture(store, sourceId, undefined, `run-${sourceId}`, [`https://${sourceId}.example/report`]);
  const current = store.getSource(sourceId)!;
  return store.saveSource({
    ...current,
    status: "candidate",
    metadata: {
      ...current.metadata,
      productionCollection: false,
      sourcePortfolioVerification: {
        verifiedAt: generatedAt,
        legalBasisVerifiedAt: generatedAt,
        outcome: "content_parsed",
        observedItemCount: 1
      }
    }
  });
}

function completedSourceReview(request: any, relevant: boolean) {
  const evidenceId = request.evidence[0].id;
  return Response.json({
    status: "completed",
    provider: "hanasand-ai",
    model: "hanasand-inspur",
    conversationId: `source-review-${request.subject.id}`,
    decision: {
      schemaVersion: AUTOMATIC_REVIEW_RESPONSE_SCHEMA,
      promptVersion: request.promptVersion,
      modelVersion: request.requestedModelVersion,
      subject: request.subject,
      action: relevant ? "confirm" : "reject",
      claimValidity: relevant ? "supported" : "invalid",
      actorAttribution: { canonicalName: null, aliases: [] },
      supportingEvidenceIds: relevant ? [evidenceId] : [],
      contradictoryEvidenceIds: relevant ? [] : [evidenceId],
      uncertainty: [],
      falsePositiveReasons: relevant ? [] : ["The retained parser output is unrelated or malformed source material."],
      rationale: relevant
        ? "The retained parser output is coherent operational threat intelligence."
        : "The retained parser output is not relevant operational threat intelligence.",
      confidence: 0.9,
      calibrationContext: { sourceCount: 1, evidenceAssessment: relevant ? "relevant" : "irrelevant" }
    }
  });
}

function uncertainSourceReview(request: any) {
  return Response.json({
    status: "completed",
    provider: "hanasand-ai",
    model: "hanasand-inspur",
    conversationId: `uncertain-source-review-${request.subject.id}`,
    decision: {
      schemaVersion: AUTOMATIC_REVIEW_RESPONSE_SCHEMA,
      promptVersion: request.promptVersion,
      modelVersion: request.requestedModelVersion,
      subject: request.subject,
      action: "mark_needs_review",
      claimValidity: "uncertain",
      actorAttribution: { canonicalName: null, aliases: [] },
      supportingEvidenceIds: [],
      contradictoryEvidenceIds: [],
      uncertainty: ["The bounded parser output is not sufficient for approval."],
      falsePositiveReasons: ["The bounded parser output needs a newer retained sample."],
      rationale: "The source requires newer retained parser evidence.",
      confidence: 0.5,
      calibrationContext: { sourceCount: 1, evidenceAssessment: "insufficient" }
    }
  });
}

function approveSourceReview(store: InMemoryScraperStore, sourceId: string) {
  const current = store.getSource(sourceId)!;
  store.saveSource({
    ...current,
    metadata: {
      ...current.metadata,
      automaticSourceReview: {
        schemaVersion: SOURCE_AUTOMATIC_REVIEW_SCHEMA,
        state: "approved",
        promptVersion: SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION,
        configuredModelVersion: "hanasand",
        sourceIdentity: automaticSourceReviewIdentity(current),
        requestSha256: "a".repeat(64),
        selectedEvidenceIds: ["retained-source-output"],
        runtimeIdentity: { status: "completed", conversationId: "source-review-proof" },
        decision: { subject: { type: "source", id: sourceId }, action: "confirm", claimValidity: "supported" }
      }
    }
  } as any);
}
