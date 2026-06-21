import { describe, expect, test } from "bun:test";
import { buildProgressiveGraphUpdate } from "../export/progressiveGraph.ts";
import { actor, apt29, embassy, evidence, phishing, tool, victim } from "./helpers/progressiveGraphFixtures.ts";

describe("progressive graph contradiction deltas", () => {
  test("emits downgraded contradicted and stale relationship deltas for polling clients", () => {
    const previous = buildProgressiveGraphUpdate([
      evidence({ id: "reviewed", stage: "reviewed", observedAt: "2026-04-01T00:00:00.000Z", relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.9 }] })
    ], { generatedAt: "2026-04-01T01:00:00.000Z" });
    const current = buildProgressiveGraphUpdate([
      evidence({ id: "contradiction", stage: "extracted", relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.4, contradicted: true }] }),
      evidence({ id: "old", stage: "captured", observedAt: "2025-01-01T00:00:00.000Z", relationships: [{ source: actor, target: tool, type: "uses", confidence: 0.7 }] })
    ], { previous: previous.graph, generatedAt: "2026-05-24T00:00:00.000Z", staleAfterDays: 30 });

    expect(current.deltas.some((delta) => delta.kind === "contradicted")).toBe(true);
    expect(current.deltas.some((delta) => delta.kind === "stale")).toBe(true);
    expect(current.relationshipDeltas[0]?.kind).toBe("contradicted");
    expect(current.relationshipDeltas[0]?.requiresAnalystReview).toBe(true);
    expect(current.relationshipDeltas[0]?.reviewReasons).toContain("contradicted evidence");
  });

  test("ranks APT29 contradictions before stale churn across polling stages", () => {
    const discovery = buildProgressiveGraphUpdate([
      evidence({ id: "apt29_live", sourceId: "live_search", observedAt: "2026-05-24T01:00:00.000Z", relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.72 }] })
    ], { generatedAt: "2026-05-24T01:00:30.000Z" });
    const captured = buildProgressiveGraphUpdate([
      evidence({ id: "apt29_live", sourceId: "live_search", observedAt: "2026-05-24T01:00:00.000Z", relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.72 }] }),
      evidence({ id: "apt29_capture", stage: "captured", sourceId: "capture_worker", captureId: "cap_apt29_delta", observedAt: "2026-05-24T01:05:00.000Z", contentHash: "apt29_capture_hash", relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.8 }, { source: apt29, target: embassy, type: "targets", confidence: 0.72 }] })
    ], { previous: discovery.graph, generatedAt: "2026-05-24T01:05:30.000Z" });
    const extracted = buildProgressiveGraphUpdate([
      evidence({ id: "apt29_capture", stage: "captured", sourceId: "capture_worker", captureId: "cap_apt29_delta", observedAt: "2026-05-24T01:05:00.000Z", contentHash: "apt29_capture_hash", relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.8 }, { source: apt29, target: embassy, type: "targets", confidence: 0.72 }] }),
      evidence({ id: "apt29_extracted_contradiction", stage: "extracted", sourceId: "extractor", captureId: "cap_apt29_delta", observedAt: "2026-05-24T01:08:00.000Z", contentHash: "apt29_extracted_hash", relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.35, contradicted: true }] }),
      evidence({ id: "apt29_old_context", stage: "captured", sourceId: "archive", observedAt: "2025-01-01T00:00:00.000Z", contentHash: "apt29_old_hash", relationships: [{ source: apt29, target: { type: "tool", value: "Legacy loader", confidence: 0.5 }, type: "uses", confidence: 0.5 }] })
    ], { previous: captured.graph, generatedAt: "2026-05-24T01:10:00.000Z", staleAfterDays: 30 });

    expect(captured.relationshipDeltas.some((delta) => delta.stage === "captured")).toBe(true);
    expect(extracted.relationshipDeltas[0]?.kind).toBe("contradicted");
    expect(extracted.relationshipDeltas[0]?.rank).toBe(1);
    expect(extracted.relationshipDeltas[0]?.confidenceBefore).toBeGreaterThan(extracted.relationshipDeltas[0]?.confidenceAfter ?? 0);
    expect(extracted.relationshipDeltas[0]?.reviewReasons).toContain("contradicted evidence");
    expect(extracted.relationshipDeltas[0]?.sourceIds).toEqual(["capture_worker", "extractor"]);
    expect(extracted.relationshipDeltas.at(-1)?.kind).toBe("stale");
  });
});
