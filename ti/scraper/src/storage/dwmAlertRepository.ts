import { buildDwmProductSnapshot, classifySourceFamily, matchableCaptureText, type DwmAlert, type DwmWatchTerm } from "../product/dwmProduct.ts";
import { stableId, uniqueStrings } from "../utils.ts";
import type { RawCapture, SourceRecord } from "../types.ts";
import type { TiSourceProvenancePublicTiSourceOpsProjection } from "../product/sourceProvenanceTiPageContract.ts";
import type { RuntimeOrgMembershipContext, RuntimeOrgWatchlistTermContext } from "./dwmOrgWatchlistBridge.ts";

type DwmAlertVisibilityPolicy = "members" | "admins" | "owners";
export type DwmDeliveryReadinessBlockerCode =
  | "missing_org_ref"
  | "missing_capture_evidence"
  | "case_route_unavailable"
  | "delivery_disabled"
  | "replay_already_delivered"
  | "duplicate_delivered_dedupe"
  | "entitlement_denied";

export type DwmAlertGenerationBlockerCode =
  | "blocked_watchlist_scope"
  | "no_org_export"
  | "org_archived"
  | "org_deleted"
  | "member_revoked"
  | "role_not_allowed"
  | "org_export_unavailable"
  | "no_active_watchlist_terms"
  | "no_matching_captures"
  | "source_family_inactive"
  | "source_family_stale"
  | "entitlement_denied"
  | "missing_evidence"
  | "case_route_unavailable"
  | "webhook_destination_not_verified"
  | "support_only_redaction_needed"
  | "product_dedupe_pending";

export type DwmAlertGenerationBlocker = {
  code: DwmAlertGenerationBlockerCode;
  field: string;
  detail: string;
  recoverable: boolean;
  watchlistIds?: string[];
  candidateIds?: string[];
  sourceFamilies?: string[];
};

export type DwmZeroAlertProof = {
  schemaVersion: "dwm.zero_alert_proof.v1";
  zeroAlert: boolean;
  state:
    | "alerts_expected"
    | "blocked_no_watchlist"
    | "blocked_no_matching_capture"
    | "blocked_inactive_source"
    | "blocked_stale_source"
    | "blocked_entitlement"
    | "blocked_org_lifecycle"
    | "blocked_route"
    | "blocked_missing_evidence"
    | "blocked_unknown";
  expectedAlertDelta: number;
  blockerCodes: DwmAlertGenerationBlockerCode[];
  blockers: DwmAlertGenerationBlocker[];
  counts: {
    activeWatchlists: number;
    candidateCount: number;
    captureRefCount: number;
    matchedCandidateCount: number;
    unmatchedCandidateCount: number;
  };
  sourceFamilyCoverage: Array<{ sourceFamily: string; candidateCount: number; captureRefCount: number; watchlistIds: string[] }>;
  sourceFamilyGaps: DwmAlertGenerationReadiness["sourceFamilyGaps"];
  watchlistIds: string[];
  watchlistTerms: Array<{
    candidateId: string;
    watchlistIds: string[];
    watchlistItemIds: string[];
    term: string;
    kind?: string;
    organizationId?: string;
    hasMatchingCaptures: boolean;
    sourceFamilies: string[];
    captureRefCount: number;
  }>;
  candidateIdsMissingRoute: string[];
  routes: {
    readiness: "/v1/dwm/alerts/readiness";
    rebuild: "/v1/dwm/alerts/rebuild";
    alerts: "/v1/dwm/alerts";
  };
  nextAction: string;
};

export type DwmCustomerProofBlockerCode = DwmAlertGenerationBlockerCode | DwmDeliveryReadinessBlockerCode;

export type DwmAlertDownstreamHandoffBlockerCode =
  | "missing_alert"
  | "org_mismatch"
  | "archived_org"
  | "retired_watchlist"
  | "disabled_destination"
  | "case_unavailable"
  | "destination_unavailable"
  | "entitlement_denied"
  | "stale_workflow"
  | "duplicate_replay"
  | "closed_alert"
  | "suppressed_alert"
  | "revoked_actor"
  | "no_active_source_match";

export type DwmAlertWorkflowExecutionBlockerCode =
  | "missing_alert"
  | "org_mismatch"
  | "revoked_actor"
  | "revoked_nonmember_actor"
  | "role_not_allowed"
  | "invalid_transition"
  | "stale_workflow_version"
  | "case_unavailable"
  | "delivery_unavailable"
  | "entitlement_denied"
  | "duplicate_replay"
  | "support_redaction_only"
  | "archived_org"
  | "retired_watchlist"
  | "disabled_destination"
  | "closed_alert"
  | "suppressed_alert"
  | "no_active_source_match";

export type DwmAlertWorkflowExecutionReadiness = {
  schemaVersion: "dwm.alert_workflow_execution_readiness.v1";
  alertId?: string;
  organizationId?: string;
  createdEvent?: {
    schemaVersion: "dwm.alert_created_event.v1";
    eventId?: string;
    eventType?: string;
    at?: string;
    sourceFamily?: string;
    captureIds: string[];
    dedupeKey?: string;
    deliveryDedupeKey?: string;
    recommendedRoute?: string;
    alertDetailPath?: string;
    consumerPayload?: Record<string, any>;
  };
  createdEventDispatch?: {
    schemaVersion: "dwm.alert_created_event_dispatch.v1";
    ready: boolean;
    eventId?: string;
    eventType: string;
    alertId?: string;
    organizationId?: string;
    sourceFamily?: string;
    captureIds: string[];
    selectedCaptureIds: string[];
    deliveryDedupeKey?: string;
    idempotencyKey?: string;
    workflowEventCount: number;
    blockerCodes: DwmAlertWorkflowExecutionBlockerCode[];
  };
  workflowActionEvent?: {
    schemaVersion: "dwm.alert_workflow_action_event.v1";
    ready: boolean;
    action: DwmAlertWorkflowExecutionReadiness["action"];
    alertId?: string;
    organizationId?: string;
    sourceFamily?: string;
    watchlistIds: string[];
    watchlistItemIds: string[];
    captureIds: string[];
    selectedCaptureIds: string[];
    evidenceCount: number;
    dedupeKey?: string;
    deliveryDedupeKey?: string;
    alertDetailPath?: string;
    caseIdCandidate?: string;
    caseId?: string;
    casePath?: string;
    workflowEventCount: number;
    expectedWorkflowEventCount?: number;
    idempotencyKey?: string;
    blockerCodes: DwmAlertWorkflowExecutionBlockerCode[];
  };
  ready: boolean;
  action: "assign" | "note" | "transition" | "case_link" | "replay" | "close" | "reopen" | "suppress" | "deliver";
  expectedWorkflowEventCount?: number;
  currentWorkflowEventCount?: number;
  expectedUpdatedAt?: string;
  currentUpdatedAt?: string;
  blockerCodes: DwmAlertWorkflowExecutionBlockerCode[];
  blockers: Array<{ code: DwmAlertWorkflowExecutionBlockerCode; field: string; detail: string; recoverable: boolean }>;
  requiredBody: string[];
  idempotencyKey?: string;
};

export type DwmOrgAlertCaseRole = "owner" | "admin" | "analyst" | "member" | "viewer" | "support" | "nonmember";
export type DwmOrgAlertCaseCapability = "create_watchlist" | "edit_watchlist_terms" | "acknowledge_alert" | "assign_case" | "manage_invites";

export type DwmOrgAlertCaseRoleGate = {
  schemaVersion: "dwm.org_alert_case_role_gate.v1";
  role: DwmOrgAlertCaseRole;
  requestedCapability?: DwmOrgAlertCaseCapability;
  allowed: boolean;
  allowedCapabilities: DwmOrgAlertCaseCapability[];
  deniedReason?: "not_member" | "support_redaction_only" | "insufficient_role";
  lifecycleGuards: {
    revokedMembersDenied: true;
    expiredInvitesDenied: true;
    retiredWatchlistsExcluded: true;
    orgScopeRequired: true;
  };
};

export type DwmAlertCustomerProofHandoffRow = {
  schemaVersion: "dwm.customer_alert_proof.v1";
  alertId: string;
  tenantId: string;
  organizationId?: string;
  dedupeKey: string;
  alertDetailPath?: string;
  deliveryDedupeKey: string;
  replayMarker?: string;
  sourceFamily: string;
  evidenceCount: number;
  selectedCaptureIds: string[];
  generationEvidenceWindow?: {
    captureIds: string[];
    sourceFamilies: string[];
    contentHashes: string[];
    firstObservedAt?: string;
    lastObservedAt?: string;
  };
  provenance: {
    matchBasis?: string;
    captureIds: string[];
    sourceIds: string[];
    generatedAt?: string;
  };
  alertGenerationRefs: Array<Record<string, any>>;
  sourceProvenanceSummary: DwmAlertSourceProvenanceSummary;
  createdEvent?: {
    schemaVersion: "dwm.alert_created_event.v1";
    eventId?: string;
    eventType?: string;
    at?: string;
    sourceFamily?: string;
    captureIds: string[];
    dedupeKey?: string;
    deliveryDedupeKey?: string;
    recommendedRoute?: string;
    alertDetailPath?: string;
    consumerPayload?: Record<string, any>;
  };
  updatedEvent?: {
    schemaVersion: "dwm.alert_updated_event.v1";
    eventId?: string;
    eventType?: string;
    at?: string;
    sourceFamily?: string;
    captureIds: string[];
    addedCaptureIds: string[];
    removedCaptureIds: string[];
    evidenceCount?: number;
    previousEvidenceCount?: number;
    dedupeKey?: string;
    deliveryDedupeKey?: string;
    recommendedRoute?: string;
    alertDetailPath?: string;
    consumerPayload?: Record<string, any>;
  };
  workflow: {
    status: string;
    reviewState?: string;
    deliveryState?: string;
    assignedOwner?: string;
    severityOverride?: string;
    note?: string;
    rationale?: string;
    decision?: {
      value?: string;
      rationale?: string;
      falsePositiveReason?: string;
      suppressionReason?: string;
      decidedAt?: string;
      decidedBy?: string;
    };
    eventCount: number;
    transitionEvents: Array<{
      schemaVersion: "dwm.alert_workflow_transition_event.v1";
      id: string;
      at?: string;
      actor?: string;
      eventType: string;
      action: "reviewed" | "escalated" | "suppressed" | "closed" | "reopened" | "assigned" | "note" | "transition";
      fromStatus?: string;
      toStatus: string;
      caseId?: string;
      casePath?: string;
      hasNote: boolean;
      hasRationale: boolean;
      dedupeKey: string;
      sourceFamily: string;
      watchlistIds: string[];
      captureIds: string[];
    }>;
    replayCount: number;
  };
  caseHandoff: {
    ready: boolean;
    caseIdCandidate?: string;
    caseId?: string;
    casePath?: string;
    route: "/v1/cases";
  };
  delivery: {
    ready: boolean;
    state?: string;
    webhookDestinationIds: string[];
    deliveryHistoryRefs: string[];
    lastDeliveryStatus?: string;
    lastDeliveryAt?: string;
    delivered: boolean;
  };
  support: {
    redacted: boolean;
    redactionRequired: boolean;
    guidance: string;
  };
  consumerCompatibility: {
    webhook: { canConsume: boolean; requiredFields: string[] };
    helpdesk: { canConsume: boolean; supportOnlyRedactionNeeded: boolean };
    publicTI: { canConsume: boolean; alertGeneratorKeys: string[] };
  };
  consumerAdapter: {
    schemaVersion: "dwm.org_alert_case_consumer_adapter.v1";
    organizationId?: string;
    tenantId: string;
    alertId: string;
    dedupeKey: string;
    watchlistIds: string[];
    watchlistItemIds: string[];
    alertGeneratorKeys: string[];
    alertGenerationRefs: Array<Record<string, any>>;
    dashboard: {
      route: "organization_watchlist";
      casePath?: string;
      alertDetailPath?: string;
      fields: string[];
    };
    helpdesk: {
      redacted: true;
      supportOnlyRedactionNeeded: boolean;
      safeFields: string[];
    };
    publicTI: {
      canConsume: boolean;
      fields: string[];
    };
    roleGates: Record<DwmOrgAlertCaseCapability, DwmOrgAlertCaseRole[]>;
  };
  consumerContract: {
    schemaVersion: "dwm.alert_consumer_contract.v1";
    queue: {
      route: "/v1/dwm/alerts";
      stableFields: string[];
      workflowStatus: string;
      sourceFamily: string;
      evidenceCount: number;
    };
    detail: {
      route: "/v1/dwm/alerts/:alertId";
      alertDetailPath?: string;
      stableFields: string[];
      selectedCaptureIds: string[];
      provenanceCaptureIds: string[];
      generationEvidenceWindow?: DwmAlertCustomerProofHandoffRow["generationEvidenceWindow"];
    };
    webhookEvent: {
      eventType: "dwm.alert.created";
      eventId?: string;
      dispatchReady: boolean;
      deliveryDedupeKey: string;
      replayMarker?: string;
      requiredFields: string[];
    };
    webhookUpdatedEvent?: {
      eventType: "dwm.alert.updated";
      eventId?: string;
      dispatchReady: boolean;
      deliveryDedupeKey: string;
      replayMarker?: string;
      addedCaptureIds: string[];
      requiredFields: string[];
    };
    publicTI: {
      redacted: true;
      canConsume: boolean;
      stableFields: string[];
      alertGeneratorKeys: string[];
      alertGenerationRefs: Array<Record<string, any>>;
    };
  };
  blockerCodes: DwmCustomerProofBlockerCode[];
  typedBlockers: Array<{ code: DwmCustomerProofBlockerCode; field: string; detail: string; recoverable: boolean }>;
  generatedAt: string;
};

export type DwmAlertSourceProvenanceSummary = {
  schemaVersion: "dwm.alert_source_provenance.v1";
  alertId?: string;
  tenantId?: string;
  organizationId?: string;
  sourceFamily?: string;
  sourceFamilies: string[];
  captureIds: string[];
  sourceIds: string[];
  contentHashes: string[];
  evidenceCount: number;
  firstObservedAt?: string;
  lastObservedAt?: string;
  recommendedRoute?: string;
  confidenceReasoning: string[];
  provenance: {
    matchBasis?: string;
    generatedAt?: string;
    metadataOnly?: boolean;
  };
  provenanceGaps: Array<{
    code: "missing_source_url" | "missing_source_key" | "missing_observed_at" | "missing_content_hash";
    field: string;
    evidenceId?: string;
    recoverable: boolean;
    detail: string;
  }>;
  evidenceExcerpts: Array<{
    evidenceId: string;
    captureId?: string;
    sourceId?: string;
    sourceKey?: string;
    sourceUrl?: string;
    sourceFamily?: string;
    observedAt?: string;
    contentHash?: string;
    excerpt?: string;
    redactionState?: string;
  }>;
  generationEvidenceWindow?: {
    captureIds: string[];
    sourceFamilies: string[];
    contentHashes: string[];
    firstObservedAt?: string;
    lastObservedAt?: string;
  };
};

export type DwmAlertMatchReason = {
  schemaVersion: "dwm.alert_match_reason.v1";
  alertId?: string;
  tenantId?: string;
  organizationId?: string;
  sourceFamily?: string;
  matchedTerm?: {
    value?: string;
    kind?: string;
    normalized?: string;
    category?: string;
  };
  matchBasis?: string;
  matchType?: string;
  matchedFieldHints: string[];
  captureIds: string[];
  sourceIds: string[];
  watchlistIds: string[];
  watchlistItemIds: string[];
  evidenceCount: number;
  confidence?: number;
  confidenceReasoning: string[];
  recommendedRoute?: string;
  reason: string;
};

export type DwmAlertOrgWatchlistScope = {
  schemaVersion: "dwm.alert_org_watchlist_scope.v1";
  tenantId?: string;
  organizationId?: string;
  ownerOrganizationIds: string[];
  visibilityPolicy?: string;
  entitlementStatus?: string;
  organizationLifecycleState?: string;
  allowedViewerRoles: string[];
  watchlistIds: string[];
  watchlistItemIds: string[];
  alertGeneratorKeys: string[];
  terms: Array<{
    watchlistId: string;
    watchlistItemId: string;
    itemId: string;
    organizationId: string;
    tenantId: string;
    ownerOrganizationId: string;
    term: string;
    normalizedTerm: string;
    category: string;
    termFamily: string;
    status: string;
    alertGeneratorKey: string;
    lifecycleReason?: string | null;
    lifecycleRequestId?: string | null;
  }>;
};

export type DwmAlertDownstreamHandoff = {
  schemaVersion: "dwm.alert_downstream_handoff.v1";
  handoffId: string;
  alertId?: string;
  alertDetailPath?: string;
  tenantId?: string;
  organizationId?: string;
  ready: boolean;
  sourceFamily?: string;
  watchlist: {
    watchlistIds: string[];
    watchlistItemIds: string[];
    alertGeneratorKeys: string[];
    alertGenerationRefs: Array<Record<string, any>>;
  };
  evidence: {
    evidenceCount: number;
    selectedCaptureIds: string[];
    captureIds: string[];
    sourceIds: string[];
    duplicateEvidenceSuppression?: DwmDuplicateEvidenceSuppressionSummary;
    provenanceGeneratedAt?: string;
    matchBasis?: string;
    generationEvidenceWindow?: {
      captureIds: string[];
      sourceFamilies: string[];
      contentHashes: string[];
      firstObservedAt?: string;
      lastObservedAt?: string;
    };
  };
  matchReason?: DwmAlertMatchReason;
  dedupe: {
    alertDedupeKey?: string;
    deliveryDedupeKey?: string;
    replayMarker?: string;
  };
  createdEvent?: {
    schemaVersion: "dwm.alert_created_event.v1";
    eventId?: string;
    eventType?: string;
    at?: string;
    sourceFamily?: string;
    captureIds: string[];
    dedupeKey?: string;
    deliveryDedupeKey?: string;
    recommendedRoute?: string;
    alertDetailPath?: string;
    consumerPayload?: Record<string, any>;
  };
  updateReceipt?: {
    schemaVersion: "dwm.alert_update_receipt.v1";
    ready: boolean;
    eventId?: string;
    eventType: "dwm.alert.updated";
    alertId?: string;
    tenantId?: string;
    organizationId?: string;
    addedCaptureIds: string[];
    removedCaptureIds: string[];
    selectedCaptureIds: string[];
    evidenceCount?: number;
    previousEvidenceCount?: number;
    workflowEventCount: number;
    caseId?: string;
    casePath?: string;
    deliveryDedupeKey?: string;
    alertGenerationRefs: Array<Record<string, any>>;
    blockerCodes: Array<DwmAlertDownstreamHandoffBlockerCode | DwmDeliveryReadinessBlockerCode>;
  };
  workflowVersion: {
    eventCount: number;
    updatedAt?: string;
    expectedEventCount?: number;
    replayCount: number;
    lastReplayedAt?: string;
  };
  workflowTransitions: {
    schemaVersion: "dwm.alert_workflow_transition_summary.v1";
    actions: Array<DwmAlertCustomerProofHandoffRow["workflow"]["transitionEvents"][number]["action"]>;
    lastEventAt?: string;
    caseLinked: boolean;
    closed: boolean;
    suppressed: boolean;
  };
  workflowDecision: {
    value?: string;
    rationale?: string;
    falsePositiveReason?: string;
    suppressionReason?: string;
    decidedAt?: string;
    decidedBy?: string;
  };
  caseReadiness: {
    ready: boolean;
    route: "/v1/cases";
    caseIdCandidate?: string;
    caseId?: string;
    casePath?: string;
    idempotencyKey?: string;
  };
  deliveryReadiness: {
    ready: boolean;
    webhookDestinationIds: string[];
    destinationReady: boolean;
    deliveryHistoryRefs: string[];
    lastDeliveryStatus?: string;
    lastDeliveryAt?: string;
    idempotencyKey?: string;
  };
  deliverySelection: {
    schemaVersion: "dwm.alert_delivery_selection.v1";
    ready: boolean;
    selectedWebhookDestinationId?: string;
    webhookDestinationIds: string[];
    enabledWebhookDestinationIds: string[];
    disabledWebhookDestinationIds: string[];
    selectedCaptureIds: string[];
    sourceFamily?: string;
    deliveryDedupeKey?: string;
    idempotencyKey?: string;
    blockerCodes: Array<DwmAlertDownstreamHandoffBlockerCode | DwmDeliveryReadinessBlockerCode>;
  };
  createdEventDispatch: {
    schemaVersion: "dwm.alert_created_event_dispatch.v1";
    ready: boolean;
    eventId?: string;
    eventType: string;
    alertId?: string;
    tenantId?: string;
    organizationId?: string;
    sourceFamily?: string;
    captureIds: string[];
    selectedCaptureIds: string[];
    deliveryDedupeKey?: string;
    idempotencyKey?: string;
    workflowEventCount: number;
    alertGenerationRefs: Array<Record<string, any>>;
    blockerCodes: Array<DwmAlertDownstreamHandoffBlockerCode | DwmDeliveryReadinessBlockerCode>;
  };
  lifecycle: {
    organizationStatus?: string;
    retiredWatchlistIds: string[];
    disabledDestinationIds: string[];
    alertStatus: string;
    assignedOwner?: string;
    actorAllowed?: boolean;
    activeSourceMatch: boolean;
  };
  replay: {
    idempotent: true;
    duplicate: boolean;
    canReplay: boolean;
    replayMarker?: string;
    nextReplayIdempotencyKey?: string;
  };
  replayReceipt: {
    schemaVersion: "dwm.alert_replay_receipt.v1";
    ready: boolean;
    alertId?: string;
    tenantId?: string;
    organizationId?: string;
    replayMarker?: string;
    replayCount: number;
    idempotencyKey?: string;
    workflowEventCount: number;
    caseIdCandidate?: string;
    caseId?: string;
    casePath?: string;
    deliveryDedupeKey?: string;
    selectedCaptureIds: string[];
    watchlistItemIds: string[];
    alertGenerationRefs: Array<Record<string, any>>;
    blockerCodes: Array<DwmAlertDownstreamHandoffBlockerCode | DwmDeliveryReadinessBlockerCode>;
  };
  customerProof: {
    schemaVersion: "dwm.customer_alert_proof.v1";
    blockerCodes: DwmCustomerProofBlockerCode[];
  };
  blockerCodes: DwmAlertDownstreamHandoffBlockerCode[];
  blockers: Array<{ code: DwmAlertDownstreamHandoffBlockerCode; field: string; detail: string; recoverable: boolean }>;
  generatedAt: string;
};

export type DwmAlertRetentionAudit = {
  schemaVersion: "dwm.alert_retention_audit.v1";
  alertId?: string;
  tenantId?: string;
  organizationId?: string;
  retentionState: "active_monitoring" | "audit_retained" | "lifecycle_blocked_retained" | "review_for_cleanup";
  reasonCodes: Array<
    | DwmAlertDownstreamHandoffBlockerCode
    | "has_evidence"
    | "has_workflow_history"
    | "has_delivery_history"
    | "has_case_link"
    | "customer_proof_required"
  >;
  preserve: {
    alertRecord: true;
    evidenceRefs: boolean;
    provenance: boolean;
    dedupeKeys: boolean;
    workflowHistory: boolean;
    deliveryHistory: boolean;
    caseLinkage: boolean;
    customerProof: boolean;
  };
  cleanup: {
    deleteEligible: boolean;
    reviewRequired: boolean;
    purgeBlockedReasons: string[];
    retiredWatchlistIds: string[];
    disabledDestinationIds: string[];
  };
  helpdeskAudit: {
    redacted: true;
    safeFields: string[];
    auditRoute?: string;
    summary: string;
  };
  generatedAt: string;
};

export function buildDwmAlertWorkflowExecutionReadiness(input: {
  alert?: any;
  organizationId?: string;
  action?: DwmAlertWorkflowExecutionReadiness["action"];
  expectedWorkflowEventCount?: number;
  expectedUpdatedAt?: string;
  actorAllowed?: boolean;
  actorDenyReason?: string;
  actorRole?: DwmOrgAlertCaseRole;
  requiredCapability?: DwmOrgAlertCaseCapability;
  transitionValid?: boolean;
  caseAvailable?: boolean;
  deliveryAvailable?: boolean;
  entitlementAllowed?: boolean;
  duplicateReplay?: boolean;
  supportOnlyRedactionNeeded?: boolean;
  lifecycleBlockers?: DwmAlertWorkflowExecutionBlockerCode[];
}): DwmAlertWorkflowExecutionReadiness {
  const alert = input.alert;
  const action = input.action ?? "transition";
  const roleGate = input.actorRole ? buildDwmOrgAlertCaseRoleGate({
    role: input.actorRole,
    capability: input.requiredCapability ?? capabilityForWorkflowAction(action)
  }) : undefined;
  const currentWorkflowEventCount = alert ? (alert.workflowEvents ?? []).length : undefined;
  const currentUpdatedAt = alert?.updatedAt;
  const workflowContext = alert?.deliveryReadinessContext ?? alert?.workflowContext ?? alert?.webhookContext ?? {};
  const selectedCaptureIds = uniqueStrings(asStringArray(workflowContext.selectedCaptureIds ?? workflowContext.captureIds ?? alert?.provenance?.captureIds));
  const createdEvent = normalizeDwmAlertCreatedEvent(alert, workflowContext, selectedCaptureIds);
  const lifecycleBlockers = (uniqueStrings(input.lifecycleBlockers ?? []) as DwmAlertWorkflowExecutionBlockerCode[]).map((code) =>
    workflowExecutionBlocker(code, "lifecycle", workflowLifecycleBlockerDetail(code), code !== "retired_watchlist")
  );
  const blockers = [
    !alert ? workflowExecutionBlocker("missing_alert", "alertId", "Persisted alert is required for analyst workflow execution.", true) : undefined,
    alert && input.organizationId && alert.organizationId && alert.organizationId !== input.organizationId ? workflowExecutionBlocker("org_mismatch", "organizationId", "Alert organization does not match the requested workflow scope.", false) : undefined,
    input.actorAllowed === false ? workflowExecutionBlocker("revoked_nonmember_actor", "actor", input.actorDenyReason ?? "Actor is not an active authorized organization member.", false) : undefined,
    roleGate && !roleGate.allowed ? workflowExecutionBlocker("role_not_allowed", "actor.role", `Role ${roleGate.role} cannot ${roleGate.requestedCapability}.`, false) : undefined,
    input.transitionValid === false ? workflowExecutionBlocker("invalid_transition", "status", "Requested workflow transition is not valid for this alert.", true) : undefined,
    input.expectedWorkflowEventCount !== undefined && currentWorkflowEventCount !== undefined && input.expectedWorkflowEventCount !== currentWorkflowEventCount ? workflowExecutionBlocker("stale_workflow_version", "expectedWorkflowEventCount", "Workflow event count changed; reload before mutating this alert.", true) : undefined,
    input.expectedUpdatedAt && currentUpdatedAt && input.expectedUpdatedAt !== currentUpdatedAt ? workflowExecutionBlocker("stale_workflow_version", "expectedUpdatedAt", "Alert updated timestamp changed; reload before mutating this alert.", true) : undefined,
    input.caseAvailable === false ? workflowExecutionBlocker("case_unavailable", "caseId", "Case route or case record is unavailable for this transition.", true) : undefined,
    input.deliveryAvailable === false ? workflowExecutionBlocker("delivery_unavailable", "deliveryReadinessContext", "Delivery context is unavailable for this transition.", true) : undefined,
    input.entitlementAllowed === false ? workflowExecutionBlocker("entitlement_denied", "entitlement", "Entitlement policy blocks this alert workflow action.", true) : undefined,
    input.duplicateReplay === true ? workflowExecutionBlocker("duplicate_replay", "replayMarker", "Replay has already been recorded for this delivered dedupe key.", false) : undefined,
    input.supportOnlyRedactionNeeded === true ? workflowExecutionBlocker("support_redaction_only", "support.redactionRequired", "Actor can only consume redacted support context for this alert.", true) : undefined,
    ...lifecycleBlockers
  ].filter(Boolean) as DwmAlertWorkflowExecutionReadiness["blockers"];
  const blockerCodes = uniqueStrings(blockers.map((blocker) => blocker.code)) as DwmAlertWorkflowExecutionBlockerCode[];
  const workflowActionEvent = alert ? {
    schemaVersion: "dwm.alert_workflow_action_event.v1" as const,
    ready: blockerCodes.length === 0,
    action,
    alertId: alert.id,
    organizationId: input.organizationId ?? alert.organizationId,
    sourceFamily: alert.sourceFamily ?? workflowContext.sourceFamily,
    watchlistIds: uniqueStrings([
      ...asStringArray(workflowContext.watchlistIds),
      ...asStringArray(alert.watchlistIds)
    ]),
    watchlistItemIds: uniqueStrings([
      ...asStringArray(workflowContext.watchlistItemIds),
      ...asStringArray(alert.watchlistItemIds)
    ]),
    captureIds: uniqueStrings(asStringArray(alert.provenance?.captureIds ?? selectedCaptureIds)),
    selectedCaptureIds,
    evidenceCount: Number(workflowContext.evidenceCount ?? alert.evidence?.length ?? 0),
    dedupeKey: alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey ?? workflowContext.dedupeKey,
    deliveryDedupeKey: alert.webhookDelivery?.dedupeKey ?? workflowContext.deliveryDedupeKey ?? alert.dedupeKey,
    alertDetailPath: workflowContext.alertDetailPath ?? alert.alertDetailPath,
    caseIdCandidate: workflowContext.caseIdCandidate ?? alert.caseIdCandidate,
    caseId: workflowContext.caseId ?? alert.caseId,
    casePath: workflowContext.casePath ?? alert.casePath,
    workflowEventCount: currentWorkflowEventCount ?? 0,
    expectedWorkflowEventCount: input.expectedWorkflowEventCount,
    idempotencyKey: stableId("dwm_alert_workflow_action_event", `${alert.id}:${currentWorkflowEventCount ?? 0}:${action}:${selectedCaptureIds.join("|")}`),
    blockerCodes
  } : undefined;
  return {
    schemaVersion: "dwm.alert_workflow_execution_readiness.v1",
    alertId: alert?.id,
    organizationId: input.organizationId ?? alert?.organizationId,
    createdEvent,
    createdEventDispatch: createdEvent ? {
      schemaVersion: "dwm.alert_created_event_dispatch.v1",
      ready: blockerCodes.length === 0,
      eventId: createdEvent.eventId,
      eventType: createdEvent.eventType ?? "dwm.alert.created",
      alertId: alert?.id,
      organizationId: input.organizationId ?? alert?.organizationId,
      sourceFamily: createdEvent.sourceFamily ?? alert?.sourceFamily ?? workflowContext.sourceFamily,
      captureIds: createdEvent.captureIds,
      selectedCaptureIds,
      deliveryDedupeKey: createdEvent.deliveryDedupeKey ?? workflowContext.deliveryDedupeKey ?? alert?.webhookDelivery?.dedupeKey ?? alert?.dedupeKey,
      idempotencyKey: alert ? stableId("dwm_alert_created_workflow_dispatch", `${alert.id}:${createdEvent.eventId ?? "missing"}:${currentWorkflowEventCount ?? 0}:${action}`) : undefined,
      workflowEventCount: currentWorkflowEventCount ?? 0,
      blockerCodes
    } : undefined,
    workflowActionEvent,
    ready: blockers.length === 0,
    action,
    expectedWorkflowEventCount: input.expectedWorkflowEventCount,
    currentWorkflowEventCount,
    expectedUpdatedAt: input.expectedUpdatedAt,
    currentUpdatedAt,
    blockerCodes,
    blockers,
    requiredBody: ["organizationId", "status|action|note|assignedOwner|severityOverride|caseId", "expectedWorkflowEventCount?"],
    idempotencyKey: alert ? stableId("dwm_workflow_execution", `${alert.id}:${currentWorkflowEventCount ?? 0}:${action}`) : undefined
  };
}

function workflowExecutionBlocker(code: DwmAlertWorkflowExecutionBlockerCode, field: string, detail: string, recoverable: boolean): DwmAlertWorkflowExecutionReadiness["blockers"][number] {
  return { code, field, detail, recoverable };
}

