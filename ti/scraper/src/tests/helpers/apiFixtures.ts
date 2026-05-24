import { InMemoryScraperStore } from "../../storage/memoryStore.ts";
import type { DiscoveryEvidence, EvidenceDelta, LiveSearchSnapshot, RawCapture, SourceRecord } from "../../types.ts";
import { hashContent, stableId } from "../../utils.ts";

export function source(input: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: input.id ?? "src_rss",
    name: input.name ?? "Security RSS",
    type: input.type ?? "rss",
    url: input.url ?? "https://example.test/search?q={query}",
    accessMethod: input.accessMethod ?? "public_http",
    status: input.status ?? "active",
    risk: input.risk ?? "low",
    trustScore: input.trustScore ?? 0.9,
    language: input.language,
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600,
    legalNotes: input.legalNotes ?? "Public test source.",
    approvedAt: input.approvedAt,
    approvedBy: input.approvedBy,
    governance: input.governance,
    health: input.health,
    catalog: input.catalog,
    scoring: input.scoring,
    crawlState: input.crawlState,
    tags: input.tags,
    metadata: input.metadata,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

export function apiRestrictedMetadataApplyPlanSources(): SourceRecord[] {
  const approvedGovernance = {
    approvalState: "approved" as const,
    approvalRequired: true,
    metadataOnly: true,
    approvedAt: "2026-01-01T00:00:00.000Z",
    approvedBy: "reviewer",
    policyVersion: "collection-policy:v1"
  };
  return [
    source({ id: "src_restricted_ready", name: "Ready restricted metadata source", type: "tor_metadata", url: "http://readyexample.onion/posts", accessMethod: "approved_proxy", status: "active", risk: "high", legalNotes: "Approved restricted metadata fixture.", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer", governance: approvedGovernance }),
    source({ id: "src_restricted_pending", name: "Pending restricted metadata source", type: "tor_metadata", url: "http://pendingexample.onion/posts", accessMethod: "approved_proxy", status: "needs_review", risk: "high", legalNotes: "", governance: { approvalState: "pending", approvalRequired: true, metadataOnly: true, policyVersion: "collection-policy:v1" } }),
    source({ id: "src_restricted_unsafe", name: "Unsafe restricted metadata source", type: "tor_metadata", url: "http://user:pass@unsafeexample.onion/download/customer-dump.zip", accessMethod: "approved_proxy", status: "active", risk: "high", legalNotes: "Unsafe target fixture.", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer", governance: approvedGovernance }),
    source({ id: "src_restricted_disabled", name: "Disabled restricted metadata source", type: "tor_metadata", url: "http://disabledexample.onion/posts", accessMethod: "disabled", status: "disabled", risk: "high", legalNotes: "Disabled restricted fixture.", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer", governance: approvedGovernance }),
    source({ id: "src_restricted_retention", name: "Retention expiring restricted metadata source", type: "tor_metadata", url: "http://retentionexample.onion/posts", accessMethod: "approved_proxy", status: "active", risk: "high", legalNotes: "Retention expiring fixture.", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer", governance: approvedGovernance, metadata: { retentionClass: "restricted_metadata", restrictedRetentionExpiresAt: "2026-05-27T00:00:00.000Z" } })
  ];
}

export function api(path: string, init?: RequestInit) {
  return new Request(`http://scraper.test${path}`, init);
}

export async function body(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

export function telegramCapture(input: {
  id: string;
  sourceId: string;
  url: string;
  channel: string;
  messageId: number;
  body: string;
  messageState?: "available" | "deleted" | "unavailable";
  editDate?: string;
}): RawCapture {
  return {
    id: input.id,
    sourceId: input.sourceId,
    url: input.url,
    collectedAt: "2026-05-24T00:00:00.000Z",
    publishedAt: "2026-05-24T00:00:00.000Z",
    contentHash: hashContent(`${input.url}:${input.body}:${input.messageState ?? "available"}:${input.editDate ?? ""}`),
    mediaType: "text/plain",
    storageKind: "inline_text",
    body: input.body,
    metadata: {
      adapter: "telegram_public",
      channel: input.channel,
      messageId: input.messageId,
      messageState: input.messageState ?? "available",
      editDate: input.editDate,
      urlMentions: [],
      media: { retention: "metadata_only", items: [] },
      extractionHandoff: {
        actorAliases: input.body.includes("APT29") ? ["APT29"] : [],
        cves: [],
        victims: [],
        uncertaintyMarkers: []
      },
      provenance: { confidence: 0.9 }
    },
    sensitive: false
  };
}

export function seedEvidenceReplayFixture(store: InMemoryScraperStore): void {
  store.saveRun({
    id: "run_api",
    tenantId: "tenant_api",
    planId: "plan_api",
    requestId: "request_api",
    status: "running",
    createdAt: "2026-05-24T21:00:00.000Z",
    updatedAt: "2026-05-24T21:00:00.000Z",
    taskCount: 1,
    reviewTaskCount: 0,
    rejectedSourceCount: 0,
    captureCount: 0,
    incidentCount: 0
  });
  const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({
    id: "disc_api_replay",
    resultId: "result_api_replay"
  }));
  const capture = store.saveCapture(fixtureCapture({
    id: "cap_api_replay",
    metadata: {
      query: "APT29",
      normalizedQuery: "apt29",
      runId: "run_api",
      promotedFromDiscoveryId: discovery.id
    }
  }));
  store.promoteDiscoveryEvidence({
    discoveryEvidenceId: discovery.id,
    captureId: capture.id,
    promotedAt: "2026-05-24T21:00:01.000Z",
    promotedBy: "pipeline"
  });
  store.saveCapture(fixtureCapture({
    id: "cap_api_restricted",
    url: "https://example.test/restricted-api",
    body: "hidden sensitive body",
    sensitive: true,
    sensitivityFlags: ["credential_material"],
    metadata: {
      query: "APT29",
      normalizedQuery: "apt29",
      runId: "run_api"
    },
    storageKind: "inline_text"
  }));
  store.saveEvidenceDelta(fixtureDelta({
    id: "delta_api_extraction",
    cursor: "2026-05-24T21:00:02.000Z#delta_api_extraction",
    kind: "updated",
    subjectType: "extraction",
    subjectId: "incident_api",
    captureIds: [capture.id],
    incidentIds: ["incident_api"]
  }));
  store.saveEvidenceDelta(fixtureDelta({
    id: "delta_api_relationship",
    cursor: "2026-05-24T21:00:03.000Z#delta_api_relationship",
    kind: "added",
    subjectType: "relationship",
    subjectId: "rel_api",
    captureIds: [capture.id],
    incidentIds: ["incident_api"],
    relationshipIds: ["rel_api"]
  }));
  store.saveLiveSearchSnapshot(fixtureSnapshot({
    id: "snap_api_replay",
    runId: "run_api",
    capturedAt: "2026-05-24T21:00:04.000Z",
    discoveryEvidenceIds: [discovery.id],
    captureIds: [capture.id],
    incidentIds: ["incident_api"],
    newEvidenceIds: [capture.id, "incident_api", "rel_api"]
  }));
}

export function fixtureCapture(overrides: Partial<RawCapture> = {}): RawCapture {
  const bodyText = overrides.body ?? "APT29 public evidence CVE-2026-1234.";
  return {
    id: "cap_api_fixture",
    tenantId: "tenant_api",
    sourceId: "src_api",
    url: "https://example.test/api-evidence",
    collectedAt: "2026-05-24T21:00:00.000Z",
    contentHash: hashContent(bodyText),
    mediaType: "text/plain",
    storageKind: "inline_text",
    body: bodyText,
    metadata: { query: "APT29", normalizedQuery: "apt29", runId: "run_api" },
    sensitive: false,
    ...overrides
  };
}

export function restrictedMetadataApplyPlanSources(): SourceRecord[] {
  const approvedGovernance = {
    approvalState: "approved" as const,
    approvalRequired: true,
    metadataOnly: true,
    approvedAt: "2026-01-01T00:00:00.000Z",
    approvedBy: "reviewer",
    policyVersion: "collection-policy:v1"
  };
  return [
    source({
      id: "src_restricted_ready",
      name: "Ready restricted metadata source",
      type: "tor_metadata",
      url: "http://readyexample.onion/posts",
      accessMethod: "approved_proxy",
      status: "active",
      risk: "high",
      legalNotes: "Approved restricted metadata fixture.",
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "reviewer",
      governance: approvedGovernance
    }),
    source({
      id: "src_restricted_pending",
      name: "Pending restricted metadata source",
      type: "tor_metadata",
      url: "http://pendingexample.onion/posts",
      accessMethod: "approved_proxy",
      status: "needs_review",
      risk: "high",
      legalNotes: "",
      governance: {
        approvalState: "pending",
        approvalRequired: true,
        metadataOnly: true,
        policyVersion: "collection-policy:v1"
      }
    }),
    source({
      id: "src_restricted_unsafe",
      name: "Unsafe restricted metadata source",
      type: "tor_metadata",
      url: "http://user:pass@unsafeexample.onion/download/customer-dump.zip",
      accessMethod: "approved_proxy",
      status: "active",
      risk: "high",
      legalNotes: "Unsafe target fixture.",
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "reviewer",
      governance: approvedGovernance
    }),
    source({
      id: "src_restricted_disabled",
      name: "Disabled restricted metadata source",
      type: "tor_metadata",
      url: "http://disabledexample.onion/posts",
      accessMethod: "disabled",
      status: "disabled",
      risk: "high",
      legalNotes: "Disabled restricted fixture.",
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "reviewer",
      governance: approvedGovernance
    }),
    source({
      id: "src_restricted_retention",
      name: "Retention expiring restricted metadata source",
      type: "tor_metadata",
      url: "http://retentionexample.onion/posts",
      accessMethod: "approved_proxy",
      status: "active",
      risk: "high",
      legalNotes: "Retention expiring fixture.",
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "reviewer",
      governance: approvedGovernance,
      metadata: {
        retentionClass: "restricted_metadata",
        restrictedRetentionExpiresAt: "2026-05-27T00:00:00.000Z"
      }
    })
  ];
}

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
  return {
    id: "delta_api_fixture",
    tenantId: "tenant_api",
    query: "APT29",
    normalizedQuery: "apt29",
    runId: "run_api",
    cursor: "2026-05-24T21:00:00.000Z#delta_api_fixture",
    kind: "added",
    subjectType: "discovery_evidence",
    subjectId: "disc_api_fixture",
    observedAt: "2026-05-24T21:00:00.000Z",
    sourceId: "src_api",
    discoveryEvidenceIds: ["disc_api_fixture"],
    captureIds: [],
    incidentIds: [],
    relationshipIds: [],
    policyEventIds: [],
    retentionClass: "evidence_delta",
    metadata: { fixture: true },
    ...overrides
  };
}

export function fixtureSnapshot(overrides: Partial<LiveSearchSnapshot> = {}): LiveSearchSnapshot {
  return {
    id: "snap_api_fixture",
    tenantId: "tenant_api",
    query: "APT29",
    normalizedQuery: "apt29",
    runId: "run_api",
    status: "ready",
    capturedAt: "2026-05-24T21:00:00.000Z",
    discoveryEvidenceIds: [],
    captureIds: [],
    incidentIds: [],
    newEvidenceIds: [],
    metadata: { fixture: true },
    retentionClass: "live_search_snapshot",
    ...overrides
  };
}
