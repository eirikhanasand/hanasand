export interface QualityConversionGate {
  schemaVersion: "ti.apify_paid_row_quality_conversion_gate.v1";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  examples: Array<{
    actor: string;
    family: "apt" | "ransomware";
    decision: "chargeable" | "caveated" | "held" | "suppressed";
    buyerUse: string;
    qualityReason: string;
    score: number;
    handoffOwner?: "agent_01" | "agent_03" | "agent_04" | "agent_05";
    noLeak: true;
  }>;
  rejectedBloatCases: Array<{
    id: string;
    blockedReason: "alias_only_cleanup" | "stale_old_report_reuse" | "duplicate_source_expansion" | "generic_marketing_summary" | "uncorroborated_public_channel_snippet" | "unsafe_metadata" | "no_actionability";
    staysDecision: "held" | "suppressed" | "caveated";
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07";
    proofNote: string;
    noLeak: true;
  }>;
  acceptedRows: number;
  rejectedBloatRows: number;
  sellableRowLift: number;
  bloatBlocked: number;
  sourceParserHandoffs: Array<{
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05";
    blocker: string;
    expectedEffect: string;
  }>;
}
