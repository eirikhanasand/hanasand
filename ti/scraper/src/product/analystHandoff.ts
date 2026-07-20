import { nowIso, stableId, uniqueStrings } from "../utils.ts";
import type { DwmAlert, DwmRecommendedRoute, DwmWatchTerm } from "./dwmProduct.ts";

export const ANALYST_HANDOFF_SCHEMA_VERSION = "hanasand.analyst_handoff.v1" as const;
export const ORG_ALERT_WATCHLIST_READINESS_SCHEMA_VERSION = "organization.watchlist_alert_readiness.v1" as const;

export type AnalystHandoffKind =
  | "actor_watchlist_candidate"
  | "watchlist_alert_generation_request"
  | "alert_case_handoff"
  | "alert_webhook_trigger";

export type AnalystHandoffSource = "public_ti" | "dwm_watchlist" | "dwm_alert" | "case_workbench" | "webhook_delivery";

export type AnalystHandoffIdentity = {
  tenantId: string;
  organizationId?: string;
  requestedByUserId?: string;
  actorQuery?: string;
  actorName?: string;
  artifactId?: string;
  artifactKind?: string;
  watchlistId?: string;
  watchlistItemIds?: string[];
  normalizedWatchTerm?: string;
  watchTermKind?: DwmWatchTerm["kind"];
  alertId?: string;
  alertDedupeKey?: string;
  sourceFamily?: DwmAlert["sourceFamily"];
  captureIds?: string[];
  caseIdCandidate?: string;
  casePath?: string;
  webhookDestinationIds?: string[];
};

export type AnalystHandoffEnvelope<TKind extends AnalystHandoffKind, TPayload> = {
  schemaVersion: typeof ANALYST_HANDOFF_SCHEMA_VERSION;
  handoffId: string;
  kind: TKind;
  createdAt: string;
  source: AnalystHandoffSource;
  parentHandoffId?: string;
  identity: AnalystHandoffIdentity;
  payload: TPayload;
};

export type ActorWatchlistCandidatePayload = {
  query: string;
  artifact: {
    id: string;
    kind: string;
    label: string;
    confidence?: number;
    freshness?: string;
    provenance?: string[];
  };
  terms: Array<DwmWatchTerm & { notes?: string }>;
  missing: string[];
};

export type AlertGenerationRequestPayload = {
  method: "POST";
  path: "/v1/dwm/alerts/rebuild";
  body: {
    tenantId: string;
    organizationId?: string;
    watchlistId: string;
    watchlistItemIds: string[];
    publicTiHandoffId?: string;
  };
};

export type AlertCaseHandoffPayload = {
  method: "POST";
  path: "/v1/cases";
  body: {
    tenantId: string;
    organizationId?: string;
    alertId: string;
    dedupeKey: string;
    caseIdCandidate: string;
    casePath: string;
    title: string;
    priority: DwmAlert["severity"];
    recommendedRoute: DwmRecommendedRoute;
    captureIds: string[];
    watchlistItemIds: string[];
  };
};

export type AlertWebhookTriggerPayload = {
  method: "POST";
  path: "/v1/dwm/webhooks/deliver";
  body: {
    tenantId: string;
    organizationId?: string;
    alertId: string;
    dedupeKey: string;
    recommendedRoute: DwmRecommendedRoute;
    webhookDestinationIds: string[];
    captureIds: string[];
    evidenceCount: number;
    idempotencyKey: string;
    dryRun?: boolean;
  };
};

export type AnalystHandoffBlockerCode =
  | "missing_org"
  | "missing_provenance"
  | "stale_evidence"
  | "absent_alert_id"
  | "missing_case_route"
  | "missing_webhook_destination"
  | "unsupported_actor_artifact"
  | "missing_watchlist_term"
  | "missing_watchlist_id"
  | "missing_watchlist_item"
  | "identity_mismatch";

export type AnalystHandoffBlocker = {
  code: AnalystHandoffBlockerCode;
  field: string;
  detail: string;
  recoverable: boolean;
};

export type AnalystHandoffAdapterResult<T> =
  | { ok: true; value: T; blockers: [] }
  | { ok: false; blockers: AnalystHandoffBlocker[]; partial?: Partial<T> };

export type OrgWatchlistCreateRequest = {
  method: "POST";
  path: "/v1/dwm/watchlists";
  body: {
    tenantId: string;
    organizationId: string;
    name: string;
    terms: Array<DwmWatchTerm & { notes?: string }>;
    status: "active";
    source: "public_ti";
    actorQuery: string;
    artifactId: string;
    requestedByUserId?: string;
  };
};

export type ActorArtifactAdapterInput = {
  tenantId: string;
  organizationId?: string;
  requestedByUserId?: string;
  query: string;
  artifact: ActorWatchlistCandidatePayload["artifact"] & {
    watchlistTerms?: Array<DwmWatchTerm & { notes?: string }>;
    readiness?: { state?: string; blockers?: string[] };
  };
  terms?: Array<DwmWatchTerm & { notes?: string }>;
  staleEvidenceBefore?: string;
  generatedAt?: string;
};

export type ActorWatchlistAdapterValue = {
  handoff: AnalystHandoffEnvelope<"actor_watchlist_candidate", ActorWatchlistCandidatePayload>;
  request: OrgWatchlistCreateRequest;
};

export type AlertGenerationAdapterValue = {
  handoff: AnalystHandoffEnvelope<"watchlist_alert_generation_request", AlertGenerationRequestPayload>;
  request: AlertGenerationRequestPayload;
};

export type OrgScopedAlertWatchlistReadiness = {
  schemaVersion: typeof ORG_ALERT_WATCHLIST_READINESS_SCHEMA_VERSION;
  ok: boolean;
  ownerLane: "alert";
  capability: "org_scoped_watchlist_alert_generation";
  checkedAt: string;
  route: "POST /v1/dwm/alerts/rebuild";
  routeHandler: "ti/scraper/src/api/dwmWorkflowRoutes.ts";
  storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts";
  proofRowId: "org_scoped_alert_case_workflow";
  expectedAdapter: "orgWatchlistTermsToAlertGenerationRequest";
  proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/analystHandoff.test.ts";
  payloadShape: Array<"tenantId" | "organizationId" | "watchlistId" | "watchlistItemIds" | "publicTiHandoffId">;
  blockers: Array<AnalystHandoffBlocker & { ownerLane: "org" | "alert"; route: string; action: string }>;
  request?: AlertGenerationRequestPayload;
  handoff?: {
    handoffId: string;
    parentHandoffId?: string;
    tenantId: string;
    organizationId?: string;
    watchlistId?: string;
    watchlistItemIds: string[];
    webhookDestinationIds: string[];
  };
  downstream: {
    caseRoute: "/v1/cases";
    webhookRoute: "/v1/dwm/webhooks/deliver";
    requiresOrgScopedWatchlist: true;
    requiresActiveWatchlistItems: true;
  };
};

export type AlertCaseAdapterValue = {
  handoff: AnalystHandoffEnvelope<"alert_case_handoff", AlertCaseHandoffPayload>;
  request: AlertCaseHandoffPayload;
};

export type AlertWebhookAdapterValue = {
  handoff: AnalystHandoffEnvelope<"alert_webhook_trigger", AlertWebhookTriggerPayload>;
  request: AlertWebhookTriggerPayload;
  idempotencyKey: string;
};

