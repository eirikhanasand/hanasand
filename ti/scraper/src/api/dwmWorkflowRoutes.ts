import { buildDwmProductSnapshot, normalizeWatchlist, type DwmWatchTerm } from "../product/dwmProduct.ts";
import { nowIso, stableId } from "../utils.ts";
import { json, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

type DwmWatchlist = {
  id: string;
  tenantId: string;
  name: string;
  terms: DwmWatchTerm[];
  webhookUrl?: string;
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
  const watchlist: DwmWatchlist = {
    id: body.id ?? stableId("dwm_watchlist", `${tenantId}:${terms.map((term) => term.value).join("|")}`),
    tenantId,
    name: String(body.name ?? "Company exposure watchlist"),
    terms,
    webhookUrl: body.webhookUrl ? String(body.webhookUrl) : undefined,
    status: body.status === "paused" ? "paused" : "active",
    createdAt: generatedAt,
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
  const saved = snapshot.alerts.map((alert) => (options.store as any).saveDwmAlert({
    ...alert,
    tenantId,
    watchlistIds: watchlists.map((watchlist: DwmWatchlist) => watchlist.id),
    deliveryState: "pending_review",
    savedAt: snapshot.generatedAt
  }));
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
    if (!watchlist?.webhookUrl) continue;
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
    evidence: (alert.evidence ?? []).map((item: any) => ({
      id: item.id,
      sourceName: item.sourceName,
      sourceFamily: item.sourceFamily,
      captureMode: item.captureMode,
      redactionState: item.redactionState,
      contentHash: item.contentHash
    })),
    delivery: alert.webhookDelivery
  };
}
