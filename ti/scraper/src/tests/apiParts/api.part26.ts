import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("classifies public-channel status route queued rate-limited policy-disabled duplicate and edit delete states", async () => {
    const approvedGovernance = {
      approvalRequired: true,
      approvalState: "approved" as const,
      metadataOnly: false,
      approvedAt: new Date(0).toISOString(),
      approvedBy: "reviewer"
    };

    const queuedStore = new InMemoryScraperStore();
    queuedStore.saveSource(source({
      id: "src_queued_telegram",
      name: "Queued public channel",
      type: "telegram_public",
      url: "https://t.me/queuedintel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"] }
    }));
    const queued = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: queuedStore,
      frontier: new FocusedFrontier()
    }));
    expect(queued).toMatchObject({ status: "queued", queuedTasks: 1 });

    const rateStore = new InMemoryScraperStore();
    rateStore.saveSource(source({
      id: "src_rate_telegram",
      name: "Rate limited public channel",
      type: "telegram_public",
      url: "https://t.me/ratelimitedintel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"], rateLimitResetAt: "2999-01-01T00:00:00.000Z" }
    }));
    const rateLimited = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: rateStore,
      frontier: new FocusedFrontier()
    }));
    expect(rateLimited).toMatchObject({
      status: "rate_limited",
      promotion: { rateLimitBackoff: [{ sourceId: "src_rate_telegram" }] },
      operatorStates: [{ sourceId: "src_rate_telegram", state: "delayed", collectable: false }]
    });

    const disabledStore = new InMemoryScraperStore();
    disabledStore.saveSource(source({
      id: "src_disabled_telegram",
      name: "Disabled public channel",
      type: "telegram_public",
      url: "https://t.me/disabledintel",
      accessMethod: "official_api",
      status: "disabled",
      risk: "medium",
      legalNotes: "Disabled public channel.",
      metadata: { actors: ["APT29"] }
    }));
    const policyDisabled = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: disabledStore,
      frontier: new FocusedFrontier()
    }));
    expect(policyDisabled).toMatchObject({
      status: "policy_disabled",
      promotion: { policyDisabled: [{ sourceId: "src_disabled_telegram" }] },
      operatorStates: [{ sourceId: "src_disabled_telegram", state: "policy_blocked", reviewRequired: true }]
    });

    const quarantinedStore = new InMemoryScraperStore();
    quarantinedStore.saveSource(source({
      id: "src_quarantined_telegram",
      name: "Quarantined public channel",
      type: "telegram_public",
      url: "https://t.me/quarantinedintel",
      accessMethod: "official_api",
      status: "quarantined",
      risk: "medium",
      legalNotes: "Quarantined public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"] }
    }));
    const quarantined = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: quarantinedStore,
      frontier: new FocusedFrontier()
    }));
    expect(quarantined).toMatchObject({
      operatorStates: [{ sourceId: "src_quarantined_telegram", state: "quarantined", collectable: false }]
    });

    const duplicateStore = new InMemoryScraperStore();
    duplicateStore.saveSource(source({
      id: "src_duplicate_telegram",
      name: "Duplicate public channel",
      type: "telegram_public",
      url: "https://t.me/duplicateintel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"], lastDiscoveredUrls: ["https://t.me/duplicateintel/40"] }
    }));
    duplicateStore.saveCapture(telegramCapture({
      id: "cap_duplicate_telegram",
      sourceId: "src_duplicate_telegram",
      url: "https://t.me/duplicateintel/40",
      channel: "duplicateintel",
      messageId: 40,
      body: "APT29 repeated public-channel URL"
    }));
    const duplicate = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: duplicateStore,
      frontier: new FocusedFrontier()
    }));
    expect(duplicate).toMatchObject({
      status: "high_duplicate",
      promotion: {
        duplicateSuppressed: [{ sourceId: "src_duplicate_telegram", messageUrl: "https://t.me/duplicateintel/40" }]
      },
      reliability: {
        sources: [{
          sourceId: "src_duplicate_telegram",
          recommendedActions: expect.arrayContaining(["suppress_repeated_urls"])
        }]
      },
      abuseControls: [{
        sourceId: "src_duplicate_telegram",
        suppressedUrlCount: 1
      }]
    });

    const churnStore = new InMemoryScraperStore();
    churnStore.saveSource(source({
      id: "src_churn_telegram",
      name: "Churn public channel",
      type: "telegram_public",
      url: "https://t.me/churnintel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"] }
    }));
    churnStore.saveCapture(telegramCapture({
      id: "cap_churn_edit",
      sourceId: "src_churn_telegram",
      url: "https://t.me/churnintel/50",
      channel: "churnintel",
      messageId: 50,
      body: "APT29 edited public-channel note",
      editDate: "2026-05-24T00:01:00.000Z"
    }));
    churnStore.saveCapture(telegramCapture({
      id: "cap_churn_deleted",
      sourceId: "src_churn_telegram",
      url: "https://t.me/churnintel/51",
      channel: "churnintel",
      messageId: 51,
      body: "APT29 deleted public-channel note",
      messageState: "deleted"
    }));
    const churn = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor&cursor=49"), {
      store: churnStore,
      frontier: new FocusedFrontier()
    }));
    expect(churn).toMatchObject({
      status: "ready",
      poll: {
        updatedMessages: [{ messageId: 50 }],
        deletedOrUnavailable: [{ messageId: 51 }]
      },
      cutoverReport: {
        reconciliation: {
          summary: {
            high_edit_delete_churn: 0
          }
        }
      }
    });
  });
});
