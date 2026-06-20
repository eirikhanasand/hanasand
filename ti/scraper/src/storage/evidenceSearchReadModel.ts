import type {
  EvidenceSearchIndexDocument,
  EvidenceSearchIndexHandoff
} from "./evidenceStore.ts";
import type { RetentionClass } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";

export type EvidenceSearchReadModelBackend =
  | "embedded_memory"
  | "postgres_read_model"
  | "opensearch_pgvector";

export interface EvidenceSearchReadModelConfig {
  backend?: EvidenceSearchReadModelBackend;
  enabled?: boolean;
  generatedAt?: string;
  tenantId?: string;
}

export interface EvidenceSearchReadModelRecord {
  document: EvidenceSearchIndexDocument;
  indexedAt: string;
  sourceHandoffId: string;
  retentionClass?: RetentionClass;
  embeddingInputHash?: string;
  tombstoned: boolean;
  tombstoneReason?: string;
}

export interface EvidenceSearchReadModelQuery {
  query: string;
  tenantId?: string;
  includeRestrictedMetadata?: boolean;
  embeddingEligibleOnly?: boolean;
  limit?: number;
}

export interface EvidenceSearchReadModelSearchResult {
  documentId: string;
  kind: EvidenceSearchIndexDocument["kind"];
  tenantId?: string;
  captureId?: string;
  claimLedgerEntryId?: string;
  relationshipId?: string;
  sourceId?: string;
  title: string;
  summary: string;
  score: number;
  matchedTerms: string[];
  embeddingEligible: boolean;
  embeddingInputHash?: string;
  restrictedMetadata: boolean;
  metadataOnly: boolean;
  retentionClass?: RetentionClass;
  replayId: string;
  citationCount: number;
  safeOutput: {
    rawBodiesExposed: false;
    objectKeysExposed: false;
    unsafeUrlsExposed: false;
    credentialsExposed: false;
    restrictedRawContentExposed: false;
  };
}

export interface EvidenceSearchReadModelWriteResult {
  handoffId: string;
  acceptedDocuments: number;
  replacedDocuments: number;
  embeddingEligible: number;
  restrictedMetadataIndexed: number;
  restrictedMetadataEmbedded: false;
  skippedDocuments: Array<{ documentId: string; reason: string }>;
  safeOutput: EvidenceSearchReadModelSafety;
}

export interface EvidenceSearchReadModelDeleteResult {
  tombstonedDocuments: number;
  retainedLegalHoldDocuments: number;
  affectedDocumentIds: string[];
  safeOutput: EvidenceSearchReadModelSafety;
}

export interface EvidenceSearchReadModelStats {
  backend: EvidenceSearchReadModelBackend;
  enabled: boolean;
  documentCount: number;
  activeDocumentCount: number;
  tombstonedDocumentCount: number;
  embeddingEligibleCount: number;
  restrictedMetadataCount: number;
  restrictedMetadataEmbedded: false;
  tenantRoutingKeys: string[];
  safeOutput: EvidenceSearchReadModelSafety;
}

export interface EvidenceSearchReadModelReadiness {
  schemaVersion: "ti.evidence_search_read_model_adapter.v1";
  backend: EvidenceSearchReadModelBackend;
  enabled: boolean;
  disabledByDefault: boolean;
  canWrite: boolean;
  canSearch: boolean;
  failClosedWithoutExplicitEnable: boolean;
  liveBackendConnection: false;
  requiredFeatureFlags: string[];
  postgresTables: string[];
  openSearchAliases: string[];
  pgvectorTables: string[];
  noLeakGuarantees: {
    restrictedMetadataSearchable: true;
    restrictedMetadataEmbedded: false;
    rawBodiesStored: false;
    objectKeysStored: false;
    unsafeUrlsStored: false;
  };
  safeOutput: EvidenceSearchReadModelSafety;
}

export interface EvidenceSearchReadModelSafety {
  rawBodiesExposed: false;
  objectKeysExposed: false;
  unsafeUrlsExposed: false;
  credentialsExposed: false;
  restrictedRawContentExposed: false;
  actorInteractionExposed: false;
}

export interface EvidenceSearchReadModelPostgresDocumentRow {
  document_id: string;
  handoff_id: string;
  schema_version: EvidenceSearchIndexDocument["schemaVersion"];
  kind: EvidenceSearchIndexDocument["kind"];
  tenant_id?: string;
  source_id?: string;
  capture_id?: string;
  claim_ledger_entry_id?: string;
  relationship_id?: string;
  query?: string;
  normalized_query?: string;
  title: string;
  summary: string;
  search_text: string;
  tags: string[];
  freshness: EvidenceSearchIndexDocument["freshness"];
  confidence?: number;
  replay: EvidenceSearchIndexDocument["replay"];
  citation_spans: EvidenceSearchIndexDocument["citationSpans"];
  embedding: EvidenceSearchIndexDocument["embedding"];
  redaction: EvidenceSearchIndexDocument["redaction"];
  backend_hints: EvidenceSearchIndexDocument["backendHints"];
  retention_class?: RetentionClass;
  embedding_input_hash?: string;
  restricted_metadata: boolean;
  metadata_only: boolean;
  legal_hold: boolean;
  indexed_at: string;
  tombstoned_at?: string;
  tombstone_reason?: string;
}

export interface EvidenceSearchReadModelTombstoneRow {
  document_id: string;
  tenant_id?: string;
  retention_class?: RetentionClass;
  capture_id?: string;
  legal_hold: boolean;
  tombstoned_at: string;
  reason: string;
  replay_id: string;
}

export interface EvidenceSearchOpenSearchDocument {
  id: string;
  schemaVersion: "ti.evidence_search_read_model_opensearch_document.v1";
  tenantId?: string;
  routingKey: string;
  kind: EvidenceSearchIndexDocument["kind"];
  title: string;
  summary: string;
  searchText: string;
  tags: string[];
  sourceId?: string;
  captureId?: string;
  claimLedgerEntryId?: string;
  relationshipId?: string;
  replayId: string;
  freshness: EvidenceSearchIndexDocument["freshness"];
  confidence?: number;
  retentionClass?: RetentionClass;
  restrictedMetadata: boolean;
  metadataOnly: boolean;
  legalHold: boolean;
  citationCount: number;
  embeddingEligible: boolean;
  embeddingInputHash?: string;
  safeOutput: EvidenceSearchReadModelSafety;
}

export interface EvidenceSearchPgvectorCandidateRow {
  document_id: string;
  tenant_id?: string;
  vector_namespace: "ti-evidence";
  routing_key: string;
  embedding_input_hash: string;
  model_boundary: "external_vector_backend";
  source_replay_id: string;
  retention_class?: RetentionClass;
  legal_hold: boolean;
  restricted_metadata: false;
  metadata_only: false;
  raw_text_present: false;
}

export interface EvidenceSearchReadModelBackendWriteSet {
  schemaVersion: "ti.evidence_search_read_model_backend_write_set.v1";
  handoffId: string;
  generatedAt: string;
  postgresDocuments: EvidenceSearchReadModelPostgresDocumentRow[];
  openSearchDocuments: EvidenceSearchOpenSearchDocument[];
  pgvectorCandidates: EvidenceSearchPgvectorCandidateRow[];
  skippedDocuments: Array<{ documentId: string; reason: string }>;
  counts: {
    postgresDocuments: number;
    openSearchDocuments: number;
    pgvectorCandidates: number;
    restrictedMetadataDocuments: number;
    metadataOnlyDocuments: number;
    legalHoldDocuments: number;
    unsafeDocumentsSkipped: number;
  };
  safeOutput: EvidenceSearchReadModelSafety;
}

export interface EvidenceSearchReadModelPromotionReplay {
  schemaVersion: "ti.evidence_search_read_model_promotion_replay.v1";
  generatedAt: string;
  handoffId: string;
  query: string;
  normalizedQuery: string;
  tenantId?: string;
  state: "ready" | "partial" | "hold";
  canPromotePublicAnswer: boolean;
  canPromoteGraph: boolean;
  publicAnswer: {
    status: "ready" | "partial" | "hold";
    supportDocumentIds: string[];
    claimLedgerEntryIds: string[];
    captureIds: string[];
    sourceIds: string[];
    restrictedMetadataDocumentIds: string[];
    metadataOnlyClaimCount: number;
    evidenceItemCount: number;
    summaryBullets: string[];
    blockers: string[];
    warnings: string[];
  };
  graphPromotion: {
    status: "ready" | "hold";
    relationshipIds: string[];
    supportingClaimLedgerEntryIds: string[];
    supportingCaptureIds: string[];
    heldRestrictedRelationshipIds: string[];
    blockers: string[];
  };
  replayInputs: Array<{
    documentId: string;
    kind: EvidenceSearchIndexDocument["kind"];
    replayId: string;
    captureId?: string;
    claimLedgerEntryId?: string;
    relationshipId?: string;
    sourceId?: string;
    confidence?: number;
    retentionClass?: RetentionClass;
    restrictedMetadata: boolean;
    metadataOnly: boolean;
    citationCount: number;
    embeddingEligible: boolean;
  }>;
  retention: {
    legalHoldDocumentIds: string[];
    tombstoneRowsRequired: number;
    staleExtractorReplayRequired: boolean;
  };
  safeOutput: EvidenceSearchReadModelSafety;
}

export interface EvidencePromotionTransactionPlan {
  schemaVersion: "ti.evidence_promotion_transaction_plan.v1";
  generatedAt: string;
  handoffId: string;
  transactionId: string;
  state: "ready" | "partial" | "hold";
  dryRun: true;
  willMutate: false;
  sourceReplay: "durable_read_model_rows";
  consumers: {
    publicAnswer: EvidencePromotionConsumerPlan;
    graph: EvidencePromotionConsumerPlan;
    stix: EvidencePromotionConsumerPlan;
    api: EvidencePromotionConsumerPlan;
  };
  transactionSteps: Array<{
    stepId: string;
    order: number;
    consumer: "public_answer" | "graph" | "stix" | "api";
    action: string;
    inputDocumentIds: string[];
    idempotencyKey: string;
    status: "ready" | "hold";
    blockers: string[];
  }>;
  rollbackSteps: string[];
  restrictedHandling: {
    metadataOnlyDocumentIds: string[];
    caveatedPublicAnswerAllowed: boolean;
    graphRelationshipsHeld: string[];
    stixExportHeld: boolean;
    vectorPromotionAllowed: false;
  };
  replayGuarantees: {
    requiresReplayIds: true;
    requiresCitationSpans: true;
    requiresClaimLedgerRefs: true;
    requiresRetentionState: true;
    requiresReviewState: true;
    deterministicIdempotencyKeys: true;
  };
  downstreamHandoffs: {
    agent07Extraction: string[];
    agent08GraphStix: string[];
    agent09Api: string[];
    agent10ReleaseGate: string[];
  };
  safeOutput: EvidenceSearchReadModelSafety;
}

export interface EvidencePromotionConsumerPlan {
  status: "ready" | "partial" | "hold";
  targetReadModel: string;
  supportDocumentIds: string[];
  requiredClaimLedgerEntryIds: string[];
  requiredCaptureIds: string[];
  requiredRelationshipIds: string[];
  blockers: string[];
  warnings: string[];
}

export interface EvidencePromotionTransactionExecutionConfig {
  enabled?: boolean;
  allowPartial?: boolean;
  generatedAt?: string;
  operator?: string;
}

export interface EvidencePromotionTransactionExecutionReceipt {
  schemaVersion: "ti.evidence_promotion_transaction_execution.v1";
  generatedAt: string;
  transactionId: string;
  handoffId: string;
  state: "blocked" | "committed" | "partial";
  enabled: boolean;
  willMutateProductionConsumers: false;
  sourcePlan: "ti.evidence_promotion_transaction_plan.v1";
  appliedSteps: Array<{
    stepId: string;
    order: number;
    consumer: EvidencePromotionTransactionPlan["transactionSteps"][number]["consumer"];
    idempotencyKey: string;
    receiptId: string;
    documentCount: number;
    claimLedgerEntryCount: number;
    captureCount: number;
    relationshipCount: number;
    committedTo: string;
  }>;
  heldSteps: Array<{
    stepId: string;
    consumer: EvidencePromotionTransactionPlan["transactionSteps"][number]["consumer"];
    blockers: string[];
  }>;
  failClosedReasons: string[];
  committedConsumerRows: {
    publicAnswer: number;
    graph: number;
    stix: number;
    api: number;
  };
  rollbackRefs: Array<{
    receiptId: string;
    idempotencyKey: string;
    rollbackAction: string;
  }>;
  restrictedHandling: EvidencePromotionTransactionPlan["restrictedHandling"];
  replayGuarantees: EvidencePromotionTransactionPlan["replayGuarantees"];
  audit: {
    operator: string;
    dryRunPlanAccepted: true;
    deterministicReceipts: true;
    liveBackendConnection: false;
    explicitEnablementRequired: true;
  };
  safeOutput: EvidenceSearchReadModelSafety;
}

