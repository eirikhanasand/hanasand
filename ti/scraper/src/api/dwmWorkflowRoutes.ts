import { buildDwmProductSnapshot, normalizeWatchlist, type DwmWatchTerm } from "../product/dwmProduct.ts";
import { nowIso, stableId } from "../utils.ts";
import { json, readJson } from "./http.ts";
import { buildWebhookRequestBody, findWebhookDestination, inferWebhookKind, organizationWebhookDestinations, resolveOrganizationScope, webhookHeaders, type WebhookDestination } from "./organizationRoutes.ts";
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

export function listDwmWatchlists(url: URL, options: ApiServerOptions): Response {
  const tenantId = url.searchParams.get("tenantId") ?? undefined;
  const watchlists = (options.store as any).listDwmWatchlists?.() ?? [];
  return json({ watchlists: tenantId ? watchlists.filter((row: DwmWatchlist) => row.tenantId === tenantId) : watchlists });
}

export async function createDwmWatchlist(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const terms = normalizeWatchlist(Array.isArray(body.terms) ? body.terms : String(body.terms ?? body.watchlist ?? "").split(/[,\n]/));
  if (!terms.length) return json({ error: { code: "missing_terms", message: "Add at least one company, domain, vendor, brand, VIP, or product term." } }, 400);

  const generatedAt = nowIso();
  const tenantId = String(body.tenantId ?? request.headers.get("x-tenant-id") ?? "default");
  const webhookUrl = normalizeWebhookUrl(body.webhookUrl);
  if (body.webhookUrl && !webhookUrl) return json({ error: { code: "invalid_webhook_url", message: "Webhook URL must start with http:// or https://." } }, 400);
  const id = body.id ?? stableId("dwm_watchlist", `${tenantId}:${terms.map((term) => term.value).join("|")}`);
  const existing = (options.store as any).getDwmWatchlist?.(id);
  const watchlist: DwmWatchlist = {
    id,
    tenantId,
    name: String(body.name ?? "Company exposure watchlist"),
    terms,
    webhookUrl,
    status: body.status === "paused" ? "paused" : "active",
    createdAt: existing?.createdAt ?? generatedAt,
    updatedAt: generatedAt
  };
  (options.store as any).saveDwmWatchlist(watchlist);
  return json({ watchlist }, 201);
}

export function listDwmAlerts(url: URL, options: ApiServerOptions): Response {
  const tenantId = url.searchParams.get("tenantId") ?? undefined;
  const alerts = (options.store as any).listDwmAlerts?.() ?? [];
  return json({ alerts: tenantId ? alerts.filter((row: any) => row.tenantId === tenantId) : alerts });
}

export function getDwmAlertDetail(url: URL, options: ApiServerOptions, alertId: string | undefined): Response {
  const alert = findDwmAlert(options, alertId);
  if (!alert) return json({ error: { code: "not_found", message: "DWM alert not found." } }, 404);
  const tenantId = url.searchParams.get("tenantId") ?? undefined;
  if (tenantId && alert.tenantId !== tenantId) return json({ error: { code: "not_found", message: "DWM alert not found." } }, 404);
  return json(buildDwmAlertDetail(alert, options));
}

export async function updateDwmAlert(request: Request, options: ApiServerOptions, alertId: string | undefined): Promise<Response> {
  const existing = findDwmAlert(options, alertId);
  if (!existing) return json({ error: { code: "not_found", message: "DWM alert not found." } }, 404);

  const body = await readJson<any>(request);
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
  return json({ alert, event });
}

export async function replayDwmAlert(request: Request, options: ApiServerOptions, alertId: string | undefined): Promise<Response> {
  const existing = findDwmAlert(options, alertId);
  if (!existing) return json({ error: { code: "not_found", message: "DWM alert not found." } }, 404);
  const body = await readJson<any>(request);
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
  return json(buildDwmAlertDetail(alert, options));
}

export function listDwmWebhookDeliveries(url: URL, options: ApiServerOptions): Response {
  const tenantId = url.searchParams.get("tenantId") ?? undefined;
  const deliveries = (options.store as any).listDwmWebhookDeliveries?.() ?? [];
  return json({ deliveries: tenantId ? deliveries.filter((row: any) => row.tenantId === tenantId) : deliveries });
}

