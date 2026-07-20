import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("creates idempotent intelligence runs and exposes status", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const options = { store, frontier: new FocusedFrontier() };
    const request = {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "retry-1" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    };

    const first = await body(await handleApiRequest(api("/v1/intel/runs", request), options));
    const second = await body(await handleApiRequest(api("/v1/intel/runs", request), options));
    const firstRun = first.run as { id: string; status: string; taskCount: number };
    const secondRun = second.run as { id: string };

    expect(firstRun.status).toBe("queued");
    expect(firstRun.taskCount).toBe(1);
    expect(secondRun.id).toBe(firstRun.id);

    const status = await body(await handleApiRequest(api(`/v1/intel/runs/${firstRun.id}?tenantId=tenant_a`), options));
    expect((status.run as { id: string }).id).toBe(firstRun.id);
  });
});