function workflowLifecycleBlockerDetail(code: DwmAlertWorkflowExecutionBlockerCode): string {
  if (code === "archived_org") return "Organization lifecycle is not active for alert workflow execution.";
  if (code === "retired_watchlist") return "Retired watchlist alerts are visible for audit but cannot be replayed.";
  if (code === "disabled_destination") return "Webhook destination is disabled for downstream replay.";
  if (code === "closed_alert") return "Closed alerts are visible for audit but cannot create new replay workflow events.";
  if (code === "suppressed_alert") return "Suppressed alerts are visible for audit but cannot create new replay workflow events.";
  if (code === "revoked_actor") return "Actor is not active for this organization.";
  if (code === "no_active_source_match") return "No active source currently backs this alert source family.";
  return "Lifecycle state blocks this alert workflow action.";
}

export function buildDwmOrgAlertCaseRoleGate(input: {
  role?: DwmOrgAlertCaseRole | string | null;
  capability?: DwmOrgAlertCaseCapability;
}): DwmOrgAlertCaseRoleGate {
  const role = normalizeOrgAlertCaseRole(input.role);
  const allowedCapabilities = roleCapabilities(role);
  const requestedCapability = input.capability;
  const allowed = requestedCapability ? allowedCapabilities.includes(requestedCapability) : allowedCapabilities.length > 0;
  return {
    schemaVersion: "dwm.org_alert_case_role_gate.v1",
    role,
    requestedCapability,
    allowed,
    allowedCapabilities,
    deniedReason: allowed ? undefined : role === "nonmember" ? "not_member" : role === "support" ? "support_redaction_only" : "insufficient_role",
    lifecycleGuards: {
      revokedMembersDenied: true,
      expiredInvitesDenied: true,
      retiredWatchlistsExcluded: true,
      orgScopeRequired: true
    }
  };
}

function capabilityForWorkflowAction(action: DwmAlertWorkflowExecutionReadiness["action"]): DwmOrgAlertCaseCapability {
  if (action === "assign" || action === "case_link") return "assign_case";
  return "acknowledge_alert";
}

function normalizeOrgAlertCaseRole(value: unknown): DwmOrgAlertCaseRole {
  const role = String(value ?? "").trim().toLowerCase();
  return role === "owner" || role === "admin" || role === "analyst" || role === "member" || role === "viewer" || role === "support"
    ? role
    : "nonmember";
}

function roleCapabilities(role: DwmOrgAlertCaseRole): DwmOrgAlertCaseCapability[] {
  if (role === "owner" || role === "admin") return ["create_watchlist", "edit_watchlist_terms", "acknowledge_alert", "assign_case", "manage_invites"];
  if (role === "analyst") return ["acknowledge_alert", "assign_case"];
  return [];
}

export type RuntimeDwmWatchlist = {
  id: string;
  tenantId: string;
  organizationId?: string;
  terms: DwmWatchTerm[];
  webhookDestinationId?: string;
  webhookUrl?: string;
  status: "active" | "paused";
  lifecycleStatus?: "active" | "paused" | "archived";
  orgWatchlistTerms?: RuntimeOrgWatchlistTermContext[];
  orgMembershipContext?: RuntimeOrgMembershipContext;
};

export type DwmAlertGenerationCaptureRef = {
  captureId: string;
  sourceId?: string;
  sourceFamily: string;
  contentHash?: string;
  observedAt?: string;
};

export type DwmAlertGenerationSuppressedCaptureRef = DwmAlertGenerationCaptureRef & {
  duplicateOfCaptureId: string;
  duplicateReason: "duplicate_content_hash";
  duplicateIdentity: string;
};

export type DwmAlertGenerationCandidate = {
  id: string;
  tenantId: string;
  organizationId?: string;
  term: DwmWatchTerm;
  normalizedTerm: string;
  watchlistIds: string[];
  watchlistItemIds: string[];
  webhookDestinationIds: string[];
  hasWebhookRoute: boolean;
  visibilityPolicy: DwmAlertVisibilityPolicy;
  membershipContext?: RuntimeOrgMembershipContext;
  sourceFamilies: string[];
  captureRefs: DwmAlertGenerationCaptureRef[];
  suppressedDuplicateCaptureRefs: DwmAlertGenerationSuppressedCaptureRef[];
  duplicateCaptureCollapseCount: number;
  evidenceWindow: {
    captureIds: string[];
    sourceFamilies: string[];
    contentHashes: string[];
    firstObservedAt?: string;
    lastObservedAt?: string;
  };
  watchlistTermContexts: RuntimeOrgWatchlistTermContext[];
  alertGeneratorKeys: string[];
  alertGenerationRefs: RuntimeOrgWatchlistTermContext["alertGenerationRef"][];
  dedupeSeed: string;
  dedupeKeyCandidate: string;
};

export type DwmDuplicateEvidenceSuppressionSummary = {
  schemaVersion: "dwm.duplicate_evidence_suppression.v1";
  suppressedCount: number;
  suppressedCaptureIds: string[];
  duplicateOfCaptureIds: string[];
  duplicateIdentities: string[];
  reasons: Array<DwmAlertGenerationSuppressedCaptureRef["duplicateReason"]>;
};

export type DwmAlertGenerationPlan = {
  schemaVersion: "dwm.alert_generation_plan.v1";
  tenantId: string;
  organizationId?: string;
  visibilityPolicy: DwmAlertVisibilityPolicy;
  activeWatchlistIds: string[];
  candidateCount: number;
  candidates: DwmAlertGenerationCandidate[];
  blockedWatchlists: Array<{ watchlistId: string; reason: "missing_org_context"; organizationId?: string }>;
  skippedWatchlists: Array<{ watchlistId: string; reason: "paused" | "archived" | "tenant_mismatch" | "organization_mismatch" | "empty_terms"; organizationId?: string }>;
};

export type DwmAlertGenerationReadiness = {
  schemaVersion: "dwm.alert_generation_readiness.v1";
  tenantId: string;
  organizationId?: string;
  visibilityPolicy: DwmAlertVisibilityPolicy;
  readyForRebuild: boolean;
  readyForCustomerDelivery: boolean;
  counts: {
    activeWatchlists: number;
    skippedWatchlists: number;
    blockedWatchlists: number;
    candidateCount: number;
    rawActiveTermCount: number;
    duplicateCollapseCount: number;
    duplicateCaptureCollapseCount: number;
    captureRefCount: number;
    matchedCandidateCount: number;
    unmatchedCandidateCount: number;
  };
  sourceFamilyCoverage: Array<{ sourceFamily: string; candidateCount: number; captureRefCount: number; watchlistIds: string[] }>;
  sourceFamilyGaps: Array<{
    schemaVersion: "dwm.alert_source_family_gap.v1";
    sourceFamily: string;
    state: "matched" | "active_no_match" | "stale_source" | "inactive_or_unconfigured";
    active: boolean;
    candidateCount: number;
    captureRefCount: number;
    watchlistIds: string[];
    blockerCode?: "no_matching_captures" | "source_family_inactive" | "source_family_stale";
    detail: string;
  }>;
  webhookReadiness: {
    ready: boolean;
    routedCandidateCount: number;
    missingRouteCandidateCount: number;
    webhookDestinationIds: string[];
    candidateIdsMissingRoute: string[];
  };
  caseReadiness: {
    ready: boolean;
    candidateCount: number;
    casePathTemplate: "/v1/cases/:caseId?alertId=:alertId&dedupeKey=:dedupeKey";
  };
  productDedupeBlocker: {
    blocked: boolean;
    reason: string;
    requiredPatch: string;
    requiredFields: string[];
  };
  blockerCodes: DwmAlertGenerationBlockerCode[];
  typedBlockers: DwmAlertGenerationBlocker[];
  blockers: string[];
  zeroAlertProof: DwmZeroAlertProof;
  plan: DwmAlertGenerationPlan;
};

export type DwmOrgAlertPipelineProof = {
  schemaVersion: "dwm.org_alert_pipeline_proof.v1";
  tenantId: string;
  organizationId?: string;
  generatedAt: string;
  state:
    | "blocked_before_rebuild"
    | "ready_to_generate_alerts"
    | "generated_partial"
    | "generated_needs_case_or_delivery"
    | "ready_for_operator_workflow";
  routes: {
    readiness: "/v1/dwm/alerts/generation-readiness";
    rebuild: "/v1/dwm/alerts/rebuild";
    alerts: "/v1/dwm/alerts";
    cases: "/v1/cases";
    webhookDelivery: "/v1/dwm/webhooks/deliver";
  };
  readiness: {
    schemaVersion: "dwm.alert_generation_readiness.v1";
    readyForRebuild: boolean;
    readyForCustomerDelivery: boolean;
    blockerCodes: DwmAlertGenerationBlockerCode[];
    counts: DwmAlertGenerationReadiness["counts"];
    sourceFamilyCoverage: DwmAlertGenerationReadiness["sourceFamilyCoverage"];
    sourceFamilyGaps: DwmAlertGenerationReadiness["sourceFamilyGaps"];
    zeroAlertProof: DwmZeroAlertProof;
  };
  consumerAdapters: {
    schemaVersion: "dwm.org_alert_pipeline_consumer_adapters.v1";
    dashboard: {
      canConsume: boolean;
      route: "/v1/dwm/alerts";
      stableFields: string[];
      gapFields: string[];
    };
    webhook: {
      canConsume: boolean;
      route: "/v1/dwm/webhooks/deliver";
      stableFields: string[];
      gapFields: string[];
    };
    publicTI: {
      canConsume: boolean;
      redacted: true;
      stableFields: string[];
      gapFields: string[];
    };
    analystPortal: {
      canConsume: boolean;
      route: "/v1/dwm/alerts";
      stableFields: string[];
      workflowFields: string[];
      gapFields: string[];
    };
  };
  consumerReceiptMatrix: {
    schemaVersion: "dwm.org_alert_consumer_receipt_matrix.v1";
    checkedAt: string;
    ok: boolean;
    rowCount: number;
    rows: Array<{
      id: string;
      ownerLane: "alert_generation" | "case_workflow" | "webhook_delivery" | "public_ti";
      customerVisibleState: DwmOrgAlertPipelineProof["state"];
      readinessRoute: string;
      contractIds: string[];
      schemaIds: string[];
      receiptSchemaIds: string[];
      blockerCodes: string[];
      scopeFields: string[];
      downstreamOwners: Array<"dashboard" | "webhook" | "case" | "public_ti" | "analyst_portal">;
      missingContract: boolean;
      safeOutput: {
        metadataOnly: true;
        rawEvidenceExposed: false;
        webhookSecretExposed: false;
        crossOrgDataExposed: false;
      };
    }>;
  };
  candidates: Array<{
    candidateId: string;
    normalizedTerm: string;
    watchlistIds: string[];
    watchlistItemIds: string[];
    alertGeneratorKeys: string[];
    sourceFamilies: string[];
    captureRefCount: number;
    suppressedDuplicateCaptureCount: number;
    suppressedDuplicateCaptureIds: string[];
    webhookDestinationIds: string[];
    matchedAlertIds: string[];
    caseReady: boolean;
    deliveryReady: boolean;
    delivered: boolean;
    blockerCodes: string[];
  }>;
  alerts: Array<{
    alertId: string;
    dedupeKey?: string;
    sourceFamily?: string;
    watchlistIds: string[];
    watchlistItemIds: string[];
    selectedCaptureIds: string[];
    evidenceCount: number;
    provenanceCaptureIds: string[];
    provenanceSourceIds: string[];
    provenanceGapCodes: string[];
    workflowStatus: string;
    assignedOwner?: string;
    workflowEventCount: number;
    workflowTransitionActions: Array<DwmAlertCustomerProofHandoffRow["workflow"]["transitionEvents"][number]["action"]>;
    lastWorkflowEventAt?: string;
    caseReady: boolean;
    caseIdCandidate?: string;
    caseId?: string;
    casePath?: string;
    caseHandoffIdempotencyKey?: string;
    deliveryReady: boolean;
    delivered: boolean;
    downstreamBlockerCodes: Array<DwmAlertDownstreamHandoffBlockerCode | DwmDeliveryReadinessBlockerCode>;
    deliveryHistoryRefs: string[];
    sourceHandoffReadiness: {
      schemaVersion: "dwm.alert_source_handoff_readiness.v1";
      ready: boolean;
      state:
        | "ready_for_consumers"
        | "source_provenance_gap"
        | "source_freshness_gap"
        | "case_handoff_gap"
        | "delivery_handoff_gap";
      sourceFamily?: string;
      selectedCaptureIds: string[];
      evidenceCount: number;
      matchReason?: DwmAlertMatchReason;
      sourceCoverage: {
        schemaVersion: "dwm.alert_source_coverage.v1";
        sourceFamily?: string;
        captureCount: number;
        provenanceCaptureCount: number;
        provenanceSourceCount: number;
        freshnessState: "fresh" | "current" | "stale" | "unknown";
        blockerCodes: string[];
      };
      blockerReasons: Array<{
        code: string;
        field: string;
        detail: string;
        recoverable: boolean;
        ownerLane: "alert_generation" | "source_operations" | "case_workflow" | "webhook_delivery" | "org_foundation" | "entitlement";
      }>;
      duplicateEvidenceSuppression?: DwmDuplicateEvidenceSuppressionSummary;
      provenanceCaptureIds: string[];
      provenanceSourceIds: string[];
      provenanceGapCodes: string[];
      evidenceFreshness: {
        schemaVersion: "dwm.alert_evidence_freshness.v1";
        state: "fresh" | "current" | "stale" | "unknown";
        generatedAt: string;
        firstObservedAt?: string;
        lastObservedAt?: string;
        latestEvidenceAgeHours?: number;
        maxFreshAgeHours: number;
        maxCurrentAgeHours: number;
        captureIds: string[];
        sourceFamilies: string[];
        blockerCodes: string[];
      };
      webhookConsumer: {
        ready: boolean;
        deliveryReady: boolean;
        delivered: boolean;
        deliveryDedupeKey?: string;
        selectedWebhookDestinationId?: string;
        webhookDestinationIds: string[];
        createdEventDispatchReady: boolean;
        createdEventId?: string;
        createdEventDispatchIdempotencyKey?: string;
        deliveryHistoryRefs: string[];
        blockerCodes: string[];
      };
      caseConsumer: {
        ready: boolean;
        caseIdCandidate?: string;
        caseId?: string;
        casePath?: string;
        idempotencyKey?: string;
        blockerCodes: string[];
      };
      publicTiConsumer: {
        ready: boolean;
        redacted: true;
        alertGenerationRefCount: number;
        sourceFamily?: string;
        stableFields: string[];
        gapFields: string[];
      };
      analystWorkflowConsumer: {
        ready: boolean;
        workflowStatus: string;
        assignedOwner?: string;
        decisionValue?: string;
        decisionRationale?: string;
        falsePositiveReason?: string;
        suppressionReason?: string;
        decidedAt?: string;
        decidedBy?: string;
        workflowEventCount: number;
        transitionActions: Array<DwmAlertCustomerProofHandoffRow["workflow"]["transitionEvents"][number]["action"]>;
        lastWorkflowEventAt?: string;
        caseLinked: boolean;
        suppressed: boolean;
        closed: boolean;
        actionReadiness: {
          schemaVersion: "dwm.alert_analyst_action_readiness.v1";
          expectedWorkflowEventCount: number;
          readyActions: DwmAlertWorkflowExecutionReadiness["action"][];
          blockedActions: DwmAlertWorkflowExecutionReadiness["action"][];
          actions: Array<{
            action: DwmAlertWorkflowExecutionReadiness["action"];
            ready: boolean;
            idempotencyKey?: string;
            workflowEventCount: number;
            casePath?: string;
            deliveryDedupeKey?: string;
            blockerCodes: DwmAlertWorkflowExecutionBlockerCode[];
          }>;
        };
        blockerCodes: string[];
      };
      stableFields: string[];
      gapFields: string[];
    };
    alertGenerationRefs: Array<Record<string, any>>;
    updateReceipt?: {
      schemaVersion: "dwm.alert_update_receipt.v1";
      ready: boolean;
      eventId?: string;
      addedCaptureIds: string[];
      selectedCaptureIds: string[];
      workflowEventCount: number;
      caseId?: string;
      casePath?: string;
      deliveryDedupeKey?: string;
      alertGenerationRefs: Array<Record<string, any>>;
      blockerCodes: Array<DwmAlertDownstreamHandoffBlockerCode | DwmDeliveryReadinessBlockerCode>;
    };
    replayReceipt: {
      schemaVersion: "dwm.alert_replay_receipt.v1";
      ready: boolean;
      replayCount: number;
      workflowEventCount: number;
      caseId?: string;
      casePath?: string;
      deliveryDedupeKey?: string;
      selectedCaptureIds: string[];
      alertGenerationRefs: Array<Record<string, any>>;
      blockerCodes: Array<DwmAlertDownstreamHandoffBlockerCode | DwmDeliveryReadinessBlockerCode>;
    };
  }>;
  gaps: Array<{
    code:
      | "readiness_blocked"
      | "alert_not_generated"
      | "case_handoff_missing"
      | "webhook_delivery_missing"
      | "downstream_blocked";
    ownerLane: "alert_generation" | "case_workflow" | "webhook_delivery" | "source_operations" | "entitlement" | "org_foundation";
    route: string;
    candidateId?: string;
    alertId?: string;
    blockerCodes: string[];
    detail: string;
  }>;
  proofCommands: string[];
};

export type DwmSourceProjectionAlertReadinessProof = {
  schemaVersion: "dwm.source_projection_alert_readiness.v1";
  id: string;
  tenantId: string;
  organizationId?: string;
  actor: string;
  generatedAt: string;
  state:
    | "ready_for_customer_delivery"
    | "ready_for_alert_rebuild"
    | "blocked"
    | "zero_alert_no_match";
  ownerLane: "source_operations" | "alert_generation" | "webhook_delivery" | "org_foundation" | "case_workflow" | "entitlement";
  sourceProjection: {
    schemaVersion: TiSourceProvenancePublicTiSourceOpsProjection["schemaVersion"];
    id: string;
    generatedAt: string;
    publicTiRoute: string;
    pageReadiness: TiSourceProvenancePublicTiSourceOpsProjection["pageReadiness"];
    sourceCoverage: TiSourceProvenancePublicTiSourceOpsProjection["sourceCoverage"];
    provenanceRowCount: number;
    enrichmentGapCount: number;
  };
  alertPipeline: {
    schemaVersion: DwmOrgAlertPipelineProof["schemaVersion"];
    generatedAt: string;
    state: DwmOrgAlertPipelineProof["state"];
    readyForRebuild: boolean;
    readyForCustomerDelivery: boolean;
    candidateCount: number;
    alertCount: number;
    blockerCodes: string[];
    zeroAlertState: DwmZeroAlertProof["state"];
  };
  blockers: Array<{
    code:
      | "missing_org_scope"
      | "org_mismatch"
      | "missing_provenance"
      | "source_projection_blocked"
      | "source_projection_partial"
      | "stale_source"
      | "duplicate_candidate"
      | "unsupported_source_family"
      | "alert_readiness_blocked"
      | "zero_alert_no_match"
      | "webhook_delivery_unready";
    ownerLane: "source_operations" | "alert_generation" | "webhook_delivery" | "org_foundation" | "case_workflow" | "entitlement";
    route: string;
    detail: string;
    recoverable: boolean;
    sourceFamily?: string;
    blockerCodes?: string[];
  }>;
  downstreamRoutes: {
    publicTI: string;
    dashboard: "/v1/dwm/alerts";
    alertReadiness: "/v1/dwm/alerts/generation-readiness";
    alertRebuild: "/v1/dwm/alerts/rebuild";
    webhookDelivery: "/v1/dwm/webhooks/deliver";
  };
  provenanceRefs: {
    sourceOpsFixtureBundleId: string;
    sourceFreshnessGapPacketIds: string[];
    parserHealthAlertPacketIds: string[];
    sourceOpsActionQueueIds: string[];
    alertCandidateIds: string[];
    alertIds: string[];
    deliveryHistoryRefs: string[];
  };
  consumerContracts: {
    schemaVersion: "dwm.source_projection_alert_readiness_consumers.v1";
    publicTI: {
      canConsume: boolean;
      redacted: true;
      stableFields: string[];
      gapFields: string[];
    };
    dashboard: {
      canConsume: boolean;
      route: "/v1/dwm/alerts";
      stableFields: string[];
      gapFields: string[];
    };
    alertGeneration: {
      canConsume: boolean;
      route: "/v1/dwm/alerts/rebuild";
      stableFields: string[];
      gapFields: string[];
    };
    webhook: {
      canConsume: boolean;
      route: "/v1/dwm/webhooks/deliver";
      stableFields: string[];
      gapFields: string[];
    };
  };
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
  proofCommands: string[];
};

export type RuntimeDwmAlertStore = {
  listDwmWatchlists(): RuntimeDwmWatchlist[];
  listDwmAlerts(): any[];
  saveDwmAlert(alert: any): any;
  listSources(): any[];
  listCaptures(): any[];
};

export type DwmPersistedDeliveryReadinessContext = {
  schemaVersion: "dwm.alert_delivery_persistence.v1";
  alertId: string;
  tenantId: string;
  organizationId?: string;
  state: "ready" | "blocked" | "closed" | "suppressed" | "delivered";
  ready: boolean;
  blockerCodes: DwmDeliveryReadinessBlockerCode[];
  blockers: Array<{ code: DwmDeliveryReadinessBlockerCode; field: string; detail: string; recoverable: boolean }>;
  deliveryDedupeKey: string;
  replayMarker: string;
  replayCount: number;
  selectedCaptureIds: string[];
  generationEvidenceWindow?: {
    captureIds: string[];
    sourceFamilies: string[];
    contentHashes: string[];
    firstObservedAt?: string;
    lastObservedAt?: string;
  };
  duplicateEvidenceSuppression?: DwmDuplicateEvidenceSuppressionSummary;
  sourceFamily: string;
  evidenceCount: number;
  recommendedRoute?: string;
  alertCreatedEventId?: string;
  alertCreatedAt?: string;
  alertDetailPath?: string;
  caseIdCandidate?: string;
  caseId?: string;
  casePath?: string;
  watchlistIds: string[];
  watchlistItemIds: string[];
  alertGeneratorKeys: string[];
  webhookDestinationIds: string[];
  deliveryHistoryRefs: string[];
  lastDeliveryStatus?: string;
  lastDeliveryAt?: string;
  entitlement: {
    status?: string;
    blockedReasons: string[];
  };
  generatedAt: string;
};

export type RebuildDwmRuntimeAlertsInput = {
  store: RuntimeDwmAlertStore;
  tenantId: string;
  organizationId?: string;
  visibilityPolicy?: DwmAlertVisibilityPolicy;
};

export type RebuildDwmRuntimeAlertsResult = {
  rebuiltAt: string;
  savedAlertCount: number;
  alerts: any[];
  watchlistIds: string[];
  generationPlan: DwmAlertGenerationPlan;
  generationReadiness: DwmAlertGenerationReadiness;
  zeroAlertProof: DwmZeroAlertProof;
  readiness: ReturnType<typeof buildDwmProductSnapshot>["readiness"];
};

export function rebuildDwmRuntimeAlerts(input: RebuildDwmRuntimeAlertsInput): RebuildDwmRuntimeAlertsResult {
  const { sources, captures } = scopeDwmEvidence(input.store.listSources(), input.store.listCaptures(), input.tenantId, input.organizationId);
  const watchlists = input.store.listDwmWatchlists();
  const generationPlan = buildDwmAlertGenerationPlan({
    watchlists,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    visibilityPolicy: input.visibilityPolicy,
    sources,
    captures
  });
  const terms = generationPlan.candidates.map((candidate) => candidate.term);
  const snapshot = buildDwmProductSnapshot({
    tenantId: input.tenantId,
    watchlist: terms,
    sources,
    captures
  });
  const generationReadiness = buildDwmAlertGenerationReadiness({
    watchlists,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    visibilityPolicy: input.visibilityPolicy,
    sources,
    captures
  });

  const alerts = mergeSnapshotAlertsForGeneration(snapshot.alerts, generationPlan, input)
    .filter((alert) => alertSourceFamilyActive(sources, alert.sourceFamily))
    .map((alert) => {
    const generationCandidate = findGenerationCandidate(generationPlan, alert);
    const scopedAlert = scopeAlertForGenerationCandidate(alert, generationCandidate, input);
    const candidateOrganizationId = generationCandidate?.watchlistTermContexts?.[0]?.organizationId;
    const existing = findExistingAlert(input.store, scopedAlert, input.tenantId, input.organizationId ?? candidateOrganizationId);
    const alertId = existing?.id ?? scopedAlert.id;
    const routedOrganizationId = input.organizationId ?? candidateOrganizationId ?? existing?.organizationId;
    const generatedWorkflowContext = buildDwmAlertWorkflowContext({
      alert: { ...scopedAlert, id: alertId },
      tenantId: input.tenantId,
      organizationId: routedOrganizationId,
      generationCandidate
    });
    const baseWorkflowContext = {
      ...generatedWorkflowContext,
      caseId: existing?.caseId,
      casePath: existing?.casePath ?? generatedWorkflowContext.casePath
    };
    const matchReason = buildDwmAlertMatchReason({
      alert: { ...scopedAlert, id: alertId },
      tenantId: input.tenantId,
      organizationId: routedOrganizationId,
      workflowContext: baseWorkflowContext
    });
    const workflowContext = {
      ...baseWorkflowContext,
      matchReason
    };
    const deliveryReadinessContext = buildDwmPersistedDeliveryReadinessContext({
      alert: { ...scopedAlert, id: alertId },
      tenantId: input.tenantId,
      organizationId: routedOrganizationId,
      workflowContext,
      existing,
      generatedAt: snapshot.generatedAt
    });
    const alertCreatedEvent = existing?.alertCreatedEvent ?? buildDwmAlertCreatedEvent({
      alert: scopedAlert,
      alertId,
      tenantId: input.tenantId,
      organizationId: routedOrganizationId,
      workflowContext,
      generatedAt: snapshot.generatedAt
    });
    const persistedDeliveryReadinessContext = {
      ...deliveryReadinessContext,
      alertCreatedEventId: alertCreatedEvent.id,
      alertCreatedAt: alertCreatedEvent.at
    };
    const alertUpdatedEvent = existing ? buildDwmAlertUpdatedEvent({
      existing,
      alert: scopedAlert,
      alertId,
      tenantId: input.tenantId,
      organizationId: input.organizationId ?? existing?.organizationId,
      workflowContext,
      generatedAt: snapshot.generatedAt
    }) : undefined;
    const alertEvents = mergeAlertEvents(existing?.alertEvents ?? [alertCreatedEvent], alertUpdatedEvent);
    const sourceProvenanceSummary = buildDwmAlertSourceProvenanceSummary({
      alert: { ...scopedAlert, id: alertId },
      tenantId: input.tenantId,
      organizationId: routedOrganizationId,
      workflowContext
    });
    const orgWatchlistScope = buildDwmAlertOrgWatchlistScope(workflowContext);
    return input.store.saveDwmAlert({
      ...scopedAlert,
      id: alertId,
      tenantId: input.tenantId,
      organizationId: routedOrganizationId,
      alertDetailPath: workflowContext.alertDetailPath,
      watchlistIds: workflowContext.watchlistIds,
      watchlistItemIds: workflowContext.watchlistItemIds,
      matchReason,
      workflowContext,
      webhookContext: buildDwmAlertWebhookContext({ ...scopedAlert, id: alertId, matchReason } as DwmAlert & Record<string, any>, workflowContext),
      deliveryReadinessContext: persistedDeliveryReadinessContext,
      sourceProvenanceSummary,
      orgWatchlistScope,
      alertCreatedEvent,
      alertUpdatedEvent: alertUpdatedEvent ?? existing?.alertUpdatedEvent,
      alertEvents,
      caseIdCandidate: workflowContext.caseIdCandidate,
      caseId: existing?.caseId,
      casePath: existing?.casePath ?? workflowContext.casePath,
      workflowStatus: existing?.workflowStatus ?? (alert as any).workflowStatus ?? "new",
      reviewState: existing?.reviewState ?? alert.reviewState,
      deliveryState: existing?.deliveryState ?? "pending_review",
      workflowEvents: existing?.workflowEvents ?? [],
      workflowNote: existing?.workflowNote,
      workflowRationale: existing?.workflowRationale,
      workflowDecision: existing?.workflowDecision,
      decisionRationale: existing?.decisionRationale,
      falsePositiveReason: existing?.falsePositiveReason,
      suppressionReason: existing?.suppressionReason,
      decisionAt: existing?.decisionAt,
      decisionBy: existing?.decisionBy,
      assignedOwner: existing?.assignedOwner,
      severityOverride: existing?.severityOverride,
      suppressedAt: existing?.suppressedAt,
      closedAt: existing?.closedAt,
      reopenedAt: existing?.reopenedAt,
      replayCount: existing?.replayCount ?? 0,
      lastReplayedAt: existing?.lastReplayedAt,
      deliveredAt: existing?.deliveredAt,
      savedAt: existing?.savedAt ?? snapshot.generatedAt,
      updatedAt: snapshot.generatedAt
    });
    });

  return {
    rebuiltAt: snapshot.generatedAt,
    savedAlertCount: alerts.length,
    alerts,
    watchlistIds: generationPlan.activeWatchlistIds,
    generationPlan,
    generationReadiness,
    zeroAlertProof: generationReadiness.zeroAlertProof,
    readiness: snapshot.readiness
  };
}

