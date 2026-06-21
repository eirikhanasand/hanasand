import { describe, expect, test } from "bun:test";
import { productionEvidenceReplayRef } from "../adapters/productionAdapterRuntime.ts";
import { generatedAt } from "./helpers/productionAdapterRuntimeFixtures.ts";

describe("production evidence replay refs", () => {
  test("builds deterministic refs for extraction-ready capture metadata", () => {
    const replayRef = productionEvidenceReplayRef({ sourceId: "src_static", canonicalUrlHash: "urlhash:abc", contentHash: "contenthash:def", fetchedAt: generatedAt });
    expect(replayRef).toMatch(/^evidence_replay_ref:[a-f0-9]{16}$/);
    expect(productionEvidenceReplayRef({ sourceId: "src_static", canonicalUrlHash: "urlhash:abc", contentHash: "contenthash:def", fetchedAt: generatedAt })).toBe(replayRef);
  });
});
