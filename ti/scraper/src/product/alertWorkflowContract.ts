import { stableId, uniqueStrings } from "../utils.ts";

export const DWM_ALERT_WORKFLOW_CONTRACT_SCHEMA_VERSION = "dwm.alert_workflow_contract.v1" as const;
export const DWM_ALERT_WORKFLOW_PRESERVATION_SCHEMA_VERSION = "dwm.alert_workflow_preservation.v1" as const;
export const DWM_ALERT_WORKFLOW_ADMIN_AUDIT_SCHEMA_VERSION = "dwm.alert_workflow_admin_audit.v1" as const;
export const DWM_ALERT_WORKFLOW_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION = "dwm.alert_workflow_support_action_request.v1" as const;

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
    | "provenance_dropped";
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

export function buildAlertWorkflowContract(input: {
  alert: Record<string, any>;
  checkedAt?: string;
}): DwmAlertWorkflowContract {
  const alert = input.alert;
  const workflowContext = alert.workflowContext ?? {};
  const webhookContext = alert.webhookContext ?? {};
  const deliveryReadinessContext = alert.deliveryReadinessContext ?? {};
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
      captureIds: uniqueStrings([...(provenance.captureIds ?? []), ...(workflowContext.captureIds ?? []), ...(webhookContext.captureIds ?? []), ...(deliveryReadinessContext.captureIds ?? [])].map(String)),
      sourceIds: uniqueStrings(evidence.map((row: any) => row.sourceId).filter(Boolean).map(String)),
      contentHashes: uniqueStrings(evidence.map((row: any) => row.contentHash).filter(Boolean).map(String))
    }
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
      provenance: provenanceScore(after) >= provenanceScore(before)
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

function provenanceScore(contract: DwmAlertWorkflowContract) {
  return contract.provenance.evidenceCount
    + contract.provenance.captureIds.length
    + contract.provenance.sourceIds.length
    + contract.provenance.contentHashes.length;
}

function blocker(code: DwmAlertWorkflowPreservationBlocker["code"], ownerLane: DwmAlertWorkflowPreservationBlocker["ownerLane"], path: string, message: string): DwmAlertWorkflowPreservationBlocker {
  return { code, ownerLane, path, message };
}

function nextAuditAction(code: DwmAlertWorkflowPreservationBlocker["code"]): DwmAlertWorkflowAdminAuditAdapter["nextActions"][number]["action"] {
  switch (code) {
    case "alert_identity_changed":
    case "organization_scope_changed":
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
