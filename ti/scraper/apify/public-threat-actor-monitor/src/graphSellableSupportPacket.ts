export interface GraphSellableSupportPacket {
  schemaVersion: "ti.apify_graph_sellable_support_packet.v1";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  productionSellableFloor: 100;
  supportExampleCount: number;
  graphOnlyRowsExcludedFromFloor: number;
  graphSupportedRepairCandidates: number;
  projectedSellableRowsUnlockedAfterNonGraphRepairs: number;
  nextBuyerSearchCount: number;
  averageAnalystConfidenceDelta: number;
  examples: Array<{
    actor: string;
    family: "apt" | "ransomware";
    relationshipSupport: string;
    supportingSourceFamily: "clear_web" | "public_channel" | "restricted_metadata" | "graph_ledger";
    sourceFamilyProofState: "proven" | "missing_public_support" | "metadata_only" | "single_source" | "none";
    contradictionState: "none" | "contradicted" | "review_hold";
    caveat: string;
    nextBuyerSearch: string;
    repairOwner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
    expectedSellableRowsUnlockedAfterRepair: number;
    countsTowardProductionSellableRows: false;
    noLeak: true;
  }>;
  ownerHandoffs: Array<{
    owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
    rowCount: number;
    action: string;
  }>;
  noLeakBoundary: {
    rawEvidenceBodies: false;
    unsafeUrls: false;
    objectKeys: false;
    credentials: false;
    payloadLinks: false;
    privateMaterial: false;
    actorInteraction: false;
  };
}
