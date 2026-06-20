import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { FrontierGroupSummary } from "../frontier/frontier.ts";
import type { CollectionRun, IncidentCandidate, RawCapture, SourceRecord } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";

export type LiveProductProofMode = "fixture" | "local" | "inspur" | "public_live";
export type LiveProductSloState = "pass" | "warn" | "alert" | "unavailable";

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
  repeatUserCount?: number | null;
  beneficiaryVerified?: boolean | null;
  payoutMethodReady?: boolean | null;
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
      repeatUserCount: number | null;
      storeViewToRunRate: number | null;
      storeViewToUserRate: number | null;
      runsPerUser: number | null;
      trialToPaidRate: number | null;
      beneficiaryStatus: "verified" | "blocked" | "unknown";
      payoutMethodStatus: "ready" | "blocked" | "unknown";
      blockers: string[];
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
}

export interface LiveProductMonetizationReadiness {
  schemaVersion: "ti.live_product_monetization_readiness.v1";
  status: "ready_for_paid_traffic" | "blocked_for_paid_traffic";
  targetSellableRows: number | null;
  sellableRows: number | null;
  usefulForBuyerRows: number | null;
  averageBuyerValueScore: number | null;
  sellableRowRate: number | null;
  blockers: string[];
  nextRevenueAction: string;
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
  const buyerVisibleQualityLiftGate = buildBuyerVisibleQualityLiftGate();
  const marketplaceGraphSignals = buildMarketplaceGraphSignals();
  const qualityConversionGate = buildQualityConversionGate();
  const liveFreshnessQualityGate = buildLiveFreshnessQualityGate();
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
    beneficiaryVerified: input.marketplace?.beneficiaryVerified === undefined ? null : Number(input.marketplace.beneficiaryVerified),
    payoutMethodReady: input.marketplace?.payoutMethodReady === undefined ? null : Number(input.marketplace.payoutMethodReady)
  });
  const dailySnapshot = buildDailySnapshot({
    generatedAt,
    proofMode,
    state,
    storagePath: input.snapshotStoragePath ?? DEFAULT_SNAPSHOT_PATH,
    metrics,
    paidProductEconomics,
    sourceMonetizationGate,
    monetizationReadiness
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
    buyerVisibleQualityLiftGate,
    marketplaceGraphSignals,
    qualityConversionGate,
    liveFreshnessQualityGate,
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
      agent07Evaluation: ["emptyResultHonestyRate", "duplicateArticleRate", "actorDatasetUsefulness", "sourcePayworthyRate"],
      agent09StableApiFields: ["route", "schemaVersion", "deploymentProof", "apifyLaunchExperiment", "paidProductEconomics.marketplace"]
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
    monetizationReadiness: input.monetizationReadiness
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
      repeatUserCount: marketplace.repeatUserCount ?? null,
      storeViewToRunRate: input.marketplaceConversion.storeViewToRunRate,
      storeViewToUserRate: input.marketplaceConversion.storeViewToUserRate,
      runsPerUser: input.marketplaceConversion.runsPerUser,
      trialToPaidRate: input.marketplaceConversion.trialToPaidRate,
      beneficiaryStatus: marketplace.beneficiaryVerified === true ? "verified" : marketplace.beneficiaryVerified === false ? "blocked" : "unknown",
      payoutMethodStatus: marketplace.payoutMethodReady === true ? "ready" : marketplace.payoutMethodReady === false ? "blocked" : "unknown",
      blockers
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
  const targetSellableRows = nullableInteger(actorRun?.targetSellableRows) ?? (rowCount !== null ? Math.max(1, Math.ceil(rowCount * 0.25)) : null);
  const sellableRows = paidRowDecisionCounts.sellable;
  const usefulForBuyerRows = paidRowDecisionCounts.buyerUseful;
  const averageBuyerValueScore = isFiniteNumber(actorRun?.averageBuyerValueScore) ? round(actorRun.averageBuyerValueScore) : null;
  const sellableRowRate = rateFromCounts(sellableRows, rowCount);
  const blockers = [
    sellableRows === null ? "paid_row_decision_counts_missing" : null,
    targetSellableRows !== null && sellableRows !== null && sellableRows < targetSellableRows ? "sellable_rows_below_paid_traffic_floor" : null,
    averageBuyerValueScore === null ? "average_buyer_value_missing" : null,
    averageBuyerValueScore !== null && averageBuyerValueScore < 0.55 ? "average_buyer_value_below_listing_floor" : null,
    usefulForBuyerRows === 0 ? "no_buyer_useful_rows" : null
  ].filter((blocker): blocker is string => Boolean(blocker));
  return {
    schemaVersion: "ti.live_product_monetization_readiness.v1",
    status: blockers.length === 0 ? "ready_for_paid_traffic" : "blocked_for_paid_traffic",
    targetSellableRows,
    sellableRows,
    usefulForBuyerRows,
    averageBuyerValueScore,
    sellableRowRate,
    blockers,
    nextRevenueAction: blockers.includes("sellable_rows_below_paid_traffic_floor")
      ? "add_or_repair live corroborating sources until at least 25 percent of output rows are chargeable findings"
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
  if (input.actorViewCount === undefined || input.actorViewCount === null) blockers.push("apify_store_view_count_missing");
  if (input.actorRunCount === undefined || input.actorRunCount === null) blockers.push("apify_actor_run_count_missing");
  if (input.uniqueUserCount === undefined || input.uniqueUserCount === null) blockers.push("apify_unique_user_count_missing");
  if (input.trialRunCount === undefined || input.trialRunCount === null) blockers.push("apify_trial_run_count_missing");
  if (input.paidRunCount === undefined || input.paidRunCount === null) blockers.push("apify_paid_run_count_missing");
  if (input.repeatUserCount === undefined || input.repeatUserCount === null) blockers.push("apify_repeat_user_count_missing");
  return blockers;
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