export type PublicTiOrgRelevanceProofLike = {
  schemaVersion?: string;
  state?: string;
  actorId: string;
  query: string;
  generatedAt: string;
  freshness?: {
    generatedAt: string;
    lastSeen: string;
    stale: boolean;
    reason: string;
  };
  actorIdentity?: {
    canonicalName?: string;
    aliases?: string[];
    actorClass?: string;
    sectors?: string[];
    regions?: string[];
    motivations?: string[];
  };
  sourceCoverage?: Array<{
    sourceId?: string;
    sourceName: string;
    sourceFamily?: string;
    status?: "active" | "partial" | "missing" | "stale" | string;
    lastCollectedAt?: string;
    coverage?: "primary" | "corroborating" | "gap" | string;
    captureIds?: string[];
  }>;
  organizationRefs?: Array<{
    tenantId?: string;
    organizationId?: string;
    watchlistId?: string;
    watchlistItemId?: string;
    kind: DwmWatchTerm["kind"];
    value: string;
    route?: string;
    casePath?: string;
  }>;
  candidateTerms?: Array<{
    kind: DwmWatchTerm["kind"];
    value: string;
    notes?: string;
    matched?: boolean;
    sourceEvidenceRefs?: string[];
  }>;
  sourceEvidence?: Array<{
    sourceId?: string;
    sourceName: string;
    provenance: string;
    captureId?: string;
    confidence?: number;
    supportsTerms?: string[];
  }>;
  alertCaseRefs?: Array<{
    alertId: string;
    casePath?: string;
    caseIdCandidate?: string;
    organizationId?: string;
    tenantId?: string;
    captureIds: string[];
    webhookDestinationIds: string[];
  }>;
  affectedEntities?: {
    vendors?: Array<{ value: string; matched?: boolean; provenanceRefs?: string[]; watchlistItemIds?: string[]; alertIds?: string[] }>;
    domains?: Array<{ value: string; matched?: boolean; provenanceRefs?: string[]; watchlistItemIds?: string[]; alertIds?: string[] }>;
    regions?: Array<{ value: string; matched?: boolean; provenanceRefs?: string[]; watchlistItemIds?: string[]; alertIds?: string[] }>;
  };
  handoffRows?: Array<{
    rowId: string;
    kind: "watchlist_match" | "candidate_term" | "source_evidence" | "alert_case" | "webhook_delivery" | "enrichment_gap" | string;
    state: "ready" | "review" | "blocked" | string;
    ownerLane: string;
    label: string;
    action?: string;
    route?: string;
    sourceFamily?: string;
    provenanceRefs?: string[];
    tenantId?: string;
    organizationId?: string;
    watchlistId?: string;
    watchlistItemId?: string;
    alertId?: string;
    casePath?: string;
    captureIds?: string[];
    webhookDestinationIds?: string[];
    evidence?: {
      sourceId?: string;
      sourceName?: string;
      provenance?: string;
      captureId?: string;
      reportDate?: string;
      confidence?: number;
      summary?: string;
    };
    blockers?: Array<{ code?: string; field?: string; detail?: string; recoverable?: boolean }>;
  }>;
  blockers?: Array<{ code?: string; field?: string; detail?: string; recoverable?: boolean }>;
};

export type ActorOrgRelevanceHandoffValue = {
  schemaVersion: "hanasand.actor_org_relevance_handoff.v1";
  generatedAt: string;
  actorId: string;
  query: string;
  state: "ready" | "blocked";
  watchlist: ActorWatchlistAdapterValue;
  alertGeneration: AlertGenerationAdapterValue;
  caseHandoff: AlertCaseAdapterValue;
  webhookTrigger: AlertWebhookAdapterValue;
  affectedEntities: NonNullable<PublicTiOrgRelevanceProofLike["affectedEntities"]>;
  sourceEvidence: NonNullable<PublicTiOrgRelevanceProofLike["sourceEvidence"]>;
  handoffRows: NonNullable<PublicTiOrgRelevanceProofLike["handoffRows"]>;
  enrichmentGaps: NonNullable<PublicTiOrgRelevanceProofLike["handoffRows"]>;
};

export type ActorOrgRelevanceReadinessOwner = "org" | "alert" | "case" | "webhook" | "source" | "publicTI";

export type ActorOrgRelevanceReadinessReport = {
  schemaVersion: "hanasand.actor_org_relevance.readiness_report.v1";
  checkedAt: string;
  ok: boolean;
  proofCount: number;
  readyCount: number;
  blockedCount: number;
  rows: ActorOrgRelevanceReadinessRow[];
  productReadiness: Record<ActorOrgRelevanceReadinessOwner, {
    ready: boolean;
    blockerCodes: AnalystHandoffBlockerCode[];
    recommendedOwnerLane: ActorOrgRelevanceReadinessOwner;
  }>;
};

export type ActorOrgRelevanceReadinessRow = {
  file?: string;
  ok: boolean;
  actorId?: string;
  query?: string;
  state: "ready" | "blocked";
  freshness: {
    stale: boolean;
    lastSeen?: string;
    reason?: string;
  };
  actor: {
    canonicalName?: string;
    aliasCount: number;
    sectorCount: number;
    regionCount: number;
    sourceCoverageCount: number;
  };
  coverage: {
    organizationRefs: number;
    watchlistTerms: number;
    sourceEvidence: number;
    affectedVendors: number;
    affectedDomains: number;
    affectedRegions: number;
    relatedAlerts: number;
    relatedCases: number;
    webhookDestinations: number;
    enrichmentGaps: number;
  };
  handoffs: {
    watchlist: boolean;
    alertGeneration: boolean;
    caseHandoff: boolean;
    webhookTrigger: boolean;
  };
  provenance: Array<{
    sourceId?: string;
    sourceName: string;
    captureId?: string;
    provenance: string;
    reportDate?: string;
    confidence?: number;
    shownBecause?: string;
  }>;
  enrichmentGaps: ActorOrgRelevanceEnrichmentGap[];
  blockers: Array<AnalystHandoffBlocker & { ownerLane: ActorOrgRelevanceReadinessOwner; route?: string; action?: string }>;
};

export type ActorOrgRelevanceEnrichmentGap = {
  code: "missing_actor_aliases" | "missing_target_sectors" | "missing_target_regions" | "missing_source_coverage" | "missing_provenance" | "stale_evidence";
  ownerLane: ActorOrgRelevanceReadinessOwner;
  field: string;
  detail: string;
  route: string;
  recoverable: boolean;
};

export type AnalystAlertLike = DwmAlert & {
  tenantId?: string;
  organizationId?: string;
  watchlistIds?: string[];
  watchlistItemIds?: string[];
  caseIdCandidate?: string;
  casePath?: string;
  workflowContext?: Partial<{
    tenantId: string;
    organizationId: string;
    watchlistIds: string[];
    watchlistItemIds: string[];
    captureIds: string[];
    caseIdCandidate: string;
    casePath: string;
    dedupeKey: string;
    recommendedRoute: DwmRecommendedRoute;
    webhookDestinationIds: string[];
  }>;
  webhookContext?: Partial<{
    tenantId: string;
    organizationId: string;
    watchlistIds: string[];
    watchlistItemIds: string[];
    captureIds: string[];
    evidenceCount: number;
    dedupeKey: string;
    recommendedRoute: DwmRecommendedRoute;
    caseIdCandidate: string;
    casePath: string;
    webhookDestinationIds: string[];
  }>;
};

export class AnalystHandoffIdentityMismatchError extends Error {
  constructor(readonly field: keyof AnalystHandoffIdentity, readonly current: unknown, readonly next: unknown) {
    super(`Analyst handoff identity mismatch for ${field}: ${String(current)} !== ${String(next)}`);
    this.name = "AnalystHandoffIdentityMismatchError";
  }
}

export function buildActorWatchlistCandidateHandoff(input: {
  tenantId: string;
  organizationId?: string;
  requestedByUserId?: string;
  query: string;
  artifact: ActorWatchlistCandidatePayload["artifact"];
  terms: ActorWatchlistCandidatePayload["terms"];
  generatedAt?: string;
}): AnalystHandoffEnvelope<"actor_watchlist_candidate", ActorWatchlistCandidatePayload> {
  const primaryTerm = input.terms[0];
  const identity: AnalystHandoffIdentity = compactIdentity({
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    requestedByUserId: input.requestedByUserId,
    actorQuery: normalizeValue(input.query),
    actorName: input.query,
    artifactId: input.artifact.id,
    artifactKind: input.artifact.kind,
    normalizedWatchTerm: primaryTerm ? normalizeValue(primaryTerm.value) : undefined,
    watchTermKind: primaryTerm?.kind
  });
  return envelope({
    kind: "actor_watchlist_candidate",
    source: "public_ti",
    createdAt: input.generatedAt,
    identity,
    payload: {
      query: input.query,
      artifact: input.artifact,
      terms: input.terms.map((term) => ({ ...term, value: term.value.trim() })),
      missing: input.terms.length ? [] : ["watchlist_term"]
    }
  });
}