export interface EvidencePromotionTransactionExecutionPostgresRows {
  execution_receipts: EvidencePromotionExecutionReceiptRow[];
  execution_steps: EvidencePromotionExecutionStepRow[];
  held_steps: EvidencePromotionExecutionHeldStepRow[];
  rollback_refs: EvidencePromotionExecutionRollbackRow[];
}

export interface EvidencePromotionExecutionReceiptRow {
  execution_id: string;
  schema_version: EvidencePromotionTransactionExecutionReceipt["schemaVersion"];
  transaction_id: string;
  handoff_id: string;
  generated_at: string;
  state: EvidencePromotionTransactionExecutionReceipt["state"];
  enabled: boolean;
  source_plan: EvidencePromotionTransactionExecutionReceipt["sourcePlan"];
  will_mutate_production_consumers: false;
  fail_closed_reasons: string[];
  committed_consumer_rows: EvidencePromotionTransactionExecutionReceipt["committedConsumerRows"];
  restricted_handling: EvidencePromotionTransactionExecutionReceipt["restrictedHandling"];
  replay_guarantees: EvidencePromotionTransactionExecutionReceipt["replayGuarantees"];
  operator: string;
  dry_run_plan_accepted: true;
  deterministic_receipts: true;
  live_backend_connection: false;
  explicit_enablement_required: true;
  safe_output: EvidenceSearchReadModelSafety;
}

export interface EvidencePromotionExecutionStepRow {
  execution_id: string;
  transaction_id: string;
  step_id: string;
  step_order: number;
  consumer: EvidencePromotionTransactionPlan["transactionSteps"][number]["consumer"];
  idempotency_key: string;
  receipt_id: string;
  document_count: number;
  claim_ledger_entry_count: number;
  capture_count: number;
  relationship_count: number;
  committed_to: string;
  applied_at: string;
}

export interface EvidencePromotionExecutionHeldStepRow {
  execution_id: string;
  transaction_id: string;
  step_id: string;
  consumer: EvidencePromotionTransactionPlan["transactionSteps"][number]["consumer"];
  blockers: string[];
}

export interface EvidencePromotionExecutionRollbackRow {
  execution_id: string;
  transaction_id: string;
  receipt_id: string;
  idempotency_key: string;
  rollback_action: string;
}

export interface EvidencePromotionTransactionAuditReplay {
  schemaVersion: "ti.evidence_promotion_transaction_audit_replay.v1";
  generatedAt: string;
  transactionId: string;
  handoffId: string;
  state: EvidencePromotionTransactionExecutionReceipt["state"] | "missing";
  repository: {
    backend: "postgres_transaction_audit";
    enabled: false;
    disabledByDefault: true;
    liveBackendConnection: false;
    requiredTables: [
      "evidence_promotion_execution_receipts",
      "evidence_promotion_execution_steps",
      "evidence_promotion_execution_held_steps",
      "evidence_promotion_execution_rollbacks"
    ];
  };
  rowCounts: {
    executionReceipts: number;
    appliedSteps: number;
    heldSteps: number;
    rollbackRefs: number;
  };
  replayReady: boolean;
  replayBlockers: string[];
  deterministicReceiptIds: boolean;
  canReplayWithoutRawEvidence: true;
  committedConsumerRows: EvidencePromotionTransactionExecutionReceipt["committedConsumerRows"];
  failClosedReasons: string[];
  restrictedHandling: EvidencePromotionTransactionExecutionReceipt["restrictedHandling"];
  safeOutput: EvidenceSearchReadModelSafety;
}

export interface EvidenceActorProductImpactReplay {
  schemaVersion: "ti.evidence_actor_product_impact_replay.v1";
  generatedAt: string;
  handoffId: string;
  productSurface: "apify_public_threat_actor_monitor";
  actorBuild: "0.6.4";
  latestProofRunId: "iMQGeezZ8bx7WtlhQ";
  state: "ready" | "partial" | "hold";
  usefulActorRows: {
    freshRowsImprovingActorResult: EvidenceActorProductImpactRow[];
    restrictedMetadataRows: EvidenceActorProductImpactRow[];
    staleRowsSuppressed: Array<EvidenceActorProductImpactRow & { staleReason: string }>;
    missingSourceFamilies: Array<{
      family: "public_report" | "public_channel" | "advisory" | "restricted_metadata";
      impact: string;
      nextAction: string;
    }>;
  };
  answerImpact: {
    canImprovePaidActorResult: boolean;
    freshnessWindowDays: number;
    freshSourceFamilies: string[];
    staleSuppressionRequired: boolean;
    darkMetadataSearchable: boolean;
    darkMetadataCaveated: boolean;
    replayableFromDurableRows: true;
  };
  replayProof: {
    handoffId: string;
    promotionTransactionId: string;
    auditReplaySchemaVersion: EvidencePromotionTransactionAuditReplay["schemaVersion"];
    proofRunId: "iMQGeezZ8bx7WtlhQ";
    proofDatasetId: "5PLmkE30luBA5Lbgc";
    commands: string[];
  };
  noLeakGuarantees: {
    restrictedRowsMetadataOnly: true;
    rawBodiesExposed: false;
    objectKeysExposed: false;
    unsafeUrlsExposed: false;
    credentialsExposed: false;
    restrictedRawContentExposed: false;
    actorInteractionExposed: false;
    vectorEmbeddingsForRestrictedRows: false;
  };
  safeOutput: EvidenceSearchReadModelSafety;
}

export interface EvidenceActorProductImpactRow {
  documentId: string;
  kind: EvidenceSearchIndexDocument["kind"];
  sourceId?: string;
  captureId?: string;
  claimLedgerEntryId?: string;
  relationshipId?: string;
  sourceFamily: "public_report" | "public_channel" | "advisory" | "restricted_metadata" | "unknown";
  title: string;
  evidenceEffect: string;
  observedAt?: string;
  collectedAt?: string;
  publishedAt?: string;
  confidence?: number;
  replayId: string;
  retentionClass?: RetentionClass;
  restrictedMetadata: boolean;
  metadataOnly: boolean;
  embeddingEligible: boolean;
}

export interface EvidenceActorDatasetPromotionPreview {
  schemaVersion: "ti.evidence_actor_dataset_promotion_preview.v1";
  generatedAt: string;
  handoffId: string;
  productSurface: "apify_public_threat_actor_monitor";
  actorBuild: "0.6.4";
  sourceImpactReplay: "ti.evidence_actor_product_impact_replay.v1";
  dryRun: true;
  willMutateActorDataset: false;
  latestProof: {
    runId: "iMQGeezZ8bx7WtlhQ";
    datasetId: "5PLmkE30luBA5Lbgc";
  };
  counts: {
    billableResultCandidates: number;
    caveatedContextRows: number;
    staleRowsSuppressed: number;
    coverageGapRows: number;
  };
  rows: EvidenceActorDatasetPromotionRow[];
  publicAnswerConsumer: {
    targetReadModel: "api_intel_search_answer_cache";
    inputDocumentIds: string[];
    readyDocumentIds: string[];
    heldDocumentIds: string[];
    staleSuppressedDocumentIds: string[];
  };
  noLeakGuarantees: EvidenceActorProductImpactReplay["noLeakGuarantees"];
  safeOutput: EvidenceSearchReadModelSafety;
}

export interface EvidenceActorDatasetPromotionRow {
  rowId: string;
  rowType: "evidence_result" | "metadata_context" | "stale_suppression" | "coverage_gap";
  paidRowDecision: "billable_result_candidate" | "not_billable_context" | "not_billable_suppressed" | "not_billable_coverage_gap";
  paidRowReason: string;
  billingGuidance: "eligible_after_actor_row_render" | "context_only_do_not_bill" | "suppress_do_not_bill" | "gap_row_do_not_bill";
  buyerValueScore: number;
  sourceFamily?: EvidenceActorProductImpactRow["sourceFamily"];
  documentId?: string;
  sourceId?: string;
  captureId?: string;
  claimLedgerEntryId?: string;
  relationshipId?: string;
  title: string;
  summary: string;
  replayId?: string;
  freshness?: {
    observedAt?: string;
    collectedAt?: string;
    publishedAt?: string;
  };
  confidence?: number;
  retentionClass?: RetentionClass;
  noLeak: true;
}

export interface EvidenceActorDatasetConsumerHandoff {
  schemaVersion: "ti.evidence_actor_dataset_consumer_handoff.v1";
  generatedAt: string;
  handoffId: string;
  sourcePreview: "ti.evidence_actor_dataset_promotion_preview.v1";
  productSurface: "apify_public_threat_actor_monitor";
  actorBuild: "0.6.4";
  dryRun: true;
  willWriteActorDataset: false;
  willWritePublicAnswerCache: false;
  latestProof: EvidenceActorDatasetPromotionPreview["latestProof"];
  counts: {
    actorDatasetRows: number;
    sellableCandidates: number;
    caveatedContextRows: number;
    suppressedRows: number;
    coverageGapRows: number;
    publicAnswerCacheWrites: number;
  };
  actorDatasetRows: EvidenceActorDatasetConsumerRow[];
  publicAnswerCacheWrites: EvidenceActorPublicAnswerCacheWrite[];
  suppressionReceipts: Array<{
    receiptId: string;
    sourceRowId: string;
    documentId?: string;
    reason: "stale_row" | "unsafe_or_restricted_for_dataset" | "coverage_gap";
    visibleState: "suppressed" | "context_only" | "coverage_gap";
    noLeak: true;
  }>;
  coverageGapRows: EvidenceActorDatasetConsumerRow[];
  noLeakGuarantees: EvidenceActorProductImpactReplay["noLeakGuarantees"];
  safeOutput: EvidenceSearchReadModelSafety;
}

export interface EvidenceActorDatasetConsumerExecutionReceipt {
  schemaVersion: "ti.evidence_actor_dataset_consumer_execution.v1";
  generatedAt: string;
  executionId: string;
  sourceHandoff: "ti.evidence_actor_dataset_consumer_handoff.v1";
  productSurface: "apify_public_threat_actor_monitor";
  actorBuild: "0.6.4";
  status: "blocked_repository_disabled";
  enabled: false;
  dryRun: true;
  liveBackendConnection: false;
  willWriteActorDataset: false;
  willWritePublicAnswerCache: false;
  repositoryBoundary: {
    actorDatasetRepository: "disabled_actor_dataset_repository";
    publicAnswerCacheRepository: "disabled_public_answer_cache_repository";
    requiredFeatureFlags: ["TI_ACTOR_DATASET_CONSUMER_WRITES_ENABLED", "TI_PUBLIC_ANSWER_CACHE_WRITES_ENABLED"];
    failClosedWithoutExplicitEnable: true;
  };
  counts: {
    actorDatasetRowsHeld: number;
    publicAnswerCacheWritesHeld: number;
    sellableRowsHeld: number;
    caveatedContextRowsHeld: number;
    suppressedRowsHeld: number;
    coverageGapRowsHeld: number;
    actorDatasetRowsWritten: 0;
    publicAnswerCacheWritesWritten: 0;
  };
  actorDatasetReceipts: Array<{
    receiptId: string;
    datasetRowId: string;
    sourcePromotionRowId: string;
    state: "held";
    reason: "actor_dataset_repository_disabled" | "restricted_or_non_billable_row_held";
    intendedAction: EvidenceActorDatasetConsumerRow["actorDatasetAction"];
    noLeak: true;
  }>;
  publicAnswerCacheReceipts: Array<{
    receiptId: string;
    cacheWriteId: string;
    cacheKey: string;
    state: "held";
    reason: "public_answer_cache_repository_disabled";
    intendedAction: EvidenceActorPublicAnswerCacheWrite["action"];
    noLeak: true;
  }>;
  blockedReasons: Array<"actor_dataset_repository_disabled" | "public_answer_cache_repository_disabled">;
  rollbackRefs: string[];
  noLeakGuarantees: EvidenceActorProductImpactReplay["noLeakGuarantees"];
  safeOutput: EvidenceSearchReadModelSafety;
}

