import type { CollectionPlan, CollectionRun, PipelineResult, RawCapture, SourceRecord } from "../types.ts";

export type ObjectEvidenceWrite = any;
export type ObjectEvidenceRecord = any;
export type ObjectEvidenceStore = any;
export type EvaluationLabelType =
  | "actor"
  | "ransomware"
  | "victim"
  | "incident"
  | "cve"
  | "malware"
  | "ttp"
  | "country"
  | "sector"
  | "indicator"
  | "impact"
  | "dataset"
  | "business_mechanism";

export type EvaluationStoreRecord = {
  id: string;
  tenantId?: string;
  [key: string]: unknown;
};

export type EvaluationLineageIdentity = {
  provider: string;
  model: string;
  version: string;
};

export type EvaluationReferenceEvidence = {
  id: string;
  kind: "retained_capture" | "independent_authoritative_reference" | "independent_validation" | "validation_context";
  captureId?: string;
  sourceId?: string;
  referenceCaptureId?: string;
  referenceSourceId?: string;
  referenceContentHash?: string;
  contentHash?: string;
  excerptHash?: string;
  valueSetHash?: string;
  validationType?: string;
  status?: string;
  frozenAt?: string;
  schema?: string;
  excerpt?: string;
  [key: string]: unknown;
};

export type EvaluationIndependenceContext = {
  extractorPredictionsExcluded?: boolean;
  reviewerContextsIsolated?: boolean;
  governedEvidenceComplete?: boolean;
  authoritativeReferenceSetComplete?: boolean;
  authoritativeReferenceSetHash?: string;
  authoritativeReferenceSchema?: string;
  referenceBasis?: string[];
  truthBasis?: string;
  truthEvidenceIds?: string[];
  truthSnapshotHash?: string;
  truthReferenceValidationId?: string;
  truthReferenceCaptureId?: string;
  truthReferenceSourceId?: string;
  truthReferenceContentHash?: string;
  truthReferenceExcerptHash?: string;
  extractionDecisionVersions?: string[];
  extractionDecisionLineage?: Array<EvaluationLineageIdentity | undefined>;
  evaluationModelIsolationRequired?: boolean;
  evaluationModelIsolated?: boolean;
  evaluationProvider?: string;
  evaluationModel?: string;
  evaluationModelVersion?: string;
  evaluationModelIdentity?: EvaluationLineageIdentity;
  evaluationModelConversationId?: string;
  evaluationModelResponseId?: string;
  predictionSnapshotSeparatedAt?: string;
  [key: string]: unknown;
};

export type EvaluationPrediction = {
  value: string;
  confidence?: number;
  entityType: string;
  extractorProvider?: string;
  extractorModel?: string;
  extractorVersion: string;
};

