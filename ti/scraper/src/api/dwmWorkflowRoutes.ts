import { classifySourceFamily, normalizeWatchlist, type DwmWatchTerm } from "../product/dwmProduct.ts";
import { buildDwmAlertCustomerProofHandoffRow, buildDwmAlertDownstreamHandoff, buildDwmAlertGenerationReadiness, buildDwmAlertRetentionAudit, buildDwmAlertWorkflowExecutionReadiness, buildDwmPersistedDeliveryReadinessContext, rebuildDwmRuntimeAlerts, type RuntimeDwmWatchlist } from "../storage/dwmAlertRepository.ts";
import { buildAlertCaseHandoff } from "../product/analystHandoff.ts";
import { buildDwmCustomerAlertSummary, sanitizeDwmApiPayload, sanitizeDwmCustomerEvidenceExcerpt } from "../product/dwmCustomerDisplay.ts";
import { buildOrgAlertWorkflowBridgeReport } from "../product/orgAlertWorkflowBridge.ts";
import { buildOrgSharedWatchlistAlertGenerationExport } from "../storage/dwmOrgWatchlistBridge.ts";
import { nowIso, stableId, uniqueStrings } from "../utils.ts";
import { buildDwmEntitlementBlocker, buildDwmEntitlementReadAdapter, evaluateProposedDwmAlertRebuildEntitlement, evaluateProposedDwmWatchlistEntitlement, recordDwmEntitlementUsageEvent } from "./dwmEntitlementRoutes.ts";
import { exposureClaimsFromStore } from "./exposureQueueRoutes.ts";
import { json, readJson } from "./http.ts";
import { assertPublicWebhookTarget, buildWebhookRequestBody, findWebhookDestination, inferWebhookKind, normalizeWebhookUrl, organizationWebhookDestinations, resolveOrganizationScope, webhookHeaders, type WebhookDestination } from "./organizationRoutes.ts";
import type { OrganizationMember } from "./organizationRoutes.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

type DwmWatchlist = {
  id: string;
  tenantId: string;
  organizationId?: string;
  name: string;
  terms: DwmWatchTerm[];
  webhookUrl?: string;
  webhookDestinationId?: string;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
  orgWatchlistTerms?: RuntimeDwmWatchlist["orgWatchlistTerms"];
  orgMembershipContext?: RuntimeDwmWatchlist["orgMembershipContext"];
};

function stableWatchlistTerms(watchlistId: string, terms: DwmWatchTerm[]): Array<DwmWatchTerm & { id: string }> {
  return terms.map((term: any) => ({
    ...term,
    id: String(term.id ?? stableId("dwm_watchlist_item", `${watchlistId}:${term.kind}:${term.value.toLowerCase()}`))
  }));
}

function organizationWatchlistRuntime(watchlist: DwmWatchlist, organizationId?: string) {
  if (!organizationId) return {};
  return sourceMatchedOrgRuntime({
    id: watchlist.id,
    tenantId: watchlist.tenantId,
    organizationId,
    terms: watchlist.terms as Array<DwmWatchTerm & { id: string }>,
    existing: watchlist
  });
}

