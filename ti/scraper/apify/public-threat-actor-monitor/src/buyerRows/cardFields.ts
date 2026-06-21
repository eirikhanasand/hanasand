import type { MarketplaceRow } from "../types.ts";
import { uniqueStrings } from "../utils.ts";

export function cardStatus(decision: Pick<MarketplaceRow, "paidRowDecision">): NonNullable<MarketplaceRow["buyerSearchCard"]>["status"] {
  if (decision.paidRowDecision === "sellable") return "sellable";
  if (decision.paidRowDecision === "included_with_caveat") return "lead";
  if (decision.paidRowDecision === "coverage_gap_only") return "coverage_gap";
  return "held";
}

export function recentActivityForRow(row: MarketplaceRow): string[] {
  const recentActivity = uniqueStrings([
    row.claimType ? row.claimType.replaceAll("_", " ") : "",
    row.claimedDate ? `claimed ${row.claimedDate}` : "",
    row.impact ?? "",
    row.relationshipSummary
  ].filter(Boolean)).slice(0, 4);
  return recentActivity.length > 0 ? recentActivity : [row.title];
}

export function confidenceLabelForRow(row: MarketplaceRow): NonNullable<MarketplaceRow["buyerSearchCard"]>["confidence"]["label"] {
  if (row.confidence >= 0.75) return "high";
  if (row.confidence >= 0.55) return "medium";
  return "low";
}
