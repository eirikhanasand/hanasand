export interface First100AdmissionQuality {
  schemaVersion: "ti.apify_first_100_paid_row_admission_quality.v1";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  productionSellableFloor: 100;
  fixtureCount: number;
  admissionRules: {
    requireFreshEnough: true;
    requireActorSpecific: true;
    requireSourceBacked: true;
    requireSourceFamilySupport: true;
    requireBuyerAction: true;
    requireProvenanceHash: true;
    requireNoContradictions: true;
    forbidUnsafeRestrictedOnlyDependency: true;
    forbidDefaultDemoOldSummary: true;
  };
  classificationCounts: Record<"accepted_sellable" | "caveated_useful" | "needs_public_support" | "stale_duplicate" | "alias_collision" | "wrong_actor" | "restricted_only" | "graph_only" | "synthetic_proof_only" | "generic_market_source_page" | "low_buyer_value", number>;
  metrics: {
    rowsAdmittedToProductionFloor: number;
    rowsDowngradedToCaveatedContext: number;
    rowsSuppressed: number;
    rowsNeedingParserRepair: number;
    rowsNeedingSourceSupport: number;
    rowsNeedingDarkMetadataPublicSupport: number;
    estimatedBuyerValueDelta: number;
    rowCountInflationBlocked: number;
  };
  actorCoverage: string[];
  sampleRows: Array<{
    id: string;
    actor: string;
    rowClass: keyof First100AdmissionQuality["classificationCounts"];
    admissionDecision: "admit_sellable" | "downgrade_caveated" | "repair_required" | "suppress";
    countsTowardProductionSellableRows: boolean;
    buyerValueScore: number;
    whyBuyerShouldCare: string;
    nextSearchOrPivot: string;
    provenanceHash: string;
    failureReasons: string[];
    repairOwner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
    noLeak: true;
  }>;
  nonSellableExclusionProof: Array<{
    class: "graph_only" | "synthetic_proof_only" | "stale_duplicate" | "restricted_only" | "caveated_useful" | "generic_market_source_page" | "low_buyer_value" | "alias_or_wrong_actor";
    countsAsSellable: false;
    reason: string;
  }>;
  ownerHandoffs: Array<{
    owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
    rowCount: number;
    action: string;
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
