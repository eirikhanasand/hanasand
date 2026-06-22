import type { MarketplaceRow } from "../types.ts";
import { liveDataMetrics } from "../liveDataMetrics.ts";
import type { paidRowQualitySummary } from "../outputQuality.ts";

export const PRODUCTION_SELLABLE_ROW_FLOOR = 200000;

export function monetizationReadinessForRows(rows: MarketplaceRow[], quality: ReturnType<typeof paidRowQualitySummary>) {
  const live = liveDataMetrics(rows);
  const rateTargetSellableRows = Math.ceil(rows.length * 0.25);
  const targetSellableRows = Math.max(PRODUCTION_SELLABLE_ROW_FLOOR, rateTargetSellableRows);
  const blockers = [
    live.recentPayworthyLiveDataRealRowCount < PRODUCTION_SELLABLE_ROW_FLOOR ? "recent_payworthy_live_rows_below_production_floor" : null,
    live.recentPayworthyLiveDataRealRowCount < targetSellableRows ? "recent_payworthy_live_rows_below_paid_traffic_floor" : null,
    quality.averageBuyerValueScore < 0.55 ? "average_buyer_value_below_listing_floor" : null,
    quality.usefulForBuyer === 0 ? "no_buyer_useful_rows" : null
  ].filter((blocker): blocker is string => Boolean(blocker));
  return {
    status: blockers.length === 0 ? "ready_for_paid_traffic" : "blocked_for_paid_traffic",
    minimumProductionSellableRows: PRODUCTION_SELLABLE_ROW_FLOOR,
    targetSellableRows,
    rateTargetSellableRows,
    sellableRows: quality.sellable,
    recentPayworthyLiveRows: live.recentPayworthyLiveDataRealRowCount,
    distinctRecentPayworthyHostedSourceFindings: live.distinctRecentPayworthyHostedSourceFindingCount,
    usefulForBuyerRows: quality.usefulForBuyer,
    averageBuyerValueScore: quality.averageBuyerValueScore,
    blockers,
    currentProductionFloorProgress: Number((live.recentPayworthyLiveDataRealRowCount / PRODUCTION_SELLABLE_ROW_FLOOR).toFixed(3)),
    nextRevenueAction: blockers.includes("recent_payworthy_live_rows_below_paid_traffic_floor")
      ? `add or repair live sources until at least ${PRODUCTION_SELLABLE_ROW_FLOOR} output rows are recent, live-backed, chargeable, non-test findings and at least 25 percent of rows meet that bar`
      : "send paid traffic and measure Apify views, starts, dataset rows, and repeat runs"
  };
}
