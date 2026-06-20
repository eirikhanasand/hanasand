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
        buyerUseful: number | null;
      };
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
      buyerUseful: number | null;
    };
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
    queueAgeP95Seconds: number | null;
    memoryRssGb: number | null;
    diskGrowthGbPerDay: number | null;
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
    marketplaceConversion
  });
  const sourceMonetizationGate = buildSourceMonetizationGate(input.sourceMonetization, costPerUsefulRowUsd);
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
    sourceMonetizationGate
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
    slos,
    apifyLaunchExperiment: {
      windowDays: 7,
      actor: input.actorRun ?? {},
      runs: input.actorRun?.status ? 1 : null,
      uniqueUsers: input.marketplace?.uniqueUserCount ?? null,
      successfulQueries: successfulQueries(measurements, input.actorRun),
      usefulActivityClaimRows: input.actorRun?.activityClaimRowCount ?? sumNullable(measurements.map((item) => item.activityClaimCount)),
      paidRowDecisionCounts,
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
      queueAgeP95Seconds: input.metrics.queueAgeSeconds.value,
      memoryRssGb: input.metrics.memoryRssGb.value,
      diskGrowthGbPerDay: input.metrics.diskGrowthGbPerDay.value
    }
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
      paidRowDecisionCounts: input.paidRowDecisionCounts
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
  return {
    sellable,
    includedWithCaveat,
    coverageGapOnly,
    hold,
    buyerUseful: sumNullable([sellable, includedWithCaveat])
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
