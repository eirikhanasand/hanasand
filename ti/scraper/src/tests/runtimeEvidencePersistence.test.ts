import { describe, expect, test } from "bun:test";
import { buildRuntimeEvidenceFixture } from "./helpers/runtimeEvidenceFixtures.ts";

describe("runtime evidence persistence", () => {
  test("persists public-channel runtime promotion into captures incidents and snapshots", () => {
    const { persisted, store } = buildRuntimeEvidenceFixture();
    expect(persisted.source?.crawlState?.cursor).toBe("3003");
    expect(persisted.captures).toHaveLength(2);
    expect(persisted.incidents.length).toBeGreaterThan(0);
    expect(persisted.snapshot).toMatchObject({ query: "APT29", normalizedQuery: "apt29", runId: "run_q", status: "partial" });
    expect(persisted.safeOutput).toEqual({ sensitiveBodiesExposed: false, objectKeysExposed: false, rawMediaPayloadsExposed: false, privateDataExposed: false });
    expect(store.getSource("src_runtime_q")?.metadata?.telegramPublicConnector).toMatchObject({ sourceHealthPatch: { sourceId: "src_runtime_q", fetchOutcome: "success" } });
  });
});
