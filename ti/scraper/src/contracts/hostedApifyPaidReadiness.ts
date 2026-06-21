export type HostedApifyPaidReadinessStatus = "external_token_missing" | "hosted_proof_missing" | "verified_hold" | "paid_floor_hosted_proof";

export interface HostedApifyProofObservation {
  runId?: string | null;
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
  externalBlocker: "external_token_missing" | "hosted_100_name_run_not_observed" | null;
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

interface HostedProofOperatorChecklist {
  schemaVersion: "ti.hosted_apify_proof_operator_checklist.v1";
  status: "missing_proof" | "sample_only" | "production_observed";
  requiredFields: string[];
  missingFields: string[];
  acceptedObservedFields: string[];
  lastObservedTimestamp: string | null;
  sampleOnly: boolean;
  unlockSummary: "none" | "hosted100" | "hosted100_hosted300" | "hosted100_hosted300_marketplace_promotion";
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
    marketplacePromotion: {
      state: HostedProofOperatorGateState;
      unlocks: boolean;
      reason: string;
      required: { hosted300: true; payoutEnabled: true; pricingModelObserved: true; analyticsObserved: true; refunds: 0; publicListingState: "public_listed_not_promoted_or_public_promoted" };
    };
  };
  copyPasteCommands: string[];
  validationExamples: Array<{
    name: "missing_proof" | "sample_proof_rejected_for_promotion" | "valid_hosted100_hosted300_hold" | "valid_hosted300_marketplace_hold" | "invalid_unsafe_no_leak_proof";
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
  requiredHostedMetrics: Array<"runId" | "datasetId" | "datasetItemCount" | "sellableRows" | "sellableFindingCount" | "caveatedRows" | "averageBuyerValueScore" | "runtimeSeconds" | "memoryMbytes" | "usageUsd" | "costUsd">;
  paidProofAcceptance: {
    minimumDefaultQueryCount: 100;
    minimumSellableRows: 100;
    minimumSellableFindingRows: 52;
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
  const hosted100NameProofObserved = Boolean(
    observedFields.runId
    && observedFields.datasetId
    && observedFields.datasetItemCount !== null
    && observedFields.sellableRows !== null
    && observedFields.sellableFindingCount !== null
    && observedFields.caveatedRows !== null
    && observedFields.averageBuyerValueScore !== null
    && observedFields.noLeakFailures === 0
    && observedFields.secondBatchAuditObserved === true
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
  );
  const importedPaidFloorProof = hosted100NameProofObserved && marketplaceValuesObserved;
  const commandExamples = [
    "TI_APIFY_OBSERVED_PROOF_JSON='<json>' bun run check:hosted-apify-paid-readiness",
    "TI_APIFY_OBSERVED_PROOF_PATH=docs/examples/hosted-apify-observed-proof.sample.json bun run check:hosted-apify-paid-readiness",
    "TI_APIFY_OBSERVED_PROOF_PATH=docs/examples/hosted-apify-observed-proof.hosted300.template.json bun run check:hosted-apify-paid-readiness",
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
  return {
    schemaVersion: "ti.hosted_apify_paid_readiness_proof.v1",
    status: input.status ?? (importedPaidFloorProof ? "paid_floor_hosted_proof" : tokenState === "external_token_missing" ? "external_token_missing" : hosted100NameProofObserved ? "verified_hold" : "hosted_proof_missing"),
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
      externalBlocker: importedPaidFloorProof ? null : tokenState === "external_token_missing" ? "external_token_missing" : hosted100NameProofObserved ? null : "hosted_100_name_run_not_observed",
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
    requiredHostedMetrics: ["runId", "datasetId", "datasetItemCount", "sellableRows", "sellableFindingCount", "caveatedRows", "averageBuyerValueScore", "runtimeSeconds", "memoryMbytes", "usageUsd", "costUsd"],
    paidProofAcceptance: {
      minimumDefaultQueryCount: 100,
      minimumSellableRows: 100,
      minimumSellableFindingRows: 52,
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
    manualVerificationSteps: [
      "Publish or rebuild eirikhanasand/public-threat-actor-monitor from the current Actor package.",
      "Start a hosted Apify run with the default 100-name input: no custom query list, maxRowsPerQuery=25, includeCoverageGaps=false, includeHeldRows=false, includeDatasets=false.",
      "After success, record run id, default dataset id, dataset item count, sellable rows, sellable finding count, caveated rows, average buyer value, runtime, memory, usage cost, and no-leak result.",
      "Paste the complete observed proof once through TI_APIFY_OBSERVED_PROOF_JSON or TI_APIFY_OBSERVED_PROOF_PATH; partial marketplace or hosted proof imports are rejected.",
      "Compare hosted OUTPUT falsePositiveSuppressionGate.programCpHardening.secondBatchAudit against the paid-row integrity gate: source-provenance rows do not count as findings, and stale/latest, alias/wrong-actor, generic-source-page, graph-only, restricted-only, and caveated-as-chargeable failures are zero.",
      "Open Apify Store analytics and record store views, runs, unique users, paid users, and refunds; leave unavailable fields null.",
      "Open Apify billing/payouts and Store pricing, then record payout enabled, pricing model, and last verified timestamp.",
      "Promote paid traffic only when hosted sellable rows are at least 100 and payout, pricing, telemetry, and no-leak proof are observed."
    ],
    blockers: [
      "hosted_100_name_apify_run_not_yet_verified",
      "hosted_100_name_cp_second_batch_audit_not_yet_observed",
      "external_payout_pricing_analytics_not_yet_verified"
    ]
  };
}

const observedProofRequiredFields = [
  "schemaVersion",
  "runId",
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
  "publicListingStatus",
  "observedAt"
] as const;

const hostedProofGateRequiredFields = [
  "schemaVersion",
  "runId",
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
  const marketplacePromotionPass = hosted300Pass
    && input.marketplaceValuesObserved
    && input.observedProof?.refunds === 0
    && input.observedProof.publicListingStatus !== "draft_copy_ready_not_promoted";

  const blockedState: HostedProofOperatorGateState = sampleOnly ? "blocked_sample" : unsafeProof ? "blocked_unsafe" : "hold";
  const unlockSummary: HostedProofOperatorChecklist["unlockSummary"] = marketplacePromotionPass
    ? "hosted100_hosted300_marketplace_promotion"
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
    marketplacePromotionPass,
    marketplaceValuesObserved: input.marketplaceValuesObserved,
    missingFields,
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
        reason: hosted100Pass ? "production observed proof satisfies the hosted 100-name floor" : gateHoldReason(sampleOnly, unsafeProof, hostedMissingFields, "hosted 100-name proof is incomplete"),
        required: { defaultQueryCount: 100, sellableRows: 100, sellableFindingRows: 52, noLeakFailures: 0, falsePositiveInflationFailures: 0 }
      },
      hosted300: {
        state: hosted300Pass ? "pass" : blockedState,
        unlocks: hosted300Pass,
        reason: hosted300Pass ? "production observed proof satisfies the hosted 300-row gate" : hosted100Pass ? "hosted 100 passes, but hosted sellable rows or finding rows are below the 300 gate" : gateHoldReason(sampleOnly, unsafeProof, hostedMissingFields, "hosted 100 must pass before hosted 300 can unlock"),
        required: { sellableRows: 300, sellableFindingRows: 150, noLeakFailures: 0, falsePositiveInflationFailures: 0 }
      },
      marketplacePromotion: {
        state: marketplacePromotionPass ? "pass" : blockedState,
        unlocks: marketplacePromotionPass,
        reason: marketplacePromotionPass ? "hosted 300 and observed marketplace state allow promotion review" : marketplacePromotionHoldReason(sampleOnly, unsafeProof, hosted300Pass, input.marketplaceValuesObserved, input.observedProof?.publicListingStatus),
        required: { hosted300: true, payoutEnabled: true, pricingModelObserved: true, analyticsObserved: true, refunds: 0, publicListingState: "public_listed_not_promoted_or_public_promoted" }
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
        name: "valid_hosted300_marketplace_hold",
        expectedStatus: "accepted_hold",
        unlockSummary: "hosted100_hosted300",
        reason: "a production proof with 300 hosted sellable rows and 150 findings still keeps marketplace promotion held when listing state remains draft or marketplace fields are not observed"
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
  marketplacePromotionPass: boolean;
  marketplaceValuesObserved: boolean;
  missingFields: string[];
  hasToken: boolean;
  hasObservedProofImportSource: boolean;
  publicListingStatus: HostedApifyObservedProofImport["publicListingStatus"] | undefined;
}): string[] {
  const blockers: string[] = [];
  if (!input.hasToken && !input.hasObservedProofImportSource) blockers.push("APIFY_TOKEN missing or observed proof JSON/path missing");
  if (input.missingFields.length > 0) blockers.push(`observed proof fields missing: ${input.missingFields.join(", ")}`);
  if (input.sampleOnly) blockers.push("sampleOnly=true cannot unlock hosted or marketplace gates");
  if (input.unsafeProof) blockers.push("no-leak and false-positive inflation failures must be zero");
  if (!input.hosted100Pass) blockers.push("hosted100 remains held until a production observed proof reaches 100 sellable rows and 52 finding rows");
  if (input.hosted100Pass && !input.hosted300Pass) blockers.push("hosted300 remains held until a production observed proof reaches 300 sellable rows and 150 finding rows");
  if (input.hosted300Pass && !input.marketplaceValuesObserved) blockers.push("marketplace analytics, pricing, payout, paid users, runs, and refunds remain external_unknown/null");
  if (input.hosted300Pass && input.publicListingStatus === "draft_copy_ready_not_promoted") blockers.push("public listing state remains draft_copy_ready_not_promoted");
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

function marketplacePromotionHoldReason(
  sampleOnly: boolean,
  unsafeProof: boolean,
  hosted300Pass: boolean,
  marketplaceValuesObserved: boolean,
  publicListingStatus: HostedApifyObservedProofImport["publicListingStatus"] | undefined
): string {
  if (sampleOnly) return "sampleOnly=true imports cannot unlock marketplace promotion";
  if (unsafeProof) return "unsafe proof blocks marketplace promotion";
  if (!hosted300Pass) return "hosted300 must pass before marketplace promotion can unlock";
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
    && typeof value.pricingModel === "string"
    && typeof value.payoutEnabled === "boolean"
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
    noLeakFailures: finiteNumberOrNull(input?.noLeakFailures),
    secondBatchAuditObserved: input?.secondBatchAuditObserved === true,
    falsePositiveInflationFailures: finiteNumberOrNull(input?.falsePositiveInflationFailures),
    lastVerifiedAt: input?.lastVerifiedAt ?? (typeof inputRecord.observedAt === "string" ? inputRecord.observedAt : null)
  };
}

function finiteNumberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