export function buildDwmPersistedDeliveryReadinessContext(input: {
  alert: Pick<DwmAlert, "id" | "sourceFamily" | "recommendedRoute" | "webhookDelivery" | "evidence" | "dedupeKey"> & Record<string, any>;
  tenantId: string;
  organizationId?: string;
  workflowContext: ReturnType<typeof buildDwmAlertWorkflowContext> & Record<string, any>;
  existing?: Record<string, any>;
  deliveries?: Array<Record<string, any>>;
  generatedAt?: string;
}): DwmPersistedDeliveryReadinessContext {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const deliveries = input.deliveries ?? [];
  const previousContext = input.existing?.deliveryReadinessContext ?? {};
  const selectedCaptureIds = uniqueStrings((input.workflowContext.captureIds ?? input.alert.provenance?.captureIds ?? []).map(String).filter(Boolean));
  const evidenceCount = Number(input.workflowContext.evidenceCount ?? input.alert.evidence?.length ?? 0);
  const webhookDestinationIds = uniqueStrings((input.workflowContext.webhookDestinationIds ?? []).map(String).filter(Boolean));
  const alertGeneratorKeys = uniqueStrings((input.workflowContext.alertGeneratorKeys ?? []).map(String).filter(Boolean));
  const routingScopeReady = Boolean(input.organizationId || input.workflowContext.organizationId || input.workflowContext.watchlistIds?.length || input.workflowContext.watchlistTermContexts?.length || alertGeneratorKeys.length);
  const deliveryDedupeKey = String(input.alert.webhookDelivery?.dedupeKey ?? input.alert.dedupeKey ?? input.workflowContext.dedupeKey ?? input.alert.id);
  const deliveryHistoryRefs = uniqueStrings([
    ...(previousContext.deliveryHistoryRefs ?? []),
    ...deliveries.map((delivery) => delivery.id).filter(Boolean)
  ].map(String));
  const lastDelivery = [...deliveries]
    .sort((a, b) => String(a.attemptedAt ?? "").localeCompare(String(b.attemptedAt ?? "")))
    .at(-1);
  const delivered = Boolean(input.existing?.deliveredAt) || input.existing?.deliveryState === "delivered" || deliveries.some((delivery) => delivery.status === "delivered");
  const suppressed = input.existing?.workflowStatus === "suppressed" || input.existing?.deliveryState === "muted";
  const closed = input.existing?.workflowStatus === "closed";
  const blockerInputs: Array<DwmPersistedDeliveryReadinessContext["blockers"][number] | undefined> = [
    !routingScopeReady || alertGeneratorKeys.length === 0 ? readinessBlocker("missing_org_ref", "workflowContext.alertGeneratorKeys", "Org alert generation reference is required before delivery.", true) : undefined,
    !selectedCaptureIds.length || evidenceCount === 0 ? readinessBlocker("missing_capture_evidence", "workflowContext.captureIds", "Delivery requires selected capture ids and evidence.", true) : undefined,
    !input.workflowContext.casePath || !input.workflowContext.caseIdCandidate ? readinessBlocker("case_route_unavailable", "workflowContext.casePath", "Case route/id candidate must be available for analyst handoff.", true) : undefined,
    !input.workflowContext.hasWebhookRoute && webhookDestinationIds.length === 0 ? readinessBlocker("delivery_disabled", "workflowContext.webhookDestinationIds", "No webhook destination or route is configured.", true) : undefined,
    delivered ? readinessBlocker("replay_already_delivered", "deliveryState", "Alert has already been delivered; replay must preserve delivery history.", false) : undefined,
    delivered ? readinessBlocker("duplicate_delivered_dedupe", "deliveryDedupeKey", "This dedupe key already has delivered history; replay must not create duplicate customer delivery.", false) : undefined,
    input.workflowContext.membershipContext?.canGenerateAlerts === false ? readinessBlocker("entitlement_denied", "workflowContext.membershipContext", "Org entitlement currently blocks alert generation.", true) : undefined
  ];
  const blockers = blockerInputs.filter(Boolean) as DwmPersistedDeliveryReadinessContext["blockers"];
  const nonTerminalBlockers = blockers.filter((blocker) => blocker.code !== "replay_already_delivered");
  const ready = !delivered && !closed && !suppressed && nonTerminalBlockers.length === 0;
  return {
    schemaVersion: "dwm.alert_delivery_persistence.v1",
    alertId: input.alert.id,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    state: delivered ? "delivered" : closed ? "closed" : suppressed ? "suppressed" : ready ? "ready" : "blocked",
    ready,
    blockerCodes: blockers.map((blocker) => blocker.code),
    blockers,
    deliveryDedupeKey,
    replayMarker: stableId("dwm_replay_marker", `${input.tenantId}:${input.alert.id}:${deliveryDedupeKey}`),
    replayCount: Number(input.existing?.replayCount ?? 0),
    selectedCaptureIds,
    generationEvidenceWindow: normalizeGenerationEvidenceWindow(input.workflowContext.generationEvidenceWindow ?? previousContext.generationEvidenceWindow),
    duplicateEvidenceSuppression: input.workflowContext.duplicateEvidenceSuppression ?? previousContext.duplicateEvidenceSuppression,
    sourceFamily: String(input.alert.sourceFamily ?? input.workflowContext.sourceFamily ?? "unknown"),
    evidenceCount,
    recommendedRoute: input.alert.recommendedRoute ?? input.alert.webhookDelivery?.recommendedRoute ?? input.workflowContext.recommendedRoute,
    alertCreatedEventId: input.existing?.alertCreatedEvent?.id ?? previousContext.alertCreatedEventId,
    alertCreatedAt: input.existing?.alertCreatedEvent?.at ?? previousContext.alertCreatedAt,
    alertDetailPath: input.workflowContext.alertDetailPath,
    caseIdCandidate: input.workflowContext.caseIdCandidate,
    caseId: input.existing?.caseId ?? input.workflowContext.caseId,
    casePath: input.existing?.casePath ?? input.workflowContext.casePath,
    watchlistIds: input.workflowContext.watchlistIds ?? [],
    watchlistItemIds: input.workflowContext.watchlistItemIds ?? [],
    alertGeneratorKeys,
    webhookDestinationIds,
    deliveryHistoryRefs,
    lastDeliveryStatus: lastDelivery?.status ?? previousContext.lastDeliveryStatus,
    lastDeliveryAt: lastDelivery?.attemptedAt ?? previousContext.lastDeliveryAt,
    entitlement: {
      status: input.workflowContext.membershipContext?.entitlementStatus,
      blockedReasons: input.workflowContext.membershipContext?.blockedReasons ?? []
    },
    generatedAt
  };
}

function readinessBlocker(code: DwmDeliveryReadinessBlockerCode, field: string, detail: string, recoverable: boolean): DwmPersistedDeliveryReadinessContext["blockers"][number] {
  return { code, field, detail, recoverable };
}

export function buildDwmAlertGenerationPlan(input: {
  watchlists: RuntimeDwmWatchlist[];
  tenantId: string;
  organizationId?: string;
  visibilityPolicy?: DwmAlertVisibilityPolicy;
  sources?: SourceRecord[];
  captures?: RawCapture[];
}): DwmAlertGenerationPlan {
  const visibilityPolicy = normalizeVisibilityPolicy(input.visibilityPolicy);
  const { sources, captures } = scopeDwmEvidence(input.sources ?? [], input.captures ?? [], input.tenantId, input.organizationId);
  const candidates = new Map<string, DwmAlertGenerationCandidate>();
  const blockedWatchlists: DwmAlertGenerationPlan["blockedWatchlists"] = [];
  const skippedWatchlists: DwmAlertGenerationPlan["skippedWatchlists"] = [];
  const activeWatchlistIds: string[] = [];

  for (const watchlist of input.watchlists) {
    if (watchlist.tenantId !== input.tenantId) {
      skippedWatchlists.push({ watchlistId: watchlist.id, reason: "tenant_mismatch" });
      continue;
    }
    if (watchlist.status !== "active") {
      skippedWatchlists.push({ watchlistId: watchlist.id, reason: watchlist.lifecycleStatus === "archived" ? "archived" : "paused" });
      continue;
    }
    if (watchlist.organizationId && !input.organizationId) {
      blockedWatchlists.push({ watchlistId: watchlist.id, reason: "missing_org_context", organizationId: watchlist.organizationId });
      continue;
    }
    if (watchlist.organizationId && input.organizationId && watchlist.organizationId !== input.organizationId) {
      skippedWatchlists.push({ watchlistId: watchlist.id, reason: "organization_mismatch", organizationId: watchlist.organizationId });
      continue;
    }
    if (!watchlist.terms.length) {
      skippedWatchlists.push({ watchlistId: watchlist.id, reason: "empty_terms" });
      continue;
    }

    activeWatchlistIds.push(watchlist.id);
    for (const term of watchlist.terms) {
      const normalizedTerm = normalizeTerm(term.value);
      if (!normalizedTerm) continue;
      const key = `${input.tenantId}:${input.organizationId ?? ""}:${term.kind}:${normalizedTerm}`;
      const existing = candidates.get(key);
      const captureEvidence = captureRefsForTermWithSuppression({ term, sources, captures });
      const captureRefs = captureEvidence.captureRefs;
      const sourceFamilies = uniqueStrings(captureRefs.map((ref) => ref.sourceFamily));
      const watchlistTermContexts = watchlistTermContextsFor(watchlist, term.value);
      if (existing) {
        existing.watchlistIds = uniqueStrings([...existing.watchlistIds, watchlist.id]);
        existing.watchlistItemIds = uniqueStrings([...existing.watchlistItemIds, ...watchlistItemIdsFor(watchlist, term.value)]);
        existing.webhookDestinationIds = uniqueStrings([...existing.webhookDestinationIds, watchlist.webhookDestinationId].filter(Boolean) as string[]);
        existing.hasWebhookRoute = existing.hasWebhookRoute || Boolean(watchlist.webhookDestinationId || watchlist.webhookUrl);
        existing.captureRefs = mergeCaptureRefs(existing.captureRefs, captureRefs);
        existing.suppressedDuplicateCaptureRefs = mergeSuppressedDuplicateCaptureRefs(existing.suppressedDuplicateCaptureRefs, captureEvidence.suppressedDuplicateCaptureRefs);
        existing.duplicateCaptureCollapseCount = existing.suppressedDuplicateCaptureRefs.length;
        existing.sourceFamilies = uniqueStrings([...existing.sourceFamilies, ...sourceFamilies]);
        existing.evidenceWindow = evidenceWindowForCaptureRefs(existing.captureRefs);
        existing.watchlistTermContexts = mergeWatchlistTermContexts(existing.watchlistTermContexts, watchlistTermContexts);
        existing.alertGeneratorKeys = uniqueStrings([...existing.alertGeneratorKeys, ...watchlistTermContexts.map((term) => term.alertGeneratorKey)]);
        existing.alertGenerationRefs = mergeAlertGenerationRefs(existing.alertGenerationRefs, watchlistTermContexts.map((term) => term.alertGenerationRef));
        existing.membershipContext = existing.membershipContext ?? watchlist.orgMembershipContext;
        continue;
      }

      const dedupeSeed = watchlistTermContexts[0]?.alertGeneratorKey ?? `${normalizedTerm}:${term.kind}`;
      candidates.set(key, {
        id: stableId("dwm_alert_generation_candidate", `${input.tenantId}:${input.organizationId ?? ""}:${dedupeSeed}`),
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        term,
        normalizedTerm,
        watchlistIds: [watchlist.id],
        watchlistItemIds: watchlistItemIdsFor(watchlist, term.value),
        webhookDestinationIds: [watchlist.webhookDestinationId].filter(Boolean) as string[],
        hasWebhookRoute: Boolean(watchlist.webhookDestinationId || watchlist.webhookUrl),
        visibilityPolicy,
        membershipContext: watchlist.orgMembershipContext,
        sourceFamilies,
        captureRefs,
        suppressedDuplicateCaptureRefs: captureEvidence.suppressedDuplicateCaptureRefs,
        duplicateCaptureCollapseCount: captureEvidence.suppressedDuplicateCaptureRefs.length,
        evidenceWindow: evidenceWindowForCaptureRefs(captureRefs),
        watchlistTermContexts,
        alertGeneratorKeys: uniqueStrings(watchlistTermContexts.map((term) => term.alertGeneratorKey)),
        alertGenerationRefs: mergeAlertGenerationRefs([], watchlistTermContexts.map((term) => term.alertGenerationRef)),
        dedupeSeed,
        dedupeKeyCandidate: stableId("dwm_dedupe_candidate", `${input.tenantId}:${input.organizationId ?? ""}:${dedupeSeed}`)
      });
    }
  }

  return {
    schemaVersion: "dwm.alert_generation_plan.v1",
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    visibilityPolicy,
    activeWatchlistIds: uniqueStrings(activeWatchlistIds),
    candidateCount: candidates.size,
    candidates: [...candidates.values()],
    blockedWatchlists,
    skippedWatchlists
  };
}

function scopeDwmEvidence(sources: SourceRecord[], captures: RawCapture[], tenantId: string, organizationId?: string) {
  const visible = (record: any) => {
    const recordTenantId = String(record?.tenantId ?? "").trim();
    const recordOrganizationId = String(record?.organizationId ?? record?.metadata?.organizationId ?? "").trim();
    return (!recordTenantId || recordTenantId === tenantId) && (!recordOrganizationId || recordOrganizationId === organizationId);
  };
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  return {
    sources: sources.filter(visible),
    captures: captures.filter((capture) => visible(capture) && (!sourceById.has(capture.sourceId) || visible(sourceById.get(capture.sourceId))))
  };
}

export function buildDwmAlertGenerationReadiness(input: {
  watchlists: RuntimeDwmWatchlist[];
  tenantId: string;
  organizationId?: string;
  visibilityPolicy?: DwmAlertVisibilityPolicy;
  sources?: SourceRecord[];
  captures?: RawCapture[];
  productDedupePatched?: boolean;
}): DwmAlertGenerationReadiness {
  const scopedEvidence = scopeDwmEvidence(input.sources ?? [], input.captures ?? [], input.tenantId, input.organizationId);
  const plan = buildDwmAlertGenerationPlan({ ...input, ...scopedEvidence });
  const rawActiveTermCount = input.watchlists
    .filter((watchlist) => watchlist.tenantId === input.tenantId && watchlist.status === "active" && (!watchlist.organizationId || watchlist.organizationId === input.organizationId))
    .reduce((count, watchlist) => count + watchlist.terms.length, 0);
  const captureRefCount = plan.candidates.reduce((count, candidate) => count + candidate.captureRefs.length, 0);
  const duplicateCaptureCollapseCount = plan.candidates.reduce((count, candidate) => count + candidate.duplicateCaptureCollapseCount, 0);
  const sourceFamilyCoverage = buildSourceFamilyCoverage(plan.candidates);
  const sourceFamilyGaps = buildSourceFamilyGaps({
    coverage: sourceFamilyCoverage,
    candidates: plan.candidates,
    sources: scopedEvidence.sources
  });
  const candidateIdsMissingRoute = plan.candidates.filter((candidate) => !candidate.hasWebhookRoute).map((candidate) => candidate.id);
  const productDedupePatched = input.productDedupePatched !== false;
  const typedBlockers = buildGenerationReadinessBlockers({
    watchlists: input.watchlists,
    organizationId: input.organizationId,
    plan,
    sources: scopedEvidence.sources,
    captureRefCount,
    candidateIdsMissingRoute,
    productDedupePatched
  });
  const blockers = typedBlockers.map((blocker) => blocker.detail);
  const counts = {
    activeWatchlists: plan.activeWatchlistIds.length,
    skippedWatchlists: plan.skippedWatchlists.length,
    blockedWatchlists: plan.blockedWatchlists.length,
    candidateCount: plan.candidateCount,
    rawActiveTermCount,
    duplicateCollapseCount: Math.max(0, rawActiveTermCount - plan.candidateCount),
    duplicateCaptureCollapseCount,
    captureRefCount,
    matchedCandidateCount: plan.candidates.filter((candidate) => candidate.captureRefs.length > 0).length,
    unmatchedCandidateCount: plan.candidates.filter((candidate) => candidate.captureRefs.length === 0).length
  };
  const blockerCodes = uniqueStrings(typedBlockers.map((blocker) => blocker.code)) as DwmAlertGenerationBlockerCode[];

  return {
    schemaVersion: "dwm.alert_generation_readiness.v1",
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    visibilityPolicy: plan.visibilityPolicy,
    readyForRebuild: plan.candidateCount > 0 && plan.blockedWatchlists.length === 0,
    readyForCustomerDelivery: plan.candidateCount > 0 && plan.blockedWatchlists.length === 0 && captureRefCount > 0 && candidateIdsMissingRoute.length === 0 && productDedupePatched,
    counts,
    sourceFamilyCoverage,
    sourceFamilyGaps,
    webhookReadiness: {
      ready: plan.candidateCount > 0 && candidateIdsMissingRoute.length === 0,
      routedCandidateCount: plan.candidates.filter((candidate) => candidate.hasWebhookRoute).length,
      missingRouteCandidateCount: candidateIdsMissingRoute.length,
      webhookDestinationIds: uniqueStrings([
        ...plan.candidates.flatMap((candidate) => candidate.webhookDestinationIds),
        ...input.watchlists
          .filter((watchlist) => watchlist.tenantId === input.tenantId && watchlist.status === "active" && (!watchlist.organizationId || watchlist.organizationId === input.organizationId))
          .map((watchlist) => watchlist.webhookDestinationId)
          .filter(Boolean)
      ] as string[]),
      candidateIdsMissingRoute
    },
    caseReadiness: {
      ready: plan.candidateCount > 0 && plan.blockedWatchlists.length === 0,
      candidateCount: plan.candidateCount,
      casePathTemplate: "/v1/cases/:caseId?alertId=:alertId&dedupeKey=:dedupeKey"
    },
    productDedupeBlocker: {
      blocked: !productDedupePatched,
      reason: productDedupePatched
        ? "Product dedupe/enrichment contract is available for persisted org alerts."
        : "Repository readiness can safely plan org alert inputs, but dirty dwmProduct.ts still owns final alert dedupe/enrichment behavior.",
      requiredPatch: "Remove actor from product alert dedupe seed, dedupe merged alerts by alert.dedupeKey, and refresh evidenceSummary/webhook payload hash after merges.",
      requiredFields: ["matchContext", "evidenceSummary", "routingContext", "confidenceReasoning", "provenance", "dedupeKey", "recommendedRoute", "webhookDelivery"]
    },
    blockerCodes,
    typedBlockers,
    blockers,
    zeroAlertProof: buildDwmZeroAlertProof({
      counts,
      blockerCodes,
      typedBlockers,
      sourceFamilyCoverage,
      sourceFamilyGaps,
      watchlistIds: plan.activeWatchlistIds,
      candidates: plan.candidates,
      candidateIdsMissingRoute
    }),
    plan
  };
}

export function buildDwmOrgAlertPipelineProof(input: {
  watchlists: RuntimeDwmWatchlist[];
  alerts?: any[];
  deliveries?: Array<Record<string, any>>;
  tenantId: string;
  organizationId?: string;
  visibilityPolicy?: DwmAlertVisibilityPolicy;
  sources?: SourceRecord[];
  captures?: RawCapture[];
  productDedupePatched?: boolean;
  generatedAt?: string;
}): DwmOrgAlertPipelineProof {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const readiness = buildDwmAlertGenerationReadiness(input);
  const scopedAlerts = (input.alerts ?? []).filter((alert) => alertMatchesPipelineScope(alert, input.tenantId, input.organizationId));
  const handoffs = scopedAlerts.map((alert) => ({
    alert,
    handoff: buildDwmAlertDownstreamHandoff({
      alert,
      deliveries: (input.deliveries ?? []).filter((delivery) => delivery.alertId === alert.id),
      organizationId: input.organizationId,
      generatedAt
    })
  }));
  const candidates = readiness.plan.candidates.map((candidate) => {
    const matches = handoffs.filter(({ alert, handoff }) => alertMatchesGenerationCandidate(alert, handoff, candidate));
    const matchedAlertIds = uniqueStrings(matches.map(({ alert }) => String(alert.id)).filter(Boolean));
    const caseReady = matches.some(({ handoff }) => handoff.caseReadiness.ready);
    const deliveryReady = matches.some(({ handoff }) => handoff.deliveryReadiness.ready || handoff.deliveryReadiness.deliveryHistoryRefs.length > 0);
    const delivered = matches.some(({ handoff }) => handoff.deliveryReadiness.lastDeliveryStatus === "delivered" || handoff.deliveryReadiness.deliveryHistoryRefs.length > 0);
    const blockerCodes = uniqueStrings([
      ...matches.flatMap(({ handoff }) => handoff.blockerCodes),
      !matchedAlertIds.length ? "alert_not_generated" : undefined,
      matchedAlertIds.length && !caseReady ? "case_handoff_missing" : undefined,
      matchedAlertIds.length && !deliveryReady ? "webhook_delivery_missing" : undefined
    ].filter(Boolean).map(String));
    return {
      candidateId: candidate.id,
      normalizedTerm: candidate.normalizedTerm,
      watchlistIds: candidate.watchlistIds,
      watchlistItemIds: candidate.watchlistItemIds,
      alertGeneratorKeys: candidate.alertGeneratorKeys,
      sourceFamilies: candidate.sourceFamilies,
      captureRefCount: candidate.captureRefs.length,
      suppressedDuplicateCaptureCount: candidate.duplicateCaptureCollapseCount,
      suppressedDuplicateCaptureIds: candidate.suppressedDuplicateCaptureRefs.map((ref) => ref.captureId),
      webhookDestinationIds: candidate.webhookDestinationIds,
      matchedAlertIds,
      caseReady,
      deliveryReady,
      delivered,
      blockerCodes
    };
  });
  const alertRows = handoffs.map(({ alert, handoff }) => {
    const sourceProvenanceSummary = alert.sourceProvenanceSummary ?? buildDwmAlertSourceProvenanceSummary({
      alert,
      tenantId: input.tenantId,
      organizationId: input.organizationId
    });
    const transitionEvents = buildDwmAlertCustomerProofWorkflowTransitionEvents(alert);
    const sourceHandoffReadiness = buildDwmAlertSourceHandoffReadiness({
      alert,
      handoff,
      sourceProvenanceSummary
    });
    return {
      alertId: String(alert.id),
      dedupeKey: handoff.dedupe.alertDedupeKey,
      sourceFamily: handoff.sourceFamily,
      watchlistIds: handoff.watchlist.watchlistIds,
      watchlistItemIds: handoff.watchlist.watchlistItemIds,
      selectedCaptureIds: handoff.evidence.selectedCaptureIds,
      evidenceCount: handoff.evidence.evidenceCount,
      provenanceCaptureIds: sourceProvenanceSummary.captureIds,
      provenanceSourceIds: sourceProvenanceSummary.sourceIds,
      provenanceGapCodes: uniqueStrings(sourceProvenanceSummary.provenanceGaps.map((gap) => gap.code)),
      workflowStatus: handoff.lifecycle.alertStatus,
      assignedOwner: alert.assignedOwner ? String(alert.assignedOwner) : undefined,
      workflowEventCount: handoff.workflowVersion.eventCount,
      workflowTransitionActions: uniqueStrings(transitionEvents.map((event) => event.action)) as DwmOrgAlertPipelineProof["alerts"][number]["workflowTransitionActions"],
      lastWorkflowEventAt: transitionEvents.at(-1)?.at,
      caseReady: handoff.caseReadiness.ready,
      caseIdCandidate: handoff.caseReadiness.caseIdCandidate,
      caseId: handoff.caseReadiness.caseId,
      casePath: handoff.caseReadiness.casePath,
      caseHandoffIdempotencyKey: handoff.caseReadiness.idempotencyKey,
      deliveryReady: handoff.deliveryReadiness.ready,
      delivered: handoff.deliveryReadiness.lastDeliveryStatus === "delivered" || handoff.deliveryReadiness.deliveryHistoryRefs.length > 0,
      downstreamBlockerCodes: handoff.blockerCodes,
      deliveryHistoryRefs: handoff.deliveryReadiness.deliveryHistoryRefs,
      sourceHandoffReadiness,
      alertGenerationRefs: handoff.watchlist.alertGenerationRefs,
      updateReceipt: handoff.updateReceipt ? {
        schemaVersion: handoff.updateReceipt.schemaVersion,
        ready: handoff.updateReceipt.ready,
        eventId: handoff.updateReceipt.eventId,
        addedCaptureIds: handoff.updateReceipt.addedCaptureIds,
        selectedCaptureIds: handoff.updateReceipt.selectedCaptureIds,
        workflowEventCount: handoff.updateReceipt.workflowEventCount,
        caseId: handoff.updateReceipt.caseId,
        casePath: handoff.updateReceipt.casePath,
        deliveryDedupeKey: handoff.updateReceipt.deliveryDedupeKey,
        alertGenerationRefs: handoff.updateReceipt.alertGenerationRefs,
        blockerCodes: handoff.updateReceipt.blockerCodes
      } : undefined,
      replayReceipt: {
        schemaVersion: handoff.replayReceipt.schemaVersion,
        ready: handoff.replayReceipt.ready,
        replayCount: handoff.replayReceipt.replayCount,
        workflowEventCount: handoff.replayReceipt.workflowEventCount,
        caseId: handoff.replayReceipt.caseId,
        casePath: handoff.replayReceipt.casePath,
        deliveryDedupeKey: handoff.replayReceipt.deliveryDedupeKey,
        selectedCaptureIds: handoff.replayReceipt.selectedCaptureIds,
        alertGenerationRefs: handoff.replayReceipt.alertGenerationRefs,
        blockerCodes: handoff.replayReceipt.blockerCodes
      }
    };
  });
  const gaps = buildOrgAlertPipelineGaps({ readiness, candidates, alertRows });
  const state = orgAlertPipelineState({ readiness, candidates, alertRows, gaps });
  return {
    schemaVersion: "dwm.org_alert_pipeline_proof.v1",
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    generatedAt,
    state,
    routes: {
      readiness: "/v1/dwm/alerts/generation-readiness",
      rebuild: "/v1/dwm/alerts/rebuild",
      alerts: "/v1/dwm/alerts",
      cases: "/v1/cases",
      webhookDelivery: "/v1/dwm/webhooks/deliver"
    },
    readiness: {
      schemaVersion: readiness.schemaVersion,
      readyForRebuild: readiness.readyForRebuild,
      readyForCustomerDelivery: readiness.readyForCustomerDelivery,
      blockerCodes: readiness.blockerCodes,
      counts: readiness.counts,
      sourceFamilyCoverage: readiness.sourceFamilyCoverage,
      sourceFamilyGaps: readiness.sourceFamilyGaps,
      zeroAlertProof: readiness.zeroAlertProof
    },
    consumerAdapters: buildDwmOrgAlertPipelineConsumerAdapters({
      readiness,
      alertRows,
      gaps,
      state
    }),
    consumerReceiptMatrix: buildDwmOrgAlertConsumerReceiptMatrix({
      alertRows,
      gaps,
      state,
      generatedAt
    }),
    candidates,
    alerts: alertRows,
    gaps,
    proofCommands: [
      "bun test src/tests/dwmAlertRepository.test.ts src/tests/dwmOrgAlertPipelineProof.test.ts",
      "bun test src/tests/dwmWorkflowPersistence.test.ts"
    ]
  };
}

function buildDwmOrgAlertConsumerReceiptMatrix(input: {
  alertRows: DwmOrgAlertPipelineProof["alerts"];
  gaps: DwmOrgAlertPipelineProof["gaps"];
  state: DwmOrgAlertPipelineProof["state"];
  generatedAt: string;
}): DwmOrgAlertPipelineProof["consumerReceiptMatrix"] {
  const hasAlerts = input.alertRows.length > 0;
  const blockerCodes = uniqueStrings([
    ...input.gaps.flatMap((gap) => gap.blockerCodes ?? []),
    ...input.alertRows.flatMap((alert) => [
      ...alert.downstreamBlockerCodes,
      ...alert.sourceHandoffReadiness.provenanceGapCodes,
      ...alert.sourceHandoffReadiness.evidenceFreshness.blockerCodes,
      ...alert.sourceHandoffReadiness.webhookConsumer.blockerCodes,
      ...alert.sourceHandoffReadiness.caseConsumer.blockerCodes,
      ...alert.sourceHandoffReadiness.blockerReasons.map((reason) => reason.code)
    ])
  ].map(String));
  const baseScopeFields = [
    "tenantId",
    "organizationId",
    "alerts.alertId",
    "alerts.watchlistIds",
    "alerts.watchlistItemIds",
    "alerts.alertGenerationRefs"
  ];
  const rows: DwmOrgAlertPipelineProof["consumerReceiptMatrix"]["rows"] = [{
    id: "dwm_org_alert_receipt_matrix_alert_generation",
    ownerLane: "alert_generation",
    customerVisibleState: input.state,
    readinessRoute: "/v1/dwm/alerts/generation-readiness",
    contractIds: ["dwm.org_alert_pipeline_proof.v1", "dwm.alert_generation_readiness.v1"],
    schemaIds: ["dwm.org_alert_pipeline_proof.v1", "dwm.alert_generation_readiness.v1"],
    receiptSchemaIds: ["dwm.org_alert_consumer_receipt_matrix.v1"],
    blockerCodes,
    scopeFields: [...baseScopeFields, "candidates.alertGeneratorKeys", "alerts.sourceHandoffReadiness.matchReason", "alerts.sourceHandoffReadiness.sourceCoverage", "alerts.sourceHandoffReadiness.blockerReasons"],
    downstreamOwners: ["dashboard", "analyst_portal", "public_ti"],
    missingContract: !hasAlerts,
    safeOutput: metadataOnlyAlertReceiptSafeOutput()
  }, {
    id: "dwm_org_alert_receipt_matrix_webhook_delivery",
    ownerLane: "webhook_delivery",
    customerVisibleState: input.state,
    readinessRoute: "/v1/dwm/webhooks/deliver",
    contractIds: ["dwm.alert_source_handoff_readiness.v1", "dwm.webhook.alert_source_handoff_readiness_consumer.v1"],
    schemaIds: ["dwm.alert_source_handoff_readiness.v1"],
    receiptSchemaIds: ["dwm.webhook.alert_source_handoff_readiness_consumer.v1", "dwm.alert_created_event_dispatch.v1"],
    blockerCodes: uniqueStrings(input.alertRows.flatMap((alert) => alert.sourceHandoffReadiness.webhookConsumer.blockerCodes)),
    scopeFields: [...baseScopeFields, "alerts.sourceHandoffReadiness.matchReason", "alerts.sourceHandoffReadiness.sourceCoverage", "alerts.sourceHandoffReadiness.duplicateEvidenceSuppression", "alerts.sourceHandoffReadiness.webhookConsumer.selectedWebhookDestinationId"],
    downstreamOwners: ["webhook", "dashboard"],
    missingContract: !input.alertRows.some((alert) => alert.sourceHandoffReadiness.webhookConsumer.ready),
    safeOutput: metadataOnlyAlertReceiptSafeOutput()
  }, {
    id: "dwm_org_alert_receipt_matrix_case_workflow",
    ownerLane: "case_workflow",
    customerVisibleState: input.state,
    readinessRoute: "/v1/cases",
    contractIds: ["dwm.alert_source_handoff_readiness.v1", "dwm.alert_replay_receipt.v1"],
    schemaIds: ["dwm.alert_source_handoff_readiness.v1"],
    receiptSchemaIds: ["dwm.alert_replay_receipt.v1"],
    blockerCodes: uniqueStrings(input.alertRows.flatMap((alert) => alert.sourceHandoffReadiness.caseConsumer.blockerCodes)),
    scopeFields: [...baseScopeFields, "alerts.sourceHandoffReadiness.matchReason", "alerts.sourceHandoffReadiness.caseConsumer.casePath", "alerts.sourceHandoffReadiness.analystWorkflowConsumer", "alerts.sourceHandoffReadiness.analystWorkflowConsumer.actionReadiness"],
    downstreamOwners: ["case", "analyst_portal"],
    missingContract: !input.alertRows.some((alert) => alert.sourceHandoffReadiness.caseConsumer.ready),
    safeOutput: metadataOnlyAlertReceiptSafeOutput()
  }, {
    id: "dwm_org_alert_receipt_matrix_public_ti",
    ownerLane: "public_ti",
    customerVisibleState: input.state,
    readinessRoute: "/v1/dwm/alerts/generation-readiness",
    contractIds: ["dwm.alert_source_handoff_readiness.v1", "ti.public_actor.alert_rebuild_handoff.v1"],
    schemaIds: ["dwm.alert_source_handoff_readiness.v1"],
    receiptSchemaIds: ["dwm.org_alert_consumer_receipt_matrix.v1"],
    blockerCodes: uniqueStrings(input.alertRows.flatMap((alert) => [
      ...(alert.sourceHandoffReadiness.publicTiConsumer.gapFields.includes("provenanceGapCodes") ? alert.sourceHandoffReadiness.provenanceGapCodes : []),
      ...alert.sourceHandoffReadiness.evidenceFreshness.blockerCodes
    ])),
    scopeFields: [...baseScopeFields, "alerts.sourceHandoffReadiness.matchReason", "alerts.sourceHandoffReadiness.sourceCoverage", "alerts.sourceHandoffReadiness.blockerReasons", "alerts.sourceHandoffReadiness.duplicateEvidenceSuppression", "alerts.sourceHandoffReadiness.evidenceFreshness", "alerts.sourceHandoffReadiness.publicTiConsumer.alertGenerationRefCount"],
    downstreamOwners: ["public_ti", "dashboard"],
    missingContract: !input.alertRows.some((alert) => alert.sourceHandoffReadiness.publicTiConsumer.ready),
    safeOutput: metadataOnlyAlertReceiptSafeOutput()
  }];
  return {
    schemaVersion: "dwm.org_alert_consumer_receipt_matrix.v1",
    checkedAt: input.generatedAt,
    ok: rows.every((row) => !row.missingContract),
    rowCount: rows.length,
    rows
  };
}

function metadataOnlyAlertReceiptSafeOutput(): DwmOrgAlertPipelineProof["consumerReceiptMatrix"]["rows"][number]["safeOutput"] {
  return {
    metadataOnly: true,
    rawEvidenceExposed: false,
    webhookSecretExposed: false,
    crossOrgDataExposed: false
  };
}

