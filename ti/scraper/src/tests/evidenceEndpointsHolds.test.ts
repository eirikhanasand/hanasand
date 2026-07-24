import { describe, expect, test } from "bun:test";
import { mountedCutoverReport } from "./helpers/evidenceEndpointFixtures.ts";

describe("mounted evidence endpoint hold paths", () => {
  test("serves stale missing object restricted redaction and graph blocker proofs", async () => {
    const stale = await mountedCutoverReport({ query: "Stale Actor", runId: "run_stale", staleSnapshot: true }, "2026-05-24T22:01:00.000Z");
    const missingObject = await mountedCutoverReport({ query: "Missing Object", runId: "run_missing_object", missingObject: true });
    const restricted = await mountedCutoverReport({ query: "Restricted Actor", runId: "run_restricted", restrictedRedaction: true });
    const graph = await mountedCutoverReport({ query: "Graph Blocker", runId: "run_graph_blocker", relationshipKind: "contradicted" });
    expect(stale.cutoverReport).toMatchObject({ readiness: { agent09: "hold", overall: "hold" }, counts: { staleSnapshots: 1 } });
    expect(missingObject.cutoverReport).toMatchObject({ readiness: { agent10: "blocked", overall: "blocked" }, counts: { missingObjects: 1 }, promotionGate: { agent10Fields: { missingObjectCount: 1 } }, trustLedger: { enforcement: { state: "hold", releaseAction: "hold", canPromote: false, holds: expect.arrayContaining(["missing_objects"]), publicApiImpact: "blocked" }, certification: { status: "hold", releaseAction: "hold", canCutover: false, objectStore: { missingObjectIds: expect.arrayContaining(["cap_run_missing_object"]) } } } });
    expect(restricted.cutoverReport).toMatchObject({ redaction: { sensitiveBodiesExposed: false, objectKeysExposed: false, metadataOnlyCaptureIds: expect.arrayContaining(["cap_run_restricted_restricted"]) } });
    expect(graph.cutoverReport).toMatchObject({ readiness: { overall: "hold" }, promotionGate: { blockers: expect.arrayContaining(["export_blockers"]) }, exportBlockers: [{ id: "delta_run_graph_blocker_relationship", reason: "delta_contradicted" }] });
    const serialized = JSON.stringify({ stale, missingObject, restricted, graph });
    expect(serialized).not.toContain("hidden restricted body");
    expect(serialized).not.toContain("object/key");
    expect(serialized).not.toContain("unsafe://restricted");
  });
});
