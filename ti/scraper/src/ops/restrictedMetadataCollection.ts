import { DarknetMetadataAdapter } from "../adapters/darknetMetadataAdapter.ts";
import { evaluateSourceForCollection } from "../policy/collectionPolicy.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { nowIso, stableId } from "../utils.ts";

export async function runRestrictedMetadataCollectionCycle(options: any) {
  const generatedAt = options.now?.() ?? nowIso();
  const sources = options.store.listSources().filter((source: any) => due(source, generatedAt)).slice(0, Math.max(1, Math.min(2, options.maxSources ?? 2)));
  const runId = stableId("restricted-run", generatedAt);
  const counters = { sourceCount: sources.length, completedSourceCount: 0, failedSourceCount: 0, captureCount: 0, duplicateCount: 0, incidentCount: 0 };
  options.store.saveRun?.({ id: runId, requestId: "restricted_metadata_scheduler", status: "running", createdAt: generatedAt, startedAt: generatedAt, updatedAt: generatedAt, sourceCount: sources.length, taskCount: sources.length, captureCount: 0, incidentCount: 0 });

  for (const source of sources) {
    const task = { id: stableId("restricted-task", `${source.id}:${generatedAt}`), tenantId: source.tenantId, sourceId: source.id, sourceType: source.type, targetUrl: source.url, queuedAt: generatedAt, retryCount: source.crawlState?.retryCount ?? 0, maxBytes: 64_000, runId };
    const started = Date.now();
    try {
      const result = await new DarknetMetadataAdapter(source.type, options.boundary).collect(source, task);
      if (!result.items.length) throw new Error(result.warnings?.[0] ?? "restricted metadata parser returned no records");
      let useful = false;
      for (const item of result.items) {
        item.tenantId = source.tenantId;
        const pipeline = processCollectedItem(item);
        const duplicate = options.store.findDuplicateCapture?.(pipeline.capture);
        const saved = options.store.savePipelineResult(pipeline);
        if (duplicate) counters.duplicateCount++; else { counters.captureCount++; useful = true; }
        if (saved.incident) counters.incidentCount++;
      }
      counters.completedSourceCount++;
      const checkedAt = options.now?.() ?? nowIso();
      options.store.saveSourceHealthObservation?.(observation(source, runId, task.id, checkedAt, Date.now() - started, true, useful, result.items.length));
      options.store.saveSource({ ...source, health: { ...(source.health ?? {}), status: "healthy", checkedAt, lastSuccessAt: checkedAt, lastUsefulAt: useful ? checkedAt : source.health?.lastUsefulAt, consecutiveFailures: 0, lastError: undefined }, crawlState: { ...(source.crawlState ?? {}), retryCount: 0, lastCollectedAt: checkedAt, nextEligibleAt: new Date(Date.parse(checkedAt) + cadence(source) * 1_000).toISOString(), lastError: undefined, backoffUntil: undefined }, updatedAt: checkedAt });
    } catch (caught) {
      counters.failedSourceCount++;
      const checkedAt = options.now?.() ?? nowIso(), message = safeError(caught), retryCount = (source.crawlState?.retryCount ?? 0) + 1;
      options.store.saveSourceHealthObservation?.(observation(source, runId, task.id, checkedAt, Date.now() - started, false, false, 0, message, (caught as any)?.httpStatus));
      options.store.saveSource({ ...source, health: { ...(source.health ?? {}), status: retryCount >= 5 ? "failing" : "degraded", checkedAt, lastFailureAt: checkedAt, consecutiveFailures: retryCount, lastError: message }, crawlState: { ...(source.crawlState ?? {}), retryCount, lastError: message, lastErrorAt: checkedAt, backoffUntil: new Date(Date.parse(checkedAt) + Math.min(86_400, retryCount * retryCount * 900) * 1_000).toISOString() }, updatedAt: checkedAt });
    }
  }

  const completedAt = options.now?.() ?? nowIso();
  const status = counters.failedSourceCount ? counters.completedSourceCount ? "degraded" : "failed" : "completed";
  options.store.saveRun?.({ id: runId, requestId: "restricted_metadata_scheduler", status, createdAt: generatedAt, startedAt: generatedAt, completedAt, updatedAt: completedAt, taskCount: sources.length, ...counters });
  return { schemaVersion: "ti.restricted_metadata_cycle.v1", runId, generatedAt, status, ...counters, metadataOnly: true };
}

