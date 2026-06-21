import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { evaluateAdapterMetricAlerts, recordAdapterRunMetrics } from "../ops/adapterMetrics.ts";
import { loadRuntimeConfig, validateResourceBudget } from "../ops/config.ts";
import {
  CUTOVER_MOUNTED_ROUTE_PROOF_REQUIREMENTS,
  assertCutoverApplyPlanPass,
  assertCutoverRehearsalPass,
  assertLiveSearchDeployVerification,
  assertLiveSearchPromotionSummary,
  assertLiveSearchSoakPromotion,
  assertScraperNativeSearchReadiness,
  buildCutoverSoakReleasePacket,
  buildLiveSearchPromotionSummary,
  buildLiveSearchOpsDto,
  buildCutoverApplyPlanPacket,
  buildCutoverPromotionPacket,
  evaluateCutoverRehearsal,
  evaluateDeploymentDrift,
  estimateLiveSearchPollingImpact,
  evaluateLiveSearchSoak,
  evaluateLiveSearchMetricAlerts,
  recordLiveSearchMetrics,
  verifyScraperNativeSearchReadiness,
  verifyLiveSearchDeployProbe
} from "../ops/liveSearch.ts";
import type { CutoverApplyPlanAction, CutoverDeploymentProofSlot, CutoverMountedRouteProof, CutoverRehearsalInput, CutoverRuntimeReleaseProof, CutoverSoakWorkstreamInput, DeploymentDriftProbe } from "../ops/liveSearch.ts";
import { sanitizeFields } from "../ops/logger.ts";
import { MetricsRegistry } from "../ops/metrics.ts";
import { appendLiveProductDailySnapshot, buildLiveProductSloDashboard, readLiveProductDailySnapshots } from "../ops/productSlo.ts";
import { assertCapacityWithinBudget, buildResourceSnapshot, estimateCapacity, sizeWorkerPools } from "../ops/resourceControls.ts";
import { WorkerSupervisor } from "../ops/supervisor.ts";
import type { CollectionRun, IncidentCandidate, RawCapture, SourceRecord, GraphExportEnforcementDto, GraphExportSlaDto } from "../types.ts";
import type { TelegramPublicSlaReportDto } from "../adapters/telegramPublic.ts";

const logger = {
  debug() {},
  info() {},
  warn() {},
  error() {}
};

function collectionRun(id: string, status: CollectionRun["status"], createdAt: string, updatedAt: string, captureCount: number): CollectionRun {
  return {
    id,
    planId: `plan_${id}`,
    requestId: `req_${id}`,
    status,
    createdAt,
    updatedAt,
    startedAt: updatedAt,
    completedAt: status === "completed" ? updatedAt : undefined,
    taskCount: 1,
    reviewTaskCount: 0,
    rejectedSourceCount: 0,
    captureCount,
    incidentCount: captureCount > 0 ? 1 : 0
  };
}

function sourceRecord(id: string, lastCollectedAt: string): SourceRecord {
  return {
    id,
    name: id,
    type: "rss",
    url: `https://example.test/${id}.xml`,
    accessMethod: "public_http",
    status: "active",
    risk: "low",
    trustScore: 0.9,
    crawlFrequencySeconds: 3600,
    legalNotes: "public fixture",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: lastCollectedAt,
    lastSeenAt: lastCollectedAt,
    crawlState: { lastCollectedAt, retryCount: 0 }
  };
}

function rawCapture(id: string, sourceId: string, collectedAt: string, metadata: Record<string, unknown>): RawCapture {
  return {
    id,
    sourceId,
    url: `https://example.test/${id}`,
    collectedAt,
    contentHash: `hash_${id}`,
    mediaType: "text/plain",
    storageKind: "metadata_only",
    metadata,
    sensitive: false
  };
}

function incidentCandidate(id: string, captureId: string): IncidentCandidate {
  return {
    id,
    sourceId: "src_mandiant",
    captureId,
    extractorVersion: "test",
    title: "APT29 June infrastructure claim",
    summary: "Safe metadata incident cluster",
    firstSeenAt: "2026-06-20T10:01:00.000Z",
    confidence: 0.8,
    entities: [],
    indicators: [],
    reviewReasons: []
  };
}

function productSloFrontierSummary() {
  return {
    total: 2,
    queued: 1,
    leased: 1,
    groups: { tenants: { global: 2 }, sources: { src_mandiant: 2 }, adapterTypes: { rss: 2 }, priorityBuckets: { high: 2 }, ageBuckets: { fresh: 2 } },
    budgets: {},
    metrics: {
      queueAgeSeconds: { max: 12, average: 8, highPriorityMax: 10 },
      throughput: { completed: 4, failed: 0, cancelled: 0, retryScheduled: 0, retryExhausted: 0 },
      retryPressure: 0,
      budgetExhaustion: 0,
      sourceStarvation: 0,
      tenantStarvation: 0,
      adapterSaturation: { rss: 1 }
    }
  };
}

