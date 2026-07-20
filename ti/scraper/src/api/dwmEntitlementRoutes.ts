import { nowIso, stableId } from "../utils.ts";
import { validateAnalystHandoffConsumerBundle, type AnalystHandoffConsumerBlocker } from "../product/analystHandoffConsumer.ts";
import { json, readJson } from "./http.ts";
import type { Organization, OrganizationMember } from "./organizationRoutes.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { authenticateOperatorRequest, type AuthenticatedIdentity } from "./requestAuthentication.ts";

export type DwmEntitlementPlan = "trial" | "team" | "portfolio" | "enterprise" | "custom";
export type DwmEntitlementStatus = "active" | "suspended";
export type DwmEntitlementLimits = {
  activeWatchlists: number;
  watchTerms: number;
  webhookDestinations: number;
  sourcePacks: number;
  alertRebuildsPerDay: number;
  openCases: number;
};

export type DwmEntitlementPolicy = {
  id: string;
  recordType: "dwm_entitlement_policy";
  organizationId: string;
  tenantId: string;
  plan: DwmEntitlementPlan;
  status: DwmEntitlementStatus;
  limits: DwmEntitlementLimits;
  usageSnapshot: DwmEntitlementUsage;
  createdAt: string;
  updatedAt: string;
  updatedBy?: {
    memberId?: string;
    email?: string;
    userId?: string;
    role?: string;
  };
  auditTrail: DwmEntitlementAuditEvent[];
  integrationHints: DwmEntitlementIntegrationHints;
};

export type DwmEntitlementUsage = {
  activeWatchlists: number;
  watchTerms: number;
  webhookDestinations: number;
  sourcePacks: number;
  alertRebuildsToday: number;
  openCases: number;
};

export type DwmEntitlementAuditEvent = {
  id: string;
  at: string;
  action: "created" | "updated";
  actor?: {
    memberId?: string;
    email?: string;
    userId?: string;
    role?: string;
  };
  reason: string;
  requestId?: string;
  changes: Record<string, unknown>;
};

export type DwmEntitlementUsageEvent = {
  id: string;
  recordType: "dwm_entitlement_usage_event";
  organizationId: string;
  tenantId: string;
  action: "alert_rebuild";
  at: string;
  actor?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
};

export type DwmEntitlementIntegrationHints = {
  dashboard: {
    summaryRoute: string;
    watchlistRoute: string;
    blockedActionCopy: string;
  };
  helpdesk: {
    lookupKey: string;
    auditSource: "dwm_entitlement_policy";
    escalationHint: string;
  };
};

export type DwmEntitlementEvaluation = {
  status: DwmEntitlementStatus;
  persistedPolicy: boolean;
  usage: DwmEntitlementUsage;
  projectedUsage?: DwmEntitlementUsage;
  checks: Array<{ code: string; used: number; limit: number; remaining: number; allowed: boolean }>;
  integrationHints: DwmEntitlementIntegrationHints;
};

export type DwmEntitlementPolicyEvaluation = DwmEntitlementEvaluation & { policy: DwmEntitlementPolicy };

export type DwmEntitlementReadinessActionId =
  | "watchlist_create"
  | "watchlist_update"
  | "alert_rebuild"
  | "alert_replay"
  | "source_growth"
  | "webhook_delivery"
  | "analyst_handoff";

export const DWM_ENTITLEMENT_BLOCKER_SCHEMA_VERSION = "dwm.entitlement_blocker.v1" as const;

export type DwmEntitlementCompatibilityBlocker = {
  schemaVersion: typeof DWM_ENTITLEMENT_BLOCKER_SCHEMA_VERSION;
  ownerLane: DwmEntitlementReadinessAction["ownerLane"];
  actionId: DwmEntitlementReadinessActionId;
  action: string;
  blockerCode: string;
  blockedAction: string | null;
  status: DwmEntitlementReadinessAction["status"];
  route?: string;
  requestId?: string;
  entitlementStatus: DwmEntitlementStatus;
  plan: DwmEntitlementPlan;
  persistedPolicy: boolean;
  usage: DwmEntitlementUsage;
  projectedUsage?: DwmEntitlementUsage;
  limit?: { code: string; used: number; limit: number; remaining: number };
  nextStep: string;
  supportText: string;
  dashboardText: string;
  redactedAudit?: ReturnType<typeof redactedLatestAuditEvent>;
  source: "entitlement" | "visibility" | "missing_prerequisite" | "analyst_handoff";
  analystHandoff?: Pick<AnalystHandoffConsumerBlocker, "code" | "stage" | "field" | "recoverable">;
};

export type DwmEntitlementReadinessAction = {
  id: DwmEntitlementReadinessActionId;
  ownerLane: "entitlement" | "source-growth" | "webhook" | "alert-workflow" | "analyst-handoff";
  status: "allowed" | "blocked" | "permissive_no_policy" | "needs_input";
  entitlementStatus: DwmEntitlementStatus;
  plan: DwmEntitlementPlan;
  persistedPolicy: boolean;
  blockerCodes: string[];
  blockers: DwmEntitlementCompatibilityBlocker[];
  usage: DwmEntitlementUsage;
  limits: DwmEntitlementLimits;
  projectedUsage?: DwmEntitlementUsage;
  limit?: { code: string; used: number; limit: number; remaining: number };
  blockedAction: string | null;
  requestId?: string;
  nextStep: string;
  helpdeskText: string;
  dashboardText: string;
  route?: string;
  redactedAudit?: ReturnType<typeof redactedLatestAuditEvent>;
  analystHandoff?: {
    ok: boolean;
    blockerCount: number;
    blockers: Array<Pick<AnalystHandoffConsumerBlocker, "code" | "stage" | "field" | "recoverable">>;
  };
};

export type DwmEntitlementReadinessModel = {
  schemaVersion: "dwm.entitlement_readiness.v1";
  generatedAt: string;
  requestId?: string;
  organization: Pick<Organization, "id" | "tenantId" | "name">;
  access: { allowed: boolean; role?: string; readOnly?: boolean; reason: string | null };
  policy: {
    id: string;
    plan: DwmEntitlementPlan;
    status: DwmEntitlementStatus;
    persistedPolicy: boolean;
    limits: DwmEntitlementLimits;
    updatedAt: string;
  };
  usage: DwmEntitlementUsage;
  checks: DwmEntitlementEvaluation["checks"];
  defaultNoPolicyBehavior: "permissive_until_policy_persisted";
  integrationHints: DwmEntitlementIntegrationHints;
  actions: Record<DwmEntitlementReadinessActionId, DwmEntitlementReadinessAction>;
};

const planLimits: Record<DwmEntitlementPlan, DwmEntitlementLimits> = {
  trial: { activeWatchlists: 1, watchTerms: 5, webhookDestinations: 1, sourcePacks: 2, alertRebuildsPerDay: 5, openCases: 10 },
  team: { activeWatchlists: 10, watchTerms: 250, webhookDestinations: 5, sourcePacks: 25, alertRebuildsPerDay: 100, openCases: 100 },
  portfolio: { activeWatchlists: 50, watchTerms: 1500, webhookDestinations: 20, sourcePacks: 100, alertRebuildsPerDay: 500, openCases: 500 },
  enterprise: { activeWatchlists: 250, watchTerms: 10000, webhookDestinations: 100, sourcePacks: 500, alertRebuildsPerDay: 5000, openCases: 5000 },
  custom: { activeWatchlists: 10, watchTerms: 250, webhookDestinations: 5, sourcePacks: 25, alertRebuildsPerDay: 100, openCases: 100 }
};