export function startRestrictedMetadataCollectionLoop(options: any) {
  const intervalSeconds = Math.max(60, Number(options.intervalSeconds ?? 900));
  const state: any = { enabled: options.enabled === true, running: false, intervalSeconds, cycleCount: 0, successCount: 0, errorCount: 0 };
  let startup: Timer | undefined, timer: Timer | undefined;
  const cycle = async () => {
    if (!state.enabled || state.running) return;
    state.running = true; state.lastCycleAt = nowIso();
    try { state.latestResult = await runRestrictedMetadataCollectionCycle(options); state.successCount++; state.lastSuccessAt = nowIso(); }
    catch (caught) { state.errorCount++; state.lastError = safeError(caught); state.lastErrorAt = nowIso(); options.onError?.(caught); }
    finally { state.running = false; state.cycleCount++; state.nextCycleAt = state.enabled ? new Date(Date.now() + intervalSeconds * 1_000).toISOString() : undefined; }
  };
  if (state.enabled) { state.nextCycleAt = new Date(Date.now() + 2_000).toISOString(); startup = setTimeout(cycle, 2_000); }
  timer = setInterval(cycle, intervalSeconds * 1_000);
  return { stop: () => { if (startup) clearTimeout(startup); if (timer) clearInterval(timer); state.enabled = false; state.nextCycleAt = undefined; }, runOnce: cycle, getState: () => ({ ...state }) };
}

function due(source: any, generatedAt: string) {
  if (!["tor_metadata"].includes(source.type) || !evaluateSourceForCollection(source).allowed) return false;
  const eligible = source.crawlState?.backoffUntil ?? source.crawlState?.nextEligibleAt;
  return !eligible || Date.parse(eligible) <= Date.parse(generatedAt);
}
function cadence(source: any) { return Math.max(900, Number(source.crawlFrequencySeconds ?? (source.crawlFrequencyMinutes ?? 60) * 60)); }
function observation(source: any, runId: string, taskId: string, checkedAt: string, latencyMs: number, success: boolean, useful: boolean, itemCount: number, failureReason?: string, httpStatus?: number) { return { id: stableId("source-health", `${runId}:${taskId}`), tenantId: source.tenantId, sourceId: source.id, collectionRunId: runId, taskId, checkedAt, status: success ? "healthy" : "failed", success, useful, httpStatus: Number.isInteger(httpStatus) ? httpStatus : undefined, latencyMs: Math.max(0, latencyMs), itemCount, captureCount: success && useful ? itemCount : 0, incidentCount: 0, duplicateCount: success && !useful ? itemCount : 0, parserWarningCount: 0, observedActorCount: source.metadata?.actorName || source.metadata?.actors?.length ? 1 : 0, adapterFailureCategory: success ? undefined : failureCategory(failureReason), failureReason, legalMode: "metadata_only" }; }
function failureCategory(message?: string) { return !message ? undefined : /timeout|abort/i.test(message) ? "timeout" : /HTTP 429/i.test(message) ? "rate_limited" : /HTTP 5\d\d/i.test(message) ? "upstream_failure" : /HTTP 4\d\d/i.test(message) ? "source_rejected" : /parser|record/i.test(message) ? "parser_failure" : /proxy|onion|policy|target/i.test(message) ? "policy_blocked" : "collection_failure"; }
function safeError(caught: unknown) { return (caught instanceof Error ? caught.message : String(caught)).replace(/\bhttps?:\/\/\S+/gi, "[redacted-url]").replace(/\b[a-z2-7]{56}\.onion\b/gi, "[restricted-host]").slice(0, 500); }
