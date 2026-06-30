import type { DwmWatchTerm } from "../product/dwmProduct.ts";
import { stableId, uniqueStrings } from "../utils.ts";
import type { RuntimeDwmWatchlist } from "./dwmAlertRepository.ts";

export type OrgWatchlistTermFamily = "company" | "domain" | "vendor" | "actor" | "keyword";
export type OrgWatchlistStatus = "active" | "paused" | "archived";
export type OrgAlertVisibilityPolicy = "members" | "admins" | "owners";
export type OrgWatchlistExportRole = "owner" | "admin" | "analyst" | "member" | "viewer" | "support" | "nonmember";

export type OrgWatchlistContractTerm = {
  watchlistId?: string;
  watchlistItemId?: string;
  itemId?: string;
  organizationId?: string;
  tenantId?: string;
  kind?: OrgWatchlistTermFamily;
  termFamily?: OrgWatchlistTermFamily;
  family?: OrgWatchlistTermFamily;
  category?: OrgWatchlistTermFamily;
  term?: string;
  value?: string;
  terms?: string[];
  status?: OrgWatchlistStatus;
  createdBy?: string;
  updatedBy?: string | null;
  lifecycleReason?: string | null;
  lifecycleRequestId?: string | null;
  alertGeneratorKey?: string;
  alertGenerationRef?: OrgWatchlistAlertGenerationRef;
  alertGenerationReference?: {
    schemaVersion?: "organization.watchlist_item_alert_reference.v1" | string;
    organizationId?: string;
    tenantId?: string;
    watchlistItemId?: string;
    itemId?: string;
    termFamily?: OrgWatchlistTermFamily | string;
    category?: OrgWatchlistTermFamily | string;
    term?: string;
    status?: OrgWatchlistStatus | string;
  };
};

export type OrgWatchlistAlertGenerationRef = {
  schemaVersion?: "organization.watchlist_alert_generation_ref.v1" | string;
  source?: "organization_shared_watchlist" | string;
  organizationId?: string;
  tenantId?: string;
  ownerOrganizationId?: string;
  watchlistId?: string;
  watchlistItemId?: string;
  itemId?: string;
  termFamily?: OrgWatchlistTermFamily | string;
  category?: OrgWatchlistTermFamily | string;
  term?: string;
  normalizedTerm?: string;
  status?: OrgWatchlistStatus | string;
  lifecycle?: {
    status?: OrgWatchlistStatus | string;
    reason?: string | null;
    requestId?: string | null;
    createdBy?: string;
    updatedBy?: string | null;
  };
  dedupe?: {
    scope?: "organization_watchlist_term" | string;
    key?: string;
    parts?: {
      organizationId?: string;
      tenantId?: string;
      watchlistItemId?: string;
      termFamily?: OrgWatchlistTermFamily | string;
      normalizedTerm?: string;
    };
  };
};

export type OrgWatchlistAlertGenerationContractLike = {
  schemaVersion?: string;
  organizationId: string;
  tenantId?: string;
  ownerOrganizationId?: string;
  downstreamAuthorization?: {
    schemaVersion?: string;
    organizationLifecycleState?: "active" | "archived" | "deleted" | string;
    visibility?: {
      allowed?: boolean;
      reason?: string | null;
      allowedRoles?: string[];
    };
    downstream?: {
      alertGeneration?: {
        canExportActiveTerms?: boolean;
        blockerCodes?: string[];
      };
    };
    watchlists?: {
      activeIds?: string[];
      pausedIds?: string[];
      archivedIds?: string[];
    };
    lifecycleDenials?: Record<string, string>;
  };
  entitlementStatus?: "active" | "suspended" | string;
  visibilityPolicy?: OrgAlertVisibilityPolicy;
  allowedViewerRoles?: string[];
  activeTerms?: OrgWatchlistContractTerm[];
  activeWatchlistTerms?: OrgWatchlistContractTerm[];
  watchlistTerms?: OrgWatchlistContractTerm[];
  terms?: OrgWatchlistContractTerm[];
  termFamilies?: string[];
  blockedReasons?: string[];
  canGenerateAlerts?: boolean;
};