export function buildWatchlistAlertGenerationHandoff(input: {
  parent: AnalystHandoffEnvelope<"actor_watchlist_candidate", ActorWatchlistCandidatePayload>;
  watchlistId: string;
  watchlistItemIds: string[];
  webhookDestinationIds?: string[];
  createdAt?: string;
}): AnalystHandoffEnvelope<"watchlist_alert_generation_request", AlertGenerationRequestPayload> {
  const identity = mergeAnalystHandoffIdentity(input.parent.identity, {
    watchlistId: input.watchlistId,
    watchlistItemIds: input.watchlistItemIds,
    webhookDestinationIds: input.webhookDestinationIds
  });
  return envelope({
    kind: "watchlist_alert_generation_request",
    source: "dwm_watchlist",
    createdAt: input.createdAt,
    parentHandoffId: input.parent.handoffId,
    identity,
    payload: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        tenantId: identity.tenantId,
        organizationId: identity.organizationId,
        watchlistId: input.watchlistId,
        watchlistItemIds: input.watchlistItemIds,
        publicTiHandoffId: input.parent.handoffId
      }
    }
  });
}

export function buildAlertCaseHandoff(input: {
  parent?: AnalystHandoffEnvelope<AnalystHandoffKind, unknown>;
  alert: AnalystAlertLike;
  tenantId?: string;
  organizationId?: string;
  requestedByUserId?: string;
  createdAt?: string;
}): AnalystHandoffEnvelope<"alert_case_handoff", AlertCaseHandoffPayload> {
  const alertIdentity = identityFromAlert(input.alert, input);
  const identity = input.parent ? mergeAnalystHandoffIdentity(input.parent.identity, alertIdentity) : alertIdentity;
  const caseIdCandidate = identity.caseIdCandidate || stableId("case", `${identity.tenantId}:${input.alert.id}`);
  const casePath = identity.casePath || casePathFor(caseIdCandidate, input.alert.id, identity.alertDedupeKey || input.alert.dedupeKey);
  const finalIdentity = mergeAnalystHandoffIdentity(identity, { caseIdCandidate, casePath });
  return envelope({
    kind: "alert_case_handoff",
    source: "dwm_alert",
    createdAt: input.createdAt,
    parentHandoffId: input.parent?.handoffId,
    identity: finalIdentity,
    payload: {
      method: "POST",
      path: "/v1/cases",
      body: {
        tenantId: finalIdentity.tenantId,
        organizationId: finalIdentity.organizationId,
        alertId: input.alert.id,
        dedupeKey: finalIdentity.alertDedupeKey || input.alert.dedupeKey,
        caseIdCandidate,
        casePath,
        title: `${input.alert.severity.toUpperCase()} ${input.alert.company}`,
        priority: input.alert.severity,
        recommendedRoute: input.alert.recommendedRoute,
        captureIds: finalIdentity.captureIds || [],
        watchlistItemIds: finalIdentity.watchlistItemIds || []
      }
    }
  });
}

export function buildAlertWebhookTriggerHandoff(input: {
  parent?: AnalystHandoffEnvelope<AnalystHandoffKind, unknown>;
  alert: AnalystAlertLike;
  tenantId?: string;
  organizationId?: string;
  requestedByUserId?: string;
  dryRun?: boolean;
  createdAt?: string;
}): AnalystHandoffEnvelope<"alert_webhook_trigger", AlertWebhookTriggerPayload> {
  const alertIdentity = identityFromAlert(input.alert, input);
  const identity = input.parent ? mergeAnalystHandoffIdentity(input.parent.identity, alertIdentity) : alertIdentity;
  return envelope({
    kind: "alert_webhook_trigger",
    source: "webhook_delivery",
    createdAt: input.createdAt,
    parentHandoffId: input.parent?.handoffId,
    identity,
    payload: {
      method: "POST",
      path: "/v1/dwm/webhooks/deliver",
      body: {
        tenantId: identity.tenantId,
        organizationId: identity.organizationId,
        alertId: input.alert.id,
        dedupeKey: identity.alertDedupeKey || input.alert.dedupeKey,
        recommendedRoute: input.alert.recommendedRoute,
        webhookDestinationIds: identity.webhookDestinationIds || [],
        captureIds: identity.captureIds || [],
        evidenceCount: input.alert.evidenceSummary?.evidenceCount ?? input.alert.evidence.length,
        idempotencyKey: webhookTriggerIdempotencyKey(input.alert, identity, input.dryRun),
        dryRun: input.dryRun || undefined
      }
    }
  });
}

export function publicTiArtifactToOrgWatchlistCreate(input: ActorArtifactAdapterInput): AnalystHandoffAdapterResult<ActorWatchlistAdapterValue> {
  const terms = normalizeAdapterTerms(input.terms || input.artifact.watchlistTerms || []);
  const blockers = actorArtifactBlockers(input, terms);
  if (blockers.length) return { ok: false, blockers };
  const handoff = buildActorWatchlistCandidateHandoff({
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    requestedByUserId: input.requestedByUserId,
    query: input.query,
    artifact: input.artifact,
    terms,
    generatedAt: input.generatedAt
  });
  return {
    ok: true,
    blockers: [],
    value: {
      handoff,
      request: {
        method: "POST",
        path: "/v1/dwm/watchlists",
        body: {
          tenantId: input.tenantId,
          organizationId: input.organizationId!,
          name: `${input.query} exposure watchlist`,
          terms,
          status: "active",
          source: "public_ti",
          actorQuery: input.query,
          artifactId: input.artifact.id,
          requestedByUserId: input.requestedByUserId
        }
      }
    }
  };
}

export function orgWatchlistTermsToAlertGenerationRequest(input: {
  parent: AnalystHandoffEnvelope<"actor_watchlist_candidate", ActorWatchlistCandidatePayload>;
  watchlistId?: string;
  watchlistItemIds?: string[];
  webhookDestinationIds?: string[];
  createdAt?: string;
}): AnalystHandoffAdapterResult<AlertGenerationAdapterValue> {
  const blockers: AnalystHandoffBlocker[] = [];
  if (!input.parent.identity.organizationId) blockers.push(blocker("missing_org", "organizationId", "Alert generation requires an organization-scoped watchlist.", true));
  if (!input.watchlistId) blockers.push(blocker("missing_watchlist_id", "watchlistId", "Alert generation requires the persisted watchlist id.", true));
  if (!input.watchlistItemIds?.length) blockers.push(blocker("missing_watchlist_item", "watchlistItemIds", "Alert generation requires persisted watchlist item ids.", true));
  if (blockers.length) return { ok: false, blockers };
  const handoff = buildWatchlistAlertGenerationHandoff({
    parent: input.parent,
    watchlistId: input.watchlistId!,
    watchlistItemIds: input.watchlistItemIds!,
    webhookDestinationIds: input.webhookDestinationIds,
    createdAt: input.createdAt
  });
  return { ok: true, blockers: [], value: { handoff, request: handoff.payload } };
}

