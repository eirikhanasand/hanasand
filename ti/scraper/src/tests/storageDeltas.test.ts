import { describe, expect, test } from "bun:test";
import { buildProgressiveGraphUpdate, exportProgressiveGraphToStixBundle } from "../export/progressiveGraph.ts";
import { validateStixBundle } from "../export/stixValidation.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { EvidenceDelta } from "../types.ts";
import { hashContent } from "../utils.ts";
import { fixtureDiscovery, fixtureEvidenceDelta, fixtureProgressiveEvidence } from "./helpers/storageFixtures.ts";

describe("storage evidence deltas", () => {
  test("stores cursor deltas across discovery capture extraction relationship and export stages", () => {
    const store = new InMemoryScraperStore();
    const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({ id: "disc_cursor", query: "APT29", normalizedQuery: "apt29", resultId: "result_cursor", observedAt: "2026-05-24T16:00:00.000Z", snippet: "Search provider observed APT29 targeting Example Energy." }));
    const firstCursor = store.queries().getSearchDeltas("APT29", undefined, { tenantId: "tenant_live" })[0]?.cursor;
    const rawText = "APT29 used phishing against Example Energy with CVE-2026-1234.";
    const result = processCollectedItem({ sourceId: "src_live", taskId: "task_cursor", url: discovery.url ?? "", collectedAt: "2026-05-24T16:01:00.000Z", title: "APT29 promoted report", rawText, contentHash: hashContent(rawText), links: [], metadata: { query: "APT29", normalizedQuery: "apt29", runId: "run_cursor", promotedFromDiscoveryId: discovery.id }, sensitive: false });
    store.savePipelineResult({ ...result, capture: { ...result.capture, tenantId: "tenant_live" } });
    store.promoteDiscoveryEvidence({ discoveryEvidenceId: discovery.id, taskId: "task_cursor", captureId: result.capture.id, incidentId: result.incident?.id, promotedAt: "2026-05-24T16:01:30.000Z", promotedBy: "pipeline" });

    const graphEvidence = fixtureProgressiveEvidence({ id: "graph_cursor", stage: "promoted", captureId: result.capture.id, observedAt: "2026-05-24T16:02:00.000Z", contentHash: result.capture.contentHash });
    const graph = buildProgressiveGraphUpdate([graphEvidence], { generatedAt: "2026-05-24T16:02:10.000Z" });
    const relationshipId = graph.graph.relationships[0]?.id ?? "rel_missing";
    store.saveEvidenceDelta(fixtureEvidenceDelta({ id: "delta_relationship", query: "APT29", normalizedQuery: "apt29", runId: "run_cursor", kind: "added", subjectType: "relationship", subjectId: relationshipId, observedAt: "2026-05-24T16:02:10.000Z", discoveryEvidenceIds: [discovery.id], captureIds: [result.capture.id], incidentIds: result.incident ? [result.incident.id] : [], relationshipIds: [relationshipId] }));
    const bundle = exportProgressiveGraphToStixBundle(graph, { producerName: "ti-scraper", generatedAt: "2026-05-24T16:02:20.000Z" });
    store.saveEvidenceDelta(fixtureEvidenceDelta({ id: "delta_stix", query: "APT29", normalizedQuery: "apt29", runId: "run_cursor", kind: "promoted", subjectType: "policy_event", subjectId: "stix_eligible", observedAt: "2026-05-24T16:02:20.000Z", captureIds: [result.capture.id], incidentIds: result.incident ? [result.incident.id] : [], relationshipIds: [relationshipId], policyEventIds: ["stix_eligible"], metadata: { stixObjectCount: bundle.objects.length } }));

    expect(validateStixBundle(bundle).valid).toBe(true);
    expect(store.queries().getSearchDeltas("APT29", firstCursor, { tenantId: "tenant_live" }).map((delta) => delta.subjectType)).toEqual(["capture", "extraction", "discovery_evidence", "relationship", "policy_event"]);
    const active = store.queries().getActiveRunEvidence("run_cursor", firstCursor, { tenantId: "tenant_live" });
    expect(active.captures.map((capture) => capture.id)).toEqual([result.capture.id]);
    expect(active.incidents.map((incident) => incident.id)).toEqual(result.incident ? [result.incident.id] : []);
    expect(active.deltas?.at(-1)?.policyEventIds).toEqual(["stix_eligible"]);
    expect(active.nextCursor).toBe(active.deltas?.at(-1)?.cursor);
  });

  test("records immutable redacted blocked expired downgraded and contradicted deltas", () => {
    const store = new InMemoryScraperStore();
    const deltaKinds: EvidenceDelta["kind"][] = ["redacted", "blocked", "expired", "downgraded", "contradicted"];
    for (const [index, kind] of deltaKinds.entries()) {
      store.saveEvidenceDelta(fixtureEvidenceDelta({ id: `delta_${kind}`, kind, subjectType: kind === "blocked" || kind === "expired" ? "policy_event" : "relationship", subjectId: `${kind}_subject`, observedAt: `2026-05-24T17:0${index}:00.000Z`, policyEventIds: kind === "blocked" || kind === "expired" ? [`policy_${kind}`] : [] }));
    }
    const blocked = fixtureEvidenceDelta({ id: "delta_blocked", kind: "blocked", subjectType: "policy_event", subjectId: "blocked_subject", observedAt: "2026-05-24T17:01:00.000Z", policyEventIds: ["policy_blocked"] });
    expect(store.saveEvidenceDelta({ ...blocked, metadata: { changed: true } })).toMatchObject({ id: "delta_blocked", kind: "blocked" });
    expect(() => store.saveEvidenceDelta({ ...blocked, subjectId: "changed_subject" })).toThrow("Evidence delta is immutable");
    expect(store.queries().getEvidenceTimeline("APT29", { tenantId: "tenant_live" }).map((delta) => delta.kind)).toEqual(deltaKinds);
  });
});
