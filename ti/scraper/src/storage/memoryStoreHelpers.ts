// @ts-nocheck
import type { CaptureDedupeKey, CaptureReplayJob, DiscoveryPromotion, EvidenceDelta, EvidenceDeltaKind, LiveSearchSnapshot, PipelineResult, RawCapture } from "../types.ts";
import { hashContent, normalizeWhitespace, stableId } from "../utils.ts";

export function captureDedupeKey(capture: RawCapture): CaptureDedupeKey {
  const p = prepareCapture(capture);
  return { sourceId: p.sourceId, canonicalUrl: p.canonicalUrl ?? canonicalizeUrl(p.url), normalizedTextHash: p.normalizedTextHash, publishedAt: p.publishedAt };
}

export function canonicalizeUrl(value: string): string {
  try { const url = new URL(value); url.hash = ""; url.hostname = url.hostname.toLowerCase(); url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/"; url.search = sortedSearch(url.searchParams); return url.toString(); } catch { return value.trim(); }
}

export function prepareCapture(capture: RawCapture): RawCapture {
  const sensitivityFlags = capture.sensitivityFlags ?? (capture.sensitive ? ["sensitive_source"] : ["public"]);
  const metadataOnly = capture.sensitive || sensitivityFlags.some(isMetadataOnlyFlag);
  return { ...capture, canonicalUrl: capture.canonicalUrl ?? canonicalizeUrl(capture.url), publishedAt: normalizeTimestamp(capture.publishedAt), normalizedTextHash: capture.normalizedTextHash ?? normalizedBodyHash(capture.body), storageKind: metadataOnly ? "metadata_only" : capture.storageKind, body: metadataOnly ? undefined : capture.body, metadata: metadataOnly ? { ...capture.metadata, safeEntityHints: capture.metadata.safeEntityHints ?? safeEntityHintsFromBody(capture.body) } : capture.metadata, sensitivityFlags, redaction: capture.redaction ?? { applied: metadataOnly, policy: metadataOnly ? "metadata_only" : "none", reason: metadataOnly ? "Sensitive evidence is persisted as metadata only." : "Raw storage allowed by source policy." }, retentionClass: capture.retentionClass ?? (metadataOnly ? "restricted_metadata" : "standard"), provenance: capture.provenance ?? { sourceId: capture.sourceId, captureId: capture.id, url: capture.url, collectedAt: capture.collectedAt, contentHash: capture.contentHash, extractorVersion: "capture-store:v1", taskId: capture.taskId, tenantId: capture.tenantId } };
}

export function enforceSensitiveMetadataOnly(capture: RawCapture) {
  if (!capture.sensitive && !capture.sensitivityFlags?.some(isMetadataOnlyFlag)) return;
  if (capture.storageKind !== "metadata_only") throw new Error(`Sensitive capture must be metadata-only: ${capture.id}`);
  if (capture.body) throw new Error(`Sensitive capture cannot persist raw body: ${capture.id}`);
}

export function dedupeIndexKeys(capture: RawCapture) {
  const key = captureDedupeKey(capture), published = key.publishedAt ?? "", normalized = key.normalizedTextHash ?? "";
  return [`source-url-published:${key.sourceId}:${key.canonicalUrl}:${published}`, `source-text-published:${key.sourceId}:${normalized}:${published}`, `source-content-published:${capture.sourceId}:${capture.contentHash}:${published}`].filter((v) => !v.includes("::"));
}

export function deltaForSnapshot(kind: EvidenceDeltaKind, s: LiveSearchSnapshot): EvidenceDelta {
  return { id: stableId("delta", `${kind}:snapshot:${s.id}:${s.capturedAt}`), tenantId: s.tenantId, query: s.query, normalizedQuery: s.normalizedQuery, runId: s.runId, cursor: "", kind: s.status === "blocked" || s.status === "disabled" ? "blocked" : kind, subjectType: "live_snapshot", subjectId: s.id, observedAt: s.capturedAt, discoveryEvidenceIds: s.discoveryEvidenceIds, captureIds: s.captureIds, incidentIds: s.incidentIds, relationshipIds: stringArray(s.metadata.relationshipIds), policyEventIds: stringArray(s.metadata.policyEventIds), retentionClass: s.retentionClass, staleAt: s.staleAt, metadata: { status: s.status, newEvidenceIds: s.newEvidenceIds } };
}

export const evidenceCursor = (observedAt: string, sequence: number, id: string) => `${observedAt}#${String(sequence).padStart(12, "0")}#${id}`;
export function evidenceMetadata(metadata: Record<string, unknown>) { const query = typeof metadata.query === "string" ? metadata.query : undefined; return { query, normalizedQuery: typeof metadata.normalizedQuery === "string" ? metadata.normalizedQuery : query?.trim().toLowerCase().replace(/\s+/g, " "), runId: typeof metadata.runId === "string" ? metadata.runId : undefined, discoveryEvidenceId: typeof metadata.promotedFromDiscoveryId === "string" ? metadata.promotedFromDiscoveryId : typeof metadata.discoveryEvidenceId === "string" ? metadata.discoveryEvidenceId : undefined }; }
export function replayDiff(job: CaptureReplayJob, result: PipelineResult) { return { incidentChanged: Boolean(typeof job.metadata.previousIncidentId === "string" && job.metadata.previousIncidentId !== result.incident?.id), indicatorDelta: result.indicators.length - (typeof job.metadata.previousIndicatorCount === "number" ? job.metadata.previousIndicatorCount : 0), entityDelta: result.entities.length - (typeof job.metadata.previousEntityCount === "number" ? job.metadata.previousEntityCount : 0), newReviewReasons: result.incident?.reviewReasons ?? [] }; }
export function readPromotionMetadata(metadata: Record<string, unknown>): DiscoveryPromotion[] { return Array.isArray(metadata.promotions) ? metadata.promotions.filter((x): x is DiscoveryPromotion => Boolean(x && typeof x === "object" && "discoveryEvidenceId" in x)) : []; }

const stringArray = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const normalizedBodyHash = (body?: string) => body ? hashContent(normalizeWhitespace(body).toLowerCase()) : undefined;
const normalizeTimestamp = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : value;
const isMetadataOnlyFlag = (flag: string) => ["sensitive_source", "leak_metadata", "credential_material", "restricted_protocol"].includes(flag);
function sortedSearch(params: URLSearchParams) { const sorted = new URLSearchParams(); for (const [k, v] of [...params.entries()].sort(([a], [b]) => a.localeCompare(b))) sorted.append(k, v); const text = sorted.toString(); return text ? `?${text}` : ""; }
function safeEntityHintsFromBody(body?: string) { if (!body) return undefined; const victims = new Set([...body.matchAll(/\bvictim\s*:?\s+([A-Z][A-Za-z0-9&., -]{2,80})/g)].map((m) => m[1]?.replace(/\s+\b(?:on|in|using|with|after|from)\b.*$/i, "").trim()).filter(Boolean)); const sectors = new Set(["healthcare", "telecommunications", "energy", "government", "finance", "education", "manufacturing"].filter((s) => new RegExp(`\\b${s}\\b`, "i").test(body))); return victims.size || sectors.size ? { victims: [...victims], sectors: [...sectors] } : undefined; }
