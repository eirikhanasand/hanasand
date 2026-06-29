export const ORG_READINESS_LIFECYCLE_SCHEMA_VERSION = "organization.readiness_lifecycle.v1" as const;
export const ORG_READINESS_LIFECYCLE_BLOCKER_SCHEMA_VERSION = "organization.readiness_lifecycle.blocker.v1" as const;

export type OrgReadinessLifecycleOwnerLane =
  | "org"
  | "watchlist"
  | "entitlement"
  | "source"
  | "alert"
  | "webhook"
  | "helpdesk"
  | "analyst-handoff";

export type OrgReadinessLifecycleStatus = "ready" | "provisional" | "blocked" | "needs_input" | "unavailable";

export type OrgReadinessLifecycleStageId =
  | "org_exists"
  | "member_roles"
  | "invite_state"
  | "shared_watchlist_export"
  | "entitlement_readiness"
  | "source_readiness"
  | "alert_matching_readiness"
  | "webhook_destination_readiness"
  | "helpdesk_support_readiness"
  | "analyst_handoff_compatibility";

export type OrgReadinessLifecycleBlocker = {
  schemaVersion: typeof ORG_READINESS_LIFECYCLE_BLOCKER_SCHEMA_VERSION;
  ownerLane: OrgReadinessLifecycleOwnerLane;
  code: string;
  severity: "blocking" | "advisory";
  stageId: OrgReadinessLifecycleStageId;
  sourceContract: string;
  route?: string;
  probeId?: string;
  nextAction: string;
  supportText: string;
};

export type OrgReadinessLifecycleStage = {
  id: OrgReadinessLifecycleStageId;
  ownerLane: OrgReadinessLifecycleOwnerLane;
  status: OrgReadinessLifecycleStatus;
  sourceContract: string;
  route?: string;
  probeId?: string;
  blockerCodes: string[];
  blockers: OrgReadinessLifecycleBlocker[];
  nextAction: string;
  supportText: string;
};

export type OrgReadinessLifecycleInput = {
  generatedAt?: string;
  organizationId?: string;
  tenantId?: string;
  organizationExists: boolean;
  activeOwnerCount: number;
  activeAdminCount: number;
  activeMemberCount: number;
  pendingInviteCount: number;
  failedInviteCount?: number;
  sharedWatchlistExport: {
    available: boolean;
    activeTermCount: number;
    canGenerateAlerts: boolean;
    blockerCodes?: string[];
  };
  entitlement: {
    persistedPolicy: boolean;
    status: "active" | "suspended";
    blockerCodes?: string[];
  };
  source: {
    ready: boolean;
    activeSourceCount: number;
    blockerCodes?: string[];
  };
  alertMatching: {
    ready: boolean;
    probeId?: string;
    blockerCodes?: string[];
  };
  webhook: {
    ready: boolean;
    verifiedDestinationCount: number;
    blockerCodes?: string[];
  };
  helpdesk: {
    ready: boolean;
    auditAvailable: boolean;
    executorAvailable: boolean;
    blockerCodes?: string[];
  };
  analystHandoff: {
    compatible: boolean;
    blockerCodes?: string[];
  };
};

export type OrgReadinessLifecycle = {
  schemaVersion: typeof ORG_READINESS_LIFECYCLE_SCHEMA_VERSION;
  generatedAt: string;
  organization: {
    id?: string;
    tenantId?: string;
  };
  status: OrgReadinessLifecycleStatus;
  blockerCodes: string[];
  nextAction: string;
  stages: Record<OrgReadinessLifecycleStageId, OrgReadinessLifecycleStage>;
};

export type OrgReadinessLifecycleExampleId =
  | "good_org"
  | "no_policy_provisional_org"
  | "missing_shared_watchlist_export"
  | "entitlement_denied"
  | "source_inactive"
  | "alert_matching_unavailable"
  | "webhook_not_verified"
  | "helpdesk_audit_unavailable"
  | "handoff_incompatible";

export type OrgReadinessLifecycleExample = {
  id: OrgReadinessLifecycleExampleId;
  description: string;
  lifecycle: OrgReadinessLifecycle;
};

export type OrgReadinessLifecycleExamples = {
  schemaVersion: "organization.readiness_lifecycle.examples.v1";
  generatedAt: string;
  examples: OrgReadinessLifecycleExample[];
};

const DEFAULT_GENERATED_AT = "2026-06-29T00:00:00.000Z";