export function buildOrgScopedAlertWatchlistReadiness(input: {
  adapter: AnalystHandoffAdapterResult<AlertGenerationAdapterValue> | AlertGenerationAdapterValue;
  checkedAt?: string;
}): OrgScopedAlertWatchlistReadiness {
  const checkedAt = input.checkedAt || nowIso();
  const adapter = input.adapter;
  const value = "request" in adapter && "handoff" in adapter
    ? adapter
    : adapter.ok
      ? adapter.value
      : undefined;
  const adapterBlockers = "ok" in adapter && !adapter.ok ? adapter.blockers : [];
  const request = value?.request;
  const identity = value?.handoff.identity;
  const shapeBlockers: AnalystHandoffBlocker[] = value
    ? [
        value.request.method !== "POST" || value.request.path !== "/v1/dwm/alerts/rebuild"
          ? blocker("identity_mismatch", "request.path", "Alert generation readiness must point to POST /v1/dwm/alerts/rebuild.", false)
          : undefined,
        !value.request.body.organizationId || !identity?.organizationId
          ? blocker("missing_org", "organizationId", "Alert generation readiness requires organization identity in the handoff and request body.", true)
          : undefined,
        !value.request.body.watchlistId || !identity?.watchlistId
          ? blocker("missing_watchlist_id", "watchlistId", "Alert generation readiness requires the persisted org watchlist id.", true)
          : undefined,
        !value.request.body.watchlistItemIds.length || !identity?.watchlistItemIds?.length
          ? blocker("missing_watchlist_item", "watchlistItemIds", "Alert generation readiness requires persisted org watchlist item ids.", true)
          : undefined,
        !value.request.body.publicTiHandoffId || value.request.body.publicTiHandoffId !== value.handoff.parentHandoffId
          ? blocker("identity_mismatch", "publicTiHandoffId", "Alert generation readiness must preserve the parent public-TI handoff id.", false)
          : undefined
      ].filter((item): item is AnalystHandoffBlocker => Boolean(item))
    : [];
  const blockers = [...adapterBlockers, ...shapeBlockers].map(alertWatchlistReadinessBlocker);
  return {
    schemaVersion: ORG_ALERT_WATCHLIST_READINESS_SCHEMA_VERSION,
    ok: blockers.length === 0,
    ownerLane: "alert",
    capability: "org_scoped_watchlist_alert_generation",
    checkedAt,
    route: "POST /v1/dwm/alerts/rebuild",
    routeHandler: "ti/scraper/src/api/dwmWorkflowRoutes.ts",
    storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts",
    proofRowId: "org_scoped_alert_case_workflow",
    expectedAdapter: "orgWatchlistTermsToAlertGenerationRequest",
    proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/analystHandoff.test.ts",
    payloadShape: ["tenantId", "organizationId", "watchlistId", "watchlistItemIds", "publicTiHandoffId"],
    blockers,
    request,
    handoff: value
      ? {
          handoffId: value.handoff.handoffId,
          parentHandoffId: value.handoff.parentHandoffId,
          tenantId: value.handoff.identity.tenantId,
          organizationId: value.handoff.identity.organizationId,
          watchlistId: value.handoff.identity.watchlistId,
          watchlistItemIds: value.handoff.identity.watchlistItemIds || [],
          webhookDestinationIds: value.handoff.identity.webhookDestinationIds || []
        }
      : undefined,
    downstream: {
      caseRoute: "/v1/cases",
      webhookRoute: "/v1/dwm/webhooks/deliver",
      requiresOrgScopedWatchlist: true,
      requiresActiveWatchlistItems: true
    }
  };
}

export function persistedAlertToCaseHandoffPayload(input: {
  parent?: AnalystHandoffEnvelope<AnalystHandoffKind, unknown>;
  alert: AnalystAlertLike;
  tenantId?: string;
  organizationId?: string;
  requestedByUserId?: string;
  staleEvidenceBefore?: string;
  createdAt?: string;
}): AnalystHandoffAdapterResult<AlertCaseAdapterValue> {
  const blockers = alertAdapterBlockers(input.alert, input);
  if (blockers.length) return { ok: false, blockers };
  try {
    const handoff = buildAlertCaseHandoff(input);
    return { ok: true, blockers: [], value: { handoff, request: handoff.payload } };
  } catch (error) {
    if (error instanceof AnalystHandoffIdentityMismatchError) return { ok: false, blockers: [blocker("identity_mismatch", error.field, error.message, false)] };
    throw error;
  }
}

export function persistedAlertToWebhookTriggerContext(input: {
  parent?: AnalystHandoffEnvelope<AnalystHandoffKind, unknown>;
  alert: AnalystAlertLike;
  tenantId?: string;
  organizationId?: string;
  requestedByUserId?: string;
  staleEvidenceBefore?: string;
  dryRun?: boolean;
  createdAt?: string;
}): AnalystHandoffAdapterResult<AlertWebhookAdapterValue> {
  const blockers = alertAdapterBlockers(input.alert, input);
  if (blockers.length) return { ok: false, blockers };
  try {
    const handoff = buildAlertWebhookTriggerHandoff(input);
    return {
      ok: true,
      blockers: [],
      value: {
        handoff,
        request: handoff.payload,
        idempotencyKey: handoff.payload.body.idempotencyKey
      }
    };
  } catch (error) {
    if (error instanceof AnalystHandoffIdentityMismatchError) return { ok: false, blockers: [blocker("identity_mismatch", error.field, error.message, false)] };
    throw error;
  }
}

export function publicTiOrgRelevanceToAnalystHandoff(input: {
  tenantId?: string;
  organizationId?: string;
  requestedByUserId?: string;
  orgRelevance: PublicTiOrgRelevanceProofLike;
  staleEvidenceBefore?: string;
}): AnalystHandoffAdapterResult<ActorOrgRelevanceHandoffValue> {
  const org = selectOrgRef(input.orgRelevance, input);
  const term = selectWatchTerm(input.orgRelevance);
  const source = selectSourceEvidence(input.orgRelevance, term?.value);
  const alertRef = selectAlertRef(input.orgRelevance);
  const rows = input.orgRelevance.handoffRows ?? [];
  const blockers = uniqueBlockers([
    ...orgRelevanceBlockers(input.orgRelevance, input, org, term, source, alertRef),
    ...rows.flatMap(row => (row.blockers ?? []).map(rowBlocker => blockerFromPublicRow(row, rowBlocker)))
  ]);
  const artifact = {
    id: input.orgRelevance.actorId,
    kind: "actor",
    label: input.orgRelevance.query,
    confidence: source?.confidence,
    freshness: input.orgRelevance.freshness?.lastSeen ?? input.orgRelevance.generatedAt,
    provenance: uniqueOptionalStrings([
      ...(source ? [source.sourceId, source.captureId, source.provenance] : []),
      ...(term?.sourceEvidenceRefs ?? []),
      ...(rows.flatMap(row => row.provenanceRefs ?? []))
    ])
  };
  const watchlist = publicTiArtifactToOrgWatchlistCreate({
    tenantId: org.tenantId,
    organizationId: org.organizationId,
    requestedByUserId: input.requestedByUserId,
    query: input.orgRelevance.query,
    artifact: {
      ...artifact,
      watchlistTerms: term ? [{ kind: term.kind, value: term.value, notes: term.notes }] : []
    },
    staleEvidenceBefore: input.staleEvidenceBefore,
    generatedAt: input.orgRelevance.generatedAt
  });
  if (!watchlist.ok) blockers.push(...watchlist.blockers);

  const alertGeneration = watchlist.ok ? orgWatchlistTermsToAlertGenerationRequest({
    parent: watchlist.value.handoff,
    watchlistId: org.watchlistId,
    watchlistItemIds: org.watchlistItemId ? [org.watchlistItemId] : [],
    webhookDestinationIds: alertRef?.webhookDestinationIds,
    createdAt: input.orgRelevance.generatedAt
  }) : undefined;
  if (alertGeneration && !alertGeneration.ok) blockers.push(...alertGeneration.blockers);

  const alert = alertRef && term && source ? alertFromOrgRelevance(input.orgRelevance, org, term, source, alertRef) : undefined;
  const caseHandoff = alert && alertGeneration?.ok && alertRef?.casePath ? persistedAlertToCaseHandoffPayload({
    parent: alertGeneration.value.handoff,
    alert,
    requestedByUserId: input.requestedByUserId,
    staleEvidenceBefore: input.staleEvidenceBefore,
    createdAt: input.orgRelevance.generatedAt
  }) : undefined;
  if (caseHandoff && !caseHandoff.ok) blockers.push(...caseHandoff.blockers);

  const webhookTrigger = alert && caseHandoff?.ok && alertRef?.webhookDestinationIds.length ? persistedAlertToWebhookTriggerContext({
    parent: caseHandoff.value.handoff,
    alert,
    requestedByUserId: input.requestedByUserId,
    staleEvidenceBefore: input.staleEvidenceBefore,
    dryRun: true,
    createdAt: input.orgRelevance.generatedAt
  }) : undefined;
  if (webhookTrigger && !webhookTrigger.ok) blockers.push(...webhookTrigger.blockers);

  const finalBlockers = uniqueBlockers(blockers);
  if (finalBlockers.length || !watchlist.ok || !alertGeneration?.ok || !caseHandoff?.ok || !webhookTrigger?.ok) {
    return {
      ok: false,
      blockers: finalBlockers,
      partial: {
        schemaVersion: "hanasand.actor_org_relevance_handoff.v1",
        generatedAt: input.orgRelevance.generatedAt,
        actorId: input.orgRelevance.actorId,
        query: input.orgRelevance.query,
        state: "blocked",
        affectedEntities: input.orgRelevance.affectedEntities ?? {},
        sourceEvidence: input.orgRelevance.sourceEvidence ?? [],
        handoffRows: rows,
        enrichmentGaps: rows.filter(row => row.kind === "enrichment_gap")
      }
    };
  }

  return {
    ok: true,
    blockers: [],
    value: {
      schemaVersion: "hanasand.actor_org_relevance_handoff.v1",
      generatedAt: input.orgRelevance.generatedAt,
      actorId: input.orgRelevance.actorId,
      query: input.orgRelevance.query,
      state: "ready",
      watchlist: watchlist.value,
      alertGeneration: alertGeneration.value,
      caseHandoff: caseHandoff.value,
      webhookTrigger: webhookTrigger.value,
      affectedEntities: input.orgRelevance.affectedEntities ?? {},
      sourceEvidence: input.orgRelevance.sourceEvidence ?? [],
      handoffRows: rows,
      enrichmentGaps: rows.filter(row => row.kind === "enrichment_gap")
    }
  };
}

