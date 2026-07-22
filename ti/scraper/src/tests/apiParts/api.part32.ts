import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("rejects invalid public-channel apply-plan actions", async () => {
    const response = await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", actions: ["join_private_group"] })
    }), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const payload = await body(response);

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: {
        code: "invalid_action",
        message: "Unsupported public-channel apply-plan action",
        details: {
          invalidActions: ["join_private_group"],
          allowedActions: expect.arrayContaining(["activate_source_pack", "request_review", "delay_poll"])
        }
      }
    });
  });
});
