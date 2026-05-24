import { describe, expect, test } from "bun:test";
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
import { assertCapacityWithinBudget, buildResourceSnapshot, estimateCapacity, sizeWorkerPools } from "../ops/resourceControls.ts";
import { WorkerSupervisor } from "../ops/supervisor.ts";
import type { GraphExportEnforcementDto, GraphExportSlaDto } from "../types.ts";
import type { TelegramPublicSlaReportDto } from "../adapters/telegramPublic.ts";

const logger = {
  debug() {},
  info() {},
  warn() {},
  error() {}
};

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
      state: "pass",
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
      trends
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
    expect(promote.runtimeProofs.find((proof) => proof.name === "graph_export_sla")?.graphExportSla).toMatchObject({
      endpoint: "agent10_release_packet",
      state: "pass",
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
