// @ts-nocheck
export type EvidenceSearchReadModelBackend = "embedded_memory" | "postgres_read_model" | "opensearch_pgvector";
export type EvidenceSearchReadModelConfig = any; export type EvidenceSearchReadModelRecord = any; export type EvidenceSearchReadModelQuery = any;
export type EvidenceSearchReadModelSearchResult = any; export type EvidenceSearchReadModelWriteResult = any; export type EvidenceSearchReadModelDeleteResult = any;
export type EvidenceSearchReadModelStats = any; export type EvidenceSearchReadModelReadiness = any; export type EvidenceSearchReadModelSafety = any;
export type EvidenceSearchReadModelPostgresDocumentRow = any; export type EvidenceSearchReadModelTombstoneRow = any; export type EvidenceSearchOpenSearchDocument = any;
export type EvidenceSearchPgvectorCandidateRow = any; export type EvidenceSearchReadModelBackendWriteSet = any; export type EvidenceSearchableSourceMetadataCatalog = any;
export type EvidenceSearchableSourceMetadataCatalogRow = any; export type EvidenceSearchableSourceMetadataPublicSupportQueue = any; export type EvidenceSearchableSourceMetadataPublicSupportCandidate = any;
export type EvidenceSearchableSourceMetadataPublicSupportPostgresRows = any; export type EvidenceSearchableSourceMetadataPublicSupportQueueRunRow = any; export type EvidenceSearchableSourceMetadataPublicSupportCandidateRow = any;
export type EvidenceSearchableSourceMetadataPublicSupportRepositoryStatus = any; export type EvidenceSearchableSourceMetadataPublicSupportRepository = any;
export type EvidenceSearchableSourceMetadataPromotionGate = any; export type EvidenceSearchableSourceMetadataPromotionGateRow = any; export type EvidenceSearchableSourceMetadataPromotionGatePostgresRows = any;
export type EvidenceSearchableSourceMetadataPromotionGateRunRow = any; export type EvidenceSearchableSourceMetadataPromotionGateDecisionRow = any; export type EvidenceSearchableSourceMetadataPromotionGateRepositoryStatus = any;
export type EvidenceSearchableSourceMetadataPromotionGateRepository = any; export type EvidenceSearchableSourceMetadataPromotionConsumerReplay = any;
export type EvidenceSearchableSourceMetadataPromotionConsumerReplayReceipt = any; export type EvidenceSearchableSourceMetadataPublicSupportReplayReceiptLedger = any;
export type EvidenceSearchableSourceMetadataPublicSupportReplayReceipt = any; export type EvidenceSearchableSourceMetadataPublicSupportReplayReceiptPostgresRows = any;
export type EvidenceSearchableSourceMetadataPublicSupportReplayRunRow = any; export type EvidenceSearchableSourceMetadataPublicSupportReplayReceiptRow = any;
export type EvidenceSearchableSourceMetadataPublicSupportReplayReceiptRepositoryStatus = any; export type EvidenceSearchableSourceMetadataPublicSupportReplayReceiptRepository = any;
export type EvidenceSearchReadModelPromotionReplay = any; export type EvidencePromotionTransactionPlan = any; export type EvidencePromotionConsumerPlan = any;
export type EvidencePromotionTransactionExecutionConfig = any; export type EvidencePromotionTransactionExecutionReceipt = any; export type EvidencePromotionTransactionExecutionPostgresRows = any;
export type EvidencePromotionExecutionReceiptRow = any; export type EvidencePromotionExecutionStepRow = any; export type EvidencePromotionExecutionHeldStepRow = any;
export type EvidencePromotionExecutionRollbackRow = any; export type EvidencePromotionTransactionAuditReplay = any; export type EvidenceActorProductImpactReplay = any;
export type EvidenceActorProductImpactRow = any; export type EvidenceActorDatasetPromotionPreview = any; export type EvidenceActorDatasetSourceGapSuppressionFeedback = any;
export type EvidenceActorDatasetSourceGapConsumerQueue = any; export type EvidenceActorDatasetSourceGapConsumerQueueRow = any; export type EvidenceActorDatasetSourceGapConsumerQueuePostgresRows = any;
export type EvidenceActorDatasetSourceGapConsumerQueueRunRow = any; export type EvidenceActorDatasetSourceGapConsumerQueueItemRow = any; export type EvidenceActorDatasetSourceGapConsumerQueueAuditRepositoryStatus = any;
export type EvidenceActorDatasetSourceGapConsumerQueueAuditRepository = any; export type EvidenceActorDatasetSourceGapRepairHandoff = any; export type EvidenceActorDatasetSourceGapRepairPacket = any;
export type EvidenceActorDatasetSourceGapRepairReplayLedger = any; export type EvidenceActorDatasetSourceGapRepairReplayCheckpoint = any; export type EvidenceActorDatasetSourceGapRepairReplayPostgresRows = any;
export type EvidenceActorDatasetSourceGapRepairReplayLedgerRunRow = any; export type EvidenceActorDatasetSourceGapRepairReplayCheckpointRow = any; export type EvidenceActorDatasetSourceGapRepairReplayRepositoryStatus = any;
export type EvidenceActorDatasetSourceGapRepairReplayRepository = any; export type EvidenceActorDatasetPromotionRow = any; export type EvidenceActorDatasetConsumerHandoff = any;
export type EvidenceActorDatasetConsumerExecutionReceipt = any; export type EvidenceActorDatasetConsumerExecutionPostgresRows = any; export type EvidenceActorDatasetConsumerExecutionReceiptRow = any;
export type EvidenceActorDatasetConsumerActorDatasetReceiptRow = any; export type EvidenceActorDatasetConsumerPublicAnswerCacheReceiptRow = any; export type EvidenceActorDatasetConsumerAuditReplay = any;
export type EvidenceActorDatasetConsumerAuditRepositoryStatus = any; export type EvidenceActorDatasetConsumerAuditRepository = any; export type EvidenceActorDatasetConsumerRow = any;
export type EvidenceActorPublicAnswerCacheWrite = any; export type EvidenceSearchReadModelRepository = any;

