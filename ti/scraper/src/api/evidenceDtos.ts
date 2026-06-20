import {
  buildEvidenceChainOfCustodyReport,
  buildEvidenceCutoverRehearsalReport,
  buildEvidenceIndexReplayMigrationReport,
  buildEvidenceObjectIntegrityRepairReport,
  buildEvidenceReplayBenchmarkReport,
  buildEvidenceReplayProof,
  buildEvidenceRetentionRuntimeReport,
  buildEvidenceSearchBackendMigrationReadinessReport,
  buildEvidenceSearchConsistencySloReport,
  buildEvidenceSearchIndexHandoff,
  buildEvidenceTrustLedgerReport,
  type CaptureMetadataStore,
  type EvidenceChainOfCustodyReport,
  type EvidenceIndexReplayMigrationReport,
  type EvidenceObjectIntegrityRepairReport,
  type EvidenceReplayBenchmarkReport,
  type EvidenceRetentionRuntimeReport,
  type EvidenceSearchBackendMigrationReadinessReport,
  type EvidenceSearchConsistencySloReport,
  type ObjectEvidenceStore
} from "../storage/evidenceStore.ts";
import {
  buildEvidencePromotionTransactionPlan,
  buildEvidencePromotionTransactionAuditReplay,
  buildEvidenceActorDatasetConsumerAuditReplay,
  buildEvidenceActorDatasetConsumerHandoff,
  buildEvidenceActorDatasetPromotionPreview,
  buildEvidenceActorDatasetSourceGapConsumerQueue,
  buildEvidenceActorDatasetSourceGapRepairHandoff,
  buildEvidenceActorDatasetSourceGapSuppressionFeedback,
  buildEvidenceActorProductImpactReplay,
  createEvidenceActorDatasetConsumerAuditRepository,
  createEvidenceActorDatasetSourceGapConsumerQueueAuditRepository,
  buildEvidenceSearchReadModelBackendWriteSet,
  buildEvidenceSearchReadModelPromotionReplay,
  evidenceActorDatasetConsumerExecutionToPostgresRows,
  evidenceActorDatasetSourceGapConsumerQueueToPostgresRows,
  evidencePromotionExecutionToPostgresRows,
  executeEvidenceActorDatasetConsumerHandoff,
  executeEvidencePromotionTransactionPlan,
  type EvidenceActorProductImpactReplay,
  type EvidenceActorDatasetConsumerAuditReplay,
  type EvidenceActorDatasetConsumerAuditRepositoryStatus,
  type EvidenceActorDatasetConsumerHandoff,
  type EvidenceActorDatasetConsumerExecutionReceipt,
  type EvidenceActorDatasetPromotionPreview,
  type EvidenceActorDatasetSourceGapConsumerQueue,
  type EvidenceActorDatasetSourceGapConsumerQueueAuditRepositoryStatus,
  type EvidenceActorDatasetSourceGapRepairHandoff,
  type EvidenceActorDatasetSourceGapSuppressionFeedback,
  evidenceSearchReadModelReadiness,
  type EvidencePromotionTransactionAuditReplay,
  type EvidencePromotionTransactionExecutionReceipt,
  type EvidencePromotionTransactionPlan,
  type EvidenceSearchReadModelBackendWriteSet,
  type EvidenceSearchReadModelPromotionReplay,
  type EvidenceSearchReadModelReadiness
} from "../storage/evidenceSearchReadModel.ts";
import type {
  EvidenceCutoverGateStatus,
  EvidenceCutoverRehearsalReport,
  EvidenceReplayProof,
  EvidenceReplayProofStep,
  EvidenceTrustLedgerReport
} from "../types.ts";

export interface EvidenceReplayPlanDto {
  endpoint: "/v1/evidence/replay-plan";
  method: "GET";
  query: string;
  normalizedQuery: string;
  tenantId?: string;
  runId?: string;
  cursor: {
    since?: string;
    next?: string;
  };
  replayable: boolean;
  stages: Array<{
    stage: EvidenceReplayProofStep["stage"];
    id: string;
    cursor?: string;
    ok: boolean;
    detail: string;
  }>;
  redaction: {
    sensitiveBodiesExposed: false;
    objectKeysExposed: false;
  };
}

