import { stableId, uniqueStrings } from "../utils.ts";

export const DWM_ALERT_WORKFLOW_CONTRACT_SCHEMA_VERSION = "dwm.alert_workflow_contract.v1" as const;
export const DWM_ALERT_WORKFLOW_PRESERVATION_SCHEMA_VERSION = "dwm.alert_workflow_preservation.v1" as const;
export const DWM_ALERT_WORKFLOW_ADMIN_AUDIT_SCHEMA_VERSION = "dwm.alert_workflow_admin_audit.v1" as const;
export const DWM_ALERT_WORKFLOW_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION = "dwm.alert_workflow_support_action_request.v1" as const;
export const DWM_ALERT_WORKFLOW_SUPPORT_EVIDENCE_PACKET_SCHEMA_VERSION = "dwm.alert_workflow_support_evidence_packet.v1" as const;
export const DWM_ALERT_PROVENANCE_CONSUMER_PACKET_SCHEMA_VERSION = "dwm.alert_provenance_consumer_packet.v1" as const;
export const DWM_ALERT_ANALYST_WORKFLOW_EVENT_SCHEMA_VERSION = "dwm.alert_analyst_workflow_event.v1" as const;
export const DWM_ALERT_ANALYST_CASE_LEDGER_ADAPTER_SCHEMA_VERSION = "dwm.alert_analyst_case_ledger_adapter.v1" as const;

export type DwmAlertWorkflowContract = {
  schemaVersion: typeof DWM_ALERT_WORKFLOW_CONTRACT_SCHEMA_VERSION;
  id: string;
  checkedAt: string;
  tenantId: string;
  organizationId?: string;
  alertId: string;
  reviewState?: string;
  deliveryState?: string;
  workflowStatus?: string;
  assignedOwner?: string;
  severityOverride?: string;
  caseId?: string;
  caseIdCandidate?: string;
  casePath?: string;
  dedupeKey?: string;
  workflowEventCount: number;
  latestWorkflowEventId?: string;
  provenance: {
    evidenceCount: number;
    captureIds: string[];
    sourceIds: string[];
    contentHashes: string[];
    sourceFamilies: string[];
    firstObservedAt?: string;
    lastObservedAt?: string;
  };
  orgWatchlistScope?: {
    schemaVersion?: string;
    organizationId?: string;
    ownerOrganizationIds: string[];
    watchlistIds: string[];
    watchlistItemIds: string[];
    alertGeneratorKeys: string[];
  };
};

export type DwmAlertWorkflowPreservationReport = {
  schemaVersion: typeof DWM_ALERT_WORKFLOW_PRESERVATION_SCHEMA_VERSION;
  checkedAt: string;
  ok: boolean;
  before: DwmAlertWorkflowContract;
  after: DwmAlertWorkflowContract;
  preserved: {
    tenant: boolean;
    organization: boolean;
    caseRoute: boolean;
    owner: boolean;
    reviewState: boolean;
    deliveryState: boolean;
    eventCountMonotonic: boolean;
    provenance: boolean;
    orgWatchlistScope: boolean;
  };
  blockers: DwmAlertWorkflowPreservationBlocker[];
};

export type DwmAlertWorkflowPreservationBlocker = {
  code:
    | "alert_identity_changed"
    | "organization_scope_changed"
    | "case_route_dropped"
    | "owner_dropped"
    | "review_state_regressed"
    | "delivery_state_regressed"
    | "workflow_events_regressed"
    | "provenance_dropped"
    | "org_watchlist_scope_dropped";
  ownerLane: "alert" | "case" | "source" | "webhook";
  path: string;
  message: string;
};

export type DwmAlertWorkflowAdminAuditAdapter = {
  schemaVersion: typeof DWM_ALERT_WORKFLOW_ADMIN_AUDIT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  alertId: string;
  caseId?: string;
  casePath?: string;
  audit: {
    eventType: "dwm.alert.workflow_preservation_checked";
    source: "alert_workflow_preservation";
    outcome: "allowed" | "blocked";
    actorId?: string;
    requestId?: string;
    redacted: true;
    entity: {
      type: "dwm_alert";
      id: string;
      tenantId: string;
      organizationId?: string;
    };
    blockerCodes: DwmAlertWorkflowPreservationBlocker["code"][];
    ownerLanes: DwmAlertWorkflowPreservationBlocker["ownerLane"][];
  };
  helpdesk: {
    redacted: true;
    lookupKey: string;
    supportSummary: string;
    customerVisible: false;
    blockedAction?: "preserve_alert_workflow";
    routeHints: {
      alertDetail: string;
      caseDetail?: string;
    };
  };
  workflow: {
    beforeEventCount: number;
    afterEventCount: number;
    latestWorkflowEventId?: string;
    reviewState?: string;
    deliveryState?: string;
    assignedOwner?: string;
    preserved: DwmAlertWorkflowPreservationReport["preserved"];
  };
  proof: {
    reportSchemaVersion: typeof DWM_ALERT_WORKFLOW_PRESERVATION_SCHEMA_VERSION;
    checkedAt: string;
    beforeContractId: string;
    afterContractId: string;
    provenance: DwmAlertWorkflowContract["provenance"];
  };
  nextActions: {
    ownerLane: DwmAlertWorkflowPreservationBlocker["ownerLane"];
    action: "inspect_alert_scope" | "restore_case_route" | "restore_assignee" | "review_workflow_transition" | "restore_delivery_state" | "restore_provenance";
    blockerCode: DwmAlertWorkflowPreservationBlocker["code"];
    path: string;
  }[];
};

export type DwmAlertWorkflowSupportActionRequest = {
  schemaVersion: typeof DWM_ALERT_WORKFLOW_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  adminSupportContract: {
    schemaVersion: "support.action_prepare.v1";
    method: "GET";
    route: "/api/admin/support/inspect";
    query: {
      org?: string;
      entity: string;
      entityType: "dwm_alert";
      action: "support.alert.inspect_workflow" | "support.alert.restore_workflow";
      prepareAction: "inspect_alert_workflow" | "restore_alert_workflow";
      requestId?: string;
      idempotencyKey: string;
    };
  };
  target: {
    tenantId: string;
    organizationId?: string;
    alertId: string;
    caseId?: string;
    casePath?: string;
  };
  redaction: {
    required: true;
    attestation: "support_safe_metadata_only";
    hiddenFields: string[];
  };
  auditPreview: {
    actionType: "support.alert.inspect_workflow" | "support.alert.restore_workflow";
    source: "dwm.alert_workflow_admin_audit";
    outcome: "prepared" | "blocked";
    blockerCodes: DwmAlertWorkflowPreservationBlocker["code"][];
    ownerLanes: DwmAlertWorkflowPreservationBlocker["ownerLane"][];
  };
  blockers: {
    code: "audit_blocked" | "missing_support_target";
    ownerLane: DwmAlertWorkflowPreservationBlocker["ownerLane"];
    path: string;
    message: string;
  }[];
};

export type DwmAlertWorkflowSupportEvidencePacket = {
  schemaVersion: typeof DWM_ALERT_WORKFLOW_SUPPORT_EVIDENCE_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  alertId: string;
  caseId?: string;
  redacted: true;
  support: {
    route: "/api/admin/support/inspect";
    probeId: "support.alert.workflow_evidence_packet";
    entityType: "dwm_alert";
    action: DwmAlertWorkflowSupportActionRequest["adminSupportContract"]["query"]["action"];
    prepareAction: DwmAlertWorkflowSupportActionRequest["adminSupportContract"]["query"]["prepareAction"];
    idempotencyKey: string;
    customerVisible: false;
  };
  auditEvents: Array<{
    schemaVersion: typeof DWM_ALERT_WORKFLOW_ADMIN_AUDIT_SCHEMA_VERSION;
    eventType: DwmAlertWorkflowAdminAuditAdapter["audit"]["eventType"];
    outcome: DwmAlertWorkflowAdminAuditAdapter["audit"]["outcome"];
    actorId?: string;
    requestId?: string;
    blockerCodes: DwmAlertWorkflowPreservationBlocker["code"][];
    ownerLanes: DwmAlertWorkflowPreservationBlocker["ownerLane"][];
  }>;
  proof: {
    adapterId: string;
    supportRequestId: string;
    reportSchemaVersion: typeof DWM_ALERT_WORKFLOW_PRESERVATION_SCHEMA_VERSION;
    beforeContractId: string;
    afterContractId: string;
    checkedAt: string;
    preserved: DwmAlertWorkflowPreservationReport["preserved"];
    evidenceSummary: {
      evidenceCount: number;
      captureCount: number;
      sourceCount: number;
      contentHashCount: number;
      sourceFamilies: string[];
    };
  };
  blockers: Array<DwmAlertWorkflowSupportActionRequest["blockers"][number] | {
    code: "support_request_blocked";
    ownerLane: DwmAlertWorkflowPreservationBlocker["ownerLane"];
    path: string;
    message: string;
  }>;
  nextActions: DwmAlertWorkflowAdminAuditAdapter["nextActions"];
};

