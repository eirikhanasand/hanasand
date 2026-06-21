// @ts-nocheck
import { stableId } from "../utils.ts";
import { deltaForSnapshot, evidenceCursor, evidenceMetadata, readPromotionMetadata } from "./memoryStoreHelpers.ts";

const put = (map: Map<string, any>, item: any) => (map.set(item.id, item), item);

export function installMemoryStoreDiscoveryMethods(Store: any) {
  Store.prototype.saveDiscoveryEvidence = function (evidence: any) {
    const previous = this.discoveryEvidence.get(evidence.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(evidence)) throw new Error(`Discovery evidence is immutable: ${evidence.id}`);
    this.discoveryEvidence.set(evidence.id, evidence);
    if (!previous) this.recordDiscoveryDelta("added", evidence);
    return evidence;
  };
  Store.prototype.promoteDiscoveryEvidence = function (promotion: any) {
    const evidence = this.discoveryEvidence.get(promotion.discoveryEvidenceId);
    if (!evidence) throw new Error(`Unknown discovery evidence: ${promotion.discoveryEvidenceId}`);
    if (promotion.captureId && !this.captures.has(promotion.captureId)) throw new Error(`Unknown capture for discovery promotion: ${promotion.captureId}`);
    if (promotion.incidentId && !this.incidents.has(promotion.incidentId)) throw new Error(`Unknown incident for discovery promotion: ${promotion.incidentId}`);
    const promoted = { ...evidence, promotedToTaskId: promotion.taskId ?? evidence.promotedToTaskId, promotedToCaptureId: promotion.captureId ?? evidence.promotedToCaptureId, promotedToIncidentId: promotion.incidentId ?? evidence.promotedToIncidentId, metadata: { ...evidence.metadata, promotions: [...readPromotionMetadata(evidence.metadata), promotion] } };
    this.discoveryEvidence.set(promoted.id, promoted); this.recordDiscoveryDelta("promoted", promoted, promotion); return promoted;
  };
  Store.prototype.saveLiveSearchSnapshot = function (snapshot: any) {
    const previous = this.liveSearchSnapshots.get(snapshot.id), delta = this.saveEvidenceDelta(deltaForSnapshot(previous ? "updated" : "added", snapshot));
    return put(this.liveSearchSnapshots, { ...snapshot, deltaCursors: [...(snapshot.deltaCursors ?? []), delta.cursor] });
  };
  Store.prototype.saveEvidenceDelta = function (delta: any) { return this.storeDelta(delta, true); };
  Store.prototype.storeDelta = function (delta: any, immutable: boolean) {
    const prepared = { ...delta, cursor: delta.cursor || evidenceCursor(delta.observedAt, ++this.sequence, delta.id) }, previous = this.evidenceDeltas.get(prepared.id);
    if (immutable && previous && JSON.stringify(previous) !== JSON.stringify(prepared)) throw new Error(`Evidence delta is immutable: ${prepared.id}`);
    const owner = this.cursorOwners.get(prepared.cursor); if (owner && owner !== prepared.id) throw new Error(`Evidence delta cursor must be unique: ${prepared.cursor}`);
    this.cursorOwners.set(prepared.cursor, prepared.id); return put(this.evidenceDeltas, prepared);
  };
  Store.prototype.recordDiscoveryDelta = function (kind: any, evidence: any, promotion?: any) { this.saveEvidenceDelta({ id: stableId("delta", `${kind}:discovery:${evidence.id}:${promotion?.promotedAt ?? evidence.observedAt}`), tenantId: evidence.tenantId, query: evidence.query, normalizedQuery: evidence.normalizedQuery, cursor: "", kind, subjectType: "discovery_evidence", subjectId: evidence.id, observedAt: promotion?.promotedAt ?? evidence.observedAt, sourceId: evidence.sourceId, discoveryEvidenceIds: [evidence.id], captureIds: evidence.promotedToCaptureId ? [evidence.promotedToCaptureId] : [], incidentIds: evidence.promotedToIncidentId ? [evidence.promotedToIncidentId] : [], relationshipIds: [], policyEventIds: [], retentionClass: evidence.retentionClass, staleAt: evidence.staleAt, metadata: { resultId: evidence.resultId, provider: evidence.provider, evidenceType: evidence.evidenceType, promotion } }); };
  Store.prototype.recordCaptureDelta = function (kind: any, capture: any) { const m = evidenceMetadata(capture.metadata); this.saveEvidenceDelta({ id: stableId("delta", `${kind}:capture:${capture.id}:${capture.collectedAt}`), tenantId: capture.tenantId, query: m.query, normalizedQuery: m.normalizedQuery, runId: m.runId, cursor: "", kind: capture.redaction?.applied ? "redacted" : kind, subjectType: "capture", subjectId: capture.id, observedAt: capture.collectedAt, sourceId: capture.sourceId, discoveryEvidenceIds: m.discoveryEvidenceId ? [m.discoveryEvidenceId] : [], captureIds: [capture.id], incidentIds: [], relationshipIds: [], policyEventIds: [], retentionClass: capture.retentionClass ?? "standard", metadata: { contentHash: capture.contentHash, storageKind: capture.storageKind, sensitive: capture.sensitive, redaction: capture.redaction } }); };
  Store.prototype.recordExtractionDelta = function (kind: any, capture: any, incidentId: string) { const m = evidenceMetadata(capture.metadata); this.saveEvidenceDelta({ id: stableId("delta", `${kind}:extraction:${incidentId}:${capture.id}`), tenantId: capture.tenantId, query: m.query, normalizedQuery: m.normalizedQuery, runId: m.runId, cursor: "", kind, subjectType: "extraction", subjectId: incidentId, observedAt: capture.collectedAt, sourceId: capture.sourceId, discoveryEvidenceIds: m.discoveryEvidenceId ? [m.discoveryEvidenceId] : [], captureIds: [capture.id], incidentIds: [incidentId], relationshipIds: [], policyEventIds: [], retentionClass: capture.retentionClass ?? "standard", metadata: { extractorVersion: capture.provenance?.extractorVersion, contentHash: capture.contentHash } }); };
}