export interface EvidenceActorDatasetConsumerRow {
  datasetRowId: string;
  sourcePromotionRowId: string;
  actorDatasetAction: "render_sellable_candidate" | "render_caveated_context" | "suppress_from_dataset" | "render_coverage_gap";
  paidRowDecision: "sellable" | "included_with_caveat" | "hold";
  paidRowReason: string;
  billingGuidance: "charge_after_actor_emit" | "do_not_charge_context" | "do_not_charge_suppressed" | "do_not_charge_gap";
  buyerValueScore: number;
  evidenceGrade: "corroborated" | "metadata_only_context" | "stale_suppressed" | "coverage_gap";
  coverageStatus: "ready_for_dataset" | "context_only" | "suppressed" | "gap";
  title: string;
  summary: string;
  sourceFamily?: EvidenceActorProductImpactRow["sourceFamily"];
  documentId?: string;
  sourceId?: string;
  captureId?: string;
  replayId?: string;
  retentionClass?: RetentionClass;
  safety: {
    rawContentIncluded: false;
    restrictedMaterialIncluded: false;
    unsafeUrlIncluded: false;
    credentialIncluded: false;
    actorInteractionRequired: false;
  };
}

export interface EvidenceActorPublicAnswerCacheWrite {
  cacheWriteId: string;
  sourcePromotionRowId: string;
  cacheKey: string;
  action: "upsert_ready_context" | "upsert_caveated_context" | "suppress_stale_context" | "record_coverage_gap";
  documentId?: string;
  visibleState: "ready" | "partial" | "suppressed" | "coverage_gap";
  summary: string;
  noLeak: true;
}

export interface EvidenceSearchReadModelRepository {
  readonly backend: EvidenceSearchReadModelBackend;
  readiness(): EvidenceSearchReadModelReadiness;
  writeHandoff(handoff: EvidenceSearchIndexHandoff): EvidenceSearchReadModelWriteResult;
  search(query: EvidenceSearchReadModelQuery): EvidenceSearchReadModelSearchResult[];
  deleteByRetention(input: { retentionClasses: RetentionClass[]; legalHoldCaptureIds?: string[]; reason: string }): EvidenceSearchReadModelDeleteResult;
  stats(): EvidenceSearchReadModelStats;
}

const SAFE_OUTPUT: EvidenceSearchReadModelSafety = {
  rawBodiesExposed: false,
  objectKeysExposed: false,
  unsafeUrlsExposed: false,
  credentialsExposed: false,
  restrictedRawContentExposed: false,
  actorInteractionExposed: false
};

export function createEvidenceSearchReadModelRepository(
  config: EvidenceSearchReadModelConfig = {}
): EvidenceSearchReadModelRepository {
  const backend = config.backend ?? "embedded_memory";
  if (backend === "embedded_memory") return new InMemoryEvidenceSearchReadModelRepository(config);
  return new DisabledEvidenceSearchReadModelRepository(backend, config);
}

export function evidenceSearchReadModelReadiness(
  config: EvidenceSearchReadModelConfig = {}
): EvidenceSearchReadModelReadiness {
  return readModelReadiness(config.backend ?? "embedded_memory", config.enabled === true);
}

export function evidenceSearchDocumentToPostgresRow(
  document: EvidenceSearchIndexDocument,
  input: { handoffId: string; indexedAt: string; tombstonedAt?: string; tombstoneReason?: string }
): EvidenceSearchReadModelPostgresDocumentRow {
  return {
    document_id: document.documentId,
    handoff_id: input.handoffId,
    schema_version: document.schemaVersion,
    kind: document.kind,
    tenant_id: document.tenantId,
    source_id: document.sourceId,
    capture_id: document.captureId,
    claim_ledger_entry_id: document.claimLedgerEntryId,
    relationship_id: document.relationshipId,
    query: document.query,
    normalized_query: document.normalizedQuery,
    title: document.title,
    summary: document.summary,
    search_text: document.searchText,
    tags: [...document.tags],
    freshness: { ...document.freshness },
    confidence: document.confidence,
    replay: { ...document.replay },
    citation_spans: document.citationSpans.map((span) => ({ ...span })),
    embedding: sanitizedEmbedding(document),
    redaction: sanitizedRedaction(document),
    backend_hints: { ...document.backendHints },
    retention_class: document.redaction.retentionClass,
    embedding_input_hash: document.embedding.eligible && !document.redaction.restricted && !document.redaction.metadataOnly ? document.embedding.inputTextHash : undefined,
    restricted_metadata: document.redaction.restricted,
    metadata_only: document.redaction.metadataOnly,
    legal_hold: document.redaction.legalHold,
    indexed_at: input.indexedAt,
    tombstoned_at: input.tombstonedAt,
    tombstone_reason: input.tombstoneReason
  };
}

export function evidenceSearchDocumentFromPostgresRow(row: EvidenceSearchReadModelPostgresDocumentRow): EvidenceSearchIndexDocument {
  return {
    schemaVersion: row.schema_version,
    documentId: row.document_id,
    kind: row.kind,
    tenantId: row.tenant_id,
    sourceId: row.source_id,
    captureId: row.capture_id,
    claimLedgerEntryId: row.claim_ledger_entry_id,
    relationshipId: row.relationship_id,
    query: row.query,
    normalizedQuery: row.normalized_query,
    title: row.title,
    summary: row.summary,
    searchText: row.search_text,
    tags: [...row.tags],
    freshness: { ...row.freshness },
    confidence: row.confidence,
    replay: { ...row.replay },
    citationSpans: row.citation_spans.map((span) => ({ ...span })),
    embedding: sanitizedEmbedding({ embedding: row.embedding, redaction: row.redaction }),
    redaction: sanitizedRedaction({ redaction: row.redaction }),
    backendHints: { ...row.backend_hints }
  };
}

export function evidenceSearchDocumentToOpenSearchDocument(document: EvidenceSearchIndexDocument): EvidenceSearchOpenSearchDocument {
  return {
    id: document.documentId,
    schemaVersion: "ti.evidence_search_read_model_opensearch_document.v1",
    tenantId: document.tenantId,
    routingKey: document.backendHints.routingKey,
    kind: document.kind,
    title: document.title,
    summary: document.summary,
    searchText: document.searchText,
    tags: [...document.tags],
    sourceId: document.sourceId,
    captureId: document.captureId,
    claimLedgerEntryId: document.claimLedgerEntryId,
    relationshipId: document.relationshipId,
    replayId: document.replay.replayId,
    freshness: { ...document.freshness },
    confidence: document.confidence,
    retentionClass: document.redaction.retentionClass,
    restrictedMetadata: document.redaction.restricted,
    metadataOnly: document.redaction.metadataOnly,
    legalHold: document.redaction.legalHold,
    citationCount: document.citationSpans.length,
    embeddingEligible: document.embedding.eligible && !document.redaction.restricted && !document.redaction.metadataOnly,
    embeddingInputHash: document.embedding.eligible && !document.redaction.restricted && !document.redaction.metadataOnly ? document.embedding.inputTextHash : undefined,
    safeOutput: SAFE_OUTPUT
  };
}

export function evidenceSearchDocumentToPgvectorCandidate(document: EvidenceSearchIndexDocument): EvidenceSearchPgvectorCandidateRow | undefined {
  if (!document.embedding.eligible || !document.embedding.inputTextHash) return undefined;
  if (document.redaction.restricted || document.redaction.metadataOnly) return undefined;
  return {
    document_id: document.documentId,
    tenant_id: document.tenantId,
    vector_namespace: "ti-evidence",
    routing_key: document.backendHints.routingKey,
    embedding_input_hash: document.embedding.inputTextHash,
    model_boundary: document.embedding.modelBoundary,
    source_replay_id: document.replay.replayId,
    retention_class: document.redaction.retentionClass,
    legal_hold: document.redaction.legalHold,
    restricted_metadata: false,
    metadata_only: false,
    raw_text_present: false
  };
}

export function evidenceSearchTombstoneRowForDocument(
  document: EvidenceSearchIndexDocument,
  input: { tombstonedAt: string; reason: string }
): EvidenceSearchReadModelTombstoneRow {
  return {
    document_id: document.documentId,
    tenant_id: document.tenantId,
    retention_class: document.redaction.retentionClass,
    capture_id: document.captureId,
    legal_hold: document.redaction.legalHold,
    tombstoned_at: input.tombstonedAt,
    reason: input.reason,
    replay_id: document.replay.replayId
  };
}

export function buildEvidenceSearchReadModelBackendWriteSet(
  handoff: EvidenceSearchIndexHandoff,
  input: { generatedAt?: string; handoffId?: string } = {}
): EvidenceSearchReadModelBackendWriteSet {
  const generatedAt = input.generatedAt ?? nowIso();
  const handoffId = input.handoffId ?? stableId("evidence-search-handoff", `${handoff.tenantId ?? "global"}:${handoff.normalizedQuery}:${handoff.documents.length}:${handoff.generatedAt}`);
  const postgresDocuments: EvidenceSearchReadModelPostgresDocumentRow[] = [];
  const openSearchDocuments: EvidenceSearchOpenSearchDocument[] = [];
  const pgvectorCandidates: EvidenceSearchPgvectorCandidateRow[] = [];
  const skippedDocuments: EvidenceSearchReadModelBackendWriteSet["skippedDocuments"] = [];

  for (const document of handoff.documents) {
    const skipReason = unsafeDocumentReason(document);
    if (skipReason) {
      skippedDocuments.push({ documentId: document.documentId, reason: skipReason });
      continue;
    }
    postgresDocuments.push(evidenceSearchDocumentToPostgresRow(document, { handoffId, indexedAt: generatedAt }));
    openSearchDocuments.push(evidenceSearchDocumentToOpenSearchDocument(document));
    const vectorCandidate = evidenceSearchDocumentToPgvectorCandidate(document);
    if (vectorCandidate) pgvectorCandidates.push(vectorCandidate);
  }

  return {
    schemaVersion: "ti.evidence_search_read_model_backend_write_set.v1",
    handoffId,
    generatedAt,
    postgresDocuments,
    openSearchDocuments,
    pgvectorCandidates,
    skippedDocuments,
    counts: {
      postgresDocuments: postgresDocuments.length,
      openSearchDocuments: openSearchDocuments.length,
      pgvectorCandidates: pgvectorCandidates.length,
      restrictedMetadataDocuments: postgresDocuments.filter((row) => row.restricted_metadata).length,
      metadataOnlyDocuments: postgresDocuments.filter((row) => row.metadata_only).length,
      legalHoldDocuments: postgresDocuments.filter((row) => row.legal_hold).length,
      unsafeDocumentsSkipped: skippedDocuments.length
    },
    safeOutput: SAFE_OUTPUT
  };
}