export function buildActorOrgRelevanceReadinessReport(input: {
  checkedAt?: string;
  staleEvidenceBefore?: string;
  results: Array<{
    file?: string;
    orgRelevance?: PublicTiOrgRelevanceProofLike;
    tenantId?: string;
    organizationId?: string;
    requestedByUserId?: string;
    error?: unknown;
  }>;
}): ActorOrgRelevanceReadinessReport {
  const rows = input.results.map((result) => {
    if (!result.orgRelevance) {
      return actorOrgReadinessErrorRow(result.file, result.error);
    }
    const handoff = publicTiOrgRelevanceToAnalystHandoff({
      tenantId: result.tenantId,
      organizationId: result.organizationId,
      requestedByUserId: result.requestedByUserId,
      orgRelevance: result.orgRelevance,
      staleEvidenceBefore: input.staleEvidenceBefore
    });
    return actorOrgReadinessRow(result.file, result.orgRelevance, handoff);
  });
  const owners: ActorOrgRelevanceReadinessOwner[] = ["org", "alert", "case", "webhook", "source", "publicTI"];
  const productReadiness = Object.fromEntries(owners.map((owner) => {
    const blockerCodes = uniqueBlockerCodes(rows.flatMap(row => row.blockers.filter(blocker => blocker.ownerLane === owner).map(blocker => blocker.code)));
    return [owner, {
      ready: blockerCodes.length === 0,
      blockerCodes,
      recommendedOwnerLane: owner
    }];
  })) as ActorOrgRelevanceReadinessReport["productReadiness"];

  return {
    schemaVersion: "hanasand.actor_org_relevance.readiness_report.v1",
    checkedAt: input.checkedAt || nowIso(),
    ok: rows.every(row => row.ok),
    proofCount: rows.length,
    readyCount: rows.filter(row => row.ok).length,
    blockedCount: rows.filter(row => !row.ok).length,
    rows,
    productReadiness
  };
}

function selectOrgRef(orgRelevance: PublicTiOrgRelevanceProofLike, input: { tenantId?: string; organizationId?: string }) {
  const match = orgRelevance.organizationRefs?.find(ref => ref.organizationId || ref.watchlistId || ref.watchlistItemId);
  const row = orgRelevance.handoffRows?.find(row => row.kind === "watchlist_match" && (row.organizationId || row.watchlistId || row.watchlistItemId));
  return {
    tenantId: input.tenantId || match?.tenantId || row?.tenantId || orgRelevance.alertCaseRefs?.[0]?.tenantId || "default",
    organizationId: input.organizationId || match?.organizationId || row?.organizationId || orgRelevance.alertCaseRefs?.[0]?.organizationId,
    watchlistId: match?.watchlistId || row?.watchlistId,
    watchlistItemId: match?.watchlistItemId || row?.watchlistItemId,
    kind: match?.kind,
    value: match?.value
  };
}

function actorOrgReadinessRow(
  file: string | undefined,
  orgRelevance: PublicTiOrgRelevanceProofLike,
  handoff: AnalystHandoffAdapterResult<ActorOrgRelevanceHandoffValue>
): ActorOrgRelevanceReadinessRow {
  const blockers = handoff.ok ? [] : handoff.blockers.map((item) => ({
    ...item,
    ownerLane: ownerLaneForBlocker(item),
    route: routeForBlocker(item),
    action: actionForBlocker(item)
  }));
  const handoffRows = orgRelevance.handoffRows ?? [];
  const alertRefs = orgRelevance.alertCaseRefs ?? [];
  return {
    file,
    ok: handoff.ok,
    actorId: orgRelevance.actorId,
    query: orgRelevance.query,
    state: handoff.ok ? "ready" : "blocked",
    freshness: {
      stale: orgRelevance.freshness?.stale ?? false,
      lastSeen: orgRelevance.freshness?.lastSeen,
      reason: orgRelevance.freshness?.reason
    },
    actor: actorCoverageForOrgRelevance(orgRelevance),
    coverage: {
      organizationRefs: orgRelevance.organizationRefs?.length ?? 0,
      watchlistTerms: orgRelevance.candidateTerms?.length ?? 0,
      sourceEvidence: orgRelevance.sourceEvidence?.length ?? 0,
      affectedVendors: orgRelevance.affectedEntities?.vendors?.length ?? 0,
      affectedDomains: orgRelevance.affectedEntities?.domains?.length ?? 0,
      affectedRegions: orgRelevance.affectedEntities?.regions?.length ?? 0,
      relatedAlerts: alertRefs.length,
      relatedCases: alertRefs.filter(ref => ref.casePath || ref.caseIdCandidate).length,
      webhookDestinations: uniqueOptionalStrings(alertRefs.flatMap(ref => ref.webhookDestinationIds)).length,
      enrichmentGaps: handoffRows.filter(row => row.kind === "enrichment_gap").length
    },
    handoffs: {
      watchlist: handoff.ok || !blockers.some(blocker => ["missing_org", "missing_watchlist_term"].includes(blocker.code)),
      alertGeneration: handoff.ok || !blockers.some(blocker => ["missing_watchlist_id", "missing_watchlist_item"].includes(blocker.code)),
      caseHandoff: handoff.ok || !blockers.some(blocker => ["absent_alert_id", "missing_case_route", "missing_provenance"].includes(blocker.code)),
      webhookTrigger: handoff.ok || !blockers.some(blocker => ["missing_webhook_destination", "absent_alert_id", "missing_provenance"].includes(blocker.code))
    },
    provenance: provenanceRowsForOrgRelevance(orgRelevance),
    enrichmentGaps: actorEnrichmentGapsForOrgRelevance(orgRelevance),
    blockers
  };
}

function actorOrgReadinessErrorRow(file: string | undefined, error: unknown): ActorOrgRelevanceReadinessRow {
  const detail = error instanceof Error ? error.message : error ? String(error) : "Actor org relevance proof is missing.";
  return {
    file,
    ok: false,
    state: "blocked",
    freshness: { stale: false },
    actor: {
      aliasCount: 0,
      sectorCount: 0,
      regionCount: 0,
      sourceCoverageCount: 0
    },
    coverage: {
      organizationRefs: 0,
      watchlistTerms: 0,
      sourceEvidence: 0,
      affectedVendors: 0,
      affectedDomains: 0,
      affectedRegions: 0,
      relatedAlerts: 0,
      relatedCases: 0,
      webhookDestinations: 0,
      enrichmentGaps: 0
    },
    handoffs: {
      watchlist: false,
      alertGeneration: false,
      caseHandoff: false,
      webhookTrigger: false
    },
    provenance: [],
    enrichmentGaps: [{
      code: "missing_provenance",
      ownerLane: "publicTI",
      field: "orgRelevance",
      detail,
      route: "/ti",
      recoverable: true
    }],
    blockers: [{
      ...blocker("missing_provenance", "orgRelevance", detail, true),
      ownerLane: "publicTI",
      route: "/ti",
      action: "Return orgRelevance from the public TI actor response."
    }]
  };
}

function actorCoverageForOrgRelevance(orgRelevance: PublicTiOrgRelevanceProofLike): ActorOrgRelevanceReadinessRow["actor"] {
  return {
    canonicalName: orgRelevance.actorIdentity?.canonicalName || orgRelevance.query,
    aliasCount: orgRelevance.actorIdentity?.aliases?.length ?? 0,
    sectorCount: orgRelevance.actorIdentity?.sectors?.length ?? 0,
    regionCount: orgRelevance.actorIdentity?.regions?.length ?? orgRelevance.affectedEntities?.regions?.length ?? 0,
    sourceCoverageCount: orgRelevance.sourceCoverage?.length ?? 0
  };
}

