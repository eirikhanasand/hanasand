import { buildDwmProductSnapshot, type DwmAlert, type DwmWatchTerm } from "../product/dwmProduct.ts";
import { stableId, uniqueStrings } from "../utils.ts";
import type { RawCapture, SourceRecord } from "../types.ts";
import type { RuntimeOrgMembershipContext, RuntimeOrgWatchlistTermContext } from "./dwmOrgWatchlistBridge.ts";

type DwmAlertVisibilityPolicy = "members" | "admins" | "owners";

export type RuntimeDwmWatchlist = {
  id: string;
  tenantId: string;
  organizationId?: string;
  terms: DwmWatchTerm[];
  webhookDestinationId?: string;
  webhookUrl?: string;
  status: "active" | "paused";
  orgWatchlistTerms?: RuntimeOrgWatchlistTermContext[];
  orgMembershipContext?: RuntimeOrgMembershipContext;
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
  membershipContext?: RuntimeOrgMembershipContext;
  sourceFamilies: string[];
  captureRefs: DwmAlertGenerationCaptureRef[];
  watchlistTermContexts: RuntimeOrgWatchlistTermContext[];
  alertGeneratorKeys: string[];
  alertGenerationRefs: RuntimeOrgWatchlistTermContext["alertGenerationRef"][];
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

export type DwmAlertGenerationReadiness = {
  schemaVersion: "dwm.alert_generation_readiness.v1";
  tenantId: string;
  organizationId?: string;
  visibilityPolicy: DwmAlertVisibilityPolicy;
  readyForRebuild: boolean;
  readyForCustomerDelivery: boolean;
  counts: {
    activeWatchlists: number;
    skippedWatchlists: number;
    blockedWatchlists: number;
    candidateCount: number;
    rawActiveTermCount: number;
    duplicateCollapseCount: number;
    captureRefCount: number;
    matchedCandidateCount: number;
    unmatchedCandidateCount: number;
  };
  sourceFamilyCoverage: Array<{ sourceFamily: string; candidateCount: number; captureRefCount: number; watchlistIds: string[] }>;
  webhookReadiness: {
    ready: boolean;
    routedCandidateCount: number;
    missingRouteCandidateCount: number;
    webhookDestinationIds: string[];
    candidateIdsMissingRoute: string[];
  };
  caseReadiness: {
    ready: boolean;
    candidateCount: number;
    casePathTemplate: "/v1/cases/:caseId?alertId=:alertId&dedupeKey=:dedupeKey";
  };
  productDedupeBlocker: {
    blocked: boolean;
    reason: string;
    requiredPatch: string;
    requiredFields: string[];
  };
  blockers: string[];
  plan: DwmAlertGenerationPlan;
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
    const generatedWorkflowContext = buildDwmAlertWorkflowContext({
      alert: { ...alert, id: alertId },
      tenantId: input.tenantId,
      organizationId: input.organizationId ?? existing?.organizationId,
      generationCandidate
    });
    const workflowContext = {
      ...generatedWorkflowContext,
      caseId: existing?.caseId,
      casePath: existing?.casePath ?? generatedWorkflowContext.casePath
    };
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
      casePath: existing?.casePath ?? workflowContext.casePath,
      workflowStatus: existing?.workflowStatus ?? (alert as any).workflowStatus ?? "new",
      reviewState: existing?.reviewState ?? alert.reviewState,
      deliveryState: existing?.deliveryState ?? "pending_review",
      workflowEvents: existing?.workflowEvents ?? [],
      workflowNote: existing?.workflowNote,
      workflowRationale: existing?.workflowRationale,
      assignedOwner: existing?.assignedOwner,
      severityOverride: existing?.severityOverride,
      suppressedAt: existing?.suppressedAt,
      closedAt: existing?.closedAt,
      reopenedAt: existing?.reopenedAt,
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
      const watchlistTermContexts = watchlistTermContextsFor(watchlist, term.value);
      if (existing) {
        existing.watchlistIds = uniqueStrings([...existing.watchlistIds, watchlist.id]);
        existing.watchlistItemIds = uniqueStrings([...existing.watchlistItemIds, ...watchlistItemIdsFor(watchlist, term.value)]);
        existing.webhookDestinationIds = uniqueStrings([...existing.webhookDestinationIds, watchlist.webhookDestinationId].filter(Boolean) as string[]);
        existing.hasWebhookRoute = existing.hasWebhookRoute || Boolean(watchlist.webhookDestinationId || watchlist.webhookUrl);
        existing.captureRefs = mergeCaptureRefs(existing.captureRefs, captureRefs);
        existing.sourceFamilies = uniqueStrings([...existing.sourceFamilies, ...sourceFamilies]);
        existing.watchlistTermContexts = mergeWatchlistTermContexts(existing.watchlistTermContexts, watchlistTermContexts);
        existing.alertGeneratorKeys = uniqueStrings([...existing.alertGeneratorKeys, ...watchlistTermContexts.map((term) => term.alertGeneratorKey)]);
        existing.alertGenerationRefs = mergeAlertGenerationRefs(existing.alertGenerationRefs, watchlistTermContexts.map((term) => term.alertGenerationRef));
        existing.membershipContext = existing.membershipContext ?? watchlist.orgMembershipContext;
        continue;
      }

      const dedupeSeed = watchlistTermContexts[0]?.alertGeneratorKey ?? `${normalizedTerm}:${term.kind}`;
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
        membershipContext: watchlist.orgMembershipContext,
        sourceFamilies,
        captureRefs,
        watchlistTermContexts,
        alertGeneratorKeys: uniqueStrings(watchlistTermContexts.map((term) => term.alertGeneratorKey)),
        alertGenerationRefs: mergeAlertGenerationRefs([], watchlistTermContexts.map((term) => term.alertGenerationRef)),
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

export function buildDwmAlertGenerationReadiness(input: {
  watchlists: RuntimeDwmWatchlist[];
  tenantId: string;
  organizationId?: string;
  visibilityPolicy?: DwmAlertVisibilityPolicy;
  sources?: SourceRecord[];
  captures?: RawCapture[];
  productDedupePatched?: boolean;
}): DwmAlertGenerationReadiness {
  const plan = buildDwmAlertGenerationPlan(input);
  const rawActiveTermCount = input.watchlists
    .filter((watchlist) => watchlist.tenantId === input.tenantId && watchlist.status === "active" && (!watchlist.organizationId || watchlist.organizationId === input.organizationId))
    .reduce((count, watchlist) => count + watchlist.terms.length, 0);
  const captureRefCount = plan.candidates.reduce((count, candidate) => count + candidate.captureRefs.length, 0);
  const sourceFamilyCoverage = buildSourceFamilyCoverage(plan.candidates);
  const candidateIdsMissingRoute = plan.candidates.filter((candidate) => !candidate.hasWebhookRoute).map((candidate) => candidate.id);
  const productDedupePatched = input.productDedupePatched !== false;
  const blockers = [
    plan.blockedWatchlists.length ? "Resolve blocked watchlists before rebuild so org-scoped terms cannot leak into tenant-wide alerts." : undefined,
    plan.candidateCount === 0 ? "No active watchlist candidates are ready for alert generation." : undefined,
    captureRefCount === 0 ? "No collected captures currently match active watchlist terms." : undefined,
    !productDedupePatched ? "Product alert dedupe/enrichment patch is still pending in dirty dwmProduct.ts." : undefined
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "dwm.alert_generation_readiness.v1",
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    visibilityPolicy: plan.visibilityPolicy,
    readyForRebuild: plan.candidateCount > 0 && plan.blockedWatchlists.length === 0,
    readyForCustomerDelivery: plan.candidateCount > 0 && plan.blockedWatchlists.length === 0 && captureRefCount > 0 && candidateIdsMissingRoute.length === 0 && productDedupePatched,
    counts: {
      activeWatchlists: plan.activeWatchlistIds.length,
      skippedWatchlists: plan.skippedWatchlists.length,
      blockedWatchlists: plan.blockedWatchlists.length,
      candidateCount: plan.candidateCount,
      rawActiveTermCount,
      duplicateCollapseCount: Math.max(0, rawActiveTermCount - plan.candidateCount),
      captureRefCount,
      matchedCandidateCount: plan.candidates.filter((candidate) => candidate.captureRefs.length > 0).length,
      unmatchedCandidateCount: plan.candidates.filter((candidate) => candidate.captureRefs.length === 0).length
    },
    sourceFamilyCoverage,
    webhookReadiness: {
      ready: plan.candidateCount > 0 && candidateIdsMissingRoute.length === 0,
      routedCandidateCount: plan.candidates.filter((candidate) => candidate.hasWebhookRoute).length,
      missingRouteCandidateCount: candidateIdsMissingRoute.length,
      webhookDestinationIds: uniqueStrings(plan.candidates.flatMap((candidate) => candidate.webhookDestinationIds)),
      candidateIdsMissingRoute
    },
    caseReadiness: {
      ready: plan.candidateCount > 0 && plan.blockedWatchlists.length === 0,
      candidateCount: plan.candidateCount,
      casePathTemplate: "/v1/cases/:caseId?alertId=:alertId&dedupeKey=:dedupeKey"
    },
    productDedupeBlocker: {
      blocked: !productDedupePatched,
      reason: productDedupePatched
        ? "Product dedupe/enrichment contract is available for persisted org alerts."
        : "Repository readiness can safely plan org alert inputs, but dirty dwmProduct.ts still owns final alert dedupe/enrichment behavior.",
      requiredPatch: "Remove actor from product alert dedupe seed, dedupe merged alerts by alert.dedupeKey, and refresh evidenceSummary/webhook payload hash after merges.",
      requiredFields: ["matchContext", "evidenceSummary", "routingContext", "confidenceReasoning", "provenance", "dedupeKey", "recommendedRoute", "webhookDelivery"]
    },
    blockers,
    plan
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
    workflow_status: String(alert.workflowStatus ?? "new"),
    workflow_rationale: alert.workflowRationale ? String(alert.workflowRationale) : null,
    assigned_owner: alert.assignedOwner ? String(alert.assignedOwner) : null,
    severity_override: alert.severityOverride ? String(alert.severityOverride) : null,
    workflow_events: alert.workflowEvents ?? [],
    suppressed_at: alert.suppressedAt ? String(alert.suppressedAt) : null,
    closed_at: alert.closedAt ? String(alert.closedAt) : null,
    reopened_at: alert.reopenedAt ? String(alert.reopenedAt) : null,
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
    membershipContext: input.generationCandidate?.membershipContext,
    generationCandidateId: input.generationCandidate?.id,
    caseIdCandidate,
    watchlistIds,
    watchlistItemIds,
    watchlistTermContexts: input.generationCandidate?.watchlistTermContexts ?? [],
    alertGenerationRefs: input.generationCandidate?.alertGenerationRefs ?? [],
    alertGeneratorKeys: input.generationCandidate?.alertGeneratorKeys ?? [],
    matchedTermCategory: input.generationCandidate?.watchlistTermContexts?.find((term) => term.normalizedTerm === input.alert.matchedTerm?.value?.toLowerCase() || term.value.toLowerCase() === input.alert.matchedTerm?.value?.toLowerCase())?.category,
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
    membershipContext: workflowContext.membershipContext,
    generationCandidateId: workflowContext.generationCandidateId,
    watchlistIds: workflowContext.watchlistIds,
    watchlistItemIds: workflowContext.watchlistItemIds,
    watchlistTermContexts: workflowContext.watchlistTermContexts,
    alertGenerationRefs: workflowContext.alertGenerationRefs,
    alertGeneratorKeys: workflowContext.alertGeneratorKeys,
    matchedTermCategory: workflowContext.matchedTermCategory,
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

function watchlistTermContextsFor(watchlist: RuntimeDwmWatchlist, matchedTerm: string | undefined): RuntimeOrgWatchlistTermContext[] {
  if (!matchedTerm) return [];
  const normalized = matchedTerm.toLowerCase();
  return (watchlist.orgWatchlistTerms ?? [])
    .filter((term) => term.normalizedTerm === normalized || term.value.toLowerCase() === normalized || term.terms.some((value) => value.toLowerCase() === normalized));
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

function mergeWatchlistTermContexts(existing: RuntimeOrgWatchlistTermContext[], next: RuntimeOrgWatchlistTermContext[]): RuntimeOrgWatchlistTermContext[] {
  const byId = new Map(existing.map((term) => [term.watchlistItemId, term]));
  for (const term of next) byId.set(term.watchlistItemId, byId.get(term.watchlistItemId) ?? term);
  return [...byId.values()];
}

function mergeAlertGenerationRefs(existing: RuntimeOrgWatchlistTermContext["alertGenerationRef"][], next: RuntimeOrgWatchlistTermContext["alertGenerationRef"][]): RuntimeOrgWatchlistTermContext["alertGenerationRef"][] {
  const byKey = new Map(existing.map((ref) => [ref.dedupe.key, ref]));
  for (const ref of next) byKey.set(ref.dedupe.key, byKey.get(ref.dedupe.key) ?? ref);
  return [...byKey.values()];
}

function buildSourceFamilyCoverage(candidates: DwmAlertGenerationCandidate[]): DwmAlertGenerationReadiness["sourceFamilyCoverage"] {
  const families = new Map<string, { sourceFamily: string; candidateIds: Set<string>; captureRefCount: number; watchlistIds: Set<string> }>();
  for (const candidate of candidates) {
    const candidateFamilies = candidate.sourceFamilies.length ? candidate.sourceFamilies : ["unknown"];
    for (const family of candidateFamilies) {
      const row = families.get(family) ?? { sourceFamily: family, candidateIds: new Set<string>(), captureRefCount: 0, watchlistIds: new Set<string>() };
      row.candidateIds.add(candidate.id);
      row.captureRefCount += candidate.captureRefs.filter((ref) => ref.sourceFamily === family).length;
      for (const watchlistId of candidate.watchlistIds) row.watchlistIds.add(watchlistId);
      families.set(family, row);
    }
  }
  return [...families.values()]
    .map((row) => ({
      sourceFamily: row.sourceFamily,
      candidateCount: row.candidateIds.size,
      captureRefCount: row.captureRefCount,
      watchlistIds: [...row.watchlistIds]
    }))
    .sort((a, b) => a.sourceFamily.localeCompare(b.sourceFamily));
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
