import { describe, expect, test } from "bun:test";
import { startApiServer } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryObjectEvidenceStore, InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { DiscoveryEvidence, EvidenceDelta, IncidentCandidate, LiveSearchSnapshot, RawCapture } from "../types.ts";
import { hashContent, stableId } from "../utils.ts";

describe("mounted evidence endpoints", () => {
  test("serves replay-plan and cutover-report pass proofs without unsafe evidence fields", async () => {
    const store = new InMemoryScraperStore();
    const objectStore = new InMemoryObjectEvidenceStore();
    seedMountedEvidence(store, { query: "APT29", runId: "run_pass" });
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier(), objectStore });
    try {
      const base = `http://127.0.0.1:${server.port}`;
      const replay = await json(`${base}/v1/evidence/replay-plan?q=APT29&runId=run_pass`);
      const report = await json(`${base}/v1/evidence/cutover-report?q=APT29&runId=run_pass&generatedAt=2026-05-24T22:00:00.000Z`);
      const ledger = await json(`${base}/v1/evidence/trust-ledger?q=APT29&runId=run_pass&generatedAt=2026-05-24T22:00:00.000Z`);
      const claimLedger = await json(`${base}/v1/evidence/claim-ledger?q=APT29&runId=run_pass&generatedAt=2026-05-24T22:00:00.000Z`);

      expect(replay.replayPlan).toMatchObject({
        endpoint: "/v1/evidence/replay-plan",
        replayable: true,
        redaction: {
          sensitiveBodiesExposed: false,
          objectKeysExposed: false
        }
      });
      expect(report.cutoverReport).toMatchObject({
        readiness: { overall: "ready" },
        promotionGate: {
          agent09Fields: { cursorReplayReady: true },
          agent10Fields: { objectIntegrityReady: true }
        }
      });
      expect(ledger.contract).toMatchObject({
        endpoint: "/v1/evidence/trust-ledger",
        method: "GET",
        response: expect.arrayContaining(["trustGate", "claims", "cutover", "safeOutput"])
      });
      expect(ledger.trustLedger).toMatchObject({
        endpoint: "/v1/evidence/trust-ledger",
        trustGate: "ready",
        counts: { trusted: 1, blocked: 0 },
        claims: [expect.objectContaining({
          claimId: "incident_run_pass",
          ledgerIds: ["ledger_run_pass"],
          graphRelationshipIds: ["rel_run_pass"],
          trustStatus: "trusted",
          replayable: true
        })],
        safeOutput: {
          sensitiveBodiesExposed: false,
          objectKeysExposed: false,
          unsafeRestrictedMetadataExposed: false
        },
        enforcement: {
          state: "pass",
          releaseAction: "promote",
          canPromote: true,
          downstream: {
            agent07AnswerReadiness: "ready",
            agent08GraphExportGate: "ready",
            agent10ReleasePacket: "promote"
          }
        },
        certification: {
          status: "certified",
          releaseAction: "promote",
          canCutover: true,
          objectStore: {
            expectedObjectCount: 0,
            verifiedObjectCount: 0,
            writeFailureFixture: "covered"
          },
          postgresRepository: {
            immutableCaptureRows: true,
            transactionBoundary: "capture_object_extraction_delta",
            duplicateClaimSuppression: "covered",
            deletionAudit: "metadata_only_with_reason"
          },
          cursorReplay: {
            replayable: true,
            cursorGap: false,
            restartReplayFixture: "covered"
          },
          fixtures: {
            cleanCutover: "covered",
            missingObject: "covered",
            hashMismatch: "covered",
            staleExtractorReplay: "covered",
            restrictedMetadataRedaction: "covered",
            retiredSource: "covered",
            graphHold: "covered",
            lowConfidence: "covered",
            duplicateClaim: "covered",
            cursorGap: "covered",
            retentionExpiry: "covered",
            legalHold: "covered",
            objectStoreWriteFailure: "covered"
          },
          downstream: {
            agent07AnswerReadiness: "ready",
            agent08ExportGate: "ready",
            agent10ReleaseTrain: "promote"
          }
        }
      });
      expect(claimLedger.contract).toMatchObject({ endpoint: "/v1/evidence/claim-ledger" });
      expect(claimLedger.claimLedger).toMatchObject({
        endpoint: "/v1/evidence/claim-ledger",
        trustGate: "ready",
        claims: [expect.objectContaining({ ledgerIds: ["ledger_run_pass"], trustStatus: "trusted" })],
        certification: { status: "certified", releaseAction: "promote" }
      });
      const serialized = JSON.stringify({ replay, report, ledger, claimLedger }).toLowerCase();
      expect(serialized).not.toContain("raw proof payload");
      expect(serialized).not.toContain("\"body\":");
      expect(serialized).not.toContain("object/key");
    } finally {
      server.stop();
    }
  });

  test("serves stale snapshot hold missing object hold restricted redaction and graph blocker proofs", async () => {
    const stale = await mountedCutoverReport({
      query: "Stale Actor",
      runId: "run_stale",
      staleSnapshot: true
    }, "2026-05-24T22:01:00.000Z");
    const missingObject = await mountedCutoverReport({
      query: "Missing Object",
      runId: "run_missing_object",
      missingObject: true
    });
    const restricted = await mountedCutoverReport({
      query: "Restricted Actor",
      runId: "run_restricted",
      restrictedRedaction: true
    });
    const graph = await mountedCutoverReport({
      query: "Graph Blocker",
      runId: "run_graph_blocker",
      relationshipKind: "contradicted"
    });

    expect(stale.cutoverReport).toMatchObject({
      readiness: { agent09: "hold", overall: "hold" },
      counts: { staleSnapshots: 1 }
    });
    expect(missingObject.cutoverReport).toMatchObject({
      readiness: { agent10: "blocked", overall: "blocked" },
      counts: { missingObjects: 1 },
      promotionGate: { agent10Fields: { missingObjectCount: 1 } },
      trustLedger: {
        enforcement: {
          state: "hold",
          releaseAction: "hold",
          canPromote: false,
          holds: expect.arrayContaining(["missing_objects"]),
          publicApiImpact: "blocked",
          repairPackets: expect.arrayContaining([expect.objectContaining({
            code: "missing_objects",
            owner: "Agent 06",
            dryRun: true,
            willMutate: false,
            willStartCrawling: false
          })])
        },
        certification: {
          status: "hold",
          releaseAction: "hold",
          canCutover: false,
          objectStore: {
            missingObjectIds: expect.arrayContaining(["cap_run_missing_object"]),
            writeFailureFixture: "covered"
          },
          downstream: {
            agent07AnswerReadiness: "blocked",
            agent08ExportGate: "blocked",
            agent10ReleaseTrain: "hold"
          }
        }
      }
    });
    expect(restricted.cutoverReport).toMatchObject({
      redaction: {
        sensitiveBodiesExposed: false,
        objectKeysExposed: false,
        metadataOnlyCaptureIds: expect.arrayContaining(["cap_run_restricted_restricted"])
      }
    });
    expect(graph.cutoverReport).toMatchObject({
      readiness: { overall: "hold" },
      promotionGate: { blockers: expect.arrayContaining(["export_blockers"]) },
      exportBlockers: [{ id: "delta_run_graph_blocker_relationship", reason: "delta_contradicted" }]
    });
    const serialized = JSON.stringify({ stale, missingObject, restricted, graph });
    expect(serialized).not.toContain("hidden restricted body");
    expect(serialized).not.toContain("object/key");
    expect(serialized).not.toContain("unsafe://restricted");
  });

  test("rejects invalid evidence endpoint query and run id through mounted server", async () => {
    const store = new InMemoryScraperStore();
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
    try {
      const base = `http://127.0.0.1:${server.port}`;
      const missingQuery = await fetch(`${base}/v1/evidence/replay-plan`);
      const missingRun = await fetch(`${base}/v1/evidence/cutover-report?q=APT29&runId=run_missing`);

      expect(missingQuery.status).toBe(400);
      expect(await missingQuery.json()).toMatchObject({ error: { code: "bad_request" } });
      expect(missingRun.status).toBe(404);
      expect(await missingRun.json()).toMatchObject({ error: { code: "not_found" } });
    } finally {
      server.stop();
    }
  });
});