export type OrgWatchlistExportMember = {
  id?: string;
  memberId?: string;
  userId?: string;
  email?: string;
  role?: OrgWatchlistExportRole | string;
  status?: "active" | "invited" | "removed" | "disabled" | string;
  userActive?: boolean;
};

export type OrgSharedWatchlistAlertGenerationExport = {
  schemaVersion: "organization.shared_watchlist_alert_generation_export.v1";
  id: string;
  generatedAt: string;
  organizationId: string;
  tenantId: string;
  state: "ready" | "blocked";
  ownerLane: "org_foundation" | "watchlist" | "alert_generation";
  visibilityPolicy: OrgAlertVisibilityPolicy;
  member: {
    role: OrgWatchlistExportRole;
    status: "active" | "invited" | "removed" | "disabled" | "unknown";
    userId?: string;
    email?: string;
    allowed: boolean;
    readOnly: boolean;
  };
  termExport: {
    activeTermCount: number;
    exportedWatchlistCount: number;
    duplicateCollapseCount: number;
    skippedTermCount: number;
    watchlistIds: string[];
    watchlistItemIds: string[];
    alertGeneratorKeys: string[];
  };
  blockers: Array<{
    code:
      | "missing_org_scope"
      | "not_member"
      | "member_inactive"
      | "role_not_allowed"
      | "visibility_denied"
      | "org_lifecycle_blocked"
      | "alert_generation_export_blocked"
      | "term_org_mismatch"
      | "no_active_watchlist_terms";
    ownerLane: "org_foundation" | "watchlist" | "alert_generation";
    path: string;
    detail: string;
    recoverable: boolean;
    watchlistItemId?: string;
  }>;
  runtimeWatchlists: RuntimeDwmWatchlist[];
  consumerContracts: {
    schemaVersion: "organization.shared_watchlist_alert_generation_consumers.v1";
    alertGeneration: {
      canConsume: boolean;
      route: "/v1/dwm/alerts/generation-readiness";
      stableFields: string[];
      blockerFields: string[];
    };
    dashboard: {
      canConsume: boolean;
      route: "/v1/dwm/watchlists";
      stableFields: string[];
      blockerFields: string[];
    };
    webhook: {
      canConsume: boolean;
      route: "/v1/dwm/webhooks/deliver";
      stableFields: string[];
      blockerFields: string[];
    };
  };
  safeOutput: {
    nonmemberEnumeration: false;
    rawTargetsExposed: false;
    privateSourceContentExposed: false;
  };
};

export type RuntimeOrgWatchlistTermContext = {
  watchlistId: string;
  watchlistItemId: string;
  itemId: string;
  organizationId: string;
  tenantId: string;
  term: string;
  value: string;
  normalizedTerm: string;
  terms: string[];
  kind: OrgWatchlistTermFamily;
  category: OrgWatchlistTermFamily;
  termFamily: OrgWatchlistTermFamily;
  status: OrgWatchlistStatus;
  createdBy?: string;
  updatedBy?: string | null;
  lifecycleReason?: string | null;
  lifecycleRequestId?: string | null;
  alertGeneratorKey: string;
  alertGenerationRef: Required<Pick<OrgWatchlistAlertGenerationRef, "schemaVersion" | "source" | "organizationId" | "tenantId" | "ownerOrganizationId" | "watchlistId" | "watchlistItemId" | "itemId" | "termFamily" | "category" | "term" | "normalizedTerm" | "status">> & {
    lifecycle: NonNullable<OrgWatchlistAlertGenerationRef["lifecycle"]>;
    dedupe: NonNullable<OrgWatchlistAlertGenerationRef["dedupe"]> & {
      key: string;
      parts: NonNullable<NonNullable<OrgWatchlistAlertGenerationRef["dedupe"]>["parts"]>;
    };
  };
};

