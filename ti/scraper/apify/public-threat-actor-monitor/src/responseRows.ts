import type { MarketplaceRow, TiSearchResponse } from "./types.ts";
import type { NormalizedInput } from "./actorRuntime.ts";
import { safeIso } from "./utils.ts";
import { parserLiveCurrentAdmissionRows } from "./parserLiveRows.ts";
import { withPaidRowDecision } from "./paidRows.ts";
import { baseRow, coverageGapRows } from "./rowSupport.ts";
import { activityRows } from "./responseRows/activity.ts";
import { datasetRows } from "./responseRows/datasets.ts";
import { sourceRows } from "./responseRows/sources.ts";
import { targetRows } from "./responseRows/targets.ts";
import { ttpRows } from "./responseRows/ttps.ts";

export function normalizeResponse(response: TiSearchResponse, input: NormalizedInput): MarketplaceRow[] {
  const sourceById = new Map(response.sources.map((source) => [source.id, source]));
  const generatedAt = safeIso(response.generatedAt) ?? new Date().toISOString();
  const lastSeen = safeIso(response.lastSeen) ?? generatedAt;
  const rows: MarketplaceRow[] = [baseRow(response, generatedAt, lastSeen)];

  if (input.includeActivity) {
    rows.push(...activityRows(response, generatedAt, lastSeen, sourceById));
    rows.push(...parserLiveCurrentAdmissionRows(response, generatedAt, lastSeen, sourceById));
  }
  if (input.includeTargets) rows.push(...targetRows(response, generatedAt, lastSeen));
  if (input.includeTtps) rows.push(...ttpRows(response, generatedAt, lastSeen));
  if (input.includeSources) rows.push(...sourceRows(response, generatedAt, lastSeen));
  if (input.includeDatasets) rows.push(...datasetRows(response, generatedAt, lastSeen));
  if (input.includeCoverageGaps) rows.push(...coverageGapRows(response, generatedAt, lastSeen));

  return rows.map(withPaidRowDecision);
}