export async function getOrganizationEntitlements(_url: URL, options: ApiServerOptions, organizationId: string | undefined, request?: Request): Promise<Response> {
  const authentication = request ? await authenticateOperatorRequest(request, options) : {};
  if (authentication.error) return authentication.error;
  const access = authorizeEntitlementAccess(options, organizationId, request, undefined, "read", authentication.identity);
  if (access.error) return access.error;
  const policy = getOrDefaultEntitlementPolicy(options, access.organization);
  return json({ organization: access.organization, access: access.access, entitlement: policy, evaluation: evaluateDwmEntitlementPolicy(options, access.organization, policy) });
}

export async function getOrganizationEntitlementReadiness(request: Request, options: ApiServerOptions, organizationId: string | undefined): Promise<Response> {
  const body = request.method === "POST" ? await readJson<any>(request) : undefined;
  const authentication = await authenticateOperatorRequest(request, options);
  if (authentication.error) return authentication.error;
  const access = authorizeEntitlementAccess(options, organizationId, request, body, "read", authentication.identity);
  if (access.error) return access.error;
  return json(buildOrganizationEntitlementReadiness(options, access.organization, {
    requestId: String(body?.requestId ?? request.headers.get("x-request-id") ?? "").trim() || undefined,
    proposedWatchlistTerms: normalizeReadinessTerms(body?.proposedWatchlistTerms ?? body?.terms),
    analystHandoffBundle: body?.analystHandoffBundle ?? body?.bundle,
    access: access.access
  }));
}

export async function upsertOrganizationEntitlements(request: Request, options: ApiServerOptions, organizationId: string | undefined): Promise<Response> {
  const body = await readJson<any>(request);
  const authentication = await authenticateOperatorRequest(request, options);
  if (authentication.error) return authentication.error;
  const access = authorizeEntitlementAccess(options, organizationId, request, body, "mutate", authentication.identity);
  if (access.error) return access.error;

  const reason = String(body.reason ?? body.auditReason ?? "").trim();
  if (!reason) return json({ error: { code: "missing_entitlement_reason", message: "Changing organization entitlements requires an audit reason." }, access: access.access }, 400);

  const generatedAt = nowIso();
  const existing = getStoredEntitlementPolicy(options, access.organization.id);
  const plan = normalizePlan(body.plan ?? existing?.plan);
  const status = normalizeStatus(body.status ?? existing?.status);
  const limits = normalizeLimits(body.limits, plan, existing?.limits);
  const usageSnapshot = buildEntitlementUsage(options, access.organization);
  const actor = memberActor(access.member, access.identity[0]);
  const auditEvent: DwmEntitlementAuditEvent = {
    id: stableId("dwm_entitlement_audit", `${access.organization.id}:${generatedAt}:${actor.email ?? actor.userId ?? "unknown"}`),
    at: generatedAt,
    action: existing ? "updated" : "created",
    actor,
    reason,
    requestId: String(body.requestId ?? request.headers.get("x-request-id") ?? "").trim() || undefined,
    changes: {
      plan: existing?.plan === plan ? undefined : { from: existing?.plan, to: plan },
      status: existing?.status === status ? undefined : { from: existing?.status, to: status },
      limits
    }
  };
  const policy: DwmEntitlementPolicy = {
    id: existing?.id ?? stableId("dwm_entitlement_policy", access.organization.id),
    recordType: "dwm_entitlement_policy",
    organizationId: access.organization.id,
    tenantId: access.organization.tenantId,
    plan,
    status,
    limits,
    usageSnapshot,
    createdAt: existing?.createdAt ?? generatedAt,
    updatedAt: generatedAt,
    updatedBy: actor,
    auditTrail: [...(existing?.auditTrail ?? []), { ...auditEvent, changes: dropUndefined(auditEvent.changes) }].slice(-100),
    integrationHints: entitlementIntegrationHints(access.organization)
  };
  saveEntitlementPolicy(options, policy);
  return json({ organization: access.organization, access: access.access, entitlement: policy, evaluation: evaluateDwmEntitlementPolicy(options, access.organization, policy) }, existing ? 200 : 201);
}

export function getStoredEntitlementPolicy(options: ApiServerOptions, organizationId: string): DwmEntitlementPolicy | undefined {
  return ((options.store as any).listPlans?.() ?? []).find((row: DwmEntitlementPolicy) => row.recordType === "dwm_entitlement_policy" && row.organizationId === organizationId);
}

export function getOrDefaultEntitlementPolicy(options: ApiServerOptions, organization: Organization): DwmEntitlementPolicy {
  return getStoredEntitlementPolicy(options, organization.id) ?? {
    id: stableId("dwm_entitlement_policy", organization.id),
    recordType: "dwm_entitlement_policy",
    organizationId: organization.id,
    tenantId: organization.tenantId,
    plan: "team",
    status: "active",
    limits: planLimits.team,
    usageSnapshot: buildEntitlementUsage(options, organization),
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
    auditTrail: [],
    integrationHints: entitlementIntegrationHints(organization)
  };
}

export function evaluateDwmEntitlementPolicy(options: ApiServerOptions, organization: Organization, policy: DwmEntitlementPolicy) {
  const usage = buildEntitlementUsage(options, organization);
  return {
    status: policy.status,
    persistedPolicy: Boolean(getStoredEntitlementPolicy(options, organization.id)),
    usage,
    checks: entitlementChecks(policy, usage),
    integrationHints: policy.integrationHints
  } satisfies DwmEntitlementEvaluation;
}

export function evaluateProposedDwmWatchlistEntitlement(options: ApiServerOptions, input: { organizationId?: string; tenantId: string; watchlistId?: string; terms: Array<{ value: string }>; status: "active" | "paused"; webhookDestinationId?: string }): { allowed: boolean; reason: string | null; evaluation?: DwmEntitlementPolicyEvaluation } {
  if (!input.organizationId) return { allowed: true, reason: null, evaluation: undefined };
  const organization = findOrganization(options, input.organizationId);
  if (!organization) return { allowed: false, reason: "organization_not_found", evaluation: undefined };
  const storedPolicy = getStoredEntitlementPolicy(options, organization.id);
  const policy = storedPolicy ?? getOrDefaultEntitlementPolicy(options, organization);
  const usage = buildEntitlementUsage(options, organization, input.watchlistId);
  const projectedUsage = {
    ...usage,
    activeWatchlists: input.status === "active" ? usage.activeWatchlists + 1 : usage.activeWatchlists,
    watchTerms: input.status === "active" ? usage.watchTerms + input.terms.length : usage.watchTerms
  };
  const checks = entitlementChecks(policy, projectedUsage);
  const denied = storedPolicy
    ? policy.status !== "active" ? "entitlement_suspended" : checks.find((check) => !check.allowed)?.code ?? null
    : null;
  return { allowed: !denied, reason: denied, evaluation: { policy, status: policy.status, persistedPolicy: Boolean(storedPolicy), usage, projectedUsage, checks, integrationHints: policy.integrationHints } };
}

export function evaluateProposedDwmAlertRebuildEntitlement(options: ApiServerOptions, input: { organizationId?: string; tenantId: string }): { allowed: boolean; reason: string | null; evaluation?: DwmEntitlementPolicyEvaluation } {
  if (!input.organizationId) return { allowed: true, reason: null, evaluation: undefined };
  const organization = findOrganization(options, input.organizationId);
  if (!organization) return { allowed: false, reason: "organization_not_found", evaluation: undefined };
  const storedPolicy = getStoredEntitlementPolicy(options, organization.id);
  const policy = storedPolicy ?? getOrDefaultEntitlementPolicy(options, organization);
  const usage = buildEntitlementUsage(options, organization);
  const projectedUsage = { ...usage, alertRebuildsToday: usage.alertRebuildsToday + 1 };
  const checks = entitlementChecks(policy, projectedUsage);
  const denied = storedPolicy
    ? policy.status !== "active" ? "entitlement_suspended" : checks.find((check) => !check.allowed)?.code ?? null
    : null;
  return { allowed: !denied, reason: denied, evaluation: { policy, status: policy.status, persistedPolicy: Boolean(storedPolicy), usage, projectedUsage, checks, integrationHints: policy.integrationHints } };
}

