export interface HundredRowConversionProof {
  schemaVersion: "ti.apify_100_row_conversion_proof.v1";
  routeVisibleOn: Array<"Apify OUTPUT" | "/v1/contracts#apifyStoreReadiness" | "/v1/ops/product-slo">;
  currentRun: {
    proofRunId: "OThlfd0uzSCNnedAO";
    proofDatasetId: "LSen2fYtwFTtOr7vK";
    proofDecision: "shape_safety_proof";
    productionPaidTrafficReady: boolean;
    currentSellableRows: number;
    currentUsefulRows: number;
    currentCaveatedUsefulRows: number;
    currentBlockedRows: number;
    currentSuppressedRows: number;
    targetSellableRows: 100;
    remainingSellableRows: number;
    currentFloorProgress: number;
    exactBlockers: string[];
  };
  acceptedRepairProjection: {
    projectedSellableRowsFromAcceptedRepairs: number;
    projectedSellableRowsAfterAcceptedRepairs: number;
    projectedUsefulRowsFromAcceptedRepairs: number;
    oneRepairAwayRows: number;
    caveatedUsefulRows: number;
    blockedRows: number;
    graphOnlyProjectedRows: number;
    graphOnlyRowsCountTowardProductionFloor: false;
    proofSizedRunsCountTowardProductionReadiness: false;
    caveatOnlyRunsCountTowardProductionReadiness: false;
  };
  firstPaidTrafficExperiment: {
    status: "blocked_until_100_sellable_rows";
    targetBuyer: string;
    inputPreset: string;
    successMetric: string;
    stopLossMetric: string;
    refundRisk: string;
    requiredApifyAnalyticsFields: string[];
  };
  noFakeRevenueClaims: {
    payout: null;
    storeViews: null;
    users: null;
    paidRuns: null;
    revenue: null;
    runtime: null;
    platformUsage: null;
    conversionRate: null;
  };
}
