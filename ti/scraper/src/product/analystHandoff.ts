import { nowIso, stableId, uniqueStrings } from "../utils.ts";
import type { DwmAlert, DwmRecommendedRoute, DwmWatchTerm } from "./dwmProduct.ts";

export const ANALYST_HANDOFF_SCHEMA_VERSION = "hanasand.analyst_handoff.v1" as const;

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
    dryRun?: boolean;
  };
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
        dryRun: input.dryRun || undefined
      }
    }
  });
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

function compactIdentity(identity: AnalystHandoffIdentity): AnalystHandoffIdentity {
  return Object.fromEntries(Object.entries(identity).filter(([, value]) => value !== undefined && (!Array.isArray(value) || value.length > 0))) as AnalystHandoffIdentity;
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}
