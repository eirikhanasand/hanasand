import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadRuntimeConfig } from "../config/runtimeConfig.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { startCanaryCollectionLoop } from "../ops/canaryCollection.ts";
import { sanitizeFields } from "../ops/logger.ts";
import { appendLiveProductDailySnapshot, buildLiveProductSloDashboard, readLiveProductDailySnapshots } from "../ops/productSlo.ts";
import { buildResourceSnapshot } from "../ops/resourceControls.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { InMemoryObjectEvidenceStore } from "../storage/memoryObjectEvidenceStore.ts";

describe("ops utilities", () => {
  test("reports the active runtime resource limits", () => {
    const config = loadRuntimeConfig({ SCRAPER_MEMORY_TARGET_MB: "4096", SCRAPER_MEMORY_CEILING_MB: "6144" });
    const snapshot = buildResourceSnapshot({
      config,
      queueItems: 7,
      cgroup: { memoryCurrentBytes: 1024 ** 3, memoryMaxBytes: 16 * 1024 ** 3, cpuQuotaMicros: 800_000, cpuPeriodMicros: 100_000 },
      memoryUsage: { rss: 1024 ** 3, heapTotal: 0, heapUsed: 512 * 1024 ** 2, external: 0, arrayBuffers: 0 }
    });
    expect(snapshot.memory).toMatchObject({ rssMb: 1024, containerCurrentMb: 1024, containerLimitMb: 16 * 1024, containerHeadroomMb: 15 * 1024, targetMb: 4096, ceilingMb: 6144, status: "ok" });
    expect(snapshot.cpu.containerLimitCores).toBe(8);
    expect(snapshot.concurrency.total).toBe(88);
    expect(snapshot.queue.currentItems).toBe(7);
  });

  test("waits for an active collection cycle before shutdown completes", async () => {
    const store = new InMemoryScraperStore();
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { entered = resolve; });
    (store as any).batch = async (operation: () => unknown) => {
      entered();
      await gate;
      return operation();
    };
    const loop = startCanaryCollectionLoop({
      store,
      frontier: new FocusedFrontier(),
      objectStore: new InMemoryObjectEvidenceStore(),
      enabled: true,
      intervalSeconds: 3600,
      activateSources: false
    });
    const cycle = loop.runOnce();
    await started;
    let stopped = false;
    const stopping = loop.stop().then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);
    release();
    await cycle;
    await stopping;
    expect(loop.getState()).toMatchObject({ enabled: false, running: false });
  });

  test("sanitizes secret-looking fields", () => {
    expect(JSON.stringify(sanitizeFields({ token: "secret", nested: { password: "x", safe: "ok" } }))).not.toContain("secret");
  });

  test("reports measured operational state and appends snapshots", async () => {
    const dashboard = buildLiveProductSloDashboard({
      generatedAt: "2026-06-21T00:00:00.000Z",
      proofMode: "local",
      runs: [{ status: "completed" }, { status: "failed" }],
      sources: [{ id: "source_1", status: "active", type: "rss", url: "https://feed.example.test/rss" }],
      captures: [{ sourceId: "source_1", collectedAt: "2026-06-20T23:30:00.000Z", sensitive: false }],
      incidents: [{ id: "incident_1" }],
      frontier: { queued: 2, leased: 1 },
      resource: { memoryTargetMb: 8192, memoryCeilingMb: 14336 }
    });
    expect(dashboard.schemaVersion).toBe("ti.product_operational_slo.v1");
    expect(dashboard.dashboard.state).toBe("warn");
    expect(dashboard.metrics).toMatchObject({
      sources: { total: 1, active: 1, observed: 1, collectingLast24Hours: 1, collectingHostsLast24Hours: 1, collectingTypesLast24Hours: 1 },
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

  test("alerts on repeated recent collection failures", () => {
    const dashboard = buildLiveProductSloDashboard({
      generatedAt: "2026-06-21T00:00:00.000Z",
      runs: Array.from({ length: 5 }, (_, index) => ({ status: "failed", updatedAt: `2026-06-20T23:0${index}:00.000Z` })),
      sources: [{ id: "source_1", status: "active", type: "rss", url: "https://feed.example.test/rss" }],
      captures: [{ sourceId: "source_1", collectedAt: "2026-06-20T23:30:00.000Z" }],
      incidents: [],
      frontier: { queued: 0, leased: 0 }
    });
    expect(dashboard.metrics.runs.failedLast24Hours).toBe(5);
    expect(dashboard.slos.find((slo) => slo.id === "recent_collection_failures")).toMatchObject({ state: "alert", value: 5 });
    expect(dashboard.dashboard.state).toBe("alert");
  });

  test("warns on a non-empty queue and alerts on a saturated queue", () => {
    const build = (queued: number) => buildLiveProductSloDashboard({
      generatedAt: "2026-06-21T00:00:00.000Z",
      runs: [],
      sources: [{ id: "source_1", status: "active", type: "rss", url: "https://feed.example.test/rss" }],
      captures: [{ sourceId: "source_1", collectedAt: "2026-06-20T23:30:00.000Z" }],
      incidents: [],
      frontier: { queued, leased: 0 }
    });
    expect(build(1).slos.find((slo) => slo.id === "queue_depth")).toMatchObject({ state: "warn", value: 1 });
    expect(build(100).slos.find((slo) => slo.id === "queue_depth")).toMatchObject({ state: "alert", value: 100 });
  });
});
