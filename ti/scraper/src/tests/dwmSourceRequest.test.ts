import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
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
      safeOutput: { liveNetworkScrapeStarted: false }
    });
    expect(statusBody.packStatus.retryBackoff[0]).toMatchObject({
      candidateId: retryCandidate.id,
      errorCode: "parser_timeout",
      backoffSeconds: 30
    });
    expect(statusBody.candidates.find((candidate: any) => candidate.id === publicCandidate.id)).toMatchObject({
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
      queuedForCollectionCount: 0
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
      duplicateOf: existingBody.source.id,
      targetRef: { rawStored: false },
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
