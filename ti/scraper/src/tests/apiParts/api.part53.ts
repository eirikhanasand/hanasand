import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("attaches live search polling to an active run and survives repeated polling under load", async () => {
    const store = new InMemoryScraperStore();
    for (let index = 0; index < 100; index += 1) {
      store.saveSource(source({
        id: `src_live_${index}`,
        type: index % 5 === 0 ? "api" : index % 2 === 0 ? "rss" : "static_web",
        trustScore: 0.5 + (index % 10) / 20,
        tags: index % 13 === 0 ? ["turla", "snake"] : undefined
      }));
    }
    const frontier = new FocusedFrontier();
    const options = { store, frontier };
    const created = await body(await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "Turla", entityType: "actor", tenantId: "tenant_live" })
    }), options));
    const run = created.run as { id: string };

    for (let poll = 0; poll < 3; poll += 1) {
      const response = await body(await handleApiRequest(api("/v1/intel/search?q=Turla&entityType=actor", {
        headers: { "x-tenant-id": "tenant_live" }
      }), options));
      const planner = response.planner as {
        activeRunId?: string;
        attachedToActiveRun: boolean;
        backpressureState: string;
        reuseKey: string;
        queuedTaskCount: number;
        nextPollSeconds: number;
      };

      expect(planner.attachedToActiveRun).toBe(true);
      expect(planner.backpressureState).toBe("attached_to_active_run");
      expect(planner.reuseKey).toMatch(/^live-reuse_/);
      expect(planner.activeRunId).toBe(run.id);
      expect(planner.queuedTaskCount).toBeGreaterThan(0);
      expect(planner.nextPollSeconds).toBe(5);
    }
  }, 15_000);
});
