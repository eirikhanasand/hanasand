import type { MarketplaceRow } from "../types.ts";

type Decision = Pick<MarketplaceRow, "paidRowDecision" | "paidRowReason" | "paidRowReasonCodes" | "paidRowRemediationActions" | "buyerValueScore" | "billingGuidance">;

export function isSellableCurrentLiveActivity(row: MarketplaceRow): boolean {
  return row.rowType === "activity" &&
    row.liveDataReal === true &&
    row.sourceUrl !== undefined &&
    row.confidence >= 0.58 &&
    (row.freshnessStatus === "current" || row.freshnessStatus === "recent") &&
    !row.contradictionHints.length &&
    !row.reviewReasons.some((reason) => reason.startsWith("hold:")) &&
    hasBuyerContext(row);
}

export function currentLiveActivitySellable(): Decision {
  return {
    paidRowDecision: "sellable",
    paidRowReason: "Current hosted public-source activity has actor-specific context, a safe source URL, confidence, freshness, and a buyer pivot.",
    paidRowReasonCodes: ["hosted_live_activity", "fresh_or_recent", "actor_specific", "safe_source_url", "buyer_context"],
    paidRowRemediationActions: [],
    buyerValueScore: 0.74,
    billingGuidance: "charge"
  };
}

function hasBuyerContext(row: MarketplaceRow): boolean {
  return row.claimType !== "general_activity" ||
    Boolean(row.victimName || row.impact || row.ttp || row.attackId) ||
    (row.publisherCount ?? 0) >= 2;
}
