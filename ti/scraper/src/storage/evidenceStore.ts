import type {
  AnalystClaimLedgerEntry,
  AnalystLoopSnapshot,
  AnalystMetadataReviewTask,
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
  RetentionClass,
  SourceRecord
} from "../types.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";

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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
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

export interface ObjectEvidenceManifestEntry {
  captureId: string;
  tenantId?: string;
  sourceId: string;
  mediaType: string;
  retentionClass: RetentionClass;
  contentHash: string;
  objectRefHash: string;
  sizeBytes: number;
  sha256: string;
  present: boolean;
  hashMatches: boolean;
}

export interface ObjectEvidenceManifest {
  schemaVersion: "ti.object_evidence_manifest.v1";
  generatedAt: string;
  tenantId?: string;
  entryCount: number;
  presentCount: number;
  missingCount: number;
  hashMismatchCount: number;
  entries: ObjectEvidenceManifestEntry[];
  safeOutput: {
    objectKeysExposed: false;
    rawBodiesExposed: false;
    unsafeRestrictedMetadataExposed: false;
  };
}

export interface ObjectEvidenceManifestVerification {
  schemaVersion: "ti.object_evidence_manifest_verification.v1";
  generatedAt: string;
  tenantId?: string;
  expectedCount: number;
  verifiedCount: number;
  missingObjectCaptureIds: string[];
  hashMismatchCaptureIds: string[];
  unexpectedObjectCaptureIds: string[];
  safeToRestore: boolean;
  safeOutput: ObjectEvidenceManifest["safeOutput"];
}

export interface EvidenceBackendParityInput {
  name: string;
  store: CaptureMetadataStore;
  objects?: ObjectEvidenceStore;
}

export interface EvidenceBackendReadModelSnapshot {
  name: string;
  captureIds: string[];
  discoveryEvidenceIds: string[];
  deltaCursors: string[];
  liveSnapshotIds: string[];
  replayable: boolean;
  nextCursor?: string;
  objectManifestEntryCount: number;
  objectManifestSafeToRestore: boolean;
  unsafeRestrictedBodyCount: number;
}

export interface EvidenceBackendParityReport {
  schemaVersion: "ti.evidence_backend_parity_report.v1";
  generatedAt: string;
  query: string;
  normalizedQuery: string;
  tenantId?: string;
  baselineBackend: string;
  backends: EvidenceBackendReadModelSnapshot[];
  parity: {
    capturesMatch: boolean;
    discoveryEvidenceMatch: boolean;
    deltasMatch: boolean;
    liveSnapshotsMatch: boolean;
    cursorReplayMatch: boolean;
    objectManifestsSafe: boolean;
    noUnsafeRestrictedBodies: boolean;
    matchesBaseline: boolean;
  };
  mismatches: Array<{ backend: string; field: string; expected: unknown; actual: unknown }>;
  apiCutoverReady: boolean;
  safeOutput: {
    rawBodiesExposed: false;
    objectReferencesExposed: false;
    restrictedMaterialExposed: false;
  };
}

export interface EvidenceDisasterRecoveryManifest {
  schemaVersion: "ti.evidence_disaster_recovery_manifest.v1";
  generatedAt: string;
  tenantId?: string;
  query: string;
  normalizedQuery: string;
  pointInTime: {
    restoreAt: string;
    captureCount: number;
    deltaCount: number;
    claimLedgerEntryCount: number;
    analystReviewTaskCount: number;
    apiSnapshotCount: number;
  };
  replayInputs: Array<{
    captureId: string;
    sourceId: string;
    storageKind: RawCapture["storageKind"];
    contentHash: string;
    normalizedTextHash?: string;
    extractorVersion: string;
    bodyAvailable: boolean;
    objectBacked: boolean;
    metadataOnly: boolean;
    retentionClass: RetentionClass;
    legalHold: boolean;
    redactionApplied: boolean;
  }>;
  objectManifest: ObjectEvidenceManifest;
  objectVerification: ObjectEvidenceManifestVerification;
  retention: {
    byClass: Partial<Record<RetentionClass, number>>;
    legalHoldCaptureIds: string[];
    expiredDeltaIds: string[];
    redactionRepairCaptureIds: string[];
  };
  claimLedger: {
    entryIds: string[];
    trustedEntryIds: string[];
    heldEntryIds: string[];
    contradictedEntryIds: string[];
    duplicateEntryIds: string[];
    legalHoldEntryIds: string[];
    graphEligibleEntryIds: string[];
    stixEligibleEntryIds: string[];
  };
  analystReview: {
    taskIds: string[];
    snapshotIds: string[];
    states: string[];
  };
  graphPromotion: {
    relationshipIds: string[];
    heldRelationshipIds: string[];
    promotedRelationshipIds: string[];
  };
  apiReadModels: {
    liveSnapshotIds: string[];
    nextCursor?: string;
    replayable: boolean;
  };
  restorePlan: Array<{
    order: number;
    step: "objects" | "captures" | "discovery" | "deltas" | "claim_ledger" | "analyst_review" | "api_read_models" | "graph_promotion";
    rowCount: number;
    ready: boolean;
    reason: string;
  }>;
  restoreReady: boolean;
  blockers: string[];
  safeOutput: {
    rawBodiesExposed: false;
    objectKeysExposed: false;
    restrictedMaterialExposed: false;
    credentialsExposed: false;
  };
}

interface AnalystWorkflowReadStore {
  listAnalystClaimLedgerEntries(): AnalystClaimLedgerEntry[];
  listAnalystMetadataReviewTasks(): AnalystMetadataReviewTask[];
  listAnalystLoopSnapshots(): AnalystLoopSnapshot[];
}

interface SourceReadStore {
  getSource(id: string): SourceRecord | undefined;
  listSources(): SourceRecord[];
}

export type EvidenceSearchIndexDocumentKind =
  | "capture"
  | "evidence_delta"
  | "claim"
  | "graph_relationship"
  | "source";

export interface EvidenceSearchIndexDocument {
  schemaVersion: "ti.evidence_search_index_document.v1";
  documentId: string;
  kind: EvidenceSearchIndexDocumentKind;
  tenantId?: string;
  sourceId?: string;
  captureId?: string;
  claimLedgerEntryId?: string;
  relationshipId?: string;
  query?: string;
  normalizedQuery?: string;
  title: string;
  summary: string;
  searchText: string;
  tags: string[];
  freshness: {
    observedAt?: string;
    collectedAt?: string;
    publishedAt?: string;
    cursor?: string;
  };
  confidence?: number;
  replay: {
    replayId: string;
    captureId?: string;
    deltaId?: string;
    cursor?: string;
    contentHash?: string;
    normalizedTextHash?: string;
    extractorVersion?: string;
  };
  citationSpans: Array<{
    label: string;
    captureId?: string;
    sourceId?: string;
    contentHash?: string;
    start?: number;
    end?: number;
  }>;
  embedding: {
    eligible: boolean;
    reason: "public_text" | "metadata_summary_only" | "restricted_metadata_excluded" | "no_text" | "policy_hold";
    inputTextHash?: string;
    modelBoundary: "external_vector_backend";
  };
  redaction: {
    metadataOnly: boolean;
    restricted: boolean;
    legalHold: boolean;
    retentionClass?: RetentionClass;
    rawBodyIncluded: false;
    objectKeyIncluded: false;
    unsafeUrlIncluded: false;
  };
  backendHints: {
    openSearchIndex: "ti-evidence-v1";
    vectorNamespace: "ti-evidence";
    routingKey: string;
  };
}

export interface EvidenceSearchIndexHandoff {
  schemaVersion: "ti.evidence_search_index_handoff.v1";
  generatedAt: string;
  tenantId?: string;
  query: string;
  normalizedQuery: string;
  documents: EvidenceSearchIndexDocument[];
  counts: {
    total: number;
    captures: number;
    deltas: number;
    claims: number;
    graphRelationships: number;
    sources: number;
    embeddingEligible: number;
    restrictedMetadataExcludedFromEmbedding: number;
  };
  backendContract: {
    vendorNeutral: true;
    openSearchCompatible: true;
    vectorCompatible: true;
    tenantScopedRouting: true;
    replayIdRequired: true;
    citationSpansRequired: true;
  };
  safeOutput: {
    rawBodiesExposed: false;
    objectKeysExposed: false;
    restrictedMaterialExposed: false;
    credentialsExposed: false;
    unsafeUrlsExposed: false;
  };
}

export interface EvidenceIndexReplayMigrationReport {
  schemaVersion: "ti.evidence_index_replay_migration.v1";
  generatedAt: string;
  migrationId: string;
  tenantId?: string;
  query: string;
  normalizedQuery: string;
  targetBackends: {
    openSearchIndex: "ti-evidence-v1";
    vectorNamespace: "ti-evidence";
    postgresCursorSource: "evidence_delta_cursor";
    objectStoreRequired: true;
    aliasCutover: "blue_green_alias_swap";
  };
  replayInputs: {
    custodyChainId: string;
    handoffDocumentCount: number;
    replayableDocumentCount: number;
    embeddingEligibleDocumentCount: number;
    restrictedMetadataDocumentCount: number;
    metadataOnlyDocumentCount: number;
    objectManifestEntryCount: number;
    verifiedObjectCount: number;
    checksum: string;
  };
  plan: Array<{
    order: number;
    step:
      | "source_registry_backfill"
      | "object_manifest_verify"
      | "capture_index_rebuild"
      | "extraction_index_replay"
      | "claim_ledger_replay"
      | "graph_relationship_replay"
      | "opensearch_bulk_commit"
      | "vector_upsert_commit"
      | "api_answer_refresh"
      | "stix_preview_gate";
    rowCount: number;
    ready: boolean;
    reason: string;
    rollbackAction: string;
  }>;
  validation: {
    status: EvidenceCutoverGateStatus;
    blockers: string[];
    warnings: string[];
    checks: {
      objectRefsVerified: boolean;
      hashChecksumsMatch: boolean;
      cursorReplayComplete: boolean;
      parserVersionsCurrent: boolean;
      redactionSafe: boolean;
      restrictedMetadataHeldFromEmbedding: boolean;
      retentionClassPreserved: boolean;
      graphRelationshipsConsistent: boolean;
      apiAnswersConsistent: boolean;
      stixExportReviewed: boolean;
      rollbackReady: boolean;
    };
  };
  consistency: {
    evidenceDocuments: number;
    sourceRegistryDocuments: number;
    captureDocuments: number;
    extractionDocuments: number;
    claimLedgerDocuments: number;
    graphRelationshipDocuments: number;
    apiSearchAnswerStages: number;
    stixPreviewStages: number;
    missingObjectCaptureIds: string[];
    hashMismatchCaptureIds: string[];
    parserDriftCaptureIds: string[];
    exportWithoutReviewIds: string[];
    restrictedMetadataHoldDocumentIds: string[];
  };
  rollback: {
    checkpointId: string;
    reversible: boolean;
    actions: string[];
    publicApiFallback: "serve_previous_index_or_partial_answer";
  };
  handoffs: {
    agent01SourceSlo: string;
    agent02QueueReplay: string;
    agent07QualityGates: string;
    agent08GraphDrift: string;
    agent09ApiSdkFields: string;
    agent10ReleaseArtifacts: string;
  };
  safeOutput: {
    rawBodiesExposed: false;
    objectKeysExposed: false;
    unsafeUrlsExposed: false;
    credentialsExposed: false;
    restrictedMaterialExposed: false;
    actorInteractionExposed: false;
  };
}

export type EvidenceChainStageKind =
  | "source_registry_event"
  | "scheduled_run"
  | "raw_capture"
  | "object_ref"
  | "extraction"
  | "claim_ledger"
  | "graph_relationship"
  | "api_search_answer"
  | "stix_export_preview";

export interface EvidenceChainStage {
  stage: EvidenceChainStageKind;
  id: string;
  tenantId?: string;
  sourceId?: string;
  captureId?: string;
  runId?: string;
  claimLedgerEntryId?: string;
  relationshipId?: string;
  observedAt?: string;
  contentHash?: string;
  objectRefHash?: string;
  parserVersion?: string;
  confidence?: number;
  retentionClass?: RetentionClass;
  reviewState?: string;
  redaction: {
    metadataOnly: boolean;
    restricted: boolean;
    legalHold: boolean;
    rawBodyIncluded: false;
    objectKeyIncluded: false;
    unsafeUrlIncluded: false;
  };
  replay: {
    replayId: string;
    cursor?: string;
    replayable: boolean;
  };
  links: {
    previousStageIds: string[];
    nextStageIds: string[];
  };
}

export interface EvidenceSearchBackendMigrationReadinessReport {
  schemaVersion: "ti.evidence_search_backend_migration_readiness.v1";
  generatedAt: string;
  readinessId: string;
  tenantId?: string;
  query: string;
  normalizedQuery: string;
  summary: {
    status: EvidenceCutoverGateStatus;
    openSearchReady: boolean;
    pgvectorReady: boolean;
    aliasCutoverReady: boolean;
    deletionReplayReady: boolean;
    rollbackReady: boolean;
  };
  backends: {
    openSearch: {
      candidateIndex: string;
      readAlias: string;
      writeAlias: string;
      routingKeyCount: number;
      documentCount: number;
      bulkCheckpointId: string;
      ready: boolean;
    };
    pgvector: {
      namespace: string;
      candidateTable: string;
      embeddingEligibleCount: number;
      excludedRestrictedCount: number;
      inputHashOnly: boolean;
      ready: boolean;
    };
    postgres: {
      cursorSource: "evidence_delta_cursor";
      replayCheckpointId: string;
      retentionClassCount: number;
      legalHoldCount: number;
      ready: boolean;
    };
  };
  checkpoints: Array<{
    order: number;
    checkpoint: "snapshot_source" | "bulk_index" | "vector_upsert" | "delete_replay" | "alias_swap" | "api_refresh" | "rollback";
    cursor?: string;
    rowCount: number;
    ready: boolean;
    rollbackAction: string;
  }>;
  policy: {
    redactionSafe: boolean;
    legalHoldPreserved: boolean;
    restrictedMetadataSearchable: boolean;
    restrictedMetadataEmbedded: false;
    deletionReplayMode: "tombstone_then_delete_object";
    metadataOnlyRestrictedMode: "index_safe_metadata_only";
  };
  fixtures: Array<{
    name: "clean_cutover" | "missing_object" | "hash_mismatch" | "restricted_metadata" | "legal_hold" | "redaction_delete" | "rollback_alias";
    expectedState: EvidenceCutoverGateStatus;
    proof: string;
    safeOutput: true;
  }>;
  blockers: string[];
  warnings: string[];
  handoffs: {
    agent02ReplayDebt: string;
    agent07AnswerQuality: string;
    agent08GraphStix: string;
    agent09ApiContract: string;
    agent10ReleaseRollback: string;
  };
  safeOutput: {
    rawBodiesExposed: false;
    objectKeysExposed: false;
    unsafeUrlsExposed: false;
    credentialsExposed: false;
    restrictedRawContentExposed: false;
    actorInteractionExposed: false;
  };
}

export interface EvidenceReplayBenchmarkReport {
  schemaVersion: "ti.evidence_replay_benchmark.v1";
  generatedAt: string;
  benchmarkId: string;
  tenantId?: string;
  query: string;
  normalizedQuery: string;
  summary: {
    status: EvidenceCutoverGateStatus;
    simulatedCaptureMetadataRecords: number;
    chunks: number;
    chunkSize: number;
    replayable: boolean;
    publicAnswerRebuild: "ready" | "partial" | "hold";
    graphRebuild: "ready" | "hold" | "blocked";
    stixRebuild: "ready" | "hold" | "blocked";
  };
  scaleModel: {
    simulatedCaptureMetadataRecords: number;
    chunkSize: number;
    chunkCount: number;
    sourceRowsEstimated: number;
    extractionRowsEstimated: number;
    relationshipRowsEstimated: number;
    claimRowsEstimated: number;
    restrictedMetadataRowsEstimated: number;
    metadataOnlyRowsIndexed: true;
    restrictedRowsEmbedded: false;
    objectBackedCaptureRatio: number;
    replayCursorCheckpointEveryRows: number;
  };
  throughput: {
    captureMetadataRowsPerSecond: number;
    extractionDeltaRowsPerSecond: number;
    searchDocumentsPerSecond: number;
    graphRelationshipsPerSecond: number;
    stixDescriptorsPerSecond: number;
  };
  latencyBudget: {
    publicAnswerInitialP95Ms: number;
    publicAnswerFullRefreshP95Ms: number;
    metadataReplayP95Ms: number;
    searchRebuildP95Ms: number;
    graphRebuildP95Ms: number;
    stixPreviewP95Ms: number;
  };
  rebuildBehavior: {
    replayCheckpointId: string;
    searchIndexAlias: "blue_green_alias_swap";
    publicAnswer: {
      state: "ready" | "partial" | "hold";
      expectedUsefulAnswerRate: number;
      expectedFactRecall: number;
      sourceEvidenceRequired: true;
      restrictedMetadataCanSupportDefensiveFacts: true;
    };
    graph: {
      state: "ready" | "hold" | "blocked";
      relationshipDeltaReplay: true;
      reviewHoldsRespected: true;
      estimatedRelationshipDeltas: number;
    };
    stix: {
      state: "ready" | "hold" | "blocked";
      descriptorOnlyRestrictedMetadata: true;
      reviewedExportRequired: true;
      estimatedDescriptors: number;
    };
  };
  safety: {
    restrictedMetadataSearchable: true;
    restrictedMetadataEmbedded: false;
    rawBodiesLoadedDuringBenchmark: false;
    rawBodiesExposed: false;
    objectKeysExposed: false;
    unsafeUrlsExposed: false;
    credentialsExposed: false;
    restrictedRawContentExposed: false;
    actorInteractionExposed: false;
  };
  fixtures: Array<{
    name:
      | "one_million_public_metadata"
      | "restricted_metadata_60k"
      | "mixed_tenant_10k_sources"
      | "missing_object_replay_hold"
      | "legal_hold_deletion_replay"
      | "cursor_gap_resume"
      | "graph_stix_rebuild";
    records: number;
    expectedState: EvidenceCutoverGateStatus;
    proof: string;
    safeOutput: true;
  }>;
  blockers: string[];
  warnings: string[];
  handoffs: {
    agent02ReplayPartition: string;
    agent05RestrictedMetadataIndex: string;
    agent07MeasuredQuality: string;
    agent08GraphStixReplay: string;
    agent09ApiPolling: string;
    agent10SoakDecision: string;
  };
  safeOutput: {
    rawBodiesExposed: false;
    objectKeysExposed: false;
    unsafeUrlsExposed: false;
    credentialsExposed: false;
    restrictedRawContentExposed: false;
    actorInteractionExposed: false;
  };
}

export interface EvidenceChainOfCustodyReport {
  schemaVersion: "ti.evidence_chain_of_custody.v1";
  generatedAt: string;
  chainId: string;
  tenantId?: string;
  query: string;
  normalizedQuery: string;
  stages: EvidenceChainStage[];
  counts: Record<EvidenceChainStageKind, number> & {
    total: number;
    restrictedMetadataStages: number;
    metadataOnlyStages: number;
    legalHoldStages: number;
  };
  verification: {
    status: EvidenceCutoverGateStatus;
    blockers: string[];
    warnings: string[];
    checks: {
      sourceRegistryEvent: boolean;
      scheduledRun: boolean;
      rawCapture: boolean;
      objectRefsVerified: boolean;
      extraction: boolean;
      claimLedger: boolean;
      graphRelationship: boolean;
      apiSearchAnswer: boolean;
      stixExportReviewed: boolean;
      replayable: boolean;
      redactionSafe: boolean;
      hashChainIntact: boolean;
    };
  };
  handoffs: {
    agent01Governance: string;
    agent02Scheduler: string;
    agent04Correlation: string;
    agent05RestrictedMetadata: string;
    agent07AnswerConfidence: string;
    agent08GraphReview: string;
    agent09ApiSdk: string;
    agent10IncidentRunbooks: string;
  };
  safeOutput: {
    rawBodiesExposed: false;
    objectKeysExposed: false;
    unsafeUrlsExposed: false;
    secretMaterialExposed: false;
    restrictedMaterialExposed: false;
    actorInteractionExposed: false;
  };
}

