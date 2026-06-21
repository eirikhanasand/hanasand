export interface GraphPivotLiftGate {
  schemaVersion: "ti.apify_graph_pivot_lift_gate.v1";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  exampleCount: number;
  usefulPivotRate: number;
  corroboratedPivotRate: number;
  nextSearchPivotCount: number;
  suppressedGenericPivotCount: number;
  sellableRowsAdded: number;
  usefulRowsAdded: number;
  averageBuyerValueDelta: number;
  examples: Array<{
    actor: string;
    family: "apt" | "ransomware" | "unknown";
    decision: "chargeable" | "caveated" | "held" | "suppressed" | "searching";
    pivotClass: "actor_alias" | "campaign" | "victim" | "sector_country" | "ttp_tool" | "source_family" | "restricted_metadata" | "unknown_search";
    nextBuyerPivot: string;
    buyerUse: string;
    noLeak: true;
  }>;
  rejectedBloatPivots: Array<{
    id: string;
    blockedReason: "generic_pivot" | "stale_pivot" | "contradicted_pivot" | "unrelated_actor_pivot" | "restricted_only_pivot" | "missing_ledger_pivot" | "single_source_without_caveat";
    owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08";
    proofNote: string;
    noLeak: true;
  }>;
  ownerHandoffs: Array<{
    owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_09" | "agent_10";
    blocker: string;
    expectedEffect: string;
  }>;
}
