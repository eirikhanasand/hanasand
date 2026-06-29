import { describe, expect, test } from "bun:test";
import {
  DWM_ALERT_WORKFLOW_ADMIN_AUDIT_SCHEMA_VERSION,
  DWM_ALERT_WORKFLOW_CONTRACT_SCHEMA_VERSION,
  DWM_ALERT_WORKFLOW_PRESERVATION_SCHEMA_VERSION,
  DWM_ALERT_WORKFLOW_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION,
  DWM_ALERT_WORKFLOW_SUPPORT_EVIDENCE_PACKET_SCHEMA_VERSION,
  buildAlertWorkflowAdminAuditAdapter,
  buildAlertWorkflowContract,
  buildAlertWorkflowSupportEvidencePacket,
  buildAlertWorkflowSupportActionRequest,
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
        contentHashes: ["hash_acme_initial"],
        sourceFamilies: ["telegram_public", "darkweb_metadata"],
        firstObservedAt: "2026-06-29T12:00:00.000Z",
        lastObservedAt: "2026-06-29T12:05:00.000Z"
      },
      orgWatchlistScope: {
        schemaVersion: "dwm.alert_org_watchlist_scope.v1",
        organizationId: "org_acme",
        ownerOrganizationIds: ["org_acme"],
        watchlistIds: ["watch_acme"],
        watchlistItemIds: ["watch_item_acme_domain"],
        alertGeneratorKeys: ["org:org_acme:watchlist:watch_item_acme_domain:domain:acme.com"]
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

  test("builds support action preparation request from preserved alert workflow audit", () => {
    const report = validateAlertWorkflowPreservation({
      before: fixture.before as any,
      after: fixture.after as any,
      checkedAt: fixture.checkedAt
    });
    const request = buildAlertWorkflowSupportActionRequest({
      adapter: buildAlertWorkflowAdminAuditAdapter({ report, actorId: "support_admin" }),
      requestId: "req_alert_workflow_support"
    });

    expect(request).toMatchObject({
      schemaVersion: DWM_ALERT_WORKFLOW_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION,
      ok: true,
      adminSupportContract: {
        schemaVersion: "support.action_prepare.v1",
        method: "GET",
        route: "/api/admin/support/inspect",
        query: {
          org: "org_acme",
          entity: "alert_acme_lumma",
          entityType: "dwm_alert",
          action: "support.alert.inspect_workflow",
          prepareAction: "inspect_alert_workflow",
          requestId: "req_alert_workflow_support"
        }
      },
      target: {
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        alertId: "alert_acme_lumma",
        caseId: "case_acme_lumma",
        casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"
      },
      redaction: {
        required: true,
        attestation: "support_safe_metadata_only"
      },
      auditPreview: {
        actionType: "support.alert.inspect_workflow",
        source: "dwm.alert_workflow_admin_audit",
        outcome: "prepared",
        blockerCodes: [],
        ownerLanes: []
      },
      blockers: []
    });
    expect(request.adminSupportContract.query.idempotencyKey).toMatch(/^dwm_alert_workflow_support_action_/);
    expect(JSON.stringify(request)).not.toContain("evidence_acme_initial");
  });

  test("packages alert workflow audit and support request as redacted evidence", () => {
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
    const supportRequest = buildAlertWorkflowSupportActionRequest({
      adapter,
      requestId: "req_alert_workflow_support"
    });
    const packet = buildAlertWorkflowSupportEvidencePacket({
      adapter,
      supportRequest,
      generatedAt: "2026-06-29T13:08:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: DWM_ALERT_WORKFLOW_SUPPORT_EVIDENCE_PACKET_SCHEMA_VERSION,
      generatedAt: "2026-06-29T13:08:00.000Z",
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme_lumma",
      caseId: "case_acme_lumma",
      redacted: true,
      support: {
        route: "/api/admin/support/inspect",
        probeId: "support.alert.workflow_evidence_packet",
        entityType: "dwm_alert",
        action: "support.alert.inspect_workflow",
        prepareAction: "inspect_alert_workflow",
        customerVisible: false
      },
      auditEvents: [{
        schemaVersion: DWM_ALERT_WORKFLOW_ADMIN_AUDIT_SCHEMA_VERSION,
        eventType: "dwm.alert.workflow_preservation_checked",
        outcome: "allowed",
        actorId: "support_admin",
        requestId: "req_workflow_preservation",
        blockerCodes: [],
        ownerLanes: []
      }],
      proof: {
        adapterId: adapter.id,
        supportRequestId: supportRequest.id,
        reportSchemaVersion: DWM_ALERT_WORKFLOW_PRESERVATION_SCHEMA_VERSION,
        beforeContractId: "dwm_alert_workflow_contract_fixture_before",
        afterContractId: "dwm_alert_workflow_contract_fixture_after",
        checkedAt: "2026-06-29T13:06:00.000Z",
        evidenceSummary: {
          evidenceCount: 2,
          captureCount: 2,
          sourceCount: 1,
          contentHashCount: 2,
          sourceFamilies: []
        }
      },
      blockers: [],
      nextActions: []
    });
    expect(packet.support.idempotencyKey).toMatch(/^dwm_alert_workflow_support_action_/);
    expect(JSON.stringify(packet)).not.toContain("hash_acme_initial");
    expect(JSON.stringify(packet)).not.toContain("evidence_acme_initial");
    expect(JSON.stringify(packet)).not.toContain(["control", "room"].join(" "));
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
        sourceProvenanceSummary: undefined,
        orgWatchlistScope: undefined,
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
      "provenance_dropped",
      "org_watchlist_scope_dropped"
    ]));
    expect(report.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerLane: "alert", path: "organizationId" }),
      expect.objectContaining({ ownerLane: "case", path: "casePath" }),
      expect.objectContaining({ ownerLane: "webhook", path: "deliveryState" }),
      expect.objectContaining({ ownerLane: "source", path: "provenance" }),
      expect.objectContaining({ ownerLane: "alert", path: "orgWatchlistScope" })
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
        sourceProvenanceSummary: undefined,
        orgWatchlistScope: undefined,
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

  test("blocks support action preparation when alert workflow audit is unresolved", () => {
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
        sourceProvenanceSummary: undefined,
        orgWatchlistScope: undefined,
        evidence: []
      }
    });
    const report = validateAlertWorkflowPreservation({
      before,
      after,
      checkedAt: "2026-06-29T13:07:00.000Z"
    });
    const request = buildAlertWorkflowSupportActionRequest({
      adapter: buildAlertWorkflowAdminAuditAdapter({ report }),
      requestId: "req_blocked_alert_workflow"
    });

    expect(request).toMatchObject({
      ok: false,
      adminSupportContract: {
        query: {
          action: "support.alert.restore_workflow",
          prepareAction: "restore_alert_workflow"
        }
      },
      auditPreview: {
        outcome: "blocked",
        actionType: "support.alert.restore_workflow",
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
      }
    });
    expect(request.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "audit_blocked", ownerLane: "alert", path: "organizationId" }),
      expect.objectContaining({ code: "audit_blocked", ownerLane: "case", path: "casePath" }),
      expect.objectContaining({ code: "audit_blocked", ownerLane: "source", path: "provenance" })
    ]));
  });

  test("keeps blocked alert workflow support evidence actionable without raw payloads", () => {
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
        sourceProvenanceSummary: undefined,
        orgWatchlistScope: undefined,
        evidence: []
      }
    });
    const report = validateAlertWorkflowPreservation({
      before,
      after,
      checkedAt: "2026-06-29T13:07:00.000Z"
    });
    const adapter = buildAlertWorkflowAdminAuditAdapter({ report, requestId: "req_blocked_workflow" });
    const packet = buildAlertWorkflowSupportEvidencePacket({
      adapter,
      requestId: "req_blocked_alert_workflow",
      generatedAt: "2026-06-29T13:09:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: DWM_ALERT_WORKFLOW_SUPPORT_EVIDENCE_PACKET_SCHEMA_VERSION,
      ok: false,
      support: {
        route: "/api/admin/support/inspect",
        probeId: "support.alert.workflow_evidence_packet",
        action: "support.alert.restore_workflow",
        prepareAction: "restore_alert_workflow",
        customerVisible: false
      },
      auditEvents: [{
        outcome: "blocked",
        requestId: "req_blocked_workflow",
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
      }],
      proof: {
        evidenceSummary: {
          evidenceCount: 0,
          captureCount: 0,
          sourceCount: 0,
          contentHashCount: 0
        }
      }
    });
    expect(packet.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "audit_blocked", ownerLane: "alert", path: "organizationId" }),
      expect.objectContaining({ code: "support_request_blocked", ownerLane: "case", path: "casePath" }),
      expect.objectContaining({ code: "support_request_blocked", ownerLane: "source", path: "provenance" })
    ]));
    expect(packet.nextActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerLane: "case", blockerCode: "case_route_dropped", action: "restore_case_route" }),
      expect.objectContaining({ ownerLane: "source", blockerCode: "provenance_dropped", action: "restore_provenance" })
    ]));
    expect(JSON.stringify(packet)).not.toContain("hash_acme_initial");
    expect(JSON.stringify(packet)).not.toContain("evidence_acme_initial");
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
    sourceFamily: "telegram_public",
    provenance: { captureIds: ["cap_acme_initial"], sourceFamilies: ["telegram_public"] },
    sourceProvenanceSummary: {
      schemaVersion: "dwm.alert_source_provenance.v1",
      sourceFamily: "telegram_public",
      sourceFamilies: ["telegram_public", "darkweb_metadata"],
      captureIds: ["cap_acme_initial"],
      sourceIds: ["src_acme_tg"],
      contentHashes: ["hash_acme_initial"],
      firstObservedAt: "2026-06-29T12:00:00.000Z",
      lastObservedAt: "2026-06-29T12:05:00.000Z",
      generationEvidenceWindow: {
        captureIds: ["cap_acme_initial"],
        sourceFamilies: ["telegram_public", "darkweb_metadata"],
        contentHashes: ["hash_acme_initial"],
        firstObservedAt: "2026-06-29T12:00:00.000Z",
        lastObservedAt: "2026-06-29T12:05:00.000Z"
      }
    },
    orgWatchlistScope: {
      schemaVersion: "dwm.alert_org_watchlist_scope.v1",
      organizationId: "org_acme",
      ownerOrganizationIds: ["org_acme"],
      watchlistIds: ["watch_acme"],
      watchlistItemIds: ["watch_item_acme_domain"],
      alertGeneratorKeys: ["org:org_acme:watchlist:watch_item_acme_domain:domain:acme.com"]
    },
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