export type DwmAlertProvenanceConsumerPacket = {
  schemaVersion: typeof DWM_ALERT_PROVENANCE_CONSUMER_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  alertId: string;
  caseId?: string;
  casePath?: string;
  dedupeKey?: string;
  redacted: true;
  provenance: DwmAlertWorkflowContract["provenance"] & {
    redacted: true;
  };
  orgWatchlistScope?: DwmAlertWorkflowContract["orgWatchlistScope"];
  lifecycle: {
    state: "ready" | "blocked";
    reviewState?: string;
    deliveryState?: string;
    workflowStatus?: string;
    allowedTransitions: Array<"render_dashboard_provenance" | "prepare_webhook_dispatch" | "refresh_public_ti_profile" | "open_case_with_provenance">;
    blockedTransitions: Array<{
      consumer: keyof DwmAlertProvenanceConsumerPacket["consumers"];
      transition: "render_dashboard_provenance" | "prepare_webhook_dispatch" | "refresh_public_ti_profile" | "open_case_with_provenance";
      blockerCodes: DwmAlertProvenanceConsumerBlocker["code"][];
    }>;
  };
  consumers: {
    dashboard: DwmAlertProvenanceConsumerReadiness;
    webhook: DwmAlertProvenanceConsumerReadiness;
    publicTI: DwmAlertProvenanceConsumerReadiness;
    caseWorkflow: DwmAlertProvenanceConsumerReadiness;
  };
  blockers: DwmAlertProvenanceConsumerBlocker[];
  payloadShape: string[];
};

export type DwmAlertProvenanceConsumerReadiness = {
  ready: boolean;
  ownerLane: "dashboard" | "webhook" | "publicTI" | "case";
  route?: string;
  requiredFields: string[];
  blockerCodes: DwmAlertProvenanceConsumerBlocker["code"][];
};

export type DwmAlertProvenanceConsumerBlocker = {
  code:
    | "missing_org_scope"
    | "missing_case_route"
    | "missing_source_provenance"
    | "stale_source_provenance"
    | "missing_org_watchlist_scope"
    | "duplicate_alert_unresolved";
  ownerLane: "org" | "case" | "source" | "alert";
  path: string;
  message: string;
};

export type DwmAlertAnalystWorkflowAction =
  | "assign"
  | "escalate"
  | "suppress"
  | "close"
  | "reopen"
  | "replay_webhook"
  | "add_note";

export type DwmAlertAnalystWorkflowEvent = {
  schemaVersion: typeof DWM_ALERT_ANALYST_WORKFLOW_EVENT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  alertId: string;
  caseId?: string;
  casePath?: string;
  actorId?: string;
  action: DwmAlertAnalystWorkflowAction;
  rationale?: string;
  redacted: true;
  transition: {
    before: DwmAlertWorkflowLifecycleSnapshot;
    after: DwmAlertWorkflowLifecycleSnapshot;
    changedFields: string[];
    expectedWorkflowEventCount?: number;
    valid: boolean;
    idempotencyKey: string;
  };
  provenance: {
    redacted: true;
    evidenceCount: number;
    captureIds: string[];
    sourceIds: string[];
    contentHashCount: number;
    sourceFamilies: string[];
    orgWatchlistScope?: DwmAlertWorkflowContract["orgWatchlistScope"];
  };
  consumers: {
    dashboard: DwmAlertAnalystWorkflowConsumerReadiness;
    caseWorkflow: DwmAlertAnalystWorkflowConsumerReadiness;
    webhook: DwmAlertAnalystWorkflowConsumerReadiness;
    audit: DwmAlertAnalystWorkflowConsumerReadiness;
  };
  blockers: DwmAlertAnalystWorkflowEventBlocker[];
  payloadShape: string[];
};

export type DwmAlertWorkflowLifecycleSnapshot = {
  reviewState?: string;
  deliveryState?: string;
  workflowStatus?: string;
  assignedOwner?: string;
  severityOverride?: string;
  caseId?: string;
  casePath?: string;
  workflowEventCount: number;
};

export type DwmAlertAnalystWorkflowConsumerReadiness = {
  ready: boolean;
  ownerLane: "dashboard" | "case" | "webhook" | "audit";
  route?: string;
  requiredFields: string[];
  blockerCodes: DwmAlertAnalystWorkflowEventBlocker["code"][];
};

export type DwmAlertAnalystWorkflowEventBlocker = {
  code:
    | "missing_alert_id"
    | "missing_org_scope"
    | "missing_actor"
    | "missing_case_route"
    | "missing_rationale"
    | "missing_provenance"
    | "stale_workflow_version"
    | "invalid_transition"
    | "duplicate_workflow_event";
  ownerLane: "alert" | "org" | "case" | "source" | "webhook";
  path: string;
  message: string;
};

export type DwmAlertAnalystCaseLedgerAdapter = {
  schemaVersion: typeof DWM_ALERT_ANALYST_CASE_LEDGER_ADAPTER_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  alertId: string;
  caseId?: string;
  redacted: true;
  route: {
    method: "POST";
    path: "/v1/dwm/org-alert-case-actions";
    body: {
      tenantId: string;
      organizationId?: string;
      receipt: {
        schemaVersion: "dwm.alert_analyst_case_action_receipt.v1";
        workflowEventId: string;
        action: DwmAlertAnalystCaseLedgerAction;
        alertIds: string[];
        casePaths: string[];
        execution: "ready" | "repair_required" | "blocked";
        ownerLane?: "case" | "alert" | "source" | "webhook";
        route?: string;
        method?: "GET" | "POST";
        analyst?: {
          analystId?: string;
          rationale?: string;
        };
        blockedByCodes: DwmAlertAnalystCaseLedgerAdapterBlocker["code"][];
        idempotencyKey: string;
      };
    };
    payloadShape: string[];
    redacted: true;
  };
  membership?: {
    memberId?: string;
    role?: "owner" | "admin" | "analyst" | "viewer" | "billing" | string;
    status?: "active" | "invited" | "removed" | "deactivated" | string;
    organizationId?: string;
  };
  consumers: {
    caseLedger: DwmAlertAnalystCaseLedgerConsumerReadiness;
    dashboard: DwmAlertAnalystCaseLedgerConsumerReadiness;
    audit: DwmAlertAnalystCaseLedgerConsumerReadiness;
  };
  blockers: DwmAlertAnalystCaseLedgerAdapterBlocker[];
};

export type DwmAlertAnalystCaseLedgerAction =
  | "assign_owner"
  | "escalate"
  | "suppress"
  | "close"
  | "reopen"
  | "replay_delivery"
  | "add_note";

export type DwmAlertAnalystCaseLedgerConsumerReadiness = {
  ready: boolean;
  ownerLane: "case" | "dashboard" | "audit";
  route?: string;
  requiredFields: string[];
  blockerCodes: DwmAlertAnalystCaseLedgerAdapterBlocker["code"][];
};

export type DwmAlertAnalystCaseLedgerAdapterBlocker = {
  code:
    | "workflow_event_blocked"
    | "missing_case_target"
    | "missing_membership"
    | "wrong_org"
    | "member_inactive"
    | "role_not_allowed"
    | "unsupported_case_action";
  ownerLane: "case" | "org" | "alert" | "webhook";
  path: string;
  message: string;
};