function buildDwmAlertSourceHandoffReadiness(input: {
  alert?: any;
  handoff: DwmAlertDownstreamHandoff;
  sourceProvenanceSummary: DwmAlertSourceProvenanceSummary;
}): DwmOrgAlertPipelineProof["alerts"][number]["sourceHandoffReadiness"] {
  const provenanceGapCodes = uniqueStrings(input.sourceProvenanceSummary.provenanceGaps.map((gap) => gap.code));
  const downstreamBlockerCodes = uniqueStrings(input.handoff.blockerCodes.map(String));
  const deliveryBlockerCodes = downstreamBlockerCodes.filter((code) => code.includes("webhook") || code.includes("delivery") || code.includes("destination"));
  const caseBlockerCodes = downstreamBlockerCodes.filter((code) => code.startsWith("case_") || code === "missing_org_ref");
  const analystWorkflowBlockerCodes = uniqueStrings([
    ...downstreamBlockerCodes.filter((code) => ["stale_workflow", "revoked_actor", "org_mismatch"].includes(code)),
    input.handoff.workflowVersion.expectedEventCount !== undefined
      && input.handoff.workflowVersion.expectedEventCount !== input.handoff.workflowVersion.eventCount
      ? "stale_workflow"
      : undefined
  ].filter(Boolean).map(String));
  const evidenceFreshness = buildDwmAlertEvidenceFreshness(input.handoff);
  const sourceHandoffBlockerCodes = uniqueStrings([
    ...provenanceGapCodes,
    ...evidenceFreshness.blockerCodes
  ]);
  const delivered = input.handoff.deliveryReadiness.lastDeliveryStatus === "delivered"
    || input.handoff.deliveryReadiness.deliveryHistoryRefs.length > 0;
  const webhookReady = input.handoff.deliveryReadiness.ready || delivered;
  const sourceReady = input.handoff.evidence.evidenceCount > 0
    && input.handoff.evidence.selectedCaptureIds.length > 0
    && sourceHandoffBlockerCodes.length === 0;
  const ready = sourceReady && input.handoff.caseReadiness.ready && webhookReady;
  const state: DwmOrgAlertPipelineProof["alerts"][number]["sourceHandoffReadiness"]["state"] = ready
    ? "ready_for_consumers"
    : !sourceReady
      ? evidenceFreshness.blockerCodes.length > 0
        ? "source_freshness_gap"
        : "source_provenance_gap"
      : !input.handoff.caseReadiness.ready
        ? "case_handoff_gap"
        : "delivery_handoff_gap";
  const sourceCoverage: DwmOrgAlertPipelineProof["alerts"][number]["sourceHandoffReadiness"]["sourceCoverage"] = {
    schemaVersion: "dwm.alert_source_coverage.v1",
    sourceFamily: input.handoff.sourceFamily,
    captureCount: input.handoff.evidence.selectedCaptureIds.length,
    provenanceCaptureCount: input.sourceProvenanceSummary.captureIds.length,
    provenanceSourceCount: input.sourceProvenanceSummary.sourceIds.length,
    freshnessState: evidenceFreshness.state,
    blockerCodes: sourceHandoffBlockerCodes
  };
  const blockerReasons = buildDwmAlertSourceHandoffBlockerReasons({
    handoff: input.handoff,
    provenanceGapCodes,
    evidenceFreshnessBlockerCodes: evidenceFreshness.blockerCodes
  });
  const actionReadiness = buildDwmAlertAnalystActionReadiness({
    alert: input.alert,
    handoff: input.handoff
  });

  return {
    schemaVersion: "dwm.alert_source_handoff_readiness.v1",
    ready,
    state,
    sourceFamily: input.handoff.sourceFamily,
    selectedCaptureIds: input.handoff.evidence.selectedCaptureIds,
    evidenceCount: input.handoff.evidence.evidenceCount,
    matchReason: input.handoff.matchReason,
    sourceCoverage,
    blockerReasons,
    duplicateEvidenceSuppression: duplicateEvidenceSuppressionForSourceHandoff(
      input.handoff.evidence.duplicateEvidenceSuppression,
      input.handoff.sourceFamily
    ),
    provenanceCaptureIds: input.sourceProvenanceSummary.captureIds,
    provenanceSourceIds: input.sourceProvenanceSummary.sourceIds,
    provenanceGapCodes,
    evidenceFreshness,
    webhookConsumer: {
      ready: webhookReady && sourceReady,
      deliveryReady: input.handoff.deliveryReadiness.ready,
      delivered,
      deliveryDedupeKey: input.handoff.updateReceipt?.deliveryDedupeKey ?? input.handoff.replayReceipt.deliveryDedupeKey,
      selectedWebhookDestinationId: input.handoff.deliverySelection.selectedWebhookDestinationId,
      webhookDestinationIds: input.handoff.deliverySelection.webhookDestinationIds,
      createdEventDispatchReady: input.handoff.createdEventDispatch.ready,
      createdEventId: input.handoff.createdEventDispatch.eventId,
      createdEventDispatchIdempotencyKey: input.handoff.createdEventDispatch.idempotencyKey,
      deliveryHistoryRefs: input.handoff.deliveryReadiness.deliveryHistoryRefs,
      blockerCodes: uniqueStrings([...deliveryBlockerCodes, ...sourceHandoffBlockerCodes])
    },
    caseConsumer: {
      ready: input.handoff.caseReadiness.ready,
      caseIdCandidate: input.handoff.caseReadiness.caseIdCandidate,
      caseId: input.handoff.caseReadiness.caseId,
      casePath: input.handoff.caseReadiness.casePath,
      idempotencyKey: input.handoff.caseReadiness.idempotencyKey,
      blockerCodes: caseBlockerCodes
    },
    publicTiConsumer: {
      ready: input.handoff.watchlist.alertGenerationRefs.length > 0 && sourceReady,
      redacted: true,
      alertGenerationRefCount: input.handoff.watchlist.alertGenerationRefs.length,
      sourceFamily: input.handoff.sourceFamily,
      stableFields: [
        "sourceFamily",
        "matchReason",
        "sourceCoverage",
        "provenanceCaptureIds",
        "provenanceGapCodes",
        "alertGenerationRefCount"
      ],
      gapFields: ["state", "blockerReasons", "sourceCoverage.blockerCodes", "provenanceGapCodes"]
    },
    analystWorkflowConsumer: {
      ready: analystWorkflowBlockerCodes.length === 0,
      workflowStatus: input.handoff.lifecycle.alertStatus,
      assignedOwner: input.handoff.lifecycle.assignedOwner,
      decisionValue: input.handoff.workflowDecision.value,
      decisionRationale: input.handoff.workflowDecision.rationale,
      falsePositiveReason: input.handoff.workflowDecision.falsePositiveReason,
      suppressionReason: input.handoff.workflowDecision.suppressionReason,
      decidedAt: input.handoff.workflowDecision.decidedAt,
      decidedBy: input.handoff.workflowDecision.decidedBy,
      workflowEventCount: input.handoff.workflowVersion.eventCount,
      transitionActions: input.handoff.workflowTransitions.actions,
      lastWorkflowEventAt: input.handoff.workflowTransitions.lastEventAt,
      caseLinked: input.handoff.workflowTransitions.caseLinked,
      suppressed: input.handoff.workflowTransitions.suppressed,
      closed: input.handoff.workflowTransitions.closed,
      actionReadiness,
      blockerCodes: analystWorkflowBlockerCodes
    },
    stableFields: [
      "sourceFamily",
      "matchReason",
      "sourceCoverage",
      "selectedCaptureIds",
      "evidenceCount",
      "duplicateEvidenceSuppression",
      "provenanceCaptureIds",
      "provenanceSourceIds",
      "evidenceFreshness",
      "webhookConsumer.deliveryDedupeKey",
      "webhookConsumer.selectedWebhookDestinationId",
      "webhookConsumer.createdEventDispatchReady",
      "caseConsumer.casePath",
      "analystWorkflowConsumer.workflowStatus",
      "analystWorkflowConsumer.decisionValue",
      "analystWorkflowConsumer.transitionActions",
      "analystWorkflowConsumer.caseLinked",
      "analystWorkflowConsumer.actionReadiness"
    ],
    gapFields: [
      "state",
      "blockerReasons",
      "sourceCoverage.blockerCodes",
      "provenanceGapCodes",
      "evidenceFreshness.blockerCodes",
      "webhookConsumer.blockerCodes",
      "caseConsumer.blockerCodes",
      "analystWorkflowConsumer.blockerCodes"
    ]
  };
}

function buildDwmAlertSourceHandoffBlockerReasons(input: {
  handoff: DwmAlertDownstreamHandoff;
  provenanceGapCodes: string[];
  evidenceFreshnessBlockerCodes: string[];
}): DwmOrgAlertPipelineProof["alerts"][number]["sourceHandoffReadiness"]["blockerReasons"] {
  const downstreamReasons = input.handoff.blockers.map((blocker) => ({
    code: String(blocker.code),
    field: blocker.field,
    detail: blocker.detail,
    recoverable: blocker.recoverable,
    ownerLane: ownerLaneForPipelineBlockers([String(blocker.code)])
  }));
  const provenanceReasons = input.provenanceGapCodes.map((code) => ({
    code,
    field: "sourceProvenanceSummary.provenanceGaps",
    detail: "Alert evidence is missing a stable source URL, source key, observed timestamp, or content hash.",
    recoverable: true,
    ownerLane: "source_operations" as const
  }));
  const freshnessReasons = input.evidenceFreshnessBlockerCodes.map((code) => ({
    code,
    field: "sourceHandoffReadiness.evidenceFreshness",
    detail: "Alert evidence is older than the current freshness window for customer delivery.",
    recoverable: true,
    ownerLane: "source_operations" as const
  }));
  const byCodeAndField = new Map<string, DwmOrgAlertPipelineProof["alerts"][number]["sourceHandoffReadiness"]["blockerReasons"][number]>();
  for (const reason of [...downstreamReasons, ...provenanceReasons, ...freshnessReasons]) {
    const key = `${reason.code}:${reason.field}`;
    if (!byCodeAndField.has(key)) byCodeAndField.set(key, reason);
  }
  return [...byCodeAndField.values()];
}

function buildDwmAlertAnalystActionReadiness(input: {
  alert?: any;
  handoff: DwmAlertDownstreamHandoff;
}): DwmOrgAlertPipelineProof["alerts"][number]["sourceHandoffReadiness"]["analystWorkflowConsumer"]["actionReadiness"] {
  const actions: DwmAlertWorkflowExecutionReadiness["action"][] = [
    "assign",
    "note",
    "transition",
    "case_link",
    "replay",
    "close",
    "reopen",
    "suppress",
    "deliver"
  ];
  const expectedWorkflowEventCount = input.handoff.workflowVersion.eventCount;
  const actionRows = actions.map((action) => {
    const readiness = buildDwmAlertWorkflowExecutionReadiness({
      alert: input.alert,
      organizationId: input.handoff.organizationId,
      action,
      actorRole: "analyst",
      expectedWorkflowEventCount,
      caseAvailable: action === "case_link" ? input.handoff.caseReadiness.ready : undefined,
      deliveryAvailable: action === "deliver" ? input.handoff.deliveryReadiness.ready : undefined,
      duplicateReplay: action === "replay" ? input.handoff.replay.duplicate : undefined,
      lifecycleBlockers: workflowActionLifecycleBlockers(action, input.handoff)
    });
    return {
      action,
      ready: readiness.ready,
      idempotencyKey: readiness.idempotencyKey,
      workflowEventCount: readiness.currentWorkflowEventCount ?? expectedWorkflowEventCount,
      casePath: readiness.workflowActionEvent?.casePath,
      deliveryDedupeKey: readiness.workflowActionEvent?.deliveryDedupeKey,
      blockerCodes: readiness.blockerCodes
    };
  });
  return {
    schemaVersion: "dwm.alert_analyst_action_readiness.v1",
    expectedWorkflowEventCount,
    readyActions: actionRows.filter((row) => row.ready).map((row) => row.action),
    blockedActions: actionRows.filter((row) => !row.ready).map((row) => row.action),
    actions: actionRows
  };
}

function workflowActionLifecycleBlockers(
  action: DwmAlertWorkflowExecutionReadiness["action"],
  handoff: DwmAlertDownstreamHandoff
): DwmAlertWorkflowExecutionBlockerCode[] {
  const lifecycleCodes = handoff.blockerCodes.flatMap((code): DwmAlertWorkflowExecutionBlockerCode[] => {
    if (code === "archived_org"
      || code === "retired_watchlist"
      || code === "disabled_destination"
      || code === "closed_alert"
      || code === "suppressed_alert"
      || code === "revoked_actor"
      || code === "no_active_source_match"
      || code === "entitlement_denied"
      || code === "org_mismatch") {
      return [code];
    }
    return [];
  });
  return lifecycleCodes.filter((code) => {
    if (code === "disabled_destination") return action === "deliver" || action === "replay";
    if (code === "closed_alert") return action === "deliver" || action === "replay" || action === "close";
    if (code === "suppressed_alert") return action === "deliver" || action === "replay" || action === "suppress";
    return true;
  });
}

function buildDwmAlertEvidenceFreshness(handoff: DwmAlertDownstreamHandoff): DwmOrgAlertPipelineProof["alerts"][number]["sourceHandoffReadiness"]["evidenceFreshness"] {
  return buildDwmAlertEvidenceFreshnessForWindow(
    handoff.evidence.generationEvidenceWindow,
    handoff.generatedAt,
    handoff.evidence.captureIds,
    handoff.sourceFamily ? [handoff.sourceFamily] : []
  );
}

function buildDwmAlertEvidenceFreshnessForWindow(
  window: DwmAlertDownstreamHandoff["evidence"]["generationEvidenceWindow"] | undefined,
  generatedAt: string,
  fallbackCaptureIds: string[] = [],
  fallbackSourceFamilies: string[] = []
): DwmOrgAlertPipelineProof["alerts"][number]["sourceHandoffReadiness"]["evidenceFreshness"] {
  const maxFreshAgeHours = 72;
  const maxCurrentAgeHours = 168;
  const firstObservedAt = window?.firstObservedAt;
  const lastObservedAt = window?.lastObservedAt;
  const generatedTime = Date.parse(generatedAt);
  const lastObservedTime = lastObservedAt ? Date.parse(lastObservedAt) : Number.NaN;
  const latestEvidenceAgeHours = Number.isFinite(generatedTime) && Number.isFinite(lastObservedTime)
    ? Math.max(0, Math.round((generatedTime - lastObservedTime) / 36e5))
    : undefined;
  const state = latestEvidenceAgeHours === undefined
    ? "unknown"
    : latestEvidenceAgeHours <= maxFreshAgeHours
      ? "fresh"
      : latestEvidenceAgeHours <= maxCurrentAgeHours
        ? "current"
        : "stale";
  const blockerCodes = state === "stale"
    ? ["stale_capture_evidence"]
    : state === "unknown"
      ? ["unknown_capture_freshness"]
      : [];
  return {
    schemaVersion: "dwm.alert_evidence_freshness.v1",
    state,
    generatedAt,
    firstObservedAt,
    lastObservedAt,
    latestEvidenceAgeHours,
    maxFreshAgeHours,
    maxCurrentAgeHours,
    captureIds: window?.captureIds ?? fallbackCaptureIds,
    sourceFamilies: window?.sourceFamilies ?? fallbackSourceFamilies,
    blockerCodes
  };
}

function duplicateEvidenceSuppressionForSourceHandoff(summary: DwmDuplicateEvidenceSuppressionSummary | undefined, sourceFamily: string | undefined): DwmDuplicateEvidenceSuppressionSummary | undefined {
  if (!summary) return undefined;
  const family = String(sourceFamily ?? "").trim();
  if (!family || !summary.duplicateIdentities.length) return summary;
  const familyIdentities = summary.duplicateIdentities.filter((identity) => identity.startsWith(`${family}:`));
  if (!familyIdentities.length) {
    return {
      schemaVersion: "dwm.duplicate_evidence_suppression.v1",
      suppressedCount: 0,
      suppressedCaptureIds: [],
      duplicateOfCaptureIds: [],
      duplicateIdentities: [],
      reasons: []
    };
  }
  if (familyIdentities.length === summary.duplicateIdentities.length) return summary;
  return {
    ...summary,
    duplicateIdentities: familyIdentities,
    suppressedCount: familyIdentities.length
  };
}

export function buildDwmSourceProjectionAlertReadinessProof(input: {
  sourceProjection: TiSourceProvenancePublicTiSourceOpsProjection;
  alertPipeline: DwmOrgAlertPipelineProof;
  generatedAt?: string;
}): DwmSourceProjectionAlertReadinessProof {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const blockers = buildSourceProjectionAlertReadinessBlockers(input.sourceProjection, input.alertPipeline);
  const state = sourceProjectionAlertReadinessState(input.sourceProjection, input.alertPipeline, blockers);
  const ownerLane = sourceProjectionAlertReadinessOwnerLane(blockers, state);
  const provenanceRefs = sourceProjectionAlertReadinessProvenanceRefs(input.sourceProjection, input.alertPipeline);
  const canRenderGaps = blockers.length > 0 || input.alertPipeline.readiness.zeroAlertProof.zeroAlert;

  return {
    schemaVersion: "dwm.source_projection_alert_readiness.v1",
    id: stableId("dwm_source_projection_alert_readiness", `${input.sourceProjection.id}:${input.alertPipeline.generatedAt}:${generatedAt}:${state}`),
    tenantId: input.alertPipeline.tenantId,
    organizationId: input.alertPipeline.organizationId,
    actor: input.sourceProjection.actor,
    generatedAt,
    state,
    ownerLane,
    sourceProjection: {
      schemaVersion: input.sourceProjection.schemaVersion,
      id: input.sourceProjection.id,
      generatedAt: input.sourceProjection.generatedAt,
      publicTiRoute: input.sourceProjection.publicTiRoute,
      pageReadiness: input.sourceProjection.pageReadiness,
      sourceCoverage: input.sourceProjection.sourceCoverage,
      provenanceRowCount: input.sourceProjection.provenanceRows.length,
      enrichmentGapCount: input.sourceProjection.enrichmentGaps.length
    },
    alertPipeline: {
      schemaVersion: input.alertPipeline.schemaVersion,
      generatedAt: input.alertPipeline.generatedAt,
      state: input.alertPipeline.state,
      readyForRebuild: input.alertPipeline.readiness.readyForRebuild,
      readyForCustomerDelivery: input.alertPipeline.readiness.readyForCustomerDelivery,
      candidateCount: input.alertPipeline.candidates.length,
      alertCount: input.alertPipeline.alerts.length,
      blockerCodes: input.alertPipeline.readiness.blockerCodes,
      zeroAlertState: input.alertPipeline.readiness.zeroAlertProof.state
    },
    blockers,
    downstreamRoutes: {
      publicTI: input.sourceProjection.publicTiRoute,
      dashboard: "/v1/dwm/alerts",
      alertReadiness: "/v1/dwm/alerts/generation-readiness",
      alertRebuild: "/v1/dwm/alerts/rebuild",
      webhookDelivery: "/v1/dwm/webhooks/deliver"
    },
    provenanceRefs,
    consumerContracts: {
      schemaVersion: "dwm.source_projection_alert_readiness_consumers.v1",
      publicTI: {
        canConsume: input.sourceProjection.pageReadiness.canRender,
        redacted: true,
        stableFields: [
          "actor",
          "sourceProjection.publicTiRoute",
          "sourceProjection.sourceCoverage",
          "alertPipeline.zeroAlertState",
          "blockers"
        ],
        gapFields: ["blockers.code", "blockers.ownerLane", "blockers.route"]
      },
      dashboard: {
        canConsume: true,
        route: "/v1/dwm/alerts",
        stableFields: [
          "state",
          "sourceProjection.pageReadiness",
          "alertPipeline.readyForRebuild",
          "alertPipeline.readyForCustomerDelivery",
          "provenanceRefs.alertCandidateIds",
          "provenanceRefs.alertIds"
        ],
        gapFields: ["blockers.code", "blockers.blockerCodes", "alertPipeline.zeroAlertState"]
      },
      alertGeneration: {
        canConsume: input.sourceProjection.pageReadiness.alertGeneration && input.alertPipeline.readiness.readyForRebuild,
        route: "/v1/dwm/alerts/rebuild",
        stableFields: [
          "tenantId",
          "organizationId",
          "sourceProjection.sourceCoverage.families",
          "provenanceRefs.sourceOpsFixtureBundleId",
          "provenanceRefs.alertCandidateIds"
        ],
        gapFields: ["blockers.code", "alertPipeline.blockerCodes"]
      },
      webhook: {
        canConsume: input.alertPipeline.consumerAdapters.webhook.canConsume && state === "ready_for_customer_delivery",
        route: "/v1/dwm/webhooks/deliver",
        stableFields: [
          "provenanceRefs.alertIds",
          "provenanceRefs.deliveryHistoryRefs",
          "alertPipeline.readyForCustomerDelivery"
        ],
        gapFields: ["blockers.code", "blockers.route"]
      }
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    },
    proofCommands: [
      "bun test src/tests/sourceProvenanceTiPageContract.test.ts src/tests/dwmOrgAlertPipelineProof.test.ts",
      "bunx tsc --noEmit"
    ]
  };
}

function buildSourceProjectionAlertReadinessBlockers(
  sourceProjection: TiSourceProvenancePublicTiSourceOpsProjection,
  alertPipeline: DwmOrgAlertPipelineProof
): DwmSourceProjectionAlertReadinessProof["blockers"] {
  const blockers: DwmSourceProjectionAlertReadinessProof["blockers"] = [];
  if (!sourceProjection.organizationId || !alertPipeline.organizationId) {
    blockers.push(sourceProjectionAlertReadinessBlocker(
      "missing_org_scope",
      "org_foundation",
      "/v1/dwm/alerts/generation-readiness",
      "Org scope is required before alert source details can be shared.",
      true
    ));
  } else if (sourceProjection.organizationId !== alertPipeline.organizationId) {
    blockers.push(sourceProjectionAlertReadinessBlocker(
      "org_mismatch",
      "org_foundation",
      "/v1/dwm/alerts/generation-readiness",
      "Source projection and alert pipeline reference different organizations.",
      true
    ));
  }
  if (!sourceProjection.sourceOpsFixtureBundleId || sourceProjection.provenanceRows.some((row) => !row.provenance?.sourceOpsFixtureBundleId)) {
    blockers.push(sourceProjectionAlertReadinessBlocker(
      "missing_provenance",
      "source_operations",
      "/v1/dwm/source-requests",
      "Source projection must include fixture and packet provenance before downstream consumers can trust it.",
      true
    ));
  }
  if (sourceProjection.pageReadiness.state === "blocked") {
    blockers.push(sourceProjectionAlertReadinessBlocker(
      "source_projection_blocked",
      "source_operations",
      sourceProjection.publicTiRoute,
      "Public TI source projection is blocked.",
      true
    ));
  } else if (sourceProjection.pageReadiness.state === "partial") {
    blockers.push(sourceProjectionAlertReadinessBlocker(
      "source_projection_partial",
      "source_operations",
      sourceProjection.publicTiRoute,
      "Public TI source projection is only partially ready.",
      true
    ));
  }
  if (sourceProjection.sourceCoverage.freshnessState === "stale") {
    blockers.push(sourceProjectionAlertReadinessBlocker(
      "stale_source",
      "source_operations",
      "/v1/dwm/source-requests",
      "Source evidence is stale and must be refreshed or acknowledged before alert readiness is trusted.",
      true
    ));
  }
  for (const gap of sourceProjection.enrichmentGaps) {
    if (gap.code === "duplicate_candidate") {
      blockers.push(sourceProjectionAlertReadinessBlocker(
        "duplicate_candidate",
        "source_operations",
        gap.route.path,
        "Source operations reported a duplicate candidate.",
        true,
        { sourceFamily: gap.sourceFamily }
      ));
    }
    if (gap.code === "unsupported_source_family") {
      blockers.push(sourceProjectionAlertReadinessBlocker(
        "unsupported_source_family",
        "source_operations",
        gap.route.path,
        "Source operations reported a source family that alert generation cannot consume yet.",
        true,
        { sourceFamily: gap.sourceFamily }
      ));
    }
  }
  if (alertPipeline.readiness.blockerCodes.length > 0) {
    blockers.push(sourceProjectionAlertReadinessBlocker(
      "alert_readiness_blocked",
      ownerLaneForPipelineBlockers(alertPipeline.readiness.blockerCodes),
      "/v1/dwm/alerts/generation-readiness",
      "Org alert generation readiness has blockers.",
      true,
      { blockerCodes: alertPipeline.readiness.blockerCodes }
    ));
  }
  if (alertPipeline.readiness.zeroAlertProof.zeroAlert) {
    blockers.push(sourceProjectionAlertReadinessBlocker(
      "zero_alert_no_match",
      "alert_generation",
      "/v1/dwm/alerts/rebuild",
      "No customer alert row is expected from the current watchlist and capture inputs.",
      true,
      { blockerCodes: alertPipeline.readiness.zeroAlertProof.blockerCodes }
    ));
  }
  if (!alertPipeline.consumerAdapters.webhook.canConsume && !alertPipeline.readiness.zeroAlertProof.zeroAlert) {
    blockers.push(sourceProjectionAlertReadinessBlocker(
      "webhook_delivery_unready",
      "webhook_delivery",
      "/v1/dwm/webhooks/deliver",
      "Webhook delivery cannot consume this alert pipeline state yet.",
      true
    ));
  }
  return uniqueSourceProjectionAlertReadinessBlockers(blockers);
}

function sourceProjectionAlertReadinessBlocker(
  code: DwmSourceProjectionAlertReadinessProof["blockers"][number]["code"],
  ownerLane: DwmSourceProjectionAlertReadinessProof["blockers"][number]["ownerLane"],
  route: string,
  detail: string,
  recoverable: boolean,
  extra: Partial<Pick<DwmSourceProjectionAlertReadinessProof["blockers"][number], "sourceFamily" | "blockerCodes">> = {}
): DwmSourceProjectionAlertReadinessProof["blockers"][number] {
  return { code, ownerLane, route, detail, recoverable, ...extra };
}

