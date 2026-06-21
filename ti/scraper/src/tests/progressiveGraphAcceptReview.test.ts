import { describe, expect, test } from "bun:test";
import { applyGraphReviewDecision, buildProgressiveGraphUpdate, exportProgressiveGraphToStixBundle, relationshipStixEligibility } from "../export/progressiveGraph.ts";
import { apt29, evidence, phishing } from "./helpers/progressiveGraphFixtures.ts";

describe("progressive graph accepted reviews", () => {
  test("records analyst acceptance and exports accepted relationships by default", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({ id: "apt29_extract", stage: "extracted", sourceId: "extractor", observedAt: "2026-05-24T02:00:00.000Z", relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.82 }] })
    ], { generatedAt: "2026-05-24T02:01:00.000Z" });
    expect(exportProgressiveGraphToStixBundle(dto, { producerName: "ti-scraper", generatedAt: "2026-05-24T02:01:30.000Z" }).objects.some((object) => object.type === "relationship")).toBe(false);
    const reviewedGraph = applyGraphReviewDecision(dto.graph, {
      id: "review_accept_apt29_ttp",
      relationshipId: dto.graph.relationships[0]!.id,
      action: "accept",
      reviewerId: "analyst_1",
      reason: "Vendor report and extractor evidence agree.",
      decidedAt: "2026-05-24T02:02:00.000Z",
      sourceIds: ["extractor"],
      evidenceIds: ["apt29_extract"]
    });
    const stixRelationship = exportProgressiveGraphToStixBundle({ ...dto, graph: reviewedGraph }, {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T02:02:30.000Z"
    }).objects.find((object) => object.type === "relationship");

    expect(relationshipStixEligibility(reviewedGraph.relationships[0]!).includedByDefault).toBe(true);
    expect(reviewedGraph.relationships[0]?.properties?.reviewState).toBe("accepted");
    expect(reviewedGraph.relationships[0]?.properties?.reviewAudit).toHaveLength(1);
    expect(stixRelationship?.x_ti_review_state).toBe("accepted");
    expect(stixRelationship?.x_ti_review_audit).toBeArray();
  });
});