export function recordDwmEntitlementUsageEvent(options: ApiServerOptions, input: {
  organizationId?: string;
  tenantId: string;
  action: DwmEntitlementUsageEvent["action"];
  actor?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  at?: string;
}): DwmEntitlementUsageEvent | undefined {
  if (!input.organizationId) return undefined;
  const at = input.at ?? nowIso();
  const event: DwmEntitlementUsageEvent = {
    id: stableId("dwm_entitlement_usage", `${input.organizationId}:${input.action}:${input.requestId ?? ""}:${at}:${JSON.stringify(input.metadata ?? {})}`),
    recordType: "dwm_entitlement_usage_event",
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    action: input.action,
    at,
    actor: input.actor,
    requestId: input.requestId,
    metadata: input.metadata
  };
  return (options.store as any).savePlan(event);
}

export function buildDwmEntitlementReadAdapter(input: {
  action: string;
  reason: string | null;
  evaluation: DwmEntitlementPolicyEvaluation;
  requestId?: string;
  actor?: string;
}) {
  const failedCheck = input.reason ? input.evaluation.checks.find((check) => check.code === input.reason) : undefined;
  return {
    entitlementStatus: input.evaluation.policy.status,
    persistedPolicy: input.evaluation.persistedPolicy,
    plan: input.evaluation.policy.plan,
    usageSnapshot: input.evaluation.usage,
    projectedUsage: input.evaluation.projectedUsage,
    blockedAction: input.reason ? input.action : null,
    reason: input.reason,
    limit: failedCheck ? { code: failedCheck.code, used: failedCheck.used, limit: failedCheck.limit, remaining: failedCheck.remaining } : undefined,
    nextStep: input.reason ? input.evaluation.integrationHints.dashboard.blockedActionCopy : "Watchlist write is within the current organization entitlement.",
    dashboard: input.evaluation.integrationHints.dashboard,
    helpdesk: input.evaluation.integrationHints.helpdesk,
    audit: {
      requestId: input.requestId,
      actor: input.actor,
      latestPolicyChange: redactedLatestAuditEvent(input.evaluation.policy)
    },
    blockers: buildDwmEntitlementCompatibilityBlockers({
      actionId: actionIdFromName(input.action),
      ownerLane: ownerLaneFromAction(input.action),
      actionName: input.action,
      reason: input.reason,
      evaluation: input.evaluation,
      requestId: input.requestId,
      route: routeFromAction(input.action),
      nextStep: input.reason ? input.evaluation.integrationHints.dashboard.blockedActionCopy : "Watchlist write is within the current organization entitlement.",
      helpdeskText: input.reason
        ? `${input.evaluation.integrationHints.helpdesk.escalationHint} Limit ${input.reason} blocked ${input.action}.`
        : `${input.action} is within the current organization entitlement.`,
      dashboardText: input.reason ? input.evaluation.integrationHints.dashboard.blockedActionCopy : "Within entitlement.",
      source: "entitlement"
    })
  };
}

export function buildDwmEntitlementBlocker(input: {
  action: string;
  reason: string;
  evaluation: DwmEntitlementPolicyEvaluation;
  requestId?: string;
  actor?: string;
}) {
  return {
    error: {
      code: "dwm_entitlement_limit_exceeded",
      message: "This organization has reached a DWM entitlement limit.",
      reason: input.reason
    },
    entitlement: buildDwmEntitlementReadAdapter(input)
  };
}

export function buildOrganizationEntitlementReadiness(options: ApiServerOptions, organization: Organization, input: {
  requestId?: string;
  proposedWatchlistTerms?: Array<{ value: string }>;
  analystHandoffBundle?: unknown;
  access?: { allowed: boolean; role?: string; readOnly?: boolean; reason: string | null };
} = {}): DwmEntitlementReadinessModel {
  const storedPolicy = getStoredEntitlementPolicy(options, organization.id);
  const policy = storedPolicy ?? getOrDefaultEntitlementPolicy(options, organization);
  const evaluation = evaluateDwmEntitlementPolicy(options, organization, policy);
  const persistedPolicy = Boolean(storedPolicy);
  const proposedTerms = input.proposedWatchlistTerms?.length ? input.proposedWatchlistTerms : [{ value: "proposed-watch-term" }];
  const watchlistCreate = evaluateProposedDwmWatchlistEntitlement(options, { organizationId: organization.id, tenantId: organization.tenantId, terms: proposedTerms, status: "active" });
  const rebuild = evaluateProposedDwmAlertRebuildEntitlement(options, { organizationId: organization.id, tenantId: organization.tenantId });
  const sourceGrowth = projectLimitAction({
    actionId: "source_growth",
    ownerLane: "source-growth",
    actionName: "source_growth",
    policy,
    persistedPolicy,
    usage: evaluation.usage,
    projectedUsage: { ...evaluation.usage, sourcePacks: evaluation.usage.sourcePacks + 1 },
    checkCode: "source_packs",
    requestId: input.requestId,
    route: "/v1/dwm/source-requests"
  });
  const webhookDelivery = projectWebhookDeliveryAction({ options, organization, policy, persistedPolicy, usage: evaluation.usage, requestId: input.requestId });
  const handoff = projectAnalystHandoffAction({ bundle: input.analystHandoffBundle, policy, persistedPolicy, usage: evaluation.usage, requestId: input.requestId });

  return {
    schemaVersion: "dwm.entitlement_readiness.v1",
    generatedAt: nowIso(),
    requestId: input.requestId,
    organization: { id: organization.id, tenantId: organization.tenantId, name: organization.name },
    access: input.access ?? { allowed: true, reason: null },
    policy: {
      id: policy.id,
      plan: policy.plan,
      status: policy.status,
      persistedPolicy,
      limits: policy.limits,
      updatedAt: policy.updatedAt
    },
    usage: evaluation.usage,
    checks: evaluation.checks,
    defaultNoPolicyBehavior: "permissive_until_policy_persisted",
    integrationHints: policy.integrationHints,
    actions: {
      watchlist_create: actionFromEvaluation("watchlist_create", "entitlement", "create_dwm_watchlist", watchlistCreate, input.requestId, "/v1/dwm/watchlists"),
      watchlist_update: actionFromEvaluation("watchlist_update", "entitlement", "update_dwm_watchlist", watchlistCreate, input.requestId, "/v1/dwm/watchlists/:id"),
      alert_rebuild: actionFromEvaluation("alert_rebuild", "alert-workflow", "rebuild_dwm_alerts", rebuild, input.requestId, "/v1/dwm/alerts/rebuild"),
      alert_replay: actionFromEvaluation("alert_replay", "alert-workflow", "replay_dwm_alert", rebuild, input.requestId, "/v1/dwm/alerts/:id/replay"),
      source_growth: sourceGrowth,
      webhook_delivery: webhookDelivery,
      analyst_handoff: handoff
    }
  };
}

