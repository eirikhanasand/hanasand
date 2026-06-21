export type HostedApifyPaidReadinessStatus = "external_token_missing" | "hosted_proof_missing" | "verified_hold" | "paid_floor_hosted_proof";

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
    countsTowardPaidPromotion: false;
  };
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
    storeViews: null;
    runs: null;
    uniqueUsers: null;
    paidUsers: null;
    refunds: null;
    payoutEnabled: "external_unknown";
    pricingModel: "external_unknown";
    publicListingStatus: "draft_copy_ready_not_promoted";
    lastVerifiedAt: null;
    unknownMeansNoClaim: true;
  };
  manualVerificationSteps: string[];
  blockers: string[];
}

export function buildHostedApifyPaidReadinessProof(input: {
  hasToken?: boolean;
  status?: HostedApifyPaidReadinessStatus;
} = {}): HostedApifyPaidReadinessProof {
  const tokenState = input.hasToken === true ? "token_present_manual_verification_required" : "external_token_missing";
  return {
    schemaVersion: "ti.hosted_apify_paid_readiness_proof.v1",
    status: input.status ?? (tokenState === "external_token_missing" ? "external_token_missing" : "hosted_proof_missing"),
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
      countsTowardPaidPromotion: false
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
      storeViews: null,
      runs: null,
      uniqueUsers: null,
      paidUsers: null,
      refunds: null,
      payoutEnabled: "external_unknown",
      pricingModel: "external_unknown",
      publicListingStatus: "draft_copy_ready_not_promoted",
      lastVerifiedAt: null,
      unknownMeansNoClaim: true
    },
    manualVerificationSteps: [
      "Publish or rebuild eirikhanasand/public-threat-actor-monitor from the current Actor package.",
      "Start a hosted Apify run with the default 100-name input: no custom query list, maxRowsPerQuery=25, includeCoverageGaps=false, includeHeldRows=false, includeDatasets=false.",
      "After success, record run id, default dataset id, dataset item count, sellable rows, sellable finding count, caveated rows, average buyer value, runtime, memory, usage cost, and no-leak result.",
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