function actorEnrichmentGapsForOrgRelevance(orgRelevance: PublicTiOrgRelevanceProofLike): ActorOrgRelevanceEnrichmentGap[] {
  const gaps: ActorOrgRelevanceEnrichmentGap[] = [];
  const identity = orgRelevance.actorIdentity;
  if (!identity?.aliases?.length) gaps.push(actorGap("missing_actor_aliases", "actorIdentity.aliases", "Actor aliases are required for stable lookup and duplicate matching.", "/dashboard/ti/enrichment", "publicTI"));
  if (!identity?.sectors?.length) gaps.push(actorGap("missing_target_sectors", "actorIdentity.sectors", "Target sectors are required before routing actor relevance by customer exposure.", "/dashboard/ti/enrichment", "publicTI"));
  if (!identity?.regions?.length && !orgRelevance.affectedEntities?.regions?.length) gaps.push(actorGap("missing_target_regions", "actorIdentity.regions", "Target regions or affected-region evidence are required for geographic relevance.", "/dashboard/ti/enrichment", "publicTI"));
  if (!orgRelevance.sourceCoverage?.length) gaps.push(actorGap("missing_source_coverage", "sourceCoverage", "Source coverage rows are required to show which collectors back the actor profile.", "/dashboard/ti/enrichment", "source"));
  if (!orgRelevance.sourceEvidence?.length) gaps.push(actorGap("missing_provenance", "sourceEvidence", "Source evidence is required before actor relevance can be trusted.", "/dashboard/ti/enrichment", "source"));
  if (orgRelevance.freshness?.stale) gaps.push(actorGap("stale_evidence", "freshness.lastSeen", orgRelevance.freshness.reason || "Actor evidence is stale.", "/dashboard/ti/enrichment", "source"));
  return gaps;
}

function actorGap(code: ActorOrgRelevanceEnrichmentGap["code"], field: string, detail: string, route: string, ownerLane: ActorOrgRelevanceReadinessOwner): ActorOrgRelevanceEnrichmentGap {
  return { code, field, detail, route, ownerLane, recoverable: true };
}

function provenanceRowsForOrgRelevance(orgRelevance: PublicTiOrgRelevanceProofLike): ActorOrgRelevanceReadinessRow["provenance"] {
  const sourceRows = (orgRelevance.sourceEvidence ?? []).map((source) => ({
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    captureId: source.captureId,
    provenance: source.provenance,
    confidence: source.confidence
  }));
  const handoffEvidence = (orgRelevance.handoffRows ?? []).flatMap((row) => row.evidence?.sourceName || row.evidence?.provenance ? [{
    sourceId: row.evidence?.sourceId,
    sourceName: row.evidence?.sourceName || row.label,
    captureId: row.evidence?.captureId,
    provenance: row.evidence?.provenance || row.provenanceRefs?.[0] || row.rowId,
    reportDate: row.evidence?.reportDate,
    confidence: row.evidence?.confidence,
    shownBecause: row.evidence?.summary
  }] : []);
  return uniqueByRows([...sourceRows, ...handoffEvidence], row => `${row.sourceId || ""}:${row.captureId || ""}:${row.provenance}`);
}

function ownerLaneForBlocker(blocker: AnalystHandoffBlocker): ActorOrgRelevanceReadinessOwner {
  if (blocker.code === "missing_org" || blocker.code === "missing_watchlist_id" || blocker.code === "missing_watchlist_item" || blocker.code === "missing_watchlist_term") return "org";
  if (blocker.code === "absent_alert_id") return "alert";
  if (blocker.code === "missing_case_route") return "case";
  if (blocker.code === "missing_webhook_destination") return "webhook";
  if (blocker.code === "missing_provenance" || blocker.code === "stale_evidence") return "source";
  return "publicTI";
}

function routeForBlocker(blocker: AnalystHandoffBlocker) {
  const owner = ownerLaneForBlocker(blocker);
  if (owner === "org" || owner === "alert" || owner === "webhook") return "/dashboard/dwm";
  if (owner === "case") return "/v1/cases";
  if (owner === "source") return "/dashboard/ti/enrichment";
  return "/ti";
}

function actionForBlocker(blocker: AnalystHandoffBlocker) {
  if (blocker.code === "missing_org") return "Select or attach an organization before saving watchlist terms.";
  if (blocker.code === "missing_watchlist_term") return "Attach a company, domain, vendor, or product term.";
  if (blocker.code === "missing_watchlist_id" || blocker.code === "missing_watchlist_item") return "Persist the org watchlist item before rebuilding alerts.";
  if (blocker.code === "absent_alert_id") return "Rebuild alerts from the persisted watchlist item.";
  if (blocker.code === "missing_case_route") return "Create or return the case route for the related alert.";
  if (blocker.code === "missing_webhook_destination") return "Attach an active webhook destination for dry-run delivery.";
  if (blocker.code === "stale_evidence") return "Refresh actor evidence before handoff.";
  return "Attach source provenance and capture identity.";
}

function uniqueBlockerCodes(codes: AnalystHandoffBlockerCode[]) {
  return uniqueStrings(codes) as AnalystHandoffBlockerCode[];
}

