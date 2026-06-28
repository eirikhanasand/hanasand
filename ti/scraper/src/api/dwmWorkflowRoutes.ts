import { normalizeWatchlist, type DwmWatchTerm } from "../product/dwmProduct.ts";
import { rebuildDwmRuntimeAlerts } from "../storage/dwmAlertRepository.ts";
import { nowIso, stableId } from "../utils.ts";
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
  (options.store as any).saveDwmWatchlist(watchlist);
  return json({ organization: scope.organization, visibilityDecision: access.visibilityDecision, watchlist: buildDwmWatchlistDetail(watchlist, options, access) }, 201);
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
  (options.store as any).saveDwmWatchlist(watchlist);
  return json({ organization: scope.organization, visibilityDecision: access.visibilityDecision, watchlist: buildDwmWatchlistDetail(watchlist, options, access) });
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
  return json({ organization: scope.organization, visibilityDecision: access.visibilityDecision, alerts: alerts.filter((row: any) => row.tenantId === tenantId) });
}

export function getDwmAlertDetail(url: URL, options: ApiServerOptions, alertId: string | undefined, request?: Request): Response {
  const alert = findDwmAlert(options, alertId);
  if (!alert) return json({ error: { code: "not_found", message: "DWM alert not found." } }, 404);
  const scope = resolveDwmAlertScope({ alert, url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  if (alert.tenantId !== scope.tenantId) return json({ error: { code: "not_found", message: "DWM alert not found." } }, 404);
  return json(buildDwmAlertDetail(alert, options, access));
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
  const generatedAt = nowIso();
  const allowedReviewStates = new Set(["needs_review", "validate_identity", "route_to_customer", "watching", "false_positive_candidate", "reviewing", "resolved", "false_positive"]);
  const allowedDeliveryStates = new Set(["pending_review", "ready_to_send", "sent", "delivered", "failed", "muted"]);
  const reviewState = body.reviewState === undefined ? existing.reviewState : String(body.reviewState);
  const deliveryState = body.deliveryState === undefined ? existing.deliveryState : String(body.deliveryState);
  const assignedOwner = body.assignedOwner === undefined && body.owner === undefined ? existing.assignedOwner : normalizeOwner(body.assignedOwner ?? body.owner);
  if (!allowedReviewStates.has(reviewState)) return json({ error: { code: "invalid_review_state", message: "Unsupported DWM alert review state." } }, 400);
  if (!allowedDeliveryStates.has(deliveryState)) return json({ error: { code: "invalid_delivery_state", message: "Unsupported DWM alert delivery state." } }, 400);

  const event = {
    id: stableId("dwm_alert_event", `${alertId}:${generatedAt}:${reviewState}:${deliveryState}:${assignedOwner ?? ""}:${body.note ?? ""}`),
    at: generatedAt,
    actor: String(body.actor ?? request.headers.get("x-actor-id") ?? "dashboard"),
    fromReviewState: existing.reviewState,
    toReviewState: reviewState,
    fromDeliveryState: existing.deliveryState,
    toDeliveryState: deliveryState,
    fromOwner: existing.assignedOwner,
    toOwner: assignedOwner,
    note: body.note ? String(body.note).slice(0, 500) : undefined
  };
  const alert = (options.store as any).saveDwmAlert({
    ...existing,
    reviewState,
    deliveryState,
    assignedOwner,
    workflowNote: body.note ? String(body.note).slice(0, 500) : existing.workflowNote,
    updatedAt: generatedAt,
    workflowEvents: [...(existing.workflowEvents ?? []), event]
  });
  return json({ visibilityDecision: access.visibilityDecision, alert, event });
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
  const generatedAt = nowIso();
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
  const alert = (options.store as any).saveDwmAlert({
    ...existing,
    replayCount: Number(existing.replayCount ?? 0) + 1,
    lastReplayedAt: generatedAt,
    updatedAt: generatedAt,
    workflowEvents: [...(existing.workflowEvents ?? []), event]
  });
  return json(buildDwmAlertDetail(alert, options, access));
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

export async function rebuildDwmAlerts(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  const tenantId = scope.tenantId;
  const watchlists = ((options.store as any).listDwmWatchlists?.() ?? []).filter((row: DwmWatchlist) => row.tenantId === tenantId && row.status === "active");
  const terms = watchlists.flatMap((watchlist: DwmWatchlist) => watchlist.terms);
  if (!terms.length) return json({ error: { code: "missing_watchlist", message: "Create an active DWM watchlist before rebuilding alerts." } }, 400);

  const rebuilt = rebuildDwmRuntimeAlerts({ store: options.store as any, tenantId, organizationId: scope.organizationId, visibilityPolicy: organizationAlertVisibilityPolicy(scope.organization) });
  return json({ organization: scope.organization, visibilityDecision: access.visibilityDecision, ...rebuilt });
}

export async function deliverDwmWebhooks(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  const tenantId = scope.tenantId;
  const dryRun = body.dryRun === true;
  const fetcher = typeof options.webhookFetch === "function" ? options.webhookFetch as typeof fetch : fetch;
  const watchlists = ((options.store as any).listDwmWatchlists?.() ?? []).filter((row: DwmWatchlist) => row.tenantId === tenantId && row.status === "active");
  const orgDestinations = organizationWebhookDestinations(options, scope.organizationId);
  const alerts = ((options.store as any).listDwmAlerts?.() ?? []).filter((alert: any) => alert.tenantId === tenantId && (body.alertId ? alert.id === body.alertId : alert.deliveryState !== "delivered"));
  const generatedAt = nowIso();
  const deliveries: any[] = [];

  for (const alert of alerts.slice(0, Math.max(1, Math.min(Number(body.limit ?? 25), 100)))) {
    const watchlist = watchlists.find((row: DwmWatchlist) => alert.watchlistIds?.includes(row.id)) ?? watchlists[0];
    const destination = selectWebhookDestination(options, orgDestinations, watchlist, body.webhookDestinationId ? String(body.webhookDestinationId) : undefined);
    const webhookUrl = normalizeWebhookUrl(destination?.url) ?? normalizeWebhookUrl(watchlist?.webhookUrl);
    const deliveryKind = destination?.kind ?? inferWebhookKind(webhookUrl ?? "");
    if (!webhookUrl) {
      const deliveryId = stableId("dwm_delivery", `${tenantId}:${alert.id}:missing-webhook:${generatedAt}`);
      deliveries.push((options.store as any).saveDwmWebhookDelivery({
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
      }));
      continue;
    }
    const payload = buildWebhookPayload(alert, watchlist, generatedAt, destination);
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
      deliveries.push((options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: "dry_run", httpStatus: 0 }));
      continue;
    }

    try {
      const response = await fetcher(webhookUrl, {
        method: "POST",
        headers: webhookHeaders("darkweb.monitoring.match", deliveryId, baseDelivery.dedupeKey),
        body: JSON.stringify(requestBody)
      });
      const ok = response.status >= 200 && response.status < 300;
      deliveries.push((options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: ok ? "delivered" : "failed", httpStatus: response.status }));
      if (ok) (options.store as any).saveDwmAlert({ ...alert, deliveryState: "delivered", deliveredAt: generatedAt });
    } catch (error) {
      deliveries.push((options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: "failed", httpStatus: 0, error: error instanceof Error ? error.message : String(error) }));
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

function buildWebhookPayload(alert: any, watchlist: DwmWatchlist, generatedAt: string, destination?: WebhookDestination) {
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
    caseIdCandidate: alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate,
    caseId: alert.caseId,
    casePath: alert.casePath ?? alert.workflowContext?.casePath,
    watchlistItemIds: alert.watchlistItemIds ?? alert.workflowContext?.watchlistItemIds ?? [],
    captureIds: alert.workflowContext?.captureIds ?? alert.provenance?.captureIds ?? [],
    evidenceCount: alert.workflowContext?.evidenceCount ?? (alert.evidence ?? []).length,
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

function selectWebhookDestination(options: ApiServerOptions, orgDestinations: WebhookDestination[], watchlist: DwmWatchlist | undefined, requestedDestinationId?: string): WebhookDestination | undefined {
  if (requestedDestinationId) return orgDestinations.find((row) => row.id === requestedDestinationId);
  const watchlistDestination = findWebhookDestination(options, watchlist?.webhookDestinationId);
  if (watchlistDestination && orgDestinations.some((row) => row.id === watchlistDestination.id)) return watchlistDestination;
  return orgDestinations[0];
}

type DwmWorkflowAccessMode = "read" | "mutate";
type DwmVisibilityPolicy = "members" | "admins" | "owners";
type DwmVisibilityDenyReason = "not_member" | "member_removed" | "member_deactivated" | "role_not_allowed";
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

function normalizeOwner(value: unknown): string | undefined {
  const owner = String(value ?? "").trim().slice(0, 120);
  return owner || undefined;
}

function buildDwmAlertDetail(alert: any, options: ApiServerOptions, access?: DwmWorkflowAccessResult) {
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === alert.id);
  const events = [...(alert.workflowEvents ?? [])].sort((a: any, b: any) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
  const timeline = [
    alert.savedAt ? { id: `${alert.id}:saved`, at: alert.savedAt, type: "saved", title: "Alert saved", detail: "Match saved to the customer queue." } : undefined,
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

  return {
    schemaVersion: "dwm.alert_detail.v1",
    generatedAt: nowIso(),
    visibilityDecision: access?.visibilityDecision,
    alert,
    deliveries,
    timeline,
    evidenceReplay,
    sourceExplanations: evidenceReplay.map((item: any) => ({
      evidenceId: item.id,
      sourceName: item.sourceName,
      explanation: `${String(item.sourceFamily).replaceAll("_", " ")} evidence is shown as ${String(item.redactionState).replaceAll("_", " ")} with hash ${item.contentHash}; capture ${item.provenance?.captureId ?? item.id} was observed at ${item.observedAt}.`
    })),
    nextActions: nextActionsForAlert(alert, deliveries)
  };
}

function nextActionsForAlert(alert: any, deliveries: any[]) {
  if (alert.deliveryState === "muted" || alert.reviewState === "false_positive") return ["Keep muted unless new evidence changes the match."];
  if (alert.deliveryState === "ready_to_send") return ["Send the customer webhook.", "Keep monitoring the matched source and actor."];
  if (deliveries.some((delivery: any) => delivery.status === "delivered")) return ["Monitor for updates on the same watchlist term.", "Reopen if new evidence changes severity."];
  return ["Review the evidence.", "Mark ready when the customer should be notified.", "Mute if the match is a false positive."];
}
