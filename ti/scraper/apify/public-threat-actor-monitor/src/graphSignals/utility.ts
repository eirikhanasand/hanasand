import type { MarketplaceRow } from "../types.ts";
import { uniqueStrings } from "../utils.ts";

export function freshnessHintsForRow(row: MarketplaceRow): string[] {
  return uniqueStrings([
    `freshness:${row.freshnessDelta}`,
    `observed:${row.freshnessStatus}`,
    ...(row.claimedDate ? [`claimed:${row.claimedDate}`] : []),
    ...(row.firstReportedAt ? [`first_reported:${row.firstReportedAt}`] : []),
    ...(row.lastReportedAt ? [`last_reported:${row.lastReportedAt}`] : [])
  ]).slice(0, 5);
}

export function sourceBlockersForRow(
  row: MarketplaceRow,
  evidence: NonNullable<MarketplaceRow["graphQualityLiftEvidence"]> | undefined
): string[] {
  return uniqueStrings([
    ...row.missingSourceFamilies.map((family) => `missing_${family}`),
    ...(evidence?.sourceFamilyCorroborated ? [] : ["needs_source_corroboration"]),
    ...(evidence?.freshnessLift ? [] : ["needs_fresh_public_evidence"]),
    ...(evidence?.contradictionHeld ? ["contradiction_or_review_hold"] : [])
  ]).slice(0, 6);
}

export function buyerActionForSignal(signalState: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["signalState"]): string {
  if (signalState === "buyer_ready") return "chargeable_monitoring_signal";
  if (signalState === "needs_corroboration") return "use_as_lead_and_follow_next_pivots";
  return "do_not_promote_until_hold_clears";
}
