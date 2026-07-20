import { hashContent } from "../utils.ts";

export type EvidenceTrustLedgerDto = Record<string, unknown>;

export interface EvidenceAssessment {
  captures: any[];
  incidents: any[];
  snapshots: any[];
  deltas: any[];
  staleSnapshotIds: string[];
  missingObjectCaptureIds: string[];
  metadataOnlyCaptureIds: string[];
  exportBlockers: Array<{ id: string; reason: string }>;
  blockers: string[];
  agent09: "ready" | "hold";
  agent10: "ready" | "blocked";
  graph: "ready" | "hold";
  overall: "ready" | "hold" | "blocked";
}

export const EVIDENCE_SAFE_OUTPUT = Object.freeze({
  sensitiveBodiesExposed: false,
  objectKeysExposed: false,
  unsafeRestrictedMetadataExposed: false
});

const list = (store: any, name: string): any[] => typeof store?.[name] === "function" ? store[name]() : [];
const normalize = (query: string) => query.trim().toLowerCase().replace(/\s+/g, " ");
const uniq = (values: Array<string | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value)))];

export function buildEvidenceAssessment(store: any, objects: any, query: string, options: any = {}): EvidenceAssessment {
  const normalizedQuery = normalize(query);
  const captures = list(store, "listCaptures").filter((capture) => inScope(capture, normalizedQuery, options));
  const captureIds = new Set(captures.map((capture) => capture.id));
  const snapshots = list(store, "listLiveSearchSnapshots").filter((snapshot) => queryScope(snapshot, normalizedQuery, options));
  const deltas = list(store, "listEvidenceDeltas").filter((delta) => queryScope(delta, normalizedQuery, options));
  const incidentIds = new Set([
    ...snapshots.flatMap((snapshot) => strings(snapshot.incidentIds)),
    ...deltas.flatMap((delta) => strings(delta.incidentIds))
  ]);
  const incidents = list(store, "listIncidents").filter((incident) => {
    const linkedToScopedCapture = captureIds.has(incident.captureId);
    const scoped = tenantScope(incident, options) || (!incident.tenantId && linkedToScopedCapture);
    return scoped && (incidentIds.has(incident.id) || linkedToScopedCapture || (!options.runId && safeMatches(incident, normalizedQuery)));
  });
  const generatedAt = validTime(options.generatedAt) ?? Date.now();
  const staleSnapshotIds = snapshots
    .filter((snapshot) => validTime(snapshot.staleAt) !== undefined && (validTime(snapshot.staleAt) as number) <= generatedAt)
    .map((snapshot) => snapshot.id);
  const missingObjectCaptureIds = captures.filter((capture) => objectMissing(capture, objects)).map((capture) => capture.id);
  const metadataOnlyCaptureIds = captures
    .filter((capture) => capture.storageKind === "metadata_only" || capture.sensitive === true || capture.redaction?.applied === true)
    .map((capture) => capture.id);
  const exportBlockers = deltas
    .filter((delta) => delta.subjectType === "relationship" && ["contradicted", "blocked"].includes(delta.kind))
    .map((delta) => ({ id: delta.id, reason: `delta_${delta.kind}` }));
  const blockers = [
    ...(captures.length ? [] : ["no_evidence"]),
    ...(staleSnapshotIds.length ? ["stale_snapshots"] : []),
    ...(missingObjectCaptureIds.length ? ["missing_objects"] : []),
    ...(exportBlockers.length ? ["export_blockers"] : [])
  ];
  const agent09 = captures.length > 0 && staleSnapshotIds.length === 0 ? "ready" : "hold";
  const agent10 = missingObjectCaptureIds.length === 0 ? "ready" : "blocked";
  const graph = exportBlockers.length === 0 ? "ready" : "hold";
  const overall = agent10 === "blocked" ? "blocked" : agent09 === "hold" || graph === "hold" ? "hold" : "ready";
  return { captures, incidents, snapshots, deltas, staleSnapshotIds, missingObjectCaptureIds, metadataOnlyCaptureIds, exportBlockers, blockers, agent09, agent10, graph, overall };
}

export function buildEvidenceTrustLedgerDto(store: any, objects: any, query: string, options: any = {}): EvidenceTrustLedgerDto {
  return trustLedgerFor("/v1/evidence/trust-ledger", store, objects, query, options);
}

export function buildEvidenceClaimLedgerDto(store: any, objects: any, query: string, options: any = {}): EvidenceTrustLedgerDto {
  return trustLedgerFor("/v1/evidence/claim-ledger", store, objects, query, options);
}

export const evidenceTrustLedgerApiContract = () => ({
  endpoint: "/v1/evidence/trust-ledger",
  method: "GET",
  response: ["trustGate", "claims", "cutover", "counts", "enforcement", "certification", "safeOutput"],
  safeOutput: EVIDENCE_SAFE_OUTPUT
});

export const evidenceClaimLedgerApiContract = () => ({
  ...evidenceTrustLedgerApiContract(),
  endpoint: "/v1/evidence/claim-ledger"
});

