import { describe, expect, test } from "bun:test";
import { buildLiveProductSloDashboard } from "../ops/productSlo.ts";

describe("product operational SLO", () => {
  test("does not treat unobserved source registrations as collection coverage", () => {
    const dashboard = buildLiveProductSloDashboard({
      generatedAt: "2026-06-21T00:00:00.000Z",
      proofMode: "local",
      runs: [],
      sources: [{ id: "registered_only", status: "active", type: "rss", url: "https://feed.example.test/rss" }],
      captures: [],
      incidents: [],
      frontier: { queued: 0, leased: 0 }
    });
    expect(dashboard.dashboard.state).toBe("alert");
    expect(dashboard.metrics.sources).toMatchObject({ active: 1, observed: 0, collectingLast24Hours: 0, collectingHostsLast24Hours: 0 });
  });

  test("does not infer commercial value from capture volume", () => {
    const dashboard = buildLiveProductSloDashboard({
      generatedAt: "2026-06-21T00:00:00.000Z",
      proofMode: "local",
      runs: [],
      sources: [{ id: "source_1", status: "active", type: "rss", url: "https://feed.example.test/rss" }],
      captures: Array.from({ length: 100 }, (_, index) => ({ id: `capture_${index}`, sourceId: "source_1", collectedAt: "2026-06-20T23:00:00.000Z", sensitive: false })),
      incidents: [],
      frontier: { queued: 0, leased: 0 }
    });
    expect(dashboard.metrics.captures.total).toBe(100);
    expect(dashboard.dashboard.state).toBe("pass");
    expect("productLaunch" in dashboard).toBe(false);
    expect("monetizationReadiness" in dashboard).toBe(false);
    expect("paidProductEconomics" in dashboard).toBe(false);
  });

  test("does not count query aliases on one provider as independent collecting hosts", () => {
    const dashboard = buildLiveProductSloDashboard({
      generatedAt: "2026-06-21T00:00:00.000Z",
      proofMode: "local",
      runs: [],
      sources: [
        { id: "feed_1", status: "active", type: "rss", url: "https://news.example.test/rss?q=APT29" },
        { id: "feed_2", status: "active", type: "rss", url: "https://news.example.test/rss?q=Turla" }
      ],
      captures: [
        { sourceId: "feed_1", collectedAt: "2026-06-20T23:00:00.000Z" },
        { sourceId: "feed_2", collectedAt: "2026-06-20T23:00:00.000Z" }
      ],
      incidents: [],
      frontier: { queued: 0, leased: 0 }
    });
    expect(dashboard.metrics.sources).toMatchObject({ collectingLast24Hours: 2, collectingHostsLast24Hours: 1 });
    expect(dashboard.slos[0]).toMatchObject({ id: "collecting_source_hosts", value: 1 });
  });
});
