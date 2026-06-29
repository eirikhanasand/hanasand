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
};

export function orgWatchlistContractToRuntimeDwmWatchlists(contract: OrgWatchlistAlertGenerationContractLike): RuntimeDwmWatchlist[] {
  const membershipContext = orgMembershipContext(contract);
  return orgWatchlistTermsFromContract(contract).map((term) => {
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

function dwmWatchKindForOrgTerm(kind: OrgWatchlistTermFamily): DwmWatchTerm["kind"] {
  if (kind === "company" || kind === "domain" || kind === "vendor") return kind;
  return "unknown";
}