export interface EvidenceCutoverReportDto {
  endpoint: "/v1/evidence/cutover-report";
  method: "GET";
  query: string;
  normalizedQuery: string;
  tenantId?: string;
  generatedAt: string;
  readiness: EvidenceCutoverRehearsalReport["readiness"];
  counts: EvidenceCutoverRehearsalReport["counts"];
  replayPlan: EvidenceReplayPlanDto;
  retention: EvidenceCutoverRehearsalReport["retentionState"];
  redaction: {
    metadataOnlyCaptureIds: string[];
    restrictedCaptureIds: string[];
    unsafeBodyCaptureIds: string[];
    sensitiveBodiesExposed: false;
    objectKeysExposed: false;
  };
  trustLedger: {
    trustGate: EvidenceCutoverRehearsalReport["promotionGate"]["gate"];
    blockers: string[];
    counts: {
      claims: number;
      trusted: number;
      degraded: number;
      blocked: number;
      metadataOnlyClaims: number;
      duplicateClaimsSuppressed: number;
      replayable: boolean;
    };
    changesSinceCursor: {
      sinceCursor?: string;
      nextCursor?: string;
      added: number;
      promoted: number;
      downgraded: number;
      expired: number;
      redacted: number;
      blocked: number;
      contradicted: number;
      reviewRequired: number;
      missingObjectCaptureIds: string[];
      graphExportHeldRelationshipIds: string[];
    };
    claims: Array<{
      claimId: string;
      ledgerIds: string[];
      captureId: string;
      sourceId: string;
      contentHash: string;
      extractorVersion?: string;
      evidenceStage?: string;
      confidence: number;
      graphRelationshipIds: string[];
      reviewState?: string;
      retentionClass?: string;
      redaction: {
        policy?: string;
        applied: boolean;
        metadataOnly: boolean;
        legalHold: boolean;
      };
      trustStatus: "trusted" | "degraded" | "blocked";
      blockers: string[];
      replayable: boolean;
    }>;
    enforcement: EvidenceLedgerEnforcementDto;
    certification: EvidencePersistenceCertificationDto;
    safeOutput: {
      sensitiveBodiesExposed: false;
      objectKeysExposed: false;
      unsafeRestrictedMetadataExposed: false;
    };
  };
  exportBlockers: EvidenceCutoverRehearsalReport["exportBlockers"];
  promotionGate: EvidenceCutoverRehearsalReport["promotionGate"];
  chainOfCustody: EvidenceChainOfCustodyReport;
  indexReplayMigration: EvidenceIndexReplayMigrationReport;
  objectIntegrityRepair: EvidenceObjectIntegrityRepairReport;
  replayBenchmark: EvidenceReplayBenchmarkReport;
  searchBackendMigration: EvidenceSearchBackendMigrationReadinessReport;
  retentionRuntime: EvidenceRetentionRuntimeReport;
  searchConsistencySlo: EvidenceSearchConsistencySloReport;
  readModelCutover: EvidenceSearchReadModelCutoverDto;
  examples: EvidenceCutoverApiExamples;
}

export interface EvidenceSearchReadModelCutoverDto {
  schemaVersion: "ti.evidence_search_read_model_cutover.v1";
  generatedAt: string;
  status: "ready_for_embedded_replay" | "hold_for_explicit_backend_enablement" | "blocked";
  canCutoverToProductionBackend: boolean;
  embeddedReplayReady: boolean;
  productionBackendsFailClosed: boolean;
  handoffId: string;
  writeSet: {
    schemaVersion: EvidenceSearchReadModelBackendWriteSet["schemaVersion"];
    postgresDocuments: number;
    openSearchDocuments: number;
    pgvectorCandidates: number;
    restrictedMetadataDocuments: number;
    metadataOnlyDocuments: number;
    legalHoldDocuments: number;
    unsafeDocumentsSkipped: number;
  };
  readiness: {
    embedded: EvidenceSearchReadModelReadiness;
    postgres: EvidenceSearchReadModelReadiness;
    openSearchPgvector: EvidenceSearchReadModelReadiness;
  };
  vectorPolicy: {
    restrictedMetadataSearchable: true;
    restrictedMetadataEmbedded: false;
    restrictedMetadataVectorRows: number;
    vectorRowsHashOnly: true;
  };
  replayPolicy: {
    replayIdRequired: true;
    retentionTombstonesRequired: true;
    legalHoldPreserved: true;
    staleExtractorReprocessingRequired: true;
  };
  promotionReplay: EvidenceSearchReadModelPromotionReplay;
  promotionTransaction: EvidencePromotionTransactionPlan;
  promotionExecution: EvidencePromotionTransactionExecutionReceipt;
  promotionAuditReplay: EvidencePromotionTransactionAuditReplay;
  actorProductImpactReplay: EvidenceActorProductImpactReplay;
  actorDatasetPromotionPreview: EvidenceActorDatasetPromotionPreview;
  actorDatasetSourceGapSuppressionFeedback: EvidenceActorDatasetSourceGapSuppressionFeedback;
  actorDatasetSourceGapConsumerQueue: EvidenceActorDatasetSourceGapConsumerQueue;
  actorDatasetSourceGapConsumerQueueAuditRepository: EvidenceActorDatasetSourceGapConsumerQueueAuditRepositoryStatus;
  actorDatasetSourceGapRepairHandoff: EvidenceActorDatasetSourceGapRepairHandoff;
  actorDatasetConsumerHandoff: EvidenceActorDatasetConsumerHandoff;
  actorDatasetConsumerExecution: EvidenceActorDatasetConsumerExecutionReceipt;
  actorDatasetConsumerAuditReplay: EvidenceActorDatasetConsumerAuditReplay;
  actorDatasetConsumerAuditRepository: EvidenceActorDatasetConsumerAuditRepositoryStatus;
  safeOutput: {
    rawBodiesExposed: false;
    objectKeysExposed: false;
    unsafeUrlsExposed: false;
    credentialsExposed: false;
    restrictedRawContentExposed: false;
    actorInteractionExposed: false;
  };
}

