import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("reports public-channel source-pack recommendations for uncovered live search queries", async () => {
    const store = new InMemoryScraperStore();
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json();
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Volt%20Typhoon&entityType=actor"), {
      store,
      frontier: new FocusedFrontier(),
      publicTelegramSourcePacks: [pack]
    }));

    const publicChannel = response.publicChannel as {
      status: string;
      queuedTasks: number;
      sourcePackRecommendations: Array<{ sourcePackId: string; sourceId: string; requiredAction: string }>;
      activationRecommendations: Array<{ sourcePackId?: string; sourceId: string; requiredAction: string }>;
    };
    expect(publicChannel.status).toBe("pending_channel_search");
    expect(publicChannel.queuedTasks).toBe(0);
    expect(publicChannel.sourcePackRecommendations[0]).toMatchObject({
      sourcePackId: "public-telegram-cti-candidates",
      sourceId: "tg_candidate_actor_identity",
      requiredAction: "review"
    });
    expect(publicChannel.activationRecommendations[0]).toMatchObject({
      sourcePackId: "public-telegram-cti-candidates",
      sourceId: "tg_candidate_actor_identity",
      requiredAction: "review"
    });
    const activationProgram = (response.publicChannel as {
      activationProgram: {
        recommendedPublicPacks: Array<{ sourcePackId: string; sourceId: string }>;
        noApprovedChannelGaps: Array<{ reason: string }>;
      };
    }).activationProgram;
    expect(activationProgram.recommendedPublicPacks[0]).toMatchObject({
      sourcePackId: "public-telegram-cti-candidates",
      sourceId: "tg_candidate_actor_identity"
    });
    expect(activationProgram.noApprovedChannelGaps[0]).toMatchObject({
      reason: "no_approved_channels"
    });
    expect((response.publicChannel as { reconciliation: { packCount: number; repairs: unknown[]; summary: Record<string, number> } }).reconciliation).toMatchObject({
      packCount: 1,
      summary: {
        no_query_coverage: 0
      }
    });
    expect((response.publicChannel as { cutoverReport: { summary: Record<string, unknown>; sourcePackRecommendations: unknown[] } }).cutoverReport).toMatchObject({
      summary: {
        readyChannelCount: 0,
        pendingReviewCount: 0,
        rateLimitedCount: 0,
        staleCursorCount: 0,
        highDuplicateUrlCount: 0,
        safePartialEvidenceCount: 0,
        recommendedNextAction: "activate_source_pack"
      },
      sourcePackRecommendations: expect.any(Array)
    });
    const applyPlan = (response.publicChannel as { applyPlan: { summary: Record<string, unknown>; promotionGate: Record<string, unknown>; steps: Array<Record<string, unknown>> } }).applyPlan;
    expect(applyPlan).toMatchObject({
      summary: {
        humanApprovalRequiredCount: 5,
        canAutoApply: false
      },
      promotionGate: {
        metadataOnlyMedia: true,
        piiMinimizationRequired: true
      }
    });
    expect(applyPlan.steps[0]).toMatchObject({
      action: "activate_source_pack",
      execution: "human_approval_required",
      automationSafe: false,
      manual: true
    });
  });
});
