// @ts-nocheck
import { createHash } from "node:crypto";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { saveExposureClaimFromCollectedItem } from "../api/exposureQueueRoutes.ts";
import { nowIso, stableId } from "../utils.ts";
import { evidenceIndependence } from "../storage/memoryStore.ts";
import { activatePublicCanarySources, currentProductiveSourceCycles, pausePublicCanarySources, reconcilePublicSourceProductivity } from "./canaryActivation.ts";
import { canaryQueries, PUBLIC_CANARY_SOURCE_PORTFOLIO } from "./canaryPortfolio.ts";
import { detachedState, externalize, fetchItems, health, maxItemsFor, nextAnchoredCycleAt, tasksForSource } from "./canaryHelpers.ts";
import { isCisaKevSource, isNvdCveSource, isParserEmptyFallback } from "./canaryFeedItems.ts";
import { isSellableIntelText, sellableReason } from "../value/sellableIntel.ts";
import { sourceActivityWindowDays } from "../policy/sourceActivityWindow.ts";
import { sourceCollectionLane } from "../policy/collectionPolicy.ts";
import { buildRawCapture } from "../pipeline/pipelineCapture.ts";
import { activeWatchlistDiscoveryTerms, collectWatchlistDiscoveryEvidence, scheduleWatchlistDiscoveryRuns } from "./watchlistDiscovery.ts";
import { isCurrentSourcePortfolioVerification } from "../registry/sourcePortfolioBatch.ts";
import { runSourceFeedDiscoveryCycle } from "./sourceFeedDiscovery.ts";
import { hasApprovedAutomaticSourceReview, hasGovernedAutomaticSourceReviewLineage, isLegacySourceReviewCandidate, sourceRequiresAutomaticReview } from "../policy/sourceAutomaticReview.ts";
import { automaticSourceReviewEvidenceBindingsMatch } from "../api/automaticReviewRoutes.ts";
export { activatePublicCanarySources, pausePublicCanarySources } from "./canaryActivation.ts"; export { PUBLIC_CANARY_SOURCE_PORTFOLIO } from "./canaryPortfolio.ts";
export { buildCanaryOperatorConsoleHtml, buildCanaryOperatorSummary, buildCanaryReadinessPacket, buildCanarySoakReport } from "./canaryReports.ts";
export type * from "./canaryCollectionTypes.ts";
import type { CanaryCollectionCycleResult, CanaryCollectionLoopHandle, CanaryCollectionOptions } from "./canaryCollectionTypes.ts";
const MAX_CANARY_TASKS_PER_CYCLE = 60;
const MAX_HEALTHY_PENDING_WRITES = 1_000;
function storageBackpressure(store: any) {
  const snapshot = store?.databaseHealthSnapshot?.();
  if (!snapshot) return undefined;
  const pendingWrites = Number(snapshot.pendingWrites ?? 0);
  const lastWriteError = typeof snapshot.lastWriteError === "string" ? snapshot.lastWriteError.trim() : "";
  if (!lastWriteError && pendingWrites <= MAX_HEALTHY_PENDING_WRITES) return undefined;
  const reason = lastWriteError || "PostgreSQL write queue is unhealthy.";
  return { ok: false, pendingWrites, lastWriteError: reason, message: `Collection paused because PostgreSQL writes are unhealthy: ${reason}` };
}
function effectiveCanaryLimits(options: any) {
  const maxConcurrentTasks = Math.max(1, Math.min(Number(options.maxConcurrentTasks ?? 5), 32));
  const maxTasks = Math.min(Math.max(1, options.maxTasks ?? 5), MAX_CANARY_TASKS_PER_CYCLE);
  return { maxSources: Math.min(Math.max(1, options.maxSources ?? 10), maxTasks), maxTasks, maxConcurrentTasks };
}
export async function runCanaryCollectionCycle(options: CanaryCollectionOptions): Promise<CanaryCollectionCycleResult> {
  const generatedAt = options.now?.() ?? nowIso(), fetcher = options.fetch ?? fetch, mode = options.fetch ? "injected_proof_fetch" : "native_live_http";
  const storageFailure = storageBackpressure(options.store);
  if (storageFailure) {
    const planId = stableId("canary-plan", `${options.tenantId ?? "global"}:${generatedAt}`);
    const runId = stableId("canary-run", planId);
    const runError = { code: "storage_backpressure", message: storageFailure.message };
    try {
      options.store.savePlan?.({ id: planId, tenantId: options.tenantId, requestId: "req_public_canary", createdAt: generatedAt, tasks: [], request: { query: canaryQueries }, reviewRequired: [], rejected: [], audit: [] });
      options.store.saveRun?.({ id: runId, tenantId: options.tenantId, planId, requestId: "req_public_canary", trigger: options.trigger ?? "automated", status: "failed", createdAt: generatedAt, startedAt: generatedAt, completedAt: generatedAt, updatedAt: generatedAt, taskCount: 0, sourceCount: 0, captureCount: 0, incidentCount: 0, failedTaskCount: 0, error: runError.message });
    } catch {
      // Preserve the original storage error; the existing write queue will retry queued records.
    }
    const queueLimit = Math.max(1, Number(options.queueLimit ?? 500));
    const counters = { leasedTaskCount: 0, completedTaskCount: 0, insertedCaptureCount: 0, duplicateCaptureCount: 0, failedTaskCount: 0, incidentCount: 0, exposureClaimCount: 0, skippedLowValueCount: 0, retryScheduledCount: 0, retryExhaustedCount: 0 };
    return {
      generatedAt,
      tenantId: options.tenantId,
      mode: "production_canary",
      status: "failed",
      runId,
      planId,
      activationApplied: false,
      activatedSourceCount: 0,
      retiredSourceCount: 0,
      supersededTaskCount: 0,
      activeSourceCount: 0,
      deferredDueSourceCount: 0,
      queuedTaskCount: 0,
      queueLimit,
      availableQueueSlots: Math.max(0, queueLimit - Number(options.frontier.size?.() ?? options.frontier.snapshot?.().length ?? 0)),
      backpressureState: "storage_failed",
      storage: storageFailure,
      ...counters,
      remainingQueuedTaskCount: 0,
      latestCaptureIds: [],
      errors: [runError],
      health: health(options.store, generatedAt, counters)
    };
  }
  if (options.store.batch && !options.batched) return options.store.batch(() => runCanaryCollectionCycle({ ...options, batched: true }));
  const productivity = reconcilePublicSourceProductivity({ ...options, now: generatedAt });
  const activation = options.activateSources ? activatePublicCanarySources({ ...options, now: generatedAt }) : { activated: [], alreadyActive: [], rejected: [] };
  // ponytail: keep one cycle bounded; remaining due work stays queued for the next cadence.
  const { maxSources, maxTasks, maxConcurrentTasks } = effectiveCanaryLimits(options), maxBytes = Math.max(1024, options.maxBytes ?? 512_000);
  const selectedSourceIds = new Set<string>(options.sourceIds ?? []);
  const supersededTaskCount = supersedeCoveredQueuedTasks(options, generatedAt, selectedSourceIds);
  const queuedTasks = options.frontier.snapshot().map(frontierTask).filter((task: any) => taskInScope(options, task, selectedSourceIds));
  const leasedTasks = options.frontier.leasedSnapshot().filter((task: any) => taskInScope(options, task, selectedSourceIds));
  const pendingJobKeys = new Set([...queuedTasks, ...leasedTasks].map(sourceJobKey));
  const resumedRunId = queuedTasks.find((task: any) => (!task.availableAt || Date.parse(task.availableAt) <= Date.parse(generatedAt))
    && task.runId && options.store.getRun?.(task.runId)?.requestId === "req_public_canary")?.runId;
  const resumedTasks = resumedRunId ? queuedTasks.filter((task: any) => task.runId === resumedRunId).slice(0, maxTasks) : [];
  const resumedRun = resumedRunId ? options.store.getRun?.(resumedRunId) : undefined;
  const allDue = options.store.listSources()
    .filter((s: any) => inCollectionScope(s, options.tenantId, options.includeSharedSources) && (!selectedSourceIds.size || selectedSourceIds.has(s.id)) && isProductionCollectionSource(s, generatedAt, options.store))
    .sort((left: any, right: any) => sourceScheduleTime(left) - sourceScheduleTime(right) || String(left.id).localeCompare(String(right.id)));
  const due = allDue.slice(0, maxSources);
  const generatedPlanId = stableId("canary-plan", `${options.tenantId ?? "global"}:${generatedAt}`);
  const planId = resumedRun?.planId ?? resumedTasks[0]?.planId ?? generatedPlanId;
  const runId = resumedRunId ?? stableId("canary-run", planId);
  const queueLimit = Math.max(1, Number(options.queueLimit ?? 500));
  const availableQueueSlots = Math.max(0, queueLimit - Number(options.frontier.size?.() ?? options.frontier.snapshot?.().length ?? 0));
  const tasks = resumedTasks.length
    ? resumedTasks
    : due.flatMap((s: any) => tasksForSource(s, generatedAt, runId, maxBytes).map((task: any) => ({ ...task, planId })))
      .filter((task: any) => !pendingJobKeys.has(sourceJobKey(task)))
      .slice(0, Math.min(maxTasks, availableQueueSlots));
  const scheduledSourceIds = new Set(tasks.map((task: any) => task.sourceId));
  const backpressureState = availableQueueSlots >= maxTasks ? "accepting" : "throttled";
  if (!resumedTasks.length) {
    options.store.savePlan?.({ id: planId, tenantId: options.tenantId, requestId: "req_public_canary", createdAt: generatedAt, tasks, request: { query: canaryQueries }, reviewRequired: [], rejected: activation.rejected, audit: [] });
    options.store.saveRun?.({ id: runId, tenantId: options.tenantId, planId, requestId: "req_public_canary", trigger: options.trigger ?? "automated", status: "running", createdAt: generatedAt, startedAt: generatedAt, updatedAt: generatedAt, taskCount: tasks.length, reviewTaskCount: 0, rejectedSourceCount: activation.rejected.length, captureCount: 0, incidentCount: 0 });
    for (const task of tasks) options.frontier.enqueueTask(task);
  } else {
    options.store.saveRun?.({ ...resumedRun, id: runId, tenantId: resumedRun?.tenantId ?? options.tenantId, planId, requestId: "req_public_canary", trigger: resumedRun?.trigger ?? options.trigger ?? "automated", status: "running", createdAt: resumedRun?.createdAt ?? generatedAt, startedAt: resumedRun?.startedAt ?? generatedAt, updatedAt: generatedAt });
  }
  const counters: any = {
    leasedTaskCount: Number(resumedRun?.leasedTaskCount ?? 0),
    completedTaskCount: Number(resumedRun?.completedTaskCount ?? 0),
    failedTaskCount: Number(resumedRun?.failedTaskCount ?? 0),
    insertedCaptureCount: Number(resumedRun?.captureCount ?? 0),
    duplicateCaptureCount: Number(resumedRun?.duplicateCaptureCount ?? 0),
    incidentCount: Number(resumedRun?.incidentCount ?? 0),
    exposureClaimCount: Number(resumedRun?.exposureClaimCount ?? 0),
    skippedLowValueCount: Number(resumedRun?.skippedLowValueCount ?? 0),
    retryScheduledCount: Number(resumedRun?.retryScheduledCount ?? 0),
    retryExhaustedCount: Number(resumedRun?.retryExhaustedCount ?? 0),
    discoveredRestrictedSourceCount: Number(resumedRun?.discoveredRestrictedSourceCount ?? 0)
  };
  const latestCaptureIds: string[] = [], completeEvaluationCaptures: any[] = [], errors: any[] = [];
  const concurrency = Math.max(1, Math.min(tasks.length || 1, Number(options.maxConcurrentTasks ?? 5)));
  for (let done = 0; done < tasks.length; done += concurrency) await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length - done) }, () => runLeasedTask(options, runId, generatedAt, fetcher, mode, maxBytes, counters, latestCaptureIds, errors)));
  retainIndependentEvaluationReferences(options.store, latestCaptureIds);
  const remainingQueuedTaskCount = options.frontier.snapshot().map(frontierTask).filter((task: any) => task.runId === runId).length;
  const runStatus = remainingQueuedTaskCount ? "queued" : counters.failedTaskCount && counters.completedTaskCount ? "degraded" : counters.failedTaskCount ? "failed" : "completed";
  const completedAt = options.now?.() ?? nowIso();
  options.store.saveRun?.({ ...resumedRun, id: runId, tenantId: resumedRun?.tenantId ?? options.tenantId, planId, requestId: "req_public_canary", trigger: resumedRun?.trigger ?? options.trigger ?? "automated", status: runStatus, createdAt: resumedRun?.createdAt ?? generatedAt, startedAt: resumedRun?.startedAt ?? generatedAt, completedAt: runStatus === "queued" ? undefined : completedAt, updatedAt: completedAt, taskCount: resumedRun?.taskCount ?? tasks.length, sourceCount: resumedRun?.sourceCount ?? scheduledSourceIds.size, captureCount: counters.insertedCaptureCount, incidentCount: counters.incidentCount, exposureClaimCount: counters.exposureClaimCount, skippedLowValueCount: counters.skippedLowValueCount, duplicateCaptureCount: counters.duplicateCaptureCount, leasedTaskCount: counters.leasedTaskCount, failedTaskCount: counters.failedTaskCount, completedTaskCount: counters.completedTaskCount, retryScheduledCount: counters.retryScheduledCount, retryExhaustedCount: counters.retryExhaustedCount, error: errors[0]?.message });
  return { generatedAt, tenantId: options.tenantId, mode: "production_canary", status: runStatus, runId, planId, activationApplied: Boolean(options.activateSources), activatedSourceCount: activation.activated.length + activation.alreadyActive.length, retiredSourceCount: productivity.retired.length, supersededTaskCount, activeSourceCount: scheduledSourceIds.size, deferredDueSourceCount: allDue.length - scheduledSourceIds.size, queuedTaskCount: tasks.length, queueLimit, availableQueueSlots, backpressureState, ...counters, remainingQueuedTaskCount, latestCaptureIds, errors, health: health(options.store, generatedAt, counters) };
}

