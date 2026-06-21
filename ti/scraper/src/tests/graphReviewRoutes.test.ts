import { describe, expect, test } from "bun:test";
import {
  handleGraphCutoverReportRoute,
  handleGraphReviewPlanRoute,
  handleStixExportReadinessRoute
} from "../api/graphReviewRoutes.ts";
import { buildPersistedGraphSnapshot } from "../export/graphViews.ts";
import type { RelationshipGraph } from "../types.ts";

const snapshot = buildPersistedGraphSnapshot({
  nodes: [
    { id: "actor:apt29", type: "actor", value: "APT29", confidence: 0.9 },
    { id: "ttp:phishing", type: "attack-pattern", value: "T1566 Phishing", confidence: 0.8 }
  ],
  relationships: [
    { id: "rel:uses", source: "actor:apt29", target: "ttp:phishing", sourceId: "actor:apt29", targetId: "ttp:phishing", type: "uses", confidence: 0.82, reviewState: "accepted" }
  ]
} as unknown as RelationshipGraph, { generatedAt: "2026-06-21T00:00:00.000Z" });

describe("compact graph review routes", () => {
  test("return compact graph review, cutover, and STIX readiness payloads", () => {
    const plan = handleGraphReviewPlanRoute({ snapshot, request: { includeExamples: true } });
    const cutover = handleGraphCutoverReportRoute({ snapshot });
    const readiness = handleStixExportReadinessRoute({ snapshot });

    expect(plan.status).toBe(200);
    expect(cutover.status).toBe(200);
    expect(readiness.status).toBe(200);
    expect((plan.body as any).reviewPlan.status).toBe("ready");
    expect((readiness.body as any).readiness.ready).toBe(true);
  });

  test("rejects missing relationship filters", () => {
    const result = handleGraphReviewPlanRoute({ snapshot, request: { relationshipId: "missing" } });

    expect(result.status).toBe(404);
    expect((result.body as any).error.code).toBe("relationship_not_found");
  });
});
