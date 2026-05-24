import { describe, expect, test } from "bun:test";
import {
  applyGraphReviewDecision,
  buildProgressiveGraphUpdate,
  exportProgressiveGraphToStixBundle,
  relationshipStixEligibility
} from "../export/progressiveGraph.ts";
import { validateStixBundle } from "../export/stixValidation.ts";
import type { ProgressiveGraphEvidence } from "../types.ts";

const actor = { type: "actor" as const, value: "Scattered Spider", confidence: 0.78, aliases: ["UNC3944", "Octo Tempest"] };
const alias = { type: "actor" as const, value: "UNC3944", confidence: 0.72, aliases: ["Scattered Spider"] };
const tool = { type: "tool" as const, value: "SIM swapping", confidence: 0.7 };
const victim = { type: "victim" as const, value: "Contoso Telecom", confidence: 0.66 };
const apt29 = { type: "actor" as const, value: "APT29", confidence: 0.86, aliases: ["Cozy Bear", "Nobelium"] };
const phishing = { type: "attack-pattern" as const, value: "T1566 Phishing", confidence: 0.74 };
const embassy = { type: "victim" as const, value: "Example Embassy", confidence: 0.7 };

function evidence(input: Partial<ProgressiveGraphEvidence>): ProgressiveGraphEvidence {
  return {
    id: input.id ?? "evidence",
    stage: input.stage ?? "discovery",
    observedAt: input.observedAt ?? "2026-05-24T00:00:00.000Z",
    sourceId: input.sourceId ?? "src_live",
    captureId: input.captureId,
    url: input.url ?? "https://example.test/live",
    contentHash: input.contentHash ?? input.id ?? "hash",
    extractorVersion: input.extractorVersion ?? "progressive-test",
    relationships: input.relationships ?? [{
      source: actor,
      target: victim,
      type: "targets",
      confidence: 0.7
    }]
  };
}

