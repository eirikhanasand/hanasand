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

interface HostedApifyProofImportPath {
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

type HostedProofOperatorGateState = "pass" | "hold" | "blocked_sample" | "blocked_unsafe";
type HostedEvidenceImportState = "no_proof_imported" | "proof_imported_but_insufficient" | "proof_sufficient_for_private_beta" | "proof_sufficient_for_public_traffic";

interface HostedProofOperatorChecklist {
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
  manualVerificationSteps: string[];
  blockers: string[];
}

export function buildHostedApifyPaidReadinessProof(input: {
  hasToken?: boolean;
  status?: HostedApifyPaidReadinessStatus;
  hostedImport?: HostedApifyProofObservation;
  observedProof?: HostedApifyObservedProofImport;
  readObservedProofFromEnvironment?: boolean;
} = {}): HostedApifyPaidReadinessProof {
  const tokenState = input.hasToken === true ? "token_present_manual_verification_required" : "external_token_missing";
  const observedProof = input.observedProof ?? (input.readObservedProofFromEnvironment === false ? undefined : readInlineObservedProofFromEnvironment());
  const observedFields = normalizeHostedObservation(observedProof ?? input.hostedImport);
  const observedProofIsProduction = Boolean(observedProof && observedProof.sampleOnly !== true);
  const hosted100NameRunObserved = Boolean(
    observedFields.runId
    && observedFields.datasetId
    && observedFields.datasetItemCount !== null
    && observedFields.sellableRows !== null
    && observedFields.sellableFindingCount !== null
    && observedFields.caveatedRows !== null
    && observedFields.averageBuyerValueScore !== null
    && observedFields.noLeakFailures === 0
  );
  const hosted100NameProofObserved = Boolean(
    hosted100NameRunObserved
    && observedFields.secondBatchAuditObserved === true
    && observedFields.falsePositiveInflationFailures === 0
    && (observedFields.sellableRows ?? 0) >= 100
    && (observedFields.sellableFindingCount ?? 0) >= 52
  );
  const marketplaceValuesObserved = Boolean(
    observedProofIsProduction
    && observedProof
    && Number.isFinite(observedProof.storeViews)
    && Number.isFinite(observedProof.runs)
    && Number.isFinite(observedProof.uniqueUsers)
    && Number.isFinite(observedProof.paidUsers)
    && Number.isFinite(observedProof.refunds)
    && typeof observedProof.pricingModel === "string"
    && observedProof.pricingModel.length > 0
    && observedProof.payoutEnabled === true
    && observedProof.payoutState === "enabled"
    && observedProof.analyticsVisible === true
    && Number.isFinite(observedProof.conversionRate)
    && (observedProof.listingVisibility === "private" || observedProof.listingVisibility === "public")
  );
  const importedPaidFloorProof = hosted100NameProofObserved && marketplaceValuesObserved;
  const externalBlocker = hostedPaidProofExternalBlocker({
    importedPaidFloorProof,
    tokenState,
    hosted100NameRunObserved,
    hosted100NameProofObserved,
    marketplaceValuesObserved,
    observedFields
  });
  const commandExamples = [
    "TI_APIFY_OBSERVED_PROOF_JSON='<json>' bun run check:hosted-apify-paid-readiness",
    "TI_APIFY_OBSERVED_PROOF_PATH=docs/examples/hosted-apify-observed-proof.sample.json bun run check:hosted-apify-paid-readiness",
    "TI_APIFY_OBSERVED_PROOF_PATH=docs/examples/hosted-apify-observed-proof.hosted300.template.json bun run check:hosted-apify-paid-readiness",
    "TI_APIFY_OBSERVED_PROOF_PATH=docs/examples/hosted-apify-observed-proof.hosted500.template.json bun run check:hosted-apify-paid-readiness",
    "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=run bun run check:hosted-apify-paid-readiness",
    "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=verify TI_APIFY_HOSTED_RUN_ID=<run id> bun run check:hosted-apify-paid-readiness",
    "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=verify TI_APIFY_HOSTED_DATASET_ID=<dataset id> bun run check:hosted-apify-paid-readiness"
  ];
  const hostedProofOperatorChecklist = buildHostedProofOperatorChecklist({
    observedProof,
    observedFields,
    commandExamples,
    marketplaceValuesObserved,
    hasToken: input.hasToken === true,
    hasRunOrDatasetId: Boolean(process.env.TI_APIFY_HOSTED_RUN_ID || process.env.TI_APIFY_HOSTED_DATASET_ID),
    hasObservedProofImportSource: Boolean(process.env.TI_APIFY_OBSERVED_PROOF_JSON || process.env.TI_APIFY_OBSERVED_PROOF_PATH)
  });
  const conversionPayoutTruth = buildConversionPayoutTruth(observedProof, observedFields, marketplaceValuesObserved, hostedProofOperatorChecklist);
  const programFgObservedEvidenceBoard = buildProgramFgObservedEvidenceBoard({
    observedProof,
    observedFields,
    checklist: hostedProofOperatorChecklist,
    marketplaceValuesObserved,
    commandExamples
  });
  return {
    schemaVersion: "ti.hosted_apify_paid_readiness_proof.v1",
    status: input.status ?? (importedPaidFloorProof ? "paid_floor_hosted_proof" : tokenState === "external_token_missing" ? "external_token_missing" : hosted100NameRunObserved ? "verified_hold" : "hosted_proof_missing"),
    sourceOfTruth: "Apify hosted Actor run, default dataset, Store analytics, pricing, and billing/payout pages",
    actorId: "eirikhanasand/public-threat-actor-monitor",
    command: "bun run check:hosted-apify-paid-readiness",
    tokenState,
    paidTrafficAllowed: false,
    countsTowardPaidPromotion: false,
    localProof: {
      source: "local 100-name buyer preset",
      defaultQueryCount: 100,
      datasetItemCount: 607,
      sellableRows: 187,
      sellableFindingCount: 52,
      caveatedRows: 420,
      averageBuyerValueScore: 0.593,
      proofDecision: "local_paid_floor_pass_hosted_proof_required",
      countsTowardPaidPromotion: false
    },
    localCurrent500Gate: {
      schemaVersion: "ti.hosted_apify_local_current500_gate.v1",
      source: "local current sellable-row packet",
      sellableRows: 500,
      sellableFindingRows: 275,
      noLeakFailures: 0,
      falsePositiveInflationFailures: 0,
      proofDecision: "local_current500_pass_hosted500_proof_required",
      countsTowardPaidPromotion: false,
      hostedProofStillRequired: true
    },
    latestHostedProof: {
      source: "Apify hosted single-query shape/safety proof",
      historical: true,
      runId: "OThlfd0uzSCNnedAO",
      datasetId: "LSen2fYtwFTtOr7vK",
      querySetCount: 1,
      datasetItemCount: 10,
      sellableRows: 4,
      sellableFindingCount: null,
      caveatedRows: 2,
      averageBuyerValueScore: 0.577,
      runtimeSeconds: null,
      memoryMbytes: null,
      usageUsd: null,
      costUsd: null,
      proofDecision: "shape_safety_proof",
      paidFloorProof: false,
      countsTowardPaidPromotion: false
    },
    hostedProofImportPath: {
      schemaVersion: "ti.hosted_apify_proof_import_path.v1",
      mode: "json_import_or_run_or_verify_with_apify_token",
      observedOnly: true,
      noSyntheticFallback: true,
      oldProofTreatment: "historical_shape_safety_only",
      externalBlocker,
      commandExamples,
      requiredEnvironment: [
        "APIFY_TOKEN",
        "TI_APIFY_ACTOR_ID=eirikhanasand/public-threat-actor-monitor",
        "TI_APIFY_HOSTED_PROOF_MODE=run|verify",
        "TI_APIFY_HOSTED_RUN_ID=<run id for verify mode>",
        "TI_APIFY_HOSTED_DATASET_ID=<dataset id when run metadata is unavailable>",
        "TI_APIFY_OBSERVED_PROOF_JSON=<single observed proof JSON>",
        "TI_APIFY_OBSERVED_PROOF_PATH=<path to observed proof JSON>"
      ],
      observedFields,
      observedProofImport: {
        schemaVersion: "ti.hosted_apify_observed_proof_import_path.v1",
        acceptedSources: ["TI_APIFY_OBSERVED_PROOF_JSON", "TI_APIFY_OBSERVED_PROOF_PATH"],
        sampleOnly: observedProof?.sampleOnly === true,
        observedAt: observedProof?.observedAt ?? null,
        validationState: observedProof ? "accepted" : "missing",
        validationErrors: []
      }
    },
    hostedProofOperatorChecklist,
    requiredHostedPreset: {
      defaultQueryCount: 100,
      maxRowsPerQuery: 25,
      includeCoverageGaps: false,
      includeHeldRows: false,
      includeDatasets: false,
      customQueriesAllowedForPaidProof: false
    },
    requiredHostedMetrics: ["runId", "buildId", "runStatus", "failureState", "datasetId", "datasetItemCount", "sellableRows", "sellableFindingCount", "caveatedRows", "averageBuyerValueScore", "runtimeSeconds", "memoryMbytes", "usageUsd", "costUsd", "chargedEventCount", "chargedDatasetItemEvents", "chargedActorStartEvents"],
    paidProofAcceptance: {
      minimumDefaultQueryCount: 100,
      minimumSellableRows: 100,
      minimumSellableFindingRows: 52,
      hostedProofLadder: {
        hosted100: { minimumSellableRows: 100, minimumSellableFindingRows: 52 },
        hosted300: { minimumSellableRows: 300, minimumSellableFindingRows: 150 },
        hosted500: { minimumSellableRows: 500, minimumSellableFindingRows: 275 }
      },
      sourceProvenanceRowsCountTowardFindingFloor: false,
      noLeakFailures: 0,
      falsePositiveInflationFailures: 0,
      pricingStateMustBeObserved: true,
      payoutStateMustBeObserved: true,
      marketplaceTelemetryMustBeObserved: true
    },
    paidRowIntegrityGate: {
      schemaVersion: "ti.program_cp_hosted_paid_row_integrity_gate.v1",
      sourceProofField: "falsePositiveSuppressionGate.programCpHardening.secondBatchAudit",
      requiredForPaidPromotion: true,
      hostedProofCountsTowardPaidPromotion: false,
      sourceProvenanceRowsCountTowardFindingFloor: false,
      requiredZeroCounts: {
        staleLatestActivitySellableRows: 0,
        aliasOrWrongActorSellableRows: 0,
        genericSourcePageSellableRows: 0,
        graphOnlySellableRows: 0,
        restrictedOnlySellableRows: 0
      },
      caveatedRowsCountTowardChargeable: false,
      requiredSignals: ["current_public_support", "actor_specific", "finding_context", "freshness_not_stale", "provenance_hash", "no_leak", "buyer_action"],
      blockers: [
        "hosted_100_name_cp_second_batch_audit_not_yet_observed",
        "source_provenance_rows_do_not_count_as_findings",
        "stale_alias_generic_graph_restricted_rows_must_be_zero"
      ],
      noLeakProof: {
        rawEvidenceExposed: false,
        unsafeUrlsExposed: false,
        restrictedPayloadsExposed: false,
        objectKeysExposed: false,
        privateMaterialExposed: false,
        actorInteractionContentExposed: false
      }
    },
    marketplaceConversionInputs: {
      storeViews: marketplaceValuesObserved && observedProof ? observedProof.storeViews : null,
      runs: marketplaceValuesObserved && observedProof ? observedProof.runs : null,
      uniqueUsers: marketplaceValuesObserved && observedProof ? observedProof.uniqueUsers : null,
      paidUsers: marketplaceValuesObserved && observedProof ? observedProof.paidUsers : null,
      refunds: marketplaceValuesObserved && observedProof ? observedProof.refunds : null,
      payoutEnabled: marketplaceValuesObserved && observedProof ? observedProof.payoutEnabled : "external_unknown",
      pricingModel: marketplaceValuesObserved && observedProof ? observedProof.pricingModel : "external_unknown",
      publicListingStatus: marketplaceValuesObserved && observedProof ? observedProof.publicListingStatus : "draft_copy_ready_not_promoted",
      lastVerifiedAt: marketplaceValuesObserved && observedProof ? observedProof.observedAt : null,
      unknownMeansNoClaim: true
    },
    conversionPayoutTruth,
    programFgObservedEvidenceBoard,
    manualVerificationSteps: [
      "Publish or rebuild eirikhanasand/public-threat-actor-monitor from the current Actor package.",
      "Start a hosted Apify run with the default 100-name input: no custom query list, maxRowsPerQuery=25, includeCoverageGaps=false, includeHeldRows=false, includeDatasets=false.",
      "After success, record run id, build id, run status, failure state, default dataset id, dataset item count, sellable rows, sellable finding count, caveated rows, average buyer value, runtime, memory, usage cost, charged events, and no-leak result.",
      "Paste the complete observed proof once through TI_APIFY_OBSERVED_PROOF_JSON or TI_APIFY_OBSERVED_PROOF_PATH; partial marketplace or hosted proof imports are rejected.",
      "Compare hosted OUTPUT falsePositiveSuppressionGate.programCpHardening.secondBatchAudit against the paid-row integrity gate: source-provenance rows do not count as findings, and stale/latest, alias/wrong-actor, generic-source-page, graph-only, restricted-only, and caveated-as-chargeable failures are zero.",
      "Open Apify Store analytics and record analytics visibility, store views, runs, unique users, paid users, refunds, and conversion rate; leave unavailable fields external_unknown rather than inventing values.",
      "Open Apify billing/payouts and Store pricing/listing, then record payout state, pricing model, listing visibility, public listing status, and last verified timestamp.",
      "Promote paid traffic only when hosted sellable rows are at least 500, hosted finding rows are at least 275, and payout, pricing, telemetry, listing state, refunds, and no-leak proof are observed."
    ],
    blockers: [
      "hosted_100_name_apify_run_not_yet_verified",
      "hosted_100_name_cp_second_batch_audit_not_yet_observed",
      "external_payout_pricing_analytics_not_yet_verified"
    ]
  };
}

function hostedPaidProofExternalBlocker(input: {
  importedPaidFloorProof: boolean;
  tokenState: HostedApifyPaidReadinessProof["tokenState"];
  hosted100NameRunObserved: boolean;
  hosted100NameProofObserved: boolean;
  marketplaceValuesObserved: boolean;
  observedFields: Required<HostedApifyProofObservation>;
}): HostedApifyProofImportPath["externalBlocker"] {
  if (input.importedPaidFloorProof) return null;
  if (input.tokenState === "external_token_missing") return "external_token_missing";
  if (!input.hosted100NameRunObserved) return "hosted_100_name_run_not_observed";
  if ((input.observedFields.sellableRows ?? 0) < 100 || (input.observedFields.sellableFindingCount ?? 0) < 52) {
    return "hosted_100_name_run_below_paid_floor";
  }
  if (input.observedFields.secondBatchAuditObserved !== true) return "hosted_second_batch_audit_not_observed";
  if (input.observedFields.falsePositiveInflationFailures !== 0) return "hosted_false_positive_audit_not_observed";
  if (input.hosted100NameProofObserved && !input.marketplaceValuesObserved) return "external_payout_pricing_analytics_not_yet_verified";
  return null;
}

const observedProofRequiredFields = [
  "schemaVersion",
  "runId",
  "buildId",
  "runStatus",
  "failureState",
  "datasetId",
  "proofPreset",
  "defaultQueryCount",
  "maxRowsPerQuery",
  "includeCoverageGaps",
  "includeHeldRows",
  "includeDatasets",
  "datasetItemCount",
  "sellableRows",
  "sellableFindingCount",
  "caveatedRows",
  "averageBuyerValueScore",
  "runtimeSeconds",
  "memoryMbytes",
  "usageUsd",
  "costUsd",
  "chargedEventCount",
  "chargedDatasetItemEvents",
  "chargedActorStartEvents",
  "noLeakFailures",
  "secondBatchAuditObserved",
  "falsePositiveInflationFailures",
  "storeViews",
  "runs",
  "uniqueUsers",
  "paidUsers",
  "refunds",
  "pricingModel",
  "payoutEnabled",
  "payoutState",
  "analyticsVisible",
  "conversionRate",
  "listingVisibility",
  "publicListingStatus",
  "observedAt"
] as const;

const marketplaceObservedFieldNames = [
  "storeViews",
  "runs",
  "uniqueUsers",
  "paidUsers",
  "refunds",
  "pricingModel",
  "payoutEnabled",
  "payoutState",
  "analyticsVisible",
  "conversionRate",
  "listingVisibility",
  "publicListingStatus",
  "observedAt"
] as const satisfies ReadonlyArray<(typeof observedProofRequiredFields)[number]>;

const hostedProofGateRequiredFields = [
  "schemaVersion",
  "runId",
  "buildId",
  "runStatus",
  "failureState",
  "datasetId",
  "proofPreset",
  "defaultQueryCount",
  "maxRowsPerQuery",
  "includeCoverageGaps",
  "includeHeldRows",
  "includeDatasets",
  "datasetItemCount",
  "sellableRows",
  "sellableFindingCount",
  "caveatedRows",
  "averageBuyerValueScore",
  "runtimeSeconds",
  "memoryMbytes",
  "usageUsd",
  "costUsd",
  "chargedEventCount",
  "chargedDatasetItemEvents",
  "chargedActorStartEvents",
  "noLeakFailures",
  "secondBatchAuditObserved",
  "falsePositiveInflationFailures",
  "publicListingStatus",
  "observedAt"
] as const;

function buildHostedProofOperatorChecklist(input: {
  observedProof: HostedApifyObservedProofImport | undefined;
  observedFields: Required<HostedApifyProofObservation>;
  commandExamples: string[];
  marketplaceValuesObserved: boolean;
  hasToken: boolean;
  hasRunOrDatasetId: boolean;
  hasObservedProofImportSource: boolean;
}): HostedProofOperatorChecklist {
  const sampleOnly = input.observedProof?.sampleOnly === true;
  const productionObserved = Boolean(input.observedProof && !sampleOnly);
  const missingFields = observedProofRequiredFields.filter((field) => !hasObservedImportValue(input.observedProof, field));
  const hostedMissingFields = hostedProofGateRequiredFields.filter((field) => !hasObservedImportValue(input.observedProof, field));
  const acceptedObservedFields = observedProofRequiredFields.filter((field) => hasObservedImportValue(input.observedProof, field));
  const unsafeProof = input.observedFields.noLeakFailures !== null && input.observedFields.noLeakFailures !== 0
    || input.observedFields.falsePositiveInflationFailures !== null && input.observedFields.falsePositiveInflationFailures !== 0;
  const hosted100Pass = productionObserved
    && hostedMissingFields.length === 0
    && (input.observedProof?.defaultQueryCount ?? 0) >= 100
    && (input.observedFields.sellableRows ?? 0) >= 100
    && (input.observedFields.sellableFindingCount ?? 0) >= 52
    && input.observedFields.noLeakFailures === 0
    && input.observedFields.secondBatchAuditObserved === true
    && input.observedFields.falsePositiveInflationFailures === 0;
  const hosted300Pass = hosted100Pass
    && (input.observedFields.sellableRows ?? 0) >= 300
    && (input.observedFields.sellableFindingCount ?? 0) >= 150;
  const hosted500Pass = hosted300Pass
    && (input.observedFields.sellableRows ?? 0) >= 500
    && (input.observedFields.sellableFindingCount ?? 0) >= 275;
  const marketplacePromotionPass = hosted500Pass
    && input.marketplaceValuesObserved
    && input.observedProof?.refunds === 0
    && input.observedProof.publicListingStatus !== "draft_copy_ready_not_promoted";

  const blockedState: HostedProofOperatorGateState = sampleOnly ? "blocked_sample" : unsafeProof ? "blocked_unsafe" : "hold";
  const unlockSummary: HostedProofOperatorChecklist["unlockSummary"] = marketplacePromotionPass
    ? "hosted100_hosted300_hosted500_marketplace_promotion"
    : hosted500Pass
      ? "hosted100_hosted300_hosted500"
      : hosted300Pass
        ? "hosted100_hosted300"
        : hosted100Pass
          ? "hosted100"
          : "none";
  const stillBlockedAfterCommand = operatorStillBlockedAfterCommand({
    sampleOnly,
    unsafeProof,
    hosted100Pass,
    hosted300Pass,
    hosted500Pass,
    marketplacePromotionPass,
    marketplaceValuesObserved: input.marketplaceValuesObserved,
    missingFields,
    observedFields: input.observedFields,
    hasToken: input.hasToken,
    hasObservedProofImportSource: input.hasObservedProofImportSource,
    publicListingStatus: input.observedProof?.publicListingStatus
  });

  return {
    schemaVersion: "ti.hosted_apify_proof_operator_checklist.v1",
    status: sampleOnly ? "sample_only" : productionObserved ? "production_observed" : "missing_proof",
    requiredFields: [...observedProofRequiredFields],
    missingFields,
    acceptedObservedFields,
    lastObservedTimestamp: input.observedProof?.observedAt ?? input.observedFields.lastVerifiedAt ?? null,
    sampleOnly,
    unlockSummary,
    operatorActionBoard: {
      canRunNow: input.hasToken,
      canVerifyRunNow: input.hasToken && input.hasRunOrDatasetId,
      canImportObservedProofNow: input.hasObservedProofImportSource,
      missingSecretNames: input.hasToken ? [] : ["APIFY_TOKEN"],
      missingObservedFields: missingFields,
      nextCommand: nextOperatorCommand(input),
      expectedUnlock: unlockSummary,
      stillBlockedAfterCommand
    },
    gateEffects: {
      hosted100: {
        state: hosted100Pass ? "pass" : blockedState,
        unlocks: hosted100Pass,
        reason: hosted100Pass ? "production observed proof satisfies the hosted 100-name floor" : hosted100GateHoldReason(sampleOnly, unsafeProof, hostedMissingFields, input.observedFields),
        required: { defaultQueryCount: 100, sellableRows: 100, sellableFindingRows: 52, noLeakFailures: 0, falsePositiveInflationFailures: 0 }
      },
      hosted300: {
        state: hosted300Pass ? "pass" : blockedState,
        unlocks: hosted300Pass,
        reason: hosted300Pass ? "production observed proof satisfies the hosted 300-row gate" : hosted100Pass ? "hosted 100 passes, but hosted sellable rows or finding rows are below the 300 gate" : gateHoldReason(sampleOnly, unsafeProof, hostedMissingFields, "hosted 100 must pass before hosted 300 can unlock"),
        required: { sellableRows: 300, sellableFindingRows: 150, noLeakFailures: 0, falsePositiveInflationFailures: 0 }
      },
      hosted500: {
        state: hosted500Pass ? "pass" : blockedState,
        unlocks: hosted500Pass,
        reason: hosted500Pass ? "production observed proof satisfies the hosted 500-row paid promotion gate" : hosted300Pass ? "hosted 300 passes, but hosted sellable rows or finding rows are below the hosted 500 paid promotion gate" : gateHoldReason(sampleOnly, unsafeProof, hostedMissingFields, "hosted 300 must pass before hosted 500 can unlock"),
        required: { sellableRows: 500, sellableFindingRows: 275, noLeakFailures: 0, falsePositiveInflationFailures: 0 }
      },
      marketplacePromotion: {
        state: marketplacePromotionPass ? "pass" : blockedState,
        unlocks: marketplacePromotionPass,
        reason: marketplacePromotionPass ? "hosted 500 and observed marketplace state allow promotion review" : marketplacePromotionHoldReason(sampleOnly, unsafeProof, hosted500Pass, input.marketplaceValuesObserved, input.observedProof?.publicListingStatus),
        required: { hosted500: true, payoutEnabled: true, pricingModelObserved: true, analyticsObserved: true, refunds: 0, publicListingState: "public_listed_not_promoted_or_public_promoted" }
      }
    },
    copyPasteCommands: input.commandExamples,
    validationExamples: [
      {
        name: "missing_proof",
        expectedStatus: "accepted_hold",
        unlockSummary: "none",
        reason: "no observed JSON was supplied, so every required hosted and marketplace field remains missing"
      },
      {
        name: "sample_proof_rejected_for_promotion",
        expectedStatus: "accepted_sample_no_unlock",
        unlockSummary: "none",
        reason: "sampleOnly=true imports can prove shape but cannot unlock hosted or marketplace gates"
      },
      {
        name: "valid_hosted100_hosted300_hold",
        expectedStatus: "accepted_hold",
        unlockSummary: "hosted100",
        reason: "a production proof with at least 100 sellable rows and 52 findings unlocks hosted100 while hosted300 stays held below 300 sellable rows"
      },
      {
        name: "valid_hosted300_hosted500_hold",
        expectedStatus: "accepted_hold",
        unlockSummary: "hosted100_hosted300",
        reason: "a production proof with 300 hosted sellable rows and 150 findings still keeps hosted500 held below 500 sellable rows and 275 findings"
      },
      {
        name: "valid_hosted500_marketplace_hold",
        expectedStatus: "accepted_hold",
        unlockSummary: "hosted100_hosted300_hosted500",
        reason: "a production proof with 500 hosted sellable rows and 275 findings still keeps marketplace promotion held when listing state remains draft or marketplace fields are not observed"
      },
      {
        name: "invalid_unsafe_no_leak_proof",
        expectedStatus: "rejected",
        unlockSummary: "none",
        reason: "any noLeakFailures value above 0 or false-positive inflation failure is rejected by the import checker"
      }
    ]
  };
}

function buildConversionPayoutTruth(
  observedProof: HostedApifyObservedProofImport | undefined,
  observedFields: Required<HostedApifyProofObservation>,
  marketplaceValuesObserved: boolean,
  checklist: HostedProofOperatorChecklist
): HostedApifyPaidReadinessProof["conversionPayoutTruth"] {
  const hosted500Pass = checklist.gateEffects.hosted500.unlocks;
  const analyticsObserved = marketplaceValuesObserved && Boolean(observedProof);
  const listingStatus = observedProof?.publicListingStatus;
  const listingObserved = marketplaceValuesObserved && Boolean(listingStatus);
  const listingBlocked = listingObserved && listingStatus === "draft_copy_ready_not_promoted";
  return {
    schemaVersion: "ti.hosted_apify_conversion_payout_truth.v1",
    observedOnly: true,
    noSyntheticFallback: true,
    pricing: {
      state: marketplaceValuesObserved && observedProof ? "observed" : "external_unknown",
      value: marketplaceValuesObserved && observedProof ? observedProof.pricingModel : "external_unknown",
      proofField: "pricingModel",
      nextOperatorAction: marketplaceValuesObserved ? "retain observed Store pricing evidence with timestamp" : "open Apify Store pricing and import pricingModel from authenticated evidence"
    },
    payout: {
      state: marketplaceValuesObserved && observedProof ? "observed" : "external_unknown",
      enabled: marketplaceValuesObserved && observedProof ? observedProof.payoutEnabled : "external_unknown",
      proofField: "payoutEnabled",
      nextOperatorAction: marketplaceValuesObserved ? "retain observed billing/payout evidence with timestamp" : "open Apify billing/payouts and import payoutEnabled from authenticated evidence"
    },
    analytics: {
      state: analyticsObserved ? "observed" : "external_unknown",
      storeViews: analyticsObserved && observedProof ? observedProof.storeViews : null,
      runs: analyticsObserved && observedProof ? observedProof.runs : null,
      uniqueUsers: analyticsObserved && observedProof ? observedProof.uniqueUsers : null,
      paidUsers: analyticsObserved && observedProof ? observedProof.paidUsers : null,
      refunds: analyticsObserved && observedProof ? observedProof.refunds : null,
      nextOperatorAction: analyticsObserved ? "retain observed Store analytics with timestamp" : "open Apify Store analytics and import views, runs, users, paid users, and refunds from authenticated evidence"
    },
    marketplaceListing: {
      state: listingBlocked ? "blocked" : listingObserved ? "observed" : "external_unknown",
      publicListingStatus: listingObserved && listingStatus ? listingStatus : "external_unknown",
      nextOperatorAction: listingBlocked ? "publish or promote listing only after hosted500, payout, pricing, analytics, and refunds are observed" : listingObserved ? "retain observed listing state with timestamp" : "open Apify Store listing and import publicListingStatus from authenticated evidence"
    },
    hosted500: {
      state: hosted500Pass ? "observed" : observedProof ? "blocked" : "external_unknown",
      requiredSellableRows: 500,
      requiredSellableFindingRows: 275,
      observedSellableRows: observedFields.sellableRows,
      observedSellableFindingRows: observedFields.sellableFindingCount,
      nextOperatorAction: hosted500Pass ? "retain hosted500 proof and continue marketplace evidence review" : "run or import hosted proof with at least 500 sellable rows, 275 finding rows, no leaks, and zero false-positive inflation failures"
    }
  };
}

function buildProgramFgObservedEvidenceBoard(input: {
  observedProof: HostedApifyObservedProofImport | undefined;
  observedFields: Required<HostedApifyProofObservation>;
  checklist: HostedProofOperatorChecklist;
  marketplaceValuesObserved: boolean;
  commandExamples: string[];
}): HostedApifyPaidReadinessProof["programFgObservedEvidenceBoard"] {
  const noProofImported = !input.observedProof;
  const sampleOnly = input.observedProof?.sampleOnly === true;
  const hosted100Pass = input.checklist.gateEffects.hosted100.unlocks;
  const hosted500Pass = input.checklist.gateEffects.hosted500.unlocks;
  const marketplacePromotionPass = input.checklist.gateEffects.marketplacePromotion.unlocks;
  const listingVisibility = input.marketplaceValuesObserved && input.observedProof ? input.observedProof.listingVisibility : "external_unknown";
  const publicListingStatus = input.marketplaceValuesObserved && input.observedProof ? input.observedProof.publicListingStatus : "external_unknown";
  const publicListingReady = listingVisibility === "public" && publicListingStatus !== "draft_copy_ready_not_promoted";
  const importState: HostedEvidenceImportState = noProofImported
    ? "no_proof_imported"
    : hosted500Pass && marketplacePromotionPass && publicListingReady
      ? "proof_sufficient_for_public_traffic"
      : hosted100Pass && input.marketplaceValuesObserved
        ? "proof_sufficient_for_private_beta"
        : "proof_imported_but_insufficient";
  const hostedProofState = importState === "proof_sufficient_for_public_traffic"
    ? "sufficient_for_public_traffic"
    : importState === "proof_sufficient_for_private_beta"
      ? "sufficient_for_private_beta"
      : noProofImported
        ? "missing"
        : "insufficient";
  const marketplaceTruthState = input.marketplaceValuesObserved && publicListingReady
    ? "observed_public"
    : input.marketplaceValuesObserved
      ? "observed_private"
      : noProofImported
        ? "external_unknown"
        : "insufficient";
  const releaseBlockerState = importState === "proof_sufficient_for_public_traffic"
    ? "ready_for_public_traffic_review"
    : importState === "proof_sufficient_for_private_beta"
      ? "ready_for_private_beta_review"
      : importState;
  const missingExternalFields = noProofImported
    ? [...observedProofRequiredFields]
    : input.checklist.missingFields;
  const marketplaceMissingFields = marketplaceObservedFieldNames.filter((field) => !hasObservedImportValue(input.observedProof, field));
  const insufficientFields = [
    sampleOnly ? "sampleOnly" : null,
    !hosted100Pass ? "hosted100" : null,
    hosted100Pass && !hosted500Pass ? "hosted500" : null,
    !input.marketplaceValuesObserved ? "marketplace_truth" : null,
    input.marketplaceValuesObserved && !publicListingReady ? "public_listing_visibility" : null,
    input.observedProof?.refunds !== undefined && input.observedProof.refunds !== 0 ? "refunds" : null,
    input.observedFields.failureState && input.observedFields.failureState !== "none" ? "failureState" : null
  ].filter((value): value is string => Boolean(value));

  return {
    schemaVersion: "ti.program_fg_observed_apify_hosted_marketplace_truth.v1",
    importState,
    hostedProofState,
    marketplaceTruthState,
    releaseBlockerState,
    noSyntheticFallback: true,
    blockedProofClasses: ["sample", "template", "partial", "local_only", "historical_shape_safety"],
    observedHostedRun: {
      runId: input.observedFields.runId,
      buildId: input.observedFields.buildId,
      datasetId: input.observedFields.datasetId,
      runStatus: input.observedFields.runStatus,
      failureState: input.observedFields.failureState,
      runDurationSeconds: input.observedFields.runtimeSeconds,
      usageUsd: input.observedFields.usageUsd,
      costUsd: input.observedFields.costUsd,
      chargedEventCount: input.observedFields.chargedEventCount,
      chargedDatasetItemEvents: input.observedFields.chargedDatasetItemEvents,
      chargedActorStartEvents: input.observedFields.chargedActorStartEvents
    },
    observedMarketplaceTruth: {
      listingVisibility,
      publicListingStatus,
      pricingModel: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.pricingModel : "external_unknown",
      payoutState: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.payoutState : "external_unknown",
      analyticsVisible: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.analyticsVisible : "external_unknown",
      storeViews: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.storeViews : null,
      runs: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.runs : null,
      uniqueUsers: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.uniqueUsers : null,
      paidUsers: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.paidUsers : null,
      refunds: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.refunds : null,
      conversionRate: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.conversionRate : null,
      lastVerifiedAt: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.observedAt : null
    },
    missingExternalFields,
    insufficientFields,
    marketplaceMissingFieldsOnlyTemplate: {
      schemaVersion: "ti.program_fh_marketplace_missing_fields_template.v1",
      safeToCommit: true,
      containsSecrets: false,
      importCommand: "TI_APIFY_OBSERVED_PROOF_PATH=<path-to-observed-proof.json> bun run check:hosted-apify-paid-readiness",
      missingFields: marketplaceMissingFields,
      fields: {
        storeViews: null,
        runs: null,
        uniqueUsers: null,
        paidUsers: null,
        refunds: null,
        pricingModel: "external_unknown",
        payoutEnabled: "external_unknown",
        payoutState: "external_unknown",
        analyticsVisible: "external_unknown",
        conversionRate: null,
        listingVisibility: "external_unknown",
        publicListingStatus: "external_unknown",
        observedAt: null
      }
    },
    nextSafeCommands: [
      "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=run bun run check:hosted-apify-paid-readiness",
      "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=verify TI_APIFY_HOSTED_RUN_ID=<run id> bun run check:hosted-apify-paid-readiness",
      "TI_APIFY_OBSERVED_PROOF_PATH=<path-to-observed-proof.json> bun run check:hosted-apify-paid-readiness",
      ...input.commandExamples.filter((command) => command.includes("hosted-apify-observed-proof"))
    ]
  };
}

function nextOperatorCommand(input: {
  commandExamples: string[];
  hasToken: boolean;
  hasRunOrDatasetId: boolean;
  hasObservedProofImportSource: boolean;
}): string {
  if (input.hasObservedProofImportSource) return "bun run check:hosted-apify-paid-readiness";
  if (input.hasToken && input.hasRunOrDatasetId) return "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=verify TI_APIFY_HOSTED_RUN_ID=<run id> bun run check:hosted-apify-paid-readiness";
  if (input.hasToken) return "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=run bun run check:hosted-apify-paid-readiness";
  return input.commandExamples.find((command) => command.includes("APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=run")) ?? "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=run bun run check:hosted-apify-paid-readiness";
}

function operatorStillBlockedAfterCommand(input: {
  sampleOnly: boolean;
  unsafeProof: boolean;
  hosted100Pass: boolean;
  hosted300Pass: boolean;
  hosted500Pass: boolean;
  marketplacePromotionPass: boolean;
  marketplaceValuesObserved: boolean;
  missingFields: string[];
  observedFields: Required<HostedApifyProofObservation>;
  hasToken: boolean;
  hasObservedProofImportSource: boolean;
  publicListingStatus: HostedApifyObservedProofImport["publicListingStatus"] | undefined;
}): string[] {
  const blockers: string[] = [];
  if (!input.hasToken && !input.hasObservedProofImportSource) blockers.push("APIFY_TOKEN missing or observed proof JSON/path missing");
  if (input.missingFields.length > 0) blockers.push(`observed proof fields missing: ${input.missingFields.join(", ")}`);
  if (input.sampleOnly) blockers.push("sampleOnly=true cannot unlock hosted or marketplace gates");
  if (input.unsafeProof) blockers.push("no-leak and false-positive inflation failures must be zero");
  if (!input.hosted100Pass) blockers.push(hosted100ThresholdBlocker(input.observedFields));
  if (input.hosted100Pass && !input.hosted300Pass) blockers.push("hosted300 remains held until a production observed proof reaches 300 sellable rows and 150 finding rows");
  if (input.hosted300Pass && !input.hosted500Pass) blockers.push("hosted500 remains held until a production observed proof reaches 500 sellable rows and 275 finding rows");
  if (input.hosted500Pass && !input.marketplaceValuesObserved) blockers.push("marketplace analytics, pricing, payout, paid users, runs, and refunds remain external_unknown/null");
  if (input.hosted500Pass && input.publicListingStatus === "draft_copy_ready_not_promoted") blockers.push("public listing state remains draft_copy_ready_not_promoted");
  if (!input.marketplacePromotionPass) blockers.push("paid marketplace promotion remains blocked");
  return [...new Set(blockers)];
}

function hasObservedImportValue(proof: HostedApifyObservedProofImport | undefined, field: (typeof observedProofRequiredFields)[number]): boolean {
  if (!proof) return false;
  const value = proof[field];
  if (value === null || value === undefined) return false;
  return typeof value !== "string" || value.trim().length > 0;
}

function gateHoldReason(sampleOnly: boolean, unsafeProof: boolean, missingFields: string[], fallback: string): string {
  if (sampleOnly) return "sampleOnly=true imports are accepted for shape checks but cannot unlock production gates";
  if (unsafeProof) return "unsafe proof was observed; no-leak and false-positive inflation failures must be zero";
  if (missingFields.length > 0) return `missing required fields: ${missingFields.join(", ")}`;
  return fallback;
}

function hosted100GateHoldReason(
  sampleOnly: boolean,
  unsafeProof: boolean,
  missingFields: string[],
  observedFields: Required<HostedApifyProofObservation>
): string {
  if (sampleOnly) return "sampleOnly=true imports are accepted for shape checks but cannot unlock production gates";
  if (unsafeProof) return "unsafe proof was observed; no-leak and false-positive inflation failures must be zero";
  const observedSellableRows = observedFields.sellableRows;
  const observedFindingRows = observedFields.sellableFindingCount;
  if (observedSellableRows !== null && observedFindingRows !== null && (observedSellableRows < 100 || observedFindingRows < 52)) {
    return hosted100ThresholdBlocker(observedFields);
  }
  if (missingFields.length > 0) return `missing required fields: ${missingFields.join(", ")}`;
  return "hosted 100-name proof is incomplete";
}

function hosted100ThresholdBlocker(observedFields: Required<HostedApifyProofObservation>): string {
  const observedSellableRows = observedFields.sellableRows;
  const observedFindingRows = observedFields.sellableFindingCount;
  if (observedSellableRows === null || observedFindingRows === null) {
    return "hosted100 remains held until a production observed proof reaches 100 sellable rows and 52 finding rows";
  }
  const sellableGap = Math.max(0, 100 - observedSellableRows);
  const findingGap = Math.max(0, 52 - observedFindingRows);
  return `hosted100_below_threshold: observed ${observedSellableRows} sellable rows and ${observedFindingRows} finding rows; needs +${sellableGap} sellable rows and +${findingGap} finding rows`;
}

function marketplacePromotionHoldReason(
  sampleOnly: boolean,
  unsafeProof: boolean,
  hosted500Pass: boolean,
  marketplaceValuesObserved: boolean,
  publicListingStatus: HostedApifyObservedProofImport["publicListingStatus"] | undefined
): string {
  if (sampleOnly) return "sampleOnly=true imports cannot unlock marketplace promotion";
  if (unsafeProof) return "unsafe proof blocks marketplace promotion";
  if (!hosted500Pass) return "hosted500 must pass before marketplace promotion can unlock";
  if (!marketplaceValuesObserved) return "pricing, payout, Store analytics, paid users, runs, and refunds must be observed";
  if (publicListingStatus === "draft_copy_ready_not_promoted") return "listing state is still draft_copy_ready_not_promoted";
  return "marketplace promotion remains held until observed external state is complete";
}

function readInlineObservedProofFromEnvironment(): HostedApifyObservedProofImport | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const raw = env?.TI_APIFY_OBSERVED_PROOF_JSON;
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isObservedProofImport(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isObservedProofImport(value: unknown): value is HostedApifyObservedProofImport {
  if (!isRecord(value)) return false;
  return value.schemaVersion === "ti.hosted_apify_observed_proof_import.v1"
    && value.proofPreset === "100_name_paid_preset"
    && value.maxRowsPerQuery === 25
    && value.includeCoverageGaps === false
    && value.includeHeldRows === false
    && value.includeDatasets === false
    && typeof value.buildId === "string"
    && typeof value.runStatus === "string"
    && typeof value.failureState === "string"
    && typeof value.pricingModel === "string"
    && typeof value.payoutEnabled === "boolean"
    && typeof value.payoutState === "string"
    && typeof value.analyticsVisible === "boolean"
    && typeof value.conversionRate === "number"
    && typeof value.listingVisibility === "string"
    && typeof value.publicListingStatus === "string"
    && typeof value.observedAt === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeHostedObservation(input: HostedApifyProofObservation | undefined): Required<HostedApifyProofObservation> {
  const inputRecord = isRecord(input) ? input : {};
  return {
    runId: input?.runId ?? null,
    buildId: input?.buildId ?? null,
    runStatus: input?.runStatus ?? null,
    failureState: input?.failureState ?? null,
    datasetId: input?.datasetId ?? null,
    datasetItemCount: finiteNumberOrNull(input?.datasetItemCount),
    sellableRows: finiteNumberOrNull(input?.sellableRows),
    sellableFindingCount: finiteNumberOrNull(input?.sellableFindingCount),
    caveatedRows: finiteNumberOrNull(input?.caveatedRows),
    averageBuyerValueScore: finiteNumberOrNull(input?.averageBuyerValueScore),
    runtimeSeconds: finiteNumberOrNull(input?.runtimeSeconds),
    memoryMbytes: finiteNumberOrNull(input?.memoryMbytes),
    usageUsd: finiteNumberOrNull(input?.usageUsd),
    costUsd: finiteNumberOrNull(input?.costUsd),
    chargedEventCount: finiteNumberOrNull(input?.chargedEventCount),
    chargedDatasetItemEvents: finiteNumberOrNull(input?.chargedDatasetItemEvents),
    chargedActorStartEvents: finiteNumberOrNull(input?.chargedActorStartEvents),
    noLeakFailures: finiteNumberOrNull(input?.noLeakFailures),
    secondBatchAuditObserved: input?.secondBatchAuditObserved === true,
    falsePositiveInflationFailures: finiteNumberOrNull(input?.falsePositiveInflationFailures),
    lastVerifiedAt: input?.lastVerifiedAt ?? (typeof inputRecord.observedAt === "string" ? inputRecord.observedAt : null)
  };
}

function finiteNumberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
