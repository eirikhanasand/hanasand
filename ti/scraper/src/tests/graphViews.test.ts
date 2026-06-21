import { describe, expect, test } from "bun:test";
import {
  buildCorrelationGraphQuery,
  buildGraphReviewPlanApiDto,
  buildPersistedGraphSnapshot,
  checkStixExportReadiness
} from "../export/graphViews.ts";
import type { RelationshipGraph } from "../types.ts";

const graph: RelationshipGraph = {
  nodes: [
    { id: "actor:apt29", type: "actor", value: "APT29", confidence: 0.9 },
    { id: "victim:example", type: "victim", value: "Example Corp", confidence: 0.8 }
  ],
  relationships: [
    {
      id: "rel:apt29-targets-example",
      source: "actor:apt29",
      target: "victim:example",
      sourceId: "actor:apt29",
      targetId: "victim:example",
      type: "targets",
      confidence: 0.82,
      reviewState: "accepted"
    }
  ]
} as unknown as RelationshipGraph;

describe("compact graph views", () => {
  test("keeps actor graph queryable and export-safe", () => {
    const snapshot = buildPersistedGraphSnapshot(graph, { generatedAt: "2026-06-21T00:00:00.000Z" });
    const query = buildCorrelationGraphQuery(snapshot, { query: "APT29" });
    const readiness = checkStixExportReadiness(snapshot);
    const reviewPlan = buildGraphReviewPlanApiDto(snapshot);

    expect(snapshot.nodes).toHaveLength(2);
    expect(query.nodes.map((node) => node.value)).toContain("APT29");
    expect(readiness.ready).toBe(true);
    expect(reviewPlan.plan.actions).toHaveLength(0);
  });
});