function actionFromEvaluation(
  id: DwmEntitlementReadinessActionId,
  ownerLane: DwmEntitlementReadinessAction["ownerLane"],
  actionName: string,
  result: { allowed: boolean; reason: string | null; evaluation?: DwmEntitlementPolicyEvaluation },
  requestId: string | undefined,
  route: string
): DwmEntitlementReadinessAction {
  if (!result.evaluation) return permissiveAction(id, ownerLane, requestId, route);
  const adapter = buildDwmEntitlementReadAdapter({ action: actionName, reason: result.reason, evaluation: result.evaluation, requestId });
  const status = result.reason
    ? "blocked"
    : result.evaluation.persistedPolicy ? "allowed" : "permissive_no_policy";
  const helpdeskText = result.reason
    ? `${adapter.helpdesk.escalationHint} Limit ${result.reason} blocked ${actionName}.`
    : result.evaluation.persistedPolicy ? `${actionName} is within the persisted organization entitlement.` : `${actionName} is allowed because no persisted entitlement policy exists yet.`;
  const dashboardText = result.reason ? adapter.dashboard.blockedActionCopy : adapter.nextStep;
  const blockers = buildDwmEntitlementCompatibilityBlockers({
    actionId: id,
    ownerLane,
    actionName,
    reason: result.reason,
    evaluation: result.evaluation,
    requestId,
    route,
    nextStep: adapter.nextStep,
    helpdeskText,
    dashboardText,
    source: "entitlement"
  });
  return {
    id,
    ownerLane,
    status,
    entitlementStatus: result.evaluation.policy.status,
    plan: result.evaluation.policy.plan,
    persistedPolicy: result.evaluation.persistedPolicy,
    blockerCodes: result.reason ? [result.reason] : [],
    blockers,
    usage: result.evaluation.usage,
    limits: result.evaluation.policy.limits,
    projectedUsage: result.evaluation.projectedUsage,
    limit: adapter.limit,
    blockedAction: adapter.blockedAction,
    requestId,
    route,
    nextStep: adapter.nextStep,
    helpdeskText,
    dashboardText,
    redactedAudit: adapter.audit.latestPolicyChange
  };
}

function projectLimitAction(input: {
  actionId: DwmEntitlementReadinessActionId;
  ownerLane: DwmEntitlementReadinessAction["ownerLane"];
  actionName: string;
  policy: DwmEntitlementPolicy;
  persistedPolicy: boolean;
  usage: DwmEntitlementUsage;
  projectedUsage: DwmEntitlementUsage;
  checkCode: string;
  requestId?: string;
  route: string;
}): DwmEntitlementReadinessAction {
  const checks = entitlementChecks(input.policy, input.projectedUsage);
  const failed = input.persistedPolicy && input.policy.status !== "active"
    ? "entitlement_suspended"
    : input.persistedPolicy ? checks.find((check) => check.code === input.checkCode && !check.allowed)?.code ?? null : null;
  return actionFromEvaluation(input.actionId, input.ownerLane, input.actionName, {
    allowed: !failed,
    reason: failed,
    evaluation: {
      policy: input.policy,
      status: input.policy.status,
      persistedPolicy: input.persistedPolicy,
      usage: input.usage,
      projectedUsage: input.projectedUsage,
      checks,
      integrationHints: input.policy.integrationHints
    }
  }, input.requestId, input.route);
}

function projectWebhookDeliveryAction(input: {
  options: ApiServerOptions;
  organization: Organization;
  policy: DwmEntitlementPolicy;
  persistedPolicy: boolean;
  usage: DwmEntitlementUsage;
  requestId?: string;
}): DwmEntitlementReadinessAction {
  const activeDestinations = ((input.options.store as any).listWebhookDestinations?.() ?? [])
    .filter((row: any) => row.organizationId === input.organization.id && row.status === "active");
  if (!activeDestinations.length) {
    const helpdeskText = "Webhook delivery is blocked because the organization has no active destination.";
    const dashboardText = "Add an active Discord or webhook destination.";
    const actionBase = {
      id: "webhook_delivery" as const,
      ownerLane: "webhook" as const,
      status: "needs_input" as const,
      entitlementStatus: input.policy.status,
      plan: input.policy.plan,
      persistedPolicy: input.persistedPolicy,
      blockerCodes: ["missing_webhook_destination"],
      usage: input.usage,
      limits: input.policy.limits,
      blockedAction: "deliver_dwm_webhook",
      requestId: input.requestId,
      route: "/v1/dwm/webhooks/deliver",
      nextStep: "Create an active organization webhook destination before delivery.",
      helpdeskText,
      dashboardText,
      redactedAudit: redactedLatestAuditEvent(input.policy)
    };
    return {
      ...actionBase,
      blockers: [{
        schemaVersion: DWM_ENTITLEMENT_BLOCKER_SCHEMA_VERSION,
        ownerLane: actionBase.ownerLane,
        actionId: actionBase.id,
        action: "deliver_dwm_webhook",
        blockerCode: "missing_webhook_destination",
        blockedAction: actionBase.blockedAction,
        status: actionBase.status,
        route: actionBase.route,
        requestId: input.requestId,
        entitlementStatus: input.policy.status,
        plan: input.policy.plan,
        persistedPolicy: input.persistedPolicy,
        usage: input.usage,
        projectedUsage: input.usage,
        nextStep: actionBase.nextStep,
        supportText: helpdeskText,
        dashboardText,
        redactedAudit: actionBase.redactedAudit,
        source: "missing_prerequisite"
      }]
    };
  }
  return projectLimitAction({
    actionId: "webhook_delivery",
    ownerLane: "webhook",
    actionName: "deliver_dwm_webhook",
    policy: input.policy,
    persistedPolicy: input.persistedPolicy,
    usage: input.usage,
    projectedUsage: input.usage,
    checkCode: "webhook_destinations",
    requestId: input.requestId,
    route: "/v1/dwm/webhooks/deliver"
  });
}

function projectAnalystHandoffAction(input: {
  bundle?: unknown;
  policy: DwmEntitlementPolicy;
  persistedPolicy: boolean;
  usage: DwmEntitlementUsage;
  requestId?: string;
}): DwmEntitlementReadinessAction {
  if (!input.bundle) {
    const helpdeskText = "No analyst handoff bundle was provided for readiness validation.";
    const dashboardText = "Handoff validation waits for a consumer bundle.";
    return {
      id: "analyst_handoff",
      ownerLane: "analyst-handoff",
      status: "needs_input",
      entitlementStatus: input.policy.status,
      plan: input.policy.plan,
      persistedPolicy: input.persistedPolicy,
      blockerCodes: ["missing_handoff_bundle"],
      blockers: [{
        schemaVersion: DWM_ENTITLEMENT_BLOCKER_SCHEMA_VERSION,
        ownerLane: "analyst-handoff",
        actionId: "analyst_handoff",
        action: "consume_analyst_handoff",
        blockerCode: "missing_handoff_bundle",
        blockedAction: null,
        status: "needs_input",
        route: "analyst_handoff_consumer",
        requestId: input.requestId,
        entitlementStatus: input.policy.status,
        plan: input.policy.plan,
        persistedPolicy: input.persistedPolicy,
        usage: input.usage,
        projectedUsage: input.usage,
        nextStep: "Provide an analyst handoff consumer bundle to validate stage prerequisites.",
        supportText: helpdeskText,
        dashboardText,
        redactedAudit: redactedLatestAuditEvent(input.policy),
        source: "missing_prerequisite"
      }],
      usage: input.usage,
      limits: input.policy.limits,
      blockedAction: null,
      requestId: input.requestId,
      route: "analyst_handoff_consumer",
      nextStep: "Provide an analyst handoff consumer bundle to validate stage prerequisites.",
      helpdeskText,
      dashboardText,
      redactedAudit: redactedLatestAuditEvent(input.policy)
    };
  }
  const validation = validateAnalystHandoffConsumerBundle(input.bundle);
  const blockerCodes = Array.from(new Set(validation.blockers.map((item) => item.code)));
  const status = validation.ok ? (input.persistedPolicy ? "allowed" : "permissive_no_policy") : "blocked";
  const helpdeskText = validation.ok ? "Analyst handoff consumer contract is ready." : `Analyst handoff blocked by: ${blockerCodes.join(", ")}.`;
  const dashboardText = validation.ok ? "Analyst handoff ready." : `${validation.blockers.length} analyst handoff blocker${validation.blockers.length === 1 ? "" : "s"} found.`;
  const nextStep = validation.ok ? "Analyst handoff prerequisites are satisfied." : "Resolve analyst handoff blockers before dispatching case or webhook actions.";
  return {
    id: "analyst_handoff",
    ownerLane: "analyst-handoff",
    status,
    entitlementStatus: input.policy.status,
    plan: input.policy.plan,
    persistedPolicy: input.persistedPolicy,
    blockerCodes,
    blockers: validation.blockers.map((item) => ({
      schemaVersion: DWM_ENTITLEMENT_BLOCKER_SCHEMA_VERSION,
      ownerLane: "analyst-handoff",
      actionId: "analyst_handoff",
      action: "consume_analyst_handoff",
      blockerCode: item.code,
      blockedAction: validation.ok ? null : "consume_analyst_handoff",
      status,
      route: "analyst_handoff_consumer",
      requestId: input.requestId,
      entitlementStatus: input.policy.status,
      plan: input.policy.plan,
      persistedPolicy: input.persistedPolicy,
      usage: input.usage,
      projectedUsage: input.usage,
      nextStep,
      supportText: helpdeskText,
      dashboardText,
      redactedAudit: redactedLatestAuditEvent(input.policy),
      source: "analyst_handoff",
      analystHandoff: { code: item.code, stage: item.stage, field: item.field, recoverable: item.recoverable }
    })),
    usage: input.usage,
    limits: input.policy.limits,
    projectedUsage: input.usage,
    blockedAction: validation.ok ? null : "consume_analyst_handoff",
    requestId: input.requestId,
    route: "analyst_handoff_consumer",
    nextStep,
    helpdeskText,
    dashboardText,
    redactedAudit: redactedLatestAuditEvent(input.policy),
    analystHandoff: {
      ok: validation.ok,
      blockerCount: validation.blockers.length,
      blockers: validation.blockers.map(({ code, stage, field, recoverable }) => ({ code, stage, field, recoverable }))
    }
  };
}