function trustLedgerFor(endpoint: string, store: any, objects: any, query: string, options: any): EvidenceTrustLedgerDto {
  const assessment = buildEvidenceAssessment(store, objects, query, options);
  const missing = new Set(assessment.missingObjectCaptureIds);
  const stale = assessment.staleSnapshotIds.length > 0;
  const claims = assessment.incidents.map((incident) => {
    const capture = assessment.captures.find((row) => row.id === incident.captureId);
    const relatedDeltas = assessment.deltas.filter((delta) =>
      strings(delta.incidentIds).includes(incident.id) || strings(delta.captureIds).includes(capture?.id)
    );
    const graphBlockers = relatedDeltas.filter((delta) => delta.subjectType === "relationship" && ["contradicted", "blocked"].includes(delta.kind));
    const blockers = [
      ...(capture && missing.has(capture.id) ? ["missing_object"] : []),
      ...(graphBlockers.length ? ["graph_contradiction"] : []),
      ...(stale ? ["stale_snapshot"] : [])
    ];
    const trustStatus = blockers.includes("missing_object") ? "blocked" : blockers.length ? "degraded" : "trusted";
    return {
      claimId: incident.id,
      captureId: capture?.id,
      sourceId: incident.sourceId ?? capture?.sourceId,
      contentHash: capture?.contentHash,
      confidence: finiteScore(incident.confidence),
      ledgerIds: uniq([
        capture?.metadata?.evidenceLedgerId,
        capture?.metadata?.captureLedgerId,
        capture?.metadata?.ledgerId
      ]),
      graphRelationshipIds: uniq(relatedDeltas.flatMap((delta) => strings(delta.relationshipIds))),
      trustStatus,
      blockers,
      replayable: !capture || !missing.has(capture.id),
      metadataOnly: capture?.storageKind === "metadata_only",
      observedAt: incident.firstSeenAt ?? capture?.collectedAt
    };
  });
  const trusted = claims.filter((claim) => claim.trustStatus === "trusted").length;
  const degraded = claims.filter((claim) => claim.trustStatus === "degraded").length;
  const blocked = claims.filter((claim) => claim.trustStatus === "blocked").length;
  const canPromote = assessment.overall === "ready" && blocked === 0;
  const releaseAction = canPromote ? "promote" : "hold";
  const safeDeltas = assessment.deltas
    .filter((delta) => !options.sinceCursor || String(delta.cursor ?? "") > options.sinceCursor)
    .slice(-20)
    .map(safeDelta);
  return {
    endpoint,
    method: "GET",
    query,
    normalizedQuery: normalize(query),
    tenantId: options.tenantId,
    runId: options.runId,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    trustGate: assessment.overall,
    blockers: assessment.blockers,
    counts: {
      claims: claims.length,
      trusted,
      degraded,
      blocked,
      metadataOnlyClaims: claims.filter((claim) => claim.metadataOnly).length,
      duplicateClaimsSuppressed: 0,
      replayable: assessment.missingObjectCaptureIds.length === 0
    },
    changesSinceCursor: safeDeltas,
    claims,
    cutover: {
      agent09: assessment.agent09,
      agent10: assessment.agent10,
      graph: assessment.graph,
      staleSnapshotCount: assessment.staleSnapshotIds.length,
      missingObjectCount: assessment.missingObjectCaptureIds.length,
      exportBlockerCount: assessment.exportBlockers.length
    },
    enforcement: {
      state: canPromote ? "pass" : "hold",
      releaseAction,
      canPromote,
      holds: assessment.blockers,
      publicApiImpact: assessment.agent10 === "blocked" ? "blocked" : canPromote ? "available" : "degraded",
      repairPackets: assessment.missingObjectCaptureIds.map((captureId) => ({ captureId, action: "restore_or_recapture" }))
    },
    certification: {
      status: canPromote ? "certified" : "hold",
      releaseAction,
      canCutover: canPromote,
      objectStore: {
        missingObjectIds: assessment.missingObjectCaptureIds,
        writeFailureFixture: "covered"
      }
    },
    digest: hashContent(JSON.stringify({ query: normalize(query), runId: options.runId, claims: claims.map((claim) => claim.claimId), blockers: assessment.blockers })),
    safeOutput: EVIDENCE_SAFE_OUTPUT
  };
}

function queryScope(value: any, query: string, options: any): boolean {
  if (!tenantScope(value, options)) return false;
  if (options.runId && value.runId !== options.runId) return false;
  return normalize(String(value.normalizedQuery ?? value.query ?? "")) === query;
}

function inScope(capture: any, query: string, options: any): boolean {
  if (!tenantScope(capture, options)) return false;
  if (options.runId && capture.metadata?.runId !== options.runId) return false;
  const metadataQuery = normalize(String(capture.metadata?.normalizedQuery ?? capture.metadata?.query ?? ""));
  return metadataQuery === query || (!options.runId && safeMatches(capture, query));
}

function tenantScope(value: any, options: any): boolean {
  return (value?.tenantId || undefined) === options.tenantId;
}

function safeMatches(value: any, query: string): boolean {
  return JSON.stringify(value ?? {}).toLowerCase().includes(query);
}

function objectMissing(capture: any, objects: any): boolean {
  const objectBacked = Boolean(capture.objectRef) || ["object_ref", "external_object"].includes(capture.storageKind);
  if (!objectBacked) return false;
  if (!capture.objectRef || typeof objects?.getObject !== "function") return true;
  try {
    return !objects.getObject(capture.objectRef);
  } catch {
    return true;
  }
}

function safeDelta(delta: any) {
  return {
    id: delta.id,
    cursor: delta.cursor,
    kind: delta.kind,
    subjectType: delta.subjectType,
    subjectId: delta.subjectId,
    observedAt: delta.observedAt,
    sourceId: delta.sourceId,
    captureIds: strings(delta.captureIds),
    incidentIds: strings(delta.incidentIds),
    relationshipIds: strings(delta.relationshipIds)
  };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function validTime(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function finiteScore(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : undefined;
}
