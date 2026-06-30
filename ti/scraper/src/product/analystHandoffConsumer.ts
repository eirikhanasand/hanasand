import {
  ANALYST_HANDOFF_SCHEMA_VERSION,
  ORG_ALERT_WATCHLIST_READINESS_SCHEMA_VERSION,
  mergeAnalystHandoffIdentity,
  type AlertCaseAdapterValue,
  type AlertGenerationAdapterValue,
  type AlertWebhookAdapterValue,
  type AnalystHandoffBlocker,
  type AnalystHandoffBlockerCode,
  type AnalystHandoffEnvelope,
  type AnalystHandoffIdentity,
  type AnalystHandoffIdentityMismatchError,
  type AnalystHandoffKind,
  type ActorWatchlistAdapterValue,
  type OrgScopedAlertWatchlistReadiness,
} from "./analystHandoff.ts";
import { nowIso } from "../utils.ts";

export const ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION = "hanasand.analyst_handoff.consumer.v1" as const;
export const ANALYST_HANDOFF_VALIDATION_REPORT_SCHEMA_VERSION = "hanasand.analyst_handoff.validation_report.v1" as const;
export const PUBLIC_TI_HANDOFF_SCHEMA_VERSION = "ti.public_actor.authenticated_bridge.v1" as const;
export const ORG_ALERT_TERMS_EXPORT_SCHEMA_VERSION = "organization.watchlist_alert_terms_export.v1" as const;
export const ORG_ALERT_GENERATION_REF_SCHEMA_VERSION = "organization.watchlist_alert_generation_ref.v1" as const;
export const DWM_WEBHOOK_AUDIT_EVENT_SCHEMA_VERSION = "dwm.webhook.audit_event.v1" as const;
export const DWM_WEBHOOK_DESTINATION_LIFECYCLE_SCHEMA_VERSION = "dwm.webhook.destination_lifecycle.v1" as const;
export const DWM_ENTITLEMENT_READ_MODEL_SCHEMA_VERSION = "dwm.entitlement_read_model.v1" as const;
export const DWM_SOURCE_WORKER_READINESS_SCHEMA_VERSION = "dwm.source_worker_readiness.v1" as const;
export const CASE_ROUTE_AVAILABILITY_SCHEMA_VERSION = "case.route_availability.v1" as const;
export const HELPDESK_ACTION_AVAILABILITY_SCHEMA_VERSION = "helpdesk.action_availability.v1" as const;
export const DWM_ENTITLEMENT_BLOCKER_SCHEMA_VERSION = "dwm.entitlement_blocker.v1" as const;
export const DWM_SOURCE_PACK_ACTION_CONTRACT_SCHEMA_VERSION = "dwm.source_pack_action_contract.v1" as const;
export const SUPPORT_ACTION_EXECUTION_HANDOFF_SCHEMA_VERSION = "support.action_execution_handoff.v1" as const;
export const ANALYST_HANDOFF_DEPLOY_GATE_ASSERTIONS_SCHEMA_VERSION = "hanasand.analyst_handoff.deploy_gate_assertions.v1" as const;
export const PUBLIC_TI_READINESS_SCHEMA_VERSION = "ti.public_actor.readiness.v1" as const;
export const DWM_WEBHOOK_DESTINATION_ADMIN_PROOF_ROW_SCHEMA_VERSION = "dwm.webhook.destination_admin_proof_row.v1" as const;
export const ORGANIZATION_LIFECYCLE_READINESS_SCHEMA_VERSION = "organization.lifecycle_readiness.v1" as const;
export const SUPPORT_ACTION_EXECUTOR_READINESS_SCHEMA_VERSION = "support.action_executor_readiness.v1" as const;
export const ANALYST_HANDOFF_READINESS_MATRIX_SCHEMA_VERSION = "hanasand.analyst_handoff.readiness_matrix.v1" as const;
export const PRODUCT_READINESS_SCHEMA_VERSION = "hanasand.product_readiness.v1" as const;
export const BETA_READINESS_SCHEMA_VERSION = "hanasand.beta_readiness.v1" as const;
export const BETA_READINESS_DEPLOY_GATE_COVERAGE_SCHEMA_VERSION = "hanasand.beta_readiness.deploy_gate_coverage.v1" as const;
export const UI_QUALITY_PROOF_SCHEMA_VERSION = "hanasand.ui_quality_proof.v1" as const;
export const ORG_SHARED_WATCHLIST_ALERT_EXPORT_SCHEMA_VERSION = "organization.shared_watchlist_alert_generation_export.v1" as const;
export const ORG_SHARED_WATCHLIST_ALERT_CONSUMERS_SCHEMA_VERSION = "organization.shared_watchlist_alert_generation_consumers.v1" as const;
export const ORG_SHARED_WATCHLIST_READINESS_PROOF_SCHEMA_VERSION = "organization.shared_watchlist_readiness_proof.v1" as const;

export const ANALYST_HANDOFF_CONTRACT_VERSIONS = {
  consumer: ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION,
  orgAlertWatchlistReadiness: ORG_ALERT_WATCHLIST_READINESS_SCHEMA_VERSION,
  validationReport: ANALYST_HANDOFF_VALIDATION_REPORT_SCHEMA_VERSION,
  publicTi: PUBLIC_TI_HANDOFF_SCHEMA_VERSION,
  orgAlertTermsExport: ORG_ALERT_TERMS_EXPORT_SCHEMA_VERSION,
  orgAlertGenerationRef: ORG_ALERT_GENERATION_REF_SCHEMA_VERSION,
  webhookAuditEvent: DWM_WEBHOOK_AUDIT_EVENT_SCHEMA_VERSION,
  webhookDestinationLifecycle: DWM_WEBHOOK_DESTINATION_LIFECYCLE_SCHEMA_VERSION,
  entitlementReadModel: DWM_ENTITLEMENT_READ_MODEL_SCHEMA_VERSION,
  sourceWorkerReadiness: DWM_SOURCE_WORKER_READINESS_SCHEMA_VERSION,
  caseRouteAvailability: CASE_ROUTE_AVAILABILITY_SCHEMA_VERSION,
  helpdeskActionAvailability: HELPDESK_ACTION_AVAILABILITY_SCHEMA_VERSION,
  entitlementBlocker: DWM_ENTITLEMENT_BLOCKER_SCHEMA_VERSION,
  sourcePackActionContract: DWM_SOURCE_PACK_ACTION_CONTRACT_SCHEMA_VERSION,
  supportActionExecutionHandoff: SUPPORT_ACTION_EXECUTION_HANDOFF_SCHEMA_VERSION,
  deployGateAssertions: ANALYST_HANDOFF_DEPLOY_GATE_ASSERTIONS_SCHEMA_VERSION,
  publicTiReadiness: PUBLIC_TI_READINESS_SCHEMA_VERSION,
  webhookDestinationAdminProofRow: DWM_WEBHOOK_DESTINATION_ADMIN_PROOF_ROW_SCHEMA_VERSION,
  organizationLifecycleReadiness: ORGANIZATION_LIFECYCLE_READINESS_SCHEMA_VERSION,
  supportActionExecutorReadiness: SUPPORT_ACTION_EXECUTOR_READINESS_SCHEMA_VERSION,
  readinessMatrix: ANALYST_HANDOFF_READINESS_MATRIX_SCHEMA_VERSION,
  productReadiness: PRODUCT_READINESS_SCHEMA_VERSION,
  betaReadiness: BETA_READINESS_SCHEMA_VERSION,
  betaDeployGateCoverage: BETA_READINESS_DEPLOY_GATE_COVERAGE_SCHEMA_VERSION,
  uiQualityProof: UI_QUALITY_PROOF_SCHEMA_VERSION,
  orgSharedWatchlistAlertExport: ORG_SHARED_WATCHLIST_ALERT_EXPORT_SCHEMA_VERSION,
  orgSharedWatchlistAlertConsumers: ORG_SHARED_WATCHLIST_ALERT_CONSUMERS_SCHEMA_VERSION,
  orgSharedWatchlistReadinessProof: ORG_SHARED_WATCHLIST_READINESS_PROOF_SCHEMA_VERSION
} as const;

export const PRODUCT_READINESS_FORBIDDEN_LANGUAGE = [
  "control room",
  "how this feeds",
  "dashboard slop",
  "named examples",
  "signal",
  "acceptance criteria",
  "acceptance-criteria",
  "acceptance criterion",
  "coordinator"
] as const;

export type AnalystHandoffConsumerBlockerCode =
  | AnalystHandoffBlockerCode
  | "missing_schema"
  | "unsupported_schema"
  | "missing_stage"
  | "missing_identity"
  | "invalid_request"
  | "entitlement_blocked"
  | "nonmember"
  | "alert_generation_ref_mismatch"
  | "org_terms_contract_mismatch"
  | "webhook_trigger_contract_mismatch"
  | "webhook_audit_contract_mismatch"
  | "webhook_destination_lifecycle_mismatch"
  | "source_worker_not_ready"
  | "case_route_unavailable"
  | "public_ti_contract_mismatch"
  | "helpdesk_action_unavailable";

export type AnalystHandoffOwnerLane =
  | "org"
  | "alert"
  | "source"
  | "entitlement"
  | "webhook"
  | "case"
  | "publicTI"
  | "helpdesk";

export type AnalystHandoffConsumerBlocker = Omit<AnalystHandoffBlocker, "code"> & {
  code: AnalystHandoffConsumerBlockerCode;
  stage: AnalystHandoffConsumerStageName | "bundle" | "membership" | "entitlement" | "org_terms_export" | "webhook_audit" | "webhook_lifecycle" | "source_readiness" | "case_route" | "public_ti" | "helpdesk";
  action?: string;
  route?: string;
  evidenceSchemaVersion?: string;
};

export type AnalystHandoffConsumerStageName = "publicTi" | "orgWatchlist" | "caseHandoff" | "webhookTrigger";

export type AnalystHandoffConsumerMembership = {
  userId: string;
  organizationId: string;
  role: string;
  status: "active" | "pending" | "disabled" | "removed";
  allowedRoles: string[];
};

export type AnalystHandoffConsumerEntitlement = {
  schemaVersion?: typeof DWM_ENTITLEMENT_READ_MODEL_SCHEMA_VERSION;
  allowed: boolean;
  reason?: string;
  feature?: string;
  plan?: string;
  checkedAt?: string;
};

export type AnalystHandoffSourceWorkerReadiness = {
  schemaVersion: typeof DWM_SOURCE_WORKER_READINESS_SCHEMA_VERSION;
  ready: boolean;
  freshProvenance: boolean;
  sourceIds: string[];
  blockers: string[];
  checkedAt: string;
};

export type AnalystHandoffCaseRouteAvailability = {
  schemaVersion: typeof CASE_ROUTE_AVAILABILITY_SCHEMA_VERSION;
  available: boolean;
  path: "/v1/cases";
  methods: Array<"POST">;
  reason?: string;
  checkedAt: string;
};

export type AnalystHandoffPublicTiContract = {
  schemaVersion: typeof PUBLIC_TI_HANDOFF_SCHEMA_VERSION;
  source: "public-ti";
  action: string;
  artifactId: string;
  query: string;
  generatedAt: string;
  artifact: {
    id: string;
    kind: string;
    label: string;
    freshness?: string;
    provenance?: string[];
    watchlistTerms?: Array<{ kind: string; value: string; notes?: string }>;
  };
  orgRequired: boolean;
  sourceRequired: boolean;
  stale: boolean;
  missing: string[];
  blockers: Array<{ code: string; detail: string }>;
};

export type AnalystHandoffHelpdeskActionAvailability = {
  schemaVersion: typeof HELPDESK_ACTION_AVAILABILITY_SCHEMA_VERSION;
  available: boolean;
  action: "open_case" | "escalate" | "assign" | "notify_customer";
  route?: string;
  reason?: string;
  checkedAt: string;
};

export type AnalystHandoffEntitlementBlockerContract = {
  schemaVersion: typeof DWM_ENTITLEMENT_BLOCKER_SCHEMA_VERSION;
  ownerLane: string;
  actionId: string;
  action: string;
  blockerCode: string;
  blockedAction: string | null;
  status: string;
  route?: string;
  requestId?: string;
  nextStep: string;
  supportText: string;
  dashboardText: string;
  source: "entitlement" | "visibility" | "missing_prerequisite" | "analyst_handoff";
};

export type AnalystHandoffSourcePackActionContract = {
  schemaVersion: typeof DWM_SOURCE_PACK_ACTION_CONTRACT_SCHEMA_VERSION;
  mode: "prepare" | "execute";
  action: string;
  requestedAction?: string;
  allowed: boolean;
  idempotencyKey: string;
  sourcePackId?: string;
  candidateId?: string;
  sourceId?: string;
  blockers: Array<{ code?: string; severity?: string; message?: string; retryable?: boolean }>;
};

export type AnalystHandoffSupportActionExecution = {
  schemaVersion: typeof SUPPORT_ACTION_EXECUTION_HANDOFF_SCHEMA_VERSION;
  executable: boolean;
  action: string;
  idempotencyKey: string;
  correlationId?: string;
  requestId?: string;
  blockers: string[];
  execution?: {
    method?: string;
    path?: string;
  };
  audit?: {
    blockerCode?: string | null;
  };
  executorReadiness?: AnalystHandoffSupportExecutorReadiness;
};

export type AnalystHandoffPublicTiReadinessRow = {
  schemaVersion: typeof PUBLIC_TI_READINESS_SCHEMA_VERSION;
  state: "ready" | "review" | "degraded" | "blocked";
  backedIds?: {
    organizationIds?: string[];
    watchlistIds?: string[];
    alertIds?: string[];
    casePaths?: string[];
    captureIds?: string[];
    webhookDestinationIds?: string[];
  };
  blockers?: Array<{
    code: string;
    ownerLane: "org" | "alert" | "case" | "webhook" | "source" | "entitlement" | "public-ti";
    route?: string;
  }>;
};

export type AnalystHandoffWebhookDestinationAdminProofRow = {
  schemaVersion: typeof DWM_WEBHOOK_DESTINATION_ADMIN_PROOF_ROW_SCHEMA_VERSION;
  destinationId: string;
  orgId: string;
  access?: {
    canRead?: boolean;
    canManage?: boolean;
    memberSafe?: boolean;
  };
  health?: {
    ready?: boolean;
    status?: string;
    adminProofBlockers?: Array<{ code?: string }>;
  };
  retry?: {
    retryable?: boolean;
    lastErrorCategory?: string | null;
  };
};

export type AnalystHandoffOrgLifecycleReadinessRow = {
  schemaVersion: typeof ORGANIZATION_LIFECYCLE_READINESS_SCHEMA_VERSION;
  organizationId: string;
  tenantId: string;
  readyForOnboarding: boolean;
  typedBlockers: string[];
  watchlistReadiness?: { ready?: boolean };
  alertExportReadiness?: { ready?: boolean; route?: string };
};

export type AnalystHandoffSupportExecutorReadiness = {
  schemaVersion: typeof SUPPORT_ACTION_EXECUTOR_READINESS_SCHEMA_VERSION;
  ready: boolean;
  action: string;
  mutationMode?: "no_mutation_readiness";
  noMutation?: boolean;
  executableByExistingEndpoint?: boolean;
  blockers: string[];
  executorContract?: {
    method?: string;
    path?: string;
    requiredHeaders?: string[];
    requiredBody?: string[];
  };
};

export type OrgWatchlistAlertTermsExportContract = {
  schemaVersion: typeof ORG_ALERT_TERMS_EXPORT_SCHEMA_VERSION;
  organizationId: string;
  tenantId: string;
  member: {
    userId: string;
    role: string;
    status: "active";
  };
  allowedViewerRoles: string[];
  activeTerms?: Array<{
    watchlistItemId: string;
    itemId?: string;
    termFamily?: string;
    term: string;
    source?: string;
    alertGenerationRef?: {
      schemaVersion: typeof ORG_ALERT_GENERATION_REF_SCHEMA_VERSION;
      source: "organization_shared_watchlist";
      organizationId: string;
      tenantId: string;
      ownerOrganizationId: string;
      watchlistId: string;
      watchlistItemId: string;
      itemId: string;
      termFamily: string;
      category?: string;
      term: string;
      normalizedTerm: string;
      status: "active";
      lifecycle: {
        status: "active";
        reason: string | null;
        requestId: string | null;
        createdBy: string;
        updatedBy: string | null;
      };
      dedupe: {
        scope: "organization_watchlist_term";
        key: string;
        parts: {
          organizationId: string;
          tenantId: string;
          watchlistItemId: string;
          termFamily: string;
          normalizedTerm: string;
        };
      };
    };
    alertGenerationReference?: {
      schemaVersion: "organization.watchlist_item_alert_reference.v1";
      organizationId: string;
      tenantId: string;
      watchlistItemId: string;
      itemId: string;
      termFamily: string;
      term: string;
      status: "active";
    };
  }>;
  activeWatchlistTerms: Array<{
    organizationId: string;
    tenantId: string;
    watchlistItemId: string;
    itemId?: string;
    termFamily?: string;
    term: string;
    status: string;
  }>;
  blockedReasons: string[];
  canGenerateAlerts: boolean;
};

export type DwmWebhookAuditEventContract = {
  schemaVersion: typeof DWM_WEBHOOK_AUDIT_EVENT_SCHEMA_VERSION;
  auditEventId: string;
  action: string;
  orgId?: string;
  actorId?: string;
  destinationId?: string;
  deliveryId?: string;
  delivery?: {
    alertId?: string;
    eventType?: string;
    status?: string;
    dryRun?: boolean;
    idempotencyKey?: string;
    watchlistId?: string;
    route?: string;
    casePath?: string;
  } | null;
  createdAt: string;
};

export type DwmWebhookDestinationLifecycleContract = {
  schemaVersion: typeof DWM_WEBHOOK_DESTINATION_LIFECYCLE_SCHEMA_VERSION;
  destinationId: string;
  orgId: string;
  type: string;
  label: string;
  status: string;
  enabled: boolean;
  access: {
    role: string | null;
    canReadStatus: boolean;
    canManage: boolean;
    canUpdate: boolean;
    canTest: boolean;
    canDisable: boolean;
    memberSafe: boolean;
  };
  lifecycle: {
    lastDryRun?: unknown;
    lastTest?: unknown;
    lastReplay?: unknown;
    lastDelivery?: unknown;
    lastFailure?: unknown;
    lastLiveDisabled?: unknown;
  };
  retry: {
    retryable: boolean;
    nextRetryAt?: string | null;
    attemptCount: number;
    lastErrorCategory?: string | null;
    reason?: string | null;
    deliveryId?: string | null;
    dedupeKey?: string | null;
  };
  health: {
    status: string;
    ready: boolean;
    blockers: string[];
    liveDeliveryEnabled: boolean;
    idempotencyCoverage?: unknown;
  };
  auditEventContracts?: DwmWebhookAuditEventContract[];
  updatedAt: string;
  createdAt: string;
};

