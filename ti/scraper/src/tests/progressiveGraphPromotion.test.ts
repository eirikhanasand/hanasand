import { describe, expect, test } from "bun:test";
import { buildProgressiveGraphUpdate, exportProgressiveGraphToStixBundle, relationshipStixEligibility } from "../export/progressiveGraph.ts";
import { validateStixBundle } from "../export/stixValidation.ts";
import { actor, alias, evidence, tool, victim } from "./helpers/progressiveGraphFixtures.ts";

describe("progressive graph promotion contracts", () => {
  test("promotes Scattered Spider snippets into backed alias tool and victim relationships", () => {
    const discovery = buildProgressiveGraphUpdate([evidence({
      id: "snippet_1",
      relationships: [
        { source: alias, target: actor, type: "alias-of", confidence: 0.7 },
        { source: actor, target: victim, type: "targets", confidence: 0.68 },
        { source: actor, target: tool, type: "uses", confidence: 0.64 }
      ]
    })], { generatedAt: "2026-05-24T00:01:00.000Z" });
    const promoted = buildProgressiveGraphUpdate([
      evidence({ id: "snippet_1", relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.68 }] }),
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
    ], { previous: discovery.graph, generatedAt: "2026-05-24T00:06:00.000Z" });

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

  test("excludes discovery-only evidence from STIX by default and includes it explicitly", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({ id: "snippet_only", relationships: [{ source: actor, target: victim, type: "targets", confidence: 0.7 }] })
    ], { generatedAt: "2026-05-24T00:00:00.000Z" });
    const base = { producerName: "ti-scraper", generatedAt: "2026-05-24T00:01:00.000Z" };
    const defaultBundle = exportProgressiveGraphToStixBundle(dto, base);
    const explicitBundle = exportProgressiveGraphToStixBundle(dto, { ...base, includeDiscoveryEvidence: true });

    expect(defaultBundle.objects.some((object) => object.type === "relationship")).toBe(false);
    expect(explicitBundle.objects.some((object) => object.type === "relationship")).toBe(true);
    expect(relationshipStixEligibility(dto.graph.relationships[0]!).discoveryOnly).toBe(true);
    expect(validateStixBundle(defaultBundle).valid).toBe(true);
    expect(validateStixBundle(explicitBundle).valid).toBe(true);
  });
});
