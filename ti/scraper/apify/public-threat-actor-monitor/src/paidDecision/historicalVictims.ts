import type { MarketplaceRow } from "../types.ts";

type Decision = Pick<MarketplaceRow, "paidRowDecision" | "paidRowReason" | "paidRowReasonCodes" | "paidRowRemediationActions" | "buyerValueScore" | "billingGuidance">;

export function isSellableHistoricalVictim(row: MarketplaceRow): boolean {
  return row.collectionMode === "ransomware_live_group_page" &&
    row.rowType === "activity" &&
    row.claimType === "victim_claim" &&
    (row.freshnessStatus === "current" || row.freshnessStatus === "recent") &&
    Boolean(row.victimName && row.sourceUrl) &&
    !hasTestMarker(row) &&
    row.sourceType === "clear_web" &&
    row.confidence >= 0.6 &&
    row.contradictionHints.length === 0 &&
    row.rawContentIncluded === false;
}

function hasTestMarker(row: MarketplaceRow): boolean {
  return /\b(test|example|fixture|demo|sample)\b/i.test([row.title, row.summary, row.victimName, row.actor, row.query].join(" "));
}

export function historicalVictimSellable(): Decision {
  return {
    paidRowDecision: "sellable",
    paidRowReason: "Recent public ransomware victim-claim row with company, actor, date, sector/country when available, source link, and review pivots.",
    paidRowReasonCodes: ["recent_victim_claim", "public_archive_metadata", "actor_victim_pivot", "no_raw_leak_material"],
    paidRowRemediationActions: [],
    buyerValueScore: 0.74,
    billingGuidance: "charge"
  };
}
