import { nowIso } from "../utils.ts";
import { runLeasedTask } from "./canaryCollection.ts";

const activeRunIds = new Set<string>();

export async function executeScheduledCollectionRun(options: any, runId: string) {
  if (activeRunIds.has(runId)) return options.store.getRun?.(runId);
  const run = options.store.getRun?.(runId);
  if (!run || !["queued", "running"].includes(run.status)) return run;
  const plan = options.store.getPlan?.(run.planId);
  if (!plan) return failRun(options.store, run, "collection plan missing");

  activeRunIds.add(runId);
  try {
    const generatedAt = nowIso();
    const tasks = (plan.tasks ?? []).map((task: any) => ({ ...task, runId, planId: plan.id, crawlBudgetKey: undefined }));
    const queuedOrLeased = new Set([
      ...options.frontier.snapshot().map((item: any) => (item.task ?? item).id),
      ...options.frontier.leasedSnapshot().map((task: any) => task.id),
    ]);
    for (const task of tasks) if (!queuedOrLeased.has(task.id)) options.frontier.enqueueTask(task);

    const running = options.store.saveRun({
      ...run,
      status: "running",
      startedAt: run.startedAt ?? generatedAt,
      updatedAt: generatedAt,
      taskCount: tasks.length,
      sourceCount: new Set(tasks.map((task: any) => task.sourceId)).size,
      error: undefined,
    });
    if (!tasks.length) return completeRun(options.store, running, emptyCounters(), [], [], generatedAt);

    const counters = emptyCounters();
    const captureIds: string[] = [];
    const errors: any[] = [];
    const dueTaskCount = options.frontier.snapshot().filter((item: any) => {
      const task = item.task ?? item;
      return task.runId === runId && (!task.availableAt || Date.parse(task.availableAt) <= Date.now());
    }).length;
    const concurrency = Math.max(1, Math.min(dueTaskCount, Number(options.maxConcurrentTasks ?? 4)));
    for (let done = 0; done < dueTaskCount; done += concurrency) {
      const waveAt = nowIso();
      await Promise.all(Array.from({ length: Math.min(concurrency, dueTaskCount - done) }, () => runLeasedTask(
        options,
        runId,
        waveAt,
        options.fetch ?? fetch,
        options.fetch ? "injected_proof_fetch" : "native_live_http",
        Number(options.maxBytes ?? 256_000),
        counters,
        captureIds,
        errors,
      )));
    }
    const pending = options.frontier.snapshot()
      .map((item: any) => item.task ?? item)
      .filter((task: any) => task.runId === runId);
    if (pending.length) return deferRun(options.store, running, counters, captureIds, errors, pending);
    return completeRun(options.store, running, counters, captureIds, errors, nowIso());
  } catch (error) {
    return failRun(options.store, run, error instanceof Error ? error.message : String(error));
  } finally {
    activeRunIds.delete(runId);
  }
}

export function recoverCollectionRuns(options: any, now = new Date()) {
  const scheduled: string[] = [];
  const failed: string[] = [];
  for (const run of options.store.listRuns?.() ?? []) {
    if (!["queued", "running"].includes(run.status)) continue;
    const updatedAt = Date.parse(run.updatedAt ?? run.startedAt ?? run.createdAt ?? "");
    const nextAttemptAt = Date.parse(run.nextAttemptAt ?? "");
    const intentionallyDelayed = Number.isFinite(nextAttemptAt) && nextAttemptAt > now.getTime();
    const abandoned = run.requestId === "req_public_canary" || !Number.isFinite(updatedAt) || (!intentionallyDelayed && now.getTime() - updatedAt > 15 * 60_000);
    if (abandoned) {
      failRun(options.store, run, "abandoned collection run recovered during startup", now.toISOString());
      failed.push(run.id);
    } else {
      scheduled.push(run.id);
      options.execute(run.id);
    }
  }
  return { scheduled, failed };
}

function emptyCounters() {
  return { leasedTaskCount: 0, completedTaskCount: 0, failedTaskCount: 0, insertedCaptureCount: 0, duplicateCaptureCount: 0, incidentCount: 0, exposureClaimCount: 0, skippedLowValueCount: 0, retryScheduledCount: 0, retryExhaustedCount: 0 };
}

function completeRun(store: any, run: any, counters: any, captureIds: string[], errors: any[], completedAt: string) {
  const failedTaskCount = (run.failedTaskCount ?? 0) + counters.failedTaskCount;
  const completedTaskCount = (run.completedTaskCount ?? 0) + counters.completedTaskCount;
  const status = failedTaskCount && completedTaskCount ? "degraded" : failedTaskCount ? "failed" : "completed";
  return store.saveRun({
    ...run,
    status,
    completedAt,
    updatedAt: completedAt,
    captureCount: (run.captureCount ?? 0) + counters.insertedCaptureCount,
    duplicateCaptureCount: (run.duplicateCaptureCount ?? 0) + counters.duplicateCaptureCount,
    incidentCount: (run.incidentCount ?? 0) + counters.incidentCount,
    exposureClaimCount: (run.exposureClaimCount ?? 0) + counters.exposureClaimCount,
    skippedLowValueCount: (run.skippedLowValueCount ?? 0) + counters.skippedLowValueCount,
    completedTaskCount,
    failedTaskCount,
    retryScheduledCount: (run.retryScheduledCount ?? 0) + counters.retryScheduledCount,
    retryExhaustedCount: (run.retryExhaustedCount ?? 0) + counters.retryExhaustedCount,
    captureIds: [...new Set([...(run.captureIds ?? []), ...captureIds])],
    error: errors[0]?.message ?? run.error,
  });
}

function deferRun(store: any, run: any, counters: any, captureIds: string[], errors: any[], pending: any[]) {
  const nextAttemptAt = pending.map((task: any) => task.availableAt).filter(Boolean).sort()[0] ?? nowIso();
  return store.saveRun({
    ...run,
    status: "queued",
    updatedAt: nowIso(),
    nextAttemptAt,
    captureCount: (run.captureCount ?? 0) + counters.insertedCaptureCount,
    duplicateCaptureCount: (run.duplicateCaptureCount ?? 0) + counters.duplicateCaptureCount,
    incidentCount: (run.incidentCount ?? 0) + counters.incidentCount,
    completedTaskCount: (run.completedTaskCount ?? 0) + counters.completedTaskCount,
    failedTaskCount: (run.failedTaskCount ?? 0) + counters.failedTaskCount,
    retryScheduledCount: (run.retryScheduledCount ?? 0) + counters.retryScheduledCount,
    retryExhaustedCount: (run.retryExhaustedCount ?? 0) + counters.retryExhaustedCount,
    captureIds: [...new Set([...(run.captureIds ?? []), ...captureIds])],
    error: errors[0]?.message ?? run.error,
  });
}

function failRun(store: any, run: any, message: string, completedAt = nowIso()) {
  return store.saveRun({ ...run, status: "failed", completedAt, updatedAt: completedAt, error: message });
}