export function buildEvidenceSearchReadModelPromotionReplay(
  writeSet: EvidenceSearchReadModelBackendWriteSet,
  input: { query: string; normalizedQuery?: string; tenantId?: string; generatedAt?: string } 
): EvidenceSearchReadModelPromotionReplay {
  const generatedAt = input.generatedAt ?? writeSet.generatedAt;
  const normalizedQuery = input.normalizedQuery ?? input.query.trim().toLowerCase();
  const activeRows = writeSet.postgresDocuments.filter((row) => !row.tombstoned_at);
  const unsafeSkipped = writeSet.counts.unsafeDocumentsSkipped > 0;
  const publicSupport = activeRows.filter((row) => !row.restricted_metadata && !row.metadata_only);
  const claimRows = activeRows.filter((row) => row.kind === "claim");
  const captureRows = activeRows.filter((row) => row.kind === "capture");
  const relationshipRows = activeRows.filter((row) => row.kind === "graph_relationship");
  const restrictedRows = activeRows.filter((row) => row.restricted_metadata || row.metadata_only);
  const legalHoldRows = activeRows.filter((row) => row.legal_hold);
  const citationlessRows = activeRows.filter((row) => row.citation_spans.length === 0);
  const staleExtractorRows = activeRows.filter((row) => !row.replay.extractorVersion && (row.kind === "capture" || row.kind === "claim"));

  const publicAnswerBlockers = [
    ...(unsafeSkipped ? ["unsafe_documents_skipped"] : []),
    ...(activeRows.length === 0 ? ["no_replay_documents"] : []),
    ...(citationlessRows.length > 0 ? ["missing_citation_spans"] : []),
    ...(publicSupport.length === 0 && restrictedRows.length > 0 ? ["metadata_only_support_requires_caveat"] : [])
  ];
  const graphBlockers = [
    ...(unsafeSkipped ? ["unsafe_documents_skipped"] : []),
    ...(relationshipRows.length === 0 ? ["no_graph_relationship_rows"] : []),
    ...(relationshipRows.some((row) => row.restricted_metadata || row.metadata_only) ? ["restricted_relationship_review_required"] : [])
  ];
  const publicWarnings = [
    ...(restrictedRows.length > 0 ? ["restricted_metadata_used_as_caveated_defensive_context"] : []),
    ...(staleExtractorRows.length > 0 ? ["stale_extractor_replay_required"] : []),
    ...(legalHoldRows.length > 0 ? ["legal_hold_preserves_evidence_rows"] : [])
  ];
  const canPromotePublicAnswer = publicAnswerBlockers.filter((blocker) => blocker !== "metadata_only_support_requires_caveat").length === 0 && activeRows.length > 0;
  const canPromoteGraph = graphBlockers.length === 0;
  const state: EvidenceSearchReadModelPromotionReplay["state"] = canPromotePublicAnswer && canPromoteGraph
    ? "ready"
    : activeRows.length > 0 && !unsafeSkipped
      ? "partial"
      : "hold";

  return {
    schemaVersion: "ti.evidence_search_read_model_promotion_replay.v1",
    generatedAt,
    handoffId: writeSet.handoffId,
    query: input.query,
    normalizedQuery,
    tenantId: input.tenantId,
    state,
    canPromotePublicAnswer,
    canPromoteGraph,
    publicAnswer: {
      status: canPromotePublicAnswer ? "ready" : state === "partial" ? "partial" : "hold",
      supportDocumentIds: activeRows.map((row) => row.document_id),
      claimLedgerEntryIds: uniqueDefined(activeRows.map((row) => row.claim_ledger_entry_id)),
      captureIds: uniqueDefined(activeRows.map((row) => row.capture_id)),
      sourceIds: uniqueDefined(activeRows.map((row) => row.source_id)),
      restrictedMetadataDocumentIds: restrictedRows.map((row) => row.document_id),
      metadataOnlyClaimCount: claimRows.filter((row) => row.metadata_only || row.restricted_metadata).length,
      evidenceItemCount: captureRows.length + claimRows.length,
      summaryBullets: summarizePromotionRows(activeRows, restrictedRows),
      blockers: publicAnswerBlockers,
      warnings: publicWarnings
    },
    graphPromotion: {
      status: canPromoteGraph ? "ready" : "hold",
      relationshipIds: uniqueDefined(relationshipRows.map((row) => row.relationship_id)),
      supportingClaimLedgerEntryIds: uniqueDefined(relationshipRows.map((row) => row.claim_ledger_entry_id)),
      supportingCaptureIds: uniqueDefined(relationshipRows.map((row) => row.capture_id)),
      heldRestrictedRelationshipIds: uniqueDefined(relationshipRows.filter((row) => row.restricted_metadata || row.metadata_only).map((row) => row.relationship_id)),
      blockers: graphBlockers
    },
    replayInputs: activeRows.map((row) => ({
      documentId: row.document_id,
      kind: row.kind,
      replayId: row.replay.replayId,
      captureId: row.capture_id,
      claimLedgerEntryId: row.claim_ledger_entry_id,
      relationshipId: row.relationship_id,
      sourceId: row.source_id,
      confidence: row.confidence,
      retentionClass: row.retention_class,
      restrictedMetadata: row.restricted_metadata,
      metadataOnly: row.metadata_only,
      citationCount: row.citation_spans.length,
      embeddingEligible: row.embedding.eligible && !row.restricted_metadata && !row.metadata_only
    })),
    retention: {
      legalHoldDocumentIds: legalHoldRows.map((row) => row.document_id),
      tombstoneRowsRequired: activeRows.length,
      staleExtractorReplayRequired: staleExtractorRows.length > 0
    },
    safeOutput: SAFE_OUTPUT
  };
}

export function buildEvidencePromotionTransactionPlan(
  writeSet: EvidenceSearchReadModelBackendWriteSet,
  replay: EvidenceSearchReadModelPromotionReplay,
  input: { generatedAt?: string } = {}
): EvidencePromotionTransactionPlan {
  const generatedAt = input.generatedAt ?? replay.generatedAt;
  const activeRows = writeSet.postgresDocuments.filter((row) => !row.tombstoned_at);
  const restrictedRows = activeRows.filter((row) => row.restricted_metadata || row.metadata_only);
  const publicAnswerWarnings = Array.isArray(replay.publicAnswer.warnings) ? [...replay.publicAnswer.warnings] : [];
  const publicAnswerBlockers = Array.isArray(replay.publicAnswer.blockers) ? [...replay.publicAnswer.blockers] : [];
  const graphBlockers = Array.isArray(replay.graphPromotion.blockers) ? [...replay.graphPromotion.blockers] : [];
  const apiWarnings = replay.publicAnswer.status === "ready" && restrictedRows.length > 0
    ? [...publicAnswerWarnings, "api_response_requires_restricted_metadata_caveat"]
    : publicAnswerWarnings;
  const stixBlockers = [
    ...graphBlockers,
    ...(replay.graphPromotion.heldRestrictedRelationshipIds.length > 0 ? ["restricted_relationships_not_exportable_to_stix"] : [])
  ];
  const consumers: EvidencePromotionTransactionPlan["consumers"] = {
    publicAnswer: {
      status: replay.publicAnswer.status,
      targetReadModel: "public_answer_read_model",
      supportDocumentIds: replay.publicAnswer.supportDocumentIds,
      requiredClaimLedgerEntryIds: replay.publicAnswer.claimLedgerEntryIds,
      requiredCaptureIds: replay.publicAnswer.captureIds,
      requiredRelationshipIds: [],
      blockers: publicAnswerBlockers,
      warnings: publicAnswerWarnings
    },
    graph: {
      status: replay.graphPromotion.status,
      targetReadModel: "graph_relationship_read_model",
      supportDocumentIds: replay.publicAnswer.supportDocumentIds,
      requiredClaimLedgerEntryIds: replay.graphPromotion.supportingClaimLedgerEntryIds,
      requiredCaptureIds: replay.graphPromotion.supportingCaptureIds,
      requiredRelationshipIds: replay.graphPromotion.relationshipIds,
      blockers: graphBlockers,
      warnings: replay.graphPromotion.heldRestrictedRelationshipIds.length > 0 ? ["restricted_relationships_require_review"] : []
    },
    stix: {
      status: stixBlockers.length === 0 && replay.canPromoteGraph ? "ready" : "hold",
      targetReadModel: "stix_preview_read_model",
      supportDocumentIds: replay.publicAnswer.supportDocumentIds,
      requiredClaimLedgerEntryIds: replay.graphPromotion.supportingClaimLedgerEntryIds,
      requiredCaptureIds: replay.graphPromotion.supportingCaptureIds,
      requiredRelationshipIds: replay.graphPromotion.relationshipIds,
      blockers: stixBlockers,
      warnings: []
    },
    api: {
      status: replay.canPromotePublicAnswer ? "ready" : replay.publicAnswer.status,
      targetReadModel: "api_intel_search_answer_cache",
      supportDocumentIds: replay.publicAnswer.supportDocumentIds,
      requiredClaimLedgerEntryIds: replay.publicAnswer.claimLedgerEntryIds,
      requiredCaptureIds: replay.publicAnswer.captureIds,
      requiredRelationshipIds: replay.graphPromotion.status === "ready" ? replay.graphPromotion.relationshipIds : [],
      blockers: publicAnswerBlockers,
      warnings: apiWarnings
    }
  };
  const transactionSteps: EvidencePromotionTransactionPlan["transactionSteps"] = [
    promotionTransactionStep(writeSet.handoffId, 1, "public_answer", consumers.publicAnswer),
    promotionTransactionStep(writeSet.handoffId, 2, "graph", consumers.graph),
    promotionTransactionStep(writeSet.handoffId, 3, "stix", consumers.stix),
    promotionTransactionStep(writeSet.handoffId, 4, "api", consumers.api)
  ];
  const state: EvidencePromotionTransactionPlan["state"] = transactionSteps.every((step) => step.status === "ready")
    ? "ready"
    : transactionSteps.some((step) => step.status === "ready")
      ? "partial"
      : "hold";

  return {
    schemaVersion: "ti.evidence_promotion_transaction_plan.v1",
    generatedAt,
    handoffId: writeSet.handoffId,
    transactionId: stableId("evidence-promotion-transaction", `${writeSet.handoffId}:${replay.normalizedQuery}:${generatedAt}`),
    state,
    dryRun: true,
    willMutate: false,
    sourceReplay: "durable_read_model_rows",
    consumers,
    transactionSteps,
    rollbackSteps: [
      "Keep durable read-model rows unchanged.",
      "Do not publish public answer deltas until all ready consumer steps commit in order.",
      "Drop generated graph/STIX/API cache writes for this dry-run transaction id.",
      "Replay from Postgres read-model rows using the same handoff id and idempotency keys."
    ],
    restrictedHandling: {
      metadataOnlyDocumentIds: restrictedRows.map((row) => row.document_id),
      caveatedPublicAnswerAllowed: replay.canPromotePublicAnswer && restrictedRows.length > 0,
      graphRelationshipsHeld: replay.graphPromotion.heldRestrictedRelationshipIds,
      stixExportHeld: stixBlockers.length > 0,
      vectorPromotionAllowed: false
    },
    replayGuarantees: {
      requiresReplayIds: true,
      requiresCitationSpans: true,
      requiresClaimLedgerRefs: true,
      requiresRetentionState: true,
      requiresReviewState: true,
      deterministicIdempotencyKeys: true
    },
    downstreamHandoffs: {
      agent07Extraction: ["replayInputs.replayId", "replayInputs.citationCount", "retention.staleExtractorReplayRequired"],
      agent08GraphStix: ["consumers.graph", "consumers.stix", "restrictedHandling.graphRelationshipsHeld"],
      agent09Api: ["consumers.api", "transactionSteps", "rollbackSteps"],
      agent10ReleaseGate: ["state", "restrictedHandling", "replayGuarantees"]
    },
    safeOutput: SAFE_OUTPUT
  };
}

