import { expect } from "bun:test";
import { startApiServer } from "../../api/server.ts";
import { FocusedFrontier } from "../../frontier/frontier.ts";
import {
  InMemoryObjectEvidenceStore,
  InMemoryScraperStore,
} from "../../storage/memoryStore.ts";
import type {
  DiscoveryEvidence,
  EvidenceDelta,
  IncidentCandidate,
  LiveSearchSnapshot,
  RawCapture,
} from "../../types.ts";
import { hashContent, stableId } from "../../utils.ts";

export async function json(url: string): Promise<Record<string, any>> {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  return await response.json() as Record<string, any>;
}
export async function mountedCutoverReport(
  seed: Parameters<typeof seedMountedEvidence>[1],
  generatedAt = "2026-05-24T22:00:00.000Z",
): Promise<Record<string, any>> {
  const store = new InMemoryScraperStore();
  const objectStore = new InMemoryObjectEvidenceStore();
  seedMountedEvidence(store, seed);
  const server = startApiServer({
    port: 0,
    store,
    frontier: new FocusedFrontier(),
    objectStore,
  });
  try {
    const base = `http://127.0.0.1:${server.port}`;
    return await json(
      `${base}/v1/evidence/cutover-report?q=${
        encodeURIComponent(seed.query)
      }&runId=${encodeURIComponent(seed.runId)}&tenantId=tenant_endpoint&generatedAt=${generatedAt}`,
    );
  } finally {
    await server.stop();
  }
}
export function seedMountedEvidence(
  store: InMemoryScraperStore,
  options: {
    query: string;
    runId: string;
    staleSnapshot?: boolean;
    missingObject?: boolean;
    restrictedRedaction?: boolean;
    relationshipKind?: EvidenceDelta["kind"];
  },
): void {
  const normalizedQuery = normalizeQuery(options.query);
  const suffix = options.runId;
  store.saveRun({
    id: options.runId,
    tenantId: "tenant_endpoint",
    planId: `plan_${suffix}`,
    requestId: `request_${suffix}`,
    status: "running",
    createdAt: "2026-05-24T22:00:00.000Z",
    updatedAt: "2026-05-24T22:00:00.000Z",
    taskCount: 1,
    reviewTaskCount: 0,
    rejectedSourceCount: 0,
    captureCount: 0,
    incidentCount: 0,
  });
  const discovery = store.saveDiscoveryEvidence(
    fixtureDiscovery({
      id: `disc_${suffix}`,
      query: options.query,
      normalizedQuery,
      resultId: `result_${suffix}`,
    }),
  );
  const capture = store.saveCapture(fixtureCapture({
    id: `cap_${suffix}`,
    url: `https://example.test/${suffix}`,
    metadata: {
      query: options.query,
      normalizedQuery,
      runId: options.runId,
      promotedFromDiscoveryId: discovery.id,
      evidenceLedgerId: `ledger_${suffix}`,
      evidenceStage: "captured",
      graphReviewState: "accepted",
    },
    ...(options.missingObject
      ? {
        body: undefined,
        storageKind: "external_object" as const,
        objectRef: {
          bucket: "memory-evidence",
          key: `object/key/${suffix}`,
          sizeBytes: 100,
          sha256: `missing_hash_${suffix}`,
        },
        contentHash: `missing_hash_${suffix}`,
        retentionClass: "public_report" as const,
      }
      : {}),
  }));
  store.saveIncident(
    fixtureIncident({
      id: `incident_${suffix}`,
      sourceId: capture.sourceId,
      captureId: capture.id,
      title: `${options.query} endpoint claim`,
      firstSeenAt: capture.collectedAt,
    }),
  );
  store.promoteDiscoveryEvidence({
    discoveryEvidenceId: discovery.id,
    captureId: capture.id,
    incidentId: `incident_${suffix}`,
    promotedAt: "2026-05-24T22:00:01.000Z",
    promotedBy: "pipeline",
  });
  if (options.restrictedRedaction) {
    store.saveCapture(fixtureCapture({
      id: `cap_${suffix}_restricted`,
      url: "unsafe://restricted",
      body: "hidden restricted body",
      sensitive: true,
      sensitivityFlags: ["restricted_protocol"],
      storageKind: "inline_text",
      metadata: { query: options.query, normalizedQuery, runId: options.runId },
    }));
  }
  store.saveEvidenceDelta(fixtureDelta({
    id: `delta_${suffix}_extraction`,
    query: options.query,
    normalizedQuery,
    runId: options.runId,
    cursor: `2026-05-24T22:00:02.000Z#delta_${suffix}_extraction`,
    kind: "updated",
    subjectType: "extraction",
    subjectId: `incident_${suffix}`,
    discoveryEvidenceIds: [discovery.id],
    captureIds: [capture.id],
    incidentIds: [`incident_${suffix}`],
  }));
  store.saveEvidenceDelta(fixtureDelta({
    id: `delta_${suffix}_relationship`,
    query: options.query,
    normalizedQuery,
    runId: options.runId,
    cursor: `2026-05-24T22:00:03.000Z#delta_${suffix}_relationship`,
    kind: options.relationshipKind ?? "added",
    subjectType: "relationship",
    subjectId: `rel_${suffix}`,
    discoveryEvidenceIds: [discovery.id],
    captureIds: [capture.id],
    incidentIds: [`incident_${suffix}`],
    relationshipIds: [`rel_${suffix}`],
  }));
  store.saveLiveSearchSnapshot(fixtureSnapshot({
    id: `snap_${suffix}`,
    query: options.query,
    normalizedQuery,
    runId: options.runId,
    capturedAt: "2026-05-24T22:00:04.000Z",
    staleAt: options.staleSnapshot ? "2026-05-24T22:00:10.000Z" : undefined,
    discoveryEvidenceIds: [discovery.id],
    captureIds: [capture.id],
    incidentIds: [`incident_${suffix}`],
    newEvidenceIds: [capture.id, `incident_${suffix}`, `rel_${suffix}`],
  }));
}
function fixtureIncident(
  overrides: Partial<IncidentCandidate> = {},
): IncidentCandidate {
  return {
    id: "incident_endpoint_fixture",
    sourceId: "src_endpoint",
    captureId: "cap_endpoint_fixture",
    extractorVersion: "endpoint-fixture:v1",
    title: "APT29 endpoint claim",
    summary: "Endpoint proof claim for evidence trust ledger.",
    firstSeenAt: "2026-05-24T22:00:00.000Z",
    confidence: 0.86,
    entities: [{ type: "actor", value: "APT29", confidence: 0.9 }],
    indicators: [],
    reviewReasons: [],
    ...overrides,
  };
}
function fixtureCapture(overrides: Partial<RawCapture> = {}): RawCapture {
  const body = overrides.body ?? "APT29 endpoint proof evidence.";
  return {
    id: "cap_endpoint_fixture",
    tenantId: "tenant_endpoint",
    sourceId: "src_endpoint",
    url: "https://example.test/evidence-endpoint",
    collectedAt: "2026-05-24T22:00:00.000Z",
    contentHash: hashContent(body),
    mediaType: "text/plain",
    storageKind: "inline_text",
    body,
    metadata: {
      query: "APT29",
      normalizedQuery: "apt29",
      runId: "run_endpoint",
    },
    sensitive: false,
    ...overrides,
  };
}
function fixtureDiscovery(
  overrides: Partial<DiscoveryEvidence> = {},
): DiscoveryEvidence {
  return {
    id: "disc_endpoint_fixture",
    tenantId: "tenant_endpoint",
    query: "APT29",
    normalizedQuery: "apt29",
    provider: "search_provider",
    evidenceType: "search_snippet",
    resultId: stableId("result", "endpoint proof"),
    observedAt: "2026-05-24T22:00:00.000Z",
    title: "Endpoint proof fixture",
    snippet: "APT29 endpoint proof discovery.",
    url: "https://example.test/evidence-endpoint",
    sourceId: "src_endpoint",
    confidence: 0.7,
    metadata: { fixture: true },
    retentionClass: "discovery_snippet",
    ...overrides,
  };
}
function fixtureDelta(overrides: Partial<EvidenceDelta> = {}): EvidenceDelta {
  return {
    id: "delta_endpoint_fixture",
    tenantId: "tenant_endpoint",
    query: "APT29",
    normalizedQuery: "apt29",
    runId: "run_endpoint",
    cursor: "2026-05-24T22:00:00.000Z#delta_endpoint_fixture",
    kind: "added",
    subjectType: "discovery_evidence",
    subjectId: "disc_endpoint_fixture",
    observedAt: "2026-05-24T22:00:00.000Z",
    sourceId: "src_endpoint",
    discoveryEvidenceIds: [],
    captureIds: [],
    incidentIds: [],
    relationshipIds: [],
    policyEventIds: [],
    retentionClass: "evidence_delta",
    metadata: { fixture: true },
    ...overrides,
  };
}
function fixtureSnapshot(
  overrides: Partial<LiveSearchSnapshot> = {},
): LiveSearchSnapshot {
  return {
    id: "snap_endpoint_fixture",
    tenantId: "tenant_endpoint",
    query: "APT29",
    normalizedQuery: "apt29",
    runId: "run_endpoint",
    status: "ready",
    capturedAt: "2026-05-24T22:00:00.000Z",
    discoveryEvidenceIds: [],
    captureIds: [],
    incidentIds: [],
    newEvidenceIds: [],
    metadata: { fixture: true },
    retentionClass: "live_search_snapshot",
    ...overrides,
  };
}
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}
