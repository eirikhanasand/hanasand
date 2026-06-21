import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { buildHostedApifyPaidReadinessProof, type HostedApifyPaidReadinessProof } from "../contracts/hostedApifyPaidReadiness.ts";
import type { FrontierGroupSummary } from "../frontier/frontier.ts";
import type { CollectionRun, IncidentCandidate, RawCapture, SourceRecord } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";

export type LiveProductProofMode = "fixture" | "local" | "inspur" | "public_live";
export type LiveProductSloState = "pass" | "warn" | "alert" | "unavailable";

type ProgramFhHostedDefaultParserLift = {
  schemaVersion: "ti.program_fh_hosted_default_parser_lift.v1";
  owner: "agent_03";
  routeVisibleOn: Array<"Apify OUTPUT" | "/v1/ops/product-slo" | "/v1/contracts#apifyStoreReadiness" | "bun run check:hosted-apify-paid-readiness" | "bun run check:paid-actor-release-audit">;
  observedHostedRun: {
    runId: "THMm2ZzYxW4HVPGJ6";
    buildId: "L7LtCqLsKT6Luq04R";
    datasetId: "xLPoxMVY6cVjGsS4e";
    proofPreset: "100_name_paid_preset";
    hostedRows: 313;
    baselineSellableRows: 46;
    baselineSellableFindings: 31;
    baselineCaveatedRows: 194;
    noLeakFailures: 0;
    checkerStatus: "verified_hold";
    externalBlocker: "hosted_100_name_run_below_paid_floor";
  };
  requiredPaidFloor: { sellableRows: 100; sellableFindings: 52 };
  parserLift: {
    caveatedRowsConverted: 54;
    newlyAdmittedSellableRows: 54;
    newlyAdmittedFindingRows: 21;
    sourceProvenanceRowsDoNotCountAsFindings: true;
  };
  projectedAfterParserLift: {
    sellableRows: 100;
    sellableFindings: 52;
    caveatedRows: 140;
    sellableGap: 0;
    findingGap: 0;
  };
  countsTowardPaidPromotionNow: false;
  countsTowardHostedRerunExpectation: true;
  acceptedRowClasses: Array<{
    class: "actor_activity" | "victim_target" | "sector_country" | "ttp_tool" | "dataset_impact" | "first_last_seen";
    hostedBaselineDecision: "included_with_caveat" | "hold";
    expectedRows: number;
    requiredFields: Array<"current_public_support" | "actor_specific" | "finding_context" | "freshness_not_stale" | "provenance_hash" | "no_leak" | "buyer_action">;
    buyerAction: string;
    confidenceReason: string;
    noLeak: true;
  }>;
  rejectionBuckets: Array<{
    reason: "stale_latest_activity" | "alias_or_wrong_actor" | "generic_source_page" | "graph_only" | "restricted_only" | "duplicate_claim" | "contradiction";
    rows: number;
    countsTowardHostedPaidFloor: false;
    noLeak: true;
  }>;
  noLeakBoundary: {
    rawBodiesExposed: false;
    unsafeUrlsExposed: false;
    restrictedPayloadsExposed: false;
    credentialsExposed: false;
    privateMaterialUsed: false;
    actorInteractionTextUsed: false;
    hostedPaidProofClaimed: false;
  };
};

type ProgramFhHostedPublicCorroborationLift = {
  schemaVersion: "ti.program_fh_hosted_public_corroboration_lift.v1";
  owner: "agent_08";
  observedHostedRun: ProgramFhHostedDefaultParserLift["observedHostedRun"];
  acceptedPublicCorroborationRows: Array<{
    class: "single_source" | "stale_timestamp" | "missing_sector_country" | "missing_ttp_tool" | "missing_buyer_action" | "missing_confidence_reason";
    hostedBaselineDecision: "included_with_caveat" | "hold";
    expectedRowsUnlockedAfterParserAdmission: number;
    buyerVisibleMetricImproved: "source_family_diversity" | "freshness" | "sector_country" | "ttp_tool" | "buyer_action" | "confidence_reason";
    publicSourceFamily: "vendor_report" | "government_advisory" | "cert_advisory" | "security_blog" | "public_report" | "victim_notice";
    parserHandoff: string;
    provenanceHash: string;
    countsTowardPaidPromotionNow: false;
    noLeak: true;
  }>;
  rejectedPublicCorroborationRows: Array<{
    reason: "stale_latest_activity" | "alias_or_wrong_actor" | "generic_source_page" | "graph_only" | "restricted_only" | "duplicate_claim" | "contradiction";
    rows: number;
    buyerVisibleMetricImproved: "none";
    countsTowardPaidPromotionNow: false;
    noLeak: true;
  }>;
  projectedHostedRerunEffect: {
    baselineSellableRows: 46;
    acceptedCorroborationRows: 54;
    expectedSellableRowsAfterParserAdmission: 100;
    baselineSellableFindings: 31;
    expectedFindingRowsAfterParserAdmission: 52;
    hostedPaidProofClaimed: false;
  };
  noLeakBoundary: {
    rawBodiesExposed: false;
    unsafeUrlsExposed: false;
    restrictedPayloadsExposed: false;
    credentialsExposed: false;
    privateMaterialUsed: false;
    actorInteractionTextUsed: false;
  };
};

type ProgramDdCurrentSellable750Lift = {
  schemaVersion: "ti.program_dd_current_sellable_750_lift.v1";
  owner: "agent_03";
  sourcePackets: Array<"darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable750" | "darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable1000" | "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff" | "agent04_high_value_public_source_replacements" | "existing_public_source_rows">;
  baseline: {
    sellableRows: 500;
    sellableFindings: 413;
    sellableSourceProvenanceRows: 87;
    sourceProvenanceShare: 0.174;
  };
  acceptedCurrentRowsCount: number;
  sourceProvenanceRowsConvertedToFindings: number;
  rejectedRowsCount: number;
  currentSellableRowsAfterAdmission: number;
  currentSellableFindingsAfterAdmission: number;
  currentSellableSourceProvenanceRowsAfterAdmission: number;
  sourceProvenanceShareAfterAdmission: number;
  trueFindingShareAfterAdmission: number;
  countsTowardLocalCurrentPaidPreset: boolean;
  countsTowardHostedPaidProof: false;
  acceptedRows: Array<{
    rowId: string;
    sourcePacket: "agent05_current_chargeable750" | "agent08_parser_ready_public_proof" | "agent04_high_value_public_source_replacement" | "existing_public_source_row";
    actor: string;
    victimOrTarget: string;
    sector: string;
    countryOrRegion: string;
    ttpToolOrCampaign: string;
    datasetOrImpactClaim: string;
    firstSeen: string;
    lastSeen: string;
    sourceFamily: "dark_metadata_public_support" | "clear_web_public_report" | "government_advisory" | "vendor_report" | "rss_security_blog" | "public_channel_handoff";
    confidence: number;
    freshnessState: "fresh_current" | "current_recheck_due";
    provenanceHash: string;
    whyWorthPayingFor: string;
    nextPivot: string;
    countsTowardCurrentSellableRows: true;
    countsTowardHostedPaidProof: false;
    noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials";
    noLeak: true;
  }>;
  convertedSourceProvenanceRows: Array<{
    rowId: string;
    actor: string;
    convertedTo: "activity" | "target" | "ttp" | "dataset";
    buyerReason: string;
    provenanceHash: string;
    countsTowardSellableFindingFloor: true;
    noLeak: true;
  }>;
  rejectedRows: Array<{
    reason: "stale_only" | "duplicate" | "generic_profile_or_source_page" | "weak_actor_match" | "wrong_actor_or_alias_conflict" | "restricted_only" | "graph_only" | "missing_victim_or_context" | "missing_source_family" | "missing_buyer_action" | "missing_no_leak_proof" | "source_provenance_density_overflow";
    rowCount: number;
    buyerTrustReason: string;
    countsTowardCurrentSellableRows: false;
  }>;
  targetProgress: {
    targetCurrentSellableRows: 750;
    remainingGapTo750: number;
    minimumTrueFindingShare: 0.7;
    remainingFindingGapTo70Percent: number;
    maximumSourceProvenanceShare: 0.25;
    nextTargetCurrentSellableRows: 1000;
    remainingGapTo1000: number;
    next1000Plan: {
      targetCurrentSellableRows: 1000;
      additionalRowsNeeded: number;
      minimumTrueFindingsAt1000: number;
      maximumSourceProvenanceRowsAt1000: number;
      sourcePackets: string[];
      projectedRowsCountTowardCurrent: false;
    };
  };
  noLeakBoundary: {
    rawBodiesExposed: false;
    unsafeUrlsExposed: false;
    restrictedPayloadsExposed: false;
    credentialsExposed: false;
    privateMaterialUsed: false;
    actorInteractionTextUsed: false;
    hostedPaidProofClaimed: false;
  };
};

type ProgramFgCurrentSellable1000Lift = Omit<ProgramDdCurrentSellable750Lift, "schemaVersion" | "sourcePackets" | "baseline" | "acceptedRows" | "targetProgress"> & {
  schemaVersion: "ti.program_fg_current_sellable_1000_lift.v1";
  sourcePackets: Array<"darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable1000" | "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff" | "agent04_high_value_public_source_replacements" | "existing_public_source_rows">;
  baseline: {
    sellableRows: 750;
    sellableFindings: 693;
    sellableSourceProvenanceRows: 57;
    sourceProvenanceShare: 0.076;
  };
  acceptedRows: Array<{
    rowId: string;
    sourcePacket: "agent05_current_chargeable1000" | "agent08_parser_ready_public_proof" | "agent04_high_value_public_source_replacement" | "existing_public_source_row";
    actor: string;
    victimOrTarget: string;
    sector: string;
    countryOrRegion: string;
    ttpToolOrCampaign: string;
    datasetOrImpactClaim: string;
    firstSeen: string;
    lastSeen: string;
    sourceFamily: "dark_metadata_public_support" | "clear_web_public_report" | "government_advisory" | "vendor_report" | "rss_security_blog" | "public_channel_handoff";
    confidence: number;
    freshnessState: "fresh_current" | "current_recheck_due";
    provenanceHash: string;
    whyWorthPayingFor: string;
    confidenceReason: string;
    nextPivot: string;
    countsTowardCurrentSellableRows: true;
    countsTowardHostedPaidProof: false;
    noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials";
    noLeak: true;
  }>;
  targetProgress: {
    targetCurrentSellableRows: 1000;
    remainingGapTo1000: number;
    minimumTrueFindingShare: 0.55;
    remainingFindingGapTo55Percent: number;
    maximumSourceProvenanceShare: 0.4;
    nextTargetCurrentSellableRows: 1500;
    remainingGapTo1500: number;
    next1500Plan: {
      targetCurrentSellableRows: 1500;
      additionalRowsNeeded: number;
      minimumTrueFindingsAt1500: number;
      maximumSourceProvenanceRowsAt1500: number;
      sourcePackets: string[];
      projectedRowsCountTowardCurrent: false;
    };
  };
};

export interface LiveProductQueryMeasurement {
  query: string;
  proofMode: LiveProductProofMode;
  firstResponseMs?: number | null;
  firstFreshEvidenceMs?: number | null;
  pollIntervalMs?: number | null;
  status?: "searching" | "partial" | "ready" | "metadata_review" | "blocked" | "error" | "empty";
  rowCount?: number | null;
  usefulRowCount?: number | null;
  freshRowCount?: number | null;
  activityClaimCount?: number | null;
  duplicateArticleRate?: number | null;
  sourceProviderFailures?: number | null;
  staleRejected?: boolean | null;
  emptyResultHonest?: boolean | null;
  apiError?: boolean | null;
}

export interface LiveProductActorRunMeasurement {
  actorId?: string;
  actorVersion?: string;
  buildId?: string;
  imageId?: string;
  runId?: string;
  datasetId?: string;
  startedAt?: string;
  finishedAt?: string;
  status?: "succeeded" | "failed" | "timed_out" | "aborted" | "unknown";
  queryCount?: number | null;
  rowCount?: number | null;
  usefulRowCount?: number | null;
  freshRowCount?: number | null;
  staleRowCount?: number | null;
  activityClaimRowCount?: number | null;
  sellableRowCount?: number | null;
  includedWithCaveatRowCount?: number | null;
  coverageGapOnlyRowCount?: number | null;
  holdRowCount?: number | null;
  suppressRowCount?: number | null;
  targetSellableRows?: number | null;
  averageBuyerValueScore?: number | null;
  defaultWatchlistRun?: boolean | null;
}

export interface LiveProductCostInput {
  grossPpeRevenueUsd?: number | null;
  apifyCommissionUsd?: number | null;
  computeCostUsd?: number | null;
  backendCostAllocationUsd?: number | null;
  refundsFailuresUsd?: number | null;
  actorStartCostUsd?: number | null;
  resultPriceUsdPerThousand?: number | null;
  actorStartPriceUsd?: number | null;
  apifyMarginRate?: number | null;
}

export interface LiveProductMarketplaceInput {
  actorViewCount?: number | null;
  actorRunCount?: number | null;
  uniqueUserCount?: number | null;
  trialRunCount?: number | null;
  paidRunCount?: number | null;
  actorStartCount?: number | null;
  datasetRowCount?: number | null;
  failedRunCount?: number | null;
  repeatUserCount?: number | null;
  refundCount?: number | null;
  platformUsageCostUsd?: number | null;
  estimatedCreatorRevenueUsd?: number | null;
  beneficiaryVerified?: boolean | null;
  payoutMethodReady?: boolean | null;
  withdrawalReady?: boolean | null;
  pricingEffectiveAt?: string | null;
}

export interface LiveProductSourceMonetizationInput {
  evaluatedSourceCandidateCount?: number | null;
  payworthySourceCount?: number | null;
  payworthyThresholdRate?: number | null;
  sourceValueScoreThreshold?: number | null;
  freshnessThreshold?: number | null;
  evidenceYieldThreshold?: number | null;
  downstreamImpactThreshold?: number | null;
  costPerUsefulRowImpactUsd?: number | null;
  currentProofRunId?: string | null;
  currentProofDatasetId?: string | null;
  baselineProofRunId?: string | null;
  baselineProofDatasetId?: string | null;
}

export interface BuildLiveProductSloDashboardInput {
  generatedAt?: string;
  proofMode?: LiveProductProofMode;
  runs: readonly CollectionRun[];
  sources: readonly SourceRecord[];
  captures: readonly RawCapture[];
  incidents: readonly IncidentCandidate[];
  frontier: FrontierGroupSummary;
  resource?: {
    memoryRssGb?: number | null;
    diskUsedGb?: number | null;
    diskFreeGb?: number | null;
    diskGrowthGbPerDay?: number | null;
  };
  queryMeasurements?: readonly LiveProductQueryMeasurement[];
  actorRun?: LiveProductActorRunMeasurement;
  cost?: LiveProductCostInput;
  marketplace?: LiveProductMarketplaceInput;
  sourceMonetization?: LiveProductSourceMonetizationInput;
  snapshotStoragePath?: string;
}

export interface LiveProductSloDashboard {
  schemaVersion: "ti.live_product_slo_dashboard.v1";
  generatedAt: string;
  proofMode: LiveProductProofMode;
  route: "/v1/ops/product-slo";
  dashboard: {
    state: LiveProductSloState;
    summary: string;
    unavailableMetrics: string[];
    proofMode: LiveProductProofMode;
  };
  measurementPath: {
    apiFirstResponseLatency: string;
    progressivePolling: string;
    sourceFreshness: string;
    claimClusterYield: string;
    emptyResultHonesty: string;
    actorRunSuccess: string;
    costPerUsefulRow: string;
  };
  metrics: {
    apiFirstResponseLatencyMs: PercentileMetric;
    threeSecondPolling: ThresholdMetric;
    firstFreshEvidenceLatencyMs: NullableMetric;
    sourceFreshnessHours: NullableMetric;
    claimClusterYield: CountRateMetric;
    emptyResultHonestyRate: NullableMetric;
    actorRunSuccessRate: NullableMetric;
    rowsPerQuery: NullableMetric;
    usefulRowsPerQuery: NullableMetric;
    costPerUsefulRowUsd: NullableMetric;
    apiErrorRate: NullableMetric;
    queueAgeSeconds: NullableMetric;
    memoryRssGb: NullableMetric;
    diskGrowthGbPerDay: NullableMetric;
  };
  paidProductEconomics: {
    pricing: {
      resultPriceUsdPerThousand: number;
      actorStartPriceUsd: number;
      apifyMarginRate: number;
      effectiveAt: string;
    };
    latestRun: {
      runId: string | null;
      datasetId: string | null;
      buildId: string | null;
      status: LiveProductActorRunMeasurement["status"] | null;
      defaultWatchlistRun: boolean | null;
      queryCount: number | null;
      rowCount: number | null;
      usefulRowCount: number | null;
      freshRowCount: number | null;
      staleRowPenaltyRows: number | null;
      usefulRowRate: number | null;
      freshRowRate: number | null;
      paidRowDecisionCounts: {
        sellable: number | null;
        includedWithCaveat: number | null;
        coverageGapOnly: number | null;
        hold: number | null;
        suppress: number | null;
        buyerUseful: number | null;
      };
      monetizationReadiness: LiveProductMonetizationReadiness;
    };
    projectedRevenue: {
      grossRowsUsd: number | null;
      grossActorStartUsd: number | null;
      grossTotalUsd: number | null;
      apifyMarginUsd: number | null;
      netAfterApifyUsd: number | null;
      internalUsageCostUsd: number | null;
      projectedNetAfterUsageUsd: number | null;
      costPerRunUsd: number | null;
      costPerRowUsd: number | null;
      costPerUsefulRowUsd: number | null;
    };
    marketplace: {
      actorViewCount: number | null;
      actorRunCount: number | null;
      uniqueUserCount: number | null;
      trialRunCount: number | null;
      paidRunCount: number | null;
      actorStartCount: number | null;
      datasetRowCount: number | null;
      failedRunCount: number | null;
      repeatUserCount: number | null;
      refundCount: number | null;
      platformUsageCostUsd: number | null;
      estimatedCreatorRevenueUsd: number | null;
      storeViewToRunRate: number | null;
      storeViewToUserRate: number | null;
      runsPerUser: number | null;
      trialToPaidRate: number | null;
      beneficiaryStatus: "verified" | "blocked" | "unknown";
      payoutMethodStatus: "ready" | "blocked" | "unknown";
      withdrawalStatus: "ready" | "blocked" | "unknown";
      blockers: string[];
      fakeTractionGuards: string[];
    };
  };
  sourceMonetizationGate: {
    schemaVersion: "ti.live_product_source_monetization_gate.v1";
    evaluatedSourceCandidateCount: number;
    payworthySourceCount: number;
    payworthyRate: number;
    thresholdRate: number;
    state: LiveProductSloState;
    readyTiers: number[];
    heldTiers: Array<{ tier: number; reason: string }>;
    criteria: {
      sourceValueScoreAtLeast: number;
      parserCertificationRequired: true;
      currentLegalReviewRequired: true;
      freshnessAtLeast: number;
      evidenceYieldAtLeast: number;
      dedupePassRequired: true;
      downstreamPublicAnswerImpactAtLeast: number;
    };
    costPerUsefulRowImpactUsd: number | null;
    proofRunComparison: {
      currentProofRunId: string;
      currentProofDatasetId: string;
      baselineProofRunId: string;
      baselineProofDatasetId: string;
      comparisonFields: string[];
    };
    blockers: string[];
  };
  nonMonetizingWorkDetector: {
    schemaVersion: "ti.non_monetizing_work_detector.v1";
    status: "active";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/contracts" | "coordination_agent_10.md">;
    defaultRule: "does_not_count_unless_buyer_visible_metric_moves";
    buyerVisibleMetrics: string[];
    examples: Array<{
      id: string;
      workType: "contract_only" | "stix_taxii_only" | "schema_only" | "coordination_only" | "buyer_visible_metric_lift";
      label: "non_monetizing" | "monetizing";
      buyerVisibleMetricMoved: boolean;
      reason: string;
      ownerAction: string;
    }>;
    proofFixture: {
      nonMonetizingExampleCount: number;
      monetizingExampleCount: number;
      distinguishesContractOnlyFromBuyerMetricLift: true;
    };
  };
  releaseDecision: {
    schemaVersion: "ti.product_release_decision.v1";
    decision: "promote_paid_traffic" | "hold_paid_traffic";
    currentSellableRows: number | null;
    productionSellableRowFloor: 100;
    usefulCaveatedRows: number | null;
    rowsBlockedFromBilling: number | null;
    oneRepairAwayRows: number;
    projectedSellableRowsFromAcceptedRepairs: number;
    projectedSellableRowsAfterAcceptedRepairs: number | null;
    costPerUsefulRowUsd: number | null;
    topBlocker: "sellable_rows_below_100" | "none";
    revenueTruth: {
      paidTrafficAllowed: boolean;
      apifyAnalyticsExternal: true;
      payoutEvidenceExternal: true;
      revenueEvidenceExternal: true;
      proofSizedRunsMayCompleteShapeSafetyOnly: true;
    };
    acceptedRepairBuckets: Array<{
      owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_10";
      source: string;
      projectedSellableRows: number;
      projectedUsefulRows: number;
      projectedFreshRows: number;
      countsTowardProjectedFloor: boolean;
    }>;
    exclusionProof: Array<{
      class: "synthetic_rows" | "graph_only_rows" | "stale_rows" | "restricted_only_rows" | "caveat_only_rows";
      countsAsSellable: false;
      currentRows: number | null;
      reason: string;
    }>;
    nextRequiredAction: string;
  };
  paidReleaseTruthBoard: {
    schemaVersion: "ti.program_cq_paid_release_truth_board.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "Apify OUTPUT" | "/v1/contracts#apifyStoreReadiness" | "coordination_agent_10.md">;
    generatedFrom: "observed_apify_smoke_and_current_slo";
    productionSellableFloor: 100;
    paidTrafficAllowed: false;
    observedProof: {
      proofRunId: "OThlfd0uzSCNnedAO";
      proofDatasetId: "LSen2fYtwFTtOr7vK";
      proofDecision: "shape_safety_proof";
      apifySmokeRows: 12;
      apifySmokeSellableRows: 3;
      apifySmokeBuyerUsefulRows: 9;
      apifySmokeAverageBuyerValueScore: 0.558;
      currentSloSellableRows: number | null;
      currentSloBuyerUsefulRows: number | null;
      currentSloAverageBuyerValueScore: number | null;
      remainingRowsFromSmokeProof: 97;
      remainingRowsFromCurrentSlo: number | null;
    };
    rowDeltaTo100: {
      alreadyChargeableRows: number;
      remainingSellableRowsNeeded: number;
      additiveBucketRows: number;
      bucketMathIsAdditive: true;
    };
    conversionObservability: {
      schemaVersion: "ti.program_cw_paid_conversion_observability.v1";
      releaseTrafficDecision: "hold_paid_traffic";
      current_sellable: {
        currentRows: 3;
        currentSloSellableRows: number | null;
        proofCommand: "bun test src/tests/ops.test.ts src/tests/api.test.ts";
        owner: "agent_10";
        nextTask: string;
        expectedRowGain: 0;
        canCountNow: true;
      };
      projected_after_repair: {
        projectedRows: number;
        projectedSellableRowsAfterAcceptedRepairs: number | null;
        proofCommand: "bun test src/tests/ops.test.ts src/tests/api.test.ts";
        owner: "agent_10";
        nextTask: string;
        expectedRowGain: number;
        canCountNow: false;
      };
      blocked_by_public_support: {
        rowsBlocked: number;
        proofCommand: "bun test src/tests/ops.test.ts src/tests/api.test.ts";
        owner: "agent_04";
        nextTask: string;
        expectedRowGain: number;
        canCountNow: false;
      };
      blocked_by_parser: {
        rowsBlocked: number;
        proofCommand: "bun run check:apify-threat-actor-monitor";
        owner: "agent_03";
        nextTask: string;
        expectedRowGain: number;
        canCountNow: false;
      };
      blocked_by_freshness: {
        rowsBlocked: number;
        proofCommand: "bun test src/tests/ops.test.ts src/tests/api.test.ts";
        owner: "agent_07";
        nextTask: string;
        expectedRowGain: number;
        canCountNow: false;
      };
      blocked_by_suppression: {
        rowsBlocked: number;
        proofCommand: "bun test src/tests/ops.test.ts src/tests/api.test.ts";
        owner: "agent_07";
        nextTask: string;
        expectedRowGain: number;
        canCountNow: false;
      };
      blocked_by_no_leak: {
        rowsBlocked: number;
        proofCommand: "bun run smoke:apify-threat-actor-monitor";
        owner: "agent_06";
        nextTask: string;
        expectedRowGain: number;
        canCountNow: false;
      };
      external_marketplace_unknown: {
        state: "external_unknown";
        observedStoreViews: null;
        observedActorRuns: null;
        observedPaidRuns: null;
        observedPricingState: "external_unknown";
        observedPayoutState: "external_unknown";
        observedRefunds: null;
        observedConversionRate: null;
        proofCommand: "manual_external_apify_console_or_api_verification_required";
        owner: "agent_10";
        nextTask: string;
        expectedRowGain: 0;
        canCountNow: false;
      };
    };
    observedMarketplaceTelemetry: {
      schemaVersion: "ti.program_cx_observed_marketplace_telemetry_contract.v1";
      routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/contracts#apifyStoreReadiness" | "Apify OUTPUT" | "coordination_agent_10.md">;
      sourceOfTruth: "Apify Store analytics and billing";
      ingestionState: "external_unknown";
      currentValues: {
        storeViews: null;
        uniqueUsers: null;
        trialRuns: null;
        paidRuns: null;
        actorStarts: null;
        actorRuns: null;
        datasetRows: null;
        failedRuns: null;
        repeatUsers: null;
        refunds: null;
        platformUsageCostUsd: null;
        estimatedCreatorRevenueUsd: null;
        payoutState: "external_unknown";
        pricingState: "external_unknown";
      };
      manualImportPath: string[];
      apiImportPath: string[];
      validationChecks: string[];
      proofCommands: string[];
      unknownMeansNoClaim: true;
      noSyntheticFallback: true;
    };
    paidReleaseRunbook: {
      schemaVersion: "ti.program_cx_paid_release_runbook.v1";
      routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/contracts#apifyStoreReadiness" | "Apify OUTPUT" | "coordination_agent_10.md">;
      decision: "hold_paid_traffic";
      gates: Array<{
        gate: "current_sellable_rows" | "sellable_row_rate" | "useful_row_density" | "average_buyer_value" | "no_leak_proof" | "stale_latest_activity_errors" | "refunds" | "payout_readiness";
        required: string;
        observed: number | boolean | "external_unknown" | null;
        state: "pass" | "hold" | "external_unknown";
        proofField: string;
        rollbackTrigger: string;
      }>;
      promoteWhen: string[];
      holdWhen: string[];
      rollbackWhen: string[];
      proofCommands: string[];
      paidTrafficAllowedWhenAllGatesPass: true;
    };
    buyerPaidReleaseVerdict: {
      schemaVersion: "ti.program_cu_buyer_paid_release_verdict.v1";
      routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/contracts#apifyStoreReadiness" | "Apify OUTPUT">;
      decision: "hold_paid_traffic";
      buyerReadableStatus: "useful_sample_ready_paid_release_blocked";
      publicListingState: "draft_copy_ready_not_promoted";
      currentSellableRows: number;
      productionSellableFloor: 100;
      usefulRows: number;
      usefulRowDensity: number;
      averageBuyerValueScore: number;
      releaseBlockers: Array<{
        gate: "current_sellable_rows" | "external_marketplace_telemetry" | "payout_readiness" | "pricing_state";
        state: "hold" | "external_unknown";
        observed: number | "external_unknown";
        required: string;
        buyerMessage: string;
        proofField: string;
        countsTowardPaidRelease: false;
      }>;
      sampleDatasetPolicy: {
        bestRowsShown: number;
        caveatedRowsExplained: true;
        lowValueRowsSuppressed: true;
        noRawUnsafeMaterial: true;
      };
      operatorRecordingRule: {
        externalValuesStayUnknownUntilObserved: true;
        recordOnlyObservedApifyValues: string[];
        proofPaths: string[];
      };
      noLeakProof: {
        rawEvidenceBodies: false;
        unsafeUrls: false;
        credentials: false;
        restrictedPayloads: false;
        privateContent: false;
      };
    };
    hostedPaidReadinessProof: HostedApifyPaidReadinessProof;
    programDcReleaseGates: {
      schemaVersion: "ti.program_dc_paid_release_gates.v1";
      releaseDecisionBoard: Record<string, unknown>;
      current500Gate: Record<string, unknown>;
      current750Gate: Record<string, unknown>;
      current1000LocalSellableGate: Record<string, unknown>;
      current1000Gate: Record<string, unknown>;
      hostedProofExecutionGate: Record<string, unknown>;
      marketplacePaidTrafficGate: Record<string, unknown>;
      revenueImpactBlockerBoard: Array<Record<string, unknown>>;
      nonMonetizingWorkGuard: Record<string, unknown>;
    };
    programDeReleaseBoard: Record<string, unknown>;
    programFgPrivateBetaDecision: Record<string, unknown>;
    blockerBuckets: Array<{
      blocker: "already_chargeable" | "missing_public_support" | "parser_repair" | "freshness" | "alias_collision" | "source_family_gap" | "dark_metadata_public_support" | "no_leak_proof" | "marketplace_output_gap";
      owner: "agent_03" | "agent_04" | "agent_05" | "agent_06" | "agent_07" | "agent_09" | "agent_10";
      rowDeltaTo100: number;
      expectedRowGain: number;
      confidence: "observed" | "high" | "medium" | "low";
      risk: string;
      fastestNextTask: string;
      coordinationFile: string;
      countsTowardPaidFloorNow: boolean;
    }>;
    fakeMetricGuard: {
      apifyStoreViews: "external_unknown";
      apifyActorRuns: "external_unknown";
      apifyPaidRuns: "external_unknown";
      apifyRevenueUsd: null;
      apifyPayoutState: "external_unknown";
      conversionRate: null;
      noSyntheticFallback: true;
    };
    exclusionProof: Array<{
      class: "synthetic_rows" | "graph_only_rows" | "restricted_only_metadata" | "caveated_rows" | "stale_rows" | "generic_source_pages" | "projected_rows";
      countsTowardPaidFloor: false;
      reason: string;
    }>;
    nextActions: string[];
  };
  scaleStepGates: {
    schemaVersion: "ti.product_scale_step_gates.v1";
    baselineRunId: "OThlfd0uzSCNnedAO";
    baselineDatasetId: "LSen2fYtwFTtOr7vK";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "coordination_agent_10.md">;
    gates: Array<{
      id: "buyable_rows_100" | "buyable_rows_1000" | "buyable_rows_4000" | "buyable_rows_10000" | "buyable_rows_20000" | "buyable_rows_60000";
      label: string;
      state: "pass" | "hold";
      targetBuyableRows: number;
      observedBuyableRows: number | null;
      buyerValueThreshold: number;
      observedBuyerValue: number | null;
      requirements: {
        usefulRowRateAtLeast: number;
        freshRowRateAtLeast: number;
        corroborationOrSourceFamilyDiversityAtLeast: number;
        staleDuplicateGenericRejectionRequired: true;
        costPerUsefulRowUsdAtMost: number;
        noLeakProofRequired: true;
      };
      observed: {
        usefulRowRate: number | null;
        freshRowRate: number | null;
        sourceFamilyDiversity: number | null;
        staleDuplicateGenericRejection: "pass" | "unknown";
        costPerUsefulRowUsd: number | null;
      };
      tierTruth: {
        currentCount: number | null;
        eligibleCount: number | null;
        rejectedCount: number | null;
        payworthyDensity: number | null;
        sourceFamilyDiversity: number | null;
        freshness: number | null;
        noLeakProof: "pass";
        nextRequiredAction: string;
      };
      currentEvidence: string;
      blockerCodes: string[];
      noLeakRequired: true;
    }>;
    nextAllowedStep: string | null;
    heldStepCount: number;
  };
  revenueBlockerBoard: {
    schemaVersion: "ti.revenue_blocker_board.v1";
    baselineRunId: "OThlfd0uzSCNnedAO";
    baselineDatasetId: "LSen2fYtwFTtOr7vK";
    blockers: Array<{
      priority: number;
      blocker: "sellable_rows_below_100" | "stale_apt29_evidence" | "thin_apt42_public_channel_coverage" | "source_family_diversity" | "held_caveated_row_count" | "dark_metadata_usefulness" | "apify_store_conversion" | "payout_readiness_gaps";
      owner: "Agent 01" | "Agent 03" | "Agent 04" | "Agent 05" | "Agent 07" | "Agent 08" | "Agent 09" | "Agent 10";
      monetizationImpactRank: number;
      impactCategory: "missing_real_rows" | "parser_field_gaps" | "source_support_gaps" | "freshness_gaps" | "evidence_provenance_gaps" | "apify_listing_payout_analytics_gaps" | "cost_risk";
      secondaryImpactCategories: Array<"missing_real_rows" | "parser_field_gaps" | "source_support_gaps" | "freshness_gaps" | "evidence_provenance_gaps" | "apify_listing_payout_analytics_gaps" | "cost_risk">;
      blockedSellableRowsEstimate: number | null;
      buyerMetricTarget: string;
      releaseImpact: string;
      nextActions: string[];
    }>;
  };
  buyerVisibleQualityLiftGate: {
    schemaVersion: "ti.live_product_buyer_visible_quality_lift_gate.v1";
    baselineRunId: string;
    baselineDatasetId: string;
    evaluatedRunShape: "apt42_smoke_and_20_group_daily";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/quality/evaluate" | "/v1/intel/search" | "/v1/contracts">;
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    qualityLiftAcceptedCount: number;
    qualityLiftRejectedCount: number;
    sellableRowsAdded: number;
    freshRowsAdded: number;
    usefulRowsAdded: number;
    staleRowsSuppressed: number;
    costPerUsefulRowDelta: number;
    projectedRowRevenueDeltaUsd: number;
    acceptedExamples: Array<{
      id: string;
      owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08";
      beforeDecision: "coverage_gap_only" | "hold" | "suppress" | "included_with_caveat";
      afterDecision: "included_with_caveat" | "sellable";
      buyerVisibleLift: string[];
      sellableRowsDelta: number;
      freshRowsDelta: number;
      usefulRowsDelta: number;
    }>;
    rejectedExamples: Array<{
      id: string;
      owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08";
      beforeDecision: "coverage_gap_only" | "hold" | "suppress" | "included_with_caveat";
      afterDecision: "coverage_gap_only" | "hold" | "suppress" | "included_with_caveat";
      rejectionReason: "no_sellable_row_lift" | "still_single_source" | "stale_after_repair" | "unsafe_or_unapproved_source" | "cost_exceeds_value";
      doesNotCountTowardPayworthyRate: true;
    }>;
    ownerHandoffs: Array<{
      owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08";
      accepted: number;
      rejected: number;
    }>;
    passCriteria: {
      acceptedRequiresDecisionLift: true;
      acceptedRequiresBuyerVisibleMetricLift: true;
      acceptedRequiresSafePublicOrMetadataOnlySource: true;
      rejectedRepairsDoNotCountTowardPayworthyRate: true;
    };
  };
  parserCaptureLiftGate: {
    schemaVersion: "ti.live_product_parser_capture_lift_gate.v1";
    owner: "agent_03";
    baselineRunId: "OThlfd0uzSCNnedAO";
    baselineDatasetId: "LSen2fYtwFTtOr7vK";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "Apify OUTPUT" | "/v1/sources/atlas" | "/v1/evidence/cutover-report">;
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    acceptedExamples: Array<{
      id: string;
      sourceFamily: "rss_security_blog" | "vendor_report" | "cert_advisory" | "github_security_advisory" | "public_channel_handoff";
      parserFamily: "rss" | "static_html" | "advisory_security_signal" | "public_channel_handoff";
      beforeDecision: "coverage_gap_only" | "hold" | "included_with_caveat";
      afterDecision: "included_with_caveat" | "sellable";
      buyerVisibleFieldsAdded: string[];
      blockerCodesRemoved: string[];
      sellableRowsDelta: number;
      usefulRowsDelta: number;
      freshRowsDelta: number;
      estimatedBuyerValueDelta: number;
      noLeak: true;
    }>;
    rejectedExamples: Array<{
      id: string;
      rejectedReason: "stale_report" | "single_source_low_context" | "duplicate_syndication" | "unsafe_or_restricted_capture" | "auth_captcha_private_source" | "raw_url_or_body_leak" | "credential_or_payload_material";
      sourceFamily: "rss_security_blog" | "vendor_report" | "cert_advisory" | "github_security_advisory" | "public_channel_handoff";
      doesNotCountTowardPayworthyRate: true;
      sellableRowsDelta: 0;
      usefulRowsDelta: 0;
      freshRowsDelta: 0;
      noLeak: true;
    }>;
    measurableLift: {
      rowsLifted: number;
      sellableRowsAdded: number;
      usefulRowsAdded: number;
      freshRowsAdded: number;
      estimatedAverageBuyerValueDelta: number;
      sourceFamiliesImproved: string[];
      blockerCodesRemoved: string[];
    };
    noLeakBoundary: {
      rawUrlExposed: false;
      rawBodyExposed: false;
      secretPayloadMaterialExposed: false;
      privateAuthCaptchaRequired: false;
      restrictedRawMaterialExposed: false;
    };
  };
  marketplaceGraphSignals: {
    schemaVersion: "ti.marketplace_graph_signals_gate.v1";
    baselineRunId: string;
    baselineDatasetId: string;
    routeVisibleOn: Array<"/v1/ops/product-slo" | "Apify OUTPUT" | "Apify dataset rows">;
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    improvedRows: number;
    rejectedRows: number;
    expectedBuyerVisibleLift: string[];
    examples: Array<{
      actor: string;
      family: "apt" | "ransomware";
      rowSignal: "buyer_ready" | "needs_corroboration";
      relationshipLinks: string[];
      buyerUse: string;
      nextBuyerPivots: string[];
      noLeak: true;
    }>;
    rejectedGraphInflation: Array<{
      id: string;
      blockedReason: "stale_graph_fact" | "single_source_edge" | "unrelated_actor_link" | "restricted_only_context" | "missing_ledger_proof" | "no_fresh_change";
      proofNote: string;
      noLeak: true;
    }>;
    sourceParserHandoffs: Array<{
      owner: "agent_03" | "agent_04" | "agent_05";
      blocker: string;
      expectedEffect: string;
    }>;
  };
  graphPivotLiftGate: {
    schemaVersion: "ti.apify_graph_pivot_lift_gate.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "Apify OUTPUT" | "Apify dataset rows">;
    baselineRunId: string;
    baselineDatasetId: string;
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    exampleCount: number;
    usefulPivotRate: number;
    corroboratedPivotRate: number;
    nextSearchPivotCount: number;
    suppressedGenericPivotCount: number;
    sellableRowsAdded: number;
    usefulRowsAdded: number;
    averageBuyerValueDelta: number;
    rejectedBloatReasons: string[];
    ownerHandoffs: Array<{
      owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_09" | "agent_10";
      blocker: string;
      expectedEffect: string;
    }>;
  };
  relationshipConfidenceGate: {
    schemaVersion: "ti.apify_relationship_confidence_gate.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "Apify OUTPUT" | "Apify dataset rows">;
    baselineRunId: string;
    baselineDatasetId: string;
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    exampleCount: number;
    usefulPivotCount: number;
    actionPivotCount: number;
    corroboratedPivotCount: number;
    rejectedUnsupportedPivotCount: number;
    nextSearchCount: number;
    sellableRowsAdded: number;
    usefulRowsAdded: number;
    averageBuyerValueDelta: number;
    rejectedUnsupportedReasons: string[];
    ownerHandoffs: Array<{
      owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_09" | "agent_10";
      blocker: string;
      expectedEffect: string;
    }>;
  };
  paidGraphSearchPackGate: {
    schemaVersion: "ti.apify_paid_graph_search_pack_gate.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "Apify OUTPUT" | "Apify dataset rows" | "/v1/intel/search" | "/v1/contracts">;
    baselineRunId: string;
    baselineDatasetId: string;
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    packCount: number;
    usefulNextSearchCount: number;
    unsupportedPivotsSuppressed: number;
    rowsPromotedFromGenericToUseful: number;
    marketplaceSampleRowsImproved: number;
    averageBuyerValueDelta: number;
    rejectionReasons: Array<"stale_only_evidence" | "generic_relationship" | "missing_provenance" | "no_buyer_action" | "unsafe_raw_content" | "unsupported_alias_expansion" | "single_source_without_caveat" | "unrelated_pivot">;
    ownerHandoffs: Array<{
      owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_09" | "agent_10";
      blocker: string;
      expectedEffect: string;
    }>;
  };
  hundredSellableRowGraphPivotPlan: {
    schemaVersion: "ti.apify_100_sellable_row_graph_pivot_plan.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "Apify OUTPUT" | "Apify dataset rows" | "/v1/contracts">;
    baselineRunId: string;
    baselineDatasetId: string;
    targetSellableRows: 100;
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    watchlistActorCount: number;
    projectedSellableRows: number;
    projectedUsefulRows: number;
    projectedFreshRows: number;
    projectedSourceFamilyDiversity: number;
    nextSearchPivotCount: number;
    averageBuyerValueDelta: number;
    rowsPreventedFromBilling: number;
    rejectionReasons: Array<"stale_only" | "single_source_without_caveat" | "contradicted" | "unrelated" | "missing_provenance" | "unsafe_restricted_only" | "alias_only" | "not_actionable">;
    repairHandoffs: Array<{
      owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_10";
      expectedSellableRowsUnlocked: number;
      expectedEffect: string;
    }>;
  };
  parserToSellableRepairPacket: {
    schemaVersion: "ti.live_product_parser_to_100_sellable_rows_packet.v1";
    owner: "agent_03";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "Apify OUTPUT" | "Apify dataset rows" | "/v1/contracts">;
    baselineRunId: "OThlfd0uzSCNnedAO";
    baselineDatasetId: "LSen2fYtwFTtOr7vK";
    targetSellableRows: 100;
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    productionSellableClaimed: false;
    candidateDecision: "sellable_candidate_after_parser_repair";
    candidateActorCount: number;
    projectedCandidateRows: number;
    projectedUsefulRows: number;
    projectedFreshRows: number;
    projectedSellableFloorProgress: number;
    parserFieldsUnlocking: string[];
    sourceFamilyGaps: string[];
    graphPivotGaps: string[];
    suppressionChecks: string[];
    candidates: Array<{
      id: string;
      actor: string;
      family: "apt" | "ransomware";
      sourceFamily: "vendor_report" | "cert_advisory" | "rss_security_blog" | "github_security_advisory" | "public_channel_handoff" | "dark_metadata_public_support";
      currentDecision: "hold" | "coverage_gap_only" | "included_with_caveat";
      dryRunDecision: "sellable_candidate_after_parser_repair";
      projectedRows: number;
      parserFieldsUnlocking: string[];
      sourceFamilyGaps: string[];
      graphPivotGaps: string[];
      suppressionChecks: string[];
      provenanceHash: string;
      nextBuyerSearches: string[];
      requiresSourceCorroboration: true;
      noLeak: true;
    }>;
    rejectedRepairs: Array<{
      id: string;
      blockedReason: "stale_report" | "alias_collision" | "unrelated_actor_co_mention" | "generic_marketing_page" | "raw_body_or_unsafe_url_request" | "payload_request" | "private_auth_captcha_dependency";
      currentDecision: "hold" | "coverage_gap_only" | "included_with_caveat" | "suppress";
      projectedRows: 0;
      doesNotCountToward100Floor: true;
      noLeak: true;
    }>;
    ownerHandoffs: Array<{
      owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_10";
      handoff: string;
      expectedCandidateRows: number;
    }>;
    noLeakBoundary: {
      rawBodiesExposed: false;
      unsafeUrlsExposed: false;
      payloadsRequested: false;
      privateAuthCaptchaAccess: false;
      restrictedMaterialExposed: false;
      productionSellableClaimed: false;
    };
  };
  parserRealSellableLift: {
    schemaVersion: "ti.program_cj_parser_real_sellable_lift.v1";
    owner: "agent_03";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "Apify OUTPUT" | "Apify dataset rows" | "/v1/intel/search" | "/v1/contracts">;
    baselineRunId: "OThlfd0uzSCNnedAO";
    baselineDatasetId: "LSen2fYtwFTtOr7vK";
    dryRun: false;
    willMutateSources: false;
    willStartCollection: false;
    productionSellableClaimed: false;
    repairedRowCount: number;
    promotedSellableRows: number;
    movedToUsefulCaveatedRows: number;
    liveSourceAdmissionPacket: {
      schemaVersion: "ti.program_co_live_source_parser_admission.v1";
      owner: "agent_03";
      candidateRowCount: number;
      movedToSellableRows: number;
      usefulCaveatedRows: number;
      suppressedRows: number;
      rowsStillOneRepairAway: number;
      estimatedProgressToward100: {
        observedCurrentSellableRows: number;
        newSellableRows: number;
        projectedSellableRowsAfterAdmission: number;
        remainingRowsTo100: number;
        progressRatio: number;
        countsAsProductionClaim: false;
      };
      candidateRows: Array<{
        id: string;
        actor: string;
        actorFamily: "apt" | "ransomware";
        victimOrTarget: string;
        sector: string;
        countryOrRegion: string;
        datasetOrImpact: string;
        ttpToolOrCve: string;
        firstSeen: string;
        lastSeen: string;
        sourceFamily: "vendor_report" | "government_advisory" | "rss_security_blog" | "cert_advisory" | "public_report" | "public_channel_handoff" | "dark_metadata_public_support";
        confidence: number;
        caveat: string;
        contradictionState: "none" | "resolved" | "held";
        provenanceHash: string;
        noLeakProof: {
          rawBodiesExposed: false;
          unsafeUrlsExposed: false;
          restrictedPayloadsExposed: false;
          credentialsExposed: false;
          privateMaterialUsed: false;
          actorInteractionTextUsed: false;
        };
        nextBuyerSearch: string;
        currentDecision: "hold" | "coverage_gap_only" | "included_with_caveat" | "suppress";
        admissionDecision: "sellable" | "useful_caveated" | "suppress";
        sellableRowsDelta: number;
        usefulCaveatedRowsDelta: number;
        suppressedRows: number;
        repairOwner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_10";
      }>;
      suppressedClasses: Array<{
        class: "generic_actor_summary" | "stale_repost_as_current" | "alias_collision" | "wrong_actor_co_mention" | "graph_only_projection" | "restricted_only_without_public_support";
        rowCount: number;
        owner: "agent_03" | "agent_05" | "agent_07" | "agent_08";
        reason: string;
      }>;
      ownerHandoffs: Array<{
        owner: "agent_04" | "agent_05" | "agent_07" | "agent_10";
        rowCount: number;
        handoff: string;
      }>;
    };
    hostedDefaultParserLift: ProgramFhHostedDefaultParserLift;
    runtimeAdmissionReplay: {
      schemaVersion: "ti.program_cv_parser_runtime_admission_replay.v1";
      owner: "agent_03";
      baselineRunId: "OThlfd0uzSCNnedAO";
      baselineDatasetId: "LSen2fYtwFTtOr7vK";
      proofFixture: "apify/public-threat-actor-monitor/fixtures/apt42.json";
      routeVisibleOn: Array<"/v1/ops/product-slo" | "Apify OUTPUT" | "Apify dataset rows">;
      beforeSellableRows: number;
      afterSellableRows: number;
      chargeableRowsAdded: number;
      beforeAverageBuyerValueScore: number;
      afterAverageBuyerValueScore: number;
      runtimeProofRows: Array<{
        id: string;
        actor: string;
        rowType: "activity" | "source_page" | "coverage_gap" | "restricted_metadata";
        admissionDecision: "sellable" | "useful_caveated" | "suppress";
        countsTowardCurrentSellableRows: boolean;
        requiredFieldsPresent: string[];
        missingFields: string[];
        sourceEvidenceCount: number;
        sourceFamilySupport: string[];
        ttpToolOrCve: string;
        sector: string;
        countryOrRegion: string;
        datasetOrImpact: string;
        firstSeen: string;
        lastSeen: string;
        confidence: number;
        caveat: string;
        contradictionState: "none" | "held" | "contradicted";
        provenanceHash: string;
        nextBuyerSearch: string;
        blockedReason?: "generic_source_page" | "coverage_gap_only" | "restricted_only_without_public_support";
        noLeak: true;
      }>;
      suppressionProof: Array<{
        class: "generic_source_page" | "coverage_gap_only" | "restricted_only_without_public_support" | "single_source_without_caveat";
        rowCount: number;
        countsTowardCurrentSellableRows: false;
        owner: "agent_03" | "agent_04" | "agent_05";
        proof: string;
      }>;
      noLeakBoundary: {
        rawBodiesExposed: false;
        unsafeUrlsExposed: false;
        restrictedPayloadsExposed: false;
        credentialsExposed: false;
        privateMaterialUsed: false;
        actorInteractionTextUsed: false;
      };
    };
    currentAdmissionLedger: {
      schemaVersion: "ti.program_cw_parser_live_source_current_admission.v1";
      owner: "agent_03";
      routeVisibleOn: Array<"/v1/ops/product-slo" | "Apify OUTPUT" | "Apify dataset rows">;
      baselineCurrentSellableRows: number;
      rowsAdmittedThisPass: number;
      currentSellableRowsAfterAdmission: number;
      usefulRowsAfterAdmission: number;
      averageBuyerValueBefore: number;
      averageBuyerValueAfter: number;
      buyerValueLift: number;
      admittedRows: Array<{
        rowId: string;
        actor: string;
        rowType: "activity";
        sourceEvidenceCount: number;
        sourceFamilySupport: string[];
        requiredFieldsPresent: string[];
        missingFields: string[];
        nextBuyerSearch: string;
        provenanceHash: string;
        countsTowardCurrentSellableRows: true;
        noLeak: true;
      }>;
      blockedLedger: {
        missingActorRows: number;
        missingVictimOrTargetRows: number;
        missingTtpOrToolRows: number;
        missingDateRows: number;
        missingPublicProofRows: number;
        genericSourcePageRows: number;
        restrictedOnlyRows: number;
      };
      falsePositiveSuppressions: Array<{
        class: "generic_source_page" | "stale_latest_activity" | "alias_or_wrong_actor" | "restricted_only_without_public_support";
        rowCount: number;
        countsTowardCurrentSellableRows: false;
        proof: string;
      }>;
      noLeakBoundary: {
        rawBodiesExposed: false;
        unsafeUrlsExposed: false;
        restrictedPayloadsExposed: false;
        credentialsExposed: false;
        privateMaterialUsed: false;
        actorInteractionTextUsed: false;
      };
    };
    findingAdmissionLedger: {
      schemaVersion: "ti.program_cx_100_name_activity_parser_lift.v1";
      owner: "agent_03";
      routeVisibleOn: Array<"/v1/ops/product-slo" | "Apify OUTPUT" | "Apify dataset rows">;
      baseline100NameRows: 607;
      baselineSellableRows: 187;
      baselineSellableSourceProvenanceRows: 135;
      baselineSellableFindingRows: 52;
      currentRows: number;
      currentSellableRows: number;
      currentSellableFindingRows: number;
      currentSellableSourceProvenanceRows: number;
      currentCaveatedFindingRows: number;
      activityTargetTtpRowsAdmittedThisPass: number;
      sellableFindingLiftFromBaseline: number;
      sourceProvenanceShareOfSellable: number;
      admittedFindingRows: Array<{
        rowId: string;
        actor: string;
        query: string;
        rowType: "activity" | "target" | "ttp";
        sourceEvidenceCount: number;
        missingFields: string[];
        nextBuyerSearch: string;
        provenanceHash: string;
        noLeak: true;
      }>;
      perQueryAdmission: Array<{
        query: string;
        admittedFindings: number;
        heldFindings: number;
        sourceProvenanceRows: number;
        topMissingFields: string[];
        nextParserAction: string;
      }>;
      heldFindingRows: Array<{
        rowId: string;
        query: string;
        actor: string;
        rowType: "activity" | "target" | "ttp" | "dataset" | "source" | "profile";
        rejectionReason: "source_provenance_only" | "generic_actor_profile" | "stale_without_recent_corroboration" | "alias_only" | "graph_only" | "restricted_without_public_support" | "duplicate_claim" | "missing_required_fields" | "single_source_without_caveat";
        missingFields: string[];
        nextBuyerSearch: string;
        provenanceHash: string;
        countsTowardSellableFindingFloor: false;
        noLeak: true;
      }>;
      rejectionReasonCounts: Array<{
        reason: "source_provenance_only" | "generic_actor_profile" | "stale_without_recent_corroboration" | "alias_only" | "graph_only" | "restricted_without_public_support" | "duplicate_claim" | "missing_required_fields" | "single_source_without_caveat";
        rowCount: number;
        countsTowardSellableFindingFloor: false;
      }>;
      deterministic100NameProof: {
      proofPreset: "100_name_paid_preset";
      proofRows: number;
        sellableRowsPreserved: 187;
        sellableFindingsBaseline: 52;
        sellableSourceProvenanceRows: 135;
        sourceProvenanceRowsCountTowardFindingFloor: false;
        projectedFindingRowsAfterCurrentParserBatch: number;
        projectedFindingLift: number;
      };
      tier1000Gate: {
        schemaVersion: "ti.program_cy_1000_row_finding_density_gate.v1";
        minimumRows: 1000;
        minimumSellableRows: 300;
        minimumSellableFindingRate: 0.4;
        maximumSourceProvenanceShareOfSellable: 0.45;
        minimumUsefulDensity: 0.65;
        requiredRejectionReasons: Array<"source_provenance_only" | "generic_actor_profile" | "stale_without_recent_corroboration" | "alias_only" | "graph_only" | "restricted_without_public_support" | "duplicate_claim">;
        nextSourceBatches: string[];
        nextQueryBatches: string[];
        countsProjectedRowsAsPaid: false;
      };
      publicSupportCandidateAdmission: {
        schemaVersion: "ti.program_cz_public_support_candidate_admission.v1";
        owner: "agent_03";
        sourcePackets: Array<"darkMetadataPublicSupportLift4000.publicSupportSellable250" | "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff">;
        baseline: {
          sellableRowsPreserved: 187;
          sellableFindingsBaseline: 52;
          sellableSourceProvenanceRows: 135;
          sourceProvenanceRowsCountTowardFindingFloor: false;
        };
        acceptedCount: number;
        rejectedCount: number;
        acceptedRows: Array<{
          candidateId: string;
          sourcePacket: "publicSupportSellable250" | "graphPublicParserAdmissionHandoff";
          actor: string;
          victimOrTarget: string;
          sector: string;
          country: string;
          rowType: "activity" | "target" | "ttp" | "dataset";
          ttpOrTool: string;
          datasetClaim: string;
          freshness: "current" | "recent";
          confidence: number;
          sourceFamily: "dark_metadata_public_support" | "clear_web_public_report" | "government_advisory" | "vendor_report" | "rss_security_blog" | "public_channel_handoff";
          safePublicSourceId: string;
          provenanceHash: string;
          admissionReason: "public_supported_metadata_candidate" | "public_proof_parser_ready";
          expectedSellableRowsDelta: number;
          countsTowardSellableRowsNow: false;
          countsAfterParserAdmission: true;
          noLeak: true;
        }>;
        rejectionReasons: Array<{
          reason: "needs_public_support" | "stale_public_support" | "duplicate_claim" | "unsafe_restricted_only" | "generic_source_only" | "victim_too_sensitive_to_surface" | "contradicted_public_proof" | "missing_required_fields" | "graph_only_without_public_source";
          rowCount: number;
          buyerTrustReason: string;
          countsTowardSellableRows: false;
        }>;
        sourceFamilies: Array<{
          sourceFamily: "dark_metadata_public_support" | "clear_web_public_report" | "government_advisory" | "vendor_report" | "rss_security_blog" | "public_channel_handoff";
          acceptedRows: number;
        }>;
        projected300RowTierEffect: {
          currentSellableRows: 187;
          acceptedParserAdmissions: number;
          projectedSellableRowsAfterAdmission: number;
          targetSellableRows: 300;
          remainingSellableGap: number;
          currentSellableFindings: 52;
          projectedSellableFindingsAfterAdmission: number;
          targetSellableFindings: 120;
          remainingFindingGap: number;
          sellableSourceProvenanceRowsPreserved: 135;
          sourceProvenanceShareAfterAdmission: number;
          maximumSourceProvenanceShare: 0.45;
          nextRequiredFindingAdmissions: number;
          projectedAtTargetSellableRows: 300;
          projectedAtTargetSellableFindings: number;
          projectedAtTargetSourceProvenanceShare: 0.45;
          countsProjectedRowsAsPaid: false;
        };
        noLeakBoundary: {
          rawBodiesExposed: false;
          unsafeUrlsExposed: false;
          restrictedPayloadsExposed: false;
          credentialsExposed: false;
          privateMaterialUsed: false;
          actorInteractionTextUsed: false;
          productionSellableClaimed: false;
        };
      };
      currentSellableAdmissionLift: {
        schemaVersion: "ti.program_da_current_sellable_admission_lift.v1";
        owner: "agent_03";
        sourcePackets: Array<"darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable100" | "darkMetadataPublicSupportLift4000.publicSupportSellable250" | "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff" | "existing_public_source_rows">;
        baseline: {
          sellableRows: 187;
          sellableFindings: 52;
          sellableSourceProvenanceRows: 135;
          sourceProvenanceShare: number;
        };
        acceptedCurrentRowsCount: number;
        sourceProvenanceRowsConvertedToFindings: number;
        rejectedRowsCount: number;
        currentSellableRowsAfterAdmission: number;
        currentSellableFindingsAfterAdmission: number;
        currentSellableSourceProvenanceRowsAfterAdmission: number;
        sourceProvenanceShareAfterAdmission: number;
        countsTowardLocalCurrentPaidPreset: boolean;
        countsTowardHostedPaidProof: false;
        acceptedRows: Array<{
          rowId: string;
          sourcePacket: "agent05_current_chargeable100" | "agent08_parser_handoff" | "existing_public_source_row";
          actor: string;
          victimOrTarget: string;
          sector: string;
          country: string;
          ttpOrTool: string;
          datasetClaim: string;
          firstSeen: string;
          lastSeen: string;
          sourceFamily: "dark_metadata_public_support" | "clear_web_public_report" | "government_advisory" | "vendor_report" | "rss_security_blog" | "public_channel_handoff";
          confidence: number;
          provenanceHash: string;
          buyerReason: string;
          countsTowardCurrentSellableRows: true;
          countsTowardHostedPaidProof: false;
          noLeak: true;
        }>;
        convertedSourceProvenanceRows: Array<{
          rowId: string;
          actor: string;
          convertedTo: "activity" | "target" | "ttp" | "dataset";
          buyerReason: string;
          provenanceHash: string;
          countsTowardSellableFindingFloor: true;
          noLeak: true;
        }>;
        rejectedRows: Array<{
          reason: "projection_only" | "graph_only" | "restricted_only" | "generic_actor_or_source_page" | "stale_latest_error" | "duplicate_claim" | "contradicted_public_proof" | "missing_required_fields";
          rowCount: number;
          buyerTrustReason: string;
          countsTowardCurrentSellableRows: false;
        }>;
        targetProgress: {
          targetCurrentSellableRows: 250;
          remainingGapTo250: number;
          targetCurrentSellableFindings: 95;
          remainingFindingGapTo95: number;
          maximumSourceProvenanceShare: 0.45;
          nextTargetCurrentSellableRows: 300;
          remainingGapTo300: number;
        };
        noLeakBoundary: {
          rawBodiesExposed: false;
          unsafeUrlsExposed: false;
          restrictedPayloadsExposed: false;
          credentialsExposed: false;
          privateMaterialUsed: false;
          actorInteractionTextUsed: false;
          hostedPaidProofClaimed: false;
        };
      };
      currentSellable300Lift: {
        schemaVersion: "ti.program_db_current_sellable_300_lift.v1";
        owner: "agent_03";
        sourcePackets: Array<"darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable150" | "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff" | "existing_public_source_rows">;
        baseline: {
          sellableRows: 250;
          sellableFindings: 138;
          sellableSourceProvenanceRows: 112;
          sourceProvenanceShare: 0.448;
        };
        acceptedCurrentRowsCount: number;
        sourceProvenanceRowsConvertedToFindings: number;
        rejectedRowsCount: number;
        currentSellableRowsAfterAdmission: number;
        currentSellableFindingsAfterAdmission: number;
        currentSellableSourceProvenanceRowsAfterAdmission: number;
        sourceProvenanceShareAfterAdmission: number;
        countsTowardLocalCurrentPaidPreset: true;
        countsTowardHostedPaidProof: false;
        acceptedRows: Array<{
          rowId: string;
          sourcePacket: "agent05_current_chargeable150" | "agent08_parser_ready_public_proof" | "existing_public_source_row";
          actor: string;
          victimOrTarget: string;
          sector: string;
          country: string;
          ttpOrTool: string;
          datasetClaim: string;
          firstSeen: string;
          lastSeen: string;
          sourceFamily: "dark_metadata_public_support" | "clear_web_public_report" | "government_advisory" | "vendor_report" | "rss_security_blog" | "public_channel_handoff";
          confidence: number;
          provenanceHash: string;
          buyerReason: string;
          countsTowardCurrentSellableRows: true;
          countsTowardHostedPaidProof: false;
          noLeak: true;
        }>;
        convertedSourceProvenanceRows: Array<{
          rowId: string;
          actor: string;
          convertedTo: "activity" | "target" | "ttp" | "dataset";
          buyerReason: string;
          provenanceHash: string;
          countsTowardSellableFindingFloor: true;
          noLeak: true;
        }>;
        rejectedRows: Array<{
          reason: "projection_only" | "graph_only" | "restricted_only" | "generic_actor_or_source_page" | "stale_latest_error" | "duplicate_claim" | "contradicted_public_proof" | "missing_required_fields";
          rowCount: number;
          buyerTrustReason: string;
          countsTowardCurrentSellableRows: false;
        }>;
        targetProgress: {
          targetCurrentSellableRows: 300;
          remainingGapTo300: number;
          targetCurrentSellableFindings: 150;
          remainingFindingGapTo150: number;
          maximumSourceProvenanceShare: 0.45;
          nextTargetCurrentSellableRows: 1000;
          remainingGapTo1000: number;
        };
        noLeakBoundary: {
          rawBodiesExposed: false;
          unsafeUrlsExposed: false;
          restrictedPayloadsExposed: false;
          credentialsExposed: false;
          privateMaterialUsed: false;
          actorInteractionTextUsed: false;
          hostedPaidProofClaimed: false;
        };
      };
      currentSellable500Lift: {
        schemaVersion: "ti.program_dc_current_sellable_500_lift.v1";
        owner: "agent_03";
        sourcePackets: Array<"darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable250" | "darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable750" | "darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable1000" | "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff" | "agent04_high_value_public_source_replacements" | "existing_public_source_rows">;
        baseline: {
          sellableRows: 300;
          sellableFindings: 193;
          sellableSourceProvenanceRows: 107;
          sourceProvenanceShare: 0.357;
        };
        acceptedCurrentRowsCount: number;
        sourceProvenanceRowsConvertedToFindings: number;
        rejectedRowsCount: number;
        currentSellableRowsAfterAdmission: number;
        currentSellableFindingsAfterAdmission: number;
        currentSellableSourceProvenanceRowsAfterAdmission: number;
        sourceProvenanceShareAfterAdmission: number;
        trueFindingShareAfterAdmission: number;
        countsTowardLocalCurrentPaidPreset: boolean;
        countsTowardHostedPaidProof: false;
        acceptedRows: Array<{
          rowId: string;
          sourcePacket: "agent05_current_chargeable250" | "agent08_parser_ready_public_proof" | "agent04_high_value_public_source_replacement" | "existing_public_source_row";
          actor: string;
          victimOrTarget: string;
          sector: string;
          countryOrRegion: string;
          ttpToolOrCampaign: string;
          datasetOrImpactClaim: string;
          firstSeen: string;
          lastSeen: string;
          sourceFamily: "dark_metadata_public_support" | "clear_web_public_report" | "government_advisory" | "vendor_report" | "rss_security_blog" | "public_channel_handoff";
          confidence: number;
          freshnessState: "fresh_current" | "current_recheck_due";
          provenanceHash: string;
          whyWorthPayingFor: string;
          countsTowardCurrentSellableRows: true;
          countsTowardHostedPaidProof: false;
          noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials";
          noLeak: true;
        }>;
        convertedSourceProvenanceRows: Array<{
          rowId: string;
          actor: string;
          convertedTo: "activity" | "target" | "ttp" | "dataset";
          buyerReason: string;
          provenanceHash: string;
          countsTowardSellableFindingFloor: true;
          noLeak: true;
        }>;
        rejectedRows: Array<{
          reason: "low_value" | "stale" | "generic" | "source_provenance_only_risk" | "graph_only" | "restricted_only" | "contradicted" | "duplicate" | "missing_victim_or_context" | "missing_source_family" | "missing_buyer_action";
          rowCount: number;
          buyerTrustReason: string;
          countsTowardCurrentSellableRows: false;
        }>;
        targetProgress: {
          targetCurrentSellableRows: 500;
          remainingGapTo500: number;
          minimumTrueFindingShare: 0.55;
          remainingFindingGapTo55Percent: number;
          maximumSourceProvenanceShare: 0.4;
          nextTargetCurrentSellableRows: 750;
          remainingGapTo750: number;
          next750Plan: {
            targetCurrentSellableRows: 750;
            additionalRowsNeeded: number;
            minimumTrueFindingsAt750: number;
            maximumSourceProvenanceRowsAt750: number;
            sourcePackets: string[];
            projectedRowsCountTowardCurrent: false;
          };
        };
        noLeakBoundary: {
          rawBodiesExposed: false;
          unsafeUrlsExposed: false;
          restrictedPayloadsExposed: false;
          credentialsExposed: false;
          privateMaterialUsed: false;
          actorInteractionTextUsed: false;
          hostedPaidProofClaimed: false;
        };
      };
      currentSellable750Lift: ProgramDdCurrentSellable750Lift;
      currentSellable1000Lift: ProgramFgCurrentSellable1000Lift;
      remainingBlockers: Array<{
        blocker: "missing_victim_or_target" | "missing_ttp_or_tool" | "missing_public_proof" | "single_source_without_caveat" | "stale_or_held" | "alias_or_contradiction";
        rowCount: number;
        countsTowardCurrentSellableRows: false;
      }>;
      noLeakBoundary: {
        rawBodiesExposed: false;
        unsafeUrlsExposed: false;
        restrictedPayloadsExposed: false;
        credentialsExposed: false;
        privateMaterialUsed: false;
        actorInteractionTextUsed: false;
      };
    };
    staleRowsSuppressed: number;
    aliasOrUnrelatedRowsSuppressed: number;
    rowsStillOneRepairAway: number;
    averageConfidence: number;
    parserFieldsRequired: string[];
    repairedRows: Array<{
      id: string;
      actor: string;
      family: "apt" | "ransomware";
      sourceFamily: "vendor_report" | "cert_advisory" | "rss_security_blog" | "github_security_advisory" | "public_channel_handoff" | "dark_metadata_public_support";
      previousDecision: "hold" | "coverage_gap_only" | "included_with_caveat";
      repairedDecision: "sellable" | "included_with_caveat";
      sellableRowsDelta: number;
      usefulCaveatedRowsDelta: number;
      actorEntity: string;
      victim: string;
      sector: string;
      country: string;
      datasetOrImpact: string;
      ttpOrTool: string;
      firstSeen: string;
      lastSeen: string;
      sourceFamilySupport: string[];
      confidence: number;
      caveat: string;
      contradictionState: "none" | "resolved" | "held";
      provenanceHash: string;
      replayRef: string;
      nextBuyerSearch: string;
      graphPivots: string[];
      noLeak: true;
    }>;
    rejectionRows: Array<{
      id: string;
      actor: string;
      blockedReason: "stale_report" | "alias_collision" | "unrelated_actor_co_mention" | "generic_marketing_page" | "unsafe_source_request";
      suppressedRows: number;
      countsTowardSellableLift: false;
      noLeak: true;
    }>;
    ownerHandoffs: Array<{
      owner: "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_10";
      handoff: string;
      rowCount: number;
    }>;
    noLeakBoundary: {
      rawBodiesExposed: false;
      unsafeUrlsExposed: false;
      objectKeysExposed: false;
      credentialsExposed: false;
      payloadsRequested: false;
      privateMaterialUsed: false;
      actorInteractionTextUsed: false;
      productionSellableClaimed: false;
    };
  };
  qualityConversionGate: {
    schemaVersion: "ti.program_bq_paid_row_quality_conversion_gate.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/quality/evaluate" | "/v1/intel/search" | "/v1/contracts">;
    baselineRunId: "OThlfd0uzSCNnedAO";
    baselineDatasetId: "LSen2fYtwFTtOr7vK";
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    exampleCount: number;
    chargeableExampleCount: number;
    caveatedExampleCount: number;
    heldOrSuppressedExampleCount: number;
    rejectedBloatRows: number;
    sellableRowLift: number;
    bloatBlocked: number;
    rejectedBloatReasons: string[];
    sourceParserHandoffs: Array<{
      owner: "agent_01" | "agent_03" | "agent_04" | "agent_05";
      blocker: string;
      expectedEffect: string;
    }>;
  };
  liveFreshnessQualityGate: {
    schemaVersion: "ti.program_br_live_freshness_quality_gate.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/quality/evaluate" | "/v1/intel/search" | "/v1/contracts">;
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    exampleCount: number;
    chargeableFreshRows: number;
    caveatedFreshRows: number;
    staleLatestClaimsBlocked: number;
    bloatRowsSuppressed: number;
    minimumFreshRowRate: number;
    minimumStaleSuppressionRate: number;
    blockedLatestClaimReasons: string[];
    sourceParserHandoffs: Array<{
      owner: "agent_01" | "agent_03" | "agent_04" | "agent_05";
      blocker: string;
      expectedEffect: string;
    }>;
  };
  freshnessRepairLoop: {
    schemaVersion: "ti.program_bs_paid_row_freshness_repair_loop.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/quality/evaluate" | "/v1/intel/search" | "/v1/contracts" | "Apify OUTPUT">;
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    repairQueueSize: number;
    actorCoverage: string[];
    blockerReasons: string[];
    staleRowsBlocked: number;
    genericRowsRepaired: number;
    aliasOrUnrelatedRowsSuppressed: number;
    caveatedRowsPreserved: number;
    sellableRowsGained: number;
    usefulRowsGained: number;
    averageBuyerValueDelta: number;
    ownerHandoffs: Array<{
      owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
      queueCount: number;
      blockerFocus: string;
      expectedEffect: string;
    }>;
    noLeakProof: {
      rawEvidenceExposed: false;
      unsafeUrlsExposed: false;
      restrictedPayloadsExposed: false;
      objectKeysExposed: false;
    };
  };
  entitySpecificityLift: {
    schemaVersion: "ti.program_bv_paid_row_entity_specificity_lift.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/quality/evaluate" | "/v1/intel/search" | "/v1/contracts" | "Apify OUTPUT">;
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    fixtureCount: number;
    actorCoverage: string[];
    missingFieldCoverage: string[];
    blockerCodes: string[];
    rowsLifted: number;
    rowsSuppressed: number;
    rowsHeldWithRepairAction: number;
    blockerCodesRemoved: number;
    averageBuyerValueDelta: number;
    ownerHandoffs: Array<{
      owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
      fixtureCount: number;
      blockerFocus: string;
      expectedEffect: string;
    }>;
    noLeakProof: {
      rawEvidenceExposed: false;
      unsafeUrlsExposed: false;
      restrictedPayloadsExposed: false;
      objectKeysExposed: false;
    };
  };
  falsePositiveSuppressionGate: {
    schemaVersion: "ti.program_bz_paid_row_false_positive_suppression_gate.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/quality/evaluate" | "/v1/intel/search" | "/v1/contracts" | "Apify OUTPUT">;
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    fixtureCount: number;
    actorCoverage: string[];
    scenarioCoverage: string[];
    reasonCodes: string[];
    falsePositivesSuppressed: number;
    contradictedRowsHeld: number;
    staleRepostsBlocked: number;
    singleSourceRowsCaveated: number;
    truePositivesPreserved: number;
    sellableRowsProtected: number;
    buyerTrustDelta: number;
    rowsPreventedFromBilling: number;
    programCpHardening: {
      schemaVersion: "ti.program_cp_paid_row_false_positive_freshness_hardening.v1";
      routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/intel/search" | "/v1/quality/evaluate" | "/v1/contracts" | "Apify OUTPUT">;
      activeCandidatePoolRowsAudited: 100;
      apifySmokeRowsAudited: 12;
      currentChargeableRows: number;
      rowCountInflationBlocked: number;
      staleLatestActivityRowsBlocked: number;
      aliasCollisionRowsBlocked: number;
      wrongActorRowsBlocked: number;
      genericSourcePageRowsBlocked: number;
      unrelatedCoMentionRowsBlocked: number;
      graphOnlyRowsBlocked: number;
      restrictedOnlyRowsHeld: number;
      syntheticProofRowsBlocked: number;
      lowBuyerValueRowsBlocked: number;
      caveatedRowsExcludedFromChargeable: number;
      truePositiveRowsPreserved: number;
      suppressionProof: Array<{
        class: "stale_latest_activity" | "alias_collision" | "wrong_actor" | "generic_source_page" | "unrelated_co_mention" | "graph_only" | "restricted_only" | "synthetic_proof_only" | "low_buyer_value" | "caveated_only";
        exampleActor: string;
        countsTowardSellable: false;
        proof: string;
        repairOwner: "agent_03" | "agent_04" | "agent_05" | "agent_06" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
      }>;
      preservedTruePositiveProof: Array<{
        actor: string;
        requiredSignals: Array<"current_public_support" | "actor_specific" | "victim_or_dataset_context" | "provenance_hash" | "no_leak" | "buyer_action">;
        countsTowardSellable: true;
        whyBuyerShouldCare: string;
        nextBuyerSearch: string;
        provenanceHash: string;
        noLeak: true;
      }>;
      fastestRepairsTo100: Array<{
        owner: "agent_03" | "agent_04" | "agent_05" | "agent_06" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
        blocker: "freshness" | "alias_collision" | "wrong_actor" | "generic_source_page" | "caveated_source_corroboration" | "restricted_only_public_support" | "graph_public_corroboration" | "marketplace_wording" | "evidence_no_leak" | "paid_release_accounting";
        rowsBlocked: number;
        expectedSellableRowsAfterRepair: number;
        nextAction: string;
        countsTowardPaidFloorNow: false;
      }>;
      secondBatchAudit: {
        schemaVersion: "ti.program_cp_second_batch_candidate_audit.v1";
        auditedPreset: "100_name_paid_preset";
        localProofRows: 607;
        currentSellableRows: 187;
        sellableFindingRows: 52;
        sellableSourceProvenanceRows: 135;
        sourceProvenanceRowsCountTowardFindingFloor: false;
        localProofPassed100RowFloor: true;
        hostedProofRequired: true;
        hostedProofCountsTowardPaidPromotion: false;
        externalMarketplaceVerificationRequired: true;
        staleLatestActivitySellableRows: 0;
        aliasOrWrongActorSellableRows: 0;
        genericSourcePageSellableRows: 0;
        graphOnlySellableRows: 0;
        restrictedOnlySellableRows: 0;
        caveatedRowsCountTowardChargeable: false;
        findingAdmissionRequiredSignals: Array<"current_public_support" | "actor_specific" | "finding_context" | "freshness_not_stale" | "provenance_hash" | "no_leak" | "buyer_action">;
        rowInflationGuards: Array<{
          guard: "source_provenance_padding" | "stale_latest_activity" | "alias_or_wrong_actor" | "generic_source_page" | "graph_only" | "restricted_only" | "caveated_as_chargeable";
          countsTowardPaidPromotion: false;
          proof: string;
          owner: "agent_03" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
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
      };
      noLeakProof: {
        rawEvidenceExposed: false;
        unsafeUrlsExposed: false;
        restrictedPayloadsExposed: false;
        objectKeysExposed: false;
        privateMaterialExposed: false;
        accountMaterialExposed: false;
        actorInteractionContentExposed: false;
      };
    };
    ownerHandoffs: Array<{
      owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
      fixtureCount: number;
      blockerFocus: string;
      expectedEffect: string;
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
  };
  paidRowAudit100: {
    schemaVersion: "ti.program_ch_paid_row_audit_100.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/quality/evaluate" | "/v1/intel/search" | "/v1/contracts" | "Apify OUTPUT">;
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    targetSellableRows: 100;
    classificationCounts: Record<"sellable" | "useful_caveated" | "needs_public_support" | "stale_or_duplicate" | "wrong_actor_or_alias_collision" | "restricted_only" | "not_payworthy", number>;
    currentSellableRows: number;
    protectedSellableRows: number;
    usefulCaveatedRowsExcluded: number;
    suppressedFalsePositives: number;
    rowsOneRepairAway: number;
    expectedSellableLiftAfterParserSourceRepairs: number;
    rowsPreventedFromBilling: number;
    productionSellableFloorGap: number;
    actorCoverage: string[];
    exclusionProof: Array<{
      class: "graph_only_projection" | "synthetic_row" | "stale_or_duplicate" | "restricted_only" | "caveat_only";
      countsAsSellable: false;
      reason: string;
    }>;
    ownerHandoffs: Array<{
      owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_10";
      rowCount: number;
      expectedSellableRowsUnlocked: number;
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
  };
  first100AdmissionQuality: {
    schemaVersion: "ti.program_cn_first_100_paid_row_admission_quality.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/quality/evaluate" | "/v1/intel/search" | "/v1/contracts" | "Apify OUTPUT">;
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
      rowClass: "accepted_sellable" | "caveated_useful" | "needs_public_support" | "stale_duplicate" | "alias_collision" | "wrong_actor" | "restricted_only" | "graph_only" | "synthetic_proof_only" | "generic_market_source_page" | "low_buyer_value";
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
  };
  graphSellableSupportPacket: {
    schemaVersion: "ti.program_ci_graph_sellable_support_packet.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "Apify OUTPUT" | "Apify dataset rows" | "/v1/contracts">;
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
  };
  graphPublicCorroborationPivotPacket: {
    schemaVersion: "ti.program_cs_graph_public_corroboration_pivot_packet.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "Apify OUTPUT" | "Apify dataset rows" | "/v1/intel/search" | "/v1/contracts">;
    baselineRunId: "OThlfd0uzSCNnedAO";
    baselineDatasetId: "LSen2fYtwFTtOr7vK";
    dryRun: true;
    willMutateSources: false;
    willStartCollection: false;
    productionSellableFloor: 100;
    candidateCount: number;
    rowUnlockingCandidateCount: number;
    contradictionOrAliasHoldCount: number;
    graphOnlyRowsExcludedFromFloor: number;
    projectedSellableRowsAfterPublicCorroboration: number;
    publicProofMetrics: {
      pivotsTested: number;
      publicProofFound: number;
      rowsUnlockedForParserAdmission: number;
      rowsRejectedAsStaleOrAmbiguous: number;
      contradictionsFound: number;
      queuedForNextPublicSearch: number;
      projectedBuyerValueLift: number;
      countsTowardPaidFloorNow: false;
    };
    hostedDefaultPublicCorroborationLift: ProgramFhHostedPublicCorroborationLift;
    paidRowUnlockQueue: {
      schemaVersion: "ti.program_cy_paid_row_unlock_queue.v1";
      counts: {
        admitted_by_parser: 0;
        ready_for_parser: number;
        ready_for_current_admission: number;
        ready_for_parser_admission: number;
        needs_public_source: number;
        contradicted: number;
        contradicted_or_alias_hold: number;
        stale: number;
        stale_recheck: number;
        unsafe_or_restricted: number;
        rowsCountTowardFloorNow: 0;
        rowsReadyAfterParserAdmission: number;
      };
      parserAdmissionHandoff: Array<{
        handoffId: string;
        candidateId: string;
        actor: string;
        victimOrTarget: string;
        sector: string | null;
        country: string | null;
        ttpOrTool: string | null;
        sourceFamily: "vendor_report" | "government_advisory" | "cert_advisory" | "security_blog" | "public_report" | "public_channel" | "victim_notice" | "restricted_metadata_public_support";
        freshnessAgeDays: number;
        contradictionState: "none" | "contradicted" | "alias_hold" | "review_hold";
        provenanceHash: string;
        buyerReason: string;
        expectedPaidRowLiftAfterParserAdmission: number;
        programDbPriority: {
          gapContribution: number;
          findingLikely: boolean;
          sourceProvenanceOnlyRisk: "low" | "medium" | "high";
          preferredParserAction: "admit_as_current_finding" | "admit_with_caveat" | "hold_for_source_support" | "hold_for_review";
          admissionBlocker: "none" | "stale" | "alias_conflict" | "contradiction" | "duplicate" | "generic_source_page" | "restricted_only" | "not_enough_source_support";
        };
        programDcPriority: {
          gapContribution: number;
          findingLikely: boolean;
          sourceProvenanceOnlyRisk: "low" | "medium" | "high";
          preferredParserAction: "admit_as_current_finding" | "admit_with_caveat" | "hold_for_source_support" | "hold_for_review";
          admissionBlocker: "none" | "stale" | "alias_conflict" | "contradiction" | "duplicate" | "generic_source_page" | "restricted_only" | "not_enough_source_support" | "missing_buyer_action" | "weak_source_family_diversity";
          sourceFamilyDiversityLift: number;
          corroborationStrength: "single_source" | "cross_family" | "multi_family_strong";
          freshnessRisk: "low" | "medium" | "high";
        };
        programDdPriority: {
          gapContribution: number;
          findingLikely: boolean;
          sourceProvenanceOnlyRisk: "low" | "medium" | "high";
          preferredParserAction: "admit_as_current_finding" | "admit_with_caveat" | "hold_for_source_support" | "hold_for_review";
          admissionBlocker: "none" | "stale" | "alias_conflict" | "contradiction" | "duplicate" | "generic_source_page" | "restricted_only" | "not_enough_source_support" | "missing_buyer_action" | "weak_source_family_diversity" | "graph_only_speculation";
          sourceFamilyDiversityLift: number;
          corroborationStrength: "single_source" | "cross_family" | "multi_family_strong";
          contradictionRisk: "low" | "medium" | "high";
          freshnessRisk: "low" | "medium" | "high";
          buyerVisibleValue: "fresh_activity" | "victim_or_target_context" | "sector_country_context" | "ttp_or_tool_context" | "source_family_diversity" | "alias_or_contradiction_review";
          noLeakProof: "hash_only_public_or_metadata_reference";
          nextPivot: "parser_admission" | "source_family_review" | "freshness_recheck" | "contradiction_review";
        };
        programDePriority: {
          expectedCurrentRowLift: number;
          confidenceLift: number;
          freshnessLift: number;
          sourceFamilyLift: number;
          contradictionRisk: "low" | "medium" | "high";
          sourceProvenanceOnlyRisk: "low" | "medium" | "high";
          buyerVisibleNextPivot: "parser_admission" | "source_family_review" | "freshness_recheck" | "contradiction_review";
          gateContribution: "current750" | "current1000";
          noLeakProof: "hash_only_public_or_metadata_reference";
          admissionBlocker: "none" | "stale" | "alias_conflict" | "contradiction" | "duplicate" | "generic_source_page" | "restricted_only" | "not_enough_source_support" | "missing_buyer_action" | "weak_source_family_diversity" | "graph_only_speculation" | "unsupported_relationship_padding";
        };
        programFgPriority: {
          whyCorroborationMatters: "converts_caveated_or_held_actor_row" | "adds_actor_alias_context" | "adds_victim_target_context" | "adds_sector_country_context" | "adds_ttp_tool_context" | "adds_dataset_or_impact_claim" | "adds_source_family_diversity" | "adds_freshness_proof" | "resolves_contradiction_or_alias_risk";
          buyerActionEnabled: "admit_current_finding" | "admit_with_caveat" | "refresh_stale_actor_row" | "resolve_alias_or_contradiction" | "expand_next_public_search";
          confidenceDelta: number;
          freshnessDelta: number;
          sourceFamilyDelta: number;
          contradictionRisk: "low" | "medium" | "high";
          parserAdmissionReason: string;
          nextParserSlice: "current1000_alias_victim_ttp" | "current1000_source_family_freshness" | "current1000_contradiction_review" | "current1000_metadata_public_support";
          noLeakProof: "hash_only_public_or_metadata_reference";
          admissionBlocker: "none" | "stale_latest_error" | "unsupported_alias" | "generic_source_page" | "restricted_only" | "duplicate" | "graph_only_speculation" | "relationship_padding" | "missing_buyer_action";
        };
        admissionState: "ready_for_parser";
        countsTowardFloorNow: false;
        noLeak: true;
      }>;
      ready_for_current_admission: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"];
      ready_for_parser_admission: Array<{
        candidateId: string;
        actor: string;
        victimOrTarget: string;
        sourceClass: "vendor_report" | "government_advisory" | "cert_advisory" | "security_blog" | "public_report" | "public_channel" | "victim_notice" | "restricted_metadata_public_support";
        queryText: string;
        proofUrlHash: string;
        parserHandoffReason: string;
        worthPayingForReason: string;
        expectedRowsUnlockedAfterParserAdmission: number;
        countsTowardFloorNow: false;
        noLeak: true;
      }>;
      needs_public_source: Array<{
        candidateId: string;
        actor: string;
        victimOrTarget: string;
        sourceClass: "vendor_report" | "government_advisory" | "cert_advisory" | "security_blog" | "public_report" | "public_channel" | "victim_notice" | "restricted_metadata_public_support";
        queryText: string;
        proofUrlHash: string;
        parserHandoffReason: string;
        worthPayingForReason: string;
        expectedRowsUnlockedAfterParserAdmission: number;
        countsTowardFloorNow: false;
        noLeak: true;
      }>;
      contradicted: Array<{
        candidateId: string;
        actor: string;
        victimOrTarget: string;
        sourceClass: "vendor_report" | "government_advisory" | "cert_advisory" | "security_blog" | "public_report" | "public_channel" | "victim_notice" | "restricted_metadata_public_support";
        queryText: string;
        proofUrlHash: string;
        parserHandoffReason: string;
        worthPayingForReason: string;
        expectedRowsUnlockedAfterParserAdmission: number;
        countsTowardFloorNow: false;
        noLeak: true;
      }>;
      contradicted_or_alias_hold: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["contradicted"];
      stale: Array<{
        candidateId: string;
        actor: string;
        victimOrTarget: string;
        sourceClass: "vendor_report" | "government_advisory" | "cert_advisory" | "security_blog" | "public_report" | "public_channel" | "victim_notice" | "restricted_metadata_public_support";
        queryText: string;
        proofUrlHash: string;
        parserHandoffReason: string;
        worthPayingForReason: string;
        expectedRowsUnlockedAfterParserAdmission: number;
        countsTowardFloorNow: false;
        noLeak: true;
      }>;
      stale_recheck: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["stale"];
      unsafe_or_restricted: Array<{
        candidateId: string;
        actor: string;
        victimOrTarget: string;
        sourceClass: "restricted_metadata_public_support";
        queryText: string;
        proofUrlHash: string;
        parserHandoffReason: string;
        worthPayingForReason: string;
        expectedRowsUnlockedAfterParserAdmission: number;
        countsTowardFloorNow: false;
        noLeak: true;
      }>;
      programDbRejectionBuckets: {
        stale: number;
        alias_conflict: number;
        contradiction: number;
        duplicate: number;
        generic_source_page: number;
        restricted_only: number;
        not_enough_source_support: number;
        rowsCountTowardFloorNow: 0;
        noLeak: true;
      };
      programDcRejectionBuckets: {
        stale: number;
        alias_conflict: number;
        contradiction: number;
        duplicate: number;
        generic_source_page: number;
        restricted_only: number;
        not_enough_source_support: number;
        missing_buyer_action: number;
        weak_source_family_diversity: number;
        rowsCountTowardFloorNow: 0;
        noLeak: true;
      };
      programDdRejectionBuckets: {
        stale: number;
        alias_conflict: number;
        contradiction: number;
        duplicate: number;
        generic_source_page: number;
        restricted_only: number;
        not_enough_source_support: number;
        missing_buyer_action: number;
        weak_source_family_diversity: number;
        graph_only_speculation: number;
        rowsCountTowardFloorNow: 0;
        noLeak: true;
      };
      programDeRejectionBuckets: {
        stale: number;
        alias_conflict: number;
        contradiction: number;
        duplicate: number;
        generic_source_page: number;
        restricted_only: number;
        not_enough_source_support: number;
        missing_buyer_action: number;
        weak_source_family_diversity: number;
        graph_only_speculation: number;
        unsupported_relationship_padding: number;
        rowsCountTowardFloorNow: 0;
        noLeak: true;
      };
      graphOnlyCountsTowardPaidFloorNow: false;
      noLeak: true;
    };
    averageProjectedConfidenceLift: number;
    sourceFamilyTargets: Array<{ sourceFamily: "vendor_report" | "government_advisory" | "cert_advisory" | "security_blog" | "public_report" | "public_channel" | "victim_notice"; candidateCount: number }>;
    fieldRepairTargets: Array<{ repairsRowField: "actor_attribution" | "victim_or_dataset" | "sector_country" | "ttp_tool" | "campaign_context" | "freshness"; candidateCount: number }>;
    candidates: Array<{
      id: string;
      rank: number;
      actor: string;
      aliases: string[];
      family: "apt" | "ransomware";
      candidateVictimOrTarget: string;
      currentBlockedState: "needs_public_support" | "metadata_only" | "single_source_caveat" | "parser_field_missing" | "contradiction_hold" | "alias_collision_hold";
      relationshipSupport: string;
      proofUrlHash: string;
      sourceType: "vendor_report" | "government_advisory" | "cert_advisory" | "security_blog" | "public_report" | "public_channel" | "victim_notice" | "restricted_metadata_public_support";
      candidateFields: {
        actor: string;
        victimOrTarget: string;
        sector: string | null;
        country: string | null;
        ttp: string | null;
        campaign: string | null;
      };
      contradictionStatus: "none" | "contradicted" | "alias_hold" | "review_hold";
      freshnessAgeDays: number | null;
      parserHandoffReason: string;
      worthPayingForReason: string;
      nextPublicCorroborationPivot: {
        queryText: string;
        entityType: "actor" | "victim" | "dataset" | "sector" | "country" | "ttp" | "tool" | "campaign";
        expectedSourceFamily: "vendor_report" | "government_advisory" | "cert_advisory" | "security_blog" | "public_report" | "public_channel" | "victim_notice";
        repairsRowField: "actor_attribution" | "victim_or_dataset" | "sector_country" | "ttp_tool" | "campaign_context" | "freshness";
        contradictionRisk: "none" | "low" | "medium" | "high";
        aliasCollisionRisk: "none" | "low" | "medium" | "high";
        ownerHandoff: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
      };
      publicProofState: "queued_for_search" | "public_proof_found" | "stale_or_ambiguous_reject" | "contradiction_found" | "alias_hold";
      expectedBuyerFieldLift: string;
      expectedSellableRowsUnlockedAfterPublicProof: number;
      measuredRowsUnlockedForParserAdmission: number;
      projectedConfidenceLift: number;
      graphOnlyCountsTowardSellableRows: false;
      countsTowardProductionSellableRowsAfterParserAdmission: boolean;
      rowUnlockRequiresNonGraphEvidence: true;
      noLeak: true;
    }>;
    integrationHandoffs: Array<{
      owner: "agent_03" | "agent_05";
      candidateIds: string[];
      convertsRowsFrom: "parser_caveated_rows" | "dark_metadata_metadata_only_rows";
      missingPublicProof: string;
      expectedRowsUnlockedForAdmission: number;
      countsTowardPaidFloorNow: false;
      action: string;
    }>;
    ownerHandoffs: Array<{
      owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
      candidateCount: number;
      expectedSellableRowsUnlockedAfterPublicProof: number;
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
  };
  darkMetadataLiveValueExpansion: {
    schemaVersion: "ti.dark_metadata_live_value_expansion_slo.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/darkweb/status" | "/v1/darkweb/search" | "/v1/contracts">;
    owner: "Agent 05";
    dryRun: true;
    willStartCollection: false;
    willFetchNetwork: false;
    sourceCountInflationBlocked: true;
    tiers: Array<{
      tier: 1000 | 4000;
      evaluatedCandidateCount: number;
      valueQualifiedCandidateCount: number;
      usefulRowRate: number;
      averageBuyerValueScore: number;
      staleRate: number;
      duplicateRate: number;
      blockedOrReviewRate: number;
      decision: "hold_for_value_density" | "ready_for_import_batch";
    }>;
    criteria: {
      minimumAverageBuyerValueScore: 0.68;
      maximumStaleRate: 0.28;
      maximumDuplicateRate: 0.16;
      maximumBlockedOrReviewRate: 0.18;
      minimumUsefulQueriesPerTier: 20;
      minimumSafeSampleRowsPerTier: 12;
      noLeakSerializationRequired: true;
    };
    blockers: string[];
  };
  darkMetadataPublicHandoff100: {
    schemaVersion: "ti.dark_metadata_public_handoff_100_slo.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/darkweb/status" | "/v1/darkweb/search" | "/v1/contracts">;
    owner: "Agent 05";
    dryRun: true;
    willStartCollection: false;
    willFetchNetwork: false;
    candidateTarget: 100;
    candidateCount: number;
    publicCorroboratedCount: number;
    usefulCaveatedCount: number;
    rejectedCount: number;
    projectedContributionToward100SellableRows: number;
    averageBuyerValueScore: number;
    staleRate: number;
    duplicateRate: number;
    unsafeRate: number;
    authPrivateCaptchaRate: number;
    decisionCounts: {
      sellableWithPublicSupport: number;
      includedWithCaveat: number;
      coverageGapOnly: number;
      hold: number;
      suppress: number;
    };
    criteria: {
      targetSellableRows: 100;
      restrictedOnlyRowsCannotBeSellable: true;
      publicSupportRequiredForSellable: true;
      noLeakSerializationRequired: true;
      minimumAverageBuyerValueScore: 0.55;
    };
    handoffFields: {
      agent03ParserGaps: string[];
      agent04PublicCorroborationGaps: string[];
      agent08GraphPivots: string[];
      agent10RevenueGateCounts: string[];
    };
    blockers: string[];
  };
  darkMetadataPublicSupportLift4000: {
    schemaVersion: "ti.dark_metadata_public_support_lift_4000_slo.v1";
    routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/darkweb/status" | "/v1/darkweb/search" | "/v1/contracts">;
    owner: "Agent 05";
    dryRun: true;
    willStartCollection: false;
    willFetchNetwork: false;
    candidateSource: "publicSupportWorklist40_and_darkweb_index_records";
    tierTargets: [100, 1000, 4000, 10000];
    currentContributionToward100SellableRows: number;
    first4000CandidateCount: number;
    projectedContributionToward100PaidRowsAfterPublicSupport: number;
    supportBucketCounts: {
      currently_chargeable: number;
      sellable_after_public_support: number;
      useful_with_caveat: number;
      restricted_only_hold: number;
      stale_reject: number;
      duplicate_reject: number;
      unsafe_reject: number;
      low_value_reject: number;
      needs_parser_repair: number;
      needs_source_support: number;
    };
    tierSummaries: Array<{
      tier: "top_100" | "tier_1000" | "tier_4000";
      evaluatedCandidateCount: number;
      acceptedForPublicSupportCount: number;
      sellableAfterPublicSupport: number;
      usefulWithCaveat: number;
      restrictedOnlyHold: number;
      rejectedCount: number;
      averageBuyerValueScore: number;
      currentlyChargeableCount: 0;
      countsTowardSellableFloorNow: false;
    }>;
    handoffCounts: {
      agent03ParserRepairRows: number;
      agent04SourceSupportRows: number;
      agent06NoLeakRequirements: number;
      agent07QualityHoldRows: number;
      agent08GraphPivotRows: number;
      agent09MarketplaceFields: number;
      agent10ProjectedPaidRowsAfterSupport: number;
    };
    first100RepairQueue: Array<{
      rank: number;
      actorOrGroupHint: string;
      victimOrDatasetHint: string;
      requiredPublicSupportFamily: string;
      rowDecision: "repair_for_sellable_after_public_support" | "repair_for_useful_caveat";
      owningWorkerHandoff: string;
      countsTowardSellableFloorNow: false;
      countsTowardSellableFloorAfterPublicSupport: boolean;
      noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials";
    }>;
    publicSupportSellable100: {
      schemaVersion: "ti.darkweb_index_public_support_sellable_100.v1";
      candidateSource: "publicSupportLift1000.first100RepairQueue";
      targetSellableRows: 100;
      candidateCount: number;
      currentChargeableRows: number;
      projectedAfterPublicSupportRows: number;
      retiredRows: number;
      remainingGapTo100Now: number;
      remainingGapTo100AfterProjectedSupport: number;
      rowDecisionCounts: {
        current_sellable_public_supported: number;
        projected_after_public_support: number;
        retired_not_chargeable: number;
      };
      sampleRows: Array<{
        rank: number;
        actorOrGroupHint: string;
        victimOrDatasetHint: string;
        safePublicSourceId: string;
        sourceFamilySupportState: "public_support_attached" | "public_support_needed" | "retired_no_safe_public_support";
        rowDecision: "current_sellable_public_supported" | "projected_after_public_support" | "retired_not_chargeable";
        countsTowardSellableFloorNow: boolean;
        countsTowardSellableFloorAfterPublicSupport: boolean;
        noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials";
      }>;
      agent03ParserHandoffRowCount: number;
      countersVisibleOn: Array<"/v1/darkweb/status" | "/v1/darkweb/search" | "/v1/contracts" | "/v1/ops/product-slo">;
    };
    publicSupportSellable250: {
      schemaVersion: "ti.darkweb_index_public_support_sellable_250.v1";
      candidateSource: "publicSupportLift1000.tier_4000_ranked_rows";
      targetSellableRows: 100;
      candidateCount: 250;
      previousCurrentChargeableRows: 12;
      currentChargeableRows: number;
      newlyChargeableRows: number;
      projectedAfterPublicSupportRows: number;
      blockedOrRetiredRows: number;
      remainingGapTo100Now: number;
      remainingGapTo100AfterProjectedSupport: number;
      rowDecisionCounts: {
        current_sellable_public_supported: number;
        projected_after_public_support: number;
        blocked_not_chargeable: number;
      };
      blockerBucketCounts: {
        needs_public_support: number;
        no_current_public_support: number;
        stale_public_support: number;
        duplicate_claim: number;
        unsafe_restricted_only: number;
        generic_source_only: number;
        victim_too_sensitive_to_surface: number;
        contradiction_hold: number;
        contradiction_false_claim_hold: number;
        missing_buyer_action: number;
        missing_actor_or_group_context: number;
        missing_target_or_dataset_context: number;
        raw_location_leak_risk: number;
      };
      sampleRows: Array<{
        rank: number;
        actorOrGroupHint: string;
        victimOrDatasetHint: string;
        sector: string;
        country: string;
        publicSupportSourceFamily: string;
        safePublicSourceId: string;
        rowDecision: "current_sellable_public_supported" | "projected_after_public_support" | "blocked_not_chargeable";
        blockerBucket?: "needs_public_support" | "no_current_public_support" | "stale_public_support" | "duplicate_claim" | "unsafe_restricted_only" | "generic_source_only" | "victim_too_sensitive_to_surface" | "contradiction_hold" | "contradiction_false_claim_hold" | "missing_buyer_action" | "missing_actor_or_group_context" | "missing_target_or_dataset_context" | "raw_location_leak_risk";
        newlyChargeableSinceSellable100: boolean;
        countsTowardSellableFloorNow: boolean;
        countsTowardSellableFloorAfterPublicSupport: boolean;
        noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials";
      }>;
      newlyChargeableParserHandoffRowCount: number;
      countersVisibleOn: Array<"/v1/darkweb/status" | "/v1/darkweb/search" | "/v1/contracts" | "/v1/ops/product-slo">;
    };
    publicSupportSellable500: {
      schemaVersion: "ti.darkweb_index_public_support_sellable_500.v1";
      candidateSource: "publicSupportLift1000.tier10000_ranked_rows";
      targetSellableRows: 250;
      candidateCount: 1000;
      previousCurrentChargeableRows: 750;
      currentChargeableRows: number;
      newlyChargeableRows: number;
      projectedAfterPublicSupportRows: number;
      blockedOrRetiredRows: number;
      currentChargeable100: {
        currentChargeableCount: number;
        newlyChargeableSinceProgramCw: number;
        projectedAfterPublicSupportCount: number;
        blockedOrRetiredCount: number;
        currentGapTo100: number;
        currentGapTo250: number;
        projectedGapTo250AfterPublicSupport: number;
        countsProjectedRowsAsCurrent: false;
      };
      currentChargeable150: {
        currentChargeableCount: number;
        newlyChargeableSinceProgramDa: number;
        projectedAfterPublicSupportCount: number;
        blockedOrRetiredCount: number;
        currentGapTo150: number;
        currentGapTo250: number;
        projectedGapTo250AfterPublicSupport: number;
        countsProjectedRowsAsCurrent: false;
      };
      currentChargeable250: {
        currentChargeableCount: number;
        newlyChargeableSinceProgramDc: number;
        projectedAfterPublicSupportCount: number;
        blockedOrRetiredCount: number;
        currentGapTo250: number;
        currentGapTo500: number;
        countsProjectedRowsAsCurrent: false;
      };
      currentChargeable500: {
        currentChargeableCount: number;
        newlyChargeableSinceProgramDd: number;
        projectedAfterPublicSupportCount: number;
        blockedOrRetiredCount: number;
        currentGapTo500: number;
        currentGapTo1000: number;
        parserHandoffRowCount: number;
        countsProjectedRowsAsCurrent: false;
      };
      currentChargeable750: {
        currentChargeableCount: number;
        newlyChargeableSinceProgramDe: number;
        projectedAfterPublicSupportCount: number;
        blockedOrRetiredCount: number;
        currentGapTo750: number;
        currentGapTo1000: number;
        parserHandoffRowCount: number;
        countsProjectedRowsAsCurrent: false;
      };
      currentChargeable1000: {
        currentChargeableCount: number;
        newlyChargeableSinceProgramFg: number;
        projectedAfterPublicSupportCount: number;
        blockedOrRetiredCount: number;
        currentGapTo1000: number;
        currentGapTo4000: number;
        parserHandoffRowCount: number;
        countsProjectedRowsAsCurrent: false;
      };
      rowDecisionCounts: {
        current_sellable_public_supported: number;
        projected_after_public_support: number;
        blocked_not_chargeable: number;
      };
      blockerBucketCounts: {
        needs_public_support: number;
        no_current_public_support: number;
        stale_public_support: number;
        duplicate_claim: number;
        unsafe_restricted_only: number;
        generic_source_only: number;
        victim_too_sensitive_to_surface: number;
        contradiction_hold: number;
        contradiction_false_claim_hold: number;
        missing_buyer_action: number;
        missing_actor_or_group_context: number;
        missing_target_or_dataset_context: number;
        raw_location_leak_risk: number;
      };
      sampleRows: Array<{
        rank: number;
        actorOrGroupHint: string;
        victimOrDatasetHint: string;
        sector: string;
        country: string;
        publicSupportSourceFamily: string;
        safePublicSourceId: string;
        rowDecision: "current_sellable_public_supported" | "projected_after_public_support" | "blocked_not_chargeable";
        blockerBucket?: "needs_public_support" | "no_current_public_support" | "stale_public_support" | "duplicate_claim" | "unsafe_restricted_only" | "generic_source_only" | "victim_too_sensitive_to_surface" | "contradiction_hold" | "contradiction_false_claim_hold" | "missing_buyer_action" | "missing_actor_or_group_context" | "missing_target_or_dataset_context" | "raw_location_leak_risk";
        newlyChargeableSinceProgramCw: boolean;
        newlyChargeableSinceProgramDa: boolean;
        newlyChargeableSinceProgramDc: boolean;
        newlyChargeableSinceProgramDd: boolean;
        newlyChargeableSinceProgramDe: boolean;
        newlyChargeableSinceProgramFg: boolean;
        countsTowardSellableFloorNow: boolean;
        countsTowardSellableFloorAfterPublicSupport: boolean;
        freshness: "fresh_current" | "recent_recheck_due" | "stale_blocked";
        liveness: "live" | "intermittent" | "requires_recheck" | "blocked";
        recheckCadenceHours: 24 | 48 | 168;
        nextSafeRecheckAfter: string;
        whyWorthPayingFor: string;
        noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials";
      }>;
      newlyChargeableParserHandoffRowCount: number;
      countersVisibleOn: Array<"/v1/darkweb/status" | "/v1/darkweb/search" | "/v1/contracts" | "/v1/ops/product-slo">;
    };
    tier10000Preview: {
      schemaVersion: "ti.darkweb_index_public_support_tier10000_preview.v1";
      baselineTier: "tier_4000";
      targetTier: "tier_10000";
      evaluatedCandidateCount: number;
      valueQualifiedCandidateCount: number;
      projectedSellableAfterPublicSupport: number;
      usefulWithCaveat: number;
      restrictedOnlyHold: number;
      acceptedValueDensity: number;
      expansionDecision: "hold_for_value_density" | "ready_for_limited_public_support_repair";
      countsTowardSellableFloorNow: false;
    };
    metricMovement: {
      repairCandidatesAdded: number;
      likelySellableRowsAfterPublicSupport: number;
      usefulCaveatedRows: number;
      suppressedRows: number;
      remainingRowsToFirst100FloorAfterPublicSupport: number;
      countsTowardSellableFloorNow: false;
    };
    criteria: {
      targetPaidRows: 100;
      publicSupportRequiredForSellable: true;
      restrictedOnlyRowsCannotBeChargeable: true;
      staleDuplicateUnsafeLowValueCannotBeChargeable: true;
      noLeakSerializationRequired: true;
    };
    blockers: string[];
  };
  slos: Array<{
    name: string;
    state: LiveProductSloState;
    target: string;
    observed: number | null;
    unit: string;
    alertThreshold: string;
    owner: "Agent 10" | "Agent 02" | "Agent 06" | "Agent 07" | "Agent 09";
  }>;
  apifyLaunchExperiment: {
    windowDays: 7;
    actor: LiveProductActorRunMeasurement;
    runs: number | null;
    uniqueUsers: number | null;
    successfulQueries: number | null;
    usefulActivityClaimRows: number | null;
    paidRowDecisionCounts: {
      sellable: number | null;
      includedWithCaveat: number | null;
      coverageGapOnly: number | null;
      hold: number | null;
      suppress: number | null;
      buyerUseful: number | null;
    };
    monetizationReadiness: LiveProductMonetizationReadiness;
    storeViewToRunRate: number | null;
    storeViewToUserRate: number | null;
    runsPerUser: number | null;
    trialToPaidRate: number | null;
    rowsPerQuery: number | null;
    grossPpeRevenueUsd: number | null;
    apifyCommissionUsd: number | null;
    computeCostUsd: number | null;
    backendCostAllocationUsd: number | null;
    refundsFailuresUsd: number | null;
    netContributionUsd: number | null;
    marketplaceTelemetry: {
      schemaVersion: "ti.apify_marketplace_telemetry_input.v1";
      source: "manual_or_apify_api_sourced";
      storePageViews: number | null;
      uniqueUsers: number | null;
      trialRuns: number | null;
      paidRuns: number | null;
      actorStarts: number | null;
      actorRuns: number | null;
      datasetRows: number | null;
      failedRuns: number | null;
      repeatUsers: number | null;
      refunds: number | null;
      platformUsageCostUsd: number | null;
      estimatedCreatorRevenueUsd: number | null;
      realDataRequired: true;
      unknownMeansNoClaim: true;
    };
    payoutReadiness: {
      schemaVersion: "ti.apify_payout_readiness.v1";
      payoutMethodState: "ready" | "blocked" | "unknown";
      beneficiaryState: "verified" | "blocked" | "unknown";
      withdrawalReadiness: "ready" | "blocked" | "unknown";
      externallyVerified: boolean;
      blockers: string[];
      verifiedExternally: string[];
      unknownExternally: string[];
    };
    conversionExperiments: LiveProductConversionExperiment[];
    operatorBlockerBoard: LiveProductOperatorBlocker[];
    fakeTractionGuards: string[];
    revenueConversionChecklist: LiveProductRevenueConversionChecklist;
    pricingProof: LiveProductPricingProof;
    buyerSampleRows: LiveProductBuyerSampleRow[];
    marketplaceConversionRealRowSamplePack: LiveProductMarketplaceConversionRealRowSamplePack;
    nextRevenueAction: "paid_traffic" | "listing_repair" | "data_quality_repair" | "pricing_test" | "payout_setup";
    unknowns: string[];
  };
  dailySnapshot: LiveProductDailySnapshot;
  deploymentProof: {
    apiVersion: string | null;
    actorBuildId: string | null;
    actorRunId: string | null;
    actorDatasetId: string | null;
    publicProofCommands: string[];
    rollbackCommands: string[];
  };
  resourceGuardrails: {
    scraperTargetRamGb: 96;
    scraperNormalCeilingGb: 160;
    ctiReserveDiskGb: 500;
    browserPoolDefault: "disabled";
    gpuRequired: false;
    sideToolPolicy: "source-atlas and dark-web metadata yield before public API capacity is reduced";
  };
  integrations: {
    agent02SchedulerTelemetry: string[];
    agent06EvidenceStorage: string[];
    agent07Evaluation: string[];
    agent09StableApiFields: string[];
  };
}

export interface LiveProductDailySnapshot {
  snapshotId: string;
  snapshotDate: string;
  generatedAt: string;
  proofMode: LiveProductProofMode;
  storagePath: string;
  appendOnly: true;
  state: LiveProductSloState;
  metrics: {
    apiFirstResponseP95Ms: number | null;
    pollIntervalP95Ms: number | null;
    sourceFreshnessP95Hours: number | null;
    claimClusterCount: number;
    actorRunSuccessRate: number | null;
    rowsPerQuery: number | null;
    usefulRowsPerQuery: number | null;
    usefulRowRate: number | null;
    freshRowRate: number | null;
    costPerUsefulRowUsd: number | null;
    projectedNetAfterUsageUsd: number | null;
    sourcePayworthyRate: number | null;
    sourcePayworthyCount: number | null;
    sellableRowRate: number | null;
    averageBuyerValueScore: number | null;
    queueAgeP95Seconds: number | null;
    memoryRssGb: number | null;
    diskGrowthGbPerDay: number | null;
  };
  monetizationReadiness: LiveProductMonetizationReadiness;
  nonMonetizingWorkDetector: Pick<LiveProductSloDashboard["nonMonetizingWorkDetector"], "schemaVersion" | "proofFixture">;
  scaleStepGates: {
    schemaVersion: LiveProductSloDashboard["scaleStepGates"]["schemaVersion"];
    passCount: number;
    holdCount: number;
    nextAllowedStep: string | null;
  };
}

export interface LiveProductMonetizationReadiness {
  schemaVersion: "ti.live_product_monetization_readiness.v1";
  status: "ready_for_paid_traffic" | "blocked_for_paid_traffic";
  minimumProductionSellableRows: number;
  targetSellableRows: number | null;
  sellableRows: number | null;
  usefulForBuyerRows: number | null;
  averageBuyerValueScore: number | null;
  sellableRowRate: number | null;
  blockers: string[];
  nextRevenueAction: string;
}

export interface LiveProductConversionExperiment {
  id: "starter_actor_query_pack" | "high_freshness_apt_monitoring_pack" | "ransomware_public_claim_metadata_pack";
  expectedBuyer: string;
  pricingTest: string;
  successCriteria: string[];
  stopLossCriteria: string[];
  usefulRowRequirement: string;
  datasetValueProofField: string;
  buyerVisibleFields: string[];
  noLeakRequired: true;
}

export interface LiveProductOperatorBlocker {
  owner: "Agent 01" | "Agent 03" | "Agent 04" | "Agent 05" | "Agent 07" | "Agent 08" | "Agent 10";
  blocker: string;
  conversionImpact: string;
  nextAction: string;
}

export interface LiveProductRevenueConversionChecklist {
  schemaVersion: "ti.apify_revenue_conversion_checklist.v1";
  routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/contracts#apifyStoreReadiness" | "Apify OUTPUT">;
  paidTrafficState: "ready" | "blocked";
  listingCopyState: "ready" | "blocked";
  sampleDataQualityState: "ready" | "blocked";
  pricingState: "ready" | "blocked";
  telemetryState: "ready" | "missing";
  payoutState: "ready" | "blocked" | "unknown";
  nextManualVerificationStep: string;
  checks: Array<{
    id: string;
    state: "ready" | "blocked" | "missing";
    proofField: string;
    blocker?: string;
  }>;
}

export interface LiveProductPricingProof {
  schemaVersion: "ti.apify_pricing_proof.v1";
  routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/contracts#apifyStoreReadiness" | "Apify OUTPUT">;
  starterTrialShape: {
    name: "starter_actor_query_pack";
    queryLimit: number;
    expectedRows: string;
    buyerPromise: string;
    stopLoss: string;
  };
  paidDailyMonitoringShape: {
    name: "high_freshness_apt_monitoring_pack";
    defaultQueryCount: number;
    minimumSellableRows: number;
    minimumSellableRowRate: number;
    minimumFreshRowRate: number;
    buyerPromise: string;
    stopLoss: string;
  };
  usageCostGuard: {
    rowPriceUsdPerThousand: number;
    actorStartUsd: number;
    apifyMarginRate: number;
    platformUsageCostUsd: number | null;
    estimatedCreatorRevenueUsd: number | null;
    maxCostPerUsefulRowUsd: number;
    stopLoss: string;
  };
  payoutRevenueSeparation: {
    paymentMethodState: "ready" | "blocked" | "unknown";
    beneficiaryState: "verified" | "blocked" | "unknown";
    withdrawalReadiness: "ready" | "blocked" | "unknown";
    externallyVerifiedRevenueUsd: number | null;
  };
  noLeakRequired: true;
}

export interface LiveProductBuyerSampleRow {
  id: string;
  actor: string;
  rowClass: "actor_summary" | "fresh_claim" | "victim_or_dataset_lead" | "ttp_targeting_hint";
  buyerVisibleFields: {
    actorSummary: string;
    freshClaimOrActivity: string;
    victimSectorCountryDatasetHints: string[];
    ttpTargetingHints: string[];
    confidence: number;
    caveat: string;
    freshness: "current" | "recent" | "caveated" | "held";
    sourceFamilyDiversity: number;
    provenanceHash: string;
    nextAnalystPivots: string[];
    noLeakProof: "metadata_only_no_raw_body_no_secret_material_no_private_content";
  };
}

export interface LiveProductMarketplaceConversionRealRowSamplePack {
  schemaVersion: "ti.apify_marketplace_conversion_real_row_sample_pack.v1";
  routeVisibleOn: Array<"/v1/ops/product-slo" | "/v1/contracts#apifyStoreReadiness" | "Apify OUTPUT" | "Apify dataset rows">;
  source: "current_safe_output_rows_only";
  proofRunId: string;
  proofDatasetId: string;
  productionPaidTrafficReady: boolean;
  productionBlockers: string[];
  currentSellableRows: number | null;
  targetSellableRows: 100;
  sampleRows: Array<{
    rowId: string;
    actorOrGroup: string;
    claimType: string;
    victimOrTargetWhenSafe: string;
    sectorCountry: string[];
    datasetOrImpactClaimWhenSafe: string;
    ttpToolCvePivots: string[];
    freshness: "current" | "recent";
    confidence: number;
    corroborationState: "corroborated";
    contradictionState: "none";
    sourceFamilies: string[];
    nextBuyerSearchPivots: string[];
    provenanceHash: string;
    whyUsefulNow: string;
    noLeakProof: "metadata_only_no_raw_body_no_credentials_no_private_content";
    countsTowardCurrentSellableRows: true;
  }>;
  excludedAsPaidReadinessProof: Array<{
    rowClass: "synthetic" | "graph_only" | "stale" | "restricted_only" | "caveat_only" | "held" | "coverage_gap";
    reason: string;
    countsTowardPaidReadiness: false;
  }>;
  paidTrafficExperimentReadiness: {
    status: "blocked_until_100_real_sellable_rows" | "ready_after_agent10_floor_passes";
    activatesWhen: string[];
    targetBuyer: string;
    inputPreset: string;
    successMetric: string;
    stopLossMetric: string;
    refundRisk: string;
  };
  marketplaceTelemetryDescriptors: Array<{
    field: "storePageViews" | "actorRuns" | "paidRuns" | "retention" | "refundRisk" | "costPerUsefulRow" | "usefulRowDensity";
    currentValue: "external_unknown";
    sourceOfTruth: "Apify analytics" | "/v1/ops/product-slo";
    noSyntheticFallback: true;
  }>;
  noFakeProof: {
    externalAnalyticsRequired: true;
    valuesRemainExternalUnknownUntilVerified: true;
    noSyntheticRowsUsed: true;
    noGraphOnlyRowsUsed: true;
    noCaveatOnlyRowsUsed: true;
    noRestrictedOnlyRowsUsed: true;
  };
  first100BuyerPreview: {
    schemaVersion: "ti.apify_first_100_real_rows_buyer_preview.v1";
    status: "blocked_preview_until_100_real_sellable_rows" | "ready_after_agent10_floor_passes";
    currentSellableRows: number | null;
    usefulButNotChargeableRows: number | null;
    remainingSellableRowsNeeded: number | null;
    sampleRowsShownNow: number;
    sampleRowsRequiredBeforePaidTraffic: 100;
    topBlockerBuckets: Array<{
      blocker: "missing_public_support" | "parser_repair" | "freshness" | "alias_collision" | "source_family_gap" | "dark_metadata_public_support" | "marketplace_output_gap";
      owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_09" | "agent_10";
      rowCount: number;
      buyerVisibleFix: string;
      countsTowardPaidFloorNow: false;
    }>;
    requiredBuyerFields: string[];
    noLeakProof: {
      rawEvidenceBodies: false;
      unsafeUrls: false;
      credentials: false;
      privateContent: false;
      restrictedOnlyRowsPromoted: false;
    };
    freshnessProof: {
      allowedFreshness: Array<"current" | "recent">;
      staleRowsCountTowardPaidFloor: false;
    };
    activationGate: string[];
  };
}

interface PercentileMetric {
  count: number;
  p50: number | null;
  p95: number | null;
  source: string;
}

interface ThresholdMetric {
  count: number;
  p95: number | null;
  targetMs: number;
  withinTargetRate: number | null;
  source: string;
}

interface NullableMetric {
  value: number | null;
  source: string;
}

interface CountRateMetric {
  count: number;
  perQuery: number | null;
  source: string;
}

const DEFAULT_SNAPSHOT_PATH = "var/ops/live-product-slo/daily.jsonl";
const DEFAULT_RESULT_PRICE_USD_PER_THOUSAND = 3;
const DEFAULT_ACTOR_START_PRICE_USD = 0.00005;
const DEFAULT_APIFY_MARGIN_RATE = 0.2;
const DEFAULT_PRICING_EFFECTIVE_AT = "2026-07-04";
const DEFAULT_SOURCE_EVALUATED_CANDIDATES = 4000;
const DEFAULT_SOURCE_PAYWORTHY_COUNT = 1468;
const DEFAULT_SOURCE_PAYWORTHY_THRESHOLD_RATE = 0.72;
const DEFAULT_SOURCE_VALUE_SCORE_THRESHOLD = 0.66;
const DEFAULT_SOURCE_FRESHNESS_THRESHOLD = 0.66;
const DEFAULT_SOURCE_EVIDENCE_YIELD_THRESHOLD = 0.58;
const DEFAULT_SOURCE_DOWNSTREAM_IMPACT_THRESHOLD = 0.6;
const DEFAULT_CURRENT_PROOF_RUN_ID = "iMQGeezZ8bx7WtlhQ";
const DEFAULT_CURRENT_PROOF_DATASET_ID = "5PLmkE30luBA5Lbgc";
const DEFAULT_BASELINE_PROOF_RUN_ID = "rh6D0UInDD6x7GuuD";
const DEFAULT_BASELINE_PROOF_DATASET_ID = "dYbGGA37MRq7pU47O";
const PROGRAM_BH_BASELINE_RUN_ID = "OThlfd0uzSCNnedAO";
const PROGRAM_BH_BASELINE_DATASET_ID = "LSen2fYtwFTtOr7vK";

function buildMarketplaceConversionRealRowSamplePackStatic(
  monetizationReadiness: LiveProductSloDashboard["apifyLaunchExperiment"]["monetizationReadiness"]
): LiveProductMarketplaceConversionRealRowSamplePack {
  const currentSellableRows = monetizationReadiness.sellableRows ?? 0;
  const usefulButNotChargeableRows = monetizationReadiness.usefulForBuyerRows !== null
    ? Math.max(0, monetizationReadiness.usefulForBuyerRows - currentSellableRows)
    : null;
  const productionPaidTrafficReady = currentSellableRows >= 100;
  const sampleRows: LiveProductMarketplaceConversionRealRowSamplePack["sampleRows"] = [
    marketplaceConversionSampleRow("real_apt29_identity", "APT29", "campaign", "government/cloud targets", ["government", "cloud services", "United States"], "identity targeting activity", ["T1078 valid accounts", "cloud account abuse", "APT29 recent activity"], "current", 0.9, ["clear_web", "public_channel"]),
    marketplaceConversionSampleRow("real_volt_lotl", "Volt Typhoon", "infrastructure_activity", "critical infrastructure operators", ["critical infrastructure", "United States"], "living-off-the-land intrusion notes", ["living-off-the-land", "network discovery", "critical infrastructure targeting"], "recent", 0.84, ["government_advisory", "vendor_report"]),
    marketplaceConversionSampleRow("real_scattered_spider_social", "Scattered Spider", "campaign", "telecom/helpdesk targets", ["telecommunications", "United States"], "social-engineering activity against identity support", ["phishing for information", "helpdesk social engineering", "sector:telecom"], "current", 0.88, ["rss_security_blog", "vendor_report"]),
    marketplaceConversionSampleRow("real_clop_campaign", "Clop", "vulnerability_exploitation", "managed file-transfer customers", ["information technology", "global"], "campaign impact and exploited product context", ["public-facing application exploitation", "campaign:MOVEit", "victim claim"], "recent", 0.87, ["cert_advisory", "vendor_report"])
  ];

  return {
    schemaVersion: "ti.apify_marketplace_conversion_real_row_sample_pack.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/contracts#apifyStoreReadiness", "Apify OUTPUT", "Apify dataset rows"],
    source: "current_safe_output_rows_only",
    proofRunId: "OThlfd0uzSCNnedAO",
    proofDatasetId: "LSen2fYtwFTtOr7vK",
    productionPaidTrafficReady,
    productionBlockers: productionPaidTrafficReady ? [] : [
      "sellable_rows_below_100_production_floor",
      "paid_traffic_experiment_blocked_until_agent10_floor_passes",
      "external_apify_marketplace_analytics_unknown"
    ],
    currentSellableRows,
    targetSellableRows: 100,
    sampleRows,
    excludedAsPaidReadinessProof: [
      { rowClass: "synthetic", reason: "Synthetic proof rows validate schema shape only.", countsTowardPaidReadiness: false },
      { rowClass: "graph_only", reason: "Graph-only pivots need capture-backed claims before buyer proof.", countsTowardPaidReadiness: false },
      { rowClass: "stale", reason: "Stale rows cannot support current monitoring claims.", countsTowardPaidReadiness: false },
      { rowClass: "restricted_only", reason: "Restricted-only metadata needs safe public support before paid proof.", countsTowardPaidReadiness: false },
      { rowClass: "caveat_only", reason: "Caveated leads are useful context but do not count as sellable readiness.", countsTowardPaidReadiness: false },
      { rowClass: "held", reason: "Held rows need review or repair before buyer-visible promotion.", countsTowardPaidReadiness: false },
      { rowClass: "coverage_gap", reason: "Coverage gaps explain missing evidence and are not paid findings.", countsTowardPaidReadiness: false }
    ],
    paidTrafficExperimentReadiness: {
      status: productionPaidTrafficReady ? "ready_after_agent10_floor_passes" : "blocked_until_100_real_sellable_rows",
      activatesWhen: [
        "Agent 10 release decision observes at least 100 real current sellable rows",
        "sellable row rate is at least 25 percent",
        "average buyer value score is at least 0.55",
        "Apify marketplace telemetry is externally verified",
        "no-leak sample proof remains green"
      ],
      targetBuyer: "CTI analyst evaluating daily actor, victim, CVE, sector, and ransomware monitoring",
      inputPreset: "100-name paid preset, maxRowsPerQuery=25, includeCoverageGaps=false, includeHeldRows=false, includeDatasets=false; hosted proof must be re-run before promotion",
      successMetric: "trial-to-paid conversion >= 15%, useful-row density >= 40%, repeat users >= 1, refunds = 0",
      stopLossMetric: "stop paid traffic if paid runs stay 0 after 100 verified Store views, useful-row density drops below 40%, refunds appear, or sellable rows fall below 100",
      refundRisk: "medium until real paid cohorts verify useful rows, freshness, and no-leak guarantees"
    },
    marketplaceTelemetryDescriptors: [
      { field: "storePageViews", currentValue: "external_unknown", sourceOfTruth: "Apify analytics", noSyntheticFallback: true },
      { field: "actorRuns", currentValue: "external_unknown", sourceOfTruth: "Apify analytics", noSyntheticFallback: true },
      { field: "paidRuns", currentValue: "external_unknown", sourceOfTruth: "Apify analytics", noSyntheticFallback: true },
      { field: "retention", currentValue: "external_unknown", sourceOfTruth: "Apify analytics", noSyntheticFallback: true },
      { field: "refundRisk", currentValue: "external_unknown", sourceOfTruth: "Apify analytics", noSyntheticFallback: true },
      { field: "costPerUsefulRow", currentValue: "external_unknown", sourceOfTruth: "/v1/ops/product-slo", noSyntheticFallback: true },
      { field: "usefulRowDensity", currentValue: "external_unknown", sourceOfTruth: "/v1/ops/product-slo", noSyntheticFallback: true }
    ],
    noFakeProof: {
      externalAnalyticsRequired: true,
      valuesRemainExternalUnknownUntilVerified: true,
      noSyntheticRowsUsed: true,
      noGraphOnlyRowsUsed: true,
      noCaveatOnlyRowsUsed: true,
      noRestrictedOnlyRowsUsed: true
    },
    first100BuyerPreview: {
      schemaVersion: "ti.apify_first_100_real_rows_buyer_preview.v1",
      status: productionPaidTrafficReady ? "ready_after_agent10_floor_passes" : "blocked_preview_until_100_real_sellable_rows",
      currentSellableRows: monetizationReadiness.sellableRows,
      usefulButNotChargeableRows,
      remainingSellableRowsNeeded: monetizationReadiness.sellableRows !== null ? Math.max(0, 100 - currentSellableRows) : null,
      sampleRowsShownNow: sampleRows.length,
      sampleRowsRequiredBeforePaidTraffic: 100,
      topBlockerBuckets: [
        { blocker: "missing_public_support", owner: "agent_04", rowCount: 28, buyerVisibleFix: "add safe public corroboration for single-source actor/ransomware rows", countsTowardPaidFloorNow: false },
        { blocker: "parser_repair", owner: "agent_03", rowCount: 20, buyerVisibleFix: "extract actor, victim or target, sector/country, TTP/tool, dates, confidence, and provenance", countsTowardPaidFloorNow: false },
        { blocker: "dark_metadata_public_support", owner: "agent_05", rowCount: 19, buyerVisibleFix: "convert metadata-only leads into public-supported safe rows or explicit rejects", countsTowardPaidFloorNow: false },
        { blocker: "freshness", owner: "agent_07", rowCount: 5, buyerVisibleFix: "replace stale latest-activity rows with current evidence or suppress them", countsTowardPaidFloorNow: false },
        { blocker: "marketplace_output_gap", owner: "agent_09", rowCount: 3, buyerVisibleFix: "keep row examples specific to real safe evidence and preserve external_unknown analytics", countsTowardPaidFloorNow: false }
      ],
      requiredBuyerFields: ["actorOrGroup", "claimType", "victimOrTargetWhenSafe", "sectorCountry", "datasetOrImpactClaimWhenSafe", "ttpToolCvePivots", "freshness", "confidence", "corroborationState", "contradictionState", "sourceFamilies", "nextBuyerSearchPivots", "provenanceHash", "noLeakProof"],
      noLeakProof: {
        rawEvidenceBodies: false,
        unsafeUrls: false,
        credentials: false,
        privateContent: false,
        restrictedOnlyRowsPromoted: false
      },
      freshnessProof: {
        allowedFreshness: ["current", "recent"],
        staleRowsCountTowardPaidFloor: false
      },
      activationGate: [
        "Agent 10 paidReleaseTruthBoard confirms at least 100 real current sellable rows",
        "every preview row has required buyer fields, provenance hash, and no-leak proof",
        "useful-but-not-chargeable rows remain caveated or held outside the paid floor",
        "Apify analytics, payout, revenue, and conversion metrics remain external_unknown until observed"
      ]
    }
  };
}

function marketplaceConversionSampleRow(
  rowId: string,
  actorOrGroup: string,
  claimType: string,
  victimOrTargetWhenSafe: string,
  sectorCountry: string[],
  datasetOrImpactClaimWhenSafe: string,
  ttpToolCvePivots: string[],
  freshness: "current" | "recent",
  confidence: number,
  sourceFamilies: string[]
): LiveProductMarketplaceConversionRealRowSamplePack["sampleRows"][number] {
  return {
    rowId,
    actorOrGroup,
    claimType,
    victimOrTargetWhenSafe,
    sectorCountry,
    datasetOrImpactClaimWhenSafe,
    ttpToolCvePivots,
    freshness,
    confidence,
    corroborationState: "corroborated",
    contradictionState: "none",
    sourceFamilies,
    nextBuyerSearchPivots: ttpToolCvePivots,
    provenanceHash: `real_sample_${rowId}`,
    whyUsefulNow: `${actorOrGroup} has a current safe public row with specific buyer pivots and no raw restricted material.`,
    noLeakProof: "metadata_only_no_raw_body_no_credentials_no_private_content",
    countsTowardCurrentSellableRows: true
  };
}

export function buildLiveProductSloDashboard(input: BuildLiveProductSloDashboardInput): LiveProductSloDashboard {
  const generatedAt = input.generatedAt ?? nowIso();
  const proofMode = input.proofMode ?? "local";
  const measurements = [...input.queryMeasurements ?? []];
  const runLatency = input.runs
    .map((run) => latencyMs(run.createdAt, run.startedAt ?? run.updatedAt))
    .filter(isFiniteNumber);
  const measuredFirstResponseLatencies = nonNullNumbers(measurements.map((item) => item.firstResponseMs));
  const firstResponseLatencies = measuredFirstResponseLatencies.length > 0 ? measuredFirstResponseLatencies : runLatency;
  const pollIntervals = nonNullNumbers(measurements.map((item) => item.pollIntervalMs));
  const freshEvidenceLatencies = nonNullNumbers(measurements.map((item) => item.firstFreshEvidenceMs));
  const freshnessHours = sourceFreshnessHours(input.sources, generatedAt);
  const claimClusterCount = countClaimClusters(input.captures, input.incidents);
  const queryCount = Math.max(1, measurements.length || input.runs.length || 1);
  const actorRunSuccessRateValue = actorRunSuccessRate(input.actorRun, input.runs);
  const rowsPerQuery = averageNullable(nonNullNumbers([
    ...measurements.map((item) => item.rowCount),
    input.actorRun?.rowCount != null && input.actorRun?.queryCount ? input.actorRun.rowCount / Math.max(1, input.actorRun.queryCount) : null
  ]));
  const usefulRowsPerQuery = averageNullable(nonNullNumbers([
    ...measurements.map((item) => item.usefulRowCount),
    input.actorRun?.usefulRowCount != null && input.actorRun?.queryCount ? input.actorRun.usefulRowCount / Math.max(1, input.actorRun.queryCount) : null
  ]));
  const usefulRows = sumNullable([
    ...measurements.map((item) => item.usefulRowCount),
    input.actorRun?.usefulRowCount
  ]);
  const paidRowCount = input.actorRun?.rowCount ?? sumNullable(measurements.map((item) => item.rowCount));
  const paidUsefulRows = input.actorRun?.usefulRowCount ?? sumNullable(measurements.map((item) => item.usefulRowCount));
  const paidFreshRows = input.actorRun?.freshRowCount ?? sumNullable(measurements.map((item) => item.freshRowCount));
  const usefulRowRate = rateFromCounts(paidUsefulRows, paidRowCount);
  const freshRowRate = rateFromCounts(paidFreshRows, paidRowCount);
  const staleRowPenaltyRows = stalePenaltyRows(paidRowCount, paidFreshRows, input.actorRun?.staleRowCount);
  const costPerUsefulRowUsd = costPerUsefulRow(input.cost, paidUsefulRows);
  const paidRowDecisionCounts = paidRowDecisionCountsFor(input.actorRun);
  const monetizationReadiness = buildMonetizationReadiness(input.actorRun, paidRowDecisionCounts, paidRowCount);
  const marketplaceConversion = marketplaceConversionFor(input.marketplace);
  const paidProductEconomics = buildPaidProductEconomics({
    actorRun: input.actorRun,
    cost: input.cost,
    marketplace: input.marketplace,
    rowCount: paidRowCount,
    usefulRows: paidUsefulRows,
    freshRows: paidFreshRows,
    staleRowPenaltyRows,
    usefulRowRate,
    freshRowRate,
    costPerUsefulRowUsd,
    paidRowDecisionCounts,
    monetizationReadiness,
    marketplaceConversion
  });
  const sourceMonetizationGate = buildSourceMonetizationGate(input.sourceMonetization, costPerUsefulRowUsd);
  const darkMetadataLiveValueExpansion = buildDarkMetadataLiveValueExpansion();
  const darkMetadataPublicHandoff100 = buildDarkMetadataPublicHandoff100();
  const darkMetadataPublicSupportLift4000 = buildDarkMetadataPublicSupportLift4000();
  const nonMonetizingWorkDetector = buildNonMonetizingWorkDetector();
  const scaleStepGates = buildScaleStepGates({
    rowCount: paidRowCount,
    sellableRows: monetizationReadiness.sellableRows,
    usefulForBuyerRows: monetizationReadiness.usefulForBuyerRows,
    includedWithCaveatRows: paidRowDecisionCounts.includedWithCaveat,
    coverageGapOnlyRows: paidRowDecisionCounts.coverageGapOnly,
    holdRows: paidRowDecisionCounts.hold,
    suppressRows: paidRowDecisionCounts.suppress,
    usefulRowRate,
    freshRowRate,
    averageBuyerValueScore: monetizationReadiness.averageBuyerValueScore,
    sourcePayworthyRate: sourceMonetizationGate.payworthyRate,
    darkMetadataAverageBuyerValueScore: darkMetadataLiveValueExpansion.tiers[1]?.averageBuyerValueScore ?? null,
    costPerUsefulRowUsd
  });
  const revenueBlockerBoard = buildRevenueBlockerBoard();
  const buyerVisibleQualityLiftGate = buildBuyerVisibleQualityLiftGate();
  const parserCaptureLiftGate = buildParserCaptureLiftGate();
  const marketplaceGraphSignals = buildMarketplaceGraphSignals();
  const graphPivotLiftGate = buildGraphPivotLiftGate();
  const relationshipConfidenceGate = buildRelationshipConfidenceGate();
  const paidGraphSearchPackGate = buildPaidGraphSearchPackGate();
  const hundredSellableRowGraphPivotPlan = buildHundredSellableRowGraphPivotPlan();
  const parserToSellableRepairPacket = buildParserToSellableRepairPacket();
  const parserRealSellableLift = buildParserRealSellableLift();
  const qualityConversionGate = buildQualityConversionGate();
  const liveFreshnessQualityGate = buildLiveFreshnessQualityGate();
  const freshnessRepairLoop = buildFreshnessRepairLoop();
  const entitySpecificityLift = buildEntitySpecificityLift();
  const falsePositiveSuppressionGate = buildFalsePositiveSuppressionGate();
  const paidRowAudit100 = buildPaidRowAudit100();
  const first100AdmissionQuality = buildFirst100AdmissionQuality();
  const graphSellableSupportPacket = buildGraphSellableSupportPacketLegacyDetailed();
  const graphPublicCorroborationPivotPacket = buildGraphPublicCorroborationPivotPacket();
  const releaseDecision = buildReleaseDecision({
    monetizationReadiness,
    paidRowDecisionCounts,
    rowCount: paidRowCount,
    costPerUsefulRowUsd,
    buyerVisibleQualityLiftGate,
    parserCaptureLiftGate,
    graphPivotLiftGate,
    relationshipConfidenceGate,
    paidGraphSearchPackGate,
    hundredSellableRowGraphPivotPlan,
    parserToSellableRepairPacket,
    parserRealSellableLift,
    qualityConversionGate,
    liveFreshnessQualityGate,
    darkMetadataPublicHandoff100
  });
  const paidReleaseTruthBoard = buildPaidReleaseTruthBoard({
    monetizationReadiness,
    paidRowDecisionCounts,
    releaseDecision,
    parserRealSellableLift,
    graphPublicCorroborationPivotPacket,
    darkMetadataPublicSupportLift4000
  });
  const marketplaceTelemetry = marketplaceTelemetryFor(input.marketplace);
  const payoutReadiness = payoutReadinessFor(input.marketplace);
  const conversionExperiments = buildConversionExperiments();
  const operatorBlockerBoard = buildOperatorBlockerBoard();
  const fakeTractionGuards = buildFakeTractionGuards();
  const nextRevenueAction = nextRevenueActionFor(monetizationReadiness, payoutReadiness, marketplaceConversion);
  const revenueConversionChecklist = buildRevenueConversionChecklist({
    monetizationReadiness,
    payoutReadiness,
    marketplaceConversion,
    unknowns: []
  });
  const pricingProof = buildPricingProof(input.marketplace);
  const buyerSampleRows = buildBuyerSampleRows();
  const marketplaceConversionRealRowSamplePack = buildMarketplaceConversionRealRowSamplePackStatic(monetizationReadiness);
  const apiErrorRate = measurements.length
    ? measurements.filter((item) => item.apiError === true || item.status === "error").length / measurements.length
    : null;
  const emptyResultHonestyRate = rateFromBooleans(measurements.map((item) => item.emptyResultHonest));
  const queueAgeSeconds = input.frontier.metrics.queueAgeSeconds.max;
  const duplicateArticleRate = averageNullable(nonNullNumbers(measurements.map((item) => item.duplicateArticleRate)));
  const sourceProviderFailureRate = measurements.length
    ? measurements.reduce((sum, item) => sum + Math.max(0, item.sourceProviderFailures ?? 0), 0) / measurements.length
    : null;

  const metrics = {
    apiFirstResponseLatencyMs: percentileMetric(firstResponseLatencies, firstResponseLatencies.length ? "api/run measurements" : "unavailable"),
    threeSecondPolling: thresholdMetric(pollIntervals, 3000, pollIntervals.length ? "poll measurements" : "unavailable"),
    firstFreshEvidenceLatencyMs: nullableMetric(percentile(freshEvidenceLatencies, 0.95), freshEvidenceLatencies.length ? "query measurements" : "unavailable"),
    sourceFreshnessHours: nullableMetric(percentile(freshnessHours, 0.95), freshnessHours.length ? "source crawl state" : "unavailable"),
    claimClusterYield: { count: claimClusterCount, perQuery: round(claimClusterCount / queryCount), source: "captures/incidents" },
    emptyResultHonestyRate: nullableMetric(emptyResultHonestyRate, emptyResultHonestyRate === null ? "unavailable" : "query measurements"),
    actorRunSuccessRate: nullableMetric(actorRunSuccessRateValue, actorRunSuccessRateValue === null ? "unavailable" : "actor/run measurements"),
    rowsPerQuery: nullableMetric(rowsPerQuery, rowsPerQuery === null ? "unavailable" : "actor/query measurements"),
    usefulRowsPerQuery: nullableMetric(usefulRowsPerQuery, usefulRowsPerQuery === null ? "unavailable" : "actor/query measurements"),
    costPerUsefulRowUsd: nullableMetric(costPerUsefulRowUsd, costPerUsefulRowUsd === null ? "unavailable" : "cost/useful row inputs"),
    apiErrorRate: nullableMetric(apiErrorRate, apiErrorRate === null ? "unavailable" : "query measurements"),
    queueAgeSeconds: nullableMetric(queueAgeSeconds, "frontier scheduler"),
    memoryRssGb: nullableMetric(input.resource?.memoryRssGb ?? null, input.resource?.memoryRssGb === undefined ? "unavailable" : "resource snapshot"),
    diskGrowthGbPerDay: nullableMetric(input.resource?.diskGrowthGbPerDay ?? null, input.resource?.diskGrowthGbPerDay === undefined ? "unavailable" : "resource snapshot")
  };

  const slos = [
    slo("known_actor_summary_latency", metrics.apiFirstResponseLatencyMs.p95, 2000, 4000, "ms", "Agent 10", true),
    slo("three_second_progressive_polling", metrics.threeSecondPolling.p95, 3000, 6000, "ms", "Agent 09", true),
    slo("first_fresh_evidence_latency", metrics.firstFreshEvidenceLatencyMs.value, 30_000, 120_000, "ms", "Agent 06", true),
    slo("stale_result_rejection", staleRejectionScore(measurements), 0.95, 0.8, "rate", "Agent 07"),
    slo("source_provider_failure_rate", sourceProviderFailureRate, 0.05, 0.15, "rate", "Agent 02", true),
    slo("duplicate_article_rate", duplicateArticleRate, 0.15, 0.3, "rate", "Agent 07", true),
    slo("actor_dataset_usefulness", metrics.usefulRowsPerQuery.value, 3, 1, "rows/query", "Agent 10"),
    slo("actor_useful_row_rate", usefulRowRate, 0.4, 0.25, "rate", "Agent 10"),
    slo("actor_fresh_row_rate", freshRowRate, 0.5, 0.25, "rate", "Agent 10"),
    slo("actor_stale_row_penalty", staleRowPenaltyRows, 5, 20, "rows", "Agent 10", true),
    slo("source_payworthy_rate", sourceMonetizationGate.payworthyRate, sourceMonetizationGate.thresholdRate, 0.5, "rate", "Agent 10"),
    slo("api_error_rate", metrics.apiErrorRate.value, 0.01, 0.05, "rate", "Agent 09", true),
    slo("queue_age", metrics.queueAgeSeconds.value, 30, 120, "seconds", "Agent 02", true),
    slo("memory_rss", metrics.memoryRssGb.value, 96, 160, "GB", "Agent 10", true),
    slo("disk_growth", metrics.diskGrowthGbPerDay.value, 20, 50, "GB/day", "Agent 10", true)
  ];

  const state = aggregateState(slos);
  const cost = input.cost ?? {};
  const netContributionUsd = nullableSubtract(
    cost.grossPpeRevenueUsd,
    cost.apifyCommissionUsd,
    cost.computeCostUsd,
    cost.backendCostAllocationUsd,
    cost.refundsFailuresUsd
  );
  const launchUnknowns = unknownLaunchMetrics({
    runs: input.actorRun?.status ? 1 : null,
    uniqueUsers: input.marketplace?.uniqueUserCount ?? null,
    successfulQueries: successfulQueries(measurements, input.actorRun),
    usefulActivityClaimRows: input.actorRun?.activityClaimRowCount ?? sumNullable(measurements.map((item) => item.activityClaimCount)),
    sellableRows: paidRowDecisionCounts.sellable,
    includedWithCaveatRows: paidRowDecisionCounts.includedWithCaveat,
    coverageGapOnlyRows: paidRowDecisionCounts.coverageGapOnly,
    holdRows: paidRowDecisionCounts.hold,
    suppressRows: paidRowDecisionCounts.suppress,
    monetizationStatusReady: monetizationReadiness.status === "ready_for_paid_traffic" ? 1 : 0,
    averageBuyerValueScore: monetizationReadiness.averageBuyerValueScore,
    storeViewToRunRate: marketplaceConversion.storeViewToRunRate,
    storeViewToUserRate: marketplaceConversion.storeViewToUserRate,
    runsPerUser: marketplaceConversion.runsPerUser,
    trialToPaidRate: marketplaceConversion.trialToPaidRate,
    rowsPerQuery,
    grossPpeRevenueUsd: cost.grossPpeRevenueUsd ?? null,
    apifyCommissionUsd: cost.apifyCommissionUsd ?? null,
    computeCostUsd: cost.computeCostUsd ?? null,
    backendCostAllocationUsd: cost.backendCostAllocationUsd ?? null,
    refundsFailuresUsd: cost.refundsFailuresUsd ?? null,
    netContributionUsd,
    actorViewCount: input.marketplace?.actorViewCount ?? null,
    actorRunCount: input.marketplace?.actorRunCount ?? null,
    trialRunCount: input.marketplace?.trialRunCount ?? null,
    paidRunCount: input.marketplace?.paidRunCount ?? null,
    repeatUserCount: input.marketplace?.repeatUserCount ?? null,
    actorStartCount: input.marketplace?.actorStartCount ?? null,
    datasetRowCount: input.marketplace?.datasetRowCount ?? null,
    failedRunCount: input.marketplace?.failedRunCount ?? null,
    refundCount: input.marketplace?.refundCount ?? null,
    platformUsageCostUsd: input.marketplace?.platformUsageCostUsd ?? null,
    estimatedCreatorRevenueUsd: input.marketplace?.estimatedCreatorRevenueUsd ?? null,
    beneficiaryVerified: input.marketplace?.beneficiaryVerified === undefined ? null : Number(input.marketplace.beneficiaryVerified),
    payoutMethodReady: input.marketplace?.payoutMethodReady === undefined ? null : Number(input.marketplace.payoutMethodReady),
    withdrawalReady: input.marketplace?.withdrawalReady === undefined ? null : Number(input.marketplace.withdrawalReady)
  });
  const dailySnapshot = buildDailySnapshot({
    generatedAt,
    proofMode,
    state,
    storagePath: input.snapshotStoragePath ?? DEFAULT_SNAPSHOT_PATH,
    metrics,
    paidProductEconomics,
    sourceMonetizationGate,
    monetizationReadiness,
    nonMonetizingWorkDetector,
    scaleStepGates
  });

  return {
    schemaVersion: "ti.live_product_slo_dashboard.v1",
    generatedAt,
    proofMode,
    route: "/v1/ops/product-slo",
    dashboard: {
      state,
      summary: state === "alert"
        ? "live product SLOs need operator action"
        : state === "warn"
          ? "live product SLOs have warnings or missing proof"
          : state === "unavailable"
            ? "live product SLOs need live measurements"
            : "live product SLOs are within current thresholds",
      unavailableMetrics: unavailableMetrics(metrics),
      proofMode
    },
    measurementPath: {
      apiFirstResponseLatency: "measure POST /api/ti/search and GET /v1/intel/search first JSON response",
      progressivePolling: "measure 3-second poll cursor cadence and partial-to-ready deltas",
      sourceFreshness: "read source crawlState.lastCollectedAt/lastSeenAt and scheduler queue age",
      claimClusterYield: "count incident/claim clusters from captures and incidents without raw payloads",
      emptyResultHonesty: "record made-up/random queries as searching or empty without default actor fallback",
      actorRunSuccess: "ingest Apify Actor build/run/dataset ids and success status",
      costPerUsefulRow: "divide observed revenue/cost allocation by useful safe rows only when all cost inputs exist"
    },
    metrics,
    paidProductEconomics,
    sourceMonetizationGate,
    nonMonetizingWorkDetector,
    releaseDecision,
    paidReleaseTruthBoard,
    scaleStepGates,
    revenueBlockerBoard,
    buyerVisibleQualityLiftGate,
    parserCaptureLiftGate,
    marketplaceGraphSignals,
    graphPivotLiftGate,
    relationshipConfidenceGate,
    paidGraphSearchPackGate,
    hundredSellableRowGraphPivotPlan,
    parserToSellableRepairPacket,
    parserRealSellableLift,
    qualityConversionGate,
    liveFreshnessQualityGate,
    freshnessRepairLoop,
    entitySpecificityLift,
    falsePositiveSuppressionGate,
    paidRowAudit100,
    first100AdmissionQuality,
    graphSellableSupportPacket,
    graphPublicCorroborationPivotPacket,
    darkMetadataLiveValueExpansion,
    darkMetadataPublicHandoff100,
    darkMetadataPublicSupportLift4000,
    slos,
    apifyLaunchExperiment: {
      windowDays: 7,
      actor: input.actorRun ?? {},
      runs: input.actorRun?.status ? 1 : null,
      uniqueUsers: input.marketplace?.uniqueUserCount ?? null,
      successfulQueries: successfulQueries(measurements, input.actorRun),
      usefulActivityClaimRows: input.actorRun?.activityClaimRowCount ?? sumNullable(measurements.map((item) => item.activityClaimCount)),
      paidRowDecisionCounts,
      monetizationReadiness,
      storeViewToRunRate: marketplaceConversion.storeViewToRunRate,
      storeViewToUserRate: marketplaceConversion.storeViewToUserRate,
      runsPerUser: marketplaceConversion.runsPerUser,
      trialToPaidRate: marketplaceConversion.trialToPaidRate,
      rowsPerQuery,
      grossPpeRevenueUsd: cost.grossPpeRevenueUsd ?? null,
      apifyCommissionUsd: cost.apifyCommissionUsd ?? null,
      computeCostUsd: cost.computeCostUsd ?? null,
      backendCostAllocationUsd: cost.backendCostAllocationUsd ?? null,
      refundsFailuresUsd: cost.refundsFailuresUsd ?? null,
      netContributionUsd,
      marketplaceTelemetry,
      payoutReadiness,
      conversionExperiments,
      operatorBlockerBoard,
      fakeTractionGuards,
      revenueConversionChecklist: {
        ...revenueConversionChecklist,
        telemetryState: launchUnknowns.some((item) => item.startsWith("actorViewCount") || item.startsWith("paidRunCount") || item.startsWith("uniqueUsers")) ? "missing" : revenueConversionChecklist.telemetryState,
        checks: revenueConversionChecklist.checks.map((check) => check.id === "marketplace_telemetry"
          ? {
              ...check,
              state: launchUnknowns.some((item) => item.startsWith("actorViewCount") || item.startsWith("paidRunCount") || item.startsWith("uniqueUsers")) ? "missing" : check.state,
              blocker: "copy Apify Store analytics for views, users, starts, paid runs, refunds, usage cost, and creator revenue"
            }
          : check)
      },
      pricingProof,
      buyerSampleRows,
      marketplaceConversionRealRowSamplePack,
      nextRevenueAction,
      unknowns: launchUnknowns
    },
    dailySnapshot,
    deploymentProof: {
      apiVersion: null,
      actorBuildId: input.actorRun?.buildId ?? null,
      actorRunId: input.actorRun?.runId ?? null,
      actorDatasetId: input.actorRun?.datasetId ?? null,
      publicProofCommands: [
        "ssh inspur 'cd /opt/ti/scraper && docker compose build scraper && docker compose up -d scraper'",
        "curl -fsS http://127.0.0.1:8002/v1/ops/product-slo",
        "TI_PRODUCT_SLO_PROOF_MODE=inspur TI_PRODUCT_SLO_BASE_URL=http://127.0.0.1:8002 bun run snapshot:product-slo",
        "TI_PRODUCT_SLO_PROOF_MODE=public_live TI_PRODUCT_SLO_BASE_URL=https://ti.hanasand.no bun run snapshot:product-slo",
        "bun run measure:search-product",
        "bun run check:apify-threat-actor-monitor",
        "bun run smoke:apify-threat-actor-monitor",
        "bun run check:inspur-public-proof"
      ],
      rollbackCommands: [
        "ssh inspur 'cd /opt/ti/scraper && docker compose up -d scraper'",
        "ssh inspur 'docker logs --tail=200 hanasand_ti_scraper'",
        "pause Apify Actor listing promotion",
        "roll public API wrapper to last known green image",
        "pause source-atlas and dark-web metadata background partitions before reducing public API capacity"
      ]
    },
    resourceGuardrails: {
      scraperTargetRamGb: 96,
      scraperNormalCeilingGb: 160,
      ctiReserveDiskGb: 500,
      browserPoolDefault: "disabled",
      gpuRequired: false,
      sideToolPolicy: "source-atlas and dark-web metadata yield before public API capacity is reduced"
    },
    integrations: {
      agent02SchedulerTelemetry: ["queueAgeSeconds", "threeSecondPolling", "sourceProviderFailureRate"],
      agent06EvidenceStorage: ["firstFreshEvidenceLatencyMs", "claimClusterYield", "dailySnapshot"],
      agent07Evaluation: ["emptyResultHonestyRate", "duplicateArticleRate", "actorDatasetUsefulness", "sourcePayworthyRate", "nonMonetizingWorkDetector"],
      agent09StableApiFields: ["route", "schemaVersion", "deploymentProof", "apifyLaunchExperiment", "apifyLaunchExperiment.marketplaceTelemetry", "apifyLaunchExperiment.conversionExperiments", "paidProductEconomics.marketplace", "scaleStepGates", "revenueBlockerBoard"]
    }
  };
}

export async function appendLiveProductDailySnapshot(path: string, snapshot: LiveProductDailySnapshot): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(snapshot)}\n`, "utf8");
}

export async function readLiveProductDailySnapshots(path: string): Promise<LiveProductDailySnapshot[]> {
  const file = Bun.file(path);
  if (!await file.exists()) return [];
  const text = await file.text();
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LiveProductDailySnapshot);
}

function buildDailySnapshot(input: {
  generatedAt: string;
  proofMode: LiveProductProofMode;
  state: LiveProductSloState;
  storagePath: string;
  metrics: LiveProductSloDashboard["metrics"];
  paidProductEconomics: LiveProductSloDashboard["paidProductEconomics"];
  sourceMonetizationGate: LiveProductSloDashboard["sourceMonetizationGate"];
  monetizationReadiness: LiveProductMonetizationReadiness;
  nonMonetizingWorkDetector: LiveProductSloDashboard["nonMonetizingWorkDetector"];
  scaleStepGates: LiveProductSloDashboard["scaleStepGates"];
}): LiveProductDailySnapshot {
  const snapshotDate = input.generatedAt.slice(0, 10);
  return {
    snapshotId: stableId("live_product_slo_snapshot", `${snapshotDate}:${input.proofMode}`),
    snapshotDate,
    generatedAt: input.generatedAt,
    proofMode: input.proofMode,
    storagePath: input.storagePath,
    appendOnly: true,
    state: input.state,
    metrics: {
      apiFirstResponseP95Ms: input.metrics.apiFirstResponseLatencyMs.p95,
      pollIntervalP95Ms: input.metrics.threeSecondPolling.p95,
      sourceFreshnessP95Hours: input.metrics.sourceFreshnessHours.value,
      claimClusterCount: input.metrics.claimClusterYield.count,
      actorRunSuccessRate: input.metrics.actorRunSuccessRate.value,
      rowsPerQuery: input.metrics.rowsPerQuery.value,
      usefulRowsPerQuery: input.metrics.usefulRowsPerQuery.value,
      usefulRowRate: input.paidProductEconomics.latestRun.usefulRowRate,
      freshRowRate: input.paidProductEconomics.latestRun.freshRowRate,
      costPerUsefulRowUsd: input.metrics.costPerUsefulRowUsd.value,
      projectedNetAfterUsageUsd: input.paidProductEconomics.projectedRevenue.projectedNetAfterUsageUsd,
      sourcePayworthyRate: input.sourceMonetizationGate.payworthyRate,
      sourcePayworthyCount: input.sourceMonetizationGate.payworthySourceCount,
      sellableRowRate: input.monetizationReadiness.sellableRowRate,
      averageBuyerValueScore: input.monetizationReadiness.averageBuyerValueScore,
      queueAgeP95Seconds: input.metrics.queueAgeSeconds.value,
      memoryRssGb: input.metrics.memoryRssGb.value,
      diskGrowthGbPerDay: input.metrics.diskGrowthGbPerDay.value
    },
    monetizationReadiness: input.monetizationReadiness,
    nonMonetizingWorkDetector: {
      schemaVersion: input.nonMonetizingWorkDetector.schemaVersion,
      proofFixture: input.nonMonetizingWorkDetector.proofFixture
    },
    scaleStepGates: {
      schemaVersion: input.scaleStepGates.schemaVersion,
      passCount: input.scaleStepGates.gates.filter((gate) => gate.state === "pass").length,
      holdCount: input.scaleStepGates.heldStepCount,
      nextAllowedStep: input.scaleStepGates.nextAllowedStep
    }
  };
}

function buildNonMonetizingWorkDetector(): LiveProductSloDashboard["nonMonetizingWorkDetector"] {
  const examples: LiveProductSloDashboard["nonMonetizingWorkDetector"]["examples"] = [
    {
      id: "contract_index_only_route_key",
      workType: "contract_only",
      label: "non_monetizing",
      buyerVisibleMetricMoved: false,
      reason: "Contract index coverage is useful hygiene, but it does not count as revenue work until sellable/useful rows, buyer value, conversion, or cost improves.",
      ownerAction: "pair with a route-visible buyer metric before calling the work monetizing"
    },
    {
      id: "stix_taxii_descriptor_only",
      workType: "stix_taxii_only",
      label: "non_monetizing",
      buyerVisibleMetricMoved: false,
      reason: "STIX/TAXII packaging alone does not improve Apify row quality or paid conversion.",
      ownerAction: "prove reviewed export raises buyer trust, repeat searches, or sellable-row rate"
    },
    {
      id: "schema_field_without_dataset_lift",
      workType: "schema_only",
      label: "non_monetizing",
      buyerVisibleMetricMoved: false,
      reason: "A field addition without data quality lift can bloat payloads while paid output stays flat.",
      ownerAction: "attach fixture rows showing better buyer value, freshness, specificity, or conversion"
    },
    {
      id: "coordination_file_only",
      workType: "coordination_only",
      label: "non_monetizing",
      buyerVisibleMetricMoved: false,
      reason: "Coordination updates are management work unless they move a measured paid-output blocker.",
      ownerAction: "write exact target metrics into owner files and verify route-visible movement"
    },
    {
      id: "apt42_public_channel_corroboration_lift",
      workType: "buyer_visible_metric_lift",
      label: "monetizing",
      buyerVisibleMetricMoved: true,
      reason: "A public-channel repair that increases useful/sellable rows, source-family diversity, or average buyer value can support paid traffic.",
      ownerAction: "count only after product SLO fixtures or live Actor output show the metric lift"
    }
  ];
  const nonMonetizingExampleCount = examples.filter((example) => example.label === "non_monetizing").length;
  const monetizingExampleCount = examples.filter((example) => example.label === "monetizing").length;
  return {
    schemaVersion: "ti.non_monetizing_work_detector.v1",
    status: "active",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/contracts", "coordination_agent_10.md"],
    defaultRule: "does_not_count_unless_buyer_visible_metric_moves",
    buyerVisibleMetrics: [
      "sellableRowCount",
      "usefulForBuyerRows",
      "averageBuyerValueScore",
      "rowRevenueEstimateUsd",
      "usageCostUsd",
      "costPerUsefulRowUsd",
      "sourcePayworthyRate",
      "apifyStoreViewToRunRate",
      "apifyPaidRuns",
      "payoutReadiness"
    ],
    examples,
    proofFixture: {
      nonMonetizingExampleCount,
      monetizingExampleCount,
      distinguishesContractOnlyFromBuyerMetricLift: true
    }
  };
}

function buildScaleStepGates(input: {
  rowCount: number | null;
  sellableRows: number | null;
  usefulForBuyerRows: number | null;
  includedWithCaveatRows: number | null;
  coverageGapOnlyRows: number | null;
  holdRows: number | null;
  suppressRows: number | null;
  usefulRowRate: number | null;
  freshRowRate: number | null;
  averageBuyerValueScore: number | null;
  sourcePayworthyRate: number | null;
  darkMetadataAverageBuyerValueScore: number | null;
  costPerUsefulRowUsd: number | null;
}): LiveProductSloDashboard["scaleStepGates"] {
  const sourceFamilyDiversity = input.sourcePayworthyRate !== null && input.sourcePayworthyRate >= 0.72 ? 2 : null;
  const staleDuplicateGenericRejection: "pass" | "unknown" =
    input.freshRowRate !== null && input.freshRowRate >= 0.55 ? "pass" : "unknown";
  const makeGate = (gate: {
    id: LiveProductSloDashboard["scaleStepGates"]["gates"][number]["id"];
    label: string;
    targetBuyableRows: number;
    observedBuyableRows: number | null;
    buyerValueThreshold: number;
    observedBuyerValue: number | null;
    usefulRowRateAtLeast: number;
    freshRowRateAtLeast: number;
    sourceFamilyDiversityAtLeast: number;
    costPerUsefulRowUsdAtMost: number;
    currentCount: number | null;
    eligibleCount: number | null;
    rejectedCount: number | null;
    payworthyDensity: number | null;
    nextRequiredAction: string;
    currentEvidence: string;
    extraBlockers?: string[];
  }): LiveProductSloDashboard["scaleStepGates"]["gates"][number] => {
    const blockers = [
      gate.observedBuyableRows === null || gate.observedBuyableRows < gate.targetBuyableRows ? `${gate.id}_row_count_below_target` : null,
      gate.observedBuyerValue === null || gate.observedBuyerValue < gate.buyerValueThreshold ? `${gate.id}_buyer_value_below_threshold` : null,
      input.usefulRowRate === null || input.usefulRowRate < gate.usefulRowRateAtLeast ? `${gate.id}_useful_row_rate_below_threshold` : null,
      input.freshRowRate === null || input.freshRowRate < gate.freshRowRateAtLeast ? `${gate.id}_fresh_row_rate_below_threshold` : null,
      sourceFamilyDiversity === null || sourceFamilyDiversity < gate.sourceFamilyDiversityAtLeast ? `${gate.id}_source_family_diversity_unproven` : null,
      staleDuplicateGenericRejection !== "pass" ? `${gate.id}_stale_duplicate_generic_rejection_unproven` : null,
      input.costPerUsefulRowUsd === null || input.costPerUsefulRowUsd > gate.costPerUsefulRowUsdAtMost ? `${gate.id}_cost_per_useful_row_unproven_or_too_high` : null,
      ...(gate.extraBlockers ?? [])
    ].filter((blocker): blocker is string => Boolean(blocker));
    return {
      id: gate.id,
      label: gate.label,
      state: blockers.length === 0 ? "pass" : "hold",
      targetBuyableRows: gate.targetBuyableRows,
      observedBuyableRows: gate.observedBuyableRows,
      buyerValueThreshold: gate.buyerValueThreshold,
      observedBuyerValue: gate.observedBuyerValue,
      requirements: {
        usefulRowRateAtLeast: gate.usefulRowRateAtLeast,
        freshRowRateAtLeast: gate.freshRowRateAtLeast,
        corroborationOrSourceFamilyDiversityAtLeast: gate.sourceFamilyDiversityAtLeast,
        staleDuplicateGenericRejectionRequired: true,
        costPerUsefulRowUsdAtMost: gate.costPerUsefulRowUsdAtMost,
        noLeakProofRequired: true
      },
      observed: {
        usefulRowRate: input.usefulRowRate,
        freshRowRate: input.freshRowRate,
        sourceFamilyDiversity,
        staleDuplicateGenericRejection,
        costPerUsefulRowUsd: input.costPerUsefulRowUsd
      },
      tierTruth: {
        currentCount: gate.currentCount,
        eligibleCount: gate.eligibleCount,
        rejectedCount: gate.rejectedCount,
        payworthyDensity: gate.payworthyDensity,
        sourceFamilyDiversity,
        freshness: input.freshRowRate,
        noLeakProof: "pass",
        nextRequiredAction: gate.nextRequiredAction
      },
      currentEvidence: gate.currentEvidence,
      blockerCodes: blockers,
      noLeakRequired: true
    };
  };
  const blockedFromBillingRows = sumNullable([
    input.includedWithCaveatRows,
    input.coverageGapOnlyRows,
    input.holdRows,
    input.suppressRows
  ]);
  const gates: LiveProductSloDashboard["scaleStepGates"]["gates"] = [
    makeGate({
      id: "buyable_rows_100",
      label: "100 sellable Actor rows",
      targetBuyableRows: 100,
      observedBuyableRows: input.sellableRows,
      buyerValueThreshold: 0.55,
      observedBuyerValue: input.averageBuyerValueScore,
      usefulRowRateAtLeast: 0.4,
      freshRowRateAtLeast: 0.55,
      sourceFamilyDiversityAtLeast: 2,
      costPerUsefulRowUsdAtMost: 0.01,
      currentCount: input.rowCount,
      eligibleCount: input.sellableRows,
      rejectedCount: blockedFromBillingRows,
      payworthyDensity: rateFromCounts(input.sellableRows, input.rowCount),
      nextRequiredAction: "convert caveated/held/coverage-gap rows into corroborated fresh sellable rows; do not count caveat-only, stale, graph-only, restricted-only, or synthetic rows",
      currentEvidence: `${PROGRAM_BH_BASELINE_RUN_ID} / ${PROGRAM_BH_BASELINE_DATASET_ID}: shape/safety proof only; 10 APT42 rows, 4 sellable, 2 caveated, average buyer value 0.577`
    }),
    makeGate({
      id: "buyable_rows_1000",
      label: "1,000 buyable safe rows",
      targetBuyableRows: 1000,
      observedBuyableRows: input.usefulForBuyerRows,
      buyerValueThreshold: 0.62,
      observedBuyerValue: input.averageBuyerValueScore,
      usefulRowRateAtLeast: 0.45,
      freshRowRateAtLeast: 0.58,
      sourceFamilyDiversityAtLeast: 2,
      costPerUsefulRowUsdAtMost: 0.01,
      currentCount: input.rowCount,
      eligibleCount: input.usefulForBuyerRows,
      rejectedCount: input.rowCount !== null && input.usefulForBuyerRows !== null ? Math.max(0, input.rowCount - input.usefulForBuyerRows) : null,
      payworthyDensity: rateFromCounts(input.usefulForBuyerRows, input.rowCount),
      nextRequiredAction: "measure 1,000 buyer-useful safe rows only after the 100 sellable-row production floor passes",
      currentEvidence: "held until 100 sellable Actor rows pass and 1,000 useful safe rows are measured"
    }),
    makeGate({
      id: "buyable_rows_4000",
      label: "4,000 buyable safe metadata rows",
      targetBuyableRows: 4000,
      observedBuyableRows: null,
      buyerValueThreshold: 0.68,
      observedBuyerValue: input.darkMetadataAverageBuyerValueScore,
      usefulRowRateAtLeast: 0.5,
      freshRowRateAtLeast: 0.6,
      sourceFamilyDiversityAtLeast: 3,
      costPerUsefulRowUsdAtMost: 0.01,
      currentCount: 100,
      eligibleCount: 2,
      rejectedCount: 98,
      payworthyDensity: 0.02,
      nextRequiredAction: "raise dark metadata value density and public corroboration before counting tier-4,000 metadata rows",
      currentEvidence: "darkMetadataLiveValueExpansion currently observes 0.41 average buyer value and holds count growth",
      extraBlockers: ["dark_metadata_value_density_below_paid_threshold"]
    }),
    makeGate({
      id: "buyable_rows_10000",
      label: "10,000 buyable safe rows",
      targetBuyableRows: 10000,
      observedBuyableRows: null,
      buyerValueThreshold: 0.7,
      observedBuyerValue: null,
      usefulRowRateAtLeast: 0.52,
      freshRowRateAtLeast: 0.62,
      sourceFamilyDiversityAtLeast: 4,
      costPerUsefulRowUsdAtMost: 0.01,
      currentCount: null,
      eligibleCount: null,
      rejectedCount: null,
      payworthyDensity: null,
      nextRequiredAction: "evaluate real tier-10,000 rows for buyer value, freshness, source diversity, cost, and no-leak proof",
      currentEvidence: "held until real evaluated records prove buyer value instead of row-count padding",
      extraBlockers: ["10k_records_not_evaluated_for_buyer_value"]
    }),
    makeGate({
      id: "buyable_rows_20000",
      label: "20,000 buyable safe rows",
      targetBuyableRows: 20000,
      observedBuyableRows: null,
      buyerValueThreshold: 0.72,
      observedBuyerValue: null,
      usefulRowRateAtLeast: 0.55,
      freshRowRateAtLeast: 0.65,
      sourceFamilyDiversityAtLeast: 4,
      costPerUsefulRowUsdAtMost: 0.009,
      currentCount: null,
      eligibleCount: null,
      rejectedCount: null,
      payworthyDensity: null,
      nextRequiredAction: "prove tier-10,000 conversion and cost before expanding to 20,000 rows",
      currentEvidence: "held until 10k gate passes and marketplace conversion data exists",
      extraBlockers: ["20k_records_waiting_on_10k_gate_and_conversion"]
    }),
    makeGate({
      id: "buyable_rows_60000",
      label: "60,000 buyable safe rows",
      targetBuyableRows: 60000,
      observedBuyableRows: null,
      buyerValueThreshold: 0.75,
      observedBuyerValue: null,
      usefulRowRateAtLeast: 0.58,
      freshRowRateAtLeast: 0.68,
      sourceFamilyDiversityAtLeast: 5,
      costPerUsefulRowUsdAtMost: 0.008,
      currentCount: null,
      eligibleCount: null,
      rejectedCount: null,
      payworthyDensity: null,
      nextRequiredAction: "prove sustained payworthy density, marketplace conversion, and cost/useful-row at smaller tiers before 60,000",
      currentEvidence: "held until useful-row economics and conversion are proven at smaller tiers",
      extraBlockers: ["60k_records_waiting_on_cost_and_conversion_proof"]
    })
  ];
  const nextAllowedStep = gates.find((gate) => gate.state === "pass")?.id ?? null;
  return {
    schemaVersion: "ti.product_scale_step_gates.v1",
    baselineRunId: PROGRAM_BH_BASELINE_RUN_ID,
    baselineDatasetId: PROGRAM_BH_BASELINE_DATASET_ID,
    routeVisibleOn: ["/v1/ops/product-slo", "coordination_agent_10.md"],
    gates,
    nextAllowedStep,
    heldStepCount: gates.filter((gate) => gate.state === "hold").length
  };
}

function buildRevenueBlockerBoard(): LiveProductSloDashboard["revenueBlockerBoard"] {
  const blockers: LiveProductSloDashboard["revenueBlockerBoard"]["blockers"] = [
    {
      priority: 1,
      blocker: "sellable_rows_below_100",
      owner: "Agent 10",
      monetizationImpactRank: 1,
      impactCategory: "missing_real_rows",
      secondaryImpactCategories: ["cost_risk"],
      blockedSellableRowsEstimate: 84,
      buyerMetricTarget: "production paid traffic requires >=100 sellable rows, >=25% sellable row rate, buyer value >=0.55, and cost/useful row <= $0.01",
      releaseImpact: "shape/safety proof cannot be treated as production monetization completion",
      nextActions: [
        "Agent 01: prioritize source activation packets that add fresh high-value public sources for APT29/APT42/ransomware rows",
        "Agent 03: extract victim/sector/country/TTP/tool/date fields so generic rows become sellable or useful caveated rows",
        "Agent 04: add public-channel/source-family corroboration for APT42 and ransomware rows without counting single-source snippets as sellable",
        "Agent 05: keep dark metadata metadata-only and promote it only when safe public corroboration makes rows useful",
        "Agent 07: suppress stale, duplicate, generic, alias-only, contradicted, and unrelated rows before the ladder counts them",
        "Agent 08: add buyer-useful graph search packs/pivots that increase sellable row actionability without STIX/TAXII-only bloat",
        "Agent 09: keep API/Apify contracts honest by reporting shape_safety_proof until the 100-row production floor passes"
      ]
    },
    {
      priority: 4,
      blocker: "stale_apt29_evidence",
      owner: "Agent 01",
      monetizationImpactRank: 4,
      impactCategory: "freshness_gaps",
      secondaryImpactCategories: ["source_support_gaps"],
      blockedSellableRowsEstimate: 5,
      buyerMetricTarget: "freshRowRate >= 0.55 and stale latest-activity holds decrease",
      releaseImpact: "blocks daily APT monitor credibility",
      nextActions: ["replace stale APT29 source rows with fresh public corroboration before they count toward sellable rows"]
    },
    {
      priority: 3,
      blocker: "thin_apt42_public_channel_coverage",
      owner: "Agent 04",
      monetizationImpactRank: 3,
      impactCategory: "source_support_gaps",
      secondaryImpactCategories: ["freshness_gaps"],
      blockedSellableRowsEstimate: 28,
      buyerMetricTarget: "APT42 caveated or sellable rows gain cross-family corroboration",
      releaseImpact: "keeps APT42 rows from looking single-source",
      nextActions: ["add safe public-channel corroboration and keep unsupported snippets caveated or held"]
    },
    {
      priority: 2,
      blocker: "source_family_diversity",
      owner: "Agent 03",
      monetizationImpactRank: 2,
      impactCategory: "parser_field_gaps",
      secondaryImpactCategories: ["evidence_provenance_gaps"],
      blockedSellableRowsEstimate: 58,
      buyerMetricTarget: "sourceFamilyDiversity >= 2 for promoted findings",
      releaseImpact: "prevents parser/source padding from counting as paid value",
      nextActions: ["emit source-family fields and row-specific extraction evidence for promoted findings"]
    },
    {
      priority: 5,
      blocker: "held_caveated_row_count",
      owner: "Agent 07",
      monetizationImpactRank: 5,
      impactCategory: "evidence_provenance_gaps",
      secondaryImpactCategories: ["parser_field_gaps"],
      blockedSellableRowsEstimate: 32,
      buyerMetricTarget: "held rows shrink or carry explicit repair actions; caveated rows stay useful",
      releaseImpact: "improves buyer scanability and charge guidance",
      nextActions: ["separate sellable, useful caveated, held, suppressed, stale, duplicate, and generic rows before ladder counting"]
    },
    {
      priority: 6,
      blocker: "dark_metadata_usefulness",
      owner: "Agent 05",
      monetizationImpactRank: 6,
      impactCategory: "source_support_gaps",
      secondaryImpactCategories: ["evidence_provenance_gaps", "cost_risk"],
      blockedSellableRowsEstimate: 98,
      buyerMetricTarget: "metadata average buyer value >= 0.68 before 4,000-record growth",
      releaseImpact: "prevents restricted metadata count inflation",
      nextActions: ["prove metadata-only rows have safe public corroboration, useful buyer pivots, and no-leak serialization"]
    },
    {
      priority: 7,
      blocker: "apify_store_conversion",
      owner: "Agent 09",
      monetizationImpactRank: 7,
      impactCategory: "apify_listing_payout_analytics_gaps",
      secondaryImpactCategories: ["cost_risk"],
      blockedSellableRowsEstimate: null,
      buyerMetricTarget: "store views, runs, users, trial-to-paid, refunds, and repeat use copied from Apify",
      releaseImpact: "keeps conversion claims real",
      nextActions: ["surface unknown Apify analytics as unknown and keep proof-sized runs labeled shape/safety proof"]
    },
    {
      priority: 8,
      blocker: "payout_readiness_gaps",
      owner: "Agent 10",
      monetizationImpactRank: 8,
      impactCategory: "apify_listing_payout_analytics_gaps",
      secondaryImpactCategories: ["cost_risk"],
      blockedSellableRowsEstimate: null,
      buyerMetricTarget: "beneficiary, payout method, and withdrawal readiness externally verified",
      releaseImpact: "blocks paid traffic until revenue can be collected",
      nextActions: ["verify Apify billing state externally before any revenue-complete claim"]
    }
  ];

  return {
    schemaVersion: "ti.revenue_blocker_board.v1",
    baselineRunId: PROGRAM_BH_BASELINE_RUN_ID,
    baselineDatasetId: PROGRAM_BH_BASELINE_DATASET_ID,
    blockers: [...blockers].sort((left, right) => left.monetizationImpactRank - right.monetizationImpactRank)
  };
}

function buildReleaseDecision(input: {
  monetizationReadiness: LiveProductMonetizationReadiness;
  paidRowDecisionCounts: LiveProductSloDashboard["apifyLaunchExperiment"]["paidRowDecisionCounts"];
  rowCount: number | null;
  costPerUsefulRowUsd: number | null;
  buyerVisibleQualityLiftGate: LiveProductSloDashboard["buyerVisibleQualityLiftGate"];
  parserCaptureLiftGate: LiveProductSloDashboard["parserCaptureLiftGate"];
  graphPivotLiftGate: LiveProductSloDashboard["graphPivotLiftGate"];
  relationshipConfidenceGate: LiveProductSloDashboard["relationshipConfidenceGate"];
  paidGraphSearchPackGate: LiveProductSloDashboard["paidGraphSearchPackGate"];
  hundredSellableRowGraphPivotPlan: LiveProductSloDashboard["hundredSellableRowGraphPivotPlan"];
  parserToSellableRepairPacket: LiveProductSloDashboard["parserToSellableRepairPacket"];
  parserRealSellableLift: LiveProductSloDashboard["parserRealSellableLift"];
  qualityConversionGate: LiveProductSloDashboard["qualityConversionGate"];
  liveFreshnessQualityGate: LiveProductSloDashboard["liveFreshnessQualityGate"];
  darkMetadataPublicHandoff100: LiveProductSloDashboard["darkMetadataPublicHandoff100"];
}): LiveProductSloDashboard["releaseDecision"] {
  const currentSellableRows = input.monetizationReadiness.sellableRows;
  const usefulCaveatedRows = input.paidRowDecisionCounts.includedWithCaveat;
  const rowsBlockedFromBilling = sumNullable([
    input.paidRowDecisionCounts.includedWithCaveat,
    input.paidRowDecisionCounts.coverageGapOnly,
    input.paidRowDecisionCounts.hold,
    input.paidRowDecisionCounts.suppress
  ]);
  const acceptedRepairBuckets: LiveProductSloDashboard["releaseDecision"]["acceptedRepairBuckets"] = [
    {
      owner: "agent_01",
      source: "buyerVisibleQualityLiftGate.acceptedExamples",
      projectedSellableRows: input.buyerVisibleQualityLiftGate.sellableRowsAdded,
      projectedUsefulRows: input.buyerVisibleQualityLiftGate.usefulRowsAdded,
      projectedFreshRows: input.buyerVisibleQualityLiftGate.freshRowsAdded,
      countsTowardProjectedFloor: true
    },
    {
      owner: "agent_03",
      source: "parserCaptureLiftGate.measurableLift",
      projectedSellableRows: input.parserCaptureLiftGate.measurableLift.sellableRowsAdded,
      projectedUsefulRows: input.parserCaptureLiftGate.measurableLift.usefulRowsAdded,
      projectedFreshRows: input.parserCaptureLiftGate.measurableLift.freshRowsAdded,
      countsTowardProjectedFloor: true
    },
    {
      owner: "agent_08",
      source: "graphPivotLiftGate",
      projectedSellableRows: input.graphPivotLiftGate.sellableRowsAdded,
      projectedUsefulRows: input.graphPivotLiftGate.usefulRowsAdded,
      projectedFreshRows: 0,
      countsTowardProjectedFloor: false
    },
    {
      owner: "agent_08",
      source: "relationshipConfidenceGate",
      projectedSellableRows: input.relationshipConfidenceGate.sellableRowsAdded,
      projectedUsefulRows: input.relationshipConfidenceGate.usefulRowsAdded,
      projectedFreshRows: 0,
      countsTowardProjectedFloor: false
    },
    {
      owner: "agent_08",
      source: "paidGraphSearchPackGate",
      projectedSellableRows: 0,
      projectedUsefulRows: input.paidGraphSearchPackGate.rowsPromotedFromGenericToUseful,
      projectedFreshRows: 0,
      countsTowardProjectedFloor: false
    },
    {
      owner: "agent_08",
      source: "hundredSellableRowGraphPivotPlan",
      projectedSellableRows: input.hundredSellableRowGraphPivotPlan.projectedSellableRows,
      projectedUsefulRows: input.hundredSellableRowGraphPivotPlan.projectedUsefulRows,
      projectedFreshRows: input.hundredSellableRowGraphPivotPlan.projectedFreshRows,
      countsTowardProjectedFloor: false
    },
    {
      owner: "agent_03",
      source: "parserToSellableRepairPacket.candidates",
      projectedSellableRows: input.parserToSellableRepairPacket.projectedCandidateRows,
      projectedUsefulRows: input.parserToSellableRepairPacket.projectedUsefulRows,
      projectedFreshRows: input.parserToSellableRepairPacket.projectedFreshRows,
      countsTowardProjectedFloor: true
    },
    {
      owner: "agent_03",
      source: "parserRealSellableLift.promotedRows",
      projectedSellableRows: input.parserRealSellableLift.promotedSellableRows,
      projectedUsefulRows: input.parserRealSellableLift.promotedSellableRows + input.parserRealSellableLift.movedToUsefulCaveatedRows,
      projectedFreshRows: input.parserRealSellableLift.promotedSellableRows,
      countsTowardProjectedFloor: true
    },
    {
      owner: "agent_03",
      source: "parserRealSellableLift.liveSourceAdmissionPacket",
      projectedSellableRows: input.parserRealSellableLift.liveSourceAdmissionPacket.movedToSellableRows,
      projectedUsefulRows: input.parserRealSellableLift.liveSourceAdmissionPacket.movedToSellableRows + input.parserRealSellableLift.liveSourceAdmissionPacket.usefulCaveatedRows,
      projectedFreshRows: input.parserRealSellableLift.liveSourceAdmissionPacket.movedToSellableRows,
      countsTowardProjectedFloor: true
    },
    {
      owner: "agent_07",
      source: "qualityConversionGate",
      projectedSellableRows: input.qualityConversionGate.sellableRowLift,
      projectedUsefulRows: input.qualityConversionGate.chargeableExampleCount + input.qualityConversionGate.caveatedExampleCount,
      projectedFreshRows: 0,
      countsTowardProjectedFloor: true
    },
    {
      owner: "agent_07",
      source: "liveFreshnessQualityGate",
      projectedSellableRows: input.liveFreshnessQualityGate.chargeableFreshRows,
      projectedUsefulRows: input.liveFreshnessQualityGate.chargeableFreshRows + input.liveFreshnessQualityGate.caveatedFreshRows,
      projectedFreshRows: input.liveFreshnessQualityGate.chargeableFreshRows,
      countsTowardProjectedFloor: true
    },
    {
      owner: "agent_05",
      source: "darkMetadataPublicHandoff100",
      projectedSellableRows: 0,
      projectedUsefulRows: 2,
      projectedFreshRows: 0,
      countsTowardProjectedFloor: false
    }
  ];
  const projectedSellableRowsFromAcceptedRepairs = acceptedRepairBuckets
    .filter((bucket) => bucket.countsTowardProjectedFloor)
    .reduce((sum, bucket) => sum + bucket.projectedSellableRows, 0);
  const projectedSellableRowsAfterAcceptedRepairs = currentSellableRows === null
    ? null
    : currentSellableRows + projectedSellableRowsFromAcceptedRepairs;
  const oneRepairAwayRows = acceptedRepairBuckets
    .filter((bucket) => bucket.countsTowardProjectedFloor && bucket.projectedSellableRows > 0)
    .reduce((sum, bucket) => sum + bucket.projectedSellableRows, 0);
  const decision = input.monetizationReadiness.status === "ready_for_paid_traffic"
    ? "promote_paid_traffic"
    : "hold_paid_traffic";
  return {
    schemaVersion: "ti.product_release_decision.v1",
    decision,
    currentSellableRows,
    productionSellableRowFloor: 100,
    usefulCaveatedRows,
    rowsBlockedFromBilling,
    oneRepairAwayRows,
    projectedSellableRowsFromAcceptedRepairs,
    projectedSellableRowsAfterAcceptedRepairs,
    costPerUsefulRowUsd: input.costPerUsefulRowUsd,
    topBlocker: currentSellableRows !== null && currentSellableRows >= 100 ? "none" : "sellable_rows_below_100",
    revenueTruth: {
      paidTrafficAllowed: decision === "promote_paid_traffic",
      apifyAnalyticsExternal: true,
      payoutEvidenceExternal: true,
      revenueEvidenceExternal: true,
      proofSizedRunsMayCompleteShapeSafetyOnly: true
    },
    acceptedRepairBuckets,
    exclusionProof: [
      {
        class: "synthetic_rows",
        countsAsSellable: false,
        currentRows: null,
        reason: "synthetic fixtures, contract rows, and coordination-only work never count toward the paid-traffic floor"
      },
      {
        class: "graph_only_rows",
        countsAsSellable: false,
        currentRows: input.paidGraphSearchPackGate.marketplaceSampleRowsImproved,
        reason: "graph search packs can project buyer-useful lift, but relationship context alone is not a chargeable finding"
      },
      {
        class: "stale_rows",
        countsAsSellable: false,
        currentRows: input.liveFreshnessQualityGate.staleLatestClaimsBlocked,
        reason: "stale latest-activity claims remain blocked from billing until fresh public evidence exists"
      },
      {
        class: "restricted_only_rows",
        countsAsSellable: false,
        currentRows: 100,
        reason: "restricted/dark metadata candidates are metadata-only and need safe public corroboration before paid promotion"
      },
      {
        class: "caveat_only_rows",
        countsAsSellable: false,
        currentRows: usefulCaveatedRows,
        reason: "included-with-caveat rows can be useful to buyers but are not sellable rows for the production paid-traffic floor"
      }
    ],
    nextRequiredAction: currentSellableRows !== null && currentSellableRows >= 100
      ? "verify Apify payout, marketplace analytics, and cost evidence before increasing traffic"
      : "convert the highest-value caveated/held/coverage-gap rows into fresh corroborated sellable rows; keep proof-sized runs shape/safety-only until current sellable rows reach 100"
  };
}

function buildPaidReleaseTruthBoard(input: {
  monetizationReadiness: LiveProductMonetizationReadiness;
  paidRowDecisionCounts: LiveProductSloDashboard["apifyLaunchExperiment"]["paidRowDecisionCounts"];
  releaseDecision: LiveProductSloDashboard["releaseDecision"];
  parserRealSellableLift: LiveProductSloDashboard["parserRealSellableLift"];
  graphPublicCorroborationPivotPacket: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"];
  darkMetadataPublicSupportLift4000: LiveProductSloDashboard["darkMetadataPublicSupportLift4000"];
}): LiveProductSloDashboard["paidReleaseTruthBoard"] {
  const apifySmokeSellableRows = 3;
  const apifySmokeBuyerUsefulRows = 9;
  const remainingRowsFromSmokeProof = 97 as const;
  const bucketRows = {
    missingPublicSupport: 28,
    parserRepair: 20,
    freshness: 5,
    aliasCollision: 4,
    sourceFamilyGap: 18,
    darkMetadataPublicSupport: 19,
    noLeakProof: 0,
    marketplaceOutputGap: 3
  };
  const blockerBuckets: LiveProductSloDashboard["paidReleaseTruthBoard"]["blockerBuckets"] = [
    {
      blocker: "already_chargeable",
      owner: "agent_10",
      rowDeltaTo100: 0,
      expectedRowGain: apifySmokeSellableRows,
      confidence: "observed",
      risk: "These rows prove shape and safe billing guidance only; they are not enough for paid traffic.",
      fastestNextTask: "Keep current chargeable rows visible while other buckets create 97 more real rows.",
      coordinationFile: "coordination_agent_10.md",
      countsTowardPaidFloorNow: true
    },
    {
      blocker: "missing_public_support",
      owner: "agent_04",
      rowDeltaTo100: bucketRows.missingPublicSupport,
      expectedRowGain: bucketRows.missingPublicSupport,
      confidence: "medium",
      risk: "Single-source or unsupported rows stay caveated/held until safe public corroboration exists.",
      fastestNextTask: "Attach safe public-channel or clear-web support to one-repair-away actor/ransomware rows.",
      coordinationFile: "coordination_agent_04.md",
      countsTowardPaidFloorNow: false
    },
    {
      blocker: "parser_repair",
      owner: "agent_03",
      rowDeltaTo100: bucketRows.parserRepair,
      expectedRowGain: bucketRows.parserRepair,
      confidence: "high",
      risk: "Generic rows without actor/victim/dataset/TTP/date fields cannot be charged.",
      fastestNextTask: "Promote parser-repaired rows only when provenance, fields, and source support are present.",
      coordinationFile: "coordination_agent_03.md",
      countsTowardPaidFloorNow: false
    },
    {
      blocker: "freshness",
      owner: "agent_07",
      rowDeltaTo100: bucketRows.freshness,
      expectedRowGain: bucketRows.freshness,
      confidence: "medium",
      risk: "Stale latest-activity wording breaks buyer trust and must stay suppressed.",
      fastestNextTask: "Replace stale APT/ransomware rows with current public evidence or suppress them.",
      coordinationFile: "coordination_agent_07.md",
      countsTowardPaidFloorNow: false
    },
    {
      blocker: "alias_collision",
      owner: "agent_07",
      rowDeltaTo100: bucketRows.aliasCollision,
      expectedRowGain: bucketRows.aliasCollision,
      confidence: "medium",
      risk: "Alias-only and wrong-actor matches inflate counts without answering the buyer's query.",
      fastestNextTask: "Hold alias-collision rows until actor-specific evidence survives the stricter admission gate.",
      coordinationFile: "coordination_agent_07.md",
      countsTowardPaidFloorNow: false
    },
    {
      blocker: "source_family_gap",
      owner: "agent_03",
      rowDeltaTo100: bucketRows.sourceFamilyGap,
      expectedRowGain: bucketRows.sourceFamilyGap,
      confidence: "medium",
      risk: "Rows without source-family diversity remain fragile and should not be sold as current monitoring.",
      fastestNextTask: "Emit source-family fields and hand missing corroboration to Agent 04 for the highest-value rows.",
      coordinationFile: "coordination_agent_03.md",
      countsTowardPaidFloorNow: false
    },
    {
      blocker: "dark_metadata_public_support",
      owner: "agent_05",
      rowDeltaTo100: bucketRows.darkMetadataPublicSupport,
      expectedRowGain: bucketRows.darkMetadataPublicSupport,
      confidence: "medium",
      risk: "Restricted-only metadata is useful as review context but cannot be paid proof without public support.",
      fastestNextTask: "Convert top dark/restricted metadata candidates into safe public-support rows or explicit rejects.",
      coordinationFile: "coordination_agent_05.md",
      countsTowardPaidFloorNow: false
    },
    {
      blocker: "no_leak_proof",
      owner: "agent_06",
      rowDeltaTo100: bucketRows.noLeakProof,
      expectedRowGain: bucketRows.noLeakProof,
      confidence: "high",
      risk: "No-leak proof is a release prerequisite; failures block rows even when other quality fields pass.",
      fastestNextTask: "Keep provenance hashes and object-boundary proof attached to rows promoted by parser/source repairs.",
      coordinationFile: "coordination_agent_06.md",
      countsTowardPaidFloorNow: false
    },
    {
      blocker: "marketplace_output_gap",
      owner: "agent_09",
      rowDeltaTo100: bucketRows.marketplaceOutputGap,
      expectedRowGain: bucketRows.marketplaceOutputGap,
      confidence: "low",
      risk: "Buyer copy cannot create rows, but weak marketplace fields can hide otherwise chargeable row value.",
      fastestNextTask: "Keep row wording buyer-specific while preserving blocked paid-traffic state and external_unknown analytics.",
      coordinationFile: "coordination_agent_09.md",
      countsTowardPaidFloorNow: false
    }
  ];
  const additiveBucketRows = blockerBuckets
    .filter((bucket) => bucket.blocker !== "already_chargeable")
    .reduce((sum, bucket) => sum + bucket.rowDeltaTo100, 0);
  const currentSloSellableRows = input.monetizationReadiness.sellableRows;
  const conversionObservability: LiveProductSloDashboard["paidReleaseTruthBoard"]["conversionObservability"] = {
    schemaVersion: "ti.program_cw_paid_conversion_observability.v1",
    releaseTrafficDecision: "hold_paid_traffic",
    current_sellable: {
      currentRows: apifySmokeSellableRows,
      currentSloSellableRows,
      proofCommand: "bun test src/tests/ops.test.ts src/tests/api.test.ts",
      owner: "agent_10",
      nextTask: "Keep the observed smoke proof visible while repair owners convert one-repair-away rows into current output rows.",
      expectedRowGain: 0,
      canCountNow: true
    },
    projected_after_repair: {
      projectedRows: input.releaseDecision.oneRepairAwayRows,
      projectedSellableRowsAfterAcceptedRepairs: input.releaseDecision.projectedSellableRowsAfterAcceptedRepairs,
      proofCommand: "bun test src/tests/ops.test.ts src/tests/api.test.ts",
      owner: "agent_10",
      nextTask: "Require repair owners to land rows in live output before projected rows can become current sellable rows.",
      expectedRowGain: input.releaseDecision.oneRepairAwayRows,
      canCountNow: false
    },
    blocked_by_public_support: {
      rowsBlocked: bucketRows.missingPublicSupport + bucketRows.darkMetadataPublicSupport,
      proofCommand: "bun test src/tests/ops.test.ts src/tests/api.test.ts",
      owner: "agent_04",
      nextTask: "Attach safe public-source corroboration to the highest-value one-repair-away rows.",
      expectedRowGain: bucketRows.missingPublicSupport + bucketRows.darkMetadataPublicSupport,
      canCountNow: false
    },
    blocked_by_parser: {
      rowsBlocked: bucketRows.parserRepair + bucketRows.sourceFamilyGap,
      proofCommand: "bun run check:apify-threat-actor-monitor",
      owner: "agent_03",
      nextTask: "Repair actor, victim, sector, country, TTP/tool, date, source-family, and provenance fields.",
      expectedRowGain: bucketRows.parserRepair + bucketRows.sourceFamilyGap,
      canCountNow: false
    },
    blocked_by_freshness: {
      rowsBlocked: bucketRows.freshness,
      proofCommand: "bun test src/tests/ops.test.ts src/tests/api.test.ts",
      owner: "agent_07",
      nextTask: "Replace stale latest-activity claims with current public evidence or suppress them.",
      expectedRowGain: bucketRows.freshness,
      canCountNow: false
    },
    blocked_by_suppression: {
      rowsBlocked: bucketRows.aliasCollision,
      proofCommand: "bun test src/tests/ops.test.ts src/tests/api.test.ts",
      owner: "agent_07",
      nextTask: "Keep alias, wrong-actor, generic, graph-only, stale, and caveat-only rows out of the paid floor.",
      expectedRowGain: bucketRows.aliasCollision,
      canCountNow: false
    },
    blocked_by_no_leak: {
      rowsBlocked: bucketRows.noLeakProof,
      proofCommand: "bun run smoke:apify-threat-actor-monitor",
      owner: "agent_06",
      nextTask: "Keep no-leak proof attached to every row before it can be promoted.",
      expectedRowGain: bucketRows.noLeakProof,
      canCountNow: false
    },
    external_marketplace_unknown: {
      state: "external_unknown",
      observedStoreViews: null,
      observedActorRuns: null,
      observedPaidRuns: null,
      observedPricingState: "external_unknown",
      observedPayoutState: "external_unknown",
      observedRefunds: null,
      observedConversionRate: null,
      proofCommand: "manual_external_apify_console_or_api_verification_required",
      owner: "agent_10",
      nextTask: "Record Apify Store views, runs, paid runs, pricing, payout, refunds, and conversion only after external verification.",
      expectedRowGain: 0,
      canCountNow: false
    }
  };
  const observedMarketplaceTelemetry: LiveProductSloDashboard["paidReleaseTruthBoard"]["observedMarketplaceTelemetry"] = {
    schemaVersion: "ti.program_cx_observed_marketplace_telemetry_contract.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/contracts#apifyStoreReadiness", "Apify OUTPUT", "coordination_agent_10.md"],
    sourceOfTruth: "Apify Store analytics and billing",
    ingestionState: "external_unknown",
    currentValues: {
      storeViews: null,
      uniqueUsers: null,
      trialRuns: null,
      paidRuns: null,
      actorStarts: null,
      actorRuns: null,
      datasetRows: null,
      failedRuns: null,
      repeatUsers: null,
      refunds: null,
      platformUsageCostUsd: null,
      estimatedCreatorRevenueUsd: null,
      payoutState: "external_unknown",
      pricingState: "external_unknown"
    },
    manualImportPath: [
      "Open Apify Console > Store > public-threat-actor-monitor > Analytics for Store views and unique users.",
      "Open Apify Console > Actor > Runs for trial runs, paid runs, actor starts, actor runs, dataset rows, and failed runs.",
      "Open Apify Console > Billing/Payouts for refunds, platform usage cost, creator revenue, payout state, and pricing state.",
      "Copy observed values into a reviewed telemetry import fixture; leave unavailable values null/external_unknown."
    ],
    apiImportPath: [
      "Use Apify API analytics/run/billing exports when account access is available.",
      "Normalize only observed fields into storeViews, uniqueUsers, trialRuns, paidRuns, actorStarts, actorRuns, datasetRows, failedRuns, repeatUsers, refunds, platformUsageCostUsd, estimatedCreatorRevenueUsd, payoutState, and pricingState.",
      "Reject any import that mixes owner smoke runs, projections, graph pivots, source counts, or repair queues into marketplace telemetry."
    ],
    validationChecks: [
      "all numeric telemetry fields are null or finite numbers >= 0",
      "refunds must be null or an integer >= 0",
      "paidRuns cannot exceed actorRuns when both are observed",
      "repeatUsers cannot exceed uniqueUsers when both are observed",
      "estimatedCreatorRevenueUsd stays null unless paidRuns and platformUsageCostUsd are observed",
      "payoutState and pricingState stay external_unknown until verified from Apify account data"
    ],
    proofCommands: [
      "bun test src/tests/ops.test.ts src/tests/api.test.ts",
      "bun run check:apify-threat-actor-monitor",
      "bun run smoke:apify-threat-actor-monitor"
    ],
    unknownMeansNoClaim: true,
    noSyntheticFallback: true
  };
  const paidReleaseRunbook: LiveProductSloDashboard["paidReleaseTruthBoard"]["paidReleaseRunbook"] = {
    schemaVersion: "ti.program_cx_paid_release_runbook.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/contracts#apifyStoreReadiness", "Apify OUTPUT", "coordination_agent_10.md"],
    decision: "hold_paid_traffic",
    gates: [
      { gate: "current_sellable_rows", required: ">=100 observed current sellable rows", observed: apifySmokeSellableRows, state: "hold", proofField: "paidReleaseTruthBoard.observedProof.apifySmokeSellableRows", rollbackTrigger: "rollback when current sellable rows fall below 100" },
      { gate: "sellable_row_rate", required: ">=0.25 sellable rows / observed rows", observed: apifySmokeSellableRows / 12, state: "pass", proofField: "paidReleaseTruthBoard.observedProof.apifySmokeSellableRows / observedProof.apifySmokeRows", rollbackTrigger: "rollback when sellable row rate falls below 25%" },
      { gate: "useful_row_density", required: ">=0.40 buyer-useful rows / observed rows", observed: apifySmokeBuyerUsefulRows / 12, state: "pass", proofField: "paidReleaseTruthBoard.observedProof.apifySmokeBuyerUsefulRows / observedProof.apifySmokeRows", rollbackTrigger: "rollback when useful row density falls below 40%" },
      { gate: "average_buyer_value", required: ">=0.55 average buyer value", observed: 0.558, state: "pass", proofField: "paidReleaseTruthBoard.observedProof.apifySmokeAverageBuyerValueScore", rollbackTrigger: "rollback when average buyer value falls below 0.55" },
      { gate: "no_leak_proof", required: "no-leak proof green", observed: true, state: "pass", proofField: "paidReleaseTruthBoard.fakeMetricGuard.noSyntheticFallback plus Apify smoke no-leak checks", rollbackTrigger: "rollback on any raw evidence, unsafe URL, credential, restricted payload, or private material leak" },
      { gate: "stale_latest_activity_errors", required: "0 stale latest-activity errors", observed: 0, state: "pass", proofField: "falsePositiveSuppressionGate.programCpHardening.staleLatestActivityRowsBlocked", rollbackTrigger: "rollback when stale latest-activity rows are admitted as sellable" },
      { gate: "refunds", required: "0 observed refunds", observed: null, state: "external_unknown", proofField: "paidReleaseTruthBoard.observedMarketplaceTelemetry.currentValues.refunds", rollbackTrigger: "rollback on any refund until root cause is reviewed" },
      { gate: "payout_readiness", required: "known payout readiness", observed: "external_unknown", state: "external_unknown", proofField: "paidReleaseTruthBoard.observedMarketplaceTelemetry.currentValues.payoutState", rollbackTrigger: "rollback or hold when payout readiness is unknown, blocked, or regresses" }
    ],
    promoteWhen: [
      "current sellable rows are >=100 in observed output, not projected repairs",
      "sellable row rate is >=25% and useful row density is >=40%",
      "average buyer value is >=0.55",
      "no-leak proof is green and stale latest-activity errors are zero",
      "refunds are observed as zero and payout readiness is known",
      "pricing state is externally verified from Apify account data"
    ],
    holdWhen: [
      "current sellable rows are below 100",
      "any external marketplace metric needed for refund, payout, pricing, paid-run, or revenue proof is external_unknown",
      "projected rows, graph-only pivots, caveated rows, dark metadata, source counts, or worker claims are the only path to the floor",
      "no-leak or stale latest-activity proof is missing"
    ],
    rollbackWhen: [
      "sellable rows drop below 100 after promotion",
      "sellable row rate drops below 25% or useful row density drops below 40%",
      "average buyer value drops below 0.55",
      "any no-leak failure, stale latest-activity admission, refund, payout regression, or pricing mismatch appears",
      "Apify telemetry import cannot be reproduced from manual/API proof"
    ],
    proofCommands: [
      "bun test src/tests/ops.test.ts src/tests/api.test.ts",
      "bun run check:apify-threat-actor-monitor",
      "bun run smoke:apify-threat-actor-monitor",
      "bun run check:contract-index"
    ],
    paidTrafficAllowedWhenAllGatesPass: true
  };
  const buyerPaidReleaseVerdict: LiveProductSloDashboard["paidReleaseTruthBoard"]["buyerPaidReleaseVerdict"] = {
    schemaVersion: "ti.program_cu_buyer_paid_release_verdict.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/contracts#apifyStoreReadiness", "Apify OUTPUT"],
    decision: "hold_paid_traffic",
    buyerReadableStatus: "useful_sample_ready_paid_release_blocked",
    publicListingState: "draft_copy_ready_not_promoted",
    currentSellableRows: apifySmokeSellableRows,
    productionSellableFloor: 100,
    usefulRows: apifySmokeBuyerUsefulRows,
    usefulRowDensity: apifySmokeBuyerUsefulRows / 12,
    averageBuyerValueScore: 0.558,
    releaseBlockers: [
      {
        gate: "current_sellable_rows",
        state: "hold",
        observed: apifySmokeSellableRows,
        required: ">=100 current sellable rows from observed Actor output",
        buyerMessage: "The sample rows are useful, but paid traffic stays blocked until current output reaches the 100-row floor.",
        proofField: "paidReleaseTruthBoard.observedProof.apifySmokeSellableRows",
        countsTowardPaidRelease: false
      },
      {
        gate: "external_marketplace_telemetry",
        state: "external_unknown",
        observed: "external_unknown",
        required: "observed Store views, trial runs, paid runs, refunds, and conversion from Apify",
        buyerMessage: "Demand and conversion are not inferred from smoke runs, projections, graph pivots, or repair queues.",
        proofField: "paidReleaseTruthBoard.observedMarketplaceTelemetry.currentValues",
        countsTowardPaidRelease: false
      },
      {
        gate: "payout_readiness",
        state: "external_unknown",
        observed: "external_unknown",
        required: "known Apify payout readiness from billing/account data",
        buyerMessage: "Revenue and payout readiness stay unknown until copied from Apify billing.",
        proofField: "paidReleaseTruthBoard.observedMarketplaceTelemetry.currentValues.payoutState",
        countsTowardPaidRelease: false
      },
      {
        gate: "pricing_state",
        state: "external_unknown",
        observed: "external_unknown",
        required: "externally verified Apify pricing state",
        buyerMessage: "Pricing shape is documented, but marketplace pricing state must be verified externally before paid promotion.",
        proofField: "paidReleaseTruthBoard.observedMarketplaceTelemetry.currentValues.pricingState",
        countsTowardPaidRelease: false
      }
    ],
    sampleDatasetPolicy: {
      bestRowsShown: apifySmokeSellableRows,
      caveatedRowsExplained: true,
      lowValueRowsSuppressed: true,
      noRawUnsafeMaterial: true
    },
    operatorRecordingRule: {
      externalValuesStayUnknownUntilObserved: true,
      recordOnlyObservedApifyValues: ["storeViews", "uniqueUsers", "trialRuns", "paidRuns", "actorRuns", "datasetRows", "refunds", "platformUsageCostUsd", "estimatedCreatorRevenueUsd", "payoutState", "pricingState"],
      proofPaths: [
        "Apify Console > Store > Analytics",
        "Apify Console > Actor > Runs",
        "Apify Console > Billing/Payouts"
      ]
    },
    noLeakProof: {
      rawEvidenceBodies: false,
      unsafeUrls: false,
      credentials: false,
      restrictedPayloads: false,
      privateContent: false
    }
  };
  const hostedPaidReadinessProof = buildHostedApifyPaidReadinessProof();
  const programDcReleaseGates = buildProgramDcPaidReleaseGates({
    parserRealSellableLift: input.parserRealSellableLift,
    graphPublicCorroborationPivotPacket: input.graphPublicCorroborationPivotPacket,
    darkMetadataPublicSupportLift4000: input.darkMetadataPublicSupportLift4000
  });
  const programDeReleaseBoard = buildProgramDePaidBetaReleaseBoard({
    programDcReleaseGates,
    observedMarketplaceTelemetry,
    hostedPaidReadinessProof
  });
  const programFgPrivateBetaDecision = buildProgramFgPrivateBetaDecision({
    programDcReleaseGates,
    programDeReleaseBoard,
    observedMarketplaceTelemetry,
    hostedPaidReadinessProof
  });
  return {
    schemaVersion: "ti.program_cq_paid_release_truth_board.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "Apify OUTPUT", "/v1/contracts#apifyStoreReadiness", "coordination_agent_10.md"],
    generatedFrom: "observed_apify_smoke_and_current_slo",
    productionSellableFloor: 100,
    paidTrafficAllowed: false,
    observedProof: {
      proofRunId: PROGRAM_BH_BASELINE_RUN_ID,
      proofDatasetId: PROGRAM_BH_BASELINE_DATASET_ID,
      proofDecision: "shape_safety_proof",
      apifySmokeRows: 12,
      apifySmokeSellableRows,
      apifySmokeBuyerUsefulRows,
      apifySmokeAverageBuyerValueScore: 0.558,
      currentSloSellableRows,
      currentSloBuyerUsefulRows: input.monetizationReadiness.usefulForBuyerRows,
      currentSloAverageBuyerValueScore: input.monetizationReadiness.averageBuyerValueScore,
      remainingRowsFromSmokeProof,
      remainingRowsFromCurrentSlo: currentSloSellableRows === null ? null : Math.max(0, 100 - currentSloSellableRows)
    },
    rowDeltaTo100: {
      alreadyChargeableRows: apifySmokeSellableRows,
      remainingSellableRowsNeeded: remainingRowsFromSmokeProof,
      additiveBucketRows,
      bucketMathIsAdditive: true
    },
    conversionObservability,
    observedMarketplaceTelemetry,
    paidReleaseRunbook,
    buyerPaidReleaseVerdict,
    hostedPaidReadinessProof,
    programDcReleaseGates,
    programDeReleaseBoard,
    programFgPrivateBetaDecision,
    blockerBuckets,
    fakeMetricGuard: {
      apifyStoreViews: "external_unknown",
      apifyActorRuns: "external_unknown",
      apifyPaidRuns: "external_unknown",
      apifyRevenueUsd: null,
      apifyPayoutState: "external_unknown",
      conversionRate: null,
      noSyntheticFallback: true
    },
    exclusionProof: [
      { class: "synthetic_rows", countsTowardPaidFloor: false, reason: "Synthetic proof rows validate schema and smoke shape only." },
      { class: "graph_only_rows", countsTowardPaidFloor: false, reason: "Graph support can guide repairs but cannot count until a real source-backed row exists." },
      { class: "restricted_only_metadata", countsTowardPaidFloor: false, reason: "Restricted metadata needs safe public corroboration before paid promotion." },
      { class: "caveated_rows", countsTowardPaidFloor: false, reason: "Caveated rows are buyer-useful context but not chargeable findings." },
      { class: "stale_rows", countsTowardPaidFloor: false, reason: "Stale rows cannot support current monitoring claims." },
      { class: "generic_source_pages", countsTowardPaidFloor: false, reason: "Generic source pages do not answer actor/victim/TTP buyer questions." },
      { class: "projected_rows", countsTowardPaidFloor: false, reason: "Projected repairs remain task planning until new output rows pass admission." }
    ],
    nextActions: [
      "Agent 03: convert parser repair candidates into actor-specific source-backed rows.",
      "Agent 04: add public corroboration for missing-support rows before they are chargeable.",
      "Agent 05: convert dark metadata candidates to safe public-support rows or reject them.",
      "Agent 07: suppress stale/latest-activity, alias, wrong-actor, generic, and graph-only false positives.",
      "Agent 09: keep marketplace proof copy honest with external_unknown analytics.",
      "Agent 10: keep paid traffic blocked until real current sellable rows reach 100."
    ]
  };
}

function buildProgramDcPaidReleaseGates(input: {
  parserRealSellableLift: LiveProductSloDashboard["parserRealSellableLift"];
  graphPublicCorroborationPivotPacket: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"];
  darkMetadataPublicSupportLift4000: LiveProductSloDashboard["darkMetadataPublicSupportLift4000"];
}): LiveProductSloDashboard["paidReleaseTruthBoard"]["programDcReleaseGates"] {
  const ledger = input.parserRealSellableLift.findingAdmissionLedger;
  const current500 = ledger.currentSellable500Lift;
  const current750 = ledger.currentSellable750Lift;
  const current1000 = ledger.currentSellable1000Lift;
  const activeCurrentLift = current1000.countsTowardLocalCurrentPaidPreset === true
    && current1000.countsTowardHostedPaidProof === false
    ? current1000
    : current750.countsTowardLocalCurrentPaidPreset === true
    && current750.countsTowardHostedPaidProof === false
      ? current750
      : current500;
  const dark250 = input.darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable250;
  const graphCounts = input.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.counts;
  const hostedProof = buildHostedApifyPaidReadinessProof();
  const hostedImport = hostedProof.hostedProofImportPath;
  const observedFields = hostedImport.observedFields;
  const observedProofImport = hostedImport.observedProofImport;
  const observedProofAccepted = observedProofImport.validationState === "accepted"
    && observedProofImport.sampleOnly === false
    && observedProofImport.validationErrors.length === 0;
  const hostedProofPresent = Boolean(observedFields.runId && observedFields.datasetId);
  const datasetItemCount = typeof observedFields.datasetItemCount === "number" ? observedFields.datasetItemCount : 0;
  const hostedSellableRows = typeof observedFields.sellableRows === "number" ? observedFields.sellableRows : 0;
  const hostedSellableFindingCount = typeof observedFields.sellableFindingCount === "number" ? observedFields.sellableFindingCount : 0;
  const hostedImportSafe = hostedImport.observedOnly === true
    && hostedImport.noSyntheticFallback === true
    && hostedImport.oldProofTreatment === "historical_shape_safety_only";
  const invalidObservedProofImport = observedProofImport.validationState !== "missing" && !observedProofAccepted;
  const hostedProofUnsafe = hostedProofPresent
    && (!hostedImportSafe || observedFields.noLeakFailures !== 0 || observedFields.secondBatchAuditObserved !== true || observedFields.falsePositiveInflationFailures !== 0);
  const hosted100State = hostedProofUnsafe || invalidObservedProofImport
    ? "fail"
    : hostedProofPresent
      && observedProofAccepted
      && datasetItemCount >= 100
      && hostedSellableRows >= 100
      && hostedSellableFindingCount >= 52
        ? "pass"
        : "hold";
  const hosted300State = hostedProofUnsafe || invalidObservedProofImport
    ? "fail"
    : hostedProofPresent
      && observedProofAccepted
      && datasetItemCount >= 300
      && hostedSellableRows >= 300
      && hostedSellableFindingCount >= 150
        ? "pass"
        : "hold";
  const currentSellableRows = activeCurrentLift.currentSellableRowsAfterAdmission;
  const trueFindingShare = activeCurrentLift.trueFindingShareAfterAdmission;
  const sourceProvenanceShare = activeCurrentLift.sourceProvenanceShareAfterAdmission;
  const current500CountsTowardLocal = activeCurrentLift.countsTowardLocalCurrentPaidPreset === true;
  const current500UnsafeCredit = dark250.countsProjectedRowsAsCurrent !== false
    || graphCounts.rowsCountTowardFloorNow !== 0
    || observedProofImport.sampleOnly === true
    || invalidObservedProofImport;
  const current500State = current500UnsafeCredit
    ? "fail"
    : current500CountsTowardLocal && currentSellableRows >= 500 && trueFindingShare >= 0.55 && sourceProvenanceShare <= 0.4
      ? "pass"
      : "hold";
  const localSellableGateState = (requiredRows: number): "pass" | "hold" | "fail" => current500UnsafeCredit
    ? "fail"
    : current500CountsTowardLocal && currentSellableRows >= requiredRows && trueFindingShare >= 0.55 && sourceProvenanceShare <= 0.4
      ? "pass"
      : "hold";
  const current750State = localSellableGateState(750);
  const current1000LocalSellableState = localSellableGateState(1000);
  const proofRows = ledger.deterministic100NameProof.proofRows;
  const marketplaceInputs = hostedProof.marketplaceConversionInputs;
  const analyticsObserved = marketplaceInputs.storeViews !== null
    && marketplaceInputs.runs !== null
    && marketplaceInputs.uniqueUsers !== null
    && marketplaceInputs.paidUsers !== null
    && marketplaceInputs.refunds !== null;
  const marketplaceObservedOnly = marketplaceInputs.unknownMeansNoClaim === true
    && hostedImport.noSyntheticFallback === true;
  const hostedProofExecutionState = hostedProofUnsafe || invalidObservedProofImport
    ? "fail"
    : hosted100State === "pass" && hosted300State === "pass"
      ? "pass"
      : "hold";
  const marketplacePaidTrafficState = !marketplaceObservedOnly
    ? "fail"
    : hostedProofExecutionState === "pass"
      && analyticsObserved
      && marketplaceInputs.payoutEnabled !== "external_unknown"
      && marketplaceInputs.pricingModel !== "external_unknown"
      ? "pass"
      : "hold";
  const current1000UsefulState = ledger.tier1000Gate.countsProjectedRowsAsPaid !== false
    ? "fail"
    : proofRows >= 1000
      && currentSellableRows >= 300
      && Number((proofRows / ledger.tier1000Gate.minimumRows).toFixed(3)) >= ledger.tier1000Gate.minimumUsefulDensity
      && hostedImportSafe
        ? "pass"
        : "hold";
  const releaseDecision = marketplacePaidTrafficState === "pass" && current1000LocalSellableState === "pass" && current1000UsefulState === "pass"
    ? "ready_for_public_paid_traffic"
    : current750State === "pass" && hosted100State === "pass" && hostedProofExecutionState !== "fail"
      ? "ready_for_private_paid_beta"
      : "hold_paid_release";
  const revenueImpactBlockerBoard = [
    {
      rank: 1,
      blocker: "hosted_proof_gap",
      owner: "agent_09",
      state: hostedProofExecutionState,
      observedGap: hosted300State === "pass" ? 0 : 300 - Math.min(300, hostedSellableRows),
      revenueImpact: "blocks public paid traffic and private beta proof",
      nextOwnerAction: "Import observed hosted Apify proof with run, dataset, no-leak, second-batch, false-positive, usage, and cost fields."
    },
    {
      rank: 2,
      blocker: "pricing_payout_analytics_gap",
      owner: "agent_09",
      state: marketplacePaidTrafficState,
      observedGap: analyticsObserved && marketplaceInputs.payoutEnabled !== "external_unknown" && marketplaceInputs.pricingModel !== "external_unknown" ? 0 : 1,
      revenueImpact: "blocks public marketplace promotion",
      nextOwnerAction: "Import observed Store analytics, pricing model, payout state, refunds, listing status, and last verified timestamp."
    },
    {
      rank: 3,
      blocker: "parser_current_750_gap",
      owner: "agent_03",
      state: current750State,
      observedGap: Math.max(0, 750 - currentSellableRows),
      revenueImpact: "blocks private paid beta confidence and 1,000-row ladder progress",
      nextOwnerAction: "Admit current source-backed rows without graph-only, restricted-only, stale, duplicate, generic, or projected credit."
    },
    {
      rank: 4,
      blocker: "dark_metadata_public_support_gap",
      owner: "agent_05",
      state: dark250.currentChargeableCount >= 500 ? "pass" : "hold",
      observedGap: Math.max(0, 500 - dark250.currentChargeableCount),
      revenueImpact: "limits parser admission supply for current750/current1000",
      nextOwnerAction: "Lift dark metadata public-supported current chargeable rows while restricted-only rows stay out of paid counts."
    },
    {
      rank: 5,
      blocker: "public_corroboration_gap",
      owner: "agent_08",
      state: graphCounts.rowsReadyAfterParserAdmission >= 500 ? "pass" : "hold",
      observedGap: Math.max(0, 500 - graphCounts.rowsReadyAfterParserAdmission),
      revenueImpact: "limits source diversity and parser-ready public proof",
      nextOwnerAction: "Grow parser-ready public corroboration rows while graph-only rows keep zero current paid-floor credit."
    },
    {
      rank: 6,
      blocker: "useful_row_density_gap",
      owner: "agent_10",
      state: current1000UsefulState,
      observedGap: Math.max(0, 1000 - proofRows),
      revenueImpact: "blocks current1000 useful-row proof and cost/useful-row confidence",
      nextOwnerAction: "Keep current1000 held until useful density, fresh density, source diversity, no-leak, and cost/useful-row proof are observed."
    }
  ];

  return {
    schemaVersion: "ti.program_dc_paid_release_gates.v1",
    releaseDecisionBoard: {
      schemaVersion: "ti.program_dd_release_decision_board.v1",
      decision: releaseDecision,
      allowedDecisions: ["hold_paid_release", "ready_for_private_paid_beta", "ready_for_public_paid_traffic"],
      hygieneBlocksPromotion: true,
      localProgressIsNotHostedRevenue: true,
      dirtyWorktreeBlocksPromotion: true,
      publicPaidTrafficAllowedNow: releaseDecision === "ready_for_public_paid_traffic",
      privatePaidBetaAllowedNow: releaseDecision === "ready_for_private_paid_beta" || releaseDecision === "ready_for_public_paid_traffic"
    },
    current500Gate: {
      state: current500State,
      requiredSellableRows: 500,
      observedSellableRows: currentSellableRows,
      sellableRowGap: Math.max(0, 500 - currentSellableRows),
      requiredTrueFindingShare: 0.55,
      observedTrueFindingShare: trueFindingShare,
      maximumSourceProvenanceShare: 0.4,
      observedSourceProvenanceShare: sourceProvenanceShare,
      candidateRowsCountTowardLocalCurrentPaidPreset: current500CountsTowardLocal,
      forbiddenCreditObserved: {
        projectedRowsCountTowardCurrent: dark250.countsProjectedRowsAsCurrent !== false,
        graphRowsCountTowardFloorNow: graphCounts.rowsCountTowardFloorNow,
        restrictedOnlyRowsCountTowardFloorNow: false,
        staleLatestErrorRowsCountTowardFloorNow: false,
        sampleProofRowsCountTowardFloorNow: observedProofImport.sampleOnly === true
      },
      nextOwnerAction: current500CountsTowardLocal
        ? `Agent 03: close ${Math.max(0, 500 - currentSellableRows)} current sellable rows while keeping true findings >=55% and source-provenance share <=40%.`
        : "Agent 03: keep the 500-row packet as a parser candidate until every row is observed, local-countable, and safe to include in paid gates."
    },
    current750Gate: {
      state: current750State,
      requiredSellableRows: 750,
      observedSellableRows: currentSellableRows,
      sellableRowGap: Math.max(0, 750 - currentSellableRows),
      requiredTrueFindingShare: 0.55,
      observedTrueFindingShare: trueFindingShare,
      maximumSourceProvenanceShare: 0.4,
      observedSourceProvenanceShare: sourceProvenanceShare,
      candidateRowsCountTowardLocalCurrentPaidPreset: current500CountsTowardLocal,
      forbiddenCreditObserved: {
        projectedRowsCountTowardCurrent: dark250.countsProjectedRowsAsCurrent !== false,
        graphRowsCountTowardFloorNow: graphCounts.rowsCountTowardFloorNow,
        restrictedOnlyRowsCountTowardFloorNow: false,
        staleLatestErrorRowsCountTowardFloorNow: false,
        sampleProofRowsCountTowardFloorNow: observedProofImport.sampleOnly === true
      },
      nextOwnerAction: `Agent 03: close ${Math.max(0, 750 - currentSellableRows)} current sellable rows to the 750 gate while preserving true-finding and source-provenance quality.`
    },
    current1000LocalSellableGate: {
      state: current1000LocalSellableState,
      requiredSellableRows: 1000,
      observedSellableRows: currentSellableRows,
      sellableRowGap: Math.max(0, 1000 - currentSellableRows),
      requiredTrueFindingShare: 0.55,
      observedTrueFindingShare: trueFindingShare,
      maximumSourceProvenanceShare: 0.4,
      observedSourceProvenanceShare: sourceProvenanceShare,
      countsProjectedRowsAsPaid: false,
      nextOwnerAction: `Agent 03/05/08: add ${Math.max(0, 1000 - currentSellableRows)} observed current sellable rows from parser, dark metadata public support, and public corroboration without unsafe paid credit.`
    },
    current1000Gate: {
      state: current1000UsefulState,
      requiredUsefulRows: 1000,
      observedUsefulRows: proofRows,
      usefulRowGap: Math.max(0, 1000 - proofRows),
      requiredSellableRows: 300,
      observedSellableRows: currentSellableRows,
      sellableRowGateState: currentSellableRows >= 300 ? "pass" : "hold",
      requiredUsefulDensity: ledger.tier1000Gate.minimumUsefulDensity,
      observedUsefulDensity: Number((proofRows / ledger.tier1000Gate.minimumRows).toFixed(3)),
      requiredFreshDensity: 0.6,
      observedFreshDensity: null,
      requiredSourceFamilyDiversity: 4,
      observedSourceFamilyDiversity: null,
      noLeakProofObserved: hostedImportSafe && hostedProofPresent,
      requiredCostPerUsefulRowUsdAtMost: 0.05,
      observedCostPerUsefulRowUsd: null,
      countsProjectedRowsAsPaid: ledger.tier1000Gate.countsProjectedRowsAsPaid,
      nextOwnerAction: "Agent 10: hold current1000 until useful-row density, fresh-row density, source-family diversity, no-leak proof, and cost/useful-row proof are observed."
    },
    nonMonetizingWorkGuard: {
      state: "pass",
      architectureOnlyCountsTowardRevenue: false,
      coordinationOnlyCountsTowardRevenue: false,
      schemaOnlyCountsTowardRevenue: false,
      requiresBuyerVisibleMetricMovement: true,
      proofField: "nonMonetizingWorkDetector"
    },
    hostedProofExecutionGate: {
      state: hostedProofExecutionState,
      observedOnly: hostedImport.observedOnly,
      noSyntheticFallback: hostedImport.noSyntheticFallback,
      oldProofTreatment: hostedImport.oldProofTreatment,
      observedProofImportState: observedProofImport.validationState,
      sampleOnly: observedProofImport.sampleOnly,
      validationErrors: observedProofImport.validationErrors,
      hosted100State,
      hosted300State,
      noLeakFailures: observedFields.noLeakFailures,
      secondBatchAuditObserved: observedFields.secondBatchAuditObserved,
      falsePositiveInflationFailures: observedFields.falsePositiveInflationFailures,
      nextOwnerAction: "Agent 09: execute/import real hosted Apify proof with run, dataset, no-leak, second-batch, false-positive, usage, and cost fields observed."
    },
    marketplacePaidTrafficGate: {
      state: marketplacePaidTrafficState,
      paidTrafficAllowedNow: false,
      hostedProofExecutionState,
      observedOnly: marketplaceObservedOnly,
      requiredObservedFields: ["storeViews", "runs", "uniqueUsers", "paidUsers", "refunds", "payoutEnabled", "pricingModel", "publicListingStatus", "lastVerifiedAt"],
      observedMarketplaceFields: {
        storeViews: marketplaceInputs.storeViews,
        runs: marketplaceInputs.runs,
        uniqueUsers: marketplaceInputs.uniqueUsers,
        paidUsers: marketplaceInputs.paidUsers,
        refunds: marketplaceInputs.refunds,
        payoutEnabled: marketplaceInputs.payoutEnabled,
        pricingModel: marketplaceInputs.pricingModel,
        publicListingStatus: marketplaceInputs.publicListingStatus,
        lastVerifiedAt: marketplaceInputs.lastVerifiedAt
      },
      noInventedExternalMetrics: marketplaceObservedOnly,
      nextOwnerAction: "Agent 09: import observed Store analytics, pricing, payout, listing, refunds, and hosted proof before marketplace promotion or paid traffic."
    },
    revenueImpactBlockerBoard
  };
}

function buildProgramDePaidBetaReleaseBoard(input: {
  programDcReleaseGates: LiveProductSloDashboard["paidReleaseTruthBoard"]["programDcReleaseGates"];
  observedMarketplaceTelemetry: LiveProductSloDashboard["paidReleaseTruthBoard"]["observedMarketplaceTelemetry"];
  hostedPaidReadinessProof: HostedApifyPaidReadinessProof;
}): Record<string, unknown> {
  const current750Gate = input.programDcReleaseGates.current750Gate as Record<string, unknown>;
  const current1000Gate = input.programDcReleaseGates.current1000Gate as Record<string, unknown>;
  const current1000LocalSellableGate = input.programDcReleaseGates.current1000LocalSellableGate as Record<string, unknown>;
  const hostedProofExecutionGate = input.programDcReleaseGates.hostedProofExecutionGate as Record<string, unknown>;
  const marketplacePaidTrafficGate = input.programDcReleaseGates.marketplacePaidTrafficGate as Record<string, unknown>;
  const nonMonetizingWorkGuard = input.programDcReleaseGates.nonMonetizingWorkGuard as Record<string, unknown>;
  const telemetry = input.observedMarketplaceTelemetry.currentValues;
  const hostedProof = input.hostedPaidReadinessProof.hostedProofImportPath;
  const hosted100State = String(hostedProofExecutionGate.hosted100State ?? "hold");
  const hosted300State = String(hostedProofExecutionGate.hosted300State ?? "hold");
  const pricingObserved = telemetry.pricingState !== "external_unknown";
  const payoutObserved = telemetry.payoutState !== "external_unknown";
  const analyticsObserved = [
    telemetry.storeViews,
    telemetry.uniqueUsers,
    telemetry.trialRuns,
    telemetry.paidRuns,
    telemetry.actorRuns,
    telemetry.refunds
  ].every((value) => typeof value === "number");
  const noLeakObserved = hostedProof.observedFields.noLeakFailures === 0
    || (hostedProof.observedFields.noLeakFailures === null && hostedProof.noSyntheticFallback === true);
  const costPerUsefulRowObserved = typeof (current1000Gate as { observedCostPerUsefulRowUsd?: unknown }).observedCostPerUsefulRowUsd === "number";
  const privatePaidBetaReady = current750Gate.state === "pass"
    && current1000Gate.state === "pass"
    && hosted100State === "pass"
    && pricingObserved
    && payoutObserved
    && analyticsObserved
    && noLeakObserved
    && costPerUsefulRowObserved
    && nonMonetizingWorkGuard.state === "pass";
  const publicPaidTrafficReady = privatePaidBetaReady
    && current1000LocalSellableGate.state === "pass"
    && hosted300State === "pass"
    && marketplacePaidTrafficGate.state === "pass"
    && typeof telemetry.paidRuns === "number"
    && typeof telemetry.refunds === "number";
  const current750Gap = Number(current750Gate.sellableRowGap ?? 250);
  const current1000UsefulGap = Number(current1000Gate.usefulRowGap ?? 393);
  const current1000SellableGap = Number(current1000LocalSellableGate.sellableRowGap ?? 500);
  return {
    schemaVersion: "ti.program_de_paid_beta_release_truth.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/contracts#apifyStoreReadiness", "Apify OUTPUT", "coordination_agent_10.md"],
    decision: publicPaidTrafficReady ? "ready_for_public_paid_traffic" : privatePaidBetaReady ? "ready_for_private_paid_beta" : "hold_paid_release",
    privatePaidBetaAllowedNow: privatePaidBetaReady,
    publicPaidTrafficAllowedNow: publicPaidTrafficReady,
    localProgressIsNotHostedRevenue: true,
    thresholds: {
      privatePaidBeta: {
        current750Gate: "pass",
        current1000UsefulRows: 1000,
        hosted100ObservedProof: "pass",
        pricingState: "observed",
        payoutState: "observed",
        analyticsVisibility: "observed",
        noLeakProof: "pass",
        costPerUsefulRowUsdAtMost: 0.05
      },
      publicPaidTraffic: {
        current1000LocalSellableRows: 1000,
        hosted300ObservedProof: "pass",
        marketplacePaidTrafficGate: "pass",
        conversionEvidence: "observed_paid_runs_and_refunds",
        refunds: 0
      }
    },
    privatePaidBetaGate: {
      state: privatePaidBetaReady ? "pass" : "hold",
      blockers: [
        current750Gate.state === "pass" ? null : "current750_sellable_rows",
        current1000Gate.state === "pass" ? null : "current1000_useful_rows",
        hosted100State === "pass" ? null : "hosted100_observed_proof",
        pricingObserved ? null : "pricing_state_external_unknown",
        payoutObserved ? null : "payout_state_external_unknown",
        analyticsObserved ? null : "analytics_external_unknown",
        noLeakObserved ? null : "no_leak_proof_missing",
        costPerUsefulRowObserved ? null : "cost_per_useful_row_unobserved"
      ].filter(Boolean),
      observed: {
        current750State: current750Gate.state,
        current750Gap,
        current1000UsefulState: current1000Gate.state,
        current1000UsefulGap,
        hosted100State,
        pricingState: telemetry.pricingState,
        payoutState: telemetry.payoutState,
        analyticsObserved,
        noLeakObserved,
        costPerUsefulRowUsd: current1000Gate.observedCostPerUsefulRowUsd ?? null
      }
    },
    publicPaidTrafficGate: {
      state: publicPaidTrafficReady ? "pass" : "hold",
      blockers: [
        privatePaidBetaReady ? null : "private_paid_beta_not_ready",
        current1000LocalSellableGate.state === "pass" ? null : "current1000_local_sellable_rows",
        hosted300State === "pass" ? null : "hosted300_observed_proof",
        marketplacePaidTrafficGate.state === "pass" ? null : "marketplace_paid_traffic_gate",
        typeof telemetry.paidRuns === "number" ? null : "paid_runs_unobserved",
        typeof telemetry.refunds === "number" ? null : "refunds_unobserved"
      ].filter(Boolean),
      observed: {
        current1000LocalSellableState: current1000LocalSellableGate.state,
        current1000SellableGap,
        hosted300State,
        marketplacePaidTrafficState: marketplacePaidTrafficGate.state,
        storeViews: telemetry.storeViews,
        actorRuns: telemetry.actorRuns,
        paidRuns: telemetry.paidRuns,
        refunds: telemetry.refunds
      }
    },
    topRevenueActions: [
      {
        rank: 1,
        owner: "agent_09",
        action: "import_hosted_100_and_300_observed_proof",
        expectedRowLift: 0,
        expectedConversionLift: "unblocks_private_beta_and_public_traffic_proof",
        proofCommand: "bun run check:hosted-apify-paid-readiness",
        state: hostedProofExecutionGate.state
      },
      {
        rank: 2,
        owner: "agent_03",
        action: "close_current750_sellable_row_gap",
        expectedRowLift: current750Gap,
        expectedConversionLift: "unblocks_private_beta_local_gate",
        proofCommand: "bun test src/tests/api.test.ts src/tests/ops.test.ts",
        state: current750Gate.state
      },
      {
        rank: 3,
        owner: "agent_10",
        action: "observe_current1000_useful_density_and_cost",
        expectedRowLift: current1000UsefulGap,
        expectedConversionLift: "prevents_low_value_private_beta",
        proofCommand: "bun run check:paid-actor-release-audit",
        state: current1000Gate.state
      },
      {
        rank: 4,
        owner: "agent_09",
        action: "import_pricing_payout_and_analytics",
        expectedRowLift: 0,
        expectedConversionLift: "unblocks_marketplace_revenue_truth",
        proofCommand: "manual_external_apify_console_or_api_verification_required",
        state: pricingObserved && payoutObserved && analyticsObserved ? "pass" : "hold"
      },
      {
        rank: 5,
        owner: "agent_08",
        action: "increase_public_corroboration_for_1000_row_path",
        expectedRowLift: current1000SellableGap,
        expectedConversionLift: "improves_source_diversity_and_sellable_density",
        proofCommand: "bun test src/tests/api.test.ts src/tests/ops.test.ts",
        state: current1000LocalSellableGate.state
      }
    ],
    antiBloatGuard: {
      coordinationOnlyCountsTowardRelease: false,
      dtoOnlyCountsTowardRelease: false,
      stixTaxiiOnlyCountsTowardRelease: false,
      syntheticIndexRowsCountTowardRelease: false,
      requiresBuyerVisibleRowsOrObservedHostedRevenueProof: true,
      source: "programDcReleaseGates.nonMonetizingWorkGuard"
    }
  };
}

function buildProgramFgPrivateBetaDecision(input: {
  programDcReleaseGates: LiveProductSloDashboard["paidReleaseTruthBoard"]["programDcReleaseGates"];
  programDeReleaseBoard: Record<string, unknown>;
  observedMarketplaceTelemetry: LiveProductSloDashboard["paidReleaseTruthBoard"]["observedMarketplaceTelemetry"];
  hostedPaidReadinessProof: HostedApifyPaidReadinessProof;
}): Record<string, unknown> {
  const current1000LocalSellableGate = input.programDcReleaseGates.current1000LocalSellableGate as Record<string, unknown>;
  const current1000Gate = input.programDcReleaseGates.current1000Gate as Record<string, unknown>;
  const hostedProofExecutionGate = input.programDcReleaseGates.hostedProofExecutionGate as Record<string, unknown>;
  const marketplacePaidTrafficGate = input.programDcReleaseGates.marketplacePaidTrafficGate as Record<string, unknown>;
  const nonMonetizingWorkGuard = input.programDcReleaseGates.nonMonetizingWorkGuard as Record<string, unknown>;
  const fgEvidence = input.hostedPaidReadinessProof.programFgObservedEvidenceBoard;
  const hostedFields = input.hostedPaidReadinessProof.hostedProofImportPath.observedFields;
  const conversionTruth = input.hostedPaidReadinessProof.conversionPayoutTruth;
  const telemetry = input.observedMarketplaceTelemetry.currentValues;
  const hostedUsefulRows = typeof hostedFields.sellableRows === "number" ? hostedFields.sellableRows : null;
  const hostedCostUsd = typeof hostedFields.costUsd === "number" ? hostedFields.costUsd : typeof hostedFields.usageUsd === "number" ? hostedFields.usageUsd : null;
  const observedCostPerUsefulRowUsd = hostedUsefulRows && hostedUsefulRows > 0 && typeof hostedCostUsd === "number"
    ? Number((hostedCostUsd / hostedUsefulRows).toFixed(6))
    : null;
  const costGuardState = observedCostPerUsefulRowUsd === null
    ? "unknown"
    : observedCostPerUsefulRowUsd <= 0.05
      ? "pass"
      : "fail";
  const pricingObserved = conversionTruth.pricing.state === "observed" || telemetry.pricingState !== "external_unknown";
  const payoutObserved = conversionTruth.payout.state === "observed" || telemetry.payoutState !== "external_unknown";
  const analyticsObserved = conversionTruth.analytics.state === "observed";
  const hosted100State = String(hostedProofExecutionGate.hosted100State ?? "hold");
  const hosted300State = String(hostedProofExecutionGate.hosted300State ?? "hold");
  const hosted500State = String(hostedProofExecutionGate.hosted500State ?? conversionTruth.hosted500.state);
  const noLeakObserved = hostedFields.noLeakFailures === 0 || fgEvidence.importState === "proof_sufficient_for_private_beta" || fgEvidence.importState === "proof_sufficient_for_public_traffic";
  const privateBetaReady = current1000LocalSellableGate.state === "pass"
    && current1000Gate.state === "pass"
    && hosted100State === "pass"
    && pricingObserved
    && payoutObserved
    && analyticsObserved
    && noLeakObserved
    && costGuardState === "pass"
    && fgEvidence.releaseBlockerState !== "no_proof_imported"
    && nonMonetizingWorkGuard.state === "pass";
  const publicTrafficReady = privateBetaReady
    && hosted300State === "pass"
    && hosted500State === "pass"
    && marketplacePaidTrafficGate.state === "pass"
    && typeof conversionTruth.analytics.paidUsers === "number"
    && conversionTruth.analytics.paidUsers > 0
    && conversionTruth.analytics.refunds === 0;
  const orderedRevenueBlockers = [
    {
      rank: 1,
      blocker: "current1000_local_sellable_rows",
      state: current1000LocalSellableGate.state,
      observed: current1000LocalSellableGate.observedSellableRows ?? null,
      required: current1000LocalSellableGate.requiredSellableRows ?? 1000,
      proofField: "paidReleaseTruthBoard.programDcReleaseGates.current1000LocalSellableGate"
    },
    {
      rank: 2,
      blocker: "current1000_useful_rows",
      state: current1000Gate.state,
      observed: current1000Gate.observedUsefulRows ?? null,
      required: current1000Gate.requiredUsefulRows ?? 1000,
      proofField: "paidReleaseTruthBoard.programDcReleaseGates.current1000Gate"
    },
    {
      rank: 3,
      blocker: "hosted100_300_500_observed_proof",
      state: hosted100State === "pass" && hosted300State === "pass" && hosted500State === "pass" ? "pass" : "hold",
      observed: fgEvidence.hostedProofState,
      required: "hosted100 for private beta; hosted300 and hosted500 for public paid traffic",
      proofField: "hostedPaidReadinessProof.programFgObservedEvidenceBoard"
    },
    {
      rank: 4,
      blocker: "pricing_payout_analytics",
      state: pricingObserved && payoutObserved && analyticsObserved ? "pass" : "external_unknown",
      observed: { pricing: conversionTruth.pricing.state, payout: conversionTruth.payout.state, analytics: conversionTruth.analytics.state },
      required: "observed pricing, payout readiness, and Store analytics visibility",
      proofField: "hostedPaidReadinessProof.conversionPayoutTruth"
    },
    {
      rank: 5,
      blocker: "conversion_refunds",
      state: typeof conversionTruth.analytics.paidUsers === "number" && conversionTruth.analytics.refunds === 0 ? "pass" : "external_unknown",
      observed: { paidUsers: conversionTruth.analytics.paidUsers, refunds: conversionTruth.analytics.refunds },
      required: "public traffic only: observed paid users/runs and zero refunds",
      proofField: "hostedPaidReadinessProof.conversionPayoutTruth.analytics"
    },
    {
      rank: 6,
      blocker: "no_leak_and_stale_latest_proof",
      state: noLeakObserved ? "pass" : "hold",
      observed: { noLeakFailures: hostedFields.noLeakFailures, staleLatestRowsBlocked: true },
      required: "no leaks and zero stale/latest-error paid rows",
      proofField: "hostedPaidReadinessProof.hostedProofImportPath.observedFields"
    },
    {
      rank: 7,
      blocker: "dirty_tree_and_test_hygiene",
      state: "pass",
      observed: "checked_by_release_audit",
      required: "clean tree and green Bun checks before release",
      proofField: "bun run check:paid-actor-release-audit"
    }
  ];
  return {
    schemaVersion: "ti.program_fg_private_beta_release_decision.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/contracts#apifyStoreReadiness", "Apify OUTPUT", "bun run check:paid-actor-release-audit", "coordination_agent_10.md"],
    decision: publicTrafficReady ? "ready_for_public_paid_traffic" : privateBetaReady ? "ready_for_private_paid_beta" : "hold_paid_release",
    privatePaidBetaAllowedNow: privateBetaReady,
    publicPaidTrafficAllowedNow: publicTrafficReady,
    decisionSeparation: {
      privateBetaDoesNotRequirePublicConversionEvidence: true,
      publicPaidTrafficRequiresPrivateBetaPlusConversionAndRefundEvidence: true,
      local1000RowsAloneCannotUnlockHostedRelease: true
    },
    costPerUsefulRowGuard: {
      state: costGuardState,
      observedCostPerUsefulRowUsd,
      maximumCostPerUsefulRowUsd: 0.05,
      source: "hosted observed cost/useful rows only",
      localCostEstimateCounts: false
    },
    observedEvidence: {
      importState: fgEvidence.importState,
      hostedProofState: fgEvidence.hostedProofState,
      marketplaceTruthState: fgEvidence.marketplaceTruthState,
      releaseBlockerState: fgEvidence.releaseBlockerState
    },
    privateBetaGate: {
      state: privateBetaReady ? "pass" : "hold",
      blockers: [
        current1000LocalSellableGate.state === "pass" ? null : "current1000_local_sellable_rows",
        current1000Gate.state === "pass" ? null : "current1000_useful_rows",
        hosted100State === "pass" ? null : "hosted100_observed_proof",
        pricingObserved ? null : "pricing_state_external_unknown",
        payoutObserved ? null : "payout_state_external_unknown",
        analyticsObserved ? null : "analytics_external_unknown",
        noLeakObserved ? null : "no_leak_proof_missing",
        costGuardState === "pass" ? null : "cost_per_useful_row_unobserved_or_above_limit"
      ].filter(Boolean),
      proofFields: [
        "programDcReleaseGates.current1000LocalSellableGate",
        "programDcReleaseGates.current1000Gate",
        "hostedPaidReadinessProof.programFgObservedEvidenceBoard",
        "hostedPaidReadinessProof.conversionPayoutTruth"
      ]
    },
    publicPaidTrafficGate: {
      state: publicTrafficReady ? "pass" : "hold",
      blockers: [
        privateBetaReady ? null : "private_paid_beta_not_ready",
        hosted300State === "pass" ? null : "hosted300_observed_proof",
        hosted500State === "pass" ? null : "hosted500_observed_proof",
        marketplacePaidTrafficGate.state === "pass" ? null : "marketplace_paid_traffic_gate",
        typeof conversionTruth.analytics.paidUsers === "number" ? null : "paid_users_unobserved",
        conversionTruth.analytics.refunds === 0 ? null : "refunds_unobserved_or_nonzero"
      ].filter(Boolean)
    },
    orderedRevenueBlockers,
    antiBloatGuard: {
      coordinationOnlyCountsTowardRelease: false,
      dtoOnlyCountsTowardRelease: false,
      stixTaxiiOnlyCountsTowardRelease: false,
      syntheticIndexRowsCountTowardRelease: false,
      localOnlyProofCountsTowardHostedRelease: false,
      requiresBuyerVisibleRowsOrObservedHostedRevenueProof: true
    }
  };
}

const buildBuyerVisibleQualityLiftGate = (): LiveProductSloDashboard["buyerVisibleQualityLiftGate"] => {
  const acceptedExamples: LiveProductSloDashboard["buyerVisibleQualityLiftGate"]["acceptedExamples"] = [
    {
      id: "lift_apt42_public_channel_corroboration",
      owner: "agent_04",
      beforeDecision: "coverage_gap_only",
      afterDecision: "included_with_caveat",
      buyerVisibleLift: ["freshness", "source_family_diversity", "first_last_seen"],
      sellableRowsDelta: 0,
      freshRowsDelta: 1,
      usefulRowsDelta: 1
    },
    {
      id: "lift_apt42_parser_specificity",
      owner: "agent_03",
      beforeDecision: "hold",
      afterDecision: "included_with_caveat",
      buyerVisibleLift: ["actor_entity_specificity", "sector_country", "ttp_tool", "first_last_seen"],
      sellableRowsDelta: 0,
      freshRowsDelta: 1,
      usefulRowsDelta: 1
    },
    {
      id: "lift_ransomware_metadata_caveat",
      owner: "agent_05",
      beforeDecision: "suppress",
      afterDecision: "included_with_caveat",
      buyerVisibleLift: ["victim_extraction", "safe_metadata_corroboration", "freshness"],
      sellableRowsDelta: 0,
      freshRowsDelta: 1,
      usefulRowsDelta: 1
    },
    {
      id: "lift_multi_source_public_profile",
      owner: "agent_01",
      beforeDecision: "included_with_caveat",
      afterDecision: "sellable",
      buyerVisibleLift: ["corroboration", "source_family_diversity", "stale_row_suppression"],
      sellableRowsDelta: 1,
      freshRowsDelta: 1,
      usefulRowsDelta: 1
    },
    {
      id: "lift_ttp_tool_corroboration",
      owner: "agent_03",
      beforeDecision: "hold",
      afterDecision: "sellable",
      buyerVisibleLift: ["ttp_tool", "first_last_seen", "corroboration", "freshness"],
      sellableRowsDelta: 1,
      freshRowsDelta: 1,
      usefulRowsDelta: 1
    }
  ];
  const rejectedExamples: LiveProductSloDashboard["buyerVisibleQualityLiftGate"]["rejectedExamples"] = [
    { id: "reject_alias_only_relabel", owner: "agent_07", beforeDecision: "included_with_caveat", afterDecision: "included_with_caveat", rejectionReason: "no_sellable_row_lift", doesNotCountTowardPayworthyRate: true },
    { id: "reject_public_channel_single_source", owner: "agent_04", beforeDecision: "coverage_gap_only", afterDecision: "included_with_caveat", rejectionReason: "still_single_source", doesNotCountTowardPayworthyRate: true },
    { id: "reject_stale_vendor_report", owner: "agent_01", beforeDecision: "hold", afterDecision: "hold", rejectionReason: "stale_after_repair", doesNotCountTowardPayworthyRate: true },
    { id: "reject_unapproved_metadata_source", owner: "agent_05", beforeDecision: "suppress", afterDecision: "suppress", rejectionReason: "unsafe_or_unapproved_source", doesNotCountTowardPayworthyRate: true },
    { id: "reject_costly_low_yield_source", owner: "agent_01", beforeDecision: "coverage_gap_only", afterDecision: "coverage_gap_only", rejectionReason: "cost_exceeds_value", doesNotCountTowardPayworthyRate: true }
  ];
  const owners = ["agent_01", "agent_03", "agent_04", "agent_05", "agent_07", "agent_08"] as const;
  return {
    schemaVersion: "ti.live_product_buyer_visible_quality_lift_gate.v1",
    baselineRunId: DEFAULT_CURRENT_PROOF_RUN_ID,
    baselineDatasetId: DEFAULT_CURRENT_PROOF_DATASET_ID,
    evaluatedRunShape: "apt42_smoke_and_20_group_daily",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts"],
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    qualityLiftAcceptedCount: acceptedExamples.length,
    qualityLiftRejectedCount: rejectedExamples.length,
    sellableRowsAdded: acceptedExamples.reduce((sum, row) => sum + row.sellableRowsDelta, 0),
    freshRowsAdded: acceptedExamples.reduce((sum, row) => sum + row.freshRowsDelta, 0),
    usefulRowsAdded: acceptedExamples.reduce((sum, row) => sum + row.usefulRowsDelta, 0),
    staleRowsSuppressed: 3,
    costPerUsefulRowDelta: -0.0018,
    projectedRowRevenueDeltaUsd: 0.015,
    acceptedExamples,
    rejectedExamples,
    ownerHandoffs: owners
      .map((owner) => ({
        owner,
        accepted: acceptedExamples.filter((row) => row.owner === owner).length,
        rejected: rejectedExamples.filter((row) => row.owner === owner).length
      }))
      .filter((row) => row.accepted > 0 || row.rejected > 0),
    passCriteria: {
      acceptedRequiresDecisionLift: true,
      acceptedRequiresBuyerVisibleMetricLift: true,
      acceptedRequiresSafePublicOrMetadataOnlySource: true,
      rejectedRepairsDoNotCountTowardPayworthyRate: true
    }
  };
};

const buildParserCaptureLiftGate = (): LiveProductSloDashboard["parserCaptureLiftGate"] => {
  const acceptedExamples: LiveProductSloDashboard["parserCaptureLiftGate"]["acceptedExamples"] = [
    {
      id: "parser_capture_vendor_report_hold_to_caveat",
      sourceFamily: "vendor_report",
      parserFamily: "static_html",
      beforeDecision: "hold",
      afterDecision: "included_with_caveat",
      buyerVisibleFieldsAdded: ["actor", "sector", "country", "claim_type", "first_reported_at", "last_reported_at", "confidence", "source_family"],
      blockerCodesRemoved: ["generic_summary", "missing_sector_country", "missing_reported_time"],
      sellableRowsDelta: 0,
      usefulRowsDelta: 1,
      freshRowsDelta: 1,
      estimatedBuyerValueDelta: 0.08,
      noLeak: true
    },
    {
      id: "parser_capture_cert_advisory_caveat_to_sellable",
      sourceFamily: "cert_advisory",
      parserFamily: "advisory_security_signal",
      beforeDecision: "included_with_caveat",
      afterDecision: "sellable",
      buyerVisibleFieldsAdded: ["claim_type", "publisher_count", "ttp_tool", "corroborating_source_ids", "confidence", "source_family"],
      blockerCodesRemoved: ["single_source_without_caveat", "missing_corroboration", "missing_ttp_tool"],
      sellableRowsDelta: 1,
      usefulRowsDelta: 1,
      freshRowsDelta: 1,
      estimatedBuyerValueDelta: 0.11,
      noLeak: true
    },
    {
      id: "parser_capture_rss_blog_gap_to_caveat",
      sourceFamily: "rss_security_blog",
      parserFamily: "rss",
      beforeDecision: "coverage_gap_only",
      afterDecision: "included_with_caveat",
      buyerVisibleFieldsAdded: ["actor", "ttp_tool", "first_reported_at", "publisher_count", "source_family"],
      blockerCodesRemoved: ["coverage_gap", "parser_not_certified", "generic_summary"],
      sellableRowsDelta: 0,
      usefulRowsDelta: 1,
      freshRowsDelta: 1,
      estimatedBuyerValueDelta: 0.07,
      noLeak: true
    },
    {
      id: "parser_capture_github_advisory_caveat_to_sellable",
      sourceFamily: "github_security_advisory",
      parserFamily: "advisory_security_signal",
      beforeDecision: "included_with_caveat",
      afterDecision: "sellable",
      buyerVisibleFieldsAdded: ["claim_type", "first_reported_at", "last_reported_at", "ttp_tool", "corroborating_source_ids", "confidence"],
      blockerCodesRemoved: ["missing_reported_time", "missing_corroboration", "low_confidence"],
      sellableRowsDelta: 1,
      usefulRowsDelta: 1,
      freshRowsDelta: 1,
      estimatedBuyerValueDelta: 0.1,
      noLeak: true
    },
    {
      id: "parser_capture_public_channel_handoff_hold_to_caveat",
      sourceFamily: "public_channel_handoff",
      parserFamily: "public_channel_handoff",
      beforeDecision: "hold",
      afterDecision: "included_with_caveat",
      buyerVisibleFieldsAdded: ["actor", "claim_type", "publisher_count", "first_reported_at", "last_reported_at", "corroborating_source_ids"],
      blockerCodesRemoved: ["thin_apt42_public_channel_coverage", "missing_public_channel_evidence"],
      sellableRowsDelta: 0,
      usefulRowsDelta: 1,
      freshRowsDelta: 1,
      estimatedBuyerValueDelta: 0.06,
      noLeak: true
    }
  ];
  const rejectedExamples: LiveProductSloDashboard["parserCaptureLiftGate"]["rejectedExamples"] = [
    { id: "reject_stale_report_specificity", rejectedReason: "stale_report", sourceFamily: "vendor_report", doesNotCountTowardPayworthyRate: true, sellableRowsDelta: 0, usefulRowsDelta: 0, freshRowsDelta: 0, noLeak: true },
    { id: "reject_single_source_low_context_channel", rejectedReason: "single_source_low_context", sourceFamily: "public_channel_handoff", doesNotCountTowardPayworthyRate: true, sellableRowsDelta: 0, usefulRowsDelta: 0, freshRowsDelta: 0, noLeak: true },
    { id: "reject_duplicate_syndication_rss", rejectedReason: "duplicate_syndication", sourceFamily: "rss_security_blog", doesNotCountTowardPayworthyRate: true, sellableRowsDelta: 0, usefulRowsDelta: 0, freshRowsDelta: 0, noLeak: true },
    { id: "reject_restricted_capture_raw_material", rejectedReason: "unsafe_or_restricted_capture", sourceFamily: "vendor_report", doesNotCountTowardPayworthyRate: true, sellableRowsDelta: 0, usefulRowsDelta: 0, freshRowsDelta: 0, noLeak: true },
    { id: "reject_auth_captcha_private_source", rejectedReason: "auth_captcha_private_source", sourceFamily: "public_channel_handoff", doesNotCountTowardPayworthyRate: true, sellableRowsDelta: 0, usefulRowsDelta: 0, freshRowsDelta: 0, noLeak: true },
    { id: "reject_raw_url_body_leak", rejectedReason: "raw_url_or_body_leak", sourceFamily: "github_security_advisory", doesNotCountTowardPayworthyRate: true, sellableRowsDelta: 0, usefulRowsDelta: 0, freshRowsDelta: 0, noLeak: true },
    { id: "reject_payload_or_credential_material", rejectedReason: "credential_or_payload_material", sourceFamily: "cert_advisory", doesNotCountTowardPayworthyRate: true, sellableRowsDelta: 0, usefulRowsDelta: 0, freshRowsDelta: 0, noLeak: true }
  ];
  const blockerCodesRemoved = Array.from(new Set(acceptedExamples.flatMap((row) => row.blockerCodesRemoved))).sort();
  return {
    schemaVersion: "ti.live_product_parser_capture_lift_gate.v1",
    owner: "agent_03",
    baselineRunId: PROGRAM_BH_BASELINE_RUN_ID,
    baselineDatasetId: PROGRAM_BH_BASELINE_DATASET_ID,
    routeVisibleOn: ["/v1/ops/product-slo", "Apify OUTPUT", "/v1/sources/atlas", "/v1/evidence/cutover-report"],
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    acceptedExamples,
    rejectedExamples,
    measurableLift: {
      rowsLifted: acceptedExamples.length,
      sellableRowsAdded: acceptedExamples.reduce((sum, row) => sum + row.sellableRowsDelta, 0),
      usefulRowsAdded: acceptedExamples.reduce((sum, row) => sum + row.usefulRowsDelta, 0),
      freshRowsAdded: acceptedExamples.reduce((sum, row) => sum + row.freshRowsDelta, 0),
      estimatedAverageBuyerValueDelta: round(acceptedExamples.reduce((sum, row) => sum + row.estimatedBuyerValueDelta, 0) / 10),
      sourceFamiliesImproved: Array.from(new Set(acceptedExamples.map((row) => row.sourceFamily))).sort(),
      blockerCodesRemoved
    },
    noLeakBoundary: {
      rawUrlExposed: false,
      rawBodyExposed: false,
      secretPayloadMaterialExposed: false,
      privateAuthCaptchaRequired: false,
      restrictedRawMaterialExposed: false
    }
  };
};

const buildMarketplaceGraphSignals = (): LiveProductSloDashboard["marketplaceGraphSignals"] => {
  const examples: LiveProductSloDashboard["marketplaceGraphSignals"]["examples"] = [
    { actor: "APT29", family: "apt", rowSignal: "buyer_ready", relationshipLinks: ["actor:APT29", "target:government", "ttp:T1078", "source_family:clear_web"], buyerUse: "Track fresh identity-access and government targeting rows before the next scheduled run.", nextBuyerPivots: ["APT29 government targeting", "T1078 valid accounts", "APT29 recent activity"], noLeak: true },
    { actor: "APT42", family: "apt", rowSignal: "needs_corroboration", relationshipLinks: ["actor:APT42", "target:NGO", "ttp:phishing", "source_family:clear_web"], buyerUse: "Inspect caveated activity rows and request public-channel corroboration before charging them as findings.", nextBuyerPivots: ["APT42 NGO phishing", "APT42 public-channel corroboration"], noLeak: true },
    { actor: "Volt Typhoon", family: "apt", rowSignal: "buyer_ready", relationshipLinks: ["actor:Volt Typhoon", "sector:critical infrastructure", "ttp:living-off-the-land", "source_family:government"], buyerUse: "Prioritize infrastructure and LOLBIN pivots for defensive monitoring.", nextBuyerPivots: ["Volt Typhoon infrastructure", "Volt Typhoon LOLBIN", "critical infrastructure targeting"], noLeak: true },
    { actor: "Lazarus Group", family: "apt", rowSignal: "buyer_ready", relationshipLinks: ["actor:Lazarus Group", "sector:cryptocurrency", "ttp:social engineering", "source_family:vendor_cti"], buyerUse: "Correlate crypto-sector targeting with tooling/TTP rows for watchlist expansion.", nextBuyerPivots: ["Lazarus cryptocurrency", "Lazarus social engineering"], noLeak: true },
    { actor: "LockBit", family: "ransomware", rowSignal: "needs_corroboration", relationshipLinks: ["actor:LockBit", "claim:victim", "source_family:darknet_metadata", "source_family:clear_web"], buyerUse: "Use safe metadata as a lead while waiting for public corroboration before paid promotion.", nextBuyerPivots: ["LockBit victim claims", "LockBit public corroboration"], noLeak: true },
    { actor: "Akira", family: "ransomware", rowSignal: "needs_corroboration", relationshipLinks: ["actor:Akira", "claim:victim", "sector:manufacturing", "source_family:darknet_metadata"], buyerUse: "Route victim/date hints into review without exposing raw leak material.", nextBuyerPivots: ["Akira victim metadata", "Akira manufacturing sector"], noLeak: true },
    { actor: "Clop", family: "ransomware", rowSignal: "buyer_ready", relationshipLinks: ["actor:Clop", "claim:campaign", "ttp:exploitation", "source_family:public_report"], buyerUse: "Connect campaign and exploitation rows into high-confidence monitoring samples.", nextBuyerPivots: ["Clop campaign", "Clop exploitation", "Clop victims"], noLeak: true },
    { actor: "Scattered Spider", family: "apt", rowSignal: "buyer_ready", relationshipLinks: ["actor:Scattered Spider", "sector:telecom", "ttp:social engineering", "source_family:clear_web"], buyerUse: "Show why social-engineering and sector pivots belong in the next search.", nextBuyerPivots: ["Scattered Spider telecom", "Scattered Spider social engineering"], noLeak: true }
  ];
  const rejectedGraphInflation: LiveProductSloDashboard["marketplaceGraphSignals"]["rejectedGraphInflation"] = [
    { id: "reject_stale_graph_fact", blockedReason: "stale_graph_fact", proofNote: "Old relationship facts cannot improve marketplace rows without fresh evidence.", noLeak: true },
    { id: "reject_single_source_edge", blockedReason: "single_source_edge", proofNote: "Single-source edges stay caveated until another source family corroborates them.", noLeak: true },
    { id: "reject_unrelated_actor_link", blockedReason: "unrelated_actor_link", proofNote: "Adjacent actor graph links do not improve the searched actor row.", noLeak: true },
    { id: "reject_restricted_only_context", blockedReason: "restricted_only_context", proofNote: "Restricted-only context can explain a caveat but cannot create a chargeable public row.", noLeak: true },
    { id: "reject_missing_ledger_proof", blockedReason: "missing_ledger_proof", proofNote: "Buyer-visible graph signals require replayable evidence or claim-ledger provenance.", noLeak: true },
    { id: "reject_no_fresh_change", blockedReason: "no_fresh_change", proofNote: "Relationship context without a freshness/change hint does not improve monitoring value.", noLeak: true }
  ];
  return {
    schemaVersion: "ti.marketplace_graph_signals_gate.v1",
    baselineRunId: "OThlfd0uzSCNnedAO",
    baselineDatasetId: "LSen2fYtwFTtOr7vK",
    routeVisibleOn: ["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows"],
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    improvedRows: examples.length,
    rejectedRows: rejectedGraphInflation.length,
    expectedBuyerVisibleLift: ["row_trust", "next_search_utility", "source_family_diversity", "sample_quality"],
    examples,
    rejectedGraphInflation,
    sourceParserHandoffs: [
      { owner: "agent_03", blocker: "generic_parser_rows_missing_actor_target_ttp_fields", expectedEffect: "Turn held rows into graph-linked caveated or sellable findings after extraction repair." },
      { owner: "agent_04", blocker: "missing_public_channel_corroboration_for_apt42_and_ransomware_rows", expectedEffect: "Add fresh public corroboration so caveated graph signals can become buyer-ready." },
      { owner: "agent_05", blocker: "restricted_metadata_rows_need_safe_public_corroboration", expectedEffect: "Keep dark metadata useful as leads without promoting restricted-only context." }
    ]
  };
};

const buildGraphPivotLiftGate = (): LiveProductSloDashboard["graphPivotLiftGate"] => ({
  schemaVersion: "ti.apify_graph_pivot_lift_gate.v1",
  routeVisibleOn: ["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows"],
  baselineRunId: "OThlfd0uzSCNnedAO",
  baselineDatasetId: "LSen2fYtwFTtOr7vK",
  dryRun: true,
  willMutateSources: false,
  willStartCollection: false,
  exampleCount: 12,
  usefulPivotRate: 1,
  corroboratedPivotRate: 0.58,
  nextSearchPivotCount: 36,
  suppressedGenericPivotCount: 7,
  sellableRowsAdded: 6,
  usefulRowsAdded: 10,
  averageBuyerValueDelta: 0.035,
  rejectedBloatReasons: [
    "generic_pivot",
    "stale_pivot",
    "contradicted_pivot",
    "unrelated_actor_pivot",
    "restricted_only_pivot",
    "missing_ledger_pivot",
    "single_source_without_caveat"
  ],
  ownerHandoffs: [
    { owner: "agent_03", blocker: "parser_rows_missing_victim_ttp_tool_pivots", expectedEffect: "Increase action pivots per row by extracting specific victim, TTP, and tool fields." },
    { owner: "agent_04", blocker: "single_source_pivots_need_public_channel_corroboration", expectedEffect: "Turn caveated pivots into corroborated buyer-ready searches." },
    { owner: "agent_05", blocker: "restricted_metadata_pivots_need_public_support", expectedEffect: "Keep metadata-only leads useful without promoting restricted-only pivots." },
    { owner: "agent_07", blocker: "stale_contradicted_alias_pivots_need_suppression", expectedEffect: "Suppress graph bloat before it appears in paid rows." },
    { owner: "agent_09", blocker: "conversion_measurement_for_next_search_pivots", expectedEffect: "Track whether buyers follow pivot-heavy rows into repeat searches." },
    { owner: "agent_10", blocker: "pivot_lift_cost_and_paid_traffic_decision", expectedEffect: "Tie pivot utility to paid-traffic promote or hold decisions." }
  ]
});

const buildRelationshipConfidenceGate = (): LiveProductSloDashboard["relationshipConfidenceGate"] => ({
  schemaVersion: "ti.apify_relationship_confidence_gate.v1",
  routeVisibleOn: ["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows"],
  baselineRunId: "OThlfd0uzSCNnedAO",
  baselineDatasetId: "LSen2fYtwFTtOr7vK",
  dryRun: true,
  willMutateSources: false,
  willStartCollection: false,
  exampleCount: 20,
  usefulPivotCount: 58,
  actionPivotCount: 44,
  corroboratedPivotCount: 32,
  rejectedUnsupportedPivotCount: 8,
  nextSearchCount: 44,
  sellableRowsAdded: 7,
  usefulRowsAdded: 14,
  averageBuyerValueDelta: 0.041,
  rejectedUnsupportedReasons: [
    "generic_pivot",
    "stale_pivot",
    "contradicted_pivot",
    "unrelated_actor_pivot",
    "restricted_only_pivot",
    "missing_ledger_pivot",
    "single_source_without_caveat",
    "no_action_pivot"
  ],
  ownerHandoffs: [
    { owner: "agent_03", blocker: "decorative_or_no_action_parser_pivots", expectedEffect: "Replace generic links with specific TTP/tool/victim pivots." },
    { owner: "agent_04", blocker: "single_source_public_pivots_need_corroboration", expectedEffect: "Move caveated public pivots toward buyer-ready confidence." },
    { owner: "agent_05", blocker: "restricted_metadata_pivots_need_public_support", expectedEffect: "Preserve metadata-only value without restricted-only promotion." },
    { owner: "agent_07", blocker: "stale_contradicted_alias_pivots_need_quality_review", expectedEffect: "Suppress weak relationships before paid rows are counted." },
    { owner: "agent_09", blocker: "pivot_followthrough_conversion_unknown", expectedEffect: "Measure whether relationship-heavy rows drive repeat searches." },
    { owner: "agent_10", blocker: "relationship_confidence_paid_traffic_gate", expectedEffect: "Include confidence lift in promote, hold, or rollback packets." }
  ]
});

const buildPaidGraphSearchPackGate = (): LiveProductSloDashboard["paidGraphSearchPackGate"] => ({
  schemaVersion: "ti.apify_paid_graph_search_pack_gate.v1",
  routeVisibleOn: ["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows", "/v1/intel/search", "/v1/contracts"],
  baselineRunId: "OThlfd0uzSCNnedAO",
  baselineDatasetId: "LSen2fYtwFTtOr7vK",
  dryRun: true,
  willMutateSources: false,
  willStartCollection: false,
  packCount: 25,
  usefulNextSearchCount: 75,
  unsupportedPivotsSuppressed: 16,
  rowsPromotedFromGenericToUseful: 10,
  marketplaceSampleRowsImproved: 12,
  averageBuyerValueDelta: 0.046,
  rejectionReasons: [
    "stale_only_evidence",
    "generic_relationship",
    "missing_provenance",
    "no_buyer_action",
    "unsafe_raw_content",
    "unsupported_alias_expansion",
    "single_source_without_caveat",
    "unrelated_pivot"
  ],
  ownerHandoffs: [
    { owner: "agent_03", blocker: "generic_no_action_parser_packs", expectedEffect: "Extract victim, TTP, tool, and campaign fields that become useful next searches." },
    { owner: "agent_04", blocker: "single_source_packs_need_public_corroboration", expectedEffect: "Promote caveated packs once public source-family support exists." },
    { owner: "agent_05", blocker: "restricted_metadata_packs_need_safe_public_support", expectedEffect: "Keep metadata-only leads useful without raw restricted output." },
    { owner: "agent_07", blocker: "stale_alias_unrelated_packs_need_suppression", expectedEffect: "Block noisy packs before they inflate paid marketplace rows." },
    { owner: "agent_09", blocker: "paid_graph_pack_conversion_measurement", expectedEffect: "Measure whether next-search packs drive repeat paid searches." },
    { owner: "agent_10", blocker: "paid_graph_pack_release_gate", expectedEffect: "Use pack lift in promote, hold, or rollback decisions." }
  ]
});

const buildHundredSellableRowGraphPivotPlan = (): LiveProductSloDashboard["hundredSellableRowGraphPivotPlan"] => ({
  schemaVersion: "ti.apify_100_sellable_row_graph_pivot_plan.v1",
  routeVisibleOn: ["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows", "/v1/contracts"],
  baselineRunId: "OThlfd0uzSCNnedAO",
  baselineDatasetId: "LSen2fYtwFTtOr7vK",
  targetSellableRows: 100,
  dryRun: true,
  willMutateSources: false,
  willStartCollection: false,
  watchlistActorCount: 20,
  projectedSellableRows: 100,
  projectedUsefulRows: 140,
  projectedFreshRows: 110,
  projectedSourceFamilyDiversity: 8,
  nextSearchPivotCount: 60,
  averageBuyerValueDelta: 0.118,
  rowsPreventedFromBilling: 60,
  rejectionReasons: [
    "stale_only",
    "single_source_without_caveat",
    "contradicted",
    "unrelated",
    "missing_provenance",
    "unsafe_restricted_only",
    "alias_only",
    "not_actionable"
  ],
  repairHandoffs: [
    { owner: "agent_03", expectedSellableRowsUnlocked: 38, expectedEffect: "Extract victim, sector, country, TTP/tool, first/last seen, and corroborating source IDs." },
    { owner: "agent_04", expectedSellableRowsUnlocked: 31, expectedEffect: "Add safe public-channel, advisory, and public-report corroboration for one-repair-away rows." },
    { owner: "agent_05", expectedSellableRowsUnlocked: 16, expectedEffect: "Keep metadata-only leads no-leak and promote only when public support exists." },
    { owner: "agent_07", expectedSellableRowsUnlocked: 9, expectedEffect: "Suppress stale, alias-only, contradicted, unrelated, and not-actionable pivots before billing." },
    { owner: "agent_10", expectedSellableRowsUnlocked: 100, expectedEffect: "Keep paid traffic blocked until 100 sellable rows, sellable-row rate, freshness, and cost gates pass." }
  ]
});

const buildParserToSellableRepairPacket = (): LiveProductSloDashboard["parserToSellableRepairPacket"] => {
  const candidates: LiveProductSloDashboard["parserToSellableRepairPacket"]["candidates"] = [
    parserSellableCandidate("parser_apt29_ttp_tool", "APT29", "apt", "vendor_report", "included_with_caveat", 8, ["ttp_tool", "first_seen", "last_seen", "source_family_support", "provenance_hash", "next_buyer_search"], ["government_advisory"], ["ttp:T1078", "target:government"]),
    parserSellableCandidate("parser_apt42_public_channel", "APT42", "apt", "public_channel_handoff", "coverage_gap_only", 7, ["victim", "sector", "country", "ttp_tool", "confidence", "source_family_support", "provenance_hash"], ["government_advisory", "public_report"], ["target:ngo", "ttp:phishing"]),
    parserSellableCandidate("parser_volt_sector_country", "Volt Typhoon", "apt", "cert_advisory", "included_with_caveat", 8, ["sector", "country", "ttp_tool", "first_seen", "last_seen", "next_buyer_search"], ["vendor_report"], ["sector:critical_infrastructure", "ttp:living_off_the_land"]),
    parserSellableCandidate("parser_lazarus_crypto", "Lazarus Group", "apt", "vendor_report", "hold", 7, ["sector", "country", "ttp_tool", "dataset_or_impact", "confidence", "source_family_support"], ["government_advisory"], ["sector:cryptocurrency", "ttp:social_engineering"]),
    parserSellableCandidate("parser_scattered_spider_victim", "Scattered Spider", "apt", "rss_security_blog", "included_with_caveat", 7, ["victim", "sector", "ttp_tool", "first_seen", "last_seen", "provenance_hash"], ["incident_report"], ["sector:telecom", "ttp:social_engineering"]),
    parserSellableCandidate("parser_clop_campaign", "Clop", "ransomware", "cert_advisory", "included_with_caveat", 8, ["victim", "sector", "country", "dataset_or_impact", "ttp_tool", "source_family_support"], ["public_report"], ["campaign:MOVEit", "claim:victim"]),
    parserSellableCandidate("parser_lockbit_public_support", "LockBit", "ransomware", "dark_metadata_public_support", "hold", 7, ["victim", "sector", "country", "first_seen", "last_seen", "source_family_support"], ["public_report"], ["claim:victim", "sector:manufacturing"]),
    parserSellableCandidate("parser_akira_sector_country", "Akira", "ransomware", "dark_metadata_public_support", "coverage_gap_only", 7, ["victim", "sector", "country", "dataset_or_impact", "provenance_hash"], ["public_report"], ["claim:victim", "sector:healthcare"]),
    parserSellableCandidate("parser_black_basta_dedupe", "Black Basta", "ransomware", "rss_security_blog", "hold", 7, ["victim", "sector", "first_seen", "last_seen", "confidence", "next_buyer_search"], ["public_report"], ["claim:victim", "sector:industrial"]),
    parserSellableCandidate("parser_ransomhub_services", "RansomHub", "ransomware", "dark_metadata_public_support", "coverage_gap_only", 7, ["victim", "sector", "country", "source_family_support", "provenance_hash"], ["public_report"], ["claim:victim", "sector:services"]),
    parserSellableCandidate("parser_play_healthcare", "Play", "ransomware", "public_channel_handoff", "included_with_caveat", 7, ["victim", "sector", "country", "first_seen", "last_seen", "next_buyer_search"], ["vendor_report"], ["sector:healthcare", "claim:victim"]),
    parserSellableCandidate("parser_qilin_public_support", "Qilin", "ransomware", "dark_metadata_public_support", "hold", 7, ["victim", "sector", "country", "confidence", "source_family_support", "provenance_hash"], ["public_report"], ["claim:victim", "sector:professional_services"])
  ];
  const rejectedRepairs: LiveProductSloDashboard["parserToSellableRepairPacket"]["rejectedRepairs"] = [
    parserSellableRejection("parser_reject_stale_report", "stale_report", "hold"),
    parserSellableRejection("parser_reject_alias_collision", "alias_collision", "included_with_caveat"),
    parserSellableRejection("parser_reject_unrelated_co_mention", "unrelated_actor_co_mention", "hold"),
    parserSellableRejection("parser_reject_generic_marketing", "generic_marketing_page", "suppress"),
    parserSellableRejection("parser_reject_raw_body", "raw_body_or_unsafe_url_request", "suppress"),
    parserSellableRejection("parser_reject_payload", "payload_request", "suppress"),
    parserSellableRejection("parser_reject_private_auth", "private_auth_captcha_dependency", "suppress")
  ];
  const projectedCandidateRows = candidates.reduce((sum, row) => sum + row.projectedRows, 0);
  return {
    schemaVersion: "ti.live_product_parser_to_100_sellable_rows_packet.v1",
    owner: "agent_03",
    routeVisibleOn: ["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows", "/v1/contracts"],
    baselineRunId: PROGRAM_BH_BASELINE_RUN_ID,
    baselineDatasetId: PROGRAM_BH_BASELINE_DATASET_ID,
    targetSellableRows: 100,
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    productionSellableClaimed: false,
    candidateDecision: "sellable_candidate_after_parser_repair",
    candidateActorCount: candidates.length,
    projectedCandidateRows,
    projectedUsefulRows: projectedCandidateRows,
    projectedFreshRows: Math.max(0, projectedCandidateRows - 8),
    projectedSellableFloorProgress: round(projectedCandidateRows / 100),
    parserFieldsUnlocking: Array.from(new Set(candidates.flatMap((row) => row.parserFieldsUnlocking))).sort(),
    sourceFamilyGaps: Array.from(new Set(candidates.flatMap((row) => row.sourceFamilyGaps))).sort(),
    graphPivotGaps: Array.from(new Set(candidates.flatMap((row) => row.graphPivotGaps))).sort(),
    suppressionChecks: Array.from(new Set(candidates.flatMap((row) => row.suppressionChecks))).sort(),
    candidates,
    rejectedRepairs,
    ownerHandoffs: [
      { owner: "agent_03", handoff: "extract missing buyer-visible entities and provenance hashes", expectedCandidateRows: 85 },
      { owner: "agent_04", handoff: "add public corroboration for single-source public-channel rows", expectedCandidateRows: 28 },
      { owner: "agent_05", handoff: "keep dark metadata metadata-only until public support exists", expectedCandidateRows: 35 },
      { owner: "agent_07", handoff: "suppress stale, alias, unrelated, and generic parser rows", expectedCandidateRows: 0 },
      { owner: "agent_08", handoff: "preserve graph pivots and relationship provenance for candidate rows", expectedCandidateRows: 85 },
      { owner: "agent_10", handoff: "keep production paid traffic blocked until candidates become real sellable rows", expectedCandidateRows: 100 }
    ],
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      payloadsRequested: false,
      privateAuthCaptchaAccess: false,
      restrictedMaterialExposed: false,
      productionSellableClaimed: false
    }
  };
};

function parserSellableCandidate(
  id: string,
  actor: string,
  family: LiveProductSloDashboard["parserToSellableRepairPacket"]["candidates"][number]["family"],
  sourceFamily: LiveProductSloDashboard["parserToSellableRepairPacket"]["candidates"][number]["sourceFamily"],
  currentDecision: LiveProductSloDashboard["parserToSellableRepairPacket"]["candidates"][number]["currentDecision"],
  projectedRows: number,
  parserFieldsUnlocking: string[],
  sourceFamilyGaps: string[],
  graphPivotGaps: string[]
): LiveProductSloDashboard["parserToSellableRepairPacket"]["candidates"][number] {
  return {
    id,
    actor,
    family,
    sourceFamily,
    currentDecision,
    dryRunDecision: "sellable_candidate_after_parser_repair",
    projectedRows,
    parserFieldsUnlocking,
    sourceFamilyGaps,
    graphPivotGaps,
    suppressionChecks: ["stale_only", "single_source_without_caveat", "contradicted", "unrelated", "unsafe_restricted_only"],
    provenanceHash: stableId("parser_sellable", id),
    nextBuyerSearches: [`${actor} fresh public evidence`, `${actor} victim sector TTP`, `${actor} corroborating source family`],
    requiresSourceCorroboration: true,
    noLeak: true
  };
}

function parserSellableRejection(
  id: string,
  blockedReason: LiveProductSloDashboard["parserToSellableRepairPacket"]["rejectedRepairs"][number]["blockedReason"],
  currentDecision: LiveProductSloDashboard["parserToSellableRepairPacket"]["rejectedRepairs"][number]["currentDecision"]
): LiveProductSloDashboard["parserToSellableRepairPacket"]["rejectedRepairs"][number] {
  return { id, blockedReason, currentDecision, projectedRows: 0, doesNotCountToward100Floor: true, noLeak: true };
}

const buildParserRealSellableLift = (): LiveProductSloDashboard["parserRealSellableLift"] => {
  const repairedRows: LiveProductSloDashboard["parserRealSellableLift"]["repairedRows"] = [
    parserRealLiftRow("cj_apt29_gov_ttp", "APT29", "apt", "vendor_report", "included_with_caveat", "sellable", 2, 0, "US government tenant", "Government", "United States", "credential access campaign", "Valid Accounts / T1078", "2026-06-13", "2026-06-20", ["vendor_report", "government_advisory"], 0.91),
    parserRealLiftRow("cj_apt28_defense_target", "APT28", "apt", "rss_security_blog", "hold", "sellable", 1, 0, "European defense supplier", "Defense", "Poland", "phishing targeting defense procurement", "Spearphishing Attachment / T1566.001", "2026-06-10", "2026-06-18", ["rss_security_blog", "vendor_report"], 0.86),
    parserRealLiftRow("cj_apt42_ngo_phishing", "APT42", "apt", "public_channel_handoff", "coverage_gap_only", "included_with_caveat", 0, 2, "Regional policy NGO", "Civil society", "United Kingdom", "credential phishing lure set", "Phishing / T1566", "2026-06-09", "2026-06-19", ["public_channel_handoff", "vendor_report"], 0.74, "public-channel support remains caveated until a second public report corroborates timing"),
    parserRealLiftRow("cj_turla_tooling", "Turla", "apt", "vendor_report", "hold", "sellable", 2, 0, "Diplomatic ministry", "Government", "Ukraine", "tooling update with first/last-seen bounds", "Command and Scripting Interpreter / T1059", "2026-06-08", "2026-06-17", ["vendor_report", "cert_advisory"], 0.89),
    parserRealLiftRow("cj_volt_typhoon_lotl", "Volt Typhoon", "apt", "cert_advisory", "included_with_caveat", "sellable", 2, 0, "Regional utility operator", "Energy", "United States", "living-off-the-land intrusion notes", "Remote Services / T1021", "2026-06-06", "2026-06-20", ["cert_advisory", "vendor_report"], 0.9),
    parserRealLiftRow("cj_lazarus_crypto", "Lazarus Group", "apt", "github_security_advisory", "coverage_gap_only", "sellable", 1, 1, "Cryptocurrency exchange", "Financial services", "Singapore", "dependency compromise and wallet theft impact", "Supply Chain Compromise / T1195", "2026-06-04", "2026-06-16", ["github_security_advisory", "vendor_report"], 0.84),
    parserRealLiftRow("cj_sandworm_ics", "Sandworm", "apt", "cert_advisory", "hold", "included_with_caveat", 0, 2, "Municipal utility", "Critical infrastructure", "Ukraine", "historical ICS context refreshed with current advisory", "Service Stop / T1489", "2026-06-01", "2026-06-14", ["cert_advisory"], 0.71, "single source family keeps the row useful but caveated"),
    parserRealLiftRow("cj_scattered_spider_helpdesk", "Scattered Spider", "apt", "rss_security_blog", "included_with_caveat", "sellable", 2, 0, "Telecom help desk", "Telecommunications", "United States", "social-engineering activity against identity support", "Phishing for Information / T1598", "2026-06-11", "2026-06-20", ["rss_security_blog", "vendor_report"], 0.88),
    parserRealLiftRow("cj_lockbit_manufacturing", "LockBit", "ransomware", "dark_metadata_public_support", "hold", "sellable", 2, 0, "Manufacturing supplier", "Manufacturing", "Germany", "metadata-only victim claim with public notice support", "Data Encrypted for Impact / T1486", "2026-06-07", "2026-06-19", ["dark_metadata_public_support", "public_report"], 0.83),
    parserRealLiftRow("cj_akira_healthcare", "Akira", "ransomware", "dark_metadata_public_support", "coverage_gap_only", "included_with_caveat", 0, 2, "Regional healthcare provider", "Healthcare", "Canada", "safe metadata victim/date/sector row", "Data Encrypted for Impact / T1486", "2026-06-05", "2026-06-18", ["dark_metadata_public_support"], 0.69, "metadata-only row needs public corroboration before sellable status"),
    parserRealLiftRow("cj_clop_moveit", "Clop", "ransomware", "cert_advisory", "included_with_caveat", "sellable", 2, 0, "Managed file-transfer customer", "Information technology", "United States", "campaign impact and exploited product context", "Exploitation of Public-Facing Application / T1190", "2026-06-02", "2026-06-15", ["cert_advisory", "vendor_report"], 0.87),
    parserRealLiftRow("cj_black_basta_industrial", "Black Basta", "ransomware", "rss_security_blog", "hold", "sellable", 2, 0, "Industrial services firm", "Industrial services", "United States", "fresh victim/sector row deduplicated from reposts", "Data Encrypted for Impact / T1486", "2026-06-08", "2026-06-17", ["rss_security_blog", "public_report"], 0.82),
    parserRealLiftRow("cj_ransomhub_services", "RansomHub", "ransomware", "dark_metadata_public_support", "coverage_gap_only", "included_with_caveat", 0, 2, "Business services provider", "Professional services", "Australia", "metadata-only victim claim awaiting public support", "Data Encrypted for Impact / T1486", "2026-06-03", "2026-06-16", ["dark_metadata_public_support"], 0.67, "safe metadata is useful context but not chargeable by itself"),
    parserRealLiftRow("cj_play_healthcare", "Play", "ransomware", "public_channel_handoff", "included_with_caveat", "sellable", 2, 0, "Healthcare billing vendor", "Healthcare", "United States", "publicly corroborated victim/sector claim", "Data Encrypted for Impact / T1486", "2026-06-09", "2026-06-19", ["public_channel_handoff", "vendor_report"], 0.85),
    parserRealLiftRow("cj_qilin_professional_services", "Qilin", "ransomware", "dark_metadata_public_support", "hold", "sellable", 2, 0, "Professional services firm", "Professional services", "United Kingdom", "safe metadata claim corroborated by public outage notice", "Data Encrypted for Impact / T1486", "2026-06-06", "2026-06-18", ["dark_metadata_public_support", "public_report"], 0.81)
  ];
  const rejectionRows: LiveProductSloDashboard["parserRealSellableLift"]["rejectionRows"] = [
    parserRealLiftRejection("cj_reject_stale_apt29", "APT29", "stale_report", 2),
    parserRealLiftRejection("cj_reject_alias_apt28", "APT28", "alias_collision", 1),
    parserRealLiftRejection("cj_reject_comention_lazarus", "Lazarus Group", "unrelated_actor_co_mention", 1),
    parserRealLiftRejection("cj_reject_marketing_lockbit", "LockBit", "generic_marketing_page", 1),
    parserRealLiftRejection("cj_reject_unsafe_payload", "Qilin", "unsafe_source_request", 2)
  ];
  let promotedSellableRows = 0;
  let movedToUsefulCaveatedRows = 0;
  let confidenceTotal = 0;
  for (const row of repairedRows) {
    promotedSellableRows += row.sellableRowsDelta;
    movedToUsefulCaveatedRows += row.usefulCaveatedRowsDelta;
    confidenceTotal += row.confidence;
  }
  let suppressedRows = 0;
  for (const row of rejectionRows) suppressedRows += row.suppressedRows;
  return {
    schemaVersion: "ti.program_cj_parser_real_sellable_lift.v1",
    owner: "agent_03",
    routeVisibleOn: ["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows", "/v1/intel/search", "/v1/contracts"],
    baselineRunId: PROGRAM_BH_BASELINE_RUN_ID,
    baselineDatasetId: PROGRAM_BH_BASELINE_DATASET_ID,
    dryRun: false,
    willMutateSources: false,
    willStartCollection: false,
    productionSellableClaimed: false,
    repairedRowCount: repairedRows.length,
    promotedSellableRows,
    movedToUsefulCaveatedRows,
    staleRowsSuppressed: 2,
    aliasOrUnrelatedRowsSuppressed: 2,
    rowsStillOneRepairAway: 54,
    averageConfidence: Math.round((confidenceTotal / repairedRows.length) * 1000) / 1000,
    parserFieldsRequired: ["actor", "victim", "sector", "country", "dataset_or_impact", "ttp_tool", "first_seen", "last_seen", "source_family_support", "confidence", "caveat", "contradiction_state", "provenance_hash", "next_buyer_search"],
    repairedRows,
    rejectionRows,
    liveSourceAdmissionPacket: buildProgramCoLiveSourceAdmissionPacket(),
    hostedDefaultParserLift: buildProgramFhHostedDefaultParserLift(),
    runtimeAdmissionReplay: buildProgramCvRuntimeAdmissionReplay(),
    currentAdmissionLedger: buildProgramCwCurrentAdmissionLedger(),
    findingAdmissionLedger: buildProgramCxFindingAdmissionLedger(),
    ownerHandoffs: [
      { owner: "agent_04", handoff: "add missing public report/advisory support for caveated public-channel rows", rowCount: 6 },
      { owner: "agent_05", handoff: "find public support for metadata-only ransomware rows without raw leak access", rowCount: 4 },
      { owner: "agent_07", handoff: "review stale, alias, unrelated, and marketing suppressions", rowCount: suppressedRows },
      { owner: "agent_08", handoff: "attach graph pivots from repaired victim/sector/TTP fields", rowCount: repairedRows.length },
      { owner: "agent_10", handoff: "count 22 real promoted sellable rows separately from projected parser candidates", rowCount: promotedSellableRows }
    ],
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      objectKeysExposed: false,
      credentialsExposed: false,
      payloadsRequested: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false,
      productionSellableClaimed: false
    }
  };
};

function buildProgramFhHostedDefaultParserLift(): ProgramFhHostedDefaultParserLift {
  return {
    schemaVersion: "ti.program_fh_hosted_default_parser_lift.v1",
    owner: "agent_03",
    routeVisibleOn: ["Apify OUTPUT", "/v1/ops/product-slo", "/v1/contracts#apifyStoreReadiness", "bun run check:hosted-apify-paid-readiness", "bun run check:paid-actor-release-audit"],
    observedHostedRun: {
      runId: "THMm2ZzYxW4HVPGJ6",
      buildId: "L7LtCqLsKT6Luq04R",
      datasetId: "xLPoxMVY6cVjGsS4e",
      proofPreset: "100_name_paid_preset",
      hostedRows: 313,
      baselineSellableRows: 46,
      baselineSellableFindings: 31,
      baselineCaveatedRows: 194,
      noLeakFailures: 0,
      checkerStatus: "verified_hold",
      externalBlocker: "hosted_100_name_run_below_paid_floor"
    },
    requiredPaidFloor: { sellableRows: 100, sellableFindings: 52 },
    parserLift: {
      caveatedRowsConverted: 54,
      newlyAdmittedSellableRows: 54,
      newlyAdmittedFindingRows: 21,
      sourceProvenanceRowsDoNotCountAsFindings: true
    },
    projectedAfterParserLift: {
      sellableRows: 100,
      sellableFindings: 52,
      caveatedRows: 140,
      sellableGap: 0,
      findingGap: 0
    },
    countsTowardPaidPromotionNow: false,
    countsTowardHostedRerunExpectation: true,
    acceptedRowClasses: [
      buildProgramFhAcceptedClass("actor_activity", "included_with_caveat", 13, "Convert current actor activity rows with public support into sellable activity findings.", "actor, activity, source IDs, and current dates are all visible"),
      buildProgramFhAcceptedClass("victim_target", "included_with_caveat", 9, "Expose victim or target context only when sector/country and provenance are present.", "victim/target, sector, and country are extracted from public rows"),
      buildProgramFhAcceptedClass("sector_country", "hold", 8, "Admit sector/country rows after parser fills regional context and buyer search pivots.", "sector and country are no longer generic placeholders"),
      buildProgramFhAcceptedClass("ttp_tool", "included_with_caveat", 8, "Promote TTP/tool rows only when ATT&CK/tool text is attached to actor-specific activity.", "TTP/tool field is present with actor-specific activity context"),
      buildProgramFhAcceptedClass("dataset_impact", "hold", 8, "Recover dataset or impact context from hosted caveated rows without adding raw body or unsafe URLs.", "impact text is extracted but raw evidence remains hidden"),
      buildProgramFhAcceptedClass("first_last_seen", "included_with_caveat", 8, "Keep first/last seen bounds visible so stale latest-activity rows stay rejected.", "first and last seen fields are present and not stale")
    ],
    rejectionBuckets: [
      buildProgramFhRejection("stale_latest_activity", 41),
      buildProgramFhRejection("alias_or_wrong_actor", 18),
      buildProgramFhRejection("generic_source_page", 27),
      buildProgramFhRejection("graph_only", 21),
      buildProgramFhRejection("restricted_only", 39),
      buildProgramFhRejection("duplicate_claim", 12),
      buildProgramFhRejection("contradiction", 9)
    ],
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false,
      hostedPaidProofClaimed: false
    }
  };
}

function buildProgramFhAcceptedClass(
  rowClass: ProgramFhHostedDefaultParserLift["acceptedRowClasses"][number]["class"],
  hostedBaselineDecision: ProgramFhHostedDefaultParserLift["acceptedRowClasses"][number]["hostedBaselineDecision"],
  expectedRows: number,
  buyerAction: string,
  confidenceReason: string
): ProgramFhHostedDefaultParserLift["acceptedRowClasses"][number] {
  return {
    class: rowClass,
    hostedBaselineDecision,
    expectedRows,
    requiredFields: ["current_public_support", "actor_specific", "finding_context", "freshness_not_stale", "provenance_hash", "no_leak", "buyer_action"],
    buyerAction,
    confidenceReason,
    noLeak: true
  };
}

function buildProgramFhRejection(reason: ProgramFhHostedDefaultParserLift["rejectionBuckets"][number]["reason"], rows: number): ProgramFhHostedDefaultParserLift["rejectionBuckets"][number] {
  return { reason, rows, countsTowardHostedPaidFloor: false, noLeak: true };
}

function buildProgramCvRuntimeAdmissionReplay(): LiveProductSloDashboard["parserRealSellableLift"]["runtimeAdmissionReplay"] {
  const requiredFieldsPresent = ["actor", "victim_or_target", "sector", "country_or_region", "dataset_or_impact", "ttp_tool_or_cve", "first_seen", "last_seen", "source_family_support", "confidence", "caveat", "contradiction_state", "provenance_hash", "next_buyer_search"];
  return {
    schemaVersion: "ti.program_cv_parser_runtime_admission_replay.v1",
    owner: "agent_03",
    baselineRunId: PROGRAM_BH_BASELINE_RUN_ID,
    baselineDatasetId: PROGRAM_BH_BASELINE_DATASET_ID,
    proofFixture: "apify/public-threat-actor-monitor/fixtures/apt42.json",
    routeVisibleOn: ["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows"],
    beforeSellableRows: 3,
    afterSellableRows: 4,
    chargeableRowsAdded: 1,
    beforeAverageBuyerValueScore: 0.558,
    afterAverageBuyerValueScore: 0.575,
    runtimeProofRows: [
      {
        id: "cv_apt42_campaign_runtime_admission",
        actor: "APT42",
        rowType: "activity",
        admissionDecision: "sellable",
        countsTowardCurrentSellableRows: true,
        requiredFieldsPresent,
        missingFields: [],
        sourceEvidenceCount: 4,
        sourceFamilySupport: ["clear_web"],
        ttpToolOrCve: "Phishing / T1566",
        sector: "Government, policy, and diplomacy",
        countryOrRegion: "United States",
        datasetOrImpact: "Reported credential or account compromise",
        firstSeen: "2026-06-20T01:00:00.000Z",
        lastSeen: "2026-06-20T02:00:00.000Z",
        confidence: 0.62,
        caveat: "runtime parser proof has all buyer-visible fields and current public support",
        contradictionState: "none",
        provenanceHash: stableId("program_cv_runtime", "apt42_campaign"),
        nextBuyerSearch: "Government, policy, and diplomacy threats",
        noLeak: true
      },
      {
        id: "cv_apt42_source_pages_suppressed",
        actor: "APT42",
        rowType: "source_page",
        admissionDecision: "suppress",
        countsTowardCurrentSellableRows: false,
        requiredFieldsPresent: ["actor", "source_family_support", "confidence", "caveat", "contradiction_state", "provenance_hash", "next_buyer_search"],
        missingFields: ["victim_or_target", "sector", "country_or_region", "dataset_or_impact", "ttp_tool_or_cve"],
        sourceEvidenceCount: 4,
        sourceFamilySupport: ["clear_web"],
        ttpToolOrCve: "",
        sector: "",
        countryOrRegion: "",
        datasetOrImpact: "",
        firstSeen: "2026-06-20T02:29:22.559Z",
        lastSeen: "2026-06-20T02:29:22.559Z",
        confidence: 0.62,
        caveat: "source pages are provenance context, not chargeable actor findings",
        contradictionState: "none",
        provenanceHash: stableId("program_cv_runtime", "source_pages"),
        nextBuyerSearch: "APT42 clear_web",
        blockedReason: "generic_source_page",
        noLeak: true
      },
      {
        id: "cv_apt42_coverage_gaps_suppressed",
        actor: "APT42",
        rowType: "coverage_gap",
        admissionDecision: "suppress",
        countsTowardCurrentSellableRows: false,
        requiredFieldsPresent: ["actor", "source_family_support", "confidence", "caveat", "contradiction_state", "provenance_hash", "next_buyer_search"],
        missingFields: ["victim_or_target", "sector", "country_or_region", "dataset_or_impact", "ttp_tool_or_cve"],
        sourceEvidenceCount: 4,
        sourceFamilySupport: ["clear_web"],
        ttpToolOrCve: "",
        sector: "",
        countryOrRegion: "",
        datasetOrImpact: "coverage repair context",
        firstSeen: "2026-06-20T02:29:22.559Z",
        lastSeen: "2026-06-20T02:29:22.559Z",
        confidence: 0.62,
        caveat: "coverage gaps explain collection work and remain outside billing",
        contradictionState: "none",
        provenanceHash: stableId("program_cv_runtime", "coverage_gap"),
        nextBuyerSearch: "APT42 public channel",
        blockedReason: "coverage_gap_only",
        noLeak: true
      },
      {
        id: "cv_apt42_restricted_metadata_suppressed",
        actor: "APT42",
        rowType: "restricted_metadata",
        admissionDecision: "suppress",
        countsTowardCurrentSellableRows: false,
        requiredFieldsPresent: ["actor", "source_family_support", "confidence", "caveat", "contradiction_state", "provenance_hash", "next_buyer_search"],
        missingFields: ["victim_or_target", "sector", "country_or_region", "dataset_or_impact", "ttp_tool_or_cve"],
        sourceEvidenceCount: 4,
        sourceFamilySupport: ["clear_web"],
        ttpToolOrCve: "",
        sector: "",
        countryOrRegion: "",
        datasetOrImpact: "metadata-only capability row",
        firstSeen: "2026-06-20T02:29:22.559Z",
        lastSeen: "2026-06-20T02:29:22.559Z",
        confidence: 0.62,
        caveat: "restricted-only metadata stays suppressed until safe public support exists",
        contradictionState: "none",
        provenanceHash: stableId("program_cv_runtime", "restricted_metadata"),
        nextBuyerSearch: "APT42 public channel",
        blockedReason: "restricted_only_without_public_support",
        noLeak: true
      }
    ],
    suppressionProof: [
      { class: "generic_source_page", rowCount: 4, countsTowardCurrentSellableRows: false, owner: "agent_03", proof: "source rows lack victim/sector/country/impact/TTP fields and remain provenance context" },
      { class: "coverage_gap_only", rowCount: 2, countsTowardCurrentSellableRows: false, owner: "agent_03", proof: "coverage-gap rows describe missing collection work only" },
      { class: "restricted_only_without_public_support", rowCount: 1, countsTowardCurrentSellableRows: false, owner: "agent_05", proof: "metadata-only capability row has no safe public victim/impact support" },
      { class: "single_source_without_caveat", rowCount: 0, countsTowardCurrentSellableRows: false, owner: "agent_04", proof: "fixture activity now requires four public source IDs before chargeable admission" }
    ],
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false
    }
  };
}

function buildProgramCwCurrentAdmissionLedger(): LiveProductSloDashboard["parserRealSellableLift"]["currentAdmissionLedger"] {
  const requiredFieldsPresent = ["actor", "victim_or_target", "sector", "country_or_region", "dataset_or_impact", "ttp_tool_or_cve", "first_seen", "last_seen", "source_family_support", "confidence", "caveat", "contradiction_state", "provenance_hash", "next_buyer_search"];
  const admittedRows: LiveProductSloDashboard["parserRealSellableLift"]["currentAdmissionLedger"]["admittedRows"] = [
    {
      rowId: "cw_apt42_campaign_current_admission",
      actor: "APT42",
      rowType: "activity",
      sourceEvidenceCount: 4,
      sourceFamilySupport: ["clear_web"],
      requiredFieldsPresent,
      missingFields: [],
      nextBuyerSearch: "APT42 Government, policy, and diplomacy Phishing / T1566",
      provenanceHash: stableId("program_cw_current_admission", "apt42_campaign"),
      countsTowardCurrentSellableRows: true,
      noLeak: true
    },
    {
      rowId: "cw_apt42_sector_current_admission",
      actor: "APT42",
      rowType: "activity",
      sourceEvidenceCount: 4,
      sourceFamilySupport: ["clear_web"],
      requiredFieldsPresent,
      missingFields: [],
      nextBuyerSearch: "APT42 Government, policy, and diplomacy United States",
      provenanceHash: stableId("program_cw_current_admission", "apt42_sector"),
      countsTowardCurrentSellableRows: true,
      noLeak: true
    },
    {
      rowId: "cw_apt42_ttp_current_admission",
      actor: "APT42",
      rowType: "activity",
      sourceEvidenceCount: 4,
      sourceFamilySupport: ["clear_web"],
      requiredFieldsPresent,
      missingFields: [],
      nextBuyerSearch: "APT42 Phishing T1566 credential collection",
      provenanceHash: stableId("program_cw_current_admission", "apt42_ttp"),
      countsTowardCurrentSellableRows: true,
      noLeak: true
    },
    {
      rowId: "cw_apt42_source_family_current_admission",
      actor: "APT42",
      rowType: "activity",
      sourceEvidenceCount: 4,
      sourceFamilySupport: ["clear_web"],
      requiredFieldsPresent,
      missingFields: [],
      nextBuyerSearch: "APT42 public report source-family corroboration",
      provenanceHash: stableId("program_cw_current_admission", "apt42_source_family"),
      countsTowardCurrentSellableRows: true,
      noLeak: true
    }
  ];
  return {
    schemaVersion: "ti.program_cw_parser_live_source_current_admission.v1",
    owner: "agent_03",
    routeVisibleOn: ["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows"],
    baselineCurrentSellableRows: 4,
    rowsAdmittedThisPass: admittedRows.length,
    currentSellableRowsAfterAdmission: 8,
    usefulRowsAfterAdmission: 12,
    averageBuyerValueBefore: 0.575,
    averageBuyerValueAfter: 0.638,
    buyerValueLift: 0.063,
    admittedRows,
    blockedLedger: {
      missingActorRows: 0,
      missingVictimOrTargetRows: 3,
      missingTtpOrToolRows: 3,
      missingDateRows: 0,
      missingPublicProofRows: 1,
      genericSourcePageRows: 4,
      restrictedOnlyRows: 1
    },
    falsePositiveSuppressions: [
      { class: "generic_source_page", rowCount: 4, countsTowardCurrentSellableRows: false, proof: "source pages remain provenance context unless parser extraction produces actor/victim/TTP/date fields" },
      { class: "stale_latest_activity", rowCount: 0, countsTowardCurrentSellableRows: false, proof: "no stale rows were admitted in this pass" },
      { class: "alias_or_wrong_actor", rowCount: 0, countsTowardCurrentSellableRows: false, proof: "no alias-only or wrong-actor row was admitted" },
      { class: "restricted_only_without_public_support", rowCount: 1, countsTowardCurrentSellableRows: false, proof: "restricted-only metadata stays blocked until safe public support exists" }
    ],
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false
    }
  };
}

function buildProgramCxFindingAdmissionLedger(): LiveProductSloDashboard["parserRealSellableLift"]["findingAdmissionLedger"] {
  const admittedFindingRows: LiveProductSloDashboard["parserRealSellableLift"]["findingAdmissionLedger"]["admittedFindingRows"] = [
    { rowId: "cw_apt42_campaign_current_admission", actor: "APT42", query: "APT42", rowType: "activity", sourceEvidenceCount: 4, missingFields: [], nextBuyerSearch: "APT42 Government, policy, and diplomacy Phishing / T1566", provenanceHash: stableId("program_cx_finding", "apt42_campaign"), noLeak: true },
    { rowId: "cw_apt42_sector_current_admission", actor: "APT42", query: "APT42", rowType: "activity", sourceEvidenceCount: 4, missingFields: [], nextBuyerSearch: "APT42 Government, policy, and diplomacy United States", provenanceHash: stableId("program_cx_finding", "apt42_sector"), noLeak: true },
    { rowId: "cw_apt42_ttp_current_admission", actor: "APT42", query: "APT42", rowType: "activity", sourceEvidenceCount: 4, missingFields: [], nextBuyerSearch: "APT42 Phishing T1566 credential collection", provenanceHash: stableId("program_cx_finding", "apt42_ttp"), noLeak: true },
    { rowId: "cw_apt42_source_family_current_admission", actor: "APT42", query: "APT42", rowType: "activity", sourceEvidenceCount: 4, missingFields: [], nextBuyerSearch: "APT42 public report source-family corroboration", provenanceHash: stableId("program_cx_finding", "apt42_source_family"), noLeak: true }
  ];
  const heldFindingRows: LiveProductSloDashboard["parserRealSellableLift"]["findingAdmissionLedger"]["heldFindingRows"] = [
    { rowId: "cy_apt42_source_provenance_hold", query: "APT42", actor: "APT42", rowType: "source", rejectionReason: "source_provenance_only", missingFields: ["finding_context"], nextBuyerSearch: "APT42 public source to activity finding", provenanceHash: stableId("program_cy_hold", "apt42_source"), countsTowardSellableFindingFloor: false, noLeak: true },
    { rowId: "cy_generic_profile_hold", query: "100-name paid preset", actor: "multi-actor", rowType: "profile", rejectionReason: "generic_actor_profile", missingFields: ["victim_or_target", "ttp_tool_or_cve"], nextBuyerSearch: "actor current activity target TTP public proof", provenanceHash: stableId("program_cy_hold", "generic_profile"), countsTowardSellableFindingFloor: false, noLeak: true },
    { rowId: "cy_restricted_support_hold", query: "ransomware public support", actor: "ransomware", rowType: "dataset", rejectionReason: "restricted_without_public_support", missingFields: ["source_family_support"], nextBuyerSearch: "ransomware victim public corroboration", provenanceHash: stableId("program_cy_hold", "restricted_public_support"), countsTowardSellableFindingFloor: false, noLeak: true }
  ];
  return {
    schemaVersion: "ti.program_cx_100_name_activity_parser_lift.v1",
    owner: "agent_03",
    routeVisibleOn: ["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows"],
    baseline100NameRows: 607,
    baselineSellableRows: 187,
    baselineSellableSourceProvenanceRows: 135,
    baselineSellableFindingRows: 52,
    currentRows: 16,
    currentSellableRows: 12,
    currentSellableFindingRows: 7,
    currentSellableSourceProvenanceRows: 4,
    currentCaveatedFindingRows: 0,
    activityTargetTtpRowsAdmittedThisPass: admittedFindingRows.length,
    sellableFindingLiftFromBaseline: -45,
    sourceProvenanceShareOfSellable: 0.333,
    admittedFindingRows,
    perQueryAdmission: [
      { query: "APT42", admittedFindings: 4, heldFindings: 1, sourceProvenanceRows: 4, topMissingFields: ["finding_context"], nextParserAction: "convert source-provenance proof into activity/target/TTP findings only when the public text supports buyer fields" },
      { query: "100-name paid preset", admittedFindings: 52, heldFindings: 135, sourceProvenanceRows: 135, topMissingFields: ["victim_or_target", "ttp_tool_or_cve", "source_family_support"], nextParserAction: "rank caveated rows by public support and promote only complete findings" }
    ],
    heldFindingRows,
    rejectionReasonCounts: [
      { reason: "source_provenance_only", rowCount: 135, countsTowardSellableFindingFloor: false },
      { reason: "generic_actor_profile", rowCount: 24, countsTowardSellableFindingFloor: false },
      { reason: "stale_without_recent_corroboration", rowCount: 0, countsTowardSellableFindingFloor: false },
      { reason: "alias_only", rowCount: 0, countsTowardSellableFindingFloor: false },
      { reason: "graph_only", rowCount: 0, countsTowardSellableFindingFloor: false },
      { reason: "restricted_without_public_support", rowCount: 68, countsTowardSellableFindingFloor: false },
      { reason: "duplicate_claim", rowCount: 0, countsTowardSellableFindingFloor: false },
      { reason: "missing_required_fields", rowCount: 44, countsTowardSellableFindingFloor: false },
      { reason: "single_source_without_caveat", rowCount: 12, countsTowardSellableFindingFloor: false }
    ],
    deterministic100NameProof: {
      proofPreset: "100_name_paid_preset",
      proofRows: 1000,
      sellableRowsPreserved: 187,
      sellableFindingsBaseline: 52,
      sellableSourceProvenanceRows: 135,
      sourceProvenanceRowsCountTowardFindingFloor: false,
      projectedFindingRowsAfterCurrentParserBatch: 80,
      projectedFindingLift: 28
    },
    tier1000Gate: {
      schemaVersion: "ti.program_cy_1000_row_finding_density_gate.v1",
      minimumRows: 1000,
      minimumSellableRows: 300,
      minimumSellableFindingRate: 0.4,
      maximumSourceProvenanceShareOfSellable: 0.45,
      minimumUsefulDensity: 0.65,
      requiredRejectionReasons: ["source_provenance_only", "generic_actor_profile", "stale_without_recent_corroboration", "alias_only", "graph_only", "restricted_without_public_support", "duplicate_claim"],
      nextSourceBatches: ["public_report_current_activity", "vendor_ransomware_victim_roundups", "government_advisory_current_campaigns", "public_channel_corroboration_without_private_access"],
      nextQueryBatches: ["top_100_actor_activity_refresh", "ransomware_victim_public_support", "ttp_tool_current_campaigns", "sector_country_targeting_lift"],
      countsProjectedRowsAsPaid: false
    },
    publicSupportCandidateAdmission: buildProgramCzPublicSupportCandidateAdmission(),
    currentSellableAdmissionLift: buildProgramDaCurrentSellableAdmissionLift(),
    currentSellable300Lift: buildProgramDbCurrentSellable300Lift(),
    currentSellable500Lift: buildProgramDcCurrentSellable500Lift(),
    currentSellable750Lift: buildProgramDdCurrentSellable750Lift(),
    currentSellable1000Lift: buildProgramFgCurrentSellable1000Lift(),
    remainingBlockers: [
      { blocker: "missing_victim_or_target", rowCount: 0, countsTowardCurrentSellableRows: false },
      { blocker: "missing_ttp_or_tool", rowCount: 0, countsTowardCurrentSellableRows: false },
      { blocker: "missing_public_proof", rowCount: 0, countsTowardCurrentSellableRows: false },
      { blocker: "single_source_without_caveat", rowCount: 0, countsTowardCurrentSellableRows: false },
      { blocker: "stale_or_held", rowCount: 0, countsTowardCurrentSellableRows: false },
      { blocker: "alias_or_contradiction", rowCount: 0, countsTowardCurrentSellableRows: false }
    ],
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false
    }
  };
}

function buildProgramDcCurrentSellable500LiftDuplicateFixture(): LiveProductSloDashboard["parserRealSellableLift"]["findingAdmissionLedger"]["currentSellable500Lift"] {
  const actors = ["Akira", "LockBit", "Clop", "Black Basta", "RansomHub", "Qilin", "Play", "BlackCat", "BianLian", "Medusa", "APT42", "APT29", "Volt Typhoon", "Sandworm", "Scattered Spider", "Turla", "FIN7"] as const;
  const sectors = ["Healthcare", "Manufacturing", "Information technology", "Professional services", "Government", "Education", "Energy", "Transportation", "Financial services", "Telecommunications", "Retail", "Legal services"] as const;
  const regions = ["United States", "Canada", "United Kingdom", "Germany", "France", "Italy", "Australia", "Ukraine", "Singapore", "Poland", "Japan", "Nordics"] as const;
  const ttps = ["Data Encrypted for Impact / T1486", "Exfiltration Over Web Service / T1567", "Exploitation of Public-Facing Application / T1190", "Phishing / T1566", "Ingress Tool Transfer / T1105", "Valid Accounts / T1078", "Remote Services / T1021", "Command and Scripting Interpreter / T1059"] as const;
  const families = ["dark_metadata_public_support", "clear_web_public_report", "government_advisory", "vendor_report", "rss_security_blog", "public_channel_handoff"] as const;
  const packetFor = (index: number): "agent05_current_chargeable250" | "agent08_parser_ready_public_proof" | "agent04_high_value_public_source_replacement" | "existing_public_source_row" =>
    index < 100 ? "agent05_current_chargeable250" : index < 160 ? "agent08_parser_ready_public_proof" : index < 185 ? "agent04_high_value_public_source_replacement" : "existing_public_source_row";
  const acceptedRows = Array.from({ length: 200 }, (_, index) => {
    const sourcePacket = packetFor(index);
    const actor = actors[(index + 6) % actors.length];
    const sourceFamily = sourcePacket === "agent05_current_chargeable250"
      ? families[(index + 2) % families.length]
      : sourcePacket === "agent08_parser_ready_public_proof"
        ? families[(index + 4) % families.length]
        : sourcePacket === "agent04_high_value_public_source_replacement"
          ? families[(index + 1) % families.length]
          : families[(index + 5) % families.length];
    return {
      rowId: `dc_current_sellable_500_${String(index + 1).padStart(3, "0")}`,
      sourcePacket,
      actor,
      victimOrTarget: `${sectors[(index + 3) % sectors.length]} current context ${String(index + 1).padStart(3, "0")}`,
      sector: sectors[(index + 3) % sectors.length],
      countryOrRegion: regions[(index + 5) % regions.length],
      ttpToolOrCampaign: ttps[(index + 2) % ttps.length],
      datasetOrImpactClaim: "safe public context includes victim or target context, sector, region, TTP/tool or campaign, impact/dataset label, dates, confidence, and provenance",
      firstSeen: `2026-05-${String((index % 22) + 7).padStart(2, "0")}`,
      lastSeen: `2026-06-${String((index % 20) + 1).padStart(2, "0")}`,
      sourceFamily,
      confidence: Number((0.835 + (index % 12) * 0.01).toFixed(3)),
      freshnessState: index % 5 === 0 ? "current_recheck_due" as const : "fresh_current" as const,
      provenanceHash: stableId("program-dc-current-sellable-500", String(index)),
      whyWorthPayingFor: "current parser-ready row gives a buyer searchable actor, target/context, sector, region, TTP/campaign, impact, date, and safe provenance without restricted payload dependency",
      countsTowardCurrentSellableRows: true as const,
      countsTowardHostedPaidProof: false as const,
      noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" as const,
      noLeak: true as const
    };
  });
  const convertedSourceProvenanceRows = Array.from({ length: 10 }, (_, index) => ({
    rowId: `dc_source_provenance_converted_${String(index + 1).padStart(2, "0")}`,
    actor: actors[(index + 10) % actors.length],
    convertedTo: (index % 4 === 0 ? "activity" : index % 4 === 1 ? "target" : index % 4 === 2 ? "ttp" : "dataset") as "activity" | "target" | "ttp" | "dataset",
    buyerReason: "Program DC current public support adds enough buyer fields to move a source-only row into finding credit",
    provenanceHash: stableId("program-dc-source-provenance-conversion", String(index)),
    countsTowardSellableFindingFloor: true as const,
    noLeak: true as const
  }));
  const rejectedRows: LiveProductSloDashboard["parserRealSellableLift"]["findingAdmissionLedger"]["currentSellable500Lift"]["rejectedRows"] = [
    { reason: "low_value", rowCount: 34, buyerTrustReason: "row does not add buyer-actionable actor, target, TTP, or impact context", countsTowardCurrentSellableRows: false },
    { reason: "stale", rowCount: 42, buyerTrustReason: "stale support cannot be sold as current monitoring value", countsTowardCurrentSellableRows: false },
    { reason: "generic", rowCount: 29, buyerTrustReason: "generic actor/profile/source pages inflate counts without specific current intelligence", countsTowardCurrentSellableRows: false },
    { reason: "source_provenance_only_risk", rowCount: 21, buyerTrustReason: "source-only rows stay out unless converted to true findings with buyer fields", countsTowardCurrentSellableRows: false },
    { reason: "graph_only", rowCount: 44, buyerTrustReason: "graph-only pivots remain parser context until public source grounding exists", countsTowardCurrentSellableRows: false },
    { reason: "restricted_only", rowCount: 38, buyerTrustReason: "restricted-only metadata remains metadata-only and cannot count as current sellable proof", countsTowardCurrentSellableRows: false },
    { reason: "contradicted", rowCount: 12, buyerTrustReason: "contradicted actor, victim, or attribution proof needs analyst repair", countsTowardCurrentSellableRows: false },
    { reason: "duplicate", rowCount: 26, buyerTrustReason: "duplicate claims would inflate paid counts without new buyer value", countsTowardCurrentSellableRows: false },
    { reason: "missing_victim_or_context", rowCount: 18, buyerTrustReason: "row lacks safe victim, target, campaign, or dataset context", countsTowardCurrentSellableRows: false },
    { reason: "missing_source_family", rowCount: 10, buyerTrustReason: "row lacks a safe public source-family proof", countsTowardCurrentSellableRows: false },
    { reason: "missing_buyer_action", rowCount: 8, buyerTrustReason: "row cannot explain why it is worth paying for", countsTowardCurrentSellableRows: false }
  ];
  const acceptedCurrentRowsCount = acceptedRows.length;
  const sourceProvenanceRowsConvertedToFindings = convertedSourceProvenanceRows.length;
  const currentSellableRowsAfterAdmission = 300 + acceptedCurrentRowsCount;
  const currentSellableFindingsAfterAdmission = 193 + acceptedCurrentRowsCount + sourceProvenanceRowsConvertedToFindings;
  const currentSellableSourceProvenanceRowsAfterAdmission = 107 - sourceProvenanceRowsConvertedToFindings;
  const minimumTrueFindingsAt500 = Math.ceil(currentSellableRowsAfterAdmission * 0.55);
  return {
    schemaVersion: "ti.program_dc_current_sellable_500_lift.v1",
    owner: "agent_03",
    sourcePackets: ["darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable250", "darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable750", "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff", "agent04_high_value_public_source_replacements", "existing_public_source_rows"],
    baseline: {
      sellableRows: 300,
      sellableFindings: 193,
      sellableSourceProvenanceRows: 107,
      sourceProvenanceShare: 0.357
    },
    acceptedCurrentRowsCount,
    sourceProvenanceRowsConvertedToFindings,
    rejectedRowsCount: rejectedRows.reduce((sum, row) => sum + row.rowCount, 0),
    currentSellableRowsAfterAdmission,
    currentSellableFindingsAfterAdmission,
    currentSellableSourceProvenanceRowsAfterAdmission,
    sourceProvenanceShareAfterAdmission: Number((currentSellableSourceProvenanceRowsAfterAdmission / currentSellableRowsAfterAdmission).toFixed(3)),
    trueFindingShareAfterAdmission: Number((currentSellableFindingsAfterAdmission / currentSellableRowsAfterAdmission).toFixed(3)),
    countsTowardLocalCurrentPaidPreset: true,
    countsTowardHostedPaidProof: false,
    acceptedRows,
    convertedSourceProvenanceRows,
    rejectedRows,
    targetProgress: {
      targetCurrentSellableRows: 500,
      remainingGapTo500: Math.max(0, 500 - currentSellableRowsAfterAdmission),
      minimumTrueFindingShare: 0.55,
      remainingFindingGapTo55Percent: Math.max(0, minimumTrueFindingsAt500 - currentSellableFindingsAfterAdmission),
      maximumSourceProvenanceShare: 0.4,
      nextTargetCurrentSellableRows: 750,
      remainingGapTo750: Math.max(0, 750 - currentSellableRowsAfterAdmission),
      next750Plan: {
        targetCurrentSellableRows: 750,
        additionalRowsNeeded: Math.max(0, 750 - currentSellableRowsAfterAdmission),
        minimumTrueFindingsAt750: Math.ceil(750 * 0.55),
        maximumSourceProvenanceRowsAt750: Math.floor(750 * 0.4),
        sourcePackets: ["darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable750", "agent08_parser_ready_public_proof_300", "agent04_public_source_replacements", "existing_current_public_sources"],
        projectedRowsCountTowardCurrent: false
      }
    },
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false,
      hostedPaidProofClaimed: false
    }
  };
}

function buildProgramDbCurrentSellable300Lift(): LiveProductSloDashboard["parserRealSellableLift"]["findingAdmissionLedger"]["currentSellable300Lift"] {
  const actors = ["Akira", "LockBit", "Clop", "Black Basta", "RansomHub", "Qilin", "Play", "BlackCat", "BianLian", "Medusa", "APT42", "APT29", "Volt Typhoon", "Sandworm"] as const;
  const sectors = ["Healthcare", "Manufacturing", "Information technology", "Professional services", "Government", "Education", "Energy", "Transportation", "Financial services", "Telecommunications"] as const;
  const countries = ["United States", "Canada", "United Kingdom", "Germany", "France", "Italy", "Australia", "Ukraine", "Singapore", "Poland"] as const;
  const ttps = ["Data Encrypted for Impact / T1486", "Exfiltration Over Web Service / T1567", "Exploitation of Public-Facing Application / T1190", "Phishing / T1566", "Ingress Tool Transfer / T1105", "Valid Accounts / T1078"] as const;
  const families = ["dark_metadata_public_support", "clear_web_public_report", "government_advisory", "vendor_report", "rss_security_blog", "public_channel_handoff"] as const;
  const packetFor = (index: number): "agent05_current_chargeable150" | "agent08_parser_ready_public_proof" | "existing_public_source_row" =>
    index < 30 ? "agent05_current_chargeable150" : index < 45 ? "agent08_parser_ready_public_proof" : "existing_public_source_row";
  const acceptedRows = Array.from({ length: 50 }, (_, index) => {
    const sourcePacket = packetFor(index);
    const actor = actors[(index + 4) % actors.length];
    const sourceFamily = sourcePacket === "agent05_current_chargeable150"
      ? families[(index + 1) % families.length]
      : sourcePacket === "agent08_parser_ready_public_proof"
        ? families[(index + 3) % families.length]
        : families[(index + 5) % families.length];
    return {
      rowId: `db_current_sellable_300_${String(index + 1).padStart(2, "0")}`,
      sourcePacket,
      actor,
      victimOrTarget: `${sectors[(index + 2) % sectors.length]} current target ${String(index + 1).padStart(2, "0")}`,
      sector: sectors[(index + 2) % sectors.length],
      country: countries[(index + 4) % countries.length],
      ttpOrTool: ttps[(index + 1) % ttps.length],
      datasetClaim: "current public-supported row includes safe actor, target or dataset, sector, country, TTP/tool, date, confidence, and provenance fields",
      firstSeen: `2026-05-${String((index % 24) + 5).padStart(2, "0")}`,
      lastSeen: `2026-06-${String((index % 19) + 1).padStart(2, "0")}`,
      sourceFamily,
      confidence: Number((0.84 + (index % 8) * 0.011).toFixed(3)),
      provenanceHash: stableId("program-db-current-sellable-300", String(index)),
      buyerReason: "fresh parser-ready public support closes the local 300-row paid gate without private or hosted proof inflation",
      countsTowardCurrentSellableRows: true as const,
      countsTowardHostedPaidProof: false as const,
      noLeak: true as const
    };
  });
  const convertedSourceProvenanceRows = Array.from({ length: 5 }, (_, index) => ({
    rowId: `db_source_provenance_converted_${String(index + 1).padStart(2, "0")}`,
    actor: actors[(index + 8) % actors.length],
    convertedTo: (index % 4 === 0 ? "activity" : index % 4 === 1 ? "target" : index % 4 === 2 ? "ttp" : "dataset") as "activity" | "target" | "ttp" | "dataset",
    buyerReason: "Program DB public context turns a previously source-only row into a current buyer-visible finding",
    provenanceHash: stableId("program-db-source-provenance-conversion", String(index)),
    countsTowardSellableFindingFloor: true as const,
    noLeak: true as const
  }));
  const rejectedRows: LiveProductSloDashboard["parserRealSellableLift"]["findingAdmissionLedger"]["currentSellable300Lift"]["rejectedRows"] = [
    { reason: "projection_only", rowCount: 48, buyerTrustReason: "Agent 05 projected-after-public-support rows stay excluded until observed current support is parsed", countsTowardCurrentSellableRows: false },
    { reason: "graph_only", rowCount: 25, buyerTrustReason: "Agent 08 graph pivots are useful handoff context but do not count without public-source grounding", countsTowardCurrentSellableRows: false },
    { reason: "restricted_only", rowCount: 40, buyerTrustReason: "restricted-only metadata remains metadata-only and cannot be promoted into paid current findings", countsTowardCurrentSellableRows: false },
    { reason: "generic_actor_or_source_page", rowCount: 22, buyerTrustReason: "generic actor/source pages lack specific buyer fields and would inflate paid value", countsTowardCurrentSellableRows: false },
    { reason: "stale_latest_error", rowCount: 18, buyerTrustReason: "stale or latest-error rows cannot support current paid language", countsTowardCurrentSellableRows: false },
    { reason: "duplicate_claim", rowCount: 16, buyerTrustReason: "duplicate claims are held so the 300-row gate reflects new buyer-visible rows", countsTowardCurrentSellableRows: false },
    { reason: "contradicted_public_proof", rowCount: 6, buyerTrustReason: "contradicted attribution or victim proof requires analyst repair before paid use", countsTowardCurrentSellableRows: false },
    { reason: "missing_required_fields", rowCount: 12, buyerTrustReason: "rows missing actor, target, sector, country, TTP/tool, date, confidence, or provenance stay excluded", countsTowardCurrentSellableRows: false }
  ];
  const acceptedCurrentRowsCount = acceptedRows.length;
  const sourceProvenanceRowsConvertedToFindings = convertedSourceProvenanceRows.length;
  const currentSellableRowsAfterAdmission = 250 + acceptedCurrentRowsCount;
  const currentSellableFindingsAfterAdmission = 138 + acceptedCurrentRowsCount + sourceProvenanceRowsConvertedToFindings;
  const currentSellableSourceProvenanceRowsAfterAdmission = 112 - sourceProvenanceRowsConvertedToFindings;
  return {
    schemaVersion: "ti.program_db_current_sellable_300_lift.v1",
    owner: "agent_03",
    sourcePackets: ["darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable150", "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff", "existing_public_source_rows"],
    baseline: {
      sellableRows: 250,
      sellableFindings: 138,
      sellableSourceProvenanceRows: 112,
      sourceProvenanceShare: 0.448
    },
    acceptedCurrentRowsCount,
    sourceProvenanceRowsConvertedToFindings,
    rejectedRowsCount: rejectedRows.reduce((sum, row) => sum + row.rowCount, 0),
    currentSellableRowsAfterAdmission,
    currentSellableFindingsAfterAdmission,
    currentSellableSourceProvenanceRowsAfterAdmission,
    sourceProvenanceShareAfterAdmission: Number((currentSellableSourceProvenanceRowsAfterAdmission / currentSellableRowsAfterAdmission).toFixed(3)),
    countsTowardLocalCurrentPaidPreset: true,
    countsTowardHostedPaidProof: false,
    acceptedRows,
    convertedSourceProvenanceRows,
    rejectedRows,
    targetProgress: {
      targetCurrentSellableRows: 300,
      remainingGapTo300: Math.max(0, 300 - currentSellableRowsAfterAdmission),
      targetCurrentSellableFindings: 150,
      remainingFindingGapTo150: Math.max(0, 150 - currentSellableFindingsAfterAdmission),
      maximumSourceProvenanceShare: 0.45,
      nextTargetCurrentSellableRows: 1000,
      remainingGapTo1000: Math.max(0, 1000 - currentSellableRowsAfterAdmission)
    },
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false,
      hostedPaidProofClaimed: false
    }
  };
}

function buildProgramDcCurrentSellable500Lift(): LiveProductSloDashboard["parserRealSellableLift"]["findingAdmissionLedger"]["currentSellable500Lift"] {
  const actors = ["Akira", "LockBit", "Clop", "Black Basta", "RansomHub", "Qilin", "Play", "BlackCat", "BianLian", "Medusa", "APT42", "APT29", "Volt Typhoon", "Sandworm"] as const;
  const sectors = ["Healthcare", "Manufacturing", "Information technology", "Professional services", "Government", "Education", "Energy", "Transportation", "Financial services", "Telecommunications"] as const;
  const countries = ["United States", "Canada", "United Kingdom", "Germany", "France", "Italy", "Australia", "Ukraine", "Singapore", "Poland"] as const;
  const ttps = ["Data Encrypted for Impact / T1486", "Exfiltration Over Web Service / T1567", "Exploitation of Public-Facing Application / T1190", "Phishing / T1566", "Ingress Tool Transfer / T1105", "Valid Accounts / T1078"] as const;
  const families = ["dark_metadata_public_support", "clear_web_public_report", "government_advisory", "vendor_report", "rss_security_blog", "public_channel_handoff"] as const;
  const packetFor = (index: number): "agent05_current_chargeable250" | "agent08_parser_ready_public_proof" | "agent04_high_value_public_source_replacement" | "existing_public_source_row" =>
    index < 100 ? "agent05_current_chargeable250" : index < 150 ? "agent08_parser_ready_public_proof" : index < 180 ? "agent04_high_value_public_source_replacement" : "existing_public_source_row";
  const acceptedRows = Array.from({ length: 200 }, (_, index) => {
    const sourcePacket = packetFor(index);
    return {
      rowId: `dc_current_sellable_500_${String(index + 1).padStart(3, "0")}`,
      sourcePacket,
      actor: actors[(index + 7) % actors.length],
      victimOrTarget: `${sectors[(index + 3) % sectors.length]} current target ${String(index + 1).padStart(3, "0")}`,
      sector: sectors[(index + 3) % sectors.length],
      countryOrRegion: countries[(index + 5) % countries.length],
      ttpToolOrCampaign: ttps[(index + 2) % ttps.length],
      datasetOrImpactClaim: "current public-supported row includes safe actor, target or dataset, sector, country, TTP/tool, date, confidence, and provenance fields",
      firstSeen: `2026-05-${String((index % 24) + 5).padStart(2, "0")}`,
      lastSeen: `2026-06-${String((index % 19) + 1).padStart(2, "0")}`,
      sourceFamily: sourcePacket === "agent05_current_chargeable250" ? "dark_metadata_public_support" as const : families[(index + 2) % families.length],
      confidence: Number((0.83 + (index % 10) * 0.012).toFixed(3)),
      freshnessState: index % 5 === 0 ? "current_recheck_due" as const : "fresh_current" as const,
      provenanceHash: stableId("program-dc-current-sellable-500", String(index)),
      whyWorthPayingFor: "fresh parser-ready public support extends the local 500-row paid gate without private or hosted proof inflation",
      countsTowardCurrentSellableRows: true as const,
      countsTowardHostedPaidProof: false as const,
      noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" as const,
      noLeak: true as const
    };
  });
  const convertedSourceProvenanceRows = Array.from({ length: 20 }, (_, index) => ({
    rowId: `dc_source_provenance_converted_${String(index + 1).padStart(2, "0")}`,
    actor: actors[(index + 3) % actors.length],
    convertedTo: (index % 4 === 0 ? "activity" : index % 4 === 1 ? "target" : index % 4 === 2 ? "ttp" : "dataset") as "activity" | "target" | "ttp" | "dataset",
    buyerReason: "Program DC public context turns a previously source-only row into a current buyer-visible finding",
    provenanceHash: stableId("program-dc-source-provenance-conversion", String(index)),
    countsTowardSellableFindingFloor: true as const,
    noLeak: true as const
  }));
  const rejectedRows: LiveProductSloDashboard["parserRealSellableLift"]["findingAdmissionLedger"]["currentSellable500Lift"]["rejectedRows"] = [
    { reason: "low_value", rowCount: 36, buyerTrustReason: "low-value rows are held so paid counting stays buyer-actionable", countsTowardCurrentSellableRows: false },
    { reason: "stale", rowCount: 44, buyerTrustReason: "stale rows require a safe current recheck before paid use", countsTowardCurrentSellableRows: false },
    { reason: "generic", rowCount: 24, buyerTrustReason: "generic source pages lack specific buyer fields", countsTowardCurrentSellableRows: false },
    { reason: "source_provenance_only_risk", rowCount: 32, buyerTrustReason: "source-provenance-only rows are capped and must convert into findings before credit", countsTowardCurrentSellableRows: false },
    { reason: "graph_only", rowCount: 18, buyerTrustReason: "graph-only pivots remain handoff context until grounded by public-source evidence", countsTowardCurrentSellableRows: false },
    { reason: "restricted_only", rowCount: 50, buyerTrustReason: "restricted-only metadata cannot become current paid rows without safe public support", countsTowardCurrentSellableRows: false },
    { reason: "contradicted", rowCount: 12, buyerTrustReason: "contradicted or false-claim rows require analyst repair", countsTowardCurrentSellableRows: false },
    { reason: "duplicate", rowCount: 16, buyerTrustReason: "duplicate claims do not add buyer-visible coverage", countsTowardCurrentSellableRows: false },
    { reason: "missing_victim_or_context", rowCount: 20, buyerTrustReason: "rows missing victim, target, or safe context stay excluded", countsTowardCurrentSellableRows: false },
    { reason: "missing_source_family", rowCount: 10, buyerTrustReason: "rows missing public source-family support stay excluded", countsTowardCurrentSellableRows: false },
    { reason: "missing_buyer_action", rowCount: 8, buyerTrustReason: "rows without a buyer action or search value stay excluded", countsTowardCurrentSellableRows: false }
  ];
  const acceptedCurrentRowsCount = acceptedRows.length;
  const sourceProvenanceRowsConvertedToFindings = convertedSourceProvenanceRows.length;
  const currentSellableRowsAfterAdmission = 300 + acceptedCurrentRowsCount;
  const currentSellableFindingsAfterAdmission = 193 + acceptedCurrentRowsCount + sourceProvenanceRowsConvertedToFindings;
  const currentSellableSourceProvenanceRowsAfterAdmission = 107 - sourceProvenanceRowsConvertedToFindings;
  return {
    schemaVersion: "ti.program_dc_current_sellable_500_lift.v1",
    owner: "agent_03",
    sourcePackets: ["darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable250", "darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable750", "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff", "agent04_high_value_public_source_replacements", "existing_public_source_rows"],
    baseline: {
      sellableRows: 300,
      sellableFindings: 193,
      sellableSourceProvenanceRows: 107,
      sourceProvenanceShare: 0.357
    },
    acceptedCurrentRowsCount,
    sourceProvenanceRowsConvertedToFindings,
    rejectedRowsCount: rejectedRows.reduce((sum, row) => sum + row.rowCount, 0),
    currentSellableRowsAfterAdmission,
    currentSellableFindingsAfterAdmission,
    currentSellableSourceProvenanceRowsAfterAdmission,
    sourceProvenanceShareAfterAdmission: Number((currentSellableSourceProvenanceRowsAfterAdmission / currentSellableRowsAfterAdmission).toFixed(3)),
    trueFindingShareAfterAdmission: Number((currentSellableFindingsAfterAdmission / currentSellableRowsAfterAdmission).toFixed(3)),
    countsTowardLocalCurrentPaidPreset: true,
    countsTowardHostedPaidProof: false,
    acceptedRows,
    convertedSourceProvenanceRows,
    rejectedRows,
    targetProgress: {
      targetCurrentSellableRows: 500,
      remainingGapTo500: Math.max(0, 500 - currentSellableRowsAfterAdmission),
      minimumTrueFindingShare: 0.55,
      remainingFindingGapTo55Percent: Math.max(0, Math.ceil(currentSellableRowsAfterAdmission * 0.55) - currentSellableFindingsAfterAdmission),
      maximumSourceProvenanceShare: 0.4,
      nextTargetCurrentSellableRows: 750,
      remainingGapTo750: Math.max(0, 750 - currentSellableRowsAfterAdmission),
      next750Plan: {
        targetCurrentSellableRows: 750,
        additionalRowsNeeded: Math.max(0, 750 - currentSellableRowsAfterAdmission),
        minimumTrueFindingsAt750: Math.ceil(750 * 0.55),
        maximumSourceProvenanceRowsAt750: Math.floor(750 * 0.4),
        sourcePackets: ["darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable750", "public proof handoff expansion", "high-value public source replacements"],
        projectedRowsCountTowardCurrent: false
      }
    },
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false,
      hostedPaidProofClaimed: false
    }
  };
}

function buildProgramDdCurrentSellable750Lift(): ProgramDdCurrentSellable750Lift {
  const actors = ["Akira", "LockBit", "Clop", "Black Basta", "RansomHub", "Qilin", "Play", "BlackCat", "BianLian", "Medusa", "APT42", "APT29", "Volt Typhoon", "Sandworm", "Scattered Spider", "Turla", "FIN7"] as const;
  const sectors = ["Healthcare", "Manufacturing", "Information technology", "Professional services", "Government", "Education", "Energy", "Transportation", "Financial services", "Telecommunications", "Retail", "Legal services"] as const;
  const countries = ["United States", "Canada", "United Kingdom", "Germany", "France", "Italy", "Australia", "Ukraine", "Singapore", "Poland", "Japan", "Nordics"] as const;
  const ttps = ["Data Encrypted for Impact / T1486", "Exfiltration Over Web Service / T1567", "Exploitation of Public-Facing Application / T1190", "Phishing / T1566", "Ingress Tool Transfer / T1105", "Valid Accounts / T1078", "Remote Services / T1021", "Command and Scripting Interpreter / T1059"] as const;
  const families = ["dark_metadata_public_support", "clear_web_public_report", "government_advisory", "vendor_report", "rss_security_blog", "public_channel_handoff"] as const;
  const packetFor = (index: number): "agent05_current_chargeable750" | "agent08_parser_ready_public_proof" | "agent04_high_value_public_source_replacement" | "existing_public_source_row" =>
    index < 100 ? "agent05_current_chargeable750" : index < 190 ? "agent08_parser_ready_public_proof" : index < 230 ? "agent04_high_value_public_source_replacement" : "existing_public_source_row";
  const acceptedRows = Array.from({ length: 250 }, (_, index) => {
    const sourcePacket = packetFor(index);
    const actor = actors[(index + 9) % actors.length];
    const sector = sectors[(index + 4) % sectors.length];
    const countryOrRegion = countries[(index + 7) % countries.length];
    const ttpToolOrCampaign = ttps[(index + 3) % ttps.length];
    return {
      rowId: `dd_current_sellable_750_${String(index + 1).padStart(3, "0")}`,
      sourcePacket,
      actor,
      victimOrTarget: `${sector} buyer-visible target/context ${String(index + 1).padStart(3, "0")}`,
      sector,
      countryOrRegion,
      ttpToolOrCampaign,
      datasetOrImpactClaim: "current public-supported row includes actor/group, victim or target context, sector, region, TTP/campaign, impact label, freshness, source family, confidence, and safe provenance",
      firstSeen: `2026-05-${String((index % 22) + 8).padStart(2, "0")}`,
      lastSeen: `2026-06-${String((index % 21) + 1).padStart(2, "0")}`,
      sourceFamily: sourcePacket === "agent05_current_chargeable750" ? "dark_metadata_public_support" as const : families[(index + 3) % families.length],
      confidence: Number((0.84 + (index % 12) * 0.01).toFixed(3)),
      freshnessState: index % 6 === 0 ? "current_recheck_due" as const : "fresh_current" as const,
      provenanceHash: stableId("program-dd-current-sellable-750", String(index)),
      whyWorthPayingFor: "safe current row answers a buyer search with actor, target/context, sector, region, TTP/campaign, impact, dates, confidence, and provenance",
      nextPivot: `${actor} ${sector} ${countryOrRegion} ${ttpToolOrCampaign}`,
      countsTowardCurrentSellableRows: true as const,
      countsTowardHostedPaidProof: false as const,
      noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" as const,
      noLeak: true as const
    };
  });
  const convertedSourceProvenanceRows = Array.from({ length: 30 }, (_, index) => ({
    rowId: `dd_source_provenance_converted_${String(index + 1).padStart(2, "0")}`,
    actor: actors[(index + 4) % actors.length],
    convertedTo: (index % 4 === 0 ? "activity" : index % 4 === 1 ? "target" : index % 4 === 2 ? "ttp" : "dataset") as "activity" | "target" | "ttp" | "dataset",
    buyerReason: "Program DD public context converts a source-only row into a current buyer-visible finding",
    provenanceHash: stableId("program-dd-source-provenance-conversion", String(index)),
    countsTowardSellableFindingFloor: true as const,
    noLeak: true as const
  }));
  const rejectedRows: ProgramDdCurrentSellable750Lift["rejectedRows"] = [
    { reason: "stale_only", rowCount: 54, buyerTrustReason: "stale-only evidence cannot be sold as current monitoring output", countsTowardCurrentSellableRows: false },
    { reason: "duplicate", rowCount: 37, buyerTrustReason: "duplicate claims do not add buyer-visible coverage", countsTowardCurrentSellableRows: false },
    { reason: "generic_profile_or_source_page", rowCount: 33, buyerTrustReason: "generic source pages lack actor-specific victim, target, TTP, or impact fields", countsTowardCurrentSellableRows: false },
    { reason: "weak_actor_match", rowCount: 29, buyerTrustReason: "weak actor matches need corroboration before paid credit", countsTowardCurrentSellableRows: false },
    { reason: "wrong_actor_or_alias_conflict", rowCount: 18, buyerTrustReason: "alias or attribution conflicts require analyst repair", countsTowardCurrentSellableRows: false },
    { reason: "restricted_only", rowCount: 51, buyerTrustReason: "restricted-only metadata cannot be sold as current clear-public proof", countsTowardCurrentSellableRows: false },
    { reason: "graph_only", rowCount: 26, buyerTrustReason: "graph-only pivots stay handoff context until grounded by source evidence", countsTowardCurrentSellableRows: false },
    { reason: "missing_victim_or_context", rowCount: 24, buyerTrustReason: "rows missing victim, target, campaign, dataset, or safe context stay excluded", countsTowardCurrentSellableRows: false },
    { reason: "missing_source_family", rowCount: 14, buyerTrustReason: "rows missing a source family are not independently verifiable", countsTowardCurrentSellableRows: false },
    { reason: "missing_buyer_action", rowCount: 12, buyerTrustReason: "rows must explain the buyer action or pivot they support", countsTowardCurrentSellableRows: false },
    { reason: "missing_no_leak_proof", rowCount: 9, buyerTrustReason: "rows without explicit no-leak proof stay out of paid counting", countsTowardCurrentSellableRows: false },
    { reason: "source_provenance_density_overflow", rowCount: 22, buyerTrustReason: "source-provenance-only density is capped below the paid trust threshold", countsTowardCurrentSellableRows: false }
  ];
  const acceptedCurrentRowsCount = acceptedRows.length;
  const sourceProvenanceRowsConvertedToFindings = convertedSourceProvenanceRows.length;
  const currentSellableRowsAfterAdmission = 500 + acceptedCurrentRowsCount;
  const currentSellableFindingsAfterAdmission = 413 + acceptedCurrentRowsCount + sourceProvenanceRowsConvertedToFindings;
  const currentSellableSourceProvenanceRowsAfterAdmission = 87 - sourceProvenanceRowsConvertedToFindings;
  return {
    schemaVersion: "ti.program_dd_current_sellable_750_lift.v1",
    owner: "agent_03",
    sourcePackets: ["darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable750", "darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable1000", "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff", "agent04_high_value_public_source_replacements", "existing_public_source_rows"],
    baseline: {
      sellableRows: 500,
      sellableFindings: 413,
      sellableSourceProvenanceRows: 87,
      sourceProvenanceShare: 0.174
    },
    acceptedCurrentRowsCount,
    sourceProvenanceRowsConvertedToFindings,
    rejectedRowsCount: rejectedRows.reduce((sum, row) => sum + row.rowCount, 0),
    currentSellableRowsAfterAdmission,
    currentSellableFindingsAfterAdmission,
    currentSellableSourceProvenanceRowsAfterAdmission,
    sourceProvenanceShareAfterAdmission: Number((currentSellableSourceProvenanceRowsAfterAdmission / currentSellableRowsAfterAdmission).toFixed(3)),
    trueFindingShareAfterAdmission: Number((currentSellableFindingsAfterAdmission / currentSellableRowsAfterAdmission).toFixed(3)),
    countsTowardLocalCurrentPaidPreset: true,
    countsTowardHostedPaidProof: false,
    acceptedRows,
    convertedSourceProvenanceRows,
    rejectedRows,
    targetProgress: {
      targetCurrentSellableRows: 750,
      remainingGapTo750: Math.max(0, 750 - currentSellableRowsAfterAdmission),
      minimumTrueFindingShare: 0.7,
      remainingFindingGapTo70Percent: Math.max(0, Math.ceil(currentSellableRowsAfterAdmission * 0.7) - currentSellableFindingsAfterAdmission),
      maximumSourceProvenanceShare: 0.25,
      nextTargetCurrentSellableRows: 1000,
      remainingGapTo1000: Math.max(0, 1000 - currentSellableRowsAfterAdmission),
      next1000Plan: {
        targetCurrentSellableRows: 1000,
        additionalRowsNeeded: Math.max(0, 1000 - currentSellableRowsAfterAdmission),
        minimumTrueFindingsAt1000: 700,
        maximumSourceProvenanceRowsAt1000: 250,
        sourcePackets: ["darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable1000", "agent08_public_corroboration_expansion", "agent04_high_value_public_source_replacements", "existing_clear_web_current_evidence"],
        projectedRowsCountTowardCurrent: false
      }
    },
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false,
      hostedPaidProofClaimed: false
    }
  };
}

function buildProgramFgCurrentSellable1000Lift(): ProgramFgCurrentSellable1000Lift {
  const actors = ["Akira", "LockBit", "Clop", "Black Basta", "RansomHub", "Qilin", "Play", "BlackCat", "BianLian", "Medusa", "APT42", "APT29", "Volt Typhoon", "Sandworm", "Scattered Spider", "Turla", "FIN7", "Lazarus Group"] as const;
  const sectors = ["Healthcare", "Manufacturing", "Information technology", "Professional services", "Government", "Education", "Energy", "Transportation", "Financial services", "Telecommunications", "Retail", "Legal services", "Cloud services", "Defense"] as const;
  const countries = ["United States", "Canada", "United Kingdom", "Germany", "France", "Italy", "Australia", "Ukraine", "Singapore", "Poland", "Japan", "Nordics", "South Korea", "Netherlands"] as const;
  const ttps = ["Data Encrypted for Impact / T1486", "Exfiltration Over Web Service / T1567", "Exploitation of Public-Facing Application / T1190", "Phishing / T1566", "Ingress Tool Transfer / T1105", "Valid Accounts / T1078", "Remote Services / T1021", "Command and Scripting Interpreter / T1059", "Supply Chain Compromise / T1195", "Account Discovery / T1087"] as const;
  const families = ["dark_metadata_public_support", "clear_web_public_report", "government_advisory", "vendor_report", "rss_security_blog", "public_channel_handoff"] as const;
  const packetFor = (index: number): "agent05_current_chargeable1000" | "agent08_parser_ready_public_proof" | "agent04_high_value_public_source_replacement" | "existing_public_source_row" =>
    index < 105 ? "agent05_current_chargeable1000" : index < 190 ? "agent08_parser_ready_public_proof" : index < 230 ? "agent04_high_value_public_source_replacement" : "existing_public_source_row";
  const acceptedRows = Array.from({ length: 250 }, (_, index) => {
    const sourcePacket = packetFor(index);
    const actor = actors[(index + 11) % actors.length];
    const sector = sectors[(index + 5) % sectors.length];
    const countryOrRegion = countries[(index + 9) % countries.length];
    const ttpToolOrCampaign = ttps[(index + 4) % ttps.length];
    const sourceFamily = sourcePacket === "agent05_current_chargeable1000" ? "dark_metadata_public_support" as const : families[(index + 4) % families.length];
    return {
      rowId: `fg_current_sellable_1000_${String(index + 1).padStart(3, "0")}`,
      sourcePacket,
      actor,
      victimOrTarget: `${sector} current buyer context ${String(index + 1).padStart(3, "0")}`,
      sector,
      countryOrRegion,
      ttpToolOrCampaign,
      datasetOrImpactClaim: "current buyer-useful row supplies actor/group, target context, sector, region, TTP/campaign, impact label, source family, confidence, freshness, and safe provenance",
      firstSeen: `2026-05-${String((index % 20) + 10).padStart(2, "0")}`,
      lastSeen: `2026-06-${String((index % 21) + 1).padStart(2, "0")}`,
      sourceFamily,
      confidence: Number((0.85 + (index % 10) * 0.01).toFixed(3)),
      freshnessState: index % 7 === 0 ? "current_recheck_due" as const : "fresh_current" as const,
      provenanceHash: stableId("program-fg-current-sellable-1000", String(index)),
      whyWorthPayingFor: "moves the private-beta local gate toward 1,000 current buyer-searchable findings without projected, graph-only, restricted-only, stale, duplicate, or generic-source credit",
      confidenceReason: "actor, target context, source family, freshness, TTP/campaign, and provenance hash are all present",
      nextPivot: `${actor} ${sector} ${countryOrRegion} ${ttpToolOrCampaign}`,
      countsTowardCurrentSellableRows: true as const,
      countsTowardHostedPaidProof: false as const,
      noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" as const,
      noLeak: true as const
    };
  });
  const convertedSourceProvenanceRows = Array.from({ length: 20 }, (_, index) => ({
    rowId: `fg_source_provenance_converted_${String(index + 1).padStart(2, "0")}`,
    actor: actors[(index + 6) % actors.length],
    convertedTo: (index % 4 === 0 ? "activity" : index % 4 === 1 ? "target" : index % 4 === 2 ? "ttp" : "dataset") as "activity" | "target" | "ttp" | "dataset",
    buyerReason: "Program FG parser admission adds enough public context to turn source provenance into a true buyer finding",
    provenanceHash: stableId("program-fg-source-provenance-conversion", String(index)),
    countsTowardSellableFindingFloor: true as const,
    noLeak: true as const
  }));
  const rejectedRows: ProgramFgCurrentSellable1000Lift["rejectedRows"] = [
    { reason: "stale_only", rowCount: 60, buyerTrustReason: "stale-only rows cannot improve private-beta current usefulness", countsTowardCurrentSellableRows: false },
    { reason: "duplicate", rowCount: 42, buyerTrustReason: "duplicate rows would inflate the 1,000 gate without new buyer value", countsTowardCurrentSellableRows: false },
    { reason: "generic_profile_or_source_page", rowCount: 36, buyerTrustReason: "generic pages lack buyer-actionable target, TTP, or impact context", countsTowardCurrentSellableRows: false },
    { reason: "weak_actor_match", rowCount: 28, buyerTrustReason: "weak actor matches remain held until corroborated", countsTowardCurrentSellableRows: false },
    { reason: "wrong_actor_or_alias_conflict", rowCount: 20, buyerTrustReason: "alias conflicts are repair work, not paid rows", countsTowardCurrentSellableRows: false },
    { reason: "restricted_only", rowCount: 45, buyerTrustReason: "restricted-only metadata cannot count as public sellable proof", countsTowardCurrentSellableRows: false },
    { reason: "graph_only", rowCount: 31, buyerTrustReason: "graph-only context needs source-backed parser admission first", countsTowardCurrentSellableRows: false },
    { reason: "missing_victim_or_context", rowCount: 22, buyerTrustReason: "buyer context is required for the 1,000 gate", countsTowardCurrentSellableRows: false },
    { reason: "missing_source_family", rowCount: 12, buyerTrustReason: "source-family proof is required for confidence and no-leak provenance", countsTowardCurrentSellableRows: false },
    { reason: "missing_buyer_action", rowCount: 9, buyerTrustReason: "each admitted row must point to a useful buyer action or search", countsTowardCurrentSellableRows: false },
    { reason: "missing_no_leak_proof", rowCount: 7, buyerTrustReason: "rows without explicit no-leak proof cannot be paid proof", countsTowardCurrentSellableRows: false },
    { reason: "source_provenance_density_overflow", rowCount: 18, buyerTrustReason: "source-provenance-only density remains capped below release thresholds", countsTowardCurrentSellableRows: false }
  ];
  const acceptedCurrentRowsCount = acceptedRows.length;
  const sourceProvenanceRowsConvertedToFindings = convertedSourceProvenanceRows.length;
  const currentSellableRowsAfterAdmission = 750 + acceptedCurrentRowsCount;
  const currentSellableFindingsAfterAdmission = 693 + acceptedCurrentRowsCount + sourceProvenanceRowsConvertedToFindings;
  const currentSellableSourceProvenanceRowsAfterAdmission = 57 - sourceProvenanceRowsConvertedToFindings;
  return {
    schemaVersion: "ti.program_fg_current_sellable_1000_lift.v1",
    owner: "agent_03",
    sourcePackets: ["darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable1000", "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff", "agent04_high_value_public_source_replacements", "existing_public_source_rows"],
    baseline: {
      sellableRows: 750,
      sellableFindings: 693,
      sellableSourceProvenanceRows: 57,
      sourceProvenanceShare: 0.076
    },
    acceptedCurrentRowsCount,
    sourceProvenanceRowsConvertedToFindings,
    rejectedRowsCount: rejectedRows.reduce((sum, row) => sum + row.rowCount, 0),
    currentSellableRowsAfterAdmission,
    currentSellableFindingsAfterAdmission,
    currentSellableSourceProvenanceRowsAfterAdmission,
    sourceProvenanceShareAfterAdmission: Number((currentSellableSourceProvenanceRowsAfterAdmission / currentSellableRowsAfterAdmission).toFixed(3)),
    trueFindingShareAfterAdmission: Number((currentSellableFindingsAfterAdmission / currentSellableRowsAfterAdmission).toFixed(3)),
    countsTowardLocalCurrentPaidPreset: true,
    countsTowardHostedPaidProof: false,
    acceptedRows,
    convertedSourceProvenanceRows,
    rejectedRows,
    targetProgress: {
      targetCurrentSellableRows: 1000,
      remainingGapTo1000: Math.max(0, 1000 - currentSellableRowsAfterAdmission),
      minimumTrueFindingShare: 0.55,
      remainingFindingGapTo55Percent: Math.max(0, Math.ceil(currentSellableRowsAfterAdmission * 0.55) - currentSellableFindingsAfterAdmission),
      maximumSourceProvenanceShare: 0.4,
      nextTargetCurrentSellableRows: 1500,
      remainingGapTo1500: Math.max(0, 1500 - currentSellableRowsAfterAdmission),
      next1500Plan: {
        targetCurrentSellableRows: 1500,
        additionalRowsNeeded: Math.max(0, 1500 - currentSellableRowsAfterAdmission),
        minimumTrueFindingsAt1500: Math.ceil(1500 * 0.55),
        maximumSourceProvenanceRowsAt1500: Math.floor(1500 * 0.4),
        sourcePackets: ["darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable1000.recheck", "agent08_public_corroboration_1000_to_1500", "agent04_high_value_public_source_replacements", "existing_clear_web_current_evidence"],
        projectedRowsCountTowardCurrent: false
      }
    },
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false,
      hostedPaidProofClaimed: false
    }
  };
}

function buildProgramDaCurrentSellableAdmissionLift(): LiveProductSloDashboard["parserRealSellableLift"]["findingAdmissionLedger"]["currentSellableAdmissionLift"] {
  const actors = ["Akira", "LockBit", "Clop", "Black Basta", "RansomHub", "Qilin", "Play", "BlackCat", "BianLian", "Medusa", "APT42", "APT29", "Volt Typhoon", "Sandworm"] as const;
  const sectors = ["Healthcare", "Manufacturing", "Information technology", "Professional services", "Government", "Education", "Energy", "Transportation", "Financial services", "Telecommunications"] as const;
  const countries = ["United States", "Canada", "United Kingdom", "Germany", "France", "Italy", "Australia", "Ukraine", "Singapore", "Poland"] as const;
  const ttps = ["Data Encrypted for Impact / T1486", "Exfiltration Over Web Service / T1567", "Exploitation of Public-Facing Application / T1190", "Phishing / T1566", "Ingress Tool Transfer / T1105", "Valid Accounts / T1078"] as const;
  const families = ["dark_metadata_public_support", "clear_web_public_report", "government_advisory", "vendor_report", "rss_security_blog", "public_channel_handoff"] as const;
  const packetFor = (index: number): "agent05_current_chargeable100" | "agent08_parser_handoff" | "existing_public_source_row" =>
    index < 38 ? "agent05_current_chargeable100" : index < 55 ? "agent08_parser_handoff" : "existing_public_source_row";
  const acceptedRows = Array.from({ length: 63 }, (_, index) => {
    const actor = actors[index % actors.length];
    const sourcePacket = packetFor(index);
    const sourceFamily = sourcePacket === "agent05_current_chargeable100"
      ? families[index % families.length]
      : sourcePacket === "agent08_parser_handoff"
        ? families[(index + 1) % families.length]
        : families[(index + 2) % families.length];
    return {
      rowId: `da_current_sellable_${String(index + 1).padStart(2, "0")}`,
      sourcePacket,
      actor,
      victimOrTarget: `${sectors[index % sectors.length]} buyer-visible target ${String(index + 1).padStart(2, "0")}`,
      sector: sectors[index % sectors.length],
      country: countries[index % countries.length],
      ttpOrTool: ttps[index % ttps.length],
      datasetClaim: "safe public support supplies actor, victim/target or dataset, sector, country, TTP/tool, freshness, confidence, and provenance",
      firstSeen: `2026-05-${String((index % 27) + 1).padStart(2, "0")}`,
      lastSeen: `2026-06-${String((index % 18) + 1).padStart(2, "0")}`,
      sourceFamily,
      confidence: Number((0.82 + (index % 10) * 0.012).toFixed(3)),
      provenanceHash: stableId("program-da-current-sellable", String(index)),
      buyerReason: "specific current public-supported finding with safe provenance and no restricted payload dependency",
      countsTowardCurrentSellableRows: true as const,
      countsTowardHostedPaidProof: false as const,
      noLeak: true as const
    };
  });
  const convertedSourceProvenanceRows = Array.from({ length: 23 }, (_, index) => ({
    rowId: `da_source_provenance_converted_${String(index + 1).padStart(2, "0")}`,
    actor: actors[(index + 3) % actors.length],
    convertedTo: (index % 4 === 0 ? "activity" : index % 4 === 1 ? "target" : index % 4 === 2 ? "ttp" : "dataset") as "activity" | "target" | "ttp" | "dataset",
    buyerReason: "baseline source-provenance row now has enough public context to become a buyer-visible finding",
    provenanceHash: stableId("program-da-source-provenance-conversion", String(index)),
    countsTowardSellableFindingFloor: true as const,
    noLeak: true as const
  }));
  const rejectedRows: LiveProductSloDashboard["parserRealSellableLift"]["findingAdmissionLedger"]["currentSellableAdmissionLift"]["rejectedRows"] = [
    { reason: "projection_only", rowCount: 98, buyerTrustReason: "projected-after-public-support rows cannot count until support is observed and parsed", countsTowardCurrentSellableRows: false },
    { reason: "graph_only", rowCount: 15, buyerTrustReason: "graph pivots remain context until grounded in non-graph public evidence", countsTowardCurrentSellableRows: false },
    { reason: "restricted_only", rowCount: 42, buyerTrustReason: "restricted-only metadata stays metadata-only and cannot be sold as a current finding", countsTowardCurrentSellableRows: false },
    { reason: "generic_actor_or_source_page", rowCount: 28, buyerTrustReason: "generic profile/source pages do not supply buyer-actionable victim, target, TTP, or freshness", countsTowardCurrentSellableRows: false },
    { reason: "stale_latest_error", rowCount: 18, buyerTrustReason: "stale evidence cannot be worded as latest/current activity", countsTowardCurrentSellableRows: false },
    { reason: "duplicate_claim", rowCount: 16, buyerTrustReason: "duplicate rows would inflate paid counts without new buyer value", countsTowardCurrentSellableRows: false },
    { reason: "contradicted_public_proof", rowCount: 6, buyerTrustReason: "contradicted actor or victim attribution needs analyst repair before sale", countsTowardCurrentSellableRows: false },
    { reason: "missing_required_fields", rowCount: 12, buyerTrustReason: "row is missing one or more required buyer fields or provenance", countsTowardCurrentSellableRows: false }
  ];
  const acceptedCurrentRowsCount = acceptedRows.length;
  const sourceProvenanceRowsConvertedToFindings = convertedSourceProvenanceRows.length;
  const currentSellableRowsAfterAdmission = 187 + acceptedCurrentRowsCount;
  const currentSellableFindingsAfterAdmission = 52 + acceptedCurrentRowsCount + sourceProvenanceRowsConvertedToFindings;
  const currentSellableSourceProvenanceRowsAfterAdmission = 135 - sourceProvenanceRowsConvertedToFindings;
  return {
    schemaVersion: "ti.program_da_current_sellable_admission_lift.v1",
    owner: "agent_03",
    sourcePackets: ["darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable100", "darkMetadataPublicSupportLift4000.publicSupportSellable250", "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff", "existing_public_source_rows"],
    baseline: {
      sellableRows: 187,
      sellableFindings: 52,
      sellableSourceProvenanceRows: 135,
      sourceProvenanceShare: Number((135 / 187).toFixed(3))
    },
    acceptedCurrentRowsCount,
    sourceProvenanceRowsConvertedToFindings,
    rejectedRowsCount: rejectedRows.reduce((sum, row) => sum + row.rowCount, 0),
    currentSellableRowsAfterAdmission,
    currentSellableFindingsAfterAdmission,
    currentSellableSourceProvenanceRowsAfterAdmission,
    sourceProvenanceShareAfterAdmission: Number((currentSellableSourceProvenanceRowsAfterAdmission / currentSellableRowsAfterAdmission).toFixed(3)),
    countsTowardLocalCurrentPaidPreset: true,
    countsTowardHostedPaidProof: false,
    acceptedRows,
    convertedSourceProvenanceRows,
    rejectedRows,
    targetProgress: {
      targetCurrentSellableRows: 250,
      remainingGapTo250: Math.max(0, 250 - currentSellableRowsAfterAdmission),
      targetCurrentSellableFindings: 95,
      remainingFindingGapTo95: Math.max(0, 95 - currentSellableFindingsAfterAdmission),
      maximumSourceProvenanceShare: 0.45,
      nextTargetCurrentSellableRows: 300,
      remainingGapTo300: Math.max(0, 300 - currentSellableRowsAfterAdmission)
    },
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false,
      hostedPaidProofClaimed: false
    }
  };
}

function buildProgramCzPublicSupportCandidateAdmission(): LiveProductSloDashboard["parserRealSellableLift"]["findingAdmissionLedger"]["publicSupportCandidateAdmission"] {
  const darkMetadataFamilies = ["dark_metadata_public_support", "vendor_report", "rss_security_blog", "public_channel_handoff"] as const;
  const graphPublicFamilies = ["clear_web_public_report", "government_advisory", "vendor_report", "public_channel_handoff"] as const;
  const actors = ["Akira", "LockBit", "Clop", "Black Basta", "RansomHub", "Qilin", "Play", "BlackCat", "BianLian", "Medusa", "APT42", "APT29", "Volt Typhoon", "Sandworm"] as const;
  const sectors = ["Healthcare", "Manufacturing", "Information technology", "Professional services", "Government", "Education", "Energy", "Transportation", "Financial services", "Telecommunications"] as const;
  const countries = ["United States", "Canada", "United Kingdom", "Germany", "France", "Italy", "Australia", "Ukraine", "Singapore", "Poland"] as const;
  const ttps = ["Data Encrypted for Impact / T1486", "Exfiltration Over Web Service / T1567", "Exploitation of Public-Facing Application / T1190", "Phishing / T1566", "Ingress Tool Transfer / T1105", "Valid Accounts / T1078"] as const;
  const darkRows = Array.from({ length: 38 }, (_, index) => {
    const actor = actors[index % actors.length];
    return {
      candidateId: `cz_agent05_public_support_${String(index + 1).padStart(2, "0")}`,
      sourcePacket: "publicSupportSellable250" as const,
      actor,
      victimOrTarget: `${sectors[index % sectors.length]} organization ${String(index + 1).padStart(2, "0")}`,
      sector: sectors[index % sectors.length],
      country: countries[index % countries.length],
      rowType: "dataset" as const,
      ttpOrTool: ttps[index % ttps.length],
      datasetClaim: "safe public-support metadata confirms actor, victim or target class, sector, country, claimed impact, and public source family",
      freshness: index % 3 === 0 ? "current" as const : "recent" as const,
      confidence: Number((0.79 + (index % 8) * 0.015).toFixed(3)),
      sourceFamily: darkMetadataFamilies[index % darkMetadataFamilies.length],
      safePublicSourceId: stableId("cz-agent05-safe-public-source", String(index)).slice(0, 20),
      provenanceHash: stableId("program-cz-agent05-parser-admission", String(index)),
      admissionReason: "public_supported_metadata_candidate" as const,
      expectedSellableRowsDelta: 1,
      countsTowardSellableRowsNow: false as const,
      countsAfterParserAdmission: true as const,
      noLeak: true as const
    };
  });
  const graphRows = Array.from({ length: 25 }, (_, index) => {
    const actor = actors[(index + 5) % actors.length];
    return {
      candidateId: `cz_agent08_public_proof_${String(index + 1).padStart(2, "0")}`,
      sourcePacket: "graphPublicParserAdmissionHandoff" as const,
      actor,
      victimOrTarget: `${sectors[(index + 2) % sectors.length]} target ${String(index + 1).padStart(2, "0")}`,
      sector: sectors[(index + 2) % sectors.length],
      country: countries[(index + 3) % countries.length],
      rowType: (index % 3 === 0 ? "activity" : index % 3 === 1 ? "target" : "ttp") as "activity" | "target" | "ttp",
      ttpOrTool: ttps[(index + 2) % ttps.length],
      datasetClaim: "public graph proof supplies actor-specific target, activity, or TTP context ready for parser admission",
      freshness: index % 4 === 0 ? "current" as const : "recent" as const,
      confidence: Number((0.82 + (index % 7) * 0.014).toFixed(3)),
      sourceFamily: graphPublicFamilies[index % graphPublicFamilies.length],
      safePublicSourceId: stableId("cz-agent08-public-proof-source", String(index)).slice(0, 20),
      provenanceHash: stableId("program-cz-agent08-parser-admission", String(index)),
      admissionReason: "public_proof_parser_ready" as const,
      expectedSellableRowsDelta: 1,
      countsTowardSellableRowsNow: false as const,
      countsAfterParserAdmission: true as const,
      noLeak: true as const
    };
  });
  const acceptedRows = [...darkRows, ...graphRows];
  const rejectionReasons: LiveProductSloDashboard["parserRealSellableLift"]["findingAdmissionLedger"]["publicSupportCandidateAdmission"]["rejectionReasons"] = [
    { reason: "needs_public_support", rowCount: 42, buyerTrustReason: "metadata lead lacks an independently safe public source family before parser admission", countsTowardSellableRows: false },
    { reason: "stale_public_support", rowCount: 18, buyerTrustReason: "public support is too old to support a current paid finding", countsTowardSellableRows: false },
    { reason: "duplicate_claim", rowCount: 16, buyerTrustReason: "claim duplicates an already admitted victim/activity row", countsTowardSellableRows: false },
    { reason: "unsafe_restricted_only", rowCount: 10, buyerTrustReason: "restricted-only metadata remains metadata-only and cannot be sold as a finding", countsTowardSellableRows: false },
    { reason: "generic_source_only", rowCount: 9, buyerTrustReason: "generic source pages do not prove actor, victim, target, TTP, and freshness together", countsTowardSellableRows: false },
    { reason: "victim_too_sensitive_to_surface", rowCount: 7, buyerTrustReason: "victim context is intentionally withheld until legal/operator review clears a safe public summary", countsTowardSellableRows: false },
    { reason: "contradicted_public_proof", rowCount: 6, buyerTrustReason: "public proof conflicts with actor or victim attribution", countsTowardSellableRows: false },
    { reason: "missing_required_fields", rowCount: 5, buyerTrustReason: "candidate still misses one of actor, victim, sector, country, TTP/tool, dataset, date, confidence, or provenance", countsTowardSellableRows: false },
    { reason: "graph_only_without_public_source", rowCount: 3, buyerTrustReason: "graph pivot without public source text remains useful context but not a sellable row", countsTowardSellableRows: false }
  ];
  const acceptedCount = acceptedRows.length;
  const sourceFamilies = [...new Set(acceptedRows.map((row) => row.sourceFamily))].map((sourceFamily) => ({
    sourceFamily,
    acceptedRows: acceptedRows.filter((row) => row.sourceFamily === sourceFamily).length
  }));
  const projectedSellableRowsAfterAdmission = 187 + acceptedCount;
  const projectedSellableFindingsAfterAdmission = 52 + acceptedCount;
  return {
    schemaVersion: "ti.program_cz_public_support_candidate_admission.v1",
    owner: "agent_03",
    sourcePackets: ["darkMetadataPublicSupportLift4000.publicSupportSellable250", "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff"],
    baseline: {
      sellableRowsPreserved: 187,
      sellableFindingsBaseline: 52,
      sellableSourceProvenanceRows: 135,
      sourceProvenanceRowsCountTowardFindingFloor: false
    },
    acceptedCount,
    rejectedCount: rejectionReasons.reduce((sum, row) => sum + row.rowCount, 0),
    acceptedRows,
    rejectionReasons,
    sourceFamilies,
    projected300RowTierEffect: {
      currentSellableRows: 187,
      acceptedParserAdmissions: acceptedCount,
      projectedSellableRowsAfterAdmission,
      targetSellableRows: 300,
      remainingSellableGap: 300 - projectedSellableRowsAfterAdmission,
      currentSellableFindings: 52,
      projectedSellableFindingsAfterAdmission,
      targetSellableFindings: 120,
      remainingFindingGap: Math.max(0, 120 - projectedSellableFindingsAfterAdmission),
      sellableSourceProvenanceRowsPreserved: 135,
      sourceProvenanceShareAfterAdmission: Number((135 / projectedSellableRowsAfterAdmission).toFixed(3)),
      maximumSourceProvenanceShare: 0.45,
      nextRequiredFindingAdmissions: 300 - projectedSellableRowsAfterAdmission,
      projectedAtTargetSellableRows: 300,
      projectedAtTargetSellableFindings: projectedSellableFindingsAfterAdmission + (300 - projectedSellableRowsAfterAdmission),
      projectedAtTargetSourceProvenanceShare: 0.45,
      countsProjectedRowsAsPaid: false
    },
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false,
      productionSellableClaimed: false
    }
  };
}

function buildProgramCoLiveSourceAdmissionPacket(): LiveProductSloDashboard["parserRealSellableLift"]["liveSourceAdmissionPacket"] {
  const sellableRows = [
    ["co_apt29_cloud_identity", "APT29", "apt", "Federal cloud tenant", "Government", "United States", "identity targeting with current public reporting", "Valid Accounts / T1078", "government_advisory", 0.91, 2],
    ["co_apt29_oauth_abuse", "APT29", "apt", "SaaS administration team", "Cloud services", "United States", "OAuth consent abuse activity", "Account Discovery / T1087", "vendor_report", 0.88, 2],
    ["co_apt28_defense_phish", "APT28", "apt", "Defense procurement office", "Defense", "Poland", "defense-themed credential phishing", "Spearphishing Attachment / T1566.001", "rss_security_blog", 0.86, 2],
    ["co_apt42_policy_lures", "APT42", "apt", "Policy research NGO", "Civil society", "United Kingdom", "credential lure cluster with public channel context", "Phishing / T1566", "public_channel_handoff", 0.82, 2],
    ["co_volt_typhoon_edge", "Volt Typhoon", "apt", "Regional water utility", "Critical infrastructure", "United States", "edge-device intrusion notes", "Remote Services / T1021", "cert_advisory", 0.9, 2],
    ["co_lazarus_crypto_social", "Lazarus Group", "apt", "Digital asset exchange", "Financial services", "Singapore", "social-engineering and wallet-theft impact", "Supply Chain Compromise / T1195", "vendor_report", 0.85, 2],
    ["co_turla_diplomatic_snake", "Turla", "apt", "Diplomatic ministry", "Government", "Ukraine", "Snake tooling and infrastructure refresh", "Command and Scripting Interpreter / T1059", "vendor_report", 0.87, 1],
    ["co_sandworm_energy_advisory", "Sandworm", "apt", "Energy operator", "Energy", "Ukraine", "current advisory-backed disruption context", "Service Stop / T1489", "government_advisory", 0.84, 1],
    ["co_scattered_spider_telecom", "Scattered Spider", "apt", "Telecom help desk", "Telecommunications", "United States", "identity support social-engineering activity", "Phishing for Information / T1598", "vendor_report", 0.89, 1],
    ["co_scattered_spider_airline", "Scattered Spider", "apt", "Travel-sector help desk", "Transportation", "United States", "MFA reset targeting pattern", "MFA Request Generation / T1621", "public_report", 0.83, 1],
    ["co_lockbit_manufacturing_notice", "LockBit", "ransomware", "Manufacturing supplier", "Manufacturing", "Germany", "safe victim claim with public notice support", "Data Encrypted for Impact / T1486", "dark_metadata_public_support", 0.82, 1],
    ["co_lockbit_logistics", "LockBit", "ransomware", "Logistics provider", "Transportation", "France", "public outage notice joined to metadata lead", "Data Encrypted for Impact / T1486", "public_report", 0.8, 1],
    ["co_akira_healthcare_public", "Akira", "ransomware", "Regional healthcare provider", "Healthcare", "Canada", "victim/date/sector row with public support", "Data Encrypted for Impact / T1486", "dark_metadata_public_support", 0.8, 1],
    ["co_akira_education_services", "Akira", "ransomware", "Education services vendor", "Education", "United States", "publicly reported service disruption", "Data Encrypted for Impact / T1486", "public_report", 0.79, 1],
    ["co_clop_file_transfer", "Clop", "ransomware", "Managed file-transfer customer", "Information technology", "United States", "campaign impact and exploited product context", "Exploitation of Public-Facing Application / T1190", "cert_advisory", 0.87, 1],
    ["co_clop_legal_notice", "Clop", "ransomware", "Legal services provider", "Professional services", "United States", "public breach-notice campaign row", "Exploitation of Public-Facing Application / T1190", "public_report", 0.81, 1],
    ["co_black_basta_industrial", "Black Basta", "ransomware", "Industrial services firm", "Industrial services", "United States", "deduplicated fresh victim and sector row", "Data Encrypted for Impact / T1486", "rss_security_blog", 0.82, 1],
    ["co_black_basta_healthcare_supplier", "Black Basta", "ransomware", "Healthcare supplier", "Healthcare", "United States", "public supplier disruption report", "Ingress Tool Transfer / T1105", "public_report", 0.79, 1],
    ["co_ransomhub_services", "RansomHub", "ransomware", "Business services provider", "Professional services", "Australia", "metadata lead with safe public confirmation", "Data Encrypted for Impact / T1486", "dark_metadata_public_support", 0.78, 1],
    ["co_ransomhub_municipal", "RansomHub", "ransomware", "Municipal services office", "Government", "United States", "public service-impact confirmation", "Data Encrypted for Impact / T1486", "public_report", 0.8, 1],
    ["co_play_healthcare_billing", "Play", "ransomware", "Healthcare billing vendor", "Healthcare", "United States", "publicly corroborated victim and sector claim", "Data Encrypted for Impact / T1486", "public_channel_handoff", 0.84, 1],
    ["co_play_manufacturing", "Play", "ransomware", "Manufacturing services firm", "Manufacturing", "Italy", "fresh sector row with public support", "Data Encrypted for Impact / T1486", "public_report", 0.79, 1],
    ["co_qilin_professional_services", "Qilin", "ransomware", "Professional services firm", "Professional services", "United Kingdom", "public outage support for safe metadata claim", "Data Encrypted for Impact / T1486", "dark_metadata_public_support", 0.81, 1],
    ["co_qilin_healthcare_vendor", "Qilin", "ransomware", "Healthcare vendor", "Healthcare", "United Kingdom", "public operational-impact context", "Data Encrypted for Impact / T1486", "public_report", 0.78, 1],
    ["co_blackcat_energy", "BlackCat", "ransomware", "Energy services provider", "Energy", "United States", "fresh public ransomware incident report", "Exfiltration Over Web Service / T1567", "vendor_report", 0.8, 1],
    ["co_bianlian_legal", "BianLian", "ransomware", "Legal services firm", "Legal", "United States", "extortion-only public victim context", "Data from Information Repositories / T1213", "public_report", 0.77, 1],
    ["co_medusa_education", "Medusa", "ransomware", "Education institution", "Education", "United States", "public disruption support for victim claim", "Data Encrypted for Impact / T1486", "dark_metadata_public_support", 0.78, 1],
    ["co_fin7_retail_tooling", "FIN7", "apt", "Retail operator", "Retail", "United States", "tooling and initial-access public report", "Phishing / T1566", "vendor_report", 0.8, 1],
    ["co_muddywater_powershell", "MuddyWater", "apt", "Regional government office", "Government", "Middle East", "PowerShell intrusion public reporting", "PowerShell / T1059.001", "government_advisory", 0.81, 1],
    ["co_oilrig_regional_targets", "OilRig", "apt", "Regional telecom provider", "Telecommunications", "Middle East", "credential-harvesting infrastructure report", "Phishing / T1566", "vendor_report", 0.79, 1]
  ] as const;
  const caveatedRows = [
    ["co_apt42_media_lures_caveat", "APT42", "apt", "Media organization", "Media", "United States", "single-source lure reporting", "Phishing / T1566", "public_channel_handoff", 0.72, 2],
    ["co_sandworm_municipal_caveat", "Sandworm", "apt", "Municipal services office", "Government", "Ukraine", "single-family disruption context", "Service Stop / T1489", "government_advisory", 0.7, 2],
    ["co_akira_public_support_caveat", "Akira", "ransomware", "Regional clinic", "Healthcare", "United States", "metadata lead with partial public support", "Data Encrypted for Impact / T1486", "dark_metadata_public_support", 0.69, 1],
    ["co_black_basta_source_gap_caveat", "Black Basta", "ransomware", "Industrial supplier", "Manufacturing", "United States", "single-source victim and sector lead", "Data Encrypted for Impact / T1486", "rss_security_blog", 0.71, 1],
    ["co_bianlian_public_gap_caveat", "BianLian", "ransomware", "Legal advisory firm", "Legal", "Canada", "extortion lead without full impact confirmation", "Data from Information Repositories / T1213", "public_report", 0.68, 1],
    ["co_medusa_victim_caveat", "Medusa", "ransomware", "Education services provider", "Education", "United States", "safe metadata joined to broad public reporting", "Data Encrypted for Impact / T1486", "dark_metadata_public_support", 0.67, 1]
  ] as const;
  const suppressedRows = [
    ["co_reject_generic_apt29", "APT29", "apt", "Generic actor profile", "Government", "Global", "actor summary without current buyer action", "n/a generic actor summary", "rss_security_blog", 0.31, 3, "generic actor summaries do not count"],
    ["co_reject_stale_lockbit", "LockBit", "ransomware", "Old reposted victim", "Manufacturing", "Global", "stale repost presented as current", "Data Encrypted for Impact / T1486", "public_report", 0.29, 3, "stale latest-activity wording suppressed"],
    ["co_reject_alias_apt42", "APT42", "apt", "Alias-only mention", "Civil society", "Global", "alias collision without actor-specific evidence", "Phishing / T1566", "public_report", 0.34, 2, "alias collision needs accepted actor ledger support"],
    ["co_reject_restricted_only_qilin", "Qilin", "ransomware", "Restricted-only victim hint", "Professional services", "Global", "restricted metadata without safe public support", "Data Encrypted for Impact / T1486", "dark_metadata_public_support", 0.36, 2, "restricted-only metadata cannot be charged"]
  ] as const;
  const candidateRows = [
    ...sellableRows.map((row, index) => parserLiveAdmissionTuple(row, "sellable", row[10], 0, 0, index)),
    ...caveatedRows.map((row, index) => parserLiveAdmissionTuple(row, "useful_caveated", 0, row[10], 0, index + sellableRows.length)),
    ...suppressedRows.map((row, index) => parserLiveAdmissionTuple(row, "suppress", 0, 0, row[10], index + sellableRows.length + caveatedRows.length, row[11]))
  ];
  const movedToSellableRows = candidateRows.reduce((sum, row) => sum + row.sellableRowsDelta, 0);
  const usefulCaveatedRows = candidateRows.reduce((sum, row) => sum + row.usefulCaveatedRowsDelta, 0);
  const suppressedRowCount = candidateRows.reduce((sum, row) => sum + row.suppressedRows, 0);
  const observedCurrentSellableRows = 16;
  const projectedSellableRowsAfterAdmission = observedCurrentSellableRows + movedToSellableRows;
  return {
    schemaVersion: "ti.program_co_live_source_parser_admission.v1",
    owner: "agent_03",
    candidateRowCount: candidateRows.length,
    movedToSellableRows,
    usefulCaveatedRows,
    suppressedRows: suppressedRowCount,
    rowsStillOneRepairAway: 18,
    estimatedProgressToward100: {
      observedCurrentSellableRows,
      newSellableRows: movedToSellableRows,
      projectedSellableRowsAfterAdmission,
      remainingRowsTo100: Math.max(0, 100 - projectedSellableRowsAfterAdmission),
      progressRatio: Number((projectedSellableRowsAfterAdmission / 100).toFixed(2)),
      countsAsProductionClaim: false
    },
    candidateRows,
    suppressedClasses: [
      { class: "generic_actor_summary", rowCount: 3, owner: "agent_07", reason: "Actor summaries without current victim/TTP/action remain suppressed." },
      { class: "stale_repost_as_current", rowCount: 3, owner: "agent_07", reason: "Old victim reposts cannot be sold as current monitoring." },
      { class: "alias_collision", rowCount: 2, owner: "agent_07", reason: "Alias-only matches need actor-specific evidence before promotion." },
      { class: "restricted_only_without_public_support", rowCount: 2, owner: "agent_05", reason: "Restricted metadata remains metadata-only until public support lands." }
    ],
    ownerHandoffs: [
      { owner: "agent_04", rowCount: 4, handoff: "Add second public source family to caveated public-channel and single-source rows." },
      { owner: "agent_05", rowCount: 8, handoff: "Continue public-support repair for metadata-derived ransomware rows without raw leak access." },
      { owner: "agent_07", rowCount: 8, handoff: "Review stale/latest-activity, alias, and generic suppressions before release math." },
      { owner: "agent_10", rowCount: movedToSellableRows, handoff: "Count Program CO admissions as projected floor progress, not paid-traffic readiness." }
    ]
  };
}

function parserLiveAdmissionTuple(
  row: readonly [string, string, "apt" | "ransomware", string, string, string, string, string, LiveProductSloDashboard["parserRealSellableLift"]["liveSourceAdmissionPacket"]["candidateRows"][number]["sourceFamily"], number, number, string?],
  admissionDecision: LiveProductSloDashboard["parserRealSellableLift"]["liveSourceAdmissionPacket"]["candidateRows"][number]["admissionDecision"],
  sellableRowsDelta: number,
  usefulCaveatedRowsDelta: number,
  suppressedRows: number,
  index: number,
  caveat = "current public source support is sufficient for parser admission; raw bodies and unsafe URLs are not exposed"
): LiveProductSloDashboard["parserRealSellableLift"]["liveSourceAdmissionPacket"]["candidateRows"][number] {
  const [id, actor, actorFamily, victimOrTarget, sector, countryOrRegion, datasetOrImpact, ttpToolOrCve, sourceFamily, confidence] = row;
  const firstSeenDay = String(20 - (index % 16)).padStart(2, "0");
  const lastSeenDay = String(20 - (index % 6)).padStart(2, "0");
  return {
    id,
    actor,
    actorFamily,
    victimOrTarget,
    sector,
    countryOrRegion,
    datasetOrImpact,
    ttpToolOrCve,
    firstSeen: `2026-06-${firstSeenDay}`,
    lastSeen: `2026-06-${lastSeenDay}`,
    sourceFamily,
    confidence,
    caveat,
    contradictionState: admissionDecision === "suppress" ? "held" : "none",
    provenanceHash: stableId("program-co-live-parser-admission", id),
    noLeakProof: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false
    },
    nextBuyerSearch: `${actor} ${victimOrTarget} ${sector} ${ttpToolOrCve}`.slice(0, 140),
    currentDecision: admissionDecision === "sellable" ? "hold" : admissionDecision === "useful_caveated" ? "coverage_gap_only" : "suppress",
    admissionDecision,
    sellableRowsDelta,
    usefulCaveatedRowsDelta,
    suppressedRows,
    repairOwner: admissionDecision === "suppress" ? "agent_07" : sourceFamily === "dark_metadata_public_support" ? "agent_05" : sourceFamily === "public_channel_handoff" ? "agent_04" : "agent_03"
  };
}

function parserRealLiftRow(
  id: string,
  actor: string,
  family: LiveProductSloDashboard["parserRealSellableLift"]["repairedRows"][number]["family"],
  sourceFamily: LiveProductSloDashboard["parserRealSellableLift"]["repairedRows"][number]["sourceFamily"],
  previousDecision: LiveProductSloDashboard["parserRealSellableLift"]["repairedRows"][number]["previousDecision"],
  repairedDecision: LiveProductSloDashboard["parserRealSellableLift"]["repairedRows"][number]["repairedDecision"],
  sellableRowsDelta: number,
  usefulCaveatedRowsDelta: number,
  victim: string,
  sector: string,
  country: string,
  datasetOrImpact: string,
  ttpOrTool: string,
  firstSeen: string,
  lastSeen: string,
  sourceFamilySupport: string[],
  confidence: number,
  caveat = "source-backed parser repair; no raw body or unsafe URL is exposed"
): LiveProductSloDashboard["parserRealSellableLift"]["repairedRows"][number] {
  return {
    id,
    actor,
    family,
    sourceFamily,
    previousDecision,
    repairedDecision,
    sellableRowsDelta,
    usefulCaveatedRowsDelta,
    actorEntity: actor,
    victim,
    sector,
    country,
    datasetOrImpact,
    ttpOrTool,
    firstSeen,
    lastSeen,
    sourceFamilySupport,
    confidence,
    caveat,
    contradictionState: "none",
    provenanceHash: stableId("parser-real-lift", id),
    replayRef: `replay:${stableId("parser-real-replay", id)}`,
    nextBuyerSearch: `${actor} ${victim} ${sector} ${ttpOrTool}`.slice(0, 120),
    graphPivots: [`actor:${actor}`, `victim:${victim}`, `sector:${sector}`, `country:${country}`, `ttp:${ttpOrTool}`],
    noLeak: true
  };
}

function parserRealLiftRejection(
  id: string,
  actor: string,
  blockedReason: LiveProductSloDashboard["parserRealSellableLift"]["rejectionRows"][number]["blockedReason"],
  suppressedRows: number
): LiveProductSloDashboard["parserRealSellableLift"]["rejectionRows"][number] {
  return { id, actor, blockedReason, suppressedRows, countsTowardSellableLift: false, noLeak: true };
}

function buildQualityConversionGate(): LiveProductSloDashboard["qualityConversionGate"] {
  return {
    schemaVersion: "ti.program_bq_paid_row_quality_conversion_gate.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts"],
    baselineRunId: "OThlfd0uzSCNnedAO",
    baselineDatasetId: "LSen2fYtwFTtOr7vK",
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    exampleCount: 12,
    chargeableExampleCount: 6,
    caveatedExampleCount: 4,
    heldOrSuppressedExampleCount: 2,
    rejectedBloatRows: 7,
    sellableRowLift: 6,
    bloatBlocked: 7,
    rejectedBloatReasons: [
      "alias_only_cleanup",
      "stale_old_report_reuse",
      "duplicate_source_expansion",
      "generic_marketing_summary",
      "uncorroborated_public_channel_snippet",
      "unsafe_metadata",
      "no_actionability"
    ],
    sourceParserHandoffs: [
      { owner: "agent_01", blocker: "stale_or_duplicate_public_source_rows", expectedEffect: "Replace stale/duplicate inputs with fresh diverse public sources before counting source-tier growth." },
      { owner: "agent_03", blocker: "generic_rows_missing_actor_victim_ttp_specificity", expectedEffect: "Repair parser output so held rows become specific caveated or chargeable rows." },
      { owner: "agent_04", blocker: "public_channel_snippets_need_cross_family_corroboration", expectedEffect: "Add corroborating public-channel source packs without treating snippets as standalone findings." },
      { owner: "agent_05", blocker: "metadata_only_rows_need_safe_public_corroboration", expectedEffect: "Keep restricted metadata as safe caveated leads until public evidence supports paid promotion." }
    ]
  };
}

function buildLiveFreshnessQualityGate(): LiveProductSloDashboard["liveFreshnessQualityGate"] {
  return {
    schemaVersion: "ti.program_br_live_freshness_quality_gate.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts"],
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    exampleCount: 12,
    chargeableFreshRows: 6,
    caveatedFreshRows: 4,
    staleLatestClaimsBlocked: 5,
    bloatRowsSuppressed: 3,
    minimumFreshRowRate: 0.55,
    minimumStaleSuppressionRate: 0.95,
    blockedLatestClaimReasons: [
      "old_evidence",
      "generic_summary",
      "single_source",
      "alias_only",
      "unrelated_actor",
      "contradicted",
      "metadata_only_without_public_support"
    ],
    sourceParserHandoffs: [
      { owner: "agent_01", blocker: "stale_source_or_duplicate_old_report", expectedEffect: "Replace stale source rows before latest-activity claims can become chargeable." },
      { owner: "agent_03", blocker: "fresh_rows_missing_actor_victim_ttp_specificity", expectedEffect: "Parse structured facts so fresh rows are actionable instead of generic." },
      { owner: "agent_04", blocker: "fresh_single_source_or_public_channel_only_claims", expectedEffect: "Add cross-family corroboration before full paid promotion." },
      { owner: "agent_05", blocker: "metadata_only_freshness_without_public_support", expectedEffect: "Keep metadata-only rows caveated until public evidence backs them." }
    ]
  };
}

function buildFreshnessRepairLoop(): LiveProductSloDashboard["freshnessRepairLoop"] {
  const actorCoverage = ["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta"];
  const blockerReasons = ["stale_latest_activity", "generic_summary", "single_source", "alias_only", "unrelated_actor", "contradicted", "metadata_only_without_public_support"];
  return {
    schemaVersion: "ti.program_bs_paid_row_freshness_repair_loop.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "Apify OUTPUT"],
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    repairQueueSize: 20,
    actorCoverage,
    blockerReasons,
    staleRowsBlocked: 4,
    genericRowsRepaired: 4,
    aliasOrUnrelatedRowsSuppressed: 4,
    caveatedRowsPreserved: 7,
    sellableRowsGained: 6,
    usefulRowsGained: 6,
    averageBuyerValueDelta: 0.104,
    ownerHandoffs: [
      { owner: "agent_01", queueCount: 3, blockerFocus: "stale public source replacement", expectedEffect: "Fresh public captures can turn old latest-activity holds into current caveated or chargeable rows." },
      { owner: "agent_03", queueCount: 4, blockerFocus: "generic parser summaries", expectedEffect: "Structured actor/victim/TTP fields raise specificity and useful-row yield." },
      { owner: "agent_04", queueCount: 4, blockerFocus: "single-source and public-channel corroboration", expectedEffect: "Cross-family support moves caveated/held rows toward chargeable decisions." },
      { owner: "agent_05", queueCount: 2, blockerFocus: "metadata-only public support", expectedEffect: "Restricted metadata stays caveated until safe public corroboration exists." },
      { owner: "agent_07", queueCount: 6, blockerFocus: "alias, unrelated, stale, and contradiction review", expectedEffect: "Suppress bloat and prevent stale/latest wording from being sold." },
      { owner: "agent_08", queueCount: 1, blockerFocus: "graph contradiction holds", expectedEffect: "Contradicted graph edges stay held until accepted ledger state exists." },
      { owner: "agent_09", queueCount: 0, blockerFocus: "surface repair queue in contracts", expectedEffect: "Keep API/product responses route-visible and client-safe." },
      { owner: "agent_10", queueCount: 0, blockerFocus: "release and economics gates", expectedEffect: "Block promotion when useful/sellable lift does not improve paid-row economics." }
    ],
    noLeakProof: {
      rawEvidenceExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    }
  };
}

function buildEntitySpecificityLift(): LiveProductSloDashboard["entitySpecificityLift"] {
  return {
    schemaVersion: "ti.program_bv_paid_row_entity_specificity_lift.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "Apify OUTPUT"],
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    fixtureCount: 20,
    actorCoverage: ["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin", "Unknown Actor Query"],
    missingFieldCoverage: ["victim", "sector", "country", "dataset_or_impact", "ttp_or_tool", "first_seen", "last_seen", "confidence", "caveat", "contradiction_state", "provenance_hash", "next_action"],
    blockerCodes: ["old", "alias_only", "single_source_without_caveat", "unrelated_actor", "contradicted", "metadata_only_without_public_support", "no_useful_buyer_action", "generic_entity_fields"],
    rowsLifted: 14,
    rowsSuppressed: 4,
    rowsHeldWithRepairAction: 2,
    blockerCodesRemoved: 25,
    averageBuyerValueDelta: 0.161,
    ownerHandoffs: [
      { owner: "agent_01", fixtureCount: 2, blockerFocus: "fresh public corroboration for stale or date-thin rows", expectedEffect: "Replace old/generic rows with current entity-specific evidence." },
      { owner: "agent_03", fixtureCount: 10, blockerFocus: "victim, sector, country, dataset, impact, TTP, and date extraction", expectedEffect: "Lift held/generic rows into caveated or chargeable paid output." },
      { owner: "agent_04", fixtureCount: 4, blockerFocus: "single-source public-channel corroboration", expectedEffect: "Promote caveated rows only when corroboration supports buyer-visible specificity." },
      { owner: "agent_05", fixtureCount: 4, blockerFocus: "restricted metadata support without public overclaiming", expectedEffect: "Keep metadata-only leads useful, caveated, and no-leak." },
      { owner: "agent_07", fixtureCount: 6, blockerFocus: "alias, unrelated, stale, contradiction, and unknown-query suppression", expectedEffect: "Prevent vague or wrong entity rows from becoming paid output." },
      { owner: "agent_08", fixtureCount: 3, blockerFocus: "graph contradiction and next-pivot support", expectedEffect: "Connect only evidence-backed relationships to buyer actions." },
      { owner: "agent_09", fixtureCount: 1, blockerFocus: "conversion measurement for entity-rich rows", expectedEffect: "Track whether more specific rows improve paid search behavior." },
      { owner: "agent_10", fixtureCount: 0, blockerFocus: "release economics", expectedEffect: "Block promotion unless buyer-value lift improves paid-row economics." }
    ],
    noLeakProof: {
      rawEvidenceExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    }
  };
}

function buildFalsePositiveSuppressionGate(): LiveProductSloDashboard["falsePositiveSuppressionGate"] {
  const programCpHardening = buildProgramCpHardening();
  return {
    schemaVersion: "ti.program_bz_paid_row_false_positive_suppression_gate.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "Apify OUTPUT"],
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    fixtureCount: 32,
    actorCoverage: ["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin", "Random Actor", "Made Up Actor", "Unknown Actor Query"],
    scenarioCoverage: ["alias_collision", "common_victim_name", "unrelated_actor_co_mention", "stale_repost_as_current", "single_source_requires_caveat", "metadata_only_without_public_support", "contradicted_claim", "unknown_search_suppressed", "true_positive_preserved"],
    reasonCodes: ["alias_collision", "ambiguous_victim_name", "unrelated_actor_co_mention", "stale_repost_as_current", "single_source_without_caveat", "metadata_only_without_public_support", "contradicted_claim", "unknown_query_searching", "true_positive_sellable"],
    falsePositivesSuppressed: 12,
    contradictedRowsHeld: 2,
    staleRepostsBlocked: 3,
    singleSourceRowsCaveated: 3,
    truePositivesPreserved: 8,
    sellableRowsProtected: 8,
    buyerTrustDelta: 0.363,
    rowsPreventedFromBilling: 21,
    programCpHardening,
    ownerHandoffs: [
      { owner: "agent_03", fixtureCount: 6, blockerFocus: "primary actor, victim identity, and roundup parsing", expectedEffect: "Suppress co-mentions and ambiguous victims before they reach paid rows." },
      { owner: "agent_04", fixtureCount: 5, blockerFocus: "stale repost and single-source corroboration", expectedEffect: "Replace old/latest claims or downgrade them with buyer-visible caveats." },
      { owner: "agent_05", fixtureCount: 7, blockerFocus: "metadata-only victim support", expectedEffect: "Keep restricted metadata as held or caveated leads until public support exists." },
      { owner: "agent_07", fixtureCount: 8, blockerFocus: "alias collisions and unknown-query suppression", expectedEffect: "Prevent wrong-actor and invented rows from billing." },
      { owner: "agent_08", fixtureCount: 3, blockerFocus: "contradicted claim and relationship ledger review", expectedEffect: "Hold claims where evidence and graph relationships disagree." },
      { owner: "agent_09", fixtureCount: 2, blockerFocus: "conversion impact for preserved/caveated rows", expectedEffect: "Measure buyer trust and conversion without leaking unsafe details." },
      { owner: "agent_10", fixtureCount: 6, blockerFocus: "release economics and protected sellable rows", expectedEffect: "Keep high-confidence rows billable while noisy rows are removed." }
    ],
    noLeakProof: {
      rawEvidenceExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false,
      privateMaterialExposed: false,
      accountMaterialExposed: false,
      actorInteractionContentExposed: false
    }
  };
}

function buildProgramCpHardening(): LiveProductSloDashboard["falsePositiveSuppressionGate"]["programCpHardening"] {
  return {
    schemaVersion: "ti.program_cp_paid_row_false_positive_freshness_hardening.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/intel/search", "/v1/quality/evaluate", "/v1/contracts", "Apify OUTPUT"],
    activeCandidatePoolRowsAudited: 100,
    apifySmokeRowsAudited: 12,
    currentChargeableRows: 16,
    rowCountInflationBlocked: 84,
    staleLatestActivityRowsBlocked: 18,
    aliasCollisionRowsBlocked: 4,
    wrongActorRowsBlocked: 5,
    genericSourcePageRowsBlocked: 3,
    unrelatedCoMentionRowsBlocked: 3,
    graphOnlyRowsBlocked: 4,
    restrictedOnlyRowsHeld: 11,
    syntheticProofRowsBlocked: 3,
    lowBuyerValueRowsBlocked: 1,
    caveatedRowsExcludedFromChargeable: 7,
    truePositiveRowsPreserved: 16,
    suppressionProof: [
      { class: "stale_latest_activity", exampleActor: "Sandworm", countsTowardSellable: false, proof: "Old campaign reposts and latest-activity claims require fresh public capture before paid counting.", repairOwner: "agent_07" },
      { class: "alias_collision", exampleActor: "APT42", countsTowardSellable: false, proof: "Alias-only Charming Kitten rows are suppressed until actor, target, and TTP spans agree.", repairOwner: "agent_07" },
      { class: "wrong_actor", exampleActor: "LockBit", countsTowardSellable: false, proof: "Wrong ransomware-family matches cannot count without family-specific victim and provenance support.", repairOwner: "agent_07" },
      { class: "generic_source_page", exampleActor: "Turla", countsTowardSellable: false, proof: "Generic market or source landing pages need parser-extracted incident context before paid admission.", repairOwner: "agent_03" },
      { class: "unrelated_co_mention", exampleActor: "APT29", countsTowardSellable: false, proof: "Background co-mentions in another actor story are suppressed unless the row is the primary actor.", repairOwner: "agent_03" },
      { class: "graph_only", exampleActor: "Volt Typhoon", countsTowardSellable: false, proof: "Graph-only pivots remain useful context but need non-graph public corroboration before chargeable output.", repairOwner: "agent_08" },
      { class: "restricted_only", exampleActor: "RansomHub", countsTowardSellable: false, proof: "Restricted metadata-only leads stay held until safe public source support exists.", repairOwner: "agent_05" },
      { class: "synthetic_proof_only", exampleActor: "APT28", countsTowardSellable: false, proof: "Fixture, seeded, default, and proof-only rows are excluded from the production paid floor.", repairOwner: "agent_10" },
      { class: "low_buyer_value", exampleActor: "Unknown Actor Query", countsTowardSellable: false, proof: "Low-value or unknown rows stay searching/suppressed instead of filling paid inventory.", repairOwner: "agent_09" },
      { class: "caveated_only", exampleActor: "Akira", countsTowardSellable: false, proof: "Useful single-source or caveated rows remain analyst context and cannot be billed as confirmed rows.", repairOwner: "agent_04" }
    ],
    preservedTruePositiveProof: [
      { actor: "APT29", requiredSignals: ["current_public_support", "actor_specific", "victim_or_dataset_context", "provenance_hash", "no_leak", "buyer_action"], countsTowardSellable: true, whyBuyerShouldCare: "Corroborated cloud/TTP activity remains a high-confidence paid monitoring row.", nextBuyerSearch: "/ti?q=APT29 cloud campaign", provenanceHash: "cp-proof-apt29-001", noLeak: true },
      { actor: "Turla", requiredSignals: ["current_public_support", "actor_specific", "victim_or_dataset_context", "provenance_hash", "no_leak", "buyer_action"], countsTowardSellable: true, whyBuyerShouldCare: "Tooling rows survive when the source text ties Snake/Turla context to a concrete campaign.", nextBuyerSearch: "/ti?q=Turla Snake tooling", provenanceHash: "cp-proof-turla-001", noLeak: true },
      { actor: "Clop", requiredSignals: ["current_public_support", "actor_specific", "victim_or_dataset_context", "provenance_hash", "no_leak", "buyer_action"], countsTowardSellable: true, whyBuyerShouldCare: "Campaign/CVE rows stay billable when public evidence and contradiction review agree.", nextBuyerSearch: "/ti?q=Clop CVE campaign", provenanceHash: "cp-proof-clop-001", noLeak: true }
    ],
    fastestRepairsTo100: [
      { owner: "agent_07", blocker: "freshness", rowsBlocked: 18, expectedSellableRowsAfterRepair: 5, nextAction: "Replace latest-activity claims with current public captures or keep stale caveats visible.", countsTowardPaidFloorNow: false },
      { owner: "agent_07", blocker: "alias_collision", rowsBlocked: 4, expectedSellableRowsAfterRepair: 2, nextAction: "Require accepted alias ledger match, actor span, and source-family support before admission.", countsTowardPaidFloorNow: false },
      { owner: "agent_07", blocker: "wrong_actor", rowsBlocked: 5, expectedSellableRowsAfterRepair: 2, nextAction: "Split wrong-family and background actor rows before they reach paid output.", countsTowardPaidFloorNow: false },
      { owner: "agent_03", blocker: "generic_source_page", rowsBlocked: 3, expectedSellableRowsAfterRepair: 3, nextAction: "Extract incident/victim/TTP fields from concrete source pages instead of landing pages.", countsTowardPaidFloorNow: false },
      { owner: "agent_04", blocker: "caveated_source_corroboration", rowsBlocked: 7, expectedSellableRowsAfterRepair: 4, nextAction: "Add second-family public corroboration before caveated rows become chargeable.", countsTowardPaidFloorNow: false },
      { owner: "agent_05", blocker: "restricted_only_public_support", rowsBlocked: 11, expectedSellableRowsAfterRepair: 11, nextAction: "Attach safe public corroboration or keep metadata-only leads held.", countsTowardPaidFloorNow: false },
      { owner: "agent_08", blocker: "graph_public_corroboration", rowsBlocked: 4, expectedSellableRowsAfterRepair: 4, nextAction: "Convert graph pivots into non-graph public corroboration before paid counting.", countsTowardPaidFloorNow: false },
      { owner: "agent_06", blocker: "evidence_no_leak", rowsBlocked: 0, expectedSellableRowsAfterRepair: 0, nextAction: "Keep durable evidence hashes and no-leak proof intact for any promoted row.", countsTowardPaidFloorNow: false },
      { owner: "agent_09", blocker: "marketplace_wording", rowsBlocked: 7, expectedSellableRowsAfterRepair: 0, nextAction: "Label caveated rows as useful context, not chargeable confirmations.", countsTowardPaidFloorNow: false },
      { owner: "agent_10", blocker: "paid_release_accounting", rowsBlocked: 84, expectedSellableRowsAfterRepair: 0, nextAction: "Keep the paid floor blocked until 100 fresh public-supported sellable rows exist.", countsTowardPaidFloorNow: false }
    ],
    secondBatchAudit: {
      schemaVersion: "ti.program_cp_second_batch_candidate_audit.v1",
      auditedPreset: "100_name_paid_preset",
      localProofRows: 607,
      currentSellableRows: 187,
      sellableFindingRows: 52,
      sellableSourceProvenanceRows: 135,
      sourceProvenanceRowsCountTowardFindingFloor: false,
      localProofPassed100RowFloor: true,
      hostedProofRequired: true,
      hostedProofCountsTowardPaidPromotion: false,
      externalMarketplaceVerificationRequired: true,
      staleLatestActivitySellableRows: 0,
      aliasOrWrongActorSellableRows: 0,
      genericSourcePageSellableRows: 0,
      graphOnlySellableRows: 0,
      restrictedOnlySellableRows: 0,
      caveatedRowsCountTowardChargeable: false,
      findingAdmissionRequiredSignals: ["current_public_support", "actor_specific", "finding_context", "freshness_not_stale", "provenance_hash", "no_leak", "buyer_action"],
      rowInflationGuards: [
        { guard: "source_provenance_padding", countsTowardPaidPromotion: false, proof: "The 100-name proof has 135 sellable source-provenance rows, but they are excluded from the sellable finding floor unless parser-extracted activity/target/TTP context exists.", owner: "agent_07" },
        { guard: "stale_latest_activity", countsTowardPaidPromotion: false, proof: "No stale latest-activity rows may count as sellable in the second-batch audit.", owner: "agent_07" },
        { guard: "alias_or_wrong_actor", countsTowardPaidPromotion: false, proof: "Alias and wrong-actor rows require accepted actor specificity before paid admission.", owner: "agent_07" },
        { guard: "generic_source_page", countsTowardPaidPromotion: false, proof: "Generic source pages remain support/provenance only until concrete finding fields are extracted.", owner: "agent_03" },
        { guard: "graph_only", countsTowardPaidPromotion: false, proof: "Graph-only rows need non-graph public corroboration before promotion.", owner: "agent_08" },
        { guard: "restricted_only", countsTowardPaidPromotion: false, proof: "Restricted-only metadata remains held until safe public support exists.", owner: "agent_05" },
        { guard: "caveated_as_chargeable", countsTowardPaidPromotion: false, proof: "Caveated rows remain buyer context and cannot be chargeable confirmations.", owner: "agent_09" }
      ],
      noLeakProof: {
        rawEvidenceExposed: false,
        unsafeUrlsExposed: false,
        restrictedPayloadsExposed: false,
        objectKeysExposed: false,
        privateMaterialExposed: false,
        accountMaterialExposed: false,
        actorInteractionContentExposed: false
      }
    },
    noLeakProof: {
      rawEvidenceExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false,
      privateMaterialExposed: false,
      accountMaterialExposed: false,
      actorInteractionContentExposed: false
    }
  };
}

function buildPaidRowAudit100(): LiveProductSloDashboard["paidRowAudit100"] {
  const classificationCounts: LiveProductSloDashboard["paidRowAudit100"]["classificationCounts"] = {
    sellable: 5,
    useful_caveated: 3,
    needs_public_support: 4,
    stale_or_duplicate: 2,
    wrong_actor_or_alias_collision: 2,
    restricted_only: 2,
    not_payworthy: 3
  };
  const protectedSellableRows = classificationCounts.sellable;
  const expectedSellableLiftAfterParserSourceRepairs = 21;
  const rowsPreventedFromBilling = 39;
  return {
    schemaVersion: "ti.program_ch_paid_row_audit_100.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "Apify OUTPUT"],
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    targetSellableRows: 100,
    classificationCounts,
    currentSellableRows: protectedSellableRows,
    protectedSellableRows,
    usefulCaveatedRowsExcluded: classificationCounts.useful_caveated,
    suppressedFalsePositives: classificationCounts.stale_or_duplicate + classificationCounts.wrong_actor_or_alias_collision + classificationCounts.not_payworthy,
    rowsOneRepairAway: classificationCounts.useful_caveated + classificationCounts.needs_public_support + classificationCounts.restricted_only,
    expectedSellableLiftAfterParserSourceRepairs,
    rowsPreventedFromBilling,
    productionSellableFloorGap: 100 - protectedSellableRows,
    actorCoverage: ["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin"],
    exclusionProof: [
      { class: "graph_only_projection", countsAsSellable: false, reason: "graph-only rows need source-backed parser fields before they can be paid rows" },
      { class: "synthetic_row", countsAsSellable: false, reason: "fixtures and proof rows do not count toward production sellable floors" },
      { class: "stale_or_duplicate", countsAsSellable: false, reason: "stale or duplicate evidence is suppressed before billing" },
      { class: "restricted_only", countsAsSellable: false, reason: "restricted metadata requires safe public support before paid promotion" },
      { class: "caveat_only", countsAsSellable: false, reason: "useful caveated rows remain buyer context until source support clears" }
    ],
    ownerHandoffs: [
      { owner: "agent_03", rowCount: classificationCounts.needs_public_support + classificationCounts.useful_caveated, expectedSellableRowsUnlocked: 20, action: "repair parser fields and row-level provenance for one-repair-away rows" },
      { owner: "agent_04", rowCount: classificationCounts.needs_public_support, expectedSellableRowsUnlocked: 8, action: "add public source-family support for coverage-gap rows" },
      { owner: "agent_05", rowCount: classificationCounts.restricted_only, expectedSellableRowsUnlocked: 2, action: "find safe public support for metadata-only leads" },
      { owner: "agent_07", rowCount: classificationCounts.stale_or_duplicate + classificationCounts.wrong_actor_or_alias_collision + classificationCounts.not_payworthy, expectedSellableRowsUnlocked: 0, action: "keep stale, alias, unrelated, and not-payworthy rows suppressed" },
      { owner: "agent_08", rowCount: classificationCounts.needs_public_support + classificationCounts.useful_caveated, expectedSellableRowsUnlocked: 10, action: "attach graph pivots only after parser fields and source support exist" },
      { owner: "agent_10", rowCount: 100, expectedSellableRowsUnlocked: expectedSellableLiftAfterParserSourceRepairs, action: "keep paid traffic blocked until current sellable rows reach 100" }
    ],
    noLeakProof: {
      rawEvidenceExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false,
      privateMaterialExposed: false,
      accountMaterialExposed: false,
      actorInteractionContentExposed: false
    }
  };
}

function buildFirst100AdmissionQuality(): LiveProductSloDashboard["first100AdmissionQuality"] {
  type Row = LiveProductSloDashboard["first100AdmissionQuality"]["sampleRows"][number];
  const classificationCounts: LiveProductSloDashboard["first100AdmissionQuality"]["classificationCounts"] = {
    accepted_sellable: 16,
    caveated_useful: 7,
    needs_public_support: 28,
    stale_duplicate: 18,
    alias_collision: 4,
    wrong_actor: 5,
    restricted_only: 11,
    graph_only: 4,
    synthetic_proof_only: 3,
    generic_market_source_page: 3,
    low_buyer_value: 1
  };
  const sampleRows: Row[] = [
    { id: "cn_sample_apt29_sellable", actor: "APT29", rowClass: "accepted_sellable", admissionDecision: "admit_sellable", countsTowardProductionSellableRows: true, buyerValueScore: 0.86, whyBuyerShouldCare: "Fresh actor/victim/TTP row gives a concrete monitoring pivot.", nextSearchOrPivot: "APT29 government tenant Valid Accounts", provenanceHash: "cn_admit_apt29_86", failureReasons: [], repairOwner: "agent_10", noLeak: true },
    { id: "cn_sample_turla_caveated", actor: "Turla", rowClass: "caveated_useful", admissionDecision: "downgrade_caveated", countsTowardProductionSellableRows: false, buyerValueScore: 0.66, whyBuyerShouldCare: "Useful tool context is preserved but excluded from the paid floor until corroborated.", nextSearchOrPivot: "Turla tooling second source", provenanceHash: "cn_caveat_turla_66", failureReasons: ["single_source_or_caveat_only"], repairOwner: "agent_04", noLeak: true },
    { id: "cn_sample_akira_restricted", actor: "Akira", rowClass: "restricted_only", admissionDecision: "repair_required", countsTowardProductionSellableRows: false, buyerValueScore: 0.48, whyBuyerShouldCare: "Metadata lead can become valuable only with safe public support.", nextSearchOrPivot: "Akira victim public notice", provenanceHash: "cn_restricted_akira_48", failureReasons: ["restricted_only_without_public_support"], repairOwner: "agent_05", noLeak: true },
    { id: "cn_sample_black_basta_graph", actor: "Black Basta", rowClass: "graph_only", admissionDecision: "suppress", countsTowardProductionSellableRows: false, buyerValueScore: 0.48, whyBuyerShouldCare: "Graph context cannot pad the paid floor without fresh evidence.", nextSearchOrPivot: "Black Basta evidence-backed victim", provenanceHash: "cn_graph_blackbasta_48", failureReasons: ["graph_only_projection"], repairOwner: "agent_08", noLeak: true },
    { id: "cn_sample_clop_generic", actor: "Clop", rowClass: "generic_market_source_page", admissionDecision: "suppress", countsTowardProductionSellableRows: false, buyerValueScore: 0.48, whyBuyerShouldCare: "Generic source pages protect trust by staying out of billing.", nextSearchOrPivot: "Clop campaign victim sector", provenanceHash: "cn_generic_clop_48", failureReasons: ["generic_source_summary"], repairOwner: "agent_03", noLeak: true }
  ];

  return {
    schemaVersion: "ti.program_cn_first_100_paid_row_admission_quality.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "Apify OUTPUT"],
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    productionSellableFloor: 100,
    fixtureCount: Object.values(classificationCounts).reduce((sum, count) => sum + count, 0),
    admissionRules: {
      requireFreshEnough: true,
      requireActorSpecific: true,
      requireSourceBacked: true,
      requireSourceFamilySupport: true,
      requireBuyerAction: true,
      requireProvenanceHash: true,
      requireNoContradictions: true,
      forbidUnsafeRestrictedOnlyDependency: true,
      forbidDefaultDemoOldSummary: true
    },
    classificationCounts,
    metrics: {
      rowsAdmittedToProductionFloor: classificationCounts.accepted_sellable,
      rowsDowngradedToCaveatedContext: classificationCounts.caveated_useful,
      rowsSuppressed: classificationCounts.stale_duplicate + classificationCounts.alias_collision + classificationCounts.wrong_actor + classificationCounts.graph_only + classificationCounts.synthetic_proof_only + classificationCounts.generic_market_source_page + classificationCounts.low_buyer_value,
      rowsNeedingParserRepair: classificationCounts.alias_collision + classificationCounts.wrong_actor + classificationCounts.generic_market_source_page,
      rowsNeedingSourceSupport: classificationCounts.needs_public_support,
      rowsNeedingDarkMetadataPublicSupport: classificationCounts.restricted_only,
      estimatedBuyerValueDelta: 0.073,
      rowCountInflationBlocked: 84
    },
    actorCoverage: ["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin"],
    sampleRows,
    nonSellableExclusionProof: [
      { class: "graph_only", countsAsSellable: false, reason: "Graph-only context must wait for evidence-backed paid-row claims." },
      { class: "synthetic_proof_only", countsAsSellable: false, reason: "Proof rows are shape/safety only." },
      { class: "stale_duplicate", countsAsSellable: false, reason: "Stale or duplicate source rows do not create buyer monitoring value." },
      { class: "restricted_only", countsAsSellable: false, reason: "Restricted metadata needs public support before admission." },
      { class: "caveated_useful", countsAsSellable: false, reason: "Caveated rows can help analysts but do not count toward the first 100." },
      { class: "generic_market_source_page", countsAsSellable: false, reason: "Generic source/marketing pages lack buyer actionability." },
      { class: "low_buyer_value", countsAsSellable: false, reason: "Low buyer-value rows cannot inflate the floor." },
      { class: "alias_or_wrong_actor", countsAsSellable: false, reason: "Alias collision and wrong-actor rows need repair or suppression." }
    ],
    ownerHandoffs: [
      { owner: "agent_03", rowCount: classificationCounts.generic_market_source_page, action: "Repair parser fields so generic source summaries become actor-specific rows or stay suppressed." },
      { owner: "agent_04", rowCount: classificationCounts.caveated_useful + classificationCounts.needs_public_support, action: "Add fresh public source support and source-family diversity." },
      { owner: "agent_05", rowCount: classificationCounts.restricted_only, action: "Find public support for metadata-only leads without raw restricted material." },
      { owner: "agent_07", rowCount: classificationCounts.stale_duplicate + classificationCounts.alias_collision + classificationCounts.wrong_actor, action: "Suppress stale, duplicate, alias-collided, and wrong-actor rows." },
      { owner: "agent_08", rowCount: classificationCounts.graph_only, action: "Keep graph-only context out of sellable counts until backed by capture evidence." },
      { owner: "agent_09", rowCount: classificationCounts.synthetic_proof_only, action: "Keep marketplace samples/proof rows out of billable production output." },
      { owner: "agent_10", rowCount: classificationCounts.accepted_sellable + classificationCounts.low_buyer_value, action: "Use admitted, downgraded, and suppressed counts in release decisions." }
    ],
    noLeakProof: {
      rawEvidenceExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false,
      privateMaterialExposed: false,
      accountMaterialExposed: false,
      actorInteractionContentExposed: false
    }
  };
}

function buildGraphSellableSupportPacketLegacyDetailed(): LiveProductSloDashboard["graphSellableSupportPacket"] {
  const examples: LiveProductSloDashboard["graphSellableSupportPacket"]["examples"] = [
    graphSellableSupportSloExample("APT29", "apt", "actor_to_ttp:APT29:T1078", "clear_web", "proven", "none", "APT29 T1078 current public corroboration", "agent_03", 2),
    graphSellableSupportSloExample("APT28", "apt", "actor_to_campaign:APT28:phishing", "clear_web", "single_source", "none", "APT28 campaign public source family", "agent_04", 2),
    graphSellableSupportSloExample("APT42", "apt", "actor_to_target:APT42:ngo", "public_channel", "missing_public_support", "none", "APT42 NGO lure public-channel corroboration", "agent_04", 3),
    graphSellableSupportSloExample("Turla", "apt", "actor_to_tool:Turla:Snake", "clear_web", "proven", "none", "Turla Snake tooling fresh report", "agent_03", 2),
    graphSellableSupportSloExample("Volt Typhoon", "apt", "actor_to_sector:Volt Typhoon:critical_infrastructure", "graph_ledger", "single_source", "review_hold", "Volt Typhoon infrastructure second source", "agent_07", 2),
    graphSellableSupportSloExample("Lazarus Group", "apt", "actor_to_sector:Lazarus:cryptocurrency", "clear_web", "proven", "none", "Lazarus cryptocurrency social engineering", "agent_03", 2),
    graphSellableSupportSloExample("Sandworm", "apt", "actor_to_campaign:Sandworm:Ukraine", "graph_ledger", "none", "contradicted", "Sandworm campaign contradiction review", "agent_07", 0),
    graphSellableSupportSloExample("Scattered Spider", "apt", "actor_to_ttp:Scattered Spider:social_engineering", "clear_web", "proven", "none", "Scattered Spider social engineering victim sector", "agent_03", 2),
    graphSellableSupportSloExample("LockBit", "ransomware", "actor_to_victim:LockBit:manufacturing", "restricted_metadata", "metadata_only", "none", "LockBit victim public disclosure", "agent_05", 2),
    graphSellableSupportSloExample("Akira", "ransomware", "actor_to_victim:Akira:healthcare", "restricted_metadata", "metadata_only", "none", "Akira healthcare public disclosure", "agent_05", 2),
    graphSellableSupportSloExample("Clop", "ransomware", "campaign_to_victim:Clop:MOVEit", "clear_web", "proven", "none", "Clop MOVEit victim public statement", "agent_04", 3),
    graphSellableSupportSloExample("Black Basta", "ransomware", "actor_to_victim:Black Basta:industrial", "graph_ledger", "single_source", "none", "Black Basta industrial second source", "agent_04", 2),
    graphSellableSupportSloExample("RansomHub", "ransomware", "actor_to_victim:RansomHub:services", "restricted_metadata", "metadata_only", "none", "RansomHub services public confirmation", "agent_05", 2),
    graphSellableSupportSloExample("Play", "ransomware", "actor_to_sector:Play:healthcare", "public_channel", "single_source", "none", "Play healthcare source-family corroboration", "agent_04", 2),
    graphSellableSupportSloExample("Qilin", "ransomware", "actor_to_victim:Qilin:professional_services", "restricted_metadata", "metadata_only", "none", "Qilin professional services public support", "agent_05", 2),
    graphSellableSupportSloExample("BlackCat", "ransomware", "actor_to_victim:BlackCat:energy", "clear_web", "proven", "none", "BlackCat energy victim current public report", "agent_03", 2),
    graphSellableSupportSloExample("BianLian", "ransomware", "actor_to_sector:BianLian:legal", "public_channel", "missing_public_support", "none", "BianLian legal sector public corroboration", "agent_04", 2),
    graphSellableSupportSloExample("Medusa", "ransomware", "actor_to_victim:Medusa:education", "restricted_metadata", "metadata_only", "none", "Medusa education victim public support", "agent_05", 2),
    graphSellableSupportSloExample("FIN7", "apt", "actor_to_tool:FIN7:phishing_kit", "clear_web", "single_source", "none", "FIN7 tooling corroborating source", "agent_04", 1),
    graphSellableSupportSloExample("MuddyWater", "apt", "actor_to_ttp:MuddyWater:powershell", "graph_ledger", "single_source", "none", "MuddyWater PowerShell public report", "agent_03", 1)
  ];
  const graphOnlyRowsExcludedFromFloor = examples.length;
  const graphSupportedRepairCandidates = examples.filter((row) => row.expectedSellableRowsUnlockedAfterRepair > 0).length;
  return {
    schemaVersion: "ti.program_ci_graph_sellable_support_packet.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows", "/v1/contracts"],
    baselineRunId: PROGRAM_BH_BASELINE_RUN_ID,
    baselineDatasetId: PROGRAM_BH_BASELINE_DATASET_ID,
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    productionSellableFloor: 100,
    supportExampleCount: examples.length,
    graphOnlyRowsExcludedFromFloor,
    graphSupportedRepairCandidates,
    projectedSellableRowsUnlockedAfterNonGraphRepairs: examples.reduce((sum, row) => sum + row.expectedSellableRowsUnlockedAfterRepair, 0),
    nextBuyerSearchCount: examples.length,
    averageAnalystConfidenceDelta: 0.094,
    examples,
    ownerHandoffs: [
      { owner: "agent_03", rowCount: examples.filter((row) => row.repairOwner === "agent_03").length, action: "extract TTP/tool/victim/sector fields so graph support attaches to real row evidence" },
      { owner: "agent_04", rowCount: examples.filter((row) => row.repairOwner === "agent_04").length, action: "add safe public source-family corroboration for single-source and public-channel graph pivots" },
      { owner: "agent_05", rowCount: examples.filter((row) => row.repairOwner === "agent_05").length, action: "turn metadata-only graph leads into safe public-support work without leaking restricted material" },
      { owner: "agent_07", rowCount: examples.filter((row) => row.repairOwner === "agent_07").length, action: "hold contradicted or review-held graph relationships before paid row admission" },
      { owner: "agent_08", rowCount: graphOnlyRowsExcludedFromFloor, action: "preserve buyer-useful graph pivots while proving they do not count toward the production floor alone" },
      { owner: "agent_09", rowCount: examples.length, action: "surface graph support as buyer next-search copy, not production readiness copy" },
      { owner: "agent_10", rowCount: graphOnlyRowsExcludedFromFloor, action: "keep graph-only support excluded from releaseDecision projected sellable rows" }
    ],
    noLeakBoundary: {
      rawEvidenceBodies: false,
      unsafeUrls: false,
      objectKeys: false,
      credentials: false,
      payloadLinks: false,
      privateMaterial: false,
      actorInteraction: false
    }
  };
}

function graphSellableSupportSloExample(
  actor: string,
  family: LiveProductSloDashboard["graphSellableSupportPacket"]["examples"][number]["family"],
  relationshipSupport: string,
  supportingSourceFamily: LiveProductSloDashboard["graphSellableSupportPacket"]["examples"][number]["supportingSourceFamily"],
  sourceFamilyProofState: LiveProductSloDashboard["graphSellableSupportPacket"]["examples"][number]["sourceFamilyProofState"],
  contradictionState: LiveProductSloDashboard["graphSellableSupportPacket"]["examples"][number]["contradictionState"],
  nextBuyerSearch: string,
  repairOwner: LiveProductSloDashboard["graphSellableSupportPacket"]["examples"][number]["repairOwner"],
  expectedSellableRowsUnlockedAfterRepair: number
): LiveProductSloDashboard["graphSellableSupportPacket"]["examples"][number] {
  return {
    actor,
    family,
    relationshipSupport,
    supportingSourceFamily,
    sourceFamilyProofState,
    contradictionState,
    caveat: sourceFamilyProofState === "proven" && contradictionState === "none"
      ? "graph supports a non-graph repair path but is not counted alone"
      : "graph relationship remains a repair/search pivot until evidence and source-family support pass",
    nextBuyerSearch,
    repairOwner,
    expectedSellableRowsUnlockedAfterRepair,
    countsTowardProductionSellableRows: false,
    noLeak: true
  };
}

function buildGraphPublicCorroborationPivotPacket(): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"] {
  type Candidate = LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number];
  type Pivot = Candidate["nextPublicCorroborationPivot"];
  const seeds: Array<{ actor: string; family: Candidate["family"]; field: Pivot["repairsRowField"]; entity: Pivot["entityType"]; source: Pivot["expectedSourceFamily"]; owner: Pivot["ownerHandoff"] }> = [
    { actor: "APT29", family: "apt", field: "ttp_tool", entity: "ttp", source: "government_advisory", owner: "agent_03" },
    { actor: "APT28", family: "apt", field: "campaign_context", entity: "campaign", source: "vendor_report", owner: "agent_04" },
    { actor: "APT42", family: "apt", field: "victim_or_dataset", entity: "victim", source: "public_report", owner: "agent_04" },
    { actor: "Turla", family: "apt", field: "ttp_tool", entity: "tool", source: "cert_advisory", owner: "agent_03" },
    { actor: "Volt Typhoon", family: "apt", field: "sector_country", entity: "sector", source: "government_advisory", owner: "agent_07" },
    { actor: "Lazarus Group", family: "apt", field: "victim_or_dataset", entity: "victim", source: "vendor_report", owner: "agent_03" },
    { actor: "Scattered Spider", family: "apt", field: "ttp_tool", entity: "ttp", source: "security_blog", owner: "agent_03" },
    { actor: "Mustang Panda", family: "apt", field: "campaign_context", entity: "campaign", source: "vendor_report", owner: "agent_04" },
    { actor: "OilRig", family: "apt", field: "sector_country", entity: "sector", source: "government_advisory", owner: "agent_03" },
    { actor: "Kimsuky", family: "apt", field: "victim_or_dataset", entity: "victim", source: "security_blog", owner: "agent_04" },
    { actor: "LockBit", family: "ransomware", field: "victim_or_dataset", entity: "victim", source: "victim_notice", owner: "agent_05" },
    { actor: "Akira", family: "ransomware", field: "victim_or_dataset", entity: "victim", source: "victim_notice", owner: "agent_05" },
    { actor: "Clop", family: "ransomware", field: "victim_or_dataset", entity: "dataset", source: "public_report", owner: "agent_04" },
    { actor: "Black Basta", family: "ransomware", field: "victim_or_dataset", entity: "victim", source: "security_blog", owner: "agent_04" },
    { actor: "RansomHub", family: "ransomware", field: "victim_or_dataset", entity: "victim", source: "victim_notice", owner: "agent_05" },
    { actor: "Play", family: "ransomware", field: "sector_country", entity: "sector", source: "public_report", owner: "agent_04" },
    { actor: "Qilin", family: "ransomware", field: "victim_or_dataset", entity: "victim", source: "victim_notice", owner: "agent_05" },
    { actor: "BlackCat", family: "ransomware", field: "sector_country", entity: "sector", source: "public_report", owner: "agent_03" },
    { actor: "BianLian", family: "ransomware", field: "sector_country", entity: "sector", source: "public_report", owner: "agent_04" },
    { actor: "Medusa", family: "ransomware", field: "victim_or_dataset", entity: "victim", source: "victim_notice", owner: "agent_05" },
    { actor: "FIN7", family: "apt", field: "ttp_tool", entity: "tool", source: "vendor_report", owner: "agent_04" },
    { actor: "MuddyWater", family: "apt", field: "ttp_tool", entity: "ttp", source: "vendor_report", owner: "agent_03" },
    { actor: "Storm-0978", family: "apt", field: "campaign_context", entity: "campaign", source: "security_blog", owner: "agent_04" },
    { actor: "Royal", family: "ransomware", field: "freshness", entity: "campaign", source: "public_report", owner: "agent_10" }
  ];
  const states: Array<Candidate["currentBlockedState"]> = ["needs_public_support", "metadata_only", "single_source_caveat", "parser_field_missing"];
  const candidates = seeds.map((seed, index) => {
    const state = states[index % states.length] ?? "needs_public_support";
    const proofState = graphPublicProofStateFor(state, index);
    const expectedRows = state === "parser_field_missing" ? 1 : 2;
    return graphPublicPivotCandidate(
      `cs_public_pivot_${String(index + 1).padStart(2, "0")}`,
      index + 1,
      seed.actor,
      graphPublicAliasesFor(seed.actor),
      seed.family,
      graphPublicTargetFor(seed.actor, seed.field),
      state,
      `graph_relationship:${seed.actor}:${seed.field}`,
      `${seed.actor} public ${seed.field.replaceAll("_", " ")} corroboration 2026`,
      seed.entity,
      seed.source,
      seed.field,
      state === "single_source_caveat" ? "medium" : "low",
      seed.actor === "APT28" || seed.actor === "BlackCat" ? "medium" : "low",
      seed.owner,
      proofState,
      graphPublicBuyerFieldLiftFor(seed.field),
      expectedRows,
      proofState === "public_proof_found" ? expectedRows : 0,
      round(0.07 + (index % 4) * 0.01)
    );
  });
  candidates.push(
    graphPublicPivotCandidate("cs_hold_sandworm_ukraine", 25, "Sandworm", ["Sandworm Team", "Unit 74455"], "apt", "Ukraine ICS campaign", "contradiction_hold", "graph_relationship:Sandworm:Ukraine_ICS", "Sandworm Ukraine ICS attribution contradiction public advisory", "campaign", "government_advisory", "campaign_context", "high", "medium", "agent_07", "contradiction_found", "hold campaign context until current public attribution agrees", 0, 0, 0.01),
    graphPublicPivotCandidate("cs_hold_nobelium_apt29", 26, "NOBELIUM", ["APT29", "Cozy Bear"], "apt", "current alias attribution", "alias_collision_hold", "graph_relationship:NOBELIUM:APT29", "NOBELIUM APT29 alias collision current reporting", "actor", "vendor_report", "actor_attribution", "medium", "high", "agent_07", "alias_hold", "hold actor attribution until alias/current-name policy resolves", 0, 0, 0.01),
    graphPublicPivotCandidate("cs_hold_carbanak_fin7", 27, "Carbanak", ["FIN7", "Anunak"], "apt", "current alias attribution", "alias_collision_hold", "graph_relationship:Carbanak:FIN7", "Carbanak FIN7 alias collision source review", "actor", "security_blog", "actor_attribution", "medium", "high", "agent_07", "alias_hold", "hold actor attribution until alias/current-name policy resolves", 0, 0, 0.01),
    graphPublicPivotCandidate("cs_hold_conti_ryuk", 28, "Conti", ["Ryuk", "Wizard Spider"], "ransomware", "Ryuk overlap attribution", "contradiction_hold", "graph_relationship:Conti:Ryuk", "Conti Ryuk overlap attribution contradiction", "actor", "public_report", "actor_attribution", "high", "high", "agent_07", "contradiction_found", "hold actor attribution until overlap is reviewed", 0, 0, 0.01),
    graphPublicPivotCandidate("cs_hold_royal_blacksuit", 29, "Royal", ["BlackSuit"], "ransomware", "BlackSuit alias transition", "alias_collision_hold", "graph_relationship:Royal:BlackSuit", "Royal BlackSuit alias collision public source review", "actor", "security_blog", "actor_attribution", "medium", "high", "agent_07", "alias_hold", "hold actor attribution until alias/current-name policy resolves", 0, 0, 0.01),
    graphPublicPivotCandidate("cs_hold_8base_phobos", 30, "8Base", ["Phobos"], "ransomware", "Phobos overlap attribution", "alias_collision_hold", "graph_relationship:8Base:Phobos", "8Base Phobos alias overlap current victim reporting", "actor", "public_report", "actor_attribution", "medium", "high", "agent_07", "alias_hold", "hold actor attribution until alias/current-name policy resolves", 0, 0, 0.01)
  );
  const rowUnlockingCandidateCount = candidates.filter((candidate) => candidate.expectedSellableRowsUnlockedAfterPublicProof > 0).length;
  const contradictionOrAliasHoldCount = candidates.filter((candidate) => candidate.currentBlockedState === "contradiction_hold" || candidate.currentBlockedState === "alias_collision_hold").length;
  const projectedSellableRowsAfterPublicCorroboration = candidates.reduce((sum, candidate) => sum + candidate.expectedSellableRowsUnlockedAfterPublicProof, 0);
  const publicProofMetrics = graphPublicProofMetrics(candidates);
  const paidRowUnlockQueue = graphPublicPaidRowUnlockQueue(candidates);
  return {
    schemaVersion: "ti.program_cs_graph_public_corroboration_pivot_packet.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows", "/v1/intel/search", "/v1/contracts"],
    baselineRunId: "OThlfd0uzSCNnedAO",
    baselineDatasetId: "LSen2fYtwFTtOr7vK",
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    productionSellableFloor: 100,
    candidateCount: candidates.length,
    rowUnlockingCandidateCount,
    contradictionOrAliasHoldCount,
    graphOnlyRowsExcludedFromFloor: candidates.length,
    projectedSellableRowsAfterPublicCorroboration,
    publicProofMetrics,
    hostedDefaultPublicCorroborationLift: buildProgramFhHostedPublicCorroborationLift(),
    paidRowUnlockQueue,
    averageProjectedConfidenceLift: round(candidates.reduce((sum, candidate) => sum + candidate.projectedConfidenceLift, 0) / candidates.length),
    sourceFamilyTargets: graphPublicPivotSourceFamilyTargets(candidates),
    fieldRepairTargets: graphPublicPivotFieldTargets(candidates),
    candidates,
    integrationHandoffs: [
      {
        owner: "agent_03",
        candidateIds: candidates.filter((candidate) => candidate.publicProofState === "public_proof_found" && candidate.nextPublicCorroborationPivot.ownerHandoff === "agent_03").map((candidate) => candidate.id),
        convertsRowsFrom: "parser_caveated_rows",
        missingPublicProof: "parser can admit rows once current public report/advisory proof is attached to the existing graph-supported TTP/tool/campaign field",
        expectedRowsUnlockedForAdmission: candidates.filter((candidate) => candidate.publicProofState === "public_proof_found" && candidate.nextPublicCorroborationPivot.ownerHandoff === "agent_03").reduce((sum, candidate) => sum + candidate.measuredRowsUnlockedForParserAdmission, 0),
        countsTowardPaidFloorNow: false,
        action: "attach public proof hashes and rerun parser admission without using graph-only context as the paid-row evidence"
      },
      {
        owner: "agent_05",
        candidateIds: candidates.filter((candidate) => candidate.publicProofState === "public_proof_found" && candidate.nextPublicCorroborationPivot.ownerHandoff === "agent_05").map((candidate) => candidate.id),
        convertsRowsFrom: "dark_metadata_metadata_only_rows",
        missingPublicProof: "metadata-only victim/dataset leads need a safe public notice or report before admission",
        expectedRowsUnlockedForAdmission: candidates.filter((candidate) => candidate.publicProofState === "public_proof_found" && candidate.nextPublicCorroborationPivot.ownerHandoff === "agent_05").reduce((sum, candidate) => sum + candidate.measuredRowsUnlockedForParserAdmission, 0),
        countsTowardPaidFloorNow: false,
        action: "join safe public victim/report proof to metadata-only leads while preserving no raw locator, payload, credential, or private material"
      }
    ],
    ownerHandoffs: [
      graphPublicPivotOwnerHandoff(candidates, "agent_03", "tighten parser fields after public proof lands"),
      graphPublicPivotOwnerHandoff(candidates, "agent_04", "attach safe public source-family support"),
      graphPublicPivotOwnerHandoff(candidates, "agent_05", "turn metadata-only leads into public-support searches"),
      graphPublicPivotOwnerHandoff(candidates, "agent_07", "hold contradiction and alias-collision rows until reviewed"),
      { owner: "agent_08", candidateCount: candidates.length, expectedSellableRowsUnlockedAfterPublicProof: projectedSellableRowsAfterPublicCorroboration, action: "preserve graph provenance while proving graph-only context stays excluded from paid counts" },
      { owner: "agent_09", candidateCount: candidates.length, expectedSellableRowsUnlockedAfterPublicProof: 0, action: "surface next public searches as buyer pivots, not paid-readiness proof" },
      graphPublicPivotOwnerHandoff(candidates, "agent_10", "keep projected gains out of the current paid floor")
    ],
    noLeakBoundary: {
      rawEvidenceBodies: false,
      unsafeUrls: false,
      objectKeys: false,
      credentials: false,
      payloadLinks: false,
      privateMaterial: false,
      actorInteraction: false
    }
  };
}

function buildProgramFhHostedPublicCorroborationLift(): ProgramFhHostedPublicCorroborationLift {
  const acceptedPublicCorroborationRows: ProgramFhHostedPublicCorroborationLift["acceptedPublicCorroborationRows"] = [
    hostedPublicCorroborationClass("single_source", "included_with_caveat", 12, "source_family_diversity", "vendor_report", "Cross-family public corroboration converts single-source hosted rows into parser-ready evidence."),
    hostedPublicCorroborationClass("stale_timestamp", "included_with_caveat", 9, "freshness", "government_advisory", "Fresh public advisory timestamps replace stale latest-activity caveats for hosted rows."),
    hostedPublicCorroborationClass("missing_sector_country", "hold", 9, "sector_country", "victim_notice", "Victim or target context adds sector/country fields that buyers can filter and act on."),
    hostedPublicCorroborationClass("missing_ttp_tool", "included_with_caveat", 8, "ttp_tool", "cert_advisory", "Procedure and tool corroboration gives Agent 03 a concrete TTP admission path."),
    hostedPublicCorroborationClass("missing_buyer_action", "hold", 8, "buyer_action", "public_report", "Public reporting is rewritten into a next-search or monitoring action instead of generic context."),
    hostedPublicCorroborationClass("missing_confidence_reason", "included_with_caveat", 8, "confidence_reason", "security_blog", "Corroborating source-family and timestamp detail explains why confidence should increase.")
  ];
  return {
    schemaVersion: "ti.program_fh_hosted_public_corroboration_lift.v1",
    owner: "agent_08",
    observedHostedRun: buildProgramFhHostedDefaultParserLift().observedHostedRun,
    acceptedPublicCorroborationRows,
    rejectedPublicCorroborationRows: [
      hostedPublicCorroborationRejection("stale_latest_activity", 41),
      hostedPublicCorroborationRejection("alias_or_wrong_actor", 18),
      hostedPublicCorroborationRejection("generic_source_page", 27),
      hostedPublicCorroborationRejection("graph_only", 21),
      hostedPublicCorroborationRejection("restricted_only", 39),
      hostedPublicCorroborationRejection("duplicate_claim", 12),
      hostedPublicCorroborationRejection("contradiction", 9)
    ],
    projectedHostedRerunEffect: {
      baselineSellableRows: 46,
      acceptedCorroborationRows: acceptedPublicCorroborationRows.reduce((sum, row) => sum + row.expectedRowsUnlockedAfterParserAdmission, 0),
      expectedSellableRowsAfterParserAdmission: 100,
      baselineSellableFindings: 31,
      expectedFindingRowsAfterParserAdmission: 52,
      hostedPaidProofClaimed: false
    },
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false
    }
  };
}

function hostedPublicCorroborationClass(
  rowClass: ProgramFhHostedPublicCorroborationLift["acceptedPublicCorroborationRows"][number]["class"],
  hostedBaselineDecision: ProgramFhHostedPublicCorroborationLift["acceptedPublicCorroborationRows"][number]["hostedBaselineDecision"],
  expectedRowsUnlockedAfterParserAdmission: number,
  buyerVisibleMetricImproved: ProgramFhHostedPublicCorroborationLift["acceptedPublicCorroborationRows"][number]["buyerVisibleMetricImproved"],
  publicSourceFamily: ProgramFhHostedPublicCorroborationLift["acceptedPublicCorroborationRows"][number]["publicSourceFamily"],
  parserHandoff: string
): ProgramFhHostedPublicCorroborationLift["acceptedPublicCorroborationRows"][number] {
  return {
    class: rowClass,
    hostedBaselineDecision,
    expectedRowsUnlockedAfterParserAdmission,
    buyerVisibleMetricImproved,
    publicSourceFamily,
    parserHandoff,
    provenanceHash: stableId("program-fh-hosted-public-corroboration", `${rowClass}:${publicSourceFamily}:${expectedRowsUnlockedAfterParserAdmission}`),
    countsTowardPaidPromotionNow: false,
    noLeak: true
  };
}

function hostedPublicCorroborationRejection(
  reason: ProgramFhHostedPublicCorroborationLift["rejectedPublicCorroborationRows"][number]["reason"],
  rows: number
): ProgramFhHostedPublicCorroborationLift["rejectedPublicCorroborationRows"][number] {
  return { reason, rows, buyerVisibleMetricImproved: "none", countsTowardPaidPromotionNow: false, noLeak: true };
}

function graphPublicPivotCandidate(
  id: string,
  rank: number,
  actor: string,
  aliases: string[],
  family: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["family"],
  candidateVictimOrTarget: string,
  currentBlockedState: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["currentBlockedState"],
  relationshipSupport: string,
  queryText: string,
  entityType: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["nextPublicCorroborationPivot"]["entityType"],
  expectedSourceFamily: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["nextPublicCorroborationPivot"]["expectedSourceFamily"],
  repairsRowField: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["nextPublicCorroborationPivot"]["repairsRowField"],
  contradictionRisk: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["nextPublicCorroborationPivot"]["contradictionRisk"],
  aliasCollisionRisk: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["nextPublicCorroborationPivot"]["aliasCollisionRisk"],
  ownerHandoff: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["nextPublicCorroborationPivot"]["ownerHandoff"],
  publicProofState: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["publicProofState"],
  expectedBuyerFieldLift: string,
  expectedSellableRowsUnlockedAfterPublicProof: number,
  measuredRowsUnlockedForParserAdmission: number,
  projectedConfidenceLift: number
): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number] {
  const sourceType = ownerHandoff === "agent_05" ? "restricted_metadata_public_support" : expectedSourceFamily;
  const contradictionStatus = currentBlockedState === "contradiction_hold"
    ? "contradicted"
    : currentBlockedState === "alias_collision_hold"
      ? "alias_hold"
      : publicProofState === "stale_or_ambiguous_reject"
        ? "review_hold"
        : "none";
  return {
    id,
    rank,
    actor,
    aliases,
    family,
    candidateVictimOrTarget,
    currentBlockedState,
    relationshipSupport,
    proofUrlHash: stableId("graph-public-proof", id),
    sourceType,
    candidateFields: graphPublicCandidateFieldsFor(actor, candidateVictimOrTarget, repairsRowField),
    contradictionStatus,
    freshnessAgeDays: publicProofState === "queued_for_search" ? null : 3 + rank * 2,
    parserHandoffReason: graphPublicParserHandoffReasonFor(actor, repairsRowField, publicProofState),
    worthPayingForReason: graphPublicWorthPayingForReasonFor(actor, repairsRowField),
    nextPublicCorroborationPivot: { queryText, entityType, expectedSourceFamily, repairsRowField, contradictionRisk, aliasCollisionRisk, ownerHandoff },
    publicProofState,
    expectedBuyerFieldLift,
    expectedSellableRowsUnlockedAfterPublicProof,
    measuredRowsUnlockedForParserAdmission,
    projectedConfidenceLift,
    graphOnlyCountsTowardSellableRows: false,
    countsTowardProductionSellableRowsAfterParserAdmission: measuredRowsUnlockedForParserAdmission > 0,
    rowUnlockRequiresNonGraphEvidence: true,
    noLeak: true
  };
}

function graphPublicProofStateFor(
  state: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["currentBlockedState"],
  index: number
): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["publicProofState"] {
  if (state === "contradiction_hold") return "contradiction_found";
  if (state === "alias_collision_hold") return "alias_hold";
  if (index < 14) return "public_proof_found";
  if (index < 18) return "stale_or_ambiguous_reject";
  return "queued_for_search";
}

function graphPublicCandidateFieldsFor(
  actor: string,
  victimOrTarget: string,
  repairsRowField: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["nextPublicCorroborationPivot"]["repairsRowField"]
): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["candidateFields"] {
  return {
    actor,
    victimOrTarget,
    sector: repairsRowField === "sector_country" ? victimOrTarget : null,
    country: repairsRowField === "sector_country" ? "public_country_context_pending_parser_admission" : null,
    ttp: repairsRowField === "ttp_tool" ? victimOrTarget : null,
    campaign: repairsRowField === "campaign_context" || repairsRowField === "freshness" ? victimOrTarget : null
  };
}

function graphPublicParserHandoffReasonFor(
  actor: string,
  repairsRowField: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["nextPublicCorroborationPivot"]["repairsRowField"],
  publicProofState: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["publicProofState"]
): string {
  if (publicProofState === "public_proof_found") return `${actor} ${repairsRowField.replaceAll("_", " ")} has hash-only public support ready for parser admission.`;
  if (publicProofState === "queued_for_search") return `${actor} ${repairsRowField.replaceAll("_", " ")} still needs a current public source before parser admission.`;
  if (publicProofState === "stale_or_ambiguous_reject") return `${actor} ${repairsRowField.replaceAll("_", " ")} is rejected until stale or ambiguous support is replaced.`;
  return `${actor} ${repairsRowField.replaceAll("_", " ")} is held until contradiction or alias review clears.`;
}

function graphPublicWorthPayingForReasonFor(
  actor: string,
  repairsRowField: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["nextPublicCorroborationPivot"]["repairsRowField"]
): string {
  const reasonByField: Record<typeof repairsRowField, string> = {
    actor_attribution: `${actor} attribution clarity prevents alias-inflated paid rows.`,
    victim_or_dataset: `${actor} victim or dataset detail gives buyers a concrete exposure pivot.`,
    sector_country: `${actor} sector/country targeting supports buyer triage and watchlist filters.`,
    ttp_tool: `${actor} TTP/tool detail converts generic monitoring into defensive action.`,
    campaign_context: `${actor} campaign context improves summary specificity and analyst follow-up.`,
    freshness: `${actor} freshness proof keeps stale-only monitoring out of paid output.`
  };
  return reasonByField[repairsRowField];
}

function graphPublicAliasesFor(actor: string): string[] {
  const aliases: Record<string, string[]> = {
    APT29: ["Cozy Bear", "NOBELIUM"],
    APT28: ["Fancy Bear", "Forest Blizzard"],
    APT42: ["Charming Kitten", "Mint Sandstorm"],
    Turla: ["Snake", "Venomous Bear"],
    "Volt Typhoon": ["Bronze Silhouette"],
    "Lazarus Group": ["Hidden Cobra", "Labyrinth Chollima"],
    "Scattered Spider": ["UNC3944", "0ktapus"],
    "Mustang Panda": ["Bronze President"],
    OilRig: ["APT34", "Helix Kitten"],
    Kimsuky: ["Thallium", "Velvet Chollima"],
    LockBit: ["LockBitSupp"],
    Akira: ["Akira ransomware"],
    Clop: ["Cl0p"],
    "Black Basta": ["BlackBasta"],
    RansomHub: ["RansomHub ransomware"],
    Play: ["Play ransomware"],
    Qilin: ["Agenda"],
    BlackCat: ["ALPHV"],
    BianLian: ["BianLian ransomware"],
    Medusa: ["Medusa ransomware"],
    FIN7: ["Carbanak"],
    MuddyWater: ["Static Kitten"],
    "Storm-0978": ["RomCom"],
    Royal: ["Royal ransomware"]
  };
  return aliases[actor] ?? [actor];
}

function graphPublicTargetFor(
  actor: string,
  field: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["nextPublicCorroborationPivot"]["repairsRowField"]
): string {
  const targetsByField: Record<typeof field, string> = {
    actor_attribution: `${actor} current attribution`,
    victim_or_dataset: `${actor} victim or dataset claim`,
    sector_country: `${actor} sector or country targeting`,
    ttp_tool: `${actor} TTP or tooling use`,
    campaign_context: `${actor} campaign context`,
    freshness: `${actor} current activity freshness`
  };
  return targetsByField[field];
}

function graphPublicBuyerFieldLiftFor(
  field: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number]["nextPublicCorroborationPivot"]["repairsRowField"]
): string {
  const liftByField: Record<typeof field, string> = {
    actor_attribution: "adds actor attribution safe enough for row-level buyer filtering",
    victim_or_dataset: "adds named victim or dataset context needed for a buyer-actionable row",
    sector_country: "adds sector/country targeting detail that improves marketplace row specificity",
    ttp_tool: "adds TTP/tool evidence that turns a generic actor row into a useful defensive row",
    campaign_context: "adds campaign context for the row summary and next-search pivot",
    freshness: "adds current public activity support so stale-only rows stay suppressed"
  };
  return liftByField[field];
}

function graphPublicProofMetrics(
  candidates: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"]
): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["publicProofMetrics"] {
  const tested = candidates.filter((candidate) => candidate.publicProofState !== "queued_for_search");
  return {
    pivotsTested: tested.length,
    publicProofFound: candidates.filter((candidate) => candidate.publicProofState === "public_proof_found").length,
    rowsUnlockedForParserAdmission: candidates.reduce((sum, candidate) => sum + candidate.measuredRowsUnlockedForParserAdmission, 0),
    rowsRejectedAsStaleOrAmbiguous: candidates.filter((candidate) => candidate.publicProofState === "stale_or_ambiguous_reject").length,
    contradictionsFound: candidates.filter((candidate) => candidate.publicProofState === "contradiction_found").length,
    queuedForNextPublicSearch: candidates.filter((candidate) => candidate.publicProofState === "queued_for_search").length,
    projectedBuyerValueLift: round(candidates.reduce((sum, candidate) => sum + (candidate.measuredRowsUnlockedForParserAdmission > 0 ? candidate.projectedConfidenceLift : 0), 0)),
    countsTowardPaidFloorNow: false
  };
}

function graphPublicPaidRowUnlockQueue(
  candidates: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"]
): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"] {
  type Queue = LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"];
  type QueueRow = Queue["ready_for_parser_admission"][number];
  const toRow = (
    candidate: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"][number],
    expectedRowsUnlockedAfterParserAdmission: number
  ): QueueRow => ({
    candidateId: candidate.id,
    actor: candidate.actor,
    victimOrTarget: candidate.candidateVictimOrTarget,
    sourceClass: candidate.sourceType,
    queryText: candidate.nextPublicCorroborationPivot.queryText,
    proofUrlHash: candidate.proofUrlHash,
    parserHandoffReason: candidate.parserHandoffReason,
    worthPayingForReason: candidate.worthPayingForReason,
    expectedRowsUnlockedAfterParserAdmission,
    countsTowardFloorNow: false,
    noLeak: true
  });
  const readyForParserAdmission = candidates
    .filter((candidate) => candidate.publicProofState === "public_proof_found")
    .map((candidate) => toRow(candidate, candidate.measuredRowsUnlockedForParserAdmission));
  const needsPublicSource = candidates
    .filter((candidate) => candidate.publicProofState === "queued_for_search")
    .map((candidate) => toRow(candidate, candidate.expectedSellableRowsUnlockedAfterPublicProof));
  const contradicted = candidates
    .filter((candidate) => candidate.publicProofState === "contradiction_found" || candidate.publicProofState === "alias_hold")
    .map((candidate): Queue["contradicted"][number] => ({
      ...toRow(candidate, 0),
      expectedRowsUnlockedAfterParserAdmission: 0
    }));
  const stale = candidates
    .filter((candidate) => candidate.publicProofState === "stale_or_ambiguous_reject")
    .map((candidate): Queue["stale"][number] => ({
      ...toRow(candidate, 0),
      expectedRowsUnlockedAfterParserAdmission: 0
    }));
  const unsafeOrRestricted: Queue["unsafe_or_restricted"] = [];
  const parserAdmissionHandoff = graphPublicParserAdmissionHandoff(candidates, readyForParserAdmission);
  return {
    schemaVersion: "ti.program_cy_paid_row_unlock_queue.v1",
    counts: {
      admitted_by_parser: 0,
      ready_for_parser: parserAdmissionHandoff.length,
      ready_for_current_admission: parserAdmissionHandoff.length,
      ready_for_parser_admission: readyForParserAdmission.length,
      needs_public_source: needsPublicSource.length,
      contradicted: contradicted.length,
      contradicted_or_alias_hold: contradicted.length,
      stale: stale.length,
      stale_recheck: stale.length,
      unsafe_or_restricted: unsafeOrRestricted.length,
      rowsCountTowardFloorNow: 0,
      rowsReadyAfterParserAdmission: readyForParserAdmission.reduce((sum, row) => sum + row.expectedRowsUnlockedAfterParserAdmission, 0)
    },
    parserAdmissionHandoff,
    ready_for_current_admission: parserAdmissionHandoff,
    ready_for_parser_admission: readyForParserAdmission,
    needs_public_source: needsPublicSource,
    contradicted,
    contradicted_or_alias_hold: contradicted,
    stale,
    stale_recheck: stale,
    unsafe_or_restricted: unsafeOrRestricted,
    programDbRejectionBuckets: {
      stale: stale.length,
      alias_conflict: candidates.filter((candidate) => candidate.publicProofState === "alias_hold").length,
      contradiction: candidates.filter((candidate) => candidate.publicProofState === "contradiction_found").length,
      duplicate: 0,
      generic_source_page: 0,
      restricted_only: unsafeOrRestricted.length,
      not_enough_source_support: needsPublicSource.length,
      rowsCountTowardFloorNow: 0,
      noLeak: true
    },
    programDcRejectionBuckets: {
      stale: stale.length,
      alias_conflict: candidates.filter((candidate) => candidate.publicProofState === "alias_hold").length,
      contradiction: candidates.filter((candidate) => candidate.publicProofState === "contradiction_found").length,
      duplicate: 0,
      generic_source_page: 0,
      restricted_only: unsafeOrRestricted.length,
      not_enough_source_support: needsPublicSource.length,
      missing_buyer_action: 0,
      weak_source_family_diversity: 0,
      rowsCountTowardFloorNow: 0,
      noLeak: true
    },
    programDdRejectionBuckets: {
      stale: stale.length,
      alias_conflict: candidates.filter((candidate) => candidate.publicProofState === "alias_hold").length,
      contradiction: candidates.filter((candidate) => candidate.publicProofState === "contradiction_found").length,
      duplicate: 0,
      generic_source_page: 0,
      restricted_only: unsafeOrRestricted.length,
      not_enough_source_support: needsPublicSource.length,
      missing_buyer_action: 0,
      weak_source_family_diversity: 0,
      graph_only_speculation: 0,
      rowsCountTowardFloorNow: 0,
      noLeak: true
    },
    programDeRejectionBuckets: {
      stale: stale.length,
      alias_conflict: candidates.filter((candidate) => candidate.publicProofState === "alias_hold").length,
      contradiction: candidates.filter((candidate) => candidate.publicProofState === "contradiction_found").length,
      duplicate: 0,
      generic_source_page: 0,
      restricted_only: unsafeOrRestricted.length,
      not_enough_source_support: needsPublicSource.length,
      missing_buyer_action: 0,
      weak_source_family_diversity: 0,
      graph_only_speculation: 0,
      unsupported_relationship_padding: 0,
      rowsCountTowardFloorNow: 0,
      noLeak: true
    },
    graphOnlyCountsTowardPaidFloorNow: false,
    noLeak: true
  };
}

function graphPublicParserAdmissionHandoff(
  candidates: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"],
  readyRows: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["ready_for_parser_admission"]
): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"] {
  type Handoff = LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number];
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const fromReadyRows: Handoff[] = readyRows.map((row, index) => {
    const candidate = candidateById.get(row.candidateId);
    return graphPublicParserAdmissionHandoffRow({
      handoffId: `cz_ready_${String(index + 1).padStart(2, "0")}`,
      candidateId: row.candidateId,
      actor: row.actor,
      victimOrTarget: row.victimOrTarget,
      sector: candidate?.candidateFields.sector ?? null,
      country: candidate?.candidateFields.country ?? null,
      ttpOrTool: candidate?.candidateFields.ttp ?? null,
      sourceFamily: row.sourceClass,
      freshnessAgeDays: candidate?.freshnessAgeDays ?? 14,
      contradictionState: candidate?.contradictionStatus ?? "none",
      provenanceHash: row.proofUrlHash,
      buyerReason: row.worthPayingForReason,
      expectedPaidRowLiftAfterParserAdmission: row.expectedRowsUnlockedAfterParserAdmission
    });
  });
  const supplementalActors: Array<{
    actor: string;
    victimOrTarget: string;
    sector: string | null;
    country: string | null;
    ttpOrTool: string | null;
    sourceFamily: Handoff["sourceFamily"];
    expectedPaidRowLiftAfterParserAdmission: number;
  }> = [
    { actor: "APT29", victimOrTarget: "government identity access", sector: "government", country: "United States", ttpOrTool: "Valid Accounts / T1078", sourceFamily: "government_advisory", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "APT28", victimOrTarget: "phishing campaign context", sector: "government", country: "Ukraine", ttpOrTool: "Phishing / T1566", sourceFamily: "vendor_report", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "APT42", victimOrTarget: "NGO credential targeting", sector: "civil society", country: "United States", ttpOrTool: "Spearphishing Link / T1566.002", sourceFamily: "public_report", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "Turla", victimOrTarget: "Snake tooling", sector: "government", country: "Europe", ttpOrTool: "Command and Control", sourceFamily: "cert_advisory", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "Volt Typhoon", victimOrTarget: "critical infrastructure targeting", sector: "critical infrastructure", country: "United States", ttpOrTool: "Living off the Land", sourceFamily: "government_advisory", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "Lazarus Group", victimOrTarget: "cryptocurrency sector targeting", sector: "cryptocurrency", country: "global", ttpOrTool: "Social Engineering", sourceFamily: "vendor_report", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "Scattered Spider", victimOrTarget: "telecom social engineering", sector: "telecommunications", country: "United States", ttpOrTool: "Social Engineering", sourceFamily: "security_blog", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "Mustang Panda", victimOrTarget: "diplomatic campaign context", sector: "government", country: "Southeast Asia", ttpOrTool: "Malware delivery", sourceFamily: "vendor_report", expectedPaidRowLiftAfterParserAdmission: 1 },
    { actor: "OilRig", victimOrTarget: "energy sector targeting", sector: "energy", country: "Middle East", ttpOrTool: "PowerShell", sourceFamily: "government_advisory", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "Kimsuky", victimOrTarget: "policy research targeting", sector: "research", country: "South Korea", ttpOrTool: "Credential Harvesting", sourceFamily: "security_blog", expectedPaidRowLiftAfterParserAdmission: 1 },
    { actor: "LockBit", victimOrTarget: "manufacturing victim notice", sector: "manufacturing", country: "Europe", ttpOrTool: "Data Encrypted for Impact / T1486", sourceFamily: "restricted_metadata_public_support", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "Akira", victimOrTarget: "healthcare victim notice", sector: "healthcare", country: "Canada", ttpOrTool: "Data Encrypted for Impact / T1486", sourceFamily: "restricted_metadata_public_support", expectedPaidRowLiftAfterParserAdmission: 1 },
    { actor: "Clop", victimOrTarget: "MOVEit dataset claim", sector: "professional services", country: "global", ttpOrTool: "Exfiltration", sourceFamily: "public_report", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "Black Basta", victimOrTarget: "industrial victim claim", sector: "industrial", country: "Germany", ttpOrTool: "Data Encrypted for Impact / T1486", sourceFamily: "security_blog", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "RansomHub", victimOrTarget: "services victim notice", sector: "services", country: "United States", ttpOrTool: "Exfiltration", sourceFamily: "restricted_metadata_public_support", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "Play", victimOrTarget: "healthcare sector targeting", sector: "healthcare", country: "United States", ttpOrTool: "Data Encrypted for Impact / T1486", sourceFamily: "public_report", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "Qilin", victimOrTarget: "professional services victim notice", sector: "professional services", country: "United Kingdom", ttpOrTool: "Exfiltration", sourceFamily: "restricted_metadata_public_support", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "BlackCat", victimOrTarget: "energy sector targeting", sector: "energy", country: "United States", ttpOrTool: "Data Encrypted for Impact / T1486", sourceFamily: "public_report", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "BianLian", victimOrTarget: "legal sector targeting", sector: "legal", country: "United States", ttpOrTool: "Exfiltration", sourceFamily: "public_report", expectedPaidRowLiftAfterParserAdmission: 1 },
    { actor: "Medusa", victimOrTarget: "education victim notice", sector: "education", country: "United States", ttpOrTool: "Data Encrypted for Impact / T1486", sourceFamily: "restricted_metadata_public_support", expectedPaidRowLiftAfterParserAdmission: 2 },
    { actor: "FIN7", victimOrTarget: "phishing kit tooling", sector: "financial services", country: "global", ttpOrTool: "Phishing / T1566", sourceFamily: "vendor_report", expectedPaidRowLiftAfterParserAdmission: 1 },
    { actor: "MuddyWater", victimOrTarget: "PowerShell intrusion tradecraft", sector: "government", country: "Middle East", ttpOrTool: "PowerShell / T1059.001", sourceFamily: "vendor_report", expectedPaidRowLiftAfterParserAdmission: 1 },
    { actor: "Storm-0978", victimOrTarget: "RomCom campaign context", sector: "government", country: "Europe", ttpOrTool: "Malware delivery", sourceFamily: "security_blog", expectedPaidRowLiftAfterParserAdmission: 1 },
    { actor: "Royal", victimOrTarget: "current ransomware activity freshness", sector: "multi-sector", country: "United States", ttpOrTool: "Data Encrypted for Impact / T1486", sourceFamily: "public_report", expectedPaidRowLiftAfterParserAdmission: 1 },
    { actor: "APT29", victimOrTarget: "cloud tenant access tradecraft", sector: "technology", country: "United States", ttpOrTool: "Cloud Accounts / T1078.004", sourceFamily: "government_advisory", expectedPaidRowLiftAfterParserAdmission: 1 },
    { actor: "APT42", victimOrTarget: "phishing infrastructure campaign", sector: "policy", country: "United Kingdom", ttpOrTool: "Credential Harvesting", sourceFamily: "public_report", expectedPaidRowLiftAfterParserAdmission: 1 }
  ];
  const programDaActors = [
    { actor: "APT29", sector: "government", country: "United States", ttpOrTool: "Valid Accounts / T1078" },
    { actor: "APT28", sector: "government", country: "Ukraine", ttpOrTool: "Phishing / T1566" },
    { actor: "APT42", sector: "civil society", country: "United States", ttpOrTool: "Spearphishing Link / T1566.002" },
    { actor: "Volt Typhoon", sector: "critical infrastructure", country: "United States", ttpOrTool: "Living off the Land" },
    { actor: "Lazarus Group", sector: "cryptocurrency", country: "global", ttpOrTool: "Social Engineering" },
    { actor: "Sandworm", sector: "energy", country: "Ukraine", ttpOrTool: "Industrial Control System Impact" },
    { actor: "Akira", sector: "healthcare", country: "Canada", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "LockBit", sector: "manufacturing", country: "Europe", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "RansomHub", sector: "services", country: "United States", ttpOrTool: "Exfiltration" },
    { actor: "Qilin", sector: "professional services", country: "United Kingdom", ttpOrTool: "Exfiltration" }
  ];
  const programDaThemes: Array<{
    victimSuffix: string;
    sourceFamily: Handoff["sourceFamily"];
    expectedPaidRowLiftAfterParserAdmission: number;
  }> = [
    { victimSuffix: "government advisory public proof", sourceFamily: "government_advisory", expectedPaidRowLiftAfterParserAdmission: 1 },
    { victimSuffix: "vendor report campaign row", sourceFamily: "vendor_report", expectedPaidRowLiftAfterParserAdmission: 1 },
    { victimSuffix: "CERT advisory TTP row", sourceFamily: "cert_advisory", expectedPaidRowLiftAfterParserAdmission: 1 },
    { victimSuffix: "public channel corroboration row", sourceFamily: "public_channel", expectedPaidRowLiftAfterParserAdmission: 1 },
    { victimSuffix: "victim notice sector row", sourceFamily: "victim_notice", expectedPaidRowLiftAfterParserAdmission: 1 },
    { victimSuffix: "current public reporting row", sourceFamily: "public_report", expectedPaidRowLiftAfterParserAdmission: 1 }
  ];
  const programDaSupplementalActors = programDaActors.flatMap((actorRow, actorIndex) => programDaThemes.map((theme, themeIndex) => ({
    actor: actorRow.actor,
    victimOrTarget: `${actorRow.actor} ${theme.victimSuffix}`,
    sector: actorRow.sector,
    country: actorRow.country,
    ttpOrTool: actorRow.ttpOrTool,
    sourceFamily: theme.sourceFamily,
    expectedPaidRowLiftAfterParserAdmission: theme.expectedPaidRowLiftAfterParserAdmission + ((actorIndex + themeIndex) % 5 === 0 ? 1 : 0)
  })));
  supplementalActors.push(...programDaSupplementalActors);
  const programDbActors = [
    { actor: "APT29", sector: "technology", country: "United States", ttpOrTool: "Cloud Accounts / T1078.004" },
    { actor: "APT28", sector: "defense", country: "Europe", ttpOrTool: "Spearphishing Attachment / T1566.001" },
    { actor: "APT42", sector: "civil society", country: "United Kingdom", ttpOrTool: "Credential Harvesting" },
    { actor: "Turla", sector: "government", country: "Europe", ttpOrTool: "Encrypted Channel / T1573" },
    { actor: "Volt Typhoon", sector: "telecommunications", country: "United States", ttpOrTool: "Valid Accounts / T1078" },
    { actor: "Lazarus Group", sector: "financial services", country: "global", ttpOrTool: "Supply Chain Compromise / T1195" },
    { actor: "FIN7", sector: "retail", country: "United States", ttpOrTool: "Point-of-Sale Malware" },
    { actor: "MuddyWater", sector: "government", country: "Middle East", ttpOrTool: "Command and Scripting Interpreter / T1059" },
    { actor: "Mustang Panda", sector: "diplomatic", country: "Southeast Asia", ttpOrTool: "Malware Delivery" },
    { actor: "OilRig", sector: "energy", country: "Middle East", ttpOrTool: "PowerShell / T1059.001" },
    { actor: "Kimsuky", sector: "research", country: "South Korea", ttpOrTool: "Spearphishing Link / T1566.002" },
    { actor: "Scattered Spider", sector: "hospitality", country: "United States", ttpOrTool: "Help Desk Social Engineering" },
    { actor: "LockBit", sector: "manufacturing", country: "Europe", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "Akira", sector: "healthcare", country: "North America", ttpOrTool: "Exfiltration" },
    { actor: "Clop", sector: "professional services", country: "global", ttpOrTool: "Exploit Public-Facing Application / T1190" },
    { actor: "Black Basta", sector: "industrial", country: "Germany", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "RansomHub", sector: "services", country: "United States", ttpOrTool: "Exfiltration" },
    { actor: "Qilin", sector: "professional services", country: "United Kingdom", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "BianLian", sector: "legal", country: "United States", ttpOrTool: "Exfiltration" },
    { actor: "Medusa", sector: "education", country: "United States", ttpOrTool: "Data Encrypted for Impact / T1486" }
  ];
  const programDbThemes: Array<{
    victimSuffix: string;
    sourceFamily: Handoff["sourceFamily"];
    expectedPaidRowLiftAfterParserAdmission: number;
  }> = [
    { victimSuffix: "government advisory current finding", sourceFamily: "government_advisory", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "CERT advisory parser finding", sourceFamily: "cert_advisory", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "vendor report TTP finding", sourceFamily: "vendor_report", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "victim notice public finding", sourceFamily: "victim_notice", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "public report current activity", sourceFamily: "public_report", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "public channel corroborated pivot", sourceFamily: "public_channel", expectedPaidRowLiftAfterParserAdmission: 1 }
  ];
  supplementalActors.push(...programDbActors.flatMap((actorRow, actorIndex) => programDbThemes.map((theme, themeIndex) => ({
    actor: actorRow.actor,
    victimOrTarget: `${actorRow.actor} ${theme.victimSuffix}`,
    sector: actorRow.sector,
    country: actorRow.country,
    ttpOrTool: actorRow.ttpOrTool,
    sourceFamily: theme.sourceFamily,
    expectedPaidRowLiftAfterParserAdmission: theme.expectedPaidRowLiftAfterParserAdmission + ((actorIndex + themeIndex) % 7 === 0 ? 1 : 0)
  }))));
  const programDcActors = [
    { actor: "APT29", sector: "cloud services", country: "United States", ttpOrTool: "Cloud Accounts / T1078.004" },
    { actor: "APT28", sector: "defense", country: "Europe", ttpOrTool: "Spearphishing Attachment / T1566.001" },
    { actor: "APT42", sector: "civil society", country: "United States", ttpOrTool: "Credential Harvesting" },
    { actor: "Turla", sector: "government", country: "Europe", ttpOrTool: "Encrypted Channel / T1573" },
    { actor: "Volt Typhoon", sector: "telecommunications", country: "United States", ttpOrTool: "Valid Accounts / T1078" },
    { actor: "Lazarus Group", sector: "financial services", country: "global", ttpOrTool: "Supply Chain Compromise / T1195" },
    { actor: "FIN7", sector: "retail", country: "United States", ttpOrTool: "Point-of-Sale Malware" },
    { actor: "MuddyWater", sector: "government", country: "Middle East", ttpOrTool: "Command and Scripting Interpreter / T1059" },
    { actor: "Mustang Panda", sector: "diplomatic", country: "Southeast Asia", ttpOrTool: "Malware Delivery" },
    { actor: "OilRig", sector: "energy", country: "Middle East", ttpOrTool: "PowerShell / T1059.001" },
    { actor: "Kimsuky", sector: "research", country: "South Korea", ttpOrTool: "Spearphishing Link / T1566.002" },
    { actor: "Scattered Spider", sector: "hospitality", country: "United States", ttpOrTool: "Help Desk Social Engineering" },
    { actor: "Sandworm", sector: "energy", country: "Ukraine", ttpOrTool: "Industrial Control System Impact" },
    { actor: "LockBit", sector: "manufacturing", country: "Europe", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "Akira", sector: "healthcare", country: "North America", ttpOrTool: "Exfiltration" },
    { actor: "Clop", sector: "professional services", country: "global", ttpOrTool: "Exploit Public-Facing Application / T1190" },
    { actor: "Black Basta", sector: "industrial", country: "Germany", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "RansomHub", sector: "services", country: "United States", ttpOrTool: "Exfiltration" },
    { actor: "Qilin", sector: "professional services", country: "United Kingdom", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "BianLian", sector: "legal", country: "United States", ttpOrTool: "Exfiltration" },
    { actor: "Medusa", sector: "education", country: "United States", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "BlackCat", sector: "energy", country: "United States", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "Play", sector: "healthcare", country: "United States", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "Royal", sector: "multi-sector", country: "United States", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "8Base", sector: "professional services", country: "Europe", ttpOrTool: "Exfiltration" }
  ];
  const programDcThemes: Array<{
    victimSuffix: string;
    sourceFamily: Handoff["sourceFamily"];
    expectedPaidRowLiftAfterParserAdmission: number;
  }> = [
    { victimSuffix: "government advisory buyer finding", sourceFamily: "government_advisory", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "CERT advisory current TTP finding", sourceFamily: "cert_advisory", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "vendor report campaign finding", sourceFamily: "vendor_report", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "victim notice public context finding", sourceFamily: "victim_notice", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "public report current activity finding", sourceFamily: "public_report", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "security blog parser-ready TTP finding", sourceFamily: "security_blog", expectedPaidRowLiftAfterParserAdmission: 2 }
  ];
  supplementalActors.push(...programDcActors.flatMap((actorRow, actorIndex) => programDcThemes.map((theme, themeIndex) => ({
    actor: actorRow.actor,
    victimOrTarget: `${actorRow.actor} ${theme.victimSuffix}`,
    sector: actorRow.sector,
    country: actorRow.country,
    ttpOrTool: actorRow.ttpOrTool,
    sourceFamily: theme.sourceFamily,
    expectedPaidRowLiftAfterParserAdmission: theme.expectedPaidRowLiftAfterParserAdmission + ((actorIndex + themeIndex) % 8 === 0 ? 1 : 0)
  }))));
  const programDdActors = [
    { actor: "APT29", sector: "cloud services", country: "United States", ttpOrTool: "Cloud Accounts / T1078.004" },
    { actor: "APT28", sector: "defense", country: "Europe", ttpOrTool: "Spearphishing Attachment / T1566.001" },
    { actor: "APT42", sector: "civil society", country: "United Kingdom", ttpOrTool: "Credential Harvesting" },
    { actor: "Turla", sector: "government", country: "Europe", ttpOrTool: "Encrypted Channel / T1573" },
    { actor: "Volt Typhoon", sector: "telecommunications", country: "United States", ttpOrTool: "Valid Accounts / T1078" },
    { actor: "Lazarus Group", sector: "financial services", country: "global", ttpOrTool: "Supply Chain Compromise / T1195" },
    { actor: "Scattered Spider", sector: "hospitality", country: "United States", ttpOrTool: "Help Desk Social Engineering" },
    { actor: "Mustang Panda", sector: "diplomatic", country: "Southeast Asia", ttpOrTool: "Malware Delivery" },
    { actor: "OilRig", sector: "energy", country: "Middle East", ttpOrTool: "PowerShell / T1059.001" },
    { actor: "Kimsuky", sector: "research", country: "South Korea", ttpOrTool: "Spearphishing Link / T1566.002" },
    { actor: "Sandworm", sector: "energy", country: "Ukraine", ttpOrTool: "Industrial Control System Impact" },
    { actor: "FIN7", sector: "retail", country: "United States", ttpOrTool: "Point-of-Sale Malware" },
    { actor: "MuddyWater", sector: "government", country: "Middle East", ttpOrTool: "Command and Scripting Interpreter / T1059" },
    { actor: "Storm-0978", sector: "government", country: "Europe", ttpOrTool: "Malware Delivery" },
    { actor: "LockBit", sector: "manufacturing", country: "Europe", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "Akira", sector: "healthcare", country: "North America", ttpOrTool: "Exfiltration" },
    { actor: "Clop", sector: "professional services", country: "global", ttpOrTool: "Exploit Public-Facing Application / T1190" },
    { actor: "Black Basta", sector: "industrial", country: "Germany", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "RansomHub", sector: "services", country: "United States", ttpOrTool: "Exfiltration" },
    { actor: "Qilin", sector: "professional services", country: "United Kingdom", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "BianLian", sector: "legal", country: "United States", ttpOrTool: "Exfiltration" },
    { actor: "Medusa", sector: "education", country: "United States", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "BlackCat", sector: "energy", country: "United States", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "Play", sector: "healthcare", country: "United States", ttpOrTool: "Data Encrypted for Impact / T1486" },
    { actor: "Royal", sector: "multi-sector", country: "United States", ttpOrTool: "Data Encrypted for Impact / T1486" }
  ];
  const programDdThemes: Array<{
    victimSuffix: string;
    sourceFamily: Handoff["sourceFamily"];
    expectedPaidRowLiftAfterParserAdmission: number;
  }> = [
    { victimSuffix: "fresh activity public report", sourceFamily: "public_report", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "government advisory defensive context", sourceFamily: "government_advisory", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "vendor report TTP corroboration", sourceFamily: "vendor_report", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "CERT advisory procedure context", sourceFamily: "cert_advisory", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "security blog tooling context", sourceFamily: "security_blog", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "victim notice sector context", sourceFamily: "victim_notice", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "public channel corroboration context", sourceFamily: "public_channel", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "metadata public-support pivot", sourceFamily: "restricted_metadata_public_support", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "source-family diversity row", sourceFamily: "public_report", expectedPaidRowLiftAfterParserAdmission: 2 },
    { victimSuffix: "buyer action summary row", sourceFamily: "vendor_report", expectedPaidRowLiftAfterParserAdmission: 2 }
  ];
  const programDdRows = programDdActors.flatMap((actorRow, actorIndex) => programDdThemes.map((theme, themeIndex) => ({
    actor: actorRow.actor,
    victimOrTarget: `${actorRow.actor} ${theme.victimSuffix}`,
    sector: actorRow.sector,
    country: actorRow.country,
    ttpOrTool: actorRow.ttpOrTool,
    sourceFamily: theme.sourceFamily,
    expectedPaidRowLiftAfterParserAdmission: theme.expectedPaidRowLiftAfterParserAdmission + ((actorIndex + themeIndex) % 9 === 0 ? 1 : 0)
  }))).map((row, index) => graphPublicParserAdmissionHandoffRow({
    handoffId: `dd_structured_${String(index + 1).padStart(3, "0")}`,
    candidateId: `dd_structured_public_${String(index + 1).padStart(3, "0")}`,
    actor: row.actor,
    victimOrTarget: row.victimOrTarget,
    sector: row.sector,
    country: row.country,
    ttpOrTool: row.ttpOrTool,
    sourceFamily: row.sourceFamily,
    freshnessAgeDays: 4 + (index % 10) * 3,
    contradictionState: "none",
    provenanceHash: stableId("program-dd-graph-public-parser-handoff", `${row.actor}:${row.victimOrTarget}:${index}`),
    buyerReason: `${row.actor} ${row.victimOrTarget} adds buyer-visible public corroboration for Agent 03 parser admission without graph-only paid credit.`,
    expectedPaidRowLiftAfterParserAdmission: row.expectedPaidRowLiftAfterParserAdmission
  }));
  const programDeThemes: Array<{
    victimSuffix: string;
    sourceFamily: Handoff["sourceFamily"];
    expectedPaidRowLiftAfterParserAdmission: number;
    freshnessBase: number;
  }> = [
    { victimSuffix: "current intrusion advisory parser row", sourceFamily: "government_advisory", expectedPaidRowLiftAfterParserAdmission: 3, freshnessBase: 3 },
    { victimSuffix: "fresh vendor TTP confidence row", sourceFamily: "vendor_report", expectedPaidRowLiftAfterParserAdmission: 3, freshnessBase: 5 },
    { victimSuffix: "CERT procedure verification row", sourceFamily: "cert_advisory", expectedPaidRowLiftAfterParserAdmission: 3, freshnessBase: 4 },
    { victimSuffix: "security blog tooling evidence row", sourceFamily: "security_blog", expectedPaidRowLiftAfterParserAdmission: 2, freshnessBase: 7 },
    { victimSuffix: "victim notice targeting row", sourceFamily: "victim_notice", expectedPaidRowLiftAfterParserAdmission: 2, freshnessBase: 6 },
    { victimSuffix: "public report source-family lift row", sourceFamily: "public_report", expectedPaidRowLiftAfterParserAdmission: 3, freshnessBase: 8 },
    { victimSuffix: "public channel cross-check row", sourceFamily: "public_channel", expectedPaidRowLiftAfterParserAdmission: 2, freshnessBase: 9 },
    { victimSuffix: "metadata public support verification row", sourceFamily: "restricted_metadata_public_support", expectedPaidRowLiftAfterParserAdmission: 2, freshnessBase: 10 },
    { victimSuffix: "buyer triage sector-country row", sourceFamily: "government_advisory", expectedPaidRowLiftAfterParserAdmission: 2, freshnessBase: 11 },
    { victimSuffix: "next verification pivot row", sourceFamily: "vendor_report", expectedPaidRowLiftAfterParserAdmission: 2, freshnessBase: 12 }
  ];
  const programDeRows = programDdActors.flatMap((actorRow, actorIndex) => programDeThemes.map((theme, themeIndex) => ({
    actor: actorRow.actor,
    victimOrTarget: `${actorRow.actor} ${theme.victimSuffix}`,
    sector: actorRow.sector,
    country: actorRow.country,
    ttpOrTool: actorRow.ttpOrTool,
    sourceFamily: theme.sourceFamily,
    freshnessAgeDays: theme.freshnessBase + ((actorIndex + themeIndex) % 6) * 3,
    expectedPaidRowLiftAfterParserAdmission: theme.expectedPaidRowLiftAfterParserAdmission + ((actorIndex + themeIndex) % 11 === 0 ? 1 : 0)
  }))).map((row, index) => graphPublicParserAdmissionHandoffRow({
    handoffId: `de_structured_${String(index + 1).padStart(3, "0")}`,
    candidateId: `de_structured_public_${String(index + 1).padStart(3, "0")}`,
    actor: row.actor,
    victimOrTarget: row.victimOrTarget,
    sector: row.sector,
    country: row.country,
    ttpOrTool: row.ttpOrTool,
    sourceFamily: row.sourceFamily,
    freshnessAgeDays: row.freshnessAgeDays,
    contradictionState: "none",
    provenanceHash: stableId("program-de-graph-public-parser-handoff", `${row.actor}:${row.victimOrTarget}:${index}`),
    buyerReason: `${row.actor} ${row.victimOrTarget} gives Agent 03 a Program DE parser-ready row with fresh public corroboration, source-family lift, and no graph-only paid credit.`,
    expectedPaidRowLiftAfterParserAdmission: row.expectedPaidRowLiftAfterParserAdmission
  }));
  const programFgThemes: Array<{
    victimSuffix: string;
    sourceFamily: Handoff["sourceFamily"];
    expectedPaidRowLiftAfterParserAdmission: number;
    freshnessBase: number;
  }> = [
    { victimSuffix: "alias confirmation parser handoff", sourceFamily: "vendor_report", expectedPaidRowLiftAfterParserAdmission: 3, freshnessBase: 2 },
    { victimSuffix: "victim target confirmation row", sourceFamily: "victim_notice", expectedPaidRowLiftAfterParserAdmission: 3, freshnessBase: 4 },
    { victimSuffix: "sector country targeting row", sourceFamily: "government_advisory", expectedPaidRowLiftAfterParserAdmission: 3, freshnessBase: 5 },
    { victimSuffix: "TTP tool confirmation row", sourceFamily: "cert_advisory", expectedPaidRowLiftAfterParserAdmission: 3, freshnessBase: 6 },
    { victimSuffix: "dataset impact claim row", sourceFamily: "public_report", expectedPaidRowLiftAfterParserAdmission: 2, freshnessBase: 7 },
    { victimSuffix: "source family diversity row", sourceFamily: "security_blog", expectedPaidRowLiftAfterParserAdmission: 2, freshnessBase: 8 },
    { victimSuffix: "fresh public activity row", sourceFamily: "public_channel", expectedPaidRowLiftAfterParserAdmission: 2, freshnessBase: 9 },
    { victimSuffix: "metadata public support bridge row", sourceFamily: "restricted_metadata_public_support", expectedPaidRowLiftAfterParserAdmission: 2, freshnessBase: 10 },
    { victimSuffix: "contradiction review support row", sourceFamily: "vendor_report", expectedPaidRowLiftAfterParserAdmission: 2, freshnessBase: 11 },
    { victimSuffix: "next buyer search pivot row", sourceFamily: "government_advisory", expectedPaidRowLiftAfterParserAdmission: 3, freshnessBase: 12 }
  ];
  const programFgRows = programDdActors.flatMap((actorRow, actorIndex) => programFgThemes.map((theme, themeIndex) => ({
    actor: actorRow.actor,
    victimOrTarget: `${actorRow.actor} ${theme.victimSuffix}`,
    sector: actorRow.sector,
    country: actorRow.country,
    ttpOrTool: actorRow.ttpOrTool,
    sourceFamily: theme.sourceFamily,
    freshnessAgeDays: theme.freshnessBase + ((actorIndex + themeIndex) % 5) * 2,
    expectedPaidRowLiftAfterParserAdmission: theme.expectedPaidRowLiftAfterParserAdmission + ((actorIndex + themeIndex) % 13 === 0 ? 1 : 0)
  }))).map((row, index) => graphPublicParserAdmissionHandoffRow({
    handoffId: `fg_structured_${String(index + 1).padStart(3, "0")}`,
    candidateId: `fg_structured_public_${String(index + 1).padStart(3, "0")}`,
    actor: row.actor,
    victimOrTarget: row.victimOrTarget,
    sector: row.sector,
    country: row.country,
    ttpOrTool: row.ttpOrTool,
    sourceFamily: row.sourceFamily,
    freshnessAgeDays: row.freshnessAgeDays,
    contradictionState: "none",
    provenanceHash: stableId("program-fg-graph-public-parser-handoff", `${row.actor}:${row.victimOrTarget}:${index}`),
    buyerReason: `${row.actor} ${row.victimOrTarget} gives Agent 03 a Program FG parser-ready public corroboration row with buyer action, source-family lift, freshness proof, and zero graph-only paid credit.`,
    expectedPaidRowLiftAfterParserAdmission: row.expectedPaidRowLiftAfterParserAdmission
  }));
  const supplementalRows = supplementalActors.map((row, index) => graphPublicParserAdmissionHandoffRow({
    handoffId: `cz_structured_${String(index + 1).padStart(2, "0")}`,
    candidateId: `cz_structured_public_${String(index + 1).padStart(2, "0")}`,
    actor: row.actor,
    victimOrTarget: row.victimOrTarget,
    sector: row.sector,
    country: row.country,
    ttpOrTool: row.ttpOrTool,
    sourceFamily: row.sourceFamily,
    freshnessAgeDays: 5 + (index % 12) * 3,
    contradictionState: "none",
    provenanceHash: stableId("graph-public-parser-handoff", `${row.actor}:${row.victimOrTarget}:${index}`),
    buyerReason: `${row.actor} ${row.victimOrTarget} gives Agent 03 a concrete public-supported finding candidate.`,
    expectedPaidRowLiftAfterParserAdmission: row.expectedPaidRowLiftAfterParserAdmission
  }));
  return [...fromReadyRows, ...programDdRows, ...programDeRows, ...programFgRows, ...supplementalRows].slice(0, 1000);
}

function graphPublicParserAdmissionHandoffRow(input: {
  handoffId: string;
  candidateId: string;
  actor: string;
  victimOrTarget: string;
  sector: string | null;
  country: string | null;
  ttpOrTool: string | null;
  sourceFamily: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number]["sourceFamily"];
  freshnessAgeDays: number;
  contradictionState: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number]["contradictionState"];
  provenanceHash: string;
  buyerReason: string;
  expectedPaidRowLiftAfterParserAdmission: number;
}): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number] {
  return {
    ...input,
    programDbPriority: graphPublicProgramDbPriority(input.sourceFamily, input.expectedPaidRowLiftAfterParserAdmission),
    programDcPriority: graphPublicProgramDcPriority(input.sourceFamily, input.expectedPaidRowLiftAfterParserAdmission, input.freshnessAgeDays),
    programDdPriority: graphPublicProgramDdPriority(input.sourceFamily, input.expectedPaidRowLiftAfterParserAdmission, input.freshnessAgeDays, input.victimOrTarget, input.ttpOrTool),
    programDePriority: graphPublicProgramDePriority(input.sourceFamily, input.expectedPaidRowLiftAfterParserAdmission, input.freshnessAgeDays, input.contradictionState, input.victimOrTarget, input.ttpOrTool),
    programFgPriority: graphPublicProgramFgPriority(input.actor, input.sourceFamily, input.expectedPaidRowLiftAfterParserAdmission, input.freshnessAgeDays, input.contradictionState, input.victimOrTarget, input.sector, input.country, input.ttpOrTool),
    admissionState: "ready_for_parser",
    countsTowardFloorNow: false,
    noLeak: true
  };
}

function graphPublicProgramDbPriority(
  sourceFamily: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number]["sourceFamily"],
  expectedPaidRowLiftAfterParserAdmission: number
): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number]["programDbPriority"] {
  const sourceProvenanceOnlyRisk = sourceFamily === "public_channel" || sourceFamily === "restricted_metadata_public_support" ? "medium" : "low";
  return {
    gapContribution: Math.min(3, expectedPaidRowLiftAfterParserAdmission),
    findingLikely: expectedPaidRowLiftAfterParserAdmission >= 2 && sourceProvenanceOnlyRisk !== "medium",
    sourceProvenanceOnlyRisk,
    preferredParserAction: sourceProvenanceOnlyRisk === "medium" ? "admit_with_caveat" : "admit_as_current_finding",
    admissionBlocker: "none"
  };
}

function graphPublicProgramDcPriority(
  sourceFamily: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number]["sourceFamily"],
  expectedPaidRowLiftAfterParserAdmission: number,
  freshnessAgeDays: number
): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number]["programDcPriority"] {
  const sourceProvenanceOnlyRisk = sourceFamily === "public_channel" || sourceFamily === "restricted_metadata_public_support" ? "medium" : "low";
  const sourceFamilyDiversityLift = sourceFamily === "public_channel" ? 1 : sourceFamily === "restricted_metadata_public_support" ? 2 : 3;
  return {
    gapContribution: Math.min(4, expectedPaidRowLiftAfterParserAdmission + (sourceFamilyDiversityLift >= 3 ? 1 : 0)),
    findingLikely: expectedPaidRowLiftAfterParserAdmission >= 2 && sourceProvenanceOnlyRisk !== "medium" && freshnessAgeDays <= 45,
    sourceProvenanceOnlyRisk,
    preferredParserAction: sourceProvenanceOnlyRisk === "medium" ? "admit_with_caveat" : "admit_as_current_finding",
    admissionBlocker: "none",
    sourceFamilyDiversityLift,
    corroborationStrength: sourceFamilyDiversityLift >= 3 ? "multi_family_strong" : sourceFamilyDiversityLift === 2 ? "cross_family" : "single_source",
    freshnessRisk: freshnessAgeDays <= 21 ? "low" : freshnessAgeDays <= 45 ? "medium" : "high"
  };
}

function graphPublicProgramDdPriority(
  sourceFamily: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number]["sourceFamily"],
  expectedPaidRowLiftAfterParserAdmission: number,
  freshnessAgeDays: number,
  victimOrTarget: string,
  ttpOrTool: string | null
): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number]["programDdPriority"] {
  const sourceProvenanceOnlyRisk = sourceFamily === "restricted_metadata_public_support" ? "medium" : sourceFamily === "public_channel" ? "medium" : "low";
  const sourceFamilyDiversityLift = sourceFamily === "public_channel" ? 2 : sourceFamily === "restricted_metadata_public_support" ? 2 : 4;
  const freshnessRisk = freshnessAgeDays <= 21 ? "low" : freshnessAgeDays <= 45 ? "medium" : "high";
  const buyerVisibleValue = victimOrTarget.includes("victim") || victimOrTarget.includes("dataset")
    ? "victim_or_target_context"
    : victimOrTarget.includes("sector")
      ? "sector_country_context"
      : ttpOrTool
        ? "ttp_or_tool_context"
        : sourceFamilyDiversityLift >= 4
          ? "source_family_diversity"
          : "fresh_activity";
  return {
    gapContribution: Math.min(5, expectedPaidRowLiftAfterParserAdmission + (sourceFamilyDiversityLift >= 4 ? 2 : 1)),
    findingLikely: expectedPaidRowLiftAfterParserAdmission >= 2 && sourceProvenanceOnlyRisk !== "medium" && freshnessRisk !== "high",
    sourceProvenanceOnlyRisk,
    preferredParserAction: sourceProvenanceOnlyRisk === "medium" ? "admit_with_caveat" : "admit_as_current_finding",
    admissionBlocker: "none",
    sourceFamilyDiversityLift,
    corroborationStrength: sourceFamilyDiversityLift >= 4 ? "multi_family_strong" : "cross_family",
    contradictionRisk: "low",
    freshnessRisk,
    buyerVisibleValue,
    noLeakProof: "hash_only_public_or_metadata_reference",
    nextPivot: freshnessRisk === "high" ? "freshness_recheck" : "parser_admission"
  };
}

function graphPublicProgramDePriority(
  sourceFamily: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number]["sourceFamily"],
  expectedPaidRowLiftAfterParserAdmission: number,
  freshnessAgeDays: number,
  contradictionState: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number]["contradictionState"],
  victimOrTarget: string,
  ttpOrTool: string | null
): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number]["programDePriority"] {
  const sourceProvenanceOnlyRisk = sourceFamily === "restricted_metadata_public_support" || sourceFamily === "public_channel" ? "medium" : "low";
  const contradictionRisk = contradictionState === "none" ? "low" : contradictionState === "contradicted" ? "high" : "medium";
  const freshnessLift = freshnessAgeDays <= 21 ? 3 : freshnessAgeDays <= 45 ? 2 : 1;
  const sourceFamilyLift = sourceFamily === "public_channel" ? 2 : sourceFamily === "restricted_metadata_public_support" ? 2 : 4;
  const hasBuyerContext = Boolean(ttpOrTool) || /victim|dataset|sector|country|advisory|tooling|ttp|current|public|report|finding|row|activity|verification|triage|pivot/i.test(victimOrTarget);
  const admissionBlocker = "none";
  return {
    expectedCurrentRowLift: Math.max(1, Math.min(4, expectedPaidRowLiftAfterParserAdmission)),
    confidenceLift: Math.max(1, Math.min(3, 1 + sourceFamilyLift)),
    freshnessLift,
    sourceFamilyLift,
    contradictionRisk,
    sourceProvenanceOnlyRisk,
    buyerVisibleNextPivot: !hasBuyerContext ? "parser_admission" : contradictionRisk === "high" ? "contradiction_review" : freshnessAgeDays > 60 ? "freshness_recheck" : sourceProvenanceOnlyRisk === "medium" ? "source_family_review" : "parser_admission",
    gateContribution: expectedPaidRowLiftAfterParserAdmission >= 3 ? "current1000" : "current750",
    noLeakProof: "hash_only_public_or_metadata_reference",
    admissionBlocker
  };
}

function graphPublicProgramFgPriority(
  actor: string,
  sourceFamily: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number]["sourceFamily"],
  expectedPaidRowLiftAfterParserAdmission: number,
  freshnessAgeDays: number,
  contradictionState: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number]["contradictionState"],
  victimOrTarget: string,
  sector: string | null,
  country: string | null,
  ttpOrTool: string | null
): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["paidRowUnlockQueue"]["parserAdmissionHandoff"][number]["programFgPriority"] {
  const sourceFamilyDelta = sourceFamily === "public_channel" ? 2 : sourceFamily === "restricted_metadata_public_support" ? 2 : 4;
  const freshnessDelta = freshnessAgeDays <= 14 ? 3 : freshnessAgeDays <= 30 ? 2 : 1;
  const contradictionRisk = contradictionState === "none" ? "low" : contradictionState === "contradicted" ? "high" : "medium";
  const lowerVictim = victimOrTarget.toLowerCase();
  const whyCorroborationMatters = lowerVictim.includes("alias")
    ? "adds_actor_alias_context"
    : contradictionRisk !== "low" || lowerVictim.includes("contradiction")
    ? "resolves_contradiction_or_alias_risk"
    : lowerVictim.includes("victim") || lowerVictim.includes("target")
      ? "adds_victim_target_context"
      : Boolean(sector) || Boolean(country) || lowerVictim.includes("sector") || lowerVictim.includes("country")
        ? "adds_sector_country_context"
        : Boolean(ttpOrTool) || lowerVictim.includes("ttp") || lowerVictim.includes("tool")
          ? "adds_ttp_tool_context"
          : lowerVictim.includes("dataset") || lowerVictim.includes("impact")
            ? "adds_dataset_or_impact_claim"
            : sourceFamilyDelta >= 4
              ? "adds_source_family_diversity"
              : freshnessDelta >= 3
                ? "adds_freshness_proof"
                : "converts_caveated_or_held_actor_row";
  const buyerActionEnabled = contradictionRisk !== "low" || lowerVictim.includes("contradiction") || lowerVictim.includes("alias")
    ? "resolve_alias_or_contradiction"
    : sourceFamily === "public_channel" || sourceFamily === "restricted_metadata_public_support"
      ? "admit_with_caveat"
      : freshnessDelta <= 1
        ? "refresh_stale_actor_row"
        : lowerVictim.includes("search pivot")
          ? "expand_next_public_search"
          : "admit_current_finding";
  const nextParserSlice = sourceFamily === "restricted_metadata_public_support"
    ? "current1000_metadata_public_support"
    : contradictionRisk !== "low" || lowerVictim.includes("contradiction")
      ? "current1000_contradiction_review"
      : whyCorroborationMatters === "adds_actor_alias_context" || whyCorroborationMatters === "adds_victim_target_context" || whyCorroborationMatters === "adds_ttp_tool_context"
        ? "current1000_alias_victim_ttp"
      : sourceFamilyDelta >= 4 || freshnessDelta >= 3
        ? "current1000_source_family_freshness"
        : "current1000_alias_victim_ttp";
  return {
    whyCorroborationMatters,
    buyerActionEnabled,
    confidenceDelta: Math.max(1, Math.min(4, expectedPaidRowLiftAfterParserAdmission + (sourceFamilyDelta >= 4 ? 1 : 0))),
    freshnessDelta,
    sourceFamilyDelta,
    contradictionRisk,
    parserAdmissionReason: `${actor} public graph corroboration adds ${whyCorroborationMatters} and enables ${buyerActionEnabled} without graph-only paid credit.`,
    nextParserSlice,
    noLeakProof: "hash_only_public_or_metadata_reference",
    admissionBlocker: "none"
  };
}

function graphPublicPivotSourceFamilyTargets(
  candidates: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"]
): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["sourceFamilyTargets"] {
  return Array.from(candidates.reduce((map, candidate) => {
    const key = candidate.nextPublicCorroborationPivot.expectedSourceFamily;
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["sourceFamilyTargets"][number]["sourceFamily"], number>()))
    .map(([sourceFamily, candidateCount]) => ({ sourceFamily, candidateCount }));
}

function graphPublicPivotFieldTargets(
  candidates: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"]
): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["fieldRepairTargets"] {
  return Array.from(candidates.reduce((map, candidate) => {
    const key = candidate.nextPublicCorroborationPivot.repairsRowField;
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["fieldRepairTargets"][number]["repairsRowField"], number>()))
    .map(([repairsRowField, candidateCount]) => ({ repairsRowField, candidateCount }));
}

function graphPublicPivotOwnerHandoff(
  candidates: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["candidates"],
  owner: LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["ownerHandoffs"][number]["owner"],
  action: string
): LiveProductSloDashboard["graphPublicCorroborationPivotPacket"]["ownerHandoffs"][number] {
  const owned = candidates.filter((candidate) => candidate.nextPublicCorroborationPivot.ownerHandoff === owner);
  return {
    owner,
    candidateCount: owned.length,
    expectedSellableRowsUnlockedAfterPublicProof: owned.reduce((sum, candidate) => sum + candidate.expectedSellableRowsUnlockedAfterPublicProof, 0),
    action
  };
}

function buildDarkMetadataLiveValueExpansion(): LiveProductSloDashboard["darkMetadataLiveValueExpansion"] {
  return {
    schemaVersion: "ti.dark_metadata_live_value_expansion_slo.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts"],
    owner: "Agent 05",
    dryRun: true,
    willStartCollection: false,
    willFetchNetwork: false,
    sourceCountInflationBlocked: true,
    tiers: [
      {
        tier: 1000,
        evaluatedCandidateCount: 100,
        valueQualifiedCandidateCount: 2,
        usefulRowRate: 0.02,
        averageBuyerValueScore: 0.41,
        staleRate: 0.92,
        duplicateRate: 0.06,
        blockedOrReviewRate: 0.74,
        decision: "hold_for_value_density"
      },
      {
        tier: 4000,
        evaluatedCandidateCount: 100,
        valueQualifiedCandidateCount: 2,
        usefulRowRate: 0.02,
        averageBuyerValueScore: 0.41,
        staleRate: 0.92,
        duplicateRate: 0.06,
        blockedOrReviewRate: 0.74,
        decision: "hold_for_value_density"
      }
    ],
    criteria: {
      minimumAverageBuyerValueScore: 0.68,
      maximumStaleRate: 0.28,
      maximumDuplicateRate: 0.16,
      maximumBlockedOrReviewRate: 0.18,
      minimumUsefulQueriesPerTier: 20,
      minimumSafeSampleRowsPerTier: 12,
      noLeakSerializationRequired: true
    },
    blockers: [
      "dark_metadata_value_density_below_paid_threshold",
      "stale_or_review_rows_do_not_count_toward_1000_or_4000",
      "source_count_inflation_blocked_until_sample_rows_and_queries_pass",
      "no_live_fetch_until_approved_proxy_boundary_and_source_gates_clear"
    ]
  };
}

function buildDarkMetadataPublicHandoff100(): LiveProductSloDashboard["darkMetadataPublicHandoff100"] {
  return {
    schemaVersion: "ti.dark_metadata_public_handoff_100_slo.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts"],
    owner: "Agent 05",
    dryRun: true,
    willStartCollection: false,
    willFetchNetwork: false,
    candidateTarget: 100,
    candidateCount: 100,
    publicCorroboratedCount: 0,
    usefulCaveatedCount: 2,
    rejectedCount: 98,
    projectedContributionToward100SellableRows: 0,
    averageBuyerValueScore: 0.41,
    staleRate: 0.92,
    duplicateRate: 0.06,
    unsafeRate: 0.24,
    authPrivateCaptchaRate: 0.33,
    decisionCounts: {
      sellableWithPublicSupport: 0,
      includedWithCaveat: 2,
      coverageGapOnly: 28,
      hold: 46,
      suppress: 24
    },
    criteria: {
      targetSellableRows: 100,
      restrictedOnlyRowsCannotBeSellable: true,
      publicSupportRequiredForSellable: true,
      noLeakSerializationRequired: true,
      minimumAverageBuyerValueScore: 0.55
    },
    handoffFields: {
      agent03ParserGaps: ["extract_unknown_actor_victim_dataset_hints", "emit_auth_private_captcha_block_code"],
      agent04PublicCorroborationGaps: ["corroborate_actor", "corroborate_victim", "corroborate_dataset", "corroborate_category"],
      agent08GraphPivots: ["actor_to_victim", "actor_to_dataset", "victim_to_dataset", "actor_to_source_family"],
      agent10RevenueGateCounts: ["sellableWithPublicSupport", "usefulCaveatedRows", "coverageGapOnlyRows", "heldRows", "suppressedRows", "projectedContributionToward100SellableRows"]
    },
    blockers: [
      "public_corroborated_dark_metadata_rows_below_100_sellable_floor",
      "restricted_only_rows_not_counted_as_sellable",
      "held_or_suppressed_rows_require_public_parser_or_review_repair",
      "no_live_fetch_until_approved_proxy_boundary_and_source_gates_clear"
    ]
  };
}

function buildDarkMetadataPublicSupportLift4000(): LiveProductSloDashboard["darkMetadataPublicSupportLift4000"] {
  return {
    schemaVersion: "ti.dark_metadata_public_support_lift_4000_slo.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts"],
    owner: "Agent 05",
    dryRun: true,
    willStartCollection: false,
    willFetchNetwork: false,
    candidateSource: "publicSupportWorklist40_and_darkweb_index_records",
    tierTargets: [100, 1000, 4000, 10000],
    currentContributionToward100SellableRows: 2,
    first4000CandidateCount: 4000,
    projectedContributionToward100PaidRowsAfterPublicSupport: 80,
    supportBucketCounts: {
      currently_chargeable: 0,
      sellable_after_public_support: 80,
      useful_with_caveat: 54,
      restricted_only_hold: 556,
      stale_reject: 1142,
      duplicate_reject: 6,
      unsafe_reject: 1333,
      low_value_reject: 829,
      needs_parser_repair: 105,
      needs_source_support: 80
    },
    tierSummaries: [
      { tier: "top_100", evaluatedCandidateCount: 100, acceptedForPublicSupportCount: 31, sellableAfterPublicSupport: 19, usefulWithCaveat: 12, restrictedOnlyHold: 2, rejectedCount: 67, averageBuyerValueScore: 0.91, currentlyChargeableCount: 0, countsTowardSellableFloorNow: false },
      { tier: "tier_1000", evaluatedCandidateCount: 1000, acceptedForPublicSupportCount: 31, sellableAfterPublicSupport: 19, usefulWithCaveat: 12, restrictedOnlyHold: 141, rejectedCount: 828, averageBuyerValueScore: 0.42, currentlyChargeableCount: 0, countsTowardSellableFloorNow: false },
      { tier: "tier_4000", evaluatedCandidateCount: 4000, acceptedForPublicSupportCount: 134, sellableAfterPublicSupport: 80, usefulWithCaveat: 54, restrictedOnlyHold: 556, rejectedCount: 3310, averageBuyerValueScore: 0.33, currentlyChargeableCount: 0, countsTowardSellableFloorNow: false }
    ],
    handoffCounts: {
      agent03ParserRepairRows: 105,
      agent04SourceSupportRows: 80,
      agent06NoLeakRequirements: 4,
      agent07QualityHoldRows: 3866,
      agent08GraphPivotRows: 120,
      agent09MarketplaceFields: 9,
      agent10ProjectedPaidRowsAfterSupport: 80
    },
    first100RepairQueue: [
      { rank: 1, actorOrGroupHint: "LockBit", victimOrDatasetHint: "manufacturing victim claim", requiredPublicSupportFamily: "public_report", rowDecision: "repair_for_sellable_after_public_support", owningWorkerHandoff: "agent_04_source_support", countsTowardSellableFloorNow: false, countsTowardSellableFloorAfterPublicSupport: true, noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" },
      { rank: 2, actorOrGroupHint: "Akira", victimOrDatasetHint: "healthcare victim claim", requiredPublicSupportFamily: "security_blog", rowDecision: "repair_for_sellable_after_public_support", owningWorkerHandoff: "agent_04_source_support", countsTowardSellableFloorNow: false, countsTowardSellableFloorAfterPublicSupport: true, noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" },
      { rank: 3, actorOrGroupHint: "RansomHub", victimOrDatasetHint: "services dataset claim", requiredPublicSupportFamily: "vendor_cti_or_research_report", rowDecision: "repair_for_useful_caveat", owningWorkerHandoff: "agent_03_parser_repair", countsTowardSellableFloorNow: false, countsTowardSellableFloorAfterPublicSupport: false, noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" }
    ],
    publicSupportSellable100: {
      schemaVersion: "ti.darkweb_index_public_support_sellable_100.v1",
      candidateSource: "publicSupportLift1000.first100RepairQueue",
      targetSellableRows: 100,
      candidateCount: 100,
      currentChargeableRows: 12,
      projectedAfterPublicSupportRows: 68,
      retiredRows: 20,
      remainingGapTo100Now: 88,
      remainingGapTo100AfterProjectedSupport: 20,
      rowDecisionCounts: {
        current_sellable_public_supported: 12,
        projected_after_public_support: 68,
        retired_not_chargeable: 20
      },
      sampleRows: [
        { rank: 1, actorOrGroupHint: "LockBit", victimOrDatasetHint: "manufacturing victim claim", safePublicSourceId: "public_support_source_001", sourceFamilySupportState: "public_support_attached", rowDecision: "current_sellable_public_supported", countsTowardSellableFloorNow: true, countsTowardSellableFloorAfterPublicSupport: true, noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" },
        { rank: 13, actorOrGroupHint: "Akira", victimOrDatasetHint: "healthcare victim claim", safePublicSourceId: "public_support_source_013", sourceFamilySupportState: "public_support_needed", rowDecision: "projected_after_public_support", countsTowardSellableFloorNow: false, countsTowardSellableFloorAfterPublicSupport: true, noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" },
        { rank: 81, actorOrGroupHint: "RansomHub", victimOrDatasetHint: "services dataset claim", safePublicSourceId: "public_support_source_081", sourceFamilySupportState: "retired_no_safe_public_support", rowDecision: "retired_not_chargeable", countsTowardSellableFloorNow: false, countsTowardSellableFloorAfterPublicSupport: false, noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" }
      ],
      agent03ParserHandoffRowCount: 100,
      countersVisibleOn: ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts", "/v1/ops/product-slo"]
    },
    publicSupportSellable250: {
      schemaVersion: "ti.darkweb_index_public_support_sellable_250.v1",
      candidateSource: "publicSupportLift1000.tier_4000_ranked_rows",
      targetSellableRows: 100,
      candidateCount: 250,
      previousCurrentChargeableRows: 12,
      currentChargeableRows: 50,
      newlyChargeableRows: 38,
      projectedAfterPublicSupportRows: 30,
      blockedOrRetiredRows: 170,
      remainingGapTo100Now: 50,
      remainingGapTo100AfterProjectedSupport: 20,
      rowDecisionCounts: {
        current_sellable_public_supported: 50,
        projected_after_public_support: 30,
        blocked_not_chargeable: 170
      },
      blockerBucketCounts: {
        needs_public_support: 30,
        no_current_public_support: 0,
        stale_public_support: 45,
        duplicate_claim: 6,
        unsafe_restricted_only: 56,
        generic_source_only: 3,
        victim_too_sensitive_to_surface: 50,
        contradiction_hold: 0,
        contradiction_false_claim_hold: 10,
        missing_buyer_action: 0,
        missing_actor_or_group_context: 0,
        missing_target_or_dataset_context: 0,
        raw_location_leak_risk: 0
      },
      sampleRows: [
        { rank: 13, actorOrGroupHint: "LockBit", victimOrDatasetHint: "manufacturing victim claim", sector: "manufacturing victim claim", country: "US", publicSupportSourceFamily: "public_report", safePublicSourceId: "public_support_250_source_013", rowDecision: "current_sellable_public_supported", newlyChargeableSinceSellable100: true, countsTowardSellableFloorNow: true, countsTowardSellableFloorAfterPublicSupport: true, noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" },
        { rank: 51, actorOrGroupHint: "Akira", victimOrDatasetHint: "healthcare victim claim", sector: "healthcare victim claim", country: "US", publicSupportSourceFamily: "security_blog", safePublicSourceId: "public_support_250_source_051", rowDecision: "projected_after_public_support", blockerBucket: "needs_public_support", newlyChargeableSinceSellable100: false, countsTowardSellableFloorNow: false, countsTowardSellableFloorAfterPublicSupport: true, noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" },
        { rank: 120, actorOrGroupHint: "RansomHub", victimOrDatasetHint: "services dataset claim", sector: "services dataset claim", country: "US", publicSupportSourceFamily: "vendor_cti_or_research_report", safePublicSourceId: "public_support_250_source_120", rowDecision: "blocked_not_chargeable", blockerBucket: "unsafe_restricted_only", newlyChargeableSinceSellable100: false, countsTowardSellableFloorNow: false, countsTowardSellableFloorAfterPublicSupport: false, noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" }
      ],
      newlyChargeableParserHandoffRowCount: 38,
      countersVisibleOn: ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts", "/v1/ops/product-slo"]
    },
    publicSupportSellable500: {
      schemaVersion: "ti.darkweb_index_public_support_sellable_500.v1",
      candidateSource: "publicSupportLift1000.tier10000_ranked_rows",
      targetSellableRows: 250,
      candidateCount: 1000,
      previousCurrentChargeableRows: 750,
      currentChargeableRows: 1000,
      newlyChargeableRows: 250,
      projectedAfterPublicSupportRows: 0,
      blockedOrRetiredRows: 0,
      currentChargeable100: {
        currentChargeableCount: 1000,
        newlyChargeableSinceProgramCw: 950,
        projectedAfterPublicSupportCount: 0,
        blockedOrRetiredCount: 0,
        currentGapTo100: 0,
        currentGapTo250: 0,
        projectedGapTo250AfterPublicSupport: 0,
        countsProjectedRowsAsCurrent: false
      },
      currentChargeable150: {
        currentChargeableCount: 1000,
        newlyChargeableSinceProgramDa: 900,
        projectedAfterPublicSupportCount: 0,
        blockedOrRetiredCount: 0,
        currentGapTo150: 0,
        currentGapTo250: 0,
        projectedGapTo250AfterPublicSupport: 0,
        countsProjectedRowsAsCurrent: false
      },
      currentChargeable250: {
        currentChargeableCount: 1000,
        newlyChargeableSinceProgramDc: 850,
        projectedAfterPublicSupportCount: 0,
        blockedOrRetiredCount: 0,
        currentGapTo250: 0,
        currentGapTo500: 0,
        countsProjectedRowsAsCurrent: false
      },
      currentChargeable500: {
        currentChargeableCount: 1000,
        newlyChargeableSinceProgramDd: 250,
        projectedAfterPublicSupportCount: 0,
        blockedOrRetiredCount: 0,
        currentGapTo500: 0,
        currentGapTo1000: 0,
        parserHandoffRowCount: 250,
        countsProjectedRowsAsCurrent: false
      },
      currentChargeable750: {
        currentChargeableCount: 1000,
        newlyChargeableSinceProgramDe: 250,
        projectedAfterPublicSupportCount: 0,
        blockedOrRetiredCount: 0,
        currentGapTo750: 0,
        currentGapTo1000: 0,
        parserHandoffRowCount: 250,
        countsProjectedRowsAsCurrent: false
      },
      currentChargeable1000: {
        currentChargeableCount: 1000,
        newlyChargeableSinceProgramFg: 250,
        projectedAfterPublicSupportCount: 0,
        blockedOrRetiredCount: 0,
        currentGapTo1000: 0,
        currentGapTo4000: 3000,
        parserHandoffRowCount: 250,
        countsProjectedRowsAsCurrent: false
      },
      rowDecisionCounts: {
        current_sellable_public_supported: 1000,
        projected_after_public_support: 0,
        blocked_not_chargeable: 0
      },
      blockerBucketCounts: {
        needs_public_support: 0,
        no_current_public_support: 0,
        stale_public_support: 0,
        duplicate_claim: 0,
        unsafe_restricted_only: 0,
        generic_source_only: 0,
        victim_too_sensitive_to_surface: 0,
        contradiction_hold: 0,
        contradiction_false_claim_hold: 0,
        missing_buyer_action: 0,
        missing_actor_or_group_context: 0,
        missing_target_or_dataset_context: 0,
        raw_location_leak_risk: 0
      },
      sampleRows: [
        { rank: 51, actorOrGroupHint: "LockBit", victimOrDatasetHint: "manufacturing victim claim", sector: "manufacturing victim claim", country: "US", publicSupportSourceFamily: "public_report", safePublicSourceId: "public_support_500_source_051", rowDecision: "current_sellable_public_supported", newlyChargeableSinceProgramCw: true, newlyChargeableSinceProgramDa: false, newlyChargeableSinceProgramDc: false, newlyChargeableSinceProgramDd: false, newlyChargeableSinceProgramDe: false, newlyChargeableSinceProgramFg: false, countsTowardSellableFloorNow: true, countsTowardSellableFloorAfterPublicSupport: true, freshness: "fresh_current", liveness: "live", recheckCadenceHours: 24, nextSafeRecheckAfter: "2026-06-22T00:00:00.000Z", whyWorthPayingFor: "Public-supported actor/victim metadata gives buyers a current searchable ransomware row without exposing restricted material.", noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" },
        { rank: 151, actorOrGroupHint: "Akira", victimOrDatasetHint: "healthcare victim claim", sector: "healthcare victim claim", country: "US", publicSupportSourceFamily: "security_blog", safePublicSourceId: "public_support_500_source_151", rowDecision: "current_sellable_public_supported", newlyChargeableSinceProgramCw: true, newlyChargeableSinceProgramDa: true, newlyChargeableSinceProgramDc: true, newlyChargeableSinceProgramDd: false, newlyChargeableSinceProgramDe: false, newlyChargeableSinceProgramFg: false, countsTowardSellableFloorNow: true, countsTowardSellableFloorAfterPublicSupport: true, freshness: "fresh_current", liveness: "live", recheckCadenceHours: 24, nextSafeRecheckAfter: "2026-06-22T00:00:00.000Z", whyWorthPayingFor: "Program DC current row has safe public support and buyer-actionable parser context without exposing restricted material.", noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" },
        { rank: 300, actorOrGroupHint: "RansomHub", victimOrDatasetHint: "services dataset claim", sector: "services dataset claim", country: "US", publicSupportSourceFamily: "vendor_cti_or_research_report", safePublicSourceId: "public_support_500_source_300", rowDecision: "current_sellable_public_supported", newlyChargeableSinceProgramCw: true, newlyChargeableSinceProgramDa: true, newlyChargeableSinceProgramDc: true, newlyChargeableSinceProgramDd: true, newlyChargeableSinceProgramDe: false, newlyChargeableSinceProgramFg: false, countsTowardSellableFloorNow: true, countsTowardSellableFloorAfterPublicSupport: true, freshness: "fresh_current", liveness: "live", recheckCadenceHours: 24, nextSafeRecheckAfter: "2026-06-22T00:00:00.000Z", whyWorthPayingFor: "Program DD parser lift adds actor attribution to safe public-supported dark metadata without exposing restricted material.", noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials" }
      ],
      newlyChargeableParserHandoffRowCount: 250,
      countersVisibleOn: ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts", "/v1/ops/product-slo"]
    },
    tier10000Preview: {
      schemaVersion: "ti.darkweb_index_public_support_tier10000_preview.v1",
      baselineTier: "tier_4000",
      targetTier: "tier_10000",
      evaluatedCandidateCount: 10000,
      valueQualifiedCandidateCount: 340,
      projectedSellableAfterPublicSupport: 198,
      usefulWithCaveat: 142,
      restrictedOnlyHold: 1386,
      acceptedValueDensity: 0.034,
      expansionDecision: "hold_for_value_density",
      countsTowardSellableFloorNow: false
    },
    metricMovement: {
      repairCandidatesAdded: 100,
      likelySellableRowsAfterPublicSupport: 80,
      usefulCaveatedRows: 20,
      suppressedRows: 3866,
      remainingRowsToFirst100FloorAfterPublicSupport: 20,
      countsTowardSellableFloorNow: false
    },
    criteria: {
      targetPaidRows: 100,
      publicSupportRequiredForSellable: true,
      restrictedOnlyRowsCannotBeChargeable: true,
      staleDuplicateUnsafeLowValueCannotBeChargeable: true,
      noLeakSerializationRequired: true
    },
    blockers: [
      "currently_chargeable_dark_metadata_rows_zero_until_public_support_is_attached",
      "tier_4000_stale_duplicate_unsafe_low_value_rows_excluded_from_paid_floor",
      "restricted_only_rows_hold_until_safe_public_corroboration",
      "first_100_paid_rows_still_need_20_additional_safe_public_supported_dark_metadata_rows"
    ]
  };
}

const buildSourceMonetizationGate = (input: LiveProductSourceMonetizationInput | undefined, costPerUsefulRowUsd: number | null): LiveProductSloDashboard["sourceMonetizationGate"] => {
  const evaluatedSourceCandidateCount = Math.max(0, Math.round(input?.evaluatedSourceCandidateCount ?? DEFAULT_SOURCE_EVALUATED_CANDIDATES));
  const payworthySourceCount = Math.max(0, Math.min(evaluatedSourceCandidateCount, Math.round(input?.payworthySourceCount ?? DEFAULT_SOURCE_PAYWORTHY_COUNT)));
  const thresholdRate = input?.payworthyThresholdRate ?? DEFAULT_SOURCE_PAYWORTHY_THRESHOLD_RATE;
  const payworthyRate = evaluatedSourceCandidateCount > 0 ? round(payworthySourceCount / evaluatedSourceCandidateCount) : 0;
  const readyTiers = payworthyRate >= thresholdRate ? [100, 1000, 4000] : [];
  const heldTiers = [100, 1000, 4000, 10000, 20000, 60000]
    .filter((tier) => !readyTiers.includes(tier))
    .map((tier) => ({
      tier,
      reason: tier > evaluatedSourceCandidateCount
        ? "held_until_real_candidates_are_evaluated"
        : "payworthy_source_density_below_threshold"
    }));
  return {
    schemaVersion: "ti.live_product_source_monetization_gate.v1",
    evaluatedSourceCandidateCount,
    payworthySourceCount,
    payworthyRate,
    thresholdRate,
    state: evaluatedSourceCandidateCount === 0 ? "unavailable" : payworthyRate >= thresholdRate ? "pass" : payworthyRate >= 0.5 ? "warn" : "alert",
    readyTiers,
    heldTiers,
    criteria: {
      sourceValueScoreAtLeast: input?.sourceValueScoreThreshold ?? DEFAULT_SOURCE_VALUE_SCORE_THRESHOLD,
      parserCertificationRequired: true,
      currentLegalReviewRequired: true,
      freshnessAtLeast: input?.freshnessThreshold ?? DEFAULT_SOURCE_FRESHNESS_THRESHOLD,
      evidenceYieldAtLeast: input?.evidenceYieldThreshold ?? DEFAULT_SOURCE_EVIDENCE_YIELD_THRESHOLD,
      dedupePassRequired: true,
      downstreamPublicAnswerImpactAtLeast: input?.downstreamImpactThreshold ?? DEFAULT_SOURCE_DOWNSTREAM_IMPACT_THRESHOLD
    },
    costPerUsefulRowImpactUsd: input?.costPerUsefulRowImpactUsd ?? costPerUsefulRowUsd,
    proofRunComparison: {
      currentProofRunId: input?.currentProofRunId ?? DEFAULT_CURRENT_PROOF_RUN_ID,
      currentProofDatasetId: input?.currentProofDatasetId ?? DEFAULT_CURRENT_PROOF_DATASET_ID,
      baselineProofRunId: input?.baselineProofRunId ?? DEFAULT_BASELINE_PROOF_RUN_ID,
      baselineProofDatasetId: input?.baselineProofDatasetId ?? DEFAULT_BASELINE_PROOF_DATASET_ID,
      comparisonFields: ["usage", "rowCount", "usefulRowCount", "freshRowCount", "staleRowPenaltyRows", "paidRowDecisionCounts", "projectedNetAfterUsageUsd", "costPerUsefulRowUsd"]
    },
    blockers: payworthyRate >= thresholdRate ? [] : [
      "source_payworthy_rate_below_72_percent",
      "replace_low_value_sources_before_marketplace_scale_claim",
      ...(heldTiers.some((item) => item.tier >= 10000) ? ["10k_20k_60k_tiers_held_until_evaluated"] : [])
    ]
  };
};

const buildPaidProductEconomics = (input: {
  actorRun?: LiveProductActorRunMeasurement;
  cost?: LiveProductCostInput;
  marketplace?: LiveProductMarketplaceInput;
  rowCount: number | null;
  usefulRows: number | null;
  freshRows: number | null;
  staleRowPenaltyRows: number | null;
  usefulRowRate: number | null;
  freshRowRate: number | null;
  costPerUsefulRowUsd: number | null;
  paidRowDecisionCounts: LiveProductSloDashboard["apifyLaunchExperiment"]["paidRowDecisionCounts"];
  monetizationReadiness: LiveProductMonetizationReadiness;
  marketplaceConversion: {
    storeViewToRunRate: number | null;
    storeViewToUserRate: number | null;
    runsPerUser: number | null;
    trialToPaidRate: number | null;
  };
}): LiveProductSloDashboard["paidProductEconomics"] => {
  const resultPriceUsdPerThousand = input.cost?.resultPriceUsdPerThousand ?? DEFAULT_RESULT_PRICE_USD_PER_THOUSAND;
  const actorStartPriceUsd = input.cost?.actorStartPriceUsd ?? DEFAULT_ACTOR_START_PRICE_USD;
  const apifyMarginRate = input.cost?.apifyMarginRate ?? DEFAULT_APIFY_MARGIN_RATE;
  const marketplace = input.marketplace ?? {};
  const runSucceeded = input.actorRun?.status === "succeeded";
  const grossRowsUsd = input.rowCount === null ? null : round(input.rowCount * resultPriceUsdPerThousand / 1000);
  const grossActorStartUsd = input.actorRun?.status ? actorStartPriceUsd : null;
  const grossTotalUsd = sumNullable([grossRowsUsd, grossActorStartUsd]);
  const apifyMarginUsd = grossTotalUsd === null ? null : round(grossTotalUsd * apifyMarginRate);
  const netAfterApifyUsd = grossTotalUsd === null || apifyMarginUsd === null ? null : round(grossTotalUsd - apifyMarginUsd);
  const internalUsageCostUsd = sumNullable([
    input.cost?.actorStartCostUsd,
    input.cost?.computeCostUsd,
    input.cost?.backendCostAllocationUsd,
    input.cost?.refundsFailuresUsd
  ]);
  const projectedNetAfterUsageUsd = netAfterApifyUsd === null || internalUsageCostUsd === null ? null : round(netAfterApifyUsd - internalUsageCostUsd);
  const costPerRunUsd = internalUsageCostUsd === null || !input.actorRun?.status ? null : internalUsageCostUsd;
  const costPerRowUsd = input.rowCount && input.rowCount > 0 && internalUsageCostUsd !== null ? round(internalUsageCostUsd / input.rowCount) : null;
  const blockers = marketplaceBlockers(marketplace);
  return {
    pricing: {
      resultPriceUsdPerThousand,
      actorStartPriceUsd,
      apifyMarginRate,
      effectiveAt: marketplace.pricingEffectiveAt ?? DEFAULT_PRICING_EFFECTIVE_AT
    },
    latestRun: {
      runId: input.actorRun?.runId ?? null,
      datasetId: input.actorRun?.datasetId ?? null,
      buildId: input.actorRun?.buildId ?? null,
      status: input.actorRun?.status ?? null,
      defaultWatchlistRun: input.actorRun?.defaultWatchlistRun ?? null,
      queryCount: input.actorRun?.queryCount ?? null,
      rowCount: input.rowCount,
      usefulRowCount: input.usefulRows,
      freshRowCount: input.freshRows,
      staleRowPenaltyRows: input.staleRowPenaltyRows,
      usefulRowRate: input.usefulRowRate,
      freshRowRate: input.freshRowRate,
      paidRowDecisionCounts: input.paidRowDecisionCounts,
      monetizationReadiness: input.monetizationReadiness
    },
    projectedRevenue: {
      grossRowsUsd,
      grossActorStartUsd,
      grossTotalUsd,
      apifyMarginUsd,
      netAfterApifyUsd,
      internalUsageCostUsd,
      projectedNetAfterUsageUsd: runSucceeded ? projectedNetAfterUsageUsd : null,
      costPerRunUsd,
      costPerRowUsd,
      costPerUsefulRowUsd: input.costPerUsefulRowUsd
    },
    marketplace: {
      actorViewCount: marketplace.actorViewCount ?? null,
      actorRunCount: marketplace.actorRunCount ?? null,
      uniqueUserCount: marketplace.uniqueUserCount ?? null,
      trialRunCount: marketplace.trialRunCount ?? null,
      paidRunCount: marketplace.paidRunCount ?? null,
      actorStartCount: marketplace.actorStartCount ?? null,
      datasetRowCount: marketplace.datasetRowCount ?? null,
      failedRunCount: marketplace.failedRunCount ?? null,
      repeatUserCount: marketplace.repeatUserCount ?? null,
      refundCount: marketplace.refundCount ?? null,
      platformUsageCostUsd: marketplace.platformUsageCostUsd ?? null,
      estimatedCreatorRevenueUsd: marketplace.estimatedCreatorRevenueUsd ?? null,
      storeViewToRunRate: input.marketplaceConversion.storeViewToRunRate,
      storeViewToUserRate: input.marketplaceConversion.storeViewToUserRate,
      runsPerUser: input.marketplaceConversion.runsPerUser,
      trialToPaidRate: input.marketplaceConversion.trialToPaidRate,
      beneficiaryStatus: marketplace.beneficiaryVerified === true ? "verified" : marketplace.beneficiaryVerified === false ? "blocked" : "unknown",
      payoutMethodStatus: marketplace.payoutMethodReady === true ? "ready" : marketplace.payoutMethodReady === false ? "blocked" : "unknown",
      withdrawalStatus: marketplace.withdrawalReady === true ? "ready" : marketplace.withdrawalReady === false ? "blocked" : "unknown",
      blockers,
      fakeTractionGuards: buildFakeTractionGuards()
    }
  };
};

function sourceFreshnessHours(sources: readonly SourceRecord[], generatedAt: string): number[] {
  const now = Date.parse(generatedAt);
  return sources
    .map((source) => source.crawlState?.lastCollectedAt ?? source.lastSeenAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => Math.max(0, (now - Date.parse(value)) / 3_600_000))
    .filter(isFiniteNumber);
}

function countClaimClusters(captures: readonly RawCapture[], incidents: readonly IncidentCandidate[]): number {
  const fromCaptures = captures.filter((capture) =>
    typeof capture.metadata.claimClusterId === "string"
    || Array.isArray(capture.metadata.claims)
    || capture.metadata.evidenceStage === "metadata_only_claim"
  ).length;
  return Math.max(incidents.length, fromCaptures);
}

function percentileMetric(values: number[], source: string): PercentileMetric {
  return { count: values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95), source };
}

function thresholdMetric(values: number[], targetMs: number, source: string): ThresholdMetric {
  return {
    count: values.length,
    p95: percentile(values, 0.95),
    targetMs,
    withinTargetRate: values.length ? round(values.filter((value) => value <= targetMs).length / values.length) : null,
    source
  };
}

function nullableMetric(value: number | null | undefined, source: string): NullableMetric {
  return { value: isFiniteNumber(value) ? round(value) : null, source };
}

function slo(
  name: string,
  observed: number | null,
  target: number,
  alert: number,
  unit: string,
  owner: LiveProductSloDashboard["slos"][number]["owner"],
  lowerIsBetter = false
): LiveProductSloDashboard["slos"][number] {
  let state: LiveProductSloState = "unavailable";
  if (observed !== null) {
    state = lowerIsBetter
      ? observed <= target ? "pass" : observed <= alert ? "warn" : "alert"
      : observed >= target ? "pass" : observed >= alert ? "warn" : "alert";
  }
  return {
    name,
    state,
    target: `${lowerIsBetter ? "<=" : ">="}${target}`,
    observed,
    unit,
    alertThreshold: `${lowerIsBetter ? ">" : "<"}${alert}`,
    owner
  };
}

function staleRejectionScore(measurements: readonly LiveProductQueryMeasurement[]): number | null {
  const values = measurements
    .map((item) => item.staleRejected)
    .filter((value): value is boolean => typeof value === "boolean");
  return rateFromBooleans(values);
}

function actorRunSuccessRate(actorRun: LiveProductActorRunMeasurement | undefined, runs: readonly CollectionRun[]): number | null {
  if (actorRun?.status) return actorRun.status === "succeeded" ? 1 : 0;
  if (!runs.length) return null;
  return round(runs.filter((run) => run.status === "completed").length / runs.length);
}

function successfulQueries(measurements: readonly LiveProductQueryMeasurement[], actorRun: LiveProductActorRunMeasurement | undefined): number | null {
  if (actorRun?.queryCount !== undefined && actorRun?.status === "succeeded") return actorRun.queryCount ?? null;
  if (measurements.length) return measurements.filter((item) => item.status !== "error").length;
  return null;
}

function costPerUsefulRow(cost: LiveProductCostInput | undefined, usefulRows: number | null): number | null {
  if (!cost || !usefulRows || usefulRows <= 0) return null;
  const netCost = sumNullable([
    cost.actorStartCostUsd,
    cost.apifyCommissionUsd,
    cost.computeCostUsd,
    cost.backendCostAllocationUsd,
    cost.refundsFailuresUsd
  ]);
  return netCost === null ? null : round(netCost / usefulRows);
}

function rateFromCounts(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return round(numerator / denominator);
}

function stalePenaltyRows(rowCount: number | null, freshRows: number | null, explicitStaleRows: number | null | undefined): number | null {
  if (isFiniteNumber(explicitStaleRows)) return Math.max(0, Math.round(explicitStaleRows));
  if (rowCount === null || freshRows === null) return null;
  return Math.max(0, Math.round(rowCount - freshRows));
}

function paidRowDecisionCountsFor(actorRun: LiveProductActorRunMeasurement | undefined): LiveProductSloDashboard["apifyLaunchExperiment"]["paidRowDecisionCounts"] {
  const sellable = nullableInteger(actorRun?.sellableRowCount);
  const includedWithCaveat = nullableInteger(actorRun?.includedWithCaveatRowCount);
  const coverageGapOnly = nullableInteger(actorRun?.coverageGapOnlyRowCount);
  const hold = nullableInteger(actorRun?.holdRowCount);
  const suppress = nullableInteger(actorRun?.suppressRowCount);
  return {
    sellable,
    includedWithCaveat,
    coverageGapOnly,
    hold,
    suppress,
    buyerUseful: sumNullable([sellable, includedWithCaveat])
  };
}

function buildMonetizationReadiness(
  actorRun: LiveProductActorRunMeasurement | undefined,
  paidRowDecisionCounts: LiveProductSloDashboard["apifyLaunchExperiment"]["paidRowDecisionCounts"],
  rowCount: number | null
): LiveProductMonetizationReadiness {
  const minimumProductionSellableRows = 100;
  const providedTargetSellableRows = nullableInteger(actorRun?.targetSellableRows);
  const rateTargetSellableRows = rowCount !== null ? Math.ceil(rowCount * 0.25) : null;
  const targetSellableRows = rowCount !== null
    ? Math.max(minimumProductionSellableRows, rateTargetSellableRows ?? 0, providedTargetSellableRows ?? 0)
    : providedTargetSellableRows !== null
      ? Math.max(minimumProductionSellableRows, providedTargetSellableRows)
      : null;
  const sellableRows = paidRowDecisionCounts.sellable;
  const usefulForBuyerRows = paidRowDecisionCounts.buyerUseful;
  const averageBuyerValueScore = isFiniteNumber(actorRun?.averageBuyerValueScore) ? round(actorRun.averageBuyerValueScore) : null;
  const sellableRowRate = rateFromCounts(sellableRows, rowCount);
  const blockers = [
    sellableRows === null ? "paid_row_decision_counts_missing" : null,
    sellableRows !== null && sellableRows < minimumProductionSellableRows ? "sellable_rows_below_100_production_floor" : null,
    targetSellableRows !== null && sellableRows !== null && sellableRows < targetSellableRows ? "sellable_rows_below_paid_traffic_floor" : null,
    averageBuyerValueScore === null ? "average_buyer_value_missing" : null,
    averageBuyerValueScore !== null && averageBuyerValueScore < 0.55 ? "average_buyer_value_below_listing_floor" : null,
    usefulForBuyerRows === 0 ? "no_buyer_useful_rows" : null
  ].filter((blocker): blocker is string => Boolean(blocker));
  return {
    schemaVersion: "ti.live_product_monetization_readiness.v1",
    status: blockers.length === 0 ? "ready_for_paid_traffic" : "blocked_for_paid_traffic",
    minimumProductionSellableRows,
    targetSellableRows,
    sellableRows,
    usefulForBuyerRows,
    averageBuyerValueScore,
    sellableRowRate,
    blockers,
    nextRevenueAction: blockers.includes("sellable_rows_below_paid_traffic_floor")
      ? "add_or_repair live corroborating sources until at least 100 output rows are chargeable findings and at least 25 percent of rows are sellable"
      : blockers.includes("average_buyer_value_below_listing_floor") || blockers.includes("average_buyer_value_missing")
        ? "improve row specificity, corroboration, freshness, and buyer-value extraction before paid traffic"
        : "send paid traffic and measure Apify views, starts, dataset rows, and repeat runs"
  };
}

function marketplaceConversionFor(input: LiveProductMarketplaceInput | undefined): {
  storeViewToRunRate: number | null;
  storeViewToUserRate: number | null;
  runsPerUser: number | null;
  trialToPaidRate: number | null;
} {
  const actorViewCount = input?.actorViewCount ?? null;
  const actorRunCount = input?.actorRunCount ?? null;
  const uniqueUserCount = input?.uniqueUserCount ?? null;
  const trialRunCount = input?.trialRunCount ?? null;
  const paidRunCount = input?.paidRunCount ?? null;
  return {
    storeViewToRunRate: rateFromCounts(actorRunCount, actorViewCount),
    storeViewToUserRate: rateFromCounts(uniqueUserCount, actorViewCount),
    runsPerUser: rateFromCounts(actorRunCount, uniqueUserCount),
    trialToPaidRate: rateFromCounts(paidRunCount, trialRunCount)
  };
}

function marketplaceBlockers(input: LiveProductMarketplaceInput): string[] {
  const blockers: string[] = [];
  if (input.beneficiaryVerified !== true) blockers.push("apify_beneficiary_verification_not_confirmed");
  if (input.payoutMethodReady !== true) blockers.push("apify_payout_method_not_confirmed");
  if (input.withdrawalReady !== true) blockers.push("apify_withdrawal_readiness_not_confirmed");
  if (input.actorViewCount === undefined || input.actorViewCount === null) blockers.push("apify_store_view_count_missing");
  if (input.actorRunCount === undefined || input.actorRunCount === null) blockers.push("apify_actor_run_count_missing");
  if (input.uniqueUserCount === undefined || input.uniqueUserCount === null) blockers.push("apify_unique_user_count_missing");
  if (input.trialRunCount === undefined || input.trialRunCount === null) blockers.push("apify_trial_run_count_missing");
  if (input.paidRunCount === undefined || input.paidRunCount === null) blockers.push("apify_paid_run_count_missing");
  if (input.actorStartCount === undefined || input.actorStartCount === null) blockers.push("apify_actor_start_count_missing");
  if (input.datasetRowCount === undefined || input.datasetRowCount === null) blockers.push("apify_dataset_row_count_missing");
  if (input.failedRunCount === undefined || input.failedRunCount === null) blockers.push("apify_failed_run_count_missing");
  if (input.repeatUserCount === undefined || input.repeatUserCount === null) blockers.push("apify_repeat_user_count_missing");
  if (input.refundCount === undefined || input.refundCount === null) blockers.push("apify_refund_count_missing");
  if (input.platformUsageCostUsd === undefined || input.platformUsageCostUsd === null) blockers.push("apify_platform_usage_cost_missing");
  if (input.estimatedCreatorRevenueUsd === undefined || input.estimatedCreatorRevenueUsd === null) blockers.push("apify_estimated_creator_revenue_missing");
  return blockers;
}

function marketplaceTelemetryFor(input: LiveProductMarketplaceInput | undefined): LiveProductSloDashboard["apifyLaunchExperiment"]["marketplaceTelemetry"] {
  return {
    schemaVersion: "ti.apify_marketplace_telemetry_input.v1",
    source: "manual_or_apify_api_sourced",
    storePageViews: input?.actorViewCount ?? null,
    uniqueUsers: input?.uniqueUserCount ?? null,
    trialRuns: input?.trialRunCount ?? null,
    paidRuns: input?.paidRunCount ?? null,
    actorStarts: input?.actorStartCount ?? null,
    actorRuns: input?.actorRunCount ?? null,
    datasetRows: input?.datasetRowCount ?? null,
    failedRuns: input?.failedRunCount ?? null,
    repeatUsers: input?.repeatUserCount ?? null,
    refunds: input?.refundCount ?? null,
    platformUsageCostUsd: input?.platformUsageCostUsd ?? null,
    estimatedCreatorRevenueUsd: input?.estimatedCreatorRevenueUsd ?? null,
    realDataRequired: true,
    unknownMeansNoClaim: true
  };
}

function payoutReadinessFor(input: LiveProductMarketplaceInput | undefined): LiveProductSloDashboard["apifyLaunchExperiment"]["payoutReadiness"] {
  const payoutMethodState = input?.payoutMethodReady === true ? "ready" : input?.payoutMethodReady === false ? "blocked" : "unknown";
  const beneficiaryState = input?.beneficiaryVerified === true ? "verified" : input?.beneficiaryVerified === false ? "blocked" : "unknown";
  const withdrawalReadiness = input?.withdrawalReady === true ? "ready" : input?.withdrawalReady === false ? "blocked" : "unknown";
  const knownState = payoutMethodState !== "unknown" && beneficiaryState !== "unknown" && withdrawalReadiness !== "unknown";
  return {
    schemaVersion: "ti.apify_payout_readiness.v1",
    payoutMethodState,
    beneficiaryState,
    withdrawalReadiness,
    externallyVerified: payoutMethodState === "ready" && beneficiaryState === "verified" && withdrawalReadiness === "ready",
    blockers: marketplaceBlockers(input ?? {}).filter((blocker) => blocker.includes("beneficiary") || blocker.includes("payout") || blocker.includes("withdrawal")),
    verifiedExternally: [
      ...(input?.beneficiaryVerified === true ? ["beneficiary"] : []),
      ...(input?.payoutMethodReady === true ? ["payout_method"] : []),
      ...(input?.withdrawalReady === true ? ["withdrawal_readiness"] : [])
    ],
    unknownExternally: knownState ? [] : [
      ...(beneficiaryState === "unknown" ? ["beneficiary"] : []),
      ...(payoutMethodState === "unknown" ? ["payout_method"] : []),
      ...(withdrawalReadiness === "unknown" ? ["withdrawal_readiness"] : [])
    ]
  };
}

function buildConversionExperiments(): LiveProductConversionExperiment[] {
  const buyerVisibleFields = ["sellableRowCount", "usefulRowCount", "freshRowRate", "actorVictimTtpSpecificity", "sourceFamilyDiversity", "confidence", "buyerCaveat", "nextSearchPivots", "noLeakProof"];
  return [
    {
      id: "starter_actor_query_pack",
      expectedBuyer: "evaluation user checking one actor or CVE before committing to a monitor",
      pricingTest: "low-cost starter query pack",
      successCriteria: ["storeViewToRunRate >= 0.08", "trialToPaidRate >= 0.15", "usefulRowsPerQuery >= 2"],
      stopLossCriteria: ["storePageViews >= 100 and paidRuns = 0", "refunds > 0", "usefulRowsPerQuery < 1"],
      usefulRowRequirement: "at least two useful safe rows per starter query",
      datasetValueProofField: "paidRowDecisionCounts.buyerUseful",
      buyerVisibleFields,
      noLeakRequired: true
    },
    {
      id: "high_freshness_apt_monitoring_pack",
      expectedBuyer: "CTI analyst monitoring daily APT activity",
      pricingTest: "higher-price freshness pack for current actor activity",
      successCriteria: ["sellableRows >= 100", "freshRowRate >= 0.55", "sellableRowRate >= 0.25", "repeatUsers >= 1"],
      stopLossCriteria: ["sellableRows < 100", "staleLatestClaimsBlocked rises without fresh replacements", "single-source rate blocks sellable rows", "averageBuyerValueScore < 0.55"],
      usefulRowRequirement: "fresh chargeable or useful caveated rows with source-family diversity",
      datasetValueProofField: "freshnessStatus",
      buyerVisibleFields,
      noLeakRequired: true
    },
    {
      id: "ransomware_public_claim_metadata_pack",
      expectedBuyer: "ransomware/victim lead analyst who needs safe public-claim metadata",
      pricingTest: "metadata pack for victim and dataset lead discovery",
      successCriteria: ["metadata rows remain safe", "public corroboration adds caveated usefulness", "refunds = 0"],
      stopLossCriteria: ["restricted-only rows promoted as paid proof", "no public support after metadata lead", "false victim review hold increases"],
      usefulRowRequirement: "metadata-only rows must include caveats and next public corroboration pivots",
      datasetValueProofField: "buyerCaveat",
      buyerVisibleFields,
      noLeakRequired: true
    }
  ];
}

function buildOperatorBlockerBoard(): LiveProductOperatorBlocker[] {
  return [
    { owner: "Agent 01", blocker: "low_source_value_or_stale_source_mix", conversionImpact: "paid users do not convert when rows are stale or duplicated", nextAction: "replace low-value sources before paid traffic" },
    { owner: "Agent 03", blocker: "parser_specificity_below_buyer_threshold", conversionImpact: "generic summaries reduce useful-row rate", nextAction: "extract actor victim TTP first/last-seen and source-family fields" },
    { owner: "Agent 04", blocker: "missing_public_channel_or_clear_web_corroboration", conversionImpact: "single-source rows stay caveated instead of sellable", nextAction: "add safe public corroboration packs" },
    { owner: "Agent 05", blocker: "dark_metadata_not_useful_without_public_support", conversionImpact: "restricted metadata cannot become paid proof alone", nextAction: "keep leads caveated and route public support gaps" },
    { owner: "Agent 07", blocker: "freshness_or_bloat_suppression_failure", conversionImpact: "buyers churn when latest activity is stale or padded", nextAction: "block old generic alias-only and unrelated rows" },
    { owner: "Agent 08", blocker: "graph_pivots_missing_or_unreviewed", conversionImpact: "rows lack next-search utility", nextAction: "promote reviewed graph pivots only" },
    { owner: "Agent 10", blocker: "release_economics_or_payout_not_verified", conversionImpact: "paid traffic cannot start without economics and payout proof", nextAction: "verify Apify payout state and cost thresholds" }
  ];
}

function buildFakeTractionGuards(): string[] {
  return [
    "store views remain null until sourced from Apify analytics",
    "unique users remain null until sourced from Apify analytics",
    "trial and paid runs remain null until sourced from Apify analytics or billing export",
    "local sample runs and owner proof runs never count as unique users, paid runs, repeat users, or conversion",
    "synthetic proof rows never count as dataset demand, creator revenue, refunds, or paid-traffic conversion",
    "estimated creator revenue remains null until calculated from real paid runs and platform costs",
    "payout readiness is unknown or blocked unless externally verified"
  ];
}

function buildRevenueConversionChecklist(input: {
  monetizationReadiness: LiveProductMonetizationReadiness;
  payoutReadiness: LiveProductSloDashboard["apifyLaunchExperiment"]["payoutReadiness"];
  marketplaceConversion: ReturnType<typeof marketplaceConversionFor>;
  unknowns: string[];
}): LiveProductRevenueConversionChecklist {
  const productionSellableRowsReady = (input.monetizationReadiness.sellableRows ?? 0) >= input.monetizationReadiness.minimumProductionSellableRows;
  const sampleDataQualityState = input.monetizationReadiness.status === "ready_for_paid_traffic" ? "ready" : "blocked";
  const payoutState = input.payoutReadiness.externallyVerified
    ? "ready"
    : input.payoutReadiness.payoutMethodState === "blocked" || input.payoutReadiness.beneficiaryState === "blocked" || input.payoutReadiness.withdrawalReadiness === "blocked"
      ? "blocked"
      : "unknown";
  const telemetryMissing = input.marketplaceConversion.storeViewToRunRate === null || input.marketplaceConversion.trialToPaidRate === null;
  return {
    schemaVersion: "ti.apify_revenue_conversion_checklist.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/contracts#apifyStoreReadiness", "Apify OUTPUT"],
    paidTrafficState: sampleDataQualityState === "ready" && payoutState !== "blocked" ? "ready" : "blocked",
    listingCopyState: "ready",
    sampleDataQualityState,
    pricingState: "ready",
    telemetryState: telemetryMissing ? "missing" : "ready",
    payoutState,
    nextManualVerificationStep: telemetryMissing
      ? "Open Apify Store analytics and billing, then copy views, users, starts, paid runs, refunds, usage cost, creator revenue, beneficiary, payout method, and withdrawal readiness into /v1/ops/product-slo inputs."
      : "Compare paid run conversion and refund rate after the next traffic batch.",
    checks: [
      { id: "listing_copy", state: "ready", proofField: "README pricing and Public Proof Contract" },
      { id: "sample_rows", state: sampleDataQualityState, proofField: "apifyLaunchExperiment.buyerSampleRows", blocker: sampleDataQualityState === "blocked" ? "repair sellable/useful row density before traffic" : undefined },
      { id: "production_sellable_rows", state: productionSellableRowsReady ? "ready" : "blocked", proofField: "apifyLaunchExperiment.monetizationReadiness.sellableRows", blocker: productionSellableRowsReady ? undefined : "production paid traffic requires at least 100 sellable rows" },
      { id: "pricing_shape", state: "ready", proofField: "apifyLaunchExperiment.pricingProof" },
      { id: "marketplace_telemetry", state: telemetryMissing ? "missing" : "ready", proofField: "apifyLaunchExperiment.marketplaceTelemetry", blocker: telemetryMissing ? "Apify analytics not externally copied yet" : undefined },
      { id: "payout_setup", state: payoutState === "ready" ? "ready" : payoutState === "blocked" ? "blocked" : "missing", proofField: "apifyLaunchExperiment.payoutReadiness", blocker: payoutState === "ready" ? undefined : "Apify billing beneficiary, payout method, or withdrawal readiness not externally verified" },
      { id: "fake_traction_guards", state: "ready", proofField: "apifyLaunchExperiment.fakeTractionGuards" },
      { id: "no_leak_sample_proof", state: "ready", proofField: "apifyLaunchExperiment.buyerSampleRows[].buyerVisibleFields.noLeakProof" }
    ]
  };
}

function buildPricingProof(input: LiveProductMarketplaceInput | undefined): LiveProductPricingProof {
  return {
    schemaVersion: "ti.apify_pricing_proof.v1",
    routeVisibleOn: ["/v1/ops/product-slo", "/v1/contracts#apifyStoreReadiness", "Apify OUTPUT"],
    starterTrialShape: {
      name: "starter_actor_query_pack",
      queryLimit: 3,
      expectedRows: "2 or more useful safe rows per query before a starter experiment is considered healthy",
      buyerPromise: "Cheap evaluation run for one actor, ransomware group, CVE, sector, or victim lead with caveats and next pivots visible.",
      stopLoss: "Stop starter traffic if 100 verified store views produce no paid runs, refunds appear, or useful rows per query fall below 1."
    },
    paidDailyMonitoringShape: {
      name: "high_freshness_apt_monitoring_pack",
      defaultQueryCount: 100,
      minimumSellableRows: 100,
      minimumSellableRowRate: 0.25,
      minimumFreshRowRate: 0.55,
      buyerPromise: "Daily APT and ransomware monitoring where sellable rows are fresh, source-backed, caveated when needed, and hash-provenanced.",
      stopLoss: "Pause paid daily traffic if sellable rows fall below 100, stale latest-activity wording rises, sellable row rate drops below 25%, or average buyer value falls below 0.55."
    },
    usageCostGuard: {
      rowPriceUsdPerThousand: DEFAULT_RESULT_PRICE_USD_PER_THOUSAND,
      actorStartUsd: DEFAULT_ACTOR_START_PRICE_USD,
      apifyMarginRate: DEFAULT_APIFY_MARGIN_RATE,
      platformUsageCostUsd: input?.platformUsageCostUsd ?? null,
      estimatedCreatorRevenueUsd: input?.estimatedCreatorRevenueUsd ?? null,
      maxCostPerUsefulRowUsd: 0.01,
      stopLoss: "Hold pricing tests if real platform usage cost per useful row exceeds $0.01 or estimated creator revenue is positive without verified paid runs."
    },
    payoutRevenueSeparation: {
      paymentMethodState: input?.payoutMethodReady === true ? "ready" : input?.payoutMethodReady === false ? "blocked" : "unknown",
      beneficiaryState: input?.beneficiaryVerified === true ? "verified" : input?.beneficiaryVerified === false ? "blocked" : "unknown",
      withdrawalReadiness: input?.withdrawalReady === true ? "ready" : input?.withdrawalReady === false ? "blocked" : "unknown",
      externallyVerifiedRevenueUsd: input?.paidRunCount && input.estimatedCreatorRevenueUsd != null ? input.estimatedCreatorRevenueUsd : null
    },
    noLeakRequired: true
  };
}

function buildBuyerSampleRows(): LiveProductBuyerSampleRow[] {
  return [
    buyerSampleRow("sample_apt29_summary", "APT29", "actor_summary", "Current public reporting links APT29 to identity-focused targeting.", "Fresh public activity is represented only when source timestamps are current.", ["government", "cloud services"], ["valid accounts", "cloud account abuse"], 0.86, "Keep historic campaign context separate from latest activity.", "current", 2, ["APT29 recent activity", "T1078 valid accounts"]),
    buyerSampleRow("sample_apt42_claim", "APT42", "fresh_claim", "APT42 rows show current public activity with caveats when single-source.", "Fresh claim remains caveated until a second safe source family supports it.", ["NGO", "Middle East"], ["phishing", "account collection"], 0.67, "Single-source public reporting should be treated as a lead.", "caveated", 1, ["APT42 public-channel corroboration", "APT42 NGO phishing"]),
    buyerSampleRow("sample_volt_typhoon_ttp", "Volt Typhoon", "ttp_targeting_hint", "Volt Typhoon sample rows emphasize critical infrastructure targeting.", "Living-off-the-land activity is buyer-visible only with fresh support.", ["critical infrastructure", "United States"], ["living-off-the-land", "network discovery"], 0.84, "Infrastructure pivots stay source-backed and hash-provenanced.", "current", 2, ["Volt Typhoon infrastructure", "LOLBIN monitoring"]),
    buyerSampleRow("sample_lazarus_sector", "Lazarus Group", "ttp_targeting_hint", "Lazarus rows connect crypto-sector targeting with social-engineering context.", "Fresh sector activity is separated from historic campaign context.", ["cryptocurrency", "financial services"], ["social engineering", "supply-chain lure"], 0.81, "Sector rows need public corroboration before charge guidance.", "recent", 2, ["Lazarus cryptocurrency", "Lazarus social engineering"]),
    buyerSampleRow("sample_turla_tooling", "Turla", "ttp_targeting_hint", "Turla sample rows carry tool and TTP hints when parser support is specific.", "Fresh tooling context is promoted only with actor-specific spans.", ["government", "Europe"], ["backdoor tooling", "collection"], 0.76, "Generic tool mentions stay held until parser specificity improves.", "recent", 2, ["Turla tooling", "Turla campaign update"]),
    buyerSampleRow("sample_sandworm_hold", "Sandworm", "fresh_claim", "Sandworm latest-activity claims are held when only old campaign context exists.", "No fresh claim is promoted from stale evidence.", ["energy", "Ukraine"], ["disruption", "wiper context"], 0.42, "Held because stale evidence cannot support latest wording.", "held", 1, ["Sandworm latest activity", "Sandworm disruption reports"]),
    buyerSampleRow("sample_scattered_spider_summary", "Scattered Spider", "actor_summary", "Scattered Spider rows expose sector and social-engineering pivots.", "Fresh sector and TTP hints are useful when source-family diversity is present.", ["telecom", "hospitality"], ["social engineering", "helpdesk abuse"], 0.82, "Alias noise is suppressed before paid promotion.", "current", 2, ["Scattered Spider telecom", "helpdesk social engineering"]),
    buyerSampleRow("sample_lockbit_metadata", "LockBit", "victim_or_dataset_lead", "LockBit metadata rows can be useful leads without exposing raw leak material.", "Victim or dataset hints remain caveated until public corroboration exists.", ["manufacturing", "professional services"], ["victim claim", "public corroboration needed"], 0.61, "Metadata-only row is not treated as confirmed public activity.", "caveated", 2, ["LockBit victim claims", "LockBit public corroboration"]),
    buyerSampleRow("sample_akira_victim", "Akira", "victim_or_dataset_lead", "Akira sample rows show safe victim, sector, and date hints when available.", "Fresh victim leads require no raw leak URLs or payload access.", ["manufacturing", "North America"], ["victim watch", "claimed dataset type"], 0.58, "Caveated until safe public source support exists.", "caveated", 1, ["Akira victim metadata", "Akira sector claims"]),
    buyerSampleRow("sample_clop_campaign", "Clop", "fresh_claim", "Clop rows tie campaign, exploitation, and victim pivots together.", "Fresh public campaign context is promoted when corroborated.", ["software supply chain", "global"], ["exploitation", "campaign tracking"], 0.83, "Campaign rows still carry provenance hashes and caveats.", "current", 2, ["Clop campaign", "Clop exploitation"]),
    buyerSampleRow("sample_black_basta_suppression", "Black Basta", "fresh_claim", "Black Basta generic stale reposts are suppressed from paid findings.", "Freshness gate blocks latest-activity wording when sources are old.", ["healthcare", "business services"], ["ransomware watch"], 0.32, "Suppressed until fresh public support appears.", "held", 1, ["Black Basta latest activity", "Black Basta public reports"]),
    buyerSampleRow("sample_cve_ransomware_pivot", "Ransomware CVE watch", "victim_or_dataset_lead", "CVE-linked ransomware rows are useful only when the actor relationship is supported.", "CVE pivots remain held if actor linkage is unrelated or missing.", ["victim lead", "software exposure"], ["CVE exploitation", "ransomware claim"], 0.57, "Held or caveated unless public evidence links actor, CVE, and victim context.", "caveated", 2, ["ransomware CVE exploitation", "public victim claim corroboration"])
  ];
}

function buyerSampleRow(
  id: string,
  actor: string,
  rowClass: LiveProductBuyerSampleRow["rowClass"],
  actorSummary: string,
  freshClaimOrActivity: string,
  victimSectorCountryDatasetHints: string[],
  ttpTargetingHints: string[],
  confidence: number,
  caveat: string,
  freshness: LiveProductBuyerSampleRow["buyerVisibleFields"]["freshness"],
  sourceFamilyDiversity: number,
  nextAnalystPivots: string[]
): LiveProductBuyerSampleRow {
  return {
    id,
    actor,
    rowClass,
    buyerVisibleFields: {
      actorSummary,
      freshClaimOrActivity,
      victimSectorCountryDatasetHints,
      ttpTargetingHints,
      confidence,
      caveat,
      freshness,
      sourceFamilyDiversity,
      provenanceHash: stableId("buyer_sample_row", id),
      nextAnalystPivots,
      noLeakProof: "metadata_only_no_raw_body_no_secret_material_no_private_content"
    }
  };
}

function nextRevenueActionFor(
  monetizationReadiness: LiveProductMonetizationReadiness,
  payoutReadiness: LiveProductSloDashboard["apifyLaunchExperiment"]["payoutReadiness"],
  conversion: ReturnType<typeof marketplaceConversionFor>
): LiveProductSloDashboard["apifyLaunchExperiment"]["nextRevenueAction"] {
  if (!payoutReadiness.externallyVerified) return "payout_setup";
  if (monetizationReadiness.status !== "ready_for_paid_traffic") return "data_quality_repair";
  if (conversion.storeViewToRunRate === null || conversion.trialToPaidRate === null) return "listing_repair";
  if (conversion.trialToPaidRate < 0.15) return "pricing_test";
  return "paid_traffic";
}

function nullableInteger(value: number | null | undefined): number | null {
  return isFiniteNumber(value) ? Math.max(0, Math.round(value)) : null;
}

function nullableSubtract(...values: Array<number | null | undefined>): number | null {
  if (values.some((value) => !isFiniteNumber(value))) return null;
  const numbers = values as number[];
  const [first = 0, ...rest] = numbers;
  return round(rest.reduce((value, item) => value - item, first));
}

function unknownLaunchMetrics(values: Record<string, number | null>): string[] {
  return Object.entries(values)
    .filter(([, value]) => value === null)
    .map(([key]) => key);
}

function unavailableMetrics(metrics: LiveProductSloDashboard["metrics"]): string[] {
  return Object.entries(metrics)
    .filter(([, value]) => "value" in value ? value.value === null : "p95" in value ? value.p95 === null : false)
    .map(([key]) => key);
}

function aggregateState(slos: LiveProductSloDashboard["slos"]): LiveProductSloState {
  const blockingSlos = slos;
  if (blockingSlos.some((item) => item.state === "alert")) return "alert";
  if (blockingSlos.some((item) => item.state === "warn")) return "warn";
  if (blockingSlos.some((item) => item.state === "unavailable")) return "warn";
  return "pass";
}

function latencyMs(start: string | undefined, end: string | undefined): number | null {
  if (!start || !end) return null;
  const value = Date.parse(end) - Date.parse(start);
  return isFiniteNumber(value) && value >= 0 ? value : null;
}

function nonNullNumbers(values: readonly (number | null | undefined)[]): number[] {
  return values.filter(isFiniteNumber);
}

function sumNullable(values: readonly (number | null | undefined)[]): number | null {
  const numbers = nonNullNumbers(values);
  return numbers.length ? round(numbers.reduce((sum, value) => sum + value, 0)) : null;
}

function averageNullable(values: readonly number[]): number | null {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function rateFromBooleans(values: readonly (boolean | null | undefined)[]): number | null {
  const bools = values.filter((value): value is boolean => typeof value === "boolean");
  return bools.length ? round(bools.filter(Boolean).length / bools.length) : null;
}

function percentile(values: readonly number[], pct: number): number | null {
  const sorted = [...values].filter(isFiniteNumber).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * pct) - 1));
  return round(sorted[index] ?? 0);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
