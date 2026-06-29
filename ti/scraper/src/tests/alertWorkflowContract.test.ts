import { describe, expect, test } from "bun:test";
import {
  DWM_ALERT_ANALYST_CASE_LEDGER_ADAPTER_SCHEMA_VERSION,
  DWM_ALERT_ANALYST_WORKFLOW_EVENT_SCHEMA_VERSION,
  DWM_ALERT_WORKFLOW_ADMIN_AUDIT_SCHEMA_VERSION,
  DWM_ALERT_PROVENANCE_CONSUMER_PACKET_SCHEMA_VERSION,
  DWM_ALERT_WORKFLOW_CONTRACT_SCHEMA_VERSION,
  DWM_ALERT_WORKFLOW_PRESERVATION_SCHEMA_VERSION,
  DWM_ALERT_WORKFLOW_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION,
  DWM_ALERT_WORKFLOW_SUPPORT_EVIDENCE_PACKET_SCHEMA_VERSION,
  buildAlertAnalystCaseLedgerAdapter,
  buildAlertAnalystWorkflowEvent,
  buildAlertWorkflowAdminAuditAdapter,
  buildAlertWorkflowContract,
  buildAlertProvenanceConsumerPacket,
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

  test("packages alert provenance for dashboard webhook public TI and case consumers", () => {
    const contract = buildAlertWorkflowContract({
      alert: alertFixture(),
      checkedAt: "2026-06-29T13:08:00.000Z"
    });
    const packet = buildAlertProvenanceConsumerPacket({
      contract,
      generatedAt: "2026-06-29T13:09:00.000Z",
      staleBefore: "2026-06-29T12:01:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: DWM_ALERT_PROVENANCE_CONSUMER_PACKET_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme_lumma",
      caseId: "case_acme_lumma",
      casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
      dedupeKey: "dedupe_acme_lumma",
      redacted: true,
      provenance: {
        redacted: true,
        evidenceCount: 1,
        captureIds: ["cap_acme_initial"],
        sourceIds: ["src_acme_tg"],
        contentHashes: ["hash_acme_initial"],
        sourceFamilies: ["telegram_public", "darkweb_metadata"],
        lastObservedAt: "2026-06-29T12:05:00.000Z"
      },
      orgWatchlistScope: {
        organizationId: "org_acme",
        watchlistIds: ["watch_acme"],
        watchlistItemIds: ["watch_item_acme_domain"],
        alertGeneratorKeys: ["org:org_acme:watchlist:watch_item_acme_domain:domain:acme.com"]
      },
      lifecycle: {
        state: "ready",
        allowedTransitions: expect.arrayContaining([
          "render_dashboard_provenance",
          "prepare_webhook_dispatch",
          "refresh_public_ti_profile",
          "open_case_with_provenance"
        ]),
        blockedTransitions: []
      },
      consumers: {
        dashboard: {
          ready: true,
          ownerLane: "dashboard",
          route: "/dashboard/dwm/alerts/alert_acme_lumma",
          requiredFields: expect.arrayContaining(["alertId", "organizationId", "provenance.captureIds"])
        },
        webhook: {
          ready: true,
          ownerLane: "webhook",
          route: "/v1/dwm/webhooks/deliver",
          requiredFields: expect.arrayContaining(["caseId", "orgWatchlistScope.alertGeneratorKeys", "provenance.captureIds"])
        },
        publicTI: {
          ready: true,
          ownerLane: "publicTI",
          requiredFields: expect.arrayContaining(["provenance.sourceFamilies", "provenance.contentHashes"])
        },
        caseWorkflow: {
          ready: true,
          ownerLane: "case",
          route: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
          requiredFields: expect.arrayContaining(["caseId", "casePath", "workflowEventCount"])
        }
      },
      blockers: []
    });
    expect(packet.payloadShape).toEqual(expect.arrayContaining([
      "provenance.captureIds",
      "orgWatchlistScope.watchlistItemIds",
      "consumers"
    ]));
    expect(JSON.stringify(packet)).not.toContain("rawEvidence");
    expect(JSON.stringify(packet)).not.toContain("payloadBody");
  });

  test("blocks alert provenance consumers for stale duplicate or incomplete alert context", () => {
    const contract = buildAlertWorkflowContract({
      alert: {
        ...alertFixture(),
        organizationId: undefined,
        caseId: undefined,
        caseIdCandidate: undefined,
        casePath: undefined,
        provenance: { captureIds: [] },
        workflowContext: {},
        webhookContext: {},
        sourceProvenanceSummary: {
          schemaVersion: "dwm.alert_source_provenance.v1",
          captureIds: [],
          sourceIds: [],
          contentHashes: [],
          sourceFamilies: ["telegram_public"],
          lastObservedAt: "2026-06-28T12:00:00.000Z"
        },
        orgWatchlistScope: undefined,
        evidence: []
      },
      checkedAt: "2026-06-29T13:08:00.000Z"
    });
    const packet = buildAlertProvenanceConsumerPacket({
      contract,
      staleBefore: "2026-06-29T12:00:00.000Z",
      duplicateDedupeKeys: ["dedupe_acme_lumma"]
    });

    expect(packet.ok).toBe(false);
    expect(packet.lifecycle.state).toBe("blocked");
    expect(packet.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_org_scope", ownerLane: "org", path: "organizationId" }),
      expect.objectContaining({ code: "missing_case_route", ownerLane: "case" }),
      expect.objectContaining({ code: "missing_source_provenance", ownerLane: "source" }),
      expect.objectContaining({ code: "stale_source_provenance", ownerLane: "source", path: "provenance.lastObservedAt" }),
      expect.objectContaining({ code: "missing_org_watchlist_scope", ownerLane: "alert", path: "orgWatchlistScope" }),
      expect.objectContaining({ code: "duplicate_alert_unresolved", ownerLane: "alert", path: "dedupeKey" })
    ]));
    expect(packet.consumers).toMatchObject({
      dashboard: {
        ready: false,
        blockerCodes: expect.arrayContaining(["missing_org_scope", "missing_source_provenance", "stale_source_provenance", "duplicate_alert_unresolved"])
      },
      webhook: {
        ready: false,
        blockerCodes: expect.arrayContaining(["missing_org_scope", "missing_case_route", "missing_org_watchlist_scope", "duplicate_alert_unresolved"])
      },
      publicTI: {
        ready: false,
        blockerCodes: expect.arrayContaining(["missing_source_provenance", "stale_source_provenance"])
      },
      caseWorkflow: {
        ready: false,
        blockerCodes: expect.arrayContaining(["missing_case_route", "duplicate_alert_unresolved"])
      }
    });
    expect(packet.lifecycle.blockedTransitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "webhook", transition: "prepare_webhook_dispatch" }),
      expect.objectContaining({ consumer: "publicTI", transition: "refresh_public_ti_profile" }),
      expect.objectContaining({ consumer: "caseWorkflow", transition: "open_case_with_provenance" })
    ]));
  });

  test("builds analyst workflow event for role assignment consumers", () => {
    const before = buildAlertWorkflowContract({
      alert: alertFixture(),
      checkedAt: "2026-06-29T13:10:00.000Z"
    });
    const after = buildAlertWorkflowContract({
      alert: {
        ...alertFixture(),
        assignedOwner: "analyst-2",
        workflowEvents: [...alertFixture().workflowEvents, {
          id: "event_assign_analyst_2",
          at: "2026-06-29T13:11:00.000Z"
        }]
      },
      checkedAt: "2026-06-29T13:11:00.000Z"
    });
    const event = buildAlertAnalystWorkflowEvent({
      before,
      after,
      action: "assign",
      actorId: "ir-lead",
      requestId: "req_assign_analyst_2",
      expectedWorkflowEventCount: 2,
      generatedAt: "2026-06-29T13:12:00.000Z"
    });

    expect(event).toMatchObject({
      schemaVersion: DWM_ALERT_ANALYST_WORKFLOW_EVENT_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme_lumma",
      caseId: "case_acme_lumma",
      actorId: "ir-lead",
      action: "assign",
      redacted: true,
      transition: {
        before: {
          assignedOwner: "ir-lead",
          workflowEventCount: 2
        },
        after: {
          assignedOwner: "analyst-2",
          workflowEventCount: 3
        },
        changedFields: expect.arrayContaining(["assignedOwner", "workflowEventCount"]),
        expectedWorkflowEventCount: 2,
        valid: true
      },
      provenance: {
        redacted: true,
        evidenceCount: 1,
        captureIds: ["cap_acme_initial"],
        sourceIds: ["src_acme_tg"],
        contentHashCount: 1,
        sourceFamilies: ["telegram_public", "darkweb_metadata"],
        orgWatchlistScope: expect.objectContaining({
          organizationId: "org_acme",
          watchlistItemIds: ["watch_item_acme_domain"]
        })
      },
      consumers: {
        dashboard: {
          ready: true,
          ownerLane: "dashboard",
          route: "/dashboard/dwm/alerts/alert_acme_lumma",
          requiredFields: expect.arrayContaining(["alertId", "organizationId", "action", "transition.changedFields"])
        },
        caseWorkflow: {
          ready: true,
          ownerLane: "case",
          route: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
          requiredFields: expect.arrayContaining(["caseId", "actorId", "transition.after"])
        },
        webhook: {
          ready: true,
          ownerLane: "webhook",
          blockerCodes: []
        },
        audit: {
          ready: true,
          ownerLane: "audit",
          route: "/api/admin/support/inspect",
          requiredFields: expect.arrayContaining(["actorId", "action", "transition.idempotencyKey"])
        }
      },
      blockers: []
    });
    expect(event.transition.idempotencyKey).toMatch(/^dwm_alert_analyst_workflow_event_/);
    expect(event.payloadShape).toEqual(expect.arrayContaining([
      "transition.before",
      "transition.after",
      "provenance.orgWatchlistScope",
      "consumers"
    ]));
    expect(JSON.stringify(event)).not.toContain("payloadBody");
    expect(JSON.stringify(event)).not.toContain("rawEvidence");
  });

  test("blocks invalid stale duplicate analyst workflow replay events", () => {
    const before = buildAlertWorkflowContract({
      alert: alertFixture(),
      checkedAt: "2026-06-29T13:10:00.000Z"
    });
    const after = buildAlertWorkflowContract({
      alert: {
        ...alertFixture(),
        caseId: undefined,
        caseIdCandidate: undefined,
        casePath: undefined,
        deliveryState: "delivered",
        provenance: { captureIds: [] },
        workflowContext: {},
        webhookContext: {},
        sourceProvenanceSummary: undefined,
        evidence: []
      },
      checkedAt: "2026-06-29T13:11:00.000Z"
    });
    const firstAttempt = buildAlertAnalystWorkflowEvent({
      before,
      after,
      action: "replay_webhook",
      requestId: "req_replay_invalid",
      expectedWorkflowEventCount: 0
    });
    const event = buildAlertAnalystWorkflowEvent({
      before,
      after,
      action: "replay_webhook",
      requestId: "req_replay_invalid",
      expectedWorkflowEventCount: 0,
      existingEventIds: [firstAttempt.id]
    });

    expect(event.ok).toBe(false);
    expect(event.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_actor", ownerLane: "alert", path: "actorId" }),
      expect.objectContaining({ code: "missing_case_route", ownerLane: "case" }),
      expect.objectContaining({ code: "missing_rationale", ownerLane: "case", path: "rationale" }),
      expect.objectContaining({ code: "missing_provenance", ownerLane: "source", path: "provenance" }),
      expect.objectContaining({ code: "stale_workflow_version", ownerLane: "alert", path: "expectedWorkflowEventCount" }),
      expect.objectContaining({ code: "invalid_transition", ownerLane: "webhook", path: "transition.changedFields" }),
      expect.objectContaining({ code: "duplicate_workflow_event", ownerLane: "alert", path: "transition.idempotencyKey" })
    ]));
    expect(event.consumers).toMatchObject({
      caseWorkflow: {
        ready: false,
        blockerCodes: expect.arrayContaining(["missing_case_route", "missing_rationale", "stale_workflow_version", "invalid_transition"])
      },
      webhook: {
        ready: false,
        blockerCodes: expect.arrayContaining(["missing_case_route", "missing_rationale", "missing_provenance", "stale_workflow_version", "invalid_transition"])
      },
      audit: {
        ready: false,
        blockerCodes: expect.arrayContaining(["missing_actor", "missing_rationale", "stale_workflow_version", "invalid_transition", "duplicate_workflow_event"])
      }
    });
    expect(event.transition.valid).toBe(false);
    expect(event.transition.changedFields).toEqual(expect.arrayContaining(["deliveryState", "caseId", "casePath"]));
  });

  test("adapts analyst workflow events into case action ledger writes", () => {
    const before = buildAlertWorkflowContract({ alert: alertFixture() });
    const after = buildAlertWorkflowContract({
      alert: {
        ...alertFixture(),
        assignedOwner: "analyst-2",
        workflowEvents: [...alertFixture().workflowEvents, { id: "event_assign_analyst_2" }]
      },
      checkedAt: "2026-06-29T13:11:00.000Z"
    });
    const event = buildAlertAnalystWorkflowEvent({
      before,
      after,
      action: "assign",
      actorId: "ir-lead",
      requestId: "req_assign_analyst_2",
      expectedWorkflowEventCount: 2
    });
    const adapter = buildAlertAnalystCaseLedgerAdapter({
      event,
      membership: {
        memberId: "member_ir_lead",
        role: "analyst",
        status: "active",
        organizationId: "org_acme"
      },
      generatedAt: "2026-06-29T13:12:00.000Z"
    });

    expect(adapter).toMatchObject({
      schemaVersion: DWM_ALERT_ANALYST_CASE_LEDGER_ADAPTER_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme_lumma",
      caseId: "case_acme_lumma",
      redacted: true,
      route: {
        method: "POST",
        path: "/v1/dwm/org-alert-case-actions",
        body: {
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          receipt: {
            schemaVersion: "dwm.alert_analyst_case_action_receipt.v1",
            workflowEventId: event.id,
            action: "assign_owner",
            alertIds: ["alert_acme_lumma"],
            casePaths: ["/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"],
            execution: "ready",
            ownerLane: "case",
            route: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
            method: "GET",
            analyst: {
              analystId: "ir-lead"
            },
            blockedByCodes: []
          }
        },
        payloadShape: expect.arrayContaining([
          "receipt.workflowEventId",
          "receipt.action",
          "receipt.casePaths",
          "receipt.idempotencyKey"
        ]),
        redacted: true
      },
      membership: {
        memberId: "member_ir_lead",
        role: "analyst",
        status: "active",
        organizationId: "org_acme"
      },
      consumers: {
        caseLedger: {
          ready: true,
          ownerLane: "case",
          route: "/v1/dwm/org-alert-case-actions"
        },
        dashboard: {
          ready: true,
          ownerLane: "dashboard",
          route: "/dashboard/dwm/alerts/alert_acme_lumma"
        },
        audit: {
          ready: true,
          ownerLane: "audit",
          route: "/api/admin/support/inspect"
        }
      },
      blockers: []
    });
    expect(adapter.route.body.receipt.idempotencyKey).toMatch(/^dwm_alert_analyst_case_ledger_receipt_/);
    expect(JSON.stringify(adapter)).not.toContain("rawEvidence");
    expect(JSON.stringify(adapter)).not.toContain("payloadBody");
  });

  test("blocks case ledger adapter for wrong org inactive viewer or blocked workflow event", () => {
    const before = buildAlertWorkflowContract({ alert: alertFixture() });
    const after = buildAlertWorkflowContract({
      alert: {
        ...alertFixture(),
        caseId: undefined,
        casePath: undefined,
        workflowContext: {},
        evidence: []
      }
    });
    const event = buildAlertAnalystWorkflowEvent({
      before,
      after,
      action: "close",
      actorId: "viewer_acme",
      expectedWorkflowEventCount: 0
    });
    const adapter = buildAlertAnalystCaseLedgerAdapter({
      event,
      membership: {
        memberId: "member_viewer",
        role: "viewer",
        status: "deactivated",
        organizationId: "org_other"
      }
    });

    expect(adapter.ok).toBe(false);
    expect(adapter.route.body.receipt.execution).toBe("blocked");
    expect(adapter.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "workflow_event_blocked", ownerLane: "alert", path: "event.ok" }),
      expect.objectContaining({ code: "wrong_org", ownerLane: "org", path: "membership.organizationId" }),
      expect.objectContaining({ code: "member_inactive", ownerLane: "org", path: "membership.status" }),
      expect.objectContaining({ code: "role_not_allowed", ownerLane: "org", path: "membership.role" })
    ]));
    expect(adapter.consumers).toMatchObject({
      caseLedger: {
        ready: false,
        blockerCodes: expect.arrayContaining(["workflow_event_blocked", "wrong_org", "member_inactive", "role_not_allowed"])
      },
      dashboard: {
        ready: false,
        blockerCodes: expect.arrayContaining(["workflow_event_blocked", "wrong_org"])
      },
      audit: {
        ready: false,
        blockerCodes: expect.arrayContaining(["wrong_org", "member_inactive", "role_not_allowed"])
      }
    });
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
