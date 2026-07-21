import { describe, expect, test } from "bun:test";
import { buildLiveProductSloDashboard } from "../ops/productSlo.ts";

describe("product operational SLO", () => {
  test("does not infer commercial value from capture volume", () => {
    const dashboard = buildLiveProductSloDashboard({
      generatedAt: "2026-06-21T00:00:00.000Z",
      proofMode: "local",
      runs: [],
      sources: [{ status: "active" }],
      captures: Array.from({ length: 100 }, (_, index) => ({ id: `capture_${index}`, collectedAt: "2026-06-20T23:00:00.000Z", sensitive: false })),
      incidents: [],
      frontier: { queued: 0, leased: 0 }
    });
    expect(dashboard.metrics.captures.total).toBe(100);
    expect(dashboard.dashboard.state).toBe("pass");
    expect("productLaunch" in dashboard).toBe(false);
    expect("monetizationReadiness" in dashboard).toBe(false);
    expect("paidProductEconomics" in dashboard).toBe(false);
  });
});