export type ProductReadinessUiQualityProof = {
  schemaVersion: typeof UI_QUALITY_PROOF_SCHEMA_VERSION;
  surface: "dashboard" | "website";
  route: string;
  checkedAt: string;
  proofArtifactId: string;
  passed: boolean;
  blockers: string[];
};

export type AnalystHandoffConsumerBundle = {
  schemaVersion: typeof ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION;
  generatedAt: string;
  staleEvidenceBefore?: string;
  publicTi?: AnalystHandoffPublicTiContract;
  entitlement?: AnalystHandoffConsumerEntitlement;
  membership?: AnalystHandoffConsumerMembership;
  sourceReadiness?: AnalystHandoffSourceWorkerReadiness;
  caseRoute?: AnalystHandoffCaseRouteAvailability;
  helpdeskAction?: AnalystHandoffHelpdeskActionAvailability;
  compatibility?: {
    entitlementBlockers?: AnalystHandoffEntitlementBlockerContract[];
    sourceActions?: AnalystHandoffSourcePackActionContract[];
    supportActions?: AnalystHandoffSupportActionExecution[];
  };
  deployGateEvidence?: {
    publicTiReadiness?: AnalystHandoffPublicTiReadinessRow[];
    orgAlertWatchlistReadiness?: OrgScopedAlertWatchlistReadiness[];
    webhookDestinations?: AnalystHandoffWebhookDestinationAdminProofRow[];
    orgLifecycle?: AnalystHandoffOrgLifecycleReadinessRow[];
    supportExecutor?: AnalystHandoffSupportExecutorReadiness[];
  };
  productSurfaceProof?: {
    dashboard?: ProductReadinessUiQualityProof;
    website?: ProductReadinessUiQualityProof;
  };
  stages: Partial<{
    publicTi: ActorWatchlistAdapterValue;
    orgWatchlist: AlertGenerationAdapterValue & {
      termsExport?: OrgWatchlistAlertTermsExportContract;
    };
    caseHandoff: AlertCaseAdapterValue;
    webhookTrigger: AlertWebhookAdapterValue & {
      auditEvents?: DwmWebhookAuditEventContract[];
      destinationLifecycle?: DwmWebhookDestinationLifecycleContract[];
    };
  }>;
};

export type AnalystHandoffConsumerValidation = {
  schemaVersion: typeof ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION;
  ok: boolean;
  blockers: AnalystHandoffConsumerBlocker[];
  identity?: AnalystHandoffIdentity;
  stageCount: number;
  contracts: {
    publicTiSatisfied: boolean;
    orgAlertTermsSatisfied: boolean;
    alertRequestSatisfied: boolean;
    caseHandoffSatisfied: boolean;
    webhookTriggerSatisfied: boolean;
    webhookAuditSatisfied: boolean;
    webhookDestinationLifecycleSatisfied: boolean;
    sourceReadinessSatisfied: boolean;
    caseRouteAvailable: boolean;
  };
};

export type AnalystHandoffLaneReadiness = {
  owner: AnalystHandoffOwnerLane;
  ok: boolean;
  blockerCodes: AnalystHandoffConsumerBlockerCode[];
  blockerCount: number;
  recommendedOwnerLane: AnalystHandoffOwnerLane;
};

export type AnalystHandoffValidationReport = {
  schemaVersion: typeof ANALYST_HANDOFF_VALIDATION_REPORT_SCHEMA_VERSION;
  contractVersions: typeof ANALYST_HANDOFF_CONTRACT_VERSIONS;
  checkedAt: string;
  ok: boolean;
  bundleCount: number;
  passedCount: number;
  failedCount: number;
  blockerCodes: AnalystHandoffConsumerBlockerCode[];
  productReadiness: Record<AnalystHandoffOwnerLane, AnalystHandoffLaneReadiness>;
  deployGate: AnalystHandoffDeployGateAssertions;
  readinessMatrix: AnalystHandoffReadinessMatrix;
  productReadinessAggregate: ProductReadinessAggregate;
  betaReadiness: BetaReadinessArtifact;
  betaDeployGateCoverage: BetaReadinessDeployGateCoverage;
  results: Array<{
    file?: string;
    ok: boolean;
    schemaVersion: typeof ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION;
    blockerCount: number;
    blockerCodes: AnalystHandoffConsumerBlockerCode[];
    blockers: Array<Pick<AnalystHandoffConsumerBlocker, "code" | "stage" | "field" | "detail" | "recoverable" | "action" | "route" | "evidenceSchemaVersion"> & { ownerLane: AnalystHandoffOwnerLane }>;
    productReadiness: Record<AnalystHandoffOwnerLane, AnalystHandoffLaneReadiness>;
    contracts: AnalystHandoffConsumerValidation["contracts"] | null;
    identity?: AnalystHandoffIdentity;
  }>;
};

export type AnalystHandoffDeployGateRowKind =
  | "public_ti_readiness"
  | "org_alert_watchlist_readiness"
  | "alert_case_handoff"
  | "webhook_destination"
  | "org_lifecycle"
  | "support_executor";

export type AnalystHandoffDeployGateRow = {
  kind: AnalystHandoffDeployGateRowKind;
  ownerLane: AnalystHandoffOwnerLane;
  ok: boolean;
  schemaVersion: string;
  sourceFile?: string;
  action?: string;
  route?: string;
  blockerCodes: string[];
  requiredFields: string[];
  identity?: Pick<AnalystHandoffIdentity, "organizationId" | "watchlistId" | "watchlistItemIds" | "alertId" | "casePath" | "webhookDestinationIds">;
};

export type AnalystHandoffDeployGateAssertions = {
  schemaVersion: typeof ANALYST_HANDOFF_DEPLOY_GATE_ASSERTIONS_SCHEMA_VERSION;
  ok: boolean;
  rowCount: number;
  requiredContractVersions: typeof ANALYST_HANDOFF_CONTRACT_VERSIONS;
  ownerLaneMap: Record<AnalystHandoffOwnerLane, AnalystHandoffOwnerLane>;
  rowsByOwner: Record<AnalystHandoffOwnerLane, { ok: boolean; rowCount: number; blockerCodes: string[] }>;
  rows: AnalystHandoffDeployGateRow[];
};

export type BetaReadinessDeployGateCoverageRow = {
  capabilityId: BetaReadinessCapabilityId;
  ownerLane: BetaReadinessRow["ownerLane"];
  capabilityLabel: string;
  route: string;
  routeHandler: string;
  storageModule: string;
  proofRowId: string;
  expectedAdapter: string;
  payloadShape: string[];
  proofCommand: string;
  requiredDeployGateKinds: AnalystHandoffDeployGateRowKind[];
  matchedDeployGateKinds: AnalystHandoffDeployGateRowKind[];
  missingDeployGateKinds: AnalystHandoffDeployGateRowKind[];
  productProofArtifactId: string;
  productProofSchemaVersion: string;
  customerVisibleState: ProductReadinessState;
  deployRisk: ProductReadinessRow["deployRisk"];
  blockerCodes: string[];
  integrationStatus: "covered" | "product_proof_only" | "blocked";
};

export type BetaReadinessDeployGateCoverage = {
  schemaVersion: typeof BETA_READINESS_DEPLOY_GATE_COVERAGE_SCHEMA_VERSION;
  ok: boolean;
  checkedAt: string;
  rowCount: number;
  uncoveredCount: number;
  rows: BetaReadinessDeployGateCoverageRow[];
};

export type AnalystHandoffReadinessCapability =
  | "organization_onboarding_lifecycle"
  | "shared_watchlist_alert_export"
  | "org_scoped_alert_case_workflow"
  | "source_activation_and_provenance"
  | "discord_webhook_destination_delivery"
  | "support_admin_recovery_controls"
  | "public_ti_actor_handoff"
  | "entitlement_policy_readiness";

export type AnalystHandoffReadinessMatrixRow = {
  id: AnalystHandoffReadinessCapability;
  ownerLane: AnalystHandoffOwnerLane;
  status: "ready" | "blocked" | "needs_input" | "provisional";
  capability: string;
  currentProofArtifact: {
    schemaVersion: string;
    artifactId: string;
    sourceFile?: string;
    route?: string;
    probeId?: string;
  };
  blockingGaps: string[];
  requiredRoute?: string;
  requiredAction?: string;
  requiredProbe?: string;
  deployRisk: "none" | "low" | "medium" | "high";
  customerVisible: boolean;
};

export type AnalystHandoffReadinessMatrix = {
  schemaVersion: typeof ANALYST_HANDOFF_READINESS_MATRIX_SCHEMA_VERSION;
  ok: boolean;
  rowCount: number;
  rows: AnalystHandoffReadinessMatrixRow[];
};

export type ProductReadinessCapabilityId =
  | "organization_lifecycle"
  | "shared_watchlists"
  | "source_activation"
  | "alert_case_workflow"
  | "webhook_delivery"
  | "support_controls"
  | "dashboard_operator_workspace"
  | "public_ti_actor_handoff"
  | "website_product_surface";

export type ProductReadinessOwnerLane =
  | "org"
  | "watchlist"
  | "source"
  | "alert"
  | "webhook"
  | "support"
  | "dashboard"
  | "publicTI"
  | "website";

export type ProductReadinessState = "ready" | "degraded" | "blocked" | "provisional";

export type ProductReadinessContractReference = {
  ownerLane: ProductReadinessOwnerLane | "case" | "integration";
  schemaVersions: string[];
  routes: string[];
  blockerCodes: string[];
  scopeFields: string[];
  downstreamConsumers: Array<{
    ownerLane: ProductReadinessOwnerLane | "case" | "integration";
    route: string;
    requiredFields: string[];
  }>;
  safeOutput: {
    metadataOnly: true;
    rawEvidenceExposed: false;
    webhookSecretExposed: false;
    crossOrgDataExposed: false;
  };
};

export type ProductReadinessWorkflowContract = {
  route: string;
  routeHandler: string;
  storageModule: string;
  proofRowId: string;
  testName: string;
  expectedAdapter: string;
  payloadShape: string[];
  proofCommand: string;
  contractReferences?: ProductReadinessContractReference[];
};

export type ProductReadinessRow = {
  id: ProductReadinessCapabilityId;
  ownerLane: ProductReadinessOwnerLane;
  capabilityLabel: string;
  proofArtifact: AnalystHandoffReadinessMatrixRow["currentProofArtifact"];
  lastCheckedAt: string;
  customerVisible: boolean;
  customerVisibleState: ProductReadinessState;
  blockers: string[];
  requiredNextAction: string;
  deployRisk: AnalystHandoffReadinessMatrixRow["deployRisk"];
  uiQualityProofExists: boolean;
  workflowContract: ProductReadinessWorkflowContract;
};

export type ProductReadinessAggregate = {
  schemaVersion: typeof PRODUCT_READINESS_SCHEMA_VERSION;
  checkedAt: string;
  ok: boolean;
  rowCount: number;
  customerVisibleBlockedCount: number;
  deployRisk: AnalystHandoffReadinessMatrixRow["deployRisk"];
  rows: ProductReadinessRow[];
};

export type ProductReadinessAggregateValidation = {
  ok: boolean;
  blockerCodes: string[];
  blockers: Array<{ code: string; rowId?: string; field?: string; detail: string }>;
};

export type BetaReadinessCapabilityId =
  | "create_organization"
  | "invite_teammate"
  | "create_shared_watchlist"
  | "activate_source_coverage"
  | "generate_alert"
  | "configure_destinations"
  | "work_alert"
  | "open_link_case"
  | "deliver_discord_webhook"
  | "support_access_recovery"
  | "public_ti_actor_relevance";

export type BetaReadinessPersistenceMode = "real_persistence" | "local_proof" | "session_state" | "demo_fixture";

export type BetaReadinessWorkflowContract = {
  route: string;
  routeHandler: string;
  storageModule: string;
  proofRowId: string;
  testName: string;
};

export type BetaReadinessRow = {
  id: BetaReadinessCapabilityId;
  ownerLane: ProductReadinessOwnerLane | "integration";
  capabilityLabel: string;
  proofArtifact: ProductReadinessRow["proofArtifact"];
  latestCommitOrCheck: string;
  customerVisibleState: ProductReadinessState;
  blockers: string[];
  blockingReason: string | null;
  deployRisk: ProductReadinessRow["deployRisk"];
  requiredNextAction: string;
  uiQualityProofStatus: "present" | "missing" | "not_required";
  persistenceMode: BetaReadinessPersistenceMode;
  expectedAdapter: string;
  payloadShape: string[];
  proofCommand: string;
  workflowContract: BetaReadinessWorkflowContract;
};

export type BetaReadinessArtifact = {
  schemaVersion: typeof BETA_READINESS_SCHEMA_VERSION;
  checkedAt: string;
  ok: boolean;
  status: "nearly_sellable" | "blocked";
  rowCount: number;
  customerWorkflow: "organization_threat_monitoring";
  deployRisk: ProductReadinessRow["deployRisk"];
  rows: BetaReadinessRow[];
};

export type BetaReadinessValidation = {
  ok: boolean;
  blockerCodes: string[];
  blockers: Array<{ code: string; rowId?: string; field?: string; detail: string }>;
};

export function validateAnalystHandoffConsumerBundle(input: unknown): AnalystHandoffConsumerValidation {
  const bundle = input as Partial<AnalystHandoffConsumerBundle>;
  const blockers: AnalystHandoffConsumerBlocker[] = [];

  if (bundle.schemaVersion !== ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION) {
    blockers.push(blocker(
      bundle.schemaVersion ? "unsupported_schema" : "missing_schema",
      "bundle",
      "schemaVersion",
      `Expected ${ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION}.`,
      false
    ));
  }

  const stages = bundle.stages || {};
  const stageCount = Object.values(stages).filter(Boolean).length;
  let identity: AnalystHandoffIdentity | undefined;
  for (const stageName of ["publicTi", "orgWatchlist", "caseHandoff", "webhookTrigger"] as const) {
    const stage = stages[stageName];
    if (!stage) continue;
    const handoff = stage.handoff as AnalystHandoffEnvelope<AnalystHandoffKind, unknown> | undefined;
    const stageBlockers = validateStageEnvelope(stageName, handoff, bundle.staleEvidenceBefore);
    blockers.push(...stageBlockers);
    if (handoff?.identity) {
      try {
        identity = identity ? mergeAnalystHandoffIdentity(identity, handoff.identity) : handoff.identity;
      } catch (error) {
        blockers.push(identityMismatchBlocker(stageName, error));
      }
    }
  }

  if (!stages.publicTi) blockers.push(blocker("missing_stage", "publicTi", "stages.publicTi", "Public TI watchlist candidate stage is missing.", true));
  if (!stages.orgWatchlist) blockers.push(blocker("missing_stage", "orgWatchlist", "stages.orgWatchlist", "Org watchlist alert request stage is missing.", true));
  if (!stages.caseHandoff) blockers.push(blocker("missing_stage", "caseHandoff", "stages.caseHandoff", "Case handoff stage is missing.", true));
  if (!stages.webhookTrigger) blockers.push(blocker("missing_stage", "webhookTrigger", "stages.webhookTrigger", "Webhook trigger stage is missing.", true));

  blockers.push(...validatePublicTiStage(stages.publicTi));
  blockers.push(...validateOrgWatchlistStage(stages.orgWatchlist, identity, bundle.membership, bundle.entitlement));
  blockers.push(...validateCaseStage(stages.caseHandoff, identity));
  blockers.push(...validateWebhookStage(stages.webhookTrigger, identity));
  blockers.push(...validateMembership(bundle.membership, identity));
  blockers.push(...validatePublicTiContract(bundle.publicTi, stages.publicTi?.handoff, bundle.staleEvidenceBefore));
  blockers.push(...validateEntitlement(bundle.entitlement));
  blockers.push(...validateSourceReadiness(bundle.sourceReadiness, identity));
  blockers.push(...validateCaseRouteAvailability(bundle.caseRoute));
  blockers.push(...validateHelpdeskAction(bundle.helpdeskAction));
  blockers.push(...validateCompatibilityEvidence(bundle.compatibility));

  return {
    schemaVersion: ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION,
    ok: blockers.length === 0,
    blockers,
    identity,
    stageCount,
    contracts: {
      publicTiSatisfied: hasNoStageBlockers(blockers, "publicTi"),
      orgAlertTermsSatisfied: Boolean(stages.orgWatchlist?.termsExport) && hasNoStageBlockers(blockers, "org_terms_export") && hasNoStageBlockers(blockers, "orgWatchlist"),
      alertRequestSatisfied: hasNoStageBlockers(blockers, "orgWatchlist"),
      caseHandoffSatisfied: hasNoStageBlockers(blockers, "caseHandoff"),
      webhookTriggerSatisfied: hasNoStageBlockers(blockers, "webhookTrigger"),
      webhookAuditSatisfied: Boolean(stages.webhookTrigger?.auditEvents?.length) && hasNoStageBlockers(blockers, "webhook_audit"),
      webhookDestinationLifecycleSatisfied: Boolean(stages.webhookTrigger?.destinationLifecycle?.length) && hasNoStageBlockers(blockers, "webhook_lifecycle"),
      sourceReadinessSatisfied: Boolean(bundle.sourceReadiness) && hasNoStageBlockers(blockers, "source_readiness"),
      caseRouteAvailable: Boolean(bundle.caseRoute) && hasNoStageBlockers(blockers, "case_route"),
    }
  };
}

