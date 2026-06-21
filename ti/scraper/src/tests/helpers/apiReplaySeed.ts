import { InMemoryScraperStore } from "../../storage/memoryStore.ts";
import { fixtureCapture } from "./apiCaptureFixtures.ts";
import { fixtureDelta, fixtureDiscovery, fixtureSnapshot } from "./apiEvidenceFixtures.ts";

export function seedEvidenceReplayFixture(store: InMemoryScraperStore): void {
  store.saveRun({ id: "run_api", tenantId: "tenant_api", planId: "plan_api", requestId: "request_api", status: "running", createdAt: "2026-05-24T21:00:00.000Z", updatedAt: "2026-05-24T21:00:00.000Z", taskCount: 1, reviewTaskCount: 0, rejectedSourceCount: 0, captureCount: 0, incidentCount: 0 });
  const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({ id: "disc_api_replay", resultId: "result_api_replay" }));
  const capture = store.saveCapture(fixtureCapture({ id: "cap_api_replay", metadata: { query: "APT29", normalizedQuery: "apt29", runId: "run_api", promotedFromDiscoveryId: discovery.id } }));
  store.promoteDiscoveryEvidence({ discoveryEvidenceId: discovery.id, captureId: capture.id, promotedAt: "2026-05-24T21:00:01.000Z", promotedBy: "pipeline" });
  store.saveCapture(fixtureCapture({ id: "cap_api_restricted", url: "https://example.test/restricted-api", body: "hidden sensitive body", sensitive: true, sensitivityFlags: ["credential_material"], metadata: { query: "APT29", normalizedQuery: "apt29", runId: "run_api" }, storageKind: "inline_text" }));
  store.saveEvidenceDelta(fixtureDelta({ id: "delta_api_extraction", cursor: "2026-05-24T21:00:02.000Z#delta_api_extraction", kind: "updated", subjectType: "extraction", subjectId: "incident_api", captureIds: [capture.id], incidentIds: ["incident_api"] }));
  store.saveEvidenceDelta(fixtureDelta({ id: "delta_api_relationship", cursor: "2026-05-24T21:00:03.000Z#delta_api_relationship", kind: "added", subjectType: "relationship", subjectId: "rel_api", captureIds: [capture.id], incidentIds: ["incident_api"], relationshipIds: ["rel_api"] }));
  store.saveLiveSearchSnapshot(fixtureSnapshot({ id: "snap_api_replay", runId: "run_api", capturedAt: "2026-05-24T21:00:04.000Z", discoveryEvidenceIds: [discovery.id], captureIds: [capture.id], incidentIds: ["incident_api"], newEvidenceIds: [capture.id, "incident_api", "rel_api"] }));
}