export function buildOrgReadinessLifecycle(input: OrgReadinessLifecycleInput): OrgReadinessLifecycle {
  const generatedAt = input.generatedAt ?? DEFAULT_GENERATED_AT;
  const stages: OrgReadinessLifecycle["stages"] = {
    org_exists: stage({
      id: "org_exists",
      ownerLane: "org",
      status: input.organizationExists ? "ready" : "blocked",
      sourceContract: "organization.lifecycle_readiness.v1",
      route: "GET /api/organizations/:id",
      probeId: "org.exists",
      blockerCode: input.organizationExists ? undefined : "org_missing",
      nextAction: input.organizationExists ? "continue_org_readiness" : "create_or_select_organization",
      supportText: input.organizationExists ? "Organization record is present." : "Organization record is missing or not visible."
    }),
    member_roles: stage({
      id: "member_roles",
      ownerLane: "org",
      status: input.activeOwnerCount > 0 && input.activeMemberCount > 0 ? "ready" : "blocked",
      sourceContract: "organization.lifecycle_readiness.v1",
      route: "GET /api/organizations/:id/members",
      probeId: "org.members",
      blockerCode: input.activeOwnerCount > 0 ? undefined : "missing_active_owner",
      nextAction: input.activeOwnerCount > 0 ? "continue_org_readiness" : "restore_owner_or_admin_member",
      supportText: input.activeOwnerCount > 0 ? "Active owner/admin coverage is present." : "No active owner is available; use support recovery flow."
    }),
    invite_state: stage({
      id: "invite_state",
      ownerLane: "org",
      status: input.failedInviteCount ? "needs_input" : "ready",
      sourceContract: "organization.invite_lifecycle.v1",
      route: "GET /api/organizations/:id/invites",
      probeId: "org.invites",
      blockerCode: input.failedInviteCount ? "invite_delivery_failed" : undefined,
      nextAction: input.failedInviteCount ? "review_failed_invites" : "continue_org_readiness",
      supportText: input.failedInviteCount ? "One or more invites need support review." : `Pending invites: ${input.pendingInviteCount}.`
    }),
    shared_watchlist_export: stage({
      id: "shared_watchlist_export",
      ownerLane: "watchlist",
      status: input.sharedWatchlistExport.available && input.sharedWatchlistExport.canGenerateAlerts && input.sharedWatchlistExport.activeTermCount > 0 ? "ready" : "blocked",
      sourceContract: "organization.watchlist_alert_terms_export.v1",
      route: "GET /api/organizations/:id/watchlists/alert-terms",
      probeId: "org.watchlist_export",
      blockerCode: first(input.sharedWatchlistExport.blockerCodes) ?? (input.sharedWatchlistExport.activeTermCount > 0 ? undefined : "missing_active_watchlist_terms"),
      nextAction: "create_or_repair_shared_watchlist_export",
      supportText: "Shared watchlist export must include active terms and alert-generation refs."
    }),
    entitlement_readiness: entitlementStage(input),
    source_readiness: stage({
      id: "source_readiness",
      ownerLane: "source",
      status: input.source.ready && input.source.activeSourceCount > 0 ? "ready" : "blocked",
      sourceContract: "dwm.source_worker_readiness.v1",
      route: "GET /v1/dwm/source-requests/readiness",
      probeId: "source.readiness",
      blockerCode: first(input.source.blockerCodes) ?? (input.source.activeSourceCount > 0 ? undefined : "source_inactive"),
      nextAction: "activate_source_or_replay_worker",
      supportText: "Source readiness requires active source coverage and fresh provenance."
    }),
    alert_matching_readiness: stage({
      id: "alert_matching_readiness",
      ownerLane: "alert",
      status: input.alertMatching.ready ? "ready" : "unavailable",
      sourceContract: "dwm.alert_matching_probe.v1",
      route: "GET /v1/dwm/alerts/readiness",
      probeId: input.alertMatching.probeId ?? "alert.matching",
      blockerCode: first(input.alertMatching.blockerCodes) ?? (input.alertMatching.ready ? undefined : "alert_matching_unavailable"),
      nextAction: "run_alert_matching_probe",
      supportText: "Alert matching readiness must prove org watchlist terms can produce alert candidates."
    }),
    webhook_destination_readiness: stage({
      id: "webhook_destination_readiness",
      ownerLane: "webhook",
      status: input.webhook.ready && input.webhook.verifiedDestinationCount > 0 ? "ready" : "needs_input",
      sourceContract: "dwm.webhook.destination_lifecycle.v1",
      route: "GET /api/organizations/:id/webhooks",
      probeId: "webhook.destinations",
      blockerCode: first(input.webhook.blockerCodes) ?? (input.webhook.verifiedDestinationCount > 0 ? undefined : "webhook_not_verified"),
      nextAction: "verify_webhook_destination",
      supportText: "Webhook destination readiness requires an active verified destination."
    }),
    helpdesk_support_readiness: stage({
      id: "helpdesk_support_readiness",
      ownerLane: "helpdesk",
      status: input.helpdesk.ready && input.helpdesk.auditAvailable && input.helpdesk.executorAvailable ? "ready" : "unavailable",
      sourceContract: "support.action_execution_handoff.v1",
      route: "GET /api/admin/support/readiness",
      probeId: "helpdesk.audit_executor",
      blockerCode: first(input.helpdesk.blockerCodes) ?? (input.helpdesk.auditAvailable ? undefined : "helpdesk_audit_unavailable"),
      nextAction: "restore_helpdesk_audit_or_executor",
      supportText: "Helpdesk readiness requires audit lookup and support action executor contracts."
    }),
    analyst_handoff_compatibility: stage({
      id: "analyst_handoff_compatibility",
      ownerLane: "analyst-handoff",
      status: input.analystHandoff.compatible ? "ready" : "blocked",
      sourceContract: "hanasand.analyst_handoff.validation_report.v1",
      route: "bun scripts/validateAnalystHandoffBundles.ts",
      probeId: "analyst_handoff.compatibility",
      blockerCode: first(input.analystHandoff.blockerCodes) ?? (input.analystHandoff.compatible ? undefined : "handoff_incompatible"),
      nextAction: "repair_analyst_handoff_contract",
      supportText: "Analyst handoff compatibility must validate downstream entitlement/source/helpdesk evidence."
    })
  };
  const blockers = Object.values(stages).flatMap((item) => item.blockers);
  const status = lifecycleStatus(Object.values(stages));
  return {
    schemaVersion: ORG_READINESS_LIFECYCLE_SCHEMA_VERSION,
    generatedAt,
    organization: { id: input.organizationId, tenantId: input.tenantId },
    status,
    blockerCodes: Array.from(new Set(blockers.map((item) => item.code))),
    nextAction: status === "ready" ? "start_customer_monitoring_workflow" : blockers[0]?.nextAction ?? "inspect_org_readiness",
    stages
  };
}