export function summarizeAnalystHandoffConsumerBundle(input: unknown) {
  const validation = validateAnalystHandoffConsumerBundle(input);
  const bundle = input as Partial<AnalystHandoffConsumerBundle>;
  const productReadiness = productReadinessFor(validation.blockers);
  return {
    ok: validation.ok,
    schemaVersion: validation.schemaVersion,
    blockers: validation.blockers.map(({ code, stage, field, detail, recoverable }) => ({ code, stage, field, detail, recoverable })),
    generatedAt: bundle.generatedAt,
    stageCount: validation.stageCount,
    identity: validation.identity,
    contracts: validation.contracts,
    productReadiness,
    sourceReadiness: bundle.sourceReadiness
      ? {
          schemaVersion: bundle.sourceReadiness.schemaVersion,
          ready: bundle.sourceReadiness.ready,
          freshProvenance: bundle.sourceReadiness.freshProvenance,
          sourceIds: bundle.sourceReadiness.sourceIds,
          blockers: bundle.sourceReadiness.blockers
        }
      : undefined,
    caseRoute: bundle.caseRoute
      ? {
          schemaVersion: bundle.caseRoute.schemaVersion,
          available: bundle.caseRoute.available,
          path: bundle.caseRoute.path,
          methods: bundle.caseRoute.methods
        }
      : undefined,
    requests: {
      publicTi: requestSummary(bundle.stages?.publicTi?.request),
      orgWatchlist: requestSummary(bundle.stages?.orgWatchlist?.request),
      caseHandoff: requestSummary(bundle.stages?.caseHandoff?.request),
      webhookTrigger: requestSummary(bundle.stages?.webhookTrigger?.request)
    }
  };
}

export function buildAnalystHandoffValidationReport(input: {
  checkedAt?: string;
  results: Array<{ file?: string; bundle?: unknown; error?: unknown }>;
}): AnalystHandoffValidationReport {
  const checkedAt = input.checkedAt || nowIso();
  const results = input.results.map((item) => {
    if (item.error) {
      const synthetic = blocker("invalid_request", "bundle", "file", item.error instanceof Error ? item.error.message : "Unable to read or parse handoff bundle.", true);
      const readiness = productReadinessFor([synthetic]);
      return {
        file: item.file,
        ok: false,
        schemaVersion: ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION,
        blockerCount: 1,
        blockerCodes: ["invalid_request" as const],
        blockers: [{ ...synthetic, ownerLane: ownerLaneForBlocker(synthetic) }],
        productReadiness: readiness,
        contracts: null,
        identity: undefined
      };
    }
    const validation = validateAnalystHandoffConsumerBundle(item.bundle);
    const readiness = productReadinessFor(validation.blockers);
    return {
      file: item.file,
      ok: validation.ok,
      schemaVersion: validation.schemaVersion,
      blockerCount: validation.blockers.length,
      blockerCodes: uniqueBlockerCodes(validation.blockers),
      blockers: validation.blockers.map((blocker) => ({ ...blocker, ownerLane: ownerLaneForBlocker(blocker) })),
      productReadiness: readiness,
      contracts: validation.contracts,
      identity: validation.identity
    };
  });
  const allBlockers = results.flatMap((item) => item.blockers.map(({ ownerLane: _ownerLane, ...blocker }) => blocker as AnalystHandoffConsumerBlocker));
  const deployGate = buildDeployGateAssertions(input.results.map((item, index) => ({
    file: item.file,
    bundle: item.bundle as Partial<AnalystHandoffConsumerBundle> | undefined,
    result: results[index]
  })));
  const readinessMatrix = buildAnalystHandoffReadinessMatrix(input.results.map((item, index) => ({
    file: item.file,
    bundle: item.bundle as Partial<AnalystHandoffConsumerBundle> | undefined,
    result: results[index]
  })), deployGate);
  const productReadinessAggregate = buildProductReadinessAggregate(input.results.map((item, index) => ({
    file: item.file,
    bundle: item.bundle as Partial<AnalystHandoffConsumerBundle> | undefined,
    result: results[index]
  })), readinessMatrix, checkedAt);
  const betaReadiness = buildBetaReadinessArtifact(input.results.map((item, index) => ({
    file: item.file,
    bundle: item.bundle as Partial<AnalystHandoffConsumerBundle> | undefined,
    result: results[index]
  })), productReadinessAggregate, checkedAt);
  const betaDeployGateCoverage = buildBetaReadinessDeployGateCoverage(betaReadiness, deployGate, checkedAt);
  return {
    schemaVersion: ANALYST_HANDOFF_VALIDATION_REPORT_SCHEMA_VERSION,
    contractVersions: ANALYST_HANDOFF_CONTRACT_VERSIONS,
    checkedAt,
    ok: results.every((item) => item.ok),
    bundleCount: results.length,
    passedCount: results.filter((item) => item.ok).length,
    failedCount: results.filter((item) => !item.ok).length,
    blockerCodes: [...new Set(results.flatMap((item) => item.blockerCodes))].sort() as AnalystHandoffConsumerBlockerCode[],
    productReadiness: productReadinessFor(allBlockers),
    deployGate,
    readinessMatrix,
    productReadinessAggregate,
    betaReadiness,
    betaDeployGateCoverage,
    results
  };
}

export function buildBetaReadinessDeployGateCoverage(
  betaReadiness: BetaReadinessArtifact,
  deployGate: AnalystHandoffDeployGateAssertions,
  checkedAt: string = nowIso()
): BetaReadinessDeployGateCoverage {
  const rows = betaReadiness.rows.map((row): BetaReadinessDeployGateCoverageRow => {
    const requiredDeployGateKinds = deployGateKindsForBetaCapability(row.id);
    const matchedDeployGateRows = deployGate.rows.filter((deployRow) => requiredDeployGateKinds.includes(deployRow.kind));
    const matchedKinds = Array.from(new Set(matchedDeployGateRows.map((deployRow) => deployRow.kind)));
    const missingKinds = requiredDeployGateKinds.filter((kind) => !matchedKinds.includes(kind));
    const deployGateBlockers = matchedDeployGateRows.flatMap((deployRow) => deployRow.blockerCodes);
    const blockerCodes = Array.from(new Set([
      ...row.blockers,
      ...deployGateBlockers,
      ...missingKinds.map((kind) => `missing_deploy_gate_${kind}`)
    ].filter(Boolean)));
    const integrationStatus = blockerCodes.length
      ? "blocked"
      : requiredDeployGateKinds.length
        ? "covered"
        : "product_proof_only";
    return {
      capabilityId: row.id,
      ownerLane: row.ownerLane,
      capabilityLabel: row.capabilityLabel,
      route: row.workflowContract.route,
      routeHandler: row.workflowContract.routeHandler,
      storageModule: row.workflowContract.storageModule,
      proofRowId: row.workflowContract.proofRowId,
      expectedAdapter: row.expectedAdapter,
      payloadShape: row.payloadShape,
      proofCommand: row.proofCommand,
      requiredDeployGateKinds,
      matchedDeployGateKinds: matchedKinds,
      missingDeployGateKinds: missingKinds,
      productProofArtifactId: row.proofArtifact.artifactId,
      productProofSchemaVersion: row.proofArtifact.schemaVersion,
      customerVisibleState: row.customerVisibleState,
      deployRisk: row.deployRisk,
      blockerCodes,
      integrationStatus
    };
  });
  return {
    schemaVersion: BETA_READINESS_DEPLOY_GATE_COVERAGE_SCHEMA_VERSION,
    ok: rows.every((row) => row.integrationStatus !== "blocked"),
    checkedAt,
    rowCount: rows.length,
    uncoveredCount: rows.filter((row) => row.integrationStatus === "blocked").length,
    rows
  };
}

function deployGateKindsForBetaCapability(id: BetaReadinessCapabilityId): AnalystHandoffDeployGateRowKind[] {
  switch (id) {
    case "create_organization":
      return ["org_lifecycle"];
    case "invite_teammate":
      return ["support_executor"];
    case "generate_alert":
      return ["org_alert_watchlist_readiness"];
    case "configure_destinations":
      return ["webhook_destination"];
    case "open_link_case":
      return ["alert_case_handoff"];
    case "deliver_discord_webhook":
      return ["webhook_destination"];
    case "support_access_recovery":
      return ["support_executor"];
    case "public_ti_actor_relevance":
      return ["public_ti_readiness"];
    case "create_shared_watchlist":
    case "activate_source_coverage":
    case "work_alert":
      return [];
  }
}

export function buildDeployGateAssertions(input: Array<{
  file?: string;
  bundle?: Partial<AnalystHandoffConsumerBundle>;
  result?: AnalystHandoffValidationReport["results"][number];
}>): AnalystHandoffDeployGateAssertions {
  const rows = input.flatMap(({ file, bundle, result }) => deployGateRowsForBundle(file, bundle, result));
  const lanes: AnalystHandoffOwnerLane[] = ["org", "alert", "source", "entitlement", "webhook", "case", "publicTI", "helpdesk"];
  const rowsByOwner = Object.fromEntries(lanes.map((owner) => {
    const owned = rows.filter((row) => row.ownerLane === owner);
    return [owner, {
      ok: owned.every((row) => row.ok),
      rowCount: owned.length,
      blockerCodes: [...new Set(owned.flatMap((row) => row.blockerCodes))].sort()
    }];
  })) as AnalystHandoffDeployGateAssertions["rowsByOwner"];
  const ownerLaneMap = Object.fromEntries(lanes.map((owner) => [owner, owner])) as AnalystHandoffDeployGateAssertions["ownerLaneMap"];
  return {
    schemaVersion: ANALYST_HANDOFF_DEPLOY_GATE_ASSERTIONS_SCHEMA_VERSION,
    ok: rows.every((row) => row.ok),
    rowCount: rows.length,
    requiredContractVersions: ANALYST_HANDOFF_CONTRACT_VERSIONS,
    ownerLaneMap,
    rowsByOwner,
    rows
  };
}

export function buildAnalystHandoffReadinessMatrix(input: Array<{
  file?: string;
  bundle?: Partial<AnalystHandoffConsumerBundle>;
  result?: AnalystHandoffValidationReport["results"][number];
}>, deployGate: AnalystHandoffDeployGateAssertions = buildDeployGateAssertions(input)): AnalystHandoffReadinessMatrix {
  const bundles = input.filter((item) => item.bundle);
  const rows: AnalystHandoffReadinessMatrixRow[] = [
    readinessRow({
      id: "organization_onboarding_lifecycle",
      ownerLane: "org",
      capability: "organization_onboarding_lifecycle",
      proof: proofFromDeployGate(deployGate.rows, "org_lifecycle") ?? proofFromBundle(bundles, "organization.lifecycle_readiness.v1", "deployGateEvidence.orgLifecycle"),
      gaps: deployGateRowsByKind(deployGate.rows, "org_lifecycle").flatMap((row) => row.blockerCodes),
      requiredRoute: "GET /api/organizations/:id/readiness-lifecycle",
      requiredProbe: "org.lifecycle_readiness",
      customerVisible: true
    }),
    readinessRow({
      id: "shared_watchlist_alert_export",
      ownerLane: "org",
      capability: "shared_watchlist_alert_export",
      proof: sharedWatchlistProof(bundles),
      gaps: sharedWatchlistGaps(bundles),
      requiredRoute: "GET /api/organizations/:id/watchlists/alert-terms",
      requiredAction: "export_shared_watchlist_terms",
      requiredProbe: "org.watchlist_alert_terms_export",
      customerVisible: true
    }),
    readinessRow({
      id: "org_scoped_alert_case_workflow",
      ownerLane: "alert",
      capability: "org_scoped_alert_case_workflow",
      proof: proofFromDeployGate(deployGate.rows, "org_alert_watchlist_readiness") ?? proofFromDeployGate(deployGate.rows, "alert_case_handoff") ?? proofFromBundle(bundles, ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION, "stages.caseHandoff"),
      gaps: [
        ...deployGateRowsByKind(deployGate.rows, "org_alert_watchlist_readiness").flatMap((row) => row.blockerCodes),
        ...deployGateRowsByKind(deployGate.rows, "alert_case_handoff").flatMap((row) => row.blockerCodes)
      ],
      requiredRoute: "/v1/cases",
      requiredAction: "create_case_from_org_alert",
      requiredProbe: "dwm.alert_case_handoff",
      customerVisible: true
    }),
    readinessRow({
      id: "source_activation_and_provenance",
      ownerLane: "source",
      capability: "source_activation_and_provenance",
      proof: sourceProof(bundles),
      gaps: sourceGaps(bundles),
      requiredRoute: "GET /v1/dwm/source-requests/readiness",
      requiredAction: "activate_source_pack",
      requiredProbe: "dwm.source_worker_readiness",
      customerVisible: true
    }),
    readinessRow({
      id: "discord_webhook_destination_delivery",
      ownerLane: "webhook",
      capability: "discord_webhook_destination_delivery",
      proof: proofFromDeployGate(deployGate.rows, "webhook_destination") ?? proofFromBundle(bundles, DWM_WEBHOOK_DESTINATION_LIFECYCLE_SCHEMA_VERSION, "stages.webhookTrigger.destinationLifecycle"),
      gaps: deployGateRowsByKind(deployGate.rows, "webhook_destination").flatMap((row) => row.blockerCodes),
      requiredRoute: "/v1/dwm/webhooks/deliver",
      requiredAction: "deliver_dwm_webhook",
      requiredProbe: "dwm.webhook_destination_lifecycle",
      customerVisible: true
    }),
    readinessRow({
      id: "support_admin_recovery_controls",
      ownerLane: "helpdesk",
      capability: "support_admin_recovery_controls",
      proof: proofFromDeployGate(deployGate.rows, "support_executor") ?? proofFromBundle(bundles, SUPPORT_ACTION_EXECUTOR_READINESS_SCHEMA_VERSION, "deployGateEvidence.supportExecutor"),
      gaps: deployGateRowsByKind(deployGate.rows, "support_executor").flatMap((row) => row.blockerCodes),
      requiredRoute: "/api/admin/support/readiness",
      requiredAction: "prepare_support_recovery_action",
      requiredProbe: "support.action_executor_readiness",
      customerVisible: false
    }),
    readinessRow({
      id: "public_ti_actor_handoff",
      ownerLane: "publicTI",
      capability: "public_ti_actor_handoff",
      proof: proofFromDeployGate(deployGate.rows, "public_ti_readiness") ?? proofFromBundle(bundles, PUBLIC_TI_HANDOFF_SCHEMA_VERSION, "publicTi"),
      gaps: deployGateRowsByKind(deployGate.rows, "public_ti_readiness").flatMap((row) => row.blockerCodes),
      requiredRoute: "/ti",
      requiredAction: "create_org_watchlist_from_public_ti_actor",
      requiredProbe: "ti.public_actor.readiness",
      customerVisible: true
    }),
    readinessRow({
      id: "entitlement_policy_readiness",
      ownerLane: "entitlement",
      capability: "entitlement_policy_readiness",
      proof: entitlementProof(bundles),
      gaps: entitlementGaps(bundles),
      requiredRoute: "GET /v1/organizations/:id/entitlements/readiness",
      requiredAction: "evaluate_org_entitlement_policy",
      requiredProbe: "dwm.entitlement_readiness",
      customerVisible: true,
      provisional: bundles.some((item) => item.bundle?.entitlement?.allowed && !item.bundle.entitlement.checkedAt)
    })
  ];
  return {
    schemaVersion: ANALYST_HANDOFF_READINESS_MATRIX_SCHEMA_VERSION,
    ok: rows.every((row) => row.status === "ready" || row.status === "provisional"),
    rowCount: rows.length,
    rows
  };
}