export type RuntimeOrgMembershipContext = {
  schemaVersion: "organization.watchlist_alert_generation.v1";
  organizationId: string;
  tenantId: string;
  ownerOrganizationId: string;
  entitlementStatus: "active" | "suspended";
  visibilityPolicy: OrgAlertVisibilityPolicy;
  allowedViewerRoles: string[];
  canGenerateAlerts: boolean;
  blockedReasons: string[];
  organizationLifecycleState: "active" | "archived" | "deleted";
  alertGenerationBlockerCodes: string[];
};

export function orgWatchlistContractToRuntimeDwmWatchlists(contract: OrgWatchlistAlertGenerationContractLike): RuntimeDwmWatchlist[] {
  const membershipContext = orgMembershipContext(contract);
  const terms = orgWatchlistTermsFromContract(contract);
  if (!terms.length && membershipContext.alertGenerationBlockerCodes.length) {
    return [{
      id: `org_export_blocked:${membershipContext.organizationId}`,
      tenantId: membershipContext.tenantId,
      organizationId: membershipContext.organizationId,
      lifecycleStatus: membershipContext.organizationLifecycleState === "active" ? "paused" : "archived",
      terms: [],
      status: "paused",
      orgWatchlistTerms: [],
      orgMembershipContext: membershipContext
    } as RuntimeDwmWatchlist];
  }

  return terms.map((term) => {
    const context = orgWatchlistTermContext(term, membershipContext);
    return {
      id: context.watchlistId,
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      lifecycleStatus: context.status,
      terms: [{
        id: context.watchlistItemId,
        value: context.value,
        kind: dwmWatchKindForOrgTerm(context.kind)
      } as DwmWatchTerm & { id: string }],
      status: membershipContext.canGenerateAlerts && context.status === "active" ? "active" : "paused",
      orgWatchlistTerms: [context],
      orgMembershipContext: membershipContext
    } as RuntimeDwmWatchlist;
  });
}

