import type { DiscoveryEvidence, EvidenceDelta, LiveSearchSnapshot } from "../../types.ts";
import { stableId } from "../../utils.ts";

export function fixtureDiscovery(overrides: Partial<DiscoveryEvidence> = {}): DiscoveryEvidence {
  return {
    id: "disc_api_fixture",
    tenantId: "tenant_api",
    query: "APT29",
    normalizedQuery: "apt29",
    provider: "search_provider",
    evidenceType: "search_snippet",
    resultId: stableId("result", "api replay"),
    observedAt: "2026-05-24T21:00:00.000Z",
    title: "APT29 API replay fixture",
    snippet: "APT29 discovery evidence.",
    url: "https://example.test/api-evidence",
    sourceId: "src_api",
    confidence: 0.7,
    metadata: { fixture: true },
    retentionClass: "discovery_snippet",
    ...overrides
  };
}

export function fixtureDelta(overrides: Partial<EvidenceDelta> = {}): EvidenceDelta {
  return { id: "delta_api_fixture", tenantId: "tenant_api", query: "APT29", normalizedQuery: "apt29", runId: "run_api", cursor: "2026-05-24T21:00:00.000Z#delta_api_fixture", kind: "added", subjectType: "discovery_evidence", subjectId: "disc_api_fixture", observedAt: "2026-05-24T21:00:00.000Z", sourceId: "src_api", discoveryEvidenceIds: ["disc_api_fixture"], captureIds: [], incidentIds: [], relationshipIds: [], policyEventIds: [], retentionClass: "evidence_delta", metadata: { fixture: true }, ...overrides };
}

export function fixtureSnapshot(overrides: Partial<LiveSearchSnapshot> = {}): LiveSearchSnapshot {
  return { id: "snap_api_fixture", tenantId: "tenant_api", query: "APT29", normalizedQuery: "apt29", runId: "run_api", status: "ready", capturedAt: "2026-05-24T21:00:00.000Z", discoveryEvidenceIds: [], captureIds: [], incidentIds: [], newEvidenceIds: [], metadata: { fixture: true }, retentionClass: "live_search_snapshot", ...overrides };
}
