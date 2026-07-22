import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("reports disabled darknet metadata live search when kill switch is active", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_disabled_onion",
      name: "Approved onion metadata",
      type: "tor_metadata",
      url: "http://claims.onion/actor/{query}",
      accessMethod: "approved_proxy",
      status: "active",
      risk: "high",
      legalNotes: "Approved metadata-only onion source fixture.",
      approvedAt: new Date(0).toISOString(),
      approvedBy: "reviewer",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: new Date(0).toISOString(),
        approvedBy: "reviewer"
      }
    }));
    const config = loadRuntimeConfig({});
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=LockBit&entityType=actor"), {
      store,
      frontier: new FocusedFrontier(),
      config: {
        ...config,
        limits: { ...config.limits, maxConcurrentDarknetMetadataTasks: 0 }
      }
    }));

    expect(response.darknetMetadata).toMatchObject({
      status: "disabled",
      queuedTasks: 0,
      blocked: [{
        sourceId: "src_disabled_onion",
        state: "disabled"
      }]
    });
    expect((response.planner as { coverageGaps: string[] }).coverageGaps).toContain("public_chat");
  });
});