describe("ops controls", () => {
  test("keeps default Inspur budgets within the normal scraper ceiling", () => {
    const config = loadRuntimeConfig({});

    expect(config.resourceBudget.maxRamGb).toBe(96);
    expect(config.resourceBudget.normalCeilingGb).toBe(160);
    expect(config.resourceBudget.reservedDiskGb).toBe(500);
  });

  test("rejects unapproved memory ceiling and disk reservation drift", () => {
    expect(() => validateResourceBudget({
      maxRamGb: 192,
      normalCeilingGb: 192,
      reservedDiskGb: 500,
      maxCollectionWorkers: 1,
      maxProcessingWorkers: 1,
      maxTelegramWorkers: 0,
      maxBrowserWorkers: 0,
      maxDarknetMetadataWorkers: 0,
      maxQueueItems: 1
    })).toThrow("160 GB");

    expect(() => validateResourceBudget({
      maxRamGb: 32,
      normalCeilingGb: 96,
      reservedDiskGb: 100,
      maxCollectionWorkers: 1,
      maxProcessingWorkers: 1,
      maxTelegramWorkers: 0,
      maxBrowserWorkers: 0,
      maxDarknetMetadataWorkers: 0,
      maxQueueItems: 1
    })).toThrow("500 GB");
  });

  test("redacts sensitive log fields and exposes metric snapshots", () => {
    const sanitized = sanitizeFields({
      token: "secret",
      rawText: "payload",
      requestId: "req_1",
      runId: "run_1",
      taskId: "task_1",
      sourceId: "src_1",
      adapter: "rss",
      policyDecision: "allowed",
      count: 2
    });
    const metrics = new MetricsRegistry();

    metrics.increment("scraper_policy_blocks_total", 2, { sourceType: "tor_metadata" });
    metrics.gauge("scraper_frontier_queue_items", 12);

    expect(sanitized.token).toBe("[redacted]");
    expect(sanitized.rawText).toBe("[redacted]");
    expect(sanitized.requestId).toBeUndefined();
    expect(sanitized.runId).toBeUndefined();
    expect(sanitized.taskId).toBeUndefined();
    expect(sanitized.sourceId).toBeUndefined();
    expect(sanitized.adapter).toBeUndefined();
    expect(sanitized.policyDecision).toBeUndefined();
    expect(metrics.snapshot()).toHaveLength(2);
    expect(metrics.toPrometheus()).toContain("scraper_frontier_queue_items 12");
  });

  test("reports resource and worker supervisor state", () => {
    const metrics = new MetricsRegistry();
    const supervisor = new WorkerSupervisor(logger, metrics);
    const worker = supervisor.register("collector-1", "collection");

    supervisor.markRunning(worker.id);
    supervisor.markFailed(worker.id, new Error("boom"));

    const snapshot = buildResourceSnapshot({
      budget: {
        maxRamGb: 96,
        normalCeilingGb: 160,
        reservedDiskGb: 500,
        maxCollectionWorkers: 64,
        maxProcessingWorkers: 16,
        maxTelegramWorkers: 8,
        maxBrowserWorkers: 0,
        maxDarknetMetadataWorkers: 2,
        maxQueueItems: 50_000
      },
      queueItems: 12
    });

    expect(supervisor.snapshot()[0]?.state).toBe("failed");
    expect(metrics.snapshot().some((sample) => sample.name === "scraper_worker_failures_total")).toBe(true);
    expect(snapshot.memory.status).not.toBe("critical");
    expect(snapshot.queue.currentItems).toBe(12);
  });

  test("calculates worker capacity against the 96 GB target", () => {
    const config = loadRuntimeConfig({});
    const estimate = estimateCapacity(config.resourceBudget);

    expect(estimate.targetMb).toBe(96 * 1024);
    expect(estimate.ceilingMb).toBe(160 * 1024);
    expect(estimate.estimatedMb).toBeLessThan(estimate.targetMb);
    expect(estimate.breakdown.browserMb).toBe(0);
    expect(() => assertCapacityWithinBudget(estimate)).not.toThrow();
  });

  test("flags aggressive browser and collection concurrency before the 160 GB ceiling", () => {
    const estimate = estimateCapacity({
      maxRamGb: 96,
      normalCeilingGb: 160,
      reservedDiskGb: 500,
      maxCollectionWorkers: 384,
      maxProcessingWorkers: 48,
      maxTelegramWorkers: 24,
      maxBrowserWorkers: 24,
      maxDarknetMetadataWorkers: 12,
      maxQueueItems: 250_000
    });

    expect(estimate.estimatedMb).toBeGreaterThan(estimate.targetMb);
    expect(estimate.estimatedMb).toBeLessThan(estimate.ceilingMb);
    expect(estimate.status).toBe("warn");
    expect(() => assertCapacityWithinBudget(estimate)).toThrow("target");
  });

  test("marks runtime memory and queue ratios as warning or critical deterministically", () => {
    const snapshot = buildResourceSnapshot({
      budget: {
        maxRamGb: 1,
        normalCeilingGb: 160,
        reservedDiskGb: 500,
        maxCollectionWorkers: 64,
        maxProcessingWorkers: 16,
        maxTelegramWorkers: 8,
        maxBrowserWorkers: 0,
        maxDarknetMetadataWorkers: 2,
        maxQueueItems: 100
      },
      queueItems: 100,
      memoryUsage: {
        rss: 900 * 1024 * 1024,
        heapTotal: 0,
        heapUsed: 100 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0
      }
    });

    expect(snapshot.memory.status).toBe("warn");
    expect(snapshot.queue.status).toBe("critical");
  });

  test("keeps browser disabled by default and darknet metadata low-concurrency", () => {
    const config = loadRuntimeConfig({});
    const pools = sizeWorkerPools(config.resourceBudget, "max");

    expect(config.browserWorkersEnabled).toBe(false);
    expect(config.resourceBudget.maxBrowserWorkers).toBe(0);
    expect(config.resourceBudget.maxDarknetMetadataWorkers).toBeLessThanOrEqual(2);
    expect(pools.browser).toBe(0);
    expect(pools.darknetMetadata).toBeLessThanOrEqual(8);
  });

  test("builds live product SLO dashboard with null revenue unknowns and append-only daily snapshots", async () => {
    const generatedAt = "2026-06-20T12:00:00.000Z";
    const dashboard = buildLiveProductSloDashboard({
      generatedAt,
      proofMode: "inspur",
      runs: [collectionRun("run_apt29", "completed", "2026-06-20T11:59:55.000Z", "2026-06-20T11:59:56.000Z", 29)],
      sources: [sourceRecord("src_mandiant", "2026-06-20T10:00:00.000Z")],
      captures: [rawCapture("cap_claim_1", "src_mandiant", "2026-06-20T10:01:00.000Z", { claimClusterId: "claim_apt29_june" })],
      incidents: [incidentCandidate("inc_apt29", "cap_claim_1")],
      frontier: {
        total: 2,
        queued: 1,
        leased: 1,
        groups: { tenants: { global: 2 }, sources: { src_mandiant: 2 }, adapterTypes: { rss: 2 }, priorityBuckets: { high: 2 }, ageBuckets: { fresh: 2 } },
        budgets: {},
        metrics: {
          queueAgeSeconds: { max: 12, average: 8, highPriorityMax: 10 },
          throughput: { completed: 4, failed: 0, cancelled: 0, retryScheduled: 0, retryExhausted: 0 },
          retryPressure: 0,
          budgetExhaustion: 0,
          sourceStarvation: 0,
          tenantStarvation: 0,
          adapterSaturation: { rss: 1 }
        }
      },
      resource: { memoryRssGb: 4.5, diskGrowthGbPerDay: 3 },
      queryMeasurements: [
        { query: "APT29", proofMode: "inspur", firstResponseMs: 900, firstFreshEvidenceMs: 7000, pollIntervalMs: 3000, status: "ready", rowCount: 29, usefulRowCount: 12, freshRowCount: 24, activityClaimCount: 4, duplicateArticleRate: 0.05, sourceProviderFailures: 0, staleRejected: true, emptyResultHonest: true, apiError: false },
        { query: "Made Up Actor", proofMode: "inspur", firstResponseMs: 650, pollIntervalMs: 3000, status: "empty", rowCount: 0, usefulRowCount: 0, freshRowCount: 0, activityClaimCount: 0, duplicateArticleRate: 0, sourceProviderFailures: 0, staleRejected: true, emptyResultHonest: true, apiError: false }
      ],
      actorRun: { actorId: "apify/public-threat-actor-monitor", actorVersion: "0.6.4", buildId: "build_123", runId: "run_actor_123", datasetId: "ds_123", status: "succeeded", queryCount: 20, rowCount: 98, usefulRowCount: 48, freshRowCount: 64, staleRowCount: 3, activityClaimRowCount: 4, sellableRowCount: 16, includedWithCaveatRowCount: 32, coverageGapOnlyRowCount: 30, holdRowCount: 20, suppressRowCount: 0, targetSellableRows: 25, averageBuyerValueScore: 0.6, defaultWatchlistRun: true },
      cost: { computeCostUsd: 0.0023, resultPriceUsdPerThousand: 3, actorStartPriceUsd: 0.00005, apifyMarginRate: 0.2 },
      marketplace: { actorViewCount: 6, actorRunCount: 2, uniqueUserCount: 1, trialRunCount: 2, paidRunCount: 1, actorStartCount: 2, datasetRowCount: 98, failedRunCount: 0, repeatUserCount: 0, refundCount: 0, platformUsageCostUsd: 0.0023, estimatedCreatorRevenueUsd: 0.235, beneficiaryVerified: false, payoutMethodReady: false, withdrawalReady: false, pricingEffectiveAt: "2026-07-04" },
      sourceMonetization: { evaluatedSourceCandidateCount: 4000, payworthySourceCount: 1468, payworthyThresholdRate: 0.72 },
      snapshotStoragePath: "var/ops/live-product-slo/test.jsonl"
    });

    expect(dashboard.schemaVersion).toBe("ti.live_product_slo_dashboard.v1");
    expect(dashboard.route).toBe("/v1/ops/product-slo");
    expect(dashboard.proofMode).toBe("inspur");
    expect(dashboard.metrics.apiFirstResponseLatencyMs.p95).toBe(900);
    expect(dashboard.metrics.threeSecondPolling.withinTargetRate).toBe(1);
    expect(dashboard.metrics.claimClusterYield.count).toBe(1);
    expect(dashboard.metrics.actorRunSuccessRate.value).toBe(1);
    expect(dashboard.dashboard.state).toBe("alert");
    expect(dashboard.sourceMonetizationGate).toMatchObject({
      state: "alert",
      payworthyRate: 0.367,
      payworthySourceCount: 1468
    });
    expect(dashboard.sourceMonetizationGate.blockers).toEqual(expect.arrayContaining([
      "source_payworthy_rate_below_72_percent",
      "replace_low_value_sources_before_marketplace_scale_claim",
      "10k_20k_60k_tiers_held_until_evaluated"
    ]));
    expect(dashboard.sourceMonetizationGate.heldTiers.map((tier) => tier.tier)).toEqual(expect.arrayContaining([1000, 4000, 10000, 20000, 60000]));
    expect(dashboard.slos.find((item) => item.name === "known_actor_summary_latency")).toMatchObject({ state: "pass", target: "<=2000" });
    expect(dashboard.slos.find((item) => item.name === "stale_result_rejection")).toMatchObject({ state: "pass", target: ">=0.95" });
    expect(dashboard.slos.find((item) => item.name === "actor_useful_row_rate")).toMatchObject({ state: "pass", observed: 0.49 });
    expect(dashboard.slos.find((item) => item.name === "actor_fresh_row_rate")).toMatchObject({ state: "pass", observed: 0.653 });
    expect(dashboard.slos.find((item) => item.name === "source_payworthy_rate")).toMatchObject({ state: "alert", observed: 0.367, target: ">=0.72" });
    expect(dashboard.metrics.costPerUsefulRowUsd.value).toBe(0);
    expect(dashboard.paidProductEconomics.pricing).toMatchObject({ resultPriceUsdPerThousand: 3, actorStartPriceUsd: 0.00005, apifyMarginRate: 0.2, effectiveAt: "2026-07-04" });
    expect(dashboard.paidProductEconomics.latestRun).toMatchObject({ rowCount: 98, usefulRowCount: 48, freshRowCount: 64, staleRowPenaltyRows: 3, defaultWatchlistRun: true });
    expect(dashboard.paidProductEconomics.latestRun.paidRowDecisionCounts).toMatchObject({ sellable: 16, includedWithCaveat: 32, coverageGapOnly: 30, hold: 20, suppress: 0, buyerUseful: 48 });
    expect(dashboard.paidProductEconomics.latestRun.monetizationReadiness).toMatchObject({
      status: "blocked_for_paid_traffic",
      minimumProductionSellableRows: 100,
      targetSellableRows: 100,
      sellableRows: 16,
      usefulForBuyerRows: 48,
      averageBuyerValueScore: 0.6,
      sellableRowRate: 0.163,
      blockers: ["sellable_rows_below_100_production_floor", "sellable_rows_below_paid_traffic_floor"]
    });
    expect(dashboard.paidProductEconomics.projectedRevenue).toMatchObject({ grossRowsUsd: 0.294, grossActorStartUsd: 0.00005, grossTotalUsd: 0.294, apifyMarginUsd: 0.059, netAfterApifyUsd: 0.235, internalUsageCostUsd: 0.002, projectedNetAfterUsageUsd: 0.233, costPerRunUsd: 0.002, costPerRowUsd: 0, costPerUsefulRowUsd: 0 });
    expect(dashboard.paidProductEconomics.marketplace).toMatchObject({ actorViewCount: 6, actorRunCount: 2, uniqueUserCount: 1, trialRunCount: 2, paidRunCount: 1, actorStartCount: 2, datasetRowCount: 98, failedRunCount: 0, repeatUserCount: 0, refundCount: 0, platformUsageCostUsd: 0.0023, estimatedCreatorRevenueUsd: 0.235, storeViewToRunRate: 0.333, storeViewToUserRate: 0.167, runsPerUser: 2, trialToPaidRate: 0.5, withdrawalStatus: "blocked" });
    expect(dashboard.paidProductEconomics.marketplace.blockers).toEqual(expect.arrayContaining(["apify_beneficiary_verification_not_confirmed", "apify_payout_method_not_confirmed", "apify_withdrawal_readiness_not_confirmed"]));
    expect(dashboard.paidProductEconomics.marketplace.fakeTractionGuards.join(" ")).toContain("remain null until sourced from Apify analytics");
    expect(dashboard.sourceMonetizationGate).toMatchObject({
      evaluatedSourceCandidateCount: 4000,
      payworthySourceCount: 1468,
      payworthyRate: 0.367,
      thresholdRate: 0.72,
      state: "alert",
      readyTiers: [],
      proofRunComparison: {
        currentProofRunId: "iMQGeezZ8bx7WtlhQ",
        currentProofDatasetId: "5PLmkE30luBA5Lbgc",
        baselineProofRunId: "rh6D0UInDD6x7GuuD",
        baselineProofDatasetId: "dYbGGA37MRq7pU47O"
      },
      blockers: expect.arrayContaining(["source_payworthy_rate_below_72_percent", "10k_20k_60k_tiers_held_until_evaluated"]) as unknown as string[]
    });
    expect(dashboard.nonMonetizingWorkDetector).toMatchObject({
      schemaVersion: "ti.non_monetizing_work_detector.v1",
      defaultRule: "does_not_count_unless_buyer_visible_metric_moves",
      proofFixture: {
        nonMonetizingExampleCount: 4,
        monetizingExampleCount: 1,
        distinguishesContractOnlyFromBuyerMetricLift: true
      }
    });
    expect(dashboard.nonMonetizingWorkDetector.examples.find((row) => row.workType === "contract_only")).toMatchObject({
      label: "non_monetizing",
      buyerVisibleMetricMoved: false
    });
    expect(dashboard.nonMonetizingWorkDetector.examples.find((row) => row.workType === "buyer_visible_metric_lift")).toMatchObject({
      label: "monetizing",
      buyerVisibleMetricMoved: true
    });
    expect(dashboard.releaseDecision).toMatchObject({
      schemaVersion: "ti.product_release_decision.v1",
      decision: "hold_paid_traffic",
      currentSellableRows: 16,
      productionSellableRowFloor: 100,
      usefulCaveatedRows: 32,
      rowsBlockedFromBilling: 82,
      oneRepairAwayRows: 159,
      projectedSellableRowsFromAcceptedRepairs: 159,
      projectedSellableRowsAfterAcceptedRepairs: 175,
      costPerUsefulRowUsd: 0,
      topBlocker: "sellable_rows_below_100",
      revenueTruth: {
        paidTrafficAllowed: false,
        apifyAnalyticsExternal: true,
        payoutEvidenceExternal: true,
        revenueEvidenceExternal: true,
        proofSizedRunsMayCompleteShapeSafetyOnly: true
      }
    });
    expect(dashboard.releaseDecision.acceptedRepairBuckets.find((bucket) => bucket.source === "parserToSellableRepairPacket.candidates")).toMatchObject({
      owner: "agent_03",
      projectedSellableRows: 87,
      countsTowardProjectedFloor: true
    });
    expect(dashboard.releaseDecision.acceptedRepairBuckets.find((bucket) => bucket.source === "parserRealSellableLift.promotedRows")).toMatchObject({
      owner: "agent_03",
      projectedSellableRows: 20,
      countsTowardProjectedFloor: true
    });
    expect(dashboard.releaseDecision.acceptedRepairBuckets.find((bucket) => bucket.source === "parserRealSellableLift.liveSourceAdmissionPacket")).toMatchObject({
      owner: "agent_03",
      projectedSellableRows: 36,
      countsTowardProjectedFloor: true
    });
    expect(dashboard.releaseDecision.acceptedRepairBuckets.find((bucket) => bucket.source === "hundredSellableRowGraphPivotPlan")).toMatchObject({
      owner: "agent_08",
      projectedSellableRows: 100,
      countsTowardProjectedFloor: false
    });
    expect(dashboard.releaseDecision.acceptedRepairBuckets.find((bucket) => bucket.source === "graphSellableSupportPacket")).toBeUndefined();
    expect(dashboard.releaseDecision.acceptedRepairBuckets.find((bucket) => bucket.source === "darkMetadataPublicHandoff100")).toMatchObject({
      owner: "agent_05",
      projectedSellableRows: 0,
      countsTowardProjectedFloor: false
    });
    expect(dashboard.releaseDecision.exclusionProof).toEqual(expect.arrayContaining([
      expect.objectContaining({ class: "synthetic_rows", countsAsSellable: false }),
      expect.objectContaining({ class: "graph_only_rows", countsAsSellable: false }),
      expect.objectContaining({ class: "stale_rows", countsAsSellable: false }),
      expect.objectContaining({ class: "restricted_only_rows", countsAsSellable: false, currentRows: 100 }),
      expect.objectContaining({ class: "caveat_only_rows", countsAsSellable: false, currentRows: 32 })
    ]));
    expect(dashboard.paidReleaseTruthBoard).toMatchObject({
      schemaVersion: "ti.program_cq_paid_release_truth_board.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "Apify OUTPUT", "/v1/contracts#apifyStoreReadiness", "coordination_agent_10.md"]),
      generatedFrom: "observed_apify_smoke_and_current_slo",
      productionSellableFloor: 100,
      paidTrafficAllowed: false,
      observedProof: {
        proofRunId: "OThlfd0uzSCNnedAO",
        proofDatasetId: "LSen2fYtwFTtOr7vK",
        proofDecision: "shape_safety_proof",
        apifySmokeRows: 12,
        apifySmokeSellableRows: 3,
        apifySmokeBuyerUsefulRows: 9,
        apifySmokeAverageBuyerValueScore: 0.558,
        currentSloSellableRows: 16,
        currentSloBuyerUsefulRows: 48,
        currentSloAverageBuyerValueScore: 0.6,
        remainingRowsFromSmokeProof: 97,
        remainingRowsFromCurrentSlo: 84
      },
      rowDeltaTo100: {
        alreadyChargeableRows: 3,
        remainingSellableRowsNeeded: 97,
        additiveBucketRows: 97,
        bucketMathIsAdditive: true
      },
      conversionObservability: {
        schemaVersion: "ti.program_cw_paid_conversion_observability.v1",
        releaseTrafficDecision: "hold_paid_traffic",
        current_sellable: {
          currentRows: 3,
          currentSloSellableRows: 16,
          proofCommand: "bun test src/tests/ops.test.ts src/tests/api.test.ts",
          owner: "agent_10",
          expectedRowGain: 0,
          canCountNow: true
        },
        projected_after_repair: {
          projectedRows: 159,
          projectedSellableRowsAfterAcceptedRepairs: 175,
          expectedRowGain: 159,
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
          canCountNow: false
        }
      },
      fakeMetricGuard: {
        apifyStoreViews: "external_unknown",
        apifyActorRuns: "external_unknown",
        apifyPaidRuns: "external_unknown",
        apifyRevenueUsd: null,
        apifyPayoutState: "external_unknown",
        conversionRate: null,
        noSyntheticFallback: true
      }
    });
    expect(dashboard.paidReleaseTruthBoard.blockerBuckets.map((bucket) => bucket.blocker)).toEqual([
      "already_chargeable",
      "missing_public_support",
      "parser_repair",
      "freshness",
      "alias_collision",
      "source_family_gap",
      "dark_metadata_public_support",
      "no_leak_proof",
      "marketplace_output_gap"
    ]);
    expect(dashboard.paidReleaseTruthBoard.blockerBuckets.filter((bucket) => bucket.blocker !== "already_chargeable").every((bucket) => bucket.countsTowardPaidFloorNow === false && bucket.coordinationFile.endsWith(".md") && bucket.fastestNextTask.length > 0)).toBe(true);
    expect(Object.keys(dashboard.paidReleaseTruthBoard.conversionObservability)).toEqual(expect.arrayContaining(["current_sellable", "projected_after_repair", "blocked_by_public_support", "blocked_by_parser", "blocked_by_freshness", "blocked_by_suppression", "blocked_by_no_leak", "external_marketplace_unknown"]));
    expect(dashboard.paidReleaseTruthBoard.conversionObservability.projected_after_repair.canCountNow).toBe(false);
    expect(dashboard.paidReleaseTruthBoard.conversionObservability.projected_after_repair.projectedRows).not.toBe(dashboard.paidReleaseTruthBoard.conversionObservability.current_sellable.currentRows);
    expect(dashboard.paidReleaseTruthBoard.conversionObservability.blocked_by_public_support).toMatchObject({ owner: "agent_04", expectedRowGain: 47, canCountNow: false });
    expect(dashboard.paidReleaseTruthBoard.conversionObservability.blocked_by_parser).toMatchObject({ owner: "agent_03", expectedRowGain: 38, canCountNow: false });
    expect(dashboard.paidReleaseTruthBoard.conversionObservability.blocked_by_freshness).toMatchObject({ owner: "agent_07", expectedRowGain: 5, canCountNow: false });
    expect(dashboard.paidReleaseTruthBoard.conversionObservability.blocked_by_suppression).toMatchObject({ owner: "agent_07", expectedRowGain: 4, canCountNow: false });
    expect(dashboard.paidReleaseTruthBoard.conversionObservability.blocked_by_no_leak).toMatchObject({ owner: "agent_06", expectedRowGain: 0, canCountNow: false });
    expect(dashboard.paidReleaseTruthBoard.observedMarketplaceTelemetry).toMatchObject({
      schemaVersion: "ti.program_cx_observed_marketplace_telemetry_contract.v1",
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
      unknownMeansNoClaim: true,
      noSyntheticFallback: true
    });
    expect(dashboard.paidReleaseTruthBoard.observedMarketplaceTelemetry.validationChecks).toEqual(expect.arrayContaining(["paidRuns cannot exceed actorRuns when both are observed", "refunds must be null or an integer >= 0"]));
    expect(dashboard.paidReleaseTruthBoard.observedMarketplaceTelemetry.manualImportPath.length).toBeGreaterThan(0);
    expect(dashboard.paidReleaseTruthBoard.observedMarketplaceTelemetry.apiImportPath.join(" ")).toContain("Reject");
    expect(dashboard.paidReleaseTruthBoard.paidReleaseRunbook).toMatchObject({
      schemaVersion: "ti.program_cx_paid_release_runbook.v1",
      decision: "hold_paid_traffic",
      paidTrafficAllowedWhenAllGatesPass: true
    });
    expect(dashboard.paidReleaseTruthBoard.paidReleaseRunbook.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ gate: "current_sellable_rows", observed: 3, state: "hold" }),
      expect.objectContaining({ gate: "sellable_row_rate", observed: 0.25, state: "pass" }),
      expect.objectContaining({ gate: "useful_row_density", observed: 0.75, state: "pass" }),
      expect.objectContaining({ gate: "average_buyer_value", observed: 0.558, state: "pass" }),
      expect.objectContaining({ gate: "refunds", observed: null, state: "external_unknown" }),
      expect.objectContaining({ gate: "payout_readiness", observed: "external_unknown", state: "external_unknown" })
    ]));
    expect(dashboard.paidReleaseTruthBoard.paidReleaseRunbook.holdWhen).toEqual(expect.arrayContaining(["current sellable rows are below 100"]));
    expect(dashboard.paidReleaseTruthBoard.paidReleaseRunbook.rollbackWhen.some((rule) => rule.includes("refund"))).toBe(true);
    expect(dashboard.paidReleaseTruthBoard.buyerPaidReleaseVerdict).toMatchObject({
      schemaVersion: "ti.program_cu_buyer_paid_release_verdict.v1",
      decision: "hold_paid_traffic",
      buyerReadableStatus: "useful_sample_ready_paid_release_blocked",
      publicListingState: "draft_copy_ready_not_promoted",
      currentSellableRows: 3,
      productionSellableFloor: 100,
      usefulRows: 9,
      usefulRowDensity: 0.75,
      averageBuyerValueScore: 0.558,
      sampleDatasetPolicy: {
        bestRowsShown: 3,
        caveatedRowsExplained: true,
        lowValueRowsSuppressed: true,
        noRawUnsafeMaterial: true
      },
      operatorRecordingRule: {
        externalValuesStayUnknownUntilObserved: true
      },
      noLeakProof: {
        rawEvidenceBodies: false,
        unsafeUrls: false,
        credentials: false,
        restrictedPayloads: false,
        privateContent: false
      }
    });
    expect(dashboard.paidReleaseTruthBoard.buyerPaidReleaseVerdict.releaseBlockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ gate: "current_sellable_rows", state: "hold", observed: 3, countsTowardPaidRelease: false }),
      expect.objectContaining({ gate: "external_marketplace_telemetry", state: "external_unknown", observed: "external_unknown", countsTowardPaidRelease: false }),
      expect.objectContaining({ gate: "payout_readiness", state: "external_unknown", observed: "external_unknown", countsTowardPaidRelease: false }),
      expect.objectContaining({ gate: "pricing_state", state: "external_unknown", observed: "external_unknown", countsTowardPaidRelease: false })
    ]));
    expect(dashboard.paidReleaseTruthBoard.buyerPaidReleaseVerdict.releaseBlockers.every((gate) => gate.buyerMessage.length > 0)).toBe(true);
    expect(dashboard.paidReleaseTruthBoard.buyerPaidReleaseVerdict.operatorRecordingRule.recordOnlyObservedApifyValues).toEqual(expect.arrayContaining(["paidRuns", "refunds", "payoutState", "pricingState"]));
    expect(dashboard.paidReleaseTruthBoard.buyerPaidReleaseVerdict.operatorRecordingRule.proofPaths.join(" ")).toContain("Apify Console");
    expect(dashboard.paidReleaseTruthBoard.hostedPaidReadinessProof).toMatchObject({
      schemaVersion: "ti.hosted_apify_paid_readiness_proof.v1",
      status: "external_token_missing",
      command: "bun run check:hosted-apify-paid-readiness",
      tokenState: "external_token_missing",
      paidTrafficAllowed: false,
      countsTowardPaidPromotion: false,
      localProof: {
        defaultQueryCount: 100,
        sellableRows: 187,
        countsTowardPaidPromotion: false
      },
      latestHostedProof: {
        historical: true,
        runId: "OThlfd0uzSCNnedAO",
        querySetCount: 1,
        sellableRows: 4,
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
        externalBlocker: "external_token_missing",
        observedFields: {
          runId: null,
          datasetId: null,
          sellableRows: null,
          sellableFindingCount: null,
          secondBatchAuditObserved: false,
          lastVerifiedAt: null
        },
        observedProofImport: {
          schemaVersion: "ti.hosted_apify_observed_proof_import_path.v1",
          validationState: "missing",
          validationErrors: []
        }
      },
      paidProofAcceptance: {
        minimumSellableRows: 100,
        minimumSellableFindingRows: 52,
        sourceProvenanceRowsCountTowardFindingFloor: false,
        falsePositiveInflationFailures: 0
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
        caveatedRowsCountTowardChargeable: false
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
        unknownMeansNoClaim: true
      },
      hostedProofOperatorChecklist: {
        schemaVersion: "ti.hosted_apify_proof_operator_checklist.v1",
        status: "missing_proof",
        sampleOnly: false,
        unlockSummary: "none",
        operatorActionBoard: {
          canRunNow: false,
          canVerifyRunNow: false,
          canImportObservedProofNow: false,
          missingSecretNames: ["APIFY_TOKEN"],
          expectedUnlock: "none"
        },
        gateEffects: {
          hosted100: { state: "hold", unlocks: false },
          hosted300: { state: "hold", unlocks: false },
          hosted500: { state: "hold", unlocks: false },
          marketplacePromotion: { state: "hold", unlocks: false }
        }
      }
    });
    expect(dashboard.paidReleaseTruthBoard.hostedPaidReadinessProof.hostedProofOperatorChecklist.missingFields).toEqual(expect.arrayContaining(["runId", "datasetId", "sellableRows", "pricingModel", "payoutEnabled", "observedAt"]));
    expect(dashboard.paidReleaseTruthBoard.hostedPaidReadinessProof.hostedProofOperatorChecklist.operatorActionBoard.nextCommand).toContain("TI_APIFY_HOSTED_PROOF_MODE=run");
    expect(dashboard.paidReleaseTruthBoard.hostedPaidReadinessProof.hostedProofOperatorChecklist.operatorActionBoard.stillBlockedAfterCommand.join(" ")).toContain("paid marketplace promotion remains blocked");
    expect(dashboard.paidReleaseTruthBoard.hostedPaidReadinessProof.hostedProofOperatorChecklist.validationExamples.map((example) => example.name)).toEqual(expect.arrayContaining(["missing_proof", "sample_proof_rejected_for_promotion", "valid_hosted100_hosted300_hold", "valid_hosted300_hosted500_hold", "valid_hosted500_marketplace_hold", "invalid_unsafe_no_leak_proof"]));
    expect(dashboard.paidReleaseTruthBoard.hostedPaidReadinessProof.paidRowIntegrityGate.requiredSignals).toEqual(expect.arrayContaining(["current_public_support", "actor_specific", "finding_context", "freshness_not_stale", "provenance_hash", "no_leak", "buyer_action"]));
    expect(dashboard.paidReleaseTruthBoard.hostedPaidReadinessProof.paidRowIntegrityGate.blockers).toEqual(expect.arrayContaining(["hosted_100_name_cp_second_batch_audit_not_yet_observed", "source_provenance_rows_do_not_count_as_findings", "stale_alias_generic_graph_restricted_rows_must_be_zero"]));
    expect(dashboard.paidReleaseTruthBoard.hostedPaidReadinessProof.paidRowIntegrityGate.noLeakProof).toMatchObject({ rawEvidenceExposed: false, unsafeUrlsExposed: false, restrictedPayloadsExposed: false, objectKeysExposed: false, privateMaterialExposed: false, actorInteractionContentExposed: false });
    expect(dashboard.paidReleaseTruthBoard.hostedPaidReadinessProof.hostedProofImportPath.commandExamples.join(" ")).toContain("TI_APIFY_OBSERVED_PROOF_PATH");
    expect(dashboard.paidReleaseTruthBoard.hostedPaidReadinessProof.manualVerificationSteps.join(" ")).toContain("100-name");
    expect(dashboard.paidReleaseTruthBoard.hostedPaidReadinessProof.manualVerificationSteps.join(" ")).toContain("secondBatchAudit");
    expect(dashboard.paidReleaseTruthBoard.programDcReleaseGates).toMatchObject({
      schemaVersion: "ti.program_dc_paid_release_gates.v1",
      releaseDecisionBoard: {
        schemaVersion: "ti.program_dd_release_decision_board.v1",
        decision: "hold_paid_release",
        localProgressIsNotHostedRevenue: true,
        dirtyWorktreeBlocksPromotion: true
      },
      current500Gate: {
        state: "pass",
        requiredSellableRows: 500,
        observedSellableRows: 1000,
        sellableRowGap: 0,
        requiredTrueFindingShare: 0.55,
        maximumSourceProvenanceShare: 0.4
      },
      current750Gate: {
        state: "pass",
        requiredSellableRows: 750,
        observedSellableRows: 1000,
        sellableRowGap: 0
      },
      current1000LocalSellableGate: {
        state: "pass",
        requiredSellableRows: 1000,
        observedSellableRows: 1000,
        sellableRowGap: 0,
        countsProjectedRowsAsPaid: false
      },
      current1000Gate: {
        state: "pass",
        requiredUsefulRows: 1000,
        requiredSellableRows: 300,
        countsProjectedRowsAsPaid: false
      },
      hostedProofExecutionGate: {
        state: "hold",
        observedOnly: true,
        observedProofImportState: "missing"
      },
      marketplacePaidTrafficGate: {
        state: "hold",
        paidTrafficAllowedNow: false,
        noInventedExternalMetrics: true
      },
      nonMonetizingWorkGuard: {
        state: "pass",
        architectureOnlyCountsTowardRevenue: false,
        requiresBuyerVisibleMetricMovement: true
      }
    });
    expect(dashboard.paidReleaseTruthBoard.programDcReleaseGates.revenueImpactBlockerBoard).toEqual(expect.arrayContaining([
      expect.objectContaining({ rank: 1, blocker: "hosted_proof_gap", owner: "agent_09" }),
      expect.objectContaining({ blocker: "parser_current_750_gap", owner: "agent_03", observedGap: 0, state: "pass" }),
      expect.objectContaining({ blocker: "useful_row_density_gap", owner: "agent_10", observedGap: 0, state: "pass" })
    ]));
    expect(dashboard.paidReleaseTruthBoard.programDeReleaseBoard).toMatchObject({
      schemaVersion: "ti.program_de_paid_beta_release_truth.v1",
      decision: "hold_paid_release",
      privatePaidBetaAllowedNow: false,
      publicPaidTrafficAllowedNow: false,
      localProgressIsNotHostedRevenue: true,
      privatePaidBetaGate: {
        state: "hold",
        observed: {
          current750State: "pass",
          current750Gap: 0,
          current1000UsefulState: "pass",
          current1000UsefulGap: 0,
          pricingState: "external_unknown",
          payoutState: "external_unknown",
          analyticsObserved: false
        }
      },
      publicPaidTrafficGate: {
        state: "hold",
        observed: {
          current1000LocalSellableState: "pass",
          current1000SellableGap: 0,
          marketplacePaidTrafficState: "hold"
        }
      },
      antiBloatGuard: {
        coordinationOnlyCountsTowardRelease: false,
        dtoOnlyCountsTowardRelease: false,
        stixTaxiiOnlyCountsTowardRelease: false,
        syntheticIndexRowsCountTowardRelease: false,
        requiresBuyerVisibleRowsOrObservedHostedRevenueProof: true
      }
    });
    expect((dashboard.paidReleaseTruthBoard.programDeReleaseBoard as { privatePaidBetaGate: { blockers: string[] }; publicPaidTrafficGate: { blockers: string[] }; topRevenueActions: Array<Record<string, unknown>> }).privatePaidBetaGate.blockers).toEqual(expect.arrayContaining(["hosted100_observed_proof", "pricing_state_external_unknown", "payout_state_external_unknown", "analytics_external_unknown", "cost_per_useful_row_unobserved"]));
    expect((dashboard.paidReleaseTruthBoard.programDeReleaseBoard as { privatePaidBetaGate: { blockers: string[] }; publicPaidTrafficGate: { blockers: string[] }; topRevenueActions: Array<Record<string, unknown>> }).publicPaidTrafficGate.blockers).toEqual(expect.arrayContaining(["private_paid_beta_not_ready", "hosted300_observed_proof", "marketplace_paid_traffic_gate", "paid_runs_unobserved", "refunds_unobserved"]));
    expect((dashboard.paidReleaseTruthBoard.programDeReleaseBoard as { topRevenueActions: Array<Record<string, unknown>> }).topRevenueActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ rank: 1, owner: "agent_09", action: "import_hosted_100_and_300_observed_proof" }),
      expect.objectContaining({ rank: 3, owner: "agent_10", action: "observe_current1000_useful_density_and_cost", expectedRowLift: 0, state: "pass" }),
      expect.objectContaining({ rank: 4, owner: "agent_09", action: "import_pricing_payout_and_analytics" })
    ]));
    expect(dashboard.paidReleaseTruthBoard.exclusionProof.map((row) => row.class)).toEqual(expect.arrayContaining(["synthetic_rows", "graph_only_rows", "restricted_only_metadata", "caveated_rows", "stale_rows", "generic_source_pages", "projected_rows"]));
    expect(dashboard.paidReleaseTruthBoard.exclusionProof.every((row) => row.countsTowardPaidFloor === false)).toBe(true);
    expect(dashboard.scaleStepGates).toMatchObject({
      schemaVersion: "ti.product_scale_step_gates.v1",
      baselineRunId: "OThlfd0uzSCNnedAO",
      baselineDatasetId: "LSen2fYtwFTtOr7vK",
      heldStepCount: 6,
      nextAllowedStep: null
    });
    expect(dashboard.scaleStepGates.gates.map((gate) => gate.id)).toEqual([
      "buyable_rows_100",
      "buyable_rows_1000",
      "buyable_rows_4000",
      "buyable_rows_10000",
      "buyable_rows_20000",
      "buyable_rows_60000"
    ]);
    expect(dashboard.scaleStepGates.gates.find((gate) => gate.id === "buyable_rows_100")).toMatchObject({
      state: "hold",
      targetBuyableRows: 100,
      observedBuyableRows: 16,
      buyerValueThreshold: 0.55,
      observedBuyerValue: 0.6,
      requirements: {
        usefulRowRateAtLeast: 0.4,
        freshRowRateAtLeast: 0.55,
        corroborationOrSourceFamilyDiversityAtLeast: 2,
        staleDuplicateGenericRejectionRequired: true,
        costPerUsefulRowUsdAtMost: 0.01,
        noLeakProofRequired: true
      },
      tierTruth: {
        currentCount: 98,
        eligibleCount: 16,
        rejectedCount: 82,
        payworthyDensity: 0.163,
        freshness: 0.653,
        noLeakProof: "pass",
        nextRequiredAction: expect.stringContaining("do not count caveat-only")
      }
    });
    expect(dashboard.scaleStepGates.gates.find((gate) => gate.id === "buyable_rows_100")?.blockerCodes).toEqual(expect.arrayContaining([
      "buyable_rows_100_row_count_below_target",
      "buyable_rows_100_source_family_diversity_unproven"
    ]));
    expect(dashboard.scaleStepGates.gates.find((gate) => gate.id === "buyable_rows_4000")).toMatchObject({
      state: "hold",
      targetBuyableRows: 4000,
      buyerValueThreshold: 0.68,
      observedBuyerValue: 0.41,
      tierTruth: {
        currentCount: 100,
        eligibleCount: 2,
        rejectedCount: 98,
        payworthyDensity: 0.02,
        noLeakProof: "pass"
      }
    });
    expect(dashboard.revenueBlockerBoard.blockers.map((item) => item.blocker)).toEqual([
      "sellable_rows_below_100",
      "source_family_diversity",
      "thin_apt42_public_channel_coverage",
      "stale_apt29_evidence",
      "held_caveated_row_count",
      "dark_metadata_usefulness",
      "apify_store_conversion",
      "payout_readiness_gaps"
    ]);
    expect(dashboard.revenueBlockerBoard.blockers.map((item) => item.monetizationImpactRank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(dashboard.revenueBlockerBoard.blockers[0]).toMatchObject({
      blocker: "sellable_rows_below_100",
      monetizationImpactRank: 1,
      impactCategory: "missing_real_rows",
      secondaryImpactCategories: expect.arrayContaining(["cost_risk"]),
      blockedSellableRowsEstimate: 84,
      buyerMetricTarget: expect.stringContaining(">=100 sellable rows")
    });
    expect(dashboard.revenueBlockerBoard.blockers[1]).toMatchObject({
      blocker: "source_family_diversity",
      impactCategory: "parser_field_gaps",
      blockedSellableRowsEstimate: 58
    });
    expect(dashboard.revenueBlockerBoard.blockers[0].nextActions).toEqual(expect.arrayContaining([
      expect.stringContaining("Agent 01:"),
      expect.stringContaining("Agent 03:"),
      expect.stringContaining("Agent 04:"),
      expect.stringContaining("Agent 05:"),
      expect.stringContaining("Agent 07:"),
      expect.stringContaining("Agent 08:"),
      expect.stringContaining("Agent 09:")
    ]));
    expect(dashboard.first100AdmissionQuality).toMatchObject({
      schemaVersion: "ti.program_cn_first_100_paid_row_admission_quality.v1",
      productionSellableFloor: 100,
      metrics: {
        rowsAdmittedToProductionFloor: 16,
        rowCountInflationBlocked: 84
      }
    });
    expect(dashboard.first100AdmissionQuality.nonSellableExclusionProof).toEqual(expect.arrayContaining([
      expect.objectContaining({ class: "graph_only", countsAsSellable: false }),
      expect.objectContaining({ class: "synthetic_proof_only", countsAsSellable: false }),
      expect.objectContaining({ class: "stale_duplicate", countsAsSellable: false }),
      expect.objectContaining({ class: "restricted_only", countsAsSellable: false }),
      expect.objectContaining({ class: "caveated_useful", countsAsSellable: false }),
      expect.objectContaining({ class: "generic_market_source_page", countsAsSellable: false }),
      expect.objectContaining({ class: "low_buyer_value", countsAsSellable: false }),
      expect.objectContaining({ class: "alias_or_wrong_actor", countsAsSellable: false })
    ]));
    expect(dashboard.first100AdmissionQuality.sampleRows.filter((row) => row.rowClass !== "accepted_sellable").every((row) => row.countsTowardProductionSellableRows === false)).toBe(true);
    expect(dashboard.buyerVisibleQualityLiftGate).toMatchObject({
      schemaVersion: "ti.live_product_buyer_visible_quality_lift_gate.v1",
      baselineRunId: "iMQGeezZ8bx7WtlhQ",
      baselineDatasetId: "5PLmkE30luBA5Lbgc",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts"]),
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      qualityLiftAcceptedCount: 5,
      qualityLiftRejectedCount: 5,
      sellableRowsAdded: 2,
      freshRowsAdded: 5,
      usefulRowsAdded: 5,
      staleRowsSuppressed: 3,
      costPerUsefulRowDelta: -0.0018,
      projectedRowRevenueDeltaUsd: 0.015,
      passCriteria: {
        acceptedRequiresDecisionLift: true,
        acceptedRequiresBuyerVisibleMetricLift: true,
        rejectedRepairsDoNotCountTowardPayworthyRate: true
      }
    });
    expect(dashboard.buyerVisibleQualityLiftGate.acceptedExamples.some((row) => row.owner === "agent_03" && row.afterDecision === "sellable")).toBe(true);
    expect(dashboard.buyerVisibleQualityLiftGate.rejectedExamples.every((row) => row.doesNotCountTowardPayworthyRate)).toBe(true);
    expect(dashboard.buyerVisibleQualityLiftGate.ownerHandoffs.some((row) => row.owner === "agent_03" && row.accepted === 2)).toBe(true);
    expect(dashboard.parserCaptureLiftGate).toMatchObject({
      schemaVersion: "ti.live_product_parser_capture_lift_gate.v1",
      owner: "agent_03",
      baselineRunId: "OThlfd0uzSCNnedAO",
      baselineDatasetId: "LSen2fYtwFTtOr7vK",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "Apify OUTPUT", "/v1/sources/atlas", "/v1/evidence/cutover-report"]),
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      measurableLift: {
        rowsLifted: 5,
        sellableRowsAdded: 2,
        usefulRowsAdded: 5,
        freshRowsAdded: 5,
        estimatedAverageBuyerValueDelta: 0.042,
        sourceFamiliesImproved: expect.arrayContaining(["rss_security_blog", "vendor_report", "cert_advisory", "github_security_advisory", "public_channel_handoff"]),
        blockerCodesRemoved: expect.arrayContaining(["generic_summary", "missing_reported_time", "missing_corroboration", "missing_ttp_tool", "thin_apt42_public_channel_coverage"])
      },
      noLeakBoundary: {
        rawUrlExposed: false,
        rawBodyExposed: false,
        secretPayloadMaterialExposed: false,
        privateAuthCaptchaRequired: false,
        restrictedRawMaterialExposed: false
      }
    });
    expect(dashboard.parserCaptureLiftGate.acceptedExamples).toHaveLength(5);
    expect(dashboard.parserCaptureLiftGate.acceptedExamples.some((row) => row.afterDecision === "sellable" && row.buyerVisibleFieldsAdded.includes("corroborating_source_ids"))).toBe(true);
    expect(dashboard.parserCaptureLiftGate.rejectedExamples.map((row) => row.rejectedReason)).toEqual(expect.arrayContaining([
      "stale_report",
      "single_source_low_context",
      "duplicate_syndication",
      "unsafe_or_restricted_capture",
      "auth_captcha_private_source",
      "raw_url_or_body_leak",
      "credential_or_payload_material"
    ]));
    expect(dashboard.parserCaptureLiftGate.rejectedExamples.every((row) => row.doesNotCountTowardPayworthyRate && row.noLeak && row.sellableRowsDelta === 0 && row.usefulRowsDelta === 0)).toBe(true);
    expect(dashboard.marketplaceGraphSignals).toMatchObject({
      schemaVersion: "ti.marketplace_graph_signals_gate.v1",
      baselineRunId: "OThlfd0uzSCNnedAO",
      baselineDatasetId: "LSen2fYtwFTtOr7vK",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows"]),
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      improvedRows: 8,
      rejectedRows: 6,
      expectedBuyerVisibleLift: expect.arrayContaining(["row_trust", "next_search_utility", "sample_quality"])
    });
    expect(dashboard.marketplaceGraphSignals.examples).toHaveLength(8);
    expect(dashboard.marketplaceGraphSignals.examples.some((row) => row.actor === "APT42" && row.rowSignal === "needs_corroboration")).toBe(true);
    expect(dashboard.marketplaceGraphSignals.examples.some((row) => row.family === "ransomware" && row.noLeak === true)).toBe(true);
    expect(dashboard.marketplaceGraphSignals.rejectedGraphInflation.map((row) => row.blockedReason)).toEqual(expect.arrayContaining([
      "stale_graph_fact",
      "single_source_edge",
      "unrelated_actor_link",
      "restricted_only_context",
      "missing_ledger_proof",
      "no_fresh_change"
    ]));
    expect(dashboard.marketplaceGraphSignals.sourceParserHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05"]));
    expect(dashboard.graphPivotLiftGate).toMatchObject({
      schemaVersion: "ti.apify_graph_pivot_lift_gate.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows"]),
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
      rejectedBloatReasons: expect.arrayContaining(["generic_pivot", "stale_pivot", "contradicted_pivot", "unrelated_actor_pivot", "restricted_only_pivot", "missing_ledger_pivot", "single_source_without_caveat"])
    });
    expect(dashboard.graphPivotLiftGate.ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05", "agent_07", "agent_09", "agent_10"]));
    expect(dashboard.relationshipConfidenceGate).toMatchObject({
      schemaVersion: "ti.apify_relationship_confidence_gate.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows"]),
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
      rejectedUnsupportedReasons: expect.arrayContaining(["generic_pivot", "stale_pivot", "contradicted_pivot", "unrelated_actor_pivot", "restricted_only_pivot", "missing_ledger_pivot", "single_source_without_caveat", "no_action_pivot"])
    });
    expect(dashboard.relationshipConfidenceGate.ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05", "agent_07", "agent_09", "agent_10"]));
    expect(dashboard.paidGraphSearchPackGate).toMatchObject({
      schemaVersion: "ti.apify_paid_graph_search_pack_gate.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows", "/v1/intel/search", "/v1/contracts"]),
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
      rejectionReasons: expect.arrayContaining(["stale_only_evidence", "generic_relationship", "missing_provenance", "no_buyer_action", "unsafe_raw_content", "unsupported_alias_expansion", "single_source_without_caveat", "unrelated_pivot"])
    });
    expect(dashboard.paidGraphSearchPackGate.ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05", "agent_07", "agent_09", "agent_10"]));
    expect(dashboard.hundredSellableRowGraphPivotPlan).toMatchObject({
      schemaVersion: "ti.apify_100_sellable_row_graph_pivot_plan.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows", "/v1/contracts"]),
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
      rejectionReasons: expect.arrayContaining(["stale_only", "single_source_without_caveat", "contradicted", "unrelated", "missing_provenance", "unsafe_restricted_only", "alias_only", "not_actionable"])
    });
    expect(dashboard.hundredSellableRowGraphPivotPlan.repairHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05", "agent_07", "agent_10"]));
    expect(dashboard.graphSellableSupportPacket).toMatchObject({
      schemaVersion: "ti.program_ci_graph_sellable_support_packet.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows", "/v1/contracts"]),
      baselineRunId: "OThlfd0uzSCNnedAO",
      baselineDatasetId: "LSen2fYtwFTtOr7vK",
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      productionSellableFloor: 100,
      supportExampleCount: 20,
      graphOnlyRowsExcludedFromFloor: 20,
      graphSupportedRepairCandidates: 19,
      projectedSellableRowsUnlockedAfterNonGraphRepairs: 38,
      nextBuyerSearchCount: 20,
      averageAnalystConfidenceDelta: 0.094
    });
    expect(dashboard.graphSellableSupportPacket.examples.map((row) => row.actor)).toEqual(expect.arrayContaining(["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin", "BlackCat", "BianLian", "Medusa", "FIN7", "MuddyWater"]));
    expect(dashboard.graphSellableSupportPacket.examples.every((row) => row.relationshipSupport.length > 0 && row.caveat.length > 0 && row.nextBuyerSearch.length > 0 && row.countsTowardProductionSellableRows === false && row.noLeak)).toBe(true);
    expect(dashboard.graphSellableSupportPacket.ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_09", "agent_10"]));
    expect(dashboard.graphSellableSupportPacket.noLeakBoundary).toMatchObject({ rawEvidenceBodies: false, unsafeUrls: false, objectKeys: false, credentials: false, payloadLinks: false, privateMaterial: false, actorInteraction: false });
    expect(dashboard.releaseDecision.acceptedRepairBuckets.find((bucket) => bucket.source === "graphPublicCorroborationPivotPacket")).toBeUndefined();
    expect(dashboard.graphPublicCorroborationPivotPacket).toMatchObject({
      schemaVersion: "ti.program_cs_graph_public_corroboration_pivot_packet.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows", "/v1/intel/search", "/v1/contracts"]),
      baselineRunId: "OThlfd0uzSCNnedAO",
      baselineDatasetId: "LSen2fYtwFTtOr7vK",
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      productionSellableFloor: 100,
      candidateCount: 30,
      rowUnlockingCandidateCount: 24,
      contradictionOrAliasHoldCount: 6,
      graphOnlyRowsExcludedFromFloor: 30,
      projectedSellableRowsAfterPublicCorroboration: 42,
      publicProofMetrics: {
        pivotsTested: 24,
        publicProofFound: 14,
        rowsUnlockedForParserAdmission: 25,
        rowsRejectedAsStaleOrAmbiguous: 4,
        contradictionsFound: 2,
        queuedForNextPublicSearch: 6,
        projectedBuyerValueLift: 1.17,
        countsTowardPaidFloorNow: false
      }
    });
    expect(dashboard.graphPublicCorroborationPivotPacket.candidates.map((row) => row.actor)).toEqual(expect.arrayContaining(["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Qilin", "Sandworm", "NOBELIUM", "Carbanak", "Conti", "8Base"]));
    expect(dashboard.graphPublicCorroborationPivotPacket.candidates.every((row) =>
      row.rank > 0 &&
      row.aliases.length > 0 &&
      row.candidateVictimOrTarget.length > 0 &&
      row.expectedBuyerFieldLift.length > 0 &&
      row.relationshipSupport.length > 0 &&
      row.proofUrlHash.length > 0 &&
      row.sourceType.length > 0 &&
      row.candidateFields.actor === row.actor &&
      row.candidateFields.victimOrTarget.length > 0 &&
      row.contradictionStatus.length > 0 &&
      row.parserHandoffReason.length > 0 &&
      row.worthPayingForReason.length > 0 &&
      row.nextPublicCorroborationPivot.queryText.length > 0 &&
      row.nextPublicCorroborationPivot.expectedSourceFamily.length > 0 &&
      row.nextPublicCorroborationPivot.repairsRowField.length > 0 &&
      row.graphOnlyCountsTowardSellableRows === false &&
      row.rowUnlockRequiresNonGraphEvidence === true &&
      row.noLeak
    )).toBe(true);
    expect(dashboard.graphPublicCorroborationPivotPacket.candidates.filter((row) => row.publicProofState === "public_proof_found").reduce((sum, row) => sum + row.measuredRowsUnlockedForParserAdmission, 0)).toBe(25);
    expect(dashboard.graphPublicCorroborationPivotPacket.candidates.filter((row) => row.publicProofState === "public_proof_found").every((row) => row.countsTowardProductionSellableRowsAfterParserAdmission === true)).toBe(true);
    expect(dashboard.graphPublicCorroborationPivotPacket.candidates.filter((row) => row.publicProofState === "queued_for_search").every((row) => row.measuredRowsUnlockedForParserAdmission === 0)).toBe(true);
    expect(dashboard.graphPublicCorroborationPivotPacket.candidates.filter((row) => row.currentBlockedState === "contradiction_hold" || row.currentBlockedState === "alias_collision_hold").every((row) =>
      row.expectedSellableRowsUnlockedAfterPublicProof === 0 &&
      ["medium", "high"].includes(row.nextPublicCorroborationPivot.contradictionRisk) &&
      ["medium", "high"].includes(row.nextPublicCorroborationPivot.aliasCollisionRisk)
    )).toBe(true);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.counts).toEqual({ admitted_by_parser: 0, ready_for_parser: 1000, ready_for_current_admission: 1000, ready_for_parser_admission: 14, needs_public_source: 6, contradicted: 6, contradicted_or_alias_hold: 6, stale: 4, stale_recheck: 4, unsafe_or_restricted: 0, rowsCountTowardFloorNow: 0, rowsReadyAfterParserAdmission: 25 });
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff).toHaveLength(1000);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.ready_for_current_admission).toHaveLength(1000);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff.every((row) =>
      row.actor.length > 0 &&
      row.victimOrTarget.length > 0 &&
      row.sourceFamily.length > 0 &&
      row.freshnessAgeDays >= 0 &&
      row.contradictionState.length > 0 &&
      row.provenanceHash.length > 0 &&
      row.buyerReason.length > 0 &&
      row.expectedPaidRowLiftAfterParserAdmission > 0 &&
      row.programDbPriority.gapContribution > 0 &&
      row.programDbPriority.admissionBlocker === "none" &&
      row.programDcPriority.gapContribution > 0 &&
      row.programDcPriority.admissionBlocker === "none" &&
      row.programDcPriority.sourceFamilyDiversityLift > 0 &&
      row.programDcPriority.corroborationStrength.length > 0 &&
      row.programDcPriority.freshnessRisk.length > 0 &&
      row.programDdPriority.gapContribution > 0 &&
      row.programDdPriority.admissionBlocker === "none" &&
      row.programDdPriority.sourceFamilyDiversityLift > 0 &&
      row.programDdPriority.corroborationStrength.length > 0 &&
      row.programDdPriority.contradictionRisk.length > 0 &&
      row.programDdPriority.freshnessRisk.length > 0 &&
      row.programDdPriority.buyerVisibleValue.length > 0 &&
      row.programDdPriority.noLeakProof === "hash_only_public_or_metadata_reference" &&
      row.programDdPriority.nextPivot.length > 0 &&
      row.programDePriority.confidenceLift >= 0 &&
      row.programDePriority.freshnessLift >= 0 &&
      row.programDePriority.sourceFamilyLift >= 0 &&
      row.programDePriority.contradictionRisk.length > 0 &&
      row.programDePriority.sourceProvenanceOnlyRisk.length > 0 &&
      row.programDePriority.buyerVisibleNextPivot.length > 0 &&
      row.programDePriority.gateContribution.length > 0 &&
      row.programDePriority.noLeakProof === "hash_only_public_or_metadata_reference" &&
      row.programDePriority.admissionBlocker.length > 0 &&
      row.programFgPriority.whyCorroborationMatters.length > 0 &&
      row.programFgPriority.buyerActionEnabled.length > 0 &&
      row.programFgPriority.confidenceDelta > 0 &&
      row.programFgPriority.freshnessDelta > 0 &&
      row.programFgPriority.sourceFamilyDelta > 0 &&
      row.programFgPriority.contradictionRisk.length > 0 &&
      row.programFgPriority.parserAdmissionReason.length > 0 &&
      row.programFgPriority.nextParserSlice.length > 0 &&
      row.programFgPriority.noLeakProof === "hash_only_public_or_metadata_reference" &&
      row.programFgPriority.admissionBlocker === "none" &&
      row.admissionState === "ready_for_parser" &&
      row.countsTowardFloorNow === false &&
      row.noLeak
    )).toBe(true);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff.filter((row) => row.programDdPriority.findingLikely).length).toBeGreaterThanOrEqual(350);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff.filter((row) => row.programDePriority.admissionBlocker === "none" && row.programDePriority.expectedCurrentRowLift > 0).length).toBeGreaterThanOrEqual(150);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff.filter((row) => row.programDePriority.gateContribution === "current750").length).toBeGreaterThanOrEqual(150);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff.filter((row) => row.programFgPriority.nextParserSlice === "current1000_alias_victim_ttp").length).toBeGreaterThanOrEqual(100);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff.filter((row) => row.programFgPriority.nextParserSlice === "current1000_source_family_freshness").length).toBeGreaterThanOrEqual(150);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff.filter((row) => row.programFgPriority.nextParserSlice === "current1000_metadata_public_support").length).toBeGreaterThanOrEqual(50);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.programDbRejectionBuckets).toMatchObject({ stale: 4, alias_conflict: 4, contradiction: 2, duplicate: 0, generic_source_page: 0, restricted_only: 0, not_enough_source_support: 6, rowsCountTowardFloorNow: 0, noLeak: true });
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.programDcRejectionBuckets).toMatchObject({ stale: 4, alias_conflict: 4, contradiction: 2, duplicate: 0, generic_source_page: 0, restricted_only: 0, not_enough_source_support: 6, missing_buyer_action: 0, weak_source_family_diversity: 0, rowsCountTowardFloorNow: 0, noLeak: true });
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.programDdRejectionBuckets).toMatchObject({ stale: 4, alias_conflict: 4, contradiction: 2, duplicate: 0, generic_source_page: 0, restricted_only: 0, not_enough_source_support: 6, missing_buyer_action: 0, weak_source_family_diversity: 0, graph_only_speculation: 0, rowsCountTowardFloorNow: 0, noLeak: true });
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.programDeRejectionBuckets).toMatchObject({ stale: 4, alias_conflict: 4, contradiction: 2, duplicate: 0, generic_source_page: 0, restricted_only: 0, not_enough_source_support: 6, missing_buyer_action: 0, weak_source_family_diversity: 0, graph_only_speculation: 0, unsupported_relationship_padding: 0, rowsCountTowardFloorNow: 0, noLeak: true });
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.ready_for_parser_admission.reduce((sum, row) => sum + row.expectedRowsUnlockedAfterParserAdmission, 0)).toBe(25);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.ready_for_parser_admission.every((row) => row.countsTowardFloorNow === false && row.proofUrlHash.length > 0 && row.noLeak)).toBe(true);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.needs_public_source.some((row) => row.sourceClass === "restricted_metadata_public_support")).toBe(true);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.contradicted_or_alias_hold).toHaveLength(6);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.stale_recheck).toHaveLength(4);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.graphOnlyCountsTowardPaidFloorNow).toBe(false);
    expect(dashboard.graphPublicCorroborationPivotPacket.paidRowUnlockQueue.noLeak).toBe(true);
    expect(dashboard.graphPublicCorroborationPivotPacket.integrationHandoffs).toEqual(expect.arrayContaining([
      expect.objectContaining({ owner: "agent_03", expectedRowsUnlockedForAdmission: 9, countsTowardPaidFloorNow: false }),
      expect.objectContaining({ owner: "agent_05", expectedRowsUnlockedForAdmission: 3, countsTowardPaidFloorNow: false })
    ]));
    expect(dashboard.graphPublicCorroborationPivotPacket.ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_09", "agent_10"]));
    expect(dashboard.graphPublicCorroborationPivotPacket.noLeakBoundary).toMatchObject({ rawEvidenceBodies: false, unsafeUrls: false, objectKeys: false, credentials: false, payloadLinks: false, privateMaterial: false, actorInteraction: false });
    expect(dashboard.parserToSellableRepairPacket).toMatchObject({
      schemaVersion: "ti.live_product_parser_to_100_sellable_rows_packet.v1",
      owner: "agent_03",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows", "/v1/contracts"]),
      baselineRunId: "OThlfd0uzSCNnedAO",
      baselineDatasetId: "LSen2fYtwFTtOr7vK",
      targetSellableRows: 100,
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      productionSellableClaimed: false,
      candidateDecision: "sellable_candidate_after_parser_repair",
      candidateActorCount: 12,
      projectedCandidateRows: 87,
      projectedUsefulRows: 87,
      projectedFreshRows: 79,
      projectedSellableFloorProgress: 0.87,
      parserFieldsUnlocking: expect.arrayContaining(["victim", "sector", "country", "dataset_or_impact", "ttp_tool", "first_seen", "last_seen", "confidence", "source_family_support", "provenance_hash", "next_buyer_search"]),
      sourceFamilyGaps: expect.arrayContaining(["public_report", "government_advisory", "vendor_report"]),
      graphPivotGaps: expect.arrayContaining(["claim:victim", "sector:healthcare", "ttp:T1078"]),
      suppressionChecks: expect.arrayContaining(["stale_only", "single_source_without_caveat", "contradicted", "unrelated", "unsafe_restricted_only"])
    });
    expect(dashboard.parserToSellableRepairPacket.candidates.every((row) =>
      row.dryRunDecision === "sellable_candidate_after_parser_repair" &&
      row.requiresSourceCorroboration &&
      row.provenanceHash.length > 0 &&
      row.nextBuyerSearches.length === 3 &&
      row.noLeak
    )).toBe(true);
    expect(dashboard.parserToSellableRepairPacket.rejectedRepairs.map((row) => row.blockedReason)).toEqual(expect.arrayContaining([
      "stale_report",
      "alias_collision",
      "unrelated_actor_co_mention",
      "generic_marketing_page",
      "raw_body_or_unsafe_url_request",
      "payload_request",
      "private_auth_captcha_dependency"
    ]));
    expect(dashboard.parserToSellableRepairPacket.rejectedRepairs.every((row) => row.projectedRows === 0 && row.doesNotCountToward100Floor && row.noLeak)).toBe(true);
    expect(dashboard.parserToSellableRepairPacket.ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_10"]));
    expect(dashboard.parserToSellableRepairPacket.noLeakBoundary).toMatchObject({
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      payloadsRequested: false,
      privateAuthCaptchaAccess: false,
      restrictedMaterialExposed: false,
      productionSellableClaimed: false
    });
    expect(dashboard.parserRealSellableLift).toMatchObject({
      schemaVersion: "ti.program_cj_parser_real_sellable_lift.v1",
      owner: "agent_03",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows", "/v1/intel/search", "/v1/contracts"]),
      baselineRunId: "OThlfd0uzSCNnedAO",
      baselineDatasetId: "LSen2fYtwFTtOr7vK",
      dryRun: false,
      willMutateSources: false,
      willStartCollection: false,
      productionSellableClaimed: false,
      repairedRowCount: 15,
      promotedSellableRows: 20,
      movedToUsefulCaveatedRows: 9,
      staleRowsSuppressed: 2,
      aliasOrUnrelatedRowsSuppressed: 2,
      rowsStillOneRepairAway: 54,
      parserFieldsRequired: expect.arrayContaining(["actor", "victim", "sector", "country", "dataset_or_impact", "ttp_tool", "first_seen", "last_seen", "source_family_support", "confidence", "caveat", "contradiction_state", "provenance_hash", "next_buyer_search"])
    });
    expect(dashboard.parserRealSellableLift.repairedRows.map((row) => row.actor)).toEqual(expect.arrayContaining([
      "APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin"
    ]));
    expect(dashboard.parserRealSellableLift.repairedRows.every((row) =>
      row.provenanceHash.length > 0 &&
      row.replayRef.startsWith("replay:") &&
      row.nextBuyerSearch.length > 0 &&
      row.sourceFamilySupport.length > 0 &&
      row.graphPivots.length >= 5 &&
      row.noLeak
    )).toBe(true);
    expect(dashboard.parserRealSellableLift.rejectionRows.map((row) => row.blockedReason)).toEqual(expect.arrayContaining([
      "stale_report",
      "alias_collision",
      "unrelated_actor_co_mention",
      "generic_marketing_page",
      "unsafe_source_request"
    ]));
    expect(dashboard.parserRealSellableLift.rejectionRows.every((row) => row.countsTowardSellableLift === false && row.noLeak)).toBe(true);
    expect(dashboard.parserRealSellableLift.ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_04", "agent_05", "agent_07", "agent_08", "agent_10"]));
    expect(dashboard.parserRealSellableLift.noLeakBoundary).toMatchObject({
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      objectKeysExposed: false,
      credentialsExposed: false,
      payloadsRequested: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false,
      productionSellableClaimed: false
    });
    expect(dashboard.parserRealSellableLift.liveSourceAdmissionPacket.schemaVersion).toBe("ti.program_co_live_source_parser_admission.v1");
    expect(dashboard.parserRealSellableLift.liveSourceAdmissionPacket.candidateRowCount).toBe(40);
    expect(dashboard.parserRealSellableLift.liveSourceAdmissionPacket.movedToSellableRows).toBe(36);
    expect(dashboard.parserRealSellableLift.liveSourceAdmissionPacket.usefulCaveatedRows).toBe(8);
    expect(dashboard.parserRealSellableLift.liveSourceAdmissionPacket.suppressedRows).toBe(10);
    expect(dashboard.parserRealSellableLift.liveSourceAdmissionPacket.rowsStillOneRepairAway).toBe(18);
    expect(dashboard.parserRealSellableLift.liveSourceAdmissionPacket.estimatedProgressToward100).toMatchObject({
      observedCurrentSellableRows: 16,
      newSellableRows: 36,
      projectedSellableRowsAfterAdmission: 52,
      remainingRowsTo100: 48,
      progressRatio: 0.52,
      countsAsProductionClaim: false
    });
    expect(dashboard.parserRealSellableLift.liveSourceAdmissionPacket.candidateRows.map((row) => row.actor)).toEqual(expect.arrayContaining([
      "APT29", "APT28", "APT42", "Volt Typhoon", "Lazarus Group", "Turla", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin"
    ]));
    expect(dashboard.parserRealSellableLift.liveSourceAdmissionPacket.candidateRows.every((row) =>
      row.victimOrTarget.length > 0 &&
      row.sector.length > 0 &&
      row.countryOrRegion.length > 0 &&
      row.datasetOrImpact.length > 0 &&
      row.ttpToolOrCve.length > 0 &&
      row.firstSeen.length > 0 &&
      row.lastSeen.length > 0 &&
      row.sourceFamily.length > 0 &&
      row.confidence > 0 &&
      row.provenanceHash.length > 0 &&
      row.nextBuyerSearch.length > 0 &&
      Object.values(row.noLeakProof).every((value) => value === false)
    )).toBe(true);
    expect(dashboard.parserRealSellableLift.liveSourceAdmissionPacket.candidateRows.filter((row) => row.admissionDecision === "sellable")).toHaveLength(30);
    expect(dashboard.parserRealSellableLift.liveSourceAdmissionPacket.candidateRows.filter((row) => row.admissionDecision === "useful_caveated")).toHaveLength(6);
    expect(dashboard.parserRealSellableLift.liveSourceAdmissionPacket.candidateRows.filter((row) => row.admissionDecision === "suppress")).toHaveLength(4);
    expect(dashboard.parserRealSellableLift.liveSourceAdmissionPacket.suppressedClasses.map((row) => row.class)).toEqual(expect.arrayContaining(["generic_actor_summary", "stale_repost_as_current", "alias_collision", "restricted_only_without_public_support"]));
    expect(dashboard.parserRealSellableLift.runtimeAdmissionReplay).toMatchObject({
      schemaVersion: "ti.program_cv_parser_runtime_admission_replay.v1",
      owner: "agent_03",
      baselineRunId: "OThlfd0uzSCNnedAO",
      baselineDatasetId: "LSen2fYtwFTtOr7vK",
      proofFixture: "apify/public-threat-actor-monitor/fixtures/apt42.json",
      beforeSellableRows: 3,
      afterSellableRows: 4,
      chargeableRowsAdded: 1,
      beforeAverageBuyerValueScore: 0.558,
      afterAverageBuyerValueScore: 0.575
    });
    const runtimeActivity = dashboard.parserRealSellableLift.runtimeAdmissionReplay.runtimeProofRows.find((row) => row.id === "cv_apt42_campaign_runtime_admission");
    expect(runtimeActivity).toMatchObject({
      actor: "APT42",
      rowType: "activity",
      admissionDecision: "sellable",
      countsTowardCurrentSellableRows: true,
      sourceEvidenceCount: 4,
      ttpToolOrCve: "Phishing / T1566",
      contradictionState: "none",
      noLeak: true
    });
    expect(runtimeActivity?.requiredFieldsPresent).toEqual(expect.arrayContaining(["actor", "victim_or_target", "sector", "country_or_region", "dataset_or_impact", "ttp_tool_or_cve", "source_family_support", "provenance_hash", "next_buyer_search"]));
    expect(runtimeActivity?.missingFields).toHaveLength(0);
    expect(dashboard.parserRealSellableLift.runtimeAdmissionReplay.runtimeProofRows.filter((row) => !row.countsTowardCurrentSellableRows).map((row) => row.blockedReason)).toEqual(expect.arrayContaining(["generic_source_page", "coverage_gap_only", "restricted_only_without_public_support"]));
    expect(dashboard.parserRealSellableLift.runtimeAdmissionReplay.suppressionProof.map((row) => row.class)).toEqual(expect.arrayContaining(["generic_source_page", "coverage_gap_only", "restricted_only_without_public_support", "single_source_without_caveat"]));
    expect(dashboard.parserRealSellableLift.runtimeAdmissionReplay.suppressionProof.every((row) => row.countsTowardCurrentSellableRows === false && row.proof.length > 0)).toBe(true);
    expect(dashboard.parserRealSellableLift.runtimeAdmissionReplay.noLeakBoundary).toMatchObject({
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false
    });
    expect(dashboard.parserRealSellableLift.currentAdmissionLedger).toMatchObject({
      schemaVersion: "ti.program_cw_parser_live_source_current_admission.v1",
      owner: "agent_03",
      baselineCurrentSellableRows: 4,
      rowsAdmittedThisPass: 4,
      currentSellableRowsAfterAdmission: 8,
      usefulRowsAfterAdmission: 12,
      averageBuyerValueBefore: 0.575,
      averageBuyerValueAfter: 0.638,
      buyerValueLift: 0.063
    });
    expect(dashboard.parserRealSellableLift.currentAdmissionLedger.admittedRows).toHaveLength(4);
    expect(dashboard.parserRealSellableLift.currentAdmissionLedger.admittedRows.every((row) =>
      row.actor === "APT42" &&
      row.rowType === "activity" &&
      row.sourceEvidenceCount >= 4 &&
      row.requiredFieldsPresent.includes("victim_or_target") &&
      row.requiredFieldsPresent.includes("ttp_tool_or_cve") &&
      row.missingFields.length === 0 &&
      row.countsTowardCurrentSellableRows &&
      row.noLeak
    )).toBe(true);
    expect(dashboard.parserRealSellableLift.currentAdmissionLedger.blockedLedger).toMatchObject({
      missingVictimOrTargetRows: 3,
      missingTtpOrToolRows: 3,
      genericSourcePageRows: 4,
      restrictedOnlyRows: 1
    });
    expect(dashboard.parserRealSellableLift.currentAdmissionLedger.falsePositiveSuppressions.map((row) => row.class)).toEqual(expect.arrayContaining(["generic_source_page", "stale_latest_activity", "alias_or_wrong_actor", "restricted_only_without_public_support"]));
    expect(dashboard.parserRealSellableLift.currentAdmissionLedger.falsePositiveSuppressions.every((row) => row.countsTowardCurrentSellableRows === false && row.proof.length > 0)).toBe(true);
    expect(dashboard.parserRealSellableLift.currentAdmissionLedger.noLeakBoundary).toMatchObject({
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger).toMatchObject({
      schemaVersion: "ti.program_cx_100_name_activity_parser_lift.v1",
      owner: "agent_03",
      baseline100NameRows: 607,
      baselineSellableRows: 187,
      baselineSellableSourceProvenanceRows: 135,
      baselineSellableFindingRows: 52,
      currentRows: 16,
      currentSellableRows: 12,
      currentSellableFindingRows: 7,
      currentSellableSourceProvenanceRows: 4,
      currentCaveatedFindingRows: 0,
      activityTargetTtpRowsAdmittedThisPass: 4,
      sourceProvenanceShareOfSellable: 0.333
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.admittedFindingRows.every((row) =>
      row.actor === "APT42" &&
      row.query === "APT42" &&
      ["activity", "target", "ttp"].includes(row.rowType) &&
      row.sourceEvidenceCount >= 4 &&
      row.missingFields.length === 0 &&
      row.noLeak
    )).toBe(true);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.perQueryAdmission).toEqual(expect.arrayContaining([
      expect.objectContaining({
        query: "100-name paid preset",
        admittedFindings: 52,
        sourceProvenanceRows: 135,
        topMissingFields: expect.arrayContaining(["victim_or_target", "ttp_tool_or_cve", "source_family_support"])
      })
    ]));
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.heldFindingRows.every((row) => row.countsTowardSellableFindingFloor === false && row.noLeak)).toBe(true);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.rejectionReasonCounts).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "source_provenance_only", rowCount: 135, countsTowardSellableFindingFloor: false }),
      expect.objectContaining({ reason: "generic_actor_profile", countsTowardSellableFindingFloor: false }),
      expect.objectContaining({ reason: "stale_without_recent_corroboration", countsTowardSellableFindingFloor: false }),
      expect.objectContaining({ reason: "alias_only", countsTowardSellableFindingFloor: false }),
      expect.objectContaining({ reason: "graph_only", countsTowardSellableFindingFloor: false }),
      expect.objectContaining({ reason: "restricted_without_public_support", rowCount: 68, countsTowardSellableFindingFloor: false }),
      expect.objectContaining({ reason: "duplicate_claim", countsTowardSellableFindingFloor: false })
    ]));
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.deterministic100NameProof).toMatchObject({
      proofPreset: "100_name_paid_preset",
      proofRows: 1000,
      sellableRowsPreserved: 187,
      sellableFindingsBaseline: 52,
      sellableSourceProvenanceRows: 135,
      sourceProvenanceRowsCountTowardFindingFloor: false,
      projectedFindingRowsAfterCurrentParserBatch: 80,
      projectedFindingLift: 28
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.tier1000Gate).toMatchObject({
      schemaVersion: "ti.program_cy_1000_row_finding_density_gate.v1",
      minimumRows: 1000,
      minimumSellableRows: 300,
      minimumSellableFindingRate: 0.4,
      maximumSourceProvenanceShareOfSellable: 0.45,
      minimumUsefulDensity: 0.65,
      countsProjectedRowsAsPaid: false
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.tier1000Gate.requiredRejectionReasons).toEqual(expect.arrayContaining([
      "source_provenance_only",
      "generic_actor_profile",
      "stale_without_recent_corroboration",
      "alias_only",
      "graph_only",
      "restricted_without_public_support",
      "duplicate_claim"
    ]));
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.publicSupportCandidateAdmission).toMatchObject({
      schemaVersion: "ti.program_cz_public_support_candidate_admission.v1",
      owner: "agent_03",
      sourcePackets: expect.arrayContaining([
        "darkMetadataPublicSupportLift4000.publicSupportSellable250",
        "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff"
      ]),
      acceptedCount: 63,
      rejectedCount: 116
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.publicSupportCandidateAdmission.acceptedRows).toHaveLength(63);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.publicSupportCandidateAdmission.acceptedRows.every((row) =>
      row.actor.length > 0 &&
      row.victimOrTarget.length > 0 &&
      row.sector.length > 0 &&
      row.country.length > 0 &&
      row.ttpOrTool.length > 0 &&
      row.datasetClaim.length > 0 &&
      row.safePublicSourceId.length > 0 &&
      row.provenanceHash.length > 0 &&
      row.countsTowardSellableRowsNow === false &&
      row.countsAfterParserAdmission === true &&
      row.noLeak
    )).toBe(true);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.publicSupportCandidateAdmission.acceptedRows.filter((row) => row.sourcePacket === "publicSupportSellable250")).toHaveLength(38);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.publicSupportCandidateAdmission.acceptedRows.filter((row) => row.sourcePacket === "graphPublicParserAdmissionHandoff")).toHaveLength(25);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.publicSupportCandidateAdmission.rejectionReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "needs_public_support", countsTowardSellableRows: false }),
      expect.objectContaining({ reason: "stale_public_support", countsTowardSellableRows: false }),
      expect.objectContaining({ reason: "duplicate_claim", countsTowardSellableRows: false }),
      expect.objectContaining({ reason: "unsafe_restricted_only", countsTowardSellableRows: false }),
      expect.objectContaining({ reason: "generic_source_only", countsTowardSellableRows: false }),
      expect.objectContaining({ reason: "contradicted_public_proof", countsTowardSellableRows: false }),
      expect.objectContaining({ reason: "graph_only_without_public_source", countsTowardSellableRows: false })
    ]));
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.publicSupportCandidateAdmission.sourceFamilies).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceFamily: "dark_metadata_public_support" }),
      expect.objectContaining({ sourceFamily: "clear_web_public_report" }),
      expect.objectContaining({ sourceFamily: "government_advisory" }),
      expect.objectContaining({ sourceFamily: "vendor_report" })
    ]));
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.publicSupportCandidateAdmission.projected300RowTierEffect).toMatchObject({
      currentSellableRows: 187,
      acceptedParserAdmissions: 63,
      projectedSellableRowsAfterAdmission: 250,
      targetSellableRows: 300,
      remainingSellableGap: 50,
      currentSellableFindings: 52,
      projectedSellableFindingsAfterAdmission: 115,
      targetSellableFindings: 120,
      remainingFindingGap: 5,
      sellableSourceProvenanceRowsPreserved: 135,
      sourceProvenanceShareAfterAdmission: 0.54,
      maximumSourceProvenanceShare: 0.45,
      nextRequiredFindingAdmissions: 50,
      projectedAtTargetSellableRows: 300,
      projectedAtTargetSellableFindings: 165,
      projectedAtTargetSourceProvenanceShare: 0.45,
      countsProjectedRowsAsPaid: false
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.publicSupportCandidateAdmission.noLeakBoundary).toMatchObject({
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false,
      productionSellableClaimed: false
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellableAdmissionLift).toMatchObject({
      schemaVersion: "ti.program_da_current_sellable_admission_lift.v1",
      owner: "agent_03",
      acceptedCurrentRowsCount: 63,
      sourceProvenanceRowsConvertedToFindings: 23,
      rejectedRowsCount: 235,
      currentSellableRowsAfterAdmission: 250,
      currentSellableFindingsAfterAdmission: 138,
      currentSellableSourceProvenanceRowsAfterAdmission: 112,
      sourceProvenanceShareAfterAdmission: 0.448,
      countsTowardLocalCurrentPaidPreset: true,
      countsTowardHostedPaidProof: false
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellableAdmissionLift.sourcePackets).toEqual(expect.arrayContaining([
      "darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable100",
      "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff",
      "existing_public_source_rows"
    ]));
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellableAdmissionLift.acceptedRows).toHaveLength(63);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellableAdmissionLift.acceptedRows.every((row) =>
      row.actor.length > 0 &&
      row.victimOrTarget.length > 0 &&
      row.sector.length > 0 &&
      row.country.length > 0 &&
      row.ttpOrTool.length > 0 &&
      row.firstSeen.length > 0 &&
      row.lastSeen.length > 0 &&
      row.confidence >= 0.82 &&
      row.provenanceHash.length > 0 &&
      row.buyerReason.length > 0 &&
      row.countsTowardCurrentSellableRows === true &&
      row.countsTowardHostedPaidProof === false &&
      row.noLeak
    )).toBe(true);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellableAdmissionLift.acceptedRows.filter((row) => row.sourcePacket === "agent05_current_chargeable100")).toHaveLength(38);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellableAdmissionLift.acceptedRows.filter((row) => row.sourcePacket === "agent08_parser_handoff")).toHaveLength(17);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellableAdmissionLift.acceptedRows.filter((row) => row.sourcePacket === "existing_public_source_row")).toHaveLength(8);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellableAdmissionLift.convertedSourceProvenanceRows).toHaveLength(23);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellableAdmissionLift.convertedSourceProvenanceRows.every((row) =>
      row.countsTowardSellableFindingFloor === true && row.noLeak
    )).toBe(true);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellableAdmissionLift.rejectedRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "projection_only", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "graph_only", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "restricted_only", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "generic_actor_or_source_page", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "stale_latest_error", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "duplicate_claim", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "contradicted_public_proof", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "missing_required_fields", countsTowardCurrentSellableRows: false })
    ]));
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellableAdmissionLift.targetProgress).toMatchObject({
      targetCurrentSellableRows: 250,
      remainingGapTo250: 0,
      targetCurrentSellableFindings: 95,
      remainingFindingGapTo95: 0,
      maximumSourceProvenanceShare: 0.45,
      nextTargetCurrentSellableRows: 300,
      remainingGapTo300: 50
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellableAdmissionLift.noLeakBoundary).toMatchObject({
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false,
      hostedPaidProofClaimed: false
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable300Lift).toMatchObject({
      schemaVersion: "ti.program_db_current_sellable_300_lift.v1",
      owner: "agent_03",
      acceptedCurrentRowsCount: 50,
      sourceProvenanceRowsConvertedToFindings: 5,
      rejectedRowsCount: 187,
      currentSellableRowsAfterAdmission: 300,
      currentSellableFindingsAfterAdmission: 193,
      currentSellableSourceProvenanceRowsAfterAdmission: 107,
      sourceProvenanceShareAfterAdmission: 0.357,
      countsTowardLocalCurrentPaidPreset: true,
      countsTowardHostedPaidProof: false
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable300Lift.sourcePackets).toEqual(expect.arrayContaining([
      "darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable150",
      "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff",
      "existing_public_source_rows"
    ]));
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable300Lift.acceptedRows).toHaveLength(50);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable300Lift.acceptedRows.every((row) =>
      row.actor.length > 0 &&
      row.victimOrTarget.length > 0 &&
      row.sector.length > 0 &&
      row.country.length > 0 &&
      row.ttpOrTool.length > 0 &&
      row.firstSeen.length > 0 &&
      row.lastSeen.length > 0 &&
      row.confidence >= 0.84 &&
      row.provenanceHash.length > 0 &&
      row.buyerReason.length > 0 &&
      row.countsTowardCurrentSellableRows === true &&
      row.countsTowardHostedPaidProof === false &&
      row.noLeak
    )).toBe(true);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable300Lift.acceptedRows.filter((row) => row.sourcePacket === "agent05_current_chargeable150")).toHaveLength(30);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable300Lift.acceptedRows.filter((row) => row.sourcePacket === "agent08_parser_ready_public_proof")).toHaveLength(15);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable300Lift.acceptedRows.filter((row) => row.sourcePacket === "existing_public_source_row")).toHaveLength(5);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable300Lift.convertedSourceProvenanceRows).toHaveLength(5);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable300Lift.convertedSourceProvenanceRows.every((row) =>
      row.countsTowardSellableFindingFloor === true && row.noLeak
    )).toBe(true);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable300Lift.rejectedRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "projection_only", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "graph_only", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "restricted_only", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "generic_actor_or_source_page", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "stale_latest_error", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "duplicate_claim", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "contradicted_public_proof", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "missing_required_fields", countsTowardCurrentSellableRows: false })
    ]));
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable300Lift.targetProgress).toMatchObject({
      targetCurrentSellableRows: 300,
      remainingGapTo300: 0,
      targetCurrentSellableFindings: 150,
      remainingFindingGapTo150: 0,
      maximumSourceProvenanceShare: 0.45,
      nextTargetCurrentSellableRows: 1000,
      remainingGapTo1000: 700
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable300Lift.noLeakBoundary).toMatchObject({
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false,
      hostedPaidProofClaimed: false
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable500Lift).toMatchObject({
      schemaVersion: "ti.program_dc_current_sellable_500_lift.v1",
      owner: "agent_03",
      acceptedCurrentRowsCount: 200,
      sourceProvenanceRowsConvertedToFindings: 20,
      rejectedRowsCount: 270,
      currentSellableRowsAfterAdmission: 500,
      currentSellableFindingsAfterAdmission: 413,
      currentSellableSourceProvenanceRowsAfterAdmission: 87,
      sourceProvenanceShareAfterAdmission: 0.174,
      trueFindingShareAfterAdmission: 0.826,
      countsTowardHostedPaidProof: false
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable500Lift.sourcePackets).toEqual(expect.arrayContaining([
      "darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable250",
      "darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable750",
      "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff",
      "agent04_high_value_public_source_replacements",
      "existing_public_source_rows"
    ]));
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable500Lift.acceptedRows).toHaveLength(200);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable500Lift.acceptedRows.filter((row) => row.sourcePacket === "agent05_current_chargeable250")).toHaveLength(100);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable500Lift.acceptedRows.filter((row) => row.sourcePacket === "agent08_parser_ready_public_proof")).toHaveLength(50);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable500Lift.acceptedRows.filter((row) => row.sourcePacket === "agent04_high_value_public_source_replacement")).toHaveLength(30);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable500Lift.acceptedRows.filter((row) => row.sourcePacket === "existing_public_source_row")).toHaveLength(20);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable500Lift.acceptedRows.every((row) =>
      row.actor.length > 0 &&
      row.victimOrTarget.length > 0 &&
      row.sector.length > 0 &&
      row.countryOrRegion.length > 0 &&
      row.ttpToolOrCampaign.length > 0 &&
      row.datasetOrImpactClaim.length > 0 &&
      row.firstSeen.length > 0 &&
      row.lastSeen.length > 0 &&
      row.confidence >= 0.83 &&
      row.freshnessState.length > 0 &&
      row.provenanceHash.length > 0 &&
      row.whyWorthPayingFor.length > 0 &&
      row.countsTowardCurrentSellableRows === true &&
      row.countsTowardHostedPaidProof === false &&
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials" &&
      row.noLeak
    )).toBe(true);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable500Lift.convertedSourceProvenanceRows).toHaveLength(20);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable500Lift.rejectedRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "low_value", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "stale", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "generic", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "source_provenance_only_risk", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "graph_only", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "restricted_only", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "contradicted", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "duplicate", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "missing_victim_or_context", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "missing_source_family", countsTowardCurrentSellableRows: false }),
      expect.objectContaining({ reason: "missing_buyer_action", countsTowardCurrentSellableRows: false })
    ]));
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable500Lift.targetProgress).toMatchObject({
      targetCurrentSellableRows: 500,
      remainingGapTo500: 0,
      minimumTrueFindingShare: 0.55,
      remainingFindingGapTo55Percent: 0,
      maximumSourceProvenanceShare: 0.4,
      nextTargetCurrentSellableRows: 750,
      remainingGapTo750: 250,
      next750Plan: {
        targetCurrentSellableRows: 750,
        additionalRowsNeeded: 250,
        minimumTrueFindingsAt750: 413,
        maximumSourceProvenanceRowsAt750: 300,
        sourcePackets: expect.arrayContaining(["darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable750"]),
        projectedRowsCountTowardCurrent: false
      }
    });
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable750Lift.sourcePackets).toEqual(expect.arrayContaining([
      "darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable750",
      "darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable1000",
      "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff"
    ]));
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.currentSellable750Lift.targetProgress.next1000Plan.sourcePackets).toEqual(expect.arrayContaining([
      "darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable1000"
    ]));
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.remainingBlockers.every((row) => row.countsTowardCurrentSellableRows === false)).toBe(true);
    expect(dashboard.parserRealSellableLift.findingAdmissionLedger.noLeakBoundary).toMatchObject({
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false
    });
    expect(dashboard.qualityConversionGate).toMatchObject({
      schemaVersion: "ti.program_bq_paid_row_quality_conversion_gate.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts"]),
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
      rejectedBloatReasons: expect.arrayContaining(["alias_only_cleanup", "stale_old_report_reuse", "duplicate_source_expansion", "generic_marketing_summary", "uncorroborated_public_channel_snippet", "unsafe_metadata", "no_actionability"])
    });
    expect(dashboard.qualityConversionGate.sourceParserHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_01", "agent_03", "agent_04", "agent_05"]));
    expect(dashboard.liveFreshnessQualityGate).toMatchObject({
      schemaVersion: "ti.program_br_live_freshness_quality_gate.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts"]),
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
      blockedLatestClaimReasons: expect.arrayContaining(["old_evidence", "generic_summary", "single_source", "alias_only", "unrelated_actor", "contradicted", "metadata_only_without_public_support"])
    });
    expect(dashboard.liveFreshnessQualityGate.sourceParserHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_01", "agent_03", "agent_04", "agent_05"]));
    expect(dashboard.freshnessRepairLoop).toMatchObject({
      schemaVersion: "ti.program_bs_paid_row_freshness_repair_loop.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "Apify OUTPUT"]),
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      repairQueueSize: 20,
      staleRowsBlocked: 4,
      genericRowsRepaired: 4,
      aliasOrUnrelatedRowsSuppressed: 4,
      caveatedRowsPreserved: 7,
      sellableRowsGained: 6,
      usefulRowsGained: 6,
      averageBuyerValueDelta: 0.104,
      blockerReasons: expect.arrayContaining(["stale_latest_activity", "generic_summary", "single_source", "alias_only", "unrelated_actor", "contradicted", "metadata_only_without_public_support"])
    });
    expect(dashboard.freshnessRepairLoop.actorCoverage).toEqual(expect.arrayContaining(["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta"]));
    expect(dashboard.freshnessRepairLoop.ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_01", "agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_09", "agent_10"]));
    expect(dashboard.freshnessRepairLoop.noLeakProof).toMatchObject({ rawEvidenceExposed: false, unsafeUrlsExposed: false, restrictedPayloadsExposed: false, objectKeysExposed: false });
    expect(dashboard.entitySpecificityLift).toMatchObject({
      schemaVersion: "ti.program_bv_paid_row_entity_specificity_lift.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "Apify OUTPUT"]),
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      fixtureCount: 20,
      rowsLifted: 14,
      rowsSuppressed: 4,
      rowsHeldWithRepairAction: 2,
      blockerCodesRemoved: 25,
      averageBuyerValueDelta: 0.161,
      missingFieldCoverage: expect.arrayContaining(["victim", "sector", "country", "dataset_or_impact", "ttp_or_tool", "first_seen", "last_seen", "confidence", "caveat", "contradiction_state", "provenance_hash", "next_action"]),
      blockerCodes: expect.arrayContaining(["old", "alias_only", "single_source_without_caveat", "unrelated_actor", "contradicted", "metadata_only_without_public_support", "no_useful_buyer_action", "generic_entity_fields"])
    });
    expect(dashboard.entitySpecificityLift.actorCoverage).toEqual(expect.arrayContaining(["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin", "Unknown Actor Query"]));
    expect(dashboard.entitySpecificityLift.ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_01", "agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_09", "agent_10"]));
    expect(dashboard.entitySpecificityLift.noLeakProof).toMatchObject({ rawEvidenceExposed: false, unsafeUrlsExposed: false, restrictedPayloadsExposed: false, objectKeysExposed: false });
    expect(dashboard.falsePositiveSuppressionGate).toMatchObject({
      schemaVersion: "ti.program_bz_paid_row_false_positive_suppression_gate.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "Apify OUTPUT"]),
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      fixtureCount: 32,
      falsePositivesSuppressed: 12,
      contradictedRowsHeld: 2,
      staleRepostsBlocked: 3,
      singleSourceRowsCaveated: 3,
      truePositivesPreserved: 8,
      sellableRowsProtected: 8,
      rowsPreventedFromBilling: 21,
      scenarioCoverage: expect.arrayContaining(["alias_collision", "common_victim_name", "unrelated_actor_co_mention", "stale_repost_as_current", "single_source_requires_caveat", "metadata_only_without_public_support", "contradicted_claim", "unknown_search_suppressed", "true_positive_preserved"]),
      reasonCodes: expect.arrayContaining(["alias_collision", "ambiguous_victim_name", "unrelated_actor_co_mention", "stale_repost_as_current", "single_source_without_caveat", "metadata_only_without_public_support", "contradicted_claim", "unknown_query_searching", "true_positive_sellable"])
    });
    expect(dashboard.falsePositiveSuppressionGate.buyerTrustDelta).toBeGreaterThan(0.2);
    expect(dashboard.falsePositiveSuppressionGate.actorCoverage).toEqual(expect.arrayContaining(["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin", "Random Actor", "Made Up Actor", "Unknown Actor Query"]));
    expect(dashboard.falsePositiveSuppressionGate.programCpHardening).toMatchObject({
      schemaVersion: "ti.program_cp_paid_row_false_positive_freshness_hardening.v1",
      activeCandidatePoolRowsAudited: 100,
      apifySmokeRowsAudited: 12,
      rowCountInflationBlocked: 84,
      staleLatestActivityRowsBlocked: 18,
      aliasCollisionRowsBlocked: 4,
      wrongActorRowsBlocked: 5,
      genericSourcePageRowsBlocked: 3,
      graphOnlyRowsBlocked: 4,
      restrictedOnlyRowsHeld: 11,
      caveatedRowsExcludedFromChargeable: 7
    });
    expect(dashboard.falsePositiveSuppressionGate.programCpHardening.suppressionProof.map((row) => row.class)).toEqual(expect.arrayContaining(["stale_latest_activity", "alias_collision", "wrong_actor", "generic_source_page", "unrelated_co_mention", "graph_only", "restricted_only", "synthetic_proof_only", "low_buyer_value", "caveated_only"]));
    expect(dashboard.falsePositiveSuppressionGate.programCpHardening.suppressionProof.every((row) => row.countsTowardSellable === false && row.proof.length > 0)).toBe(true);
    expect(dashboard.falsePositiveSuppressionGate.programCpHardening.preservedTruePositiveProof.every((row) => row.countsTowardSellable && row.noLeak && row.provenanceHash.length > 0 && row.requiredSignals.includes("current_public_support") && row.requiredSignals.includes("actor_specific") && row.requiredSignals.includes("buyer_action"))).toBe(true);
    expect(dashboard.falsePositiveSuppressionGate.programCpHardening.fastestRepairsTo100.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05", "agent_06", "agent_07", "agent_08", "agent_09", "agent_10"]));
    expect(dashboard.falsePositiveSuppressionGate.programCpHardening.fastestRepairsTo100.every((row) => row.countsTowardPaidFloorNow === false && row.nextAction.length > 0)).toBe(true);
    expect(dashboard.falsePositiveSuppressionGate.programCpHardening.secondBatchAudit).toMatchObject({
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
      caveatedRowsCountTowardChargeable: false
    });
    expect(dashboard.falsePositiveSuppressionGate.programCpHardening.secondBatchAudit.findingAdmissionRequiredSignals).toEqual(expect.arrayContaining(["current_public_support", "actor_specific", "finding_context", "freshness_not_stale", "provenance_hash", "no_leak", "buyer_action"]));
    expect(dashboard.falsePositiveSuppressionGate.programCpHardening.secondBatchAudit.rowInflationGuards.map((row) => row.guard)).toEqual(expect.arrayContaining(["source_provenance_padding", "stale_latest_activity", "alias_or_wrong_actor", "generic_source_page", "graph_only", "restricted_only", "caveated_as_chargeable"]));
    expect(dashboard.falsePositiveSuppressionGate.programCpHardening.secondBatchAudit.rowInflationGuards.every((row) => row.countsTowardPaidPromotion === false && row.proof.length > 0)).toBe(true);
    expect(dashboard.falsePositiveSuppressionGate.programCpHardening.secondBatchAudit.noLeakProof).toMatchObject({ rawEvidenceExposed: false, unsafeUrlsExposed: false, restrictedPayloadsExposed: false, objectKeysExposed: false, privateMaterialExposed: false, accountMaterialExposed: false, actorInteractionContentExposed: false });
    expect(dashboard.falsePositiveSuppressionGate.programCpHardening.noLeakProof).toMatchObject({ rawEvidenceExposed: false, unsafeUrlsExposed: false, restrictedPayloadsExposed: false, objectKeysExposed: false, privateMaterialExposed: false, accountMaterialExposed: false, actorInteractionContentExposed: false });
    expect(dashboard.falsePositiveSuppressionGate.ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_09", "agent_10"]));
    expect(dashboard.falsePositiveSuppressionGate.noLeakProof).toMatchObject({ rawEvidenceExposed: false, unsafeUrlsExposed: false, restrictedPayloadsExposed: false, objectKeysExposed: false, privateMaterialExposed: false, accountMaterialExposed: false, actorInteractionContentExposed: false });
    expect(dashboard.paidRowAudit100).toMatchObject({
      schemaVersion: "ti.program_ch_paid_row_audit_100.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "Apify OUTPUT"]),
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      targetSellableRows: 100,
      currentSellableRows: 5,
      protectedSellableRows: 5,
      usefulCaveatedRowsExcluded: 3,
      suppressedFalsePositives: 7,
      rowsOneRepairAway: 9,
      expectedSellableLiftAfterParserSourceRepairs: 21,
      rowsPreventedFromBilling: 39,
      productionSellableFloorGap: 95
    });
    expect(dashboard.paidRowAudit100.classificationCounts).toMatchObject({
      sellable: 5,
      useful_caveated: 3,
      needs_public_support: 4,
      stale_or_duplicate: 2,
      wrong_actor_or_alias_collision: 2,
      restricted_only: 2,
      not_payworthy: 3
    });
    expect(dashboard.paidRowAudit100.actorCoverage).toEqual(expect.arrayContaining(["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin"]));
    expect(dashboard.paidRowAudit100.exclusionProof.map((row) => row.class)).toEqual(expect.arrayContaining(["graph_only_projection", "synthetic_row", "stale_or_duplicate", "restricted_only", "caveat_only"]));
    expect(dashboard.paidRowAudit100.exclusionProof.every((row) => row.countsAsSellable === false && row.reason.length > 0)).toBe(true);
    expect(dashboard.paidRowAudit100.ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_10"]));
    expect(dashboard.paidRowAudit100.noLeakProof).toMatchObject({ rawEvidenceExposed: false, unsafeUrlsExposed: false, restrictedPayloadsExposed: false, objectKeysExposed: false, privateMaterialExposed: false, accountMaterialExposed: false, actorInteractionContentExposed: false });
    expect(dashboard.first100AdmissionQuality).toMatchObject({
      schemaVersion: "ti.program_cn_first_100_paid_row_admission_quality.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "Apify OUTPUT"]),
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      productionSellableFloor: 100,
      fixtureCount: 100,
      metrics: {
        rowsAdmittedToProductionFloor: 16,
        rowsDowngradedToCaveatedContext: 7,
        rowsSuppressed: 38,
        rowsNeedingParserRepair: 12,
        rowsNeedingSourceSupport: 28,
        rowsNeedingDarkMetadataPublicSupport: 11,
        estimatedBuyerValueDelta: 0.073,
        rowCountInflationBlocked: 84
      }
    });
    expect(dashboard.first100AdmissionQuality.classificationCounts).toMatchObject({
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
    });
    expect(dashboard.first100AdmissionQuality.sampleRows.every((row) => row.whyBuyerShouldCare.length > 0 && row.nextSearchOrPivot.length > 0 && row.provenanceHash.length > 0 && row.noLeak)).toBe(true);
    expect(dashboard.first100AdmissionQuality.sampleRows.filter((row) => !row.countsTowardProductionSellableRows).every((row) => row.admissionDecision !== "admit_sellable" && row.failureReasons.length > 0)).toBe(true);
    expect(dashboard.first100AdmissionQuality.nonSellableExclusionProof.map((row) => row.class)).toEqual(expect.arrayContaining(["graph_only", "synthetic_proof_only", "stale_duplicate", "restricted_only", "caveated_useful", "generic_market_source_page", "low_buyer_value", "alias_or_wrong_actor"]));
    expect(dashboard.first100AdmissionQuality.ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_09", "agent_10"]));
    expect(dashboard.first100AdmissionQuality.noLeakProof).toMatchObject({ rawEvidenceExposed: false, unsafeUrlsExposed: false, restrictedPayloadsExposed: false, objectKeysExposed: false, privateMaterialExposed: false, accountMaterialExposed: false, actorInteractionContentExposed: false });
    expect(dashboard.darkMetadataLiveValueExpansion).toMatchObject({
      schemaVersion: "ti.dark_metadata_live_value_expansion_slo.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts"]),
      owner: "Agent 05",
      dryRun: true,
      willStartCollection: false,
      willFetchNetwork: false,
      sourceCountInflationBlocked: true,
      criteria: {
        minimumAverageBuyerValueScore: 0.68,
        maximumStaleRate: 0.28,
        maximumDuplicateRate: 0.16,
        maximumBlockedOrReviewRate: 0.18,
        minimumUsefulQueriesPerTier: 20,
        minimumSafeSampleRowsPerTier: 12,
        noLeakSerializationRequired: true
      }
    });
    expect(dashboard.darkMetadataLiveValueExpansion.tiers).toEqual([
      { tier: 1000, evaluatedCandidateCount: 100, valueQualifiedCandidateCount: 2, usefulRowRate: 0.02, averageBuyerValueScore: 0.41, staleRate: 0.92, duplicateRate: 0.06, blockedOrReviewRate: 0.74, decision: "hold_for_value_density" },
      { tier: 4000, evaluatedCandidateCount: 100, valueQualifiedCandidateCount: 2, usefulRowRate: 0.02, averageBuyerValueScore: 0.41, staleRate: 0.92, duplicateRate: 0.06, blockedOrReviewRate: 0.74, decision: "hold_for_value_density" }
    ]);
    expect(dashboard.darkMetadataLiveValueExpansion.blockers).toEqual(expect.arrayContaining([
      "dark_metadata_value_density_below_paid_threshold",
      "source_count_inflation_blocked_until_sample_rows_and_queries_pass",
      "no_live_fetch_until_approved_proxy_boundary_and_source_gates_clear"
    ]));
    expect(dashboard.darkMetadataPublicHandoff100).toMatchObject({
      schemaVersion: "ti.dark_metadata_public_handoff_100_slo.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts"]),
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
      criteria: {
        targetSellableRows: 100,
        restrictedOnlyRowsCannotBeSellable: true,
        publicSupportRequiredForSellable: true,
        noLeakSerializationRequired: true,
        minimumAverageBuyerValueScore: 0.55
      }
    });
    expect(dashboard.darkMetadataPublicHandoff100.decisionCounts).toEqual({
      sellableWithPublicSupport: 0,
      includedWithCaveat: 2,
      coverageGapOnly: 28,
      hold: 46,
      suppress: 24
    });
    expect(dashboard.darkMetadataPublicHandoff100.handoffFields.agent10RevenueGateCounts).toEqual(expect.arrayContaining([
      "sellableWithPublicSupport",
      "usefulCaveatedRows",
      "coverageGapOnlyRows",
      "heldRows",
      "suppressedRows",
      "projectedContributionToward100SellableRows"
    ]));
    expect(dashboard.darkMetadataPublicHandoff100.blockers).toEqual(expect.arrayContaining([
      "public_corroborated_dark_metadata_rows_below_100_sellable_floor",
      "restricted_only_rows_not_counted_as_sellable",
      "no_live_fetch_until_approved_proxy_boundary_and_source_gates_clear"
    ]));
    expect(dashboard.darkMetadataPublicSupportLift4000).toMatchObject({
      schemaVersion: "ti.dark_metadata_public_support_lift_4000_slo.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts"]),
      owner: "Agent 05",
      dryRun: true,
      willStartCollection: false,
      willFetchNetwork: false,
      candidateSource: "publicSupportWorklist40_and_darkweb_index_records",
      tierTargets: [100, 1000, 4000, 10000],
      currentContributionToward100SellableRows: 2,
      first4000CandidateCount: 4000,
      projectedContributionToward100PaidRowsAfterPublicSupport: 80
    });
    expect(dashboard.darkMetadataPublicSupportLift4000.first100RepairQueue.length).toBeGreaterThan(0);
    expect(dashboard.darkMetadataPublicSupportLift4000.first100RepairQueue.every((row) =>
      row.countsTowardSellableFloorNow === false &&
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials"
    )).toBe(true);
    expect(dashboard.darkMetadataPublicSupportLift4000.tier10000Preview).toMatchObject({
      schemaVersion: "ti.darkweb_index_public_support_tier10000_preview.v1",
      baselineTier: "tier_4000",
      targetTier: "tier_10000",
      evaluatedCandidateCount: 10000,
      countsTowardSellableFloorNow: false
    });
    expect(dashboard.darkMetadataPublicSupportLift4000.metricMovement).toMatchObject({
      repairCandidatesAdded: 100,
      countsTowardSellableFloorNow: false
    });
    expect(dashboard.darkMetadataPublicSupportLift4000.supportBucketCounts).toEqual({
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
    });
    expect(dashboard.darkMetadataPublicSupportLift4000.tierSummaries).toEqual(expect.arrayContaining([
      expect.objectContaining({ tier: "tier_4000", evaluatedCandidateCount: 4000, acceptedForPublicSupportCount: 134, sellableAfterPublicSupport: 80, usefulWithCaveat: 54, restrictedOnlyHold: 556, rejectedCount: 3310, currentlyChargeableCount: 0, countsTowardSellableFloorNow: false })
    ]));
    expect(dashboard.darkMetadataPublicSupportLift4000.first100RepairQueue).toHaveLength(3);
    expect(dashboard.darkMetadataPublicSupportLift4000.first100RepairQueue.every((row) => row.countsTowardSellableFloorNow === false && row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials")).toBe(true);
    expect(dashboard.darkMetadataPublicSupportLift4000.publicSupportSellable100).toMatchObject({
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
      agent03ParserHandoffRowCount: 100
    });
    expect(dashboard.darkMetadataPublicSupportLift4000.publicSupportSellable100.sampleRows.every((row) =>
      row.safePublicSourceId.startsWith("public_support_source_") &&
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials" &&
      (row.rowDecision !== "retired_not_chargeable" || (!row.countsTowardSellableFloorNow && !row.countsTowardSellableFloorAfterPublicSupport))
    )).toBe(true);
    expect(dashboard.darkMetadataPublicSupportLift4000.publicSupportSellable250).toMatchObject({
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
      newlyChargeableParserHandoffRowCount: 38
    });
    expect(Object.values(dashboard.darkMetadataPublicSupportLift4000.publicSupportSellable250.blockerBucketCounts).reduce((sum, count) => sum + count, 0)).toBe(200);
    expect(dashboard.darkMetadataPublicSupportLift4000.publicSupportSellable250.sampleRows.every((row) =>
      row.safePublicSourceId.startsWith("public_support_250_source_") &&
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials" &&
      (row.rowDecision === "current_sellable_public_supported" || (!row.countsTowardSellableFloorNow && row.blockerBucket !== undefined))
    )).toBe(true);
    expect(dashboard.darkMetadataPublicSupportLift4000.publicSupportSellable500).toMatchObject({
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
      newlyChargeableParserHandoffRowCount: 250
    });
    expect(Object.values(dashboard.darkMetadataPublicSupportLift4000.publicSupportSellable500.blockerBucketCounts).reduce((sum, count) => sum + count, 0)).toBe(0);
    expect(dashboard.darkMetadataPublicSupportLift4000.publicSupportSellable500.sampleRows.every((row) =>
      row.safePublicSourceId.startsWith("public_support_500_source_") &&
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials" &&
      row.freshness.length > 0 &&
      row.recheckCadenceHours > 0 &&
      row.whyWorthPayingFor.length > 0 &&
      (row.rowDecision === "current_sellable_public_supported" || (!row.countsTowardSellableFloorNow && row.blockerBucket !== undefined))
    )).toBe(true);
    expect(dashboard.darkMetadataPublicSupportLift4000.tier10000Preview).toMatchObject({
      schemaVersion: "ti.darkweb_index_public_support_tier10000_preview.v1",
      evaluatedCandidateCount: 10000,
      valueQualifiedCandidateCount: 340,
      projectedSellableAfterPublicSupport: 198,
      usefulWithCaveat: 142,
      restrictedOnlyHold: 1386,
      acceptedValueDensity: 0.034,
      expansionDecision: "hold_for_value_density",
      countsTowardSellableFloorNow: false
    });
    expect(dashboard.darkMetadataPublicSupportLift4000.metricMovement).toMatchObject({
      repairCandidatesAdded: 100,
      likelySellableRowsAfterPublicSupport: 80,
      usefulCaveatedRows: 20,
      suppressedRows: 3866,
      remainingRowsToFirst100FloorAfterPublicSupport: 20,
      countsTowardSellableFloorNow: false
    });
    expect(dashboard.darkMetadataPublicSupportLift4000.criteria).toMatchObject({
      targetPaidRows: 100,
      publicSupportRequiredForSellable: true,
      restrictedOnlyRowsCannotBeChargeable: true,
      staleDuplicateUnsafeLowValueCannotBeChargeable: true,
      noLeakSerializationRequired: true
    });
    expect(dashboard.darkMetadataPublicSupportLift4000.blockers).toEqual(expect.arrayContaining([
      "currently_chargeable_dark_metadata_rows_zero_until_public_support_is_attached",
      "tier_4000_stale_duplicate_unsafe_low_value_rows_excluded_from_paid_floor",
      "restricted_only_rows_hold_until_safe_public_corroboration"
    ]));
    expect(dashboard.dailySnapshot.metrics.sourcePayworthyRate).toBe(0.367);
    expect(dashboard.dailySnapshot.metrics.sourcePayworthyCount).toBe(1468);
    expect(dashboard.dailySnapshot.metrics.sellableRowRate).toBe(0.163);
    expect(dashboard.dailySnapshot.metrics.averageBuyerValueScore).toBe(0.6);
    expect(dashboard.dailySnapshot.monetizationReadiness.status).toBe("blocked_for_paid_traffic");
    expect(dashboard.dailySnapshot.nonMonetizingWorkDetector.proofFixture).toMatchObject({ nonMonetizingExampleCount: 4, monetizingExampleCount: 1 });
    expect(dashboard.dailySnapshot.scaleStepGates).toMatchObject({ passCount: 0, holdCount: 6, nextAllowedStep: null });
    expect(dashboard.apifyLaunchExperiment.grossPpeRevenueUsd).toBeNull();
    expect(dashboard.apifyLaunchExperiment.uniqueUsers).toBe(1);
    expect(dashboard.apifyLaunchExperiment.paidRowDecisionCounts).toMatchObject({ sellable: 16, includedWithCaveat: 32, coverageGapOnly: 30, hold: 20, suppress: 0, buyerUseful: 48 });
    expect(dashboard.apifyLaunchExperiment.monetizationReadiness).toMatchObject({
      status: "blocked_for_paid_traffic",
      minimumProductionSellableRows: 100,
      targetSellableRows: 100,
      nextRevenueAction: "add_or_repair live corroborating sources until at least 100 output rows are chargeable findings and at least 25 percent of rows are sellable"
    });
    expect(dashboard.apifyLaunchExperiment.marketplaceTelemetry).toMatchObject({
      schemaVersion: "ti.apify_marketplace_telemetry_input.v1",
      storePageViews: 6,
      actorStarts: 2,
      datasetRows: 98,
      failedRuns: 0,
      refunds: 0,
      platformUsageCostUsd: 0.0023,
      estimatedCreatorRevenueUsd: 0.235,
      realDataRequired: true,
      unknownMeansNoClaim: true
    });
    expect(dashboard.apifyLaunchExperiment.payoutReadiness).toMatchObject({
      schemaVersion: "ti.apify_payout_readiness.v1",
      payoutMethodState: "blocked",
      beneficiaryState: "blocked",
      withdrawalReadiness: "blocked",
      externallyVerified: false
    });
    expect(dashboard.apifyLaunchExperiment.conversionExperiments.map((item) => item.id)).toEqual(["starter_actor_query_pack", "high_freshness_apt_monitoring_pack", "ransomware_public_claim_metadata_pack"]);
    expect(dashboard.apifyLaunchExperiment.conversionExperiments.every((item) => item.buyerVisibleFields.includes("noLeakProof") && item.noLeakRequired)).toBe(true);
    expect(dashboard.apifyLaunchExperiment.operatorBlockerBoard.map((item) => item.owner)).toEqual(expect.arrayContaining(["Agent 01", "Agent 03", "Agent 04", "Agent 05", "Agent 07", "Agent 08", "Agent 10"]));
    expect(dashboard.apifyLaunchExperiment.revenueConversionChecklist).toMatchObject({
      schemaVersion: "ti.apify_revenue_conversion_checklist.v1",
      telemetryState: "ready",
      payoutState: "blocked"
    });
    expect(dashboard.apifyLaunchExperiment.revenueConversionChecklist.checks.map((item) => item.id)).toEqual(expect.arrayContaining(["listing_copy", "sample_rows", "pricing_shape", "marketplace_telemetry", "payout_setup", "fake_traction_guards", "no_leak_sample_proof"]));
    expect(dashboard.apifyLaunchExperiment.pricingProof).toMatchObject({
      schemaVersion: "ti.apify_pricing_proof.v1",
      starterTrialShape: { name: "starter_actor_query_pack", queryLimit: 3 },
      paidDailyMonitoringShape: { name: "high_freshness_apt_monitoring_pack", minimumSellableRowRate: 0.25, minimumFreshRowRate: 0.55 },
      usageCostGuard: { rowPriceUsdPerThousand: 3, platformUsageCostUsd: 0.0023, estimatedCreatorRevenueUsd: 0.235, maxCostPerUsefulRowUsd: 0.01 },
      payoutRevenueSeparation: { paymentMethodState: "blocked", beneficiaryState: "blocked", withdrawalReadiness: "blocked", externallyVerifiedRevenueUsd: 0.235 },
      noLeakRequired: true
    });
    expect(dashboard.apifyLaunchExperiment.buyerSampleRows).toHaveLength(12);
    expect(dashboard.apifyLaunchExperiment.buyerSampleRows.every((row) =>
      row.buyerVisibleFields.noLeakProof === "metadata_only_no_raw_body_no_secret_material_no_private_content" &&
      row.buyerVisibleFields.nextAnalystPivots.length > 0
    )).toBe(true);
    expect(dashboard.apifyLaunchExperiment.marketplaceConversionRealRowSamplePack).toMatchObject({
      schemaVersion: "ti.apify_marketplace_conversion_real_row_sample_pack.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/contracts#apifyStoreReadiness", "Apify OUTPUT", "Apify dataset rows"]),
      source: "current_safe_output_rows_only",
      productionPaidTrafficReady: false,
      currentSellableRows: 16,
      targetSellableRows: 100,
      paidTrafficExperimentReadiness: {
        status: "blocked_until_100_real_sellable_rows"
      }
    });
    expect(dashboard.apifyLaunchExperiment.marketplaceConversionRealRowSamplePack.productionBlockers).toEqual(expect.arrayContaining([
      "sellable_rows_below_100_production_floor",
      "paid_traffic_experiment_blocked_until_agent10_floor_passes",
      "external_apify_marketplace_analytics_unknown"
    ]));
    expect(dashboard.apifyLaunchExperiment.marketplaceConversionRealRowSamplePack.sampleRows).toHaveLength(4);
    expect(dashboard.apifyLaunchExperiment.marketplaceConversionRealRowSamplePack.sampleRows.every((row) =>
      row.countsTowardCurrentSellableRows &&
      row.corroborationState === "corroborated" &&
      row.contradictionState === "none" &&
      row.noLeakProof === "metadata_only_no_raw_body_no_credentials_no_private_content" &&
      row.sourceFamilies.length > 1 &&
      row.nextBuyerSearchPivots.length > 0
    )).toBe(true);
    expect(dashboard.apifyLaunchExperiment.marketplaceConversionRealRowSamplePack.excludedAsPaidReadinessProof.map((row) => row.rowClass)).toEqual(expect.arrayContaining(["synthetic", "graph_only", "stale", "restricted_only", "caveat_only", "held", "coverage_gap"]));
    expect(dashboard.apifyLaunchExperiment.marketplaceConversionRealRowSamplePack.marketplaceTelemetryDescriptors.every((row) => row.currentValue === "external_unknown" && row.noSyntheticFallback)).toBe(true);
    expect(dashboard.apifyLaunchExperiment.marketplaceConversionRealRowSamplePack.noFakeProof).toMatchObject({
      externalAnalyticsRequired: true,
      valuesRemainExternalUnknownUntilVerified: true,
      noSyntheticRowsUsed: true,
      noGraphOnlyRowsUsed: true,
      noCaveatOnlyRowsUsed: true,
      noRestrictedOnlyRowsUsed: true
    });
    expect(dashboard.apifyLaunchExperiment.marketplaceConversionRealRowSamplePack.first100BuyerPreview).toMatchObject({
      schemaVersion: "ti.apify_first_100_real_rows_buyer_preview.v1",
      status: "blocked_preview_until_100_real_sellable_rows",
      currentSellableRows: 16,
      remainingSellableRowsNeeded: 84,
      sampleRowsShownNow: 4,
      sampleRowsRequiredBeforePaidTraffic: 100,
      noLeakProof: {
        rawEvidenceBodies: false,
        unsafeUrls: false,
        credentials: false,
        privateContent: false,
        restrictedOnlyRowsPromoted: false
      },
      freshnessProof: {
        staleRowsCountTowardPaidFloor: false
      }
    });
    expect(dashboard.apifyLaunchExperiment.marketplaceConversionRealRowSamplePack.first100BuyerPreview.topBlockerBuckets.map((bucket) => bucket.blocker)).toEqual(expect.arrayContaining(["missing_public_support", "parser_repair", "dark_metadata_public_support", "freshness", "marketplace_output_gap"]));
    expect(dashboard.apifyLaunchExperiment.marketplaceConversionRealRowSamplePack.first100BuyerPreview.topBlockerBuckets.every((bucket) => bucket.countsTowardPaidFloorNow === false && bucket.buyerVisibleFix.length > 0)).toBe(true);
    expect(dashboard.apifyLaunchExperiment.marketplaceConversionRealRowSamplePack.first100BuyerPreview.requiredBuyerFields).toEqual(expect.arrayContaining(["actorOrGroup", "claimType", "victimOrTargetWhenSafe", "sectorCountry", "ttpToolCvePivots", "freshness", "confidence", "provenanceHash", "noLeakProof"]));
    expect(dashboard.apifyLaunchExperiment.marketplaceConversionRealRowSamplePack.first100BuyerPreview.activationGate.join(" ")).toContain("100 real current sellable rows");
    expect(dashboard.apifyLaunchExperiment.nextRevenueAction).toBe("payout_setup");
    expect(dashboard.apifyLaunchExperiment).toMatchObject({ storeViewToRunRate: 0.333, storeViewToUserRate: 0.167, runsPerUser: 2, trialToPaidRate: 0.5 });
    expect(dashboard.apifyLaunchExperiment.fakeTractionGuards.join(" ")).toContain("payout readiness is unknown or blocked unless externally verified");
    expect(dashboard.apifyLaunchExperiment.unknowns).toContain("grossPpeRevenueUsd");
    expect(dashboard.deploymentProof.actorBuildId).toBe("build_123");
    expect(dashboard.deploymentProof.publicProofCommands).toContain("bun run smoke:apify-threat-actor-monitor");
    expect(dashboard.resourceGuardrails).toMatchObject({
      scraperTargetRamGb: 96,
      scraperNormalCeilingGb: 160,
      ctiReserveDiskGb: 500,
      browserPoolDefault: "disabled",
      gpuRequired: false
    });
    expect(JSON.stringify(dashboard)).not.toContain("object_key");
    expect(JSON.stringify(dashboard)).not.toContain("\"credential\":\"");
    expect(JSON.stringify(dashboard)).not.toContain("credential=");

    const dir = mkdtempSync(join(tmpdir(), "product-slo-"));
    const path = join(dir, "daily.jsonl");
    try {
      await appendLiveProductDailySnapshot(path, dashboard.dailySnapshot);
      await appendLiveProductDailySnapshot(path, { ...dashboard.dailySnapshot, snapshotId: "snapshot_second" });
      const snapshots = await readLiveProductDailySnapshots(path);
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0]?.appendOnly).toBe(true);
      expect(snapshots[1]?.snapshotId).toBe("snapshot_second");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("promotes real Apify marketplace telemetry to paid traffic without synthetic traction", () => {
    const dashboard = buildLiveProductSloDashboard({
      generatedAt: "2026-06-20T12:30:00.000Z",
      proofMode: "local",
      runs: [],
      sources: [],
      captures: [],
      incidents: [],
      frontier: productSloFrontierSummary(),
      queryMeasurements: [
        { query: "APT29", proofMode: "local", firstResponseMs: 700, pollIntervalMs: 3000, status: "ready", rowCount: 20, usefulRowCount: 12, freshRowCount: 16, activityClaimCount: 4, duplicateArticleRate: 0, sourceProviderFailures: 0, staleRejected: true, emptyResultHonest: true, apiError: false }
      ],
      actorRun: { actorId: "apify/public-threat-actor-monitor", actorVersion: "0.6.4", buildId: "build_paid", runId: "run_paid", datasetId: "ds_paid", status: "succeeded", queryCount: 20, rowCount: 400, usefulRowCount: 240, freshRowCount: 280, staleRowCount: 1, activityClaimRowCount: 80, sellableRowCount: 120, includedWithCaveatRowCount: 120, coverageGapOnlyRowCount: 80, holdRowCount: 80, suppressRowCount: 0, targetSellableRows: 100, averageBuyerValueScore: 0.72, defaultWatchlistRun: false },
      cost: { grossPpeRevenueUsd: 0.12, apifyCommissionUsd: 0.024, computeCostUsd: 0.004, backendCostAllocationUsd: 0.002, refundsFailuresUsd: 0, actorStartCostUsd: 0.00005, resultPriceUsdPerThousand: 3, actorStartPriceUsd: 0.00005, apifyMarginRate: 0.2 },
      marketplace: { actorViewCount: 120, actorRunCount: 24, uniqueUserCount: 12, trialRunCount: 10, paidRunCount: 3, actorStartCount: 24, datasetRowCount: 400, failedRunCount: 0, repeatUserCount: 3, refundCount: 0, platformUsageCostUsd: 0.006, estimatedCreatorRevenueUsd: 0.96, beneficiaryVerified: true, payoutMethodReady: true, withdrawalReady: true, pricingEffectiveAt: "2026-07-04" },
      sourceMonetization: { evaluatedSourceCandidateCount: 4000, payworthySourceCount: 3200, payworthyThresholdRate: 0.72 }
    });

    expect(dashboard.apifyLaunchExperiment.marketplaceTelemetry).toMatchObject({
      storePageViews: 120,
      uniqueUsers: 12,
      trialRuns: 10,
      paidRuns: 3,
      actorStarts: 24,
      actorRuns: 24,
      datasetRows: 400,
      failedRuns: 0,
      repeatUsers: 3,
      refunds: 0,
      platformUsageCostUsd: 0.006,
      estimatedCreatorRevenueUsd: 0.96,
      realDataRequired: true,
      unknownMeansNoClaim: true
    });
    expect(dashboard.apifyLaunchExperiment.payoutReadiness).toMatchObject({
      payoutMethodState: "ready",
      beneficiaryState: "verified",
      withdrawalReadiness: "ready",
      externallyVerified: true,
      blockers: []
    });
    expect(dashboard.apifyLaunchExperiment.revenueConversionChecklist).toMatchObject({
      telemetryState: "ready",
      payoutState: "ready",
      paidTrafficState: "ready"
    });
    expect(dashboard.apifyLaunchExperiment).toMatchObject({
      storeViewToRunRate: 0.2,
      storeViewToUserRate: 0.1,
      runsPerUser: 2,
      trialToPaidRate: 0.3,
      nextRevenueAction: "paid_traffic"
    });
    expect(dashboard.apifyLaunchExperiment.pricingProof.usageCostGuard).toMatchObject({
      platformUsageCostUsd: 0.006,
      estimatedCreatorRevenueUsd: 0.96,
      maxCostPerUsefulRowUsd: 0.01
    });
    expect(dashboard.apifyLaunchExperiment.pricingProof.payoutRevenueSeparation).toMatchObject({
      paymentMethodState: "ready",
      beneficiaryState: "verified",
      withdrawalReadiness: "ready",
      externallyVerifiedRevenueUsd: 0.96
    });
    expect(dashboard.apifyLaunchExperiment.fakeTractionGuards.join(" ")).toContain("local sample runs and owner proof runs never count");
    expect(dashboard.apifyLaunchExperiment.fakeTractionGuards.join(" ")).toContain("synthetic proof rows never count");
    expect(dashboard.apifyLaunchExperiment.unknowns).not.toEqual(expect.arrayContaining([
      "actorViewCount",
      "uniqueUserCount",
      "trialRunCount",
      "paidRunCount",
      "actorStartCount",
      "datasetRowCount",
      "failedRunCount",
      "repeatUserCount",
      "refundCount",
      "platformUsageCostUsd",
      "estimatedCreatorRevenueUsd",
      "beneficiaryVerified",
      "payoutMethodReady",
      "withdrawalReady",
      "grossPpeRevenueUsd",
      "netContributionUsd"
    ]));
  });

  test("rejects excessive darknet metadata worker counts", () => {
    expect(() => validateResourceBudget({
      maxRamGb: 96,
      normalCeilingGb: 160,
      reservedDiskGb: 500,
      maxCollectionWorkers: 64,
      maxProcessingWorkers: 16,
      maxTelegramWorkers: 8,
      maxBrowserWorkers: 0,
      maxDarknetMetadataWorkers: 32,
      maxQueueItems: 50_000
    })).toThrow("darknet metadata");
  });

  test("records adapter failure categories and rate-limit alert signals without payload labels", () => {
    const metrics = new MetricsRegistry();
    const now = new Date("2026-01-01T00:00:00.000Z");

    recordAdapterRunMetrics(metrics, {
      adapter: "telegram_public",
      sourceType: "telegram_public",
      now,
      result: {
        items: [],
        warnings: ["rate limited"],
        metadata: {
          failureCategory: "rate_limited",
          crawlState: {
            fetchDurationMs: 250,
            rateLimitResetAt: "2026-01-01T00:10:00.000Z"
          }
        }
      }
    });

    for (let index = 0; index < 19; index += 1) {
      recordAdapterRunMetrics(metrics, {
        adapter: "telegram_public",
        sourceType: "telegram_public",
        now,
        result: { items: [], warnings: [], metadata: {} }
      });
    }

    const snapshot = metrics.snapshot();
    const failure = snapshot.find((sample) => sample.name === "scraper_adapter_failures_total");
    const delay = snapshot.find((sample) => sample.name === "scraper_adapter_rate_limit_delay_seconds");
    const alerts = evaluateAdapterMetricAlerts(snapshot);

    expect(failure?.labels.category).toBe("rate_limited");
    expect(delay?.value).toBe(600);
    expect(alerts.some((alert) => alert.name === "adapter_failure_rate" && alert.severity === "warn")).toBe(true);
    expect(alerts.some((alert) => alert.name === "adapter_rate_limit_delay" && alert.severity === "warn")).toBe(true);
    expect(Object.keys(failure?.labels ?? {})).not.toContain("sourceId");
  });

  test("builds live-search ops DTOs for searching partial ready degraded blocked and disabled states", () => {
    expect(buildLiveSearchOpsDto({
      state: "searching",
      query: "APT29",
      provider: "scraper",
      initialResponseMs: 250,
      activeRunsForQuery: 1
    }).backpressure.acceptNewRun).toBe(false);

    expect(buildLiveSearchOpsDto({
      state: "partial",
      query: "APT29",
      provider: "public_channel",
      partialResultMs: 800,
      resultCount: 2
    }).status).toBe("ok");

    expect(buildLiveSearchOpsDto({
      state: "ready",
      query: "APT29",
      provider: "scraper",
      resultCount: 4
    }).backpressure.acceptNewRun).toBe(true);

    const degraded = buildLiveSearchOpsDto({
      state: "degraded",
      query: "APT29",
      provider: "search_provider",
      providerFailures: 1,
      externalDependencyLatencyMs: 6_000
    });
    expect(degraded.status).toBe("critical");
    expect(degraded.recommendedPollIntervalMs).toBe(10_000);

    const blocked = buildLiveSearchOpsDto({
      state: "blocked",
      query: "darknet payload",
      provider: "darknet_metadata",
      darknetKillSwitchActive: true
    });
    expect(blocked.backpressure.acceptNewRun).toBe(false);
    expect(blocked.alerts.some((alert) => alert.name === "live_search_darknet_kill_switch")).toBe(true);

    const disabled = buildLiveSearchOpsDto({
      state: "disabled",
      query: "APT29",
      provider: "api_proxy",
      disabledReason: "public /ti disabled during deploy"
    });
    expect(disabled.status).toBe("critical");
    expect(disabled.backpressure.reason).toBe("public /ti disabled during deploy");
  });

  test("records live-search metrics for duplicate runs polling gaps and zero results", () => {
    const metrics = new MetricsRegistry();
    const ops = recordLiveSearchMetrics(metrics, {
      state: "partial",
      query: "Scattered Spider",
      provider: "scraper",
      pollCount: 12,
      activeRunsForQuery: 2,
      resultCount: 0,
      sourceActivationGaps: 3,
      providerFailures: 1,
      initialResponseMs: 900,
      partialResultMs: 5_500,
      fallbackProviderHealthy: false,
      scraperNativeHealthy: true,
      outerFallbackUsed: true
    });
    const samples = metrics.snapshot();
    const alerts = evaluateLiveSearchMetricAlerts(samples);

    expect(ops.alerts.some((alert) => alert.name === "live_search_duplicate_active_runs")).toBe(true);
    expect(samples.find((sample) => sample.name === "scraper_live_search_poll_count")?.value).toBe(12);
    expect(samples.find((sample) => sample.name === "scraper_live_search_source_activation_gaps")?.value).toBe(3);
    expect(samples.find((sample) => sample.name === "scraper_live_search_zero_result_total")?.value).toBe(1);
    expect(samples.find((sample) => sample.name === "scraper_live_search_outer_fallback_used")?.value).toBe(1);
    expect(alerts.some((alert) => alert.name === "live_search_duplicate_active_runs")).toBe(true);
    expect(alerts.some((alert) => alert.name === "live_search_provider_failures")).toBe(true);
    expect(alerts.some((alert) => alert.name === "live_search_fallback_provider_down")).toBe(true);
    expect(alerts.some((alert) => alert.name === "live_search_outer_fallback_usage")).toBe(true);
  });

  test("verifies public live-search deploy probes and missing run ids", () => {
    const good = verifyLiveSearchDeployProbe({
      publicTi: {
        url: "https://hanasand.com/ti?q=Scattered%20Spider",
        status: 200,
        body: "<script>window.__TI_MODE='live_search';</script><div>partial results</div>"
      },
      apiSearch: {
        url: "https://api.hanasand.com/api/ti/search",
        status: 200,
        json: { run: { id: "run_123" }, status: "partial" }
      }
    });
    const bad = verifyLiveSearchDeployProbe({
      publicTi: {
        url: "https://hanasand.com/ti?q=Scattered%20Spider",
        status: 200,
        body: "<div>fallback only</div>"
      },
      apiSearch: {
        url: "https://api.hanasand.com/api/ti/search",
        status: 200,
        json: { status: "partial" }
      }
    });

    expect(good.ok).toBe(true);
    expect(() => assertLiveSearchDeployVerification(good)).not.toThrow();
    expect(bad.ok).toBe(false);
    expect(() => assertLiveSearchDeployVerification(bad)).toThrow("public_ti.live_search_marker");
  });

  test("estimates live-search polling impact across Inspur client counts", () => {
    const one = estimateLiveSearchPollingImpact(1);
    const ten = estimateLiveSearchPollingImpact(10);
    const hundred = estimateLiveSearchPollingImpact(100);
    const thousand = estimateLiveSearchPollingImpact(1_000);

    expect(one.requestsPerSecond).toBe(0.5);
    expect(ten.status).toBe("ok");
    expect(hundred.status).toBe("warn");
    expect(thousand.status).toBe("critical");
    expect(thousand.estimatedMemoryMb).toBeLessThan(1024);
  });

  test("gates scraper-native search fallback removal with healthy degraded and failing probes", () => {
    const healthyProbe = {
      scraperHealth: { status: 200, json: { ok: true } },
      search: {
        status: 200,
        json: {
          status: "partial",
          run: { id: "run_native_1" },
          cursor: "cur_1",
          evidence: [{ id: "evidence_1" }],
          sourceCoverage: {
            sources: [{ id: "src_1", status: "active" }],
            sourceActivationGaps: 0
          }
        }
      },
      cursorPoll: {
        status: 200,
        json: { cursor: "cur_2", deltas: [{ id: "delta_1" }] }
      },
      degradedSearch: {
        status: 200,
        json: { status: "degraded", run: { id: "run_native_1" }, sourceCoverage: { sourceActivationGaps: 1 } }
      },
      publicPage: {
        url: "https://hanasand.com/ti?q=Scattered%20Spider",
        status: 200,
        body: "<div data-mode=\"live_search\">partial</div>"
      },
      publicApiPost: {
        url: "https://api.hanasand.com/api/ti/search",
        status: 200,
        json: { runId: "run_public_1", status: "partial" }
      },
      publicApiGet: {
        url: "https://api.hanasand.com/api/ti/search?q=Scattered%20Spider",
        status: 404,
        json: { error: "not_found" }
      }
    };
    const healthy = verifyScraperNativeSearchReadiness(healthyProbe);
    const metadataReview = verifyScraperNativeSearchReadiness({
      ...healthyProbe,
      search: {
        ...healthyProbe.search,
        json: {
          ...healthyProbe.search.json,
          status: "metadata_review"
        }
      },
      publicPage: {
        url: "https://hanasand.com/ti?q=APT29",
        status: 200,
        body: "<div data-mode=\"live_search\">metadata_review queued run</div>"
      },
      publicApiPost: {
        url: "https://api.hanasand.com/api/ti/search",
        status: 200,
        json: { runId: "run_public_2", status: "metadata_review" }
      }
    });
    const failing = verifyScraperNativeSearchReadiness({
      scraperHealth: { status: 503, json: { ok: false } },
      search: {
        status: 200,
        json: { status: "ready", evidence: [] }
      },
      cursorPoll: {
        status: 404,
        json: { error: "missing cursor" }
      },
      degradedSearch: {
        status: 500,
        json: { status: "error" }
      },
      publicPage: {
        url: "https://hanasand.com/ti?q=Scattered%20Spider",
        status: 200,
        body: "<div>outer fallback</div>"
      },
      publicApiPost: {
        url: "https://api.hanasand.com/api/ti/search",
        status: 200,
        json: { status: "partial" }
      },
      publicApiGet: {
        url: "https://api.hanasand.com/api/ti/search?q=Scattered%20Spider",
        status: 404,
        json: { error: "not_found" }
      }
    });
    const getRequired = verifyScraperNativeSearchReadiness({
      ...healthyProbe,
      publicApiGet: {
        url: "https://api.hanasand.com/api/ti/search?q=Scattered%20Spider",
        status: 404,
        json: { error: "not_found" }
      },
      requireGetApiProof: true
    });

    expect(healthy.ok).toBe(true);
    expect(metadataReview.ok).toBe(true);
    expect(healthy.rollback.required).toBe(false);
    expect(() => assertScraperNativeSearchReadiness(healthy)).not.toThrow();
    expect(failing.ok).toBe(false);
    expect(failing.rollback.required).toBe(true);
    expect(failing.rollback.reasons).toContain("scraper.health_http_ok");
    expect(failing.rollback.reasons).toContain("search.run_id");
    expect(failing.rollback.reasons).toContain("cursor_poll.http_ok");
    expect(failing.rollback.reasons).toContain("public_api_post.run_id");
    expect(getRequired.ok).toBe(false);
    expect(getRequired.rollback.reasons).toContain("public_api_get.optional_or_http_ok");
    expect(() => assertScraperNativeSearchReadiness(failing)).toThrow("scraper.health_http_ok");
  });

  test("evaluates 24h live-search soak success degraded provider scraper unavailable queue backlog and memory pressure", () => {
    const success = evaluateLiveSearchSoak({
      scenario: "success",
      durationHours: 24,
      publicQueryCount: 6,
      publicProofOk: true,
      scraperNativeProofOk: true,
      apiWrapperProofOk: true,
      sourceActivationDryRunOk: true,
      runReuseOk: true,
      cursorPollingOk: true,
      initialLatencyP95Ms: 700,
      partialLatencyP95Ms: 3_200,
      errorRatePercent: 0.4,
      duplicateActiveRuns: 0,
      sourceCoveragePercent: 91,
      queueAgeP95Seconds: 25,
      workerSaturationPercent: 42,
      cpuMaxPercent: 55,
      memoryRssMaxGb: 72,
      policyBlocks: 8,
      policyBlockRatePercent: 4,
      unsafePolicyRetries: 0,
      restrictedKillSwitchActive: false,
      sourceUnavailableRatePercent: 2,
      staleCacheRatePercent: 1,
      fallbackUsed: false
    });
    const degradedProvider = evaluateLiveSearchSoak({
      ...success.summary,
      scenario: "degraded_provider",
      durationHours: 24,
      publicProofOk: true,
      scraperNativeProofOk: true,
      apiWrapperProofOk: true,
      sourceActivationDryRunOk: true,
      initialLatencyP95Ms: 900,
      partialLatencyP95Ms: 6_500,
      errorRatePercent: 1.5,
      duplicateActiveRuns: 0,
      sourceCoveragePercent: 86,
      queueAgeP95Seconds: 45,
      workerSaturationPercent: 48,
      memoryRssMaxGb: 73,
      policyBlocks: 10,
      policyBlockRatePercent: 5,
      unsafePolicyRetries: 0,
      sourceUnavailableRatePercent: 3,
      staleCacheRatePercent: 2,
      fallbackUsed: false
    });
    const scraperUnavailable = evaluateLiveSearchSoak({
      ...degradedProvider.summary,
      scenario: "scraper_unavailable",
      publicProofOk: false,
      scraperNativeProofOk: false,
      apiWrapperProofOk: false,
      sourceActivationDryRunOk: true,
      initialLatencyP95Ms: 2_500,
      partialLatencyP95Ms: 9_000,
      errorRatePercent: 8,
      duplicateActiveRuns: 0,
      sourceCoveragePercent: 82,
      queueAgeP95Seconds: 30,
      workerSaturationPercent: 45,
      memoryRssMaxGb: 70,
      policyBlocks: 4,
      policyBlockRatePercent: 2,
      unsafePolicyRetries: 0,
      sourceUnavailableRatePercent: 15,
      staleCacheRatePercent: 4,
      fallbackUsed: true
    });
    const queueBacklog = evaluateLiveSearchSoak({
      ...success.summary,
      scenario: "queue_backlog",
      durationHours: 24,
      publicProofOk: true,
      scraperNativeProofOk: true,
      apiWrapperProofOk: true,
      sourceActivationDryRunOk: true,
      initialLatencyP95Ms: 850,
      partialLatencyP95Ms: 4_200,
      errorRatePercent: 1,
      duplicateActiveRuns: 0,
      sourceCoveragePercent: 88,
      queueAgeP95Seconds: 140,
      workerSaturationPercent: 91,
      memoryRssMaxGb: 80,
      policyBlocks: 12,
      policyBlockRatePercent: 6,
      unsafePolicyRetries: 0,
      sourceUnavailableRatePercent: 4,
      staleCacheRatePercent: 2,
      fallbackUsed: false
    });
    const memoryPressure = evaluateLiveSearchSoak({
      ...queueBacklog.summary,
      scenario: "memory_pressure",
      publicProofOk: true,
      scraperNativeProofOk: true,
      apiWrapperProofOk: true,
      sourceActivationDryRunOk: true,
      initialLatencyP95Ms: 850,
      partialLatencyP95Ms: 4_200,
      errorRatePercent: 1,
      duplicateActiveRuns: 0,
      sourceCoveragePercent: 88,
      queueAgeP95Seconds: 45,
      workerSaturationPercent: 62,
      memoryRssMaxGb: 101,
      policyBlocks: 12,
      policyBlockRatePercent: 6,
      unsafePolicyRetries: 0,
      sourceUnavailableRatePercent: 4,
      staleCacheRatePercent: 2,
      fallbackUsed: false
    });
    const staleEvidence = evaluateLiveSearchSoak({
      ...success.summary,
      scenario: "degraded_provider",
      durationHours: 24,
      publicProofOk: true,
      scraperNativeProofOk: true,
      apiWrapperProofOk: true,
      sourceActivationDryRunOk: true,
      initialLatencyP95Ms: 800,
      partialLatencyP95Ms: 4_000,
      errorRatePercent: 1,
      duplicateActiveRuns: 0,
      sourceCoveragePercent: 84,
      queueAgeP95Seconds: 35,
      workerSaturationPercent: 50,
      memoryRssMaxGb: 74,
      policyBlocks: 8,
      policyBlockRatePercent: 4,
      unsafePolicyRetries: 0,
      sourceUnavailableRatePercent: 5,
      staleCacheRatePercent: 11,
      fallbackUsed: false
    });

    expect(success.status).toBe("promote");
    expect(success.ok).toBe(true);
    expect(success.statusReport).toContain("Agent 10 live-search soak status: promote");
    expect(success.statusReport).toContain("workerSaturationPercent: 42");
    expect(success.statusReport).toContain("cursorPollingOk: true");
    expect(success.summary.cpuMaxPercent).toBe(55);
    expect(success.summary.restrictedKillSwitchActive).toBe(false);
    expect(() => assertLiveSearchSoakPromotion(success)).not.toThrow();
    expect(degradedProvider.status).toBe("hold");
    expect(degradedProvider.rollbackReasons).toContain("latency.partial_p95");
    expect(scraperUnavailable.status).toBe("rollback");
    expect(scraperUnavailable.rollbackReasons).toContain("proof.scraper_native");
    expect(queueBacklog.status).toBe("rollback");
    expect(queueBacklog.rollbackReasons).toContain("queue.age_p95");
    expect(queueBacklog.rollbackReasons).toContain("workers.saturation");
    expect(memoryPressure.status).toBe("rollback");
    expect(memoryPressure.rollbackReasons).toContain("memory.rss_max");
    expect(staleEvidence.status).toBe("rollback");
    expect(staleEvidence.rollbackReasons).toContain("cache.stale_rate");
    expect(() => assertLiveSearchSoakPromotion(memoryPressure)).toThrow("memory.rss_max");
  });

  test("blocks promotion when deployment drift or public live proof diverges", () => {
    const soak = evaluateLiveSearchSoak({
      scenario: "success",
      durationHours: 24,
      publicProofOk: true,
      scraperNativeProofOk: true,
      apiWrapperProofOk: true,
      sourceActivationDryRunOk: true,
      initialLatencyP95Ms: 700,
      partialLatencyP95Ms: 3_000,
      errorRatePercent: 0.4,
      duplicateActiveRuns: 0,
      sourceCoveragePercent: 91,
      queueAgeP95Seconds: 25,
      workerSaturationPercent: 42,
      memoryRssMaxGb: 72,
      policyBlocks: 6,
      policyBlockRatePercent: 3,
      unsafePolicyRetries: 0,
      sourceUnavailableRatePercent: 2,
      staleCacheRatePercent: 1,
      fallbackUsed: false
    });
    const alignedProbe: DeploymentDriftProbe = {
      localSourceHash: "src_good",
      remoteSourceHash: "src_good",
      expectedComposeConfigHash: "compose_good",
      remoteComposeConfigHash: "compose_good",
      expectedImageId: "sha256:image_good",
      runningImageId: "sha256:image_good",
      randomActorQuery: "Volt Typhoon",
      rollbackTarget: {
        sourceHash: "src_last_good",
        imageId: "sha256:last_good",
        composeConfigHash: "compose_last_good",
        command: "docker compose up -d ti-scraper api frontend --no-build"
      },
      healthEndpoints: [
        { name: "scraper", url: "http://ti-scraper:8097/v1/health", status: 200, json: { status: "ok" } },
        { name: "api", url: "http://api:8000/health", status: 200, ok: true },
        { name: "frontend", url: "https://hanasand.com/ti", status: 200, body: "ok" }
      ],
      publicProofs: ["APT29", "Scattered Spider", "Volt Typhoon"].map((query) => ({
        query,
        url: `https://hanasand.com/ti?q=${encodeURIComponent(query)}`,
        status: 200,
        body: `<div data-mode="live_search">partial evidence queued run for ${query}</div>`
      })),
      apiSearchProofs: ["APT29", "Scattered Spider", "Volt Typhoon"].map((query) => ({
        query,
        url: `https://api.hanasand.com/api/ti/search?q=${encodeURIComponent(query)}`,
        status: 200,
        json: { status: "partial", run: { id: `run_${query}` }, evidence: [{ id: "ev_1" }] }
      }))
    };
    const alignedDrift = evaluateDeploymentDrift(alignedProbe);
    const alignedSummary = buildLiveSearchPromotionSummary(soak, alignedDrift);

    expect(alignedDrift.ok).toBe(true);
    expect(alignedDrift.state).toBe("aligned");
    expect(alignedSummary.ok).toBe(true);
    expect(alignedSummary.status).toBe("promote");
    expect(alignedSummary.statusReport).toContain("deploymentDriftState: aligned");
    expect(() => assertLiveSearchPromotionSummary(alignedSummary)).not.toThrow();

    const drifted = evaluateDeploymentDrift({
      ...alignedProbe,
      localSourceHash: "src_good",
      remoteSourceHash: "src_old",
      expectedImageId: "sha256:image_good",
      runningImageId: "sha256:image_old",
      publicProofs: [
        { query: "APT29", url: "https://hanasand.com/ti?q=APT29", status: 200, body: "<div data-mode=\"live_search\">partial queued run</div>" },
        { query: "Scattered Spider", url: "https://hanasand.com/ti?q=Scattered%20Spider", status: 200, body: "<div>fallback only</div>" },
        { query: "Volt Typhoon", url: "https://hanasand.com/ti?q=Volt%20Typhoon", status: 200, body: "<div data-mode=\"live_search\">partial queued run</div>" }
      ],
      apiSearchProofs: [
        { query: "APT29", url: "https://api.hanasand.com/api/ti/search?q=APT29", status: 200, json: { status: "partial", runId: "run_1", evidence: [{ id: "ev_1" }] } },
        { query: "Scattered Spider", url: "https://api.hanasand.com/api/ti/search?q=Scattered%20Spider", status: 200, json: { status: "partial", evidence: [{ id: "ev_2" }] } },
        { query: "Volt Typhoon", url: "https://api.hanasand.com/api/ti/search?q=Volt%20Typhoon", status: 200, json: { status: "partial", runId: "run_3", evidence: [{ id: "ev_3" }] } }
      ]
    });
    const driftSummary = buildLiveSearchPromotionSummary(soak, drifted);

    expect(drifted.ok).toBe(false);
    expect(drifted.state).toBe("rollback");
    expect(drifted.blockedPromotionReasons).toContain("source.local_remote_match");
    expect(drifted.blockedPromotionReasons).toContain("image.running_expected_match");
    expect(drifted.blockedPromotionReasons).toContain("public_ti.scattered_spider.live_search_marker");
    expect(drifted.blockedPromotionReasons).toContain("api_search.scattered_spider.run_id");
    expect(driftSummary.status).toBe("rollback");
    expect(driftSummary.blockedPromotionReasons).toContain("deployment.image.running_expected_match");
    expect(driftSummary.statusReport).toContain("lastKnownGoodImageId: sha256:last_good");
    expect(() => assertLiveSearchPromotionSummary(driftSummary)).toThrow("deployment.image.running_expected_match");
  });

  test("orchestrates scraper-native cutover rehearsal across workstreams proofs and resource budget", () => {
    const queries = ["APT29", "Scattered Spider", "Volt Typhoon", "Turla", "Akira", "MuddyWater"];
    const deployment = evaluateDeploymentDrift({
      localSourceHash: "src_good",
      remoteSourceHash: "src_good",
      expectedComposeConfigHash: "compose_good",
      remoteComposeConfigHash: "compose_good",
      expectedImageId: "sha256:image_good",
      runningImageId: "sha256:image_good",
      randomActorQuery: "MuddyWater",
      rollbackTarget: {
        sourceHash: "src_last_good",
        imageId: "sha256:last_good",
        composeConfigHash: "compose_last_good",
        command: "docker compose up -d ti-scraper api frontend --no-build"
      },
      healthEndpoints: [
        { name: "scraper", url: "http://ti-scraper:8097/v1/health", status: 200, json: { status: "ok" } },
        { name: "api", url: "http://api:8000/health", status: 200, ok: true },
        { name: "frontend", url: "https://hanasand.com/ti", status: 200, body: "ok" }
      ],
      publicProofs: ["APT29", "Scattered Spider", "MuddyWater"].map((query) => ({
        query,
        url: `https://hanasand.com/ti?q=${encodeURIComponent(query)}`,
        status: 200,
        body: `<div data-mode="live_search">partial queued run for ${query}</div>`
      })),
      apiSearchProofs: ["APT29", "Scattered Spider", "MuddyWater"].map((query) => ({
        query,
        url: `https://api.hanasand.com/api/ti/search?q=${encodeURIComponent(query)}`,
        status: 200,
        json: { status: "partial", run: { id: `run_${query}` }, evidence: [{ id: "ev_1" }] }
      }))
    });
    const baseInput: CutoverRehearsalInput = {
      deploymentDrift: deployment,
      randomActorQuery: "MuddyWater",
      agent09ApprovedFallbackRemoval: true,
      mainAgentDeployGateApproved: true,
      fallbackRollbackPath: "restore api/src/utils/ti/search.ts outer fallback and redeploy hanasand_api",
      lastKnownGoodFallbackState: "outer fallback using seeded scraper-mode API results",
      resourceBudget: {
        hostRamGb: 1_024,
        scraperTargetGb: 96,
        scraperCeilingGb: 160,
        apiGb: 24,
        frontendGb: 8,
        postgresGb: 96,
        openSearchVectorGb: 160,
        graphGb: 96,
        objectStoreGb: 160,
        osCacheAndEmergencyGb: 192
      },
      workstreams: [
        "source_readiness",
        "scheduler_readiness",
        "public_channel_readiness",
        "restricted_metadata_readiness",
        "evidence_readiness",
        "extraction_quality",
        "graph_readiness",
        "api_readiness"
      ].map((name, index) => ({
        name,
        owner: `Agent ${String(index + 1).padStart(2, "0")}`,
        status: "ready",
        proofCommand: `bun test src/tests/${name}.test.ts`,
        lastKnownGoodState: `${name}:ready`,
        rollbackPath: `${name}:keep outer fallback`
      })),
      livePublicProofs: queries.map((query) => ({
        query,
        url: `https://hanasand.com/ti?q=${encodeURIComponent(query)}`,
        status: 200,
        body: `<div data-mode="live_search">partial evidence queued run for ${query}</div>`
      })),
      apiSearchProofs: queries.map((query) => ({
        query,
        url: `https://api.hanasand.com/api/ti/search?q=${encodeURIComponent(query)}`,
        status: 200,
        json: { status: "partial", runId: `run_${query}`, evidence: [{ id: "ev_1" }] }
      }))
    };
    const pass = evaluateCutoverRehearsal(baseInput);

    expect(pass.ok).toBe(true);
    expect(pass.decision).toBe("pass");
    expect(pass.requiredPublicProofQueries).toEqual(queries);
    expect(pass.resourceBudget.nonScraperReservedGb).toBe(864);
    expect(pass.statusReport).toContain("Agent 10 cutover rehearsal decision: pass");
    expect(() => assertCutoverRehearsalPass(pass)).not.toThrow();

    const hold = evaluateCutoverRehearsal({
      ...baseInput,
      agent09ApprovedFallbackRemoval: false,
      workstreams: baseInput.workstreams.map((workstream) => workstream.name === "extraction_quality"
        ? { ...workstream, status: "partial", blockers: ["extraction_quality.weak_evidence_random_actor"] }
        : workstream)
    });

    expect(hold.ok).toBe(false);
    expect(hold.decision).toBe("hold");
    expect(hold.blockers.map((blocker) => blocker.name)).toContain("api.agent09_fallback_removal_approval_missing");
    expect(hold.blockers.map((blocker) => blocker.name)).toContain("extraction_quality.weak_evidence_random_actor");

    const rollback = evaluateCutoverRehearsal({
      ...baseInput,
      livePublicProofs: baseInput.livePublicProofs.map((proof) => proof.query === "Turla" ? { ...proof, body: "<div>fallback only</div>" } : proof),
      resourceBudget: {
        ...baseInput.resourceBudget,
        scraperTargetGb: 128,
        scraperCeilingGb: 192,
        osCacheAndEmergencyGb: 80
      }
    });

    expect(rollback.decision).toBe("rollback");
    expect(rollback.blockers.map((blocker) => blocker.name)).toContain("public_ti.turla.live_search_marker");
    expect(rollback.blockers.map((blocker) => blocker.name)).toContain("resource.scraper_target_96gb");
    expect(rollback.blockers.map((blocker) => blocker.name)).toContain("resource.scraper_ceiling_160gb");
    expect(() => assertCutoverRehearsalPass(rollback)).toThrow("cutover rehearsal rollback");
  });

  test("aggregates dry-run cutover apply plans into promotion packets", () => {
    const queries = ["APT29", "Scattered Spider", "Volt Typhoon", "Turla", "Akira", "MuddyWater"];
    const deployment = evaluateDeploymentDrift({
      localSourceHash: "src_good",
      remoteSourceHash: "src_good",
      expectedComposeConfigHash: "compose_good",
      remoteComposeConfigHash: "compose_good",
      expectedImageId: "sha256:image_good",
      runningImageId: "sha256:image_good",
      randomActorQuery: "MuddyWater",
      rollbackTarget: {
        sourceHash: "src_last_good",
        imageId: "sha256:last_good",
        composeConfigHash: "compose_last_good",
        command: "docker compose up -d ti-scraper api frontend --no-build"
      },
      healthEndpoints: [
        { name: "scraper", url: "http://ti-scraper:8097/v1/health", status: 200, json: { status: "ok" } },
        { name: "api", url: "http://api:8000/health", status: 200, ok: true },
        { name: "frontend", url: "https://hanasand.com/ti", status: 200, body: "ok" }
      ],
      publicProofs: ["APT29", "Scattered Spider", "MuddyWater"].map((query) => ({
        query,
        url: `https://hanasand.com/ti?q=${encodeURIComponent(query)}`,
        status: 200,
        body: `<div data-mode="live_search">partial queued run for ${query}</div>`
      })),
      apiSearchProofs: ["APT29", "Scattered Spider", "MuddyWater"].map((query) => ({
        query,
        url: `https://api.hanasand.com/api/ti/search?q=${encodeURIComponent(query)}`,
        status: 200,
        json: { status: "partial", runId: `run_${query}`, evidence: [{ id: "ev_1" }] }
      }))
    });
    const resourceBudget = {
      hostRamGb: 1_024,
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      apiGb: 24,
      frontendGb: 8,
      postgresGb: 96,
      openSearchVectorGb: 160,
      graphGb: 96,
      objectStoreGb: 160,
      osCacheAndEmergencyGb: 192
    };
    const rehearsalInput: CutoverRehearsalInput = {
      deploymentDrift: deployment,
      randomActorQuery: "MuddyWater",
      agent09ApprovedFallbackRemoval: true,
      mainAgentDeployGateApproved: true,
      fallbackRollbackPath: "restore api/src/utils/ti/search.ts outer fallback",
      lastKnownGoodFallbackState: "outer fallback installed",
      resourceBudget,
      workstreams: [
        "source_readiness",
        "scheduler_readiness",
        "public_channel_readiness",
        "restricted_metadata_readiness",
        "evidence_readiness",
        "extraction_quality",
        "graph_readiness",
        "api_readiness"
      ].map((name, index) => ({
        name,
        owner: `Agent ${String(index + 1).padStart(2, "0")}`,
        status: "ready",
        proofCommand: `bun test src/tests/${name}.test.ts`,
        lastKnownGoodState: `${name}:ready`,
        rollbackPath: `${name}:keep outer fallback`
      })),
      livePublicProofs: queries.map((query) => ({
        query,
        url: `https://hanasand.com/ti?q=${encodeURIComponent(query)}`,
        status: 200,
        body: `<div data-mode="live_search">partial evidence queued run for ${query}</div>`
      })),
      apiSearchProofs: queries.map((query) => ({
        query,
        url: `https://api.hanasand.com/api/ti/search?q=${encodeURIComponent(query)}`,
        status: 200,
        json: { status: "partial", runId: `run_${query}`, evidence: [{ id: "ev_1" }] }
      }))
    };
    const rehearsal = evaluateCutoverRehearsal(rehearsalInput);
    const actions: CutoverApplyPlanAction[] = [
      {
        id: "source.activate-approved-pack",
        workstream: "source_readiness",
        owner: "Agent 01",
        title: "Activate approved public source pack",
        classification: "automation-safe",
        applied: true,
        preconditions: ["source dry-run install passed"],
        expectedEffect: "approved idle sources become active",
        rollback: "restore previous source statuses",
        policyImpact: "public sources only",
        proofCommand: "bun test src/tests/sourceSeeds.test.ts"
      },
      {
        id: "scheduler.repair-dead-letters",
        workstream: "scheduler_readiness",
        owner: "Agent 02",
        title: "Repair queue dead-letter debt",
        classification: "human-approval-required",
        applied: false,
        preconditions: ["operator reviews queue repair"],
        expectedEffect: "dead-letter rate returns under promotion threshold",
        rollback: "restore previous queue leases",
        policyImpact: "no collection scope expansion",
        proofCommand: "bun test src/tests/schedulerProduction.test.ts",
        promotionBlockers: ["scheduler.queue_repair_debt_unapplied"]
      },
      {
        id: "graph.block-export",
        workstream: "graph_readiness",
        owner: "Agent 08",
        title: "Keep weak graph export blocked",
        classification: "blocked",
        applied: false,
        preconditions: ["analyst review resolves contradictions"],
        expectedEffect: "prevents weak export promotion",
        rollback: "keep graph export disabled",
        policyImpact: "avoids unsupported relationship export",
        proofCommand: "bun test src/tests/graphViews.test.ts",
        promotionBlockers: ["graph.export_blocker_unresolved"]
      },
      {
        id: "deployment.rollback-fallback",
        workstream: "deployment_drift",
        owner: "Agent 10",
        title: "Rollback to outer fallback",
        classification: "rollback-only",
        applied: false,
        preconditions: ["promotion fails or public proof regresses"],
        expectedEffect: "public /ti uses last known-good fallback",
        rollback: "redeploy scraper-native after new rehearsal pass",
        policyImpact: "no source policy change",
        proofCommand: "bun run check:live-search-deploy",
        promotionBlockers: ["deployment.rollback_only_available"]
      }
    ];
    const holdPacket = buildCutoverApplyPlanPacket({
      rehearsal,
      actions,
      deploymentDrift: deployment,
      agent09ApiReady: true,
      resourceBudget,
      leaderThreadContext: "cutover dry run 2026-05-24"
    });

    expect(holdPacket.ok).toBe(false);
    expect(holdPacket.decision).toBe("rollback");
    expect(holdPacket.classificationCounts["automation-safe"]).toBe(1);
    expect(holdPacket.classificationCounts["human-approval-required"]).toBe(1);
    expect(holdPacket.classificationCounts.blocked).toBe(1);
    expect(holdPacket.classificationCounts["rollback-only"]).toBe(1);
    expect(holdPacket.blockers.map((blocker) => blocker.name)).toContain("apply_plan.scheduler.queue_repair_debt_unapplied");
    expect(holdPacket.blockers.map((blocker) => blocker.name)).toContain("apply_plan.graph.export_blocker_unresolved");
    expect(holdPacket.dryRunOutput).toContain("resources scraper_target_gb=96 scraper_ceiling_gb=160");
    expect(holdPacket.dryRunOutput).toContain("Agent 10 cutover apply plan: decision=rollback");
    expect(() => assertCutoverApplyPlanPass(holdPacket)).toThrow("cutover apply plan rollback");

    const passPacket = buildCutoverApplyPlanPacket({
      rehearsal,
      deploymentDrift: deployment,
      agent09ApiReady: true,
      resourceBudget,
      leaderThreadContext: "cutover dry run 2026-05-24",
      actions: actions.slice(0, 1)
    });

    expect(passPacket.ok).toBe(true);
    expect(passPacket.decision).toBe("pass");
    expect(passPacket.dryRunOutput).toContain("blockers=none");
    expect(() => assertCutoverApplyPlanPass(passPacket)).not.toThrow();

    const promotionPacket = buildCutoverPromotionPacket({
      rehearsal,
      deploymentDrift: deployment,
      agent09ApiReady: true,
      resourceBudget,
      leaderThreadContext: "cutover dry run 2026-05-24",
      actions: actions.slice(0, 1),
      workstreams: rehearsalInput.workstreams,
      livePublicProofs: rehearsalInput.livePublicProofs,
      apiSearchProofs: rehearsalInput.apiSearchProofs,
      mountedRouteProofs: mountedRouteProofs(),
      generatedAt: "2026-05-24T03:34:01.746Z"
    });

    expect(promotionPacket.schemaVersion).toBe("ti.cutover.promotion_packet.v1");
    expect(promotionPacket.decision).toBe("pass");
    expect(promotionPacket.applyPlan.actionIds).toEqual(["source.activate-approved-pack"]);
    expect(promotionPacket.liveProof).toHaveLength(6);
    expect(promotionPacket.liveProof.every((proof) => proof.ok)).toBe(true);
    expect(promotionPacket.mountedRouteProofs).toHaveLength(CUTOVER_MOUNTED_ROUTE_PROOF_REQUIREMENTS.length);
    expect(promotionPacket.mountedRouteProofs.every((proof) => proof.status === "passed")).toBe(true);
    expect(promotionPacket.blockerAwareGate).toEqual([
      { name: "agent03_clear_web", owner: "Agent 03", classification: "pass", status: "clear_web:passed,agent03_status:passed", proofNames: ["clear_web", "agent03_status"] },
      { name: "agent09_compatibility", owner: "Agent 09", classification: "pass", status: "route_inventory:passed,scraper_native_search:passed,agent09_readiness_report:passed", proofNames: ["route_inventory", "scraper_native_search", "agent09_readiness_report"] }
    ]);
    expect(promotionPacket.ownerAssignments["Agent 01"]).toContain("source.activate-approved-pack");
    expect(promotionPacket.proofCommands).toContain("bun test src/tests/sourceSeeds.test.ts");
    expect(promotionPacket.proofCommands).toContain("bun run check:frontier-apply-plan");
    expect(promotionPacket.proofCommands).toContain("bun run check:route-inventory");
    expect(promotionPacket.proofCommands).toContain("TI_SCRAPER_INTERNAL_BASE=http://127.0.0.1:8097 bun run check:scraper-native-search");
    expect(promotionPacket.proofCommands).toContain("ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:search-quality-mounted'");
    expect(promotionPacket.leaderMarkdown).toContain("decision: pass");
    expect(promotionPacket.leaderMarkdown).toContain("mounted_route_proof: green");
    expect(promotionPacket.leaderMarkdown).toContain("proof_commands:");
    expect(promotionPacket.leaderMarkdown).not.toMatch(/revolutionary|seamless|world-class|game-changing|transformative|delight/i);
    expect(promotionPacket.leaderMarkdown.split("\n").length).toBeLessThanOrEqual(48);

    const agent03HoldPacket = buildCutoverPromotionPacket({
      rehearsal,
      deploymentDrift: deployment,
      agent09ApiReady: true,
      resourceBudget,
      leaderThreadContext: "hold: Agent 03 clear-web proof missing",
      actions: actions.slice(0, 1),
      workstreams: rehearsalInput.workstreams,
      livePublicProofs: rehearsalInput.livePublicProofs,
      apiSearchProofs: rehearsalInput.apiSearchProofs,
      mountedRouteProofs: mountedRouteProofs({ clear_web: "missing" }),
      generatedAt: "2026-05-24T03:34:01.746Z"
    });
    expect(agent03HoldPacket.decision).toBe("hold");
    expect(agent03HoldPacket.blockers.map((blocker) => blocker.name)).toContain("mounted_route.clear_web.missing");
    expect(agent03HoldPacket.ownerAssignments["Agent 03"]).toContain("mounted_route.clear_web.missing");

    const agent03StalePacket = buildCutoverPromotionPacket({
      rehearsal,
      deploymentDrift: deployment,
      agent09ApiReady: true,
      resourceBudget,
      leaderThreadContext: "hold: Agent 03 clear-web proof stale",
      actions: actions.slice(0, 1),
      workstreams: rehearsalInput.workstreams,
      livePublicProofs: rehearsalInput.livePublicProofs,
      apiSearchProofs: rehearsalInput.apiSearchProofs,
      mountedRouteProofs: mountedRouteProofs({ clear_web: "stale" }),
      generatedAt: "2026-05-24T03:34:01.746Z"
    });
    expect(agent03StalePacket.decision).toBe("hold");
    expect(agent03StalePacket.blockers.map((blocker) => blocker.name)).toContain("mounted_route.clear_web.stale");
    expect(agent03StalePacket.blockerAwareGate.find((gate) => gate.name === "agent03_clear_web")?.classification).toBe("warning");

    const agent09HoldPacket = buildCutoverPromotionPacket({
      rehearsal,
      deploymentDrift: deployment,
      agent09ApiReady: true,
      resourceBudget,
      leaderThreadContext: "hold: Agent 09 route inventory missing",
      actions: actions.slice(0, 1),
      workstreams: rehearsalInput.workstreams,
      livePublicProofs: rehearsalInput.livePublicProofs,
      apiSearchProofs: rehearsalInput.apiSearchProofs,
      mountedRouteProofs: mountedRouteProofs({ route_inventory: "missing", scraper_native_search: "documented_only" }),
      generatedAt: "2026-05-24T03:34:01.746Z"
    });
    expect(agent09HoldPacket.decision).toBe("hold");
    expect(agent09HoldPacket.blockers.map((blocker) => blocker.name)).toContain("mounted_route.route_inventory.missing");
    expect(agent09HoldPacket.blockers.map((blocker) => blocker.name)).toContain("mounted_route.scraper_native_search.documented_only");
    expect(agent09HoldPacket.blockerAwareGate.find((gate) => gate.name === "agent09_compatibility")?.classification).toBe("blocker");
    expect(agent09HoldPacket.leaderMarkdown).toContain("mounted_route_proof: red");

    const statusHoldPacket = buildCutoverPromotionPacket({
      rehearsal,
      deploymentDrift: deployment,
      agent09ApiReady: true,
      resourceBudget,
      leaderThreadContext: "hold: required Agent 03 and Agent 09 status proofs missing",
      actions: actions.slice(0, 1),
      workstreams: rehearsalInput.workstreams,
      livePublicProofs: rehearsalInput.livePublicProofs,
      apiSearchProofs: rehearsalInput.apiSearchProofs,
      mountedRouteProofs: mountedRouteProofs({ agent03_status: "missing", agent09_readiness_report: "missing" }),
      generatedAt: "2026-05-24T03:34:01.746Z"
    });
    expect(statusHoldPacket.decision).toBe("hold");
    expect(statusHoldPacket.blockers.map((blocker) => blocker.name)).toContain("mounted_route.agent03_status.missing");
    expect(statusHoldPacket.blockers.map((blocker) => blocker.name)).toContain("mounted_route.agent09_readiness_report.missing");
    expect(statusHoldPacket.blockerAwareGate.map((gate) => gate.classification)).toEqual(["blocker", "blocker"]);

    const publicMismatchPacket = buildCutoverPromotionPacket({
      rehearsal,
      deploymentDrift: deployment,
      agent09ApiReady: true,
      resourceBudget,
      leaderThreadContext: "rollback: public proof mismatch",
      actions: actions.slice(0, 1),
      workstreams: rehearsalInput.workstreams,
      livePublicProofs: rehearsalInput.livePublicProofs.map((proof, index) => index === 0 ? { ...proof, body: "<div>fallback only</div>" } : proof),
      apiSearchProofs: rehearsalInput.apiSearchProofs,
      mountedRouteProofs: mountedRouteProofs(),
      generatedAt: "2026-05-24T03:34:01.746Z"
    });
    expect(publicMismatchPacket.decision).toBe("rollback");
    expect(publicMismatchPacket.blockers.map((blocker) => blocker.name)).toContain("live_proof.apt29.mismatch");
    expect(publicMismatchPacket.leaderMarkdown).toContain("live_proof: red");
  });

  test("builds blocker-aware soak release decisions across all workstreams", () => {
    const queries = ["APT29", "Scattered Spider", "Volt Typhoon", "Turla", "Akira", "MuddyWater"];
    const livePublicProofs = queries.map((query) => ({
      query,
      url: `https://hanasand.com/ti?q=${encodeURIComponent(query)}`,
      status: 200,
      body: `<div data-mode="live_search">partial evidence queued run for ${query}</div>`
    }));
    const apiSearchProofs = queries.map((query) => ({
      query,
      url: "https://api.hanasand.com/api/ti/search",
      status: 200,
      json: { status: "partial", runId: `run_${query}`, evidence: [{ id: "ev_1" }] }
    }));
    const deployment = evaluateDeploymentDrift({
      localSourceHash: "src_good",
      remoteSourceHash: "src_good",
      expectedComposeConfigHash: "compose_good",
      remoteComposeConfigHash: "compose_good",
      expectedImageId: "sha256:image_good",
      runningImageId: "sha256:image_good",
      randomActorQuery: "MuddyWater",
      rollbackTarget: {
        sourceHash: "src_last_good",
        imageId: "sha256:last_good",
        composeConfigHash: "compose_last_good",
        command: "docker compose up -d ti-scraper api frontend --no-build"
      },
      healthEndpoints: [
        { name: "scraper", url: "http://ti-scraper:8097/v1/health", status: 200, json: { status: "ok" } },
        { name: "api", url: "http://api:8000/health", status: 200, ok: true },
        { name: "frontend", url: "https://hanasand.com/ti", status: 200, body: "ok" }
      ],
      publicProofs: livePublicProofs,
      apiSearchProofs
    });
    const resourceBudget = {
      hostRamGb: 1_024,
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      apiGb: 24,
      frontendGb: 8,
      postgresGb: 96,
      openSearchVectorGb: 160,
      graphGb: 96,
      objectStoreGb: 160,
      osCacheAndEmergencyGb: 192
    };
    const rehearsalInput: CutoverRehearsalInput = {
      deploymentDrift: deployment,
      randomActorQuery: "MuddyWater",
      agent09ApprovedFallbackRemoval: true,
      mainAgentDeployGateApproved: true,
      fallbackRollbackPath: "restore api/src/utils/ti/search.ts outer fallback",
      lastKnownGoodFallbackState: "outer fallback installed",
      resourceBudget,
      workstreams: [
        "source_readiness",
        "scheduler_readiness",
        "public_channel_readiness",
        "restricted_metadata_readiness",
        "evidence_readiness",
        "extraction_quality",
        "graph_readiness",
        "api_readiness"
      ].map((name, index) => ({
        name,
        owner: `Agent ${String(index + 1).padStart(2, "0")}`,
        status: "ready",
        proofCommand: `bun test src/tests/${name}.test.ts`,
        lastKnownGoodState: `${name}:ready`,
        rollbackPath: `${name}:keep outer fallback`
      })),
      livePublicProofs,
      apiSearchProofs
    };
    const rehearsal = evaluateCutoverRehearsal(rehearsalInput);
    const promotionPacket = buildCutoverPromotionPacket({
      rehearsal,
      deploymentDrift: deployment,
      agent09ApiReady: true,
      resourceBudget,
      leaderThreadContext: "Task S release decision",
      actions: [{
        id: "source.activate-approved-pack",
        workstream: "source_readiness",
        owner: "Agent 01",
        title: "Activate approved public source pack",
        classification: "automation-safe",
        applied: true,
        preconditions: ["source dry-run install passed"],
        expectedEffect: "approved idle sources become active",
        rollback: "restore previous source statuses",
        policyImpact: "public sources only",
        proofCommand: "bun test src/tests/sourceSeeds.test.ts"
      }],
      workstreams: rehearsalInput.workstreams,
      livePublicProofs: rehearsalInput.livePublicProofs,
      apiSearchProofs: rehearsalInput.apiSearchProofs,
      mountedRouteProofs: mountedRouteProofs(),
      generatedAt: "2026-05-24T06:30:02.420Z"
    });
    const soak = evaluateLiveSearchSoak({
      scenario: "success",
      durationHours: 24,
      publicQueryCount: 6,
      publicProofOk: true,
      scraperNativeProofOk: true,
      apiWrapperProofOk: true,
      sourceActivationDryRunOk: true,
      evidenceWriteReadOk: true,
      graphExportReadinessOk: true,
      publicApiCompatibilityOk: true,
      runReuseOk: true,
      cursorPollingOk: true,
      initialLatencyP95Ms: 700,
      partialLatencyP95Ms: 3_100,
      errorRatePercent: 0.2,
      duplicateActiveRuns: 0,
      sourceCoveragePercent: 92,
      queueAgeP95Seconds: 20,
      workerSaturationPercent: 45,
      cpuMaxPercent: 58,
      memoryRssMaxGb: 74,
      policyBlocks: 4,
      policyBlockRatePercent: 2,
      rejectedUnsafeActions: 0,
      unsafePolicyRetries: 0,
      restrictedKillSwitchActive: false,
      sourceUnavailableRatePercent: 1,
      staleCacheRatePercent: 1,
      fallbackUsed: false
    });
    const workstreams: CutoverSoakWorkstreamInput[] = [
      ["source_readiness", "Agent 01"],
      ["scheduler_readiness", "Agent 02"],
      ["clear_web_readiness", "Agent 03"],
      ["public_channel_readiness", "Agent 04"],
      ["restricted_metadata_readiness", "Agent 05"],
      ["evidence_readiness", "Agent 06"],
      ["extraction_quality", "Agent 07"],
      ["graph_readiness", "Agent 08"],
      ["api_readiness", "Agent 09"]
    ].map(([name, owner]) => ({
      name,
      owner,
      classification: "pass",
      proofCommand: `proof:${name}`,
      lastKnownGoodState: `${name}:ready`,
      rollbackPath: `${name}:rollback`
    }));
    const trends = {
      publicQueries: 6,
      runReuse: { duplicateActiveRuns: 0, ok: true },
      cursorPolling: { ok: true, partialToReady: 3 },
      sourceSlo: { minCoveragePercent: 92, deltaPercent: 4 },
      queuePressure: { p95Seconds: 20, deltaSeconds: -5 },
      resources: { memoryRssMaxGb: 74, cpuMaxPercent: 58 },
      unsafeRejections: { rejectedUnsafeActions: 0 },
      restrictedKillSwitch: { active: false },
      rollbackTriggers: []
    };
    const runtimeProofRows: Array<[CutoverRuntimeReleaseProof["name"], string, string]> = [
      ["activation_batches", "Agent 01", "bun run check:source-apply-plan"],
      ["source_runtime_sla", "Agent 01", "bun run check:source-apply-plan && bun test src/tests/sourceSeeds.test.ts"],
      ["queue_economics", "Agent 02", "bun run check:frontier-apply-plan"],
      ["scheduler_runtime_sla", "Agent 02", "bun run check:frontier-apply-plan && bun test src/tests/schedulerProduction.test.ts"],
      ["clear_web_blocker_status", "Agent 03", "bun test src/tests/adapterFixtures.test.ts"],
      ["public_channel_answer_readiness", "Agent 04", "bun test src/tests/telegramPublic.test.ts"],
      ["public_channel_sla", "Agent 04", "bun test src/tests/telegramPublic.test.ts && bun test src/tests/api.test.ts"],
      ["restricted_kill_switch", "Agent 05", "bun run check:restricted-metadata-apply-plan"],
      ["restricted_metadata_sla", "Agent 05", "bun run check:restricted-metadata-status && bun test src/tests/darknetMetadata.test.ts"],
      ["claim_ledger", "Agent 06", "bun test src/tests/storageCutover.test.ts"],
      ["claim_ledger_route_proof", "Agent 06", "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts"],
      ["answer_review_gates", "Agent 07", "bun test src/tests/pipeline.test.ts"],
      ["answer_readiness_sla", "Agent 07", "bun run check:search-quality-mounted && bun test src/tests/pipeline.test.ts"],
      ["graph_export_gates", "Agent 08", "bun run check:graph-review-mounted"],
      ["graph_export_sla", "Agent 08", "bun run check:graph-review-mounted && bun test src/tests/graphViews.test.ts"],
      ["api_cutover_proof", "Agent 09", "bun test src/tests/api.test.ts"],
      ["api_readiness_sla", "Agent 09", "bun run check:route-inventory && bun run check:scraper-native-search && bun test src/tests/api.test.ts"]
    ];
    const graphExportSla: GraphExportSlaDto = {
      endpoint: "agent10_release_packet",
      generatedAt: "2026-05-24T06:30:02.420Z",
        state: "hold",
      relationshipCount: 8,
      readyCount: 8,
      heldCount: 0,
      reviewRequiredCount: 0,
      buckets: [],
      publicAnswerImpact: "allow_graph_facts",
      stixImpact: "publish_ready_relationships",
      releasePacket: {
        owner: "Agent 08",
        proofCommand: "bun run check:graph-review-mounted",
        status: "pass",
        rollbackPath: "keep graph/STIX facts out of public promotion until export SLA is pass or reviewed warning"
      }
    };
    const graphExportEnforcement: GraphExportEnforcementDto = {
      endpoint: "agent10_release_packet",
      generatedAt: "2026-05-24T06:30:02.420Z",
      state: "pass",
      holdCount: 0,
      warningCount: 0,
      rollbackCount: 0,
      items: [],
      answerCaveats: [],
      releaseGate: {
        publicAnswers: "allow",
        stixPromotion: "allow",
        schemaSafe: true,
        ledgerComplete: true
      },
      releasePacket: {
        owner: "Agent 08",
        proofCommand: "bun run check:graph-review-mounted",
        status: "pass",
        rollbackPath: "keep graph/STIX relationships out of release promotion until enforcement holds are cleared"
      }
    };
    const publicChannelSla: TelegramPublicSlaReportDto = {
      generatedAt: "2026-05-24T06:30:02.420Z",
      status: "warning",
      enforcement: {
        status: "warning",
        releaseAction: "promote_with_warnings",
        checks: [{
          name: "ledger_backed_claim_yield",
          state: "warning",
          reason: "some candidate public-channel claims need stronger ledger support",
          value: 0.67,
          threshold: "pass >=0.8; warn <0.8; hold <0.5",
          answerImpact: "review_required"
        }],
        agent06LedgerHandoff: {
          state: "warning",
          ledgerBackedClaimCount: 2,
          candidateClaimCount: 3,
          ratio: 0.67
        },
        agent07AnswerReadiness: {
          state: "warning",
          claimStatus: "partial_evidence",
          analystReviewState: "queued",
          downgradeReasonCount: 1
        },
        agent10ReleasePacket: {
          runtimeProofName: "public_channel_sla",
          status: "warning",
          decisionImpact: "promote_with_warnings"
        }
      },
      releaseGate: {
        owner: "Agent 04",
        agent10ProofName: "public_channel_sla",
        decisionImpact: "promote_with_warnings",
        proofCommand: "bun test src/tests/telegramPublic.test.ts",
        rollbackPath: "keep public-channel collection in partial/read-only mode and leave outer fallback active",
        blockers: [],
        warnings: ["public_channel_ledger_backed_claim_yield_warning"]
      },
      metrics: {
        cursorFreshness: { averageScore: 1, staleSourceCount: 0 },
        collectionSuccess: { healthyOrWatchCount: 1, sourceCount: 1, ratio: 1 },
        rateLimitDebt: { delayedSourceCount: 0, averagePenalty: 0 },
        duplicateUrlPressure: { averageRatio: 0, highPressureSourceCount: 0 },
        editDeleteChurn: { averageRatio: 0, highChurnSourceCount: 0 },
        unavailableWindows: { averageRatio: 0, affectedSourceCount: 0 },
        languageTopicFit: { averageLanguageCoverage: 1, averageTopicFit: 1 },
        promotionYield: { averageRatio: 1, lowYieldSourceCount: 0 },
        ledgerBackedClaimYield: { ledgerBackedClaimCount: 2, candidateClaimCount: 3, ratio: 0.67 },
        answerReadinessImpact: { status: "partial", downgradeReasonCount: 1, partialEvidenceOnly: true }
      },
      controls: [],
      safeOutput: {
        rawPrivateDataExposed: false,
        rawMediaPayloadsExposed: false,
        credentialsExposed: false,
        mediaRetention: "metadata_only",
        piiMinimized: true
      }
    };
    const runtimeProofs: CutoverRuntimeReleaseProof[] = runtimeProofRows.map(([name, owner, proofCommand]) => ({
      name,
      owner,
      status: "pass",
      proofCommand,
      rollbackPath: `${name}:keep outer fallback`,
      lastKnownGoodState: `${name}:last-known-good`,
      resourceBudgetStatus: "ok",
      message: `${name} proof passed`,
      publicChannelSla: name === "public_channel_sla" ? publicChannelSla : undefined,
      graphExportSla: name === "graph_export_sla" ? graphExportSla : undefined,
      graphExportEnforcement: name === "graph_export_sla" ? graphExportEnforcement : undefined
    } satisfies CutoverRuntimeReleaseProof));
    const deploymentProofRows: Array<[CutoverDeploymentProofSlot["name"], string]> = [
      ["local_tests", "bun test"],
      ["remote_typecheck", "bun run check"],
      ["route_inventory", "bun run check:route-inventory"],
      ["contracts_route", "bun run check:route-inventory"],
      ["docker_image_test_enforcement", "bun run check:deploy-hygiene && bun run check:docker-contexts"],
      ["public_post_api_proof", "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof"],
      ["frontend_ti_query_proof", "bun run check:live-search-deploy"],
      ["memory_budget", "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot"],
      ["non_scraper_500gb_reserve", "bun run check:remote-drift"],
      ["restricted_emergency_stop", "bun run check:restricted-metadata-status && bun run check:restricted-metadata-apply-plan"],
      ["stray_root_advisory", "bun run check:remote-drift"]
    ];
    const deploymentProofs: CutoverDeploymentProofSlot[] = deploymentProofRows.map(([name, proofCommand]) => ({
      name,
      owner: "Agent 10",
      status: "pass",
      proofCommand,
      localCommand: proofCommand,
      remoteCommand: `ssh inspur 'cd /srv/hanasand/ti/scraper && ${proofCommand}'`,
      expectedOutput: `${name} proof passes`,
      rollbackPath: `${name}:keep outer fallback`,
      message: `${name} proof passed`
    } satisfies CutoverDeploymentProofSlot));
    const promote = buildCutoverSoakReleasePacket({
      generatedAt: "2026-05-24T06:30:02.420Z",
      soak,
      deploymentDrift: deployment,
      promotionPacket,
      workstreams,
      runtimeProofs,
      deploymentProofs,
      trends
    });
    const warning = buildCutoverSoakReleasePacket({
      soak,
      deploymentDrift: deployment,
      promotionPacket,
      workstreams: workstreams.map((workstream) => workstream.name === "clear_web_readiness"
        ? { ...workstream, classification: "warning", warning: "clear_web.status_stale" }
        : workstream),
      runtimeProofs,
      deploymentProofs,
      trends
    });
    const memoryWarning = buildCutoverSoakReleasePacket({
      soak,
      deploymentDrift: deployment,
      promotionPacket,
      workstreams,
      runtimeProofs,
      deploymentProofs,
      trends: {
        ...trends,
        resources: { ...trends.resources, memoryRssMaxGb: 120 }
      }
    });
    const blocker = buildCutoverSoakReleasePacket({
      soak,
      deploymentDrift: deployment,
      promotionPacket,
      workstreams: workstreams.map((workstream) => workstream.name === "api_readiness"
        ? { ...workstream, classification: "blocker", blocker: "api.public_post_proof_missing" }
        : workstream),
      runtimeProofs,
      deploymentProofs,
      trends
    });
    const runtimeBlocker = buildCutoverSoakReleasePacket({
      soak,
      deploymentDrift: deployment,
      promotionPacket,
      workstreams,
      runtimeProofs: runtimeProofs.map((proof) => proof.name === "claim_ledger_route_proof"
        ? { ...proof, status: "blocker", resourceBudgetStatus: "critical", message: "claim ledger route proof failed" }
        : proof),
      deploymentProofs,
      trends: {
        ...trends,
        resources: { ...trends.resources, memoryRssMaxGb: 170 }
      }
    });
    const emergencyStop = buildCutoverSoakReleasePacket({
      soak,
      deploymentDrift: deployment,
      promotionPacket,
      workstreams,
      runtimeProofs: runtimeProofs.map((proof) => proof.name === "restricted_kill_switch"
        ? { ...proof, status: "blocker", resourceBudgetStatus: "critical", message: "restricted kill switch is active" }
        : proof),
      deploymentProofs,
      trends: {
        ...trends,
        restrictedKillSwitch: { active: true },
        rollbackTriggers: ["restricted.kill_switch_state"]
      }
    });
    const continueSoak = buildCutoverSoakReleasePacket({
      soak: evaluateLiveSearchSoak({ ...soak.summary, scenario: "success", durationHours: 2, publicProofOk: true, scraperNativeProofOk: true, apiWrapperProofOk: true, sourceActivationDryRunOk: true, policyBlocks: 0, unsafePolicyRetries: 0, fallbackUsed: false }),
      deploymentDrift: deployment,
      promotionPacket,
      workstreams,
      runtimeProofs,
      deploymentProofs,
      trends
    });
    const defaultAgent03Blocker = buildCutoverSoakReleasePacket({
      soak,
      deploymentDrift: deployment,
      promotionPacket,
      workstreams,
      deploymentProofs,
      trends
    });
    const deploymentBlocker = buildCutoverSoakReleasePacket({
      soak,
      deploymentDrift: deployment,
      promotionPacket,
      workstreams,
      runtimeProofs,
      deploymentProofs: deploymentProofs.map((proof) => proof.name === "public_post_api_proof"
        ? { ...proof, status: "blocker", message: "public POST API proof failed" }
        : proof),
      trends
    });

    expect(promote.schemaVersion).toBe("ti.cutover.soak_release_packet.v1");
    expect(["promote", "promote-with-warnings"]).toContain(promote.decision);
    expect(promote.ok).toBe(true);
    expect(promote.runtimeProofs.map((proof) => proof.name)).toEqual([
      "activation_batches",
      "source_runtime_sla",
      "queue_economics",
      "scheduler_runtime_sla",
      "clear_web_blocker_status",
      "public_channel_answer_readiness",
      "public_channel_sla",
      "restricted_kill_switch",
      "restricted_metadata_sla",
      "claim_ledger",
      "claim_ledger_route_proof",
      "answer_review_gates",
      "answer_readiness_sla",
      "graph_export_gates",
      "graph_export_sla",
      "api_cutover_proof",
      "api_readiness_sla"
    ]);
    expect(promote.deploymentProofs.map((proof) => proof.name)).toEqual([
      "local_tests",
      "remote_typecheck",
      "route_inventory",
      "contracts_route",
      "docker_image_test_enforcement",
      "public_post_api_proof",
      "frontend_ti_query_proof",
      "memory_budget",
      "non_scraper_500gb_reserve",
      "restricted_emergency_stop",
      "stray_root_advisory"
    ]);
    expect(promote.releaseTrain.windowHours).toBe(24);
    expect(promote.releaseTrain.stages.map((stage) => stage.name)).toEqual([
      "local_proof",
      "remote_proof",
      "docker_and_route_inventory",
      "public_api_and_frontend_proof",
      "resource_and_queue_headroom",
      "source_and_channel_readiness",
      "safety_and_retention",
      "evidence_graph_api_holds",
      "release_decision"
    ]);
    expect(promote.releaseTrain.localProofCommands).toContain("bun test");
    expect(promote.releaseTrain.remoteProofCommands).toContain("ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check'");
    expect(promote.releaseTrain.publicProofCommands).toEqual([
      "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof",
      "bun run check:live-search-deploy"
    ]);
    expect(promote.releaseTrain.resourceGuardrails).toMatchObject({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      nonScraperReservedGb: 864,
      queueAgeP95Seconds: 20,
      memoryRssMaxGb: 74
    });
    expect(promote.releaseTrain.strayRootHandling).toBe("advisory_no_deletion");
    expect(promote.rcGate.schemaVersion).toBe("ti.release_candidate.gate_packet.v1");
    expect(["promote", "promote-with-warnings"]).toContain(promote.rcGate.decision);
    expect(promote.rcGate.routeInventoryCount).toBe(26);
    expect(promote.rcGate.routeInventoryExpectedMinimum).toBe(26);
    expect(promote.rcGate.proofSlots.map((slot) => slot.name)).toEqual([
      "local_proof",
      "remote_proof",
      "docker_image_build_test_enforcement",
      "route_inventory_count",
      "contracts_route",
      "public_post_api_proof",
      "frontend_ti_query_proof",
      "source_canary_readiness",
      "worker_slo_soak",
      "public_channel_canary",
      "restricted_certification",
      "evidence_cutover",
      "graph_export_certification",
      "memory_headroom",
      "non_scraper_500gb_reserve",
      "queue_pressure",
      "agent03_fail_closed",
      "stray_root_advisory"
    ]);
    expect(promote.rcGate.proofSlots.find((slot) => slot.name === "contracts_route")).toMatchObject({
      status: "pass",
      proofCommand: "bun run check:route-inventory"
    });
    expect(promote.rcGate.guardrails).toMatchObject({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      nonScraperReservedGb: 864,
      strayRootHandling: "advisory_no_deletion"
    });
    expect(promote.rcGate.rolloutRunbook).toContain("promote scraper-native path according to main-agent deploy approval");
    expect(promote.canaryExecution.schemaVersion).toBe("ti.canary_release.execution_packet.v1");
    expect(promote.canaryExecution.dryRun).toBe(true);
    expect(["canary-ready", "canary-with-warnings"]).toContain(promote.canaryExecution.decision);
    expect(promote.canaryExecution.operatorSignoff).toMatchObject({
      required: true,
      signedOff: false
    });
    expect(promote.canaryExecution.operatorSignoff.fields).toEqual([
      "main_agent_approval",
      "agent03_clear_web_current",
      "restricted_safety_ack",
      "rollback_target_ack",
      "resource_budget_ack"
    ]);
    expect(promote.canaryExecution.proof.map((proof) => proof.name)).toEqual([
      "source_activation_canary",
      "scheduler_soak_telemetry",
      "public_channel_promotion_canary",
      "restricted_kill_switch_drill",
      "evidence_persistence_certification",
      "public_answer_polling_contract",
      "graph_export_certification",
      "contracts_route",
      "public_post_api_proof",
      "frontend_ti_query_proof",
      "docker_image_test_enforcement",
      "route_inventory",
      "remote_drift",
      "memory_headroom",
      "non_scraper_500gb_reserve",
      "queue_pressure",
      "agent03_fail_closed",
      "stray_root_advisory"
    ]);
    expect(promote.canaryExecution.rollbackSteps).toContain("docker compose up -d ti-scraper api frontend --no-build");
    expect(promote.canaryExecution.strayRootHandling).toBe("advisory_no_deletion");
    expect(promote.rcBoard.schemaVersion).toBe("ti.final_rc.board.v1");
    expect(promote.rcBoard.dryRun).toBe(true);
    expect(["canary-ready", "canary-with-warnings", "promote-with-warnings"]).toContain(promote.rcBoard.decision);
    expect(promote.rcBoard.rcDecision).toBe(promote.rcGate.decision);
    expect(promote.rcBoard.canaryDecision).toBe(promote.canaryExecution.decision);
    expect(promote.rcBoard.gates.map((gate) => gate.name)).toEqual([
      "agent01_source_readiness",
      "agent02_scheduler_readiness",
      "agent03_clear_web_fail_closed",
      "agent04_public_channel_readiness",
      "agent05_restricted_safety",
      "agent06_evidence_readiness",
      "agent07_answer_quality",
      "agent08_graph_export_readiness",
      "agent09_api_readiness",
      "agent10_deployment_proof"
    ]);
    expect(promote.rcBoard.routeTruthAudit).toMatchObject({
      routeInventoryCount: 26,
      expectedMinimum: 26,
      contractsRouteStatus: "pass",
      proofCommand: "bun run check:route-inventory"
    });
    expect(promote.rcBoard.publicProofSlots).toMatchObject({
      publicPostApi: "pass",
      frontendTiQuery: "pass"
    });
    expect(promote.rcBoard.publicProofSlots.proofCommands).toEqual([
      "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof",
      "bun run check:live-search-deploy"
    ]);
    expect(promote.rcBoard.resourceHeadroom).toMatchObject({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      nonScraperReservedGb: 864,
      memoryRssMaxGb: 74,
      preserveCtiReserveGb: 500,
      status: "pass"
    });
    expect(promote.rcBoard.queuePressure).toMatchObject({
      p95Seconds: 20,
      status: "pass"
    });
    expect(promote.rcBoard.operatorSignoff).toMatchObject({
      required: true,
      signedOff: false
    });
    expect(promote.rcBoard.operatorSignoff.fields).toEqual([
      "main_agent_approval",
      "agent03_clear_web_current",
      "restricted_safety_ack",
      "rollback_target_ack",
      "resource_budget_ack",
      "public_proof_ack",
      "route_truth_ack"
    ]);
    expect(promote.rcBoard.proofCommands).toContain("bun test");
    expect(promote.rcBoard.proofCommands).toContain("bun run check");
    expect(promote.rcBoard.proofCommands).toContain("bun run check:route-inventory");
    expect(promote.rcBoard.proofCommands).toContain("bun run check:remote-drift");
    expect(promote.rcBoard.proofCommands).toContain("TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof");
    expect(promote.rcBoard.rollbackProcedures).toContain("docker compose up -d ti-scraper api frontend --no-build");
    expect(promote.rcBoard.strayRootHandling).toBe("advisory_no_deletion");
    expect(promote.productTiBoard.schemaVersion).toBe("ti.product_ti.release_board.v1");
    expect(promote.productTiBoard.dryRun).toBe(true);
    expect(["canary-ready", "canary-with-warnings", "promote-with-warnings", "promote"]).toContain(promote.productTiBoard.decision);
    expect(promote.productTiBoard.publicApiProofs.map((proof) => proof.query)).toEqual([
      "APT29",
      "APT42",
      "Turla",
      "Akira",
      "random_actor",
      "made_up_actor",
      "CVE-2024-3094"
    ]);
    expect(promote.productTiBoard.publicApiProofs.every((proof) => proof.status === "pass")).toBe(true);
    expect(promote.productTiBoard.frontendProof).toMatchObject({
      emptyPageNoDefaultApt29: "pass",
      queryPageLiveMarkers: "pass",
      proofCommand: "bun run check:live-search-deploy"
    });
    expect(promote.productTiBoard.pollingProof).toMatchObject({
      targetSeconds: 3,
      recommendedSeconds: 2,
      status: "pass"
    });
    expect(promote.productTiBoard.responsivePublicSearch).toEqual({
      noDefaultQuery: true,
      noDemoContent: true,
      honestFreshness: true,
      updatesWithoutRefresh: true,
      policyGatedSourcesDoNotBlockPublicEvidence: true
    });
    expect(promote.productTiBoard.scraperHealth.status).toBe("pass");
    expect(promote.productTiBoard.agentStatus.proofCommands).toContain("rg '^Status:' coordination_agent_03.md");
    expect(promote.productTiBoard.noLeakGuarantees.map((proof) => proof.name)).toEqual([
      "route_truth_no_raw_payload",
      "restricted_metadata_no_leak",
      "public_answer_no_demo_cache"
    ]);
    expect(promote.productTiBoard.resourceHeadroom).toMatchObject({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500
    });
    expect(promote.productTiBoard.routeTruthAudit.routeInventoryCount).toBe(26);
    expect(promote.productTiBoard.proofCommands).toContain("TI_PUBLIC_PROOF_ACTORS=APT42,Turla,Akira,RandomActor,MadeUpActor,CVE-2024-3094 TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof");
    expect(promote.productTiBoard.rollbackCommands).toContain("restore previous api/src/utils/ti/search.ts fallback path and redeploy hanasand_api");
    expect(promote.realTimeSearchBoard.schemaVersion).toBe("ti.realtime_search.release_board.v1");
    expect(promote.realTimeSearchBoard.dryRun).toBe(true);
    expect(["canary-ready", "canary-with-warnings", "promote-with-warnings", "promote"]).toContain(promote.realTimeSearchBoard.decision);
    expect(promote.realTimeSearchBoard.productTiDecision).toBe(promote.productTiBoard.decision);
    expect(promote.realTimeSearchBoard.pollingSlo).toMatchObject({
      firstResponseImmediate: true,
      targetPollSeconds: 3,
      recommendedPollSeconds: 3,
      sameRunReuse: true,
      cursorAdvancement: true,
      emptyDeltasAllowed: true,
      status: "pass"
    });
    expect(promote.realTimeSearchBoard.scenarioGates.map((gate) => gate.scenario)).toEqual(expect.arrayContaining([
      "immediate_first_response",
      "three_second_polling",
      "same_run_reuse",
      "cursor_advancement",
      "empty_deltas",
      "clear_web_capture_deltas",
      "public_channel_hint_deltas",
      "restricted_held_deltas",
      "graph_stix_deltas",
      "claim_ledger_holds",
      "contradiction_downgrades",
      "no_result_searching",
      "provider_unavailable",
      "scraper_unavailable",
      "queue_pressure",
      "stale_source_caveats",
      "low_confidence",
      "policy_block",
      "no_leak_output",
      "memory_budget",
      "worker_queue_headroom",
      "frontend_no_default",
      "public_post_compatibility",
      "remote_container_health"
    ]));
    expect(promote.realTimeSearchBoard.queryMatrix.map((entry) => entry.query)).toEqual([
      "APT29",
      "APT42",
      "Turla",
      "Volt Typhoon",
      "Scattered Spider",
      "Akira",
      "random_actor",
      "made_up_actor",
      "CVE-2024-3094",
      "malware_tool",
      "victim_ransomware",
      "country",
      "sector"
    ]);
    expect(promote.realTimeSearchBoard.queryMatrix.every((entry) => entry.status === "pass")).toBe(true);
    expect(promote.realTimeSearchBoard.integrations).toMatchObject({
      contractsRoute: "pass",
      intelSearchRoute: "pass",
      schedulerSlo: "pass",
      evidenceClaimLedger: "pass",
      answerDeltas: "pass",
      graphStixDeltas: "pass",
      publicWrapperProof: "pass"
    });
    expect(promote.realTimeSearchBoard.resourceHeadroom).toMatchObject({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500
    });
    expect(promote.realTimeSearchBoard.proofCommands).toContain("bun run check:contract-index");
    expect(promote.realTimeSearchBoard.proofCommands).toContain("bun run check:live-search-deploy");
    expect(promote.realTimeSearchBoard.rollbackCommands).toContain("pause real-time delta promotion and return Searching/queued-only public answers");
    expect(promote.observabilityDashboard.schemaVersion).toBe("ti.production_observability.dashboard.v1");
    expect(promote.observabilityDashboard.dryRun).toBe(true);
    expect(["ready", "watch"]).toContain(promote.observabilityDashboard.decision);
    expect(promote.observabilityDashboard.sloDashboard.windowHours).toBe(24);
    expect(promote.observabilityDashboard.sloDashboard.metrics.map((metric) => metric.name)).toEqual([
      "initial_latency_p95_ms",
      "partial_latency_p95_ms",
      "queue_age_p95_seconds",
      "worker_saturation_percent",
      "memory_rss_max_gb",
      "cpu_max_percent",
      "adapter_failure_rate_percent",
      "source_unavailable_rate_percent",
      "policy_block_rate_percent",
      "evidence_write_read_proof",
      "graph_export_readiness",
      "public_proof_matrix"
    ]);
    expect(promote.observabilityDashboard.sloDashboard.metrics.find((metric) => metric.name === "memory_rss_max_gb")).toMatchObject({
      value: 74,
      warnAt: 96,
      criticalAt: 160,
      status: "pass",
      alertName: "ti_scraper_memory_rss_high"
    });
    expect(promote.observabilityDashboard.soakAutomation).toMatchObject({
      cadenceSeconds: 60,
      durationHours: 24,
      checkpointsHours: [0, 6, 12, 18, 24],
      environment: {
        scraperTargetGb: 96,
        scraperCeilingGb: 160,
        preserveCtiReserveGb: 500,
        assumesGpu: false
      }
    });
    expect(promote.observabilityDashboard.soakAutomation.command).toContain("TI_SOAK_DURATION_MINUTES=1440");
    expect(promote.observabilityDashboard.publicProofMatrix.map((proof) => proof.query)).toEqual(queries);
    expect(promote.observabilityDashboard.publicProofMatrix.every((proof) => proof.status === "pass")).toBe(true);
    expect(promote.observabilityDashboard.enterpriseViews.lanes.map((lane) => lane.name)).toEqual([
      "queue_health",
      "source_health",
      "evidence_yield",
      "extraction_quality",
      "graph_review_holds",
      "api_latency",
      "public_polling_latency",
      "memory_disk_usage",
      "worker_saturation",
      "error_budget",
      "freshness_slo",
      "deployment_drift",
      "release_train_state"
    ]);
    expect(promote.observabilityDashboard.enterpriseViews.lanes.map((lane) => lane.alertName)).toEqual(expect.arrayContaining([
      "source_outage_wave",
      "parser_failure_spike",
      "queue_pressure",
      "public_wrapper_regression",
      "evidence_store_degradation",
      "graph_export_hold",
      "api_client_compatibility_drift",
      "memory_or_disk_pressure",
      "freshness_slo_breach",
      "release_train_hold"
    ]));
    expect(promote.observabilityDashboard.enterpriseViews.resourceBudget).toEqual({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    });
    expect(promote.observabilityDashboard.enterpriseViews.integrations).toMatchObject({
      agent01SourceGovernance: "pass",
      agent02Scheduler: "pass",
      agent03AdapterObservatory: "pass",
      agent04CoverageRadar: "pass",
      agent05RestrictedPlaybooks: "pass",
      agent06EvidenceLedger: "pass",
      agent07QualityGates: "pass",
      agent08GraphBackend: "pass",
      agent09ApiContracts: "pass"
    });
    expect(promote.observabilityDashboard.enterpriseViews.lanes.find((lane) => lane.name === "memory_disk_usage")).toMatchObject({
      warnAt: 96,
      criticalAt: 160,
      releaseImpact: "none",
      rollbackRecommendation: "stop browser workers, reduce concurrency, and preserve disk-first evidence"
    });
    expect(promote.observabilityDashboard.enterpriseViews.lanes.find((lane) => lane.name === "freshness_slo")).toMatchObject({
      status: "warning",
      releaseImpact: "watch",
      failureClassification: "freshness SLO breach"
    });
    expect(promote.observabilityDashboard.enterpriseViews.lanes.every((lane) => lane.noLeakExample.endsWith("only"))).toBe(true);
    expect(promote.observabilityDashboard.failureClassification.map((item) => item.name)).toEqual([
      "latency",
      "queue",
      "worker",
      "resource",
      "source",
      "policy",
      "evidence",
      "graph",
      "public_proof",
      "deployment",
      "restricted_safety"
    ]);
    expect(promote.observabilityDashboard.rollbackDecisionPacket.operatorRunbook).toContain("preserve 500 GB for the rest of CTI before increasing scraper capacity");
    expect(promote.observabilityDashboard.rollbackDecisionPacket.operatorRunbook).toContain("do not assume GPU availability for any worker lane");
    expect(promote.observabilityDashboard.proofCommands).toContain("bun run soak:production");
    expect(promote.observabilityDashboard.proofCommands).toContain("docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot");
    expect(promote.enterpriseReleaseTrain.schemaVersion).toBe("ti.enterprise_release_train.v1");
    expect(promote.enterpriseReleaseTrain.dryRun).toBe(true);
    expect(["canary-with-warnings", "promote-with-warnings", "promote"]).toContain(promote.enterpriseReleaseTrain.decision);
    expect(promote.enterpriseReleaseTrain.stages.map((stage) => stage.name)).toEqual([
      "local_contract_green",
      "route_inventory_green",
      "public_proof_matrix_green",
      "canary_ready",
      "canary_with_warnings",
      "promote_with_warnings",
      "promote",
      "rollback",
      "emergency_stop",
      "no_go"
    ]);
    expect(promote.enterpriseReleaseTrain.disasterRecovery.proofs.map((proof) => proof.name)).toEqual([
      "evidence_export_manifest",
      "claim_ledger_replay",
      "graph_export_replay",
      "source_registry_backup",
      "scheduler_queue_drain",
      "public_wrapper_rollback",
      "container_rollback"
    ]);
    expect(promote.enterpriseReleaseTrain.disasterRecovery.proofs.every((proof) => !proof.noLeakExample.includes("raw body"))).toBe(true);
    expect(promote.enterpriseReleaseTrain.disasterRecovery.rollbackCommands).toContain("restore previous public wrapper fallback and redeploy hanasand_api");
    expect(promote.enterpriseReleaseTrain.capacityPlan).toMatchObject({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      nonScraperReservedGb: 864,
      browserPool: "disabled_until_explicitly_allocated",
      assumesGpu: false,
      boundedCaches: true,
      diskFirstEvidence: true,
      status: "pass",
      workerCaps: {
        clearWebWorkers: 128,
        publicChannelWorkers: 8,
        restrictedMetadataWorkers: 4,
        browserWorkers: 0
      }
    });
    expect(promote.enterpriseReleaseTrain.dependencyHealth.map((health) => health.name)).toEqual([
      "scraper",
      "api",
      "frontend",
      "docker",
      "route_inventory",
      "contract_index",
      "public_proof_matrix",
      "source_freshness",
      "evidence_writes",
      "graph_export_holds",
      "restricted_metadata_safety",
      "queue_headroom"
    ]);
    expect(promote.enterpriseReleaseTrain.noLeakReleaseExamples).toContain("DR manifests use hashes, capture ids, ledger ids, and source ids; no raw bodies or credentials");
    expect(promote.enterpriseReleaseTrain.operatorRunbook).toContain("keep browser workers disabled and do not assume GPU capacity");
    expect(promote.enterpriseReleaseTrain.proofCommands).toContain("bun run check:contract-index");
    expect(promote.enterpriseReleaseTrain.proofCommands).toContain("bun run check:deploy-hygiene && bun run check:docker-contexts");
    expect(promote.capacitySimulation.schemaVersion).toBe("ti.capacity_cost_simulation.v1");
    expect(promote.capacitySimulation.dryRun).toBe(true);
    expect(promote.capacitySimulation.windowDays).toBe(30);
    expect(promote.capacitySimulation.resourceBudget).toEqual({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    });
    expect(promote.capacitySimulation.scenarios.map((scenario) => scenario.name)).toEqual([
      "baseline",
      "high_activity_actor_burst",
      "ransomware_victim_burst",
      "dark_metadata_60k_refresh",
      "source_atlas_10k_import",
      "index_replay_backfill",
      "source_outage_wave",
      "parser_failure_spike",
      "restricted_review_spike",
      "graph_export_backlog"
    ]);
    expect(promote.capacitySimulation.scenarios.map((scenario) => scenario.releaseDecision)).toEqual([
      "promote",
      "promote-with-warnings",
      "canary-with-warnings",
      "promote-with-warnings",
      "canary-with-warnings",
      "promote-with-warnings",
      "no-go",
      "no-go",
      "emergency-stop",
      "rollback"
    ]);
    expect(promote.capacitySimulation.scenarios.every((scenario) => scenario.forecast.memoryRssMaxGb <= 160)).toBe(true);
    expect(promote.capacitySimulation.scenarios.every((scenario) => scenario.forecast.ctiReserveAfterGb >= 500)).toBe(true);
    expect(promote.capacitySimulation.scenarios.every((scenario) => scenario.noLeakExample.includes("aggregate GB"))).toBe(true);
    expect(promote.capacitySimulation.hostBudget).toEqual({
      hostRamGb: 1024,
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      ctiReserveGb: 500,
      osCacheAndEmergencyGb: 364,
      allocatableScraperBurstGb: 64,
      approvalRequiredAboveGb: 160
    });
    expect(promote.capacitySimulation.workerPartitions.map((partition) => partition.name)).toEqual([
      "interactive_live_search",
      "public_collection",
      "public_channel",
      "restricted_metadata",
      "dark_web_metadata_index",
      "source_atlas_import",
      "evidence_index_replay",
      "graph_export",
      "retention_backup"
    ]);
    expect(promote.capacitySimulation.workerPartitions.every((partition) =>
      partition.memoryReservationGb <= partition.memoryCeilingGb
      && partition.memoryCeilingGb <= 48
      && partition.throttle.length > 0
      && partition.queuePartition.length > 0
    )).toBe(true);
    expect(promote.capacitySimulation.sideToolForecasts).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "dark_web_metadata_index", recordTarget: 60_000, monthlyRecords: 60_000, memoryCeilingGb: 24 }),
      expect.objectContaining({ name: "source_atlas_discovery_import", recordTarget: 10_000, monthlyRecords: 10_000, memoryCeilingGb: 18 })
    ]));
    expect(promote.capacitySimulation.sideToolForecasts.every((forecast) =>
      forecast.releaseGate === "hold"
      && forecast.starvationGuard.includes("public search")
      && forecast.diskGrowthGb > 0
      && forecast.retryDeadLetterBudget > 0
    )).toBe(true);
    expect(promote.capacitySimulation.indexReplayBudget).toMatchObject({
      replayWindowDays: 30,
      maxReplayBatchesPerDay: 24,
      maxReplayMemoryGb: 22,
      queuePartition: "evidence_index_replay"
    });
    expect(promote.capacitySimulation.indexReplayBudget.noLeakProof).toContain("aggregate GB only");
    expect(promote.capacitySimulation.monthlyCostProxy).toMatchObject({
      currency: "capacity_units",
      highestCostScenario: "dark_metadata_60k_refresh"
    });
    expect(promote.capacitySimulation.monthlyCostProxy.totalUnits).toBe(
      promote.capacitySimulation.monthlyCostProxy.computeUnits
      + promote.capacitySimulation.monthlyCostProxy.storageUnits
      + promote.capacitySimulation.monthlyCostProxy.operatorReviewUnits
    );
    expect(promote.capacitySimulation.aggregate).toMatchObject({
      worstDecision: "emergency-stop",
      releaseReadyScenarioCount: 6,
      rollbackScenarioCount: 1,
      emergencyStopScenarioCount: 1
    });
    expect(promote.capacitySimulation.aggregate.memoryPeakGb).toBeLessThanOrEqual(160);
    expect(promote.capacitySimulation.aggregate.ctiReserveMinimumGb).toBeGreaterThanOrEqual(500);
    expect(promote.capacitySimulation.proofCommands).toContain("bun run check:route-inventory");
    expect(promote.capacitySimulation.proofCommands).toContain("bun run check:deploy-hygiene");
    expect(promote.capacitySimulation.proofCommands).toContain("bun run check:docker-contexts");
    expect(promote.capacitySimulation.proofCommands).toContain("bun run check:contract-index");
    expect(promote.capacitySimulation.operatorRunbook).toContain("treat 96 GB as warning target and 160 GB as rollback ceiling");
    expect(promote.capacitySimulation.operatorRunbook).toContain("keep 60k dark-web metadata refresh and 10k source-atlas import in separate partitions that yield to public search");
    expect(promote.incidentRunbooks.schemaVersion).toBe("ti.production_incident_runbooks.v1");
    expect(promote.incidentRunbooks.dryRun).toBe(true);
    expect(promote.incidentRunbooks.resourceBudget).toEqual({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    });
    expect(promote.incidentRunbooks.runbooks.map((runbook) => runbook.name)).toEqual([
      "public_proof_failure",
      "queue_saturation",
      "source_outage_wave",
      "parser_failure_spike",
      "evidence_store_degradation",
      "restricted_metadata_emergency_stop",
      "api_wrapper_regression",
      "graph_export_corruption",
      "canary_rollback",
      "container_rollback",
      "multi_service_health_degradation"
    ]);
    expect(promote.incidentRunbooks.integrations).toEqual({
      agent01SourceGovernance: "wired",
      agent02SchedulerFairness: "wired",
      agent03Adapters: "wired",
      agent04PublicCoverage: "wired",
      agent05RestrictedPlaybooks: "wired",
      agent06EvidenceDr: "wired",
      agent07QualityWorkbench: "wired",
      agent08GraphGovernance: "wired",
      agent09ApiCompatibility: "wired",
      agent10ReleaseOps: "wired"
    });
    expect(promote.incidentRunbooks.runbooks.every((runbook) =>
      runbook.trigger.length > 0
      && runbook.detectionFields.length > 0
      && runbook.expectedRouteApiProof.length > 0
      && runbook.noLeakGuarantees.every((guarantee) => !guarantee.includes("raw leaked data") || guarantee.includes("do not"))
    )).toBe(true);
    expect(promote.incidentRunbooks.runbooks.find((runbook) => runbook.name === "restricted_metadata_emergency_stop")).toMatchObject({
      releaseDecisionImpact: "emergency-stop",
      owningSubsystem: "Agent 05 restricted metadata playbooks"
    });
    expect(promote.incidentRunbooks.runbooks.find((runbook) => runbook.name === "public_proof_failure")?.expectedRouteApiProof.map((proof) => proof.surface)).toContain("public POST /api/ti/search");
    expect(promote.incidentRunbooks.runbooks.find((runbook) => runbook.name === "queue_saturation")?.expectedRouteApiProof.map((proof) => proof.surface)).toContain("/v1/frontier/status");
    expect(promote.incidentRunbooks.runbooks.find((runbook) => runbook.name === "container_rollback")?.rollback).toBe("docker compose up -d ti-scraper api frontend --no-build");
    expect(promote.incidentRunbooks.releaseDecisionCounts).toMatchObject({
      "no-go": 4,
      "rollback": 6,
      "emergency-stop": 1
    });
    expect(promote.incidentRunbooks.proofCommands).toContain("bun run check:route-inventory");
    expect(promote.incidentRunbooks.proofCommands).toContain("bun run check:contract-index");
    expect(promote.incidentRunbooks.proofCommands).toContain("bun run check:docker-contexts");
    expect(promote.incidentRunbooks.operatorRunbook).toContain("keep scraper under 96 GB target and treat 160 GB as rollback ceiling");
    expect(promote.incidentSimulationPostmortems.schemaVersion).toBe("ti.production_incident_simulation_postmortem.v1");
    expect(promote.incidentSimulationPostmortems.dryRun).toBe(true);
    expect(promote.incidentSimulationPostmortems.resourcePolicy).toEqual({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    });
    expect(promote.incidentSimulationPostmortems.simulations.map((simulation) => simulation.name)).toEqual([
      "queue_saturation",
      "source_outage_wave",
      "parser_failure_spike",
      "evidence_object_degradation",
      "graph_export_corruption",
      "api_gateway_misrouting",
      "public_proof_failure",
      "canary_rollback",
      "restricted_emergency_stop",
      "memory_disk_pressure"
    ]);
    expect(promote.incidentSimulationPostmortems.simulations.every((simulation) =>
      simulation.timeline.map((event) => event.phase).join(",") === "detect,triage,mitigate,rollback,verify,postmortem"
      && simulation.detectionSignals.length > 0
      && simulation.ownerAgents.length > 0
      && simulation.rollbackAction.length > 0
      && simulation.proofCommand.length > 0
      && simulation.postmortemFields.map((field) => field.field).join(",") === "summary,customer_impact,root_cause,detection_gap,rollback_result,follow_up"
      && simulation.safetyPosture.metadataOnly
      && simulation.safetyPosture.noRawLeakMaterial
      && simulation.safetyPosture.noCredentials
      && simulation.safetyPosture.noUnsafeUrls
      && simulation.safetyPosture.noActorInteraction
      && simulation.safetyPosture.browserWorkersDisabled
      && !simulation.noLeakProof.includes("raw bodies included")
    )).toBe(true);
    expect(promote.incidentSimulationPostmortems.simulations.find((simulation) => simulation.name === "api_gateway_misrouting")).toMatchObject({
      releaseGateOutcome: "rollback-only",
      blastRadius: {
        publicTiState: "degraded",
        affectedAgents: ["Agent 09", "Agent 10"],
        dataIntegrity: "preserved"
      }
    });
    expect(promote.incidentSimulationPostmortems.simulations.find((simulation) => simulation.name === "restricted_emergency_stop")).toMatchObject({
      releaseGateOutcome: "needs-human-approval",
      userVisibleDegradation: "restricted results remain metadata_review or blocked with safe victim/company/count summaries only"
    });
    expect(promote.incidentSimulationPostmortems.simulations.find((simulation) => simulation.name === "memory_disk_pressure")).toMatchObject({
      releaseGateOutcome: "promote",
      proofCommand: "bun test src/tests/ops.test.ts"
    });
    expect(memoryWarning.incidentSimulationPostmortems.simulations.find((simulation) => simulation.name === "memory_disk_pressure")).toMatchObject({
      releaseGateOutcome: "hold",
      blastRadius: {
        dataIntegrity: "preserved"
      }
    });
    expect(runtimeBlocker.incidentSimulationPostmortems.simulations.find((simulation) => simulation.name === "memory_disk_pressure")).toMatchObject({
      releaseGateOutcome: "rollback-only",
      blastRadius: {
        dataIntegrity: "at_risk"
      }
    });
    expect(promote.incidentSimulationPostmortems.ownerMatrix.find((entry) => entry.owner === "Agent 02")?.scenarios).toContain("queue_saturation");
    expect(promote.incidentSimulationPostmortems.ownerMatrix.find((entry) => entry.owner === "Agent 06")?.scenarios).toContain("evidence_object_degradation");
    expect(promote.incidentSimulationPostmortems.ownerMatrix.find((entry) => entry.owner === "Agent 08")?.scenarios).toContain("graph_export_corruption");
    expect(promote.incidentSimulationPostmortems.ownerMatrix.find((entry) => entry.owner === "Agent 09")?.scenarios).toContain("api_gateway_misrouting");
    expect(promote.incidentSimulationPostmortems.releaseGateCounts["rollback-only"]).toBeGreaterThanOrEqual(4);
    expect(promote.incidentSimulationPostmortems.releaseGateCounts["needs-human-approval"]).toBeGreaterThanOrEqual(1);
    expect(promote.incidentSimulationPostmortems.proofCommands).toContain("bun run check:ti-release-candidate");
    expect(promote.incidentSimulationPostmortems.proofCommands).toContain("TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof");
    expect(promote.incidentSimulationPostmortems.operatorRunbook).toContain("keep the scraper under 96 GB target, never exceed the 160 GB ceiling, and preserve 500 GB for the broader CTI stack");
    expect(promote.resourceArbitration.schemaVersion).toBe("ti.multi_service_resource_arbitration.v1");
    expect(promote.resourceArbitration.dryRun).toBe(true);
    expect(promote.resourceArbitration.hostPolicy).toEqual({
      hostMemoryGb: 1024,
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    });
    expect(promote.resourceArbitration.lanes.map((lane) => lane.name)).toEqual([
      "collection_workers",
      "public_channel_workers",
      "dynamic_browser_disabled_pool",
      "evidence_replay",
      "graph_search_migration",
      "queue_backend",
      "api_live_search_load"
    ]);
    expect(promote.resourceArbitration.gates.map((gate) => gate.name)).toEqual([
      "over_capacity",
      "memory_pressure",
      "disk_pressure",
      "queue_saturation",
      "source_outage_wave",
      "parser_failure_spike",
      "public_proof_failure",
      "restricted_emergency_stop",
      "remote_deploy_drift"
    ]);
    expect(promote.resourceArbitration.summary.scraperReservedGb).toBeLessThanOrEqual(96);
    expect(promote.resourceArbitration.summary.scraperCeilingGb).toBe(160);
    expect(promote.resourceArbitration.summary.ctiReserveAfterForecastGb).toBeGreaterThanOrEqual(500);
    expect(promote.resourceArbitration.lanes.find((lane) => lane.name === "dynamic_browser_disabled_pool")).toMatchObject({
      memoryReservationGb: 0,
      memoryCeilingGb: 0,
      concurrencyLimit: 0,
      status: "pass"
    });
    expect(promote.resourceArbitration.lanes.every((lane) =>
      lane.memoryReservationGb <= lane.memoryCeilingGb
      && lane.proofCommand.length > 0
      && lane.throttles.length > 0
      && lane.handoff.includes("Agent")
    )).toBe(true);
    expect(promote.resourceArbitration.gates.find((gate) => gate.name === "memory_pressure")).toMatchObject({
      status: "pass",
      releaseDecision: "promote",
      threshold: "target <=96 GB, ceiling <=160 GB"
    });
    expect(memoryWarning.resourceArbitration.gates.find((gate) => gate.name === "memory_pressure")).toMatchObject({
      status: "warning",
      releaseDecision: "hold"
    });
    expect(runtimeBlocker.resourceArbitration.gates.find((gate) => gate.name === "memory_pressure")).toMatchObject({
      status: "blocker",
      releaseDecision: "rollback-only"
    });
    expect(deploymentBlocker.resourceArbitration.gates.find((gate) => gate.name === "public_proof_failure")).toMatchObject({
      status: "blocker",
      releaseDecision: "rollback-only"
    });
    expect(emergencyStop.resourceArbitration.gates.find((gate) => gate.name === "restricted_emergency_stop")).toMatchObject({
      status: "blocker",
      releaseDecision: "needs-human-approval"
    });
    expect(promote.resourceArbitration.ownerHandoffs.find((handoff) => handoff.owner === "Agent 02")?.lanes).toContain("queue_backend");
    expect(promote.resourceArbitration.ownerHandoffs.find((handoff) => handoff.owner === "Agent 06")?.lanes).toContain("evidence_replay");
    expect(promote.resourceArbitration.ownerHandoffs.find((handoff) => handoff.owner === "Agent 09")?.gates).toContain("public_proof_failure");
    expect(promote.resourceArbitration.proofCommands).toContain("bun run check:ti-release-candidate");
    expect(promote.resourceArbitration.proofCommands).toContain("bun run check:contract-index");
    expect(promote.resourceArbitration.operatorRunbook).toContain("keep dynamic browser workers disabled by default and assume no GPU capacity");
    expect(promote.resourceArbitration.noLeakProof).not.toContain("raw bodies included");
    expect(promote.productionSoakDecisionBoard.schemaVersion).toBe("ti.production_soak_decision_board.v1");
    expect(promote.productionSoakDecisionBoard.dryRun).toBe(true);
    expect(["promote", "hold"]).toContain(promote.productionSoakDecisionBoard.decision);
    expect(promote.productionSoakDecisionBoard.resourcePolicy).toEqual({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    });
    expect(promote.productionSoakDecisionBoard.signals.map((signal) => signal.name)).toEqual([
      "scheduler_queue_leases_dead_letters",
      "source_activation_health",
      "adapter_parser_failure_spikes",
      "evidence_object_index_replay_integrity",
      "restricted_emergency_stop",
      "quality_release_gates",
      "graph_stix_holds",
      "api_contract_drift",
      "public_wrapper_proofs",
      "memory_disk_pressure",
      "deploy_hygiene"
    ]);
    expect(promote.productionSoakDecisionBoard.sideToolResourceBudgets).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "dark_web_metadata_index", owner: "Agent 05/10", recordTarget: 60_000, memoryCeilingGb: 24 }),
      expect.objectContaining({ name: "source_atlas_discovery_import", owner: "Agent 01/10", recordTarget: 10_000, memoryCeilingGb: 18 })
    ]));
    expect(promote.productionSoakDecisionBoard.sideToolReleaseGates.map((gate) => gate.name)).toEqual([
      "unsafe_dark_web_target_attempt",
      "raw_url_leakage",
      "credential_payload_pattern",
      "legal_review_overflow",
      "source_atlas_auto_activation_mistake",
      "source_discovery_flood"
    ]);
    expect(promote.productionSoakDecisionBoard.scenarioFixtures.map((scenario) => scenario.name)).toEqual([
      "dark_metadata_60k_refresh",
      "source_atlas_10k_import",
      "source_outage_wave",
      "parser_failure_storm",
      "queue_runaway",
      "object_store_failure",
      "api_deploy_mismatch",
      "restricted_safety_event",
      "stale_actor_answer_regression",
      "unknown_actor_false_ready_regression",
      "graph_export_hold"
    ]);
    expect(promote.productionSoakDecisionBoard.scenarioFixtures.find((scenario) => scenario.name === "unknown_actor_false_ready_regression")).toMatchObject({
      expectedDecision: "rollback",
      ownerHandoff: "Agent 07/09/10"
    });
    expect(promote.productionSoakDecisionBoard.signals.every((signal) =>
      signal.evidence.length > 0 && signal.proofCommand.length > 0 && signal.rollbackStep.length > 0 && signal.staleAfterMinutes > 0
    )).toBe(true);
    expect(promote.productionSoakDecisionBoard.ownerHandoffs.find((handoff) => handoff.owner === "Agent 10")?.signals).toContain("memory_disk_pressure");
    expect(promote.productionSoakDecisionBoard.proofCommands).toContain("bun run check:ti-release-candidate");
    expect(promote.productionSoakDecisionBoard.proofCommands).toContain("bun run check:deploy-hygiene");
    expect(promote.productionSoakDecisionBoard.operatorRunbook).toContain("enforce 96 GB normal scraper target, 160 GB ceiling, 500 GB CTI reserve, browser-disabled default, bounded caches, disk-first evidence, and no GPU assumption");
    expect(promote.productionSoakDecisionBoard.noLeakProof).not.toContain("raw evidence bodies included");
    expect(memoryWarning.productionSoakDecisionBoard.signals.find((signal) => signal.name === "memory_disk_pressure")).toMatchObject({
      status: "warning",
      decisionImpact: "hold"
    });
    expect(runtimeBlocker.productionSoakDecisionBoard.signals.find((signal) => signal.name === "memory_disk_pressure")).toMatchObject({
      status: "blocker",
      decisionImpact: "rollback"
    });
    expect(deploymentBlocker.productionSoakDecisionBoard.signals.find((signal) => signal.name === "public_wrapper_proofs")).toMatchObject({
      status: "blocker",
      decisionImpact: "rollback"
    });
    expect(emergencyStop.productionSoakDecisionBoard.decision).toBe("needs-human-approval");
    expect(continueSoak.productionSoakDecisionBoard.staleSignals.length).toBeGreaterThan(0);
    expect(promote.onCallRunbookPack.schemaVersion).toBe("ti.on_call_runbook_pack.v1");
    expect(promote.onCallRunbookPack.dryRun).toBe(true);
    expect(promote.onCallRunbookPack.resourcePolicy).toEqual({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    });
    expect(promote.onCallRunbookPack.decisionStates).toEqual([
      "promote",
      "hold",
      "rollback",
      "pause_side_tool",
      "drain_partition",
      "emergency_stop_restricted",
      "require_human_review",
      "defer_background_work"
    ]);
    expect(promote.onCallRunbookPack.procedures.map((procedure) => procedure.name)).toEqual([
      "deploy_release",
      "rollback_release",
      "pause_source_atlas_import",
      "pause_dark_web_metadata_refresh",
      "emergency_stop_restricted_collectors",
      "drain_queue_partitions",
      "restore_public_ti_responsiveness"
    ]);
    expect(promote.onCallRunbookPack.incidentPlaybooks.map((playbook) => playbook.name)).toEqual([
      "unsafe_url_exposure",
      "credential_payload_fetch_attempt_blocked",
      "dangerous_collector_compromise_assumption",
      "quarantine_overflow",
      "evidence_object_corruption",
      "route_contract_drift",
      "stale_answer_regression",
      "unknown_query_false_ready_regression",
      "host_resource_pressure"
    ]);
    expect(promote.onCallRunbookPack.procedures.find((procedure) => procedure.name === "pause_source_atlas_import")).toMatchObject({
      decisionState: "pause_side_tool",
      queuePartitions: ["source_atlas_import"],
      rollbackOrResume: "resume after no auto-activation, no flood, and public search p95 proof is green"
    });
    expect(promote.onCallRunbookPack.procedures.find((procedure) => procedure.name === "pause_dark_web_metadata_refresh")).toMatchObject({
      decisionState: "pause_side_tool",
      queuePartitions: ["dark_web_metadata_index", "restricted_metadata"]
    });
    expect(promote.onCallRunbookPack.procedures.find((procedure) => procedure.name === "emergency_stop_restricted_collectors")).toMatchObject({
      decisionState: "emergency_stop_restricted",
      queuePartitions: ["restricted_metadata", "dark_web_metadata_index"]
    });
    expect(promote.onCallRunbookPack.procedures.find((procedure) => procedure.name === "drain_queue_partitions")?.queuePartitions).toEqual(expect.arrayContaining([
      "source_atlas_import",
      "dark_web_metadata_index",
      "evidence_index_replay",
      "graph_export",
      "retention_backup"
    ]));
    expect(promote.onCallRunbookPack.incidentPlaybooks.find((playbook) => playbook.name === "unsafe_url_exposure")).toMatchObject({
      decisionState: "emergency_stop_restricted",
      severity: "emergency",
      publicTiMode: "metadata_review"
    });
    expect(promote.onCallRunbookPack.incidentPlaybooks.find((playbook) => playbook.name === "unknown_query_false_ready_regression")).toMatchObject({
      decisionState: "rollback",
      publicTiMode: "searching"
    });
    expect(memoryWarning.onCallRunbookPack.incidentPlaybooks.find((playbook) => playbook.name === "host_resource_pressure")).toMatchObject({
      decisionState: "defer_background_work",
      severity: "hold"
    });
    expect(runtimeBlocker.onCallRunbookPack.incidentPlaybooks.find((playbook) => playbook.name === "host_resource_pressure")).toMatchObject({
      decisionState: "rollback",
      severity: "rollback"
    });
    expect(promote.onCallRunbookPack.sideToolSafeguards).toEqual(expect.arrayContaining([
      expect.objectContaining({ tool: "dark_web_metadata_index", pauseState: "pause_side_tool", queuePartition: "dark_web_metadata_index", maxMemoryGb: 24 }),
      expect.objectContaining({ tool: "source_atlas_discovery_import", pauseState: "pause_side_tool", queuePartition: "source_atlas_import", maxMemoryGb: 18 }),
      expect.objectContaining({ tool: "evidence_index_replay", pauseState: "defer_background_work", queuePartition: "evidence_index_replay", maxMemoryGb: 22 })
    ]));
    expect(promote.onCallRunbookPack.sideToolSafeguards.every((safeguard) =>
      safeguard.yieldTo.includes("interactive_live_search")
      && safeguard.resumeGate.length > 0
    )).toBe(true);
    expect(promote.onCallRunbookPack.publicResponsiveness).toMatchObject({
      targetFirstResponseSeconds: 3,
      pollSeconds: 3,
      restoreDecisionState: "defer_background_work"
    });
    expect(promote.onCallRunbookPack.integrations).toEqual({
      capacitySimulation: "wired",
      incidentRunbooks: "wired",
      resourceArbitration: "wired",
      productionSoakDecisionBoard: "wired",
      releaseArtifactBundle: "wired"
    });
    expect(promote.onCallRunbookPack.proofCommands).toContain("bun test src/tests/ops.test.ts src/tests/api.test.ts src/tests/schedulerProduction.test.ts");
    expect(promote.onCallRunbookPack.proofCommands).toContain("bun run check:ti-release-candidate");
    expect(promote.onCallRunbookPack.operatorRunbook).toContain("when public /ti responsiveness is at risk, defer background work before reducing interactive search");
    expect(JSON.stringify(promote.onCallRunbookPack)).not.toContain("object_key");
    expect(JSON.stringify(promote.onCallRunbookPack)).not.toContain("payload://");
    expect(promote.releaseTrainHardening.schemaVersion).toBe("ti.release_train_hardening.v1");
    expect(promote.releaseTrainHardening.dryRun).toBe(true);
    expect(["promote", "hold"]).toContain(promote.releaseTrainHardening.decision);
    expect(promote.releaseTrainHardening.resourcePolicy).toEqual({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    });
    expect(promote.releaseTrainHardening.signals.map((signal) => signal.name)).toEqual([
      "seven_day_public_ti_soak",
      "thirty_day_capacity_forecast",
      "deploy_mismatch_detection",
      "image_version_pinning",
      "migration_readiness",
      "remote_proof_commands",
      "public_api_wrapper_rollback",
      "scraper_backend_rollback"
    ]);
    expect(promote.releaseTrainHardening.soakWindows).toEqual([
      expect.objectContaining({
        window: "7_day",
        requiredSignals: ["seven_day_public_ti_soak", "deploy_mismatch_detection", "public_api_wrapper_rollback"],
        proofCommand: "bun run soak:production"
      }),
      expect.objectContaining({
        window: "30_day",
        requiredSignals: ["thirty_day_capacity_forecast", "image_version_pinning", "migration_readiness", "scraper_backend_rollback"],
        proofCommand: "bun test src/tests/ops.test.ts"
      })
    ]);
    expect(promote.releaseTrainHardening.deployMismatchDetectors.map((detector) => detector.name)).toEqual([
      "scraper_image",
      "public_api_wrapper_image",
      "frontend_ti_image",
      "route_contract",
      "public_wrapper_semantics"
    ]);
    expect(promote.releaseTrainHardening.imageVersionPins.map((pin) => pin.service)).toEqual([
      "scraper",
      "public_api_wrapper",
      "frontend_ti",
      "postgres_source_registry",
      "queue_backend"
    ]);
    expect(promote.releaseTrainHardening.migrationReadiness.map((migration) => migration.migration)).toEqual([
      "source_registry",
      "analyst_loop",
      "evidence_search",
      "graph_backend",
      "queue_backend"
    ]);
    expect(promote.releaseTrainHardening.migrationReadiness.every((migration) =>
      migration.dryRunOnly === true && migration.proofCommand.length > 0 && migration.rollbackAction.length > 0
    )).toBe(true);
    expect(promote.releaseTrainHardening.rollbackCriteria.find((criteria) => criteria.target === "public_api_wrapper")?.criteria).toEqual(expect.arrayContaining([
      "public /ti or POST /api/ti/search proof fails",
      "unknown query returns ready instead of Searching/queued/metadata_review",
      "route inventory or contract index drifts"
    ]));
    expect(promote.releaseTrainHardening.rollbackCriteria.find((criteria) => criteria.target === "scraper_backend")?.criteria).toEqual(expect.arrayContaining([
      "RSS reaches or exceeds 160 GB",
      "queue runaway blocks interactive search",
      "release candidate no-leak proof fails"
    ]));
    expect(promote.releaseTrainHardening.remoteProofCommands).toContain("ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:ti-release-candidate'");
    expect(promote.releaseTrainHardening.integrations).toEqual({
      releaseArtifactBundle: "wired",
      productionSoakDecisionBoard: "wired",
      onCallRunbookPack: "wired",
      resourceArbitration: "wired",
      capacitySimulation: "wired"
    });
    expect(promote.releaseTrainHardening.proofCommands).toContain("bun run check:remote-drift");
    expect(promote.releaseTrainHardening.proofCommands).toContain("TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof");
    expect(promote.releaseTrainHardening.operatorRunbook).toContain("rollback the public API wrapper before the scraper when only wrapper semantics drift");
    expect(deploymentBlocker.releaseTrainHardening.signals.find((signal) => signal.name === "deploy_mismatch_detection")).toMatchObject({
      status: "blocker",
      decisionImpact: "rollback"
    });
    expect(deploymentBlocker.releaseTrainHardening.signals.find((signal) => signal.name === "public_api_wrapper_rollback")).toMatchObject({
      status: "blocker",
      decisionImpact: "rollback"
    });
    expect(memoryWarning.releaseTrainHardening.signals.find((signal) => signal.name === "thirty_day_capacity_forecast")).toMatchObject({
      status: "warning",
      decisionImpact: "hold"
    });
    expect(runtimeBlocker.releaseTrainHardening.signals.find((signal) => signal.name === "scraper_backend_rollback")).toMatchObject({
      status: "blocker",
      decisionImpact: "rollback"
    });
    expect(emergencyStop.releaseTrainHardening.decision).toBe("needs-human-approval");
    expect(JSON.stringify(promote.releaseTrainHardening)).not.toContain("object_key");
    expect(JSON.stringify(promote.releaseTrainHardening)).not.toContain("payload://");
    expect(promote.valueProgramOpsSoak.schemaVersion).toBe("ti.value_program.ops_soak.v1");
    expect(promote.valueProgramOpsSoak.dryRun).toBe(true);
    expect(["promote", "hold"]).toContain(promote.valueProgramOpsSoak.decision);
    expect(promote.valueProgramOpsSoak.resourcePolicy).toEqual({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    });
    expect(promote.valueProgramOpsSoak.sideToolBudgets.map((budget) => budget.tool)).toEqual([
      "dark_web_metadata_index",
      "source_atlas_discovery_import"
    ]);
    expect(promote.valueProgramOpsSoak.sideToolBudgets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tool: "dark_web_metadata_index",
        recordTarget: 60_000,
        memoryCeilingGb: 24,
        refreshCadence: "daily_high_value_weekly_default"
      }),
      expect.objectContaining({
        tool: "source_atlas_discovery_import",
        recordTarget: 10_000,
        memoryCeilingGb: 18,
        refreshCadence: "weekly_import_monthly_full_rescore"
      })
    ]));
    expect(promote.valueProgramOpsSoak.sideToolBudgets.every((budget) =>
      budget.yieldsTo.includes("interactive_live_search") && budget.memoryCeilingGb <= 24
    )).toBe(true);
    expect(promote.valueProgramOpsSoak.refreshSoak).toMatchObject({
      windowHours: 24,
      checkpointsHours: [1, 6, 12, 24]
    });
    expect(promote.valueProgramOpsSoak.refreshSoak.gates.map((gate) => gate.name)).toEqual([
      "darkweb_60k_refresh_soak",
      "source_atlas_10k_import_soak",
      "public_search_starvation_guard",
      "unsafe_output_guard",
      "host_resource_guard",
      "inspur_deployment_proof"
    ]);
    expect(promote.valueProgramOpsSoak.alertThresholds.map((alert) => alert.name)).toEqual([
      "darkweb_unsafe_attempts",
      "darkweb_raw_url_leak",
      "darkweb_review_backlog",
      "source_atlas_auto_activation",
      "source_atlas_queue_flood",
      "public_ti_latency_starvation",
      "scraper_memory_pressure",
      "cti_reserve_pressure"
    ]);
    expect(promote.valueProgramOpsSoak.safetyIncidentDrills.map((drill) => drill.name)).toEqual([
      "unsafe_target_attempt",
      "raw_url_leak_regression",
      "collector_quarantine_overflow",
      "source_atlas_auto_activation",
      "public_search_starvation"
    ]);
    expect(promote.valueProgramOpsSoak.deploymentProof.inspurProofCommands).toContain("ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:deploy-hygiene'");
    expect(promote.valueProgramOpsSoak.deploymentProof.publicProofCommand).toBe("TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof");
    expect(promote.valueProgramOpsSoak.integrations).toEqual({
      capacitySimulation: "wired",
      productionSoakDecisionBoard: "wired",
      onCallRunbookPack: "wired",
      releaseTrainHardening: "wired"
    });
    expect(promote.valueProgramOpsSoak.proofCommands).toContain("bun run check:ti-release-candidate");
    expect(promote.valueProgramOpsSoak.operatorRunbook).toContain("source-atlas import remains dry-run and must not mutate source registry, lease frontier work, or auto-activate candidates");
    expect(memoryWarning.valueProgramOpsSoak.refreshSoak.gates.find((gate) => gate.name === "host_resource_guard")).toMatchObject({
      status: "warning",
      decisionImpact: "hold"
    });
    expect(runtimeBlocker.valueProgramOpsSoak.refreshSoak.gates.find((gate) => gate.name === "host_resource_guard")).toMatchObject({
      status: "blocker",
      decisionImpact: "rollback"
    });
    expect(emergencyStop.valueProgramOpsSoak.decision).toBe("needs-human-approval");
    expect(JSON.stringify(promote.valueProgramOpsSoak)).not.toContain("object_key");
    expect(JSON.stringify(promote.valueProgramOpsSoak)).not.toContain("payload://");
    expect(promote.dependencyRollbackDrill.schemaVersion).toBe("ti.multi_service_dependency_rollback_drill.v1");
    expect(promote.dependencyRollbackDrill.dryRun).toBe(true);
    expect(promote.dependencyRollbackDrill.resourceBudget).toEqual({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    });
    expect(promote.dependencyRollbackDrill.services.map((service) => service.name)).toEqual([
      "scraper",
      "public_api_wrapper",
      "frontend_ti",
      "postgres_source_registry",
      "evidence_object_store",
      "opensearch_vector_handoff",
      "graph_backend",
      "queue_backend",
      "canary_collection",
      "restricted_metadata_controls"
    ]);
    expect(promote.dependencyRollbackDrill.scenarios.map((scenario) => scenario.name)).toEqual([
      "queue_saturation",
      "source_outage_wave",
      "parser_failure_spike",
      "evidence_object_degradation",
      "graph_export_corruption",
      "api_gateway_misrouting",
      "public_proof_failure",
      "canary_rollback",
      "container_rollback"
    ]);
    expect(promote.dependencyRollbackDrill.integrations).toEqual({
      agent01Governance: "wired",
      agent02Scheduler: "wired",
      agent03Adapters: "wired",
      agent04PublicCorrelation: "wired",
      agent05RestrictedMetadata: "wired",
      agent06EvidenceChain: "wired",
      agent07Quality: "wired",
      agent08Graph: "wired",
      agent09ApiCompatibility: "wired",
      agent10Operations: "wired"
    });
    expect(promote.dependencyRollbackDrill.services.every((service) =>
      service.healthCheck.length > 0
      && service.failureSymptoms.length > 0
      && service.operatorActions.length > 0
      && service.routeProof.length > 0
      && service.noLeakGuarantee.includes("hashes")
    )).toBe(true);
    expect(promote.dependencyRollbackDrill.scenarios.every((scenario) =>
      scenario.rollbackOrder.length > 0
      && scenario.routeProof.length > 0
      && scenario.noLeakGuarantees.every((guarantee) => !guarantee.includes("raw leaked rows") || guarantee.includes("must not"))
    )).toBe(true);
    expect(promote.dependencyRollbackDrill.scenarios.find((scenario) => scenario.name === "api_gateway_misrouting")).toMatchObject({
      affectedServices: ["public_api_wrapper", "frontend_ti", "scraper"],
      expectedUserState: "degraded",
      releaseDecisionImpact: "rollback"
    });
    expect(promote.dependencyRollbackDrill.services.find((service) => service.name === "restricted_metadata_controls")).toMatchObject({
      rollbackAction: "keep restricted connectors disabled until approval, proxy, retention, and redaction checks pass",
      userVisibleDegradation: "restricted results remain metadata_review or blocked with safe victim/company/count summaries only"
    });
    expect(promote.dependencyRollbackDrill.rollbackOrder).toEqual([
      "restricted_metadata_controls",
      "canary_collection",
      "frontend_ti",
      "public_api_wrapper",
      "scraper",
      "queue_backend",
      "graph_backend",
      "opensearch_vector_handoff",
      "evidence_object_store",
      "postgres_source_registry"
    ]);
    expect(promote.dependencyRollbackDrill.proofCommands).toContain("bun run check:canary-proof-path");
    expect(promote.dependencyRollbackDrill.proofCommands).toContain("bun run check:deploy-hygiene");
    expect(promote.dependencyRollbackDrill.operatorRunbook).toContain("keep browser workers disabled and do not assume GPU availability");
    expect(promote.releaseArtifactBundle.schemaVersion).toBe("ti.enterprise_soak_release_artifact_bundle.v1");
    expect(promote.releaseArtifactBundle.dryRun).toBe(true);
    expect(["promote", "warning"]).toContain(promote.releaseArtifactBundle.decision);
    expect(promote.releaseArtifactBundle.resourcePolicy).toEqual({
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    });
    expect(promote.releaseArtifactBundle.gates.map((gate) => gate.name)).toEqual([
      "route_inventory",
      "contract_index",
      "api_regression",
      "sdk_fixtures",
      "deploy_hygiene",
      "canary_readiness_soak",
      "public_proof",
      "scheduler_status",
      "restricted_metadata_audit",
      "evidence_chain",
      "graph_stix_readiness",
      "source_portfolio_readiness",
      "dependency_rollback_drill",
      "resource_budget",
      "public_ti_expectations"
    ]);
    expect(promote.releaseArtifactBundle.soakEvidence.map((dimension) => dimension.name)).toEqual([
      "queue_health",
      "freshness_slo",
      "source_outage_wave",
      "parser_failure_spike",
      "evidence_object_durability",
      "graph_drift_holds",
      "api_latency_polling",
      "memory_disk_budget",
      "worker_saturation",
      "incident_rollback_readiness"
    ]);
    expect(promote.releaseArtifactBundle.publicTiExpectations.map((item) => item.name)).toEqual([
      "no_default_actor",
      "unknown_searching_only",
      "partial_updates_seconds",
      "no_stale_demo_cache_prose"
    ]);
    expect(promote.releaseArtifactBundle.gates.every((gate) =>
      gate.proofCommand.length > 0
      && gate.evidenceSource.length > 0
      && !gate.noLeakProof.includes("raw body")
    )).toBe(true);
    expect(promote.releaseArtifactBundle.artifactManifest.map((artifact) => artifact.artifact)).toEqual([
      "route inventory",
      "contract index",
      "API regression",
      "SDK fixtures",
      "deploy hygiene",
      "canary readiness/soak",
      "public proof",
      "dependency rollback drill"
    ]);
    expect(promote.releaseArtifactBundle.proofCommands).toContain("bun run check:ti-release-candidate");
    expect(promote.releaseArtifactBundle.proofCommands).toContain("bun run check:api-regression");
    expect(promote.releaseArtifactBundle.operatorRunbook).toContain("keep public /ti honest: no default actor, unknown says Searching only, partial results update in seconds, and stale demo/cache prose stays absent");
    expect(warning.releaseArtifactBundle.decision).toBe("warning");
    expect(blocker.releaseArtifactBundle.decision).toBe("hold");
    expect(blocker.releaseArtifactBundle.ownerBlockers.some((blockerRow) => blockerRow.owner === "Agent 09" && blockerRow.gate === "public_ti_expectations")).toBe(true);
    expect(deploymentBlocker.releaseArtifactBundle.decision).toBe("rollback-only");
    expect(deploymentBlocker.releaseArtifactBundle.ownerBlockers.some((blockerRow) => blockerRow.gate === "public_proof")).toBe(true);
    expect(emergencyStop.releaseArtifactBundle.decision).toBe("needs-human-approval");
    expect(promote.nextProofCommands).toContain("bun run check:contract-index");
    expect(promote.nextProofCommands).toContain("bun test src/tests/ops.test.ts");
    expect(promote.nextProofCommands).toContain("bun run check:canary-proof-path");
    expect(promote.nextProofCommands).toContain("bun run check:api-regression");
    expect(promote.runtimeProofs.find((proof) => proof.name === "graph_export_sla")?.graphExportSla).toMatchObject({
      endpoint: "agent10_release_packet",
      state: "hold",
      publicAnswerImpact: "allow_graph_facts",
      stixImpact: "publish_ready_relationships"
    });
    expect(promote.runtimeProofs.find((proof) => proof.name === "graph_export_sla")?.graphExportEnforcement).toMatchObject({
      endpoint: "agent10_release_packet",
      state: "pass",
      releaseGate: {
        publicAnswers: "allow",
        stixPromotion: "allow",
        schemaSafe: true,
        ledgerComplete: true
      }
    });
    expect(promote.runtimeProofs.find((proof) => proof.name === "public_channel_sla")).toMatchObject({
      status: "warning",
      publicChannelSla: {
        enforcement: {
          status: "warning",
          agent06LedgerHandoff: { state: "warning" },
          agent07AnswerReadiness: { state: "warning" },
          agent10ReleasePacket: { runtimeProofName: "public_channel_sla" }
        }
      }
    });
    expect(promote.resourceBudget.scraperTargetGb).toBe(96);
    expect(promote.lastKnownGoodImageState).toBe("sha256:last_good");
    expect(promote.statusReport).toContain(`Agent 10 soak release decision: ${promote.decision}`);
    expect(promote.statusReport).toContain("runtimeProofs: Agent 01:activation_batches=pass/ok");
    expect(promote.statusReport).toContain("deploymentProofs: local_tests=pass");
    expect(promote.statusReport).toContain("releaseTrain: local_proof=pass/promote");
    expect(promote.statusReport).toContain(`rcGate: ${promote.rcGate.decision}`);
    expect(promote.statusReport).toContain(`canaryExecution: ${promote.canaryExecution.decision}`);
    expect(promote.statusReport).toContain(`rcBoard: ${promote.rcBoard.decision}`);
    expect(promote.statusReport).toContain(`productTiBoard: ${promote.productTiBoard.decision}`);
    expect(promote.statusReport).toContain(`realTimeSearchBoard: ${promote.realTimeSearchBoard.decision}`);
    expect(promote.statusReport).toContain(`observabilityDashboard: ${promote.observabilityDashboard.decision}`);
    expect(promote.statusReport).toContain(`enterpriseReleaseTrain: ${promote.enterpriseReleaseTrain.decision}`);
    expect(promote.nextProofCommands).toContain("bun run check:remote-drift");
    expect(promote.nextProofCommands).toContain("bun run soak:production");
    expect(promote.nextProofCommands).toContain("bun run check:deploy-hygiene");
    expect(promote.nextProofCommands).toContain("bun run check:docker-contexts");
    expect(promote.nextProofCommands).toContain("bun run check:live-search-deploy");
    expect(warning.decision).toBe("promote-with-warnings");
    expect(warning.warnings.map((item) => item.name)).toContain("clear_web.status_stale");
    expect(blocker.decision).toBe("hold-on-blocker");
    expect(blocker.rcGate.decision).toBe("no-go");
    expect(blocker.canaryExecution.decision).toBe("no-go");
    expect(blocker.rcBoard.decision).toBe("no-go");
    expect(blocker.productTiBoard.decision).toBe("no-go");
    expect(blocker.realTimeSearchBoard.decision).toBe("no-go");
    expect(blocker.blockers.map((item) => item.name)).toContain("api.public_post_proof_missing");
    expect(runtimeBlocker.decision).toBe("hold-on-blocker");
    expect(runtimeBlocker.blockers.map((item) => item.name)).toContain("runtime.claim_ledger_route_proof");
    expect(emergencyStop.decision).toBe("emergency-stop");
    expect(emergencyStop.rcGate.decision).toBe("emergency-stop");
    expect(emergencyStop.canaryExecution.decision).toBe("emergency-stop");
    expect(emergencyStop.rcBoard.decision).toBe("emergency-stop");
    expect(emergencyStop.productTiBoard.decision).toBe("emergency-stop");
    expect(emergencyStop.realTimeSearchBoard.decision).toBe("emergency-stop");
    expect(emergencyStop.observabilityDashboard.enterpriseViews.lanes.find((lane) => lane.name === "release_train_state")).toMatchObject({
      status: "blocker",
      alertName: "restricted_metadata_emergency_stop",
      releaseImpact: "emergency-stop"
    });
    expect(emergencyStop.observabilityDashboard.enterpriseViews.integrations.agent05RestrictedPlaybooks).toBe("blocker");
    expect(emergencyStop.canaryExecution.rollbackSteps[0]).toBe("activate restricted emergency stop and pause restricted metadata workers");
    expect(emergencyStop.ok).toBe(false);
    expect(emergencyStop.releaseTrain.currentDecision).toBe("emergency-stop");
    expect(emergencyStop.releaseTrain.stages.find((stage) => stage.name === "safety_and_retention")).toMatchObject({
      status: "blocker",
      decisionImpact: "emergency-stop"
    });
    expect(defaultAgent03Blocker.decision).toBe("hold-on-blocker");
    expect(defaultAgent03Blocker.rcGate.proofSlots.find((slot) => slot.name === "agent03_fail_closed")).toMatchObject({
      status: "blocker"
    });
    expect(defaultAgent03Blocker.canaryExecution.proof.find((proof) => proof.name === "agent03_fail_closed")).toMatchObject({
      status: "blocker"
    });
    expect(defaultAgent03Blocker.blockers.map((item) => item.name)).toContain("runtime.clear_web_blocker_status");
    expect(defaultAgent03Blocker.releaseTrain.staleBlockers).toContain("runtime.clear_web_blocker_status");
    expect(defaultAgent03Blocker.rcBoard.agent03FailClosed).toMatchObject({
      active: true,
      status: "blocker"
    });
    expect(defaultAgent03Blocker.rcBoard.gates.find((gate) => gate.name === "agent03_clear_web_fail_closed")).toMatchObject({
      status: "blocker"
    });
    expect(defaultAgent03Blocker.productTiBoard.decision).toBe("partial-public-ok");
    expect(defaultAgent03Blocker.productTiBoard.agentStatus.agent03).toBe("active");
    expect(defaultAgent03Blocker.realTimeSearchBoard.decision).toBe("partial-public-ok");
    expect(defaultAgent03Blocker.realTimeSearchBoard.scenarioGates.find((gate) => gate.scenario === "clear_web_capture_deltas")).toMatchObject({ status: "warning" });
    expect(deploymentBlocker.decision).toBe("hold-on-blocker");
    expect(deploymentBlocker.blockers.map((item) => item.name)).toContain("deployment_proof.public_post_api_proof");
    expect(deploymentBlocker.productTiBoard.decision).toBe("no-go");
    expect(deploymentBlocker.realTimeSearchBoard.decision).toBe("no-go");
    expect(continueSoak.decision).toBe("continue-soak");
    expect(continueSoak.rcGate.decision).toBe("canary-only");
    expect(continueSoak.canaryExecution.decision).toBe("canary-with-warnings");
    expect(continueSoak.rcBoard.decision).toBe("canary-only");
    expect(continueSoak.productTiBoard.decision).toBe("canary-with-warnings");
    expect(continueSoak.realTimeSearchBoard.decision).toBe("canary-with-warnings");
  });
});

function mountedRouteProofs(overrides: Record<string, CutoverMountedRouteProof["status"]> = {}): CutoverMountedRouteProof[] {
  return CUTOVER_MOUNTED_ROUTE_PROOF_REQUIREMENTS.map((required) => ({
    ...required,
    status: overrides[required.name] ?? "passed",
    rollbackPath: `keep outer fallback until ${required.name} mounted proof is green`
  }));
}
