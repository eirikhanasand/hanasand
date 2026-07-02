// @ts-nocheck
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { saveExposureClaimFromCollectedItem } from "../api/exposureQueueRoutes.ts";
import { nowIso, stableId } from "../utils.ts";
import { activatePublicCanarySources, pausePublicCanarySources } from "./canaryActivation.ts";
import { canaryQueries, PUBLIC_CANARY_SOURCE_PORTFOLIO } from "./canaryPortfolio.ts";
import { detachedState, externalize, fetchItems, health, maxItemsFor, taskFor } from "./canaryHelpers.ts";
import { isSellableIntelText, sellableReason } from "../value/sellableIntel.ts";
export { activatePublicCanarySources, pausePublicCanarySources } from "./canaryActivation.ts"; export { PUBLIC_CANARY_SOURCE_PORTFOLIO } from "./canaryPortfolio.ts";
export { buildCanaryOperatorConsoleHtml, buildCanaryOperatorSummary, buildCanaryReadinessPacket, buildCanarySoakReport } from "./canaryReports.ts";
export type * from "./canaryCollectionTypes.ts";
import type { CanaryCollectionCycleResult, CanaryCollectionLoopHandle, CanaryCollectionOptions } from "./canaryCollectionTypes.ts";
export async function runCanaryCollectionCycle(options: CanaryCollectionOptions): Promise<CanaryCollectionCycleResult> {
  if (options.store.batch && !options.batched) return options.store.batch(() => runCanaryCollectionCycle({ ...options, batched: true }));
  const generatedAt = options.now?.() ?? nowIso(), fetcher = options.fetch ?? fetch, mode = options.fetch ? "injected_proof_fetch" : "native_live_http";
  const activation = options.activateSources ? activatePublicCanarySources({ ...options, now: generatedAt }) : { activated: [], alreadyActive: [], rejected: [] };
  const maxSources = Math.max(1, options.maxSources ?? 10), maxTasks = Math.max(1, options.maxTasks ?? 5), maxBytes = Math.max(1024, options.maxBytes ?? 512_000);
  const due = options.store.listSources().filter((s: any) => isProductionCollectionSource(s, generatedAt)).slice(0, maxSources);
  const planId = stableId("canary-plan", generatedAt), runId = stableId("canary-run", planId), tasks = due.map((s: any) => taskFor(s, generatedAt, runId, maxBytes));
  options.store.savePlan?.({ id: planId, requestId: "req_public_canary", createdAt: generatedAt, tasks, request: { query: canaryQueries }, reviewRequired: [], rejected: activation.rejected, audit: [] });
  options.store.saveRun?.({ id: runId, planId, requestId: "req_public_canary", status: "running", createdAt: generatedAt, updatedAt: generatedAt, taskCount: tasks.length, reviewTaskCount: 0, rejectedSourceCount: activation.rejected.length, captureCount: 0, incidentCount: 0 });
  for (const task of tasks) options.frontier.enqueueTask(task);
  const counters: any = { leasedTaskCount: 0, completedTaskCount: 0, failedTaskCount: 0, insertedCaptureCount: 0, duplicateCaptureCount: 0, incidentCount: 0, exposureClaimCount: 0, skippedLowValueCount: 0, retryScheduledCount: 0, retryExhaustedCount: 0 };
  const latestCaptureIds: string[] = [], errors: any[] = [];
  const concurrency = Math.max(1, Math.min(maxTasks, Number(options.maxConcurrentTasks ?? 5)));
  for (let done = 0; done < maxTasks; done += concurrency) await Promise.all(Array.from({ length: Math.min(concurrency, maxTasks - done) }, () => runLeasedTask(options, runId, generatedAt, fetcher, mode, maxBytes, counters, latestCaptureIds, errors)));
  options.store.saveRun?.({ id: runId, planId, requestId: "req_public_canary", status: counters.failedTaskCount ? "failed" : "completed", createdAt: generatedAt, updatedAt: generatedAt, taskCount: tasks.length, sourceCount: due.length, captureCount: counters.insertedCaptureCount, incidentCount: counters.incidentCount, exposureClaimCount: counters.exposureClaimCount, skippedLowValueCount: counters.skippedLowValueCount, failedTaskCount: counters.failedTaskCount, completedTaskCount: counters.completedTaskCount, error: errors[0]?.message });
  return { generatedAt, mode: "production_canary", runId, planId, activationApplied: Boolean(options.activateSources), activatedSourceCount: activation.activated.length + activation.alreadyActive.length, activeSourceCount: due.length, queuedTaskCount: tasks.length, ...counters, remainingQueuedTaskCount: options.frontier.snapshot().filter((i: any) => i.task.runId === runId).length, latestCaptureIds, errors, health: health(options.store, generatedAt, counters) };
}
export function startCanaryCollectionLoop(options: CanaryCollectionOptions & { enabled?: boolean; intervalSeconds?: number; queueLimit?: number; onCycle?: (r: any) => void; onError?: (e: unknown) => void }): CanaryCollectionLoopHandle {
  const state = detachedState(nowIso(), options.queueLimit ?? 500), intervalMs = Math.max(5, options.intervalSeconds ?? 300) * 1000; let timer: Timer | undefined, startupTimer: Timer | undefined;
  const cycle = async () => { if (!state.enabled || state.running) return; state.running = true; state.lastCycleAt = nowIso(); try { const result = await runCanaryCollectionCycle(options); state.latestResult = result; state.successCount++; state.lastSuccessAt = result.generatedAt; options.onCycle?.(result); } catch (e) { state.errorCount++; state.consecutiveErrorCount++; state.lastError = e instanceof Error ? e.message : String(e); state.lastErrorAt = nowIso(); options.onError?.(e); } finally { state.running = false; state.cycleCount++; state.nextCycleAt = new Date(Date.now() + intervalMs).toISOString(); } };
  Object.assign(state, { enabled: options.enabled !== false, intervalSeconds: options.intervalSeconds ?? 300, maxSources: options.maxSources ?? 10, maxTasks: options.maxTasks ?? 5, maxBytes: options.maxBytes ?? 512_000, timeoutMs: options.timeoutMs ?? 30_000, queueLimit: options.queueLimit ?? 500, activateSources: Boolean(options.activateSources) });
  if (state.enabled) {
    state.nextCycleAt = new Date(Date.now() + 1_000).toISOString();
    startupTimer = setTimeout(cycle, 1_000);
    timer = setInterval(cycle, intervalMs);
  }
  return { stop: () => { if (startupTimer) clearTimeout(startupTimer); if (timer) clearInterval(timer); state.enabled = false; }, getState: () => ({ ...state }) };
}
async function runLeasedTask(options: any, runId: string, generatedAt: string, fetcher: any, mode: string, maxBytes: number, counters: any, latestCaptureIds: string[], errors: any[]) {
  const leased = options.frontier.next(new Date(generatedAt), (task: any) => task.runId === runId); if (!leased) return;
  const task = leased.task, source = options.store.getSource?.(task.sourceId); counters.leasedTaskCount++;
  try {
    if (!source) throw new Error("source missing");
    const collectedItems = await fetchItems(source, task, fetcher, mode, generatedAt, maxBytes, options.timeoutMs ?? 12_000);
    for (const collected of collectedItems.slice(0, itemLimit(source, options))) {
      if (!isSellableIntelText({ text: collected.rawText, title: collected.title, sourceId: collected.sourceId, publishedAt: collected.publishedAt, collectedAt: collected.collectedAt, now: generatedAt })) { counters.skippedLowValueCount++; continue; } collected.metadata = { ...collected.metadata, sellableCandidate: true, sellableReason: sellableReason(collected.rawText) };
      let pipeline = processCollectedItem(collected);
      if (pipeline.capture.body && options.objectStore) pipeline = { ...pipeline, capture: externalize(pipeline.capture, options.objectStore) };
      const duplicate = options.store.findDuplicateCapture?.(pipeline.capture), saved = options.store.savePipelineResult(pipeline);
      duplicate && duplicate.id !== pipeline.capture.id ? counters.duplicateCaptureCount++ : counters.insertedCaptureCount++;
      if (saved.incident) counters.incidentCount++;
      if (await saveExposureClaimFromCollectedItem(options.store, collected, generatedAt)) counters.exposureClaimCount++;
      latestCaptureIds.push(saved.capture.id);
    }
    counters.completedTaskCount++; options.frontier.complete(task);
    options.store.saveSource({ ...source, crawlState: { ...(source.crawlState ?? {}), lastCollectedAt: generatedAt, nextEligibleAt: new Date(Date.parse(generatedAt) + (source.crawlFrequencySeconds ?? 3600) * 1000).toISOString() }, metadata: { ...(source.metadata ?? {}), lastCanaryFetchMode: mode }, updatedAt: generatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error); counters.failedTaskCount++; errors.push({ taskId: task.id, sourceId: task.sourceId, message });
    const ack = options.frontier.fail(task, new Date(generatedAt), message); if (ack?.status === "retry_scheduled") counters.retryScheduledCount++; if (ack?.status === "retry_exhausted") counters.retryExhaustedCount++;
    if (source) {
      const retryCount = (source.crawlState?.retryCount ?? 0) + 1;
      const backoffSeconds = Math.min(86_400, Math.max(300, retryCount * retryCount * 300));
      options.store.saveSource({
        ...source,
        crawlState: {
          ...(source.crawlState ?? {}),
          retryCount,
          lastErrorAt: generatedAt,
          lastError: message,
          nextEligibleAt: ack?.status === "retry_exhausted"
            ? new Date(Date.parse(generatedAt) + 86_400_000).toISOString()
            : new Date(Date.parse(generatedAt) + backoffSeconds * 1000).toISOString()
        },
        updatedAt: generatedAt
      });
    }
  }
}
function itemLimit(source: any, options: any) { return maxItemsFor(source) ?? options.maxItemsPerTask ?? 40; }
function isProductionCollectionSource(source: any, generatedAt: string) {
  if (!["active", "canary"].includes(source.status)) return false;
  if (!/^https?:\/\//.test(source.url)) return false;
  if (source.metadata?.productionCollection === false) return false;
  const nextEligibleAt = source.crawlState?.nextEligibleAt;
  return !nextEligibleAt || Date.parse(nextEligibleAt) <= Date.parse(generatedAt);
}