export function buildAlertWorkflowContract(input: {
  alert: Record<string, any>;
  checkedAt?: string;
}): DwmAlertWorkflowContract {
  const alert = input.alert;
  const workflowContext = alert.workflowContext ?? {};
  const webhookContext = alert.webhookContext ?? {};
  const deliveryReadinessContext = alert.deliveryReadinessContext ?? {};
  const sourceProvenanceSummary = alert.sourceProvenanceSummary ?? {};
  const orgWatchlistScope = normalizeOrgWatchlistScope(alert.orgWatchlistScope ?? alert.webhookContext?.orgWatchlistScope ?? alert.workflowContext?.orgWatchlistScope);
  const workflowEvents = Array.isArray(alert.workflowEvents) ? alert.workflowEvents : [];
  const provenance = alert.provenance ?? {};
  const evidence = Array.isArray(alert.evidence) ? alert.evidence : [];
  const alertId = stringValue(alert.id) ?? "";
  return {
    schemaVersion: DWM_ALERT_WORKFLOW_CONTRACT_SCHEMA_VERSION,
    id: stableId("dwm_alert_workflow_contract", `${alert.tenantId ?? ""}:${alert.organizationId ?? workflowContext.organizationId ?? ""}:${alertId}:${workflowEvents.length}`),
    checkedAt: input.checkedAt ?? new Date(0).toISOString(),
    tenantId: stringValue(alert.tenantId) ?? "",
    organizationId: stringValue(alert.organizationId ?? workflowContext.organizationId ?? webhookContext.organizationId),
    alertId,
    reviewState: stringValue(alert.reviewState),
    deliveryState: stringValue(alert.deliveryState),
    workflowStatus: stringValue(alert.workflowStatus ?? alert.workflowSummary?.status),
    assignedOwner: stringValue(alert.assignedOwner ?? alert.workflowSummary?.assignedOwner),
    severityOverride: stringValue(alert.severityOverride ?? alert.workflowSummary?.severityOverride),
    caseId: stringValue(alert.caseId ?? workflowContext.caseId ?? deliveryReadinessContext.caseId),
    caseIdCandidate: stringValue(alert.caseIdCandidate ?? workflowContext.caseIdCandidate ?? webhookContext.caseIdCandidate),
    casePath: stringValue(alert.casePath ?? workflowContext.casePath ?? webhookContext.casePath),
    dedupeKey: stringValue(alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey ?? workflowContext.dedupeKey ?? webhookContext.dedupeKey),
    workflowEventCount: workflowEvents.length,
    latestWorkflowEventId: stringValue(workflowEvents.at(-1)?.id),
    provenance: {
      evidenceCount: Number(workflowContext.evidenceCount ?? webhookContext.evidenceCount ?? deliveryReadinessContext.evidenceCount ?? evidence.length ?? 0),
      captureIds: uniqueStrings([
        ...asStringArray(provenance.captureIds),
        ...asStringArray(workflowContext.captureIds),
        ...asStringArray(webhookContext.captureIds),
        ...asStringArray(deliveryReadinessContext.captureIds),
        ...asStringArray(sourceProvenanceSummary.captureIds),
        ...asStringArray(sourceProvenanceSummary.generationEvidenceWindow?.captureIds)
      ]),
      sourceIds: uniqueStrings([
        ...evidence.map((row: any) => row.sourceId).filter(Boolean).map(String),
        ...asStringArray(sourceProvenanceSummary.sourceIds)
      ]),
      contentHashes: uniqueStrings([
        ...evidence.map((row: any) => row.contentHash).filter(Boolean).map(String),
        ...asStringArray(sourceProvenanceSummary.contentHashes),
        ...asStringArray(sourceProvenanceSummary.generationEvidenceWindow?.contentHashes)
      ]),
      sourceFamilies: uniqueStrings([
        ...asStringArray(alert.sourceFamily),
        ...asStringArray(provenance.sourceFamilies),
        ...asStringArray(sourceProvenanceSummary.sourceFamily),
        ...asStringArray(sourceProvenanceSummary.sourceFamilies),
        ...asStringArray(sourceProvenanceSummary.generationEvidenceWindow?.sourceFamilies)
      ]),
      firstObservedAt: stringValue(sourceProvenanceSummary.firstObservedAt ?? sourceProvenanceSummary.generationEvidenceWindow?.firstObservedAt),
      lastObservedAt: stringValue(sourceProvenanceSummary.lastObservedAt ?? sourceProvenanceSummary.generationEvidenceWindow?.lastObservedAt)
    },
    orgWatchlistScope
  };
}

export function validateAlertWorkflowPreservation(input: {
  before: DwmAlertWorkflowContract;
  after: DwmAlertWorkflowContract;
  checkedAt?: string;
  allowOwnerChange?: boolean;
  allowReviewStateChange?: boolean;
  allowDeliveryStateChange?: boolean;
}): DwmAlertWorkflowPreservationReport {
  const blockers: DwmAlertWorkflowPreservationBlocker[] = [];
  const before = input.before;
  const after = input.after;

  if (before.tenantId !== after.tenantId || before.alertId !== after.alertId) {
    blockers.push(blocker("alert_identity_changed", "alert", "alertId", "Alert workflow preservation must keep tenant and alert identity stable."));
  }
  if (before.organizationId && after.organizationId && before.organizationId !== after.organizationId) {
    blockers.push(blocker("organization_scope_changed", "alert", "organizationId", "Alert workflow cannot move between organizations."));
  }
  if ((before.caseId || before.caseIdCandidate || before.casePath) && !(after.caseId || after.caseIdCandidate || after.casePath)) {
    blockers.push(blocker("case_route_dropped", "case", "casePath", "Alert case route was dropped."));
  }
  if (!input.allowOwnerChange && before.assignedOwner && !after.assignedOwner) {
    blockers.push(blocker("owner_dropped", "case", "assignedOwner", "Assigned owner was dropped."));
  }
  if (!input.allowReviewStateChange && before.reviewState && after.reviewState && before.reviewState !== after.reviewState) {
    blockers.push(blocker("review_state_regressed", "alert", "reviewState", "Review state changed without an allowed workflow transition."));
  }
  if (!input.allowDeliveryStateChange && before.deliveryState && after.deliveryState && before.deliveryState !== after.deliveryState) {
    blockers.push(blocker("delivery_state_regressed", "webhook", "deliveryState", "Delivery state changed without an allowed workflow transition."));
  }
  if (after.workflowEventCount < before.workflowEventCount) {
    blockers.push(blocker("workflow_events_regressed", "alert", "workflowEvents", "Workflow event count decreased."));
  }
  if (provenanceScore(after) < provenanceScore(before)) {
    blockers.push(blocker("provenance_dropped", "source", "provenance", "Alert provenance was dropped."));
  }
  if (orgWatchlistScopeScore(after) < orgWatchlistScopeScore(before)) {
    blockers.push(blocker("org_watchlist_scope_dropped", "alert", "orgWatchlistScope", "Alert org watchlist scope was dropped."));
  }

  return {
    schemaVersion: DWM_ALERT_WORKFLOW_PRESERVATION_SCHEMA_VERSION,
    checkedAt: input.checkedAt ?? new Date(0).toISOString(),
    ok: blockers.length === 0,
    before,
    after,
    preserved: {
      tenant: before.tenantId === after.tenantId && before.alertId === after.alertId,
      organization: !before.organizationId || !after.organizationId || before.organizationId === after.organizationId,
      caseRoute: !(before.caseId || before.caseIdCandidate || before.casePath) || Boolean(after.caseId || after.caseIdCandidate || after.casePath),
      owner: input.allowOwnerChange === true || !before.assignedOwner || Boolean(after.assignedOwner),
      reviewState: input.allowReviewStateChange === true || !before.reviewState || !after.reviewState || before.reviewState === after.reviewState,
      deliveryState: input.allowDeliveryStateChange === true || !before.deliveryState || !after.deliveryState || before.deliveryState === after.deliveryState,
      eventCountMonotonic: after.workflowEventCount >= before.workflowEventCount,
      provenance: provenanceScore(after) >= provenanceScore(before),
      orgWatchlistScope: orgWatchlistScopeScore(after) >= orgWatchlistScopeScore(before)
    },
    blockers
  };
}