export function buildProductReadinessAggregate(input: Array<{
  file?: string;
  bundle?: Partial<AnalystHandoffConsumerBundle>;
  result?: AnalystHandoffValidationReport["results"][number];
}>, readinessMatrix: AnalystHandoffReadinessMatrix = buildAnalystHandoffReadinessMatrix(input), checkedAt: string = nowIso()): ProductReadinessAggregate {
  const bundles = input.filter((item) => item.bundle);
  const matrixRows = new Map(readinessMatrix.rows.map((row) => [row.id, row]));
  const rows: ProductReadinessRow[] = [
    productRowFromMatrix({
      id: "organization_lifecycle",
      ownerLane: "org",
      capabilityLabel: "Organization onboarding readiness",
      matrixRow: matrixRows.get("organization_onboarding_lifecycle"),
      lastCheckedAt: latestOrgLifecycleCheckedAt(bundles, checkedAt),
      requiredNextAction: "verify_organization_onboarding",
      workflowContract: {
        route: "GET /api/organizations/:id/readiness-lifecycle",
        routeHandler: "api/src/handlers/organizations.ts",
        storageModule: "api/src/utils/organizations.ts",
        proofRowId: "organization_lifecycle",
        testName: "smoke-organizations-api.ts",
        expectedAdapter: "organizationLifecycleReadiness",
        payloadShape: ["organizationId", "tenantId", "readyForOnboarding", "typedBlockers"],
        proofCommand: "cd api && /Users/eirikhanasand/.bun/bin/bun scripts/smoke-organizations-api.ts"
      }
    }),
    productRowFromMatrix({
      id: "shared_watchlists",
      ownerLane: "watchlist",
      capabilityLabel: "Shared watchlist alert terms",
      matrixRow: matrixRows.get("shared_watchlist_alert_export"),
      lastCheckedAt: latestGeneratedAt(bundles, checkedAt),
      requiredNextAction: "export_shared_watchlist_terms",
      workflowContract: {
        route: "GET /api/organizations/:id/watchlists/alert-terms",
        routeHandler: "api/src/handlers/organizations.ts",
        storageModule: "api/src/utils/organizations.ts",
        proofRowId: "shared_watchlist_alert_export",
        testName: "analystHandoffConsumer.test.ts",
        expectedAdapter: "orgWatchlistTermsToAlertGenerationRequest",
        payloadShape: ["organizationId", "tenantId", "activeTerms[].alertGenerationRef", "activeWatchlistTerms"],
        proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/analystHandoffConsumer.test.ts"
      }
    }),
    productRowFromMatrix({
      id: "source_activation",
      ownerLane: "source",
      capabilityLabel: "Source activation and provenance",
      matrixRow: matrixRows.get("source_activation_and_provenance"),
      lastCheckedAt: latestSourceCheckedAt(bundles, checkedAt),
      requiredNextAction: "activate_source_policy",
      workflowContract: {
        route: "GET /v1/dwm/source-requests/readiness",
        routeHandler: "ti/scraper/src/api/dwmSourceRequestRoute.ts",
        storageModule: "ti/scraper/src/storage/dwmSourcePackRegistry.ts",
        proofRowId: "source_activation_and_provenance",
        testName: "dwmSourceRequest.test.ts",
        expectedAdapter: "buildDwmSourceReadinessArtifact",
        payloadShape: ["sourceIds", "freshProvenance", "blockers", "checkedAt"],
        proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/dwmSourceRequest.test.ts"
      }
    }),
    productRowFromMatrix({
      id: "alert_case_workflow",
      ownerLane: "alert",
      capabilityLabel: "Alert and case workflow",
      matrixRow: matrixRows.get("org_scoped_alert_case_workflow"),
      lastCheckedAt: latestGeneratedAt(bundles, checkedAt),
      requiredNextAction: "open_org_alert_case",
      workflowContract: {
        route: "POST /v1/dwm/alerts/rebuild -> POST /v1/cases",
        routeHandler: "ti/scraper/src/api/dwmWorkflowRoutes.ts + ti/scraper/src/api/caseRoutes.ts",
        storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts",
        proofRowId: "org_scoped_alert_case_workflow",
        testName: "dwmCaseWorkflow.test.ts",
        expectedAdapter: "persistedAlertToCaseHandoffPayload",
        payloadShape: ["alertId", "casePath", "captureIds", "watchlistItemIds", "workflowState"],
        proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/dwmCaseWorkflow.test.ts"
      }
    }),
    productRowFromMatrix({
      id: "webhook_delivery",
      ownerLane: "webhook",
      capabilityLabel: "Webhook delivery destination",
      matrixRow: matrixRows.get("discord_webhook_destination_delivery"),
      lastCheckedAt: latestWebhookCheckedAt(bundles, checkedAt),
      requiredNextAction: "verify_discord_webhook_destination",
      workflowContract: {
        route: "POST /api/organizations/:id/webhooks -> POST /v1/dwm/webhooks/deliver",
        routeHandler: "api/src/handlers/dwm/webhooks.ts + ti/scraper/src/api/dwmWorkflowRoutes.ts",
        storageModule: "api/src/utils/dwm/webhooks.ts + ti/scraper/src/storage/dwmAlertRepository.ts",
        proofRowId: "webhook_destination",
        testName: "dwmWebhookDelivery.test.ts",
        expectedAdapter: "persistedAlertToWebhookTriggerContext",
        payloadShape: ["destinationId", "organizationId", "alertId", "webhookDestinationIds", "deliveryId", "casePath"],
        proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/dwmWebhookDelivery.test.ts"
      }
    }),
    productRowFromMatrix({
      id: "support_controls",
      ownerLane: "support",
      capabilityLabel: "Support recovery controls",
      matrixRow: matrixRows.get("support_admin_recovery_controls"),
      lastCheckedAt: latestGeneratedAt(bundles, checkedAt),
      requiredNextAction: "verify_support_recovery_action",
      customerVisible: false,
      workflowContract: {
        route: "POST /api/admin/support/organizations/:id/access-recovery",
        routeHandler: "api/src/handlers/adminSupport.ts",
        storageModule: "api/src/utils/organizations.ts",
        proofRowId: "support_executor",
        testName: "smoke-admin-support-contract.ts",
        expectedAdapter: "supportActionExecutionHandoff",
        payloadShape: ["action", "idempotencyKey", "executorReadiness.ready", "execution.path", "audit.blockerCode"],
        proofCommand: "cd api && /Users/eirikhanasand/.bun/bin/bun scripts/smoke-admin-support-contract.ts"
      }
    }),
    surfaceProductReadinessRow({
      id: "dashboard_operator_workspace",
      ownerLane: "dashboard",
      capabilityLabel: "Dashboard operator workspace",
      proof: firstSurfaceProof(bundles, "dashboard"),
      checkedAt,
      requiredNextAction: "capture_dashboard_operator_workspace_ui_proof",
      workflowContract: {
        route: "/dashboard",
        routeHandler: "dashboard.operator_workspace",
        storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts",
        proofRowId: "dashboard_operator_workspace",
        testName: "dwmCaseWorkflow.test.ts",
        expectedAdapter: "persistedAlertToCaseHandoffPayload",
        payloadShape: ["alertId", "casePath", "captureIds", "watchlistItemIds", "workflowState"],
        proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/dwmCaseWorkflow.test.ts"
      }
    }),
    productRowFromMatrix({
      id: "public_ti_actor_handoff",
      ownerLane: "publicTI",
      capabilityLabel: "Threat intelligence actor handoff",
      matrixRow: matrixRows.get("public_ti_actor_handoff"),
      lastCheckedAt: latestGeneratedAt(bundles, checkedAt),
      requiredNextAction: "verify_public_ti_actor_handoff",
      workflowContract: {
        route: "/ti",
        routeHandler: "ti.actor_profile_surface",
        storageModule: "api/src/utils/ti/search.ts",
        proofRowId: "public_ti_actor_handoff",
        testName: "check-ti-org-relevance.ts",
        expectedAdapter: "publicTiArtifactToOrgWatchlistCreate",
        payloadShape: ["artifactId", "query", "provenance", "watchlistTerms", "backedIds.organizationIds", "backedIds.alertIds"],
        proofCommand: "cd frontend && /Users/eirikhanasand/.bun/bin/bun scripts/check-ti-org-relevance.ts"
      }
    }),
    surfaceProductReadinessRow({
      id: "website_product_surface",
      ownerLane: "website",
      capabilityLabel: "Website product surface",
      proof: firstSurfaceProof(bundles, "website"),
      checkedAt,
      requiredNextAction: "capture_website_product_surface_ui_proof",
      workflowContract: {
        route: "/",
        routeHandler: "website.product_surface",
        storageModule: "product_readiness.website_surface",
        proofRowId: "website_product_surface",
        testName: "check-product-north-star.ts",
        expectedAdapter: "websiteProductReadinessProof",
        payloadShape: ["route", "checkedAt", "proofArtifactId", "passed", "blockers"],
        proofCommand: "cd frontend && /Users/eirikhanasand/.bun/bin/bun scripts/check-product-north-star.ts"
      }
    })
  ];
  return {
    schemaVersion: PRODUCT_READINESS_SCHEMA_VERSION,
    checkedAt,
    ok: rows.every((row) => row.customerVisibleState === "ready" || row.customerVisibleState === "provisional"),
    rowCount: rows.length,
    customerVisibleBlockedCount: rows.filter((row) => row.customerVisible && row.customerVisibleState === "blocked").length,
    deployRisk: maxDeployRisk(rows.map((row) => row.deployRisk)),
    rows
  };
}

export function validateProductReadinessAggregateArtifact(input: unknown): ProductReadinessAggregateValidation {
  const artifact = input as Partial<ProductReadinessAggregate>;
  const blockers: ProductReadinessAggregateValidation["blockers"] = [];
  if (artifact.schemaVersion !== PRODUCT_READINESS_SCHEMA_VERSION) {
    blockers.push({ code: "unsupported_schema", field: "schemaVersion", detail: `Expected ${PRODUCT_READINESS_SCHEMA_VERSION}.` });
  }
  if (!Array.isArray(artifact.rows)) {
    blockers.push({ code: "missing_rows", field: "rows", detail: "Product readiness rows are required." });
  }
  if (Array.isArray(artifact.rows) && artifact.rowCount !== artifact.rows.length) {
    blockers.push({ code: "row_count_mismatch", field: "rowCount", detail: "Product readiness rowCount must match rows.length." });
  }
  for (const row of artifact.rows || []) {
    const rowId = (row as Partial<ProductReadinessRow>).id;
    const typed = row as Partial<ProductReadinessRow>;
    if (!typed.id) blockers.push({ code: "missing_row_id", field: "rows[].id", detail: "Every readiness row needs a stable id." });
    if (!typed.ownerLane) blockers.push({ code: "missing_owner_lane", rowId, field: "ownerLane", detail: "Every readiness row needs an owner lane." });
    if (!typed.capabilityLabel) blockers.push({ code: "missing_capability_label", rowId, field: "capabilityLabel", detail: "Every readiness row needs a domain-native label." });
    if (!typed.proofArtifact?.schemaVersion || !typed.proofArtifact?.artifactId) blockers.push({ code: "missing_proof_artifact", rowId, field: "proofArtifact", detail: "Every readiness row needs a proof artifact pointer." });
    if (!typed.lastCheckedAt) blockers.push({ code: "missing_last_checked_at", rowId, field: "lastCheckedAt", detail: "Every readiness row needs a last checked timestamp." });
    if (!typed.requiredNextAction) blockers.push({ code: "missing_required_next_action", rowId, field: "requiredNextAction", detail: "Every readiness row needs a required next action." });
    if (!Array.isArray(typed.blockers)) blockers.push({ code: "missing_blockers", rowId, field: "blockers", detail: "Every readiness row needs a blocker array." });
    if (!typed.workflowContract) {
      blockers.push({ code: "missing_workflow_contract", rowId, field: "workflowContract", detail: "Every product readiness row needs route, storage, proof row, adapter, payload, and test mapping." });
    } else {
      if (!typed.workflowContract.route) blockers.push({ code: "missing_workflow_route", rowId, field: "workflowContract.route", detail: "Every product workflow needs the route it proves." });
      if (!typed.workflowContract.routeHandler) blockers.push({ code: "missing_route_handler", rowId, field: "workflowContract.routeHandler", detail: "Every product workflow needs the route handler module or surface id." });
      if (!typed.workflowContract.storageModule) blockers.push({ code: "missing_storage_module", rowId, field: "workflowContract.storageModule", detail: "Every product workflow needs the persistence module or surface contract." });
      if (!typed.workflowContract.proofRowId) blockers.push({ code: "missing_proof_row_id", rowId, field: "workflowContract.proofRowId", detail: "Every product workflow needs the proof row id Worker 3 can match." });
      if (!typed.workflowContract.testName) blockers.push({ code: "missing_workflow_test", rowId, field: "workflowContract.testName", detail: "Every product workflow needs the focused test or smoke proof." });
      if (!typed.workflowContract.expectedAdapter) blockers.push({ code: "missing_expected_adapter", rowId, field: "workflowContract.expectedAdapter", detail: "Every product workflow needs an adapter contract name." });
      if (!Array.isArray(typed.workflowContract.payloadShape) || !typed.workflowContract.payloadShape.length) blockers.push({ code: "missing_payload_shape", rowId, field: "workflowContract.payloadShape", detail: "Every product workflow needs a payload shape." });
      if (!typed.workflowContract.proofCommand) blockers.push({ code: "missing_proof_command", rowId, field: "workflowContract.proofCommand", detail: "Every product workflow needs a proof command." });
      if (typed.workflowContract.contractReferences !== undefined) {
        if (!Array.isArray(typed.workflowContract.contractReferences) || !typed.workflowContract.contractReferences.length) {
          blockers.push({ code: "missing_contract_references", rowId, field: "workflowContract.contractReferences", detail: "Contract references must name schema ids, routes, blockers, scope fields, and downstream consumers." });
        }
        for (const [index, reference] of (typed.workflowContract.contractReferences || []).entries()) {
          const field = `workflowContract.contractReferences[${index}]`;
          if (!reference.ownerLane) blockers.push({ code: "missing_contract_owner_lane", rowId, field: `${field}.ownerLane`, detail: "Contract references need an owner lane." });
          if (!Array.isArray(reference.schemaVersions) || !reference.schemaVersions.length) blockers.push({ code: "missing_contract_schema_ids", rowId, field: `${field}.schemaVersions`, detail: "Contract references need schema ids." });
          if (!Array.isArray(reference.routes) || !reference.routes.length) blockers.push({ code: "missing_contract_routes", rowId, field: `${field}.routes`, detail: "Contract references need route discoverability." });
          if (!Array.isArray(reference.blockerCodes)) blockers.push({ code: "missing_contract_blockers", rowId, field: `${field}.blockerCodes`, detail: "Contract references need blocker code metadata." });
          if (!Array.isArray(reference.scopeFields) || !reference.scopeFields.length) blockers.push({ code: "missing_contract_scope_fields", rowId, field: `${field}.scopeFields`, detail: "Contract references need org/member scope fields." });
          if (!Array.isArray(reference.downstreamConsumers)) blockers.push({ code: "missing_downstream_consumers", rowId, field: `${field}.downstreamConsumers`, detail: "Contract references need downstream consumer metadata." });
          if (!reference.safeOutput?.metadataOnly || reference.safeOutput.rawEvidenceExposed || reference.safeOutput.webhookSecretExposed || reference.safeOutput.crossOrgDataExposed) {
            blockers.push({ code: "unsafe_contract_reference", rowId, field: `${field}.safeOutput`, detail: "Contract references must stay metadata-only and cannot expose raw evidence, secrets, or cross-org data." });
          }
        }
      }
    }
    const uiFacing = [
      typed.capabilityLabel,
      typed.requiredNextAction,
      typed.proofArtifact?.artifactId,
      typed.workflowContract?.route,
      typed.workflowContract?.routeHandler,
      typed.workflowContract?.storageModule,
      typed.workflowContract?.proofRowId,
      typed.workflowContract?.testName,
      typed.workflowContract?.expectedAdapter,
      typed.workflowContract?.proofCommand,
      ...(typed.blockers || [])
    ].filter(Boolean).join(" ").toLowerCase();
    for (const phrase of PRODUCT_READINESS_FORBIDDEN_LANGUAGE) {
      if (uiFacing.includes(phrase)) {
        blockers.push({ code: "prompt_shaped_language", rowId, field: "capabilityLabel", detail: `Readiness rows cannot contain prompt-shaped language: ${phrase}.` });
      }
    }
    if (typed.customerVisible && typed.capabilityLabel && !hasDomainNativeLabel(typed.capabilityLabel)) {
      blockers.push({ code: "non_domain_native_label", rowId, field: "capabilityLabel", detail: "Customer-visible rows must use domain-native terminology." });
    }
  }
  return {
    ok: blockers.length === 0,
    blockerCodes: [...new Set(blockers.map((item) => item.code))].sort(),
    blockers
  };
}

