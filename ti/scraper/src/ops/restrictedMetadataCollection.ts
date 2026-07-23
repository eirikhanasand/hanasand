import { DarknetMetadataAdapter } from "../adapters/darknetMetadataAdapter.ts";
import { sourceCollectionLane } from "../policy/collectionPolicy.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { nowIso, stableId } from "../utils.ts";
import { reconcilePublicSourceProductivity } from "./canaryActivation.ts";
import { isCurrentSourcePortfolioVerification } from "../registry/sourcePortfolioBatch.ts";
import { sourceMonitoringWindowSeconds } from "../policy/sourceActivityWindow.ts";

export async function runRestrictedMetadataCollectionCycle(options: any) {
  const generatedAt = options.now?.() ?? nowIso();
  const productivity = reconcilePublicSourceProductivity({ ...options, now: generatedAt });
  const maxSources = Math.max(1, Number(options.maxSources ?? 250));
  const maxConcurrentSources = Math.max(1, Math.min(
    Number(options.boundary?.config?.maxConcurrency ?? 2),
    Number(options.maxConcurrentSources ?? 2)
  ));
  const sources = options.store.listSources()
    .filter((source: any) => due(source, generatedAt))
    .sort((left: any, right: any) => sourceScheduleTime(left) - sourceScheduleTime(right) || String(left.id).localeCompare(String(right.id)))
    .slice(0, maxSources);
  const runId = stableId("restricted-run", generatedAt);
  const counters = { sourceCount: sources.length, intelligenceSourceCount: sources.filter((source: any) => !source.metadata?.transportCanary).length, transportProbeCount: sources.filter((source: any) => source.metadata?.transportCanary).length, completedSourceCount: 0, failedSourceCount: 0, captureCount: 0, duplicateCount: 0, incidentCount: 0 };
  options.store.saveRun?.({ id: runId, requestId: "restricted_metadata_scheduler", status: "running", createdAt: generatedAt, startedAt: generatedAt, updatedAt: generatedAt, sourceCount: sources.length, taskCount: sources.length, captureCount: 0, incidentCount: 0 });

  for (let offset = 0; offset < sources.length; offset += maxConcurrentSources) {
    await Promise.all(sources.slice(offset, offset + maxConcurrentSources).map(async (source: any) => {
    const task = { id: stableId("restricted-task", `${source.id}:${generatedAt}`), tenantId: source.tenantId, sourceId: source.id, sourceType: source.type, targetUrl: source.url, queuedAt: generatedAt, retryCount: source.crawlState?.retryCount ?? 0, maxBytes: 64_000, runId };
    const started = Date.now();
    try {
      const collectionSource = governedCandidate(source, generatedAt)
        ? { ...source, status: "probation", metadata: { ...(source.metadata ?? {}), productionCollection: true } }
        : source;
      const result = await new DarknetMetadataAdapter(source.type, options.boundary).collect(collectionSource, task);
      if (!result.items.length) throw new Error(result.warnings?.[0] ?? "restricted metadata parser returned no records");
      if (!source.metadata?.transportCanary && !result.items.some(hasUsefulVictimMetadata)) throw new Error("restricted metadata parser returned no useful victim metadata");
      let useful = false, sourceCaptureCount = 0, sourceDuplicateCount = 0;
      const productiveContentTimes: string[] = [];
      for (const item of result.items) {
        item.tenantId = source.tenantId;
        item.metadata = { ...(item.metadata ?? {}), runId };
        const pipeline = processCollectedItem(item, { actorIdentities: options.store.listActorIdentities?.() ?? [] });
        const duplicate = options.store.findDuplicateCapture?.(pipeline.capture);
        const saved = source.metadata?.transportCanary ? { capture: options.store.saveCapture(pipeline.capture) } : options.store.savePipelineResult(pipeline);
        if (duplicate) {
          counters.duplicateCount++;
          sourceDuplicateCount++;
        } else {
          counters.captureCount++;
          sourceCaptureCount++;
          useful ||= !source.metadata?.transportCanary && hasUsefulVictimMetadata(item);
          if (item.publishedAt ?? item.collectedAt) productiveContentTimes.push(item.publishedAt ?? item.collectedAt);
        }
        if (saved.incident) counters.incidentCount++;
      }
      counters.completedSourceCount++;
      const checkedAt = options.now?.() ?? nowIso();
      const lastContentAt = useful
        ? productiveContentTimes.sort().at(-1) ?? checkedAt
        : source.health?.lastContentAt;
      options.store.saveSourceHealthObservation?.(observation(source, runId, task.id, checkedAt, Date.now() - started, true, useful, result.items.length, undefined, undefined, sourceCaptureCount, sourceDuplicateCount));
      const transportCanary = source.metadata?.transportCanary === true;
      const productiveCycles = transportCanary ? [] : currentProductiveCycles(options.store, source, checkedAt);
      const sustained = productiveCycles.length >= 2;
      const metadata = {
        ...(source.metadata ?? {})
      };
      if (transportCanary) {
        delete metadata.sourcePortfolioQualificationState;
        delete metadata.sourcePortfolioProductiveCheckCount;
        delete metadata.sourcePortfolioLastProductiveAt;
        metadata.countsAsCoverage = false;
      } else {
        metadata.sourcePortfolioQualificationState = sustained ? "sustained_productive" : "pending_sustained_productivity";
        metadata.sourcePortfolioProductiveCheckCount = productiveCycles.length;
        metadata.sourcePortfolioLastProductiveAt = productiveCycles.at(-1)?.checkedAt;
      }
      if (!transportCanary && sustained) {
        metadata.productionCollection = true;
        metadata.countsAsCoverage = true;
        delete metadata.restrictedMetadataCandidate;
      }
      options.store.saveSource({ ...source, status: sustained ? "active" : source.status, countsAsCoverage: !transportCanary && sustained, lastSeenAt: lastContentAt ?? source.lastSeenAt, health: { ...(source.health ?? {}), status: "healthy", checkedAt, lastSuccessAt: checkedAt, lastContentAt, lastUsefulAt: useful ? checkedAt : source.health?.lastUsefulAt, consecutiveFailures: 0, lastError: undefined }, metadata, crawlState: { ...(source.crawlState ?? {}), retryCount: 0, lastCollectedAt: checkedAt, nextEligibleAt: new Date(Date.parse(checkedAt) + cadence(source) * 1_000).toISOString(), lastError: undefined, backoffUntil: undefined }, updatedAt: checkedAt });
    } catch (caught) {
      counters.failedSourceCount++;
      const checkedAt = options.now?.() ?? nowIso(), message = safeError(caught), retryCount = (source.crawlState?.retryCount ?? 0) + 1;
      options.store.saveSourceHealthObservation?.(observation(source, runId, task.id, checkedAt, Date.now() - started, false, false, 0, message, (caught as any)?.httpStatus));
      options.store.saveSource({ ...source, health: { ...(source.health ?? {}), status: retryCount >= 5 ? "failing" : "degraded", checkedAt, lastFailureAt: checkedAt, consecutiveFailures: retryCount, lastError: message }, crawlState: { ...(source.crawlState ?? {}), retryCount, lastError: message, lastErrorAt: checkedAt, backoffUntil: new Date(Date.parse(checkedAt) + Math.min(86_400, retryCount * retryCount * 900) * 1_000).toISOString() }, updatedAt: checkedAt });
    }
    }));
  }

  const completedAt = options.now?.() ?? nowIso();
  const status = counters.failedSourceCount ? counters.completedSourceCount ? "degraded" : "failed" : "completed";
  options.store.saveRun?.({ id: runId, requestId: "restricted_metadata_scheduler", status, createdAt: generatedAt, startedAt: generatedAt, completedAt, updatedAt: completedAt, taskCount: sources.length, ...counters });
  return { schemaVersion: "ti.restricted_metadata_cycle.v1", runId, generatedAt, status, maxSources, maxConcurrentSources, retiredSourceCount: productivity.retired.length, ...counters, metadataOnly: true };
}