export function executeEvidencePromotionTransactionPlan(
  plan: EvidencePromotionTransactionPlan,
  input: EvidencePromotionTransactionExecutionConfig = {}
): EvidencePromotionTransactionExecutionReceipt {
  const generatedAt = input.generatedAt ?? plan.generatedAt;
  const failClosedReasons: string[] = [];
  if (input.enabled !== true) failClosedReasons.push("promotion_transaction_repository_disabled");
  if (plan.dryRun !== true || plan.willMutate !== false) failClosedReasons.push("non_dry_run_plan_rejected");
  if (plan.sourceReplay !== "durable_read_model_rows") failClosedReasons.push("unsupported_source_replay");
  if (!plan.replayGuarantees.deterministicIdempotencyKeys) failClosedReasons.push("missing_deterministic_idempotency_keys");
  if (plan.transactionSteps.some((step) => !step.idempotencyKey)) failClosedReasons.push("missing_step_idempotency_key");
  if (plan.restrictedHandling.vectorPromotionAllowed !== false) failClosedReasons.push("restricted_vector_promotion_rejected");
  if (plan.state !== "ready" && input.allowPartial !== true) failClosedReasons.push("held_consumer_steps_require_partial_enablement");

  const executionAllowed = failClosedReasons.length === 0;
  const candidateSteps = executionAllowed
    ? plan.transactionSteps.filter((step) => step.status === "ready")
    : [];
  const appliedSteps: EvidencePromotionTransactionExecutionReceipt["appliedSteps"] = candidateSteps.map((step) => {
    const consumer = consumerPlanForStep(plan, step.consumer);
    const receiptId = stableId("evidence-promotion-receipt", `${plan.transactionId}:${step.idempotencyKey}:${generatedAt}`);
    return {
      stepId: step.stepId,
      order: step.order,
      consumer: step.consumer,
      idempotencyKey: step.idempotencyKey,
      receiptId,
      documentCount: step.inputDocumentIds.length,
      claimLedgerEntryCount: consumer.requiredClaimLedgerEntryIds.length,
      captureCount: consumer.requiredCaptureIds.length,
      relationshipCount: consumer.requiredRelationshipIds.length,
      committedTo: consumer.targetReadModel
    };
  });
  const heldSteps: EvidencePromotionTransactionExecutionReceipt["heldSteps"] = [
    ...plan.transactionSteps
      .filter((step) => step.status !== "ready")
      .map((step) => ({
        stepId: step.stepId,
        consumer: step.consumer,
        blockers: step.blockers.length > 0 ? step.blockers : ["consumer_not_ready"]
      })),
    ...(!executionAllowed
      ? plan.transactionSteps
        .filter((step) => step.status === "ready")
        .map((step) => ({
          stepId: step.stepId,
          consumer: step.consumer,
          blockers: failClosedReasons
        }))
      : [])
  ].sort((left, right) => left.stepId.localeCompare(right.stepId));
  const state: EvidencePromotionTransactionExecutionReceipt["state"] = !executionAllowed
    ? "blocked"
    : heldSteps.length > 0 || appliedSteps.length < plan.transactionSteps.length
      ? "partial"
      : "committed";

  return {
    schemaVersion: "ti.evidence_promotion_transaction_execution.v1",
    generatedAt,
    transactionId: plan.transactionId,
    handoffId: plan.handoffId,
    state,
    enabled: input.enabled === true,
    willMutateProductionConsumers: false,
    sourcePlan: plan.schemaVersion,
    appliedSteps,
    heldSteps,
    failClosedReasons,
    committedConsumerRows: {
      publicAnswer: countAppliedConsumer(appliedSteps, "public_answer"),
      graph: countAppliedConsumer(appliedSteps, "graph"),
      stix: countAppliedConsumer(appliedSteps, "stix"),
      api: countAppliedConsumer(appliedSteps, "api")
    },
    rollbackRefs: appliedSteps.map((step) => ({
      receiptId: step.receiptId,
      idempotencyKey: step.idempotencyKey,
      rollbackAction: `delete_rehearsal_rows_for_${step.committedTo}`
    })),
    restrictedHandling: plan.restrictedHandling,
    replayGuarantees: plan.replayGuarantees,
    audit: {
      operator: input.operator ?? "agent_06",
      dryRunPlanAccepted: true,
      deterministicReceipts: true,
      liveBackendConnection: false,
      explicitEnablementRequired: true
    },
    safeOutput: SAFE_OUTPUT
  };
}

export function evidencePromotionExecutionToPostgresRows(
  receipt: EvidencePromotionTransactionExecutionReceipt
): EvidencePromotionTransactionExecutionPostgresRows {
  const executionId = stableId("evidence-promotion-execution", `${receipt.transactionId}:${receipt.generatedAt}:${receipt.state}`);
  return {
    execution_receipts: [{
      execution_id: executionId,
      schema_version: receipt.schemaVersion,
      transaction_id: receipt.transactionId,
      handoff_id: receipt.handoffId,
      generated_at: receipt.generatedAt,
      state: receipt.state,
      enabled: receipt.enabled,
      source_plan: receipt.sourcePlan,
      will_mutate_production_consumers: receipt.willMutateProductionConsumers,
      fail_closed_reasons: [...receipt.failClosedReasons],
      committed_consumer_rows: { ...receipt.committedConsumerRows },
      restricted_handling: cloneRestrictedHandling(receipt.restrictedHandling),
      replay_guarantees: { ...receipt.replayGuarantees },
      operator: receipt.audit.operator,
      dry_run_plan_accepted: receipt.audit.dryRunPlanAccepted,
      deterministic_receipts: receipt.audit.deterministicReceipts,
      live_backend_connection: receipt.audit.liveBackendConnection,
      explicit_enablement_required: receipt.audit.explicitEnablementRequired,
      safe_output: SAFE_OUTPUT
    }],
    execution_steps: receipt.appliedSteps.map((step) => ({
      execution_id: executionId,
      transaction_id: receipt.transactionId,
      step_id: step.stepId,
      step_order: step.order,
      consumer: step.consumer,
      idempotency_key: step.idempotencyKey,
      receipt_id: step.receiptId,
      document_count: step.documentCount,
      claim_ledger_entry_count: step.claimLedgerEntryCount,
      capture_count: step.captureCount,
      relationship_count: step.relationshipCount,
      committed_to: step.committedTo,
      applied_at: receipt.generatedAt
    })),
    held_steps: receipt.heldSteps.map((step) => ({
      execution_id: executionId,
      transaction_id: receipt.transactionId,
      step_id: step.stepId,
      consumer: step.consumer,
      blockers: [...step.blockers]
    })),
    rollback_refs: receipt.rollbackRefs.map((rollback) => ({
      execution_id: executionId,
      transaction_id: receipt.transactionId,
      receipt_id: rollback.receiptId,
      idempotency_key: rollback.idempotencyKey,
      rollback_action: rollback.rollbackAction
    }))
  };
}

export function evidencePromotionExecutionFromPostgresRows(
  rows: EvidencePromotionTransactionExecutionPostgresRows
): EvidencePromotionTransactionExecutionReceipt | undefined {
  const receiptRow = rows.execution_receipts[0];
  if (!receiptRow) return undefined;
  const executionId = receiptRow.execution_id;
  const appliedSteps: EvidencePromotionTransactionExecutionReceipt["appliedSteps"] = rows.execution_steps
    .filter((step) => step.execution_id === executionId)
    .sort((left, right) => left.step_order - right.step_order)
    .map((step) => ({
      stepId: step.step_id,
      order: step.step_order,
      consumer: step.consumer,
      idempotencyKey: step.idempotency_key,
      receiptId: step.receipt_id,
      documentCount: step.document_count,
      claimLedgerEntryCount: step.claim_ledger_entry_count,
      captureCount: step.capture_count,
      relationshipCount: step.relationship_count,
      committedTo: step.committed_to
    }));
  const heldSteps: EvidencePromotionTransactionExecutionReceipt["heldSteps"] = rows.held_steps
    .filter((step) => step.execution_id === executionId)
    .sort((left, right) => left.step_id.localeCompare(right.step_id))
    .map((step) => ({
      stepId: step.step_id,
      consumer: step.consumer,
      blockers: [...step.blockers]
    }));
  const rollbackRefs: EvidencePromotionTransactionExecutionReceipt["rollbackRefs"] = rows.rollback_refs
    .filter((rollback) => rollback.execution_id === executionId)
    .map((rollback) => ({
      receiptId: rollback.receipt_id,
      idempotencyKey: rollback.idempotency_key,
      rollbackAction: rollback.rollback_action
    }));

  return {
    schemaVersion: receiptRow.schema_version,
    generatedAt: receiptRow.generated_at,
    transactionId: receiptRow.transaction_id,
    handoffId: receiptRow.handoff_id,
    state: receiptRow.state,
    enabled: receiptRow.enabled,
    willMutateProductionConsumers: receiptRow.will_mutate_production_consumers,
    sourcePlan: receiptRow.source_plan,
    appliedSteps,
    heldSteps,
    failClosedReasons: [...receiptRow.fail_closed_reasons],
    committedConsumerRows: { ...receiptRow.committed_consumer_rows },
    rollbackRefs,
    restrictedHandling: cloneRestrictedHandling(receiptRow.restricted_handling),
    replayGuarantees: { ...receiptRow.replay_guarantees },
    audit: {
      operator: receiptRow.operator,
      dryRunPlanAccepted: receiptRow.dry_run_plan_accepted,
      deterministicReceipts: receiptRow.deterministic_receipts,
      liveBackendConnection: receiptRow.live_backend_connection,
      explicitEnablementRequired: receiptRow.explicit_enablement_required
    },
    safeOutput: SAFE_OUTPUT
  };
}

export function buildEvidencePromotionTransactionAuditReplay(
  rows: EvidencePromotionTransactionExecutionPostgresRows,
  input: { generatedAt?: string } = {}
): EvidencePromotionTransactionAuditReplay {
  const receipt = evidencePromotionExecutionFromPostgresRows(rows);
  const generatedAt = input.generatedAt ?? receipt?.generatedAt ?? nowIso();
  const replayBlockers = receipt
    ? [
        ...(receipt.failClosedReasons.length > 0 ? receipt.failClosedReasons : []),
        ...(rows.execution_receipts.length !== 1 ? ["unexpected_execution_receipt_count"] : []),
        ...(receipt.appliedSteps.length !== rows.execution_steps.length ? ["applied_step_row_mismatch"] : []),
        ...(receipt.rollbackRefs.length !== rows.rollback_refs.length ? ["rollback_row_mismatch"] : [])
      ]
    : ["missing_execution_receipt"];
  const deterministicReceiptIds = receipt
    ? receipt.appliedSteps.every((step) => Boolean(step.receiptId) && Boolean(step.idempotencyKey))
    : false;

  return {
    schemaVersion: "ti.evidence_promotion_transaction_audit_replay.v1",
    generatedAt,
    transactionId: receipt?.transactionId ?? "missing",
    handoffId: receipt?.handoffId ?? "missing",
    state: receipt?.state ?? "missing",
    repository: {
      backend: "postgres_transaction_audit",
      enabled: false,
      disabledByDefault: true,
      liveBackendConnection: false,
      requiredTables: [
        "evidence_promotion_execution_receipts",
        "evidence_promotion_execution_steps",
        "evidence_promotion_execution_held_steps",
        "evidence_promotion_execution_rollbacks"
      ]
    },
    rowCounts: {
      executionReceipts: rows.execution_receipts.length,
      appliedSteps: rows.execution_steps.length,
      heldSteps: rows.held_steps.length,
      rollbackRefs: rows.rollback_refs.length
    },
    replayReady: Boolean(receipt) && deterministicReceiptIds && replayBlockers.every((blocker) => blocker === "promotion_transaction_repository_disabled" || blocker === "held_consumer_steps_require_partial_enablement"),
    replayBlockers,
    deterministicReceiptIds,
    canReplayWithoutRawEvidence: true,
    committedConsumerRows: receipt?.committedConsumerRows ?? { publicAnswer: 0, graph: 0, stix: 0, api: 0 },
    failClosedReasons: receipt?.failClosedReasons ?? [],
    restrictedHandling: receipt?.restrictedHandling ?? {
      metadataOnlyDocumentIds: [],
      caveatedPublicAnswerAllowed: false,
      graphRelationshipsHeld: [],
      stixExportHeld: true,
      vectorPromotionAllowed: false
    },
    safeOutput: SAFE_OUTPUT
  };
}

