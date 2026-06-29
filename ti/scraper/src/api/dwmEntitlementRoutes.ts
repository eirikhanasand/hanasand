import { nowIso, stableId } from "../utils.ts";
import { json, readJson } from "./http.ts";
import type { Organization, OrganizationMember } from "./organizationRoutes.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

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

const planLimits: Record<DwmEntitlementPlan, DwmEntitlementLimits> = {
  trial: { activeWatchlists: 1, watchTerms: 5, webhookDestinations: 1, sourcePacks: 2, alertRebuildsPerDay: 5, openCases: 10 },
  team: { activeWatchlists: 10, watchTerms: 250, webhookDestinations: 5, sourcePacks: 25, alertRebuildsPerDay: 100, openCases: 100 },
  portfolio: { activeWatchlists: 50, watchTerms: 1500, webhookDestinations: 20, sourcePacks: 100, alertRebuildsPerDay: 500, openCases: 500 },
  enterprise: { activeWatchlists: 250, watchTerms: 10000, webhookDestinations: 100, sourcePacks: 500, alertRebuildsPerDay: 5000, openCases: 5000 },
  custom: { activeWatchlists: 10, watchTerms: 250, webhookDestinations: 5, sourcePacks: 25, alertRebuildsPerDay: 100, openCases: 100 }
};

export function getOrganizationEntitlements(_url: URL, options: ApiServerOptions, organizationId: string | undefined, request?: Request): Response {
  const access = authorizeEntitlementAccess(options, organizationId, request, undefined, "read");
  if (access.error) return access.error;
  const policy = getOrDefaultEntitlementPolicy(options, access.organization);
  return json({ organization: access.organization, access: access.access, entitlement: policy, evaluation: evaluateDwmEntitlementPolicy(options, access.organization, policy) });
}

export async function upsertOrganizationEntitlements(request: Request, options: ApiServerOptions, organizationId: string | undefined): Promise<Response> {
  const body = await readJson<any>(request);
  const access = authorizeEntitlementAccess(options, organizationId, request, body, "mutate");
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
    }
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
  return {
    activeWatchlists: watchlists.length,
    watchTerms: watchlists.reduce((count: number, watchlist: any) => count + (watchlist.terms?.length ?? 0), 0),
    webhookDestinations: webhookDestinations.length,
    sourcePacks: sourcePacks.length,
    alertRebuildsToday: 0,
    openCases: cases.length
  };
}

function entitlementChecks(policy: DwmEntitlementPolicy, usage: DwmEntitlementUsage) {
  return [
    limitCheck("active_watchlists", usage.activeWatchlists, policy.limits.activeWatchlists),
    limitCheck("watch_terms", usage.watchTerms, policy.limits.watchTerms),
    limitCheck("webhook_destinations", usage.webhookDestinations, policy.limits.webhookDestinations),
    limitCheck("source_packs", usage.sourcePacks, policy.limits.sourcePacks),
    limitCheck("open_cases", usage.openCases, policy.limits.openCases)
  ];
}

function limitCheck(code: string, used: number, limit: number) {
  return { code, used, limit, remaining: Math.max(0, limit - used), allowed: used <= limit };
}

function authorizeEntitlementAccess(options: ApiServerOptions, organizationId: string | undefined, request: Request | undefined, body: any, mode: "read" | "mutate") {
  const organization = findOrganization(options, organizationId);
  if (!organization) return { error: json({ error: { code: "organization_not_found", message: "Organization not found." } }, 404) };
  const members = ((options.store as any).listOrganizationMembers?.() ?? []).filter((row: OrganizationMember) => row.organizationId === organization.id);
  const identity = requestIdentity(request, body);
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
  return [
    request?.headers.get("x-user-email"),
    request?.headers.get("x-user-id"),
    request?.headers.get("x-actor-id"),
    body?.userEmail,
    body?.userId,
    body?.actorEmail,
    body?.actor
  ].map(normalizeIdentity).filter(Boolean) as string[];
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
