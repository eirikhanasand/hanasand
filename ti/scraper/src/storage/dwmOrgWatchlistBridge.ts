import type { DwmWatchTerm } from "../product/dwmProduct.ts";
import { stableId } from "../utils.ts";
import type { RuntimeDwmWatchlist } from "./dwmAlertRepository.ts";

export type OrgWatchlistTermFamily = "company" | "domain" | "vendor" | "actor" | "keyword";
export type OrgWatchlistStatus = "active" | "paused" | "archived";
export type OrgAlertVisibilityPolicy = "members" | "admins" | "owners";

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
};

export type OrgWatchlistAlertGenerationContractLike = {
  schemaVersion?: string;
  organizationId: string;
  tenantId?: string;
  ownerOrganizationId?: string;
  entitlementStatus?: "active" | "suspended" | string;
  visibilityPolicy?: OrgAlertVisibilityPolicy;
  allowedViewerRoles?: string[];
  activeWatchlistTerms?: OrgWatchlistContractTerm[];
  watchlistTerms?: OrgWatchlistContractTerm[];
  terms?: OrgWatchlistContractTerm[];
  termFamilies?: string[];
  blockedReasons?: string[];
  canGenerateAlerts?: boolean;
};

export type RuntimeOrgWatchlistTermContext = {
  watchlistId: string;
  watchlistItemId: string;
  itemId: string;
  organizationId: string;
  tenantId: string;
  term: string;
  value: string;
  terms: string[];
  kind: OrgWatchlistTermFamily;
  category: OrgWatchlistTermFamily;
  termFamily: OrgWatchlistTermFamily;
  status: OrgWatchlistStatus;
  createdBy?: string;
  updatedBy?: string | null;
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
};

export function orgWatchlistContractToRuntimeDwmWatchlists(contract: OrgWatchlistAlertGenerationContractLike): RuntimeDwmWatchlist[] {
  const membershipContext = orgMembershipContext(contract);
  return orgWatchlistTermsFromContract(contract).map((term) => {
    const context = orgWatchlistTermContext(term, membershipContext);
    return {
      id: context.watchlistId,
      tenantId: context.tenantId,
      organizationId: context.organizationId,
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

export function orgWatchlistTermsFromContract(contract: OrgWatchlistAlertGenerationContractLike): OrgWatchlistContractTerm[] {
  return [
    ...(contract.activeWatchlistTerms ?? []),
    ...(contract.watchlistTerms ?? []),
    ...(contract.terms ?? [])
  ].filter((term) => Boolean(normalizeTermValue(term)));
}

function orgMembershipContext(contract: OrgWatchlistAlertGenerationContractLike): RuntimeOrgMembershipContext {
  const organizationId = String(contract.organizationId);
  const tenantId = String(contract.tenantId ?? contract.organizationId);
  return {
    schemaVersion: "organization.watchlist_alert_generation.v1",
    organizationId,
    tenantId,
    ownerOrganizationId: String(contract.ownerOrganizationId ?? organizationId),
    entitlementStatus: normalizeEntitlementStatus(contract.entitlementStatus),
    visibilityPolicy: normalizeVisibilityPolicy(contract.visibilityPolicy),
    allowedViewerRoles: contract.allowedViewerRoles?.map((role) => String(role)).filter(Boolean) ?? ["owner", "admin", "member", "viewer"],
    canGenerateAlerts: contract.canGenerateAlerts !== false,
    blockedReasons: (contract.blockedReasons ?? []).map(String)
  };
}

function orgWatchlistTermContext(term: OrgWatchlistContractTerm, membership: RuntimeOrgMembershipContext): RuntimeOrgWatchlistTermContext {
  const value = normalizeTermValue(term);
  const kind = normalizeOrgTermKind(term.termFamily ?? term.category ?? term.kind ?? term.family);
  const watchlistItemId = String(term.watchlistItemId ?? term.itemId ?? stableId("org_watchlist_item", `${membership.organizationId}:${kind}:${value}`));
  const watchlistId = String(term.watchlistId ?? watchlistItemId);
  return {
    watchlistId,
    watchlistItemId,
    itemId: String(term.itemId ?? watchlistItemId),
    organizationId: String(term.organizationId ?? membership.organizationId),
    tenantId: String(term.tenantId ?? membership.tenantId),
    term: value,
    value,
    terms: Array.isArray(term.terms) && term.terms.length ? term.terms.map(String) : [value],
    kind,
    category: normalizeOrgTermKind(term.category ?? kind),
    termFamily: normalizeOrgTermKind(term.termFamily ?? kind),
    status: normalizeOrgStatus(term.status),
    createdBy: term.createdBy ? String(term.createdBy) : undefined,
    updatedBy: term.updatedBy === null ? null : term.updatedBy ? String(term.updatedBy) : undefined
  };
}

function normalizeTermValue(term: OrgWatchlistContractTerm): string {
  return String(term.value ?? term.term ?? term.terms?.[0] ?? "").trim();
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

function dwmWatchKindForOrgTerm(kind: OrgWatchlistTermFamily): DwmWatchTerm["kind"] {
  if (kind === "company" || kind === "domain" || kind === "vendor") return kind;
  return "unknown";
}
