import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryDwmSourcePackRegistryAdapter } from "../storage/dwmSourcePackRegistry.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("dwm source requests", () => {
  test("creates an active bounded public Telegram source", async () => {
    const store = new InMemoryScraperStore();
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "https://t.me/public_threat_test", type: "telegram_channel", tenantId: "tenant_acme", priority: "high" })
    }), { store, frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(201);
    expect(body.source.type).toBe("telegram_public");
    expect(body.source.status).toBe("active");
    expect(body.source.metadata.canaryPortfolio).toBe(true);
    expect(body.source.metadata.collectionBoundary.noPrivateAccess).toBe(true);
    expect(body.candidate).toMatchObject({
      family: "telegram_public",
      target: "https://t.me/public_threat_test",
      status: "active",
      requestedBy: "api",
      validationResult: { allowed: true }
    });
    expect(body.lifecycle).toMatchObject({ parserStatus: "telegram_public_parser_ready" });
    expect(store.listSources()).toHaveLength(1);
  });

  test("blocks private Telegram invite links", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "https://t.me/+privateInvite", type: "telegram_channel" })
    }), { store: new InMemoryScraperStore(), frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("telegram_policy_blocked");
  });

  test("returns validation-ready candidate summaries for bulk public Telegram intake", async () => {
    const store = new InMemoryScraperStore();
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ targets: ["@bulk_public_cti", "https://t.me/+blockedPrivate"], tenantId: "tenant_acme", activate: false, requestedBy: "analyst-bulk" })
    }), { store, frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(201);
    expect(body.summary).toMatchObject({ createdCount: 1, rejectedCount: 1 });
    expect(body.createdCandidates[0]).toMatchObject({
      family: "telegram_public",
      requestedBy: "analyst-bulk",
      status: "queued",
      validationResult: { allowed: true },
      policyBoundary: { noPrivateAccess: true }
    });
  });

  test("accepts mixed source candidate packs with policy validation and no live scraping", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.saveDwmWatchlist({
      id: "watch_pack_apt29",
      tenantId: "tenant_acme",
      name: "APT29 source pack",
      terms: [{ value: "APT29", kind: "company" }],
      status: "active",
      createdAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z"
    });

    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        sourcePackId: "pack_apt29_growth",
        sourcePackLabel: "APT29 source-growth pack",
        tenantId: "tenant_acme",
        scope: "APT29",
        requestedBy: "source-growth-worker",
        candidates: [
          { target: "@pack_public_cti", type: "telegram_channel" },
          { target: "metadata://darkweb/apt29/claims", type: "restricted_metadata" },
          { target: "@pack_public_cti", type: "telegram_channel" },
          { target: "not-a-public-channel", type: "telegram_channel" },
          { target: "@pack_suppressed_cti", type: "telegram_channel", suppress: true, reason: "low value duplicate family" },
          { target: "@pack_retry_cti", type: "telegram_channel" },
          { target: "@pack_review_suppress_cti", type: "telegram_channel" }
        ]
      })
    }), { store, frontier });
    const body = await response.json() as any;

    expect(response.status).toBe(201);
    expect(body.summary).toMatchObject({
      evaluatedCount: 7,
      acceptedCount: 5,
      rejectedCount: 1,
      duplicateCount: 1,
      telegramPublicCount: 4,
      restrictedMetadataCount: 1,
      suppressedCount: 1,
      queuedForCollectionCount: 0
    });
    expect(body.safeOutput).toMatchObject({
      rawUnsafeRowsStored: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    });
    expect(body.request).toMatchObject({ sourcePackId: "pack_apt29_growth", label: "APT29 source-growth pack" });
    expect(body.packStatus).toMatchObject({
      sourcePackId: "pack_apt29_growth",
      totalCandidateCount: 7,
      persistedCandidateCount: 5,
      rejectedCount: 1,
      duplicateCount: 1,
      suppressedCount: 1,
      queuedForCollectionCount: 0,
      safeOutput: { rawUnsafeRowsStored: false }
    });
    expect(body.packRegistry).toMatchObject({
      id: "pack_apt29_growth",
      candidateIds: expect.any(Array),
      familyCoverage: {
        telegram: { total: 6, active: 0, pending: 3, blocked: 3 },
        darkweb_metadata: { total: 1, pending: 1 }
      },
      safeOutput: { rawRejectedTargetsStored: false, rawDuplicateTargetsStored: false }
    });

    const publicCandidate = body.acceptedCandidates.find((candidate: any) => candidate.family === "telegram_public" && candidate.status === "queued");
    const restrictedCandidate = body.acceptedCandidates.find((candidate: any) => candidate.family === "darkweb_metadata");
    const suppressedCandidate = body.acceptedCandidates.find((candidate: any) => candidate.status === "suppressed");
    const retryCandidate = body.acceptedCandidates.find((candidate: any) => candidate.target === "@pack_retry_cti");
    const reviewSuppressCandidate = body.acceptedCandidates.find((candidate: any) => candidate.target === "@pack_review_suppress_cti");
    expect(publicCandidate).toMatchObject({
      sourcePackId: "pack_apt29_growth",
      target: "@pack_public_cti",
      requestedBy: "source-growth-worker",
      policyBoundary: { noPrivateAccess: true },
      validationResult: { allowed: true },
      parser: { mode: "public_channel_handoff" },
      operationalNextStep: {
        collectionTrigger: { queued: false, reason: "awaiting_operator_promotion" },
        alertRebuild: { skipped: true, reason: "captures_required_before_alert_rebuild" }
      }
    });
    expect(restrictedCandidate).toMatchObject({
      family: "darkweb_metadata",
      status: "approval_required",
      policyBoundary: { metadataOnly: true, noDownloads: true },
      validationResult: { allowed: false, policyGated: true },
      parser: { mode: "restricted_metadata" },
      approvalTicket: { status: "open", unsafeScrapingAllowed: false },
      operationalNextStep: { collectionTrigger: { queued: false, reason: "metadata_only_approval_required" } }
    });
    expect(suppressedCandidate).toMatchObject({
      status: "suppressed",
      operationalNextStep: {
        collectionTrigger: { queued: false, reason: "source_suppressed" },
        retryHint: "request a new candidate if scope changes"
      }
    });
    expect(body.duplicates[0]).toMatchObject({ target: "@pack_public_cti", duplicateOf: publicCandidate.sourceId });
    expect(body.rejected[0]).toMatchObject({ target: "not-a-public-channel", code: "invalid_target", retryHint: expect.any(String) });
    expect(store.listSources()).toHaveLength(5);
    expect(frontier.snapshot()).toHaveLength(0);

    const promoted = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_review",
        packAction: "approve",
        candidateIds: [publicCandidate.id],
        approvedBy: "analyst-pack",
        reason: "approved for bounded source-pack collection"
      })
    }), { store, frontier });
    const promotedBody = await promoted.json() as any;
    expect(promoted.status).toBe(200);
    expect(promotedBody.results[0]).toMatchObject({
      reviewStatus: "approved",
      candidate: { id: publicCandidate.id, sourcePackId: "pack_apt29_growth", status: "active" },
      collectionTrigger: { queued: true, candidateId: publicCandidate.id }
    });
    expect(promotedBody.packStatus).toMatchObject({
      queuedForCollectionCount: 1,
      queuedJobIds: [promotedBody.results[0].collectionTrigger.jobId]
    });
    expect(frontier.snapshot()).toHaveLength(1);

    const observed = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "record_capture",
        candidateId: publicCandidate.id,
        collectionTaskId: promotedBody.results[0].collectionTrigger.jobId,
        captureText: "APT29 source-pack public Telegram mention observed without live network scraping."
      })
    }), { store, frontier });
    const observedBody = await observed.json() as any;
    expect(observed.status).toBe(200);
    expect(observedBody.lifecycle).toMatchObject({ collectionStatus: "capture_observed" });
    expect(observedBody.alertRebuild).toMatchObject({ status: "completed", alertCount: 1, watchlistIds: ["watch_pack_apt29"] });
    expect(store.listCaptures()).toHaveLength(1);
    expect(store.listDwmAlerts()).toHaveLength(1);

    const rejected = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_review",
        packAction: "reject",
        candidateIds: [restrictedCandidate.id],
        decidedBy: "analyst-pack",
        reason: "metadata-only source not needed for this pack"
      })
    }), { store, frontier });
    const rejectedBody = await rejected.json() as any;
    expect(rejected.status).toBe(200);
    expect(rejectedBody.results[0]).toMatchObject({
      reviewStatus: "rejected",
      candidate: { id: restrictedCandidate.id, status: "rejected" },
      collectionTrigger: { queued: false, unsafeJobQueued: false }
    });

    const suppressed = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_review",
        packAction: "suppress",
        candidateIds: [reviewSuppressCandidate.id],
        decidedBy: "analyst-pack",
        reason: "suppressed after source-pack review"
      })
    }), { store, frontier });
    const suppressedBody = await suppressed.json() as any;
    expect(suppressed.status).toBe(200);
    expect(suppressedBody.results[0]).toMatchObject({
      reviewStatus: "suppressed",
      candidate: { id: reviewSuppressCandidate.id, status: "suppressed" },
      collectionTrigger: { queued: false, unsafeJobQueued: false }
    });

    const retried = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_review",
        packAction: "retry",
        candidateIds: [retryCandidate.id],
        decidedBy: "analyst-pack",
        errorCode: "parser_timeout",
        reason: "source-pack parser fixture timed out"
      })
    }), { store, frontier });
    const retriedBody = await retried.json() as any;
    expect(retried.status).toBe(200);
    expect(retriedBody.results[0]).toMatchObject({
      reviewStatus: "retry_scheduled",
      candidate: { id: retryCandidate.id },
      health: { status: "collection_failed", lastError: "parser_timeout" },
      parser: { status: "parser_retry_scheduled", retryAfter: expect.any(String) }
    });

    const status = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_status", sourcePackId: "pack_apt29_growth" })
    }), { store, frontier });
    const statusBody = await status.json() as any;
    expect(status.status).toBe(200);
    expect(statusBody.packStatus).toMatchObject({
      sourcePackId: "pack_apt29_growth",
      totalCandidateCount: 7,
      persistedCandidateCount: 5,
      registryOnlyCandidateCount: 2,
      activeCount: 1,
      suppressedCount: 2,
      rejectedCount: 2,
      duplicateCount: 1,
      capturesObservedCount: 1,
      alertRebuild: { completedCount: 1 },
      familyCoverage: {
        telegram: { total: 6, active: 1, failed: 1, pending: 1, blocked: 4 },
        darkweb_metadata: { total: 1, blocked: 1 }
      },
      safeOutput: { liveNetworkScrapeStarted: false }
    });
    expect(statusBody.packStatus.retryBackoff[0]).toMatchObject({
      candidateId: retryCandidate.id,
      errorCode: "parser_timeout",
      backoffSeconds: 30
    });
    expect(statusBody.candidates.find((candidate: any) => candidate.id === publicCandidate.id)).toMatchObject({
      sourceGrowthFamily: "telegram",
      parserExpectation: "telegram_public_metadata_and_text_fixture",
      sourceHealth: {
        lastCaptureAt: expect.any(String),
        queuedActivationJobs: [expect.any(String)],
        canProduceAlertGradeEvidence: true
      },
      evidenceReadiness: { canProduceAlertGradeEvidence: true, reason: "capture_observed" },
      lifecycle: { collectionStatus: "capture_observed" },
      alertRebuild: { status: "completed", alertCount: 1 }
    });
    expect(statusBody.registry.candidates.find((candidate: any) => candidate.status === "duplicate")).toMatchObject({
      intakeStatus: "duplicate",
      targetRef: { rawStored: false },
      collectionTrigger: { queued: false, unsafeJobQueued: false, reason: "duplicate_skipped" }
    });
    expect(JSON.stringify(statusBody.registry)).not.toContain("not-a-public-channel");

    const listed = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_list", sourcePackLabel: "APT29 source-growth pack" })
    }), { store, frontier });
    const listedBody = await listed.json() as any;
    expect(listed.status).toBe(200);
    expect(listedBody.summary).toMatchObject({
      packCount: 1,
      totalCandidates: 7,
      activeCount: 1,
      duplicateCount: 1,
      queuedForCollectionCount: 1
    });
    expect(listedBody.packs[0]).toMatchObject({ id: "pack_apt29_growth", packStatus: { capturesObservedCount: 1 } });
    expect(frontier.snapshot()).toHaveLength(1);
  });

  test("runs source-pack worker into durable active sources and safe frontier tasks without live scraping", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        sourcePackId: "pack_worker_route_growth",
        sourcePackLabel: "Worker route source growth",
        tenantId: "tenant_worker",
        scope: "APT29",
        requestedBy: "source-growth-worker",
        candidates: [
          { target: "@worker_route_public_cti", type: "telegram_channel", family: "telegram" },
          { target: "metadata://darkweb/apt29/claims", type: "restricted_metadata", family: "darkweb_metadata" },
          { target: "@worker_route_public_cti", type: "telegram_channel", family: "telegram" },
          { target: "metadata://darkweb/password-dump", type: "restricted_metadata", family: "darkweb_onion" }
        ]
      })
    }), { store, frontier });
    const createdBody = await created.json() as any;
    expect(created.status).toBe(201);
    expect(createdBody.summary).toMatchObject({ acceptedCount: 2, rejectedCount: 1, duplicateCount: 1 });
    expect(store.listSources()).toHaveLength(2);
    expect(store.listSources().every((source) => source.status !== "active")).toBe(true);

    const run = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_worker_run",
        sourcePackId: "pack_worker_route_growth",
        chunkSize: 2,
        maxAttempts: 4,
        backoffSeconds: 120,
        decidedBy: "source-growth-worker",
        perFamilyConcurrency: { telegram: 4, darkweb_metadata: 1, darkweb_onion: 1 }
      })
    }), { store, frontier });
    const body = await run.json() as any;
    expect(run.status).toBe(200);
    expect(body.run.status).toBe("partially_active");
    expect(body.activation.summary).toMatchObject({ activeSourceCount: 2, blockedCandidateCount: 2 });
    expect(body.activeSourcePersistence.summary).toMatchObject({ insertedCount: 2, duplicateCount: 0, collectionReadyCount: 2 });
    expect(body.sourceRecordWrite.summary).toMatchObject({ insertedCount: 0, duplicateCount: 2, sourceRecordCount: 2, collectionEligibleCount: 2 });
    expect(body.run.sourceRecordSummary).toMatchObject({ upsertedCount: 2 });
    expect(body.collectionQueue.summary).toMatchObject({ queuedCount: 2, duplicateCount: 0, blockedCount: 0, taskCount: 2 });
    expect(body.sourceGrowthCounters).toMatchObject({
      totalCandidates: 4,
      metadataOnly: 2,
      restrictedBlocked: 1,
      queuedCollectionTasks: 2,
      activeSourceRows: 2
    });
    expect(body.sourceGrowthCounters.parserSourceFamilyCounts.telegram).toMatchObject({ telegram_public_parser_ready: 1 });
    expect(body.sourceGrowthCounters.parserSourceFamilyCounts.darkweb_metadata).toMatchObject({ restricted_metadata_parser_ready: 1 });
    expect(body.sourceGrowthCounters.parserSourceFamilyCounts.darkweb_onion).toMatchObject({ intake_blocked: 1 });
    expect(store.listSources()).toHaveLength(2);
    expect(store.listSources().every((source) => source.status === "active")).toBe(true);
    expect(store.listSources().find((source) => source.type === "tor_metadata")?.governance).toMatchObject({ metadataOnly: true, approvalState: "approved" });
    expect(frontier.snapshot()).toHaveLength(2);
    expect(frontier.snapshot().map((item: any) => item.task)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceType: "telegram_public",
        targetUrl: "https://t.me/worker_route_public_cti",
        maxRetries: 4,
        planning: expect.objectContaining({ sourcePack: expect.objectContaining({ targetRawStored: false }) })
      }),
      expect.objectContaining({
        sourceType: "tor_metadata",
        targetUrl: "metadata://darkweb/apt29/claims",
        maxRetries: 4,
        planning: expect.objectContaining({
          safetyEnvelope: expect.objectContaining({ allowRestrictedMetadata: true, metadataOnlyRestricted: true })
        })
      })
    ]));
    expect(JSON.stringify(body)).not.toContain("password-dump");
    expect(JSON.stringify(body)).not.toContain("rawPayload");

    const repeated = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_worker_run", sourcePackId: "pack_worker_route_growth", chunkSize: 2 })
    }), { store, frontier });
    const repeatedBody = await repeated.json() as any;
    expect(repeated.status).toBe(200);
    expect(repeatedBody.activeSourcePersistence.summary).toMatchObject({ insertedCount: 0, duplicateCount: 2 });
    expect(repeatedBody.collectionQueue.summary).toMatchObject({ queuedCount: 0, duplicateCount: 2, taskCount: 2 });
    expect(store.listSources()).toHaveLength(2);
    expect(frontier.snapshot()).toHaveLength(2);

    const status = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_status", sourcePackId: "pack_worker_route_growth" })
    }), { store, frontier });
    const statusBody = await status.json() as any;
    expect(status.status).toBe(200);
    expect(statusBody.registry).toMatchObject({
      sourceGrowthCounters: { activeSourceRows: 2, queuedCollectionTasks: 2 },
      workerReadiness: { activeSourceRows: 2, collectionReadyRows: 2 },
      lastWorkerRun: { sourcePackId: "pack_worker_route_growth" }
    });
  });

  test("controls source-pack activation retry and duplicate suppression with typed blockers", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const sourcePackRegistry = new InMemoryDwmSourcePackRegistryAdapter();
    const options = { store, frontier, sourcePackRegistry };

    const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        sourcePackId: "pack_action_contract",
        sourcePackLabel: "Action contract source pack",
        tenantId: "tenant_action",
        scope: "APT29",
        requestedBy: "source-action-worker",
        candidates: [
          { target: "@action_contract_active", type: "telegram_channel", family: "telegram" },
          { target: "@action_contract_retry", type: "telegram_channel", family: "telegram", parserExpectation: "retry_fixture" },
          { target: "@action_contract_active", type: "telegram_channel", family: "telegram" },
          { target: "metadata://darkweb/password-dump", type: "restricted_metadata", family: "darkweb_onion" }
        ]
      })
    }), options);
    const createdBody = await created.json() as any;
    expect(created.status).toBe(201);
    expect(createdBody.summary).toMatchObject({ acceptedCount: 2, rejectedCount: 1, duplicateCount: 1 });

    const worker = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_worker_run", sourcePackId: "pack_action_contract", chunkSize: 10 })
    }), options);
    expect(worker.status).toBe(200);

    const statusBefore = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_status", sourcePackId: "pack_action_contract" })
    }), options);
    const statusBeforeBody = await statusBefore.json() as any;
    const activeCandidate = statusBeforeBody.registry.candidates.find((candidate: any) => candidate.declaredFamily === "telegram" && candidate.status === "active");
    const retryCandidate = statusBeforeBody.registry.candidates.find((candidate: any) => candidate.declaredFamily === "telegram" && candidate.decision === "retry_scheduled");
    const duplicateCandidate = statusBeforeBody.registry.candidates.find((candidate: any) => candidate.failure?.code === "duplicate_candidate");
    const rejectedCandidate = statusBeforeBody.registry.candidates.find((candidate: any) => candidate.failure?.code === "restricted_policy_blocked");
    expect(activeCandidate).toBeTruthy();
    expect(retryCandidate).toBeTruthy();
    expect(duplicateCandidate).toBeTruthy();
    expect(rejectedCandidate).toBeTruthy();

    const stalePrepare = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_review",
        packAction: "approve",
        candidateIds: [activeCandidate.id],
        dryRun: true,
        generatedAt: "2030-01-01T00:00:00.000Z",
        approvedBy: "source-action-worker",
        reason: "prepare stale activation"
      })
    }), options);
    const stalePrepareBody = await stalePrepare.json() as any;
    expect(stalePrepare.status).toBe(200);
    expect(stalePrepareBody.results[0]).toMatchObject({
      reviewStatus: "blocked",
      actionContract: {
        schemaVersion: "dwm.source_pack_action_contract.v1",
        mode: "prepare",
        allowed: false,
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "stale_worker", severity: "blocking", retryable: true })
        ]),
        safeOutput: { liveNetworkScrapeStarted: false, rawTargetsExposed: false }
      }
    });

    const retried = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_review",
        packAction: "retry",
        candidateIds: [retryCandidate.id],
        decidedBy: "source-action-worker",
        reason: "retry parser fixture"
      })
    }), options);
    const retriedBody = await retried.json() as any;
    expect(retried.status).toBe(200);
    expect(retriedBody.results[0]).toMatchObject({
      reviewStatus: "retry_scheduled",
      actionContract: {
        allowed: true,
        idempotencyKey: expect.any(String),
        retryEligibility: { retryable: true }
      },
      parser: { status: "parser_retry_scheduled" }
    });

    const suppressedDuplicate = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_review",
        packAction: "suppress",
        candidateIds: [duplicateCandidate.id],
        decidedBy: "source-action-worker",
        reason: "duplicate suppressed idempotently"
      })
    }), options);
    const suppressedDuplicateBody = await suppressedDuplicate.json() as any;
    expect(suppressedDuplicate.status).toBe(200);
    expect(suppressedDuplicateBody.results[0]).toMatchObject({
      reviewStatus: "suppressed",
      candidate: { id: duplicateCandidate.id, status: "suppressed", decision: "suppressed_duplicate", targetRef: { rawStored: false } },
      actionContract: { allowed: true, requestedAction: "suppress" },
      collectionTrigger: { queued: false, unsafeJobQueued: false }
    });

    const duplicateRetry = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_review",
        packAction: "retry",
        candidateIds: [duplicateCandidate.id],
        decidedBy: "source-action-worker",
        reason: "retry suppressed duplicate"
      })
    }), options);
    const duplicateRetryBody = await duplicateRetry.json() as any;
    expect(duplicateRetry.status).toBe(200);
    expect(duplicateRetryBody.results[0]).toMatchObject({
      reviewStatus: "blocked",
      actionContract: {
        allowed: false,
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "duplicate_source", severity: "blocking", retryable: false })
        ])
      }
    });

    const rejectedActivation = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_review",
        packAction: "approve",
        candidateIds: [rejectedCandidate.id],
        approveMetadataOnly: true,
        approvedBy: "source-action-worker",
        reason: "try unsafe rejected activation"
      })
    }), options);
    const rejectedActivationBody = await rejectedActivation.json() as any;
    expect(rejectedActivation.status).toBe(200);
    expect(rejectedActivationBody.results[0]).toMatchObject({
      reviewStatus: "blocked",
      actionContract: {
        allowed: false,
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "rejected_policy", severity: "blocking", retryable: false }),
          expect.objectContaining({ code: "activation_disabled", severity: "blocking", retryable: false })
        ])
      },
      collectionTrigger: { queued: false, unsafeJobQueued: false }
    });

    const inventory = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-inventory?full=true&watchlist=APT29"), options);
    const inventoryBody = await inventory.json() as any;
    expect(inventory.status).toBe(200);
    expect(inventoryBody.sourcePackWorker.sourceHealth).toMatchObject({
      schemaVersion: "dwm.source_health_operations.v1",
      candidateStates: {
        retryable: 1,
        duplicate: 1,
        operationalStates: expect.objectContaining({ canary: 1, failed: expect.any(Number), blocked: expect.any(Number), paused: expect.any(Number) })
      },
      safeOutput: {
        liveNetworkScrapeStarted: false,
        privateTelegramContentExposed: false,
        restrictedPayloadDownloadAllowed: false
      }
    });
    expect(inventoryBody.sourcePackWorker.sourceHealth.typedBlockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "duplicate_source", family: "telegram", retryable: false }),
      expect.objectContaining({ code: "rejected_policy", family: "darkweb_onion", retryable: false })
    ]));
    expect(inventoryBody.sourcePackWorker.sourceOperationsReadiness).toMatchObject({
      schemaVersion: "dwm.source_operations_readiness.v1",
      summary: {
        candidateCount: 4,
        activeSourceCount: 1,
        retryableCount: 1,
        duplicateCount: 1,
        policyRejectedCount: 1,
        suppressedDuplicateCount: 1
      },
      actionability: {
        canGrowSources: true,
        canRetry: true,
        canSuppressDuplicates: false,
        canResolvePolicyRejected: true
      },
      parserHealth: {
        failureCount: expect.any(Number),
        byFamily: { telegram: expect.any(Object), darkweb_onion: expect.any(Object) }
      },
      safeOutput: {
        liveNetworkScrapeStarted: false,
        rawTargetsExposed: false,
        privateTelegramContentExposed: false,
        restrictedPayloadDownloadAllowed: false
      }
    });
    expect(inventoryBody.sourcePackWorker.sourceOperationsReadiness.nextOperatorActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "retry_candidate", candidateId: retryCandidate.id, reason: expect.any(String) }),
      expect.objectContaining({ action: "review_policy_rejection", candidateId: rejectedCandidate.id, reason: expect.any(String) })
    ]));
    expect(inventoryBody.sourcePackWorker.sourceOperationsReadiness.typedBlockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "duplicate_source", retryable: false }),
      expect.objectContaining({ code: "rejected_policy", retryable: false })
    ]));
    expect(inventoryBody.sourcePackWorker.proxyVerification).toMatchObject({
      checks: expect.arrayContaining([
        expect.objectContaining({ id: "source_operations_readiness_present", status: "pass" }),
        expect.objectContaining({ id: "source_operations_next_actions_present", status: "pass" }),
        expect.objectContaining({ id: "source_customer_config_present", status: "pass" }),
        expect.objectContaining({ id: "source_customer_config_redacted", status: "pass" })
      ]),
      worker3JsonAssertions: expect.arrayContaining([
        ".sourceInventory.sourcePackWorker.sourceOperationsReadiness.schemaVersion == \"dwm.source_operations_readiness.v1\"",
        ".sourceInventory.sourcePackWorker.sourceOperationsReadiness.nextOperatorActions | all(has(\"action\") and has(\"reason\"))",
        ".sourceInventory.sourcePackWorker.sourceCustomerConfig.schemaVersion == \"dwm.source_pack_customer_config.v1\"",
        ".sourceInventory.sourcePackWorker.sourceCustomerConfig.sourceConfigs | all(.redactedIdentity.rawStored == false)"
      ])
    });
    expect(inventoryBody.sourcePackWorker.sourceCustomerConfig).toMatchObject({
      schemaVersion: "dwm.source_pack_customer_config.v1",
      summary: {
        candidateCount: 4,
        activeSourceCount: 1,
        retryableCount: 1,
        duplicateCount: 1,
        suppressedDuplicateCount: 1,
        policyRejectedCount: 1,
        restrictedSourceCount: 1,
        mutationReady: false
      },
      safeOutput: {
        liveNetworkScrapeStarted: false,
        rawTargetsExposed: false,
        privateTelegramContentExposed: false,
        restrictedPayloadDownloadAllowed: false
      }
    });
    expect(inventoryBody.sourcePackWorker.sourceCustomerConfig.sourceConfigs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidateId: activeCandidate.id,
        family: "telegram",
        redactedIdentity: expect.objectContaining({ rawStored: false }),
        allowedOperatorActions: expect.arrayContaining([
          expect.objectContaining({ action: "activate", allowed: true })
        ]),
        activationProof: expect.objectContaining({
          schemaVersion: "dwm.source_activation_proof.v1",
          state: "canary",
          policyResult: expect.objectContaining({ allowed: true, category: "public_telegram_only" }),
          credentialBoundary: expect.objectContaining({ noPrivateAccess: true, noAutoJoin: true, noCredentialCollection: true }),
          parserAvailability: expect.objectContaining({ available: true, profile: "public_channel_handoff" }),
          expectedCapture: expect.objectContaining({ type: "telegram_public_message_preview", liveNetworkRequiredForProof: false }),
          alertability: expect.objectContaining({
            canProduceCapture: true,
            canProduceAlert: true,
            alertableFields: expect.arrayContaining(["text", "actorHints"]),
            bridge: expect.objectContaining({ schemaVersion: "dwm.source_alertability_bridge.v1" })
          })
        })
      }),
      expect.objectContaining({
        candidateId: retryCandidate.id,
        retryState: expect.objectContaining({ retryable: true }),
        activationProof: expect.objectContaining({
          state: "failed",
          retryReadiness: expect.objectContaining({
            retryable: true,
            failureCategory: "parser_retry_scheduled",
            remediation: expect.stringContaining("Retry the parser fixture")
          }),
          actorEnrichment: expect.objectContaining({
            canEnrichActor: false,
            blockers: expect.arrayContaining([
              expect.objectContaining({ code: "parser_or_collection_failed", severity: "blocking" })
            ])
          })
        }),
        allowedOperatorActions: expect.arrayContaining([
          expect.objectContaining({ action: "retry", allowed: true })
        ])
      }),
      expect.objectContaining({
        candidateId: duplicateCandidate.id,
        suppressionState: expect.objectContaining({ duplicate: true, suppressed: true }),
        typedBlockers: expect.arrayContaining([
          expect.objectContaining({ code: "duplicate_source", severity: "blocking" })
        ])
      }),
      expect.objectContaining({
        candidateId: rejectedCandidate.id,
        family: "darkweb_onion",
        candidatePolicy: expect.objectContaining({ restrictedSource: true }),
        activationProof: expect.objectContaining({
          state: "blocked",
          policyResult: expect.objectContaining({ allowed: false, category: "policy_rejected" }),
          expectedCapture: expect.objectContaining({ type: "darkweb_onion_metadata_observation", restrictedPayloadStored: false }),
          safeOutput: expect.objectContaining({ restrictedMetadataLeaked: false }),
          actorEnrichment: expect.objectContaining({
            canEnrichActor: false,
            blockers: expect.arrayContaining([
              expect.objectContaining({ code: "policy_blocked_source", severity: "blocking" })
            ])
          })
        }),
        typedBlockers: expect.arrayContaining([
          expect.objectContaining({ code: "rejected_policy", severity: "blocking" }),
          expect.objectContaining({ code: "restricted_source" })
        ]),
        allowedOperatorActions: expect.arrayContaining([
          expect.objectContaining({ action: "review_policy", allowed: true })
        ])
      })
    ]));
    expect(inventoryBody.sourcePackWorker.sourceCustomerConfig.allowedOperatorActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "prepare_customer_config", dryRunSupported: true })
    ]));
    expect(inventoryBody.sourcePackWorker.sourceCustomerConfig.futureMutationRoutes).toMatchObject({
      prepare: { method: "POST", path: "/v1/dwm/source-requests" },
      applyCandidateAction: { status: "use_existing_pack_review_until_customer_config_mutation_exists" },
      futureCrud: { status: "not_implemented" }
    });

    const customerConfig = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_customer_config",
        sourcePackId: "pack_action_contract",
        tenantId: "tenant_action",
        orgId: "org_acme",
        customerId: "customer_acme",
        scope: "APT29",
        configMode: "prepare"
      })
    }), options);
    const customerConfigBody = await customerConfig.json() as any;
    expect(customerConfig.status).toBe(200);
    expect(customerConfigBody).toMatchObject({
      action: "pack_customer_config",
      schemaVersion: "dwm.source_pack_customer_config.v1",
      mode: "prepare",
      tenantId: "tenant_action",
      orgId: "org_acme",
      customerId: "customer_acme",
      summary: {
        candidateCount: 4,
        configurableCount: expect.any(Number),
        mutationReady: false
      },
      safeOutput: {
        liveNetworkScrapeStarted: false,
        rawTargetsExposed: false
      }
    });
    expect(customerConfigBody.readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "duplicate_source" }),
      expect.objectContaining({ code: "rejected_policy" }),
      expect.objectContaining({ code: "restricted_source" }),
      expect.objectContaining({ code: "cleanup_required" })
    ]));
    expect(customerConfigBody.sourceConfigs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidateId: activeCandidate.id,
        crudWorkflow: expect.objectContaining({
          schemaVersion: "dwm.customer_source_crud_workflow.v1",
          mode: "dry_run_prepare",
          operation: "update",
          executeReady: false,
          allowedRoles: expect.arrayContaining(["source_operator", "source_admin", "policy_admin"]),
          audit: expect.objectContaining({ required: true, proposedAuditId: expect.any(String) }),
          idempotency: expect.objectContaining({ proposedKey: expect.any(String) }),
          redactedIdentity: expect.objectContaining({ rawStored: false }),
          safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false, rawTargetsExposed: false })
        })
      })
    ]));
    expect(JSON.stringify(customerConfigBody)).not.toContain("password-dump");

    const disablePreview = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_customer_config",
        configOperation: "disable",
        sourcePackId: "pack_action_contract",
        tenantId: "tenant_action",
        orgId: "org_acme",
        scope: "APT29",
        candidateId: activeCandidate.id,
        operatorRole: "source_operator",
        ownerLane: "source_ops",
        auditReason: "operator dry-run disable readiness"
      })
    }), options);
    const disablePreviewBody = await disablePreview.json() as any;
    const disableRow = disablePreviewBody.sourceConfigs.find((row: any) => row.candidateId === activeCandidate.id);
    expect(disablePreview.status).toBe(200);
    expect(disablePreviewBody).toMatchObject({ requestedOperation: "disable" });
    expect(disableRow.crudWorkflow).toMatchObject({
      operation: "disable",
      proposedStateTransition: { targetState: "disabled", collectionQueued: false, liveNetworkFetch: false },
      audit: { available: true },
      idempotency: { duplicate: false },
      safeOutput: { liveNetworkScrapeStarted: false }
    });
    expect(disableRow.crudWorkflow.blockers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "audit_unavailable" })
    ]));

    const testPreview = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_customer_config",
        configOperation: "test",
        sourcePackId: "pack_action_contract",
        tenantId: "tenant_action",
        orgId: "org_acme",
        scope: "APT29",
        candidateId: activeCandidate.id,
        operatorRole: "source_operator",
        auditReason: "operator dry-run parser test"
      })
    }), options);
    const testPreviewBody = await testPreview.json() as any;
    const testRow = testPreviewBody.sourceConfigs.find((row: any) => row.candidateId === activeCandidate.id);
    expect(testPreview.status).toBe(200);
    expect(testRow.crudWorkflow).toMatchObject({
      operation: "test",
      parserHealth: { workerSafe: true },
      routeContract: { method: "POST", path: "/v1/dwm/source-requests" }
    });

    const retryPreview = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_customer_config",
        configOperation: "retry",
        sourcePackId: "pack_action_contract",
        tenantId: "tenant_action",
        orgId: "org_acme",
        scope: "APT29",
        candidateId: retryCandidate.id,
        operatorRole: "source_operator",
        auditReason: "operator dry-run retry readiness"
      })
    }), options);
    const retryPreviewBody = await retryPreview.json() as any;
    const retryRow = retryPreviewBody.sourceConfigs.find((row: any) => row.candidateId === retryCandidate.id);
    expect(retryPreview.status).toBe(200);
    expect(retryRow.crudWorkflow).toMatchObject({
      operation: "retry",
      proposedStateTransition: { targetState: "retry_scheduled" }
    });
    expect(retryRow.crudWorkflow.blockers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "no_retry_eligibility" })
    ]));

    const suppressPreview = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_customer_config",
        configOperation: "suppress",
        sourcePackId: "pack_action_contract",
        tenantId: "tenant_action",
        orgId: "org_acme",
        scope: "APT29",
        candidateId: duplicateCandidate.id,
        operatorRole: "source_operator",
        auditReason: "operator dry-run duplicate suppression"
      })
    }), options);
    const suppressPreviewBody = await suppressPreview.json() as any;
    const suppressRow = suppressPreviewBody.sourceConfigs.find((row: any) => row.candidateId === duplicateCandidate.id);
    expect(suppressPreview.status).toBe(200);
    expect(suppressRow.crudWorkflow).toMatchObject({
      operation: "suppress",
      proposedStateTransition: { targetState: "suppressed" },
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: "duplicate_source" }),
        expect.objectContaining({ code: "idempotency_duplicate" })
      ])
    });

    const createDuplicatePreview = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_customer_config",
        configOperation: "create",
        sourcePackId: "pack_action_contract",
        tenantId: "tenant_action",
        orgId: "org_acme",
        scope: "APT29",
        candidateId: activeCandidate.id,
        target: "@action_contract_active",
        family: "telegram",
        operatorRole: "source_operator",
        auditReason: "operator dry-run duplicate create"
      })
    }), options);
    const createDuplicateBody = await createDuplicatePreview.json() as any;
    const createDuplicateRow = createDuplicateBody.sourceConfigs.find((row: any) => row.candidateId === activeCandidate.id);
    expect(createDuplicatePreview.status).toBe(200);
    expect(createDuplicateRow.crudWorkflow.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "duplicate_active_source", severity: "blocking" })
    ]));

    const idempotencyDuplicate = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_customer_config",
        configOperation: "disable",
        sourcePackId: "pack_action_contract",
        tenantId: "tenant_action",
        orgId: "org_acme",
        scope: "APT29",
        candidateId: activeCandidate.id,
        operatorRole: "source_operator",
        auditReason: "operator dry-run repeated disable",
        idempotencyKey: disableRow.crudWorkflow.idempotency.proposedKey
      })
    }), options);
    const idempotencyDuplicateBody = await idempotencyDuplicate.json() as any;
    const idempotencyDuplicateRow = idempotencyDuplicateBody.sourceConfigs.find((row: any) => row.candidateId === activeCandidate.id);
    expect(idempotencyDuplicate.status).toBe(200);
    expect(idempotencyDuplicateRow.crudWorkflow).toMatchObject({
      idempotency: { duplicate: true },
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: "idempotency_duplicate" })
      ])
    });

    const invalidTargetPreview = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_customer_config",
        configOperation: "create",
        sourcePackId: "pack_action_contract",
        tenantId: "tenant_action",
        orgId: "org_acme",
        scope: "APT29",
        family: "telegram",
        target: "not-a-telegram-channel",
        operatorRole: "source_operator",
        auditReason: "operator dry-run invalid create"
      })
    }), options);
    const invalidTargetBody = await invalidTargetPreview.json() as any;
    expect(invalidTargetPreview.status).toBe(200);
    expect(invalidTargetBody.readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid_source_ref", severity: "blocking", family: "telegram" })
    ]));

    const missingOrg = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_customer_config", sourcePackId: "pack_action_contract" })
    }), options);
    const missingOrgBody = await missingOrg.json() as any;
    expect(missingOrg.status).toBe(200);
    expect(missingOrgBody.readiness).toMatchObject({
      state: "blocked",
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: "missing_org_scope", severity: "blocking", retryable: true })
      ])
    });

    const staleCustomerConfig = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_customer_config",
        sourcePackId: "pack_action_contract",
        tenantId: "tenant_action",
        scope: "APT29",
        generatedAt: "2030-01-01T00:00:00.000Z"
      })
    }), options);
    const staleCustomerConfigBody = await staleCustomerConfig.json() as any;
    expect(staleCustomerConfig.status).toBe(200);
    expect(staleCustomerConfigBody.readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "stale_worker", severity: "blocking", retryable: true })
    ]));
    expect(JSON.stringify(inventoryBody.sourcePackWorker.sourceOperationsReadiness)).not.toContain("password-dump");
    expect(JSON.stringify(inventoryBody.sourcePackWorker.sourceHealth)).not.toContain("password-dump");
    expect(JSON.stringify(inventoryBody.sourcePackWorker.sourceCustomerConfig)).not.toContain("password-dump");
    expect(frontier.snapshot()).toHaveLength(1);
  });

  test("exposes Telegram-only source-growth pack coverage and health fields without live scraping", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        sourcePackId: "pack_telegram_only_growth",
        sourcePackLabel: "Telegram-only growth pack",
        tenantId: "tenant_acme",
        scope: "APT29",
        requestedBy: "source-growth-worker",
        candidates: [
          { target: "@telegram_growth_one", type: "telegram_channel", family: "telegram", refLabel: "APT29 Telegram public channel 1" },
          { target: "https://t.me/telegram_growth_two", type: "telegram_channel", family: "telegram", parserExpectation: "telegram_public_metadata_and_text_fixture" }
        ]
      })
    }), { store, frontier });
    const body = await response.json() as any;

    expect(response.status).toBe(201);
    expect(body.packRegistry).toMatchObject({
      id: "pack_telegram_only_growth",
      familyCoverage: {
        telegram: { total: 2, active: 0, failed: 0, pending: 2, blocked: 0 },
        darkweb_onion: { total: 0 },
        darkweb_metadata: { total: 0 },
        actor_page: { total: 0 },
        public_advisory: { total: 0 },
        clear_web: { total: 0 }
      }
    });
    expect(body.packRegistry.candidates[0]).toMatchObject({
      sourceGrowthFamily: "telegram",
      refLabel: "APT29 Telegram public channel 1",
      parserExpectation: "telegram_public_metadata_and_text_fixture",
      sourceHealth: {
        parserStatus: { expectation: "telegram_public_metadata_and_text_fixture" },
        queuedActivationJobs: [],
        queuedTestJobs: [],
        canProduceAlertGradeEvidence: false
      },
      evidenceReadiness: { canProduceAlertGradeEvidence: false, reason: "activation_or_capture_required" }
    });
    expect(frontier.snapshot()).toHaveLength(0);

    const listed = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_list", sourcePackLabel: "Telegram-only growth pack" })
    }), { store, frontier });
    const listedBody = await listed.json() as any;
    expect(listed.status).toBe(200);
    expect(listedBody.packs[0].familyCoverage.telegram).toMatchObject({ total: 2, pending: 2 });
    expect(JSON.stringify(listedBody.packs[0].candidates)).not.toContain("privateInvite");
  });

  test("separates Telegram and onion metadata coverage in mixed source-growth packs", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        sourcePackId: "pack_telegram_onion_growth",
        sourcePackLabel: "Telegram onion growth pack",
        tenantId: "tenant_acme",
        scope: "APT29",
        candidates: [
          { target: "@telegram_onion_mix", type: "telegram_channel", family: "telegram" },
          { target: "http://apt29-example.onion/posts", type: "restricted_metadata", family: "darkweb_onion", refLabel: "APT29 onion metadata source" }
        ]
      })
    }), { store, frontier });
    const body = await response.json() as any;

    expect(response.status).toBe(201);
    expect(body.packRegistry.familyCoverage).toMatchObject({
      telegram: { total: 1, pending: 1 },
      darkweb_onion: { total: 1, pending: 1 },
      darkweb_metadata: { total: 0 }
    });
    const onionCandidate = body.packRegistry.candidates.find((candidate: any) => candidate.sourceGrowthFamily === "darkweb_onion");
    expect(onionCandidate).toMatchObject({
      refLabel: "APT29 onion metadata source",
      parserExpectation: "restricted_onion_metadata_fixture",
      policyBoundary: { metadataOnly: true, noDownloads: true },
      sourceHealth: {
        parserStatus: { profile: "restricted_metadata", expectation: "restricted_onion_metadata_fixture" },
        canProduceAlertGradeEvidence: false
      }
    });
    expect(frontier.snapshot()).toHaveLength(0);
    expect(body.packRegistry.safeOutput).toMatchObject({
      rawUnsafeRowsStored: false,
      restrictedPayloadDownloadAllowed: false
    });
  });

  test("prepares activation proof for Telegram darkweb metadata and public TI source candidates without network fetches", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const options = { store, frontier };

    const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        sourcePackId: "pack_activation_proof_mixed",
        sourcePackLabel: "Activation proof mixed source pack",
        tenantId: "tenant_acme",
        scope: "APT29,example.com",
        requestedBy: "source-proof-worker",
        candidates: [
          { target: "@activation_proof_public", type: "telegram_channel", family: "telegram" },
          { target: "metadata://darkweb/onion/apt29-index", type: "restricted_metadata", family: "darkweb_onion" },
          { target: "metadata://darkweb/apt29/claims", type: "restricted_metadata", family: "darkweb_metadata" },
          { target: "https://example.com/security/advisory/apt29", type: "public_url", family: "public_advisory" },
          { target: "https://example.com/threat-actors/apt29", type: "public_url", family: "actor_page" },
          { target: "https://example.com/blog/apt29-analysis", type: "public_url", family: "clear_web" }
        ]
      })
    }), options);
    const createdBody = await created.json() as any;
    expect(created.status).toBe(201);
    expect(createdBody.summary).toMatchObject({ acceptedCount: 6, rejectedCount: 0 });

    const worker = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_worker_run", sourcePackId: "pack_activation_proof_mixed", chunkSize: 10 })
    }), options);
    const workerBody = await worker.json() as any;
    expect(worker.status).toBe(200);
    expect(workerBody.activation.summary.activeSourceCount).toBe(6);
    expect(workerBody.collectionQueue.summary.taskCount).toBe(6);
    const telegramSource = store.listSources().find((source: any) => source.metadata?.sourceGrowthFamily === "telegram");
    expect(telegramSource?.id).toBeTruthy();
    const observed = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "record_capture",
        sourceId: telegramSource?.id,
        captureText: "APT29 public Telegram preview mentions example.com infrastructure."
      })
    }), options);
    const observedBody = await observed.json() as any;
    expect(observed.status).toBe(200);
    expect(observedBody.alertRebuild).toMatchObject({ requested: true, status: "skipped", reason: "missing_active_watchlist" });

    const config = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_customer_config",
        sourcePackId: "pack_activation_proof_mixed",
        tenantId: "tenant_acme",
        orgId: "org_acme",
        scope: "APT29,example.com",
        configOperation: "enable",
        operatorRole: "source_operator",
        ownerLane: "source_ops",
        auditReason: "activation proof dry-run"
      })
    }), options);
    const configBody = await config.json() as any;
    expect(config.status).toBe(200);
    expect(configBody.sourceConfigs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: "telegram",
        activationProof: expect.objectContaining({
          state: "canary",
          credentialBoundary: expect.objectContaining({ noAutoJoin: true, noCredentialCollection: true }),
          expectedCapture: expect.objectContaining({ type: "telegram_public_message_preview" }),
          alertability: expect.objectContaining({ canProduceAlert: true, alertableFields: expect.arrayContaining(["text"]) }),
          actorEnrichment: expect.objectContaining({
            schemaVersion: "dwm.actor_source_enrichment_readiness.v1",
            canEnrichActor: true,
            actorSignals: expect.arrayContaining(["actorHints"]),
            watchlistMatchFields: expect.arrayContaining(["text"])
          })
        })
      }),
      expect.objectContaining({
        family: "darkweb_onion",
        activationProof: expect.objectContaining({
          state: "active",
          policyResult: expect.objectContaining({ allowed: true, category: "restricted_metadata_only", metadataOnly: true }),
          expectedCapture: expect.objectContaining({ type: "darkweb_onion_metadata_observation", restrictedPayloadStored: false }),
          alertability: expect.objectContaining({ alertableFields: expect.arrayContaining(["victimHints", "claimType"]) }),
          actorEnrichment: expect.objectContaining({
            canEnrichActor: true,
            actorSignals: expect.arrayContaining(["actorHandle", "victimName"]),
            watchlistMatchFields: expect.arrayContaining(["victimName"])
          })
        })
      }),
      expect.objectContaining({
        family: "darkweb_metadata",
        activationProof: expect.objectContaining({
          state: "active",
          policyResult: expect.objectContaining({ allowed: true, category: "restricted_metadata_only", metadataOnly: true }),
          expectedCapture: expect.objectContaining({ type: "darkweb_metadata_observation", restrictedPayloadStored: false }),
          alertability: expect.objectContaining({ alertableFields: expect.arrayContaining(["victimHints", "claimType"]) }),
          actorEnrichment: expect.objectContaining({
            canEnrichActor: true,
            actorSignals: expect.arrayContaining(["actorHandle", "victimName"]),
            watchlistMatchFields: expect.arrayContaining(["victimName"])
          })
        })
      }),
      expect.objectContaining({
        family: "public_advisory",
        activationProof: expect.objectContaining({
          state: "canary",
          policyResult: expect.objectContaining({ allowed: true, category: "public_ti_metadata", publicOnly: true, metadataOnly: true }),
          credentialBoundary: expect.objectContaining({ noDownloads: true, noCredentialCollection: true }),
          parserAvailability: expect.objectContaining({ profile: "public_advisory", available: true }),
          expectedCapture: expect.objectContaining({ type: "public_advisory_metadata", liveNetworkRequiredForProof: false }),
          alertability: expect.objectContaining({ watchlistTerms: ["APT29", "example.com"], alertableFields: expect.arrayContaining(["cve", "ttps"]) }),
          actorEnrichment: expect.objectContaining({
            canEnrichActor: true,
            actorSignals: expect.arrayContaining(["vendorAttribution"]),
            watchlistMatchFields: expect.arrayContaining(["cve"])
          })
        })
      }),
      expect.objectContaining({
        family: "actor_page",
        activationProof: expect.objectContaining({
          state: "canary",
          policyResult: expect.objectContaining({ allowed: true, category: "public_ti_metadata" }),
          parserAvailability: expect.objectContaining({ profile: "actor_page_metadata", available: true }),
          expectedCapture: expect.objectContaining({ type: "actor_page_metadata", liveNetworkRequiredForProof: false }),
          actorEnrichment: expect.objectContaining({
            canEnrichActor: true,
            actorSignals: expect.arrayContaining(["actorName", "aliases", "ttps"]),
            watchlistMatchFields: expect.arrayContaining(["actorName", "aliases"])
          })
        })
      }),
      expect.objectContaining({
        family: "clear_web",
        activationProof: expect.objectContaining({
          state: "canary",
          policyResult: expect.objectContaining({ allowed: true, category: "public_ti_metadata", metadataOnly: true }),
          parserAvailability: expect.objectContaining({ profile: "clear_web", available: true }),
          expectedCapture: expect.objectContaining({ type: "clear_web_metadata", liveNetworkRequiredForProof: false }),
          alertability: expect.objectContaining({ alertableFields: expect.arrayContaining(["extractedTerms"]) }),
          actorEnrichment: expect.objectContaining({
            canEnrichActor: true,
            actorSignals: expect.arrayContaining(["extractedEntities"]),
            watchlistMatchFields: expect.arrayContaining(["extractedTerms"])
          })
        })
      })
    ]));
    expect(configBody.sourceReadinessArtifact).toMatchObject({
      schemaVersion: "dwm.source_readiness_artifact.v1",
      sharedWatchlistAlertability: {
        activeSourceFamilies: expect.arrayContaining(["telegram", "darkweb_onion", "darkweb_metadata", "public_advisory", "actor_page", "clear_web"]),
        enrichableSourceFamilies: expect.arrayContaining(["telegram", "darkweb_onion", "darkweb_metadata", "public_advisory", "actor_page", "clear_web"]),
        matchableFields: expect.arrayContaining(["text", "victimName", "actorName", "cve", "extractedTerms"]),
        watchlistTerms: ["APT29", "example.com"],
        sourcePolicyLimits: expect.arrayContaining([
          expect.objectContaining({ code: "public_telegram_only", family: "telegram" }),
          expect.objectContaining({ code: "metadata_only_restricted_source", family: "darkweb_onion" }),
          expect.objectContaining({ code: "metadata_only_restricted_source", family: "darkweb_metadata" })
        ])
      },
      safeOutput: {
        liveNetworkScrapeStarted: false,
        privateTelegramContentExposed: false,
        restrictedMetadataLeaked: false
      }
    });
    expect(configBody.sourceReadinessArtifact.actorCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({
        watchlistTerm: "APT29",
        activeSourceFamilies: expect.arrayContaining(["telegram", "darkweb_metadata", "actor_page"]),
        actorSignals: expect.arrayContaining(["actorHints", "actorHandle", "actorName", "extractedEntities"]),
        alertableFields: expect.arrayContaining(["text", "victimHints", "cve", "extractedTerms"])
      }),
      expect.objectContaining({
        watchlistTerm: "example.com",
        watchlistMatchFields: expect.arrayContaining(["urls", "victimName", "actorName", "extractedTerms"])
      })
    ]));
    expect(configBody.sourceReadinessArtifact.sourceFamilyReadiness).toEqual(expect.arrayContaining([
      expect.objectContaining({ family: "telegram", canProduceAlert: true, canEnrichActor: true }),
      expect.objectContaining({ family: "darkweb_onion", canProduceAlert: true, canEnrichActor: true }),
      expect.objectContaining({ family: "darkweb_metadata", canProduceAlert: true, canEnrichActor: true }),
      expect.objectContaining({ family: "public_advisory", canProduceAlert: true, canEnrichActor: true }),
      expect.objectContaining({ family: "actor_page", canProduceAlert: true, canEnrichActor: true }),
      expect.objectContaining({ family: "clear_web", canProduceAlert: true, canEnrichActor: true })
    ]));
    const telegramReadiness = configBody.sourceReadinessArtifact.sourceFamilyReadiness.find((row: any) => row.family === "telegram");
    expect(telegramReadiness).toMatchObject({
      operationalStates: expect.objectContaining({ canary: 1 }),
      parserStatuses: expect.arrayContaining(["telegram_public_parser_ready"]),
      lastCaptureAt: expect.any(String),
      lastEnrichmentAt: expect.any(String),
      retryBackoff: expect.objectContaining({ retryable: false }),
      privacyBoundary: expect.objectContaining({
        noPrivateTelegram: true,
        noAutoJoin: true,
        noCredentials: true,
        liveNetworkRequiredForProof: false
      }),
      sourceTrust: expect.objectContaining({ tier: "medium", score: expect.any(Number) })
    });
    const darkwebReadiness = configBody.sourceReadinessArtifact.sourceFamilyReadiness.find((row: any) => row.family === "darkweb_onion");
    expect(darkwebReadiness).toMatchObject({
      privacyBoundary: expect.objectContaining({ metadataOnly: true, restrictedSource: true, restrictedPayloadStored: false }),
      sourceTrust: expect.objectContaining({ tier: "medium" })
    });
    expect(configBody.sourceReadinessArtifact.actorCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({
        watchlistTerm: "APT29",
        actorSections: expect.objectContaining({
          overview: expect.objectContaining({ covered: true, sourceFamilies: expect.arrayContaining(["telegram", "actor_page", "public_advisory"]) }),
          infrastructure: expect.objectContaining({ covered: true, sourceFamilies: expect.arrayContaining(["darkweb_onion", "public_advisory", "actor_page"]) }),
          targeting: expect.objectContaining({ covered: true, sourceFamilies: expect.arrayContaining(["darkweb_metadata", "public_advisory"]) }),
          evidence: expect.objectContaining({ covered: true, sourceFamilies: expect.arrayContaining(["telegram", "darkweb_metadata", "clear_web"]) }),
          freshness: expect.objectContaining({ covered: true, sourceFamilies: expect.arrayContaining(["telegram", "clear_web"]) })
        }),
        lastSuccessfulCaptureAt: expect.any(String),
        lastSuccessfulEnrichmentAt: expect.any(String)
      })
    ]));
    expect(configBody.sourceReadinessArtifact.sharedWatchlistAlertability).toMatchObject({
      sourceTrust: expect.objectContaining({
        averageScore: expect.any(Number),
        byFamily: expect.objectContaining({
          telegram: expect.objectContaining({ tier: "medium" }),
          public_advisory: expect.objectContaining({ tier: "high" }),
          actor_page: expect.objectContaining({ tier: "high" })
        })
      }),
      blockerReasons: expect.any(Array)
    });
    expect(configBody.sourceReadinessArtifact.readinessLedgerRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: "telegram",
        state: "canary",
        canEnrichActor: true,
        canProduceAlert: true,
        lastCaptureAt: expect.any(String),
        matchableFields: expect.arrayContaining(["text"]),
        privacyBoundary: expect.objectContaining({ noPrivateTelegram: true }),
        safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
      }),
      expect.objectContaining({
        family: "darkweb_onion",
        state: "active",
        privacyBoundary: expect.objectContaining({ metadataOnly: true, restrictedSource: true })
      })
    ]));
    const actorReadiness = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "actor_enrichment_readiness",
        sourcePackId: "pack_activation_proof_mixed",
        query: "APT29",
        tenantId: "tenant_acme",
        orgId: "org_acme",
        scope: "APT29,example.com"
      })
    }), options);
    const actorReadinessBody = await actorReadiness.json() as any;
    expect(actorReadiness.status).toBe(200);
    expect(actorReadinessBody).toMatchObject({
      schemaVersion: "dwm.actor_page_source_readiness.v1",
      query: "APT29",
      actorReadiness: {
        proofId: expect.any(String),
        actorMetadata: {
          actorId: expect.any(String),
          displayName: "APT29",
          backedBySourceFamilies: expect.arrayContaining(["telegram", "darkweb_onion", "public_advisory", "actor_page", "clear_web"]),
          noSyntheticActorClaims: true
        },
        state: "ready",
        sourceCoverage: expect.arrayContaining([
          expect.objectContaining({ family: "telegram", state: "canary", canEnrichActor: true, canProduceAlert: true, sourceIds: expect.arrayContaining([expect.any(String)]), candidateIds: expect.arrayContaining([expect.any(String)]) }),
          expect.objectContaining({ family: "darkweb_onion", state: "active", privacyBoundary: expect.objectContaining({ metadataOnly: true }) }),
          expect.objectContaining({ family: "actor_page", state: "canary", matchableFields: expect.arrayContaining(["actorName"]) })
        ]),
        sourceReadinessLedgerRows: expect.arrayContaining([
          expect.objectContaining({
            schemaVersion: "dwm.actor_source_readiness_ledger_row.v1",
            proofId: expect.any(String),
            family: "telegram",
            state: "canary",
            parserStatuses: expect.arrayContaining(["telegram_public_parser_ready"]),
            freshnessState: "fresh",
            actionability: expect.objectContaining({
              liveNetworkFetchRequired: false,
              nextActions: []
            }),
            downstreamConsumers: expect.objectContaining({
              publicTiActorPage: true,
              dashboardSourceReadiness: true,
              sharedWatchlistAlerts: true,
              caseHandoff: true
            }),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          })
        ]),
        evidenceReadiness: {
          schemaVersion: "dwm.actor_evidence_readiness.v1",
          proofId: expect.any(String),
          evidenceReady: true,
          summary: expect.objectContaining({
            readyFamilies: expect.arrayContaining(["telegram", "darkweb_onion", "actor_page"]),
            averageConfidence: expect.any(Number),
            lastEvidenceAt: expect.any(String)
          }),
          rows: expect.arrayContaining([
            expect.objectContaining({
              family: "telegram",
              confidence: expect.any(Number),
              confidenceTier: expect.stringMatching(/medium|high|low/),
              timestamps: expect.objectContaining({
                lastCaptureAt: expect.any(String),
                lastEnrichmentAt: expect.any(String),
                checkedAt: expect.any(String)
              }),
              evidenceFields: expect.arrayContaining(["text"]),
              provenance: expect.objectContaining({
                family: "telegram",
                safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
              }),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            })
          ])
        },
        parserHealthReadiness: {
          schemaVersion: "dwm.actor_parser_health_readiness.v1",
          proofId: expect.any(String),
          parserReady: true,
          summary: expect.objectContaining({
            readyFamilies: expect.arrayContaining(["telegram", "actor_page", "public_advisory"])
          }),
          rows: expect.arrayContaining([
            expect.objectContaining({
              family: "telegram",
              parserState: "ready",
              parserStatuses: expect.arrayContaining(["telegram_public_parser_ready"]),
              checkedAt: expect.any(String),
              actionability: expect.objectContaining({ liveNetworkFetchRequired: false }),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            })
          ])
        },
        freshness: {
          lastSuccessfulCaptureAt: expect.any(String),
          lastSuccessfulEnrichmentAt: expect.any(String),
          stale: false
        },
        alertability: {
          activeSourceFamilies: expect.arrayContaining(["telegram", "darkweb_onion", "public_advisory", "actor_page", "clear_web"]),
          matchableFields: expect.arrayContaining(["text", "victimName", "actorName", "cve", "extractedTerms"])
        },
        captureReadiness: {
          schemaVersion: "dwm.actor_capture_readiness.v1",
          proofId: expect.any(String),
          captureReady: true,
          latestCaptureAt: expect.any(String),
          captureRows: expect.arrayContaining([
            expect.objectContaining({
              family: "telegram",
              state: "capture_observed",
              expectedCapture: expect.objectContaining({
                type: "telegram_public_message_preview",
                liveNetworkRequiredForProof: false
              }),
              recordCapturePlan: expect.objectContaining({
                method: "POST",
                path: "/v1/dwm/source-requests",
                body: expect.objectContaining({ action: "record_capture" }),
                liveNetworkFetch: false
              }),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            })
          ])
        },
        alertGenerationReadiness: {
          schemaVersion: "dwm.actor_alert_generation_readiness.v1",
          proofId: expect.any(String),
          alertReady: true,
          canRebuildAlerts: true,
          sourceFamilies: expect.objectContaining({
            alertCapable: expect.arrayContaining(["telegram", "darkweb_onion", "public_advisory", "actor_page", "clear_web"])
          }),
          matchableFields: expect.arrayContaining(["text", "victimName", "actorName", "cve", "extractedTerms"]),
          rebuildPlan: expect.objectContaining({
            method: "POST",
            path: "/v1/dwm/alerts/rebuild",
            dryRunSupported: true,
            liveNetworkFetch: false
          }),
          watchlistMatchReadiness: {
            schemaVersion: "dwm.actor_watchlist_match_readiness.v1",
            watchlistTerms: ["APT29", "example.com"],
            summary: expect.objectContaining({
              ready: true,
              readyTerms: expect.arrayContaining(["APT29", "example.com"]),
              sourceFamilies: expect.arrayContaining(["telegram", "darkweb_onion", "actor_page"]),
              matchableFields: expect.arrayContaining(["text", "victimName", "actorName", "cve"])
            }),
            rows: expect.arrayContaining([
              expect.objectContaining({
                watchlistTerm: "APT29",
                family: "telegram",
                state: "ready",
                matchableFields: expect.arrayContaining(["text"]),
                confidence: expect.any(Number),
                sourceTrust: expect.objectContaining({ tier: expect.any(String) }),
                safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
              }),
              expect.objectContaining({
                watchlistTerm: "example.com",
                family: "darkweb_onion",
                state: "ready",
                privacyBoundary: expect.objectContaining({ metadataOnly: true, restrictedSource: true }),
                safeOutput: expect.objectContaining({ restrictedMetadataLeaked: false })
              })
            ]),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          },
          blockers: []
        },
        sourceOperationsQueue: {
          schemaVersion: "dwm.actor_source_operations_queue.v1",
          proofId: expect.any(String),
          summary: expect.objectContaining({
            total: expect.any(Number),
            high: expect.any(Number),
            alertRebuildReady: true,
            actionTypes: expect.arrayContaining(["record_capture", "rebuild_alerts"])
          }),
          queueItems: expect.arrayContaining([
            expect.objectContaining({
              type: "record_capture",
              priority: "high",
              route: expect.objectContaining({
                method: "POST",
                path: "/v1/dwm/source-requests",
                liveNetworkFetch: false
              }),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            }),
            expect.objectContaining({
              type: "rebuild_alerts",
              priority: "high",
              family: "all_active",
              route: expect.objectContaining({
                method: "POST",
                path: "/v1/dwm/alerts/rebuild",
                liveNetworkFetch: false
              }),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            })
          ]),
          safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
        },
        sourceFamilyHealth: {
          schemaVersion: "dwm.actor_source_family_health.v1",
          proofId: expect.any(String),
          summary: expect.objectContaining({
            activeFamilies: expect.arrayContaining(["telegram", "darkweb_onion", "actor_page"]),
            alertReadyFamilies: expect.arrayContaining(["telegram", "darkweb_onion", "actor_page"]),
            averageConfidence: expect.any(Number),
            lastCaptureAt: expect.any(String),
            lastEnrichmentAt: expect.any(String)
          }),
          rows: expect.arrayContaining([
            expect.objectContaining({
              family: "telegram",
              state: "canary",
              parserState: "ready",
              timestamps: expect.objectContaining({
                lastCaptureAt: expect.any(String),
                lastEnrichmentAt: expect.any(String),
                checkedAt: expect.any(String)
              }),
              confidence: expect.any(Number),
              confidenceTier: expect.stringMatching(/medium|high|low/),
              alertability: expect.objectContaining({
                canEnrichActor: true,
                canProduceAlert: true,
                alertReady: true,
                matchableFields: expect.arrayContaining(["text"])
              }),
              nextActions: expect.arrayContaining([
                expect.objectContaining({ type: "rebuild_alerts", liveNetworkFetch: false })
              ]),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            }),
            expect.objectContaining({
              family: "darkweb_onion",
              privacyBoundary: expect.objectContaining({ metadataOnly: true, restrictedSource: true }),
              safeOutput: expect.objectContaining({ restrictedMetadataLeaked: false })
            })
          ]),
          safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
        },
        sourceConsumerBridge: {
          schemaVersion: "dwm.actor_source_consumer_bridge.v1",
          proofId: expect.any(String),
          summary: expect.objectContaining({
            publicTiReady: true,
            alertReady: true,
            caseReady: true,
            watchlistMatchReady: true,
            watchlistTerms: ["APT29", "example.com"],
            alertableFamilies: expect.arrayContaining(["telegram", "darkweb_onion", "actor_page"]),
            lastProofAt: expect.any(String)
          }),
          consumers: expect.arrayContaining([
            expect.objectContaining({
              consumer: "publicTiActorPage",
              ready: true,
              sourceFamilies: expect.arrayContaining(["telegram", "actor_page"]),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            }),
            expect.objectContaining({
              consumer: "sharedWatchlistAlerts",
              ready: true,
              sourceFamilies: expect.arrayContaining(["telegram", "darkweb_onion"]),
              matchableFields: expect.arrayContaining(["text"]),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            }),
            expect.objectContaining({
              consumer: "caseHandoff",
              ready: true,
              sourceFamilies: expect.arrayContaining(["telegram"])
            })
          ]),
          rows: expect.arrayContaining([
            expect.objectContaining({
              family: "telegram",
              provenance: expect.objectContaining({
                sourceIds: expect.arrayContaining([expect.any(String)]),
                privacyBoundary: expect.objectContaining({ noPrivateTelegram: true })
              }),
              fields: expect.objectContaining({
                matchable: expect.arrayContaining(["text"]),
                alertable: expect.arrayContaining(["actorHints"])
              }),
              consumers: expect.objectContaining({
                publicTiActorPage: true,
                sharedWatchlistAlerts: true,
                caseHandoff: true
              }),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            })
          ])
        },
        sourceSectionReadiness: {
          schemaVersion: "dwm.actor_source_section_readiness.v1",
          summary: expect.objectContaining({
            coveredSections: expect.arrayContaining(["overview", "infrastructure", "targeting", "evidence", "freshness"]),
            missingSections: [],
            sourceFamilies: expect.arrayContaining(["telegram", "darkweb_onion", "actor_page"]),
            averageConfidence: expect.any(Number)
          }),
          sections: expect.arrayContaining([
            expect.objectContaining({
              section: "overview",
              state: "covered",
              sourceFamilies: expect.arrayContaining(["telegram", "actor_page"]),
              provenance: expect.arrayContaining([
                expect.objectContaining({
                  family: "telegram",
                  sourceIds: expect.arrayContaining([expect.any(String)]),
                  privacyBoundary: expect.objectContaining({ noPrivateTelegram: true })
                })
              ]),
              timestamps: expect.objectContaining({
                lastCaptureAt: expect.any(String),
                lastEnrichmentAt: expect.any(String)
              }),
              confidence: expect.any(Number),
              matchableFields: expect.arrayContaining(["text"]),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            }),
            expect.objectContaining({
              section: "targeting",
              state: "covered",
              sourceFamilies: expect.arrayContaining(["darkweb_metadata", "public_advisory"]),
              safeOutput: expect.objectContaining({ restrictedMetadataLeaked: false })
            })
          ])
        },
        alertCaseHandoffReadiness: {
          schemaVersion: "dwm.actor_alert_case_handoff_readiness.v1",
          alertReady: true,
          caseReady: true,
          canOpenCase: true,
          blockers: []
        },
        sourcePackActionReadiness: {
          schemaVersion: "dwm.actor_source_pack_action_readiness.v1",
          retryActions: [],
          activationActions: [],
          intakeActions: []
        },
        safeOutput: {
          liveNetworkScrapeStarted: false,
          privateTelegramContentExposed: false,
          restrictedMetadataLeaked: false
        }
      },
      candidateIntakeContract: {
        schemaVersion: "dwm.actor_source_candidate_intake.v1",
        mode: "prepare_no_network",
        policyValidation: {
          publicTelegramOnly: true,
          darkwebMetadataOnly: true,
          liveNetworkFetch: false,
          rawRestrictedPayloadStorage: false
        }
      },
      proofArtifacts: {
        schemaVersion: "dwm.actor_source_readiness_proof_artifacts.v1",
        proofId: expect.any(String),
        publicTiQueryAdapter: {
          schemaVersion: "ti.public_actor.query_adapter.v1",
          route: expect.objectContaining({ path: "/ti/apt29", liveNetworkFetch: false }),
          actor: expect.objectContaining({ displayName: "APT29", noSyntheticActorClaims: true }),
          readiness: expect.objectContaining({
            state: "ready",
            publicTiReady: true,
            alertReady: true,
            watchlistMatchReady: true,
            freshnessState: "fresh",
            lastSuccessfulCaptureAt: expect.any(String),
            lastSuccessfulEnrichmentAt: expect.any(String)
          }),
          sections: expect.arrayContaining([
            expect.objectContaining({
              section: "overview",
              state: "covered",
              sourceFamilies: expect.arrayContaining(["telegram", "actor_page"]),
              provenance: expect.arrayContaining([
                expect.objectContaining({
                  family: "telegram",
                  sourceIds: expect.arrayContaining([expect.any(String)]),
                  evidenceProofId: expect.any(String)
                })
              ]),
              confidence: expect.any(Number),
              matchableFields: expect.arrayContaining(["text"]),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            }),
            expect.objectContaining({
              section: "infrastructure",
              state: "covered",
              sourceFamilies: expect.arrayContaining(["darkweb_onion"]),
              safeOutput: expect.objectContaining({ restrictedMetadataLeaked: false })
            })
          ]),
          evidence: expect.arrayContaining([
            expect.objectContaining({
              family: "telegram",
              proofId: expect.any(String),
              confidence: expect.any(Number),
              timestamps: expect.objectContaining({ lastCaptureAt: expect.any(String) }),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            })
          ]),
          sourceHealth: expect.arrayContaining([
            expect.objectContaining({
              family: "telegram",
              parserState: "ready",
              sourceIds: expect.arrayContaining([expect.any(String)]),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            })
          ]),
          parserStatusLedger: {
            schemaVersion: "ti.public_actor.parser_status_ledger.v1",
            summary: expect.objectContaining({
              readyFamilies: expect.arrayContaining(["telegram", "darkweb_onion", "actor_page"]),
              retryFamilies: [],
              missingFamilies: [],
              latestCaptureAt: expect.any(String),
              latestEnrichmentAt: expect.any(String)
            }),
            rows: expect.arrayContaining([
              expect.objectContaining({
                family: "telegram",
                parserState: "ready",
                captureState: "capture_observed",
                confidence: expect.any(Number),
                timestamps: expect.objectContaining({
                  lastCaptureAt: expect.any(String),
                  lastEnrichmentAt: expect.any(String)
                }),
                sourceIds: expect.arrayContaining([expect.any(String)]),
                safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
              })
            ]),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          },
          sourcePackIntakeHandoff: {
            schemaVersion: "ti.public_actor.source_pack_intake_handoff.v1",
            ready: false,
            validationSummary: expect.objectContaining({
              totalCandidates: 0,
              accepted: 0,
              blocked: 0
            }),
            candidates: [],
            gaps: [],
            policyValidation: expect.objectContaining({
              liveNetworkFetch: false,
              rawRestrictedPayloadStorage: false
            }),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          },
          alertability: expect.objectContaining({
            matchableFields: expect.arrayContaining(["text", "victimName"]),
            watchlistMatchReadiness: expect.objectContaining({
              schemaVersion: "dwm.actor_watchlist_match_readiness.v1",
              summary: expect.objectContaining({ ready: true })
            })
          }),
          alertEvidenceHandoff: {
            schemaVersion: "ti.public_actor.alert_evidence_handoff.v1",
            ready: true,
            watchlistTerms: ["APT29", "example.com"],
            alertRebuildPlan: expect.objectContaining({
              path: "/v1/dwm/alerts/rebuild",
              liveNetworkFetch: false
            }),
            rows: expect.arrayContaining([
              expect.objectContaining({
                watchlistTerm: "APT29",
                family: "telegram",
                state: "ready",
                sourceIds: expect.arrayContaining([expect.any(String)]),
                evidenceProofId: expect.any(String),
                parserState: "ready",
                captureState: "capture_observed",
                confidence: expect.any(Number),
                matchableFields: expect.arrayContaining(["text"]),
                timestamps: expect.objectContaining({ lastCaptureAt: expect.any(String) }),
                safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
              }),
              expect.objectContaining({
                watchlistTerm: "example.com",
                family: "darkweb_onion",
                state: "ready",
                privacyBoundary: expect.objectContaining({ metadataOnly: true, restrictedSource: true }),
                safeOutput: expect.objectContaining({ restrictedMetadataLeaked: false })
              })
            ]),
            sourceSections: expect.arrayContaining([
              expect.objectContaining({
                section: "overview",
                state: "covered",
                sourceFamilies: expect.arrayContaining(["telegram"])
              })
            ]),
            summary: expect.objectContaining({
              readyRows: expect.any(Number),
              blockedRows: 0,
              sourceFamilies: expect.arrayContaining(["telegram", "darkweb_onion"]),
              matchableFields: expect.arrayContaining(["text", "victimName"]),
              latestCaptureAt: expect.any(String)
            }),
            blockers: [],
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          },
          alertGenerationConsumerHandoff: {
            schemaVersion: "ti.public_actor.alert_generation_consumer_handoff.v1",
            ready: true,
            route: expect.objectContaining({
              path: "/v1/dwm/alerts/rebuild",
              liveNetworkFetch: false,
              body: expect.objectContaining({
                actor: "APT29",
                sourceFamilies: expect.arrayContaining(["telegram", "darkweb_onion"]),
                watchlistTerms: expect.arrayContaining(["APT29", "example.com"]),
                evidenceProofIds: expect.arrayContaining([expect.any(String)]),
                dryRun: true
              })
            }),
            rows: expect.arrayContaining([
              expect.objectContaining({
                watchlistTerm: "APT29",
                family: "telegram",
                state: "ready_for_rebuild",
                evidenceProofId: expect.any(String),
                parserStatus: expect.objectContaining({
                  state: "ready",
                  captureState: "capture_observed"
                }),
                confidence: expect.any(Number),
                timestamps: expect.objectContaining({ lastCaptureAt: expect.any(String) }),
                provenance: expect.objectContaining({
                  sourceFamily: "telegram",
                  sourceHealthProofId: expect.any(String),
                  alertEvidenceProofId: expect.any(String)
                }),
                safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
              })
            ]),
            summary: expect.objectContaining({
              readyRows: expect.any(Number),
              blockedRows: 0,
              sourceFamilies: expect.arrayContaining(["telegram", "darkweb_onion"]),
              parserStates: expect.arrayContaining(["ready"]),
              matchableFields: expect.arrayContaining(["text", "victimName"])
            }),
            blockers: [],
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          },
          consumerProofLedger: expect.objectContaining({
            schemaVersion: "ti.public_actor.consumer_proof_ledger.v1",
            rows: expect.any(Array),
            summary: expect.objectContaining({
              latestCaptureAt: expect.any(String)
            }),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          }),
          sourceOperationsHandoff: expect.objectContaining({
            schemaVersion: "ti.public_actor.source_operations_handoff.v1",
            operations: expect.arrayContaining([
              expect.objectContaining({
                type: "rebuild_alerts",
                priority: "high",
                family: "all_active",
                route: expect.objectContaining({
                  path: "/v1/dwm/alerts/rebuild",
                  liveNetworkFetch: false
                }),
                safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
              })
            ]),
            summary: expect.objectContaining({
              alertRebuildReady: true,
              actionTypes: expect.arrayContaining(["rebuild_alerts"])
            }),
            policyBoundary: expect.objectContaining({
              liveNetworkFetch: false,
              metadataOnlyRestrictedSources: true
            })
          }),
          downstreamFixtureExport: expect.objectContaining({
            schemaVersion: "ti.public_actor.downstream_fixture_export.v1",
            mode: "no_network_fixture",
            publicTiContract: expect.objectContaining({
              path: "/ti/apt29",
              requiredFields: expect.arrayContaining(["sourceFamily", "parserStatus", "confidence", "timestamps", "provenance", "gap", "safeOutput"])
            }),
            alertGenerationContract: expect.objectContaining({
              path: "/v1/dwm/alerts/rebuild",
              requiredFields: expect.arrayContaining(["sourceFamily", "consumers.alertGeneration", "provenance.evidenceProofId"])
            }),
            rows: expect.arrayContaining([
              expect.objectContaining({
                sourceFamily: "telegram",
                parserStatus: expect.objectContaining({ state: "ready" }),
                confidence: expect.any(Number),
                timestamps: expect.objectContaining({ lastCaptureAt: expect.any(String) }),
                provenance: expect.objectContaining({
                  evidenceProofId: expect.any(String),
                  sourceHealthProofId: expect.any(String)
                }),
                consumers: expect.objectContaining({
                  publicTi: expect.any(Object),
                  alertGeneration: expect.any(Object)
                }),
                safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
              })
            ]),
            operations: expect.arrayContaining([
              expect.objectContaining({ type: "rebuild_alerts", route: expect.objectContaining({ liveNetworkFetch: false }) })
            ]),
            summary: expect.objectContaining({
              rowCount: expect.any(Number),
              operationTypes: expect.arrayContaining(["rebuild_alerts"]),
              latestCaptureAt: expect.any(String)
            })
          }),
          sourceFamilyCoverageMatrix: expect.objectContaining({
            schemaVersion: "ti.public_actor.source_family_coverage_matrix.v1",
            rows: expect.any(Array),
            summary: expect.objectContaining({
              totalFamilies: expect.any(Number),
              latestCaptureAt: expect.any(String)
            })
          }),
          watchlistAlertabilityBridge: expect.objectContaining({
            schemaVersion: "ti.public_actor.watchlist_alertability_bridge.v1",
            ready: true,
            route: expect.objectContaining({
              path: "/v1/dwm/alerts/rebuild",
              liveNetworkFetch: false
            }),
            rows: expect.arrayContaining([
              expect.objectContaining({
                watchlistTerm: "APT29",
                sourceFamily: "telegram",
                state: "alertable",
                parserState: "ready",
                captureState: "capture_observed",
                confidence: expect.any(Number),
                provenance: expect.objectContaining({
                  evidenceProofId: expect.any(String),
                  sourceHealthProofId: expect.any(String)
                }),
                safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
              })
            ]),
            summary: expect.objectContaining({
              alertableFamilies: expect.arrayContaining(["telegram"]),
              watchlistTerms: expect.arrayContaining(["APT29", "example.com"]),
              latestCaptureAt: expect.any(String)
            })
          }),
          gaps: [],
          safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
        },
        publicTiActorPage: {
          schemaVersion: "ti.public_actor.source_readiness.v1",
          proofId: expect.any(String),
          queryAdapter: expect.objectContaining({
            schemaVersion: "ti.public_actor.query_adapter.v1",
            readiness: expect.objectContaining({ publicTiReady: true })
          }),
          actorMetadata: expect.objectContaining({ displayName: "APT29", noSyntheticActorClaims: true }),
          state: "ready",
          sourceCoverage: expect.arrayContaining([
            expect.objectContaining({ family: "telegram", state: "canary" })
          ]),
          sourceReadinessLedgerRows: expect.arrayContaining([
            expect.objectContaining({ family: "telegram", freshnessState: "fresh" })
          ]),
          evidenceReadiness: expect.objectContaining({
            schemaVersion: "dwm.actor_evidence_readiness.v1",
            evidenceReady: true,
            rows: expect.arrayContaining([
              expect.objectContaining({ family: "telegram", confidence: expect.any(Number) })
            ])
          }),
          parserHealthReadiness: expect.objectContaining({
            schemaVersion: "dwm.actor_parser_health_readiness.v1",
            parserReady: true,
            rows: expect.arrayContaining([
              expect.objectContaining({ family: "telegram", parserState: "ready" })
            ])
          }),
          captureReadiness: expect.objectContaining({
            schemaVersion: "dwm.actor_capture_readiness.v1",
            captureReady: true
          }),
          alertGenerationReadiness: expect.objectContaining({
            schemaVersion: "dwm.actor_alert_generation_readiness.v1",
            alertReady: true,
            watchlistMatchReadiness: expect.objectContaining({
              schemaVersion: "dwm.actor_watchlist_match_readiness.v1",
              summary: expect.objectContaining({ ready: true })
            })
          }),
          sourceOperationsQueue: expect.objectContaining({
            schemaVersion: "dwm.actor_source_operations_queue.v1",
            queueItems: expect.arrayContaining([
              expect.objectContaining({ type: "rebuild_alerts", liveNetworkFetch: false })
            ])
          }),
          sourceFamilyHealth: expect.objectContaining({
            schemaVersion: "dwm.actor_source_family_health.v1",
            rows: expect.arrayContaining([
              expect.objectContaining({ family: "telegram", confidence: expect.any(Number), parserState: "ready" })
            ])
          }),
          sourceConsumerBridge: expect.objectContaining({
            schemaVersion: "dwm.actor_source_consumer_bridge.v1",
            consumers: expect.arrayContaining([
              expect.objectContaining({ consumer: "publicTiActorPage", ready: true })
            ])
          }),
          sourceSectionReadiness: expect.objectContaining({
            schemaVersion: "dwm.actor_source_section_readiness.v1",
            sections: expect.arrayContaining([
              expect.objectContaining({ section: "overview", state: "covered" })
            ])
          }),
          freshness: expect.objectContaining({
            captureFreshness: expect.objectContaining({ state: "fresh" })
          })
        },
        dashboardSourceReadiness: {
          schemaVersion: "dwm.dashboard.source_readiness_row.v1",
          proofId: expect.any(String),
          alertReady: true,
          caseReady: true,
          sourceCoverage: expect.arrayContaining([
            expect.objectContaining({ family: "public_advisory", state: "canary" })
          ]),
          sourceReadinessLedgerRows: expect.arrayContaining([
            expect.objectContaining({ family: "public_advisory", downstreamConsumers: expect.objectContaining({ sharedWatchlistAlerts: true }) })
          ]),
          captureReadiness: expect.objectContaining({
            captureRows: expect.arrayContaining([
              expect.objectContaining({ family: "telegram", state: "capture_observed" })
            ])
          }),
          alertGenerationReadiness: expect.objectContaining({
            canRebuildAlerts: true,
            rebuildPlan: expect.objectContaining({ liveNetworkFetch: false })
          }),
          sourceOperationsQueue: expect.objectContaining({
            schemaVersion: "dwm.actor_source_operations_queue.v1",
            queueItems: expect.arrayContaining([
              expect.objectContaining({ type: "rebuild_alerts", liveNetworkFetch: false })
            ])
          }),
          sourceFamilyHealth: expect.objectContaining({
            summary: expect.objectContaining({
              alertReadyFamilies: expect.arrayContaining(["telegram"])
            })
          }),
          sourceConsumerBridge: expect.objectContaining({
            summary: expect.objectContaining({
              publicTiReady: true,
              alertReady: true,
              watchlistMatchReady: true
            })
          }),
          sourceSectionReadiness: expect.objectContaining({
            summary: expect.objectContaining({
              coveredSections: expect.arrayContaining(["overview", "evidence"])
            })
          }),
          freshnessState: "fresh"
        },
        worker3Assertions: expect.arrayContaining([
          ".actorReadiness.proofId | length > 0",
          ".actorReadiness.sourceReadinessLedgerRows | all(has(\"proofId\") and has(\"family\") and has(\"state\") and .safeOutput.liveNetworkScrapeStarted == false)",
          ".actorReadiness.captureReadiness.schemaVersion == \"dwm.actor_capture_readiness.v1\"",
          ".actorReadiness.alertGenerationReadiness.schemaVersion == \"dwm.actor_alert_generation_readiness.v1\"",
          ".actorReadiness.alertGenerationReadiness.watchlistMatchReadiness.schemaVersion == \"dwm.actor_watchlist_match_readiness.v1\"",
          ".actorReadiness.sourceOperationsQueue.schemaVersion == \"dwm.actor_source_operations_queue.v1\"",
          ".actorReadiness.sourceFamilyHealth.schemaVersion == \"dwm.actor_source_family_health.v1\"",
          ".actorReadiness.sourceConsumerBridge.schemaVersion == \"dwm.actor_source_consumer_bridge.v1\"",
          ".actorReadiness.sourceSectionReadiness.schemaVersion == \"dwm.actor_source_section_readiness.v1\"",
          ".proofArtifacts.publicTiQueryAdapter.schemaVersion == \"ti.public_actor.query_adapter.v1\"",
          ".proofArtifacts.publicTiQueryAdapter.alertEvidenceHandoff.schemaVersion == \"ti.public_actor.alert_evidence_handoff.v1\"",
          ".proofArtifacts.publicTiQueryAdapter.parserStatusLedger.schemaVersion == \"ti.public_actor.parser_status_ledger.v1\"",
          ".proofArtifacts.publicTiQueryAdapter.sourcePackIntakeHandoff.schemaVersion == \"ti.public_actor.source_pack_intake_handoff.v1\"",
          ".proofArtifacts.publicTiQueryAdapter.alertGenerationConsumerHandoff.schemaVersion == \"ti.public_actor.alert_generation_consumer_handoff.v1\"",
          ".proofArtifacts.publicTiQueryAdapter.consumerProofLedger.schemaVersion == \"ti.public_actor.consumer_proof_ledger.v1\"",
          ".proofArtifacts.publicTiQueryAdapter.sourceOperationsHandoff.schemaVersion == \"ti.public_actor.source_operations_handoff.v1\"",
          ".proofArtifacts.publicTiQueryAdapter.downstreamFixtureExport.schemaVersion == \"ti.public_actor.downstream_fixture_export.v1\"",
          ".proofArtifacts.publicTiQueryAdapter.sourceFamilyCoverageMatrix.schemaVersion == \"ti.public_actor.source_family_coverage_matrix.v1\"",
          ".proofArtifacts.publicTiQueryAdapter.watchlistAlertabilityBridge.schemaVersion == \"ti.public_actor.watchlist_alertability_bridge.v1\"",
          ".actorReadiness.alertCaseHandoffReadiness.schemaVersion == \"dwm.actor_alert_case_handoff_readiness.v1\"",
          ".proofArtifacts.dashboardSourceReadiness.alertReady != null"
        ])
      }
    });
    expect(actorReadinessBody.actorReadiness.actorSections).toMatchObject({
      overview: expect.objectContaining({ covered: true, sourceFamilies: expect.arrayContaining(["telegram", "actor_page"]) }),
      infrastructure: expect.objectContaining({ covered: true, sourceFamilies: expect.arrayContaining(["darkweb_onion", "actor_page"]) }),
      targeting: expect.objectContaining({ covered: true, sourceFamilies: expect.arrayContaining(["darkweb_metadata", "public_advisory"]) }),
      evidence: expect.objectContaining({ covered: true, sourceFamilies: expect.arrayContaining(["telegram", "clear_web"]) }),
      freshness: expect.objectContaining({ covered: true, sourceFamilies: expect.arrayContaining(["telegram", "clear_web"]) })
    });
    expect(actorReadinessBody.actorReadiness.provenance).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: "telegram",
        lastCaptureAt: expect.any(String),
        privacyBoundary: expect.objectContaining({ noPrivateTelegram: true }),
        safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
      }),
      expect.objectContaining({
        family: "darkweb_onion",
        privacyBoundary: expect.objectContaining({ metadataOnly: true, restrictedSource: true })
      })
    ]));
    expect(actorReadinessBody.actorReadiness.candidateGaps).toEqual([]);
    const staleActorReadiness = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "actor_enrichment_readiness",
        sourcePackId: "pack_activation_proof_mixed",
        query: "APT29",
        tenantId: "tenant_acme",
        orgId: "org_acme",
        scope: "APT29,example.com",
        generatedAt: "2026-07-02T00:00:00.000Z"
      })
    }), options);
    const staleActorReadinessBody = await staleActorReadiness.json() as any;
    expect(staleActorReadiness.status).toBe(200);
    expect(staleActorReadinessBody.actorReadiness.freshness).toMatchObject({
      stale: true,
      captureFreshness: expect.objectContaining({ state: "stale", staleAfterHours: 24 })
    });
    expect(staleActorReadinessBody.proofArtifacts).toMatchObject({
      publicTiActorPage: {
        freshness: expect.objectContaining({
          captureFreshness: expect.objectContaining({ state: "stale" })
        })
      },
      dashboardSourceReadiness: {
        freshnessState: "stale",
        alertReady: true,
        caseReady: true
      }
    });
    expect(configBody.sourceConfigs.every((row: any) => row.activationProof.safeOutput.liveNetworkScrapeStarted === false)).toBe(true);
    expect(frontier.snapshot()).toHaveLength(6);
    expect(JSON.stringify(configBody)).not.toContain("apt29/claims");
    expect(JSON.stringify(configBody)).not.toContain("apt29-index");

    const status = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_status", sourcePackId: "pack_activation_proof_mixed" })
    }), options);
    const statusBody = await status.json() as any;
    const telegramCandidate = statusBody.registry.candidates.find((candidate: any) => candidate.declaredFamily === "telegram");
    const suppressed = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_review",
        packAction: "suppress",
        candidateIds: [telegramCandidate.id],
        decidedBy: "source-proof-worker",
        reason: "pause source during actor enrichment proof"
      })
    }), options);
    expect(suppressed.status).toBe(200);
    const pausedConfig = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "pack_customer_config",
        sourcePackId: "pack_activation_proof_mixed",
        tenantId: "tenant_acme",
        orgId: "org_acme",
        scope: "APT29,example.com"
      })
    }), options);
    const pausedConfigBody = await pausedConfig.json() as any;
    const pausedTelegram = pausedConfigBody.sourceConfigs.find((row: any) => row.family === "telegram");
    expect(pausedTelegram.activationProof).toMatchObject({
      state: "paused",
      alertability: { canProduceCapture: false, canProduceAlert: false },
      actorEnrichment: {
        canEnrichActor: false,
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "paused_source", severity: "blocking" })
        ])
      }
    });
    expect(pausedConfigBody.sourceReadinessArtifact.sharedWatchlistAlertability.activeSourceFamilies).not.toContain("telegram");
    expect(pausedConfigBody.sourceReadinessArtifact.sharedWatchlistAlertability.pausedSourceFamilies).toContain("telegram");
  });

  test("prepares actor enrichment candidate gaps from partial source coverage without network fetches", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const options = { store, frontier };

    const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        sourcePackId: "pack_actor_gap_partial",
        sourcePackLabel: "Actor gap partial source pack",
        tenantId: "tenant_acme",
        scope: "APT28",
        requestedBy: "source-gap-worker",
        candidates: [
          { target: "@apt28_public_updates", type: "telegram_channel", family: "telegram" }
        ]
      })
    }), options);
    expect(created.status).toBe(201);

    const worker = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_worker_run", sourcePackId: "pack_actor_gap_partial", chunkSize: 10 })
    }), options);
    expect(worker.status).toBe(200);

    const readiness = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "actor_enrichment_readiness",
        sourcePackId: "pack_actor_gap_partial",
        query: "APT28",
        tenantId: "tenant_acme",
        orgId: "org_acme"
      })
    }), options);
    const body = await readiness.json() as any;
    expect(readiness.status).toBe(200);
    expect(body.actorReadiness).toMatchObject({
      query: "APT28",
      state: "partial",
      actorMetadata: expect.objectContaining({
        displayName: "APT28",
        noSyntheticActorClaims: true
      }),
      sourceCoverage: expect.arrayContaining([
        expect.objectContaining({ family: "telegram", state: "canary" }),
        expect.objectContaining({ family: "darkweb_onion", state: "missing" }),
        expect.objectContaining({ family: "actor_page", state: "missing" })
      ]),
      sourceReadinessLedgerRows: expect.arrayContaining([
        expect.objectContaining({
          family: "darkweb_onion",
          state: "missing",
          freshnessState: "needs_capture",
          actionability: expect.objectContaining({
            intakeAvailable: true,
            nextActions: expect.arrayContaining(["request_candidate"]),
            liveNetworkFetchRequired: false
          }),
          candidateGap: expect.objectContaining({
            state: "missing",
            intakeRecommendation: expect.objectContaining({ family: "darkweb_onion", policyBoundary: "metadata_only_restricted_source" })
          })
        })
      ]),
      sourceFamilies: {
        active: expect.arrayContaining(["telegram"]),
        enrichable: expect.arrayContaining(["telegram"])
      },
      freshness: {
        stale: true,
        captureFreshness: expect.objectContaining({ state: "needs_capture" }),
        lastSuccessfulEnrichmentAt: expect.any(String)
      },
      evidenceReadiness: {
        schemaVersion: "dwm.actor_evidence_readiness.v1",
        evidenceReady: true,
        summary: expect.objectContaining({
          readyFamilies: expect.arrayContaining(["telegram"]),
          gapFamilies: expect.arrayContaining(["darkweb_onion", "actor_page"]),
          averageConfidence: expect.any(Number)
        }),
        rows: expect.arrayContaining([
          expect.objectContaining({
            family: "darkweb_onion",
            gap: expect.objectContaining({
              state: "missing",
              intakeRecommendation: expect.objectContaining({ policyBoundary: "metadata_only_restricted_source" })
            }),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          })
        ])
      },
      parserHealthReadiness: {
        schemaVersion: "dwm.actor_parser_health_readiness.v1",
        parserReady: true,
        summary: expect.objectContaining({
          readyFamilies: expect.arrayContaining(["telegram"]),
          missingFamilies: expect.arrayContaining(["darkweb_onion", "actor_page"])
        }),
        rows: expect.arrayContaining([
          expect.objectContaining({
            family: "darkweb_onion",
            parserState: "missing_source",
            blockers: expect.arrayContaining([
              expect.objectContaining({ code: "missing_source_family", family: "darkweb_onion" })
            ]),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          })
        ])
      },
      alertCaseHandoffReadiness: {
        alertReady: false,
        caseReady: false,
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "capture_required", severity: "blocking" }),
          expect.objectContaining({ code: "missing_actor_section_source", severity: "warning" })
        ])
      },
      captureReadiness: {
        schemaVersion: "dwm.actor_capture_readiness.v1",
        captureReady: false,
        captureRows: expect.arrayContaining([
          expect.objectContaining({
            family: "telegram",
            state: "capture_required",
            recordCapturePlan: expect.objectContaining({
              body: expect.objectContaining({ action: "record_capture" }),
              liveNetworkFetch: false
            })
          })
        ]),
        missingFamilies: expect.arrayContaining(["darkweb_onion", "actor_page"]),
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "capture_required", severity: "blocking" })
        ])
      },
      alertGenerationReadiness: {
        schemaVersion: "dwm.actor_alert_generation_readiness.v1",
        alertReady: false,
        canRebuildAlerts: false,
        sourceFamilies: expect.objectContaining({
          alertCapable: expect.arrayContaining(["telegram"]),
          missing: expect.arrayContaining(["darkweb_onion", "actor_page"])
        }),
        rebuildPlan: expect.objectContaining({ liveNetworkFetch: false }),
        watchlistMatchReadiness: expect.objectContaining({
          schemaVersion: "dwm.actor_watchlist_match_readiness.v1",
          watchlistTerms: expect.arrayContaining(["APT28"]),
          summary: expect.objectContaining({
            ready: false,
            blockedTerms: expect.arrayContaining(["APT28"]),
            sourceFamilies: expect.arrayContaining(["telegram"])
          }),
          rows: expect.arrayContaining([
            expect.objectContaining({
              watchlistTerm: "APT28",
              family: "telegram",
              state: "capture_required",
              blockers: expect.arrayContaining([
                expect.objectContaining({ code: "capture_required" })
              ]),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            })
          ])
        }),
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "capture_required", severity: "blocking" }),
          expect.objectContaining({ code: "missing_actor_section_source", severity: "warning" })
        ])
      },
      sourceOperationsQueue: {
        schemaVersion: "dwm.actor_source_operations_queue.v1",
        proofId: expect.any(String),
        summary: expect.objectContaining({
          high: 1,
          medium: expect.any(Number),
          alertRebuildReady: false,
          actionTypes: expect.arrayContaining(["record_capture", "request_candidate"])
        }),
        queueItems: expect.arrayContaining([
          expect.objectContaining({
            type: "record_capture",
            priority: "high",
            family: "telegram",
            route: expect.objectContaining({
              path: "/v1/dwm/source-requests",
              body: expect.objectContaining({ action: "record_capture" }),
              liveNetworkFetch: false
            }),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          }),
          expect.objectContaining({
            type: "request_candidate",
            priority: "medium",
            family: "darkweb_onion",
            route: expect.objectContaining({
              path: "/v1/dwm/source-requests",
              liveNetworkFetch: false
            }),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          }),
          expect.objectContaining({
            type: "request_candidate",
            priority: "medium",
            family: "actor_page"
          })
        ]),
        safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
      },
      sourceFamilyHealth: {
        schemaVersion: "dwm.actor_source_family_health.v1",
        proofId: expect.any(String),
        summary: expect.objectContaining({
          activeFamilies: expect.arrayContaining(["telegram"]),
          missingFamilies: expect.arrayContaining(["darkweb_onion", "actor_page"]),
          gapFamilies: expect.arrayContaining(["darkweb_onion", "actor_page"]),
          alertReadyFamilies: []
        }),
        rows: expect.arrayContaining([
          expect.objectContaining({
            family: "telegram",
            parserState: "ready",
            captureState: "capture_required",
            confidence: expect.any(Number),
            timestamps: expect.objectContaining({
              lastEnrichmentAt: expect.any(String),
              checkedAt: expect.any(String)
            }),
            nextActions: expect.arrayContaining([
              expect.objectContaining({ type: "record_capture", liveNetworkFetch: false })
            ]),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          }),
          expect.objectContaining({
            family: "darkweb_onion",
            state: "missing",
            parserState: "missing_source",
            confidenceTier: "missing",
            gap: expect.objectContaining({
              state: "missing",
              intakeRecommendation: expect.objectContaining({ policyBoundary: "metadata_only_restricted_source" })
            }),
            nextActions: expect.arrayContaining([
              expect.objectContaining({ type: "request_candidate", liveNetworkFetch: false })
            ]),
            safeOutput: expect.objectContaining({ restrictedMetadataLeaked: false })
          })
        ]),
        safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
      },
      sourceConsumerBridge: {
        schemaVersion: "dwm.actor_source_consumer_bridge.v1",
        summary: expect.objectContaining({
          publicTiReady: true,
          alertReady: false,
          caseReady: false,
          watchlistMatchReady: false,
          gapFamilies: expect.arrayContaining(["darkweb_onion", "actor_page"])
        }),
        consumers: expect.arrayContaining([
          expect.objectContaining({
            consumer: "publicTiActorPage",
            ready: true,
            sourceFamilies: expect.arrayContaining(["telegram", "darkweb_onion", "actor_page"])
          }),
          expect.objectContaining({
            consumer: "sharedWatchlistAlerts",
            ready: false,
            blockers: expect.arrayContaining([
              expect.objectContaining({ code: "capture_required" })
            ])
          })
        ]),
        rows: expect.arrayContaining([
          expect.objectContaining({
            family: "darkweb_onion",
            consumers: expect.objectContaining({ publicTiActorPage: true, sharedWatchlistAlerts: false }),
            gap: expect.objectContaining({ state: "missing" }),
            safeOutput: expect.objectContaining({ restrictedMetadataLeaked: false })
          })
        ])
      },
      sourceSectionReadiness: {
        schemaVersion: "dwm.actor_source_section_readiness.v1",
        summary: expect.objectContaining({
          coveredSections: expect.arrayContaining(["overview", "evidence", "freshness"]),
          missingSections: expect.arrayContaining(["infrastructure", "targeting"]),
          gapFamilies: expect.arrayContaining(["darkweb_onion", "actor_page"]),
          nextActionTypes: expect.arrayContaining(["request_candidate", "record_capture"])
        }),
        sections: expect.arrayContaining([
          expect.objectContaining({
            section: "infrastructure",
            state: "missing_source",
            missingFamilies: expect.arrayContaining(["darkweb_onion", "actor_page"]),
            blockers: expect.arrayContaining([
              expect.objectContaining({ code: "missing_source_family", section: "infrastructure" })
            ]),
            nextActions: expect.arrayContaining([
              expect.objectContaining({ type: "request_candidate", liveNetworkFetch: false })
            ]),
            safeOutput: expect.objectContaining({ restrictedMetadataLeaked: false })
          }),
          expect.objectContaining({
            section: "overview",
            state: "covered",
            sourceFamilies: expect.arrayContaining(["telegram"]),
            nextActions: expect.arrayContaining([
              expect.objectContaining({ type: "record_capture", liveNetworkFetch: false })
            ])
          })
        ])
      },
      safeOutput: {
        liveNetworkScrapeStarted: false,
        privateTelegramContentExposed: false,
        restrictedMetadataLeaked: false
      }
    });
    expect(body.actorReadiness.missingSections).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: "infrastructure" }),
      expect.objectContaining({ section: "targeting" })
    ]));
    expect(body.actorReadiness.candidateGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: "darkweb_onion",
        state: "missing",
        intakeRecommendation: expect.objectContaining({
          type: "restricted_metadata",
          family: "darkweb_onion",
          policyBoundary: "metadata_only_restricted_source"
        })
      }),
      expect.objectContaining({
        family: "actor_page",
        state: "missing",
        intakeRecommendation: expect.objectContaining({
          type: "public_url",
          family: "actor_page",
          policyBoundary: "public_metadata_only"
        })
      })
    ]));
    expect(body.candidateIntakeContract).toMatchObject({
      schemaVersion: "dwm.actor_source_candidate_intake.v1",
      mode: "prepare_no_network",
      sourcePackWorkflow: {
        schemaVersion: "dwm.actor_source_candidate_intake_workflow.v1",
        sourcePackId: expect.any(String),
        idempotencyKey: expect.any(String),
        steps: expect.arrayContaining([
          expect.objectContaining({
            step: "create_source_pack",
            method: "POST",
            path: "/v1/dwm/source-requests",
            body: expect.objectContaining({
              sourcePackId: expect.any(String),
              sourcePackLabel: "APT28 enrichment source pack",
              scope: "APT28",
              candidates: expect.arrayContaining([
                expect.objectContaining({ family: "darkweb_onion", type: "restricted_metadata" }),
                expect.objectContaining({ family: "actor_page", type: "public_url" })
              ])
            }),
            liveNetworkFetch: false
          }),
          expect.objectContaining({
            step: "validate_candidates",
            body: expect.objectContaining({ action: "pack_worker_run", dryRun: true }),
            liveNetworkFetch: false
          }),
          expect.objectContaining({
            step: "review_activation",
            body: expect.objectContaining({ action: "pack_review", packAction: "approve", approveMetadataOnly: true }),
            requiresOperatorApproval: true,
            liveNetworkFetch: false
          })
        ]),
        expectedStateTransitions: expect.arrayContaining(["candidate_requested", "validation_ready", "operator_review_required", "activation_queued"]),
        safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
      },
      route: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          sourcePackId: expect.any(String),
          sourcePackLabel: "APT28 enrichment source pack",
          scope: "APT28",
          candidates: expect.arrayContaining([
            expect.objectContaining({ family: "darkweb_onion", type: "restricted_metadata" }),
            expect.objectContaining({ family: "actor_page", type: "public_url" })
          ])
        }
      },
      policyValidation: {
        liveNetworkFetch: false,
        rawRestrictedPayloadStorage: false
      },
      validationSummary: {
        totalCandidates: 5,
        accepted: 5,
        blocked: 0,
        metadataOnly: expect.any(Number),
        publicOnly: expect.any(Number)
      },
      candidatePreviews: expect.arrayContaining([
        expect.objectContaining({
          schemaVersion: "dwm.actor_source_candidate_intake_preview.v1",
          family: "darkweb_onion",
          policyResult: expect.objectContaining({
            allowed: true,
            metadataOnly: true,
            liveNetworkFetch: false,
            rawRestrictedPayloadStorage: false
          }),
          parserExpectation: expect.objectContaining({
            profile: "restricted_metadata",
            expectedCaptureType: "darkweb_onion_metadata_observation",
            liveNetworkRequiredForProof: false
          }),
          activationReadiness: expect.objectContaining({
            canCreateCandidate: true,
            canAutoActivate: false,
            requiresOperatorApproval: true,
            requiresMetadataOnlyApproval: true,
            idempotencyKey: expect.any(String)
          }),
          blockers: expect.arrayContaining([
            expect.objectContaining({ code: "metadata_only_restricted_source", severity: "info" })
          ]),
          safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
        }),
        expect.objectContaining({
          family: "actor_page",
          policyResult: expect.objectContaining({ allowed: true, publicOnly: true }),
          parserExpectation: expect.objectContaining({
            profile: "actor_page_metadata",
            expectedCaptureType: "actor_page_metadata"
          }),
          alertability: expect.objectContaining({
            canEventuallyProduceAlert: true,
            alertableFields: expect.arrayContaining(["actorName", "aliases"])
          })
        })
      ])
    });
    expect(body.proofArtifacts).toMatchObject({
      publicTiQueryAdapter: {
        schemaVersion: "ti.public_actor.query_adapter.v1",
        route: expect.objectContaining({ path: "/ti/apt28", liveNetworkFetch: false }),
        readiness: expect.objectContaining({
          state: "partial",
          publicTiReady: true,
          alertReady: false,
          watchlistMatchReady: false,
          freshnessState: "needs_capture"
        }),
        sections: expect.arrayContaining([
          expect.objectContaining({
            section: "infrastructure",
            state: "missing_source",
            gaps: expect.arrayContaining([
              expect.objectContaining({
                family: "darkweb_onion",
                intakeRecommendation: expect.objectContaining({ policyBoundary: "metadata_only_restricted_source" })
              })
            ]),
            nextActions: expect.arrayContaining([
              expect.objectContaining({ type: "request_candidate", liveNetworkFetch: false })
            ]),
            safeOutput: expect.objectContaining({ restrictedMetadataLeaked: false })
          })
        ]),
        sourceHealth: expect.arrayContaining([
          expect.objectContaining({
            family: "darkweb_onion",
            state: "missing",
            parserState: "missing_source",
            confidenceTier: "missing"
          })
        ]),
        parserStatusLedger: expect.objectContaining({
          schemaVersion: "ti.public_actor.parser_status_ledger.v1",
          summary: expect.objectContaining({
            readyFamilies: expect.arrayContaining(["telegram"]),
            missingFamilies: expect.arrayContaining(["darkweb_onion", "actor_page"]),
            captureRequiredFamilies: expect.arrayContaining(["telegram"])
          }),
          rows: expect.arrayContaining([
            expect.objectContaining({
              family: "darkweb_onion",
              parserState: "missing_source",
              confidenceTier: "missing",
              gap: expect.objectContaining({
                state: "missing",
                intakeRecommendation: expect.objectContaining({ policyBoundary: "metadata_only_restricted_source" })
              }),
              nextActions: expect.arrayContaining([
                expect.objectContaining({ type: "request_candidate", liveNetworkFetch: false })
              ])
            })
          ])
        }),
        sourcePackIntakeHandoff: expect.objectContaining({
          schemaVersion: "ti.public_actor.source_pack_intake_handoff.v1",
          ready: true,
          validationSummary: expect.objectContaining({
            totalCandidates: expect.any(Number),
            accepted: expect.any(Number),
            metadataOnly: expect.any(Number)
          }),
          sourcePackWorkflow: expect.objectContaining({
            schemaVersion: "dwm.actor_source_candidate_intake_workflow.v1",
            steps: expect.arrayContaining([
              expect.objectContaining({ step: "create_source_pack", liveNetworkFetch: false }),
              expect.objectContaining({ step: "validate_candidates", body: expect.objectContaining({ action: "pack_worker_run", dryRun: true }) }),
              expect.objectContaining({ step: "review_activation", body: expect.objectContaining({ action: "pack_review", packAction: "approve" }) })
            ])
          }),
          candidates: expect.arrayContaining([
            expect.objectContaining({
              family: "darkweb_onion",
              policyResult: expect.objectContaining({
                allowed: true,
                metadataOnly: true,
                liveNetworkFetch: false
              }),
              parserExpectation: expect.objectContaining({
                profile: "restricted_metadata",
                expectedCaptureType: "darkweb_onion_metadata_observation"
              }),
              activationReadiness: expect.objectContaining({
                requiresOperatorApproval: true,
                requiresMetadataOnlyApproval: true
              }),
              provenance: expect.objectContaining({
                gapState: "missing",
                sourceFamily: "darkweb_onion"
              }),
              safeOutput: expect.objectContaining({ restrictedMetadataLeaked: false })
            })
          ])
        }),
        alertEvidenceHandoff: expect.objectContaining({
          schemaVersion: "ti.public_actor.alert_evidence_handoff.v1",
          ready: false,
          rows: expect.arrayContaining([
            expect.objectContaining({
              watchlistTerm: "APT28",
              family: "telegram",
              state: "capture_required",
              blockers: expect.arrayContaining([
                expect.objectContaining({ code: "capture_required" })
              ]),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            })
          ]),
          blockers: expect.arrayContaining([
            expect.objectContaining({ code: "capture_required" })
          ]),
          summary: expect.objectContaining({
            readyRows: 0,
            blockedRows: expect.any(Number),
            sourceFamilies: expect.arrayContaining(["telegram"])
          })
        }),
        alertGenerationConsumerHandoff: expect.objectContaining({
          schemaVersion: "ti.public_actor.alert_generation_consumer_handoff.v1",
          ready: false,
          route: expect.objectContaining({
            path: "/v1/dwm/alerts/rebuild",
            liveNetworkFetch: false,
            body: expect.objectContaining({
              actor: "APT28",
              sourceFamilies: [],
              dryRun: true
            })
          }),
          rows: expect.arrayContaining([
            expect.objectContaining({
              watchlistTerm: "APT28",
              family: "telegram",
              state: "blocked",
              parserStatus: expect.objectContaining({
                state: "ready",
                captureState: "capture_required"
              }),
              blockers: expect.arrayContaining([
                expect.objectContaining({ code: "capture_required" })
              ]),
              provenance: expect.objectContaining({
                sourceFamily: "telegram",
                sourceHealthProofId: expect.any(String)
              }),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            })
          ]),
          summary: expect.objectContaining({
            readyRows: 0,
            blockedRows: expect.any(Number),
            sourceFamilies: expect.arrayContaining(["telegram"]),
            parserStates: expect.arrayContaining(["ready"])
          }),
          gaps: expect.arrayContaining([
            expect.objectContaining({ family: "darkweb_onion", state: "missing" })
          ]),
          blockers: expect.arrayContaining([
            expect.objectContaining({ code: "capture_required" })
          ])
        }),
        consumerProofLedger: expect.objectContaining({
          schemaVersion: "ti.public_actor.consumer_proof_ledger.v1",
          rows: expect.any(Array),
          summary: expect.objectContaining({
            alertReadyFamilies: [],
            gapFamilies: expect.arrayContaining(["darkweb_onion", "actor_page"])
          }),
          safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
        }),
        sourceOperationsHandoff: expect.objectContaining({
          schemaVersion: "ti.public_actor.source_operations_handoff.v1",
          operations: expect.arrayContaining([
            expect.objectContaining({
              type: "record_capture",
              family: "telegram",
              route: expect.objectContaining({
                path: "/v1/dwm/source-requests",
                body: expect.objectContaining({ action: "record_capture" }),
                liveNetworkFetch: false
              }),
              parserStatus: expect.objectContaining({ state: "ready" }),
              safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
            }),
            expect.objectContaining({
              type: "request_candidate",
              family: "darkweb_onion",
              gap: expect.objectContaining({ state: "missing" })
            })
          ]),
          summary: expect.objectContaining({
            captureRecordReady: true,
            actionTypes: expect.arrayContaining(["record_capture", "request_candidate"])
          })
        }),
        downstreamFixtureExport: expect.objectContaining({
          schemaVersion: "ti.public_actor.downstream_fixture_export.v1",
          rows: expect.arrayContaining([
            expect.objectContaining({
              sourceFamily: "darkweb_onion",
              gap: expect.objectContaining({
                state: "missing",
                intakeRecommendation: expect.objectContaining({ policyBoundary: "metadata_only_restricted_source" })
              }),
              safeOutput: expect.objectContaining({ restrictedMetadataLeaked: false })
            })
          ]),
          operations: expect.arrayContaining([
            expect.objectContaining({ type: "record_capture" }),
            expect.objectContaining({ type: "request_candidate" })
          ]),
          summary: expect.objectContaining({
            gapFamilies: expect.arrayContaining(["darkweb_onion", "actor_page"]),
            operationTypes: expect.arrayContaining(["record_capture", "request_candidate"])
          })
        }),
        sourceFamilyCoverageMatrix: expect.objectContaining({
          schemaVersion: "ti.public_actor.source_family_coverage_matrix.v1",
          rows: expect.arrayContaining([
            expect.objectContaining({
              sourceFamily: "darkweb_onion",
              gapState: "missing",
              alertGenerationReady: false,
              safeOutput: expect.objectContaining({ restrictedMetadataLeaked: false })
            })
          ]),
          summary: expect.objectContaining({
            gapFamilies: expect.arrayContaining(["darkweb_onion", "actor_page"]),
            operationTypes: expect.arrayContaining(["record_capture", "request_candidate"])
          })
        }),
        watchlistAlertabilityBridge: expect.objectContaining({
          schemaVersion: "ti.public_actor.watchlist_alertability_bridge.v1",
          ready: false,
          rows: expect.arrayContaining([
            expect.objectContaining({
              watchlistTerm: "APT28",
              sourceFamily: "telegram",
              state: "blocked",
              parserState: "ready",
              captureState: "capture_required",
              blockers: expect.arrayContaining([
                expect.objectContaining({ code: "capture_required" })
              ])
            })
          ]),
          summary: expect.objectContaining({
            blockedFamilies: expect.arrayContaining(["telegram"]),
            gapFamilies: expect.arrayContaining(["darkweb_onion", "actor_page"]),
            readyRows: 0
          }),
          blockers: expect.arrayContaining([
            expect.objectContaining({ code: "capture_required" })
          ])
        }),
        gaps: expect.arrayContaining([
          expect.objectContaining({ family: "darkweb_onion", state: "missing" })
        ])
      },
      publicTiActorPage: {
        schemaVersion: "ti.public_actor.source_readiness.v1",
        state: "partial",
        missingDataGaps: expect.arrayContaining([
          expect.objectContaining({ family: "darkweb_onion", state: "missing" }),
          expect.objectContaining({ family: "actor_page", state: "missing" })
        ])
      },
      dashboardSourceReadiness: {
        schemaVersion: "dwm.dashboard.source_readiness_row.v1",
        alertReady: false,
        caseReady: false,
        sourceCoverage: expect.arrayContaining([
          expect.objectContaining({ family: "darkweb_onion", state: "missing" })
        ]),
        sourcePackActionReadiness: expect.objectContaining({
          schemaVersion: "dwm.actor_source_pack_action_readiness.v1",
          intakeActions: expect.arrayContaining([
            expect.objectContaining({ action: "request_candidate", family: "darkweb_onion", liveNetworkFetch: false })
          ])
        }),
        sourceOperationsQueue: expect.objectContaining({
          schemaVersion: "dwm.actor_source_operations_queue.v1",
          queueItems: expect.arrayContaining([
            expect.objectContaining({ type: "record_capture", family: "telegram", liveNetworkFetch: false }),
            expect.objectContaining({ type: "request_candidate", family: "darkweb_onion", liveNetworkFetch: false })
          ])
        }),
        sourceFamilyHealth: expect.objectContaining({
          schemaVersion: "dwm.actor_source_family_health.v1",
          rows: expect.arrayContaining([
            expect.objectContaining({ family: "darkweb_onion", parserState: "missing_source" })
          ])
        }),
        sourceConsumerBridge: expect.objectContaining({
          schemaVersion: "dwm.actor_source_consumer_bridge.v1",
          consumers: expect.arrayContaining([
            expect.objectContaining({ consumer: "sharedWatchlistAlerts", ready: false })
          ])
        }),
        sourceSectionReadiness: expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({ section: "infrastructure", state: "missing_source" })
          ])
        }),
        freshnessState: "needs_capture"
      }
    });
    expect(frontier.snapshot()).toHaveLength(1);

    const source = store.listSources().find((item: any) => item.metadata?.sourceGrowthFamily === "telegram");
    expect(source?.id).toBeTruthy();
    const failed = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "collection_failed",
        sourceId: source?.id,
        errorCode: "parser_timeout",
        reason: "Telegram preview parser timed out"
      })
    }), options);
    expect(failed.status).toBe(200);

    const retryReadiness = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "actor_enrichment_readiness",
        sourcePackId: "pack_actor_gap_partial",
        query: "APT28",
        tenantId: "tenant_acme",
        orgId: "org_acme"
      })
    }), options);
    const retryBody = await retryReadiness.json() as any;
    expect(retryReadiness.status).toBe(200);
    expect(retryBody.actorReadiness).toMatchObject({
      state: "partial",
      sourceCoverage: expect.arrayContaining([
        expect.objectContaining({ family: "telegram", state: "failed", parserStatuses: expect.arrayContaining(["parser_retry_scheduled"]) })
      ]),
      sourceReadinessLedgerRows: expect.arrayContaining([
        expect.objectContaining({
          family: "telegram",
          state: "failed",
          actionability: expect.objectContaining({
            retryAvailable: true,
            nextActions: expect.arrayContaining(["retry"]),
            liveNetworkFetchRequired: false
          }),
          retryBackoff: expect.objectContaining({
            retryable: true,
            failureCategories: expect.arrayContaining(["parser_timeout"])
          })
        })
      ]),
      sourceFamilies: {
        failed: expect.arrayContaining(["telegram"])
      },
      retryBlockers: expect.arrayContaining([
        expect.objectContaining({
          family: "telegram",
          retryBackoff: expect.objectContaining({
            retryable: true,
            failureCategories: expect.arrayContaining(["parser_timeout"])
          })
        })
      ]),
      sourcePackActionReadiness: {
        schemaVersion: "dwm.actor_source_pack_action_readiness.v1",
        retryActions: expect.arrayContaining([
          expect.objectContaining({
            action: "retry",
            family: "telegram",
            sourceIds: expect.arrayContaining([expect.any(String)]),
            candidateIds: expect.arrayContaining([expect.any(String)]),
            route: expect.objectContaining({
              method: "POST",
              path: "/v1/dwm/source-requests",
              body: expect.objectContaining({ action: "pack_review", packAction: "retry" })
            }),
            liveNetworkFetch: false
          })
        ]),
        intakeActions: expect.arrayContaining([
          expect.objectContaining({ action: "request_candidate", family: "actor_page", liveNetworkFetch: false })
        ])
      },
      parserHealthReadiness: {
        parserReady: false,
        summary: expect.objectContaining({
          retryFamilies: expect.arrayContaining(["telegram"])
        }),
        rows: expect.arrayContaining([
          expect.objectContaining({
            family: "telegram",
            parserState: "retry_required",
            actionability: expect.objectContaining({
              retryAvailable: true,
              nextActions: expect.arrayContaining(["retry"]),
              liveNetworkFetchRequired: false
            }),
            blockers: expect.arrayContaining([
              expect.objectContaining({ code: "parser_retry_required", family: "telegram" })
            ])
          })
        ])
      },
      alertCaseHandoffReadiness: {
        alertReady: false,
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "capture_required" }),
          expect.objectContaining({ code: "retry_required", family: "telegram" })
        ])
      },
      captureReadiness: {
        captureReady: false,
        captureRows: expect.arrayContaining([
          expect.objectContaining({
            family: "telegram",
            state: "retry_required",
            blockers: expect.arrayContaining([
              expect.objectContaining({ code: "retry_required", family: "telegram" })
            ])
          })
        ])
      },
      alertGenerationReadiness: {
        alertReady: false,
        canRebuildAlerts: false,
        sourceFamilies: expect.objectContaining({
          blocked: expect.arrayContaining(["telegram"])
        }),
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "retry_required", family: "telegram" })
        ]),
        rebuildPlan: expect.objectContaining({ dryRunSupported: true, liveNetworkFetch: false }),
        watchlistMatchReadiness: expect.objectContaining({
          schemaVersion: "dwm.actor_watchlist_match_readiness.v1",
          summary: expect.objectContaining({
            ready: false,
            sourceFamilies: []
          }),
          rows: []
        })
      },
      sourceOperationsQueue: {
        schemaVersion: "dwm.actor_source_operations_queue.v1",
        summary: expect.objectContaining({
          critical: expect.any(Number),
          alertRebuildReady: false,
          actionTypes: expect.arrayContaining(["retry_parser", "retry_capture", "request_candidate"])
        }),
        queueItems: expect.arrayContaining([
          expect.objectContaining({
            type: "retry_parser",
            priority: "critical",
            family: "telegram",
            route: expect.objectContaining({
              path: "/v1/dwm/source-requests",
              body: expect.objectContaining({ action: "pack_review", packAction: "retry" }),
              liveNetworkFetch: false
            }),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          }),
          expect.objectContaining({
            type: "retry_capture",
            priority: "critical",
            family: "telegram",
            route: expect.objectContaining({
              body: expect.objectContaining({ action: "record_capture" }),
              liveNetworkFetch: false
            })
          })
        ]),
        safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
      },
      sourceFamilyHealth: {
        schemaVersion: "dwm.actor_source_family_health.v1",
        summary: expect.objectContaining({
          failedFamilies: expect.arrayContaining(["telegram"]),
          retryFamilies: expect.arrayContaining(["telegram"]),
          alertReadyFamilies: []
        }),
        rows: expect.arrayContaining([
          expect.objectContaining({
            family: "telegram",
            state: "failed",
            parserState: "retry_required",
            retryBackoff: expect.objectContaining({
              retryable: true,
              failureCategories: expect.arrayContaining(["parser_timeout"])
            }),
            blockers: expect.arrayContaining([
              expect.objectContaining({ code: "parser_retry_required", family: "telegram" })
            ]),
            nextActions: expect.arrayContaining([
              expect.objectContaining({ type: "retry_parser", liveNetworkFetch: false }),
              expect.objectContaining({ type: "retry_capture", liveNetworkFetch: false })
            ]),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          })
        ])
      },
      sourceConsumerBridge: {
        schemaVersion: "dwm.actor_source_consumer_bridge.v1",
        summary: expect.objectContaining({
          publicTiReady: false,
          alertReady: false,
          watchlistMatchReady: false,
          retryFamilies: expect.arrayContaining(["telegram"])
        }),
        consumers: expect.arrayContaining([
          expect.objectContaining({
            consumer: "sharedWatchlistAlerts",
            ready: false,
            blockers: expect.arrayContaining([
              expect.objectContaining({ code: "retry_required", family: "telegram" })
            ])
          })
        ]),
        rows: expect.arrayContaining([
          expect.objectContaining({
            family: "telegram",
            parserState: "retry_required",
            nextActions: expect.arrayContaining([
              expect.objectContaining({ type: "retry_parser", liveNetworkFetch: false })
            ])
          })
        ])
      },
      sourceSectionReadiness: {
        schemaVersion: "dwm.actor_source_section_readiness.v1",
        summary: expect.objectContaining({
          missingSections: expect.arrayContaining(["overview", "infrastructure", "targeting"]),
          gapFamilies: expect.arrayContaining(["telegram", "actor_page"]),
          nextActionTypes: expect.arrayContaining(["retry_parser", "retry_capture", "request_candidate"])
        }),
        sections: expect.arrayContaining([
          expect.objectContaining({
            section: "overview",
            state: "missing_source",
            sourceFamilies: [],
            nextActions: expect.arrayContaining([
              expect.objectContaining({ type: "retry_parser", liveNetworkFetch: false }),
              expect.objectContaining({ type: "request_candidate", liveNetworkFetch: false })
            ])
          })
        ])
      }
    });
    expect(retryBody.proofArtifacts).toMatchObject({
      dashboardSourceReadiness: {
        alertReady: false,
        caseReady: false,
        retryBlockers: expect.arrayContaining([
          expect.objectContaining({ family: "telegram" })
        ]),
        sourceOperationsQueue: expect.objectContaining({
          queueItems: expect.arrayContaining([
            expect.objectContaining({ type: "retry_parser", family: "telegram", liveNetworkFetch: false })
          ])
        }),
        sourceFamilyHealth: expect.objectContaining({
          rows: expect.arrayContaining([
            expect.objectContaining({ family: "telegram", parserState: "retry_required" })
          ])
        }),
        sourceConsumerBridge: expect.objectContaining({
          consumers: expect.arrayContaining([
            expect.objectContaining({ consumer: "sharedWatchlistAlerts", ready: false })
          ])
        }),
        sourceSectionReadiness: expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({ section: "overview", state: "missing_source" })
          ])
        })
      },
      publicTiActorPage: {
        queryAdapter: expect.objectContaining({
          schemaVersion: "ti.public_actor.query_adapter.v1",
          readiness: expect.objectContaining({
            state: "partial",
            publicTiReady: false,
            alertReady: false,
            watchlistMatchReady: false
          }),
          sections: expect.arrayContaining([
            expect.objectContaining({
              section: "overview",
              state: "missing_source",
              nextActions: expect.arrayContaining([
                expect.objectContaining({ type: "retry_parser", liveNetworkFetch: false })
              ])
            })
          ]),
          sourceHealth: expect.arrayContaining([
            expect.objectContaining({
              family: "telegram",
              state: "failed",
              parserState: "retry_required",
              nextActions: expect.arrayContaining([
                expect.objectContaining({ type: "retry_parser", liveNetworkFetch: false })
              ])
            })
          ]),
          parserStatusLedger: expect.objectContaining({
            schemaVersion: "ti.public_actor.parser_status_ledger.v1",
            summary: expect.objectContaining({
              retryFamilies: expect.arrayContaining(["telegram"]),
              missingFamilies: expect.arrayContaining(["actor_page"]),
              nextActionTypes: expect.arrayContaining(["retry_parser", "retry_capture", "request_candidate"])
            }),
            rows: expect.arrayContaining([
              expect.objectContaining({
                family: "telegram",
                parserState: "retry_required",
                retryBackoff: expect.objectContaining({
                  retryable: true,
                  failureCategories: expect.arrayContaining(["parser_timeout"])
                }),
                nextActions: expect.arrayContaining([
                  expect.objectContaining({ type: "retry_parser", liveNetworkFetch: false })
                ])
              })
            ])
          }),
          sourcePackIntakeHandoff: expect.objectContaining({
            schemaVersion: "ti.public_actor.source_pack_intake_handoff.v1",
            ready: true,
            candidates: expect.arrayContaining([
              expect.objectContaining({
                family: "telegram",
                policyResult: expect.objectContaining({ allowed: true, publicOnly: true }),
                parserExpectation: expect.objectContaining({ profile: "public_channel_handoff" }),
                provenance: expect.objectContaining({ gapState: "failed" })
              }),
              expect.objectContaining({
                family: "actor_page",
                parserExpectation: expect.objectContaining({ profile: "actor_page_metadata" }),
                activationReadiness: expect.objectContaining({ requiresOperatorApproval: true })
              })
            ]),
            sourcePackWorkflow: expect.objectContaining({
              steps: expect.arrayContaining([
                expect.objectContaining({ step: "validate_candidates", liveNetworkFetch: false })
              ])
            })
          }),
          alertEvidenceHandoff: expect.objectContaining({
            schemaVersion: "ti.public_actor.alert_evidence_handoff.v1",
            ready: false,
            rows: [],
            blockers: expect.arrayContaining([
              expect.objectContaining({ code: "retry_required", family: "telegram" })
            ]),
            sourceSections: expect.arrayContaining([
              expect.objectContaining({
                section: "overview",
                state: "missing_source",
                nextActions: expect.arrayContaining([
                  expect.objectContaining({ type: "retry_parser", liveNetworkFetch: false })
                ])
              })
            ])
          }),
          alertGenerationConsumerHandoff: expect.objectContaining({
            schemaVersion: "ti.public_actor.alert_generation_consumer_handoff.v1",
            ready: false,
            rows: [],
            route: expect.objectContaining({
              path: "/v1/dwm/alerts/rebuild",
              liveNetworkFetch: false,
              body: expect.objectContaining({
                actor: "APT28",
                sourceFamilies: [],
                watchlistTerms: [],
                dryRun: true
              })
            }),
            summary: expect.objectContaining({
              readyRows: 0,
              blockedRows: 0,
              sourceFamilies: [],
              parserStates: []
            }),
            blockers: expect.arrayContaining([
              expect.objectContaining({ code: "retry_required", family: "telegram" })
            ]),
            gaps: expect.arrayContaining([
              expect.objectContaining({ family: "telegram", state: "failed" }),
              expect.objectContaining({ family: "actor_page", state: "missing" })
            ]),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          }),
          consumerProofLedger: expect.objectContaining({
            schemaVersion: "ti.public_actor.consumer_proof_ledger.v1",
            rows: expect.any(Array),
            summary: expect.objectContaining({
              retryFamilies: expect.arrayContaining(["telegram"]),
              gapFamilies: expect.arrayContaining(["telegram", "actor_page"]),
              alertReadyFamilies: []
            }),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          }),
          sourceOperationsHandoff: expect.objectContaining({
            schemaVersion: "ti.public_actor.source_operations_handoff.v1",
            operations: expect.arrayContaining([
              expect.objectContaining({
                type: "retry_parser",
                family: "telegram",
                route: expect.objectContaining({
                  body: expect.objectContaining({ action: "pack_review", packAction: "retry" }),
                  liveNetworkFetch: false
                }),
                parserStatus: expect.objectContaining({ state: "retry_required" }),
                safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
              }),
              expect.objectContaining({
                type: "retry_capture",
                family: "telegram",
                route: expect.objectContaining({
                  body: expect.objectContaining({ action: "record_capture" }),
                  liveNetworkFetch: false
                })
              })
            ]),
            summary: expect.objectContaining({
              retryReady: true,
              actionTypes: expect.arrayContaining(["retry_parser", "retry_capture", "request_candidate"])
            })
          }),
          downstreamFixtureExport: expect.objectContaining({
            schemaVersion: "ti.public_actor.downstream_fixture_export.v1",
            rows: expect.arrayContaining([
              expect.objectContaining({
                sourceFamily: "telegram",
                parserStatus: expect.objectContaining({
                  state: "retry_required",
                  retryBackoff: expect.objectContaining({ retryable: true })
                }),
                gap: expect.objectContaining({ state: "failed" }),
                blockers: expect.arrayContaining([
                  expect.objectContaining({ code: "parser_retry_required", family: "telegram" })
                ])
              })
            ]),
            operations: expect.arrayContaining([
              expect.objectContaining({ type: "retry_parser" }),
              expect.objectContaining({ type: "retry_capture" })
            ]),
            summary: expect.objectContaining({
              retryFamilies: expect.arrayContaining(["telegram"]),
              operationTypes: expect.arrayContaining(["retry_parser", "retry_capture", "request_candidate"])
            }),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          }),
          sourceFamilyCoverageMatrix: expect.objectContaining({
            schemaVersion: "ti.public_actor.source_family_coverage_matrix.v1",
            rows: expect.arrayContaining([
              expect.objectContaining({
                sourceFamily: "telegram",
                parserState: "retry_required",
                operationTypes: expect.arrayContaining(["retry_parser", "retry_capture"]),
                gapState: "failed",
                blockerCodes: expect.arrayContaining(["parser_retry_required"])
              })
            ]),
            summary: expect.objectContaining({
              retryFamilies: expect.arrayContaining(["telegram"]),
              operationTypes: expect.arrayContaining(["retry_parser", "retry_capture", "request_candidate"])
            })
          }),
          watchlistAlertabilityBridge: expect.objectContaining({
            schemaVersion: "ti.public_actor.watchlist_alertability_bridge.v1",
            ready: false,
            rows: [],
            summary: expect.objectContaining({
              retryFamilies: expect.arrayContaining(["telegram"]),
              gapFamilies: expect.arrayContaining(["telegram", "actor_page"]),
              readyRows: 0,
              blockedRows: 0
            }),
            blockers: expect.arrayContaining([
              expect.objectContaining({ code: "retry_required", family: "telegram" })
            ]),
            safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
          })
        }),
        alertCaseHandoffReadiness: expect.objectContaining({
          blockers: expect.arrayContaining([
            expect.objectContaining({ code: "retry_required", family: "telegram" })
          ])
        })
      }
    });
  });

  test("retrieves source packs across scraper store restarts through durable adapter", async () => {
    const sourcePackRegistry = new InMemoryDwmSourcePackRegistryAdapter();
    const firstStore = new InMemoryScraperStore();
    const firstFrontier = new FocusedFrontier();
    const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        sourcePackId: "pack_durable_restart",
        sourcePackLabel: "Durable Telegram restart pack",
        requestId: "req_durable_restart",
        requestedBy: "source-growth-worker",
        candidates: [
          { target: "@durable_restart_cti", type: "telegram_channel", family: "telegram" },
          { target: "not-a-public-channel", type: "telegram_channel", family: "telegram" }
        ]
      })
    }), { store: firstStore, frontier: firstFrontier, sourcePackRegistry });
    const createdBody = await created.json() as any;
    expect(created.status).toBe(201);
    expect(createdBody.packStatus).toMatchObject({
      totalCandidateCount: 2,
      familyCoverage: { telegram: { total: 2, pending: 1, blocked: 1 } }
    });

    const restartedStore = new InMemoryScraperStore();
    const restartedFrontier = new FocusedFrontier();
    const status = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_status", sourcePackId: "pack_durable_restart" })
    }), { store: restartedStore, frontier: restartedFrontier, sourcePackRegistry });
    const statusBody = await status.json() as any;
    expect(status.status).toBe(200);
    expect(statusBody.registry).toMatchObject({
      id: "pack_durable_restart",
      requestId: createdBody.request.id,
      familyCoverage: { telegram: { total: 2, blocked: 1 } },
      packStatus: {
        totalCandidateCount: 2,
        registryOnlyCandidateCount: 2,
        queuedForCollectionCount: 0
      }
    });
    expect(statusBody.registry.candidates.every((candidate: any) => candidate.targetRef.rawStored === false)).toBe(true);

    const listed = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_list", family: "telegram", decision: "rejected_at_intake", limit: 1 })
    }), { store: restartedStore, frontier: restartedFrontier, sourcePackRegistry });
    const listedBody = await listed.json() as any;
    expect(listed.status).toBe(200);
    expect(listedBody.summary).toMatchObject({ packCount: 1, totalMatchedPacks: 1, totalCandidates: 2 });
    expect(listedBody.packs[0]).toMatchObject({ id: "pack_durable_restart", familyCoverage: { telegram: { total: 2 } } });
  });

  test("persists all-rejected source packs without storing raw unsafe rows", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        sourcePackId: "pack_all_rejected",
        sourcePackLabel: "All rejected pack",
        requestedBy: "source-growth-worker",
        candidates: [
          { target: "not-a-public-channel", type: "telegram_channel" },
          { target: "metadata://darkweb/credential-dump-password-payload", type: "restricted_metadata" }
        ]
      })
    }), { store, frontier });
    const body = await response.json() as any;

    expect(response.status).toBe(201);
    expect(body.summary).toMatchObject({ acceptedCount: 0, rejectedCount: 2, duplicateCount: 0 });
    expect(body.packStatus).toMatchObject({
      sourcePackId: "pack_all_rejected",
      totalCandidateCount: 2,
      persistedCandidateCount: 0,
      registryOnlyCandidateCount: 2,
      rejectedCount: 2,
      queuedForCollectionCount: 0
    });
    expect(store.listSources()).toHaveLength(0);
    expect(frontier.snapshot()).toHaveLength(0);

    const status = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_status", sourcePackId: "pack_all_rejected" })
    }), { store, frontier });
    const statusBody = await status.json() as any;
    expect(status.status).toBe(200);
    expect(statusBody.registry).toMatchObject({
      id: "pack_all_rejected",
      candidateIds: [expect.any(String), expect.any(String)],
      safeOutput: {
        rawUnsafeRowsStored: false,
        rawRejectedTargetsStored: false,
        restrictedPayloadDownloadAllowed: false
      }
    });
    expect(statusBody.registry.candidates.every((candidate: any) => candidate.targetRef.rawStored === false)).toBe(true);
    expect(statusBody.packStatus.failureReasons).toHaveLength(2);
    expect(JSON.stringify(statusBody.registry)).not.toContain("not-a-public-channel");
    expect(JSON.stringify(statusBody.registry)).not.toContain("credential-dump-password-payload");

    const listed = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_list", sourcePackLabel: "All rejected pack" })
    }), { store, frontier });
    const listedBody = await listed.json() as any;
    expect(listed.status).toBe(200);
    expect(listedBody.summary).toMatchObject({ packCount: 1, totalCandidates: 2, rejectedCount: 2, queuedForCollectionCount: 0 });
  });

  test("persists duplicate-only packs with source references and no queued work", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const existing = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "@duplicate_registry_cti", type: "telegram_channel", tenantId: "tenant_acme", activate: false })
    }), { store, frontier });
    const existingBody = await existing.json() as any;

    const pack = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        sourcePackId: "pack_duplicate_only",
        sourcePackLabel: "Duplicate-only pack",
        tenantId: "tenant_acme",
        candidates: [
          { target: "@duplicate_registry_cti", type: "telegram_channel" }
        ]
      })
    }), { store, frontier });
    const packBody = await pack.json() as any;

    expect(pack.status).toBe(201);
    expect(packBody.summary).toMatchObject({ acceptedCount: 0, rejectedCount: 0, duplicateCount: 1 });
    expect(packBody.packStatus).toMatchObject({
      sourcePackId: "pack_duplicate_only",
      totalCandidateCount: 1,
      persistedCandidateCount: 0,
      registryOnlyCandidateCount: 1,
      duplicateCount: 1,
      queuedForCollectionCount: 0,
      familyCoverage: { telegram: { total: 1, blocked: 1 } }
    });
    expect(store.listSources()).toHaveLength(1);
    expect(frontier.snapshot()).toHaveLength(0);

    const status = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "pack_status", sourcePackId: "pack_duplicate_only" })
    }), { store, frontier });
    const statusBody = await status.json() as any;
    expect(status.status).toBe(200);
    expect(statusBody.registry.candidates[0]).toMatchObject({
      status: "duplicate",
      sourceGrowthFamily: "telegram",
      parserExpectation: "telegram_public_metadata_and_text_fixture",
      duplicateOf: existingBody.source.id,
      targetRef: { rawStored: false },
      sourceHealth: {
        queuedActivationJobs: [],
        queuedTestJobs: [],
        canProduceAlertGradeEvidence: false
      },
      collectionTrigger: { queued: false, unsafeJobQueued: false, reason: "duplicate_skipped" }
    });
    expect(JSON.stringify(statusBody.registry)).not.toContain("@duplicate_registry_cti");
  });

  test("persists restricted metadata source candidates instead of dropping them into a queue only", async () => {
    const store = new InMemoryScraperStore();
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "http://example.onion/posts", type: "restricted_metadata", tenantId: "tenant_acme" })
    }), { store, frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(202);
    expect(body.request.approvalState).toBe("queued");
    expect(body.source.type).toBe("tor_metadata");
    expect(body.source.status).toBe("candidate");
    expect(body.source.governance).toMatchObject({ approvalRequired: true, approvalState: "pending", metadataOnly: true });
    expect(body.candidate).toMatchObject({
      family: "darkweb_metadata",
      target: "http://example.onion/posts",
      status: "approval_required",
      requestedBy: "api",
      approvalTicket: { status: "open", unsafeScrapingAllowed: false },
      validationResult: { allowed: false, policyGated: true }
    });
    expect(body.policy.collectionMode).toBe("metadata_only");
    expect(store.listSources()).toHaveLength(1);
  });

  test("lets operators inspect validate test and promote a public Telegram candidate", async () => {
    const store = new InMemoryScraperStore();
    const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "@candidate_public_cti", type: "telegram_channel", tenantId: "tenant_acme", activate: false, requestedBy: "analyst-1" })
    }), { store, frontier: new FocusedFrontier() });
    const createdBody = await created.json() as any;

    expect(created.status).toBe(201);
    expect(createdBody.source.status).toBe("candidate");
    expect(createdBody.candidate).toMatchObject({
      sourceId: createdBody.source.id,
      requestedBy: "analyst-1",
      policyBoundary: { noPrivateAccess: true },
      status: "queued"
    });

    const inspect = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "inspect", candidateId: createdBody.candidate.id })
    }), { store, frontier: new FocusedFrontier() });
    const inspected = await inspect.json() as any;
    expect(inspect.status).toBe(200);
    expect(inspected.lifecycle).toMatchObject({
      status: "candidate",
      activationState: "candidate_review",
      parserStatus: "telegram_public_parser_ready"
    });
    expect(inspected.policy.boundary.noPrivateAccess).toBe(true);
    expect(inspected.health.status).toBe("not_tested");
    expect(inspected.parser.profile).toBe("public_channel_handoff");

    const validated = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "validate", sourceId: createdBody.source.id, decidedBy: "analyst-1" })
    }), { store, frontier: new FocusedFrontier() });
    const validatedBody = await validated.json() as any;
    expect(validated.status).toBe(200);
    expect(validatedBody.candidate).toMatchObject({
      status: "validated",
      validationResult: { allowed: true },
      activationDecision: "validated_pending_operator_decision"
    });

    const tested = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "test", sourceId: createdBody.source.id, decidedBy: "analyst-1", reason: "preview parser can read public channel metadata" })
    }), { store, frontier: new FocusedFrontier() });
    const testedBody = await tested.json() as any;
    expect(tested.status).toBe(200);
    expect(testedBody.lifecycle.healthStatus).toBe("public_preview_pass");
    expect(testedBody.candidate).toMatchObject({
      status: "tested",
      healthStatus: "public_preview_pass",
      lastTestedAt: expect.any(String)
    });
    expect(testedBody.lifecycle.audit.map((event: any) => event.action)).toEqual(["validate", "test"]);

    const activated = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "promote", sourceId: createdBody.source.id, approvedBy: "analyst-1" })
    }), { store, frontier: new FocusedFrontier() });
    const activatedBody = await activated.json() as any;
    expect(activated.status).toBe(200);
    expect(activatedBody.source.status).toBe("active");
    expect(activatedBody.candidate).toMatchObject({ status: "active", decidedBy: "analyst-1" });
    expect(activatedBody.lifecycle.activationState).toBe("active_canary");
    expect(activatedBody.collectionTrigger).toMatchObject({
      queued: true,
      queue: "frontier",
      candidateId: createdBody.candidate.id,
      activeSourceId: createdBody.source.id,
      unsafeJobQueued: false,
      parserStatus: "telegram_public_parser_ready",
      policyBoundary: { noPrivateAccess: true }
    });
    expect(activatedBody.collectionTrigger.jobId).toEqual(expect.any(String));
    expect(activatedBody.alertRebuild).toMatchObject({
      queued: false,
      skipped: true,
      reason: "collection_queued_alert_rebuild_waits_for_new_captures",
      contract: { endpoint: "/v1/dwm/alerts/rebuild", requiredAfter: "capture_persisted" }
    });
    const queuedTask = store.getSource(createdBody.source.id)?.metadata.sourceCandidate.collectionTrigger;
    expect(queuedTask).toMatchObject({ queued: true, jobId: activatedBody.collectionTrigger.jobId });
    expect((activatedBody.collectionTrigger.jobId as string).startsWith("task_")).toBe(true);
    expect(store.getSource(createdBody.source.id)?.metadata.sourceRequestAudit).toHaveLength(3);
  });

  test("promoting a public Telegram candidate queues a real frontier collection task", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.saveDwmWatchlist({
      id: "watch_apt29",
      tenantId: "tenant_acme",
      name: "APT29 watchlist",
      terms: [{ value: "APT29", kind: "company" }],
      status: "active",
      createdAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z"
    });
    const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "@queued_public_cti", type: "telegram_channel", tenantId: "tenant_acme", scope: "APT29", activate: false })
    }), { store, frontier });
    const createdBody = await created.json() as any;

    const promoted = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "promote", candidateId: createdBody.candidate.id, approvedBy: "analyst-queue" })
    }), { store, frontier });
    const body = await promoted.json() as any;

    expect(promoted.status).toBe(200);
    expect(body.collectionTrigger).toMatchObject({
      queued: true,
      candidateId: createdBody.candidate.id,
      sourceId: createdBody.source.id,
      activeSourceId: createdBody.source.id,
      policyBoundary: { publicOnly: true },
      parserStatus: "telegram_public_parser_ready"
    });
    expect(frontier.snapshot()).toHaveLength(1);
    expect((frontier.snapshot()[0] as any).task).toMatchObject({
      id: body.collectionTrigger.jobId,
      sourceId: createdBody.source.id,
      sourceType: "telegram_public",
      tenantId: "tenant_acme",
      targetUrl: "https://t.me/queued_public_cti",
      planning: { budgetClass: "source_health_probe", sourceCandidateId: createdBody.candidate.id }
    });
    expect(body.alertRebuild).toMatchObject({ queued: false, skipped: true });

    const observed = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "record_capture",
        candidateId: createdBody.candidate.id,
        collectionTaskId: body.collectionTrigger.jobId,
        captureText: "APT29 public Telegram mention observed in bounded source collection."
      })
    }), { store, frontier });
    const observedBody = await observed.json() as any;
    expect(observed.status).toBe(200);
    expect(observedBody.capture).toMatchObject({
      sourceId: createdBody.source.id,
      taskId: body.collectionTrigger.jobId,
      storageKind: "inline_text",
      sensitive: false,
      metadata: { adapter: "telegram_public", sourceCandidateId: createdBody.candidate.id }
    });
    expect(observedBody.lifecycle).toMatchObject({
      collectionStatus: "capture_observed",
      lastCollectionOutcome: { status: "capture_observed", captureId: observedBody.capture.id }
    });
    expect(observedBody.health.lastCollectionOutcome).toMatchObject({ status: "capture_observed" });
    expect(observedBody.parser.lastCollectionOutcome).toMatchObject({ captureId: observedBody.capture.id });
    expect(observedBody.alertRebuild).toMatchObject({
      requested: true,
      status: "completed",
      alertCount: 1,
      watchlistIds: ["watch_apt29"]
    });
    expect(store.listCaptures()).toHaveLength(1);
    expect(store.listDwmAlerts()).toHaveLength(1);
    expect(store.getSource(createdBody.source.id)?.metadata.sourceCandidate).toMatchObject({
      collectionStatus: "capture_observed",
      lastCaptureId: observedBody.capture.id,
      alertRebuild: { status: "completed", alertCount: 1 }
    });
  });

  test("requires metadata-only approval before restricted source activation", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "metadata://darkweb/akira/claims", type: "restricted_metadata", tenantId: "tenant_acme", priority: "critical", requestedBy: "analyst-1" })
    }), { store, frontier });
    const createdBody = await created.json() as any;
    expect(createdBody.candidate).toMatchObject({
      requestedBy: "analyst-1",
      status: "approval_required",
      approvalTicket: { requiredApproval: "metadata_only", unsafeScrapingAllowed: false }
    });

    const validated = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "validate", candidateId: createdBody.candidate.id, decidedBy: "analyst-1" })
    }), { store, frontier });
    const validatedBody = await validated.json() as any;
    expect(validated.status).toBe(200);
    expect(validatedBody.candidate.validationResult).toMatchObject({ allowed: false, policyGated: true });
    expect(validatedBody.policy.boundary.rawLeakContentBlocked).toBe(true);

    const blocked = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "activate", sourceId: createdBody.source.id, approvedBy: "analyst-1" })
    }), { store, frontier });
    const blockedBody = await blocked.json() as any;
    expect(blocked.status).toBe(409);
    expect(blockedBody.error.code).toBe("metadata_only_approval_required");
    expect(blockedBody.collectionTrigger).toMatchObject({
      queued: false,
      unsafeJobQueued: false,
      reason: "metadata_only_approval_required",
      candidateId: createdBody.candidate.id,
      policyBoundary: { metadataOnly: true }
    });
    expect(blockedBody.alertRebuild).toMatchObject({ queued: false, skipped: true, reason: "metadata_only_approval_required" });
    expect(frontier.snapshot()).toHaveLength(0);
    expect(store.getSource(createdBody.source.id)?.status).toBe("candidate");

    const activated = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "activate",
        sourceId: createdBody.source.id,
        approveMetadataOnly: true,
        approvedBy: "analyst-1",
        reason: "operator approved metadata-only actor coverage"
      })
    }), { store, frontier });
    const activatedBody = await activated.json() as any;
    expect(activated.status).toBe(200);
    expect(activatedBody.source).toMatchObject({
      status: "active",
      accessMethod: "approved_proxy",
      governance: { approvalState: "approved", metadataOnly: true, approvedBy: "analyst-1" }
    });
    expect(activatedBody.candidate).toMatchObject({
      status: "active",
      approvalTicket: { status: "approved", unsafeScrapingAllowed: false }
    });
    expect(activatedBody.collectionTrigger).toMatchObject({
      queued: false,
      unsafeJobQueued: false,
      metadataOnly: true,
      reason: "restricted_metadata_requires_metadata_worker_contract"
    });
    expect(activatedBody.policy).toMatchObject({ allowed: true, collectionMode: "metadata_only" });
    expect(activatedBody.policy.boundary.payloadPathsBlocked).toBe(true);
  });

  test("records restricted metadata captures as metadata-only and can rebuild alerts without unsafe scraping", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.saveDwmWatchlist({
      id: "watch_restricted_apt29",
      tenantId: "tenant_acme",
      name: "APT29 restricted metadata",
      terms: [{ value: "APT29", kind: "company" }],
      status: "active",
      createdAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z"
    });
    const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "metadata://darkweb/apt29/claims", type: "restricted_metadata", tenantId: "tenant_acme", scope: "APT29" })
    }), { store, frontier });
    const createdBody = await created.json() as any;
    const activated = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "activate", candidateId: createdBody.candidate.id, approveMetadataOnly: true, approvedBy: "analyst-1" })
    }), { store, frontier });
    const activatedBody = await activated.json() as any;
    expect(activatedBody.collectionTrigger).toMatchObject({ queued: false, unsafeJobQueued: false, metadataOnly: true });
    expect(frontier.snapshot()).toHaveLength(0);

    const observed = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "record_capture", candidateId: createdBody.candidate.id })
    }), { store, frontier });
    const observedBody = await observed.json() as any;
    expect(observed.status).toBe(200);
    expect(observedBody.capture).toMatchObject({
      sourceId: createdBody.source.id,
      storageKind: "metadata_only",
      sensitive: true,
      metadata: { adapter: "restricted_metadata", sourceCandidateId: createdBody.candidate.id }
    });
    expect(observedBody.capture.body).toBeUndefined();
    expect(observedBody.capture.metadata.provenance).toMatchObject({
      metadataOnly: true,
      policyBoundary: { metadataOnly: true, noDownloads: true }
    });
    expect(observedBody.alertRebuild).toMatchObject({ status: "completed", alertCount: 1 });
    expect(store.listCaptures()).toHaveLength(1);
    expect(store.listDwmAlerts()).toHaveLength(1);
  });

  test("records retry suppress and rejection lifecycle decisions on persisted candidates", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "@rejectable_public_cti", type: "telegram_channel", activate: false })
    }), { store, frontier });
    const createdBody = await created.json() as any;

    const retry = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "retry", sourceId: createdBody.source.id, decidedBy: "analyst-2", reason: "parser timeout recovered" })
    }), { store, frontier });
    const retryBody = await retry.json() as any;
    expect(retry.status).toBe(200);
    expect(retryBody.lifecycle.healthStatus).toBe("retry_scheduled");
    expect(retryBody.candidate.status).toBe("retry_scheduled");
    expect(retryBody.collectionTrigger.queued).toBe(false);

    const suppressed = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "suppress", sourceId: createdBody.source.id, decidedBy: "analyst-2", reason: "duplicate candidate from same channel family" })
    }), { store, frontier });
    const suppressedBody = await suppressed.json() as any;
    expect(suppressed.status).toBe(200);
    expect(suppressedBody.source.status).toBe("suppressed");
    expect(suppressedBody.candidate).toMatchObject({ status: "suppressed", activationDecision: "suppressed_by_operator" });
    expect(suppressedBody.collectionTrigger).toMatchObject({ queued: false, unsafeJobQueued: false });

    const rejected = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "reject", sourceId: createdBody.source.id, decidedBy: "analyst-2", reason: "not relevant to watchlist scope" })
    }), { store, frontier });
    const rejectedBody = await rejected.json() as any;
    expect(rejected.status).toBe(200);
    expect(rejectedBody.source.status).toBe("rejected");
    expect(rejectedBody.collectionTrigger).toMatchObject({ queued: false, unsafeJobQueued: false });
    expect(frontier.snapshot()).toHaveLength(0);
    expect(rejectedBody.lifecycle.audit.map((event: any) => event.action)).toEqual(["retry", "suppress", "reject"]);

    const noCapture = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "record_capture", sourceId: createdBody.source.id, captureText: "APT29 should not be captured from rejected source." })
    }), { store, frontier });
    const noCaptureBody = await noCapture.json() as any;
    expect(noCapture.status).toBe(200);
    expect(noCaptureBody.collectionTrigger).toMatchObject({ queued: false, reason: "source_rejected" });
    expect(noCaptureBody.alertRebuild).toMatchObject({ skipped: true, reason: "source_rejected" });
    expect(store.listCaptures()).toHaveLength(0);
    expect(store.listDwmAlerts()).toHaveLength(0);
  });

  test("records collection parser failures with retry backoff metadata", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "@failure_public_cti", type: "telegram_channel", tenantId: "tenant_acme", scope: "APT29", activate: false })
    }), { store, frontier });
    const createdBody = await created.json() as any;
    const promoted = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "promote", sourceId: createdBody.source.id, approvedBy: "analyst-failure" })
    }), { store, frontier });
    const promotedBody = await promoted.json() as any;

    const failed = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "collection_failed",
        candidateId: createdBody.candidate.id,
        collectionTaskId: promotedBody.collectionTrigger.jobId,
        errorCode: "parser_timeout",
        reason: "Telegram preview parser timed out"
      })
    }), { store, frontier });
    const failedBody = await failed.json() as any;
    expect(failed.status).toBe(200);
    expect(failedBody.lifecycle).toMatchObject({
      collectionStatus: "failed",
      lastCollectionOutcome: { status: "failed", errorCode: "parser_timeout", retryCount: 1 }
    });
    expect(failedBody.health).toMatchObject({
      status: "collection_failed",
      lastError: "parser_timeout"
    });
    expect(failedBody.parser).toMatchObject({
      status: "parser_retry_scheduled",
      retryAfter: expect.any(String),
      warnings: ["Telegram preview parser timed out"]
    });
    expect(store.getSource(createdBody.source.id)?.metadata.sourceCandidate.lastCollectionOutcome).toMatchObject({
      retryCount: 1,
      backoffSeconds: 30
    });
  });

  test("applies dark-web seed packs only when metadata-only approval is explicit", async () => {
    const store = new InMemoryScraperStore();
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        seedPackIds: ["darkweb-actor-metadata-core"],
        activate: true,
        approveMetadataOnly: true,
        approvedBy: "analyst-1",
        limit: 4
      })
    }), { store, frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(201);
    expect(body.summary.darkwebMetadataCreated).toBe(4);
    expect(body.createdCandidates).toHaveLength(4);
    expect(body.createdCandidates.every((candidate: any) => candidate.family === "darkweb_metadata")).toBe(true);
    expect(body.createdCandidates.every((candidate: any) => candidate.policyBoundary.metadataOnly === true)).toBe(true);
    expect(store.listSources()).toHaveLength(4);
    expect(store.listSources().every((source) => source.status === "active")).toBe(true);
    expect(store.listSources().every((source) => source.governance?.metadataOnly === true)).toBe(true);
  });
});
