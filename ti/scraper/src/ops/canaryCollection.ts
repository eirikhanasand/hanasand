// @ts-nocheck
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { nowIso, stableId } from "../utils.ts";
import { activatePublicCanarySources, pausePublicCanarySources } from "./canaryActivation.ts";
import { canaryQueries, PUBLIC_CANARY_SOURCE_PORTFOLIO } from "./canaryPortfolio.ts";
import { detachedState, externalize, fetchItem, health, taskFor } from "./canaryHelpers.ts";
export { activatePublicCanarySources, pausePublicCanarySources } from "./canaryActivation.ts";
export { PUBLIC_CANARY_SOURCE_PORTFOLIO } from "./canaryPortfolio.ts";
export { buildCanaryOperatorConsoleHtml, buildCanaryOperatorSummary, buildCanaryReadinessPacket, buildCanarySoakReport } from "./canaryReports.ts";
export type * from "./canaryCollectionTypes.ts";
import type { CanaryCollectionCycleResult, CanaryCollectionLoopHandle, CanaryCollectionOptions } from "./canaryCollectionTypes.ts";

export async function runCanaryCollectionCycle(options: CanaryCollectionOptions): Promise<CanaryCollectionCycleResult> {
  const generatedAt = options.now?.() ?? nowIso(), fetcher = options.fetch ?? fetch, mode = options.fetch ? "injected_proof_fetch" : "native_live_http";
  const activation = options.activateSources ? activatePublicCanarySources({ ...options, now: generatedAt }) : { activated: [], alreadyActive: [], rejected: [] };
  const maxSources = Math.max(1, options.maxSources ?? 10), maxTasks = Math.max(1, options.maxTasks ?? 5), maxBytes = Math.max(1024, options.maxBytes ?? 512_000);
  const due = options.store.listSources().filter((s: any) => s.status === "active" && s.metadata?.canaryPortfolio && /^https?:\/\//.test(s.url)).slice(0, maxSources);
  const planId = stableId("canary-plan", generatedAt), runId = stableId("canary-run", planId), tasks = due.map((s: any) => taskFor(s, generatedAt, runId, maxBytes));
  options.store.savePlan?.({ id: planId, requestId: "req_public_canary", createdAt: generatedAt, tasks, request: { query: canaryQueries }, reviewRequired: [], rejected: activation.rejected, audit: [] });
  options.store.saveRun?.({ id: runId, planId, requestId: "req_public_canary", status: "running", createdAt: generatedAt, updatedAt: generatedAt, taskCount: tasks.length, reviewTaskCount: 0, rejectedSourceCount: activation.rejected.length, captureCount: 0, incidentCount: 0 });
  for (const task of tasks) options.frontier.enqueueTask(task);
  const counters: any = { leasedTaskCount: 0, completedTaskCount: 0, failedTaskCount: 0, insertedCaptureCount: 0, duplicateCaptureCount: 0, incidentCount: 0, retryScheduledCount: 0, retryExhaustedCount: 0 };
  const latestCaptureIds: string[] = [], errors: any[] = [];
  for (let i = 0; i < maxTasks; i++) await runLeasedTask(options, generatedAt, fetcher, mode, maxBytes, counters, latestCaptureIds, errors);
  options.store.saveRun?.({ id: runId, planId, requestId: "req_public_canary", status: counters.failedTaskCount ? "failed" : "completed", createdAt: generatedAt, updatedAt: generatedAt, taskCount: tasks.length, captureCount: counters.insertedCaptureCount, incidentCount: counters.incidentCount, error: errors[0]?.message });
  return { generatedAt, mode: "production_canary", runId, planId, activationApplied: Boolean(options.activateSources), activatedSourceCount: activation.activated.length + activation.alreadyActive.length, activeSourceCount: due.length, queuedTaskCount: tasks.length, ...counters, remainingQueuedTaskCount: options.frontier.snapshot().filter((i: any) => i.task.runId === runId).length, latestCaptureIds, errors, health: health(options.store, generatedAt, counters) };
}

export function startCanaryCollectionLoop(options: CanaryCollectionOptions & { enabled?: boolean; intervalSeconds?: number; queueLimit?: number; onCycle?: (r: any) => void; onError?: (e: unknown) => void }): CanaryCollectionLoopHandle {
  const state = detachedState(nowIso(), options.queueLimit ?? 500), intervalMs = Math.max(5, options.intervalSeconds ?? 300) * 1000; let timer: Timer | undefined;
  const cycle = async () => { if (!state.enabled || state.running) return; state.running = true; state.lastCycleAt = nowIso(); try { const result = await runCanaryCollectionCycle(options); state.latestResult = result; state.successCount++; state.lastSuccessAt = result.generatedAt; options.onCycle?.(result); } catch (e) { state.errorCount++; state.consecutiveErrorCount++; state.lastError = e instanceof Error ? e.message : String(e); state.lastErrorAt = nowIso(); options.onError?.(e); } finally { state.running = false; state.cycleCount++; state.nextCycleAt = new Date(Date.now() + intervalMs).toISOString(); } };
  Object.assign(state, { enabled: options.enabled !== false, intervalSeconds: options.intervalSeconds ?? 300, maxSources: options.maxSources ?? 10, maxTasks: options.maxTasks ?? 5, maxBytes: options.maxBytes ?? 512_000, timeoutMs: options.timeoutMs ?? 30_000, queueLimit: options.queueLimit ?? 500, activateSources: Boolean(options.activateSources) });
  if (state.enabled) timer = setInterval(cycle, intervalMs);
  return { stop: () => { if (timer) clearInterval(timer); state.enabled = false; }, getState: () => ({ ...state }) };
}

async function runLeasedTask(options: any, generatedAt: string, fetcher: any, mode: string, maxBytes: number, counters: any, latestCaptureIds: string[], errors: any[]) {
  const leased = options.frontier.next(new Date(generatedAt)); if (!leased) return;
  const task = leased.task, source = options.store.getSource?.(task.sourceId); counters.leasedTaskCount++;
  try {
    if (!source) throw new Error("source missing");
    const collected = await fetchItem(source, task, fetcher, mode, generatedAt, maxBytes);
    let pipeline = processCollectedItem(collected);
    if (pipeline.capture.body && options.objectStore) pipeline = { ...pipeline, capture: externalize(pipeline.capture, options.objectStore) };
    const duplicate = options.store.findDuplicateCapture?.(pipeline.capture), saved = options.store.savePipelineResult(pipeline);
    duplicate && duplicate.id !== pipeline.capture.id ? counters.duplicateCaptureCount++ : counters.insertedCaptureCount++;
    if (saved.incident) counters.incidentCount++;
    latestCaptureIds.push(saved.capture.id); counters.completedTaskCount++; options.frontier.complete(task);
    options.store.saveSource({ ...source, crawlState: { ...(source.crawlState ?? {}), lastCollectedAt: generatedAt, nextEligibleAt: new Date(Date.parse(generatedAt) + (source.crawlFrequencySeconds ?? 3600) * 1000).toISOString() }, metadata: { ...(source.metadata ?? {}), lastCanaryFetchMode: mode }, updatedAt: generatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error); counters.failedTaskCount++; errors.push({ taskId: task.id, sourceId: task.sourceId, message });
    const ack = options.frontier.fail(task, new Date(generatedAt), message); if (ack?.status === "retry_scheduled") counters.retryScheduledCount++; if (ack?.status === "retry_exhausted") counters.retryExhaustedCount++;
  }
}
