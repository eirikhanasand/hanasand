import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir } from "./apiTestHarness.ts";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
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
      expect(detail.evidenceReplay[0]).toMatchObject({ sourceName: "Workflow public Telegram", contentHash: "hash-workflow-acme" });
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
    expect(triage.alert.caseHandoff.payload.body).toMatchObject({
      organizationId,
      alertId: alert.id,
      caseIdCandidate: alert.caseIdCandidate,
      casePath: `/v1/cases/case_workflow_live?alertId=${alert.id}`,
      captureIds: ["cap_workflow_acme"]
    });
    expect(triage.alert.nextBestAction).toMatchObject({ action: "investigate_or_route", route: "identity_response" });
    expect(triage.alert.deliveryReadiness).toMatchObject({ ready: false, state: "missing_route", evidenceCount: 1 });
    expect(triage.alert.deliveryReadiness.persistedContext).toMatchObject({
      schemaVersion: "dwm.alert_delivery_persistence.v1",
      organizationId,
      alertGeneratorKeys: [],
      selectedCaptureIds: ["cap_workflow_acme"],
      blockerCodes: expect.arrayContaining(["missing_org_ref", "delivery_disabled"])
    });
    expect(triage.alert.evidenceFreshness).toMatchObject({ newestEvidenceAt: "2026-06-27T21:02:00.000Z", evidenceCount: 1, captureIds: ["cap_workflow_acme"] });
    expect(triage.alert.provenanceFreshness).toMatchObject({ matchBasis: "watchlist_capture_text", captureIds: ["cap_workflow_acme"], dedupeKey: alert.dedupeKey });

    const filteredTriageResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${organizationId}&status=triaged&assignee=owner-workflow&severity=critical&sourceFamily=telegram_public&q=acme.com`, {
      headers: { "x-user-email": "owner@workflow.example" }
    }), options);
    const filteredTriage = await filteredTriageResponse.json() as any;
    expect(filteredTriageResponse.status).toBe(200);
    expect(filteredTriage.alerts).toHaveLength(1);
    expect(filteredTriage.alerts[0].workflowSummary).toMatchObject({ status: "triaged", assignedOwner: "owner-workflow", caseId: "case_workflow_live" });

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
    expect(closed.alert.closedAt).toBeTruthy();

    const listClosedResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${organizationId}&status=closed&watchlistId=${alert.watchlistIds[0]}&captureId=cap_workflow_acme`, {
      headers: { "x-user-email": "owner@workflow.example" }
    }), options);
    const listClosed = await listClosedResponse.json() as any;
    expect(listClosed.alerts).toHaveLength(1);
    expect(listClosed.alerts[0].workflowSummary).toMatchObject({ status: "closed", eventCount: 3 });
    expect(listClosed.alerts[0].deliveryReadiness).toMatchObject({ ready: false, state: "closed" });

    const reopenedResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "x-user-email": "owner@workflow.example" },
      body: JSON.stringify({ organizationId, action: "reopen", note: "New duplicate replay should not wipe state." })
    }), options);
    const reopened = await reopenedResponse.json() as any;
    expect(reopenedResponse.status).toBe(200);
    expect(reopened.alert.workflowSummary).toMatchObject({ status: "reopened", eventCount: 4 });

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
    expect(detail.caseHandoff.payload.body).toMatchObject({
      organizationId,
      alertId: alert.id,
      caseIdCandidate: alert.caseIdCandidate,
      casePath: `/v1/cases/case_workflow_live?alertId=${alert.id}`,
      watchlistItemIds: expect.arrayContaining([expect.stringContaining("acme.com")])
    });
    expect(detail.nextBestAction).toMatchObject({ action: "investigate_or_route" });
    expect(detail.deliveryReadiness).toMatchObject({ ready: false, blocker: "missing_webhook_route" });
    expect(detail.evidenceFreshness).toMatchObject({ evidenceCount: 1, newestEvidenceAt: "2026-06-27T21:02:00.000Z" });
    expect(detail.provenanceFreshness).toMatchObject({ matchBasis: "watchlist_capture_text", captureIds: ["cap_workflow_acme"] });
  });
});
