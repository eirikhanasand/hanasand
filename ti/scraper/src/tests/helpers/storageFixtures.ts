import type { DiscoveryEvidence, EvidenceDelta, LiveSearchSnapshot, ProgressiveGraphEvidence, RawCapture } from "../../types.ts";
import { hashContent, stableId } from "../../utils.ts";

export function fixtureCapture(overrides: Partial<RawCapture> = {}): RawCapture {
  const body = overrides.body ?? "LockBit ransomware report CVE-2026-1234.";
  return {
    id: "cap_fixture",
    sourceId: "src_fixture",
    url: "https://example.test/report",
    collectedAt: "2026-05-24T10:00:00.000Z",
    contentHash: hashContent(body),
    mediaType: "text/plain",
    storageKind: "inline_text",
    body,
    metadata: { fixture: true },
    sensitive: false,
    ...overrides
  };
}

export function fixtureDiscovery(overrides: Partial<DiscoveryEvidence> = {}): DiscoveryEvidence {
  return {
    id: "disc_fixture",
    tenantId: "tenant_live",
    query: "APT29",
    normalizedQuery: "apt29",
    provider: "search_provider",
    evidenceType: "search_snippet",
    resultId: stableId("result", "APT29"),
    observedAt: "2026-05-24T13:00:00.000Z",
    title: "Discovery fixture",
    snippet: "APT29 discovery snippet.",
    url: "https://example.test/discovery",
    sourceId: "src_live",
    rank: 1,
    confidence: 0.55,
    metadata: { fixture: true },
    retentionClass: "discovery_snippet",
    ...overrides
  };
}

export function fixtureSnapshot(overrides: Partial<LiveSearchSnapshot> = {}): LiveSearchSnapshot {
  return {
    id: "snap_fixture",
    tenantId: "tenant_live",
    query: "APT29",
    normalizedQuery: "apt29",
    status: "partial",
    capturedAt: "2026-05-24T13:00:01.000Z",
    discoveryEvidenceIds: [],
    captureIds: [],
    incidentIds: [],
    newEvidenceIds: [],
    metadata: { fixture: true },
    retentionClass: "live_search_snapshot",
    ...overrides
  };
}

export function fixtureEvidenceDelta(overrides: Partial<EvidenceDelta> = {}): EvidenceDelta {
  const id = overrides.id ?? "delta_fixture";
  const observedAt = overrides.observedAt ?? "2026-05-24T16:00:00.000Z";
  return {
    id,
    tenantId: "tenant_live",
    query: "APT29",
    normalizedQuery: "apt29",
    runId: "run_live",
    cursor: overrides.cursor ?? `${observedAt}#${id}`,
    kind: "added",
    subjectType: "discovery_evidence",
    subjectId: "disc_fixture",
    observedAt,
    sourceId: "src_live",
    discoveryEvidenceIds: [],
    captureIds: [],
    incidentIds: [],
    relationshipIds: [],
    policyEventIds: [],
    retentionClass: "evidence_delta",
    metadata: { fixture: true },
    ...overrides
  };
}

export function fixtureProgressiveEvidence(overrides: Partial<ProgressiveGraphEvidence> = {}): ProgressiveGraphEvidence {
  return {
    id: "graph_fixture",
    stage: "promoted",
    observedAt: "2026-05-24T16:02:00.000Z",
    sourceId: "src_live",
    captureId: "cap_graph",
    url: "https://example.test/apt29",
    contentHash: "hash_graph",
    extractorVersion: "progressive-test",
    relationships: [{ source: { type: "actor", value: "APT29", confidence: 0.82 }, target: { type: "victim", value: "Example Energy", confidence: 0.72 }, type: "targets", confidence: 0.76 }],
    ...overrides
  };
}
