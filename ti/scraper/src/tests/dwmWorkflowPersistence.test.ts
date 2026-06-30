import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir } from "./apiTestHarness.ts";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { orgWatchlistContractToRuntimeDwmWatchlists } from "../storage/dwmOrgWatchlistBridge.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const source: SourceRecord = {
  id: "src_tg_workflow",
  name: "Workflow public Telegram",
  type: "telegram_public",
  url: "https://t.me/workflow_public",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.8,
  legalNotes: "Public preview only.",
  createdAt: "2026-06-27T21:00:00.000Z",
  updatedAt: "2026-06-27T21:00:00.000Z"
} as SourceRecord;

const capture: RawCapture = {
  id: "cap_workflow_acme",
  sourceId: source.id,
  url: "https://t.me/workflow_public/42",
  collectedAt: "2026-06-27T21:02:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-workflow-acme",
  sensitive: false,
  body: "acme.com mentioned in Lumma C2 public Telegram chatter with Okta session cookie and AWS IAM key hints.",
  metadata: { adapter: "telegram_public", channel: "workflow_public", messageId: 42 }
} as RawCapture;

const followupCapture: RawCapture = {
  id: "cap_workflow_acme_followup",
  sourceId: source.id,
  url: "https://t.me/workflow_public/43",
  collectedAt: "2026-06-27T21:07:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-workflow-acme-followup",
  sensitive: false,
  body: "Follow-up public Telegram post repeats acme.com Okta session cookie and AWS IAM key claims.",
  metadata: { adapter: "telegram_public", channel: "workflow_public", messageId: 43 }
} as RawCapture;

const duplicateCapture: RawCapture = {
  ...capture,
  id: "cap_workflow_acme_duplicate",
  url: "https://t.me/workflow_public/42?mirror=1",
  collectedAt: "2026-06-27T21:09:00.000Z"
} as RawCapture;

const darkwebSource: SourceRecord = {
  id: "src_workflow_onion",
  name: "Workflow onion metadata",
  type: "tor_metadata",
  url: "http://workflow-example.onion",
  accessMethod: "approved_proxy",
  status: "active",
  trustScore: 0.78,
  legalNotes: "Metadata-only onion source.",
  createdAt: "2026-06-27T21:00:00.000Z",
  updatedAt: "2026-06-27T21:00:00.000Z"
} as SourceRecord;

const darkwebCapture: RawCapture = {
  id: "cap_workflow_onion_acme",
  sourceId: darkwebSource.id,
  url: "http://workflow-example.onion/acme",
  collectedAt: "2026-06-27T21:04:00.000Z",
  mediaType: "text/plain",
  storageKind: "metadata_only",
  contentHash: "hash-workflow-onion-acme",
  sensitive: true,
  metadata: {
    adapter: "darknet_metadata",
    leakSite: {
      actorName: "Akira",
      victimName: "acme.com",
      description: "Metadata-only onion page claims acme.com procurement exports.",
      captureMode: "metadata_only"
    }
  }
} as RawCapture;

const darkwebFollowupCapture: RawCapture = {
  ...darkwebCapture,
  id: "cap_workflow_onion_acme_followup",
  url: "http://workflow-example.onion/acme-followup",
  collectedAt: "2026-06-27T21:12:00.000Z",
  contentHash: "hash-workflow-onion-acme-followup",
  metadata: {
    adapter: "darknet_metadata",
    leakSite: {
      actorName: "Akira",
      victimName: "acme.com",
      description: "Follow-up metadata-only onion page repeats acme.com procurement export claims.",
      captureMode: "metadata_only"
    }
  }
} as RawCapture;

const actorSource: SourceRecord = {
  id: "src_workflow_actor",
  name: "Workflow actor metadata",
  type: "actor_page",
  url: "https://intel.example/actors/workflow-actor",
  accessMethod: "public_http_metadata",
  status: "active",
  trustScore: 0.74,
  legalNotes: "Public actor-page metadata only.",
  createdAt: "2026-06-27T21:00:00.000Z",
  updatedAt: "2026-06-27T21:00:00.000Z"
} as SourceRecord;

const actorCapture: RawCapture = {
  id: "cap_workflow_actor_beta",
  sourceId: actorSource.id,
  url: "https://intel.example/actors/workflow-actor#beta",
  collectedAt: "2026-06-27T21:06:00.000Z",
  mediaType: "text/plain",
  storageKind: "metadata_only",
  contentHash: "hash-workflow-actor-beta",
  sensitive: false,
  body: "Actor page lists beta-payments.example as a current credential broker target.",
  metadata: { adapter: "actor_page_metadata", actorName: "WorkflowActor", victimName: "beta-payments.example" }
} as RawCapture;

