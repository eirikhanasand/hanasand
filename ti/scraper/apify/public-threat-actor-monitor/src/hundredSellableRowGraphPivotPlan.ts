export interface HundredSellableRowGraphPivotPlan {
  schemaVersion: "ti.apify_100_sellable_row_graph_pivot_plan.v1";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  targetSellableRows: 100;
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  projectedSellableRows: number;
  projectedUsefulRows: number;
  projectedFreshRows: number;
  projectedSourceFamilyDiversity: number;
  nextSearchPivotCount: number;
  averageBuyerValueDelta: number;
  rowsPreventedFromBilling: number;
  watchlistPlans: Array<{
    actor: string;
    family: "apt" | "ransomware";
    projectedSellableRows: number;
    projectedUsefulRows: number;
    projectedFreshRows: number;
    oneRepairAwayRows: number;
    sourceFamiliesNeeded: string[];
    graphPivots: string[];
    nextSearches: string[];
    parserNeeds: string[];
    sourceNeeds: string[];
    noLeak: true;
  }>;
  rejectionGates: Array<{
    id: string;
    blockedReason: "stale_only" | "single_source_without_caveat" | "contradicted" | "unrelated" | "missing_provenance" | "unsafe_restricted_only" | "alias_only" | "not_actionable";
    rowsPreventedFromBilling: number;
    owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08";
    proofNote: string;
    noLeak: true;
  }>;
  repairHandoffs: Array<{
    owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_10";
    missingFieldsOrFamilies: string[];
    expectedSellableRowsUnlocked: number;
    expectedEffect: string;
  }>;
  noLeakBoundary: {
    rawEvidenceBodies: false;
    unsafeUrls: false;
    credentials: false;
    leakedFiles: false;
    privateMaterial: false;
    actorInteraction: false;
  };
}
