import { classifySourceFamily, normalizeWatchlist, type DwmWatchTerm } from "../product/dwmProduct.ts";
import { buildDwmAlertCustomerProofHandoffRow, buildDwmAlertDownstreamHandoff, buildDwmAlertGenerationReadiness, buildDwmAlertRetentionAudit, buildDwmAlertWorkflowExecutionReadiness, buildDwmPersistedDeliveryReadinessContext, rebuildDwmRuntimeAlerts } from "../storage/dwmAlertRepository.ts";
import { buildAlertCaseHandoff } from "../product/analystHandoff.ts";
import { nowIso, stableId } from "../utils.ts";
import { buildDwmEntitlementBlocker, buildDwmEntitlementReadAdapter, evaluateProposedDwmAlertRebuildEntitlement, evaluateProposedDwmWatchlistEntitlement, recordDwmEntitlementUsageEvent } from "./dwmEntitlementRoutes.ts";
import { json, readJson } from "./http.ts";
import { buildWebhookRequestBody, findWebhookDestination, inferWebhookKind, organizationWebhookDestinations, resolveOrganizationScope, webhookHeaders, type WebhookDestination } from "./organizationRoutes.ts";
import type { OrganizationMember } from "./organizationRoutes.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

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
};

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
    terms,
    webhookUrl,
    webhookDestinationId: webhookDestinationId ?? existing?.webhookDestinationId,
    status: body.status === "paused" ? "paused" : "active",
    createdAt: existing?.createdAt ?? generatedAt,
    updatedAt: generatedAt
  };
  const entitlement = enforceDwmWatchlistEntitlement({ options, request, body, scope, access, watchlist, action: "create_dwm_watchlist" });
  if (entitlement.error) return entitlement.error;
  (options.store as any).saveDwmWatchlist(watchlist);
  return json({ organization: scope.organization, visibilityDecision: access.visibilityDecision, entitlement: entitlement.adapter, watchlist: buildDwmWatchlistDetail(watchlist, options, access) }, 201);
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
    terms,
    webhookUrl,
    webhookDestinationId,
    status: normalizeWatchlistStatus(body.status, existing.status),
    updatedAt: nowIso()
  };
  const entitlement = enforceDwmWatchlistEntitlement({ options, request, body, scope, access, watchlist, action: "update_dwm_watchlist" });
  if (entitlement.error) return entitlement.error;
  (options.store as any).saveDwmWatchlist(watchlist);
  return json({ organization: scope.organization, visibilityDecision: access.visibilityDecision, entitlement: entitlement.adapter, watchlist: buildDwmWatchlistDetail(watchlist, options, access) });
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