export function buildEvidenceActorProductImpactReplay(
  writeSet: EvidenceSearchReadModelBackendWriteSet,
  promotionTransaction: EvidencePromotionTransactionPlan,
  auditReplay: EvidencePromotionTransactionAuditReplay,
  input: { generatedAt?: string; freshnessWindowDays?: number } = {}
): EvidenceActorProductImpactReplay {
  const generatedAt = input.generatedAt ?? auditReplay.generatedAt;
  const freshnessWindowDays = input.freshnessWindowDays ?? 30;
  const cutoffMs = Date.parse(generatedAt) - freshnessWindowDays * 24 * 60 * 60 * 1000;
  const rows = writeSet.postgresDocuments.filter((row) => !row.tombstoned_at);
  const rowStates = rows.map((row) => {
    const staleReason = productRowStaleReason(row, cutoffMs);
    return {
      row,
      impact: actorProductImpactRow(row),
      staleReason
    };
  });
  const freshPublicRows = rowStates
    .filter(({ row, staleReason }) => !staleReason && !row.restricted_metadata && !row.metadata_only)
    .map(({ impact }) => impact);
  const restrictedMetadataRows = rowStates
    .filter(({ row, staleReason }) => !staleReason && (row.restricted_metadata || row.metadata_only))
    .map(({ impact }) => impact);
  const staleRowsSuppressed = rowStates
    .filter(({ staleReason }) => Boolean(staleReason))
    .map(({ impact, staleReason }) => ({
      ...impact,
      staleReason: staleReason ?? "stale_row"
    }));
  const freshSourceFamilies = [...new Set([...freshPublicRows, ...restrictedMetadataRows].map((row) => row.sourceFamily).filter((family) => family !== "unknown"))].sort();
  const missingSourceFamilies = actorRequiredSourceFamilies()
    .filter((family) => !freshSourceFamilies.includes(family))
    .map((family) => ({
      family,
      impact: sourceFamilyImpact(family),
      nextAction: sourceFamilyNextAction(family)
    }));
  const canImprovePaidActorResult = freshPublicRows.length > 0 || restrictedMetadataRows.length > 0;
  const state: EvidenceActorProductImpactReplay["state"] = canImprovePaidActorResult && missingSourceFamilies.length === 0 && staleRowsSuppressed.length === 0
    ? "ready"
    : canImprovePaidActorResult
      ? "partial"
      : "hold";

  return {
    schemaVersion: "ti.evidence_actor_product_impact_replay.v1",
    generatedAt,
    handoffId: writeSet.handoffId,
    productSurface: "apify_public_threat_actor_monitor",
    actorBuild: "0.6.4",
    latestProofRunId: "iMQGeezZ8bx7WtlhQ",
    state,
    usefulActorRows: {
      freshRowsImprovingActorResult: freshPublicRows,
      restrictedMetadataRows,
      staleRowsSuppressed,
      missingSourceFamilies
    },
    answerImpact: {
      canImprovePaidActorResult,
      freshnessWindowDays,
      freshSourceFamilies,
      staleSuppressionRequired: staleRowsSuppressed.length > 0,
      darkMetadataSearchable: restrictedMetadataRows.length > 0,
      darkMetadataCaveated: restrictedMetadataRows.length > 0,
      replayableFromDurableRows: true
    },
    replayProof: {
      handoffId: writeSet.handoffId,
      promotionTransactionId: promotionTransaction.transactionId,
      auditReplaySchemaVersion: auditReplay.schemaVersion,
      proofRunId: "iMQGeezZ8bx7WtlhQ",
      proofDatasetId: "5PLmkE30luBA5Lbgc",
      commands: [
        "bun run measure:search-product",
        "bun test src/tests/storageCutover.test.ts",
        "bun test src/tests/api.test.ts -t evidence"
      ]
    },
    noLeakGuarantees: {
      restrictedRowsMetadataOnly: true,
      rawBodiesExposed: false,
      objectKeysExposed: false,
      unsafeUrlsExposed: false,
      credentialsExposed: false,
      restrictedRawContentExposed: false,
      actorInteractionExposed: false,
      vectorEmbeddingsForRestrictedRows: false
    },
    safeOutput: SAFE_OUTPUT
  };
}

export function buildEvidenceActorDatasetPromotionPreview(
  impact: EvidenceActorProductImpactReplay,
  transaction: EvidencePromotionTransactionPlan
): EvidenceActorDatasetPromotionPreview {
  const billableRows = impact.usefulActorRows.freshRowsImprovingActorResult.map((row) =>
    actorDatasetPromotionRow(row, "evidence_result")
  );
  const contextRows = impact.usefulActorRows.restrictedMetadataRows.map((row) =>
    actorDatasetPromotionRow(row, "metadata_context")
  );
  const staleRows = impact.usefulActorRows.staleRowsSuppressed.map((row) =>
    actorDatasetPromotionRow(row, "stale_suppression", row.staleReason)
  );
  const gapRows = impact.usefulActorRows.missingSourceFamilies.map((gap) =>
    actorDatasetGapRow(impact.handoffId, gap)
  );
  const rows = [...billableRows, ...contextRows, ...staleRows, ...gapRows];
  const inputDocumentIds = uniqueDefined(rows.map((row) => row.documentId));
  const readyDocumentIds = uniqueDefined(billableRows.map((row) => row.documentId));
  const heldDocumentIds = uniqueDefined(contextRows.map((row) => row.documentId));
  const staleSuppressedDocumentIds = uniqueDefined(staleRows.map((row) => row.documentId));

  return {
    schemaVersion: "ti.evidence_actor_dataset_promotion_preview.v1",
    generatedAt: impact.generatedAt,
    handoffId: impact.handoffId,
    productSurface: "apify_public_threat_actor_monitor",
    actorBuild: "0.6.4",
    sourceImpactReplay: impact.schemaVersion,
    dryRun: true,
    willMutateActorDataset: false,
    latestProof: {
      runId: "iMQGeezZ8bx7WtlhQ",
      datasetId: "5PLmkE30luBA5Lbgc"
    },
    counts: {
      billableResultCandidates: billableRows.length,
      caveatedContextRows: contextRows.length,
      staleRowsSuppressed: staleRows.length,
      coverageGapRows: gapRows.length
    },
    rows,
    publicAnswerConsumer: {
      targetReadModel: "api_intel_search_answer_cache",
      inputDocumentIds,
      readyDocumentIds,
      heldDocumentIds,
      staleSuppressedDocumentIds
    },
    noLeakGuarantees: { ...impact.noLeakGuarantees },
    safeOutput: SAFE_OUTPUT
  };
}

export function buildEvidenceActorDatasetConsumerHandoff(
  preview: EvidenceActorDatasetPromotionPreview
): EvidenceActorDatasetConsumerHandoff {
  const actorDatasetRows: EvidenceActorDatasetConsumerRow[] = preview.rows.map(actorDatasetConsumerRow);
  const publicAnswerCacheWrites: EvidenceActorPublicAnswerCacheWrite[] = preview.rows.map(actorPublicAnswerCacheWrite);
  const suppressionReceipts = preview.rows
    .filter((row) => row.paidRowDecision !== "billable_result_candidate")
    .map((row) => ({
      receiptId: stableId("evidence-actor-dataset-suppression", `${preview.handoffId}:${row.rowId}:${row.paidRowDecision}`),
      sourceRowId: row.rowId,
      documentId: row.documentId,
      reason: row.paidRowDecision === "not_billable_suppressed"
        ? "stale_row" as const
        : row.paidRowDecision === "not_billable_coverage_gap"
          ? "coverage_gap" as const
          : "unsafe_or_restricted_for_dataset" as const,
      visibleState: row.paidRowDecision === "not_billable_suppressed"
        ? "suppressed" as const
        : row.paidRowDecision === "not_billable_coverage_gap"
          ? "coverage_gap" as const
          : "context_only" as const,
      noLeak: true as const
    }));
  const coverageGapRows = actorDatasetRows.filter((row) => row.actorDatasetAction === "render_coverage_gap");

  return {
    schemaVersion: "ti.evidence_actor_dataset_consumer_handoff.v1",
    generatedAt: preview.generatedAt,
    handoffId: stableId("evidence-actor-dataset-consumer", `${preview.handoffId}:${preview.latestProof.runId}`),
    sourcePreview: preview.schemaVersion,
    productSurface: preview.productSurface,
    actorBuild: preview.actorBuild,
    dryRun: true,
    willWriteActorDataset: false,
    willWritePublicAnswerCache: false,
    latestProof: { ...preview.latestProof },
    counts: {
      actorDatasetRows: actorDatasetRows.length,
      sellableCandidates: actorDatasetRows.filter((row) => row.actorDatasetAction === "render_sellable_candidate").length,
      caveatedContextRows: actorDatasetRows.filter((row) => row.actorDatasetAction === "render_caveated_context").length,
      suppressedRows: actorDatasetRows.filter((row) => row.actorDatasetAction === "suppress_from_dataset").length,
      coverageGapRows: coverageGapRows.length,
      publicAnswerCacheWrites: publicAnswerCacheWrites.length
    },
    actorDatasetRows,
    publicAnswerCacheWrites,
    suppressionReceipts,
    coverageGapRows,
    noLeakGuarantees: { ...preview.noLeakGuarantees },
    safeOutput: SAFE_OUTPUT
  };
}

export function executeEvidenceActorDatasetConsumerHandoff(
  handoff: EvidenceActorDatasetConsumerHandoff,
  input: { generatedAt?: string } = {}
): EvidenceActorDatasetConsumerExecutionReceipt {
  const generatedAt = input.generatedAt ?? handoff.generatedAt;
  const actorDatasetReceipts = handoff.actorDatasetRows.map((row) => ({
    receiptId: stableId("evidence-actor-dataset-consumer-execution", `${handoff.handoffId}:${row.datasetRowId}:held`),
    datasetRowId: row.datasetRowId,
    sourcePromotionRowId: row.sourcePromotionRowId,
    state: "held" as const,
    reason: row.actorDatasetAction === "render_sellable_candidate"
      ? "actor_dataset_repository_disabled" as const
      : "restricted_or_non_billable_row_held" as const,
    intendedAction: row.actorDatasetAction,
    noLeak: true as const
  }));
  const publicAnswerCacheReceipts = handoff.publicAnswerCacheWrites.map((write) => ({
    receiptId: stableId("evidence-public-answer-cache-consumer-execution", `${handoff.handoffId}:${write.cacheWriteId}:held`),
    cacheWriteId: write.cacheWriteId,
    cacheKey: write.cacheKey,
    state: "held" as const,
    reason: "public_answer_cache_repository_disabled" as const,
    intendedAction: write.action,
    noLeak: true as const
  }));

  return {
    schemaVersion: "ti.evidence_actor_dataset_consumer_execution.v1",
    generatedAt,
    executionId: stableId("evidence-actor-dataset-consumer-execution", `${handoff.handoffId}:${generatedAt}`),
    sourceHandoff: handoff.schemaVersion,
    productSurface: handoff.productSurface,
    actorBuild: handoff.actorBuild,
    status: "blocked_repository_disabled",
    enabled: false,
    dryRun: true,
    liveBackendConnection: false,
    willWriteActorDataset: false,
    willWritePublicAnswerCache: false,
    repositoryBoundary: {
      actorDatasetRepository: "disabled_actor_dataset_repository",
      publicAnswerCacheRepository: "disabled_public_answer_cache_repository",
      requiredFeatureFlags: ["TI_ACTOR_DATASET_CONSUMER_WRITES_ENABLED", "TI_PUBLIC_ANSWER_CACHE_WRITES_ENABLED"],
      failClosedWithoutExplicitEnable: true
    },
    counts: {
      actorDatasetRowsHeld: actorDatasetReceipts.length,
      publicAnswerCacheWritesHeld: publicAnswerCacheReceipts.length,
      sellableRowsHeld: handoff.counts.sellableCandidates,
      caveatedContextRowsHeld: handoff.counts.caveatedContextRows,
      suppressedRowsHeld: handoff.counts.suppressedRows,
      coverageGapRowsHeld: handoff.counts.coverageGapRows,
      actorDatasetRowsWritten: 0,
      publicAnswerCacheWritesWritten: 0
    },
    actorDatasetReceipts,
    publicAnswerCacheReceipts,
    blockedReasons: ["actor_dataset_repository_disabled", "public_answer_cache_repository_disabled"],
    rollbackRefs: [],
    noLeakGuarantees: { ...handoff.noLeakGuarantees },
    safeOutput: SAFE_OUTPUT
  };
}

class InMemoryEvidenceSearchReadModelRepository implements EvidenceSearchReadModelRepository {
  readonly backend: EvidenceSearchReadModelBackend = "embedded_memory";
  private readonly records = new Map<string, EvidenceSearchReadModelRecord>();
  private readonly generatedAt: string;

  constructor(config: EvidenceSearchReadModelConfig) {
    this.generatedAt = config.generatedAt ?? nowIso();
  }

  readiness(): EvidenceSearchReadModelReadiness {
    return readModelReadiness(this.backend, true);
  }