function permissiveAction(id: DwmEntitlementReadinessActionId, ownerLane: DwmEntitlementReadinessAction["ownerLane"], requestId: string | undefined, route: string): DwmEntitlementReadinessAction {
  const emptyUsage = { activeWatchlists: 0, watchTerms: 0, webhookDestinations: 0, sourcePacks: 0, alertRebuildsToday: 0, openCases: 0 };
  return {
    id,
    ownerLane,
    status: "permissive_no_policy",
    entitlementStatus: "active",
    plan: "team",
    persistedPolicy: false,
    blockerCodes: [],
    blockers: [],
    usage: emptyUsage,
    limits: planLimits.team,
    blockedAction: null,
    requestId,
    route,
    nextStep: "Allowed because this request is not organization-scoped.",
    helpdeskText: "No organization-scoped entitlement policy applies.",
    dashboardText: "No organization-scoped entitlement policy applies."
  };
}

export function buildDwmEntitlementCompatibilityBlockers(input: {
  actionId: DwmEntitlementReadinessActionId;
  ownerLane: DwmEntitlementReadinessAction["ownerLane"];
  actionName: string;
  reason: string | null;
  evaluation: DwmEntitlementPolicyEvaluation;
  requestId?: string;
  route?: string;
  nextStep: string;
  helpdeskText: string;
  dashboardText: string;
  source: DwmEntitlementCompatibilityBlocker["source"];
}): DwmEntitlementCompatibilityBlocker[] {
  if (!input.reason) return [];
  const failedCheck = input.evaluation.checks.find((check) => check.code === input.reason);
  return [{
    schemaVersion: DWM_ENTITLEMENT_BLOCKER_SCHEMA_VERSION,
    ownerLane: input.ownerLane,
    actionId: input.actionId,
    action: input.actionName,
    blockerCode: input.reason,
    blockedAction: input.actionName,
    status: "blocked",
    route: input.route,
    requestId: input.requestId,
    entitlementStatus: input.evaluation.policy.status,
    plan: input.evaluation.policy.plan,
    persistedPolicy: input.evaluation.persistedPolicy,
    usage: input.evaluation.usage,
    projectedUsage: input.evaluation.projectedUsage,
    limit: failedCheck ? { code: failedCheck.code, used: failedCheck.used, limit: failedCheck.limit, remaining: failedCheck.remaining } : undefined,
    nextStep: input.nextStep,
    supportText: input.helpdeskText,
    dashboardText: input.dashboardText,
    redactedAudit: redactedLatestAuditEvent(input.evaluation.policy),
    source: input.source
  }];
}

export function buildDwmEntitlementVisibilityBlocker(input: {
  actionId: DwmEntitlementReadinessActionId;
  ownerLane: DwmEntitlementReadinessAction["ownerLane"];
  actionName: string;
  blockerCode: "not_member" | "member_inactive" | "read_only_role" | "organization_visibility_denied";
  route?: string;
  requestId?: string;
  usage?: DwmEntitlementUsage;
  limits?: DwmEntitlementLimits;
}): DwmEntitlementCompatibilityBlocker {
  const emptyUsage = { activeWatchlists: 0, watchTerms: 0, webhookDestinations: 0, sourcePacks: 0, alertRebuildsToday: 0, openCases: 0 };
  return {
    schemaVersion: DWM_ENTITLEMENT_BLOCKER_SCHEMA_VERSION,
    ownerLane: input.ownerLane,
    actionId: input.actionId,
    action: input.actionName,
    blockerCode: input.blockerCode,
    blockedAction: input.actionName,
    status: "blocked",
    route: input.route,
    requestId: input.requestId,
    entitlementStatus: "active",
    plan: "team",
    persistedPolicy: false,
    usage: input.usage ?? emptyUsage,
    projectedUsage: input.usage ?? emptyUsage,
    limit: undefined,
    nextStep: "Resolve organization membership or role visibility before checking entitlement limits.",
    supportText: "Access was denied by organization visibility/RBAC before entitlement evaluation.",
    dashboardText: "Organization access is required before entitlement status can be shown.",
    source: "visibility"
  };
}

export const DWM_ENTITLEMENT_DOWNSTREAM_ADOPTION_SCHEMA_VERSION = "dwm.entitlement_downstream_adoption.v1" as const;

export type DwmEntitlementDownstreamConsumer =
  | "alert-workflow"
  | "webhook"
  | "helpdesk"
  | "product-progress"
  | "public-ti"
  | "analyst-handoff";

export type DwmEntitlementDownstreamAdoptionExample = {
  id:
    | "no_policy_permissive"
    | "plan_limit_exceeded"
    | "projected_usage_exceeded"
    | "nonmember_visibility_denied"
    | "source_growth_denied"
    | "webhook_delivery_denied"
    | "alert_rebuild_denied"
    | "alert_replay_denied"
    | "analyst_handoff_blocked";
  consumers: DwmEntitlementDownstreamConsumer[];
  patchPoint: string;
  route?: string;
  status: DwmEntitlementReadinessAction["status"];
  separation: "entitlement" | "visibility" | "permissive_no_policy" | "analyst_handoff";
  customerSafeText: string;
  supportText: string;
  sample: {
    readinessAction?: Partial<DwmEntitlementReadinessAction>;
    blocker?: DwmEntitlementCompatibilityBlocker;
  };
};

export type DwmEntitlementDownstreamAdoptionContract = {
  schemaVersion: typeof DWM_ENTITLEMENT_DOWNSTREAM_ADOPTION_SCHEMA_VERSION;
  generatedAt: string;
  examples: DwmEntitlementDownstreamAdoptionExample[];
};