describe("dwm workflow persistence", () => {
  test("persists watchlists and saves rebuilt alerts from collected evidence", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dwm-workflow-"));
    try {
      const snapshotPath = join(dir, "store.json");
      const store = new FileBackedScraperStore({ snapshotPath });
      store.saveSource(source);
      store.saveCapture(capture);

      const createResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
        method: "POST",
        body: JSON.stringify({ tenantId: "tenant_acme", name: "Acme watch", terms: ["acme.com"], webhookUrl: "https://hooks.example.com/dwm" })
      }), { store, frontier: new FocusedFrontier() });
      expect(createResponse.status).toBe(201);

      const rehydrated = new FileBackedScraperStore({ snapshotPath });
      expect((rehydrated as any).listDwmWatchlists()).toHaveLength(1);

      const rebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
        method: "POST",
        body: JSON.stringify({ tenantId: "tenant_acme" })
      }), { store: rehydrated, frontier: new FocusedFrontier() });
      const rebuild = await rebuildResponse.json() as any;

      expect(rebuildResponse.status).toBe(200);
      expect(rebuild.savedAlertCount).toBe(1);
      expect(rebuild.alerts[0].tenantId).toBe("tenant_acme");
      expect(rebuild.alerts[0].deliveryState).toBe("pending_review");
      expect(rebuild.alerts[0].dedupeKey).toBe(rebuild.alerts[0].webhookDelivery.dedupeKey);
      expect(rebuild.alerts[0].recommendedRoute).toBe("identity_response");
      expect(rebuild.alerts[0].confidenceReasoning.join(" ")).toContain("Final confidence");
      expect(rebuild.alerts[0].provenance.captureIds).toContain("cap_workflow_acme");
      expect(rebuild.alerts[0].deliveryReadinessContext).toMatchObject({
        schemaVersion: "dwm.alert_delivery_persistence.v1",
        alertId: rebuild.alerts[0].id,
        tenantId: "tenant_acme",
        selectedCaptureIds: ["cap_workflow_acme"],
        sourceFamily: "telegram_public",
        evidenceCount: 1,
        deliveryDedupeKey: rebuild.alerts[0].webhookDelivery.dedupeKey,
        casePath: expect.stringContaining("/v1/cases/"),
        blockerCodes: expect.arrayContaining(["missing_org_ref"])
      });
      expect((rehydrated as any).listDwmAlerts()).toHaveLength(1);

      const updateResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${rebuild.alerts[0].id}`, {
        method: "PATCH",
        body: JSON.stringify({ reviewState: "reviewing", deliveryState: "ready_to_send", note: "Confirmed customer domain match.", assignedOwner: "iris", actor: "analyst-1" })
      }), { store: rehydrated, frontier: new FocusedFrontier() });
      const update = await updateResponse.json() as any;

      expect(updateResponse.status).toBe(200);
      expect(update.alert.reviewState).toBe("reviewing");
      expect(update.alert.deliveryState).toBe("ready_to_send");
      expect(update.alert.workflowNote).toBe("Confirmed customer domain match.");
      expect(update.alert.assignedOwner).toBe("iris");
      expect(update.alert.workflowEvents).toHaveLength(1);
      expect(update.alert.workflowEvents[0]).toMatchObject({ toOwner: "iris" });

      const detailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${rebuild.alerts[0].id}?tenantId=tenant_acme`), { store: rehydrated, frontier: new FocusedFrontier() });
      const detail = await detailResponse.json() as any;

      expect(detailResponse.status).toBe(200);
      expect(detail.alert.id).toBe(rebuild.alerts[0].id);
      expect(detail.alert.alertCreatedEvent).toMatchObject({
        schemaVersion: "dwm.alert_created_event.v1",
        eventType: "dwm.alert.created",
        alertId: rebuild.alerts[0].id,
        tenantId: "tenant_acme",
        sourceFamily: "telegram_public",
        captureIds: ["cap_workflow_acme"],
        evidenceCount: 1,
        recommendedRoute: "identity_response"
      });
      expect(detail.workflowSummary.createdEvent).toMatchObject({
        schemaVersion: "dwm.alert_created_event.v1",
        eventId: detail.alert.alertCreatedEvent.id,
        sourceFamily: "telegram_public",
        captureIds: ["cap_workflow_acme"],
        dedupeKey: rebuild.alerts[0].dedupeKey,
        recommendedRoute: "identity_response"
      });
      expect(detail.alertCreatedDispatch).toMatchObject({
        schemaVersion: "dwm.alert_created_event_dispatch.v1",
        ready: false,
        eventId: detail.alert.alertCreatedEvent.id,
        eventType: "dwm.alert.created",
        alertId: rebuild.alerts[0].id,
        tenantId: "tenant_acme",
        sourceFamily: "telegram_public",
        captureIds: ["cap_workflow_acme"],
        selectedCaptureIds: ["cap_workflow_acme"],
        workflowEventCount: 1
      });
      expect(detail.alertCreatedDispatch.blockerCodes).toContain("delivery_disabled");
      expect(detail.evidenceReplay[0]).toMatchObject({ sourceName: "Workflow public Telegram", contentHash: "hash-workflow-acme" });
      expect(detail.timeline[0]).toMatchObject({
        type: "alert_created",
        title: "Alert created"
      });
      expect(detail.timeline.length).toBeGreaterThanOrEqual(2);
      expect(detail.nextActions).toContain("Send the customer webhook.");

      const replayResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${rebuild.alerts[0].id}/replay`, {
        method: "POST",
        body: JSON.stringify({ actor: "analyst-1" })
      }), { store: rehydrated, frontier: new FocusedFrontier() });
      const replay = await replayResponse.json() as any;

      expect(replayResponse.status).toBe(200);
      expect(replay.alert.replayCount).toBe(1);
      expect(replay.alert.workflowEvents).toHaveLength(2);
      expect(replay.alert.deliveryReadinessContext).toMatchObject({
        replayCount: 1,
        selectedCaptureIds: ["cap_workflow_acme"],
        deliveryDedupeKey: replay.alert.webhookDelivery.dedupeKey
      });

      rehydrated.saveCapture(followupCapture);

      const secondRebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
        method: "POST",
        body: JSON.stringify({ tenantId: "tenant_acme" })
      }), { store: rehydrated, frontier: new FocusedFrontier() });
      const secondRebuild = await secondRebuildResponse.json() as any;

      expect(secondRebuildResponse.status).toBe(200);
      expect(secondRebuild.alerts[0].reviewState).toBe("reviewing");
      expect(secondRebuild.alerts[0].deliveryState).toBe("ready_to_send");
      expect(secondRebuild.alerts[0].assignedOwner).toBe("iris");
      expect(secondRebuild.alerts[0].workflowEvents).toHaveLength(2);
      expect(secondRebuild.alerts[0].replayCount).toBe(1);
      expect(secondRebuild.alerts[0].sourceCount).toBe(2);
      expect(secondRebuild.alerts[0].evidenceSummary.evidenceCount).toBe(2);
      expect(secondRebuild.alerts[0].workflowContext.evidenceCount).toBe(2);
      expect(secondRebuild.alerts[0].workflowContext.generationEvidenceWindow).toMatchObject({
        captureIds: expect.arrayContaining(["cap_workflow_acme", "cap_workflow_acme_followup"]),
        firstObservedAt: "2026-06-27T21:02:00.000Z",
        lastObservedAt: "2026-06-27T21:07:00.000Z"
      });
      expect(secondRebuild.alerts[0].evidence.map((item: any) => item.id)).toContain("cap_workflow_acme_followup");
      expect(secondRebuild.alerts[0].provenance.captureIds).toContain("cap_workflow_acme_followup");
      expect(secondRebuild.alerts[0].dedupeKey).toBe(rebuild.alerts[0].dedupeKey);

      const finalStore = new FileBackedScraperStore({ snapshotPath });
      expect((finalStore as any).listDwmAlerts()[0].workflowEvents).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("keeps org alert workflow transitions immutable and visible across duplicate rebuilds", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source);
    store.saveCapture(capture);
    const options = { store, frontier: new FocusedFrontier() };

    const orgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
      method: "POST",
      headers: { "x-user-email": "owner@workflow.example" },
      body: JSON.stringify({ name: "Workflow Alert Org", ownerEmail: "owner@workflow.example", ownerUserId: "owner-workflow" })
    }), options);
    const orgPayload = await orgResponse.json() as any;
    const organizationId = orgPayload.organization.id;
    (store as any).saveOrganizationMember({
      id: "viewer-workflow",
      organizationId,
      email: "viewer@workflow.example",
      userId: "viewer-workflow",
      role: "viewer",
      status: "active",
      createdAt: "2026-06-27T21:00:00.000Z",
      updatedAt: "2026-06-27T21:00:00.000Z"
    });

    const watchlistResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
      method: "POST",
      headers: { "x-user-email": "owner@workflow.example" },
      body: JSON.stringify({ organizationId, name: "Workflow org watch", terms: [{ id: "watch_item_workflow_acme", value: "acme.com", kind: "domain" }] })
    }), options);
    expect(watchlistResponse.status).toBe(201);

    const rebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      headers: { "x-user-email": "owner@workflow.example" },
      body: JSON.stringify({ organizationId })
    }), options);
    const rebuild = await rebuildResponse.json() as any;
    const alert = rebuild.alerts[0];

    expect(rebuild.savedAlertCount).toBe(1);
    expect(alert.organizationId).toBe(organizationId);
    expect(alert.workflowContext.watchlistItemIds[0]).toContain("acme.com");

    const viewerMutationResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "x-user-email": "viewer@workflow.example" },
      body: JSON.stringify({ organizationId, status: "triaged", note: "Viewer cannot mutate." })
    }), options);
    expect(viewerMutationResponse.status).toBe(403);
    expect((store as any).getDwmAlert(alert.id).workflowEvents ?? []).toHaveLength(0);

    const triageResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "x-user-email": "owner@workflow.example" },
      body: JSON.stringify({
        organizationId,
        status: "triaged",
        assignedOwner: "owner-workflow",
        severityOverride: "critical",
        caseId: "case_workflow_live",
        casePath: `/v1/cases/case_workflow_live?alertId=${alert.id}`,
        note: "Triage accepted.",
        rationale: "Live capture matches owned domain."
      })
    }), options);
    const triage = await triageResponse.json() as any;
    expect(triageResponse.status).toBe(200);
    expect(triage.alert.workflowSummary).toMatchObject({ status: "triaged", assignedOwner: "owner-workflow", severityOverride: "critical", caseId: "case_workflow_live", eventCount: 1 });
    expect(triage.alert.workflowSummary.createdEvent).toMatchObject({
      schemaVersion: "dwm.alert_created_event.v1",
      sourceFamily: "telegram_public",
      captureIds: ["cap_workflow_acme"],
      dedupeKey: alert.dedupeKey,
      recommendedRoute: "identity_response"
    });
    expect(triage.workflowExecutionReadiness).toMatchObject({
      schemaVersion: "dwm.alert_workflow_execution_readiness.v1",
      ready: true,
      action: "case_link",
      alertId: alert.id,
      currentWorkflowEventCount: 1
    });
    expect(triage.workflowActionEvent).toMatchObject({
      schemaVersion: "dwm.alert_workflow_action_event.v1",
      ready: true,
      action: "case_link",
      alertId: alert.id,
      organizationId,
      sourceFamily: "telegram_public",
      captureIds: ["cap_workflow_acme"],
      selectedCaptureIds: ["cap_workflow_acme"],
      evidenceCount: 1,
      dedupeKey: alert.dedupeKey,
      deliveryDedupeKey: alert.dedupeKey,
      alertDetailPath: alert.alertDetailPath,
      caseIdCandidate: alert.caseIdCandidate,
      caseId: "case_workflow_live",
      casePath: `/v1/cases/case_workflow_live?alertId=${alert.id}`,
      workflowEventCount: 1,
      blockerCodes: []
    });
    expect(triage.workflowActionEvent.watchlistIds).toEqual(alert.watchlistIds);
    expect(triage.workflowActionEvent.watchlistItemIds).toEqual(alert.watchlistItemIds);
    expect(triage.workflowActionEvent.idempotencyKey).toMatch(/^dwm_alert_workflow_action_event_/);
    expect(triage.alert.workflowExecutionReadiness).toMatchObject({ ready: true, currentWorkflowEventCount: 1 });
    expect(triage.alert.workflowExecutionReadiness.workflowActionEvent).toMatchObject({
      schemaVersion: "dwm.alert_workflow_action_event.v1",
      ready: true,
      organizationId,
      sourceFamily: "telegram_public",
      captureIds: ["cap_workflow_acme"],
      selectedCaptureIds: ["cap_workflow_acme"],
      dedupeKey: alert.dedupeKey,
      caseId: "case_workflow_live",
      workflowEventCount: 1
    });
    expect(triage.alert.customerProofHandoff).toMatchObject({
      schemaVersion: "dwm.customer_alert_proof.v1",
      alertId: alert.id,
      organizationId,
      workflow: {
        status: "triaged",
        assignedOwner: "owner-workflow",
        severityOverride: "critical",
        note: "Triage accepted.",
        rationale: "Live capture matches owned domain.",
        eventCount: 1
      },
      caseHandoff: {
        ready: true,
        caseId: "case_workflow_live",
        casePath: `/v1/cases/case_workflow_live?alertId=${alert.id}`
      }
    });
    expect(triage.alert.customerProofHandoff.selectedCaptureIds).toEqual(["cap_workflow_acme"]);
    expect(triage.alert.customerProofHandoff.deliveryDedupeKey).toBe(alert.dedupeKey);
    expect(triage.alert.caseHandoff.payload.body).toMatchObject({
      organizationId,
      alertId: alert.id,
      caseIdCandidate: alert.caseIdCandidate,
      casePath: `/v1/cases/case_workflow_live?alertId=${alert.id}`,
      captureIds: ["cap_workflow_acme"],
      createdEvent: {
        schemaVersion: "dwm.alert_created_event.v1",
        sourceFamily: "telegram_public",
        captureIds: ["cap_workflow_acme"],
        dedupeKey: alert.dedupeKey,
        recommendedRoute: "identity_response"
      }
    });
    expect(triage.alert.nextBestAction).toMatchObject({ action: "investigate_or_route", route: "identity_response" });
    expect(triage.alert.deliveryReadiness).toMatchObject({ ready: false, state: "missing_route", evidenceCount: 1 });
    expect(triage.alert.deliveryReadiness.createdEvent).toMatchObject({
      schemaVersion: "dwm.alert_created_event.v1",
      sourceFamily: "telegram_public",
      captureIds: ["cap_workflow_acme"],
      dedupeKey: alert.dedupeKey,
      recommendedRoute: "identity_response"
    });
    expect(triage.alert.deliveryReadiness.persistedContext).toMatchObject({
      schemaVersion: "dwm.alert_delivery_persistence.v1",
      organizationId,
      alertGeneratorKeys: [],
      selectedCaptureIds: ["cap_workflow_acme"],
      blockerCodes: expect.arrayContaining(["missing_org_ref", "delivery_disabled"])
    });
    expect(triage.alert.deliveryReadiness.persistedContext).toMatchObject({
      caseId: "case_workflow_live",
      casePath: `/v1/cases/case_workflow_live?alertId=${alert.id}`
    });
    expect(triage.alert.evidenceFreshness).toMatchObject({
      newestEvidenceAt: "2026-06-27T21:02:00.000Z",
      evidenceCount: 1,
      captureIds: ["cap_workflow_acme"],
      generationEvidenceWindow: {
        captureIds: ["cap_workflow_acme"],
        sourceFamilies: ["telegram_public"],
        firstObservedAt: "2026-06-27T21:02:00.000Z",
        lastObservedAt: "2026-06-27T21:02:00.000Z"
      }
    });
    expect(triage.alert.provenanceFreshness).toMatchObject({
      matchBasis: "watchlist_capture_text",
      captureIds: ["cap_workflow_acme"],
      dedupeKey: alert.dedupeKey,
      generationEvidenceWindow: {
        contentHashes: ["hash-workflow-acme"],
        firstObservedAt: "2026-06-27T21:02:00.000Z"
      }
    });

    const staleMutationResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "x-user-email": "owner@workflow.example" },
      body: JSON.stringify({ organizationId, status: "investigating", expectedWorkflowEventCount: 0, note: "Stale analyst tab should not append." })
    }), options);
    const staleMutation = await staleMutationResponse.json() as any;
    expect(staleMutationResponse.status).toBe(409);
    expect(staleMutation.workflowExecutionReadiness).toMatchObject({
      ready: false,
      blockerCodes: ["stale_workflow_version"],
      expectedWorkflowEventCount: 0,
      currentWorkflowEventCount: 1,
      createdEvent: {
        sourceFamily: "telegram_public",
        captureIds: ["cap_workflow_acme"],
        dedupeKey: alert.dedupeKey
      }
    });
    expect(staleMutation.workflowExecutionReadiness.createdEventDispatch).toMatchObject({
      schemaVersion: "dwm.alert_created_event_dispatch.v1",
      ready: false,
      eventId: alert.alertCreatedEvent.id,
      alertId: alert.id,
      organizationId,
      sourceFamily: "telegram_public",
      captureIds: ["cap_workflow_acme"],
      selectedCaptureIds: ["cap_workflow_acme"],
      workflowEventCount: 1,
      blockerCodes: ["stale_workflow_version"]
    });
    expect(staleMutation.workflowExecutionReadiness.createdEventDispatch.idempotencyKey).toMatch(/^dwm_alert_created_workflow_dispatch_/);
    expect(staleMutation.workflowExecutionReadiness.workflowActionEvent).toMatchObject({
      schemaVersion: "dwm.alert_workflow_action_event.v1",
      ready: false,
      action: "note",
      alertId: alert.id,
      organizationId,
      sourceFamily: "telegram_public",
      captureIds: ["cap_workflow_acme"],
      selectedCaptureIds: ["cap_workflow_acme"],
      dedupeKey: alert.dedupeKey,
      caseId: "case_workflow_live",
      workflowEventCount: 1,
      expectedWorkflowEventCount: 0,
      blockerCodes: ["stale_workflow_version"]
    });
    expect((store as any).getDwmAlert(alert.id).workflowEvents).toHaveLength(1);

    const invalidTransitionResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "x-user-email": "owner@workflow.example" },
      body: JSON.stringify({ organizationId, status: "not_a_real_status", note: "Invalid status." })
    }), options);
    const invalidTransition = await invalidTransitionResponse.json() as any;
    expect(invalidTransitionResponse.status).toBe(400);
    expect(invalidTransition.workflowExecutionReadiness).toMatchObject({ ready: false, blockerCodes: ["invalid_transition"] });
    expect((store as any).getDwmAlert(alert.id).workflowEvents).toHaveLength(1);

    const filteredTriageResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${organizationId}&status=triaged&assignee=owner-workflow&severity=critical&sourceFamily=telegram_public&q=acme.com`, {
      headers: { "x-user-email": "owner@workflow.example" }
    }), options);
    const filteredTriage = await filteredTriageResponse.json() as any;
    expect(filteredTriageResponse.status).toBe(200);
    expect(filteredTriage.alerts).toHaveLength(1);
    expect(filteredTriage.alerts[0].workflowSummary).toMatchObject({ status: "triaged", assignedOwner: "owner-workflow", caseId: "case_workflow_live" });
    expect(filteredTriage.alerts[0].workflowSummary.createdEvent).toMatchObject({
      sourceFamily: "telegram_public",
      captureIds: ["cap_workflow_acme"],
      recommendedRoute: "identity_response"
    });

    const missingRationaleResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "x-user-email": "owner@workflow.example" },
      body: JSON.stringify({ organizationId, status: "suppressed" })
    }), options);
    expect(missingRationaleResponse.status).toBe(400);

    const suppressedResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "x-user-email": "owner@workflow.example" },
      body: JSON.stringify({ organizationId, status: "suppressed", rationale: "Duplicate of known customer notification." })
    }), options);
    const suppressed = await suppressedResponse.json() as any;
    expect(suppressedResponse.status).toBe(200);
    expect(suppressed.alert).toMatchObject({ workflowStatus: "suppressed", reviewState: "false_positive", deliveryState: "muted" });
    expect(suppressed.alert.suppressedAt).toBeTruthy();
    expect(suppressed.alert.nextBestAction).toMatchObject({ action: "monitor_suppressed" });

    const listSuppressedResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${organizationId}&status=suppressed&caseId=case_workflow_live`, {
      headers: { "x-user-email": "owner@workflow.example" }
    }), options);
    const listSuppressed = await listSuppressedResponse.json() as any;
    expect(listSuppressed.alerts).toHaveLength(1);
    expect(listSuppressed.alerts[0].workflowSummary).toMatchObject({ status: "suppressed", caseId: "case_workflow_live" });

    const closedResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "x-user-email": "owner@workflow.example" },
      body: JSON.stringify({ organizationId, status: "closed", rationale: "No customer action required after review." })
    }), options);
    const closed = await closedResponse.json() as any;
    expect(closedResponse.status).toBe(200);
    expect(closed.alert.workflowSummary).toMatchObject({ status: "closed", eventCount: 3 });
    expect(closed.alert.workflowSummary.workflowTransitionEvents.map((event: any) => event.action)).toEqual(["escalated", "suppressed", "closed"]);
    expect(closed.alert.workflowSummary.workflowTransitionEvents[0]).toMatchObject({
      schemaVersion: "dwm.alert_workflow_transition_event.v1",
      action: "escalated",
      toStatus: "triaged",
      caseId: "case_workflow_live",
      casePath: `/v1/cases/case_workflow_live?alertId=${alert.id}`,
      hasNote: true,
      hasRationale: true,
      dedupeKey: alert.dedupeKey,
      sourceFamily: "telegram_public",
      watchlistIds: alert.watchlistIds,
      captureIds: ["cap_workflow_acme"]
    });
    expect(closed.alert.workflowSummary.workflowTransitionEvents[2]).toMatchObject({
      action: "closed",
      toStatus: "closed",
      hasRationale: true,
      caseId: "case_workflow_live",
      sourceFamily: "telegram_public"
    });
    expect(closed.alert.closedAt).toBeTruthy();

    const listClosedResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${organizationId}&status=closed&watchlistId=${alert.watchlistIds[0]}&captureId=cap_workflow_acme`, {
      headers: { "x-user-email": "owner@workflow.example" }
    }), options);
    const listClosed = await listClosedResponse.json() as any;
    expect(listClosed.alerts).toHaveLength(1);
    expect(listClosed.alerts[0].workflowSummary).toMatchObject({ status: "closed", eventCount: 3 });
    expect(listClosed.alerts[0].workflowSummary.workflowTransitionEvents.map((event: any) => event.action)).toEqual(["escalated", "suppressed", "closed"]);
    expect(listClosed.alerts[0].deliveryReadiness).toMatchObject({ ready: false, state: "closed" });

    const reopenedResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "x-user-email": "owner@workflow.example" },
      body: JSON.stringify({ organizationId, action: "reopen", note: "New duplicate replay should not wipe state." })
    }), options);
    const reopened = await reopenedResponse.json() as any;
    expect(reopenedResponse.status).toBe(200);
    expect(reopened.alert.workflowSummary).toMatchObject({ status: "reopened", eventCount: 4 });
    expect(reopened.alert.workflowSummary.workflowTransitionEvents.at(-1)).toMatchObject({
      schemaVersion: "dwm.alert_workflow_transition_event.v1",
      action: "reopened",
      fromStatus: "closed",
      toStatus: "reopened",
      hasNote: true,
      caseId: "case_workflow_live",
      sourceFamily: "telegram_public",
      captureIds: ["cap_workflow_acme"]
    });
    expect(reopened.alert.customerProofHandoff).toMatchObject({
      workflow: {
        status: "reopened",
        assignedOwner: "owner-workflow",
        eventCount: 4
      },
      caseHandoff: {
        ready: true,
        caseId: "case_workflow_live"
      }
    });

    store.saveCapture(duplicateCapture);
    const duplicateRebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      headers: { "x-user-email": "owner@workflow.example" },
      body: JSON.stringify({ organizationId })
    }), options);
    const duplicateRebuild = await duplicateRebuildResponse.json() as any;
    const preserved = duplicateRebuild.alerts.find((row: any) => row.id === alert.id);

    expect(preserved).toMatchObject({
      workflowStatus: "reopened",
      assignedOwner: "owner-workflow",
      severityOverride: "critical",
      caseId: "case_workflow_live",
      casePath: `/v1/cases/case_workflow_live?alertId=${alert.id}`,
      workflowRationale: "No customer action required after review."
    });
    expect(preserved.workflowEvents).toHaveLength(4);
    expect(preserved.evidence).toHaveLength(1);
    expect(preserved.provenance.captureIds).toEqual(["cap_workflow_acme"]);
    expect(preserved.deliveryReadinessContext).toMatchObject({
      caseId: "case_workflow_live",
      selectedCaptureIds: ["cap_workflow_acme"]
    });

    const detailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}?organizationId=${organizationId}`, {
      headers: { "x-user-email": "owner@workflow.example" }
    }), options);
    const detail = await detailResponse.json() as any;
    expect(detail.workflowSummary).toMatchObject({
      status: "reopened",
      caseId: "case_workflow_live",
      casePath: `/v1/cases/case_workflow_live?alertId=${alert.id}`,
      eventCount: 4,
      evidenceCount: 1
    });
    expect(detail.workflowSummary.workflowTransitionEvents.map((event: any) => event.action)).toEqual(["escalated", "suppressed", "closed", "reopened"]);
    expect(detail.workflowSummary.workflowTransitionEvents.every((event: any) => event.schemaVersion === "dwm.alert_workflow_transition_event.v1")).toBe(true);
    expect(detail.workflowExecutionReadiness).toMatchObject({
      ready: true,
      currentWorkflowEventCount: 4
    });
    expect(detail.analystWorkflowContract).toMatchObject({
      schemaVersion: "dwm.alert_analyst_workflow_contract.v1",
      mutationRoute: "/v1/dwm/alerts/:id",
      replayRoute: "/v1/dwm/alerts/:id/replay",
      supportedStatuses: ["new", "triaged", "investigating", "suppressed", "closed", "reopened"],
      requiredBody: ["organizationId", "status|action|note|assignedOwner|severityOverride|caseId", "expectedWorkflowEventCount?"],
      idempotency: {
        workflowEventCount: 4,
        staleVersionBlocker: "stale_workflow_version"
      },
      guards: {
        orgScoped: true,
        preservesEvidence: true,
        preservesEventsOnRebuild: true,
        invalidTransitionBlocker: "invalid_transition"
      },
      current: {
        status: "reopened",
        assignedOwner: "owner-workflow",
        severityOverride: "critical",
        caseId: "case_workflow_live",
        replayCount: 0
      }
    });
    expect(detail.customerProofHandoff).toMatchObject({
      schemaVersion: "dwm.customer_alert_proof.v1",
      workflow: {
        status: "reopened",
        eventCount: 4,
        replayCount: 0
      },
      caseHandoff: {
        ready: true,
        caseId: "case_workflow_live"
      },
      delivery: {
        state: "blocked"
      }
    });
    expect(detail.caseHandoff.payload.body).toMatchObject({
      organizationId,
      alertId: alert.id,
      caseIdCandidate: alert.caseIdCandidate,
      casePath: `/v1/cases/case_workflow_live?alertId=${alert.id}`,
      watchlistItemIds: expect.arrayContaining([expect.stringContaining("acme.com")]),
      createdEvent: {
        sourceFamily: "telegram_public",
        captureIds: ["cap_workflow_acme"],
        dedupeKey: alert.dedupeKey,
        recommendedRoute: "identity_response"
      }
    });
    expect(detail.nextBestAction).toMatchObject({ action: "investigate_or_route" });
    expect(detail.deliveryReadiness).toMatchObject({ ready: false, blocker: "missing_webhook_route" });
    expect(detail.deliveryReadiness.createdEvent).toMatchObject({
      sourceFamily: "telegram_public",
      captureIds: ["cap_workflow_acme"],
      dedupeKey: alert.dedupeKey,
      recommendedRoute: "identity_response"
    });
    expect(detail.evidenceFreshness).toMatchObject({
      evidenceCount: 1,
      newestEvidenceAt: "2026-06-27T21:02:00.000Z",
      generationEvidenceWindow: {
        captureIds: ["cap_workflow_acme"],
        sourceFamilies: ["telegram_public"]
      }
    });
    expect(detail.provenanceFreshness).toMatchObject({
      matchBasis: "watchlist_capture_text",
      captureIds: ["cap_workflow_acme"],
      generationEvidenceWindow: {
        firstObservedAt: "2026-06-27T21:02:00.000Z",
        lastObservedAt: "2026-06-27T21:02:00.000Z"
      }
    });
  });

  test("keeps multi-source org alert lifecycle isolated across darkweb Telegram and actor captures", async () => {
    const store = new InMemoryScraperStore();
    for (const row of [source, darkwebSource, actorSource]) store.saveSource(row);
    for (const row of [capture, darkwebCapture, actorCapture]) store.saveCapture(row);
    const options = { store, frontier: new FocusedFrontier() };

    const alphaOrgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
      method: "POST",
      headers: { "x-user-email": "owner-alpha@workflow.example" },
      body: JSON.stringify({ name: "Workflow Alpha Org", ownerEmail: "owner-alpha@workflow.example", ownerUserId: "owner-alpha-workflow" })
    }), options);
    const betaOrgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
      method: "POST",
      headers: { "x-user-email": "owner-beta@workflow.example" },
      body: JSON.stringify({ name: "Workflow Beta Org", ownerEmail: "owner-beta@workflow.example", ownerUserId: "owner-beta-workflow" })
    }), options);
    const alphaOrg = (await alphaOrgResponse.json() as any).organization;
    const betaOrg = (await betaOrgResponse.json() as any).organization;
    (store as any).saveWebhookDestination({
      id: "webhook_workflow_alpha",
      organizationId: alphaOrg.id,
      tenantId: alphaOrg.id,
      name: "Alpha workflow delivery",
      url: "https://hooks.example.com/workflow-alpha",
      kind: "generic",
      status: "active",
      createdAt: "2026-06-27T21:00:00.000Z",
      updatedAt: "2026-06-27T21:00:00.000Z"
    });
    (store as any).saveWebhookDestination({
      id: "webhook_workflow_beta",
      organizationId: betaOrg.id,
      tenantId: betaOrg.id,
      name: "Beta workflow delivery",
      url: "https://hooks.example.com/workflow-beta",
      kind: "generic",
      status: "active",
      createdAt: "2026-06-27T21:00:00.000Z",
      updatedAt: "2026-06-27T21:00:00.000Z"
    });

    for (const watchlist of orgWatchlistContractToRuntimeDwmWatchlists({
      schemaVersion: "organization.watchlist_alert_generation.v1",
      organizationId: alphaOrg.id,
      tenantId: alphaOrg.id,
      ownerOrganizationId: alphaOrg.id,
      visibilityPolicy: "members",
      entitlementStatus: "active",
      canGenerateAlerts: true,
      activeTerms: [{
        watchlistId: "watch_workflow_alpha_acme",
        watchlistItemId: "watch_item_workflow_alpha_acme",
        organizationId: alphaOrg.id,
        tenantId: alphaOrg.id,
        kind: "domain",
        termFamily: "domain",
        term: "acme.com",
        category: "domain",
        status: "active",
        alertGenerationRef: workflowAlertGenerationRef({
          organizationId: alphaOrg.id,
          watchlistItemId: "watch_item_workflow_alpha_acme",
          term: "acme.com",
          termFamily: "domain"
        })
      }]
    }).map((watchlist) => ({ ...watchlist, webhookDestinationId: "webhook_workflow_alpha" }))) {
      (store as any).saveDwmWatchlist(watchlist);
    }
    for (const watchlist of orgWatchlistContractToRuntimeDwmWatchlists({
      schemaVersion: "organization.watchlist_alert_generation.v1",
      organizationId: betaOrg.id,
      tenantId: betaOrg.id,
      ownerOrganizationId: betaOrg.id,
      visibilityPolicy: "members",
      entitlementStatus: "active",
      canGenerateAlerts: true,
      activeTerms: [{
        watchlistId: "watch_workflow_beta_actor",
        watchlistItemId: "watch_item_workflow_beta_actor",
        organizationId: betaOrg.id,
        tenantId: betaOrg.id,
        kind: "domain",
        termFamily: "domain",
        term: "beta-payments.example",
        category: "domain",
        status: "active",
        alertGenerationRef: workflowAlertGenerationRef({
          organizationId: betaOrg.id,
          watchlistItemId: "watch_item_workflow_beta_actor",
          term: "beta-payments.example",
          termFamily: "domain"
        })
      }]
    }).map((watchlist) => ({ ...watchlist, webhookDestinationId: "webhook_workflow_beta" }))) {
      (store as any).saveDwmWatchlist(watchlist);
    }

    const alphaRebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      headers: { "x-user-email": "owner-alpha@workflow.example" },
      body: JSON.stringify({ organizationId: alphaOrg.id })
    }), options);
    const betaRebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      headers: { "x-user-email": "owner-beta@workflow.example" },
      body: JSON.stringify({ organizationId: betaOrg.id })
    }), options);
    const alphaRebuild = await alphaRebuildResponse.json() as any;
    const betaRebuild = await betaRebuildResponse.json() as any;
    expect(alphaRebuild.savedAlertCount).toBe(2);
    expect(alphaRebuild.alerts.map((alert: any) => alert.sourceFamily).sort()).toEqual(["darkweb_metadata", "telegram_public"]);
    expect(betaRebuild.savedAlertCount).toBe(1);
    expect(betaRebuild.alerts[0].sourceFamily).toBe("actor_page");

    const alphaDarkweb = alphaRebuild.alerts.find((alert: any) => alert.sourceFamily === "darkweb_metadata");
    const betaActor = betaRebuild.alerts[0];
    expect(alphaDarkweb.provenance).toMatchObject({
      metadataOnly: true,
      captureIds: ["cap_workflow_onion_acme"]
    });
    expect(betaActor.provenance.captureIds).toEqual(["cap_workflow_actor_beta"]);

    const triageResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alphaDarkweb.id}`, {
      method: "PATCH",
      headers: { "x-user-email": "owner-alpha@workflow.example" },
      body: JSON.stringify({
        organizationId: alphaOrg.id,
        status: "investigating",
        assignedOwner: "owner-alpha-workflow",
        severityOverride: "high",
        caseId: "case_alpha_darkweb",
        casePath: `/v1/cases/case_alpha_darkweb?alertId=${alphaDarkweb.id}`,
        note: "Darkweb metadata reviewed.",
        rationale: "Metadata-only onion source matched the org domain."
      })
    }), options);
    const triage = await triageResponse.json() as any;
    expect(triageResponse.status).toBe(200);
    expect(triage.alert.workflowSummary).toMatchObject({
      status: "investigating",
      assignedOwner: "owner-alpha-workflow",
      severityOverride: "high",
      caseId: "case_alpha_darkweb",
      eventCount: 1
    });
    expect(triage.alert.downstreamHandoff).toMatchObject({
      organizationId: alphaOrg.id,
      sourceFamily: "darkweb_metadata",
      deliverySelection: {
        ready: true,
        selectedWebhookDestinationId: "webhook_workflow_alpha",
        selectedCaptureIds: ["cap_workflow_onion_acme"]
      },
      caseReadiness: {
        ready: true,
        caseId: "case_alpha_darkweb"
      }
    });
    expect(triage.alert.alertCreatedDispatch).toMatchObject({
      schemaVersion: "dwm.alert_created_event_dispatch.v1",
      ready: true,
      organizationId: alphaOrg.id,
      sourceFamily: "darkweb_metadata",
      selectedCaptureIds: ["cap_workflow_onion_acme"],
      workflowEventCount: 1,
      blockerCodes: []
    });
    expect(triage.alert.customerProofHandoff).toMatchObject({
      organizationId: alphaOrg.id,
      sourceFamily: "darkweb_metadata",
      workflow: { status: "investigating", eventCount: 1 },
      caseHandoff: { ready: true, caseId: "case_alpha_darkweb" },
      delivery: { ready: true }
    });

    const staleReplayResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alphaDarkweb.id}/replay`, {
      method: "POST",
      headers: { "x-user-email": "owner-alpha@workflow.example" },
      body: JSON.stringify({ organizationId: alphaOrg.id, expectedWorkflowEventCount: 0 })
    }), options);
    const staleReplay = await staleReplayResponse.json() as any;
    expect(staleReplayResponse.status).toBe(409);
    expect(staleReplay.workflowExecutionReadiness).toMatchObject({
      ready: false,
      blockerCodes: ["stale_workflow_version"],
      expectedWorkflowEventCount: 0,
      currentWorkflowEventCount: 1
    });
    expect(staleReplay.workflowExecutionReadiness.createdEventDispatch).toMatchObject({
      schemaVersion: "dwm.alert_created_event_dispatch.v1",
      ready: false,
      organizationId: alphaOrg.id,
      sourceFamily: "darkweb_metadata",
      captureIds: ["cap_workflow_onion_acme"],
      selectedCaptureIds: ["cap_workflow_onion_acme"],
      workflowEventCount: 1,
      blockerCodes: ["stale_workflow_version"]
    });

    store.saveCapture(darkwebFollowupCapture);
    const alphaSecondRebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      headers: { "x-user-email": "owner-alpha@workflow.example" },
      body: JSON.stringify({ organizationId: alphaOrg.id })
    }), options);
    const alphaSecondRebuild = await alphaSecondRebuildResponse.json() as any;
    const preservedDarkweb = alphaSecondRebuild.alerts.find((alert: any) => alert.id === alphaDarkweb.id);
    expect(preservedDarkweb).toMatchObject({
      workflowStatus: "investigating",
      assignedOwner: "owner-alpha-workflow",
      severityOverride: "high",
      caseId: "case_alpha_darkweb",
      workflowNote: "Darkweb metadata reviewed.",
      workflowRationale: "Metadata-only onion source matched the org domain."
    });
    expect(preservedDarkweb.workflowEvents).toHaveLength(1);
    expect(preservedDarkweb.provenance.captureIds).toEqual(expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"]));
    expect(preservedDarkweb.deliveryReadinessContext).toMatchObject({
      webhookDestinationIds: ["webhook_workflow_alpha"],
      caseId: "case_alpha_darkweb",
      selectedCaptureIds: expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"])
    });

    const alphaUpdatedListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${alphaOrg.id}&eventType=dwm.alert.updated&hasUpdatedEvent=true`, {
      headers: { "x-user-email": "owner-alpha@workflow.example" }
    }), options);
    const alphaUpdatedList = await alphaUpdatedListResponse.json() as any;
    expect(alphaUpdatedList.alerts).toHaveLength(1);
    expect(alphaUpdatedList.alerts[0]).toMatchObject({
      id: alphaDarkweb.id,
      organizationId: alphaOrg.id,
      sourceFamily: "darkweb_metadata",
      alertEventSummary: {
        schemaVersion: "dwm.alert_event_summary.v1",
        eventTypes: ["dwm.alert.created", "dwm.alert.updated"],
        hasUpdatedEvent: true,
        updatedEvent: {
          eventType: "dwm.alert.updated",
          addedCaptureIds: ["cap_workflow_onion_acme_followup"],
          evidenceCount: 2,
          previousEvidenceCount: 1
        }
      },
      workflowSummary: {
        status: "investigating",
        alertEventSummary: {
          hasUpdatedEvent: true,
          updatedEvent: {
            captureIds: expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"])
          }
        }
      }
    });
    expect(alphaUpdatedList.alerts[0].alertEventSummary.updatedEvent.dedupeKey).toBe(alphaDarkweb.dedupeKey);
    expect(alphaUpdatedList.alerts[0].alertDetailPath).toBe(alphaDarkweb.alertDetailPath);
    expect(alphaUpdatedList.alerts[0].alertEventSummary.createdEvent.alertDetailPath).toBe(alphaDarkweb.alertDetailPath);
    expect(alphaUpdatedList.alerts[0].alertEventSummary.updatedEvent.alertDetailPath).toBe(alphaDarkweb.alertDetailPath);
    expect(alphaUpdatedList.alerts[0].sourceProvenanceSummary).toMatchObject({
      schemaVersion: "dwm.alert_source_provenance.v1",
      sourceFamily: "darkweb_metadata",
      sourceFamilies: ["darkweb_metadata"],
      captureIds: expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"]),
      generationEvidenceWindow: expect.objectContaining({
        captureIds: expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"]),
        sourceFamilies: expect.arrayContaining(["telegram_public", "darkweb_metadata"])
      })
    });
    expect(alphaUpdatedList.alerts[0].orgWatchlistScope).toMatchObject({
      schemaVersion: "dwm.alert_org_watchlist_scope.v1",
      organizationId: alphaOrg.id,
      ownerOrganizationIds: [alphaOrg.id],
      watchlistIds: ["watch_workflow_alpha_acme"],
      watchlistItemIds: ["watch_item_workflow_alpha_acme"]
    });
    expect(alphaUpdatedList.alerts[0].customerReadiness).toMatchObject({
      schemaVersion: "dwm.alert_customer_readiness.v1",
      ready: true,
      state: "ready",
      alertReadiness: {
        ready: true,
        sourceFamily: "darkweb_metadata",
        selectedCaptureIds: expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"]),
        watchlistIds: ["watch_workflow_alpha_acme"],
        watchlistItemIds: ["watch_item_workflow_alpha_acme"],
        recommendedRoute: "incident_response",
        blockerCodes: []
      },
      caseHandoff: {
        ready: true,
        caseId: "case_alpha_darkweb",
        casePath: `/v1/cases/case_alpha_darkweb?alertId=${alphaDarkweb.id}`
      },
      deliveryReadiness: {
        ready: true,
        selectedWebhookDestinationId: "webhook_workflow_alpha",
        webhookDestinationIds: ["webhook_workflow_alpha"],
        blockerCodes: []
      },
      webhookReplayReadiness: {
        schemaVersion: "dwm.alert_webhook_replay_readiness.v1",
        ready: true,
        replayCount: 0,
        workflowEventCount: 1,
        deliveryDedupeKey: alphaDarkweb.dedupeKey,
        selectedWebhookDestinationId: "webhook_workflow_alpha",
        webhookDestinationIds: ["webhook_workflow_alpha"],
        selectedCaptureIds: expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"]),
        caseId: "case_alpha_darkweb",
        casePath: `/v1/cases/case_alpha_darkweb?alertId=${alphaDarkweb.id}`,
        watchlistItemIds: ["watch_item_workflow_alpha_acme"],
        deliveryHistoryRefs: [],
        hasDeliveryHistory: false,
        duplicateReplay: false,
        canReplay: true,
        blockerCodes: []
      },
      workflowReadiness: {
        ready: true,
        status: "investigating",
        assignedOwner: "owner-alpha-workflow",
        eventCount: 1,
        readyActions: expect.arrayContaining(["replay", "deliver"])
      },
      transitionHandoff: {
        ready: true,
        workflowEventCount: 1,
        actions: ["escalated"],
        caseLinked: true,
        updateReceipt: {
          ready: true,
          addedCaptureIds: ["cap_workflow_onion_acme_followup"],
          workflowEventCount: 1,
          deliveryDedupeKey: alphaDarkweb.dedupeKey
        },
        replayReceipt: {
          ready: true,
          workflowEventCount: 1,
          selectedCaptureIds: expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"]),
          blockerCodes: []
        }
      },
      blockerCodes: []
    });
    expect(alphaUpdatedList.alerts[0].customerReadiness.consumerFields.webhook).toContain("customerReadiness.webhookReplayReadiness");
    expect(alphaUpdatedList.alertQueueVisibility).toMatchObject({
      consumerContract: {
        schemaVersion: "dwm.alert_queue_consumer_contract.v1",
        route: "/v1/dwm/alerts",
        filters: expect.arrayContaining(["organizationId", "eventType", "hasUpdatedEvent", "sourceFamily", "replayReady", "hasDeliveryHistory"]),
        zeroAlertContract: "dwm.zero_alert_proof.v1"
      },
      orgAlertWorkflowBridge: {
        schemaVersion: "dwm.org_alert_workflow_bridge.v1",
        ok: true,
        organizationId: alphaOrg.id,
        rows: [expect.objectContaining({
          watchlistId: "watch_workflow_alpha_acme",
          watchlistItemId: "watch_item_workflow_alpha_acme",
          matchedAlertIds: [alphaDarkweb.id],
          alertDetailPaths: [alphaDarkweb.alertDetailPath],
          sourceFamilies: ["darkweb_metadata"],
          eventPayloads: [expect.objectContaining({
            alertId: alphaDarkweb.id,
            organizationId: alphaOrg.id,
            watchlistItemId: "watch_item_workflow_alpha_acme",
            alertDetailPath: alphaDarkweb.alertDetailPath,
            sourceFamilies: ["darkweb_metadata"],
            captureIds: expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"])
          })],
          blockerCodes: []
        })]
      },
      generationReadiness: {
        sourceFamilyCoverage: expect.arrayContaining([
          expect.objectContaining({ sourceFamily: "darkweb_metadata", captureRefCount: 2 }),
          expect.objectContaining({ sourceFamily: "telegram_public", captureRefCount: 1 })
        ]),
        sourceFamilyGaps: expect.arrayContaining([
          expect.objectContaining({
            schemaVersion: "dwm.alert_source_family_gap.v1",
            sourceFamily: "darkweb_metadata",
            state: "matched",
            active: true,
            captureRefCount: 2
          }),
          expect.objectContaining({
            schemaVersion: "dwm.alert_source_family_gap.v1",
            sourceFamily: "telegram_public",
            state: "matched",
            active: true,
            captureRefCount: 1
          }),
          expect.objectContaining({
            schemaVersion: "dwm.alert_source_family_gap.v1",
            sourceFamily: "clear_web",
            state: "inactive_or_unconfigured",
            blockerCode: "source_family_inactive"
          })
        ])
      }
    });
    expect(alphaUpdatedList.alertQueueVisibility.consumerContract.stableFields).toEqual(expect.arrayContaining([
      "alerts[].alertDetailPath",
      "alerts[].sourceProvenanceSummary",
      "alerts[].orgWatchlistScope",
      "alerts[].alertEventSummary",
      "alerts[].customerReadiness.webhookReplayReadiness",
      "alerts[].evidenceFreshness",
      "alertQueueVisibility.orgAlertWorkflowBridge",
      "alertQueueVisibility.zeroAlertProof",
      "alertQueueVisibility.generationReadiness.sourceFamilyCoverage",
      "alertQueueVisibility.generationReadiness.sourceFamilyGaps"
    ]));

    const replayReadyListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${alphaOrg.id}&replayReady=true&deliveryReady=true&caseReady=true&hasDeliveryHistory=false&readyAction=deliver&transitionAction=escalated`, {
      headers: { "x-user-email": "owner-alpha@workflow.example" }
    }), options);
    const replayReadyList = await replayReadyListResponse.json() as any;
    expect(replayReadyListResponse.status).toBe(200);
    expect(replayReadyList.alerts.map((alert: any) => alert.id)).toEqual([alphaDarkweb.id]);
    expect(replayReadyList.alertQueueVisibility.filters).toMatchObject({
      replayReady: "true",
      deliveryReady: "true",
      caseReady: "true",
      hasDeliveryHistory: "false",
      readyAction: "deliver",
      transitionAction: "escalated"
    });

    const replayBlockedListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${alphaOrg.id}&replayReady=false&sourceFamily=darkweb_metadata`, {
      headers: { "x-user-email": "owner-alpha@workflow.example" }
    }), options);
    const replayBlockedList = await replayBlockedListResponse.json() as any;
    expect(replayBlockedListResponse.status).toBe(200);
    expect(replayBlockedList.alerts).toHaveLength(0);

    const alphaUpdatedDetailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alphaDarkweb.id}?organizationId=${alphaOrg.id}`, {
      headers: { "x-user-email": "owner-alpha@workflow.example" }
    }), options);
    const alphaUpdatedDetail = await alphaUpdatedDetailResponse.json() as any;
    expect(alphaUpdatedDetailResponse.status).toBe(200);
    expect(alphaUpdatedDetail.alert.alertDetailPath).toBe(alphaDarkweb.alertDetailPath);
    expect(alphaUpdatedDetail.alert.sourceProvenanceSummary).toMatchObject({
      schemaVersion: "dwm.alert_source_provenance.v1",
      sourceFamily: "darkweb_metadata",
      sourceFamilies: ["darkweb_metadata"],
      captureIds: expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"]),
      contentHashes: expect.arrayContaining(["hash-workflow-onion-acme", "hash-workflow-onion-acme-followup"])
    });
    expect(alphaUpdatedDetail.alert.orgWatchlistScope).toMatchObject({
      schemaVersion: "dwm.alert_org_watchlist_scope.v1",
      organizationId: alphaOrg.id,
      ownerOrganizationIds: [alphaOrg.id],
      watchlistIds: ["watch_workflow_alpha_acme"],
      watchlistItemIds: ["watch_item_workflow_alpha_acme"]
    });
    expect(alphaUpdatedDetail.alertEventSummary).toMatchObject({
      schemaVersion: "dwm.alert_event_summary.v1",
      eventTypes: ["dwm.alert.created", "dwm.alert.updated"],
      hasUpdatedEvent: true,
      updatedEvent: {
        eventType: "dwm.alert.updated",
        alertDetailPath: alphaDarkweb.alertDetailPath,
        addedCaptureIds: ["cap_workflow_onion_acme_followup"],
        captureIds: expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"])
      }
    });
    expect(alphaUpdatedDetail.timeline.find((event: any) => event.type === "alert_updated")).toMatchObject({
      id: preservedDarkweb.alertUpdatedEvent.id,
      type: "alert_updated",
      title: "Alert updated"
    });
    expect(alphaUpdatedDetail.evidenceReplay.map((item: any) => item.id)).toEqual(expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"]));
    expect(alphaUpdatedDetail.consumerContract).toMatchObject({
      schemaVersion: "dwm.alert_detail_consumer_contract.v1",
      route: "/v1/dwm/alerts/:id",
      alertDetailPath: alphaDarkweb.alertDetailPath,
      eventShapes: {
        created: "dwm.alert_created_event.v1",
        updated: "dwm.alert_updated_event.v1"
      },
      evidence: {
        sourceFamilies: ["darkweb_metadata"],
        evidenceCount: 2,
        metadataOnly: true,
        safeToShowCount: 2,
        captureIds: expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"]),
        contentHashes: expect.arrayContaining(["hash-workflow-onion-acme", "hash-workflow-onion-acme-followup"])
      },
      persistedReadModel: {
        sourceProvenanceSummary: "dwm.alert_source_provenance.v1",
        orgWatchlistScope: "dwm.alert_org_watchlist_scope.v1",
        sourceFamilies: ["darkweb_metadata"],
        captureIds: expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"]),
        watchlistIds: ["watch_workflow_alpha_acme"],
        watchlistItemIds: ["watch_item_workflow_alpha_acme"]
      },
      filters: {
        listRoute: "/v1/dwm/alerts",
        equivalentFilters: expect.arrayContaining(["organizationId", "sourceFamily", "eventType", "hasUpdatedEvent", "captureId"])
      },
      redaction: {
        rawSensitiveEvidenceIncluded: false,
        supportSafe: true
      }
    });
    expect(alphaUpdatedDetail.orgAlertWorkflowBridge).toMatchObject({
      schemaVersion: "dwm.org_alert_workflow_bridge.v1",
      ok: true,
      organizationId: alphaOrg.id,
      rows: [expect.objectContaining({
        watchlistId: "watch_workflow_alpha_acme",
        watchlistItemId: "watch_item_workflow_alpha_acme",
        matchedAlertIds: [alphaDarkweb.id],
        alertDetailPaths: [alphaDarkweb.alertDetailPath],
        sourceFamilies: ["darkweb_metadata"],
        eventPayloads: [expect.objectContaining({
          alertId: alphaDarkweb.id,
          organizationId: alphaOrg.id,
          watchlistItemId: "watch_item_workflow_alpha_acme",
          alertDetailPath: alphaDarkweb.alertDetailPath,
          captureIds: expect.arrayContaining(["cap_workflow_onion_acme", "cap_workflow_onion_acme_followup"])
        })],
        blockerCodes: []
      })]
    });
    expect(alphaUpdatedDetail.consumerContract.stableFields).toEqual(expect.arrayContaining([
      "alert.alertDetailPath",
      "alert.sourceProvenanceSummary",
      "alert.orgWatchlistScope",
      "workflowSummary",
      "alertEventSummary",
      "orgAlertWorkflowBridge",
      "evidenceReplay",
      "sourceExplanations",
      "provenanceFreshness"
    ]));
    expect(alphaUpdatedDetail.workflowSummary).toMatchObject({
      status: "investigating",
      assignedOwner: "owner-alpha-workflow",
      severityOverride: "high",
      caseId: "case_alpha_darkweb",
      eventCount: 1
    });

    const betaListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${betaOrg.id}`, {
      headers: { "x-user-email": "owner-beta@workflow.example" }
    }), options);
    const betaList = await betaListResponse.json() as any;
    expect(betaList.alerts).toHaveLength(1);
    expect(betaList.alerts[0]).toMatchObject({
      id: betaActor.id,
      organizationId: betaOrg.id,
      sourceFamily: "actor_page"
    });
    expect(JSON.stringify(betaList)).not.toContain("case_alpha_darkweb");
    expect(JSON.stringify(betaList)).not.toContain("webhook_workflow_alpha");

    const betaUpdatedListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${betaOrg.id}&eventType=dwm.alert.updated&hasUpdatedEvent=true`, {
      headers: { "x-user-email": "owner-beta@workflow.example" }
    }), options);
    const betaUpdatedList = await betaUpdatedListResponse.json() as any;
    expect(betaUpdatedList.alerts).toHaveLength(0);
    expect(betaUpdatedList.alertQueueVisibility.counts.visibleAlertCount).toBe(0);
    expect(JSON.stringify(betaUpdatedList)).not.toContain("cap_workflow_onion_acme_followup");
    expect(JSON.stringify(betaUpdatedList)).not.toContain("case_alpha_darkweb");

    const crossOrgDetailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alphaDarkweb.id}?organizationId=${betaOrg.id}`, {
      headers: { "x-user-email": "owner-beta@workflow.example" }
    }), options);
    const crossOrgDetail = await crossOrgDetailResponse.json() as any;
    expect(crossOrgDetailResponse.status).toBe(403);
    expect(crossOrgDetail.error.code).toBe("organization_visibility_denied");
    expect(JSON.stringify(crossOrgDetail)).not.toContain("case_alpha_darkweb");
    expect(JSON.stringify(crossOrgDetail)).not.toContain("cap_workflow_onion_acme");

    (store as any).saveDwmWatchlist({
      ...(store as any).getDwmWatchlist("watch_workflow_alpha_acme"),
      status: "paused",
      lifecycleStatus: "archived",
      updatedAt: "2026-06-27T21:12:00.000Z"
    });
    const archivedDetailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alphaDarkweb.id}?organizationId=${alphaOrg.id}`, {
      headers: { "x-user-email": "owner-alpha@workflow.example" }
    }), options);
    const archivedDetail = await archivedDetailResponse.json() as any;
    expect(archivedDetailResponse.status).toBe(200);
    expect(archivedDetail.workflowSummary).toMatchObject({
      status: "investigating",
      assignedOwner: "owner-alpha-workflow",
      severityOverride: "high",
      caseId: "case_alpha_darkweb",
      eventCount: 1
    });
    expect(archivedDetail.downstreamHandoff).toMatchObject({
      ready: false,
      blockerCodes: expect.arrayContaining(["retired_watchlist"]),
      lifecycle: {
        retiredWatchlistIds: ["watch_workflow_alpha_acme"],
        activeSourceMatch: true
      },
      deliverySelection: {
        ready: false,
        blockerCodes: expect.arrayContaining(["retired_watchlist"])
      }
    });
    expect(archivedDetail.downstreamHandoff.deliverySelection).not.toHaveProperty("selectedWebhookDestinationId");
    expect(archivedDetail.retentionAudit).toMatchObject({
      retentionState: "lifecycle_blocked_retained",
      cleanup: {
        deleteEligible: false,
        reviewRequired: true,
        retiredWatchlistIds: ["watch_workflow_alpha_acme"]
      }
    });
    const archivedReplayResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alphaDarkweb.id}/replay`, {
      method: "POST",
      headers: { "x-user-email": "owner-alpha@workflow.example" },
      body: JSON.stringify({ organizationId: alphaOrg.id })
    }), options);
    const archivedReplay = await archivedReplayResponse.json() as any;
    expect(archivedReplayResponse.status).toBe(200);
    expect(archivedReplay.workflowExecutionReadiness.blockerCodes).toEqual(expect.arrayContaining(["retired_watchlist"]));
    expect((store as any).getDwmAlert(alphaDarkweb.id).workflowEvents).toHaveLength(1);
    const archivedDeliveryResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
      method: "POST",
      headers: { "x-user-email": "owner-alpha@workflow.example" },
      body: JSON.stringify({ organizationId: alphaOrg.id, alertId: alphaDarkweb.id })
    }), options);
    const archivedDelivery = await archivedDeliveryResponse.json() as any;
    expect(archivedDeliveryResponse.status).toBe(200);
    expect(archivedDelivery.deliveries[0]).toMatchObject({
      status: "skipped",
      endpointHash: "retired_watchlist",
      error: "Delivery selection blocked by retired watchlist.",
      alertId: alphaDarkweb.id,
      organizationId: alphaOrg.id,
      tenantId: alphaOrg.id,
      dedupeKey: alphaDarkweb.dedupeKey,
      payloadHash: "not_sent",
      httpStatus: 0,
      watchlistId: "watch_workflow_alpha_acme"
    });

    (store as any).saveOrganization({
      ...(store as any).getOrganization(alphaOrg.id),
      status: "deleted",
      updatedAt: "2026-06-27T21:13:00.000Z"
    });
    const deletedOrgMutationResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alphaDarkweb.id}`, {
      method: "PATCH",
      headers: { "x-user-email": "owner-alpha@workflow.example" },
      body: JSON.stringify({
        organizationId: alphaOrg.id,
        status: "triaged",
        note: "Deleted org mutation must not append workflow events."
      })
    }), options);
    const deletedOrgMutation = await deletedOrgMutationResponse.json() as any;
    expect(deletedOrgMutationResponse.status).toBe(409);
    expect(deletedOrgMutation.error.code).toBe("archived_org");
    expect(deletedOrgMutation.workflowExecutionReadiness).toMatchObject({
      ready: false,
      action: "note",
      blockerCodes: expect.arrayContaining(["archived_org"]),
      currentWorkflowEventCount: 1
    });
    expect(deletedOrgMutation.downstreamHandoff).toMatchObject({
      ready: false,
      lifecycle: { organizationStatus: "deleted" },
      blockerCodes: expect.arrayContaining(["archived_org", "retired_watchlist"])
    });
    const deletedOrgAlert = (store as any).getDwmAlert(alphaDarkweb.id);
    expect(deletedOrgAlert.workflowEvents).toHaveLength(1);
    expect(deletedOrgAlert.workflowStatus).toBe("investigating");
    const deletedOrgListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${alphaOrg.id}`, {
      headers: { "x-user-email": "owner-alpha@workflow.example" }
    }), options);
    const deletedOrgList = await deletedOrgListResponse.json() as any;
    expect(deletedOrgListResponse.status).toBe(200);
    expect(deletedOrgList.alertQueueVisibility).toMatchObject({
      organizationLifecycleState: "deleted",
      watchlistScope: {
        blockedLifecycleCodes: expect.arrayContaining(["org_deleted", "retired_watchlist"])
      },
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: "org_deleted", field: "organization.status", recoverable: false }),
        expect.objectContaining({ code: "retired_watchlist", field: "alertQueue.lifecycle" })
      ])
    });
    const deletedOrgRebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      headers: { "x-user-email": "owner-alpha@workflow.example" },
      body: JSON.stringify({ organizationId: alphaOrg.id })
    }), options);
    const deletedOrgRebuild = await deletedOrgRebuildResponse.json() as any;
    expect(deletedOrgRebuildResponse.status).toBe(409);
    expect(deletedOrgRebuild.error.code).toBe("archived_org");
    const deletedOrgDeliveryResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
      method: "POST",
      headers: { "x-user-email": "owner-alpha@workflow.example" },
      body: JSON.stringify({ organizationId: alphaOrg.id, alertId: alphaDarkweb.id })
    }), options);
    const deletedOrgDelivery = await deletedOrgDeliveryResponse.json() as any;
    expect(deletedOrgDeliveryResponse.status).toBe(409);
    expect(deletedOrgDelivery.error.code).toBe("archived_org");
    expect((store as any).getDwmAlert(alphaDarkweb.id).workflowEvents).toHaveLength(1);

    const quietOrgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
      method: "POST",
      headers: { "x-user-email": "owner-quiet@workflow.example" },
      body: JSON.stringify({ name: "Workflow Quiet Org", ownerEmail: "owner-quiet@workflow.example", ownerUserId: "owner-quiet-workflow" })
    }), options);
    const quietOrg = (await quietOrgResponse.json() as any).organization;
    for (const watchlist of orgWatchlistContractToRuntimeDwmWatchlists({
      schemaVersion: "organization.watchlist_alert_generation.v1",
      organizationId: quietOrg.id,
      tenantId: quietOrg.id,
      ownerOrganizationId: quietOrg.id,
      visibilityPolicy: "members",
      entitlementStatus: "active",
      canGenerateAlerts: true,
      activeTerms: [{
        watchlistId: "watch_workflow_quiet_nomatch",
        watchlistItemId: "watch_item_workflow_quiet_nomatch",
        organizationId: quietOrg.id,
        tenantId: quietOrg.id,
        kind: "domain",
        termFamily: "domain",
        term: "quiet.example",
        category: "domain",
        status: "active",
        alertGenerationRef: workflowAlertGenerationRef({
          organizationId: quietOrg.id,
          watchlistItemId: "watch_item_workflow_quiet_nomatch",
          term: "quiet.example",
          termFamily: "domain"
        })
      }]
    })) {
      (store as any).saveDwmWatchlist(watchlist);
    }
    const quietReadinessResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/generation-readiness?organizationId=${quietOrg.id}`, {
      headers: { "x-user-email": "owner-quiet@workflow.example" }
    }), options);
    const quietReadiness = await quietReadinessResponse.json() as any;
    expect(quietReadinessResponse.status).toBe(200);
    expect(quietReadiness.readiness.zeroAlertProof).toMatchObject({
      schemaVersion: "dwm.zero_alert_proof.v1",
      zeroAlert: true,
      state: "blocked_no_matching_capture",
      expectedAlertDelta: 0,
      blockerCodes: expect.arrayContaining(["no_matching_captures", "missing_evidence"]),
      watchlistIds: ["watch_workflow_quiet_nomatch"],
      routes: {
        readiness: "/v1/dwm/alerts/readiness",
        rebuild: "/v1/dwm/alerts/rebuild",
        alerts: "/v1/dwm/alerts"
      },
      nextAction: "Add or collect a recent capture containing the active watchlist term."
    });
    const quietRebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      headers: { "x-user-email": "owner-quiet@workflow.example" },
      body: JSON.stringify({ organizationId: quietOrg.id })
    }), options);
    const quietRebuild = await quietRebuildResponse.json() as any;
    expect(quietRebuildResponse.status).toBe(200);
    expect(quietRebuild.savedAlertCount).toBe(0);
    expect(quietRebuild.zeroAlertProof).toMatchObject({
      schemaVersion: "dwm.zero_alert_proof.v1",
      zeroAlert: true,
      state: "blocked_no_matching_capture",
      expectedAlertDelta: 0,
      blockerCodes: expect.arrayContaining(["no_matching_captures", "missing_evidence"])
    });
    const quietListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${quietOrg.id}`, {
      headers: { "x-user-email": "owner-quiet@workflow.example" }
    }), options);
    const quietList = await quietListResponse.json() as any;
    expect(quietListResponse.status).toBe(200);
    expect(quietList.alerts).toHaveLength(0);
    expect(quietList.alertQueueVisibility).toMatchObject({
      schemaVersion: "dwm.org_alert_queue_visibility.v1",
      organizationId: quietOrg.id,
      counts: {
        visibleAlertCount: 0,
        expectedAlertDelta: 0,
        matchedCandidateCount: 0,
        unmatchedCandidateCount: 1
      },
      generationReadiness: {
        readyForRebuild: true,
        readyForCustomerDelivery: false,
        blockerCodes: expect.arrayContaining(["no_matching_captures", "missing_evidence"]),
        sourceFamilyCoverage: [{
          sourceFamily: "unknown",
          candidateCount: 1,
          captureRefCount: 0,
          watchlistIds: ["watch_workflow_quiet_nomatch"]
        }],
        sourceFamilyGaps: expect.arrayContaining([
          expect.objectContaining({
            schemaVersion: "dwm.alert_source_family_gap.v1",
            sourceFamily: "telegram_public",
            state: "active_no_match",
            active: true,
            blockerCode: "no_matching_captures",
            watchlistIds: ["watch_workflow_quiet_nomatch"]
          }),
          expect.objectContaining({
            schemaVersion: "dwm.alert_source_family_gap.v1",
            sourceFamily: "darkweb_metadata",
            state: "active_no_match",
            active: true,
            blockerCode: "no_matching_captures"
          }),
          expect.objectContaining({
            schemaVersion: "dwm.alert_source_family_gap.v1",
            sourceFamily: "public_advisory",
            state: "inactive_or_unconfigured",
            blockerCode: "source_family_inactive"
          })
        ]),
        zeroAlertProof: {
          schemaVersion: "dwm.zero_alert_proof.v1",
          zeroAlert: true,
          state: "blocked_no_matching_capture",
          expectedAlertDelta: 0,
          nextAction: "Add or collect a recent capture containing the active watchlist term."
        }
      },
      zeroAlertProof: {
        state: "blocked_no_matching_capture",
        watchlistTerms: [{
          term: "quiet.example",
          watchlistItemIds: ["watch_item_workflow_quiet_nomatch"],
          hasMatchingCaptures: false,
          captureRefCount: 0
        }]
      },
      consumerContract: {
        schemaVersion: "dwm.alert_queue_consumer_contract.v1",
        stableFields: expect.arrayContaining([
          "alerts[].workflowSummary",
          "alerts[].alertEventSummary",
          "alertQueueVisibility.zeroAlertProof",
          "alertQueueVisibility.generationReadiness.sourceFamilyGaps"
        ]),
        filters: expect.arrayContaining(["organizationId", "watchlistItemId", "captureId"]),
        zeroAlertContract: "dwm.zero_alert_proof.v1"
      }
    });
  });
});

