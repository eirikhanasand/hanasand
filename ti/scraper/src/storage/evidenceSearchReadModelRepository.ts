// @ts-nocheck
import { disabled, docsOf, now, rowId, safety, text, unsafeDocumentReason } from "./evidenceSearchReadModelCore.ts";

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
    writeHandoff: (handoff: any) => writeHandoff(records, handoff),
    search: (query: any = {}) => search(records, query),
    deleteByRetention: (input: any) => deleteByRetention(records, input),
    stats: () => ({ backend: "embedded_memory", documentCount: records.size, safeOutput: safety() })
  };
}

function writeHandoff(records: Map<string, any>, handoff: any) {
  const skippedDocuments: any[] = [];
  for (const document of docsOf(handoff)) {
    const reason = unsafeDocumentReason(document);
    reason ? skippedDocuments.push({ documentId: rowId(document), reason }) : records.set(rowId(document), { document, indexedAt: now() });
  }
  return { writtenDocuments: records.size, skippedDocuments, safeOutput: safety() };
}

function search(records: Map<string, any>, query: any = {}) {
  const terms = String(query.q ?? query.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return [...records.values()].filter((r) => terms.every((term) => text(r.document).includes(term))).slice(0, query.limit ?? 50).map((r) => ({ id: rowId(r.document), kind: r.document.kind ?? "capture", title: r.document.title ?? rowId(r.document), summary: r.document.summary ?? "", score: 1, document: r.document }));
}

function deleteByRetention(records: Map<string, any>, input: any) {
  const deleted: string[] = [];
  for (const [id, record] of records) if ((input.retentionClasses ?? []).includes(record.document.retentionClass)) { records.delete(id); deleted.push(id); }
  return { deletedDocuments: deleted, safeOutput: safety() };
}

function disabledRepo(backend: string) {
  return { backend, readiness: () => evidenceSearchReadModelReadiness({ backend }), writeHandoff: () => { throw new Error(`${backend} disabled`); }, search: () => { throw new Error(`${backend} disabled`); }, stats: () => evidenceSearchReadModelReadiness({ backend }) };
}

export const buildDisabledEvidenceSearchableSourceMetadataPublicSupportRepositoryStatus = (rows: any, input: any = {}) => disabled("public_support", rows?.candidate_rows ?? []);
export const createEvidenceSearchableSourceMetadataPublicSupportRepository = () => ({ persistPublicSupportRows: (rows: any, input: any = {}) => buildDisabledEvidenceSearchableSourceMetadataPublicSupportRepositoryStatus(rows, input) });
export const buildDisabledEvidenceSearchableSourceMetadataPromotionGateRepositoryStatus = (rows: any, input: any = {}) => disabled("promotion_gate", rows?.promotion_gate_rows ?? []);
export const createEvidenceSearchableSourceMetadataPromotionGateRepository = () => ({ persistPromotionGateRows: (rows: any, input: any = {}) => buildDisabledEvidenceSearchableSourceMetadataPromotionGateRepositoryStatus(rows, input) });
export const buildDisabledEvidenceSearchableSourceMetadataPublicSupportReplayReceiptRepositoryStatus = (rows: any, input: any = {}) => disabled("public_support_replay", rows?.receipt_rows ?? []);
export const createEvidenceSearchableSourceMetadataPublicSupportReplayReceiptRepository = () => ({ persistReplayReceiptRows: (rows: any, input: any = {}) => buildDisabledEvidenceSearchableSourceMetadataPublicSupportReplayReceiptRepositoryStatus(rows, input) });