export type EvidenceRetentionSurfaceKind =
  | "raw_capture"
  | "extracted_text"
  | "object_ref"
  | "search_index"
  | "vector_index"
  | "graph_relationship"
  | "stix_preview"
  | "restricted_metadata"
  | "api_answer";

export interface EvidenceRetentionRuntimeReport {
  schemaVersion: "ti.evidence_retention_runtime_enforcement.v1";
  generatedAt: string;
  enforcementId: string;
  tenantId?: string;
  query: string;
  normalizedQuery: string;
  summary: {
    status: EvidenceCutoverGateStatus;
    publicAnswerRefresh: "allow" | "partial" | "hold";
    graphExportEligibility: "allow" | "hold" | "blocked";
    stixPreviewEligibility: "allow" | "hold" | "blocked";
    rollbackReady: boolean;
  };
  counts: {
    captures: number;
    objectRefs: number;
    indexDocuments: number;
    graphRelationships: number;
    stixPreviews: number;
    legalHoldItems: number;
    redactionRepairItems: number;
    retentionTransitionItems: number;
    blockedItems: number;
  };
  surfaces: Array<{
    surface: EvidenceRetentionSurfaceKind;
    id: string;
    tenantId?: string;
    captureId?: string;
    sourceId?: string;
    relationshipId?: string;
    claimLedgerEntryId?: string;
    documentId?: string;
    retentionClass?: RetentionClass;
    currentAction: "retain" | "delete_body" | "delete_object" | "delete_capture_metadata" | "legal_hold" | "exclude_from_vector" | "hold_export" | "refresh_index";
    effectiveAction: "retain" | "delete_body" | "delete_object" | "delete_capture_metadata" | "legal_hold" | "exclude_from_vector" | "hold_export" | "refresh_index";
    legalHold: boolean;
    redaction: {
      metadataOnly: boolean;
      restricted: boolean;
      repairRequired: boolean;
      rawBodyIncluded: false;
      objectKeyIncluded: false;
      unsafeUrlIncluded: false;
    };
    audit: {
      contentHash?: string;
      objectRefHash?: string;
      replayCheckpointId: string;
      cursor?: string;
      observedAt?: string;
      retentionTransition?: string;
    };
    eligibility: {
      publicAnswer: "allow" | "partial" | "hold";
      graphExport: "allow" | "hold" | "blocked";
      stixPreview: "allow" | "hold" | "blocked";
    };
    blockers: string[];
    rollbackAction: string;
  }>;
  validation: {
    blockers: string[];
    warnings: string[];
    checks: {
      objectManifestVerified: boolean;
      legalHoldPreserved: boolean;
      redactionSafe: boolean;
      replayReady: boolean;
      indexMigrationSafe: boolean;
      restrictedMetadataSearchableNotEmbedded: boolean;
      graphExportHonorsHolds: boolean;
      stixPreviewHonorsHolds: boolean;
      retentionTransitionsAudited: boolean;
    };
  };
  handoffs: {
    agent01Governance: string;
    agent02SchedulerReplay: string;
    agent05RestrictedMetadata: string;
    agent07AnswerRefresh: string;
    agent08GraphExport: string;
    agent09ApiSdk: string;
    agent10RollbackRunbook: string;
  };
  safeOutput: {
    rawBodiesExposed: false;
    objectKeysExposed: false;
    unsafeUrlsExposed: false;
    credentialsExposed: false;
    privateMaterialExposed: false;
    restrictedRawContentExposed: false;
    actorInteractionExposed: false;
  };
}

export interface EvidenceSearchConsistencySloReport {
  schemaVersion: "ti.evidence_search_consistency_slo.v1";
  generatedAt: string;
  sloId: string;
  tenantId?: string;
  query: string;
  normalizedQuery: string;
  summary: {
    status: EvidenceCutoverGateStatus;
    publicAnswerState: "ready" | "partial" | "hold";
    indexRefreshState: "ready" | "partial" | "hold";
    vectorState: "ready" | "search_only" | "hold";
    rollbackReady: boolean;
  };
  latencyBudget: {
    initialPartialP95Ms: 3000;
    cursorReplayP95Ms: 3000;
    indexRefreshP95Ms: 30000;
    vectorUpsertP95Ms: 30000;
    estimatedInitialPartialMs: number;
    estimatedIndexRefreshMs: number;
    estimatedVectorUpsertMs: number;
  };
  counts: {
    documents: number;
    captures: number;
    deltas: number;
    claims: number;
    graphRelationships: number;
    sourceDocuments: number;
    embeddingEligible: number;
    restrictedMetadataDocuments: number;
    metadataOnlyDocuments: number;
    replayableDocuments: number;
    apiAnswerStages: number;
    stixPreviewStages: number;
  };
  consistency: {
    status: EvidenceCutoverGateStatus;
    blockers: string[];
    warnings: string[];
    checks: {
      documentsPresent: boolean;
      deterministicDocumentIds: boolean;
      tenantRoutingPresent: boolean;
      replayIdsPresent: boolean;
      citationSpansPresent: boolean;
      contentHashesPresentForCaptures: boolean;
      objectManifestVerified: boolean;
      cursorReplayComplete: boolean;
      custodyChainReady: boolean;
      retentionRuntimeSafe: boolean;
      restrictedMetadataSearchableNotEmbedded: boolean;
      vectorInputsHashOnly: boolean;
      graphAndStixRespectReviewHolds: boolean;
      apiAnswerRefreshSafe: boolean;
    };
  };
  repairQueue: Array<{
    code: string;
    owner: "Agent 06" | "Agent 07" | "Agent 08" | "Agent 09" | "Agent 10";
    action: string;
    dryRun: true;
    willMutate: false;
    willStartCrawling: false;
  }>;
  handoffs: {
    agent02Scheduler: string;
    agent07Quality: string;
    agent08Graph: string;
    agent09ApiSdk: string;
    agent10Release: string;
  };
  safeOutput: {
    rawBodiesExposed: false;
    objectKeysExposed: false;
    unsafeUrlsExposed: false;
    credentialsExposed: false;
    restrictedRawContentExposed: false;
    actorInteractionExposed: false;
  };
}

