// @ts-nocheck
import { buyerDocument, docRow, docsOf, now, unsafeDocumentReason } from "./evidenceSearchReadModelCore.ts";

export const evidenceSearchDocumentToPostgresRow = docRow;
export const evidenceSearchDocumentFromPostgresRow = (row: any) => row.raw_document ?? { id: row.document_id, title: row.title, summary: row.summary, kind: row.kind };
export const evidenceSearchDocumentToOpenSearchDocument = (document: any) => ({ id: document.id ?? document.captureId, body: [document.title, document.summary, document.text].filter(Boolean).join(" ").toLowerCase(), document: buyerDocument(document) });
export const evidenceSearchDocumentToPgvectorCandidate = (document: any) => unsafeDocumentReason(document) ? undefined : { id: document.id ?? document.captureId, embedding: document.embedding ?? [], metadata: buyerDocument(document) };
export const evidenceSearchTombstoneRowForDocument = (document: any, input: any = {}) => ({ document_id: document.id ?? document.captureId, reason: input.reason ?? "retention", deleted_at: input.deletedAt ?? now() });

export const buildEvidenceSearchReadModelBackendWriteSet = (handoff: any, input: any = {}) => {
  const documents = docsOf(handoff), rows = documents.map(docRow);
  return { schemaVersion: "ti.evidence_search_read_model_write_set.v1", generatedAt: input.generatedAt ?? now(), postgresDocuments: rows, openSearchDocuments: documents.map(evidenceSearchDocumentToOpenSearchDocument), pgvectorCandidates: documents.map(evidenceSearchDocumentToPgvectorCandidate).filter(Boolean), restrictedMetadataDocuments: rows.filter((r) => r.retention_class === "restricted_metadata"), metadataOnlyDocuments: rows.filter((r) => r.redaction?.metadataOnly), legalHoldDocuments: rows.filter((r) => r.retention_class === "legal_hold"), unsafeDocumentsSkipped: documents.filter(unsafeDocumentReason).length };
};

export const buildEvidenceSearchableSourceMetadataCatalog = (writeSet: any, input: any = {}) => ({ schemaVersion: "ti.searchable_source_metadata_catalog.v1", generatedAt: input.generatedAt ?? now(), rows: (writeSet.postgresDocuments ?? []).map((r: any) => ({ sourceId: r.source_id ?? "unknown", title: r.title, searchableText: r.searchable_text, valueScore: r.searchable_text ? 0.7 : 0.2 })) });
export const buildEvidenceSearchableSourceMetadataPublicSupportQueue = (catalog: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), candidates: (catalog.rows ?? []).filter((r: any) => r.valueScore >= 0.5), counts: { candidates: (catalog.rows ?? []).length } });
export const evidenceSearchableSourceMetadataPublicSupportQueueToPostgresRows = (queue: any) => ({ queue_run_rows: [{ id: "run_public_support", count: queue.candidates?.length ?? 0 }], candidate_rows: queue.candidates ?? [] });
export const buildEvidenceSearchableSourceMetadataPromotionGate = (queue: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), decisions: (queue.candidates ?? []).map((r: any) => ({ ...r, decision: "promote" })), counts: { promote: queue.candidates?.length ?? 0 } });
export const evidenceSearchableSourceMetadataPromotionGateToPostgresRows = (gate: any) => ({ promotion_gate_rows: gate.decisions ?? [], run_rows: [{ id: "promotion_gate", count: gate.decisions?.length ?? 0 }] });
export const buildEvidenceSearchableSourceMetadataPromotionConsumerReplay = (rows: any, repositoryStatus: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), receipts: (rows.promotion_gate_rows ?? []).map((row: any) => ({ row, status: "replayed" })), repositoryStatus });
export const buildEvidenceSearchableSourceMetadataPublicSupportReplayReceiptLedger = (queue: any, replay: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), receipts: (queue.candidates ?? []).map((row: any) => ({ row, status: "completed" })), counts: { completed: queue.candidates?.length ?? 0, replayed: replay.receipts?.length ?? 0 } });
export const evidenceSearchableSourceMetadataPublicSupportReplayReceiptLedgerToPostgresRows = (ledger: any) => ({ replay_run_rows: [{ id: "public_support_replay", count: ledger.receipts?.length ?? 0 }], receipt_rows: ledger.receipts ?? [] });