  writeHandoff(handoff: EvidenceSearchIndexHandoff): EvidenceSearchReadModelWriteResult {
    const handoffId = stableId("evidence-search-handoff", `${handoff.tenantId ?? "global"}:${handoff.normalizedQuery}:${handoff.documents.length}:${handoff.generatedAt}`);
    let replacedDocuments = 0;
    let embeddingEligible = 0;
    let restrictedMetadataIndexed = 0;
    const skippedDocuments: EvidenceSearchReadModelWriteResult["skippedDocuments"] = [];

    for (const document of handoff.documents) {
      if (!document.replay.replayId) {
        skippedDocuments.push({ documentId: document.documentId, reason: "missing_replay_id" });
        continue;
      }
      const skipReason = unsafeDocumentReason(document);
      if (skipReason) {
        skippedDocuments.push({ documentId: document.documentId, reason: skipReason });
        continue;
      }
      if (this.records.has(document.documentId)) replacedDocuments += 1;
      if (document.embedding.eligible) embeddingEligible += 1;
      if (document.redaction.restricted || document.redaction.metadataOnly) restrictedMetadataIndexed += 1;
      this.records.set(document.documentId, {
        document,
        indexedAt: this.generatedAt,
        sourceHandoffId: handoffId,
        retentionClass: document.redaction.retentionClass,
        embeddingInputHash: document.embedding.eligible ? document.embedding.inputTextHash : undefined,
        tombstoned: false
      });
    }

    return {
      handoffId,
      acceptedDocuments: handoff.documents.length - skippedDocuments.length,
      replacedDocuments,
      embeddingEligible,
      restrictedMetadataIndexed,
      restrictedMetadataEmbedded: false,
      skippedDocuments,
      safeOutput: SAFE_OUTPUT
    };
  }

  search(query: EvidenceSearchReadModelQuery): EvidenceSearchReadModelSearchResult[] {
    const terms = tokenize(query.query);
    const limit = query.limit ?? 20;
    return [...this.records.values()]
      .filter((record) => !record.tombstoned)
      .filter((record) => !query.tenantId || record.document.tenantId === query.tenantId)
      .filter((record) => query.includeRestrictedMetadata !== false || !record.document.redaction.restricted)
      .filter((record) => !query.embeddingEligibleOnly || record.document.embedding.eligible)
      .map((record) => resultForRecord(record, terms))
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score || left.documentId.localeCompare(right.documentId))
      .slice(0, limit);
  }

  deleteByRetention(input: { retentionClasses: RetentionClass[]; legalHoldCaptureIds?: string[]; reason: string }): EvidenceSearchReadModelDeleteResult {
    const retentionClasses = new Set(input.retentionClasses);
    const legalHoldCaptureIds = new Set(input.legalHoldCaptureIds ?? []);
    const affectedDocumentIds: string[] = [];
    let retainedLegalHoldDocuments = 0;

    for (const record of this.records.values()) {
      if (!record.retentionClass || !retentionClasses.has(record.retentionClass)) continue;
      if (record.document.captureId && legalHoldCaptureIds.has(record.document.captureId)) {
        retainedLegalHoldDocuments += 1;
        continue;
      }
      record.tombstoned = true;
      record.tombstoneReason = input.reason;
      affectedDocumentIds.push(record.document.documentId);
    }

    return {
      tombstonedDocuments: affectedDocumentIds.length,
      retainedLegalHoldDocuments,
      affectedDocumentIds,
      safeOutput: SAFE_OUTPUT
    };
  }

  stats(): EvidenceSearchReadModelStats {
    const records = [...this.records.values()];
    const active = records.filter((record) => !record.tombstoned);
    return {
      backend: this.backend,
      enabled: true,
      documentCount: records.length,
      activeDocumentCount: active.length,
      tombstonedDocumentCount: records.length - active.length,
      embeddingEligibleCount: active.filter((record) => record.document.embedding.eligible).length,
      restrictedMetadataCount: active.filter((record) => record.document.redaction.restricted || record.document.redaction.metadataOnly).length,
      restrictedMetadataEmbedded: false,
      tenantRoutingKeys: [...new Set(active.map((record) => record.document.backendHints.routingKey))].sort(),
      safeOutput: SAFE_OUTPUT
    };
  }
}

class DisabledEvidenceSearchReadModelRepository implements EvidenceSearchReadModelRepository {
  readonly backend: EvidenceSearchReadModelBackend;
  private readonly enabled: boolean;

  constructor(backend: EvidenceSearchReadModelBackend, config: EvidenceSearchReadModelConfig) {
    this.backend = backend;
    this.enabled = config.enabled === true;
  }

  readiness(): EvidenceSearchReadModelReadiness {
    return readModelReadiness(this.backend, this.enabled);
  }

  writeHandoff(_handoff: EvidenceSearchIndexHandoff): never {
    throw new Error(`${this.backend} evidence search read model is disabled until explicit feature-flagged cutover`);
  }

  search(_query: EvidenceSearchReadModelQuery): never {
    throw new Error(`${this.backend} evidence search read model is disabled until explicit feature-flagged cutover`);
  }

  deleteByRetention(_input: { retentionClasses: RetentionClass[]; legalHoldCaptureIds?: string[]; reason: string }): never {
    throw new Error(`${this.backend} evidence search read model is disabled until explicit feature-flagged cutover`);
  }

  stats(): EvidenceSearchReadModelStats {
    return {
      backend: this.backend,
      enabled: this.enabled,
      documentCount: 0,
      activeDocumentCount: 0,
      tombstonedDocumentCount: 0,
      embeddingEligibleCount: 0,
      restrictedMetadataCount: 0,
      restrictedMetadataEmbedded: false,
      tenantRoutingKeys: [],
      safeOutput: SAFE_OUTPUT
    };
  }
}

function readModelReadiness(backend: EvidenceSearchReadModelBackend, enabled: boolean): EvidenceSearchReadModelReadiness {
  return {
    schemaVersion: "ti.evidence_search_read_model_adapter.v1",
    backend,
    enabled,
    disabledByDefault: backend !== "embedded_memory",
    canWrite: backend === "embedded_memory" || enabled,
    canSearch: backend === "embedded_memory" || enabled,
    failClosedWithoutExplicitEnable: backend !== "embedded_memory",
    liveBackendConnection: false,
    requiredFeatureFlags: backend === "embedded_memory"
      ? []
      : ["SCRAPER_EVIDENCE_SEARCH_BACKEND", "SCRAPER_EVIDENCE_SEARCH_BACKEND_ENABLED"],
    postgresTables: ["evidence_search_documents", "evidence_search_tombstones", "evidence_search_replay_checkpoints"],
    openSearchAliases: ["ti-evidence-read", "ti-evidence-write-candidate"],
    pgvectorTables: ["evidence_vector_candidate"],
    noLeakGuarantees: {
      restrictedMetadataSearchable: true,
      restrictedMetadataEmbedded: false,
      rawBodiesStored: false,
      objectKeysStored: false,
      unsafeUrlsStored: false
    },
    safeOutput: SAFE_OUTPUT
  };
}

function resultForRecord(record: EvidenceSearchReadModelRecord, terms: string[]): EvidenceSearchReadModelSearchResult {
  const haystack = [
    record.document.title,
    record.document.summary,
    record.document.searchText,
    record.document.tags.join(" ")
  ].join(" ").toLowerCase();
  const matchedTerms = terms.filter((term) => haystack.includes(term));
  const score = matchedTerms.length === 0
    ? 0
    : matchedTerms.length
      + (record.document.embedding.eligible ? 0.25 : 0)
      + (record.document.kind === "claim" ? 0.2 : 0)
      + (record.document.redaction.restricted ? 0.1 : 0);

  return {
    documentId: record.document.documentId,
    kind: record.document.kind,
    tenantId: record.document.tenantId,
    captureId: record.document.captureId,
    claimLedgerEntryId: record.document.claimLedgerEntryId,
    relationshipId: record.document.relationshipId,
    sourceId: record.document.sourceId,
    title: record.document.title,
    summary: record.document.summary,
    score,
    matchedTerms,
    embeddingEligible: record.document.embedding.eligible,
    embeddingInputHash: record.embeddingInputHash,
    restrictedMetadata: record.document.redaction.restricted,
    metadataOnly: record.document.redaction.metadataOnly,
    retentionClass: record.retentionClass,
    replayId: record.document.replay.replayId,
    citationCount: record.document.citationSpans.length,
    safeOutput: {
      rawBodiesExposed: false,
      objectKeysExposed: false,
      unsafeUrlsExposed: false,
      credentialsExposed: false,
      restrictedRawContentExposed: false
    }
  };
}