function uniqueSourceProjectionAlertReadinessBlockers(
  blockers: DwmSourceProjectionAlertReadinessProof["blockers"]
): DwmSourceProjectionAlertReadinessProof["blockers"] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.ownerLane}:${blocker.route}:${blocker.sourceFamily ?? ""}:${(blocker.blockerCodes ?? []).join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceProjectionAlertReadinessState(
  sourceProjection: TiSourceProvenancePublicTiSourceOpsProjection,
  alertPipeline: DwmOrgAlertPipelineProof,
  blockers: DwmSourceProjectionAlertReadinessProof["blockers"]
): DwmSourceProjectionAlertReadinessProof["state"] {
  const hardBlocked = blockers.some((blocker) => blocker.code === "missing_org_scope" || blocker.code === "org_mismatch" || blocker.code === "missing_provenance" || blocker.code === "source_projection_blocked");
  if (hardBlocked) return "blocked";
  if (alertPipeline.readiness.zeroAlertProof.zeroAlert) return "zero_alert_no_match";
  if (sourceProjection.ok && alertPipeline.readiness.readyForCustomerDelivery && alertPipeline.alerts.length > 0) return "ready_for_customer_delivery";
  if (sourceProjection.pageReadiness.alertGeneration && alertPipeline.readiness.readyForRebuild) return "ready_for_alert_rebuild";
  return "blocked";
}

function sourceProjectionAlertReadinessOwnerLane(
  blockers: DwmSourceProjectionAlertReadinessProof["blockers"],
  state: DwmSourceProjectionAlertReadinessProof["state"]
): DwmSourceProjectionAlertReadinessProof["ownerLane"] {
  if (blockers.length > 0) return blockers[0].ownerLane;
  if (state === "ready_for_customer_delivery") return "webhook_delivery";
  return "alert_generation";
}

function sourceProjectionAlertReadinessProvenanceRefs(
  sourceProjection: TiSourceProvenancePublicTiSourceOpsProjection,
  alertPipeline: DwmOrgAlertPipelineProof
): DwmSourceProjectionAlertReadinessProof["provenanceRefs"] {
  return {
    sourceOpsFixtureBundleId: sourceProjection.sourceOpsFixtureBundleId,
    sourceFreshnessGapPacketIds: uniqueStrings(sourceProjection.provenanceRows.map((row) => row.provenance.sourceFreshnessGapPacketId).filter(Boolean)),
    parserHealthAlertPacketIds: uniqueStrings(sourceProjection.provenanceRows.map((row) => row.provenance.parserHealthAlertPacketId).filter(Boolean)),
    sourceOpsActionQueueIds: uniqueStrings(sourceProjection.provenanceRows.map((row) => row.provenance.sourceOpsActionQueueId).filter(Boolean)),
    alertCandidateIds: uniqueStrings(alertPipeline.candidates.map((candidate) => candidate.candidateId)),
    alertIds: uniqueStrings(alertPipeline.alerts.map((alert) => alert.alertId)),
    deliveryHistoryRefs: uniqueStrings(alertPipeline.alerts.flatMap((alert) => alert.deliveryHistoryRefs))
  };
}

function buildDwmOrgAlertPipelineConsumerAdapters(input: {
  readiness: DwmAlertGenerationReadiness;
  alertRows: DwmOrgAlertPipelineProof["alerts"];
  gaps: DwmOrgAlertPipelineProof["gaps"];
  state: DwmOrgAlertPipelineProof["state"];
}): DwmOrgAlertPipelineProof["consumerAdapters"] {
  const hasAlerts = input.alertRows.length > 0;
  const hasBlockingGaps = input.gaps.length > 0 || input.readiness.zeroAlertProof.zeroAlert;
  const sharedStableFields = [
    "tenantId",
    "organizationId",
    "state",
    "readiness.blockerCodes",
    "readiness.zeroAlertProof",
    "readiness.sourceFamilyGaps",
    "candidates.watchlistIds",
    "candidates.watchlistItemIds",
    "alerts.alertId",
    "alerts.dedupeKey",
    "alerts.sourceFamily",
    "alerts.selectedCaptureIds",
    "alerts.evidenceCount",
    "alerts.sourceHandoffReadiness.matchReason",
    "alerts.sourceHandoffReadiness.sourceCoverage",
    "alerts.sourceHandoffReadiness.duplicateEvidenceSuppression",
    "alerts.sourceHandoffReadiness.evidenceFreshness",
    "alerts.provenanceGapCodes",
    "alerts.workflowStatus",
    "alerts.workflowTransitionActions",
    "alerts.sourceHandoffReadiness.analystWorkflowConsumer",
    "alerts.sourceHandoffReadiness.analystWorkflowConsumer.actionReadiness",
    "alerts.casePath",
    "gaps.blockerCodes"
  ];
  const gapFields = [
    "readiness.zeroAlertProof.state",
    "readiness.zeroAlertProof.nextAction",
    "readiness.sourceFamilyGaps.state",
    "readiness.sourceFamilyGaps.blockerCode",
    "gaps.ownerLane",
    "gaps.route"
  ];
  return {
    schemaVersion: "dwm.org_alert_pipeline_consumer_adapters.v1",
    dashboard: {
      canConsume: hasAlerts || hasBlockingGaps,
      route: "/v1/dwm/alerts",
      stableFields: [
        ...sharedStableFields,
        "alerts.caseReady",
        "alerts.caseIdCandidate",
        "alerts.caseHandoffIdempotencyKey",
        "alerts.deliveryReady",
        "alerts.sourceHandoffReadiness",
        "alerts.sourceHandoffReadiness.matchReason",
        "alerts.sourceHandoffReadiness.sourceCoverage",
        "alerts.sourceHandoffReadiness.duplicateEvidenceSuppression",
        "alerts.sourceHandoffReadiness.analystWorkflowConsumer",
        "alerts.sourceHandoffReadiness.analystWorkflowConsumer.actionReadiness",
        "alerts.workflowStatus",
        "alerts.downstreamBlockerCodes"
      ],
      gapFields
    },
    webhook: {
      canConsume: hasAlerts || input.readiness.readyForCustomerDelivery,
      route: "/v1/dwm/webhooks/deliver",
      stableFields: [
        "tenantId",
        "organizationId",
        "state",
        "alerts.alertId",
        "alerts.dedupeKey",
        "alerts.deliveryReady",
        "alerts.deliveryHistoryRefs",
        "alerts.sourceHandoffReadiness.webhookConsumer",
        "alerts.sourceHandoffReadiness.matchReason",
        "alerts.sourceHandoffReadiness.sourceCoverage",
        "alerts.sourceHandoffReadiness.duplicateEvidenceSuppression",
        "alerts.selectedCaptureIds",
        "alerts.provenanceGapCodes",
        "candidates.webhookDestinationIds",
        "gaps.blockerCodes"
      ],
      gapFields
    },
    publicTI: {
      canConsume: hasAlerts || hasBlockingGaps,
      redacted: true,
      stableFields: [
        "tenantId",
        "organizationId",
        "state",
        "readiness.zeroAlertProof",
        "readiness.sourceFamilyGaps",
        "alerts.sourceFamily",
        "alerts.sourceHandoffReadiness",
        "alerts.sourceHandoffReadiness.matchReason",
        "alerts.sourceHandoffReadiness.sourceCoverage",
        "alerts.sourceHandoffReadiness.duplicateEvidenceSuppression",
        "alerts.sourceHandoffReadiness.blockerReasons",
        "alerts.provenanceGapCodes",
        "gaps.detail"
      ],
      gapFields
    },
    analystPortal: {
      canConsume: hasAlerts || input.state === "ready_to_generate_alerts",
      route: "/v1/dwm/alerts",
      stableFields: [
        ...sharedStableFields,
        "alerts.caseReady",
        "alerts.casePath",
        "alerts.caseHandoffIdempotencyKey",
        "alerts.deliveryReady",
        "alerts.delivered",
        "alerts.sourceHandoffReadiness",
        "alerts.sourceHandoffReadiness.matchReason",
        "alerts.sourceHandoffReadiness.sourceCoverage",
        "alerts.sourceHandoffReadiness.duplicateEvidenceSuppression",
        "alerts.sourceHandoffReadiness.analystWorkflowConsumer",
        "alerts.sourceHandoffReadiness.analystWorkflowConsumer.actionReadiness",
        "alerts.workflowStatus",
        "alerts.workflowTransitionActions",
        "alerts.workflowEventCount",
        "alerts.assignedOwner",
        "proofCommands"
      ],
      workflowFields: [
        "alerts.alertId",
        "alerts.dedupeKey",
        "alerts.workflowStatus",
        "alerts.assignedOwner",
        "alerts.workflowEventCount",
        "alerts.workflowTransitionActions",
        "alerts.downstreamBlockerCodes",
        "readiness.zeroAlertProof.watchlistTerms",
        "gaps"
      ],
      gapFields
    }
  };
}

function alertMatchesPipelineScope(alert: any, tenantId: string, organizationId: string | undefined): boolean {
  if (String(alert?.tenantId ?? "") !== tenantId) return false;
  if (!organizationId) return true;
  return !alert?.organizationId || String(alert.organizationId) === organizationId;
}

function alertMatchesGenerationCandidate(alert: any, handoff: DwmAlertDownstreamHandoff, candidate: DwmAlertGenerationCandidate): boolean {
  const alertGeneratorKeys = uniqueStrings([
    ...handoff.watchlist.alertGeneratorKeys,
    ...asStringArray(alert?.workflowContext?.alertGeneratorKeys),
    ...asStringArray(alert?.webhookContext?.alertGeneratorKeys),
    ...asStringArray(alert?.deliveryReadinessContext?.alertGeneratorKeys)
  ]);
  const watchlistIds = uniqueStrings([
    ...handoff.watchlist.watchlistIds,
    ...asStringArray(alert?.watchlistIds),
    ...asStringArray(alert?.workflowContext?.watchlistIds),
    ...asStringArray(alert?.webhookContext?.watchlistIds)
  ]);
  const watchlistItemIds = uniqueStrings([
    ...handoff.watchlist.watchlistItemIds,
    ...asStringArray(alert?.watchlistItemIds),
    ...asStringArray(alert?.workflowContext?.watchlistItemIds),
    ...asStringArray(alert?.webhookContext?.watchlistItemIds)
  ]);
  return intersects(alertGeneratorKeys, candidate.alertGeneratorKeys)
    || intersects(watchlistIds, candidate.watchlistIds)
    || intersects(watchlistItemIds, candidate.watchlistItemIds)
    || handoff.dedupe.alertDedupeKey === candidate.dedupeKeyCandidate;
}

function buildOrgAlertPipelineGaps(input: {
  readiness: DwmAlertGenerationReadiness;
  candidates: DwmOrgAlertPipelineProof["candidates"];
  alertRows: DwmOrgAlertPipelineProof["alerts"];
}): DwmOrgAlertPipelineProof["gaps"] {
  const gaps: DwmOrgAlertPipelineProof["gaps"] = [];
  if (input.readiness.blockerCodes.length) {
    gaps.push({
      code: "readiness_blocked",
      ownerLane: ownerLaneForPipelineBlockers(input.readiness.blockerCodes),
      route: "/v1/dwm/alerts/generation-readiness",
      blockerCodes: input.readiness.blockerCodes,
      detail: "Alert generation readiness is blocked before rebuild."
    });
  }
  for (const candidate of input.candidates) {
    if (!candidate.matchedAlertIds.length) {
      gaps.push({
        code: "alert_not_generated",
        ownerLane: "alert_generation",
        route: "/v1/dwm/alerts/rebuild",
        candidateId: candidate.candidateId,
        blockerCodes: candidate.blockerCodes,
        detail: "Candidate has watchlist source details but no persisted alert yet."
      });
      continue;
    }
    if (!candidate.caseReady) {
      gaps.push({
        code: "case_handoff_missing",
        ownerLane: "case_workflow",
        route: "/v1/cases",
        candidateId: candidate.candidateId,
        alertId: candidate.matchedAlertIds[0],
        blockerCodes: candidate.blockerCodes,
        detail: "Persisted alert exists but the case handoff route or case id is not ready."
      });
    }
    if (!candidate.deliveryReady) {
      gaps.push({
        code: "webhook_delivery_missing",
        ownerLane: "webhook_delivery",
        route: "/v1/dwm/webhooks/deliver",
        candidateId: candidate.candidateId,
        alertId: candidate.matchedAlertIds[0],
        blockerCodes: candidate.blockerCodes,
        detail: "Persisted alert exists but webhook delivery is not ready or has no delivery receipt."
      });
    }
  }
  for (const alert of input.alertRows.filter((row) => row.downstreamBlockerCodes.length)) {
    gaps.push({
      code: "downstream_blocked",
      ownerLane: ownerLaneForPipelineBlockers(alert.downstreamBlockerCodes),
      route: "/v1/dwm/alerts",
      alertId: alert.alertId,
      blockerCodes: alert.downstreamBlockerCodes,
      detail: "Persisted alert has downstream blockers for case, delivery, lifecycle, or entitlement."
    });
  }
  return gaps;
}

function orgAlertPipelineState(input: {
  readiness: DwmAlertGenerationReadiness;
  candidates: DwmOrgAlertPipelineProof["candidates"];
  alertRows: DwmOrgAlertPipelineProof["alerts"];
  gaps: DwmOrgAlertPipelineProof["gaps"];
}): DwmOrgAlertPipelineProof["state"] {
  if (!input.readiness.readyForRebuild || input.readiness.blockerCodes.length) return "blocked_before_rebuild";
  if (!input.alertRows.length) return "ready_to_generate_alerts";
  if (input.candidates.some((candidate) => !candidate.matchedAlertIds.length)) return "generated_partial";
  if (input.candidates.some((candidate) => !candidate.caseReady || !candidate.deliveryReady)) return "generated_needs_case_or_delivery";
  return "ready_for_operator_workflow";
}

function ownerLaneForPipelineBlockers(codes: string[]): DwmOrgAlertPipelineProof["gaps"][number]["ownerLane"] {
  if (codes.some((code) => code.includes("source") || code === "no_matching_captures" || code === "missing_evidence")) return "source_operations";
  if (codes.some((code) => code.includes("entitlement"))) return "entitlement";
  if (codes.some((code) => code.includes("org") || code.includes("member") || code.includes("role") || code.includes("watchlist"))) return "org_foundation";
  if (codes.some((code) => code.includes("case"))) return "case_workflow";
  if (codes.some((code) => code.includes("destination") || code.includes("delivery") || code.includes("webhook"))) return "webhook_delivery";
  return "alert_generation";
}

function intersects(left: string[], right: string[]): boolean {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

export function dwmAlertToSqlRecord(alert: any) {
  return {
    id: String(alert.id),
    tenant_id: String(alert.tenantId),
    organization_id: alert.organizationId ? String(alert.organizationId) : null,
    event_type: String(alert.eventType),
    dedupe_key: String(alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey),
    severity: String(alert.severity),
    confidence: Number(alert.confidence),
    confidence_reasoning: alert.confidenceReasoning ?? [],
    matched_term: alert.matchedTerm,
    company: String(alert.company),
    actor: alert.actor ? String(alert.actor) : null,
    artifact_type: String(alert.artifactType),
    source_family: String(alert.sourceFamily),
    source_count: Number(alert.sourceCount ?? 1),
    first_seen_at: String(alert.firstSeenAt),
    last_seen_at: String(alert.lastSeenAt),
    claim_summary: String(alert.claimSummary),
    provenance: alert.provenance,
    review_state: String(alert.reviewState),
    delivery_state: String(alert.deliveryState ?? "pending_review"),
    recommended_action: String(alert.recommendedAction),
    recommended_route: String(alert.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute),
    evidence: alert.evidence ?? [],
    webhook_delivery: alert.webhookDelivery,
    delivery_readiness_context: alert.deliveryReadinessContext,
    source_provenance_summary: alert.sourceProvenanceSummary ?? buildDwmAlertSourceProvenanceSummary({ alert }),
    match_reason: alert.matchReason ?? buildDwmAlertMatchReason({ alert, workflowContext: alert.workflowContext }),
    org_watchlist_scope: alert.orgWatchlistScope ?? buildDwmAlertOrgWatchlistScope(alert.workflowContext) ?? null,
    workflow_context: alert.workflowContext,
    webhook_context: alert.webhookContext,
    case_id_candidate: alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate ?? null,
    case_path: alert.casePath ?? alert.workflowContext?.casePath ?? null,
    alert_detail_path: alert.alertDetailPath ?? alert.workflowContext?.alertDetailPath ?? null,
    watchlist_item_ids: alert.watchlistItemIds ?? alert.workflowContext?.watchlistItemIds ?? [],
    watchlist_ids: alert.watchlistIds ?? [],
    workflow_note: alert.workflowNote ? String(alert.workflowNote) : null,
    workflow_status: String(alert.workflowStatus ?? "new"),
    workflow_rationale: alert.workflowRationale ? String(alert.workflowRationale) : null,
    assigned_owner: alert.assignedOwner ? String(alert.assignedOwner) : null,
    severity_override: alert.severityOverride ? String(alert.severityOverride) : null,
    workflow_events: alert.workflowEvents ?? [],
    suppressed_at: alert.suppressedAt ? String(alert.suppressedAt) : null,
    closed_at: alert.closedAt ? String(alert.closedAt) : null,
    reopened_at: alert.reopenedAt ? String(alert.reopenedAt) : null,
    replay_count: Number(alert.replayCount ?? 0),
    last_replayed_at: alert.lastReplayedAt ? String(alert.lastReplayedAt) : null,
    delivered_at: alert.deliveredAt ? String(alert.deliveredAt) : null,
    saved_at: String(alert.savedAt),
    updated_at: String(alert.updatedAt)
  };
}

export function buildDwmAlertCustomerProofHandoffRow(input: {
  alert: any;
  deliveries?: Array<Record<string, any>>;
  webhookDestinationLifecycle?: { verified?: boolean; status?: string; destinationId?: string };
  supportOnlyRedactionNeeded?: boolean;
  generatedAt?: string;
}): DwmAlertCustomerProofHandoffRow {
  const alert = input.alert;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const deliveries = input.deliveries ?? [];
  const context = alert.deliveryReadinessContext ?? {};
  const workflow = alert.workflowContext ?? {};
  const webhook = alert.webhookContext ?? {};
  const selectedCaptureIds = uniqueStrings(asStringArray(context.selectedCaptureIds ?? workflow.captureIds ?? webhook.captureIds ?? alert.provenance?.captureIds));
  const evidenceCount = Number(context.evidenceCount ?? workflow.evidenceCount ?? webhook.evidenceCount ?? alert.evidence?.length ?? 0);
  const deliveryHistoryRefs = uniqueStrings([
    ...asStringArray(context.deliveryHistoryRefs),
    ...deliveries.map((delivery) => delivery.id).filter(Boolean)
  ].map(String));
  const webhookDestinationIds = uniqueStrings(asStringArray(context.webhookDestinationIds ?? workflow.webhookDestinationIds ?? webhook.webhookDestinationIds));
  const alertGeneratorKeys = uniqueStrings(asStringArray(context.alertGeneratorKeys ?? workflow.alertGeneratorKeys ?? webhook.alertGeneratorKeys));
  const alertGenerationRefs = uniqueAlertGenerationRefs([
    ...asRecordArray(context.alertGenerationRefs),
    ...asRecordArray(workflow.alertGenerationRefs),
    ...asRecordArray(webhook.alertGenerationRefs),
    ...asRecordArray(alert.alertCreatedEvent?.consumerPayload?.alertGenerationRefs),
    ...asRecordArray(alert.alertUpdatedEvent?.consumerPayload?.alertGenerationRefs)
  ]);
  const watchlistIds = uniqueStrings(asStringArray(context.watchlistIds ?? workflow.watchlistIds ?? webhook.watchlistIds ?? alert.watchlistIds));
  const watchlistItemIds = uniqueStrings(asStringArray(context.watchlistItemIds ?? workflow.watchlistItemIds ?? webhook.watchlistItemIds ?? alert.watchlistItemIds));
  const generationEvidenceWindow = normalizeGenerationEvidenceWindow(context.generationEvidenceWindow ?? workflow.generationEvidenceWindow ?? webhook.generationEvidenceWindow);
  const delivered = Boolean(alert.deliveredAt) || alert.deliveryState === "delivered" || deliveries.some((delivery) => delivery.status === "delivered") || context.state === "delivered";
  const redactionRequired = input.supportOnlyRedactionNeeded === true || (alert.evidence ?? []).some((item: any) => item.redactionState === "raw_sensitive");
  const hasCaseRoute = Boolean(context.casePath ?? alert.casePath ?? workflow.casePath);
  const createdEvent = normalizeDwmAlertCreatedEvent(alert, context, selectedCaptureIds);
  const updatedEvent = normalizeDwmAlertUpdatedEvent(alert, context, selectedCaptureIds);
  const sourceProvenanceSummary = alert.sourceProvenanceSummary ?? buildDwmAlertSourceProvenanceSummary({
    alert,
    tenantId: alert.tenantId ?? workflow.tenantId ?? webhook.tenantId,
    organizationId: alert.organizationId ?? workflow.organizationId ?? webhook.organizationId,
    workflowContext: workflow
  });
  const blockers = [
    ...((context.blockers ?? []) as DwmAlertCustomerProofHandoffRow["typedBlockers"]),
    !(alert.organizationId ?? context.organizationId) ? customerProofBlocker("no_org_export", "organizationId", "Org/customer alert handoff requires an organization id.", true) : undefined,
    !alertGeneratorKeys.length ? customerProofBlocker("org_export_unavailable", "workflowContext.alertGeneratorKeys", "Org watchlist export reference is missing from the persisted alert.", true) : undefined,
    !selectedCaptureIds.length ? customerProofBlocker("no_matching_captures", "selectedCaptureIds", "No matching captures are attached to this alert handoff.", true) : undefined,
    evidenceCount === 0 ? customerProofBlocker("missing_evidence", "evidence", "Customer handoff requires persisted evidence.", true) : undefined,
    !hasCaseRoute ? customerProofBlocker("case_route_unavailable", "casePath", "Case handoff route is unavailable for this alert.", true) : undefined,
    input.webhookDestinationLifecycle && input.webhookDestinationLifecycle.verified === false ? customerProofBlocker("webhook_destination_not_verified", "webhookDestinationLifecycle.verified", "Webhook destination exists but is not verified for customer delivery.", true) : undefined,
    redactionRequired ? customerProofBlocker("support_only_redaction_needed", "evidence.redactionState", "Support/helpdesk consumers must use redacted evidence only.", true) : undefined,
    delivered ? customerProofBlocker("duplicate_delivered_dedupe", "deliveryDedupeKey", "This alert has delivered history; replay must preserve the same dedupe key.", false) : undefined
  ].filter(Boolean) as DwmAlertCustomerProofHandoffRow["typedBlockers"];
  const blockerCodes = uniqueStrings(blockers.map((blocker) => blocker.code)) as DwmCustomerProofBlockerCode[];
  const deliveryState = String(context.state ?? alert.deliveryState ?? "pending_review");
  const deliveryReady = Boolean(context.ready) && !blockerCodes.includes("webhook_destination_not_verified") && !blockerCodes.includes("support_only_redaction_needed");
  const alertDetailPath = context.alertDetailPath ?? alert.alertDetailPath ?? workflow.alertDetailPath ?? webhook.alertDetailPath;
  const workflowTransitionEvents = buildDwmAlertCustomerProofWorkflowTransitionEvents(alert);
  return {
    schemaVersion: "dwm.customer_alert_proof.v1",
    alertId: String(alert.id),
    tenantId: String(alert.tenantId ?? workflow.tenantId ?? webhook.tenantId ?? "default"),
    organizationId: alert.organizationId ?? workflow.organizationId ?? webhook.organizationId,
    dedupeKey: String(alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey ?? workflow.dedupeKey),
    alertDetailPath,
    deliveryDedupeKey: String(context.deliveryDedupeKey ?? alert.webhookDelivery?.dedupeKey ?? alert.dedupeKey),
    replayMarker: context.replayMarker,
    sourceFamily: String(context.sourceFamily ?? alert.sourceFamily ?? workflow.sourceFamily ?? "unknown"),
    evidenceCount,
    selectedCaptureIds,
    generationEvidenceWindow,
    provenance: {
      matchBasis: alert.provenance?.matchBasis,
      captureIds: uniqueStrings(asStringArray(alert.provenance?.captureIds ?? selectedCaptureIds)),
      sourceIds: uniqueStrings(asStringArray(alert.provenance?.sourceIds ?? (alert.evidence ?? []).map((item: any) => item.sourceId ?? item.provenance?.sourceId))),
      generatedAt: alert.provenance?.generatedAt
    },
    alertGenerationRefs,
    sourceProvenanceSummary,
    createdEvent,
    updatedEvent,
    workflow: {
      status: String(alert.workflowStatus ?? "new"),
      reviewState: alert.reviewState,
      deliveryState: alert.deliveryState,
      assignedOwner: alert.assignedOwner,
      severityOverride: alert.severityOverride,
      note: alert.workflowNote,
      rationale: alert.workflowRationale,
      decision: {
        value: alert.workflowDecision,
        rationale: alert.decisionRationale ?? alert.workflowRationale,
        falsePositiveReason: alert.falsePositiveReason,
        suppressionReason: alert.suppressionReason,
        decidedAt: alert.decisionAt,
        decidedBy: alert.decisionBy
      },
      eventCount: (alert.workflowEvents ?? []).length,
      transitionEvents: workflowTransitionEvents,
      replayCount: Number(alert.replayCount ?? 0)
    },
    caseHandoff: {
      ready: hasCaseRoute,
      caseIdCandidate: context.caseIdCandidate ?? alert.caseIdCandidate ?? workflow.caseIdCandidate,
      caseId: context.caseId ?? alert.caseId,
      casePath: context.casePath ?? alert.casePath ?? workflow.casePath,
      route: "/v1/cases"
    },
    delivery: {
      ready: deliveryReady,
      state: deliveryState,
      webhookDestinationIds,
      deliveryHistoryRefs,
      lastDeliveryStatus: context.lastDeliveryStatus ?? deliveries.at(-1)?.status,
      lastDeliveryAt: context.lastDeliveryAt ?? deliveries.at(-1)?.attemptedAt,
      delivered
    },
    support: {
      redacted: true,
      redactionRequired,
      guidance: redactionRequired ? "Use redacted evidence summaries for support-only consumers." : "Customer proof contains no raw sensitive evidence."
    },
    consumerCompatibility: {
      webhook: { canConsume: webhookDestinationIds.length > 0 && evidenceCount > 0, requiredFields: ["alertId", "dedupeKey", "selectedCaptureIds", "deliveryDedupeKey", "replayMarker"] },
      helpdesk: { canConsume: Boolean(alert.organizationId), supportOnlyRedactionNeeded: redactionRequired },
      publicTI: { canConsume: alertGeneratorKeys.length > 0, alertGeneratorKeys }
    },
    consumerAdapter: {
      schemaVersion: "dwm.org_alert_case_consumer_adapter.v1",
      organizationId: alert.organizationId ?? workflow.organizationId ?? webhook.organizationId,
      tenantId: String(alert.tenantId ?? workflow.tenantId ?? webhook.tenantId ?? "default"),
      alertId: String(alert.id),
      dedupeKey: String(alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey ?? workflow.dedupeKey),
      watchlistIds,
      watchlistItemIds,
      alertGeneratorKeys,
      alertGenerationRefs,
      dashboard: {
        route: "organization_watchlist",
        alertDetailPath,
        casePath: context.casePath ?? alert.casePath ?? workflow.casePath,
        fields: ["organizationId", "tenantId", "alertId", "alertDetailPath", "casePath", "watchlistItemIds", "alertGenerationRefs", "workflow.status", "workflow.transitionEvents", "sourceProvenanceSummary.provenanceGaps", "updatedEvent"]
      },
      helpdesk: {
        redacted: true,
        supportOnlyRedactionNeeded: redactionRequired,
        safeFields: ["organizationId", "tenantId", "alertId", "sourceFamily", "evidenceCount", "caseHandoff.ready", "delivery.state"]
      },
      publicTI: {
        canConsume: alertGeneratorKeys.length > 0,
        fields: ["organizationId", "tenantId", "sourceFamily", "provenance.captureIds", "sourceProvenanceSummary.provenanceGaps", "alertGeneratorKeys", "alertGenerationRefs"]
      },
      roleGates: {
        create_watchlist: ["owner", "admin"],
        edit_watchlist_terms: ["owner", "admin"],
        acknowledge_alert: ["owner", "admin", "analyst"],
        assign_case: ["owner", "admin", "analyst"],
        manage_invites: ["owner", "admin"]
      }
    },
    consumerContract: {
      schemaVersion: "dwm.alert_consumer_contract.v1",
      queue: {
        route: "/v1/dwm/alerts",
        stableFields: ["alertId", "alertDetailPath", "organizationId", "tenantId", "sourceFamily", "workflow.status", "workflow.transitionEvents", "sourceProvenanceSummary", "sourceProvenanceSummary.provenanceGaps", "delivery.state", "caseHandoff.casePath", "evidenceCount", "createdEvent", "updatedEvent"],
        workflowStatus: String(alert.workflowStatus ?? "new"),
        sourceFamily: String(context.sourceFamily ?? alert.sourceFamily ?? workflow.sourceFamily ?? "unknown"),
        evidenceCount
      },
      detail: {
        route: "/v1/dwm/alerts/:alertId",
        alertDetailPath,
        stableFields: ["alertDetailPath", "selectedCaptureIds", "generationEvidenceWindow", "provenance.captureIds", "sourceProvenanceSummary", "sourceProvenanceSummary.evidenceExcerpts", "createdEvent", "updatedEvent", "dedupeKey", "watchlistItemIds"],
        selectedCaptureIds,
        provenanceCaptureIds: uniqueStrings(asStringArray(alert.provenance?.captureIds ?? selectedCaptureIds)),
        generationEvidenceWindow
      },
      webhookEvent: {
        eventType: "dwm.alert.created",
        eventId: createdEvent?.eventId,
        dispatchReady: webhookDestinationIds.length > 0 && evidenceCount > 0,
        deliveryDedupeKey: String(context.deliveryDedupeKey ?? alert.webhookDelivery?.dedupeKey ?? alert.dedupeKey),
        replayMarker: context.replayMarker,
        requiredFields: ["alertId", "eventId", "alertDetailPath", "deliveryDedupeKey", "selectedCaptureIds", "sourceFamily", "organizationId"]
      },
      webhookUpdatedEvent: updatedEvent ? {
        eventType: "dwm.alert.updated",
        eventId: updatedEvent.eventId,
        dispatchReady: webhookDestinationIds.length > 0 && evidenceCount > 0 && updatedEvent.addedCaptureIds.length > 0,
        deliveryDedupeKey: String(context.deliveryDedupeKey ?? alert.webhookDelivery?.dedupeKey ?? alert.dedupeKey),
        replayMarker: context.replayMarker,
        addedCaptureIds: updatedEvent.addedCaptureIds,
        requiredFields: ["alertId", "eventId", "alertDetailPath", "deliveryDedupeKey", "addedCaptureIds", "selectedCaptureIds", "sourceFamily", "organizationId"]
      } : undefined,
      publicTI: {
        redacted: true,
        canConsume: alertGeneratorKeys.length > 0,
        stableFields: ["organizationId", "tenantId", "sourceFamily", "provenance.captureIds", "sourceProvenanceSummary.provenanceGaps", "generationEvidenceWindow.sourceFamilies", "alertGeneratorKeys", "alertGenerationRefs"],
        alertGeneratorKeys,
        alertGenerationRefs
      }
    },
    blockerCodes,
    typedBlockers: blockers,
    generatedAt
  };
}

function buildDwmAlertCustomerProofWorkflowTransitionEvents(alert: any): DwmAlertCustomerProofHandoffRow["workflow"]["transitionEvents"] {
  const events = [...(alert.workflowEvents ?? [])].sort((a: any, b: any) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
  return events.map((event: any, index: number) => {
    const toStatus = String(event.toWorkflowStatus ?? alert.workflowStatus ?? "new");
    return {
      schemaVersion: "dwm.alert_workflow_transition_event.v1",
      id: event.id ? String(event.id) : stableId("dwm_alert_workflow_event", `${alert.id ?? "alert"}:${event.at ?? index}:${toStatus}`),
      at: event.at ? String(event.at) : undefined,
      actor: event.actor ? String(event.actor) : undefined,
      eventType: event.eventType ? String(event.eventType) : "workflow.transition",
      action: customerProofWorkflowTransitionAction(event, toStatus),
      fromStatus: event.fromWorkflowStatus ? String(event.fromWorkflowStatus) : undefined,
      toStatus,
      caseId: event.toCaseId ?? alert.caseId,
      casePath: event.toCasePath ?? alert.casePath,
      hasNote: Boolean(event.note),
      hasRationale: Boolean(event.rationale),
      dedupeKey: String(alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey ?? ""),
      sourceFamily: String(alert.sourceFamily ?? alert.workflowContext?.sourceFamily ?? "unknown"),
      watchlistIds: uniqueStrings(asStringArray(alert.watchlistIds ?? alert.workflowContext?.watchlistIds)),
      captureIds: uniqueStrings(asStringArray(alert.workflowContext?.captureIds ?? alert.provenance?.captureIds))
    };
  });
}

function customerProofWorkflowTransitionAction(event: any, toStatus: string): DwmAlertCustomerProofHandoffRow["workflow"]["transitionEvents"][number]["action"] {
  if (toStatus === "closed") return "closed";
  if (toStatus === "suppressed") return "suppressed";
  if (toStatus === "reopened") return "reopened";
  if (event.toCaseId || event.toCasePath || toStatus === "investigating") return "escalated";
  if (event.toOwner !== event.fromOwner) return "assigned";
  if (toStatus === "triaged") return "reviewed";
  if (event.eventType === "workflow.note") return "note";
  return "transition";
}

function normalizeDwmAlertCreatedEvent(alert: any | undefined, context: any, fallbackCaptureIds: string[]) {
  const event = alert?.alertCreatedEvent;
  const eventId = event?.id ?? context?.alertCreatedEventId;
  const at = event?.at ?? context?.alertCreatedAt;
  if (!eventId && !at) return undefined;
  return {
    schemaVersion: "dwm.alert_created_event.v1" as const,
    eventId,
    eventType: event?.eventType ?? "dwm.alert.created",
    at,
    sourceFamily: event?.sourceFamily ?? context?.sourceFamily ?? alert?.sourceFamily,
    captureIds: uniqueStrings(asStringArray(event?.captureIds ?? fallbackCaptureIds)),
    dedupeKey: event?.dedupeKey ?? alert?.dedupeKey ?? alert?.webhookDelivery?.dedupeKey,
    deliveryDedupeKey: event?.deliveryDedupeKey ?? context?.deliveryDedupeKey ?? alert?.webhookDelivery?.dedupeKey ?? alert?.dedupeKey,
    recommendedRoute: event?.recommendedRoute ?? context?.recommendedRoute ?? alert?.recommendedRoute ?? alert?.webhookDelivery?.recommendedRoute,
    alertDetailPath: event?.alertDetailPath ?? context?.alertDetailPath ?? alert?.alertDetailPath,
    consumerPayload: event?.consumerPayload
  };
}

function normalizeDwmAlertUpdatedEvent(alert: any | undefined, context: any, fallbackCaptureIds: string[]) {
  const event = alert?.alertUpdatedEvent;
  const eventId = event?.id;
  const at = event?.at;
  if (!eventId && !at) return undefined;
  return {
    schemaVersion: "dwm.alert_updated_event.v1" as const,
    eventId,
    eventType: event?.eventType ?? "dwm.alert.updated",
    at,
    sourceFamily: event?.sourceFamily ?? context?.sourceFamily ?? alert?.sourceFamily,
    captureIds: uniqueStrings(asStringArray(event?.captureIds ?? fallbackCaptureIds)),
    addedCaptureIds: uniqueStrings(asStringArray(event?.addedCaptureIds)),
    removedCaptureIds: uniqueStrings(asStringArray(event?.removedCaptureIds)),
    evidenceCount: event?.evidenceCount,
    previousEvidenceCount: event?.previousEvidenceCount,
    dedupeKey: event?.dedupeKey ?? alert?.dedupeKey ?? alert?.webhookDelivery?.dedupeKey,
    deliveryDedupeKey: event?.deliveryDedupeKey ?? context?.deliveryDedupeKey ?? alert?.webhookDelivery?.dedupeKey ?? alert?.dedupeKey,
    recommendedRoute: event?.recommendedRoute ?? context?.recommendedRoute ?? alert?.recommendedRoute ?? alert?.webhookDelivery?.recommendedRoute,
    alertDetailPath: event?.alertDetailPath ?? context?.alertDetailPath ?? alert?.alertDetailPath,
    consumerPayload: event?.consumerPayload
  };
}

function normalizeGenerationEvidenceWindow(value: unknown) {
  const window = value && typeof value === "object" ? value as any : undefined;
  if (!window) return undefined;
  const captureIds = uniqueStrings(asStringArray(window.captureIds));
  const sourceFamilies = uniqueStrings(asStringArray(window.sourceFamilies));
  const contentHashes = uniqueStrings(asStringArray(window.contentHashes));
  if (!captureIds.length && !sourceFamilies.length && !contentHashes.length && !window.firstObservedAt && !window.lastObservedAt) return undefined;
  return {
    captureIds,
    sourceFamilies,
    contentHashes,
    firstObservedAt: window.firstObservedAt ? String(window.firstObservedAt) : undefined,
    lastObservedAt: window.lastObservedAt ? String(window.lastObservedAt) : undefined
  };
}

export function buildDwmAlertDownstreamHandoff(input: {
  alert?: any;
  deliveries?: Array<Record<string, any>>;
  organizationId?: string;
  expectedWorkflowEventCount?: number;
  caseAvailable?: boolean;
  destinationAvailable?: boolean;
  entitlementAllowed?: boolean;
  currentReplayAttempt?: boolean;
  organizationStatus?: string;
  retiredWatchlistIds?: string[];
  disabledDestinationIds?: string[];
  actorAllowed?: boolean;
  activeSourceMatch?: boolean;
  generatedAt?: string;
}): DwmAlertDownstreamHandoff {
  const alert = input.alert;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const deliveries = input.deliveries ?? [];
  const context = alert?.deliveryReadinessContext ?? {};
  const workflow = alert?.workflowContext ?? {};
  const webhook = alert?.webhookContext ?? {};
  const proof = alert
    ? buildDwmAlertCustomerProofHandoffRow({ alert, deliveries, generatedAt })
    : undefined;
  const selectedCaptureIds = uniqueStrings(asStringArray(context.selectedCaptureIds ?? workflow.captureIds ?? webhook.captureIds ?? alert?.provenance?.captureIds));
  const captureIds = uniqueStrings(asStringArray(alert?.provenance?.captureIds ?? selectedCaptureIds));
  const sourceIds = uniqueStrings(asStringArray([
    ...asStringArray(alert?.provenance?.sourceIds),
    ...asStringArray(alert?.sourceProvenanceSummary?.sourceIds),
    ...asStringArray(alert?.alertCreatedEvent?.consumerPayload?.provenance?.sourceIds),
    ...asStringArray(alert?.alertCreatedEvent?.consumerPayload?.sourceProvenanceSummary?.sourceIds),
    ...asStringArray(alert?.alertUpdatedEvent?.consumerPayload?.provenance?.sourceIds),
    ...asStringArray(alert?.alertUpdatedEvent?.consumerPayload?.sourceProvenanceSummary?.sourceIds),
    ...(alert?.evidence ?? []).map((item: any) => item.sourceId ?? item.provenance?.sourceId).filter(Boolean).map(String)
  ]));
  const generationEvidenceWindow = normalizeGenerationEvidenceWindow(context.generationEvidenceWindow ?? workflow.generationEvidenceWindow ?? webhook.generationEvidenceWindow);
  const matchReason = alert?.matchReason ?? workflow.matchReason ?? webhook.matchReason ?? (alert ? buildDwmAlertMatchReason({
    alert,
    tenantId: alert.tenantId ?? workflow.tenantId ?? webhook.tenantId,
    organizationId: input.organizationId ?? alert.organizationId ?? workflow.organizationId ?? webhook.organizationId,
    workflowContext: workflow
  }) : undefined);
  const watchlistIds = uniqueStrings(asStringArray(context.watchlistIds ?? workflow.watchlistIds ?? webhook.watchlistIds ?? alert?.watchlistIds));
  const watchlistItemIds = uniqueStrings(asStringArray(context.watchlistItemIds ?? workflow.watchlistItemIds ?? webhook.watchlistItemIds ?? alert?.watchlistItemIds));
  const alertGeneratorKeys = uniqueStrings(asStringArray(context.alertGeneratorKeys ?? workflow.alertGeneratorKeys ?? webhook.alertGeneratorKeys));
  const alertGenerationRefs = uniqueAlertGenerationRefs([
    ...asRecordArray(context.alertGenerationRefs),
    ...asRecordArray(workflow.alertGenerationRefs),
    ...asRecordArray(webhook.alertGenerationRefs),
    ...asRecordArray(alert?.alertCreatedEvent?.consumerPayload?.alertGenerationRefs),
    ...asRecordArray(alert?.alertUpdatedEvent?.consumerPayload?.alertGenerationRefs)
  ]);
  const webhookDestinationIds = uniqueStrings(asStringArray(context.webhookDestinationIds ?? workflow.webhookDestinationIds ?? webhook.webhookDestinationIds));
  const deliveryHistoryRefs = uniqueStrings([
    ...asStringArray(context.deliveryHistoryRefs),
    ...deliveries.map((delivery) => delivery.id).filter(Boolean)
  ].map(String));
  const lastDelivery = [...deliveries]
    .sort((a, b) => String(a.attemptedAt ?? "").localeCompare(String(b.attemptedAt ?? "")))
    .at(-1);
  const eventCount = (alert?.workflowEvents ?? []).length;
  const transitionEvents = alert ? buildDwmAlertCustomerProofWorkflowTransitionEvents(alert) : [];
  const orgId = input.organizationId ?? alert?.organizationId ?? workflow.organizationId ?? webhook.organizationId;
  const casePath = context.casePath ?? alert?.casePath ?? workflow.casePath;
  const alertDetailPath = context.alertDetailPath ?? alert?.alertDetailPath ?? workflow.alertDetailPath ?? webhook.alertDetailPath;
  const caseIdCandidate = context.caseIdCandidate ?? alert?.caseIdCandidate ?? workflow.caseIdCandidate;
  const deliveryDedupeKey = String(context.deliveryDedupeKey ?? alert?.webhookDelivery?.dedupeKey ?? alert?.dedupeKey ?? "");
  const createdEvent = normalizeDwmAlertCreatedEvent(alert, context, selectedCaptureIds);
  const updatedEvent = normalizeDwmAlertUpdatedEvent(alert, context, selectedCaptureIds);
  const delivered = Boolean(alert?.deliveredAt) || alert?.deliveryState === "delivered" || context.state === "delivered" || deliveries.some((delivery) => delivery.status === "delivered");
  const duplicateReplay = delivered && Number(alert?.replayCount ?? 0) > 0 && input.currentReplayAttempt !== true;
  const organizationStatus = input.organizationStatus ?? alert?.organizationStatus ?? workflow.organizationStatus;
  const archivedOrg = organizationStatus !== undefined && !["active", "enabled"].includes(String(organizationStatus).toLowerCase());
  const retiredWatchlistIds = uniqueStrings(input.retiredWatchlistIds ?? []);
  const disabledDestinationIds = uniqueStrings(input.disabledDestinationIds ?? []);
  const disabledDestinationSet = new Set(disabledDestinationIds);
  const alertStatus = effectiveLifecycleAlertStatus(alert);
  const closedAlert = alertStatus === "closed" || alert?.reviewState === "resolved" || context.state === "closed";
  const suppressedAlert = alertStatus === "suppressed" || alert?.deliveryState === "muted" || alert?.reviewState === "false_positive" || context.state === "suppressed";
  const actorAllowed = input.actorAllowed !== false;
  const activeSourceMatch = input.activeSourceMatch !== false;
  const enabledWebhookDestinationIds = webhookDestinationIds.filter((id) => !disabledDestinationSet.has(id));
  const destinationReady = input.destinationAvailable !== false && enabledWebhookDestinationIds.length > 0 && selectedCaptureIds.length > 0;
  const caseReady = input.caseAvailable !== false && Boolean(casePath && caseIdCandidate);
  const entitlementDenied = input.entitlementAllowed === false || context.entitlement?.status === "suspended" || (context.entitlement?.blockedReasons ?? []).length > 0 || workflow.membershipContext?.canGenerateAlerts === false;
  const evidenceCount = Number(context.evidenceCount ?? workflow.evidenceCount ?? webhook.evidenceCount ?? alert?.evidence?.length ?? 0);
  const blockers = [
    !alert ? downstreamHandoffBlocker("missing_alert", "alertId", "Persisted alert is required for downstream handoff.", true) : undefined,
    alert && input.organizationId && orgId && input.organizationId !== orgId ? downstreamHandoffBlocker("org_mismatch", "organizationId", "Alert organization does not match the downstream handoff scope.", false) : undefined,
    archivedOrg ? downstreamHandoffBlocker("archived_org", "organization.status", "Organization lifecycle is not active; downstream alert handoff is disabled.", true) : undefined,
    retiredWatchlistIds.length ? downstreamHandoffBlocker("retired_watchlist", "watchlist.status", "One or more watchlists tied to this alert are retired or archived.", true) : undefined,
    disabledDestinationIds.length ? downstreamHandoffBlocker("disabled_destination", "webhookDestinationIds", "One or more webhook destinations tied to this alert are disabled.", true) : undefined,
    !caseReady ? downstreamHandoffBlocker("case_unavailable", "casePath", "Case route/id candidate is required before case handoff.", true) : undefined,
    !destinationReady ? downstreamHandoffBlocker("destination_unavailable", "webhookDestinationIds", "A verified or configured webhook destination is required before delivery handoff.", true) : undefined,
    entitlementDenied ? downstreamHandoffBlocker("entitlement_denied", "entitlement", "Entitlement policy blocks downstream alert handoff.", true) : undefined,
    input.expectedWorkflowEventCount !== undefined && input.expectedWorkflowEventCount !== eventCount ? downstreamHandoffBlocker("stale_workflow", "expectedWorkflowEventCount", "Workflow event count changed; reload before replaying downstream handoff.", true) : undefined,
    duplicateReplay ? downstreamHandoffBlocker("duplicate_replay", "replayMarker", "Delivered replay has already been recorded for this dedupe key.", false) : undefined,
    closedAlert ? downstreamHandoffBlocker("closed_alert", "workflowStatus", "Closed alerts remain visible for audit but are not eligible for new downstream replay.", true) : undefined,
    suppressedAlert ? downstreamHandoffBlocker("suppressed_alert", "workflowStatus", "Suppressed alerts remain visible for audit but are not eligible for delivery handoff.", true) : undefined,
    !actorAllowed ? downstreamHandoffBlocker("revoked_actor", "actor", "Actor is not an active organization member for this alert.", false) : undefined,
    !activeSourceMatch ? downstreamHandoffBlocker("no_active_source_match", "sourceFamily", "No active source currently backs this alert source family.", true) : undefined
  ].filter(Boolean) as DwmAlertDownstreamHandoff["blockers"];
  const blockerCodes = uniqueStrings(blockers.map((blocker) => blocker.code)) as DwmAlertDownstreamHandoffBlockerCode[];
  const alertId = alert?.id ? String(alert.id) : undefined;
  const tenantId = alert?.tenantId ?? workflow.tenantId ?? webhook.tenantId;
  const persistedDeliveryBlockerCodes = asStringArray(context.blockerCodes).filter((code): code is DwmDeliveryReadinessBlockerCode => [
    "missing_org_ref",
    "missing_capture_evidence",
    "case_route_unavailable",
    "delivery_disabled",
    "replay_already_delivered",
    "duplicate_delivered_dedupe",
    "entitlement_denied"
  ].includes(code));
  const deliverySelectionBlockerCodes = uniqueStrings([
    ...blockerCodes.filter((code) => [
      "org_mismatch",
      "archived_org",
      "retired_watchlist",
      "disabled_destination",
      "destination_unavailable",
      "entitlement_denied",
      "stale_workflow",
      "duplicate_replay",
      "closed_alert",
      "suppressed_alert",
      "revoked_actor",
      "no_active_source_match"
    ].includes(code)),
    ...persistedDeliveryBlockerCodes,
    delivered ? "replay_already_delivered" : undefined,
    delivered ? "duplicate_delivered_dedupe" : undefined,
    !selectedCaptureIds.length || evidenceCount === 0 ? "missing_capture_evidence" : undefined,
    webhookDestinationIds.length === 0 ? "delivery_disabled" : undefined
  ].filter(Boolean).map(String)) as Array<DwmAlertDownstreamHandoffBlockerCode | DwmDeliveryReadinessBlockerCode>;
  const deliverySelectionReady = deliverySelectionBlockerCodes.length === 0 && enabledWebhookDestinationIds.length > 0;
  const deliveryIdempotencyKey = alertId && deliveryDedupeKey ? stableId("dwm_delivery_handoff", `${orgId ?? tenantId}:${alertId}:${deliveryDedupeKey}`) : undefined;
  const createdEventCaptureIds = uniqueStrings(asStringArray(createdEvent?.captureIds ?? selectedCaptureIds));
  const createdEventDispatchBlockerCodes = uniqueStrings([
    ...deliverySelectionBlockerCodes,
    !createdEvent?.eventId ? "missing_alert" : undefined,
    !createdEventCaptureIds.length || evidenceCount === 0 ? "missing_capture_evidence" : undefined
  ].filter(Boolean).map(String)) as Array<DwmAlertDownstreamHandoffBlockerCode | DwmDeliveryReadinessBlockerCode>;
  const createdEventDispatchReady = Boolean(createdEvent?.eventId) && createdEventDispatchBlockerCodes.length === 0;
  const replayMarker = context.replayMarker ? String(context.replayMarker) : undefined;
  const replayIdempotencyKey = alertId && replayMarker ? stableId("dwm_replay_handoff", `${orgId ?? tenantId}:${alertId}:${replayMarker}:${eventCount}`) : undefined;
  return {
    schemaVersion: "dwm.alert_downstream_handoff.v1",
    handoffId: stableId("dwm_downstream_handoff", `${tenantId ?? "missing"}:${orgId ?? "missing"}:${alertId ?? "missing"}:${deliveryDedupeKey}:${eventCount}`),
    alertId,
    alertDetailPath,
    tenantId,
    organizationId: orgId,
    ready: blockerCodes.length === 0,
    sourceFamily: context.sourceFamily ?? alert?.sourceFamily ?? workflow.sourceFamily ?? webhook.sourceFamily,
    watchlist: {
      watchlistIds,
      watchlistItemIds,
      alertGeneratorKeys,
      alertGenerationRefs
    },
    evidence: {
      evidenceCount,
      selectedCaptureIds,
      captureIds,
      sourceIds,
      duplicateEvidenceSuppression: context.duplicateEvidenceSuppression ?? webhook.duplicateEvidenceSuppression,
      provenanceGeneratedAt: alert?.provenance?.generatedAt,
      matchBasis: alert?.provenance?.matchBasis,
      generationEvidenceWindow
    },
    matchReason,
    dedupe: {
      alertDedupeKey: alert?.dedupeKey ?? alert?.webhookDelivery?.dedupeKey,
      deliveryDedupeKey,
      replayMarker: context.replayMarker
    },
    createdEvent,
    updateReceipt: updatedEvent ? {
      schemaVersion: "dwm.alert_update_receipt.v1",
      ready: updatedEvent.addedCaptureIds.length > 0 && selectedCaptureIds.length > 0,
      eventId: updatedEvent.eventId,
      eventType: "dwm.alert.updated",
      alertId,
      tenantId,
      organizationId: orgId,
      addedCaptureIds: updatedEvent.addedCaptureIds,
      removedCaptureIds: updatedEvent.removedCaptureIds,
      selectedCaptureIds,
      evidenceCount: updatedEvent.evidenceCount,
      previousEvidenceCount: updatedEvent.previousEvidenceCount,
      workflowEventCount: eventCount,
      caseId: context.caseId ?? alert?.caseId,
      casePath,
      deliveryDedupeKey: updatedEvent.deliveryDedupeKey ?? deliveryDedupeKey,
      alertGenerationRefs,
      blockerCodes: uniqueStrings([
        ...(!updatedEvent.addedCaptureIds.length ? ["missing_capture_evidence"] : []),
        ...(!selectedCaptureIds.length ? ["missing_capture_evidence"] : [])
      ]) as Array<DwmAlertDownstreamHandoffBlockerCode | DwmDeliveryReadinessBlockerCode>
    } : undefined,
    workflowVersion: {
      eventCount,
      updatedAt: alert?.updatedAt,
      expectedEventCount: input.expectedWorkflowEventCount,
      replayCount: Number(alert?.replayCount ?? 0),
      lastReplayedAt: alert?.lastReplayedAt
    },
    workflowTransitions: {
      schemaVersion: "dwm.alert_workflow_transition_summary.v1",
      actions: uniqueStrings(transitionEvents.map((event) => event.action)) as DwmAlertDownstreamHandoff["workflowTransitions"]["actions"],
      lastEventAt: transitionEvents.at(-1)?.at,
      caseLinked: transitionEvents.some((event) => Boolean(event.caseId || event.casePath)) || Boolean(caseIdCandidate || alert?.caseId),
      closed: transitionEvents.some((event) => event.action === "closed") || closedAlert,
      suppressed: transitionEvents.some((event) => event.action === "suppressed") || suppressedAlert
    },
    workflowDecision: {
      value: alert?.workflowDecision,
      rationale: alert?.decisionRationale ?? alert?.workflowRationale,
      falsePositiveReason: alert?.falsePositiveReason,
      suppressionReason: alert?.suppressionReason,
      decidedAt: alert?.decisionAt,
      decidedBy: alert?.decisionBy
    },
    caseReadiness: {
      ready: caseReady,
      route: "/v1/cases",
      caseIdCandidate,
      caseId: context.caseId ?? alert?.caseId,
      casePath,
      idempotencyKey: alertId && caseIdCandidate ? stableId("dwm_case_handoff", `${orgId ?? tenantId}:${alertId}:${caseIdCandidate}`) : undefined
    },
    deliveryReadiness: {
      ready: destinationReady && !duplicateReplay && !entitlementDenied && !archivedOrg && !closedAlert && !suppressedAlert && activeSourceMatch,
      webhookDestinationIds,
      destinationReady,
      deliveryHistoryRefs,
      lastDeliveryStatus: context.lastDeliveryStatus ?? lastDelivery?.status,
      lastDeliveryAt: context.lastDeliveryAt ?? lastDelivery?.attemptedAt,
      idempotencyKey: deliveryIdempotencyKey
    },
    deliverySelection: {
      schemaVersion: "dwm.alert_delivery_selection.v1",
      ready: deliverySelectionReady,
      selectedWebhookDestinationId: deliverySelectionReady ? enabledWebhookDestinationIds[0] : undefined,
      webhookDestinationIds,
      enabledWebhookDestinationIds,
      disabledWebhookDestinationIds: disabledDestinationIds.filter((id) => webhookDestinationIds.includes(id)),
      selectedCaptureIds,
      sourceFamily: context.sourceFamily ?? alert?.sourceFamily ?? workflow.sourceFamily ?? webhook.sourceFamily,
      deliveryDedupeKey,
      idempotencyKey: deliveryIdempotencyKey,
      blockerCodes: deliverySelectionBlockerCodes
    },
    createdEventDispatch: {
      schemaVersion: "dwm.alert_created_event_dispatch.v1",
      ready: createdEventDispatchReady,
      eventId: createdEvent?.eventId,
      eventType: createdEvent?.eventType ?? "dwm.alert.created",
      alertId,
      tenantId,
      organizationId: orgId,
      sourceFamily: createdEvent?.sourceFamily ?? context.sourceFamily ?? alert?.sourceFamily ?? workflow.sourceFamily ?? webhook.sourceFamily,
      captureIds: createdEventCaptureIds,
      selectedCaptureIds,
      deliveryDedupeKey,
      idempotencyKey: createdEvent?.eventId && deliveryDedupeKey ? stableId("dwm_alert_created_dispatch", `${orgId ?? tenantId}:${createdEvent.eventId}:${deliveryDedupeKey}:${eventCount}`) : undefined,
      workflowEventCount: eventCount,
      alertGenerationRefs,
      blockerCodes: createdEventDispatchBlockerCodes
    },
    lifecycle: {
      organizationStatus,
      retiredWatchlistIds,
      disabledDestinationIds,
      alertStatus,
      assignedOwner: alert?.assignedOwner ? String(alert.assignedOwner) : undefined,
      actorAllowed,
      activeSourceMatch
    },
    replay: {
      idempotent: true,
      duplicate: duplicateReplay,
      canReplay: !duplicateReplay
        && !blockerCodes.includes("stale_workflow")
        && !blockerCodes.includes("org_mismatch")
        && !blockerCodes.includes("entitlement_denied")
        && !blockerCodes.includes("archived_org")
        && !blockerCodes.includes("retired_watchlist")
        && !blockerCodes.includes("disabled_destination")
        && !blockerCodes.includes("closed_alert")
        && !blockerCodes.includes("suppressed_alert")
        && !blockerCodes.includes("revoked_actor")
        && !blockerCodes.includes("no_active_source_match"),
      replayMarker,
      nextReplayIdempotencyKey: replayIdempotencyKey
    },
    replayReceipt: {
      schemaVersion: "dwm.alert_replay_receipt.v1",
      ready: !duplicateReplay && blockerCodes.length === 0 && deliverySelectionBlockerCodes.length === 0,
      alertId,
      tenantId,
      organizationId: orgId,
      replayMarker,
      replayCount: Number(alert?.replayCount ?? 0),
      idempotencyKey: replayIdempotencyKey,
      workflowEventCount: eventCount,
      caseIdCandidate,
      caseId: context.caseId ?? alert?.caseId,
      casePath,
      deliveryDedupeKey,
      selectedCaptureIds,
      watchlistItemIds,
      alertGenerationRefs,
      blockerCodes: uniqueStrings([
        ...blockerCodes,
        ...deliverySelectionBlockerCodes
      ]) as Array<DwmAlertDownstreamHandoffBlockerCode | DwmDeliveryReadinessBlockerCode>
    },
    customerProof: {
      schemaVersion: "dwm.customer_alert_proof.v1",
      blockerCodes: proof?.blockerCodes ?? []
    },
    blockerCodes,
    blockers,
    generatedAt
  };
}

function downstreamHandoffBlocker(code: DwmAlertDownstreamHandoffBlockerCode, field: string, detail: string, recoverable: boolean): DwmAlertDownstreamHandoff["blockers"][number] {
  return { code, field, detail, recoverable };
}

function effectiveLifecycleAlertStatus(alert: any): string {
  if (alert?.workflowStatus === "closed") return "closed";
  if (alert?.workflowStatus === "suppressed") return "suppressed";
  if (alert?.reviewState === "resolved") return "resolved";
  if (alert?.reviewState === "false_positive" || alert?.deliveryState === "muted") return "suppressed";
  return String(alert?.workflowStatus ?? alert?.reviewState ?? "new");
}

export function buildDwmAlertRetentionAudit(input: {
  alert?: any;
  downstreamHandoff?: DwmAlertDownstreamHandoff;
  deliveries?: Array<Record<string, any>>;
  generatedAt?: string;
}): DwmAlertRetentionAudit {
  const alert = input.alert;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const downstreamHandoff = input.downstreamHandoff ?? buildDwmAlertDownstreamHandoff({ alert, deliveries: input.deliveries, generatedAt });
  const eventCount = downstreamHandoff.workflowVersion.eventCount;
  const evidenceCount = downstreamHandoff.evidence.evidenceCount;
  const deliveryHistoryRefs = downstreamHandoff.deliveryReadiness.deliveryHistoryRefs;
  const hasCaseLink = Boolean(downstreamHandoff.caseReadiness.caseId || downstreamHandoff.caseReadiness.caseIdCandidate || downstreamHandoff.caseReadiness.casePath);
  const lifecycleRetainedCodes = downstreamHandoff.blockerCodes.filter((code) => [
    "archived_org",
    "retired_watchlist",
    "disabled_destination",
    "closed_alert",
    "suppressed_alert",
    "no_active_source_match"
  ].includes(code));
  const reasonCodes = uniqueStrings([
    ...downstreamHandoff.blockerCodes,
    evidenceCount > 0 ? "has_evidence" : undefined,
    eventCount > 0 ? "has_workflow_history" : undefined,
    deliveryHistoryRefs.length > 0 ? "has_delivery_history" : undefined,
    hasCaseLink ? "has_case_link" : undefined,
    downstreamHandoff.customerProof.blockerCodes.length || evidenceCount > 0 ? "customer_proof_required" : undefined
  ].filter(Boolean).map(String)) as DwmAlertRetentionAudit["reasonCodes"];
  const terminal = downstreamHandoff.blockerCodes.includes("closed_alert") || downstreamHandoff.blockerCodes.includes("suppressed_alert");
  const lifecycleBlocked = lifecycleRetainedCodes.length > 0;
  const deleteEligible = Boolean(alert) && lifecycleBlocked && !evidenceCount && !eventCount && !deliveryHistoryRefs.length && !hasCaseLink;
  const purgeBlockedReasons = uniqueStrings([
    evidenceCount > 0 ? "evidence_refs_present" : undefined,
    downstreamHandoff.evidence.captureIds.length > 0 ? "capture_provenance_present" : undefined,
    downstreamHandoff.dedupe.alertDedupeKey || downstreamHandoff.dedupe.deliveryDedupeKey ? "dedupe_keys_present" : undefined,
    eventCount > 0 ? "workflow_history_present" : undefined,
    deliveryHistoryRefs.length > 0 ? "delivery_history_present" : undefined,
    hasCaseLink ? "case_linkage_present" : undefined,
    downstreamHandoff.customerProof.blockerCodes.length || evidenceCount > 0 ? "customer_proof_required" : undefined
  ].filter(Boolean).map(String));
  return {
    schemaVersion: "dwm.alert_retention_audit.v1",
    alertId: downstreamHandoff.alertId,
    tenantId: downstreamHandoff.tenantId,
    organizationId: downstreamHandoff.organizationId,
    retentionState: !alert
      ? "review_for_cleanup"
      : lifecycleBlocked
        ? "lifecycle_blocked_retained"
        : terminal || eventCount > 0 || deliveryHistoryRefs.length > 0
          ? "audit_retained"
          : "active_monitoring",
    reasonCodes,
    preserve: {
      alertRecord: true,
      evidenceRefs: evidenceCount > 0 || downstreamHandoff.evidence.selectedCaptureIds.length > 0,
      provenance: downstreamHandoff.evidence.captureIds.length > 0 || Boolean(downstreamHandoff.evidence.matchBasis),
      dedupeKeys: Boolean(downstreamHandoff.dedupe.alertDedupeKey || downstreamHandoff.dedupe.deliveryDedupeKey),
      workflowHistory: eventCount > 0,
      deliveryHistory: deliveryHistoryRefs.length > 0,
      caseLinkage: hasCaseLink,
      customerProof: evidenceCount > 0 || downstreamHandoff.customerProof.blockerCodes.length > 0
    },
    cleanup: {
      deleteEligible,
      reviewRequired: lifecycleBlocked || terminal,
      purgeBlockedReasons,
      retiredWatchlistIds: downstreamHandoff.lifecycle.retiredWatchlistIds,
      disabledDestinationIds: downstreamHandoff.lifecycle.disabledDestinationIds
    },
    helpdeskAudit: {
      redacted: true,
      safeFields: ["alertId", "organizationId", "tenantId", "retentionState", "reasonCodes", "caseReadiness.caseId", "deliveryReadiness.deliveryHistoryRefs", "evidence.selectedCaptureIds", "dedupe.deliveryDedupeKey"],
      auditRoute: downstreamHandoff.alertId ? `/v1/dwm/alerts/${encodeURIComponent(downstreamHandoff.alertId)}` : undefined,
      summary: retentionSummary({ terminal, lifecycleBlocked, evidenceCount, eventCount, deliveryHistoryRefs, hasCaseLink })
    },
    generatedAt
  };
}

function retentionSummary(input: { terminal: boolean; lifecycleBlocked: boolean; evidenceCount: number; eventCount: number; deliveryHistoryRefs: string[]; hasCaseLink: boolean }): string {
  if (input.lifecycleBlocked) return "Alert is retained for audit because lifecycle cleanup blocks downstream replay or delivery.";
  if (input.terminal) return "Alert is retained because analyst workflow reached a terminal state.";
  if (input.deliveryHistoryRefs.length) return "Alert is retained because delivery history exists.";
  if (input.hasCaseLink || input.eventCount) return "Alert is retained because analyst workflow or case linkage exists.";
  if (input.evidenceCount) return "Alert is retained because capture evidence and provenance exist.";
  return "Alert remains in active monitoring retention.";
}

function customerProofBlocker(code: DwmCustomerProofBlockerCode, field: string, detail: string, recoverable: boolean): DwmAlertCustomerProofHandoffRow["typedBlockers"][number] {
  return { code, field, detail, recoverable };
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)].filter(Boolean);
}

function asRecordArray(value: unknown): Array<Record<string, any>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, any> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}

