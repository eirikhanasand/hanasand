import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("rejects idempotency key reuse with a different request body", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const options = { store, frontier: new FocusedFrontier() };
    const headers = { "content-type": "application/json", "idempotency-key": "retry-conflict" };

    await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    }), options);
    const conflict = await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "APT28", entityType: "actor", tenantId: "tenant_a" })
    }), options);
    const payload = await body(conflict);

    expect(conflict.status).toBe(409);
    expect(payload.error).toMatchObject({ code: "idempotency_conflict" });
  });
});
