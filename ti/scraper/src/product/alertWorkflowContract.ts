import { stableId, uniqueStrings } from "../utils.ts";

export const DWM_ALERT_WORKFLOW_CONTRACT_SCHEMA_VERSION = "dwm.alert_workflow_contract.v1" as const;
export const DWM_ALERT_WORKFLOW_PRESERVATION_SCHEMA_VERSION = "dwm.alert_workflow_preservation.v1" as const;

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

function provenanceScore(contract: DwmAlertWorkflowContract) {
  return contract.provenance.evidenceCount
    + contract.provenance.captureIds.length
    + contract.provenance.sourceIds.length
    + contract.provenance.contentHashes.length;
}

function blocker(code: DwmAlertWorkflowPreservationBlocker["code"], ownerLane: DwmAlertWorkflowPreservationBlocker["ownerLane"], path: string, message: string): DwmAlertWorkflowPreservationBlocker {
  return { code, ownerLane, path, message };
}

function stringValue(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}