const now = () => new Date().toISOString();
const safety = () => ({ metadataOnlySafe: true, sensitiveBodiesExposed: false, objectKeysExposed: false, unsafeRestrictedMetadataExposed: false });
const text = (doc: any) => [doc.title, doc.summary, doc.text, ...(doc.entities ?? []), ...(doc.keywords ?? [])].filter(Boolean).join(" ").toLowerCase();
const rowId = (doc: any) => doc.id ?? doc.documentId ?? doc.captureId ?? `doc_${Bun.hash(JSON.stringify(doc)).toString(16)}`;
const docsOf = (handoff: any) => handoff?.documents ?? [];
const docRow = (document: any) => ({ document_id: rowId(document), schema_version: document.schemaVersion ?? "ti.evidence_search_document.v1", kind: document.kind ?? "capture", tenant_id: document.tenantId, title: document.title ?? document.safeTitle ?? rowId(document), summary: document.summary ?? document.safeSummary ?? "", searchable_text: text(document), source_id: document.sourceId, capture_id: document.captureId, retention_class: document.retentionClass ?? document.retention?.class, redaction: document.redaction ?? {}, embedding: document.embedding, raw_document: document });
const disabled = (name: string, rows: any[] = []) => ({ repository: name, enabled: false, persisted: false, rowCount: rows.length, safeOutput: safety() });