export function buildOrgSharedWatchlistAlertGenerationExport(input: {
  contract: OrgWatchlistAlertGenerationContractLike;
  member?: OrgWatchlistExportMember | null;
  generatedAt?: string;
}): OrgSharedWatchlistAlertGenerationExport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const membershipContext = orgMembershipContext(input.contract);
  const member = normalizeExportMember(input.member);
  const termExportRows = orgWatchlistTermsFromContract(input.contract)
    .map((term) => orgWatchlistTermContext(term, membershipContext));
  const activeTerms = termExportRows.filter((term) => term.status === "active");
  const scopedTerms = activeTerms.filter((term) => term.organizationId === membershipContext.organizationId && term.tenantId === membershipContext.tenantId);
  const duplicateCollapsedTerms = uniqueOrgWatchlistTermContexts(scopedTerms);
  const termBlockers = activeTerms
    .filter((term) => term.organizationId !== membershipContext.organizationId || term.tenantId !== membershipContext.tenantId)
    .map((term) => orgWatchlistExportBlocker(
      "term_org_mismatch",
      "watchlist",
      "watchlistTerms[].organizationId",
      "Watchlist term belongs to a different organization or tenant.",
      true,
      term.watchlistItemId
    ));
  const blockers = uniqueOrgWatchlistExportBlockers([
    !membershipContext.organizationId ? orgWatchlistExportBlocker("missing_org_scope", "org_foundation", "organizationId", "Organization scope is required for shared watchlist alert export.", true) : undefined,
    member.role === "nonmember" ? orgWatchlistExportBlocker("not_member", "org_foundation", "member", "An active organization member is required to export shared watchlist terms.", true) : undefined,
    member.role !== "nonmember" && member.status !== "active" ? orgWatchlistExportBlocker("member_inactive", "org_foundation", "member.status", "Inactive or invited members cannot export shared watchlist terms.", true) : undefined,
    !orgWatchlistExportRoleAllowed(member.role) ? orgWatchlistExportBlocker("role_not_allowed", "org_foundation", "member.role", "This organization role cannot export shared watchlist terms for alert generation.", true) : undefined,
    input.contract.downstreamAuthorization?.visibility?.allowed === false ? orgWatchlistExportBlocker("visibility_denied", "org_foundation", "downstreamAuthorization.visibility", "Organization visibility policy denied this member.", true) : undefined,
    membershipContext.organizationLifecycleState !== "active" ? orgWatchlistExportBlocker("org_lifecycle_blocked", "org_foundation", "organization.status", "Organization lifecycle is not active.", membershipContext.organizationLifecycleState !== "deleted") : undefined,
    membershipContext.canGenerateAlerts === false ? orgWatchlistExportBlocker("alert_generation_export_blocked", "alert_generation", "downstreamAuthorization.downstream.alertGeneration", "Downstream alert generation export is blocked.", true) : undefined,
    !duplicateCollapsedTerms.length ? orgWatchlistExportBlocker("no_active_watchlist_terms", "watchlist", "watchlistTerms", "No active shared watchlist terms are exportable for this organization.", true) : undefined,
    ...termBlockers
  ]);
  const canExport = blockers.length === 0;
  const runtimeWatchlists = canExport
    ? orgWatchlistContractToRuntimeDwmWatchlists({
      ...input.contract,
      activeTerms: duplicateCollapsedTerms,
      activeWatchlistTerms: [],
      watchlistTerms: [],
      terms: []
    }).filter((watchlist) => watchlist.status === "active")
    : [];
  const state: OrgSharedWatchlistAlertGenerationExport["state"] = canExport ? "ready" : "blocked";
  return {
    schemaVersion: "organization.shared_watchlist_alert_generation_export.v1",
    id: stableId("organization_shared_watchlist_alert_export", `${membershipContext.tenantId}:${membershipContext.organizationId}:${member.userId ?? member.email ?? member.role}:${generatedAt}:${state}`),
    generatedAt,
    organizationId: membershipContext.organizationId,
    tenantId: membershipContext.tenantId,
    state,
    ownerLane: blockers[0]?.ownerLane ?? "alert_generation",
    visibilityPolicy: membershipContext.visibilityPolicy,
    member: {
      role: member.role,
      status: member.status,
      userId: member.userId,
      email: member.email,
      allowed: canExport,
      readOnly: member.role === "viewer" || member.role === "support"
    },
    termExport: {
      activeTermCount: activeTerms.length,
      exportedWatchlistCount: runtimeWatchlists.length,
      duplicateCollapseCount: Math.max(0, scopedTerms.length - duplicateCollapsedTerms.length),
      skippedTermCount: termExportRows.length - duplicateCollapsedTerms.length,
      watchlistIds: uniqueStrings(runtimeWatchlists.map((watchlist) => watchlist.id)),
      watchlistItemIds: uniqueStrings(duplicateCollapsedTerms.map((term) => term.watchlistItemId)),
      alertGeneratorKeys: uniqueStrings(duplicateCollapsedTerms.map((term) => term.alertGeneratorKey))
    },
    blockers,
    runtimeWatchlists,
    consumerContracts: {
      schemaVersion: "organization.shared_watchlist_alert_generation_consumers.v1",
      alertGeneration: {
        canConsume: canExport,
        route: "/v1/dwm/alerts/generation-readiness",
        stableFields: ["runtimeWatchlists", "termExport.alertGeneratorKeys", "termExport.watchlistItemIds"],
        blockerFields: ["blockers.code", "blockers.path", "blockers.watchlistItemId"]
      },
      dashboard: {
        canConsume: true,
        route: "/v1/dwm/watchlists",
        stableFields: ["state", "member.role", "termExport"],
        blockerFields: ["blockers.code", "blockers.detail"]
      },
      webhook: {
        canConsume: canExport,
        route: "/v1/dwm/webhooks/deliver",
        stableFields: ["runtimeWatchlists[].webhookDestinationId", "termExport.alertGeneratorKeys"],
        blockerFields: ["blockers.code", "blockers.ownerLane"]
      }
    },
    safeOutput: {
      nonmemberEnumeration: false,
      rawTargetsExposed: false,
      privateSourceContentExposed: false
    }
  };
}

