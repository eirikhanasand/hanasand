export interface RelationshipConfidenceGate {
  schemaVersion: "ti.apify_relationship_confidence_gate.v1";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  exampleCount: number;
  usefulPivotCount: number;
  actionPivotCount: number;
  corroboratedPivotCount: number;
  rejectedUnsupportedPivotCount: number;
  nextSearchCount: number;
  sellableRowsAdded: number;
  usefulRowsAdded: number;
  averageBuyerValueDelta: number;
  examples: Array<{
    actor: string;
    family: "apt" | "ransomware" | "victim" | "sector" | "unknown";
    decision: "sellable" | "caveated" | "held" | "suppressed" | "searching";
    confidenceTrend: "stronger" | "stable" | "weaker" | "unknown";
    contradictionState: "none" | "contradicted" | "review_hold";
    pivotClass: "actor_alias" | "campaign" | "victim" | "sector_country" | "ttp_tool" | "source_family" | "restricted_metadata" | "unknown_search";
    nextBuyerPivot: string;
    buyerUse: string;
    noLeak: true;
  }>;
  rejectedUnsupportedPivots: Array<{
    id: string;
    blockedReason: "generic_pivot" | "stale_pivot" | "contradicted_pivot" | "unrelated_actor_pivot" | "restricted_only_pivot" | "missing_ledger_pivot" | "single_source_without_caveat" | "no_action_pivot";
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