export function buildOrgReadinessLifecycleExamples(input: { generatedAt?: string } = {}): OrgReadinessLifecycleExamples {
  const generatedAt = input.generatedAt ?? DEFAULT_GENERATED_AT;
  const base = goodInput(generatedAt);
  return {
    schemaVersion: "organization.readiness_lifecycle.examples.v1",
    generatedAt,
    examples: [
      example("good_org", "All required org readiness lanes are usable.", base),
      example("no_policy_provisional_org", "Org can operate provisionally, but policy is not persisted.", { ...base, entitlement: { ...base.entitlement, persistedPolicy: false } }),
      example("missing_shared_watchlist_export", "Shared watchlist export is unavailable or empty.", { ...base, sharedWatchlistExport: { available: false, activeTermCount: 0, canGenerateAlerts: false, blockerCodes: ["missing_shared_watchlist_export"] } }),
      example("entitlement_denied", "Persisted entitlement policy blocks customer operations.", { ...base, entitlement: { persistedPolicy: true, status: "active", blockerCodes: ["alert_rebuilds_today"] } }),
      example("source_inactive", "No active source coverage is available for org evidence.", { ...base, source: { ready: false, activeSourceCount: 0, blockerCodes: ["source_inactive"] } }),
      example("alert_matching_unavailable", "Alert matching probe is unavailable for the org.", { ...base, alertMatching: { ready: false, probeId: "alert.matching.unavailable", blockerCodes: ["alert_matching_unavailable"] } }),
      example("webhook_not_verified", "No verified webhook destination is available.", { ...base, webhook: { ready: false, verifiedDestinationCount: 0, blockerCodes: ["webhook_not_verified"] } }),
      example("helpdesk_audit_unavailable", "Helpdesk audit or support executor contract is unavailable.", { ...base, helpdesk: { ready: false, auditAvailable: false, executorAvailable: true, blockerCodes: ["helpdesk_audit_unavailable"] } }),
      example("handoff_incompatible", "Analyst handoff validation reports downstream incompatibility.", { ...base, analystHandoff: { compatible: false, blockerCodes: ["handoff_incompatible"] } })
    ]
  };
}

