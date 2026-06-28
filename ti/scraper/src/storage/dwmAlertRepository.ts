import { buildDwmProductSnapshot, type DwmAlert, type DwmWatchTerm } from "../product/dwmProduct.ts";
import { stableId, uniqueStrings } from "../utils.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

type DwmAlertVisibilityPolicy = "members" | "admins" | "owners";

export type RuntimeDwmWatchlist = {
  id: string;
  tenantId: string;
  organizationId?: string;
  terms: DwmWatchTerm[];
  webhookDestinationId?: string;
  webhookUrl?: string;
  status: "active" | "paused";
};

export type DwmAlertGenerationCaptureRef = {
  captureId: string;
  sourceId?: string;
  sourceFamily: string;
  contentHash?: string;
  observedAt?: string;
};

export type DwmAlertGenerationCandidate = {
  id: string;
  tenantId: string;
  organizationId?: string;
  term: DwmWatchTerm;
  normalizedTerm: string;
  watchlistIds: string[];
  watchlistItemIds: string[];
  webhookDestinationIds: string[];
  hasWebhookRoute: boolean;
  visibilityPolicy: DwmAlertVisibilityPolicy;
  sourceFamilies: string[];
  captureRefs: DwmAlertGenerationCaptureRef[];
  dedupeSeed: string;
  dedupeKeyCandidate: string;
};

export type DwmAlertGenerationPlan = {
  schemaVersion: "dwm.alert_generation_plan.v1";
  tenantId: string;
  organizationId?: string;
  visibilityPolicy: DwmAlertVisibilityPolicy;
  activeWatchlistIds: string[];
  candidateCount: number;
  candidates: DwmAlertGenerationCandidate[];
  blockedWatchlists: Array<{ watchlistId: string; reason: "missing_org_context" | "organization_mismatch"; organizationId?: string }>;
  skippedWatchlists: Array<{ watchlistId: string; reason: "paused" | "tenant_mismatch" | "empty_terms" }>;
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
  visibilityPolicy?: DwmAlertVisibilityPolicy;
};

export type RebuildDwmRuntimeAlertsResult = {
  rebuiltAt: string;
  savedAlertCount: number;
  alerts: any[];
  watchlistIds: string[];
  generationPlan: DwmAlertGenerationPlan;
  readiness: ReturnType<typeof buildDwmProductSnapshot>["readiness"];
};

