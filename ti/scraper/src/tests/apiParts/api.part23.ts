import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("exposes safe ops resource snapshot with queue and worker state", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.saveSource(source());
    const supervisor = new WorkerSupervisor(createLogger("error"), new MetricsRegistry());
    supervisor.register("telegram-1", "telegram");
    supervisor.markRunning("telegram-1");

    await handleApiRequest(api("/v1/intel/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor" })
    }), { store, frontier, config: loadRuntimeConfig({}), supervisor });

    const snapshot = await body(await handleApiRequest(api("/v1/ops/resource-snapshot"), {
      store,
      frontier,
      config: loadRuntimeConfig({}),
      supervisor
    }));

    expect(snapshot.service).toBe("ti-scraper");
    expect((snapshot.queue as { queued: number }).queued).toBeGreaterThanOrEqual(0);
    expect((snapshot.memory as { targetMb: number }).targetMb).toBe(8 * 1024);
    expect((snapshot.memory as { ceilingMb: number }).ceilingMb).toBe(14 * 1024);
    expect((snapshot.resources as { configurationSource: string }).configurationSource).toBe("runtime_config");
    expect((snapshot.workerPools as { telegram: number }).telegram).toBe(8);
    expect((snapshot.workers as Array<{ id: string; state: string }>)[0]).toMatchObject({ id: "telegram-1", state: "running" });
  });
});