export function buildAlertWorkflowAdminAuditAdapter(input: {
  report: DwmAlertWorkflowPreservationReport;
  actorId?: string;
  requestId?: string;
  generatedAt?: string;
}): DwmAlertWorkflowAdminAuditAdapter {
  const report = input.report;
  const before = report.before;
  const after = report.after;
  const tenantId = after.tenantId || before.tenantId;
  const organizationId = after.organizationId || before.organizationId;
  const alertId = after.alertId || before.alertId;
  const caseId = after.caseId || before.caseId || after.caseIdCandidate || before.caseIdCandidate;
  const casePath = after.casePath || before.casePath;
  const blockerCodes = report.blockers.map((item) => item.code);
  const ownerLanes = uniqueStrings(report.blockers.map((item) => item.ownerLane)) as DwmAlertWorkflowPreservationBlocker["ownerLane"][];

  return {
    schemaVersion: DWM_ALERT_WORKFLOW_ADMIN_AUDIT_SCHEMA_VERSION,
    id: stableId("dwm_alert_workflow_admin_audit", `${tenantId}:${organizationId ?? ""}:${alertId}:${report.checkedAt}:${blockerCodes.join(",")}`),
    generatedAt: input.generatedAt ?? report.checkedAt,
    ok: report.ok,
    tenantId,
    organizationId,
    alertId,
    caseId,
    casePath,
    audit: {
      eventType: "dwm.alert.workflow_preservation_checked",
      source: "alert_workflow_preservation",
      outcome: report.ok ? "allowed" : "blocked",
      actorId: stringValue(input.actorId),
      requestId: stringValue(input.requestId),
      redacted: true,
      entity: {
        type: "dwm_alert",
        id: alertId,
        tenantId,
        organizationId
      },
      blockerCodes,
      ownerLanes
    },
    helpdesk: {
      redacted: true,
      lookupKey: organizationId ?? tenantId,
      supportSummary: report.ok
        ? "Alert workflow state is preserved across refresh."
        : "Alert workflow preservation is blocked and needs owner review before customer action.",
      customerVisible: false,
      blockedAction: report.ok ? undefined : "preserve_alert_workflow",
      routeHints: {
        alertDetail: `/v1/dwm/alerts/${encodeURIComponent(alertId)}`,
        caseDetail: casePath ?? (caseId ? `/v1/cases/${encodeURIComponent(caseId)}` : undefined)
      }
    },
    workflow: {
      beforeEventCount: before.workflowEventCount,
      afterEventCount: after.workflowEventCount,
      latestWorkflowEventId: after.latestWorkflowEventId ?? before.latestWorkflowEventId,
      reviewState: after.reviewState ?? before.reviewState,
      deliveryState: after.deliveryState ?? before.deliveryState,
      assignedOwner: after.assignedOwner ?? before.assignedOwner,
      preserved: report.preserved
    },
    proof: {
      reportSchemaVersion: DWM_ALERT_WORKFLOW_PRESERVATION_SCHEMA_VERSION,
      checkedAt: report.checkedAt,
      beforeContractId: before.id,
      afterContractId: after.id,
      provenance: after.provenance
    },
    nextActions: report.blockers.map((item) => ({
      ownerLane: item.ownerLane,
      action: nextAuditAction(item.code),
      blockerCode: item.code,
      path: item.path
    }))
  };
}

export function buildAlertWorkflowSupportActionRequest(input: {
  adapter: DwmAlertWorkflowAdminAuditAdapter;
  requestId?: string;
  generatedAt?: string;
}): DwmAlertWorkflowSupportActionRequest {
  const adapter = input.adapter;
  const actionType = adapter.ok ? "support.alert.inspect_workflow" : "support.alert.restore_workflow";
  const prepareAction = adapter.ok ? "inspect_alert_workflow" : "restore_alert_workflow";
  const idempotencyKey = stableId("dwm_alert_workflow_support_action", `${adapter.id}:${actionType}:${input.requestId ?? ""}`);
  const blockers = supportActionBlockers(adapter);

  return {
    schemaVersion: DWM_ALERT_WORKFLOW_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION,
    id: stableId("dwm_alert_workflow_support_action_request", `${adapter.id}:${input.requestId ?? ""}`),
    generatedAt: input.generatedAt ?? adapter.generatedAt,
    ok: blockers.length === 0,
    adminSupportContract: {
      schemaVersion: "support.action_prepare.v1",
      method: "GET",
      route: "/api/admin/support/inspect",
      query: {
        org: adapter.organizationId,
        entity: adapter.alertId,
        entityType: "dwm_alert",
        action: actionType,
        prepareAction,
        requestId: stringValue(input.requestId),
        idempotencyKey
      }
    },
    target: {
      tenantId: adapter.tenantId,
      organizationId: adapter.organizationId,
      alertId: adapter.alertId,
      caseId: adapter.caseId,
      casePath: adapter.casePath
    },
    redaction: {
      required: true,
      attestation: "support_safe_metadata_only",
      hiddenFields: ["rawEvidence", "workflowPayload", "customerRationale", "secretMaterial"]
    },
    auditPreview: {
      actionType,
      source: "dwm.alert_workflow_admin_audit",
      outcome: blockers.length === 0 ? "prepared" : "blocked",
      blockerCodes: adapter.audit.blockerCodes,
      ownerLanes: adapter.audit.ownerLanes
    },
    blockers
  };
}

export function buildAlertWorkflowSupportEvidencePacket(input: {
  adapter: DwmAlertWorkflowAdminAuditAdapter;
  supportRequest?: DwmAlertWorkflowSupportActionRequest;
  requestId?: string;
  generatedAt?: string;
}): DwmAlertWorkflowSupportEvidencePacket {
  const supportRequest = input.supportRequest ?? buildAlertWorkflowSupportActionRequest({
    adapter: input.adapter,
    requestId: input.requestId,
    generatedAt: input.generatedAt
  });
  const provenance = input.adapter.proof.provenance;
  const blockers: DwmAlertWorkflowSupportEvidencePacket["blockers"] = [
    ...supportRequest.blockers,
    ...supportRequest.blockers.map((blocker) => ({
      code: "support_request_blocked" as const,
      ownerLane: blocker.ownerLane,
      path: blocker.path,
      message: "Support evidence packet is waiting on the prepared support request."
    }))
  ];

  return {
    schemaVersion: DWM_ALERT_WORKFLOW_SUPPORT_EVIDENCE_PACKET_SCHEMA_VERSION,
    id: stableId("dwm_alert_workflow_support_evidence_packet", `${input.adapter.id}:${supportRequest.id}`),
    generatedAt: input.generatedAt ?? supportRequest.generatedAt,
    ok: input.adapter.ok && supportRequest.ok && blockers.length === 0,
    tenantId: input.adapter.tenantId,
    organizationId: input.adapter.organizationId,
    alertId: input.adapter.alertId,
    caseId: input.adapter.caseId,
    redacted: true,
    support: {
      route: "/api/admin/support/inspect",
      probeId: "support.alert.workflow_evidence_packet",
      entityType: "dwm_alert",
      action: supportRequest.adminSupportContract.query.action,
      prepareAction: supportRequest.adminSupportContract.query.prepareAction,
      idempotencyKey: supportRequest.adminSupportContract.query.idempotencyKey,
      customerVisible: false
    },
    auditEvents: [{
      schemaVersion: DWM_ALERT_WORKFLOW_ADMIN_AUDIT_SCHEMA_VERSION,
      eventType: input.adapter.audit.eventType,
      outcome: input.adapter.audit.outcome,
      actorId: input.adapter.audit.actorId,
      requestId: input.adapter.audit.requestId,
      blockerCodes: input.adapter.audit.blockerCodes,
      ownerLanes: input.adapter.audit.ownerLanes
    }],
    proof: {
      adapterId: input.adapter.id,
      supportRequestId: supportRequest.id,
      reportSchemaVersion: input.adapter.proof.reportSchemaVersion,
      beforeContractId: input.adapter.proof.beforeContractId,
      afterContractId: input.adapter.proof.afterContractId,
      checkedAt: input.adapter.proof.checkedAt,
      preserved: input.adapter.workflow.preserved,
      evidenceSummary: {
        evidenceCount: provenance.evidenceCount,
        captureCount: provenance.captureIds.length,
        sourceCount: provenance.sourceIds.length,
        contentHashCount: provenance.contentHashes.length,
        sourceFamilies: provenance.sourceFamilies ?? []
      }
    },
    blockers,
    nextActions: input.adapter.nextActions
  };
}

