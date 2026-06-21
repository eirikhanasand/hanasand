export interface PaidRowAudit100 {
  schemaVersion: "ti.apify_paid_row_audit_100.v1";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  targetSellableRows: 100;
  classifications: Array<{
    id: string;
    actor: string;
    family: "apt" | "ransomware";
    rowClass: "sellable" | "useful_caveated" | "needs_public_support" | "stale_or_duplicate" | "wrong_actor_or_alias_collision" | "restricted_only" | "not_payworthy";
    currentDecision: "sellable" | "included_with_caveat" | "coverage_gap_only" | "hold" | "suppress";
    countsTowardProductionSellableRows: boolean;
    repairOwner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_10";
    repairAction: string;
    blockerCodes: string[];
    expectedSellableLiftAfterRepair: number;
    rowsPreventedFromBilling: number;
    noLeak: true;
  }>;
  metrics: {
    currentSellableRows: number;
    protectedSellableRows: number;
    suppressedFalsePositives: number;
    rowsOneRepairAway: number;
    expectedSellableLiftAfterParserSourceRepairs: number;
    rowsPreventedFromBilling: number;
    productionSellableFloorGap: number;
  };
  exclusionProof: Array<{
    class: "graph_only_projection" | "synthetic_row" | "stale_or_duplicate" | "restricted_only" | "caveat_only";
    countsAsSellable: false;
    reason: string;
  }>;
  noLeakProof: {
    rawEvidenceExposed: false;
    unsafeUrlsExposed: false;
    restrictedPayloadsExposed: false;
    objectKeysExposed: false;
    privateMaterialExposed: false;
    accountMaterialExposed: false;
    actorInteractionContentExposed: false;
  };
}
