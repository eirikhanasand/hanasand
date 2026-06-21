export type HostedApifyPaidReadinessStatus = "external_token_missing" | "hosted_proof_missing" | "verified_hold" | "paid_floor_hosted_proof";

export interface HostedApifyProofObservation {
  runId?: string | null;
  buildId?: string | null;
  runStatus?: "succeeded" | "failed" | "timed_out" | "aborted" | "external_unknown" | null;
  failureState?: "none" | "failed" | "timed_out" | "aborted" | "external_unknown" | null;
  datasetId?: string | null;
  datasetItemCount?: number | null;
  sellableRows?: number | null;
  sellableFindingCount?: number | null;
  caveatedRows?: number | null;
  averageBuyerValueScore?: number | null;
  runtimeSeconds?: number | null;
  memoryMbytes?: number | null;
  usageUsd?: number | null;
  costUsd?: number | null;
  chargedEventCount?: number | null;
  chargedDatasetItemEvents?: number | null;
  chargedActorStartEvents?: number | null;
  noLeakFailures?: number | null;
  secondBatchAuditObserved?: boolean;
  falsePositiveInflationFailures?: number | null;
  lastVerifiedAt?: string | null;
}

export interface HostedApifyObservedProofImport extends HostedApifyProofObservation {
  schemaVersion: "ti.hosted_apify_observed_proof_import.v1";
  proofPreset: "100_name_paid_preset";
  defaultQueryCount: number;
  maxRowsPerQuery: 25;
  includeCoverageGaps: false;
  includeHeldRows: false;
  includeDatasets: false;
  storeViews: number;
  runs: number;
  uniqueUsers: number;
  paidUsers: number;
  refunds: number;
  pricingModel: string;
  payoutEnabled: boolean;
  payoutState: "enabled" | "disabled";
  analyticsVisible: boolean;
  conversionRate: number;
  listingVisibility: "private" | "public";
  publicListingStatus: "draft_copy_ready_not_promoted" | "public_listed_not_promoted" | "public_promoted";
  observedAt: string;
  sampleOnly?: boolean;
}

export interface HostedApifyProofImportPath {
  schemaVersion: "ti.hosted_apify_proof_import_path.v1";
  mode: "json_import_or_run_or_verify_with_apify_token";
  observedOnly: true;
  noSyntheticFallback: true;
  oldProofTreatment: "historical_shape_safety_only";
  externalBlocker: "external_token_missing" | "hosted_100_name_run_not_observed" | "hosted_100_name_run_below_paid_floor" | "hosted_second_batch_audit_not_observed" | "hosted_false_positive_audit_not_observed" | "external_payout_pricing_analytics_not_yet_verified" | null;
  commandExamples: string[];
  requiredEnvironment: string[];
  observedFields: Required<HostedApifyProofObservation>;
  observedProofImport: {
    schemaVersion: "ti.hosted_apify_observed_proof_import_path.v1";
    acceptedSources: Array<"TI_APIFY_OBSERVED_PROOF_JSON" | "TI_APIFY_OBSERVED_PROOF_PATH">;
    sampleOnly: boolean;
    observedAt: string | null;
    validationState: "missing" | "accepted";
    validationErrors: string[];
  };
}

export type HostedProofOperatorGateState = "pass" | "hold" | "blocked_sample" | "blocked_unsafe";
export type HostedEvidenceImportState = "no_proof_imported" | "proof_imported_but_insufficient" | "proof_sufficient_for_private_beta" | "proof_sufficient_for_public_traffic";