export function orgWatchlistTermsFromContract(contract: OrgWatchlistAlertGenerationContractLike): OrgWatchlistContractTerm[] {
  const terms = [
    ...(contract.activeTerms ?? []),
    ...(contract.activeWatchlistTerms ?? []),
    ...(contract.watchlistTerms ?? []),
    ...(contract.terms ?? [])
  ].filter((term) => Boolean(normalizeTermValue(term)));
  const byKey = new Map<string, OrgWatchlistContractTerm>();
  for (const term of terms) {
    const key = String(term.alertGenerationRef?.watchlistItemId ?? term.alertGenerationReference?.watchlistItemId ?? term.watchlistItemId ?? term.itemId ?? `${normalizeOrgTermKind(term.termFamily ?? term.category ?? term.kind ?? term.family)}:${normalizeTermValue(term).toLowerCase()}`);
    const existing = byKey.get(key);
    if (!existing || (!existing.alertGenerationRef && term.alertGenerationRef)) byKey.set(key, term);
  }
  return [...byKey.values()];
}

function normalizeExportMember(member: OrgWatchlistExportMember | null | undefined): {
  role: OrgWatchlistExportRole;
  status: OrgSharedWatchlistAlertGenerationExport["member"]["status"];
  userId?: string;
  email?: string;
} {
  const role = normalizeExportRole(member?.role);
  const status = normalizeExportMemberStatus(member);
  return {
    role,
    status,
    userId: member?.userId ? String(member.userId) : member?.id ? String(member.id) : member?.memberId ? String(member.memberId) : undefined,
    email: member?.email ? String(member.email).toLowerCase() : undefined
  };
}

function normalizeExportRole(value: unknown): OrgWatchlistExportRole {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "owner" || normalized === "admin" || normalized === "analyst" || normalized === "member" || normalized === "viewer" || normalized === "support") return normalized;
  return "nonmember";
}

function normalizeExportMemberStatus(member: OrgWatchlistExportMember | null | undefined): OrgSharedWatchlistAlertGenerationExport["member"]["status"] {
  if (!member) return "unknown";
  if (member.userActive === false) return "disabled";
  const normalized = String(member.status ?? "active").trim().toLowerCase();
  if (normalized === "active" || normalized === "invited" || normalized === "removed" || normalized === "disabled") return normalized;
  return "unknown";
}

function orgWatchlistExportRoleAllowed(role: OrgWatchlistExportRole): boolean {
  return role === "owner" || role === "admin" || role === "analyst" || role === "member";
}

function orgWatchlistExportBlocker(
  code: OrgSharedWatchlistAlertGenerationExport["blockers"][number]["code"],
  ownerLane: OrgSharedWatchlistAlertGenerationExport["blockers"][number]["ownerLane"],
  path: string,
  detail: string,
  recoverable: boolean,
  watchlistItemId?: string
): OrgSharedWatchlistAlertGenerationExport["blockers"][number] {
  return { code, ownerLane, path, detail, recoverable, watchlistItemId };
}

