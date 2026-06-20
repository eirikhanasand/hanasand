import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleApiRequest, startApiServer } from "../api/server.ts";
import { loadRuntimeConfig } from "../config/runtimeConfig.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop } from "../ops/canaryCollection.ts";
import { createLogger } from "../ops/logger.ts";
import { MetricsRegistry } from "../ops/metrics.ts";
import { WorkerSupervisor } from "../ops/supervisor.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import { InMemoryObjectEvidenceStore, InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { AnalystClaimLedgerEntry, RawCapture, SourceRecord } from "../types.ts";
import { hashContent } from "../utils.ts";

import {
  api,
  apiRestrictedMetadataApplyPlanSources,
  body,
  fixtureCapture,
  fixtureDelta,
  restrictedMetadataApplyPlanSources,
  seedEvidenceReplayFixture,
  source,
  telegramCapture
} from "./helpers/apiFixtures.ts";

type CanaryOperatorViewForTest = {
  activeSources: unknown[];
  latestRun?: { runId: string; status: string; taskCount: number; captureCount: number; incidentCount: number };
  latestCaptures: unknown[];
  schedulerHealth: {
    errorRate: number;
    promotionYield: number;
    duplicateRate: number;
    retryScheduledCount: number;
    retryExhaustedCount: number;
  };
  runtime: {
    schemaVersion: string;
    supervisorAttached: boolean;
    enabled: boolean;
    running: boolean;
    intervalSeconds: number;
    nextCycleAt?: string;
    cycleCount: number;
    successCount: number;
    errorCount: number;
    consecutiveErrorCount: number;
    maxSources: number;
    maxTasks: number;
    queueLimit: number;
    activateSources: boolean;
    controls: {
      canaryPortfolioOnly: boolean;
      activationRequiresHumanApproval: boolean;
      continuousLoopAutoActivation: boolean;
      nativeFetchDefault: boolean;
      objectBoundaryConfigured: boolean;
      boundedQueueRequired: boolean;
      dedupeBeforeWrite: boolean;
      retriesBounded: boolean;
      restrictedSourcesExcluded: boolean;
    };
  };
  evidenceStorage: {
    productionEvidenceMode: string;
    externalObjectCaptureCount: number;
    inlineCaptureCount: number;
    missingObjectReferenceCount: number;
    nativeLiveHttpCaptureCount: number;
    injectedProofFetchCaptureCount: number;
    unknownFetchModeCaptureCount: number;
  };
  blockedOrHeldItems: unknown[];
  publicAnswerReadiness: Array<{ query: string; captureCount: number; whyPartial?: string[] }>;
};

type CanaryOperatorResponseForTest = {
  operatorView: CanaryOperatorViewForTest;
};

type CanaryReadinessResponseForTest = {
  readiness: {
    schemaVersion: string;
    decision: string;
    evidence: {
      activeSourceCount: number;
      externalObjectCaptureCount: number;
      missingObjectReferenceCount: number;
      nativeLiveHttpCaptureCount: number;
      injectedProofFetchCaptureCount: number;
      promotionYield: number;
    };
    queryReadiness: Array<{ query: string; captureCount: number; readyForPublicAnswer: boolean }>;
    blockers: string[];
    controls: {
      activationRequiresHumanApproval: boolean;
      continuousLoopAutoActivation: boolean;
      restrictedSourcesExcluded: boolean;
      reversiblePauseAvailable: boolean;
      liveFetchProvenanceAvailable: boolean;
      nativeLiveHttpRequired: boolean;
    };
    proofCommands: string[];
  };
};

type CanarySoakResponseForTest = {
  soak: {
    schemaVersion: string;
    decision: string;
    cycles: Array<{ runId: string; status: string; taskCount: number; captureCount: number; incidentCount: number }>;
    metrics: {
      cycleCount: number;
      totalCaptureCount: number;
      totalIncidentCount: number;
      activeSourceCount: number;
      externalObjectCaptureCount: number;
      missingObjectReferenceCount: number;
      nativeLiveHttpCaptureCount: number;
      injectedProofFetchCaptureCount: number;
      promotionYield: number;
    };
    blockers: string[];
    controls: {
      canaryPortfolioOnly: boolean;
      activationRequiresHumanApproval: boolean;
      continuousLoopAutoActivation: boolean;
      boundedQueueRequired: boolean;
      objectBoundaryRequired: boolean;
      fetchProvenanceRequired: boolean;
      nativeLiveHttpRequired: boolean;
      restrictedSourcesExcluded: boolean;
    };
    proofCommands: string[];
  };
};

describe("api v1", () => {
  test("returns typed health and paginated sources", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "one" }));
    store.saveSource(source({ id: "two", name: "Second" }));
    const options = { store, frontier: new FocusedFrontier() };

    const health = await body(await handleApiRequest(api("/v1/health"), options));
    expect(health).toMatchObject({ ok: true, service: "ti-scraper", version: "v1" });

    const sources = await body(await handleApiRequest(api("/v1/sources?limit=1"), options));
    expect((sources.sources as unknown[])).toHaveLength(1);
    expect(sources.nextCursor).toBe("1");
  });

  test("publishes auth integration boundary without accepting secrets in scraper", async () => {
    const options = { store: new InMemoryScraperStore(), frontier: new FocusedFrontier() };
    const response = await body(await handleApiRequest(api("/v1/auth/integration-notes"), options));
    expect(response).toMatchObject({
      version: "v1",
      authBoundary: {
        schemaVersion: "ti.enterprise_auth_boundary.v1",
        mode: "trusted_gateway_forwarded_identity",
        enforcedHere: false,
        requiredForwardedHeaders: expect.arrayContaining(["x-tenant-id", "x-actor-id"]),
        tenantContract: {
          header: "x-tenant-id",
          requiredForProduction: true
        },
        requesterContract: {
          header: "x-actor-id",
          requiredForProduction: true,
          auditOnlyHere: true
        },
        secretHandling: {
          scraperDoesNotStoreSecrets: true,
          bearerTokensAcceptedHere: false
        }
      },
      notes: expect.arrayContaining([
        expect.stringContaining("Authenticate at the main CTI app")
      ])
    });
    expect(JSON.stringify(response).toLowerCase()).not.toContain("authorization:");
    expect(JSON.stringify(response).toLowerCase()).not.toContain("cookie=");
  });

  test("exposes live product SLO dashboard for Agent 10 revenue monitoring", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.saveSource(source({
      id: "src_product_slo",
      status: "active",
      crawlState: { lastCollectedAt: "2026-06-20T11:00:00.000Z", retryCount: 0 }
    }));
    store.saveRun({
      id: "run_product_slo",
      planId: "plan_product_slo",
      requestId: "req_product_slo",
      status: "completed",
      createdAt: "2026-06-20T11:59:55.000Z",
      startedAt: "2026-06-20T11:59:56.000Z",
      updatedAt: "2026-06-20T11:59:56.000Z",
      completedAt: "2026-06-20T11:59:56.000Z",
      taskCount: 1,
      reviewTaskCount: 0,
      rejectedSourceCount: 0,
      captureCount: 29,
      incidentCount: 1
    });
    store.saveCapture(fixtureCapture({
      id: "cap_product_slo",
      sourceId: "src_product_slo",
      collectedAt: "2026-06-20T11:01:00.000Z",
      metadata: { claimClusterId: "claim_product_slo" }
    }));

    const response = await body(await handleApiRequest(api("/v1/ops/product-slo?generatedAt=2026-06-20T12:00:00.000Z&proofMode=inspur&actorBuildId=build_live&actorRunId=run_live&actorDatasetId=ds_live&actorStatus=succeeded&actorQueryCount=20&actorRowCount=98&actorUsefulRowCount=48&actorFreshRowCount=64&actorStaleRowCount=3&actorSellableRows=16&actorIncludedWithCaveatRows=32&actorCoverageGapOnlyRows=30&actorHoldRows=20&actorSuppressRows=0&actorTargetSellableRows=25&actorAverageBuyerValueScore=0.6&actorDefaultWatchlistRun=true&computeCostUsd=0.0023&resultPriceUsdPerThousand=3&actorStartPriceUsd=0.00005&apifyMarginRate=0.2&apifyActorViewCount=6&apifyActorRunCount=2&apifyUniqueUserCount=1&apifyTrialRunCount=2&apifyPaidRunCount=1&apifyActorStartCount=2&apifyDatasetRowCount=98&apifyFailedRunCount=0&apifyRepeatUserCount=0&apifyRefundCount=0&apifyPlatformUsageCostUsd=0.0023&apifyEstimatedCreatorRevenueUsd=0.235&apifyBeneficiaryVerified=false&apifyPayoutMethodReady=false&apifyWithdrawalReady=false&apifyPricingEffectiveAt=2026-07-04"), { store, frontier }));

    expect(response.schemaVersion).toBe("ti.live_product_slo_dashboard.v1");
    expect(response.route).toBe("/v1/ops/product-slo");
    expect((response.dashboard as { proofMode: string }).proofMode).toBe("inspur");
    expect((response.metrics as { apiFirstResponseLatencyMs: { p95: number } }).apiFirstResponseLatencyMs.p95).toBe(1000);
    expect((response.metrics as { actorRunSuccessRate: { value: number } }).actorRunSuccessRate.value).toBe(1);
    expect((response.apifyLaunchExperiment as { uniqueUsers: number }).uniqueUsers).toBe(1);
    expect((response.apifyLaunchExperiment as {
      paidRowDecisionCounts: { sellable: number; includedWithCaveat: number; coverageGapOnly: number; hold: number; buyerUseful: number };
      monetizationReadiness: { status: string; targetSellableRows: number; sellableRows: number; averageBuyerValueScore: number; sellableRowRate: number; blockers: string[] };
      marketplaceTelemetry: { schemaVersion: string; storePageViews: number; actorStarts: number; datasetRows: number; failedRuns: number; refunds: number; platformUsageCostUsd: number; estimatedCreatorRevenueUsd: number; realDataRequired: boolean; unknownMeansNoClaim: boolean };
      payoutReadiness: { schemaVersion: string; payoutMethodState: string; beneficiaryState: string; withdrawalReadiness: string; externallyVerified: boolean; blockers: string[] };
      conversionExperiments: Array<{ id: string; successCriteria: string[]; stopLossCriteria: string[]; datasetValueProofField: string; buyerVisibleFields: string[]; noLeakRequired: boolean }>;
      operatorBlockerBoard: Array<{ owner: string; blocker: string; conversionImpact: string }>;
      fakeTractionGuards: string[];
      revenueConversionChecklist: { schemaVersion: string; telemetryState: string; payoutState: string; nextManualVerificationStep: string; checks: Array<{ id: string; state: string; proofField: string }> };
      pricingProof: { schemaVersion: string; starterTrialShape: { name: string; queryLimit: number }; paidDailyMonitoringShape: { name: string; minimumSellableRowRate: number; minimumFreshRowRate: number }; usageCostGuard: { rowPriceUsdPerThousand: number; platformUsageCostUsd: number; estimatedCreatorRevenueUsd: number; maxCostPerUsefulRowUsd: number }; payoutRevenueSeparation: { paymentMethodState: string; beneficiaryState: string; withdrawalReadiness: string; externallyVerifiedRevenueUsd: number | null }; noLeakRequired: boolean };
      buyerSampleRows: Array<{ id: string; rowClass: string; buyerVisibleFields: { actorSummary: string; freshClaimOrActivity: string; confidence: number; provenanceHash: string; noLeakProof: string; nextAnalystPivots: string[] } }>;
      nextRevenueAction: string;
      storeViewToRunRate: number;
      storeViewToUserRate: number;
      runsPerUser: number;
      trialToPaidRate: number;
    })).toMatchObject({
      paidRowDecisionCounts: { sellable: 16, includedWithCaveat: 32, coverageGapOnly: 30, hold: 20, buyerUseful: 48 },
      monetizationReadiness: { status: "blocked_for_paid_traffic", targetSellableRows: 25, sellableRows: 16, averageBuyerValueScore: 0.6, sellableRowRate: 0.163, blockers: ["sellable_rows_below_paid_traffic_floor"] },
      marketplaceTelemetry: { schemaVersion: "ti.apify_marketplace_telemetry_input.v1", storePageViews: 6, actorStarts: 2, datasetRows: 98, failedRuns: 0, refunds: 0, platformUsageCostUsd: 0.0023, estimatedCreatorRevenueUsd: 0.235, realDataRequired: true, unknownMeansNoClaim: true },
      payoutReadiness: { schemaVersion: "ti.apify_payout_readiness.v1", payoutMethodState: "blocked", beneficiaryState: "blocked", withdrawalReadiness: "blocked", externallyVerified: false, blockers: expect.arrayContaining(["apify_withdrawal_readiness_not_confirmed"]) as unknown as string[] },
      revenueConversionChecklist: { schemaVersion: "ti.apify_revenue_conversion_checklist.v1", telemetryState: "ready", payoutState: "blocked" },
      pricingProof: {
        schemaVersion: "ti.apify_pricing_proof.v1",
        starterTrialShape: { name: "starter_actor_query_pack", queryLimit: 3 },
        paidDailyMonitoringShape: { name: "high_freshness_apt_monitoring_pack", minimumSellableRowRate: 0.25, minimumFreshRowRate: 0.55 },
        usageCostGuard: { rowPriceUsdPerThousand: 3, platformUsageCostUsd: 0.0023, estimatedCreatorRevenueUsd: 0.235, maxCostPerUsefulRowUsd: 0.01 },
        payoutRevenueSeparation: { paymentMethodState: "blocked", beneficiaryState: "blocked", withdrawalReadiness: "blocked", externallyVerifiedRevenueUsd: 0.235 },
        noLeakRequired: true
      },
      nextRevenueAction: "payout_setup",
      storeViewToRunRate: 0.333,
      storeViewToUserRate: 0.167,
      runsPerUser: 2,
      trialToPaidRate: 0.5
    });
    const launch = response.apifyLaunchExperiment as {
      conversionExperiments: Array<{ id: string; buyerVisibleFields: string[]; noLeakRequired: boolean }>;
      operatorBlockerBoard: Array<{ owner: string }>;
      fakeTractionGuards: string[];
      revenueConversionChecklist: { checks: Array<{ id: string; state: string }>; nextManualVerificationStep: string };
      buyerSampleRows: Array<{ buyerVisibleFields: { noLeakProof: string; nextAnalystPivots: string[] } }>;
    };
    expect(launch.conversionExperiments.map((item) => item.id)).toEqual(["starter_actor_query_pack", "high_freshness_apt_monitoring_pack", "ransomware_public_claim_metadata_pack"]);
    expect(launch.conversionExperiments.every((item) => item.buyerVisibleFields.includes("noLeakProof") && item.noLeakRequired)).toBe(true);
    expect(launch.operatorBlockerBoard.map((item) => item.owner)).toEqual(expect.arrayContaining(["Agent 01", "Agent 03", "Agent 04", "Agent 05", "Agent 07", "Agent 08", "Agent 10"]));
    expect(launch.fakeTractionGuards.join(" ")).toContain("remain null until sourced from Apify analytics");
    expect(launch.fakeTractionGuards.join(" ")).toContain("local sample runs and owner proof runs never count");
    expect(launch.fakeTractionGuards.join(" ")).toContain("synthetic proof rows never count");
    expect(launch.revenueConversionChecklist.checks.map((item) => item.id)).toEqual(expect.arrayContaining(["listing_copy", "sample_rows", "pricing_shape", "marketplace_telemetry", "payout_setup", "fake_traction_guards", "no_leak_sample_proof"]));
    expect(launch.revenueConversionChecklist.nextManualVerificationStep).toContain("Compare paid run conversion");
    expect(launch.buyerSampleRows).toHaveLength(12);
    expect(launch.buyerSampleRows.every((row) =>
      row.buyerVisibleFields.noLeakProof === "metadata_only_no_raw_body_no_secret_material_no_private_content" &&
      row.buyerVisibleFields.nextAnalystPivots.length > 0
    )).toBe(true);
    expect((response.apifyLaunchExperiment as { unknowns: string[] }).unknowns).toContain("grossPpeRevenueUsd");
    expect((response.paidProductEconomics as {
      pricing: { resultPriceUsdPerThousand: number; effectiveAt: string };
      latestRun: { rowCount: number; usefulRowRate: number; freshRowRate: number; defaultWatchlistRun: boolean; paidRowDecisionCounts: { buyerUseful: number }; monetizationReadiness: { status: string; sellableRowRate: number } };
      projectedRevenue: { grossRowsUsd: number; netAfterApifyUsd: number; projectedNetAfterUsageUsd: number };
      marketplace: { storeViewToRunRate: number; trialToPaidRate: number; beneficiaryStatus: string; payoutMethodStatus: string; withdrawalStatus: string; blockers: string[]; fakeTractionGuards: string[] };
    })).toMatchObject({
      pricing: { resultPriceUsdPerThousand: 3, effectiveAt: "2026-07-04" },
      latestRun: { rowCount: 98, usefulRowRate: 0.49, freshRowRate: 0.653, defaultWatchlistRun: true, paidRowDecisionCounts: { buyerUseful: 48 }, monetizationReadiness: { status: "blocked_for_paid_traffic", sellableRowRate: 0.163 } },
      projectedRevenue: { grossRowsUsd: 0.294, netAfterApifyUsd: 0.235, projectedNetAfterUsageUsd: 0.233 },
      marketplace: {
        storeViewToRunRate: 0.333,
        trialToPaidRate: 0.5,
        beneficiaryStatus: "blocked",
        payoutMethodStatus: "blocked",
        withdrawalStatus: "blocked",
        blockers: expect.arrayContaining(["apify_beneficiary_verification_not_confirmed", "apify_payout_method_not_confirmed", "apify_withdrawal_readiness_not_confirmed"]) as unknown as string[]
      }
    });
    expect((response.sourceMonetizationGate as {
      evaluatedSourceCandidateCount: number;
      payworthySourceCount: number;
      payworthyRate: number;
      thresholdRate: number;
      state: string;
      heldTiers: Array<{ tier: number; reason: string }>;
      proofRunComparison: { currentProofRunId: string; baselineProofRunId: string };
      blockers: string[];
    })).toMatchObject({
      evaluatedSourceCandidateCount: 4000,
      payworthySourceCount: 1468,
      payworthyRate: 0.367,
      thresholdRate: 0.72,
      state: "alert",
      proofRunComparison: {
        currentProofRunId: "iMQGeezZ8bx7WtlhQ",
        baselineProofRunId: "rh6D0UInDD6x7GuuD"
      },
      blockers: expect.arrayContaining(["source_payworthy_rate_below_72_percent", "replace_low_value_sources_before_marketplace_scale_claim"]) as unknown as string[]
    });
    expect((response.nonMonetizingWorkDetector as {
      schemaVersion: string;
      defaultRule: string;
      buyerVisibleMetrics: string[];
      examples: Array<{ workType: string; label: string; buyerVisibleMetricMoved: boolean }>;
      proofFixture: { nonMonetizingExampleCount: number; monetizingExampleCount: number; distinguishesContractOnlyFromBuyerMetricLift: boolean };
    })).toMatchObject({
      schemaVersion: "ti.non_monetizing_work_detector.v1",
      defaultRule: "does_not_count_unless_buyer_visible_metric_moves",
      buyerVisibleMetrics: expect.arrayContaining(["sellableRowCount", "averageBuyerValueScore", "apifyPaidRuns", "payoutReadiness"]) as unknown as string[],
      proofFixture: {
        nonMonetizingExampleCount: 4,
        monetizingExampleCount: 1,
        distinguishesContractOnlyFromBuyerMetricLift: true
      }
    });
    expect((response.nonMonetizingWorkDetector as {
      examples: Array<{ workType: string; label: string; buyerVisibleMetricMoved: boolean }>;
    }).examples.find((row) => row.workType === "schema_only")).toMatchObject({ label: "non_monetizing", buyerVisibleMetricMoved: false });
    expect((response.nonMonetizingWorkDetector as {
      examples: Array<{ workType: string; label: string; buyerVisibleMetricMoved: boolean }>;
    }).examples.find((row) => row.workType === "buyer_visible_metric_lift")).toMatchObject({ label: "monetizing", buyerVisibleMetricMoved: true });
    expect((response.scaleStepGates as {
      schemaVersion: string;
      baselineRunId: string;
      baselineDatasetId: string;
      gates: Array<{ id: string; state: string; buyerValueThreshold: number; observedBuyerValue: number | null; noLeakRequired: boolean }>;
      nextAllowedStep: string;
      heldStepCount: number;
    })).toMatchObject({
      schemaVersion: "ti.product_scale_step_gates.v1",
      baselineRunId: "OThlfd0uzSCNnedAO",
      baselineDatasetId: "LSen2fYtwFTtOr7vK",
      nextAllowedStep: "daily_20_default_groups",
      heldStepCount: 6
    });
    expect((response.scaleStepGates as {
      gates: Array<{ id: string; state: string; buyerValueThreshold: number; observedBuyerValue: number | null; noLeakRequired: boolean }>;
    }).gates.map((gate) => gate.id)).toEqual([
      "daily_20_default_groups",
      "sources_100",
      "sources_1000",
      "dark_metadata_4000",
      "records_10000",
      "records_20000",
      "records_60000"
    ]);
    expect((response.scaleStepGates as {
      gates: Array<{ id: string; state: string; buyerValueThreshold: number; observedBuyerValue: number | null; noLeakRequired: boolean }>;
    }).gates.every((gate) => gate.noLeakRequired)).toBe(true);
    expect((response.scaleStepGates as {
      gates: Array<{ id: string; state: string; buyerValueThreshold: number; observedBuyerValue: number | null }>;
    }).gates.find((gate) => gate.id === "daily_20_default_groups")).toMatchObject({ state: "pass", buyerValueThreshold: 0.55, observedBuyerValue: 0.6 });
    expect((response.revenueBlockerBoard as {
      schemaVersion: string;
      blockers: Array<{ priority: number; blocker: string; owner: string; buyerMetricTarget: string }>;
    })).toMatchObject({ schemaVersion: "ti.revenue_blocker_board.v1" });
    expect((response.revenueBlockerBoard as {
      blockers: Array<{ priority: number; blocker: string; owner: string; buyerMetricTarget: string }>;
    }).blockers.map((item) => item.blocker)).toEqual([
      "stale_apt29_evidence",
      "thin_apt42_public_channel_coverage",
      "source_family_diversity",
      "held_caveated_row_count",
      "dark_metadata_usefulness",
      "apify_store_conversion",
      "payout_readiness_gaps"
    ]);
    expect((response.darkMetadataLiveValueExpansion as {
      schemaVersion: string;
      routeVisibleOn: string[];
      owner: string;
      dryRun: boolean;
      willStartCollection: boolean;
      willFetchNetwork: boolean;
      sourceCountInflationBlocked: boolean;
      tiers: Array<{ tier: number; evaluatedCandidateCount: number; valueQualifiedCandidateCount: number; usefulRowRate: number; averageBuyerValueScore: number; staleRate: number; duplicateRate: number; blockedOrReviewRate: number; decision: string }>;
      criteria: { minimumAverageBuyerValueScore: number; maximumStaleRate: number; maximumDuplicateRate: number; maximumBlockedOrReviewRate: number; minimumUsefulQueriesPerTier: number; minimumSafeSampleRowsPerTier: number; noLeakSerializationRequired: boolean };
      blockers: string[];
    })).toMatchObject({
      schemaVersion: "ti.dark_metadata_live_value_expansion_slo.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts"]) as unknown as string[],
      owner: "Agent 05",
      dryRun: true,
      willStartCollection: false,
      willFetchNetwork: false,
      sourceCountInflationBlocked: true,
      tiers: [
        { tier: 1000, evaluatedCandidateCount: 100, valueQualifiedCandidateCount: 2, usefulRowRate: 0.02, averageBuyerValueScore: 0.41, staleRate: 0.92, duplicateRate: 0.06, blockedOrReviewRate: 0.74, decision: "hold_for_value_density" },
        { tier: 4000, evaluatedCandidateCount: 100, valueQualifiedCandidateCount: 2, usefulRowRate: 0.02, averageBuyerValueScore: 0.41, staleRate: 0.92, duplicateRate: 0.06, blockedOrReviewRate: 0.74, decision: "hold_for_value_density" }
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
      blockers: expect.arrayContaining(["dark_metadata_value_density_below_paid_threshold", "source_count_inflation_blocked_until_sample_rows_and_queries_pass"]) as unknown as string[]
    });
    expect((response.buyerVisibleQualityLiftGate as {
      schemaVersion: string;
      baselineRunId: string;
      baselineDatasetId: string;
      routeVisibleOn: string[];
      dryRun: boolean;
      willMutateSources: boolean;
      willStartCollection: boolean;
      qualityLiftAcceptedCount: number;
      qualityLiftRejectedCount: number;
      sellableRowsAdded: number;
      freshRowsAdded: number;
      usefulRowsAdded: number;
      costPerUsefulRowDelta: number;
      projectedRowRevenueDeltaUsd: number;
      acceptedExamples: Array<{ owner: string; afterDecision: string }>;
      rejectedExamples: Array<{ doesNotCountTowardPayworthyRate: boolean; rejectionReason: string }>;
      ownerHandoffs: Array<{ owner: string; accepted: number }>;
    })).toMatchObject({
      schemaVersion: "ti.live_product_buyer_visible_quality_lift_gate.v1",
      baselineRunId: "iMQGeezZ8bx7WtlhQ",
      baselineDatasetId: "5PLmkE30luBA5Lbgc",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts"]) as unknown as string[],
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      qualityLiftAcceptedCount: 5,
      qualityLiftRejectedCount: 5,
      sellableRowsAdded: 2,
      freshRowsAdded: 5,
      usefulRowsAdded: 5,
      costPerUsefulRowDelta: -0.0018,
      projectedRowRevenueDeltaUsd: 0.015,
      rejectedExamples: expect.arrayContaining([
        expect.objectContaining({ rejectionReason: "no_sellable_row_lift", doesNotCountTowardPayworthyRate: true })
      ]) as unknown as Array<{ doesNotCountTowardPayworthyRate: boolean; rejectionReason: string }>
    });
    expect((response.buyerVisibleQualityLiftGate as { acceptedExamples: Array<{ owner: string; afterDecision: string }> }).acceptedExamples.some((row) => row.owner === "agent_03" && row.afterDecision === "sellable")).toBe(true);
    expect((response.buyerVisibleQualityLiftGate as { ownerHandoffs: Array<{ owner: string; accepted: number }> }).ownerHandoffs.some((row) => row.owner === "agent_03" && row.accepted === 2)).toBe(true);
    expect((response.marketplaceGraphSignals as {
      schemaVersion: string;
      baselineRunId: string;
      baselineDatasetId: string;
      routeVisibleOn: string[];
      dryRun: boolean;
      willMutateSources: boolean;
      willStartCollection: boolean;
      improvedRows: number;
      rejectedRows: number;
      examples: Array<{ actor: string; family: string; rowSignal: string; noLeak: boolean }>;
      rejectedGraphInflation: Array<{ blockedReason: string; noLeak: boolean }>;
      sourceParserHandoffs: Array<{ owner: string }>;
    })).toMatchObject({
      schemaVersion: "ti.marketplace_graph_signals_gate.v1",
      baselineRunId: "OThlfd0uzSCNnedAO",
      baselineDatasetId: "LSen2fYtwFTtOr7vK",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows"]) as unknown as string[],
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      improvedRows: 8,
      rejectedRows: 6
    });
    const graphSignalExamples = (response.marketplaceGraphSignals as { examples: Array<{ actor: string; family: string; rowSignal: string; noLeak: boolean }> }).examples;
    expect(graphSignalExamples).toHaveLength(8);
    expect(graphSignalExamples.some((row) => row.actor === "APT42" && row.rowSignal === "needs_corroboration" && row.noLeak === true)).toBe(true);
    expect(graphSignalExamples.some((row) => row.family === "ransomware" && row.noLeak === true)).toBe(true);
    const graphSignalRejections = (response.marketplaceGraphSignals as { rejectedGraphInflation: Array<{ blockedReason: string; noLeak: boolean }> }).rejectedGraphInflation;
    expect(graphSignalRejections.map((row) => row.blockedReason)).toEqual(expect.arrayContaining(["stale_graph_fact", "single_source_edge", "restricted_only_context", "missing_ledger_proof", "no_fresh_change"]));
    expect(graphSignalRejections.every((row) => row.noLeak)).toBe(true);
    expect((response.marketplaceGraphSignals as { sourceParserHandoffs: Array<{ owner: string }> }).sourceParserHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05"]));
    expect((response.graphPivotLiftGate as {
      schemaVersion: string;
      routeVisibleOn: string[];
      baselineRunId: string;
      baselineDatasetId: string;
      dryRun: boolean;
      willMutateSources: boolean;
      willStartCollection: boolean;
      exampleCount: number;
      usefulPivotRate: number;
      corroboratedPivotRate: number;
      nextSearchPivotCount: number;
      suppressedGenericPivotCount: number;
      sellableRowsAdded: number;
      usefulRowsAdded: number;
      averageBuyerValueDelta: number;
      rejectedBloatReasons: string[];
      ownerHandoffs: Array<{ owner: string }>;
    })).toMatchObject({
      schemaVersion: "ti.apify_graph_pivot_lift_gate.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows"]) as unknown as string[],
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
      rejectedBloatReasons: expect.arrayContaining(["generic_pivot", "stale_pivot", "contradicted_pivot", "unrelated_actor_pivot", "restricted_only_pivot", "missing_ledger_pivot", "single_source_without_caveat"]) as unknown as string[]
    });
    expect((response.graphPivotLiftGate as { ownerHandoffs: Array<{ owner: string }> }).ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05", "agent_07", "agent_09", "agent_10"]));
    expect((response.relationshipConfidenceGate as {
      schemaVersion: string;
      routeVisibleOn: string[];
      baselineRunId: string;
      baselineDatasetId: string;
      dryRun: boolean;
      willMutateSources: boolean;
      willStartCollection: boolean;
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
      ownerHandoffs: Array<{ owner: string }>;
    })).toMatchObject({
      schemaVersion: "ti.apify_relationship_confidence_gate.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "Apify OUTPUT", "Apify dataset rows"]) as unknown as string[],
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
      rejectedUnsupportedReasons: expect.arrayContaining(["generic_pivot", "stale_pivot", "contradicted_pivot", "unrelated_actor_pivot", "restricted_only_pivot", "missing_ledger_pivot", "single_source_without_caveat", "no_action_pivot"]) as unknown as string[]
    });
    expect((response.relationshipConfidenceGate as { ownerHandoffs: Array<{ owner: string }> }).ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_03", "agent_04", "agent_05", "agent_07", "agent_09", "agent_10"]));
    expect((response.qualityConversionGate as {
      schemaVersion: string;
      routeVisibleOn: string[];
      baselineRunId: string;
      baselineDatasetId: string;
      dryRun: boolean;
      willMutateSources: boolean;
      willStartCollection: boolean;
      exampleCount: number;
      chargeableExampleCount: number;
      caveatedExampleCount: number;
      heldOrSuppressedExampleCount: number;
      rejectedBloatRows: number;
      sellableRowLift: number;
      bloatBlocked: number;
      rejectedBloatReasons: string[];
      sourceParserHandoffs: Array<{ owner: string }>;
    })).toMatchObject({
      schemaVersion: "ti.program_bq_paid_row_quality_conversion_gate.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts"]) as unknown as string[],
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
      rejectedBloatReasons: expect.arrayContaining(["alias_only_cleanup", "stale_old_report_reuse", "duplicate_source_expansion", "generic_marketing_summary", "uncorroborated_public_channel_snippet", "unsafe_metadata", "no_actionability"]) as unknown as string[]
    });
    expect((response.qualityConversionGate as { sourceParserHandoffs: Array<{ owner: string }> }).sourceParserHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_01", "agent_03", "agent_04", "agent_05"]));
    expect((response.liveFreshnessQualityGate as {
      schemaVersion: string;
      routeVisibleOn: string[];
      dryRun: boolean;
      willMutateSources: boolean;
      willStartCollection: boolean;
      exampleCount: number;
      chargeableFreshRows: number;
      caveatedFreshRows: number;
      staleLatestClaimsBlocked: number;
      bloatRowsSuppressed: number;
      minimumFreshRowRate: number;
      minimumStaleSuppressionRate: number;
      blockedLatestClaimReasons: string[];
      sourceParserHandoffs: Array<{ owner: string }>;
    })).toMatchObject({
      schemaVersion: "ti.program_br_live_freshness_quality_gate.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts"]) as unknown as string[],
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
      blockedLatestClaimReasons: expect.arrayContaining(["old_evidence", "generic_summary", "single_source", "alias_only", "unrelated_actor", "contradicted", "metadata_only_without_public_support"]) as unknown as string[]
    });
    expect((response.liveFreshnessQualityGate as { sourceParserHandoffs: Array<{ owner: string }> }).sourceParserHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_01", "agent_03", "agent_04", "agent_05"]));
    expect((response.freshnessRepairLoop as {
      schemaVersion: string;
      routeVisibleOn: string[];
      dryRun: boolean;
      willMutateSources: boolean;
      willStartCollection: boolean;
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
      ownerHandoffs: Array<{ owner: string }>;
      noLeakProof: { rawEvidenceExposed: boolean; unsafeUrlsExposed: boolean; restrictedPayloadsExposed: boolean; objectKeysExposed: boolean };
    })).toMatchObject({
      schemaVersion: "ti.program_bs_paid_row_freshness_repair_loop.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "Apify OUTPUT"]) as unknown as string[],
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      repairQueueSize: 20,
      actorCoverage: expect.arrayContaining(["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta"]) as unknown as string[],
      blockerReasons: expect.arrayContaining(["stale_latest_activity", "generic_summary", "single_source", "alias_only", "unrelated_actor", "contradicted", "metadata_only_without_public_support"]) as unknown as string[],
      staleRowsBlocked: 4,
      genericRowsRepaired: 4,
      aliasOrUnrelatedRowsSuppressed: 4,
      caveatedRowsPreserved: 7,
      sellableRowsGained: 6,
      usefulRowsGained: 6,
      averageBuyerValueDelta: 0.104,
      noLeakProof: { rawEvidenceExposed: false, unsafeUrlsExposed: false, restrictedPayloadsExposed: false, objectKeysExposed: false }
    });
    expect((response.freshnessRepairLoop as { ownerHandoffs: Array<{ owner: string }> }).ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_01", "agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_09", "agent_10"]));
    expect((response.entitySpecificityLift as {
      schemaVersion: string;
      routeVisibleOn: string[];
      dryRun: boolean;
      willMutateSources: boolean;
      willStartCollection: boolean;
      fixtureCount: number;
      actorCoverage: string[];
      missingFieldCoverage: string[];
      blockerCodes: string[];
      rowsLifted: number;
      rowsSuppressed: number;
      rowsHeldWithRepairAction: number;
      blockerCodesRemoved: number;
      averageBuyerValueDelta: number;
      ownerHandoffs: Array<{ owner: string }>;
      noLeakProof: { rawEvidenceExposed: boolean; unsafeUrlsExposed: boolean; restrictedPayloadsExposed: boolean; objectKeysExposed: boolean };
    })).toMatchObject({
      schemaVersion: "ti.program_bv_paid_row_entity_specificity_lift.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/ops/product-slo", "/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "Apify OUTPUT"]) as unknown as string[],
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false,
      fixtureCount: 20,
      actorCoverage: expect.arrayContaining(["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin", "Unknown Actor Query"]) as unknown as string[],
      missingFieldCoverage: expect.arrayContaining(["victim", "sector", "country", "dataset_or_impact", "ttp_or_tool", "first_seen", "last_seen", "confidence", "caveat", "contradiction_state", "provenance_hash", "next_action"]) as unknown as string[],
      blockerCodes: expect.arrayContaining(["old", "alias_only", "single_source_without_caveat", "unrelated_actor", "contradicted", "metadata_only_without_public_support", "no_useful_buyer_action", "generic_entity_fields"]) as unknown as string[],
      rowsLifted: 14,
      rowsSuppressed: 4,
      rowsHeldWithRepairAction: 2,
      blockerCodesRemoved: 25,
      averageBuyerValueDelta: 0.161,
      noLeakProof: { rawEvidenceExposed: false, unsafeUrlsExposed: false, restrictedPayloadsExposed: false, objectKeysExposed: false }
    });
    expect((response.entitySpecificityLift as { ownerHandoffs: Array<{ owner: string }> }).ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_01", "agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_09", "agent_10"]));
    expect((response.deploymentProof as { actorBuildId: string }).actorBuildId).toBe("build_live");
    expect((response.resourceGuardrails as { scraperTargetRamGb: number }).scraperTargetRamGb).toBe(96);

    const contracts = await body(await handleApiRequest(api("/v1/contracts"), { store, frontier }));
    expect((contracts.routeInventory as { routes: Array<{ path: string }> }).routes.some((route) => route.path === "/v1/ops/product-slo")).toBe(true);
    expect(JSON.stringify((contracts.surfaces as Array<{ name: string }>).find((surface) => surface.name === "ops"))).toContain("live_product_slo_dashboard");
  });

  test("reviews claim ledger entries through metadata-only API actions", async () => {
    const store = new InMemoryScraperStore();
    const now = "2026-05-24T12:30:00.000Z";
    const entry: AnalystClaimLedgerEntry = {
      id: "claim_fjord_accounts",
      tenantId: "tenant_claims",
      normalizedQuery: "fjord energy as akira",
      reviewTaskId: "review_fjord",
      captureId: "capture_fjord_metadata",
      sourceId: "src_restricted_metadata",
      claimKind: "affected_accounts_claim",
      company: "Fjord Energy AS",
      victim: "Fjord Energy AS",
      claimTextSummary: "Akira listed Fjord Energy AS with 18,432 affected accounts and 42 GB dataset size.",
      sourceHash: "hash_fjord_claim",
      confidence: 0.72,
      ledgerStatus: "metadata_review",
      observedAt: now,
      provenance: {
        sourceFamily: "restricted_metadata",
        rawLeakMaterialAccessed: false
      },
      createdAt: now
    };
    store.saveAnalystClaimLedgerEntry(entry);
    const options = { store, frontier: new FocusedFrontier() };

    const ledger = await body(await handleApiRequest(api("/v1/analyst/claim-ledger?q=Fjord"), options));
    expect(ledger).toMatchObject({
      contract: {
        endpoint: "/v1/analyst/claim-ledger",
        metadataOnly: true,
        safeForApi: true,
        rawLeakMaterialAccessed: false,
        objectKeysExposed: false
      },
      runStatusClarity: {
        totalClaims: 1,
        reviewRequired: 1,
        graphEligible: 0,
        stixEligible: 0
      },
      entries: [
        expect.objectContaining({
          id: "claim_fjord_accounts",
          claimKind: "affected_accounts_claim",
          company: "Fjord Energy AS",
          sourceHash: "hash_fjord_claim",
          ledgerStatus: "metadata_review",
          eligibilityBlockers: expect.arrayContaining(["claim_not_trusted"])
        })
      ]
    });

    const promote = await body(await handleApiRequest(api("/v1/analyst/claim-ledger/claim_fjord_accounts/actions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "analyst-6" },
      body: JSON.stringify({ action: "promote", dryRun: false, reason: "Validated against public notice and safe metadata.", confidence: 0.88 })
    }), options));
    expect(promote).toMatchObject({
      contract: {
        metadataOnly: true,
        graphPromotionAutomatic: false,
        stixPromotionAutomatic: false
      },
      result: {
        persisted: true,
        nextStatus: "trusted",
        graphEligible: true,
        stixEligible: true
      },
      entry: {
        ledgerStatus: "trusted",
        confidence: 0.88,
        reviewedBy: "analyst-6"
      }
    });
    expect(store.listAnalystClaimLedgerEntries()[0]).toMatchObject({
      ledgerStatus: "trusted",
      graphEligible: true,
      stixEligible: true,
      reviewedBy: "analyst-6"
    });

    const legalHold = await body(await handleApiRequest(api("/v1/analyst/claim-ledger/claim_fjord_accounts/actions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "legal-1" },
      body: JSON.stringify({ action: "attach_legal_hold", dryRun: false, reason: "Preserve claim while counsel reviews notification wording." })
    }), options));
    expect(legalHold).toMatchObject({
      result: {
        persisted: true,
        nextStatus: "trusted",
        graphEligible: false,
        stixEligible: false
      },
      entry: {
        legalHold: true,
        retentionClass: "legal_hold",
        eligibilityBlockers: expect.arrayContaining(["legal_hold"])
      }
    });
    expect(JSON.stringify(ledger)).not.toContain("customer-dump");
    expect(JSON.stringify(promote)).not.toContain("password");
    expect(JSON.stringify(legalHold)).not.toContain("object/key");
  });

  test("executes approved public canary activation collection and exposes operator view", async () => {
    const store = new InMemoryScraperStore();
    const objectStore = new InMemoryObjectEvidenceStore();
    const frontier = new FocusedFrontier();
    const canaryFetch = async () => new Response(`
      <rss><channel><item>
        <title>APT42 phishing campaign and CVE-2026-11111 exploitation</title>
        <link>https://example.test/apt42-campaign</link>
        <description>APT42 used malware in a phishing campaign targeting energy sector victims. Indicator 198.51.100.44 observed.</description>
        <pubDate>Sun, 24 May 2026 10:00:00 GMT</pubDate>
      </item></channel></rss>
    `, { status: 200, headers: { "content-type": "application/rss+xml" } });
    const options = { store, frontier, objectStore, canaryFetch };

    const activationBlocked = await body(await handleApiRequest(api("/v1/sources/canary-activation", { method: "POST", body: "{}" }), options));
    expect((activationBlocked.error as { code: string }).code).toBe("approval_required");

    const activation = await body(await handleApiRequest(api("/v1/sources/canary-activation", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "analyst-1", generatedAt: "2026-05-24T10:00:00.000Z" })
    }), options));
    expect((activation.activation as { activated: unknown[] }).activated.length).toBeGreaterThanOrEqual(8);
    expect(store.listSources().every((item) => item.status === "active")).toBe(true);

    const run = await body(await handleApiRequest(api("/v1/ops/canary/run", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "analyst-1", maxSources: 2, maxTasks: 1, generatedAt: "2026-05-24T10:01:00.000Z" })
    }), options));
    const canaryRunId = (run.canaryRun as { runId: string }).runId;
    expect(run.canaryRun).toMatchObject({
      mode: "production_canary",
      runId: expect.any(String),
      planId: expect.any(String),
      completedTaskCount: 1,
      failedTaskCount: 0,
      retryScheduledCount: 0,
      retryExhaustedCount: 0,
      remainingQueuedTaskCount: 1,
      insertedCaptureCount: 1,
      health: {
        freshnessSeconds: 0,
        errorRate: 0,
        duplicateRate: 0,
        promotionYield: 1
      }
    });
    const captures = store.listCaptures();
    expect(captures).toHaveLength(1);
    expect(captures[0]?.storageKind).toBe("external_object");
    expect(captures[0]?.objectRef).toBeDefined();
    expect(captures[0]?.body).toBeUndefined();
    expect(String(captures[0]?.metadata.safeExcerpt)).toContain("APT42");
    expect(captures[0]?.metadata.fetchMode).toBe("injected_proof_fetch");
    expect(captures[0]?.metadata.fetchProvenance).toMatchObject({
      mode: "injected_proof_fetch",
      adapterVersion: "public_canary_fetcher:v1",
      httpStatus: 200,
      bounded: true,
      truncated: false
    });
    expect(captures[0]?.metadata.finalUrlHash).toEqual(expect.any(String));
    expect(store.listIncidents().length).toBeGreaterThanOrEqual(1);
    expect(objectStore.getObject(captures[0]!.objectRef!)).toBeDefined();
    const canaryRunRecord = store.listRuns()[0];
    expect(canaryRunRecord?.id).toBe(canaryRunId);
    expect(canaryRunRecord).toMatchObject({
      status: "running",
      taskCount: 2,
      captureCount: 1,
      incidentCount: 1
    });

    const operator = await body(await handleApiRequest(api("/v1/ops/canary"), options)) as CanaryOperatorResponseForTest;
    const operatorView = operator.operatorView;
    expect(operatorView.activeSources.length).toBeGreaterThanOrEqual(8);
    expect(operatorView.latestRun).toMatchObject({ runId: canaryRunRecord?.id, status: "running", taskCount: 2, captureCount: 1, incidentCount: 1 });
    expect(operatorView.latestCaptures).toHaveLength(1);
    expect(operatorView.schedulerHealth).toMatchObject({ errorRate: 0, promotionYield: 1, duplicateRate: 0, retryScheduledCount: 0, retryExhaustedCount: 0 });
    expect(operatorView.runtime).toMatchObject({
      schemaVersion: "ti.public_canary_loop_runtime.v1",
      supervisorAttached: false,
      enabled: false,
      activateSources: false,
      controls: {
        canaryPortfolioOnly: true,
        activationRequiresHumanApproval: true,
        continuousLoopAutoActivation: false,
        boundedQueueRequired: true,
        dedupeBeforeWrite: true,
        retriesBounded: true,
        restrictedSourcesExcluded: true
      }
    });
    expect(operatorView.evidenceStorage).toMatchObject({
      productionEvidenceMode: "injected_proof_only",
      externalObjectCaptureCount: 1,
      inlineCaptureCount: 0,
      missingObjectReferenceCount: 0,
      nativeLiveHttpCaptureCount: 0,
      injectedProofFetchCaptureCount: 1,
      unknownFetchModeCaptureCount: 0
    });
    expect(operatorView.blockedOrHeldItems).toEqual([]);
    expect(operatorView.publicAnswerReadiness.find((item) => item.query === "APT42")?.captureCount).toBe(1);

    const consoleResponse = await handleApiRequest(api("/v1/ops/canary/console"), options);
    expect(consoleResponse.headers.get("content-type")).toContain("text/html");
    const consoleHtml = await consoleResponse.text();
    expect(consoleHtml).toContain("TI Canary Ops");
    expect(consoleHtml).toContain("Active Sources");
    expect(consoleHtml).toContain("Queued work");
    expect(consoleHtml).toContain("Runtime Loop");
    expect(consoleHtml).toContain("Evidence mode");
    expect(consoleHtml).toContain("Public Answer Readiness");
    expect(consoleHtml).toContain("Why Partial");
    expect(consoleHtml).toContain("APT42");
    expect(consoleHtml).not.toContain("198.51.100.44");
    expect(consoleHtml).not.toContain("public-canary-evidence/");
    expect(consoleHtml.toLowerCase()).not.toContain("password");

    const search = await body(await handleApiRequest(api("/v1/intel/search?q=APT42"), options));
    expect(search.status).toMatch(/ready|partial/);
    expect(JSON.stringify(search.publicTiAnswer)).toContain("public_answer_ux");
    expect(JSON.stringify(search.actorProfile)).toContain("APT42");

    const pauseBlocked = await body(await handleApiRequest(api("/v1/sources/canary-pause", { method: "POST", body: "{}" }), options));
    expect((pauseBlocked.error as { code: string }).code).toBe("approval_required");
    const pause = await body(await handleApiRequest(api("/v1/sources/canary-pause", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "analyst-1", generatedAt: "2026-05-24T10:02:00.000Z" })
    }), options));
    expect((pause.pause as { paused: unknown[] }).paused.length).toBeGreaterThanOrEqual(8);
    expect(store.listSources().filter((item) => item.metadata?.canaryPortfolio === true).every((item) => item.status === "paused")).toBe(true);
  });

  test("records native live HTTP provenance for canary captures", async () => {
    const store = new InMemoryScraperStore();
    const objectStore = new InMemoryObjectEvidenceStore();
    const frontier = new FocusedFrontier();
    const server = Bun.serve({
      port: 0,
      fetch: () => new Response(`
        <rss><channel><item>
          <title>APT42 native canary HTTP evidence</title>
          <link>https://example.test/native/apt42</link>
          <description>APT42 targeted energy sector victims with phishing infrastructure and malware. Indicator 203.0.113.88 observed.</description>
          <pubDate>Sun, 24 May 2026 10:03:00 GMT</pubDate>
        </item></channel></rss>
      `, { status: 200, headers: { "content-type": "application/rss+xml" } })
    });
    try {
      store.saveSource(source({
        id: "src_native_canary_http",
        name: "Native HTTP Canary",
        type: "rss",
        url: server.url.toString(),
        status: "active",
        metadata: { canaryPortfolio: true },
        governance: {
          approvalState: "approved",
          approvalRequired: false,
          metadataOnly: false,
          approvedAt: "2026-05-24T10:00:00.000Z",
          approvedBy: "operator",
          policyVersion: "collection-policy:v1"
        }
      }));

      const run = await runCanaryCollectionCycle({
        store,
        frontier,
        objectStore,
        maxSources: 1,
        maxTasks: 1,
        now: () => "2026-05-24T10:03:00.000Z"
      });
      expect(run).toMatchObject({
        activationApplied: false,
        completedTaskCount: 1,
        failedTaskCount: 0,
        insertedCaptureCount: 1,
        incidentCount: 1
      });
      const capture = store.listCaptures()[0];
      expect(capture?.storageKind).toBe("external_object");
      expect(capture?.metadata.fetchMode).toBe("native_live_http");
      expect(capture?.metadata.fetchProvenance).toMatchObject({
        mode: "native_live_http",
        adapterVersion: "public_canary_fetcher:v1",
        httpStatus: 200,
        bounded: true,
        userAgent: "hanasand-ti-scraper-canary/0.1 (+safe-public-canary)"
      });
      expect(capture?.metadata.finalUrlHash).toEqual(expect.any(String));
      expect(capture?.metadata.responseBytes).toEqual(expect.any(Number));
      expect(store.getSource("src_native_canary_http")?.metadata?.lastCanaryFetchMode).toBe("native_live_http");
      const operator = buildCanaryOperatorSummary({ store, frontier, generatedAt: "2026-05-24T10:03:00.000Z" });
      expect(operator.evidenceStorage).toMatchObject({
        productionEvidenceMode: "native_live_http",
        nativeLiveHttpCaptureCount: 1,
        injectedProofFetchCaptureCount: 0,
        unknownFetchModeCaptureCount: 0,
        externalObjectCaptureCount: 1
      });
      expect(operator.latestCaptures[0]).toMatchObject({
        fetchProvenance: {
          mode: "native_live_http",
          httpStatus: 200,
          finalUrlHash: expect.any(String),
          bytesReceived: expect.any(Number)
        }
      });
    } finally {
      server.stop(true);
    }
  });

  test("publishes attached background canary loop runtime state", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const objectStore = new InMemoryObjectEvidenceStore();
    const canaryLoop = startCanaryCollectionLoop({
      store,
      frontier,
      objectStore,
      enabled: false,
      intervalSeconds: 120,
      maxSources: 7,
      maxTasks: 2,
      maxBytes: 64_000,
      timeoutMs: 5_000,
      queueLimit: 42,
      operatorId: "runtime-proof",
      activateSources: false,
      now: () => "2026-05-24T10:04:00.000Z"
    });
    try {
      const operator = await body(await handleApiRequest(api("/v1/ops/canary"), {
        store,
        frontier,
        objectStore,
        canaryLoop
      })) as CanaryOperatorResponseForTest;
      expect(operator.operatorView.runtime).toMatchObject({
        schemaVersion: "ti.public_canary_loop_runtime.v1",
        supervisorAttached: true,
        enabled: false,
        running: false,
        startedAt: "2026-05-24T10:04:00.000Z",
        intervalSeconds: 120,
        cycleCount: 0,
        successCount: 0,
        errorCount: 0,
        consecutiveErrorCount: 0,
        maxSources: 7,
        maxTasks: 2,
        queueLimit: 42,
        activateSources: false,
        controls: {
          canaryPortfolioOnly: true,
          activationRequiresHumanApproval: true,
          continuousLoopAutoActivation: false,
          nativeFetchDefault: true,
          objectBoundaryConfigured: true,
          boundedQueueRequired: true,
          dedupeBeforeWrite: true,
          retriesBounded: true,
          restrictedSourcesExcluded: true
        }
      });
      const consoleResponse = await handleApiRequest(api("/v1/ops/canary/console"), {
        store,
        frontier,
        objectStore,
        canaryLoop
      });
      const html = await consoleResponse.text();
      expect(html).toContain("Runtime Loop");
      expect(html).toContain("Supervisor");
      expect(html).toContain("120s");
    } finally {
      canaryLoop.stop();
    }
  });

  test("promotes fresh multi-actor canary captures into public intel answers", async () => {
    const store = new InMemoryScraperStore();
    const objectStore = new InMemoryObjectEvidenceStore();
    const frontier = new FocusedFrontier();
    const canaryFetch = async (url: string) => {
      if (url.includes("microsoft.com")) {
        return new Response(`
          <rss><channel><item>
            <title>APT42 credential theft infrastructure observed in 2026</title>
            <link>https://example.test/microsoft/apt42</link>
            <description>APT42 targeted government and energy sector victims with phishing infrastructure, malware delivery, and indicator 203.0.113.42.</description>
            <pubDate>Sun, 24 May 2026 10:05:00 GMT</pubDate>
          </item></channel></rss>
        `, { status: 200, headers: { "content-type": "application/rss+xml" } });
      }
      if (url.includes("cloud.google.com")) {
        return new Response(`
          <rss><channel><item>
            <title>Turla activity uses Snake malware and command infrastructure</title>
            <link>https://example.test/google/turla</link>
            <description>Turla operators used Snake malware against government victims and maintained command and control infrastructure at 198.51.100.77.</description>
            <pubDate>Sun, 24 May 2026 10:06:00 GMT</pubDate>
          </item></channel></rss>
        `, { status: 200, headers: { "content-type": "application/rss+xml" } });
      }
      return new Response(`
        <rss><channel><item>
          <title>CVE-2026-11111 public advisory</title>
          <link>https://example.test/cve-2026-11111</link>
          <description>Public advisory references CVE-2026-11111 exploitation and indicator 192.0.2.15.</description>
          <pubDate>Sun, 24 May 2026 10:04:00 GMT</pubDate>
        </item></channel></rss>
      `, { status: 200, headers: { "content-type": "application/rss+xml" } });
    };
    const options = { store, frontier, objectStore, canaryFetch };

    await body(await handleApiRequest(api("/v1/sources/canary-activation", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "analyst-1", generatedAt: "2026-05-24T10:00:00.000Z" })
    }), options));
    const run = await body(await handleApiRequest(api("/v1/ops/canary/run", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "analyst-1", maxSources: 4, maxTasks: 4, generatedAt: "2026-05-24T10:07:00.000Z" })
    }), options));
    expect(run.canaryRun).toMatchObject({
      completedTaskCount: 4,
      failedTaskCount: 0,
      insertedCaptureCount: 4,
      incidentCount: 4,
      remainingQueuedTaskCount: 0
    });

    const operator = await body(await handleApiRequest(api("/v1/ops/canary"), options)) as CanaryOperatorResponseForTest;
    const readiness = operator.operatorView.publicAnswerReadiness;
    expect(readiness.find((item) => item.query === "APT42")).toMatchObject({
      captureCount: 1,
      whyPartial: expect.arrayContaining([expect.stringContaining("can cite canary captures")])
    });
    expect(readiness.find((item) => item.query === "Turla")).toMatchObject({
      captureCount: 1,
      whyPartial: expect.arrayContaining([expect.stringContaining("can cite canary captures")])
    });

    for (const query of ["APT42", "Turla"]) {
      const search = await body(await handleApiRequest(api(`/v1/intel/search?q=${encodeURIComponent(query)}`), options)) as unknown as {
        status: string;
        publicTiAnswer: {
          safeSummary: string[];
          evidenceLedgerReferences: unknown[];
          ux: { evidenceStageLabels: { captured_page: { count: number } } };
        };
        actorProfile: {
          datasets: { evidenceStageCounts: { captured_page: number } };
          provenance: Array<{ evidenceStage: string }>;
        };
      };
      expect(search.status).toMatch(/ready|partial/);
      expect(search.publicTiAnswer.safeSummary).not.toEqual(["Searching"]);
      expect(search.actorProfile.datasets.evidenceStageCounts.captured_page).toBeGreaterThan(0);
      expect(search.publicTiAnswer.evidenceLedgerReferences.length).toBeGreaterThan(0);
      expect(search.publicTiAnswer.ux.evidenceStageLabels.captured_page.count).toBeGreaterThan(0);
      expect(search.actorProfile.provenance.every((item: { evidenceStage: string }) => item.evidenceStage === "captured_page")).toBe(true);
      expect(JSON.stringify(search.publicTiAnswer)).toContain(query);
    }

    const readinessProof = await body(await handleApiRequest(api("/v1/ops/canary/readiness?requiredQueries=APT42,Turla&generatedAt=2026-05-24T10:07:00.000Z"), options)) as CanaryReadinessResponseForTest;
    const activeSourceCount = readinessProof.readiness.evidence.activeSourceCount;
    expect(readinessProof.readiness).toMatchObject({
      schemaVersion: "ti.public_canary_readiness.v1",
      decision: "promote",
      evidence: {
        activeSourceCount: 10,
        externalObjectCaptureCount: 4,
        missingObjectReferenceCount: 0,
        promotionYield: 1
      },
      controls: {
        activationRequiresHumanApproval: true,
        continuousLoopAutoActivation: false,
        restrictedSourcesExcluded: true,
        reversiblePauseAvailable: true,
        nativeLiveHttpRequired: false
      }
    });
    expect(activeSourceCount).toBeGreaterThanOrEqual(8);
    expect(readinessProof.readiness.queryReadiness).toEqual(expect.arrayContaining([
      expect.objectContaining({ query: "APT42", captureCount: 1, readyForPublicAnswer: true }),
      expect.objectContaining({ query: "Turla", captureCount: 1, readyForPublicAnswer: true })
    ]));
    expect(readinessProof.readiness.blockers).toEqual([]);
    expect(readinessProof.readiness.proofCommands).toContain("bun run check:canary-proof-path");

    const productionReadiness = await body(await handleApiRequest(api("/v1/ops/canary/readiness?requiredQueries=APT42,Turla&requireNativeLiveHttp=true&generatedAt=2026-05-24T10:07:00.000Z"), options)) as CanaryReadinessResponseForTest;
    expect(productionReadiness.readiness.decision).toBe("hold");
    expect(productionReadiness.readiness.controls.nativeLiveHttpRequired).toBe(true);
    expect(productionReadiness.readiness.blockers).toContain("no native live HTTP canary captures are available for production readiness");
  });

  test("accepts human-approved canary console form actions without weakening API gates", async () => {
    const store = new InMemoryScraperStore();
    const objectStore = new InMemoryObjectEvidenceStore();
    const frontier = new FocusedFrontier();
    const canaryFetch = async () => new Response(`
      <rss><channel><item>
        <title>APT42 public canary form action proof</title>
        <link>https://example.test/forms/apt42</link>
        <description>APT42 targeted public sector victims with phishing infrastructure and malware. Indicator 203.0.113.55 observed.</description>
        <pubDate>Sun, 24 May 2026 10:08:00 GMT</pubDate>
      </item></channel></rss>
    `, { status: 200, headers: { "content-type": "application/rss+xml" } });
    const options = { store, frontier, objectStore, canaryFetch };
    const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();
    const formHeaders = { "content-type": "application/x-www-form-urlencoded" };

    const activate = await handleApiRequest(api("/v1/sources/canary-activation", {
      method: "POST",
      headers: formHeaders,
      body: form({ operatorApproval: "true", approvedBy: "console-test", generatedAt: "2026-05-24T10:08:00.000Z" })
    }), options);
    expect(activate.status).toBe(303);
    expect(activate.headers.get("location")).toContain("/v1/ops/canary/console?status=activated");
    expect(store.listSources().filter((item) => item.metadata?.canaryPortfolio === true && item.status === "active").length).toBeGreaterThanOrEqual(8);

    const run = await handleApiRequest(api("/v1/ops/canary/run", {
      method: "POST",
      headers: formHeaders,
      body: form({ operatorApproval: "true", approvedBy: "console-test", maxSources: "1", maxTasks: "1", generatedAt: "2026-05-24T10:09:00.000Z" })
    }), options);
    expect(run.status).toBe(303);
    expect(run.headers.get("location")).toContain("/v1/ops/canary/console?status=ran");
    expect(store.listCaptures()).toHaveLength(1);
    expect(store.listCaptures()[0]?.storageKind).toBe("external_object");

    const pause = await handleApiRequest(api("/v1/sources/canary-pause", {
      method: "POST",
      headers: formHeaders,
      body: form({ operatorApproval: "true", approvedBy: "console-test", generatedAt: "2026-05-24T10:10:00.000Z" })
    }), options);
    expect(pause.status).toBe(303);
    expect(pause.headers.get("location")).toContain("/v1/ops/canary/console?status=paused");
    expect(store.listSources().filter((item) => item.metadata?.canaryPortfolio === true).every((item) => item.status === "paused")).toBe(true);
  });

  test("keeps continuous canary collection separate from source activation approval", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const objectStore = new InMemoryObjectEvidenceStore();
    store.saveSource(source({
      id: "src_non_canary_public",
      status: "active",
      type: "rss",
      url: "https://non-canary.example.test/feed.xml",
      metadata: { canaryPortfolio: false }
    }));
    const canaryFetch = async () => new Response(`
      <rss><channel><item>
        <title>Turla public canary continuous collection proof</title>
        <link>https://example.test/canary/turla</link>
        <description>Turla operators used Snake malware and command infrastructure. Indicator 198.51.100.88 observed.</description>
        <pubDate>Sun, 24 May 2026 10:12:00 GMT</pubDate>
      </item></channel></rss>
    `, { status: 200, headers: { "content-type": "application/rss+xml" } });

    const unapprovedRun = await runCanaryCollectionCycle({
      store,
      frontier,
      objectStore,
      fetch: canaryFetch,
      activateSources: false,
      maxSources: 2,
      maxTasks: 2,
      operatorId: "background-loop",
      now: () => "2026-05-24T10:11:00.000Z"
    });
    expect(unapprovedRun).toMatchObject({
      activationApplied: false,
      activatedSourceCount: 0,
      activeSourceCount: 0,
      queuedTaskCount: 0,
      completedTaskCount: 0
    });
    expect(store.listSources()).toHaveLength(1);
    expect(store.listCaptures()).toHaveLength(0);

    const activation = activatePublicCanarySources({
      store,
      operatorId: "operator-approved",
      now: "2026-05-24T10:12:00.000Z"
    });
    expect(activation.activated.length).toBeGreaterThanOrEqual(8);

    const approvedRun = await runCanaryCollectionCycle({
      store,
      frontier,
      objectStore,
      fetch: canaryFetch,
      activateSources: false,
      maxSources: 1,
      maxTasks: 1,
      operatorId: "background-loop",
      now: () => "2026-05-24T10:13:00.000Z"
    });
    expect(approvedRun).toMatchObject({
      activationApplied: false,
      activatedSourceCount: 0,
      activeSourceCount: 1,
      queuedTaskCount: 1,
      completedTaskCount: 1,
      insertedCaptureCount: 1,
      incidentCount: 1
    });
    expect(store.listCaptures()[0]?.storageKind).toBe("external_object");
    expect(store.listCaptures().every((capture) => capture.sourceId !== "src_non_canary_public")).toBe(true);
    expect(store.listSources().filter((item) => item.metadata?.canaryPortfolio === true && item.status === "active").length).toBeGreaterThanOrEqual(8);
  });

  test("publishes canary soak health across repeated portfolio-only cycles", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const objectStore = new InMemoryObjectEvidenceStore();
    const canaryFetch = async (url: string) => {
      const title = url.includes("microsoft.com")
        ? "APT42 public canary soak proof"
        : "Turla public canary soak proof";
      const description = title.includes("APT42")
        ? "APT42 targeted public sector victims with phishing infrastructure and malware."
        : "Turla used Snake malware and command infrastructure against government victims.";
      return new Response(`
        <rss><channel><item>
          <title>${title}</title>
          <link>https://example.test/canary-soak/${encodeURIComponent(title)}</link>
          <description>${description}</description>
          <pubDate>Sun, 24 May 2026 10:30:00 GMT</pubDate>
        </item></channel></rss>
      `, { status: 200, headers: { "content-type": "application/rss+xml" } });
    };
    const options = { store, frontier, objectStore, canaryFetch };
    store.saveSource(source({
      id: "src_non_canary_soak",
      status: "active",
      type: "rss",
      url: "https://non-canary.example.test/feed.xml",
      metadata: { canaryPortfolio: false }
    }));

    await body(await handleApiRequest(api("/v1/sources/canary-activation", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "soak-proof", generatedAt: "2026-05-24T10:20:00.000Z" })
    }), options));
    await body(await handleApiRequest(api("/v1/ops/canary/run", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "soak-proof", maxSources: 1, maxTasks: 1, generatedAt: "2026-05-24T10:21:00.000Z" })
    }), options));
    await body(await handleApiRequest(api("/v1/ops/canary/run", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "soak-proof", maxSources: 2, maxTasks: 1, generatedAt: "2026-05-24T10:22:00.000Z" })
    }), options));

    const soak = await body(await handleApiRequest(api("/v1/ops/canary/soak?minCycles=2&generatedAt=2026-05-24T10:22:00.000Z"), options)) as CanarySoakResponseForTest;
    expect(soak.soak).toMatchObject({
      schemaVersion: "ti.public_canary_soak.v1",
      decision: "promote",
      metrics: {
        cycleCount: 2,
        totalCaptureCount: 2,
        totalIncidentCount: 2,
        activeSourceCount: 10,
        externalObjectCaptureCount: 2,
        missingObjectReferenceCount: 0,
        promotionYield: 1
      },
      controls: {
        canaryPortfolioOnly: true,
        activationRequiresHumanApproval: true,
        continuousLoopAutoActivation: false,
        boundedQueueRequired: true,
        objectBoundaryRequired: true,
        nativeLiveHttpRequired: false,
        restrictedSourcesExcluded: true
      }
    });
    const productionSoak = await body(await handleApiRequest(api("/v1/ops/canary/soak?minCycles=2&requireNativeLiveHttp=true&generatedAt=2026-05-24T10:22:00.000Z"), options)) as CanarySoakResponseForTest;
    expect(productionSoak.soak.decision).toBe("hold");
    expect(productionSoak.soak.controls.nativeLiveHttpRequired).toBe(true);
    expect(productionSoak.soak.blockers).toContain("no native live HTTP canary captures are available in the soak window");
    expect(soak.soak.cycles).toHaveLength(2);
    expect(soak.soak.blockers).toEqual([]);
    expect(soak.soak.proofCommands).toContain("bun run check:canary-proof-path");
    expect(store.listCaptures().every((capture) => capture.sourceId !== "src_non_canary_soak")).toBe(true);
  });

  test("persists canary metadata through the file-backed scraper store boundary", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ti-file-backed-store-"));
    try {
      const snapshotPath = join(dir, "metadata", "scraper-store.json");
      const store = new FileBackedScraperStore({ snapshotPath });
      store.saveSource(source({ id: "src_persisted", status: "active" }));
      const capture = fixtureCapture({
        id: "cap_persisted",
        sourceId: "src_persisted",
        body: undefined,
        storageKind: "external_object",
        objectRef: {
          bucket: "public-canary-evidence",
          key: "global/src_persisted/cap_persisted/hash.bin",
          sizeBytes: 42,
          sha256: "hash"
        },
        metadata: {
          safeExcerpt: "APT42 public canary evidence",
          bodyExternalized: true
        }
      });
      store.saveCapture(capture);

      const reloaded = new FileBackedScraperStore({ snapshotPath });
      expect(reloaded.getSource("src_persisted")?.status).toBe("active");
      expect(reloaded.getCapture("cap_persisted")).toMatchObject({
        storageKind: "external_object",
        body: undefined,
        metadata: {
          bodyExternalized: true
        }
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("records canary retry and run health when a public source fetch fails", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const canaryFetch = async () => new Response("temporary upstream failure", { status: 503 });
    const options = { store, frontier, objectStore: new InMemoryObjectEvidenceStore(), canaryFetch };

    await body(await handleApiRequest(api("/v1/sources/canary-activation", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "analyst-1", generatedAt: "2026-05-24T10:00:00.000Z" })
    }), options));
    const run = await body(await handleApiRequest(api("/v1/ops/canary/run", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "analyst-1", maxSources: 1, maxTasks: 1, generatedAt: "2026-05-24T10:01:00.000Z", timeoutMs: 1000 })
    }), options));

    expect(run.canaryRun).toMatchObject({
      mode: "production_canary",
      queuedTaskCount: 1,
      completedTaskCount: 0,
      failedTaskCount: 1,
      retryScheduledCount: 1,
      retryExhaustedCount: 0,
      remainingQueuedTaskCount: 1,
      health: {
        errorRate: 1,
        promotionYield: 0
      }
    });
    expect(store.listRuns()[0]).toMatchObject({ status: "running", taskCount: 1, captureCount: 0, incidentCount: 0 });
    expect(frontier.snapshot()).toHaveLength(1);
    expect(store.listSources()[0]?.health?.status).toBe("degraded");

    const operator = await body(await handleApiRequest(api("/v1/ops/canary"), options));
    expect(operator.operatorView).toMatchObject({
      queue: { queued: 1, leased: 0, deadLetters: 0 },
      schedulerHealth: {
        errorRate: 0.01,
        retryScheduledCount: 1,
        retryExhaustedCount: 0,
        failingSourceCount: 0,
        degradedSourceCount: 1
      }
    });
  });

  test("publishes enterprise contract index for CTI integration without unsafe example leaks", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier() };

    const contract = await body(await handleApiRequest(api("/v1/contracts"), options));
    const surfaces = contract.surfaces as Array<{ name: string; path: string; responseKeys: string[]; guarantees: string[] }>;
    const routeInventory = contract.routeInventory as {
      count: number;
      source: string;
      routes: Array<{ method: string; path: string; surface: string; responseKeys: string[]; guarantees: string[] }>;
    };
    const routeTruthAudit = contract.routeTruthAudit as {
      schemaVersion: string;
      owner: string;
      expectedRouteInventoryCount: number;
      canonicalPublicPost: { path: string; method: string; mapsTo: string; stableFields: string[] };
      fixtures: Array<{ name: string; status: string; route: string; proofCommand: string; auditFields: string[]; publicPostCompatible: boolean; noLeakRequired: boolean; rollbackPath: string }>;
      proofCommands: string[];
      guarantee: string;
    };
    const publicWrapperResponsiveAudit = contract.publicWrapperResponsiveAudit as {
      schemaVersion: string;
      owner: string;
      route: string;
      publicWrapper: {
        canonicalMethod: string;
        canonicalPath: string;
        noDefaultQuery: boolean;
        stableRunIds: boolean;
        pollingSeconds: number;
        unknownCopy: string;
        updatedSemantics: string;
        stableFields: string[];
      };
      fixtures: Array<{
        name: string;
        query: string;
        queryClass: string;
        expectedUxState: string;
        expectedDisplayState: string;
        warningCodes: string[];
        pollSeconds: number;
        stableRunId: boolean;
        publicPostCompatible: boolean;
        noDefaultActor: boolean;
        noLeakRequired: boolean;
        noStaleCacheCopy: boolean;
        compactUnknownCopy?: string;
        stableFields: string[];
      }>;
      noLeakExamples: Array<{ scenario: string; forbidden: string[] }>;
      proofCommands: string[];
      guarantee: string;
    };
    const publicWrapperDeltaAudit = contract.publicWrapperDeltaAudit as {
      schemaVersion: string;
      owner: string;
      route: string;
      publicWrapperRoute: string;
      stableFields: string[];
      cursorContract: { pollingSeconds: number; updatedSemantics: string; emptyDelta: string };
      fixtures: Array<{
        name: string;
        query: string;
        queryClass: string;
        deltaKind: string;
        expectedDisplayState: string;
        warningCodes: string[];
        stableRunId: boolean;
        pollSeconds: number;
        requiresPollCursor: boolean;
        requiresDeltaCursor: boolean;
        publicPostCompatible: boolean;
        noLeakRequired: boolean;
        stableFields: string[];
        handoffs: string[];
      }>;
      handoffs: Record<string, string[]>;
      noLeakExamples: Array<{ scenario: string; forbidden: string[] }>;
      proofCommands: string[];
      guarantee: string;
    };
    const publicCompatibility = contract.publicCompatibility as {
      canonicalMethod: string;
      canonicalPublicPath: string;
      mapsTo: string;
      stableFields: string[];
      statusMapping: Record<string, string>;
      publicAnswerContract: {
        schemaVersion: string;
        field: string;
        nestedAnswerField: string;
        requiredSections: string[];
        safeWordingGuarantee: string;
      };
    };
    const enterpriseApiSurface = contract.enterpriseApiSurface as {
      schemaVersion: string;
      status: string;
      authBoundary: {
        schemaVersion: string;
        mode: string;
        requiredForwardedHeaders: string[];
        optionalForwardedHeaders: string[];
        serviceTokenContext: { header: string; validationOwner: string; scraperStoresToken: boolean; auditField: string };
        authzModel: { scopes: string[]; adminOnlyRoutes: string[] };
        roleContracts: {
          analystRoles: string[];
          sourceApprovalRoles: string[];
          readWriteSeparation: { readScopes: string[]; writeScopes: string[]; rule: string };
        };
        tenantContract: { header: string; requiredForProduction: boolean; isolationRule: string };
        requesterContract: { header: string; requiredForProduction: boolean; auditOnlyHere: boolean };
        auditLogging: { requiredFields: string[]; mutationDecisions: string[]; noSecretRule: string };
        secretHandling: { bearerTokensAcceptedHere: boolean; logRedaction: string[] };
      };
      identity: { tenantHeader: string; requesterHeader: string; requestIdHeader: string };
      idempotency: { header: string; requiredOn: string[]; conflictCode: string; retryRule: string };
      pagination: { style: string; requestFields: string[]; responseFields: string[]; maxLimit: number; paginatedRoutes: string[] };
      tenantBoundary: { schemaVersion: string; appliedBefore: string[]; fallbackMode: string; crossTenantFailureCode: string; projectionRule: string };
      versioning: {
        schemaVersion: string;
        currentVersion: string;
        routePrefix: string;
        compatibilityStatus: string;
        versionHeader: string;
        responseHeaders: string[];
        deprecationHeaders: string[];
        minimumDeprecationNoticeDays: number;
        breakingChangeRequires: string[];
        additiveAllowedWithoutNewMajor: string[];
        removalBlockedFor: string[];
        legacyAliases: Array<{ route: string; canonicalRoute: string; status: string; removalPolicy: string }>;
        sunsetWorkflow: { states: string[]; requiredAuditFields: string[]; safeClientBehavior: string };
        examples: Array<{ name: string; route: string; headers: Record<string, string>; body: { error: { code: string; message: string; details: Record<string, unknown> } } }>;
      };
      rateLimits: {
        model: string;
        responseHeaders: string[];
        overloadCodes: string[];
        burstSensitiveRoutes: Array<{ route: string; retryAfterSeconds: number }>;
        perRouteHints: Array<{ route: string; policy: string; retryAfterSeconds: number; queuePressureCode: string; publicWrapperThrottle?: boolean; safeClientBehavior: string }>;
      };
      auditFields: { requiredOnMutations: string[]; requiredOnEvidenceBearingResponses: string[]; redactedAlways: string[] };
      errors: {
        codes: string[];
        retryableCodes: string[];
        failClosedCodes: string[];
        safeExamples: Array<{ name: string; status: number; headers: Record<string, string>; body: { error: { code: string; message: string; details: Record<string, unknown> } } }>;
      };
      openapi: { schemaVersion: string; openapi: string; paths: Record<string, unknown>; components: { schemas: Record<string, unknown> } };
      examples: Array<{ name: string; request: { method: string; path: string; headers: Record<string, string> }; responseKeys: string[] }>;
      noLeakGuarantee: string;
    };
    const sdkIntegration = contract.sdkIntegration as {
      schemaVersion: string;
      status: string;
      routes: Record<string, string>;
      polling: {
        intervalSeconds: number;
        requestFields: string[];
        responseFields: string[];
        terminalStates: string[];
        retryableStates: string[];
        emptyDelta: { status: string; changed: boolean; requiredFields: string[]; clientBehavior: string };
        duplicateRunReuse: { warningCode: string; requiredFields: string[]; clientBehavior: string };
        degradedModes: Record<string, { retryAfterSeconds: number; preserveLastGoodAnswer: boolean }>;
      };
      backoff: { preferHeaders: string[]; fallbackSeconds: number; maxClientPollSeconds: number; jitter: string };
      eventBoundary: { delivery: string; allowedModes: string[]; eventTypes: string[]; payloadRule: string; forbiddenPayloadFields: string[]; replayRule: string };
      examples: Array<{ name: string; client: string; steps: string[]; responseKeys: string[] }>;
      fixturePack: {
        schemaVersion: string;
        status: string;
        fixtureNames: string[];
        requiredFiles: string[];
        invariantFields: string[];
        noLeakAssertions: string[];
        generationRule: string;
      };
      compatibilityCi: {
        schemaVersion: string;
        status: string;
        requiredCommands: string[];
        gates: Array<{ name: string; proof: string; failureAction: string }>;
        clientMatrix: string[];
        artifactRule: string;
      };
      openapi: { schemaVersion: string; components: string[]; xSdkPollingContract: { intervalSeconds: number; cursorFields: string[]; retryHeaders: string[] } };
      noLeakGuarantee: string;
    };
    const clientCompatibilityMatrix = contract.clientCompatibilityMatrix as {
      schemaVersion: string;
      status: string;
      contractFreeze: {
        schemaVersion: string;
        openapi: string;
        routeCount: number;
        requiredComponentSchemas: string[];
        requiredSemantics: string[];
        noBreakingChangeRule: string;
      };
      sharedGuarantees: {
        errorCodes: string[];
        retryHeaders: string[];
        redactedAlways: string[];
        noLeakRule: string;
      };
      clients: Array<{
        client: string;
        primaryRoutes: string[];
        requiredResponseKeys: string[];
        states: string[];
        noLeakExamples?: string[];
        openapiComponents?: string[];
        forbiddenPayloadFields?: string[];
      }>;
      proof: { contractIndex: string; apiTests: string; noLeakSerialization: string };
    };
    const streamingWebhookCompatibility = contract.streamingWebhookCompatibility as {
      schemaVersion: string;
      status: string;
      deliveryModes: Array<{ mode: string; route: string; status: string }>;
      pollingCompatibility: { pollingPrimary: boolean; intervalSeconds: number; sameFields: string[]; sameStates: string[]; migrationRule: string };
      eventEnvelope: { schemaVersion: string; requiredFields: string[]; optionalSafeFields: string[] };
      eventTypes: Array<{ type: string; payloadFields: string[]; pollingEquivalent: string; noLeakRule: string }>;
      authAndGateway: { requiredForwardedHeaders: string[]; rateLimitHeaders: string[]; noSecretForwardingRule: string };
      webhooks: { failureBehavior: { maxAttempts: number; fallback: string }; auditFields: string[]; nonActions: string[] };
      integrations: Record<string, string[]>;
      examples: Array<{ name: string; event: Record<string, unknown> }>;
      noLeak: { guarantee: string; forbiddenPayloadFields: string[] };
      proofCommands: string[];
    };
    const publicWrapperCutoverReadiness = contract.publicWrapperCutoverReadiness as {
      schemaVersion: string;
      status: string;
      stableFieldAgreement: {
        requiredFields: string[];
        publicWrapperRoute: string;
        scraperNativeRoute: string;
        runPollingRoutes: string[];
        agreeingSurfaces: string[];
        requiredInCompatibilityFields: boolean;
        pollingSeconds: number;
        cursorRule: string;
        runIdRule: string;
      };
      fallbackWatch: {
        unknownQueryRule: string;
        allowedUnknownStates: string[];
        bannedFallbackCodes: string[];
        bannedTextPatterns: string[];
        watchTargets: string[];
        requiredCopyForNoResult: string;
      };
      deprecationWatch: {
        aliasRoute: string;
        canonicalRoute: string;
        state: string;
        headersWhenScheduled: string[];
        minimumNoticeDays: number;
        noSunsetBefore: string[];
        rollbackTriggers: string[];
        safeRollbackActions: string[];
      };
      gatewayWatch: {
        requiredForwardedHeaders: string[];
        tenantHeader: string;
        requesterHeader: string;
        requestIdHeader: string;
        rateLimitHeaders: string[];
      };
      compatibilityHandoffs: Record<string, string[]>;
      sdkAndStreamingCompatibility: { clientMatrixStatus: string; sdkFixtureSchemaVersion: string; pollingPrimary: boolean; futureDeliveryModes: string[]; eventTypes: string[] };
      proofCommands: string[];
      noLeakGuarantee: string;
    };
    const realtimeDeliveryPrototype = contract.realtimeDeliveryPrototype as {
      schemaVersion: string;
      status: string;
      featureFlags: {
        enabledByDefault: boolean;
        sseFlag: string;
        webhookFlag: string;
        deliveryWritesFlag: string;
        routeMountFlag: string;
        productionDefault: string;
      };
      deliveryModes: Array<{ mode: string; prototypeRoute: string; mounted: boolean; enabled: boolean; idempotencyKeyRequired?: boolean; registrationDryRunOnly?: boolean; failureFallback: string }>;
      eventEnvelope: { schemaVersion: string; requiredFields: string[]; optionalSafeFields: string[]; cursorGapBehavior: string };
      eventPrototypes: Array<{ type: string; source: string; enabled: boolean; payloadFields: string[]; pollingEquivalent: string; noLeakRule: string }>;
      authAndIdentity: { requiredForwardedHeaders: string[]; tenantHeader: string; requesterHeader: string; requestIdHeader: string; noSecretForwardingRule: string };
      idempotencyAndReplay: { runCreationHeader: string; webhookRegistrationHeader: string; replayCursors: string[]; duplicateRule: string; conflictCode: string };
      fallbackToPolling: { pollingPrimary: boolean; intervalSeconds: number; sameFields: string[]; sameStates: string[]; retryHeaders: string[]; clientBehavior: string };
      publicWrapperGuardrails: { noDefaultActor: boolean; noDemoOrStaleCacheCopy: boolean; unknownQueryCopy: string; stableRunIds: boolean; stableCursors: string[]; bannedFallbackCodes: string[] };
      errorSemantics: { retryableCodes: string[]; failClosedCodes: string[]; realtimeSpecificCodes: string[]; fallbackRule: string };
      handoffs: Record<string, string[]>;
      noLeak: { guarantee: string; forbiddenPayloadFields: string[] };
      proofCommands: string[];
    };
    const realtimeDeliverySoak = contract.realtimeDeliverySoak as {
      schemaVersion: string;
      status: string;
      mode: string;
      deliveryFlags: { enabledByDefault: boolean; requiredDisabledFlags: string[]; releaseRule: string; canaryRule: string };
      soakScenarios: Array<{ name: string; mode: string; decision: string; requiredFields: string[]; realtimeEnabled: boolean; mountedRouteAllowed: boolean; pollingFallbackRequired: boolean; noUnsafePayload: boolean }>;
      webhookOutbox: { schemaVersion: string; enabled: boolean; dryRunOnly: boolean; states: string[]; maxAttempts: number; retryableStatuses: number[]; idempotencyHeader: string; fallback: string; nonActions: string[] };
      cursorGapReplay: { schemaVersion: string; replayCursors: string[]; replayWindowSeconds: number; actions: string[]; errorCodes: string[]; clientRule: string };
      pollingFallback: { pollingPrimary: boolean; intervalSeconds: number; sameFields: string[]; sameStates: string[]; keepLastSafeAnswerOn: string[]; publicWrapperRoute: string; scraperNativeRoute: string };
      eventEnvelopeSoak: { schemaVersion: string; requiredFields: string[]; optionalSafeFields: string[]; eventTypes: string[]; ordering: string; dedupe: string; noPromotionRule: string };
      noLeak: { forbiddenPayloadFields: string[]; rule: string; rollbackOn: string[] };
      releaseGate: { decision: string; promotionBlockers: string[]; rollbackActions: string[] };
      proofCommands: string[];
    };
    const clientGenerationFreeze = contract.clientGenerationFreeze as {
      schemaVersion: string;
      status: string;
      mode: string;
      openapiManifest: { openapi: string; routeCount: number; source: string; operationIdRule: string; generatedArtifactRule: string };
      operationManifest: { requiredOperationIds: string[]; requiredPublicCompatibilityRoutes: string[]; requiredRunRoutes: string[]; futureDisabledRoutes: string[]; missingOperationBehavior: string };
      schemaManifest: { requiredSchemas: string[]; requiredSemantics: string[]; stableFieldSets: Record<string, string[]>; forbiddenBreakingChanges: string[] };
      generatedClients: Array<{ target: string; language: string; status: string; primaryRoutes: string[]; requiredSchemas: string[]; requiredFixtures: string[]; releaseGate: string }>;
      fixtureManifest: { schemaVersion: string; status: string; requiredFixtures: string[]; invariantFields: string[]; noLeakAssertions: string[]; fixtureRefreshRule: string };
      changelogGate: {
        schemaVersion: string;
        status: string;
        releasePolicy: string;
        semverPolicy: Record<string, string[]>;
        requiredChangeClasses: string[];
        breakingChangeBlockers: string[];
        deprecationPolicy: { minimumNoticeDays: number; publicWrapperAlias: string; canonicalRoute: string; releaseBoardRequired: boolean };
        fixtureGate: { requiredFiles: string[]; noLeakAssertions: string[] };
        generatedClientReleaseChecklist: string[];
        changelogEntries: Array<{ id: string; type: string; summary: string }>;
      };
      driftPolicy: { status: string; failClosedChecks: string[]; rollback: string; releaseBoardHandoff: string[] };
      noLeak: { forbiddenPayloadFields: string[]; rule: string };
      proofCommands: string[];
    };
    const frontendProgressiveUpdateContract = contract.frontendProgressiveUpdateContract as {
      schemaVersion: string;
      status: string;
      routes: { publicPost: string; scraperNativeGet: string; runStatus: string; runResults: string };
      polling: { primary: boolean; intervalSeconds: number; keepLastSafeAnswerOn: string[] };
      requiredFields: string[];
      stateMapping: Record<string, { uiState: string; copy: string; merge: string }>;
      mergeSemantics: { identityFields: string[]; cursorFields: string[]; rules: string[]; staleResponseBehavior: string };
      uiProofMatrix: Array<{ scenario: string; query: string; expectedUiState: string; requiredKeys: string[]; copyRule: string; noDefaultActor: boolean; noDemoCopy: boolean }>;
      noLeak: { forbiddenUiPayloadFields: string[]; copyRule: string };
      proofCommands: string[];
    };
    const scraperNativeReplacementReadiness = contract.scraperNativeReplacementReadiness as {
      schemaVersion: string;
      status: string;
      decision: string;
      routes: { frontend: string; publicPost: string; scraperNative: string; runStatus: string; runResults: string; contracts: string };
      promotionCriteria: string[];
      proofMatrix: Array<{ case: string; query: string; expectedState: string; decision: string; noDefaultActor: boolean; noDemoCopy: boolean; noUnsafePayload: boolean }>;
      blockers: string[];
      dependencies: { publicWrapperCutoverStatus: string; frontendProgressiveStatus: string; clientGenerationStatus: string; sdkFixtureStatus: string; pollingPrimary: boolean; pollingSeconds: number };
      noLeak: { forbiddenPayloadFields: string[]; rule: string };
      proofCommands: string[];
    };
    const apifyStoreReadiness = contract.apifyStoreReadiness as {
      schemaVersion: string;
      status: string;
      actor: { name: string; version: string; publishedBuildVersion: string; categories: string[]; outputContract: string };
      storeReadiness: {
        listingFields: Record<string, string>;
        knownBlockers: string[];
        readinessDecision: string;
        latestBuild: { buildVersion: string };
        latestProofRun: { runId: string; datasetId: string; rowCount: number; runtimeSeconds: number; usageUsd: number; projectedGrossRowRevenueUsdAfterPricing: number };
        dailyRunBaseline: { runId: string; datasetId: string; defaultQueryCount: number; rowCount: number; noLeakFailures: number; thinRowCount: number; singleSourceRowCount: number; knownQualityGaps: string[] };
      };
      defaultSampleInput: { queries: string[]; maxRowsPerQuery: number; includeActivity: boolean; includeTargets: boolean; includeTtps: boolean; includeSources: boolean; includeDatasets: boolean; includeCoverageGaps: boolean };
      sampleOutputDtos: Array<{ query: string; rowType: string; rawContentIncluded: boolean; safety: { metadataOnly: boolean; credentialsIncluded: boolean; stolenFilesIncluded: boolean; privateContentIncluded: boolean; actorInteraction: boolean } }>;
      publicProofDtos: Array<{ schemaVersion: string; runId: string; sourceRunId: string; sourceDatasetId: string; buildVersion: string; datasetId: string; query: string; rowCount: number; freshness: string; sourceFamilies: string[]; safetyContract: string; noLeakProof: Record<string, unknown> }>;
      frontendApiCompatibility: { states: Array<{ state: string; copy: string; refreshAfterSeconds: number; preservePriorAnswer: boolean }>; stableFields: string[]; unknownActorCopy: string; emptyDeltaRule: string };
      pricingHooks: { model: string; unitEvent: string; actorStartEvent: string; effectiveDate: string; rowPriceUsdPerThousand: number; actorStartPriceUsd: number; platformUsageIncludedForUsers: boolean; apifyMarginPercent: number; payoutStatus: string; revenueTelemetryHandoff: string };
      revenueConversionChecklist: { schemaVersion: string; telemetryState: string; payoutState: string; nextManualVerificationStep: string; checks: Array<{ id: string; state: string; proofField: string }> };
      pricingProof: { schemaVersion: string; starterTrialShape: { name: string; queryLimit: number }; paidDailyMonitoringShape: { name: string; defaultQueryCount: number; minimumSellableRowRate: number; minimumFreshRowRate: number }; usageCostGuard: { rowPriceUsdPerThousand: number; platformUsageCostUsd: number | null; estimatedCreatorRevenueUsd: number | null; maxCostPerUsefulRowUsd: number }; payoutRevenueSeparation: { paymentMethodState: string; beneficiaryState: string; withdrawalReadiness: string; externallyVerifiedRevenueUsd: number | null }; noLeakRequired: boolean };
      conversionTracking: { currentStorePageViews: null | number; currentUniqueUsers: null | number; currentTrialRuns: null | number; currentPaidRuns: null | number; currentConversionRate: null | number; metricsToTrack: string[]; handoffRoute: string };
      marketplaceTelemetryInputContract: { schemaVersion: string; routeVisibleOn: string[]; fields: string[]; currentValues: Record<string, null | number>; realDataRequired: boolean; unknownMeansNoClaim: boolean; forbiddenSyntheticClaims: string[] };
      payoutReadiness: { schemaVersion: string; payoutMethodState: string; beneficiaryState: string; withdrawalReadiness: string; externallyVerified: boolean; externalVerificationRequired: string[]; blockers: string[] };
      conversionExperiments: Array<{ id: string; expectedBuyer: string; successCriteria: string[]; stopLossCriteria: string[]; datasetValueProofField: string; buyerVisibleFields: string[]; noLeakRequired: boolean }>;
      buyerSampleRows: Array<{ id: string; rowClass: string; buyerVisibleFields: { actorSummary: string; freshClaimOrActivity: string; confidence: number; provenanceHash: string; noLeakProof: string; nextAnalystPivots: string[] } }>;
      operatorBlockerBoard: Array<{ owner: string; blocker: string; conversionImpact: string; nextAction: string }>;
      fakeTractionGuards: string[];
      buyerFacingConversionProof: {
        schemaVersion: string;
        routeVisibleOn: string[];
        readyProof: { runId: string; datasetId: string; rowCount: number; sellableRows: number; averageBuyerValueScore: number; monetizationDecision: string };
        buyerReadableExamples: Array<{ rowClass: string; decision: string; requiredVisibleFields: string[] }>;
        qualityLiftHandoff: { productSloField: string; contractField: string; graphLiftField: string; dryRun: boolean; willMutateSources: boolean; willStartCollection: boolean };
        conversionReadinessSummary: { minimumSellableRowRate: number; currentSellableRowRate: number; minimumAverageBuyerValueScore: number; currentAverageBuyerValueScore: number; nextAction: string };
        noLeakGuarantee: string;
      };
      sampleOutputSummaries: Array<{ query: string; runId: string; datasetId: string; summary: string; rowSafety: string }>;
      marketplaceGuardrails: { noPlaceholderDefaults: boolean; noHelloWorldSampleInput: boolean; noGenericCategories: boolean; noAiFlavoredCopy: boolean; safeOutputOnly: boolean; bannedListingTerms: string[] };
      safetyContract: { outputContract: string; rawContentIncluded: boolean; metadataOnly: boolean; forbiddenFields: string[] };
      proofCommands: string[];
      noLeakProof: { forbiddenPatternGate: string; proofFields: string[] };
    };
    const darkwebIndexFrontendContract = contract.darkwebIndexFrontendContract as {
      schemaVersion: string;
      status: string;
      route: string;
      publicRoute: string;
      apiRoutes: { status: string; search: string; contracts: string };
      sdkOpenapi: { operationIds: string[]; responseFields: string[]; pagination: { requestFields: string[]; responseFields: string[]; limitMax: number }; schemaRefs: string[] };
      table: { searchBox: { param: string; placeholderCopy: string; emptyDeltaCopy: string; noResultCopy: string }; filters: string[]; columns: string[]; chips: Record<string, string[]>; sort: { default: string; allowed: string[] } };
      safeDetailDrawer: { sections: string[]; fields: string[]; graphLinks: { allowed: string[]; holdRule: string }; stixTaxii: { exportState: string; rule: string } };
      copyRules: { legalTriageDisclaimer: string; compactCopy: boolean; blockedCopy: string; requiresReviewCopy: string; whatWasNotAccessedLabel: string; bannedPhrases: string[] };
      noLeak: { metadataOnly: boolean; rawUnsafeUrlPublicOutputAllowed: boolean; forbiddenUiPayloadFields: string[]; forbiddenOperations: string[]; serializationRule: string };
      releaseGate: { decision: string; blockers: string[]; proofCommands: string[] };
      proofCommands: string[];
    };
    const sourceAtlasFrontendContract = contract.sourceAtlasFrontendContract as {
      schemaVersion: string;
      status: string;
      route: string;
      publicRoute: string;
      apiRoutes: { atlas: string; export: string; contracts: string; approvalQueue: string };
      sdkOpenapi: { operationIds: string[]; responseFields: string[]; requestFields: string[]; schemaRefs: string[] };
      table: { searchBox: { param: string; placeholderCopy: string; emptyDeltaCopy: string; noResultCopy: string }; filters: string[]; columns: string[]; chips: Record<string, string[]>; sort: { default: string; allowed: string[] } };
      safeDetailDrawer: { sections: string[]; fields: string[]; approvalActions: string[]; nonActions: string[] };
      importPlans: { labels: string[]; planFields: string[]; canaryFields: string[]; exportFields: string[]; canaryRule: string };
      copyRules: { dryRunBanner: string; approvalCopy: string; descriptorHoldCopy: string; duplicateCopy: string; whatWillNotHappenLabel: string; bannedPhrases: string[] };
      noLeak: { publicOnly: boolean; dryRunOnly: boolean; rawUnsafeUrlPublicOutputAllowed: boolean; forbiddenUiPayloadFields: string[]; forbiddenOperations: string[]; serializationRule: string };
      releaseGate: { decision: string; blockers: string[]; proofCommands: string[] };
      proofCommands: string[];
    };
    const openapi = contract.openapi as typeof enterpriseApiSurface.openapi;
    const semantics = contract.semantics as {
      idempotency: { header: string; route: string; behavior: string };
      cursorPolling: { responseFields: string[] };
      stateMachine: {
        schemaVersion: string;
        states: Record<string, { requiredFields: string[]; publicPromotion: string }>;
        requiredUiFields: string[];
      };
      publicAnswerReleaseCandidate: {
        schemaVersion: string;
        field: string;
        states: string[];
        queryClasses: string[];
        visibleAnswerInputs: string[];
        requiredUiFields: string[];
        fixtures: Array<{ state: string; query: string; queryClass: string; publicPostCompatible: boolean; agent10RcGate: string }>;
        agent10RcGate: { statuses: string[]; decisions: string[]; proofCommands: string[] };
        guarantee: string;
      };
      publicAnswerUxSemantics: {
        schemaVersion: string;
        field: string;
        states: string[];
        queryFixtures: Array<{ query: string; queryClass: string; expectedUxState: string }>;
        copyRules: { unknownQuery: string; bannedPhrases: string[]; noBloatedPolicyParagraph: boolean };
        freshness: { updatedField: string; lastSeenField: string; rule: string };
        polling: { intervalSeconds: number; fields: string[] };
        publicWrapperCompatibility: { noDefaultQuery: boolean; canonicalMethod: string; canonicalPath: string };
      };
      publicWrapperResponsiveAudit: typeof publicWrapperResponsiveAudit;
      publicWrapperDeltaAudit: typeof publicWrapperDeltaAudit;
      publicWrapperCutoverReadiness: typeof publicWrapperCutoverReadiness;
      realtimeDeliveryPrototype: typeof realtimeDeliveryPrototype;
      realtimeDeliverySoak: typeof realtimeDeliverySoak;
      clientGenerationFreeze: typeof clientGenerationFreeze;
      frontendProgressiveUpdateContract: typeof frontendProgressiveUpdateContract;
      scraperNativeReplacementReadiness: typeof scraperNativeReplacementReadiness;
      apifyStoreReadiness: typeof apifyStoreReadiness;
      darkwebIndexFrontendContract: typeof darkwebIndexFrontendContract;
      sourceAtlasFrontendContract: typeof sourceAtlasFrontendContract;
      publicCanaryControlPlane: {
        schemaVersion: string;
        routes: string[];
        portfolio: { minimumSourceCount: number; bundledSourceCount: number; forbiddenSourceClasses: string[] };
        activation: { executableRoute: string; requiresHumanApproval: boolean; approvalField: string; reversibleRoutes: string[] };
        collection: { executableRoute: string; continuousLoopAutoActivation: boolean; boundedControls: string[] };
        readiness: { route: string; schemaVersion: string; decisions: string[]; requiredQueries: string[]; requiredEvidenceChecks: string[] };
        operatorView: { routes: string[]; fields: string[] };
        proofCommands: string[];
        guarantee: string;
      };
      enterpriseApiSurface: typeof enterpriseApiSurface;
      sdkIntegration: typeof sdkIntegration;
      clientCompatibilityMatrix: typeof clientCompatibilityMatrix;
      streamingWebhookCompatibility: typeof streamingWebhookCompatibility;
      authBoundary: typeof enterpriseApiSurface.authBoundary;
      pagination: typeof enterpriseApiSurface.pagination;
      rateLimits: typeof enterpriseApiSurface.rateLimits;
      auditFields: typeof enterpriseApiSurface.auditFields;
      openapi: typeof enterpriseApiSurface.openapi;
      cutoverScenarios: Array<{ code: string; state: string; warningCode: string; publicBehavior: string }>;
      publicChannelCanary: { routes: string[]; fields: string[]; guarantee: string };
      publicChannelPromotionCanary: { fields: string[]; healthSignals: string[]; guarantee: string };
      publicChannelPromotionCertification: { routes: string[]; fields: string[]; influenceSurfaces: string[]; guarantee: string };
      sourceActivationExecutionReadiness: { routes: string[]; fields: string[]; guarantee: string };
      sourceRolloutPromotionPacket: { routes: string[]; fields: string[]; guarantee: string };
      restrictedMetadataConnectorCertification: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      restrictedMetadataKillSwitchDrills: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      restrictedMetadataEmergencyStopCertification: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      restrictedMetadataNonBlockingSearch: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      restrictedMetadataAnalystOperations: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      restrictedMetadataIsolationHarness: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      darkwebIndex: { field: string; routes: string[]; targetRecordCount: number; fixtureRecordCount: number; recordFields: string[]; searchFilters: string[]; guarantee: string };
      schedulerWorkerLeaseSoakHarness: { field: string; fixture: string; totalTasks: number; scenarios: string[]; fields: string[]; guarantee: string };
      graphExportCertification: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      graphLiveSearchUpdate: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      graphBackendRepository: { routes: string[]; backendCandidates: string[]; operations: string[]; packetFields: string[]; guarantee: string };
      evidencePersistenceCertification: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      warningCodes: string[];
      noLeakGuarantees: string[];
      errorEnvelope: { error: { code: string; message: string } };
    };
    const validation = contract.validation as {
      publicProofs: string[];
      contractIndexProof: string;
    };

    expect(contract).toMatchObject({
      endpoint: "/v1/contracts",
      version: "v1",
      schemaVersion: "ti.scraper.enterprise_api_contract.v1",
      enterpriseApiSurface: {
        schemaVersion: "ti.enterprise_api_surface.v1",
        owner: "Agent 09",
        status: "contract_frozen_for_openapi_generation"
      },
      sdkIntegration: {
        schemaVersion: "ti.sdk_integration_contract.v1",
        status: "contract_only_no_push_delivery"
      },
      clientCompatibilityMatrix: {
        schemaVersion: "ti.client_compatibility_matrix.v1",
        status: "contract_frozen_for_client_generation"
      },
      openapi: {
        schemaVersion: "ti.openapi_ready_contract.v1",
        openapi: "3.1.0"
      }
    });
    expect(routeInventory).toMatchObject({
      source: "src/api/server.ts",
      count: routeInventory.routes.length
    });
    expect(routeInventory.count).toBeGreaterThanOrEqual(40);
    expect(routeInventory.routes.map((route) => `${route.method} ${route.path}`)).toEqual(expect.arrayContaining([
      "GET /v1/ops/canary/readiness"
    ]));
    expect(routeTruthAudit).toMatchObject({
      schemaVersion: "ti.route_truth_audit.v1",
      owner: "Agent 09",
      expectedRouteInventoryCount: routeInventory.count,
      canonicalPublicPost: {
        path: "/api/ti/search",
        method: "POST",
        mapsTo: "/v1/intel/search"
      }
    });
    expect(routeTruthAudit.canonicalPublicPost.stableFields).toEqual(expect.arrayContaining([
      "query",
      "mode",
      "status",
      "runId",
      "cursor",
      "nextCursor",
      "pollCursor",
      "deltaCursor",
      "updated",
      "publicTiAnswer",
      "publicWrapperDelta"
    ]));
    expect(routeTruthAudit.fixtures.map((fixture) => fixture.name)).toEqual(expect.arrayContaining([
      "route_inventory_drift",
      "missing_schema_examples",
      "public_post_compatibility",
      "provider_unavailable",
      "scraper_unavailable",
      "queue_pressure",
      "stale_evidence",
      "no_approved_sources",
      "policy_blocked",
      "duplicate_run_reuse",
      "delta_polling_contract",
      "empty_delta_poll",
      "public_post_poll_compatibility",
      "restricted_emergency_stop",
      "canary_rc_decision",
      "no_leak_examples"
    ]));
    expect(routeTruthAudit.fixtures.every((fixture) => fixture.publicPostCompatible && fixture.noLeakRequired && fixture.rollbackPath.length > 0)).toBe(true);
    expect(routeTruthAudit.fixtures.find((fixture) => fixture.name === "restricted_emergency_stop")).toMatchObject({
      route: "GET /v1/restricted-metadata/status",
      status: "pass"
    });
    expect(routeTruthAudit.fixtures.find((fixture) => fixture.name === "canary_rc_decision")?.auditFields).toEqual(expect.arrayContaining([
      "publicAnswerReleaseCandidate.agent10RcGate",
      "sourceRolloutPromotionPacket",
      "schedulerCanaryControlPlane"
    ]));
    expect(routeTruthAudit.proofCommands).toEqual(expect.arrayContaining([
      "bun run check:contract-index",
      "bun run check:route-inventory",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY=APT42 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ]));
    expect(routeTruthAudit.guarantee).toContain("fail-closed");
    expect(publicWrapperResponsiveAudit).toMatchObject({
      schemaVersion: "ti.public_wrapper_responsive_search.v1",
      owner: "Agent 09",
      route: "GET /v1/intel/search",
      publicWrapper: {
        canonicalMethod: "POST",
        canonicalPath: "/api/ti/search",
        noDefaultQuery: true,
        stableRunIds: true,
        pollingSeconds: 3,
        unknownCopy: "Searching"
      }
    });
    expect(semantics.publicWrapperResponsiveAudit).toEqual(publicWrapperResponsiveAudit);
    expect(semantics.publicCanaryControlPlane).toMatchObject({
      schemaVersion: "ti.public_canary_control_plane.v1",
      routes: expect.arrayContaining([
        "/v1/sources/canary-activation",
        "/v1/ops/canary/run",
        "/v1/ops/canary/readiness",
        "/v1/ops/canary/console",
        "/v1/sources/canary-pause"
      ]),
      portfolio: {
        minimumSourceCount: 8,
        bundledSourceCount: 10,
        forbiddenSourceClasses: expect.arrayContaining(["darknet", "restricted_metadata", "private_channel", "credentialed_source"])
      },
      activation: {
        executableRoute: "/v1/sources/canary-activation",
        requiresHumanApproval: true,
        approvalField: "operatorApproval=true",
        reversibleRoutes: expect.arrayContaining(["/v1/sources/canary-pause"])
      },
      collection: {
        executableRoute: "/v1/ops/canary/run",
        continuousLoopAutoActivation: false,
        boundedControls: expect.arrayContaining(["maxSources", "maxTasks", "maxBytes", "timeoutMs"])
      },
      readiness: {
        route: "/v1/ops/canary/readiness",
        schemaVersion: "ti.public_canary_readiness.v1",
        decisions: expect.arrayContaining(["promote", "canary-with-warnings", "hold"]),
        requiredQueries: expect.arrayContaining(["APT42", "Turla"]),
        requiredEvidenceChecks: expect.arrayContaining(["externalObjectCaptureCount", "queryReadiness"])
      },
      operatorView: {
        fields: expect.arrayContaining(["activeSources", "queue", "latestCaptures", "publicAnswerReadiness"])
      },
      proofCommands: expect.arrayContaining(["bun run check:canary-proof-path"])
    });
    expect(semantics.publicCanaryControlPlane.guarantee).toContain("keeps activation separate from collection");
    expect(publicWrapperResponsiveAudit.publicWrapper.updatedSemantics).toContain("lastSeen is shown only when evidence supplies");
    expect(publicWrapperResponsiveAudit.publicWrapper.stableFields).toEqual(expect.arrayContaining(["runId", "cursor", "nextCursor", "refreshAfterSeconds", "publicTiAnswer"]));
    expect(publicWrapperResponsiveAudit.fixtures.map((fixture) => fixture.name)).toEqual(expect.arrayContaining([
      "apt29_actor",
      "apt42_actor",
      "turla_actor",
      "volt_typhoon_actor",
      "scattered_spider_actor",
      "akira_ransomware",
      "random_actor",
      "made_up_actor",
      "cve",
      "malware_tool",
      "country",
      "sector",
      "victim",
      "provider_unavailable",
      "scraper_unavailable",
      "queue_pressure",
      "duplicate_run_reuse",
      "policy_block",
      "restricted_hold",
      "public_channel_partial",
      "graph_evidence_promotion"
    ]));
    expect(publicWrapperResponsiveAudit.fixtures.map((fixture) => fixture.query)).toEqual(expect.arrayContaining([
      "APT29",
      "APT42",
      "Turla",
      "Volt Typhoon",
      "Scattered Spider",
      "Akira",
      "Random Actor",
      "Made Up Actor",
      "CVE-2026-11111",
      "Snake",
      "Norway",
      "energy",
      "Fjord Energy AS"
    ]));
    expect(publicWrapperResponsiveAudit.fixtures.every((fixture) =>
      fixture.pollSeconds === 3
      && fixture.stableRunId
      && fixture.publicPostCompatible
      && fixture.noDefaultActor
      && fixture.noLeakRequired
      && fixture.noStaleCacheCopy
      && fixture.stableFields.includes("publicTiAnswer")
    )).toBe(true);
    expect(publicWrapperResponsiveAudit.fixtures.filter((fixture) => fixture.expectedUxState === "searching").every((fixture) => fixture.compactUnknownCopy === "Searching")).toBe(true);
    expect(publicWrapperResponsiveAudit.noLeakExamples.flatMap((example) => example.forbidden)).toEqual(expect.arrayContaining(["restricted files", "credentials", "raw message body"]));
    expect(publicWrapperResponsiveAudit.proofCommands).toEqual(expect.arrayContaining([
      "bun run check:contract-index",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY=APT42 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ]));
    expect(publicWrapperDeltaAudit).toMatchObject({
      schemaVersion: "ti.public_wrapper_delta_contract.v1",
      owner: "Agent 09",
      route: "GET /v1/intel/search",
      publicWrapperRoute: "POST /api/ti/search",
      cursorContract: {
        pollingSeconds: 3
      }
    });
    expect(semantics.publicWrapperDeltaAudit).toEqual(publicWrapperDeltaAudit);
    expect(publicWrapperDeltaAudit.stableFields).toEqual(expect.arrayContaining([
      "status",
      "summary",
      "runId",
      "refreshAfterSeconds",
      "pollCursor",
      "deltaCursor",
      "updated",
      "lastSeen",
      "sources",
      "recentActivity",
      "targets",
      "ttps",
      "datasets",
      "warnings",
      "warningCodes",
      "sourceCoverage",
      "publicChannel",
      "restrictedMetadata",
      "claimLedger",
      "graph"
    ]));
    expect(publicWrapperDeltaAudit.fixtures.map((fixture) => fixture.name)).toEqual(expect.arrayContaining([
      "first_response",
      "repeated_poll_same_run_id",
      "poll_cursor_advancement",
      "empty_delta",
      "new_clear_web_capture_delta",
      "public_channel_hint_delta",
      "restricted_metadata_held_delta",
      "graph_relationship_delta",
      "claim_ledger_hold",
      "contradiction_downgrade",
      "no_result_searching",
      "provider_unavailable",
      "scraper_unavailable",
      "queue_pressure",
      "duplicate_run_reuse",
      "stale_source",
      "low_confidence",
      "policy_block",
      "final_ready",
      "cve",
      "victim_ransomware",
      "country",
      "sector"
    ]));
    expect(publicWrapperDeltaAudit.fixtures.map((fixture) => fixture.query)).toEqual(expect.arrayContaining([
      "APT29",
      "APT42",
      "Turla",
      "Volt Typhoon",
      "Scattered Spider",
      "Akira",
      "Random Actor",
      "Made Up Actor",
      "CVE-2026-11111",
      "Snake",
      "Fjord Energy AS",
      "Norway",
      "energy"
    ]));
    expect(publicWrapperDeltaAudit.fixtures.every((fixture) =>
      fixture.stableRunId
      && fixture.pollSeconds === 3
      && fixture.requiresPollCursor
      && fixture.requiresDeltaCursor
      && fixture.publicPostCompatible
      && fixture.noLeakRequired
      && fixture.stableFields.includes("deltaCursor")
      && fixture.handoffs.length >= 5
    )).toBe(true);
    expect(publicWrapperDeltaAudit.noLeakExamples.flatMap((example) => example.forbidden)).toEqual(expect.arrayContaining(["raw message body", "credentials", "restricted URL"]));
    expect(publicWrapperDeltaAudit.proofCommands).toEqual(expect.arrayContaining([
      "bun run check:contract-index",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ]));
    expect(enterpriseApiSurface.authBoundary).toMatchObject({
      schemaVersion: "ti.enterprise_auth_boundary.v1",
      mode: "trusted_gateway_forwarded_identity",
      requiredForwardedHeaders: expect.arrayContaining(["x-tenant-id", "x-actor-id"]),
      tenantContract: {
        header: "x-tenant-id",
        requiredForProduction: true
      },
      requesterContract: {
        header: "x-actor-id",
        requiredForProduction: true,
        auditOnlyHere: true
      },
      secretHandling: {
        bearerTokensAcceptedHere: false
      }
    });
    expect(enterpriseApiSurface.authBoundary.authzModel.scopes).toEqual(expect.arrayContaining([
      "intel:read",
      "intel:run",
      "sources:write",
      "scraper:admin"
    ]));
    expect(enterpriseApiSurface.authBoundary.optionalForwardedHeaders).toEqual(expect.arrayContaining([
      "x-service-token-context",
      "x-analyst-role",
      "x-source-approval-role"
    ]));
    expect(enterpriseApiSurface.authBoundary.serviceTokenContext).toMatchObject({
      header: "x-service-token-context",
      validationOwner: "cti_gateway",
      scraperStoresToken: false,
      auditField: "servicePrincipalId"
    });
    expect(enterpriseApiSurface.authBoundary.roleContracts.analystRoles).toEqual(expect.arrayContaining([
      "analyst:reader",
      "analyst:reviewer",
      "analyst:exporter"
    ]));
    expect(enterpriseApiSurface.authBoundary.roleContracts.sourceApprovalRoles).toEqual(expect.arrayContaining([
      "source:approver",
      "source:publisher"
    ]));
    expect(enterpriseApiSurface.authBoundary.roleContracts.readWriteSeparation.readScopes).toEqual(expect.arrayContaining([
      "intel:read",
      "evidence:read",
      "graph:read"
    ]));
    expect(enterpriseApiSurface.authBoundary.roleContracts.readWriteSeparation.writeScopes).toEqual(expect.arrayContaining([
      "intel:run",
      "sources:write",
      "scraper:admin"
    ]));
    expect(enterpriseApiSurface.authBoundary.auditLogging.requiredFields).toEqual(expect.arrayContaining([
      "tenantId",
      "requesterId",
      "requestId",
      "traceId",
      "servicePrincipalId",
      "decision"
    ]));
    expect(enterpriseApiSurface.authBoundary.auditLogging.mutationDecisions).toEqual(expect.arrayContaining([
      "operator_approval_required",
      "policy_blocked",
      "idempotency_conflict"
    ]));
    expect(enterpriseApiSurface.identity).toMatchObject({
      tenantHeader: "x-tenant-id",
      requesterHeader: "x-actor-id",
      requestIdHeader: "x-request-id"
    });
    expect(enterpriseApiSurface.idempotency).toMatchObject({
      header: "idempotency-key",
      conflictCode: "idempotency_conflict",
      conflictStatus: 409
    });
    expect(enterpriseApiSurface.idempotency.requiredOn).toContain("POST /v1/intel/runs");
    expect(enterpriseApiSurface.pagination).toMatchObject({
      style: "cursor",
      maxLimit: 100
    });
    expect(enterpriseApiSurface.pagination.requestFields).toEqual(expect.arrayContaining(["cursor", "limit"]));
    expect(enterpriseApiSurface.pagination.responseFields).toContain("nextCursor");
    expect(enterpriseApiSurface.pagination.paginatedRoutes).toEqual(expect.arrayContaining(["GET /v1/sources", "GET /v1/intel/runs/{id}/results"]));
    expect(enterpriseApiSurface.tenantBoundary).toMatchObject({
      schemaVersion: "ti.tenant_boundary.v1",
      fallbackMode: "single_tenant_dev_only",
      crossTenantFailureCode: "not_found"
    });
    expect(enterpriseApiSurface.tenantBoundary.appliedBefore).toEqual(expect.arrayContaining([
      "pagination",
      "evidence_lookup",
      "graph_export",
      "source_admin",
      "claim_ledger",
      "restricted_metadata_review"
    ]));
    expect(enterpriseApiSurface.versioning).toMatchObject({
      schemaVersion: "ti.api_versioning_policy.v1",
      currentVersion: "v1",
      routePrefix: "/v1",
      compatibilityStatus: "additive_changes_only",
      versionHeader: "x-api-version",
      minimumDeprecationNoticeDays: 90
    });
    expect(enterpriseApiSurface.versioning.deprecationHeaders).toEqual(expect.arrayContaining([
      "deprecation",
      "sunset",
      "link",
      "x-api-version",
      "x-request-id"
    ]));
    expect(enterpriseApiSurface.versioning.breakingChangeRequires).toEqual(expect.arrayContaining([
      "new major route prefix",
      "clientCompatibilityMatrix entry",
      "contract-index proof",
      "public-wrapper proof"
    ]));
    expect(enterpriseApiSurface.versioning.removalBlockedFor).toEqual(expect.arrayContaining([
      "required response fields",
      "error envelope shape",
      "idempotency semantics",
      "cursor field names",
      "public wrapper stable fields"
    ]));
    expect(enterpriseApiSurface.versioning.legacyAliases).toEqual(expect.arrayContaining([
      expect.objectContaining({
        route: "POST /api/ti/search",
        canonicalRoute: "GET /v1/intel/search",
        status: "compatibility_wrapper"
      })
    ]));
    expect(enterpriseApiSurface.versioning.sunsetWorkflow.requiredAuditFields).toEqual(expect.arrayContaining([
      "route",
      "replacementRoute",
      "deprecatedAt",
      "sunsetAt",
      "clientImpact",
      "owner"
    ]));
    expect(enterpriseApiSurface.versioning.examples.find((example) => example.name === "deprecated_compatibility_wrapper")).toMatchObject({
      route: "POST /api/ti/search",
      headers: {
        deprecation: "true",
        "x-api-version": "v1"
      },
      body: {
        error: {
          code: "deprecated_route",
          details: {
            replacementRoute: "GET /v1/intel/search"
          }
        }
      }
    });
    expect(JSON.stringify(enterpriseApiSurface.versioning.examples)).not.toMatch(/authorization|cookie|password|bearer|secret|raw_body|raw_url/i);
    expect(enterpriseApiSurface.rateLimits).toMatchObject({
      model: "gateway_enforced_with_route_hints"
    });
    expect(enterpriseApiSurface.rateLimits.responseHeaders).toEqual(expect.arrayContaining(["retry-after", "x-rate-limit-policy", "x-request-id"]));
    expect(enterpriseApiSurface.rateLimits.overloadCodes).toEqual(expect.arrayContaining(["queue_pressure", "provider_unavailable", "scraper_unavailable"]));
    expect(enterpriseApiSurface.rateLimits.perRouteHints.map((hint) => hint.route)).toEqual(expect.arrayContaining([
      "GET /v1/intel/search",
      "POST /api/ti/search",
      "POST /v1/intel/runs",
      "GET /v1/intel/runs/{id}/results",
      "POST /v1/sources/apply-plan",
      "POST /v1/public-channels/apply-plan",
      "POST /v1/restricted-metadata/apply-plan",
      "POST /v1/exports/stix"
    ]));
    expect(enterpriseApiSurface.rateLimits.perRouteHints.find((hint) => hint.route === "POST /api/ti/search")).toMatchObject({
      policy: "public_wrapper_live_search",
      retryAfterSeconds: 3,
      queuePressureCode: "queue_pressure",
      publicWrapperThrottle: true
    });
    expect(enterpriseApiSurface.auditFields.requiredOnMutations).toEqual(expect.arrayContaining(["tenantId", "requesterId", "requestId", "idempotencyKey"]));
    expect(enterpriseApiSurface.auditFields.requiredOnEvidenceBearingResponses).toEqual(expect.arrayContaining(["sourceId", "captureId", "contentHash", "ledgerIds"]));
    expect(enterpriseApiSurface.auditFields.redactedAlways).toEqual(expect.arrayContaining(["authorization", "cookie", "object_key", "credential"]));
    expect(enterpriseApiSurface.errors.codes).toEqual(expect.arrayContaining(["bad_request", "idempotency_conflict", "queue_pressure", "policy_blocked"]));
    expect(enterpriseApiSurface.errors.retryableCodes).toContain("queue_pressure");
    expect(enterpriseApiSurface.errors.failClosedCodes).toContain("policy_blocked");
    expect(enterpriseApiSurface.errors.safeExamples.map((example) => example.name)).toEqual(expect.arrayContaining([
      "queue_pressure",
      "policy_blocked",
      "idempotency_conflict"
    ]));
    expect(enterpriseApiSurface.errors.safeExamples.find((example) => example.name === "queue_pressure")).toMatchObject({
      status: 429,
      headers: {
        "retry-after": "5",
        "x-rate-limit-policy": "live_search_queue"
      },
      body: {
        error: {
          code: "queue_pressure",
          details: {
            retryAfterSeconds: 5
          }
        }
      }
    });
    expect(JSON.stringify(enterpriseApiSurface.errors.safeExamples)).not.toMatch(/authorization|cookie|password|bearer|secret|raw_body|raw_url/i);
    expect(enterpriseApiSurface.openapi.paths).toHaveProperty("/v1/intel/search");
    expect(enterpriseApiSurface.openapi.paths).toHaveProperty("/v1/intel/runs/{id}/results");
    expect(Object.keys(enterpriseApiSurface.openapi.components.schemas)).toEqual(expect.arrayContaining(["ErrorEnvelope", "CursorPage", "IdempotentRunRequest", "PublicSearchResponse"]));
    expect(Object.keys(enterpriseApiSurface.openapi.components.schemas)).toEqual(expect.arrayContaining(["SdkPollingEnvelope", "SdkSubscriptionRegistration"]));
    expect(enterpriseApiSurface.examples.map((example) => example.name)).toEqual(expect.arrayContaining([
      "tenant_scoped_public_search",
      "idempotent_run_create",
      "cursor_results_page"
    ]));
    expect(enterpriseApiSurface.noLeakGuarantee).toContain("never raw bodies");
    expect(sdkIntegration.routes).toMatchObject({
      initialSearch: "GET /v1/intel/search",
      publicWrapperSearch: "POST /api/ti/search",
      futureSse: "GET /v1/events/search-stream",
      futureWebhookRegistration: "POST /v1/webhooks/subscriptions"
    });
    expect(sdkIntegration.polling).toMatchObject({
      intervalSeconds: 3,
      emptyDelta: {
        status: "waiting_for_deltas",
        changed: false
      },
      duplicateRunReuse: {
        warningCode: "duplicate_run_reuse"
      }
    });
    expect(sdkIntegration.polling.responseFields).toEqual(expect.arrayContaining(["runId", "pollCursor", "deltaCursor", "refreshAfterSeconds", "publicTiAnswer", "publicWrapperDelta"]));
    expect(sdkIntegration.polling.retryableStates).toEqual(expect.arrayContaining(["searching", "queued", "partial", "metadata_review", "queue_pressure"]));
    expect(sdkIntegration.polling.emptyDelta.requiredFields).toEqual(expect.arrayContaining(["runId", "pollCursor", "deltaCursor", "updated"]));
    expect(sdkIntegration.polling.emptyDelta.clientBehavior).toContain("do not clear evidence sections");
    expect(sdkIntegration.polling.duplicateRunReuse.requiredFields).toEqual(expect.arrayContaining(["runId", "idempotencyKey", "pollCursor", "deltaCursor"]));
    expect(sdkIntegration.polling.degradedModes.queue_pressure).toMatchObject({ retryAfterSeconds: 5, preserveLastGoodAnswer: true });
    expect(sdkIntegration.backoff.preferHeaders).toEqual(expect.arrayContaining(["retry-after", "x-rate-limit-policy", "x-request-id"]));
    expect(sdkIntegration.backoff.maxClientPollSeconds).toBe(30);
    expect(sdkIntegration.eventBoundary).toMatchObject({
      delivery: "future_contract_only",
      allowedModes: expect.arrayContaining(["sse", "webhook"])
    });
    expect(sdkIntegration.eventBoundary.eventTypes).toEqual(expect.arrayContaining(["delta.available", "evidence.promoted", "graph.review_hold", "restricted_metadata.hold", "run.ready", "review.required"]));
    expect(sdkIntegration.eventBoundary.forbiddenPayloadFields).toEqual(expect.arrayContaining(["raw_body", "restricted_raw_url", "credential", "object_reference", "leaked_row"]));
    expect(sdkIntegration.examples.map((example) => example.name)).toEqual(expect.arrayContaining([
      "browser_poll_loop",
      "backend_service_poll_loop",
      "analyst_automation_review_hold",
      "future_webhook_registration"
    ]));
    expect(sdkIntegration.fixturePack).toMatchObject({
      schemaVersion: "ti.sdk_fixture_pack.v1",
      status: "contract_frozen_for_client_ci"
    });
    expect(sdkIntegration.fixturePack.fixtureNames).toEqual(expect.arrayContaining([
      "initial_public_search",
      "repeated_poll_empty_delta",
      "new_delta_available",
      "queue_pressure_retry",
      "policy_blocked_fail_closed",
      "idempotent_run_reuse",
      "cursor_results_page",
      "metadata_review_required",
      "future_event_delta_available"
    ]));
    expect(sdkIntegration.fixturePack.requiredFiles.every((file) => file.startsWith("fixtures/sdk/") && file.endsWith(".json"))).toBe(true);
    expect(sdkIntegration.fixturePack.invariantFields).toEqual(expect.arrayContaining([
      "runId",
      "status",
      "pollCursor",
      "deltaCursor",
      "refreshAfterSeconds",
      "updated"
    ]));
    expect(sdkIntegration.fixturePack.noLeakAssertions).toEqual(expect.arrayContaining([
      "no raw_body",
      "no restricted_raw_url",
      "no credential",
      "no object_reference",
      "no leaked_row"
    ]));
    expect(sdkIntegration.compatibilityCi).toMatchObject({
      schemaVersion: "ti.sdk_compatibility_ci.v1",
      status: "contract_only_required_before_sdk_release"
    });
    expect(sdkIntegration.compatibilityCi.requiredCommands).toEqual(expect.arrayContaining([
      "bun run check:contract-index",
      "bun run check:route-inventory",
      "bun test src/tests/api.test.ts",
      "bun test",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search"
    ]));
    expect(sdkIntegration.compatibilityCi.gates.map((gate) => gate.name)).toEqual(expect.arrayContaining([
      "openapi_schema_available",
      "polling_contract_stable",
      "error_envelope_stable",
      "public_wrapper_compatible",
      "no_leak_fixtures"
    ]));
    expect(sdkIntegration.compatibilityCi.clientMatrix).toEqual(expect.arrayContaining([
      "typescript_fetch",
      "node_service",
      "browser_ti",
      "analyst_automation"
    ]));
    expect(JSON.stringify({ fixtures: sdkIntegration.fixturePack, ci: sdkIntegration.compatibilityCi })).not.toMatch(/authorization header|cookie header|password|bearer|raw_body_value|raw_url_value/i);
    expect(sdkIntegration.openapi).toMatchObject({
      schemaVersion: "ti.sdk_openapi_extension.v1",
      components: expect.arrayContaining(["SdkPollingEnvelope", "SdkSubscriptionRegistration"]),
      xSdkPollingContract: {
        intervalSeconds: 3
      }
    });
    expect(sdkIntegration.openapi.xSdkPollingContract.cursorFields).toEqual(expect.arrayContaining(["pollCursor", "deltaCursor", "nextCursor"]));
    expect(sdkIntegration.noLeakGuarantee).toContain("never push raw bodies");
    expect(streamingWebhookCompatibility).toMatchObject({
      schemaVersion: "ti.streaming_webhook_compatibility.v1",
      status: "contract_only_polling_remains_primary",
      pollingCompatibility: {
        pollingPrimary: true,
        intervalSeconds: 3
      }
    });
    expect(streamingWebhookCompatibility.deliveryModes.map((mode) => mode.mode)).toEqual(expect.arrayContaining(["sse", "webhook"]));
    expect(streamingWebhookCompatibility.pollingCompatibility.sameFields).toEqual(expect.arrayContaining([
      "runId",
      "status",
      "pollCursor",
      "deltaCursor",
      "refreshAfterSeconds",
      "updated",
      "warningCodes"
    ]));
    expect(streamingWebhookCompatibility.eventTypes.map((event) => event.type)).toEqual(expect.arrayContaining([
      "run.status",
      "answer.delta",
      "evidence.promoted",
      "source.gap",
      "graph.review_hold",
      "restricted_metadata.hold",
      "error.retry_hint",
      "run.terminal"
    ]));
    expect(streamingWebhookCompatibility.authAndGateway.requiredForwardedHeaders).toEqual(expect.arrayContaining(["x-tenant-id", "x-actor-id"]));
    expect(streamingWebhookCompatibility.webhooks.failureBehavior).toMatchObject({
      maxAttempts: 6,
      fallback: expect.stringContaining("polling")
    });
    expect(streamingWebhookCompatibility.noLeak.forbiddenPayloadFields).toEqual(expect.arrayContaining([
      "raw_body",
      "restricted_raw_url",
      "credential",
      "object_reference",
      "webhook_secret"
    ]));
    expect(JSON.stringify(streamingWebhookCompatibility.examples)).not.toMatch(/authorization|cookie|password|bearer|raw_body_value|raw_url_value|webhook_secret_value/i);
    expect(publicWrapperCutoverReadiness).toMatchObject({
      schemaVersion: "ti.public_wrapper_cutover_readiness.v1",
      status: "watch_ready_polling_compatible"
    });
    expect(publicWrapperCutoverReadiness.stableFieldAgreement).toMatchObject({
      publicWrapperRoute: "POST /api/ti/search",
      scraperNativeRoute: "GET /v1/intel/search",
      requiredInCompatibilityFields: true,
      pollingSeconds: 3
    });
    expect(publicWrapperCutoverReadiness.stableFieldAgreement.requiredFields).toEqual(expect.arrayContaining([
      "status",
      "runId",
      "pollCursor",
      "deltaCursor",
      "refreshAfterSeconds",
      "updated",
      "publicTiAnswer",
      "publicWrapperDelta"
    ]));
    expect(publicWrapperCutoverReadiness.stableFieldAgreement.runPollingRoutes).toEqual(expect.arrayContaining([
      "GET /v1/intel/runs/{id}",
      "GET /v1/intel/runs/{id}/results"
    ]));
    expect(publicWrapperCutoverReadiness.stableFieldAgreement.agreeingSurfaces).toEqual(expect.arrayContaining([
      "publicCompatibility.stableFields",
      "sdkIntegration.polling.responseFields",
      "streamingWebhookCompatibility.pollingCompatibility.sameFields"
    ]));
    expect(publicWrapperCutoverReadiness.fallbackWatch).toMatchObject({
      requiredCopyForNoResult: "Searching"
    });
    expect(publicWrapperCutoverReadiness.fallbackWatch.unknownQueryRule).toContain("must not become ready");
    expect(publicWrapperCutoverReadiness.fallbackWatch.allowedUnknownStates).toEqual(expect.arrayContaining(["searching", "queued", "partial"]));
    expect(publicWrapperCutoverReadiness.fallbackWatch.bannedFallbackCodes).toEqual(expect.arrayContaining([
      "default_actor_fallback",
      "demo_copy",
      "stale_cache_copy",
      "implicit_apt29_example",
      "unknown_ready_without_evidence",
      "outer_wrapper_run_id_synthesis"
    ]));
    expect(publicWrapperCutoverReadiness.fallbackWatch.bannedTextPatterns).toEqual(expect.arrayContaining([
      "default APT29",
      "cached demo",
      "stale local cache"
    ]));
    expect(publicWrapperCutoverReadiness.deprecationWatch).toMatchObject({
      aliasRoute: "POST /api/ti/search",
      canonicalRoute: "GET /v1/intel/search",
      state: "compatibility_wrapper_until_cutover",
      minimumNoticeDays: 90
    });
    expect(publicWrapperCutoverReadiness.deprecationWatch.headersWhenScheduled).toEqual(expect.arrayContaining([
      "deprecation",
      "sunset",
      "link",
      "x-api-version",
      "x-request-id"
    ]));
    expect(publicWrapperCutoverReadiness.deprecationWatch.noSunsetBefore).toEqual(expect.arrayContaining([
      expect.stringContaining("public proof matrix"),
      expect.stringContaining("Agent 10 release board")
    ]));
    expect(publicWrapperCutoverReadiness.deprecationWatch.rollbackTriggers).toEqual(expect.arrayContaining([
      "public_wrapper_post_failure",
      "default_actor_detected",
      "demo_copy_detected",
      "missing_cursor",
      "unstable_run_id",
      "rate_limit_header_missing",
      "error_envelope_drift",
      "tenant_boundary_failure",
      "unsafe_payload_leak",
      "streaming_contract_drift"
    ]));
    expect(publicWrapperCutoverReadiness.gatewayWatch.requiredForwardedHeaders).toEqual(expect.arrayContaining(["x-tenant-id", "x-actor-id"]));
    expect(publicWrapperCutoverReadiness.gatewayWatch.rateLimitHeaders).toEqual(expect.arrayContaining(["retry-after", "x-rate-limit-policy", "x-request-id"]));
    expect(publicWrapperCutoverReadiness.compatibilityHandoffs.agent02Scheduler).toEqual(expect.arrayContaining(["stable run ids", "3-second polling"]));
    expect(publicWrapperCutoverReadiness.compatibilityHandoffs.agent07Quality).toContain("unknown says Searching");
    expect(publicWrapperCutoverReadiness.compatibilityHandoffs.agent10Release).toContain("public proof packet");
    expect(publicWrapperCutoverReadiness.sdkAndStreamingCompatibility).toMatchObject({
      clientMatrixStatus: "contract_frozen_for_client_generation",
      sdkFixtureSchemaVersion: "ti.sdk_fixture_pack.v1",
      pollingPrimary: true
    });
    expect(publicWrapperCutoverReadiness.sdkAndStreamingCompatibility.futureDeliveryModes).toEqual(expect.arrayContaining(["sse", "webhook"]));
    expect(publicWrapperCutoverReadiness.proofCommands).toEqual(expect.arrayContaining([
      "bun run check",
      "bun run check:api-regression",
      "bun run check:api-gateway",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ]));
    expect(JSON.stringify(publicWrapperCutoverReadiness)).not.toMatch(/authorization:|cookie=|password=|bearer_token_value|raw_body_value|restricted_raw_url_value|object_key_value|leaked_row_value/i);
    expect(realtimeDeliveryPrototype).toMatchObject({
      schemaVersion: "ti.realtime_delivery_prototype.v1",
      status: "disabled_by_default_polling_primary",
      mode: "contract_first_prototype_no_mounted_delivery"
    });
    expect(realtimeDeliveryPrototype.featureFlags).toMatchObject({
      enabledByDefault: false,
      sseFlag: "TI_REALTIME_SSE_ENABLED=false",
      webhookFlag: "TI_REALTIME_WEBHOOKS_ENABLED=false",
      deliveryWritesFlag: "TI_REALTIME_DELIVERY_WRITES_ENABLED=false",
      routeMountFlag: "TI_REALTIME_ROUTES_ENABLED=false"
    });
    expect(realtimeDeliveryPrototype.deliveryModes.map((mode) => mode.mode)).toEqual(expect.arrayContaining(["sse", "webhook"]));
    expect(realtimeDeliveryPrototype.deliveryModes.every((mode) => mode.enabled === false && mode.mounted === false)).toBe(true);
    expect(realtimeDeliveryPrototype.deliveryModes.find((mode) => mode.mode === "webhook")).toMatchObject({
      registrationDryRunOnly: true,
      idempotencyKeyRequired: true
    });
    expect(realtimeDeliveryPrototype.eventEnvelope).toMatchObject({
      schemaVersion: "ti.realtime_event_envelope.v1"
    });
    expect(realtimeDeliveryPrototype.eventEnvelope.requiredFields).toEqual(expect.arrayContaining([
      "eventId",
      "eventType",
      "runId",
      "tenantId",
      "pollCursor",
      "deltaCursor",
      "sequence",
      "createdAt"
    ]));
    expect(realtimeDeliveryPrototype.eventEnvelope.cursorGapBehavior).toContain("polling fallback");
    expect(realtimeDeliveryPrototype.eventPrototypes.map((event) => event.type)).toEqual(expect.arrayContaining([
      "run.status",
      "answer.delta",
      "evidence.promoted",
      "source.gap",
      "graph.review_hold",
      "restricted_metadata.hold",
      "quality.caveat",
      "error.retry_hint",
      "run.terminal"
    ]));
    expect(realtimeDeliveryPrototype.eventPrototypes.every((event) => event.enabled === false && event.payloadFields.includes("runId"))).toBe(true);
    expect(realtimeDeliveryPrototype.authAndIdentity.requiredForwardedHeaders).toEqual(expect.arrayContaining(["x-tenant-id", "x-actor-id"]));
    expect(realtimeDeliveryPrototype.idempotencyAndReplay).toMatchObject({
      runCreationHeader: "idempotency-key",
      webhookRegistrationHeader: "idempotency-key",
      conflictCode: "idempotency_conflict"
    });
    expect(realtimeDeliveryPrototype.idempotencyAndReplay.replayCursors).toEqual(expect.arrayContaining(["Last-Event-ID", "pollCursor", "deltaCursor"]));
    expect(realtimeDeliveryPrototype.fallbackToPolling).toMatchObject({
      pollingPrimary: true,
      intervalSeconds: 3
    });
    expect(realtimeDeliveryPrototype.fallbackToPolling.sameFields).toEqual(expect.arrayContaining([
      "runId",
      "status",
      "pollCursor",
      "deltaCursor",
      "refreshAfterSeconds",
      "updated",
      "warningCodes"
    ]));
    expect(realtimeDeliveryPrototype.fallbackToPolling.retryHeaders).toEqual(expect.arrayContaining(["retry-after", "x-rate-limit-policy", "x-request-id"]));
    expect(realtimeDeliveryPrototype.publicWrapperGuardrails).toMatchObject({
      noDefaultActor: true,
      noDemoOrStaleCacheCopy: true,
      unknownQueryCopy: "Searching",
      stableRunIds: true
    });
    expect(realtimeDeliveryPrototype.publicWrapperGuardrails.bannedFallbackCodes).toEqual(expect.arrayContaining([
      "default_actor_fallback",
      "demo_copy",
      "unknown_ready_without_evidence"
    ]));
    expect(realtimeDeliveryPrototype.errorSemantics.realtimeSpecificCodes).toEqual(expect.arrayContaining([
      "stream_disabled",
      "webhook_disabled",
      "replay_cursor_gap",
      "delivery_retry_scheduled",
      "subscription_policy_blocked"
    ]));
    expect(realtimeDeliveryPrototype.handoffs.agent07Quality).toEqual(expect.arrayContaining(["quality.caveat", "unknown Searching guardrail"]));
    expect(realtimeDeliveryPrototype.handoffs.agent10Release).toContain("feature flags remain off");
    expect(realtimeDeliveryPrototype.noLeak.forbiddenPayloadFields).toEqual(expect.arrayContaining([
      "raw_body",
      "restricted_raw_url",
      "credential",
      "object_reference",
      "webhook_secret",
      "private_channel_material"
    ]));
    expect(realtimeDeliveryPrototype.proofCommands).toEqual(expect.arrayContaining([
      "bun run check",
      "bun run check:api-regression",
      "bun run check:sdk-fixtures",
      "bun run check:route-inventory",
      "bun run check:contract-index"
    ]));
    expect(JSON.stringify(realtimeDeliveryPrototype)).not.toMatch(/authorization:|cookie=|password=|bearer_token_value|raw_body_value|restricted_raw_url_value|object_key_value|leaked_row_value|webhook_secret_value/i);
    expect(realtimeDeliverySoak).toMatchObject({
      schemaVersion: "ti.realtime_delivery_soak.v1",
      status: "disabled_soak_contract_ready_polling_primary",
      mode: "disabled_delivery_soak_no_mounted_realtime_routes"
    });
    expect(realtimeDeliverySoak.deliveryFlags).toMatchObject({
      enabledByDefault: false
    });
    expect(realtimeDeliverySoak.deliveryFlags.requiredDisabledFlags).toEqual(expect.arrayContaining([
      "TI_REALTIME_SSE_ENABLED=false",
      "TI_REALTIME_WEBHOOKS_ENABLED=false",
      "TI_REALTIME_DELIVERY_WRITES_ENABLED=false",
      "TI_REALTIME_ROUTES_ENABLED=false"
    ]));
    expect(realtimeDeliverySoak.soakScenarios.map((scenario) => scenario.name)).toEqual(expect.arrayContaining([
      "disabled_sse_replay",
      "disabled_webhook_registration",
      "webhook_outbox_retry",
      "cursor_gap_replay",
      "fallback_to_polling",
      "unsafe_payload_block"
    ]));
    expect(realtimeDeliverySoak.soakScenarios.every((scenario) =>
      scenario.realtimeEnabled === false
      && scenario.mountedRouteAllowed === false
      && scenario.pollingFallbackRequired === true
      && scenario.noUnsafePayload === true
    )).toBe(true);
    expect(realtimeDeliverySoak.webhookOutbox).toMatchObject({
      schemaVersion: "ti.webhook_outbox_soak.v1",
      enabled: false,
      dryRunOnly: true,
      maxAttempts: 6,
      idempotencyHeader: "idempotency-key"
    });
    expect(realtimeDeliverySoak.webhookOutbox.states).toEqual(expect.arrayContaining(["retry_scheduled", "dead_lettered", "disabled"]));
    expect(realtimeDeliverySoak.webhookOutbox.nonActions).toEqual(expect.arrayContaining(["do not deliver callbacks", "do not store webhook secrets", "do not block public polling"]));
    expect(realtimeDeliverySoak.cursorGapReplay).toMatchObject({
      schemaVersion: "ti.realtime_cursor_gap_replay.v1",
      replayWindowSeconds: 900
    });
    expect(realtimeDeliverySoak.cursorGapReplay.actions).toEqual(expect.arrayContaining(["preserve runId", "preserve pollCursor", "preserve deltaCursor", "fallback_to_polling"]));
    expect(realtimeDeliverySoak.pollingFallback).toMatchObject({
      pollingPrimary: true,
      intervalSeconds: 3,
      publicWrapperRoute: "POST /api/ti/search",
      scraperNativeRoute: "GET /v1/intel/search"
    });
    expect(realtimeDeliverySoak.pollingFallback.sameFields).toEqual(expect.arrayContaining(["runId", "pollCursor", "deltaCursor", "refreshAfterSeconds", "updated", "warningCodes"]));
    expect(realtimeDeliverySoak.eventEnvelopeSoak.eventTypes).toEqual(expect.arrayContaining(["run.status", "answer.delta", "graph.review_hold", "restricted_metadata.hold", "run.terminal"]));
    expect(realtimeDeliverySoak.eventEnvelopeSoak.noPromotionRule).toContain("public fact promotion");
    expect(realtimeDeliverySoak.noLeak.forbiddenPayloadFields).toEqual(expect.arrayContaining([
      "raw_body",
      "restricted_raw_url",
      "credential",
      "object_key",
      "leaked_row",
      "webhook_secret",
      "private_channel_material"
    ]));
    expect(realtimeDeliverySoak.releaseGate).toMatchObject({
      decision: "hold_realtime_polling_primary"
    });
    expect(realtimeDeliverySoak.releaseGate.promotionBlockers).toEqual(expect.arrayContaining([
      "feature_flag_enabled_by_default",
      "mounted_realtime_route_detected",
      "cursor_gap_without_polling_fallback",
      "unsafe_payload_field_detected"
    ]));
    expect(realtimeDeliverySoak.proofCommands).toEqual(expect.arrayContaining(["bun run check:api-regression", "bun run check:contract-index", "bun test"]));
    expect(JSON.stringify(realtimeDeliverySoak)).not.toMatch(/authorization:|cookie=|password=|bearer_token_value|raw_body_value|restricted_raw_url_value|object_key_value|leaked_row_value|webhook_secret_value/i);
    expect(clientCompatibilityMatrix.contractFreeze).toMatchObject({
      schemaVersion: "ti.openapi_contract_freeze.v1",
      openapi: "3.1.0",
      routeCount: Object.keys(openapi.paths).length
    });
    expect(clientCompatibilityMatrix.contractFreeze.requiredComponentSchemas).toEqual(expect.arrayContaining([
      "ErrorEnvelope",
      "CursorPage",
      "IdempotentRunRequest",
      "PublicSearchResponse",
      "SdkPollingEnvelope",
      "SdkSubscriptionRegistration"
    ]));
    expect(clientCompatibilityMatrix.contractFreeze.requiredSemantics).toEqual(expect.arrayContaining([
      "trusted_gateway_forwarded_identity",
      "tenant_header_boundary",
      "stable_error_envelope",
      "cursor_pagination",
      "idempotent_run_creation",
      "retry_after_headers",
      "public_wrapper_delta_polling",
      "no_leak_examples"
    ]));
    expect(clientCompatibilityMatrix.sharedGuarantees.errorCodes).toEqual(expect.arrayContaining(["bad_request", "queue_pressure", "policy_blocked"]));
    expect(clientCompatibilityMatrix.sharedGuarantees.retryHeaders).toEqual(expect.arrayContaining(["retry-after", "x-rate-limit-policy", "x-request-id"]));
    expect(clientCompatibilityMatrix.sharedGuarantees.redactedAlways).toEqual(expect.arrayContaining(["authorization", "cookie", "object_key", "credential"]));
    expect(clientCompatibilityMatrix.clients.map((client) => client.client)).toEqual(expect.arrayContaining([
      "frontend_ti",
      "cti_backend",
      "analyst_automation",
      "future_sdk",
      "future_sse_webhooks"
    ]));
    expect(clientCompatibilityMatrix.clients.find((client) => client.client === "frontend_ti")).toMatchObject({
      primaryRoutes: expect.arrayContaining(["POST /api/ti/search", "GET /v1/intel/search"]),
      requiredResponseKeys: expect.arrayContaining(["runId", "pollCursor", "deltaCursor", "publicTiAnswer", "publicWrapperDelta"]),
      states: expect.arrayContaining(["first_response", "empty_delta", "metadata_review", "graph_hold", "claim_ledger_hold", "ready"])
    });
    expect(clientCompatibilityMatrix.clients.find((client) => client.client === "cti_backend")).toMatchObject({
      primaryRoutes: expect.arrayContaining(["POST /v1/intel/runs", "GET /v1/intel/runs/{id}/results", "POST /v1/exports/stix"]),
      requiredResponseKeys: expect.arrayContaining(["run", "results", "nextCursor", "bundle"])
    });
    expect(clientCompatibilityMatrix.clients.find((client) => client.client === "analyst_automation")).toMatchObject({
      primaryRoutes: expect.arrayContaining(["GET /v1/analyst/loop", "GET /v1/evidence/claim-ledger", "GET /v1/restricted-metadata/status"]),
      states: expect.arrayContaining(["metadata_review", "needs_source_activation", "blocked_unsafe_target", "review_required"])
    });
    expect(clientCompatibilityMatrix.clients.find((client) => client.client === "future_sdk")?.openapiComponents).toEqual(expect.arrayContaining(["SdkPollingEnvelope", "SdkSubscriptionRegistration"]));
    expect(clientCompatibilityMatrix.clients.find((client) => client.client === "future_sse_webhooks")).toMatchObject({
      primaryRoutes: expect.arrayContaining(["GET /v1/events/search-stream", "POST /v1/webhooks/subscriptions"]),
      forbiddenPayloadFields: expect.arrayContaining(["raw_body", "restricted_raw_url", "credential", "leaked_row"])
    });
    expect(clientCompatibilityMatrix.proof).toMatchObject({
      contractIndex: "bun run check:contract-index",
      apiTests: "bun test src/tests/api.test.ts src/tests/ops.test.ts"
    });
    expect(clientGenerationFreeze).toMatchObject({
      schemaVersion: "ti.client_generation_freeze.v1",
      status: "frozen_contract_ready_for_codegen",
      mode: "contract_only_no_generated_artifacts_committed"
    });
    expect(clientGenerationFreeze.openapiManifest).toMatchObject({
      openapi: "3.1.0",
      routeCount: Object.keys(openapi.paths).length,
      source: "/v1/contracts.openapi"
    });
    expect(clientGenerationFreeze.openapiManifest.operationIdRule).toContain("operationId is stable");
    expect(clientGenerationFreeze.openapiManifest.generatedArtifactRule).toContain("/v1/contracts only");
    expect(clientGenerationFreeze.operationManifest.requiredOperationIds).toEqual(expect.arrayContaining([
      "contracts_get_v1_contracts",
      "intel_get_v1_intel_search",
      "intel_post_v1_intel_runs",
      "intel_get_v1_intel_runs_id_results"
    ]));
    expect(clientGenerationFreeze.operationManifest.requiredPublicCompatibilityRoutes).toEqual(expect.arrayContaining(["POST /api/ti/search", "GET /v1/intel/search"]));
    expect(clientGenerationFreeze.operationManifest.futureDisabledRoutes).toEqual(expect.arrayContaining(["GET /v1/events/search-stream", "POST /v1/webhooks/subscriptions"]));
    expect(clientGenerationFreeze.schemaManifest.requiredSchemas).toEqual(expect.arrayContaining([
      "ClientGenerationFreeze",
      "GeneratedClientTarget",
      "PublicSearchResponse",
      "SdkPollingEnvelope",
      "RealtimeDeliveryPrototype",
      "WebhookDeliveryAttempt"
    ]));
    expect(clientGenerationFreeze.schemaManifest.stableFieldSets.publicWrapper).toEqual(expect.arrayContaining(["runId", "pollCursor", "deltaCursor", "publicTiAnswer", "publicWrapperDelta"]));
    expect(clientGenerationFreeze.schemaManifest.forbiddenBreakingChanges).toEqual(expect.arrayContaining([
      "rename operationId",
      "remove runId or cursor fields",
      "change error envelope",
      "add raw payload fields to generated DTOs"
    ]));
    expect(clientGenerationFreeze.generatedClients.map((client) => client.target)).toEqual(expect.arrayContaining([
      "typescript_fetch_browser",
      "typescript_node_service",
      "analyst_automation_types",
      "future_realtime_types"
    ]));
    expect(clientGenerationFreeze.generatedClients.find((client) => client.target === "future_realtime_types")).toMatchObject({
      status: "disabled_until_feature_flags_enabled",
      primaryRoutes: expect.arrayContaining(["GET /v1/events/search-stream", "POST /v1/webhooks/subscriptions"])
    });
    expect(clientGenerationFreeze.fixtureManifest.requiredFixtures).toEqual(expect.arrayContaining(["fixtures/sdk/initial_public_search.json", "fixtures/sdk/future_event_delta_available.json"]));
    expect(clientGenerationFreeze.changelogGate).toMatchObject({
      schemaVersion: "ti.generated_client_changelog_gate.v1",
      status: "ready_for_generated_client_release_gate",
      releasePolicy: "contract_only_no_artifact_publish"
    });
    expect(clientGenerationFreeze.changelogGate.semverPolicy.major).toEqual(expect.arrayContaining([
      "remove or rename operationId",
      "change error envelope",
      "enable realtime delivery by default"
    ]));
    expect(clientGenerationFreeze.changelogGate.requiredChangeClasses).toEqual(expect.arrayContaining([
      "fixture_added",
      "deprecation_notice_added",
      "realtime_type_added_disabled"
    ]));
    expect(clientGenerationFreeze.changelogGate.breakingChangeBlockers).toEqual(expect.arrayContaining([
      "operation_id_removed",
      "required_schema_removed",
      "cursor_field_removed",
      "unsafe_payload_field_added"
    ]));
    expect(clientGenerationFreeze.changelogGate.deprecationPolicy).toMatchObject({
      minimumNoticeDays: 90,
      publicWrapperAlias: "POST /api/ti/search",
      canonicalRoute: "GET /v1/intel/search",
      releaseBoardRequired: true
    });
    expect(clientGenerationFreeze.changelogGate.fixtureGate.requiredFiles).toEqual(clientGenerationFreeze.fixtureManifest.requiredFixtures);
    expect(clientGenerationFreeze.changelogGate.fixtureGate.noLeakAssertions).toEqual(expect.arrayContaining(["no raw_body", "no restricted_raw_url"]));
    expect(clientGenerationFreeze.changelogGate.generatedClientReleaseChecklist).toEqual(expect.arrayContaining([
      "bun run check:sdk-fixtures",
      "bun run check:contract-index",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ]));
    expect(clientGenerationFreeze.changelogGate.changelogEntries.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "client_generation_freeze_added",
      "realtime_types_disabled",
      "public_wrapper_cutover_watch"
    ]));
    expect(clientGenerationFreeze.driftPolicy.failClosedChecks).toEqual(expect.arrayContaining([
      "operation_id_drift",
      "required_schema_missing",
      "public_wrapper_field_drift",
      "unsafe_payload_field_detected"
    ]));
    expect(clientGenerationFreeze.noLeak.forbiddenPayloadFields).toEqual(expect.arrayContaining(["raw_body", "restricted_raw_url", "credential", "webhook_secret", "authorization", "cookie"]));
    expect(clientGenerationFreeze.proofCommands).toEqual(expect.arrayContaining(["bun run check:api-regression", "bun run check:sdk-fixtures", "bun run check:contract-index"]));
    expect(JSON.stringify(clientGenerationFreeze)).not.toMatch(/authorization:|cookie=|password=|bearer_token_value|raw_body_value|restricted_raw_url_value|object_key_value|leaked_row_value|webhook_secret_value/i);
    expect(frontendProgressiveUpdateContract).toMatchObject({
      schemaVersion: "ti.frontend_progressive_update_contract.v1",
      status: "frozen_ui_polling_contract"
    });
    expect(frontendProgressiveUpdateContract.routes).toMatchObject({
      publicPost: "POST /api/ti/search",
      scraperNativeGet: "GET /v1/intel/search"
    });
    expect(frontendProgressiveUpdateContract.polling).toMatchObject({
      primary: true,
      intervalSeconds: 3
    });
    expect(frontendProgressiveUpdateContract.requiredFields).toEqual(expect.arrayContaining([
      "status",
      "runId",
      "pollCursor",
      "deltaCursor",
      "publicTiAnswer",
      "publicWrapperDelta"
    ]));
    expect(frontendProgressiveUpdateContract.stateMapping).toMatchObject({
      empty_delta: { uiState: "waiting" },
      no_result: { uiState: "searching", copy: "Searching" },
      ready: { uiState: "ready" }
    });
    expect(frontendProgressiveUpdateContract.mergeSemantics.rules).toEqual(expect.arrayContaining([
      "merge by runId and deltaCursor",
      "preserve previous publicTiAnswer on empty deltas",
      "never backfill default actor/demo copy"
    ]));
    expect(frontendProgressiveUpdateContract.uiProofMatrix.map((fixture) => fixture.scenario)).toEqual(expect.arrayContaining([
      "first_response",
      "repeated_poll_empty_delta",
      "new_delta_available",
      "made_up_actor_searching",
      "metadata_review_hold",
      "final_ready"
    ]));
    expect(frontendProgressiveUpdateContract.uiProofMatrix.find((fixture) => fixture.scenario === "made_up_actor_searching")).toMatchObject({
      query: "Made Up Actor",
      expectedUiState: "searching",
      copyRule: "Searching",
      noDefaultActor: true,
      noDemoCopy: true
    });
    expect(frontendProgressiveUpdateContract.noLeak.forbiddenUiPayloadFields).toEqual(expect.arrayContaining(["raw_body", "restricted_raw_url", "credential", "webhook_secret"]));
    expect(frontendProgressiveUpdateContract.proofCommands).toEqual(expect.arrayContaining(["bun run check:api-regression", "bun run check:contract-index", "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"]));
    expect(JSON.stringify(frontendProgressiveUpdateContract)).not.toMatch(/authorization:|cookie=|password=|bearer_token_value|raw_body_value|restricted_raw_url_value|object_key_value|leaked_row_value|webhook_secret_value/i);
    expect(scraperNativeReplacementReadiness).toMatchObject({
      schemaVersion: "ti.scraper_native_replacement_readiness.v1",
      status: "replacement_board_ready_polling_primary",
      decision: "watch_ready"
    });
    expect(scraperNativeReplacementReadiness.routes).toMatchObject({
      publicPost: "POST /api/ti/search",
      scraperNative: "GET /v1/intel/search"
    });
    expect(scraperNativeReplacementReadiness.proofMatrix.map((row) => row.case)).toEqual(expect.arrayContaining([
      "known_actor",
      "random_actor",
      "made_up_actor",
      "cve_advisory",
      "sector_country",
      "victim_company",
      "restricted_metadata_hold",
      "graph_hold",
      "empty_delta"
    ]));
    expect(scraperNativeReplacementReadiness.proofMatrix.find((row) => row.case === "made_up_actor")).toMatchObject({
      query: "Made Up Actor",
      expectedState: "searching",
      noDefaultActor: true,
      noDemoCopy: true,
      noUnsafePayload: true
    });
    expect(scraperNativeReplacementReadiness.blockers).toEqual(expect.arrayContaining([
      "default_actor_detected",
      "unknown_ready_without_evidence",
      "unsafe_payload_field_detected"
    ]));
    expect(scraperNativeReplacementReadiness.dependencies).toMatchObject({
      frontendProgressiveStatus: "frozen_ui_polling_contract",
      pollingPrimary: true,
      pollingSeconds: 3
    });
    expect(scraperNativeReplacementReadiness.noLeak.forbiddenPayloadFields).toEqual(expect.arrayContaining(["raw_body", "restricted_raw_url", "credential", "webhook_secret"]));
    expect(scraperNativeReplacementReadiness.proofCommands).toEqual(expect.arrayContaining([
      "bun run check:api-regression",
      "bun run check:contract-index",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ]));
    expect(JSON.stringify(scraperNativeReplacementReadiness)).not.toMatch(/authorization:|cookie=|password=|bearer_token_value|raw_body_value|restricted_raw_url_value|object_key_value|leaked_row_value|webhook_secret_value/i);
    expect(apifyStoreReadiness).toMatchObject({
      schemaVersion: "ti.apify_store_readiness.v1",
      status: "buyer_ready_with_external_payout_blocker"
    });
    expect(apifyStoreReadiness.actor).toMatchObject({
      name: "public-threat-actor-monitor",
      version: "0.6",
      publishedBuildVersion: "0.6.4",
      outputContract: "safe_metadata_only.v1"
    });
    expect(apifyStoreReadiness.actor.categories).toEqual(["SECURITY", "MONITORING"]);
    expect(apifyStoreReadiness.defaultSampleInput).toEqual({
      queries: [
        "APT29",
        "APT28",
        "APT42",
        "Lazarus Group",
        "Volt Typhoon",
        "Salt Typhoon",
        "Turla",
        "Sandworm",
        "Kimsuky",
        "MuddyWater",
        "Charming Kitten",
        "Scattered Spider",
        "LockBit",
        "Clop",
        "Akira",
        "Black Basta",
        "Play",
        "RansomHub",
        "ALPHV",
        "Hunters International"
      ],
      maxRowsPerQuery: 25,
      includeActivity: true,
      includeTargets: true,
      includeTtps: true,
      includeSources: true,
      includeDatasets: false,
      includeCoverageGaps: true
    });
    expect(apifyStoreReadiness.storeReadiness.listingFields).toMatchObject({
      title: "complete",
      readme: "complete",
      changelog: "complete",
      exampleInput: "complete",
      pricingModel: "complete",
      payoutMonetizationStatus: "external_verification_required"
    });
    expect(apifyStoreReadiness.storeReadiness.knownBlockers).toEqual(expect.arrayContaining([
      "apify_beneficiary_and_payout_method_not_stored_in_repo",
      "apify_beneficiary_and_payout_withdrawal_readiness_requires_external_billing_verification"
    ]));
    expect(apifyStoreReadiness.storeReadiness.readinessDecision).toBe("buyer_ready_after_external_payout_verification");
    expect(apifyStoreReadiness.storeReadiness.latestBuild).toMatchObject({
      buildVersion: "0.6.4"
    });
    expect(apifyStoreReadiness.storeReadiness.latestProofRun).toMatchObject({
      runId: "iMQGeezZ8bx7WtlhQ",
      datasetId: "5PLmkE30luBA5Lbgc",
      rowCount: 10,
      runtimeSeconds: 4,
      usageUsd: 0.001,
      projectedGrossRowRevenueUsdAfterPricing: 0.03
    });
    expect(apifyStoreReadiness.storeReadiness.dailyRunBaseline).toMatchObject({
      runId: "rh6D0UInDD6x7GuuD",
      datasetId: "dYbGGA37MRq7pU47O",
      defaultQueryCount: 20,
      rowCount: 98,
      noLeakFailures: 0,
      thinRowCount: 80,
      singleSourceRowCount: 69
    });
    expect(apifyStoreReadiness.storeReadiness.dailyRunBaseline.knownQualityGaps).toEqual(expect.arrayContaining([
      "stale_apt29_rows",
      "apt28_rows_without_public_evidence",
      "apt42_missing_public_channel_coverage"
    ]));
    expect(apifyStoreReadiness.publicProofDtos.map((proof) => proof.query)).toEqual(expect.arrayContaining([
      "APT29",
      "Volt Typhoon",
      "Scattered Spider",
      "LockBit"
    ]));
    for (const proof of apifyStoreReadiness.publicProofDtos) {
      expect(proof.schemaVersion).toBe("ti.public_proof_dto.v1");
      expect(proof.runId).toMatch(/^apify_sample_run_/);
      expect(proof.sourceRunId).toBe("iMQGeezZ8bx7WtlhQ");
      expect(proof.sourceDatasetId).toBe("5PLmkE30luBA5Lbgc");
      expect(proof.buildVersion).toBe("0.6.4");
      expect(proof.datasetId).toMatch(/^apify_sample_dataset_/);
      expect(proof.rowCount).toBeGreaterThan(0);
      expect(proof.safetyContract).toBe("safe_metadata_only.v1");
      expect(proof.sourceFamilies.length).toBeGreaterThan(0);
    }
    for (const row of apifyStoreReadiness.sampleOutputDtos) {
      expect(row.rawContentIncluded).toBe(false);
      expect(row.safety).toMatchObject({
        metadataOnly: true,
        credentialsIncluded: false,
        stolenFilesIncluded: false,
        privateContentIncluded: false,
        actorInteraction: false
      });
    }
    expect(apifyStoreReadiness.frontendApiCompatibility.states.map((state) => state.state)).toEqual(expect.arrayContaining([
      "queued",
      "searching",
      "partial",
      "ready",
      "empty_delta"
    ]));
    expect(apifyStoreReadiness.frontendApiCompatibility.unknownActorCopy).toBe("Searching");
    expect(apifyStoreReadiness.frontendApiCompatibility.emptyDeltaRule).toContain("preserve the last safe answer");
    expect(apifyStoreReadiness.pricingHooks).toMatchObject({
      model: "pay_per_dataset_row",
      unitEvent: "apify-default-dataset-item",
      actorStartEvent: "apify-actor-start",
      effectiveDate: "2026-07-04",
      rowPriceUsdPerThousand: 3,
      actorStartPriceUsd: 0.00005,
      platformUsageIncludedForUsers: true,
      apifyMarginPercent: 20,
      payoutStatus: "not_available_without_external_apify_account_verification"
    });
    expect(apifyStoreReadiness.conversionTracking).toMatchObject({
      currentStorePageViews: null,
      currentUniqueUsers: null,
      currentTrialRuns: null,
      currentPaidRuns: null,
      currentConversionRate: null,
      handoffRoute: "/v1/ops/product-slo.apifyLaunchExperiment"
    });
    expect(apifyStoreReadiness.conversionTracking.metricsToTrack).toEqual(expect.arrayContaining([
      "storePageViews",
      "uniqueUsers",
      "trialRuns",
      "paidRuns",
      "actorStarts",
      "datasetRows",
      "failedRuns",
      "refunds",
      "platformUsageCostUsd",
      "estimatedCreatorRevenueUsd",
      "conversionRate",
      "usefulRowRate",
      "freshRowRate",
      "costPerUsefulRow"
    ]));
    expect(apifyStoreReadiness.marketplaceTelemetryInputContract).toMatchObject({
      schemaVersion: "ti.apify_marketplace_telemetry_input.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/contracts#apifyStoreReadiness", "/v1/ops/product-slo", "route_inventory"]),
      realDataRequired: true,
      unknownMeansNoClaim: true
    });
    expect(apifyStoreReadiness.marketplaceTelemetryInputContract.fields).toEqual(expect.arrayContaining(["storePageViews", "uniqueUsers", "trialRuns", "paidRuns", "actorStarts", "actorRuns", "datasetRows", "failedRuns", "repeatUsers", "refunds", "platformUsageCostUsd", "estimatedCreatorRevenueUsd"]));
    expect(apifyStoreReadiness.marketplaceTelemetryInputContract.currentValues.storePageViews).toBeNull();
    expect(apifyStoreReadiness.marketplaceTelemetryInputContract.currentValues.paidRuns).toBeNull();
    expect(apifyStoreReadiness.marketplaceTelemetryInputContract.forbiddenSyntheticClaims).toEqual(expect.arrayContaining(["synthetic_unique_users", "invented_paid_runs", "placeholder_payout_ready"]));
    expect(apifyStoreReadiness.payoutReadiness).toMatchObject({
      schemaVersion: "ti.apify_payout_readiness.v1",
      payoutMethodState: "unknown",
      beneficiaryState: "unknown",
      withdrawalReadiness: "unknown",
      externallyVerified: false,
      externalVerificationRequired: expect.arrayContaining(["beneficiary", "payout_method", "withdrawal_readiness"])
    });
    expect(apifyStoreReadiness.revenueConversionChecklist).toMatchObject({
      schemaVersion: "ti.apify_revenue_conversion_checklist.v1",
      telemetryState: "missing",
      payoutState: "unknown"
    });
    expect(apifyStoreReadiness.revenueConversionChecklist.checks.map((check) => check.id)).toEqual(expect.arrayContaining(["listing_copy", "sample_rows", "pricing_shape", "marketplace_telemetry", "payout_setup", "fake_traction_guards", "no_leak_sample_proof"]));
    expect(apifyStoreReadiness.revenueConversionChecklist.nextManualVerificationStep).toContain("Open Apify Store analytics and billing");
    expect(apifyStoreReadiness.pricingProof).toMatchObject({
      schemaVersion: "ti.apify_pricing_proof.v1",
      starterTrialShape: { name: "starter_actor_query_pack", queryLimit: 3 },
      paidDailyMonitoringShape: { name: "high_freshness_apt_monitoring_pack", defaultQueryCount: 20, minimumSellableRowRate: 0.25, minimumFreshRowRate: 0.55 },
      usageCostGuard: { rowPriceUsdPerThousand: 3, platformUsageCostUsd: null, estimatedCreatorRevenueUsd: null, maxCostPerUsefulRowUsd: 0.01 },
      payoutRevenueSeparation: { paymentMethodState: "unknown", beneficiaryState: "unknown", withdrawalReadiness: "unknown", externallyVerifiedRevenueUsd: null },
      noLeakRequired: true
    });
    expect(apifyStoreReadiness.conversionExperiments.map((experiment) => experiment.id)).toEqual(["starter_actor_query_pack", "high_freshness_apt_monitoring_pack", "ransomware_public_claim_metadata_pack"]);
    expect(apifyStoreReadiness.conversionExperiments.every((experiment) => experiment.buyerVisibleFields.includes("noLeakProof") && experiment.noLeakRequired && experiment.successCriteria.length > 0 && experiment.stopLossCriteria.length > 0)).toBe(true);
    expect(apifyStoreReadiness.buyerSampleRows).toHaveLength(12);
    expect(apifyStoreReadiness.buyerSampleRows.map((row) => row.rowClass)).toEqual(expect.arrayContaining(["actor_summary", "fresh_claim", "victim_or_dataset_lead", "ttp_targeting_hint"]));
    expect(apifyStoreReadiness.buyerSampleRows.every((row) =>
      row.buyerVisibleFields.noLeakProof === "metadata_only_no_raw_body_no_credentials_no_private_content" &&
      row.buyerVisibleFields.provenanceHash.length > 0 &&
      row.buyerVisibleFields.nextAnalystPivots.length > 0
    )).toBe(true);
    expect(apifyStoreReadiness.operatorBlockerBoard.map((row) => row.owner)).toEqual(expect.arrayContaining(["Agent 01", "Agent 03", "Agent 04", "Agent 05", "Agent 07", "Agent 08", "Agent 10"]));
    expect(apifyStoreReadiness.fakeTractionGuards.join(" ")).toContain("remain null until sourced from Apify analytics");
    expect(apifyStoreReadiness.fakeTractionGuards.join(" ")).toContain("local sample runs and owner proof runs never count");
    expect(apifyStoreReadiness.fakeTractionGuards.join(" ")).toContain("synthetic proof rows never count");
    expect(apifyStoreReadiness.buyerFacingConversionProof).toMatchObject({
      schemaVersion: "ti.apify_buyer_facing_conversion_proof.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/contracts#apifyStoreReadiness", "/v1/ops/product-slo", "/v1/quality/evaluate"]),
      readyProof: {
        runId: "OThlfd0uzSCNnedAO",
        datasetId: "LSen2fYtwFTtOr7vK",
        rowCount: 10,
        sellableRows: 4,
        averageBuyerValueScore: 0.577,
        monetizationDecision: "ready_for_paid_traffic"
      },
      qualityLiftHandoff: {
        productSloField: "buyerVisibleQualityLiftGate",
        graphLiftField: "OUTPUT.graphLiftBatch2",
        dryRun: true,
        willMutateSources: false,
        willStartCollection: false
      },
      conversionReadinessSummary: {
        minimumSellableRowRate: 0.25,
        currentSellableRowRate: 0.4,
        minimumAverageBuyerValueScore: 0.55,
        currentAverageBuyerValueScore: 0.577
      }
    });
    expect(apifyStoreReadiness.buyerFacingConversionProof.buyerReadableExamples.map((row) => row.decision)).toEqual(expect.arrayContaining(["sellable", "included_with_caveat", "hold"]));
    expect(apifyStoreReadiness.buyerFacingConversionProof.buyerReadableExamples.every((row) => row.requiredVisibleFields.length > 0)).toBe(true);
    expect(apifyStoreReadiness.buyerFacingConversionProof.noLeakGuarantee).toContain("does not expose raw evidence bodies");
    expect(apifyStoreReadiness.sampleOutputSummaries).toEqual(expect.arrayContaining([
      expect.objectContaining({ query: "APT42", runId: "iMQGeezZ8bx7WtlhQ", datasetId: "5PLmkE30luBA5Lbgc", rowSafety: "metadata_only" })
    ]));
    expect(apifyStoreReadiness.marketplaceGuardrails).toMatchObject({
      noPlaceholderDefaults: true,
      noHelloWorldSampleInput: true,
      noGenericCategories: true,
      noAiFlavoredCopy: true,
      safeOutputOnly: true
    });
    expect(apifyStoreReadiness.proofCommands).toEqual(expect.arrayContaining([
      "bun run check:apify-threat-actor-monitor",
      "bun run smoke:apify-threat-actor-monitor",
      "bun run check:apify-publication",
      "TI_SEARCH_READINESS_QUERY='Volt Typhoon' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Scattered Spider' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY=LockBit bun run check:scraper-native-search"
    ]));
    expect(JSON.stringify(apifyStoreReadiness)).not.toMatch(/authorization:|cookie=|password=|bearer_token_value|raw_body_value|restricted_raw_url_value|object_key_value|leaked_row_value|webhook_secret_value/i);
    expect(darkwebIndexFrontendContract).toMatchObject({
      schemaVersion: "ti.darkweb_index_frontend_contract.v1",
      status: "frozen_metadata_only_frontend_contract",
      route: "/ti/darkweb/index",
      publicRoute: "hanasand.com/ti/darkweb/index",
      apiRoutes: {
        status: "/v1/darkweb/status",
        search: "/v1/darkweb/search",
        contracts: "/v1/contracts"
      }
    });
    expect(darkwebIndexFrontendContract.table.columns).toEqual(expect.arrayContaining(["redactedDisplayUrl", "category", "legalTriage", "safeSummary", "lastSeen", "liveness", "provenance", "reviewState"]));
    expect(darkwebIndexFrontendContract.table.filters).toEqual(expect.arrayContaining(["q", "category", "legalTriage", "liveness", "network", "reviewState", "cursor", "limit"]));
    expect(darkwebIndexFrontendContract.safeDetailDrawer.sections).toEqual(expect.arrayContaining(["summary", "classification", "whatWasNotAccessed", "sourceProvenance", "refreshHistory", "graphLinks", "reviewState"]));
    expect(darkwebIndexFrontendContract.copyRules.legalTriageDisclaimer).toBe("Risk labels are triage labels, not legal advice.");
    expect(darkwebIndexFrontendContract.copyRules.bannedPhrases).toEqual(expect.arrayContaining(["full onion URL", "credential sample"]));
    expect(darkwebIndexFrontendContract.noLeak).toMatchObject({
      metadataOnly: true,
      rawUnsafeUrlPublicOutputAllowed: false
    });
    expect(darkwebIndexFrontendContract.noLeak.forbiddenUiPayloadFields).toEqual(expect.arrayContaining(["rawUnsafeUrl", "fullOnionUrl", "credential", "object_key", "leaked_row", "payload_download"]));
    expect(darkwebIndexFrontendContract.releaseGate.blockers).toEqual(expect.arrayContaining(["what_was_not_accessed_missing", "legal_triage_copy_implies_advice"]));
    expect(darkwebIndexFrontendContract.proofCommands).toEqual(expect.arrayContaining(["bun run check:api-regression", "bun run check:contract-index", "bun test"]));
    expect(JSON.stringify(darkwebIndexFrontendContract)).not.toMatch(/authorization:|cookie=|password=|bearer_token_value|raw_body_value|restricted_raw_url_value|object_key_value|leaked_row_value|webhook_secret_value/i);
    expect(sourceAtlasFrontendContract).toMatchObject({
      schemaVersion: "ti.source_atlas_frontend_contract.v1",
      status: "frozen_dry_run_source_discovery_frontend_contract",
      route: "/ti/sources/atlas",
      publicRoute: "hanasand.com/ti/sources/atlas",
      apiRoutes: {
        atlas: "/v1/sources/atlas",
        export: "/v1/sources/atlas/export",
        contracts: "/v1/contracts",
        approvalQueue: "/v1/analyst/source-activation-packets"
      }
    });
    expect(sourceAtlasFrontendContract.sdkOpenapi.operationIds).toEqual(expect.arrayContaining(["sources_post_v1_sources_atlas", "sources_post_v1_sources_atlas_export", "contracts_get_v1_contracts"]));
    expect(sourceAtlasFrontendContract.table.columns).toEqual(expect.arrayContaining(["id", "domain", "family", "queryClassCoverage", "sourceValueScore", "parserCapability", "legalRobotsState", "activationReadiness", "approvalRequired"]));
    expect(sourceAtlasFrontendContract.table.filters).toEqual(expect.arrayContaining(["queryClass", "family", "parserState", "legalRobotsState", "activationReadiness", "recordLimit"]));
    expect(sourceAtlasFrontendContract.safeDetailDrawer.sections).toEqual(expect.arrayContaining(["sourceSummary", "coverage", "parserCapability", "legalRobots", "activationReadiness", "approvalPacket", "rollbackPacket", "canaryPlan", "whatWillNotHappen"]));
    expect(sourceAtlasFrontendContract.safeDetailDrawer.nonActions).toEqual(expect.arrayContaining(["import source pack", "mutate registry", "enqueue crawl", "activate candidate", "fetch restricted target"]));
    expect(sourceAtlasFrontendContract.importPlans.labels).toEqual(["first_100", "first_1000", "future_10k"]);
    expect(sourceAtlasFrontendContract.copyRules.dryRunBanner).toBe("Dry run only. No sources are imported or crawled from this view.");
    expect(sourceAtlasFrontendContract.copyRules.bannedPhrases).toEqual(expect.arrayContaining(["activate now", "crawl now", "CAPTCHA bypass", "credentialed access"]));
    expect(sourceAtlasFrontendContract.noLeak).toMatchObject({
      publicOnly: true,
      dryRunOnly: true,
      rawUnsafeUrlPublicOutputAllowed: false
    });
    expect(sourceAtlasFrontendContract.noLeak.forbiddenUiPayloadFields).toEqual(expect.arrayContaining(["rawRestrictedUrl", "privateInviteUrl", "credential", "raw_payload", "object_key", "download_url"]));
    expect(sourceAtlasFrontendContract.noLeak.forbiddenOperations).toEqual(expect.arrayContaining(["source pack import", "registry mutation", "crawl enqueue", "silent activation", "private/invite/auth/CAPTCHA activation"]));
    expect(sourceAtlasFrontendContract.releaseGate.blockers).toEqual(expect.arrayContaining(["will_mutate_true", "auto_activation_allowed", "private_auth_captcha_source_detected"]));
    expect(sourceAtlasFrontendContract.proofCommands).toEqual(expect.arrayContaining(["bun run check:api-regression", "bun run check:contract-index", "bun test"]));
    expect(JSON.stringify(sourceAtlasFrontendContract)).not.toMatch(/authorization:|cookie=|password=|bearer_token_value|raw_body_value|restricted_raw_url_value|object_key_value|leaked_row_value|webhook_secret_value/i);
    expect(openapi).toEqual(enterpriseApiSurface.openapi);
    expect(Object.keys(openapi.components.schemas)).toEqual(expect.arrayContaining(["StreamingEventEnvelope", "WebhookDeliveryAttempt"]));
    expect(semantics.enterpriseApiSurface).toEqual(enterpriseApiSurface);
    expect(semantics.sdkIntegration).toEqual(sdkIntegration);
    expect(semantics.clientCompatibilityMatrix).toEqual(clientCompatibilityMatrix);
    expect(semantics.streamingWebhookCompatibility).toEqual(streamingWebhookCompatibility);
    expect(semantics.publicWrapperCutoverReadiness).toEqual(publicWrapperCutoverReadiness);
    expect(semantics.realtimeDeliveryPrototype).toEqual(realtimeDeliveryPrototype);
    expect(semantics.realtimeDeliverySoak).toEqual(realtimeDeliverySoak);
    expect(semantics.clientGenerationFreeze).toEqual(clientGenerationFreeze);
    expect(semantics.frontendProgressiveUpdateContract).toEqual(frontendProgressiveUpdateContract);
    expect(semantics.scraperNativeReplacementReadiness).toEqual(scraperNativeReplacementReadiness);
    expect(semantics.apifyStoreReadiness).toEqual(apifyStoreReadiness);
    expect(semantics.darkwebIndexFrontendContract).toEqual(darkwebIndexFrontendContract);
    expect(semantics.sourceAtlasFrontendContract).toEqual(sourceAtlasFrontendContract);
    expect(semantics.authBoundary).toEqual(enterpriseApiSurface.authBoundary);
    expect(semantics.pagination).toEqual(enterpriseApiSurface.pagination);
    expect(semantics.rateLimits).toEqual(enterpriseApiSurface.rateLimits);
    expect(semantics.auditFields).toEqual(enterpriseApiSurface.auditFields);
    expect(semantics.openapi).toEqual(enterpriseApiSurface.openapi);
    expect(routeInventory.routes.map((route) => `${route.method} ${route.path}`)).toEqual(expect.arrayContaining([
      "GET /v1/health",
      "GET /v1/contracts",
      "POST /v1/intel/runs",
      "GET /v1/intel/search",
      "POST /v1/sources/coverage-closeout",
      "GET /v1/evidence/claim-ledger",
      "GET /v1/graph/query",
      "GET /v1/graph/timeline",
      "POST /v1/sources/{id}/restricted-metadata/apply-plan"
    ]));
    expect(routeInventory.routes.every((route) => route.guarantees.includes("no_leak_dto"))).toBe(true);
    expect(semantics.sourceActivationExecutionReadiness.routes).toEqual(expect.arrayContaining([
      "/v1/sources/coverage-closeout",
      "/v1/sources/activation-batches",
      "/v1/intel/search",
      "/v1/contracts"
    ]));
    expect(semantics.sourceActivationExecutionReadiness.fields).toEqual(expect.arrayContaining([
      "first10Canary",
      "publicRollout50",
      "parserGapHandoff",
      "queueBudgetImpact",
      "agent10ReleasePacket"
    ]));
    expect(semantics.sourceRolloutPromotionPacket.fields).toEqual(expect.arrayContaining([
      "rolloutPromotion",
      "publicTiAnswerEffect",
      "agent02SchedulerTelemetry",
      "agent06EvidenceCertification",
      "agent07PollingState",
      "agent09ContractIndex",
      "agent10CanaryReleaseDecision"
    ]));
    expect(surfaces.find((surface) => surface.name === "sources")?.responseKeys).toContain("executionReadiness");
    expect(surfaces.find((surface) => surface.name === "sources")?.responseKeys).toContain("rolloutPromotion");
    expect(surfaces.find((surface) => surface.name === "sources")?.guarantees).toContain("source_activation_execution_readiness");
    expect(surfaces.find((surface) => surface.name === "sources")?.guarantees).toContain("source_rollout_promotion_packet");
    expect(publicCompatibility).toMatchObject({
      canonicalMethod: "POST",
      canonicalPublicPath: "/api/ti/search",
      mapsTo: "/v1/intel/search"
    });
    expect(publicCompatibility.stableFields).toEqual(expect.arrayContaining([
      "query",
      "mode",
      "status",
      "runId",
      "refreshAfterSeconds",
      "summary",
      "warnings",
      "cursor",
      "nextCursor",
      "pollCursor",
      "deltaCursor",
      "updated",
      "analystLoop",
      "tiExperience",
      "answer",
      "publicTiAnswer",
      "publicWrapperDelta"
    ]));
    expect(publicCompatibility.publicAnswerContract).toMatchObject({
      schemaVersion: "ti.public_answer_contract.v1",
      field: "publicTiAnswer",
      nestedAnswerField: "answer.publicContract"
    });
    expect(publicCompatibility.publicAnswerContract.requiredSections).toEqual(expect.arrayContaining([
      "safeSummary",
      "stateMachine",
      "releaseCandidate",
      "ux",
      "waitReasons",
      "sourceCoverageGaps",
      "evidenceLedgerReferences",
      "graphStixReadiness",
      "safeWording"
    ]));
    expect(publicCompatibility.publicAnswerContract.safeWordingGuarantee).toContain("must not be worded as confirmed facts");
    expect(Object.keys(publicCompatibility.statusMapping).sort()).toEqual(["blocked", "error", "partial", "ready", "review_required"]);
    expect(semantics.stateMachine.schemaVersion).toBe("ti.public_answer_polling_state.v1");
    expect(Object.keys(semantics.stateMachine.states).sort()).toEqual([
      "blocked",
      "contradicted",
      "error",
      "first_response",
      "live_partial",
      "no_result",
      "promoted_evidence",
      "queued_collection",
      "ready",
      "review_required",
      "source_biased",
      "stale"
    ]);
    expect(semantics.stateMachine.states.live_partial.requiredFields).toEqual(expect.arrayContaining(["summary", "warnings", "publicTiAnswer.stateMachine.changedSinceCursor"]));
    expect(semantics.stateMachine.states.blocked.publicPromotion).toBe("blocked_fail_closed");
    expect(semantics.stateMachine.requiredUiFields).toEqual(expect.arrayContaining([
      "progress",
      "changedSinceCursor",
      "polling",
      "holds",
      "safeNoResult"
    ]));
    expect(semantics.publicAnswerReleaseCandidate).toMatchObject({
      schemaVersion: "ti.public_answer_release_candidate.v1",
      field: "publicTiAnswer.releaseCandidate"
    });
    expect(semantics.publicAnswerReleaseCandidate.states).toEqual(expect.arrayContaining([
      "ready",
      "canary_ready",
      "canary_with_warnings",
      "partial",
      "review_required",
      "blocked",
      "no_result",
      "stale",
      "contradicted",
      "source_biased",
      "provider_unavailable",
      "scraper_unavailable",
      "policy_blocked"
    ]));
    expect(semantics.publicAnswerReleaseCandidate.queryClasses).toEqual(expect.arrayContaining([
      "actor",
      "ransomware",
      "random_actor",
      "cve",
      "malware_tool",
      "country",
      "sector",
      "victim"
    ]));
    expect(semantics.publicAnswerReleaseCandidate.visibleAnswerInputs).toEqual(expect.arrayContaining([
      "sourceCanary",
      "schedulerControlPlane",
      "publicChannelPromotion",
      "restrictedEmergencyStop",
      "evidenceCutover",
      "graphExport",
      "apiContractState"
    ]));
    expect(semantics.publicAnswerReleaseCandidate.requiredUiFields).toEqual(expect.arrayContaining([
      "visibleAnswer",
      "releaseGates",
      "agent10RcGate",
      "publicPostCompatibility"
    ]));
    expect(semantics.publicAnswerReleaseCandidate.fixtures.map((fixture) => fixture.state)).toEqual(expect.arrayContaining(semantics.publicAnswerReleaseCandidate.states));
    expect(semantics.publicAnswerReleaseCandidate.fixtures.map((fixture) => fixture.query)).toEqual(expect.arrayContaining([
      "APT29",
      "Volt Typhoon",
      "Scattered Spider",
      "Akira",
      "Turla",
      "CVE-2026-11111",
      "Snake",
      "Norway",
      "energy",
      "Fjord Energy AS"
    ]));
    expect(semantics.publicAnswerReleaseCandidate.fixtures.every((fixture) => fixture.publicPostCompatible)).toBe(true);
    expect(semantics.publicAnswerReleaseCandidate.agent10RcGate.statuses).toEqual(["pass", "warning", "blocker"]);
    expect(semantics.publicAnswerReleaseCandidate.agent10RcGate.proofCommands).toContain("bun run check:scraper-native-search");
    expect(semantics.publicAnswerReleaseCandidate.guarantee).toContain("fail-closed");
    expect(semantics.publicAnswerUxSemantics).toMatchObject({
      schemaVersion: "ti.public_answer_ux.v1",
      field: "publicTiAnswer.ux",
      copyRules: {
        unknownQuery: "Searching",
        noBloatedPolicyParagraph: true
      },
      polling: {
        intervalSeconds: 3
      },
      publicWrapperCompatibility: {
        noDefaultQuery: true,
        canonicalMethod: "POST",
        canonicalPath: "/api/ti/search"
      }
    });
    expect(semantics.publicAnswerUxSemantics.states).toEqual(expect.arrayContaining([
      "ready",
      "partial",
      "searching",
      "no_result",
      "provider_unavailable",
      "scraper_unavailable",
      "queue_pressure",
      "review_required",
      "stale",
      "contradicted",
      "source_biased",
      "policy_blocked",
      "restricted_held"
    ]));
    expect(semantics.publicAnswerUxSemantics.queryFixtures.map((fixture) => fixture.query)).toEqual(expect.arrayContaining([
      "APT29",
      "APT42",
      "Turla",
      "Volt Typhoon",
      "Scattered Spider",
      "Akira",
      "Unseen Quartz Actor",
      "CVE-2026-11111",
      "Snake",
      "Norway",
      "energy",
      "Fjord Energy AS"
    ]));
    expect(semantics.publicAnswerUxSemantics.copyRules.bannedPhrases).toEqual(expect.arrayContaining(["not in local cache", "local cache", "demo", "default APT29"]));
    expect(semantics.publicAnswerUxSemantics.freshness.rule).toContain("lastSeen is shown only when evidence supplies");
    expect(semantics.publicAnswerUxSemantics.polling.fields).toEqual(expect.arrayContaining(["publicTiAnswer.ux.polling", "refreshAfterSeconds", "nextPollSeconds"]));
    expect(semantics.cutoverScenarios.map((scenario) => scenario.code)).toEqual(expect.arrayContaining([
      "provider_unavailable",
      "scraper_unavailable",
      "queue_pressure",
      "stale_evidence",
      "no_approved_sources",
      "policy_blocked",
      "duplicate_run_reuse"
    ]));
    expect(semantics.cutoverScenarios.find((scenario) => scenario.code === "duplicate_run_reuse")).toMatchObject({
      state: "partial",
      warningCode: "duplicate_run_reuse"
    });
    expect(semantics.cursorPolling.responseFields).toEqual(expect.arrayContaining(["cursor", "nextCursor", "refreshAfterSeconds", "nextPollSeconds"]));
    expect(semantics.idempotency).toMatchObject({ header: "idempotency-key", route: "POST /v1/intel/runs" });
    expect(semantics.publicChannelCanary).toMatchObject({
      routes: expect.arrayContaining(["/v1/public-channels/status", "/v1/public-channels/apply-plan", "/v1/intel/search"]),
      fields: expect.arrayContaining(["canaryRollout", "promotionCanary", "promotionCertification", "agent06EvidenceHandoff", "agent07AnswerCaveats", "agent10ReleaseTrain"])
    });
    expect(semantics.publicChannelPromotionCanary).toMatchObject({
      fields: expect.arrayContaining(["sourceHealth", "evidenceFlow", "claimCandidates", "graphHints", "agent06EvidenceCutover", "agent07PublicAnswer", "agent10RcGate"]),
      healthSignals: expect.arrayContaining(["rateLimitDebt", "duplicateUrlPressure", "editDeleteChurn", "unavailableWindows", "languageDrift", "spamChurn", "evidenceYield", "claimYield", "rollbackTriggers"])
    });
    expect(semantics.publicChannelPromotionCertification).toMatchObject({
      routes: expect.arrayContaining(["/v1/public-channels/status", "/v1/public-channels/apply-plan", "/v1/intel/search", "/v1/contracts"]),
      fields: expect.arrayContaining(["decisionRules", "evidenceCertification", "claimCertification", "graphCertification", "agent06EvidenceCertification", "agent07AnswerStateMachine", "agent08GraphCertification", "agent10RcGate"]),
      influenceSurfaces: expect.arrayContaining(["public_answer", "graph", "source_health", "release"])
    });
    expect(semantics.restrictedMetadataConnectorCertification).toMatchObject({
      routes: expect.arrayContaining(["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search"]),
      scenarios: expect.arrayContaining(["healthy_approved_metadata_source", "missing_approval", "unsafe_link_form_download", "retention_expiry"]),
      packetFields: expect.arrayContaining(["networkIsolation", "approval", "redaction", "guarantees", "noLeakSerialization"])
    });
    expect(semantics.restrictedMetadataConnectorCertification.guarantee).toContain("no downloads");
    expect(semantics.restrictedMetadataKillSwitchDrills).toMatchObject({
      routes: expect.arrayContaining(["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search"]),
      scenarios: expect.arrayContaining(["healthy_metadata_only_canary", "kill_switch_activation_mid_run", "public_api_blocked_state"]),
      packetFields: expect.arrayContaining(["killSwitchPropagation", "agent10RcGate", "noLeakSerialization"])
    });
    expect(semantics.restrictedMetadataKillSwitchDrills.guarantee).toContain("no downloads");
    expect(semantics.restrictedMetadataEmergencyStopCertification).toMatchObject({
      routes: expect.arrayContaining(["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search"]),
      scenarios: expect.arrayContaining(["kill_switch_propagation", "timeout_spike", "public_api_blocked_state"]),
      packetFields: expect.arrayContaining(["controls", "proof", "agent06EvidenceRedactionCertification", "agent10EmergencyStopGate", "noLeakSerialization"])
    });
    expect(semantics.restrictedMetadataEmergencyStopCertification.guarantee).toContain("without unsafe access");
    expect(semantics.graphExportCertification).toMatchObject({
      routes: expect.arrayContaining(["/v1/graph/query", "/v1/graph/review-plan", "/v1/exports/stix", "/v1/contracts"]),
      scenarios: expect.arrayContaining(["apt29_actor_profile", "restricted_only_evidence", "missing_ledger_id", "schema_risk_export", "missing_provenance", "contradicted_relationship", "analyst_reviewed_promotion"]),
      packetFields: expect.arrayContaining(["scenarios", "noUnsupportedTaxiiServerClaims", "releasePacket", "rcGate"])
    });
    expect(semantics.graphExportCertification.guarantee).toMatch(/release-candidate gate/i);
    expect(semantics.graphLiveSearchUpdate).toMatchObject({
      routes: expect.arrayContaining(["/v1/graph/query", "/v1/graph/review-plan", "/v1/exports/stix", "/v1/contracts"]),
      scenarios: expect.arrayContaining(["apt42_clear_web", "volt_typhoon_public_channel", "public_channel_only_hint", "restricted_held_evidence", "stix_export_eligible"]),
      deltaStreamFixtures: expect.arrayContaining(["clear_web_capture_promotion", "public_channel_hint", "restricted_metadata_held", "claim_ledger_hold", "contradicted_attribution", "stale_ttp", "analyst_rejected_relation", "graph_rollback", "stix_export_eligibility_change"]),
      packetFields: expect.arrayContaining(["nextPollSeconds", "deltaCounts", "scenarioCoverage", "deltaStream", "agentHandoffs", "taxiiBoundary"])
    });
    expect(semantics.graphLiveSearchUpdate.guarantee).toMatch(/graph delta stream fixtures/i);
    expect(semantics.graphBackendRepository).toMatchObject({
      routes: expect.arrayContaining(["/v1/graph/query", "/v1/graph/review-plan", "/v1/exports/stix", "/v1/contracts"]),
      backendCandidates: expect.arrayContaining(["memory_snapshot", "postgres_graph_tables", "neo4j"]),
      operations: expect.arrayContaining(["upsert_node", "upsert_relationship", "append_provenance", "append_review_decision", "record_cursor_delta", "update_export_eligibility"]),
      packetFields: expect.arrayContaining(["tenantScope", "operations", "reviewWorkflow", "exportEligibility", "cursorDeltas", "handoffs"])
    });
    expect(semantics.graphBackendRepository.guarantee).toMatch(/backend-neutral graph repository contract/i);
    expect(semantics.evidencePersistenceCertification).toMatchObject({
      routes: expect.arrayContaining(["/v1/evidence/claim-ledger", "/v1/evidence/cutover-report", "/v1/intel/search", "/v1/contracts"]),
      scenarios: expect.arrayContaining(["clean_cutover", "missing_object", "hash_mismatch", "cursor_gap", "object_store_write_failure"]),
      packetFields: expect.arrayContaining(["objectStore", "postgresRepository", "cursorReplay", "retention", "redaction", "claimPromotion", "downstream"])
    });
    expect(semantics.evidencePersistenceCertification.guarantee).toContain("without exposing raw bodies or object keys");
    expect(semantics.warningCodes).toEqual(expect.arrayContaining([
      "provider_unavailable",
      "scraper_unavailable",
      "queue_pressure",
      "stale_evidence",
      "no_approved_sources",
      "policy_blocked",
      "duplicate_run_reuse",
      "scheduler_migration_postgres_shadow",
      "scheduler_retry_debt_watch",
      "scheduler_dead_letter_watch",
      "scheduler_cursor_waiting_for_deltas"
    ]));
    expect(semantics.errorEnvelope.error.code).toContain("idempotency_conflict");
    expect(semantics.errorEnvelope.error.code).toContain("scraper_unavailable");
    expect(semantics.errorEnvelope.error.code).toContain("duplicate_run_reuse");
    expect(surfaces.map((surface) => surface.path)).toEqual(expect.arrayContaining([
      "/v1/intel/search",
      "/v1/intel/runs/{id}",
      "/v1/intel/runs/{id}/results",
      "/v1/sources/*",
      "/v1/frontier/*",
      "/v1/evidence/*",
      "/v1/graph/*",
      "/v1/exports/stix",
      "/v1/public-channels/*",
      "/v1/restricted-metadata/*",
      "/v1/darkweb/*"
    ]));
    expect(surfaces.find((surface) => surface.path === "/v1/intel/search")?.responseKeys).toEqual(expect.arrayContaining([
      "sla",
      "quality",
      "actorProfile",
      "pollCursor",
      "deltaCursor",
      "updated",
      "publicWrapperDelta"
    ]));
    expect(surfaces.find((surface) => surface.path === "/v1/intel/search")?.guarantees).toContain("delta_polling");
    expect(surfaces.find((surface) => surface.path === "/v1/public-channels/*")?.responseKeys).toEqual(expect.arrayContaining(["canaryRollout"]));
    expect(surfaces.find((surface) => surface.path === "/v1/restricted-metadata/*")?.responseKeys).toEqual(expect.arrayContaining(["connectorCertification", "killSwitchDrills", "emergencyStopCertification", "nonBlockingSearch"]));
    expect(surfaces.find((surface) => surface.path === "/v1/darkweb/*")?.responseKeys).toEqual(expect.arrayContaining(["status", "darkwebIndex", "records", "counts", "latestRefreshRun", "storageReadiness", "uiContract", "frontendContract"]));
    expect(surfaces.find((surface) => surface.path === "/v1/darkweb/*")?.guarantees).toEqual(expect.arrayContaining([
      "darkweb_metadata_index",
      "darkweb_index_frontend_contract",
      "isolated_collector_contract",
      "hash_only_records",
      "60k_scale_target",
      "no_leak_serialization"
    ]));
    expect(semantics.darkwebIndex).toMatchObject({
      field: "darkwebIndex",
      routes: expect.arrayContaining(["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts"]),
      targetRecordCount: 60000,
      fixtureRecordCount: 100,
      recordFields: expect.arrayContaining(["rawUrlHash", "hostHash", "pathHash", "redactedDisplayUrl", "whatWasNotAccessed", "isolationBoundary"]),
      searchFilters: expect.arrayContaining(["q", "category", "legalTriage", "liveness", "network", "cursor", "limit"])
    });
    expect(semantics.darkwebIndex.guarantee).toContain("no raw unsafe URL");
    expect(surfaces.find((surface) => surface.path === "/v1/graph/*")?.guarantees).toContain("graph_export_certification");
    expect(surfaces.find((surface) => surface.path === "/v1/graph/*")?.guarantees).toContain("graph_live_update");
    expect(surfaces.find((surface) => surface.path === "/v1/graph/*")?.guarantees).toContain("graph_stix_rc_gate");
    expect(surfaces.find((surface) => surface.path === "/v1/evidence/*")?.responseKeys).toContain("certification");
    expect(surfaces.find((surface) => surface.path === "/v1/evidence/*")?.guarantees).toContain("persistence_certification");
    expect(surfaces.find((surface) => surface.path === "/v1/exports/stix")?.guarantees).toContain("taxii_descriptor_only");
    expect(surfaces.find((surface) => surface.path === "/v1/exports/stix")?.guarantees).toContain("graph_live_update");
    expect(surfaces.find((surface) => surface.path === "/v1/exports/stix")?.guarantees).toContain("graph_stix_rc_gate");
    expect(semantics.restrictedMetadataNonBlockingSearch).toMatchObject({
      routes: expect.arrayContaining(["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"]),
      scenarios: expect.arrayContaining(["approved_metadata_canary", "unsafe_target", "public_api_blocked_state", "actor_query", "victim_query", "cve_query"]),
      packetFields: expect.arrayContaining(["publicSearchAction", "restrictedContext", "proof", "noLeakSerialization"])
    });
    expect(semantics.restrictedMetadataNonBlockingSearch.guarantee).toContain("never blocks clear-web or public-channel search");
    expect(semantics.restrictedMetadataAnalystOperations).toMatchObject({
      routes: expect.arrayContaining(["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/evidence/claim-ledger", "/v1/contracts"]),
      scenarios: expect.arrayContaining(["approval_requested", "victim_notification_packet", "emergency_stop_rollback", "cve_exploit_leak_claim", "made_up_actor_query"]),
      packetFields: expect.arrayContaining(["schedulerIsolation", "victimNotificationPacket", "claimLedger", "whatWasNotAccessed", "noLeakSerialization"])
    });
    expect(semantics.restrictedMetadataAnalystOperations.guarantee).toContain("victim-safe");
    expect(semantics.restrictedMetadataIsolationHarness).toMatchObject({
      routes: expect.arrayContaining(["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"]),
      scenarios: expect.arrayContaining(["proxy_boundary_proof", "kill_switch_propagation", "timeout_attribution", "raw_payload_denied", "credential_storage_denied", "private_access_denied", "threat_actor_interaction_denied"]),
      packetFields: expect.arrayContaining(["nonNetworked", "connectorBoundary", "workerIsolation", "deniedOperation", "complianceEvidence", "proof", "noLeakSerialization"])
    });
    expect(semantics.restrictedMetadataIsolationHarness.guarantee).toContain("non-networked");
    expect(surfaces.find((surface) => surface.path === "/v1/frontier/*")?.guarantees).toContain("worker_soak_migration");
    expect(surfaces.find((surface) => surface.path === "/v1/frontier/*")?.guarantees).toContain("worker_lease_soak_harness");
    expect(surfaces.find((surface) => surface.path === "/v1/frontier/*")?.guarantees).toContain("scheduler_adapter_telemetry");
    expect(surfaces.find((surface) => surface.path === "/v1/frontier/*")?.guarantees).toContain("scheduler_freshness_slo_dashboard");
    expect(surfaces.find((surface) => surface.path === "/v1/frontier/*")?.guarantees).toContain("scheduler_interactive_search_freshness");
    const schedulerFreshnessSloDashboard = (semantics as typeof semantics & {
      schedulerFreshnessSloDashboard: {
        field: string;
        schemaVersion: string;
        actors: string[];
        fields: string[];
        guarantee: string;
      };
    }).schedulerFreshnessSloDashboard;
    expect(schedulerFreshnessSloDashboard).toMatchObject({
      field: "scheduler.freshnessSloDashboard",
      schemaVersion: "ti.scheduler_freshness_slo_dashboard.v1",
      actors: expect.arrayContaining(["APT29", "APT42", "Sandworm", "Volt Typhoon", "Lazarus", "LockBit", "Akira", "Scattered Spider"]),
      fields: expect.arrayContaining(["summary", "actors", "workloadActions", "runbook", "releaseGate"])
    });
    expect(schedulerFreshnessSloDashboard.guarantee).toContain("daily/weekly high-priority actor freshness");
    const schedulerInteractiveSearchFreshness = (semantics as typeof semantics & {
      schedulerInteractiveSearchFreshness: {
        field: string;
        schemaVersion: string;
        decisions: string[];
        guarantee: string;
      };
    }).schedulerInteractiveSearchFreshness;
    expect(schedulerInteractiveSearchFreshness).toMatchObject({
      field: "scheduler.interactiveSearchFreshness",
      schemaVersion: "ti.scheduler_interactive_search_freshness.v1"
    });
    expect(schedulerInteractiveSearchFreshness.decisions).toEqual(expect.arrayContaining(["reuse_active_run", "raise_priority", "metadata_review_hold"]));
    expect(schedulerInteractiveSearchFreshness.guarantee).toContain("UI-visible");
    const schedulerWorkerLeaseSoakHarness = (semantics as typeof semantics & {
      schedulerWorkerLeaseSoakHarness: {
        field: string;
        fixture: string;
        totalTasks: number;
        scenarios: string[];
        fields: string[];
        guarantee: string;
      };
    }).schedulerWorkerLeaseSoakHarness;
    expect(schedulerWorkerLeaseSoakHarness).toMatchObject({
      field: "scheduler.workerLeaseSoakHarness",
      fixture: "agent02_10k_multi_worker_lease_replay",
      totalTasks: 10000,
      scenarios: expect.arrayContaining(["apt29_actor_burst", "source_outage_wave", "parser_failure_storm", "low_value_sweep_pressure"]),
      fields: expect.arrayContaining(["replay", "workloadSlices", "workerPartitions", "fairnessProof", "pressureFixtures"])
    });
    expect(schedulerWorkerLeaseSoakHarness.guarantee).toContain("10k-task scheduler lease soak harness");
    expect(surfaces.every((surface) => surface.guarantees.length > 0)).toBe(true);
    expect(semantics.noLeakGuarantees).toEqual(expect.arrayContaining(["no raw Telegram message bodies", "no object storage keys"]));
    expect(contract.examples).toMatchObject({
      scraperUnavailable: { response: { warningCodes: expect.arrayContaining(["scraper_unavailable"]) } },
      queuePressure: { response: { warningCodes: expect.arrayContaining(["queue_pressure", "duplicate_run_reuse"]) } },
      noApprovedSources: { response: { status: "blocked", warningCodes: expect.arrayContaining(["no_approved_sources"]) } },
      policyBlocked: { response: { status: "blocked", warningCodes: expect.arrayContaining(["policy_blocked"]) } }
    });
    expect(validation.publicProofs).toEqual(expect.arrayContaining([
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY=APT42 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ]));
    expect(validation.contractIndexProof).toContain("GET /v1/contracts");
    const serialized = JSON.stringify(contract).toLowerCase();
    for (const forbidden of ["cookie=", "authorization:", "set-cookie", "password=", "object_key_value", "raw proof payload"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test("creates idempotent intelligence runs and exposes status", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const options = { store, frontier: new FocusedFrontier() };
    const request = {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "retry-1" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    };

    const first = await body(await handleApiRequest(api("/v1/intel/runs", request), options));
    const second = await body(await handleApiRequest(api("/v1/intel/runs", request), options));
    const firstRun = first.run as { id: string; status: string; taskCount: number };
    const secondRun = second.run as { id: string };

    expect(firstRun.status).toBe("queued");
    expect(firstRun.taskCount).toBe(1);
    expect(secondRun.id).toBe(firstRun.id);

    const status = await body(await handleApiRequest(api(`/v1/intel/runs/${firstRun.id}`), options));
    expect((status.run as { id: string }).id).toBe(firstRun.id);
  });

  test("supports compact source admin and metrics", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier() };
    const created = await body(await handleApiRequest(api("/v1/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Vendor API",
        type: "api",
        url: "https://api.example.test/intel?q={query}",
        accessMethod: "official_api",
        status: "candidate",
        risk: "medium",
        legalNotes: "Approved vendor API fixture."
      })
    }), options));

    const id = (created.source as { id: string }).id;
    const updated = await body(await handleApiRequest(api(`/v1/sources/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "active", trustScore: 1.5 })
    }), options));
    expect((updated.source as { status: string; trustScore: number }).status).toBe("active");
    expect((updated.source as { status: string; trustScore: number }).trustScore).toBe(1);

    const metrics = await body(await handleApiRequest(api("/v1/metrics"), options));
    expect(metrics.service).toBe("ti-scraper");
    expect((metrics.sources as { active: number }).active).toBe(1);
  });

  test("rejects idempotency key reuse with a different request body", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const options = { store, frontier: new FocusedFrontier() };
    const headers = { "content-type": "application/json", "idempotency-key": "retry-conflict" };

    await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    }), options);
    const conflict = await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "APT28", entityType: "actor", tenantId: "tenant_a" })
    }), options);
    const payload = await body(conflict);

    expect(conflict.status).toBe(409);
    expect(payload.error).toMatchObject({ code: "idempotency_conflict" });
  });

  test("returns redacted run results with include filters and STIX export", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const options = { store, frontier: new FocusedFrontier() };
    const created = await body(await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    }), options));
    const run = created.run as { id: string; planId: string };
    const plan = store.getPlan(run.planId);
    const rawText = "APT29 used phishing against a healthcare victim from https://evil.example.com and CVE-2025-12345.";
    const result = processCollectedItem({
      sourceId: "src_rss",
      taskId: plan?.tasks[0]?.id,
      url: "https://example.test/report",
      collectedAt: "2026-05-24T00:00:00.000Z",
      title: "APT29 report",
      rawText,
      contentHash: hashContent(rawText),
      links: [],
      metadata: { fixture: true },
      sensitive: false
    });
    store.savePipelineResult({
      ...result,
      capture: { ...result.capture, tenantId: "tenant_a" }
    });

    const capturesOnly = await body(await handleApiRequest(api(`/v1/intel/runs/${run.id}/results?include=captures`), options));
    const captures = (capturesOnly.results as { captures: { items: Array<{ body?: string; bodyRedacted: boolean }> } }).captures.items;
    expect(captures[0]?.body).toBeUndefined();
    expect(captures[0]?.bodyRedacted).toBe(true);
    expect((capturesOnly.results as Record<string, unknown>).incidents).toBeUndefined();

    const intelOnly = await body(await handleApiRequest(api(`/v1/intel/runs/${run.id}/results?include=indicators,entities,relationships`), options));
    expect(((intelOnly.results as { indicators: { items: unknown[] } }).indicators.items).length).toBeGreaterThan(0);
    expect(((intelOnly.results as { entities: { items: unknown[] } }).entities.items).length).toBeGreaterThan(0);
    expect(((intelOnly.results as { relationships: { items: unknown[] } }).relationships.items).length).toBeGreaterThan(0);

    const exportResponse = await body(await handleApiRequest(api("/v1/exports/stix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: run.id, generatedAt: "2026-05-24T00:05:00.000Z" })
    }), options));
    expect((exportResponse.bundle as { type: string; objects: unknown[] }).type).toBe("bundle");
    expect((exportResponse.bundle as { type: string; objects: unknown[] }).objects.length).toBeGreaterThan(0);
  });

  test("exports STIX-like CTI from run captures even before incidents are persisted", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const options = { store, frontier: new FocusedFrontier() };
    const created = await body(await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    }), options));
    const run = created.run as { id: string; planId: string };
    const plan = store.getPlan(run.planId);
    const rawText = "APT29 used phishing and Cobalt Strike against Northwind Health Systems with CVE-2025-12345 from 198.51.100.42.";
    store.saveCapture({
      id: "cap_capture_only_stix",
      tenantId: "tenant_a",
      sourceId: "src_rss",
      taskId: plan?.tasks[0]?.id,
      url: "https://example.test/capture-only",
      canonicalUrl: "https://example.test/capture-only",
      collectedAt: "2026-05-24T00:00:00.000Z",
      contentHash: hashContent(rawText),
      normalizedTextHash: hashContent(rawText.toLowerCase()),
      mediaType: "text/plain",
      storageKind: "inline_text",
      body: rawText,
      metadata: { title: "Capture-only APT29 report" },
      sensitive: false,
      sensitivityFlags: ["public"]
    });

    const exportResponse = await body(await handleApiRequest(api("/v1/exports/stix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: run.id, generatedAt: "2026-05-24T00:05:00.000Z" })
    }), options));
    const objects = (exportResponse.bundle as { objects: Array<{ type: string; name?: string; x_ti_provenance?: Array<{ captureId: string }> }> }).objects;

    expect(objects.some((object) => object.type === "indicator" && object.name === "ipv4:198.51.100.42")).toBe(true);
    expect(objects.some((object) => object.type === "intrusion-set" && object.name === "APT29")).toBe(true);
    expect(objects.some((object) => object.type === "report")).toBe(true);
    expect(objects.every((object) =>
      object.x_ti_provenance ? object.x_ti_provenance.every((item) => item.captureId === "cap_capture_only_stix") : true
    )).toBe(true);
  });

  test("returns non-mutating evidence replay-plan and cutover-report DTOs without sensitive bodies or object keys", async () => {
    const store = new InMemoryScraperStore();
    const objectStore = new InMemoryObjectEvidenceStore();
    seedEvidenceReplayFixture(store);
    const before = {
      captures: store.listCaptures().length,
      discovery: store.listDiscoveryEvidence().length,
      deltas: store.listEvidenceDeltas().length,
      snapshots: store.listLiveSearchSnapshots().length
    };
    const options = { store, frontier: new FocusedFrontier(), objectStore };

    const replayResponse = await body(await handleApiRequest(api("/v1/evidence/replay-plan?q=APT29&runId=run_api"), options));
    const cutoverResponse = await body(await handleApiRequest(api("/v1/evidence/cutover-report?q=APT29&runId=run_api&generatedAt=2026-05-24T21:00:00.000Z"), options));
    const after = {
      captures: store.listCaptures().length,
      discovery: store.listDiscoveryEvidence().length,
      deltas: store.listEvidenceDeltas().length,
      snapshots: store.listLiveSearchSnapshots().length
    };

    expect(after).toEqual(before);
    expect(replayResponse.contract).toMatchObject({
      endpoint: "/v1/evidence/replay-plan",
      method: "GET",
      examples: {
        pass: { readiness: "ready", replayable: true },
        restrictedMetadataRedaction: { sensitiveBodiesExposed: false }
      }
    });
    expect(replayResponse.replayPlan).toMatchObject({
      endpoint: "/v1/evidence/replay-plan",
      replayable: true,
      redaction: {
        sensitiveBodiesExposed: false,
        objectKeysExposed: false
      }
    });
    expect((replayResponse.replayPlan as { stages: Array<{ stage: string }> }).stages.map((stage) => stage.stage)).toEqual([
      "discovery",
      "capture",
      "extraction",
      "relationship_delta",
      "api_cursor"
    ]);
    expect(cutoverResponse.contract).toMatchObject({
      endpoint: "/v1/evidence/cutover-report",
      examples: {
        staleSnapshotHold: { readiness: "hold", blocker: "stale_snapshot_rebuild" },
        missingObjectHold: { readiness: "blocked", blocker: "missing_objects" },
        graphExportBlocker: { readiness: "hold", blocker: "export_blockers" }
      }
    });
    const cutoverReport = cutoverResponse.cutoverReport as {
      chainOfCustody: unknown;
      indexReplayMigration: unknown;
      objectIntegrityRepair: unknown;
      replayBenchmark: unknown;
      searchBackendMigration: unknown;
      retentionRuntime: unknown;
      searchConsistencySlo: unknown;
      readModelCutover: unknown;
    };
    expect(cutoverReport).toMatchObject({
      endpoint: "/v1/evidence/cutover-report",
      readiness: { overall: "ready" },
      redaction: {
        sensitiveBodiesExposed: false,
        objectKeysExposed: false
      },
      promotionGate: {
        agent09Fields: { cursorReplayReady: true },
        agent10Fields: { objectIntegrityReady: true }
      }
    });
    expect(cutoverReport.chainOfCustody).toMatchObject({
      schemaVersion: "ti.evidence_chain_of_custody.v1",
      verification: {
        checks: {
          rawCapture: true,
          extraction: true,
          graphRelationship: true,
          replayable: true
        }
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        secretMaterialExposed: false,
        restrictedMaterialExposed: false
      }
    });
    expect(cutoverReport.indexReplayMigration).toMatchObject({
      schemaVersion: "ti.evidence_index_replay_migration.v1",
      targetBackends: {
        openSearchIndex: "ti-evidence-v1",
        vectorNamespace: "ti-evidence",
        aliasCutover: "blue_green_alias_swap"
      },
      validation: {
        checks: {
          cursorReplayComplete: true,
          redactionSafe: true,
          rollbackReady: true
        }
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedMaterialExposed: false
      }
    });
    expect(cutoverReport.objectIntegrityRepair).toMatchObject({
      schemaVersion: "ti.evidence_object_integrity_repair.v1",
      summary: {
        rollbackReady: true
      },
      validation: {
        checks: {
          noObjectKeysExposed: true,
          noRawBodiesExposed: true,
          replayAfterRepairReady: true
        }
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false
      }
    });
    expect(cutoverReport.searchBackendMigration).toMatchObject({
      schemaVersion: "ti.evidence_search_backend_migration_readiness.v1",
      summary: {
        rollbackReady: true
      },
      backends: {
        openSearch: {
          candidateIndex: "ti-evidence-v1-candidate",
          readAlias: "ti-evidence-read",
          writeAlias: "ti-evidence-write-candidate"
        },
        pgvector: {
          namespace: "ti-evidence",
          candidateTable: "evidence_vector_candidate",
          inputHashOnly: true
        },
        postgres: {
          cursorSource: "evidence_delta_cursor"
        }
      },
      policy: {
        restrictedMetadataEmbedded: false,
        deletionReplayMode: "tombstone_then_delete_object",
        metadataOnlyRestrictedMode: "index_safe_metadata_only"
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false
      }
    });
    expect(cutoverReport.replayBenchmark).toMatchObject({
      schemaVersion: "ti.evidence_replay_benchmark.v1",
      summary: {
        simulatedCaptureMetadataRecords: 1_000_000,
        chunks: 100,
        chunkSize: 10_000,
        replayable: true,
        publicAnswerRebuild: "partial"
      },
      scaleModel: {
        metadataOnlyRowsIndexed: true,
        restrictedRowsEmbedded: false,
        replayCursorCheckpointEveryRows: 10_000
      },
      rebuildBehavior: {
        searchIndexAlias: "blue_green_alias_swap",
        publicAnswer: {
          sourceEvidenceRequired: true,
          restrictedMetadataCanSupportDefensiveFacts: true
        },
        graph: {
          relationshipDeltaReplay: true,
          reviewHoldsRespected: true
        },
        stix: {
          descriptorOnlyRestrictedMetadata: true,
          reviewedExportRequired: true
        }
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false,
        actorInteractionExposed: false
      }
    });
    expect(cutoverReport.retentionRuntime).toMatchObject({
      schemaVersion: "ti.evidence_retention_runtime_enforcement.v1",
      validation: {
        checks: {
          objectManifestVerified: true,
          legalHoldPreserved: true,
          replayReady: true,
          retentionTransitionsAudited: true
        }
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false
      }
    });
    expect(cutoverReport.searchConsistencySlo).toMatchObject({
      schemaVersion: "ti.evidence_search_consistency_slo.v1",
      latencyBudget: {
        initialPartialP95Ms: 3000,
        cursorReplayP95Ms: 3000,
        indexRefreshP95Ms: 30000,
        vectorUpsertP95Ms: 30000
      },
      consistency: {
        checks: {
          documentsPresent: true,
          replayIdsPresent: true,
          citationSpansPresent: true,
          restrictedMetadataSearchableNotEmbedded: true,
          vectorInputsHashOnly: true,
          apiAnswerRefreshSafe: true
        }
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false
      }
    });
    expect(cutoverReport.readModelCutover).toMatchObject({
      schemaVersion: "ti.evidence_search_read_model_cutover.v1",
      status: "hold_for_explicit_backend_enablement",
      canCutoverToProductionBackend: false,
      embeddedReplayReady: true,
      productionBackendsFailClosed: true,
      writeSet: {
        schemaVersion: "ti.evidence_search_read_model_backend_write_set.v1",
        unsafeDocumentsSkipped: 0
      },
      readiness: {
        embedded: {
          backend: "embedded_memory",
          canWrite: true,
          canSearch: true
        },
        postgres: {
          backend: "postgres_read_model",
          enabled: false,
          failClosedWithoutExplicitEnable: true
        },
        openSearchPgvector: {
          backend: "opensearch_pgvector",
          enabled: false,
          failClosedWithoutExplicitEnable: true
        }
      },
      vectorPolicy: {
        restrictedMetadataSearchable: true,
        restrictedMetadataEmbedded: false,
        restrictedMetadataVectorRows: 0,
        vectorRowsHashOnly: true
      },
      promotionReplay: {
        schemaVersion: "ti.evidence_search_read_model_promotion_replay.v1",
        handoffId: expect.any(String),
        query: "APT29",
        normalizedQuery: "apt29",
        publicAnswer: {
          evidenceItemCount: expect.any(Number),
          supportDocumentIds: expect.any(Array),
          blockers: expect.any(Array),
          warnings: expect.any(Array)
        },
        graphPromotion: {
          relationshipIds: expect.any(Array),
          blockers: expect.any(Array)
        },
        retention: {
          tombstoneRowsRequired: expect.any(Number),
          staleExtractorReplayRequired: expect.any(Boolean)
        },
        safeOutput: {
          rawBodiesExposed: false,
          objectKeysExposed: false,
          unsafeUrlsExposed: false,
          credentialsExposed: false,
          restrictedRawContentExposed: false,
          actorInteractionExposed: false
        }
      },
      promotionTransaction: {
        schemaVersion: "ti.evidence_promotion_transaction_plan.v1",
        handoffId: expect.any(String),
        transactionId: expect.any(String),
        state: expect.any(String),
        dryRun: true,
        willMutate: false,
        sourceReplay: "durable_read_model_rows",
        consumers: {
          publicAnswer: {
            targetReadModel: "public_answer_read_model",
            supportDocumentIds: expect.any(Array)
          },
          graph: {
            targetReadModel: "graph_relationship_read_model",
            blockers: expect.any(Array)
          },
          stix: {
            targetReadModel: "stix_preview_read_model",
            blockers: expect.any(Array)
          },
          api: {
            targetReadModel: "api_intel_search_answer_cache",
            warnings: expect.any(Array)
          }
        },
        restrictedHandling: {
          metadataOnlyDocumentIds: expect.any(Array),
          graphRelationshipsHeld: expect.any(Array),
          vectorPromotionAllowed: false
        },
        replayGuarantees: {
          requiresReplayIds: true,
          requiresCitationSpans: true,
          requiresClaimLedgerRefs: true,
          requiresRetentionState: true,
          requiresReviewState: true,
          deterministicIdempotencyKeys: true
        },
        safeOutput: {
          rawBodiesExposed: false,
          objectKeysExposed: false,
          unsafeUrlsExposed: false,
          credentialsExposed: false,
          restrictedRawContentExposed: false,
          actorInteractionExposed: false
        }
      },
      promotionExecution: {
        schemaVersion: "ti.evidence_promotion_transaction_execution.v1",
        transactionId: expect.any(String),
        handoffId: expect.any(String),
        state: "blocked",
        enabled: false,
        willMutateProductionConsumers: false,
        sourcePlan: "ti.evidence_promotion_transaction_plan.v1",
        appliedSteps: [],
        heldSteps: expect.any(Array),
        failClosedReasons: expect.arrayContaining(["promotion_transaction_repository_disabled"]),
        committedConsumerRows: {
          publicAnswer: 0,
          graph: 0,
          stix: 0,
          api: 0
        },
        restrictedHandling: {
          metadataOnlyDocumentIds: expect.any(Array),
          graphRelationshipsHeld: expect.any(Array),
          vectorPromotionAllowed: false
        },
        replayGuarantees: {
          requiresReplayIds: true,
          requiresCitationSpans: true,
          requiresClaimLedgerRefs: true,
          requiresRetentionState: true,
          requiresReviewState: true,
          deterministicIdempotencyKeys: true
        },
        audit: {
          dryRunPlanAccepted: true,
          deterministicReceipts: true,
          liveBackendConnection: false,
          explicitEnablementRequired: true
        },
        safeOutput: {
          rawBodiesExposed: false,
          objectKeysExposed: false,
          unsafeUrlsExposed: false,
          credentialsExposed: false,
          restrictedRawContentExposed: false,
          actorInteractionExposed: false
        }
      },
      promotionAuditReplay: {
        schemaVersion: "ti.evidence_promotion_transaction_audit_replay.v1",
        transactionId: expect.any(String),
        handoffId: expect.any(String),
        state: "blocked",
        repository: {
          backend: "postgres_transaction_audit",
          enabled: false,
          disabledByDefault: true,
          liveBackendConnection: false,
          requiredTables: expect.arrayContaining([
            "evidence_promotion_execution_receipts",
            "evidence_promotion_execution_steps",
            "evidence_promotion_execution_held_steps",
            "evidence_promotion_execution_rollbacks"
          ])
        },
        rowCounts: {
          executionReceipts: 1,
          appliedSteps: 0,
          heldSteps: expect.any(Number),
          rollbackRefs: 0
        },
        replayReady: true,
        deterministicReceiptIds: true,
        canReplayWithoutRawEvidence: true,
        committedConsumerRows: {
          publicAnswer: 0,
          graph: 0,
          stix: 0,
          api: 0
        },
        failClosedReasons: expect.arrayContaining(["promotion_transaction_repository_disabled"]),
        restrictedHandling: {
          metadataOnlyDocumentIds: expect.any(Array),
          graphRelationshipsHeld: expect.any(Array),
          vectorPromotionAllowed: false
        },
        safeOutput: {
          rawBodiesExposed: false,
          objectKeysExposed: false,
          unsafeUrlsExposed: false,
          credentialsExposed: false,
          restrictedRawContentExposed: false,
          actorInteractionExposed: false
        }
      },
      actorProductImpactReplay: {
        schemaVersion: "ti.evidence_actor_product_impact_replay.v1",
        productSurface: "apify_public_threat_actor_monitor",
        actorBuild: "0.6.4",
        latestProofRunId: "iMQGeezZ8bx7WtlhQ",
        state: expect.any(String),
        usefulActorRows: {
          freshRowsImprovingActorResult: expect.any(Array),
          restrictedMetadataRows: expect.any(Array),
          staleRowsSuppressed: expect.any(Array),
          missingSourceFamilies: expect.any(Array)
        },
        answerImpact: {
          canImprovePaidActorResult: expect.any(Boolean),
          freshnessWindowDays: 30,
          staleSuppressionRequired: expect.any(Boolean),
          darkMetadataSearchable: expect.any(Boolean),
          darkMetadataCaveated: expect.any(Boolean),
          replayableFromDurableRows: true
        },
        replayProof: {
          handoffId: expect.any(String),
          promotionTransactionId: expect.any(String),
          auditReplaySchemaVersion: "ti.evidence_promotion_transaction_audit_replay.v1",
          proofRunId: "iMQGeezZ8bx7WtlhQ",
          proofDatasetId: "5PLmkE30luBA5Lbgc",
          commands: expect.arrayContaining(["bun run measure:search-product"])
        },
        noLeakGuarantees: {
          restrictedRowsMetadataOnly: true,
          rawBodiesExposed: false,
          objectKeysExposed: false,
          unsafeUrlsExposed: false,
          credentialsExposed: false,
          restrictedRawContentExposed: false,
          actorInteractionExposed: false,
          vectorEmbeddingsForRestrictedRows: false
        },
        safeOutput: {
          rawBodiesExposed: false,
          objectKeysExposed: false,
          unsafeUrlsExposed: false,
          credentialsExposed: false,
          restrictedRawContentExposed: false,
          actorInteractionExposed: false
        }
      },
      actorDatasetPromotionPreview: {
        schemaVersion: "ti.evidence_actor_dataset_promotion_preview.v1",
        productSurface: "apify_public_threat_actor_monitor",
        actorBuild: "0.6.4",
        sourceImpactReplay: "ti.evidence_actor_product_impact_replay.v1",
        dryRun: true,
        willMutateActorDataset: false,
        latestProof: {
          runId: "iMQGeezZ8bx7WtlhQ",
          datasetId: "5PLmkE30luBA5Lbgc"
        },
        counts: {
          billableResultCandidates: expect.any(Number),
          caveatedContextRows: expect.any(Number),
          staleRowsSuppressed: expect.any(Number),
          coverageGapRows: expect.any(Number)
        },
        rows: expect.arrayContaining([
          expect.objectContaining({
            rowType: expect.any(String),
            paidRowDecision: expect.any(String),
            billingGuidance: expect.any(String),
            noLeak: true
          })
        ]),
        publicAnswerConsumer: {
          targetReadModel: "api_intel_search_answer_cache",
          inputDocumentIds: expect.any(Array),
          readyDocumentIds: expect.any(Array),
          heldDocumentIds: expect.any(Array),
          staleSuppressedDocumentIds: expect.any(Array)
        },
        noLeakGuarantees: {
          restrictedRowsMetadataOnly: true,
          rawBodiesExposed: false,
          objectKeysExposed: false,
          unsafeUrlsExposed: false,
          credentialsExposed: false,
          restrictedRawContentExposed: false,
          actorInteractionExposed: false,
          vectorEmbeddingsForRestrictedRows: false
        },
        safeOutput: {
          rawBodiesExposed: false,
          objectKeysExposed: false,
          unsafeUrlsExposed: false,
          credentialsExposed: false,
          restrictedRawContentExposed: false,
          actorInteractionExposed: false
        }
      },
      actorDatasetConsumerHandoff: {
        schemaVersion: "ti.evidence_actor_dataset_consumer_handoff.v1",
        sourcePreview: "ti.evidence_actor_dataset_promotion_preview.v1",
        productSurface: "apify_public_threat_actor_monitor",
        actorBuild: "0.6.4",
        dryRun: true,
        willWriteActorDataset: false,
        willWritePublicAnswerCache: false,
        latestProof: {
          runId: "iMQGeezZ8bx7WtlhQ",
          datasetId: "5PLmkE30luBA5Lbgc"
        },
        counts: {
          actorDatasetRows: expect.any(Number),
          sellableCandidates: expect.any(Number),
          caveatedContextRows: expect.any(Number),
          suppressedRows: expect.any(Number),
          coverageGapRows: expect.any(Number),
          publicAnswerCacheWrites: expect.any(Number)
        },
        actorDatasetRows: expect.arrayContaining([
          expect.objectContaining({
            actorDatasetAction: expect.any(String),
            paidRowDecision: expect.any(String),
            billingGuidance: expect.any(String),
            safety: expect.objectContaining({
              rawContentIncluded: false,
              restrictedMaterialIncluded: false,
              unsafeUrlIncluded: false,
              credentialIncluded: false,
              actorInteractionRequired: false
            })
          })
        ]),
        publicAnswerCacheWrites: expect.arrayContaining([
          expect.objectContaining({
            action: expect.any(String),
            visibleState: expect.any(String),
            noLeak: true
          })
        ]),
        noLeakGuarantees: {
          restrictedRowsMetadataOnly: true,
          rawBodiesExposed: false,
          objectKeysExposed: false,
          unsafeUrlsExposed: false,
          credentialsExposed: false,
          restrictedRawContentExposed: false,
          actorInteractionExposed: false,
          vectorEmbeddingsForRestrictedRows: false
        },
        safeOutput: {
          rawBodiesExposed: false,
          objectKeysExposed: false,
          unsafeUrlsExposed: false,
          credentialsExposed: false,
          restrictedRawContentExposed: false,
          actorInteractionExposed: false
        }
      },
      actorDatasetConsumerExecution: {
        schemaVersion: "ti.evidence_actor_dataset_consumer_execution.v1",
        sourceHandoff: "ti.evidence_actor_dataset_consumer_handoff.v1",
        productSurface: "apify_public_threat_actor_monitor",
        actorBuild: "0.6.4",
        status: "blocked_repository_disabled",
        enabled: false,
        dryRun: true,
        liveBackendConnection: false,
        willWriteActorDataset: false,
        willWritePublicAnswerCache: false,
        repositoryBoundary: {
          actorDatasetRepository: "disabled_actor_dataset_repository",
          publicAnswerCacheRepository: "disabled_public_answer_cache_repository",
          requiredFeatureFlags: ["TI_ACTOR_DATASET_CONSUMER_WRITES_ENABLED", "TI_PUBLIC_ANSWER_CACHE_WRITES_ENABLED"],
          failClosedWithoutExplicitEnable: true
        },
        counts: {
          actorDatasetRowsHeld: expect.any(Number),
          publicAnswerCacheWritesHeld: expect.any(Number),
          sellableRowsHeld: expect.any(Number),
          caveatedContextRowsHeld: expect.any(Number),
          suppressedRowsHeld: expect.any(Number),
          coverageGapRowsHeld: expect.any(Number),
          actorDatasetRowsWritten: 0,
          publicAnswerCacheWritesWritten: 0
        },
        actorDatasetReceipts: expect.arrayContaining([
          expect.objectContaining({
            state: "held",
            noLeak: true
          })
        ]),
        publicAnswerCacheReceipts: expect.arrayContaining([
          expect.objectContaining({
            state: "held",
            reason: "public_answer_cache_repository_disabled",
            noLeak: true
          })
        ]),
        blockedReasons: ["actor_dataset_repository_disabled", "public_answer_cache_repository_disabled"],
        rollbackRefs: [],
        safeOutput: {
          rawBodiesExposed: false,
          objectKeysExposed: false,
          unsafeUrlsExposed: false,
          credentialsExposed: false,
          restrictedRawContentExposed: false,
          actorInteractionExposed: false
        }
      },
      actorDatasetConsumerAuditReplay: {
        schemaVersion: "ti.evidence_actor_dataset_consumer_audit_replay.v1",
        executionId: expect.any(String),
        repository: {
          backend: "postgres_actor_dataset_consumer_audit",
          enabled: false,
          disabledByDefault: true,
          liveBackendConnection: false,
          requiredTables: [
            "evidence_actor_dataset_consumer_execution_receipts",
            "evidence_actor_dataset_consumer_dataset_receipts",
            "evidence_actor_dataset_consumer_cache_receipts"
          ]
        },
        rowCounts: {
          executionReceipts: 1,
          actorDatasetReceipts: expect.any(Number),
          publicAnswerCacheReceipts: expect.any(Number)
        },
        replayReady: true,
        replayBlockers: [],
        actorDatasetRowsWritten: 0,
        publicAnswerCacheWritesWritten: 0,
        actorDatasetRowsHeld: expect.any(Number),
        publicAnswerCacheWritesHeld: expect.any(Number),
        canReplayWithoutRawEvidence: true,
        safeOutput: {
          rawBodiesExposed: false,
          objectKeysExposed: false,
          unsafeUrlsExposed: false,
          credentialsExposed: false,
          restrictedRawContentExposed: false,
          actorInteractionExposed: false
        }
      },
      actorDatasetConsumerAuditRepository: {
        schemaVersion: "ti.evidence_actor_dataset_consumer_audit_repository.v1",
        backend: "postgres_actor_dataset_consumer_audit",
        enabled: false,
        disabledByDefault: true,
        liveBackendConnection: false,
        willPersistRows: false,
        failClosedWithoutExplicitEnable: true,
        requiredFeatureFlags: ["TI_ACTOR_DATASET_CONSUMER_AUDIT_REPOSITORY_ENABLED"],
        requiredTables: [
          "evidence_actor_dataset_consumer_execution_receipts",
          "evidence_actor_dataset_consumer_dataset_receipts",
          "evidence_actor_dataset_consumer_cache_receipts"
        ],
        acceptedRowCounts: {
          executionReceipts: 1,
          actorDatasetReceipts: expect.any(Number),
          publicAnswerCacheReceipts: expect.any(Number)
        },
        persistedRowCounts: {
          executionReceipts: 0,
          actorDatasetReceipts: 0,
          publicAnswerCacheReceipts: 0
        },
        heldRowCounts: {
          executionReceipts: 1,
          actorDatasetReceipts: expect.any(Number),
          publicAnswerCacheReceipts: expect.any(Number)
        },
        blockedReasons: [
          "actor_dataset_consumer_audit_repository_disabled",
          "postgres_actor_dataset_consumer_audit_not_configured"
        ],
        replayReady: true,
        canReplayWithoutRawEvidence: true,
        safeOutput: {
          rawBodiesExposed: false,
          objectKeysExposed: false,
          unsafeUrlsExposed: false,
          credentialsExposed: false,
          restrictedRawContentExposed: false,
          actorInteractionExposed: false
        }
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false,
        actorInteractionExposed: false
      }
    });
    const serialized = JSON.stringify(cutoverResponse);
    expect(serialized).not.toContain("hidden sensitive body");
    expect(serialized).not.toContain("tenant/source/private-key");
    expect(serialized).not.toContain("\"body\"");
    expect(serialized).not.toContain("\"key\"");
  });

  test("returns consistent 400 and 404 error bodies", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier() };

    const badExport = await handleApiRequest(api("/v1/exports/stix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    }), options);
    expect(badExport.status).toBe(400);
    expect(await body(badExport)).toMatchObject({ error: { code: "bad_request" } });

    const missingRun = await handleApiRequest(api("/v1/intel/runs/run_missing"), options);
    expect(missingRun.status).toBe(404);
    expect(await body(missingRun)).toMatchObject({ error: { code: "not_found" } });
  });

  test("exposes frontier queue groups and run status frontier context", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const frontier = new FocusedFrontier();
    frontier.add({
      source: source(),
      tenantId: "tenant_a",
      intelRequestId: "request_a",
      url: "https://example.test/apt29",
      discoveredAt: "2026-01-01T00:00:00.000Z",
      anchorText: "APT29 ransomware campaign exploit",
      parentRelevance: 0.9,
      novelty: 0.8,
      freshness: 0.8
    });
    const options = { store, frontier };

    const frontierResponse = await body(await handleApiRequest(api("/v1/frontier"), options));
    expect((frontierResponse.queue as unknown[])).toHaveLength(1);
    expect((frontierResponse.summary as { groups: { tenants: Record<string, number> } }).groups.tenants.tenant_a).toBe(1);
    expect((frontierResponse.scheduler as {
      cutover: { targetBackend: string };
      diagnostics: { diagnostics: Array<{ workClass: string; pressureState: string; queueAgeSeconds: number }> };
    }).cutover.targetBackend).toBe("postgres_queue");
    expect((frontierResponse.scheduler as {
      diagnostics: { diagnostics: Array<{ workClass: string; pressureState: string; queueAgeSeconds: number }> };
    }).diagnostics.diagnostics[0]).toMatchObject({
      workClass: "background_refresh",
      pressureState: "accepted"
    });

    const runResponse = await body(await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    }), options));
    const runId = (runResponse.run as { id: string }).id;
    const status = await body(await handleApiRequest(api(`/v1/intel/runs/${runId}`), options));

    expect(status.frontier).toBeDefined();
    expect((status.frontier as { summary: { queued: number } }).summary.queued).toBeGreaterThan(0);
  });

  test("exposes safe ops resource snapshot with queue and worker state", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.saveSource(source());
    const supervisor = new WorkerSupervisor(createLogger("error"), new MetricsRegistry());
    supervisor.register("telegram-1", "telegram");
    supervisor.markRunning("telegram-1");

    await handleApiRequest(api("/v1/intel/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor" })
    }), { store, frontier, config: loadRuntimeConfig({}), supervisor });

    const snapshot = await body(await handleApiRequest(api("/v1/ops/resource-snapshot"), {
      store,
      frontier,
      config: loadRuntimeConfig({}),
      supervisor
    }));

    expect(snapshot.service).toBe("ti-scraper");
    expect((snapshot.queue as { queued: number }).queued).toBeGreaterThanOrEqual(0);
    expect((snapshot.resources as { disk: { reservedGb: number } }).disk.reservedGb).toBe(500);
    expect((snapshot.capacity as { ceilingMb: number }).ceilingMb).toBe(160 * 1024);
    expect((snapshot.workerPools as { telegram: number }).telegram).toBeGreaterThan(0);
    expect((snapshot.workers as Array<{ id: string; state: string }>)[0]).toMatchObject({ id: "telegram-1", state: "running" });
  });

  test("reports partial public-channel evidence for live intel search", async () => {
    const store = new InMemoryScraperStore();
    const telegram = source({
      id: "src_telegram",
      name: "Cybercrime public channel",
      type: "telegram_public",
      url: "https://t.me/cybercrimeintel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Reviewed public Telegram channel fixture.",
      approvedAt: new Date(0).toISOString(),
      approvedBy: "reviewer",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: false,
        approvedAt: new Date(0).toISOString(),
        approvedBy: "reviewer"
      },
      metadata: { actors: ["UNC3944"], topicTags: ["cybercrime"] }
    });
    store.saveSource(telegram);
    const bodyText = "Scattered Spider posted infrastructure at https://evil.example";
    const capture: RawCapture = {
      id: "cap_telegram",
      sourceId: "src_telegram",
      url: "https://t.me/cybercrimeintel/10",
      collectedAt: "2026-05-24T00:00:00.000Z",
      publishedAt: "2026-05-23T23:59:00.000Z",
      contentHash: hashContent(bodyText),
      mediaType: "text/plain",
      storageKind: "inline_text",
      body: bodyText,
      metadata: {
        adapter: "telegram_public",
        channel: "cybercrimeintel",
        messageId: 10,
        messageState: "available",
        urlMentions: ["https://evil.example"],
        forward: { fromChannel: "public_origin", fromMessageId: 4 },
        provenance: { confidence: 0.95 }
      },
      sensitive: false
    };
    store.saveCapture(capture);

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Scattered%20Spider&entityType=actor"), {
      store,
      frontier: new FocusedFrontier()
    }));

    const publicChannel = response.publicChannel as {
      queuedTasks: number;
      sla: { metrics: { ledgerBackedClaimYield: { ledgerBackedClaimCount: number; candidateClaimCount: number } } };
      cutoverReport: { evidenceFreshness: { latestMessageId: number; safePartialEvidenceCount: number } };
      canaryRollout: { mode: string; summary: { selectedSourceCount: number; replayableEvidenceCount: number }; selectedSources: Array<{ sourceId: string; agent06EvidenceHandoff: { metadataOnly: boolean } }> };
      promotionCanary: { mode: string; summary: { evidenceCount: number; noLeakSerialization: boolean }; handoffs: { agent06EvidenceCutover: { evidenceCutoverReady: boolean } } };
      promotionCertification: { mode: string; summary: { noLeakSerialization: boolean } };
      evidence: Array<{ sourceId: string; channel: string; messageUrl: string; extractedUrls: string[]; confidence: number }>;
      abuseControls: Array<{ sourceId: string; allowed: boolean }>;
    };
    expect(publicChannel.queuedTasks).toBe(1);
    expect(publicChannel.sla.metrics.ledgerBackedClaimYield).toMatchObject({ ledgerBackedClaimCount: 1, candidateClaimCount: 1 });
    expect(publicChannel.cutoverReport.evidenceFreshness).toMatchObject({ latestMessageId: 10, safePartialEvidenceCount: 1 });
    expect(publicChannel.canaryRollout.mode).toBe("dry_run");
    expect(publicChannel.canaryRollout.summary).toMatchObject({ selectedSourceCount: 1, replayableEvidenceCount: 1 });
    expect(publicChannel.canaryRollout.selectedSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: "src_telegram", agent06EvidenceHandoff: expect.objectContaining({ metadataOnly: true }) })
    ]));
    expect(publicChannel.promotionCanary.mode).toBe("dry_run");
    expect(publicChannel.promotionCanary.summary).toMatchObject({ evidenceCount: 1, noLeakSerialization: true });
    expect(publicChannel.promotionCanary.handoffs.agent06EvidenceCutover.evidenceCutoverReady).toBe(true);
    expect(publicChannel.promotionCertification).toMatchObject({ mode: "dry_run", summary: { noLeakSerialization: true } });
    expect(publicChannel.abuseControls).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: "src_telegram", allowed: true })]));
    expect(publicChannel.evidence).toEqual(expect.arrayContaining([expect.objectContaining({
      sourceId: "src_telegram",
      channel: "cybercrimeintel",
      messageUrl: "https://t.me/cybercrimeintel/10",
      extractedUrls: ["https://evil.example"],
      confidence: 0.95
    })]));
    expect(response.planner).toMatchObject({
      mode: "interactive_live_search",
      zeroTaskReason: "none"
    });
    expect((response.planner as { queuedTaskCount: number }).queuedTaskCount).toBeGreaterThan(0);
    expect(response.publicTiAnswer).toMatchObject({
      publicChannelCertification: {
        status: expect.any(String),
        summary: expect.objectContaining({
          noLeakSerialization: true
        }),
        answerStateMachine: expect.objectContaining({ state: expect.any(String) }),
        graphCertification: expect.objectContaining({ status: expect.any(String) }),
        rcGate: expect.objectContaining({ decision: expect.any(String) })
      }
    });
  });

  test("returns public-channel status DTO with promotion, polling, and safe-output guarantees", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_telegram",
      name: "APT29 public channel",
      type: "telegram_public",
      url: "https://t.me/securityalerts",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      language: "en",
      legalNotes: "Approved public Telegram channel fixture.",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: false,
        approvedAt: new Date(0).toISOString(),
        approvedBy: "reviewer"
      },
      metadata: {
        actors: ["APT29"],
        topicTags: ["espionage"],
        lastDiscoveredUrls: ["https://t.me/securityalerts/19"]
      }
    }));
    store.saveSource(source({
      id: "src_github_advisory",
      name: "GitHub advisory APT29 CVE feed",
      type: "api",
      url: "https://api.github.com/advisories/GHSA-apt29",
      accessMethod: "official_api",
      status: "active",
      trustScore: 0.88,
      tags: ["github", "advisory", "APT29", "CVE-2026-9999"],
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: new Date(0).toISOString(),
        approvedBy: "reviewer"
      },
      metadata: { cves: ["CVE-2026-9999"], actors: ["APT29"] }
    }));
    store.saveSource(source({
      id: "src_cisa_kev",
      name: "CISA KEV government advisory",
      type: "api",
      url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      accessMethod: "official_api",
      status: "active",
      trustScore: 0.92,
      tags: ["CISA", "government", "APT29", "energy"],
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: new Date(0).toISOString(),
        approvedBy: "reviewer"
      },
      metadata: { sectors: ["energy"], regions: ["North America"] }
    }));
    const bodyText = "APT29 Cozy Bear public-channel note for CVE-2026-9999 and victim: Fjord Energy AS";
    store.saveCapture({
      id: "cap_telegram_status",
      sourceId: "src_telegram",
      url: "https://t.me/securityalerts/20",
      collectedAt: "2026-05-24T00:00:00.000Z",
      publishedAt: "2026-05-23T23:59:00.000Z",
      contentHash: hashContent(bodyText),
      mediaType: "text/plain",
      storageKind: "inline_text",
      body: bodyText,
      metadata: {
        adapter: "telegram_public",
        channel: "securityalerts",
        messageId: 20,
        messageState: "available",
        replyToMessageId: 18,
        urlMentions: ["https://report.example/apt29"],
        media: {
          retention: "metadata_only",
          items: [{ type: "document", fileName: "report.pdf", sizeBytes: 4000 }]
        },
        extractionHandoff: {
          actorAliases: ["APT29", "Cozy Bear"],
          cves: ["CVE-2026-9999"],
          victims: ["Fjord Energy AS"],
          uncertaintyMarkers: []
        },
        provenance: { confidence: 0.95 }
      },
      sensitive: false
    });

    const response = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor&cursor=19"), {
      store,
      frontier: new FocusedFrontier()
    }));

    const statusResponse = response as {
      endpoint: string;
      status: string;
      query: string;
      queuedTasks: number;
      safeOutput: { rawPrivateDataExposed: boolean; rawMediaPayloadsExposed: boolean; credentialsExposed: boolean; mediaRetention: string; piiMinimized: boolean };
      poll: { cursor: number; nextCursor: number; media: { retention: string; rawFetchAllowed: boolean } };
      reliability: { summary: { sourceCount: number; needsReviewCount: number }; sources: Array<{ sourceId: string; metrics: { promotionYield: number } }> };
      abuseControls: Array<{ sourceId: string; allowed: boolean; suppressedUrlCount: number }>;
      operatorStates: Array<{ sourceId: string; state: string; collectable: boolean }>;
      sourcePackCompatibility: Array<{ sourceId: string; compatible: boolean; retentionClass: string }>;
      sourcePackReadiness: { summary: { approvedPublicCount: number; replayableEvidenceCount: number }; sources: Array<{ sourceId: string; replayableEvidenceHandoff: { targetAgent: string; metadataOnly: boolean } }> };
      canaryRollout: { mode: string; summary: { approvedSourceCount: number; selectedSourceCount: number }; selectedSources: Array<{ sourceId: string; phase: string; agent06EvidenceHandoff: { metadataOnly: boolean } }> };
      promotionCanary: { mode: string; summary: { evidenceCount: number; noLeakSerialization: boolean } };
      promotionCertification: { mode: string; summary: { noLeakSerialization: boolean; sourceHealthUpdateCount: number } };
      actorReadiness: { status: string; sourceRatings: Array<{ sourceId: string; partialEvidenceOnly: boolean }> };
      answerReadiness: { freshness: { latestMessageId: number; safePartialEvidenceCount: number }; promotionYield: { rating: string; promotedCount: number } };
      sla: { enforcement: { agent06LedgerHandoff: { state: string }; agent07AnswerReadiness: { state: string; claimStatus: string } }; metrics: { collectionSuccess: { sourceCount: number }; promotionYield: { averageRatio: number } } };
      operatorControlEffects: unknown[];
    };
    expect(statusResponse).toMatchObject({
      endpoint: "/v1/public-channels/status",
      status: "ready",
      query: "APT29",
      queuedTasks: 1,
      safeOutput: {
        rawPrivateDataExposed: false,
        rawMediaPayloadsExposed: false,
        credentialsExposed: false,
        mediaRetention: "metadata_only",
        piiMinimized: true
      },
      poll: {
        cursor: 19,
        nextCursor: 20,
        media: { retention: "metadata_only", rawFetchAllowed: false }
      }
    });
    expect(statusResponse.reliability.summary).toMatchObject({ sourceCount: 1, needsReviewCount: 0 });
    expect(statusResponse.reliability.sources).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: "src_telegram", metrics: expect.objectContaining({ promotionYield: 1 }) })]));
    expect(statusResponse.abuseControls).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: "src_telegram", allowed: true, suppressedUrlCount: 0 })]));
    expect(statusResponse.operatorStates).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: "src_telegram", state: "actively_collectable", collectable: true })]));
    expect(statusResponse.sourcePackCompatibility).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: "src_telegram", compatible: true, retentionClass: "public_chat_text" })]));
    expect(statusResponse.sourcePackReadiness.summary).toMatchObject({ approvedPublicCount: 1, replayableEvidenceCount: 1 });
    expect(statusResponse.sourcePackReadiness.sources).toEqual(expect.arrayContaining([expect.objectContaining({
      sourceId: "src_telegram",
      replayableEvidenceHandoff: expect.objectContaining({ targetAgent: "agent_06", metadataOnly: true })
    })]));
    expect(statusResponse.canaryRollout.mode).toBe("dry_run");
    expect(statusResponse.canaryRollout.summary).toMatchObject({ approvedSourceCount: 1, selectedSourceCount: 1 });
    expect(statusResponse.canaryRollout.selectedSources).toEqual(expect.arrayContaining([expect.objectContaining({
      sourceId: "src_telegram",
      phase: "first_channel",
      agent06EvidenceHandoff: expect.objectContaining({ metadataOnly: true })
    })]));
    expect(statusResponse.promotionCanary).toMatchObject({ mode: "dry_run", summary: { evidenceCount: 1, noLeakSerialization: true } });
    expect(statusResponse.promotionCertification).toMatchObject({ mode: "dry_run", summary: { sourceHealthUpdateCount: 1, noLeakSerialization: true } });
    expect(statusResponse.actorReadiness.status).toBe("ready");
    expect(statusResponse.actorReadiness.sourceRatings).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: "src_telegram", partialEvidenceOnly: false })]));
    expect(statusResponse.answerReadiness.freshness).toMatchObject({ latestMessageId: 20, safePartialEvidenceCount: 1 });
    expect(statusResponse.answerReadiness.promotionYield).toMatchObject({ rating: "high", promotedCount: 1 });
    expect(statusResponse.sla.enforcement.agent06LedgerHandoff.state).toBe("pass");
    expect(statusResponse.sla.enforcement.agent07AnswerReadiness).toMatchObject({ state: "pass", claimStatus: "ready" });
    expect(statusResponse.sla.metrics.collectionSuccess.sourceCount).toBe(1);
    expect(statusResponse.sla.metrics.promotionYield.averageRatio).toBe(1);
    expect(statusResponse.operatorControlEffects).toEqual(expect.any(Array));
    expect(response.publicSignalFusion).toMatchObject({
      status: expect.any(String),
      guardrails: {
        publicOnly: true,
        privateJoinsUsed: false,
        accountAutomationUsed: false,
        rawMediaDownloaded: false,
        unsafeUrlsExposed: false
      },
      familyCoverage: {
        familiesCovered: expect.arrayContaining(["public_channel", "github_advisory", "cert_government"])
      },
      sourceHints: {
        github_advisory: expect.arrayContaining([expect.objectContaining({ sourceId: "src_github_advisory" })]),
        cert_government: expect.arrayContaining([expect.objectContaining({ sourceId: "src_cisa_kev" })])
      },
      publicSignalDeltas: expect.arrayContaining([expect.objectContaining({
        sourceId: "src_telegram",
        mergeTarget: "public_channel_partial_evidence"
      })]),
      advisoryConnector: expect.objectContaining({
        guardrails: expect.objectContaining({
          publicOnly: true,
          noPrivateRepoAccess: true,
          noExploitPayloadDownload: true
        }),
        rankedSignals: expect.arrayContaining([
          expect.objectContaining({
            sourceId: "src_github_advisory",
            family: "github_advisory",
            mergeTarget: "clear_web_capture_evidence"
          }),
          expect.objectContaining({
            sourceId: "src_cisa_kev",
            family: "cert_government",
            mergeTarget: "clear_web_capture_evidence"
          })
        ])
      }),
      analystSourceWorkbench: expect.objectContaining({
        schemaVersion: "ti.public_source_workbench.v1",
        guardrails: expect.objectContaining({
          publicOnly: true,
          dryRunOnly: true,
          noPrivateRepoAccess: true,
          unsafeUrlsExposed: false
        }),
        decisions: expect.arrayContaining([
          expect.objectContaining({
            sourceId: "src_github_advisory",
            publicOnly: true,
            provenance: expect.objectContaining({ unsafeUrlExposed: false })
          })
        ]),
        dryRunActions: expect.arrayContaining([
          expect.objectContaining({
            willMutate: false,
            willStartCrawling: false,
            publicOnly: true
          })
        ]),
        handoffs: expect.objectContaining({
          agent09ApiFields: ["publicSignalFusion.analystSourceWorkbench"]
        })
      }),
      coverageRadar: expect.objectContaining({
        schemaVersion: "ti.enterprise_source_coverage_radar.v1",
        guardrails: expect.objectContaining({
          publicOnly: true,
          safePublicOnly: true,
          restrictedMetadataReviewHeldOnly: true,
          dryRunOnly: true,
          unsafeUrlsExposed: false
        }),
        queryClassUsefulAnswer: expect.objectContaining({
          selectedSourceCount: expect.any(Number),
          familyDiversity: expect.any(Number)
        }),
        sourcePackRecommendations: expect.any(Array),
        conflictIndicators: expect.any(Array),
        handoffs: expect.objectContaining({
          agent09ApiFields: ["publicSignalFusion.coverageRadar"]
        })
      }),
      sourcePackExpansion: expect.objectContaining({
        schemaVersion: "ti.public_source_pack_expansion.v1",
        candidates: expect.any(Array),
        suppressed: expect.objectContaining({
          staleSourceIds: expect.any(Array),
          duplicateDedupeKeys: expect.any(Array),
          blockedSourceIds: expect.any(Array),
          unsafeUrlHashes: expect.any(Array)
        }),
        handoffs: expect.objectContaining({
          agent09ApiFields: ["publicSignalFusion.sourcePackExpansion"]
        }),
        guardrails: expect.objectContaining({
          publicOnly: true,
          dryRunOnly: true,
          noPrivateChannelAccess: true,
          noAccountAutomation: true,
          unsafeUrlsExposed: false
        })
      }),
      advisoryCorrelation: expect.objectContaining({
        schemaVersion: "ti.public_advisory_correlation.v1",
        correlatedEvidence: expect.any(Array),
        conflicts: expect.any(Array),
        summary: expect.objectContaining({
          correlatedEntityCount: expect.any(Number),
          conflictCount: expect.any(Number),
          familyDiversity: expect.any(Number)
        }),
        handoffs: expect.objectContaining({
          agent09ApiFields: ["publicSignalFusion.advisoryCorrelation"]
        }),
        guardrails: expect.objectContaining({
          publicOnly: true,
          noRawRestrictedMaterial: true,
          noPrivateChannels: true,
          noAccountAutomation: true,
          noUnsafeUrlsExposed: true
        })
      }),
      sourceFamilyBenchmarks: expect.objectContaining({
        schemaVersion: "ti.public_source_family_benchmarks.v1",
        rows: expect.any(Array),
        queryClassCoverage: expect.objectContaining({
          requiredFamilies: expect.any(Array),
          coveredFamilies: expect.any(Array),
          missingFamilies: expect.any(Array),
          unknownQuerySearching: expect.any(Boolean)
        }),
        expansionRecommendations: expect.any(Array),
        unknownQueryHandling: expect.objectContaining({
          noDefaultActorAssumption: true,
          staleCacheProseAllowed: false
        }),
        handoffs: expect.objectContaining({
          agent09ApiFields: ["publicSignalFusion.sourceFamilyBenchmarks"]
        }),
        guardrails: expect.objectContaining({
          publicOnly: true,
          dryRunOnly: true,
          noPrivateChannels: true,
          noAccountAutomation: true,
          noUnsafeUrlsExposed: true,
          noDemoDefaults: true,
          noDefaultActorAssumption: true
        })
      }),
      publicIntelligenceCoveragePlan: expect.objectContaining({
        schemaVersion: "ti.public_intelligence_coverage_plan.v1",
        queryClassSourceMap: expect.any(Array),
        blindSpots: expect.any(Array),
        safeSourcePackRecommendations: expect.any(Array),
        responsiveness: expect.objectContaining({
          refreshAfterSeconds: 3,
          staleCacheCopyAllowed: false,
          demoFallbackAllowed: false,
          defaultActorAssumptionAllowed: false
        }),
        handoffs: expect.objectContaining({
          agent09ApiFields: ["publicSignalFusion.publicIntelligenceCoveragePlan"]
        }),
        guardrails: expect.objectContaining({
          publicOnly: true,
          dryRunOnly: true,
          approvedPublicSourcesPrioritized: true,
          metadataOnlyPublicChannelHandoffs: true,
          noPrivateChannels: true,
          noAccountAutomation: true,
          noRawUrlsExposed: true,
          noDemoDefaults: true,
          noDefaultActorAssumption: true,
          noStaleCacheCopy: true
        })
      }),
      freshnessGapRemediation: expect.objectContaining({
        schemaVersion: "ti.public_freshness_gap_remediation.v1",
        answerState: expect.objectContaining({
          refreshAfterSeconds: 3,
          staleOnlyRecentActivityRejected: expect.any(Boolean)
        }),
        highVolumeActorFreshness: expect.objectContaining({
          trackedActors: expect.arrayContaining(["APT29", "APT42", "Sandworm", "Volt Typhoon", "Lazarus", "LockBit", "Akira"]),
          staleRecentActivityPromotionAllowed: false
        }),
        remediationActions: expect.any(Array),
        queryFixtures: expect.arrayContaining([
          expect.objectContaining({ query: "APT29", staleRecentActivityAllowed: false, defaultActorFallbackAllowed: false }),
          expect.objectContaining({ query: "Made Up Actor", expectedState: "searching", defaultActorFallbackAllowed: false })
        ]),
        apiFields: expect.objectContaining({
          publicSignalFusionField: "publicSignalFusion.freshnessGapRemediation"
        }),
        guardrails: expect.objectContaining({
          publicOnly: true,
          dryRunOnly: true,
          noDefaultActorAssumption: true,
          noDemoFallback: true,
          noStaleCacheCopy: true,
          noPrivateChannels: true,
          noAccountAutomation: true,
          noAuthBypass: true,
          noCaptchaSolving: true,
          noRestrictedRawCollection: true,
          noRawUrlsExposed: true
        })
      }),
      publicIntelligenceQueryMatrix: expect.objectContaining({
        schemaVersion: "ti.public_intelligence_query_matrix.v1",
        rows: expect.arrayContaining([
          expect.objectContaining({
            queryClass: expect.any(String),
            sourceFamilies: expect.objectContaining({
              required: expect.any(Array),
              covered: expect.any(Array),
              missing: expect.any(Array)
            }),
            scores: expect.objectContaining({
              publicAnswerReadiness: expect.any(Number),
              analystActionability: expect.any(Number)
            }),
            staleRecentActivityAllowed: false,
            defaultActorFallbackAllowed: false
          })
        ]),
        apiFields: expect.objectContaining({
          publicSignalFusionField: "publicSignalFusion.publicIntelligenceQueryMatrix"
        }),
        guardrails: expect.objectContaining({
          publicOnly: true,
          noDefaultActorAssumption: true,
          noDemoFallback: true,
          noStaleCacheCopy: true,
          noPrivateChannels: true,
          noAccountAutomation: true,
          noAuthBypass: true,
          noCaptchaSolving: true,
          noRestrictedRawCollection: true,
          noRawUrlsExposed: true
        })
      }),
      publicConflictContradictionResolver: expect.objectContaining({
        schemaVersion: "ti.public_conflict_contradiction_resolver.v1",
        rows: expect.any(Array),
        summary: expect.objectContaining({
          releaseGate: expect.any(String),
          affectedQueryClasses: expect.any(Array)
        }),
        apiFields: expect.objectContaining({
          publicSignalFusionField: "publicSignalFusion.publicConflictContradictionResolver",
          compactRowFields: expect.arrayContaining(["contradictionType", "publicAnswerEffect", "graphStixEffect", "releaseGate"])
        }),
        guardrails: expect.objectContaining({
          publicOnly: true,
          noRawUrlsExposed: true,
          noPrivateChannels: true,
          noAccountAutomation: true,
          noAuthBypass: true,
          noCaptchaSolving: true,
          noDefaultActorAssumption: true,
          noStaleCacheCopy: true
        })
      }),
      publicSignalLiveCollectionLoop: expect.objectContaining({
        schemaVersion: "ti.public_signal_live_collection_loop.v1",
        status: expect.any(String),
        intakeContract: expect.objectContaining({
          normalizedPayloadOnly: true,
          collectedItemProvenanceRequired: true,
          acceptedFamilies: expect.arrayContaining(["public_channel", "source_atlas", "darkweb_metadata"]),
          unsafePayloadFieldsRejected: expect.arrayContaining(["rawText", "payload", "credential", "onionUrl"])
        }),
        normalizedIntake: expect.any(Array),
        score: expect.objectContaining({
          overall: expect.any(Number),
          freshness: expect.any(Number),
          familyDiversity: expect.any(Number),
          provenanceStrength: expect.any(Number),
          penalties: expect.any(Array)
        }),
        playbook: expect.objectContaining({
          requiredFamilies: expect.any(Array),
          cadenceHints: expect.any(Array),
          parserExpectations: expect.any(Array),
          evidenceRequirements: expect.any(Array),
          publicUiStateBehavior: expect.any(String)
        }),
        nextSafeCollectionTasks: expect.arrayContaining([
          expect.objectContaining({
            dryRunOnly: true,
            willMutate: false,
            willStartCrawling: false,
            noUnsafePayload: true
          })
        ]),
        queryFixtures: expect.arrayContaining([
          expect.objectContaining({ name: "high_value_known_actor", query: "APT29" }),
          expect.objectContaining({ name: "darkweb_metadata_only_held", expectedState: "held" })
        ]),
        handoffs: expect.objectContaining({
          agent09ApiFields: ["publicSignalFusion.publicSignalLiveCollectionLoop"]
        }),
        guardrails: expect.objectContaining({
          publicOnly: true,
          safeDarkwebMetadataOnly: true,
          noRawUnsafeUrls: true,
          noCredentials: true,
          noPayloadLinks: true,
          noPrivateChannels: true,
          noAccountAutomation: true,
          noDefaultActorAssumption: true,
          noStaleCacheCopy: true
        })
      }),
      publicSignalValueImpact: expect.objectContaining({
        schemaVersion: "ti.public_signal_value_impact.v1",
        status: expect.any(String),
        answerImpact: expect.objectContaining({
          currentReadiness: expect.any(Number),
          projectedWithSourceAtlas: expect.any(Number),
          projectedWithDarkwebMetadata: expect.any(Number),
          projectedWithBoth: expect.any(Number),
          bestLift: expect.any(Number)
        }),
        sourceAtlasImpact: expect.any(Array),
        darkwebIndexImpact: expect.any(Array),
        gapClosure: expect.any(Array),
        nextBestActions: expect.arrayContaining([
          expect.objectContaining({
            dryRunOnly: true,
            willMutate: false,
            noUnsafePayload: true
          })
        ]),
        guardrails: expect.objectContaining({
          publicOnlyAnswerPromotion: true,
          darkwebMetadataNeverPromotesPublicAnswer: true,
          noRawUnsafeUrls: true,
          noCredentials: true,
          noPayloadLinks: true,
          noPrivateChannels: true,
          noAccountAutomation: true,
          noDefaultActorAssumption: true,
          noStaleCacheCopy: true
        })
      }),
      publicCoverageFreshnessValue: expect.objectContaining({
        schemaVersion: "ti.public_coverage_freshness_value.v1",
        status: expect.any(String),
        summary: expect.objectContaining({
          coverageFreshnessScore: expect.any(Number),
          currentAnswerReadiness: expect.any(Number),
          expectedAnswerLift: expect.any(Number),
          staleFamilyCount: expect.any(Number),
          missingFamilyCount: expect.any(Number)
        }),
        familyFreshness: expect.any(Array),
        queryClassFreshness: expect.any(Array),
        sourceAtlasFreshnessImpact: expect.any(Array),
        highValueCoverage: expect.any(Array),
        staleRisk: expect.objectContaining({
          staleOnlyRecentActivityRejected: expect.any(Boolean),
          staleFamilies: expect.any(Array),
          noEvidenceFamilies: expect.any(Array),
          metadataOnlyFamilies: expect.any(Array)
        }),
        handoffs: expect.objectContaining({
          agent09ApiFields: ["publicSignalFusion.publicCoverageFreshnessValue"]
        }),
        guardrails: expect.objectContaining({
          publicOnly: true,
          darkwebMetadataTriageOnly: true,
          noRawUnsafeUrls: true,
          noCredentials: true,
          noPayloadLinks: true,
          noPrivateChannels: true,
          noAccountAutomation: true,
          noDefaultActorAssumption: true,
          noStaleCacheCopy: true
        })
      })
    });
    const evidence = response.evidence as Array<{
      messageUrl: string;
      media: { retention: string; rawFetchAllowed: boolean; items: unknown[] };
      extractionHandoff: { actorAliases: string[]; cves: string[]; victims: string[] };
      replyToMessageId: number;
    }>;
    expect(evidence[0]).toMatchObject({
      messageUrl: "https://t.me/securityalerts/20",
      replyToMessageId: 18,
      media: { retention: "metadata_only", rawFetchAllowed: false },
      extractionHandoff: {
        actorAliases: ["APT29", "Cozy Bear"],
        cves: ["CVE-2026-9999"],
        victims: ["Fjord Energy AS"]
      }
    });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("sessionString");
    expect(serialized).not.toContain("mediaPayload");
    expect(serialized).not.toContain("+privateInvite");
  });

  test("classifies public-channel status route queued rate-limited policy-disabled duplicate and edit delete states", async () => {
    const approvedGovernance = {
      approvalRequired: true,
      approvalState: "approved" as const,
      metadataOnly: false,
      approvedAt: new Date(0).toISOString(),
      approvedBy: "reviewer"
    };

    const queuedStore = new InMemoryScraperStore();
    queuedStore.saveSource(source({
      id: "src_queued_telegram",
      name: "Queued public channel",
      type: "telegram_public",
      url: "https://t.me/queuedintel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"] }
    }));
    const queued = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: queuedStore,
      frontier: new FocusedFrontier()
    }));
    expect(queued).toMatchObject({ status: "queued", queuedTasks: 1 });

    const rateStore = new InMemoryScraperStore();
    rateStore.saveSource(source({
      id: "src_rate_telegram",
      name: "Rate limited public channel",
      type: "telegram_public",
      url: "https://t.me/ratelimitedintel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"], rateLimitResetAt: "2999-01-01T00:00:00.000Z" }
    }));
    const rateLimited = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: rateStore,
      frontier: new FocusedFrontier()
    }));
    expect(rateLimited).toMatchObject({
      status: "rate_limited",
      promotion: { rateLimitBackoff: [{ sourceId: "src_rate_telegram" }] },
      operatorStates: [{ sourceId: "src_rate_telegram", state: "delayed", collectable: false }]
    });

    const disabledStore = new InMemoryScraperStore();
    disabledStore.saveSource(source({
      id: "src_disabled_telegram",
      name: "Disabled public channel",
      type: "telegram_public",
      url: "https://t.me/disabledintel",
      accessMethod: "official_api",
      status: "disabled",
      risk: "medium",
      legalNotes: "Disabled public channel.",
      metadata: { actors: ["APT29"] }
    }));
    const policyDisabled = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: disabledStore,
      frontier: new FocusedFrontier()
    }));
    expect(policyDisabled).toMatchObject({
      status: "policy_disabled",
      promotion: { policyDisabled: [{ sourceId: "src_disabled_telegram" }] },
      operatorStates: [{ sourceId: "src_disabled_telegram", state: "policy_blocked", reviewRequired: true }]
    });

    const quarantinedStore = new InMemoryScraperStore();
    quarantinedStore.saveSource(source({
      id: "src_quarantined_telegram",
      name: "Quarantined public channel",
      type: "telegram_public",
      url: "https://t.me/quarantinedintel",
      accessMethod: "official_api",
      status: "quarantined",
      risk: "medium",
      legalNotes: "Quarantined public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"] }
    }));
    const quarantined = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: quarantinedStore,
      frontier: new FocusedFrontier()
    }));
    expect(quarantined).toMatchObject({
      operatorStates: [{ sourceId: "src_quarantined_telegram", state: "quarantined", collectable: false }]
    });

    const duplicateStore = new InMemoryScraperStore();
    duplicateStore.saveSource(source({
      id: "src_duplicate_telegram",
      name: "Duplicate public channel",
      type: "telegram_public",
      url: "https://t.me/duplicateintel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"], lastDiscoveredUrls: ["https://t.me/duplicateintel/40"] }
    }));
    duplicateStore.saveCapture(telegramCapture({
      id: "cap_duplicate_telegram",
      sourceId: "src_duplicate_telegram",
      url: "https://t.me/duplicateintel/40",
      channel: "duplicateintel",
      messageId: 40,
      body: "APT29 repeated public-channel URL"
    }));
    const duplicate = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: duplicateStore,
      frontier: new FocusedFrontier()
    }));
    expect(duplicate).toMatchObject({
      status: "high_duplicate",
      promotion: {
        duplicateSuppressed: [{ sourceId: "src_duplicate_telegram", messageUrl: "https://t.me/duplicateintel/40" }]
      },
      reliability: {
        sources: [{
          sourceId: "src_duplicate_telegram",
          recommendedActions: expect.arrayContaining(["suppress_repeated_urls"])
        }]
      },
      abuseControls: [{
        sourceId: "src_duplicate_telegram",
        suppressedUrlCount: 1
      }]
    });

    const churnStore = new InMemoryScraperStore();
    churnStore.saveSource(source({
      id: "src_churn_telegram",
      name: "Churn public channel",
      type: "telegram_public",
      url: "https://t.me/churnintel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"] }
    }));
    churnStore.saveCapture(telegramCapture({
      id: "cap_churn_edit",
      sourceId: "src_churn_telegram",
      url: "https://t.me/churnintel/50",
      channel: "churnintel",
      messageId: 50,
      body: "APT29 edited public-channel note",
      editDate: "2026-05-24T00:01:00.000Z"
    }));
    churnStore.saveCapture(telegramCapture({
      id: "cap_churn_deleted",
      sourceId: "src_churn_telegram",
      url: "https://t.me/churnintel/51",
      channel: "churnintel",
      messageId: 51,
      body: "APT29 deleted public-channel note",
      messageState: "deleted"
    }));
    const churn = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor&cursor=49"), {
      store: churnStore,
      frontier: new FocusedFrontier()
    }));
    expect(churn).toMatchObject({
      status: "ready",
      poll: {
        updatedMessages: [{ messageId: 50 }],
        deletedOrUnavailable: [{ messageId: 51 }]
      },
      cutoverReport: {
        reconciliation: {
          summary: {
            high_edit_delete_churn: 0
          }
        }
      }
    });
  });

  test("reports pending public-channel search with activation recommendations", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_pending_telegram",
      name: "Ransomware candidate channel",
      type: "telegram_public",
      url: "https://t.me/ransomwareintel",
      accessMethod: "official_api",
      status: "candidate",
      risk: "medium",
      legalNotes: "Candidate public Telegram channel fixture.",
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: false
      },
      metadata: { ransomware: ["Akira"], victims: ["Fjord Energy AS"], topicTags: ["ransomware"] }
    }));

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Fjord%20Energy%20AS&entityType=victim"), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(response.publicChannel).toMatchObject({
      status: "pending_channel_search",
      queuedTasks: 0,
      evidence: [],
      coverageGaps: [{
        reason: "matching_channels_pending_review",
        sourceId: "src_pending_telegram",
        requiredAction: "approve"
      }],
      activationRecommendations: [{
        sourceId: "src_pending_telegram",
        requiredAction: "approve"
      }]
    });
  });

  test("reports public-channel source-pack recommendations for uncovered live search queries", async () => {
    const store = new InMemoryScraperStore();
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json();
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Volt%20Typhoon&entityType=actor"), {
      store,
      frontier: new FocusedFrontier(),
      publicTelegramSourcePacks: [pack]
    }));

    const publicChannel = response.publicChannel as {
      status: string;
      queuedTasks: number;
      sourcePackRecommendations: Array<{ sourcePackId: string; sourceId: string; requiredAction: string }>;
      activationRecommendations: Array<{ sourcePackId?: string; sourceId: string; requiredAction: string }>;
    };
    expect(publicChannel.status).toBe("pending_channel_search");
    expect(publicChannel.queuedTasks).toBe(0);
    expect(publicChannel.sourcePackRecommendations[0]).toMatchObject({
      sourcePackId: "public-telegram-cti-candidates",
      sourceId: "tg_candidate_actor_identity",
      requiredAction: "review"
    });
    expect(publicChannel.activationRecommendations[0]).toMatchObject({
      sourcePackId: "public-telegram-cti-candidates",
      sourceId: "tg_candidate_actor_identity",
      requiredAction: "review"
    });
    const activationProgram = (response.publicChannel as {
      activationProgram: {
        recommendedPublicPacks: Array<{ sourcePackId: string; sourceId: string }>;
        noApprovedChannelGaps: Array<{ reason: string }>;
      };
    }).activationProgram;
    expect(activationProgram.recommendedPublicPacks[0]).toMatchObject({
      sourcePackId: "public-telegram-cti-candidates",
      sourceId: "tg_candidate_actor_identity"
    });
    expect(activationProgram.noApprovedChannelGaps[0]).toMatchObject({
      reason: "no_approved_channels"
    });
    expect((response.publicChannel as { reconciliation: { packCount: number; repairs: unknown[]; summary: Record<string, number> } }).reconciliation).toMatchObject({
      packCount: 1,
      summary: {
        no_query_coverage: 0
      }
    });
    expect((response.publicChannel as { cutoverReport: { summary: Record<string, unknown>; sourcePackRecommendations: unknown[] } }).cutoverReport).toMatchObject({
      summary: {
        readyChannelCount: 0,
        pendingReviewCount: 0,
        rateLimitedCount: 0,
        staleCursorCount: 0,
        highDuplicateUrlCount: 0,
        safePartialEvidenceCount: 0,
        recommendedNextAction: "activate_source_pack"
      },
      sourcePackRecommendations: expect.any(Array)
    });
    const applyPlan = (response.publicChannel as { applyPlan: { summary: Record<string, unknown>; promotionGate: Record<string, unknown>; steps: Array<Record<string, unknown>> } }).applyPlan;
    expect(applyPlan).toMatchObject({
      summary: {
        humanApprovalRequiredCount: 5,
        canAutoApply: false
      },
      promotionGate: {
        metadataOnlyMedia: true,
        piiMinimizationRequired: true
      }
    });
    expect(applyPlan.steps[0]).toMatchObject({
      action: "activate_source_pack",
      execution: "human_approval_required",
      automationSafe: false,
      manual: true
    });
  });

  test("returns frozen public-channel apply-plan contract without raw payload fields", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "unsafe_private",
      name: "Unsafe private Telegram",
      type: "telegram_public",
      url: "https://t.me/+privateInvite",
      accessMethod: "official_api",
      status: "candidate",
      risk: "medium",
      legalNotes: "Unsafe fixture should never activate.",
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: false
      },
      metadata: {
        actors: ["APT29"],
        accountAutomation: true,
        rawMessage: "do not expose",
        mediaPayload: "do not expose"
      }
    }));

    const response = await body(await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor" })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(response.contract).toMatchObject({
      endpoint: "/v1/public-channels/apply-plan",
      method: "POST",
      mode: "dry_run",
      examples: {
        automationSafe: { execution: "automation_safe" },
        humanApprovalRequired: { execution: "human_approval_required" },
        blockedPrivateTarget: { execution: "blocked" },
        rateLimitedChannel: { action: "delay_poll" },
        rollbackOnlyQuarantine: { execution: "rollback_only" }
      }
    });
    const applyPlan = response.applyPlan as {
      steps: Array<{ action: string; execution: string; prerequisites: string[] }>;
      promotionGate: { metadataOnlyMedia: boolean; piiMinimizationRequired: boolean };
    };
    expect(applyPlan.steps.some((step) => step.action === "activate_source_pack")).toBe(false);
    expect(applyPlan.steps.find((step) => step.action === "request_review")).toMatchObject({
      execution: "blocked",
      prerequisites: expect.arrayContaining(["blocked: private, invite, or account-automation targets cannot be activated"])
    });
    expect(applyPlan.promotionGate).toMatchObject({
      metadataOnlyMedia: true,
      piiMinimizationRequired: true
    });
    const serializedApplyPlan = JSON.stringify(response.applyPlan);
    expect(serializedApplyPlan).not.toContain("do not expose");
    expect(serializedApplyPlan).not.toContain("rawMessage");
    expect(serializedApplyPlan).not.toContain("mediaPayload");
    expect(serializedApplyPlan).not.toContain("+privateInvite");
  });

  test("routes public-channel apply-plan source-pack activation and review contracts", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json();
    const activation = await body(await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "Volt Typhoon", entityType: "actor", actions: ["activate_source_pack"] })
    }), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier(),
      publicTelegramSourcePacks: [pack]
    }));

    expect(activation.applyPlan).toMatchObject({
      summary: {
        stepCount: 5,
        humanApprovalRequiredCount: 5,
        automationSafeCount: 0
      }
    });
    expect((activation.applyPlan as { steps: Array<Record<string, unknown>> }).steps[0]).toMatchObject({
      action: "activate_source_pack",
      execution: "human_approval_required",
      manual: true,
      automationSafe: false
    });
    expect(activation.canaryRollout).toMatchObject({
      mode: "dry_run",
      status: "hold",
      summary: {
        selectedSourceCount: 0,
        pendingReviewCount: 7,
        releaseTrain: "hold"
      },
      controls: {
        rollback: {
          dryRunOnly: true,
          quarantineSupported: true
        }
      }
    });
    expect(activation.promotionCanary).toMatchObject({
      mode: "dry_run",
      summary: {
        evidenceCount: 0,
        noLeakSerialization: true
      },
      handoffs: {
        agent06EvidenceCutover: expect.objectContaining({ evidenceCutoverReady: true }),
        agent10RcGate: expect.objectContaining({ status: expect.any(String) })
      }
    });
    expect(activation.promotionCertification).toMatchObject({
      mode: "dry_run",
      summary: {
        certifiedEvidenceCount: 0,
        sourceHealthUpdateCount: expect.any(Number),
        noLeakSerialization: true
      },
      handoffs: {
        agent07AnswerStateMachine: expect.objectContaining({ state: expect.any(String) }),
        agent10RcGate: expect.objectContaining({ decision: expect.any(String) })
      }
    });

    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_pending_review",
      name: "Pending public channel",
      type: "telegram_public",
      url: "https://t.me/public_review_channel",
      accessMethod: "official_api",
      status: "candidate",
      risk: "medium",
      legalNotes: "Pending public Telegram review.",
      governance: { approvalRequired: true, approvalState: "pending", metadataOnly: false },
      metadata: { actors: ["APT29"] }
    }));
    const review = await body(await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", actions: ["request_review"] })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(review.applyPlan).toMatchObject({
      summary: {
        stepCount: 1,
        humanApprovalRequiredCount: 1
      },
      steps: [{
        action: "request_review",
        execution: "human_approval_required"
      }]
    });
  });

  test("routes public-channel apply-plan rate-limit and rollback-only quarantine contracts", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_rate_limited_channel",
      name: "Rate limited public channel",
      type: "telegram_public",
      url: "https://t.me/rate_limited_channel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public Telegram channel.",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: false },
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "reviewer",
      metadata: {
        actors: ["APT29"],
        rateLimitResetAt: "2999-01-01T00:00:00.000Z"
      }
    }));

    const rateLimited = await body(await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", actions: ["delay_poll"] })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(rateLimited.applyPlan).toMatchObject({
      summary: {
        stepCount: 1,
        automationSafeCount: 1,
        canAutoApply: true
      },
      steps: [{
        action: "delay_poll",
        execution: "automation_safe",
        rateLimitSafety: expect.arrayContaining(["honor current rate-limit reset at 2999-01-01T00:00:00.000Z"])
      }]
    });

    const rollbackStore = new InMemoryScraperStore();
    rollbackStore.saveSource(source({
      id: "src_active_private",
      name: "Active unsafe private channel",
      type: "telegram_public",
      url: "https://t.me/+privateInvite",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Unsafe active fixture.",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: false },
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "reviewer",
      metadata: { actors: ["APT29"], accountAutomation: true }
    }));
    const rollback = await body(await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", actions: ["quarantine_channel"] })
    }), {
      store: rollbackStore,
      frontier: new FocusedFrontier()
    }));

    expect(rollback.applyPlan).toMatchObject({
      summary: {
        stepCount: 1,
        rollbackOnlyCount: 1
      },
      steps: [{
        action: "quarantine_channel",
        execution: "rollback_only",
        manual: true
      }]
    });
  });

  test("rejects invalid public-channel apply-plan actions", async () => {
    const response = await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", actions: ["join_private_group"] })
    }), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const payload = await body(response);

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: {
        code: "invalid_action",
        message: "Unsupported public-channel apply-plan action",
        details: {
          invalidActions: ["join_private_group"],
          allowedActions: expect.arrayContaining(["activate_source_pack", "request_review", "delay_poll"])
        }
      }
    });
  });

  test("mounted public-channel apply-plan endpoint handles proof cases without leaking unsafe fields", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json();
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_public_review_mounted",
      name: "Mounted pending public channel",
      type: "telegram_public",
      url: "https://t.me/public_review_mounted",
      accessMethod: "official_api",
      status: "candidate",
      risk: "medium",
      legalNotes: "Pending public Telegram review.",
      governance: { approvalRequired: true, approvalState: "pending", metadataOnly: false },
      metadata: { actors: ["APT29"] }
    }));
    store.saveSource(source({
      id: "src_public_rate_limited_mounted",
      name: "Mounted rate-limited public channel",
      type: "telegram_public",
      url: "https://t.me/public_rate_limited_mounted",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public Telegram channel.",
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "reviewer",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: false, approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer" },
      metadata: { actors: ["APT29"], rateLimitResetAt: "2999-01-01T00:00:00.000Z" }
    }));
    store.saveSource(source({
      id: "src_public_private_mounted",
      name: "Mounted unsafe private channel",
      type: "telegram_public",
      url: "https://t.me/+privateInvite",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Unsafe mounted fixture.",
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "reviewer",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: false, approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer" },
      metadata: {
        actors: ["APT29"],
        accountAutomation: true,
        rawMessage: "mounted raw body must not leak",
        mediaPayload: "mounted media payload must not leak",
        sessionString: "mounted session must not leak"
      }
    }));

    const server = startApiServer({
      port: 0,
      store,
      frontier: new FocusedFrontier(),
      publicTelegramSourcePacks: [pack]
    });
    const post = async (payload: Record<string, unknown>) => {
      const response = await fetch(`http://127.0.0.1:${server.port}/v1/public-channels/apply-plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      return { response, payload: await response.json() as Record<string, unknown> };
    };

    try {
      const activation = await post({ query: "Volt Typhoon", entityType: "actor", actions: ["activate_source_pack"] });
      expect(activation.response.status).toBe(200);
      expect(activation.payload.applyPlan).toMatchObject({
        summary: { humanApprovalRequiredCount: 5 },
        steps: expect.arrayContaining([
          expect.objectContaining({ action: "activate_source_pack", execution: "human_approval_required" })
        ])
      });

      const review = await post({ query: "APT29", entityType: "actor", actions: ["request_review"] });
      expect(review.payload.applyPlan).toMatchObject({
        steps: expect.arrayContaining([
          expect.objectContaining({ action: "request_review", execution: "human_approval_required" }),
          expect.objectContaining({ action: "request_review", execution: "blocked" })
        ])
      });

      const rateLimited = await post({ query: "APT29", entityType: "actor", actions: ["delay_poll"] });
      expect(rateLimited.payload.applyPlan).toMatchObject({
        summary: { automationSafeCount: 1, canAutoApply: true },
        steps: [expect.objectContaining({ action: "delay_poll", execution: "automation_safe" })]
      });

      const rollback = await post({ query: "APT29", entityType: "actor", actions: ["quarantine_channel"] });
      expect(rollback.payload.applyPlan).toMatchObject({
        summary: { rollbackOnlyCount: 1 },
        steps: [expect.objectContaining({ action: "quarantine_channel", execution: "rollback_only" })]
      });

      const statusResponse = await fetch(`http://127.0.0.1:${server.port}/v1/public-channels/status?q=APT29&entityType=actor`);
      const statusPayload = await statusResponse.json() as Record<string, unknown>;
      expect(statusPayload).toMatchObject({
        endpoint: "/v1/public-channels/status",
        operatorStates: expect.arrayContaining([
          expect.objectContaining({ sourceId: "src_public_review_mounted", state: "pending_review" }),
          expect.objectContaining({ sourceId: "src_public_rate_limited_mounted", state: "delayed" }),
          expect.objectContaining({ sourceId: "src_public_private_mounted", state: "policy_blocked" })
        ]),
        sourcePackCompatibility: expect.any(Array),
        sourcePackReadiness: expect.objectContaining({
          summary: expect.objectContaining({
            sourcePackCount: expect.any(Number),
            candidateCount: expect.any(Number)
          }),
          safeOutput: expect.objectContaining({
            rawPrivateDataExposed: false,
            rawMediaPayloadsExposed: false,
            credentialsExposed: false
          })
        }),
        actorReadiness: {
          status: expect.any(String)
        },
        answerReadiness: {
          reliability: {
            sourceCount: expect.any(Number)
          },
          promotionYield: {
            rating: expect.any(String)
          }
        },
        operatorControlEffects: expect.arrayContaining([
          expect.objectContaining({ action: "request_review", expectedAnswerQualityEffect: "queues_human_review_for_readiness" }),
          expect.objectContaining({ action: "delay_poll", expectedAnswerQualityEffect: "delays_freshness_keeps_claims_partial" })
        ])
      });

      const invalid = await post({ query: "APT29", actions: ["join_private_group"] });
      expect(invalid.response.status).toBe(400);
      expect(invalid.payload).toMatchObject({
        error: {
          code: "invalid_action",
          details: { invalidActions: ["join_private_group"] }
        }
      });

      const serialized = JSON.stringify({ activation, review, rateLimited, rollback, statusPayload, invalid });
      expect(serialized).not.toContain("mounted raw body must not leak");
      expect(serialized).not.toContain("mounted media payload must not leak");
      expect(serialized).not.toContain("mounted session must not leak");
      expect(serialized).not.toContain("+privateInvite");
    } finally {
      server.stop();
    }
  });

  test("returns restricted metadata apply-plan contracts for every cutover status", async () => {
    const store = new InMemoryScraperStore();
    for (const item of apiRestrictedMetadataApplyPlanSources()) store.saveSource(item);
    const response = await body(await handleApiRequest(api("/v1/restricted-metadata/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ retentionExpiringWithinDays: 7, includeCutover: true })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(response.contract).toMatchObject({
      endpoint: "/v1/restricted-metadata/apply-plan",
      method: "POST",
      mode: "dry_run",
      examples: {
        disabled: { action: "disable_source", safety: "rollback_only" },
        pendingApproval: { action: "renew_legal_notes", safety: "human_approval_required" },
        readyMetadataOnly: { action: "enable_metadata_only_queue", safety: "automation_safe" },
        blockedUnsafeTarget: { action: "keep_source_blocked", safety: "blocked" },
        killSwitchActive: { action: "apply_kill_switch", safety: "rollback_only" },
        retentionExpiring: { action: "shorten_retention" },
        auditClean: { action: "enable_metadata_only_queue" }
      }
    });
    const applyPlan = response.applyPlan as {
      actions: Array<{
        action: string;
        sourceId: string;
        safety: string;
        prohibitedAlternatives: string[];
        proof: {
          exposesRawUrl: boolean;
          allowsPayloadDownload: boolean;
          allowsAuthBypass: boolean;
          allowsCaptchaSolving: boolean;
          allowsPrivateCommunityAccess: boolean;
          allowsThreatActorInteraction: boolean;
        };
      }>;
      connectorCertifications: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; noLeakSerialization: { passed: boolean }; guarantees: Record<string, boolean> }>;
      killSwitchDrills: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; guarantees: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      emergencyStopCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; rcGate: string; proof: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      nonBlockingSearch: { metadataOnly: boolean; safeForApi: boolean; nonBlockingPublicSearch: boolean; maxPublicSearchAddedLatencyMs: number; observedScenarios: string[]; packets: Array<{ publicSearchAction: string; proof: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      analystOperations: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; victimNotificationPacketCount: number; packets: Array<{ schedulerIsolation: { directEgressAllowed: boolean }; proof: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      noLeakSerialization: { passed: boolean };
      summary: Record<string, number>;
      agent09PolicyStatusFields: string[];
      agent10KillSwitchRollback: string[];
    };
    expect(applyPlan.actions.map((item) => item.action)).toEqual(expect.arrayContaining([
      "enable_metadata_only_queue",
      "renew_legal_notes",
      "keep_source_blocked",
      "apply_kill_switch",
      "disable_source",
      "shorten_retention"
    ]));
    expect(applyPlan.summary.automation_safe).toBeGreaterThanOrEqual(2);
    expect(applyPlan.summary.human_approval_required).toBeGreaterThanOrEqual(1);
    expect(applyPlan.summary.blocked).toBeGreaterThanOrEqual(1);
    expect(applyPlan.summary.rollback_only).toBeGreaterThanOrEqual(1);
    expect(applyPlan.agent09PolicyStatusFields).toEqual(expect.arrayContaining([
      "disabled",
      "pending_approval",
      "ready_metadata_only",
      "blocked_unsafe_target",
      "kill_switch_active",
      "retention_expiring",
      "audit_clean"
    ]));
    expect(applyPlan.agent10KillSwitchRollback).toEqual(expect.arrayContaining(["pause_restricted_metadata_workers"]));
    expect(applyPlan.noLeakSerialization.passed).toBe(true);
    expect(applyPlan.connectorCertifications.map((packet) => packet.scenario)).toEqual(expect.arrayContaining([
      "unsafe_link_form_download",
      "retention_expiry",
      "low_yield_source"
    ]));
    expect(applyPlan.connectorCertifications.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.noLeakSerialization.passed &&
      packet.guarantees.noContact &&
      packet.guarantees.noDownload
    )).toBe(true);
    expect(applyPlan.killSwitchDrills).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      operatorVisible: true,
      noLeakSerialization: { passed: true }
    });
    expect(applyPlan.killSwitchDrills.observedScenarios).toEqual(expect.arrayContaining([
      "unsafe_download_form_contact_link",
      "kill_switch_activation_mid_run",
      "retention_expiry",
      "public_api_blocked_state"
    ]));
    expect(applyPlan.killSwitchDrills.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.operatorVisible &&
      packet.noLeakSerialization.passed &&
      packet.guarantees.noContact &&
      packet.guarantees.noDownload
    )).toBe(true);
    expect(applyPlan.emergencyStopCertification).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      noLeakSerialization: { passed: true }
    });
    expect(applyPlan.emergencyStopCertification.observedScenarios).toEqual(expect.arrayContaining([
      "unsafe_download_form_contact_target",
      "kill_switch_propagation",
      "retention_expiry",
      "public_api_blocked_state"
    ]));
    expect(applyPlan.emergencyStopCertification.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.rcGate === "restricted_metadata_emergency_stop_certification_rc" &&
      packet.noLeakSerialization.passed &&
      packet.proof.noUnsafeAccess &&
      packet.proof.noDataExposure &&
      packet.proof.noContact &&
      packet.proof.noDownload &&
      packet.proof.noCredentialBypass &&
      packet.proof.noCaptchaSolving &&
      packet.proof.noStealth &&
      packet.proof.noRawPayloads &&
      packet.proof.noRawUrls &&
      packet.proof.hashOnlyEvidence
    )).toBe(true);
    expect(applyPlan.nonBlockingSearch).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      nonBlockingPublicSearch: true,
      maxPublicSearchAddedLatencyMs: 0
    });
    expect(applyPlan.nonBlockingSearch.observedScenarios).toEqual(expect.arrayContaining(["unsafe_target", "kill_switch", "retention_expiry", "public_api_blocked_state"]));
    expect(applyPlan.nonBlockingSearch.packets.every((packet) =>
      packet.publicSearchAction === "continue_clear_web_and_public_channel" &&
      packet.proof.doesNotBlockPublicSearch &&
      packet.proof.doesNotPromoteRestrictedFacts &&
      packet.proof.noUnsafeAccess &&
      packet.proof.noDataExposure &&
      packet.noLeakSerialization.passed
    )).toBe(true);
    expect(applyPlan.analystOperations).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true
    });
    expect(applyPlan.analystOperations.observedScenarios).toEqual(expect.arrayContaining(["approval_requested", "unsafe_download_form_contact_target", "raw_payload_blocked", "victim_notification_packet", "emergency_stop_rollback"]));
    expect(applyPlan.analystOperations.packets.every((packet) =>
      packet.schedulerIsolation.directEgressAllowed === false &&
      packet.proof.noStolenFilesDownloaded &&
      packet.proof.noCredentials &&
      packet.proof.noAuthBypass &&
      packet.proof.noCaptchaSolving &&
      packet.proof.noPrivateAccess &&
      packet.proof.noThreatActorInteraction &&
      packet.noLeakSerialization.passed
    )).toBe(true);
    for (const action of applyPlan.actions) {
      expect(action.prohibitedAlternatives).toEqual(expect.arrayContaining([
        "payload download remains prohibited",
        "credential or authentication bypass remains prohibited",
        "CAPTCHA solving remains prohibited",
        "private community access remains prohibited",
        "threat actor interaction remains prohibited",
        "unsafe restricted URLs remain redacted to hashes"
      ]));
      expect(action.proof).toMatchObject({
        exposesRawUrl: false,
        allowsPayloadDownload: false,
        allowsAuthBypass: false,
        allowsCaptchaSolving: false,
        allowsPrivateCommunityAccess: false,
        allowsThreatActorInteraction: false
      });
    }
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain(".onion");
    expect(serialized).not.toContain("user:pass");
    expect(serialized).not.toContain("customer-dump");
  });

  test("returns restricted metadata operations status without unsafe details", async () => {
    const store = new InMemoryScraperStore();
    for (const item of apiRestrictedMetadataApplyPlanSources()) store.saveSource(item);
    store.saveCapture({
      id: "cap_restricted_status",
      sourceId: "src_restricted_ready",
      url: "http://readyexample.onion/posts",
      collectedAt: "2026-05-24T00:00:00.000Z",
      contentHash: "hash_restricted_status",
      mediaType: "text/plain",
      storageKind: "metadata_only",
      retentionClass: "restricted_metadata",
      metadata: {
        adapter: "darknet_metadata",
        leakSite: {
          actorName: "Akira",
          victimName: "Fjord Energy AS",
          claimDate: "2026-05-20",
          claimedSector: "Energy",
          claimedCountry: "NO",
          claimedDataCategory: "contracts",
          postStatus: "new",
          sourceTimestamp: "2026-05-23T00:00:00.000Z",
          urlHash: "urlhash_restricted_status",
          screenshotHash: "screenhash_restricted_status",
          confidence: 0.82
        },
        policyDecision: { id: "policy_restricted_status" }
      },
      sensitive: true
    });

    const response = await body(await handleApiRequest(api("/v1/restricted-metadata/status"), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(response.status).toMatchObject({
      endpoint: "/v1/restricted-metadata/status",
      metadataOnly: true,
      safeForApi: true,
      agent06EvidenceHandoffProof: {
        unsafeDetected: false,
        agent06StorageContract: "metadata_only_no_body_object_url_filename_credentials_or_payload_reference"
      }
    });
    const status = response.status as {
      summary: Record<string, number>;
      sources: Array<{ sourceId: string; endpoints: Record<string, string>; redactionGuarantees: Record<string, unknown>; forbiddenActionCounters: Record<string, number> }>;
      operationalSla: { status: string; metrics: Record<string, number>; metadataOnly: boolean; safeForApi: boolean };
      enforcement: { level: string; metadataOnly: boolean; safeForApi: boolean; activeRules: Array<{ rule: string }>; emergencyStop: { state: string; dryRunOnly: boolean; workerAction: string }; agent09WarningCodes: string[] };
      auditTrail: { metadataOnly: boolean; safeForApi: boolean; unsafeFieldsExposed: boolean; rejectedFields: string[] };
      governancePackets: Array<{ metadataOnly: boolean; safeForApi: boolean; networks: string[]; proof: Record<string, boolean>; redactionPolicy: Record<string, boolean> }>;
      operatorGovernance: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; observedScenarios: string[]; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; sourceHashOnly: boolean; sourceHash: string; policyReason: string; allowedActions: string[]; forbiddenActions: string[]; graphStixApiEffect: { stix: string; publicSearch: string }; rollbackPath: string[]; auditId: string; proofCommands: string[]; proof: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      darkMetadataCanary: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; fixtureBacked: boolean; observedScenarios: string[]; networks: string[]; emergencyStopPacketIds: string[]; blockedUnsafePacketIds: string[]; packets: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; fixtureBacked: boolean; sourceHashOnly: boolean; safeSourceHash: string; urlHash: string; policyState: string; reviewState: string; publicGraphStixEffects: { publicSearch: string; stix: string; api: string }; proxyIsolationBoundary: Record<string, boolean>; emergencyStopPropagation: { scheduler: string; evidence: string; graph: string; api: string; releaseGate: string }; operatorProofPacket: { proofCommands: string[]; forbiddenActions: string[] }; noLeakProof: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      legalEthicsAuditExport: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; thesisReady: boolean; enterpriseReady: boolean; observedScenarios: string[]; summary: { packetCount: number; blockedOperationCount: number; holdCount: number; rollbackCount: number }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; thesisReady: boolean; enterpriseReady: boolean; collected: { fields: string[]; sourceHashIds: string[]; urlHashIds: string[]; evidenceType: string }; blocked: { operations: string[]; reason: string }; approval: { approvalState: string; policyVersion: string; auditTrailIds: string[] }; whatWasNotAccessed: string[]; releaseInterpretation: string; graphStixApiEffect: { stix: string; api: string; publicSearch: string }; proofCommands: string[]; handoffs: { agent09ApiField: string }; noLeakValidation: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      auditReplay: { metadataOnly: boolean; safeForApi: boolean; observedScenarios: string[]; scenarios: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean }> };
      connectorCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; guarantees: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      connectorCertifications: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; guarantees: Record<string, boolean>; noLeakSerialization: { passed: boolean } }>;
      killSwitchDrills: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; guarantees: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      emergencyStopCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; rcGate: string; proof: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      nonBlockingSearch: { metadataOnly: boolean; safeForApi: boolean; nonBlockingPublicSearch: boolean; maxPublicSearchAddedLatencyMs: number; observedScenarios: string[]; packets: Array<{ publicSearchAction: string; proof: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      analystOperations: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; victimNotificationPacketCount: number; packets: Array<{ schedulerIsolation: { directEgressAllowed: boolean }; proof: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      agent10ReleasePacket: { runtimeProofName: string; decision: string; proofCommand: string; metadataOnly: boolean; safeForApi: boolean; enforcementLevel: string; emergencyStopState: string; governancePacketIds: string[]; auditReplayScenarios: string[]; certificationPacketIds: string[]; certificationScenarios: string[]; killSwitchDrillPacketIds: string[]; killSwitchDrillScenarios: string[]; emergencyStopCertificationPacketIds: string[]; emergencyStopCertificationScenarios: string[] };
      remediationPlan: Array<{ action: string; dryRunOnly: boolean; metadataOnly: boolean }>;
      connectorFixtures: Array<{ network: string; actor: string; victim: string; urlHash: string; metadataOnly: boolean }>;
    };
    expect(status.summary.ready).toBeGreaterThanOrEqual(1);
    expect(status.sources.find((source) => source.sourceId === "src_restricted_ready")).toMatchObject({
      endpoints: {
        intelSearchField: "/v1/intel/search.restrictedMetadata",
        statusRoute: "/v1/restricted-metadata/status"
      },
      redactionGuarantees: {
        bodyRedacted: true,
        rawUrlRedacted: true,
        fileNameRedacted: true
      },
      forbiddenActionCounters: {
        credentialBypassAttempts: 0,
        stolenFileDownloadAttempts: 0
      }
    });
    expect(status.remediationPlan.map((item) => item.action)).toEqual(expect.arrayContaining([
      "renew_approval",
      "activate_kill_switch",
      "rollback_disabled_source"
    ]));
    expect(status.operationalSla).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      metrics: {
        metadataOnlyEvidenceYield: 1
      }
    });
    expect(["pass", "warning", "breach"]).toContain(status.operationalSla.status);
    expect(status.enforcement).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      emergencyStop: {
        dryRunOnly: true
      }
    });
    expect(["pass", "warning", "hold", "emergency_stop"]).toContain(status.enforcement.level);
    expect(status.enforcement.activeRules.map((rule) => rule.rule)).toEqual(expect.arrayContaining([
      "forbidden_action_attempt_emergency_stop"
    ]));
    expect(status.enforcement.agent09WarningCodes).toContain("restricted_metadata_forbidden_action");
    expect(status.auditTrail).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      unsafeFieldsExposed: false
    });
    expect(status.auditTrail.rejectedFields).toEqual(expect.arrayContaining(["rawUrl", "body", "fileName", "objectKey", "credentials"]));
    expect(status.governancePackets.length).toBeGreaterThan(0);
    expect(status.governancePackets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.proof.noStolenFilesStored &&
      packet.proof.noRawPayloadsStored &&
      packet.redactionPolicy.rawUrlRedacted
    )).toBe(true);
    expect(status.operatorGovernance).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      operatorVisible: true
    });
    expect(status.operatorGovernance.observedScenarios).toEqual(expect.arrayContaining([
      "ransomware_leak_claim_review_hold",
      "source_quarantined_unsafe_target",
      "emergency_stop_active"
    ]));
    expect(status.operatorGovernance.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.operatorVisible &&
      packet.sourceHashOnly &&
      packet.sourceHash.length > 0 &&
      packet.policyReason.length > 0 &&
      packet.allowedActions.includes("keep_public_search_non_blocking") &&
      packet.forbiddenActions.includes("download_stolen_files") &&
      packet.graphStixApiEffect.stix === "blocked" &&
      packet.graphStixApiEffect.publicSearch === "non_blocking" &&
      packet.rollbackPath.includes("restore_review_hold") &&
      packet.auditId.startsWith("restricted-governance-audit_") &&
      packet.proofCommands.includes("bun run check:restricted-metadata-status") &&
      packet.proof.noRawOnionUrls &&
      packet.proof.noStolenFileNames &&
      packet.proof.noLeakedRows &&
      packet.proof.noCredentials &&
      packet.proof.noScreenshots &&
      packet.proof.noPrivateChannelContent &&
      packet.proof.noActorInteractionText &&
      packet.proof.metadataOnlyEvidence &&
      packet.proof.sourceHashOnly &&
      packet.noLeakSerialization.passed
    )).toBe(true);
    expect(status.darkMetadataCanary).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      fixtureBacked: true
    });
    expect(status.darkMetadataCanary.observedScenarios).toEqual(expect.arrayContaining([
      "tor_metadata_canary",
      "i2p_metadata_canary",
      "freenet_metadata_canary",
      "ransomware_leak_site_claim",
      "emergency_stop"
    ]));
    expect(status.darkMetadataCanary.networks).toEqual(expect.arrayContaining(["tor", "i2p", "freenet"]));
    expect(status.darkMetadataCanary.emergencyStopPacketIds.length).toBeGreaterThan(0);
    expect(status.darkMetadataCanary.blockedUnsafePacketIds.length).toBeGreaterThan(0);
    expect(status.darkMetadataCanary.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.fixtureBacked &&
      packet.sourceHashOnly &&
      packet.safeSourceHash.length > 0 &&
      packet.urlHash.length > 0 &&
      packet.publicGraphStixEffects.publicSearch === "non_blocking" &&
      packet.publicGraphStixEffects.stix === "blocked" &&
      packet.publicGraphStixEffects.api === "restrictedMetadata.darkMetadataCanary" &&
      packet.proxyIsolationBoundary.approvedProxyRequired &&
      packet.proxyIsolationBoundary.directEgressAllowed === false &&
      packet.proxyIsolationBoundary.credentialsAllowed === false &&
      packet.proxyIsolationBoundary.formsAllowed === false &&
      packet.proxyIsolationBoundary.captchaSolvingAllowed === false &&
      packet.proxyIsolationBoundary.privateCommunityAccessAllowed === false &&
      packet.proxyIsolationBoundary.fileDownloadsAllowed === false &&
      packet.proxyIsolationBoundary.threatActorInteractionAllowed === false &&
      packet.proxyIsolationBoundary.rawUnsafeUrlExposureAllowed === false &&
      packet.emergencyStopPropagation.scheduler === "pause_restricted_partition" &&
      packet.emergencyStopPropagation.evidence === "metadata_only_no_object_download" &&
      packet.emergencyStopPropagation.graph === "hold_restricted_edges" &&
      packet.emergencyStopPropagation.api === "safe_metadata_only" &&
      packet.operatorProofPacket.proofCommands.includes("bun run check:restricted-metadata-status") &&
      packet.operatorProofPacket.forbiddenActions.includes("download_stolen_files") &&
      packet.noLeakProof.noRawOnionUrls &&
      packet.noLeakProof.noRawUnsafeUrls &&
      packet.noLeakProof.noRawPayloads &&
      packet.noLeakProof.noStolenFileDownloads &&
      packet.noLeakProof.noCredentialValues &&
      packet.noLeakProof.noCaptchaSolving &&
      packet.noLeakProof.noPrivateAccess &&
      packet.noLeakProof.noThreatActorInteraction &&
      packet.noLeakSerialization.passed
    )).toBe(true);
    expect(status.darkMetadataCanary.packets.find((packet) => packet.scenario === "emergency_stop")).toMatchObject({
      policyState: "emergency_stop",
      reviewState: "emergency_stop",
      emergencyStopPropagation: {
        releaseGate: "rollback"
      }
    });
    expect(status.legalEthicsAuditExport).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      thesisReady: true,
      enterpriseReady: true
    });
    expect(status.legalEthicsAuditExport.observedScenarios).toEqual(expect.arrayContaining([
      "metadata_only_collection",
      "unsafe_target_blocked",
      "approval_review",
      "emergency_stop_review",
      "operator_thesis_export"
    ]));
    expect(status.legalEthicsAuditExport.summary.packetCount).toBe(status.legalEthicsAuditExport.packets.length);
    expect(status.legalEthicsAuditExport.summary.blockedOperationCount).toBeGreaterThan(0);
    expect(status.legalEthicsAuditExport.summary.holdCount).toBeGreaterThan(0);
    expect(status.legalEthicsAuditExport.summary.rollbackCount).toBeGreaterThan(0);
    expect(status.legalEthicsAuditExport.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.thesisReady &&
      packet.enterpriseReady &&
      packet.collected.fields.includes("actor") &&
      packet.collected.sourceHashIds.length > 0 &&
      packet.collected.urlHashIds.length > 0 &&
      packet.collected.evidenceType === "restricted_metadata_hashes_and_claim_fields_only" &&
      packet.blocked.operations.includes("download_stolen_files") &&
      packet.blocked.operations.includes("interact_with_threat_actor") &&
      packet.approval.policyVersion === "restricted_metadata_policy_v1" &&
      packet.approval.auditTrailIds.length > 0 &&
      packet.whatWasNotAccessed.includes("leaked rows") &&
      packet.whatWasNotAccessed.includes("credential values") &&
      packet.graphStixApiEffect.stix === "blocked" &&
      packet.graphStixApiEffect.api === "metadata_only_audit" &&
      packet.graphStixApiEffect.publicSearch === "non_blocking" &&
      packet.proofCommands.includes("bun run check:restricted-metadata-status") &&
      packet.handoffs.agent09ApiField === "restrictedMetadata.legalEthicsAuditExport" &&
      packet.noLeakValidation.noRawLeakMaterial &&
      packet.noLeakValidation.noUnsafeUrls &&
      packet.noLeakValidation.noCredentials &&
      packet.noLeakValidation.noScreenshots &&
      packet.noLeakValidation.noPayloads &&
      packet.noLeakValidation.noStolenFileNames &&
      packet.noLeakValidation.noPrivateChannelMaterial &&
      packet.noLeakValidation.noThreatActorInteraction &&
      packet.noLeakSerialization.passed
    )).toBe(true);
    expect(status.auditReplay).toMatchObject({
      metadataOnly: true,
      safeForApi: true
    });
    expect(status.auditReplay.observedScenarios).toEqual(expect.arrayContaining(["allowed_metadata_only_record", "unsafe_action_attempt"]));
    expect(status.auditReplay.scenarios.every((scenario) => scenario.metadataOnly && scenario.safeForApi)).toBe(true);
    expect(status.connectorCertification).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      noLeakSerialization: {
        passed: true
      }
    });
    expect(status.connectorCertification.observedScenarios).toEqual(expect.arrayContaining(["unsafe_link_form_download"]));
    expect(status.connectorCertification.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.noLeakSerialization.passed &&
      packet.guarantees.noContact &&
      packet.guarantees.noDownload
    )).toBe(true);
    expect(status.connectorCertifications.length).toBeGreaterThan(0);
    expect(status.killSwitchDrills).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      operatorVisible: true,
      noLeakSerialization: { passed: true }
    });
    expect(status.killSwitchDrills.observedScenarios).toEqual(expect.arrayContaining(["unsafe_download_form_contact_link", "public_api_blocked_state"]));
    expect(status.killSwitchDrills.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.operatorVisible &&
      packet.noLeakSerialization.passed &&
      packet.guarantees.noContact &&
      packet.guarantees.noDownload
    )).toBe(true);
    expect(status.emergencyStopCertification).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      noLeakSerialization: { passed: true }
    });
    expect(status.emergencyStopCertification.observedScenarios).toEqual(expect.arrayContaining(["unsafe_download_form_contact_target", "public_api_blocked_state"]));
    expect(status.emergencyStopCertification.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.rcGate === "restricted_metadata_emergency_stop_certification_rc" &&
      packet.noLeakSerialization.passed &&
      packet.proof.noUnsafeAccess &&
      packet.proof.noDataExposure &&
      packet.proof.noContact &&
      packet.proof.noDownload &&
      packet.proof.noCredentialBypass &&
      packet.proof.noCaptchaSolving &&
      packet.proof.noStealth &&
      packet.proof.noRawPayloads &&
      packet.proof.noRawUrls &&
      packet.proof.hashOnlyEvidence
    )).toBe(true);
    expect(status.agent10ReleasePacket).toMatchObject({
      runtimeProofName: "restricted_metadata_sla",
      proofCommand: "bun run check:restricted-metadata-status",
      metadataOnly: true,
      safeForApi: true,
      enforcementLevel: status.enforcement.level,
      emergencyStopState: status.enforcement.emergencyStop.state
    });
    expect(status.agent10ReleasePacket.governancePacketIds.length).toBe(status.governancePackets.length);
    expect(status.agent10ReleasePacket.auditReplayScenarios).toEqual(expect.arrayContaining(["unsafe_action_attempt"]));
    expect(status.agent10ReleasePacket.certificationPacketIds.length).toBe(status.connectorCertification.packets.length);
    expect(status.agent10ReleasePacket.certificationScenarios).toEqual(expect.arrayContaining(["unsafe_link_form_download"]));
    expect(status.agent10ReleasePacket.killSwitchDrillPacketIds.length).toBe(status.killSwitchDrills.packets.length);
    expect(status.agent10ReleasePacket.killSwitchDrillScenarios).toEqual(expect.arrayContaining(["public_api_blocked_state"]));
    expect(status.agent10ReleasePacket.emergencyStopCertificationPacketIds.length).toBe(status.emergencyStopCertification.packets.length);
    expect(status.agent10ReleasePacket.emergencyStopCertificationScenarios).toEqual(expect.arrayContaining(["public_api_blocked_state"]));
    expect(status.nonBlockingSearch).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      nonBlockingPublicSearch: true,
      maxPublicSearchAddedLatencyMs: 0
    });
    expect(status.nonBlockingSearch.observedScenarios).toEqual(expect.arrayContaining(["unsafe_target", "kill_switch", "public_api_blocked_state"]));
    expect(status.nonBlockingSearch.packets.every((packet) =>
      packet.publicSearchAction === "continue_clear_web_and_public_channel" &&
      packet.proof.doesNotBlockPublicSearch &&
      packet.proof.doesNotPromoteRestrictedFacts &&
      packet.proof.noUnsafeAccess &&
      packet.proof.noDataExposure &&
      packet.noLeakSerialization.passed
    )).toBe(true);
    expect(status.analystOperations).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true
    });
    expect(status.analystOperations.observedScenarios).toEqual(expect.arrayContaining(["approval_requested", "unsafe_download_form_contact_target", "raw_payload_blocked", "victim_notification_packet", "emergency_stop_rollback"]));
    expect(status.analystOperations.victimNotificationPacketCount).toBeGreaterThan(0);
    expect(status.analystOperations.packets.every((packet) =>
      packet.schedulerIsolation.directEgressAllowed === false &&
      packet.proof.noStolenFilesDownloaded &&
      packet.proof.noCredentials &&
      packet.proof.noAuthBypass &&
      packet.proof.noCaptchaSolving &&
      packet.proof.noPrivateAccess &&
      packet.proof.noThreatActorInteraction &&
      packet.noLeakSerialization.passed
    )).toBe(true);
    expect(status.remediationPlan.every((item) => item.dryRunOnly && item.metadataOnly)).toBe(true);
    expect(status.connectorFixtures.map((fixture) => fixture.network).sort()).toEqual(["freenet", "i2p", "tor"]);
    expect(status.connectorFixtures.every((fixture) => fixture.metadataOnly && fixture.actor && fixture.victim && fixture.urlHash)).toBe(true);
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain(".onion");
    expect(serialized).not.toContain("customer-dump");
    expect(serialized).not.toContain("user:pass");
  });

  test("routes darkweb metadata index status and search without unsafe leaks", async () => {
    const statusResponse = (await body(await handleApiRequest(api("/v1/darkweb/status"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    }))) as {
      status: {
        endpoint: string;
        metadataOnly: boolean;
        targetRecordCount: number;
        fixtureRecordCount: number;
        indexedRecordEstimate: number;
        latestRefreshRun: { dryRunOnly: boolean };
        storageReadiness: {
          migrationMode: string;
          agent06Handoff: string;
          handoff: {
            schemaVersion: string;
            migrationMode: string;
            willConnectToDatabase: boolean;
            willMutate: boolean;
            tables: Array<{ table: string; forbiddenColumns: string[] }>;
            indexes: Array<{ name: string }>;
            hashLookup: { publicLookupAllowed: boolean; operatorOnlyFutureRoute: string };
          };
        };
        sourceIngestReadiness: {
          sources: Array<{ sourceHash: string; forbiddenOperations: string[]; isolationBoundary: { payloadFollowingAllowed: boolean } }>;
          ingestPreviews: Array<{ dryRunOnly: boolean; willFetchNetwork: boolean; noFetchReasons: string[] }>;
        };
        schedulerReadiness: {
          schemaVersion: string;
          mode: string;
          willScheduleLiveWork: boolean;
          willMutateQueue: boolean;
          schedulerId: string;
          lanes: Array<{ lane: string; maxRecordsPerRun: number; action: string }>;
          noScheduleGuarantees: string[];
        };
        parserRuntimeReadiness: {
          schemaVersion: string;
          mode: string;
          willFetchNetwork: boolean;
          parserProfiles: Array<{ profile: string; blockedFields: string[] }>;
          runtime: { hostNetworkAllowed: boolean; output: string };
          blockedActions: string[];
        };
        downstreamHandoff: {
          schemaVersion: string;
          quality: {
            fixtures: Array<{ scenario: string; publicPromotionAllowed: boolean; expectedReviewState: string }>;
            releaseGate: { blocksStandaloneDarkwebClaims: boolean };
          };
          graphStix: { relationshipPolicy: string; heldEdges: string[]; stixExportDefault: string };
          apiUi: { route: string; safeActions: string[]; forbiddenActions: string[] };
          opsRunbook: { killSwitch: { flag: string }; alerts: Array<{ code: string }>; rollback: string[] };
        };
        restrictedReconciliation: {
          schemaVersion: string;
          mode: string;
          willFetchNetwork: boolean;
          willMutateSources: boolean;
          dependsOnRoutes: string[];
          auditRows: Array<{ checkId: string; blockingIfMissing: boolean }>;
          fieldMapping: { joinKeys: string[] };
          releaseGate: { restrictedApplyPlanGreenRequired: boolean; noLeakSerializationRequired: boolean };
        };
        refreshOperations: {
          schemaVersion: string;
          mode: string;
          targetRecordCount: number;
          willFetchNetwork: boolean;
          willScheduleLiveWork: boolean;
          disabledUntilApprovedHarness: boolean;
          lanes: Array<{ laneId: string; targetRecords: number; safeOutput: string }>;
          blockedActions: string[];
        };
        driftPacket: {
          schemaVersion: string;
          mode: string;
          rows: Array<{ driftType: string; evidence: { sourceHash: string; contentHash: string; rawUrlHash: string } }>;
          noLeakSerialization: { passed: boolean };
        };
        searchQuality: {
          schemaVersion: string;
          mode: string;
          languageHints: Array<{ language: string; count: number }>;
          entityExtractionConfidence: {
            actorHintCount: number;
            victimHintCount: number;
            datasetHintCount: number;
            ttpHintCount: number;
            averageConfidence: number;
          };
          blockedUnsafeEvidenceCounts: {
            payloadLike: number;
            credentialLike: number;
            privateAccessLike: number;
            actorInteractionLike: number;
          };
          publicSafeDisplayReadiness: {
            requiredWarnings: string[];
            readyCount: number;
            heldCount: number;
            blockedCount: number;
          };
        };
        tier100Product: {
          schemaVersion: string;
          tier: string;
          mode: string;
          recordGoal: number;
          producedRecordCount: number;
          sourceFamilies: Array<{ family: string; candidateCount: number; productLift: string }>;
          importOutcome: { accepted: number; duplicate: number; blocked: number; reviewNeeded: number; staleOrDead: number };
          buyerVisibleSearch: {
            usefulSummaryRate: number;
            actorHintCoverage: number;
            categoryCoverageCount: number;
            publicSearchBoostQueries: string[];
            apifyFields: string[];
          };
          tier1000AdvancementCriteria: { targetTier: string; minAcceptedRecords: number; requireNoLeakProof: boolean; requireApifySearchLift: boolean };
          safety: {
            rawUnsafeUrlsExposed: boolean;
            stolenFilesDownloaded: boolean;
            credentialsRetrieved: boolean;
            payloadsFollowed: boolean;
            privateAuthCaptchaAccess: boolean;
            actorInteraction: boolean;
          };
          noLeakSerialization: { passed: boolean };
        };
        tier1000Readiness: {
          schemaVersion: string;
          tier: string;
          mode: string;
          targetRecordCount: number;
          evaluatedRecordCount: number;
          productQualifiedRecordCount: number;
          rejectedLowValueRecordCount: number;
          sourceFamilies: Array<{ family: string; evaluatedCount: number; productQualifiedCount: number; refreshCadenceMinutes: number; averageBuyerValue: number }>;
          freshness: {
            currentEnoughCount: number;
            staleCount: number;
            deadOrUnknownCount: number;
            liveOrIntermittentRate: number;
            medianRefreshCadenceMinutes: number;
            maxAllowedStaleHours: number;
            customerFreshnessLabel: string;
          };
          searchReadiness: {
            safeSummaryCoverage: number;
            actorHintCoverage: number;
            categoryCoverageCount: number;
            sourceFamilyCoverageCount: number;
            buyerValueCoverage: number;
            apifyReadyRecordIds: string[];
            searchBoostQueries: string[];
          };
          importGate: { accepted: number; duplicate: number; blockedUnsafe: number; reviewNeeded: number; staleOrDead: number; lowBuyerValue: number; acceptanceRate: number; duplicateRate: number; blockedUnsafeRate: number };
          tier4000Planning: { targetTier: string; minProductQualifiedRecords: number; minFreshnessCurrentRate: number; maxBlockedUnsafeRate: number; requireNoLeakProof: boolean; requireActorDatasetLift: boolean };
          safety: Record<string, boolean>;
          noLeakSerialization: { passed: boolean };
        };
        tier4000Admission: {
          schemaVersion: string;
          tier: string;
          baselineTier: string;
          targetRecordCount: number;
          evaluatedCandidateCount: number;
          admittedCandidateCount: number;
          rejectedCandidateCount: number;
          admissionRules: { minBuyerValueScore: number; requiredSignals: string[]; requireApprovedMetadataOnly: boolean };
          qualityMetrics: { productQualifiedRate: number; searchHitQualityRate: number; costRiskPerUsefulMetadataRow: string };
          importRefreshGate: Record<string, boolean>;
          buyerSearchProof: { sampleSearchRows: Array<{ safeSummary: string; whyItMatters: string; provenanceHash: string; searchBoostTerms: string[] }>; activationDecision: string; blockers: string[] };
          noLeakSerialization: { passed: boolean };
        };
        tier10000RefreshValue: {
          schemaVersion: string;
          tier: string;
          baselineTier: string;
          targetRecordCount: number;
          evaluatedCandidateCount: number;
          valueQualifiedCount: number;
          rejectedLowValueCount: number;
          advancementCriteria: {
            minProductQualifiedRate: number;
            maxDuplicateRate: number;
            maxStaleRate: number;
            maxBlockedOrReviewRate: number;
            requireNoLeakProof: boolean;
          };
          refreshLanes: Array<{ family: string; cadenceMinutes: number; risk: string; expectedBuyerVisibleRowEffect: string; blockerRules: string[] }>;
          buyerSearchProof: {
            actorQueries: string[];
            victimCompanyQueries: string[];
            ransomwareGroupQueries: string[];
            datasetTypeQueries: string[];
            sectorCountryQueries: string[];
            newSinceLastRunQueries: string[];
            usefulQueryCount: number;
            sampleRows: Array<{ safeSummary: string; whyItMatters: string; provenanceHash: string; searchBoostTerms: string[] }>;
          };
          qualityMetrics: {
            searchHitQualityRate: number;
            usefulSummaryRate: number;
            currentEnoughFreshnessRate: number;
            duplicateSuppressionRate: number;
            blockedOrReviewRate: number;
            actorCoverage: number;
            victimCoverage: number;
            datasetCoverage: number;
            averageBuyerValueScore: number;
            costRiskPerUsefulMetadataRow: string;
          };
          activationDecision: string;
          blockers: string[];
          noLeakSerialization: { passed: boolean };
        };
        liveValueExpansion: {
          schemaVersion: string;
          owner: string;
          mode: string;
          willFetchNetwork: boolean;
          willScheduleLiveWork: boolean;
          sourceCountInflationBlocked: boolean;
          tiers: Array<{
            tier: string;
            targetRecordCount: number;
            evaluatedCandidateCount: number;
            valueQualifiedCandidateCount: number;
            rejectedLowValueCandidateCount: number;
            usefulRowRate: number;
            averageBuyerValueScore: number;
            staleRate: number;
            duplicateRate: number;
            blockedOrReviewRate: number;
            sampleRowsRequired: number;
            usefulQueriesRequired: number;
            advancementDecision: string;
            blockers: string[];
            candidateRows: Array<{
              recordId: string;
              safeLocatorHash: string;
              actorHints: string[];
              victimHints: string[];
              datasetHints: string[];
              sectorCountry: string;
              firstSeen: string;
              lastSeen: string;
              buyerValueScore: number;
              noLeakProof: string;
              decision: string;
              whyWorthPayingFor: string;
              rejectionReason?: string;
            }>;
            buyerSearchProof: {
              usefulQueryCount: number;
              actorQueries: string[];
              victimCompanyQueries: string[];
              ransomwareGroupQueries: string[];
              datasetTypeQueries: string[];
              sectorCountryQueries: string[];
              newSinceLastRunQueries: string[];
              sampleRows: Array<{ recordId: string; safeLocatorHash: string; noLeakProof: string; whyWorthPayingFor: string }>;
            };
          }>;
          refreshScheduleSemantics: Array<{ sourceFamily: string; cadenceMinutes: number; lastSuccessAt: string; nextDueAt: string; failureReason: string; parserFamily: string; sourceFamilyDiversityImpact: string; expectedRowsPerDay: number; approvedBoundary: string }>;
          valueGateRejects: Array<{ reason: string; rejectedCount: number; doesNotCountTowardTier: boolean }>;
          noLeakSerialization: { passed: boolean };
        };
        operatorRunbook: {
          schemaVersion: string;
          mode: string;
          isolatedCollectorPool: { enabledByDefault: boolean; approvedHarnessRequired: boolean; hostNetworkAllowed: boolean };
          proxyBoundary: { approvedProxyRequired: boolean; directEgressAllowed: boolean; networkAllowlist: string[] };
          diskBudget: { rawBodyStorageAllowed: boolean; payloadStorageAllowed: boolean };
          emergencyStop: { flag: string; publicSearchEffect: string };
          rollback: string[];
        };
      };
      contract: {
        field: string;
        routes: string[];
        targetRecordCount: number;
        safety: Record<string, boolean>;
        sourceIngest: {
          runtimeMode: string;
          sourceTypes: string[];
          approvalStates: string[];
          dedupeKeys: string[];
        };
        storageHandoff: {
          schemaVersion: string;
          tables: string[];
          indexes: string[];
          migrationMode: string;
          hashLookup: string;
        };
        schedulerParserHandoff: {
          schedulerSchemaVersion: string;
          parserSchemaVersion: string;
          schedulerMode: string;
          parserMode: string;
          schedulerId: string;
          parserProfiles: string[];
        };
        downstreamHandoff: {
          schemaVersion: string;
          qualityFixtures: string[];
          graphStixPolicy: string;
          uiRoute: string;
          opsKillSwitch: string;
        };
        restrictedReconciliation: {
          schemaVersion: string;
          mode: string;
          routeCount: number;
          releaseGate: string;
        };
        operationsModel: {
          refreshSchemaVersion: string;
          driftSchemaVersion: string;
          searchQualitySchemaVersion: string;
          operatorRunbookSchemaVersion: string;
          targetRecordCount: number;
          liveCollectionEnabled: boolean;
        };
        tier100Product: {
          schemaVersion: string;
          tier: string;
          recordGoal: number;
          advancementTarget: string;
          routeFields: string[];
          requireNoLeakProof: boolean;
        };
        tier1000Readiness: {
          schemaVersion: string;
          tier: string;
          targetRecordCount: number;
          routeFields: string[];
          requiredRecordFields: string[];
          advancementTarget: string;
          requireNoLeakProof: boolean;
        };
        tier4000Admission: {
          schemaVersion: string;
          tier: string;
          targetRecordCount: number;
          routeFields: string[];
          admissionDecisionField: string;
          requireNoLeakProof: boolean;
        };
        tier10000RefreshValue: {
          schemaVersion: string;
          tier: string;
          targetRecordCount: number;
          routeFields: string[];
          decisionField: string;
          requireNoLeakProof: boolean;
        };
        liveValueExpansion: {
          schemaVersion: string;
          tiers: string[];
          routeFields: string[];
          requiredSampleRowsPerTier: number;
          requiredUsefulQueriesPerTier: number;
          sourceCountInflationBlocked: boolean;
          requireNoLeakProof: boolean;
        };
      };
    };
    expect(statusResponse.status).toMatchObject({
      endpoint: "/v1/darkweb/status",
      metadataOnly: true,
      targetRecordCount: 60000,
      fixtureRecordCount: 100,
      indexedRecordEstimate: 60000,
      latestRefreshRun: {
        dryRunOnly: true
      },
      storageReadiness: {
        migrationMode: "contract_only",
        agent06Handoff: "darkweb_index_records_refresh_runs_classification_history"
      },
      sourceIngestReadiness: {
        collectorRuntime: {
          mode: "contract_only_no_network",
          dryRunOnly: true,
          approvedProxyRequired: true,
          hostNetworkAllowed: false,
          sharedCredentialMountAllowed: false,
          writableHostMountAllowed: false,
          quarantineArtifactDescriptorsOnly: true
        },
        dedupePlan: {
          strategy: "host_path_title_redirect_content_hash",
          mirrorPolicy: "cluster_by_hashes_without_following_redirect_payloads"
        }
      },
      noLeakSerialization: {
        passed: true
      }
    });
    expect(statusResponse.status.schedulerReadiness).toMatchObject({
      schemaVersion: "ti.darkweb_index_scheduler_handoff.v1",
      mode: "contract_only_no_worker_leases",
      willScheduleLiveWork: false,
      willMutateQueue: false,
      schedulerId: "darkweb_index_refresh"
    });
    expect(statusResponse.status.schedulerReadiness.lanes.map((lane) => lane.lane)).toEqual(expect.arrayContaining([
      "high_risk_leak_metadata",
      "standard_directory_refresh",
      "blocked_unsafe"
    ]));
    expect(statusResponse.status.schedulerReadiness.lanes.find((lane) => lane.lane === "blocked_unsafe")).toMatchObject({
      maxRecordsPerRun: 0,
      action: "skip_blocked"
    });
    expect(statusResponse.status.schedulerReadiness.noScheduleGuarantees).toEqual(expect.arrayContaining([
      "no_live_worker_leases_until_proxy_and_legal_approval",
      "no_payload_download_tasks",
      "no_threat_actor_interaction_tasks"
    ]));
    expect(statusResponse.status.parserRuntimeReadiness).toMatchObject({
      schemaVersion: "ti.darkweb_index_parser_runtime.v1",
      mode: "isolated_landing_page_metadata_parser_contract",
      willFetchNetwork: false,
      runtime: {
        hostNetworkAllowed: false,
        output: "quarantine_descriptor_only"
      }
    });
    expect(statusResponse.status.parserRuntimeReadiness.parserProfiles.map((profile) => profile.profile)).toEqual(expect.arrayContaining([
      "tor_landing_metadata",
      "directory_listing_metadata",
      "blocked_unsafe_stub"
    ]));
    expect(statusResponse.status.parserRuntimeReadiness.parserProfiles.every((profile) =>
      ["rawUrl", "body", "payloadBytes", "credentialValues", "privateMessages", "actorInteractionText"].every((field) => profile.blockedFields.includes(field))
    )).toBe(true);
    expect(statusResponse.status.parserRuntimeReadiness.blockedActions).toEqual(expect.arrayContaining([
      "stolen-file download",
      "credential dump download",
      "CAPTCHA solving",
      "threat actor interaction"
    ]));
    expect(statusResponse.status.downstreamHandoff).toMatchObject({
      schemaVersion: "ti.darkweb_index_downstream_handoff.v1",
      quality: {
        releaseGate: {
          blocksStandaloneDarkwebClaims: true
        }
      },
      graphStix: {
        relationshipPolicy: "descriptor_edges_review_hold",
        stixExportDefault: "hold_until_reviewed_and_correlated"
      },
      apiUi: {
        route: "/ti/darkweb/index"
      },
      opsRunbook: {
        killSwitch: {
          flag: "DARKWEB_INDEX_KILL_SWITCH"
        }
      }
    });
    expect(statusResponse.status.downstreamHandoff.quality.fixtures.map((fixture) => fixture.scenario)).toEqual(expect.arrayContaining([
      "benign_directory",
      "leak_claim_hold",
      "credential_abuse_block",
      "malware_payload_block"
    ]));
    expect(statusResponse.status.downstreamHandoff.quality.fixtures.filter((fixture) => fixture.publicPromotionAllowed).every((fixture) => fixture.expectedReviewState === "approved_metadata_only")).toBe(true);
    expect(statusResponse.status.downstreamHandoff.graphStix.heldEdges).toEqual(expect.arrayContaining(["victim_claim", "credential_claim", "payload_claim", "actor_statement"]));
    expect(statusResponse.status.downstreamHandoff.apiUi.safeActions).toEqual(expect.arrayContaining(["filter", "paginate", "copy_hash"]));
    expect(statusResponse.status.downstreamHandoff.apiUi.forbiddenActions).toEqual(expect.arrayContaining(["open_raw_url", "download_payload", "download_credentials", "contact_actor"]));
    expect(statusResponse.status.downstreamHandoff.opsRunbook.alerts.map((alert) => alert.code)).toEqual(expect.arrayContaining(["unsafe_action_attempt", "proxy_boundary_failure", "storage_forbidden_column"]));
    expect(statusResponse.status.downstreamHandoff.opsRunbook.rollback).toEqual(expect.arrayContaining(["pause_darkweb_index_workers", "disable_source_ingest", "rerun_no_leak_checks"]));
    expect(statusResponse.status.restrictedReconciliation).toMatchObject({
      schemaVersion: "ti.darkweb_index_restricted_reconciliation.v1",
      mode: "contract_only_audit_reconciliation",
      willFetchNetwork: false,
      willMutateSources: false,
      releaseGate: {
        restrictedApplyPlanGreenRequired: true,
        noLeakSerializationRequired: true
      }
    });
    expect(statusResponse.status.restrictedReconciliation.dependsOnRoutes).toEqual(expect.arrayContaining([
      "/v1/darkweb/status",
      "/v1/darkweb/search",
      "/v1/restricted-metadata/status",
      "/v1/restricted-metadata/apply-plan",
      "/v1/contracts"
    ]));
    expect(statusResponse.status.restrictedReconciliation.auditRows.map((row) => row.checkId)).toEqual(expect.arrayContaining([
      "darkweb_status_route_visible",
      "restricted_apply_plan_green",
      "operator_hash_lookup_only"
    ]));
    expect(statusResponse.status.restrictedReconciliation.auditRows.every((row) => row.blockingIfMissing)).toBe(true);
    expect(statusResponse.status.restrictedReconciliation.fieldMapping.joinKeys).toEqual(["rawUrlHash_to_urlHash", "sourceHash_to_sourceId_or_policyAuditId"]);
    expect(statusResponse.status.refreshOperations).toMatchObject({
      schemaVersion: "ti.darkweb_index_refresh_operations.v1",
      mode: "metadata_only_operations_model",
      targetRecordCount: 60000,
      willFetchNetwork: false,
      willScheduleLiveWork: false,
      disabledUntilApprovedHarness: true
    });
    expect(statusResponse.status.refreshOperations.lanes.map((lane) => lane.laneId)).toEqual(expect.arrayContaining([
      "tor_high_risk_refresh",
      "i2p_standard_refresh",
      "freenet_liveness_recheck",
      "directory_bulk_metadata",
      "analyst_import_review",
      "public_report_reference_import"
    ]));
    expect(statusResponse.status.refreshOperations.lanes.reduce((sum, lane) => sum + lane.targetRecords, 0)).toBe(60000);
    expect(statusResponse.status.refreshOperations.lanes.every((lane) => lane.safeOutput === "hashes_redacted_labels_and_quarantine_descriptors")).toBe(true);
    expect(statusResponse.status.refreshOperations.blockedActions).toEqual(expect.arrayContaining(["stolen-file download", "credential dump download", "threat actor interaction"]));
    expect(statusResponse.status.driftPacket).toMatchObject({
      schemaVersion: "ti.darkweb_index_liveness_classification_drift.v1",
      mode: "metadata_only_drift_rows",
      noLeakSerialization: {
        passed: true
      }
    });
    expect(statusResponse.status.driftPacket.rows.map((row) => row.driftType)).toEqual(expect.arrayContaining([
      "newly_alive",
      "newly_dead",
      "category_changed",
      "legal_risk_changed",
      "source_reputation_changed",
      "duplicate_cluster_changed",
      "review_priority_changed",
      "graph_export_hold_changed"
    ]));
    expect(statusResponse.status.driftPacket.rows.every((row) =>
      row.evidence.sourceHash.length > 0 &&
      row.evidence.contentHash.length > 0 &&
      row.evidence.rawUrlHash.length > 0
    )).toBe(true);
    expect(statusResponse.status.searchQuality).toMatchObject({
      schemaVersion: "ti.darkweb_index_search_quality.v1",
      mode: "metadata_only_quality_metrics"
    });
    expect(statusResponse.status.searchQuality.languageHints.length).toBeGreaterThan(0);
    expect(statusResponse.status.searchQuality.entityExtractionConfidence.averageConfidence).toBeGreaterThan(0);
    expect(statusResponse.status.searchQuality.publicSafeDisplayReadiness.requiredWarnings).toEqual(["metadata_only", "review_required", "blocked_unsafe", "legal_hold"]);
    expect(statusResponse.status.tier100Product).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier100_product.v1",
      tier: "tier_100",
      mode: "buyer_visible_safe_metadata",
      recordGoal: 100,
      producedRecordCount: 100,
      safety: {
        rawUnsafeUrlsExposed: false,
        stolenFilesDownloaded: false,
        credentialsRetrieved: false,
        payloadsFollowed: false,
        privateAuthCaptchaAccess: false,
        actorInteraction: false
      },
      noLeakSerialization: {
        passed: true
      }
    });
    expect(statusResponse.status.tier100Product.sourceFamilies.map((family) => family.family)).toEqual(expect.arrayContaining([
      "public_report",
      "analyst_import",
      "directory_metadata",
      "public_tracker_reference",
      "approved_seed",
      "safe_search_result"
    ]));
    expect(statusResponse.status.tier100Product.sourceFamilies.every((family) => family.candidateCount >= 0 && family.productLift.length > 0)).toBe(true);
    expect(statusResponse.status.tier100Product.importOutcome.accepted).toBeGreaterThan(0);
    expect(statusResponse.status.tier100Product.importOutcome.duplicate).toBeGreaterThan(0);
    expect(statusResponse.status.tier100Product.importOutcome.blocked).toBeGreaterThan(0);
    expect(statusResponse.status.tier100Product.importOutcome.reviewNeeded).toBeGreaterThan(0);
    expect(statusResponse.status.tier100Product.importOutcome.staleOrDead).toBeGreaterThan(0);
    expect(statusResponse.status.tier100Product.buyerVisibleSearch).toMatchObject({
      usefulSummaryRate: 1,
      categoryCoverageCount: 12,
      apifyFields: ["actorHints", "victimHints", "category", "legalTriage", "liveness", "safeSummary", "sourceFamily", "lastSeen"]
    });
    expect(statusResponse.status.tier100Product.buyerVisibleSearch.actorHintCoverage).toBeGreaterThanOrEqual(0.25);
    expect(statusResponse.status.tier100Product.buyerVisibleSearch.publicSearchBoostQueries).toEqual(expect.arrayContaining(["akira", "apt29", "apt42", "lockbit"]));
    expect(statusResponse.status.tier100Product.tier1000AdvancementCriteria).toMatchObject({
      targetTier: "tier_1000",
      minAcceptedRecords: 70,
      requireNoLeakProof: true,
      requireApifySearchLift: true
    });
    expect(statusResponse.status.tier1000Readiness).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier1000_readiness.v1",
      tier: "tier_1000",
      mode: "real_metadata_readiness_path",
      targetRecordCount: 1000,
      evaluatedRecordCount: 100,
      safety: {
        rawUnsafeUrlsExposed: false,
        stolenFilesDownloaded: false,
        credentialsRetrieved: false,
        payloadsFollowed: false,
        privateAuthCaptchaAccess: false,
        actorInteraction: false
      },
      noLeakSerialization: {
        passed: true
      }
    });
    expect(statusResponse.status.tier1000Readiness.productQualifiedRecordCount).toBeGreaterThan(0);
    expect(statusResponse.status.tier1000Readiness.rejectedLowValueRecordCount).toBeGreaterThan(0);
    expect(statusResponse.status.tier1000Readiness.sourceFamilies.map((family) => family.family)).toEqual(expect.arrayContaining([
      "public_report",
      "analyst_import",
      "directory_metadata",
      "public_tracker_reference",
      "approved_seed",
      "safe_search_result"
    ]));
    expect(statusResponse.status.tier1000Readiness.sourceFamilies.every((family) =>
      family.evaluatedCount >= 0 &&
      family.productQualifiedCount >= 0 &&
      family.refreshCadenceMinutes > 0 &&
      family.averageBuyerValue >= 0
    )).toBe(true);
    expect(statusResponse.status.tier1000Readiness.freshness).toMatchObject({
      maxAllowedStaleHours: 72,
      customerFreshnessLabel: expect.stringMatching(/fresh_enough_for_monitoring|needs_refresh_before_paid_claim/)
    });
    expect(statusResponse.status.tier1000Readiness.searchReadiness).toMatchObject({
      safeSummaryCoverage: 1,
      categoryCoverageCount: 12,
      sourceFamilyCoverageCount: 6
    });
    expect(statusResponse.status.tier1000Readiness.searchReadiness.actorHintCoverage).toBeGreaterThanOrEqual(0.25);
    expect(statusResponse.status.tier1000Readiness.searchReadiness.apifyReadyRecordIds.length).toBeGreaterThan(0);
    expect(statusResponse.status.tier1000Readiness.searchReadiness.searchBoostQueries).toEqual(expect.arrayContaining(["akira", "apt29", "apt42", "lockbit"]));
    expect(statusResponse.status.tier1000Readiness.importGate.acceptanceRate).toBeGreaterThan(0);
    expect(statusResponse.status.tier1000Readiness.importGate.duplicateRate).toBeGreaterThan(0);
    expect(statusResponse.status.tier1000Readiness.importGate.blockedUnsafe).toBe(statusResponse.status.tier100Product.importOutcome.blocked);
    expect(statusResponse.status.tier1000Readiness.tier4000Planning).toMatchObject({
      targetTier: "tier_4000",
      minProductQualifiedRecords: 720,
      minFreshnessCurrentRate: 0.55,
      maxBlockedUnsafeRate: 0.18,
      requireNoLeakProof: true,
      requireActorDatasetLift: true
    });
    expect(statusResponse.status.tier4000Admission).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier4000_admission.v1",
      tier: "tier_4000",
      baselineTier: "tier_1000",
      targetRecordCount: 4000,
      evaluatedCandidateCount: 100,
      admissionRules: {
        minBuyerValueScore: 0.66,
        requireApprovedMetadataOnly: true
      },
      importRefreshGate: {
        disposableIsolationRequired: true,
        approvedProxyRequired: true,
        rawUnsafeUrlSerializationAllowed: false,
        credentialOrPayloadCollectionAllowed: false,
        authCaptchaPrivateAccessAllowed: false,
        threatActorInteractionAllowed: false,
        rejectLowValueInsteadOfInflatingCount: true
      },
      noLeakSerialization: {
        passed: true
      }
    });
    expect(statusResponse.status.tier4000Admission.admittedCandidateCount).toBeGreaterThan(0);
    expect(statusResponse.status.tier4000Admission.rejectedCandidateCount).toBeGreaterThan(0);
    expect(statusResponse.status.tier4000Admission.qualityMetrics.productQualifiedRate).toBeGreaterThan(0);
    expect(statusResponse.status.tier4000Admission.qualityMetrics.searchHitQualityRate).toBeGreaterThan(0);
    expect(statusResponse.status.tier4000Admission.buyerSearchProof.sampleSearchRows.length).toBeGreaterThan(0);
    expect(statusResponse.status.tier4000Admission.buyerSearchProof.sampleSearchRows.every((row) =>
      row.safeSummary.length >= 80 &&
      row.searchBoostTerms.length > 0 &&
      row.whyItMatters.includes("without exposing raw locations") &&
      row.provenanceHash.length > 0
    )).toBe(true);
    expect(statusResponse.status.tier4000Admission.buyerSearchProof.activationDecision).toBe("hold_for_value_density");
    expect(statusResponse.status.tier10000RefreshValue).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier10000_refresh_value.v1",
      tier: "tier_10000",
      baselineTier: "tier_4000",
      targetRecordCount: 10000,
      evaluatedCandidateCount: 100,
      advancementCriteria: {
        minProductQualifiedRate: 0.72,
        maxDuplicateRate: 0.16,
        maxStaleRate: 0.28,
        maxBlockedOrReviewRate: 0.18,
        requireNoLeakProof: true
      },
      activationDecision: "hold_for_value_density",
      noLeakSerialization: {
        passed: true
      }
    });
    expect(statusResponse.status.tier10000RefreshValue.refreshLanes.map((lane) => lane.family)).toEqual(expect.arrayContaining([
      "public_report",
      "analyst_import",
      "directory_metadata",
      "public_tracker_reference",
      "approved_seed",
      "safe_search_result"
    ]));
    expect(statusResponse.status.tier10000RefreshValue.buyerSearchProof.actorQueries).toEqual(expect.arrayContaining(["akira", "apt29", "apt42", "lockbit"]));
    expect(statusResponse.status.tier10000RefreshValue.buyerSearchProof.usefulQueryCount).toBeGreaterThan(0);
    expect(statusResponse.status.tier10000RefreshValue.buyerSearchProof.sampleRows.every((row) =>
      row.safeSummary.length >= 80 &&
      row.searchBoostTerms.length > 0 &&
      row.provenanceHash.length > 0 &&
      row.whyItMatters.includes("without exposing raw locations")
    )).toBe(true);
    expect(statusResponse.status.tier10000RefreshValue.blockers).toEqual(expect.arrayContaining(["reject_low_value_candidates_before_count_expansion"]));
    expect(statusResponse.status.liveValueExpansion).toMatchObject({
      schemaVersion: "ti.darkweb_index_live_value_expansion.v1",
      owner: "Agent 05",
      mode: "metadata_only_ready_to_import_value_expansion",
      willFetchNetwork: false,
      willScheduleLiveWork: false,
      sourceCountInflationBlocked: true,
      noLeakSerialization: {
        passed: true
      }
    });
    expect(statusResponse.status.liveValueExpansion.tiers.map((tier) => tier.tier)).toEqual(["tier_1000", "tier_4000"]);
    expect(statusResponse.status.liveValueExpansion.tiers.every((tier) =>
      tier.candidateRows.length >= 12 &&
      tier.buyerSearchProof.sampleRows.length === 12 &&
      tier.buyerSearchProof.usefulQueryCount >= 20 &&
      tier.sampleRowsRequired === 12 &&
      tier.usefulQueriesRequired === 20 &&
      tier.advancementDecision === "hold_for_value_density" &&
      tier.rejectedLowValueCandidateCount > tier.valueQualifiedCandidateCount &&
      tier.blockers.includes("stale_duplicate_or_review_rows_do_not_count_toward_tier") &&
      tier.candidateRows.every((row) =>
        row.safeLocatorHash.length > 0 &&
        row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials" &&
        row.whyWorthPayingFor.includes("without exposing raw locations") &&
        row.firstSeen.length > 0 &&
        row.lastSeen.length > 0
      )
    )).toBe(true);
    expect(statusResponse.status.liveValueExpansion.refreshScheduleSemantics).toHaveLength(6);
    expect(statusResponse.status.liveValueExpansion.refreshScheduleSemantics.every((schedule) =>
      schedule.cadenceMinutes > 0 &&
      schedule.lastSuccessAt.length > 0 &&
      schedule.nextDueAt.length > 0 &&
      schedule.expectedRowsPerDay > 0 &&
      schedule.approvedBoundary === "metadata_only_no_network_in_this_contract"
    )).toBe(true);
    expect(statusResponse.status.liveValueExpansion.valueGateRejects.map((row) => row.reason)).toEqual(expect.arrayContaining([
      "duplicate",
      "stale_mirror",
      "generic_listing",
      "no_actor_victim_dataset_hint",
      "unsafe_output_risk",
      "review_or_legal_hold",
      "auth_captcha_private_dependency",
      "low_buyer_value"
    ]));
    expect(statusResponse.status.liveValueExpansion.valueGateRejects.every((row) => row.doesNotCountTowardTier)).toBe(true);
    expect(statusResponse.status.operatorRunbook).toMatchObject({
      schemaVersion: "ti.darkweb_index_operator_runbook.v1",
      mode: "operator_controls_no_live_collection",
      isolatedCollectorPool: {
        enabledByDefault: false,
        approvedHarnessRequired: true,
        hostNetworkAllowed: false
      },
      proxyBoundary: {
        approvedProxyRequired: true,
        directEgressAllowed: false,
        networkAllowlist: ["tor", "i2p", "freenet"]
      },
      diskBudget: {
        rawBodyStorageAllowed: false,
        payloadStorageAllowed: false
      },
      emergencyStop: {
        flag: "DARKWEB_INDEX_KILL_SWITCH",
        publicSearchEffect: "non_blocking_existing_metadata_only_search"
      }
    });
    expect(statusResponse.status.operatorRunbook.rollback).toEqual(expect.arrayContaining(["pause_darkweb_index_workers", "clear_pending_refresh_queue", "rerun_no_leak_checks"]));
    expect(statusResponse.status.storageReadiness.handoff).toMatchObject({
      schemaVersion: "ti.darkweb_index_storage_handoff.v1",
      migrationMode: "contract_only_no_database_connection",
      willConnectToDatabase: false,
      willMutate: false,
      hashLookup: {
        publicLookupAllowed: false,
        operatorOnlyFutureRoute: "/v1/darkweb/hash-lookup"
      }
    });
    expect(statusResponse.status.storageReadiness.handoff.tables.map((table) => table.table)).toEqual(expect.arrayContaining([
      "darkweb_index_records",
      "darkweb_index_sources",
      "darkweb_index_refresh_runs",
      "darkweb_index_classification_history"
    ]));
    expect(statusResponse.status.storageReadiness.handoff.tables.every((table) =>
      ["raw_url", "body", "payload", "credential", "private_message", "actor_interaction"].every((column) => table.forbiddenColumns.includes(column))
    )).toBe(true);
    expect(statusResponse.status.storageReadiness.handoff.indexes.map((index) => index.name)).toEqual(expect.arrayContaining([
      "darkweb_index_hash_lookup",
      "darkweb_index_safe_summary_text_idx"
    ]));
    expect(statusResponse.contract).toMatchObject({
      field: "darkwebIndex",
      routes: expect.arrayContaining(["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts"]),
      targetRecordCount: 60000,
      safety: {
        metadataOnly: true,
        isolatedCollectorOnly: true,
        noPayloadFollowing: true,
        noCredentialDownloads: true,
        noPrivateAccess: true,
        noCaptchaSolving: true,
        noThreatActorInteraction: true,
        noRawUnsafeUrlPublicOutput: true
      }
    });
    expect(statusResponse.contract.storageHandoff).toMatchObject({
      schemaVersion: "ti.darkweb_index_storage_handoff.v1",
      tables: expect.arrayContaining(["darkweb_index_records", "darkweb_index_sources", "darkweb_index_refresh_runs"]),
      indexes: expect.arrayContaining(["darkweb_index_hash_lookup", "darkweb_index_category_liveness_review_idx"]),
      migrationMode: "contract_only_no_database_connection",
      hashLookup: "operator_only_future_route"
    });
    expect(statusResponse.contract.schedulerParserHandoff).toMatchObject({
      schedulerSchemaVersion: "ti.darkweb_index_scheduler_handoff.v1",
      parserSchemaVersion: "ti.darkweb_index_parser_runtime.v1",
      schedulerMode: "contract_only_no_worker_leases",
      parserMode: "isolated_landing_page_metadata_parser_contract",
      schedulerId: "darkweb_index_refresh",
      parserProfiles: expect.arrayContaining(["tor_landing_metadata", "blocked_unsafe_stub"])
    });
    expect(statusResponse.contract.downstreamHandoff).toMatchObject({
      schemaVersion: "ti.darkweb_index_downstream_handoff.v1",
      qualityFixtures: expect.arrayContaining(["quality_benign_directory", "quality_leak_claim_hold"]),
      graphStixPolicy: "descriptor_edges_review_hold",
      uiRoute: "/ti/darkweb/index",
      opsKillSwitch: "DARKWEB_INDEX_KILL_SWITCH"
    });
    expect(statusResponse.contract.restrictedReconciliation).toMatchObject({
      schemaVersion: "ti.darkweb_index_restricted_reconciliation.v1",
      mode: "contract_only_audit_reconciliation",
      routeCount: 5,
      releaseGate: "restricted_apply_plan_and_no_leak_required"
    });
    expect(statusResponse.contract.operationsModel).toMatchObject({
      refreshSchemaVersion: "ti.darkweb_index_refresh_operations.v1",
      driftSchemaVersion: "ti.darkweb_index_liveness_classification_drift.v1",
      searchQualitySchemaVersion: "ti.darkweb_index_search_quality.v1",
      operatorRunbookSchemaVersion: "ti.darkweb_index_operator_runbook.v1",
      targetRecordCount: 60000,
      liveCollectionEnabled: false
    });
    expect(statusResponse.contract.tier100Product).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier100_product.v1",
      tier: "tier_100",
      recordGoal: 100,
      advancementTarget: "tier_1000",
      routeFields: ["status.tier100Product", "darkwebIndex.productHandoff"],
      requireNoLeakProof: true
    });
    expect(statusResponse.contract.tier1000Readiness).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier1000_readiness.v1",
      tier: "tier_1000",
      targetRecordCount: 1000,
      routeFields: ["status.tier1000Readiness", "darkwebIndex.productHandoff"],
      advancementTarget: "tier_4000",
      requireNoLeakProof: true
    });
    expect(statusResponse.contract.tier1000Readiness.requiredRecordFields).toEqual(expect.arrayContaining([
      "safeSummary",
      "category",
      "liveness",
      "actorHints",
      "victimHints",
      "sourceFamily",
      "legalTriage",
      "lastSeen",
      "provenanceHash",
      "buyerValue"
    ]));
    expect(statusResponse.contract.tier4000Admission).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier4000_admission.v1",
      tier: "tier_4000",
      targetRecordCount: 4000,
      routeFields: ["status.tier4000Admission", "darkwebIndex.productHandoff.buyerSearchRows"],
      admissionDecisionField: "buyerSearchProof.activationDecision",
      requireNoLeakProof: true
    });
    expect(statusResponse.contract.tier10000RefreshValue).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier10000_refresh_value.v1",
      tier: "tier_10000",
      targetRecordCount: 10000,
      routeFields: ["status.tier10000RefreshValue", "darkwebIndex.productHandoff.tier10000SearchProof"],
      decisionField: "activationDecision",
      requireNoLeakProof: true
    });
    expect(statusResponse.contract.liveValueExpansion).toMatchObject({
      schemaVersion: "ti.darkweb_index_live_value_expansion.v1",
      tiers: ["tier_1000", "tier_4000"],
      routeFields: ["status.liveValueExpansion", "darkwebIndex.productHandoff.liveValueExpansion", "ops.productSlo.darkMetadataLiveValueExpansion"],
      requiredSampleRowsPerTier: 12,
      requiredUsefulQueriesPerTier: 20,
      sourceCountInflationBlocked: true,
      requireNoLeakProof: true
    });
    expect(statusResponse.contract.sourceIngest).toMatchObject({
      runtimeMode: "contract_only_no_network",
      sourceTypes: expect.arrayContaining(["directory", "seed_list", "analyst_import", "public_report"]),
      approvalStates: expect.arrayContaining(["approved_metadata_only", "pending_legal_review", "disabled_kill_switch", "blocked_unsafe"]),
      dedupeKeys: expect.arrayContaining(["rawUrlHash", "hostHash", "pathHash", "titleHash", "contentHash", "sourceHash"])
    });
    expect(statusResponse.status.sourceIngestReadiness.sources.every((source: { sourceHash: string; forbiddenOperations: string[]; isolationBoundary: { payloadFollowingAllowed: boolean } }) =>
      source.sourceHash.length > 0 &&
      source.forbiddenOperations.includes("threat actor interaction") &&
      source.isolationBoundary.payloadFollowingAllowed === false
    )).toBe(true);
    expect(statusResponse.status.sourceIngestReadiness.ingestPreviews.every((preview: { dryRunOnly: boolean; willFetchNetwork: boolean; noFetchReasons: string[] }) =>
      preview.dryRunOnly &&
      preview.willFetchNetwork === false &&
      preview.noFetchReasons.includes("synthetic_preview_no_network")
    )).toBe(true);

    const searchResponse = await body(await handleApiRequest(api("/v1/darkweb/search?q=akira&network=tor&limit=5"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    }));
    const darkwebIndex = searchResponse.darkwebIndex as {
      metadataOnly: boolean;
      query: { q?: string; network?: string; limit: number };
      records: Array<{
        id: string;
        network: string;
        redactedDisplayUrl: string;
        rawUrlHash: string;
        hostHash: string;
        pathHash: string;
        actorHints: string[];
        isolationBoundary: Record<string, boolean>;
        whatWasNotAccessed: string[];
      }>;
      uiContract: { route: string };
      productHandoff: {
        tier: string;
        nextTier: string;
        apifyReadyFields: string[];
        buyerValueFields: string[];
        freshnessFields: string[];
        publicSearchUse: string;
        recordIds: string[];
        tier1000ReadyRecordIds: string[];
        buyerSearchRows: Array<{ recordId: string; safeSummary: string; sourceFamily: string; refreshCadenceMinutes: number; buyerValueScore: number; whyItMatters: string; provenanceHash: string }>;
        tier10000SearchProof: { actorQueries: string[]; usefulQueryCount: number; sampleRows: Array<{ recordId: string; provenanceHash: string; whyItMatters: string }> };
        liveValueExpansion: { schemaVersion: string; sourceCountInflationBlocked: boolean; tiers: Array<{ tier: string; candidateRows: unknown[]; buyerSearchProof: { usefulQueryCount: number; sampleRows: unknown[] }; advancementDecision: string }> };
        warnings: string[];
      };
      noLeakSerialization: { passed: boolean };
    };
    expect(darkwebIndex).toMatchObject({
      metadataOnly: true,
      query: {
        q: "akira",
        network: "tor",
        limit: 5
      },
      uiContract: {
        route: "/ti/darkweb/index"
      },
      productHandoff: {
        tier: "tier_100",
        nextTier: "tier_1000",
        publicSearchUse: "corroborating_metadata_context_only",
        warnings: ["metadata_only", "review_required", "no_raw_locations"]
      },
      noLeakSerialization: {
        passed: true
      }
    });
    expect(darkwebIndex.records.length).toBeGreaterThan(0);
    expect(darkwebIndex.records.length).toBeLessThanOrEqual(5);
    expect(darkwebIndex.productHandoff.apifyReadyFields).toEqual(["actorHints", "victimHints", "category", "legalTriage", "liveness", "safeSummary", "sourceFamily", "lastSeen"]);
    expect(darkwebIndex.productHandoff.buyerValueFields).toEqual(["buyerValueScore", "whyItMatters", "freshness", "sourceFamily", "provenanceHash"]);
    expect(darkwebIndex.productHandoff.freshnessFields).toEqual(["lastSeen", "lastChecked", "liveness", "refreshCadenceMinutes"]);
    expect(darkwebIndex.productHandoff.recordIds).toEqual(darkwebIndex.records.map((record) => record.id));
    expect(darkwebIndex.productHandoff.tier1000ReadyRecordIds.every((recordId) => darkwebIndex.productHandoff.recordIds.includes(recordId))).toBe(true);
    expect(darkwebIndex.productHandoff.buyerSearchRows).toHaveLength(darkwebIndex.records.length);
    expect(darkwebIndex.productHandoff.buyerSearchRows.every((row) =>
      row.recordId.length > 0 &&
      row.safeSummary.length >= 80 &&
      row.sourceFamily.length > 0 &&
      row.refreshCadenceMinutes > 0 &&
      row.buyerValueScore >= 0 &&
      row.whyItMatters.includes("without exposing raw locations") &&
      row.provenanceHash.length > 0
    )).toBe(true);
    expect(darkwebIndex.productHandoff.tier10000SearchProof.actorQueries).toEqual(expect.arrayContaining(["akira", "apt29", "apt42", "lockbit"]));
    expect(darkwebIndex.productHandoff.tier10000SearchProof.usefulQueryCount).toBeGreaterThan(0);
    expect(darkwebIndex.productHandoff.tier10000SearchProof.sampleRows.length).toBeGreaterThan(0);
    expect(darkwebIndex.productHandoff.tier10000SearchProof.sampleRows.every((row) =>
      row.recordId.length > 0 &&
      row.provenanceHash.length > 0 &&
      row.whyItMatters.includes("without exposing raw locations")
    )).toBe(true);
    expect(darkwebIndex.productHandoff.liveValueExpansion).toMatchObject({
      schemaVersion: "ti.darkweb_index_live_value_expansion.v1",
      sourceCountInflationBlocked: true
    });
    expect(darkwebIndex.productHandoff.liveValueExpansion.tiers.every((tier) =>
      tier.candidateRows.length >= 12 &&
      tier.buyerSearchProof.usefulQueryCount >= 20 &&
      tier.buyerSearchProof.sampleRows.length === 12 &&
      tier.advancementDecision === "hold_for_value_density"
    )).toBe(true);
    expect(darkwebIndex.records.every((record) =>
      record.network === "tor" &&
      record.actorHints.includes("akira") &&
      record.redactedDisplayUrl.includes("host-") &&
      record.rawUrlHash.length > 0 &&
      record.hostHash.length > 0 &&
      record.pathHash.length > 0 &&
      record.isolationBoundary.sharedCredentialsAllowed === false &&
      record.isolationBoundary.payloadFollowingAllowed === false &&
      record.isolationBoundary.credentialDumpDownloadsAllowed === false &&
      record.isolationBoundary.malwareExecutionAllowed === false &&
      record.isolationBoundary.privateAccessAllowed === false &&
      record.isolationBoundary.captchaSolvingAllowed === false &&
      record.isolationBoundary.threatActorInteractionAllowed === false &&
      record.isolationBoundary.rawUnsafeUrlPublicOutputAllowed === false &&
      record.whatWasNotAccessed.includes("credential values") &&
      record.whatWasNotAccessed.includes("threat actor communications")
    )).toBe(true);

    const serialized = JSON.stringify({ statusResponse, searchResponse }).toLowerCase();
    for (const forbidden of ["http://", "https://", ".onion", ".i2p", "password=", "cookie=", "authorization:", "customer-dump", "private message transcript", "actor-interaction text"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test("routes restricted metadata nested apply-plan and rejects invalid actions", async () => {
    const store = new InMemoryScraperStore();
    for (const item of apiRestrictedMetadataApplyPlanSources()) store.saveSource(item);

    const nested = await body(await handleApiRequest(api("/v1/sources/src_restricted_ready/restricted-metadata/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: ["enable_metadata_only_queue"] })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(nested.applyPlan).toMatchObject({
      summary: {
        automation_safe: 1,
        human_approval_required: 0,
        blocked: 0,
        rollback_only: 0
      },
      actions: [{
        sourceId: "src_restricted_ready",
        action: "enable_metadata_only_queue",
        safety: "automation_safe"
      }]
    });

    const invalid = await handleApiRequest(api("/v1/restricted-metadata/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: ["download_payload"] })
    }), {
      store,
      frontier: new FocusedFrontier()
    });
    const payload = await body(invalid);
    expect(invalid.status).toBe(400);
    expect(payload).toMatchObject({
      error: {
        code: "invalid_action",
        message: "Unsupported restricted-metadata apply-plan action",
        details: {
          invalidActions: ["download_payload"],
          allowedActions: expect.arrayContaining(["enable_metadata_only_queue", "keep_source_blocked", "apply_kill_switch"])
        }
      }
    });
  });

  test("mounted restricted metadata apply-plan endpoints prove all statuses without unsafe leaks", async () => {
    const store = new InMemoryScraperStore();
    for (const item of apiRestrictedMetadataApplyPlanSources()) store.saveSource(item);
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
    const post = async (path: string, payload: Record<string, unknown>) => {
      const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      return { response, payload: await response.json() as Record<string, unknown> };
    };

    try {
      const all = await post("/v1/restricted-metadata/apply-plan", {
        retentionExpiringWithinDays: 7,
        includeCutover: true
      });
      expect(all.response.status).toBe(200);
      const allApplyPlan = all.payload.applyPlan as {
        actions: Array<{ action: string; sourceId: string; safety: string; prohibitedAlternatives: string[]; proof: Record<string, unknown> }>;
        agent09PolicyStatusFields: string[];
        agent10KillSwitchRollback: string[];
      };
      const allCutover = all.payload.cutoverReport as {
        agent09: { statuses: Record<string, number> };
      };
      expect(allCutover.agent09.statuses).toMatchObject({
        disabled: 1,
        pending_approval: 1,
        ready_metadata_only: expect.any(Number),
        blocked_unsafe_target: 1,
        kill_switch_active: 1,
        retention_expiring: 1,
        audit_clean: expect.any(Number)
      });
      expect(allApplyPlan.actions.map((item) => item.action)).toEqual(expect.arrayContaining([
        "enable_metadata_only_queue",
        "renew_legal_notes",
        "keep_source_blocked",
        "apply_kill_switch",
        "disable_source",
        "shorten_retention"
      ]));
      expect(allApplyPlan.agent09PolicyStatusFields).toEqual(expect.arrayContaining(["ready_metadata_only", "blocked_unsafe_target", "kill_switch_active"]));
      expect(allApplyPlan.agent10KillSwitchRollback).toEqual(expect.arrayContaining(["pause_restricted_metadata_workers"]));

      const nested = await post("/v1/sources/src_restricted_ready/restricted-metadata/apply-plan", {
        actions: ["enable_metadata_only_queue"]
      });
      expect(nested.response.status).toBe(200);
      expect(nested.payload.applyPlan).toMatchObject({
        summary: {
          automation_safe: 1,
          human_approval_required: 0,
          blocked: 0,
          rollback_only: 0
        },
        actions: [{
          sourceId: "src_restricted_ready",
          action: "enable_metadata_only_queue",
          safety: "automation_safe"
        }]
      });

      const invalid = await post("/v1/restricted-metadata/apply-plan", {
        actions: ["solve_captcha_then_download"]
      });
      expect(invalid.response.status).toBe(400);
      expect(invalid.payload).toMatchObject({
        error: {
          code: "invalid_action",
          details: { invalidActions: ["solve_captcha_then_download"] }
        }
      });

      for (const action of allApplyPlan.actions) {
        expect(action.prohibitedAlternatives).toEqual(expect.arrayContaining([
          "payload download remains prohibited",
          "credential or authentication bypass remains prohibited",
          "CAPTCHA solving remains prohibited",
          "private community access remains prohibited",
          "threat actor interaction remains prohibited",
          "unsafe restricted URLs remain redacted to hashes"
        ]));
        expect(action.proof).toMatchObject({
          exposesRawUrl: false,
          allowsPayloadDownload: false,
          allowsAuthBypass: false,
          allowsCaptchaSolving: false,
          allowsPrivateCommunityAccess: false,
          allowsThreatActorInteraction: false
        });
      }
      const serialized = JSON.stringify({ all, nested, invalid });
      expect(serialized).not.toContain("http://");
      expect(serialized).not.toContain(".onion");
      expect(serialized).not.toContain("user:pass");
      expect(serialized).not.toContain("customer-dump");
      expect(serialized).not.toContain("raw leak");
    } finally {
      server.stop();
    }
  });

  test("returns frozen scheduler apply-plan contract without mutating frontier state", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const hotSource = source({ id: "src_scheduler_hot", tags: ["apt29"] });
    store.saveSource(hotSource);
    for (let index = 0; index < 24; index += 1) {
      frontier.add({
        source: hotSource,
        tenantId: "tenant_scheduler",
        intelRequestId: `request_scheduler_${Math.floor(index / 4)}`,
        url: `https://scheduler.example.test/${index}`,
        discoveredAt: "2026-01-01T00:00:00.000Z",
        anchorText: "APT29 public ti background sweep",
        parentRelevance: 0.9,
        novelty: 0.8,
        freshness: 0.7,
        fairnessKey: "background:scheduler-hot"
      });
    }
    const beforeQueued = frontier.snapshot().map((item) => item.task.id).sort();
    const beforeLeased = frontier.leasedSnapshot().map((task) => task.id).sort();
    const response = await body(await handleApiRequest(api("/v1/frontier/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenario: "api_scheduler_contract",
        includeExecutionPreview: true,
        workerUtilization: 0.96,
        dbConnectionUtilization: 0.91,
        maxApiP95QueueAgeSeconds: 120
      })
    }), { store, frontier }));
    const afterQueued = frontier.snapshot().map((item) => item.task.id).sort();
    const afterLeased = frontier.leasedSnapshot().map((task) => task.id).sort();
    const contract = response.contract as {
      endpoint: string;
      mode: string;
      response: { actions: string[]; forbiddenMutationFields: string[] };
      examples: Array<{ name: string }>;
    };
    const applyPlan = response.applyPlan as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willLeaseTasks: boolean;
      willAcknowledgeTasks: boolean;
      willChangeRuns: boolean;
      summary: { stepCount: number };
      executionPreview: { willMutate: boolean; steps: Array<{ wouldApply: boolean }> };
      promotionPacketLink: { field: string };
    };

    expect(contract.endpoint).toBe("/v1/frontier/apply-plan");
    expect(contract.mode).toBe("dry_run");
    expect(contract.response.actions).toContain("trigger_emergency_brake");
    expect(contract.response.forbiddenMutationFields).toContain("cursorPayload");
    expect(contract.examples.map((example) => example.name)).toEqual([
      "expired_lease_release",
      "abandoned_run_cancel",
      "transient_requeue",
      "low_priority_deferral",
      "noisy_source_pause",
      "quarantine_recommendation",
      "emergency_brake"
    ]);
    for (const example of contract.examples as unknown as Array<{
      response: {
        willMutate: boolean;
        willLeaseTasks: boolean;
        willAcknowledgeTasks: boolean;
        willChangeRuns: boolean;
        item: {
          execution: string;
          riskClass: string;
          preconditions: string[];
          expectedQueueRunDelta: { cursorReplayState: string };
          rollback: string;
        };
      };
    }>) {
      expect(example.response).toMatchObject({
        willMutate: false,
        willLeaseTasks: false,
        willAcknowledgeTasks: false,
        willChangeRuns: false
      });
      expect(["automation_safe", "human_approval_required", "blocked", "rollback_only"]).toContain(example.response.item.execution);
      expect(["low", "medium", "high", "emergency"]).toContain(example.response.item.riskClass);
      expect(example.response.item.preconditions.length).toBeGreaterThan(0);
      expect(example.response.item.expectedQueueRunDelta.cursorReplayState).toBe("preserved");
      expect(example.response.item.rollback.length).toBeGreaterThan(0);
    }
    expect(applyPlan.endpoint).toBe("/v1/frontier/apply-plan");
    expect(applyPlan.dryRun).toBe(true);
    expect(applyPlan.willMutate).toBe(false);
    expect(applyPlan.willLeaseTasks).toBe(false);
    expect(applyPlan.willAcknowledgeTasks).toBe(false);
    expect(applyPlan.willChangeRuns).toBe(false);
    expect(applyPlan.summary.stepCount).toBeGreaterThan(0);
    expect(applyPlan.executionPreview.willMutate).toBe(false);
    expect(applyPlan.executionPreview.steps.every((step) => step.wouldApply === false)).toBe(true);
    expect(applyPlan.promotionPacketLink.field).toBe("schedulerApplyPlanId");
    expect(afterQueued).toEqual(beforeQueued);
    expect(afterLeased).toEqual(beforeLeased);
    expect(JSON.stringify(response.applyPlan)).not.toContain("dbTransaction");
    expect(JSON.stringify(response.applyPlan)).not.toContain("cursorPayload");
  });

  test("rejects invalid scheduler apply-plan actions without mutating frontier state", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const activeSource = source({ id: "src_invalid_scheduler_action" });
    store.saveSource(activeSource);
    frontier.add({
      source: activeSource,
      tenantId: "tenant_scheduler",
      intelRequestId: "request_invalid_action",
      url: "https://scheduler.example.test/invalid-action",
      discoveredAt: "2026-01-01T00:00:00.000Z",
      anchorText: "APT29 scheduler invalid action fixture",
      parentRelevance: 0.9,
      novelty: 0.8,
      freshness: 0.7
    });
    const beforeQueued = frontier.snapshot().map((item) => item.task.id).sort();
    const response = await handleApiRequest(api("/v1/frontier/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selectedActions: ["mutate_queue_now"] })
    }), { store, frontier });
    const payload = await body(response);

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: {
        code: "invalid_action",
        message: "selectedActions contains unsupported frontier apply actions",
        details: {
          invalid: ["mutate_queue_now"],
          allowed: expect.arrayContaining(["release_expired_leases", "trigger_emergency_brake"])
        }
      }
    });
    expect(frontier.snapshot().map((item) => item.task.id).sort()).toEqual(beforeQueued);
    expect(frontier.leasedSnapshot()).toEqual([]);
  });

  test("smokes mounted scheduler apply-plan endpoint for normal degraded emergency and invalid requests", async () => {
    const scenarios: Array<{
      name: string;
      queued: number;
      ageSeconds: number;
      request: Record<string, unknown>;
      status: number;
      expectedAction?: string;
      expectedError?: string;
    }> = [
      { name: "normal", queued: 2, ageSeconds: 5, request: { scenario: "normal", includeExecutionPreview: true }, status: 200 },
      { name: "degraded", queued: 24, ageSeconds: 45, request: { scenario: "degraded", includeExecutionPreview: true, workerUtilization: 0.9 }, status: 200, expectedAction: "pause_noisy_source_queues" },
      { name: "emergency_brake", queued: 24, ageSeconds: 14_400, request: { scenario: "emergency_brake", includeExecutionPreview: true, workerUtilization: 0.96, dbConnectionUtilization: 0.92, maxApiP95QueueAgeSeconds: 120 }, status: 200, expectedAction: "trigger_emergency_brake" },
      { name: "invalid_action", queued: 1, ageSeconds: 5, request: { selectedActions: ["mutate_queue_now"] }, status: 400, expectedError: "invalid_action" }
    ];

    for (const scenario of scenarios) {
      const store = new InMemoryScraperStore();
      const frontier = new FocusedFrontier();
      const activeSource = source({ id: `src_mounted_${scenario.name}` });
      store.saveSource(activeSource);
      const queuedAt = new Date(Date.now() - scenario.ageSeconds * 1000).toISOString();
      for (let index = 0; index < scenario.queued; index += 1) {
        frontier.add({
          source: activeSource,
          tenantId: "tenant_mounted_scheduler",
          intelRequestId: `request_mounted_${scenario.name}_${Math.floor(index / 4)}`,
          url: `https://scheduler.example.test/${scenario.name}/${index}`,
          discoveredAt: queuedAt,
          anchorText: "APT29 mounted endpoint proof",
          parentRelevance: 0.9,
          novelty: 0.8,
          freshness: 0.8,
          fairnessKey: scenario.name === "normal" ? "interactive:mounted" : "background:mounted"
        });
      }
      const beforeQueued = frontier.snapshot().map((item) => item.task.id).sort();
      const beforeLeased = frontier.leasedSnapshot().map((task) => task.id).sort();
      const beforeRuns = store.listRuns().map((run) => `${run.id}:${run.status}:${run.updatedAt}`).sort();
      const server = startApiServer({ port: 0, store, frontier });
      try {
        const response = await fetch(`http://127.0.0.1:${server.port}/v1/frontier/apply-plan`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(scenario.request)
        });
        const payload = await response.json() as {
          applyPlan?: {
            dryRun: boolean;
            willMutate: boolean;
            items: Array<{ action: string; expectedQueueRunDelta: { cursorReplayState: string } }>;
            executionPreview?: { willMutate: boolean; steps: Array<{ wouldApply: boolean }> };
            emergencyBrake: { preservesCursorReplayState: boolean };
          };
          error?: { code: string };
        };

        expect(response.status).toBe(scenario.status);
        if (scenario.status === 200) {
          expect(payload.applyPlan).toMatchObject({
            dryRun: true,
            willMutate: false,
            emergencyBrake: { preservesCursorReplayState: true }
          });
          expect(payload.applyPlan?.executionPreview?.willMutate).toBe(false);
          expect(payload.applyPlan?.executionPreview?.steps.every((step) => step.wouldApply === false)).toBe(true);
          expect(payload.applyPlan?.items.every((item) => item.expectedQueueRunDelta.cursorReplayState === "preserved")).toBe(true);
          if (scenario.expectedAction) {
            expect(payload.applyPlan?.items.map((item) => item.action)).toContain(scenario.expectedAction);
          }
        } else {
          expect(payload.error?.code).toBe(scenario.expectedError);
        }
      } finally {
        server.stop();
      }
      expect(frontier.snapshot().map((item) => item.task.id).sort()).toEqual(beforeQueued);
      expect(frontier.leasedSnapshot().map((task) => task.id).sort()).toEqual(beforeLeased);
      expect(store.listRuns().map((run) => `${run.id}:${run.status}:${run.updatedAt}`).sort()).toEqual(beforeRuns);
    }
  });

  test("returns frozen source apply-plan contract without mutating sources or crawling", async () => {
    const store = new InMemoryScraperStore();
    const reviewedAt = new Date().toISOString();
    const candidate = source({ id: "src_source_apply_candidate", status: "candidate", tenantId: "tenant_source_apply", tags: ["apt29"], url: "https://candidate.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt } });
    const unhealthy = source({
      id: "src_source_apply_unhealthy",
      status: "active",
      tenantId: "tenant_source_apply",
      tags: ["apt29"],
      url: "https://unhealthy.example.test/feed",
      metadata: { legalNotesReviewedAt: reviewedAt },
      health: { status: "failing", consecutiveFailures: 5, errorRate: 0.9 }
    });
    const duplicateA = source({ id: "src_source_apply_duplicate_a", url: "https://duplicate.example.test/feed", tenantId: "tenant_source_apply", tags: ["apt29"], metadata: { legalNotesReviewedAt: reviewedAt } });
    const duplicateB = source({ id: "src_source_apply_duplicate_b", url: "https://duplicate.example.test/feed", tenantId: "tenant_source_apply", tags: ["apt29"], metadata: { legalNotesReviewedAt: reviewedAt } });
    for (const item of [candidate, unhealthy, duplicateA, duplicateB]) store.saveSource(item);
    const before = store.listSources().map((item) => `${item.id}:${item.status}`).sort();

    const response = await body(await handleApiRequest(api("/v1/sources/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_apply" },
      body: JSON.stringify({
        queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
        sourcePackIds: ["safe-public-cti-starter-pack"],
        selectedActions: ["approve", "quarantine", "retire", "request_legal_notes", "leave_unchanged"],
        includeExecutionPreview: true
      })
    }), { store, frontier: new FocusedFrontier() }));
    const after = store.listSources().map((item) => `${item.id}:${item.status}`).sort();
    const contract = response.contract as {
      endpoint: string;
      mode: string;
      response: { actions: string[]; forbiddenMutationFields: string[] };
      examples: Array<{ name: string }>;
    };
    const applyPlan = response.applyPlan as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willStartCrawling: boolean;
      approvalSummary: { approvalsRequired: number; rollbackOnly: number };
      items: Array<{ action: string; collectionImpact: { willStartCrawling: boolean }; automation: string }>;
      executionPreview: { dryRun: boolean; executed: boolean; itemResults: Array<{ reason: string }> };
      promotionPacketLink: { field: string };
      schemaExamples: Array<{ name: string; response: { willMutate: boolean; willStartCrawling: boolean } }>;
    };

    expect(contract.endpoint).toBe("/v1/sources/apply-plan");
    expect(contract.mode).toBe("dry_run");
    expect(contract.response.actions).toEqual(expect.arrayContaining(["approve", "quarantine", "retire", "request_legal_notes"]));
    expect(contract.response.forbiddenMutationFields).toEqual(expect.arrayContaining(["updatedSource", "startedCrawl", "restrictedActivation"]));
    expect(contract.examples.map((example) => example.name)).toEqual(expect.arrayContaining([
      "happy_path",
      "human_approval_required",
      "blocked_restricted_source",
      "duplicate_source",
      "stale_legal_notes",
      "rollback_only_quarantine"
    ]));
    expect(applyPlan.endpoint).toBe("/v1/sources/apply-plan");
    expect(applyPlan.dryRun).toBe(true);
    expect(applyPlan.willMutate).toBe(false);
    expect(applyPlan.willStartCrawling).toBe(false);
    expect(applyPlan.approvalSummary.approvalsRequired).toBeGreaterThanOrEqual(0);
    expect(applyPlan.approvalSummary.rollbackOnly).toBeGreaterThan(0);
    expect(applyPlan.items.every((item) => item.collectionImpact.willStartCrawling === false)).toBe(true);
    expect(applyPlan.items.map((item) => item.action)).toEqual(expect.arrayContaining(["approve", "quarantine"]));
    expect(applyPlan.executionPreview.dryRun).toBe(true);
    expect(applyPlan.executionPreview.executed).toBe(false);
    expect(applyPlan.executionPreview.itemResults.every((item) => item.reason.includes("Dry-run") || item.reason.includes("blocked"))).toBe(true);
    expect(applyPlan.promotionPacketLink.field).toBe("sourceApplyPlanId");
    expect(applyPlan.schemaExamples.every((example) => example.response.willMutate === false && example.response.willStartCrawling === false)).toBe(true);
    expect(after).toEqual(before);
  });

  test("source apply-plan route blocks restricted auto-activation and rejects invalid actions", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_route_restricted",
      name: "Restricted Route Source",
      type: "tor_metadata",
      url: "http://restricted-route.onion",
      accessMethod: "approved_proxy",
      risk: "restricted",
      status: "approved",
      tenantId: "tenant_restricted_route",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: "2026-05-24T00:00:00.000Z",
        approvedBy: "legal",
        policyVersion: "collection-policy:v1"
      },
      metadata: { legalNotesReviewedAt: new Date().toISOString() },
      tags: ["apt29"]
    }));

    const restricted = await body(await handleApiRequest(api("/v1/sources/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_restricted_route" },
      body: JSON.stringify({
        queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
        sourcePackIds: [],
        selectedActions: ["activate", "quarantine", "request_legal_notes"],
        includeExecutionPreview: true
      })
    }), { store, frontier: new FocusedFrontier() }));
    const applyPlan = restricted.applyPlan as {
      willMutate: boolean;
      willStartCrawling: boolean;
      items: Array<{
        action: string;
        automation: string;
        policyImpact: { metadataOnlyRequired: boolean };
        collectionImpact: { enablesCollection: boolean; remainsDisabled: string[] };
      }>;
    };

    expect(applyPlan.willMutate).toBe(false);
    expect(applyPlan.willStartCrawling).toBe(false);
    expect(applyPlan.items.some((item) => item.action === "activate" && item.collectionImpact.enablesCollection)).toBe(false);
    expect(applyPlan.items.some((item) => item.policyImpact.metadataOnlyRequired)).toBe(true);
    expect(applyPlan.items.flatMap((item) => item.collectionImpact.remainsDisabled)).toEqual(expect.arrayContaining([
      "restricted raw payload collection",
      "automatic restricted-source activation"
    ]));

    const invalidResponse = await handleApiRequest(api("/v1/sources/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        queryScope: { queries: ["APT29"] },
        selectedActions: ["launch_crawler"]
      })
    }), { store, frontier: new FocusedFrontier() });
    const invalid = await body(invalidResponse);
    expect(invalidResponse.status).toBe(400);
    expect(invalid.error).toMatchObject({ code: "invalid_action" });
  });

  test("smokes mounted source apply-plan endpoint for happy restricted and invalid proof cases", async () => {
    const reviewedAt = new Date().toISOString();
    const scenarios: Array<{
      name: "happy_path" | "blocked_restricted_source" | "invalid_action";
      sources: SourceRecord[];
      request: Record<string, unknown>;
      headers?: Record<string, string>;
      status: number;
      expectedError?: string;
    }> = [
      {
        name: "happy_path",
        sources: [
          source({ id: "src_mounted_source_candidate", status: "candidate", tenantId: "tenant_mounted_source", tags: ["apt29"], url: "https://candidate-mounted.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt } }),
          source({ id: "src_mounted_source_unhealthy", status: "active", tenantId: "tenant_mounted_source", tags: ["apt29"], url: "https://unhealthy-mounted.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt }, health: { status: "failing", consecutiveFailures: 5, errorRate: 0.9 } }),
          source({ id: "src_mounted_source_duplicate_a", tenantId: "tenant_mounted_source", tags: ["apt29"], url: "https://duplicate-mounted.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt } }),
          source({ id: "src_mounted_source_duplicate_b", tenantId: "tenant_mounted_source", tags: ["apt29"], url: "https://duplicate-mounted.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt } })
        ],
        request: {
          queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
          sourcePackIds: ["safe-public-cti-starter-pack"],
          selectedActions: ["approve", "quarantine", "retire", "request_legal_notes", "leave_unchanged"],
          includeExecutionPreview: true
        },
        headers: { "x-tenant-id": "tenant_mounted_source" },
        status: 200
      },
      {
        name: "blocked_restricted_source",
        sources: [
          source({
            id: "src_mounted_source_restricted",
            name: "Mounted Restricted Source",
            type: "tor_metadata",
            url: "http://restricted-mounted.onion",
            accessMethod: "approved_proxy",
            risk: "restricted",
            status: "approved",
            tenantId: "tenant_mounted_restricted",
            governance: {
              approvalRequired: true,
              approvalState: "approved",
              metadataOnly: true,
              approvedAt: "2026-05-24T00:00:00.000Z",
              approvedBy: "legal",
              policyVersion: "collection-policy:v1"
            },
            metadata: { legalNotesReviewedAt: reviewedAt },
            tags: ["apt29"]
          })
        ],
        request: {
          queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
          selectedActions: ["activate", "quarantine", "request_legal_notes"],
          includeExecutionPreview: true
        },
        headers: { "x-tenant-id": "tenant_mounted_restricted" },
        status: 200
      },
      {
        name: "invalid_action",
        sources: [source({ id: "src_mounted_source_invalid", tenantId: "tenant_mounted_invalid", tags: ["apt29"] })],
        request: {
          queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
          selectedActions: ["launch_crawler"]
        },
        headers: { "x-tenant-id": "tenant_mounted_invalid" },
        status: 400,
        expectedError: "invalid_action"
      }
    ];

    for (const scenario of scenarios) {
      const store = new InMemoryScraperStore();
      for (const item of scenario.sources) store.saveSource(item);
      const frontier = new FocusedFrontier();
      const beforeSources = store.listSources().map((item) => `${item.id}:${item.status}:${item.updatedAt}`).sort();
      const beforeQueued = frontier.snapshot().map((item) => item.task.id).sort();
      const beforeLeased = frontier.leasedSnapshot().map((task) => task.id).sort();
      const server = startApiServer({ port: 0, store, frontier });
      try {
        const response = await fetch(`http://127.0.0.1:${server.port}/v1/sources/apply-plan`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(scenario.headers ?? {}) },
          body: JSON.stringify(scenario.request)
        });
        const payload = await response.json() as {
          contract?: { endpoint: string; response: { forbiddenMutationFields: string[] } };
          applyPlan?: {
            dryRun: boolean;
            willMutate: boolean;
            willStartCrawling: boolean;
            items: Array<{
              action: string;
              automation: string;
              collectionImpact: { willStartCrawling: boolean; enablesCollection: boolean; remainsDisabled: string[] };
            }>;
            executionPreview?: { dryRun: boolean; executed: boolean; itemResults: Array<{ wouldApply: boolean }> };
          };
          error?: { code: string };
        };
        const serialized = JSON.stringify(payload);

        expect(response.status).toBe(scenario.status);
        if (scenario.status === 200) {
          expect(payload.contract).toMatchObject({
            endpoint: "/v1/sources/apply-plan",
            response: {
              forbiddenMutationFields: expect.arrayContaining(["updatedSource", "startedCrawl", "dbTransaction", "restrictedActivation"])
            }
          });
          expect(payload.applyPlan).toMatchObject({
            dryRun: true,
            willMutate: false,
            willStartCrawling: false
          });
          expect(payload.applyPlan?.items.every((item) => item.collectionImpact.willStartCrawling === false)).toBe(true);
          expect(payload.applyPlan?.executionPreview?.dryRun).toBe(true);
          expect(payload.applyPlan?.executionPreview?.executed).toBe(false);
          if (scenario.name === "happy_path") {
            expect(payload.applyPlan?.items.map((item) => item.action)).toEqual(expect.arrayContaining(["approve", "quarantine"]));
            expect(payload.applyPlan?.items.map((item) => item.automation)).toContain("rollback_only");
          }
          if (scenario.name === "blocked_restricted_source") {
            expect(payload.applyPlan?.items.some((item) => item.action === "activate" && item.collectionImpact.enablesCollection)).toBe(false);
            expect(payload.applyPlan?.items.flatMap((item) => item.collectionImpact.remainsDisabled)).toEqual(expect.arrayContaining([
              "restricted raw payload collection",
              "automatic restricted-source activation"
            ]));
          }
        } else {
          expect(payload.error?.code).toBe(scenario.expectedError);
        }

        const applyPlanSerialized = JSON.stringify(payload.applyPlan ?? {});
        expect(applyPlanSerialized).not.toContain("startedCrawl");
        expect(applyPlanSerialized).not.toContain("updatedSource");
        expect(applyPlanSerialized).not.toContain("reviewDecisionApplied");
        expect(applyPlanSerialized).not.toContain("dbTransaction");
        expect(applyPlanSerialized).not.toContain("restrictedActivation");
      } finally {
        server.stop();
      }
      expect(store.listSources().map((item) => `${item.id}:${item.status}:${item.updatedAt}`).sort()).toEqual(beforeSources);
      expect(frontier.snapshot().map((item) => item.task.id).sort()).toEqual(beforeQueued);
      expect(frontier.leasedSnapshot().map((task) => task.id).sort()).toEqual(beforeLeased);
    }
  });

  test("routes source coverage-plan and exposes compact intel search source coverage", async () => {
    const bundle = await Bun.file("seeds/public_cti_starter_pack.json").json();
    const store = new InMemoryScraperStore();
    const active = source({
      id: "src_coverage_active_apt29",
      name: "Active APT29 coverage",
      tenantId: "tenant_source_coverage",
      status: "active",
      tags: ["apt29"],
      metadata: { legalNotesReviewedAt: new Date().toISOString() },
      catalog: {
        canonicalId: "coverage:active:apt29",
        publisher: { name: "Coverage Active", trustBasis: "vendor" },
        tier: "tier_1",
        approvalScope: "safe_public_auto",
        license: "Public fixture.",
        legalBasis: "Public fixture.",
        reliability: 0.9,
        intelligenceValue: 0.9,
        retentionClass: "standard",
        coverage: {
          topics: ["actor", "threat-report"],
          actors: ["APT29"],
          aliases: ["Midnight Blizzard"],
          industries: ["government"],
          regions: ["Europe"],
          countries: ["Norway"],
          languages: ["en"],
          queryPatterns: ["APT29"]
        },
        collection: { freshnessTargetSeconds: 21600, collectionSlaSeconds: 21600, budgetClass: "normal", crawlCadenceSeconds: 21600 },
        adapterCompatibility: ["rss"],
        rollback: {}
      }
    });
    store.saveSource(active);
    const options = {
      store,
      frontier: new FocusedFrontier(),
      sourcePacks: [bundle]
    };

    const response = await body(await handleApiRequest(api("/v1/sources/coverage-plan", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_coverage" },
      body: JSON.stringify({
        queries: ["APT29", "MuddyWater", "FIN7", "unknown actor"],
        sourcePackIds: ["safe-public-cti-starter-pack"]
      })
    }), options));
    const coverage = response as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willStartCrawling: boolean;
      queries: Array<{
        query: string;
        coverageState: string;
        slo: { status: string; actuals: { activeSafePublicSources: number; excludedUnsafeSourceIds: string[] }; failures: string[] };
        drift: Array<{ code: string; recommendedAction: string }>;
        portfolio: { familyGroups: Array<{ key: string }>; actorGroups: Array<{ key: string }>; legalReviewAgeGroups: Array<{ key: string }> };
        activationBatch: { status: string; sources: Array<{ sourceId: string; safePublic: boolean; parserCompatible: boolean }>; schedulerCost: { estimatedTasksPerDay: number }; runtimeSla: { status: string; summary: { releaseHold: boolean } }; executionReadiness: { canarySourceIds: string[]; rolloutSourceIds: string[]; promotionImpact: { agent06EvidenceCertification: { certificationState: string } } } };
        runtimeSla: { status: string; summary: { apiImpact: string; releaseHold: boolean }; sourceFamilyGate: { status: string }; promotionGate: { decision: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean }; remediation: Array<{ action: string }> };
        coverageCloseout: { readiness: string; queryClass: string; plannedSafePublicSourceCount: number; activationWaveIds: string[]; executionPacket: { rolloutSourceIds: string[]; promotionImpact: { agent10Decision: { field: string } } } };
        executionReadiness: { coverageReady: boolean; rolloutSourceIds: string[]; promotionImpact: { agent09ContractIndex: { field: string } } };
        activeSources: Array<{ sourceId: string }>;
        eligibleSources: Array<{ sourceId: string }>;
        selectedSources: Array<{ sourceId: string }>;
        missingApprovedPublicSources: Array<{ sourceId: string }>;
        missingVerticals: Array<{ vertical: string }>;
        safeSourcePackRecommendations: Array<{ sourceId: string; requiredAction: string }>;
      }>;
      slo: { status: string; failed: number };
      drift: Array<{ code: string; query?: string }>;
      governanceDrift: Array<{ code: string; sourceId: string }>;
      remediationPlans: Array<{ action: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean }>;
      forbiddenSourceClasses: string[];
      sourcePackInstallPlans: Array<{ willStartCrawling: boolean }>;
    };
    const intel = await body(await handleApiRequest(api("/v1/intel/search?q=MuddyWater&entityType=actor", {
      headers: { "x-tenant-id": "tenant_source_coverage" }
    }), options));
    const intelCoverage = intel.sourceCoverage as {
      query: string;
      coverageState: string;
      slo: { status: string; failures: string[]; actuals: { activeSafePublicSources: number } };
      drift: Array<{ code: string }>;
      portfolio: { familyGroups: Array<{ key: string }>; actorGroups: Array<{ key: string }> };
      activationBatch: { dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; sources: Array<{ sourceId: string }>; executionReadiness: { rolloutSourceIds: string[]; promotionImpact: { publicTiAnswerEffect: string } } };
      runtimeSla: { dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; summary: { apiImpact: string }; promotionGate: { decision: string; agent10ReleaseDecision: { field: string; releaseImpact: string } } };
      coverageCloseout: { readiness: string; activationWaveIds: string[]; promotionImpact: { agent10: string }; executionPacket: { canarySourceIds: string[]; rolloutSourceIds: string[]; promotionImpact: { agent09ContractIndex: { field: string } } } };
      executionReadiness: { dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; rolloutSourceIds: string[]; promotionImpact: { agent06EvidenceCertification: { certificationState: string } } };
      eligibleSources: Array<{ sourceId: string }>;
      selectedSources: Array<{ sourceId: string }>;
      safeSourcePackRecommendations: Array<{ sourceId: string }>;
      missingVerticals: Array<{ vertical: string }>;
    };
    const portfolioResponse = await body(await handleApiRequest(api("/v1/sources/portfolio", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_coverage" },
      body: JSON.stringify({
        queries: ["APT29", "MuddyWater", "FIN7", "unknown actor"],
        sourcePackIds: ["safe-public-cti-starter-pack"]
      })
    }), options)) as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willStartCrawling: boolean;
      portfolio: { familyGroups: Array<{ key: string }>; legalReviewAgeGroups: Array<{ key: string }> };
      queries: Array<{ query: string; actorGroups: Array<{ key: string }> }>;
      reliabilityEconomics: { schemaVersion: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; summary: { sourceCount: number; activationWaveReady: number }; sources: Array<{ decision: string; handoffs: { agent02SchedulerPriority: string; agent09ApiContract: string }; guardrails: { noLeakedDataAccess: boolean } }>; governance: { noSilentActivation: boolean; restrictedSourcesMetadataOnly: boolean } };
      tenantActivation: {
      schemaVersion: string;
      dryRun: boolean;
      willMutate: boolean;
      willStartCrawling: boolean;
      tenantId: string;
        guardrails: { noSilentActivation: boolean; noCrawlingFromApprovalPackets: boolean; noRestrictedAutoActivation: boolean; noRawUnsafeUrls: boolean; dryRunOnly: boolean };
        approvalPackets: Array<{ dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; sourceId: string; decision: string; sourceClass: string; approvalRequired: boolean; routeHint: string }>;
        tenantIsolation: Array<{ tenantId: string; crossTenantSourcesExcluded: boolean }>;
        handoffs: { agent09ApiContracts: string[] };
      };
      sourceImportCanary: {
        schemaVersion: string;
        dryRun: boolean;
        willMutate: boolean;
        willImportSourcePacks: boolean;
        willStartCrawling: boolean;
        tenantId: string;
        summary: { first10Count: number; first50Count: number; releaseDecision: string; restrictedMetadataHoldCount: number };
        first10SourceRollout: Array<{ sourceId: string; canaryOrder?: number; sourceHash: string; rollbackPlanId: string }>;
        first50SourceRollout: Array<{ sourceId: string; sourceHash: string }>;
        activationResults: Array<{ dimension: string; key: string; decision: string; nextAction: string }>;
        fixtures: Array<{ fixtureClass: string; metadataOnly: boolean }>;
        lifecycle: { restrictedMetadataHoldPropagation: { routeHint: string; dryRun: boolean; willMutate: boolean }; duplicateSuppression: { dryRun: boolean; willMutate: boolean } };
        rollbackPlans: Array<{ rollbackPlanId: string; owner: string }>;
        guardrails: { noSilentActivation: boolean; noSourcePackImport: boolean; noCrawlingFromCanary: boolean; noUnsafeRawUrls: boolean; restrictedMetadataOnly: boolean };
        handoffs: { agent09ApiContracts: string[]; agent10ReleaseRollback: string[] };
      };
      onboardingPlans: Array<{ dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; schedulerCost: { estimatedTasksPerDay: number } }>;
      burnDown: Array<{ query: string; sourceAdditions: string[] }>;
      promotionPacket: { field: string; gate: string };
    };
    const marketplaceResponse = await body(await handleApiRequest(api("/v1/sources/marketplace", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_coverage" },
      body: JSON.stringify({
        queries: ["APT29", "Akira ransomware victims", "CVE-2024-1234"]
      })
    }), options)) as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willStartCrawling: boolean;
      marketplace: { sourceCount: number; safePublicSourceCount: number; sourceFamilies: string[]; sources: Array<{ activationReadiness: string; parserSupported: boolean; schedulerCost: { estimatedDailyTasks: number } }> };
      parserCapabilityMatrix: Array<{ profile: string; supported: boolean; activationBlockedUntilSupported: boolean; compatibleSourceCount: number }>;
      activationReadiness: { readyForDryRun: number; needsParserSupport: number; blockedUnsafe: number };
      unsupportedSourceClasses: Array<{ sourceClass: string; activationAllowed: boolean }>;
      governance: { noSilentActivation: boolean; noCrawlingFromMarketplace: boolean };
    };
    const atlasResponse = await body(await handleApiRequest(api("/v1/sources/atlas", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_coverage" },
      body: JSON.stringify({
        queries: ["APT29", "Akira ransomware victims", "CVE-2024-1234", "Norway"],
        recordLimit: 500
      })
    }), options)) as {
      endpoint: string;
      schemaVersion: string;
      dryRun: boolean;
      willMutate: boolean;
      willImportSourcePacks: boolean;
      willStartCrawling: boolean;
      tenantId: string;
      summary: { recordCount: number; syntheticScaleCandidateCount: number; first100Count: number; first1000Count: number; readyForDryRun: number };
      records: Array<{ id: string; family: string; sourceValueScore: number; parserCapability: { certificationRequired: boolean }; activationReadiness: { state: string; autoActivationAllowed: boolean }; safety: { publicOnly: boolean; privateInviteAuthCaptcha: boolean; rawPayloadTarget: boolean; autoActivate: boolean } }>;
      importPlans: Array<{ label: string; sourceCount: number; sourceIds: string[]; dryRun: boolean; willMutate: boolean; willImportSourcePacks: boolean; willStartCrawling: boolean; approvalPacket: { forbiddenActions: string[] }; rollbackPacket: { rollbackPlanId: string } }>;
      coverageMatrix: Array<{ queryClass: string; candidateSourceCount: number; downstreamPublicAnswerImpact: number }>;
      publicMonitorSourceGapHandoff: { schemaVersion: string; consumer: string; dryRun: boolean; willMutate: boolean; willImportSourcePacks: boolean; willStartCrawling: boolean; summary: { queryCount: number; recommendedCandidateCount: number }; queryRows: Array<{ query: string; publicMonitorState: string; recommendedAtlasSourceIds: string[]; candidateSourceCount: number; schedulerDryRun: { duplicateRunReuse: boolean }; noLeakBoundary: { metadataOnly: boolean; rawContentIncluded: boolean; unsafeUrlsIncluded: boolean; sourceActivationApplied: boolean } }>; guardrails: { noSourceActivation: boolean; noCrawling: boolean; noRawContent: boolean }; handoffs: { agent09PublicMonitorApi: string[] } };
      lifecycleReview: { schemaVersion: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; summary: { reviewedSourceCount: number; retirementReviewCount: number }; rows: Array<{ atlasSourceId: string; sourceHash: string; recommendedAction: string; schedulerDryRun: { willLeaseWork: boolean }; noMutationBoundary: { sourceStatusChanged: boolean; registryWritePlanned: boolean; crawlEnqueued: boolean; sourceDeleted: boolean } }>; guardrails: { noRegistryMutation: boolean; noSourceDeletion: boolean; noCrawling: boolean; noSilentRetirement: boolean; noSilentQuarantine: boolean }; handoffs: { agent09ApiUi: string[] } };
      sourceEconomics: {
        schemaVersion: string;
        dryRun: boolean;
        willMutate: boolean;
        willImportSourcePacks: boolean;
        willStartCrawling: boolean;
        rolloutScenarios: Array<{ label: string; sourceCount: number; selectedSourceIds: string[]; expectedUniqueEvidenceItemsPerDay: number; estimatedStorageMbPerDay: number; estimatedDailySchedulerTasks: number; estimatedCostUnitsPerUsefulEvidence: number; noActivationBoundary: { sourceActivationApplied: boolean; registryMutationPlanned: boolean; crawlEnqueued: boolean; workerLeaseCreated: boolean } }>;
        sourceRows: Array<{ atlasSourceId: string; sourceHash: string; decision: string; uniqueEvidenceYield: number; expectedApiActorUsefulness: number; expectedPublicTiAnswerLift: number; economicsScore: number }>;
        familyMetrics: Array<{ sourceCount: number; estimatedStorageMbPerDay: number; estimatedDailySchedulerTasks: number; topSourceIds: string[] }>;
        marketplaceValueBreakdown: Record<string, number>;
        degradationQueues: Array<{ queue: string; willMutate: boolean; willStartCrawling: boolean }>;
        guardrails: { noRegistryMutation: boolean; noSourceActivation: boolean; noCrawling: boolean; noWorkerLeases: boolean; noRawUnsafeUrls: boolean; noPayloadDownloads: boolean };
        handoffs: { agent09ApiFrontend: string[] };
      };
	      activationCanary: {
	        first100SourceIds: string[];
	        first1000SourceIds: string[];
	        descriptorOnlySourceIds: string[];
	        dryRun: boolean;
	        willMutate: boolean;
	        willStartCrawling: boolean;
	        registryActivationHandoff: {
	          routeHint: string;
	          dryRun: boolean;
	          willMutate: boolean;
	          willImportSourcePacks: boolean;
	          willStartCrawling: boolean;
	          approvalRequired: boolean;
	          sourceRegistryMutationAllowed: boolean;
	          candidateCount: number;
	          canarySourceIds: string[];
	          proposedSourceRecords: Array<{ proposedSourceId: string; statusPreview: string; metadata: { provenance: string; sourceHash: string }; governance: { autoActivationAllowed: boolean } }>;
	          schedulerPreview: { owner: string; queuePartition: string; leaseMode: string; estimatedDailyTasks: number };
	          prerequisites: string[];
	          forbiddenOperations: string[];
	          downstreamHandoffs: { agent09ApiContract: string[]; agent10ReleaseGate: string[] };
	        };
	      };
      discoveryInputs: Array<{ method: string }>;
      guardrails: { publicOnly: boolean; noPrivateInviteAuthCaptcha: boolean; noSilentActivation: boolean; noSourcePackImport: boolean; noCrawlingFromAtlas: boolean };
      handoffs: { agent03ParserCertification: string[]; agent09ApiContracts: string[]; agent10ReleaseGates: string[] };
    };
    const atlasExportResponse = await body(await handleApiRequest(api("/v1/sources/atlas/export", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_coverage" },
      body: JSON.stringify({
        queries: ["APT29", "Akira ransomware victims", "CVE-2024-1234"],
        planLabel: "first_100",
        recordLimit: 500
      })
    }), options)) as {
      endpoint: string;
      schemaVersion: string;
      dryRun: boolean;
      willMutate: boolean;
      willImportSourcePacks: boolean;
      willStartCrawling: boolean;
      tenantId: string;
      requestedPlan: string;
      summary: { plannedSourceCount: number; manifestRowCount: number; stagedForCanary: number; descriptorOnlyHolds: number };
      reviewQueue: Array<{ decision: string; approvalRoute: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean }>;
      exportManifest: { rows: Array<{ sourceHash: string; approvalRequired: boolean; autoActivationAllowed: boolean }> };
      approvalPacket: { forbiddenActions: string[] };
      rollbackPacket: { rollbackPlanId: string };
      guardrails: { noManifestImport: boolean; explicitApprovalRequired: boolean; noSilentActivation: boolean };
      handoffs: { agent01RegistryImport: string[]; agent09ApiContracts: string[] };
    };
    const activationBatchResponse = await body(await handleApiRequest(api("/v1/sources/activation-batches", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_coverage" },
      body: JSON.stringify({
        queries: ["APT29", "MuddyWater", "FIN7", "unknown actor"],
        sourcePackIds: ["safe-public-cti-starter-pack"]
      })
    }), options)) as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willStartCrawling: boolean;
      queries: Array<{ query: string; sources: Array<{ sourceId: string; safePublic: boolean; adapterOwner: string; parserOwner: string; expectedCadenceSeconds: number }>; blockedUnsafeSourceIds: string[]; executionReadiness: { canarySourceIds: string[]; rolloutSourceIds: string[] } }>;
      forbiddenSourceClasses: string[];
      executionReadiness: { first10Canary: unknown[]; publicRollout50: unknown[]; parserGapHandoff: { owner: string; sourceIds: string[] }; queueBudgetImpact: { owner: string; withinBudget: boolean }; rolloutPromotion: { first10CanarySourceIds: string[]; publicRollout50SourceIds: string[]; costControls: { owner: string; state: string }; agent10CanaryReleaseDecision: { field: string; releaseDecision: string } }; agent10ReleasePacket: { field: string; decision: string } };
    };
    const runtimeSlaResponse = await body(await handleApiRequest(api("/v1/sources/runtime-sla", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_coverage" },
      body: JSON.stringify({
        queries: ["APT29", "MuddyWater", "FIN7", "unknown actor"]
      })
    }), options)) as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willStartCrawling: boolean;
      queries: Array<{ query: string; status: string; summary: { apiImpact: string; releaseHold: boolean }; remediation: Array<{ action: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean }> }>;
      rollup: { status: string; releaseHold: boolean };
      releasePacket: { gate: string; decision: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean };
    };
    const closeoutResponse = await body(await handleApiRequest(api("/v1/sources/coverage-closeout", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_coverage" },
      body: JSON.stringify({
        queries: ["APT29", "Akira ransomware victims", "CVE-2024-1234", "Operation Dream Job campaign", "campaign infrastructure"]
      })
    }), options)) as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willStartCrawling: boolean;
      activationWaves: Array<{ category: string; sourceCount: number; sources: Array<{ approvalScope: string; parserCompatible: boolean }> }>;
      executionReadiness: { first10Canary: Array<{ canaryOrder?: number; parserOwner: string }>; publicRollout50: Array<{ legalReviewAgeDays: number; robotsReviewAgeDays: number | "not_required" }>; excludedSources: Array<{ excludedClass: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean }>; coverageByQueryClass: Array<{ queryClass: string; sourceCount: number }>; sourceRetirement: { candidates: string[] }; duplicateSuppression: { duplicateSourceIds: string[] }; parserGapHandoff: { owner: string; sourceIds: string[] }; queueBudgetImpact: { owner: string; withinBudget: boolean }; rolloutPromotion: { coverageImpacts: Array<{ queryClass: string; publicTiAnswerEffect: string; agent02SchedulerTelemetry: { budgetState: string }; agent06EvidenceCertification: { certificationState: string }; agent07PollingState: { state: string }; agent09ContractIndex: { field: string }; agent10Decision: { field: string } }>; postCanaryMonitoring: Array<{ owner: string }>; agent10CanaryReleaseDecision: { releaseDecision: string } }; agent10ReleasePacket: { field: string; decision: string } };
      summary: { safePublicActivationSourceCount: number };
      releasePacket: { gate: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; agent10ExecutionField: string };
    };

    expect(coverage.endpoint).toBe("/v1/sources/coverage-plan");
    expect(coverage.dryRun).toBe(true);
    expect(coverage.willMutate).toBe(false);
    expect(coverage.willStartCrawling).toBe(false);
    expect(coverage.queries.find((query) => query.query === "APT29")?.activeSources.map((source) => source.sourceId)).toEqual([
      "src_coverage_active_apt29"
    ]);
    expect(coverage.queries.find((query) => query.query === "APT29")?.eligibleSources.map((source) => source.sourceId)).toContain("src_coverage_active_apt29");
    expect(coverage.queries.find((query) => query.query === "APT29")?.selectedSources.map((source) => source.sourceId)).toContain("src_coverage_active_apt29");
    expect(coverage.queries.find((query) => query.query === "APT29")?.coverageState).toBe("needs_review");
    expect(coverage.queries.find((query) => query.query === "APT29")?.portfolio.actorGroups.map((group) => group.key)).toContain("APT29");
    expect(coverage.queries.find((query) => query.query === "MuddyWater")?.activationBatch.sources.map((source) => source.sourceId)).toContain("src_seed_eset_welivesecurity");
    expect(coverage.queries.find((query) => query.query === "APT29")?.runtimeSla.status).toBe("breach");
    expect(coverage.queries.find((query) => query.query === "APT29")?.runtimeSla.promotionGate.dryRun).toBe(true);
    expect(coverage.queries.find((query) => query.query === "APT29")?.coverageCloseout.plannedSafePublicSourceCount).toBeGreaterThan(0);
    expect(coverage.queries.find((query) => query.query === "APT29")?.coverageCloseout.executionPacket.rolloutSourceIds.length).toBeGreaterThan(0);
    expect(coverage.queries.find((query) => query.query === "APT29")?.coverageCloseout.executionPacket.promotionImpact.agent10Decision.field).toBe("sourceRolloutPromotionPacket");
    expect(coverage.queries.find((query) => query.query === "APT29")?.executionReadiness.rolloutSourceIds.length).toBeGreaterThan(0);
    expect(coverage.queries.find((query) => query.query === "APT29")?.executionReadiness.promotionImpact.agent09ContractIndex.field).toBe("sourceCoverage.rolloutPromotion");
    expect(coverage.queries.find((query) => query.query === "MuddyWater")?.activationBatch.executionReadiness.rolloutSourceIds.length).toBeGreaterThan(0);
    expect(coverage.queries.find((query) => query.query === "MuddyWater")?.activationBatch.executionReadiness.promotionImpact.agent06EvidenceCertification.certificationState).toBe("ready");
    expect(coverage.queries.find((query) => query.query === "APT29")?.activationBatch.runtimeSla.summary.releaseHold).toBe(true);
    expect(coverage.queries.find((query) => query.query === "APT29")?.slo.failures).toEqual(expect.arrayContaining([
      "below_minimum_active_sources",
      "insufficient_source_family_diversity",
      "missing_robots_review"
    ]));
    expect(coverage.queries.find((query) => query.query === "APT29")?.drift.map((item) => item.code)).toContain("missing_robots_review");
    expect(coverage.slo.status).toBe("fail");
    expect(coverage.drift.map((item) => item.code)).toContain("below_minimum_active_sources");
    expect(coverage.queries.find((query) => query.query === "MuddyWater")?.safeSourcePackRecommendations.map((source) => source.sourceId)).toEqual(expect.arrayContaining([
      "src_seed_eset_welivesecurity",
      "src_seed_cisco_talos_blog"
    ]));
    expect(coverage.queries.find((query) => query.query === "MuddyWater")?.missingApprovedPublicSources.map((source) => source.sourceId)).toContain("src_seed_eset_welivesecurity");
    expect(coverage.queries.find((query) => query.query === "FIN7")?.safeSourcePackRecommendations.map((source) => source.sourceId)).toEqual(expect.arrayContaining([
      "src_seed_dfir_report"
    ]));
    expect(coverage.queries.find((query) => query.query === "unknown actor")?.missingVerticals.map((vertical) => vertical.vertical)).toEqual(expect.arrayContaining([
      "actor_intelligence",
      "vendor_research",
      "public_channel",
      "restricted_metadata"
    ]));
    expect(coverage.forbiddenSourceClasses).toEqual(expect.arrayContaining(["private forums", "credentialed sources", "leaked-file endpoints", "CAPTCHA bypass"]));
    expect(coverage.sourcePackInstallPlans.every((plan) => plan.willStartCrawling === false)).toBe(true);
    expect(coverage.governanceDrift.map((item) => item.code)).toContain("missing_robots_notes");
    expect(coverage.remediationPlans.every((plan) => plan.dryRun && plan.willMutate === false && plan.willStartCrawling === false)).toBe(true);
    expect(intelCoverage.query).toBe("MuddyWater");
    expect(intelCoverage.slo.status).toBe("fail");
    expect([
      ...intelCoverage.drift.map((item) => item.code),
      ...intelCoverage.slo.failures
    ]).toEqual(expect.arrayContaining(["missing_legal_review", "missing_robots_review"]));
    expect(intelCoverage.portfolio.familyGroups).toBeDefined();
    expect(intelCoverage.activationBatch.dryRun).toBe(true);
    expect(intelCoverage.activationBatch.willMutate).toBe(false);
    expect(intelCoverage.activationBatch.willStartCrawling).toBe(false);
    expect(intelCoverage.runtimeSla.dryRun).toBe(true);
    expect(intelCoverage.runtimeSla.willMutate).toBe(false);
    expect(intelCoverage.runtimeSla.willStartCrawling).toBe(false);
    expect(intelCoverage.runtimeSla.summary.apiImpact).toMatch(/none|partial_results|stale_results|blocked/);
    expect(intelCoverage.runtimeSla.promotionGate.agent10ReleaseDecision.field).toBe("sourceSlaPromotionGate");
    expect(intelCoverage.coverageCloseout.activationWaveIds.length).toBeGreaterThan(0);
    expect(intelCoverage.coverageCloseout.promotionImpact.agent10).toMatch(/release_candidate|release_hold/);
    expect(intelCoverage.coverageCloseout.executionPacket.canarySourceIds.length).toBeGreaterThan(0);
    expect(intelCoverage.coverageCloseout.executionPacket.promotionImpact.agent09ContractIndex.field).toBe("sourceCoverage.rolloutPromotion");
    expect(intelCoverage.executionReadiness.dryRun).toBe(true);
    expect(intelCoverage.executionReadiness.willMutate).toBe(false);
    expect(intelCoverage.executionReadiness.willStartCrawling).toBe(false);
    expect(intelCoverage.executionReadiness.rolloutSourceIds.length).toBeGreaterThan(0);
    expect(intelCoverage.executionReadiness.promotionImpact.agent06EvidenceCertification.certificationState).toBe("ready");
    expect(intelCoverage.eligibleSources).toBeDefined();
    expect(intelCoverage.selectedSources).toBeDefined();
    expect(Array.isArray(intelCoverage.safeSourcePackRecommendations)).toBe(true);
    expect(intelCoverage.missingVerticals.map((vertical) => vertical.vertical)).toContain("restricted_metadata");
    expect(portfolioResponse.endpoint).toBe("/v1/sources/portfolio");
    expect(portfolioResponse.dryRun).toBe(true);
    expect(portfolioResponse.willMutate).toBe(false);
    expect(portfolioResponse.willStartCrawling).toBe(false);
    expect(portfolioResponse.onboardingPlans[0]!.schedulerCost.estimatedTasksPerDay).toBeGreaterThan(0);
    expect(portfolioResponse.onboardingPlans.every((plan) => plan.dryRun && plan.willMutate === false && plan.willStartCrawling === false)).toBe(true);
    expect(portfolioResponse.reliabilityEconomics).toMatchObject({
      schemaVersion: "ti.source_reliability_economics.v1",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      governance: { noSilentActivation: true, restrictedSourcesMetadataOnly: true }
    });
    expect(portfolioResponse.reliabilityEconomics.summary.sourceCount).toBeGreaterThan(0);
    expect(portfolioResponse.reliabilityEconomics.sources.every((source) => source.guardrails.noLeakedDataAccess && source.handoffs.agent09ApiContract === "source_reliability_fields_ready")).toBe(true);
    expect(portfolioResponse.reliabilityEconomics.sources.map((source) => source.handoffs.agent02SchedulerPriority)).toEqual(expect.arrayContaining(["low"]));
    expect(portfolioResponse.tenantActivation).toMatchObject({
      schemaVersion: "ti.tenant_source_activation.v1",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      tenantId: "tenant_source_coverage",
      guardrails: {
        noSilentActivation: true,
        noCrawlingFromApprovalPackets: true,
        noRestrictedAutoActivation: true,
        noRawUnsafeUrls: true,
        dryRunOnly: true
      }
    });
    expect(portfolioResponse.tenantActivation.approvalPackets.length).toBeGreaterThan(0);
    expect(portfolioResponse.tenantActivation.approvalPackets.every((packet) => packet.dryRun && packet.willMutate === false && packet.willStartCrawling === false)).toBe(true);
    expect(portfolioResponse.tenantActivation.approvalPackets.map((packet) => packet.routeHint)).toEqual(expect.arrayContaining(["/v1/analyst/source-activation-packets"]));
    expect(portfolioResponse.tenantActivation.approvalPackets.map((packet) => packet.decision)).toContain("hold");
    expect(portfolioResponse.tenantActivation.tenantIsolation.find((item) => item.tenantId === "tenant_source_coverage")).toBeDefined();
    expect(portfolioResponse.tenantActivation.handoffs.agent09ApiContracts).toContain("tenantActivation.schemaVersion");
    expect(JSON.stringify(portfolioResponse.tenantActivation)).not.toContain("https://");
    expect(portfolioResponse.sourceImportCanary).toMatchObject({
      schemaVersion: "ti.source_import_canary.v1",
      dryRun: true,
      willMutate: false,
      willImportSourcePacks: false,
      willStartCrawling: false,
      tenantId: "tenant_source_coverage",
      summary: {
        first10Count: 10,
        first50Count: 50
      },
      guardrails: {
        noSilentActivation: true,
        noSourcePackImport: true,
        noCrawlingFromCanary: true,
        noUnsafeRawUrls: true,
        restrictedMetadataOnly: true
      }
    });
    expect(portfolioResponse.sourceImportCanary.first10SourceRollout).toHaveLength(10);
    expect(portfolioResponse.sourceImportCanary.first50SourceRollout).toHaveLength(50);
    expect(portfolioResponse.sourceImportCanary.first10SourceRollout.map((source) => source.canaryOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(portfolioResponse.sourceImportCanary.activationResults.map((result) => result.dimension)).toEqual(expect.arrayContaining([
      "tenant",
      "query_class",
      "source_family",
      "source_policy",
      "adapter_certification",
      "scheduler_impact",
      "evidence_store_impact",
      "quality_gate_impact",
      "graph_stix_impact",
      "api_public_answer_effect"
    ]));
    expect(portfolioResponse.sourceImportCanary.fixtures.map((fixture) => fixture.fixtureClass)).toEqual(expect.arrayContaining([
      "actor_intelligence",
      "ransomware_leak_metadata",
      "vulnerability_advisory",
      "malware_report",
      "public_cert_feed",
      "vendor_blog",
      "public_channel_descriptor"
    ]));
    expect(portfolioResponse.sourceImportCanary.lifecycle.restrictedMetadataHoldPropagation.routeHint).toBe("/v1/analyst/source-activation-packets");
    expect(portfolioResponse.sourceImportCanary.rollbackPlans.length).toBeGreaterThanOrEqual(3);
    expect(portfolioResponse.sourceImportCanary.handoffs.agent09ApiContracts).toContain("sourceImportCanary.schemaVersion");
    expect(portfolioResponse.sourceImportCanary.handoffs.agent10ReleaseRollback).toContain("rollbackPlans");
    expect(JSON.stringify(portfolioResponse.sourceImportCanary)).not.toContain("https://");
    expect(portfolioResponse.burnDown.find((item) => item.query === "unknown actor")?.sourceAdditions.length ?? 0).toBeGreaterThanOrEqual(0);
    expect(portfolioResponse.promotionPacket).toMatchObject({ field: "sourcePortfolioId", gate: "source_portfolio_ready" });
    expect(marketplaceResponse.endpoint).toBe("/v1/sources/marketplace");
    expect(marketplaceResponse.dryRun).toBe(true);
    expect(marketplaceResponse.willMutate).toBe(false);
    expect(marketplaceResponse.willStartCrawling).toBe(false);
    expect(marketplaceResponse.marketplace.sourceCount).toBe(50);
    expect(marketplaceResponse.marketplace.safePublicSourceCount).toBe(50);
    expect(marketplaceResponse.marketplace.sourceFamilies).toEqual(expect.arrayContaining(["vendor_blog", "advisory", "rss", "github_security_advisory", "public_research_feed", "government_cert"]));
    expect(marketplaceResponse.marketplace.sources.every((source) => source.activationReadiness === "ready_for_dry_run" && source.parserSupported && source.schedulerCost.estimatedDailyTasks > 0)).toBe(true);
    expect(marketplaceResponse.parserCapabilityMatrix.map((item) => item.profile)).toEqual(expect.arrayContaining(["static_html", "rss", "dynamic_page", "pdf_report", "public_channel", "advisory_security_signal", "restricted_metadata_handoff"]));
    expect(marketplaceResponse.parserCapabilityMatrix.find((item) => item.profile === "dynamic_page")).toMatchObject({ supported: false, activationBlockedUntilSupported: true });
    expect(marketplaceResponse.parserCapabilityMatrix.find((item) => item.profile === "rss")?.compatibleSourceCount).toBeGreaterThan(0);
    expect(marketplaceResponse.activationReadiness).toMatchObject({ readyForDryRun: 50, needsParserSupport: 0, blockedUnsafe: 0 });
    expect(marketplaceResponse.unsupportedSourceClasses.map((item) => item.sourceClass)).toEqual(expect.arrayContaining(["restricted_raw_payload", "credentialed_or_auth_gated", "public_chat_source"]));
    expect(marketplaceResponse.unsupportedSourceClasses.every((item) => item.activationAllowed === false)).toBe(true);
    expect(marketplaceResponse.governance).toMatchObject({ noSilentActivation: true, noCrawlingFromMarketplace: true });
    expect(atlasResponse).toMatchObject({
      endpoint: "/v1/sources/atlas",
      schemaVersion: "ti.source_atlas.v1",
      dryRun: true,
      willMutate: false,
      willImportSourcePacks: false,
      willStartCrawling: false,
      tenantId: "tenant_source_coverage",
      summary: {
        recordCount: 500,
        syntheticScaleCandidateCount: 10000,
        first100Count: 100,
        first1000Count: 1000
      },
      guardrails: {
        publicOnly: true,
        noPrivateInviteAuthCaptcha: true,
        noSilentActivation: true,
        noSourcePackImport: true,
        noCrawlingFromAtlas: true
      }
    });
    expect(atlasResponse.records.length).toBeGreaterThanOrEqual(500);
    expect(atlasResponse.records.map((record) => record.family)).toEqual(expect.arrayContaining(["vendor_threat_blog", "cert_government", "cve_advisory", "ransomware_tracker", "public_channel_descriptor"]));
    expect(atlasResponse.records.every((record) => record.safety.publicOnly && record.safety.privateInviteAuthCaptcha === false && record.safety.rawPayloadTarget === false && record.safety.autoActivate === false && record.activationReadiness.autoActivationAllowed === false)).toBe(true);
    expect(atlasResponse.importPlans.map((plan) => plan.label)).toEqual(["first_100", "first_1000", "future_10k"]);
    expect(atlasResponse.importPlans.find((plan) => plan.label === "first_100")?.sourceIds).toHaveLength(100);
    expect(atlasResponse.importPlans.find((plan) => plan.label === "first_1000")?.sourceIds).toHaveLength(1000);
    expect(atlasResponse.importPlans.every((plan) => plan.dryRun && plan.willMutate === false && plan.willImportSourcePacks === false && plan.willStartCrawling === false && plan.approvalPacket.forbiddenActions.includes("auto_activate"))).toBe(true);
    expect(atlasResponse.coverageMatrix.map((row) => row.queryClass)).toEqual(expect.arrayContaining(["actor", "ransomware_victim", "cve", "country"]));
    expect(atlasResponse.publicMonitorSourceGapHandoff).toMatchObject({
      schemaVersion: "ti.source_atlas.public_monitor_gap_handoff.v1",
      consumer: "apify_public_threat_actor_monitor",
      dryRun: true,
      willMutate: false,
      willImportSourcePacks: false,
      willStartCrawling: false,
      guardrails: {
        noSourceActivation: true,
        noCrawling: true,
        noRawContent: true
      }
    });
    expect(atlasResponse.publicMonitorSourceGapHandoff.queryRows.map((row) => row.query)).toEqual(expect.arrayContaining(["APT29", "Akira ransomware victims", "CVE-2024-1234"]));
    expect(atlasResponse.publicMonitorSourceGapHandoff.queryRows.every((row) =>
      row.candidateSourceCount > 0 &&
      row.recommendedAtlasSourceIds.every((sourceId) => sourceId.startsWith("atlas_src_")) &&
      row.schedulerDryRun.duplicateRunReuse &&
      row.noLeakBoundary.metadataOnly &&
      row.noLeakBoundary.rawContentIncluded === false &&
      row.noLeakBoundary.unsafeUrlsIncluded === false &&
      row.noLeakBoundary.sourceActivationApplied === false
    )).toBe(true);
    expect(atlasResponse.publicMonitorSourceGapHandoff.summary.queryCount).toBe(atlasResponse.publicMonitorSourceGapHandoff.queryRows.length);
    expect(atlasResponse.publicMonitorSourceGapHandoff.handoffs.agent09PublicMonitorApi).toContain("publicMonitorSourceGapHandoff.queryRows");
    expect(JSON.stringify(atlasResponse.publicMonitorSourceGapHandoff)).not.toContain("https://");
    expect(atlasResponse.lifecycleReview).toMatchObject({
      schemaVersion: "ti.source_atlas.lifecycle_review.v1",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      guardrails: {
        noRegistryMutation: true,
        noSourceDeletion: true,
        noCrawling: true,
        noSilentRetirement: true,
        noSilentQuarantine: true
      }
    });
    expect(atlasResponse.lifecycleReview.rows.length).toBeGreaterThan(0);
    expect(atlasResponse.lifecycleReview.rows.map((row) => row.recommendedAction)).toEqual(expect.arrayContaining(["retire_duplicate", "request_parser_repair", "request_legal_review", "hold_descriptor_only"]));
    expect(atlasResponse.lifecycleReview.rows.every((row) =>
      row.atlasSourceId.startsWith("atlas_src_") &&
      row.sourceHash.startsWith("ti_source_atlas_source_") &&
      row.schedulerDryRun.willLeaseWork === false &&
      row.noMutationBoundary.sourceStatusChanged === false &&
      row.noMutationBoundary.registryWritePlanned === false &&
      row.noMutationBoundary.crawlEnqueued === false &&
      row.noMutationBoundary.sourceDeleted === false
    )).toBe(true);
    expect(atlasResponse.lifecycleReview.summary.reviewedSourceCount).toBe(atlasResponse.lifecycleReview.rows.length);
    expect(atlasResponse.lifecycleReview.summary.retirementReviewCount).toBeGreaterThan(0);
    expect(atlasResponse.lifecycleReview.handoffs.agent09ApiUi).toContain("lifecycleReview.rows");
    expect(JSON.stringify(atlasResponse.lifecycleReview)).not.toContain("https://");
    expect(atlasResponse.sourceEconomics).toMatchObject({
      schemaVersion: "ti.source_atlas.reliability_economics.v1",
      dryRun: true,
      willMutate: false,
      willImportSourcePacks: false,
      willStartCrawling: false,
      guardrails: {
        noRegistryMutation: true,
        noSourceActivation: true,
        noCrawling: true,
        noWorkerLeases: true,
        noRawUnsafeUrls: true,
        noPayloadDownloads: true
      }
    });
    expect(atlasResponse.sourceEconomics.rolloutScenarios.map((scenario) => scenario.label)).toEqual(["first_50", "first_500", "first_5000"]);
    expect(atlasResponse.sourceEconomics.rolloutScenarios.every((scenario) =>
      scenario.selectedSourceIds.length === scenario.sourceCount &&
      scenario.expectedUniqueEvidenceItemsPerDay > 0 &&
      scenario.estimatedStorageMbPerDay > 0 &&
      scenario.estimatedDailySchedulerTasks > 0 &&
      scenario.estimatedCostUnitsPerUsefulEvidence > 0 &&
      scenario.noActivationBoundary.sourceActivationApplied === false &&
      scenario.noActivationBoundary.registryMutationPlanned === false &&
      scenario.noActivationBoundary.crawlEnqueued === false &&
      scenario.noActivationBoundary.workerLeaseCreated === false
    )).toBe(true);
    expect(atlasResponse.sourceEconomics.sourceRows.map((row) => row.decision)).toEqual(expect.arrayContaining(["promote_candidate", "hold_parser", "hold_legal", "hold_descriptor", "retire_duplicate"]));
    expect(atlasResponse.sourceEconomics.sourceRows.every((row) =>
      row.atlasSourceId.startsWith("atlas_src_") &&
      row.sourceHash.startsWith("ti_source_atlas_source_") &&
      row.uniqueEvidenceYield >= 0 &&
      row.expectedApiActorUsefulness >= 0 &&
      row.expectedPublicTiAnswerLift >= 0 &&
      row.economicsScore <= 1
    )).toBe(true);
    expect(atlasResponse.sourceEconomics.familyMetrics.length).toBeGreaterThan(5);
    expect(atlasResponse.sourceEconomics.familyMetrics.every((family) =>
      family.sourceCount > 0 &&
      family.estimatedStorageMbPerDay >= 0 &&
      family.estimatedDailySchedulerTasks > 0 &&
      family.topSourceIds.every((sourceId) => sourceId.startsWith("atlas_src_"))
    )).toBe(true);
    expect(Object.values(atlasResponse.sourceEconomics.marketplaceValueBreakdown).every((value) => typeof value === "number")).toBe(true);
    expect(atlasResponse.sourceEconomics.degradationQueues.map((queue) => queue.queue)).toEqual(expect.arrayContaining(["stale", "noisy_duplicate", "legal_blocked", "parser_broken", "low_yield", "high_cost"]));
    expect(atlasResponse.sourceEconomics.degradationQueues.every((queue) => queue.willMutate === false && queue.willStartCrawling === false)).toBe(true);
    expect(atlasResponse.sourceEconomics.handoffs.agent09ApiFrontend).toContain("sourceEconomics.rolloutScenarios");
    expect(JSON.stringify(atlasResponse.sourceEconomics)).not.toContain("https://");
	    expect(atlasResponse.activationCanary.first100SourceIds).toHaveLength(100);
	    expect(atlasResponse.activationCanary.first1000SourceIds).toHaveLength(1000);
	    expect(atlasResponse.activationCanary.descriptorOnlySourceIds.length).toBeGreaterThan(0);
	    expect(atlasResponse.activationCanary.registryActivationHandoff).toMatchObject({
	      routeHint: "/v1/analyst/source-activation-packets",
	      dryRun: true,
	      willMutate: false,
	      willImportSourcePacks: false,
	      willStartCrawling: false,
	      approvalRequired: true,
	      sourceRegistryMutationAllowed: false,
	      candidateCount: 100,
	      schedulerPreview: {
	        owner: "agent_02",
	        queuePartition: "source_atlas_canary",
	        leaseMode: "dry_run_preview_only"
	      }
	    });
	    expect(atlasResponse.activationCanary.registryActivationHandoff.canarySourceIds).toEqual(atlasResponse.activationCanary.first100SourceIds);
	    expect(atlasResponse.activationCanary.registryActivationHandoff.proposedSourceRecords).toHaveLength(10);
	    expect(atlasResponse.activationCanary.registryActivationHandoff.proposedSourceRecords.every((record) =>
	      record.proposedSourceId.startsWith("src_atlas_canary_") &&
	      record.statusPreview === "candidate" &&
	      record.metadata.provenance === "ti_source_atlas" &&
	      record.metadata.sourceHash.startsWith("ti_source_atlas_source_") &&
	      record.governance.autoActivationAllowed === false
	    )).toBe(true);
	    expect(atlasResponse.activationCanary.registryActivationHandoff.prerequisites).toEqual(expect.arrayContaining(["operator_legal_approval_packet_approved", "rollback_packet_ready"]));
	    expect(atlasResponse.activationCanary.registryActivationHandoff.forbiddenOperations).toEqual(expect.arrayContaining(["registry_mutation", "source_pack_import", "crawl_enqueue", "source_auto_activation", "payload_download"]));
	    expect(atlasResponse.activationCanary.registryActivationHandoff.downstreamHandoffs.agent09ApiContract).toContain("activationCanary.registryActivationHandoff");
	    expect(atlasResponse.discoveryInputs.map((input) => input.method)).toEqual(expect.arrayContaining(["curated_list", "public_report", "github_repository", "awesome_list", "opml_rss", "vendor_page", "analyst_import", "existing_source_pack"]));
    expect(atlasResponse.handoffs.agent03ParserCertification).toContain("activationCanary.parserCertificationRequiredSourceIds");
    expect(atlasResponse.handoffs.agent09ApiContracts).toContain("sourceAtlas");
    expect(atlasResponse.handoffs.agent10ReleaseGates).toContain("importPlans.rollbackPacket");
    expect(JSON.stringify(atlasResponse).toLowerCase()).not.toContain("invite-only");
    expect(atlasExportResponse).toMatchObject({
      endpoint: "/v1/sources/atlas/export",
      schemaVersion: "ti.source_atlas_export_manifest.v1",
      dryRun: true,
      willMutate: false,
      willImportSourcePacks: false,
      willStartCrawling: false,
      tenantId: "tenant_source_coverage",
      requestedPlan: "first_100",
      summary: {
        plannedSourceCount: 100,
        manifestRowCount: 100
      },
      guardrails: {
        noManifestImport: true,
        explicitApprovalRequired: true,
        noSilentActivation: true
      }
    });
    expect(atlasExportResponse.reviewQueue).toHaveLength(100);
    expect(atlasExportResponse.exportManifest.rows).toHaveLength(100);
    expect(atlasExportResponse.reviewQueue.every((row) => row.approvalRoute === "/v1/analyst/source-activation-packets" && row.dryRun && row.willMutate === false && row.willStartCrawling === false)).toBe(true);
    expect(atlasExportResponse.exportManifest.rows.every((row) => row.sourceHash.startsWith("ti_source_atlas_source_") && row.approvalRequired && row.autoActivationAllowed === false)).toBe(true);
    expect(atlasExportResponse.approvalPacket.forbiddenActions).toEqual(expect.arrayContaining(["auto_activate", "start_crawl", "import_without_review", "download_payload"]));
    expect(atlasExportResponse.handoffs.agent01RegistryImport).toContain("exportManifest.rows");
    expect(atlasExportResponse.handoffs.agent09ApiContracts).toContain("sourceAtlas");
    expect(JSON.stringify(atlasExportResponse).toLowerCase()).not.toContain("\"willmutate\":true");
    expect(activationBatchResponse.endpoint).toBe("/v1/sources/activation-batches");
    expect(activationBatchResponse.dryRun).toBe(true);
    expect(activationBatchResponse.willMutate).toBe(false);
    expect(activationBatchResponse.willStartCrawling).toBe(false);
    expect(activationBatchResponse.queries.find((query) => query.query === "MuddyWater")?.sources.every((source) => source.safePublic)).toBe(true);
    expect(Array.isArray(activationBatchResponse.queries.find((query) => query.query === "MuddyWater")?.sources)).toBe(true);
    expect(activationBatchResponse.queries.find((query) => query.query === "MuddyWater")?.executionReadiness.rolloutSourceIds.length).toBeGreaterThan(0);
    expect(activationBatchResponse.executionReadiness.first10Canary).toHaveLength(10);
    expect(activationBatchResponse.executionReadiness.publicRollout50).toHaveLength(50);
    expect(activationBatchResponse.executionReadiness.parserGapHandoff.owner).toBe("agent_03");
    expect(activationBatchResponse.executionReadiness.parserGapHandoff.sourceIds.length).toBeGreaterThan(0);
    expect(activationBatchResponse.executionReadiness.queueBudgetImpact).toMatchObject({ owner: "agent_02", withinBudget: true });
    expect(activationBatchResponse.executionReadiness.rolloutPromotion).toMatchObject({
      costControls: { owner: "agent_02", state: "within_budget" },
      agent10CanaryReleaseDecision: {
        field: "sourceRolloutPromotionPacket",
        releaseDecision: "promote_canary_then_expand"
      }
    });
    expect(activationBatchResponse.executionReadiness.rolloutPromotion.first10CanarySourceIds).toHaveLength(10);
    expect(activationBatchResponse.executionReadiness.rolloutPromotion.publicRollout50SourceIds).toHaveLength(50);
    expect(activationBatchResponse.executionReadiness.agent10ReleasePacket.field).toBe("sourceActivationExecutionReadiness");
    expect(activationBatchResponse.forbiddenSourceClasses).toEqual(expect.arrayContaining(["restricted raw payload collection", "public chat sources"]));
    expect(runtimeSlaResponse.endpoint).toBe("/v1/sources/runtime-sla");
    expect(runtimeSlaResponse.dryRun).toBe(true);
    expect(runtimeSlaResponse.willMutate).toBe(false);
    expect(runtimeSlaResponse.willStartCrawling).toBe(false);
    expect(runtimeSlaResponse.queries.find((query) => query.query === "APT29")?.remediation.every((item) => item.dryRun && item.willMutate === false && item.willStartCrawling === false)).toBe(true);
    expect(runtimeSlaResponse.rollup.status).toMatch(/pass|warning|breach/);
    expect(runtimeSlaResponse.releasePacket).toMatchObject({
      gate: "source_sla_enforcement",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false
    });
    expect(closeoutResponse.endpoint).toBe("/v1/sources/coverage-closeout");
    expect(closeoutResponse.dryRun).toBe(true);
    expect(closeoutResponse.willMutate).toBe(false);
    expect(closeoutResponse.willStartCrawling).toBe(false);
    expect(closeoutResponse.summary.safePublicActivationSourceCount).toBeGreaterThanOrEqual(50);
    expect(closeoutResponse.activationWaves.flatMap((wave) => wave.sources).every((source) => source.approvalScope === "safe_public_auto" && source.parserCompatible)).toBe(true);
    expect(closeoutResponse.executionReadiness.first10Canary).toHaveLength(10);
    expect(closeoutResponse.executionReadiness.first10Canary.map((source) => source.canaryOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(closeoutResponse.executionReadiness.publicRollout50).toHaveLength(50);
    expect(closeoutResponse.executionReadiness.publicRollout50.every((source) => source.legalReviewAgeDays <= 90 && (source.robotsReviewAgeDays === "not_required" || source.robotsReviewAgeDays <= 90))).toBe(true);
    expect(closeoutResponse.executionReadiness.excludedSources.map((source) => source.excludedClass)).toEqual(expect.arrayContaining(["restricted_raw_payload", "parser_gap", "duplicate"]));
    expect(closeoutResponse.executionReadiness.excludedSources.every((source) => source.dryRun && source.willMutate === false && source.willStartCrawling === false)).toBe(true);
    expect(closeoutResponse.executionReadiness.coverageByQueryClass.map((row) => row.queryClass)).toEqual(expect.arrayContaining(["actor", "ransomware_victim", "cve", "campaign"]));
    expect(closeoutResponse.executionReadiness.coverageByQueryClass.every((row) => row.sourceCount > 0)).toBe(true);
    expect(closeoutResponse.executionReadiness.sourceRetirement.candidates).toEqual(closeoutResponse.executionReadiness.duplicateSuppression.duplicateSourceIds);
    expect(closeoutResponse.executionReadiness.parserGapHandoff.owner).toBe("agent_03");
    expect(closeoutResponse.executionReadiness.queueBudgetImpact).toMatchObject({ owner: "agent_02", withinBudget: true });
    expect(closeoutResponse.executionReadiness.agent10ReleasePacket).toMatchObject({ field: "sourceActivationExecutionReadiness", decision: "pass" });
    expect(closeoutResponse.executionReadiness.rolloutPromotion.coverageImpacts.every((impact) =>
      impact.agent02SchedulerTelemetry.budgetState === "within_budget" &&
      impact.agent06EvidenceCertification.certificationState === "ready" &&
      impact.agent07PollingState.state === "canary_polling" &&
      impact.agent09ContractIndex.field === "sourceCoverage.rolloutPromotion" &&
      impact.agent10Decision.field === "sourceRolloutPromotionPacket"
    )).toBe(true);
    expect(closeoutResponse.executionReadiness.rolloutPromotion.coverageImpacts.map((impact) => impact.queryClass)).toEqual(expect.arrayContaining(["actor", "ransomware_victim", "cve", "campaign"]));
    expect(closeoutResponse.executionReadiness.rolloutPromotion.postCanaryMonitoring.map((item) => item.owner)).toEqual(expect.arrayContaining(["agent_02", "agent_06", "agent_07", "agent_10"]));
    expect(closeoutResponse.executionReadiness.rolloutPromotion.agent10CanaryReleaseDecision.releaseDecision).toBe("promote_canary_then_expand");
    expect(closeoutResponse.releasePacket).toMatchObject({
      gate: "source_coverage_closeout",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      agent10ExecutionField: "sourceActivationExecutionReadiness"
    });
  });

  test("reports darknet metadata search states and safe DTOs", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_onion",
      name: "Approved onion metadata",
      type: "tor_metadata",
      url: "http://claims.onion/actor/Akira",
      accessMethod: "approved_proxy",
      status: "active",
      risk: "high",
      legalNotes: "Approved metadata-only onion source fixture.",
      approvedAt: new Date(0).toISOString(),
      approvedBy: "reviewer",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: new Date(0).toISOString(),
        approvedBy: "reviewer"
      }
    }));
    store.saveCapture({
      id: "cap_onion",
      sourceId: "src_onion",
      url: "http://claims.onion/actor/Akira",
      collectedAt: "2026-05-24T00:00:00.000Z",
      publishedAt: "2026-05-23T00:00:00.000Z",
      contentHash: "hash",
      mediaType: "text/plain",
      storageKind: "metadata_only",
      metadata: {
        adapter: "darknet_metadata",
        leakSite: {
          actorName: "Akira",
          victimName: "Fjord Energy AS",
          claimDate: "2026-05-20",
          claimedSector: "Energy",
          claimedCountry: "NO",
          claimedDataCategory: "contracts",
          affectedAccounts: "50k accounts",
          accountSubjects: "employees and contractors",
          datasetSize: "20 GB",
          actorStatement: "Akira claims Fjord Energy AS leaked, 50k accounts, 20 GB.",
          postStatus: "new",
          sourceTimestamp: "2026-05-23T00:00:00.000Z",
          urlHash: "urlhash",
          screenshotHash: "screenhash",
          confidence: 0.82
        },
        policyDecision: { id: "policy_akira" }
      },
      sensitive: true
    });

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Akira&entityType=actor"), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(response.darknetMetadata).toMatchObject({
      status: "partial_metadata",
      queuedTasks: 0,
      results: [{
        actor: "Akira",
        victim: "Fjord Energy AS",
        claimedDate: "2026-05-20",
        sector: "Energy",
        country: "NO",
        claimedDataCategory: "contracts",
        sourceTimestamp: "2026-05-23T00:00:00.000Z",
        urlHash: "urlhash",
        screenshotHash: "screenhash",
        confidence: 0.82,
        policyAuditId: "policy_akira"
      }]
    });
    expect(response.restrictedMetadata).toMatchObject({
      endpoint: "/v1/restricted-metadata/status",
      query: {
        query: "Akira",
        entityType: "actor",
        matchingResultCount: 1,
        partialState: "partial_metadata",
        matchedSourceIds: ["src_onion"]
      }
    });
    const analystLoop = (response.scheduler as { analystLoop: {
      resultState: string;
      runStatusClarity: { queuedTasks: number; reviewTasks: number; meaningfulWorkCount: number };
      victimNotificationPacket: { company: string; affectedAccounts: string; datasetSize: string; sourceHash: string };
      metadataReviewInbox: unknown[];
      workQueue: Array<{
        kind: string;
        title: string;
        claimHeadline?: string;
        route: string;
        actionRoute?: string;
        allowedActions: string[];
        noLeakBoundary: { rawLeakMaterialAccessed: boolean; notificationDeliveredExternally: boolean; sourceActivationPerformed: boolean };
      }>;
      activityTimeline: Array<{
        kind: string;
        title: string;
        route?: string;
        subjectIds: { sourceHash?: string; reviewTaskId?: string };
        noLeakBoundary: { rawLeakMaterialAccessed: boolean; notificationDeliveredByScraper: boolean; sourceActivationPerformed: boolean };
      }>;
      readinessChecklist: Array<{
        code: string;
        state: string;
        route?: string;
        noLeakBoundary: { rawLeakMaterialAccessed: boolean; doesNotImplyVerification: boolean };
      }>;
    } }).analystLoop;
    expect(analystLoop.resultState).toBe("metadata_review");
    expect(analystLoop.runStatusClarity.queuedTasks).toBe(0);
    expect(analystLoop.runStatusClarity.reviewTasks).toBeGreaterThanOrEqual(1);
    expect(analystLoop.runStatusClarity.meaningfulWorkCount).toBeGreaterThanOrEqual(1);
    expect(analystLoop.victimNotificationPacket).toMatchObject({
      company: "Fjord Energy AS",
      affectedAccounts: "50k accounts",
      datasetSize: "20 GB",
      sourceHash: "urlhash"
    });
    expect(analystLoop.metadataReviewInbox).toEqual(expect.arrayContaining([
      expect.objectContaining({
        company: "Fjord Energy AS",
        affectedAccounts: "50k accounts",
        datasetSize: "20 GB",
        sourceHash: "urlhash"
      })
    ]));
    expect(analystLoop.workQueue).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "metadata_review",
        title: "Fjord Energy AS leaked, 50k accounts, 20 GB",
        route: "/v1/analyst/metadata-review-tasks",
        allowedActions: expect.arrayContaining(["notify_company", "mark_duplicate", "request_approval", "escalate"]),
        noLeakBoundary: expect.objectContaining({
          rawLeakMaterialAccessed: false,
          notificationDeliveredExternally: false,
          sourceActivationPerformed: false
        })
      }),
      expect.objectContaining({
        kind: "victim_notification",
        route: "/v1/analyst/victim-notification-packets",
        claimHeadline: "Fjord Energy AS leaked, 50k accounts, 20 GB"
      }),
      expect.objectContaining({
        kind: "claim_ledger",
        route: "/v1/analyst/claim-ledger"
      })
    ]));
    expect(analystLoop.activityTimeline).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "metadata_capture",
        title: "Metadata-only leak claim captured",
        route: "/v1/analyst/metadata-review-tasks",
        subjectIds: expect.objectContaining({ sourceHash: "urlhash" }),
        noLeakBoundary: expect.objectContaining({
          rawLeakMaterialAccessed: false,
          notificationDeliveredByScraper: false,
          sourceActivationPerformed: false
        })
      }),
      expect.objectContaining({
        kind: "notification_packet",
        title: "Victim notification draft prepared"
      })
    ]));
    expect(analystLoop.readinessChecklist).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "metadata_captured", state: "pass", route: "/v1/analyst/metadata-review-tasks" }),
      expect.objectContaining({ code: "analyst_review_complete", state: "pending", route: "/v1/analyst/metadata-review-tasks" }),
      expect.objectContaining({ code: "reviewed_evidence_sufficient", state: "pending", route: "/v1/analyst/loop" })
    ]));
    expect(analystLoop.readinessChecklist.every((item) =>
      item.noLeakBoundary.rawLeakMaterialAccessed === false &&
      item.noLeakBoundary.doesNotImplyVerification === true
    )).toBe(true);
    const responseAnalystLoop = response.analystLoop as {
      resultState: string;
      runStatusClarity: { reviewTasks: number; meaningfulWorkCount: number; emptyQueueDoesNotMeanNoWork?: boolean };
    };
    expect(responseAnalystLoop).toMatchObject({
      resultState: "metadata_review",
      runStatusClarity: {
        reviewTasks: 1,
        emptyQueueDoesNotMeanNoWork: true
      }
    });
    expect(responseAnalystLoop.runStatusClarity.meaningfulWorkCount).toBeGreaterThan(1);
    const tiExperience = (response as {
      tiExperience: {
        visibleStates: string[];
        reviewCards: unknown[];
        workQueue: Array<{
          kind: string;
          state: string;
          title: string;
          route: string;
          actionRoute?: string;
          noLeakBoundary: { metadataOnly: boolean; rawLeakMaterialAccessed: boolean; wording: string };
        }>;
        activityTimeline: Array<{
          kind: string;
          title: string;
          subjectIds: { sourceHash?: string };
          noLeakBoundary: { rawLeakMaterialAccessed: boolean; notificationDeliveredByScraper: boolean };
        }>;
        readinessChecklist: Array<{
          code: string;
          state: string;
          route?: string;
          noLeakBoundary: { rawLeakMaterialAccessed: boolean; doesNotImplyVerification: boolean };
        }>;
        runStatusClarity: {
          queuedTasks: number;
          reviewTasks: number;
          meaningfulWorkCount: number;
          emptyQueueDoesNotMeanNoWork?: boolean;
        };
        notificationPacket: {
          claimHeadline: string;
          company: string;
          affectedAccounts: string;
          datasetSize: string;
          redactedNotification: {
            subject: string;
            recipientOrganization: string;
            claimedImpact: { affectedAccounts: string; datasetSize: string };
            deliveryBoundary: { externalDeliveryPerformed: boolean; deliveryMustHappenOutsideScraper: boolean };
          };
          externalDeliveryPerformed: boolean;
          safeToSendWithoutReview: boolean;
        };
        sourceActivationWorkflow: {
          approvalWorkflows: Array<{
            requestedAction: string;
            deliveryBoundary: { sourceMutationPerformed: boolean; crawlingStarted: boolean; restrictedFetchEnabled: boolean };
            forbiddenOperations: string[];
          }>;
        };
      };
    }).tiExperience;
    const publicWrapperDelta = (response as {
      publicWrapperDelta: {
        stablePublicFields: string[];
        deltas: { analystLoop: { state: string; reviewTaskCount: number; queuedTaskCount: number } };
      };
    }).publicWrapperDelta;
    expect(tiExperience).toMatchObject({
      schemaVersion: "ti.analyst_loop_ui.v1",
      state: "metadata_review",
      safeToRenderVerifiedLeakFacts: false,
      partial: true,
      progress: {
        metadataReview: true,
        ready: false
      },
      runStatusClarity: {
        queuedTasks: 0,
        reviewTasks: 1,
        emptyQueueDoesNotMeanNoWork: true
      },
      sourceActivationWorkflow: {
        silentAutoActivationAllowed: false,
        approvalWorkflows: []
      },
      guarantees: {
        metadataOnly: true,
        rawLeakMaterialAccessed: false,
        notificationDeliveredExternally: false,
        doesNotImplyVerification: true,
        credentialsAccessed: false,
        privateAccessAttempted: false,
        threatActorInteractionPerformed: false
      }
    });
    expect(tiExperience.runStatusClarity.meaningfulWorkCount).toBeGreaterThan(1);
    expect(tiExperience.runStatusClarity.meaningfulWorkCount).toBeGreaterThanOrEqual(1);
    expect(tiExperience.visibleStates).toEqual(["queued", "metadata_review", "blocked_unsafe_target", "needs_source_activation", "ready"]);
    expect(tiExperience.workQueue.map((item) => item.kind)).toEqual(expect.arrayContaining(["metadata_review", "victim_notification", "claim_ledger"]));
    expect(tiExperience.workQueue).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "metadata_review",
        state: "metadata_review",
        title: "Fjord Energy AS leaked, 50k accounts, 20 GB",
        route: "/v1/analyst/metadata-review-tasks",
        noLeakBoundary: expect.objectContaining({
          metadataOnly: true,
          rawLeakMaterialAccessed: false,
          wording: "This queue item contains safe metadata and workflow state only; the scraper did not verify, download, or expose leaked contents."
        })
      })
    ]));
    expect(tiExperience.activityTimeline).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "metadata_capture",
        title: "Metadata-only leak claim captured",
        subjectIds: expect.objectContaining({ sourceHash: "urlhash" }),
        noLeakBoundary: expect.objectContaining({
          rawLeakMaterialAccessed: false,
          notificationDeliveredByScraper: false
        })
      })
    ]));
    expect(tiExperience.readinessChecklist).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "metadata_captured", state: "pass" }),
      expect.objectContaining({ code: "claim_ledger_trusted", state: "pending", route: "/v1/analyst/claim-ledger" }),
      expect.objectContaining({ code: "reviewed_evidence_sufficient", state: "pending" })
    ]));
    expect(tiExperience.readinessChecklist.every((item) =>
      item.noLeakBoundary.rawLeakMaterialAccessed === false &&
      item.noLeakBoundary.doesNotImplyVerification === true
    )).toBe(true);
    expect(tiExperience.reviewCards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        claimHeadline: "Fjord Energy AS leaked, 50k accounts, 20 GB",
        company: "Fjord Energy AS",
        affectedAccounts: "50k accounts",
        datasetSize: "20 GB",
        sourceHash: "urlhash",
        unsafeMaterialAccessed: false,
        verificationBoundary: expect.objectContaining({
          claimMetadataOnly: true,
          leakedDatasetAccessed: false,
          wording: "This is safe claim metadata for review; the scraper did not verify or download leaked contents."
        }),
        whatWasNotAccessed: expect.arrayContaining([
          "No restricted dataset was downloaded or opened.",
          "No threat actor interaction was performed."
        ])
      })
    ]));
    expect(tiExperience.notificationPacket).toMatchObject({
      claimHeadline: "Fjord Energy AS leaked, 50k accounts, 20 GB",
      company: "Fjord Energy AS",
      affectedAccounts: "50k accounts",
      datasetSize: "20 GB",
      redactedNotification: {
        subject: "Fjord Energy AS leaked, 50k accounts, 20 GB",
        recipientOrganization: "Fjord Energy AS",
        claimedImpact: {
          affectedAccounts: "50k accounts",
          datasetSize: "20 GB"
        },
        deliveryBoundary: {
          externalDeliveryPerformed: false,
          deliveryMustHappenOutsideScraper: true
        }
      },
      externalDeliveryPerformed: false,
      safeToSendWithoutReview: false
    });
    expect(publicWrapperDelta.stablePublicFields).toEqual(expect.arrayContaining(["analystLoop", "tiExperience"]));
    expect(publicWrapperDelta.deltas.analystLoop).toMatchObject({
      state: "metadata_review",
      reviewTaskCount: 1,
      queuedTaskCount: 0
    });
    expect(store.listAnalystMetadataReviewTasks()).toHaveLength(1);
    expect(store.listAnalystMetadataReviewTasks()[0]).toMatchObject({
      company: "Fjord Energy AS",
      affectedAccounts: "50k accounts",
      affectedAccountsCount: 50_000,
      datasetSize: "20 GB",
      datasetSizeBytes: 20_000_000_000,
      unsafeMaterialAccessed: false,
      allowedActions: expect.arrayContaining(["notify_company", "mark_duplicate", "request_approval", "escalate"])
    });
    expect(store.listAnalystVictimNotificationPackets()[0]).toMatchObject({
      company: "Fjord Energy AS",
      affectedAccounts: "50k accounts",
      datasetSize: "20 GB",
      safeToSend: false
    });
    expect(store.listAnalystVictimNotificationPackets()[0]?.whatWasNotAccessed).toEqual(expect.arrayContaining(["No restricted dataset was downloaded or opened."]));
    expect(store.listAnalystClaimLedgerEntries().map((entry) => entry.claimKind)).toEqual(expect.arrayContaining([
      "victim_claim",
      "affected_accounts_claim",
      "dataset_size_claim",
      "actor_statement_claim"
    ]));
    expect(store.listAnalystLoopSnapshots()[0]).toMatchObject({
      resultState: "metadata_review",
      queuedTasks: 0,
      reviewTasks: 1
    });
    const persistedMeaningfulWorkCount = store.listAnalystLoopSnapshots()[0]?.meaningfulWorkCount;
    expect(persistedMeaningfulWorkCount).toEqual(expect.any(Number));
    expect(persistedMeaningfulWorkCount as number).toBeGreaterThan(1);
    const inbox = await body(await handleApiRequest(api("/v1/analyst/metadata-review-tasks"), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(inbox).toMatchObject({
      contract: {
        endpoint: "/v1/analyst/metadata-review-tasks",
        metadataOnly: true,
        safeForApi: true,
        actionsEndpoint: "/v1/analyst/metadata-review-tasks/{taskId}/actions"
      },
      runStatusClarity: {
        reviewTasks: 1,
        metadataReviewTasks: 1,
        notificationDrafts: 1,
        meaningfulWorkCount: 2
      }
    });
    const inboxTask = (inbox.tasks as Array<{ claimHeadline: string; company: string; affectedAccounts: string; datasetSize: string; sourceHash: string; allowedActions: string[]; verificationBoundary: { leakedDatasetAccessed: boolean; wording: string } }>)[0];
    expect(inboxTask).toMatchObject({
      claimHeadline: "Fjord Energy AS leaked, 50k accounts, 20 GB",
      company: "Fjord Energy AS",
      affectedAccounts: "50k accounts",
      datasetSize: "20 GB",
      sourceHash: "urlhash",
      verificationBoundary: {
        leakedDatasetAccessed: false,
        wording: "This is safe claim metadata for review; the scraper did not verify or download leaked contents."
      }
    });
    expect(inboxTask.allowedActions).toEqual(expect.arrayContaining(["notify_company", "mark_duplicate", "request_approval", "escalate"]));
    expect(JSON.stringify(inbox)).not.toContain("customer-dump");
    expect(JSON.stringify(inbox)).not.toContain("password");
    const persistenceReadiness = await body(await handleApiRequest(api("/v1/analyst/persistence-readiness"), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(persistenceReadiness).toMatchObject({
      endpoint: "/v1/analyst/persistence-readiness",
      dryRun: true,
      willMutate: false,
      willConnectToDatabase: false,
      readiness: {
        state: "ready",
        mappedTableCount: 8,
        blockers: []
      },
      noLeakGuardrails: {
        forbiddenOperations: expect.arrayContaining(["download leaked datasets", "activate restricted sources silently", "send victim notifications from the scraper"])
      }
    });
    expect((persistenceReadiness.workflowTables as Array<{ table: string }>).map((table) => table.table)).toEqual(expect.arrayContaining([
      "collection_plans",
      "collection_tasks",
      "collection_runs",
      "metadata_review_tasks",
      "claim_ledger_entries",
      "analyst_loop_snapshots"
    ]));
    expect(persistenceReadiness.dependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: "sources",
        migration: "migrations/001_source_registry.sql"
      })
    ]));
    const sourceRegistryPersistence = (persistenceReadiness as { sourceRegistryPersistence: unknown }).sourceRegistryPersistence as {
      workflowTables: Array<{ table: string }>;
    };
    expect(sourceRegistryPersistence).toMatchObject({
      schemaVersion: "ti.source_registry_persistence_readiness.v1",
      migration: "migrations/001_source_registry.sql",
      dryRun: true,
      willMutate: false,
      willConnectToDatabase: false,
      cutoverRole: "restore source records, governance approvals, legal notes, health, scoring inputs, crawl state, and lifecycle history before replaying analyst-loop tasks"
    });
    expect(sourceRegistryPersistence.workflowTables.map((table) => table.table)).toEqual(expect.arrayContaining([
      "sources",
      "source_governance",
      "source_health",
      "source_scoring_inputs",
      "source_crawl_state",
      "source_lifecycle_events"
    ]));
    expect(JSON.stringify(persistenceReadiness)).not.toContain("customer-dump");
    const reviewTaskId = (inbox.tasks as Array<{ id: string }>)[0].id;
    const action = await body(await handleApiRequest(api(`/v1/analyst/metadata-review-tasks/${encodeURIComponent(reviewTaskId)}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "analyst-1" },
      body: JSON.stringify({ action: "notify_company", dryRun: false, reason: "Prepare safe victim notification draft." })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(action).toMatchObject({
      contract: {
        metadataOnly: true,
        externalDeliveryPerformed: false,
        sourceActivationPerformed: false
      },
      dryRun: false,
      action: "notify_company",
      result: {
        status: "notified",
        persisted: true
      },
      notificationPacket: {
        company: "Fjord Energy AS",
        affectedAccounts: "50k accounts",
        datasetSize: "20 GB",
        safeToSend: false
      }
    });
    expect(store.getAnalystMetadataReviewTask(reviewTaskId)?.status).toBe("notified");
    const readModel = await body(await handleApiRequest(api("/v1/analyst/loop?q=Akira"), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(readModel).toMatchObject({
      contract: {
        endpoint: "/v1/analyst/loop",
        schemaVersion: "ti.analyst_loop_read_model.v1",
        metadataOnly: true,
        safeForApi: true
      },
      state: "metadata_review",
      runStatusClarity: {
        reviewTasks: 1,
        metadataReviewTasks: 1,
        notificationDrafts: 1
      },
      persistence: {
        replayableFromStore: true,
        survivesFileBackedRestart: true
      }
    });
    const readModelMeaningfulWorkCount = (readModel.runStatusClarity as { meaningfulWorkCount?: unknown }).meaningfulWorkCount;
    expect(readModelMeaningfulWorkCount).toEqual(expect.any(Number));
    expect(readModelMeaningfulWorkCount as number).toBeGreaterThan(1);
    expect((readModel.workQueue as Array<{ kind: string; title: string; actionRoute?: string; noLeakBoundary: { rawLeakMaterialAccessed: boolean } }>)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "metadata_review",
        title: "Fjord Energy AS leaked, 50k accounts, 20 GB",
        actionRoute: `/v1/analyst/metadata-review-tasks/${encodeURIComponent(reviewTaskId)}/actions`,
        noLeakBoundary: expect.objectContaining({ rawLeakMaterialAccessed: false })
      }),
      expect.objectContaining({
        kind: "victim_notification",
        title: "Review victim notification draft"
      }),
      expect.objectContaining({
        kind: "claim_ledger"
      })
    ]));
    expect((readModel.activityTimeline as Array<{ kind: string; title: string; route?: string; subjectIds: { reviewTaskId?: string; sourceHash?: string }; noLeakBoundary: { rawLeakMaterialAccessed: boolean; notificationDeliveredByScraper: boolean } }>)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "metadata_review_action",
        title: "Review action: notify company",
        route: `/v1/analyst/metadata-review-tasks/${encodeURIComponent(reviewTaskId)}/actions`,
        subjectIds: expect.objectContaining({
          reviewTaskId,
          sourceHash: "urlhash"
        }),
        noLeakBoundary: expect.objectContaining({
          rawLeakMaterialAccessed: false,
          notificationDeliveredByScraper: false
        })
      }),
      expect.objectContaining({
        kind: "notification_packet",
        title: "Notification draft prepared"
      }),
      expect.objectContaining({
        kind: "claim_ledger_action"
      })
    ]));
    const readModelChecklist = readModel.readinessChecklist as Array<{
      code: string;
      state: string;
      route?: string;
      noLeakBoundary: { rawLeakMaterialAccessed: boolean; doesNotImplyVerification: boolean };
    }>;
    expect(readModelChecklist).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "metadata_captured", state: "pass" }),
      expect.objectContaining({ code: "claim_ledger_trusted", state: "pending", route: "/v1/analyst/claim-ledger" }),
      expect.objectContaining({ code: "reviewed_evidence_sufficient", state: "pending" })
    ]));
    expect(readModelChecklist.every((item) =>
      item.noLeakBoundary.rawLeakMaterialAccessed === false &&
      item.noLeakBoundary.doesNotImplyVerification === true
    )).toBe(true);
    expect((readModel.reviewTasks as Array<{ company: string; datasetSize: string; sourceHash: string }>)[0]).toMatchObject({
      company: "Fjord Energy AS",
      datasetSize: "20 GB",
      sourceHash: "urlhash"
    });
    expect((readModel.notificationPackets as Array<{ safeToSend: boolean; company: string }>)[0]).toMatchObject({
      company: "Fjord Energy AS",
      safeToSend: false
    });
    expect(JSON.stringify(readModel)).not.toContain("customer-dump");
    expect(JSON.stringify(readModel)).not.toContain("password");
    store.saveAnalystSourceActivationPacket({
      id: "activation_test_fjord",
      planId: "plan_test_activation",
      runId: "run_test_activation",
      sourceId: "src_onion",
      action: "request_operator_approval",
      execution: "approval_required",
      reason: "Operator approval required before restoring metadata-only queue.",
      expectedEffect: "Queue safe metadata only after explicit approval.",
      rollback: "Keep source disabled.",
      dryRun: true,
      createdAt: "2026-05-24T10:05:00.000Z"
    });
    const sourceActivationPackets = await body(await handleApiRequest(api("/v1/analyst/source-activation-packets"), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(sourceActivationPackets).toMatchObject({
      contract: {
        endpoint: "/v1/analyst/source-activation-packets",
        metadataOnly: true,
        safeForApi: true,
        sourceMutationPerformed: false,
        crawlingStarted: false
      },
      runStatusClarity: {
        activationPackets: 1,
        approvalRequired: 1,
        meaningfulWorkCount: 1
      }
    });
    const activationPacket = (sourceActivationPackets.packets as Array<{
      id: string;
      execution: string;
      dryRun: boolean;
      approvalWorkflow: {
        requestedAction: string;
        approval: { required: boolean; approved: boolean; safeToExecuteMetadataOnly: boolean };
        deliveryBoundary: { dryRunOnly: boolean; sourceMutationPerformed: boolean; crawlingStarted: boolean; restrictedFetchEnabled: boolean };
        forbiddenOperations: string[];
      };
    }>)[0];
    expect(activationPacket).toMatchObject({
      execution: "approval_required",
      dryRun: true,
      approvalWorkflow: {
        requestedAction: "request_operator_approval",
        approval: {
          required: true,
          approved: false,
          safeToExecuteMetadataOnly: false
        },
        deliveryBoundary: {
          dryRunOnly: true,
          sourceMutationPerformed: false,
          crawlingStarted: false,
          restrictedFetchEnabled: false
        },
        forbiddenOperations: expect.arrayContaining(["automatic_source_activation", "raw_leak_download", "threat_actor_contact"])
      }
    });
    const activationPacketId = activationPacket.id;
    const activationAction = await body(await handleApiRequest(api(`/v1/analyst/source-activation-packets/${encodeURIComponent(activationPacketId)}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "operator-1" },
      body: JSON.stringify({ action: "approve_metadata_only", dryRun: false, reason: "Approve metadata-only review queue." })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(activationAction).toMatchObject({
      contract: {
        metadataOnly: true,
        sourceMutationPerformed: false,
        crawlingStarted: false,
        restrictedFetchEnabled: false
      },
      dryRun: false,
      action: "approve_metadata_only",
      result: {
        approvalRecorded: true,
        approvalDryRunOnly: true
      },
      packet: {
        approvedBy: "operator-1",
        dryRun: true,
        approvalWorkflow: expect.objectContaining({
          approval: expect.objectContaining({
            approved: true,
            approvedBy: "operator-1",
            safeToExecuteMetadataOnly: true
          }),
          deliveryBoundary: expect.objectContaining({
            sourceMutationPerformed: false,
            crawlingStarted: false,
            restrictedFetchEnabled: false
          })
        })
      },
      approvalWorkflow: {
        approval: expect.objectContaining({
          approved: true,
          approvedBy: "operator-1",
          safeToExecuteMetadataOnly: true
        }),
        allowedOperatorActions: expect.arrayContaining(["approve_metadata_only", "keep_blocked", "request_legal_review"]),
        forbiddenOperations: expect.arrayContaining(["restricted_fetch_enablement", "raw_leak_download"])
      }
    });
    expect(store.listAnalystSourceActivationPackets()[0]).toMatchObject({
      approvedBy: "operator-1"
    });
    const activationExecutionPreview = await body(await handleApiRequest(api(`/v1/analyst/source-activation-packets/${encodeURIComponent(activationPacketId)}/execution-preview`), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(activationExecutionPreview).toMatchObject({
      contract: {
        endpoint: "/v1/analyst/source-activation-packets/{packetId}/execution-preview",
        metadataOnly: true,
        safeForApi: true,
        dryRun: true,
        sourceMutationPerformed: false,
        crawlingStarted: false,
        restrictedFetchEnabled: false,
        unsafeTargetConvertedToRunnableWork: false
      },
      readiness: {
        safeToExecuteMetadataOnly: true,
        approved: true,
        blocked: false,
        approvedBy: "operator-1"
      },
      packet: {
        id: activationPacketId,
        dryRun: true,
        approvedBy: "operator-1",
        approvalWorkflow: expect.objectContaining({
          expectedMetadataOnlyEffect: "Queue safe metadata only after explicit approval.",
          rollback: "Keep source disabled.",
          approval: expect.objectContaining({
            approved: true,
            safeToExecuteMetadataOnly: true
          })
        })
      },
      approvalWorkflow: {
        requestedAction: "request_operator_approval",
        approval: expect.objectContaining({
          approved: true,
          approvedBy: "operator-1",
          safeToExecuteMetadataOnly: true
        }),
        requiredBeforeExecution: [],
        deliveryBoundary: expect.objectContaining({
          dryRunOnly: true,
          sourceMutationPerformed: false,
          crawlingStarted: false,
          restrictedFetchEnabled: false,
          unsafeTargetConvertedToRunnableWork: false,
          externalGovernanceHandoffRequired: true
        }),
        forbiddenOperations: expect.arrayContaining(["automatic_source_activation", "raw_leak_download", "threat_actor_contact"])
      },
      executionPreview: {
        expectedEffect: "Queue safe metadata only after explicit approval.",
        rollback: "Keep source disabled.",
        willMutateSource: false,
        willStartCrawling: false,
        willEnableRestrictedFetch: false,
        willDownloadLeakMaterial: false,
        operatorHandoffRequired: true
      },
      forbiddenOperations: expect.arrayContaining(["automatic_source_activation", "raw_leak_download", "threat_actor_contact"])
    });
    expect(JSON.stringify(sourceActivationPackets)).not.toContain("customer-dump");
    expect(JSON.stringify(activationAction)).not.toContain("password");
    expect(JSON.stringify(activationExecutionPreview)).not.toContain("customer-dump");
    expect(JSON.stringify(activationExecutionPreview)).not.toContain("password");
    const notificationQueue = await body(await handleApiRequest(api("/v1/analyst/victim-notification-packets"), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(notificationQueue).toMatchObject({
      contract: {
        endpoint: "/v1/analyst/victim-notification-packets",
        metadataOnly: true,
        safeForApi: true,
        externalDeliveryPerformed: false,
        rawLeakMaterialAccessed: false
      },
      runStatusClarity: {
        notificationPackets: 1,
        drafts: 1,
        meaningfulWorkCount: 1
      }
    });
    const notificationPacket = (notificationQueue.packets as Array<{
      id: string;
      claimHeadline: string;
      verificationBoundary: { claimMetadataOnly: boolean; leakedDatasetAccessed: boolean; wording: string };
      redactedNotification: {
        subject: string;
        recipientOrganization: string;
        claimedImpact: { affectedAccounts: string; datasetSize: string };
        deliveryBoundary: { externalDeliveryPerformed: boolean; deliveryMustHappenOutsideScraper: boolean };
      };
    }>)[0];
    expect(notificationPacket).toMatchObject({
      claimHeadline: "Fjord Energy AS leaked, 50k accounts, 20 GB",
      verificationBoundary: {
        claimMetadataOnly: true,
        leakedDatasetAccessed: false,
        wording: "This is safe claim metadata for review; the scraper did not verify or download leaked contents."
      },
      redactedNotification: {
        subject: "Fjord Energy AS leaked, 50k accounts, 20 GB",
        recipientOrganization: "Fjord Energy AS",
        claimedImpact: {
          affectedAccounts: "50k accounts",
          datasetSize: "20 GB"
        },
        deliveryBoundary: {
          externalDeliveryPerformed: false,
          deliveryMustHappenOutsideScraper: true
        }
      }
    });
    const notificationPacketId = notificationPacket.id;
    const notificationApproval = await body(await handleApiRequest(api(`/v1/analyst/victim-notification-packets/${encodeURIComponent(notificationPacketId)}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "analyst-2" },
      body: JSON.stringify({ action: "approve_packet", dryRun: false, reason: "Approved redacted company notification packet." })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(notificationApproval).toMatchObject({
      contract: {
        metadataOnly: true,
        externalDeliveryPerformed: false,
        rawLeakMaterialAccessed: false
      },
      dryRun: false,
      action: "approve_packet",
      result: {
        nextStatus: "approved",
        externalDeliveryPerformed: false
      },
      packet: {
        claimHeadline: "Fjord Energy AS leaked, 50k accounts, 20 GB",
        verificationBoundary: expect.objectContaining({
          claimMetadataOnly: true,
          leakedDatasetAccessed: false,
          threatActorInteractionPerformed: false
        }),
        redactedNotification: expect.objectContaining({
          subject: "Fjord Energy AS leaked, 50k accounts, 20 GB",
          sourceHash: "urlhash",
          deliveryBoundary: expect.objectContaining({
            externalDeliveryPerformed: false,
            safeToSendAfterApproval: true
          })
        }),
        approvedBy: "analyst-2",
        safeToSend: true,
        status: "approved"
      }
    });
    const notificationExport = await body(await handleApiRequest(api(`/v1/analyst/victim-notification-packets/${encodeURIComponent(notificationPacketId)}/export`), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(notificationExport).toMatchObject({
      contract: {
        endpoint: "/v1/analyst/victim-notification-packets/{packetId}/export",
        metadataOnly: true,
        safeForApi: true,
        externalDeliveryPerformed: false,
        rawLeakMaterialAccessed: false,
        transportCredentialsIncluded: false,
        doesNotVerifyLeakedDatasetContents: true
      },
      readiness: {
        safeToHandOff: true,
        status: "approved",
        approvedBy: "analyst-2"
      },
      packet: {
        claimHeadline: "Fjord Energy AS leaked, 50k accounts, 20 GB",
        company: "Fjord Energy AS",
        affectedAccounts: "50k accounts",
        datasetSize: "20 GB",
        sourceHash: "urlhash",
        claimLedger: expect.arrayContaining([
          expect.objectContaining({ claimKind: "victim_claim", ledgerStatus: "notified" }),
          expect.objectContaining({ claimKind: "dataset_size_claim", ledgerStatus: "notified" })
        ]),
        whatWasNotAccessed: expect.arrayContaining(["No restricted dataset was downloaded or opened."]),
        verificationBoundary: expect.objectContaining({
          claimMetadataOnly: true,
          leakedDatasetAccessed: false,
          credentialsAccessed: false,
          threatActorInteractionPerformed: false
        }),
        redactedNotification: expect.objectContaining({
          subject: "Fjord Energy AS leaked, 50k accounts, 20 GB",
          recipientOrganization: "Fjord Energy AS",
          claimedImpact: {
            affectedAccounts: "50k accounts",
            datasetSize: "20 GB"
          },
          sourceHash: "urlhash",
          whatWasNotAccessed: expect.arrayContaining(["No restricted dataset was downloaded or opened."]),
          verificationBoundary: expect.objectContaining({
            leakedDatasetAccessed: false,
            credentialsAccessed: false
          }),
          deliveryBoundary: expect.objectContaining({
            externalDeliveryPerformed: false,
            deliveryMustHappenOutsideScraper: true,
            transportCredentialsIncluded: false,
            safeToSendAfterApproval: true
          })
        })
      },
      delivery: {
        externalDeliveryPerformed: false,
        deliveryMustHappenOutsideScraper: true,
        forbiddenActions: expect.arrayContaining(["include_raw_leaked_rows", "contact_threat_actor"])
      }
    });
    const sentRecord = await body(await handleApiRequest(api(`/v1/analyst/victim-notification-packets/${encodeURIComponent(notificationPacketId)}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "analyst-2" },
      body: JSON.stringify({ action: "record_external_sent", dryRun: false, reason: "Company notified by approved external process." })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(sentRecord).toMatchObject({
      action: "record_external_sent",
      result: {
        nextStatus: "sent",
        externalDeliveryPerformed: false
      },
      packet: {
        status: "sent"
      }
    });
    expect(store.listAnalystClaimLedgerEntries().filter((entry) => entry.reviewTaskId === reviewTaskId).map((entry) => entry.ledgerStatus)).toEqual(expect.arrayContaining(["notified"]));
    expect(JSON.stringify(notificationQueue)).not.toContain("customer-dump");
    expect(JSON.stringify(notificationExport)).not.toContain("customer-dump");
    expect(JSON.stringify(notificationExport)).not.toContain("password");
    expect(JSON.stringify(sentRecord)).not.toContain("password");
    expect(JSON.stringify(store.listAnalystMetadataReviewTasks())).not.toContain("password");
    const restricted = response.restrictedMetadata as {
      runtimeProofs: Array<{ kind: string; metadataOnly: boolean; safeForApi: boolean; forbiddenAlternatives: string[] }>;
      operationalSla: { metadataOnly: boolean; safeForApi: boolean; metrics: Record<string, number> };
      enforcement: { level: string; metadataOnly: boolean; safeForApi: boolean; emergencyStop: { state: string; dryRunOnly: boolean }; agent09WarningCodes: string[] };
      auditTrail: { metadataOnly: boolean; safeForApi: boolean; unsafeFieldsExposed: boolean; rejectedFields: string[] };
      governancePackets: Array<{ metadataOnly: boolean; safeForApi: boolean; proof: Record<string, boolean> }>;
      auditReplay: { metadataOnly: boolean; safeForApi: boolean; observedScenarios: string[] };
      connectorCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; guarantees: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      killSwitchDrills: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; guarantees: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      emergencyStopCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; rcGate: string; proof: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      nonBlockingSearch: { metadataOnly: boolean; safeForApi: boolean; nonBlockingPublicSearch: boolean; maxPublicSearchAddedLatencyMs: number; observedScenarios: string[]; packets: Array<{ publicSearchAction: string; proof: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      analystOperations: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; victimNotificationPacketCount: number; packets: Array<{ schedulerIsolation: { directEgressAllowed: boolean }; proof: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      agent10ReleasePacket: { runtimeProofName: string; metadataOnly: boolean; safeForApi: boolean; emergencyStopState: string; auditReplayScenarios: string[]; certificationScenarios: string[]; killSwitchDrillScenarios: string[]; emergencyStopCertificationScenarios: string[] };
    };
    expect(restricted.runtimeProofs.map((proof) => proof.kind)).toEqual(expect.arrayContaining([
      "approval_expiry",
      "kill_switch_transition",
      "proxy_failure",
      "timeout",
      "retention_expiry",
      "legal_hold",
      "redaction_repair",
      "unsafe_target_rejection",
      "disabled_source_rollback"
    ]));
    expect(restricted.runtimeProofs.every((proof) => proof.metadataOnly && proof.safeForApi)).toBe(true);
    expect(restricted.operationalSla).toMatchObject({
      metadataOnly: true,
      safeForApi: true
    });
    expect(restricted.operationalSla.metrics.metadataOnlyEvidenceYield).toBeGreaterThanOrEqual(1);
    expect(restricted.enforcement).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      emergencyStop: {
        dryRunOnly: true
      }
    });
    expect(restricted.enforcement.agent09WarningCodes).toContain("restricted_metadata_forbidden_action");
    expect(restricted.auditTrail).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      unsafeFieldsExposed: false
    });
    expect(restricted.auditTrail.rejectedFields).toContain("payloadReference");
    expect(restricted.governancePackets.every((packet) => packet.metadataOnly && packet.safeForApi && packet.proof.noStolenFilesStored)).toBe(true);
    expect(restricted.auditReplay).toMatchObject({ metadataOnly: true, safeForApi: true });
    expect(restricted.auditReplay.observedScenarios).toContain("allowed_metadata_only_record");
    expect(restricted.connectorCertification).toMatchObject({ metadataOnly: true, safeForApi: true, dryRunOnly: true, noLeakSerialization: { passed: true } });
    expect(restricted.connectorCertification.observedScenarios).toContain("healthy_approved_metadata_source");
    expect(restricted.connectorCertification.packets.every((packet) => packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.noLeakSerialization.passed && packet.guarantees.noContact && packet.guarantees.noDownload)).toBe(true);
    expect(restricted.killSwitchDrills).toMatchObject({ metadataOnly: true, safeForApi: true, dryRunOnly: true, operatorVisible: true, noLeakSerialization: { passed: true } });
    expect(restricted.killSwitchDrills.observedScenarios).toContain("healthy_metadata_only_canary");
    expect(restricted.killSwitchDrills.packets.every((packet) => packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.operatorVisible && packet.noLeakSerialization.passed && packet.guarantees.noContact && packet.guarantees.noDownload)).toBe(true);
    expect(restricted.emergencyStopCertification).toMatchObject({ metadataOnly: true, safeForApi: true, dryRunOnly: true, noLeakSerialization: { passed: true } });
    expect(restricted.emergencyStopCertification.observedScenarios).toContain("healthy_metadata_only_canary");
    expect(restricted.emergencyStopCertification.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.rcGate === "restricted_metadata_emergency_stop_certification_rc" &&
      packet.noLeakSerialization.passed &&
      packet.proof.noUnsafeAccess &&
      packet.proof.noDataExposure &&
      packet.proof.noContact &&
      packet.proof.noDownload &&
      packet.proof.noCredentialBypass &&
      packet.proof.noCaptchaSolving &&
      packet.proof.noStealth &&
      packet.proof.noRawPayloads &&
      packet.proof.noRawUrls &&
      packet.proof.hashOnlyEvidence
    )).toBe(true);
    expect(restricted.agent10ReleasePacket).toMatchObject({
      runtimeProofName: "restricted_metadata_sla",
      metadataOnly: true,
      safeForApi: true,
      emergencyStopState: restricted.enforcement.emergencyStop.state
    });
    expect(restricted.agent10ReleasePacket.certificationScenarios).toContain("healthy_approved_metadata_source");
    expect(restricted.agent10ReleasePacket.killSwitchDrillScenarios).toContain("healthy_metadata_only_canary");
    expect(restricted.agent10ReleasePacket.emergencyStopCertificationScenarios).toContain("healthy_metadata_only_canary");
    expect(restricted.nonBlockingSearch).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      nonBlockingPublicSearch: true,
      maxPublicSearchAddedLatencyMs: 0
    });
    expect(restricted.nonBlockingSearch.observedScenarios).toEqual(expect.arrayContaining(["ransomware_query"]));
    expect(restricted.nonBlockingSearch.packets.every((packet) =>
      packet.publicSearchAction === "continue_clear_web_and_public_channel" &&
      packet.proof.doesNotBlockPublicSearch &&
      packet.proof.doesNotPromoteRestrictedFacts &&
      packet.proof.noUnsafeAccess &&
      packet.noLeakSerialization.passed
    )).toBe(true);
    expect(restricted.analystOperations).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true
    });
    expect(restricted.analystOperations.observedScenarios).toEqual(expect.arrayContaining(["ransomware_query", "actor_leak_site_claim", "victim_notification_packet"]));
    expect(restricted.analystOperations.packets.every((packet) =>
      packet.schedulerIsolation.directEgressAllowed === false &&
      packet.proof.noStolenFilesDownloaded &&
      packet.proof.noCredentials &&
      packet.proof.noAuthBypass &&
      packet.proof.noCaptchaSolving &&
      packet.proof.noPrivateAccess &&
      packet.proof.noThreatActorInteraction &&
      packet.noLeakSerialization.passed
    )).toBe(true);
    expect(JSON.stringify(response.restrictedMetadata)).not.toContain("http://");
    expect(JSON.stringify(response.restrictedMetadata)).not.toContain(".onion");
  });

  test("wires restricted metadata status for actor victim country sector and unknown queries", async () => {
    const store = new InMemoryScraperStore();
    for (const item of [
      source({ id: "src_runtime_tor", type: "tor_metadata", url: "http://runtime.onion/posts", accessMethod: "approved_proxy", status: "active", risk: "high", legalNotes: "Approved metadata-only fixture.", governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-05-01T00:00:00.000Z", approvedBy: "reviewer" } }),
      source({ id: "src_runtime_i2p", type: "i2p_metadata", url: "http://runtime.i2p/posts", accessMethod: "approved_proxy", status: "active", risk: "high", legalNotes: "Approved metadata-only fixture.", governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-05-01T00:00:00.000Z", approvedBy: "reviewer" } }),
      source({ id: "src_runtime_freenet", type: "freenet_metadata", url: "freenet:runtime/posts", accessMethod: "approved_proxy", status: "active", risk: "high", legalNotes: "Approved metadata-only fixture.", governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-05-01T00:00:00.000Z", approvedBy: "reviewer" } })
    ]) store.saveSource(item);
    const saveRestrictedCapture = (input: { id: string; sourceId: string; actor: string; victim: string; sector: string; country: string; data: string }) => store.saveCapture({
      id: input.id,
      sourceId: input.sourceId,
      url: `http://redacted-${input.id}.onion/post`,
      collectedAt: "2026-05-24T00:00:00.000Z",
      contentHash: `hash_${input.id}`,
      mediaType: "text/plain",
      storageKind: "metadata_only",
      metadata: {
        adapter: "darknet_metadata",
        leakSite: {
          actorName: input.actor,
          victimName: input.victim,
          claimDate: "2026-05-20",
          claimedSector: input.sector,
          claimedCountry: input.country,
          claimedDataCategory: input.data,
          postStatus: "new",
          sourceTimestamp: "2026-05-23T00:00:00.000Z",
          urlHash: `urlhash_${input.id}`,
          screenshotHash: `screenhash_${input.id}`,
          confidence: 0.81
        },
        policyDecision: { id: `policy_${input.id}` }
      },
      sensitive: true
    });
    saveRestrictedCapture({ id: "akira", sourceId: "src_runtime_tor", actor: "Akira", victim: "Fjord Energy AS", sector: "Energy", country: "NO", data: "contracts" });
    saveRestrictedCapture({ id: "sample", sourceId: "src_runtime_i2p", actor: "SampleLocker", victim: "Baltic Health AB", sector: "Healthcare", country: "SE", data: "patient-system metadata" });
    saveRestrictedCapture({ id: "example", sourceId: "src_runtime_freenet", actor: "ExampleCrew", victim: "Nordic Manufacturing Oy", sector: "Manufacturing", country: "FI", data: "invoices" });

    const queries = [
      ["Akira", "actor", "partial_metadata", 1],
      ["Fjord Energy", "victim", "partial_metadata", 1],
      ["NO", "country", "partial_metadata", 1],
      ["Manufacturing", "sector", "partial_metadata", 1],
      ["totally unknown query", "actor", "approval_required", 0]
    ] as const;

    for (const [query, entityType, partialState, matchingResultCount] of queries) {
      const response = await body(await handleApiRequest(api(`/v1/intel/search?q=${encodeURIComponent(query)}&entityType=${entityType}`), {
        store,
        frontier: new FocusedFrontier()
      }));
      expect(response.restrictedMetadata).toMatchObject({
        query: {
          query,
          entityType,
          matchingResultCount,
          partialState
        },
        operationalSla: {
          metadataOnly: true,
          safeForApi: true
        },
        enforcement: {
          metadataOnly: true,
          safeForApi: true
        },
        auditReplay: {
          metadataOnly: true,
          safeForApi: true
        },
        connectorCertification: {
          metadataOnly: true,
          safeForApi: true,
          dryRunOnly: true,
          noLeakSerialization: {
            passed: true
          }
        },
        agent10ReleasePacket: {
          runtimeProofName: "restricted_metadata_sla"
        },
        agent06EvidenceHandoffProof: { unsafeDetected: false }
      });
      const serialized = JSON.stringify(response.restrictedMetadata);
      expect(serialized).not.toContain("http://");
      expect(serialized).not.toContain(".onion");
      expect(serialized).not.toContain("redacted-");
      expect(serialized).not.toContain("patient-system metadata file");
    }
  });

  test("reports disabled darknet metadata live search when kill switch is active", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_disabled_onion",
      name: "Approved onion metadata",
      type: "tor_metadata",
      url: "http://claims.onion/actor/{query}",
      accessMethod: "approved_proxy",
      status: "active",
      risk: "high",
      legalNotes: "Approved metadata-only onion source fixture.",
      approvedAt: new Date(0).toISOString(),
      approvedBy: "reviewer",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: new Date(0).toISOString(),
        approvedBy: "reviewer"
      }
    }));
    const config = loadRuntimeConfig({});
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=LockBit&entityType=actor"), {
      store,
      frontier: new FocusedFrontier(),
      config: {
        ...config,
        limits: { ...config.limits, maxConcurrentDarknetMetadataTasks: 0 }
      }
    }));

    expect(response.darknetMetadata).toMatchObject({
      status: "disabled",
      queuedTasks: 0,
      blocked: [{
        sourceId: "src_disabled_onion",
        state: "disabled"
      }]
    });
    expect((response.planner as { coverageGaps: string[] }).coverageGaps).toContain("public_chat");
  });

  test("exposes search quality DTOs on live intel search without leaking raw evidence", async () => {
    const cases: Array<{
      name: string;
      query: string;
      body: string;
      metadata: Record<string, unknown>;
      storageKind?: RawCapture["storageKind"];
      expectStatus?: string;
      expectWarning?: string;
    }> = [
      {
        name: "ready",
        query: "APT29",
        body: "Mandiant linked APT29 to phishing and credential dumping against Northwind Health in the healthcare sector. First seen 2026-05-22.",
        metadata: { evidenceStage: "reviewed_promoted", graphReviewState: "accepted" },
        expectStatus: "ready"
      },
      {
        name: "partial",
        query: "Partial Example",
        body: "Live discovery snippet: Partial Example may be phishing against Northwind Health.",
        metadata: { evidenceStage: "live_discovery" },
        expectStatus: "partial"
      },
      {
        name: "weak",
        query: "Crimson Pineapple",
        body: "Crimson Pineapple appeared in a copied threat actor list.",
        metadata: { evidenceStage: "live_discovery" },
        expectWarning: "weak-evidence"
      },
      {
        name: "contradicted",
        query: "Volt Typhoon",
        body: "Vendors disputed attribution to Volt Typhoon but mentioned living off the land.",
        metadata: { evidenceStage: "captured_page", graphReviewState: "contradiction" },
        expectStatus: "contradicted"
      },
      {
        name: "stale",
        query: "Turla",
        body: "Researchers linked Turla to Snake malware against Example Embassy.",
        metadata: { evidenceStage: "captured_page", graphReviewState: "stale" },
        expectStatus: "stale"
      },
      {
        name: "source-biased",
        query: "Scattered Spider",
        body: "Public channel message says Scattered Spider may be phishing telecom targets.",
        metadata: { evidenceStage: "public_channel_message", adapter: "telegram_public" },
        expectStatus: "source-biased"
      },
      {
        name: "insufficient-capture",
        query: "Insufficient Capture",
        body: "Live discovery snippet: Insufficient Capture may be active.",
        metadata: { evidenceStage: "live_discovery" },
        expectWarning: "insufficient-capture"
      },
      {
        name: "needs-review",
        query: "Needs Review",
        body: "Researchers linked Needs Review to credential theft against Example Telecom in 2026.",
        metadata: { evidenceStage: "captured_page", graphReviewState: "needs-human-review" },
        expectWarning: "needs-review"
      }
    ];

    for (const item of cases) {
      const store = new InMemoryScraperStore();
      store.saveCapture(fixtureCapture({
        id: `cap_quality_${item.name}`,
        tenantId: undefined,
        url: `https://quality.example.test/${item.name}`,
        body: item.body,
        storageKind: item.storageKind ?? "inline_text",
        metadata: { title: `${item.query} quality fixture`, ...item.metadata }
      }));
      const response = await body(await handleApiRequest(api(`/v1/intel/search?q=${encodeURIComponent(item.query)}&entityType=actor`), {
        store,
        frontier: new FocusedFrontier()
      }));
      const quality = response.quality as {
        status: string;
        score: number;
        canPromoteToReady: boolean;
        evidenceStageCounts: Record<string, number>;
        analystActions: Array<{ kind: string; evidenceIds: string[] }>;
        publicWarningText: string[];
        publicWarningCodes: string[];
      };
      const publicTiAnswer = response.publicTiAnswer as {
        schemaVersion: string;
        displayState: string;
        safeSummary: string[];
        confidence: { score: number; label: string };
        waitReasons: Array<{ code: string }>;
        nextPoll: { pollable: boolean; nextPollAfterSeconds: number; cursorRequired: boolean };
        evidenceLedgerReferences: Array<{ ledgerIds: string[]; evidenceIds: string[] }>;
        graphStixReadiness: { proofRoute: string };
        safeWording: { overstatesLiveSnippets: boolean; rawEvidenceExposed: boolean; restrictedPayloadsExposed: boolean };
        route: { publicWrapperPath: string; publicWrapperMethod: string; cursor: string; nextCursor: string };
        stateMachine: {
          schemaVersion: string;
          state: string;
          phase: string;
          progress: Record<string, boolean>;
          changedSinceCursor: { cursor: string; nextCursor: string; changed: unknown[]; newDeltaCount: number };
          polling: { nextPollAfterSeconds: number; nextPollAt: string; pollReason: string; cursorRequired: boolean };
          holds: {
            sourceActivationGaps: string[];
            schedulerPressure: { active: boolean; state: string; reasons: string[] };
            publicChannelCanaryImpact: { status: string; impact: string };
            restrictedMetadataBlocked: { blocked: boolean; status: string };
            evidenceLedgerHolds: string[];
            graphStixHolds: { hold: boolean; state: string };
          };
          confidenceLabel: string;
          safeNoResult: { noResult: boolean; overstatesAbsence: boolean };
        };
        releaseCandidate: {
          schemaVersion: string;
          state: string;
          visibleAnswer: { displayState: string; canRenderFacts: boolean; safeSummaryMode: string; caveatRequired: boolean; confidenceLabel: string };
          releaseGates: Array<{ name: string; state: string; visibleAnswerEffect: string; hold: boolean; proofRoute: string }>;
          effects: Record<string, { state: string; effect: string; hold: boolean; proofRoute: string }>;
          agent10RcGate: { status: string; decision: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; proofCommands: string[] };
          publicPostCompatibility: { canonicalMethod: string; canonicalPath: string; mapsTo: string; stableFieldsPreserved: boolean; cursorRequired: boolean; noLeakDto: boolean };
          uiFields: string[];
          fixtures: Array<{ state: string; query: string; queryClass: string; publicPostCompatible: boolean }>;
        };
        ux: {
          schemaVersion: string;
          state: string;
          compactAnswerCopy: { heading: string; summary: string[]; statusLine: string; caveats: string[] };
          freshness: { updatedAt: string; updatedLabel: string; lastSeenAt?: string; lastSeenLabel: string; showLastSeen: boolean; semantics: string; noLastSeenFiction: boolean };
          polling: { intervalSeconds: number; nextPollAfterSeconds: number; cursorRequired: boolean; hint: string };
          sourceCaveats: string[];
          evidenceStageLabels: Record<string, { label: string; count: number }>;
          forbiddenCopy: string[];
          publicWrapperCompatibility: { canonicalMethod: string; canonicalPath: string; noDefaultQuery: boolean };
        };
      };

      if (item.expectStatus) expect(quality.status).toBe(item.expectStatus);
      if (item.expectWarning) expect(quality.publicWarningCodes).toContain(item.expectWarning);
      expect(quality.score).toBeGreaterThanOrEqual(0);
      expect(quality.score).toBeLessThanOrEqual(1);
      expect(Object.keys(quality.evidenceStageCounts)).toContain("captured_page");
      expect(publicTiAnswer.schemaVersion).toBe("ti.public_answer_contract.v1");
      expect(["ready", "partial", "review_required", "blocked"]).toContain(publicTiAnswer.displayState);
      expect(publicTiAnswer.safeSummary.length).toBeGreaterThan(0);
      expect(publicTiAnswer.confidence.score).toBeGreaterThanOrEqual(0);
      expect(publicTiAnswer.nextPoll.cursorRequired).toBe(true);
      expect(publicTiAnswer.evidenceLedgerReferences.length).toBeGreaterThan(0);
      expect(publicTiAnswer.evidenceLedgerReferences.every((ref) => ref.ledgerIds.length > 0 && ref.evidenceIds.length > 0)).toBe(true);
      expect(publicTiAnswer.graphStixReadiness.proofRoute).toBe("/v1/exports/stix");
      expect(publicTiAnswer.route).toMatchObject({ publicWrapperPath: "/api/ti/search", publicWrapperMethod: "POST" });
      expect(publicTiAnswer.stateMachine.schemaVersion).toBe("ti.public_answer_polling_state.v1");
      expect([
        "first_response",
        "queued_collection",
        "live_partial",
        "promoted_evidence",
        "review_required",
        "blocked",
        "no_result",
        "stale",
        "contradicted",
        "source_biased",
        "ready",
        "error"
      ]).toContain(publicTiAnswer.stateMachine.state);
      expect(publicTiAnswer.stateMachine.changedSinceCursor.cursor).toBe(publicTiAnswer.route.cursor);
      expect(publicTiAnswer.stateMachine.changedSinceCursor.nextCursor).toBe(publicTiAnswer.route.nextCursor);
      expect(publicTiAnswer.stateMachine.polling.cursorRequired).toBe(true);
      expect(publicTiAnswer.stateMachine.holds.schedulerPressure.state).toBeTruthy();
      expect(publicTiAnswer.stateMachine.safeNoResult.overstatesAbsence).toBe(false);
      expect(publicTiAnswer.releaseCandidate.schemaVersion).toBe("ti.public_answer_release_candidate.v1");
      expect([
        "ready",
        "canary_ready",
        "canary_with_warnings",
        "partial",
        "review_required",
        "blocked",
        "no_result",
        "stale",
        "contradicted",
        "source_biased",
        "provider_unavailable",
        "scraper_unavailable",
        "policy_blocked"
      ]).toContain(publicTiAnswer.releaseCandidate.state);
      expect(publicTiAnswer.releaseCandidate.releaseGates.map((gate) => gate.name)).toEqual([
        "sourceCanary",
        "schedulerControlPlane",
        "publicChannelPromotion",
        "restrictedEmergencyStop",
        "evidenceCutover",
        "graphExport",
        "apiContractState"
      ]);
      expect(publicTiAnswer.releaseCandidate.agent10RcGate).toMatchObject({
        dryRun: true,
        willMutate: false,
        willStartCrawling: false
      });
      expect(publicTiAnswer.releaseCandidate.publicPostCompatibility).toMatchObject({
        canonicalMethod: "POST",
        canonicalPath: "/api/ti/search",
        mapsTo: "/v1/intel/search",
        stableFieldsPreserved: true,
        cursorRequired: true,
        noLeakDto: true
      });
      expect(publicTiAnswer.releaseCandidate.uiFields).toEqual(expect.arrayContaining(["visibleAnswer", "releaseGates", "agent10RcGate", "publicPostCompatibility"]));
      expect(publicTiAnswer.releaseCandidate.fixtures.map((fixture) => fixture.state)).toEqual(expect.arrayContaining(["ready", "provider_unavailable", "scraper_unavailable", "policy_blocked"]));
      expect(publicTiAnswer.ux).toMatchObject({
        schemaVersion: "ti.public_answer_ux.v1",
        polling: {
          intervalSeconds: 3,
          nextPollAfterSeconds: 3,
          cursorRequired: true,
          hint: "poll_after_3_seconds"
        },
        publicWrapperCompatibility: {
          canonicalMethod: "POST",
          canonicalPath: "/api/ti/search",
          noDefaultQuery: true
        }
      });
      expect(publicTiAnswer.ux.compactAnswerCopy.summary.length).toBeGreaterThan(0);
      expect(publicTiAnswer.ux.compactAnswerCopy.summary.length).toBeLessThanOrEqual(3);
      expect(publicTiAnswer.ux.freshness.updatedLabel).toBe("Updated");
      expect(publicTiAnswer.ux.freshness.lastSeenLabel).toBe("Last seen");
      expect(publicTiAnswer.ux.freshness.semantics).toContain("updated is the API response time");
      expect(publicTiAnswer.ux.forbiddenCopy).toEqual(expect.arrayContaining(["not in local cache", "local cache", "demo", "default APT29"]));
      expect(JSON.stringify(publicTiAnswer.ux.compactAnswerCopy)).not.toMatch(/not in local cache|local cache|default APT29/i);
      expect(publicTiAnswer.safeWording).toMatchObject({
        overstatesLiveSnippets: false,
        rawEvidenceExposed: false,
        restrictedPayloadsExposed: false
      });
      expect(JSON.stringify(quality)).not.toContain(item.body);
      expect(JSON.stringify(publicTiAnswer)).not.toContain(item.body);
      expect(JSON.stringify(quality)).not.toContain("https://quality.example.test");
      expect(JSON.stringify(publicTiAnswer)).not.toContain("https://quality.example.test");
    }
  });

  test("exposes quality evaluate examples and alias-collision warnings", async () => {
    const store = new InMemoryScraperStore();
    store.saveCapture(fixtureCapture({
      id: "cap_quality_alias",
      tenantId: undefined,
      url: "https://quality.example.test/akira-alias",
      body: "Cyber gang list: Akira, ALPHV, BlackCat, and LockBit were named historically in a ransomware rebrand roundup.",
      metadata: { title: "Akira alias collision", evidenceStage: "captured_page" }
    }));

    const response = await body(await handleApiRequest(api("/v1/quality/evaluate?q=Akira"), {
      store,
      frontier: new FocusedFrontier()
    }));
    const quality = response.quality as {
      analystActions: Array<{ kind: string }>;
      publicWarningCodes: string[];
      publicWarningText: string[];
    };
    const dashboard = response.dashboard as {
      schemaVersion: string;
      fields: Array<{ field: string; gate: string; feedbackTargets: string[] }>;
      metrics: { usefulAnswerRate: number; citationAvailability: number; sourceFamilyDiversity: number };
      reviewQueues: { analystReview: string[]; graphReview: string[] };
      releaseGate: { decision: string };
    };
    const entityResolutionWorkbench = response.entityResolutionWorkbench as {
      schemaVersion: string;
      candidates: Array<{ kind: string; canonicalValue: string; reviewState: string; uncertaintyReasons: string[]; correctionActions: string[]; provenance: Array<{ evidenceId: string; captureId: string }> }>;
      reviewQueues: { aliasCollisions: string[]; graphReview: string[] };
      safety: { rawEvidenceExposed: boolean; restrictedPayloadsExposed: boolean; preservesUncertainty: boolean };
    };
    const timelinessGroundTruth = response.timelinessGroundTruth as {
      schemaVersion: string;
      queryClass: string;
      fields: Array<{ field: string; status: string; score: number }>;
      releaseImpact: { publicAnswerState: string; holdsReadyPromotion: boolean; caveats: string[] };
      safety: { rawEvidenceExposed: boolean; sourceUrlsExposed: boolean; preservesUncertainty: boolean };
    };
    const highPriorityActorFreshnessDashboard = response.highPriorityActorFreshnessDashboard as {
      schemaVersion: string;
      actors: Array<{
        id: string;
        actor: string;
        priority: string;
        cadence: { expected: string; targetMaxAgeDays: number; nextReviewDueAt: string };
        states: { overall: string; publicAnswerState: string; blocksReadyPromotion: boolean };
        evidenceIds: string[];
        sourceIds: string[];
        handoffs: { agent02SchedulerCadence?: string; agent09ApiField?: string; agent10ReleaseGate?: string };
      }>;
      summary: { actorCount: number; dailyDueCount: number; weeklyDueCount: number; readyPromotionHoldCount: number };
      queues: { dailyRefresh: string[]; weeklyRefresh: string[]; staleAnswerHolds: string[]; sourceGapReview: string[] };
      routing: { agent02SchedulerCadence: string[]; agent04FreshnessSourceGaps: string[]; agent09ApiFields: string[]; agent10ReleaseGates: string[] };
      policy: { staleCannotBeLatest: boolean; unknownActorSearchingOnly: boolean; noAutomaticPromotion: boolean; noAutonomousScraping: boolean };
      safety: { rawEvidenceExposed: boolean; sourceUrlsExposed: boolean; restrictedPayloadsExposed: boolean; objectKeysExposed: boolean };
    };
    const attackMappingQuality = response.attackMappingQuality as {
      schemaVersion: string;
      summary: { candidateCount: number; mappedAttackIdCount: number };
      techniques: Array<{ attackId?: string; confidence: number; reviewState: string; stixEligibility: { impact: string }; citations: Array<{ evidenceId: string; sourceId: string; captureId: string }> }>;
      reviewQueues: { missingTechniqueId: string[]; stixBlocked: string[] };
      releaseImpact: { publicAnswerState: string; holdsReadyPromotion: boolean; caveats: string[] };
      safety: { rawEvidenceExposed: boolean; sourceUrlsExposed: boolean; preservesUncertainty: boolean };
    };
    const analystFeedbackLoop = response.analystFeedbackLoop as {
      schemaVersion: string;
      items: Array<{ mark: string; target: string; immutable: boolean; appliesAutomatically: boolean }>;
      routing: { qualityGate: string[]; entityResolution: string[]; publicAnswerCaveats: string[]; parserRepair: string[] };
      policy: { modelSelfMutationAllowed: boolean; analystApprovalRequired: boolean; preservesProvenance: boolean };
      safety: { rawEvidenceExposed: boolean; sourceUrlsExposed: boolean; restrictedPayloadsExposed: boolean };
    };
    const actorProfileReviewWorkbench = response.actorProfileReviewWorkbench as {
      schemaVersion: string;
      fields: Array<{
        field: string;
        state: string;
        evidenceIds: string[];
        uncertainty: { preservesUncertainty: boolean; reviewReasons: string[] };
        correctionActions: Array<{ kind: string; manualOnly: boolean; appliesAutomatically: boolean; handoffs: { agent09ApiContracts?: string } }>;
      }>;
      summary: { fieldCount: number; reviewRequiredCount: number; actionCount: number };
      queues: { missing: string[]; underconfident: string[]; needsEvidence: string[] };
      routing: { agent01SourceGaps: string[]; agent06ClaimLedger: string[]; agent09ApiContracts: string[]; agent10ReleaseGates: string[] };
      policy: { modelSelfMutationAllowed: boolean; analystApprovalRequired: boolean; preservesProvenance: boolean; manualCorrectionsOnly: boolean };
      safety: { rawEvidenceExposed: boolean; sourceUrlsExposed: boolean; restrictedPayloadsExposed: boolean };
    };
    const evaluationDatasetGovernance = response.evaluationDatasetGovernance as {
      schemaVersion: string;
      summary: { labelCount: number; caseKinds: string[]; releaseGate: string; auditHoldCount: number };
      labels: Array<{
        id: string;
        caseKind: string;
        subject: string;
        expectedPublicState: string;
        evidenceIds: string[];
        claimLedgerRefs: string[];
        sourceFamily: string;
        confidence: number;
        freshness: string;
        allowedDownstreamUse: string[];
        publicSemantics: { unknownActorSearchingOnly: boolean; noDefaultActor: boolean; noDemoOrCacheProse: boolean; preservesUncertainty: boolean };
        provenance: { redacted: boolean; evidenceIds: string[]; claimLedgerRefs: string[] };
      }>;
      auditChecks: Array<{ code: string; status: string; labelIds: string[]; downstreamOwners: string[] }>;
      routing: {
        agent01SourceGaps: string[];
        agent04PublicBenchmarks: string[];
        agent06EvidenceReplay: string[];
        agent08GraphDrift: string[];
        agent09ApiRegressionFixtures: string[];
        agent10ReleaseGates: string[];
      };
      policy: { labelsAreImmutable: boolean; analystApprovalRequired: boolean; preservesUncertainty: boolean; noAutomaticPromotion: boolean; unknownActorSearchingOnly: boolean };
      safety: { rawEvidenceExposed: boolean; sourceUrlsExposed: boolean; restrictedPayloadsExposed: boolean; objectKeysExposed: boolean };
    };
    const ctiEvaluationDatasetPack = response.ctiEvaluationDatasetPack as {
      schemaVersion: string;
      fixtures: Array<{
        scenario: string;
        expectedPublicState: string;
        evidenceIds: string[];
        claimLedgerRefs: string[];
        immutable: boolean;
        appliesAutomatically: boolean;
        noLeak: boolean;
        metrics: {
          provenanceRequired: boolean;
          staleAnswerRejectionRequired: boolean;
          unknownSearchingRequired: boolean;
          restrictedNoLeakRequired: boolean;
          contradictionHoldRequired: boolean;
        };
      }>;
      metrics: { fixtureCount: number; actorExtractionCount: number; victimExtractionCount: number; ttpExtractionCount: number; iocExtractionCount: number; staleAnswerRejectionCount: number; unknownSearchingCount: number; restrictedNoLeakCount: number; contradictionHandlingCount: number; provenanceCompletenessTarget: number };
      routing: { agent03ParserCertification: string[]; agent06EvidenceReplay: string[]; agent08GraphHolds: string[]; agent09ApiRegression: string[]; agent10ReleaseGates: string[] };
      policy: { fixturesAreImmutable: boolean; analystApprovalRequired: boolean; noAutomaticPromotion: boolean; noModelSelfMutation: boolean; unknownActorSearchingOnly: boolean; staleEvidenceCannotBeLatest: boolean };
      safety: { rawEvidenceExposed: boolean; sourceUrlsExposed: boolean; restrictedPayloadsExposed: boolean; objectKeysExposed: boolean };
    };
    const analystQualityReviewQueue = response.analystQualityReviewQueue as {
      schemaVersion: string;
      items: Array<{
        field: string;
        state: string;
        evidenceIds: string[];
        ledgerIds: string[];
        labelIds: string[];
        requiredActions: string[];
        releaseImpact: { blocksReadyPromotion: boolean; publicAnswerState: string; apiSignal: string; agent10Signal: string };
        immutable: boolean;
        appliesAutomatically: boolean;
      }>;
      releaseGate: {
        decision: string;
        requiredChecks: Array<{ code: string; status: string; itemIds: string[] }>;
        publicAnswerState: string;
        blocksReadyPromotion: boolean;
      };
      qualityReleaseSignals: { agent09PublicApi: string[]; agent10ReleaseBoard: string[]; regressionFixtures: string[]; staleAnswerPrevention: string[] };
      routing: { actorSummary: string[]; recentActivity: string[]; victims: string[]; ttps: string[]; infrastructure: string[]; malwareTools: string[]; cves: string[]; sourceGaps: string[]; unknownQuery: string[] };
      policy: { analystApprovalRequired: boolean; modelSelfMutationAllowed: boolean; preservesUncertainty: boolean; manualReviewOnly: boolean; unknownActorSearchingOnly: boolean };
      safety: { rawEvidenceExposed: boolean; sourceUrlsExposed: boolean; restrictedPayloadsExposed: boolean; objectKeysExposed: boolean };
    };
    const analystFeedbackLearningLoop = response.analystFeedbackLearningLoop as {
      schemaVersion: string;
      records: Array<{
        type: string;
        immutable: boolean;
        appliesAutomatically: boolean;
        prohibitedEffects: string[];
        replay: { requiresHumanApproval: boolean };
      }>;
      scorecards: Array<{ metric: string; status: string; score: number; eventIds: string[] }>;
      fixtures: Array<{ scenario: string; expectedPublicState: string; noLeak: boolean }>;
      persistence: { mode: string; appendOnly: boolean; replayOrder: string[]; importSemantics: string[]; mutationBoundary: string };
      routeState: { explainsPartial: boolean; explainsSearching: boolean; explainsHeld: boolean; explainsReady: boolean };
      routing: {
        agent03ParserRepair: string[];
        agent04SourceCoverage: string[];
        agent08GraphCorrections: string[];
        agent09PublicApiFields: string[];
        agent10ReleaseGates: string[];
      };
      policy: { analystApprovalRequired: boolean; modelSelfMutationAllowed: boolean; autonomousScrapingAllowed: boolean; silentSourceActivationAllowed: boolean; preservesUncertainty: boolean };
      safety: { rawEvidenceExposed: boolean; sourceUrlsExposed: boolean; restrictedPayloadsExposed: boolean; objectKeysExposed: boolean };
    };
    const activeLearningCandidateQueue = response.activeLearningCandidateQueue as {
      schemaVersion: string;
      candidates: Array<{
        type: string;
        immutable: boolean;
        appliesAutomatically: boolean;
        noAutonomousChangeGuarantee: boolean;
        humanApproval: { required: boolean; forbiddenActions: string[] };
      }>;
      workflow: { appendOnly: boolean; humanApprovalRequired: boolean; fixtureRequiredBeforeApproval: boolean; replayRequiredBeforePromotion: boolean; mutationBoundary: string };
      scorecards: Array<{ metric: string; before: number; expectedAfter: number; delta: number }>;
      fixturePack: Array<{ scenario: string; noLeak: boolean }>;
      summarySpecificityThresholds: Array<{ field: string; minimumSpecificity: number; warnBelow: number; holdBelow: number; requiredSignals: string[]; publicAnswerEffect: string }>;
      rowUsefulnessDeltas: Array<{ candidateId: string; before: number; expectedAfter: number; delta: number; expectedMarketplaceEffect: string; promotionState: string; regressionCaseIds: string[] }>;
      replayPromotionReport: {
        schemaVersion: string;
        candidateCount: number;
        promotionChecks: Array<{ code: string; status: string }>;
        forbiddenActions: string[];
        policy: { analystApprovalRequired: boolean; replayRequiredBeforePromotion: boolean; noAutomaticPromotion: boolean; noRuntimeMutation: boolean };
        safety: { rawEvidenceExposed: boolean; sourceUrlsExposed: boolean; restrictedPayloadsExposed: boolean; objectKeysExposed: boolean };
      };
      routing: {
        agent03ParserCertification: string[];
        agent04FreshnessSourceGaps: string[];
        agent06EvidenceReplay: string[];
        agent08GraphCorrections: string[];
        agent09ApiFields: string[];
        agent10ReleaseGates: string[];
      };
      policy: { analystApprovalRequired: boolean; modelSelfMutationAllowed: boolean; autonomousScrapingAllowed: boolean; silentSourceActivationAllowed: boolean; preservesUncertainty: boolean; unknownActorSearchingOnly: boolean };
      safety: { rawEvidenceExposed: boolean; sourceUrlsExposed: boolean; restrictedPayloadsExposed: boolean; objectKeysExposed: boolean };
    };
    const qualityRuntimeValueGates = response.qualityRuntimeValueGates as {
      schemaVersion: string;
      queryClass: string;
      summary: { gateCount: number; analystUsefulnessScore: number; decision: string; warningCount: number; holdCount: number };
      gates: Array<{ name: string; status: string; score: number; publicAnswerEffect: string; remediationOwners: string[]; reasons: string[] }>;
      darkwebMetadataRules: { metadataMayImproveHints: boolean; publicPromotionRequiresCorroboration: boolean; heldStates: string[]; forbiddenFields: string[] };
      sourceAtlasFeedback: Array<{ signal: string; status: string; expectedAnswerImpact: string }>;
      fixtureCorpus: Array<{ id: string; queryClass: string; expectedPublicState: string; noLeak: boolean }>;
      programBdQualityEvaluationPack: {
        schemaVersion: string;
        summary: { defaultWatchlistActorCount: number; unknownFixtureCount: number; routeVisibleGatePacket: boolean };
        rowMetricNames: string[];
        paidRowQualityGate: {
          schemaVersion: string;
          pricing: { resultPriceUsdPer1000Rows: number; actorStartUsd: number; effectiveDate: string };
          liveBaselines: Array<{ runId: string }>;
          metricThresholds: Array<{ metric: string }>;
          sourceTierGates: Array<{ tier: number }>;
          apifyDatasetFields: string[];
          buyerVisibleQualityLiftGate: {
            schemaVersion: string;
            routeVisibleOn: string[];
            qualityLiftAcceptedCount: number;
            qualityLiftRejectedCount: number;
            sellableRowsAdded: number;
            freshRowsAdded: number;
            projectedRowRevenueDeltaUsd: number;
            passCriteria: {
              acceptedRequiresDecisionLift: boolean;
              rejectedRepairsDoNotCountTowardPayworthyRate: boolean;
            };
            rejectedExamples: Array<{ rejectionReason: string }>;
          };
          qualityConversionGate: {
            schemaVersion: string;
            routeVisibleOn: string[];
            acceptedRows: number;
            rejectedBloatRows: number;
            sellableRowLift: number;
            bloatBlocked: number;
            examples: Array<{ actor: string; decision: string }>;
            rejectedBloatCases: Array<{ blockedReason: string }>;
            sourceParserHandoffs: Array<{ owner: string }>;
          };
          liveFreshnessQualityGate: {
            schemaVersion: string;
            routeVisibleOn: string[];
            freshRowsPromoted: number;
            caveatedRowsKept: number;
            staleLatestClaimsBlocked: number;
            bloatRowsSuppressed: number;
            examples: Array<{ actor: string; decision: string; blocksLatestClaim: boolean }>;
            blockedLatestClaimCases: Array<{ blockedReason: string }>;
            sourceParserHandoffs: Array<{ owner: string }>;
          };
	          freshnessRepairLoop: {
	            schemaVersion: string;
	            routeVisibleOn: string[];
	            repairQueue: Array<{ actor: string; blocker: string; proofNeeded: string[]; expectedBuyerVisibleLift: string[]; noLeak: boolean }>;
            lift: {
              staleRowsBlocked: number;
              genericRowsRepaired: number;
              aliasOrUnrelatedRowsSuppressed: number;
              caveatedRowsPreserved: number;
              sellableRowsGained: number;
              usefulRowsGained: number;
              averageBuyerValueDelta: number;
            };
	            ownerHandoffs: Array<{ owner: string }>;
	            noLeakProof: { rawEvidenceExposed: boolean; unsafeUrlsExposed: boolean; restrictedPayloadsExposed: boolean; objectKeysExposed: boolean };
	          };
	          entitySpecificityLift: {
	            schemaVersion: string;
	            routeVisibleOn: string[];
	            fixtures: Array<{ actor: string; missingFields: string[]; blockerCodesRemoved: string[]; proofNeeded: string[]; expectedBuyerVisibleLift: string[]; whyWorthPayingFor: string; repairAction: string; noLeak: boolean }>;
	            lift: { rowsLifted: number; rowsSuppressed: number; rowsHeldWithRepairAction: number; blockerCodesRemoved: number; averageBuyerValueDelta: number };
	            ownerHandoffs: Array<{ owner: string }>;
	            noLeakProof: { rawEvidenceExposed: boolean; unsafeUrlsExposed: boolean; restrictedPayloadsExposed: boolean; objectKeysExposed: boolean };
	          };
	        };
        watchlistFixtures: Array<{
          actor: string;
          requiredMetrics: string[];
          regressionFocus: string[];
          gatePacket: {
            status: string;
            failingFields: string[];
            remediationAction: string;
            downstreamEligibility: { publicUi: boolean; apifyOutput: boolean; graphExport: boolean; stixExport: boolean };
          };
          provenance: { fixtureIds: string[]; redacted: boolean };
          noLeak: boolean;
        }>;
        regressionGuardrails: Array<{ id: string; status: string; prevents: string; remediationAction: string }>;
        routing: { agent07ExtractorFixtures: string[]; agent09ApiGatePacket: string[]; agent10ReleaseGate: string[] };
      };
      remediationHandoffs: { agent01SourceActivation: string[]; agent05RestrictedReview: string[]; agent10ReleaseRollback: string[] };
      releaseGate: { decision: string; blocksReadyPromotion: boolean; proofCommands: string[] };
      policy: { analystApprovalRequired: boolean; noAutomaticPromotion: boolean; unknownActorSearchingOnly: boolean; staleEvidenceCannotBeLatest: boolean; metadataOnlyDarkwebCannotStandAlone: boolean };
      safety: { rawEvidenceExposed: boolean; sourceUrlsExposed: boolean; restrictedPayloadsExposed: boolean; objectKeysExposed: boolean; unsafeDarkwebTargetsExposed: boolean };
    };
    const publicTiAnswer = response.publicTiAnswer as { schemaVersion: string; displayState: string; waitReasons: Array<{ code: string }> };
    const examples = response.examples as Array<{ quality: { status: string }; dashboard: { schemaVersion: string } }>;

    expect(examples.map((example) => example.quality.status)).toEqual(expect.arrayContaining([
      "ready",
      "partial",
      "weak-evidence",
      "contradicted",
      "stale",
      "source-biased",
      "insufficient-capture",
      "needs-review"
    ]));
    expect(quality.publicWarningCodes).toContain("alias_collision_warning");
    expect(quality.analystActions.map((action) => action.kind)).toContain("suppress_noisy_alias");
    expect(dashboard).toMatchObject({
      schemaVersion: "ti.search_quality_dashboard.v1",
      releaseGate: { decision: expect.any(String) }
    });
    expect(dashboard.fields.map((field) => field.field)).toEqual(expect.arrayContaining(["actor_summary", "provenance", "freshness", "iocs"]));
    expect(dashboard.metrics.usefulAnswerRate).toBeGreaterThanOrEqual(0);
    expect(dashboard.metrics.citationAvailability).toBeGreaterThanOrEqual(0);
    expect(dashboard.metrics.sourceFamilyDiversity).toBeGreaterThanOrEqual(1);
    expect(entityResolutionWorkbench.schemaVersion).toBe("ti.entity_resolution_workbench.v1");
    expect(entityResolutionWorkbench.candidates.map((candidate) => candidate.kind)).toEqual(expect.arrayContaining(["actor_alias", "ransomware_rebrand"]));
    expect(entityResolutionWorkbench.candidates.some((candidate) => candidate.canonicalValue === "Akira" && candidate.correctionActions.includes("send_to_graph_review"))).toBe(true);
    expect(entityResolutionWorkbench.reviewQueues.graphReview.length).toBeGreaterThan(0);
    expect(entityResolutionWorkbench.safety).toMatchObject({
      rawEvidenceExposed: false,
      restrictedPayloadsExposed: false,
      preservesUncertainty: true
    });
    expect(timelinessGroundTruth.schemaVersion).toBe("ti.timeliness_ground_truth.v1");
    expect(["high_activity_actor", "ransomware", "actor"]).toContain(timelinessGroundTruth.queryClass);
    expect(timelinessGroundTruth.fields.map((field) => field.field)).toEqual(expect.arrayContaining(["recent_activity", "source_freshness"]));
    expect(typeof timelinessGroundTruth.releaseImpact.holdsReadyPromotion).toBe("boolean");
    expect(Array.isArray(timelinessGroundTruth.releaseImpact.caveats)).toBe(true);
    expect(timelinessGroundTruth.safety).toMatchObject({
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      preservesUncertainty: true
    });
    expect(highPriorityActorFreshnessDashboard.schemaVersion).toBe("ti.high_priority_actor_freshness_dashboard.v1");
    expect(highPriorityActorFreshnessDashboard.summary.actorCount).toBeGreaterThanOrEqual(8);
    expect(highPriorityActorFreshnessDashboard.actors.map((actor) => actor.actor)).toEqual(expect.arrayContaining(["APT29", "APT42", "Sandworm", "Volt Typhoon", "Lazarus", "LockBit", "Akira"]));
    expect(highPriorityActorFreshnessDashboard.actors.every((actor) => ["daily", "weekly"].includes(actor.cadence.expected) && actor.cadence.nextReviewDueAt)).toBe(true);
    expect(highPriorityActorFreshnessDashboard.actors.every((actor) => ["current", "aging", "stale", "unknown"].includes(actor.states.overall))).toBe(true);
    expect(highPriorityActorFreshnessDashboard.summary.dailyDueCount + highPriorityActorFreshnessDashboard.summary.weeklyDueCount).toBeGreaterThan(0);
    expect(highPriorityActorFreshnessDashboard.routing.agent02SchedulerCadence.length).toBeGreaterThan(0);
    expect(highPriorityActorFreshnessDashboard.routing.agent04FreshnessSourceGaps.length).toBeGreaterThan(0);
    expect(highPriorityActorFreshnessDashboard.routing.agent09ApiFields.length).toBeGreaterThan(0);
    expect(highPriorityActorFreshnessDashboard.policy).toMatchObject({
      staleCannotBeLatest: true,
      unknownActorSearchingOnly: true,
      noAutomaticPromotion: true,
      noAutonomousScraping: true
    });
    expect(highPriorityActorFreshnessDashboard.safety).toMatchObject({
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    });
    expect(attackMappingQuality.schemaVersion).toBe("ti.attack_mapping_quality.v1");
    expect(attackMappingQuality.summary.candidateCount).toBeGreaterThan(0);
    expect(attackMappingQuality.summary.mappedAttackIdCount).toBeGreaterThanOrEqual(0);
    expect(attackMappingQuality.techniques.every((technique) => technique.citations.every((citation) => citation.evidenceId && citation.sourceId && citation.captureId))).toBe(true);
    expect(typeof attackMappingQuality.releaseImpact.holdsReadyPromotion).toBe("boolean");
    expect(attackMappingQuality.safety).toMatchObject({
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      preservesUncertainty: true
    });
    expect(analystFeedbackLoop.schemaVersion).toBe("ti.analyst_feedback_loop.v1");
    expect(analystFeedbackLoop.items.length).toBeGreaterThan(0);
    expect(analystFeedbackLoop.items.every((item) => item.immutable && item.appliesAutomatically === false)).toBe(true);
    expect(analystFeedbackLoop.policy).toMatchObject({
      modelSelfMutationAllowed: false,
      analystApprovalRequired: true,
      preservesProvenance: true
    });
    expect(analystFeedbackLoop.safety).toMatchObject({
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false
    });
    expect(actorProfileReviewWorkbench.schemaVersion).toBe("ti.actor_profile_review_workbench.v1");
    expect(actorProfileReviewWorkbench.summary.fieldCount).toBeGreaterThanOrEqual(13);
    expect(actorProfileReviewWorkbench.summary.actionCount).toBeGreaterThan(0);
    expect(actorProfileReviewWorkbench.fields.map((field) => field.field)).toEqual(expect.arrayContaining(["summary", "aliases", "recent_activity", "victims", "ttps", "malware_tools", "vulnerabilities", "datasets"]));
    expect(actorProfileReviewWorkbench.fields.every((field) => field.uncertainty.preservesUncertainty)).toBe(true);
    expect(actorProfileReviewWorkbench.fields.flatMap((field) => field.correctionActions).every((action) => action.manualOnly && action.appliesAutomatically === false)).toBe(true);
    expect(actorProfileReviewWorkbench.routing.agent09ApiContracts.length).toBeGreaterThan(0);
    expect(actorProfileReviewWorkbench.policy).toMatchObject({
      modelSelfMutationAllowed: false,
      analystApprovalRequired: true,
      preservesProvenance: true,
      manualCorrectionsOnly: true
    });
    expect(actorProfileReviewWorkbench.safety).toMatchObject({
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false
    });
    expect(evaluationDatasetGovernance.schemaVersion).toBe("ti.evaluation_dataset_governance.v1");
    expect(evaluationDatasetGovernance.summary.labelCount).toBeGreaterThanOrEqual(16);
    expect(evaluationDatasetGovernance.summary.caseKinds).toEqual(expect.arrayContaining(["actor_profile", "unknown_actor", "cve", "malware_tool", "victim_company", "stale", "contradicted", "low_confidence"]));
    expect(evaluationDatasetGovernance.labels.map((label) => label.subject)).toEqual(expect.arrayContaining(["APT29", "APT42", "Turla", "Volt Typhoon", "Scattered Spider", "Akira", "random actor", "unknown actor"]));
    expect(evaluationDatasetGovernance.labels.every((label) => label.evidenceIds.length > 0 && label.claimLedgerRefs.length > 0 && label.provenance.redacted)).toBe(true);
    expect(evaluationDatasetGovernance.labels.find((label) => label.caseKind === "unknown_actor")).toMatchObject({
      expectedPublicState: "searching",
      publicSemantics: {
        unknownActorSearchingOnly: true,
        noDefaultActor: true,
        noDemoOrCacheProse: true,
        preservesUncertainty: true
      }
    });
    expect(evaluationDatasetGovernance.auditChecks.map((check) => check.code)).toEqual(expect.arrayContaining(["stale_label", "missing_provenance", "restricted_metadata_hold", "unknown_searching_only"]));
    expect(evaluationDatasetGovernance.auditChecks.find((check) => check.code === "restricted_metadata_hold")?.status).toBe("hold");
    expect(evaluationDatasetGovernance.routing.agent09ApiRegressionFixtures.length).toBeGreaterThan(0);
    expect(evaluationDatasetGovernance.routing.agent10ReleaseGates.length).toBeGreaterThan(0);
    expect(evaluationDatasetGovernance.policy).toMatchObject({
      labelsAreImmutable: true,
      analystApprovalRequired: true,
      preservesUncertainty: true,
      noAutomaticPromotion: true,
      unknownActorSearchingOnly: true
    });
    expect(evaluationDatasetGovernance.safety).toMatchObject({
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    });
    expect(ctiEvaluationDatasetPack.schemaVersion).toBe("ti.cti_evaluation_dataset_pack.v1");
    expect(ctiEvaluationDatasetPack.fixtures.map((fixture) => fixture.scenario)).toEqual(expect.arrayContaining([
      "actor_extraction",
      "victim_extraction",
      "ttp_extraction",
      "ioc_extraction",
      "stale_answer_rejection",
      "unknown_actor_searching_only",
      "restricted_no_leak",
      "contradiction_handling"
    ]));
    expect(ctiEvaluationDatasetPack.fixtures.every((fixture) => fixture.immutable && fixture.appliesAutomatically === false && fixture.noLeak && fixture.metrics.provenanceRequired)).toBe(true);
    expect(ctiEvaluationDatasetPack.fixtures.find((fixture) => fixture.scenario === "unknown_actor_searching_only")).toMatchObject({
      expectedPublicState: "searching",
      metrics: { unknownSearchingRequired: true }
    });
    expect(ctiEvaluationDatasetPack.metrics).toMatchObject({
      fixtureCount: 8,
      actorExtractionCount: 1,
      victimExtractionCount: 1,
      ttpExtractionCount: 1,
      iocExtractionCount: 1,
      staleAnswerRejectionCount: 1,
      unknownSearchingCount: 1,
      restrictedNoLeakCount: 1,
      contradictionHandlingCount: 1,
      provenanceCompletenessTarget: 1
    });
    expect(ctiEvaluationDatasetPack.routing.agent06EvidenceReplay.length).toBe(8);
    expect(ctiEvaluationDatasetPack.routing.agent09ApiRegression.length).toBe(8);
    expect(ctiEvaluationDatasetPack.policy).toMatchObject({
      fixturesAreImmutable: true,
      analystApprovalRequired: true,
      noAutomaticPromotion: true,
      noModelSelfMutation: true,
      unknownActorSearchingOnly: true,
      staleEvidenceCannotBeLatest: true
    });
    expect(ctiEvaluationDatasetPack.safety).toMatchObject({
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    });
    expect(analystQualityReviewQueue.schemaVersion).toBe("ti.analyst_quality_review_queue.v1");
    expect(analystQualityReviewQueue.items.map((item) => item.field)).toEqual(expect.arrayContaining(["actor_summary", "recent_activity", "victims", "ttps", "infrastructure", "malware_tools", "cves", "source_gaps"]));
    expect(analystQualityReviewQueue.items.every((item) => item.immutable && item.appliesAutomatically === false)).toBe(true);
    expect(analystQualityReviewQueue.releaseGate.requiredChecks.map((check) => check.code)).toEqual(expect.arrayContaining(["freshness", "provenance", "source_diversity", "contradiction_state", "evidence_retention", "restricted_holds", "unknown_searching_semantics", "label_governance"]));
    expect(["hold", "partial", "promote"]).toContain(analystQualityReviewQueue.releaseGate.decision);
    expect(typeof analystQualityReviewQueue.releaseGate.blocksReadyPromotion).toBe("boolean");
    expect(analystQualityReviewQueue.qualityReleaseSignals.agent09PublicApi.length).toBeGreaterThan(0);
    expect(analystQualityReviewQueue.qualityReleaseSignals.agent10ReleaseBoard.length).toBeGreaterThan(0);
    expect(analystQualityReviewQueue.qualityReleaseSignals.regressionFixtures.length).toBeGreaterThan(0);
    expect(analystQualityReviewQueue.policy).toMatchObject({
      analystApprovalRequired: true,
      modelSelfMutationAllowed: false,
      preservesUncertainty: true,
      manualReviewOnly: true,
      unknownActorSearchingOnly: true
    });
    expect(analystQualityReviewQueue.safety).toMatchObject({
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    });
    expect(analystFeedbackLearningLoop.schemaVersion).toBe("ti.analyst_feedback_learning_loop.v1");
    expect(analystFeedbackLearningLoop.records.map((record) => record.type)).toEqual(expect.arrayContaining([
      "actor_alias_correction",
      "victim_false_positive",
      "ttp_mapping_correction",
      "stale_activity_rejection",
      "source_reliability_downgrade",
      "contradiction_merge_split",
      "restricted_hold_confirmation",
      "unknown_query_searching_approval"
    ]));
    expect(analystFeedbackLearningLoop.records.every((record) => record.immutable && record.appliesAutomatically === false && record.replay.requiresHumanApproval)).toBe(true);
    expect(analystFeedbackLearningLoop.records.every((record) => record.prohibitedEffects.includes("autonomous_scraping") && record.prohibitedEffects.includes("silent_source_activation") && record.prohibitedEffects.includes("model_self_mutation"))).toBe(true);
    expect(analystFeedbackLearningLoop.scorecards.map((scorecard) => scorecard.metric)).toEqual(expect.arrayContaining([
      "extraction_precision",
      "extraction_recall",
      "source_diversity",
      "freshness",
      "contradiction_handling",
      "unknown_actor_behavior",
      "restricted_no_leak_handling",
      "public_answer_latency"
    ]));
    expect(analystFeedbackLearningLoop.fixtures.map((fixture) => fixture.scenario)).toEqual(expect.arrayContaining([
      "apt29_daily_activity_freshness",
      "apt42_instant_summary",
      "made_up_actor_searching_only",
      "stale_2025_only_answer_rejection",
      "public_channel_rumor_demotion",
      "restricted_metadata_hold",
      "graph_contradiction",
      "program_bd_legal_proceeding_false_victim",
      "program_bd_actor_alias_as_victim",
      "program_bd_stale_repost_suppression",
      "program_bd_summary_specificity",
      "program_bd_not_indexed_fallback",
      "program_bd_raw_url_no_leak",
      "program_bd_generic_non_cti_result"
    ]));
    expect(analystFeedbackLearningLoop.fixtures.every((fixture) => fixture.noLeak)).toBe(true);
    expect(analystFeedbackLearningLoop.persistence).toMatchObject({
      mode: "readiness_contract_append_only",
      appendOnly: true,
      mutationBoundary: "no_runtime_mutation_until_persistence_adapter_is_enabled"
    });
    expect(analystFeedbackLearningLoop.persistence.replayOrder.length).toBeGreaterThan(0);
    expect(analystFeedbackLearningLoop.persistence.importSemantics.length).toBeGreaterThan(0);
    expect(typeof analystFeedbackLearningLoop.routeState.explainsPartial).toBe("boolean");
    expect(typeof analystFeedbackLearningLoop.routeState.explainsSearching).toBe("boolean");
    expect(typeof analystFeedbackLearningLoop.routeState.explainsHeld).toBe("boolean");
    expect(typeof analystFeedbackLearningLoop.routeState.explainsReady).toBe("boolean");
    expect(analystFeedbackLearningLoop.routing.agent03ParserRepair.length).toBeGreaterThan(0);
    expect(analystFeedbackLearningLoop.routing.agent04SourceCoverage.length).toBeGreaterThan(0);
    expect(analystFeedbackLearningLoop.routing.agent08GraphCorrections.length).toBeGreaterThan(0);
    expect(analystFeedbackLearningLoop.routing.agent09PublicApiFields.length).toBeGreaterThan(0);
    expect(analystFeedbackLearningLoop.routing.agent10ReleaseGates.length).toBeGreaterThan(0);
    expect(analystFeedbackLearningLoop.policy).toMatchObject({
      analystApprovalRequired: true,
      modelSelfMutationAllowed: false,
      autonomousScrapingAllowed: false,
      silentSourceActivationAllowed: false,
      preservesUncertainty: true
    });
    expect(analystFeedbackLearningLoop.safety).toMatchObject({
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    });
    expect(activeLearningCandidateQueue.schemaVersion).toBe("ti.active_learning_candidate_queue.v1");
    expect(activeLearningCandidateQueue.candidates.map((candidate) => candidate.type)).toEqual(expect.arrayContaining([
      "parser_prompt_model_improvement",
      "source_ranking_adjustment",
      "ttp_mapping_rule_update",
      "actor_alias_merge_split",
      "victim_false_positive_suppression",
      "ioc_false_positive_suppression",
      "source_reliability_downgrade",
      "freshness_rule_update",
      "contradiction_resolution"
    ]));
    expect(activeLearningCandidateQueue.candidates.every((candidate) => candidate.immutable && candidate.appliesAutomatically === false && candidate.noAutonomousChangeGuarantee)).toBe(true);
    expect(activeLearningCandidateQueue.candidates.every((candidate) => candidate.humanApproval.required && candidate.humanApproval.forbiddenActions.includes("activate_source") && candidate.humanApproval.forbiddenActions.includes("start_crawl") && candidate.humanApproval.forbiddenActions.includes("change_model_weights"))).toBe(true);
    expect(activeLearningCandidateQueue.workflow).toMatchObject({
      appendOnly: true,
      humanApprovalRequired: true,
      fixtureRequiredBeforeApproval: true,
      replayRequiredBeforePromotion: true,
      mutationBoundary: "no_runtime_or_model_change_until_human_approved_fixture_replay"
    });
    expect(activeLearningCandidateQueue.scorecards.map((scorecard) => scorecard.metric)).toEqual(expect.arrayContaining([
      "extraction_precision",
      "extraction_recall",
      "source_diversity",
      "freshness",
      "contradiction_handling",
      "restricted_no_leak_handling",
      "public_answer_latency",
      "provenance_completeness",
      "stale_answer_rejection"
    ]));
    expect(activeLearningCandidateQueue.summarySpecificityThresholds.map((threshold) => threshold.field)).toEqual(expect.arrayContaining([
      "summary",
      "recent_activity",
      "victims",
      "ttps",
      "source_support"
    ]));
    expect(activeLearningCandidateQueue.summarySpecificityThresholds.every((threshold) =>
      threshold.minimumSpecificity > threshold.warnBelow && threshold.warnBelow > threshold.holdBelow && threshold.requiredSignals.length > 0
    )).toBe(true);
    expect(activeLearningCandidateQueue.rowUsefulnessDeltas.length).toBe(activeLearningCandidateQueue.candidates.length);
    expect(activeLearningCandidateQueue.rowUsefulnessDeltas.map((row) => row.expectedMarketplaceEffect)).toEqual(expect.arrayContaining([
      "more_actionable",
      "less_stale",
      "less_false_positive",
      "better_corroborated"
    ]));
    expect(activeLearningCandidateQueue.replayPromotionReport).toMatchObject({
      schemaVersion: "ti.analyst_approved_replay_promotion_report.v1",
      candidateCount: activeLearningCandidateQueue.candidates.length,
      policy: {
        analystApprovalRequired: true,
        replayRequiredBeforePromotion: true,
        noAutomaticPromotion: true,
        noRuntimeMutation: true
      },
      safety: {
        rawEvidenceExposed: false,
        sourceUrlsExposed: false,
        restrictedPayloadsExposed: false,
        objectKeysExposed: false
      }
    });
    expect(activeLearningCandidateQueue.replayPromotionReport.promotionChecks.map((check) => check.code)).toEqual(expect.arrayContaining([
      "human_approval",
      "fixture_replay",
      "no_leak",
      "source_activation_boundary",
      "public_answer_boundary",
      "rollback"
    ]));
    expect(activeLearningCandidateQueue.replayPromotionReport.forbiddenActions).toEqual(expect.arrayContaining(["activate_source", "start_crawl", "change_model_weights", "publish_public_answer"]));
    expect(activeLearningCandidateQueue.fixturePack.map((fixture) => fixture.scenario)).toEqual(expect.arrayContaining([
      "apt29_daily_activity_freshness",
      "apt42_instant_summary",
      "made_up_actor_searching_only",
      "stale_2025_only_answer_rejection",
      "public_channel_rumor_demotion",
      "restricted_metadata_hold",
      "graph_contradiction",
      "program_bd_legal_proceeding_false_victim",
      "program_bd_actor_alias_as_victim",
      "program_bd_stale_repost_suppression",
      "program_bd_summary_specificity",
      "program_bd_not_indexed_fallback",
      "program_bd_raw_url_no_leak",
      "program_bd_generic_non_cti_result"
    ]));
    expect(activeLearningCandidateQueue.fixturePack.every((fixture) => fixture.noLeak)).toBe(true);
    expect(activeLearningCandidateQueue.routing.agent03ParserCertification.length).toBeGreaterThan(0);
    expect(activeLearningCandidateQueue.routing.agent04FreshnessSourceGaps.length).toBeGreaterThan(0);
    expect(activeLearningCandidateQueue.routing.agent06EvidenceReplay.length).toBeGreaterThan(0);
    expect(activeLearningCandidateQueue.routing.agent08GraphCorrections.length).toBeGreaterThan(0);
    expect(activeLearningCandidateQueue.routing.agent09ApiFields.length).toBeGreaterThan(0);
    expect(activeLearningCandidateQueue.routing.agent10ReleaseGates.length).toBeGreaterThan(0);
    expect(activeLearningCandidateQueue.policy).toMatchObject({
      analystApprovalRequired: true,
      modelSelfMutationAllowed: false,
      autonomousScrapingAllowed: false,
      silentSourceActivationAllowed: false,
      preservesUncertainty: true,
      unknownActorSearchingOnly: true
    });
    expect(activeLearningCandidateQueue.safety).toMatchObject({
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    });
    expect(qualityRuntimeValueGates.schemaVersion).toBe("ti.quality_runtime_value_gates.v1");
    expect(["actor", "malware_tool"]).toContain(qualityRuntimeValueGates.queryClass);
    expect(qualityRuntimeValueGates.summary.gateCount).toBeGreaterThanOrEqual(10);
    expect(qualityRuntimeValueGates.summary.analystUsefulnessScore).toBeGreaterThanOrEqual(0);
    expect(["ready", "partial", "hold", "searching"]).toContain(qualityRuntimeValueGates.summary.decision);
    expect(qualityRuntimeValueGates.gates.map((gate) => gate.name)).toEqual(expect.arrayContaining([
      "timeliness",
      "specificity",
      "source_diversity",
      "provenance_completeness",
      "contradiction_state",
      "darkweb_metadata_caveat",
      "source_atlas_value",
      "unknown_query_honesty"
    ]));
    expect(qualityRuntimeValueGates.gates.every((gate) => gate.reasons.length > 0 && gate.remediationOwners.length > 0)).toBe(true);
    expect(qualityRuntimeValueGates.darkwebMetadataRules).toMatchObject({
      metadataMayImproveHints: true,
      publicPromotionRequiresCorroboration: true
    });
    expect(qualityRuntimeValueGates.darkwebMetadataRules.forbiddenFields).toEqual(expect.arrayContaining(["unsafe_locator", "unsafe_url", "credential_marker", "payload_marker", "object_reference_marker"]));
    expect(qualityRuntimeValueGates.sourceAtlasFeedback.map((row) => row.signal)).toEqual(expect.arrayContaining(["low_yield_source_family", "stale_only_pack", "activation_candidate"]));
    expect(qualityRuntimeValueGates.fixtureCorpus.map((fixture) => fixture.id)).toEqual(expect.arrayContaining(["fresh_high_activity_actor", "made_up_actor_no_result", "darkweb_metadata_only_hold", "contradictory_source_cluster"]));
    expect(qualityRuntimeValueGates.fixtureCorpus.every((fixture) => fixture.noLeak)).toBe(true);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.schemaVersion).toBe("ti.program_bd_quality_evaluation_pack.v1");
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.summary.defaultWatchlistActorCount).toBeGreaterThanOrEqual(20);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.summary.unknownFixtureCount).toBeGreaterThanOrEqual(2);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.summary.routeVisibleGatePacket).toBe(true);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.rowMetricNames).toEqual(expect.arrayContaining([
      "summary_specificity",
      "source_support",
      "false_victim_risk",
      "actor_alias_resolution",
      "source_family_diversity",
      "actionability_correctness",
      "useful_row_rate",
      "fresh_row_rate",
      "stale_row_suppression",
      "buyer_caveat_usefulness",
      "no_leak_proof"
    ]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate).toMatchObject({
      schemaVersion: "ti.program_bd_paid_row_quality_gate.v1",
      pricing: {
        resultPriceUsdPer1000Rows: 3,
        actorStartUsd: 0.00005,
        effectiveDate: "2026-07-04"
      }
    });
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.liveBaselines.map((baseline) => baseline.runId)).toEqual(expect.arrayContaining([
      "iMQGeezZ8bx7WtlhQ",
      "rh6D0UInDD6x7GuuD"
    ]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.metricThresholds.map((threshold) => threshold.metric)).toEqual(expect.arrayContaining([
      "useful_row_rate",
      "fresh_row_rate",
      "summary_specificity",
      "source_family_diversity",
      "no_leak_proof"
    ]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.sourceTierGates.map((gate) => gate.tier)).toEqual([100, 1000, 4000, 10000, 20000, 60000]);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.apifyDatasetFields).toEqual(expect.arrayContaining(["reviewReasons", "analysisFacets", "buyerCaveat"]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.buyerVisibleQualityLiftGate).toMatchObject({
      schemaVersion: "ti.program_bg_buyer_visible_quality_lift_gate.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "/v1/ops/product-slo"]),
      qualityLiftAcceptedCount: 5,
      qualityLiftRejectedCount: 5,
      sellableRowsAdded: 2,
      freshRowsAdded: 5,
      projectedRowRevenueDeltaUsd: 0.015,
      passCriteria: {
        acceptedRequiresDecisionLift: true,
        rejectedRepairsDoNotCountTowardPayworthyRate: true
      }
    });
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.buyerVisibleQualityLiftGate.rejectedExamples.map((row) => row.rejectionReason)).toEqual(expect.arrayContaining([
      "no_sellable_row_lift",
      "still_single_source",
      "stale_after_repair",
      "unsafe_or_unapproved_source",
      "cost_exceeds_value"
    ]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.qualityConversionGate).toMatchObject({
      schemaVersion: "ti.program_bq_paid_row_quality_conversion_gate.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "/v1/ops/product-slo"]),
      acceptedRows: 10,
      rejectedBloatRows: 7,
      sellableRowLift: 6,
      bloatBlocked: 7
    });
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.qualityConversionGate.examples.map((row) => row.actor)).toEqual(expect.arrayContaining([
      "APT29",
      "APT42",
      "Turla",
      "Volt Typhoon",
      "Lazarus Group",
      "Sandworm",
      "Scattered Spider",
      "LockBit",
      "Akira",
      "Clop",
      "Black Basta"
    ]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.qualityConversionGate.rejectedBloatCases.map((row) => row.blockedReason)).toEqual(expect.arrayContaining([
      "alias_only_cleanup",
      "stale_old_report_reuse",
      "duplicate_source_expansion",
      "generic_marketing_summary",
      "uncorroborated_public_channel_snippet",
      "unsafe_metadata",
      "no_actionability"
    ]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.qualityConversionGate.sourceParserHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_01", "agent_03", "agent_04", "agent_05"]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.liveFreshnessQualityGate).toMatchObject({
      schemaVersion: "ti.program_br_live_freshness_quality_gate.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "/v1/ops/product-slo"]),
      freshRowsPromoted: 6,
      caveatedRowsKept: 4,
      staleLatestClaimsBlocked: 5,
      bloatRowsSuppressed: 3
    });
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.liveFreshnessQualityGate.examples.map((row) => row.actor)).toEqual(expect.arrayContaining([
      "APT29",
      "APT42",
      "Turla",
      "Volt Typhoon",
      "Lazarus Group",
      "Sandworm",
      "Scattered Spider",
      "LockBit",
      "Akira",
      "Clop",
      "Black Basta"
    ]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.liveFreshnessQualityGate.examples.some((row) => row.blocksLatestClaim && (row.decision === "held" || row.decision === "suppressed"))).toBe(true);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.liveFreshnessQualityGate.blockedLatestClaimCases.map((row) => row.blockedReason)).toEqual(expect.arrayContaining([
      "old_evidence",
      "generic_summary",
      "single_source",
      "alias_only",
      "unrelated_actor",
      "contradicted",
      "metadata_only_without_public_support"
    ]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.liveFreshnessQualityGate.sourceParserHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_01", "agent_03", "agent_04", "agent_05"]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.freshnessRepairLoop).toMatchObject({
      schemaVersion: "ti.program_bs_paid_row_freshness_repair_loop.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "/v1/ops/product-slo", "Apify OUTPUT"]),
      lift: {
        staleRowsBlocked: 4,
        genericRowsRepaired: 4,
        aliasOrUnrelatedRowsSuppressed: 4,
        caveatedRowsPreserved: 7,
        sellableRowsGained: 6,
        usefulRowsGained: 6,
        averageBuyerValueDelta: 0.104
      },
      noLeakProof: { rawEvidenceExposed: false, unsafeUrlsExposed: false, restrictedPayloadsExposed: false, objectKeysExposed: false }
    });
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.freshnessRepairLoop.repairQueue).toHaveLength(20);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.freshnessRepairLoop.repairQueue.map((row) => row.actor)).toEqual(expect.arrayContaining([
      "APT29",
      "APT28",
      "APT42",
      "Turla",
      "Volt Typhoon",
      "Lazarus Group",
      "Sandworm",
      "Scattered Spider",
      "LockBit",
      "Akira",
      "Clop",
      "Black Basta"
    ]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.freshnessRepairLoop.repairQueue.map((row) => row.blocker)).toEqual(expect.arrayContaining(["stale_latest_activity", "generic_summary", "single_source", "alias_only", "unrelated_actor", "contradicted", "metadata_only_without_public_support"]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.freshnessRepairLoop.repairQueue.every((row) => row.proofNeeded.length > 0 && row.expectedBuyerVisibleLift.length > 0 && row.noLeak)).toBe(true);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.freshnessRepairLoop.ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_01", "agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_09", "agent_10"]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.entitySpecificityLift).toMatchObject({
      schemaVersion: "ti.program_bv_paid_row_entity_specificity_lift.v1",
      routeVisibleOn: expect.arrayContaining(["/v1/quality/evaluate", "/v1/intel/search", "/v1/contracts", "/v1/ops/product-slo", "Apify OUTPUT"]),
      lift: {
        rowsLifted: 14,
        rowsSuppressed: 4,
        rowsHeldWithRepairAction: 2,
        blockerCodesRemoved: 25,
        averageBuyerValueDelta: 0.161
      },
      noLeakProof: { rawEvidenceExposed: false, unsafeUrlsExposed: false, restrictedPayloadsExposed: false, objectKeysExposed: false }
    });
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.entitySpecificityLift.fixtures).toHaveLength(20);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.entitySpecificityLift.fixtures.map((row) => row.actor)).toEqual(expect.arrayContaining(["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin", "Unknown Actor Query"]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.entitySpecificityLift.fixtures.flatMap((row) => row.missingFields)).toEqual(expect.arrayContaining(["victim", "sector", "country", "dataset_or_impact", "ttp_or_tool", "first_seen", "last_seen", "confidence", "caveat", "contradiction_state", "provenance_hash", "next_action"]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.entitySpecificityLift.fixtures.flatMap((row) => row.blockerCodesRemoved)).toEqual(expect.arrayContaining(["old", "alias_only", "single_source_without_caveat", "unrelated_actor", "contradicted", "metadata_only_without_public_support", "no_useful_buyer_action", "generic_entity_fields"]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.entitySpecificityLift.fixtures.every((row) => row.proofNeeded.length > 0 && row.expectedBuyerVisibleLift.length > 0 && row.whyWorthPayingFor.length > 0 && row.repairAction.length > 0 && row.noLeak)).toBe(true);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.entitySpecificityLift.ownerHandoffs.map((row) => row.owner)).toEqual(expect.arrayContaining(["agent_01", "agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_09", "agent_10"]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.watchlistFixtures.map((fixture) => fixture.actor)).toEqual(expect.arrayContaining([
      "APT29",
      "APT42",
      "Volt Typhoon",
      "Turla",
      "LockBit",
      "Akira",
      "Scattered Spider",
      "Random Actor",
      "Crimson Pineapple"
    ]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.watchlistFixtures.every((fixture) => fixture.requiredMetrics.length > 0 && fixture.gatePacket.remediationAction.length > 0)).toBe(true);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.watchlistFixtures.every((fixture) => fixture.provenance.redacted && fixture.provenance.fixtureIds.length > 0 && fixture.noLeak)).toBe(true);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.watchlistFixtures.find((fixture) => fixture.actor === "LockBit")?.gatePacket.downstreamEligibility.publicUi).toBe(false);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.watchlistFixtures.find((fixture) => fixture.actor === "Random Actor")?.gatePacket.downstreamEligibility.stixExport).toBe(false);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.regressionGuardrails.map((guardrail) => guardrail.id)).toEqual(expect.arrayContaining([
      "person_treated_as_victim",
      "not_indexed_fallback",
      "raw_unsafe_url_leak"
    ]));
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.routing.agent09ApiGatePacket.length).toBeGreaterThan(0);
    expect(qualityRuntimeValueGates.programBdQualityEvaluationPack.routing.agent10ReleaseGate.length).toBeGreaterThan(0);
    expect(qualityRuntimeValueGates.remediationHandoffs.agent01SourceActivation.length).toBeGreaterThan(0);
    expect(qualityRuntimeValueGates.remediationHandoffs.agent05RestrictedReview.length).toBeGreaterThan(0);
    expect(qualityRuntimeValueGates.remediationHandoffs.agent10ReleaseRollback.length).toBeGreaterThan(0);
    expect(["promote", "partial", "hold"]).toContain(qualityRuntimeValueGates.releaseGate.decision);
    expect(qualityRuntimeValueGates.releaseGate.proofCommands).toContain("bun run check:contract-index");
    expect(qualityRuntimeValueGates.policy).toMatchObject({
      analystApprovalRequired: true,
      noAutomaticPromotion: true,
      unknownActorSearchingOnly: true,
      staleEvidenceCannotBeLatest: true,
      metadataOnlyDarkwebCannotStandAlone: true
    });
    expect(qualityRuntimeValueGates.safety).toMatchObject({
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false,
      unsafeDarkwebTargetsExposed: false
    });
    expect(examples.every((example) => example.dashboard.schemaVersion === "ti.search_quality_dashboard.v1")).toBe(true);
    expect(publicTiAnswer.schemaVersion).toBe("ti.public_answer_contract.v1");
    expect(["partial", "review_required"]).toContain(publicTiAnswer.displayState);
    expect(JSON.stringify(quality)).not.toContain("Cyber gang list");
    expect(JSON.stringify(quality)).not.toContain("https://quality.example.test");
    expect(JSON.stringify(dashboard)).not.toContain("Cyber gang list");
    expect(JSON.stringify(dashboard)).not.toContain("https://quality.example.test");
    expect(JSON.stringify(entityResolutionWorkbench)).not.toContain("Cyber gang list");
    expect(JSON.stringify(entityResolutionWorkbench)).not.toContain("https://quality.example.test");
    expect(JSON.stringify(timelinessGroundTruth)).not.toContain("Cyber gang list");
    expect(JSON.stringify(timelinessGroundTruth)).not.toContain("https://quality.example.test");
    expect(JSON.stringify(highPriorityActorFreshnessDashboard)).not.toContain("Cyber gang list");
    expect(JSON.stringify(highPriorityActorFreshnessDashboard)).not.toContain("https://quality.example.test");
    expect(JSON.stringify(highPriorityActorFreshnessDashboard)).not.toContain("https://");
    expect(JSON.stringify(attackMappingQuality)).not.toContain("Cyber gang list");
    expect(JSON.stringify(attackMappingQuality)).not.toContain("https://quality.example.test");
    expect(JSON.stringify(analystFeedbackLoop)).not.toContain("Cyber gang list");
    expect(JSON.stringify(analystFeedbackLoop)).not.toContain("https://quality.example.test");
    expect(JSON.stringify(actorProfileReviewWorkbench)).not.toContain("Cyber gang list");
    expect(JSON.stringify(actorProfileReviewWorkbench)).not.toContain("https://quality.example.test");
    expect(JSON.stringify(evaluationDatasetGovernance)).not.toContain("Cyber gang list");
    expect(JSON.stringify(evaluationDatasetGovernance)).not.toContain("https://quality.example.test");
    expect(JSON.stringify(evaluationDatasetGovernance)).not.toContain("https://");
    expect(JSON.stringify(ctiEvaluationDatasetPack)).not.toContain("Cyber gang list");
    expect(JSON.stringify(ctiEvaluationDatasetPack)).not.toContain("https://quality.example.test");
    expect(JSON.stringify(ctiEvaluationDatasetPack)).not.toContain("https://");
    expect(JSON.stringify(analystQualityReviewQueue)).not.toContain("Cyber gang list");
    expect(JSON.stringify(analystQualityReviewQueue)).not.toContain("https://quality.example.test");
    expect(JSON.stringify(analystQualityReviewQueue)).not.toContain("https://");
    expect(JSON.stringify(analystFeedbackLearningLoop)).not.toContain("Cyber gang list");
    expect(JSON.stringify(analystFeedbackLearningLoop)).not.toContain("https://quality.example.test");
    expect(JSON.stringify(analystFeedbackLearningLoop)).not.toContain("https://");
    expect(JSON.stringify(activeLearningCandidateQueue)).not.toContain("Cyber gang list");
    expect(JSON.stringify(activeLearningCandidateQueue)).not.toContain("https://quality.example.test");
    expect(JSON.stringify(activeLearningCandidateQueue)).not.toContain("https://");
    expect(JSON.stringify(qualityRuntimeValueGates)).not.toContain("Cyber gang list");
    expect(JSON.stringify(qualityRuntimeValueGates)).not.toContain("https://quality.example.test");
    expect(JSON.stringify(qualityRuntimeValueGates)).not.toContain("https://");
  });

  test("smokes mounted quality endpoints through the Bun API server", async () => {
    const store = new InMemoryScraperStore();
    store.saveCapture(fixtureCapture({
      id: "cap_mounted_ready",
      tenantId: undefined,
      url: "https://mounted-quality.example.test/apt29-ready",
      body: "Mandiant linked APT29 to phishing and credential dumping against Northwind Health in healthcare. First seen 2026-05-22.",
      metadata: { title: "APT29 mounted ready", evidenceStage: "reviewed_promoted", graphReviewState: "accepted" }
    }));
    store.saveCapture(fixtureCapture({
      id: "cap_mounted_alias",
      tenantId: undefined,
      url: "https://mounted-quality.example.test/akira-alias",
      body: "Cyber gang list: Akira, ALPHV, BlackCat, and LockBit were named historically in a ransomware rebrand roundup.",
      metadata: { title: "Akira mounted alias", evidenceStage: "captured_page" }
    }));
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
    try {
      const base = `http://127.0.0.1:${server.port}`;
      const ready = await fetch(`${base}/v1/intel/search?q=APT29&entityType=actor`).then((response) => response.json()) as {
        quality: { status: string; canPromoteToReady: boolean; publicWarningText: string[] };
        graph: { endpoint: string; reviewQueue: { total: number; publicFactPolicy: string } };
      };
      const alias = await fetch(`${base}/v1/quality/evaluate?q=Akira`).then((response) => response.json()) as {
        quality: { publicWarningCodes: string[]; analystActions: Array<{ kind: string }> };
        examples: Array<{ quality: { status: string } }>;
      };

      expect(ready.quality).toMatchObject({ status: "ready", canPromoteToReady: true });
      expect(ready.graph).toMatchObject({
        endpoint: "/v1/intel/search.graph"
      });
      expect(["ready", "hold_weak_edges"]).toContain(ready.graph.reviewQueue.publicFactPolicy);
      expect(alias.quality.publicWarningCodes).toContain("alias_collision_warning");
      expect(alias.quality.analystActions.map((action) => action.kind)).toContain("suppress_noisy_alias");
      expect(alias.examples.map((example) => example.quality.status)).toEqual(expect.arrayContaining(["ready", "partial", "weak-evidence", "needs-review"]));
      expect(JSON.stringify(ready.quality)).not.toContain("Mandiant linked APT29");
      expect(JSON.stringify(alias.quality)).not.toContain("Cyber gang list");
      expect(JSON.stringify(alias.quality)).not.toContain("mounted-quality.example.test");
    } finally {
      server.stop();
    }
  });

  test("fuses actor profiles into live search API output with quality gates and redacted provenance", async () => {
    const cases = [
      {
        query: "APT29",
        body: "Mandiant linked APT29 to credential dumping against Northwind Health in the healthcare sector using Cobalt Strike and CVE-2026-11111. First seen 2026-05-22.",
        metadata: { evidenceStage: "reviewed_promoted", graphReviewState: "accepted", evidenceLedgerId: "ledger_api_apt29_ready" },
        expect: { status: "ready", victim: "Northwind Health", ttp: "credential dumping", malware: "cobalt strike", vulnerability: "CVE-2026-11111" }
      },
      {
        query: "Scattered Spider",
        body: "CrowdStrike linked Scattered Spider to sms phishing against Example Telecom in the telecommunications sector. Last seen 2026-05-23.",
        metadata: { evidenceStage: "reviewed_promoted", graphReviewState: "accepted" },
        expect: { status: "ready", victim: "Example Telecom", ttp: "sms phishing", sector: "telecommunications" }
      },
      {
        query: "Volt Typhoon",
        body: "Public channel message says Volt Typhoon may be using living off the land against Pacific Energy Corp in the energy sector.",
        metadata: { evidenceStage: "public_channel_message", adapter: "telegram_public" },
        expect: { status: "source-biased", warning: "insufficient-capture", ttp: "living off the land" }
      },
      {
        query: "Turla",
        body: "Researchers linked Turla to Snake malware and command and control infrastructure at https://snake-c2.example.net against Example Embassy.",
        metadata: { evidenceStage: "captured_page", graphReviewState: "stale" },
        expect: { status: "stale", malware: "snake", warning: "stale" }
      },
      {
        query: "Akira",
        body: "Akira claimed victim: Fjord Energy AS on 2026-05-20.",
        storageKind: "metadata_only" as const,
        sensitive: true,
        metadata: {
          evidenceStage: "metadata_only_claim",
          safeExcerpt: "Akira claimed victim: Fjord Energy AS.",
          sourceUrl: "http://claims-example.onion/akira"
        },
        expect: { warning: "metadata_only_leak_claim", victim: "Fjord Energy AS" }
      },
      {
        query: "MuddyWater",
        body: "Researchers linked MuddyWater, also known as Seedworm, to spearphishing against Example Ministry in the government sector using PowGoop malware. First seen 2026-05-21.",
        metadata: { evidenceStage: "captured_page", graphReviewState: "accepted" },
        expect: { alias: "seedworm", victim: "Example Ministry", sector: "government", malware: "powgoop" }
      },
      {
        query: "Crimson Pineapple",
        body: "Crimson Pineapple appears in a search result snippet, but no source attributes activity, victim, malware, CVE, or infrastructure to the name.",
        metadata: { evidenceStage: "live_discovery" },
        expect: { status: "partial", warning: "weak-evidence" }
      },
      {
        query: "Akira",
        body: "Cyber gang list: Akira, ALPHV, BlackCat, and LockBit were named historically in a ransomware rebrand roundup.",
        metadata: { evidenceStage: "captured_page" },
        expect: { warning: "alias_collision_warning", action: "suppress_noisy_alias" }
      },
      {
        query: "Volt Typhoon",
        body: "Vendors disputed attribution to Volt Typhoon but mentioned living off the land.",
        metadata: { evidenceStage: "captured_page", graphReviewState: "contradiction" },
        expect: { status: "contradicted", warning: "contradicted" }
      }
    ];

    for (const item of cases) {
      const store = new InMemoryScraperStore();
      store.saveCapture(fixtureCapture({
        id: `cap_profile_${item.query.replace(/\W+/g, "_").toLowerCase()}_${String(item.expect.warning ?? item.expect.status ?? "ok")}`,
        tenantId: undefined,
        url: `https://profile-quality.example.test/${encodeURIComponent(item.query)}`,
        body: item.body,
        storageKind: item.storageKind ?? "inline_text",
        sensitive: item.sensitive ?? false,
        metadata: { title: `${item.query} profile fixture`, ...item.metadata }
      }));

      const response = await body(await handleApiRequest(api(`/v1/intel/search?q=${encodeURIComponent(item.query)}&entityType=actor`), {
        store,
        frontier: new FocusedFrontier()
      }));
      const profile = response.actorProfile as {
        status: string;
        confidence: number;
        warningCodes: string[];
        caveatCodes: string[];
        actor: string;
        summary: string[];
        aliases: string[];
        targets: { victims: string[]; sectors: string[]; regions: string[] };
        readiness: {
          overall: string;
          fields: Record<string, { status: string; evidenceIds: string[]; provenance: Array<{ evidenceStage: string; sourceId: string }> }>;
          downgradeReasons: string[];
          sourceFamilyCount: number;
        };
        answer: {
          status: string;
          confidence: number;
          summary: string[];
          victims: string[];
          timeline: Array<{ label: string; evidenceIds: string[] }>;
          warnings: string[];
          warningCodes: string[];
          claims: Array<{
            kind: string;
            value: string;
            status: string;
            confidence: number;
            evidenceIds: string[];
            ledgerIds: string[];
            sourceFamilySupport: string[];
            extractionVersion: string;
            freshness: { score: number };
            caveatCodes: string[];
            downgradeReasons: string[];
            analystReviewState: string;
          }>;
          reviewGates: Array<{
            claimKind: string;
            value: string;
            state: string;
            requiredForReady: boolean;
            requiredReviews: string[];
            evidenceIds: string[];
            ledgerIds: string[];
            reasons: string[];
          }>;
          deltas: Array<{
            kind: string;
            claimKind: string;
            value: string;
            status: string;
            evidenceIds: string[];
            ledgerIds: string[];
            reasons: string[];
          }>;
          readinessSla: {
            status: string;
            confidence: number;
            evidenceFamilySupport: {
              sourceFamilyCount: number;
              ledgerIds: string[];
              evidenceIds: string[];
              evidenceStageCounts: Record<string, number>;
            };
            graphState: { status: string; reasons: string[] };
            sourceSla: { status: string; reasons: string[] };
            schedulerState: { status: string; reasons: string[] };
            publicChannelSla: { status: string; reasons: string[] };
            restrictedMetadataSla: { status: string; reasons: string[] };
            explanations: Array<{ code: string; evidenceIds: string[]; claimKinds: string[] }>;
          };
          promotionPolicy: {
            state: string;
            canPromote: boolean;
            publicStatus: string;
            rules: Array<{ code: string; state: string; reasons: string[]; evidenceIds: string[]; claimKinds: string[] }>;
            caveats: Array<{ code: string; severity: string; evidenceIds: string[]; claimKinds: string[] }>;
            pollableDeltas: Array<{ kind: string; pollReason: string; nextPollAfterSeconds: number; evidenceIds: string[]; ledgerIds: string[] }>;
          };
          analystFusion: {
            queryClass: string;
            answerState: string;
            changed: Array<{ field: string; values: string[]; deltaKinds: string[]; evidenceIds: string[]; ledgerIds: string[] }>;
            firstSeen?: string;
            lastSeen?: string;
            recentAttacks: Array<{ victim?: string; sectors: string[]; regions: string[]; ttps: string[]; malwareTools: string[]; vulnerabilities: string[]; evidenceIds: string[]; ledgerIds: string[] }>;
            targetSectors: string[];
            targetRegions: string[];
            ttps: string[];
            datasets: string[];
            caveatDigest: Array<{ code: string; severity: string; evidenceIds: string[]; claimKinds: string[] }>;
            confidence: { score: number; state: string; sourceFamilyCount: number; ledgerBackedClaimCount: number };
            contradictionHandling: { contradicted: boolean; holdReadyPromotion: boolean; reasons: string[]; evidenceIds: string[] };
            sourceBias: { missingSourceFamily: boolean; sourceFamilyCount: number; reasons: string[] };
            staleEvidence: { stale: boolean; reasons: string[]; evidenceIds: string[] };
            liveCollectionWaitingFor: Array<{ code: string; message: string; evidenceIds: string[]; claimKinds: string[] }>;
            claims: Array<{ kind: string; value: string; ledgerIds: string[]; evidenceIds: string[]; provenance: Array<{ evidenceId: string; sourceId: string; evidenceStage: string }>; graphExportState: string }>;
            pollableDeltas: Array<{ kind: string; pollReason: string; nextPollAfterSeconds: number; evidenceIds: string[]; ledgerIds: string[] }>;
          };
          provenanceNotes: string[];
        };
        ttps: string[];
        malwareTools: string[];
        vulnerabilities: string[];
        datasets: { sourceCount: number; evidenceStageCounts: Record<string, number> };
        changedFields: string[];
        evidenceIds: string[];
        provenance: Array<{ evidenceId: string; evidenceStage: string; sourceId: string; captureId?: string }>;
        analystActions: Array<{ kind: string }>;
        provenanceNotes: string[];
      };

      if (item.expect.status) expect(profile.status).toBe(item.expect.status);
      if (item.expect.warning) expect(profile.warningCodes).toContain(item.expect.warning);
      if (item.expect.action) expect(profile.analystActions.map((action) => action.kind)).toContain(item.expect.action);
      if (item.expect.alias) expect(profile.aliases).toContain(item.expect.alias);
      if (item.expect.victim) expect(profile.targets.victims).toContain(item.expect.victim);
      if (item.expect.sector) expect(profile.targets.sectors).toContain(item.expect.sector);
      if (item.expect.ttp) expect(profile.ttps).toContain(item.expect.ttp);
      if (item.expect.malware) expect(profile.malwareTools).toContain(item.expect.malware);
      if (item.expect.vulnerability) expect(profile.vulnerabilities).toContain(item.expect.vulnerability);
      if (item.expect.victim) expect(profile.readiness.fields.victims.evidenceIds.length).toBeGreaterThan(0);
      if (item.expect.warning === "metadata_only_leak_claim") expect(profile.readiness.fields.victims.status).toBe("needs_review");
      if (item.expect.status === "ready") expect(profile.readiness.fields.victims.status).toBe("fact");

      expect(profile.confidence).toBeGreaterThanOrEqual(0);
      expect(profile.confidence).toBeLessThanOrEqual(1);
      expect(["fact", "partial_evidence", "needs_review"]).toContain(profile.answer.status);
      expect(profile.answer.confidence).toBeGreaterThanOrEqual(0);
      expect(profile.answer.summary.length).toBeGreaterThan(0);
      expect(profile.answer.warningCodes.length).toBeGreaterThan(0);
      expect(profile.answer.claims.length).toBeGreaterThan(0);
      expect(profile.answer.claims.every((claim) => claim.confidence >= 0 && claim.confidence <= 1)).toBe(true);
      expect(profile.answer.claims.every((claim) => claim.extractionVersion === "ti-basic-extractor-v1")).toBe(true);
      expect(profile.answer.claims.every((claim) => claim.ledgerIds.length > 0)).toBe(true);
      expect(profile.answer.claims.every((claim) => claim.sourceFamilySupport.length > 0)).toBe(true);
      expect(profile.answer.claims.every((claim) => claim.freshness.score >= 0 && claim.freshness.score <= 1)).toBe(true);
      expect(profile.answer.claims.every((claim) => Array.isArray(claim.caveatCodes) && Array.isArray(claim.downgradeReasons))).toBe(true);
      expect(profile.answer.claims.every((claim) => ["not_required", "recommended", "required"].includes(claim.analystReviewState))).toBe(true);
      expect(profile.answer.reviewGates.every((gate) => ["passed", "recommended", "required"].includes(gate.state))).toBe(true);
      expect(profile.answer.reviewGates.every((gate) => Array.isArray(gate.requiredReviews) && Array.isArray(gate.reasons))).toBe(true);
      expect(profile.answer.deltas.length).toBeGreaterThan(0);
      expect(profile.answer.deltas.every((delta) => delta.evidenceIds.length > 0 && delta.ledgerIds.length > 0)).toBe(true);
      expect(profile.answer.deltas.map((delta) => delta.kind)).toContain("new");
      expect(["ready", "partial", "review_required", "blocked"]).toContain(profile.answer.readinessSla.status);
      expect(profile.answer.readinessSla.confidence).toBeGreaterThanOrEqual(0);
      expect(profile.answer.readinessSla.confidence).toBeLessThanOrEqual(1);
      expect(profile.answer.readinessSla.evidenceFamilySupport.sourceFamilyCount).toBeGreaterThanOrEqual(1);
      expect(profile.answer.readinessSla.evidenceFamilySupport.ledgerIds.length).toBeGreaterThan(0);
      expect(profile.answer.readinessSla.evidenceFamilySupport.evidenceIds.length).toBeGreaterThan(0);
      expect(Object.keys(profile.answer.readinessSla.evidenceFamilySupport.evidenceStageCounts)).toContain("captured_page");
      expect(["ready", "hold", "unknown"]).toContain(profile.answer.readinessSla.graphState.status);
      expect(["met", "missed", "unknown"]).toContain(profile.answer.readinessSla.sourceSla.status);
      expect(["normal", "queue_pressure", "unknown"]).toContain(profile.answer.readinessSla.schedulerState.status);
      expect(["stable", "unstable", "none"]).toContain(profile.answer.readinessSla.publicChannelSla.status);
      expect(["compliant", "restricted_only", "blocked", "none"]).toContain(profile.answer.readinessSla.restrictedMetadataSla.status);
      expect(["ready", "partial", "review_required", "blocked", "stale", "contradicted", "source_biased"]).toContain(profile.answer.promotionPolicy.state);
      expect(typeof profile.answer.promotionPolicy.canPromote).toBe("boolean");
      expect(profile.answer.promotionPolicy.publicStatus).toBe(profile.answer.readinessSla.status);
      expect(profile.answer.promotionPolicy.rules.map((rule) => rule.code)).toEqual(expect.arrayContaining([
        "ready_support",
        "source_sla",
        "scheduler_sla",
        "public_channel_sla",
        "restricted_metadata_sla",
        "graph_export_state",
        "claim_ledger",
        "freshness",
        "contradiction",
        "review_gate"
      ]));
      expect(profile.answer.promotionPolicy.rules.every((rule) => ["pass", "warning", "hold", "block"].includes(rule.state))).toBe(true);
      expect(profile.answer.promotionPolicy.pollableDeltas.every((delta) => delta.nextPollAfterSeconds > 0)).toBe(true);
      expect(["actor", "ransomware", "cve", "malware_tool", "country", "sector", "unknown"]).toContain(profile.answer.analystFusion.queryClass);
      expect(profile.answer.analystFusion.answerState).toBe(profile.answer.promotionPolicy.state);
      expect(profile.answer.analystFusion.confidence.score).toBeGreaterThanOrEqual(0);
      expect(profile.answer.analystFusion.confidence.score).toBeLessThanOrEqual(1);
      expect(profile.answer.analystFusion.claims.length).toBeGreaterThan(0);
      expect(profile.answer.analystFusion.claims.every((claim) => claim.ledgerIds.length > 0 && claim.evidenceIds.length > 0 && claim.provenance.length > 0)).toBe(true);
      expect(profile.answer.analystFusion.pollableDeltas).toEqual(profile.answer.promotionPolicy.pollableDeltas);
      if (!profile.answer.promotionPolicy.canPromote) expect(profile.answer.analystFusion.liveCollectionWaitingFor.length).toBeGreaterThan(0);
      expect(profile.answer.provenanceNotes.every((note) => !note.includes("https://"))).toBe(true);
      if (item.expect.victim) expect(profile.answer.victims).toContain(item.expect.victim);
      if (item.expect.victim) expect(profile.answer.claims.find((claim) => claim.kind === "victim" && claim.value === item.expect.victim)?.evidenceIds.length).toBeGreaterThan(0);
      if (item.query === "APT29") expect(profile.answer.claims.some((claim) => claim.ledgerIds.includes("ledger_api_apt29_ready"))).toBe(true);
      if (item.expect.warning) expect(profile.answer.reviewGates.some((gate) => gate.state !== "passed")).toBe(true);
      if (item.expect.warning) expect(profile.answer.readinessSla.explanations.length).toBeGreaterThan(0);
      if (profile.answer.promotionPolicy.state === "ready") expect(profile.answer.promotionPolicy.canPromote).toBe(true);
      if (item.expect.warning === "contradicted") expect(profile.answer.promotionPolicy.state).toBe("contradicted");
      if (item.expect.warning === "contradicted") expect(profile.answer.analystFusion.contradictionHandling.contradicted).toBe(true);
      if (item.expect.warning === "metadata_only_leak_claim") expect(profile.answer.promotionPolicy.canPromote).toBe(false);
      if (item.expect.warning === "metadata_only_leak_claim") expect(profile.answer.analystFusion.liveCollectionWaitingFor.map((wait) => wait.code)).toContain("restricted_metadata_review");
      expect(profile.readiness.sourceFamilyCount).toBe(1);
      expect(["fact", "partial_evidence", "needs_review"]).toContain(profile.readiness.overall);
      expect(profile.datasets.sourceCount).toBe(1);
      expect(profile.evidenceIds.length).toBeGreaterThan(0);
      expect(profile.provenance[0]?.evidenceStage).toBeTruthy();
      expect(profile.changedFields).toContain("new_evidence");
      expect(JSON.stringify(profile)).not.toContain(item.body);
      expect(JSON.stringify(profile)).not.toContain("profile-quality.example.test");
      expect(JSON.stringify(profile)).not.toContain(".onion");
      expect(JSON.stringify(profile)).not.toContain("prompt");
      expect(JSON.stringify(profile)).not.toContain("model");
    }
  });

  test("attaches live search polling to an active run and survives repeated polling under load", async () => {
    const store = new InMemoryScraperStore();
    for (let index = 0; index < 100; index += 1) {
      store.saveSource(source({
        id: `src_live_${index}`,
        type: index % 5 === 0 ? "api" : index % 2 === 0 ? "rss" : "static_web",
        trustScore: 0.5 + (index % 10) / 20,
        tags: index % 13 === 0 ? ["turla", "snake"] : undefined
      }));
    }
    const frontier = new FocusedFrontier();
    const options = { store, frontier };
    const created = await body(await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "Turla", entityType: "actor", tenantId: "tenant_live" })
    }), options));
    const run = created.run as { id: string };

    for (let poll = 0; poll < 3; poll += 1) {
      const response = await body(await handleApiRequest(api("/v1/intel/search?q=Turla&entityType=actor", {
        headers: { "x-tenant-id": "tenant_live" }
      }), options));
      const planner = response.planner as {
        activeRunId?: string;
        attachedToActiveRun: boolean;
        backpressureState: string;
        reuseKey: string;
        queuedTaskCount: number;
        nextPollSeconds: number;
      };

      expect(planner.attachedToActiveRun).toBe(true);
      expect(planner.backpressureState).toBe("attached_to_active_run");
      expect(planner.reuseKey).toMatch(/^live-reuse_/);
      expect(planner.activeRunId).toBe(run.id);
      expect(planner.queuedTaskCount).toBeGreaterThan(0);
      expect(planner.nextPollSeconds).toBe(5);
    }
  }, 15_000);

  test("exposes scraper-native search compatibility fields for public wrapper cutover", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_compat", tags: ["scattered spider"], type: "rss" }));
    const options = { store, frontier: new FocusedFrontier() };

    const first = await body(await handleApiRequest(api("/v1/intel/search?q=Scattered%20Spider&entityType=actor"), options));
    const firstRunId = first.runId as string;
    expect(first).toMatchObject({
      query: "Scattered Spider",
      mode: "interactive_live_search",
      status: expect.any(String),
      runId: expect.any(String),
      refreshAfterSeconds: expect.any(Number),
      cursor: expect.any(String),
      nextCursor: expect.any(String)
    });
    expect((first.summary as string[]).length).toBeGreaterThan(0);
    expect(Array.isArray(first.aliases)).toBe(true);
    expect(first.recentActivity).toBeDefined();
    expect(first.targets).toBeDefined();
    expect(Array.isArray(first.ttps)).toBe(true);
    expect(first.datasets).toBeDefined();
    expect(first.sources).toBeDefined();
    expect(Array.isArray(first.notes)).toBe(true);
    expect(first.sourceActivation).toMatchObject({
      query: "Scattered Spider",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false
    });
    expect(first.sla).toMatchObject({
      endpoint: "/v1/intel/search.sla",
      sourceActivation: {
        dryRun: true,
        willMutate: false,
        willStartCrawling: false
      },
      scheduler: {
        workerSafetyPlan: {
          dryRun: true,
          willMutate: false
        }
      },
      publicChannel: {
        enforcementStatus: expect.any(String),
        releaseAction: expect.any(String),
        checkCount: expect.any(Number)
      },
      enforcement: {
        endpoint: "/v1/intel/search.sla.enforcement",
        dryRun: true,
        willMutate: false,
        willStartCrawling: false,
        publicApiProof: {
          canonicalMethod: "POST",
          canonicalPath: "/api/ti/search",
          getProofOptionalUnlessRequired: true
        },
        statePolicy: {
          ready: {
            preservesCompatibilityFields: true,
            cursorPollable: true
          },
          partial: {
            preservesCompatibilityFields: true,
            cursorPollable: true
          },
          reviewRequired: {
            preservesCompatibilityFields: true,
            cursorPollable: true
          },
          blocked: {
            preservesCompatibilityFields: true,
            cursorPollable: true
          },
          error: {
            preservesCompatibilityFields: true,
            cursorPollable: false
          }
        },
        polling: {
          nextPollSeconds: expect.any(Number),
          cursor: expect.any(String),
          nextCursor: expect.any(String),
          duplicateRunReuse: expect.any(Boolean)
        }
      },
      claimLedger: {
        enforcement: expect.any(Object),
        certification: {
          status: expect.any(String),
          releaseAction: expect.any(String),
          objectStore: expect.any(Object),
          postgresRepository: expect.any(Object),
          cursorReplay: expect.any(Object),
          retention: expect.any(Object),
          redaction: expect.any(Object),
          claimPromotion: expect.any(Object),
          downstream: expect.any(Object)
        },
        safeOutput: {
          sensitiveBodiesExposed: false,
          objectKeysExposed: false,
          unsafeRestrictedMetadataExposed: false
        }
      },
      polling: {
        nextPollSeconds: expect.any(Number),
        cursor: expect.any(String),
        nextCursor: expect.any(String)
      }
    });
    expect(["pass", "watch", "blocked"]).toContain((first.sla as { releaseState: string }).releaseState);
    expect((first.sla as { enforcement: { compatibilityFields: string[]; current: { status: string }; repairPackets: Array<{ dryRun: boolean; willMutate: boolean; willStartCrawling: boolean }> } }).enforcement.compatibilityFields).toEqual(expect.arrayContaining([
      "query",
      "mode",
      "status",
      "runId",
      "refreshAfterSeconds",
      "summary",
      "warnings",
      "cursor",
      "nextCursor"
    ]));
    expect(["ready", "partial", "review_required", "blocked"]).toContain((first.sla as { enforcement: { current: { status: string } } }).enforcement.current.status);
    expect((first.sla as { enforcement: { repairPackets: Array<{ dryRun: boolean; willMutate: boolean; willStartCrawling: boolean }> } }).enforcement.repairPackets.every((packet) =>
      packet.dryRun && !packet.willMutate && !packet.willStartCrawling
    )).toBe(true);
    expect(Array.isArray((first.sourceActivation as { sources: unknown[] }).sources)).toBe(true);
    expect((first.scheduler as { queueEconomics: { apiTargets: string[] } }).queueEconomics.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(first.claimLedger).toMatchObject({
      trustGate: expect.any(String),
      counts: expect.any(Object),
      enforcement: {
        state: expect.any(String),
        releaseAction: expect.any(String),
        repairPackets: expect.any(Array),
        downstream: {
          agent07AnswerReadiness: expect.any(String),
          agent08GraphExportGate: expect.any(String),
          agent10ReleasePacket: expect.any(String)
        }
      },
      certification: {
        status: expect.any(String),
        releaseAction: expect.any(String),
        fixtures: {
          cleanCutover: "covered",
          missingObject: "covered",
          hashMismatch: "covered",
          staleExtractorReplay: "covered",
          restrictedMetadataRedaction: "covered",
          retiredSource: "covered",
          graphHold: "covered",
          lowConfidence: "covered",
          duplicateClaim: "covered",
          cursorGap: "covered",
          retentionExpiry: "covered",
          legalHold: "covered",
          objectStoreWriteFailure: "covered"
        },
        downstream: {
          agent07AnswerReadiness: expect.any(String),
          agent08ExportGate: expect.any(String),
          agent10ReleaseTrain: expect.any(String)
        }
      },
      safeOutput: {
        sensitiveBodiesExposed: false,
        objectKeysExposed: false,
        unsafeRestrictedMetadataExposed: false
      }
    });
    expect(first.graphExport).toMatchObject({
      publicFactPolicy: expect.any(String),
      slaState: expect.any(String),
      enforcementState: expect.any(String),
      schemaSafe: expect.any(Boolean),
      ledgerComplete: expect.any(Boolean),
      answerCaveats: expect.any(Array),
      proofRoute: "/v1/exports/stix"
    });
    expect(first.graph).toMatchObject({
      endpoint: "/v1/intel/search.graph",
      exportSla: {
        endpoint: "/v1/intel/search.graph",
        publicAnswerImpact: expect.any(String),
        stixImpact: expect.any(String)
      },
      enforcement: {
        endpoint: "/v1/intel/search.graph",
        releaseGate: {
          publicAnswers: expect.any(String),
          stixPromotion: expect.any(String),
          schemaSafe: expect.any(Boolean),
          ledgerComplete: expect.any(Boolean)
        },
        answerCaveats: expect.any(Array)
      },
      runtime: {
        endpoint: "/v1/intel/search.graph",
        publicFactPolicy: expect.any(String),
        relationshipCount: expect.any(Number),
        relationships: expect.any(Array),
        liveUpdate: {
          mode: "incremental_live_search_graph",
          nextPollSeconds: 3,
          cursorField: "graph.deltas[].cursor",
          weakDiscoveryPolicy: "pivots_and_caveats_only",
          publicChannelPolicy: "hint_until_corroborated_or_reviewed",
          restrictedEvidencePolicy: "held_context_no_public_fact",
          stixPolicy: "export_only_reviewed_or_promoted_relationships",
          taxiiBoundary: "descriptor_only_no_server"
        }
      },
      liveUpdate: {
        mode: "incremental_live_search_graph",
        responsePolicy: "seconds_level_polling",
        scenarioCoverage: expect.arrayContaining([
          expect.objectContaining({ name: "scattered_spider_clear_web" }),
          expect.objectContaining({ name: "stix_export_eligible" })
        ]),
        agentHandoffs: {
          agent06ClaimLedger: "ledger_ids_required_for_promotion",
          agent07AnswerCaveats: "surface_weak_public_restricted_stale_contradicted_and_missing_provenance",
          agent09ContractIndex: "expose_graph_live_update",
          agent10ReleaseGate: "graph_live_incremental_gate"
        }
      }
    });
    expect(first.answer).toBeDefined();
    expect(first.publicTiAnswer).toMatchObject({
      schemaVersion: "ti.public_answer_contract.v1",
      route: {
        endpoint: "/v1/intel/search",
        publicWrapperPath: "/api/ti/search",
        publicWrapperMethod: "POST",
        cursor: expect.any(String),
        nextCursor: expect.any(String)
      },
      safeWording: {
        overstatesLiveSnippets: false,
        rawEvidenceExposed: false,
        restrictedPayloadsExposed: false
      },
      sourceActivation: {
        dryRun: true,
        willMutate: false,
        willStartCrawling: false
      },
      graphStixReadiness: {
        proofRoute: "/v1/exports/stix"
      },
      releaseCandidate: {
        schemaVersion: "ti.public_answer_release_candidate.v1",
        publicPostCompatibility: {
          canonicalMethod: "POST",
          canonicalPath: "/api/ti/search",
          stableFieldsPreserved: true,
          noLeakDto: true
        },
        agent10RcGate: {
          dryRun: true,
          willMutate: false,
          willStartCrawling: false
        }
      },
      ux: {
        schemaVersion: "ti.public_answer_ux.v1",
        polling: {
          intervalSeconds: 3,
          nextPollAfterSeconds: 3,
          cursorRequired: true
        },
        freshness: {
          updatedLabel: "Updated",
          lastSeenLabel: "Last seen",
          noLastSeenFiction: expect.any(Boolean)
        },
        publicWrapperCompatibility: {
          canonicalMethod: "POST",
          canonicalPath: "/api/ti/search",
          noDefaultQuery: true
        }
      },
      stateMachine: {
        schemaVersion: "ti.public_answer_polling_state.v1",
        polling: {
          cursorRequired: true
        },
        safeNoResult: {
          overstatesAbsence: false
        },
        holds: {
          restrictedMetadataBlocked: {
            blocked: expect.any(Boolean)
          },
          graphStixHolds: {
            hold: expect.any(Boolean)
          }
        }
      }
    });
    expect(first).toMatchObject({
      updated: expect.any(String),
      pollCursor: expect.any(String),
      deltaCursor: expect.any(String),
      publicWrapperDelta: {
        schemaVersion: "ti.public_wrapper_delta.v1",
        query: "Scattered Spider",
        stablePublicFields: expect.arrayContaining([
          "status",
          "summary",
          "runId",
          "refreshAfterSeconds",
          "pollCursor",
          "deltaCursor",
          "updated",
          "sources",
          "publicChannel",
          "restrictedMetadata",
          "claimLedger",
          "graph"
        ]),
        compatibility: {
          canonicalMethod: "POST",
          canonicalPath: "/api/ti/search",
          mapsTo: "/v1/intel/search",
          backwardsCompatible: true,
          noRawProofPayloads: true,
          runIdStableAcrossPolls: true,
          refreshAfterSeconds: 3
        },
        polling: {
          runId: expect.any(String),
          pollCursor: expect.any(String),
          deltaCursor: expect.any(String),
          nextPollSeconds: 3,
          updated: expect.any(String),
          cursorRequired: true,
          changedSinceCursor: {
            cursor: expect.any(String),
            nextCursor: expect.any(String),
            cursorContinuity: expect.any(String),
            empty: expect.any(Boolean),
            counts: {
              scheduler: expect.any(Number),
              answer: expect.any(Number),
              graph: expect.any(Number),
              claimLedgerHolds: expect.any(Number),
              publicChannelHints: expect.any(Number),
              restrictedHeld: expect.any(Number)
            }
          }
        },
        deltas: {
          answer: expect.any(Array),
          scheduler: {
            cursorContinuity: expect.any(String)
          },
          sourceCoverage: {
            coverageState: expect.any(String),
            gaps: expect.any(Array)
          },
          publicChannel: {
            status: expect.any(String),
            hintCount: expect.any(Number)
          },
          restrictedMetadata: {
            status: expect.any(String),
            held: expect.any(Boolean)
          },
          claimLedger: {
            trustGate: expect.any(String),
            blockers: expect.any(Array)
          },
          graph: {
            relationshipCount: expect.any(Number),
            liveUpdate: expect.any(Object)
          }
        },
        releaseBoardHandoff: {
          agent02SchedulerCursors: expect.any(String),
          agent06ClaimLedger: expect.any(String),
          agent07AnswerDeltas: expect.any(String),
          agent08GraphDeltas: expect.any(String),
          agent10ReleaseBoard: expect.any(String)
        },
        noLeakExamples: expect.any(Array)
      }
    });
    expect((first.publicTiAnswer as { sourceCoverageGaps: string[] }).sourceCoverageGaps).toBeArray();
    expect((first.publicTiAnswer as { nextPoll: { cursorRequired: boolean } }).nextPoll.cursorRequired).toBe(true);
    expect((first.publicTiAnswer as { releaseCandidate: { releaseGates: Array<{ name: string }>; effects: Record<string, { proofRoute: string }>; fixtures: Array<{ queryClass: string }> } }).releaseCandidate.releaseGates.map((gate) => gate.name)).toEqual(expect.arrayContaining([
      "sourceCanary",
      "schedulerControlPlane",
      "publicChannelPromotion",
      "restrictedEmergencyStop",
      "evidenceCutover",
      "graphExport",
      "apiContractState"
    ]));
    expect((first.publicTiAnswer as { releaseCandidate: { effects: Record<string, { proofRoute: string }> } }).releaseCandidate.effects.apiContractState.proofRoute).toBe("/v1/contracts");
    expect((first.publicTiAnswer as { releaseCandidate: { fixtures: Array<{ queryClass: string }> } }).releaseCandidate.fixtures.map((fixture) => fixture.queryClass)).toEqual(expect.arrayContaining(["actor", "cve", "malware_tool", "country", "sector", "victim"]));
    expect((first.publicTiAnswer as { ux: { compactAnswerCopy: { summary: string[] }; forbiddenCopy: string[]; evidenceStageLabels: Record<string, unknown> } }).ux.compactAnswerCopy.summary.length).toBeGreaterThan(0);
    expect((first.publicTiAnswer as { ux: { compactAnswerCopy: { summary: string[] } } }).ux.compactAnswerCopy.summary.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify((first.publicTiAnswer as { ux: { compactAnswerCopy: unknown } }).ux.compactAnswerCopy)).not.toMatch(/not in local cache|local cache|default APT29/i);
    expect((first.publicTiAnswer as { ux: { forbiddenCopy: string[] } }).ux.forbiddenCopy).toEqual(expect.arrayContaining(["not in local cache", "local cache", "demo", "default APT29"]));
    expect((first.publicTiAnswer as { stateMachine: { state: string; changedSinceCursor: { cursor: string; nextCursor: string }; uiFields: string[] } }).stateMachine.uiFields).toEqual(expect.arrayContaining([
      "progress",
      "changedSinceCursor",
      "polling",
      "holds"
    ]));
    expect(Array.isArray(first.answerGraphCaveats)).toBe(true);
    expect(Array.isArray(first.answerDeltas)).toBe(true);
    expect(Array.isArray(first.reviewGates)).toBe(true);

    const cursor = first.cursor as string;
    const second = await body(await handleApiRequest(api(`/v1/intel/search?q=Scattered%20Spider&entityType=actor&cursor=${encodeURIComponent(cursor)}`), options));
    expect(second.cursor).toBeTruthy();
    expect(second.runId).toBeTruthy();
    expect((second.publicWrapperDelta as { polling: { runId: string } }).polling.runId).toBe(second.runId as string);
    expect((second.scheduler as { cursorContinuity: string }).cursorContinuity).toBe("waiting_for_deltas");
    expect((second.sla as { enforcement: { polling: { cursorContinuity: string } } }).enforcement.polling.cursorContinuity).toBe("waiting_for_deltas");
  });

  test("returns a safe no-result public TI answer contract while live collection is pending", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_no_result", tags: ["apt29"], type: "rss" }));
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Unseen%20Quartz%20Actor&entityType=actor"), {
      store,
      frontier: new FocusedFrontier()
    }));
    const publicTiAnswer = response.publicTiAnswer as {
      noResult: boolean;
      displayState: string;
      safeSummary: string[];
      waitReasons: Array<{ code: string; message: string }>;
      evidenceLedgerReferences: unknown[];
      nextPoll: { pollable: boolean; nextPollAfterSeconds: number; cursorRequired: boolean };
      route: { publicWrapperPath: string; publicWrapperMethod: string };
      stateMachine: {
        state: string;
        progress: { noResult: boolean };
        polling: { pollReason: string; cursorRequired: boolean };
        holds: { sourceActivationGaps: string[] };
        safeNoResult: { noResult: boolean; wording: string; overstatesAbsence: boolean };
      };
      releaseCandidate: {
        state: string;
        visibleAnswer: { displayState: string; safeSummaryMode: string; canRenderFacts: boolean };
        agent10RcGate: { status: string; decision: string };
        publicPostCompatibility: { canonicalPath: string; cursorRequired: boolean };
      };
      ux: {
        state: string;
        compactAnswerCopy: { heading: string; summary: string[]; statusLine: string };
        freshness: { showLastSeen: boolean; noLastSeenFiction: boolean };
        polling: { intervalSeconds: number; nextPollAfterSeconds: number; hint: string };
      };
      safeWording: { overstatesLiveSnippets: boolean; rawEvidenceExposed: boolean; restrictedPayloadsExposed: boolean; guidance: string[] };
    };

    expect(typeof publicTiAnswer.noResult).toBe("boolean");
    expect(publicTiAnswer.displayState).toMatch(/partial|review_required|searching/);
    expect(publicTiAnswer.safeSummary.length).toBeGreaterThan(0);
    expect(publicTiAnswer.waitReasons.map((reason) => reason.code)).toContain("capture_promotion");
    expect(Array.isArray(publicTiAnswer.evidenceLedgerReferences)).toBe(true);
    expect(publicTiAnswer.nextPoll).toMatchObject({ pollable: true, cursorRequired: true });
    expect(publicTiAnswer.nextPoll.nextPollAfterSeconds).toBeGreaterThan(0);
    expect(publicTiAnswer.route).toMatchObject({ publicWrapperPath: "/api/ti/search", publicWrapperMethod: "POST" });
    expect(publicTiAnswer.stateMachine.state).toMatch(/no_result|searching|partial|source_biased/);
    expect(typeof publicTiAnswer.stateMachine.progress.noResult).toBe("boolean");
    expect(publicTiAnswer.stateMachine.polling.cursorRequired).toBe(true);
    expect(typeof publicTiAnswer.stateMachine.safeNoResult.noResult).toBe("boolean");
    expect(publicTiAnswer.stateMachine.safeNoResult.wording).toBe("Searching");
    expect(publicTiAnswer.stateMachine.safeNoResult.overstatesAbsence).toBe(false);
    expect(publicTiAnswer.releaseCandidate.state).toMatch(/no_result|searching|partial|review_required|source_biased/);
    expect(publicTiAnswer.releaseCandidate.visibleAnswer).toMatchObject({
      safeSummaryMode: expect.any(String),
      canRenderFacts: expect.any(Boolean)
    });
    expect(publicTiAnswer.releaseCandidate.agent10RcGate.status).toMatch(/pass|warning|blocker/);
    expect(publicTiAnswer.releaseCandidate.agent10RcGate.decision).toMatch(/pass|hold|rollback/);
    expect(publicTiAnswer.releaseCandidate.publicPostCompatibility).toMatchObject({
      canonicalPath: "/api/ti/search",
      cursorRequired: true
    });
    expect(publicTiAnswer.ux.state).toBe("searching");
    expect(publicTiAnswer.ux.compactAnswerCopy).toMatchObject({
      heading: "Searching",
      summary: ["Searching"],
      statusLine: "Searching"
    });
    expect(publicTiAnswer.ux.freshness).toMatchObject({
      showLastSeen: false,
      noLastSeenFiction: true
    });
    expect(publicTiAnswer.ux.polling).toMatchObject({
      intervalSeconds: 3,
      nextPollAfterSeconds: 3,
      hint: "poll_after_3_seconds"
    });
    expect(publicTiAnswer.safeWording.overstatesLiveSnippets).toBe(false);
    expect(publicTiAnswer.safeWording.rawEvidenceExposed).toBe(false);
    expect(publicTiAnswer.safeWording.restrictedPayloadsExposed).toBe(false);
  });

  test("keeps unknown actor searches searching-only when generic live results do not match the full query", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_generic_actor_feed",
      name: "Generic actor feed",
      type: "rss",
      url: "https://example.test/generic-actor.xml",
      tags: ["actor"],
      approvedAt: "2026-05-24T00:00:00.000Z",
      approvedBy: "test",
      catalog: {
        canonicalId: "generic-actor-feed",
        publisher: { name: "Generic Actor Feed", trustBasis: "research" },
        tier: "watchlist",
        approvalScope: "safe_public_auto",
        license: "test",
        legalBasis: "public test fixture",
        reliability: 0.5,
        intelligenceValue: 0.2,
        retentionClass: "public_raw",
        coverage: {
          topics: ["actor"],
          actors: [],
          aliases: [],
          industries: [],
          regions: [],
          countries: [],
          languages: ["en"],
          queryPatterns: ["actor"]
        },
        collection: {
          freshnessTargetSeconds: 3600,
          collectionSlaSeconds: 300,
          budgetClass: "low",
          crawlCadenceSeconds: 3600
        },
        adapterCompatibility: ["rss"]
      }
    }));
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Made%20Up%20Actor&entityType=actor"), {
      store,
      frontier: new FocusedFrontier(),
      disableBundledSourcePack: true,
      publicClearWebFetcher: async () => new Response(`<?xml version="1.0"?>
        <rss><channel>
          <item>
            <title>Cyberattack overview</title>
            <link>https://example.test/cyberattack</link>
            <description>Threat actors and ransomware groups are discussed in general.</description>
          </item>
        </channel></rss>`, {
        status: 200,
        headers: { "content-type": "application/rss+xml" }
      })
    }));
    const publicTiAnswer = response.publicTiAnswer as {
      safeSummary: string[];
      evidenceLedgerReferences: unknown[];
      ux: { state: string; compactAnswerCopy: { heading: string; summary: string[]; statusLine: string } };
    };

    expect(publicTiAnswer.safeSummary).toEqual(["Searching"]);
    expect(publicTiAnswer.evidenceLedgerReferences).toEqual([]);
    expect(publicTiAnswer.ux.state).toBe("searching");
    expect(publicTiAnswer.ux.compactAnswerCopy).toMatchObject({
      heading: "Searching",
      summary: ["Searching"],
      statusLine: "Searching"
    });
    expect(JSON.stringify(response)).not.toMatch(/Cyberattack overview|ransomware groups are discussed/i);
  });

  test("schedules continuous actor runs with run reuse and API-ready scheduler status", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_apt29_rss", type: "rss", tags: ["apt29", "nobelium"], crawlFrequencySeconds: 1_800 }));
    store.saveSource(source({ id: "src_apt29_api", type: "api", tags: ["apt29"], crawlFrequencySeconds: 900 }));
    store.saveSource(source({
      id: "src_apt29_metadata",
      type: "tor_metadata",
      accessMethod: "approved_proxy",
      risk: "high",
      tags: ["apt29"],
      governance: {
        approvalState: "approved",
        approvalRequired: true,
        metadataOnly: true,
        approvedAt: "2026-05-24T00:00:00.000Z",
        approvedBy: "reviewer"
      }
    }));
    const frontier = new FocusedFrontier();
    const options = { store, frontier };
    const request = {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_scheduler_api" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", includeDarknetMetadata: true, maxTasks: 4 })
    };

    const created = await body(await handleApiRequest(api("/v1/intel/runs", request), options));
    const run = created.run as { id: string; requestId: string; status: string; taskCount: number };
    const scheduler = created.scheduler as {
      runId: string;
      queuedTaskCount: number;
      selectedTaskCount: number;
      nextPollSeconds: number;
      partialResultReadiness: string;
      emergencyBrakeState: string;
      backpressure: { state: string; slo: { queueAge: { p95Seconds: number }; pollFreshness: { p95Seconds: number } }; agent10SoakPacket: { proofCommand: string } };
      queueEconomics: {
        apiTargets: string[];
        totals: { queued: number; retryDebt: number; maxQueuedAgeSeconds: number };
        workClassBudget: Array<{ workClass: string; budgetSlots: number; maxQueuedAgeSeconds: number }>;
        dryRunCapacityShiftPlan: { dryRun: boolean; willMutate: boolean; steps: unknown[] };
        agent10SoakPacket: { fields: string[]; proofCommands: string[] };
      };
      runtimeExecution: {
        apiTargets: string[];
        totals: { queued: number; leased: number; deadLettered: number };
        pollingDeltas: { cursorContinuity: string; newDeltaCount: number };
        dryRunControls: { dryRun: boolean; willMutate: boolean; controls: unknown[] };
        sourceActivationBudgetGuard: { state: string; estimatedActivationSlots: number };
        agent10SoakPacket: { fields: string[]; proofCommands: string[] };
      };
      runtimeSla: {
        apiTargets: string[];
        state: string;
        metrics: Array<{ name: string; state: string; value: number; threshold: number }>;
        workerSafetyPlan: { dryRun: boolean; willMutate: boolean; recoveryActions: unknown[] };
        agent10ReleasePacket: { fields: string[]; proofCommands: string[]; decision: string };
      };
      slaEnforcement: {
        apiTargets: string[];
        state: string;
        holds: Array<{ reason: string; severity: string }>;
        warnings: Array<{ reason: string; severity: string }>;
        releaseGate: { decision: string; dryRun: boolean; willMutate: boolean; proofCommand: string };
        drainPlan: { dryRun: boolean; willMutate: boolean; steps: unknown[] };
        agent10ReleasePacket: { fields: string[]; proofCommands: string[]; decision: string };
      };
      workerQueueCutover: {
        apiTargets: string[];
        runtime: { engine: string; dryRun: boolean; willMutate: boolean; contractFields: string[] };
        partitions: Array<{ workload: string; leaseTtlSeconds: number; retry: { maxAttempts: number }; deadLetter: { afterAttempts: number } }>;
        capacityEnvelope: { normalMemoryTargetMb: number; hardCeilingMb: number; normalTargetOk: boolean; hardCeilingOk: boolean };
        backendCutoverPackets: Array<{ backend: string; dryRun: boolean; willMutate: boolean }>;
        releaseGate: { decision: string; proofCommands: string[] };
        agent10ReleasePacket: { fields: string[]; proofCommands: string[]; decision: string };
      };
      workerSoakMigration: {
        apiTargets: string[];
        durationHours: number;
        dryRun: boolean;
        willMutate: boolean;
        partitionSlo: Array<{ workload: string; state: string; checkpointCadenceSeconds: number; retryDebtThreshold: number; safeDrainControls: string[] }>;
        aggregate: { state: string; queueAgeP95Seconds: number; queueAgeP99Seconds: number; memoryPressure: number };
        migrationPackets: Array<{ id: string; targetBackend: string; dryRun: boolean; willMutate: boolean; cursorContinuity: string; replayPreservation: string; agent09WarningCodes: string[] }>;
        routeContracts: { contractsField: string };
        releaseTrain: { decision: string; proofCommands: string[]; agent10Fields: string[] };
      };
      workerLeaseSoakHarness: {
        apiTargets: string[];
        dryRun: boolean;
        willMutate: boolean;
        replay: { fixtureName: string; totalTasks: number; duplicateRunReuseRequired: boolean; cursorReplayRequired: boolean };
        workloadSlices: Array<{ scenario: string; taskCount: number; leaseAttempts: number; workerPartitionId: string; expectedPressure: string }>;
        workerPartitions: Array<{ workload: string; workerCount: number; maxConcurrentLeases: number; concurrencyPolicy: string }>;
        leaseSemantics: { exclusiveLeases: boolean; retryBackoff: string; perSourceConcurrency: string };
        fairnessProof: { dimensions: string[]; publicPollingProtected: boolean; lowValueSweepsDeferred: boolean; workloadShares: Array<{ workload: string; taskShare: number }> };
        pressureFixtures: Array<{ scenario: string; expectedSchedulerAction: string; agent09VisibleStatus: string; agent10ReleaseImpact: string }>;
        releaseGate: { decision: string; proofCommands: string[] };
        routeContracts: { contractsField: string };
      };
      productionAdapterTelemetry: {
        apiTargets: string[];
        dryRun: boolean;
        willMutate: boolean;
        adapterContracts: Array<{ implementation: string; mode: string; methods: string[]; telemetryFields: string[] }>;
        telemetry: {
          leaseThroughputPerMinute: number;
          ackLatencyP95Ms: number;
          retryDebt: number;
          deadLetterCauses: Array<{ cause: string; count: number; releaseImpact: string }>;
          queueAge: { p95Seconds: number; p99Seconds: number };
          cursorContinuity: string;
          replayPreservation: string;
          runReuseRatio: number;
          duplicatePublicPollingRatio: number;
          staleClients: number;
          workerHeartbeats: number;
          cancellations: number;
          drainProgress: Array<{ action: string; state: string; estimatedTaskDelta: number }>;
        };
        soakFixtures: Array<{ scenario: string; requiredTelemetry: string[]; safeDrainControls: string[] }>;
        agent09WarningCodes: string[];
        agent10RcGate: { decision: string; fields: string[]; proofCommands: string[] };
      };
      durableBackendReadiness: {
        apiTargets: string[];
        dryRun: boolean;
        willMutate: boolean;
        backendContracts: Array<{ backend: string; primitives: string[]; cursorContinuity: string; duplicateRunReuse: string }>;
        fairnessLanes: Array<{ workload: string; maxConcurrentLeases: number; agingBoostEverySeconds: number; fairnessKeys: string[] }>;
        pollingContract: { nextPollSeconds: number; publicWrapperCursorSemantics: string };
        runReuse: { contract: string };
        drainPlan: { preservesCursorReplayState: boolean; actions: string[] };
        emergencyBrake: { preservesCursorReplayState: boolean; releaseCriteria: string[] };
        releaseGate: { decision: string; proofCommands: string[] };
        routeContracts: { contractsField: string };
      };
      freshnessSloEngine: {
        apiTargets: string[];
        dryRun: boolean;
        willMutate: boolean;
        queryClass: string;
        slo: { targetFreshnessSeconds: number; maxQueueAgeSeconds: number };
        cadence: { recommendedCadenceSeconds: number; sourceHintCount: number };
        sourceCadenceHints: Array<{ sourceId: string; queueAction: string; recommendedCadenceSeconds: number; priorityAgingBoost: number }>;
        queuePressureBehavior: { retryAfterSeconds: number; preservesThreeSecondPolling: boolean; duplicateRunReuse: string; degradeActions: string[] };
        fairnessAging: Array<{ workload: string; preservesPerSourceConcurrency: boolean; agingBoostEverySeconds: number }>;
        routeContracts: { contractsField: string };
      };
      freshnessSloDashboard: {
        schemaVersion: string;
        apiTargets: string[];
        summary: { actorCount: number; publicPollingProtected: boolean };
        actors: Array<{ actor: string; nextPollSeconds: number; duplicateRunReuse: string }>;
        workloadActions: Array<{ workload: string; action: string }>;
        runbook: { duplicateRunReuse: string };
        routeContracts: { contractsField: string };
      };
      interactiveSearchFreshness: {
        schemaVersion: string;
        apiTargets: string[];
        currentQuery: { query: string; queryClass: string; knownHighValueActor: boolean; priorityBand: string; freshnessState: string };
        queueDecision: { decision: string; nextPollSeconds: number; duplicateRunReuse: string; attachedToActiveRun: boolean; deferredBackgroundWorkloads: string[] };
        actorTargets: Array<{ actor: string; schedulerAction: string }>;
        fairnessGuards: { preservesThreeSecondPolling: boolean; preservesDuplicateRunReuse: boolean; lowValueSweepsDeferredBeforeActorStarvation: boolean };
        uiSignals: { state: string; badges: string[]; visibleSchedulerFields: string[] };
        routeContracts: { contractsField: string };
      };
      productionLeaseSemantics: {
        apiTargets: string[];
        dryRun: boolean;
        willMutate: boolean;
        currentBackend: string;
        primaryTargetBackend: string;
        futureBackends: string[];
        postgresContract: { tables: string[]; lease: string; duplicateRunReuse: string; cursorReplay: string };
        leaseLifecycle: Array<{ step: string; cursorVisible: boolean; idempotencyKey: string }>;
        cutoverPhases: Array<{ phase: string; dryRun: boolean; willMutate: boolean; willLeaseTasks: boolean }>;
        safety: { preservesThreeSecondPolling: boolean; duplicateActorQueryRunsSuppressed: boolean; cursorContinuity: string };
        routeContracts: { contractsField: string };
      };
      fairnessGovernance: {
        apiTargets: string[];
        dryRun: boolean;
        willMutate: boolean;
        tenants: { defaultTenantId: string; isolationKey: string; crossTenantBorrowing: string };
        queryClassBudgets: Array<{ tenantId: string; queryClass: string; workClass: string; reservedWorkerSlots: number; maxConcurrentLeases: number; retryAfterSeconds: number; actions: string[] }>;
        workloadFairness: Array<{ workload: string; maxConcurrentLeases: number; preservesThreeSecondPolling: boolean; queuePressureAction: string }>;
        priorityAging: Array<{ queryClass: string; workClass: string; neverBypassPerSourceConcurrency: boolean; agingBoostEverySeconds: number }>;
        pressurePolicy: { publicPolling: string; duplicateRunReuse: string; lowValueSweeps: string; emergencyBrake: string };
        fairnessSlo: { retryAfterSeconds: number; ok: boolean };
        routeContracts: { contractsField: string };
      };
      persistenceReplayCutover: {
        apiTargets: string[];
        dryRun: boolean;
        willMutate: boolean;
        currentBackend: string;
        primaryTargetBackend: string;
        descriptorBackends: string[];
        postgresContracts: Array<{ table: string; keyFields: string[]; replayRole: string }>;
        replaySemantics: { refreshAfterSeconds: number; pollCursor: string; deltaCursor: string; noDefaultActorFallback: boolean; noStaleCacheReady: boolean; noGenericLivePromotion: boolean; unknownActorPolicy: string };
        restartFixtures: Array<{ name: string; preservesThreeSecondPolling: boolean; preservesCursorContinuity: boolean; duplicateRunReuseRequired: boolean }>;
        cutoverPhases: Array<{ phase: string; dryRun: boolean; willMutate: boolean; requiredChecks: string[] }>;
        handoffs: { agent09PublicApiFields: string[]; agent10CapacityReleaseGate: string[] };
        releaseGate: { decision: string; proofCommands: string[] };
        routeContracts: { contractsField: string };
      };
      postgresQueueAdapter: {
        apiTargets: string[];
        backendSelection: { activeBackend: string; requestedBackend: string; postgresEnabled: boolean; effectiveLeaseOwner: string };
        safety: { disabledByDefault: boolean; failClosedWithoutDsn: boolean; failClosedWithoutExecutor: boolean; embeddedMemoryRemainsAuthoritative: boolean; publicSearchPollingProtected: boolean };
        operationContracts: Array<{ operation: string; postgresTableContracts: string[]; disabledBehavior: string }>;
        preparedStatements: Array<{ name: string }>;
        releaseGate: { reasons: string[]; proofCommands: string[] };
        routeContracts: { contractsField: string };
      };
      safetyEnvelope: { allowClearWeb: boolean; allowRestrictedMetadata: boolean; metadataOnlyRestricted: boolean; forbiddenOperations: string[] };
    };

    expect(created.reused).toBe(false);
    expect(run.status).toBe("queued");
    expect(run.taskCount).toBeGreaterThanOrEqual(2);
    expect(scheduler.runId).toBe(run.id);
    expect(scheduler.queuedTaskCount).toBe(run.taskCount);
    expect(scheduler.selectedTaskCount).toBeGreaterThanOrEqual(2);
    expect(scheduler.nextPollSeconds).toBeGreaterThan(0);
    expect(scheduler.partialResultReadiness).toBe("pending");
    expect(scheduler.emergencyBrakeState).toBe("clear");
    expect(scheduler.backpressure.state).toBe("accepted");
    expect(scheduler.backpressure.slo.queueAge.p95Seconds).toBeGreaterThanOrEqual(0);
    expect(scheduler.backpressure.slo.pollFreshness.p95Seconds).toBeGreaterThanOrEqual(0);
    expect(scheduler.backpressure.agent10SoakPacket.proofCommand).toContain("check:frontier-apply-plan");
    expect(scheduler.queueEconomics.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(scheduler.queueEconomics.totals.queued).toBe(run.taskCount);
    expect(scheduler.queueEconomics.workClassBudget.length).toBeGreaterThan(0);
    expect(scheduler.queueEconomics.dryRunCapacityShiftPlan.dryRun).toBe(true);
    expect(scheduler.queueEconomics.dryRunCapacityShiftPlan.willMutate).toBe(false);
    expect(scheduler.queueEconomics.agent10SoakPacket.fields).toContain("memoryPressure");
    expect(scheduler.runtimeExecution.apiTargets).toContain("/v1/intel/runs/{id}");
    expect(scheduler.runtimeExecution.totals.queued).toBe(run.taskCount);
    expect(scheduler.runtimeExecution.pollingDeltas.cursorContinuity).toMatch(/not_started|waiting_for_deltas|continued/);
    expect(scheduler.runtimeExecution.dryRunControls.dryRun).toBe(true);
    expect(scheduler.runtimeExecution.dryRunControls.willMutate).toBe(false);
    expect(scheduler.runtimeExecution.sourceActivationBudgetGuard.state).toMatch(/within_budget|hold_activation_batches|blocked_by_emergency_brake/);
    expect(scheduler.runtimeExecution.agent10SoakPacket.fields).toContain("byWorkClass");
    expect(scheduler.runtimeSla.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(["pass", "watch", "breach"]).toContain(scheduler.runtimeSla.state);
    expect(scheduler.runtimeSla.metrics.map((metric) => metric.name)).toContain("cursor_continuity");
    expect(scheduler.runtimeSla.workerSafetyPlan.dryRun).toBe(true);
    expect(scheduler.runtimeSla.workerSafetyPlan.willMutate).toBe(false);
    expect(scheduler.runtimeSla.agent10ReleasePacket.fields).toContain("workerSafetyPlan");
    expect(scheduler.slaEnforcement.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(["pass", "warning", "hold", "rollback"]).toContain(scheduler.slaEnforcement.state);
    expect(scheduler.slaEnforcement.releaseGate.dryRun).toBe(true);
    expect(scheduler.slaEnforcement.releaseGate.willMutate).toBe(false);
    expect(scheduler.slaEnforcement.releaseGate.proofCommand).toContain("check:frontier-apply-plan");
    expect(scheduler.slaEnforcement.drainPlan.dryRun).toBe(true);
    expect(scheduler.slaEnforcement.drainPlan.willMutate).toBe(false);
    expect(scheduler.slaEnforcement.agent10ReleasePacket.fields).toContain("drainPlan");
    expect(scheduler.workerQueueCutover.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(scheduler.workerQueueCutover.runtime.engine).toBe("bun_worker_runtime");
    expect(scheduler.workerQueueCutover.runtime.dryRun).toBe(true);
    expect(scheduler.workerQueueCutover.runtime.willMutate).toBe(false);
    expect(scheduler.workerQueueCutover.partitions.map((partition) => partition.workload)).toContain("interactive_actor_search");
    expect(scheduler.workerQueueCutover.partitions.map((partition) => partition.workload)).toContain("restricted_metadata_approval");
    expect(scheduler.workerQueueCutover.capacityEnvelope.normalMemoryTargetMb).toBe(96 * 1024);
    expect(scheduler.workerQueueCutover.capacityEnvelope.hardCeilingMb).toBe(160 * 1024);
    expect(scheduler.workerQueueCutover.backendCutoverPackets.map((packet) => packet.backend)).toEqual(expect.arrayContaining(["postgres_advisory_queue", "redis_streams", "nats_jetstream"]));
    expect(scheduler.workerQueueCutover.backendCutoverPackets.every((packet) => packet.dryRun && packet.willMutate === false)).toBe(true);
    expect(scheduler.workerQueueCutover.agent10ReleasePacket.fields).toContain("backendCutoverPackets");
    expect(scheduler.workerSoakMigration.apiTargets).toContain("/v1/contracts");
    expect(scheduler.workerSoakMigration.durationHours).toBe(24);
    expect(scheduler.workerSoakMigration.dryRun).toBe(true);
    expect(scheduler.workerSoakMigration.willMutate).toBe(false);
    expect(scheduler.workerSoakMigration.partitionSlo.map((partition) => partition.workload)).toContain("interactive_actor_search");
    expect(scheduler.workerSoakMigration.migrationPackets.map((packet) => packet.id)).toEqual(expect.arrayContaining(["embedded_to_postgres", "embedded_to_redis", "embedded_to_nats"]));
    expect(scheduler.workerSoakMigration.migrationPackets.every((packet) => packet.dryRun && packet.willMutate === false && packet.cursorContinuity === "preserved")).toBe(true);
    expect(scheduler.workerSoakMigration.routeContracts.contractsField).toBe("surfaces.frontier.contracts.worker_soak_migration");
    expect(scheduler.workerSoakMigration.releaseTrain.proofCommands).toContain("bun run rehearse:cutover examples/cutover-rehearsal-pass.json");
    expect(scheduler.workerLeaseSoakHarness.apiTargets).toContain("/v1/frontier/status");
    expect(scheduler.workerLeaseSoakHarness.apiTargets).toContain("/v1/contracts");
    expect(scheduler.workerLeaseSoakHarness.dryRun).toBe(true);
    expect(scheduler.workerLeaseSoakHarness.willMutate).toBe(false);
    expect(scheduler.workerLeaseSoakHarness.replay.fixtureName).toBe("agent02_10k_multi_worker_lease_replay");
    expect(scheduler.workerLeaseSoakHarness.replay.totalTasks).toBe(10_000);
    expect(scheduler.workerLeaseSoakHarness.replay.duplicateRunReuseRequired).toBe(true);
    expect(scheduler.workerLeaseSoakHarness.replay.cursorReplayRequired).toBe(true);
    expect(scheduler.workerLeaseSoakHarness.workloadSlices.reduce((sum, slice) => sum + slice.taskCount, 0)).toBe(10_000);
    expect(scheduler.workerLeaseSoakHarness.workloadSlices.map((slice) => slice.scenario)).toEqual(expect.arrayContaining(["apt29_actor_burst", "source_outage_wave", "parser_failure_storm", "low_value_sweep_pressure"]));
    expect(scheduler.workerLeaseSoakHarness.workloadSlices.every((slice) => slice.leaseAttempts >= slice.taskCount && slice.workerPartitionId.length > 0)).toBe(true);
    expect(scheduler.workerLeaseSoakHarness.workerPartitions.map((partition) => partition.workload)).toContain("interactive_actor_search");
    expect(scheduler.workerLeaseSoakHarness.workerPartitions.every((partition) => partition.workerCount > 0 && partition.maxConcurrentLeases > 0)).toBe(true);
    expect(scheduler.workerLeaseSoakHarness.leaseSemantics.exclusiveLeases).toBe(true);
    expect(scheduler.workerLeaseSoakHarness.leaseSemantics.retryBackoff).toContain("deterministic");
    expect(scheduler.workerLeaseSoakHarness.leaseSemantics.perSourceConcurrency).toContain("never_bypassed");
    expect(scheduler.workerLeaseSoakHarness.fairnessProof.dimensions).toEqual(["tenant", "query_class", "source_family", "workload", "restricted_policy_state"]);
    expect(scheduler.workerLeaseSoakHarness.fairnessProof.publicPollingProtected).toBe(true);
    expect(scheduler.workerLeaseSoakHarness.fairnessProof.lowValueSweepsDeferred).toBe(true);
    expect(scheduler.workerLeaseSoakHarness.pressureFixtures.map((fixture) => fixture.expectedSchedulerAction)).toEqual(expect.arrayContaining(["reuse_active_run", "hold_restricted_metadata", "retry_then_dead_letter"]));
    expect(scheduler.workerLeaseSoakHarness.routeContracts.contractsField).toBe("surfaces.frontier.contracts.worker_lease_soak_harness");
    expect(scheduler.workerLeaseSoakHarness.releaseGate.proofCommands).toContain("bun run check:contract-index");
    expect(scheduler.productionAdapterTelemetry.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(scheduler.productionAdapterTelemetry.apiTargets).toContain("agent10_rc_gates");
    expect(scheduler.productionAdapterTelemetry.dryRun).toBe(true);
    expect(scheduler.productionAdapterTelemetry.willMutate).toBe(false);
    expect(scheduler.productionAdapterTelemetry.adapterContracts.map((contract) => contract.implementation)).toEqual(expect.arrayContaining(["embedded_memory", "postgres_advisory_queue", "redis_streams", "nats_jetstream"]));
    expect(scheduler.productionAdapterTelemetry.telemetry.leaseThroughputPerMinute).toBeGreaterThan(0);
    expect(scheduler.productionAdapterTelemetry.telemetry.ackLatencyP95Ms).toBeGreaterThan(0);
    expect(scheduler.productionAdapterTelemetry.telemetry.queueAge.p99Seconds).toBeGreaterThanOrEqual(scheduler.productionAdapterTelemetry.telemetry.queueAge.p95Seconds);
    expect(scheduler.productionAdapterTelemetry.telemetry.replayPreservation).toBe("preserved");
    expect(scheduler.productionAdapterTelemetry.soakFixtures.map((fixture) => fixture.scenario)).toContain("public_ti_traffic");
    expect(scheduler.productionAdapterTelemetry.agent10RcGate.fields).toContain("telemetry");
    expect(scheduler.durableBackendReadiness.apiTargets).toContain("/v1/frontier/status");
    expect(scheduler.durableBackendReadiness.apiTargets).toContain("/v1/contracts");
    expect(scheduler.durableBackendReadiness.dryRun).toBe(true);
    expect(scheduler.durableBackendReadiness.willMutate).toBe(false);
    expect(scheduler.durableBackendReadiness.backendContracts.map((contract) => contract.backend)).toEqual(expect.arrayContaining(["embedded_memory", "postgres_advisory_queue", "redis_streams", "nats_jetstream"]));
    expect(scheduler.durableBackendReadiness.backendContracts.every((contract) => contract.primitives.includes("lease") && contract.primitives.includes("dead_letter") && contract.cursorContinuity === "preserved" && contract.duplicateRunReuse === "required")).toBe(true);
    expect(scheduler.durableBackendReadiness.fairnessLanes.map((lane) => lane.workload)).toEqual(expect.arrayContaining(["interactive_actor_search", "public_channel_window", "restricted_metadata_approval", "health_probe"]));
    expect(scheduler.durableBackendReadiness.fairnessLanes.every((lane) => lane.maxConcurrentLeases > 0 && lane.agingBoostEverySeconds > 0 && lane.fairnessKeys.length > 0)).toBe(true);
    expect(scheduler.durableBackendReadiness.pollingContract.nextPollSeconds).toBe(3);
    expect(scheduler.durableBackendReadiness.pollingContract.publicWrapperCursorSemantics).toBe("stable_since_cursor_with_delta_replay");
    expect(scheduler.durableBackendReadiness.runReuse.contract).toBe("duplicate_public_polling_attaches_to_active_run");
    expect(scheduler.durableBackendReadiness.drainPlan.preservesCursorReplayState).toBe(true);
    expect(scheduler.durableBackendReadiness.emergencyBrake.preservesCursorReplayState).toBe(true);
    expect(scheduler.durableBackendReadiness.releaseGate.proofCommands).toContain("bun run check");
    expect(scheduler.durableBackendReadiness.routeContracts.contractsField).toBe("surfaces.frontier.contracts.durable_backend_readiness");
    expect(scheduler.freshnessSloEngine.apiTargets).toContain("/v1/frontier/status");
    expect(scheduler.freshnessSloEngine.apiTargets).toContain("/v1/contracts");
    expect(scheduler.freshnessSloEngine.dryRun).toBe(true);
    expect(scheduler.freshnessSloEngine.willMutate).toBe(false);
    expect(scheduler.freshnessSloEngine.queryClass).toBe("actor");
    expect(scheduler.freshnessSloEngine.slo.targetFreshnessSeconds).toBeGreaterThan(0);
    expect(scheduler.freshnessSloEngine.cadence.sourceHintCount).toBeGreaterThan(0);
    expect(scheduler.freshnessSloEngine.sourceCadenceHints.every((hint) => hint.recommendedCadenceSeconds > 0 && hint.priorityAgingBoost >= 0)).toBe(true);
    expect(scheduler.freshnessSloEngine.queuePressureBehavior.preservesThreeSecondPolling).toBe(true);
    expect(scheduler.freshnessSloEngine.queuePressureBehavior.duplicateRunReuse).toBe("required");
    expect(scheduler.freshnessSloEngine.fairnessAging.every((lane) => lane.preservesPerSourceConcurrency && lane.agingBoostEverySeconds > 0)).toBe(true);
    expect(scheduler.freshnessSloEngine.routeContracts.contractsField).toBe("surfaces.frontier.contracts.freshness_slo_engine");
    expect(scheduler.freshnessSloDashboard.schemaVersion).toBe("ti.scheduler_freshness_slo_dashboard.v1");
    expect(scheduler.freshnessSloDashboard.apiTargets).toEqual(expect.arrayContaining(["/v1/frontier/status", "/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/contracts"]));
    expect(scheduler.freshnessSloDashboard.summary.actorCount).toBe(8);
    expect(scheduler.freshnessSloDashboard.summary.publicPollingProtected).toBe(true);
    expect(scheduler.freshnessSloDashboard.actors.map((actor) => actor.actor)).toEqual(expect.arrayContaining(["APT29", "APT42", "Sandworm", "Volt Typhoon", "Lazarus", "LockBit", "Akira", "Scattered Spider"]));
    expect(scheduler.freshnessSloDashboard.actors.every((actor) => actor.nextPollSeconds === 3 && actor.duplicateRunReuse === "required")).toBe(true);
    expect(scheduler.freshnessSloDashboard.workloadActions.map((action) => action.workload)).toEqual(expect.arrayContaining(["interactive_actor_search", "public_channel_window", "restricted_metadata_approval"]));
    expect(scheduler.freshnessSloDashboard.runbook.duplicateRunReuse).toBe("required_before_enqueue");
    expect(scheduler.freshnessSloDashboard.routeContracts.contractsField).toBe("surfaces.frontier.contracts.scheduler_freshness_slo_dashboard");
    expect(scheduler.interactiveSearchFreshness.schemaVersion).toBe("ti.scheduler_interactive_search_freshness.v1");
    expect(scheduler.interactiveSearchFreshness.apiTargets).toEqual(expect.arrayContaining(["/v1/frontier/status", "/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/contracts"]));
    expect(scheduler.interactiveSearchFreshness.currentQuery).toMatchObject({
      query: "APT29",
      queryClass: "actor",
      knownHighValueActor: true
    });
    expect(scheduler.interactiveSearchFreshness.queueDecision.nextPollSeconds).toBe(3);
    expect(scheduler.interactiveSearchFreshness.queueDecision.duplicateRunReuse).toBe("required_before_enqueue");
    expect(["reuse_active_run", "enqueue_interactive_refresh", "raise_priority", "serve_partial_and_poll", "metadata_review_hold"]).toContain(scheduler.interactiveSearchFreshness.queueDecision.decision);
    expect(scheduler.interactiveSearchFreshness.actorTargets.map((actor) => actor.actor)).toContain("APT29");
    expect(scheduler.interactiveSearchFreshness.fairnessGuards).toMatchObject({
      preservesThreeSecondPolling: true,
      preservesDuplicateRunReuse: true,
      lowValueSweepsDeferredBeforeActorStarvation: true
    });
    expect(scheduler.interactiveSearchFreshness.uiSignals.visibleSchedulerFields).toEqual(expect.arrayContaining(["freshness_state", "queue_decision", "duplicate_run_reuse", "deferred_background_workloads"]));
    expect(scheduler.interactiveSearchFreshness.routeContracts.contractsField).toBe("surfaces.frontier.contracts.scheduler_interactive_search_freshness");
    expect(scheduler.productionLeaseSemantics.apiTargets).toContain("/v1/frontier/status");
    expect(scheduler.productionLeaseSemantics.apiTargets).toContain("/v1/frontier/apply-plan");
    expect(scheduler.productionLeaseSemantics.dryRun).toBe(true);
    expect(scheduler.productionLeaseSemantics.willMutate).toBe(false);
    expect(scheduler.productionLeaseSemantics.currentBackend).toBe("embedded_memory");
    expect(scheduler.productionLeaseSemantics.primaryTargetBackend).toBe("postgres_advisory_queue");
    expect(scheduler.productionLeaseSemantics.futureBackends).toEqual(["redis_streams", "nats_jetstream"]);
    expect(scheduler.productionLeaseSemantics.postgresContract.tables).toContain("frontier_leases");
    expect(scheduler.productionLeaseSemantics.postgresContract.lease).toContain("SKIP LOCKED");
    expect(scheduler.productionLeaseSemantics.postgresContract.cursorReplay).toBe("frontier_events_cursor_replay_required");
    expect(scheduler.productionLeaseSemantics.leaseLifecycle.map((step) => step.step)).toEqual(expect.arrayContaining(["enqueue", "lease", "heartbeat", "ack", "retry", "dead_letter", "drain", "shutdown"]));
    expect(scheduler.productionLeaseSemantics.leaseLifecycle.every((step) => step.cursorVisible && step.idempotencyKey.length > 0)).toBe(true);
    expect(scheduler.productionLeaseSemantics.cutoverPhases.every((phase) => phase.dryRun && phase.willMutate === false && phase.willLeaseTasks === false)).toBe(true);
    expect(scheduler.productionLeaseSemantics.safety.preservesThreeSecondPolling).toBe(true);
    expect(scheduler.productionLeaseSemantics.safety.duplicateActorQueryRunsSuppressed).toBe(true);
    expect(scheduler.productionLeaseSemantics.routeContracts.contractsField).toBe("surfaces.frontier.contracts.production_queue_lease_semantics");
    expect(scheduler.fairnessGovernance.apiTargets).toContain("/v1/frontier/status");
    expect(scheduler.fairnessGovernance.apiTargets).toContain("/v1/intel/runs/{id}");
    expect(scheduler.fairnessGovernance.dryRun).toBe(true);
    expect(scheduler.fairnessGovernance.willMutate).toBe(false);
    expect(scheduler.fairnessGovernance.tenants.defaultTenantId).toBe("tenant_scheduler_api");
    expect(scheduler.fairnessGovernance.tenants.isolationKey).toBe("tenant:queryClass:reuseKey:sourceFamily");
    expect(scheduler.fairnessGovernance.queryClassBudgets.map((lane) => lane.queryClass)).toEqual(expect.arrayContaining(["actor", "ransomware", "cve_advisory", "campaign", "malware_tool", "sector", "country", "victim_company", "infrastructure", "unknown"]));
    expect(scheduler.fairnessGovernance.queryClassBudgets.every((lane) => lane.reservedWorkerSlots > 0 && lane.maxConcurrentLeases > 0 && lane.retryAfterSeconds >= 3)).toBe(true);
    expect(scheduler.fairnessGovernance.queryClassBudgets.find((lane) => lane.queryClass === "actor")?.actions).toEqual(expect.arrayContaining(["preserve_live_polling", "reuse_duplicate_run"]));
    expect(scheduler.fairnessGovernance.workloadFairness.every((lane) => lane.preservesThreeSecondPolling && lane.maxConcurrentLeases > 0)).toBe(true);
    expect(scheduler.fairnessGovernance.priorityAging.every((lane) => lane.neverBypassPerSourceConcurrency && lane.agingBoostEverySeconds > 0)).toBe(true);
    expect(scheduler.fairnessGovernance.pressurePolicy.publicPolling).toBe("always_return_status_with_three_second_hint");
    expect(scheduler.fairnessGovernance.pressurePolicy.duplicateRunReuse).toBe("required_before_enqueue");
    expect(scheduler.fairnessGovernance.pressurePolicy.lowValueSweeps).toBe("bounded_and_deferred_before_interactive_starvation");
    expect(scheduler.fairnessGovernance.fairnessSlo.retryAfterSeconds).toBeGreaterThanOrEqual(3);
    expect(scheduler.fairnessGovernance.routeContracts.contractsField).toBe("surfaces.frontier.contracts.multi_tenant_fairness_governance");
    expect(scheduler.persistenceReplayCutover.apiTargets).toContain("/v1/frontier/status");
    expect(scheduler.persistenceReplayCutover.apiTargets).toContain("/v1/intel/runs/{id}");
    expect(scheduler.persistenceReplayCutover.dryRun).toBe(true);
    expect(scheduler.persistenceReplayCutover.willMutate).toBe(false);
    expect(scheduler.persistenceReplayCutover.currentBackend).toBe("embedded_memory");
    expect(scheduler.persistenceReplayCutover.primaryTargetBackend).toBe("postgres_scheduler_store");
    expect(scheduler.persistenceReplayCutover.descriptorBackends).toEqual(["redis_streams", "nats_jetstream"]);
    expect(scheduler.persistenceReplayCutover.postgresContracts.map((contract) => contract.table)).toEqual(expect.arrayContaining(["scheduler_runs", "frontier_leases", "scheduler_cursor_events", "scheduler_retry_dead_letters", "scheduler_fairness_budget_snapshots"]));
    expect(scheduler.persistenceReplayCutover.postgresContracts.every((contract) => contract.keyFields.length > 0 && contract.replayRole.length > 0)).toBe(true);
    expect(scheduler.persistenceReplayCutover.replaySemantics.refreshAfterSeconds).toBe(3);
    expect(scheduler.persistenceReplayCutover.replaySemantics.pollCursor).toBe("restored_from_scheduler_cursor_events");
    expect(scheduler.persistenceReplayCutover.replaySemantics.deltaCursor).toBe("restored_from_latest_safe_delta");
    expect(scheduler.persistenceReplayCutover.replaySemantics.noDefaultActorFallback).toBe(true);
    expect(scheduler.persistenceReplayCutover.replaySemantics.noStaleCacheReady).toBe(true);
    expect(scheduler.persistenceReplayCutover.replaySemantics.noGenericLivePromotion).toBe(true);
    expect(scheduler.persistenceReplayCutover.restartFixtures.map((fixture) => fixture.name)).toEqual(expect.arrayContaining(["queued_actor_search_restart", "duplicate_public_run_reuse", "emergency_brake_restart"]));
    expect(scheduler.persistenceReplayCutover.restartFixtures.every((fixture) => fixture.preservesThreeSecondPolling && fixture.preservesCursorContinuity && fixture.duplicateRunReuseRequired)).toBe(true);
    expect(scheduler.persistenceReplayCutover.cutoverPhases.every((phase) => phase.dryRun && phase.willMutate === false && phase.requiredChecks.length > 0)).toBe(true);
    expect(scheduler.persistenceReplayCutover.handoffs.agent09PublicApiFields).toContain("pollCursor");
    expect(scheduler.persistenceReplayCutover.handoffs.agent10CapacityReleaseGate).toContain("restart replay fixture pass");
    expect(scheduler.persistenceReplayCutover.releaseGate.proofCommands).toContain("bun run check:api-regression");
    expect(scheduler.persistenceReplayCutover.routeContracts.contractsField).toBe("surfaces.frontier.contracts.scheduler_persistence_replay_cutover");
    expect(scheduler.postgresQueueAdapter.apiTargets).toContain("/v1/frontier/status");
    expect(scheduler.postgresQueueAdapter.backendSelection.activeBackend).toBe("embedded_memory");
    expect(scheduler.postgresQueueAdapter.backendSelection.requestedBackend).toBe("embedded_memory");
    expect(scheduler.postgresQueueAdapter.backendSelection.postgresEnabled).toBe(false);
    expect(scheduler.postgresQueueAdapter.backendSelection.effectiveLeaseOwner).toBe("embedded_memory");
    expect(scheduler.postgresQueueAdapter.safety.disabledByDefault).toBe(true);
    expect(scheduler.postgresQueueAdapter.safety.failClosedWithoutDsn).toBe(true);
    expect(scheduler.postgresQueueAdapter.safety.failClosedWithoutExecutor).toBe(true);
    expect(scheduler.postgresQueueAdapter.safety.embeddedMemoryRemainsAuthoritative).toBe(true);
    expect(scheduler.postgresQueueAdapter.safety.publicSearchPollingProtected).toBe(true);
    expect(scheduler.postgresQueueAdapter.operationContracts.map((contract) => contract.operation)).toEqual(expect.arrayContaining(["enqueueTasks", "leaseNext", "findOrRegisterRun", "deltasSince"]));
    expect(scheduler.postgresQueueAdapter.preparedStatements.map((statement) => statement.name)).toContain("frontier_tasks_lease_fair_next_v1");
    expect(scheduler.postgresQueueAdapter.releaseGate.reasons).toContain("postgres_queue_feature_flag_disabled");
    expect(scheduler.postgresQueueAdapter.routeContracts.contractsField).toBe("surfaces.frontier.contracts.scheduler_postgres_queue_adapter");
    expect(scheduler.safetyEnvelope.allowClearWeb).toBe(true);
    expect(scheduler.safetyEnvelope.allowRestrictedMetadata).toBe(true);
    expect(scheduler.safetyEnvelope.metadataOnlyRestricted).toBe(true);
    expect(scheduler.safetyEnvelope.forbiddenOperations).toContain("payload_download");

    const queued = frontier.snapshot().filter((task) => task.runId === run.id);
    expect(queued).toHaveLength(run.taskCount);
    expect(queued.every((task) => task.tenantId === "tenant_scheduler_api")).toBe(true);
    expect(queued.every((task) => task.planning?.freshnessTargetSeconds && task.planning.maxCost && task.planning.safetyEnvelope)).toBe(true);

    const reused = await body(await handleApiRequest(api("/v1/intel/runs", request), options));
    expect(reused.reused).toBe(true);
    expect((reused.run as { id: string }).id).toBe(run.id);
    expect(frontier.snapshot().filter((task) => task.runId === run.id)).toHaveLength(run.taskCount);
    expect((reused.scheduler as { attachedToActiveRun: boolean; backpressureState: string }).attachedToActiveRun).toBe(true);
    expect((reused.scheduler as { attachedToActiveRun: boolean; backpressureState: string }).backpressureState).toBe("attached_to_active_run");

    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_scheduler_added",
      tenantId: "tenant_scheduler_api",
      runId: run.id,
      cursor: "2026-05-24T21:00:01.000Z#delta_scheduler_added",
      kind: "added"
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_scheduler_promoted",
      tenantId: "tenant_scheduler_api",
      runId: run.id,
      cursor: "2026-05-24T21:00:02.000Z#delta_scheduler_promoted",
      kind: "promoted",
      captureIds: ["cap_scheduler_promoted"]
    }));

    const runStatus = await body(await handleApiRequest(api(`/v1/intel/runs/${run.id}?cursor=${encodeURIComponent("2026-05-24T21:00:01.000Z#delta_scheduler_added")}`), options));
    expect((runStatus.scheduler as { runId: string; queuedTaskCount: number }).runId).toBe(run.id);
    expect((runStatus.scheduler as { runId: string; queuedTaskCount: number }).queuedTaskCount).toBe(run.taskCount);
    expect((runStatus.scheduler as { cursorContinuity: string; promotedEvidenceCount: number; newEvidenceDeltaCount: number; latestCursor: string }).cursorContinuity).toBe("continued");
    expect((runStatus.scheduler as { cursorContinuity: string; promotedEvidenceCount: number; newEvidenceDeltaCount: number; latestCursor: string }).promotedEvidenceCount).toBe(1);
    expect((runStatus.scheduler as { cursorContinuity: string; promotedEvidenceCount: number; newEvidenceDeltaCount: number; latestCursor: string }).newEvidenceDeltaCount).toBeGreaterThanOrEqual(1);
    expect((runStatus.scheduler as { cursorContinuity: string; promotedEvidenceCount: number; newEvidenceDeltaCount: number; latestCursor: string }).latestCursor).toBe("2026-05-24T21:00:02.000Z#delta_scheduler_promoted");

    const frontierStatus = await body(await handleApiRequest(api(`/v1/frontier/status?runId=${run.id}`), options));
    expect(frontierStatus.endpoint).toBe("/v1/frontier/status");
    expect((frontierStatus.scheduler as { query: string; runId: string; queuedTaskCount: number }).query).toBe("APT29");
    expect((frontierStatus.scheduler as { query: string; runId: string; queuedTaskCount: number }).runId).toBe(run.id);
    expect((frontierStatus.scheduler as { query: string; runId: string; queuedTaskCount: number }).queuedTaskCount).toBe(run.taskCount);
    expect((frontierStatus.scheduler as { queueEconomics: { apiTargets: string[] } }).queueEconomics.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { runtimeExecution: { apiTargets: string[] } }).runtimeExecution.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { runtimeSla: { apiTargets: string[] } }).runtimeSla.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { slaEnforcement: { apiTargets: string[]; drainPlan: { dryRun: boolean; willMutate: boolean } } }).slaEnforcement.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { slaEnforcement: { apiTargets: string[]; drainPlan: { dryRun: boolean; willMutate: boolean } } }).slaEnforcement.drainPlan.dryRun).toBe(true);
    expect((frontierStatus.scheduler as { slaEnforcement: { apiTargets: string[]; drainPlan: { dryRun: boolean; willMutate: boolean } } }).slaEnforcement.drainPlan.willMutate).toBe(false);
    expect((frontierStatus.scheduler as { workerQueueCutover: { apiTargets: string[]; runtime: { dryRun: boolean; willMutate: boolean } } }).workerQueueCutover.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { workerQueueCutover: { apiTargets: string[]; runtime: { dryRun: boolean; willMutate: boolean } } }).workerQueueCutover.runtime.dryRun).toBe(true);
    expect((frontierStatus.scheduler as { workerQueueCutover: { apiTargets: string[]; runtime: { dryRun: boolean; willMutate: boolean } } }).workerQueueCutover.runtime.willMutate).toBe(false);
    expect((frontierStatus.scheduler as { workerSoakMigration: { apiTargets: string[]; dryRun: boolean; willMutate: boolean } }).workerSoakMigration.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { workerSoakMigration: { apiTargets: string[]; dryRun: boolean; willMutate: boolean } }).workerSoakMigration.dryRun).toBe(true);
    expect((frontierStatus.scheduler as { workerSoakMigration: { apiTargets: string[]; dryRun: boolean; willMutate: boolean } }).workerSoakMigration.willMutate).toBe(false);
    expect((frontierStatus.scheduler as { productionAdapterTelemetry: { apiTargets: string[]; dryRun: boolean; willMutate: boolean } }).productionAdapterTelemetry.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { productionAdapterTelemetry: { apiTargets: string[]; dryRun: boolean; willMutate: boolean } }).productionAdapterTelemetry.dryRun).toBe(true);
    expect((frontierStatus.scheduler as { productionAdapterTelemetry: { apiTargets: string[]; dryRun: boolean; willMutate: boolean } }).productionAdapterTelemetry.willMutate).toBe(false);
    expect((frontierStatus.scheduler as { durableBackendReadiness: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; pollingContract: { nextPollSeconds: number } } }).durableBackendReadiness.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { durableBackendReadiness: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; pollingContract: { nextPollSeconds: number } } }).durableBackendReadiness.dryRun).toBe(true);
    expect((frontierStatus.scheduler as { durableBackendReadiness: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; pollingContract: { nextPollSeconds: number } } }).durableBackendReadiness.willMutate).toBe(false);
    expect((frontierStatus.scheduler as { durableBackendReadiness: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; pollingContract: { nextPollSeconds: number } } }).durableBackendReadiness.pollingContract.nextPollSeconds).toBe(3);
    expect((frontierStatus.scheduler as { freshnessSloEngine: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; queuePressureBehavior: { preservesThreeSecondPolling: boolean } } }).freshnessSloEngine.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { freshnessSloEngine: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; queuePressureBehavior: { preservesThreeSecondPolling: boolean } } }).freshnessSloEngine.dryRun).toBe(true);
    expect((frontierStatus.scheduler as { freshnessSloEngine: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; queuePressureBehavior: { preservesThreeSecondPolling: boolean } } }).freshnessSloEngine.willMutate).toBe(false);
    expect((frontierStatus.scheduler as { freshnessSloEngine: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; queuePressureBehavior: { preservesThreeSecondPolling: boolean } } }).freshnessSloEngine.queuePressureBehavior.preservesThreeSecondPolling).toBe(true);
    expect((frontierStatus.scheduler as { productionLeaseSemantics: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; primaryTargetBackend: string } }).productionLeaseSemantics.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { productionLeaseSemantics: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; primaryTargetBackend: string } }).productionLeaseSemantics.dryRun).toBe(true);
    expect((frontierStatus.scheduler as { productionLeaseSemantics: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; primaryTargetBackend: string } }).productionLeaseSemantics.willMutate).toBe(false);
    expect((frontierStatus.scheduler as { productionLeaseSemantics: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; primaryTargetBackend: string } }).productionLeaseSemantics.primaryTargetBackend).toBe("postgres_advisory_queue");
    expect((frontierStatus.scheduler as { fairnessGovernance: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; queryClassBudgets: Array<{ queryClass: string }>; pressurePolicy: { duplicateRunReuse: string } } }).fairnessGovernance.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { fairnessGovernance: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; queryClassBudgets: Array<{ queryClass: string }>; pressurePolicy: { duplicateRunReuse: string } } }).fairnessGovernance.dryRun).toBe(true);
    expect((frontierStatus.scheduler as { fairnessGovernance: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; queryClassBudgets: Array<{ queryClass: string }>; pressurePolicy: { duplicateRunReuse: string } } }).fairnessGovernance.willMutate).toBe(false);
    expect((frontierStatus.scheduler as { fairnessGovernance: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; queryClassBudgets: Array<{ queryClass: string }>; pressurePolicy: { duplicateRunReuse: string } } }).fairnessGovernance.queryClassBudgets.map((lane) => lane.queryClass)).toContain("unknown");
    expect((frontierStatus.scheduler as { fairnessGovernance: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; queryClassBudgets: Array<{ queryClass: string }>; pressurePolicy: { duplicateRunReuse: string } } }).fairnessGovernance.pressurePolicy.duplicateRunReuse).toBe("required_before_enqueue");
    expect((frontierStatus.scheduler as { persistenceReplayCutover: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; replaySemantics: { refreshAfterSeconds: number; noDefaultActorFallback: boolean }; restartFixtures: Array<{ name: string }> } }).persistenceReplayCutover.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { persistenceReplayCutover: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; replaySemantics: { refreshAfterSeconds: number; noDefaultActorFallback: boolean }; restartFixtures: Array<{ name: string }> } }).persistenceReplayCutover.dryRun).toBe(true);
    expect((frontierStatus.scheduler as { persistenceReplayCutover: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; replaySemantics: { refreshAfterSeconds: number; noDefaultActorFallback: boolean }; restartFixtures: Array<{ name: string }> } }).persistenceReplayCutover.willMutate).toBe(false);
    expect((frontierStatus.scheduler as { persistenceReplayCutover: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; replaySemantics: { refreshAfterSeconds: number; noDefaultActorFallback: boolean }; restartFixtures: Array<{ name: string }> } }).persistenceReplayCutover.replaySemantics.refreshAfterSeconds).toBe(3);
    expect((frontierStatus.scheduler as { persistenceReplayCutover: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; replaySemantics: { refreshAfterSeconds: number; noDefaultActorFallback: boolean }; restartFixtures: Array<{ name: string }> } }).persistenceReplayCutover.replaySemantics.noDefaultActorFallback).toBe(true);
    expect((frontierStatus.scheduler as { persistenceReplayCutover: { apiTargets: string[]; dryRun: boolean; willMutate: boolean; replaySemantics: { refreshAfterSeconds: number; noDefaultActorFallback: boolean }; restartFixtures: Array<{ name: string }> } }).persistenceReplayCutover.restartFixtures.map((fixture) => fixture.name)).toContain("duplicate_public_run_reuse");
    expect((frontierStatus.scheduler as { postgresQueueAdapter: { backendSelection: { activeBackend: string; effectiveLeaseOwner: string }; safety: { publicSearchPollingProtected: boolean }; operationContracts: Array<{ operation: string; disabledBehavior: string }> } }).postgresQueueAdapter.backendSelection.activeBackend).toBe("embedded_memory");
    expect((frontierStatus.scheduler as { postgresQueueAdapter: { backendSelection: { activeBackend: string; effectiveLeaseOwner: string }; safety: { publicSearchPollingProtected: boolean }; operationContracts: Array<{ operation: string; disabledBehavior: string }> } }).postgresQueueAdapter.backendSelection.effectiveLeaseOwner).toBe("embedded_memory");
    expect((frontierStatus.scheduler as { postgresQueueAdapter: { backendSelection: { activeBackend: string; effectiveLeaseOwner: string }; safety: { publicSearchPollingProtected: boolean }; operationContracts: Array<{ operation: string; disabledBehavior: string }> } }).postgresQueueAdapter.safety.publicSearchPollingProtected).toBe(true);
    expect((frontierStatus.scheduler as { postgresQueueAdapter: { backendSelection: { activeBackend: string; effectiveLeaseOwner: string }; safety: { publicSearchPollingProtected: boolean }; operationContracts: Array<{ operation: string; disabledBehavior: string }> } }).postgresQueueAdapter.operationContracts.find((contract) => contract.operation === "leaseNext")?.disabledBehavior).toBe("throws_fail_closed");
  });

  test("defers public live searches under background queue pressure without duplicating reuse keys", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    for (const actor of ["Scattered Spider", "Akira", "Volt Typhoon", "Turla"]) {
      store.saveSource(source({
        id: `src_${actor.replaceAll(" ", "_").toLowerCase()}`,
        type: "rss",
        trustScore: 0.9,
        tags: [actor.toLowerCase()]
      }));
    }
    for (let index = 0; index < 50; index += 1) {
      frontier.add({
        source: source({ id: `src_sweep_${index}`, type: index % 2 === 0 ? "rss" : "static_web" }),
        tenantId: `tenant_sweep_${index % 7}`,
        intelRequestId: `sweep_${Math.floor(index / 100)}`,
        url: `https://sweep.example.test/background/${index}`,
        discoveredAt: "2026-05-24T00:00:00.000Z",
        anchorText: "APT ransomware campaign exploit",
        parentRelevance: 0.9,
        novelty: 0.8,
        freshness: 0.8,
        fairnessKey: "background:sweep"
      });
    }

    const options = { store, frontier };
    const reuseKeys = new Map<string, string>();
    for (const actor of ["Scattered Spider"]) {
      for (let poll = 0; poll < 1; poll += 1) {
        const response = await body(await handleApiRequest(api(`/v1/intel/search?q=${encodeURIComponent(actor)}&entityType=actor`, {
          headers: { "x-tenant-id": "tenant_public" }
        }), options));
        const planner = response.planner as {
          backpressureState: string;
          backpressureReason?: string;
          reuseKey: string;
          activeRunId?: string;
        };

        expect(planner.activeRunId).toBeUndefined();
        expect(planner.backpressureState).toMatch(/deferred_by_queue_pressure|deferred_by_source_backoff/);
        expect(planner.backpressureReason ?? "").toMatch(/frontier queue depth|crawl backoff|freshness/);
        if (!reuseKeys.has(actor)) reuseKeys.set(actor, planner.reuseKey);
        expect(planner.reuseKey).toBe(reuseKeys.get(actor) ?? "");
      }
    }
  }, 15_000);
});
