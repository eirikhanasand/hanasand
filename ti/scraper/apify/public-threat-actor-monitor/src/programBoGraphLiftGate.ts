export interface ProgramBoGraphLiftGate {
  schemaVersion: "ti.apify_buyer_visible_graph_lift_batch_2.v1";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  baselineQuery: "APT42";
  baselineRows: {
    total: 10;
    sellable: 4;
    caveated: 2;
    held: 4;
    averageBuyerValueScore: 0.577;
  };
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  acceptedExamples: Array<{
    id: string;
    beforeDecision: "hold" | "included_with_caveat";
    afterDecision: "sellable";
    graphEvidenceAdds: Array<"relationship_ready" | "source_corroboration" | "freshness_lift" | "actor_target_ttp_pivots" | "no_leak_provenance">;
    buyerVisibleLift: string;
    sellableRowsDelta: 1;
    noLeak: true;
  }>;
  rejectedGraphOnlyPromotions: Array<{
    id: string;
    blockedReason: "stale_graph_context" | "single_source_graph_context" | "contradicted_graph_context" | "restricted_only_graph_context" | "missing_ledger_proof" | "unrelated_actor_context";
    staysDecision: "hold" | "included_with_caveat";
    proofNote: string;
    noLeak: true;
  }>;
  measurableLift: {
    sellableRowsAdded: number;
    projectedAverageBuyerValueScore: number;
    projectedGrossRowRevenueDeltaUsd: number;
  };
}
