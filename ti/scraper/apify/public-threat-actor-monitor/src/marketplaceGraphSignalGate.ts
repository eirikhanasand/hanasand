export interface MarketplaceGraphSignalGate {
  schemaVersion: "ti.marketplace_graph_signals_gate.v1";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  improvedRows: number;
  rejectedRows: number;
  expectedBuyerVisibleLift: string[];
  examples: Array<{
    actor: string;
    family: "apt" | "ransomware";
    rowSignal: "buyer_ready" | "needs_corroboration";
    relationshipLinks: string[];
    buyerUse: string;
    nextBuyerPivots: string[];
    noLeak: true;
  }>;
  rejectedGraphInflation: Array<{
    id: string;
    blockedReason: "stale_graph_fact" | "single_source_edge" | "unrelated_actor_link" | "restricted_only_context" | "missing_ledger_proof" | "no_fresh_change";
    proofNote: string;
    noLeak: true;
  }>;
  sourceParserHandoffs: Array<{
    owner: "agent_03" | "agent_04" | "agent_05";
    blocker: string;
    expectedEffect: string;
  }>;
}