export type EvaluationAutomationState = {
  status?: string;
  stage?: string;
  attemptCount?: number;
  lifetimeAttemptCount?: number;
  maxAttempts?: number;
  replayCount?: number;
  nextAttemptAt?: string;
  leaseExpiresAt?: string;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastFailure?: { code: string; message: string; retryable: boolean; at?: string };
  history?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type EvaluationTaskRecord = {
  id: string;
  benchmarkId?: string;
  captureId?: string;
  labelType?: EvaluationLabelType | string;
  contentHash?: string;
  excerptHash?: string;
  evidenceHashAlgorithm?: string;
  sourceFamily?: string;
  referenceEvidence?: EvaluationReferenceEvidence[];
  referenceEvidenceHash?: string;
  authoritativeExpectedValues?: string[];
  caseTags?: string[];
  independenceContext?: EvaluationIndependenceContext;
  observedValues?: string[];
  observedPredictions?: EvaluationPrediction[];
  extractorVersions?: string[];
  reviewContexts?: Array<{ role: string; contextId: string }>;
  automation?: EvaluationAutomationState;
  [key: string]: unknown;
};

export type EvaluationBenchmarkRecord = {
  id: string;
  tenantId?: string;
  name?: string;
  status: string;
  reviewMode?: "human" | "automatic_model";
  datasetSplit?: "validation" | "test";
  labelTypes?: EvaluationLabelType[];
  requiredReviewers?: number;
  captureIds?: string[];
  taskCount?: number;
  manifest?: EvaluationTaskRecord[];
  protocol?: Record<string, unknown> & {
    version?: string;
    testSplitLocked?: boolean;
    datasetUsage?: string;
    reviewPromptVersion?: string;
    reviewSchemaVersion?: string;
    predictionSnapshotAt?: string;
  };
  automation?: EvaluationAutomationState;
  selectionSeed?: string;
  selectionStrata?: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  [key: string]: unknown;
};

export type EvaluationAnnotationRecord = EvaluationStoreRecord & {
  benchmarkId?: string;
  taskId?: string;
  captureId?: string;
  labelType?: EvaluationLabelType | string;
  reviewerId?: string;
  expectedValues?: string[];
  decision?: string;
  confidence?: number;
  notes?: string;
  rationale?: string;
  evidenceIds?: string[];
  reviewerRole?: string;
  reviewerContextId?: string;
  reviewKind?: string;
  reviewerProvider?: string;
  reviewerModel?: string;
  reviewerModelVersion?: string;
  modelConversationId?: string;
  modelResponseId?: string;
  promptVersion?: string;
  schemaVersion?: string;
  blinded?: boolean;
  predictionAccessed?: boolean;
  independenceAttested?: boolean;
  independenceContext?: EvaluationIndependenceContext;
  annotatedAt?: string;
};

export type EvaluationAdjudicationRecord = EvaluationStoreRecord & {
  benchmarkId?: string;
  taskId?: string;
  captureId?: string;
  labelType?: EvaluationLabelType | string;
  expectedValues?: string[];
  annotationIds?: string[];
  method?: string;
  adjudicatedBy?: string;
  reviewKind?: string;
  decision?: string;
  confidence?: number;
  rationale?: string;
  evidenceIds?: string[];
  reviewerProvider?: string;
  reviewerModel?: string;
  reviewerModelVersion?: string;
  reviewerModelVersions?: string[];
  reviewerContextId?: string;
  modelConversationId?: string;
  modelConversationIds?: string[];
  modelResponseId?: string;
  modelResponseIds?: string[];
  promptVersion?: string;
  schemaVersion?: string;
  independenceAttested?: boolean;
  independenceContext?: EvaluationIndependenceContext;
  adjudicatedAt?: string;
};

export type EvaluationLabelRecord = EvaluationStoreRecord & {
  benchmarkId?: string;
  taskId?: string;
  captureId?: string;
  entityId?: string;
  indicatorId?: string;
  incidentId?: string;
  claimId?: string;
  labelType?: string;
  expectedValue?: string | null;
  observedValue?: string | null;
  outcome?: string;
  datasetSplit?: string;
  labelingMethod?: string;
  labeledBy?: string;
  independentFromExtractor?: boolean;
  exhaustiveExpectedValues?: boolean;
  blinded?: boolean;
  adjudicationStatus?: string;
  independenceContext?: EvaluationIndependenceContext;
  labeledAt?: string;
  evaluationUnitId?: string;
  parserVersion?: string;
  sourceFamily?: string;
  reviewerModelVersion?: string;
  modelVersion?: string;
  reviewPromptVersion?: string;
  reviewSchemaVersion?: string;
  predictionConfidence?: number | null;
  annotationIds?: string[];
  reviewerProvider?: string;
  reviewerModel?: string;
  reviewerModelConversationId?: string;
  reviewerModelVersions?: string[];
  reviewerModelResponseId?: string;
  reviewerModelResponseIds?: string[];
  referenceEvidenceIds?: string[];
  referenceEvidenceHash?: string;
  adjudicationMethod?: string;
  notes?: string;
};

export type EvaluationValidationRecord = EvaluationStoreRecord & {
  captureId?: string;
  incidentId?: string;
  claimId?: string;
  validationType: string;
  status: string;
  referenceUrl: string;
  referenceCaptureId?: string;
  referenceSourceId?: string;
  referenceContentHash?: string;
  labelType?: EvaluationLabelType;
  expectedValues?: string[];
  expectedValuesHash?: string;
  exhaustiveExpectedValues?: boolean;
  truthSchemaVersion?: string;
  truthFrozenAt?: string;
  matchedAt: string;
  reviewerId?: string;
};

export type EvaluationTimelinessRecord = EvaluationStoreRecord & {
  captureId?: string;
  sourceId?: string;
  actorReportedAt?: string;
  victimReportedAt?: string;
  publisherReportedAt?: string;
  firstReportedAt?: string;
  reportedAt?: string;
  firstReportedKind?: string;
  firstReportedProvenance?: unknown;
  publishedAt?: string;
  collectedAt?: string;
  processedAt?: string;
  firstVisibleAt?: string;
  alertCreatedAt?: string;
  alertedAt?: string;
  alertCreatedProvenance?: unknown;
  deliveryAttemptedAt?: string;
  deliveryAttemptProvenance?: unknown;
  deliveredAt?: string;
  deliveredProvenance?: unknown;
  timestampAnomalies?: unknown[];
  latencies?: Record<string, unknown>;
  zeroSecondEvidence?: Record<string, { verified?: boolean }>;
};

export type EvaluationSourceHealthRecord = EvaluationStoreRecord & {
  sourceId?: string;
  success?: boolean;
  useful?: boolean;
  itemCount?: number;
  duplicateCount?: number;
};

export interface CaptureMetadataStore {
  saveCapture(capture: RawCapture): RawCapture;
  getCapture(id: string): RawCapture | undefined;
  listCaptures(): RawCapture[];
  saveSource(source: SourceRecord): SourceRecord;
  getSource(id: string): SourceRecord | undefined;
  listSources(): SourceRecord[];
  listExtractedEntities(): EvaluationStoreRecord[];
  listIndicators(): EvaluationStoreRecord[];
  listIncidents(): EvaluationStoreRecord[];
  listIntelligenceClaims(): EvaluationStoreRecord[];
  listSourceHealthObservations(): EvaluationSourceHealthRecord[];
  listTimelinessRecords(): EvaluationTimelinessRecord[];
  saveValidationRecord(record: EvaluationValidationRecord): EvaluationValidationRecord;
  getValidationRecord(id: string): EvaluationValidationRecord | undefined;
  listValidationRecords(): EvaluationValidationRecord[];
  saveEvaluationLabel(record: EvaluationLabelRecord): EvaluationLabelRecord;
  getEvaluationLabel(id: string): EvaluationLabelRecord | undefined;
  listEvaluationLabels(): EvaluationLabelRecord[];
  saveEvaluationBenchmark(record: EvaluationBenchmarkRecord): EvaluationBenchmarkRecord;
  getEvaluationBenchmark(id: string): EvaluationBenchmarkRecord | undefined;
  listEvaluationBenchmarks(): EvaluationBenchmarkRecord[];
  updateEvaluationBenchmarkTask(
    id: string,
    taskId: string,
    update: (task: EvaluationTaskRecord) => EvaluationTaskRecord
  ): { benchmark: EvaluationBenchmarkRecord; task: EvaluationTaskRecord; index: number };
  patchEvaluationBenchmark(id: string, patch: Partial<EvaluationBenchmarkRecord>): EvaluationBenchmarkRecord;
  saveEvaluationAnnotation(record: EvaluationAnnotationRecord): EvaluationAnnotationRecord;
  getEvaluationAnnotation(id: string): EvaluationAnnotationRecord | undefined;
  listEvaluationAnnotations(): EvaluationAnnotationRecord[];
  saveEvaluationAdjudication(record: EvaluationAdjudicationRecord): EvaluationAdjudicationRecord;
  getEvaluationAdjudication(id: string): EvaluationAdjudicationRecord | undefined;
  listEvaluationAdjudications(): EvaluationAdjudicationRecord[];
  savePipelineResult(result: PipelineResult): PipelineResult;
  findDuplicateCapture(capture: RawCapture): RawCapture | undefined;
  listActorIdentities(): EvaluationStoreRecord[];
  listActorProfiles(): EvaluationStoreRecord[];
  listOrganizationMembers(): EvaluationStoreRecord[];
  saveSourceHealthObservation(record: EvaluationSourceHealthRecord): EvaluationSourceHealthRecord;
  savePlan(plan: CollectionPlan): CollectionPlan;
  getPlan(id: string): CollectionPlan | undefined;
  listPlans(): CollectionPlan[];
  saveRun(run: CollectionRun): CollectionRun;
  getRun(id: string): CollectionRun | undefined;
  listRuns(): CollectionRun[];
  replaceActorIdentityCatalog(...args: unknown[]): unknown;
  batch?<T>(operation: () => T | Promise<T>): T | Promise<T>;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}
export type EvidenceRepositorySet = any;
export type ObjectEvidenceManifestEntry = any;
export type ObjectEvidenceManifest = any;
export type ObjectEvidenceManifestVerification = any;
export type EvidenceBackendParityInput = any;
export type EvidenceBackendReadModelSnapshot = any;
export type EvidenceBackendParityReport = any;
export type EvidenceDisasterRecoveryManifest = any;
export type EvidenceSearchIndexDocumentKind = any;
export type EvidenceSearchIndexDocument = any;
export type EvidenceSearchIndexHandoff = any;
export type EvidenceIndexReplayMigrationReport = any;
export type EvidenceChainStageKind = any;
export type EvidenceChainStage = any;
export type EvidenceSearchBackendMigrationReadinessReport = any;
export type EvidenceReplayBenchmarkReport = any;
export type EvidenceChainOfCustodyReport = any;
export type EvidenceRetentionSurfaceKind = any;
export type EvidenceRetentionRuntimeReport = any;
export type EvidenceSearchConsistencySloReport = any;
export type EvidenceObjectIntegrityRepairReport = any;
export type ProductionEvidenceRepository = any;
export type EvidencePostgresTable = any;
export type PostgresEvidenceTransaction = any;
export type PostgresEvidenceRepository = any;
