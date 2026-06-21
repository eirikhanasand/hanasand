import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { evaluateAdapterMetricAlerts, recordAdapterRunMetrics } from "../ops/adapterMetrics.ts";
import { DEFAULT_RESOURCE_BUDGET, loadRuntimeConfig, validateResourceBudget } from "../ops/config.ts";
import { sanitizeFields } from "../ops/logger.ts";
import { MetricsRegistry } from "../ops/metrics.ts";
import { appendLiveProductDailySnapshot, buildLiveProductSloDashboard, readLiveProductDailySnapshots } from "../ops/productSlo.ts";
import { assertCapacityWithinBudget, estimateCapacity, sizeWorkerPools } from "../ops/resourceControls.ts";

describe("ops utilities", () => {
  test("records adapter metrics and emits useful alerts", () => {
    const registry = new MetricsRegistry();
    for (let index = 0; index < 25; index += 1) {
      recordAdapterRunMetrics(registry, { adapter: "rss", sourceType: "rss", result: { items: [], warnings: [], metadata: { failureCategory: "timeout" } } });
    }
    const alerts = evaluateAdapterMetricAlerts(registry.snapshot(), { minRuns: 20, failureRateWarnPercent: 5, failureRateCriticalPercent: 20, rateLimitDelayWarnSeconds: 300, rateLimitDelayCriticalSeconds: 1800 });
    expect(alerts.some((alert) => alert.labels.adapter === "rss")).toBe(true);
  });

  test("loads runtime config and validates resource budget", () => {
    const config = loadRuntimeConfig({});
    expect(config.resourceBudget.maxDarknetMetadataWorkers).toBeGreaterThan(0);
    expect(() => validateResourceBudget(config.resourceBudget)).not.toThrow();
  });

  test("sizes worker pools within capacity", () => {
    const capacity = estimateCapacity(DEFAULT_RESOURCE_BUDGET);
    const pools = sizeWorkerPools(DEFAULT_RESOURCE_BUDGET);
    expect(pools.darknetMetadata).toBeGreaterThan(0);
    expect(() => assertCapacityWithinBudget(capacity)).not.toThrow();
  });

  test("sanitizes secret-looking fields", () => {
    expect(JSON.stringify(sanitizeFields({ token: "secret", nested: { password: "x", safe: "ok" } }))).not.toContain("secret");
  });

  test("reports sellable product metrics and appends snapshots", async () => {
    const dashboard = buildLiveProductSloDashboard({
      generatedAt: "2026-06-21T00:00:00.000Z",
      proofMode: "local",
      runs: [],
      sources: [],
      captures: [],
      incidents: [],
      frontier: {} as any,
      actorRun: { rowCount: 140, usefulRowCount: 100, freshRowCount: 90, sellableRowCount: 100, targetSellableRows: 100 },
      marketplace: { actorViewCount: 20, actorRunCount: 4, uniqueUserCount: 3, trialRunCount: 2, paidRunCount: 1, beneficiaryVerified: true, payoutMethodReady: true, withdrawalReady: true }
    });
    expect(dashboard.monetizationReadiness.status).toBe("ready_for_paid_traffic");
    expect(dashboard.apifyLaunchExperiment.nextRevenueAction).toBe("paid_traffic");
    const dir = mkdtempSync(join(tmpdir(), "product-slo-"));
    const path = join(dir, "daily.jsonl");
    try {
      await appendLiveProductDailySnapshot(path, dashboard.dailySnapshot);
      expect(await readLiveProductDailySnapshots(path)).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
