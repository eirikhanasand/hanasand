import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("defers public live searches under background queue pressure without duplicating reuse keys", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    for (const actor of ["Scattered Spider", "Akira", "Volt Typhoon", "Turla"]) {
      store.saveSource(source({
        id: `src_${actor.replaceAll(" ", "_").toLowerCase()}`,
        type: "rss",
        trustScore: 0.9,
        tags: [actor.toLowerCase()]
      }));
    }
    for (let index = 0; index < 50; index += 1) {
      frontier.add({
        source: source({ id: `src_sweep_${index}`, type: index % 2 === 0 ? "rss" : "static_web" }),
        tenantId: `tenant_sweep_${index % 7}`,
        intelRequestId: `sweep_${Math.floor(index / 100)}`,
        url: `https://sweep.example.test/background/${index}`,
        discoveredAt: "2026-05-24T00:00:00.000Z",
        anchorText: "APT ransomware campaign exploit",
        parentRelevance: 0.9,
        novelty: 0.8,
        freshness: 0.8,
        fairnessKey: "background:sweep"
      });
    }

    const executed: string[] = [];
    const options = { store, frontier, runExecutor: (runId: string) => executed.push(runId) };
    const reuseKeys = new Map<string, string>();
    for (const actor of ["Scattered Spider"]) {
      for (let poll = 0; poll < 1; poll += 1) {
        const response = await body(await handleApiRequest(api(`/v1/intel/search?q=${encodeURIComponent(actor)}&entityType=actor`, {
          headers: { "x-tenant-id": "tenant_public" }
        }), options));
        const planner = response.planner as {
          backpressureState: string;
          backpressureReason?: string;
          reuseKey: string;
          activeRunId?: string;
        };

        expect(planner.activeRunId).toBeUndefined();
        expect(planner.backpressureState).toMatch(/deferred_by_queue_pressure|deferred_by_source_backoff/);
        expect(planner.backpressureReason ?? "").toMatch(/frontier queue depth|crawl backoff|freshness/);
        if (!reuseKeys.has(actor)) reuseKeys.set(actor, planner.reuseKey);
        expect(planner.reuseKey).toBe(reuseKeys.get(actor) ?? "");
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.listRuns()).toEqual([]);
    expect(executed).toEqual([]);
  }, 15_000);

  test("does not persist live-search work while storage writes are backpressured", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_storage_pressure", type: "rss", tags: ["storage pressure actor"] }));
    (store as any).databaseHealthSnapshot = () => ({ ok: false, pendingWrites: 2, lastWriteError: "Failed to read data" });
    const executed: string[] = [];

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Storage%20Pressure%20Actor&entityType=actor"), {
      store,
      frontier: new FocusedFrontier(),
      runExecutor: (runId: string) => executed.push(runId),
    })) as Record<string, any>;

    expect(response.planner).toMatchObject({
      backpressureState: "deferred_by_storage_pressure",
      backpressureReason: "Failed to read data",
      queuedTaskCount: 0,
      retryAfterSeconds: 30,
    });
    expect(response.planner.activeRunId).toBeUndefined();
    expect(store.listPlans()).toEqual([]);
    expect(store.listRuns()).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(executed).toEqual([]);
  });
});
