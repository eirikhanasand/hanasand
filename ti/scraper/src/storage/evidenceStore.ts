import type {
  CaptureReplayJob,
  CaptureWriteResult,
  DiscoveryEvidence,
  DiscoveryPromotion,
  EvidenceBackupIntegrityReport,
  EvidenceCutoverGateStatus,
  EvidenceCutoverRehearsalReport,
  EvidenceDelta,
  EvidenceQueryHelpers,
  EvidenceReplayProof,
  EvidenceReplayProofStep,
  EvidenceTrustLedgerClaim,
  EvidenceTrustLedgerReport,
  LiveSearchSnapshot,
  ObjectStoreRef,
  PipelineResult,
  RawCapture,
  ReplayPipelineInput,
  RetentionClass
} from "../types.ts";
import { nowIso, stableId } from "../utils.ts";

export interface ObjectEvidenceWrite {
  tenantId?: string;
  sourceId: string;
  captureId: string;
  mediaType: string;
  body: string | Uint8Array;
  contentHash: string;
  retentionClass: RetentionClass;
  metadata?: Record<string, unknown>;
}

export interface ObjectEvidenceRecord {
  ref: ObjectStoreRef;
  tenantId?: string;
  sourceId: string;
  captureId: string;
  mediaType: string;
  contentHash: string;
  retentionClass: RetentionClass;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface ObjectEvidenceStore {
  putObject(input: ObjectEvidenceWrite): ObjectEvidenceRecord;
  getObject(ref: ObjectStoreRef): ObjectEvidenceRecord | undefined;
  deleteObject(ref: ObjectStoreRef, reason: string): boolean;
}

export interface CaptureMetadataStore {
  saveCapture(capture: RawCapture): RawCapture;
  saveCaptureWithDedupe(capture: RawCapture): CaptureWriteResult;
  getCapture(id: string): RawCapture | undefined;
  findDuplicateCapture(capture: RawCapture): RawCapture | undefined;
  listCaptures(): RawCapture[];
  replayInput(captureId: string, extractorVersion: string): ReplayPipelineInput | undefined;
  createReplayJob(input: Omit<CaptureReplayJob, "id" | "requestedAt" | "status" | "metadata"> & {
    id?: string;
    requestedAt?: string;
    metadata?: Record<string, unknown>;
  }): CaptureReplayJob;
  recordReplayResult(jobId: string, result: PipelineResult): CaptureReplayJob;
  getReplayJob(id: string): CaptureReplayJob | undefined;
  listReplayJobs(): CaptureReplayJob[];
  saveDiscoveryEvidence(evidence: DiscoveryEvidence): DiscoveryEvidence;
  getDiscoveryEvidence(id: string): DiscoveryEvidence | undefined;
  listDiscoveryEvidence(): DiscoveryEvidence[];
  promoteDiscoveryEvidence(promotion: DiscoveryPromotion): DiscoveryEvidence;
  saveLiveSearchSnapshot(snapshot: LiveSearchSnapshot): LiveSearchSnapshot;
  listLiveSearchSnapshots(): LiveSearchSnapshot[];
  saveEvidenceDelta(delta: EvidenceDelta): EvidenceDelta;
  listEvidenceDeltas(): EvidenceDelta[];
  queries(): EvidenceQueryHelpers;
}

export interface EvidenceRepositorySet {
  captures: CaptureMetadataStore;
  objects: ObjectEvidenceStore;
}

export interface ProductionEvidenceRepository extends CaptureMetadataStore {
  beginTransaction<T>(operation: (transaction: CaptureMetadataStore) => T): T;
}

export type EvidencePostgresTable =
  | "raw_captures"
  | "discovery_evidence"
  | "live_search_snapshots"
  | "evidence_deltas"
  | "extraction_results"
  | "capture_replay_jobs"
  | "retention_jobs";

export interface PostgresEvidenceTransaction extends CaptureMetadataStore {
  saveExtractionResult(result: PipelineResult): PipelineResult;
  saveRelationshipDelta(delta: EvidenceDelta): EvidenceDelta;
  savePolicyEventDelta(delta: EvidenceDelta): EvidenceDelta;
  recordRedaction(delta: EvidenceDelta): EvidenceDelta;
  recordExpiration(delta: EvidenceDelta): EvidenceDelta;
}

export interface PostgresEvidenceRepository extends ProductionEvidenceRepository {
  beginTransaction<T>(operation: (transaction: PostgresEvidenceTransaction) => T): T;
  tableNameFor(kind: EvidencePostgresTable): string;
}

export function saveCaptureWithObject(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  capture: RawCapture,
  body: string | Uint8Array
): RawCapture {
  const record = objects.putObject({
    tenantId: capture.tenantId,
    sourceId: capture.sourceId,
    captureId: capture.id,
    mediaType: capture.mediaType,
    body,
    contentHash: capture.contentHash,
    retentionClass: capture.retentionClass ?? "standard",
    metadata: capture.metadata
  });
  return store.saveCapture({
    ...capture,
    body: undefined,
    storageKind: "external_object",
    objectRef: record.ref
  });
}

export function buildEvidenceBackupIntegrityReport(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  options: { tenantId?: string; generatedAt?: string; rollbackNotes?: string[]; captureIds?: string[]; discoveryIds?: string[] } = {}
): EvidenceBackupIntegrityReport {
  const captureIdFilter = options.captureIds ? new Set(options.captureIds) : undefined;
  const discoveryIdFilter = options.discoveryIds ? new Set(options.discoveryIds) : undefined;
  const captures = store.listCaptures()
    .filter((capture) => !options.tenantId || capture.tenantId === options.tenantId)
    .filter((capture) => !captureIdFilter || captureIdFilter.has(capture.id));
  const discovery = store.listDiscoveryEvidence()
    .filter((item) => !options.tenantId || item.tenantId === options.tenantId)
    .filter((item) => !discoveryIdFilter || discoveryIdFilter.has(item.id));
  const incidents = new Set(store.queries().provenanceForClaim({ tenantId: options.tenantId }).flatMap((chain) => chain.incidentId ? [chain.incidentId] : []));
  const expectedObjects = captures.filter((capture) => capture.storageKind === "external_object" && capture.objectRef);
  const missingObjectIds: string[] = [];
  const hashMismatches: EvidenceBackupIntegrityReport["hashMismatches"] = [];

  for (const capture of expectedObjects) {
    if (!capture.objectRef) continue;
    const record = objects.getObject(capture.objectRef);
    if (!record) {
      missingObjectIds.push(capture.id);
      continue;
    }
    if (record.ref.sha256 !== capture.objectRef.sha256 || record.contentHash !== capture.contentHash) {
      hashMismatches.push({
        captureId: capture.id,
        expectedSha256: capture.objectRef.sha256,
        actualSha256: record.ref.sha256
      });
    }
  }

  const orphanRows = discovery.flatMap((item): EvidenceBackupIntegrityReport["orphanRows"] => {
    const rows: EvidenceBackupIntegrityReport["orphanRows"] = [];
    if (item.promotedToCaptureId && !captures.some((capture) => capture.id === item.promotedToCaptureId)) {
      rows.push({ table: "discovery_evidence", id: item.id, reason: `missing promoted capture ${item.promotedToCaptureId}` });
    }
    if (item.promotedToIncidentId && !incidents.has(item.promotedToIncidentId)) {
      rows.push({ table: "discovery_evidence", id: item.id, reason: `missing promoted incident ${item.promotedToIncidentId}` });
    }
    return rows;
  });

  const retentionExpiryCounts: EvidenceBackupIntegrityReport["retentionExpiryCounts"] = {};
  for (const capture of captures) {
    const retentionClass = capture.retentionClass ?? "standard";
    retentionExpiryCounts[retentionClass] = (retentionExpiryCounts[retentionClass] ?? 0) + 1;
  }

  return {
    tenantId: options.tenantId,
    generatedAt: options.generatedAt ?? nowIso(),
    expectedObjectCount: expectedObjects.length,
    verifiedObjectCount: expectedObjects.length - missingObjectIds.length - hashMismatches.length,
    missingObjectIds,
    hashMismatches,
    orphanRows,
    retentionExpiryCounts,
    rollbackNotes: options.rollbackNotes ?? []
  };
}

export function buildEvidenceReplayProof(
  store: CaptureMetadataStore,
  query: string,
  options: { tenantId?: string; runId?: string; sinceCursor?: string } = {}
): EvidenceReplayProof {
  const normalizedQuery = normalizeQuery(query);
  const deltas = store.queries().getSearchDeltas(query, options.sinceCursor, { tenantId: options.tenantId });
  const allDeltas = store.queries().getEvidenceTimeline(query, { tenantId: options.tenantId });
  const snapshots = store.queries().liveSnapshotsByQuery(query, { tenantId: options.tenantId });
  const runView = options.runId ? store.queries().getActiveRunEvidence(options.runId, options.sinceCursor, { tenantId: options.tenantId }) : undefined;
  const discovery = store.listDiscoveryEvidence()
    .filter((item) => item.normalizedQuery === normalizedQuery)
    .filter((item) => !options.tenantId || item.tenantId === options.tenantId);
  const captureIds = new Set([
    ...deltas.flatMap((delta) => delta.captureIds),
    ...(runView?.captures.map((capture) => capture.id) ?? []),
    ...discovery.flatMap((item) => item.promotedToCaptureId ? [item.promotedToCaptureId] : [])
  ]);
  const captures = store.listCaptures().filter((capture) => captureIds.has(capture.id));

  const steps: EvidenceReplayProofStep[] = [
    {
      stage: "discovery",
      id: discovery[0]?.id ?? "missing_discovery",
      ok: discovery.length > 0,
      detail: discovery.length > 0 ? `${discovery.length} discovery evidence row(s)` : "No discovery evidence for query."
    },
    {
      stage: "capture",
      id: captures[0]?.id ?? "missing_capture",
      ok: captures.length > 0,
      detail: captures.length > 0 ? `${captures.length} capture row(s) linked to query.` : "No promoted capture for query."
    },
    {
      stage: "extraction",
      id: firstSubjectId(allDeltas, "extraction") ?? "missing_extraction",
      cursor: firstCursor(allDeltas, "extraction"),
      ok: allDeltas.some((delta) => delta.subjectType === "extraction"),
      detail: "Extraction delta is required to prove parser output reached durable polling."
    },
    {
      stage: "relationship_delta",
      id: firstSubjectId(allDeltas, "relationship") ?? "missing_relationship_delta",
      cursor: firstCursor(allDeltas, "relationship"),
      ok: allDeltas.some((delta) => delta.subjectType === "relationship"),
      detail: "Relationship delta is required before graph/API promotion."
    },
    {
      stage: "api_cursor",
      id: snapshots[0]?.id ?? "missing_snapshot",
      cursor: deltas.at(-1)?.cursor ?? allDeltas.at(-1)?.cursor,
      ok: deltas.length > 0 || snapshots.length > 0,
      detail: deltas.length > 0 ? `${deltas.length} delta(s) available after cursor.` : `${snapshots.length} snapshot(s) available for query.`
    }
  ];

  return {
    query,
    normalizedQuery,
    tenantId: options.tenantId,
    runId: options.runId,
    startedCursor: options.sinceCursor,
    nextCursor: deltas.at(-1)?.cursor ?? allDeltas.at(-1)?.cursor,
    steps,
    replayable: steps.every((step) => step.ok)
  };
}

export function buildEvidenceCutoverRehearsalReport(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  query: string,
  options: { tenantId?: string; runId?: string; sinceCursor?: string; generatedAt?: string; rollbackNotes?: string[] } = {}
): EvidenceCutoverRehearsalReport {
  const generatedAt = options.generatedAt ?? nowIso();
  const normalizedQuery = normalizeQuery(query);
  const discovery = store.listDiscoveryEvidence()
    .filter((item) => item.normalizedQuery === normalizedQuery)
    .filter((item) => !options.tenantId || item.tenantId === options.tenantId);
  const snapshots = store.queries().liveSnapshotsByQuery(query, { tenantId: options.tenantId });
  const deltas = store.queries().getEvidenceTimeline(query, { tenantId: options.tenantId });
  const deltaCaptureIds = new Set(deltas.flatMap((delta) => delta.captureIds));
  const discoveryCaptureIds = new Set(discovery.flatMap((item) => item.promotedToCaptureId ? [item.promotedToCaptureId] : []));
  const captures = store.listCaptures()
    .filter((capture) => !options.tenantId || capture.tenantId === options.tenantId)
    .filter((capture) =>
      deltaCaptureIds.has(capture.id)
      || discoveryCaptureIds.has(capture.id)
      || evidenceMetadataValue(capture.metadata, "normalizedQuery") === normalizedQuery
    );
  const replay = buildEvidenceReplayProof(store, query, options);
  const objectIntegrity = buildEvidenceBackupIntegrityReport(store, objects, {
    tenantId: options.tenantId,
    generatedAt,
    rollbackNotes: options.rollbackNotes,
    captureIds: captures.map((capture) => capture.id),
    discoveryIds: discovery.map((item) => item.id)
  });
  const staleSnapshots = store.queries().pruneStaleSnapshots(generatedAt, { tenantId: options.tenantId })
    .filter((snapshot) => snapshot.normalizedQuery === normalizedQuery);
  const metadataOnlyCaptureIds = captures
    .filter((capture) => capture.storageKind === "metadata_only" || capture.redaction?.applied)
    .map((capture) => capture.id);
  const restrictedCaptureIds = captures
    .filter((capture) => capture.sensitive || capture.sensitivityFlags?.some(isRestrictedFlag))
    .map((capture) => capture.id);
  const unsafeBodyCaptureIds = captures
    .filter((capture) => (capture.sensitive || capture.sensitivityFlags?.some(isRestrictedFlag)) && Boolean(capture.body))
    .map((capture) => capture.id);
  const expiredDeltaIds = deltas.filter((delta) => delta.kind === "expired").map((delta) => delta.id);
  const relationshipDeltaIds = deltas.filter((delta) => delta.subjectType === "relationship").map((delta) => delta.id);
  const exportBlockers = [
    ...deltas
      .filter((delta) => delta.kind === "blocked" || delta.kind === "contradicted" || delta.kind === "downgraded")
      .map((delta) => ({ id: delta.id, reason: `delta_${delta.kind}` })),
    ...objectIntegrity.missingObjectIds.map((id) => ({ id, reason: "missing_object" })),
    ...objectIntegrity.orphanRows.map((row) => ({ id: row.id, reason: row.reason })),
    ...unsafeBodyCaptureIds.map((id) => ({ id, reason: "restricted_metadata_body_present" }))
  ];
  const capturesWithoutDiscovery = captures
    .filter((capture) => ![...discoveryCaptureIds].includes(capture.id))
    .map((capture) => capture.id);
  const promotedDiscovery = discovery.filter((item) => item.promotedToCaptureId || item.promotedToIncidentId).length;
  const gateBlockers = [
    ...(!replay.replayable ? ["cursor_replay_incomplete"] : []),
    ...(objectIntegrity.missingObjectIds.length > 0 ? ["missing_objects"] : []),
    ...(objectIntegrity.hashMismatches.length > 0 ? ["hash_mismatch"] : []),
    ...(objectIntegrity.orphanRows.length > 0 ? ["orphan_rows"] : []),
    ...(unsafeBodyCaptureIds.length > 0 ? ["restricted_metadata_body_present"] : []),
    ...(staleSnapshots.length > 0 ? ["stale_snapshot_rebuild"] : []),
    ...(exportBlockers.length > 0 ? ["export_blockers"] : [])
  ];
  const overall = gateStatus(gateBlockers);

  return {
    tenantId: options.tenantId,
    query,
    normalizedQuery,
    generatedAt,
    readiness: {
      agent09: replay.replayable && staleSnapshots.length === 0 ? "ready" : "hold",
      agent10: objectIntegrity.missingObjectIds.length === 0 && objectIntegrity.hashMismatches.length === 0 && objectIntegrity.orphanRows.length === 0 ? "ready" : "blocked",
      overall
    },
    counts: {
      discoveryEvidence: discovery.length,
      captures: captures.length,
      snapshots: snapshots.length,
      deltas: deltas.length,
      missingObjects: objectIntegrity.missingObjectIds.length,
      orphanRows: objectIntegrity.orphanRows.length,
      redactedCaptures: metadataOnlyCaptureIds.length,
      expiredDeltas: expiredDeltaIds.length,
      exportBlockers: exportBlockers.length,
      staleSnapshots: staleSnapshots.length
    },
    reconciliation: {
      promotedDiscovery,
      unpromotedDiscovery: discovery.length - promotedDiscovery,
      capturesWithoutDiscovery,
      relationshipDeltaIds
    },
    objectIntegrity,
    cursorReplay: replay,
    retentionState: {
      expiryCounts: objectIntegrity.retentionExpiryCounts,
      legalHoldCount: captures.filter((capture) => capture.legalHold || capture.retentionClass === "legal_hold").length,
      expiredDeltaIds
    },
    redactionState: {
      metadataOnlyCaptureIds,
      restrictedCaptureIds,
      unsafeBodyCaptureIds
    },
    exportBlockers,
    promotionGate: {
      gate: overall,
      blockers: [...new Set(gateBlockers)],
      agent09Fields: {
        cursorReplayReady: replay.replayable,
        nextCursor: replay.nextCursor,
        staleSnapshots: staleSnapshots.length,
        newEvidenceCount: store.queries().getSearchDeltas(query, options.sinceCursor, { tenantId: options.tenantId }).length
      },
      agent10Fields: {
        objectIntegrityReady: objectIntegrity.missingObjectIds.length === 0 && objectIntegrity.hashMismatches.length === 0,
        backupVerifiedObjects: objectIntegrity.verifiedObjectCount,
        missingObjectCount: objectIntegrity.missingObjectIds.length,
        rollbackNotes: objectIntegrity.rollbackNotes
      }
    }
  };
}

export function buildEvidenceTrustLedgerReport(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  query: string,
  options: { tenantId?: string; runId?: string; sinceCursor?: string; generatedAt?: string; minTrustedConfidence?: number } = {}
): EvidenceTrustLedgerReport {
  const cutover = buildEvidenceCutoverRehearsalReport(store, objects, query, options);
  const replay = cutover.cursorReplay;
  const minTrustedConfidence = options.minTrustedConfidence ?? 0.65;
  const captures = new Map(store.listCaptures()
    .filter((capture) => !options.tenantId || capture.tenantId === options.tenantId)
    .map((capture) => [capture.id, capture]));
  const missingObjects = new Set(cutover.objectIntegrity.missingObjectIds);
  const hashMismatches = new Set(cutover.objectIntegrity.hashMismatches.map((item) => item.captureId));
  const unsafeRestrictedBodies = new Set(cutover.redactionState.unsafeBodyCaptureIds);
  const deltas = store.queries().getEvidenceTimeline(query, { tenantId: options.tenantId });
  const sinceDeltas = store.queries().getSearchDeltas(query, options.sinceCursor, { tenantId: options.tenantId });
  const deduped = dedupeClaimChains(store.queries().provenanceForClaim({ tenantId: options.tenantId, actor: query }));
  const claims = deduped.claims.map((chain): EvidenceTrustLedgerClaim => {
    const capture = captures.get(chain.captureId);
    const confidence = typeof chain.confidence === "number" && Number.isFinite(chain.confidence) ? chain.confidence : 0;
    const confidencePresent = typeof chain.confidence === "number" && Number.isFinite(chain.confidence);
    const relationshipIds = deltas
      .filter((delta) => delta.captureIds.includes(chain.captureId) || (chain.incidentId ? delta.incidentIds.includes(chain.incidentId) : false))
      .flatMap((delta) => delta.relationshipIds);
    const latestReplay = store.queries().replayStatus({ tenantId: options.tenantId, captureId: chain.captureId })[0];
    const blockers = [
      ...(!capture ? ["missing_capture"] : []),
      ...(!chain.sourceId ? ["missing_source"] : []),
      ...(!chain.contentHash ? ["missing_content_hash"] : []),
      ...(!chain.extractorVersion ? ["missing_extractor_version"] : []),
      ...(!confidencePresent ? ["missing_confidence"] : []),
      ...(confidence < minTrustedConfidence ? ["low_confidence"] : []),
      ...(capture?.storageKind === "metadata_only" ? ["metadata_only_claim"] : []),
      ...(capture?.metadata.sourceStatus === "retired" || capture?.metadata.sourceDeleted === true ? ["source_retired_or_deleted"] : []),
      ...(latestReplay?.status === "succeeded" && latestReplay.toExtractorVersion !== chain.extractorVersion ? ["stale_extractor_replay_available"] : []),
      ...(missingObjects.has(chain.captureId) ? ["missing_object"] : []),
      ...(hashMismatches.has(chain.captureId) ? ["hash_mismatch"] : []),
      ...(unsafeRestrictedBodies.has(chain.captureId) ? ["restricted_body_present"] : []),
      ...(!replay.replayable ? ["cursor_replay_incomplete"] : [])
    ];
    return {
      claimId: chain.incidentId ?? chain.captureId,
      ledgerIds: ledgerIdsForClaim(capture?.metadata, chain),
      captureId: chain.captureId,
      sourceId: chain.sourceId,
      url: chain.url,
      collectedAt: chain.collectedAt,
      contentHash: chain.contentHash,
      extractorVersion: chain.extractorVersion,
      evidenceStage: stringMetadata(capture?.metadata.evidenceStage) ?? stringMetadata(capture?.metadata.provenance, "evidenceStage"),
      confidence,
      graphRelationshipIds: [...new Set(relationshipIds)],
      reviewState: stringMetadata(capture?.metadata.graphReviewState) ?? stringMetadata(capture?.metadata.reviewState),
      retentionClass: capture?.retentionClass,
      redaction: {
        policy: capture?.redaction?.policy,
        applied: capture?.redaction?.applied === true,
        metadataOnly: capture?.storageKind === "metadata_only",
        legalHold: capture?.legalHold === true || capture?.retentionClass === "legal_hold"
      },
      trustStatus: claimTrustStatus(blockers),
      blockers: [...new Set(blockers)],
      claimValues: chain.claimValues,
      replay: {
        replayable: replay.replayable,
        nextCursor: replay.nextCursor
      },
      provenance: {
        sourcePresent: Boolean(chain.sourceId),
        capturePresent: Boolean(capture),
        contentHashPresent: Boolean(chain.contentHash),
        extractorVersionPresent: Boolean(chain.extractorVersion),
        confidencePresent
      }
    };
  });
  const reportBlockers = [
    ...cutover.promotionGate.blockers,
    ...(claims.length === 0 ? ["no_claim_provenance"] : []),
    ...claims.flatMap((claim) => claim.trustStatus === "blocked" ? claim.blockers : [])
  ];
  const trustGate = trustGateStatus(reportBlockers, claims);

  return {
    tenantId: options.tenantId,
    query,
    normalizedQuery: cutover.normalizedQuery,
    generatedAt: options.generatedAt ?? cutover.generatedAt,
    readiness: cutover.readiness,
    trustGate,
    blockers: [...new Set(reportBlockers)],
    counts: {
      claims: claims.length,
      trusted: claims.filter((claim) => claim.trustStatus === "trusted").length,
      degraded: claims.filter((claim) => claim.trustStatus === "degraded").length,
      blocked: claims.filter((claim) => claim.trustStatus === "blocked").length,
      metadataOnlyClaims: claims.filter((claim) => claim.blockers.includes("metadata_only_claim")).length,
      duplicateClaimsSuppressed: deduped.duplicatesSuppressed,
      replayable: replay.replayable
    },
    changesSinceCursor: {
      sinceCursor: options.sinceCursor,
      nextCursor: replay.nextCursor,
      added: sinceDeltas.filter((delta) => delta.kind === "added").length,
      promoted: sinceDeltas.filter((delta) => delta.kind === "promoted").length,
      downgraded: sinceDeltas.filter((delta) => delta.kind === "downgraded").length,
      expired: sinceDeltas.filter((delta) => delta.kind === "expired").length,
      redacted: sinceDeltas.filter((delta) => delta.kind === "redacted").length,
      blocked: sinceDeltas.filter((delta) => delta.kind === "blocked").length,
      contradicted: sinceDeltas.filter((delta) => delta.kind === "contradicted").length,
      reviewRequired: sinceDeltas.filter((delta) => delta.metadata.reviewRequired === true || delta.metadata.reviewState === "needs-human-review").length,
      missingObjectCaptureIds: cutover.objectIntegrity.missingObjectIds,
      graphExportHeldRelationshipIds: cutover.exportBlockers
        .filter((blocker) => blocker.reason.startsWith("delta_"))
        .flatMap((blocker) => deltas.find((delta) => delta.id === blocker.id)?.relationshipIds ?? [])
    },
    claims,
    cutover: {
      promotionGate: cutover.promotionGate,
      objectIntegrity: cutover.objectIntegrity,
      redactionState: cutover.redactionState
    },
    safeOutput: {
      sensitiveBodiesExposed: false,
      objectKeysExposed: false,
      unsafeRestrictedMetadataExposed: false
    }
  };
}

function firstSubjectId(deltas: EvidenceDelta[], subjectType: EvidenceDelta["subjectType"]): string | undefined {
  return deltas.find((delta) => delta.subjectType === subjectType)?.subjectId;
}

function firstCursor(deltas: EvidenceDelta[], subjectType: EvidenceDelta["subjectType"]): string | undefined {
  return deltas.find((delta) => delta.subjectType === subjectType)?.cursor;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function evidenceMetadataValue(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

function isRestrictedFlag(flag: string): boolean {
  return flag === "sensitive_source" || flag === "leak_metadata" || flag === "credential_material" || flag === "restricted_protocol";
}

function gateStatus(blockers: string[]): EvidenceCutoverGateStatus {
  if (blockers.some((blocker) => blocker === "missing_objects" || blocker === "hash_mismatch" || blocker === "restricted_metadata_body_present")) {
    return "blocked";
  }
  return blockers.length > 0 ? "hold" : "ready";
}

function dedupeClaimChains(chains: ReturnType<EvidenceQueryHelpers["provenanceForClaim"]>): {
  claims: ReturnType<EvidenceQueryHelpers["provenanceForClaim"]>;
  duplicatesSuppressed: number;
} {
  const byKey = new Map<string, ReturnType<EvidenceQueryHelpers["provenanceForClaim"]>[number]>();
  for (const chain of chains) {
    const key = `${chain.contentHash}:${chain.claimValues.map((value) => value.toLowerCase()).sort().join("|")}`;
    const previous = byKey.get(key);
    const confidence = typeof chain.confidence === "number" ? chain.confidence : 0;
    const previousConfidence = typeof previous?.confidence === "number" ? previous.confidence : 0;
    if (!previous || confidence > previousConfidence) byKey.set(key, chain);
  }
  return { claims: [...byKey.values()], duplicatesSuppressed: chains.length - byKey.size };
}

function stringMetadata(metadata: unknown, key?: string): string | undefined {
  const value = key && metadata && typeof metadata === "object"
    ? (metadata as Record<string, unknown>)[key]
    : metadata;
  return typeof value === "string" && value.trim() ? value : undefined;
}

function ledgerIdsForClaim(
  metadata: Record<string, unknown> | undefined,
  chain: ReturnType<EvidenceQueryHelpers["provenanceForClaim"]>[number]
): string[] {
  const values = [
    ...stringArrayMetadata(metadata?.evidenceLedgerIds),
    ...stringArrayMetadata(metadata?.ledgerIds),
    ...stringArrayMetadata(metadata?.trustLedgerIds),
    ...singleMetadata(metadata?.evidenceLedgerId),
    ...singleMetadata(metadata?.ledgerId),
    ...singleMetadata(metadata?.trustLedgerId)
  ];
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return unique.length > 0 ? unique : [stableId("ledger", `${chain.incidentId ?? chain.captureId}:${chain.contentHash}`)];
}

function stringArrayMetadata(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function singleMetadata(value: unknown): string[] {
  return typeof value === "string" && value.trim() ? [value] : [];
}

function claimTrustStatus(blockers: string[]): EvidenceTrustLedgerClaim["trustStatus"] {
  if (blockers.some((blocker) => blocker === "missing_capture" || blocker === "missing_object" || blocker === "hash_mismatch" || blocker === "restricted_body_present")) {
    return "blocked";
  }
  return blockers.length > 0 ? "degraded" : "trusted";
}

function trustGateStatus(blockers: string[], claims: EvidenceTrustLedgerClaim[]): EvidenceCutoverGateStatus {
  if (claims.some((claim) => claim.trustStatus === "blocked")) return "blocked";
  if (blockers.some((blocker) => blocker === "missing_objects" || blocker === "hash_mismatch" || blocker === "restricted_metadata_body_present")) return "blocked";
  return blockers.length > 0 || claims.some((claim) => claim.trustStatus === "degraded") ? "hold" : "ready";
}
