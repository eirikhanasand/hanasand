import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("case workflow transition replay contract", () => {
  test("records idempotent case transitions with workflow provenance", async () => {
    const { options, store } = fixtureRuntime();

    const first = await patchCase(options, {
      action: "escalate",
      assignedOwner: "owner@acme.com",
      note: "Escalating to the incident lead.",
      idempotencyKey: "case-transition-escalate-001"
    });
    const firstPayload = await first.json() as any;
    const duplicate = await patchCase(options, {
      action: "escalate",
      assignedOwner: "owner@acme.com",
      note: "Escalating to the incident lead.",
      idempotencyKey: "case-transition-escalate-001"
    });
    const duplicatePayload = await duplicate.json() as any;
    const detail = await handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_acme?organizationId=org_acme", {
      headers: { "x-user-email": "owner@acme.com" }
    }), options);
    const detailPayload = await detail.json() as any;

    expect(first.status).toBe(200);
    expect(firstPayload).toMatchObject({
      replayed: false,
      duplicate: false,
      workflowTransition: {
        schemaVersion: "analyst.case_workflow_transition.v1",
        caseId: "case_acme",
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        alertId: "alert_acme",
        action: "escalate",
        fromStatus: "open",
        toStatus: "escalated",
        fromOwner: "owner@acme.com",
        toOwner: "owner@acme.com",
        workflowState: {
          status: "escalated",
          assignedOwner: "owner@acme.com",
          replayState: "recorded",
          idempotencyKey: "case-transition-escalate-001",
          dedupeKey: expect.stringMatching(/^case_workflow_transition_/)
        },
        provenance: {
          source: "case_workflow",
          caseId: "case_acme",
          alertId: "alert_acme",
          auditEventId: expect.stringMatching(/^case_workflow_audit_/),
          eventId: expect.stringMatching(/^case_event_/)
        }
      }
    });
    expect(duplicate.status).toBe(200);
    expect(duplicatePayload).toMatchObject({
      replayed: true,
      duplicate: true,
      workflowTransition: {
        workflowState: {
          replayState: "replayed",
          idempotencyKey: "case-transition-escalate-001",
          dedupeKey: firstPayload.workflowTransition.workflowState.dedupeKey
        },
        provenance: {
          auditEventId: firstPayload.workflowTransition.provenance.auditEventId
        }
      }
    });
    expect((store as any).getCase("case_acme").workflowEvents).toHaveLength(1);
    expect(detailPayload.workflowState.latestTransition.workflowState).toMatchObject({
      status: "escalated",
      idempotencyKey: "case-transition-escalate-001",
      dedupeKey: firstPayload.workflowTransition.workflowState.dedupeKey
    });
    expect(JSON.stringify({ firstPayload, duplicatePayload, detailPayload })).not.toContain("https://discord.com");
  });

  test("blocks unsupported transitions, closed-state mutation, and unauthorized members", async () => {
    const { options, store } = fixtureRuntime();

    const unsupported = await patchCase(options, { action: "delete_case", note: "Unsupported action." });
    const unsupportedPayload = await unsupported.json() as any;
    store.saveCase({ ...(store as any).getCase("case_acme"), status: "closed", updatedAt: "2026-06-29T16:00:00.000Z" });
    const invalidClosed = await patchCase(options, {
      action: "escalate",
      note: "Closed cases must reopen before escalation.",
      idempotencyKey: "case-transition-invalid-closed"
    });
    const invalidClosedPayload = await invalidClosed.json() as any;
    const viewer = await handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_acme", {
      method: "PATCH",
      headers: { "x-user-email": "viewer@acme.com" },
      body: JSON.stringify({ organizationId: "org_acme", action: "reopen" })
    }), options);
    const viewerPayload = await viewer.json() as any;
    const removed = await handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_acme", {
      method: "PATCH",
      headers: { "x-user-email": "removed@acme.com" },
      body: JSON.stringify({ organizationId: "org_acme", action: "reopen" })
    }), options);
    const removedPayload = await removed.json() as any;

    expect(unsupported.status).toBe(400);
    expect(unsupportedPayload.error).toMatchObject({ code: "unsupported_case_action" });
    expect(invalidClosed.status).toBe(409);
    expect(invalidClosedPayload.error).toMatchObject({
      code: "invalid_case_transition",
      fromStatus: "closed",
      requestedAction: "escalate",
      requestedStatus: "escalated"
    });
    expect(viewer.status).toBe(403);
    expect(viewerPayload.error.code).toBe("case_read_only_member");
    expect(removed.status).toBe(403);
    expect(removedPayload.visibilityDecision).toMatchObject({ allowed: false, reason: "member_removed" });
    expect((store as any).getCase("case_acme").workflowEvents).toEqual([]);
  });
});

async function patchCase(options: ReturnType<typeof fixtureRuntime>["options"], body: Record<string, unknown>) {
  return handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_acme", {
    method: "PATCH",
    headers: { "x-user-email": "owner@acme.com" },
    body: JSON.stringify({ organizationId: "org_acme", ...body })
  }), options);
}

function fixtureRuntime() {
  const store = new InMemoryScraperStore();
  store.saveOrganization({ id: "org_acme", tenantId: "tenant_acme", name: "Acme", slug: "acme", status: "active", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
  store.saveOrganizationMember({ id: "member_owner", organizationId: "org_acme", email: "owner@acme.com", role: "owner", status: "active", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
  store.saveOrganizationMember({ id: "member_viewer", organizationId: "org_acme", email: "viewer@acme.com", role: "viewer", status: "active", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
  store.saveOrganizationMember({ id: "member_removed", organizationId: "org_acme", email: "removed@acme.com", role: "analyst", status: "removed", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
  store.saveCase({
    id: "case_acme",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    sourceType: "dwm_alert",
    sourceId: "alert_acme",
    alertId: "alert_acme",
    title: "Acme exposure",
    summary: "Review Acme exposure.",
    priority: "high",
    status: "open",
    assignedOwner: "owner@acme.com",
    createdAt: "2026-06-29T15:00:00.000Z",
    updatedAt: "2026-06-29T15:00:00.000Z",
    workflowEvents: []
  });
  return { store, options: { store, frontier: new FocusedFrontier() } };
}
