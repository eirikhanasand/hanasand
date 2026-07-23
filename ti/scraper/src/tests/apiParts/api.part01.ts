import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("returns typed health and paginated sources", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "one" }));
    store.saveSource(source({ id: "two", name: "Second" }));
    store.saveAnalystMetadataReviewTask({ id: "review_pressure", recordKind: "automatic_intelligence_review_task", state: "queued", queuedAt: "2026-07-23T00:00:00.000Z", unsafeMaterialAccessed: false });
    store.saveEvaluationBenchmark({ id: "evaluation_pressure", reviewMode: "automatic_model", status: "annotating", manifest: [{ id: "evaluation_task", automation: { status: "retry_scheduled" } }] });
    const reviewInventory = store.listAnalystMetadataReviewTasks.bind(store);
    const evaluationInventory = store.listEvaluationBenchmarks.bind(store);
    const runInventory = store.listRuns.bind(store);
    const inventoryReads = { review: 0, evaluation: 0, runs: 0 };
    (store as any).listAnalystMetadataReviewTasks = () => { inventoryReads.review++; return reviewInventory(); };
    (store as any).listEvaluationBenchmarks = () => { inventoryReads.evaluation++; return evaluationInventory(); };
    (store as any).listRuns = () => { inventoryReads.runs++; return runInventory(); };
    const options = {
      store,
      frontier: new FocusedFrontier(),
      config: loadRuntimeConfig({}),
      canaryLoop: { getState: () => ({ maxConcurrentTasks: 7 }) },
      evaluationLoop: { getState: () => ({ running: true, cycleCount: 4, errorCount: 1 }) }
    };

    const health = await body(await handleApiRequest(api("/v1/health"), options));
    expect(health).toMatchObject({
      ok: true,
      service: "ti-scraper",
      version: "v1",
      runtimeLimits: {
        collectionMaxConcurrentTasks: 7,
        automaticReviewMaxConcurrentTasks: 3,
        automaticEvaluationMaxTasksPerCycle: 2
      }
    });
    expect(health).not.toHaveProperty("pressure");
    expect(inventoryReads).toEqual({ review: 0, evaluation: 0, runs: 0 });
    expect((health.resources as { memory: { containerLimitMb: number | null } }).memory).toHaveProperty("containerLimitMb");

    const capacity = await body(await handleApiRequest(api("/v1/ops/resource-snapshot"), options));
    expect(capacity).toMatchObject({
      pressure: {
        automaticReview: { total: 1, backlog: 1, counts: { queued: 1 } },
        automaticEvaluation: { benchmarkCount: 1, taskCount: 1, counts: { retry_scheduled: 1 }, running: true, cycleCount: 4, errorCount: 1 }
      }
    });
    expect(inventoryReads).toEqual({ review: 1, evaluation: 1, runs: 1 });

    const sources = await body(await handleApiRequest(api("/v1/sources?limit=1"), options));
    expect((sources.sources as unknown[])).toHaveLength(1);
    expect(sources.nextCursor).toBe("1");
  });
});