export function buildDwmEntitlementDownstreamAdoptionExamples(input: { generatedAt?: string; requestId?: string } = {}): DwmEntitlementDownstreamAdoptionContract {
  const requestId = input.requestId ?? "req-entitlement-adoption-example";
  const evaluation = sampleDwmEntitlementEvaluation();
  const noPolicyAction: Partial<DwmEntitlementReadinessAction> = {
    id: "alert_rebuild",
    ownerLane: "alert-workflow",
    status: "permissive_no_policy",
    entitlementStatus: "active",
    plan: "team",
    persistedPolicy: false,
    blockerCodes: [],
    blockers: [],
    blockedAction: null,
    route: "/v1/dwm/alerts/rebuild",
    nextStep: "Allowed because no persisted entitlement policy exists yet; show this as provisional, not enterprise-ready.",
    helpdeskText: "No persisted entitlement policy applies. Verify contract before presenting production readiness."
  };
  return {
    schemaVersion: DWM_ENTITLEMENT_DOWNSTREAM_ADOPTION_SCHEMA_VERSION,
    generatedAt: input.generatedAt ?? "2026-06-29T00:00:00.000Z",
    examples: [
      {
        id: "no_policy_permissive",
        consumers: ["product-progress", "helpdesk", "alert-workflow"],
        patchPoint: "GET /v1/organizations/:id/entitlements/readiness -> actions.alert_rebuild",
        route: "/v1/dwm/alerts/rebuild",
        status: "permissive_no_policy",
        separation: "permissive_no_policy",
        customerSafeText: "No persisted policy exists, so the backend allows the operation provisionally.",
        supportText: "Do not mark this enterprise-ready; prompt an owner/admin to persist a policy.",
        sample: { readinessAction: noPolicyAction }
      },
      {
        id: "plan_limit_exceeded",
        consumers: ["helpdesk", "product-progress"],
        patchPoint: "GET /v1/organizations/:id/entitlements/readiness -> actions.watchlist_create.blockers[]",
        route: "/v1/dwm/watchlists",
        status: "blocked",
        separation: "entitlement",
        customerSafeText: "The current plan blocks creating another active watchlist.",
        supportText: "Use limit, usage, projectedUsage, requestId, and redactedAudit; do not parse error text.",
        sample: {
          blocker: buildDwmEntitlementCompatibilityBlockers({
            actionId: "watchlist_create",
            ownerLane: "entitlement",
            actionName: "create_dwm_watchlist",
            reason: "active_watchlists",
            evaluation: sampleDwmEntitlementEvaluation({ projectedUsage: { activeWatchlists: 2, watchTerms: 6 } }),
            requestId,
            route: "/v1/dwm/watchlists",
            nextStep: "Review plan limits or remove unused watchlists.",
            helpdeskText: "Limit active_watchlists blocked create_dwm_watchlist.",
            dashboardText: "Active watchlist limit reached.",
            source: "entitlement"
          })[0]
        }
      },
      {
        id: "projected_usage_exceeded",
        consumers: ["public-ti", "product-progress", "helpdesk"],
        patchPoint: "Public TI actionability -> proposed watch terms -> POST /entitlements/readiness",
        route: "/v1/dwm/watchlists",
        status: "blocked",
        separation: "entitlement",
        customerSafeText: "The proposed public-TI watch terms would exceed the contracted term count.",
        supportText: "Use projectedUsage.watchTerms to explain the proposed change without exposing raw terms.",
        sample: {
          blocker: buildDwmEntitlementCompatibilityBlockers({
            actionId: "watchlist_create",
            ownerLane: "entitlement",
            actionName: "create_dwm_watchlist",
            reason: "watch_terms",
            evaluation: sampleDwmEntitlementEvaluation({ projectedUsage: { activeWatchlists: 1, watchTerms: 7 } }),
            requestId,
            route: "/v1/dwm/watchlists",
            nextStep: "Reduce proposed terms or upgrade the plan.",
            helpdeskText: "Projected watch_terms usage exceeds the current plan.",
            dashboardText: "Proposed watch terms exceed the plan.",
            source: "entitlement"
          })[0]
        }
      },
      {
        id: "nonmember_visibility_denied",
        consumers: ["alert-workflow", "webhook", "helpdesk", "product-progress"],
        patchPoint: "Any org-scoped entitlement or workflow route before entitlement evaluation",
        route: "/v1/organizations/:id/entitlements/readiness",
        status: "blocked",
        separation: "visibility",
        customerSafeText: "Organization access is required before entitlement status can be shown.",
        supportText: "Treat this as membership/RBAC denial, not a plan or billing denial.",
        sample: {
          blocker: buildDwmEntitlementVisibilityBlocker({
            actionId: "alert_rebuild",
            ownerLane: "alert-workflow",
            actionName: "rebuild_dwm_alerts",
            blockerCode: "not_member",
            route: "/v1/dwm/alerts/rebuild",
            requestId
          })
        }
      },
      {
        id: "source_growth_denied",
        consumers: ["public-ti", "product-progress", "helpdesk"],
        patchPoint: "DWM source request/action contract -> actions.source_growth.blockers[]",
        route: "/v1/dwm/source-requests",
        status: "blocked",
        separation: "entitlement",
        customerSafeText: "Adding another source pack exceeds the current plan.",
        supportText: "Source growth lane should show source_packs, ownerLane source-growth, and projected usage.",
        sample: {
          blocker: buildDwmEntitlementCompatibilityBlockers({
            actionId: "source_growth",
            ownerLane: "source-growth",
            actionName: "source_growth",
            reason: "source_packs",
            evaluation: sampleDwmEntitlementEvaluation({ projectedUsage: { sourcePacks: 3 } }),
            requestId,
            route: "/v1/dwm/source-requests",
            nextStep: "Disable unused source packs or upgrade source coverage.",
            helpdeskText: "Limit source_packs blocked source_growth.",
            dashboardText: "Source-pack limit reached.",
            source: "entitlement"
          })[0]
        }
      },
      {
        id: "webhook_delivery_denied",
        consumers: ["webhook", "helpdesk", "product-progress"],
        patchPoint: "Webhook delivery/readiness lane -> actions.webhook_delivery.blockers[]",
        route: "/v1/dwm/webhooks/deliver",
        status: "blocked",
        separation: "entitlement",
        customerSafeText: "Webhook delivery is blocked because active destination usage exceeds the current plan.",
        supportText: "Webhook lane should distinguish webhook_destinations from missing_webhook_destination.",
        sample: {
          blocker: buildDwmEntitlementCompatibilityBlockers({
            actionId: "webhook_delivery",
            ownerLane: "webhook",
            actionName: "deliver_dwm_webhook",
            reason: "webhook_destinations",
            evaluation: sampleDwmEntitlementEvaluation({ projectedUsage: { webhookDestinations: 2 } }),
            requestId,
            route: "/v1/dwm/webhooks/deliver",
            nextStep: "Disable an unused destination or upgrade webhook capacity.",
            helpdeskText: "Limit webhook_destinations blocked deliver_dwm_webhook.",
            dashboardText: "Webhook destination limit reached.",
            source: "entitlement"
          })[0]
        }
      },
      {
        id: "alert_rebuild_denied",
        consumers: ["alert-workflow", "product-progress", "helpdesk"],
        patchPoint: "Alert rebuild route 402 payload -> entitlement.blockers[]",
        route: "/v1/dwm/alerts/rebuild",
        status: "blocked",
        separation: "entitlement",
        customerSafeText: "Daily alert rebuild limit reached.",
        supportText: "Denied rebuilds must not mutate alert workflow state.",
        sample: {
          blocker: buildDwmEntitlementCompatibilityBlockers({
            actionId: "alert_rebuild",
            ownerLane: "alert-workflow",
            actionName: "rebuild_dwm_alerts",
            reason: "alert_rebuilds_today",
            evaluation,
            requestId,
            route: "/v1/dwm/alerts/rebuild",
            nextStep: "Wait for the daily window or upgrade rebuild capacity.",
            helpdeskText: "Limit alert_rebuilds_today blocked rebuild_dwm_alerts.",
            dashboardText: "Daily alert rebuild limit reached.",
            source: "entitlement"
          })[0]
        }
      },
      {
        id: "alert_replay_denied",
        consumers: ["alert-workflow", "webhook", "helpdesk"],
        patchPoint: "Alert replay route 402 payload -> entitlement.blockers[]",
        route: "/v1/dwm/alerts/:id/replay",
        status: "blocked",
        separation: "entitlement",
        customerSafeText: "Alert replay is blocked by the same daily rebuild entitlement.",
        supportText: "Replay denial must preserve timeline/case/webhook context and not send a webhook.",
        sample: {
          blocker: buildDwmEntitlementCompatibilityBlockers({
            actionId: "alert_replay",
            ownerLane: "alert-workflow",
            actionName: "replay_dwm_alert",
            reason: "alert_rebuilds_today",
            evaluation,
            requestId,
            route: "/v1/dwm/alerts/:id/replay",
            nextStep: "Wait for the daily window or upgrade rebuild capacity.",
            helpdeskText: "Limit alert_rebuilds_today blocked replay_dwm_alert.",
            dashboardText: "Daily replay limit reached.",
            source: "entitlement"
          })[0]
        }
      },
      {
        id: "analyst_handoff_blocked",
        consumers: ["analyst-handoff", "helpdesk", "product-progress"],
        patchPoint: "POST /v1/organizations/:id/entitlements/readiness with analystHandoffBundle",
        route: "analyst_handoff_consumer",
        status: "blocked",
        separation: "analyst_handoff",
        customerSafeText: "Analyst handoff is waiting for webhook audit plus case and source checks.",
        supportText: "Use analystHandoff.stage, field, and recoverable to route the fix.",
        sample: {
          blocker: {
            schemaVersion: DWM_ENTITLEMENT_BLOCKER_SCHEMA_VERSION,
            ownerLane: "analyst-handoff",
            actionId: "analyst_handoff",
            action: "consume_analyst_handoff",
            blockerCode: "webhook_audit_contract_mismatch",
            blockedAction: "consume_analyst_handoff",
            status: "blocked",
            route: "analyst_handoff_consumer",
            requestId,
            entitlementStatus: "active",
            plan: "custom",
            persistedPolicy: true,
            usage: sampleDwmEntitlementUsage(),
            projectedUsage: sampleDwmEntitlementUsage(),
            nextStep: "Resolve analyst handoff blockers before dispatching case or webhook actions.",
            supportText: "Analyst handoff blocked by webhook_audit_contract_mismatch.",
            dashboardText: "Analyst handoff has webhook audit blockers.",
            source: "analyst_handoff",
            analystHandoff: {
              code: "webhook_audit_contract_mismatch",
              stage: "webhook_audit",
              field: "webhookTrigger.auditEvents",
              recoverable: false
            }
          }
        }
      }
    ]
  };
}