function workflowAlertGenerationRef(input: {
  organizationId: string;
  watchlistItemId: string;
  term: string;
  termFamily: "company" | "domain" | "vendor" | "actor" | "keyword";
}) {
  const normalizedTerm = input.term.toLowerCase();
  const key = `org:${input.organizationId}:watchlist:${input.watchlistItemId}:${input.termFamily}:${normalizedTerm}`;
  return {
    schemaVersion: "organization.watchlist_alert_generation_ref.v1" as const,
    source: "organization_shared_watchlist" as const,
    organizationId: input.organizationId,
    tenantId: input.organizationId,
    ownerOrganizationId: input.organizationId,
    watchlistId: input.watchlistItemId,
    watchlistItemId: input.watchlistItemId,
    itemId: input.watchlistItemId,
    termFamily: input.termFamily,
    category: input.termFamily,
    term: input.term,
    normalizedTerm,
    status: "active" as const,
    lifecycle: {
      status: "active" as const,
      reason: "Workflow persistence org bridge fixture.",
      requestId: `req-${input.watchlistItemId}`,
      createdBy: "workflow-persistence-test",
      updatedBy: "workflow-persistence-test"
    },
    dedupe: {
      scope: "organization_watchlist_term" as const,
      key,
      parts: {
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        watchlistItemId: input.watchlistItemId,
        termFamily: input.termFamily,
        normalizedTerm
      }
    }
  };
}
