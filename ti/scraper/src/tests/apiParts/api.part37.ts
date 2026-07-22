import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("routes restricted metadata nested apply-plan and rejects invalid actions", async () => {
    const store = new InMemoryScraperStore();
    for (const item of apiRestrictedMetadataApplyPlanSources()) store.saveSource(item);

    const nested = await body(await handleApiRequest(api("/v1/sources/src_restricted_ready/restricted-metadata/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: ["enable_metadata_only_queue"] })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(nested.applyPlan).toMatchObject({
      summary: {
        automation_safe: 1,
        human_approval_required: 0,
        blocked: 0,
        rollback_only: 0
      },
      actions: [{
        sourceId: "src_restricted_ready",
        action: "enable_metadata_only_queue",
        safety: "automation_safe"
      }]
    });

    const invalid = await handleApiRequest(api("/v1/restricted-metadata/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: ["download_payload"] })
    }), {
      store,
      frontier: new FocusedFrontier()
    });
    const payload = await body(invalid);
    expect(invalid.status).toBe(400);
    expect(payload).toMatchObject({
      error: {
        code: "invalid_action",
        message: "Unsupported restricted-metadata apply-plan action",
        details: {
          invalidActions: ["download_payload"],
          allowedActions: expect.arrayContaining(["enable_metadata_only_queue", "keep_source_blocked", "apply_kill_switch"])
        }
      }
    });
  });
});