function saveEntitlementPolicy(options: ApiServerOptions, policy: DwmEntitlementPolicy): DwmEntitlementPolicy {
  return (options.store as any).savePlan(policy);
}

function buildEntitlementUsage(options: ApiServerOptions, organization: Organization, excludeWatchlistId?: string): DwmEntitlementUsage {
  const watchlists = ((options.store as any).listDwmWatchlists?.() ?? [])
    .filter((row: any) => row.organizationId === organization.id && row.tenantId === organization.tenantId && row.id !== excludeWatchlistId && row.status === "active");
  const webhookDestinations = ((options.store as any).listWebhookDestinations?.() ?? [])
    .filter((row: any) => row.organizationId === organization.id && row.status === "active");
  const cases = ((options.store as any).listCases?.() ?? [])
    .filter((row: any) => row.organizationId === organization.id && !["closed", "suppressed"].includes(String(row.status ?? "")));
  const sourcePacks = ((options.store as any).listSources?.() ?? [])
    .filter((row: any) => row.organizationId === organization.id || row.tenantId === organization.tenantId || row.metadata?.organizationId === organization.id);
  const alertRebuildsToday = ((options.store as any).listPlans?.() ?? [])
    .filter((row: DwmEntitlementUsageEvent) => row.recordType === "dwm_entitlement_usage_event" && row.action === "alert_rebuild" && row.organizationId === organization.id && sameUtcDay(row.at, nowIso()))
    .length;
  return {
    activeWatchlists: watchlists.length,
    watchTerms: watchlists.reduce((count: number, watchlist: any) => count + (watchlist.terms?.length ?? 0), 0),
    webhookDestinations: webhookDestinations.length,
    sourcePacks: sourcePacks.length,
    alertRebuildsToday,
    openCases: cases.length
  };
}

function entitlementChecks(policy: DwmEntitlementPolicy, usage: DwmEntitlementUsage) {
  return [
    limitCheck("active_watchlists", usage.activeWatchlists, policy.limits.activeWatchlists),
    limitCheck("watch_terms", usage.watchTerms, policy.limits.watchTerms),
    limitCheck("webhook_destinations", usage.webhookDestinations, policy.limits.webhookDestinations),
    limitCheck("source_packs", usage.sourcePacks, policy.limits.sourcePacks),
    limitCheck("alert_rebuilds_today", usage.alertRebuildsToday, policy.limits.alertRebuildsPerDay),
    limitCheck("open_cases", usage.openCases, policy.limits.openCases)
  ];
}

function limitCheck(code: string, used: number, limit: number) {
  return { code, used, limit, remaining: Math.max(0, limit - used), allowed: used <= limit };
}

function sampleDwmEntitlementUsage(overrides: Partial<DwmEntitlementUsage> = {}): DwmEntitlementUsage {
  return {
    activeWatchlists: 1,
    watchTerms: 5,
    webhookDestinations: 1,
    sourcePacks: 2,
    alertRebuildsToday: 1,
    openCases: 1,
    ...overrides
  };
}

function sampleDwmEntitlementEvaluation(input: {
  projectedUsage?: Partial<DwmEntitlementUsage>;
  policyStatus?: DwmEntitlementStatus;
} = {}): DwmEntitlementPolicyEvaluation {
  const usage = sampleDwmEntitlementUsage();
  const limits: DwmEntitlementLimits = {
    activeWatchlists: 1,
    watchTerms: 5,
    webhookDestinations: 1,
    sourcePacks: 2,
    alertRebuildsPerDay: 1,
    openCases: 5
  };
  const organization = {
    id: "org_entitlement_adoption",
    tenantId: "tenant_entitlement_adoption",
    name: "Entitlement Adoption Example",
    createdAt: "2026-06-29T00:00:00.000Z",
    updatedAt: "2026-06-29T00:00:00.000Z"
  } as Organization;
  const policy: DwmEntitlementPolicy = {
    id: "policy_entitlement_adoption",
    recordType: "dwm_entitlement_policy",
    organizationId: organization.id,
    tenantId: organization.tenantId,
    plan: "custom",
    status: input.policyStatus ?? "active",
    limits,
    usageSnapshot: usage,
    createdAt: "2026-06-29T00:00:00.000Z",
    updatedAt: "2026-06-29T00:00:00.000Z",
    updatedBy: { memberId: "member_entitlement_admin", role: "admin" },
    auditTrail: [{
      id: "audit_entitlement_adoption",
      at: "2026-06-29T00:00:00.000Z",
      action: "updated",
      actor: { memberId: "member_entitlement_admin", role: "admin" },
      reason: "Customer-safe entitlement adoption fixture for downstream blocker rendering.",
      requestId: "req-entitlement-adoption-policy",
      changes: { limits }
    }],
    integrationHints: entitlementIntegrationHints(organization)
  };
  const projectedUsage = sampleDwmEntitlementUsage(input.projectedUsage ?? { alertRebuildsToday: 2 });
  return {
    policy,
    status: policy.status,
    persistedPolicy: true,
    usage,
    projectedUsage,
    checks: entitlementChecks(policy, projectedUsage),
    integrationHints: policy.integrationHints
  };
}