async function json(url: string): Promise<Record<string, any>> {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  return await response.json() as Record<string, any>;
}

async function mountedCutoverReport(
  seed: Parameters<typeof seedMountedEvidence>[1],
  generatedAt = "2026-05-24T22:00:00.000Z"
): Promise<Record<string, any>> {
  const store = new InMemoryScraperStore();
  const objectStore = new InMemoryObjectEvidenceStore();
  seedMountedEvidence(store, seed);
  const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier(), objectStore });
  try {
    const base = `http://127.0.0.1:${server.port}`;
    return await json(`${base}/v1/evidence/cutover-report?q=${encodeURIComponent(seed.query)}&runId=${encodeURIComponent(seed.runId)}&generatedAt=${generatedAt}`);
  } finally {
    server.stop();
  }
}

function seedMountedEvidence(
  store: InMemoryScraperStore,
  options: {
    query: string;
    runId: string;
    staleSnapshot?: boolean;
    missingObject?: boolean;
    restrictedRedaction?: boolean;
    relationshipKind?: EvidenceDelta["kind"];
  }
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
    incidentCount: 0
  });
  const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({
    id: `disc_${suffix}`,
    query: options.query,
    normalizedQuery,
    resultId: `result_${suffix}`
  }));
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
      graphReviewState: "accepted"
    },
    ...(options.missingObject
      ? {
        body: undefined,
        storageKind: "external_object" as const,
        objectRef: {
          bucket: "memory-evidence",
          key: `object/key/${suffix}`,
          sizeBytes: 100,
          sha256: `missing_hash_${suffix}`
        },
        contentHash: `missing_hash_${suffix}`,
        retentionClass: "public_report" as const
      }
      : {})
  }));
  store.saveIncident(fixtureIncident({
    id: `incident_${suffix}`,
    sourceId: capture.sourceId,
    captureId: capture.id,
    title: `${options.query} endpoint claim`,
    firstSeenAt: capture.collectedAt
  }));
  store.promoteDiscoveryEvidence({
    discoveryEvidenceId: discovery.id,
    captureId: capture.id,
    incidentId: `incident_${suffix}`,
    promotedAt: "2026-05-24T22:00:01.000Z",
    promotedBy: "pipeline"
  });
  if (options.restrictedRedaction) {
    store.saveCapture(fixtureCapture({
      id: `cap_${suffix}_restricted`,
      url: "unsafe://restricted",
      body: "hidden restricted body",
      sensitive: true,
      sensitivityFlags: ["restricted_protocol"],
      storageKind: "inline_text",
      metadata: { query: options.query, normalizedQuery, runId: options.runId }
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
    incidentIds: [`incident_${suffix}`]
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
    relationshipIds: [`rel_${suffix}`]
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
    newEvidenceIds: [capture.id, `incident_${suffix}`, `rel_${suffix}`]
  }));
}

function fixtureIncident(overrides: Partial<IncidentCandidate> = {}): IncidentCandidate {
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
    ...overrides
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
    metadata: { query: "APT29", normalizedQuery: "apt29", runId: "run_endpoint" },
    sensitive: false,
    ...overrides
  };
}

function fixtureDiscovery(overrides: Partial<DiscoveryEvidence> = {}): DiscoveryEvidence {
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
    ...overrides
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
    ...overrides
  };
}

function fixtureSnapshot(overrides: Partial<LiveSearchSnapshot> = {}): LiveSearchSnapshot {
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
    ...overrides
  };
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}