function uniqueAlertGenerationRefs(refs: Array<Record<string, any>>): Array<Record<string, any>> {
  const byKey = new Map<string, Record<string, any>>();
  for (const ref of refs) {
    const key = [
      ref.dedupe?.key,
      ref.organizationId,
      ref.tenantId,
      ref.watchlistItemId,
      ref.termFamily,
      ref.normalizedTerm
    ].filter(Boolean).map(String).join(":") || JSON.stringify(ref);
    if (!byKey.has(key)) byKey.set(key, ref);
  }
  return [...byKey.values()];
}

function buildGenerationReadinessBlockers(input: {
  watchlists: RuntimeDwmWatchlist[];
  organizationId?: string;
  plan: DwmAlertGenerationPlan;
  sources: SourceRecord[];
  captureRefCount: number;
  candidateIdsMissingRoute: string[];
  productDedupePatched: boolean;
}): DwmAlertGenerationBlocker[] {
  const blockers: DwmAlertGenerationBlocker[] = [];
  if (input.plan.blockedWatchlists.length) {
    blockers.push(generationBlocker({
      code: "blocked_watchlist_scope",
      field: "watchlists.organizationId",
      detail: "Resolve blocked watchlists before rebuild so org-scoped terms cannot leak into tenant-wide alerts.",
      recoverable: true,
      watchlistIds: input.plan.blockedWatchlists.map((watchlist) => watchlist.watchlistId)
    }));
  }
  if (input.organizationId && !input.watchlists.some((watchlist) => watchlist.organizationId === input.organizationId)) {
    blockers.push(generationBlocker({
      code: "no_org_export",
      field: "orgWatchlistTerms",
      detail: "No org watchlist export is available for customer alert generation.",
      recoverable: true
    }));
  }
  if (input.organizationId && orgExportExpected(input.watchlists) && !input.plan.candidates.some((candidate) => candidate.alertGeneratorKeys.length > 0)) {
    blockers.push(generationBlocker({
      code: "org_export_unavailable",
      field: "activeTerms.alertGenerationRef",
      detail: "Org watchlist export did not provide active alert generation references for this rebuild.",
      recoverable: true,
      watchlistIds: input.watchlists.filter((watchlist) => watchlist.organizationId === input.organizationId).map((watchlist) => watchlist.id)
    }));
  }
  const entitlementDeniedWatchlists = input.watchlists
    .filter((watchlist) => watchlist.organizationId === input.organizationId && watchlist.orgMembershipContext?.canGenerateAlerts === false)
    .map((watchlist) => watchlist.id);
  const orgLifecycleBlockedWatchlists = input.watchlists
    .filter((watchlist) => watchlist.organizationId === input.organizationId && watchlist.orgMembershipContext)
    .flatMap((watchlist) => (watchlist.orgMembershipContext?.alertGenerationBlockerCodes ?? [])
      .filter((code) => code === "org_archived" || code === "org_deleted" || code === "member_revoked" || code === "role_not_allowed")
      .map((code) => ({ code: code as "org_archived" | "org_deleted" | "member_revoked" | "role_not_allowed", watchlistId: watchlist.id })));
  for (const code of uniqueStrings(orgLifecycleBlockedWatchlists.map((row) => row.code))) {
    const lifecycleCode = code as "org_archived" | "org_deleted" | "member_revoked" | "role_not_allowed";
    blockers.push(generationBlocker({
      code: lifecycleCode,
      field: lifecycleCode.startsWith("org_") ? "organization.status" : "orgMembershipContext.visibility",
      detail: generationLifecycleBlockerDetail(lifecycleCode),
      recoverable: lifecycleCode !== "org_deleted",
      watchlistIds: orgLifecycleBlockedWatchlists.filter((row) => row.code === lifecycleCode).map((row) => row.watchlistId)
    }));
  }
  if (entitlementDeniedWatchlists.length) {
    blockers.push(generationBlocker({
      code: "entitlement_denied",
      field: "orgMembershipContext.canGenerateAlerts",
      detail: "Org entitlement currently blocks alert generation; rebuild must not mutate alerts.",
      recoverable: true,
      watchlistIds: entitlementDeniedWatchlists
    }));
  }
  if (!input.watchlists.some((watchlist) => watchlist.organizationId === input.organizationId && watchlist.status === "active" && watchlist.terms.length > 0)) {
    blockers.push(generationBlocker({
      code: "no_active_watchlist_terms",
      field: "watchlists.terms",
      detail: "No active watchlist terms are available for this org rebuild.",
      recoverable: true
    }));
  }
  if (input.plan.candidateCount === 0) {
    blockers.push(generationBlocker({
      code: "org_export_unavailable",
      field: "watchlists.terms",
      detail: "No active watchlist candidates are ready for alert generation.",
      recoverable: true
    }));
  }
  if (input.plan.candidateCount > 0 && input.captureRefCount === 0) {
    blockers.push(generationBlocker({
      code: "no_matching_captures",
      field: "captures",
      detail: "No collected captures currently match active watchlist terms.",
      recoverable: true,
      candidateIds: input.plan.candidates.map((candidate) => candidate.id)
    }));
  }
  const missingEvidenceCandidates = input.plan.candidates.filter((candidate) => candidate.captureRefs.length === 0);
  if (missingEvidenceCandidates.length) {
    blockers.push(generationBlocker({
      code: "missing_evidence",
      field: "candidate.captureRefs",
      detail: "One or more alert generation candidates have no capture evidence.",
      recoverable: true,
      candidateIds: missingEvidenceCandidates.map((candidate) => candidate.id)
    }));
  }
  const inactiveFamilies = inactiveCandidateSourceFamilies(input.plan.candidates, input.sources);
  if (inactiveFamilies.length) {
    blockers.push(generationBlocker({
      code: "source_family_inactive",
      field: "sources.status",
      detail: "A matching capture exists, but its source family has no active source row.",
      recoverable: true,
      sourceFamilies: inactiveFamilies
    }));
  }
  const staleFamilies = staleCandidateSourceFamilies(input.plan.candidates, input.sources);
  if (staleFamilies.length) {
    blockers.push(generationBlocker({
      code: "source_family_stale",
      field: "sources.status",
      detail: "A matching capture exists, but its source family is marked stale and needs refreshed collection before customer alert generation.",
      recoverable: true,
      sourceFamilies: staleFamilies
    }));
  }
  if (input.candidateIdsMissingRoute.length) {
    blockers.push(generationBlocker({
      code: "case_route_unavailable",
      field: "webhookDestinationIds",
      detail: "Generated alerts have no delivery route yet; case/webhook handoff remains blocked.",
      recoverable: true,
      candidateIds: input.candidateIdsMissingRoute
    }));
  }
  if (!input.productDedupePatched) {
    blockers.push(generationBlocker({
      code: "product_dedupe_pending",
      field: "dwmProduct.dedupeKey",
      detail: "Product alert dedupe/enrichment patch is still pending in dirty dwmProduct.ts.",
      recoverable: true
    }));
  }
  return blockers;
}

