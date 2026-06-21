import { describe, expect, test } from "bun:test";
import { applyGraphReviewDecision, buildProgressiveGraphUpdate, exportProgressiveGraphToStixBundle } from "../export/progressiveGraph.ts";
import { apt29, embassy, evidence, phishing } from "./helpers/progressiveGraphFixtures.ts";

describe("progressive graph supersede reviews", () => {
  test("supersedes stale attribution and resolves contradictions with audit provenance", () => {
    const staleDto = buildProgressiveGraphUpdate([
      evidence({ id: "old_attribution", stage: "reviewed", observedAt: "2025-01-01T00:00:00.000Z", sourceId: "archive", relationships: [{ source: apt29, target: embassy, type: "targets", confidence: 0.86 }] })
    ], { generatedAt: "2026-05-24T02:20:00.000Z", staleAfterDays: 30 });
    const supersededGraph = applyGraphReviewDecision(staleDto.graph, {
      id: "review_supersede_stale_attr",
      relationshipId: staleDto.graph.relationships[0]!.id,
      action: "supersede",
      reviewerId: "analyst_3",
      reason: "Attribution is stale and replaced by newer reporting.",
      decidedAt: "2026-05-24T02:21:00.000Z",
      sourceIds: ["archive"],
      evidenceIds: ["old_attribution"],
      supersedesRelationshipId: "rel_newer_attribution"
    });
    const contradictionDto = buildProgressiveGraphUpdate([
      evidence({ id: "contradicted_attr", stage: "extracted", sourceId: "extractor", observedAt: "2026-05-24T02:25:00.000Z", relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.35, contradicted: true }] })
    ], { generatedAt: "2026-05-24T02:26:00.000Z" });
    const resolvedGraph = applyGraphReviewDecision(contradictionDto.graph, {
      id: "review_resolve_contradiction",
      relationshipId: contradictionDto.graph.relationships[0]!.id,
      action: "resolve_contradiction",
      reviewerId: "analyst_4",
      reason: "Analyst reviewed capture and accepted the corrected relationship.",
      decidedAt: "2026-05-24T02:27:00.000Z",
      sourceIds: ["extractor"],
      evidenceIds: ["contradicted_attr"]
    });

    expect(supersededGraph.relationships[0]?.properties?.reviewState).toBe("superseded");
    expect(supersededGraph.relationships[0]?.properties?.supersedesRelationshipId).toBe("rel_newer_attribution");
    expect(resolvedGraph.relationships[0]?.properties?.reviewState).toBe("accepted");
    expect(resolvedGraph.relationships[0]?.properties?.contradicted).toBe(false);
    expect(exportProgressiveGraphToStixBundle({ ...contradictionDto, graph: resolvedGraph }, { producerName: "ti-scraper", generatedAt: "2026-05-24T02:28:00.000Z" }).objects.find((object) => object.type === "relationship")?.x_ti_review_state).toBe("accepted");
  });
});
