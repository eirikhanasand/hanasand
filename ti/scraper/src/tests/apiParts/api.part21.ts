import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("returns consistent 400 and 404 error bodies", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier() };

    const badExport = await handleApiRequest(api("/v1/exports/stix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    }), options);
    expect(badExport.status).toBe(400);
    expect(await body(badExport)).toMatchObject({ error: { code: "bad_request" } });

    const missingRun = await handleApiRequest(api("/v1/intel/runs/run_missing"), options);
    expect(missingRun.status).toBe(404);
    expect(await body(missingRun)).toMatchObject({ error: { code: "not_found" } });
  });
});
