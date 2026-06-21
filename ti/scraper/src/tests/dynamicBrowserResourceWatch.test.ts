import { describe, expect, test } from "bun:test";
import { buildDynamicBrowserCutoverPacket } from "../adapters/dynamicBrowserCutover.ts";
import { baseInput, fixture } from "./helpers/dynamicBrowserCutoverFixtures.ts";

describe("dynamic browser resource watch", () => {
  test("keeps resource-heavy canaries in watch without enabling live workers", () => {
    const packet = buildDynamicBrowserCutoverPacket(baseInput({
      pool: { maxWorkers: 3, memoryCapMb: 1800, timeoutMs: 45_000, maxBytes: 7_000_000, queueMaxDepth: 20, currentQueueDepth: 4 },
      fixtures: [fixture("success")]
    }));

    expect(packet.browserWorkersEnabled).toBe(false);
    expect(packet.decision).toBe("watch");
    expect(packet.resourceBudget).toMatchObject({ processIsolation: "separate_worker_pool_required", sharedWithStaticRssPdf: false, estimatedWorstCaseMemoryMb: 5400, memoryBudgetStatus: "hold", timeoutBudgetStatus: "watch", byteBudgetStatus: "watch" });
    expect(packet.gates.find((gate) => gate.name === "memory_cap")?.status).toBe("watch");
    expect(packet.gates.find((gate) => gate.name === "timeout_cap")?.status).toBe("watch");
    expect(packet.gates.find((gate) => gate.name === "byte_cap")?.status).toBe("watch");
    expect(packet.promotionReadiness).toMatchObject({ state: "watch", liveBrowserEnablement: "disabled_requires_separate_operator_allocation", staticRssPdfFallbackRequired: true });
    expect(packet.promotionReadiness.requiredBeforeLiveCanary).toEqual(expect.arrayContaining(["review_watch_gate:memory_cap", "review_watch_gate:timeout_cap", "review_watch_gate:byte_cap"]));
  });
});
