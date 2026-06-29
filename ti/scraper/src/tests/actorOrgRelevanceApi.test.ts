import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest } from "./apiTestHarness.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import type { PublicTiOrgRelevanceProofLike } from "../product/analystHandoff.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("actor org relevance API", () => {
  test("stores a ready actor relevance review with alert, case, webhook, and provenance handoffs", async () => {
    const store = new InMemoryScraperStore();
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/ti/actor-org-relevance", {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({
        tenantId: "tenant_microsoft",
        organizationId: "org_microsoft",
        orgRelevance: readyRelevance(),
        staleEvidenceBefore: "2026-06-01T00:00:00.000Z",
        generatedAt: "2026-06-29T09:30:00.000Z"
      })
    }), { store, frontier: new FocusedFrontier() });
    const payload = await response.json() as any;

    expect(response.status).toBe(201);
    expect(payload.record).toMatchObject({
      schemaVersion: "hanasand.actor_org_relevance.review.v1",
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      actorId: "actor:apt29-microsoft",
      query: "apt29 microsoft",
      state: "ready"
    });
    expect(payload.summary).toMatchObject({
      state: "ready",
      sourceEvidenceCount: 1,
      affected: {
        vendors: ["Microsoft"],
        domains: ["microsoft.com"],
        regions: ["United States"]
      },
      handoffs: { watchlist: true, alertGeneration: true, caseHandoff: true, webhookTrigger: true },
      routes: {
        publicTi: "/ti/apt29%20microsoft",
        watchlist: "/v1/dwm/watchlists",
        alert: "/v1/dwm/alerts/rebuild",
        case: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
        webhook: "/v1/dwm/webhooks/deliver"
      }
    });
    expect(payload.summary.provenance[0]).toMatchObject({
      sourceId: "microsoft",
      captureId: "capture_microsoft_apt29",
      provenance: "https://www.microsoft.com/en-us/security/blog/"
    });
    expect(payload.record.handoff.webhookTrigger.request.body).toMatchObject({
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      alertId: "dwm_alert_microsoft",
      webhookDestinationIds: ["webhook_soc"],
      dryRun: true
    });
  });

  test("lists only the requested organization queue and blocks cross-org detail reads", async () => {
    const store = new InMemoryScraperStore();
    const first = await submit(store, readyRelevance(), "tenant_microsoft", "org_microsoft");
    await submit(store, {
      ...readyRelevance(),
      actorId: "actor:apt29-contoso",
      query: "apt29 contoso",
      organizationRefs: [{
        tenantId: "tenant_contoso",
        organizationId: "org_contoso",
        watchlistId: "watchlist_contoso",
        watchlistItemId: "watch_contoso",
        kind: "domain" as const,
        value: "contoso.com"
      }],
      candidateTerms: [{ kind: "domain" as const, value: "contoso.com", matched: true, sourceEvidenceRefs: ["microsoft"] }],
      alertCaseRefs: [{
        alertId: "dwm_alert_contoso",
        casePath: "/v1/cases/case_contoso_apt29?alertId=dwm_alert_contoso",
        caseIdCandidate: "case_contoso_apt29",
        organizationId: "org_contoso",
        tenantId: "tenant_contoso",
        captureIds: ["capture_microsoft_apt29"],
        webhookDestinationIds: ["webhook_contoso"]
      }]
    }, "tenant_contoso", "org_contoso");

    const listResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/ti/actor-org-relevance?tenantId=tenant_microsoft&organizationId=org_microsoft"), { store, frontier: new FocusedFrontier() });
    const list = await listResponse.json() as any;

    expect(listResponse.status).toBe(200);
    expect(list).toMatchObject({
      schemaVersion: "hanasand.actor_org_relevance.queue.v1",
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      counts: { total: 1, ready: 1, blocked: 0 }
    });
    expect(list.records).toHaveLength(1);
    expect(list.records[0].query).toBe("apt29 microsoft");

    const forbidden = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${first.record.id}?tenantId=tenant_contoso&organizationId=org_contoso`), { store, frontier: new FocusedFrontier() });
    expect(forbidden.status).toBe(404);
  });

  test("lists actor relevance handoff queue states for alert case and webhook work", async () => {
    const store = new InMemoryScraperStore();
    const created = await submit(store, readyRelevance(), "tenant_microsoft", "org_microsoft");
    await submit(store, {
      ...readyRelevance(),
      actorId: "actor:blocked-source",
      query: "blocked source",
      sourceEvidence: [],
      alertCaseRefs: [],
      handoffRows: []
    }, "tenant_microsoft", "org_microsoft");

    const initialResponse = await listHandoffQueue(store, "tenant_microsoft", "org_microsoft", "state=needs_alert_generation&q=Microsoft");
    const initial = await initialResponse.json() as any;
    expect(initialResponse.status).toBe(200);
    expect(initial).toMatchObject({
      schemaVersion: "hanasand.actor_org_relevance.handoff_queue.v1",
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      counts: {
        total: 1,
        needs_alert_generation: 1,
        needs_case_handoff: 0,
        needs_webhook_trigger: 0,
        ready_for_customer: 0,
        blocked: 0
      }
    });
    expect(initial.records[0]).toMatchObject({
      reviewId: created.record.id,
      state: "needs_alert_generation",
      actorId: "actor:apt29-microsoft",
      affected: { vendors: ["Microsoft"] },
      routes: {
        review: `/v1/ti/actor-org-relevance/${created.record.id}`,
        watchlist: `/v1/ti/actor-org-relevance/${created.record.id}/watchlist`,
        alertGeneration: `/v1/ti/actor-org-relevance/${created.record.id}/alert-generation-request`
      }
    });

    const blockedResponse = await listHandoffQueue(store, "tenant_microsoft", "org_microsoft", "state=blocked");
    const blocked = await blockedResponse.json() as any;
    expect(blocked.counts).toMatchObject({ total: 1, blocked: 1 });
    expect(blocked.records[0].state).toBe("blocked");

    await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/watchlist?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ webhookDestinationId: "webhook_soc", generatedAt: "2026-06-29T10:17:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const alertResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/alert-generation-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:18:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const alert = await alertResponse.json() as any;

    const caseQueueResponse = await listHandoffQueue(store, "tenant_microsoft", "org_microsoft", "state=needs_case_handoff");
    const caseQueue = await caseQueueResponse.json() as any;
    expect(caseQueue.counts).toMatchObject({ total: 1, needs_case_handoff: 1 });
    expect(caseQueue.records[0]).toMatchObject({
      state: "needs_case_handoff",
      latestAlertGeneration: { id: alert.receipt.id },
      routes: {
        caseHandoff: `/v1/ti/actor-org-relevance/${created.record.id}/case-handoff-request`
      }
    });

    const caseResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/case-handoff-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:19:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const caseHandoff = await caseResponse.json() as any;

    const webhookQueueResponse = await listHandoffQueue(store, "tenant_microsoft", "org_microsoft", "state=needs_webhook_trigger");
    const webhookQueue = await webhookQueueResponse.json() as any;
    expect(webhookQueue.counts).toMatchObject({ total: 1, needs_webhook_trigger: 1 });
    expect(webhookQueue.records[0]).toMatchObject({
      state: "needs_webhook_trigger",
      latestCaseHandoff: { id: caseHandoff.receipt.id },
      routes: {
        webhookTrigger: `/v1/ti/actor-org-relevance/${created.record.id}/webhook-trigger-request`,
        case: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft"
      }
    });

    const webhookResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/webhook-trigger-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ dryRun: true, generatedAt: "2026-06-29T10:20:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const webhook = await webhookResponse.json() as any;

    const readyResponse = await listHandoffQueue(store, "tenant_microsoft", "org_microsoft", "state=ready_for_customer");
    const ready = await readyResponse.json() as any;
    expect(ready.counts).toMatchObject({ total: 1, ready_for_customer: 1 });
    expect(ready.records[0]).toMatchObject({
      state: "ready_for_customer",
      latestWebhookTrigger: { id: webhook.receipt.id }
    });

    const otherOrgResponse = await listHandoffQueue(store, "tenant_other", "org_other");
    const otherOrg = await otherOrgResponse.json() as any;
    expect(otherOrg.counts.total).toBe(0);
  });

  test("updates workflow state with assignment, notes, decisions, and org isolation", async () => {
    const store = new InMemoryScraperStore();
    const created = await submit(store, readyRelevance(), "tenant_microsoft", "org_microsoft");

    const assigned = await patchWorkflow(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      action: "assign",
      assignedTo: "analyst_mira",
      note: "Review Microsoft exposure against active identity watchlist.",
      generatedAt: "2026-06-29T10:00:00.000Z"
    });
    expect(assigned.summary.workflow).toMatchObject({
      status: "new",
      assignedTo: "analyst_mira",
      updatedBy: "user_ti",
      updatedAt: "2026-06-29T10:00:00.000Z"
    });
    expect(assigned.record.notes).toEqual(expect.arrayContaining([
      expect.objectContaining({ authorId: "user_ti", body: "Review Microsoft exposure against active identity watchlist." })
    ]));
    expect(assigned.record.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "assigned", actorId: "user_ti", summary: "Assigned to analyst_mira." })
    ]));

    const reviewing = await patchWorkflow(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      action: "review",
      generatedAt: "2026-06-29T10:03:00.000Z"
    });
    expect(reviewing.summary.workflow.status).toBe("reviewing");

    const missingRationale = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ action: "close" })
    }), { store, frontier: new FocusedFrontier() });
    expect(missingRationale.status).toBe(400);
    expect(await missingRationale.json()).toMatchObject({ error: { code: "missing_rationale" } });

    const closed = await patchWorkflow(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      action: "close",
      decision: "true_positive",
      rationale: "Related alert and case route are ready for customer review.",
      generatedAt: "2026-06-29T10:06:00.000Z"
    });
    expect(closed.summary.workflow).toMatchObject({
      status: "closed",
      assignedTo: "analyst_mira",
      decision: "true_positive",
      rationale: "Related alert and case route are ready for customer review."
    });
    expect(closed.record.timeline.map((event: any) => event.eventType)).toEqual(expect.arrayContaining(["ready", "assigned", "reviewing", "closed"]));

    const closedQueue = await handleApiRequest(new Request("http://127.0.0.1/v1/ti/actor-org-relevance?tenantId=tenant_microsoft&organizationId=org_microsoft&workflowStatus=closed"), { store, frontier: new FocusedFrontier() });
    const closedList = await closedQueue.json() as any;
    expect(closedList.counts).toMatchObject({ total: 1, closed: 1, assigned: 1 });
    expect(closedList.records[0].workflow).toMatchObject({ status: "closed", assignedTo: "analyst_mira" });

    const forbidden = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}?tenantId=tenant_other&organizationId=org_other`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "assign", assignedTo: "other_analyst" })
    }), { store, frontier: new FocusedFrontier() });
    expect(forbidden.status).toBe(404);
  });

  test("reviews actor relevance source evidence with provenance and audit state", async () => {
    const store = new InMemoryScraperStore();
    const created = await submit(store, readyRelevance(), "tenant_microsoft", "org_microsoft");

    const missingRef = await reviewEvidence(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      status: "reviewed",
      generatedAt: "2026-06-29T10:12:00.000Z"
    });
    expect(missingRef.status).toBe(400);
    expect(await missingRef.json()).toMatchObject({ error: { code: "missing_evidence_ref" } });

    const missingRationale = await reviewEvidence(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      captureId: "capture_microsoft_apt29",
      status: "needs_collection",
      generatedAt: "2026-06-29T10:13:00.000Z"
    });
    expect(missingRationale.status).toBe(400);
    expect(await missingRationale.json()).toMatchObject({ error: { code: "missing_rationale" } });

    const reviewedResponse = await reviewEvidence(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      captureId: "capture_microsoft_apt29",
      status: "reviewed",
      generatedAt: "2026-06-29T10:14:00.000Z"
    });
    const reviewed = await reviewedResponse.json() as any;
    expect(reviewedResponse.status).toBe(200);
    expect(reviewed.changed).toBe(true);
    expect(reviewed.review).toMatchObject({
      status: "reviewed",
      reviewedAt: "2026-06-29T10:14:00.000Z",
      reviewedBy: "user_ti",
      sourceId: "microsoft",
      sourceName: "Microsoft",
      captureId: "capture_microsoft_apt29",
      provenance: "https://www.microsoft.com/en-us/security/blog/",
      confidence: 0.84,
      supportsTerms: ["Microsoft"]
    });
    expect(reviewed.summary.evidenceReviewCounts).toEqual({
      total: 1,
      reviewed: 1,
      disputed: 0,
      needsCollection: 0
    });
    expect(reviewed.summary.workflow).toMatchObject({ status: "reviewing", updatedBy: "user_ti" });
    expect(reviewed.record.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "evidence_reviewed", actorId: "user_ti" })
    ]));

    const duplicateResponse = await reviewEvidence(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      sourceId: "microsoft",
      status: "reviewed",
      generatedAt: "2026-06-29T10:15:00.000Z"
    });
    const duplicate = await duplicateResponse.json() as any;
    expect(duplicateResponse.status).toBe(200);
    expect(duplicate.changed).toBe(false);
    expect(duplicate.review.id).toBe(reviewed.review.id);
    expect(duplicate.record.timeline.filter((event: any) => event.eventType === "evidence_reviewed")).toHaveLength(1);

    const needsCollectionResponse = await reviewEvidence(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      provenance: "https://www.microsoft.com/en-us/security/blog/",
      status: "needs_collection",
      rationale: "Need a fresh capture before customer escalation.",
      generatedAt: "2026-06-29T10:16:00.000Z"
    });
    const needsCollection = await needsCollectionResponse.json() as any;
    expect(needsCollection.changed).toBe(true);
    expect(needsCollection.review).toMatchObject({
      id: reviewed.review.id,
      status: "needs_collection",
      rationale: "Need a fresh capture before customer escalation."
    });
    expect(needsCollection.summary.evidenceReviewCounts).toEqual({
      total: 1,
      reviewed: 0,
      disputed: 0,
      needsCollection: 1
    });

    const unknown = await reviewEvidence(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      captureId: "capture_missing",
      status: "reviewed"
    });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ error: { code: "evidence_not_found" } });

    const forbidden = await reviewEvidence(store, created.record.id, "tenant_other", "org_other", {
      captureId: "capture_microsoft_apt29",
      status: "reviewed"
    });
    expect(forbidden.status).toBe(404);
  });

  test("prepares source collection requests from evidence marked needs collection", async () => {
    const store = new InMemoryScraperStore();
    const created = await submit(store, readyRelevance(), "tenant_microsoft", "org_microsoft");

    const missingReview = await requestSourceCollection(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      captureId: "capture_microsoft_apt29",
      rationale: "Need a fresh capture.",
      generatedAt: "2026-06-29T10:17:00.000Z"
    });
    expect(missingReview.status).toBe(404);
    expect(await missingReview.json()).toMatchObject({ error: { code: "evidence_review_not_found" } });

    const reviewedResponse = await reviewEvidence(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      captureId: "capture_microsoft_apt29",
      status: "reviewed",
      generatedAt: "2026-06-29T10:18:00.000Z"
    });
    const reviewed = await reviewedResponse.json() as any;
    const wrongStatus = await requestSourceCollection(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      evidenceReviewId: reviewed.review.id,
      rationale: "Need a fresh capture.",
      generatedAt: "2026-06-29T10:19:00.000Z"
    });
    expect(wrongStatus.status).toBe(400);
    expect(await wrongStatus.json()).toMatchObject({ error: { code: "evidence_not_marked_for_collection" } });

    const needsCollectionResponse = await reviewEvidence(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      captureId: "capture_microsoft_apt29",
      status: "needs_collection",
      rationale: "Need a fresh capture before customer escalation.",
      generatedAt: "2026-06-29T10:20:00.000Z"
    });
    const needsCollection = await needsCollectionResponse.json() as any;

    const pendingQueueResponse = await listSourceCollectionQueue(store, "tenant_microsoft", "org_microsoft", "state=needs_request&q=Microsoft");
    const pendingQueue = await pendingQueueResponse.json() as any;
    expect(pendingQueueResponse.status).toBe(200);
    expect(pendingQueue).toMatchObject({
      schemaVersion: "hanasand.actor_org_relevance.source_collection_queue.v1",
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      counts: { total: 1, needsRequest: 1, requested: 0 }
    });
    expect(pendingQueue.records).toHaveLength(1);
    expect(pendingQueue.records[0]).toMatchObject({
      reviewId: created.record.id,
      actorId: "actor:apt29-microsoft",
      query: "apt29 microsoft",
      state: "needs_request",
      evidenceReviewId: needsCollection.review.id,
      sourceId: "microsoft",
      sourceName: "Microsoft",
      captureId: "capture_microsoft_apt29",
      provenance: "https://www.microsoft.com/en-us/security/blog/",
      supportsTerms: ["Microsoft"],
      routes: {
        review: `/v1/ti/actor-org-relevance/${created.record.id}`,
        sourceCollectionRequest: `/v1/ti/actor-org-relevance/${created.record.id}/source-collection-request`
      }
    });

    const requestResponse = await requestSourceCollection(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      evidenceReviewId: needsCollection.review.id,
      priority: "high",
      generatedAt: "2026-06-29T10:21:00.000Z"
    });
    const payload = await requestResponse.json() as any;
    expect(requestResponse.status).toBe(201);
    expect(payload.created).toBe(true);
    expect(payload.receipt).toMatchObject({
      schemaVersion: "hanasand.actor_org_relevance.source_collection_request_receipt.v1",
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      reviewId: created.record.id,
      actorId: "actor:apt29-microsoft",
      query: "apt29 microsoft",
      createdBy: "user_ti",
      evidenceReviewId: needsCollection.review.id,
      request: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          tenantId: "tenant_microsoft",
          organizationId: "org_microsoft",
          requestedByUserId: "user_ti",
          sourceId: "microsoft",
          sourceName: "Microsoft",
          captureId: "capture_microsoft_apt29",
          provenance: "https://www.microsoft.com/en-us/security/blog/",
          reason: "Need a fresh capture before customer escalation.",
          priority: "high",
          actorOrgRelevanceReviewId: created.record.id,
          evidenceReviewId: needsCollection.review.id,
          actorId: "actor:apt29-microsoft",
          query: "apt29 microsoft"
        }
      },
      provenance: {
        sourceId: "microsoft",
        sourceName: "Microsoft",
        captureId: "capture_microsoft_apt29",
        provenance: "https://www.microsoft.com/en-us/security/blog/",
        confidence: 0.84,
        supportsTerms: ["Microsoft"]
      }
    });
    expect(payload.summary.latestSourceCollectionRequest.id).toBe(payload.receipt.id);
    expect(payload.record.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "source_collection_requested", actorId: "user_ti" })
    ]));
    expect((store as any).getActorOrgRelevanceReview(created.record.id).sourceCollectionRequests).toHaveLength(1);

    const requestedQueueResponse = await listSourceCollectionQueue(store, "tenant_microsoft", "org_microsoft", "state=requested");
    const requestedQueue = await requestedQueueResponse.json() as any;
    expect(requestedQueue.counts).toEqual({ total: 1, needsRequest: 0, requested: 1 });
    expect(requestedQueue.records[0].latestRequest).toMatchObject({
      id: payload.receipt.id,
      request: {
        method: "POST",
        path: "/v1/dwm/source-requests"
      }
    });

    const duplicateResponse = await requestSourceCollection(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      captureId: "capture_microsoft_apt29",
      priority: "high",
      generatedAt: "2026-06-29T10:22:00.000Z"
    });
    const duplicate = await duplicateResponse.json() as any;
    expect(duplicateResponse.status).toBe(200);
    expect(duplicate.created).toBe(false);
    expect(duplicate.receipt.id).toBe(payload.receipt.id);
    expect(duplicate.record.sourceCollectionRequests).toHaveLength(1);
    expect(duplicate.record.timeline.filter((event: any) => event.eventType === "source_collection_requested")).toHaveLength(1);

    const crossOrgResponse = await requestSourceCollection(store, created.record.id, "tenant_other", "org_other", {
      evidenceReviewId: needsCollection.review.id,
      rationale: "Cross-org request must not work."
    });
    expect(crossOrgResponse.status).toBe(404);

    const forbiddenQueueResponse = await listSourceCollectionQueue(store, "tenant_other", "org_other");
    const forbiddenQueue = await forbiddenQueueResponse.json() as any;
    expect(forbiddenQueue.counts).toEqual({ total: 0, needsRequest: 0, requested: 0 });
  });

  test("materializes a ready actor relevance review into an org DWM watchlist with provenance", async () => {
    const store = new InMemoryScraperStore();
    const created = await submit(store, readyRelevance(), "tenant_microsoft", "org_microsoft");

    const materializedResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/watchlist?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({
        webhookDestinationId: "webhook_soc",
        generatedAt: "2026-06-29T10:20:00.000Z"
      })
    }), { store, frontier: new FocusedFrontier() });
    const materialized = await materializedResponse.json() as any;

    expect(materializedResponse.status).toBe(201);
    expect(materialized.created).toBe(true);
    expect(materialized.changed).toBe(true);
    expect(materialized.watchlist).toMatchObject({
      id: "watchlist_microsoft",
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      source: "public_ti_actor_org_relevance",
      actorOrgRelevanceReviewId: created.record.id,
      actorId: "actor:apt29-microsoft",
      query: "apt29 microsoft",
      webhookDestinationId: "webhook_soc",
      terms: [{ kind: "company", value: "Microsoft" }]
    });
    expect(materialized.watchlist.provenance).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: "microsoft",
        sourceName: "Microsoft",
        captureId: "capture_microsoft_apt29",
        provenance: "https://www.microsoft.com/en-us/security/blog/"
      })
    ]));
    expect((store as any).getDwmWatchlist("watchlist_microsoft")).toMatchObject({
      id: "watchlist_microsoft",
      source: "public_ti_actor_org_relevance",
      actorOrgRelevanceReviewId: created.record.id
    });
    expect(materialized.record.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "watchlist_materialized", actorId: "user_ti" })
    ]));
    expect(materialized.summary.workflow).toMatchObject({ status: "reviewing", updatedBy: "user_ti" });

    const idempotentResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/watchlist?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:21:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const idempotent = await idempotentResponse.json() as any;
    expect(idempotentResponse.status).toBe(200);
    expect(idempotent.created).toBe(false);
    expect(idempotent.changed).toBe(false);
    expect(idempotent.watchlist.createdAt).toBe("2026-06-29T10:20:00.000Z");
    expect(idempotent.watchlist.updatedAt).toBe("2026-06-29T10:20:00.000Z");
    expect(idempotent.record.timeline.filter((event: any) => event.eventType === "watchlist_materialized")).toHaveLength(1);
  });

  test("blocks watchlist materialization for blocked reviews and other organization scopes", async () => {
    const store = new InMemoryScraperStore();
    const blocked = await submit(store, {
      ...readyRelevance(),
      sourceEvidence: [],
      alertCaseRefs: [],
      handoffRows: []
    }, "tenant_microsoft", "org_microsoft");
    const blockedResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${blocked.record.id}/watchlist?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    }), { store, frontier: new FocusedFrontier() });
    expect(blockedResponse.status).toBe(400);
    expect(await blockedResponse.json()).toMatchObject({ error: { code: "review_not_ready" } });

    const ready = await submit(store, readyRelevance(), "tenant_microsoft", "org_microsoft");
    const crossOrgResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${ready.record.id}/watchlist?tenantId=tenant_other&organizationId=org_other`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    }), { store, frontier: new FocusedFrontier() });
    expect(crossOrgResponse.status).toBe(404);

    (store as any).saveDwmWatchlist({
      id: "watchlist_microsoft",
      tenantId: "tenant_other",
      organizationId: "org_other",
      name: "Other org watchlist",
      terms: [{ kind: "company", value: "Other" }],
      status: "active",
      createdAt: "2026-06-29T00:00:00.000Z",
      updatedAt: "2026-06-29T00:00:00.000Z"
    });
    const conflictResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${ready.record.id}/watchlist?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    }), { store, frontier: new FocusedFrontier() });
    expect(conflictResponse.status).toBe(409);
    expect(await conflictResponse.json()).toMatchObject({ error: { code: "watchlist_scope_mismatch" } });
  });

  test("persists alert generation request receipts after watchlist materialization", async () => {
    const store = new InMemoryScraperStore();
    const created = await submit(store, readyRelevance(), "tenant_microsoft", "org_microsoft");

    const missingWatchlistResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/alert-generation-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:24:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    expect(missingWatchlistResponse.status).toBe(400);
    expect(await missingWatchlistResponse.json()).toMatchObject({ error: { code: "missing_watchlist_materialization" } });

    await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/watchlist?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({
        webhookDestinationId: "webhook_soc",
        generatedAt: "2026-06-29T10:25:00.000Z"
      })
    }), { store, frontier: new FocusedFrontier() });

    const receiptResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/alert-generation-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:26:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const payload = await receiptResponse.json() as any;

    expect(receiptResponse.status).toBe(201);
    expect(payload.created).toBe(true);
    expect(payload.receipt).toMatchObject({
      schemaVersion: "hanasand.actor_org_relevance.alert_generation_receipt.v1",
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      reviewId: created.record.id,
      actorId: "actor:apt29-microsoft",
      query: "apt29 microsoft",
      createdBy: "user_ti",
      request: {
        method: "POST",
        path: "/v1/dwm/alerts/rebuild",
        body: {
          tenantId: "tenant_microsoft",
          organizationId: "org_microsoft",
          watchlistId: "watchlist_microsoft",
          watchlistItemIds: ["watch_microsoft"],
          actorOrgRelevanceReviewId: created.record.id
        }
      },
      watchlist: {
        id: "watchlist_microsoft",
        terms: [{ kind: "company", value: "Microsoft" }],
        provenanceCount: 1
      },
      downstream: {
        casePath: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
        webhookDestinationIds: ["webhook_soc"],
        captureIds: ["capture_microsoft_apt29"],
        sourceIds: ["microsoft"]
      }
    });
    expect(payload.receipt.idempotencyKey).toContain("actor_org_relevance_alert_generation_idempotency_");
    expect(payload.receipt.provenance).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: "microsoft", captureId: "capture_microsoft_apt29" })
    ]));
    expect(payload.summary.latestAlertGeneration.id).toBe(payload.receipt.id);
    expect(payload.record.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "alert_generation_requested", actorId: "user_ti" })
    ]));
    expect((store as any).getActorOrgRelevanceReview(created.record.id).alertGenerationReceipts).toHaveLength(1);

    const duplicateResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/alert-generation-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:27:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const duplicate = await duplicateResponse.json() as any;
    expect(duplicateResponse.status).toBe(200);
    expect(duplicate.created).toBe(false);
    expect(duplicate.receipt.id).toBe(payload.receipt.id);
    expect(duplicate.receipt.idempotencyKey).toBe(payload.receipt.idempotencyKey);
    expect(duplicate.record.alertGenerationReceipts).toHaveLength(1);
    expect(duplicate.record.timeline.filter((event: any) => event.eventType === "alert_generation_requested")).toHaveLength(1);
    expect((store as any).getActorOrgRelevanceReview(created.record.id).alertGenerationReceipts).toHaveLength(1);

    const crossOrgResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/alert-generation-request?tenantId=tenant_other&organizationId=org_other`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    }), { store, frontier: new FocusedFrontier() });
    expect(crossOrgResponse.status).toBe(404);
  });

  test("persists case handoff receipts after alert-generation readiness", async () => {
    const store = new InMemoryScraperStore();
    const created = await submit(store, readyRelevance(), "tenant_microsoft", "org_microsoft");

    const premature = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/case-handoff-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:27:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    expect(premature.status).toBe(400);
    expect(await premature.json()).toMatchObject({ error: { code: "missing_alert_generation_receipt" } });

    await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/watchlist?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({
        webhookDestinationId: "webhook_soc",
        generatedAt: "2026-06-29T10:28:00.000Z"
      })
    }), { store, frontier: new FocusedFrontier() });
    const alertResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/alert-generation-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:29:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const alertPayload = await alertResponse.json() as any;

    const caseResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/case-handoff-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:30:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const payload = await caseResponse.json() as any;

    expect(caseResponse.status).toBe(201);
    expect(payload.created).toBe(true);
    expect(payload.receipt).toMatchObject({
      schemaVersion: "hanasand.actor_org_relevance.case_handoff_receipt.v1",
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      reviewId: created.record.id,
      actorId: "actor:apt29-microsoft",
      query: "apt29 microsoft",
      createdBy: "user_ti",
      alertGenerationReceiptId: alertPayload.receipt.id,
      request: {
        method: "POST",
        path: "/v1/cases",
        body: {
          tenantId: "tenant_microsoft",
          organizationId: "org_microsoft",
          alertId: "dwm_alert_microsoft",
          caseIdCandidate: "case_microsoft_apt29",
          casePath: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
          actorOrgRelevanceReviewId: created.record.id,
          alertGenerationReceiptId: alertPayload.receipt.id
        }
      },
      routing: {
        casePath: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
        alertId: "dwm_alert_microsoft",
        recommendedRoute: "analyst_review",
        priority: "high"
      },
      provenance: {
        captureIds: ["capture_microsoft_apt29"],
        sourceIds: ["microsoft"],
        sourceFamilies: ["public_advisory"],
        evidenceCount: 1
      }
    });
    expect(payload.receipt.idempotencyKey).toContain("actor_org_relevance_case_handoff_idempotency_");
    expect(payload.summary.latestCaseHandoff.id).toBe(payload.receipt.id);
    expect(payload.record.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "case_handoff_requested", actorId: "user_ti" })
    ]));
    expect((store as any).getActorOrgRelevanceReview(created.record.id).caseHandoffReceipts).toHaveLength(1);

    const duplicateResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/case-handoff-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:31:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const duplicate = await duplicateResponse.json() as any;
    expect(duplicateResponse.status).toBe(200);
    expect(duplicate.created).toBe(false);
    expect(duplicate.receipt.id).toBe(payload.receipt.id);
    expect(duplicate.receipt.idempotencyKey).toBe(payload.receipt.idempotencyKey);
    expect(duplicate.record.caseHandoffReceipts).toHaveLength(1);
    expect(duplicate.record.timeline.filter((event: any) => event.eventType === "case_handoff_requested")).toHaveLength(1);
    expect((store as any).getActorOrgRelevanceReview(created.record.id).caseHandoffReceipts).toHaveLength(1);

    const crossOrgResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/case-handoff-request?tenantId=tenant_other&organizationId=org_other`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    }), { store, frontier: new FocusedFrontier() });
    expect(crossOrgResponse.status).toBe(404);
  });

  test("persists webhook trigger receipts after case handoff readiness", async () => {
    const store = new InMemoryScraperStore();
    const created = await submit(store, readyRelevance(), "tenant_microsoft", "org_microsoft");

    const premature = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/webhook-trigger-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:31:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    expect(premature.status).toBe(400);
    expect(await premature.json()).toMatchObject({ error: { code: "missing_case_handoff_receipt" } });

    await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/watchlist?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ webhookDestinationId: "webhook_soc", generatedAt: "2026-06-29T10:32:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/alert-generation-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:33:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const caseResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/case-handoff-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:34:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const casePayload = await caseResponse.json() as any;

    const webhookResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/webhook-trigger-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ dryRun: true, generatedAt: "2026-06-29T10:35:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const payload = await webhookResponse.json() as any;

    expect(webhookResponse.status).toBe(201);
    expect(payload.created).toBe(true);
    expect(payload.receipt).toMatchObject({
      schemaVersion: "hanasand.actor_org_relevance.webhook_trigger_receipt.v1",
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      reviewId: created.record.id,
      actorId: "actor:apt29-microsoft",
      query: "apt29 microsoft",
      createdBy: "user_ti",
      caseHandoffReceiptId: casePayload.receipt.id,
      request: {
        method: "POST",
        path: "/v1/dwm/webhooks/deliver",
        body: {
          tenantId: "tenant_microsoft",
          organizationId: "org_microsoft",
          alertId: "dwm_alert_microsoft",
          webhookDestinationIds: ["webhook_soc"],
          captureIds: ["capture_microsoft_apt29"],
          evidenceCount: 1,
          dryRun: true,
          actorOrgRelevanceReviewId: created.record.id,
          caseHandoffReceiptId: casePayload.receipt.id
        }
      },
      destination: {
        webhookDestinationIds: ["webhook_soc"],
        dryRun: true
      },
      provenance: {
        alertId: "dwm_alert_microsoft",
        captureIds: ["capture_microsoft_apt29"],
        evidenceCount: 1,
        casePath: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
        sourceIds: ["microsoft"],
        sourceFamilies: ["public_advisory"]
      }
    });
    expect(payload.receipt.idempotencyKey).toContain("actor_org_relevance_webhook_trigger_idempotency_");
    expect(payload.summary.latestWebhookTrigger.id).toBe(payload.receipt.id);
    expect(payload.record.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "webhook_trigger_prepared", actorId: "user_ti" })
    ]));
    expect((store as any).getActorOrgRelevanceReview(created.record.id).webhookTriggerReceipts).toHaveLength(1);

    const duplicateResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/webhook-trigger-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ dryRun: true, generatedAt: "2026-06-29T10:36:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const duplicate = await duplicateResponse.json() as any;
    expect(duplicateResponse.status).toBe(200);
    expect(duplicate.created).toBe(false);
    expect(duplicate.receipt.id).toBe(payload.receipt.id);
    expect(duplicate.receipt.idempotencyKey).toBe(payload.receipt.idempotencyKey);
    expect(duplicate.record.webhookTriggerReceipts).toHaveLength(1);
    expect(duplicate.record.timeline.filter((event: any) => event.eventType === "webhook_trigger_prepared")).toHaveLength(1);
    expect((store as any).getActorOrgRelevanceReview(created.record.id).webhookTriggerReceipts).toHaveLength(1);

    const crossOrgResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/webhook-trigger-request?tenantId=tenant_other&organizationId=org_other`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    }), { store, frontier: new FocusedFrontier() });
    expect(crossOrgResponse.status).toBe(404);
  });

  test("cancels prepared handoffs in dependency order with audit metadata", async () => {
    const store = new InMemoryScraperStore();
    const created = await submit(store, readyRelevance(), "tenant_microsoft", "org_microsoft");
    await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/watchlist?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ webhookDestinationId: "webhook_soc", generatedAt: "2026-06-29T10:40:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const alertResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/alert-generation-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:41:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const alert = await alertResponse.json() as any;
    const caseResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/case-handoff-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:42:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const caseHandoff = await caseResponse.json() as any;
    const webhookResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/webhook-trigger-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ dryRun: true, generatedAt: "2026-06-29T10:43:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const webhook = await webhookResponse.json() as any;

    const missingRationale = await cancelPreparedHandoff(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      target: "webhook_trigger",
      receiptId: webhook.receipt.id
    });
    expect(missingRationale.status).toBe(400);
    expect(await missingRationale.json()).toMatchObject({ error: { code: "missing_rationale" } });

    const activeCaseBlock = await cancelPreparedHandoff(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      target: "alert_generation",
      receiptId: alert.receipt.id,
      rationale: "Wrong organization route.",
      generatedAt: "2026-06-29T10:44:00.000Z"
    });
    expect(activeCaseBlock.status).toBe(409);
    expect(await activeCaseBlock.json()).toMatchObject({ error: { code: "dependent_case_handoff_active" } });

    const activeWebhookBlock = await cancelPreparedHandoff(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      target: "case_handoff",
      receiptId: caseHandoff.receipt.id,
      rationale: "Wrong organization route.",
      generatedAt: "2026-06-29T10:45:00.000Z"
    });
    expect(activeWebhookBlock.status).toBe(409);
    expect(await activeWebhookBlock.json()).toMatchObject({ error: { code: "dependent_webhook_trigger_active" } });

    const cancelledWebhookResponse = await cancelPreparedHandoff(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      target: "webhook_trigger",
      receiptId: webhook.receipt.id,
      rationale: "Wrong destination for this customer.",
      generatedAt: "2026-06-29T10:46:00.000Z"
    });
    const cancelledWebhook = await cancelledWebhookResponse.json() as any;
    expect(cancelledWebhookResponse.status).toBe(200);
    expect(cancelledWebhook.cancelled).toBe(true);
    expect(cancelledWebhook.receipt.cancellation).toMatchObject({
      cancelledAt: "2026-06-29T10:46:00.000Z",
      cancelledBy: "user_ti",
      rationale: "Wrong destination for this customer."
    });
    expect(cancelledWebhook.summary.latestWebhookTrigger).toBeUndefined();
    expect(cancelledWebhook.record.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "webhook_trigger_cancelled", actorId: "user_ti" })
    ]));

    const duplicateCancelResponse = await cancelPreparedHandoff(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      target: "webhook_trigger",
      receiptId: webhook.receipt.id,
      rationale: "Wrong destination for this customer.",
      generatedAt: "2026-06-29T10:47:00.000Z"
    });
    const duplicateCancel = await duplicateCancelResponse.json() as any;
    expect(duplicateCancelResponse.status).toBe(200);
    expect(duplicateCancel.cancelled).toBe(false);
    expect(duplicateCancel.record.timeline.filter((event: any) => event.eventType === "webhook_trigger_cancelled")).toHaveLength(1);

    const cancelledCaseResponse = await cancelPreparedHandoff(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      target: "case_handoff",
      receiptId: caseHandoff.receipt.id,
      rationale: "Case owner requested a new handoff.",
      generatedAt: "2026-06-29T10:48:00.000Z"
    });
    const cancelledCase = await cancelledCaseResponse.json() as any;
    expect(cancelledCase.summary.latestCaseHandoff).toBeUndefined();
    expect(cancelledCase.record.caseHandoffReceipts[0].cancellation.rationale).toBe("Case owner requested a new handoff.");

    const cancelledAlertResponse = await cancelPreparedHandoff(store, created.record.id, "tenant_microsoft", "org_microsoft", {
      target: "alert_generation",
      receiptId: alert.receipt.id,
      rationale: "Watchlist term was replaced.",
      generatedAt: "2026-06-29T10:49:00.000Z"
    });
    const cancelledAlert = await cancelledAlertResponse.json() as any;
    expect(cancelledAlert.summary.latestAlertGeneration).toBeUndefined();
    expect(cancelledAlert.record.alertGenerationReceipts[0].cancellation.rationale).toBe("Watchlist term was replaced.");

    const rebuiltAlertResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}/alert-generation-request?tenantId=tenant_microsoft&organizationId=org_microsoft`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
      body: JSON.stringify({ generatedAt: "2026-06-29T10:50:00.000Z" })
    }), { store, frontier: new FocusedFrontier() });
    const rebuiltAlert = await rebuiltAlertResponse.json() as any;
    expect(rebuiltAlertResponse.status).toBe(201);
    expect(rebuiltAlert.created).toBe(true);
    expect(rebuiltAlert.receipt.id).not.toBe(alert.receipt.id);
    expect(rebuiltAlert.summary.latestAlertGeneration.id).toBe(rebuiltAlert.receipt.id);
    expect(rebuiltAlert.record.alertGenerationReceipts).toHaveLength(2);
    expect(rebuiltAlert.record.alertGenerationReceipts[0].cancellation.rationale).toBe("Watchlist term was replaced.");

    const crossOrgResponse = await cancelPreparedHandoff(store, created.record.id, "tenant_other", "org_other", {
      target: "webhook_trigger",
      receiptId: webhook.receipt.id,
      rationale: "Cross-org cancellation must not work."
    });
    expect(crossOrgResponse.status).toBe(404);
  });

  test("turns missing evidence into owner actions instead of a generic teaser state", async () => {
    const store = new InMemoryScraperStore();
    const payload = await submit(store, {
      ...readyRelevance(),
      sourceEvidence: [],
      sourceCoverage: [],
      alertCaseRefs: [],
      handoffRows: [],
      freshness: {
        generatedAt: "2026-06-29T08:00:00.000Z",
        lastSeen: "2026-01-01T00:00:00.000Z",
        stale: true,
        reason: "Old source."
      }
    }, "tenant_microsoft", "org_microsoft");

    expect(payload.record.state).toBe("blocked");
    expect(payload.summary.blockerCodes).toEqual(expect.arrayContaining([
      "missing_provenance",
      "stale_evidence",
      "absent_alert_id",
      "missing_case_route",
      "missing_webhook_destination"
    ]));
    expect(payload.summary.nextActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerLane: "source", route: "/dashboard/ti/enrichment" }),
      expect.objectContaining({ ownerLane: "alert", route: "/dashboard/dwm" }),
      expect.objectContaining({ ownerLane: "case", route: "/v1/cases" }),
      expect.objectContaining({ ownerLane: "webhook", route: "/dashboard/dwm" })
    ]));
    for (const phrase of ["control room", "how this feeds", "signal", "named examples", "dashboard slop", "acceptance criteria"]) {
      expect(JSON.stringify(payload).toLowerCase()).not.toContain(phrase);
    }
  });

  test("persists actor relevance reviews through the file-backed scraper store", async () => {
    const dir = mkdtempSync(join(tmpdir(), "actor-org-relevance-"));
    try {
      const snapshotPath = join(dir, "store.json");
      const store = new FileBackedScraperStore({ snapshotPath });
      const created = await submit(store, readyRelevance(), "tenant_microsoft", "org_microsoft");
      await patchWorkflow(store, created.record.id, "tenant_microsoft", "org_microsoft", {
        action: "escalate",
        assignedTo: "analyst_mira",
        note: "Escalate to identity response owner.",
        generatedAt: "2026-06-29T10:10:00.000Z"
      });

      const rehydrated = new FileBackedScraperStore({ snapshotPath });
      const detailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${created.record.id}?tenantId=tenant_microsoft&organizationId=org_microsoft`), { store: rehydrated, frontier: new FocusedFrontier() });
      const detail = await detailResponse.json() as any;

      expect(detailResponse.status).toBe(200);
      expect(detail.record.id).toBe(created.record.id);
      expect(detail.record.timeline).toEqual(expect.arrayContaining([
        expect.objectContaining({ eventType: "ready", blockerCodes: [] }),
        expect.objectContaining({ eventType: "escalated", actorId: "user_ti" })
      ]));
      expect(detail.summary.workflow).toMatchObject({ status: "escalated", updatedBy: "user_ti" });
      expect(detail.record.notes).toEqual(expect.arrayContaining([
        expect.objectContaining({ body: "Escalate to identity response owner." })
      ]));
      expect(detail.summary.routes.case).toBe("/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

async function submit(store: InMemoryScraperStore | FileBackedScraperStore, orgRelevance: PublicTiOrgRelevanceProofLike, tenantId: string, organizationId: string) {
  const response = await handleApiRequest(new Request("http://127.0.0.1/v1/ti/actor-org-relevance", {
    method: "POST",
    headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
    body: JSON.stringify({
      tenantId,
      organizationId,
      orgRelevance,
      staleEvidenceBefore: "2026-06-01T00:00:00.000Z",
      generatedAt: "2026-06-29T09:30:00.000Z"
    })
  }), { store, frontier: new FocusedFrontier() });
  expect(response.status).toBeLessThan(300);
  return await response.json() as any;
}

async function patchWorkflow(store: InMemoryScraperStore | FileBackedScraperStore, id: string, tenantId: string, organizationId: string, body: Record<string, unknown>) {
  const response = await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${id}?tenantId=${tenantId}&organizationId=${organizationId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
    body: JSON.stringify(body)
  }), { store, frontier: new FocusedFrontier() });
  expect(response.status).toBe(200);
  return await response.json() as any;
}