export function startRestrictedMetadataCollectionLoop(options: any) {
  const intervalSeconds = Math.max(60, Number(options.intervalSeconds ?? 900));
  const state: any = {
    enabled: options.enabled === true,
    running: false,
    intervalSeconds,
    maxSources: Math.max(1, Number(options.maxSources ?? 250)),
    maxConcurrentSources: Math.max(1, Math.min(Number(options.boundary?.config?.maxConcurrency ?? 2), Number(options.maxConcurrentSources ?? 2))),
    cycleCount: 0,
    successCount: 0,
    errorCount: 0
  };
  let startup: Timer | undefined, timer: Timer | undefined, active: Promise<void> | undefined;
  const cycle = () => {
    if (!state.enabled || active) return active ?? Promise.resolve();
    state.running = true; state.lastCycleAt = nowIso();
    active = (async () => {
      try {
        state.latestResult = await runRestrictedMetadataCollectionCycle(options);
        state.successCount++;
        state.lastSuccessAt = nowIso();
        state.failedSourceCount = state.latestResult.failedSourceCount;
        state.lastSourceFailureAt = state.latestResult.failedSourceCount ? state.lastSuccessAt : undefined;
      }
      catch (caught) { state.errorCount++; state.lastError = safeError(caught); state.lastErrorAt = nowIso(); options.onError?.(caught); }
      finally { state.running = false; state.cycleCount++; state.nextCycleAt = state.enabled ? new Date(Date.now() + intervalSeconds * 1_000).toISOString() : undefined; active = undefined; }
    })();
    return active;
  };
  if (state.enabled) { state.nextCycleAt = new Date(Date.now() + 2_000).toISOString(); startup = setTimeout(cycle, 2_000); }
  timer = setInterval(cycle, intervalSeconds * 1_000);
  return { stop: async () => { if (startup) clearTimeout(startup); if (timer) clearInterval(timer); state.enabled = false; state.nextCycleAt = undefined; await active; }, runOnce: cycle, getState: () => ({ ...state }) };
}