export interface HostedProofOperatorChecklist {
  schemaVersion: "ti.hosted_apify_proof_operator_checklist.v1";
  status: "missing_proof" | "sample_only" | "production_observed";
  requiredFields: string[];
  missingFields: string[];
  acceptedObservedFields: string[];
  lastObservedTimestamp: string | null;
  sampleOnly: boolean;
  unlockSummary: "none" | "hosted100" | "hosted100_hosted300" | "hosted100_hosted300_hosted500" | "hosted100_hosted300_hosted500_marketplace_promotion";
  operatorActionBoard: {
    canRunNow: boolean;
    canVerifyRunNow: boolean;
    canImportObservedProofNow: boolean;
    missingSecretNames: string[];
    missingObservedFields: string[];
    nextCommand: string;
    expectedUnlock: HostedProofOperatorChecklist["unlockSummary"];
    stillBlockedAfterCommand: string[];
  };
  gateEffects: {
    hosted100: {
      state: HostedProofOperatorGateState;
      unlocks: boolean;
      reason: string;
      required: { defaultQueryCount: 100; sellableRows: 100; sellableFindingRows: 52; noLeakFailures: 0; falsePositiveInflationFailures: 0 };
    };
    hosted300: {
      state: HostedProofOperatorGateState;
      unlocks: boolean;
      reason: string;
      required: { sellableRows: 300; sellableFindingRows: 150; noLeakFailures: 0; falsePositiveInflationFailures: 0 };
    };
    hosted500: {
      state: HostedProofOperatorGateState;
      unlocks: boolean;
      reason: string;
      required: { sellableRows: 500; sellableFindingRows: 275; noLeakFailures: 0; falsePositiveInflationFailures: 0 };
    };
    marketplacePromotion: {
      state: HostedProofOperatorGateState;
      unlocks: boolean;
      reason: string;
      required: { hosted500: true; payoutEnabled: true; pricingModelObserved: true; analyticsObserved: true; refunds: 0; publicListingState: "public_listed_not_promoted_or_public_promoted" };
    };
  };
  copyPasteCommands: string[];
  validationExamples: Array<{
    name: "missing_proof" | "sample_proof_rejected_for_promotion" | "valid_hosted100_hosted300_hold" | "valid_hosted300_hosted500_hold" | "valid_hosted500_marketplace_hold" | "invalid_unsafe_no_leak_proof";
    expectedStatus: "accepted_hold" | "accepted_sample_no_unlock" | "rejected";
    unlockSummary: HostedProofOperatorChecklist["unlockSummary"];
    reason: string;
  }>;
}

