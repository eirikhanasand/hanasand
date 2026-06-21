import type { MarketplaceRow, TiSearchResponse } from "../types.ts";
import { normalizeKey, record, recordArray, safeString, stringArray, uniqueStrings } from "../utils.ts";

export function sourceCoverageProductFields(response: TiSearchResponse): Pick<MarketplaceRow, "freshnessExpectation" | "highestValueMissingFamily" | "nextBestSourceAction" | "buyerCaveat" | "expectedTimeToUsefulSignal"> {
  const row = actorCoverageMatrixRow(response);
  return {
    freshnessExpectation: safeString(row?.freshnessExpectation ?? "unknown"),
    highestValueMissingFamily: safeString(row?.highestValueMissingFamily ?? ""),
    nextBestSourceAction: safeString(row?.nextBestSourceAction ?? fallbackNextBestSourceAction(response)),
    buyerCaveat: safeString(row?.buyerCaveat ?? fallbackBuyerCaveat(response)),
    expectedTimeToUsefulSignal: safeString(row?.expectedTimeToUsefulSignal ?? "unknown_until_sources_added")
  };
}

function actorCoverageMatrixRow(response: TiSearchResponse): Record<string, unknown> | undefined {
  const sourceCoverage = record(response.sourceCoverage);
  const signalFusion = record(record(response.publicChannel)?.signalFusion);
  const candidates = [record(sourceCoverage?.actorSourceCoverageMatrix), record(sourceCoverage?.matrix), record(signalFusion?.actorSourceCoverageMatrix)].filter((value): value is Record<string, unknown> => Boolean(value));
  const normalizedQuery = normalizeKey(response.query);
  for (const matrix of candidates) {
    const direct = recordArray(matrix.rows).find((row) => normalizeKey(safeString(row.actor)) === normalizedQuery);
    if (direct) return direct;
    const alias = recordArray(matrix.rows).find((row) => stringArray(row.aliases).some((value) => normalizeKey(value) === normalizedQuery));
    if (alias) return alias;
    const priority = recordArray(record(matrix.compactProductFields)?.actorFeedPriorities).find((row) => normalizeKey(safeString(row.actor)) === normalizedQuery);
    if (priority) return priority;
  }
  return undefined;
}

function fallbackNextBestSourceAction(response: TiSearchResponse): string {
  const gaps = sourceGaps(response);
  if (gaps.includes("missing_public_channel_evidence")) return "activate_public_channel";
  if (gaps.includes("missing_clear_web_evidence") || gaps.includes("no_public_evidence")) return "activate_public_blog_news";
  if (gaps.includes("stale_or_missing_timestamp")) return "raise_cadence";
  if (gaps.length > 0) return "expose_coverage_gap";
  return "maintain_current_mix";
}

function fallbackBuyerCaveat(response: TiSearchResponse): string {
  const gaps = sourceGaps(response);
  if (gaps.length > 0) return `Coverage is partial for ${response.query}; review missing source families before treating this as complete.`;
  if (response.status === "partial" || response.status === "queued") return `Live collection is still running for ${response.query}; poll again before final triage.`;
  return "Coverage appears sufficient for the current public metadata snapshot.";
}

function sourceGaps(response: TiSearchResponse): string[] {
  const sourceCoverage = record(response.sourceCoverage);
  return uniqueStrings([...stringArray(sourceCoverage?.gaps), ...stringArray(sourceCoverage?.coverageGaps)]);
}