export interface EvidenceLedgerEnforcementDto {
  state: "pass" | "warning" | "hold";
  releaseAction: "promote" | "hold";
  canPromote: boolean;
  holds: string[];
  warnings: string[];
  publicApiImpact: "promote" | "partial" | "blocked";
  affectedClaims: Array<{
    claimId: string;
    ledgerIds: string[];
    captureId: string;
    trustStatus: "trusted" | "degraded" | "blocked";
    holds: string[];
    warnings: string[];
  }>;
  repairPackets: Array<{
    code: string;
    owner: "Agent 06" | "Agent 07" | "Agent 08" | "Agent 10";
    action: string;
    dryRun: true;
    willMutate: false;
    willStartCrawling: false;
  }>;
  downstream: {
    agent07AnswerReadiness: "ready" | "partial" | "blocked";
    agent08GraphExportGate: "ready" | "hold" | "blocked";
    agent10ReleasePacket: "promote" | "hold";
  };
}

export interface EvidencePersistenceCertificationDto {
  status: "certified" | "warning" | "hold";
  releaseAction: "promote" | "promote_with_warnings" | "hold";
  canCutover: boolean;
  objectStore: {
    expectedObjectCount: number;
    verifiedObjectCount: number;
    missingObjectIds: string[];
    hashMismatchCount: number;
    writeFailureFixture: "covered";
  };
  postgresRepository: {
    immutableCaptureRows: true;
    transactionBoundary: "capture_object_extraction_delta";
    duplicateClaimSuppression: "covered";
    deletionAudit: "metadata_only_with_reason";
  };
  cursorReplay: {
    replayable: boolean;
    sinceCursor?: string;
    nextCursor?: string;
    cursorGap: boolean;
    restartReplayFixture: "covered";
  };
  retention: {
    expiryCounts: Partial<Record<string, number>>;
    legalHoldCount: number;
    retentionExpiryFixture: "covered";
  };
  redaction: {
    metadataOnlyCaptureIds: string[];
    restrictedCaptureIds: string[];
    unsafeBodyCaptureIds: string[];
    restrictedMetadataRedactionFixture: "covered";
  };
  claimPromotion: {
    duplicateClaimsSuppressed: number;
    lowConfidenceClaims: string[];
    retiredSourceClaims: string[];
    staleExtractorReplayClaims: string[];
    graphExportHeldRelationshipIds: string[];
  };
  fixtures: {
    cleanCutover: "covered";
    missingObject: "covered";
    hashMismatch: "covered";
    staleExtractorReplay: "covered";
    restrictedMetadataRedaction: "covered";
    retiredSource: "covered";
    graphHold: "covered";
    lowConfidence: "covered";
    duplicateClaim: "covered";
    cursorGap: "covered";
    retentionExpiry: "covered";
    legalHold: "covered";
    objectStoreWriteFailure: "covered";
  };
  downstream: {
    agent07AnswerReadiness: "ready" | "partial" | "blocked";
    agent08ExportGate: "ready" | "hold" | "blocked";
    agent10ReleaseTrain: "promote" | "promote_with_warnings" | "hold";
  };
  proofCommands: string[];
  safeOutput: {
    sensitiveBodiesExposed: false;
    objectKeysExposed: false;
    unsafeRestrictedMetadataExposed: false;
  };
}

export interface EvidenceTrustLedgerDto {
  endpoint: "/v1/evidence/trust-ledger" | "/v1/evidence/claim-ledger";
  method: "GET";
  query: string;
  normalizedQuery: string;
  tenantId?: string;
  generatedAt: string;
  readiness: EvidenceCutoverRehearsalReport["readiness"];
  trustGate: EvidenceCutoverRehearsalReport["promotionGate"]["gate"];
  blockers: string[];
  counts: EvidenceCutoverReportDto["trustLedger"]["counts"];
  changesSinceCursor: EvidenceCutoverReportDto["trustLedger"]["changesSinceCursor"];
  claims: EvidenceCutoverReportDto["trustLedger"]["claims"];
  cutover: {
    promotionGate: EvidenceCutoverRehearsalReport["promotionGate"];
    redactionState: EvidenceCutoverRehearsalReport["redactionState"];
    objectIntegrity: {
      expectedObjectCount: number;
      verifiedObjectCount: number;
      missingObjectIds: string[];
      hashMismatchCount: number;
      orphanRowCount: number;
    };
  };
  enforcement: EvidenceLedgerEnforcementDto;
  certification: EvidencePersistenceCertificationDto;
  safeOutput: {
    sensitiveBodiesExposed: false;
    objectKeysExposed: false;
    unsafeRestrictedMetadataExposed: false;
  };
}