async function cancelPreparedHandoff(store: InMemoryScraperStore | FileBackedScraperStore, id: string, tenantId: string, organizationId: string, body: Record<string, unknown>) {
  return await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${id}/cancel-prepared-handoff?tenantId=${tenantId}&organizationId=${organizationId}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
    body: JSON.stringify(body)
  }), { store, frontier: new FocusedFrontier() });
}

async function reviewEvidence(store: InMemoryScraperStore | FileBackedScraperStore, id: string, tenantId: string, organizationId: string, body: Record<string, unknown>) {
  return await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${id}/evidence-review?tenantId=${tenantId}&organizationId=${organizationId}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
    body: JSON.stringify(body)
  }), { store, frontier: new FocusedFrontier() });
}

async function requestSourceCollection(store: InMemoryScraperStore | FileBackedScraperStore, id: string, tenantId: string, organizationId: string, body: Record<string, unknown>) {
  return await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/${id}/source-collection-request?tenantId=${tenantId}&organizationId=${organizationId}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-actor-id": "user_ti" },
    body: JSON.stringify(body)
  }), { store, frontier: new FocusedFrontier() });
}

async function listSourceCollectionQueue(store: InMemoryScraperStore | FileBackedScraperStore, tenantId: string, organizationId: string, query = "") {
  const suffix = query ? `&${query}` : "";
  return await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/source-collection-queue?tenantId=${tenantId}&organizationId=${organizationId}${suffix}`), {
    store,
    frontier: new FocusedFrontier()
  });
}

async function listHandoffQueue(store: InMemoryScraperStore | FileBackedScraperStore, tenantId: string, organizationId: string, query = "") {
  const suffix = query ? `&${query}` : "";
  return await handleApiRequest(new Request(`http://127.0.0.1/v1/ti/actor-org-relevance/handoff-queue?tenantId=${tenantId}&organizationId=${organizationId}${suffix}`), {
    store,
    frontier: new FocusedFrontier()
  });
}

