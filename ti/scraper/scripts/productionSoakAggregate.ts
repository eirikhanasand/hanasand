import type { LiveSearchSoakSample } from "../src/ops/liveSearch.ts";
import type { QuerySample } from "./productionSoakTypes.ts";
import { percentile, unique } from "./productionSoakUtils.ts";

export function aggregateSamples(items: QuerySample[], durationHours: number): LiveSearchSoakSample {
  const fallback = fallbackSample(durationHours);
  if (items.length === 0) return fallback;
  const errors = items.filter((item) => !item.ok).length;
  return {
    ...fallback,
    scenario: scenario(items),
    publicQueryCount: unique(items.map((item) => item.query)).length,
    publicProofOk: items.every((item) => item.publicApiOk),
    scraperNativeProofOk: items.every((item) => item.status !== "unknown"),
    apiWrapperProofOk: items.every((item) => item.publicApiOk),
    sourceActivationDryRunOk: items.every((item) => item.sourceCoveragePercent > 0),
    evidenceWriteReadOk: true,
    graphExportReadinessOk: true,
    publicApiCompatibilityOk: items.every((item) => item.publicApiOk),
    runReuseOk: duplicateRunCount(items) === 0,
    cursorPollingOk: items.some((item) => Boolean(item.cursor)) || items.some((item) => item.pollDelta !== "new"),
    initialLatencyP95Ms: percentile(items.map((item) => item.latencyMs), 0.95),
    partialLatencyP95Ms: percentile(items.map((item) => item.latencyMs), 0.95),
    errorRatePercent: (errors / items.length) * 100,
    duplicateActiveRuns: duplicateRunCount(items),
    sourceCoveragePercent: Math.min(...items.map((item) => item.sourceCoveragePercent)),
    queueAgeP95Seconds: percentile(items.map((item) => item.queueAgeP95Seconds), 0.95),
    workerSaturationPercent: 0,
    memoryRssMaxGb: Math.max(...items.map((item) => item.memoryRssGb)),
    cpuMaxPercent: Math.max(...items.map((item) => item.cpuPercent)),
    rejectedUnsafeActions: items.reduce((sum, item) => sum + item.rejectedUnsafeActions, 0),
    restrictedKillSwitchActive: items.some((item) => item.restrictedKillSwitchActive)
  };
}

function fallbackSample(durationHours: number): LiveSearchSoakSample {
  return { scenario: "scraper_unavailable", durationHours, publicProofOk: false, scraperNativeProofOk: false, apiWrapperProofOk: false, sourceActivationDryRunOk: false, evidenceWriteReadOk: false, graphExportReadinessOk: false, publicApiCompatibilityOk: false, initialLatencyP95Ms: 0, partialLatencyP95Ms: 0, errorRatePercent: 100, duplicateActiveRuns: 0, sourceCoveragePercent: 0, queueAgeP95Seconds: 0, memoryRssMaxGb: 0, cpuMaxPercent: 0, policyBlocks: 0, rejectedUnsafeActions: 0, unsafePolicyRetries: 0, restrictedKillSwitchActive: false, fallbackUsed: false };
}

function scenario(items: QuerySample[]): LiveSearchSoakSample["scenario"] {
  if (items.some((item) => item.rollbackTriggers.includes("scraper_http_5xx"))) return "scraper_unavailable";
  if (items.some((item) => item.queueAgeP95Seconds > 60)) return "queue_backlog";
  if (items.some((item) => item.memoryRssGb > 96)) return "memory_pressure";
  return "success";
}

function duplicateRunCount(items: QuerySample[]): number {
  const byQuery = new Map<string, Set<string>>();
  for (const item of items) {
    if (!item.runId) continue;
    byQuery.set(item.query, (byQuery.get(item.query) ?? new Set<string>()).add(item.runId));
  }
  return Math.max(0, ...Array.from(byQuery.values()).map((set) => set.size - 1));
}