function due(source: any, generatedAt: string) {
  if (sourceCollectionLane(source) !== "restricted_metadata" && !governedCandidate(source, generatedAt)) return false;
  const eligible = source.crawlState?.backoffUntil ?? source.crawlState?.nextEligibleAt;
  return !eligible || Date.parse(eligible) <= Date.parse(generatedAt);
}
function governedCandidate(source: any, generatedAt: string) {
  return source.type === "tor_metadata"
    && source.status === "candidate"
    && source.accessMethod === "approved_proxy"
    && ["high", "restricted"].includes(source.risk)
    && source.governance?.approvalState === "approved"
    && source.governance?.metadataOnly === true
    && source.metadata?.restrictedMetadataCandidate === true
    && source.metadata?.productionCollection === false
    && isCurrentSourcePortfolioVerification(source, generatedAt);
}
function currentProductiveCycles(store: any, source: any, generatedAt: string) {
  const now = Date.parse(generatedAt);
  const windowSeconds = sourceMonitoringWindowSeconds(source);
  const byRun = new Map<string, any>();
  for (const row of store.listSourceHealthObservations?.() ?? []) {
    if (row.sourceId === source.id
      && row.tenantId === source.tenantId
      && typeof row.collectionRunId === "string"
      && Number(row.captureCount ?? 0) > 0
      && Number.isFinite(Date.parse(row.checkedAt))
      && now - Date.parse(row.checkedAt) >= 0
      && now - Date.parse(row.checkedAt) <= windowSeconds * 1_000) {
      const previous = byRun.get(row.collectionRunId);
      if (!previous || Date.parse(row.checkedAt) > Date.parse(previous.checkedAt)) byRun.set(row.collectionRunId, row);
    }
  }
  return [...byRun.values()].sort((left: any, right: any) => Date.parse(left.checkedAt) - Date.parse(right.checkedAt));
}
function cadence(source: any) { return Math.max(900, Number(source.crawlFrequencySeconds ?? (source.crawlFrequencyMinutes ?? 60) * 60)); }
function sourceScheduleTime(source: any) { return Date.parse(source.health?.checkedAt ?? source.crawlState?.lastCollectedAt ?? source.updatedAt ?? source.createdAt ?? "") || 0; }
function hasUsefulVictimMetadata(item: any) { const leakSite = item.metadata?.leakSite; return typeof leakSite?.victimName === "string" && leakSite.victimName.trim().length > 1 || Array.isArray(leakSite?.victimNames) && leakSite.victimNames.some((name: unknown) => typeof name === "string" && name.trim().length > 1); }
function observation(source: any, runId: string, taskId: string, checkedAt: string, latencyMs: number, success: boolean, useful: boolean, itemCount: number, failureReason?: string, httpStatus?: number, captureCount = 0, duplicateCount = 0) { const category = success ? undefined : failureCategory(failureReason); return { id: stableId("source-health", `${runId}:${taskId}`), tenantId: source.tenantId, sourceId: source.id, collectionRunId: runId, taskId, checkedAt, status: success ? "healthy" : "failed", success, useful, httpStatus: Number.isInteger(httpStatus) ? httpStatus : undefined, latencyMs: Math.max(0, latencyMs), itemCount, captureCount, incidentCount: 0, duplicateCount, parserWarningCount: category === "parser_failure" ? 1 : 0, observedActorCount: source.metadata?.transportCanary ? 0 : source.metadata?.actorName || source.metadata?.actors?.length ? 1 : 0, adapterFailureCategory: category, failureReason, legalMode: "metadata_only" }; }
function failureCategory(message?: string) { return !message ? undefined : /timeout|abort/i.test(message) ? "timeout" : /HTTP 429/i.test(message) ? "rate_limited" : /HTTP 5\d\d/i.test(message) ? "upstream_failure" : /HTTP 4\d\d/i.test(message) ? "source_rejected" : /parser|record/i.test(message) ? "parser_failure" : /proxy|onion|policy|target/i.test(message) ? "policy_blocked" : "collection_failure"; }
function safeError(caught: unknown) { return (caught instanceof Error ? caught.message : String(caught)).replace(/\bhttps?:\/\/\S+/gi, "[redacted-url]").replace(/\b[a-z2-7]{56}\.onion\b/gi, "[restricted-host]").slice(0, 500); }
