import type { MarketplaceRow } from "../types.ts";

export function whyWorthPayingFor(row: MarketplaceRow, decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance" | "paidRowReasonCodes">): string {
  if (decision.billingGuidance === "charge") {
    if (row.claimType === "victim_claim" && row.victimName) {
      if (row.claimedDataSummary) return "shows the named company, actor, date, source, and claimed data in one row";
      return "shows the named company, actor, date, and source for exposure review";
    }
    if (decision.paidRowReasonCodes?.includes("historical_victim_claim")) return "searchable public ransomware victim-claim row with company and actor pivots";
    if (row.sourceFamilyCount >= 2) return "fresh corroborated public signal with source diversity";
    return "actionable public signal with source, date, and next pivots";
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
