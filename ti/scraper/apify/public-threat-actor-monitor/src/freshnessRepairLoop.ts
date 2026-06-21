export interface FreshnessRepairLoop {
  schemaVersion: "ti.apify_paid_row_freshness_repair_loop.v1";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  repairQueue: Array<{
    id: string;
    actor: string;
    family: "apt" | "ransomware";
    blocker: "stale_latest_activity" | "generic_summary" | "single_source" | "alias_only" | "unrelated_actor" | "contradicted" | "metadata_only_without_public_support";
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
    currentDecision: "chargeable" | "caveated" | "held" | "suppressed";
    targetDecision: "chargeable" | "caveated" | "held" | "suppressed";
    requiredEvidenceFamily: "clear_web" | "public_advisory" | "public_channel" | "restricted_metadata" | "graph_ledger";
    proofNeeded: string[];
    expectedBuyerVisibleLift: string[];
    currentBuyerValue: number;
    targetBuyerValue: number;
    noLeak: true;
  }>;
  lift: {
    staleRowsBlocked: number;
    genericRowsRepaired: number;
    aliasOrUnrelatedRowsSuppressed: number;
    caveatedRowsPreserved: number;
    sellableRowsGained: number;
    usefulRowsGained: number;
    averageBuyerValueDelta: number;
  };
  ownerHandoffs: Array<{
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
    queueCount: number;
    blockerFocus: string;
    expectedEffect: string;
  }>;
  noLeakProof: {
    rawEvidenceExposed: false;
    unsafeUrlsExposed: false;
    restrictedPayloadsExposed: false;
    objectKeysExposed: false;
  };
}