export function buildBetaReadinessArtifact(input: Array<{
  file?: string;
  bundle?: Partial<AnalystHandoffConsumerBundle>;
  result?: AnalystHandoffValidationReport["results"][number];
}>, productReadiness: ProductReadinessAggregate = buildProductReadinessAggregate(input), checkedAt: string = nowIso()): BetaReadinessArtifact {
  const productRows = new Map(productReadiness.rows.map((row) => [row.id, row]));
  const dashboard = productRows.get("dashboard_operator_workspace");
  const source = productRows.get("source_activation");
  const publicTi = productRows.get("public_ti_actor_handoff");
  const rows: BetaReadinessRow[] = [
    betaRowFromProduct({
      id: "create_organization",
      ownerLane: "org",
      capabilityLabel: "Organization creation",
      productRow: productRows.get("organization_lifecycle"),
      requiredNextAction: "verify_organization_create_route",
      persistenceMode: "real_persistence",
      expectedAdapter: "organizationLifecycleReadiness",
      payloadShape: ["organizationId", "tenantId", "readyForOnboarding", "typedBlockers"],
      proofCommand: "cd api && /Users/eirikhanasand/.bun/bin/bun scripts/smoke-organizations-api.ts",
      workflowContract: {
        route: "POST /api/organizations",
        routeHandler: "api/src/handlers/organizations.ts",
        storageModule: "api/src/utils/organizations.ts",
        proofRowId: "organization_lifecycle",
        testName: "api/scripts/smoke-organizations-api.ts"
      }
    }),
    betaRowFromProduct({
      id: "invite_teammate",
      ownerLane: "support",
      capabilityLabel: "Team invitation workflow",
      productRow: productRows.get("support_controls"),
      requiredNextAction: "verify_team_invitation_action",
      persistenceMode: "real_persistence",
      expectedAdapter: "supportActionExecutorReadiness",
      payloadShape: ["action", "executorContract.path", "executorContract.requiredHeaders", "executorContract.requiredBody", "blockers"],
      proofCommand: "cd api && /Users/eirikhanasand/.bun/bin/bun scripts/smoke-admin-support-contract.ts",
      workflowContract: {
        route: "POST /api/admin/support/organizations/:id/invites",
        routeHandler: "api/src/handlers/adminSupport.ts",
        storageModule: "api/src/utils/organizations.ts",
        proofRowId: "support_executor",
        testName: "api/scripts/smoke-admin-support-contract.ts"
      },
      customerVisibleStateOverride: supportInviteReady(input) ? undefined : "blocked",
      extraBlockers: supportInviteReady(input) ? [] : ["missing_invite_teammate_executor"]
    }),
    betaRowFromProduct({
      id: "create_shared_watchlist",
      ownerLane: "watchlist",
      capabilityLabel: "Shared watchlist monitoring",
      productRow: productRows.get("shared_watchlists"),
      requiredNextAction: "verify_shared_watchlist_persistence",
      persistenceMode: "real_persistence",
      expectedAdapter: "orgWatchlistTermsToAlertGenerationRequest",
      payloadShape: ["organizationId", "tenantId", "watchlistId", "watchlistItemIds", "activeTerms[].alertGenerationRef"],
      proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/analystHandoffConsumer.test.ts",
      workflowContract: {
        route: "GET /api/organizations/:id/watchlists/alert-terms",
        routeHandler: "api/src/handlers/organizations.ts",
        storageModule: "api/src/utils/organizations.ts",
        proofRowId: "shared_watchlist_alert_export",
        testName: "analystHandoffConsumer.test.ts"
      }
    }),
    betaRowFromProduct({
      id: "activate_source_coverage",
      ownerLane: "source",
      capabilityLabel: "Source coverage activation",
      productRow: source,
      requiredNextAction: "verify_source_coverage_activation",
      persistenceMode: "real_persistence",
      expectedAdapter: "buildDwmSourceReadinessArtifact",
      payloadShape: ["sourceIds", "freshProvenance", "blockers", "checkedAt"],
      proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/dwmSourceRequest.test.ts",
      workflowContract: {
        route: "GET /v1/dwm/source-requests/readiness",
        routeHandler: "ti/scraper/src/api/dwmSourceRequestRoute.ts",
        storageModule: "ti/scraper/src/storage/dwmSourcePackRegistry.ts",
        proofRowId: "source_activation_and_provenance",
        testName: "dwmSourceRequest.test.ts"
      }
    }),
    betaRowFromProduct({
      id: "generate_alert",
      ownerLane: "alert",
      capabilityLabel: "Alert generation",
      productRow: productRows.get("alert_case_workflow"),
      requiredNextAction: "verify_alert_generation",
      persistenceMode: "real_persistence",
      expectedAdapter: "orgWatchlistTermsToAlertGenerationRequest",
      payloadShape: ["organizationId", "watchlistId", "watchlistItemIds", "sourceFamily", "captureIds", "dedupeKey"],
      proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/dwmAlertRepository.test.ts src/tests/dwmWorkflowPersistence.test.ts",
      workflowContract: {
        route: "POST /v1/dwm/alerts/rebuild",
        routeHandler: "ti/scraper/src/api/dwmWorkflowRoutes.ts",
        storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts",
        proofRowId: "org_scoped_alert_case_workflow",
        testName: "dwmAlertRepository.test.ts"
      },
      extraBlockers: source?.customerVisibleState === "ready" ? [] : ["source_coverage_required_for_alert_generation"]
    }),
    betaRowFromProduct({
      id: "configure_destinations",
      ownerLane: "webhook",
      capabilityLabel: "Notification destination configuration",
      productRow: productRows.get("webhook_delivery"),
      requiredNextAction: "verify_webhook_destination_configuration",
      persistenceMode: "real_persistence",
      expectedAdapter: "webhookDestinationLifecycle",
      payloadShape: ["destinationId", "orgId", "type", "status", "health.ready", "retry.lastErrorCategory"],
      proofCommand: "cd api && /Users/eirikhanasand/.bun/bin/bun scripts/smoke-dwm-webhook-contract.ts",
      workflowContract: {
        route: "POST /api/organizations/:id/webhooks",
        routeHandler: "api/src/handlers/dwm/webhooks.ts",
        storageModule: "api/src/utils/dwm/webhooks.ts",
        proofRowId: "webhook_destination",
        testName: "api/scripts/smoke-dwm-webhook-contract.ts"
      }
    }),
    betaRowFromProduct({
      id: "work_alert",
      ownerLane: "dashboard",
      capabilityLabel: "Analyst alert workflow",
      productRow: productRows.get("alert_case_workflow"),
      requiredNextAction: "verify_dashboard_alert_workflow",
      persistenceMode: "real_persistence",
      expectedAdapter: "persistedAlertToCaseHandoffPayload",
      payloadShape: ["alertId", "casePath", "captureIds", "watchlistItemIds", "workflowState"],
      proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/dwmCaseWorkflow.test.ts",
      workflowContract: {
        route: "/dashboard",
        routeHandler: "dashboard.operator_workspace",
        storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts",
        proofRowId: "dashboard_operator_workspace",
        testName: "dwmCaseWorkflow.test.ts"
      },
      uiQualityProofStatus: dashboard?.uiQualityProofExists ? "present" : "missing",
      extraBlockers: dashboard?.uiQualityProofExists ? [] : ["missing_dashboard_ui_quality_proof"]
    }),
    betaRowFromProduct({
      id: "open_link_case",
      ownerLane: "alert",
      capabilityLabel: "Case link workflow",
      productRow: productRows.get("alert_case_workflow"),
      requiredNextAction: "verify_case_link_workflow",
      persistenceMode: "real_persistence",
      expectedAdapter: "persistedAlertToCaseHandoffPayload",
      payloadShape: ["caseIdCandidate", "casePath", "alertId", "dedupeKey", "captureIds"],
      proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/dwmCaseWorkflow.test.ts",
      workflowContract: {
        route: "POST /v1/cases",
        routeHandler: "ti/scraper/src/api/caseRoutes.ts",
        storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts",
        proofRowId: "alert_case_handoff",
        testName: "dwmCaseWorkflow.test.ts"
      }
    }),
    betaRowFromProduct({
      id: "deliver_discord_webhook",
      ownerLane: "webhook",
      capabilityLabel: "Discord webhook delivery",
      productRow: productRows.get("webhook_delivery"),
      requiredNextAction: "verify_discord_webhook_delivery",
      persistenceMode: "real_persistence",
      expectedAdapter: "persistedAlertToWebhookTriggerContext",
      payloadShape: ["organizationId", "alertId", "webhookDestinationIds", "deliveryId", "casePath", "captureIds"],
      proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/dwmWebhookDelivery.test.ts",
      workflowContract: {
        route: "POST /v1/dwm/webhooks/deliver",
        routeHandler: "ti/scraper/src/api/dwmWorkflowRoutes.ts",
        storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts",
        proofRowId: "webhook_destination",
        testName: "dwmWebhookDelivery.test.ts"
      }
    }),
    betaRowFromProduct({
      id: "support_access_recovery",
      ownerLane: "support",
      capabilityLabel: "Support access recovery",
      productRow: productRows.get("support_controls"),
      requiredNextAction: "verify_support_access_recovery",
      persistenceMode: "real_persistence",
      expectedAdapter: "supportActionExecutionHandoff",
      payloadShape: ["action", "idempotencyKey", "executorReadiness.ready", "execution.path", "audit.blockerCode"],
      proofCommand: "cd api && /Users/eirikhanasand/.bun/bin/bun scripts/smoke-admin-support-contract.ts",
      workflowContract: {
        route: "POST /api/admin/support/organizations/:id/access-recovery",
        routeHandler: "api/src/handlers/adminSupport.ts",
        storageModule: "api/src/utils/organizations.ts",
        proofRowId: "support_executor",
        testName: "api/scripts/smoke-admin-support-contract.ts"
      }
    }),
    betaRowFromProduct({
      id: "public_ti_actor_relevance",
      ownerLane: "publicTI",
      capabilityLabel: "Source-backed threat intelligence coverage",
      productRow: publicTi,
      requiredNextAction: "verify_source_backed_ti_coverage",
      persistenceMode: "real_persistence",
      expectedAdapter: "publicTiArtifactToOrgWatchlistCreate",
      payloadShape: ["artifactId", "query", "provenance", "watchlistTerms", "backedIds.organizationIds", "backedIds.alertIds"],
      proofCommand: "cd frontend && /Users/eirikhanasand/.bun/bin/bun scripts/check-ti-org-relevance.ts",
      workflowContract: {
        route: "/ti",
        routeHandler: "ti.actor_profile_surface",
        storageModule: "api/src/utils/ti/search.ts",
        proofRowId: "public_ti_actor_handoff",
        testName: "check-ti-org-relevance.ts"
      },
      extraBlockers: source?.customerVisibleState === "ready" ? [] : ["source_coverage_required_for_ti"]
    })
  ];
  return {
    schemaVersion: BETA_READINESS_SCHEMA_VERSION,
    checkedAt,
    ok: rows.every((row) => row.customerVisibleState === "ready"),
    status: rows.every((row) => row.customerVisibleState === "ready") ? "nearly_sellable" : "blocked",
    rowCount: rows.length,
    customerWorkflow: "organization_threat_monitoring",
    deployRisk: maxDeployRisk(rows.map((row) => row.deployRisk)),
    rows
  };
}

export function validateBetaReadinessArtifact(input: unknown): BetaReadinessValidation {
  const artifact = input as Partial<BetaReadinessArtifact>;
  const blockers: BetaReadinessValidation["blockers"] = [];
  if (artifact.schemaVersion !== BETA_READINESS_SCHEMA_VERSION) {
    blockers.push({ code: "unsupported_schema", field: "schemaVersion", detail: `Expected ${BETA_READINESS_SCHEMA_VERSION}.` });
  }
  if (!Array.isArray(artifact.rows)) {
    blockers.push({ code: "missing_rows", field: "rows", detail: "Beta readiness rows are required." });
  }
  if (Array.isArray(artifact.rows) && artifact.rowCount !== artifact.rows.length) {
    blockers.push({ code: "row_count_mismatch", field: "rowCount", detail: "Beta readiness rowCount must match rows.length." });
  }
  const requiredRows: BetaReadinessCapabilityId[] = [
    "create_organization",
    "invite_teammate",
    "create_shared_watchlist",
    "activate_source_coverage",
    "generate_alert",
    "configure_destinations",
    "work_alert",
    "open_link_case",
    "deliver_discord_webhook",
    "support_access_recovery",
    "public_ti_actor_relevance"
  ];
  const rowIds = new Set((artifact.rows || []).map((row) => row.id));
  for (const id of requiredRows) {
    if (!rowIds.has(id)) blockers.push({ code: "missing_required_capability", rowId: id, field: "rows[].id", detail: `Missing beta capability: ${id}.` });
  }
  for (const row of artifact.rows || []) {
    const typed = row as Partial<BetaReadinessRow>;
    const rowId = typed.id;
    if (!typed.ownerLane) blockers.push({ code: "missing_owner_lane", rowId, field: "ownerLane", detail: "Every beta row needs an owner lane." });
    if (!typed.capabilityLabel) blockers.push({ code: "missing_capability_label", rowId, field: "capabilityLabel", detail: "Every beta row needs a domain-native label." });
    if (!typed.proofArtifact?.schemaVersion || !typed.proofArtifact?.artifactId) blockers.push({ code: "missing_proof_artifact", rowId, field: "proofArtifact", detail: "Every beta row needs a proof artifact pointer." });
    if (!typed.latestCommitOrCheck) blockers.push({ code: "missing_latest_commit_or_check", rowId, field: "latestCommitOrCheck", detail: "Every beta row needs a latest commit or check pointer." });
    if (!typed.requiredNextAction) blockers.push({ code: "missing_required_next_action", rowId, field: "requiredNextAction", detail: "Every beta row needs a required next action." });
    if (!typed.persistenceMode) blockers.push({ code: "missing_persistence_mode", rowId, field: "persistenceMode", detail: "Every beta row must declare whether proof is real, local, session, or demo." });
    if (!typed.expectedAdapter) blockers.push({ code: "missing_expected_adapter", rowId, field: "expectedAdapter", detail: "Every beta row needs an adapter contract name." });
    if (!Array.isArray(typed.payloadShape) || !typed.payloadShape.length) blockers.push({ code: "missing_payload_shape", rowId, field: "payloadShape", detail: "Every beta row needs a payload shape." });
    if (!typed.proofCommand) blockers.push({ code: "missing_proof_command", rowId, field: "proofCommand", detail: "Every beta row needs a proof command." });
    if (!typed.workflowContract) {
      blockers.push({ code: "missing_workflow_contract", rowId, field: "workflowContract", detail: "Every beta row needs route, storage, proof row, and test mapping." });
    } else {
      if (!typed.workflowContract.route) blockers.push({ code: "missing_workflow_route", rowId, field: "workflowContract.route", detail: "Every beta workflow needs the route it proves." });
      if (!typed.workflowContract.routeHandler) blockers.push({ code: "missing_route_handler", rowId, field: "workflowContract.routeHandler", detail: "Every beta workflow needs the route handler module." });
      if (!typed.workflowContract.storageModule) blockers.push({ code: "missing_storage_module", rowId, field: "workflowContract.storageModule", detail: "Every beta workflow needs the persistence module." });
      if (!typed.workflowContract.proofRowId) blockers.push({ code: "missing_proof_row_id", rowId, field: "workflowContract.proofRowId", detail: "Every beta workflow needs the proof row id Worker 3 can match." });
      if (!typed.workflowContract.testName) blockers.push({ code: "missing_workflow_test", rowId, field: "workflowContract.testName", detail: "Every beta workflow needs the focused test or smoke proof." });
    }
    const uiFacing = [
      typed.capabilityLabel,
      typed.requiredNextAction,
      typed.expectedAdapter,
      typed.proofCommand,
      typed.proofArtifact?.artifactId,
      typed.workflowContract?.route,
      typed.workflowContract?.routeHandler,
      typed.workflowContract?.storageModule,
      typed.workflowContract?.proofRowId,
      typed.workflowContract?.testName,
      ...(typed.blockers || [])
    ].filter(Boolean).join(" ").toLowerCase();
    for (const phrase of PRODUCT_READINESS_FORBIDDEN_LANGUAGE) {
      if (uiFacing.includes(phrase)) blockers.push({ code: "prompt_shaped_language", rowId, field: "capabilityLabel", detail: `Beta rows cannot contain prompt-shaped language: ${phrase}.` });
    }
    if (typed.capabilityLabel && !hasDomainNativeLabel(typed.capabilityLabel)) {
      blockers.push({ code: "non_domain_native_label", rowId, field: "capabilityLabel", detail: "Beta rows must use domain-native terminology." });
    }
  }
  return {
    ok: blockers.length === 0,
    blockerCodes: [...new Set(blockers.map((item) => item.code))].sort(),
    blockers
  };
}

function betaRowFromProduct(input: {
  id: BetaReadinessCapabilityId;
  ownerLane: BetaReadinessRow["ownerLane"];
  capabilityLabel: string;
  productRow?: ProductReadinessRow;
  requiredNextAction: string;
  persistenceMode: BetaReadinessPersistenceMode;
  expectedAdapter: string;
  payloadShape: string[];
  proofCommand: string;
  workflowContract: BetaReadinessWorkflowContract;
  uiQualityProofStatus?: BetaReadinessRow["uiQualityProofStatus"];
  customerVisibleStateOverride?: ProductReadinessState;
  extraBlockers?: string[];
}): BetaReadinessRow {
  const blockers = [...(input.productRow?.blockers || ["missing_product_readiness_row"]), ...(input.extraBlockers || [])].filter(Boolean);
  const state = input.customerVisibleStateOverride || (blockers.length ? "blocked" : input.productRow?.customerVisibleState || "blocked");
  return {
    id: input.id,
    ownerLane: input.ownerLane,
    capabilityLabel: input.capabilityLabel,
    proofArtifact: input.productRow?.proofArtifact ?? missingBetaProof(input.id),
    latestCommitOrCheck: input.productRow?.lastCheckedAt || "missing_check",
    customerVisibleState: state,
    blockers: Array.from(new Set(blockers)),
    blockingReason: blockers.length ? blockers[0]! : null,
    deployRisk: state === "ready" ? input.productRow?.deployRisk || "none" : "high",
    requiredNextAction: input.requiredNextAction,
    uiQualityProofStatus: input.uiQualityProofStatus || "not_required",
    persistenceMode: input.persistenceMode,
    expectedAdapter: input.expectedAdapter,
    payloadShape: input.payloadShape,
    proofCommand: input.proofCommand,
    workflowContract: input.workflowContract
  };
}

function missingBetaProof(id: BetaReadinessCapabilityId): ProductReadinessRow["proofArtifact"] {
  return {
    schemaVersion: "missing",
    artifactId: `${id}.missing_proof`
  };
}

function supportInviteReady(input: Array<{ bundle?: Partial<AnalystHandoffConsumerBundle> }>): boolean {
  return input.some((item) => (item.bundle?.deployGateEvidence?.supportExecutor || []).some((row) =>
    row.ready
    && row.executableByExistingEndpoint
    && Boolean(row.executorContract?.path)
    && row.action.includes("invite")
    && !row.blockers.length
  ));
}

function productRowFromMatrix(input: {
  id: ProductReadinessCapabilityId;
  ownerLane: ProductReadinessOwnerLane;
  capabilityLabel: string;
  matrixRow?: AnalystHandoffReadinessMatrixRow;
  lastCheckedAt: string;
  requiredNextAction: string;
  customerVisible?: boolean;
  workflowContract: ProductReadinessWorkflowContract;
}): ProductReadinessRow {
  const status = input.matrixRow?.status || "needs_input";
  const blockers = input.matrixRow
    ? input.matrixRow.blockingGaps
    : ["missing_readiness_matrix_row"];
  return {
    id: input.id,
    ownerLane: input.ownerLane,
    capabilityLabel: input.capabilityLabel,
    proofArtifact: input.matrixRow?.currentProofArtifact ?? missingProductProof(input.id),
    lastCheckedAt: input.lastCheckedAt,
    customerVisible: input.customerVisible ?? true,
    customerVisibleState: status === "ready" ? "ready" : status === "provisional" ? "provisional" : "blocked",
    blockers,
    requiredNextAction: input.requiredNextAction,
    deployRisk: input.matrixRow?.deployRisk ?? "high",
    uiQualityProofExists: false,
    workflowContract: withProductContractReferences(input.id, input.workflowContract)
  };
}

function surfaceProductReadinessRow(input: {
  id: ProductReadinessCapabilityId;
  ownerLane: ProductReadinessOwnerLane;
  capabilityLabel: string;
  proof?: ProductReadinessUiQualityProof;
  checkedAt: string;
  requiredNextAction: string;
  workflowContract: ProductReadinessWorkflowContract;
}): ProductReadinessRow {
  const blockers = input.proof
    ? input.proof.passed ? [] : input.proof.blockers.length ? input.proof.blockers : [`${input.proof.surface}_ui_quality_proof_failed`]
    : [`missing_${input.ownerLane}_ui_quality_proof`];
  return {
    id: input.id,
    ownerLane: input.ownerLane,
    capabilityLabel: input.capabilityLabel,
    proofArtifact: input.proof
      ? {
          schemaVersion: input.proof.schemaVersion,
          artifactId: input.proof.proofArtifactId,
          route: input.proof.route,
          probeId: `${input.proof.surface}.ui_quality`
        }
      : missingProductProof(input.id),
    lastCheckedAt: input.proof?.checkedAt || input.checkedAt,
    customerVisible: true,
    customerVisibleState: blockers.length ? "blocked" : "ready",
    blockers,
    requiredNextAction: input.requiredNextAction,
    deployRisk: blockers.length ? "high" : "none",
    uiQualityProofExists: Boolean(input.proof?.passed),
    workflowContract: withProductContractReferences(input.id, input.workflowContract)
  };
}

function withProductContractReferences(id: ProductReadinessCapabilityId, contract: ProductReadinessWorkflowContract): ProductReadinessWorkflowContract {
  return {
    ...contract,
    contractReferences: contract.contractReferences ?? productContractReferences(id)
  };
}

