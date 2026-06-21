import { describe, expect, test } from "bun:test";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { DEFAULT_RETENTION_POLICIES } from "../storage/retention.ts";
import { hashContent } from "../utils.ts";
import { fixtureDiscovery, fixtureSnapshot } from "./helpers/storageFixtures.ts";

describe("live search storage", () => {
  test("stores discovery snippets and promotes them through capture polling", () => {
    const store = new InMemoryScraperStore();
    const discovery = fixtureDiscovery({ id: "disc_apt29_1", query: "APT29", normalizedQuery: "apt29", resultId: "result_apt29_1", title: "APT29 live snippet", snippet: "Search provider observed APT29 phishing against Example Research.", url: "https://example.test/apt29-live", observedAt: "2026-05-24T13:00:00.000Z" });
    store.saveDiscoveryEvidence(discovery);
    store.saveLiveSearchSnapshot(fixtureSnapshot({ id: "snap_first", query: "APT29", normalizedQuery: "apt29", runId: "run_live", status: "partial", capturedAt: "2026-05-24T13:00:01.000Z", discoveryEvidenceIds: [discovery.id], newEvidenceIds: [discovery.id] }));
    const firstPoll = store.queries().activeRunEvidence("run_live", { tenantId: "tenant_live" });
    expect(firstPoll.discoveryEvidence.map((item) => item.id)).toEqual([discovery.id]);
    expect(firstPoll.captures).toEqual([]);

    const rawText = "APT29 used phishing against Example Research with CVE-2026-1234.";
    const result = processCollectedItem({ sourceId: "src_live", taskId: "task_live", url: discovery.url ?? "", collectedAt: "2026-05-24T13:01:00.000Z", title: "APT29 promoted report", rawText, contentHash: hashContent(rawText), links: [], metadata: { promotedFromDiscoveryId: discovery.id }, sensitive: false });
    store.savePipelineResult({ ...result, capture: { ...result.capture, tenantId: "tenant_live" } });
    store.promoteDiscoveryEvidence({ discoveryEvidenceId: discovery.id, taskId: "task_live", captureId: result.capture.id, incidentId: result.incident?.id, promotedAt: "2026-05-24T13:01:01.000Z", promotedBy: "pipeline" });
    store.saveLiveSearchSnapshot(fixtureSnapshot({ id: "snap_second", query: "APT29", normalizedQuery: "apt29", runId: "run_live", status: "ready", capturedAt: "2026-05-24T13:01:02.000Z", discoveryEvidenceIds: [discovery.id], captureIds: [result.capture.id], incidentIds: result.incident ? [result.incident.id] : [], newEvidenceIds: [result.capture.id, result.incident?.id].filter((id): id is string => Boolean(id)) }));

    const secondPoll = store.queries().newlyAvailableEvidenceSince("2026-05-24T13:00:30.000Z", { tenantId: "tenant_live" });
    expect(secondPoll.captures.map((capture) => capture.id)).toEqual([result.capture.id]);
    expect(secondPoll.incidents.map((incident) => incident.id)).toEqual(result.incident ? [result.incident.id] : []);
    expect(store.getDiscoveryEvidence(discovery.id)).toMatchObject({ id: discovery.id, snippet: discovery.snippet, promotedToCaptureId: result.capture.id, promotedToIncidentId: result.incident?.id });
  });

  test("queries live snapshots by query, provenance, deltas, and stale pruning", () => {
    const store = new InMemoryScraperStore();
    const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({ id: "disc_stale", query: "Scattered Spider", normalizedQuery: "scattered spider", resultId: "result_stale", snippet: "Public channel mentioned Scattered Spider.", provider: "public_channel", evidenceType: "public_channel_snippet", observedAt: "2026-05-24T14:00:00.000Z" }));
    store.saveLiveSearchSnapshot(fixtureSnapshot({ id: "snap_stale", query: "Scattered Spider", normalizedQuery: "scattered spider", status: "partial", capturedAt: "2026-05-24T14:00:01.000Z", discoveryEvidenceIds: [discovery.id], newEvidenceIds: [discovery.id], staleAt: "2026-05-24T15:00:00.000Z" }));
    expect(store.queries().liveSnapshotsByQuery(" scattered   spider ", { tenantId: "tenant_live" })).toHaveLength(1);
    expect(store.queries().provenanceChainByResultId("result_stale", { tenantId: "tenant_live" })[0]).toMatchObject({ sourceId: "src_live", captureId: "disc_stale", extractorVersion: "discovery-evidence:v1" });
    expect(store.queries().newlyAvailableEvidenceSince("2026-05-24T13:59:00.000Z", { tenantId: "tenant_live" }).discoveryEvidence).toHaveLength(1);
    expect(store.queries().pruneStaleSnapshots("2026-05-24T15:00:01.000Z", { tenantId: "tenant_live" }).map((snapshot) => snapshot.id)).toEqual(["snap_stale"]);
  });

  test("discovery and live search snapshot retention policies are short-lived", () => {
    expect(DEFAULT_RETENTION_POLICIES.discovery_snippet.ttlDays).toBeLessThan(DEFAULT_RETENTION_POLICIES.public_chat_text.ttlDays ?? 0);
    expect(DEFAULT_RETENTION_POLICIES.live_search_snapshot.action).toBe("delete_capture_metadata");
    expect(DEFAULT_RETENTION_POLICIES.evidence_delta.ttlDays).toBeLessThan(DEFAULT_RETENTION_POLICIES.public_report.ttlDays ?? 0);
  });
});