function buildDwmZeroAlertProof(input: {
  counts: DwmAlertGenerationReadiness["counts"];
  blockerCodes: DwmAlertGenerationBlockerCode[];
  typedBlockers: DwmAlertGenerationBlocker[];
  sourceFamilyCoverage: DwmAlertGenerationReadiness["sourceFamilyCoverage"];
  sourceFamilyGaps: DwmAlertGenerationReadiness["sourceFamilyGaps"];
  watchlistIds: string[];
  candidates: DwmAlertGenerationCandidate[];
  candidateIdsMissingRoute: string[];
}): DwmZeroAlertProof {
  const state = zeroAlertState(input);
  const matchedSourceFamilyCount = input.sourceFamilyCoverage.filter((row) => row.captureRefCount > 0).length;
  const expectedAlertDelta = state === "alerts_expected" || state === "blocked_route" ? matchedSourceFamilyCount : 0;
  const zeroAlert = expectedAlertDelta === 0;
  return {
    schemaVersion: "dwm.zero_alert_proof.v1",
    zeroAlert,
    state,
    expectedAlertDelta,
    blockerCodes: input.blockerCodes,
    blockers: input.typedBlockers,
    counts: {
      activeWatchlists: input.counts.activeWatchlists,
      candidateCount: input.counts.candidateCount,
      captureRefCount: input.counts.captureRefCount,
      matchedCandidateCount: input.counts.matchedCandidateCount,
      unmatchedCandidateCount: input.counts.unmatchedCandidateCount
    },
    sourceFamilyCoverage: input.sourceFamilyCoverage,
    sourceFamilyGaps: input.sourceFamilyGaps,
    watchlistIds: input.watchlistIds,
    watchlistTerms: input.candidates.map((candidate) => ({
      candidateId: candidate.id,
      watchlistIds: candidate.watchlistIds,
      watchlistItemIds: candidate.watchlistItemIds,
      term: candidate.normalizedTerm,
      kind: candidate.term.kind,
      organizationId: candidate.organizationId,
      hasMatchingCaptures: candidate.captureRefs.length > 0,
      sourceFamilies: candidate.sourceFamilies,
      captureRefCount: candidate.captureRefs.length
    })),
    candidateIdsMissingRoute: input.candidateIdsMissingRoute,
    routes: {
      readiness: "/v1/dwm/alerts/readiness",
      rebuild: "/v1/dwm/alerts/rebuild",
      alerts: "/v1/dwm/alerts"
    },
    nextAction: zeroAlertNextAction(state)
  };
}

function zeroAlertState(input: {
  counts: DwmAlertGenerationReadiness["counts"];
  blockerCodes: DwmAlertGenerationBlockerCode[];
}): DwmZeroAlertProof["state"] {
  const codes = new Set(input.blockerCodes);
  if (input.counts.matchedCandidateCount > 0 && input.counts.captureRefCount > 0 && !codes.size) return "alerts_expected";
  if (codes.has("org_archived") || codes.has("org_deleted") || codes.has("member_revoked") || codes.has("role_not_allowed")) return "blocked_org_lifecycle";
  if (codes.has("entitlement_denied") || codes.has("org_export_unavailable") || codes.has("no_org_export")) return "blocked_entitlement";
  if (codes.has("source_family_stale")) return "blocked_stale_source";
  if (codes.has("source_family_inactive")) return "blocked_inactive_source";
  if (codes.has("no_active_watchlist_terms") || input.counts.activeWatchlists === 0 || input.counts.candidateCount === 0) return "blocked_no_watchlist";
  if (codes.has("no_matching_captures")) return "blocked_no_matching_capture";
  if (codes.has("missing_evidence")) return "blocked_missing_evidence";
  if (codes.has("case_route_unavailable") || codes.has("webhook_destination_not_verified")) return "blocked_route";
  return "blocked_unknown";
}

function zeroAlertNextAction(state: DwmZeroAlertProof["state"]): string {
  if (state === "alerts_expected") return "Run alert rebuild and verify persisted alert delta.";
  if (state === "blocked_org_lifecycle") return "Restore active organization/member/watchlist export lifecycle before rebuilding alerts.";
  if (state === "blocked_entitlement") return "Resolve organization entitlement or alert-generation export blockers.";
  if (state === "blocked_stale_source") return "Refresh stale source collection before rebuilding customer alerts.";
  if (state === "blocked_inactive_source") return "Activate an approved source family that matches the watchlist term.";
  if (state === "blocked_no_watchlist") return "Create or reactivate an org-scoped shared watchlist term.";
  if (state === "blocked_no_matching_capture") return "Add or collect a recent capture containing the active watchlist term.";
  if (state === "blocked_missing_evidence") return "Attach persisted evidence/capture references before customer delivery.";
  if (state === "blocked_route") return "Configure case and webhook delivery routes for matched alert candidates.";
  return "Inspect typed blockers before running another rebuild.";
}

function generationBlocker(input: DwmAlertGenerationBlocker): DwmAlertGenerationBlocker {
  return input;
}

function generationLifecycleBlockerDetail(code: "org_archived" | "org_deleted" | "member_revoked" | "role_not_allowed"): string {
  if (code === "org_archived") return "Organization lifecycle is archived; org watchlist exports remain auditable but must not generate new alerts.";
  if (code === "org_deleted") return "Organization lifecycle is deleted; org watchlist exports must not generate new alerts.";
  if (code === "member_revoked") return "Member access was revoked; org watchlist export cannot be used for member-scoped alert generation.";
  return "Member role is not allowed to export org watchlist terms for alert generation.";
}

function orgExportExpected(watchlists: RuntimeDwmWatchlist[]): boolean {
  return watchlists.some((watchlist) => Boolean(watchlist.orgMembershipContext) || Boolean(watchlist.orgWatchlistTerms?.length));
}

function inactiveCandidateSourceFamilies(candidates: DwmAlertGenerationCandidate[], sources: SourceRecord[]): string[] {
  const activeFamilies = new Set(
    sources
      .filter((source) => ["active", "approved", "canary"].includes(String((source as any).status ?? "").toLowerCase()))
      .map((source) => sourceFamilyFor(source, {} as RawCapture))
  );
  const staleFamilies = new Set(
    sources
      .filter((source) => isStaleSourceStatus((source as any).status))
      .map((source) => sourceFamilyFor(source, {} as RawCapture))
  );
  const candidateFamilies = uniqueStrings(candidates.flatMap((candidate) => candidate.captureRefs.map((ref) => ref.sourceFamily)));
  return candidateFamilies.filter((family) => !activeFamilies.has(family) && !staleFamilies.has(family));
}

function staleCandidateSourceFamilies(candidates: DwmAlertGenerationCandidate[], sources: SourceRecord[]): string[] {
  const staleFamilies = new Set(
    sources
      .filter((source) => isStaleSourceStatus((source as any).status))
      .map((source) => sourceFamilyFor(source, {} as RawCapture))
  );
  const candidateFamilies = uniqueStrings(candidates.flatMap((candidate) => candidate.captureRefs.map((ref) => ref.sourceFamily)));
  return candidateFamilies.filter((family) => staleFamilies.has(family));
}

function alertSourceFamilyActive(sources: SourceRecord[], sourceFamily: string): boolean {
  return sources.some((source) => ["active", "approved", "canary"].includes(String((source as any).status ?? "").toLowerCase()) && sourceFamilyFor(source, {} as RawCapture) === sourceFamily);
}

function isStaleSourceStatus(status: unknown): boolean {
  return ["stale", "expired", "outdated"].includes(String(status ?? "").toLowerCase());
}

export function buildDwmAlertWorkflowContext(input: {
  alert: DwmAlert;
  tenantId: string;
  organizationId?: string;
  watchlists?: RuntimeDwmWatchlist[];
  generationCandidate?: DwmAlertGenerationCandidate;
}) {
  const evidence = input.alert.evidence ?? [];
  const captureIds = uniqueStrings([
    ...asStringArray(input.alert.provenance?.captureIds),
    ...evidence.map((item) => item.provenance?.captureId ?? item.id).filter(Boolean).map(String)
  ]);
  const generationEvidenceWindow = normalizeGenerationEvidenceWindow(input.generationCandidate?.evidenceWindow) ?? normalizeGenerationEvidenceWindow({
    captureIds,
    sourceFamilies: [input.alert.sourceFamily],
    contentHashes: evidence.map((item) => item.contentHash).filter(Boolean),
    firstObservedAt: evidence.map((item) => item.observedAt ?? item.firstSeenAt).filter(Boolean).map(String).sort()[0],
    lastObservedAt: evidence.map((item) => item.observedAt ?? item.firstSeenAt).filter(Boolean).map(String).sort().at(-1)
  });
  const watchlists = input.watchlists ?? [];
  const watchlistIds = input.generationCandidate?.watchlistIds ?? watchlists.map((watchlist) => watchlist.id);
  const watchlistItemIds = input.generationCandidate?.watchlistItemIds ?? watchlists.flatMap((watchlist) => watchlistItemIdsFor(watchlist, input.alert.matchedTerm?.value));
  const dedupeKey = String(input.alert.dedupeKey ?? input.alert.webhookDelivery?.dedupeKey);
  const routedOrganizationId = input.organizationId ?? input.generationCandidate?.watchlistTermContexts?.[0]?.organizationId;
  const caseIdCandidate = stableId("case", `${input.tenantId}:${input.alert.id}`);
  const alertDetailPath = buildDwmAlertDetailPath(input.alert.id, {
    organizationId: routedOrganizationId,
    tenantId: input.tenantId,
    dedupeKey
  });
  return {
    tenantId: input.tenantId,
    organizationId: routedOrganizationId,
    visibilityPolicy: input.generationCandidate?.visibilityPolicy,
    membershipContext: input.generationCandidate?.membershipContext,
    generationCandidateId: input.generationCandidate?.id,
    duplicateEvidenceSuppression: duplicateEvidenceSuppressionForCandidate(input.generationCandidate),
    caseIdCandidate,
    watchlistIds,
    watchlistItemIds,
    watchlistTermContexts: input.generationCandidate?.watchlistTermContexts ?? [],
    alertGenerationRefs: input.generationCandidate?.alertGenerationRefs ?? [],
    alertGeneratorKeys: input.generationCandidate?.alertGeneratorKeys ?? [],
    matchedTermCategory: input.generationCandidate?.watchlistTermContexts?.find((term) => term.normalizedTerm === input.alert.matchedTerm?.value?.toLowerCase() || term.value.toLowerCase() === input.alert.matchedTerm?.value?.toLowerCase())?.category,
    matchedTerm: input.alert.matchedTerm,
    actor: input.alert.actor,
    entity: {
      company: input.alert.company,
      artifactType: input.alert.artifactType,
      matchedTerm: input.alert.matchedTerm
    },
    provenance: input.alert.provenance,
    generationEvidenceWindow,
    watchlistProvenance: input.generationCandidate?.watchlistTermContexts?.map((term) => ({
      watchlistId: term.watchlistId,
      watchlistItemId: term.watchlistItemId,
      organizationId: term.organizationId,
      tenantId: term.tenantId,
      termFamily: term.termFamily,
      status: term.status,
      lifecycleReason: term.lifecycleReason,
      lifecycleRequestId: term.lifecycleRequestId,
      alertGeneratorKey: term.alertGeneratorKey
    })) ?? [],
    sourceFamily: input.alert.sourceFamily,
    captureIds,
    primaryCaptureId: captureIds[0],
    evidenceCount: evidence.length,
    dedupeKey,
    recommendedRoute: input.alert.recommendedRoute ?? input.alert.webhookDelivery?.recommendedRoute,
    alertDetailPath,
    casePath: `/v1/cases/${encodeURIComponent(caseIdCandidate)}?alertId=${encodeURIComponent(input.alert.id)}&dedupeKey=${encodeURIComponent(dedupeKey)}`,
    webhookDestinationIds: input.generationCandidate?.webhookDestinationIds ?? watchlists.map((watchlist) => watchlist.webhookDestinationId).filter(Boolean),
    hasWebhookRoute: input.generationCandidate?.hasWebhookRoute ?? watchlists.some((watchlist) => Boolean(watchlist.webhookDestinationId || watchlist.webhookUrl))
  };
}

function buildDwmAlertDetailPath(alertId: string, input: { organizationId?: string; tenantId?: string; dedupeKey?: string }) {
  const params = new URLSearchParams();
  if (input.organizationId) params.set("organizationId", input.organizationId);
  else if (input.tenantId) params.set("tenantId", input.tenantId);
  if (input.dedupeKey) params.set("dedupeKey", input.dedupeKey);
  const query = params.toString();
  return `/v1/dwm/alerts/${encodeURIComponent(alertId)}${query ? `?${query}` : ""}`;
}

export function buildDwmAlertSourceProvenanceSummary(input: {
  alert: Record<string, any>;
  tenantId?: string;
  organizationId?: string;
  workflowContext?: Record<string, any>;
}): DwmAlertSourceProvenanceSummary {
  const alert = input.alert ?? {};
  const workflowContext = input.workflowContext ?? alert.workflowContext ?? {};
  const evidence = Array.isArray(alert.evidence) ? alert.evidence : [];
  const generationEvidenceWindow = normalizeGenerationEvidenceWindow(
    workflowContext.generationEvidenceWindow ?? alert.webhookContext?.generationEvidenceWindow ?? alert.deliveryReadinessContext?.generationEvidenceWindow
  );
  const observedAt = uniqueStrings(evidence.map((item: any) => item.observedAt ?? item.firstSeenAt).filter(Boolean).map(String)).sort();
  const captureIds = uniqueStrings([
    ...asStringArray(alert.provenance?.captureIds),
    ...asStringArray(workflowContext.captureIds),
    ...evidence.map((item: any) => item.provenance?.captureId ?? item.id).filter(Boolean).map(String)
  ]);
  const sourceFamilies = uniqueStrings([
    ...asStringArray(alert.sourceFamily),
    ...asStringArray(alert.provenance?.sourceFamilies),
    ...evidence.map((item: any) => item.sourceFamily).filter(Boolean).map(String)
  ]);
  const contentHashes = uniqueStrings(evidence.map((item: any) => item.contentHash).filter(Boolean).map(String));
  const evidenceExcerpts = buildDwmAlertEventEvidenceExcerpts(alert);
  return {
    schemaVersion: "dwm.alert_source_provenance.v1",
    alertId: alert.id ? String(alert.id) : undefined,
    tenantId: input.tenantId ?? alert.tenantId ?? workflowContext.tenantId,
    organizationId: input.organizationId ?? alert.organizationId ?? workflowContext.organizationId,
    sourceFamily: alert.sourceFamily ? String(alert.sourceFamily) : undefined,
    sourceFamilies,
    captureIds,
    sourceIds: uniqueStrings([
      ...asStringArray(alert.provenance?.sourceIds),
      ...evidence.map((item: any) => item.provenance?.sourceId ?? item.sourceId).filter(Boolean).map(String)
    ]),
    contentHashes,
    evidenceCount: evidence.length,
    firstObservedAt: observedAt[0] ?? generationEvidenceWindow?.firstObservedAt,
    lastObservedAt: observedAt.at(-1) ?? generationEvidenceWindow?.lastObservedAt,
    recommendedRoute: alert.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute ?? workflowContext.recommendedRoute,
    confidenceReasoning: uniqueStrings(asStringArray(alert.confidenceReasoning)),
    provenance: {
      matchBasis: alert.provenance?.matchBasis,
      generatedAt: alert.provenance?.generatedAt,
      metadataOnly: alert.provenance?.metadataOnly
    },
    provenanceGaps: buildDwmAlertProvenanceGaps(evidenceExcerpts),
    evidenceExcerpts,
    generationEvidenceWindow
  };
}

export function buildDwmAlertMatchReason(input: {
  alert: Record<string, any>;
  tenantId?: string;
  organizationId?: string;
  workflowContext?: Record<string, any>;
}): DwmAlertMatchReason {
  const alert = input.alert ?? {};
  const workflowContext = input.workflowContext ?? {};
  const evidence = Array.isArray(alert.evidence) ? alert.evidence : [];
  const captureIds = uniqueStrings([
    ...asStringArray(workflowContext.captureIds),
    ...asStringArray(alert.provenance?.captureIds),
    ...evidence.map((item: any) => item.provenance?.captureId ?? item.id).filter(Boolean).map(String)
  ]);
  const sourceIds = uniqueStrings([
    ...asStringArray(alert.provenance?.sourceIds),
    ...evidence.map((item: any) => item.provenance?.sourceId ?? item.sourceId).filter(Boolean).map(String)
  ]);
  const matchedTerm = alert.matchedTerm ?? workflowContext.matchedTerm;
  const matchedValue = matchedTerm?.value ? String(matchedTerm.value) : undefined;
  const sourceFamily = alert.sourceFamily ?? workflowContext.sourceFamily;
  const matchBasis = alert.provenance?.matchBasis;
  const matchType = alert.matchContext?.matchType;
  const matchedFieldHints = uniqueStrings(asStringArray(alert.matchContext?.matchedFieldHints));
  const watchlistIds = uniqueStrings(asStringArray(workflowContext.watchlistIds ?? alert.watchlistIds));
  const watchlistItemIds = uniqueStrings(asStringArray(workflowContext.watchlistItemIds ?? alert.watchlistItemIds));
  const recommendedRoute = alert.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute ?? workflowContext.recommendedRoute;
  const evidenceCount = Number(workflowContext.evidenceCount ?? evidence.length ?? 0);
  const confidenceReasoning = uniqueStrings(asStringArray(alert.confidenceReasoning));
  const reasonParts = [
    matchedValue ? `Watchlist term ${matchedValue}` : "Watchlist term",
    matchBasis ? `matched by ${matchBasis}` : "matched capture evidence",
    sourceFamily ? `from ${sourceFamily}` : undefined,
    captureIds.length ? `across ${captureIds.length} capture${captureIds.length === 1 ? "" : "s"}` : undefined,
    recommendedRoute ? `route ${recommendedRoute}` : undefined
  ].filter(Boolean);
  return {
    schemaVersion: "dwm.alert_match_reason.v1",
    alertId: alert.id ? String(alert.id) : undefined,
    tenantId: input.tenantId ?? alert.tenantId ?? workflowContext.tenantId,
    organizationId: input.organizationId ?? alert.organizationId ?? workflowContext.organizationId,
    sourceFamily: sourceFamily ? String(sourceFamily) : undefined,
    matchedTerm: matchedTerm ? {
      value: matchedValue,
      kind: matchedTerm.kind ? String(matchedTerm.kind) : undefined,
      normalized: matchedValue?.toLowerCase(),
      category: workflowContext.matchedTermCategory ? String(workflowContext.matchedTermCategory) : undefined
    } : undefined,
    matchBasis,
    matchType,
    matchedFieldHints,
    captureIds,
    sourceIds,
    watchlistIds,
    watchlistItemIds,
    evidenceCount,
    confidence: alert.confidence !== undefined ? Number(alert.confidence) : undefined,
    confidenceReasoning,
    recommendedRoute,
    reason: reasonParts.join("; ")
  };
}

export function buildDwmAlertOrgWatchlistScope(workflowContext: Record<string, any> | undefined): DwmAlertOrgWatchlistScope | undefined {
  if (!workflowContext) return undefined;
  const termContexts = Array.isArray(workflowContext.watchlistTermContexts) ? workflowContext.watchlistTermContexts : [];
  const membershipContext = workflowContext.membershipContext;
  const watchlistIds = uniqueStrings([
    ...asStringArray(workflowContext.watchlistIds),
    ...termContexts.map((term: any) => term.watchlistId).filter(Boolean).map(String)
  ]);
  const watchlistItemIds = uniqueStrings([
    ...asStringArray(workflowContext.watchlistItemIds),
    ...termContexts.map((term: any) => term.watchlistItemId).filter(Boolean).map(String)
  ]);
  const alertGeneratorKeys = uniqueStrings([
    ...asStringArray(workflowContext.alertGeneratorKeys),
    ...termContexts.map((term: any) => term.alertGeneratorKey).filter(Boolean).map(String)
  ]);
  if (!workflowContext.organizationId && !termContexts.length && !watchlistIds.length && !watchlistItemIds.length && !alertGeneratorKeys.length) return undefined;
  const terms = termContexts.map((term: any) => {
    const ref = term.alertGenerationRef ?? {};
    return {
      watchlistId: String(term.watchlistId ?? ref.watchlistId),
      watchlistItemId: String(term.watchlistItemId ?? ref.watchlistItemId),
      itemId: String(term.itemId ?? ref.itemId ?? term.watchlistItemId ?? ref.watchlistItemId),
      organizationId: String(term.organizationId ?? ref.organizationId ?? workflowContext.organizationId),
      tenantId: String(term.tenantId ?? ref.tenantId ?? workflowContext.tenantId),
      ownerOrganizationId: String(ref.ownerOrganizationId ?? membershipContext?.ownerOrganizationId ?? term.organizationId ?? workflowContext.organizationId),
      term: String(term.term ?? term.value ?? ref.term ?? ""),
      normalizedTerm: String(term.normalizedTerm ?? ref.normalizedTerm ?? term.term ?? term.value ?? "").toLowerCase(),
      category: String(term.category ?? ref.category ?? term.kind ?? "keyword"),
      termFamily: String(term.termFamily ?? ref.termFamily ?? term.kind ?? "keyword"),
      status: String(term.status ?? ref.status ?? "active"),
      alertGeneratorKey: String(term.alertGeneratorKey ?? ref.dedupe?.key ?? ""),
      lifecycleReason: term.lifecycleReason ?? ref.lifecycle?.reason ?? null,
      lifecycleRequestId: term.lifecycleRequestId ?? ref.lifecycle?.requestId ?? null
    };
  });
  return {
    schemaVersion: "dwm.alert_org_watchlist_scope.v1",
    tenantId: workflowContext.tenantId ? String(workflowContext.tenantId) : membershipContext?.tenantId ? String(membershipContext.tenantId) : undefined,
    organizationId: workflowContext.organizationId ? String(workflowContext.organizationId) : membershipContext?.organizationId ? String(membershipContext.organizationId) : undefined,
    ownerOrganizationIds: uniqueStrings([
      ...terms.map((term) => term.ownerOrganizationId),
      membershipContext?.ownerOrganizationId ? String(membershipContext.ownerOrganizationId) : undefined,
      workflowContext.organizationId ? String(workflowContext.organizationId) : undefined
    ].filter(Boolean).map(String)),
    visibilityPolicy: workflowContext.visibilityPolicy ? String(workflowContext.visibilityPolicy) : membershipContext?.visibilityPolicy ? String(membershipContext.visibilityPolicy) : undefined,
    entitlementStatus: membershipContext?.entitlementStatus ? String(membershipContext.entitlementStatus) : undefined,
    organizationLifecycleState: membershipContext?.organizationLifecycleState ? String(membershipContext.organizationLifecycleState) : undefined,
    allowedViewerRoles: uniqueStrings(asStringArray(membershipContext?.allowedViewerRoles)),
    watchlistIds,
    watchlistItemIds,
    alertGeneratorKeys,
    terms
  };
}

export function buildDwmAlertWebhookContext(alert: DwmAlert & Record<string, any>, workflowContext: ReturnType<typeof buildDwmAlertWorkflowContext> & Record<string, any>) {
  return {
    eventType: alert.eventType,
    alertId: alert.id,
    tenantId: workflowContext.tenantId,
    organizationId: workflowContext.organizationId,
    visibilityPolicy: workflowContext.visibilityPolicy,
    membershipContext: workflowContext.membershipContext,
    generationCandidateId: workflowContext.generationCandidateId,
    watchlistIds: workflowContext.watchlistIds,
    watchlistItemIds: workflowContext.watchlistItemIds,
    watchlistTermContexts: workflowContext.watchlistTermContexts,
    alertGenerationRefs: workflowContext.alertGenerationRefs,
    alertGeneratorKeys: workflowContext.alertGeneratorKeys,
    orgWatchlistScope: buildDwmAlertOrgWatchlistScope(workflowContext),
    matchReason: workflowContext.matchReason ?? buildDwmAlertMatchReason({ alert, workflowContext }),
    matchedTermCategory: workflowContext.matchedTermCategory,
    actor: workflowContext.actor,
    entity: workflowContext.entity,
    watchlistProvenance: workflowContext.watchlistProvenance,
    sourceFamily: workflowContext.sourceFamily,
    captureIds: workflowContext.captureIds,
    evidenceCount: workflowContext.evidenceCount,
    dedupeKey: workflowContext.dedupeKey,
    recommendedRoute: workflowContext.recommendedRoute,
    alertDetailPath: workflowContext.alertDetailPath,
    caseIdCandidate: workflowContext.caseIdCandidate,
    casePath: workflowContext.casePath,
    severity: alert.severity,
    confidence: alert.confidence,
    confidenceReasoning: alert.confidenceReasoning ?? [],
    provenance: alert.provenance,
    generationEvidenceWindow: workflowContext.generationEvidenceWindow,
    duplicateEvidenceSuppression: workflowContext.duplicateEvidenceSuppression,
    claimSummary: alert.claimSummary
  };
}

function buildDwmAlertCreatedEvent(input: {
  alert: DwmAlert & Record<string, any>;
  alertId: string;
  tenantId: string;
  organizationId?: string;
  workflowContext: ReturnType<typeof buildDwmAlertWorkflowContext> & Record<string, any>;
  generatedAt: string;
}) {
  const captureIds = uniqueStrings(input.workflowContext.captureIds ?? input.alert.provenance?.captureIds ?? []);
  const dedupeKey = String(input.alert.dedupeKey ?? input.alert.webhookDelivery?.dedupeKey);
  const deliveryDedupeKey = String(input.alert.webhookDelivery?.dedupeKey ?? dedupeKey);
  return {
    schemaVersion: "dwm.alert_created_event.v1",
    id: stableId("dwm_alert_created_event", `${input.tenantId}:${input.organizationId ?? ""}:${input.alertId}:${dedupeKey}`),
    eventType: "dwm.alert.created",
    at: input.generatedAt,
    alertId: input.alertId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    sourceFamily: input.alert.sourceFamily,
    watchlistIds: input.workflowContext.watchlistIds ?? [],
    watchlistItemIds: input.workflowContext.watchlistItemIds ?? [],
    alertGeneratorKeys: input.workflowContext.alertGeneratorKeys ?? [],
    captureIds,
    primaryCaptureId: captureIds[0],
    evidenceCount: Number(input.workflowContext.evidenceCount ?? input.alert.evidence?.length ?? 0),
    dedupeKey,
    deliveryDedupeKey,
    recommendedRoute: input.alert.recommendedRoute ?? input.alert.webhookDelivery?.recommendedRoute,
    alertDetailPath: input.workflowContext.alertDetailPath,
    matchReason: input.workflowContext.matchReason ?? buildDwmAlertMatchReason({
      alert: input.alert,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      workflowContext: input.workflowContext
    }),
    confidence: input.alert.confidence,
    confidenceReasoning: input.alert.confidenceReasoning ?? [],
    provenance: {
      matchBasis: input.alert.provenance?.matchBasis,
      captureIds: input.alert.provenance?.captureIds ?? captureIds,
      sourceIds: input.alert.provenance?.sourceIds ?? []
    },
    consumerPayload: buildDwmAlertEventConsumerPayload({
      eventType: "dwm.alert.created",
      eventId: stableId("dwm_alert_created_event", `${input.tenantId}:${input.organizationId ?? ""}:${input.alertId}:${dedupeKey}`),
      alert: input.alert,
      alertId: input.alertId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      workflowContext: input.workflowContext,
      captureIds,
      selectedCaptureIds: captureIds,
      evidenceCount: Number(input.workflowContext.evidenceCount ?? input.alert.evidence?.length ?? 0),
      dedupeKey,
      deliveryDedupeKey,
      at: input.generatedAt
    })
  };
}

function buildDwmAlertUpdatedEvent(input: {
  existing: Record<string, any>;
  alert: DwmAlert & Record<string, any>;
  alertId: string;
  tenantId: string;
  organizationId?: string;
  workflowContext: ReturnType<typeof buildDwmAlertWorkflowContext> & Record<string, any>;
  generatedAt: string;
}) {
  const previousCaptureIds = uniqueStrings([
    ...asStringArray(input.existing.deliveryReadinessContext?.selectedCaptureIds),
    ...asStringArray(input.existing.workflowContext?.captureIds),
    ...asStringArray(input.existing.provenance?.captureIds)
  ]);
  const captureIds = uniqueStrings(asStringArray(input.workflowContext.captureIds ?? input.alert.provenance?.captureIds));
  const addedCaptureIds = captureIds.filter((captureId) => !previousCaptureIds.includes(captureId));
  const removedCaptureIds = previousCaptureIds.filter((captureId) => !captureIds.includes(captureId));
  const evidenceCount = Number(input.workflowContext.evidenceCount ?? input.alert.evidence?.length ?? 0);
  const previousEvidenceCount = Number(input.existing.workflowContext?.evidenceCount ?? input.existing.webhookContext?.evidenceCount ?? input.existing.evidence?.length ?? 0);
  if (!addedCaptureIds.length && !removedCaptureIds.length && evidenceCount === previousEvidenceCount) return undefined;
  const dedupeKey = String(input.alert.dedupeKey ?? input.alert.webhookDelivery?.dedupeKey);
  const deliveryDedupeKey = String(input.alert.webhookDelivery?.dedupeKey ?? dedupeKey);
  const eventId = stableId("dwm_alert_updated_event", `${input.tenantId}:${input.organizationId ?? ""}:${input.alertId}:${dedupeKey}:${captureIds.join("|")}:${evidenceCount}`);
  return {
    schemaVersion: "dwm.alert_updated_event.v1",
    id: eventId,
    eventType: "dwm.alert.updated",
    at: input.generatedAt,
    alertId: input.alertId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    sourceFamily: input.alert.sourceFamily,
    watchlistIds: input.workflowContext.watchlistIds ?? [],
    watchlistItemIds: input.workflowContext.watchlistItemIds ?? [],
    alertGeneratorKeys: input.workflowContext.alertGeneratorKeys ?? [],
    captureIds,
    addedCaptureIds,
    removedCaptureIds,
    evidenceCount,
    previousEvidenceCount,
    dedupeKey,
    deliveryDedupeKey,
    recommendedRoute: input.alert.recommendedRoute ?? input.alert.webhookDelivery?.recommendedRoute,
    alertDetailPath: input.workflowContext.alertDetailPath,
    generationEvidenceWindow: input.workflowContext.generationEvidenceWindow,
    duplicateEvidenceSuppression: input.workflowContext.duplicateEvidenceSuppression,
    matchReason: input.workflowContext.matchReason ?? buildDwmAlertMatchReason({
      alert: input.alert,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      workflowContext: input.workflowContext
    }),
    provenance: {
      matchBasis: input.alert.provenance?.matchBasis,
      captureIds: input.alert.provenance?.captureIds ?? captureIds,
      sourceIds: input.alert.provenance?.sourceIds ?? []
    },
    consumerPayload: buildDwmAlertEventConsumerPayload({
      eventType: "dwm.alert.updated",
      eventId,
      alert: input.alert,
      alertId: input.alertId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      workflowContext: input.workflowContext,
      captureIds,
      selectedCaptureIds: captureIds,
      addedCaptureIds,
      evidenceCount,
      previousEvidenceCount,
      dedupeKey,
      deliveryDedupeKey,
      at: input.generatedAt,
      workflowEventCount: Array.isArray(input.existing.workflowEvents) ? input.existing.workflowEvents.length : 0
    })
  };
}