export function buildAlertProvenanceConsumerPacket(input: {
  contract: DwmAlertWorkflowContract;
  generatedAt?: string;
  staleBefore?: string;
  duplicateDedupeKeys?: string[];
}): DwmAlertProvenanceConsumerPacket {
  const contract = input.contract;
  const blockers = alertProvenanceConsumerBlockers(contract, input);
  const consumerBlockers = {
    dashboard: consumerBlockerCodes(blockers, ["missing_org_scope", "missing_source_provenance", "stale_source_provenance", "duplicate_alert_unresolved"]),
    webhook: consumerBlockerCodes(blockers, ["missing_org_scope", "missing_case_route", "missing_source_provenance", "stale_source_provenance", "missing_org_watchlist_scope", "duplicate_alert_unresolved"]),
    publicTI: consumerBlockerCodes(blockers, ["missing_source_provenance", "stale_source_provenance"]),
    caseWorkflow: consumerBlockerCodes(blockers, ["missing_org_scope", "missing_case_route", "missing_source_provenance", "stale_source_provenance", "duplicate_alert_unresolved"])
  };
  const consumers = {
    dashboard: alertProvenanceConsumerReadiness("dashboard", `/dashboard/dwm/alerts/${encodeURIComponent(contract.alertId)}`, [
      "alertId",
      "organizationId",
      "provenance.captureIds",
      "provenance.sourceIds",
      "orgWatchlistScope.watchlistItemIds"
    ], consumerBlockers.dashboard),
    webhook: alertProvenanceConsumerReadiness("webhook", "/v1/dwm/webhooks/deliver", [
      "alertId",
      "organizationId",
      "caseId",
      "dedupeKey",
      "orgWatchlistScope.watchlistItemIds",
      "orgWatchlistScope.alertGeneratorKeys",
      "provenance.captureIds"
    ], consumerBlockers.webhook),
    publicTI: alertProvenanceConsumerReadiness("publicTI", `/ti/${encodeURIComponent(contract.alertId)}`, [
      "alertId",
      "provenance.sourceFamilies",
      "provenance.captureIds",
      "provenance.contentHashes",
      "provenance.lastObservedAt"
    ], consumerBlockers.publicTI),
    caseWorkflow: alertProvenanceConsumerReadiness("case", contract.casePath, [
      "alertId",
      "caseId",
      "casePath",
      "provenance.captureIds",
      "workflowEventCount"
    ], consumerBlockers.caseWorkflow)
  };
  const blockedTransitions = [
    transitionBlock("dashboard", "render_dashboard_provenance", consumerBlockers.dashboard),
    transitionBlock("webhook", "prepare_webhook_dispatch", consumerBlockers.webhook),
    transitionBlock("publicTI", "refresh_public_ti_profile", consumerBlockers.publicTI),
    transitionBlock("caseWorkflow", "open_case_with_provenance", consumerBlockers.caseWorkflow)
  ].filter((transition): transition is DwmAlertProvenanceConsumerPacket["lifecycle"]["blockedTransitions"][number] => Boolean(transition));
  const allowedTransitions = [
    consumers.dashboard.ready ? "render_dashboard_provenance" as const : undefined,
    consumers.webhook.ready ? "prepare_webhook_dispatch" as const : undefined,
    consumers.publicTI.ready ? "refresh_public_ti_profile" as const : undefined,
    consumers.caseWorkflow.ready ? "open_case_with_provenance" as const : undefined
  ].filter(Boolean) as DwmAlertProvenanceConsumerPacket["lifecycle"]["allowedTransitions"];

  return {
    schemaVersion: DWM_ALERT_PROVENANCE_CONSUMER_PACKET_SCHEMA_VERSION,
    id: stableId("dwm_alert_provenance_consumer_packet", `${contract.id}:${input.generatedAt ?? contract.checkedAt}:${input.staleBefore ?? ""}:${(input.duplicateDedupeKeys ?? []).join(",")}`),
    generatedAt: input.generatedAt ?? contract.checkedAt,
    ok: blockers.length === 0,
    tenantId: contract.tenantId,
    organizationId: contract.organizationId,
    alertId: contract.alertId,
    caseId: contract.caseId,
    casePath: contract.casePath,
    dedupeKey: contract.dedupeKey,
    redacted: true,
    provenance: {
      redacted: true,
      ...contract.provenance
    },
    orgWatchlistScope: contract.orgWatchlistScope,
    lifecycle: {
      state: blockers.length === 0 ? "ready" : "blocked",
      reviewState: contract.reviewState,
      deliveryState: contract.deliveryState,
      workflowStatus: contract.workflowStatus,
      allowedTransitions,
      blockedTransitions
    },
    consumers,
    blockers,
    payloadShape: [
      "alertId",
      "organizationId",
      "caseId",
      "dedupeKey",
      "provenance.captureIds",
      "provenance.sourceIds",
      "provenance.contentHashes",
      "provenance.sourceFamilies",
      "orgWatchlistScope.watchlistItemIds",
      "orgWatchlistScope.alertGeneratorKeys",
      "consumers"
    ]
  };
}

export function buildAlertAnalystWorkflowEvent(input: {
  before: DwmAlertWorkflowContract;
  after: DwmAlertWorkflowContract;
  action: DwmAlertAnalystWorkflowAction;
  actorId?: string;
  rationale?: string;
  requestId?: string;
  generatedAt?: string;
  expectedWorkflowEventCount?: number;
  existingEventIds?: string[];
}): DwmAlertAnalystWorkflowEvent {
  const before = input.before;
  const after = input.after;
  const changedFields = workflowChangedFields(before, after);
  const idempotencyKey = stableId("dwm_alert_analyst_workflow_event", `${before.tenantId}:${before.organizationId ?? ""}:${before.alertId}:${input.action}:${input.actorId ?? ""}:${input.requestId ?? ""}:${after.workflowEventCount}`);
  const blockers = analystWorkflowEventBlockers({ ...input, changedFields, idempotencyKey });
  const consumerBlockers = {
    dashboard: analystConsumerBlockerCodes(blockers, ["missing_alert_id", "missing_org_scope", "missing_actor", "invalid_transition", "duplicate_workflow_event"]),
    caseWorkflow: analystConsumerBlockerCodes(blockers, ["missing_alert_id", "missing_org_scope", "missing_actor", "missing_case_route", "missing_rationale", "stale_workflow_version", "invalid_transition", "duplicate_workflow_event"]),
    webhook: analystConsumerBlockerCodes(blockers, ["missing_alert_id", "missing_org_scope", "missing_case_route", "missing_rationale", "missing_provenance", "stale_workflow_version", "invalid_transition", "duplicate_workflow_event"]),
    audit: analystConsumerBlockerCodes(blockers, ["missing_alert_id", "missing_org_scope", "missing_actor", "missing_rationale", "stale_workflow_version", "invalid_transition", "duplicate_workflow_event"])
  };

  return {
    schemaVersion: DWM_ALERT_ANALYST_WORKFLOW_EVENT_SCHEMA_VERSION,
    id: idempotencyKey,
    generatedAt: input.generatedAt ?? after.checkedAt,
    ok: blockers.length === 0,
    tenantId: after.tenantId || before.tenantId,
    organizationId: after.organizationId ?? before.organizationId,
    alertId: after.alertId || before.alertId,
    caseId: after.caseId ?? before.caseId,
    casePath: after.casePath ?? before.casePath,
    actorId: stringValue(input.actorId),
    action: input.action,
    rationale: stringValue(input.rationale),
    redacted: true,
    transition: {
      before: workflowLifecycleSnapshot(before),
      after: workflowLifecycleSnapshot(after),
      changedFields,
      expectedWorkflowEventCount: input.expectedWorkflowEventCount,
      valid: blockers.length === 0,
      idempotencyKey
    },
    provenance: {
      redacted: true,
      evidenceCount: after.provenance.evidenceCount,
      captureIds: after.provenance.captureIds,
      sourceIds: after.provenance.sourceIds,
      contentHashCount: after.provenance.contentHashes.length,
      sourceFamilies: after.provenance.sourceFamilies,
      orgWatchlistScope: after.orgWatchlistScope
    },
    consumers: {
      dashboard: analystWorkflowConsumerReadiness("dashboard", `/dashboard/dwm/alerts/${encodeURIComponent(after.alertId || before.alertId)}`, ["alertId", "organizationId", "action", "transition.changedFields"], consumerBlockers.dashboard),
      caseWorkflow: analystWorkflowConsumerReadiness("case", after.casePath ?? before.casePath, ["alertId", "caseId", "casePath", "actorId", "rationale", "transition.after"], consumerBlockers.caseWorkflow),
      webhook: analystWorkflowConsumerReadiness("webhook", input.action === "replay_webhook" ? "/v1/dwm/webhooks/deliver" : undefined, ["alertId", "organizationId", "caseId", "provenance.captureIds", "transition.idempotencyKey"], consumerBlockers.webhook),
      audit: analystWorkflowConsumerReadiness("audit", "/api/admin/support/inspect", ["alertId", "organizationId", "actorId", "action", "rationale", "transition.idempotencyKey"], consumerBlockers.audit)
    },
    blockers,
    payloadShape: [
      "alertId",
      "organizationId",
      "caseId",
      "actorId",
      "action",
      "rationale",
      "transition.before",
      "transition.after",
      "transition.changedFields",
      "transition.idempotencyKey",
      "provenance.captureIds",
      "provenance.sourceIds",
      "provenance.orgWatchlistScope",
      "consumers"
    ]
  };
}

