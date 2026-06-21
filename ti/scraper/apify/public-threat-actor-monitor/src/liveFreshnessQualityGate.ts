export interface LiveFreshnessQualityGate {
  schemaVersion: "ti.apify_live_freshness_quality_gate.v1";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  examples: Array<{
    actor: string;
    family: "apt" | "ransomware";
    decision: "chargeable" | "caveated" | "held" | "suppressed";
    queryClass: "latest_activity" | "actor_profile" | "victim_watch" | "ransomware_watch";
    freshRowRate: number;
    staleSuppressionRate: number;
    sourceFamilyFreshness: "diverse_fresh" | "single_family_fresh" | "stale_only" | "metadata_only";
    blocksLatestClaim: boolean;
    buyerVisibleReason: string;
    handoffOwner?: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07";
    noLeak: true;
  }>;
  blockedLatestClaimCases: Array<{
    id: string;
    blockedReason: "old_evidence" | "generic_summary" | "single_source" | "alias_only" | "unrelated_actor" | "contradicted" | "metadata_only_without_public_support";
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07";
    publicAnswerEffect: "partial" | "hold" | "suppress";
    proofNote: string;
    noLeak: true;
  }>;
  freshRowsPromoted: number;
  caveatedRowsKept: number;
  staleLatestClaimsBlocked: number;
  bloatRowsSuppressed: number;
  sourceParserHandoffs: Array<{
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05";
    blocker: string;
    expectedEffect: string;
  }>;
}