function buildDwmAlertEventConsumerPayload(input: {
  eventType: "dwm.alert.created" | "dwm.alert.updated";
  eventId: string;
  alert: DwmAlert & Record<string, any>;
  alertId: string;
  tenantId: string;
  organizationId?: string;
  workflowContext: ReturnType<typeof buildDwmAlertWorkflowContext> & Record<string, any>;
  captureIds: string[];
  selectedCaptureIds: string[];
  addedCaptureIds?: string[];
  evidenceCount: number;
  previousEvidenceCount?: number;
  dedupeKey: string;
  deliveryDedupeKey: string;
  at: string;
  workflowEventCount?: number;
}) {
  return {
    schemaVersion: "dwm.alert_event_consumer_payload.v1",
    eventId: input.eventId,
    eventType: input.eventType,
    at: input.at,
    alertId: input.alertId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    sourceFamily: input.alert.sourceFamily,
    watchlistIds: input.workflowContext.watchlistIds ?? [],
    watchlistItemIds: input.workflowContext.watchlistItemIds ?? [],
    alertGeneratorKeys: input.workflowContext.alertGeneratorKeys ?? [],
    alertGenerationRefs: input.workflowContext.alertGenerationRefs ?? [],
    captureIds: input.captureIds,
    selectedCaptureIds: input.selectedCaptureIds,
    addedCaptureIds: input.addedCaptureIds ?? [],
    evidenceExcerpts: buildDwmAlertEventEvidenceExcerpts(input.alert),
    evidenceCount: input.evidenceCount,
    previousEvidenceCount: input.previousEvidenceCount,
    dedupeKey: input.dedupeKey,
    deliveryDedupeKey: input.deliveryDedupeKey,
    recommendedRoute: input.alert.recommendedRoute ?? input.alert.webhookDelivery?.recommendedRoute,
    alertDetailPath: input.workflowContext.alertDetailPath,
    caseIdCandidate: input.workflowContext.caseIdCandidate,
    casePath: input.workflowContext.casePath,
    workflowEventCount: input.workflowEventCount ?? 0,
    confidence: input.alert.confidence,
    confidenceReasoning: input.alert.confidenceReasoning ?? [],
    matchReason: input.alert.matchReason ?? input.workflowContext.matchReason ?? buildDwmAlertMatchReason({
      alert: input.alert,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      workflowContext: input.workflowContext
    }),
    sourceProvenanceSummary: input.alert.sourceProvenanceSummary ?? buildDwmAlertSourceProvenanceSummary({
      alert: input.alert,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      workflowContext: input.workflowContext
    }),
    orgWatchlistScope: input.alert.orgWatchlistScope ?? buildDwmAlertOrgWatchlistScope(input.workflowContext),
    provenance: {
      matchBasis: input.alert.provenance?.matchBasis,
      captureIds: input.alert.provenance?.captureIds ?? input.captureIds,
      sourceIds: input.alert.provenance?.sourceIds ?? []
    },
    generationEvidenceWindow: input.workflowContext.generationEvidenceWindow,
    evidenceFreshness: buildDwmAlertEvidenceFreshnessForWindow(input.workflowContext.generationEvidenceWindow, input.at),
    duplicateEvidenceSuppression: input.workflowContext.duplicateEvidenceSuppression
  };
}

function buildDwmAlertEventEvidenceExcerpts(alert: Record<string, any>) {
  const evidence = Array.isArray(alert.evidence) ? alert.evidence : [];
  return evidence.map((item: any) => ({
    evidenceId: String(item.id),
    captureId: item.provenance?.captureId ? String(item.provenance.captureId) : item.id ? String(item.id) : undefined,
    sourceId: item.provenance?.sourceId ? String(item.provenance.sourceId) : item.sourceId ? String(item.sourceId) : undefined,
    sourceKey: sourceKeyForEvidence(item),
    sourceUrl: item.url ? String(item.url) : undefined,
    sourceFamily: item.sourceFamily ? String(item.sourceFamily) : alert.sourceFamily ? String(alert.sourceFamily) : undefined,
    observedAt: item.observedAt ?? item.firstSeenAt ? String(item.observedAt ?? item.firstSeenAt) : undefined,
    contentHash: item.contentHash ? String(item.contentHash) : undefined,
    excerpt: item.excerpt ? String(item.excerpt) : undefined,
    redactionState: item.redactionState ? String(item.redactionState) : undefined
  }));
}

function sourceKeyForEvidence(item: any): string | undefined {
  const sourceId = item.provenance?.sourceId ?? item.sourceId;
  if (sourceId && String(sourceId) !== "unknown") return String(sourceId);
  const sourceFamily = item.sourceFamily ? String(item.sourceFamily) : undefined;
  return sourceFamily ? `source_family:${sourceFamily}` : undefined;
}

function buildDwmAlertProvenanceGaps(evidenceExcerpts: ReturnType<typeof buildDwmAlertEventEvidenceExcerpts>): DwmAlertSourceProvenanceSummary["provenanceGaps"] {
  return evidenceExcerpts.flatMap((item) => [
    !item.sourceUrl ? {
      code: "missing_source_url" as const,
      field: "evidenceExcerpts[].sourceUrl",
      evidenceId: item.evidenceId,
      recoverable: true,
      detail: "Capture evidence has no source URL; consumers should show source key/family instead of inventing a link."
    } : undefined,
    !item.sourceKey ? {
      code: "missing_source_key" as const,
      field: "evidenceExcerpts[].sourceKey",
      evidenceId: item.evidenceId,
      recoverable: true,
      detail: "Capture evidence has no stable source key."
    } : undefined,
    !item.observedAt ? {
      code: "missing_observed_at" as const,
      field: "evidenceExcerpts[].observedAt",
      evidenceId: item.evidenceId,
      recoverable: true,
      detail: "Capture evidence has no observed timestamp."
    } : undefined,
    !item.contentHash ? {
      code: "missing_content_hash" as const,
      field: "evidenceExcerpts[].contentHash",
      evidenceId: item.evidenceId,
      recoverable: true,
      detail: "Capture evidence has no content hash; dedupe must use capture id fallback."
    } : undefined
  ].filter(Boolean) as DwmAlertSourceProvenanceSummary["provenanceGaps"]);
}

function mergeAlertEvents(existingEvents: any[], nextEvent: any | undefined): any[] {
  const events = [...existingEvents];
  if (!nextEvent) return events;
  if (events.some((event) => event?.id === nextEvent.id)) return events;
  return [...events, nextEvent];
}

function scopeAlertForGenerationCandidate(alert: DwmAlert, candidate: DwmAlertGenerationCandidate | undefined, input: RebuildDwmRuntimeAlertsInput): DwmAlert {
  if (!input.organizationId || !candidate) return alert;
  const scopedDedupeKey = stableId("dwm_dedupe", `${candidate.dedupeKeyCandidate}:${alert.artifactType}:${alert.sourceFamily}`);
  return {
    ...alert,
    id: stableId("dwm_alert", scopedDedupeKey),
    dedupeKey: scopedDedupeKey,
    webhookDelivery: {
      ...alert.webhookDelivery,
      dedupeKey: scopedDedupeKey
    },
    provenance: {
      ...alert.provenance,
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      watchlistIds: candidate.watchlistIds,
      watchlistItemIds: candidate.watchlistItemIds,
      alertGeneratorKeys: candidate.alertGeneratorKeys,
      alertGenerationRefs: candidate.alertGenerationRefs
    } as DwmAlert["provenance"] & Record<string, unknown>
  };
}

function findExistingAlert(store: RuntimeDwmAlertStore, alert: DwmAlert, tenantId: string, organizationId?: string) {
  const dedupeKey = alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey;
  const matchedTermValue = normalizeTerm(alert.matchedTerm?.value);
  const matchedTermKind = String(alert.matchedTerm?.kind ?? "");
  return store.listDwmAlerts()
    .filter((row) => String(row.tenantId ?? "") === tenantId)
    .filter((row) => organizationId ? row.organizationId === organizationId : !row.organizationId)
    .find((row) => row.id === alert.id
      || row.dedupeKey === dedupeKey
      || row.webhookDelivery?.dedupeKey === dedupeKey
      || (matchedTermValue
        && row.sourceFamily === alert.sourceFamily
        && row.artifactType === alert.artifactType
        && normalizeTerm(row.matchedTerm?.value) === matchedTermValue
        && String(row.matchedTerm?.kind ?? "") === matchedTermKind));
}

function findGenerationCandidate(plan: DwmAlertGenerationPlan, alert: DwmAlert): DwmAlertGenerationCandidate | undefined {
  const normalizedTerm = normalizeTerm(alert.matchedTerm?.value);
  return plan.candidates.find((candidate) => candidate.normalizedTerm === normalizedTerm && candidate.term.kind === alert.matchedTerm?.kind)
    ?? plan.candidates.find((candidate) => candidate.normalizedTerm === normalizedTerm);
}

function mergeSnapshotAlertsForGeneration(alerts: DwmAlert[], plan: DwmAlertGenerationPlan, input: RebuildDwmRuntimeAlertsInput): DwmAlert[] {
  const merged = new Map<string, DwmAlert>();
  for (const alert of [...alerts, ...candidateAlertsForGeneration(plan, input)]) {
    const candidate = findGenerationCandidate(plan, alert);
    const key = candidate
      ? `${input.tenantId}:${input.organizationId ?? ""}:${candidate.id}:${alert.sourceFamily}`
      : `${input.tenantId}:${input.organizationId ?? ""}:${normalizeTerm(alert.matchedTerm?.value)}:${alert.matchedTerm?.kind ?? ""}:${alert.artifactType}:${alert.sourceFamily}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, alert);
      continue;
    }
    merged.set(key, mergeGeneratedAlert(current, alert));
  }
  return [...merged.values()];
}

function candidateAlertsForGeneration(plan: DwmAlertGenerationPlan, input: RebuildDwmRuntimeAlertsInput): DwmAlert[] {
  const sources = input.store.listSources();
  const captures = input.store.listCaptures();
  return plan.candidates
    .filter((candidate) => candidate.captureRefs.length > 0)
    .flatMap((candidate) => {
      const sourceFamilies = candidate.sourceFamilies.length ? candidate.sourceFamilies : uniqueStrings(candidate.captureRefs.map((ref) => ref.sourceFamily).filter(Boolean));
      return sourceFamilies.map((sourceFamily) => alertFromGenerationCandidate(candidate, sources, captures, input, sourceFamily));
    })
    .filter(Boolean) as DwmAlert[];
}

function alertFromGenerationCandidate(candidate: DwmAlertGenerationCandidate, sources: SourceRecord[], captures: RawCapture[], input: RebuildDwmRuntimeAlertsInput, sourceFamilyFilter?: string): DwmAlert | undefined {
  const captureById = new Map(captures.map((capture) => [String(capture.id), capture]));
  const sourceById = new Map(sources.map((source) => [String(source.id), source]));
  const evidence = candidate.captureRefs
    .filter((ref) => !sourceFamilyFilter || ref.sourceFamily === sourceFamilyFilter)
    .slice(0, 25)
    .map((ref) => evidenceFromGenerationCaptureRef(ref, captureById.get(String(ref.captureId)), sourceById.get(String(ref.sourceId)), input))
    .filter(Boolean) as DwmAlert["evidence"];
  if (!evidence.length) return undefined;

  const sourceFamilies = uniqueStrings(evidence.map((item) => item.sourceFamily)) as DwmAlert["sourceFamily"][];
  const sourceCount = uniqueStrings(evidence.map((item) => item.sourceId)).length;
  const sourceFamily = evidence[0]?.sourceFamily ?? "unknown";
  const observed = evidence.map((item) => item.observedAt || item.firstSeenAt).filter(Boolean).sort();
  const artifactType = sourceFamily === "public_advisory" ? "public_report" : "metadata_match";
  const route = sourceFamily === "public_advisory" || sourceFamily === "clear_web" ? "analyst_review" : "brand_protection";
  const dedupeSeed = candidate.dedupeKeyCandidate || stableId("dwm_dedupe_candidate", `${input.tenantId}:${input.organizationId ?? ""}:${candidate.normalizedTerm}:${sourceFamily}`);
  const dedupeKey = stableId("dwm_dedupe", `${dedupeSeed}:${artifactType}:${sourceFamily}`);

  return {
    id: stableId("dwm_alert", dedupeKey),
    eventType: "darkweb.monitoring.match",
    severity: sourceFamily === "telegram_public" || sourceFamily === "darkweb_metadata" ? "medium" : "low",
    confidence: Math.min(95, 58 + Math.min(25, evidence.length) + sourceFamilies.length * 4),
    matchedTerm: candidate.term,
    company: displayAlertCompany(candidate.term.value),
    artifactType,
    sourceFamily,
    sourceCount,
    firstSeenAt: observed[0] ?? nowFromEvidence(input),
    lastSeenAt: observed.at(-1) ?? nowFromEvidence(input),
    assertionKind: "source_claim",
    observedMatchSummary: generatedObservedMatchSummary(candidate.term.value, evidence.length, sourceCount),
    claimSummary: `${sourceFamily.replaceAll("_", " ")} evidence matched ${candidate.term.value} across ${evidence.length} capture${evidence.length === 1 ? "" : "s"}.`,
    matchContext: {
      normalizedTerm: candidate.normalizedTerm,
      termKind: candidate.term.kind,
      matchType: "bounded_text_or_metadata",
      matchedFieldHints: ["capture_text", "source_metadata"]
    },
    evidenceSummary: {
      evidenceCount: evidence.length,
      sourceFamilyCounts: evidence.reduce((counts, item) => ({ ...counts, [item.sourceFamily]: Number(counts[item.sourceFamily] ?? 0) + 1 }), {} as Record<string, number>),
      metadataOnlyCount: evidence.filter((item) => item.provenance.metadataOnly).length,
      publicSafeCount: evidence.filter((item) => !item.provenance.metadataOnly).length,
      firstObservedAt: observed[0] ?? nowFromEvidence(input),
      lastObservedAt: observed.at(-1) ?? nowFromEvidence(input)
    },
    routingContext: {
      queue: route,
      urgency: route === "brand_protection" ? "same_day" : "watch",
      customerVisibleEvidence: evidence.every((item) => item.provenance.metadataOnly) ? "metadata_only" : "redacted_excerpt",
      reason: `Source-matched watchlist term ${candidate.term.value} has capture-backed evidence from ${sourceFamilies.join(", ")}.`
    },
    confidenceReasoning: [
      "Alert was bootstrapped from source-matched capture evidence because the product snapshot had no persisted alert row.",
      `${evidence.length} capture-backed evidence item${evidence.length === 1 ? "" : "s"} matched the active watchlist term.`,
      `Source families: ${sourceFamilies.join(", ") || "unknown"}.`
    ],
    provenance: {
      generatedAt: nowFromEvidence(input),
      matchBasis: "watchlist_capture_text",
      matchedEvidenceIds: evidence.map((item) => item.id),
      sourceFamilies,
      captureIds: evidence.map((item) => item.provenance.captureId),
      sourceIds: uniqueStrings(evidence.map((item) => item.sourceId)),
      extractorVersions: ["source-matched-bootstrap-v1"],
      metadataOnly: evidence.every((item) => item.provenance.metadataOnly)
    },
    dedupeKey,
    reviewState: "needs_review",
    recommendedAction: "Review matched source evidence, confirm customer relevance, then route to case or webhook delivery.",
    recommendedRoute: route,
    evidence,
    webhookDelivery: {
      recommendedRoute: route,
      payloadHash: stableId("dwm_payload", dedupeKey),
      dedupeKey
    }
  };
}

function evidenceFromGenerationCaptureRef(ref: DwmAlertGenerationCaptureRef, capture: RawCapture | undefined, source: SourceRecord | undefined, input: RebuildDwmRuntimeAlertsInput): DwmAlert["evidence"][number] | undefined {
  const sourceFamily = sourceFamilyFor(source, capture ?? ({ id: ref.captureId, sourceId: ref.sourceId, metadata: {} } as RawCapture)) as DwmAlert["sourceFamily"];
  const text = capture ? matchableCaptureText(capture) : "";
  const captureId = String(ref.captureId);
  const sourceId = String(ref.sourceId ?? (capture as any)?.sourceId ?? (source as any)?.id ?? "unknown");
  const observedAt = ref.observedAt || String((capture as any)?.collectedAt ?? nowFromEvidence(input));
  const contentHash = ref.contentHash || String((capture as any)?.contentHash ?? stableId("capture_hash", captureId));
  const captureMode = sourceFamily === "telegram_public" ? "public_message" : sourceFamily === "public_advisory" || sourceFamily === "clear_web" ? "public_report" : "metadata_only";
  return {
    id: captureId,
    sourceId,
    sourceName: String((source as any)?.name ?? sourceFamily.replaceAll("_", " ")),
    sourceFamily,
    url: String((capture as any)?.url ?? (source as any)?.url ?? "") || undefined,
    firstSeenAt: observedAt,
    observedAt,
    captureMode,
    redactionState: captureMode === "metadata_only" ? "metadata_only" : "redacted",
    contentHash,
    excerpt: safeAlertExcerpt(text || `${sourceFamily} capture matched active watchlist term.`),
    provenance: {
      captureId,
      sourceId,
      sourceType: String((source as any)?.type ?? "") || undefined,
      collector: String((capture as any)?.metadata?.adapter ?? "") || undefined,
      captureMode,
      retentionClass: String((capture as any)?.retentionClass ?? (capture as any)?.metadata?.retentionClass ?? "") || undefined,
      storageKind: String((capture as any)?.storageKind ?? "") || undefined,
      metadataOnly: captureMode === "metadata_only" || (capture as any)?.storageKind === "metadata_only"
    }
  };
}

function safeAlertExcerpt(value: string): string {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]").replace(/\b\d{8,}\b/g, "[number]").slice(0, 220);
}

function displayAlertCompany(value: string): string {
  return value.includes(".") ? value.split(".")[0].replace(/[-_]/g, " ") : value;
}

function nowFromEvidence(_input: RebuildDwmRuntimeAlertsInput): string {
  return new Date().toISOString();
}

function mergeGeneratedAlert(current: DwmAlert, next: DwmAlert): DwmAlert {
  const evidence = mergeGeneratedEvidence([...(current.evidence ?? []), ...(next.evidence ?? [])]);
  const observed = evidence.map((item: any) => item.observedAt ?? item.firstSeenAt).filter(Boolean).map(String).sort();
  const sourceIds = uniqueStrings([
    ...asStringArray(current.provenance?.sourceIds),
    ...asStringArray(next.provenance?.sourceIds),
    ...evidence.map((item: any) => item.sourceId ?? item.provenance?.sourceId).filter(Boolean).map(String)
  ]);
  const captureIds = uniqueStrings([
    ...asStringArray(current.provenance?.captureIds),
    ...asStringArray(next.provenance?.captureIds),
    ...evidence.map((item: any) => item.provenance?.captureId ?? item.id).filter(Boolean).map(String)
  ]);
  return {
    ...current,
    evidence,
    sourceCount: sourceIds.length,
    firstSeenAt: observed[0] ?? current.firstSeenAt ?? next.firstSeenAt,
    lastSeenAt: observed.at(-1) ?? next.lastSeenAt ?? current.lastSeenAt,
    assertionKind: "source_claim",
    observedMatchSummary: generatedObservedMatchSummary(current.matchedTerm.value, evidence.length, sourceIds.length),
    confidence: Math.max(Number(current.confidence ?? 0), Number(next.confidence ?? 0)),
    confidenceReasoning: uniqueStrings([...(current.confidenceReasoning ?? []), ...(next.confidenceReasoning ?? [])].map(String)),
    provenance: {
      ...current.provenance,
      captureIds,
      sourceIds
    }
  };
}

function generatedObservedMatchSummary(term: string, evidenceCount: number, sourceCount: number): string {
  return `${evidenceCount} captured record${evidenceCount === 1 ? "" : "s"} from ${sourceCount} source${sourceCount === 1 ? "" : "s"} matched ${term}. This confirms the source mention, not the underlying incident.`;
}

function mergeGeneratedEvidence(evidence: any[]): any[] {
  const byIdentity = new Map<string, any>();
  for (const item of evidence) {
    const identity = item.provenance?.captureId ? `capture:${item.provenance.captureId}` : item.contentHash ? `${item.sourceFamily}:${item.contentHash}` : `evidence:${item.id}`;
    byIdentity.set(identity, byIdentity.get(identity) ?? item);
  }
  return [...byIdentity.values()].sort((a, b) => String(a.observedAt ?? a.firstSeenAt ?? "").localeCompare(String(b.observedAt ?? b.firstSeenAt ?? "")));
}

function watchlistItemIdsFor(watchlist: RuntimeDwmWatchlist, matchedTerm: string | undefined): string[] {
  if (!matchedTerm) return [];
  return watchlist.terms
    .filter((term) => term.value.toLowerCase() === matchedTerm.toLowerCase())
    .map((term) => String((term as any).id ?? `${watchlist.id}:${term.value}`));
}

function watchlistTermContextsFor(watchlist: RuntimeDwmWatchlist, matchedTerm: string | undefined): RuntimeOrgWatchlistTermContext[] {
  if (!matchedTerm) return [];
  const normalized = matchedTerm.toLowerCase();
  return (watchlist.orgWatchlistTerms ?? [])
    .filter((term) => {
      const termNormalized = typeof term.normalizedTerm === "string" ? term.normalizedTerm.toLowerCase() : "";
      const value = typeof term.value === "string" ? term.value.toLowerCase() : "";
      const values = Array.isArray(term.terms) ? term.terms.map((item) => String(item).toLowerCase()) : [];
      return termNormalized === normalized || value === normalized || values.includes(normalized);
    });
}

function captureRefsForTerm(input: { term: DwmWatchTerm; sources: SourceRecord[]; captures: RawCapture[] }): DwmAlertGenerationCaptureRef[] {
  return captureRefsForTermWithSuppression(input).captureRefs;
}

function captureRefsForTermWithSuppression(input: { term: DwmWatchTerm; sources: SourceRecord[]; captures: RawCapture[] }): {
  captureRefs: DwmAlertGenerationCaptureRef[];
  suppressedDuplicateCaptureRefs: DwmAlertGenerationSuppressedCaptureRef[];
} {
  const refs = input.captures
    .filter((capture) => termMatchesText(matchableCaptureText(capture), input.term.value))
    .map((capture) => {
      const source = input.sources.find((row) => row.id === capture.sourceId);
      return {
        captureId: capture.id,
        sourceId: capture.sourceId,
        sourceFamily: sourceFamilyFor(source, capture),
        contentHash: capture.contentHash,
        observedAt: capture.collectedAt
      };
    });
  const byIdentity = new Map<string, DwmAlertGenerationCaptureRef>();
  const captureRefs: DwmAlertGenerationCaptureRef[] = [];
  const suppressedDuplicateCaptureRefs: DwmAlertGenerationSuppressedCaptureRef[] = [];
  for (const ref of refs) {
    const duplicateIdentity = ref.contentHash ? `${ref.sourceFamily}:${ref.contentHash}` : `capture:${ref.captureId}`;
    const existing = byIdentity.get(duplicateIdentity);
    if (existing) {
      suppressedDuplicateCaptureRefs.push({
        ...ref,
        duplicateOfCaptureId: existing.captureId,
        duplicateReason: "duplicate_content_hash",
        duplicateIdentity
      });
      continue;
    }
    byIdentity.set(duplicateIdentity, ref);
    captureRefs.push(ref);
  }
  return { captureRefs, suppressedDuplicateCaptureRefs };
}

function mergeCaptureRefs(existing: DwmAlertGenerationCaptureRef[], next: DwmAlertGenerationCaptureRef[]): DwmAlertGenerationCaptureRef[] {
  const byIdentity = new Map<string, DwmAlertGenerationCaptureRef>();
  for (const ref of [...existing, ...next]) {
    const identity = ref.contentHash ? `${ref.sourceFamily}:${ref.contentHash}` : `capture:${ref.captureId}`;
    byIdentity.set(identity, byIdentity.get(identity) ?? ref);
  }
  return [...byIdentity.values()];
}

function mergeSuppressedDuplicateCaptureRefs(existing: DwmAlertGenerationSuppressedCaptureRef[], next: DwmAlertGenerationSuppressedCaptureRef[]): DwmAlertGenerationSuppressedCaptureRef[] {
  const byIdentity = new Map<string, DwmAlertGenerationSuppressedCaptureRef>();
  for (const ref of [...existing, ...next]) {
    const key = `${ref.duplicateIdentity}:${ref.captureId}:${ref.duplicateOfCaptureId}`;
    byIdentity.set(key, byIdentity.get(key) ?? ref);
  }
  return [...byIdentity.values()];
}

function duplicateEvidenceSuppressionForCandidate(candidate: DwmAlertGenerationCandidate | undefined): DwmDuplicateEvidenceSuppressionSummary {
  const refs = candidate?.suppressedDuplicateCaptureRefs ?? [];
  return {
    schemaVersion: "dwm.duplicate_evidence_suppression.v1",
    suppressedCount: refs.length,
    suppressedCaptureIds: uniqueStrings(refs.map((ref) => ref.captureId)),
    duplicateOfCaptureIds: uniqueStrings(refs.map((ref) => ref.duplicateOfCaptureId)),
    duplicateIdentities: uniqueStrings(refs.map((ref) => ref.duplicateIdentity)),
    reasons: uniqueStrings(refs.map((ref) => ref.duplicateReason)) as DwmDuplicateEvidenceSuppressionSummary["reasons"]
  };
}

function evidenceWindowForCaptureRefs(refs: DwmAlertGenerationCaptureRef[]) {
  const observed = refs.map((ref) => ref.observedAt).filter(Boolean).map(String).sort();
  return {
    captureIds: uniqueStrings(refs.map((ref) => ref.captureId).filter(Boolean)),
    sourceFamilies: uniqueStrings(refs.map((ref) => ref.sourceFamily).filter(Boolean)),
    contentHashes: uniqueStrings(refs.map((ref) => ref.contentHash).filter(Boolean) as string[]),
    firstObservedAt: observed[0],
    lastObservedAt: observed.at(-1)
  };
}

function mergeWatchlistTermContexts(existing: RuntimeOrgWatchlistTermContext[], next: RuntimeOrgWatchlistTermContext[]): RuntimeOrgWatchlistTermContext[] {
  const byId = new Map(existing.map((term) => [term.watchlistItemId, term]));
  for (const term of next) byId.set(term.watchlistItemId, byId.get(term.watchlistItemId) ?? term);
  return [...byId.values()];
}

function mergeAlertGenerationRefs(existing: RuntimeOrgWatchlistTermContext["alertGenerationRef"][], next: RuntimeOrgWatchlistTermContext["alertGenerationRef"][]): RuntimeOrgWatchlistTermContext["alertGenerationRef"][] {
  const byKey = new Map(existing.map((ref) => [ref.dedupe.key, ref]));
  for (const ref of next) byKey.set(ref.dedupe.key, byKey.get(ref.dedupe.key) ?? ref);
  return [...byKey.values()];
}

function buildSourceFamilyCoverage(candidates: DwmAlertGenerationCandidate[]): DwmAlertGenerationReadiness["sourceFamilyCoverage"] {
  const families = new Map<string, { sourceFamily: string; candidateIds: Set<string>; captureRefCount: number; watchlistIds: Set<string> }>();
  for (const candidate of candidates) {
    const candidateFamilies = candidate.sourceFamilies.length ? candidate.sourceFamilies : ["unknown"];
    for (const family of candidateFamilies) {
      const row = families.get(family) ?? { sourceFamily: family, candidateIds: new Set<string>(), captureRefCount: 0, watchlistIds: new Set<string>() };
      row.candidateIds.add(candidate.id);
      row.captureRefCount += candidate.captureRefs.filter((ref) => ref.sourceFamily === family).length;
      for (const watchlistId of candidate.watchlistIds) row.watchlistIds.add(watchlistId);
      families.set(family, row);
    }
  }
  return [...families.values()]
    .map((row) => ({
      sourceFamily: row.sourceFamily,
      candidateCount: row.candidateIds.size,
      captureRefCount: row.captureRefCount,
      watchlistIds: [...row.watchlistIds]
    }))
    .sort((a, b) => a.sourceFamily.localeCompare(b.sourceFamily));
}

const firstClassAlertSourceFamilies = ["telegram_public", "darkweb_metadata", "actor_page", "public_advisory", "clear_web"] as const;

function buildSourceFamilyGaps(input: {
  coverage: DwmAlertGenerationReadiness["sourceFamilyCoverage"];
  candidates: DwmAlertGenerationCandidate[];
  sources: SourceRecord[];
}): DwmAlertGenerationReadiness["sourceFamilyGaps"] {
  const coverageByFamily = new Map(input.coverage.map((row) => [row.sourceFamily, row]));
  const activeFamilies = new Set(input.sources
    .filter((source) => ["active", "approved", "canary"].includes(String((source as any).status ?? "").toLowerCase()))
    .map((source) => sourceFamilyFor(source, {} as RawCapture)));
  const staleFamilies = new Set(input.sources
    .filter((source) => isStaleSourceStatus((source as any).status))
    .map((source) => sourceFamilyFor(source, {} as RawCapture)));
  const activeWatchlistIds = uniqueStrings(input.candidates.flatMap((candidate) => candidate.watchlistIds));
  const families = uniqueStrings([
    ...firstClassAlertSourceFamilies,
    ...input.coverage.map((row) => row.sourceFamily),
    ...Array.from(activeFamilies)
  ]);
  return families.map((sourceFamily) => {
    const coverage = coverageByFamily.get(sourceFamily);
    const active = activeFamilies.has(sourceFamily);
    const stale = staleFamilies.has(sourceFamily);
    const candidateCount = coverage?.candidateCount ?? 0;
    const captureRefCount = coverage?.captureRefCount ?? 0;
    const state: DwmAlertGenerationReadiness["sourceFamilyGaps"][number]["state"] =
      captureRefCount > 0 && stale && !active ? "stale_source" : captureRefCount > 0 ? "matched" : active ? "active_no_match" : "inactive_or_unconfigured";
    return {
      schemaVersion: "dwm.alert_source_family_gap.v1" as const,
      sourceFamily,
      state,
      active,
      candidateCount,
      captureRefCount,
      watchlistIds: coverage?.watchlistIds ?? activeWatchlistIds,
      blockerCode: state === "active_no_match" ? "no_matching_captures" as const : state === "stale_source" ? "source_family_stale" as const : state === "inactive_or_unconfigured" ? "source_family_inactive" as const : undefined,
      detail: sourceFamilyGapDetail(sourceFamily, state)
    };
  }).sort((a, b) => a.sourceFamily.localeCompare(b.sourceFamily));
}

function sourceFamilyGapDetail(sourceFamily: string, state: DwmAlertGenerationReadiness["sourceFamilyGaps"][number]["state"]): string {
  if (state === "matched") return `Active watchlist terms matched ${sourceFamily} capture evidence.`;
  if (state === "active_no_match") return `${sourceFamily} has an active source, but no recent capture matched the active watchlist terms.`;
  if (state === "stale_source") return `${sourceFamily} has matching capture evidence, but the source is stale and must be refreshed before customer alert generation.`;
  return `${sourceFamily} has no active source row for this rebuild; alert generation must not invent evidence for this family.`;
}

function termMatchesText(text: string, term: string): boolean {
  const normalizedTerm = normalizeTerm(term);
  if (!normalizedTerm) return false;
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const domainLike = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizedTerm);
  const boundary = domainLike ? "a-z0-9.-" : "a-z0-9";
  return new RegExp(`(^|[^${boundary}])${escaped}(?=$|[^${boundary}])`, "i").test(text);
}

function sourceFamilyFor(source: SourceRecord | undefined, capture: RawCapture): string {
  return classifySourceFamily(source, capture);
}

function normalizeTerm(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeVisibilityPolicy(value: unknown): DwmAlertVisibilityPolicy {
  return value === "admins" || value === "owners" ? value : "members";
}
