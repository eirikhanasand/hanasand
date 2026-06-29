import { describe, expect, test } from "bun:test";
import {
  DWM_ALERT_WORKFLOW_ADMIN_AUDIT_SCHEMA_VERSION,
  DWM_ALERT_WORKFLOW_CONTRACT_SCHEMA_VERSION,
  DWM_ALERT_WORKFLOW_PRESERVATION_SCHEMA_VERSION,
  buildAlertWorkflowAdminAuditAdapter,
  buildAlertWorkflowContract,
  validateAlertWorkflowPreservation
} from "../product/alertWorkflowContract.ts";
import fixture from "./fixtures/alert-workflow-preservation-happy.json";

describe("alert workflow preservation contract", () => {
  test("validates alert workflow state survives rebuild-style refreshes", () => {
    const before = buildAlertWorkflowContract({
      alert: alertFixture(),
      checkedAt: "2026-06-29T13:00:00.000Z"
    });
    const after = buildAlertWorkflowContract({
      alert: {
        ...alertFixture(),
        updatedAt: "2026-06-29T13:05:00.000Z",
        evidence: [...alertFixture().evidence, {
          id: "evidence_acme_followup",
          sourceId: "src_acme_tg",
          contentHash: "hash_acme_followup"
        }],
        provenance: { captureIds: ["cap_acme_initial", "cap_acme_followup"] },
        workflowContext: {
          ...alertFixture().workflowContext,
          captureIds: ["cap_acme_initial", "cap_acme_followup"],
          evidenceCount: 2
        }
      },
      checkedAt: "2026-06-29T13:05:00.000Z"
    });
    const report = validateAlertWorkflowPreservation({
      before,
      after,
      checkedAt: "2026-06-29T13:06:00.000Z"
    });

    expect(before).toMatchObject({
      schemaVersion: DWM_ALERT_WORKFLOW_CONTRACT_SCHEMA_VERSION,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme_lumma",
      reviewState: "route_to_customer",
      deliveryState: "ready_to_send",
      assignedOwner: "ir-lead",
      caseId: "case_acme_lumma",
      workflowEventCount: 2,
      provenance: {
        evidenceCount: 1,
        captureIds: ["cap_acme_initial"],
        sourceIds: ["src_acme_tg"],
        contentHashes: ["hash_acme_initial"]
      }
    });
    expect(report).toMatchObject({
      schemaVersion: DWM_ALERT_WORKFLOW_PRESERVATION_SCHEMA_VERSION,
      ok: true,
      blockers: [],
      preserved: {
        tenant: true,
        organization: true,
        caseRoute: true,
        owner: true,
        reviewState: true,
        deliveryState: true,
        eventCountMonotonic: true,
        provenance: true
      }
    });
  });

  test("validates checked-in preservation fixture", () => {
    const report = validateAlertWorkflowPreservation({
      before: fixture.before as any,
      after: fixture.after as any,
      checkedAt: fixture.checkedAt
    });
    expect(report.ok).toBe(true);
    expect(report.preserved).toMatchObject(fixture.preserved);
  });

  test("emits redacted admin audit metadata for preserved alert workflow", () => {
    const report = validateAlertWorkflowPreservation({
      before: fixture.before as any,
      after: fixture.after as any,
      checkedAt: fixture.checkedAt
    });
    const adapter = buildAlertWorkflowAdminAuditAdapter({
      report,
      actorId: "support_admin",
      requestId: "req_workflow_preservation"
    });

    expect(adapter).toMatchObject({
      schemaVersion: DWM_ALERT_WORKFLOW_ADMIN_AUDIT_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme_lumma",
      caseId: "case_acme_lumma",
      audit: {
        eventType: "dwm.alert.workflow_preservation_checked",
        source: "alert_workflow_preservation",
        outcome: "allowed",
        actorId: "support_admin",
        requestId: "req_workflow_preservation",
        redacted: true,
        blockerCodes: [],
        ownerLanes: []
      },
      helpdesk: {
        redacted: true,
        lookupKey: "org_acme",
        customerVisible: false,
        routeHints: {
          alertDetail: "/v1/dwm/alerts/alert_acme_lumma",
          caseDetail: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"
        }
      },
      workflow: {
        beforeEventCount: 2,
        afterEventCount: 2,
        latestWorkflowEventId: "event_escalate",
        reviewState: "route_to_customer",
        deliveryState: "ready_to_send",
        assignedOwner: "ir-lead"
      },
      proof: {
        reportSchemaVersion: DWM_ALERT_WORKFLOW_PRESERVATION_SCHEMA_VERSION,
        checkedAt: "2026-06-29T13:06:00.000Z",
        beforeContractId: "dwm_alert_workflow_contract_fixture_before",
        afterContractId: "dwm_alert_workflow_contract_fixture_after"
      },
      nextActions: []
    });
    expect(adapter.helpdesk.supportSummary).toBe("Alert workflow state is preserved across refresh.");
    expect(JSON.stringify(adapter)).not.toContain(["dashboard", "slop"].join(" "));
    expect(JSON.stringify(adapter)).not.toContain(["control", "room"].join(" "));
  });

  test("returns owner-coded blockers when workflow state is dropped", () => {
    const before = buildAlertWorkflowContract({ alert: alertFixture() });
    const after = buildAlertWorkflowContract({
      alert: {
        ...alertFixture(),
        organizationId: "org_other",
        reviewState: "new",
        deliveryState: "pending_review",
        assignedOwner: undefined,
        caseId: undefined,
        caseIdCandidate: undefined,
        casePath: undefined,
        workflowEvents: [],
        provenance: { captureIds: [] },
        workflowContext: {},
        webhookContext: {},
        evidence: []
      }
    });
    const report = validateAlertWorkflowPreservation({
      before,
      after,
      checkedAt: "2026-06-29T13:07:00.000Z"
    });
    const codes = report.blockers.map((item) => item.code);
    expect(report.ok).toBe(false);
    expect(codes).toEqual(expect.arrayContaining([
      "organization_scope_changed",
      "case_route_dropped",
      "owner_dropped",
      "review_state_regressed",
      "delivery_state_regressed",
      "workflow_events_regressed",
      "provenance_dropped"
    ]));
    expect(report.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerLane: "alert", path: "organizationId" }),
      expect.objectContaining({ ownerLane: "case", path: "casePath" }),
      expect.objectContaining({ ownerLane: "webhook", path: "deliveryState" }),
      expect.objectContaining({ ownerLane: "source", path: "provenance" })
    ]));
  });

  test("maps preservation blockers into admin audit actions without leaking workflow payloads", () => {
    const before = buildAlertWorkflowContract({ alert: alertFixture() });
    const after = buildAlertWorkflowContract({
      alert: {
        ...alertFixture(),
        organizationId: "org_other",
        reviewState: "new",
        deliveryState: "pending_review",
        assignedOwner: undefined,
        caseId: undefined,
        caseIdCandidate: undefined,
        casePath: undefined,
        workflowEvents: [],
        provenance: { captureIds: [] },
        workflowContext: {},
        webhookContext: {},
        evidence: []
      }
    });
    const report = validateAlertWorkflowPreservation({
      before,
      after,
      checkedAt: "2026-06-29T13:07:00.000Z"
    });
    const adapter = buildAlertWorkflowAdminAuditAdapter({ report, requestId: "req_blocked_workflow" });

    expect(adapter.audit).toMatchObject({
      outcome: "blocked",
      requestId: "req_blocked_workflow",
      redacted: true,
      blockerCodes: expect.arrayContaining([
        "organization_scope_changed",
        "case_route_dropped",
        "owner_dropped",
        "review_state_regressed",
        "delivery_state_regressed",
        "workflow_events_regressed",
        "provenance_dropped"
      ]),
      ownerLanes: expect.arrayContaining(["alert", "case", "webhook", "source"])
    });
    expect(adapter.helpdesk).toMatchObject({
      redacted: true,
      blockedAction: "preserve_alert_workflow",
      customerVisible: false,
      routeHints: {
        alertDetail: "/v1/dwm/alerts/alert_acme_lumma",
        caseDetail: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"
      }
    });
    expect(adapter.nextActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerLane: "alert", blockerCode: "organization_scope_changed", action: "inspect_alert_scope" }),
      expect.objectContaining({ ownerLane: "case", blockerCode: "case_route_dropped", action: "restore_case_route" }),
      expect.objectContaining({ ownerLane: "webhook", blockerCode: "delivery_state_regressed", action: "restore_delivery_state" }),
      expect.objectContaining({ ownerLane: "source", blockerCode: "provenance_dropped", action: "restore_provenance" })
    ]));
    expect(JSON.stringify(adapter)).not.toContain("hash_acme_initial");
    expect(JSON.stringify(adapter)).not.toContain("evidence_acme_initial");
  });
});

function alertFixture() {
  return {
    id: "alert_acme_lumma",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    reviewState: "route_to_customer",
    deliveryState: "ready_to_send",
    workflowStatus: "triaged",
    assignedOwner: "ir-lead",
    severityOverride: "high",
    caseId: "case_acme_lumma",
    caseIdCandidate: "case_acme_lumma",
    casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
    dedupeKey: "dedupe_acme_lumma",
    provenance: { captureIds: ["cap_acme_initial"] },
    workflowContext: {
      organizationId: "org_acme",
      caseId: "case_acme_lumma",
      caseIdCandidate: "case_acme_lumma",
      casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
      captureIds: ["cap_acme_initial"],
      evidenceCount: 1,
      dedupeKey: "dedupe_acme_lumma"
    },
    workflowEvents: [{
      id: "event_triage",
      at: "2026-06-29T12:00:00.000Z"
    }, {
      id: "event_escalate",
      at: "2026-06-29T12:05:00.000Z"
    }],
    evidence: [{
      id: "evidence_acme_initial",
      sourceId: "src_acme_tg",
      contentHash: "hash_acme_initial"
    }]
  };
}