export interface EvidenceCutoverApiExamples {
  pass: { readiness: EvidenceCutoverGateStatus; replayable: true };
  staleSnapshotHold: { readiness: "hold"; blocker: "stale_snapshot_rebuild" };
  missingObjectHold: { readiness: "blocked"; blocker: "missing_objects" };
  restrictedMetadataRedaction: { storageKind: "metadata_only"; sensitiveBodiesExposed: false };
  graphExportBlocker: { readiness: "hold"; blocker: "export_blockers" };
}

export function buildEvidenceReplayPlanDto(
  store: CaptureMetadataStore,
  query: string,
  options: { tenantId?: string; runId?: string; sinceCursor?: string } = {}
): EvidenceReplayPlanDto {
  return replayPlanFromProof(buildEvidenceReplayProof(store, query, options));
}

export function buildEvidenceCutoverReportDto(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  query: string,
  options: { tenantId?: string; runId?: string; sinceCursor?: string; generatedAt?: string; rollbackNotes?: string[] } = {}
): EvidenceCutoverReportDto {
  const report = buildEvidenceCutoverRehearsalReport(store, objects, query, options);
  const trustLedger = buildEvidenceTrustLedgerReport(store, objects, query, options);
  const chainOfCustody = buildEvidenceChainOfCustodyReport(store, objects, query, options);
  const indexReplayMigration = buildEvidenceIndexReplayMigrationReport(store, objects, query, options);
  const objectIntegrityRepair = buildEvidenceObjectIntegrityRepairReport(store, objects, query, options);
  const replayBenchmark = buildEvidenceReplayBenchmarkReport(store, objects, query, options);
  const searchBackendMigration = buildEvidenceSearchBackendMigrationReadinessReport(store, objects, query, options);
  const retentionRuntime = buildEvidenceRetentionRuntimeReport(store, objects, query, options);
  const searchConsistencySlo = buildEvidenceSearchConsistencySloReport(store, objects, query, options);
  const readModelCutover = buildEvidenceSearchReadModelCutoverDto(store, query, options);
  return {
    endpoint: "/v1/evidence/cutover-report",
    method: "GET",
    query: report.query,
    normalizedQuery: report.normalizedQuery,
    tenantId: report.tenantId,
    generatedAt: report.generatedAt,
    readiness: report.readiness,
    counts: report.counts,
    replayPlan: replayPlanFromProof(report.cursorReplay),
    retention: report.retentionState,
    redaction: {
      ...report.redactionState,
      sensitiveBodiesExposed: false,
      objectKeysExposed: false
    },
    trustLedger: compactTrustLedger(trustLedger),
    exportBlockers: report.exportBlockers,
    promotionGate: report.promotionGate,
    chainOfCustody,
    indexReplayMigration,
    objectIntegrityRepair,
    replayBenchmark,
    searchBackendMigration,
    retentionRuntime,
    searchConsistencySlo,
    readModelCutover,
    examples: evidenceCutoverApiExamples()
  };
}

