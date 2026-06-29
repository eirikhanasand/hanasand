import { buildDwmProductSnapshot, classifySourceFamily, type DwmAlert, type DwmWatchTerm } from "../product/dwmProduct.ts";
import { stableId, uniqueStrings } from "../utils.ts";
import type { RawCapture, SourceRecord } from "../types.ts";
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
  watchlistIds: string[];
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
  deliveryDedupeKey: string;
  replayMarker?: string;
  sourceFamily: string;
  evidenceCount: number;
  selectedCaptureIds: string[];
  provenance: {
    matchBasis?: string;
    captureIds: string[];
    sourceIds: string[];
    generatedAt?: string;
  };
  workflow: {
    status: string;
    reviewState?: string;
    deliveryState?: string;
    assignedOwner?: string;
    severityOverride?: string;
    note?: string;
    rationale?: string;
    eventCount: number;
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
    dashboard: {
      route: "organization_watchlist";
      casePath?: string;
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
  blockerCodes: DwmCustomerProofBlockerCode[];
  typedBlockers: Array<{ code: DwmCustomerProofBlockerCode; field: string; detail: string; recoverable: boolean }>;
  generatedAt: string;
};

export type DwmAlertDownstreamHandoff = {
  schemaVersion: "dwm.alert_downstream_handoff.v1";
  handoffId: string;
  alertId?: string;
  tenantId?: string;
  organizationId?: string;
  ready: boolean;
  sourceFamily?: string;
  watchlist: {
    watchlistIds: string[];
    watchlistItemIds: string[];
    alertGeneratorKeys: string[];
  };
  evidence: {
    evidenceCount: number;
    selectedCaptureIds: string[];
    captureIds: string[];
    sourceIds: string[];
    provenanceGeneratedAt?: string;
    matchBasis?: string;
  };
  dedupe: {
    alertDedupeKey?: string;
    deliveryDedupeKey?: string;
    replayMarker?: string;
  };
  workflowVersion: {
    eventCount: number;
    updatedAt?: string;
    expectedEventCount?: number;
    replayCount: number;
    lastReplayedAt?: string;
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
  lifecycle: {
    organizationStatus?: string;
    retiredWatchlistIds: string[];
    disabledDestinationIds: string[];
    alertStatus: string;
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
  return {
    schemaVersion: "dwm.alert_workflow_execution_readiness.v1",
    alertId: alert?.id,
    organizationId: input.organizationId ?? alert?.organizationId,
    ready: blockers.length === 0,
    action,
    expectedWorkflowEventCount: input.expectedWorkflowEventCount,
    currentWorkflowEventCount,
    expectedUpdatedAt: input.expectedUpdatedAt,
    currentUpdatedAt,
    blockerCodes: uniqueStrings(blockers.map((blocker) => blocker.code)) as DwmAlertWorkflowExecutionBlockerCode[],
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
  watchlistTermContexts: RuntimeOrgWatchlistTermContext[];
  alertGeneratorKeys: string[];
  alertGenerationRefs: RuntimeOrgWatchlistTermContext["alertGenerationRef"][];
  dedupeSeed: string;
  dedupeKeyCandidate: string;
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
    captureRefCount: number;
    matchedCandidateCount: number;
    unmatchedCandidateCount: number;
  };
  sourceFamilyCoverage: Array<{ sourceFamily: string; candidateCount: number; captureRefCount: number; watchlistIds: string[] }>;
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
  sourceFamily: string;
  evidenceCount: number;
  recommendedRoute?: string;
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
  const sources = input.store.listSources();
  const captures = input.store.listCaptures();
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
    captures,
    includeDemoIfEmpty: false
  });
  const generationReadiness = buildDwmAlertGenerationReadiness({
    watchlists,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    visibilityPolicy: input.visibilityPolicy,
    sources,
    captures
  });

  const alerts = snapshot.alerts
    .filter((alert) => alertSourceFamilyActive(sources, alert.sourceFamily))
    .map((alert) => {
    const generationCandidate = findGenerationCandidate(generationPlan, alert);
    const scopedAlert = scopeAlertForGenerationCandidate(alert, generationCandidate, input);
    const existing = findExistingAlert(input.store, scopedAlert, input.tenantId, input.organizationId);
    const alertId = existing?.id ?? scopedAlert.id;
    const generatedWorkflowContext = buildDwmAlertWorkflowContext({
      alert: { ...scopedAlert, id: alertId },
      tenantId: input.tenantId,
      organizationId: input.organizationId ?? existing?.organizationId,
      generationCandidate
    });
    const workflowContext = {
      ...generatedWorkflowContext,
      caseId: existing?.caseId,
      casePath: existing?.casePath ?? generatedWorkflowContext.casePath
    };
    const deliveryReadinessContext = buildDwmPersistedDeliveryReadinessContext({
      alert: { ...scopedAlert, id: alertId },
      tenantId: input.tenantId,
      organizationId: input.organizationId ?? existing?.organizationId,
      workflowContext,
      existing,
      generatedAt: snapshot.generatedAt
    });
    return input.store.saveDwmAlert({
      ...scopedAlert,
      id: alertId,
      tenantId: input.tenantId,
      organizationId: input.organizationId ?? existing?.organizationId,
      watchlistIds: workflowContext.watchlistIds,
      watchlistItemIds: workflowContext.watchlistItemIds,
      workflowContext,
      webhookContext: buildDwmAlertWebhookContext(alert, workflowContext),
      deliveryReadinessContext,
      caseIdCandidate: workflowContext.caseIdCandidate,
      caseId: existing?.caseId,
      casePath: existing?.casePath ?? workflowContext.casePath,
      workflowStatus: existing?.workflowStatus ?? (alert as any).workflowStatus ?? "new",
      reviewState: existing?.reviewState ?? alert.reviewState,
      deliveryState: existing?.deliveryState ?? "pending_review",
      workflowEvents: existing?.workflowEvents ?? [],
      workflowNote: existing?.workflowNote,
      workflowRationale: existing?.workflowRationale,
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
    !input.organizationId || alertGeneratorKeys.length === 0 ? readinessBlocker("missing_org_ref", "workflowContext.alertGeneratorKeys", "Org alert generation reference is required before delivery.", true) : undefined,
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
    sourceFamily: String(input.alert.sourceFamily ?? input.workflowContext.sourceFamily ?? "unknown"),
    evidenceCount,
    recommendedRoute: input.alert.recommendedRoute ?? input.alert.webhookDelivery?.recommendedRoute ?? input.workflowContext.recommendedRoute,
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
  const sources = input.sources ?? [];
  const captures = input.captures ?? [];
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
      const captureRefs = captureRefsForTerm({ term, sources, captures });
      const sourceFamilies = uniqueStrings(captureRefs.map((ref) => ref.sourceFamily));
      const watchlistTermContexts = watchlistTermContextsFor(watchlist, term.value);
      if (existing) {
        existing.watchlistIds = uniqueStrings([...existing.watchlistIds, watchlist.id]);
        existing.watchlistItemIds = uniqueStrings([...existing.watchlistItemIds, ...watchlistItemIdsFor(watchlist, term.value)]);
        existing.webhookDestinationIds = uniqueStrings([...existing.webhookDestinationIds, watchlist.webhookDestinationId].filter(Boolean) as string[]);
        existing.hasWebhookRoute = existing.hasWebhookRoute || Boolean(watchlist.webhookDestinationId || watchlist.webhookUrl);
        existing.captureRefs = mergeCaptureRefs(existing.captureRefs, captureRefs);
        existing.sourceFamilies = uniqueStrings([...existing.sourceFamilies, ...sourceFamilies]);
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

export function buildDwmAlertGenerationReadiness(input: {
  watchlists: RuntimeDwmWatchlist[];
  tenantId: string;
  organizationId?: string;
  visibilityPolicy?: DwmAlertVisibilityPolicy;
  sources?: SourceRecord[];
  captures?: RawCapture[];
  productDedupePatched?: boolean;
}): DwmAlertGenerationReadiness {
  const plan = buildDwmAlertGenerationPlan(input);
  const rawActiveTermCount = input.watchlists
    .filter((watchlist) => watchlist.tenantId === input.tenantId && watchlist.status === "active" && (!watchlist.organizationId || watchlist.organizationId === input.organizationId))
    .reduce((count, watchlist) => count + watchlist.terms.length, 0);
  const captureRefCount = plan.candidates.reduce((count, candidate) => count + candidate.captureRefs.length, 0);
  const sourceFamilyCoverage = buildSourceFamilyCoverage(plan.candidates);
  const candidateIdsMissingRoute = plan.candidates.filter((candidate) => !candidate.hasWebhookRoute).map((candidate) => candidate.id);
  const productDedupePatched = input.productDedupePatched !== false;
  const typedBlockers = buildGenerationReadinessBlockers({
    watchlists: input.watchlists,
    organizationId: input.organizationId,
    plan,
    sources: input.sources ?? [],
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
    webhookReadiness: {
      ready: plan.candidateCount > 0 && candidateIdsMissingRoute.length === 0,
      routedCandidateCount: plan.candidates.filter((candidate) => candidate.hasWebhookRoute).length,
      missingRouteCandidateCount: candidateIdsMissingRoute.length,
      webhookDestinationIds: uniqueStrings(plan.candidates.flatMap((candidate) => candidate.webhookDestinationIds)),
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
      watchlistIds: plan.activeWatchlistIds,
      candidateIdsMissingRoute
    }),
    plan
  };
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
    workflow_context: alert.workflowContext,
    webhook_context: alert.webhookContext,
    case_id_candidate: alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate ?? null,
    case_path: alert.casePath ?? alert.workflowContext?.casePath ?? null,
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
  const watchlistIds = uniqueStrings(asStringArray(context.watchlistIds ?? workflow.watchlistIds ?? webhook.watchlistIds ?? alert.watchlistIds));
  const watchlistItemIds = uniqueStrings(asStringArray(context.watchlistItemIds ?? workflow.watchlistItemIds ?? webhook.watchlistItemIds ?? alert.watchlistItemIds));
  const delivered = Boolean(alert.deliveredAt) || alert.deliveryState === "delivered" || deliveries.some((delivery) => delivery.status === "delivered") || context.state === "delivered";
  const redactionRequired = input.supportOnlyRedactionNeeded === true || (alert.evidence ?? []).some((item: any) => item.redactionState === "raw_sensitive");
  const hasCaseRoute = Boolean(context.casePath ?? alert.casePath ?? workflow.casePath);
  const blockers = [
    ...((context.blockers ?? []) as DwmAlertCustomerProofHandoffRow["typedBlockers"]),
    !alert.organizationId ? customerProofBlocker("no_org_export", "organizationId", "Org/customer alert proof requires an organization id.", true) : undefined,
    !alertGeneratorKeys.length ? customerProofBlocker("org_export_unavailable", "workflowContext.alertGeneratorKeys", "Org watchlist export reference is missing from the persisted alert.", true) : undefined,
    !selectedCaptureIds.length ? customerProofBlocker("no_matching_captures", "selectedCaptureIds", "No matching captures are attached to this alert proof.", true) : undefined,
    evidenceCount === 0 ? customerProofBlocker("missing_evidence", "evidence", "Customer proof requires persisted evidence.", true) : undefined,
    !hasCaseRoute ? customerProofBlocker("case_route_unavailable", "casePath", "Case handoff route is unavailable for this alert.", true) : undefined,
    input.webhookDestinationLifecycle && input.webhookDestinationLifecycle.verified === false ? customerProofBlocker("webhook_destination_not_verified", "webhookDestinationLifecycle.verified", "Webhook destination exists but is not verified for customer delivery.", true) : undefined,
    redactionRequired ? customerProofBlocker("support_only_redaction_needed", "evidence.redactionState", "Support/helpdesk consumers must use redacted evidence only.", true) : undefined,
    delivered ? customerProofBlocker("duplicate_delivered_dedupe", "deliveryDedupeKey", "This alert has delivered history; replay must preserve the same dedupe key.", false) : undefined
  ].filter(Boolean) as DwmAlertCustomerProofHandoffRow["typedBlockers"];
  const blockerCodes = uniqueStrings(blockers.map((blocker) => blocker.code)) as DwmCustomerProofBlockerCode[];
  const deliveryState = String(context.state ?? alert.deliveryState ?? "pending_review");
  const deliveryReady = Boolean(context.ready) && !blockerCodes.includes("webhook_destination_not_verified") && !blockerCodes.includes("support_only_redaction_needed");
  return {
    schemaVersion: "dwm.customer_alert_proof.v1",
    alertId: String(alert.id),
    tenantId: String(alert.tenantId ?? workflow.tenantId ?? webhook.tenantId ?? "default"),
    organizationId: alert.organizationId ?? workflow.organizationId ?? webhook.organizationId,
    dedupeKey: String(alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey ?? workflow.dedupeKey),
    deliveryDedupeKey: String(context.deliveryDedupeKey ?? alert.webhookDelivery?.dedupeKey ?? alert.dedupeKey),
    replayMarker: context.replayMarker,
    sourceFamily: String(context.sourceFamily ?? alert.sourceFamily ?? workflow.sourceFamily ?? "unknown"),
    evidenceCount,
    selectedCaptureIds,
    provenance: {
      matchBasis: alert.provenance?.matchBasis,
      captureIds: uniqueStrings(asStringArray(alert.provenance?.captureIds ?? selectedCaptureIds)),
      sourceIds: uniqueStrings(asStringArray(alert.provenance?.sourceIds ?? (alert.evidence ?? []).map((item: any) => item.sourceId ?? item.provenance?.sourceId))),
      generatedAt: alert.provenance?.generatedAt
    },
    workflow: {
      status: String(alert.workflowStatus ?? "new"),
      reviewState: alert.reviewState,
      deliveryState: alert.deliveryState,
      assignedOwner: alert.assignedOwner,
      severityOverride: alert.severityOverride,
      note: alert.workflowNote,
      rationale: alert.workflowRationale,
      eventCount: (alert.workflowEvents ?? []).length,
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
      dashboard: {
        route: "organization_watchlist",
        casePath: context.casePath ?? alert.casePath ?? workflow.casePath,
        fields: ["organizationId", "tenantId", "alertId", "casePath", "watchlistItemIds", "workflow.status"]
      },
      helpdesk: {
        redacted: true,
        supportOnlyRedactionNeeded: redactionRequired,
        safeFields: ["organizationId", "tenantId", "alertId", "sourceFamily", "evidenceCount", "caseHandoff.ready", "delivery.state"]
      },
      publicTI: {
        canConsume: alertGeneratorKeys.length > 0,
        fields: ["organizationId", "tenantId", "sourceFamily", "provenance.captureIds", "alertGeneratorKeys"]
      },
      roleGates: {
        create_watchlist: ["owner", "admin"],
        edit_watchlist_terms: ["owner", "admin"],
        acknowledge_alert: ["owner", "admin", "analyst"],
        assign_case: ["owner", "admin", "analyst"],
        manage_invites: ["owner", "admin"]
      }
    },
    blockerCodes,
    typedBlockers: blockers,
    generatedAt
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
  const sourceIds = uniqueStrings(asStringArray(alert?.provenance?.sourceIds ?? (alert?.evidence ?? []).map((item: any) => item.sourceId ?? item.provenance?.sourceId)));
  const watchlistIds = uniqueStrings(asStringArray(context.watchlistIds ?? workflow.watchlistIds ?? webhook.watchlistIds ?? alert?.watchlistIds));
  const watchlistItemIds = uniqueStrings(asStringArray(context.watchlistItemIds ?? workflow.watchlistItemIds ?? webhook.watchlistItemIds ?? alert?.watchlistItemIds));
  const alertGeneratorKeys = uniqueStrings(asStringArray(context.alertGeneratorKeys ?? workflow.alertGeneratorKeys ?? webhook.alertGeneratorKeys));
  const webhookDestinationIds = uniqueStrings(asStringArray(context.webhookDestinationIds ?? workflow.webhookDestinationIds ?? webhook.webhookDestinationIds));
  const deliveryHistoryRefs = uniqueStrings([
    ...asStringArray(context.deliveryHistoryRefs),
    ...deliveries.map((delivery) => delivery.id).filter(Boolean)
  ].map(String));
  const lastDelivery = [...deliveries]
    .sort((a, b) => String(a.attemptedAt ?? "").localeCompare(String(b.attemptedAt ?? "")))
    .at(-1);
  const eventCount = (alert?.workflowEvents ?? []).length;
  const orgId = input.organizationId ?? alert?.organizationId ?? workflow.organizationId ?? webhook.organizationId;
  const casePath = context.casePath ?? alert?.casePath ?? workflow.casePath;
  const caseIdCandidate = context.caseIdCandidate ?? alert?.caseIdCandidate ?? workflow.caseIdCandidate;
  const deliveryDedupeKey = String(context.deliveryDedupeKey ?? alert?.webhookDelivery?.dedupeKey ?? alert?.dedupeKey ?? "");
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
    !selectedCaptureIds.length || evidenceCount === 0 ? "missing_capture_evidence" : undefined,
    webhookDestinationIds.length === 0 ? "delivery_disabled" : undefined
  ].filter(Boolean).map(String)) as Array<DwmAlertDownstreamHandoffBlockerCode | DwmDeliveryReadinessBlockerCode>;
  const deliverySelectionReady = deliverySelectionBlockerCodes.length === 0 && enabledWebhookDestinationIds.length > 0;
  const deliveryIdempotencyKey = alertId && deliveryDedupeKey ? stableId("dwm_delivery_handoff", `${orgId ?? tenantId}:${alertId}:${deliveryDedupeKey}`) : undefined;
  return {
    schemaVersion: "dwm.alert_downstream_handoff.v1",
    handoffId: stableId("dwm_downstream_handoff", `${tenantId ?? "missing"}:${orgId ?? "missing"}:${alertId ?? "missing"}:${deliveryDedupeKey}:${eventCount}`),
    alertId,
    tenantId,
    organizationId: orgId,
    ready: blockerCodes.length === 0,
    sourceFamily: context.sourceFamily ?? alert?.sourceFamily ?? workflow.sourceFamily ?? webhook.sourceFamily,
    watchlist: {
      watchlistIds,
      watchlistItemIds,
      alertGeneratorKeys
    },
    evidence: {
      evidenceCount,
      selectedCaptureIds,
      captureIds,
      sourceIds,
      provenanceGeneratedAt: alert?.provenance?.generatedAt,
      matchBasis: alert?.provenance?.matchBasis
    },
    dedupe: {
      alertDedupeKey: alert?.dedupeKey ?? alert?.webhookDelivery?.dedupeKey,
      deliveryDedupeKey,
      replayMarker: context.replayMarker
    },
    workflowVersion: {
      eventCount,
      updatedAt: alert?.updatedAt,
      expectedEventCount: input.expectedWorkflowEventCount,
      replayCount: Number(alert?.replayCount ?? 0),
      lastReplayedAt: alert?.lastReplayedAt
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
    lifecycle: {
      organizationStatus,
      retiredWatchlistIds,
      disabledDestinationIds,
      alertStatus,
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
      replayMarker: context.replayMarker,
      nextReplayIdempotencyKey: alertId && context.replayMarker ? stableId("dwm_replay_handoff", `${orgId ?? tenantId}:${alertId}:${context.replayMarker}:${eventCount}`) : undefined
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
  watchlistIds: string[];
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
    watchlistIds: input.watchlistIds,
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
  const candidateFamilies = uniqueStrings(candidates.flatMap((candidate) => candidate.captureRefs.map((ref) => ref.sourceFamily)));
  return candidateFamilies.filter((family) => !activeFamilies.has(family));
}

function alertSourceFamilyActive(sources: SourceRecord[], sourceFamily: string): boolean {
  return sources.some((source) => ["active", "approved", "canary"].includes(String((source as any).status ?? "").toLowerCase()) && sourceFamilyFor(source, {} as RawCapture) === sourceFamily);
}

export function buildDwmAlertWorkflowContext(input: {
  alert: DwmAlert;
  tenantId: string;
  organizationId?: string;
  watchlists?: RuntimeDwmWatchlist[];
  generationCandidate?: DwmAlertGenerationCandidate;
}) {
  const captureIds = input.alert.provenance?.captureIds ?? (input.alert.evidence ?? []).map((item) => item.provenance?.captureId ?? item.id);
  const watchlists = input.watchlists ?? [];
  const watchlistIds = input.generationCandidate?.watchlistIds ?? watchlists.map((watchlist) => watchlist.id);
  const watchlistItemIds = input.generationCandidate?.watchlistItemIds ?? watchlists.flatMap((watchlist) => watchlistItemIdsFor(watchlist, input.alert.matchedTerm?.value));
  const dedupeKey = String(input.alert.dedupeKey ?? input.alert.webhookDelivery?.dedupeKey);
  const caseIdCandidate = stableId("case", `${input.tenantId}:${input.alert.id}`);
  return {
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    visibilityPolicy: input.generationCandidate?.visibilityPolicy,
    membershipContext: input.generationCandidate?.membershipContext,
    generationCandidateId: input.generationCandidate?.id,
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
    evidenceCount: (input.alert.evidence ?? []).length,
    dedupeKey,
    recommendedRoute: input.alert.recommendedRoute ?? input.alert.webhookDelivery?.recommendedRoute,
    casePath: `/v1/cases/${encodeURIComponent(caseIdCandidate)}?alertId=${encodeURIComponent(input.alert.id)}&dedupeKey=${encodeURIComponent(dedupeKey)}`,
    webhookDestinationIds: input.generationCandidate?.webhookDestinationIds ?? watchlists.map((watchlist) => watchlist.webhookDestinationId).filter(Boolean),
    hasWebhookRoute: input.generationCandidate?.hasWebhookRoute ?? watchlists.some((watchlist) => Boolean(watchlist.webhookDestinationId || watchlist.webhookUrl))
  };
}

export function buildDwmAlertWebhookContext(alert: DwmAlert, workflowContext: ReturnType<typeof buildDwmAlertWorkflowContext>) {
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
    matchedTermCategory: workflowContext.matchedTermCategory,
    actor: workflowContext.actor,
    entity: workflowContext.entity,
    watchlistProvenance: workflowContext.watchlistProvenance,
    sourceFamily: workflowContext.sourceFamily,
    captureIds: workflowContext.captureIds,
    evidenceCount: workflowContext.evidenceCount,
    dedupeKey: workflowContext.dedupeKey,
    recommendedRoute: workflowContext.recommendedRoute,
    caseIdCandidate: workflowContext.caseIdCandidate,
    casePath: workflowContext.casePath,
    severity: alert.severity,
    confidence: alert.confidence,
    confidenceReasoning: alert.confidenceReasoning ?? [],
    provenance: alert.provenance,
    claimSummary: alert.claimSummary
  };
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
  return store.listDwmAlerts()
    .filter((row) => String(row.tenantId ?? "") === tenantId)
    .filter((row) => organizationId ? row.organizationId === organizationId : !row.organizationId)
    .find((row) => row.id === alert.id || row.dedupeKey === dedupeKey || row.webhookDelivery?.dedupeKey === dedupeKey);
}

function findGenerationCandidate(plan: DwmAlertGenerationPlan, alert: DwmAlert): DwmAlertGenerationCandidate | undefined {
  const normalizedTerm = normalizeTerm(alert.matchedTerm?.value);
  return plan.candidates.find((candidate) => candidate.normalizedTerm === normalizedTerm && candidate.term.kind === alert.matchedTerm?.kind)
    ?? plan.candidates.find((candidate) => candidate.normalizedTerm === normalizedTerm);
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
    .filter((term) => term.normalizedTerm === normalized || term.value.toLowerCase() === normalized || term.terms.some((value) => value.toLowerCase() === normalized));
}

function captureRefsForTerm(input: { term: DwmWatchTerm; sources: SourceRecord[]; captures: RawCapture[] }): DwmAlertGenerationCaptureRef[] {
  return input.captures
    .filter((capture) => captureText(capture).includes(normalizeTerm(input.term.value)))
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
}

function mergeCaptureRefs(existing: DwmAlertGenerationCaptureRef[], next: DwmAlertGenerationCaptureRef[]): DwmAlertGenerationCaptureRef[] {
  const byId = new Map(existing.map((ref) => [ref.captureId, ref]));
  for (const ref of next) byId.set(ref.captureId, byId.get(ref.captureId) ?? ref);
  return [...byId.values()];
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

function captureText(capture: RawCapture): string {
  return [
    (capture as any).body,
    (capture as any).text,
    JSON.stringify((capture as any).metadata ?? {})
  ].map((value) => String(value ?? "").toLowerCase()).join("\n");
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