export function retainIndependentEvaluationReferences(store: any, collectedCaptureIds: string[]) {
  const collected = new Set(collectedCaptureIds);
  if (!collected.size || typeof store.saveValidationRecord !== "function") return 0;
  const sources = new Map(store.listSources().map((source: any) => [source.id, source]));
  const captures = store.listCaptures().filter(referenceEligibleCapture);
  const cisa = new Map<string, any>();
  for (const capture of captures) {
    if (!isCisaKevSource(sources.get(capture.sourceId))) continue;
    const cve = retainedCveId(capture);
    if (cve) cisa.set(cve, capture);
  }
  let retained = 0;
  for (const target of captures) {
    if (!collected.has(target.id) || !isNvdCveSource(sources.get(target.sourceId))) continue;
    const targetCve = retainedCveId(target), reference = targetCve && cisa.get(targetCve);
    const authoritativeCve = reference && retainedCveId(reference);
    if (!authoritativeCve || !reference || target.id === reference.id || evidenceIndependence(store, [target.id, reference.id]).groupCount < 2) continue;
    const expectedValues = [authoritativeCve];
    store.saveValidationRecord({
      id: stableId("evaluation-reference", `${target.id}:${reference.id}:cve:${authoritativeCve}`),
      tenantId: target.tenantId,
      captureId: target.id,
      validationType: "independent_evaluation_reference",
      status: "supported",
      referenceUrl: reference.canonicalUrl ?? reference.url,
      referenceCaptureId: reference.id,
      referenceSourceId: reference.sourceId,
      referenceContentHash: reference.contentHash,
      labelType: "cve",
      expectedValues,
      expectedValuesHash: createHash("sha256").update(JSON.stringify(["cve", authoritativeCve.toLowerCase()])).digest("hex"),
      exhaustiveExpectedValues: true,
      truthSchemaVersion: "ti.independent_evaluation_reference.v1",
      truthFrozenAt: reference.collectedAt,
      matchedAt: reference.collectedAt,
      reviewerId: "source-scheduler:cisa-kev:nvd-cve:v1"
    });
    retained++;
  }
  return retained;
}