export interface HostedApifyPaidReadinessProof {
  schemaVersion: "ti.hosted_apify_paid_readiness_proof.v1";
  status: HostedApifyPaidReadinessStatus;
  sourceOfTruth: "Apify hosted Actor run, default dataset, Store analytics, pricing, and billing/payout pages";
  actorId: "eirikhanasand/public-threat-actor-monitor";
  command: "bun run check:hosted-apify-paid-readiness";
  tokenState: "external_token_missing" | "token_present_manual_verification_required";
  paidTrafficAllowed: false;
  countsTowardPaidPromotion: false;
  localProof: {
    source: "local 100-name buyer preset";
    defaultQueryCount: 100;
    datasetItemCount: 607;
    sellableRows: 187;
    sellableFindingCount: 52;
    caveatedRows: 420;
    averageBuyerValueScore: 0.593;
    proofDecision: "local_paid_floor_pass_hosted_proof_required";
    countsTowardPaidPromotion: false;
  };
  localCurrent500Gate: {
    schemaVersion: "ti.hosted_apify_local_current500_gate.v1";
    source: "local current sellable-row packet";
    sellableRows: 500;
    sellableFindingRows: 275;
    noLeakFailures: 0;
    falsePositiveInflationFailures: 0;
    proofDecision: "local_current500_pass_hosted500_proof_required";
    countsTowardPaidPromotion: false;
    hostedProofStillRequired: true;
  };
  latestHostedProof: {
    source: "Apify hosted single-query shape/safety proof";
    historical: true;
    runId: "OThlfd0uzSCNnedAO";
    datasetId: "LSen2fYtwFTtOr7vK";
    querySetCount: 1;
    datasetItemCount: 10;
    sellableRows: 4;
    sellableFindingCount: null;
    caveatedRows: 2;
    averageBuyerValueScore: 0.577;
    runtimeSeconds: null;
    memoryMbytes: null;
    usageUsd: null;
    costUsd: null;
    proofDecision: "shape_safety_proof";
    paidFloorProof: false;
    countsTowardPaidPromotion: false;
  };
  hostedProofImportPath: HostedApifyProofImportPath;
  hostedProofOperatorChecklist: HostedProofOperatorChecklist;
  requiredHostedPreset: {
    defaultQueryCount: 100;
    maxRowsPerQuery: 25;
    includeCoverageGaps: false;
    includeHeldRows: false;
    includeDatasets: false;
    customQueriesAllowedForPaidProof: false;
  };
  requiredHostedMetrics: Array<"runId" | "buildId" | "runStatus" | "failureState" | "datasetId" | "datasetItemCount" | "sellableRows" | "sellableFindingCount" | "caveatedRows" | "averageBuyerValueScore" | "runtimeSeconds" | "memoryMbytes" | "usageUsd" | "costUsd" | "chargedEventCount" | "chargedDatasetItemEvents" | "chargedActorStartEvents">;
  paidProofAcceptance: {
    minimumDefaultQueryCount: 100;
    minimumSellableRows: 100;
    minimumSellableFindingRows: 52;
    hostedProofLadder: {
      hosted100: { minimumSellableRows: 100; minimumSellableFindingRows: 52 };
      hosted300: { minimumSellableRows: 300; minimumSellableFindingRows: 150 };
      hosted500: { minimumSellableRows: 500; minimumSellableFindingRows: 275 };
    };
    sourceProvenanceRowsCountTowardFindingFloor: false;
    noLeakFailures: 0;
    falsePositiveInflationFailures: 0;
    pricingStateMustBeObserved: true;
    payoutStateMustBeObserved: true;
    marketplaceTelemetryMustBeObserved: true;
  };
  paidRowIntegrityGate: {
    schemaVersion: "ti.program_cp_hosted_paid_row_integrity_gate.v1";
    sourceProofField: "falsePositiveSuppressionGate.programCpHardening.secondBatchAudit";
    requiredForPaidPromotion: true;
    hostedProofCountsTowardPaidPromotion: false;
    sourceProvenanceRowsCountTowardFindingFloor: false;
    requiredZeroCounts: {
      staleLatestActivitySellableRows: 0;
      aliasOrWrongActorSellableRows: 0;
      genericSourcePageSellableRows: 0;
      graphOnlySellableRows: 0;
      restrictedOnlySellableRows: 0;
    };
    caveatedRowsCountTowardChargeable: false;
    requiredSignals: Array<"current_public_support" | "actor_specific" | "finding_context" | "freshness_not_stale" | "provenance_hash" | "no_leak" | "buyer_action">;
    blockers: Array<"hosted_100_name_cp_second_batch_audit_not_yet_observed" | "source_provenance_rows_do_not_count_as_findings" | "stale_alias_generic_graph_restricted_rows_must_be_zero">;
    noLeakProof: {
      rawEvidenceExposed: false;
      unsafeUrlsExposed: false;
      restrictedPayloadsExposed: false;
      objectKeysExposed: false;
      privateMaterialExposed: false;
      actorInteractionContentExposed: false;
    };
  };
  marketplaceConversionInputs: {
    storeViews: number | null;
    runs: number | null;
    uniqueUsers: number | null;
    paidUsers: number | null;
    refunds: number | null;
    payoutEnabled: boolean | "external_unknown";
    pricingModel: string | "external_unknown";
    publicListingStatus: "draft_copy_ready_not_promoted" | "public_listed_not_promoted" | "public_promoted";
    lastVerifiedAt: string | null;
    unknownMeansNoClaim: true;
  };
  conversionPayoutTruth: {
    schemaVersion: "ti.hosted_apify_conversion_payout_truth.v1";
    observedOnly: true;
    noSyntheticFallback: true;
    pricing: {
      state: "observed" | "external_unknown";
      value: string | "external_unknown";
      proofField: "pricingModel";
      nextOperatorAction: string;
    };
    payout: {
      state: "observed" | "external_unknown";
      enabled: boolean | "external_unknown";
      proofField: "payoutEnabled";
      nextOperatorAction: string;
    };
    analytics: {
      state: "observed" | "external_unknown";
      storeViews: number | null;
      runs: number | null;
      uniqueUsers: number | null;
      paidUsers: number | null;
      refunds: number | null;
      nextOperatorAction: string;
    };
    marketplaceListing: {
      state: "observed" | "blocked" | "external_unknown";
      publicListingStatus: HostedApifyObservedProofImport["publicListingStatus"] | "external_unknown";
      nextOperatorAction: string;
    };
    hosted500: {
      state: "observed" | "blocked" | "external_unknown";
      requiredSellableRows: 500;
      requiredSellableFindingRows: 275;
      observedSellableRows: number | null;
      observedSellableFindingRows: number | null;
      nextOperatorAction: string;
    };
  };
  programFgObservedEvidenceBoard: {
    schemaVersion: "ti.program_fg_observed_apify_hosted_marketplace_truth.v1";
    importState: HostedEvidenceImportState;
    hostedProofState: "missing" | "insufficient" | "sufficient_for_private_beta" | "sufficient_for_public_traffic";
    marketplaceTruthState: "external_unknown" | "insufficient" | "observed_private" | "observed_public";
    releaseBlockerState: "no_proof_imported" | "proof_imported_but_insufficient" | "ready_for_private_beta_review" | "ready_for_public_traffic_review";
    noSyntheticFallback: true;
    blockedProofClasses: Array<"sample" | "template" | "partial" | "local_only" | "historical_shape_safety">;
    observedHostedRun: {
      runId: string | null;
      buildId: string | null;
      datasetId: string | null;
      runStatus: HostedApifyProofObservation["runStatus"];
      failureState: HostedApifyProofObservation["failureState"];
      runDurationSeconds: number | null;
      usageUsd: number | null;
      costUsd: number | null;
      chargedEventCount: number | null;
      chargedDatasetItemEvents: number | null;
      chargedActorStartEvents: number | null;
    };
    observedMarketplaceTruth: {
      listingVisibility: HostedApifyObservedProofImport["listingVisibility"] | "external_unknown";
      publicListingStatus: HostedApifyObservedProofImport["publicListingStatus"] | "external_unknown";
      pricingModel: string | "external_unknown";
      payoutState: HostedApifyObservedProofImport["payoutState"] | "external_unknown";
      analyticsVisible: boolean | "external_unknown";
      storeViews: number | null;
      runs: number | null;
      uniqueUsers: number | null;
      paidUsers: number | null;
      refunds: number | null;
      conversionRate: number | null;
      lastVerifiedAt: string | null;
    };
    missingExternalFields: string[];
    insufficientFields: string[];
    marketplaceMissingFieldsOnlyTemplate: {
      schemaVersion: "ti.program_fh_marketplace_missing_fields_template.v1";
      safeToCommit: true;
      containsSecrets: false;
      importCommand: "TI_APIFY_OBSERVED_PROOF_PATH=<path-to-observed-proof.json> bun run check:hosted-apify-paid-readiness";
      missingFields: string[];
      fields: {
        storeViews: null;
        runs: null;
        uniqueUsers: null;
        paidUsers: null;
        refunds: null;
        pricingModel: "external_unknown";
        payoutEnabled: "external_unknown";
        payoutState: "external_unknown";
        analyticsVisible: "external_unknown";
        conversionRate: null;
        listingVisibility: "external_unknown";
        publicListingStatus: "external_unknown";
        observedAt: null;
      };
    };
    nextSafeCommands: string[];
  };
  hostedProofDeltaSincePrevious: {
    schemaVersion: "ti.program_fi_hosted_proof_delta_since_previous.v1";
    baselineRunId: "THMm2ZzYxW4HVPGJ6";
    baselineDatasetId: "xLPoxMVY6cVjGsS4e";
    baselineSellableRows: 46;
    baselineSellableFindingRows: 31;
    currentRunId: string | null;
    currentDatasetId: string | null;
    currentSellableRows: number | null;
    currentSellableFindingRows: number | null;
    sellableRowsDelta: number | null;
    sellableFindingRowsDelta: number | null;
    hosted100SellableGap: number | null;
    hosted100FindingGap: number | null;
    direction: "no_current_hosted_proof_imported" | "improved_below_floor" | "regressed_or_flat_below_floor" | "hosted100_floor_reached";
    nextAction: string;
  };
  manualVerificationSteps: string[];
  blockers: string[];
}
