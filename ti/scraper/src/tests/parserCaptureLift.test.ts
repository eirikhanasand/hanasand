import { describe, expect, test } from "bun:test";
import { buildLiveProductSloDashboard } from "../ops/productSlo.ts";

describe("parser capture lift metric", () => {
  test("counts parser lift through buyer-visible useful and fresh rows", () => {
    const dashboard = buildLiveProductSloDashboard({
      generatedAt: "2026-06-21T00:00:00.000Z",
      proofMode: "local",
      runs: [],
      sources: [],
      captures: [],
      incidents: [],
      frontier: {} as any,
      actorRun: { rowCount: 120, usefulRowCount: 92, freshRowCount: 86, sellableRowCount: 100, targetSellableRows: 100 }
    });
    expect(dashboard.metrics.sellable).toBe(100);
    expect(dashboard.metrics.usefulRate).toBeGreaterThan(0.7);
    expect(dashboard.scaleStepGates[0].ready).toBe(true);
  });
});
