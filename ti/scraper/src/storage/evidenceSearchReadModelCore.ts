// @ts-nocheck
export const now = () => new Date().toISOString();
export const safety = () => ({ metadataOnlySafe: true, sensitiveBodiesExposed: false, objectKeysExposed: false, unsafeRestrictedMetadataExposed: false });
export const text = (doc: any) => [doc.title, doc.summary, doc.text, ...(doc.entities ?? []), ...(doc.keywords ?? [])].filter(Boolean).join(" ").toLowerCase();
export const rowId = (doc: any) => doc.id ?? doc.documentId ?? doc.captureId ?? `doc_${Bun.hash(JSON.stringify(doc)).toString(16)}`;
export const docsOf = (handoff: any) => handoff?.documents ?? [];
export const disabled = (name: string, rows: any[] = []) => ({ repository: name, enabled: false, persisted: false, rowCount: rows.length, safeOutput: safety() });
export const docRow = (document: any) => ({ document_id: rowId(document), schema_version: document.schemaVersion ?? "ti.evidence_search_document.v1", kind: document.kind ?? "capture", tenant_id: document.tenantId, title: document.title ?? document.safeTitle ?? rowId(document), summary: document.summary ?? document.safeSummary ?? "", searchable_text: text(document), source_id: document.sourceId, capture_id: document.captureId, retention_class: document.retentionClass ?? document.retention?.class, redaction: document.redaction ?? {}, embedding: document.embedding, raw_document: document });

export function unsafeDocumentReason(document: any) {
  return document?.redaction?.unsafe === true || document?.rawUrl || document?.payload ? "unsafe_raw_output" : undefined;
}

export function buyerDocument(document: any) {
  return { id: rowId(document), title: document.title, summary: document.summary, sourceId: document.sourceId, captureId: document.captureId, retentionClass: document.retentionClass };
}