export async function rebuildDwmAlerts(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const tenantId = String(body.tenantId ?? request.headers.get("x-tenant-id") ?? "default");
  const watchlists = ((options.store as any).listDwmWatchlists?.() ?? []).filter((row: DwmWatchlist) => row.tenantId === tenantId && row.status === "active");
  const terms = watchlists.flatMap((watchlist: DwmWatchlist) => watchlist.terms);
  if (!terms.length) return json({ error: { code: "missing_watchlist", message: "Create an active DWM watchlist before rebuilding alerts." } }, 400);

  const snapshot = buildDwmProductSnapshot({
    tenantId,
    watchlist: terms,
    sources: options.store.listSources(),
    captures: options.store.listCaptures(),
    includeDemoIfEmpty: false
  });
  const saved = snapshot.alerts.map((alert) => {
    const existing = findDwmAlert(options, alert.id) ?? findDwmAlertByDedupeKey(options, alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey);
    return (options.store as any).saveDwmAlert({
      ...alert,
      id: existing?.id ?? alert.id,
      tenantId,
      watchlistIds: watchlists.map((watchlist: DwmWatchlist) => watchlist.id),
      reviewState: existing?.reviewState ?? alert.reviewState,
      deliveryState: existing?.deliveryState ?? "pending_review",
      workflowEvents: existing?.workflowEvents ?? [],
      workflowNote: existing?.workflowNote,
      assignedOwner: existing?.assignedOwner,
      replayCount: existing?.replayCount ?? 0,
      lastReplayedAt: existing?.lastReplayedAt,
      deliveredAt: existing?.deliveredAt,
      savedAt: existing?.savedAt ?? snapshot.generatedAt,
      updatedAt: snapshot.generatedAt
    });
  });
  return json({ rebuiltAt: snapshot.generatedAt, savedAlertCount: saved.length, alerts: saved, readiness: snapshot.readiness });
}

export async function deliverDwmWebhooks(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const tenantId = String(body.tenantId ?? request.headers.get("x-tenant-id") ?? "default");
  const dryRun = body.dryRun === true;
  const fetcher = typeof options.webhookFetch === "function" ? options.webhookFetch as typeof fetch : fetch;
  const watchlists = ((options.store as any).listDwmWatchlists?.() ?? []).filter((row: DwmWatchlist) => row.tenantId === tenantId && row.status === "active" && row.webhookUrl);
  const alerts = ((options.store as any).listDwmAlerts?.() ?? []).filter((alert: any) => alert.tenantId === tenantId && (body.alertId ? alert.id === body.alertId : alert.deliveryState !== "delivered"));
  const generatedAt = nowIso();
  const deliveries: any[] = [];

  for (const alert of alerts.slice(0, Math.max(1, Math.min(Number(body.limit ?? 25), 100)))) {
    const watchlist = watchlists.find((row: DwmWatchlist) => alert.watchlistIds?.includes(row.id)) ?? watchlists[0];
    if (!watchlist?.webhookUrl) {
      const deliveryId = stableId("dwm_delivery", `${tenantId}:${alert.id}:missing-webhook:${generatedAt}`);
      deliveries.push((options.store as any).saveDwmWebhookDelivery({
        id: deliveryId,
        tenantId,
        alertId: alert.id,
        watchlistId: alert.watchlistIds?.[0] ?? "missing_watchlist",
        endpointHash: "missing_webhook_url",
        dedupeKey: alert.webhookDelivery?.dedupeKey ?? deliveryId,
        attemptedAt: generatedAt,
        dryRun,
        payloadHash: "not_sent",
        status: "skipped",
        httpStatus: 0,
        error: "No webhook URL configured for the active watchlist."
      }));
      continue;
    }
    const payload = buildWebhookPayload(alert, watchlist, generatedAt);
    const deliveryId = stableId("dwm_delivery", `${tenantId}:${alert.id}:${watchlist.id}:${alert.webhookDelivery?.dedupeKey ?? ""}`);
    const baseDelivery = {
      id: deliveryId,
      tenantId,
      alertId: alert.id,
      watchlistId: watchlist.id,
      endpointHash: stableId("endpoint", watchlist.webhookUrl),
      dedupeKey: alert.webhookDelivery?.dedupeKey ?? deliveryId,
      attemptedAt: generatedAt,
      dryRun,
      payloadHash: stableId("payload", JSON.stringify(payload))
    };

    if (dryRun) {
      deliveries.push((options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: "dry_run", httpStatus: 0 }));
      continue;
    }

    try {
      const response = await fetcher(watchlist.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hanasand-event": "darkweb.monitoring.match",
          "x-hanasand-delivery-id": deliveryId,
          "x-hanasand-dedupe-key": baseDelivery.dedupeKey
        },
        body: JSON.stringify(payload)
      });
      const ok = response.status >= 200 && response.status < 300;
      deliveries.push((options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: ok ? "delivered" : "failed", httpStatus: response.status }));
      if (ok) (options.store as any).saveDwmAlert({ ...alert, deliveryState: "delivered", deliveredAt: generatedAt });
    } catch (error) {
      deliveries.push((options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: "failed", httpStatus: 0, error: error instanceof Error ? error.message : String(error) }));
    }
  }

  return json({ deliveredAt: generatedAt, attemptedCount: deliveries.length, deliveries });
}

