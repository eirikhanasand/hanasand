import type { MarketplaceRow, PaidRowDecision } from "../types.ts";
import type { NormalizedInput } from "./input.ts";
import { liveDataRealScore } from "../dataReality.ts";
import { normalizeResponse } from "../responseRows.ts";

export function filterOutputRows(rows: MarketplaceRow[], input: NormalizedInput): MarketplaceRow[] {
  return rows.filter((row) => {
    if (!input.includeCoverageGaps && row.paidRowDecision === "coverage_gap_only") return false;
    if (!input.includeHeldRows && (row.paidRowDecision === "hold" || row.paidRowDecision === "suppress")) return false;
    return true;
  });
}

export function prioritizeDailyCollectionRows(rows: MarketplaceRow[]): MarketplaceRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => compareRows(left, right))
    .map((entry) => entry.row);
}

export function outputRowsFor(response: Parameters<typeof normalizeResponse>[0], input: NormalizedInput): MarketplaceRow[] {
  return prioritizeDailyCollectionRows(filterOutputRows(normalizeResponse(response, input), input));
}

export function needsNewsFallback(rows: MarketplaceRow[]): boolean {
  return rows.filter((row) => row.paidRowDecision === "sellable").length < 3;
}

type RankedRow = { row: MarketplaceRow; index: number };

function compareRows(left: RankedRow, right: RankedRow): number {
  const leftDecision = left.row.paidRowDecision ?? "hold";
  const rightDecision = right.row.paidRowDecision ?? "hold";
  return decisionRank[leftDecision] - decisionRank[rightDecision]
    || liveDataRealScore(left.row) - liveDataRealScore(right.row)
    || freshnessRank[left.row.freshnessStatus] - freshnessRank[right.row.freshnessStatus]
    || rowTypeRank[left.row.rowType] - rowTypeRank[right.row.rowType]
    || (right.row.buyerValueScore ?? 0) - (left.row.buyerValueScore ?? 0)
    || left.index - right.index;
}

const decisionRank: Record<PaidRowDecision, number> = { sellable: 0, included_with_caveat: 1, coverage_gap_only: 2, hold: 3, suppress: 4 };
const freshnessRank: Record<MarketplaceRow["freshnessStatus"], number> = { current: 0, recent: 1, unknown: 2, stale: 3 };
const rowTypeRank: Record<MarketplaceRow["rowType"], number> = { activity: 0, target: 1, ttp: 2, profile: 3, source: 4, dataset: 5, coverage_gap: 6 };