export function rebuildDwmRuntimeAlerts(input: RebuildDwmRuntimeAlertsInput): RebuildDwmRuntimeAlertsResult {
  const sources = input.store.listSources();
  const captures = input.store.listCaptures();
  const generationPlan = buildDwmAlertGenerationPlan({
    watchlists: input.store.listDwmWatchlists(),
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    visibilityPolicy: input.visibilityPolicy,
    sources,
    captures
  });
  const terms = generationPlan.candidates.map((candidate) => candidate.term);
  const snapshot = buildDwmProductSnapshot({
    tenantId: input.tenantId,
    watchlist: terms,
    sources,
    captures,
    includeDemoIfEmpty: false
  });

  const alerts = snapshot.alerts.map((alert) => {
    const generationCandidate = findGenerationCandidate(generationPlan, alert);
    const existing = findExistingAlert(input.store, alert);
    const alertId = existing?.id ?? alert.id;
    const workflowContext = buildDwmAlertWorkflowContext({
      alert: { ...alert, id: alertId },
      tenantId: input.tenantId,
      organizationId: input.organizationId ?? existing?.organizationId,
      generationCandidate
    });
    return input.store.saveDwmAlert({
      ...alert,
      id: alertId,
      tenantId: input.tenantId,
      organizationId: input.organizationId ?? existing?.organizationId,
      watchlistIds: workflowContext.watchlistIds,
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
    watchlistIds: generationPlan.activeWatchlistIds,
    generationPlan,
    readiness: snapshot.readiness
  };
}

export function buildDwmAlertGenerationPlan(input: {
  watchlists: RuntimeDwmWatchlist[];
  tenantId: string;
  organizationId?: string;
  visibilityPolicy?: DwmAlertVisibilityPolicy;
  sources?: SourceRecord[];
  captures?: RawCapture[];
}): DwmAlertGenerationPlan {
  const visibilityPolicy = normalizeVisibilityPolicy(input.visibilityPolicy);
  const sources = input.sources ?? [];
  const captures = input.captures ?? [];
  const candidates = new Map<string, DwmAlertGenerationCandidate>();
  const blockedWatchlists: DwmAlertGenerationPlan["blockedWatchlists"] = [];
  const skippedWatchlists: DwmAlertGenerationPlan["skippedWatchlists"] = [];
  const activeWatchlistIds: string[] = [];

  for (const watchlist of input.watchlists) {
    if (watchlist.tenantId !== input.tenantId) {
      skippedWatchlists.push({ watchlistId: watchlist.id, reason: "tenant_mismatch" });
      continue;
    }
    if (watchlist.status !== "active") {
      skippedWatchlists.push({ watchlistId: watchlist.id, reason: "paused" });
      continue;
    }
    if (watchlist.organizationId && !input.organizationId) {
      blockedWatchlists.push({ watchlistId: watchlist.id, reason: "missing_org_context", organizationId: watchlist.organizationId });
      continue;
    }
    if (watchlist.organizationId && input.organizationId && watchlist.organizationId !== input.organizationId) {
      blockedWatchlists.push({ watchlistId: watchlist.id, reason: "organization_mismatch", organizationId: watchlist.organizationId });
      continue;
    }
    if (!watchlist.terms.length) {
      skippedWatchlists.push({ watchlistId: watchlist.id, reason: "empty_terms" });
      continue;
    }

    activeWatchlistIds.push(watchlist.id);
    for (const term of watchlist.terms) {
      const normalizedTerm = normalizeTerm(term.value);
      if (!normalizedTerm) continue;
      const key = `${input.tenantId}:${input.organizationId ?? ""}:${term.kind}:${normalizedTerm}`;
      const existing = candidates.get(key);
      const captureRefs = captureRefsForTerm({ term, sources, captures });
      const sourceFamilies = uniqueStrings(captureRefs.map((ref) => ref.sourceFamily));
      if (existing) {
        existing.watchlistIds = uniqueStrings([...existing.watchlistIds, watchlist.id]);
        existing.watchlistItemIds = uniqueStrings([...existing.watchlistItemIds, ...watchlistItemIdsFor(watchlist, term.value)]);
        existing.webhookDestinationIds = uniqueStrings([...existing.webhookDestinationIds, watchlist.webhookDestinationId].filter(Boolean) as string[]);
        existing.hasWebhookRoute = existing.hasWebhookRoute || Boolean(watchlist.webhookDestinationId || watchlist.webhookUrl);
        existing.captureRefs = mergeCaptureRefs(existing.captureRefs, captureRefs);
        existing.sourceFamilies = uniqueStrings([...existing.sourceFamilies, ...sourceFamilies]);
        continue;
      }

      const dedupeSeed = `${normalizedTerm}:${term.kind}`;
      candidates.set(key, {
        id: stableId("dwm_alert_generation_candidate", `${input.tenantId}:${input.organizationId ?? ""}:${dedupeSeed}`),
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        term,
        normalizedTerm,
        watchlistIds: [watchlist.id],
        watchlistItemIds: watchlistItemIdsFor(watchlist, term.value),
        webhookDestinationIds: [watchlist.webhookDestinationId].filter(Boolean) as string[],
        hasWebhookRoute: Boolean(watchlist.webhookDestinationId || watchlist.webhookUrl),
        visibilityPolicy,
        sourceFamilies,
        captureRefs,
        dedupeSeed,
        dedupeKeyCandidate: stableId("dwm_dedupe_candidate", `${input.tenantId}:${input.organizationId ?? ""}:${dedupeSeed}`)
      });
    }
  }

  return {
    schemaVersion: "dwm.alert_generation_plan.v1",
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    visibilityPolicy,
    activeWatchlistIds: uniqueStrings(activeWatchlistIds),
    candidateCount: candidates.size,
    candidates: [...candidates.values()],
    blockedWatchlists,
    skippedWatchlists
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
  watchlists?: RuntimeDwmWatchlist[];
  generationCandidate?: DwmAlertGenerationCandidate;
}) {
  const captureIds = input.alert.provenance?.captureIds ?? (input.alert.evidence ?? []).map((item) => item.provenance?.captureId ?? item.id);
  const watchlists = input.watchlists ?? [];
  const watchlistIds = input.generationCandidate?.watchlistIds ?? watchlists.map((watchlist) => watchlist.id);
  const watchlistItemIds = input.generationCandidate?.watchlistItemIds ?? watchlists.flatMap((watchlist) => watchlistItemIdsFor(watchlist, input.alert.matchedTerm?.value));
  const dedupeKey = String(input.alert.dedupeKey ?? input.alert.webhookDelivery?.dedupeKey);
  const caseIdCandidate = stableId("case", `${input.tenantId}:${input.alert.id}`);
  return {
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    visibilityPolicy: input.generationCandidate?.visibilityPolicy,
    generationCandidateId: input.generationCandidate?.id,
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
    webhookDestinationIds: input.generationCandidate?.webhookDestinationIds ?? watchlists.map((watchlist) => watchlist.webhookDestinationId).filter(Boolean),
    hasWebhookRoute: input.generationCandidate?.hasWebhookRoute ?? watchlists.some((watchlist) => Boolean(watchlist.webhookDestinationId || watchlist.webhookUrl))
  };
}

export function buildDwmAlertWebhookContext(alert: DwmAlert, workflowContext: ReturnType<typeof buildDwmAlertWorkflowContext>) {
  return {
    eventType: alert.eventType,
    alertId: alert.id,
    tenantId: workflowContext.tenantId,
    organizationId: workflowContext.organizationId,
    visibilityPolicy: workflowContext.visibilityPolicy,
    generationCandidateId: workflowContext.generationCandidateId,
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

function findGenerationCandidate(plan: DwmAlertGenerationPlan, alert: DwmAlert): DwmAlertGenerationCandidate | undefined {
  const normalizedTerm = normalizeTerm(alert.matchedTerm?.value);
  return plan.candidates.find((candidate) => candidate.normalizedTerm === normalizedTerm && candidate.term.kind === alert.matchedTerm?.kind)
    ?? plan.candidates.find((candidate) => candidate.normalizedTerm === normalizedTerm);
}

function watchlistItemIdsFor(watchlist: RuntimeDwmWatchlist, matchedTerm: string | undefined): string[] {
  if (!matchedTerm) return [];
  return watchlist.terms
    .filter((term) => term.value.toLowerCase() === matchedTerm.toLowerCase())
    .map((term) => String((term as any).id ?? `${watchlist.id}:${term.value}`));
}

function captureRefsForTerm(input: { term: DwmWatchTerm; sources: SourceRecord[]; captures: RawCapture[] }): DwmAlertGenerationCaptureRef[] {
  return input.captures
    .filter((capture) => captureText(capture).includes(normalizeTerm(input.term.value)))
    .map((capture) => {
      const source = input.sources.find((row) => row.id === capture.sourceId);
      return {
        captureId: capture.id,
        sourceId: capture.sourceId,
        sourceFamily: sourceFamilyFor(source, capture),
        contentHash: capture.contentHash,
        observedAt: capture.collectedAt
      };
    });
}

function mergeCaptureRefs(existing: DwmAlertGenerationCaptureRef[], next: DwmAlertGenerationCaptureRef[]): DwmAlertGenerationCaptureRef[] {
  const byId = new Map(existing.map((ref) => [ref.captureId, ref]));
  for (const ref of next) byId.set(ref.captureId, byId.get(ref.captureId) ?? ref);
  return [...byId.values()];
}

function captureText(capture: RawCapture): string {
  return [
    (capture as any).body,
    (capture as any).text,
    JSON.stringify((capture as any).metadata ?? {})
  ].map((value) => String(value ?? "").toLowerCase()).join("\n");
}

function sourceFamilyFor(source: SourceRecord | undefined, capture: RawCapture): string {
  const value = String((capture as any).metadata?.adapter ?? source?.type ?? "").toLowerCase();
  if (value.includes("telegram")) return "telegram_public";
  if (value.includes("darknet") || value.includes("darkweb") || value.includes("tor")) return "darkweb_metadata";
  if (value.includes("advisory")) return "public_advisory";
  if (value.includes("actor")) return "actor_page";
  if (value.includes("clear")) return "clear_web";
  return "unknown";
}

function normalizeTerm(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeVisibilityPolicy(value: unknown): DwmAlertVisibilityPolicy {
  return value === "admins" || value === "owners" ? value : "members";
}