export interface EvidenceObjectIntegrityRepairReport {
  schemaVersion: "ti.evidence_object_integrity_repair.v1";
  generatedAt: string;
  repairId: string;
  tenantId?: string;
  query: string;
  normalizedQuery: string;
  summary: {
    status: EvidenceCutoverGateStatus;
    publicAnswerImpact: "none" | "partial" | "hold";
    indexCutoverImpact: "none" | "hold";
    graphExportImpact: "none" | "hold" | "blocked";
    stixExportImpact: "none" | "hold" | "blocked";
    rollbackReady: boolean;
  };
  counts: {
    expectedObjects: number;
    verifiedObjects: number;
    missingObjects: number;
    hashMismatches: number;
    orphanRows: number;
    legalHoldObjects: number;
    metadataOnlyCaptures: number;
    restrictedCaptures: number;
  };
  objectChecks: Array<{
    captureId: string;
    tenantId?: string;
    sourceId: string;
    retentionClass?: RetentionClass;
    legalHold: boolean;
    state: "verified" | "missing" | "hash_mismatch";
    objectRefHash?: string;
    contentHash: string;
    expectedSha256?: string;
    actualSha256?: string;
    replayCheckpointId: string;
    blockers: string[];
    repairAction: "none" | "restore_object_from_backup" | "recompute_manifest_after_restore" | "hold_under_legal_hold";
  }>;
  orphanRows: EvidenceBackupIntegrityReport["orphanRows"];
  operatorRunbook: Array<{
    order: number;
    code: "verify_manifest" | "restore_missing_object" | "quarantine_hash_mismatch" | "replay_indexes" | "refresh_public_answer" | "legal_hold_preserve";
    action: string;
    dryRun: true;
    willMutate: false;
    willStartCrawling: false;
    rollbackAction: string;
  }>;
  validation: {
    blockers: string[];
    warnings: string[];
    checks: {
      manifestComplete: boolean;
      hashesMatch: boolean;
      noObjectKeysExposed: true;
      noRawBodiesExposed: true;
      legalHoldPreserved: boolean;
      metadataOnlyCapturesHaveNoObjects: boolean;
      replayAfterRepairReady: boolean;
      searchConsistencyHeldOnMissingObjects: boolean;
    };
  };
  handoffs: {
    agent02Replay: string;
    agent07PublicAnswer: string;
    agent08GraphStix: string;
    agent09ApiSdk: string;
    agent10IncidentRunbook: string;
  };
  safeOutput: {
    rawBodiesExposed: false;
    objectKeysExposed: false;
    unsafeUrlsExposed: false;
    credentialsExposed: false;
    restrictedRawContentExposed: false;
    actorInteractionExposed: false;
  };
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

export function buildObjectEvidenceManifest(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  options: { tenantId?: string; generatedAt?: string; captureIds?: string[] } = {}
): ObjectEvidenceManifest {
  const captureIdFilter = options.captureIds ? new Set(options.captureIds) : undefined;
  const captures = store.listCaptures()
    .filter((capture) => !options.tenantId || capture.tenantId === options.tenantId)
    .filter((capture) => !captureIdFilter || captureIdFilter.has(capture.id))
    .filter((capture) => capture.storageKind === "external_object" && capture.objectRef);
  const entries = captures.map((capture): ObjectEvidenceManifestEntry => {
    const ref = capture.objectRef!;
    const record = objects.getObject(ref);
    return {
      captureId: capture.id,
      tenantId: capture.tenantId,
      sourceId: capture.sourceId,
      mediaType: capture.mediaType,
      retentionClass: capture.retentionClass ?? "standard",
      contentHash: capture.contentHash,
      objectRefHash: stableId("object-ref", `${ref.bucket}:${ref.key}:${ref.versionId ?? ""}:${ref.sha256}`),
      sizeBytes: ref.sizeBytes,
      sha256: ref.sha256,
      present: record !== undefined,
      hashMatches: record !== undefined ? record.contentHash === capture.contentHash && record.ref.sha256 === ref.sha256 : false
    };
  });
  return {
    schemaVersion: "ti.object_evidence_manifest.v1",
    generatedAt: options.generatedAt ?? nowIso(),
    tenantId: options.tenantId,
    entryCount: entries.length,
    presentCount: entries.filter((entry) => entry.present).length,
    missingCount: entries.filter((entry) => !entry.present).length,
    hashMismatchCount: entries.filter((entry) => entry.present && !entry.hashMatches).length,
    entries,
    safeOutput: {
      objectKeysExposed: false,
      rawBodiesExposed: false,
      unsafeRestrictedMetadataExposed: false
    }
  };
}

export function verifyObjectEvidenceManifest(
  manifest: ObjectEvidenceManifest,
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  options: { generatedAt?: string } = {}
): ObjectEvidenceManifestVerification {
  const current = buildObjectEvidenceManifest(store, objects, {
    tenantId: manifest.tenantId,
    generatedAt: options.generatedAt,
    captureIds: manifest.entries.map((entry) => entry.captureId)
  });
  const expectedByCapture = new Map(manifest.entries.map((entry) => [entry.captureId, entry]));
  const currentByCapture = new Map(current.entries.map((entry) => [entry.captureId, entry]));
  const missingObjectCaptureIds = manifest.entries
    .filter((entry) => !currentByCapture.get(entry.captureId)?.present)
    .map((entry) => entry.captureId);
  const hashMismatchCaptureIds = manifest.entries
    .filter((entry) => {
      const currentEntry = currentByCapture.get(entry.captureId);
      return currentEntry?.present === true && (
        currentEntry.objectRefHash !== entry.objectRefHash
        || currentEntry.sha256 !== entry.sha256
        || currentEntry.contentHash !== entry.contentHash
        || currentEntry.hashMatches !== true
      );
    })
    .map((entry) => entry.captureId);
  const unexpectedObjectCaptureIds = current.entries
    .filter((entry) => !expectedByCapture.has(entry.captureId))
    .map((entry) => entry.captureId);
  return {
    schemaVersion: "ti.object_evidence_manifest_verification.v1",
    generatedAt: options.generatedAt ?? nowIso(),
    tenantId: manifest.tenantId,
    expectedCount: manifest.entryCount,
    verifiedCount: manifest.entries.length - missingObjectCaptureIds.length - hashMismatchCaptureIds.length,
    missingObjectCaptureIds,
    hashMismatchCaptureIds,
    unexpectedObjectCaptureIds,
    safeToRestore: missingObjectCaptureIds.length === 0 && hashMismatchCaptureIds.length === 0 && unexpectedObjectCaptureIds.length === 0,
    safeOutput: manifest.safeOutput
  };
}

export function buildEvidenceBackendParityReport(
  backends: EvidenceBackendParityInput[],
  query: string,
  options: { tenantId?: string; generatedAt?: string } = {}
): EvidenceBackendParityReport {
  if (backends.length === 0) throw new Error("At least one evidence backend is required for parity reporting");
  const normalizedQuery = normalizeQuery(query);
  const snapshots = backends.map((backend): EvidenceBackendReadModelSnapshot => {
    const captures = backend.store.listCaptures()
      .filter((capture) => !options.tenantId || capture.tenantId === options.tenantId)
      .filter((capture) => evidenceMetadataValue(capture.metadata, "normalizedQuery") === normalizedQuery);
    const discovery = backend.store.listDiscoveryEvidence()
      .filter((item) => item.normalizedQuery === normalizedQuery)
      .filter((item) => !options.tenantId || item.tenantId === options.tenantId);
    const deltas = backend.store.queries().getEvidenceTimeline(query, { tenantId: options.tenantId });
    const liveSnapshots = backend.store.queries().liveSnapshotsByQuery(query, { tenantId: options.tenantId });
    const replay = buildEvidenceReplayProof(backend.store, query, { tenantId: options.tenantId });
    const manifest = backend.objects
      ? buildObjectEvidenceManifest(backend.store, backend.objects, {
        tenantId: options.tenantId,
        generatedAt: options.generatedAt,
        captureIds: captures.map((capture) => capture.id)
      })
      : undefined;
    const manifestVerification = manifest && backend.objects
      ? verifyObjectEvidenceManifest(manifest, backend.store, backend.objects, { generatedAt: options.generatedAt })
      : undefined;
    return {
      name: backend.name,
      captureIds: captures.map((capture) => capture.id).sort(),
      discoveryEvidenceIds: discovery.map((item) => item.id).sort(),
      deltaCursors: deltas.map((delta) => delta.cursor).sort(),
      liveSnapshotIds: liveSnapshots.map((snapshot) => snapshot.id).sort(),
      replayable: replay.replayable,
      nextCursor: replay.nextCursor,
      objectManifestEntryCount: manifest?.entryCount ?? 0,
      objectManifestSafeToRestore: manifestVerification?.safeToRestore ?? true,
      unsafeRestrictedBodyCount: captures.filter((capture) =>
        (capture.sensitive || capture.sensitivityFlags?.some(isRestrictedFlag)) && Boolean(capture.body)
      ).length
    };
  });
  const baseline = snapshots[0];
  if (!baseline) throw new Error("At least one evidence backend is required for parity reporting");
  const comparableFields = [
    "captureIds",
    "discoveryEvidenceIds",
    "deltaCursors",
    "liveSnapshotIds",
    "replayable",
    "nextCursor",
    "objectManifestEntryCount",
    "objectManifestSafeToRestore",
    "unsafeRestrictedBodyCount"
  ] as const;
  const mismatches = snapshots.slice(1).flatMap((snapshot) =>
    comparableFields.flatMap((field) => {
      const expected = baseline[field];
      const actual = snapshot[field];
      return JSON.stringify(expected) === JSON.stringify(actual)
        ? []
        : [{ backend: snapshot.name, field, expected, actual }];
    })
  );
  const hasNoMismatchFor = (field: (typeof comparableFields)[number]) => !mismatches.some((item) => item.field === field);
  const parity = {
    capturesMatch: hasNoMismatchFor("captureIds"),
    discoveryEvidenceMatch: hasNoMismatchFor("discoveryEvidenceIds"),
    deltasMatch: hasNoMismatchFor("deltaCursors"),
    liveSnapshotsMatch: hasNoMismatchFor("liveSnapshotIds"),
    cursorReplayMatch: hasNoMismatchFor("replayable") && hasNoMismatchFor("nextCursor"),
    objectManifestsSafe: snapshots.every((snapshot) => snapshot.objectManifestSafeToRestore),
    noUnsafeRestrictedBodies: snapshots.every((snapshot) => snapshot.unsafeRestrictedBodyCount === 0),
    matchesBaseline: mismatches.length === 0
  };
  return {
    schemaVersion: "ti.evidence_backend_parity_report.v1",
    generatedAt: options.generatedAt ?? nowIso(),
    query,
    normalizedQuery,
    tenantId: options.tenantId,
    baselineBackend: baseline.name,
    backends: snapshots,
    parity,
    mismatches,
    apiCutoverReady: parity.matchesBaseline && parity.objectManifestsSafe && parity.noUnsafeRestrictedBodies,
    safeOutput: {
      rawBodiesExposed: false,
      objectReferencesExposed: false,
      restrictedMaterialExposed: false
    }
  };
}

export function buildEvidenceDisasterRecoveryManifest(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  query: string,
  options: { tenantId?: string; restoreAt?: string; generatedAt?: string; extractorVersion?: string } = {}
): EvidenceDisasterRecoveryManifest {
  const generatedAt = options.generatedAt ?? nowIso();
  const restoreAt = options.restoreAt ?? generatedAt;
  const normalizedQuery = normalizeQuery(query);
  const deltas = store.queries().getEvidenceTimeline(query, { tenantId: options.tenantId });
  const deltaCaptureIds = new Set(deltas.flatMap((delta) => delta.captureIds));
  const captures = store.listCaptures()
    .filter((capture) => !options.tenantId || capture.tenantId === options.tenantId)
    .filter((capture) =>
      deltaCaptureIds.has(capture.id)
      || evidenceMetadataValue(capture.metadata, "normalizedQuery") === normalizedQuery
    );
  const captureIds = captures.map((capture) => capture.id);
  const discovery = store.listDiscoveryEvidence()
    .filter((item) => !options.tenantId || item.tenantId === options.tenantId)
    .filter((item) => item.normalizedQuery === normalizedQuery || (item.promotedToCaptureId ? captureIds.includes(item.promotedToCaptureId) : false));
  const liveSnapshots = store.queries().liveSnapshotsByQuery(query, { tenantId: options.tenantId });
  const replay = buildEvidenceReplayProof(store, query, { tenantId: options.tenantId });
  const objectManifest = buildObjectEvidenceManifest(store, objects, {
    tenantId: options.tenantId,
    generatedAt,
    captureIds
  });
  const objectVerification = verifyObjectEvidenceManifest(objectManifest, store, objects, { generatedAt });
  const workflowStore = isAnalystWorkflowReadStore(store) ? store : undefined;
  const claimEntries = workflowStore?.listAnalystClaimLedgerEntries()
    .filter((entry) => !options.tenantId || entry.tenantId === options.tenantId)
    .filter((entry) => entry.normalizedQuery === normalizedQuery || captureIds.includes(entry.captureId ?? ""))
    ?? [];
  const reviewTasks = workflowStore?.listAnalystMetadataReviewTasks()
    .filter((task) => !options.tenantId || task.tenantId === options.tenantId)
    .filter((task) => captureIds.includes(task.captureId ?? "") || claimEntries.some((entry) => entry.reviewTaskId === task.id))
    ?? [];
  const analystSnapshots = workflowStore?.listAnalystLoopSnapshots()
    .filter((snapshot) => !options.tenantId || snapshot.tenantId === options.tenantId)
    .filter((snapshot) => snapshot.normalizedQuery === normalizedQuery)
    ?? [];
  const retentionByClass: Partial<Record<RetentionClass, number>> = {};
  for (const capture of captures) {
    const retentionClass = capture.retentionClass ?? "standard";
    retentionByClass[retentionClass] = (retentionByClass[retentionClass] ?? 0) + 1;
  }
  const relationshipDeltas = deltas.filter((delta) => delta.subjectType === "relationship");
  const heldRelationshipIds = relationshipDeltas
    .filter((delta) => delta.kind === "blocked" || delta.kind === "contradicted" || delta.kind === "downgraded" || delta.metadata.reviewState === "needs-human-review")
    .flatMap((delta) => delta.relationshipIds);
  const promotedRelationshipIds = relationshipDeltas
    .filter((delta) => delta.kind === "promoted" || delta.metadata.reviewState === "accepted")
    .flatMap((delta) => delta.relationshipIds);
  const unsafeRestrictedBodyIds = captures
    .filter((capture) => (capture.sensitive || capture.sensitivityFlags?.some(isRestrictedFlag)) && Boolean(capture.body))
    .map((capture) => capture.id);
  const redactionRepairCaptureIds = captures
    .filter((capture) =>
      unsafeRestrictedBodyIds.includes(capture.id)
      || ((capture.sensitive || capture.sensitivityFlags?.some(isRestrictedFlag)) && capture.redaction?.applied !== true)
    )
    .map((capture) => capture.id);
  const blockers = [
    ...(!replay.replayable ? ["cursor_replay_incomplete"] : []),
    ...(!objectVerification.safeToRestore ? ["object_manifest_not_restorable"] : []),
    ...(unsafeRestrictedBodyIds.length > 0 ? ["restricted_body_present"] : []),
    ...(redactionRepairCaptureIds.length > 0 ? ["redaction_repair_required"] : [])
  ];
  const restorePlan = [
    {
      order: 1,
      step: "objects" as const,
      rowCount: objectManifest.entryCount,
      ready: objectVerification.safeToRestore,
      reason: objectVerification.safeToRestore ? "object hashes verified" : "missing or mismatched object hashes"
    },
    { order: 2, step: "captures" as const, rowCount: captures.length, ready: captures.length > 0, reason: "restore immutable capture metadata before derived rows" },
    { order: 3, step: "discovery" as const, rowCount: discovery.length, ready: true, reason: "restore discovery-to-capture lineage" },
    { order: 4, step: "deltas" as const, rowCount: deltas.length, ready: deltas.length > 0, reason: "restore cursor-ordered evidence deltas" },
    { order: 5, step: "claim_ledger" as const, rowCount: claimEntries.length, ready: true, reason: "restore reviewed claim state after capture ids exist" },
    { order: 6, step: "analyst_review" as const, rowCount: reviewTasks.length + analystSnapshots.length, ready: true, reason: "restore analyst inbox and loop snapshots without rerunning collection" },
    { order: 7, step: "api_read_models" as const, rowCount: liveSnapshots.length, ready: liveSnapshots.length > 0 || deltas.length > 0, reason: "restore public/API polling read models" },
    { order: 8, step: "graph_promotion" as const, rowCount: relationshipDeltas.length, ready: true, reason: "recompute graph/STIX eligibility from deltas and claim ledger" }
  ];

  return {
    schemaVersion: "ti.evidence_disaster_recovery_manifest.v1",
    generatedAt,
    tenantId: options.tenantId,
    query,
    normalizedQuery,
    pointInTime: {
      restoreAt,
      captureCount: captures.length,
      deltaCount: deltas.length,
      claimLedgerEntryCount: claimEntries.length,
      analystReviewTaskCount: reviewTasks.length,
      apiSnapshotCount: liveSnapshots.length
    },
    replayInputs: captures.map((capture) => {
      const input = store.replayInput(capture.id, options.extractorVersion ?? String(capture.metadata.extractorVersion ?? "current"));
      return {
        captureId: capture.id,
        sourceId: capture.sourceId,
        storageKind: capture.storageKind,
        contentHash: capture.contentHash,
        normalizedTextHash: capture.normalizedTextHash,
        extractorVersion: input?.extractorVersion ?? options.extractorVersion ?? "current",
        bodyAvailable: Boolean(input?.body),
        objectBacked: capture.storageKind === "external_object",
        metadataOnly: capture.storageKind === "metadata_only",
        retentionClass: capture.retentionClass ?? "standard",
        legalHold: capture.legalHold === true || capture.retentionClass === "legal_hold",
        redactionApplied: capture.redaction?.applied === true || capture.storageKind === "metadata_only"
      };
    }),
    objectManifest,
    objectVerification,
    retention: {
      byClass: retentionByClass,
      legalHoldCaptureIds: captures.filter((capture) => capture.legalHold || capture.retentionClass === "legal_hold").map((capture) => capture.id),
      expiredDeltaIds: deltas.filter((delta) => delta.kind === "expired").map((delta) => delta.id),
      redactionRepairCaptureIds
    },
    claimLedger: {
      entryIds: claimEntries.map((entry) => entry.id),
      trustedEntryIds: claimEntries.filter((entry) => entry.ledgerStatus === "trusted").map((entry) => entry.id),
      heldEntryIds: claimEntries.filter((entry) => entry.ledgerStatus === "held" || entry.ledgerStatus === "metadata_review").map((entry) => entry.id),
      contradictedEntryIds: claimEntries.filter((entry) => entry.ledgerStatus === "contradicted").map((entry) => entry.id),
      duplicateEntryIds: claimEntries.filter((entry) => entry.ledgerStatus === "duplicate").map((entry) => entry.id),
      legalHoldEntryIds: claimEntries.filter((entry) => entry.legalHold || entry.retentionClass === "legal_hold").map((entry) => entry.id),
      graphEligibleEntryIds: claimEntries.filter((entry) => entry.graphEligible).map((entry) => entry.id),
      stixEligibleEntryIds: claimEntries.filter((entry) => entry.stixEligible).map((entry) => entry.id)
    },
    analystReview: {
      taskIds: reviewTasks.map((task) => task.id),
      snapshotIds: analystSnapshots.map((snapshot) => snapshot.id),
      states: [...new Set(reviewTasks.map((task) => task.status))]
    },
    graphPromotion: {
      relationshipIds: [...new Set(relationshipDeltas.flatMap((delta) => delta.relationshipIds))],
      heldRelationshipIds: [...new Set(heldRelationshipIds)],
      promotedRelationshipIds: [...new Set(promotedRelationshipIds)]
    },
    apiReadModels: {
      liveSnapshotIds: liveSnapshots.map((snapshot) => snapshot.id),
      nextCursor: replay.nextCursor,
      replayable: replay.replayable
    },
    restorePlan,
    restoreReady: blockers.length === 0 && restorePlan.every((step) => step.ready),
    blockers: [...new Set(blockers)],
    safeOutput: {
      rawBodiesExposed: false,
      objectKeysExposed: false,
      restrictedMaterialExposed: false,
      credentialsExposed: false
    }
  };
}

export function buildEvidenceSearchIndexHandoff(
  store: CaptureMetadataStore,
  query: string,
  options: { tenantId?: string; generatedAt?: string } = {}
): EvidenceSearchIndexHandoff {
  const normalizedQuery = normalizeQuery(query);
  const deltas = store.queries().getEvidenceTimeline(query, { tenantId: options.tenantId });
  const deltaCaptureIds = new Set(deltas.flatMap((delta) => delta.captureIds));
  const captureIds = new Set(deltaCaptureIds);
  const captures = store.listCaptures()
    .filter((capture) => !options.tenantId || capture.tenantId === options.tenantId)
    .filter((capture) =>
      captureIds.has(capture.id)
      || evidenceMetadataValue(capture.metadata, "normalizedQuery") === normalizedQuery
    );
  for (const capture of captures) captureIds.add(capture.id);

  const workflowStore = isAnalystWorkflowReadStore(store) ? store : undefined;
  const claimEntries = workflowStore?.listAnalystClaimLedgerEntries()
    .filter((entry) => !options.tenantId || entry.tenantId === options.tenantId)
    .filter((entry) => entry.normalizedQuery === normalizedQuery || captureIds.has(entry.captureId ?? ""))
    ?? [];
  const sourceIds = new Set([
    ...captures.map((capture) => capture.sourceId),
    ...deltas.flatMap((delta) => delta.sourceId ? [delta.sourceId] : []),
    ...claimEntries.map((entry) => entry.sourceId)
  ]);
  const sourceStore = isSourceReadStore(store) ? store : undefined;
  const sources = sourceStore?.listSources()
    .filter((source) => !options.tenantId || source.tenantId === options.tenantId)
    .filter((source) =>
      sourceIds.has(source.id)
      || sourceMatchesQuery(source, normalizedQuery)
    )
    ?? [];

  const captureDocs = captures.map((capture) => captureSearchDocument(capture, normalizedQuery, query));
  const deltaDocs = deltas.map((delta) => deltaSearchDocument(delta, normalizedQuery, query));
  const claimDocs = claimEntries.map((entry) => claimSearchDocument(entry, normalizedQuery, query));
  const relationshipDocs = deltas
    .filter((delta) => delta.subjectType === "relationship")
    .flatMap((delta) => delta.relationshipIds.length > 0
      ? delta.relationshipIds.map((relationshipId) => relationshipSearchDocument(delta, relationshipId, normalizedQuery, query))
      : [relationshipSearchDocument(delta, delta.subjectId, normalizedQuery, query)]
    );
  const sourceDocs = sources.map((source) => sourceSearchDocument(source, normalizedQuery, query));
  const documents = dedupeSearchDocuments([
    ...captureDocs,
    ...deltaDocs,
    ...claimDocs,
    ...relationshipDocs,
    ...sourceDocs
  ]);

  return {
    schemaVersion: "ti.evidence_search_index_handoff.v1",
    generatedAt: options.generatedAt ?? nowIso(),
    tenantId: options.tenantId,
    query,
    normalizedQuery,
    documents,
    counts: {
      total: documents.length,
      captures: documents.filter((document) => document.kind === "capture").length,
      deltas: documents.filter((document) => document.kind === "evidence_delta").length,
      claims: documents.filter((document) => document.kind === "claim").length,
      graphRelationships: documents.filter((document) => document.kind === "graph_relationship").length,
      sources: documents.filter((document) => document.kind === "source").length,
      embeddingEligible: documents.filter((document) => document.embedding.eligible).length,
      restrictedMetadataExcludedFromEmbedding: documents.filter((document) => document.embedding.reason === "restricted_metadata_excluded").length
    },
    backendContract: {
      vendorNeutral: true,
      openSearchCompatible: true,
      vectorCompatible: true,
      tenantScopedRouting: true,
      replayIdRequired: true,
      citationSpansRequired: true
    },
    safeOutput: {
      rawBodiesExposed: false,
      objectKeysExposed: false,
      restrictedMaterialExposed: false,
      credentialsExposed: false,
      unsafeUrlsExposed: false
    }
  };
}

export function buildEvidenceIndexReplayMigrationReport(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  query: string,
  options: { tenantId?: string; generatedAt?: string; extractorVersion?: string } = {}
): EvidenceIndexReplayMigrationReport {
  const generatedAt = options.generatedAt ?? nowIso();
  const handoff = buildEvidenceSearchIndexHandoff(store, query, { tenantId: options.tenantId, generatedAt });
  const custody = buildEvidenceChainOfCustodyReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const replay = buildEvidenceReplayProof(store, query, { tenantId: options.tenantId });
  const captureIds = uniqueStrings(handoff.documents.flatMap((document) => document.captureId ? [document.captureId] : []));
  const objectManifest = buildObjectEvidenceManifest(store, objects, {
    tenantId: options.tenantId,
    generatedAt,
    captureIds
  });
  const objectVerification = verifyObjectEvidenceManifest(objectManifest, store, objects, { generatedAt });
  const checksumInput = handoff.documents
    .map((document) => [
      document.documentId,
      document.kind,
      document.replay.replayId,
      document.replay.contentHash ?? "",
      document.replay.cursor ?? "",
      document.embedding.eligible ? "vector" : "search-only",
      document.redaction.metadataOnly ? "metadata-only" : "public-text"
    ].join(":"))
    .sort()
    .join("|");
  const checksum = hashContent(checksumInput);
  const restrictedMetadataHoldDocumentIds = handoff.documents
    .filter((document) => document.redaction.restricted || document.embedding.reason === "restricted_metadata_excluded")
    .map((document) => document.documentId);
  const parserDriftCaptureIds = uniqueStrings(custody.verification.warnings
    .filter((warning) => warning.startsWith("parser_version_drift:"))
    .map((warning) => warning.split(":").slice(1).join(":")));
  const exportWithoutReviewIds = uniqueStrings(custody.verification.warnings
    .filter((warning) => warning.startsWith("export_without_review:"))
    .map((warning) => warning.split(":").slice(1).join(":")));
  const missingObjectCaptureIds = objectVerification.missingObjectCaptureIds;
  const hashMismatchCaptureIds = objectVerification.hashMismatchCaptureIds;
  const blockers = uniqueStrings([
    ...missingObjectCaptureIds.map((id) => `missing_object_ref:${id}`),
    ...hashMismatchCaptureIds.map((id) => `hash_mismatch:${id}`),
    ...(handoff.documents.length === 0 ? ["no_index_documents"] : []),
    ...custody.verification.blockers.filter((blocker) => blocker.startsWith("restricted_body_present:"))
  ]);
  const warnings = uniqueStrings([
    ...(!replay.replayable ? ["cursor_replay_incomplete"] : []),
    ...parserDriftCaptureIds.map((id) => `parser_version_drift:${id}`),
    ...exportWithoutReviewIds.map((id) => `export_without_review:${id}`),
    ...(custody.verification.checks.graphRelationship ? [] : ["graph_relationship_missing"]),
    ...(custody.verification.checks.apiSearchAnswer ? [] : ["api_search_answer_missing"])
  ]);
  const status: EvidenceCutoverGateStatus = blockers.length > 0 ? "blocked" : warnings.length > 0 ? "hold" : "ready";
  const sourceDocuments = handoff.documents.filter((document) => document.kind === "source").length;
  const captureDocuments = handoff.documents.filter((document) => document.kind === "capture").length;
  const extractionDocuments = handoff.documents.filter((document) => document.kind === "evidence_delta").length;
  const claimDocuments = handoff.documents.filter((document) => document.kind === "claim").length;
  const graphDocuments = handoff.documents.filter((document) => document.kind === "graph_relationship").length;
  const plan: EvidenceIndexReplayMigrationReport["plan"] = [
    {
      order: 1,
      step: "source_registry_backfill",
      rowCount: sourceDocuments,
      ready: sourceDocuments > 0,
      reason: sourceDocuments > 0 ? "source registry documents are present for tenant-scoped routing and SLO joins" : "no source registry documents matched the query",
      rollbackAction: "preserve previous source index alias until source rows replay"
    },
    {
      order: 2,
      step: "object_manifest_verify",
      rowCount: objectManifest.entryCount,
      ready: objectVerification.safeToRestore,
      reason: objectVerification.safeToRestore ? "object refs are present and hash-verified" : "missing or mismatched object refs block immutable replay",
      rollbackAction: "restore missing object refs before index alias swap"
    },
    {
      order: 3,
      step: "capture_index_rebuild",
      rowCount: captureDocuments,
      ready: captureDocuments > 0 && objectVerification.safeToRestore,
      reason: "capture documents rebuild from immutable capture metadata and hashed object refs",
      rollbackAction: "drop rebuilt capture shard and keep previous alias"
    },
    {
      order: 4,
      step: "extraction_index_replay",
      rowCount: extractionDocuments,
      ready: replay.replayable && parserDriftCaptureIds.length === 0,
      reason: replay.replayable ? "cursor replay can rebuild extraction documents" : "cursor replay is incomplete",
      rollbackAction: "hold parser-version upgrade and replay from last good cursor"
    },
    {
      order: 5,
      step: "claim_ledger_replay",
      rowCount: claimDocuments,
      ready: claimDocuments > 0,
      reason: claimDocuments > 0 ? "claim ledger rows are available for search consistency and review gates" : "claim ledger rows are missing for this query",
      rollbackAction: "serve prior claim ledger projection until review rows replay"
    },
    {
      order: 6,
      step: "graph_relationship_replay",
      rowCount: graphDocuments,
      ready: custody.verification.checks.graphRelationship,
      reason: custody.verification.checks.graphRelationship ? "graph relationship deltas are replayable into relationship documents" : "graph relationships are missing",
      rollbackAction: "hold graph/STIX export and keep relationship index read-only"
    },
    {
      order: 7,
      step: "opensearch_bulk_commit",
      rowCount: handoff.counts.total,
      ready: blockers.length === 0,
      reason: "OpenSearch commit uses deterministic document ids, routing keys, and checksum validation",
      rollbackAction: "abort bulk commit and keep previous index alias active"
    },
    {
      order: 8,
      step: "vector_upsert_commit",
      rowCount: handoff.counts.embeddingEligible,
      ready: blockers.length === 0,
      reason: "vector upsert receives only public text input hashes and excludes metadata-only restricted documents",
      rollbackAction: "delete new vector namespace version before alias swap"
    },
    {
      order: 9,
      step: "api_answer_refresh",
      rowCount: custody.counts.api_search_answer,
      ready: custody.verification.checks.apiSearchAnswer,
      reason: custody.verification.checks.apiSearchAnswer ? "API answer snapshots can be refreshed from replayed index documents" : "API answer snapshot is missing",
      rollbackAction: "serve previous index or safe partial answer with replay warning"
    },
    {
      order: 10,
      step: "stix_preview_gate",
      rowCount: custody.counts.stix_export_preview,
      ready: exportWithoutReviewIds.length === 0,
      reason: exportWithoutReviewIds.length === 0 ? "STIX preview candidates are reviewed or absent" : "unreviewed export candidates must remain held",
      rollbackAction: "block STIX export preview until claim/relationship review passes"
    }
  ];

  return {
    schemaVersion: "ti.evidence_index_replay_migration.v1",
    generatedAt,
    migrationId: stableId("evidence-index-migration", `${options.tenantId ?? "global"}:${handoff.normalizedQuery}:${checksum}`),
    tenantId: options.tenantId,
    query: handoff.query,
    normalizedQuery: handoff.normalizedQuery,
    targetBackends: {
      openSearchIndex: "ti-evidence-v1",
      vectorNamespace: "ti-evidence",
      postgresCursorSource: "evidence_delta_cursor",
      objectStoreRequired: true,
      aliasCutover: "blue_green_alias_swap"
    },
    replayInputs: {
      custodyChainId: custody.chainId,
      handoffDocumentCount: handoff.counts.total,
      replayableDocumentCount: handoff.documents.filter((document) => Boolean(document.replay.replayId)).length,
      embeddingEligibleDocumentCount: handoff.counts.embeddingEligible,
      restrictedMetadataDocumentCount: handoff.counts.restrictedMetadataExcludedFromEmbedding,
      metadataOnlyDocumentCount: handoff.documents.filter((document) => document.redaction.metadataOnly).length,
      objectManifestEntryCount: objectManifest.entryCount,
      verifiedObjectCount: objectVerification.verifiedCount,
      checksum
    },
    plan,
    validation: {
      status,
      blockers,
      warnings,
      checks: {
        objectRefsVerified: objectVerification.safeToRestore,
        hashChecksumsMatch: hashMismatchCaptureIds.length === 0 && custody.verification.checks.hashChainIntact,
        cursorReplayComplete: replay.replayable,
        parserVersionsCurrent: parserDriftCaptureIds.length === 0,
        redactionSafe: custody.verification.checks.redactionSafe && handoff.safeOutput.rawBodiesExposed === false,
        restrictedMetadataHeldFromEmbedding: handoff.documents
          .filter((document) => document.redaction.restricted)
          .every((document) => !document.embedding.eligible && document.embedding.reason === "restricted_metadata_excluded"),
        retentionClassPreserved: handoff.documents.every((document) => Boolean(document.redaction.retentionClass) || document.kind === "source"),
        graphRelationshipsConsistent: custody.verification.checks.graphRelationship && graphDocuments > 0,
        apiAnswersConsistent: custody.verification.checks.apiSearchAnswer,
        stixExportReviewed: exportWithoutReviewIds.length === 0,
        rollbackReady: true
      }
    },
    consistency: {
      evidenceDocuments: handoff.counts.total,
      sourceRegistryDocuments: sourceDocuments,
      captureDocuments,
      extractionDocuments,
      claimLedgerDocuments: claimDocuments,
      graphRelationshipDocuments: graphDocuments,
      apiSearchAnswerStages: custody.counts.api_search_answer,
      stixPreviewStages: custody.counts.stix_export_preview,
      missingObjectCaptureIds,
      hashMismatchCaptureIds,
      parserDriftCaptureIds,
      exportWithoutReviewIds,
      restrictedMetadataHoldDocumentIds
    },
    rollback: {
      checkpointId: stableId("evidence-index-rollback", `${options.tenantId ?? "global"}:${handoff.normalizedQuery}:${generatedAt}`),
      reversible: true,
      actions: [
        "build candidate OpenSearch index behind a versioned alias",
        "upsert vector documents into a versioned namespace only after checksum validation",
        "keep previous index alias until object refs, cursor replay, redaction, graph, and STIX gates pass",
        "delete candidate index/vector namespace on any blocker and continue serving previous index or safe partial answer"
      ],
      publicApiFallback: "serve_previous_index_or_partial_answer"
    },
    handoffs: {
      agent01SourceSlo: "source documents preserve source ids, source status, trust, and routing for coverage/SLO decisions",
      agent02QueueReplay: "cursor replay and rollback checkpoint expose queue replay debt without mutating scheduler state",
      agent07QualityGates: "claim confidence, parser drift, and restricted metadata embedding holds gate public answer quality",
      agent08GraphDrift: "graph relationship document counts and export-without-review holds detect graph/index drift",
      agent09ApiSdkFields: "API-safe migration packet exposes backend readiness, checksum, blockers, and rollback fields",
      agent10ReleaseArtifacts: "release board can promote, hold, or rollback using validation status and dry-run actions"
    },
    safeOutput: {
      rawBodiesExposed: false,
      objectKeysExposed: false,
      unsafeUrlsExposed: false,
      credentialsExposed: false,
      restrictedMaterialExposed: false,
      actorInteractionExposed: false
    }
  };
}

export function buildEvidenceChainOfCustodyReport(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  query: string,
  options: { tenantId?: string; generatedAt?: string; extractorVersion?: string } = {}
): EvidenceChainOfCustodyReport {
  const generatedAt = options.generatedAt ?? nowIso();
  const normalizedQuery = normalizeQuery(query);
  const deltas = store.queries().getEvidenceTimeline(query, { tenantId: options.tenantId });
  const liveSnapshots = store.queries().liveSnapshotsByQuery(query, { tenantId: options.tenantId });
  const deltaCaptureIds = new Set(deltas.flatMap((delta) => delta.captureIds));
  const captures = store.listCaptures()
    .filter((capture) => !options.tenantId || capture.tenantId === options.tenantId)
    .filter((capture) =>
      deltaCaptureIds.has(capture.id)
      || evidenceMetadataValue(capture.metadata, "normalizedQuery") === normalizedQuery
    );
  const captureIds = new Set(captures.map((capture) => capture.id));
  const workflowStore = isAnalystWorkflowReadStore(store) ? store : undefined;
  const claimEntries = workflowStore?.listAnalystClaimLedgerEntries()
    .filter((entry) => !options.tenantId || entry.tenantId === options.tenantId)
    .filter((entry) => entry.normalizedQuery === normalizedQuery || captureIds.has(entry.captureId ?? ""))
    ?? [];
  const sourceIds = new Set([
    ...captures.map((capture) => capture.sourceId),
    ...deltas.flatMap((delta) => delta.sourceId ? [delta.sourceId] : []),
    ...claimEntries.map((entry) => entry.sourceId)
  ]);
  const sourceStore = isSourceReadStore(store) ? store : undefined;
  const sources = sourceStore?.listSources()
    .filter((source) => !options.tenantId || source.tenantId === options.tenantId)
    .filter((source) => sourceIds.has(source.id) || sourceMatchesQuery(source, normalizedQuery))
    ?? [];
  const replay = buildEvidenceReplayProof(store, query, { tenantId: options.tenantId });
  const objectManifest = buildObjectEvidenceManifest(store, objects, {
    tenantId: options.tenantId,
    generatedAt,
    captureIds: captures.map((capture) => capture.id)
  });
  const objectVerification = verifyObjectEvidenceManifest(objectManifest, store, objects, { generatedAt });
  const captureById = new Map(captures.map((capture) => [capture.id, capture]));
  const stages: EvidenceChainStage[] = [];
  const addStage = (stage: EvidenceChainStage) => stages.push(stage);

  for (const source of sources) {
    addStage(chainStage({
      stage: "source_registry_event",
      id: source.id,
      tenantId: source.tenantId,
      sourceId: source.id,
      observedAt: source.lastSeenAt ?? source.updatedAt,
      confidence: source.trustScore,
      retentionClass: source.catalog?.retentionClass,
      reviewState: source.governance?.approvalState ?? source.status,
      restricted: source.risk === "restricted" || source.governance?.metadataOnly === true,
      metadataOnly: source.governance?.metadataOnly === true || source.risk === "restricted",
      legalHold: source.catalog?.retentionClass === "legal_hold",
      replayId: stableId("custody-replay", `source:${source.id}:${source.updatedAt}`)
    }));
  }

  const runIds = uniqueStrings([
    ...captures.flatMap((capture) => singleMetadata(capture.metadata.runId)),
    ...deltas.flatMap((delta) => singleMetadata(delta.runId)),
    ...liveSnapshots.flatMap((snapshot) => singleMetadata(snapshot.runId))
  ]);
  for (const runId of runIds) {
    const runCaptures = captures.filter((capture) => capture.metadata.runId === runId);
    const runDeltas = deltas.filter((delta) => delta.runId === runId);
    addStage(chainStage({
      stage: "scheduled_run",
      id: runId,
      tenantId: options.tenantId ?? runCaptures[0]?.tenantId ?? runDeltas[0]?.tenantId,
      sourceId: runCaptures[0]?.sourceId ?? runDeltas[0]?.sourceId,
      runId,
      observedAt: runDeltas[0]?.observedAt ?? runCaptures[0]?.collectedAt,
      replayId: stableId("custody-replay", `run:${runId}:${runDeltas.at(-1)?.cursor ?? ""}`),
      cursor: runDeltas.at(-1)?.cursor,
      replayable: replay.replayable
    }));
  }

  for (const capture of captures) {
    const restricted = isRestrictedCapture(capture);
    const parserVersion = stringMetadata(capture.metadata.extractorVersion) ?? capture.provenance?.extractorVersion ?? "current";
    addStage(chainStage({
      stage: "raw_capture",
      id: capture.id,
      tenantId: capture.tenantId,
      sourceId: capture.sourceId,
      captureId: capture.id,
      runId: stringMetadata(capture.metadata.runId),
      observedAt: capture.collectedAt,
      contentHash: capture.contentHash,
      parserVersion,
      confidence: numericMetadata(capture.metadata.confidence),
      retentionClass: capture.retentionClass,
      reviewState: stringMetadata(capture.metadata.reviewState) ?? stringMetadata(capture.metadata.graphReviewState),
      restricted,
      metadataOnly: capture.storageKind === "metadata_only" || restricted,
      legalHold: capture.legalHold === true || capture.retentionClass === "legal_hold",
      replayId: stableId("custody-replay", `capture:${capture.id}:${capture.contentHash}:${parserVersion}`),
      replayable: Boolean(store.replayInput(capture.id, options.extractorVersion ?? parserVersion))
    }));
    if (capture.storageKind === "external_object" && capture.objectRef) {
      const manifestEntry = objectManifest.entries.find((entry) => entry.captureId === capture.id);
      addStage(chainStage({
        stage: "object_ref",
        id: stableId("custody-object", capture.id),
        tenantId: capture.tenantId,
        sourceId: capture.sourceId,
        captureId: capture.id,
        runId: stringMetadata(capture.metadata.runId),
        observedAt: capture.collectedAt,
        contentHash: capture.contentHash,
        objectRefHash: manifestEntry?.objectRefHash ?? stableId("object-ref", `${capture.objectRef.bucket}:${capture.objectRef.sha256}`),
        retentionClass: capture.retentionClass,
        restricted,
        metadataOnly: false,
        legalHold: capture.legalHold === true || capture.retentionClass === "legal_hold",
        replayId: stableId("custody-replay", `object:${capture.id}:${capture.objectRef.sha256}`),
        replayable: manifestEntry?.present === true && manifestEntry.hashMatches === true
      }));
    }
  }

  for (const delta of deltas.filter((delta) => delta.subjectType === "extraction")) {
    addStage(chainStage({
      stage: "extraction",
      id: delta.id,
      tenantId: delta.tenantId,
      sourceId: delta.sourceId,
      captureId: delta.captureIds[0],
      runId: delta.runId,
      observedAt: delta.observedAt,
      contentHash: stringMetadata(delta.metadata.contentHash),
      parserVersion: stringMetadata(delta.metadata.extractorVersion),
      confidence: numericMetadata(delta.metadata.confidence),
      retentionClass: delta.retentionClass,
      reviewState: stringMetadata(delta.metadata.reviewState),
      restricted: delta.retentionClass === "restricted_metadata" || delta.retentionClass === "darknet_metadata" || delta.retentionClass === "sensitive_metadata",
      metadataOnly: true,
      legalHold: delta.retentionClass === "legal_hold",
      replayId: stableId("custody-replay", `extraction:${delta.id}:${delta.cursor}`),
      cursor: delta.cursor
    }));
  }

  for (const entry of claimEntries) {
    const restricted = entry.retentionClass === "restricted_metadata" || entry.retentionClass === "darknet_metadata" || entry.retentionClass === "sensitive_metadata" || entry.ledgerStatus === "metadata_review" || entry.ledgerStatus === "held";
    addStage(chainStage({
      stage: "claim_ledger",
      id: entry.id,
      tenantId: entry.tenantId,
      sourceId: entry.sourceId,
      captureId: entry.captureId,
      claimLedgerEntryId: entry.id,
      observedAt: entry.observedAt,
      contentHash: entry.sourceHash,
      confidence: entry.confidence,
      retentionClass: entry.retentionClass,
      reviewState: entry.ledgerStatus,
      restricted,
      metadataOnly: restricted,
      legalHold: entry.legalHold === true || entry.retentionClass === "legal_hold",
      replayId: stableId("custody-replay", `claim:${entry.id}:${entry.sourceHash}:${entry.ledgerStatus}`)
    }));
  }

  for (const delta of deltas.filter((delta) => delta.subjectType === "relationship")) {
    const restricted = delta.retentionClass === "restricted_metadata" || delta.retentionClass === "darknet_metadata" || delta.retentionClass === "sensitive_metadata";
    const reviewState = stringMetadata(delta.metadata.reviewState) ?? (delta.kind === "promoted" ? "promoted" : delta.kind);
    for (const relationshipId of delta.relationshipIds.length > 0 ? delta.relationshipIds : [delta.subjectId]) {
      addStage(chainStage({
        stage: "graph_relationship",
        id: `${delta.id}:${relationshipId}`,
        tenantId: delta.tenantId,
        sourceId: delta.sourceId,
        captureId: delta.captureIds[0],
        runId: delta.runId,
        relationshipId,
        observedAt: delta.observedAt,
        contentHash: stringMetadata(delta.metadata.contentHash),
        confidence: numericMetadata(delta.metadata.confidence),
        retentionClass: delta.retentionClass,
        reviewState,
        restricted,
        metadataOnly: true,
        legalHold: delta.retentionClass === "legal_hold",
        replayId: stableId("custody-replay", `relationship:${relationshipId}:${delta.cursor}`),
        cursor: delta.cursor
      }));
    }
  }

  for (const snapshot of liveSnapshots) {
    addStage(chainStage({
      stage: "api_search_answer",
      id: snapshot.id,
      tenantId: snapshot.tenantId,
      runId: snapshot.runId,
      observedAt: snapshot.capturedAt,
      retentionClass: snapshot.retentionClass,
      reviewState: snapshot.status,
      metadataOnly: true,
      replayId: stableId("custody-replay", `api:${snapshot.id}:${snapshot.capturedAt}`),
      replayable: true
    }));
  }

  for (const entry of claimEntries.filter((entry) => entry.stixEligible || entry.graphEligible)) {
    addStage(chainStage({
      stage: "stix_export_preview",
      id: stableId("custody-stix", entry.id),
      tenantId: entry.tenantId,
      sourceId: entry.sourceId,
      captureId: entry.captureId,
      claimLedgerEntryId: entry.id,
      observedAt: entry.reviewedAt ?? entry.updatedAt ?? entry.observedAt,
      contentHash: entry.sourceHash,
      confidence: entry.confidence,
      retentionClass: entry.retentionClass,
      reviewState: entry.ledgerStatus,
      restricted: entry.retentionClass === "restricted_metadata" || entry.retentionClass === "darknet_metadata" || entry.retentionClass === "sensitive_metadata",
      metadataOnly: true,
      legalHold: entry.legalHold === true || entry.retentionClass === "legal_hold",
      replayId: stableId("custody-replay", `stix:${entry.id}:${entry.sourceHash}:${entry.ledgerStatus}`)
    }));
  }

  linkChainStages(stages);

  const brokenDeltaHashes = deltas
    .filter((delta) => {
      const deltaHash = stringMetadata(delta.metadata.contentHash);
      return Boolean(deltaHash) && delta.captureIds.some((captureId) => {
        const capture = captureById.get(captureId);
        return capture && capture.contentHash !== deltaHash;
      });
    })
    .map((delta) => delta.id);
  const missingRelationshipCaptureIds = deltas
    .filter((delta) => delta.subjectType === "relationship")
    .flatMap((delta) => delta.captureIds.filter((captureId) => !captureById.has(captureId)));
  const missingClaimCaptureIds = claimEntries
    .filter((entry) => entry.captureId && !captureById.has(entry.captureId))
    .map((entry) => entry.id);
  const parserDriftCaptureIds = captures
    .filter((capture) => hasParserVersionDrift(store, capture))
    .map((capture) => capture.id);
  const exportWithoutReviewIds = [
    ...claimEntries
      .filter((entry) => (entry.graphEligible || entry.stixEligible) && !["trusted", "notified"].includes(entry.ledgerStatus))
      .map((entry) => entry.id),
    ...deltas
      .filter((delta) => delta.subjectType === "relationship")
      .filter((delta) => (delta.kind === "promoted" || delta.metadata.exportReady === true || delta.metadata.stixEligible === true)
        && !["accepted", "promoted"].includes(stringMetadata(delta.metadata.reviewState) ?? delta.kind)
      )
      .map((delta) => delta.id)
  ];
  const unsafeRestrictedBodyCaptureIds = captures
    .filter((capture) => isRestrictedCapture(capture) && Boolean(capture.body))
    .map((capture) => capture.id);
  const redactionRepairCaptureIds = captures
    .filter((capture) => isRestrictedCapture(capture) && capture.redaction?.applied !== true)
    .map((capture) => capture.id);
  const blockers = uniqueStrings([
    ...(captures.length === 0 ? ["missing_capture"] : []),
    ...objectVerification.missingObjectCaptureIds.map((id) => `missing_object_ref:${id}`),
    ...objectVerification.hashMismatchCaptureIds.map((id) => `broken_object_hash:${id}`),
    ...brokenDeltaHashes.map((id) => `broken_hash_chain:${id}`),
    ...missingRelationshipCaptureIds.map((id) => `missing_relationship_capture:${id}`),
    ...missingClaimCaptureIds.map((id) => `missing_claim_capture:${id}`),
    ...unsafeRestrictedBodyCaptureIds.map((id) => `restricted_body_present:${id}`)
  ]);
  const warnings = uniqueStrings([
    ...(!replay.replayable ? ["cursor_replay_incomplete"] : []),
    ...parserDriftCaptureIds.map((id) => `parser_version_drift:${id}`),
    ...exportWithoutReviewIds.map((id) => `export_without_review:${id}`),
    ...redactionRepairCaptureIds.map((id) => `redaction_repair_required:${id}`),
    ...(claimEntries.length === 0 ? ["claim_ledger_missing"] : []),
    ...(deltas.filter((delta) => delta.subjectType === "relationship").length === 0 ? ["graph_relationship_missing"] : []),
    ...(liveSnapshots.length === 0 ? ["api_search_answer_missing"] : [])
  ]);
  const status: EvidenceCutoverGateStatus = blockers.length > 0 ? "blocked" : warnings.length > 0 ? "hold" : "ready";
  const stageCounts = countChainStages(stages);

  return {
    schemaVersion: "ti.evidence_chain_of_custody.v1",
    generatedAt,
    chainId: stableId("evidence-chain", `${options.tenantId ?? "global"}:${normalizedQuery}:${stages.map((stage) => stage.id).join("|")}`),
    tenantId: options.tenantId,
    query,
    normalizedQuery,
    stages,
    counts: {
      ...stageCounts,
      total: stages.length,
      restrictedMetadataStages: stages.filter((stage) => stage.redaction.restricted).length,
      metadataOnlyStages: stages.filter((stage) => stage.redaction.metadataOnly).length,
      legalHoldStages: stages.filter((stage) => stage.redaction.legalHold).length
    },
    verification: {
      status,
      blockers,
      warnings,
      checks: {
        sourceRegistryEvent: stages.some((stage) => stage.stage === "source_registry_event"),
        scheduledRun: stages.some((stage) => stage.stage === "scheduled_run"),
        rawCapture: captures.length > 0,
        objectRefsVerified: objectVerification.safeToRestore,
        extraction: stages.some((stage) => stage.stage === "extraction"),
        claimLedger: claimEntries.length > 0,
        graphRelationship: stages.some((stage) => stage.stage === "graph_relationship"),
        apiSearchAnswer: liveSnapshots.length > 0,
        stixExportReviewed: exportWithoutReviewIds.length === 0,
        replayable: replay.replayable,
        redactionSafe: unsafeRestrictedBodyCaptureIds.length === 0 && redactionRepairCaptureIds.length === 0,
        hashChainIntact: brokenDeltaHashes.length === 0 && objectVerification.hashMismatchCaptureIds.length === 0
      }
    },
    handoffs: {
      agent01Governance: "source registry event ids and approval states prove governance lineage",
      agent02Scheduler: "scheduled run ids and cursor replay prove queue-to-capture continuity",
      agent04Correlation: "content hashes and extraction deltas preserve correlation input provenance",
      agent05RestrictedMetadata: "restricted metadata remains metadata-only and review-held",
      agent07AnswerConfidence: "claim confidence, parser version, and replay state gate public answer confidence",
      agent08GraphReview: "graph relationships and STIX previews require reviewed claim/relationship state",
      agent09ApiSdk: "API-safe custody packet exposes ids, hashes, cursors, and redaction flags only",
      agent10IncidentRunbooks: "verification blockers map to restore, redaction, parser drift, and export-hold runbooks"
    },
    safeOutput: {
      rawBodiesExposed: false,
      objectKeysExposed: false,
      unsafeUrlsExposed: false,
      secretMaterialExposed: false,
      restrictedMaterialExposed: false,
      actorInteractionExposed: false
    }
  };
}

export function buildEvidenceRetentionRuntimeReport(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  query: string,
  options: { tenantId?: string; generatedAt?: string; extractorVersion?: string } = {}
): EvidenceRetentionRuntimeReport {
  const generatedAt = options.generatedAt ?? nowIso();
  const normalizedQuery = normalizeQuery(query);
  const handoff = buildEvidenceSearchIndexHandoff(store, query, { tenantId: options.tenantId, generatedAt });
  const migration = buildEvidenceIndexReplayMigrationReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const custody = buildEvidenceChainOfCustodyReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const replay = buildEvidenceReplayProof(store, query, { tenantId: options.tenantId });
  const captureIds = new Set([
    ...handoff.documents.flatMap((document) => document.captureId ? [document.captureId] : []),
    ...custody.stages.flatMap((stage) => stage.captureId ? [stage.captureId] : [])
  ]);
  const captures = store.listCaptures()
    .filter((capture) => !options.tenantId || capture.tenantId === options.tenantId)
    .filter((capture) => captureIds.has(capture.id) || evidenceMetadataValue(capture.metadata, "normalizedQuery") === normalizedQuery);
  for (const capture of captures) captureIds.add(capture.id);
  const objectManifest = buildObjectEvidenceManifest(store, objects, {
    tenantId: options.tenantId,
    generatedAt,
    captureIds: captures.map((capture) => capture.id)
  });
  const objectVerification = verifyObjectEvidenceManifest(objectManifest, store, objects, { generatedAt });
  const surfaces: EvidenceRetentionRuntimeReport["surfaces"] = [];
  const pushSurface = (surface: EvidenceRetentionRuntimeReport["surfaces"][number]) => surfaces.push(surface);

  for (const capture of captures) {
    const flags = retentionFlagsForCapture(capture);
    const action = retentionActionForClass(capture.retentionClass ?? "standard", flags);
    const repairRequired = flags.restricted && capture.redaction?.applied !== true;
    pushSurface({
      surface: flags.restricted ? "restricted_metadata" : "raw_capture",
      id: capture.id,
      tenantId: capture.tenantId,
      captureId: capture.id,
      sourceId: capture.sourceId,
      retentionClass: capture.retentionClass,
      currentAction: action,
      effectiveAction: flags.legalHold ? "legal_hold" : action,
      legalHold: flags.legalHold,
      redaction: {
        metadataOnly: flags.metadataOnly,
        restricted: flags.restricted,
        repairRequired,
        rawBodyIncluded: false,
        objectKeyIncluded: false,
        unsafeUrlIncluded: false
      },
      audit: {
        contentHash: capture.contentHash,
        replayCheckpointId: stableId("retention-replay", `capture:${capture.id}:${capture.contentHash}:${capture.retentionClass ?? "standard"}`),
        observedAt: capture.collectedAt,
        retentionTransition: flags.legalHold ? "legal_hold_preserved" : action
      },
      eligibility: retentionEligibility(flags, repairRequired),
      blockers: uniqueStrings([
        ...(flags.restricted && Boolean(capture.body) ? ["restricted_body_present"] : []),
        ...(repairRequired ? ["redaction_repair_required"] : [])
      ]),
      rollbackAction: flags.legalHold ? "preserve capture metadata and object refs under legal hold" : "restore capture metadata from immutable hash checkpoint"
    });
    if (capture.storageKind === "external_object" && capture.objectRef) {
      const manifestEntry = objectManifest.entries.find((entry) => entry.captureId === capture.id);
      const objectMissing = objectVerification.missingObjectCaptureIds.includes(capture.id);
      const objectMismatch = objectVerification.hashMismatchCaptureIds.includes(capture.id);
      pushSurface({
        surface: "object_ref",
        id: stableId("retention-object", capture.id),
        tenantId: capture.tenantId,
        captureId: capture.id,
        sourceId: capture.sourceId,
        retentionClass: capture.retentionClass,
        currentAction: retentionActionForClass(capture.retentionClass ?? "standard", flags) === "delete_object" ? "delete_object" : "retain",
        effectiveAction: flags.legalHold ? "legal_hold" : objectMissing || objectMismatch ? "retain" : retentionActionForClass(capture.retentionClass ?? "standard", flags) === "delete_object" ? "delete_object" : "retain",
        legalHold: flags.legalHold,
        redaction: {
          metadataOnly: false,
          restricted: flags.restricted,
          repairRequired: false,
          rawBodyIncluded: false,
          objectKeyIncluded: false,
          unsafeUrlIncluded: false
        },
        audit: {
          contentHash: capture.contentHash,
          objectRefHash: manifestEntry?.objectRefHash ?? stableId("object-ref", `${capture.objectRef.bucket}:${capture.objectRef.sha256}`),
          replayCheckpointId: stableId("retention-replay", `object:${capture.id}:${capture.objectRef.sha256}`),
          observedAt: capture.collectedAt,
          retentionTransition: flags.legalHold ? "legal_hold_preserved" : "object_manifest_verified"
        },
        eligibility: retentionEligibility(flags, objectMissing || objectMismatch),
        blockers: uniqueStrings([
          ...(objectMissing ? ["missing_object_ref"] : []),
          ...(objectMismatch ? ["hash_mismatch"] : [])
        ]),
        rollbackAction: "restore object ref or keep previous object manifest checkpoint"
      });
    }
  }

  for (const document of handoff.documents) {
    const restricted = document.redaction.restricted;
    const legalHold = document.redaction.legalHold;
    const vectorSurface = document.embedding.eligible ? "vector_index" : document.embedding.reason === "restricted_metadata_excluded" ? "vector_index" : "search_index";
    pushSurface({
      surface: vectorSurface,
      id: document.documentId,
      tenantId: document.tenantId,
      captureId: document.captureId,
      sourceId: document.sourceId,
      relationshipId: document.relationshipId,
      claimLedgerEntryId: document.claimLedgerEntryId,
      documentId: document.documentId,
      retentionClass: document.redaction.retentionClass,
      currentAction: restricted && !document.embedding.eligible ? "exclude_from_vector" : "refresh_index",
      effectiveAction: legalHold ? "legal_hold" : restricted && !document.embedding.eligible ? "exclude_from_vector" : "refresh_index",
      legalHold,
      redaction: {
        metadataOnly: document.redaction.metadataOnly,
        restricted,
        repairRequired: false,
        rawBodyIncluded: false,
        objectKeyIncluded: false,
        unsafeUrlIncluded: false
      },
      audit: {
        contentHash: document.replay.contentHash,
        replayCheckpointId: document.replay.replayId,
        cursor: document.replay.cursor,
        observedAt: document.freshness.observedAt ?? document.freshness.collectedAt ?? document.freshness.publishedAt,
        retentionTransition: restricted && !document.embedding.eligible ? "search_only_no_embedding" : "index_refresh_allowed"
      },
      eligibility: {
        publicAnswer: restricted ? "partial" : "allow",
        graphExport: restricted ? "hold" : "allow",
        stixPreview: restricted ? "hold" : "allow"
      },
      blockers: restricted && document.embedding.eligible ? ["restricted_embedding_leak"] : [],
      rollbackAction: "delete candidate index document or vector upsert and keep previous alias"
    });
  }

  for (const stage of custody.stages.filter((stage) => stage.stage === "graph_relationship" || stage.stage === "stix_export_preview" || stage.stage === "api_search_answer" || stage.stage === "extraction")) {
    const repairRequired = stage.redaction.restricted && !stage.redaction.metadataOnly;
    pushSurface({
      surface: stage.stage === "graph_relationship" ? "graph_relationship" : stage.stage === "stix_export_preview" ? "stix_preview" : stage.stage === "api_search_answer" ? "api_answer" : "extracted_text",
      id: stage.id,
      tenantId: stage.tenantId,
      captureId: stage.captureId,
      sourceId: stage.sourceId,
      relationshipId: stage.relationshipId,
      claimLedgerEntryId: stage.claimLedgerEntryId,
      retentionClass: stage.retentionClass,
      currentAction: stage.redaction.legalHold ? "legal_hold" : stage.stage === "graph_relationship" || stage.stage === "stix_export_preview" ? "hold_export" : "refresh_index",
      effectiveAction: stage.redaction.legalHold ? "legal_hold" : stage.redaction.restricted || repairRequired ? "hold_export" : stage.stage === "api_search_answer" || stage.stage === "extraction" ? "refresh_index" : "retain",
      legalHold: stage.redaction.legalHold,
      redaction: {
        metadataOnly: stage.redaction.metadataOnly,
        restricted: stage.redaction.restricted,
        repairRequired,
        rawBodyIncluded: false,
        objectKeyIncluded: false,
        unsafeUrlIncluded: false
      },
      audit: {
        contentHash: stage.contentHash,
        objectRefHash: stage.objectRefHash,
        replayCheckpointId: stage.replay.replayId,
        cursor: stage.replay.cursor,
        observedAt: stage.observedAt,
        retentionTransition: stage.redaction.legalHold ? "legal_hold_preserved" : stage.redaction.restricted ? "review_hold" : "eligible"
      },
      eligibility: {
        publicAnswer: stage.redaction.restricted ? "partial" : "allow",
        graphExport: stage.redaction.restricted || stage.reviewState === "needs-human-review" ? "hold" : "allow",
        stixPreview: stage.redaction.restricted || stage.reviewState === "needs-human-review" ? "hold" : "allow"
      },
      blockers: repairRequired ? ["redaction_repair_required"] : [],
      rollbackAction: "remove candidate projection and replay from custody checkpoint"
    });
  }

  const surfaceBlockers = uniqueStrings(surfaces.flatMap((surface) => surface.blockers));
  const blockers = uniqueStrings([
    ...surfaceBlockers.filter((blocker) => blocker !== "redaction_repair_required"),
    ...migration.validation.blockers
  ]);
  const warnings = uniqueStrings([
    ...surfaceBlockers.filter((blocker) => blocker === "redaction_repair_required"),
    ...migration.validation.warnings,
    ...(surfaces.some((surface) => surface.legalHold) ? ["legal_hold_present"] : []),
    ...(surfaces.some((surface) => surface.effectiveAction === "exclude_from_vector") ? ["restricted_metadata_excluded_from_embedding"] : [])
  ]);
  const status: EvidenceCutoverGateStatus = blockers.length > 0 ? "blocked" : warnings.some((warning) => warning !== "restricted_metadata_excluded_from_embedding") ? "hold" : "ready";
  const graphBlocked = surfaces.some((surface) => surface.surface === "graph_relationship" && surface.eligibility.graphExport === "blocked");
  const graphHeld = surfaces.some((surface) => surface.surface === "graph_relationship" && surface.eligibility.graphExport === "hold");
  const stixBlocked = surfaces.some((surface) => surface.surface === "stix_preview" && surface.eligibility.stixPreview === "blocked");
  const stixHeld = surfaces.some((surface) => surface.surface === "stix_preview" && surface.eligibility.stixPreview === "hold");

  return {
    schemaVersion: "ti.evidence_retention_runtime_enforcement.v1",
    generatedAt,
    enforcementId: stableId("evidence-retention-runtime", `${options.tenantId ?? "global"}:${normalizedQuery}:${surfaces.map((surface) => surface.id).join("|")}`),
    tenantId: options.tenantId,
    query,
    normalizedQuery,
    summary: {
      status,
      publicAnswerRefresh: status === "blocked" ? "hold" : warnings.length > 0 ? "partial" : "allow",
      graphExportEligibility: graphBlocked || blockers.length > 0 ? "blocked" : graphHeld ? "hold" : "allow",
      stixPreviewEligibility: stixBlocked || blockers.length > 0 ? "blocked" : stixHeld ? "hold" : "allow",
      rollbackReady: true
    },
    counts: {
      captures: captures.length,
      objectRefs: objectManifest.entryCount,
      indexDocuments: handoff.counts.total,
      graphRelationships: custody.counts.graph_relationship,
      stixPreviews: custody.counts.stix_export_preview,
      legalHoldItems: surfaces.filter((surface) => surface.legalHold).length,
      redactionRepairItems: surfaces.filter((surface) => surface.redaction.repairRequired).length,
      retentionTransitionItems: surfaces.filter((surface) => surface.audit.retentionTransition).length,
      blockedItems: surfaces.filter((surface) => surface.blockers.length > 0).length
    },
    surfaces: dedupeRetentionSurfaces(surfaces),
    validation: {
      blockers,
      warnings,
      checks: {
        objectManifestVerified: objectVerification.safeToRestore,
        legalHoldPreserved: surfaces.filter((surface) => surface.legalHold).every((surface) => surface.effectiveAction === "legal_hold"),
        redactionSafe: !surfaces.some((surface) => surface.redaction.repairRequired || surface.redaction.rawBodyIncluded || surface.redaction.objectKeyIncluded || surface.redaction.unsafeUrlIncluded),
        replayReady: replay.replayable,
        indexMigrationSafe: migration.validation.status !== "blocked",
        restrictedMetadataSearchableNotEmbedded: handoff.documents.filter((document) => document.redaction.restricted).every((document) => !document.embedding.eligible),
        graphExportHonorsHolds: !surfaces.some((surface) => surface.surface === "graph_relationship" && surface.redaction.restricted && surface.eligibility.graphExport === "allow"),
        stixPreviewHonorsHolds: !surfaces.some((surface) => surface.surface === "stix_preview" && surface.redaction.restricted && surface.eligibility.stixPreview === "allow"),
        retentionTransitionsAudited: surfaces.every((surface) => Boolean(surface.audit.replayCheckpointId) && Boolean(surface.rollbackAction))
      }
    },
    handoffs: {
      agent01Governance: "retention class and legal-hold state are visible for source governance and approval review",
      agent02SchedulerReplay: "replay checkpoints expose safe queue replay after retention transitions",
      agent05RestrictedMetadata: "restricted metadata remains searchable, metadata-only, and excluded from vector embeddings",
      agent07AnswerRefresh: "public answer refresh is partial or held when legal hold, redaction repair, or replay blockers exist",
      agent08GraphExport: "graph/STIX export eligibility honors legal hold, restricted metadata, and review holds",
      agent09ApiSdk: "API clients receive compact enforcement fields without raw bodies, object keys, or unsafe URLs",
      agent10RollbackRunbook: "rollback actions preserve previous indexes, object manifests, and custody checkpoints"
    },
    safeOutput: {
      rawBodiesExposed: false,
      objectKeysExposed: false,
      unsafeUrlsExposed: false,
      credentialsExposed: false,
      privateMaterialExposed: false,
      restrictedRawContentExposed: false,
      actorInteractionExposed: false
    }
  };
}

export function buildEvidenceSearchConsistencySloReport(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  query: string,
  options: { tenantId?: string; generatedAt?: string; extractorVersion?: string } = {}
): EvidenceSearchConsistencySloReport {
  const generatedAt = options.generatedAt ?? nowIso();
  const handoff = buildEvidenceSearchIndexHandoff(store, query, { tenantId: options.tenantId, generatedAt });
  const migration = buildEvidenceIndexReplayMigrationReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const custody = buildEvidenceChainOfCustodyReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const retention = buildEvidenceRetentionRuntimeReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const captureDocuments = handoff.documents.filter((document) => document.kind === "capture");
  const restrictedDocuments = handoff.documents.filter((document) => document.redaction.restricted);
  const metadataOnlyDocuments = handoff.documents.filter((document) => document.redaction.metadataOnly);
  const vectorDocuments = handoff.documents.filter((document) => document.embedding.eligible);
  const documentIds = handoff.documents.map((document) => document.documentId);
  const checks: EvidenceSearchConsistencySloReport["consistency"]["checks"] = {
    documentsPresent: handoff.documents.length > 0,
    deterministicDocumentIds: new Set(documentIds).size === documentIds.length && handoff.documents.every((document) => document.documentId.startsWith("evidence-search-")),
    tenantRoutingPresent: handoff.documents.every((document) => Boolean(document.backendHints.routingKey) && (!options.tenantId || document.backendHints.routingKey.startsWith(`${options.tenantId}:`))),
    replayIdsPresent: handoff.documents.every((document) => Boolean(document.replay.replayId)),
    citationSpansPresent: handoff.documents.every((document) => document.citationSpans.length > 0),
    contentHashesPresentForCaptures: captureDocuments.every((document) => Boolean(document.replay.contentHash)),
    objectManifestVerified: migration.validation.checks.objectRefsVerified,
    cursorReplayComplete: migration.validation.checks.cursorReplayComplete,
    custodyChainReady: custody.verification.status === "ready",
    retentionRuntimeSafe: retention.summary.status !== "blocked" && retention.validation.checks.redactionSafe,
    restrictedMetadataSearchableNotEmbedded: restrictedDocuments.every((document) => !document.embedding.eligible && document.embedding.reason === "restricted_metadata_excluded"),
    vectorInputsHashOnly: vectorDocuments.every((document) => Boolean(document.embedding.inputTextHash) && document.embedding.reason === "public_text"),
    graphAndStixRespectReviewHolds: retention.validation.checks.graphExportHonorsHolds && retention.validation.checks.stixPreviewHonorsHolds,
    apiAnswerRefreshSafe: retention.summary.publicAnswerRefresh !== "hold" && migration.validation.checks.apiAnswersConsistent
  };
  const blockers = uniqueStrings([
    ...(checks.documentsPresent ? [] : ["no_search_documents"]),
    ...(checks.deterministicDocumentIds ? [] : ["non_deterministic_document_ids"]),
    ...(checks.tenantRoutingPresent ? [] : ["tenant_routing_missing"]),
    ...(checks.replayIdsPresent ? [] : ["replay_ids_missing"]),
    ...(checks.citationSpansPresent ? [] : ["citation_spans_missing"]),
    ...(checks.contentHashesPresentForCaptures ? [] : ["capture_content_hash_missing"]),
    ...(checks.objectManifestVerified ? [] : migration.consistency.missingObjectCaptureIds.map((id) => `missing_object_ref:${id}`)),
    ...(checks.restrictedMetadataSearchableNotEmbedded ? [] : ["restricted_metadata_embedding_leak"]),
    ...(checks.vectorInputsHashOnly ? [] : ["vector_input_not_hash_only"]),
    ...migration.validation.blockers,
    ...retention.validation.blockers
  ]);
  const warnings = uniqueStrings([
    ...(checks.cursorReplayComplete ? [] : ["cursor_replay_incomplete"]),
    ...(checks.custodyChainReady ? custody.verification.warnings.map((warning) => `custody:${warning}`) : ["custody_chain_hold"]),
    ...(checks.retentionRuntimeSafe ? [] : ["retention_runtime_hold"]),
    ...(checks.graphAndStixRespectReviewHolds ? [] : ["graph_or_stix_review_hold_drift"]),
    ...(checks.apiAnswerRefreshSafe ? [] : ["api_answer_refresh_partial"]),
    ...migration.validation.warnings
      .filter((warning) => warning !== "restricted_metadata_excluded_from_embedding")
      .map((warning) => `migration:${warning}`),
    ...retention.validation.warnings
      .filter((warning) => warning !== "restricted_metadata_excluded_from_embedding")
      .map((warning) => `retention:${warning}`)
  ]);
  const status: EvidenceCutoverGateStatus = blockers.length > 0 ? "blocked" : warnings.length > 0 ? "hold" : "ready";
  const estimatedInitialPartialMs = Math.min(3000, 200 + handoff.documents.length * 40 + custody.counts.api_search_answer * 120);
  const estimatedIndexRefreshMs = Math.min(30000, 1000 + handoff.documents.length * 250 + migration.consistency.graphRelationshipDocuments * 500);
  const estimatedVectorUpsertMs = Math.min(30000, 750 + handoff.counts.embeddingEligible * 500);
  const repairQueue: EvidenceSearchConsistencySloReport["repairQueue"] = [
    ...(checks.documentsPresent ? [] : [{
      code: "search_documents_missing",
      owner: "Agent 06" as const,
      action: "replay captures, deltas, claims, graph relationships, and source metadata into the search handoff",
      dryRun: true as const,
      willMutate: false as const,
      willStartCrawling: false as const
    }]),
    ...(checks.objectManifestVerified ? [] : [{
      code: "object_manifest_repair",
      owner: "Agent 06" as const,
      action: "restore missing object refs or hold candidate index alias until object hashes verify",
      dryRun: true as const,
      willMutate: false as const,
      willStartCrawling: false as const
    }]),
    ...(checks.cursorReplayComplete ? [] : [{
      code: "cursor_replay_gap",
      owner: "Agent 09" as const,
      action: "keep polling on previous cursor and replay missing evidence deltas before API refresh",
      dryRun: true as const,
      willMutate: false as const,
      willStartCrawling: false as const
    }]),
    ...(checks.graphAndStixRespectReviewHolds ? [] : [{
      code: "graph_stix_hold_drift",
      owner: "Agent 08" as const,
      action: "hold graph/STIX exports until review-held and restricted metadata relationships are reconciled",
      dryRun: true as const,
      willMutate: false as const,
      willStartCrawling: false as const
    }]),
    ...(checks.apiAnswerRefreshSafe ? [] : [{
      code: "public_answer_partial",
      owner: "Agent 07" as const,
      action: "serve partial answer with explicit evidence replay and retention caveats",
      dryRun: true as const,
      willMutate: false as const,
      willStartCrawling: false as const
    }])
  ];

  return {
    schemaVersion: "ti.evidence_search_consistency_slo.v1",
    generatedAt,
    sloId: stableId("evidence-search-slo", `${options.tenantId ?? "global"}:${handoff.normalizedQuery}:${handoff.documents.map((document) => document.documentId).join("|")}`),
    tenantId: options.tenantId,
    query: handoff.query,
    normalizedQuery: handoff.normalizedQuery,
    summary: {
      status,
      publicAnswerState: blockers.length > 0 ? "hold" : warnings.length > 0 ? "partial" : "ready",
      indexRefreshState: blockers.length > 0 ? "hold" : warnings.length > 0 ? "partial" : "ready",
      vectorState: handoff.counts.embeddingEligible === 0 ? "search_only" : checks.vectorInputsHashOnly && checks.restrictedMetadataSearchableNotEmbedded ? "ready" : "hold",
      rollbackReady: migration.rollback.reversible && retention.summary.rollbackReady
    },
    latencyBudget: {
      initialPartialP95Ms: 3000,
      cursorReplayP95Ms: 3000,
      indexRefreshP95Ms: 30000,
      vectorUpsertP95Ms: 30000,
      estimatedInitialPartialMs,
      estimatedIndexRefreshMs,
      estimatedVectorUpsertMs
    },
    counts: {
      documents: handoff.counts.total,
      captures: handoff.counts.captures,
      deltas: handoff.counts.deltas,
      claims: handoff.counts.claims,
      graphRelationships: handoff.counts.graphRelationships,
      sourceDocuments: handoff.counts.sources,
      embeddingEligible: handoff.counts.embeddingEligible,
      restrictedMetadataDocuments: restrictedDocuments.length,
      metadataOnlyDocuments: metadataOnlyDocuments.length,
      replayableDocuments: handoff.documents.filter((document) => Boolean(document.replay.replayId)).length,
      apiAnswerStages: custody.counts.api_search_answer,
      stixPreviewStages: custody.counts.stix_export_preview
    },
    consistency: {
      status,
      blockers,
      warnings,
      checks
    },
    repairQueue,
    handoffs: {
      agent02Scheduler: "cursor replay completeness and estimated initial latency feed scheduler freshness and polling SLOs",
      agent07Quality: "public answers stay partial when evidence replay, retention, or custody warnings affect search consistency",
      agent08Graph: "graph/STIX consistency rows preserve review holds and restricted metadata export boundaries",
      agent09ApiSdk: "API clients receive stable document ids, replay ids, routing keys, cursors, and repair packets",
      agent10Release: "release gates can hold or rollback index cutover without starting collection or exposing unsafe material"
    },
    safeOutput: {
      rawBodiesExposed: false,
      objectKeysExposed: false,
      unsafeUrlsExposed: false,
      credentialsExposed: false,
      restrictedRawContentExposed: false,
      actorInteractionExposed: false
    }
  };
}

export function buildEvidenceObjectIntegrityRepairReport(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  query: string,
  options: { tenantId?: string; generatedAt?: string; extractorVersion?: string } = {}
): EvidenceObjectIntegrityRepairReport {
  const generatedAt = options.generatedAt ?? nowIso();
  const normalizedQuery = normalizeQuery(query);
  const handoff = buildEvidenceSearchIndexHandoff(store, query, { tenantId: options.tenantId, generatedAt });
  const custody = buildEvidenceChainOfCustodyReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const searchSlo = buildEvidenceSearchConsistencySloReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const captureIds = uniqueStrings([
    ...handoff.documents.flatMap((document) => document.captureId ? [document.captureId] : []),
    ...custody.stages.flatMap((stage) => stage.captureId ? [stage.captureId] : [])
  ]);
  const backup = buildEvidenceBackupIntegrityReport(store, objects, {
    tenantId: options.tenantId,
    generatedAt,
    captureIds
  });
  const relevantCaptures = store.listCaptures()
    .filter((capture) => !options.tenantId || capture.tenantId === options.tenantId)
    .filter((capture) => captureIds.includes(capture.id) || evidenceMetadataValue(capture.metadata, "normalizedQuery") === normalizedQuery);
  const objectCaptures = relevantCaptures.filter((capture) => capture.storageKind === "external_object" && capture.objectRef);
  const mismatchByCapture = new Map(backup.hashMismatches.map((mismatch) => [mismatch.captureId, mismatch]));
  const missing = new Set(backup.missingObjectIds);
  const objectChecks: EvidenceObjectIntegrityRepairReport["objectChecks"] = objectCaptures.map((capture) => {
    const mismatch = mismatchByCapture.get(capture.id);
    const state: EvidenceObjectIntegrityRepairReport["objectChecks"][number]["state"] = missing.has(capture.id)
      ? "missing"
      : mismatch
        ? "hash_mismatch"
        : "verified";
    const legalHold = capture.legalHold === true || capture.retentionClass === "legal_hold";
    return {
      captureId: capture.id,
      tenantId: capture.tenantId,
      sourceId: capture.sourceId,
      retentionClass: capture.retentionClass,
      legalHold,
      state,
      objectRefHash: capture.objectRef ? stableId("object-ref", `${capture.objectRef.bucket}:${capture.objectRef.sha256}`) : undefined,
      contentHash: capture.contentHash,
      expectedSha256: capture.objectRef?.sha256,
      actualSha256: mismatch?.actualSha256,
      replayCheckpointId: stableId("object-repair-replay", `${capture.id}:${capture.contentHash}:${state}`),
      blockers: uniqueStrings([
        ...(state === "missing" ? ["missing_object"] : []),
        ...(state === "hash_mismatch" ? ["hash_mismatch"] : [])
      ]),
      repairAction: legalHold
        ? "hold_under_legal_hold"
        : state === "missing"
          ? "restore_object_from_backup"
          : state === "hash_mismatch"
            ? "recompute_manifest_after_restore"
            : "none"
    };
  });
  const metadataOnlyCaptures = relevantCaptures.filter((capture) =>
    capture.storageKind === "metadata_only"
    || capture.redaction?.policy === "metadata_only"
    || capture.redaction?.applied === true && isRestrictedCapture(capture)
  );
  const restrictedCaptures = relevantCaptures.filter((capture) => isRestrictedCapture(capture));
  const blockers = uniqueStrings([
    ...backup.missingObjectIds.map((id) => `missing_object:${id}`),
    ...backup.hashMismatches.map((mismatch) => `hash_mismatch:${mismatch.captureId}`),
    ...backup.orphanRows.map((row) => `orphan_row:${row.table}:${row.id}`)
  ]);
  const warnings = uniqueStrings([
    ...(metadataOnlyCaptures.some((capture) => capture.objectRef) ? ["metadata_only_capture_has_object_ref"] : []),
    ...(objectChecks.some((check) => check.legalHold && check.state !== "verified") ? ["legal_hold_object_repair_required"] : []),
    ...(searchSlo.summary.status === "blocked" ? ["search_consistency_blocked_by_object_integrity"] : [])
  ]);
  const status: EvidenceCutoverGateStatus = blockers.length > 0 ? "blocked" : warnings.length > 0 ? "hold" : "ready";
  const graphBlocked = custody.verification.blockers.some((blocker) => blocker.startsWith("missing_relationship_capture") || blocker.startsWith("broken_hash_chain"));
  const graphHeld = custody.verification.warnings.some((warning) => warning.startsWith("export_without_review"));

  return {
    schemaVersion: "ti.evidence_object_integrity_repair.v1",
    generatedAt,
    repairId: stableId("evidence-object-repair", `${options.tenantId ?? "global"}:${normalizedQuery}:${objectChecks.map((check) => `${check.captureId}:${check.state}`).join("|")}`),
    tenantId: options.tenantId,
    query,
    normalizedQuery,
    summary: {
      status,
      publicAnswerImpact: blockers.length > 0 ? "hold" : warnings.length > 0 ? "partial" : "none",
      indexCutoverImpact: blockers.length > 0 ? "hold" : "none",
      graphExportImpact: graphBlocked ? "blocked" : graphHeld || blockers.length > 0 ? "hold" : "none",
      stixExportImpact: graphBlocked ? "blocked" : graphHeld || blockers.length > 0 ? "hold" : "none",
      rollbackReady: true
    },
    counts: {
      expectedObjects: backup.expectedObjectCount,
      verifiedObjects: backup.verifiedObjectCount,
      missingObjects: backup.missingObjectIds.length,
      hashMismatches: backup.hashMismatches.length,
      orphanRows: backup.orphanRows.length,
      legalHoldObjects: objectChecks.filter((check) => check.legalHold).length,
      metadataOnlyCaptures: metadataOnlyCaptures.length,
      restrictedCaptures: restrictedCaptures.length
    },
    objectChecks,
    orphanRows: backup.orphanRows,
    operatorRunbook: [
      {
        order: 1,
        code: "verify_manifest",
        action: "verify object manifest rows against capture content hashes and object SHA-256 values",
        dryRun: true,
        willMutate: false,
        willStartCrawling: false,
        rollbackAction: "keep previous object manifest checkpoint active"
      },
      {
        order: 2,
        code: "restore_missing_object",
        action: "restore missing objects from backup or object-lock version before index alias cutover",
        dryRun: true,
        willMutate: false,
        willStartCrawling: false,
        rollbackAction: "continue serving previous index or partial public answer"
      },
      {
        order: 3,
        code: "quarantine_hash_mismatch",
        action: "quarantine mismatched object refs and recompute manifest after restore verification",
        dryRun: true,
        willMutate: false,
        willStartCrawling: false,
        rollbackAction: "hold candidate object manifest and preserve current capture metadata"
      },
      {
        order: 4,
        code: "replay_indexes",
        action: "replay search, vector, graph, and API answer projections from verified capture hashes",
        dryRun: true,
        willMutate: false,
        willStartCrawling: false,
        rollbackAction: "drop candidate index/vector namespace and replay from previous cursor"
      },
      {
        order: 5,
        code: "refresh_public_answer",
        action: "refresh public answer only after object integrity and search consistency blockers clear",
        dryRun: true,
        willMutate: false,
        willStartCrawling: false,
        rollbackAction: "serve previous answer or safe partial answer with object-integrity caveat"
      },
      {
        order: 6,
        code: "legal_hold_preserve",
        action: "preserve legal-hold object refs and metadata while repair work is pending",
        dryRun: true,
        willMutate: false,
        willStartCrawling: false,
        rollbackAction: "restore legal-hold checkpoint and audit row"
      }
    ],
    validation: {
      blockers,
      warnings,
      checks: {
        manifestComplete: backup.missingObjectIds.length === 0,
        hashesMatch: backup.hashMismatches.length === 0,
        noObjectKeysExposed: true,
        noRawBodiesExposed: true,
        legalHoldPreserved: objectChecks.filter((check) => check.legalHold).every((check) => check.repairAction === "hold_under_legal_hold" || check.state === "verified"),
        metadataOnlyCapturesHaveNoObjects: metadataOnlyCaptures.every((capture) => !capture.objectRef && capture.storageKind === "metadata_only"),
        replayAfterRepairReady: searchSlo.summary.rollbackReady,
        searchConsistencyHeldOnMissingObjects: backup.missingObjectIds.length === 0 || searchSlo.summary.status === "blocked"
      }
    },
    handoffs: {
      agent02Replay: "object repair checkpoints identify captures that must replay before queue restart/cursor catch-up",
      agent07PublicAnswer: "public answers remain partial or held while missing objects or hash mismatches affect promoted evidence",
      agent08GraphStix: "graph and STIX exports stay held or blocked until object-backed relationships verify",
      agent09ApiSdk: "API exposes object integrity repair state with capture ids, hashes, and dry-run actions only",
      agent10IncidentRunbook: "release and incident runbooks can restore objects, quarantine mismatches, and rollback candidate indexes"
    },
    safeOutput: {
      rawBodiesExposed: false,
      objectKeysExposed: false,
      unsafeUrlsExposed: false,
      credentialsExposed: false,
      restrictedRawContentExposed: false,
      actorInteractionExposed: false
    }
  };
}

export function buildEvidenceSearchBackendMigrationReadinessReport(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  query: string,
  options: { tenantId?: string; generatedAt?: string; extractorVersion?: string } = {}
): EvidenceSearchBackendMigrationReadinessReport {
  const generatedAt = options.generatedAt ?? nowIso();
  const handoff = buildEvidenceSearchIndexHandoff(store, query, { tenantId: options.tenantId, generatedAt });
  const migration = buildEvidenceIndexReplayMigrationReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const objectRepair = buildEvidenceObjectIntegrityRepairReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const retention = buildEvidenceRetentionRuntimeReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const slo = buildEvidenceSearchConsistencySloReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const routingKeys = uniqueStrings(handoff.documents.map((document) => document.backendHints.routingKey));
  const cursors = uniqueStrings(handoff.documents.flatMap((document) => document.replay.cursor ? [document.replay.cursor] : []));
  const retentionClasses = uniqueStrings(handoff.documents.flatMap((document) => document.redaction.retentionClass ? [document.redaction.retentionClass] : []));
  const legalHoldCount = handoff.documents.filter((document) => document.redaction.legalHold).length;
  const blockers = uniqueStrings([
    ...migration.validation.blockers,
    ...objectRepair.validation.blockers,
    ...(retention.summary.status === "blocked" ? ["retention_runtime_blocked"] : []),
    ...(slo.summary.status === "blocked" ? ["search_consistency_slo_blocked"] : [])
  ]);
  const warnings = uniqueStrings([
    ...migration.validation.warnings,
    ...objectRepair.validation.warnings,
    ...(retention.summary.status === "hold" ? ["retention_runtime_hold"] : []),
    ...(slo.summary.status === "hold" ? ["search_consistency_slo_hold"] : [])
  ]);
  const status: EvidenceCutoverGateStatus = blockers.length > 0 ? "blocked" : warnings.length > 0 ? "hold" : "ready";
  const openSearchReady = status === "ready" && migration.validation.checks.cursorReplayComplete && routingKeys.length > 0;
  const pgvectorReady = status === "ready" && slo.consistency.checks.vectorInputsHashOnly && migration.validation.checks.restrictedMetadataHeldFromEmbedding;
  const aliasCutoverReady = openSearchReady && pgvectorReady && objectRepair.summary.indexCutoverImpact === "none";
  const deletionReplayReady = retention.surfaces.every((surface) => surface.effectiveAction !== "delete_object" || !surface.legalHold);
  const latestCursor = cursors.sort().at(-1);

  return {
    schemaVersion: "ti.evidence_search_backend_migration_readiness.v1",
    generatedAt,
    readinessId: stableId("evidence-search-backend-readiness", `${options.tenantId ?? "global"}:${handoff.normalizedQuery}:${migration.replayInputs.checksum}`),
    tenantId: options.tenantId,
    query: handoff.query,
    normalizedQuery: handoff.normalizedQuery,
    summary: {
      status,
      openSearchReady,
      pgvectorReady,
      aliasCutoverReady,
      deletionReplayReady,
      rollbackReady: migration.rollback.reversible && objectRepair.summary.rollbackReady && retention.summary.rollbackReady
    },
    backends: {
      openSearch: {
        candidateIndex: `${migration.targetBackends.openSearchIndex}-candidate`,
        readAlias: "ti-evidence-read",
        writeAlias: "ti-evidence-write-candidate",
        routingKeyCount: routingKeys.length,
        documentCount: handoff.counts.total,
        bulkCheckpointId: stableId("opensearch-bulk", `${migration.migrationId}:${handoff.counts.total}`),
        ready: openSearchReady
      },
      pgvector: {
        namespace: migration.targetBackends.vectorNamespace,
        candidateTable: "evidence_vector_candidate",
        embeddingEligibleCount: handoff.counts.embeddingEligible,
        excludedRestrictedCount: handoff.counts.restrictedMetadataExcludedFromEmbedding,
        inputHashOnly: slo.consistency.checks.vectorInputsHashOnly,
        ready: pgvectorReady
      },
      postgres: {
        cursorSource: "evidence_delta_cursor",
        replayCheckpointId: stableId("postgres-evidence-replay", `${migration.migrationId}:${latestCursor ?? "no-cursor"}`),
        retentionClassCount: retentionClasses.length,
        legalHoldCount,
        ready: migration.validation.checks.cursorReplayComplete && migration.validation.checks.retentionClassPreserved
      }
    },
    checkpoints: [
      { order: 1, checkpoint: "snapshot_source", cursor: latestCursor, rowCount: handoff.counts.sources, ready: handoff.counts.sources > 0, rollbackAction: "keep previous source/search snapshot active" },
      { order: 2, checkpoint: "bulk_index", cursor: latestCursor, rowCount: handoff.counts.total, ready: openSearchReady, rollbackAction: "drop candidate OpenSearch index before alias swap" },
      { order: 3, checkpoint: "vector_upsert", cursor: latestCursor, rowCount: handoff.counts.embeddingEligible, ready: pgvectorReady, rollbackAction: "truncate candidate vector namespace and keep lexical ranking" },
      { order: 4, checkpoint: "delete_replay", cursor: latestCursor, rowCount: retention.surfaces.filter((surface) => surface.effectiveAction === "delete_object" || surface.effectiveAction === "delete_body").length, ready: deletionReplayReady, rollbackAction: "restore legal-hold/tombstone checkpoint and replay deletion audit" },
      { order: 5, checkpoint: "alias_swap", cursor: latestCursor, rowCount: handoff.counts.total, ready: aliasCutoverReady, rollbackAction: "swap read alias back to previous index and disable candidate vector namespace" },
      { order: 6, checkpoint: "api_refresh", cursor: latestCursor, rowCount: migration.consistency.apiSearchAnswerStages, ready: slo.consistency.checks.apiAnswerRefreshSafe, rollbackAction: "serve previous API answer or safe partial answer" },
      { order: 7, checkpoint: "rollback", cursor: latestCursor, rowCount: handoff.counts.total, ready: migration.rollback.reversible, rollbackAction: "run alias rollback then replay from previous cursor checkpoint" }
    ],
    policy: {
      redactionSafe: migration.validation.checks.redactionSafe && retention.validation.checks.redactionSafe,
      legalHoldPreserved: objectRepair.validation.checks.legalHoldPreserved && retention.validation.checks.legalHoldPreserved,
      restrictedMetadataSearchable: handoff.counts.restrictedMetadataExcludedFromEmbedding > 0 || handoff.documents.every((document) => !document.redaction.restricted),
      restrictedMetadataEmbedded: false,
      deletionReplayMode: "tombstone_then_delete_object",
      metadataOnlyRestrictedMode: "index_safe_metadata_only"
    },
    fixtures: [
      { name: "clean_cutover", expectedState: "ready", proof: "all object/search/retention/cursor gates pass before alias swap", safeOutput: true },
      { name: "missing_object", expectedState: "blocked", proof: "missing object refs block bulk index and public answer refresh", safeOutput: true },
      { name: "hash_mismatch", expectedState: "blocked", proof: "hash mismatches quarantine candidate objects before replay", safeOutput: true },
      { name: "restricted_metadata", expectedState: "ready", proof: "restricted metadata remains searchable and excluded from pgvector embeddings", safeOutput: true },
      { name: "legal_hold", expectedState: "hold", proof: "legal hold preserves object/index rows and overrides deletion replay", safeOutput: true },
      { name: "redaction_delete", expectedState: "hold", proof: "redaction repair tombstones unsafe surfaces before candidate alias promotion", safeOutput: true },
      { name: "rollback_alias", expectedState: "ready", proof: "candidate index/vector namespace can be dropped and read alias restored", safeOutput: true }
    ],
    blockers,
    warnings,
    handoffs: {
      agent02ReplayDebt: "replay checkpoints and cursor rows define scheduler debt before source fanout resumes",
      agent07AnswerQuality: "API answer refresh remains partial while object, redaction, or vector gates hold",
      agent08GraphStix: "graph/STIX consumers use the same replay checkpoint and review holds as search aliases",
      agent09ApiContract: "API clients receive stable backend readiness fields, aliases, checkpoints, blockers, and rollback state",
      agent10ReleaseRollback: "release board can promote or roll back OpenSearch/pgvector cutover without live backend mutation"
    },
    safeOutput: {
      rawBodiesExposed: false,
      objectKeysExposed: false,
      unsafeUrlsExposed: false,
      credentialsExposed: false,
      restrictedRawContentExposed: false,
      actorInteractionExposed: false
    }
  };
}

export function buildEvidenceReplayBenchmarkReport(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  query: string,
  options: { tenantId?: string; runId?: string; sinceCursor?: string; generatedAt?: string; extractorVersion?: string; simulatedCaptureMetadataRecords?: number } = {}
): EvidenceReplayBenchmarkReport {
  const generatedAt = options.generatedAt ?? nowIso();
  const simulatedCaptureMetadataRecords = options.simulatedCaptureMetadataRecords ?? 1_000_000;
  const chunkSize = 10_000;
  const chunkCount = Math.ceil(simulatedCaptureMetadataRecords / chunkSize);
  const handoff = buildEvidenceSearchIndexHandoff(store, query, { tenantId: options.tenantId, generatedAt });
  const replay = buildEvidenceReplayProof(store, query, {
    tenantId: options.tenantId,
    runId: options.runId,
    sinceCursor: options.sinceCursor
  });
  const custody = buildEvidenceChainOfCustodyReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const migration = buildEvidenceSearchBackendMigrationReadinessReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const consistency = buildEvidenceSearchConsistencySloReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const retention = buildEvidenceRetentionRuntimeReport(store, objects, query, {
    tenantId: options.tenantId,
    generatedAt,
    extractorVersion: options.extractorVersion
  });
  const restrictedSeed = Math.max(60_000, handoff.counts.restrictedMetadataExcludedFromEmbedding * chunkSize);
  const restrictedMetadataRowsEstimated = Math.min(simulatedCaptureMetadataRecords, restrictedSeed);
  const sourceRowsEstimated = Math.max(10_000, handoff.counts.sources * 1_000);
  const extractionRowsEstimated = Math.max(simulatedCaptureMetadataRecords, handoff.counts.deltas * chunkSize);
  const relationshipRowsEstimated = Math.max(1, Math.round(simulatedCaptureMetadataRecords * 0.18));
  const claimRowsEstimated = Math.max(1, Math.round(simulatedCaptureMetadataRecords * 0.12));
  const objectBackedCaptureRatio = handoff.counts.captures > 0
    ? Math.min(1, Math.max(0.01, handoff.documents.filter((document) => document.kind === "capture" && !document.redaction.metadataOnly).length / handoff.counts.captures))
    : 0.75;
  const blockers = uniqueStrings([
    ...(replay.replayable ? [] : replay.steps.filter((step) => !step.ok).map((step) => `missing_replay_stage:${step.stage}`)),
    ...migration.blockers,
    ...(retention.summary.status === "blocked" ? ["retention_runtime_blocked"] : []),
    ...(consistency.summary.status === "blocked" ? ["search_consistency_slo_blocked"] : [])
  ]);
  const warnings = uniqueStrings([
    ...migration.warnings,
    ...(retention.summary.status === "hold" ? ["retention_runtime_hold"] : []),
    ...(consistency.summary.status === "hold" ? ["search_consistency_slo_hold"] : []),
    ...(custody.verification.status === "hold" ? ["chain_of_custody_hold"] : []),
    ...(simulatedCaptureMetadataRecords < 1_000_000 ? ["benchmark_below_1m_target"] : [])
  ]);
  const graphState: "ready" | "hold" | "blocked" = blockers.some((blocker) => blocker.includes("relationship") || blocker.includes("search_consistency"))
    ? "blocked"
    : custody.verification.checks.graphRelationship
      ? "ready"
      : "hold";
  const stixState: "ready" | "hold" | "blocked" = blockers.some((blocker) => blocker.includes("retention") || blocker.includes("missing_replay_stage"))
    ? "blocked"
    : custody.verification.checks.stixExportReviewed
      ? "ready"
      : "hold";
  const publicAnswerState: "ready" | "partial" | "hold" = blockers.length > 0
    ? "hold"
    : migration.summary.aliasCutoverReady && consistency.consistency.checks.apiAnswerRefreshSafe
      ? "ready"
      : "partial";
  const status: EvidenceCutoverGateStatus = blockers.length > 0 ? "blocked" : warnings.length > 0 || graphState === "hold" || stixState === "hold" ? "hold" : "ready";
  const replayCheckpointId = stableId("evidence-replay-benchmark-checkpoint", `${options.tenantId ?? "global"}:${handoff.normalizedQuery}:${replay.nextCursor ?? "no-cursor"}:${simulatedCaptureMetadataRecords}`);
  const metadataReplayP95Ms = Math.min(600_000, Math.max(10_000, Math.round((simulatedCaptureMetadataRecords / 60_000) * 1_000)));
  const searchRebuildP95Ms = Math.min(900_000, Math.max(30_000, Math.round((simulatedCaptureMetadataRecords / 40_000) * 1_000)));
  const graphRebuildP95Ms = Math.min(900_000, Math.max(20_000, Math.round((relationshipRowsEstimated / 20_000) * 1_000)));
  const stixPreviewP95Ms = Math.min(600_000, Math.max(10_000, Math.round((claimRowsEstimated / 30_000) * 1_000)));

  return {
    schemaVersion: "ti.evidence_replay_benchmark.v1",
    generatedAt,
    benchmarkId: stableId("evidence-replay-benchmark", `${replayCheckpointId}:${status}`),
    tenantId: options.tenantId,
    query: handoff.query,
    normalizedQuery: handoff.normalizedQuery,
    summary: {
      status,
      simulatedCaptureMetadataRecords,
      chunks: chunkCount,
      chunkSize,
      replayable: replay.replayable,
      publicAnswerRebuild: publicAnswerState,
      graphRebuild: graphState,
      stixRebuild: stixState
    },
    scaleModel: {
      simulatedCaptureMetadataRecords,
      chunkSize,
      chunkCount,
      sourceRowsEstimated,
      extractionRowsEstimated,
      relationshipRowsEstimated,
      claimRowsEstimated,
      restrictedMetadataRowsEstimated,
      metadataOnlyRowsIndexed: true,
      restrictedRowsEmbedded: false,
      objectBackedCaptureRatio,
      replayCursorCheckpointEveryRows: chunkSize
    },
    throughput: {
      captureMetadataRowsPerSecond: 60_000,
      extractionDeltaRowsPerSecond: 45_000,
      searchDocumentsPerSecond: 40_000,
      graphRelationshipsPerSecond: 20_000,
      stixDescriptorsPerSecond: 30_000
    },
    latencyBudget: {
      publicAnswerInitialP95Ms: consistency.latencyBudget.initialPartialP95Ms,
      publicAnswerFullRefreshP95Ms: consistency.latencyBudget.indexRefreshP95Ms,
      metadataReplayP95Ms,
      searchRebuildP95Ms,
      graphRebuildP95Ms,
      stixPreviewP95Ms
    },
    rebuildBehavior: {
      replayCheckpointId,
      searchIndexAlias: "blue_green_alias_swap",
      publicAnswer: {
        state: publicAnswerState,
        expectedUsefulAnswerRate: publicAnswerState === "ready" ? 1 : publicAnswerState === "partial" ? 0.75 : 0,
        expectedFactRecall: publicAnswerState === "ready" ? 0.95 : publicAnswerState === "partial" ? 0.7 : 0,
        sourceEvidenceRequired: true,
        restrictedMetadataCanSupportDefensiveFacts: true
      },
      graph: {
        state: graphState,
        relationshipDeltaReplay: true,
        reviewHoldsRespected: true,
        estimatedRelationshipDeltas: relationshipRowsEstimated
      },
      stix: {
        state: stixState,
        descriptorOnlyRestrictedMetadata: true,
        reviewedExportRequired: true,
        estimatedDescriptors: Math.max(1, Math.round(claimRowsEstimated * 0.35))
      }
    },
    safety: {
      restrictedMetadataSearchable: true,
      restrictedMetadataEmbedded: false,
      rawBodiesLoadedDuringBenchmark: false,
      rawBodiesExposed: false,
      objectKeysExposed: false,
      unsafeUrlsExposed: false,
      credentialsExposed: false,
      restrictedRawContentExposed: false,
      actorInteractionExposed: false
    },
    fixtures: [
      { name: "one_million_public_metadata", records: 1_000_000, expectedState: "ready", proof: "chunked capture metadata replay rebuilds search and public answers from cursors", safeOutput: true },
      { name: "restricted_metadata_60k", records: 60_000, expectedState: "ready", proof: "restricted defensive metadata indexes without raw body load or vector embedding", safeOutput: true },
      { name: "mixed_tenant_10k_sources", records: 10_000, expectedState: "ready", proof: "tenant routing and source rows are checkpointed independently of capture chunks", safeOutput: true },
      { name: "missing_object_replay_hold", records: chunkSize, expectedState: "blocked", proof: "missing object refs hold public answer refresh and graph/STIX rebuilds", safeOutput: true },
      { name: "legal_hold_deletion_replay", records: chunkSize, expectedState: "hold", proof: "legal hold prevents destructive object deletion while replaying tombstones", safeOutput: true },
      { name: "cursor_gap_resume", records: chunkSize, expectedState: "blocked", proof: "cursor gaps resume from previous checkpoint and block alias promotion", safeOutput: true },
      { name: "graph_stix_rebuild", records: relationshipRowsEstimated, expectedState: "ready", proof: "relationship deltas and reviewed STIX descriptors rebuild from evidence cursors", safeOutput: true }
    ],
    blockers,
    warnings,
    handoffs: {
      agent02ReplayPartition: "schedule evidence replay as chunked background work with cursor checkpoints every 10k metadata rows",
      agent05RestrictedMetadataIndex: "index restricted leak/victim claims as safe metadata only; never embed or load leaked bodies",
      agent07MeasuredQuality: "compare public answer useful-rate and expected fact recall before and after replay refresh",
      agent08GraphStixReplay: "rebuild graph relationships from relationship deltas and keep STIX descriptor export review-gated",
      agent09ApiPolling: "surface replay checkpoint, partial answer state, and cursor progress through public API polling",
      agent10SoakDecision: "use throughput and p95 budgets as release soak criteria for 1M capture metadata replay"
    },
    safeOutput: {
      rawBodiesExposed: false,
      objectKeysExposed: false,
      unsafeUrlsExposed: false,
      credentialsExposed: false,
      restrictedRawContentExposed: false,
      actorInteractionExposed: false
    }
  };
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

function captureSearchDocument(
  capture: RawCapture,
  normalizedQuery: string,
  query: string
): EvidenceSearchIndexDocument {
  const restricted = isRestrictedCapture(capture);
  const metadataOnly = capture.storageKind === "metadata_only" || capture.redaction?.policy === "metadata_only" || restricted;
  const title = safeText([
    stringMetadata(capture.metadata.title),
    stringMetadata(capture.metadata.headline),
    `Capture ${capture.id}`
  ]);
  const summary = safeText([
    stringMetadata(capture.metadata.summary),
    stringMetadata(capture.metadata.safeSummary),
    leakMetadataSummary(capture.metadata),
    capture.redaction?.safeExcerpt,
    `Capture ${capture.id} from source ${capture.sourceId}`
  ]);
  const searchText = safeText([
    title,
    summary,
    stringMetadata(capture.metadata.company),
    stringMetadata(capture.metadata.victim),
    stringMetadata(capture.metadata.actor),
    stringMetadata(capture.metadata.threatActor),
    stringMetadata(capture.metadata.datasetSize),
    stringMetadata(capture.metadata.affectedAccounts),
    stringMetadata(capture.metadata.sourceHash),
    capture.contentHash
  ]);
  return {
    schemaVersion: "ti.evidence_search_index_document.v1",
    documentId: stableId("evidence-search-capture", `${capture.id}:${capture.contentHash}:${capture.normalizedTextHash ?? ""}`),
    kind: "capture",
    tenantId: capture.tenantId,
    sourceId: capture.sourceId,
    captureId: capture.id,
    query,
    normalizedQuery,
    title,
    summary,
    searchText,
    tags: safeTags([
      ...stringArrayMetadata(capture.metadata.tags),
      ...stringArrayMetadata(capture.metadata.actors),
      ...stringArrayMetadata(capture.metadata.cves),
      capture.retentionClass,
      capture.storageKind,
      ...(restricted ? ["restricted_metadata"] : [])
    ]),
    freshness: {
      observedAt: stringMetadata(capture.metadata.observedAt),
      collectedAt: capture.collectedAt,
      publishedAt: capture.publishedAt
    },
    confidence: numericMetadata(capture.metadata.confidence),
    replay: {
      replayId: stableId("evidence-search-replay", `capture:${capture.id}:${capture.contentHash}:${stringMetadata(capture.metadata.extractorVersion) ?? "current"}`),
      captureId: capture.id,
      contentHash: capture.contentHash,
      normalizedTextHash: capture.normalizedTextHash,
      extractorVersion: stringMetadata(capture.metadata.extractorVersion) ?? "current"
    },
    citationSpans: [{
      label: "capture",
      captureId: capture.id,
      sourceId: capture.sourceId,
      contentHash: capture.contentHash
    }],
    embedding: embeddingBoundary(searchText, {
      restricted,
      metadataOnly,
      legalHold: capture.legalHold === true || capture.retentionClass === "legal_hold"
    }),
    redaction: {
      metadataOnly,
      restricted,
      legalHold: capture.legalHold === true || capture.retentionClass === "legal_hold",
      retentionClass: capture.retentionClass,
      rawBodyIncluded: false,
      objectKeyIncluded: false,
      unsafeUrlIncluded: false
    },
    backendHints: backendHints(capture.tenantId, capture.sourceId)
  };
}

function deltaSearchDocument(
  delta: EvidenceDelta,
  normalizedQuery: string,
  query: string
): EvidenceSearchIndexDocument {
  const summary = safeText([
    `${delta.kind} ${delta.subjectType} delta`,
    delta.subjectId,
    stringMetadata(delta.metadata.reviewState),
    stringMetadata(delta.metadata.extractorVersion)
  ]);
  return {
    schemaVersion: "ti.evidence_search_index_document.v1",
    documentId: stableId("evidence-search-delta", `${delta.id}:${delta.cursor}`),
    kind: "evidence_delta",
    tenantId: delta.tenantId,
    sourceId: delta.sourceId,
    captureId: delta.captureIds[0],
    query,
    normalizedQuery,
    title: `${delta.subjectType} ${delta.kind}`,
    summary,
    searchText: safeText([summary, delta.subjectId, ...delta.captureIds, ...delta.incidentIds, ...delta.relationshipIds]),
    tags: safeTags([delta.kind, delta.subjectType, delta.retentionClass, stringMetadata(delta.metadata.reviewState)]),
    freshness: {
      observedAt: delta.observedAt,
      cursor: delta.cursor
    },
    confidence: numericMetadata(delta.metadata.confidence),
    replay: {
      replayId: stableId("evidence-search-replay", `delta:${delta.id}:${delta.cursor}`),
      deltaId: delta.id,
      cursor: delta.cursor,
      contentHash: stringMetadata(delta.metadata.contentHash),
      extractorVersion: stringMetadata(delta.metadata.extractorVersion)
    },
    citationSpans: delta.captureIds.length > 0
      ? delta.captureIds.map((captureId) => ({
        label: delta.subjectType,
        captureId,
        sourceId: delta.sourceId,
        contentHash: stringMetadata(delta.metadata.contentHash)
      }))
      : [{ label: delta.subjectType, sourceId: delta.sourceId }],
    embedding: embeddingBoundary(summary, {
      restricted: delta.retentionClass === "restricted_metadata" || delta.retentionClass === "darknet_metadata" || delta.retentionClass === "sensitive_metadata",
      metadataOnly: true,
      legalHold: delta.retentionClass === "legal_hold"
    }),
    redaction: {
      metadataOnly: true,
      restricted: delta.retentionClass === "restricted_metadata" || delta.retentionClass === "darknet_metadata" || delta.retentionClass === "sensitive_metadata",
      legalHold: delta.retentionClass === "legal_hold",
      retentionClass: delta.retentionClass,
      rawBodyIncluded: false,
      objectKeyIncluded: false,
      unsafeUrlIncluded: false
    },
    backendHints: backendHints(delta.tenantId, delta.sourceId ?? delta.subjectType)
  };
}

function claimSearchDocument(
  entry: AnalystClaimLedgerEntry,
  normalizedQuery: string,
  query: string
): EvidenceSearchIndexDocument {
  const restricted = entry.retentionClass === "restricted_metadata"
    || entry.retentionClass === "darknet_metadata"
    || entry.retentionClass === "sensitive_metadata"
    || entry.ledgerStatus === "metadata_review"
    || entry.ledgerStatus === "held";
  const summary = safeText([
    entry.claimTextSummary,
    entry.company,
    entry.victim,
    entry.sourceHash,
    entry.contradictionReason
  ]);
  return {
    schemaVersion: "ti.evidence_search_index_document.v1",
    documentId: stableId("evidence-search-claim", `${entry.id}:${entry.updatedAt ?? entry.createdAt}`),
    kind: "claim",
    tenantId: entry.tenantId,
    sourceId: entry.sourceId,
    captureId: entry.captureId,
    claimLedgerEntryId: entry.id,
    query,
    normalizedQuery,
    title: `${entry.claimKind} ${entry.ledgerStatus}`,
    summary,
    searchText: safeText([summary, entry.claimKind, entry.ledgerStatus, entry.company, entry.victim]),
    tags: safeTags([entry.claimKind, entry.ledgerStatus, entry.retentionClass, entry.graphEligible ? "graph_eligible" : undefined, entry.stixEligible ? "stix_eligible" : undefined]),
    freshness: {
      observedAt: entry.observedAt,
      collectedAt: entry.createdAt
    },
    confidence: entry.confidence,
    replay: {
      replayId: stableId("evidence-search-replay", `claim:${entry.id}:${entry.sourceHash}:${entry.ledgerStatus}`),
      captureId: entry.captureId,
      contentHash: entry.sourceHash
    },
    citationSpans: [{
      label: "claim-ledger",
      captureId: entry.captureId,
      sourceId: entry.sourceId,
      contentHash: entry.sourceHash
    }],
    embedding: embeddingBoundary(summary, {
      restricted,
      metadataOnly: restricted,
      legalHold: entry.legalHold === true || entry.retentionClass === "legal_hold"
    }),
    redaction: {
      metadataOnly: restricted,
      restricted,
      legalHold: entry.legalHold === true || entry.retentionClass === "legal_hold",
      retentionClass: entry.retentionClass,
      rawBodyIncluded: false,
      objectKeyIncluded: false,
      unsafeUrlIncluded: false
    },
    backendHints: backendHints(entry.tenantId, entry.sourceId)
  };
}

function relationshipSearchDocument(
  delta: EvidenceDelta,
  relationshipId: string,
  normalizedQuery: string,
  query: string
): EvidenceSearchIndexDocument {
  const summary = safeText([
    `Graph relationship ${relationshipId} ${delta.kind}`,
    stringMetadata(delta.metadata.reviewState),
    ...delta.captureIds,
    ...delta.incidentIds
  ]);
  return {
    schemaVersion: "ti.evidence_search_index_document.v1",
    documentId: stableId("evidence-search-relationship", `${relationshipId}:${delta.id}:${delta.cursor}`),
    kind: "graph_relationship",
    tenantId: delta.tenantId,
    sourceId: delta.sourceId,
    captureId: delta.captureIds[0],
    relationshipId,
    query,
    normalizedQuery,
    title: `Relationship ${relationshipId}`,
    summary,
    searchText: safeText([summary, relationshipId, delta.kind, stringMetadata(delta.metadata.reviewState)]),
    tags: safeTags(["graph", "relationship", delta.kind, stringMetadata(delta.metadata.reviewState)]),
    freshness: {
      observedAt: delta.observedAt,
      cursor: delta.cursor
    },
    confidence: numericMetadata(delta.metadata.confidence),
    replay: {
      replayId: stableId("evidence-search-replay", `relationship:${relationshipId}:${delta.cursor}`),
      deltaId: delta.id,
      cursor: delta.cursor
    },
    citationSpans: delta.captureIds.map((captureId) => ({
      label: "relationship",
      captureId,
      sourceId: delta.sourceId
    })),
    embedding: embeddingBoundary(summary, {
      restricted: delta.retentionClass === "restricted_metadata" || delta.retentionClass === "darknet_metadata" || delta.retentionClass === "sensitive_metadata",
      metadataOnly: true,
      legalHold: delta.retentionClass === "legal_hold"
    }),
    redaction: {
      metadataOnly: true,
      restricted: delta.retentionClass === "restricted_metadata" || delta.retentionClass === "darknet_metadata" || delta.retentionClass === "sensitive_metadata",
      legalHold: delta.retentionClass === "legal_hold",
      retentionClass: delta.retentionClass,
      rawBodyIncluded: false,
      objectKeyIncluded: false,
      unsafeUrlIncluded: false
    },
    backendHints: backendHints(delta.tenantId, delta.sourceId ?? "graph")
  };
}

function sourceSearchDocument(
  source: SourceRecord,
  normalizedQuery: string,
  query: string
): EvidenceSearchIndexDocument {
  const restricted = source.risk === "restricted" || source.governance?.metadataOnly === true || source.catalog?.approvalScope === "metadata_only";
  const summary = safeText([
    source.name,
    source.type,
    source.status,
    source.risk,
    source.catalog?.canonicalId,
    source.catalog?.publisher.name,
    source.health?.status,
    source.scoring ? `reliability ${source.scoring.reliability}` : undefined,
    source.legalNotes
  ]);
  return {
    schemaVersion: "ti.evidence_search_index_document.v1",
    documentId: stableId("evidence-search-source", `${source.id}:${source.updatedAt}`),
    kind: "source",
    tenantId: source.tenantId,
    sourceId: source.id,
    query,
    normalizedQuery,
    title: source.name,
    summary,
    searchText: safeText([summary, ...stringArrayMetadata(source.tags), ...(source.catalog?.coverage.actors ?? []), ...(source.catalog?.coverage.topics ?? [])]),
    tags: safeTags([source.type, source.status, source.risk, source.catalog?.approvalScope, ...(source.tags ?? [])]),
    freshness: {
      observedAt: source.lastSeenAt,
      collectedAt: source.crawlState?.lastCollectedAt
    },
    confidence: source.trustScore,
    replay: {
      replayId: stableId("evidence-search-replay", `source:${source.id}:${source.updatedAt}`)
    },
    citationSpans: [{
      label: "source",
      sourceId: source.id
    }],
    embedding: embeddingBoundary(summary, {
      restricted,
      metadataOnly: restricted,
      legalHold: source.catalog?.retentionClass === "legal_hold"
    }),
    redaction: {
      metadataOnly: restricted,
      restricted,
      legalHold: source.catalog?.retentionClass === "legal_hold",
      retentionClass: source.catalog?.retentionClass,
      rawBodyIncluded: false,
      objectKeyIncluded: false,
      unsafeUrlIncluded: false
    },
    backendHints: backendHints(source.tenantId, source.id)
  };
}

function chainStage(input: {
  stage: EvidenceChainStageKind;
  id: string;
  tenantId?: string;
  sourceId?: string;
  captureId?: string;
  runId?: string;
  claimLedgerEntryId?: string;
  relationshipId?: string;
  observedAt?: string;
  contentHash?: string;
  objectRefHash?: string;
  parserVersion?: string;
  confidence?: number;
  retentionClass?: RetentionClass;
  reviewState?: string;
  restricted?: boolean;
  metadataOnly?: boolean;
  legalHold?: boolean;
  replayId: string;
  cursor?: string;
  replayable?: boolean;
}): EvidenceChainStage {
  return {
    stage: input.stage,
    id: input.id,
    tenantId: input.tenantId,
    sourceId: input.sourceId,
    captureId: input.captureId,
    runId: input.runId,
    claimLedgerEntryId: input.claimLedgerEntryId,
    relationshipId: input.relationshipId,
    observedAt: input.observedAt,
    contentHash: input.contentHash,
    objectRefHash: input.objectRefHash,
    parserVersion: input.parserVersion,
    confidence: input.confidence,
    retentionClass: input.retentionClass,
    reviewState: input.reviewState,
    redaction: {
      metadataOnly: input.metadataOnly === true,
      restricted: input.restricted === true,
      legalHold: input.legalHold === true,
      rawBodyIncluded: false,
      objectKeyIncluded: false,
      unsafeUrlIncluded: false
    },
    replay: {
      replayId: input.replayId,
      cursor: input.cursor,
      replayable: input.replayable ?? true
    },
    links: {
      previousStageIds: [],
      nextStageIds: []
    }
  };
}

function linkChainStages(stages: EvidenceChainStage[]): void {
  const byId = new Map(stages.map((stage) => [stage.id, stage]));
  const link = (fromId: string | undefined, toId: string | undefined) => {
    if (!fromId || !toId || fromId === toId) return;
    const from = byId.get(fromId);
    const to = byId.get(toId);
    if (!from || !to) return;
    if (!from.links.nextStageIds.includes(toId)) from.links.nextStageIds.push(toId);
    if (!to.links.previousStageIds.includes(fromId)) to.links.previousStageIds.push(fromId);
  };
  const sourceStages = stages.filter((stage) => stage.stage === "source_registry_event");
  const runStages = stages.filter((stage) => stage.stage === "scheduled_run");
  const captureStages = stages.filter((stage) => stage.stage === "raw_capture");
  const objectStages = stages.filter((stage) => stage.stage === "object_ref");
  const extractionStages = stages.filter((stage) => stage.stage === "extraction");
  const claimStages = stages.filter((stage) => stage.stage === "claim_ledger");
  const relationshipStages = stages.filter((stage) => stage.stage === "graph_relationship");
  const apiStages = stages.filter((stage) => stage.stage === "api_search_answer");
  const stixStages = stages.filter((stage) => stage.stage === "stix_export_preview");

  for (const source of sourceStages) {
    for (const run of runStages.filter((stage) => !stage.sourceId || stage.sourceId === source.sourceId)) link(source.id, run.id);
    for (const capture of captureStages.filter((stage) => stage.sourceId === source.sourceId)) link(source.id, capture.id);
  }
  for (const run of runStages) {
    for (const capture of captureStages.filter((stage) => !stage.runId || stage.runId === run.runId)) link(run.id, capture.id);
  }
  for (const capture of captureStages) {
    for (const object of objectStages.filter((stage) => stage.captureId === capture.captureId)) link(capture.id, object.id);
    for (const extraction of extractionStages.filter((stage) => stage.captureId === capture.captureId)) link(capture.id, extraction.id);
    for (const claim of claimStages.filter((stage) => stage.captureId === capture.captureId)) link(capture.id, claim.id);
    for (const relationship of relationshipStages.filter((stage) => stage.captureId === capture.captureId)) link(capture.id, relationship.id);
  }
  for (const extraction of extractionStages) {
    for (const claim of claimStages.filter((stage) => stage.captureId === extraction.captureId)) link(extraction.id, claim.id);
    for (const relationship of relationshipStages.filter((stage) => stage.captureId === extraction.captureId)) link(extraction.id, relationship.id);
  }
  for (const claim of claimStages) {
    for (const relationship of relationshipStages.filter((stage) => stage.captureId === claim.captureId || stage.sourceId === claim.sourceId)) link(claim.id, relationship.id);
    for (const stix of stixStages.filter((stage) => stage.claimLedgerEntryId === claim.claimLedgerEntryId)) link(claim.id, stix.id);
  }
  for (const relationship of relationshipStages) {
    for (const stix of stixStages.filter((stage) => stage.captureId === relationship.captureId || stage.sourceId === relationship.sourceId)) link(relationship.id, stix.id);
  }
  for (const api of apiStages) {
    for (const stix of stixStages) link(api.id, stix.id);
  }
  for (const stage of stages) {
    stage.links.previousStageIds.sort();
    stage.links.nextStageIds.sort();
  }
}

function countChainStages(stages: EvidenceChainStage[]): Record<EvidenceChainStageKind, number> {
  const counts: Record<EvidenceChainStageKind, number> = {
    source_registry_event: 0,
    scheduled_run: 0,
    raw_capture: 0,
    object_ref: 0,
    extraction: 0,
    claim_ledger: 0,
    graph_relationship: 0,
    api_search_answer: 0,
    stix_export_preview: 0
  };
  for (const stage of stages) counts[stage.stage] += 1;
  return counts;
}

function hasParserVersionDrift(store: CaptureMetadataStore, capture: RawCapture): boolean {
  const currentVersion = stringMetadata(capture.metadata.extractorVersion) ?? capture.provenance?.extractorVersion;
  if (!currentVersion) return false;
  return store.listReplayJobs()
    .filter((job) => job.captureId === capture.id && job.status === "succeeded")
    .some((job) => job.toExtractorVersion !== currentVersion);
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

function isRestrictedCapture(capture: RawCapture): boolean {
  return capture.sensitive
    || capture.storageKind === "metadata_only"
    || capture.retentionClass === "restricted_metadata"
    || capture.retentionClass === "darknet_metadata"
    || capture.retentionClass === "sensitive_metadata"
    || capture.sensitivityFlags?.some(isRestrictedFlag) === true;
}

function isAnalystWorkflowReadStore(store: CaptureMetadataStore): store is CaptureMetadataStore & AnalystWorkflowReadStore {
  const candidate = store as Partial<AnalystWorkflowReadStore>;
  return typeof candidate.listAnalystClaimLedgerEntries === "function"
    && typeof candidate.listAnalystMetadataReviewTasks === "function"
    && typeof candidate.listAnalystLoopSnapshots === "function";
}

function isSourceReadStore(store: CaptureMetadataStore): store is CaptureMetadataStore & SourceReadStore {
  const candidate = store as Partial<SourceReadStore>;
  return typeof candidate.getSource === "function" && typeof candidate.listSources === "function";
}

function sourceMatchesQuery(source: SourceRecord, normalizedQuery: string): boolean {
  const haystack = [
    source.name,
    source.id,
    source.type,
    source.status,
    source.risk,
    ...(source.tags ?? []),
    ...(source.catalog?.coverage.actors ?? []),
    ...(source.catalog?.coverage.aliases ?? []),
    ...(source.catalog?.coverage.topics ?? []),
    ...(source.catalog?.coverage.industries ?? [])
  ].join(" ").toLowerCase();
  return normalizedQuery.length > 0 && haystack.includes(normalizedQuery);
}

function safeText(values: Array<string | undefined>): string {
  return values
    .flatMap((value) => value ? [value] : [])
    .map((value) => value.trim())
    .filter(Boolean)
    .map(redactUnsafeText)
    .join(" | ")
    .slice(0, 1200);
}

function redactUnsafeText(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, "[url-redacted]")
    .replace(/\b[a-z2-7]{16,56}\.onion\b/gi, "[restricted-host-redacted]")
    .replace(/\b(password|credential|secret|token|cookie)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}

function safeTags(values: Array<string | undefined>): string[] {
  return [...new Set(values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => redactUnsafeText(value.trim().toLowerCase()))
  )].slice(0, 32);
}

function leakMetadataSummary(metadata: Record<string, unknown>): string | undefined {
  const parts = [
    stringMetadata(metadata.company) ? `company ${stringMetadata(metadata.company)}` : undefined,
    stringMetadata(metadata.victim) ? `victim ${stringMetadata(metadata.victim)}` : undefined,
    stringMetadata(metadata.affectedAccounts) ? `affected accounts ${stringMetadata(metadata.affectedAccounts)}` : undefined,
    stringMetadata(metadata.datasetSize) ? `dataset size ${stringMetadata(metadata.datasetSize)}` : undefined,
    stringMetadata(metadata.actorStatementSummary) ? `actor statement ${stringMetadata(metadata.actorStatementSummary)}` : undefined,
    stringMetadata(metadata.claimedAt) ? `claimed at ${stringMetadata(metadata.claimedAt)}` : undefined,
    stringMetadata(metadata.sourceHash) ? `source hash ${stringMetadata(metadata.sourceHash)}` : undefined
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join("; ") : undefined;
}

function numericMetadata(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function backendHints(tenantId: string | undefined, routingSeed: string): EvidenceSearchIndexDocument["backendHints"] {
  return {
    openSearchIndex: "ti-evidence-v1",
    vectorNamespace: "ti-evidence",
    routingKey: `${tenantId ?? "global"}:${routingSeed}`
  };
}

function embeddingBoundary(
  searchText: string,
  flags: { restricted: boolean; metadataOnly: boolean; legalHold: boolean }
): EvidenceSearchIndexDocument["embedding"] {
  if (flags.legalHold) {
    return { eligible: false, reason: "policy_hold", modelBoundary: "external_vector_backend" };
  }
  if (!searchText.trim()) {
    return { eligible: false, reason: "no_text", modelBoundary: "external_vector_backend" };
  }
  if (flags.restricted) {
    return { eligible: false, reason: "restricted_metadata_excluded", modelBoundary: "external_vector_backend" };
  }
  if (flags.metadataOnly) {
    return { eligible: false, reason: "metadata_summary_only", modelBoundary: "external_vector_backend" };
  }
  return {
    eligible: true,
    reason: "public_text",
    inputTextHash: hashContent(searchText),
    modelBoundary: "external_vector_backend"
  };
}

function dedupeSearchDocuments(documents: EvidenceSearchIndexDocument[]): EvidenceSearchIndexDocument[] {
  const byId = new Map<string, EvidenceSearchIndexDocument>();
  for (const document of documents) byId.set(document.documentId, document);
  return [...byId.values()].sort((left, right) => left.documentId.localeCompare(right.documentId));
}

function dedupeRetentionSurfaces(surfaces: EvidenceRetentionRuntimeReport["surfaces"]): EvidenceRetentionRuntimeReport["surfaces"] {
  const byKey = new Map<string, EvidenceRetentionRuntimeReport["surfaces"][number]>();
  for (const surface of surfaces) byKey.set(`${surface.surface}:${surface.id}`, surface);
  return [...byKey.values()].sort((left, right) => `${left.surface}:${left.id}`.localeCompare(`${right.surface}:${right.id}`));
}

function retentionFlagsForCapture(capture: RawCapture): { restricted: boolean; metadataOnly: boolean; legalHold: boolean } {
  const restricted = isRestrictedCapture(capture);
  return {
    restricted,
    metadataOnly: capture.storageKind === "metadata_only" || capture.redaction?.policy === "metadata_only" || restricted,
    legalHold: capture.legalHold === true || capture.retentionClass === "legal_hold"
  };
}

function retentionActionForClass(
  retentionClass: RetentionClass,
  flags: { restricted: boolean; metadataOnly: boolean; legalHold: boolean }
): EvidenceRetentionRuntimeReport["surfaces"][number]["currentAction"] {
  if (flags.legalHold || retentionClass === "legal_hold") return "legal_hold";
  if (flags.restricted || flags.metadataOnly) return "retain";
  if (retentionClass === "short") return "delete_capture_metadata";
  if (retentionClass === "public_raw") return "delete_body";
  if (retentionClass === "public_report" || retentionClass === "public_chat_text" || retentionClass === "screenshot_hash") return "delete_object";
  return "retain";
}

function retentionEligibility(
  flags: { restricted: boolean; metadataOnly: boolean; legalHold: boolean },
  repairRequired: boolean
): EvidenceRetentionRuntimeReport["surfaces"][number]["eligibility"] {
  if (repairRequired) {
    return { publicAnswer: "hold", graphExport: "blocked", stixPreview: "blocked" };
  }
  if (flags.legalHold) {
    return { publicAnswer: "partial", graphExport: "hold", stixPreview: "hold" };
  }
  if (flags.restricted || flags.metadataOnly) {
    return { publicAnswer: "partial", graphExport: "hold", stixPreview: "hold" };
  }
  return { publicAnswer: "allow", graphExport: "allow", stixPreview: "allow" };
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