function entitlementStage(input: OrgReadinessLifecycleInput): OrgReadinessLifecycleStage {
  if (!input.entitlement.persistedPolicy) {
    return stage({
      id: "entitlement_readiness",
      ownerLane: "entitlement",
      status: "provisional",
      sourceContract: "dwm.entitlement_readiness.v1",
      route: "GET /v1/organizations/:id/entitlements/readiness",
      probeId: "entitlement.readiness",
      blockerCode: undefined,
      nextAction: "persist_entitlement_policy",
      supportText: "No persisted entitlement policy exists; operations are provisional and not enterprise-ready."
    });
  }
  return stage({
    id: "entitlement_readiness",
    ownerLane: "entitlement",
    status: input.entitlement.status === "active" && !input.entitlement.blockerCodes?.length ? "ready" : "blocked",
    sourceContract: "dwm.entitlement_readiness.v1",
    route: "GET /v1/organizations/:id/entitlements/readiness",
    probeId: "entitlement.readiness",
    blockerCode: first(input.entitlement.blockerCodes) ?? (input.entitlement.status === "active" ? undefined : "entitlement_suspended"),
    nextAction: "review_entitlement_policy",
    supportText: "Use entitlement readiness blockers, usage, projected usage, and redacted audit metadata."
  });
}

function stage(input: {
  id: OrgReadinessLifecycleStageId;
  ownerLane: OrgReadinessLifecycleOwnerLane;
  status: OrgReadinessLifecycleStatus;
  sourceContract: string;
  route?: string;
  probeId?: string;
  blockerCode?: string;
  nextAction: string;
  supportText: string;
}): OrgReadinessLifecycleStage {
  const blocker = input.blockerCode ? [blockerFromStage(input, input.blockerCode)] : [];
  return {
    id: input.id,
    ownerLane: input.ownerLane,
    status: input.status,
    sourceContract: input.sourceContract,
    route: input.route,
    probeId: input.probeId,
    blockerCodes: blocker.map((item) => item.code),
    blockers: blocker,
    nextAction: input.nextAction,
    supportText: input.supportText
  };
}

function blockerFromStage(input: {
  id: OrgReadinessLifecycleStageId;
  ownerLane: OrgReadinessLifecycleOwnerLane;
  sourceContract: string;
  route?: string;
  probeId?: string;
  nextAction: string;
  supportText: string;
}, code: string): OrgReadinessLifecycleBlocker {
  return {
    schemaVersion: ORG_READINESS_LIFECYCLE_BLOCKER_SCHEMA_VERSION,
    ownerLane: input.ownerLane,
    code,
    severity: "blocking",
    stageId: input.id,
    sourceContract: input.sourceContract,
    route: input.route,
    probeId: input.probeId,
    nextAction: input.nextAction,
    supportText: input.supportText
  };
}

function lifecycleStatus(stages: OrgReadinessLifecycleStage[]): OrgReadinessLifecycleStatus {
  if (stages.some((item) => item.status === "blocked")) return "blocked";
  if (stages.some((item) => item.status === "unavailable")) return "unavailable";
  if (stages.some((item) => item.status === "needs_input")) return "needs_input";
  if (stages.some((item) => item.status === "provisional")) return "provisional";
  return "ready";
}

function goodInput(generatedAt: string): OrgReadinessLifecycleInput {
  return {
    generatedAt,
    organizationId: "org_readiness_example",
    tenantId: "tenant_readiness_example",
    organizationExists: true,
    activeOwnerCount: 1,
    activeAdminCount: 1,
    activeMemberCount: 4,
    pendingInviteCount: 2,
    sharedWatchlistExport: { available: true, activeTermCount: 3, canGenerateAlerts: true },
    entitlement: { persistedPolicy: true, status: "active" },
    source: { ready: true, activeSourceCount: 2 },
    alertMatching: { ready: true, probeId: "alert.matching.ready" },
    webhook: { ready: true, verifiedDestinationCount: 1 },
    helpdesk: { ready: true, auditAvailable: true, executorAvailable: true },
    analystHandoff: { compatible: true }
  };
}

function example(id: OrgReadinessLifecycleExampleId, description: string, input: OrgReadinessLifecycleInput): OrgReadinessLifecycleExample {
  return { id, description, lifecycle: buildOrgReadinessLifecycle(input) };
}

function first(values: string[] | undefined): string | undefined {
  return values?.find(Boolean);
}
