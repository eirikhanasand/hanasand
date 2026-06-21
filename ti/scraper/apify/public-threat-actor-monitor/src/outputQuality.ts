import type { MarketplaceRow, MonetizationSummary } from "./types.ts";
import { ACTOR_START_EVENT, DATASET_ITEM_EVENT } from "./constants.ts";
import { apifyEventSkipReason } from "./utils.ts";
export { buyerVisibleOutputQualityForRows } from "./outputQuality/buyerVisible.ts";
export { dailyCollectionRunForRows, isBuyerUsefulCandidate } from "./outputQuality/dailyRun.ts";
export { monetizationReadinessForRows, PRODUCTION_SELLABLE_ROW_FLOOR } from "./outputQuality/readiness.ts";
export { revenueConversionChecklistForRows } from "./outputQuality/revenueChecklist.ts";

export function paidRowQualitySummary(rows: MarketplaceRow[]) {
  const byDecision = {
    sellable: rows.filter((row) => row.paidRowDecision === "sellable").length,
    included_with_caveat: rows.filter((row) => row.paidRowDecision === "included_with_caveat").length,
    coverage_gap_only: rows.filter((row) => row.paidRowDecision === "coverage_gap_only").length,
    hold: rows.filter((row) => row.paidRowDecision === "hold").length,
    suppress: rows.filter((row) => row.paidRowDecision === "suppress").length
  };
  return {
    ...byDecision,
    chargeRecommended: rows.filter((row) => row.billingGuidance === "charge").length,
    contextOnly: rows.filter((row) => row.billingGuidance !== "charge").length,
    usefulForBuyer: rows.filter((row) => row.paidRowDecision === "sellable" || row.paidRowDecision === "included_with_caveat").length,
    averageBuyerValueScore: rows.length
      ? Number((rows.reduce((sum, row) => sum + (row.buyerValueScore ?? 0), 0) / rows.length).toFixed(3))
      : 0
  };
}
export function monetizationForRows(rows: MarketplaceRow[]): MonetizationSummary {
  const quality = paidRowQualitySummary(rows);
  const enabled = Boolean(process.env.APIFY_ACTOR_RUN_ID && process.env.APIFY_TOKEN);
  const summary: MonetizationSummary = {
    enabled,
    eventNames: [ACTOR_START_EVENT, DATASET_ITEM_EVENT],
    pricingModel: "pay_per_event",
    billingMode: "apify_synthetic_events",
    actorStartEvent: ACTOR_START_EVENT,
    datasetItemEvent: DATASET_ITEM_EVENT,
    datasetItemCount: rows.length,
    sellableRowCount: quality.sellable,
    caveatedRowCount: quality.included_with_caveat,
    coverageGapOnlyRowCount: quality.coverage_gap_only,
    holdRowCount: quality.hold,
    suppressedRowCount: quality.suppress,
    chargeRecommendedRowCount: quality.chargeRecommended
  };
  if (!summary.enabled) {
    summary.skippedReason = apifyEventSkipReason();
  }
  return summary;
}
