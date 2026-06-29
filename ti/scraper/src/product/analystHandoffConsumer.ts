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

export const ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION = "hanasand.analyst_handoff.consumer.v1" as const;
export const ORG_ALERT_TERMS_EXPORT_SCHEMA_VERSION = "organization.watchlist_alert_terms_export.v1" as const;
export const DWM_WEBHOOK_AUDIT_EVENT_SCHEMA_VERSION = "dwm.webhook.audit_event.v1" as const;

export type AnalystHandoffConsumerBlockerCode =
  | AnalystHandoffBlockerCode
  | "missing_schema"
  | "unsupported_schema"
  | "missing_stage"
  | "missing_identity"
  | "invalid_request"
  | "entitlement_blocked"
  | "nonmember"
  | "org_terms_contract_mismatch"
  | "webhook_trigger_contract_mismatch"
  | "webhook_audit_contract_mismatch";

export type AnalystHandoffConsumerBlocker = Omit<AnalystHandoffBlocker, "code"> & {
  code: AnalystHandoffConsumerBlockerCode;
  stage: AnalystHandoffConsumerStageName | "bundle" | "membership" | "entitlement" | "org_terms_export" | "webhook_audit";
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
  allowed: boolean;
  reason?: string;
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
      schemaVersion: "organization.watchlist_alert_generation_ref.v1";
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

export type AnalystHandoffConsumerBundle = {
  schemaVersion: typeof ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION;
  generatedAt: string;
  staleEvidenceBefore?: string;
  entitlement?: AnalystHandoffConsumerEntitlement;
  membership?: AnalystHandoffConsumerMembership;
  stages: Partial<{
    publicTi: ActorWatchlistAdapterValue;
    orgWatchlist: AlertGenerationAdapterValue & {
      termsExport?: OrgWatchlistAlertTermsExportContract;
    };
    caseHandoff: AlertCaseAdapterValue;
    webhookTrigger: AlertWebhookAdapterValue & {
      auditEvents?: DwmWebhookAuditEventContract[];
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
  };
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
  blockers.push(...validateEntitlement(bundle.entitlement));

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
    }
  };
}

export function summarizeAnalystHandoffConsumerBundle(input: unknown) {
  const validation = validateAnalystHandoffConsumerBundle(input);
  const bundle = input as Partial<AnalystHandoffConsumerBundle>;
  return {
    ok: validation.ok,
    schemaVersion: validation.schemaVersion,
    blockers: validation.blockers.map(({ code, stage, field, detail, recoverable }) => ({ code, stage, field, detail, recoverable })),
    generatedAt: bundle.generatedAt,
    stageCount: validation.stageCount,
    identity: validation.identity,
    contracts: validation.contracts,
    requests: {
      publicTi: requestSummary(bundle.stages?.publicTi?.request),
      orgWatchlist: requestSummary(bundle.stages?.orgWatchlist?.request),
      caseHandoff: requestSummary(bundle.stages?.caseHandoff?.request),
      webhookTrigger: requestSummary(bundle.stages?.webhookTrigger?.request)
    }
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
    item.alertGenerationRef.organizationId !== termsExport.organizationId
    || item.alertGenerationRef.tenantId !== termsExport.tenantId
    || item.alertGenerationRef.watchlistItemId !== item.watchlistItemId
    || item.alertGenerationRef.dedupe.parts.watchlistItemId !== item.watchlistItemId
  ));
  if (refMismatches.length) {
    blockers.push(blocker("org_terms_contract_mismatch", "org_terms_export", "orgWatchlist.termsExport.activeTerms.alertGenerationRef", "Org alert generation refs must match export org, tenant, and watchlist item identity.", false));
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

function validateEntitlement(entitlement?: AnalystHandoffConsumerEntitlement): AnalystHandoffConsumerBlocker[] {
  if (!entitlement) return [];
  if (!entitlement.allowed) {
    return [blocker("entitlement_blocked", "entitlement", "entitlement.allowed", entitlement.reason || "Current plan is not entitled to generate DWM alert handoffs.", true)];
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
