import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("reports pending public-channel search with activation recommendations", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_pending_telegram",
      name: "Ransomware candidate channel",
      type: "telegram_public",
      url: "https://t.me/ransomwareintel",
      accessMethod: "official_api",
      status: "candidate",
      risk: "medium",
      legalNotes: "Candidate public Telegram channel fixture.",
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: false
      },
      metadata: { ransomware: ["Akira"], victims: ["Fjord Energy AS"], topicTags: ["ransomware"] }
    }));

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Fjord%20Energy%20AS&entityType=victim"), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(response.publicChannel).toMatchObject({
      status: "pending_channel_search",
      queuedTasks: 0,
      evidence: [],
      coverageGaps: [{
        reason: "matching_channels_pending_review",
        sourceId: "src_pending_telegram",
        requiredAction: "approve"
      }],
      activationRecommendations: [{
        sourceId: "src_pending_telegram",
        requiredAction: "approve"
      }]
    });
  });
});
