import type { MarketplaceRow } from "../types.ts";

export function pivotUtility(input: SignalCounts): NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["pivotUtility"] {
  return {
    usefulPivotCount: input.usefulPivotCount,
    actionPivotCount: input.actionPivotCount,
    corroboratedPivotCount: input.corroboratedPivotCount,
    suppressedGenericPivotCount: input.rejectedPivotReasons.filter((reason) => reason === "generic_pivot" || reason === "unrelated_actor_pivot").length,
    buyerValueDelta: input.buyerValueDelta,
    noLeak: true
  };
}

export function relationshipConfidence(row: MarketplaceRow, input: SignalCounts): NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["relationshipConfidence"] {
  const buyerReady = input.signalState === "buyer_ready";
  return {
    usefulPivotCount: input.usefulPivotCount,
    actionPivotCount: input.actionPivotCount,
    corroboratedPivotCount: input.corroboratedPivotCount,
    rejectedUnsupportedPivotCount: input.rejectedPivotReasons.length,
    confidenceTrend: row.confidenceDelta,
    contradictionState: input.contradictionState,
    nextSearchCount: input.actionPivotCount,
    sellableLift: buyerReady ? 1 : 0,
    usefulLift: buyerReady || input.signalState === "needs_corroboration" ? 1 : 0,
    buyerValueDelta: input.buyerValueDelta,
    noLeak: true
  };
}

export interface SignalCounts {
  usefulPivotCount: number;
  actionPivotCount: number;
  corroboratedPivotCount: number;
  buyerValueDelta: number;
  signalState: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["signalState"];
  contradictionState: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["contradictionState"];
  rejectedPivotReasons: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["rejectedPivotReasons"];
}
