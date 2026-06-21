import { describe, expect, test } from "bun:test";
import { applyGraphReviewDecision, buildProgressiveGraphUpdate, exportProgressiveGraphToStixBundle } from "../export/progressiveGraph.ts";
import { actor, evidence, victim } from "./helpers/progressiveGraphFixtures.ts";

describe("progressive graph rejected reviews", () => {
  test("rejects weak discovery-only relationships and requires explicit context export", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({ id: "weak_discovery", sourceId: "live_search", relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.38 }] })
    ], { generatedAt: "2026-05-24T02:10:00.000Z" });
    const rejectedGraph = applyGraphReviewDecision(dto.graph, {
      id: "review_reject_weak_discovery",
      relationshipId: dto.graph.relationships[0]!.id,
      action: "reject",
      reviewerId: "analyst_2",
      reason: "Discovery-only snippet is too weak for enterprise CTI.",
      decidedAt: "2026-05-24T02:11:00.000Z",
      sourceIds: ["live_search"],
      evidenceIds: ["weak_discovery"]
    });
    const base = { producerName: "ti-scraper", generatedAt: "2026-05-24T02:12:00.000Z" };

    expect(rejectedGraph.relationships[0]?.properties?.reviewState).toBe("rejected");
    expect(exportProgressiveGraphToStixBundle({ ...dto, graph: rejectedGraph }, base).objects.some((object) => object.type === "relationship")).toBe(false);
    expect(exportProgressiveGraphToStixBundle({ ...dto, graph: rejectedGraph }, { ...base, includeUnreviewedDiscoveryContext: true }).objects.find((object) => object.type === "relationship")?.x_ti_review_state).toBe("rejected");
  });
});
