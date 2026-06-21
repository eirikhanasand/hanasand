import { describe, expect, test } from "bun:test";
import { buildProgressiveGraphUpdate, exportProgressiveGraphToStixBundle } from "../export/progressiveGraph.ts";
import { actor, evidence, tool, victim } from "./helpers/progressiveGraphFixtures.ts";

describe("progressive graph polling deltas", () => {
  test("returns compact ranked DTOs across Scattered Spider polling stages", () => {
    const discovery = buildProgressiveGraphUpdate([
      evidence({ id: "scattered_live", sourceId: "live_search", observedAt: "2026-05-24T00:00:00.000Z", relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.68 }] })
    ], { generatedAt: "2026-05-24T00:00:30.000Z" });
    const captured = buildProgressiveGraphUpdate([
      evidence({ id: "scattered_live", sourceId: "live_search", observedAt: "2026-05-24T00:00:00.000Z", relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.68 }] }),
      evidence({ id: "scattered_capture", stage: "captured", sourceId: "capture_worker", captureId: "cap_scattered_spider_delta", observedAt: "2026-05-24T00:03:00.000Z", contentHash: "captured_hash", relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.74 }] })
    ], { previous: discovery.graph, generatedAt: "2026-05-24T00:03:30.000Z" });
    const promoted = buildProgressiveGraphUpdate([
      evidence({ id: "scattered_capture", stage: "captured", sourceId: "capture_worker", captureId: "cap_scattered_spider_delta", observedAt: "2026-05-24T00:03:00.000Z", contentHash: "captured_hash", relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.74 }] }),
      evidence({ id: "scattered_reviewed", stage: "promoted", sourceId: "analyst_review", captureId: "cap_scattered_spider_delta", observedAt: "2026-05-24T00:07:00.000Z", contentHash: "reviewed_hash", relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.9 }, { source: actor, target: tool, type: "uses", confidence: 0.82 }] })
    ], { previous: captured.graph, generatedAt: "2026-05-24T00:07:30.000Z" });

    const capturedDelta = captured.relationshipDeltas[0]!;
    expect(discovery.relationshipDeltas[0]?.kind).toBe("added");
    expect(capturedDelta.relationshipId).toBe(discovery.relationshipDeltas[0]?.relationshipId);
    expect(capturedDelta.kind).toBe("updated");
    expect(capturedDelta.confidenceAfter).toBeGreaterThan(capturedDelta.confidenceBefore ?? 0);
    expect(capturedDelta.sourceIds).toEqual(["capture_worker", "live_search"]);
    expect(capturedDelta.stixEligibility.captureBacked).toBe(true);
    expect(promoted.relationshipDeltas[0]?.kind).toBe("promoted");
    expect(exportProgressiveGraphToStixBundle(promoted, { producerName: "ti-scraper", generatedAt: "2026-05-24T00:08:00.000Z" }).objects.find((object) => object.type === "relationship")?.x_ti_stix_eligibility).toMatchObject({ promoted: true, includedByDefault: true });
  });
});
