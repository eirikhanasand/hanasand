import type { CollectedItem } from "../types.ts";
import { hashContent, uniqueStrings } from "../utils.ts";
import { productionEvidenceReplayRef } from "./productionAdapterRuntime.ts";
import { forbiddenFields } from "./liveCaptureConstants.ts";
import { classifyLiveCaptureFailure } from "./liveCaptureFailure.ts";
import { freshnessState } from "./liveCaptureFreshness.ts";
import type { LiveCaptureAdapterKind, LiveCaptureFailureClass, LiveCaptureRuntimeCaptureInput, LiveCaptureRuntimeRowDto, LiveCaptureStatus } from "./liveCaptureTypes.ts";
import { claimIds, confidence, mimeAllowlistFor, num, sourceFamily, str, strings, versionFor } from "./liveCaptureUtils.ts";

export const liveCaptureDedupeKey = (adapter: LiveCaptureAdapterKind, canonicalUrlHash?: string, contentHash?: string, publishedAt?: string) => `live_capture:${adapter}:${canonicalUrlHash ?? "no_url"}:${contentHash ?? "no_hash"}:${publishedAt ?? "no_published_at"}`;

export function buildLiveCaptureRuntimeRow(input: LiveCaptureRuntimeCaptureInput, generatedAt: string, seen = new Set<string>()): LiveCaptureRuntimeRowDto {
  const item = input.result.items[0], meta = input.result.metadata ?? {}, itemMeta = item?.metadata ?? {};
  const failure = classifyLiveCaptureFailure(input, item, generatedAt), urlHash = str(itemMeta.canonicalUrlHash) || (item?.url ? `urlhash:${hashContent(item.url).slice(0, 16)}` : undefined);
  const dedupeKey = item ? liveCaptureDedupeKey(input.adapter, urlHash, item.contentHash, item.publishedAt) : undefined, duplicate = Boolean(dedupeKey && seen.has(dedupeKey));
  if (dedupeKey) seen.add(dedupeKey);
  const freshness = freshnessState(item, input.freshnessTargetSeconds, generatedAt), status = duplicate ? "duplicate" : failure !== "none" ? (failure === "stale_source" ? "stale" : "failed") : item ? "captured" : "empty";
  const parserConfidence = num(itemMeta.parserConfidence) ?? num(itemMeta.provenance, "confidence") ?? confidence(input.adapter, item);
  const extractionWarnings = uniqueStrings([...input.result.warnings, ...strings(itemMeta.extractionWarnings), ...strings(itemMeta.parserWarnings), ...(failure === "stale_source" ? ["stale_source_window"] : []), ...(duplicate ? ["duplicate_content"] : [])]);
  const replayId = item && urlHash && item.contentHash ? productionEvidenceReplayRef({ sourceId: input.source.id, canonicalUrlHash: urlHash, contentHash: item.contentHash, fetchedAt: item.collectedAt }) : undefined;
  return { schemaVersion: "ti.live_capture_runtime_row.v1", sourceId: input.source.id, adapter: input.adapter, status, failureClass: duplicate ? "duplicate_content" : failure, canonicalUrlHash: urlHash, contentHash: item?.contentHash, dedupeKey, replayId, publishedAt: item?.publishedAt, collectedAt: item?.collectedAt ?? generatedAt, parserConfidence, extractionWarnings, freshness, runtimeCaps: { timeoutMs: input.timeoutMs ?? 15_000, maxBytes: input.maxBytes ?? input.task?.maxBytes ?? 2_000_000, mimeAllowlist: input.mimeAllowlist ?? mimeAllowlistFor(input.adapter), contentType: input.contentType ?? str(meta.contentType) ?? str(itemMeta.contentType), contentBytes: num(meta.contentBytes) ?? num(itemMeta.contentBytes), redirectCount: input.redirectCount ?? strings(itemMeta.redirectChain).length }, observability: { httpStatus: num(meta.responseStatus) ?? num(itemMeta.responseStatus), retryAfterSeconds: num(meta.retryAfterSeconds), robotsLegalNotesPresent: Boolean(input.source.legalNotes.trim()), malformedFeed: failure === "malformed_feed", unsupportedMime: failure === "unsupported_mime", excessiveRedirects: failure === "excessive_redirects", unsafeUrlSuppressed: failure === "unsafe_url", duplicateContent: duplicate, staleSourceWindow: freshness.state === "stale" }, agent06Handoff: handoff(input, item, urlHash, replayId, parserConfidence, extractionWarnings), agent01SourcePack: sourcePack(input, status, parserConfidence), agent02Scheduler: schedulerHint(input, status, failure, freshness.state) };
}