export function buildAlertAnalystCaseLedgerAdapter(input: {
  event: DwmAlertAnalystWorkflowEvent;
  membership?: DwmAlertAnalystCaseLedgerAdapter["membership"];
  generatedAt?: string;
  allowedRoles?: string[];
  routePath?: "/v1/dwm/org-alert-case-actions";
}): DwmAlertAnalystCaseLedgerAdapter {
  const event = input.event;
  const action = caseLedgerActionFor(event.action);
  const blockers = analystCaseLedgerBlockers(event, input.membership, action, input.allowedRoles ?? ["owner", "admin", "analyst"]);
  const execution: DwmAlertAnalystCaseLedgerAdapter["route"]["body"]["receipt"]["execution"] = blockers.length === 0 ? "ready" : (event.ok ? "repair_required" : "blocked");
  const routePath = input.routePath ?? "/v1/dwm/org-alert-case-actions";
  const consumerBlockers = {
    caseLedger: caseLedgerConsumerBlockerCodes(blockers, ["workflow_event_blocked", "missing_case_target", "missing_membership", "wrong_org", "member_inactive", "role_not_allowed", "unsupported_case_action"]),
    dashboard: caseLedgerConsumerBlockerCodes(blockers, ["workflow_event_blocked", "missing_case_target", "wrong_org", "unsupported_case_action"]),
    audit: caseLedgerConsumerBlockerCodes(blockers, ["missing_membership", "wrong_org", "member_inactive", "role_not_allowed", "unsupported_case_action"])
  };
  const receipt = {
    schemaVersion: "dwm.alert_analyst_case_action_receipt.v1" as const,
    workflowEventId: event.id,
    action: action ?? ("add_note" as DwmAlertAnalystCaseLedgerAction),
    alertIds: event.alertId ? [event.alertId] : [],
    casePaths: event.casePath ? [event.casePath] : [],
    execution,
    ownerLane: caseLedgerOwnerLaneFor(event.action),
    route: event.casePath,
    method: event.casePath ? "GET" as const : undefined,
    analyst: {
      analystId: event.actorId,
      rationale: event.rationale
    },
    blockedByCodes: blockers.map((blocker) => blocker.code),
    idempotencyKey: stableId("dwm_alert_analyst_case_ledger_receipt", `${event.id}:${input.membership?.memberId ?? ""}:${routePath}`)
  };

  return {
    schemaVersion: DWM_ALERT_ANALYST_CASE_LEDGER_ADAPTER_SCHEMA_VERSION,
    id: stableId("dwm_alert_analyst_case_ledger_adapter", `${receipt.idempotencyKey}:${input.generatedAt ?? event.generatedAt}`),
    generatedAt: input.generatedAt ?? event.generatedAt,
    ok: blockers.length === 0,
    tenantId: event.tenantId,
    organizationId: event.organizationId,
    alertId: event.alertId,
    caseId: event.caseId,
    redacted: true,
    route: {
      method: "POST",
      path: routePath,
      body: {
        tenantId: event.tenantId,
        organizationId: event.organizationId,
        receipt
      },
      payloadShape: [
        "tenantId",
        "organizationId",
        "receipt.workflowEventId",
        "receipt.action",
        "receipt.alertIds",
        "receipt.casePaths",
        "receipt.analyst",
        "receipt.idempotencyKey"
      ],
      redacted: true
    },
    membership: input.membership,
    consumers: {
      caseLedger: caseLedgerConsumerReadiness("case", routePath, ["tenantId", "organizationId", "receipt.workflowEventId", "receipt.action", "receipt.casePaths"], consumerBlockers.caseLedger),
      dashboard: caseLedgerConsumerReadiness("dashboard", `/dashboard/dwm/alerts/${encodeURIComponent(event.alertId)}`, ["alertId", "caseId", "action", "execution"], consumerBlockers.dashboard),
      audit: caseLedgerConsumerReadiness("audit", "/api/admin/support/inspect", ["organizationId", "memberId", "role", "receipt.idempotencyKey"], consumerBlockers.audit)
    },
    blockers
  };
}

function provenanceScore(contract: DwmAlertWorkflowContract) {
  return contract.provenance.evidenceCount
    + asStringArray(contract.provenance.captureIds).length
    + asStringArray(contract.provenance.sourceIds).length
    + asStringArray(contract.provenance.contentHashes).length
    + asStringArray(contract.provenance.sourceFamilies).length
    + (contract.provenance.firstObservedAt ? 1 : 0)
    + (contract.provenance.lastObservedAt ? 1 : 0);
}

function orgWatchlistScopeScore(contract: DwmAlertWorkflowContract) {
  const scope = contract.orgWatchlistScope;
  if (!scope) return 0;
  return (scope.organizationId ? 1 : 0)
    + scope.ownerOrganizationIds.length
    + scope.watchlistIds.length
    + scope.watchlistItemIds.length
    + scope.alertGeneratorKeys.length;
}

function alertProvenanceConsumerBlockers(
  contract: DwmAlertWorkflowContract,
  input: { staleBefore?: string; duplicateDedupeKeys?: string[] }
): DwmAlertProvenanceConsumerBlocker[] {
  const blockers: DwmAlertProvenanceConsumerBlocker[] = [];
  if (!contract.organizationId) {
    blockers.push(alertProvenanceBlocker("missing_org_scope", "org", "organizationId", "Alert provenance consumers require organization scope."));
  }
  if (!contract.caseId || !contract.casePath) {
    blockers.push(alertProvenanceBlocker("missing_case_route", "case", !contract.caseId ? "caseId" : "casePath", "Case workflow consumers require case id and route."));
  }
  if (provenanceScore(contract) === 0 || contract.provenance.evidenceCount === 0 || !contract.provenance.captureIds.length) {
    blockers.push(alertProvenanceBlocker("missing_source_provenance", "source", "provenance", "Alert provenance consumers require source-backed evidence."));
  }
  if (input.staleBefore && contract.provenance.lastObservedAt && contract.provenance.lastObservedAt < input.staleBefore) {
    blockers.push(alertProvenanceBlocker("stale_source_provenance", "source", "provenance.lastObservedAt", "Alert provenance is older than the requested freshness boundary."));
  }
  if (orgWatchlistScopeScore(contract) === 0 || !contract.orgWatchlistScope?.watchlistItemIds.length || !contract.orgWatchlistScope.alertGeneratorKeys.length) {
    blockers.push(alertProvenanceBlocker("missing_org_watchlist_scope", "alert", "orgWatchlistScope", "Alert provenance consumers require org watchlist item ids and alert generation refs."));
  }
  if (contract.dedupeKey && input.duplicateDedupeKeys?.includes(contract.dedupeKey)) {
    blockers.push(alertProvenanceBlocker("duplicate_alert_unresolved", "alert", "dedupeKey", "Alert dedupe key is already associated with another unresolved alert."));
  }
  return uniqueAlertProvenanceBlockers(blockers);
}

