import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadRuntimeConfig } from "../config/runtimeConfig.ts";
import { evaluateAdapterMetricAlerts, recordAdapterRunMetrics } from "../ops/adapterMetrics.ts";
import { sanitizeFields } from "../ops/logger.ts";
import { MetricsRegistry } from "../ops/metrics.ts";
import { appendLiveProductDailySnapshot, buildLiveProductSloDashboard, readLiveProductDailySnapshots } from "../ops/productSlo.ts";
import { buildResourceSnapshot } from "../ops/resourceControls.ts";

describe("ops utilities", () => {
  test("records adapter metrics and emits useful alerts", () => {
    const registry = new MetricsRegistry();
    for (let index = 0; index < 25; index += 1) {
      recordAdapterRunMetrics(registry, { adapter: "rss", sourceType: "rss", result: { items: [], warnings: [], metadata: { failureCategory: "timeout" } } });
    }
    const alerts = evaluateAdapterMetricAlerts(registry.snapshot(), { minRuns: 20, failureRateWarnPercent: 5, failureRateCriticalPercent: 20, rateLimitDelayWarnSeconds: 300, rateLimitDelayCriticalSeconds: 1800 });
    expect(alerts.some((alert) => alert.labels.adapter === "rss")).toBe(true);
  });

  test("reports the active runtime resource limits", () => {
    const config = loadRuntimeConfig({ SCRAPER_MEMORY_TARGET_MB: "4096", SCRAPER_MEMORY_CEILING_MB: "6144" });
    const snapshot = buildResourceSnapshot({
      config,
      queueItems: 7,
      memoryUsage: { rss: 1024 ** 3, heapTotal: 0, heapUsed: 512 * 1024 ** 2, external: 0, arrayBuffers: 0 }
    });
    expect(snapshot.memory).toMatchObject({ rssMb: 1024, targetMb: 4096, ceilingMb: 6144, status: "ok" });
    expect(snapshot.concurrency.total).toBe(76);
    expect(snapshot.queue.currentItems).toBe(7);
  });

  test("sanitizes secret-looking fields", () => {
    expect(JSON.stringify(sanitizeFields({ token: "secret", nested: { password: "x", safe: "ok" } }))).not.toContain("secret");
  });

  test("reports measured operational state and appends snapshots", async () => {
    const dashboard = buildLiveProductSloDashboard({
      generatedAt: "2026-06-21T00:00:00.000Z",
      proofMode: "local",
      runs: [{ status: "completed" }, { status: "failed" }],
      sources: [{ id: "source_1", status: "active" }],
      captures: [{ sourceId: "source_1", collectedAt: "2026-06-20T23:30:00.000Z", sensitive: false }],
      incidents: [{ id: "incident_1" }],
      frontier: { queued: 2, leased: 1 },
      resource: { memoryTargetMb: 8192, memoryCeilingMb: 14336 }
    });
    expect(dashboard.schemaVersion).toBe("ti.product_operational_slo.v1");
    expect(dashboard.dashboard.state).toBe("pass");
    expect(dashboard.metrics).toMatchObject({
      sources: { total: 1, active: 1, observed: 1, collectingLast24Hours: 1 },
      captures: { total: 1, collectedLast24Hours: 1 },
      incidents: { total: 1 },
      runs: { completed: 1, failed: 1 },
      queue: { queued: 2, leased: 1 }
    });
    expect("productLaunch" in dashboard).toBe(false);
    expect("monetizationReadiness" in dashboard).toBe(false);
    expect("paidProductEconomics" in dashboard).toBe(false);

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
