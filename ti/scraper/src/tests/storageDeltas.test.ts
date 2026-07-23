import { describe, expect, test } from "bun:test";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { EvidenceDelta } from "../types.ts";
import { hashContent } from "../utils.ts";
import { fixtureDiscovery, fixtureEvidenceDelta } from "./helpers/storageFixtures.ts";

describe("storage evidence deltas", () => {
  test("keeps unresolved actor mentions as entity evidence without profile deltas", () => {
    const store = new InMemoryScraperStore();
    const observation = (sourceId: string, collectedAt: string, victim: string, ttp: string) => {
      const rawText = `APT29 used ${ttp} against ${victim}.`;
      return processCollectedItem({ sourceId, url: `https://example.test/${sourceId}`, collectedAt, rawText, contentHash: hashContent(rawText), links: [], metadata: { query: "APT29", normalizedQuery: "apt29" }, sensitive: false });
    };
    const first = observation("src_history_a", "2026-05-24T10:00:00.000Z", "Northwind Health", "phishing");
    const second = observation("src_history_b", "2026-05-25T10:00:00.000Z", "Contoso Energy", "credential dumping");
    store.savePipelineResult(first);
    store.savePipelineResult(second);
    store.savePipelineResult(second);

    expect(store.listActorProfiles()).toEqual([]);
    expect(store.listExtractedEntities().filter((entity: any) => entity.type === "actor").map((entity: any) => entity.value)).toEqual(["APT29", "APT29"]);
    expect(store.listEvidenceLinks().filter((link: any) => link.subjectType === "entity" && link.relationship === "mentions")).not.toHaveLength(0);
    expect(store.listEvidenceDeltas().filter((row: any) => row.subjectType === "actor_profile")).toEqual([]);
  });

  test("reuses a duplicate capture's canonical incident after identity migration", () => {
    const store = new InMemoryScraperStore();
    const rawText = "APT29 used phishing against Example Energy.";
    const legacy = processCollectedItem({ sourceId: "src_live", url: "https://example.test/report", collectedAt: "2026-05-24T10:00:00.000Z", rawText, contentHash: hashContent(rawText), links: [], metadata: {}, sensitive: false });
    expect(legacy.incident).toBeDefined();
    store.savePipelineResult({ ...legacy, incident: { ...legacy.incident!, id: "inc_canonical" } });
    const extractionCount = store.listEvidenceDeltas().filter((row: any) => row.subjectType === "extraction").length;

    const duplicate = store.savePipelineResult(legacy);

    expect(duplicate.incident?.id).toBe("inc_canonical");
    expect(store.getIncident(legacy.incident!.id)).toBeUndefined();
    expect(store.listEvidenceDeltas().filter((row: any) => row.subjectType === "extraction")).toHaveLength(extractionCount);
  });

  test("stores cursor deltas across discovery capture extraction relationship and policy stages", () => {
    const store = new InMemoryScraperStore();
    const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({ id: "disc_cursor", query: "APT29", normalizedQuery: "apt29", resultId: "result_cursor", observedAt: "2026-05-24T16:00:00.000Z", snippet: "Search provider observed APT29 targeting Example Energy." }));
    const firstCursor = store.queries().getSearchDeltas("APT29", undefined, { tenantId: "tenant_live" })[0]?.cursor;
    const rawText = "APT29 used phishing against Example Energy with CVE-2026-1234.";
    const result = processCollectedItem({ sourceId: "src_live", taskId: "task_cursor", url: discovery.url ?? "", collectedAt: "2026-05-24T16:01:00.000Z", title: "APT29 promoted report", rawText, contentHash: hashContent(rawText), links: [], metadata: { query: "APT29", normalizedQuery: "apt29", runId: "run_cursor", promotedFromDiscoveryId: discovery.id }, sensitive: false });
    store.savePipelineResult({ ...result, capture: { ...result.capture, tenantId: "tenant_live" } });
    store.promoteDiscoveryEvidence({ discoveryEvidenceId: discovery.id, taskId: "task_cursor", captureId: result.capture.id, incidentId: result.incident?.id, promotedAt: "2026-05-24T16:01:30.000Z", promotedBy: "pipeline" });

    const relationshipId = "rel_cursor";
    store.saveEvidenceDelta(fixtureEvidenceDelta({ id: "delta_relationship", query: "APT29", normalizedQuery: "apt29", runId: "run_cursor", kind: "added", subjectType: "relationship", subjectId: relationshipId, observedAt: "2026-05-24T16:02:10.000Z", discoveryEvidenceIds: [discovery.id], captureIds: [result.capture.id], incidentIds: result.incident ? [result.incident.id] : [], relationshipIds: [relationshipId] }));
    store.saveEvidenceDelta(fixtureEvidenceDelta({ id: "delta_stix", query: "APT29", normalizedQuery: "apt29", runId: "run_cursor", kind: "promoted", subjectType: "policy_event", subjectId: "stix_eligible", observedAt: "2026-05-24T16:02:20.000Z", captureIds: [result.capture.id], incidentIds: result.incident ? [result.incident.id] : [], relationshipIds: [relationshipId], policyEventIds: ["stix_eligible"] }));

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
