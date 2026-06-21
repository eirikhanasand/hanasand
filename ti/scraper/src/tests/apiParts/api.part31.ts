import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("routes public-channel apply-plan rate-limit and rollback-only quarantine contracts", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_rate_limited_channel",
      name: "Rate limited public channel",
      type: "telegram_public",
      url: "https://t.me/rate_limited_channel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public Telegram channel.",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: false },
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "reviewer",
      metadata: {
        actors: ["APT29"],
        rateLimitResetAt: "2999-01-01T00:00:00.000Z"
      }
    }));

    const rateLimited = await body(await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", actions: ["delay_poll"] })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(rateLimited.applyPlan).toMatchObject({
      summary: {
        stepCount: 1,
        automationSafeCount: 1,
        canAutoApply: true
      },
      steps: [{
        action: "delay_poll",
        execution: "automation_safe",
        rateLimitSafety: expect.arrayContaining(["honor current rate-limit reset at 2999-01-01T00:00:00.000Z"])
      }]
    });

    const rollbackStore = new InMemoryScraperStore();
    rollbackStore.saveSource(source({
      id: "src_active_private",
      name: "Active unsafe private channel",
      type: "telegram_public",
      url: "https://t.me/+privateInvite",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Unsafe active fixture.",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: false },
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "reviewer",
      metadata: { actors: ["APT29"], accountAutomation: true }
    }));
    const rollback = await body(await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", actions: ["quarantine_channel"] })
    }), {
      store: rollbackStore,
      frontier: new FocusedFrontier()
    }));

    expect(rollback.applyPlan).toMatchObject({
      summary: {
        stepCount: 1,
        rollbackOnlyCount: 1
      },
      steps: [{
        action: "quarantine_channel",
        execution: "rollback_only",
        manual: true
      }]
    });
  });
});
