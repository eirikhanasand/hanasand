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
