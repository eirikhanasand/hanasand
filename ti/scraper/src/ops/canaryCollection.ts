// @ts-nocheck
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { saveExposureClaimFromCollectedItem } from "../api/exposureQueueRoutes.ts";
import { nowIso, stableId } from "../utils.ts";
import { activatePublicCanarySources, pausePublicCanarySources, reconcilePublicSourceProductivity } from "./canaryActivation.ts";
import { canaryQueries, PUBLIC_CANARY_SOURCE_PORTFOLIO } from "./canaryPortfolio.ts";
import { detachedState, externalize, fetchItems, health, maxItemsFor, tasksForSource } from "./canaryHelpers.ts";
import { isSellableIntelText, sellableReason } from "../value/sellableIntel.ts";
import { sourceCollectionLane } from "../policy/collectionPolicy.ts";
import { buildRawCapture } from "../pipeline/pipelineCapture.ts";
import { activeWatchlistDiscoveryTerms, collectWatchlistDiscoveryEvidence, scheduleWatchlistDiscoveryRuns } from "./watchlistDiscovery.ts";
export { activatePublicCanarySources, pausePublicCanarySources } from "./canaryActivation.ts"; export { PUBLIC_CANARY_SOURCE_PORTFOLIO } from "./canaryPortfolio.ts";
export { buildCanaryOperatorConsoleHtml, buildCanaryOperatorSummary, buildCanaryReadinessPacket, buildCanarySoakReport } from "./canaryReports.ts";
export type * from "./canaryCollectionTypes.ts";
import type { CanaryCollectionCycleResult, CanaryCollectionLoopHandle, CanaryCollectionOptions } from "./canaryCollectionTypes.ts";
export async function runCanaryCollectionCycle(options: CanaryCollectionOptions): Promise<CanaryCollectionCycleResult> {
  if (options.store.batch && !options.batched) return options.store.batch(() => runCanaryCollectionCycle({ ...options, batched: true }));
  const generatedAt = options.now?.() ?? nowIso(), fetcher = options.fetch ?? fetch, mode = options.fetch ? "injected_proof_fetch" : "native_live_http";
  const productivity = reconcilePublicSourceProductivity({ ...options, now: generatedAt });
  const activation = options.activateSources ? activatePublicCanarySources({ ...options, now: generatedAt }) : { activated: [], alreadyActive: [], rejected: [] };
  const maxSources = Math.max(1, options.maxSources ?? 10), maxTasks = Math.max(1, options.maxTasks ?? 5), maxBytes = Math.max(1024, options.maxBytes ?? 512_000);
  const selectedSourceIds = new Set(options.sourceIds ?? []);
  const due = options.store.listSources()
    .filter((s: any) => inCollectionScope(s, options.tenantId) && (!selectedSourceIds.size || selectedSourceIds.has(s.id)) && isProductionCollectionSource(s, generatedAt))
    .sort((left: any, right: any) => sourceScheduleTime(left) - sourceScheduleTime(right) || String(left.id).localeCompare(String(right.id)))
    .slice(0, maxSources);
  const planId = stableId("canary-plan", `${options.tenantId ?? "global"}:${generatedAt}`), runId = stableId("canary-run", planId);
  const queueLimit = Math.max(1, Number(options.queueLimit ?? 500));
  const availableQueueSlots = Math.max(0, queueLimit - Number(options.frontier.size?.() ?? options.frontier.snapshot?.().length ?? 0));
  const tasks = due.flatMap((s: any) => tasksForSource(s, generatedAt, runId, maxBytes)).slice(0, Math.min(maxTasks, availableQueueSlots));
  const scheduledSourceIds = new Set(tasks.map((task: any) => task.sourceId));
  const backpressureState = availableQueueSlots >= maxTasks ? "accepting" : "throttled";
  options.store.savePlan?.({ id: planId, tenantId: options.tenantId, requestId: "req_public_canary", createdAt: generatedAt, tasks, request: { query: canaryQueries }, reviewRequired: [], rejected: activation.rejected, audit: [] });
  options.store.saveRun?.({ id: runId, tenantId: options.tenantId, planId, requestId: "req_public_canary", status: "running", createdAt: generatedAt, startedAt: generatedAt, updatedAt: generatedAt, taskCount: tasks.length, reviewTaskCount: 0, rejectedSourceCount: activation.rejected.length, captureCount: 0, incidentCount: 0 });
  for (const task of tasks) options.frontier.enqueueTask(task);
  const counters: any = { leasedTaskCount: 0, completedTaskCount: 0, failedTaskCount: 0, insertedCaptureCount: 0, duplicateCaptureCount: 0, incidentCount: 0, exposureClaimCount: 0, skippedLowValueCount: 0, retryScheduledCount: 0, retryExhaustedCount: 0 };
  const latestCaptureIds: string[] = [], errors: any[] = [];
  const concurrency = Math.max(1, Math.min(tasks.length || 1, Number(options.maxConcurrentTasks ?? 5)));
  for (let done = 0; done < tasks.length; done += concurrency) await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length - done) }, () => runLeasedTask(options, runId, generatedAt, fetcher, mode, maxBytes, counters, latestCaptureIds, errors)));
  const runStatus = counters.failedTaskCount && counters.completedTaskCount ? "degraded" : counters.failedTaskCount ? "failed" : "completed";
  const completedAt = options.now?.() ?? nowIso();
  options.store.saveRun?.({ id: runId, tenantId: options.tenantId, planId, requestId: "req_public_canary", status: runStatus, createdAt: generatedAt, startedAt: generatedAt, completedAt, updatedAt: completedAt, taskCount: tasks.length, sourceCount: scheduledSourceIds.size, captureCount: counters.insertedCaptureCount, incidentCount: counters.incidentCount, exposureClaimCount: counters.exposureClaimCount, skippedLowValueCount: counters.skippedLowValueCount, duplicateCaptureCount: counters.duplicateCaptureCount, failedTaskCount: counters.failedTaskCount, completedTaskCount: counters.completedTaskCount, retryScheduledCount: counters.retryScheduledCount, retryExhaustedCount: counters.retryExhaustedCount, error: errors[0]?.message });
  return { generatedAt, tenantId: options.tenantId, mode: "production_canary", runId, planId, activationApplied: Boolean(options.activateSources), activatedSourceCount: activation.activated.length + activation.alreadyActive.length, retiredSourceCount: productivity.retired.length, activeSourceCount: scheduledSourceIds.size, deferredDueSourceCount: due.length - scheduledSourceIds.size, queuedTaskCount: tasks.length, queueLimit, availableQueueSlots, backpressureState, ...counters, remainingQueuedTaskCount: options.frontier.snapshot().filter((i: any) => i.task.runId === runId).length, latestCaptureIds, errors, health: health(options.store, generatedAt, counters) };
}
export function startCanaryCollectionLoop(options: CanaryCollectionOptions & { enabled?: boolean; intervalSeconds?: number; queueLimit?: number; onCycle?: (r: any) => void; onError?: (e: unknown) => void }): CanaryCollectionLoopHandle {
  const state = detachedState(options.now?.() ?? nowIso(), options.queueLimit ?? 500), intervalMs = Math.max(5, options.intervalSeconds ?? 300) * 1000; let timer: Timer | undefined, startupTimer: Timer | undefined, active: Promise<void> | undefined;
  const cycle = () => {
    if (!state.enabled || active) return active ?? Promise.resolve();
    state.running = true; state.lastCycleAt = nowIso();
    active = (async () => {
      try { const watchlistDiscovery = await scheduleWatchlistDiscoveryRuns(options, options.now?.() ?? nowIso()); const result = await runCanaryCollectionCycle(options); result.watchlistDiscovery = watchlistDiscovery; state.latestResult = result; state.successCount++; state.lastSuccessAt = result.generatedAt; options.onCycle?.(result); }
      catch (e) { state.errorCount++; state.consecutiveErrorCount++; state.lastError = e instanceof Error ? e.message : String(e); state.lastErrorAt = nowIso(); options.onError?.(e); }
      finally { state.running = false; state.cycleCount++; state.nextCycleAt = state.enabled ? new Date(Date.now() + intervalMs).toISOString() : undefined; active = undefined; }
    })();
    return active;
  };
  Object.assign(state, { supervisorAttached: true, enabled: options.enabled !== false, intervalSeconds: options.intervalSeconds ?? 300, maxSources: options.maxSources ?? 10, maxTasks: options.maxTasks ?? 5, maxConcurrentTasks: options.maxConcurrentTasks ?? 5, maxItemsPerTask: options.maxItemsPerTask ?? 40, maxBytes: options.maxBytes ?? 512_000, timeoutMs: options.timeoutMs ?? 30_000, queueLimit: options.queueLimit ?? 500, activateSources: Boolean(options.activateSources) });
  if (state.enabled) {
    state.nextCycleAt = new Date(Date.now() + 1_000).toISOString();
    startupTimer = setTimeout(cycle, 1_000);
  }
  timer = setInterval(cycle, intervalMs);
  return {
    stop: async () => { if (startupTimer) clearTimeout(startupTimer); if (timer) clearInterval(timer); state.enabled = false; state.nextCycleAt = undefined; await active; },
    getState: () => ({ ...state }),
    setEnabled: (enabled: boolean, metadata: any = {}) => {
      state.enabled = Boolean(enabled);
      state.updatedAt = nowIso();
      state.updatedBy = metadata.approvedBy ?? metadata.operatorId ?? "operator";
      state.pausedReason = enabled ? undefined : metadata.reason ?? "Paused by operator.";
      state.nextCycleAt = enabled ? new Date(Date.now() + intervalMs).toISOString() : undefined;
      return { ...state };
    },
    runOnce: () => cycle()
  };
}
export async function runLeasedTask(options: any, runId: string, generatedAt: string, fetcher: any, mode: string, maxBytes: number, counters: any, latestCaptureIds: string[], errors: any[]) {
  const leased = options.frontier.next(new Date(generatedAt), (task: any) => task.runId === runId); if (!leased) return;
  const task = leased.task, source = options.store.getSource?.(task.sourceId), startedMs = Date.now(); counters.leasedTaskCount++;
  const taskMetrics: any = { itemCount: 0, captureCount: 0, incidentCount: 0, duplicateCount: 0, parserWarningCount: 0, actorIds: new Set<string>(), publishedAt: [], productivePublishedAt: [] };
  try {
    if (!source) throw new Error("source missing");
    if (task.planning?.watchlistDiscovery) {
      const activeTerms = activeWatchlistDiscoveryTerms(options.store, task);
      if (!activeTerms.length) { counters.completedTaskCount++; options.frontier.complete(task); return; }
      task.planning.watchlistDiscovery = { ...task.planning.watchlistDiscovery, terms: activeTerms };
    }
    const discoveredItems = await fetchItems(source, task, fetcher, mode, generatedAt, maxBytes, options.timeoutMs ?? 12_000, itemLimit(source, options, task));
    const collectedItems = task.planning?.watchlistDiscovery
      ? await collectWatchlistDiscoveryEvidence({ store: options.store, source, task, discoveryItems: discoveredItems, fetcher, generatedAt, timeoutMs: options.timeoutMs ?? 12_000, maxBytes: Math.max(maxBytes, 2_000_000), nativeFetch: mode === "native_live_http" })
      : discoveredItems;
    taskMetrics.itemCount = collectedItems.length;
    taskMetrics.httpStatus = collectedItems[0]?.metadata?.fetchProvenance?.httpStatus;
    taskMetrics.parserWarningCount = collectedItems.reduce((total: number, item: any) => total + (Array.isArray(item.metadata?.parserWarnings) ? item.metadata.parserWarnings.length : 0), 0);
    taskMetrics.publishedAt = collectedItems.map((item: any) => item.publishedAt).filter(Boolean);
    const sellableItems = task.planning?.watchlistDiscovery ? collectedItems : collectedItems.filter((collected: any) => ["cisa_kev", "ransomware_group_metadata", "mitre_actor_catalog", "ransomware_operation_catalog", "ransomware_operation_activity_evidence"].includes(collected.metadata?.extractionProfile) || isSellableIntelText({ text: collected.rawText, title: collected.title, sourceId: collected.sourceId, publishedAt: collected.publishedAt, collectedAt: collected.collectedAt, now: generatedAt, maxAgeDays: activityWindowDays(source) }));
    counters.skippedLowValueCount += collectedItems.length - sellableItems.length;
    for (const collected of sellableItems.slice(0, itemLimit(source, options, task))) {
      collected.tenantId = task.tenantId ?? collected.tenantId ?? source.tenantId;
      collected.organizationId = task.planning?.watchlistDiscovery?.organizationId ?? collected.organizationId;
      collected.metadata = { ...collected.metadata, runId, queryTerms: task.planning?.watchlistDiscovery ? (collected.metadata?.matchedWatchlistTerms ?? []).map((term: any) => term.value) : task.planning?.queryTerms ?? [], sellableCandidate: true, sellableReason: sellableReason(collected.rawText) };
      const actorIdentityCatalogSnapshot = collected.metadata?.actorIdentityCatalogSnapshot ?? collected.metadata?.ransomwareOperationCatalogSnapshot;
      const catalogEvidenceOnly = collected.metadata?.catalogEvidenceOnly === true;
      const { actorIdentityCatalogSnapshot: _mitreSnapshot, ransomwareOperationCatalogSnapshot: _ransomwareSnapshot, ...captureMetadata } = collected.metadata ?? {};
      let pipeline = actorIdentityCatalogSnapshot || catalogEvidenceOnly
        ? { capture: buildRawCapture({ ...collected, metadata: captureMetadata }), entities: [], indicators: [] }
        : processCollectedItem(collected, { actorIdentities: options.store.listActorIdentities?.() ?? [] });
      if (pipeline.capture.body && options.objectStore) pipeline = { ...pipeline, capture: externalize(pipeline.capture, options.objectStore) };
      const duplicate = options.store.findDuplicateCapture?.(pipeline.capture), saved = options.store.savePipelineResult(pipeline);
      if (actorIdentityCatalogSnapshot) {
        if (typeof options.store.replaceActorIdentityCatalog !== "function") throw new Error("Actor identity catalog persistence is unavailable.");
        const evidenceCaptureIds = options.store.listCaptures().filter((capture: any) => actorIdentityCatalogSnapshot.evidenceContentHashes?.includes(capture.contentHash)).map((capture: any) => capture.id);
        options.store.replaceActorIdentityCatalog({ ...actorIdentityCatalogSnapshot, ...(evidenceCaptureIds.length ? { evidenceCaptureIds } : {}) }, { sourceId: source.id, captureId: saved.capture.id, importedAt: generatedAt });
      }
      if (duplicate) { counters.duplicateCaptureCount++; taskMetrics.duplicateCount++; } else {
        counters.insertedCaptureCount++;
        taskMetrics.captureCount++;
        if (collected.publishedAt) taskMetrics.productivePublishedAt.push(collected.publishedAt);
      }
      if (saved.incident) { counters.incidentCount++; taskMetrics.incidentCount++; }
      if (task.planning?.watchlistDiscovery && collected.sourceId !== source.id) recordWatchlistEvidenceHealth(options.store, collected, task, runId, generatedAt, Boolean(duplicate), Boolean(saved.incident));
      for (const entity of pipeline.entities ?? []) if (["actor", "ransomware_family"].includes(entity.type)) taskMetrics.actorIds.add(String(entity.normalizedValue ?? entity.value));
      if (!task.planning?.watchlistDiscovery && !actorIdentityCatalogSnapshot && !catalogEvidenceOnly && await saveExposureClaimFromCollectedItem(options.store, collected, generatedAt)) counters.exposureClaimCount++;
      latestCaptureIds.push(saved.capture.id);
    }
    counters.completedTaskCount++; options.frontier.complete(task);
    const checkedAt = options.now?.() ?? nowIso(), useful = taskMetrics.captureCount > 0;
    const lastContentAt = useful ? latestTimestamp(taskMetrics.productivePublishedAt) ?? checkedAt : source.health?.lastContentAt;
    options.store.saveSourceHealthObservation?.(sourceHealthObservation(source, task, runId, checkedAt, Date.now() - startedMs, taskMetrics, { success: true, useful }));
    options.store.saveSource({ ...source, lastSeenAt: lastContentAt ?? source.lastSeenAt, health: { ...(source.health ?? {}), status: taskMetrics.parserWarningCount ? "degraded" : "healthy", checkedAt, lastSuccessAt: checkedAt, lastContentAt, lastUsefulAt: useful ? checkedAt : source.health?.lastUsefulAt, consecutiveFailures: 0, errorRate: 0, parserStatus: taskMetrics.parserWarningCount ? "warnings" : "healthy", lastError: undefined }, crawlState: { ...(source.crawlState ?? {}), retryCount: 0, lastCollectedAt: checkedAt, nextEligibleAt: new Date(Date.parse(checkedAt) + (source.crawlFrequencySeconds ?? 3600) * 1000).toISOString(), backoffUntil: undefined, lastError: undefined }, metadata: { ...(source.metadata ?? {}), lastCanaryFetchMode: mode }, updatedAt: checkedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error); taskMetrics.httpStatus = Number.isInteger((error as any)?.httpStatus) ? (error as any).httpStatus : taskMetrics.httpStatus; counters.failedTaskCount++; errors.push({ taskId: task.id, sourceId: task.sourceId, message });
    const ack = options.frontier.fail(task, new Date(generatedAt), message); if (ack?.status === "retry_scheduled") counters.retryScheduledCount++; if (ack?.status === "retry_exhausted") counters.retryExhaustedCount++;
    if (source) {
      const retryCount = (source.crawlState?.retryCount ?? 0) + 1;
      const backoffSeconds = Math.min(86_400, Math.max(300, retryCount * retryCount * 300));
      const checkedAt = options.now?.() ?? nowIso(), backoffUntil = new Date(Date.parse(checkedAt) + (ack?.status === "retry_exhausted" ? 86_400 : backoffSeconds) * 1000).toISOString();
      options.store.saveSourceHealthObservation?.(sourceHealthObservation(source, task, runId, checkedAt, Date.now() - startedMs, taskMetrics, { success: false, useful: false, failureReason: message }));
      options.store.saveSource({
        ...source,
        health: { ...(source.health ?? {}), status: retryCount >= 5 ? "failing" : "degraded", checkedAt, lastFailureAt: checkedAt, consecutiveFailures: retryCount, errorRate: 1, lastError: message },
        crawlState: {
          ...(source.crawlState ?? {}),
          retryCount,
          lastErrorAt: checkedAt,
          lastError: message,
          nextEligibleAt: backoffUntil,
          backoffUntil
        },
        updatedAt: checkedAt
      });
    }
  }
}
function recordWatchlistEvidenceHealth(store: any, collected: any, task: any, runId: string, checkedAt: string, duplicate: boolean, incident: boolean) {
  const evidenceSource = store.getSource?.(collected.sourceId);
  if (!evidenceSource) return;
  const useful = !duplicate;
  const lastContentAt = useful ? collected.publishedAt ?? checkedAt : evidenceSource.health?.lastContentAt;
  store.saveSourceHealthObservation?.({
    id: stableId("source-health", `${runId}:${task.id}:${evidenceSource.id}:${collected.contentHash}`),
    tenantId: collected.tenantId,
    sourceId: evidenceSource.id,
    collectionRunId: runId,
    taskId: task.id,
    checkedAt,
    status: "healthy",
    success: true,
    useful,
    itemCount: 1,
    captureCount: duplicate ? 0 : 1,
    incidentCount: incident ? 1 : 0,
    duplicateCount: duplicate ? 1 : 0,
    parserWarningCount: 0,
    observedActorCount: 0,
    legalMode: "public_content"
  });
  store.saveSource({
    ...evidenceSource,
    lastSeenAt: lastContentAt ?? evidenceSource.lastSeenAt,
    health: { ...(evidenceSource.health ?? {}), status: "healthy", checkedAt, lastSuccessAt: checkedAt, lastContentAt, lastUsefulAt: useful ? checkedAt : evidenceSource.health?.lastUsefulAt, consecutiveFailures: 0, errorRate: 0, parserStatus: "healthy", lastError: undefined },
    crawlState: { ...(evidenceSource.crawlState ?? {}), retryCount: 0, lastCollectedAt: checkedAt, nextEligibleAt: new Date(Date.parse(checkedAt) + (evidenceSource.crawlFrequencySeconds ?? 86_400) * 1000).toISOString(), backoffUntil: undefined, lastError: undefined },
    updatedAt: checkedAt
  });
}
function sourceHealthObservation(source: any, task: any, runId: string, checkedAt: string, latencyMs: number, metrics: any, outcome: { success: boolean; useful: boolean; failureReason?: string }) {
  const latestPublishedAt = [...metrics.publishedAt].sort((a: string, b: string) => Date.parse(b) - Date.parse(a))[0];
  const freshnessLagSeconds = latestPublishedAt ? Math.max(0, Math.round((Date.parse(checkedAt) - Date.parse(latestPublishedAt)) / 1000)) : undefined;
  const httpStatus = metrics.httpStatus;
  return {
    id: stableId("source-health", `${runId}:${task.id}`),
    tenantId: task.tenantId ?? source.tenantId,
    sourceId: source.id,
    collectionRunId: runId,
    taskId: task.id,
    checkedAt,
    status: outcome.success ? metrics.parserWarningCount ? "degraded" : "healthy" : "failed",
    success: outcome.success,
    useful: outcome.useful,
    httpStatus: Number.isInteger(httpStatus) ? httpStatus : undefined,
    latencyMs: Math.max(0, latencyMs),
    itemCount: metrics.itemCount,
    captureCount: metrics.captureCount,
    incidentCount: metrics.incidentCount,
    duplicateCount: metrics.duplicateCount,
    parserWarningCount: metrics.parserWarningCount,
    observedActorCount: metrics.actorIds.size,
    freshnessLagSeconds,
    adapterFailureCategory: outcome.success ? undefined : failureCategory(outcome.failureReason),
    failureReason: outcome.failureReason,
    legalMode: source.governance?.metadataOnly || source.metadata?.captureMode === "metadata_only" ? "metadata_only" : "public_content"
  };
}
function failureCategory(message?: string) { return !message ? undefined : /timeout|abort/i.test(message) ? "timeout" : /policy|blocked|robots/i.test(message) ? "policy_blocked" : /unsupported media/i.test(message) ? "unsupported_media" : /HTTP 429|rate.?limit/i.test(message) ? "rate_limited" : /HTTP 5\d\d/i.test(message) ? "upstream_failure" : /HTTP 4\d\d/i.test(message) ? "source_rejected" : /parse|xml|json|html/i.test(message) ? "parser_failure" : /fetch|network|dns|connect/i.test(message) ? "network_failure" : "collection_failure"; }
function itemLimit(source: any, options: any, task?: any) {
  return maxItemsFor(source, task) ?? Math.max(1, Math.min(Number(options.maxItemsPerTask ?? 40), Number(source.metadata?.maxItemsPerProcess ?? Infinity)));
}
function activityWindowDays(source: any) {
  const declaredSeconds = Number(source.metadata?.activityWindowSeconds);
  return Number.isFinite(declaredSeconds) && declaredSeconds > 0 ? Math.max(30, Math.ceil(declaredSeconds / 86_400)) : source.metadata?.queryClass === "threat-intel" ? 365 : 30;
}
function isProductionCollectionSource(source: any, generatedAt: string) {
  if (sourceCollectionLane(source) !== "public") return false;
  const nextEligibleAt = source.crawlState?.nextEligibleAt;
  return !nextEligibleAt || Date.parse(nextEligibleAt) <= Date.parse(generatedAt);
}
function inCollectionScope(source: any, tenantId?: string) {
  const sourceTenantId = String(source.tenantId ?? "").trim() || undefined;
  const shared = sourceTenantId === undefined || sourceTenantId === "global";
  return tenantId ? shared || sourceTenantId === tenantId : shared;
}
function sourceScheduleTime(source: any) {
  return Date.parse(source.health?.checkedAt ?? source.crawlState?.lastCollectedAt ?? source.updatedAt ?? source.createdAt ?? "") || 0;
}
function latestTimestamp(values: unknown[]) {
  return values.map((value) => Date.parse(String(value ?? ""))).filter(Number.isFinite).sort((left, right) => right - left).map((value) => new Date(value).toISOString())[0];
}
