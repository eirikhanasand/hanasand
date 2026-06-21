import type { HostedApifyPaidReadinessStatus, HostedApifyProofObservation, HostedApifyObservedProofImport, HostedApifyProofImportPath, HostedProofOperatorChecklist, HostedProofOperatorGateState, HostedEvidenceImportState, HostedApifyPaidReadinessProof } from "./hostedApifyPaidReadinessTypes.ts";
import { buildHostedProofOperatorChecklist, buildConversionPayoutTruth, buildProgramFgObservedEvidenceBoard, buildHostedProofDeltaSincePrevious, readInlineObservedProofFromEnvironment, normalizeHostedObservation } from "./hostedApifyPaidReadinessSupport.ts";

export type {
  HostedApifyPaidReadinessStatus,
  HostedApifyProofObservation,
  HostedApifyObservedProofImport,
  HostedApifyProofImportPath,
  HostedProofOperatorChecklist,
  HostedProofOperatorGateState,
  HostedEvidenceImportState,
  HostedApifyPaidReadinessProof
} from "./hostedApifyPaidReadinessTypes.ts";

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
  const hostedProofDeltaSincePrevious = buildHostedProofDeltaSincePrevious(observedFields);
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
    hostedProofDeltaSincePrevious,
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
