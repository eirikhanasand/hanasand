import { buildDwmProductSnapshot, type DwmAlert, type DwmWatchTerm } from "../product/dwmProduct.ts";
import { stableId } from "../utils.ts";

export type RuntimeDwmWatchlist = {
  id: string;
  tenantId: string;
  organizationId?: string;
  terms: DwmWatchTerm[];
  webhookDestinationId?: string;
  webhookUrl?: string;
  status: "active" | "paused";
};

export type RuntimeDwmAlertStore = {
  listDwmWatchlists(): RuntimeDwmWatchlist[];
  listDwmAlerts(): any[];
  saveDwmAlert(alert: any): any;
  listSources(): any[];
  listCaptures(): any[];
};

export type RebuildDwmRuntimeAlertsInput = {
  store: RuntimeDwmAlertStore;
  tenantId: string;
  organizationId?: string;
};

export type RebuildDwmRuntimeAlertsResult = {
  rebuiltAt: string;
  savedAlertCount: number;
  alerts: any[];
  watchlistIds: string[];
  readiness: ReturnType<typeof buildDwmProductSnapshot>["readiness"];
};

export function rebuildDwmRuntimeAlerts(input: RebuildDwmRuntimeAlertsInput): RebuildDwmRuntimeAlertsResult {
  const watchlists = input.store.listDwmWatchlists()
    .filter((row) => row.tenantId === input.tenantId && row.status === "active");
  const watchlistIds = watchlists.map((row) => row.id);
  const terms = watchlists.flatMap((row) => row.terms);
  const snapshot = buildDwmProductSnapshot({
    tenantId: input.tenantId,
    watchlist: terms,
    sources: input.store.listSources(),
    captures: input.store.listCaptures(),
    includeDemoIfEmpty: false
  });

  const alerts = snapshot.alerts.map((alert) => {
    const existing = findExistingAlert(input.store, alert);
    const alertId = existing?.id ?? alert.id;
    const workflowContext = buildDwmAlertWorkflowContext({
      alert: { ...alert, id: alertId },
      tenantId: input.tenantId,
      organizationId: input.organizationId ?? existing?.organizationId,
      watchlists
    });
    return input.store.saveDwmAlert({
      ...alert,
      id: alertId,
      tenantId: input.tenantId,
      organizationId: input.organizationId ?? existing?.organizationId,
      watchlistIds,
      watchlistItemIds: workflowContext.watchlistItemIds,
      workflowContext,
      webhookContext: buildDwmAlertWebhookContext(alert, workflowContext),
      caseIdCandidate: workflowContext.caseIdCandidate,
      caseId: existing?.caseId,
      casePath: workflowContext.casePath,
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

  return {
    rebuiltAt: snapshot.generatedAt,
    savedAlertCount: alerts.length,
    alerts,
    watchlistIds,
    readiness: snapshot.readiness
  };
}

export function dwmAlertToSqlRecord(alert: any) {
  return {
    id: String(alert.id),
    tenant_id: String(alert.tenantId),
    organization_id: alert.organizationId ? String(alert.organizationId) : null,
    event_type: String(alert.eventType),
    dedupe_key: String(alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey),
    severity: String(alert.severity),
    confidence: Number(alert.confidence),
    confidence_reasoning: alert.confidenceReasoning ?? [],
    matched_term: alert.matchedTerm,
    company: String(alert.company),
    actor: alert.actor ? String(alert.actor) : null,
    artifact_type: String(alert.artifactType),
    source_family: String(alert.sourceFamily),
    source_count: Number(alert.sourceCount ?? 1),
    first_seen_at: String(alert.firstSeenAt),
    last_seen_at: String(alert.lastSeenAt),
    claim_summary: String(alert.claimSummary),
    provenance: alert.provenance,
    review_state: String(alert.reviewState),
    delivery_state: String(alert.deliveryState ?? "pending_review"),
    recommended_action: String(alert.recommendedAction),
    recommended_route: String(alert.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute),
    evidence: alert.evidence ?? [],
    webhook_delivery: alert.webhookDelivery,
    workflow_context: alert.workflowContext,
    webhook_context: alert.webhookContext,
    case_id_candidate: alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate ?? null,
    case_path: alert.casePath ?? alert.workflowContext?.casePath ?? null,
    watchlist_item_ids: alert.watchlistItemIds ?? alert.workflowContext?.watchlistItemIds ?? [],
    watchlist_ids: alert.watchlistIds ?? [],
    workflow_note: alert.workflowNote ? String(alert.workflowNote) : null,
    assigned_owner: alert.assignedOwner ? String(alert.assignedOwner) : null,
    workflow_events: alert.workflowEvents ?? [],
    replay_count: Number(alert.replayCount ?? 0),
    last_replayed_at: alert.lastReplayedAt ? String(alert.lastReplayedAt) : null,
    delivered_at: alert.deliveredAt ? String(alert.deliveredAt) : null,
    saved_at: String(alert.savedAt),
    updated_at: String(alert.updatedAt)
  };
}

export function buildDwmAlertWorkflowContext(input: {
  alert: DwmAlert;
  tenantId: string;
  organizationId?: string;
  watchlists: RuntimeDwmWatchlist[];
}) {
  const captureIds = input.alert.provenance?.captureIds ?? (input.alert.evidence ?? []).map((item) => item.provenance?.captureId ?? item.id);
  const watchlistIds = input.watchlists.map((watchlist) => watchlist.id);
  const watchlistItemIds = input.watchlists.flatMap((watchlist) => watchlistItemIdsFor(watchlist, input.alert.matchedTerm?.value));
  const dedupeKey = String(input.alert.dedupeKey ?? input.alert.webhookDelivery?.dedupeKey);
  const caseIdCandidate = stableId("case", `${input.tenantId}:${input.alert.id}`);
  return {
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    caseIdCandidate,
    watchlistIds,
    watchlistItemIds,
    matchedTerm: input.alert.matchedTerm,
    sourceFamily: input.alert.sourceFamily,
    captureIds,
    primaryCaptureId: captureIds[0],
    evidenceCount: (input.alert.evidence ?? []).length,
    dedupeKey,
    recommendedRoute: input.alert.recommendedRoute ?? input.alert.webhookDelivery?.recommendedRoute,
    casePath: `/v1/cases/${encodeURIComponent(caseIdCandidate)}?alertId=${encodeURIComponent(input.alert.id)}&dedupeKey=${encodeURIComponent(dedupeKey)}`,
    webhookDestinationIds: input.watchlists.map((watchlist) => watchlist.webhookDestinationId).filter(Boolean),
    hasWebhookRoute: input.watchlists.some((watchlist) => Boolean(watchlist.webhookDestinationId || watchlist.webhookUrl))
  };
}

export function buildDwmAlertWebhookContext(alert: DwmAlert, workflowContext: ReturnType<typeof buildDwmAlertWorkflowContext>) {
  return {
    eventType: alert.eventType,
    alertId: alert.id,
    tenantId: workflowContext.tenantId,
    organizationId: workflowContext.organizationId,
    watchlistIds: workflowContext.watchlistIds,
    watchlistItemIds: workflowContext.watchlistItemIds,
    sourceFamily: workflowContext.sourceFamily,
    captureIds: workflowContext.captureIds,
    evidenceCount: workflowContext.evidenceCount,
    dedupeKey: workflowContext.dedupeKey,
    recommendedRoute: workflowContext.recommendedRoute,
    caseIdCandidate: workflowContext.caseIdCandidate,
    casePath: workflowContext.casePath,
    severity: alert.severity,
    confidence: alert.confidence,
    confidenceReasoning: alert.confidenceReasoning ?? [],
    provenance: alert.provenance,
    claimSummary: alert.claimSummary
  };
}

function findExistingAlert(store: RuntimeDwmAlertStore, alert: DwmAlert) {
  const dedupeKey = alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey;
  return store.listDwmAlerts()
    .find((row) => row.id === alert.id || row.dedupeKey === dedupeKey || row.webhookDelivery?.dedupeKey === dedupeKey);
}

function watchlistItemIdsFor(watchlist: RuntimeDwmWatchlist, matchedTerm: string | undefined): string[] {
  if (!matchedTerm) return [];
  return watchlist.terms
    .filter((term) => term.value.toLowerCase() === matchedTerm.toLowerCase())
    .map((term) => String((term as any).id ?? `${watchlist.id}:${term.value}`));
}