function authorizeEntitlementAccess(options: ApiServerOptions, organizationId: string | undefined, request: Request | undefined, body: any, mode: "read" | "mutate", trustedIdentity?: AuthenticatedIdentity) {
  const organization = findOrganization(options, organizationId);
  if (!organization) return { error: json({ error: { code: "organization_not_found", message: "Organization not found." } }, 404) };
  if (trustedIdentity?.roles.some((role) => role === "service" || role === "system_admin")) {
    return { organization, identity: [trustedIdentity.id], access: { allowed: true, reason: null, role: "owner", readOnly: mode === "read" } };
  }
  const members = ((options.store as any).listOrganizationMembers?.() ?? []).filter((row: OrganizationMember) => row.organizationId === organization.id);
  const identity = trustedIdentity ? [trustedIdentity.id.toLowerCase()] : requestIdentity(request, body);
  const member = members.find((row: OrganizationMember) => identityMatchesMember(identity, row));
  if (members.length && !member) return { organization, identity, access: { allowed: false, reason: "not_member" }, error: json({ error: { code: "organization_entitlement_denied", message: "Entitlement access requires organization membership.", reason: "not_member" } }, 403) };
  if (member && !isActiveMember(member)) return { organization, member, identity, access: { allowed: false, reason: "member_inactive", role: member.role }, error: json({ error: { code: "organization_entitlement_denied", message: "Only active organization members can access entitlements.", reason: "member_inactive" } }, 403) };
  const role = String(member?.role ?? "owner");
  if (mode === "mutate" && !["owner", "admin"].includes(role)) return { organization, member, identity, access: { allowed: false, reason: "read_only_role", role }, error: json({ error: { code: "organization_entitlement_read_only", message: "Only organization owners and admins can change entitlements.", reason: "read_only_role" } }, 403) };
  return { organization, member, identity, access: { allowed: true, reason: null, role, readOnly: mode === "read" || !["owner", "admin"].includes(role) } };
}

function entitlementIntegrationHints(organization: Organization): DwmEntitlementIntegrationHints {
  return {
    dashboard: {
      summaryRoute: `/dashboard/subscription?organizationId=${encodeURIComponent(organization.id)}`,
      watchlistRoute: `/dashboard/dwm?organizationId=${encodeURIComponent(organization.id)}`,
      blockedActionCopy: "This organization has reached its DWM entitlement limit. Review plan limits or remove unused watchlists."
    },
    helpdesk: {
      lookupKey: organization.id,
      auditSource: "dwm_entitlement_policy",
      escalationHint: "Check entitlement audit trail, active watchlist usage, and webhook destination count before changing limits."
    }
  };
}

function actionIdFromName(action: string): DwmEntitlementReadinessActionId {
  if (action === "create_dwm_watchlist") return "watchlist_create";
  if (action === "update_dwm_watchlist") return "watchlist_update";
  if (action === "rebuild_dwm_alerts") return "alert_rebuild";
  if (action === "replay_dwm_alert") return "alert_replay";
  if (action === "source_growth") return "source_growth";
  if (action === "deliver_dwm_webhook") return "webhook_delivery";
  return "analyst_handoff";
}

function ownerLaneFromAction(action: string): DwmEntitlementReadinessAction["ownerLane"] {
  if (action === "source_growth") return "source-growth";
  if (action === "deliver_dwm_webhook") return "webhook";
  if (action === "rebuild_dwm_alerts" || action === "replay_dwm_alert") return "alert-workflow";
  if (action === "consume_analyst_handoff") return "analyst-handoff";
  return "entitlement";
}

function routeFromAction(action: string): string | undefined {
  if (action === "create_dwm_watchlist") return "/v1/dwm/watchlists";
  if (action === "update_dwm_watchlist") return "/v1/dwm/watchlists/:id";
  if (action === "rebuild_dwm_alerts") return "/v1/dwm/alerts/rebuild";
  if (action === "replay_dwm_alert") return "/v1/dwm/alerts/:id/replay";
  if (action === "source_growth") return "/v1/dwm/source-requests";
  if (action === "deliver_dwm_webhook") return "/v1/dwm/webhooks/deliver";
  if (action === "consume_analyst_handoff") return "analyst_handoff_consumer";
  return undefined;
}

function findOrganization(options: ApiServerOptions, organizationId: string | undefined): Organization | undefined {
  if (!organizationId) return undefined;
  return (options.store as any).getOrganization?.(organizationId) ?? ((options.store as any).listOrganizations?.() ?? []).find((row: Organization) => row.id === organizationId);
}

function normalizePlan(value: unknown): DwmEntitlementPlan {
  return value === "trial" || value === "portfolio" || value === "enterprise" || value === "custom" ? value : "team";
}

function normalizeStatus(value: unknown): DwmEntitlementStatus {
  return value === "suspended" ? "suspended" : "active";
}

function normalizeLimits(value: unknown, plan: DwmEntitlementPlan, fallback?: DwmEntitlementLimits): DwmEntitlementLimits {
  const source = typeof value === "object" && value ? value as Record<string, unknown> : {};
  const base = fallback ?? planLimits[plan];
  return {
    activeWatchlists: positiveLimit(source.activeWatchlists, base.activeWatchlists),
    watchTerms: positiveLimit(source.watchTerms, base.watchTerms),
    webhookDestinations: positiveLimit(source.webhookDestinations, base.webhookDestinations),
    sourcePacks: positiveLimit(source.sourcePacks, base.sourcePacks),
    alertRebuildsPerDay: positiveLimit(source.alertRebuildsPerDay, base.alertRebuildsPerDay),
    openCases: positiveLimit(source.openCases, base.openCases)
  };
}

function positiveLimit(value: unknown, fallback: number): number {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function memberActor(member: OrganizationMember | undefined, fallbackIdentity: string | undefined) {
  return {
    memberId: member?.id,
    email: member?.email ?? (fallbackIdentity?.includes("@") ? fallbackIdentity : undefined),
    userId: member?.userId ?? (!fallbackIdentity?.includes("@") ? fallbackIdentity : undefined),
    role: member?.role
  };
}

function requestIdentity(request: Request | undefined, body?: any): string[] {
  const sessionId = normalizeIdentity(request?.headers.get("id"));
  if (sessionId && request?.headers.get("authorization")?.startsWith("Bearer ")) return [sessionId];

  return [
    request?.headers.get("id"),
    request?.headers.get("x-user-email"),
    request?.headers.get("x-user-id"),
    request?.headers.get("x-actor-id"),
    body?.userEmail,
    body?.userId,
    body?.actorEmail,
    body?.actor
  ].map(normalizeIdentity).filter(Boolean) as string[];
}

function normalizeReadinessTerms(value: unknown): Array<{ value: string }> | undefined {
  const raw = Array.isArray(value) ? value : String(value ?? "").split(/[,\n]/);
  const terms = raw
    .map((item: any) => typeof item === "object" && item ? String(item.value ?? item.term ?? "").trim() : String(item ?? "").trim())
    .filter(Boolean)
    .map((value) => ({ value }));
  return terms.length ? terms : undefined;
}

function identityMatchesMember(identity: string[], member: OrganizationMember): boolean {
  const candidates = [member.id, member.email, member.userId].map(normalizeIdentity).filter(Boolean);
  return candidates.some((candidate) => identity.includes(candidate as string));
}

function normalizeIdentity(value: unknown): string | undefined {
  const identity = String(value ?? "").trim().toLowerCase();
  return identity || undefined;
}

function isActiveMember(member: OrganizationMember): boolean {
  return member.status === "active" && (member as any).userActive !== false && (member as any).active !== false && !(member as any).deactivatedAt;
}

function dropUndefined(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function redactedLatestAuditEvent(policy: DwmEntitlementPolicy) {
  const latest = policy.auditTrail.at(-1);
  if (!latest) return undefined;
  return {
    at: latest.at,
    action: latest.action,
    requestId: latest.requestId,
    actor: {
      memberId: latest.actor?.memberId,
      role: latest.actor?.role
    },
    reasonPreview: latest.reason.slice(0, 160)
  };
}

function sameUtcDay(left: string | undefined, right: string): boolean {
  return String(left ?? "").slice(0, 10) === right.slice(0, 10);
}