export async function testDwmWebhook(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const tenantId = String(body.tenantId ?? request.headers.get("x-tenant-id") ?? "default");
  const watchlists = ((options.store as any).listDwmWatchlists?.() ?? []).filter((row: DwmWatchlist) => row.tenantId === tenantId && row.status === "active");
  const watchlist = body.watchlistId ? watchlists.find((row: DwmWatchlist) => row.id === body.watchlistId) : watchlists.find((row: DwmWatchlist) => row.webhookUrl) ?? watchlists[0];
  const webhookUrl = normalizeWebhookUrl(body.webhookUrl) ?? normalizeWebhookUrl(watchlist?.webhookUrl);
  if (!webhookUrl) return json({ error: { code: "missing_webhook_url", message: "Save a valid webhook URL before testing delivery." } }, 400);

  const generatedAt = nowIso();
  const fetcher = typeof options.webhookFetch === "function" ? options.webhookFetch as typeof fetch : fetch;
  const deliveryId = stableId("dwm_delivery", `${tenantId}:webhook_test:${webhookUrl}:${generatedAt}`);
  const payload = {
    eventType: "darkweb.monitoring.test",
    tenantId,
    watchlistId: watchlist?.id ?? "ad_hoc_webhook_test",
    generatedAt,
    message: "Hanasand dark web monitoring webhook test.",
    expectedAlertEvent: "darkweb.monitoring.match"
  };
  const baseDelivery = {
    id: deliveryId,
    tenantId,
    alertId: "webhook_test",
    watchlistId: watchlist?.id ?? "ad_hoc_webhook_test",
    endpointHash: stableId("endpoint", webhookUrl),
    dedupeKey: deliveryId,
    attemptedAt: generatedAt,
    dryRun: body.dryRun === true,
    payloadHash: stableId("payload", JSON.stringify(payload))
  };

  if (body.dryRun === true) {
    const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: "dry_run", httpStatus: 0 });
    return json({ testedAt: generatedAt, ok: true, dryRun: true, delivery });
  }

  try {
    const response = await fetcher(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hanasand-event": "darkweb.monitoring.test",
        "x-hanasand-delivery-id": deliveryId,
        "x-hanasand-dedupe-key": deliveryId
      },
      body: JSON.stringify(payload)
    });
    const ok = response.status >= 200 && response.status < 300;
    const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: ok ? "delivered" : "failed", httpStatus: response.status });
    return json({ testedAt: generatedAt, ok, delivery }, ok ? 200 : 502);
  } catch (error) {
    const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: "failed", httpStatus: 0, error: error instanceof Error ? error.message : String(error) });
    return json({ testedAt: generatedAt, ok: false, delivery }, 502);
  }
}

export function storedWatchlistTerms(options: ApiServerOptions, tenantId: string | undefined): DwmWatchTerm[] {
  return ((options.store as any).listDwmWatchlists?.() ?? [])
    .filter((row: DwmWatchlist) => (!tenantId || row.tenantId === tenantId) && row.status === "active")
    .flatMap((row: DwmWatchlist) => row.terms);
}

function buildWebhookPayload(alert: any, watchlist: DwmWatchlist, generatedAt: string) {
  return {
    eventType: alert.eventType,
    alertId: alert.id,
    tenantId: alert.tenantId,
    watchlistId: watchlist.id,
    generatedAt,
    severity: alert.severity,
    confidence: alert.confidence,
    confidenceReasoning: alert.confidenceReasoning ?? [],
    provenance: alert.provenance,
    dedupeKey: alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey,
    company: alert.company,
    matchedTerm: alert.matchedTerm?.value,
    actor: alert.actor,
    artifactType: alert.artifactType,
    sourceFamily: alert.sourceFamily,
    sourceCount: alert.sourceCount,
    firstSeenAt: alert.firstSeenAt,
    claimSummary: alert.claimSummary,
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

function findDwmAlert(options: ApiServerOptions, alertId: string | undefined) {
  if (!alertId) return undefined;
  return (options.store as any).getDwmAlert?.(alertId) ?? ((options.store as any).listDwmAlerts?.() ?? []).find((row: any) => row.id === alertId);
}

function findDwmAlertByDedupeKey(options: ApiServerOptions, dedupeKey: string | undefined) {
  if (!dedupeKey) return undefined;
  return ((options.store as any).listDwmAlerts?.() ?? []).find((row: any) => row.dedupeKey === dedupeKey || row.webhookDelivery?.dedupeKey === dedupeKey);
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

function buildDwmAlertDetail(alert: any, options: ApiServerOptions) {
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