function uniqueByRows<T>(values: T[], keyFor: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = keyFor(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectWatchTerm(orgRelevance: PublicTiOrgRelevanceProofLike) {
  return orgRelevance.candidateTerms?.find(term => term.matched) || orgRelevance.candidateTerms?.[0];
}

function selectSourceEvidence(orgRelevance: PublicTiOrgRelevanceProofLike, termValue: string | undefined) {
  return orgRelevance.sourceEvidence?.find(source => termValue && source.supportsTerms?.some(term => normalizeValue(term) === normalizeValue(termValue)))
    || orgRelevance.sourceEvidence?.[0];
}

function selectAlertRef(orgRelevance: PublicTiOrgRelevanceProofLike) {
  return orgRelevance.alertCaseRefs?.find(ref => ref.alertId && ref.casePath && ref.captureIds.length && ref.webhookDestinationIds.length)
    || orgRelevance.alertCaseRefs?.[0];
}

function orgRelevanceBlockers(
  orgRelevance: PublicTiOrgRelevanceProofLike,
  input: { organizationId?: string; staleEvidenceBefore?: string },
  org: ReturnType<typeof selectOrgRef>,
  term: ReturnType<typeof selectWatchTerm>,
  source: ReturnType<typeof selectSourceEvidence>,
  alertRef: ReturnType<typeof selectAlertRef>
): AnalystHandoffBlocker[] {
  const blockers: AnalystHandoffBlocker[] = [];
  if (!org.organizationId) blockers.push(blocker("missing_org", "organizationId", "Actor relevance handoff requires organization scope.", true));
  if (input.organizationId && org.organizationId && input.organizationId !== org.organizationId) blockers.push(blocker("identity_mismatch", "organizationId", `Actor relevance organization mismatch: ${input.organizationId} !== ${org.organizationId}.`, false));
  if (!term) blockers.push(blocker("missing_watchlist_term", "candidateTerms", "Actor relevance proof does not include a watchlist term.", true));
  if (!org.watchlistId) blockers.push(blocker("missing_watchlist_id", "organizationRefs[].watchlistId", "Alert rebuild requires a persisted watchlist id.", true));
  if (!org.watchlistItemId) blockers.push(blocker("missing_watchlist_item", "organizationRefs[].watchlistItemId", "Alert rebuild requires a persisted watchlist item id.", true));
  if (!source?.provenance || !(source.captureId || source.sourceId)) blockers.push(blocker("missing_provenance", "sourceEvidence", "Actor relevance handoff requires source provenance and capture/source identity.", true));
  if (orgRelevance.freshness?.stale || isStale(orgRelevance.freshness?.lastSeen ?? orgRelevance.generatedAt, input.staleEvidenceBefore)) blockers.push(blocker("stale_evidence", "freshness.lastSeen", "Actor relevance evidence is stale and needs refresh before alert or case handoff.", true));
  if (!alertRef?.alertId) blockers.push(blocker("absent_alert_id", "alertCaseRefs[].alertId", "Case and webhook handoff require a related alert id.", true));
  if (!alertRef?.casePath) blockers.push(blocker("missing_case_route", "alertCaseRefs[].casePath", "Case handoff requires an existing case route.", true));
  if (!alertRef?.captureIds.length) blockers.push(blocker("missing_provenance", "alertCaseRefs[].captureIds", "Case and webhook handoff require capture evidence.", true));
  if (!alertRef?.webhookDestinationIds.length) blockers.push(blocker("missing_webhook_destination", "alertCaseRefs[].webhookDestinationIds", "Webhook dry-run requires an active destination id.", true));
  return blockers;
}

function blockerFromPublicRow(row: NonNullable<PublicTiOrgRelevanceProofLike["handoffRows"]>[number], rowBlocker: NonNullable<NonNullable<PublicTiOrgRelevanceProofLike["handoffRows"]>[number]["blockers"]>[number]) {
  return blocker(
    blockerCodeFromPublic(rowBlocker.code),
    rowBlocker.field || row.rowId,
    rowBlocker.detail || row.action || row.label,
    rowBlocker.recoverable ?? true
  );
}

function blockerCodeFromPublic(code: string | undefined): AnalystHandoffBlockerCode {
  if (code === "missing_org") return "missing_org";
  if (code === "missing_org_watchlist" || code === "missing_watchlist_id") return "missing_watchlist_id";
  if (code === "missing_watchlist_item") return "missing_watchlist_item";
  if (code === "missing_source_provenance" || code === "missing_capture" || code === "missing_provenance") return "missing_provenance";
  if (code === "stale_provenance" || code === "stale_evidence") return "stale_evidence";
  if (code === "missing_alert" || code === "absent_alert_id") return "absent_alert_id";
  if (code === "missing_case_route") return "missing_case_route";
  if (code === "missing_webhook_destination") return "missing_webhook_destination";
  return "missing_provenance";
}

function alertFromOrgRelevance(
  orgRelevance: PublicTiOrgRelevanceProofLike,
  org: ReturnType<typeof selectOrgRef>,
  term: NonNullable<ReturnType<typeof selectWatchTerm>>,
  source: NonNullable<ReturnType<typeof selectSourceEvidence>>,
  alertRef: NonNullable<ReturnType<typeof selectAlertRef>>
): AnalystAlertLike {
  const sourceFamily = mapPublicSourceFamily(orgRelevance.handoffRows?.find(row => row.kind === "source_evidence")?.sourceFamily);
  const captureIds = uniqueOptionalStrings([...(alertRef.captureIds ?? []), source.captureId]);
  const sourceIds = uniqueOptionalStrings([source.sourceId]);
  const evidenceId = stableId("public_ti_evidence", `${source.sourceId || source.sourceName}:${source.captureId || source.provenance}`);
  return {
    id: alertRef.alertId,
    eventType: "darkweb.monitoring.match",
    severity: "high",
    confidence: source.confidence ?? 0.7,
    matchedTerm: { kind: term.kind, value: term.value },
    company: term.value,
    actor: orgRelevance.query,
    artifactType: "public_report",
    sourceFamily,
    sourceCount: sourceIds.length || 1,
    firstSeenAt: orgRelevance.freshness?.lastSeen ?? orgRelevance.generatedAt,
    lastSeenAt: orgRelevance.freshness?.lastSeen ?? orgRelevance.generatedAt,
    assertionKind: "source_claim",
    observedMatchSummary: `1 captured record from ${sourceIds.length || 1} source matched ${term.value}. This confirms the source mention, not the underlying incident.`,
    claimSummary: `${orgRelevance.query} matched ${term.value} from ${source.sourceName}.`,
    matchContext: {
      normalizedTerm: normalizeValue(term.value),
      termKind: term.kind,
      matchType: "bounded_text_or_metadata",
      matchedFieldHints: ["publicTi.orgRelevance"]
    },
    evidenceSummary: {
      evidenceCount: 1,
      sourceFamilyCounts: { [sourceFamily]: 1 },
      metadataOnlyCount: 0,
      publicSafeCount: 1,
      firstObservedAt: orgRelevance.freshness?.lastSeen ?? orgRelevance.generatedAt,
      lastObservedAt: orgRelevance.freshness?.lastSeen ?? orgRelevance.generatedAt
    },
    routingContext: {
      queue: "analyst_review",
      urgency: "same_day",
      customerVisibleEvidence: "redacted_excerpt",
      reason: "Public TI actor relevance has a persisted organization watchlist match."
    },
    confidenceReasoning: [
      "Source evidence is attached to the actor relevance proof.",
      "Organization watchlist identity is attached to the actor relevance proof.",
      "Alert, case, and destination identity are attached to the actor relevance proof."
    ],
    provenance: {
      generatedAt: orgRelevance.generatedAt,
      matchBasis: "watchlist_capture_text",
      matchedEvidenceIds: [evidenceId],
      sourceFamilies: [sourceFamily],
      captureIds,
      sourceIds,
      extractorVersions: ["public_ti_org_relevance_v1"],
      metadataOnly: false
    },
    dedupeKey: stableId("public_ti_org_relevance", `${orgRelevance.actorId}:${org.organizationId}:${term.kind}:${term.value}:${alertRef.alertId}`),
    reviewState: "needs_review",
    recommendedAction: "Open actor relevance case handoff.",
    recommendedRoute: "analyst_review",
    evidence: [{
      id: evidenceId,
      sourceId: source.sourceId || source.sourceName,
      sourceName: source.sourceName,
      sourceFamily,
      url: source.provenance,
      firstSeenAt: orgRelevance.freshness?.lastSeen ?? orgRelevance.generatedAt,
      observedAt: orgRelevance.freshness?.lastSeen ?? orgRelevance.generatedAt,
      captureMode: "public_report",
      redactionState: "public_safe",
      contentHash: stableId("public_ti_hash", `${source.provenance}:${source.captureId || ""}`),
      excerpt: `${source.sourceName} supports ${term.value}.`,
      provenance: {
        captureId: source.captureId || stableId("public_ti_capture", source.provenance),
        sourceId: source.sourceId || source.sourceName,
        sourceType: "public_ti",
        collector: "public_ti_org_relevance",
        captureMode: "public_report",
        metadataOnly: false
      }
    }],
    webhookDelivery: {
      recommendedRoute: "analyst_review",
      payloadHash: stableId("public_ti_webhook_payload", `${alertRef.alertId}:${alertRef.webhookDestinationIds.join(",")}`),
      dedupeKey: stableId("public_ti_webhook", `${alertRef.alertId}:${alertRef.webhookDestinationIds.join(",")}`)
    },
    tenantId: org.tenantId,
    organizationId: org.organizationId,
    watchlistIds: org.watchlistId ? [org.watchlistId] : [],
    watchlistItemIds: org.watchlistItemId ? [org.watchlistItemId] : [],
    caseIdCandidate: alertRef.caseIdCandidate,
    casePath: alertRef.casePath,
    workflowContext: {
      tenantId: org.tenantId,
      organizationId: org.organizationId,
      watchlistIds: org.watchlistId ? [org.watchlistId] : [],
      watchlistItemIds: org.watchlistItemId ? [org.watchlistItemId] : [],
      captureIds,
      caseIdCandidate: alertRef.caseIdCandidate,
      casePath: alertRef.casePath,
      dedupeKey: stableId("public_ti_org_relevance", `${orgRelevance.actorId}:${org.organizationId}:${term.kind}:${term.value}:${alertRef.alertId}`),
      recommendedRoute: "analyst_review",
      webhookDestinationIds: alertRef.webhookDestinationIds
    },
    webhookContext: {
      tenantId: org.tenantId,
      organizationId: org.organizationId,
      watchlistIds: org.watchlistId ? [org.watchlistId] : [],
      watchlistItemIds: org.watchlistItemId ? [org.watchlistItemId] : [],
      captureIds,
      evidenceCount: 1,
      dedupeKey: stableId("public_ti_org_relevance", `${orgRelevance.actorId}:${org.organizationId}:${term.kind}:${term.value}:${alertRef.alertId}`),
      recommendedRoute: "analyst_review",
      caseIdCandidate: alertRef.caseIdCandidate,
      casePath: alertRef.casePath,
      webhookDestinationIds: alertRef.webhookDestinationIds
    }
  };
}

function mapPublicSourceFamily(value: string | undefined): DwmAlert["sourceFamily"] {
  if (value === "source_capture" || value === "darkweb_metadata") return "darkweb_metadata";
  if (value === "vendor_disclosure" || value === "public_ti" || value === "actor_profile") return "public_advisory";
  if (value === "watchlist") return "actor_page";
  return "public_advisory";
}

function uniqueBlockers(blockers: AnalystHandoffBlocker[]) {
  const seen = new Set<string>();
  return blockers.filter((item) => {
    const key = `${item.code}:${item.field}:${item.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueOptionalStrings(values: Array<string | undefined>) {
  return uniqueStrings(values.filter((value): value is string => Boolean(value)));
}

export function mergeAnalystHandoffIdentity(base: AnalystHandoffIdentity, next: Partial<AnalystHandoffIdentity>): AnalystHandoffIdentity {
  const merged: AnalystHandoffIdentity = { ...base };
  for (const [key, value] of Object.entries(next) as Array<[keyof AnalystHandoffIdentity, AnalystHandoffIdentity[keyof AnalystHandoffIdentity]]>) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      const current = Array.isArray(merged[key]) ? merged[key] as string[] : [];
      (merged as any)[key] = uniqueStrings([...current, ...value]);
      continue;
    }
    const current = merged[key];
    if (current !== undefined && current !== value) throw new AnalystHandoffIdentityMismatchError(key, current, value);
    (merged as any)[key] = value;
  }
  return compactIdentity(merged);
}

function identityFromAlert(alert: AnalystAlertLike, input: { tenantId?: string; organizationId?: string; requestedByUserId?: string }): AnalystHandoffIdentity {
  const workflow = alert.workflowContext || {};
  const webhook = alert.webhookContext || {};
  const captureIds = workflow.captureIds || webhook.captureIds || alert.provenance?.captureIds || alert.evidence.map((item) => item.provenance.captureId);
  return compactIdentity({
    tenantId: input.tenantId || alert.tenantId || workflow.tenantId || webhook.tenantId || "default",
    organizationId: input.organizationId || alert.organizationId || workflow.organizationId || webhook.organizationId,
    requestedByUserId: input.requestedByUserId,
    actorName: alert.actor,
    normalizedWatchTerm: normalizeValue(alert.matchedTerm.value),
    watchTermKind: alert.matchedTerm.kind,
    alertId: alert.id,
    alertDedupeKey: workflow.dedupeKey || webhook.dedupeKey || alert.dedupeKey || alert.webhookDelivery?.dedupeKey,
    sourceFamily: alert.sourceFamily,
    captureIds,
    caseIdCandidate: alert.caseIdCandidate || workflow.caseIdCandidate || webhook.caseIdCandidate,
    casePath: alert.casePath || workflow.casePath || webhook.casePath,
    watchlistItemIds: alert.watchlistItemIds || workflow.watchlistItemIds || webhook.watchlistItemIds,
    webhookDestinationIds: workflow.webhookDestinationIds || webhook.webhookDestinationIds
  });
}

function actorArtifactBlockers(input: ActorArtifactAdapterInput, terms: Array<DwmWatchTerm & { notes?: string }>): AnalystHandoffBlocker[] {
  const blockers: AnalystHandoffBlocker[] = [];
  if (!input.organizationId) blockers.push(blocker("missing_org", "organizationId", "Public TI watchlist creation requires an organization id.", true));
  if (!supportedArtifactKind(input.artifact.kind)) blockers.push(blocker("unsupported_actor_artifact", "artifact.kind", `Unsupported actor artifact kind: ${input.artifact.kind}.`, false));
  if (!terms.length) blockers.push(blocker("missing_watchlist_term", "terms", "Public TI artifact did not include a usable watchlist term.", true));
  if (!input.artifact.provenance?.length) blockers.push(blocker("missing_provenance", "artifact.provenance", "Public TI artifact needs source provenance before becoming an org watchlist term.", true));
  if (isStale(input.artifact.freshness, input.staleEvidenceBefore) || input.artifact.readiness?.state === "stale") blockers.push(blocker("stale_evidence", "artifact.freshness", "Public TI artifact evidence is stale and needs refresh before handoff.", true));
  return blockers;
}

function alertAdapterBlockers(alert: AnalystAlertLike, input: { organizationId?: string; staleEvidenceBefore?: string }): AnalystHandoffBlocker[] {
  const identity = identityFromAlert(alert, input);
  const blockers: AnalystHandoffBlocker[] = [];
  if (!alert.id) blockers.push(blocker("absent_alert_id", "alert.id", "Persisted alert handoff requires an alert id.", false));
  if (!identity.organizationId) blockers.push(blocker("missing_org", "organizationId", "Persisted alert handoff requires organization scope.", true));
  if (!identity.captureIds?.length || !alert.provenance?.sourceIds?.length) blockers.push(blocker("missing_provenance", "alert.provenance", "Persisted alert handoff requires capture and source provenance.", true));
  if (isStale(alert.lastSeenAt, input.staleEvidenceBefore)) blockers.push(blocker("stale_evidence", "alert.lastSeenAt", "Persisted alert evidence is stale and needs refresh before case or webhook handoff.", true));
  return blockers;
}

function webhookTriggerIdempotencyKey(alert: AnalystAlertLike, identity: AnalystHandoffIdentity, dryRun: boolean | undefined): string {
  return stableId("dwm_webhook_trigger", `${identity.tenantId}:${identity.organizationId || ""}:${alert.id}:${identity.alertDedupeKey || alert.dedupeKey}:${(identity.webhookDestinationIds || []).join(",")}:${dryRun ? "dry_run" : "live"}`);
}

function alertWatchlistReadinessBlocker(blocker: AnalystHandoffBlocker): OrgScopedAlertWatchlistReadiness["blockers"][number] {
  const ownerLane = blocker.code === "missing_org" ? "org" : "alert";
  return {
    ...blocker,
    ownerLane,
    route: ownerLane === "org" ? "GET /api/organizations/:id/watchlists/alert-terms" : "POST /v1/dwm/alerts/rebuild",
    action: ownerLane === "org" ? "export_shared_watchlist_terms" : "rebuild_org_scoped_dwm_alerts"
  };
}

function envelope<TKind extends AnalystHandoffKind, TPayload>(input: {
  kind: TKind;
  source: AnalystHandoffSource;
  createdAt?: string;
  parentHandoffId?: string;
  identity: AnalystHandoffIdentity;
  payload: TPayload;
}): AnalystHandoffEnvelope<TKind, TPayload> {
  const createdAt = input.createdAt || nowIso();
  return {
    schemaVersion: ANALYST_HANDOFF_SCHEMA_VERSION,
    handoffId: stableId("analyst_handoff", `${input.kind}:${input.identity.tenantId}:${input.identity.organizationId || ""}:${input.identity.artifactId || ""}:${input.identity.watchlistId || ""}:${input.identity.alertId || ""}:${createdAt}`),
    kind: input.kind,
    createdAt,
    source: input.source,
    parentHandoffId: input.parentHandoffId,
    identity: compactIdentity(input.identity),
    payload: input.payload
  };
}

function casePathFor(caseIdCandidate: string, alertId: string, dedupeKey: string) {
  return `/v1/cases/${encodeURIComponent(caseIdCandidate)}?alertId=${encodeURIComponent(alertId)}&dedupeKey=${encodeURIComponent(dedupeKey)}`;
}

function blocker(code: AnalystHandoffBlockerCode, field: string, detail: string, recoverable: boolean): AnalystHandoffBlocker {
  return { code, field, detail, recoverable };
}

function supportedArtifactKind(kind: string) {
  return ["actor", "country", "tool", "campaign", "infrastructure", "technique"].includes(kind);
}

function normalizeAdapterTerms(terms: Array<DwmWatchTerm & { notes?: string }>): Array<DwmWatchTerm & { notes?: string }> {
  return terms.map((term) => ({ ...term, value: term.value.trim() })).filter((term) => term.value.length > 0);
}

function isStale(value: string | undefined, staleEvidenceBefore: string | undefined) {
  if (!value || !staleEvidenceBefore) return false;
  return value < staleEvidenceBefore;
}

function compactIdentity(identity: AnalystHandoffIdentity): AnalystHandoffIdentity {
  return Object.fromEntries(Object.entries(identity).filter(([, value]) => value !== undefined && (!Array.isArray(value) || value.length > 0))) as AnalystHandoffIdentity;
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}