export function listDwmAlerts(url: URL, options: ApiServerOptions, request?: Request): Response {
  const scope = resolveOrganizationScope({ url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  const tenantId = scope.tenantId;
  const alerts = (options.store as any).listDwmAlerts?.() ?? [];
  const visibleAlerts = alerts
    .filter((row: any) => row.tenantId === tenantId)
    .filter((row: any) => !scope.organizationId || row.organizationId === scope.organizationId)
    .filter((alert: any) => alertMatchesDwmAlertFilters(alert, url));
  return json({
    organization: scope.organization,
    visibilityDecision: access.visibilityDecision,
    alertQueueVisibility: buildDwmAlertQueueVisibility({
      organizationId: scope.organizationId,
      tenantId,
      organization: scope.organization,
      access,
      alerts: visibleAlerts,
      options,
      url
    }),
    alerts: visibleAlerts.map((alert: any) => buildDwmAlertListItem(alert, options))
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
  return json({
    visibilityDecision: access.visibilityDecision,
    workflowExecutionReadiness: buildDwmAlertWorkflowExecutionReadiness({ alert, organizationId: scope.organizationId, action: workflowActionFromBody(body) }),
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
  return json({ organization: scope.organization, visibilityDecision: access.visibilityDecision, deliveries: deliveries.filter((row: any) => row.tenantId === tenantId) });
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
  const fetcher = typeof options.webhookFetch === "function" ? options.webhookFetch as typeof fetch : fetch;
  const watchlists = ((options.store as any).listDwmWatchlists?.() ?? []).filter((row: DwmWatchlist) => row.tenantId === tenantId && row.status === "active");
  const orgDestinations = organizationWebhookDestinations(options, scope.organizationId);
  const alerts = ((options.store as any).listDwmAlerts?.() ?? []).filter((alert: any) => alert.tenantId === tenantId && (body.alertId ? alert.id === body.alertId : alert.deliveryState !== "delivered"));
  const generatedAt = nowIso();
  const deliveries: any[] = [];

  for (const alert of alerts.slice(0, Math.max(1, Math.min(Number(body.limit ?? 25), 100)))) {
    const alertWatchlistIds = new Set((alert.watchlistIds ?? alert.workflowContext?.watchlistIds ?? []).map(String));
    const watchlist = watchlists.find((row: DwmWatchlist) => alertWatchlistIds.has(row.id)) ?? (!alertWatchlistIds.size ? watchlists[0] : undefined);
    const existingDeliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === alert.id);
    const downstreamHandoff = buildDwmAlertDownstreamHandoff({
      alert,
      deliveries: existingDeliveries,
      organizationId: scope.organizationId,
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
        organizationId: scope.organizationId,
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
      refreshAlertDeliveryReadiness(options, alert, scope, [delivery], generatedAt);
      continue;
    }
    const requestedDestinationId = body.webhookDestinationId ? String(body.webhookDestinationId) : downstreamHandoff.deliverySelection.selectedWebhookDestinationId;
    const destination = selectWebhookDestination(options, orgDestinations, watchlist, requestedDestinationId);
    const disabledDestination = findDisabledWebhookDestination(options, requestedDestinationId ?? watchlist?.webhookDestinationId);
    if (!watchlist || disabledDestination) {
      const deliveryId = stableId("dwm_delivery", `${tenantId}:${alert.id}:${disabledDestination ? "disabled-destination" : "retired-watchlist"}:${generatedAt}`);
      const delivery = (options.store as any).saveDwmWebhookDelivery({
        id: deliveryId,
        organizationId: scope.organizationId,
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
      refreshAlertDeliveryReadiness(options, alert, scope, [delivery], generatedAt);
      continue;
    }
    const webhookUrl = normalizeWebhookUrl(destination?.url) ?? normalizeWebhookUrl(watchlist?.webhookUrl);
    const deliveryKind = destination?.kind ?? inferWebhookKind(webhookUrl ?? "");
    if (!webhookUrl) {
      const deliveryId = stableId("dwm_delivery", `${tenantId}:${alert.id}:missing-webhook:${generatedAt}`);
      const delivery = (options.store as any).saveDwmWebhookDelivery({
        id: deliveryId,
        organizationId: scope.organizationId,
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
      refreshAlertDeliveryReadiness(options, alert, scope, [delivery], generatedAt);
      continue;
    }
    const payload = buildWebhookPayload(alert, watchlist, generatedAt, destination, downstreamHandoff);
    const requestBody = buildWebhookRequestBody(deliveryKind, payload);
    const deliveryId = stableId("dwm_delivery", `${tenantId}:${alert.id}:${destination?.id ?? watchlist.id}:${alert.webhookDelivery?.dedupeKey ?? ""}`);
    const baseDelivery = {
      id: deliveryId,
      organizationId: scope.organizationId,
      tenantId,
      alertId: alert.id,
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
      refreshAlertDeliveryReadiness(options, alert, scope, [delivery], generatedAt);
      continue;
    }

    try {
      const response = await fetcher(webhookUrl, {
        method: "POST",
        headers: webhookHeaders("darkweb.monitoring.match", deliveryId, baseDelivery.dedupeKey),
        body: JSON.stringify(requestBody)
      });
      const ok = response.status >= 200 && response.status < 300;
      const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: ok ? "delivered" : "failed", httpStatus: response.status });
      deliveries.push(delivery);
      const nextAlert = ok ? { ...alert, deliveryState: "delivered", deliveredAt: generatedAt } : alert;
      refreshAlertDeliveryReadiness(options, nextAlert, scope, [delivery], generatedAt);
    } catch (error) {
      const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: "failed", httpStatus: 0, error: error instanceof Error ? error.message : String(error) });
      deliveries.push(delivery);
      refreshAlertDeliveryReadiness(options, alert, scope, [delivery], generatedAt);
    }
  }

  return json({ organization: scope.organization, visibilityDecision: access.visibilityDecision, deliveredAt: generatedAt, attemptedCount: deliveries.length, deliveries });
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
    const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: "dry_run", httpStatus: 0 });
    return json({ visibilityDecision: access.visibilityDecision, testedAt: generatedAt, ok: true, dryRun: true, delivery });
  }

  try {
    const response = await fetcher(webhookUrl, {
      method: "POST",
      headers: webhookHeaders("darkweb.monitoring.test", deliveryId, deliveryId),
      body: JSON.stringify(requestBody)
    });
    const ok = response.status >= 200 && response.status < 300;
    const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: ok ? "delivered" : "failed", httpStatus: response.status });
    return json({ visibilityDecision: access.visibilityDecision, testedAt: generatedAt, ok, delivery }, ok ? 200 : 502);
  } catch (error) {
    const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: "failed", httpStatus: 0, error: error instanceof Error ? error.message : String(error) });
    return json({ visibilityDecision: access.visibilityDecision, testedAt: generatedAt, ok: false, delivery }, 502);
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
    claimSummary: alert.claimSummary,
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

function authorizeDwmWorkflowAccess(input: { options: ApiServerOptions; scope: { organizationId?: string; organization?: unknown }; request?: Request; url?: URL; body?: any; mode: DwmWorkflowAccessMode }): DwmWorkflowAccessResult {
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
  return [
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
  return {
    ...watchlist,
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

function normalizeWatchlistStatus(value: unknown, fallback: DwmWatchlist["status"]): DwmWatchlist["status"] {
  const status = String(value ?? "").trim().toLowerCase();
  if (!status) return fallback;
  return status === "disabled" || status === "paused" ? "paused" : "active";
}

function normalizeWebhookUrl(value: unknown): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
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

  return {
    schemaVersion: "dwm.alert_detail.v1",
    generatedAt: nowIso(),
    visibilityDecision: access?.visibilityDecision,
    alert: buildDwmAlertListItem(alert, options, deliveries),
    workflowSummary: buildDwmAlertWorkflowSummary(alert),
    alertEventSummary: buildDwmAlertEventSummary(alert),
    workflowExecutionReadiness: buildDwmAlertWorkflowExecutionReadiness({ alert, organizationId: alert.organizationId }),
    analystWorkflowContract: buildDwmAlertAnalystWorkflowContract(alert),
    customerProofHandoff: buildDwmAlertCustomerProofHandoffRow({ alert, deliveries }),
    downstreamHandoff,
    alertCreatedDispatch: downstreamHandoff.createdEventDispatch,
    retentionAudit: buildDwmAlertRetentionAudit({ alert, deliveries, downstreamHandoff }),
    caseHandoff: buildDwmAlertCaseHandoff(alert),
    nextBestAction: buildDwmAlertNextBestAction(alert, deliveries),
    deliveryReadiness: buildDwmAlertDeliveryReadiness(alert, deliveries),
    evidenceFreshness: buildDwmAlertEvidenceFreshness(alert),
    provenanceFreshness: buildDwmAlertProvenanceFreshness(alert),
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
  };
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
      "workflowSummary",
      "analystWorkflowContract",
      "alertEventSummary",
      "customerProofHandoff",
      "downstreamHandoff",
      "caseHandoff",
      "deliveryReadiness",
      "evidenceFreshness",
      "provenanceFreshness",
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
  return {
    ...alert,
    alertDetailPath: alertDetailPathFor(alert),
    workflowSummary,
    workflowExecutionReadiness: buildDwmAlertWorkflowExecutionReadiness({ alert, organizationId: alert.organizationId }),
    customerProofHandoff: buildDwmAlertCustomerProofHandoffRow({ alert, deliveries: alertDeliveries }),
    downstreamHandoff,
    alertCreatedDispatch: downstreamHandoff.createdEventDispatch,
    alertEventSummary: buildDwmAlertEventSummary(alert),
    retentionAudit: buildDwmAlertRetentionAudit({ alert, deliveries: alertDeliveries, downstreamHandoff }),
    caseHandoff: buildDwmAlertCaseHandoff(alert),
    nextBestAction: buildDwmAlertNextBestAction(alert, alertDeliveries),
    deliveryReadiness: buildDwmAlertDeliveryReadiness(alert, alertDeliveries),
    evidenceFreshness: buildDwmAlertEvidenceFreshness(alert),
    provenanceFreshness: buildDwmAlertProvenanceFreshness(alert)
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
      zeroAlertProof: generationReadiness.zeroAlertProof
    },
    zeroAlertProof: generationReadiness.zeroAlertProof,
    consumerContract: {
      schemaVersion: "dwm.alert_queue_consumer_contract.v1",
      route: "/v1/dwm/alerts",
      stableFields: [
        "alerts[].id",
        "alerts[].alertDetailPath",
        "alerts[].organizationId",
        "alerts[].sourceFamily",
        "alerts[].workflowSummary",
        "alerts[].alertEventSummary",
        "alerts[].evidenceFreshness",
        "alerts[].provenanceFreshness",
        "alertQueueVisibility.zeroAlertProof",
        "alertQueueVisibility.generationReadiness.sourceFamilyCoverage"
      ],
      filters: ["organizationId", "status", "sourceFamily", "eventType", "hasUpdatedEvent", "watchlistId", "watchlistItemId", "captureId", "caseId"],
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
      alertGeneratorKey: input.url.searchParams.get("alertGeneratorKey") ?? input.url.searchParams.get("generationRef")
    },
    safeForDashboard: true,
    nonmemberEnumeration: false
  };
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