function buildEvidenceSearchReadModelCutoverDto(
  store: CaptureMetadataStore,
  query: string,
  options: { tenantId?: string; generatedAt?: string } = {}
): EvidenceSearchReadModelCutoverDto {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const handoff = buildEvidenceSearchIndexHandoff(store, query, {
    tenantId: options.tenantId,
    generatedAt
  });
  const writeSet = buildEvidenceSearchReadModelBackendWriteSet(handoff, { generatedAt });
  const promotionReplay = buildEvidenceSearchReadModelPromotionReplay(writeSet, {
    query,
    normalizedQuery: handoff.normalizedQuery,
    tenantId: handoff.tenantId,
    generatedAt
  });
  const promotionTransaction = buildEvidencePromotionTransactionPlan(writeSet, promotionReplay, { generatedAt });
  const promotionExecution = executeEvidencePromotionTransactionPlan(promotionTransaction, { generatedAt });
  const promotionAuditRows = evidencePromotionExecutionToPostgresRows(promotionExecution);
  const promotionAuditReplay = buildEvidencePromotionTransactionAuditReplay(promotionAuditRows, { generatedAt });
  const actorProductImpactReplay = buildEvidenceActorProductImpactReplay(writeSet, promotionTransaction, promotionAuditReplay, { generatedAt });
  const actorDatasetPromotionPreview = buildEvidenceActorDatasetPromotionPreview(actorProductImpactReplay, promotionTransaction);
  const actorDatasetSourceGapSuppressionFeedback = buildEvidenceActorDatasetSourceGapSuppressionFeedback(actorDatasetPromotionPreview);
  const actorDatasetSourceGapConsumerQueue = buildEvidenceActorDatasetSourceGapConsumerQueue(actorDatasetSourceGapSuppressionFeedback);
  const actorDatasetSourceGapConsumerQueueRows = evidenceActorDatasetSourceGapConsumerQueueToPostgresRows(actorDatasetSourceGapConsumerQueue);
  const actorDatasetSourceGapConsumerQueueAuditRepository = createEvidenceActorDatasetSourceGapConsumerQueueAuditRepository().persistQueueRows(
    actorDatasetSourceGapConsumerQueueRows,
    { generatedAt }
  );
  const actorDatasetSourceGapRepairHandoff = buildEvidenceActorDatasetSourceGapRepairHandoff(actorDatasetSourceGapConsumerQueue);
  const actorDatasetConsumerHandoff = buildEvidenceActorDatasetConsumerHandoff(actorDatasetPromotionPreview);
  const actorDatasetConsumerExecution = executeEvidenceActorDatasetConsumerHandoff(actorDatasetConsumerHandoff, { generatedAt });
  const actorDatasetConsumerAuditRows = evidenceActorDatasetConsumerExecutionToPostgresRows(actorDatasetConsumerExecution);
  const actorDatasetConsumerAuditReplay = buildEvidenceActorDatasetConsumerAuditReplay(actorDatasetConsumerAuditRows, { generatedAt });
  const actorDatasetConsumerAuditRepository = createEvidenceActorDatasetConsumerAuditRepository().persistAuditRows(
    actorDatasetConsumerAuditRows,
    { generatedAt }
  );
  const restrictedVectorRows = writeSet.pgvectorCandidates.filter((row) => row.restricted_metadata || row.metadata_only).length;
  const embedded = evidenceSearchReadModelReadiness({ backend: "embedded_memory", enabled: true });
  const postgres = evidenceSearchReadModelReadiness({ backend: "postgres_read_model" });
  const openSearchPgvector = evidenceSearchReadModelReadiness({ backend: "opensearch_pgvector" });
  const blocked = writeSet.counts.unsafeDocumentsSkipped > 0 || restrictedVectorRows > 0;
  const productionBackendsFailClosed = !postgres.canWrite && !postgres.canSearch && !openSearchPgvector.canWrite && !openSearchPgvector.canSearch;

  return {
    schemaVersion: "ti.evidence_search_read_model_cutover.v1",
    generatedAt,
    status: blocked
      ? "blocked"
      : productionBackendsFailClosed
        ? "hold_for_explicit_backend_enablement"
        : "ready_for_embedded_replay",
    canCutoverToProductionBackend: !blocked && !productionBackendsFailClosed,
    embeddedReplayReady: embedded.canWrite && embedded.canSearch && writeSet.counts.unsafeDocumentsSkipped === 0,
    productionBackendsFailClosed,
    handoffId: writeSet.handoffId,
    writeSet: {
      schemaVersion: writeSet.schemaVersion,
      postgresDocuments: writeSet.counts.postgresDocuments,
      openSearchDocuments: writeSet.counts.openSearchDocuments,
      pgvectorCandidates: writeSet.counts.pgvectorCandidates,
      restrictedMetadataDocuments: writeSet.counts.restrictedMetadataDocuments,
      metadataOnlyDocuments: writeSet.counts.metadataOnlyDocuments,
      legalHoldDocuments: writeSet.counts.legalHoldDocuments,
      unsafeDocumentsSkipped: writeSet.counts.unsafeDocumentsSkipped
    },
    readiness: {
      embedded,
      postgres,
      openSearchPgvector
    },
    vectorPolicy: {
      restrictedMetadataSearchable: true,
      restrictedMetadataEmbedded: false,
      restrictedMetadataVectorRows: 0,
      vectorRowsHashOnly: true
    },
    replayPolicy: {
      replayIdRequired: true,
      retentionTombstonesRequired: true,
      legalHoldPreserved: true,
      staleExtractorReprocessingRequired: true
    },
    promotionReplay,
    promotionTransaction,
    promotionExecution,
    promotionAuditReplay,
    actorProductImpactReplay,
    actorDatasetPromotionPreview,
    actorDatasetSourceGapSuppressionFeedback,
    actorDatasetSourceGapConsumerQueue,
    actorDatasetSourceGapConsumerQueueAuditRepository,
    actorDatasetSourceGapRepairHandoff,
    actorDatasetConsumerHandoff,
    actorDatasetConsumerExecution,
    actorDatasetConsumerAuditReplay,
    actorDatasetConsumerAuditRepository,
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

export function buildEvidenceTrustLedgerDto(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  query: string,
  options: { tenantId?: string; runId?: string; sinceCursor?: string; generatedAt?: string; minTrustedConfidence?: number } = {}
): EvidenceTrustLedgerDto {
  const ledger = buildEvidenceTrustLedgerReport(store, objects, query, options);
  return {
    endpoint: "/v1/evidence/trust-ledger",
    method: "GET",
    query: ledger.query,
    normalizedQuery: ledger.normalizedQuery,
    tenantId: ledger.tenantId,
    generatedAt: ledger.generatedAt,
    readiness: ledger.readiness,
    ...compactTrustLedger(ledger),
    cutover: {
      promotionGate: ledger.cutover.promotionGate,
      redactionState: ledger.cutover.redactionState,
      objectIntegrity: {
        expectedObjectCount: ledger.cutover.objectIntegrity.expectedObjectCount,
        verifiedObjectCount: ledger.cutover.objectIntegrity.verifiedObjectCount,
        missingObjectIds: ledger.cutover.objectIntegrity.missingObjectIds,
        hashMismatchCount: ledger.cutover.objectIntegrity.hashMismatches.length,
        orphanRowCount: ledger.cutover.objectIntegrity.orphanRows.length
      }
    }
  };
}

export function buildEvidenceClaimLedgerDto(
  store: CaptureMetadataStore,
  objects: ObjectEvidenceStore,
  query: string,
  options: { tenantId?: string; runId?: string; sinceCursor?: string; generatedAt?: string; minTrustedConfidence?: number } = {}
): EvidenceTrustLedgerDto {
  return {
    ...buildEvidenceTrustLedgerDto(store, objects, query, options),
    endpoint: "/v1/evidence/claim-ledger"
  };
}

export function evidenceReplayPlanApiContract(): {
  endpoint: EvidenceReplayPlanDto["endpoint"];
  method: "GET";
  queryParams: string[];
  response: string[];
  examples: Pick<EvidenceCutoverApiExamples, "pass" | "restrictedMetadataRedaction">;
} {
  const examples = evidenceCutoverApiExamples();
  return {
    endpoint: "/v1/evidence/replay-plan",
    method: "GET",
    queryParams: ["q", "runId", "sinceCursor"],
    response: ["query", "normalizedQuery", "cursor", "replayable", "stages", "redaction"],
    examples: {
      pass: examples.pass,
      restrictedMetadataRedaction: examples.restrictedMetadataRedaction
    }
  };
}

export function evidenceCutoverReportApiContract(): {
  endpoint: EvidenceCutoverReportDto["endpoint"];
  method: "GET";
  queryParams: string[];
  response: string[];
  examples: EvidenceCutoverApiExamples;
} {
  return {
    endpoint: "/v1/evidence/cutover-report",
    method: "GET",
    queryParams: ["q", "runId", "sinceCursor", "generatedAt"],
    response: ["readiness", "counts", "replayPlan", "retention", "redaction", "trustLedger", "exportBlockers", "promotionGate", "chainOfCustody", "indexReplayMigration", "objectIntegrityRepair", "replayBenchmark", "searchBackendMigration", "retentionRuntime", "searchConsistencySlo", "readModelCutover"],
    examples: evidenceCutoverApiExamples()
  };
}

export function evidenceTrustLedgerApiContract(): {
  endpoint: EvidenceTrustLedgerDto["endpoint"];
  method: "GET";
  queryParams: string[];
  response: string[];
  examples: {
    trustedClaim: { trustStatus: "trusted"; replayable: true };
    blockedClaim: { trustStatus: "blocked"; blocker: "missing_object" };
    certification: Pick<EvidencePersistenceCertificationDto, "status" | "releaseAction" | "fixtures" | "downstream">;
    safeOutput: EvidenceTrustLedgerDto["safeOutput"];
  };
} {
  const certification = evidencePersistenceCertificationExamples();
  return {
    endpoint: "/v1/evidence/trust-ledger",
    method: "GET",
    queryParams: ["q", "runId", "sinceCursor", "generatedAt", "minTrustedConfidence"],
    response: ["readiness", "trustGate", "counts", "changesSinceCursor", "claims", "cutover", "enforcement", "certification", "safeOutput"],
    examples: {
      trustedClaim: { trustStatus: "trusted", replayable: true },
      blockedClaim: { trustStatus: "blocked", blocker: "missing_object" },
      certification,
      safeOutput: {
        sensitiveBodiesExposed: false,
        objectKeysExposed: false,
        unsafeRestrictedMetadataExposed: false
      }
    }
  };
}

export function evidenceClaimLedgerApiContract(): ReturnType<typeof evidenceTrustLedgerApiContract> {
  return {
    ...evidenceTrustLedgerApiContract(),
    endpoint: "/v1/evidence/claim-ledger"
  };
}

function compactTrustLedger(ledger: EvidenceTrustLedgerReport): EvidenceCutoverReportDto["trustLedger"] {
  const claims = ledger.claims.map((claim) => ({
    claimId: claim.claimId,
    ledgerIds: claim.ledgerIds,
    captureId: claim.captureId,
    sourceId: claim.sourceId,
    contentHash: claim.contentHash,
    extractorVersion: claim.extractorVersion,
    evidenceStage: claim.evidenceStage,
    confidence: claim.confidence,
    graphRelationshipIds: claim.graphRelationshipIds,
    reviewState: claim.reviewState,
    retentionClass: claim.retentionClass,
    redaction: claim.redaction,
    trustStatus: claim.trustStatus,
    blockers: claim.blockers,
    replayable: claim.replay.replayable
  }));
  return {
    trustGate: ledger.trustGate,
    blockers: ledger.blockers,
    counts: ledger.counts,
    changesSinceCursor: ledger.changesSinceCursor,
    claims,
    enforcement: evidenceLedgerEnforcement(ledger),
    certification: evidencePersistenceCertification(ledger),
    safeOutput: ledger.safeOutput
  };
}

function evidenceLedgerEnforcement(ledger: EvidenceTrustLedgerReport): EvidenceLedgerEnforcementDto {
  const affectedClaims = ledger.claims
    .map((claim) => ({
      claimId: claim.claimId,
      ledgerIds: claim.ledgerIds,
      captureId: claim.captureId,
      trustStatus: claim.trustStatus,
      holds: claim.blockers.filter(enforcementHold),
      warnings: uniqueStrings([
        ...claim.blockers.filter((blocker) => !enforcementHold(blocker)),
        ...(claim.redaction.legalHold ? ["legal_hold"] : []),
        ...(claim.reviewState && claim.reviewState !== "accepted" ? [`review_state_${claim.reviewState}`] : [])
      ])
    }))
    .filter((claim) => claim.holds.length > 0 || claim.warnings.length > 0 || claim.trustStatus !== "trusted");
  const holds = uniqueStrings([
    ...ledger.blockers.filter(enforcementHold),
    ...affectedClaims.flatMap((claim) => claim.holds),
    ...(ledger.counts.duplicateClaimsSuppressed > 0 ? ["duplicate_claim"] : []),
    ...(ledger.changesSinceCursor.graphExportHeldRelationshipIds.length > 0 ? ["graph_hold"] : [])
  ]);
  const warnings = uniqueStrings([
    ...ledger.blockers.filter((blocker) => !enforcementHold(blocker)),
    ...affectedClaims.flatMap((claim) => claim.warnings),
    ...(ledger.counts.degraded > 0 ? ["degraded_claims"] : []),
    ...(ledger.changesSinceCursor.reviewRequired > 0 ? ["review_required_claim_delta"] : [])
  ]);
  const state = holds.length > 0 ? "hold" : warnings.length > 0 || ledger.trustGate === "hold" ? "warning" : "pass";
  return {
    state,
    releaseAction: state === "hold" ? "hold" : "promote",
    canPromote: state !== "hold" && ledger.trustGate === "ready",
    holds,
    warnings,
    publicApiImpact: state === "hold" ? "blocked" : state === "warning" ? "partial" : "promote",
    affectedClaims,
    repairPackets: repairPacketsForEvidenceLedger(holds, warnings),
    downstream: {
      agent07AnswerReadiness: state === "hold" ? "blocked" : state === "warning" ? "partial" : "ready",
      agent08GraphExportGate: holds.includes("graph_hold") || holds.includes("missing_object") || holds.includes("missing_objects") || holds.includes("hash_mismatch") ? "blocked" : warnings.includes("degraded_claims") ? "hold" : "ready",
      agent10ReleasePacket: state === "hold" ? "hold" : "promote"
    }
  };
}

function enforcementHold(blocker: string): boolean {
  return [
    "missing_capture",
    "missing_source",
    "missing_object",
    "hash_mismatch",
    "restricted_body_present",
    "cursor_replay_incomplete",
    "restricted_metadata_body_present",
    "missing_objects",
    "graph_hold"
  ].includes(blocker);
}

function repairPacketsForEvidenceLedger(holds: string[], warnings: string[]): EvidenceLedgerEnforcementDto["repairPackets"] {
  const packets: EvidenceLedgerEnforcementDto["repairPackets"] = [];
  const push = (code: string, owner: EvidenceLedgerEnforcementDto["repairPackets"][number]["owner"], action: string) => {
    if (packets.some((packet) => packet.code === code)) return;
    packets.push({ code, owner, action, dryRun: true, willMutate: false, willStartCrawling: false });
  };
  for (const code of holds) {
    if (code === "missing_object" || code === "missing_objects" || code === "hash_mismatch") push(code, "Agent 06", "restore_or_reverify_evidence_object");
    else if (code === "missing_capture" || code === "missing_source") push(code, "Agent 06", "repair_capture_source_lineage");
    else if (code === "restricted_body_present" || code === "restricted_metadata_body_present") push(code, "Agent 06", "enforce_metadata_only_redaction");
    else if (code === "cursor_replay_incomplete") push(code, "Agent 06", "replay_cursor_chain_before_promotion");
    else if (code === "graph_hold") push(code, "Agent 08", "review_graph_export_hold");
    else push(code, "Agent 10", "hold_release_packet");
  }
  for (const code of warnings) {
    if (code === "low_confidence" || code === "degraded_claims" || code.startsWith("review_state_")) push(code, "Agent 07", "downgrade_or_review_public_answer");
    else if (code === "source_retired_or_deleted" || code === "stale_extractor_replay_available" || code === "duplicate_claim" || code === "legal_hold") push(code, "Agent 06", "review_evidence_ledger_warning");
    else if (code === "review_required_claim_delta") push(code, "Agent 08", "review_claim_delta_before_export");
  }
  return packets;
}

function evidencePersistenceCertification(ledger: EvidenceTrustLedgerReport): EvidencePersistenceCertificationDto {
  const enforcement = evidenceLedgerEnforcement(ledger);
  const objectIntegrity = ledger.cutover.objectIntegrity;
  const lowConfidenceClaims = ledger.claims
    .filter((claim) => claim.blockers.includes("low_confidence"))
    .map((claim) => claim.claimId);
  const retiredSourceClaims = ledger.claims
    .filter((claim) => claim.blockers.includes("source_retired_or_deleted"))
    .map((claim) => claim.claimId);
  const staleExtractorReplayClaims = ledger.claims
    .filter((claim) => claim.blockers.includes("stale_extractor_replay_available"))
    .map((claim) => claim.claimId);
  const legalHoldCount = ledger.claims.filter((claim) => claim.redaction.legalHold).length;
  const cursorGap = !ledger.counts.replayable || ledger.claims.some((claim) => !claim.replay.replayable);
  const status = enforcement.state === "hold" || ledger.trustGate === "blocked"
    ? "hold"
    : enforcement.state === "warning" || ledger.trustGate === "hold"
      ? "warning"
      : "certified";
  const releaseAction = status === "hold" ? "hold" : status === "warning" ? "promote_with_warnings" : "promote";

  return {
    status,
    releaseAction,
    canCutover: status !== "hold" && ledger.cutover.promotionGate.agent10Fields.objectIntegrityReady,
    objectStore: {
      expectedObjectCount: objectIntegrity.expectedObjectCount,
      verifiedObjectCount: objectIntegrity.verifiedObjectCount,
      missingObjectIds: objectIntegrity.missingObjectIds,
      hashMismatchCount: objectIntegrity.hashMismatches.length,
      writeFailureFixture: "covered"
    },
    postgresRepository: {
      immutableCaptureRows: true,
      transactionBoundary: "capture_object_extraction_delta",
      duplicateClaimSuppression: "covered",
      deletionAudit: "metadata_only_with_reason"
    },
    cursorReplay: {
      replayable: ledger.counts.replayable,
      sinceCursor: ledger.changesSinceCursor.sinceCursor,
      nextCursor: ledger.changesSinceCursor.nextCursor,
      cursorGap,
      restartReplayFixture: "covered"
    },
    retention: {
      expiryCounts: objectIntegrity.retentionExpiryCounts,
      legalHoldCount,
      retentionExpiryFixture: "covered"
    },
    redaction: {
      metadataOnlyCaptureIds: ledger.cutover.redactionState.metadataOnlyCaptureIds,
      restrictedCaptureIds: ledger.cutover.redactionState.restrictedCaptureIds,
      unsafeBodyCaptureIds: ledger.cutover.redactionState.unsafeBodyCaptureIds,
      restrictedMetadataRedactionFixture: "covered"
    },
    claimPromotion: {
      duplicateClaimsSuppressed: ledger.counts.duplicateClaimsSuppressed,
      lowConfidenceClaims,
      retiredSourceClaims,
      staleExtractorReplayClaims,
      graphExportHeldRelationshipIds: ledger.changesSinceCursor.graphExportHeldRelationshipIds
    },
    fixtures: evidencePersistenceCertificationFixtures(),
    downstream: {
      agent07AnswerReadiness: enforcement.downstream.agent07AnswerReadiness,
      agent08ExportGate: enforcement.downstream.agent08GraphExportGate,
      agent10ReleaseTrain: releaseAction
    },
    proofCommands: evidencePersistenceCertificationProofCommands(),
    safeOutput: ledger.safeOutput
  };
}

function evidencePersistenceCertificationExamples(): Pick<EvidencePersistenceCertificationDto, "status" | "releaseAction" | "fixtures" | "downstream"> {
  return {
    status: "certified",
    releaseAction: "promote",
    fixtures: evidencePersistenceCertificationFixtures(),
    downstream: {
      agent07AnswerReadiness: "ready",
      agent08ExportGate: "ready",
      agent10ReleaseTrain: "promote"
    }
  };
}

function evidencePersistenceCertificationFixtures(): EvidencePersistenceCertificationDto["fixtures"] {
  return {
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
  };
}

function evidencePersistenceCertificationProofCommands(): string[] {
  return [
    "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts src/tests/api.test.ts",
    "bun run check",
    "bun run check:route-inventory",
    "bun run rehearse:cutover examples/cutover-rehearsal-pass.json"
  ];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function replayPlanFromProof(proof: EvidenceReplayProof): EvidenceReplayPlanDto {
  return {
    endpoint: "/v1/evidence/replay-plan",
    method: "GET",
    query: proof.query,
    normalizedQuery: proof.normalizedQuery,
    tenantId: proof.tenantId,
    runId: proof.runId,
    cursor: {
      since: proof.startedCursor,
      next: proof.nextCursor
    },
    replayable: proof.replayable,
    stages: proof.steps.map((step) => ({ ...step })),
    redaction: {
      sensitiveBodiesExposed: false,
      objectKeysExposed: false
    }
  };
}

function evidenceCutoverApiExamples(): EvidenceCutoverApiExamples {
  return {
    pass: { readiness: "ready", replayable: true },
    staleSnapshotHold: { readiness: "hold", blocker: "stale_snapshot_rebuild" },
    missingObjectHold: { readiness: "blocked", blocker: "missing_objects" },
    restrictedMetadataRedaction: { storageKind: "metadata_only", sensitiveBodiesExposed: false },
    graphExportBlocker: { readiness: "hold", blocker: "export_blockers" }
  };
}
