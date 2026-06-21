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
} = {}): HostedApifyPaidReadinessProof {
  const tokenState = input.hasToken === true ? "token_present_manual_verification_required" : "external_token_missing";
  const observedProof = input.observedProof ?? readInlineObservedProofFromEnvironment();
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
    && observedProof.pricingModel.length > 0
    && observedProof.payoutEnabled === true
  );
  const importedPaidFloorProof = hosted100NameProofObserved && marketplaceValuesObserved;
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
      commandExamples: [
        "TI_APIFY_OBSERVED_PROOF_JSON='<json>' bun run check:hosted-apify-paid-readiness",
        "TI_APIFY_OBSERVED_PROOF_PATH=docs/examples/hosted-apify-observed-proof.sample.json bun run check:hosted-apify-paid-readiness",
        "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=run bun run check:hosted-apify-paid-readiness",
        "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=verify TI_APIFY_HOSTED_RUN_ID=<run id> bun run check:hosted-apify-paid-readiness",
        "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=verify TI_APIFY_HOSTED_DATASET_ID=<dataset id> bun run check:hosted-apify-paid-readiness"
      ],
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