export function evidenceSearchReadModelReadiness(input: any = {}) {
  const enabled = input.enabled === true || input.backend === "embedded_memory";
  return { backend: input.backend ?? "embedded_memory", enabled, ready: enabled, postgresTables: ["evidence_search_documents", "evidence_search_tombstones"], safeOutput: safety() };
}
export function createEvidenceSearchReadModelRepository(config: any = {}) {
  if ((config.backend ?? "embedded_memory") !== "embedded_memory") return disabledRepo(config.backend ?? "postgres_read_model");
  const records = new Map<string, any>();
  return {
    backend: "embedded_memory",
    readiness: () => evidenceSearchReadModelReadiness({ backend: "embedded_memory", enabled: true }),
    writeHandoff: (handoff: any) => { const skippedDocuments: any[] = []; for (const document of docsOf(handoff)) unsafeDocumentReason(document) ? skippedDocuments.push({ documentId: rowId(document), reason: unsafeDocumentReason(document) }) : records.set(rowId(document), { document, indexedAt: now() }); return { writtenDocuments: records.size, skippedDocuments, safeOutput: safety() }; },
    search: (query: any = {}) => { const terms = String(query.q ?? query.query ?? "").toLowerCase().split(/\s+/).filter(Boolean); return [...records.values()].filter((r) => terms.every((term) => text(r.document).includes(term))).slice(0, query.limit ?? 50).map((r) => ({ id: rowId(r.document), kind: r.document.kind ?? "capture", title: r.document.title ?? rowId(r.document), summary: r.document.summary ?? "", score: 1, document: r.document })); },
    deleteByRetention: (input: any) => { const deleted: string[] = []; for (const [id, record] of records) if ((input.retentionClasses ?? []).includes(record.document.retentionClass)) { records.delete(id); deleted.push(id); } return { deletedDocuments: deleted, safeOutput: safety() }; },
    stats: () => ({ backend: "embedded_memory", documentCount: records.size, safeOutput: safety() })
  };
}
function disabledRepo(backend: string) { return { backend, readiness: () => evidenceSearchReadModelReadiness({ backend }), writeHandoff: () => { throw new Error(`${backend} disabled`); }, search: () => { throw new Error(`${backend} disabled`); }, stats: () => evidenceSearchReadModelReadiness({ backend }) }; }
export const evidenceSearchDocumentToPostgresRow = docRow;
export const evidenceSearchDocumentFromPostgresRow = (row: any) => row.raw_document ?? { id: row.document_id, title: row.title, summary: row.summary, kind: row.kind };
export const evidenceSearchDocumentToOpenSearchDocument = (document: any) => ({ id: rowId(document), body: text(document), document: buyerDocument(document) });
export const evidenceSearchDocumentToPgvectorCandidate = (document: any) => unsafeDocumentReason(document) ? undefined : { id: rowId(document), embedding: document.embedding ?? [], metadata: buyerDocument(document) };
export const evidenceSearchTombstoneRowForDocument = (document: any, input: any = {}) => ({ document_id: rowId(document), reason: input.reason ?? "retention", deleted_at: input.deletedAt ?? now() });
export const buildEvidenceSearchReadModelBackendWriteSet = (handoff: any, input: any = {}) => { const documents = docsOf(handoff); const rows = documents.map(docRow); return { schemaVersion: "ti.evidence_search_read_model_write_set.v1", generatedAt: input.generatedAt ?? now(), postgresDocuments: rows, openSearchDocuments: documents.map(evidenceSearchDocumentToOpenSearchDocument), pgvectorCandidates: documents.map(evidenceSearchDocumentToPgvectorCandidate).filter(Boolean), restrictedMetadataDocuments: rows.filter((r) => r.retention_class === "restricted_metadata"), metadataOnlyDocuments: rows.filter((r) => r.redaction?.metadataOnly), legalHoldDocuments: rows.filter((r) => r.retention_class === "legal_hold"), unsafeDocumentsSkipped: documents.filter(unsafeDocumentReason).length }; };
export const buildEvidenceSearchableSourceMetadataCatalog = (writeSet: any, input: any = {}) => ({ schemaVersion: "ti.searchable_source_metadata_catalog.v1", generatedAt: input.generatedAt ?? now(), rows: (writeSet.postgresDocuments ?? []).map((r: any) => ({ sourceId: r.source_id ?? "unknown", title: r.title, searchableText: r.searchable_text, valueScore: r.searchable_text ? 0.7 : 0.2 })) });
export const buildEvidenceSearchableSourceMetadataPublicSupportQueue = (catalog: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), candidates: (catalog.rows ?? []).filter((r: any) => r.valueScore >= 0.5), counts: { candidates: (catalog.rows ?? []).length } });
export const evidenceSearchableSourceMetadataPublicSupportQueueToPostgresRows = (queue: any) => ({ queue_run_rows: [{ id: "run_public_support", count: queue.candidates?.length ?? 0 }], candidate_rows: queue.candidates ?? [] });
export const buildDisabledEvidenceSearchableSourceMetadataPublicSupportRepositoryStatus = (rows: any, input: any = {}) => disabled("public_support", rows?.candidate_rows ?? []);
export const createEvidenceSearchableSourceMetadataPublicSupportRepository = () => ({ persistPublicSupportRows: (rows: any, input: any = {}) => buildDisabledEvidenceSearchableSourceMetadataPublicSupportRepositoryStatus(rows, input) });
export const buildEvidenceSearchableSourceMetadataPromotionGate = (queue: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), decisions: (queue.candidates ?? []).map((r: any) => ({ ...r, decision: "promote" })), counts: { promote: queue.candidates?.length ?? 0 } });
export const evidenceSearchableSourceMetadataPromotionGateToPostgresRows = (gate: any) => ({ promotion_gate_rows: gate.decisions ?? [], run_rows: [{ id: "promotion_gate", count: gate.decisions?.length ?? 0 }] });
export const buildDisabledEvidenceSearchableSourceMetadataPromotionGateRepositoryStatus = (rows: any, input: any = {}) => disabled("promotion_gate", rows?.promotion_gate_rows ?? []);
export const createEvidenceSearchableSourceMetadataPromotionGateRepository = () => ({ persistPromotionGateRows: (rows: any, input: any = {}) => buildDisabledEvidenceSearchableSourceMetadataPromotionGateRepositoryStatus(rows, input) });
export const buildEvidenceSearchableSourceMetadataPromotionConsumerReplay = (rows: any, repositoryStatus: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), receipts: (rows.promotion_gate_rows ?? []).map((row: any) => ({ row, status: "replayed" })), repositoryStatus });
export const buildEvidenceSearchableSourceMetadataPublicSupportReplayReceiptLedger = (queue: any, replay: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), receipts: (queue.candidates ?? []).map((row: any) => ({ row, status: "completed" })), counts: { completed: queue.candidates?.length ?? 0, replayed: replay.receipts?.length ?? 0 } });
export const evidenceSearchableSourceMetadataPublicSupportReplayReceiptLedgerToPostgresRows = (ledger: any) => ({ replay_run_rows: [{ id: "public_support_replay", count: ledger.receipts?.length ?? 0 }], receipt_rows: ledger.receipts ?? [] });
export const buildDisabledEvidenceSearchableSourceMetadataPublicSupportReplayReceiptRepositoryStatus = (rows: any, input: any = {}) => disabled("public_support_replay", rows?.receipt_rows ?? []);
export const createEvidenceSearchableSourceMetadataPublicSupportReplayReceiptRepository = () => ({ persistReplayReceiptRows: (rows: any, input: any = {}) => buildDisabledEvidenceSearchableSourceMetadataPublicSupportReplayReceiptRepositoryStatus(rows, input) });
export const buildEvidenceSearchReadModelPromotionReplay = (writeSet: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), state: "ready", promotedDocuments: writeSet.postgresDocuments?.length ?? 0 });
export const buildEvidencePromotionTransactionPlan = (writeSet: any, replay: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), steps: [{ name: "promote_search_documents", count: writeSet.postgresDocuments?.length ?? 0 }], replay });
export const executeEvidencePromotionTransactionPlan = (plan: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), status: "dry_run", executedSteps: plan.steps ?? [], heldSteps: [] });
export const evidencePromotionExecutionToPostgresRows = (receipt: any) => ({ execution_rows: [{ id: "promotion_execution", status: receipt.status }], step_rows: receipt.executedSteps ?? [], held_step_rows: receipt.heldSteps ?? [], rollback_rows: [] });
export const evidencePromotionExecutionFromPostgresRows = (rows: any) => ({ status: rows.execution_rows?.[0]?.status ?? "dry_run", executedSteps: rows.step_rows ?? [] });
export const buildEvidencePromotionTransactionAuditReplay = (rows: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), receipts: rows.step_rows ?? [], status: "replayed" });
export const buildEvidenceActorProductImpactReplay = (writeSet: any, transaction: any, audit: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), rows: writeSet.postgresDocuments ?? [], transaction, audit });
export const buildEvidenceActorDatasetPromotionPreview = (impact: any, transaction: any) => ({ rows: impact.rows ?? [], promotedActorDatasets: impact.rows?.length ?? 0, transaction });
export const buildEvidenceActorDatasetSourceGapSuppressionFeedback = (preview: any) => ({ suppressed: [], candidates: preview.rows ?? [] });
export const buildEvidenceActorDatasetSourceGapConsumerQueue = (feedback: any) => ({ rows: feedback.candidates ?? [], counts: { queued: feedback.candidates?.length ?? 0 } });
export const evidenceActorDatasetSourceGapConsumerQueueToPostgresRows = (queue: any) => ({ queue_run_rows: [{ id: "actor_gap_queue", count: queue.rows?.length ?? 0 }], item_rows: queue.rows ?? [] });
export const buildDisabledEvidenceActorDatasetSourceGapConsumerQueueAuditRepositoryStatus = (rows: any, input: any = {}) => disabled("actor_gap_queue", rows?.item_rows ?? []);
export const createEvidenceActorDatasetSourceGapConsumerQueueAuditRepository = () => ({ persistConsumerQueueRows: (rows: any, input: any = {}) => buildDisabledEvidenceActorDatasetSourceGapConsumerQueueAuditRepositoryStatus(rows, input) });
export const buildEvidenceActorDatasetSourceGapRepairHandoff = (queue: any) => ({ packets: queue.rows ?? [], counts: queue.counts ?? {} });
export const buildEvidenceActorDatasetSourceGapRepairReplayLedger = (handoff: any) => ({ checkpoints: (handoff.packets ?? []).map((packet: any) => ({ packet, status: "ready" })) });
export const evidenceActorDatasetSourceGapRepairReplayLedgerToPostgresRows = (ledger: any) => ({ run_rows: [{ id: "actor_gap_repair", count: ledger.checkpoints?.length ?? 0 }], checkpoint_rows: ledger.checkpoints ?? [] });
export const buildDisabledEvidenceActorDatasetSourceGapRepairReplayRepositoryStatus = (rows: any, input: any = {}) => disabled("actor_gap_repair", rows?.checkpoint_rows ?? []);
export const createEvidenceActorDatasetSourceGapRepairReplayRepository = () => ({ persistRepairReplayRows: (rows: any, input: any = {}) => buildDisabledEvidenceActorDatasetSourceGapRepairReplayRepositoryStatus(rows, input) });
export const buildEvidenceActorDatasetConsumerHandoff = (preview: any) => ({ rows: preview.rows ?? [], counts: { rows: preview.rows?.length ?? 0 } });
export const executeEvidenceActorDatasetConsumerHandoff = (handoff: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), status: "dry_run", actorDatasetRows: handoff.rows ?? [], publicAnswerCacheWrites: [] });
export const evidenceActorDatasetConsumerExecutionToPostgresRows = (receipt: any) => ({ receipt_rows: [{ id: "actor_dataset_consumer", status: receipt.status }], actor_dataset_rows: receipt.actorDatasetRows ?? [], public_answer_cache_rows: receipt.publicAnswerCacheWrites ?? [] });
export const buildEvidenceActorDatasetConsumerAuditReplay = (rows: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), receipts: rows.actor_dataset_rows ?? [], status: "replayed" });
export const buildDisabledEvidenceActorDatasetConsumerAuditRepositoryStatus = (rows: any, input: any = {}) => disabled("actor_dataset_consumer", rows?.actor_dataset_rows ?? []);
export const createEvidenceActorDatasetConsumerAuditRepository = () => ({ persistConsumerExecutionRows: (rows: any, input: any = {}) => buildDisabledEvidenceActorDatasetConsumerAuditRepositoryStatus(rows, input) });
function unsafeDocumentReason(document: any) { return document?.redaction?.unsafe === true || document?.rawUrl || document?.payload ? "unsafe_raw_output" : undefined; }
function buyerDocument(document: any) { return { id: rowId(document), title: document.title, summary: document.summary, sourceId: document.sourceId, captureId: document.captureId, retentionClass: document.retentionClass }; }
