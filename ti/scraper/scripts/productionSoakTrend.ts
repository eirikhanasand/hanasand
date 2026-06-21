import type { QuerySample } from "./productionSoakTypes.ts";
import { maxOrZero, minOrZero, percentile, unique } from "./productionSoakUtils.ts";

export function buildTrendDeltas(items: QuerySample[]) {
  const firstByQuery = new Map<string, QuerySample>();
  const lastByQuery = new Map<string, QuerySample>();
  const pollDeltaCounts: Record<QuerySample["pollDelta"], number> = { none: 0, partial_to_ready: 0, ready_to_partial: 0, changed: 0, new: 0 };
  for (const item of items) {
    firstByQuery.set(item.query, firstByQuery.get(item.query) ?? item);
    lastByQuery.set(item.query, item);
    pollDeltaCounts[item.pollDelta] += 1;
  }
  const first = Array.from(firstByQuery.values());
  const last = Array.from(lastByQuery.values());
  return {
    runCreation: runCreation(first, last),
    polling: pollDeltaCounts,
    partialToReady: pollDeltaCounts.partial_to_ready,
    sourceSlo: { firstMinCoveragePercent: minOrZero(first.map((item) => item.sourceCoveragePercent)), finalMinCoveragePercent: minOrZero(last.map((item) => item.sourceCoveragePercent)), delta: minOrZero(last.map((item) => item.sourceCoveragePercent)) - minOrZero(first.map((item) => item.sourceCoveragePercent)) },
    queuePressure: { firstP95Seconds: percentile(first.map((item) => item.queueAgeP95Seconds), 0.95), finalP95Seconds: percentile(last.map((item) => item.queueAgeP95Seconds), 0.95) },
    cursorPolling: { firstCursorCount: first.filter((item) => Boolean(item.cursor)).length, finalCursorCount: last.filter((item) => Boolean(item.cursor)).length, allPollDeltas: items.filter((item) => item.pollDelta !== "new").length },
    memory: { firstMaxGb: maxOrZero(first.map((item) => item.memoryRssGb)), finalMaxGb: maxOrZero(last.map((item) => item.memoryRssGb)), deltaGb: maxOrZero(last.map((item) => item.memoryRssGb)) - maxOrZero(first.map((item) => item.memoryRssGb)) },
    cpu: { firstMaxPercent: maxOrZero(first.map((item) => item.cpuPercent)), finalMaxPercent: maxOrZero(last.map((item) => item.cpuPercent)), deltaPercent: maxOrZero(last.map((item) => item.cpuPercent)) - maxOrZero(first.map((item) => item.cpuPercent)) },
    unsafeRejections: { firstTotal: sumUnsafe(first), finalTotal: sumUnsafe(last), allSamplesTotal: sumUnsafe(items) },
    restrictedKillSwitch: { firstActive: first.some((item) => item.restrictedKillSwitchActive), finalActive: last.some((item) => item.restrictedKillSwitchActive), anyActive: items.some((item) => item.restrictedKillSwitchActive) },
    rollbackTriggers: unique(items.flatMap((item) => item.rollbackTriggers))
  };
}

function runCreation(first: QuerySample[], last: QuerySample[]) {
  const firstRunIds = unique(first.map((item) => item.runId).filter(Boolean) as string[]).length;
  const finalRunIds = unique(last.map((item) => item.runId).filter(Boolean) as string[]).length;
  return { firstRunIds, finalRunIds, delta: finalRunIds - firstRunIds };
}

function sumUnsafe(items: QuerySample[]): number {
  return items.reduce((sum, item) => sum + item.rejectedUnsafeActions, 0);
}