function uniqueOrgWatchlistExportBlockers(
  blockers: Array<OrgSharedWatchlistAlertGenerationExport["blockers"][number] | undefined>
): OrgSharedWatchlistAlertGenerationExport["blockers"] {
  const seen = new Set<string>();
  return blockers.filter((blocker): blocker is OrgSharedWatchlistAlertGenerationExport["blockers"][number] => {
    if (!blocker) return false;
    const key = `${blocker.code}:${blocker.path}:${blocker.watchlistItemId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueOrgWatchlistTermContexts(terms: RuntimeOrgWatchlistTermContext[]): RuntimeOrgWatchlistTermContext[] {
  const byKey = new Map<string, RuntimeOrgWatchlistTermContext>();
  for (const term of terms) {
    const key = term.alertGenerationRef.dedupe.key;
    if (!byKey.has(key)) byKey.set(key, term);
  }
  return [...byKey.values()];
}

function orgMembershipContext(contract: OrgWatchlistAlertGenerationContractLike): RuntimeOrgMembershipContext {
  const organizationId = String(contract.organizationId);
  const tenantId = String(contract.tenantId ?? contract.organizationId);
  const organizationLifecycleState = normalizeOrgLifecycleState(contract.downstreamAuthorization?.organizationLifecycleState);
  const downstreamBlockers = contract.downstreamAuthorization?.downstream?.alertGeneration?.blockerCodes?.map(String).filter(Boolean) ?? [];
  const blockedReasons = uniqueStrings([
    ...(contract.blockedReasons ?? []).map(String),
    ...downstreamBlockers,
    organizationLifecycleState !== "active" ? `org_${organizationLifecycleState}` : undefined,
    contract.downstreamAuthorization?.visibility?.allowed === false ? String(contract.downstreamAuthorization.visibility.reason ?? "role_not_allowed") : undefined
  ].filter(Boolean).map(String));
  const downstreamCanExport = contract.downstreamAuthorization?.downstream?.alertGeneration?.canExportActiveTerms;
  return {
    schemaVersion: "organization.watchlist_alert_generation.v1",
    organizationId,
    tenantId,
    ownerOrganizationId: String(contract.ownerOrganizationId ?? organizationId),
    entitlementStatus: normalizeEntitlementStatus(contract.entitlementStatus),
    visibilityPolicy: normalizeVisibilityPolicy(contract.visibilityPolicy),
    allowedViewerRoles: contract.allowedViewerRoles?.map((role) => String(role)).filter(Boolean)
      ?? contract.downstreamAuthorization?.visibility?.allowedRoles?.map(String).filter(Boolean)
      ?? ["owner", "admin", "member", "viewer"],
    canGenerateAlerts: contract.canGenerateAlerts !== false && downstreamCanExport !== false && organizationLifecycleState === "active",
    blockedReasons,
    organizationLifecycleState,
    alertGenerationBlockerCodes: blockedReasons
  };
}

function orgWatchlistTermContext(term: OrgWatchlistContractTerm, membership: RuntimeOrgMembershipContext): RuntimeOrgWatchlistTermContext {
  const value = normalizeTermValue(term);
  const kind = normalizeOrgTermKind(term.alertGenerationRef?.termFamily ?? term.alertGenerationReference?.termFamily ?? term.termFamily ?? term.category ?? term.kind ?? term.family);
  const watchlistItemId = String(term.alertGenerationRef?.watchlistItemId ?? term.alertGenerationReference?.watchlistItemId ?? term.watchlistItemId ?? term.itemId ?? stableId("org_watchlist_item", `${membership.organizationId}:${kind}:${value}`));
  const watchlistId = String(term.watchlistId ?? term.alertGenerationRef?.watchlistId ?? watchlistItemId);
  const normalizedTerm = String(term.alertGenerationRef?.normalizedTerm ?? value).trim().toLowerCase();
  const lifecycleReason = term.lifecycleReason ?? term.alertGenerationRef?.lifecycle?.reason ?? null;
  const lifecycleRequestId = term.lifecycleRequestId ?? term.alertGenerationRef?.lifecycle?.requestId ?? null;
  const createdBy = term.createdBy ?? term.alertGenerationRef?.lifecycle?.createdBy;
  const updatedBy = term.updatedBy === undefined ? term.alertGenerationRef?.lifecycle?.updatedBy : term.updatedBy;
  const status = normalizeOrgStatus(term.alertGenerationRef?.status ?? term.status);
  const category = normalizeOrgTermKind(term.alertGenerationRef?.category ?? term.alertGenerationReference?.category ?? term.category ?? kind);
  const termFamily = normalizeOrgTermKind(term.alertGenerationRef?.termFamily ?? term.alertGenerationReference?.termFamily ?? term.termFamily ?? kind);
  const itemId = String(term.alertGenerationRef?.itemId ?? term.alertGenerationReference?.itemId ?? term.itemId ?? watchlistItemId);
  const alertGeneratorKey = String(term.alertGeneratorKey ?? term.alertGenerationRef?.dedupe?.key ?? `org:${membership.organizationId}:watchlist:${watchlistItemId}:${termFamily}:${normalizedTerm}`);
  return {
    watchlistId,
    watchlistItemId,
    itemId,
    organizationId: String(term.alertGenerationRef?.organizationId ?? term.alertGenerationReference?.organizationId ?? term.organizationId ?? membership.organizationId),
    tenantId: String(term.alertGenerationRef?.tenantId ?? term.alertGenerationReference?.tenantId ?? term.tenantId ?? membership.tenantId),
    term: value,
    value,
    normalizedTerm,
    terms: Array.isArray(term.terms) && term.terms.length ? term.terms.map(String) : [value],
    kind,
    category,
    termFamily,
    status,
    createdBy: createdBy ? String(createdBy) : undefined,
    updatedBy: updatedBy === null ? null : updatedBy ? String(updatedBy) : undefined,
    lifecycleReason,
    lifecycleRequestId,
    alertGeneratorKey,
    alertGenerationRef: {
      schemaVersion: "organization.watchlist_alert_generation_ref.v1",
      source: "organization_shared_watchlist",
      organizationId: String(term.alertGenerationRef?.organizationId ?? term.alertGenerationReference?.organizationId ?? term.organizationId ?? membership.organizationId),
      tenantId: String(term.alertGenerationRef?.tenantId ?? term.alertGenerationReference?.tenantId ?? term.tenantId ?? membership.tenantId),
      ownerOrganizationId: String(term.alertGenerationRef?.ownerOrganizationId ?? membership.ownerOrganizationId),
      watchlistId,
      watchlistItemId,
      itemId,
      termFamily,
      category,
      term: value,
      normalizedTerm,
      status,
      lifecycle: {
        status,
        reason: lifecycleReason,
        requestId: lifecycleRequestId,
        createdBy: createdBy ? String(createdBy) : undefined,
        updatedBy: updatedBy === null ? null : updatedBy ? String(updatedBy) : undefined
      },
      dedupe: {
        scope: "organization_watchlist_term",
        key: alertGeneratorKey,
        parts: {
          organizationId: String(term.alertGenerationRef?.dedupe?.parts?.organizationId ?? term.alertGenerationRef?.organizationId ?? term.organizationId ?? membership.organizationId),
          tenantId: String(term.alertGenerationRef?.dedupe?.parts?.tenantId ?? term.alertGenerationRef?.tenantId ?? term.tenantId ?? membership.tenantId),
          watchlistItemId: String(term.alertGenerationRef?.dedupe?.parts?.watchlistItemId ?? watchlistItemId),
          termFamily: normalizeOrgTermKind(term.alertGenerationRef?.dedupe?.parts?.termFamily ?? termFamily),
          normalizedTerm: String(term.alertGenerationRef?.dedupe?.parts?.normalizedTerm ?? normalizedTerm)
        }
      }
    }
  };
}

function normalizeTermValue(term: OrgWatchlistContractTerm): string {
  return String(term.alertGenerationRef?.term ?? term.alertGenerationReference?.term ?? term.value ?? term.term ?? term.terms?.[0] ?? "").trim();
}

function normalizeOrgTermKind(value: unknown): OrgWatchlistTermFamily {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "company" || normalized === "domain" || normalized === "vendor" || normalized === "actor" || normalized === "keyword"
    ? normalized
    : "keyword";
}

function normalizeOrgStatus(value: unknown): OrgWatchlistStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "paused" || normalized === "archived" ? normalized : "active";
}

function normalizeVisibilityPolicy(value: unknown): OrgAlertVisibilityPolicy {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "admins" || normalized === "owners" ? normalized : "members";
}

function normalizeEntitlementStatus(value: unknown): "active" | "suspended" {
  return String(value ?? "").trim().toLowerCase() === "suspended" ? "suspended" : "active";
}

function normalizeOrgLifecycleState(value: unknown): "active" | "archived" | "deleted" {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "archived" || normalized === "deleted" ? normalized : "active";
}

function dwmWatchKindForOrgTerm(kind: OrgWatchlistTermFamily): DwmWatchTerm["kind"] {
  if (kind === "company" || kind === "domain" || kind === "vendor") return kind;
  return "unknown";
}
