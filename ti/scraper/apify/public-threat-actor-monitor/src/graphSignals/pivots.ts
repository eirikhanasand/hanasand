import type { MarketplaceRow } from "../types.ts";
import { uniqueStrings } from "../utils.ts";

export function relationshipLinksForRow(row: MarketplaceRow): string[] {
  return uniqueStrings([
    `${row.actor}:actor`,
    ...row.relationshipPivots.slice(0, 5),
    ...row.sourceFamilies.slice(0, 3).map((family) => `source_family:${family}`)
  ]).slice(0, 8);
}

export function rejectedPivotReasonsForRow(
  row: MarketplaceRow,
  signalState: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["signalState"],
  contradictionState: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["contradictionState"],
  evidence: NonNullable<MarketplaceRow["graphQualityLiftEvidence"]> | undefined
): NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["rejectedPivotReasons"] {
  return uniqueStrings([
    row.nextSearchPivots.length === 0 ? "generic_pivot" : "",
    row.freshnessStatus === "stale" || row.freshnessDelta === "stale" ? "stale_pivot" : "",
    contradictionState === "none" ? "" : "contradicted_pivot",
    row.reviewReasons.some((reason) => reason.includes("alias") || reason.includes("unrelated")) ? "unrelated_actor_pivot" : "",
    row.hasDarknetMetadata && !row.hasPublicChannelCoverage && !evidence?.sourceFamilyCorroborated ? "restricted_only_pivot" : "",
    signalState === "buyer_ready" || evidence?.exportEligible ? "" : "missing_ledger_pivot",
    !evidence?.sourceFamilyCorroborated && signalState !== "held" && signalState !== "buyer_ready" ? "single_source_without_caveat" : "",
    row.nextSearchPivots.length === 0 ? "no_action_pivot" : ""
  ].filter(Boolean)) as NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["rejectedPivotReasons"];
}
