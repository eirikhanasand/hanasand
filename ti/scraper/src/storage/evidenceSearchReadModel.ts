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
