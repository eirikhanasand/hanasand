import {
  ANALYST_HANDOFF_SCHEMA_VERSION,
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

export const ANALYST_HANDOFF_CONTRACT_VERSIONS = {
  consumer: ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION,
  validationReport: ANALYST_HANDOFF_VALIDATION_REPORT_SCHEMA_VERSION,
  publicTi: PUBLIC_TI_HANDOFF_SCHEMA_VERSION,
  orgAlertTermsExport: ORG_ALERT_TERMS_EXPORT_SCHEMA_VERSION,
  orgAlertGenerationRef: ORG_ALERT_GENERATION_REF_SCHEMA_VERSION,
  webhookAuditEvent: DWM_WEBHOOK_AUDIT_EVENT_SCHEMA_VERSION,
  webhookDestinationLifecycle: DWM_WEBHOOK_DESTINATION_LIFECYCLE_SCHEMA_VERSION,
  entitlementReadModel: DWM_ENTITLEMENT_READ_MODEL_SCHEMA_VERSION,
  sourceWorkerReadiness: DWM_SOURCE_WORKER_READINESS_SCHEMA_VERSION,
  caseRouteAvailability: CASE_ROUTE_AVAILABILITY_SCHEMA_VERSION,
  helpdeskActionAvailability: HELPDESK_ACTION_AVAILABILITY_SCHEMA_VERSION
} as const;

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
  checkedAt: string;
  ok: boolean;
  bundleCount: number;
  passedCount: number;
  failedCount: number;
  blockerCodes: AnalystHandoffConsumerBlockerCode[];
  productReadiness: Record<AnalystHandoffOwnerLane, AnalystHandoffLaneReadiness>;
  results: Array<{
    file?: string;
    ok: boolean;
    schemaVersion: typeof ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION;
    blockerCount: number;
    blockerCodes: AnalystHandoffConsumerBlockerCode[];
    blockers: Array<Pick<AnalystHandoffConsumerBlocker, "code" | "stage" | "field" | "detail" | "recoverable"> & { ownerLane: AnalystHandoffOwnerLane }>;
    productReadiness: Record<AnalystHandoffOwnerLane, AnalystHandoffLaneReadiness>;
    contracts: AnalystHandoffConsumerValidation["contracts"] | null;
    identity?: AnalystHandoffIdentity;
  }>;
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
  return {
    schemaVersion: ANALYST_HANDOFF_VALIDATION_REPORT_SCHEMA_VERSION,
    checkedAt: input.checkedAt || nowIso(),
    ok: results.every((item) => item.ok),
    bundleCount: results.length,
    passedCount: results.filter((item) => item.ok).length,
    failedCount: results.filter((item) => !item.ok).length,
    blockerCodes: [...new Set(results.flatMap((item) => item.blockerCodes))].sort() as AnalystHandoffConsumerBlockerCode[],
    productReadiness: productReadinessFor(allBlockers),
    results
  };
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
  recoverable: boolean
): AnalystHandoffConsumerBlocker {
  return { code, stage, field, detail, recoverable };
}

function isStale(value: string | undefined, staleEvidenceBefore: string | undefined) {
  if (!value || !staleEvidenceBefore) return false;
  return value < staleEvidenceBefore;
}
