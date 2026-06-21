export interface EntitySpecificityLift {
  schemaVersion: "ti.apify_paid_row_entity_specificity_lift.v1";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  fixtures: Array<{
    id: string;
    actor: string;
    family: "apt" | "ransomware" | "unknown";
    currentDecision: "chargeable" | "caveated" | "held" | "suppressed";
    targetDecision: "chargeable" | "caveated" | "held" | "suppressed";
    missingFields: string[];
    requiredEvidenceFamily: "clear_web" | "public_advisory" | "public_channel" | "restricted_metadata" | "graph_ledger";
    blockerCodesRemoved: string[];
    expectedBuyerVisibleLift: string[];
    proofNeeded: string[];
    whyWorthPayingFor: string;
    repairAction: string;
    currentBuyerValue: number;
    targetBuyerValue: number;
    noLeak: true;
  }>;
  lift: {
    rowsLifted: number;
    rowsSuppressed: number;
    rowsHeldWithRepairAction: number;
    blockerCodesRemoved: number;
    averageBuyerValueDelta: number;
  };
  ownerHandoffs: Array<{
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
    fixtureCount: number;
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
