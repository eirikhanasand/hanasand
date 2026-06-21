import type { MarketplaceRow, TiSearchResponse } from "../types.ts";
import { boolFromUnknown, clampInt, numberFromUnknown, record, safeString, sourceType, stringArray, uniqueStrings } from "../utils.ts";
import { isEvidenceSourceFamily, qualityFields } from "../rowQuality.ts";
import { deferredWorkloadsFor, pollingHintFor, schedulerBadgesFor } from "./signals.ts";

export function schedulerCore(response: TiSearchResponse): Pick<MarketplaceRow, "schedulerState" | "schedulerDecision" | "nextPollSeconds" | "retryAfterSeconds" | "duplicateRunReuse" | "attachedToActiveRun" | "queuedTaskCount" | "deferredBackgroundWorkloads" | "schedulerBadges" | "sourceCoverageState" | "sourceCoverageGapCount" | "sourceCoverageGaps" | "pollingHint"> {
  const evidenceCount = response.sources.filter((source) => isEvidenceSourceFamily(sourceType(source.type))).length;
  const quality = qualityFields(response, evidenceCount > 0 || response.recentActivity.length > 0 ? response.lastSeen : "", response.confidence, evidenceCount);
  const scheduler = record(response.scheduler);
  const interactive = record(scheduler?.interactiveSearchFreshness);
  const queueDecision = record(interactive?.queueDecision);
  const uiSignals = record(interactive?.uiSignals);
  const runtimeSla = record(scheduler?.runtimeSla);
  const sourceCoverage = record(response.sourceCoverage);
  const sourceSlo = record(sourceCoverage?.slo);
  const sourceCoverageGaps = uniqueStrings([...quality.coverageGapCodes, ...stringArray(sourceCoverage?.gaps), ...stringArray(sourceCoverage?.coverageGaps)]).slice(0, 12);
  const nextPollSeconds = clampInt(numberFromUnknown(queueDecision?.nextPollSeconds ?? scheduler?.nextPollSeconds ?? response.refreshAfterSeconds), 1, 3600, response.status === "ready" ? 900 : 3);
  const schedulerState = safeString(runtimeSla?.state ?? scheduler?.backpressureState ?? fallbackState(response));
  const schedulerDecision = safeString(queueDecision?.decision ?? scheduler?.backpressureState ?? fallbackDecision(response, quality.coverageGapCodes));
  const attachedToActiveRun = boolFromUnknown(queueDecision?.attachedToActiveRun ?? scheduler?.attachedToActiveRun) || response.status === "partial" || response.status === "queued";
  return {
    schedulerState,
    schedulerDecision,
    nextPollSeconds,
    retryAfterSeconds: retryAfter(response, queueDecision, scheduler, nextPollSeconds),
    duplicateRunReuse: attachedToActiveRun || queueDecision?.duplicateRunReuse === "required_before_enqueue",
    attachedToActiveRun,
    queuedTaskCount: clampInt(numberFromUnknown(scheduler?.queuedTaskCount), 0, 1_000_000, response.status === "queued" ? 1 : 0),
    deferredBackgroundWorkloads: uniqueStrings([...stringArray(queueDecision?.deferredBackgroundWorkloads), ...deferredWorkloadsFor(response, quality.coverageGapCodes)]).slice(0, 12),
    schedulerBadges: uniqueStrings([...stringArray(uiSignals?.badges), ...schedulerBadgesFor(response, quality.coverageStatus)]).slice(0, 12),
    sourceCoverageState: safeString(sourceCoverage?.coverageState ?? sourceSlo?.status ?? quality.coverageStatus),
    sourceCoverageGapCount: sourceCoverageGaps.length,
    sourceCoverageGaps,
    pollingHint: pollingHintFor(response, sourceCoverageGaps, nextPollSeconds)
  };
}

function fallbackState(response: TiSearchResponse): string {
  if (response.status === "ready") return "complete";
  if (response.status === "partial") return "polling";
  if (response.status === "queued") return "queued";
  return response.status ?? "unknown";
}

function fallbackDecision(response: TiSearchResponse, gaps: string[]): string {
  if (gaps.includes("contradicting_public_reports")) return "hold_for_review";
  if (response.status === "partial") return "reuse_active_run";
  if (response.status === "queued") return "retry_after";
  if (gaps.length > 0) return "expand_source_coverage";
  return "complete";
}

function retryAfter(response: TiSearchResponse, queueDecision: Record<string, unknown> | undefined, scheduler: Record<string, unknown> | undefined, nextPollSeconds: number): number {
  return clampInt(numberFromUnknown(queueDecision?.retryAfterSeconds ?? scheduler?.retryAfterSeconds), response.status === "ready" ? 0 : 3, 86_400, response.status === "queued" || response.status === "partial" ? Math.max(3, nextPollSeconds) : 0);
}