function uniqueDefined(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function promotionTransactionStep(
  handoffId: string,
  order: number,
  consumer: EvidencePromotionTransactionPlan["transactionSteps"][number]["consumer"],
  plan: EvidencePromotionConsumerPlan
): EvidencePromotionTransactionPlan["transactionSteps"][number] {
  const inputDocumentIds = plan.supportDocumentIds;
  const blockers = plan.blockers;
  return {
    stepId: stableId("evidence-promotion-step", `${handoffId}:${order}:${consumer}:${inputDocumentIds.join(",")}`),
    order,
    consumer,
    action: `write_${plan.targetReadModel}`,
    inputDocumentIds,
    idempotencyKey: stableId("evidence-promotion-idempotency", `${handoffId}:${consumer}:${plan.targetReadModel}`),
    status: plan.status === "ready" ? "ready" : "hold",
    blockers
  };
}

function consumerPlanForStep(
  plan: EvidencePromotionTransactionPlan,
  consumer: EvidencePromotionTransactionPlan["transactionSteps"][number]["consumer"]
): EvidencePromotionConsumerPlan {
  if (consumer === "public_answer") return plan.consumers.publicAnswer;
  if (consumer === "graph") return plan.consumers.graph;
  if (consumer === "stix") return plan.consumers.stix;
  return plan.consumers.api;
}

function countAppliedConsumer(
  steps: EvidencePromotionTransactionExecutionReceipt["appliedSteps"],
  consumer: EvidencePromotionTransactionPlan["transactionSteps"][number]["consumer"]
): number {
  return steps.filter((step) => step.consumer === consumer).reduce((sum, step) => sum + step.documentCount, 0);
}

function cloneRestrictedHandling(
  restrictedHandling: EvidencePromotionTransactionPlan["restrictedHandling"]
): EvidencePromotionTransactionPlan["restrictedHandling"] {
  return {
    metadataOnlyDocumentIds: [...restrictedHandling.metadataOnlyDocumentIds],
    caveatedPublicAnswerAllowed: restrictedHandling.caveatedPublicAnswerAllowed,
    graphRelationshipsHeld: [...restrictedHandling.graphRelationshipsHeld],
    stixExportHeld: restrictedHandling.stixExportHeld,
    vectorPromotionAllowed: false
  };
}

function summarizePromotionRows(
  rows: EvidenceSearchReadModelPostgresDocumentRow[],
  restrictedRows: EvidenceSearchReadModelPostgresDocumentRow[]
): string[] {
  if (rows.length === 0) return ["No durable read-model rows are available for public answer replay."];
  const kinds = new Map<EvidenceSearchIndexDocument["kind"], number>();
  for (const row of rows) kinds.set(row.kind, (kinds.get(row.kind) ?? 0) + 1);
  const bullets = [
    `Durable replay includes ${rows.length} read-model documents across ${[...kinds.entries()].map(([kind, count]) => `${count} ${kind}`).join(", ")}.`,
    `Replay references ${uniqueDefined(rows.map((row) => row.capture_id)).length} captures, ${uniqueDefined(rows.map((row) => row.claim_ledger_entry_id)).length} claims, and ${uniqueDefined(rows.map((row) => row.relationship_id)).length} graph relationships.`
  ];
  if (restrictedRows.length > 0) {
    bullets.push(`${restrictedRows.length} restricted or metadata-only documents are available only as caveated defensive context and are excluded from embedding/vector promotion.`);
  }
  return bullets;
}

function actorProductImpactRow(row: EvidenceSearchReadModelPostgresDocumentRow): EvidenceActorProductImpactRow {
  return {
    documentId: row.document_id,
    kind: row.kind,
    sourceId: row.source_id,
    captureId: row.capture_id,
    claimLedgerEntryId: row.claim_ledger_entry_id,
    relationshipId: row.relationship_id,
    sourceFamily: inferActorSourceFamily(row),
    title: row.title,
    evidenceEffect: productEvidenceEffect(row),
    observedAt: row.freshness.observedAt,
    collectedAt: row.freshness.collectedAt,
    publishedAt: row.freshness.publishedAt,
    confidence: row.confidence,
    replayId: row.replay.replayId,
    retentionClass: row.retention_class,
    restrictedMetadata: row.restricted_metadata,
    metadataOnly: row.metadata_only,
    embeddingEligible: row.embedding.eligible && !row.restricted_metadata && !row.metadata_only
  };
}

function productEvidenceEffect(row: EvidenceSearchReadModelPostgresDocumentRow): string {
  if (row.restricted_metadata || row.metadata_only) {
    return "adds caveated defensive leak/victim metadata to Actor rows without raw material";
  }
  if (row.kind === "claim") return "adds reviewed claim support for Actor summary facts";
  if (row.kind === "graph_relationship") return "adds relationship context when review/export gates allow it";
  if (row.kind === "source") return "adds source-family coverage evidence";
  return "adds fresh public evidence for buyer-visible Actor result rows";
}

function productRowStaleReason(row: EvidenceSearchReadModelPostgresDocumentRow, cutoffMs: number): string | undefined {
  if ((row.kind === "capture" || row.kind === "claim") && !row.replay.extractorVersion) return "missing_extractor_version_refresh_required";
  const newestMs = newestFreshnessMs(row);
  if (newestMs === undefined) return "missing_freshness_timestamp";
  if (newestMs < cutoffMs) return "outside_actor_freshness_window";
  return undefined;
}

function newestFreshnessMs(row: EvidenceSearchReadModelPostgresDocumentRow): number | undefined {
  const values = [
    row.freshness.observedAt,
    row.freshness.collectedAt,
    row.freshness.publishedAt,
    row.freshness.cursor
  ]
    .map((value) => value ? Date.parse(value) : Number.NaN)
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return undefined;
  return Math.max(...values);
}

function inferActorSourceFamily(
  row: EvidenceSearchReadModelPostgresDocumentRow
): EvidenceActorProductImpactRow["sourceFamily"] {
  const text = [
    row.source_id,
    row.retention_class,
    row.kind,
    ...row.tags
  ].join(" ").toLowerCase();
  if (row.restricted_metadata || row.metadata_only || /restricted|dark|tor|leak|victim/.test(text)) return "restricted_metadata";
  if (/public_channel|telegram|channel|chat/.test(text)) return "public_channel";
  if (/advisory|cve|cert|cisa|nvd|github/.test(text)) return "advisory";
  if (/public_report|static_web|report|blog|research/.test(text)) return "public_report";
  return "unknown";
}

function actorRequiredSourceFamilies(): Array<"public_report" | "public_channel" | "advisory" | "restricted_metadata"> {
  return ["public_report", "public_channel", "advisory", "restricted_metadata"];
}

function sourceFamilyImpact(family: "public_report" | "public_channel" | "advisory" | "restricted_metadata"): string {
  if (family === "public_channel") return "APT42/public-channel freshness gaps remain visible in paid Actor rows";
  if (family === "advisory") return "CVE/infrastructure rows lack advisory corroboration";
  if (family === "restricted_metadata") return "leak/victim/company/dataset metadata cannot improve defensive context";
  return "actor summaries depend on thin or stale public reporting";
}

function sourceFamilyNextAction(family: "public_report" | "public_channel" | "advisory" | "restricted_metadata"): string {
  if (family === "public_channel") return "activate approved public-channel metadata/feed rows and replay into this read model";
  if (family === "advisory") return "replay public advisory/CVE source rows into Actor-supporting evidence";
  if (family === "restricted_metadata") return "import approved Tier 100 dark metadata descriptors as metadata-only rows";
  return "refresh vetted public report captures and suppress stale-only rows";
}

function actorDatasetPromotionRow(
  row: EvidenceActorProductImpactRow,
  rowType: "evidence_result" | "metadata_context" | "stale_suppression",
  staleReason?: string
): EvidenceActorDatasetPromotionRow {
  const contextOnly = rowType === "metadata_context";
  const stale = rowType === "stale_suppression";
  return {
    rowId: stableId("evidence-actor-dataset-row", `${row.documentId}:${rowType}:${staleReason ?? "fresh"}`),
    rowType,
    paidRowDecision: stale
      ? "not_billable_suppressed"
      : contextOnly
        ? "not_billable_context"
        : "billable_result_candidate",
    paidRowReason: stale
      ? `suppressed because ${staleReason ?? "stale_row"}`
      : contextOnly
        ? "restricted metadata may appear only as caveated defensive context"
        : "fresh public evidence can render as a paid Actor result row after row formatting",
    billingGuidance: stale
      ? "suppress_do_not_bill"
      : contextOnly
        ? "context_only_do_not_bill"
        : "eligible_after_actor_row_render",
    buyerValueScore: actorDatasetBuyerValue(row, rowType),
    sourceFamily: row.sourceFamily,
    documentId: row.documentId,
    sourceId: row.sourceId,
    captureId: row.captureId,
    claimLedgerEntryId: row.claimLedgerEntryId,
    relationshipId: row.relationshipId,
    title: row.title,
    summary: row.evidenceEffect,
    replayId: row.replayId,
    freshness: {
      observedAt: row.observedAt,
      collectedAt: row.collectedAt,
      publishedAt: row.publishedAt
    },
    confidence: row.confidence,
    retentionClass: row.retentionClass,
    noLeak: true
  };
}

function actorDatasetGapRow(
  handoffId: string,
  gap: EvidenceActorProductImpactReplay["usefulActorRows"]["missingSourceFamilies"][number]
): EvidenceActorDatasetPromotionRow {
  return {
    rowId: stableId("evidence-actor-dataset-gap", `${handoffId}:${gap.family}`),
    rowType: "coverage_gap",
    paidRowDecision: "not_billable_coverage_gap",
    paidRowReason: gap.impact,
    billingGuidance: "gap_row_do_not_bill",
    buyerValueScore: 0,
    sourceFamily: gap.family,
    title: `Missing ${gap.family.replaceAll("_", " ")} coverage`,
    summary: gap.nextAction,
    noLeak: true
  };
}

function actorDatasetBuyerValue(row: EvidenceActorProductImpactRow, rowType: "evidence_result" | "metadata_context" | "stale_suppression"): number {
  if (rowType === "stale_suppression") return 0;
  const confidence = row.confidence ?? 0.5;
  const sourceFamilyWeight = row.sourceFamily === "public_report" || row.sourceFamily === "advisory" ? 0.18 : row.sourceFamily === "public_channel" ? 0.12 : 0.08;
  const publicWeight = rowType === "evidence_result" ? 0.24 : 0;
  const metadataContextWeight = rowType === "metadata_context" ? 0.14 : 0;
  const replayWeight = row.replayId ? 0.12 : 0;
  return Math.round(Math.min(1, confidence * 0.46 + sourceFamilyWeight + publicWeight + metadataContextWeight + replayWeight) * 1000) / 1000;
}

function actorDatasetConsumerRow(row: EvidenceActorDatasetPromotionRow): EvidenceActorDatasetConsumerRow {
  const action = actorDatasetActionFor(row.paidRowDecision);
  return {
    datasetRowId: stableId("evidence-actor-dataset-rendered-row", `${row.rowId}:${action}`),
    sourcePromotionRowId: row.rowId,
    actorDatasetAction: action,
    paidRowDecision: action === "render_sellable_candidate" ? "sellable" : action === "render_caveated_context" ? "included_with_caveat" : "hold",
    paidRowReason: row.paidRowReason,
    billingGuidance: action === "render_sellable_candidate"
      ? "charge_after_actor_emit"
      : action === "render_caveated_context"
        ? "do_not_charge_context"
        : action === "suppress_from_dataset"
          ? "do_not_charge_suppressed"
          : "do_not_charge_gap",
    buyerValueScore: row.buyerValueScore,
    evidenceGrade: action === "render_sellable_candidate"
      ? "corroborated"
      : action === "render_caveated_context"
        ? "metadata_only_context"
        : action === "suppress_from_dataset"
          ? "stale_suppressed"
          : "coverage_gap",
    coverageStatus: action === "render_sellable_candidate"
      ? "ready_for_dataset"
      : action === "render_caveated_context"
        ? "context_only"
        : action === "suppress_from_dataset"
          ? "suppressed"
          : "gap",
    title: row.title,
    summary: row.summary,
    sourceFamily: row.sourceFamily,
    documentId: row.documentId,
    sourceId: row.sourceId,
    captureId: row.captureId,
    replayId: row.replayId,
    retentionClass: row.retentionClass,
    safety: {
      rawContentIncluded: false,
      restrictedMaterialIncluded: false,
      unsafeUrlIncluded: false,
      credentialIncluded: false,
      actorInteractionRequired: false
    }
  };
}

function actorPublicAnswerCacheWrite(row: EvidenceActorDatasetPromotionRow): EvidenceActorPublicAnswerCacheWrite {
  const action = row.paidRowDecision === "billable_result_candidate"
    ? "upsert_ready_context"
    : row.paidRowDecision === "not_billable_context"
      ? "upsert_caveated_context"
      : row.paidRowDecision === "not_billable_suppressed"
        ? "suppress_stale_context"
        : "record_coverage_gap";
  return {
    cacheWriteId: stableId("evidence-actor-public-answer-cache", `${row.rowId}:${action}`),
    sourcePromotionRowId: row.rowId,
    cacheKey: stableId("api-intel-search-answer-cache", `${row.documentId ?? row.rowId}:${row.sourceFamily ?? "gap"}`),
    action,
    documentId: row.documentId,
    visibleState: action === "upsert_ready_context"
      ? "ready"
      : action === "upsert_caveated_context"
        ? "partial"
        : action === "suppress_stale_context"
          ? "suppressed"
          : "coverage_gap",
    summary: row.summary,
    noLeak: true
  };
}

function actorDatasetActionFor(
  decision: EvidenceActorDatasetPromotionRow["paidRowDecision"]
): EvidenceActorDatasetConsumerRow["actorDatasetAction"] {
  if (decision === "billable_result_candidate") return "render_sellable_candidate";
  if (decision === "not_billable_context") return "render_caveated_context";
  if (decision === "not_billable_suppressed") return "suppress_from_dataset";
  return "render_coverage_gap";
}

function tokenize(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/[^a-z0-9-]+/).filter((term) => term.length > 1))];
}

function unsafeDocumentReason(document: EvidenceSearchIndexDocument): string | undefined {
  if (!document.replay.replayId) return "missing_replay_id";
  if (document.redaction.rawBodyIncluded || document.redaction.objectKeyIncluded || document.redaction.unsafeUrlIncluded) return "unsafe_redaction_flags";
  if (document.redaction.restricted && document.embedding.eligible) return "restricted_embedding_attempt";
  if (document.redaction.metadataOnly && document.embedding.eligible) return "metadata_only_embedding_attempt";
  return undefined;
}

function sanitizedEmbedding(document: Pick<EvidenceSearchIndexDocument, "embedding" | "redaction">): EvidenceSearchIndexDocument["embedding"] {
  if (document.redaction.restricted || document.redaction.metadataOnly) {
    return {
      eligible: false,
      reason: document.redaction.restricted ? "restricted_metadata_excluded" : "metadata_summary_only",
      modelBoundary: "external_vector_backend"
    };
  }
  return {
    eligible: document.embedding.eligible,
    reason: document.embedding.reason,
    inputTextHash: document.embedding.eligible ? document.embedding.inputTextHash : undefined,
    modelBoundary: document.embedding.modelBoundary
  };
}

function sanitizedRedaction(document: Pick<EvidenceSearchIndexDocument, "redaction">): EvidenceSearchIndexDocument["redaction"] {
  return {
    metadataOnly: document.redaction.metadataOnly,
    restricted: document.redaction.restricted,
    legalHold: document.redaction.legalHold,
    retentionClass: document.redaction.retentionClass,
    rawBodyIncluded: false,
    objectKeyIncluded: false,
    unsafeUrlIncluded: false
  };
}