function referenceEligibleCapture(capture: any) {
  return !capture.tenantId
    && !capture.sensitive
    && capture.storageKind !== "metadata_only"
    && capture.metadata?.fetchProvenance?.truncated !== true
    && !capture.metadata?.fixture
    && !capture.metadata?.synthetic
    && !capture.metadata?.demo;
}

function retainedCveId(capture: any) {
  const value = String(capture.metadata?.structuredFields?.cveID ?? "").trim().toUpperCase();
  return /^CVE-\d{4}-\d{4,}$/.test(value) ? value : undefined;
}

function isCisaKevSource(source: any) {
  return source?.id === "src_canary_cisa_known_exploited_json"
    && /^https:\/\/www\.cisa\.gov\/sites\/default\/files\/feeds\/known_exploited_vulnerabilities\.json(?:[?#].*)?$/i.test(String(source.url ?? ""));
}

function isNvdCveSource(source: any) {
  return source?.id === "src_canary_nvd_recent"
    && /^https:\/\/services\.nvd\.nist\.gov\/rest\/json\/cves\/2\.0(?:[?#].*)?$/i.test(String(source.url ?? ""));
}
export function startCanaryCollectionLoop(options: CanaryCollectionOptions & { enabled?: boolean; intervalSeconds?: number; queueLimit?: number; onCycle?: (r: any) => void; onError?: (e: unknown) => void }): CanaryCollectionLoopHandle {
  const state = detachedState(options.now?.() ?? nowIso(), options.queueLimit ?? 500), intervalMs = Math.max(5, options.intervalSeconds ?? 300) * 1000; let timer: Timer | undefined, startupTimer: Timer | undefined, active: Promise<void> | undefined;
  const cycle = (trigger: "automated" | "manual" = "automated") => {
    if (!state.enabled || active) return active ?? Promise.resolve();
    state.running = true; state.lastCycleAt = nowIso(); let catchUp = false;
    active = (async () => {
      try {
        const sourceFeedDiscovery = await runSourceFeedDiscoveryCycle(options, options.now?.() ?? nowIso());
        await (options.store as any).flush?.();
        const result = await runCanaryCollectionCycle({ ...options, trigger });
        const watchlistDiscovery = options.scheduleWatchlistDiscovery === false
          ? { scheduledRunCount: 0, skippedRunCount: 0, reason: "disabled_for_scheduler_lane" }
          : await scheduleWatchlistDiscoveryRuns({ ...options, awaitWatchlistDiscoveryExecution: false }, options.now?.() ?? nowIso());
        result.sourceFeedDiscovery = sourceFeedDiscovery;
        result.watchlistDiscovery = watchlistDiscovery;
        catchUp = result.status === "completed" && Number(result.deferredDueSourceCount ?? 0) > 0;
        state.latestResult = result;
        if (["completed", "degraded"].includes(result.status)) {
          state.successCount++; state.consecutiveErrorCount = 0; state.lastSuccessAt = result.generatedAt;
        } else if (result.status === "queued") {
          state.deferredCount = Number(state.deferredCount ?? 0) + 1; state.lastDeferredAt = result.generatedAt;
        } else {
          state.errorCount++; state.consecutiveErrorCount++; state.lastError = result.errors?.[0]?.message ?? `collection run ${result.status}`; state.lastErrorAt = result.generatedAt;
        }
        options.onCycle?.(result);
      }
      catch (e) { state.errorCount++; state.consecutiveErrorCount++; state.lastError = e instanceof Error ? e.message : String(e); state.lastErrorAt = nowIso(); options.onError?.(e); }
      finally { state.running = false; state.cycleCount++; state.nextCycleAt = state.enabled ? nextAnchoredCycleAt(state.startedAt, intervalMs) : undefined; active = undefined; if (catchUp && state.enabled) setTimeout(() => cycle("automated"), 1_000); }
    })();
    return active;
  };
  const limits = effectiveCanaryLimits(options);
  Object.assign(state, { supervisorAttached: true, enabled: options.enabled !== false, intervalSeconds: options.intervalSeconds ?? 300, maxSources: limits.maxSources, maxTasks: limits.maxTasks, maxConcurrentTasks: limits.maxConcurrentTasks, maxItemsPerTask: options.maxItemsPerTask ?? 40, maxBytes: options.maxBytes ?? 512_000, timeoutMs: options.timeoutMs ?? 30_000, queueLimit: options.queueLimit ?? 500, activateSources: Boolean(options.activateSources) });
  if (state.enabled) {
    state.nextCycleAt = new Date(Date.now() + 1_000).toISOString();
    startupTimer = setTimeout(() => cycle("automated"), 1_000);
  }
  timer = setInterval(() => cycle("automated"), intervalMs);
  return {
    stop: async () => { if (startupTimer) clearTimeout(startupTimer); if (timer) clearInterval(timer); state.enabled = false; state.nextCycleAt = undefined; await active; },
    getState: () => ({ ...state }),
    setEnabled: (enabled: boolean, metadata: any = {}) => {
      state.enabled = Boolean(enabled);
      state.updatedAt = nowIso();
      state.updatedBy = metadata.approvedBy ?? metadata.operatorId ?? "operator";
      state.pausedReason = enabled ? undefined : metadata.reason ?? "Paused by operator.";
      state.nextCycleAt = enabled ? nextAnchoredCycleAt(state.startedAt, intervalMs) : undefined;
      return { ...state };
    },
    runOnce: () => cycle("manual")
  };
}
export async function runLeasedTask(options: any, runId: string, generatedAt: string, fetcher: any, mode: string, maxBytes: number, counters: any, latestCaptureIds: string[], errors: any[], completeEvaluationCaptures: any[] = []) {
  const leased = options.frontier.next(new Date(generatedAt), (task: any) => task.runId === runId); if (!leased) return;
  const originalTask = leased.task, source = options.store.getSource?.(originalTask.sourceId), startedMs = Date.now(); counters.leasedTaskCount++;
  const task = source && isNvdCveSource(source) ? nvdEvaluationTask(options.store, originalTask, source) : originalTask;
  const taskMetrics: any = { itemCount: 0, captureCount: 0, usefulCaptureCount: 0, incidentCount: 0, duplicateCount: 0, parserWarningCount: 0, actorIds: new Set<string>(), publishedAt: [], productivePublishedAt: [] };
  try {
    if (!source) throw new Error("source missing");
    if (task.planning?.watchlistDiscovery) {
      const activeTerms = activeWatchlistDiscoveryTerms(options.store, task);
      if (!activeTerms.length) { counters.completedTaskCount++; options.frontier.complete(task); return; }
      task.planning.watchlistDiscovery = { ...task.planning.watchlistDiscovery, terms: activeTerms };
    }
    const discoveredItems = await fetchItems(source, task, fetcher, mode, generatedAt, maxBytes, options.timeoutMs ?? 12_000, itemLimit(source, options, task));
    const intelligenceItems = discoveredItems.filter((item: any) => !isParserEmptyFallback(item));
    const collectedItems = task.planning?.watchlistDiscovery
      ? await collectWatchlistDiscoveryEvidence({ store: options.store, source, task, discoveryItems: intelligenceItems, fetcher, generatedAt, timeoutMs: options.timeoutMs ?? 12_000, maxBytes: Math.max(maxBytes, 2_000_000), nativeFetch: mode === "native_live_http" })
      : intelligenceItems;
    normalizeRansomLookTimeliness(source, collectedItems);
    taskMetrics.itemCount = discoveredItems.length;
    taskMetrics.httpStatus = discoveredItems[0]?.metadata?.fetchProvenance?.httpStatus;
    taskMetrics.parserWarningCount = discoveredItems.reduce((total: number, item: any) => total + (Array.isArray(item.metadata?.parserWarnings) ? item.metadata.parserWarnings.length : 0), 0);
    taskMetrics.publishedAt = discoveredItems.map((item: any) => item.publishedAt).filter(Boolean);
    const reviewedSource = options.store.getSource?.(source.id) ?? source;
    const sourceReviewApproved = hasApprovedAutomaticSourceReview(reviewedSource)
      && automaticSourceReviewEvidenceBindingsMatch(reviewedSource, (id) => options.store.getCapture?.(id));
    const itemUseful = (collected: any) => Boolean(task.planning?.watchlistDiscovery
      || isNvdCveSource(source)
      || ["cisa_kev", "ransomware_group_metadata", "mitre_actor_catalog", "ransomware_operation_catalog", "ransomware_operation_activity_evidence"].includes(collected.metadata?.extractionProfile)
      || sourceReviewApproved && currentReviewedItem(collected, source, generatedAt)
      || isSellableIntelText({ text: collected.rawText, title: collected.title, sourceId: collected.sourceId, sourceName: source.name, adapter: collected.metadata?.adapter, publishedAt: collected.publishedAt, collectedAt: collected.collectedAt, now: generatedAt, maxAgeDays: sourceActivityWindowDays(source) }));
    const retainedItems = task.planning?.watchlistDiscovery
      ? collectedItems
      : collectedItems.filter((collected: any) => itemUseful(collected) || sourceRequiresAutomaticReview(source));
    counters.skippedLowValueCount += Math.max(0, intelligenceItems.length - retainedItems.filter(itemUseful).length);
    for (const collected of retainedItems.slice(0, itemLimit(source, options, task))) {
      const usefulItem = itemUseful(collected);
      const sourceReviewCandidate = !usefulItem && sourceRequiresAutomaticReview(source);
      collected.tenantId = task.tenantId ?? collected.tenantId ?? source.tenantId;
      collected.organizationId = task.planning?.watchlistDiscovery?.organizationId ?? collected.organizationId;
      collected.metadata = { ...collected.metadata, runId, queryTerms: task.planning?.watchlistDiscovery ? (collected.metadata?.matchedWatchlistTerms ?? []).map((term: any) => term.value) : task.planning?.queryTerms ?? [], sellableCandidate: usefulItem, sellableReason: usefulItem && sourceReviewApproved ? "approved_source_review" : sellableReason(`${collected.title ?? ""} ${collected.rawText}`), ...(sourceReviewCandidate ? { sourceReviewCandidate: true } : {}) };
      const actorIdentityCatalogSnapshot = collected.metadata?.actorIdentityCatalogSnapshot ?? collected.metadata?.ransomwareOperationCatalogSnapshot;
      const catalogEvidenceOnly = collected.metadata?.catalogEvidenceOnly === true;
      const { actorIdentityCatalogSnapshot: _mitreSnapshot, ransomwareOperationCatalogSnapshot: _ransomwareSnapshot, ...captureMetadata } = collected.metadata ?? {};
      let pipeline = actorIdentityCatalogSnapshot || catalogEvidenceOnly || sourceReviewCandidate
        ? { capture: buildRawCapture({ ...collected, metadata: captureMetadata }), entities: [], indicators: [] }
        : processCollectedItem(collected, { actorIdentities: options.store.listActorIdentities?.() ?? [] });
      const completeEvaluationCapture = pipeline.capture;
      if (pipeline.capture.body && options.objectStore) pipeline = { ...pipeline, capture: externalize(pipeline.capture, options.objectStore) };
      const duplicate = options.store.findDuplicateCapture?.(pipeline.capture);
      let saved: any;
      try {
        saved = options.store.savePipelineResult(pipeline);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        if (source.id !== "src_canary_ransomlook_recent" || !message.startsWith("Timeliness timestamp inversion:")) throw caught;
        // RansomLook has emitted malformed publisher timing. Keep the captured
        // evidence, but do not let an optional timeliness write fail the source.
        saved = { ...pipeline, capture: options.store.getCapture?.(pipeline.capture.id) ?? pipeline.capture };
        taskMetrics.parserWarningCount++;
      }
      if (actorIdentityCatalogSnapshot) {
        if (typeof options.store.replaceActorIdentityCatalog !== "function") throw new Error("Actor identity catalog persistence is unavailable.");
        const evidenceCaptureIds = options.store.listCaptures().filter((capture: any) => actorIdentityCatalogSnapshot.evidenceContentHashes?.includes(capture.contentHash)).map((capture: any) => capture.id);
        options.store.replaceActorIdentityCatalog({ ...actorIdentityCatalogSnapshot, ...(evidenceCaptureIds.length ? { evidenceCaptureIds } : {}) }, { sourceId: source.id, captureId: saved.capture.id, importedAt: generatedAt });
      }
      if (duplicate) { counters.duplicateCaptureCount++; taskMetrics.duplicateCount++; } else {
        counters.insertedCaptureCount++;
        taskMetrics.captureCount++;
        if (usefulItem) {
          taskMetrics.usefulCaptureCount++;
          if (collected.publishedAt) taskMetrics.productivePublishedAt.push(collected.publishedAt);
        }
      }
      if (saved.incident) { counters.incidentCount++; taskMetrics.incidentCount++; }
      if (task.planning?.watchlistDiscovery && collected.sourceId !== source.id) recordWatchlistEvidenceHealth(options.store, collected, task, runId, generatedAt, Boolean(duplicate), Boolean(saved.incident));
      for (const entity of pipeline.entities ?? []) if (["actor", "ransomware_family"].includes(entity.type)) taskMetrics.actorIds.add(String(entity.normalizedValue ?? entity.value));
      if (!duplicate && usefulItem && !task.planning?.watchlistDiscovery && !actorIdentityCatalogSnapshot && !catalogEvidenceOnly && await saveExposureClaimFromCollectedItem(options.store, collected, generatedAt)) counters.exposureClaimCount++;
      latestCaptureIds.push(saved.capture.id);
      if (source.id === "src_canary_nvd_recent") completeEvaluationCaptures.push({ capture: completeEvaluationCapture, evaluationCveSet: collected.evaluationCveSet });
    }
    counters.completedTaskCount++; options.frontier.complete(task);
    const checkedAt = options.now?.() ?? nowIso(), useful = taskMetrics.usefulCaptureCount > 0;
    options.store.saveSourceHealthObservation?.(sourceHealthObservation(source, task, runId, checkedAt, Date.now() - startedMs, taskMetrics, { success: true, useful }));
    const currentSource = options.store.getSource?.(source.id);
    if (!currentSource || currentSource.tenantId !== source.tenantId) return;
    const lastContentAt = useful ? latestTimestamp(taskMetrics.productivePublishedAt) ?? checkedAt : currentSource.health?.lastContentAt;
    const portfolioCandidate = governedPortfolioCandidate(currentSource, checkedAt, options.store);
    const reviewGovernedSource = portfolioCandidate || isLegacySourceReviewCandidate(currentSource);
    const productiveCycles = reviewGovernedSource ? currentProductiveSourceCycles(options.store, currentSource, checkedAt) : [];
    const sustained = hasApprovedAutomaticSourceReview(currentSource)
      && automaticSourceReviewEvidenceBindingsMatch(currentSource, (id) => options.store.getCapture?.(id))
      && productiveCycles.length >= 2;
    options.store.saveSource({
      ...currentSource,
      status: portfolioCandidate ? sustained ? "active" : "candidate" : currentSource.status,
      countsAsCoverage: reviewGovernedSource ? sustained : currentSource.countsAsCoverage,
      lastSeenAt: lastContentAt ?? currentSource.lastSeenAt,
      health: { ...(currentSource.health ?? {}), status: taskMetrics.parserWarningCount ? "degraded" : "healthy", checkedAt, lastSuccessAt: checkedAt, lastContentAt, lastUsefulAt: useful ? checkedAt : currentSource.health?.lastUsefulAt, consecutiveFailures: 0, errorRate: 0, parserStatus: taskMetrics.parserWarningCount ? "warnings" : "healthy", lastError: undefined },
      crawlState: { ...(currentSource.crawlState ?? {}), retryCount: 0, lastCollectedAt: checkedAt, nextEligibleAt: new Date(Date.parse(checkedAt) + (currentSource.crawlFrequencySeconds ?? 3600) * 1000).toISOString(), backoffUntil: undefined, lastError: undefined },
      metadata: {
        ...(currentSource.metadata ?? {}),
        lastCanaryFetchMode: mode,
        ...(reviewGovernedSource ? {
          productionCollection: portfolioCandidate ? sustained : currentSource.metadata?.productionCollection,
          countsAsCoverage: sustained,
          sourcePortfolioQualificationState: sustained ? "sustained_productive" : "pending_sustained_productivity",
          sourcePortfolioProductiveCheckCount: productiveCycles.length,
          sourcePortfolioLastProductiveAt: productiveCycles.at(-1)?.checkedAt
        } : {})
      },
      updatedAt: checkedAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error); taskMetrics.httpStatus = Number.isInteger((error as any)?.httpStatus) ? (error as any).httpStatus : taskMetrics.httpStatus; counters.failedTaskCount++; errors.push({ taskId: task.id, sourceId: task.sourceId, message });
    const ack = options.frontier.fail(task, new Date(generatedAt), message); if (ack?.status === "retry_scheduled") counters.retryScheduledCount++; if (ack?.status === "retry_exhausted") counters.retryExhaustedCount++;
    if (source) {
      const checkedAt = options.now?.() ?? nowIso();
      options.store.saveSourceHealthObservation?.(sourceHealthObservation(source, task, runId, checkedAt, Date.now() - startedMs, taskMetrics, { success: false, useful: false, failureReason: message }));
      const currentSource = options.store.getSource?.(source.id);
      if (!currentSource || currentSource.tenantId !== source.tenantId) return;
      const retryCount = (currentSource.crawlState?.retryCount ?? 0) + 1;
      const backoffSeconds = Math.min(86_400, Math.max(300, retryCount * retryCount * 300));
      const backoffUntil = new Date(Date.parse(checkedAt) + (ack?.status === "retry_exhausted" ? 86_400 : backoffSeconds) * 1000).toISOString();
      options.store.saveSource({
        ...currentSource,
        health: { ...(currentSource.health ?? {}), status: retryCount >= 5 ? "failing" : "degraded", checkedAt, lastFailureAt: checkedAt, consecutiveFailures: retryCount, errorRate: 1, lastError: message },
        crawlState: {
          ...(currentSource.crawlState ?? {}),
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

function normalizeRansomLookTimeliness(source: any, items: any[]): void {
  if (source.id !== "src_canary_ransomlook_recent") return;
  for (const item of items) {
    const publishedAt = Date.parse(String(item.publishedAt ?? ""));
    const collectedAt = Date.parse(String(item.collectedAt ?? nowIso()));
    if (!Number.isFinite(publishedAt) || !Number.isFinite(collectedAt) || publishedAt <= collectedAt) continue;
    const normalizedPublishedAt = item.collectedAt ?? nowIso();
    item.metadata = {
      ...(item.metadata ?? {}),
      timelinessAnomalies: [...new Set([...(item.metadata?.timelinessAnomalies ?? []), "publisher_timestamp_after_collection"])],
      publisherReportedAt: item.publishedAt,
      reportTimestamps: [],
    };
    item.publishedAt = normalizedPublishedAt;
  }
}

function nvdEvaluationTask(store: any, task: any, source: any) {
  const cve = [...new Set<string>((store.listCaptures?.() ?? [])
    .filter((capture: any) => isCisaKevSource(store.getSource?.(capture.sourceId)))
    .map((capture: any) => retainedCveId(capture))
    .filter(Boolean) as string[])]
    .find((candidate: string) => !(store.listCaptures?.() ?? [])
      .some((capture: any) => capture.sourceId === source.id && retainedCveId(capture) === candidate));
  if (!cve) return task;
  const url = new URL(task.targetUrl);
  url.searchParams.set("cveId", cve);
  return { ...task, targetUrl: url.toString(), planning: { ...(task.planning ?? {}), evaluationCveId: cve } };
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
    sourceJobId: task.planning?.sourceJobId ?? "default",
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
  const sourceLimit = maxItemsFor(source, task), profile = task?.planning?.extractionProfile ?? source.metadata?.extractionProfile;
  if (["mitre_actor_catalog", "ransomware_operation_catalog", "ransomware_group_metadata"].includes(profile)) return sourceLimit ?? Number(options.maxItemsPerTask ?? 40);
  return Math.max(1, Math.min(Number(options.maxItemsPerTask ?? 40), Number(sourceLimit ?? Infinity), Number(source.metadata?.maxItemsPerProcess ?? Infinity)));
}
function isProductionCollectionSource(source: any, generatedAt: string, store: any) {
  if (sourceCollectionLane(source) !== "public" && !governedPortfolioCandidate(source, generatedAt, store)) return false;
  const nextEligibleAt = source.crawlState?.nextEligibleAt;
  return !nextEligibleAt || Date.parse(nextEligibleAt) <= Date.parse(generatedAt);
}
function governedPortfolioCandidate(source: any, generatedAt: string, store: any) {
  return source.status === "candidate"
    && source.metadata?.productionCollection === false
    && source.metadata?.sourcePortfolioExcluded !== true
    && source.metadata?.sourcePortfolioVerification?.outcome === "content_parsed"
    && (isCurrentSourcePortfolioVerification(source, generatedAt)
      || hasApprovedAutomaticSourceReview(source)
        && automaticSourceReviewEvidenceBindingsMatch(source, (id) => store.getCapture?.(id)))
    && source.accessMethod === "public_http"
    && source.risk === "low"
    && source.governance?.approvalState === "approved"
    && ["rss", "api", "json_api", "telegram_public"].includes(source.type);
}
function supersedeCoveredQueuedTasks(options: any, generatedAt: string, selectedSourceIds: Set<string>) {
  const observations = options.store.listSourceHealthObservations?.() ?? [];
  const affectedRuns = new Map<string, number>();
  for (const item of options.frontier.snapshot()) {
    const task = frontierTask(item);
    if (!taskInScope(options, task, selectedSourceIds)) continue;
    const source = options.store.getSource?.(task.sourceId);
    if (!source || Date.parse(source.crawlState?.nextEligibleAt ?? "") <= Date.parse(generatedAt)) continue;
    const covered = observations.some((row: any) =>
      row.sourceId === task.sourceId
      && row.tenantId === task.tenantId
      && row.success === true
      && Date.parse(row.checkedAt) > Date.parse(task.queuedAt)
      && sourceJobKey(row) === sourceJobKey(task));
    if (!covered) continue;
    options.frontier.cancel(task, "superseded by a newer successful source-job collection");
    if (task.runId) affectedRuns.set(task.runId, (affectedRuns.get(task.runId) ?? 0) + 1);
  }
  for (const [runId, count] of affectedRuns) {
    const run = options.store.getRun?.(runId);
    if (!run) continue;
    const remaining = [...options.frontier.snapshot().map(frontierTask), ...options.frontier.leasedSnapshot()].some((task: any) => task.runId === runId);
    options.store.saveRun?.({
      ...run,
      status: remaining ? "queued" : "superseded",
      supersededTaskCount: Number(run.supersededTaskCount ?? 0) + count,
      ...(remaining ? {} : { completedAt: generatedAt }),
      updatedAt: generatedAt
    });
  }
  return [...affectedRuns.values()].reduce((total, count) => total + count, 0);
}
function frontierTask(item: any) { return item?.task ?? item; }
function sourceJobKey(task: any) { return `${task.tenantId ?? "global"}:${task.sourceId}:${task.sourceJobId ?? task.planning?.sourceJobId ?? "default"}`; }
function taskInScope(options: any, task: any, selectedSourceIds: Set<string>) {
  if (!task || selectedSourceIds.size && !selectedSourceIds.has(task.sourceId)) return false;
  const source = options.store.getSource?.(task.sourceId);
  return Boolean(source && inCollectionScope(source, options.tenantId, options.includeSharedSources));
}
function inCollectionScope(source: any, tenantId?: string, includeSharedSources = true) {
  const sourceTenantId = String(source.tenantId ?? "").trim() || undefined;
  const shared = sourceTenantId === undefined || sourceTenantId === "global";
  return tenantId ? sourceTenantId === tenantId || includeSharedSources && shared : shared;
}
function sourceScheduleTime(source: any) {
  return Date.parse(source.health?.checkedAt ?? source.crawlState?.lastCollectedAt ?? source.updatedAt ?? source.createdAt ?? "") || 0;
}
function latestTimestamp(values: unknown[]) {
  return values.map((value) => Date.parse(String(value ?? ""))).filter(Number.isFinite).sort((left, right) => right - left).map((value) => new Date(value).toISOString())[0];
}
function currentReviewedItem(item: any, source: any, generatedAt: string) {
  const itemAt = Date.parse(String(item.publishedAt ?? item.collectedAt ?? ""));
  const ageMs = Date.parse(generatedAt) - itemAt;
  return Number.isFinite(ageMs) && ageMs >= -5 * 60_000 && ageMs <= sourceActivityWindowDays(source) * 86_400_000;
}
function positiveNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
