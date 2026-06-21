import type { MarketplaceRow } from "../types.ts";

export function whyWorthPayingFor(row: MarketplaceRow, decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">): string {
  if (decision.billingGuidance === "charge") {
    if (row.sourceFamilyCount >= 2) return "fresh corroborated public signal with source-family diversity";
    return "specific public intelligence row ready for analyst triage";
  }
  if (decision.paidRowDecision === "included_with_caveat") {
    if (row.evidenceGrade === "single_source") return "fresh single-source lead with caveat and next collection pivots";
    if (row.sourceFamilyCount < 2) return "useful lead that shows the missing source family to close";
    return "actionable context that needs more corroboration before paid promotion";
  }
  if (decision.paidRowDecision === "coverage_gap_only") return "source gap explains what to collect next before trusting the answer";
  if (decision.paidRowDecision === "suppress") return "not payworthy yet because no safe matching evidence exists";
  if (row.contradictionHints.length > 0) return "held because public reporting is contradictory";
  if (row.freshnessStatus === "stale") return "held because support is stale for monitoring use";
  return "held until evidence, freshness, or specificity improves";
}