describe("progressive graph updates", () => {
  test("promotes Scattered Spider discovery snippets into backed actor alias tool and victim relationships", () => {
    const discovery = buildProgressiveGraphUpdate([
      evidence({
        id: "snippet_1",
        stage: "discovery",
        relationships: [
          { source: alias, target: actor, type: "alias-of", confidence: 0.7 },
          { source: actor, target: victim, type: "targets", confidence: 0.68 },
          { source: actor, target: tool, type: "uses", confidence: 0.64 }
        ]
      })
    ], { generatedAt: "2026-05-24T00:01:00.000Z" });

    const promoted = buildProgressiveGraphUpdate([
      evidence({
        id: "snippet_1",
        stage: "discovery",
        relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.68 }]
      }),
      evidence({
        id: "capture_1",
        stage: "promoted",
        captureId: "cap_scattered_spider_1",
        observedAt: "2026-05-24T00:05:00.000Z",
        contentHash: "capture_hash",
        relationships: [
          { source: alias, target: actor, type: "alias-of", confidence: 0.82 },
          { source: actor, target: victim, type: "targets", confidence: 0.86 },
          { source: actor, target: tool, type: "uses", confidence: 0.8 }
        ]
      })
    ], {
      previous: discovery.graph,
      generatedAt: "2026-05-24T00:06:00.000Z"
    });

    expect(discovery.deltas.every((delta) => delta.kind === "added")).toBe(true);
    expect(promoted.stage).toBe("promoted");
    expect(promoted.graph.relationships.some((relationship) => relationship.properties?.promoted === true)).toBe(true);
    expect(promoted.deltas.some((delta) => delta.kind === "promoted")).toBe(true);
    expect(promoted.relationshipDeltas[0]?.kind).toBe("promoted");
    expect(promoted.relationshipDeltas[0]?.stixEligibility.promoted).toBe(true);
    expect(promoted.graph.relationships.find((relationship) => relationship.type === "targets")?.confidence).toBeGreaterThan(
      discovery.graph.relationships.find((relationship) => relationship.type === "targets")?.confidence ?? 0
    );
  });

  test("emits downgraded contradicted and stale relationship deltas for polling clients", () => {
    const previous = buildProgressiveGraphUpdate([
      evidence({
        id: "reviewed",
        stage: "reviewed",
        observedAt: "2026-04-01T00:00:00.000Z",
        relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.9 }]
      })
    ], { generatedAt: "2026-04-01T01:00:00.000Z" });
    const current = buildProgressiveGraphUpdate([
      evidence({
        id: "contradiction",
        stage: "extracted",
        observedAt: "2026-04-01T00:00:00.000Z",
        relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.4, contradicted: true }]
      }),
      evidence({
        id: "old",
        stage: "captured",
        observedAt: "2025-01-01T00:00:00.000Z",
        relationships: [{ source: actor, target: tool, type: "uses", confidence: 0.7 }]
      })
    ], {
      previous: previous.graph,
      generatedAt: "2026-05-24T00:00:00.000Z",
      staleAfterDays: 30
    });

    expect(current.deltas.some((delta) => delta.kind === "contradicted")).toBe(true);
    expect(current.deltas.some((delta) => delta.kind === "stale")).toBe(true);
    expect(current.relationshipDeltas[0]?.kind).toBe("contradicted");
    expect(current.relationshipDeltas[0]?.requiresAnalystReview).toBe(true);
    expect(current.relationshipDeltas[0]?.reviewReasons).toContain("contradicted evidence");
  });

  test("excludes discovery-only evidence from STIX by default and includes it explicitly", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "snippet_only",
        stage: "discovery",
        relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.7 }]
      })
    ], { generatedAt: "2026-05-24T00:00:00.000Z" });
    const defaultBundle = exportProgressiveGraphToStixBundle(dto, {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T00:01:00.000Z"
    });
    const explicitBundle = exportProgressiveGraphToStixBundle(dto, {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T00:01:00.000Z",
      includeDiscoveryEvidence: true
    });

    expect(defaultBundle.objects.some((object) => object.type === "relationship")).toBe(false);
    expect(explicitBundle.objects.some((object) => object.type === "relationship")).toBe(true);
    expect(relationshipStixEligibility(dto.graph.relationships[0]!).discoveryOnly).toBe(true);
    expect(validateStixBundle(defaultBundle).valid).toBe(true);
    expect(validateStixBundle(explicitBundle).valid).toBe(true);
  });

  test("returns compact ranked relationship delta DTOs across Scattered Spider polling stages", () => {
    const discovery = buildProgressiveGraphUpdate([
      evidence({
        id: "scattered_live",
        stage: "discovery",
        sourceId: "live_search",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.68 }]
      })
    ], { generatedAt: "2026-05-24T00:00:30.000Z" });

    const captured = buildProgressiveGraphUpdate([
      evidence({
        id: "scattered_live",
        stage: "discovery",
        sourceId: "live_search",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.68 }]
      }),
      evidence({
        id: "scattered_capture",
        stage: "captured",
        sourceId: "capture_worker",
        captureId: "cap_scattered_spider_delta",
        observedAt: "2026-05-24T00:03:00.000Z",
        contentHash: "captured_hash",
        relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.74 }]
      })
    ], {
      previous: discovery.graph,
      generatedAt: "2026-05-24T00:03:30.000Z"
    });

    const promoted = buildProgressiveGraphUpdate([
      evidence({
        id: "scattered_capture",
        stage: "captured",
        sourceId: "capture_worker",
        captureId: "cap_scattered_spider_delta",
        observedAt: "2026-05-24T00:03:00.000Z",
        contentHash: "captured_hash",
        relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.74 }]
      }),
      evidence({
        id: "scattered_reviewed",
        stage: "promoted",
        sourceId: "analyst_review",
        captureId: "cap_scattered_spider_delta",
        observedAt: "2026-05-24T00:07:00.000Z",
        contentHash: "reviewed_hash",
        relationships: [
          { source: actor, target: victim, type: "targets", confidence: 0.9 },
          { source: actor, target: tool, type: "uses", confidence: 0.82 }
        ]
      })
    ], {
      previous: captured.graph,
      generatedAt: "2026-05-24T00:07:30.000Z"
    });

    const capturedDelta = captured.relationshipDeltas[0]!;
    expect(discovery.relationshipDeltas[0]?.kind).toBe("added");
    expect(discovery.relationshipDeltas[0]?.stage).toBe("discovery");
    expect(discovery.relationshipDeltas[0]?.requiresAnalystReview).toBe(true);
    expect(capturedDelta.relationshipId).toBe(discovery.relationshipDeltas[0]?.relationshipId);
    expect(capturedDelta.kind).toBe("updated");
    expect(capturedDelta.stage).toBe("captured");
    expect(capturedDelta.confidenceBefore).toBe(discovery.relationshipDeltas[0]?.confidenceAfter);
    expect(capturedDelta.confidenceAfter).toBeGreaterThan(capturedDelta.confidenceBefore ?? 0);
    expect(capturedDelta.sourceIds).toEqual(["capture_worker", "live_search"]);
    expect(capturedDelta.stixEligibility.captureBacked).toBe(true);
    expect(capturedDelta.stixEligibility.includedByDefault).toBe(false);

    expect(promoted.relationshipDeltas[0]?.kind).toBe("promoted");
    expect(promoted.relationshipDeltas[0]?.rank).toBe(1);
    expect(promoted.relationshipDeltas[0]?.stixEligibility.promoted).toBe(true);

    const bundle = exportProgressiveGraphToStixBundle(promoted, {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T00:08:00.000Z"
    });
    const stixRelationship = bundle.objects.find((object) => object.type === "relationship");
    expect(stixRelationship?.x_ti_stix_eligibility).toMatchObject({ promoted: true, includedByDefault: true });
  });

  test("ranks APT29 contradictions before stale churn across discovery captured and extracted polling stages", () => {
    const discovery = buildProgressiveGraphUpdate([
      evidence({
        id: "apt29_live",
        stage: "discovery",
        sourceId: "live_search",
        observedAt: "2026-05-24T01:00:00.000Z",
        relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.72 }]
      })
    ], { generatedAt: "2026-05-24T01:00:30.000Z" });

    const captured = buildProgressiveGraphUpdate([
      evidence({
        id: "apt29_live",
        stage: "discovery",
        sourceId: "live_search",
        observedAt: "2026-05-24T01:00:00.000Z",
        relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.72 }]
      }),
      evidence({
        id: "apt29_capture",
        stage: "captured",
        sourceId: "capture_worker",
        captureId: "cap_apt29_delta",
        observedAt: "2026-05-24T01:05:00.000Z",
        contentHash: "apt29_capture_hash",
        relationships: [
          { source: apt29, target: phishing, type: "uses", confidence: 0.8 },
          { source: apt29, target: embassy, type: "targets", confidence: 0.72 }
        ]
      })
    ], {
      previous: discovery.graph,
      generatedAt: "2026-05-24T01:05:30.000Z"
    });

    const extracted = buildProgressiveGraphUpdate([
      evidence({
        id: "apt29_capture",
        stage: "captured",
        sourceId: "capture_worker",
        captureId: "cap_apt29_delta",
        observedAt: "2026-05-24T01:05:00.000Z",
        contentHash: "apt29_capture_hash",
        relationships: [
          { source: apt29, target: phishing, type: "uses", confidence: 0.8 },
          { source: apt29, target: embassy, type: "targets", confidence: 0.72 }
        ]
      }),
      evidence({
        id: "apt29_extracted_contradiction",
        stage: "extracted",
        sourceId: "extractor",
        captureId: "cap_apt29_delta",
        observedAt: "2026-05-24T01:08:00.000Z",
        contentHash: "apt29_extracted_hash",
        relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.35, contradicted: true }]
      }),
      evidence({
        id: "apt29_old_context",
        stage: "captured",
        sourceId: "archive",
        observedAt: "2025-01-01T00:00:00.000Z",
        contentHash: "apt29_old_hash",
        relationships: [{ source: apt29, target: { type: "tool", value: "Legacy loader", confidence: 0.5 }, type: "uses", confidence: 0.5 }]
      })
    ], {
      previous: captured.graph,
      generatedAt: "2026-05-24T01:10:00.000Z",
      staleAfterDays: 30
    });

    expect(captured.relationshipDeltas.some((delta) => delta.stage === "captured")).toBe(true);
    expect(extracted.relationshipDeltas[0]?.kind).toBe("contradicted");
    expect(extracted.relationshipDeltas[0]?.stage).toBe("extracted");
    expect(extracted.relationshipDeltas[0]?.rank).toBe(1);
    expect(extracted.relationshipDeltas[0]?.confidenceBefore).toBeGreaterThan(extracted.relationshipDeltas[0]?.confidenceAfter ?? 0);
    expect(extracted.relationshipDeltas[0]?.requiresAnalystReview).toBe(true);
    expect(extracted.relationshipDeltas[0]?.reviewReasons).toContain("contradicted evidence");
    expect(extracted.relationshipDeltas[0]?.sourceIds).toEqual(["capture_worker", "extractor"]);
    expect(extracted.relationshipDeltas.at(-1)?.kind).toBe("stale");
  });

  test("records analyst acceptance and exports only accepted or promoted relationships by default", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "apt29_extract",
        stage: "extracted",
        sourceId: "extractor",
        observedAt: "2026-05-24T02:00:00.000Z",
        relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.82 }]
      })
    ], { generatedAt: "2026-05-24T02:01:00.000Z" });
    const relationship = dto.graph.relationships[0]!;

    const beforeReview = exportProgressiveGraphToStixBundle(dto, {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T02:01:30.000Z"
    });
    expect(beforeReview.objects.some((object) => object.type === "relationship")).toBe(false);

    const reviewedGraph = applyGraphReviewDecision(dto.graph, {
      id: "review_accept_apt29_ttp",
      relationshipId: relationship.id,
      action: "accept",
      reviewerId: "analyst_1",
      reason: "Vendor report and extractor evidence agree.",
      decidedAt: "2026-05-24T02:02:00.000Z",
      sourceIds: ["extractor"],
      evidenceIds: ["apt29_extract"]
    });
    const reviewedRelationship = reviewedGraph.relationships[0]!;
    const reviewedDto = { ...dto, graph: reviewedGraph };
    const afterReview = exportProgressiveGraphToStixBundle(reviewedDto, {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T02:02:30.000Z"
    });
    const stixRelationship = afterReview.objects.find((object) => object.type === "relationship");

    expect(relationshipStixEligibility(reviewedRelationship).accepted).toBe(true);
    expect(relationshipStixEligibility(reviewedRelationship).includedByDefault).toBe(true);
    expect(reviewedRelationship.properties?.reviewState).toBe("accepted");
    expect(reviewedRelationship.properties?.reviewAudit).toHaveLength(1);
    expect(stixRelationship?.x_ti_review_state).toBe("accepted");
    expect(stixRelationship?.x_ti_review_audit).toBeArray();
  });

  test("rejects weak discovery-only relationships and requires explicit context export", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "weak_discovery",
        stage: "discovery",
        sourceId: "live_search",
        relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.38 }]
      })
    ], { generatedAt: "2026-05-24T02:10:00.000Z" });
    const relationship = dto.graph.relationships[0]!;
    const rejectedGraph = applyGraphReviewDecision(dto.graph, {
      id: "review_reject_weak_discovery",
      relationshipId: relationship.id,
      action: "reject",
      reviewerId: "analyst_2",
      reason: "Discovery-only snippet is too weak for enterprise CTI.",
      decidedAt: "2026-05-24T02:11:00.000Z",
      sourceIds: ["live_search"],
      evidenceIds: ["weak_discovery"]
    });
    const rejectedDto = { ...dto, graph: rejectedGraph };

    const defaultBundle = exportProgressiveGraphToStixBundle(rejectedDto, {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T02:12:00.000Z"
    });
    const contextBundle = exportProgressiveGraphToStixBundle(rejectedDto, {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T02:12:00.000Z",
      includeUnreviewedDiscoveryContext: true
    });

    expect(rejectedGraph.relationships[0]?.properties?.reviewState).toBe("rejected");
    expect(defaultBundle.objects.some((object) => object.type === "relationship")).toBe(false);
    expect(contextBundle.objects.find((object) => object.type === "relationship")?.x_ti_review_state).toBe("rejected");
  });

  test("supersedes stale attribution and resolves contradicted relationships with audit provenance", () => {
    const staleDto = buildProgressiveGraphUpdate([
      evidence({
        id: "old_attribution",
        stage: "reviewed",
        observedAt: "2025-01-01T00:00:00.000Z",
        sourceId: "archive",
        relationships: [{ source: apt29, target: embassy, type: "targets", confidence: 0.86 }]
      })
    ], {
      generatedAt: "2026-05-24T02:20:00.000Z",
      staleAfterDays: 30
    });
    const staleRelationship = staleDto.graph.relationships[0]!;
    const supersededGraph = applyGraphReviewDecision(staleDto.graph, {
      id: "review_supersede_stale_attr",
      relationshipId: staleRelationship.id,
      action: "supersede",
      reviewerId: "analyst_3",
      reason: "Attribution is stale and replaced by newer reporting.",
      decidedAt: "2026-05-24T02:21:00.000Z",
      sourceIds: ["archive"],
      evidenceIds: ["old_attribution"],
      supersedesRelationshipId: "rel_newer_attribution"
    });

    const contradictionDto = buildProgressiveGraphUpdate([
      evidence({
        id: "contradicted_attr",
        stage: "extracted",
        sourceId: "extractor",
        observedAt: "2026-05-24T02:25:00.000Z",
        relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.35, contradicted: true }]
      })
    ], { generatedAt: "2026-05-24T02:26:00.000Z" });
    const contradictionRelationship = contradictionDto.graph.relationships[0]!;
    const resolvedGraph = applyGraphReviewDecision(contradictionDto.graph, {
      id: "review_resolve_contradiction",
      relationshipId: contradictionRelationship.id,
      action: "resolve_contradiction",
      reviewerId: "analyst_4",
      reason: "Analyst reviewed capture and accepted the corrected relationship.",
      decidedAt: "2026-05-24T02:27:00.000Z",
      sourceIds: ["extractor"],
      evidenceIds: ["contradicted_attr"]
    });
    const resolvedDto = { ...contradictionDto, graph: resolvedGraph };
    const resolvedBundle = exportProgressiveGraphToStixBundle(resolvedDto, {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T02:28:00.000Z"
    });

    expect(supersededGraph.relationships[0]?.properties?.reviewState).toBe("superseded");
    expect(supersededGraph.relationships[0]?.properties?.supersedesRelationshipId).toBe("rel_newer_attribution");
    expect(supersededGraph.relationships[0]?.properties?.reviewAudit).toHaveLength(1);
    expect(resolvedGraph.relationships[0]?.properties?.reviewState).toBe("accepted");
    expect(resolvedGraph.relationships[0]?.properties?.contradicted).toBe(false);
    expect(resolvedBundle.objects.find((object) => object.type === "relationship")?.x_ti_review_state).toBe("accepted");
  });
});