function readyRelevance(): PublicTiOrgRelevanceProofLike {
  return {
    schemaVersion: "ti.public_actor.org_relevance.v1",
    state: "ready",
    actorId: "actor:apt29-microsoft",
    query: "apt29 microsoft",
    generatedAt: "2026-06-29T08:00:00.000Z",
    actorIdentity: {
      canonicalName: "APT29",
      aliases: ["Midnight Blizzard", "Nobelium"],
      actorClass: "State-linked espionage actor",
      sectors: ["Technology"],
      regions: ["United States"],
      motivations: ["Strategic intelligence collection"]
    },
    freshness: {
      generatedAt: "2026-06-29T08:00:00.000Z",
      lastSeen: "2026-06-29T00:00:00.000Z",
      stale: false,
      reason: "Fresh source evidence is attached."
    },
    sourceCoverage: [{
      sourceId: "microsoft",
      sourceName: "Microsoft",
      sourceFamily: "vendor_disclosure",
      status: "active",
      lastCollectedAt: "2026-06-29T00:00:00.000Z",
      coverage: "primary",
      captureIds: ["capture_microsoft_apt29"]
    }],
    organizationRefs: [{
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      watchlistId: "watchlist_microsoft",
      watchlistItemId: "watch_microsoft",
      kind: "company" as const,
      value: "Microsoft",
      route: "organization_watchlist",
      casePath: "/dashboard/dwm?organizationId=org_microsoft&watchlistItemId=watch_microsoft"
    }],
    candidateTerms: [{
      kind: "company" as const,
      value: "Microsoft",
      notes: "Source reporting names Microsoft identity activity.",
      matched: true,
      sourceEvidenceRefs: ["microsoft", "capture_microsoft_apt29", "https://www.microsoft.com/en-us/security/blog/"]
    }],
    sourceEvidence: [{
      sourceId: "microsoft",
      sourceName: "Microsoft",
      provenance: "https://www.microsoft.com/en-us/security/blog/",
      captureId: "capture_microsoft_apt29",
      confidence: 0.84,
      supportsTerms: ["Microsoft"]
    }],
    alertCaseRefs: [{
      alertId: "dwm_alert_microsoft",
      casePath: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
      caseIdCandidate: "case_microsoft_apt29",
      organizationId: "org_microsoft",
      tenantId: "tenant_microsoft",
      captureIds: ["capture_microsoft_apt29"],
      webhookDestinationIds: ["webhook_soc"]
    }],
    affectedEntities: {
      vendors: [{
        value: "Microsoft",
        matched: true,
        provenanceRefs: ["microsoft", "capture_microsoft_apt29"],
        watchlistItemIds: ["watch_microsoft"],
        alertIds: ["dwm_alert_microsoft"]
      }],
      domains: [{
        value: "microsoft.com",
        matched: false,
        provenanceRefs: ["capture_microsoft_apt29"],
        watchlistItemIds: [],
        alertIds: ["dwm_alert_microsoft"]
      }],
      regions: [{
        value: "United States",
        matched: false,
        provenanceRefs: ["capture_microsoft_apt29"],
        watchlistItemIds: [],
        alertIds: ["dwm_alert_microsoft"]
      }]
    },
    handoffRows: [{
      rowId: "watchlist:watch_microsoft",
      kind: "watchlist_match",
      state: "ready",
      ownerLane: "org",
      label: "Microsoft",
      action: "Open saved watchlist item",
      route: "/dashboard/dwm",
      sourceFamily: "watchlist",
      provenanceRefs: ["watchlist_microsoft", "watch_microsoft"],
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      watchlistId: "watchlist_microsoft",
      watchlistItemId: "watch_microsoft",
      captureIds: [],
      webhookDestinationIds: [],
      blockers: []
    }, {
      rowId: "source:microsoft:capture_microsoft_apt29",
      kind: "source_evidence",
      state: "ready",
      ownerLane: "source",
      label: "Microsoft",
      action: "Use capture as evidence",
      route: "/dashboard/ti/enrichment",
      sourceFamily: "vendor_disclosure",
      provenanceRefs: ["microsoft", "capture_microsoft_apt29", "https://www.microsoft.com/en-us/security/blog/"],
      captureIds: ["capture_microsoft_apt29"],
      webhookDestinationIds: [],
      blockers: []
    }, {
      rowId: "alert:dwm_alert_microsoft",
      kind: "alert_case",
      state: "ready",
      ownerLane: "case",
      label: "dwm_alert_microsoft",
      action: "Open related case",
      route: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
      sourceFamily: "case",
      provenanceRefs: ["dwm_alert_microsoft", "case_microsoft_apt29", "capture_microsoft_apt29"],
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      alertId: "dwm_alert_microsoft",
      casePath: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
      captureIds: ["capture_microsoft_apt29"],
      webhookDestinationIds: ["webhook_soc"],
      blockers: []
    }, {
      rowId: "webhook:dwm_alert_microsoft",
      kind: "webhook_delivery",
      state: "ready",
      ownerLane: "webhook",
      label: "dwm_alert_microsoft",
      action: "Prepare delivery dry run",
      route: "/v1/dwm/webhooks/deliver",
      sourceFamily: "webhook",
      provenanceRefs: ["dwm_alert_microsoft", "capture_microsoft_apt29", "webhook_soc"],
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      alertId: "dwm_alert_microsoft",
      casePath: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
      captureIds: ["capture_microsoft_apt29"],
      webhookDestinationIds: ["webhook_soc"],
      blockers: []
    }],
    blockers: []
  };
}