export function listDwmWatchlists(url: URL, options: ApiServerOptions, request?: Request): Response {
  const scope = resolveOrganizationScope({ url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  const tenantId = scope.tenantId;
  const watchlists = (options.store as any).listDwmWatchlists?.() ?? [];
  return json({
    organization: scope.organization,
    visibilityDecision: access.visibilityDecision,
    watchlists: watchlists
      .filter((row: DwmWatchlist) => row.tenantId === tenantId)
      .map((watchlist: DwmWatchlist) => buildDwmWatchlistDetail(watchlist, options, access))
  });
}

export async function createDwmWatchlist(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const terms = normalizeWatchlist(Array.isArray(body.terms) ? body.terms : String(body.terms ?? body.watchlist ?? "").split(/[,\n]/));
  if (!terms.length) return json({ error: { code: "missing_terms", message: "Add at least one company, domain, vendor, brand, VIP, or product term." } }, 400);

  const generatedAt = nowIso();
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  const tenantId = scope.tenantId;
  const webhookUrl = normalizeWebhookUrl(body.webhookUrl);
  if (body.webhookUrl && !webhookUrl) return json({ error: { code: "invalid_webhook_url", message: "Webhook URL must start with http:// or https://." } }, 400);
  const webhookDestinationId = body.webhookDestinationId ? String(body.webhookDestinationId) : undefined;
  const webhookDestination = webhookDestinationId ? findWebhookDestination(options, webhookDestinationId) : undefined;
  if (webhookDestinationId && (!webhookDestination || webhookDestination.organizationId !== scope.organizationId)) {
    return json({ error: { code: "invalid_webhook_destination", message: "Webhook destination must belong to the selected organization." } }, 400);
  }
  const id = body.id ?? stableId("dwm_watchlist", `${tenantId}:${terms.map((term) => term.value).join("|")}`);
  const existing = (options.store as any).getDwmWatchlist?.(id);
  if (existing && existing.tenantId !== tenantId) {
    return json({ error: { code: "watchlist_id_conflict", message: "Watchlist id already belongs to another organization scope." }, visibilityDecision: access.visibilityDecision }, 409);
  }
  const watchlist: DwmWatchlist = {
    id,
    tenantId,
    organizationId: scope.organizationId ?? existing?.organizationId,
    name: String(body.name ?? "Company exposure watchlist"),
    terms: stableWatchlistTerms(id, terms),
    webhookUrl,
    webhookDestinationId: webhookDestinationId ?? existing?.webhookDestinationId,
    status: body.status === "paused" ? "paused" : "active",
    createdAt: existing?.createdAt ?? generatedAt,
    updatedAt: generatedAt
  };
  Object.assign(watchlist, organizationWatchlistRuntime(watchlist, scope.organizationId));
  const entitlement = enforceDwmWatchlistEntitlement({ options, request, body, scope, access, watchlist, action: "create_dwm_watchlist" });
  if (entitlement.error) return entitlement.error;
  (options.store as any).saveDwmWatchlist(watchlist);
  const alertRebuild = rebuildDwmAlertsAfterWatchlistMutation(options, scope);
  return json({ organization: scope.organization, visibilityDecision: access.visibilityDecision, entitlement: entitlement.adapter, watchlist: buildDwmWatchlistDetail(watchlist, options, access), alertRebuild }, 201);
}

export function getDwmWatchlistDetail(url: URL, options: ApiServerOptions, watchlistId: string | undefined, request?: Request): Response {
  const watchlist = findDwmWatchlist(options, watchlistId);
  if (!watchlist) return json({ error: { code: "not_found", message: "DWM watchlist not found." } }, 404);
  const scope = resolveDwmWatchlistScope({ watchlist, url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  if (watchlist.tenantId !== scope.tenantId) return json({ error: { code: "not_found", message: "DWM watchlist not found." } }, 404);
  return json({ organization: scope.organization, visibilityDecision: access.visibilityDecision, watchlist: buildDwmWatchlistDetail(watchlist, options, access) });
}

export async function updateDwmWatchlist(request: Request, options: ApiServerOptions, watchlistId: string | undefined): Promise<Response> {
  const existing = findDwmWatchlist(options, watchlistId);
  if (!existing) return json({ error: { code: "not_found", message: "DWM watchlist not found." } }, 404);

  const body = await readJson<any>(request);
  const scope = resolveDwmWatchlistScope({ watchlist: existing, body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  if (existing.tenantId !== scope.tenantId) return json({ error: { code: "not_found", message: "DWM watchlist not found." } }, 404);

  const terms = body.terms === undefined && body.watchlist === undefined
    ? existing.terms
    : normalizeWatchlist(Array.isArray(body.terms) ? body.terms : String(body.terms ?? body.watchlist ?? "").split(/[,\n]/));
  if (!terms.length) return json({ error: { code: "missing_terms", message: "Add at least one company, domain, vendor, brand, VIP, or product term." }, visibilityDecision: access.visibilityDecision }, 400);

  const webhookUrl = body.webhookUrl === undefined ? existing.webhookUrl : normalizeWebhookUrl(body.webhookUrl);
  if (body.webhookUrl && !webhookUrl) return json({ error: { code: "invalid_webhook_url", message: "Webhook URL must start with http:// or https://." }, visibilityDecision: access.visibilityDecision }, 400);
  const webhookDestinationId = body.webhookDestinationId === undefined ? existing.webhookDestinationId : (body.webhookDestinationId ? String(body.webhookDestinationId) : undefined);
  const webhookDestination = webhookDestinationId ? findWebhookDestination(options, webhookDestinationId) : undefined;
  if (webhookDestinationId && (!webhookDestination || webhookDestination.organizationId !== scope.organizationId)) {
    return json({ error: { code: "invalid_webhook_destination", message: "Webhook destination must belong to the selected organization." }, visibilityDecision: access.visibilityDecision }, 400);
  }

  const watchlist: DwmWatchlist = {
    ...existing,
    name: body.name === undefined ? existing.name : String(body.name),
    terms: stableWatchlistTerms(existing.id, terms),
    webhookUrl,
    webhookDestinationId,
    status: normalizeWatchlistStatus(body.status, existing.status),
    updatedAt: nowIso()
  };
  Object.assign(watchlist, organizationWatchlistRuntime(watchlist, scope.organizationId));
  const entitlement = enforceDwmWatchlistEntitlement({ options, request, body, scope, access, watchlist, action: "update_dwm_watchlist" });
  if (entitlement.error) return entitlement.error;
  (options.store as any).saveDwmWatchlist(watchlist);
  const alertRebuild = rebuildDwmAlertsAfterWatchlistMutation(options, scope);
  return json({ organization: scope.organization, visibilityDecision: access.visibilityDecision, entitlement: entitlement.adapter, watchlist: buildDwmWatchlistDetail(watchlist, options, access), alertRebuild });
}

function rebuildDwmAlertsAfterWatchlistMutation(options: ApiServerOptions, scope: { tenantId: string; organizationId?: string; organization?: unknown }) {
  const rebuilt = rebuildDwmRuntimeAlerts({
    store: options.store as any,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    visibilityPolicy: organizationAlertVisibilityPolicy(scope.organization)
  });
  return {
    savedAlertCount: rebuilt.savedAlertCount,
    alertIds: rebuilt.alerts.map((alert: any) => alert.id),
    sourceFamilies: uniqueStrings(rebuilt.alerts.map((alert: any) => alert.sourceFamily).filter(Boolean)),
    matchedTerms: uniqueStrings(rebuilt.alerts.map((alert: any) => alert.matchedTerm?.value).filter(Boolean)),
    zeroAlertProof: rebuilt.zeroAlertProof
  };
}

export async function disableDwmWatchlist(request: Request, options: ApiServerOptions, watchlistId: string | undefined): Promise<Response> {
  const existing = findDwmWatchlist(options, watchlistId);
  if (!existing) return json({ error: { code: "not_found", message: "DWM watchlist not found." } }, 404);

  const body = await readJson<any>(request);
  const scope = resolveDwmWatchlistScope({ watchlist: existing, body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  if (existing.tenantId !== scope.tenantId) return json({ error: { code: "not_found", message: "DWM watchlist not found." } }, 404);

  const watchlist: DwmWatchlist = { ...existing, status: "paused", updatedAt: nowIso() };
  (options.store as any).saveDwmWatchlist(watchlist);
  return json({ organization: scope.organization, visibilityDecision: access.visibilityDecision, watchlist: buildDwmWatchlistDetail(watchlist, options, access) });
}

export async function listDwmAlerts(url: URL, options: ApiServerOptions, request?: Request): Promise<Response> {
  const scope = resolveOrganizationScope({ url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  const tenantId = scope.tenantId;
  await ensureExposureQueueDwmAlerts(options, { tenantId, organizationId: scope.organizationId });
  const alerts = (options.store as any).listDwmAlerts?.() ?? [];
  const visibleAlerts = alerts
    .filter((row: any) => row.tenantId === tenantId)
    .filter((row: any) => !scope.organizationId || row.organizationId === scope.organizationId)
    .filter((alert: any) => alertMatchesDwmAlertFilters(alert, url));
  const visibleAlertItems = visibleAlerts
    .map((alert: any) => buildDwmAlertListItem(alert, options))
    .filter((alert: any) => alertMatchesDwmAlertReadinessFilters(alert, url));
  return json({
    organization: scope.organization,
    visibilityDecision: access.visibilityDecision,
    alertQueueVisibility: buildDwmAlertQueueVisibility({
      organizationId: scope.organizationId,
      tenantId,
      organization: scope.organization,
      access,
      alerts: visibleAlertItems,
      options,
      url
    }),
    alerts: visibleAlertItems
  });
}

export function getDwmAlertDetail(url: URL, options: ApiServerOptions, alertId: string | undefined, request?: Request): Response {
  const alert = findDwmAlert(options, alertId);
  if (!alert) return json({ error: { code: "not_found", message: "DWM alert not found." } }, 404);
  const scope = resolveDwmAlertScope({ alert, url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  if (alert.tenantId !== scope.tenantId) return json({ error: { code: "not_found", message: "DWM alert not found." } }, 404);
  return json({
    ...buildDwmAlertDetail(alert, options, access),
    alertQueueVisibility: buildDwmAlertQueueVisibility({
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      organization: scope.organization,
      access,
      alerts: [alert],
      options,
      url
    })
  });
}

export async function updateDwmAlert(request: Request, options: ApiServerOptions, alertId: string | undefined): Promise<Response> {
  const existing = findDwmAlert(options, alertId);
  if (!existing) return json({ error: { code: "not_found", message: "DWM alert not found." } }, 404);

  const body = await readJson<any>(request);
  const scope = resolveDwmAlertScope({ alert: existing, body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  if (existing.tenantId !== scope.tenantId) return json({ error: { code: "not_found", message: "DWM alert not found." } }, 404);
  const staleReadiness = workflowVersionReadiness(existing, body, scope.organizationId);
  if (!staleReadiness.ready) return json({ error: { code: "stale_workflow_version", message: "Alert workflow changed; reload before mutating." }, workflowExecutionReadiness: staleReadiness }, 409);
  if (scope.organization && !organizationLifecycleActive(scope.organization)) {
    const downstreamHandoff = buildDwmAlertDownstreamHandoff({
      alert: existing,
      deliveries: ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === existing.id),
      organizationId: scope.organizationId,
      ...downstreamLifecycleForAlert(options, existing, scope)
    });
    return json({
      error: { code: "archived_org", message: "Organization lifecycle is not active; alert workflow mutation is disabled." },
      workflowExecutionReadiness: buildDwmAlertWorkflowExecutionReadiness({
        alert: existing,
        organizationId: scope.organizationId,
        action: workflowActionFromBody(body),
        lifecycleBlockers: downstreamHandoff.blockerCodes.filter((code: string) => code === "archived_org") as any
      }),
      downstreamHandoff
    }, 409);
  }
  const generatedAt = nowIso();
  const workflowTransition = resolveAlertWorkflowTransition(existing, body);
  if (workflowTransition.error) return json({
    error: { code: "invalid_transition", message: "Requested alert workflow transition is invalid." },
    workflowExecutionReadiness: buildDwmAlertWorkflowExecutionReadiness({ alert: existing, organizationId: scope.organizationId, action: workflowActionFromBody(body), transitionValid: false })
  }, 400);
  const reviewState = workflowTransition.reviewState;
  const deliveryState = workflowTransition.deliveryState;
  const assignedOwner = body.assignedOwner === undefined && body.owner === undefined ? existing.assignedOwner : normalizeOwner(body.assignedOwner ?? body.owner);
  const severityOverride = body.severityOverride === undefined && body.severity === undefined ? existing.severityOverride : normalizeSeverityOverride(body.severityOverride ?? body.severity);
  const caseId = body.caseId === undefined ? existing.caseId : normalizeCaseValue(body.caseId);
  const casePath = body.casePath === undefined ? existing.casePath : normalizeCaseValue(body.casePath);
  if ((body.severityOverride !== undefined || body.severity !== undefined) && severityOverride === undefined) {
    return json({ error: { code: "invalid_severity_override", message: "Severity override must be critical, high, medium, low, or null." } }, 400);
  }
  const note = normalizeWorkflowText(body.note);
  const rationale = normalizeWorkflowText(body.rationale ?? body.reason);
  if (requiresWorkflowRationale(workflowTransition.workflowStatus, existing.workflowStatus) && !rationale && !note) {
    return json({ error: { code: "missing_workflow_rationale", message: "Suppressed and closed alert transitions require a note or rationale." } }, 400);
  }

  const event = {
    id: stableId("dwm_alert_event", `${alertId}:${generatedAt}:${existing.workflowEvents?.length ?? 0}:${workflowTransition.workflowStatus}:${assignedOwner ?? ""}:${severityOverride ?? ""}:${note ?? ""}:${rationale ?? ""}`),
    at: generatedAt,
    actor: String(body.actor ?? request.headers.get("x-actor-id") ?? "dashboard"),
    eventType: workflowTransition.workflowStatus === existing.workflowStatus && note ? "workflow.note" : "workflow.transition",
    fromWorkflowStatus: existing.workflowStatus ?? "new",
    toWorkflowStatus: workflowTransition.workflowStatus,
    fromReviewState: existing.reviewState,
    toReviewState: reviewState,
    fromDeliveryState: existing.deliveryState,
    toDeliveryState: deliveryState,
    fromOwner: existing.assignedOwner,
    toOwner: assignedOwner,
    fromSeverityOverride: existing.severityOverride,
    toSeverityOverride: severityOverride,
    fromCaseId: existing.caseId,
    toCaseId: caseId,
    fromCasePath: existing.casePath,
    toCasePath: casePath,
    note,
    rationale
  };
  const nextAlert = {
    ...existing,
    workflowStatus: workflowTransition.workflowStatus,
    reviewState,
    deliveryState,
    assignedOwner,
    severityOverride,
    caseId,
    casePath,
    workflowNote: note ?? existing.workflowNote,
    workflowRationale: rationale ?? existing.workflowRationale,
    suppressedAt: workflowTransition.workflowStatus === "suppressed" ? existing.suppressedAt ?? generatedAt : existing.suppressedAt,
    closedAt: workflowTransition.workflowStatus === "closed" ? existing.closedAt ?? generatedAt : existing.closedAt,
    reopenedAt: workflowTransition.workflowStatus === "reopened" ? generatedAt : existing.reopenedAt,
    updatedAt: generatedAt,
    workflowEvents: [...(existing.workflowEvents ?? []), event]
  };
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === nextAlert.id);
  const alert = (options.store as any).saveDwmAlert({
    ...nextAlert,
    deliveryReadinessContext: buildDwmPersistedDeliveryReadinessContext({
      alert: nextAlert,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      workflowContext: nextAlert.workflowContext,
      existing: nextAlert,
      deliveries,
      generatedAt
    })
  });
  const workflowExecutionReadiness = buildDwmAlertWorkflowExecutionReadiness({ alert, organizationId: scope.organizationId, action: workflowActionFromBody(body) });
  return json({
    visibilityDecision: access.visibilityDecision,
    workflowExecutionReadiness,
    workflowActionEvent: workflowExecutionReadiness.workflowActionEvent,
    alert: buildDwmAlertListItem(alert, options, deliveries),
    event
  });
}

export async function replayDwmAlert(request: Request, options: ApiServerOptions, alertId: string | undefined): Promise<Response> {
  const existing = findDwmAlert(options, alertId);
  if (!existing) return json({ error: { code: "not_found", message: "DWM alert not found." } }, 404);
  const body = await readJson<any>(request);
  const scope = resolveDwmAlertScope({ alert: existing, body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  if (existing.tenantId !== scope.tenantId) return json({ error: { code: "not_found", message: "DWM alert not found." } }, 404);
  const staleReadiness = workflowVersionReadiness(existing, body, scope.organizationId, "replay");
  if (!staleReadiness.ready) return json({ error: { code: "stale_workflow_version", message: "Alert workflow changed; reload before replaying." }, workflowExecutionReadiness: staleReadiness }, 409);
  const entitlement = enforceDwmAlertRebuildEntitlement({ options, request, body, scope, access, action: "replay_dwm_alert" });
  if (entitlement.error) return entitlement.error;
  const generatedAt = nowIso();
  const existingDeliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === existing.id);
  const downstreamHandoff = buildDwmAlertDownstreamHandoff({
    alert: existing,
    deliveries: existingDeliveries,
    organizationId: scope.organizationId,
    expectedWorkflowEventCount: body.expectedWorkflowEventCount,
    entitlementAllowed: true,
    ...downstreamLifecycleForAlert(options, existing, scope),
    generatedAt
  });
  const replayBlocked = downstreamHandoff.blockerCodes.some((code: string) => [
    "duplicate_replay",
    "archived_org",
    "retired_watchlist",
    "disabled_destination",
    "closed_alert",
    "suppressed_alert",
    "revoked_actor",
    "no_active_source_match"
  ].includes(code));
  if (replayBlocked) {
    return json({
      ...buildDwmAlertDetail(existing, options, access),
      workflowExecutionReadiness: buildDwmAlertWorkflowExecutionReadiness({
        alert: existing,
        organizationId: scope.organizationId,
        action: "replay",
        duplicateReplay: downstreamHandoff.blockerCodes.includes("duplicate_replay"),
        lifecycleBlockers: downstreamHandoff.blockerCodes.filter((code: string) => code !== "duplicate_replay") as any
      }),
      downstreamHandoff,
      entitlement: entitlement.adapter
    });
  }
  const event = {
    id: stableId("dwm_alert_event", `${alertId}:${generatedAt}:replay:${existing.workflowEvents?.length ?? 0}`),
    at: generatedAt,
    actor: String(body.actor ?? request.headers.get("x-actor-id") ?? "dashboard"),
    fromReviewState: existing.reviewState,
    toReviewState: existing.reviewState,
    fromDeliveryState: existing.deliveryState,
    toDeliveryState: existing.deliveryState,
    note: "Evidence replay opened."
  };
  const replayedAlert = {
    ...existing,
    replayCount: Number(existing.replayCount ?? 0) + 1,
    lastReplayedAt: generatedAt,
    updatedAt: generatedAt,
    workflowEvents: [...(existing.workflowEvents ?? []), event]
  };
  const alert = (options.store as any).saveDwmAlert({
    ...replayedAlert,
    deliveryReadinessContext: buildDwmPersistedDeliveryReadinessContext({
      alert: replayedAlert,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      workflowContext: replayedAlert.workflowContext,
      existing: replayedAlert,
      deliveries: existingDeliveries,
      generatedAt
    })
  });
  const usageEvent = recordDwmEntitlementUsageEvent(options, { organizationId: scope.organizationId, tenantId: scope.tenantId, action: "alert_rebuild", actor: entitlement.actor, requestId: entitlement.requestId, metadata: { route: "replay_dwm_alert", alertId: alert.id }, at: generatedAt });
  return json({ ...buildDwmAlertDetail(alert, options, access), workflowExecutionReadiness: buildDwmAlertWorkflowExecutionReadiness({ alert, organizationId: scope.organizationId, action: "replay" }), downstreamHandoff: buildDwmAlertDownstreamHandoff({ alert, deliveries: existingDeliveries, organizationId: scope.organizationId, currentReplayAttempt: true, ...downstreamLifecycleForAlert(options, alert, scope), generatedAt }), entitlement: entitlement.adapter, entitlementUsageEvent: usageEvent });
}

export function listDwmWebhookDeliveries(url: URL, options: ApiServerOptions, request?: Request): Response {
  const scope = resolveOrganizationScope({ url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  const tenantId = scope.tenantId;
  const deliveries = (options.store as any).listDwmWebhookDeliveries?.() ?? [];
  return json({
    organization: scope.organization,
    visibilityDecision: access.visibilityDecision,
    deliveries: deliveries
      .filter((row: any) => row.tenantId === tenantId)
      .map((row: any) => withDwmWebhookOperatorDeliveryTrace(row))
  });
}

function withDwmWebhookOperatorDeliveryTrace(delivery: any): any {
  const attemptedAt = String(delivery.attemptedAt ?? delivery.updatedAt ?? delivery.createdAt ?? nowIso());
  const createdAt = String(delivery.createdAt ?? attemptedAt);
  const updatedAt = String(delivery.updatedAt ?? attemptedAt);
  const attemptCount = Number.isFinite(Number(delivery.attemptCount)) && Number(delivery.attemptCount) > 0
    ? Number(delivery.attemptCount)
    : 1;
  const errorClass = delivery.errorClass ?? classifyWebhookDeliveryError(delivery);
  const nextRetryAt = delivery.nextRetryAt ?? nextWebhookRetryAt(delivery, attemptedAt, attemptCount, errorClass);
  const requestId = delivery.requestId ?? stableId("dwm_webhook_request", `${delivery.id}:${delivery.dedupeKey ?? ""}`);
  const auditAction = delivery.auditAction ?? webhookAuditActionForDelivery(delivery, nextRetryAt);
  const auditEventId = delivery.auditEventId ?? stableId("dwm_webhook_audit", `${delivery.id}:${auditAction}:${attemptedAt}`);

  return {
    ...delivery,
    requestId,
    auditEventId,
    auditAction,
    createdAt,
    updatedAt,
    attemptedAt,
    attemptCount,
    errorClass,
    nextRetryAt,
    retryable: Boolean(nextRetryAt),
    responseSummary: delivery.responseSummary ?? webhookDeliveryResponseSummary(delivery, errorClass),
    redactedDestination: {
      webhookDestinationId: delivery.webhookDestinationId,
      endpointHash: delivery.endpointHash,
      endpointExposed: false
    }
  };
}

function classifyWebhookDeliveryError(delivery: any): string | undefined {
  if (!delivery.error && delivery.status !== "failed" && delivery.status !== "skipped") return undefined;
  if (delivery.status === "skipped") {
    if (delivery.endpointHash === "missing_webhook_url") return "missing_webhook_url";
    if (delivery.endpointHash === "disabled_webhook_destination") return "disabled_destination";
    if (delivery.endpointHash === "replay_already_delivered") return "duplicate_replay";
    if (delivery.endpointHash === "retired_watchlist") return "retired_watchlist";
    return "selection_blocked";
  }
  const httpStatus = Number(delivery.httpStatus);
  if (Number.isFinite(httpStatus) && httpStatus >= 500) return "upstream_5xx";
  if (Number.isFinite(httpStatus) && httpStatus >= 400) return "upstream_4xx";
  if (String(delivery.error ?? "").toLowerCase().includes("timeout")) return "timeout";
  if (String(delivery.error ?? "").toLowerCase().includes("network")) return "network_error";
  return "delivery_failed";
}

function nextWebhookRetryAt(delivery: any, attemptedAt: string, attemptCount: number, errorClass?: string): string | undefined {
  if (delivery.status !== "failed") return undefined;
  if (delivery.dryRun === true) return undefined;
  if (errorClass === "upstream_4xx") return undefined;
  const attemptedMs = Date.parse(attemptedAt);
  if (!Number.isFinite(attemptedMs)) return undefined;
  const delayMinutes = [1, 5, 15, 60][Math.min(Math.max(attemptCount - 1, 0), 3)];
  return new Date(attemptedMs + delayMinutes * 60_000).toISOString();
}

function webhookAuditActionForDelivery(delivery: any, nextRetryAt?: string): string {
  if (delivery.status === "dry_run" && delivery.alertId === "webhook_test") return "delivery.tested";
  if (delivery.status === "dry_run") return "delivery.replayed";
  if (delivery.status === "delivered") return "delivery.delivered";
  if (delivery.status === "failed") return nextRetryAt ? "delivery.retry_scheduled" : "delivery.failed";
  if (delivery.status === "skipped") return "delivery.skipped";
  return "delivery.recorded";
}

function webhookDeliveryResponseSummary(delivery: any, errorClass?: string): string {
  if (delivery.status === "dry_run") return "Dry-run delivery rendered without external network.";
  if (delivery.status === "delivered") return `Webhook accepted delivery${delivery.httpStatus ? ` with HTTP ${delivery.httpStatus}` : ""}.`;
  if (delivery.status === "failed") return delivery.error ? `Delivery failed: ${String(delivery.error)}` : `Delivery failed${errorClass ? `: ${errorClass}` : ""}.`;
  if (delivery.status === "skipped") return delivery.error ? String(delivery.error) : "Delivery was skipped before sending.";
  return "Delivery attempt recorded.";
}

export function getDwmAlertGenerationReadiness(url: URL, options: ApiServerOptions, request?: Request): Response {
  const scope = resolveOrganizationScope({ url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  const readiness = buildDwmAlertGenerationReadiness({
    watchlists: (options.store as any).listDwmWatchlists?.() ?? [],
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    visibilityPolicy: organizationAlertVisibilityPolicy(scope.organization),
    sources: options.store.listSources(),
    captures: options.store.listCaptures()
  });
  return json({ organization: scope.organization, visibilityDecision: access.visibilityDecision, readiness });
}

export async function rebuildDwmAlerts(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  const tenantId = scope.tenantId;
  if (scope.organization && !organizationLifecycleActive(scope.organization)) {
    return json({
      error: { code: "archived_org", message: "Organization lifecycle is not active; alert rebuild is disabled." },
      lifecycleReadiness: buildDwmAlertDownstreamHandoff({ organizationId: scope.organizationId, organizationStatus: (scope.organization as any).status, activeSourceMatch: false })
    }, 409);
  }
  const watchlists = ((options.store as any).listDwmWatchlists?.() ?? []).filter((row: DwmWatchlist) => row.tenantId === tenantId && row.status === "active");
  const terms = watchlists.flatMap((watchlist: DwmWatchlist) => watchlist.terms);
  if (!terms.length) return json({ error: { code: "missing_watchlist", message: "Create an active DWM watchlist before rebuilding alerts." } }, 400);

  const entitlement = enforceDwmAlertRebuildEntitlement({ options, request, body, scope, access, action: "rebuild_dwm_alerts" });
  if (entitlement.error) return entitlement.error;
  const rebuilt = rebuildDwmRuntimeAlerts({ store: options.store as any, tenantId, organizationId: scope.organizationId, visibilityPolicy: organizationAlertVisibilityPolicy(scope.organization) });
  const usageEvent = recordDwmEntitlementUsageEvent(options, { organizationId: scope.organizationId, tenantId, action: "alert_rebuild", actor: entitlement.actor, requestId: entitlement.requestId, metadata: { route: "rebuild_dwm_alerts", savedAlertCount: rebuilt.savedAlertCount }, at: nowIso() });
  return json({ organization: scope.organization, visibilityDecision: access.visibilityDecision, entitlement: entitlement.adapter, entitlementUsageEvent: usageEvent, ...rebuilt });
}

export async function deliverDwmWebhooks(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  const tenantId = scope.tenantId;
  if (scope.organization && !organizationLifecycleActive(scope.organization)) {
    return json({ error: { code: "archived_org", message: "Organization lifecycle is not active; webhook delivery is disabled." } }, 409);
  }
  const dryRun = body.dryRun === true;
  const explicitWebhookUrl = body.webhookUrl === undefined ? undefined : normalizeWebhookUrl(body.webhookUrl);
  if (body.webhookUrl && !explicitWebhookUrl) return json({ error: { code: "invalid_webhook_url", message: "Webhook URL must start with http:// or https://." }, visibilityDecision: access.visibilityDecision }, 400);
  const requestedCaseId = normalizeCaseValue(body.caseId);
  const requestedCasePath = normalizeCaseValue(body.casePath);
  const fetcher = typeof options.webhookFetch === "function" ? options.webhookFetch as typeof fetch : fetch;
  const watchlists = ((options.store as any).listDwmWatchlists?.() ?? []).filter((row: DwmWatchlist) => row.tenantId === tenantId && row.status === "active");
  const orgDestinations = organizationWebhookDestinations(options, scope.organizationId);
  const alerts = ((options.store as any).listDwmAlerts?.() ?? []).filter((alert: any) => alert.tenantId === tenantId && (body.alertId ? alert.id === body.alertId : alert.deliveryState !== "delivered"));
  const generatedAt = nowIso();
  const deliveries: any[] = [];

  for (const alert of alerts.slice(0, Math.max(1, Math.min(Number(body.limit ?? 25), 100)))) {
    const alertWatchlistIds = new Set((alert.watchlistIds ?? alert.workflowContext?.watchlistIds ?? []).map(String));
    const watchlist = watchlists.find((row: DwmWatchlist) => alertWatchlistIds.has(row.id)) ?? (!alertWatchlistIds.size ? watchlists[0] : undefined);
    const deliveryOrgId = scope.organizationId ?? alert.organizationId ?? alert.workflowContext?.organizationId ?? watchlist?.organizationId;
    const deliveryOrgDestinations = deliveryOrgId && deliveryOrgId !== scope.organizationId ? organizationWebhookDestinations(options, deliveryOrgId) : orgDestinations;
    const existingDeliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === alert.id);
    const downstreamHandoff = buildDwmAlertDownstreamHandoff({
      alert,
      deliveries: existingDeliveries,
      organizationId: deliveryOrgId,
      ...downstreamLifecycleForAlert(options, alert, scope),
      generatedAt
    });
    const hardSelectionBlocker = downstreamHandoff.deliverySelection.blockerCodes.find((code: string) => [
      "replay_already_delivered",
      "duplicate_delivered_dedupe",
      "archived_org",
      "retired_watchlist",
      "disabled_destination",
      "closed_alert",
      "suppressed_alert",
      "revoked_actor",
      "no_active_source_match"
    ].includes(code));
    if (hardSelectionBlocker) {
      const deliveryId = stableId("dwm_delivery", `${tenantId}:${alert.id}:${hardSelectionBlocker}:${generatedAt}`);
      const delivery = (options.store as any).saveDwmWebhookDelivery({
        id: deliveryId,
        organizationId: deliveryOrgId,
        tenantId,
        alertId: alert.id,
        watchlistId: alert.watchlistIds?.[0] ?? watchlist?.id ?? "delivery_selection_blocked",
        webhookDestinationId: downstreamHandoff.deliverySelection.selectedWebhookDestinationId,
        endpointHash: String(hardSelectionBlocker),
        dedupeKey: alert.webhookDelivery?.dedupeKey ?? downstreamHandoff.deliverySelection.deliveryDedupeKey ?? deliveryId,
        attemptedAt: generatedAt,
        dryRun,
        payloadHash: "not_sent",
        deliveryKind: "generic",
        status: "skipped",
        httpStatus: 0,
        error: `Delivery selection blocked by ${String(hardSelectionBlocker).replaceAll("_", " ")}.`
      });
      deliveries.push(delivery);
      refreshAlertDeliveryReadiness(options, alert, { ...scope, organizationId: deliveryOrgId }, [delivery], generatedAt);
      continue;
    }
    const requestedDestinationId = body.webhookDestinationId ? String(body.webhookDestinationId) : downstreamHandoff.deliverySelection.selectedWebhookDestinationId;
    const destination = selectWebhookDestination(options, deliveryOrgDestinations, watchlist, requestedDestinationId);
    const disabledDestination = findDisabledWebhookDestination(options, requestedDestinationId ?? watchlist?.webhookDestinationId);
    if (!watchlist || disabledDestination) {
      const deliveryId = stableId("dwm_delivery", `${tenantId}:${alert.id}:${disabledDestination ? "disabled-destination" : "retired-watchlist"}:${generatedAt}`);
      const delivery = (options.store as any).saveDwmWebhookDelivery({
        id: deliveryId,
        organizationId: deliveryOrgId,
        tenantId,
        alertId: alert.id,
        watchlistId: alert.watchlistIds?.[0] ?? "retired_watchlist",
        webhookDestinationId: disabledDestination?.id,
        endpointHash: disabledDestination ? "disabled_webhook_destination" : "retired_watchlist",
        dedupeKey: alert.webhookDelivery?.dedupeKey ?? deliveryId,
        attemptedAt: generatedAt,
        dryRun,
        payloadHash: "not_sent",
        deliveryKind: disabledDestination?.kind ?? "generic",
        status: "skipped",
        httpStatus: 0,
        error: disabledDestination ? "Webhook destination is disabled for this organization." : "No active watchlist remains for this alert."
      });
      deliveries.push(delivery);
      refreshAlertDeliveryReadiness(options, alert, { ...scope, organizationId: deliveryOrgId }, [delivery], generatedAt);
      continue;
    }
    const destinationUrl = normalizeWebhookUrl(destination?.url);
    const watchlistWebhookUrl = normalizeWebhookUrl(watchlist?.webhookUrl);
    const webhookUrl = explicitWebhookUrl ?? (requestedDestinationId ? destinationUrl : watchlistWebhookUrl ?? destinationUrl);
    const deliveryKind = webhookUrl ? inferWebhookKind(webhookUrl) : destination?.kind ?? "generic";
    if (!webhookUrl) {
      const deliveryId = stableId("dwm_delivery", `${tenantId}:${alert.id}:missing-webhook:${generatedAt}`);
      const delivery = (options.store as any).saveDwmWebhookDelivery({
        id: deliveryId,
        organizationId: deliveryOrgId,
        tenantId,
        alertId: alert.id,
        watchlistId: alert.watchlistIds?.[0] ?? "missing_watchlist",
        webhookDestinationId: destination?.id,
        endpointHash: "missing_webhook_url",
        dedupeKey: alert.webhookDelivery?.dedupeKey ?? deliveryId,
        attemptedAt: generatedAt,
        dryRun,
        payloadHash: "not_sent",
        deliveryKind,
        status: "skipped",
        httpStatus: 0,
        error: "No webhook URL configured for the active watchlist."
      });
      deliveries.push(delivery);
      refreshAlertDeliveryReadiness(options, alert, { ...scope, organizationId: deliveryOrgId }, [delivery], generatedAt);
      continue;
    }
    if (explicitWebhookUrl && body.attachToWatchlist === true) {
      (options.store as any).saveDwmWatchlist?.({ ...watchlist, webhookUrl: explicitWebhookUrl, updatedAt: generatedAt });
    }
    const payload = buildWebhookPayload(alert, watchlist, generatedAt, destination, downstreamHandoff);
    const requestBody = buildWebhookRequestBody(deliveryKind, payload);
    const deliveryId = stableId("dwm_delivery", `${tenantId}:${alert.id}:${destination?.id ?? watchlist.id}:${alert.webhookDelivery?.dedupeKey ?? ""}`);
    const deliveryCaseId = requestedCaseId ?? alert.caseId ?? alert.workflowContext?.caseId;
    const deliveryCasePath = requestedCasePath ?? alert.casePath ?? alert.workflowContext?.casePath;
    const baseDelivery = {
      id: deliveryId,
      organizationId: deliveryOrgId,
      tenantId,
      alertId: alert.id,
      caseId: deliveryCaseId,
      casePath: deliveryCasePath,
      watchlistId: watchlist.id,
      webhookDestinationId: destination?.id,
      endpointHash: stableId("endpoint", webhookUrl),
      dedupeKey: alert.webhookDelivery?.dedupeKey ?? deliveryId,
      attemptedAt: generatedAt,
      dryRun,
      payloadHash: stableId("payload", JSON.stringify(requestBody)),
      deliveryKind
    };

    if (dryRun) {
      const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: "dry_run", httpStatus: 0 });
      deliveries.push(delivery);
      refreshAlertDeliveryReadiness(options, alert, { ...scope, organizationId: deliveryOrgId }, [delivery], generatedAt);
      continue;
    }

    try {
      if (fetcher === fetch) await assertPublicWebhookTarget(webhookUrl);
      const response = await fetcher(webhookUrl, {
        method: "POST",
        redirect: "error",
        headers: webhookHeaders("darkweb.monitoring.match", deliveryId, baseDelivery.dedupeKey),
        body: JSON.stringify(requestBody)
      });
      const ok = response.status >= 200 && response.status < 300;
      const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: ok ? "delivered" : "failed", httpStatus: response.status });
      deliveries.push(delivery);
      const nextAlert = ok ? { ...alert, deliveryState: "delivered", deliveredAt: generatedAt } : alert;
      refreshAlertDeliveryReadiness(options, nextAlert, { ...scope, organizationId: deliveryOrgId }, [delivery], generatedAt);
    } catch (error) {
      const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: "failed", httpStatus: 0, error: error instanceof Error ? error.message : String(error) });
      deliveries.push(delivery);
      refreshAlertDeliveryReadiness(options, alert, { ...scope, organizationId: deliveryOrgId }, [delivery], generatedAt);
    }
  }

  return json({
    organization: scope.organization,
    visibilityDecision: access.visibilityDecision,
    deliveredAt: generatedAt,
    attemptedCount: deliveries.length,
    deliveries: deliveries.map((delivery) => withDwmWebhookOperatorDeliveryTrace(delivery))
  });
}

export async function testDwmWebhook(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  const tenantId = scope.tenantId;
  const watchlists = ((options.store as any).listDwmWatchlists?.() ?? []).filter((row: DwmWatchlist) => row.tenantId === tenantId && row.status === "active");
  const watchlist = body.watchlistId ? watchlists.find((row: DwmWatchlist) => row.id === body.watchlistId) : watchlists.find((row: DwmWatchlist) => row.webhookUrl) ?? watchlists[0];
  const destination = selectWebhookDestination(options, organizationWebhookDestinations(options, scope.organizationId), watchlist, body.webhookDestinationId ? String(body.webhookDestinationId) : undefined);
  const webhookUrl = normalizeWebhookUrl(body.webhookUrl) ?? normalizeWebhookUrl(destination?.url) ?? normalizeWebhookUrl(watchlist?.webhookUrl);
  if (!webhookUrl) return json({ error: { code: "missing_webhook_url", message: "Save a valid webhook URL before testing delivery." } }, 400);

  const generatedAt = nowIso();
  const fetcher = typeof options.webhookFetch === "function" ? options.webhookFetch as typeof fetch : fetch;
  const deliveryId = stableId("dwm_delivery", `${tenantId}:webhook_test:${webhookUrl}:${generatedAt}`);
  const deliveryKind = destination?.kind ?? inferWebhookKind(webhookUrl);
  const payload = {
    eventType: "darkweb.monitoring.test",
    organizationId: scope.organizationId,
    tenantId,
    watchlistId: watchlist?.id ?? "ad_hoc_webhook_test",
    webhookDestinationId: destination?.id,
    notificationTarget: {
      organizationId: scope.organizationId,
      tenantId,
      watchlistId: watchlist?.id ?? "ad_hoc_webhook_test",
      webhookDestinationId: destination?.id,
      deliveryKind
    },
    generatedAt,
    message: "Hanasand dark web monitoring webhook test.",
    expectedAlertEvent: "darkweb.monitoring.match"
  };
  const requestBody = buildWebhookRequestBody(deliveryKind, payload);
  const baseDelivery = {
    id: deliveryId,
    organizationId: scope.organizationId,
    tenantId,
    alertId: "webhook_test",
    watchlistId: watchlist?.id ?? "ad_hoc_webhook_test",
    webhookDestinationId: destination?.id,
    endpointHash: stableId("endpoint", webhookUrl),
    dedupeKey: deliveryId,
    attemptedAt: generatedAt,
    dryRun: body.dryRun === true,
    payloadHash: stableId("payload", JSON.stringify(requestBody)),
    deliveryKind
  };

  if (body.dryRun === true) {
    const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, id: stableId("dwm_delivery", `${deliveryId}:dry_run`), status: "dry_run", httpStatus: 0 });
    return json({ visibilityDecision: access.visibilityDecision, testedAt: generatedAt, ok: true, dryRun: true, delivery: withDwmWebhookOperatorDeliveryTrace(delivery) });
  }

  try {
    if (fetcher === fetch) await assertPublicWebhookTarget(webhookUrl);
    const response = await fetcher(webhookUrl, {
      method: "POST",
      redirect: "error",
      headers: webhookHeaders("darkweb.monitoring.test", deliveryId, deliveryId),
      body: JSON.stringify(requestBody)
    });
    const ok = response.status >= 200 && response.status < 300;
    const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, id: stableId("dwm_delivery", `${deliveryId}:${response.status}`), status: ok ? "delivered" : "failed", httpStatus: response.status });
    return json({ visibilityDecision: access.visibilityDecision, testedAt: generatedAt, ok, delivery: withDwmWebhookOperatorDeliveryTrace(delivery) }, ok ? 200 : 502);
  } catch (error) {
    const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, id: stableId("dwm_delivery", `${deliveryId}:network_error`), status: "failed", httpStatus: 0, error: error instanceof Error ? error.message : String(error) });
    return json({ visibilityDecision: access.visibilityDecision, testedAt: generatedAt, ok: false, delivery: withDwmWebhookOperatorDeliveryTrace(delivery) }, 502);
  }
}

export function storedWatchlistTerms(options: ApiServerOptions, tenantId: string | undefined): DwmWatchTerm[] {
  return ((options.store as any).listDwmWatchlists?.() ?? [])
    .filter((row: DwmWatchlist) => (!tenantId || row.tenantId === tenantId) && row.status === "active")
    .flatMap((row: DwmWatchlist) => row.terms);
}

function buildWebhookPayload(alert: any, watchlist: DwmWatchlist, generatedAt: string, destination?: WebhookDestination, downstreamHandoff?: ReturnType<typeof buildDwmAlertDownstreamHandoff>) {
  const alertCreatedDispatch = buildWebhookPayloadAlertCreatedDispatch(alert, watchlist, destination, downstreamHandoff);
  return {
    eventType: alert.eventType,
    alertId: alert.id,
    organizationId: alert.organizationId ?? watchlist.organizationId,
    tenantId: alert.tenantId,
    watchlistId: watchlist.id,
    webhookDestinationId: destination?.id,
    notificationTarget: {
      organizationId: alert.organizationId ?? watchlist.organizationId,
      tenantId: alert.tenantId,
      watchlistId: watchlist.id,
      webhookDestinationId: destination?.id ?? watchlist.webhookDestinationId,
      assignedOwner: alert.assignedOwner,
      deliveryKind: destination?.kind ?? (normalizeWebhookUrl(watchlist.webhookUrl)?.includes("discord") ? "discord" : undefined)
    },
    generatedAt,
    severity: alert.severity,
    confidence: alert.confidence,
    confidenceReasoning: alert.confidenceReasoning ?? [],
    provenance: alert.provenance,
    dedupeKey: alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey,
    alertDetailPath: alertDetailPathFor(alert),
    caseIdCandidate: alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate,
    caseId: alert.caseId,
    casePath: alert.casePath ?? alert.workflowContext?.casePath,
    watchlistItemIds: alert.watchlistItemIds ?? alert.workflowContext?.watchlistItemIds ?? [],
    alertGeneratorKeys: alert.workflowContext?.alertGeneratorKeys ?? alert.webhookContext?.alertGeneratorKeys ?? [],
    captureIds: alert.workflowContext?.captureIds ?? alert.provenance?.captureIds ?? [],
    selectedCaptureIds: alert.deliveryReadinessContext?.selectedCaptureIds ?? alert.workflowContext?.captureIds ?? alert.provenance?.captureIds ?? [],
    evidenceCount: alert.workflowContext?.evidenceCount ?? (alert.evidence ?? []).length,
    alertCreatedEvent: alert.alertCreatedEvent,
    alertCreatedEventId: alert.alertCreatedEvent?.id ?? alert.deliveryReadinessContext?.alertCreatedEventId,
    alertCreatedAt: alert.alertCreatedEvent?.at ?? alert.deliveryReadinessContext?.alertCreatedAt,
    alertUpdatedEvent: alert.alertUpdatedEvent,
    alertUpdatedEventId: alert.alertUpdatedEvent?.id,
    alertUpdatedAt: alert.alertUpdatedEvent?.at,
    alertEvents: alert.alertEvents ?? [],
    alertCreatedDispatch,
    generationEvidenceWindow: alert.deliveryReadinessContext?.generationEvidenceWindow ?? alert.workflowContext?.generationEvidenceWindow ?? alert.webhookContext?.generationEvidenceWindow,
    deliveryReadinessContext: alert.deliveryReadinessContext,
    deliveryDedupeKey: alert.deliveryReadinessContext?.deliveryDedupeKey ?? alert.webhookDelivery?.dedupeKey ?? alert.dedupeKey,
    replayMarker: alert.deliveryReadinessContext?.replayMarker,
    company: alert.company,
    matchedTerm: alert.matchedTerm?.value,
    actor: alert.actor,
    artifactType: alert.artifactType,
    sourceFamily: alert.sourceFamily,
    sourceCount: alert.sourceCount,
    firstSeenAt: alert.firstSeenAt,
    lastSeenAt: alert.lastSeenAt,
    assertionKind: alert.assertionKind ?? "source_claim",
    observedMatchSummary: alert.observedMatchSummary,
    claimSummary: buildDwmCustomerAlertSummary(alert),
    matchContext: alert.matchContext,
    evidenceSummary: alert.evidenceSummary,
    routingContext: alert.routingContext,
    workflowStatus: alert.workflowStatus ?? "new",
    workflowSummary: buildDwmAlertWorkflowSummary(alert),
    assignedOwner: alert.assignedOwner,
    severityOverride: alert.severityOverride,
    reviewState: alert.reviewState,
    recommendedAction: alert.recommendedAction,
    recommendedRoute: alert.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute,
    evidence: (alert.evidence ?? []).map((item: any) => ({
      id: item.id,
      sourceName: item.sourceName,
      sourceFamily: item.sourceFamily,
      observedAt: item.observedAt ?? item.firstSeenAt,
      captureMode: item.captureMode,
      redactionState: item.redactionState,
      excerpt: sanitizeDwmCustomerEvidenceExcerpt(item.excerpt, item.contentHash),
      contentHash: item.contentHash,
      provenance: item.provenance
    })),
    delivery: alert.webhookDelivery
  };
}

function buildWebhookPayloadAlertCreatedDispatch(alert: any, watchlist: DwmWatchlist, destination?: WebhookDestination, downstreamHandoff?: ReturnType<typeof buildDwmAlertDownstreamHandoff>) {
  const dispatch = downstreamHandoff?.createdEventDispatch;
  if (!dispatch) return undefined;
  const dispatchWithRoutes = dispatch as typeof dispatch & { webhookDestinationIds?: string[] };
  const organizationId = dispatch.organizationId ?? alert.organizationId ?? watchlist.organizationId;
  const tenantId = dispatch.tenantId ?? alert.tenantId ?? watchlist.tenantId;
  const selectedDestinationIds = [
    destination?.id,
    alert.webhookDestinationId,
    alert.webhookDelivery?.webhookDestinationId,
    alert.deliveryReadinessContext?.webhookDestinationIds?.[0],
    alert.workflowContext?.webhookDestinationIds?.[0],
    alert.webhookContext?.webhookDestinationIds?.[0],
    watchlist.webhookDestinationId
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const hasSelectedWebhookRoute = Boolean(
    selectedDestinationIds.length
      || normalizeWebhookUrl(destination?.url)
      || normalizeWebhookUrl(alert.webhookUrl)
      || normalizeWebhookUrl(alert.webhookDelivery?.webhookUrl)
      || normalizeWebhookUrl(watchlist.webhookUrl)
  );
  const hasOrgContext = Boolean(organizationId ?? tenantId);
  const blockerCodes = (dispatch.blockerCodes ?? []).filter((code: string) => {
    if (hasSelectedWebhookRoute && ["destination_unavailable", "delivery_disabled"].includes(code)) return false;
    if (hasOrgContext && code === "missing_org_ref") return false;
    return true;
  });
  return {
    ...dispatch,
    organizationId,
    tenantId,
    webhookDestinationIds: dispatchWithRoutes.webhookDestinationIds?.length ? dispatchWithRoutes.webhookDestinationIds : selectedDestinationIds,
    blockerCodes,
    ready: Boolean(dispatch.eventId) && blockerCodes.length === 0
  };
}

function selectWebhookDestination(options: ApiServerOptions, orgDestinations: WebhookDestination[], watchlist: DwmWatchlist | undefined, requestedDestinationId?: string): WebhookDestination | undefined {
  if (requestedDestinationId) return orgDestinations.find((row) => row.id === requestedDestinationId);
  const watchlistDestination = findWebhookDestination(options, watchlist?.webhookDestinationId);
  if (watchlistDestination && orgDestinations.some((row) => row.id === watchlistDestination.id)) return watchlistDestination;
  return orgDestinations[0];
}

function findDisabledWebhookDestination(options: ApiServerOptions, destinationId: string | undefined): WebhookDestination | undefined {
  const destination = findWebhookDestination(options, destinationId);
  return destination && destination.status !== "active" ? destination : undefined;
}

function refreshAlertDeliveryReadiness(options: ApiServerOptions, alert: any, scope: { tenantId: string; organizationId?: string }, deliveries: any[], generatedAt: string) {
  const allDeliveries = [
    ...(((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === alert.id)),
    ...deliveries
  ];
  return (options.store as any).saveDwmAlert({
    ...alert,
    deliveryReadinessContext: buildDwmPersistedDeliveryReadinessContext({
      alert,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId ?? alert.organizationId,
      workflowContext: alert.workflowContext,
      existing: alert,
      deliveries: allDeliveries,
      generatedAt
    })
  });
}

type DwmWorkflowAccessMode = "read" | "mutate";
type DwmVisibilityPolicy = "members" | "admins" | "owners";
type DwmVisibilityDenyReason = "not_member" | "member_removed" | "member_deactivated" | "role_not_allowed";
type DwmAlertWorkflowStatus = "new" | "triaged" | "investigating" | "suppressed" | "closed" | "reopened";
type DwmAlertSeverity = "critical" | "high" | "medium" | "low";
type DwmVisibilityDecision = {
  allowed: boolean;
  reason: DwmVisibilityDenyReason | null;
  alertVisibilityPolicy: DwmVisibilityPolicy;
  allowedRoles: string[];
};
type DwmWorkflowAccessResult = {
  member?: OrganizationMember;
  readOnly: boolean;
  visibilityDecision: DwmVisibilityDecision;
  error?: Response;
};

const allowedWorkflowStatuses = new Set<DwmAlertWorkflowStatus>(["new", "triaged", "investigating", "suppressed", "closed", "reopened"]);
const allowedReviewStates = new Set(["needs_review", "validate_identity", "route_to_customer", "watching", "false_positive_candidate", "reviewing", "resolved", "false_positive"]);
const allowedDeliveryStates = new Set(["pending_review", "ready_to_send", "sent", "delivered", "failed", "muted"]);

function resolveAlertWorkflowTransition(existing: any, body: any): { workflowStatus: DwmAlertWorkflowStatus; reviewState: string; deliveryState: string; error?: Response } {
  const requested = body.workflowStatus ?? body.status ?? statusForAction(body.action);
  const workflowStatus = normalizeWorkflowStatus(requested, existing.workflowStatus ?? "new");
  if (!workflowStatus) return { workflowStatus: "new", reviewState: existing.reviewState, deliveryState: existing.deliveryState, error: json({ error: { code: "invalid_workflow_status", message: "Workflow status must be new, triaged, investigating, suppressed, closed, or reopened." } }, 400) };
  const defaults = defaultsForWorkflowStatus(workflowStatus, existing);
  const reviewState = body.reviewState === undefined ? defaults.reviewState : String(body.reviewState);
  const deliveryState = body.deliveryState === undefined ? defaults.deliveryState : String(body.deliveryState);
  if (!allowedReviewStates.has(reviewState)) return { workflowStatus, reviewState, deliveryState, error: json({ error: { code: "invalid_review_state", message: "Unsupported DWM alert review state." } }, 400) };
  if (!allowedDeliveryStates.has(deliveryState)) return { workflowStatus, reviewState, deliveryState, error: json({ error: { code: "invalid_delivery_state", message: "Unsupported DWM alert delivery state." } }, 400) };
  return { workflowStatus, reviewState, deliveryState };
}

function statusForAction(action: unknown): string | undefined {
  const normalized = String(action ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "triage" || normalized === "triaged") return "triaged";
  if (normalized === "investigate" || normalized === "investigating" || normalized === "assign") return "investigating";
  if (normalized === "suppress" || normalized === "suppressed") return "suppressed";
  if (normalized === "close" || normalized === "closed" || normalized === "resolve") return "closed";
  if (normalized === "reopen" || normalized === "reopened") return "reopened";
  if (normalized === "note") return undefined;
  return normalized;
}

function normalizeWorkflowStatus(value: unknown, fallback: DwmAlertWorkflowStatus): DwmAlertWorkflowStatus | undefined {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  return allowedWorkflowStatuses.has(normalized as DwmAlertWorkflowStatus) ? normalized as DwmAlertWorkflowStatus : undefined;
}

function defaultsForWorkflowStatus(status: DwmAlertWorkflowStatus, existing: any): { reviewState: string; deliveryState: string } {
  if (status === "new") return { reviewState: existing.reviewState ?? "needs_review", deliveryState: existing.deliveryState ?? "pending_review" };
  if (status === "triaged") return { reviewState: "reviewing", deliveryState: existing.deliveryState ?? "pending_review" };
  if (status === "investigating") return { reviewState: "validate_identity", deliveryState: existing.deliveryState ?? "pending_review" };
  if (status === "suppressed") return { reviewState: "false_positive", deliveryState: "muted" };
  if (status === "closed") return { reviewState: "resolved", deliveryState: existing.deliveryState === "delivered" ? "delivered" : "muted" };
  return { reviewState: "reviewing", deliveryState: existing.deliveryState === "muted" ? "pending_review" : existing.deliveryState ?? "pending_review" };
}

function normalizeSeverityOverride(value: unknown): DwmAlertSeverity | null | undefined {
  if (value === null || value === "" || value === false) return null;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  return ["critical", "high", "medium", "low"].includes(normalized) ? normalized as DwmAlertSeverity : undefined;
}

function normalizeWorkflowText(value: unknown): string | undefined {
  const text = String(value ?? "").trim().slice(0, 500);
  return text || undefined;
}

function requiresWorkflowRationale(next: DwmAlertWorkflowStatus, previous: unknown): boolean {
  return (next === "suppressed" || next === "closed") && next !== previous;
}

function resolveDwmAlertScope(input: { alert: any; body?: any; url?: URL; request?: Request }, options: ApiServerOptions) {
  const body = {
    ...(input.body ?? {}),
    organizationId: input.body?.organizationId ?? input.body?.orgId ?? input.alert?.organizationId,
    tenantId: input.body?.tenantId ?? input.alert?.tenantId
  };
  return resolveOrganizationScope({ body, url: input.url, request: input.request }, options);
}

function resolveDwmWatchlistScope(input: { watchlist: DwmWatchlist; body?: any; url?: URL; request?: Request }, options: ApiServerOptions) {
  const body = {
    ...(input.body ?? {}),
    organizationId: input.watchlist.organizationId ?? input.body?.organizationId ?? input.body?.orgId,
    tenantId: input.watchlist.tenantId ?? input.body?.tenantId
  };
  return resolveOrganizationScope({ body, url: input.url, request: input.request }, options);
}

export function authorizeDwmWorkflowAccess(input: { options: ApiServerOptions; scope: { organizationId?: string; organization?: unknown }; request?: Request; url?: URL; body?: any; mode: DwmWorkflowAccessMode }): DwmWorkflowAccessResult {
  const visibilityPolicy = organizationAlertVisibilityPolicy(input.scope.organization);
  const allowedRoles = allowedDwmVisibilityRoles(visibilityPolicy);
  const openDecision: DwmVisibilityDecision = { allowed: true, reason: null, alertVisibilityPolicy: visibilityPolicy, allowedRoles };
  const members = organizationMembers(input.options, input.scope.organizationId);
  if (!input.scope.organizationId || !members.length) return { readOnly: false, visibilityDecision: openDecision };

  const identity = requestIdentity(input.request, input.body, input.url);
  if (!identity.length) {
    const visibilityDecision: DwmVisibilityDecision = { allowed: false, reason: "not_member", alertVisibilityPolicy: visibilityPolicy, allowedRoles };
    return { readOnly: true, visibilityDecision, error: dwmVisibilityError(visibilityDecision, "DWM alert access requires an active organization member identity.") };
  }

  const member = members.find((row) => identityMatchesMember(identity, row));
  if (!member) {
    const visibilityDecision: DwmVisibilityDecision = { allowed: false, reason: "not_member", alertVisibilityPolicy: visibilityPolicy, allowedRoles };
    return { readOnly: true, visibilityDecision, error: dwmVisibilityError(visibilityDecision, "DWM alert access is limited to active organization members.") };
  }

  const visibilityDecision = dwmVisibilityDecision(member, visibilityPolicy);
  if (!visibilityDecision.allowed) {
    return { member, readOnly: true, visibilityDecision, error: dwmVisibilityError(visibilityDecision, "DWM alert evidence is not visible for this organization membership.") };
  }

  const readOnly = member.role === "viewer";
  if (input.mode === "mutate" && readOnly) {
    return { member, readOnly, visibilityDecision, error: json({ error: { code: "dwm_read_only_member", message: "Viewer members can read DWM alerts but cannot mutate workflow state, replay evidence, or deliver webhooks." }, visibilityDecision }, 403) };
  }
  return { member, readOnly, visibilityDecision };
}

function organizationMembers(options: ApiServerOptions, organizationId: string | undefined): OrganizationMember[] {
  if (!organizationId) return [];
  return ((options.store as any).listOrganizationMembers?.() ?? [])
    .filter((row: OrganizationMember) => row.organizationId === organizationId);
}

function requestIdentity(request: Request | undefined, body?: any, url?: URL): string[] {
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
    body?.actor,
    url?.searchParams.get("userEmail"),
    url?.searchParams.get("userId"),
    url?.searchParams.get("actor")
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

function dwmVisibilityDecision(member: OrganizationMember, alertVisibilityPolicy: DwmVisibilityPolicy): DwmVisibilityDecision {
  const allowedRoles = allowedDwmVisibilityRoles(alertVisibilityPolicy);
  if ((member as any).userActive === false || (member as any).active === false || (member as any).deactivatedAt || (member as any).deactivated_at) {
    return { allowed: false, reason: "member_deactivated", alertVisibilityPolicy, allowedRoles };
  }
  if (member.status !== "active") {
    return { allowed: false, reason: member.status === "removed" ? "member_removed" : "member_deactivated", alertVisibilityPolicy, allowedRoles };
  }
  const role = normalizeVisibilityRole(member.role);
  if (!allowedRoles.includes(role)) {
    return { allowed: false, reason: "role_not_allowed", alertVisibilityPolicy, allowedRoles };
  }
  return { allowed: true, reason: null, alertVisibilityPolicy, allowedRoles };
}

function dwmVisibilityError(decision: DwmVisibilityDecision, message: string): Response {
  return json({
    error: {
      code: "organization_visibility_denied",
      message,
      reason: decision.reason
    },
    visibilityDecision: decision
  }, 403);
}

function organizationAlertVisibilityPolicy(organization: unknown): DwmVisibilityPolicy {
  const value = String((organization as any)?.alertVisibilityPolicy ?? (organization as any)?.alert_visibility_policy ?? "members");
  return value === "admins" || value === "owners" ? value : "members";
}

function allowedDwmVisibilityRoles(policy: DwmVisibilityPolicy): string[] {
  if (policy === "owners") return ["owner"];
  if (policy === "admins") return ["owner", "admin"];
  return ["owner", "admin", "analyst", "member", "viewer"];
}

function normalizeVisibilityRole(role: unknown): string {
  const value = String(role ?? "").trim().toLowerCase();
  return value === "member" ? "analyst" : value;
}

function findDwmAlert(options: ApiServerOptions, alertId: string | undefined) {
  if (!alertId) return undefined;
  return (options.store as any).getDwmAlert?.(alertId) ?? ((options.store as any).listDwmAlerts?.() ?? []).find((row: any) => row.id === alertId);
}

function findDwmWatchlist(options: ApiServerOptions, watchlistId: string | undefined): DwmWatchlist | undefined {
  if (!watchlistId) return undefined;
  return (options.store as any).getDwmWatchlist?.(watchlistId) ?? ((options.store as any).listDwmWatchlists?.() ?? []).find((row: DwmWatchlist) => row.id === watchlistId);
}

function enforceDwmWatchlistEntitlement(input: {
  options: ApiServerOptions;
  request: Request;
  body: any;
  scope: { organizationId?: string; tenantId: string };
  access: DwmWorkflowAccessResult;
  watchlist: DwmWatchlist;
  action: "create_dwm_watchlist" | "update_dwm_watchlist";
}): { adapter?: ReturnType<typeof buildDwmEntitlementReadAdapter>; error?: Response } {
  const result = evaluateProposedDwmWatchlistEntitlement(input.options, {
    organizationId: input.scope.organizationId,
    tenantId: input.scope.tenantId,
    watchlistId: input.watchlist.id,
    terms: input.watchlist.terms,
    status: input.watchlist.status,
    webhookDestinationId: input.watchlist.webhookDestinationId
  });
  if (!result.evaluation) return {};

  const requestId = entitlementRequestId(input.request, input.body);
  const actor = entitlementActor(input.request, input.body, input.access);
  if (!result.allowed && result.reason) {
    return {
      error: json({
        ...buildDwmEntitlementBlocker({ action: input.action, reason: result.reason, evaluation: result.evaluation, requestId, actor }),
        visibilityDecision: input.access.visibilityDecision
      }, 402)
    };
  }
  return { adapter: buildDwmEntitlementReadAdapter({ action: input.action, reason: null, evaluation: result.evaluation, requestId, actor }) };
}

function enforceDwmAlertRebuildEntitlement(input: {
  options: ApiServerOptions;
  request: Request;
  body: any;
  scope: { organizationId?: string; tenantId: string };
  access: DwmWorkflowAccessResult;
  action: "rebuild_dwm_alerts" | "replay_dwm_alert";
}): { adapter?: ReturnType<typeof buildDwmEntitlementReadAdapter>; error?: Response; requestId?: string; actor?: string } {
  const result = evaluateProposedDwmAlertRebuildEntitlement(input.options, {
    organizationId: input.scope.organizationId,
    tenantId: input.scope.tenantId
  });
  if (!result.evaluation) return {};

  const requestId = entitlementRequestId(input.request, input.body);
  const actor = entitlementActor(input.request, input.body, input.access);
  if (!result.allowed && result.reason) {
    return {
      requestId,
      actor,
      error: json({
        ...buildDwmEntitlementBlocker({ action: input.action, reason: result.reason, evaluation: result.evaluation, requestId, actor }),
        visibilityDecision: input.access.visibilityDecision
      }, 402)
    };
  }
  return { requestId, actor, adapter: buildDwmEntitlementReadAdapter({ action: input.action, reason: null, evaluation: result.evaluation, requestId, actor }) };
}

function findDwmAlertByDedupeKey(options: ApiServerOptions, dedupeKey: string | undefined) {
  if (!dedupeKey) return undefined;
  return ((options.store as any).listDwmAlerts?.() ?? []).find((row: any) => row.dedupeKey === dedupeKey || row.webhookDelivery?.dedupeKey === dedupeKey);
}

function buildDwmWatchlistDetail(watchlist: DwmWatchlist, options: ApiServerOptions, access?: DwmWorkflowAccessResult) {
  const alerts = ((options.store as any).listDwmAlerts?.() ?? [])
    .filter((row: any) => row.tenantId === watchlist.tenantId && Array.isArray(row.watchlistIds) && row.watchlistIds.includes(watchlist.id));
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? [])
    .filter((row: any) => row.tenantId === watchlist.tenantId && (row.watchlistId === watchlist.id || alerts.some((alert: any) => alert.id === row.alertId)));
  const { webhookUrl: _webhookUrl, ...safeWatchlist } = watchlist;
  return {
    ...safeWatchlist,
    webhookUrlConfigured: Boolean(watchlist.webhookUrl),
    webhookEndpointHash: watchlist.webhookUrl ? stableId("endpoint", watchlist.webhookUrl) : undefined,
    webhookEndpointHint: watchlist.webhookUrl ? redactWebhookEndpointForWatchlist(watchlist.webhookUrl) : undefined,
    visibilityDecision: access?.visibilityDecision,
    workflowContext: {
      alertCount: alerts.length,
      alertIds: alerts.map((alert: any) => alert.id),
      caseIds: alerts.map((alert: any) => alert.caseIdCandidate).filter(Boolean),
      webhookDeliveryIds: deliveries.map((delivery: any) => delivery.id),
      activeForAlertGeneration: watchlist.status === "active"
    }
  };
}

function redactWebhookEndpointForWatchlist(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const visiblePath = parts.length ? `/${parts.slice(0, Math.min(parts.length, 3)).join("/")}` : "";
    return `${url.origin}${visiblePath}/...`;
  } catch {
    return "redacted_webhook_endpoint";
  }
}

function ensureSourceMatchedDwmWatchlist(options: ApiServerOptions, scope: { organization?: any; organizationId?: string; tenantId: string }): { watchlist?: DwmWatchlist; termValues: string[]; reason: string } {
  const store = options.store as any;
  const watchlists = (store.listDwmWatchlists?.() ?? []) as DwmWatchlist[];
  const sources: SourceRecord[] = options.store.listSources().filter((source: SourceRecord) => sourceVisibleForScope(source, scope.tenantId));
  const sourceIds = new Set(sources.map((source: SourceRecord) => String((source as any).id)));
  const captures: RawCapture[] = options.store.listCaptures().filter((capture: RawCapture) => captureVisibleForScope(capture, scope.tenantId, sourceIds));
  const readiness = buildDwmAlertGenerationReadiness({
    watchlists,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    visibilityPolicy: organizationAlertVisibilityPolicy(scope.organization),
    sources,
    captures
  });
  if (readiness.counts.matchedCandidateCount > 0) {
    const backfilled = backfillSourceMatchedDeliveryRoutes({
      options,
      scope,
      watchlists,
      generatedAt: nowIso()
    });
    return {
      watchlist: backfilled.watchlist,
      termValues: backfilled.termValues,
      reason: backfilled.watchlist ? "existing_watchlist_delivery_route_backfilled" : "existing_watchlist_matches_capture"
    };
  }

  if (scope.organizationId) return { termValues: [], reason: "organization_watchlist_required" };

  const terms = sourceMatchedWatchlistTerms({ captures, sources }).slice(0, 3);
  if (!terms.length) return { termValues: [], reason: "no_capture_terms" };

  const generatedAt = nowIso();
  const route = ensureSourceMatchedDeliveryRoute(options, scope, generatedAt);
  const webhookDestinationId = organizationWebhookDestinations(options, scope.organizationId)[0]?.id ?? route.webhookDestinationId;
  const id = stableId("dwm_watchlist", `${scope.tenantId}:${scope.organizationId ?? "default"}:source_matched:${terms.map((term) => term.value).join("|")}`);
  const existing = store.getDwmWatchlist?.(id);
  if (existing && existing.tenantId !== scope.tenantId) return { termValues: [], reason: "watchlist_id_conflict" };
  const runtime = sourceMatchedOrgRuntime({
    id,
    tenantId: scope.tenantId,
    organizationId: route.organizationId,
    terms,
    existing
  });

  const watchlist: DwmWatchlist = {
    id,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId ?? existing?.organizationId ?? route.organizationId,
    name: existing?.name ?? "Source-matched exposure watchlist",
    terms: mergeDwmWatchTerms(existing?.terms ?? [], terms),
    webhookDestinationId: webhookDestinationId ?? existing?.webhookDestinationId,
    webhookUrl: existing?.webhookUrl,
    status: "active",
    createdAt: existing?.createdAt ?? generatedAt,
    updatedAt: generatedAt,
    orgWatchlistTerms: runtime.orgWatchlistTerms ?? existing?.orgWatchlistTerms,
    orgMembershipContext: runtime.orgMembershipContext ?? existing?.orgMembershipContext
  };
  store.saveDwmWatchlist(watchlist);
  return { watchlist, termValues: terms.map((term) => term.value), reason: "source_capture_term_bootstrap" };
}

function backfillSourceMatchedDeliveryRoutes(input: {
  options: ApiServerOptions;
  scope: { organization?: any; organizationId?: string; tenantId: string };
  watchlists: DwmWatchlist[];
  generatedAt: string;
}): { watchlist?: DwmWatchlist; termValues: string[] } {
  const store = input.options.store as any;
  const route = ensureSourceMatchedDeliveryRoute(input.options, input.scope, input.generatedAt);
  const webhookDestinationId = organizationWebhookDestinations(input.options, input.scope.organizationId)[0]?.id ?? route.webhookDestinationId;
  for (const existing of input.watchlists) {
    if (existing.tenantId !== input.scope.tenantId || existing.status !== "active") continue;
    if (input.scope.organizationId && existing.organizationId !== input.scope.organizationId) continue;
    const terms = termsWithStableIds(existing);
    if (!terms.length) continue;
    const missingWebhook = !existing.webhookDestinationId;
    const missingTermExport = !Array.isArray(existing.orgWatchlistTerms) || existing.orgWatchlistTerms.length === 0;
    const missingMembership = !existing.orgMembershipContext;
    if (!missingWebhook && !missingTermExport && !missingMembership) continue;
    const organizationId = input.scope.organizationId ?? existing.organizationId ?? route.organizationId;
    const runtime = sourceMatchedOrgRuntime({
      id: existing.id,
      tenantId: existing.tenantId,
      organizationId,
      terms,
      existing
    });
    const watchlist: DwmWatchlist = {
      ...existing,
      organizationId: existing.organizationId ?? input.scope.organizationId,
      terms,
      webhookDestinationId: existing.webhookDestinationId ?? webhookDestinationId,
      updatedAt: input.generatedAt,
      orgWatchlistTerms: existing.orgWatchlistTerms?.length ? existing.orgWatchlistTerms : runtime.orgWatchlistTerms,
      orgMembershipContext: existing.orgMembershipContext ?? runtime.orgMembershipContext
    };
    store.saveDwmWatchlist(watchlist);
    return { watchlist, termValues: terms.map((term) => term.value) };
  }
  return { termValues: [] };
}

function termsWithStableIds(watchlist: DwmWatchlist): Array<DwmWatchTerm & { id: string }> {
  return (watchlist.terms ?? [])
    .map((term: any) => {
      const value = String(term?.value ?? term?.term ?? "").trim();
      if (!value) return undefined;
      return {
        ...term,
        id: String(term?.id ?? stableId("dwm_watchlist_item", `${watchlist.id}:${term?.kind ?? "keyword"}:${value.toLowerCase()}`)),
        value
      } as DwmWatchTerm & { id: string };
    })
    .filter(Boolean) as Array<DwmWatchTerm & { id: string }>;
}

function ensureSourceMatchedDeliveryRoute(options: ApiServerOptions, scope: { organizationId?: string; tenantId: string }, generatedAt: string): { organizationId: string; webhookDestinationId?: string } {
  const store = options.store as any;
  const organizationId = scope.organizationId || "default";
  const existingOrg = store.getOrganization?.(organizationId);
  if (!existingOrg && typeof store.saveOrganization === "function") {
    store.saveOrganization({
      id: organizationId,
      tenantId: scope.tenantId,
      name: "Hanasand DWM review",
      slug: "hanasand-dwm-review",
      status: "active",
      createdAt: generatedAt,
      updatedAt: generatedAt
    });
  }

  const webhookDestinationId = stableId("webhook_destination", `${organizationId}:source_matched_dwm_intake`);
  const existingDestination = store.getWebhookDestination?.(webhookDestinationId);
  const configuredWebhookUrl = normalizeWebhookUrl(process.env.DWM_DEFAULT_WEBHOOK_URL);
  if (!existingDestination && configuredWebhookUrl && typeof store.saveWebhookDestination === "function") {
    store.saveWebhookDestination({
      id: webhookDestinationId,
      organizationId,
      tenantId: scope.tenantId,
      name: "Hanasand DWM intake",
      url: configuredWebhookUrl,
      kind: inferWebhookKind(configuredWebhookUrl),
      status: "active",
      createdAt: generatedAt,
      updatedAt: generatedAt,
      createdBy: "source-matched-bootstrap"
    });
  }

  return { organizationId, webhookDestinationId: existingDestination || configuredWebhookUrl ? webhookDestinationId : undefined };
}

function sourceMatchedOrgRuntime(input: {
  id: string;
  tenantId: string;
  organizationId: string;
  terms: Array<DwmWatchTerm & { id: string }>;
  existing?: DwmWatchlist;
}) {
  const exported = buildOrgSharedWatchlistAlertGenerationExport({
    generatedAt: nowIso(),
    member: { role: "owner", status: "active", email: "dwm-intake@hanasand.com" },
    contract: {
      schemaVersion: "organization.watchlist_alert_generation.v1",
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      ownerOrganizationId: input.organizationId,
      visibilityPolicy: "members",
      allowedViewerRoles: ["owner", "admin", "analyst", "member", "viewer"],
      canGenerateAlerts: true,
      downstreamAuthorization: {
        organizationLifecycleState: "active",
        visibility: { allowed: true, allowedRoles: ["owner", "admin", "analyst", "member", "viewer"] },
        downstream: { alertGeneration: { canExportActiveTerms: true, blockerCodes: [] } }
      },
      activeTerms: input.terms.map((term) => ({
        watchlistId: input.id,
        watchlistItemId: term.id,
        itemId: term.id,
        organizationId: input.organizationId,
        tenantId: input.tenantId,
        kind: term.kind === "domain" || term.kind === "company" || term.kind === "vendor" ? term.kind : "keyword",
        term: term.value,
        value: term.value,
        status: "active"
      }))
    }
  });
  const runtime = exported.runtimeWatchlists.find((watchlist) => watchlist.id === input.id) ?? exported.runtimeWatchlists[0];
  return {
    orgWatchlistTerms: runtime?.orgWatchlistTerms ?? input.existing?.orgWatchlistTerms,
    orgMembershipContext: runtime?.orgMembershipContext ?? input.existing?.orgMembershipContext
  };
}

function sourceMatchedWatchlistTerms(input: { captures: RawCapture[]; sources: SourceRecord[] }): Array<DwmWatchTerm & { id: string }> {
  const sourceHosts = new Set(input.sources.flatMap((source) => sourceHostCandidates(source)));
  const byValue = new Map<string, { value: string; kind: DwmWatchTerm["kind"]; captureIds: Set<string>; latestAt: string }>();
  const captures = [...input.captures].sort((a, b) => String((b as any).collectedAt ?? "").localeCompare(String((a as any).collectedAt ?? ""))).slice(0, 100);
  for (const capture of captures) {
    const latestAt = String((capture as any).collectedAt ?? "");
    const text = sourceMatchedCaptureText(capture);
    const domains = extractWatchableDomains(text).filter((domain) => !sourceHosts.has(domain) && !isUnhelpfulWatchDomain(domain));
    for (const domain of domains) {
      const row = byValue.get(domain) ?? { value: domain, kind: "domain" as const, captureIds: new Set<string>(), latestAt };
      row.captureIds.add(String((capture as any).id));
      if (latestAt > row.latestAt) row.latestAt = latestAt;
      byValue.set(domain, row);
    }
    if (domains.length) continue;
    for (const term of sourceMatchedMetadataTerms(capture)) {
      const value = term.value.toLowerCase();
      const row = byValue.get(value) ?? { value, kind: term.kind, captureIds: new Set<string>(), latestAt };
      row.captureIds.add(String((capture as any).id));
      if (latestAt > row.latestAt) row.latestAt = latestAt;
      byValue.set(value, row);
    }
  }
  return [...byValue.values()]
    .filter((row) => row.captureIds.size > 0)
    .sort((a, b) => b.captureIds.size - a.captureIds.size || b.latestAt.localeCompare(a.latestAt) || a.value.localeCompare(b.value))
    .map((row) => ({
      id: stableId("dwm_watchlist_item", `source_matched:${row.kind}:${row.value}`),
      value: row.value,
      kind: row.kind
    }));
}

function mergeDwmWatchTerms(existing: DwmWatchTerm[], next: Array<DwmWatchTerm & { id?: string }>): DwmWatchTerm[] {
  const byKey = new Map<string, DwmWatchTerm>();
  for (const term of [...existing, ...next]) {
    const value = String(term.value ?? "").trim().toLowerCase();
    if (!value) continue;
    byKey.set(`${term.kind}:${value}`, { ...(term as any), value });
  }
  return [...byKey.values()];
}

function sourceMatchedCaptureText(capture: RawCapture): string {
  const metadata = (capture as any).metadata ?? {};
  return [
    (capture as any).body,
    (capture as any).rawText,
    (capture as any).text,
    metadata.title,
    metadata.description,
    metadata.victimName,
    metadata.actorName,
    metadata.leakSite ? JSON.stringify(metadata.leakSite) : undefined
  ].map((value) => String(value ?? "")).filter(Boolean).join(" ");
}

function sourceMatchedMetadataTerms(capture: RawCapture): Array<{ value: string; kind: DwmWatchTerm["kind"] }> {
  const metadata = (capture as any).metadata ?? {};
  const leakSite = metadata.leakSite ?? {};
  return [
    { value: metadata.victimName ?? metadata.companyName ?? metadata.company ?? leakSite.victimName ?? leakSite.companyName, kind: "company" as const },
    { value: metadata.vendorName ?? metadata.productName ?? metadata.supplierName ?? leakSite.vendorName, kind: "vendor" as const },
    { value: metadata.actorName ?? leakSite.actorName, kind: "brand" as const }
  ]
    .map((term) => ({ value: normalizeWatchableMetadataTerm(term.value), kind: term.kind }))
    .filter((term) => Boolean(term.value) && !isUnhelpfulMetadataWatchTerm(term.value));
}

function extractWatchableDomains(text: string): string[] {
  return uniqueStrings((text.match(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi) ?? [])
    .map((domain) => domain.toLowerCase().replace(/^www\./, "")));
}

function normalizeWatchableMetadataTerm(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").replace(/^["'`]+|["'`]+$/g, "");
}

function isUnhelpfulMetadataWatchTerm(value: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized.length < 4 || normalized.length > 80) return true;
  if (!/[a-z0-9]/i.test(normalized)) return true;
  if (/^(unknown|n\/a|none|null|redacted|victim|company|actor|group|team|admin|user|customer|example)$/i.test(normalized)) return true;
  return false;
}

function sourceHostCandidates(source: SourceRecord): string[] {
  try {
    const host = new URL(String((source as any).url ?? "")).hostname.toLowerCase().replace(/^www\./, "");
    return host ? [host] : [];
  } catch {
    return [];
  }
}

function sourceVisibleForScope(source: SourceRecord, tenantId: string): boolean {
  const sourceTenantId = String((source as any).tenantId ?? "").trim();
  return !sourceTenantId || sourceTenantId === tenantId;
}

function captureVisibleForScope(capture: RawCapture, tenantId: string, sourceIds: Set<string>): boolean {
  const captureTenantId = String((capture as any).tenantId ?? "").trim();
  if (captureTenantId && captureTenantId !== tenantId) return false;
  const sourceId = String((capture as any).sourceId ?? "").trim();
  return !sourceId || sourceIds.has(sourceId);
}

async function ensureExposureQueueDwmAlerts(options: ApiServerOptions, scope: { tenantId: string; organizationId?: string }) {
  if (typeof (options.store as any).saveDwmAlert !== "function") return { savedAlertCount: 0 };
  const generatedAt = nowIso();
  const existingAlerts = (options.store as any).listDwmAlerts?.() ?? [];
  let savedAlertCount = 0;
  const saveMissingAlerts = () => {
    for (const claim of exposureClaimsFromStore(options.store, "", { limit: 25, tenantId: scope.tenantId })) {
      const claimTenantId = String((claim as any).tenantId ?? scope.tenantId ?? "default");
      if (claimTenantId !== scope.tenantId) continue;
      const alert = buildExposureQueueDwmAlert(options, claim, scope, generatedAt);
      const existing = existingAlerts.find((row: any) =>
        row.id === alert.id
        || row.dedupeKey === alert.dedupeKey
        || row.webhookDelivery?.dedupeKey === alert.dedupeKey
        || row.workflowContext?.exposureQueueId === alert.workflowContext.exposureQueueId
      );
      if (existing) continue;
      (options.store as any).saveDwmAlert(alert);
      savedAlertCount++;
    }
  };

  if (typeof (options.store as any).batch === "function") await (options.store as any).batch(saveMissingAlerts);
  else saveMissingAlerts();

  return { savedAlertCount };
}

function buildExposureQueueDwmAlert(options: ApiServerOptions, claim: any, scope: { tenantId: string; organizationId?: string }, generatedAt: string) {
  const source = (options.store as any).getSource?.(claim.sourceId);
  const sourceFamily = exposureAlertSourceFamily(claim, source);
  const observedAt = String(claim.collectedAt ?? claim.claimTime ?? generatedAt);
  const firstSeenAt = String(claim.claimTime ?? claim.collectedAt ?? generatedAt);
  const confidence = confidencePercent(claim.confidence);
  const dedupeKey = stableId("dwm_dedupe", `${scope.tenantId}:${scope.organizationId ?? "default"}:exposure_queue:${claim.id}`);
  const evidenceId = String(claim.id ?? stableId("exposure_claim", `${claim.actor}:${claim.company}:${firstSeenAt}`));
  const sourceId = String(claim.sourceId ?? source?.id ?? stableId("src_exposure", claim.sourceName ?? claim.actor ?? "unknown"));
  const sourceName = String(claim.sourceName ?? source?.name ?? `${claim.actor ?? "Unknown actor"} exposure source`);
  const safeExcerpt = safeExposureAlertExcerpt(claim.summary || `${claim.actor} claimed ${claim.company}. ${claim.claimedData ?? "New victim claim."}`);
  return {
    id: stableId("dwm_alert", dedupeKey),
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    eventType: "darkweb.exposure.claim",
    severity: confidence >= 85 ? "high" : "medium",
    confidence,
    matchedTerm: { kind: "company", value: String(claim.company ?? "Unknown company") },
    company: String(claim.company ?? "Unknown company"),
    actor: String(claim.actor ?? "Unknown actor"),
    artifactType: "exposure_claim",
    sourceFamily,
    sourceCount: 1,
    firstSeenAt,
    lastSeenAt: observedAt,
    claimSummary: `${claim.actor ?? "Unknown actor"} exposure claim for ${claim.company ?? "Unknown company"}: ${claim.claimedData ?? "new victim claim"}.`,
    matchContext: {
      normalizedTerm: String(claim.company ?? "").toLowerCase(),
      termKind: "company",
      matchType: "exposure_queue_claim",
      matchedFieldHints: ["exposure_queue.company", "exposure_queue.actor", "exposure_queue.claimedData"]
    },
    evidenceSummary: {
      evidenceCount: 1,
      sourceFamilyCounts: { [sourceFamily]: 1 },
      metadataOnlyCount: claim.metadataOnly === false ? 0 : 1,
      publicSafeCount: claim.metadataOnly === false ? 1 : 0,
      firstObservedAt: firstSeenAt,
      lastObservedAt: observedAt
    },
    routingContext: {
      queue: "exposure_alert",
      urgency: "same_day",
      customerVisibleEvidence: claim.metadataOnly === false ? "redacted_excerpt" : "metadata_only",
      reason: "Fresh exposure queue claim was promoted into the DWM alert workflow."
    },
    confidenceReasoning: [
      "Alert was generated from the persisted exposure queue, not from a demo case.",
      `Actor: ${claim.actor ?? "unknown"}; company: ${claim.company ?? "unknown"}; claim data: ${claim.claimedData ?? "new victim claim"}.`,
      `Source: ${sourceName}; parser confidence ${confidence}%.`
    ],
    provenance: {
      generatedAt,
      matchBasis: "exposure_queue_claim",
      matchedEvidenceIds: [evidenceId],
      sourceFamilies: [sourceFamily],
      captureIds: [evidenceId],
      sourceIds: [sourceId],
      extractorVersions: ["exposure-queue-alert-bridge-v1"],
      metadataOnly: claim.metadataOnly !== false
    },
    dedupeKey,
    reviewState: claim.status === "needs_review" ? "needs_review" : "new",
    workflowStatus: "new",
    deliveryState: "pending_review",
    recommendedAction: "Open the exposure claim, verify the victim match, then assign or route to case/webhook.",
    recommendedRoute: "exposure_alert",
    evidence: [{
      id: evidenceId,
      sourceId,
      sourceName,
      sourceFamily,
      url: claim.url,
      firstSeenAt,
      observedAt,
      captureMode: "metadata_only",
      redactionState: claim.metadataOnly === false ? "redacted" : "metadata_only",
      contentHash: String(claim.provenanceHash ?? stableId("exposure_claim_hash", evidenceId)),
      excerpt: safeExcerpt,
      provenance: {
        captureId: evidenceId,
        sourceId,
        sourceType: String(source?.type ?? ""),
        collector: "exposure_queue",
        captureMode: "metadata_only",
        retentionClass: "leak_metadata",
        storageKind: "metadata_only",
        metadataOnly: claim.metadataOnly !== false
      }
    }],
    webhookDelivery: {
      recommendedRoute: "exposure_alert",
      payloadHash: stableId("dwm_payload", dedupeKey),
      dedupeKey
    },
    workflowContext: {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      source: "exposure_queue",
      exposureQueueId: evidenceId,
      exposureQueuePath: `/api/dwm/exposure-queue?q=${encodeURIComponent(String(claim.company ?? claim.actor ?? ""))}`,
      alertGeneratorKeys: [`exposure_queue:${evidenceId}`],
      captureIds: [evidenceId],
      sourceIds: [sourceId],
      sourceFamily
    },
    createdAt: generatedAt,
    updatedAt: generatedAt
  };
}

function exposureAlertSourceFamily(claim: any, source: any): string {
  const raw = String(claim.sourceFamily ?? source?.metadata?.sourceFamily ?? source?.type ?? "").toLowerCase();
  if (raw.includes("telegram")) return "telegram_public";
  if (raw.includes("advisory") || raw.includes("news") || raw.includes("public_report")) return "public_advisory";
  if (raw.includes("clear")) return "clear_web";
  if (raw.includes("actor") || raw.includes("ransom") || raw.includes("victim") || raw.includes("dark") || raw.includes("tor") || raw.includes("i2p") || raw.includes("freenet")) return "darkweb_metadata";
  return "darkweb_metadata";
}

function confidencePercent(value: unknown): number {
  const numeric = Number(value ?? 0.74);
  if (!Number.isFinite(numeric)) return 74;
  return Math.max(1, Math.min(99, Math.round(numeric <= 1 ? numeric * 100 : numeric)));
}

function safeExposureAlertExcerpt(value: unknown): string {
  return String(value ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b\d{8,}\b/g, "[number]")
    .slice(0, 240);
}

function isUnhelpfulWatchDomain(domain: string): boolean {
  return /(^|\.)t\.me$|(^|\.)telegram\.org$|(^|\.)onion$|(^|\.)example\.test$|(^|\.)localhost$/.test(domain);
}

function normalizeWatchlistStatus(value: unknown, fallback: DwmWatchlist["status"]): DwmWatchlist["status"] {
  const status = String(value ?? "").trim().toLowerCase();
  if (!status) return fallback;
  return status === "disabled" || status === "paused" ? "paused" : "active";
}

function entitlementRequestId(request: Request, body: any): string | undefined {
  return String(body.requestId ?? request.headers.get("x-request-id") ?? "").trim() || undefined;
}

function entitlementActor(request: Request, body: any, access: DwmWorkflowAccessResult): string | undefined {
  return String(body.actor ?? body.actorEmail ?? body.userEmail ?? body.userId ?? request.headers.get("x-user-email") ?? request.headers.get("x-user-id") ?? request.headers.get("x-actor-id") ?? access.member?.email ?? access.member?.userId ?? access.member?.id ?? "").trim() || undefined;
}

function normalizeOwner(value: unknown): string | undefined {
  const owner = String(value ?? "").trim().slice(0, 120);
  return owner || undefined;
}

function normalizeCaseValue(value: unknown): string | undefined {
  const normalized = String(value ?? "").trim().slice(0, 240);
  return normalized || undefined;
}

function workflowVersionReadiness(alert: any, body: any, organizationId?: string, action?: ReturnType<typeof workflowActionFromBody>) {
  const expectedWorkflowEventCount = body.expectedWorkflowEventCount === undefined && body.workflowEventCount === undefined ? undefined : Number(body.expectedWorkflowEventCount ?? body.workflowEventCount);
  const normalizedEventCount = Number.isFinite(expectedWorkflowEventCount) ? expectedWorkflowEventCount : undefined;
  const expectedUpdatedAt = String(body.expectedUpdatedAt ?? body.ifUnmodifiedSince ?? "").trim() || undefined;
  return buildDwmAlertWorkflowExecutionReadiness({
    alert,
    organizationId,
    action: action ?? workflowActionFromBody(body),
    expectedWorkflowEventCount: normalizedEventCount,
    expectedUpdatedAt
  });
}

function workflowActionFromBody(body: any): "assign" | "note" | "transition" | "case_link" | "replay" | "close" | "reopen" | "suppress" | "deliver" {
  const action = String(body.action ?? body.status ?? body.workflowStatus ?? "").trim().toLowerCase();
  if (action === "replay") return "replay";
  if (action === "close" || action === "closed") return "close";
  if (action === "reopen" || action === "reopened") return "reopen";
  if (action === "suppress" || action === "suppressed") return "suppress";
  if (body.caseId !== undefined || body.casePath !== undefined) return "case_link";
  if (body.assignedOwner !== undefined || body.owner !== undefined) return "assign";
  if (body.severityOverride !== undefined || body.severity !== undefined) return "transition";
  if (body.note !== undefined || body.rationale !== undefined || body.reason !== undefined) return "note";
  return "transition";
}

function buildDwmAlertDetail(alert: any, options: ApiServerOptions, access?: DwmWorkflowAccessResult) {
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === alert.id);
  const events = [...(alert.workflowEvents ?? [])].sort((a: any, b: any) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
  const timeline = [
    alert.alertCreatedEvent ? {
      id: alert.alertCreatedEvent.id,
      at: alert.alertCreatedEvent.at,
      type: "alert_created",
      title: "Alert created",
      detail: `${String(alert.alertCreatedEvent.sourceFamily ?? alert.sourceFamily).replaceAll("_", " ")} match saved with ${Number(alert.alertCreatedEvent.evidenceCount ?? 0)} evidence item(s).`
    } : alert.savedAt ? { id: `${alert.id}:saved`, at: alert.savedAt, type: "saved", title: "Alert saved", detail: "Match saved to the customer queue." } : undefined,
    alert.alertUpdatedEvent ? {
      id: alert.alertUpdatedEvent.id,
      at: alert.alertUpdatedEvent.at,
      type: "alert_updated",
      title: "Alert updated",
      detail: [
        `${String(alert.alertUpdatedEvent.sourceFamily ?? alert.sourceFamily).replaceAll("_", " ")} match updated with ${Number(alert.alertUpdatedEvent.evidenceCount ?? 0)} evidence item(s).`,
        (alert.alertUpdatedEvent.addedCaptureIds ?? []).length ? `Added captures: ${(alert.alertUpdatedEvent.addedCaptureIds ?? []).join(", ")}` : undefined
      ].filter(Boolean).join(" ")
    } : undefined,
    ...events.map((event: any) => ({
      id: event.id,
      at: event.at,
      type: "workflow_event",
      title: `${String(event.fromReviewState ?? "unknown").replaceAll("_", " ")} -> ${String(event.toReviewState ?? "unknown").replaceAll("_", " ")}`,
      detail: [
        event.note ?? `${String(event.fromDeliveryState ?? "unknown").replaceAll("_", " ")} -> ${String(event.toDeliveryState ?? "unknown").replaceAll("_", " ")}`,
        event.toOwner ? `Owner: ${event.toOwner}` : undefined
      ].filter(Boolean).join(" · ")
    })),
    ...deliveries.map((delivery: any) => ({
      id: delivery.id,
      at: delivery.attemptedAt,
      type: "delivery",
      title: `Webhook ${String(delivery.status ?? "attempt").replaceAll("_", " ")}`,
      detail: delivery.error ?? `HTTP ${delivery.httpStatus ?? 0} · ${delivery.endpointHash}`
    })),
    alert.deliveredAt ? { id: `${alert.id}:delivered`, at: alert.deliveredAt, type: "delivered", title: "Delivered", detail: "Webhook accepted by the customer endpoint." } : undefined
  ].filter(Boolean).sort((a: any, b: any) => String(a.at ?? "").localeCompare(String(b.at ?? "")));

  const evidenceReplay = (alert.evidence ?? []).map((item: any) => ({
    id: item.id,
    sourceName: item.sourceName,
    sourceFamily: item.sourceFamily,
    observedAt: item.observedAt ?? item.firstSeenAt,
    captureMode: item.captureMode,
    redactionState: item.redactionState,
    contentHash: item.contentHash,
    excerpt: item.excerpt,
    provenance: item.provenance,
    safeToShow: item.redactionState !== "raw_sensitive",
    handling: item.redactionState === "metadata_only" ? "Only metadata is retained for this source." : "Public-safe excerpt retained for review."
  }));
  const downstreamHandoff = buildDwmAlertDownstreamHandoff({ alert, deliveries, ...downstreamLifecycleForAlert(options, alert) });
  const workflowExecutionReadiness = buildDwmAlertWorkflowExecutionReadiness({ alert, organizationId: alert.organizationId });
  const deliveryReadiness = buildDwmAlertDeliveryReadiness(alert, deliveries);
  const evidenceFreshness = buildDwmAlertEvidenceFreshness(alert);
  const provenanceFreshness = buildDwmAlertProvenanceFreshness(alert);
  const customerReadiness = buildDwmAlertCustomerReadiness({
    alert,
    downstreamHandoff,
    workflowExecutionReadiness,
    deliveryReadiness,
    evidenceFreshness,
    provenanceFreshness
  });

  return sanitizeDwmApiPayload({
    schemaVersion: "dwm.alert_detail.v1",
    generatedAt: nowIso(),
    visibilityDecision: access?.visibilityDecision,
    alert: buildDwmAlertListItem(alert, options, deliveries),
    workflowSummary: buildDwmAlertWorkflowSummary(alert),
    alertEventSummary: buildDwmAlertEventSummary(alert),
    workflowExecutionReadiness,
    analystWorkflowContract: buildDwmAlertAnalystWorkflowContract(alert),
    customerProofHandoff: buildDwmAlertCustomerProofHandoffRow({ alert, deliveries }),
    downstreamHandoff,
    orgAlertWorkflowBridge: buildDwmAlertDetailOrgWorkflowBridge(alert, options),
    alertCreatedDispatch: downstreamHandoff.createdEventDispatch,
    retentionAudit: buildDwmAlertRetentionAudit({ alert, deliveries, downstreamHandoff }),
    caseHandoff: buildDwmAlertCaseHandoff(alert),
    nextBestAction: buildDwmAlertNextBestAction(alert, deliveries),
    deliveryReadiness,
    evidenceFreshness,
    provenanceFreshness,
    customerReadiness,
    deliveries,
    timeline,
    evidenceReplay,
    consumerContract: buildDwmAlertDetailConsumerContract(alert, evidenceReplay),
    sourceExplanations: evidenceReplay.map((item: any) => ({
      evidenceId: item.id,
      sourceName: item.sourceName,
      explanation: `${String(item.sourceFamily).replaceAll("_", " ")} evidence is shown as ${String(item.redactionState).replaceAll("_", " ")} with hash ${item.contentHash}; capture ${item.provenance?.captureId ?? item.id} was observed at ${item.observedAt}.`
    })),
    nextActions: nextActionsForAlert(alert, deliveries)
  });
}

function buildDwmAlertDetailConsumerContract(alert: any, evidenceReplay: any[]) {
  const sourceFamilies = uniqueAlertStrings(evidenceReplay.map((item: any) => item.sourceFamily).filter(Boolean).map(String));
  return {
    schemaVersion: "dwm.alert_detail_consumer_contract.v1",
    route: "/v1/dwm/alerts/:id",
    alertDetailPath: alertDetailPathFor(alert),
    stableFields: [
      "alert.id",
      "alert.alertDetailPath",
      "alert.organizationId",
      "alert.watchlistIds",
      "alert.watchlistItemIds",
      "alert.sourceProvenanceSummary",
      "alert.orgWatchlistScope",
      "workflowSummary",
      "analystWorkflowContract",
      "alertEventSummary",
      "customerProofHandoff",
      "downstreamHandoff",
      "orgAlertWorkflowBridge",
      "caseHandoff",
      "deliveryReadiness",
      "evidenceFreshness",
      "provenanceFreshness",
      "customerReadiness",
      "evidenceReplay",
      "sourceExplanations"
    ],
    eventShapes: {
      created: "dwm.alert_created_event.v1",
      updated: alert.alertUpdatedEvent ? "dwm.alert_updated_event.v1" : undefined
    },
    evidence: {
      sourceFamilies,
      evidenceCount: evidenceReplay.length,
      metadataOnly: evidenceReplay.some((item: any) => item.redactionState === "metadata_only"),
      safeToShowCount: evidenceReplay.filter((item: any) => item.safeToShow).length,
      captureIds: uniqueAlertStrings(evidenceReplay.map((item: any) => item.provenance?.captureId ?? item.id).filter(Boolean).map(String)),
      contentHashes: uniqueAlertStrings(evidenceReplay.map((item: any) => item.contentHash).filter(Boolean).map(String))
    },
    persistedReadModel: {
      sourceProvenanceSummary: alert.sourceProvenanceSummary?.schemaVersion,
      orgWatchlistScope: alert.orgWatchlistScope?.schemaVersion,
      sourceFamilies: uniqueAlertStrings([
        ...alertStringArray(alert.sourceProvenanceSummary?.sourceFamily).filter(Boolean).map(String),
        ...alertStringArray(alert.sourceProvenanceSummary?.sourceFamilies).filter(Boolean).map(String),
        ...sourceFamilies
      ]),
      captureIds: uniqueAlertStrings([
        ...alertStringArray(alert.sourceProvenanceSummary?.captureIds).filter(Boolean).map(String),
        ...alertStringArray(alert.sourceProvenanceSummary?.generationEvidenceWindow?.captureIds).filter(Boolean).map(String)
      ]),
      watchlistIds: uniqueAlertStrings(alertStringArray(alert.orgWatchlistScope?.watchlistIds ?? alert.watchlistIds).filter(Boolean).map(String)),
      watchlistItemIds: uniqueAlertStrings(alertStringArray(alert.orgWatchlistScope?.watchlistItemIds ?? alert.watchlistItemIds).filter(Boolean).map(String))
    },
    filters: {
      listRoute: "/v1/dwm/alerts",
      equivalentFilters: ["organizationId", "sourceFamily", "eventType", "hasUpdatedEvent", "watchlistId", "watchlistItemId", "captureId", "caseId"]
    },
    redaction: {
      rawSensitiveEvidenceIncluded: false,
      supportSafe: true
    }
  };
}

function buildDwmAlertAnalystWorkflowContract(alert: any) {
  return {
    schemaVersion: "dwm.alert_analyst_workflow_contract.v1",
    mutationRoute: "/v1/dwm/alerts/:id",
    replayRoute: "/v1/dwm/alerts/:id/replay",
    supportedStatuses: ["new", "triaged", "investigating", "suppressed", "closed", "reopened"],
    supportedActions: ["assign", "note", "triage", "investigate", "suppress", "close", "reopen", "case_link", "replay"],
    requiredBody: ["organizationId", "status|action|note|assignedOwner|severityOverride|caseId", "expectedWorkflowEventCount?"],
    idempotency: {
      workflowEventCount: (alert.workflowEvents ?? []).length,
      updatedAt: alert.updatedAt,
      staleVersionBlocker: "stale_workflow_version"
    },
    guards: {
      orgScoped: Boolean(alert.organizationId),
      preservesEvidence: true,
      preservesEventsOnRebuild: true,
      invalidTransitionBlocker: "invalid_transition"
    },
    current: {
      status: String(alert.workflowStatus ?? "new"),
      assignedOwner: alert.assignedOwner,
      severityOverride: alert.severityOverride,
      caseId: alert.caseId,
      casePath: alert.casePath ?? alert.workflowContext?.casePath,
      replayCount: Number(alert.replayCount ?? 0)
    }
  };
}

function buildDwmAlertListItem(alert: any, options: ApiServerOptions, deliveries?: any[]) {
  const alertDeliveries = deliveries ?? ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === alert.id);
  const workflowSummary = buildDwmAlertWorkflowSummary(alert);
  const downstreamHandoff = buildDwmAlertDownstreamHandoff({ alert, deliveries: alertDeliveries, ...downstreamLifecycleForAlert(options, alert) });
  const workflowExecutionReadiness = buildDwmAlertWorkflowExecutionReadiness({ alert, organizationId: alert.organizationId });
  const deliveryReadiness = buildDwmAlertDeliveryReadiness(alert, alertDeliveries);
  const evidenceFreshness = buildDwmAlertEvidenceFreshness(alert);
  const provenanceFreshness = buildDwmAlertProvenanceFreshness(alert);
  return sanitizeDwmApiPayload({
    ...alert,
    alertDetailPath: alertDetailPathFor(alert),
    workflowSummary,
    workflowExecutionReadiness,
    customerProofHandoff: buildDwmAlertCustomerProofHandoffRow({ alert, deliveries: alertDeliveries }),
    downstreamHandoff,
    alertCreatedDispatch: downstreamHandoff.createdEventDispatch,
    alertEventSummary: buildDwmAlertEventSummary(alert),
    retentionAudit: buildDwmAlertRetentionAudit({ alert, deliveries: alertDeliveries, downstreamHandoff }),
    caseHandoff: buildDwmAlertCaseHandoff(alert),
    nextBestAction: buildDwmAlertNextBestAction(alert, alertDeliveries),
    deliveryReadiness,
    evidenceFreshness,
    provenanceFreshness,
    customerReadiness: buildDwmAlertCustomerReadiness({
      alert,
      downstreamHandoff,
      workflowExecutionReadiness,
      deliveryReadiness,
      evidenceFreshness,
      provenanceFreshness
    })
  });
}

function buildDwmAlertCustomerReadiness(input: {
  alert: any;
  downstreamHandoff: ReturnType<typeof buildDwmAlertDownstreamHandoff>;
  workflowExecutionReadiness: ReturnType<typeof buildDwmAlertWorkflowExecutionReadiness>;
  deliveryReadiness: ReturnType<typeof buildDwmAlertDeliveryReadiness>;
  evidenceFreshness: ReturnType<typeof buildDwmAlertEvidenceFreshness>;
  provenanceFreshness: ReturnType<typeof buildDwmAlertProvenanceFreshness>;
}) {
  const alert = input.alert;
  const evidenceCount = Number(input.evidenceFreshness.evidenceCount ?? input.downstreamHandoff.evidence.evidenceCount ?? 0);
  const selectedCaptureIds = uniqueAlertStrings([
    ...alertStringArray(input.downstreamHandoff.evidence.selectedCaptureIds),
    ...alertStringArray(input.deliveryReadiness.selectedCaptureIds)
  ]);
  const captureIds = uniqueAlertStrings([
    ...alertStringArray(input.downstreamHandoff.evidence.captureIds),
    ...alertStringArray(input.evidenceFreshness.captureIds),
    ...alertStringArray(input.provenanceFreshness.captureIds)
  ]);
  const sourceIds = uniqueAlertStrings([
    ...alertStringArray(input.downstreamHandoff.evidence.sourceIds),
    ...alertStringArray(input.provenanceFreshness.sourceIds)
  ]);
  const watchlistIds = uniqueAlertStrings([
    ...alertStringArray(input.downstreamHandoff.watchlist.watchlistIds),
    ...alertStringArray(alert.watchlistIds ?? alert.workflowContext?.watchlistIds)
  ]);
  const watchlistItemIds = uniqueAlertStrings([
    ...alertStringArray(input.downstreamHandoff.watchlist.watchlistItemIds),
    ...alertStringArray(alert.watchlistItemIds ?? alert.workflowContext?.watchlistItemIds)
  ]);
  const actionRows = (["assign", "note", "transition", "case_link", "replay", "close", "reopen", "suppress", "deliver"] as const).map((action) => {
    const readiness = buildDwmAlertWorkflowExecutionReadiness({
      alert,
      organizationId: input.downstreamHandoff.organizationId ?? alert.organizationId,
      action,
      caseAvailable: action === "case_link" ? input.downstreamHandoff.caseReadiness.ready : undefined,
      deliveryAvailable: action === "deliver" ? input.downstreamHandoff.deliverySelection.ready : undefined
    });
    return {
      action,
      ready: readiness.ready,
      blockerCodes: readiness.blockerCodes,
      idempotencyKey: readiness.idempotencyKey
    };
  });
  const alertBlockerCodes = uniqueAlertStrings([
    evidenceCount <= 0 ? "missing_capture_evidence" : undefined,
    !selectedCaptureIds.length ? "missing_capture_evidence" : undefined,
    !watchlistIds.length ? "missing_watchlist_ref" : undefined,
    !input.downstreamHandoff.dedupe.alertDedupeKey ? "missing_dedupe_key" : undefined
  ].filter(Boolean).map(String));
  const blockerCodes = uniqueAlertStrings([
    ...alertBlockerCodes,
    ...input.downstreamHandoff.blockerCodes.map(String),
    ...input.downstreamHandoff.deliverySelection.blockerCodes.map(String),
    ...input.workflowExecutionReadiness.blockerCodes.map(String),
    ...alertStringArray(input.deliveryReadiness.blockerCodes)
  ]);
  const readyForQueue = alertBlockerCodes.length === 0;
  const readyForCase = Boolean(input.downstreamHandoff.caseReadiness.ready);
  const readyForDelivery = Boolean(input.downstreamHandoff.deliverySelection.ready);
  const workflowReady = actionRows.some((row) => row.ready);
  const caseWebhookReplayBlockers = uniqueAlertStrings([
    !readyForCase ? "case_handoff_blocked" : undefined,
    !readyForDelivery ? "delivery_handoff_blocked" : undefined,
    !input.downstreamHandoff.replayReceipt.ready ? "alert_replay_blocked" : undefined,
    !(input.downstreamHandoff.replayReceipt.caseId ?? input.downstreamHandoff.caseReadiness.caseId ?? input.downstreamHandoff.caseReadiness.caseIdCandidate) ? "case_unavailable" : undefined,
    !(input.downstreamHandoff.deliverySelection.selectedWebhookDestinationId ?? input.downstreamHandoff.deliverySelection.webhookDestinationIds[0]) ? "destination_unavailable" : undefined,
    !selectedCaptureIds.length ? "missing_capture_evidence" : undefined,
    ...input.downstreamHandoff.replayReceipt.blockerCodes.map(String),
    ...input.downstreamHandoff.deliverySelection.blockerCodes.map(String)
  ].filter(Boolean).map(String));
  const caseWebhookReplayCaseId = input.downstreamHandoff.replayReceipt.caseId ?? input.downstreamHandoff.caseReadiness.caseId ?? input.downstreamHandoff.caseReadiness.caseIdCandidate;
  return {
    schemaVersion: "dwm.alert_customer_readiness.v1",
    alertId: String(alert.id ?? input.downstreamHandoff.alertId ?? ""),
    tenantId: input.downstreamHandoff.tenantId ?? alert.tenantId,
    organizationId: input.downstreamHandoff.organizationId ?? alert.organizationId,
    ready: readyForQueue && readyForCase && readyForDelivery && workflowReady && blockerCodes.length === 0,
    state: !readyForQueue
      ? "missing_alert_inputs"
      : !readyForCase
        ? "case_handoff_blocked"
        : !readyForDelivery
          ? "delivery_handoff_blocked"
          : !workflowReady
            ? "workflow_blocked"
            : blockerCodes.length
              ? "blocked"
              : "ready",
    alertReadiness: {
      ready: readyForQueue,
      sourceFamily: input.downstreamHandoff.sourceFamily ?? alert.sourceFamily,
      matchReason: input.downstreamHandoff.matchReason,
      evidenceCount,
      selectedCaptureIds,
      captureIds,
      sourceIds,
      watchlistIds,
      watchlistItemIds,
      alertGenerationRefs: input.downstreamHandoff.watchlist.alertGenerationRefs,
      dedupeKey: input.downstreamHandoff.dedupe.alertDedupeKey,
      deliveryDedupeKey: input.downstreamHandoff.dedupe.deliveryDedupeKey,
      recommendedRoute: alert.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute,
      firstSeenAt: input.evidenceFreshness.firstSeenAt,
      lastSeenAt: input.evidenceFreshness.lastSeenAt,
      newestEvidenceAt: input.evidenceFreshness.newestEvidenceAt,
      provenanceGeneratedAt: input.downstreamHandoff.evidence.provenanceGeneratedAt,
      blockerCodes: alertBlockerCodes
    },
    caseHandoff: {
      ready: readyForCase,
      route: input.downstreamHandoff.caseReadiness.route,
      caseIdCandidate: input.downstreamHandoff.caseReadiness.caseIdCandidate,
      caseId: input.downstreamHandoff.caseReadiness.caseId,
      casePath: input.downstreamHandoff.caseReadiness.casePath,
      idempotencyKey: input.downstreamHandoff.caseReadiness.idempotencyKey
    },
    deliveryReadiness: {
      ready: readyForDelivery,
      selectedWebhookDestinationId: input.downstreamHandoff.deliverySelection.selectedWebhookDestinationId,
      webhookDestinationIds: input.downstreamHandoff.deliverySelection.webhookDestinationIds,
      enabledWebhookDestinationIds: input.downstreamHandoff.deliverySelection.enabledWebhookDestinationIds,
      deliveryHistoryRefs: input.downstreamHandoff.deliveryReadiness.deliveryHistoryRefs,
      deliveryDedupeKey: input.downstreamHandoff.deliverySelection.deliveryDedupeKey,
      idempotencyKey: input.downstreamHandoff.deliverySelection.idempotencyKey,
      blockerCodes: input.downstreamHandoff.deliverySelection.blockerCodes
    },
    webhookReplayReadiness: {
      schemaVersion: "dwm.alert_webhook_replay_readiness.v1",
      ready: input.downstreamHandoff.replayReceipt.ready,
      replayMarker: input.downstreamHandoff.replayReceipt.replayMarker,
      replayCount: input.downstreamHandoff.replayReceipt.replayCount,
      workflowEventCount: input.downstreamHandoff.replayReceipt.workflowEventCount,
      idempotencyKey: input.downstreamHandoff.replayReceipt.idempotencyKey,
      deliveryDedupeKey: input.downstreamHandoff.replayReceipt.deliveryDedupeKey,
      selectedWebhookDestinationId: input.downstreamHandoff.deliverySelection.selectedWebhookDestinationId,
      webhookDestinationIds: input.downstreamHandoff.deliverySelection.webhookDestinationIds,
      selectedCaptureIds: input.downstreamHandoff.replayReceipt.selectedCaptureIds,
      caseIdCandidate: input.downstreamHandoff.replayReceipt.caseIdCandidate,
      caseId: input.downstreamHandoff.replayReceipt.caseId,
      casePath: input.downstreamHandoff.replayReceipt.casePath,
      watchlistItemIds: input.downstreamHandoff.replayReceipt.watchlistItemIds,
      alertGenerationRefs: input.downstreamHandoff.replayReceipt.alertGenerationRefs,
      deliveryHistoryRefs: input.downstreamHandoff.deliveryReadiness.deliveryHistoryRefs,
      hasDeliveryHistory: input.downstreamHandoff.deliveryReadiness.deliveryHistoryRefs.length > 0,
      duplicateReplay: input.downstreamHandoff.replay.duplicate,
      canReplay: input.downstreamHandoff.replay.canReplay,
      blockerCodes: input.downstreamHandoff.replayReceipt.blockerCodes
    },
    caseWebhookReplayReadiness: {
      schemaVersion: "dwm.alert_case_webhook_replay_readiness.v1",
      ready: caseWebhookReplayBlockers.length === 0,
      route: caseWebhookReplayCaseId ? `/v1/cases/${encodeURIComponent(String(caseWebhookReplayCaseId))}/webhook-replay-readiness` : undefined,
      method: "GET",
      alertId: String(alert.id ?? input.downstreamHandoff.alertId ?? ""),
      tenantId: input.downstreamHandoff.tenantId ?? alert.tenantId,
      organizationId: input.downstreamHandoff.organizationId ?? alert.organizationId,
      caseIdCandidate: input.downstreamHandoff.replayReceipt.caseIdCandidate ?? input.downstreamHandoff.caseReadiness.caseIdCandidate,
      caseId: input.downstreamHandoff.replayReceipt.caseId ?? input.downstreamHandoff.caseReadiness.caseId,
      casePath: input.downstreamHandoff.replayReceipt.casePath ?? input.downstreamHandoff.caseReadiness.casePath,
      selectedWebhookDestinationId: input.downstreamHandoff.deliverySelection.selectedWebhookDestinationId,
      webhookDestinationIds: input.downstreamHandoff.deliverySelection.webhookDestinationIds,
      selectedCaptureIds: input.downstreamHandoff.replayReceipt.selectedCaptureIds,
      watchlistItemIds: input.downstreamHandoff.replayReceipt.watchlistItemIds,
      alertGenerationRefs: input.downstreamHandoff.replayReceipt.alertGenerationRefs,
      deliveryHistoryRefs: input.downstreamHandoff.deliveryReadiness.deliveryHistoryRefs,
      replayMarker: input.downstreamHandoff.replayReceipt.replayMarker,
      replayCount: input.downstreamHandoff.replayReceipt.replayCount,
      workflowEventCount: input.downstreamHandoff.replayReceipt.workflowEventCount,
      idempotencyKey: input.downstreamHandoff.replayReceipt.idempotencyKey,
      deliveryDedupeKey: input.downstreamHandoff.replayReceipt.deliveryDedupeKey,
      readinessRefs: {
        caseHandoffReady: readyForCase,
        deliveryReady: readyForDelivery,
        alertReplayReady: input.downstreamHandoff.replayReceipt.ready,
        workflowReady,
        hasDeliveryHistory: input.downstreamHandoff.deliveryReadiness.deliveryHistoryRefs.length > 0
      },
      blockerCodes: caseWebhookReplayBlockers
    },
    workflowReadiness: {
      ready: workflowReady,
      status: alert.workflowStatus ?? "new",
      assignedOwner: alert.assignedOwner,
      eventCount: input.downstreamHandoff.workflowVersion.eventCount,
      transitionActions: input.downstreamHandoff.workflowTransitions.actions,
      readyActions: actionRows.filter((row) => row.ready).map((row) => row.action),
      blockedActions: actionRows.filter((row) => !row.ready).map((row) => ({
        action: row.action,
        blockerCodes: row.blockerCodes
      })),
      actionReadiness: {
        schemaVersion: "dwm.alert_action_readiness_summary.v1",
        actions: actionRows
      }
    },
    transitionHandoff: {
      schemaVersion: "dwm.alert_transition_handoff.v1",
      ready: workflowReady && readyForCase,
      workflowEventCount: input.downstreamHandoff.workflowVersion.eventCount,
      replayCount: input.downstreamHandoff.workflowVersion.replayCount,
      lastReplayedAt: input.downstreamHandoff.workflowVersion.lastReplayedAt,
      actions: input.downstreamHandoff.workflowTransitions.actions,
      lastEventAt: input.downstreamHandoff.workflowTransitions.lastEventAt,
      caseLinked: input.downstreamHandoff.workflowTransitions.caseLinked,
      closed: input.downstreamHandoff.workflowTransitions.closed,
      suppressed: input.downstreamHandoff.workflowTransitions.suppressed,
      caseIdCandidate: input.downstreamHandoff.caseReadiness.caseIdCandidate,
      caseId: input.downstreamHandoff.caseReadiness.caseId,
      casePath: input.downstreamHandoff.caseReadiness.casePath,
      updateReceipt: input.downstreamHandoff.updateReceipt ? {
        schemaVersion: input.downstreamHandoff.updateReceipt.schemaVersion,
        ready: input.downstreamHandoff.updateReceipt.ready,
        eventId: input.downstreamHandoff.updateReceipt.eventId,
        addedCaptureIds: input.downstreamHandoff.updateReceipt.addedCaptureIds,
        selectedCaptureIds: input.downstreamHandoff.updateReceipt.selectedCaptureIds,
        workflowEventCount: input.downstreamHandoff.updateReceipt.workflowEventCount,
        caseId: input.downstreamHandoff.updateReceipt.caseId,
        casePath: input.downstreamHandoff.updateReceipt.casePath,
        deliveryDedupeKey: input.downstreamHandoff.updateReceipt.deliveryDedupeKey,
        blockerCodes: input.downstreamHandoff.updateReceipt.blockerCodes
      } : undefined,
      replayReceipt: {
        schemaVersion: input.downstreamHandoff.replayReceipt.schemaVersion,
        ready: input.downstreamHandoff.replayReceipt.ready,
        replayCount: input.downstreamHandoff.replayReceipt.replayCount,
        workflowEventCount: input.downstreamHandoff.replayReceipt.workflowEventCount,
        caseIdCandidate: input.downstreamHandoff.replayReceipt.caseIdCandidate,
        caseId: input.downstreamHandoff.replayReceipt.caseId,
        casePath: input.downstreamHandoff.replayReceipt.casePath,
        deliveryDedupeKey: input.downstreamHandoff.replayReceipt.deliveryDedupeKey,
        selectedCaptureIds: input.downstreamHandoff.replayReceipt.selectedCaptureIds,
        watchlistItemIds: input.downstreamHandoff.replayReceipt.watchlistItemIds,
        alertGenerationRefs: input.downstreamHandoff.replayReceipt.alertGenerationRefs,
        blockerCodes: input.downstreamHandoff.replayReceipt.blockerCodes
      },
      blockerCodes: uniqueAlertStrings([
        ...input.downstreamHandoff.blockerCodes.map(String),
        ...input.downstreamHandoff.replayReceipt.blockerCodes.map(String),
        ...(input.downstreamHandoff.updateReceipt?.blockerCodes ?? []).map(String)
      ])
    },
    sourceCoverage: {
      sourceFamily: input.downstreamHandoff.sourceFamily ?? alert.sourceFamily,
      evidenceCount,
      selectedCaptureIds,
      captureIds,
      sourceIds,
      contentHashes: input.evidenceFreshness.contentHashes,
      freshnessState: input.evidenceFreshness.newestEvidenceAt ? "has_recent_evidence" : "missing_evidence_timestamp",
      provenanceReady: sourceIds.length > 0 && captureIds.length > 0,
      blockerCodes: uniqueAlertStrings([
        evidenceCount <= 0 ? "missing_capture_evidence" : undefined,
        !sourceIds.length ? "missing_provenance" : undefined,
        !captureIds.length ? "missing_capture_evidence" : undefined
      ].filter(Boolean).map(String))
    },
    blockerCodes,
    blockerReasons: [
      ...input.downstreamHandoff.blockers.map((blocker) => ({
        code: blocker.code,
        field: blocker.field,
        detail: blocker.detail,
        recoverable: blocker.recoverable
      })),
      ...alertBlockerCodes.map((code) => ({
        code,
        field: code === "missing_watchlist_ref" ? "watchlistIds" : code === "missing_dedupe_key" ? "dedupeKey" : "evidence",
        detail: code === "missing_watchlist_ref"
          ? "Alert is missing the org/shared watchlist reference needed for customer scoped queues."
          : code === "missing_dedupe_key"
            ? "Alert is missing a stable dedupe key for workflow-preserving updates."
            : "Alert is missing selected capture evidence for customer review.",
        recoverable: true
      }))
    ],
    consumerFields: {
      dashboard: ["id", "alertDetailPath", "customerReadiness.alertReadiness", "customerReadiness.workflowReadiness", "customerReadiness.transitionHandoff", "customerReadiness.blockerCodes"],
      webhook: ["customerReadiness.deliveryReadiness", "customerReadiness.webhookReplayReadiness", "customerReadiness.caseWebhookReplayReadiness", "customerReadiness.transitionHandoff.replayReceipt", "alertCreatedDispatch", "downstreamHandoff.createdEventDispatch"],
      publicTI: ["customerReadiness.sourceCoverage", "customerReadiness.alertReadiness.matchReason", "sourceProvenanceSummary"],
      analystPortal: ["customerReadiness.workflowReadiness", "customerReadiness.transitionHandoff", "customerReadiness.caseWebhookReplayReadiness", "caseHandoff", "nextBestAction"]
    }
  };
}

function buildDwmAlertQueueVisibility(input: {
  organizationId?: string;
  tenantId: string;
  organization?: unknown;
  access: DwmWorkflowAccessResult;
  alerts: any[];
  options: ApiServerOptions;
  url: URL;
}) {
  const role = String(input.access.member?.role ?? "nonmember").trim().toLowerCase() || "nonmember";
  const lifecycleStatus = organizationLifecycleStatus(input.organization);
  const lifecycleBlocker = lifecycleStatus === "archived" ? "org_archived" : lifecycleStatus === "deleted" ? "org_deleted" : undefined;
  const workflowSummaries = input.alerts.map(buildDwmAlertWorkflowSummary);
  const generationReadiness = buildDwmAlertGenerationReadiness({
    watchlists: (input.options.store as any).listDwmWatchlists?.() ?? [],
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    visibilityPolicy: organizationAlertVisibilityPolicy(input.organization),
    sources: input.options.store.listSources(),
    captures: input.options.store.listCaptures()
  });
  const lifecycleBlockers = uniqueAlertStrings([
    lifecycleBlocker,
    ...workflowSummaries.flatMap((summary: any) => summary.membershipContext?.alertGenerationBlockerCodes ?? summary.membershipContext?.blockedReasons ?? []),
    ...input.alerts.flatMap((alert: any) => buildDwmAlertDownstreamHandoff({
      alert,
      deliveries: ((input.options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === alert.id),
      ...downstreamLifecycleForAlert(input.options, alert, { organization: input.organization, organizationId: input.organizationId })
    }).blockerCodes),
    ...input.alerts.flatMap((alert: any) => [
      ...(alert.workflowContext?.membershipContext?.alertGenerationBlockerCodes ?? []),
      ...(alert.workflowContext?.membershipContext?.blockedReasons ?? [])
    ])
  ].filter(Boolean));
  const watchlistItemIds = uniqueAlertStrings(input.alerts.flatMap((alert: any) => alert.watchlistItemIds ?? alert.workflowContext?.watchlistItemIds ?? []));
  const alertGeneratorKeys = uniqueAlertStrings(input.alerts.flatMap((alert: any) => alert.workflowContext?.alertGeneratorKeys ?? alert.webhookContext?.alertGeneratorKeys ?? []));
  const orgAlertWorkflowBridge = buildOrgAlertWorkflowBridgeReport({
    tenantId: input.tenantId,
    organizationId: input.organizationId ?? input.tenantId,
    watchlists: orgAlertWorkflowBridgeRefs({
      watchlists: (input.options.store as any).listDwmWatchlists?.() ?? [],
      tenantId: input.tenantId,
      organizationId: input.organizationId
    }),
    alerts: input.alerts,
    checkedAt: nowIso()
  });
  const customerReadinessSummary = buildDwmAlertQueueCustomerReadinessSummary(input.alerts);
  return {
    schemaVersion: "dwm.org_alert_queue_visibility.v1",
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    organizationLifecycleState: lifecycleStatus,
    visibilityDecision: input.access.visibilityDecision,
    member: input.access.member ? {
      id: input.access.member.id,
      userId: input.access.member.userId,
      email: input.access.member.email,
      role,
      status: input.access.member.status,
      readOnly: input.access.readOnly
    } : null,
    allowedActions: dwmAlertQueueAllowedActions(role, input.access.readOnly),
    actionGates: {
      acknowledge_alert: dwmAlertQueueActionGate(role, input.access.readOnly, ["owner", "admin", "analyst", "member"]),
      assign_case: dwmAlertQueueActionGate(role, input.access.readOnly, ["owner", "admin", "analyst"]),
      link_case: dwmAlertQueueActionGate(role, input.access.readOnly, ["owner", "admin", "analyst"]),
      replay_alert: dwmAlertQueueActionGate(role, input.access.readOnly, ["owner", "admin", "analyst"]),
      deliver_webhook: dwmAlertQueueActionGate(role, input.access.readOnly, ["owner", "admin", "analyst"])
    },
    counts: {
      visibleAlertCount: input.alerts.length,
      openAlertCount: input.alerts.filter((alert: any) => !["closed", "suppressed"].includes(String(alert.workflowStatus ?? "new"))).length,
      caseLinkedCount: input.alerts.filter((alert: any) => Boolean(alert.caseId || alert.casePath)).length,
      watchlistItemCount: watchlistItemIds.length,
      alertGeneratorKeyCount: alertGeneratorKeys.length,
      expectedAlertDelta: generationReadiness.zeroAlertProof.expectedAlertDelta,
      matchedCandidateCount: generationReadiness.counts.matchedCandidateCount,
      unmatchedCandidateCount: generationReadiness.counts.unmatchedCandidateCount
    },
    generationReadiness: {
      schemaVersion: generationReadiness.schemaVersion,
      readyForRebuild: generationReadiness.readyForRebuild,
      readyForCustomerDelivery: generationReadiness.readyForCustomerDelivery,
      blockerCodes: generationReadiness.blockerCodes,
      sourceFamilyCoverage: generationReadiness.sourceFamilyCoverage,
      sourceFamilyGaps: generationReadiness.sourceFamilyGaps,
      zeroAlertProof: generationReadiness.zeroAlertProof
    },
    zeroAlertProof: generationReadiness.zeroAlertProof,
    customerReadinessSummary,
    orgAlertWorkflowBridge,
    consumerContract: {
      schemaVersion: "dwm.alert_queue_consumer_contract.v1",
      route: "/v1/dwm/alerts",
      stableFields: [
        "alerts[].id",
        "alerts[].alertDetailPath",
        "alerts[].organizationId",
        "alerts[].sourceFamily",
        "alerts[].sourceProvenanceSummary",
        "alerts[].orgWatchlistScope",
        "alerts[].workflowSummary",
        "alerts[].alertEventSummary",
        "alerts[].evidenceFreshness",
        "alerts[].provenanceFreshness",
        "alerts[].customerReadiness",
        "alerts[].customerReadiness.alertReadiness.matchReason",
        "alerts[].customerReadiness.sourceCoverage",
        "alerts[].customerReadiness.workflowReadiness",
        "alerts[].customerReadiness.transitionHandoff",
        "alerts[].customerReadiness.transitionHandoff.replayReceipt",
        "alerts[].customerReadiness.webhookReplayReadiness",
        "alerts[].customerReadiness.caseWebhookReplayReadiness",
        "alerts[].customerReadiness.deliveryReadiness",
        "alerts[].customerReadiness.caseHandoff",
        "alertQueueVisibility.customerReadinessSummary",
        "alertQueueVisibility.customerReadinessSummary.blockerCodes",
        "alertQueueVisibility.customerReadinessSummary.sourceFamilies",
        "alertQueueVisibility.customerReadinessSummary.sourceFamilyRows",
        "alertQueueVisibility.orgAlertWorkflowBridge",
        "alertQueueVisibility.zeroAlertProof",
        "alertQueueVisibility.generationReadiness.sourceFamilyCoverage",
        "alertQueueVisibility.generationReadiness.sourceFamilyGaps"
      ],
      filters: ["organizationId", "status", "sourceFamily", "eventType", "hasUpdatedEvent", "watchlistId", "watchlistItemId", "captureId", "caseId", "customerReadinessState", "customerReady", "caseReady", "deliveryReady", "workflowReady", "replayReady", "caseWebhookReplayReady", "hasDeliveryHistory", "readinessBlocker", "readyAction", "blockedAction", "transitionAction", "transitionBlocker"],
      zeroAlertContract: "dwm.zero_alert_proof.v1"
    },
    watchlistScope: {
      watchlistItemIds,
      alertGeneratorKeys,
      activeOnly: true,
      blockedLifecycleCodes: lifecycleBlockers
    },
    blockers: lifecycleBlockers.map((code) => ({
      code,
      field: code.startsWith("org_")
        ? "organization.status"
        : code.startsWith("member_") || code === "role_not_allowed" ? "membershipContext" : "alertQueue.lifecycle",
      recoverable: code !== "org_deleted"
    })),
    routes: {
      list: "/v1/dwm/alerts",
      detail: "/v1/dwm/alerts/:id",
      mutate: "/v1/dwm/alerts/:id",
      replay: "/v1/dwm/alerts/:id/replay",
      deliver: "/v1/dwm/webhooks/deliver"
    },
    filters: {
      status: input.url.searchParams.get("status") ?? input.url.searchParams.get("workflowStatus") ?? null,
      category: input.url.searchParams.get("category") ?? input.url.searchParams.get("termCategory") ?? null,
      watchlistItemId: input.url.searchParams.get("watchlistItemId"),
      alertGeneratorKey: input.url.searchParams.get("alertGeneratorKey") ?? input.url.searchParams.get("generationRef"),
      customerReadinessState: input.url.searchParams.get("customerReadinessState") ?? input.url.searchParams.get("readinessState"),
      customerReady: input.url.searchParams.get("customerReady") ?? input.url.searchParams.get("alertReady"),
      caseReady: input.url.searchParams.get("caseReady") ?? input.url.searchParams.get("caseHandoffReady"),
      deliveryReady: input.url.searchParams.get("deliveryReady") ?? input.url.searchParams.get("webhookReady"),
      replayReady: input.url.searchParams.get("replayReady") ?? input.url.searchParams.get("webhookReplayReady"),
      caseWebhookReplayReady: input.url.searchParams.get("caseWebhookReplayReady"),
      hasDeliveryHistory: input.url.searchParams.get("hasDeliveryHistory"),
      readinessBlocker: input.url.searchParams.get("readinessBlocker") ?? input.url.searchParams.get("blockerCode"),
      readyAction: input.url.searchParams.get("readyAction"),
      blockedAction: input.url.searchParams.get("blockedAction"),
      transitionAction: input.url.searchParams.get("transitionAction"),
      transitionBlocker: input.url.searchParams.get("transitionBlocker")
    },
    safeForDashboard: true,
    nonmemberEnumeration: false
  };
}

function buildDwmAlertQueueCustomerReadinessSummary(alerts: any[]) {
  const readinessRows = alerts
    .map((alert: any) => alert.customerReadiness)
    .filter(Boolean);
  const sourceFamilies = uniqueAlertStrings(readinessRows
    .map((row: any) => row.alertReadiness?.sourceFamily ?? row.sourceCoverage?.sourceFamily)
    .filter(Boolean).map(String));
  const blockerCodes = uniqueAlertStrings(readinessRows
    .flatMap((row: any) => [
      ...(row.blockerCodes ?? []),
      ...(row.deliveryReadiness?.blockerCodes ?? []),
      ...(row.webhookReplayReadiness?.blockerCodes ?? []),
      ...(row.caseWebhookReplayReadiness?.blockerCodes ?? []),
      ...(row.sourceCoverage?.blockerCodes ?? [])
    ])
    .filter(Boolean).map(String));
  const selectedCaptureIds = uniqueAlertStrings(readinessRows
    .flatMap((row: any) => row.alertReadiness?.selectedCaptureIds ?? row.webhookReplayReadiness?.selectedCaptureIds ?? [])
    .filter(Boolean).map(String));
  const watchlistItemIds = uniqueAlertStrings(readinessRows
    .flatMap((row: any) => row.alertReadiness?.watchlistItemIds ?? row.webhookReplayReadiness?.watchlistItemIds ?? [])
    .filter(Boolean).map(String));
  const sourceFamilyRows = sourceFamilies.map((sourceFamily) => {
    const rows = readinessRows.filter((row: any) => String(row.alertReadiness?.sourceFamily ?? row.sourceCoverage?.sourceFamily ?? "") === sourceFamily);
    return {
      sourceFamily,
      alertCount: rows.length,
      readyCount: rows.filter((row: any) => row.ready).length,
      blockedCount: rows.filter((row: any) => !row.ready).length,
      caseReadyCount: rows.filter((row: any) => row.caseHandoff?.ready).length,
      deliveryReadyCount: rows.filter((row: any) => row.deliveryReadiness?.ready).length,
      replayReadyCount: rows.filter((row: any) => row.webhookReplayReadiness?.ready).length,
      caseWebhookReplayReadyCount: rows.filter((row: any) => row.caseWebhookReplayReadiness?.ready).length,
      workflowReadyCount: rows.filter((row: any) => row.workflowReadiness?.ready).length,
      selectedCaptureIds: uniqueAlertStrings(rows.flatMap((row: any) => row.alertReadiness?.selectedCaptureIds ?? row.webhookReplayReadiness?.selectedCaptureIds ?? []).filter(Boolean).map(String)),
      watchlistItemIds: uniqueAlertStrings(rows.flatMap((row: any) => row.alertReadiness?.watchlistItemIds ?? row.webhookReplayReadiness?.watchlistItemIds ?? []).filter(Boolean).map(String)),
      blockerCodes: uniqueAlertStrings(rows.flatMap((row: any) => [
        ...(row.blockerCodes ?? []),
        ...(row.deliveryReadiness?.blockerCodes ?? []),
        ...(row.webhookReplayReadiness?.blockerCodes ?? []),
        ...(row.caseWebhookReplayReadiness?.blockerCodes ?? []),
        ...(row.sourceCoverage?.blockerCodes ?? [])
      ]).filter(Boolean).map(String)),
      states: uniqueAlertStrings(rows.map((row: any) => row.state).filter(Boolean).map(String))
    };
  });
  return {
    schemaVersion: "dwm.alert_queue_customer_readiness_summary.v1",
    alertCount: readinessRows.length,
    readyCount: readinessRows.filter((row: any) => row.ready).length,
    blockedCount: readinessRows.filter((row: any) => !row.ready).length,
    caseReadyCount: readinessRows.filter((row: any) => row.caseHandoff?.ready).length,
    deliveryReadyCount: readinessRows.filter((row: any) => row.deliveryReadiness?.ready).length,
    replayReadyCount: readinessRows.filter((row: any) => row.webhookReplayReadiness?.ready).length,
    caseWebhookReplayReadyCount: readinessRows.filter((row: any) => row.caseWebhookReplayReadiness?.ready).length,
    workflowReadyCount: readinessRows.filter((row: any) => row.workflowReadiness?.ready).length,
    deliveryHistoryCount: readinessRows.filter((row: any) => row.webhookReplayReadiness?.hasDeliveryHistory).length,
    sourceFamilies,
    sourceFamilyRows,
    selectedCaptureIds,
    watchlistItemIds,
    blockerCodes,
    states: uniqueAlertStrings(readinessRows.map((row: any) => row.state).filter(Boolean).map(String)),
    route: "/v1/dwm/alerts",
    filters: ["customerReadinessState", "customerReady", "caseReady", "deliveryReady", "replayReady", "caseWebhookReplayReady", "hasDeliveryHistory", "readinessBlocker"]
  };
}

function orgAlertWorkflowBridgeRefs(input: {
  watchlists: DwmWatchlist[];
  tenantId: string;
  organizationId?: string;
}) {
  return input.watchlists
    .filter((watchlist: any) => watchlist.tenantId === input.tenantId && (!input.organizationId || watchlist.organizationId === input.organizationId))
    .flatMap((watchlist: any) => (watchlist.terms ?? []).map((term: any, index: number) => {
      const value = String(term.value ?? term.term ?? "").trim();
      const normalizedTerm = String(term.normalizedTerm ?? value).trim().toLowerCase();
      const watchlistItemId = String(term.id ?? term.itemId ?? term.watchlistItemId ?? `${watchlist.id}:${index}:${normalizedTerm}`);
      const termFamily = String(term.kind ?? term.termFamily ?? term.category ?? "unknown").trim().toLowerCase();
      const alertGenerationRef = term.alertGenerationRef ?? term.alertGenerationReference;
      return {
        watchlistId: String(alertGenerationRef?.watchlistId ?? term.watchlistId ?? watchlist.id),
        watchlistItemId: String(alertGenerationRef?.watchlistItemId ?? watchlistItemId),
        tenantId: String(alertGenerationRef?.tenantId ?? term.tenantId ?? watchlist.tenantId),
        organizationId: String(alertGenerationRef?.organizationId ?? term.organizationId ?? watchlist.organizationId ?? input.organizationId ?? watchlist.tenantId),
        term: String(alertGenerationRef?.term ?? value),
        normalizedTerm: String(alertGenerationRef?.normalizedTerm ?? normalizedTerm),
        status: String(alertGenerationRef?.status ?? watchlist.status ?? "active"),
        alertGeneratorKey: String(term.alertGeneratorKey ?? alertGenerationRef?.dedupe?.key ?? `org:${watchlist.organizationId ?? input.organizationId ?? watchlist.tenantId}:watchlist:${watchlistItemId}:${termFamily}:${normalizedTerm}`)
      };
    }))
    .filter((row: any) => row.term.length > 0);
}

function buildDwmAlertDetailOrgWorkflowBridge(alert: any, options: ApiServerOptions) {
  const tenantId = String(alert.tenantId ?? alert.workflowContext?.tenantId ?? alert.webhookContext?.tenantId ?? "");
  const organizationId = String(alert.organizationId ?? alert.workflowContext?.organizationId ?? alert.webhookContext?.organizationId ?? tenantId);
  return buildOrgAlertWorkflowBridgeReport({
    tenantId,
    organizationId,
    watchlists: orgAlertWorkflowBridgeRefs({
      watchlists: (options.store as any).listDwmWatchlists?.() ?? [],
      tenantId,
      organizationId
    }),
    alerts: [alert],
    checkedAt: nowIso()
  });
}

function dwmAlertQueueAllowedActions(role: string, readOnly: boolean): string[] {
  if (readOnly || role === "viewer" || role === "support" || role === "nonmember") return [];
  if (role === "owner" || role === "admin" || role === "analyst") return ["acknowledge_alert", "assign_case", "link_case", "replay_alert", "deliver_webhook"];
  if (role === "member") return ["acknowledge_alert"];
  return [];
}

function dwmAlertQueueActionGate(role: string, readOnly: boolean, allowedRoles: string[]) {
  const allowed = !readOnly && allowedRoles.includes(role);
  return {
    allowed,
    allowedRoles,
    denialReason: allowed ? null : readOnly ? "read_only_member" : role === "nonmember" ? "not_member" : "role_not_allowed"
  };
}

function organizationLifecycleStatus(organization: unknown): "active" | "archived" | "deleted" {
  const status = String((organization as any)?.status ?? (organization as any)?.lifecycleStatus ?? "active").trim().toLowerCase();
  return status === "archived" || status === "deleted" ? status : "active";
}

function downstreamLifecycleForAlert(options: ApiServerOptions, alert: any, scope?: { organization?: unknown; organizationId?: string }) {
  const organizationId = scope?.organizationId ?? alert.organizationId ?? alert.workflowContext?.organizationId ?? alert.webhookContext?.organizationId;
  const organization = scope?.organization ?? findOrganizationForDwmLifecycle(options, organizationId);
  const watchlistIds = new Set([...(alert.watchlistIds ?? []), ...(alert.workflowContext?.watchlistIds ?? []), ...(alert.webhookContext?.watchlistIds ?? [])].filter(Boolean).map(String));
  const retiredWatchlistIds = ((options.store as any).listDwmWatchlists?.() ?? [])
    .filter((watchlist: any) => watchlistIds.has(String(watchlist.id)))
    .filter((watchlist: any) => watchlist.status !== "active" || watchlist.lifecycleStatus === "archived")
    .map((watchlist: any) => String(watchlist.id));
  const webhookDestinationIds = new Set([
    ...(alert.deliveryReadinessContext?.webhookDestinationIds ?? []),
    ...(alert.workflowContext?.webhookDestinationIds ?? []),
    ...(alert.webhookContext?.webhookDestinationIds ?? [])
  ].filter(Boolean).map(String));
  const disabledDestinationIds = ((options.store as any).listWebhookDestinations?.() ?? [])
    .filter((destination: any) => webhookDestinationIds.has(String(destination.id)))
    .filter((destination: any) => destination.status !== "active")
    .map((destination: any) => String(destination.id));
  const sourceFamily = String(alert.deliveryReadinessContext?.sourceFamily ?? alert.sourceFamily ?? alert.workflowContext?.sourceFamily ?? alert.webhookContext?.sourceFamily ?? "");
  const activeSourceMatch = !sourceFamily || options.store.listSources().some((source: any) =>
    ["active", "approved", "canary"].includes(String(source.status ?? "").toLowerCase())
      && classifySourceFamily(source) === sourceFamily
  );
  return {
    organizationStatus: (organization as any)?.status,
    retiredWatchlistIds,
    disabledDestinationIds,
    activeSourceMatch
  };
}

function organizationLifecycleActive(organization: unknown): boolean {
  const status = String((organization as any)?.status ?? "active").toLowerCase();
  return status === "active" || status === "enabled";
}

function findOrganizationForDwmLifecycle(options: ApiServerOptions, organizationId: string | undefined) {
  if (!organizationId) return undefined;
  return (options.store as any).getOrganization?.(organizationId)
    ?? ((options.store as any).listOrganizations?.() ?? []).find((organization: any) => organization.id === organizationId);
}

function nextActionsForAlert(alert: any, deliveries: any[]) {
  if (alert.deliveryState === "muted" || alert.reviewState === "false_positive") return ["Keep muted unless new evidence changes the match."];
  if (alert.deliveryState === "ready_to_send") return ["Send the customer webhook.", "Keep monitoring the matched source and actor."];
  if (deliveries.some((delivery: any) => delivery.status === "delivered")) return ["Monitor for updates on the same watchlist term.", "Reopen if new evidence changes severity."];
  return ["Review the evidence.", "Mark ready when the customer should be notified.", "Mute if the match is a false positive."];
}

function buildDwmAlertNextBestAction(alert: any, deliveries: any[]) {
  const actions = nextActionsForAlert(alert, deliveries);
  const status = String(alert.workflowStatus ?? "new");
  const hasDelivered = deliveries.some((delivery: any) => delivery.status === "delivered");
  const canDeliver = alert.deliveryState === "ready_to_send" && !hasDelivered;
  return {
    schemaVersion: "dwm.alert_next_best_action.v1",
    action: status === "closed"
      ? "monitor_closed"
      : status === "suppressed"
        ? "monitor_suppressed"
        : canDeliver
          ? "send_webhook"
          : status === "new"
            ? "triage_alert"
            : status === "triaged" || status === "reopened"
              ? "investigate_or_route"
              : "continue_review",
    label: actions[0] ?? "Review the alert.",
    reason: alert.workflowRationale ?? alert.workflowNote ?? alert.recommendedAction,
    requiresRationale: status === "new" || status === "triaged" || status === "investigating" || status === "reopened",
    route: alert.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute,
    casePath: alert.casePath ?? alert.workflowContext?.casePath,
    webhookReady: buildDwmAlertDeliveryReadiness(alert, deliveries).ready
  };
}

function buildDwmAlertCaseHandoff(alert: any) {
  try {
    const handoff = buildAlertCaseHandoff({
      alert,
      tenantId: alert.tenantId,
      organizationId: alert.organizationId,
      createdAt: alert.updatedAt ?? alert.savedAt ?? alert.lastSeenAt
    });
    const createdEvent = buildDwmAlertCreatedEventSummary(alert);
    if (!createdEvent) return handoff;
    return {
      ...handoff,
      payload: {
        ...handoff.payload,
        body: {
          ...handoff.payload.body,
          createdEvent
        }
      }
    };
  } catch (caught) {
    return {
      schemaVersion: "hanasand.analyst_handoff_error.v1",
      kind: "alert_case_handoff",
      error: caught instanceof Error ? caught.message : String(caught),
      alertId: alert.id
    };
  }
}

function buildDwmAlertDeliveryReadiness(alert: any, deliveries: any[]) {
  const persisted = alert.deliveryReadinessContext;
  const webhookDestinationIds = alert.webhookContext?.webhookDestinationIds ?? alert.workflowContext?.webhookDestinationIds ?? [];
  const captureIds = alert.webhookContext?.captureIds ?? alert.workflowContext?.captureIds ?? alert.provenance?.captureIds ?? [];
  const lastDelivery = [...deliveries].sort((a: any, b: any) => String(a.attemptedAt ?? "").localeCompare(String(b.attemptedAt ?? ""))).at(-1);
  const hasRoute = Boolean(alert.workflowContext?.hasWebhookRoute || webhookDestinationIds.length);
  const suppressed = alert.workflowStatus === "suppressed" || alert.deliveryState === "muted";
  const closed = alert.workflowStatus === "closed";
  const ready = !suppressed && !closed && hasRoute && captureIds.length > 0 && (alert.evidence ?? []).length > 0;
  return {
    schemaVersion: "dwm.alert_delivery_readiness.v1",
    ready,
    state: ready ? "ready" : closed ? "closed" : suppressed ? "suppressed" : hasRoute ? "needs_evidence_review" : "missing_route",
    persistedContext: persisted,
    typedBlockers: persisted?.blockers ?? [],
    blockerCodes: persisted?.blockerCodes ?? [],
    deliveryState: alert.deliveryState,
    recommendedRoute: alert.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute,
    webhookDestinationIds,
    captureIds,
    selectedCaptureIds: persisted?.selectedCaptureIds ?? captureIds,
    evidenceCount: alert.workflowContext?.evidenceCount ?? alert.webhookContext?.evidenceCount ?? (alert.evidence ?? []).length,
    hasWebhookRoute: hasRoute,
    dedupeKey: alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey,
    deliveryDedupeKey: persisted?.deliveryDedupeKey ?? alert.webhookDelivery?.dedupeKey ?? alert.dedupeKey,
    replayMarker: persisted?.replayMarker,
    createdEvent: buildDwmAlertCreatedEventSummary(alert),
    alertGeneratorKeys: persisted?.alertGeneratorKeys ?? alert.workflowContext?.alertGeneratorKeys ?? alert.webhookContext?.alertGeneratorKeys ?? [],
    sourceFamily: persisted?.sourceFamily ?? alert.sourceFamily,
    caseIdCandidate: persisted?.caseIdCandidate ?? alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate,
    caseId: persisted?.caseId ?? alert.caseId,
    casePath: persisted?.casePath ?? alert.casePath ?? alert.workflowContext?.casePath,
    deliveryHistoryRefs: persisted?.deliveryHistoryRefs ?? deliveries.map((delivery: any) => delivery.id).filter(Boolean),
    lastDeliveryStatus: lastDelivery?.status,
    lastDeliveryAt: lastDelivery?.attemptedAt,
    blocker: ready ? null : closed ? "alert_closed" : suppressed ? "alert_suppressed" : hasRoute ? "review_required" : "missing_webhook_route"
  };
}

function buildDwmAlertEvidenceFreshness(alert: any) {
  const generationEvidenceWindow = alert.workflowContext?.generationEvidenceWindow ?? alert.webhookContext?.generationEvidenceWindow;
  const observed = (alert.evidence ?? [])
    .map((item: any) => item.observedAt ?? item.firstSeenAt ?? item.provenance?.observedAt)
    .filter(Boolean)
    .map(String)
    .sort();
  const captureIds = alert.workflowContext?.captureIds ?? alert.webhookContext?.captureIds ?? alert.provenance?.captureIds ?? [];
  return {
    schemaVersion: "dwm.alert_evidence_freshness.v1",
    firstSeenAt: alert.firstSeenAt ?? observed[0],
    lastSeenAt: alert.lastSeenAt ?? observed.at(-1),
    newestEvidenceAt: observed.at(-1) ?? alert.lastSeenAt,
    oldestEvidenceAt: observed[0] ?? alert.firstSeenAt,
    evidenceCount: alert.workflowContext?.evidenceCount ?? alert.webhookContext?.evidenceCount ?? (alert.evidence ?? []).length,
    sourceCount: alert.sourceCount ?? uniqueSourceCount(alert),
    sourceFamily: alert.sourceFamily,
    captureIds,
    generationEvidenceWindow,
    contentHashes: uniqueAlertStrings((alert.evidence ?? []).map((item: any) => item.contentHash).filter(Boolean))
  };
}

function buildDwmAlertProvenanceFreshness(alert: any) {
  const generationEvidenceWindow = alert.workflowContext?.generationEvidenceWindow ?? alert.webhookContext?.generationEvidenceWindow;
  return {
    schemaVersion: "dwm.alert_provenance_freshness.v1",
    matchBasis: alert.provenance?.matchBasis,
    captureIds: alert.provenance?.captureIds ?? alert.workflowContext?.captureIds ?? [],
    sourceIds: alert.provenance?.sourceIds ?? uniqueAlertStrings((alert.evidence ?? []).map((item: any) => item.provenance?.sourceId ?? item.sourceId).filter(Boolean)),
    firstSeenAt: alert.firstSeenAt,
    lastSeenAt: alert.lastSeenAt,
    generationEvidenceWindow,
    generatedFromWatchlists: alert.watchlistIds ?? alert.workflowContext?.watchlistIds ?? [],
    dedupeKey: alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey
  };
}

function uniqueSourceCount(alert: any) {
  return uniqueAlertStrings((alert.evidence ?? []).map((item: any) => item.sourceId ?? item.provenance?.sourceId ?? item.sourceName).filter(Boolean)).length;
}

function alertMatchesDwmAlertFilters(alert: any, url: URL) {
  if (!matchesParam(url, ["status", "workflowStatus"], alert.workflowStatus ?? "new")) return false;
  if (!matchesParam(url, ["reviewState"], alert.reviewState)) return false;
  if (!matchesParam(url, ["deliveryState"], alert.deliveryState)) return false;
  if (!matchesParam(url, ["assignee", "assignedOwner", "owner"], alert.assignedOwner ?? "unassigned")) return false;
  if (!matchesParam(url, ["severity"], alert.severityOverride ?? alert.severity)) return false;
  if (!matchesParam(url, ["severityOverride"], alert.severityOverride ?? "none")) return false;
  if (!matchesParam(url, ["sourceFamily"], alert.sourceFamily)) return false;
  if (!matchesParam(url, ["visibilityPolicy"], alert.workflowContext?.visibilityPolicy ?? alert.webhookContext?.visibilityPolicy)) return false;
  if (!matchesParam(url, ["termCategory", "category"], alert.workflowContext?.matchedTermCategory ?? alert.webhookContext?.matchedTermCategory)) return false;
  if (!matchesAnyParam(url, ["allowedRole", "memberRole"], alert.workflowContext?.membershipContext?.allowedViewerRoles ?? alert.webhookContext?.membershipContext?.allowedViewerRoles ?? [])) return false;
  if (!matchesParam(url, ["recommendedRoute", "route"], alert.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute)) return false;
  if (!matchesAnyParam(url, ["watchlistId"], alert.watchlistIds ?? alert.workflowContext?.watchlistIds ?? [])) return false;
  if (!matchesAnyParam(url, ["watchlistItemId"], alert.watchlistItemIds ?? alert.workflowContext?.watchlistItemIds ?? [])) return false;
  if (!matchesAnyParam(url, ["alertGeneratorKey", "generationRef"], alert.workflowContext?.alertGeneratorKeys ?? alert.webhookContext?.alertGeneratorKeys ?? [])) return false;
  if (!matchesAnyParam(url, ["captureId"], alert.workflowContext?.captureIds ?? alert.webhookContext?.captureIds ?? alert.provenance?.captureIds ?? [])) return false;
  if (!matchesParam(url, ["caseId"], alert.caseId ?? alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate)) return false;
  if (!matchesAnyParam(url, ["eventType", "alertEvent"], (alert.alertEvents ?? []).map((event: any) => event.eventType))) return false;
  if (!matchesBooleanParam(url, ["hasUpdatedEvent", "updated"], Boolean(alert.alertUpdatedEvent))) return false;
  const query = String(url.searchParams.get("q") ?? url.searchParams.get("term") ?? "").trim().toLowerCase();
  if (query) {
    const haystack = [
      alert.company,
      alert.actor,
      alert.claimSummary,
      alert.matchedTerm?.value,
      alert.dedupeKey,
      alert.caseId,
      alert.caseIdCandidate,
      ...(alert.workflowContext?.captureIds ?? [])
    ].filter(Boolean).join(" ").toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

function alertMatchesDwmAlertReadinessFilters(alert: any, url: URL) {
  const readiness = alert.customerReadiness ?? {};
  if (!matchesParam(url, ["customerReadinessState", "readinessState"], readiness.state)) return false;
  if (!matchesBooleanParam(url, ["customerReady", "alertReady"], Boolean(readiness.ready))) return false;
  if (!matchesBooleanParam(url, ["caseReady", "caseHandoffReady"], Boolean(readiness.caseHandoff?.ready))) return false;
  if (!matchesBooleanParam(url, ["deliveryReady", "webhookReady"], Boolean(readiness.deliveryReadiness?.ready))) return false;
  if (!matchesBooleanParam(url, ["replayReady", "webhookReplayReady"], Boolean(readiness.webhookReplayReadiness?.ready))) return false;
  if (!matchesBooleanParam(url, ["caseWebhookReplayReady"], Boolean(readiness.caseWebhookReplayReadiness?.ready))) return false;
  if (!matchesBooleanParam(url, ["hasDeliveryHistory"], Boolean(readiness.webhookReplayReadiness?.hasDeliveryHistory))) return false;
  if (!matchesBooleanParam(url, ["workflowReady", "analystWorkflowReady"], Boolean(readiness.workflowReadiness?.ready))) return false;
  if (!matchesAnyParam(url, ["readinessBlocker", "blockerCode"], readiness.blockerCodes ?? [])) return false;
  if (!matchesAnyParam(url, ["sourceCoverageBlocker"], readiness.sourceCoverage?.blockerCodes ?? [])) return false;
  if (!matchesAnyParam(url, ["readyAction"], readiness.workflowReadiness?.readyActions ?? [])) return false;
  if (!matchesAnyParam(url, ["blockedAction"], (readiness.workflowReadiness?.blockedActions ?? []).map((row: any) => row.action))) return false;
  if (!matchesAnyParam(url, ["transitionAction"], readiness.transitionHandoff?.actions ?? [])) return false;
  if (!matchesAnyParam(url, ["transitionBlocker"], readiness.transitionHandoff?.blockerCodes ?? [])) return false;
  return true;
}

function matchesParam(url: URL, keys: string[], value: unknown) {
  const raw = firstSearchParam(url, keys);
  if (!raw) return true;
  const allowed = splitFilterValues(raw);
  const normalized = String(value ?? "").trim().toLowerCase();
  return allowed.includes(normalized);
}

function matchesAnyParam(url: URL, keys: string[], values: unknown[]) {
  const raw = firstSearchParam(url, keys);
  if (!raw) return true;
  const allowed = splitFilterValues(raw);
  return values.map((value) => String(value ?? "").trim().toLowerCase()).some((value) => allowed.includes(value));
}

function matchesBooleanParam(url: URL, keys: string[], value: boolean) {
  const raw = firstSearchParam(url, keys);
  if (!raw) return true;
  const normalized = raw.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return value;
  if (["false", "0", "no"].includes(normalized)) return !value;
  return true;
}

function firstSearchParam(url: URL, keys: string[]) {
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value !== null && value !== "") return value;
  }
  return undefined;
}

function splitFilterValues(value: string) {
  return value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function uniqueAlertStrings(values: string[]) {
  return [...new Set(values)];
}

function alertStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)].filter(Boolean);
}

function alertDetailPathFor(alert: any) {
  const existing = alert.alertDetailPath
    ?? alert.deliveryReadinessContext?.alertDetailPath
    ?? alert.workflowContext?.alertDetailPath
    ?? alert.webhookContext?.alertDetailPath
    ?? alert.alertCreatedEvent?.alertDetailPath
    ?? alert.alertUpdatedEvent?.alertDetailPath;
  if (existing) return String(existing);
  const alertId = String(alert.id ?? "").trim();
  if (!alertId) return undefined;
  const params = new URLSearchParams();
  const organizationId = alert.organizationId ?? alert.workflowContext?.organizationId ?? alert.webhookContext?.organizationId;
  const tenantId = alert.tenantId ?? alert.workflowContext?.tenantId ?? alert.webhookContext?.tenantId;
  const dedupeKey = alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey ?? alert.workflowContext?.dedupeKey ?? alert.webhookContext?.dedupeKey;
  if (organizationId) params.set("organizationId", String(organizationId));
  else if (tenantId) params.set("tenantId", String(tenantId));
  if (dedupeKey) params.set("dedupeKey", String(dedupeKey));
  const query = params.toString();
  return `/v1/dwm/alerts/${encodeURIComponent(alertId)}${query ? `?${query}` : ""}`;
}

function buildDwmAlertCreatedEventSummary(alert: any) {
  const alertCreatedEvent = alert.alertCreatedEvent;
  const deliveryContext = alert.deliveryReadinessContext ?? {};
  const createdEventId = alertCreatedEvent?.id ?? deliveryContext.alertCreatedEventId;
  const createdEventAt = alertCreatedEvent?.at ?? deliveryContext.alertCreatedAt;
  if (!createdEventId && !createdEventAt) return undefined;
  return {
    schemaVersion: "dwm.alert_created_event.v1",
    eventId: createdEventId,
    eventType: alertCreatedEvent?.eventType ?? "dwm.alert.created",
    at: createdEventAt,
    sourceFamily: alertCreatedEvent?.sourceFamily ?? alert.sourceFamily ?? deliveryContext.sourceFamily,
    captureIds: uniqueAlertStrings((Array.isArray(alertCreatedEvent?.captureIds)
      ? alertCreatedEvent.captureIds
      : deliveryContext.selectedCaptureIds ?? alert.provenance?.captureIds ?? []).map(String).filter(Boolean)),
    dedupeKey: alertCreatedEvent?.dedupeKey ?? alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey,
    recommendedRoute: alertCreatedEvent?.recommendedRoute ?? alert.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute,
    alertDetailPath: alertCreatedEvent?.alertDetailPath ?? alertDetailPathFor(alert)
  };
}

function buildDwmAlertUpdatedEventSummary(alert: any) {
  const updatedEvent = alert.alertUpdatedEvent;
  if (!updatedEvent?.id && !updatedEvent?.at) return undefined;
  return {
    schemaVersion: "dwm.alert_updated_event.v1",
    eventId: updatedEvent.id,
    eventType: updatedEvent.eventType ?? "dwm.alert.updated",
    at: updatedEvent.at,
    sourceFamily: updatedEvent.sourceFamily ?? alert.sourceFamily,
    captureIds: uniqueAlertStrings((updatedEvent.captureIds ?? alert.workflowContext?.captureIds ?? alert.provenance?.captureIds ?? []).map(String).filter(Boolean)),
    addedCaptureIds: uniqueAlertStrings((updatedEvent.addedCaptureIds ?? []).map(String).filter(Boolean)),
    evidenceCount: updatedEvent.evidenceCount ?? alert.workflowContext?.evidenceCount ?? (alert.evidence ?? []).length,
    previousEvidenceCount: updatedEvent.previousEvidenceCount,
    dedupeKey: updatedEvent.dedupeKey ?? alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey,
    recommendedRoute: updatedEvent.recommendedRoute ?? alert.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute,
    alertDetailPath: updatedEvent.alertDetailPath ?? alertDetailPathFor(alert)
  };
}

function buildDwmAlertEventSummary(alert: any) {
  const eventTypes = uniqueAlertStrings((alert.alertEvents ?? []).map((event: any) => event.eventType).filter(Boolean).map(String));
  return {
    schemaVersion: "dwm.alert_event_summary.v1",
    eventCount: (alert.alertEvents ?? []).length,
    eventTypes,
    createdEvent: buildDwmAlertCreatedEventSummary(alert),
    updatedEvent: buildDwmAlertUpdatedEventSummary(alert),
    latestEventType: (alert.alertEvents ?? []).at(-1)?.eventType,
    latestEventAt: (alert.alertEvents ?? []).at(-1)?.at,
    hasUpdatedEvent: Boolean(alert.alertUpdatedEvent)
  };
}

function buildDwmAlertWorkflowSummary(alert: any) {
  const events = [...(alert.workflowEvents ?? [])].sort((a: any, b: any) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
  const lastEvent = events.at(-1);
  const status = String(alert.workflowStatus ?? "new");
  const effectiveSeverity = String(alert.severityOverride ?? alert.severity ?? "medium");
  return {
    schemaVersion: "dwm.alert_workflow_summary.v1",
    status,
    createdEvent: buildDwmAlertCreatedEventSummary(alert),
    updatedEvent: buildDwmAlertUpdatedEventSummary(alert),
    alertEventSummary: buildDwmAlertEventSummary(alert),
    reviewState: alert.reviewState,
    deliveryState: alert.deliveryState,
    assignedOwner: alert.assignedOwner,
    severity: alert.severity,
    severityOverride: alert.severityOverride ?? null,
    effectiveSeverity,
    workflowNote: alert.workflowNote,
    workflowRationale: alert.workflowRationale,
    eventCount: events.length,
    workflowTransitionEvents: events.map((event: any, index: number) => buildDwmAlertWorkflowTransitionEvent(alert, event, index)),
    lastEventAt: lastEvent?.at,
    lastEventType: lastEvent?.eventType,
    lastActor: lastEvent?.actor,
    caseId: alert.caseId,
    caseIdCandidate: alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate,
    casePath: alert.casePath ?? alert.workflowContext?.casePath,
    replayCount: Number(alert.replayCount ?? 0),
    deliveredAt: alert.deliveredAt,
    suppressedAt: alert.suppressedAt,
    closedAt: alert.closedAt,
    reopenedAt: alert.reopenedAt,
    dedupeKey: alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey,
    evidenceCount: alert.workflowContext?.evidenceCount ?? (alert.evidence ?? []).length,
    sourceFamily: alert.sourceFamily,
    watchlistIds: alert.watchlistIds ?? alert.workflowContext?.watchlistIds ?? [],
    watchlistItemIds: alert.watchlistItemIds ?? alert.workflowContext?.watchlistItemIds ?? [],
    watchlistTermContexts: alert.workflowContext?.watchlistTermContexts ?? [],
    alertGenerationRefs: alert.workflowContext?.alertGenerationRefs ?? alert.webhookContext?.alertGenerationRefs ?? [],
    alertGeneratorKeys: alert.workflowContext?.alertGeneratorKeys ?? alert.webhookContext?.alertGeneratorKeys ?? [],
    matchedTermCategory: alert.workflowContext?.matchedTermCategory ?? alert.webhookContext?.matchedTermCategory,
    membershipContext: alert.workflowContext?.membershipContext ?? alert.webhookContext?.membershipContext
  };
}

function buildDwmAlertWorkflowTransitionEvent(alert: any, event: any, index: number) {
  const toStatus = String(event.toWorkflowStatus ?? alert.workflowStatus ?? "new");
  return {
    schemaVersion: "dwm.alert_workflow_transition_event.v1",
    id: event.id ? String(event.id) : stableWorkflowEventId(alert, event, index),
    at: event.at ? String(event.at) : undefined,
    actor: event.actor ? String(event.actor) : undefined,
    eventType: event.eventType ? String(event.eventType) : "workflow.transition",
    action: workflowTransitionAction(event, toStatus),
    fromStatus: event.fromWorkflowStatus ? String(event.fromWorkflowStatus) : undefined,
    toStatus,
    fromReviewState: event.fromReviewState,
    toReviewState: event.toReviewState,
    fromDeliveryState: event.fromDeliveryState,
    toDeliveryState: event.toDeliveryState,
    fromOwner: event.fromOwner,
    toOwner: event.toOwner,
    fromSeverityOverride: event.fromSeverityOverride,
    toSeverityOverride: event.toSeverityOverride,
    caseId: event.toCaseId ?? alert.caseId,
    casePath: event.toCasePath ?? alert.casePath,
    hasNote: Boolean(event.note),
    hasRationale: Boolean(event.rationale),
    dedupeKey: alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey,
    sourceFamily: alert.sourceFamily,
    watchlistIds: alert.watchlistIds ?? alert.workflowContext?.watchlistIds ?? [],
    captureIds: alert.workflowContext?.captureIds ?? alert.provenance?.captureIds ?? []
  };
}

function workflowTransitionAction(event: any, toStatus: string) {
  if (toStatus === "closed") return "closed";
  if (toStatus === "suppressed") return "suppressed";
  if (toStatus === "reopened") return "reopened";
  if (event.toCaseId || event.toCasePath) return "escalated";
  if (toStatus === "investigating") return "escalated";
  if (toStatus === "triaged") return "reviewed";
  if (event.toOwner !== event.fromOwner) return "assigned";
  if (event.eventType === "workflow.note") return "note";
  return "transition";
}

function stableWorkflowEventId(alert: any, event: any, index: number) {
  return `workflow_event_${String(alert.id ?? "alert")}_${String(event.at ?? index).replace(/[^a-z0-9]+/gi, "_")}`;
}
