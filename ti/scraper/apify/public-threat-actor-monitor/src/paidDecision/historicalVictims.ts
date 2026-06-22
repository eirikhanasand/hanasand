import type { MarketplaceRow } from "../types.ts";

type Decision = Pick<MarketplaceRow, "paidRowDecision" | "paidRowReason" | "paidRowReasonCodes" | "paidRowRemediationActions" | "buyerValueScore" | "billingGuidance">;

export function isSellableHistoricalVictim(row: MarketplaceRow): boolean {
  return row.collectionMode === "ransomware_live_group_page" &&
    row.rowType === "activity" &&
    row.claimType === "victim_claim" &&
    Boolean(row.victimName && row.sourceUrl) &&
    row.sourceType === "clear_web" &&
    row.confidence >= 0.6 &&
    row.contradictionHints.length === 0 &&
    row.rawContentIncluded === false;
}

export function historicalVictimSellable(): Decision {
  return {
    paidRowDecision: "sellable",
    paidRowReason: "Public ransomware victim-claim archive row with concrete victim, actor, date, sector/country when available, provenance hash, and metadata-only handling.",
    paidRowReasonCodes: ["historical_victim_claim", "public_archive_metadata", "actor_victim_pivot", "safe_metadata_only"],
    paidRowRemediationActions: [],
    buyerValueScore: 0.74,
    billingGuidance: "charge"
  };
}
