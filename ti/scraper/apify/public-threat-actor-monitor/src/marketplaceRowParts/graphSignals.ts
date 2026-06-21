export interface MarketplaceGraphSignals {
  schemaVersion: "ti.marketplace_graph_signals.v1";
  signalState: "buyer_ready" | "needs_corroboration" | "held";
  relationshipLinks: string[];
  freshnessChangeHints: string[];
  confidenceTrend: "stronger" | "stable" | "weaker" | "unknown";
  contradictionState: "none" | "contradicted" | "review_hold";
  nextBuyerPivots: string[];
  pivotUtility: GraphPivotUtility;
  relationshipConfidence: RelationshipConfidence;
  rejectedPivotReasons: RejectedPivotReason[];
  buyerAction: string;
  sourceBlockers: string[];
  noLeak: true;
}

export interface GraphPivotUtility {
  usefulPivotCount: number;
  actionPivotCount: number;
  corroboratedPivotCount: number;
  suppressedGenericPivotCount: number;
  buyerValueDelta: number;
  noLeak: true;
}

export type RejectedPivotReason =
  | "generic_pivot"
  | "stale_pivot"
  | "contradicted_pivot"
  | "unrelated_actor_pivot"
  | "restricted_only_pivot"
  | "missing_ledger_pivot"
  | "single_source_without_caveat"
  | "no_action_pivot";

export interface RelationshipConfidence {
  usefulPivotCount: number;
  actionPivotCount: number;
  corroboratedPivotCount: number;
  rejectedUnsupportedPivotCount: number;
  confidenceTrend: "stronger" | "stable" | "weaker" | "unknown";
  contradictionState: "none" | "contradicted" | "review_hold";
  nextSearchCount: number;
  sellableLift: number;
  usefulLift: number;
  buyerValueDelta: number;
  noLeak: true;
}