function productContractReferences(id: ProductReadinessCapabilityId): ProductReadinessContractReference[] {
  switch (id) {
    case "organization_lifecycle":
      return [metadataContractReference({
        ownerLane: "org",
        schemaVersions: [ORGANIZATION_LIFECYCLE_READINESS_SCHEMA_VERSION],
        routes: ["POST /api/organizations", "GET /api/organizations/:id/readiness-lifecycle"],
        blockerCodes: ["org_missing", "missing_active_owner", "member_inactive"],
        scopeFields: ["tenantId", "organizationId", "member.role", "member.status"],
        downstreamConsumers: [
          { ownerLane: "watchlist", route: "GET /api/organizations/:id/watchlists/alert-terms", requiredFields: ["organizationId", "tenantId", "member.role", "member.status"] },
          { ownerLane: "support", route: "POST /api/admin/support/organizations/:id/access-recovery", requiredFields: ["organizationId", "actorId", "audit.reason"] }
        ]
      })];
    case "shared_watchlists":
      return [metadataContractReference({
        ownerLane: "watchlist",
        schemaVersions: [
          ORG_SHARED_WATCHLIST_ALERT_EXPORT_SCHEMA_VERSION,
          ORG_SHARED_WATCHLIST_ALERT_CONSUMERS_SCHEMA_VERSION,
          ORG_SHARED_WATCHLIST_READINESS_PROOF_SCHEMA_VERSION
        ],
        routes: ["GET /api/organizations/:id/watchlists/alert-terms", "/v1/dwm/watchlists", "/v1/dwm/alerts/generation-readiness"],
        blockerCodes: ["not_member", "member_inactive", "role_not_allowed", "term_org_mismatch", "no_active_watchlist_terms"],
        scopeFields: ["tenantId", "organizationId", "member.role", "member.status", "watchlistId", "watchlistItemIds"],
        downstreamConsumers: [
          { ownerLane: "alert", route: "/v1/dwm/alerts/generation-readiness", requiredFields: ["runtimeWatchlists", "termExport.alertGeneratorKeys", "termExport.watchlistItemIds"] },
          { ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver", requiredFields: ["runtimeWatchlists[].webhookDestinationId", "termExport.alertGeneratorKeys"] },
          { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["state", "member.role", "termExport", "blockers.code"] }
        ]
      })];
    case "source_activation":
      return [metadataContractReference({
        ownerLane: "source",
        schemaVersions: [DWM_SOURCE_WORKER_READINESS_SCHEMA_VERSION, DWM_SOURCE_PACK_ACTION_CONTRACT_SCHEMA_VERSION],
        routes: ["GET /v1/dwm/source-requests/readiness", "POST /v1/dwm/source-requests/actions"],
        blockerCodes: ["source_inactive", "source_policy_inactive", "source_worker_not_ready", "missing_source_provenance"],
        scopeFields: ["tenantId", "organizationId", "sourceIds", "sourceFamily", "provenance.refs"],
        downstreamConsumers: [
          { ownerLane: "alert", route: "POST /v1/dwm/alerts/rebuild", requiredFields: ["sourceIds", "captureIds", "freshProvenance"] },
          { ownerLane: "publicTI", route: "/ti", requiredFields: ["artifactId", "provenance", "backedIds.sourceIds"] }
        ]
      })];
    case "alert_case_workflow":
      return [metadataContractReference({
        ownerLane: "alert",
        schemaVersions: [ORG_ALERT_WATCHLIST_READINESS_SCHEMA_VERSION, "dwm.alert_case_handoff.v1", "analyst.case_detail.v1"],
        routes: ["POST /v1/dwm/alerts/rebuild", "POST /v1/dwm/alerts/:alertId/case-handoff", "POST /v1/cases"],
        blockerCodes: ["missing_alert_provenance", "missing_alert_id", "case_closed", "organization_visibility_denied", "case_read_only_member"],
        scopeFields: ["tenantId", "organizationId", "alertId", "caseId", "casePath", "watchlistItemIds"],
        downstreamConsumers: [
          { ownerLane: "case", route: "PATCH /v1/cases/:caseId", requiredFields: ["alertId", "casePath", "workflowState", "timeline"] },
          { ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver", requiredFields: ["alertId", "casePath", "webhookDestinationIds"] },
          { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["alertId", "casePath", "nextAllowedActions"] }
        ]
      })];
    case "webhook_delivery":
      return [metadataContractReference({
        ownerLane: "webhook",
        schemaVersions: [DWM_WEBHOOK_DESTINATION_LIFECYCLE_SCHEMA_VERSION, DWM_WEBHOOK_AUDIT_EVENT_SCHEMA_VERSION],
        routes: ["POST /api/organizations/:id/webhooks", "POST /v1/dwm/webhooks/deliver"],
        blockerCodes: ["missing_webhook_destination", "webhook_not_verified", "unsupported_destination", "organization_visibility_denied"],
        scopeFields: ["tenantId", "organizationId", "destinationId", "webhookDestinationIds", "alertId", "casePath"],
        downstreamConsumers: [
          { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["deliveryId", "destination.status", "lastAttempt.status"] },
          { ownerLane: "support", route: "/api/admin/support/readiness", requiredFields: ["organizationId", "destinationId", "auditEventId"] }
        ]
      })];
    case "support_controls":
      return [metadataContractReference({
        ownerLane: "support",
        schemaVersions: [SUPPORT_ACTION_EXECUTION_HANDOFF_SCHEMA_VERSION, SUPPORT_ACTION_EXECUTOR_READINESS_SCHEMA_VERSION],
        routes: ["GET /api/admin/support/readiness", "POST /api/admin/support/organizations/:id/access-recovery", "POST /api/admin/support/organizations/:id/invites"],
        blockerCodes: ["support_executor_unavailable", "helpdesk_audit_unavailable", "missing_invite_teammate_executor"],
        scopeFields: ["tenantId", "organizationId", "actorId", "action", "audit.reason", "idempotencyKey"],
        downstreamConsumers: [
          { ownerLane: "org", route: "GET /api/organizations/:id/members", requiredFields: ["member.status", "invite.status", "auditEventId"] },
          { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["organizationId", "supportAction.status"] }
        ]
      })];
    case "public_ti_actor_handoff":
      return [metadataContractReference({
        ownerLane: "publicTI",
        schemaVersions: [PUBLIC_TI_HANDOFF_SCHEMA_VERSION, PUBLIC_TI_READINESS_SCHEMA_VERSION],
        routes: ["/ti", "/api/ti/search"],
        blockerCodes: ["public_ti_contract_mismatch", "missing_source_provenance", "source_coverage_required_for_ti"],
        scopeFields: ["tenantId", "organizationId", "artifactId", "query", "provenance.refs"],
        downstreamConsumers: [
          { ownerLane: "watchlist", route: "GET /api/organizations/:id/watchlists/alert-terms", requiredFields: ["watchlistTerms", "actorAliases", "provenance"] },
          { ownerLane: "case", route: "POST /v1/cases", requiredFields: ["actorId", "casePath", "sourceRefs"] }
        ]
      })];
    case "dashboard_operator_workspace":
      return [metadataContractReference({
        ownerLane: "dashboard",
        schemaVersions: [UI_QUALITY_PROOF_SCHEMA_VERSION, "analyst.case_detail.v1"],
        routes: ["/dashboard", "/v1/cases/:caseId"],
        blockerCodes: ["missing_dashboard_ui_quality_proof", "case_read_only_member", "organization_visibility_denied"],
        scopeFields: ["tenantId", "organizationId", "member.role", "alertId", "caseId"],
        downstreamConsumers: [
          { ownerLane: "alert", route: "PATCH /v1/cases/:caseId", requiredFields: ["status", "assignedOwner", "rationale"] },
          { ownerLane: "support", route: "/api/admin/support/readiness", requiredFields: ["organizationId", "caseId", "auditEventId"] }
        ]
      })];
    case "website_product_surface":
      return [metadataContractReference({
        ownerLane: "website",
        schemaVersions: [UI_QUALITY_PROOF_SCHEMA_VERSION, PRODUCT_READINESS_SCHEMA_VERSION],
        routes: ["/", "/solutions/onion-session"],
        blockerCodes: ["missing_website_ui_quality_proof"],
        scopeFields: ["route", "checkedAt", "proofArtifactId"],
        downstreamConsumers: [
          { ownerLane: "integration", route: "/v1/contracts", requiredFields: ["routeInventory", "surfaces", "publicCompatibility"] }
        ]
      })];
  }
}

function metadataContractReference(input: Omit<ProductReadinessContractReference, "safeOutput">): ProductReadinessContractReference {
  return {
    ...input,
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

function missingProductProof(id: ProductReadinessCapabilityId): ProductReadinessRow["proofArtifact"] {
  return {
    schemaVersion: "missing",
    artifactId: `${id}.missing_proof`
  };
}

function latestGeneratedAt(bundles: Array<{ bundle?: Partial<AnalystHandoffConsumerBundle> }>, fallback: string): string {
  return firstString(bundles.map((item) => item.bundle?.generatedAt)) || fallback;
}

function latestOrgLifecycleCheckedAt(bundles: Array<{ bundle?: Partial<AnalystHandoffConsumerBundle> }>, fallback: string): string {
  return firstString(bundles.flatMap((item) => item.bundle?.deployGateEvidence?.orgLifecycle?.map(() => item.bundle?.generatedAt) || [])) || latestGeneratedAt(bundles, fallback);
}

function latestSourceCheckedAt(bundles: Array<{ bundle?: Partial<AnalystHandoffConsumerBundle> }>, fallback: string): string {
  return firstString(bundles.map((item) => item.bundle?.sourceReadiness?.checkedAt)) || fallback;
}

function latestWebhookCheckedAt(bundles: Array<{ bundle?: Partial<AnalystHandoffConsumerBundle> }>, fallback: string): string {
  return firstString(bundles.flatMap((item) => item.bundle?.stages?.webhookTrigger?.destinationLifecycle?.map((row) => row.updatedAt) || []))
    || latestGeneratedAt(bundles, fallback);
}

function firstSurfaceProof(
  bundles: Array<{ bundle?: Partial<AnalystHandoffConsumerBundle> }>,
  surface: ProductReadinessUiQualityProof["surface"]
): ProductReadinessUiQualityProof | undefined {
  return bundles.map((item) => item.bundle?.productSurfaceProof?.[surface]).find((proof): proof is ProductReadinessUiQualityProof => Boolean(proof));
}

function maxDeployRisk(values: ProductReadinessRow["deployRisk"][]): ProductReadinessRow["deployRisk"] {
  if (values.includes("high")) return "high";
  if (values.includes("medium")) return "medium";
  if (values.includes("low")) return "low";
  return "none";
}

function hasDomainNativeLabel(label: string): boolean {
  const normalized = label.toLowerCase();
  return [
    "organization",
    "watchlist",
    "source",
    "alert",
    "webhook",
    "support",
    "dashboard",
    "threat intelligence",
    "website",
    "team",
    "invitation",
    "notification",
    "destination",
    "analyst",
    "case"
  ].some((term) => normalized.includes(term));
}

function readinessRow(input: {
  id: AnalystHandoffReadinessCapability;
  ownerLane: AnalystHandoffOwnerLane;
  capability: string;
  proof?: AnalystHandoffReadinessMatrixRow["currentProofArtifact"];
  gaps: string[];
  requiredRoute?: string;
  requiredAction?: string;
  requiredProbe?: string;
  customerVisible: boolean;
  provisional?: boolean;
}): AnalystHandoffReadinessMatrixRow {
  const blockingGaps = Array.from(new Set(input.gaps.filter(Boolean)));
  const status = blockingGaps.length ? "blocked" : input.provisional ? "provisional" : input.proof ? "ready" : "needs_input";
  return {
    id: input.id,
    ownerLane: input.ownerLane,
    status,
    capability: input.capability,
    currentProofArtifact: input.proof ?? {
      schemaVersion: "missing",
      artifactId: `${input.id}.missing_proof`,
      route: input.requiredRoute,
      probeId: input.requiredProbe
    },
    blockingGaps: status === "needs_input" && !blockingGaps.length ? ["missing_proof_artifact"] : blockingGaps,
    requiredRoute: input.requiredRoute,
    requiredAction: input.requiredAction,
    requiredProbe: input.requiredProbe,
    deployRisk: deployRisk(status, input.customerVisible),
    customerVisible: input.customerVisible
  };
}

function deployRisk(status: AnalystHandoffReadinessMatrixRow["status"], customerVisible: boolean): AnalystHandoffReadinessMatrixRow["deployRisk"] {
  if (status === "ready") return "none";
  if (status === "provisional") return customerVisible ? "medium" : "low";
  if (status === "needs_input") return customerVisible ? "medium" : "low";
  return customerVisible ? "high" : "medium";
}

function deployGateRowsByKind(rows: AnalystHandoffDeployGateRow[], kind: AnalystHandoffDeployGateRowKind): AnalystHandoffDeployGateRow[] {
  return rows.filter((row) => row.kind === kind);
}

function proofFromDeployGate(rows: AnalystHandoffDeployGateRow[], kind: AnalystHandoffDeployGateRowKind): AnalystHandoffReadinessMatrixRow["currentProofArtifact"] | undefined {
  const row = deployGateRowsByKind(rows, kind)[0];
  if (!row) return undefined;
  return {
    schemaVersion: row.schemaVersion,
    artifactId: `deploy_gate.${kind}`,
    sourceFile: row.sourceFile,
    route: row.route,
    probeId: row.kind
  };
}

function proofFromBundle(
  bundles: Array<{ file?: string; bundle?: Partial<AnalystHandoffConsumerBundle> }>,
  schemaVersion: string,
  artifactId: string
): AnalystHandoffReadinessMatrixRow["currentProofArtifact"] | undefined {
  const source = bundles.find((item) => item.bundle);
  if (!source) return undefined;
  return { schemaVersion, artifactId, sourceFile: source.file };
}

function sharedWatchlistProof(bundles: Array<{ file?: string; bundle?: Partial<AnalystHandoffConsumerBundle> }>): AnalystHandoffReadinessMatrixRow["currentProofArtifact"] | undefined {
  const source = bundles.find((item) => item.bundle?.stages?.orgWatchlist?.termsExport);
  const exportContract = source?.bundle?.stages?.orgWatchlist?.termsExport;
  if (!source || !exportContract) return undefined;
  return {
    schemaVersion: exportContract.schemaVersion,
    artifactId: "org_watchlist.alert_terms_export",
    sourceFile: source.file,
    route: "GET /api/organizations/:id/watchlists/alert-terms",
    probeId: "org.watchlist_alert_terms_export"
  };
}

function sharedWatchlistGaps(bundles: Array<{ bundle?: Partial<AnalystHandoffConsumerBundle> }>): string[] {
  if (!bundles.length) return ["missing_handoff_bundle"];
  return bundles.flatMap(({ bundle }) => {
    const termsExport = bundle?.stages?.orgWatchlist?.termsExport;
    if (!termsExport) return ["missing_shared_watchlist_export"];
    return [
      ...(!termsExport.canGenerateAlerts ? ["watchlist_export_cannot_generate_alerts"] : []),
      ...(!(termsExport.activeTerms?.length || termsExport.activeWatchlistTerms?.length) ? ["missing_active_watchlist_terms"] : []),
      ...(termsExport.blockedReasons || [])
    ];
  });
}

function sourceProof(bundles: Array<{ file?: string; bundle?: Partial<AnalystHandoffConsumerBundle> }>): AnalystHandoffReadinessMatrixRow["currentProofArtifact"] | undefined {
  const source = bundles.find((item) => item.bundle?.sourceReadiness);
  const readiness = source?.bundle?.sourceReadiness;
  if (!source || !readiness) return undefined;
  return {
    schemaVersion: readiness.schemaVersion,
    artifactId: "dwm.source_worker_readiness",
    sourceFile: source.file,
    route: "GET /v1/dwm/source-requests/readiness",
    probeId: "dwm.source_worker_readiness"
  };
}

function sourceGaps(bundles: Array<{ bundle?: Partial<AnalystHandoffConsumerBundle> }>): string[] {
  if (!bundles.length) return ["missing_handoff_bundle"];
  return bundles.flatMap(({ bundle }) => {
    const readiness = bundle?.sourceReadiness;
    if (!readiness) return ["missing_source_readiness"];
    return [
      ...(!readiness.ready ? ["source_worker_not_ready"] : []),
      ...(!readiness.freshProvenance ? ["missing_fresh_source_provenance"] : []),
      ...(!readiness.sourceIds.length ? ["missing_active_source_ids"] : []),
      ...(readiness.blockers || [])
    ];
  });
}

function entitlementProof(bundles: Array<{ file?: string; bundle?: Partial<AnalystHandoffConsumerBundle> }>): AnalystHandoffReadinessMatrixRow["currentProofArtifact"] | undefined {
  const source = bundles.find((item) => item.bundle?.entitlement);
  const entitlement = source?.bundle?.entitlement;
  if (!source || !entitlement) return undefined;
  return {
    schemaVersion: entitlement.schemaVersion ?? DWM_ENTITLEMENT_READ_MODEL_SCHEMA_VERSION,
    artifactId: "dwm.entitlement_readiness",
    sourceFile: source.file,
    route: "GET /v1/organizations/:id/entitlements/readiness",
    probeId: "dwm.entitlement_readiness"
  };
}

function entitlementGaps(bundles: Array<{ bundle?: Partial<AnalystHandoffConsumerBundle> }>): string[] {
  if (!bundles.length) return ["missing_handoff_bundle"];
  return bundles.flatMap(({ bundle }) => {
    const entitlement = bundle?.entitlement;
    const compatibilityBlockers = bundle?.compatibility?.entitlementBlockers || [];
    if (!entitlement) return ["missing_entitlement_readiness"];
    return [
      ...(!entitlement.allowed ? [entitlement.reason || "entitlement_blocked"] : []),
      ...compatibilityBlockers.filter((item) => item.status === "blocked" || item.blockerCode).map((item) => item.blockerCode)
    ];
  });
}

function deployGateRowsForBundle(
  file: string | undefined,
  bundle: Partial<AnalystHandoffConsumerBundle> | undefined,
  result: AnalystHandoffValidationReport["results"][number] | undefined
): AnalystHandoffDeployGateRow[] {
  if (!bundle) return [];
  const rows: AnalystHandoffDeployGateRow[] = [];
  const identity = result?.identity;
  const publicTiRows = bundle.deployGateEvidence?.publicTiReadiness || [];
  for (const row of publicTiRows) {
    const blockerCodes = (row.blockers || []).map((item) => item.code).filter(Boolean);
    rows.push({
      kind: "public_ti_readiness",
      ownerLane: "publicTI",
      ok: row.schemaVersion === PUBLIC_TI_READINESS_SCHEMA_VERSION && row.state !== "blocked" && !blockerCodes.length,
      schemaVersion: row.schemaVersion,
      sourceFile: file,
      route: firstString((row.blockers || []).map((item) => item.route)),
      blockerCodes,
      requiredFields: [
        "schemaVersion",
        "state",
        "backedIds.organizationIds",
        "backedIds.alertIds",
        "backedIds.casePaths",
        "backedIds.webhookDestinationIds",
        "blockers[].ownerLane"
      ],
      identity: deployGateIdentity(identity)
    });
  }

  for (const row of bundle.deployGateEvidence?.orgAlertWatchlistReadiness || []) {
    const blockerCodes = row.blockers.map((item) => item.code).filter(Boolean);
    rows.push({
      kind: "org_alert_watchlist_readiness",
      ownerLane: row.blockers.some((item) => item.ownerLane === "org") ? "org" : "alert",
      ok: row.schemaVersion === ORG_ALERT_WATCHLIST_READINESS_SCHEMA_VERSION && row.ok && !blockerCodes.length,
      schemaVersion: row.schemaVersion,
      sourceFile: file,
      route: row.route,
      action: "rebuild_org_scoped_dwm_alerts",
      blockerCodes,
      requiredFields: [
        "schemaVersion",
        "ok",
        "route",
        "routeHandler",
        "storageModule",
        "proofRowId",
        "expectedAdapter",
        "payloadShape",
        "proofCommand",
        "request.body.organizationId",
        "request.body.watchlistId",
        "request.body.watchlistItemIds",
        "downstream.caseRoute",
        "downstream.webhookRoute",
        "blockers[].ownerLane"
      ],
      identity: {
        ...deployGateIdentity(identity),
        organizationId: row.handoff?.organizationId || identity?.organizationId,
        watchlistId: row.handoff?.watchlistId || identity?.watchlistId,
        watchlistItemIds: row.handoff?.watchlistItemIds?.length ? row.handoff.watchlistItemIds : identity?.watchlistItemIds
      }
    });
  }

  if (bundle.stages?.caseHandoff || bundle.stages?.orgWatchlist) {
    const caseRequest = bundle.stages.caseHandoff?.request as AlertCaseAdapterValue["request"] | undefined;
    const orgRequest = bundle.stages.orgWatchlist?.request as AlertGenerationAdapterValue["request"] | undefined;
    const caseBody = caseRequest?.body;
    const orgBody = orgRequest?.body;
    const blockerCodes = [
      ...(!orgBody?.watchlistId ? ["missing_watchlist_id"] : []),
      ...(!orgBody?.watchlistItemIds?.length ? ["missing_watchlist_item"] : []),
      ...(!caseBody?.alertId ? ["absent_alert_id"] : []),
      ...(!caseBody?.casePath ? ["case_route_unavailable"] : []),
      ...(!caseBody?.captureIds?.length ? ["missing_provenance"] : []),
    ];
    rows.push({
      kind: "alert_case_handoff",
      ownerLane: blockerCodes.some((code) => code === "absent_alert_id" || code === "case_route_unavailable") ? "case" : "alert",
      ok: caseRequest?.method === "POST" && caseRequest.path === "/v1/cases" && orgRequest?.method === "POST" && orgRequest.path === "/v1/dwm/alerts/rebuild" && blockerCodes.length === 0,
      schemaVersion: ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION,
      sourceFile: file,
      route: caseRequest?.path,
      action: "case_handoff",
      blockerCodes,
      requiredFields: [
        "stages.orgWatchlist.request.body.watchlistId",
        "stages.orgWatchlist.request.body.watchlistItemIds",
        "stages.caseHandoff.request.path",
        "stages.caseHandoff.request.body.alertId",
        "stages.caseHandoff.request.body.casePath",
        "stages.caseHandoff.request.body.captureIds"
      ],
      identity: deployGateIdentity(identity)
    });
  }

  const webhookRows = [
    ...(bundle.deployGateEvidence?.webhookDestinations || []),
    ...((bundle.stages?.webhookTrigger?.destinationLifecycle || []).map((row) => ({
      schemaVersion: DWM_WEBHOOK_DESTINATION_ADMIN_PROOF_ROW_SCHEMA_VERSION,
      destinationId: row.destinationId,
      orgId: row.orgId,
      access: { canRead: row.access.canReadStatus, canManage: row.access.canManage, memberSafe: row.access.memberSafe },
      health: { ready: row.health.ready, status: row.health.status, adminProofBlockers: row.health.blockers.map((code) => ({ code })) },
      retry: { retryable: row.retry.retryable, lastErrorCategory: row.retry.lastErrorCategory }
    } satisfies AnalystHandoffWebhookDestinationAdminProofRow)))
  ];
  for (const row of webhookRows) {
    const blockerCodes = (row.health?.adminProofBlockers || []).map((item) => item.code).filter((code): code is string => Boolean(code));
    rows.push({
      kind: "webhook_destination",
      ownerLane: "webhook",
      ok: row.schemaVersion === DWM_WEBHOOK_DESTINATION_ADMIN_PROOF_ROW_SCHEMA_VERSION && row.access?.canRead !== false && row.health?.ready === true && !blockerCodes.length,
      schemaVersion: row.schemaVersion,
      sourceFile: file,
      action: row.retry?.retryable ? "retry_or_replay" : "delivery_readiness",
      route: "GET /api/dwm/webhooks?orgId=<org_id>",
      blockerCodes,
      requiredFields: [
        "schemaVersion",
        "destinationId",
        "orgId",
        "health.ready",
        "health.adminProofBlockers[].code",
        "retry.lastErrorCategory"
      ],
      identity: deployGateIdentity(identity)
    });
  }

  for (const row of bundle.deployGateEvidence?.orgLifecycle || []) {
    const blockerCodes = row.typedBlockers || [];
    rows.push({
      kind: "org_lifecycle",
      ownerLane: "org",
      ok: row.schemaVersion === ORGANIZATION_LIFECYCLE_READINESS_SCHEMA_VERSION && row.readyForOnboarding && !blockerCodes.length,
      schemaVersion: row.schemaVersion,
      sourceFile: file,
      route: row.alertExportReadiness?.route,
      action: "org_lifecycle_readiness",
      blockerCodes,
      requiredFields: [
        "schemaVersion",
        "organizationId",
        "tenantId",
        "readyForOnboarding",
        "watchlistReadiness.ready",
        "alertExportReadiness.route",
        "typedBlockers"
      ],
      identity: deployGateIdentity(identity)
    });
  }

  const supportRows = [
    ...(bundle.deployGateEvidence?.supportExecutor || []),
    ...((bundle.compatibility?.supportActions || []).map((item) => item.executorReadiness).filter(Boolean) as AnalystHandoffSupportExecutorReadiness[])
  ];
  for (const row of supportRows) {
    rows.push({
      kind: "support_executor",
      ownerLane: "helpdesk",
      ok: row.schemaVersion === SUPPORT_ACTION_EXECUTOR_READINESS_SCHEMA_VERSION && row.ready && row.noMutation !== false && Boolean(row.executorContract?.path) && !row.blockers.length,
      schemaVersion: row.schemaVersion,
      sourceFile: file,
      action: row.action,
      route: row.executorContract?.path,
      blockerCodes: row.blockers || [],
      requiredFields: [
        "schemaVersion",
        "ready",
        "mutationMode",
        "noMutation",
        "action",
        "executorContract.path",
        "executorContract.requiredHeaders",
        "executorContract.requiredBody",
        "blockers"
      ],
      identity: deployGateIdentity(identity)
    });
  }

  return rows;
}

function deployGateIdentity(identity: AnalystHandoffIdentity | undefined): AnalystHandoffDeployGateRow["identity"] {
  if (!identity) return undefined;
  return {
    organizationId: identity.organizationId,
    watchlistId: identity.watchlistId,
    watchlistItemIds: identity.watchlistItemIds,
    alertId: identity.alertId,
    casePath: identity.casePath,
    webhookDestinationIds: identity.webhookDestinationIds
  };
}

function firstString(values: Array<string | undefined>): string | undefined {
  return values.find((value): value is string => Boolean(value));
}

function validateStageEnvelope(
  stage: AnalystHandoffConsumerStageName,
  handoff: AnalystHandoffEnvelope<AnalystHandoffKind, unknown> | undefined,
  staleEvidenceBefore?: string
): AnalystHandoffConsumerBlocker[] {
  const blockers: AnalystHandoffConsumerBlocker[] = [];
  if (!handoff) return [blocker("missing_stage", stage, `${stage}.handoff`, "Stage handoff envelope is missing.", true)];
  if (handoff.schemaVersion !== ANALYST_HANDOFF_SCHEMA_VERSION) {
    blockers.push(blocker("unsupported_schema", stage, `${stage}.handoff.schemaVersion`, `Expected ${ANALYST_HANDOFF_SCHEMA_VERSION}.`, false));
  }
  if (!handoff.identity?.tenantId) blockers.push(blocker("missing_identity", stage, `${stage}.handoff.identity.tenantId`, "Tenant identity is required.", false));
  if (!handoff.identity?.organizationId) blockers.push(blocker("missing_org", stage, `${stage}.handoff.identity.organizationId`, "Organization identity is required.", true));
  if (!handoff.payload) blockers.push(blocker("invalid_request", stage, `${stage}.handoff.payload`, "Stage payload is missing.", false));
  if (stage === "publicTi") {
    const artifact = (handoff.payload as any)?.artifact;
    if (!artifact?.provenance?.length) blockers.push(blocker("missing_provenance", stage, `${stage}.handoff.payload.artifact.provenance`, "Public TI artifact needs provenance before org handoff.", true));
    if (isStale(artifact?.freshness, staleEvidenceBefore)) blockers.push(blocker("stale_evidence", stage, `${stage}.handoff.payload.artifact.freshness`, "Public TI artifact evidence is stale.", true));
  }
  if ((stage === "caseHandoff" || stage === "webhookTrigger") && !handoff.identity?.captureIds?.length) {
    blockers.push(blocker("missing_provenance", stage, `${stage}.handoff.identity.captureIds`, "Alert handoff requires capture provenance.", true));
  }
  return blockers;
}

function validatePublicTiStage(stage?: ActorWatchlistAdapterValue): AnalystHandoffConsumerBlocker[] {
  if (!stage) return [];
  const blockers: AnalystHandoffConsumerBlocker[] = [];
  if (stage.request?.method !== "POST" || stage.request?.path !== "/v1/dwm/watchlists") {
    blockers.push(blocker("invalid_request", "publicTi", "publicTi.request", "Public TI stage must create an org watchlist.", false));
  }
  const body = stage.request?.body;
  if (!body?.organizationId) blockers.push(blocker("missing_org", "publicTi", "publicTi.request.body.organizationId", "Watchlist create request requires an organization id.", true));
  if (!body?.terms?.length) blockers.push(blocker("missing_watchlist_term", "publicTi", "publicTi.request.body.terms", "Watchlist create request requires at least one term.", true));
  return blockers;
}

function validateOrgWatchlistStage(
  stage: AnalystHandoffConsumerBundle["stages"]["orgWatchlist"],
  identity: AnalystHandoffIdentity | undefined,
  membership?: AnalystHandoffConsumerMembership,
  _entitlement?: AnalystHandoffConsumerEntitlement
): AnalystHandoffConsumerBlocker[] {
  if (!stage) return [];
  const blockers: AnalystHandoffConsumerBlocker[] = [];
  if (stage.request?.method !== "POST" || stage.request?.path !== "/v1/dwm/alerts/rebuild") {
    blockers.push(blocker("invalid_request", "orgWatchlist", "orgWatchlist.request", "Org watchlist stage must request alert rebuild.", false));
  }
  const body = stage.request?.body as Partial<AlertGenerationAdapterValue["request"]["body"]> | undefined;
  if (!body?.watchlistId) blockers.push(blocker("missing_watchlist_id", "orgWatchlist", "orgWatchlist.request.body.watchlistId", "Alert request requires a persisted watchlist id.", true));
  if (!body?.watchlistItemIds?.length) blockers.push(blocker("missing_watchlist_item", "orgWatchlist", "orgWatchlist.request.body.watchlistItemIds", "Alert request requires persisted watchlist item ids.", true));
  blockers.push(...validateOrgTermsExport(stage.termsExport, identity, body?.watchlistItemIds || [], membership));
  return blockers;
}

function validateOrgTermsExport(
  termsExport: OrgWatchlistAlertTermsExportContract | undefined,
  identity: AnalystHandoffIdentity | undefined,
  watchlistItemIds: string[],
  membership?: AnalystHandoffConsumerMembership
): AnalystHandoffConsumerBlocker[] {
  const blockers: AnalystHandoffConsumerBlocker[] = [];
  if (!termsExport) return [blocker("org_terms_contract_mismatch", "org_terms_export", "orgWatchlist.termsExport", "Organization alert-terms export is missing.", true)];
  if (termsExport.schemaVersion !== ORG_ALERT_TERMS_EXPORT_SCHEMA_VERSION) {
    blockers.push(blocker("unsupported_schema", "org_terms_export", "orgWatchlist.termsExport.schemaVersion", `Expected ${ORG_ALERT_TERMS_EXPORT_SCHEMA_VERSION}.`, false));
  }
  if (!termsExport.canGenerateAlerts || termsExport.blockedReasons?.length) {
    blockers.push(blocker("org_terms_contract_mismatch", "org_terms_export", "orgWatchlist.termsExport.canGenerateAlerts", `Org terms export blocks alert generation: ${(termsExport.blockedReasons || []).join(", ") || "unknown reason"}.`, true));
  }
  if (identity?.organizationId && termsExport.organizationId !== identity.organizationId) {
    blockers.push(blocker("identity_mismatch", "org_terms_export", "orgWatchlist.termsExport.organizationId", "Org terms export organization does not match handoff identity.", false));
  }
  if (identity?.tenantId && termsExport.tenantId !== identity.tenantId) {
    blockers.push(blocker("identity_mismatch", "org_terms_export", "orgWatchlist.termsExport.tenantId", "Org terms export tenant does not match handoff identity.", false));
  }
  if (membership && termsExport.member.userId !== membership.userId) {
    blockers.push(blocker("nonmember", "org_terms_export", "orgWatchlist.termsExport.member.userId", "Org terms export member does not match the active consumer identity.", false));
  }
  const activeIds = new Set([
    ...(termsExport.activeTerms || []).map((item) => item.watchlistItemId),
    ...(termsExport.activeWatchlistTerms || []).map((item) => item.watchlistItemId),
  ]);
  const missingIds = watchlistItemIds.filter((id) => !activeIds.has(id));
  if (missingIds.length) {
    blockers.push(blocker("org_terms_contract_mismatch", "org_terms_export", "orgWatchlist.termsExport.activeTerms", `Org terms export does not include active watchlist items: ${missingIds.join(", ")}.`, true));
  }
  if (identity?.normalizedWatchTerm) {
    const normalizedTerm = identity.normalizedWatchTerm.toLowerCase();
    const hasTerm = [...(termsExport.activeTerms || []), ...(termsExport.activeWatchlistTerms || [])]
      .some((item) => item.term.toLowerCase() === normalizedTerm || ("alertGenerationRef" in item && item.alertGenerationRef?.normalizedTerm === normalizedTerm));
    if (!hasTerm) {
      blockers.push(blocker("org_terms_contract_mismatch", "org_terms_export", "orgWatchlist.termsExport.activeTerms", `Org terms export does not include normalized term ${identity.normalizedWatchTerm}.`, true));
    }
  }
  const refMismatches = (termsExport.activeTerms || []).filter((item) => item.alertGenerationRef && (
    item.alertGenerationRef.schemaVersion !== ORG_ALERT_GENERATION_REF_SCHEMA_VERSION
    || item.alertGenerationRef.organizationId !== termsExport.organizationId
    || item.alertGenerationRef.tenantId !== termsExport.tenantId
    || item.alertGenerationRef.watchlistItemId !== item.watchlistItemId
    || item.alertGenerationRef.dedupe.parts.watchlistItemId !== item.watchlistItemId
    || item.alertGenerationRef.dedupe.parts.organizationId !== termsExport.organizationId
    || item.alertGenerationRef.dedupe.parts.tenantId !== termsExport.tenantId
    || item.alertGenerationRef.dedupe.parts.normalizedTerm !== item.alertGenerationRef.normalizedTerm
  ));
  const missingRefs = (termsExport.activeTerms || []).filter((item) => !item.alertGenerationRef);
  if (missingRefs.length) {
    blockers.push(blocker("alert_generation_ref_mismatch", "org_terms_export", "orgWatchlist.termsExport.activeTerms.alertGenerationRef", "Active org terms must include organization.watchlist_alert_generation_ref.v1.", true));
  }
  if (refMismatches.length) {
    blockers.push(blocker("alert_generation_ref_mismatch", "org_terms_export", "orgWatchlist.termsExport.activeTerms.alertGenerationRef", "Org alert generation refs must match export org, tenant, watchlist item, normalized term, and dedupe identity.", false));
  }
  return blockers;
}

function validateCaseStage(stage: AnalystHandoffConsumerBundle["stages"]["caseHandoff"], identity?: AnalystHandoffIdentity): AnalystHandoffConsumerBlocker[] {
  if (!stage) return [];
  const blockers: AnalystHandoffConsumerBlocker[] = [];
  if (stage.request?.method !== "POST" || stage.request?.path !== "/v1/cases") {
    blockers.push(blocker("invalid_request", "caseHandoff", "caseHandoff.request", "Case handoff must target /v1/cases.", false));
  }
  const body = stage.request?.body as Partial<AlertCaseAdapterValue["request"]["body"]> | undefined;
  if (!body?.alertId) blockers.push(blocker("absent_alert_id", "caseHandoff", "caseHandoff.request.body.alertId", "Case handoff requires an alert id.", false));
  if (!body?.casePath || !body?.caseIdCandidate) blockers.push(blocker("invalid_request", "caseHandoff", "caseHandoff.request.body.casePath", "Case handoff requires a stable case candidate and path.", true));
  if (!body?.captureIds?.length) blockers.push(blocker("missing_provenance", "caseHandoff", "caseHandoff.request.body.captureIds", "Case handoff requires capture ids.", true));
  if (identity?.watchlistItemIds?.length && !body?.watchlistItemIds?.length) blockers.push(blocker("missing_watchlist_item", "caseHandoff", "caseHandoff.request.body.watchlistItemIds", "Case handoff requires watchlist item ids.", true));
  return blockers;
}

function validateWebhookStage(stage: AnalystHandoffConsumerBundle["stages"]["webhookTrigger"], identity?: AnalystHandoffIdentity): AnalystHandoffConsumerBlocker[] {
  if (!stage) return [];
  const blockers: AnalystHandoffConsumerBlocker[] = [];
  if (stage.request?.method !== "POST" || stage.request?.path !== "/v1/dwm/webhooks/deliver") {
    blockers.push(blocker("webhook_trigger_contract_mismatch", "webhookTrigger", "webhookTrigger.request", "Webhook stage must trigger DWM webhook delivery.", false));
  }
  const body = stage.request?.body as Partial<AlertWebhookAdapterValue["request"]["body"]> | undefined;
  if (!body?.alertId) blockers.push(blocker("absent_alert_id", "webhookTrigger", "webhookTrigger.request.body.alertId", "Webhook trigger requires an alert id.", false));
  if (!body?.dedupeKey || !body?.idempotencyKey) blockers.push(blocker("webhook_trigger_contract_mismatch", "webhookTrigger", "webhookTrigger.request.body.idempotencyKey", "Webhook trigger requires dedupe and idempotency keys.", false));
  if (!body?.webhookDestinationIds?.length) blockers.push(blocker("webhook_trigger_contract_mismatch", "webhookTrigger", "webhookTrigger.request.body.webhookDestinationIds", "Webhook trigger requires at least one destination id.", true));
  if (!body?.captureIds?.length) blockers.push(blocker("missing_provenance", "webhookTrigger", "webhookTrigger.request.body.captureIds", "Webhook trigger requires capture ids.", true));
  if (identity?.organizationId && body?.organizationId !== identity.organizationId) {
    blockers.push(blocker("identity_mismatch", "webhookTrigger", "webhookTrigger.request.body.organizationId", "Webhook trigger organization does not match identity.", false));
  }
  blockers.push(...validateWebhookAudit(stage.auditEvents, body));
  blockers.push(...validateWebhookDestinationLifecycle(stage.destinationLifecycle, body, identity));
  return blockers;
}

function validateWebhookAudit(
  auditEvents: DwmWebhookAuditEventContract[] | undefined,
  body: Partial<AlertWebhookAdapterValue["request"]["body"]> | undefined
): AnalystHandoffConsumerBlocker[] {
  if (!auditEvents?.length) return [blocker("webhook_audit_contract_mismatch", "webhook_audit", "webhookTrigger.auditEvents", "Webhook audit event contract is missing.", true)];
  const matching = auditEvents.find((event) =>
    event.schemaVersion === DWM_WEBHOOK_AUDIT_EVENT_SCHEMA_VERSION
    && event.delivery?.alertId === body?.alertId
    && event.delivery?.idempotencyKey === body?.idempotencyKey
    && (!body?.webhookDestinationIds?.length || body.webhookDestinationIds.includes(event.destinationId || ""))
  );
  if (!matching) {
    return [blocker("webhook_audit_contract_mismatch", "webhook_audit", "webhookTrigger.auditEvents", "Webhook audit events do not match the trigger alert, destination, and idempotency key.", false)];
  }
  if (matching.schemaVersion !== DWM_WEBHOOK_AUDIT_EVENT_SCHEMA_VERSION) {
    return [blocker("unsupported_schema", "webhook_audit", "webhookTrigger.auditEvents.schemaVersion", `Expected ${DWM_WEBHOOK_AUDIT_EVENT_SCHEMA_VERSION}.`, false)];
  }
  return [];
}

function validateWebhookDestinationLifecycle(
  lifecycleRows: DwmWebhookDestinationLifecycleContract[] | undefined,
  body: Partial<AlertWebhookAdapterValue["request"]["body"]> | undefined,
  identity?: AnalystHandoffIdentity
): AnalystHandoffConsumerBlocker[] {
  if (!body?.webhookDestinationIds?.length) return [];
  if (!lifecycleRows?.length) {
    return [blocker("webhook_destination_lifecycle_mismatch", "webhook_lifecycle", "webhookTrigger.destinationLifecycle", "Webhook destination lifecycle contract is missing.", true)];
  }
  const rowsById = new Map(lifecycleRows.map((row) => [row.destinationId, row]));
  const blockers: AnalystHandoffConsumerBlocker[] = [];
  for (const destinationId of body.webhookDestinationIds) {
    const row = rowsById.get(destinationId);
    if (!row) {
      blockers.push(blocker("webhook_destination_lifecycle_mismatch", "webhook_lifecycle", "webhookTrigger.destinationLifecycle.destinationId", `Webhook destination ${destinationId} is missing lifecycle status.`, true));
      continue;
    }
    if (row.schemaVersion !== DWM_WEBHOOK_DESTINATION_LIFECYCLE_SCHEMA_VERSION) {
      blockers.push(blocker("unsupported_schema", "webhook_lifecycle", "webhookTrigger.destinationLifecycle.schemaVersion", `Expected ${DWM_WEBHOOK_DESTINATION_LIFECYCLE_SCHEMA_VERSION}.`, false));
    }
    if (identity?.organizationId && row.orgId !== identity.organizationId) {
      blockers.push(blocker("identity_mismatch", "webhook_lifecycle", "webhookTrigger.destinationLifecycle.orgId", "Webhook destination lifecycle organization does not match handoff identity.", false));
    }
    if (!row.enabled || !row.health.ready || row.health.blockers.length) {
      blockers.push(blocker("webhook_destination_lifecycle_mismatch", "webhook_lifecycle", "webhookTrigger.destinationLifecycle.health", `Webhook destination ${destinationId} is not ready: ${row.health.blockers.join(", ") || row.health.status}.`, true));
    }
  }
  return blockers;
}

function validateMembership(membership: AnalystHandoffConsumerMembership | undefined, identity?: AnalystHandoffIdentity): AnalystHandoffConsumerBlocker[] {
  if (!membership) return [blocker("nonmember", "membership", "membership", "Active organization membership is required to consume handoff adapters.", true)];
  if (membership.status !== "active") return [blocker("nonmember", "membership", "membership.status", "Membership must be active.", false)];
  if (!membership.allowedRoles.includes(membership.role)) return [blocker("nonmember", "membership", "membership.role", `Role ${membership.role} is not allowed for this handoff.`, false)];
  if (identity?.organizationId && membership.organizationId !== identity.organizationId) {
    return [blocker("nonmember", "membership", "membership.organizationId", "Membership organization does not match handoff organization.", false)];
  }
  if (identity?.requestedByUserId && membership.userId !== identity.requestedByUserId) {
    return [blocker("nonmember", "membership", "membership.userId", "Membership user does not match requested-by identity.", false)];
  }
  return [];
}

function validatePublicTiContract(
  publicTi: AnalystHandoffPublicTiContract | undefined,
  handoff: AnalystHandoffEnvelope<"actor_watchlist_candidate", unknown> | undefined,
  staleEvidenceBefore?: string
): AnalystHandoffConsumerBlocker[] {
  if (!publicTi) return [];
  const blockers: AnalystHandoffConsumerBlocker[] = [];
  if (publicTi.schemaVersion !== PUBLIC_TI_HANDOFF_SCHEMA_VERSION) {
    blockers.push(blocker("unsupported_schema", "public_ti", "publicTi.schemaVersion", `Expected ${PUBLIC_TI_HANDOFF_SCHEMA_VERSION}.`, false));
  }
  if (publicTi.source !== "public-ti") {
    blockers.push(blocker("public_ti_contract_mismatch", "public_ti", "publicTi.source", "Public TI handoff source must be public-ti.", false));
  }
  if (!publicTi.query.trim() || !publicTi.artifactId.trim()) {
    blockers.push(blocker("public_ti_contract_mismatch", "public_ti", "publicTi.query", "Public TI handoff requires query and artifact id.", true));
  }
  if (!publicTi.artifact?.provenance?.length) {
    blockers.push(blocker("missing_provenance", "public_ti", "publicTi.artifact.provenance", "Public TI handoff requires artifact provenance.", true));
  }
  if (publicTi.stale || isStale(publicTi.artifact?.freshness, staleEvidenceBefore)) {
    blockers.push(blocker("stale_evidence", "public_ti", "publicTi.artifact.freshness", "Public TI handoff evidence is stale.", true));
  }
  if (!publicTi.artifact?.watchlistTerms?.length) {
    blockers.push(blocker("missing_watchlist_term", "public_ti", "publicTi.artifact.watchlistTerms", "Public TI handoff needs at least one watchlist term.", true));
  }
  if (handoff?.identity?.artifactId && publicTi.artifactId !== handoff.identity.artifactId) {
    blockers.push(blocker("identity_mismatch", "public_ti", "publicTi.artifactId", "Public TI artifact id does not match consumer handoff identity.", false));
  }
  return blockers;
}

function validateEntitlement(entitlement?: AnalystHandoffConsumerEntitlement): AnalystHandoffConsumerBlocker[] {
  if (!entitlement) return [];
  if (entitlement.schemaVersion && entitlement.schemaVersion !== DWM_ENTITLEMENT_READ_MODEL_SCHEMA_VERSION) {
    return [blocker("unsupported_schema", "entitlement", "entitlement.schemaVersion", `Expected ${DWM_ENTITLEMENT_READ_MODEL_SCHEMA_VERSION}.`, false)];
  }
  if (!entitlement.allowed) {
    return [blocker("entitlement_blocked", "entitlement", "entitlement.allowed", entitlement.reason || "Current plan is not entitled to generate DWM alert handoffs.", true)];
  }
  return [];
}

function validateSourceReadiness(readiness: AnalystHandoffSourceWorkerReadiness | undefined, identity?: AnalystHandoffIdentity): AnalystHandoffConsumerBlocker[] {
  if (!readiness) return [];
  const blockers: AnalystHandoffConsumerBlocker[] = [];
  if (readiness.schemaVersion !== DWM_SOURCE_WORKER_READINESS_SCHEMA_VERSION) {
    blockers.push(blocker("unsupported_schema", "source_readiness", "sourceReadiness.schemaVersion", `Expected ${DWM_SOURCE_WORKER_READINESS_SCHEMA_VERSION}.`, false));
  }
  if (!readiness.ready || readiness.blockers.length) {
    blockers.push(blocker("source_worker_not_ready", "source_readiness", "sourceReadiness.ready", `Source worker is not ready: ${readiness.blockers.join(", ") || "readiness false"}.`, true));
  }
  if (!readiness.freshProvenance) {
    blockers.push(blocker("missing_provenance", "source_readiness", "sourceReadiness.freshProvenance", "Source worker readiness must confirm fresh provenance.", true));
  }
  const missingCaptureSource = (identity?.captureIds?.length || identity?.sourceFamily) && !readiness.sourceIds.length;
  if (missingCaptureSource) {
    blockers.push(blocker("missing_provenance", "source_readiness", "sourceReadiness.sourceIds", "Source worker readiness needs at least one source id for alert provenance.", true));
  }
  return blockers;
}

function validateCaseRouteAvailability(route: AnalystHandoffCaseRouteAvailability | undefined): AnalystHandoffConsumerBlocker[] {
  if (!route) return [blocker("case_route_unavailable", "case_route", "caseRoute", "Case route availability contract is missing.", true)];
  if (route.schemaVersion !== CASE_ROUTE_AVAILABILITY_SCHEMA_VERSION) {
    return [blocker("unsupported_schema", "case_route", "caseRoute.schemaVersion", `Expected ${CASE_ROUTE_AVAILABILITY_SCHEMA_VERSION}.`, false)];
  }
  if (!route.available || route.path !== "/v1/cases" || !route.methods.includes("POST")) {
    return [blocker("case_route_unavailable", "case_route", "caseRoute.available", route.reason || "Case route must expose POST /v1/cases.", true)];
  }
  return [];
}

function validateHelpdeskAction(action: AnalystHandoffHelpdeskActionAvailability | undefined): AnalystHandoffConsumerBlocker[] {
  if (!action) return [];
  if (action.schemaVersion !== HELPDESK_ACTION_AVAILABILITY_SCHEMA_VERSION) {
    return [blocker("unsupported_schema", "helpdesk", "helpdeskAction.schemaVersion", `Expected ${HELPDESK_ACTION_AVAILABILITY_SCHEMA_VERSION}.`, false)];
  }
  if (!action.available) {
    return [blocker("helpdesk_action_unavailable", "helpdesk", "helpdeskAction.available", action.reason || `Helpdesk action ${action.action} is unavailable.`, true)];
  }
  return [];
}

function validateCompatibilityEvidence(compatibility: AnalystHandoffConsumerBundle["compatibility"] | undefined): AnalystHandoffConsumerBlocker[] {
  if (!compatibility) return [];
  const blockers: AnalystHandoffConsumerBlocker[] = [];
  for (const item of compatibility.entitlementBlockers || []) {
    if (item.schemaVersion !== DWM_ENTITLEMENT_BLOCKER_SCHEMA_VERSION) {
      blockers.push(blocker("unsupported_schema", "entitlement", "compatibility.entitlementBlockers.schemaVersion", `Expected ${DWM_ENTITLEMENT_BLOCKER_SCHEMA_VERSION}.`, false, {
        action: item.action,
        route: item.route,
        evidenceSchemaVersion: String(item.schemaVersion)
      }));
      continue;
    }
    if (item.status === "blocked" || item.status === "needs_input" || item.blockerCode) {
      blockers.push(blocker("entitlement_blocked", "entitlement", `compatibility.entitlementBlockers.${item.actionId}`, item.supportText || item.nextStep || item.blockerCode, true, {
        action: item.action,
        route: item.route,
        evidenceSchemaVersion: item.schemaVersion
      }));
    }
  }
  for (const item of compatibility.sourceActions || []) {
    if (item.schemaVersion !== DWM_SOURCE_PACK_ACTION_CONTRACT_SCHEMA_VERSION) {
      blockers.push(blocker("unsupported_schema", "source_readiness", "compatibility.sourceActions.schemaVersion", `Expected ${DWM_SOURCE_PACK_ACTION_CONTRACT_SCHEMA_VERSION}.`, false, {
        action: item.action,
        evidenceSchemaVersion: String(item.schemaVersion)
      }));
      continue;
    }
    const blocking = item.blockers.filter((candidate) => candidate.severity === "blocking");
    if (!item.allowed || blocking.length) {
      blockers.push(blocker("source_worker_not_ready", "source_readiness", `compatibility.sourceActions.${item.candidateId || item.sourcePackId || item.action}`, blocking.map((candidate) => candidate.code || candidate.message || "source_action_blocked").join(", ") || "Source action contract is blocked.", true, {
        action: item.action,
        route: "dwm_source_pack_action",
        evidenceSchemaVersion: item.schemaVersion
      }));
    }
  }
  for (const item of compatibility.supportActions || []) {
    if (item.schemaVersion !== SUPPORT_ACTION_EXECUTION_HANDOFF_SCHEMA_VERSION) {
      blockers.push(blocker("unsupported_schema", "helpdesk", "compatibility.supportActions.schemaVersion", `Expected ${SUPPORT_ACTION_EXECUTION_HANDOFF_SCHEMA_VERSION}.`, false, {
        action: item.action,
        route: item.execution?.path,
        evidenceSchemaVersion: String(item.schemaVersion)
      }));
      continue;
    }
    if (!item.executable || item.blockers.length) {
      blockers.push(blocker("helpdesk_action_unavailable", "helpdesk", `compatibility.supportActions.${item.action}`, item.audit?.blockerCode || item.blockers[0] || "Support action execution handoff is not executable.", true, {
        action: item.action,
        route: item.execution?.path,
        evidenceSchemaVersion: item.schemaVersion
      }));
    }
  }
  return blockers;
}

function identityMismatchBlocker(stage: AnalystHandoffConsumerStageName, error: unknown): AnalystHandoffConsumerBlocker {
  const typed = error as AnalystHandoffIdentityMismatchError;
  return blocker("identity_mismatch", stage, `${stage}.handoff.identity.${String(typed.field || "unknown")}`, error instanceof Error ? error.message : "Handoff identity changed between stages.", false);
}

function requestSummary(request: unknown) {
  if (!request || typeof request !== "object") return undefined;
  const typed = request as { method?: string; path?: string; body?: Record<string, unknown> };
  return {
    method: typed.method,
    path: typed.path,
    bodyKeys: Object.keys(typed.body || {})
  };
}

function productReadinessFor(blockers: AnalystHandoffConsumerBlocker[]): Record<AnalystHandoffOwnerLane, AnalystHandoffLaneReadiness> {
  const lanes: AnalystHandoffOwnerLane[] = ["org", "alert", "source", "entitlement", "webhook", "case", "publicTI", "helpdesk"];
  return Object.fromEntries(lanes.map((owner) => {
    const owned = blockers.filter((blocker) => ownerLaneForBlocker(blocker) === owner);
    const blockerCodes = uniqueBlockerCodes(owned);
    return [owner, {
      owner,
      ok: owned.length === 0,
      blockerCodes,
      blockerCount: owned.length,
      recommendedOwnerLane: owner
    }];
  })) as Record<AnalystHandoffOwnerLane, AnalystHandoffLaneReadiness>;
}

function ownerLaneForBlocker(blocker: Pick<AnalystHandoffConsumerBlocker, "code" | "stage" | "field">): AnalystHandoffOwnerLane {
  if (blocker.stage === "org_terms_export" || blocker.code === "alert_generation_ref_mismatch" || blocker.code === "org_terms_contract_mismatch") return "org";
  if (blocker.stage === "entitlement" || blocker.code === "entitlement_blocked") return "entitlement";
  if (blocker.stage === "publicTi" || blocker.stage === "public_ti" || blocker.code === "public_ti_contract_mismatch" || blocker.code === "unsupported_actor_artifact" || blocker.code === "missing_watchlist_term") return "publicTI";
  if (blocker.stage === "source_readiness" || blocker.code === "source_worker_not_ready" || blocker.code === "missing_provenance") return "source";
  if (blocker.stage === "webhookTrigger" || blocker.stage === "webhook_audit" || blocker.stage === "webhook_lifecycle" || blocker.code.startsWith("webhook_")) return "webhook";
  if (blocker.stage === "caseHandoff" || blocker.stage === "case_route" || blocker.code === "case_route_unavailable") return "case";
  if (blocker.stage === "helpdesk" || blocker.code === "helpdesk_action_unavailable") return "helpdesk";
  if (blocker.code === "absent_alert_id" || blocker.stage === "orgWatchlist" || blocker.code === "missing_watchlist_id" || blocker.code === "missing_watchlist_item") return "alert";
  if (blocker.code === "nonmember") return "org";
  return "alert";
}

function uniqueBlockerCodes(blockers: Array<Pick<AnalystHandoffConsumerBlocker, "code">>) {
  return [...new Set(blockers.map((item) => item.code))].sort() as AnalystHandoffConsumerBlockerCode[];
}

function hasNoStageBlockers(blockers: AnalystHandoffConsumerBlocker[], stage: AnalystHandoffConsumerBlocker["stage"]) {
  return !blockers.some((item) => item.stage === stage);
}

function blocker(
  code: AnalystHandoffConsumerBlockerCode,
  stage: AnalystHandoffConsumerBlocker["stage"],
  field: string,
  detail: string,
  recoverable: boolean,
  metadata: Pick<AnalystHandoffConsumerBlocker, "action" | "route" | "evidenceSchemaVersion"> = {}
): AnalystHandoffConsumerBlocker {
  return { code, stage, field, detail, recoverable, ...metadata };
}

function isStale(value: string | undefined, staleEvidenceBefore: string | undefined) {
  if (!value || !staleEvidenceBefore) return false;
  return value < staleEvidenceBefore;
}