function handoff(input: LiveCaptureRuntimeCaptureInput, item: CollectedItem | undefined, urlHash: string | undefined, replayId: string | undefined, parserConfidence: number, extractionWarnings: string[]) {
  const captureId = `capture_${hashContent(`${input.source.id}:${urlHash ?? "none"}:${item?.contentHash ?? "none"}`).slice(0, 16)}`;
  return { schemaVersion: "ti.live_capture_evidence_handoff.v1", sourceId: input.source.id, taskId: input.task?.id ?? item?.taskId, replayId, rawCaptureDescriptor: { captureId, storageKind: item ? "public_raw" : "metadata_only", canonicalUrlHash: urlHash, contentHash: item?.contentHash, contentBytes: new TextEncoder().encode(item?.rawText ?? "").byteLength, retentionClass: input.adapter === "report_index" ? "public_report" : "public_raw" }, textProjectionDescriptor: { projectionId: `text_projection_${hashContent(`${captureId}:${item?.contentHash ?? "none"}`).slice(0, 16)}`, textHash: item?.rawText ? `texthash:${hashContent(item.rawText).slice(0, 16)}` : undefined, language: item?.language ?? input.source.language, parserConfidence, extractionWarnings }, sourceMetadata: { sourceType: input.source.type, sourceTrust: input.source.trustScore, legalNotesPresent: Boolean(input.source.legalNotes.trim()), connectorFamily: str(item?.metadata.connectorFamily) || str(input.source.metadata?.sourceFamily) }, extractionVersion: versionFor(input.adapter), claimCandidateIds: claimIds(input.source.id, item), forbiddenFields: forbiddenFields() };
}

function sourcePack(input: LiveCaptureRuntimeCaptureInput, status: LiveCaptureStatus, parserConfidence: number) {
  const legal = Boolean(input.source.legalNotes.trim()), parserSupport = status === "failed" ? "blocked" : parserConfidence >= 0.65 ? "ready" : "needs_repair";
  return { sourceFamily: sourceFamily(input), activationReadiness: !legal || parserSupport === "blocked" ? "hold" : parserSupport === "needs_repair" || status === "stale" ? "watch" : "ready", parserSupport, legalNotesPresent: legal };
}

function schedulerHint(input: LiveCaptureRuntimeCaptureInput, status: LiveCaptureStatus, failure: LiveCaptureFailureClass, fresh: string) {
  if (failure === "rate_limited") return { cadenceHint: "retry_after", budgetClass: "normal", reason: "source rate limited; honor retry-after/backoff before next capture" };
  if (failure === "robots_or_legal_hold" || failure === "unsafe_url") return { cadenceHint: "pause", budgetClass: "low", reason: "source has policy/legal or unsafe URL hold" };
  if (status === "duplicate") return { cadenceHint: "decrease", budgetClass: "low", reason: "duplicate content observed; reduce cadence until novelty improves" };
  return { cadenceHint: fresh === "stale" ? "increase" : "normal", budgetClass: input.queryClass === "cve_advisory" ? "high" : "normal", reason: fresh === "stale" ? "source stale for target freshness window" : "capture runtime healthy" };
}