function alertProvenanceConsumerReadiness(
  ownerLane: DwmAlertProvenanceConsumerReadiness["ownerLane"],
  route: string | undefined,
  requiredFields: string[],
  blockerCodes: DwmAlertProvenanceConsumerBlocker["code"][]
): DwmAlertProvenanceConsumerReadiness {
  return {
    ready: blockerCodes.length === 0,
    ownerLane,
    route,
    requiredFields,
    blockerCodes
  };
}

function consumerBlockerCodes(
  blockers: DwmAlertProvenanceConsumerBlocker[],
  codes: DwmAlertProvenanceConsumerBlocker["code"][]
): DwmAlertProvenanceConsumerBlocker["code"][] {
  return uniqueStrings(blockers.map((blocker) => blocker.code).filter((code) => codes.includes(code))) as DwmAlertProvenanceConsumerBlocker["code"][];
}

function transitionBlock(
  consumer: keyof DwmAlertProvenanceConsumerPacket["consumers"],
  transition: DwmAlertProvenanceConsumerPacket["lifecycle"]["allowedTransitions"][number],
  blockerCodes: DwmAlertProvenanceConsumerBlocker["code"][]
): DwmAlertProvenanceConsumerPacket["lifecycle"]["blockedTransitions"][number] | undefined {
  if (!blockerCodes.length) return undefined;
  return { consumer, transition, blockerCodes };
}

function alertProvenanceBlocker(
  code: DwmAlertProvenanceConsumerBlocker["code"],
  ownerLane: DwmAlertProvenanceConsumerBlocker["ownerLane"],
  path: string,
  message: string
): DwmAlertProvenanceConsumerBlocker {
  return { code, ownerLane, path, message };
}

