export interface PaidReleaseTruthBoard {
  schemaVersion: "ti.program_cq_paid_release_truth_board.v1";
  routeVisibleOn: Array<"Apify OUTPUT" | "/v1/ops/product-slo" | "/v1/contracts#apifyStoreReadiness" | "coordination_agent_10.md">;
  generatedFrom: "observed_apify_smoke_and_current_output";
  productionSellableFloor: 100;
  paidTrafficAllowed: boolean;
  observedProof: any;
  rowDeltaTo100: any;
  conversionObservability: any;
  observedMarketplaceTelemetry: any;
  paidReleaseRunbook: any;
  buyerPaidReleaseVerdict: any;
  hostedPaidReadinessProof: Record<string, unknown>;
  programDcReleaseGates: any;
  programDeReleaseBoard: Record<string, unknown>;
  programFgPrivateBetaDecision: Record<string, unknown>;
  blockerBuckets: any[];
  fakeMetricGuard: any;
  exclusionProof: any[];
  nextActions: string[];
}