function uniqueAlertProvenanceBlockers(blockers: DwmAlertProvenanceConsumerBlocker[]): DwmAlertProvenanceConsumerBlocker[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function workflowLifecycleSnapshot(contract: DwmAlertWorkflowContract): DwmAlertWorkflowLifecycleSnapshot {
  return {
    reviewState: contract.reviewState,
    deliveryState: contract.deliveryState,
    workflowStatus: contract.workflowStatus,
    assignedOwner: contract.assignedOwner,
    severityOverride: contract.severityOverride,
    caseId: contract.caseId,
    casePath: contract.casePath,
    workflowEventCount: contract.workflowEventCount
  };
}

function workflowChangedFields(before: DwmAlertWorkflowContract, after: DwmAlertWorkflowContract): string[] {
  const fields: Array<keyof DwmAlertWorkflowLifecycleSnapshot> = [
    "reviewState",
    "deliveryState",
    "workflowStatus",
    "assignedOwner",
    "severityOverride",
    "caseId",
    "casePath",
    "workflowEventCount"
  ];
  return fields.filter((field) => workflowLifecycleSnapshot(before)[field] !== workflowLifecycleSnapshot(after)[field]);
}

function analystWorkflowEventBlockers(input: {
  before: DwmAlertWorkflowContract;
  after: DwmAlertWorkflowContract;
  action: DwmAlertAnalystWorkflowAction;
  actorId?: string;
  rationale?: string;
  expectedWorkflowEventCount?: number;
  existingEventIds?: string[];
  changedFields: string[];
  idempotencyKey: string;
}): DwmAlertAnalystWorkflowEventBlocker[] {
  const blockers: DwmAlertAnalystWorkflowEventBlocker[] = [];
  const before = input.before;
  const after = input.after;
  if (!after.alertId && !before.alertId) blockers.push(analystWorkflowEventBlocker("missing_alert_id", "alert", "alertId", "Analyst workflow event requires alert identity."));
  if (!after.organizationId && !before.organizationId) blockers.push(analystWorkflowEventBlocker("missing_org_scope", "org", "organizationId", "Analyst workflow event requires organization scope."));
  if (!input.actorId) blockers.push(analystWorkflowEventBlocker("missing_actor", "alert", "actorId", "Analyst workflow event requires an actor id."));
  if (!after.caseId || !after.casePath) blockers.push(analystWorkflowEventBlocker("missing_case_route", "case", !after.caseId ? "caseId" : "casePath", "Analyst workflow event requires a linked case route."));
  if (requiresRationale(input.action) && !stringValue(input.rationale)) blockers.push(analystWorkflowEventBlocker("missing_rationale", "case", "rationale", "This analyst action requires a decision rationale."));
  if ((input.action === "replay_webhook" || input.action === "escalate") && !hasActionProvenance(after)) blockers.push(analystWorkflowEventBlocker("missing_provenance", "source", "provenance", "This analyst action requires source provenance."));
  if (input.expectedWorkflowEventCount !== undefined && before.workflowEventCount !== input.expectedWorkflowEventCount) blockers.push(analystWorkflowEventBlocker("stale_workflow_version", "alert", "expectedWorkflowEventCount", "Analyst workflow event was based on a stale workflow version."));
  if (!validAnalystTransition(input.action, before, after, input.changedFields)) blockers.push(analystWorkflowEventBlocker("invalid_transition", input.action === "replay_webhook" ? "webhook" : "alert", "transition.changedFields", "Analyst workflow event transition does not match the requested action."));
  if (input.existingEventIds?.includes(input.idempotencyKey)) blockers.push(analystWorkflowEventBlocker("duplicate_workflow_event", "alert", "transition.idempotencyKey", "Analyst workflow event idempotency key already exists."));
  return uniqueAnalystWorkflowEventBlockers(blockers);
}

function requiresRationale(action: DwmAlertAnalystWorkflowAction): boolean {
  return action === "escalate" || action === "suppress" || action === "close" || action === "reopen" || action === "replay_webhook";
}

function hasActionProvenance(contract: DwmAlertWorkflowContract): boolean {
  return contract.provenance.evidenceCount > 0
    && (contract.provenance.captureIds.length > 0 || contract.provenance.sourceIds.length > 0 || contract.provenance.contentHashes.length > 0);
}

function validAnalystTransition(
  action: DwmAlertAnalystWorkflowAction,
  before: DwmAlertWorkflowContract,
  after: DwmAlertWorkflowContract,
  changedFields: string[]
): boolean {
  if (changedFields.length === 0 && action !== "add_note") return false;
  if (action === "assign") return Boolean(after.assignedOwner && after.assignedOwner !== before.assignedOwner);
  if (action === "escalate") return after.reviewState === "escalated" || after.workflowStatus === "escalated" || after.severityOverride === "critical";
  if (action === "suppress") return after.reviewState === "false_positive" || after.deliveryState === "muted";
  if (action === "close") return after.workflowStatus === "closed" || after.reviewState === "closed";
  if (action === "reopen") return before.workflowStatus === "closed" && after.workflowStatus !== "closed";
  if (action === "replay_webhook") return after.deliveryState === "queued" || after.deliveryState === "ready_to_send" || changedFields.includes("workflowEventCount");
  return changedFields.length === 0 || changedFields.every((field) => field === "workflowEventCount");
}

function analystWorkflowConsumerReadiness(
  ownerLane: DwmAlertAnalystWorkflowConsumerReadiness["ownerLane"],
  route: string | undefined,
  requiredFields: string[],
  blockerCodes: DwmAlertAnalystWorkflowEventBlocker["code"][]
): DwmAlertAnalystWorkflowConsumerReadiness {
  return {
    ready: blockerCodes.length === 0,
    ownerLane,
    route,
    requiredFields,
    blockerCodes
  };
}

function analystConsumerBlockerCodes(
  blockers: DwmAlertAnalystWorkflowEventBlocker[],
  codes: DwmAlertAnalystWorkflowEventBlocker["code"][]
): DwmAlertAnalystWorkflowEventBlocker["code"][] {
  return uniqueStrings(blockers.map((blocker) => blocker.code).filter((code) => codes.includes(code))) as DwmAlertAnalystWorkflowEventBlocker["code"][];
}

function analystWorkflowEventBlocker(
  code: DwmAlertAnalystWorkflowEventBlocker["code"],
  ownerLane: DwmAlertAnalystWorkflowEventBlocker["ownerLane"],
  path: string,
  message: string
): DwmAlertAnalystWorkflowEventBlocker {
  return { code, ownerLane, path, message };
}

function uniqueAnalystWorkflowEventBlockers(blockers: DwmAlertAnalystWorkflowEventBlocker[]): DwmAlertAnalystWorkflowEventBlocker[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function caseLedgerActionFor(action: DwmAlertAnalystWorkflowAction): DwmAlertAnalystCaseLedgerAction | undefined {
  if (action === "assign") return "assign_owner";
  if (action === "escalate") return "escalate";
  if (action === "suppress") return "suppress";
  if (action === "close") return "close";
  if (action === "reopen") return "reopen";
  if (action === "replay_webhook") return "replay_delivery";
  if (action === "add_note") return "add_note";
  return undefined;
}

function caseLedgerOwnerLaneFor(action: DwmAlertAnalystWorkflowAction): "case" | "alert" | "source" | "webhook" {
  if (action === "replay_webhook") return "webhook";
  if (action === "escalate" || action === "suppress") return "alert";
  return "case";
}

function analystCaseLedgerBlockers(
  event: DwmAlertAnalystWorkflowEvent,
  membership: DwmAlertAnalystCaseLedgerAdapter["membership"],
  action: DwmAlertAnalystCaseLedgerAction | undefined,
  allowedRoles: string[]
): DwmAlertAnalystCaseLedgerAdapterBlocker[] {
  const blockers: DwmAlertAnalystCaseLedgerAdapterBlocker[] = [];
  if (!event.ok) blockers.push(caseLedgerBlocker("workflow_event_blocked", "alert", "event.ok", "Case action ledger adapter requires a valid analyst workflow event."));
  if (!event.caseId || !event.casePath) blockers.push(caseLedgerBlocker("missing_case_target", "case", !event.caseId ? "event.caseId" : "event.casePath", "Case action ledger adapter requires case identity and route."));
  if (!membership?.memberId) blockers.push(caseLedgerBlocker("missing_membership", "org", "membership.memberId", "Case action ledger adapter requires org member identity."));
  if (membership?.organizationId && event.organizationId && membership.organizationId !== event.organizationId) blockers.push(caseLedgerBlocker("wrong_org", "org", "membership.organizationId", "Case action ledger member belongs to a different organization."));
  if (membership?.status && membership.status !== "active") blockers.push(caseLedgerBlocker("member_inactive", "org", "membership.status", "Case action ledger member is not active."));
  if (membership?.role && !allowedRoles.includes(membership.role)) blockers.push(caseLedgerBlocker("role_not_allowed", "org", "membership.role", "Case action ledger member role cannot write analyst actions."));
  if (!action) blockers.push(caseLedgerBlocker("unsupported_case_action", "case", "event.action", "Analyst workflow action cannot be written to the case action ledger."));
  return uniqueCaseLedgerBlockers(blockers);
}

function caseLedgerConsumerReadiness(
  ownerLane: DwmAlertAnalystCaseLedgerConsumerReadiness["ownerLane"],
  route: string | undefined,
  requiredFields: string[],
  blockerCodes: DwmAlertAnalystCaseLedgerAdapterBlocker["code"][]
): DwmAlertAnalystCaseLedgerConsumerReadiness {
  return {
    ready: blockerCodes.length === 0,
    ownerLane,
    route,
    requiredFields,
    blockerCodes
  };
}

function caseLedgerConsumerBlockerCodes(
  blockers: DwmAlertAnalystCaseLedgerAdapterBlocker[],
  codes: DwmAlertAnalystCaseLedgerAdapterBlocker["code"][]
): DwmAlertAnalystCaseLedgerAdapterBlocker["code"][] {
  return uniqueStrings(blockers.map((blocker) => blocker.code).filter((code) => codes.includes(code))) as DwmAlertAnalystCaseLedgerAdapterBlocker["code"][];
}

function caseLedgerBlocker(
  code: DwmAlertAnalystCaseLedgerAdapterBlocker["code"],
  ownerLane: DwmAlertAnalystCaseLedgerAdapterBlocker["ownerLane"],
  path: string,
  message: string
): DwmAlertAnalystCaseLedgerAdapterBlocker {
  return { code, ownerLane, path, message };
}

function uniqueCaseLedgerBlockers(blockers: DwmAlertAnalystCaseLedgerAdapterBlocker[]): DwmAlertAnalystCaseLedgerAdapterBlocker[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeOrgWatchlistScope(value: any): DwmAlertWorkflowContract["orgWatchlistScope"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const organizationId = stringValue(value.organizationId);
  const ownerOrganizationIds = uniqueStrings(asStringArray(value.ownerOrganizationIds));
  const watchlistIds = uniqueStrings(asStringArray(value.watchlistIds));
  const watchlistItemIds = uniqueStrings(asStringArray(value.watchlistItemIds));
  const alertGeneratorKeys = uniqueStrings(asStringArray(value.alertGeneratorKeys));
  if (!organizationId && !ownerOrganizationIds.length && !watchlistIds.length && !watchlistItemIds.length && !alertGeneratorKeys.length) return undefined;
  return {
    schemaVersion: stringValue(value.schemaVersion),
    organizationId,
    ownerOrganizationIds,
    watchlistIds,
    watchlistItemIds,
    alertGeneratorKeys
  };
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)].filter(Boolean);
}

function blocker(code: DwmAlertWorkflowPreservationBlocker["code"], ownerLane: DwmAlertWorkflowPreservationBlocker["ownerLane"], path: string, message: string): DwmAlertWorkflowPreservationBlocker {
  return { code, ownerLane, path, message };
}

function nextAuditAction(code: DwmAlertWorkflowPreservationBlocker["code"]): DwmAlertWorkflowAdminAuditAdapter["nextActions"][number]["action"] {
  switch (code) {
    case "alert_identity_changed":
    case "organization_scope_changed":
    case "org_watchlist_scope_dropped":
      return "inspect_alert_scope";
    case "case_route_dropped":
      return "restore_case_route";
    case "owner_dropped":
      return "restore_assignee";
    case "delivery_state_regressed":
      return "restore_delivery_state";
    case "provenance_dropped":
      return "restore_provenance";
    case "review_state_regressed":
    case "workflow_events_regressed":
      return "review_workflow_transition";
  }
}

function supportActionBlockers(adapter: DwmAlertWorkflowAdminAuditAdapter): DwmAlertWorkflowSupportActionRequest["blockers"] {
  const blockers: DwmAlertWorkflowSupportActionRequest["blockers"] = [];
  if (!adapter.organizationId || !adapter.alertId) {
    blockers.push({
      code: "missing_support_target",
      ownerLane: "alert",
      path: !adapter.organizationId ? "adapter.organizationId" : "adapter.alertId",
      message: "Support action preparation requires organization and alert identity."
    });
  }
  if (!adapter.ok) {
    blockers.push(...adapter.nextActions.map((action) => ({
      code: "audit_blocked" as const,
      ownerLane: action.ownerLane,
      path: action.path,
      message: "Alert workflow audit has unresolved blockers."
    })));
  }
  return blockers;
}

function stringValue(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}
