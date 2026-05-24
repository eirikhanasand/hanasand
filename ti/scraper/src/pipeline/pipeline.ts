import type { CollectedItem, ExtractedEntity, ExtractionReviewReason, IncidentCandidate, Indicator, PipelineResult, RawCapture } from "../types.ts";
import { clampScore, hashContent, normalizeWhitespace, stableId } from "../utils.ts";
import { detectLanguageHooks, EXTRACTOR_VERSION, extractEntities, extractIndicators, type ExtractionContext } from "./extractors.ts";

export function processCollectedItem(item: CollectedItem): PipelineResult {
  const capture: RawCapture = {
    id: stableId("cap", `${item.sourceId}:${item.url}:${item.contentHash}`),
    sourceId: item.sourceId,
    taskId: item.taskId,
    url: item.url,
    collectedAt: item.collectedAt,
    publishedAt: item.publishedAt,
    contentHash: item.contentHash || hashContent(item.rawText),
    normalizedTextHash: hashContent(normalizeWhitespace(item.rawText).toLowerCase()),
    mediaType: item.html ? "text/html" : "text/plain",
    storageKind: item.sensitive ? "metadata_only" : item.html ? "inline_html" : "inline_text",
    body: item.sensitive ? undefined : item.html ?? item.rawText,
    metadata: {
      ...item.metadata,
      extractorVersion: EXTRACTOR_VERSION,
      languageHooks: detectLanguageHooks(item.rawText, item.language)
    },
    sensitive: item.sensitive,
    sensitivityFlags: item.sensitive ? ["sensitive_source", "leak_metadata"] : ["public"],
    redaction: {
      applied: item.sensitive,
      policy: item.sensitive ? "metadata_only" : "none",
      reason: item.sensitive ? "Sensitive collection is stored as metadata only." : "Raw storage allowed."
    },
    provenance: {
      sourceId: item.sourceId,
      captureId: stableId("cap", `${item.sourceId}:${item.url}:${item.contentHash}`),
      url: item.url,
      collectedAt: item.collectedAt,
      contentHash: item.contentHash || hashContent(item.rawText),
      extractorVersion: EXTRACTOR_VERSION,
      taskId: item.taskId
    },
    retentionClass: item.sensitive ? "restricted_metadata" : "standard"
  };

  const extractorContext: ExtractionContext = {
    sourceId: item.sourceId,
    captureId: capture.id,
    url: item.url,
    collectedAt: item.collectedAt,
    contentHash: capture.contentHash,
    language: item.language
  };
  const indicators = extractIndicators(item.rawText, extractorContext);
  const entities = extractEntities(item.rawText, extractorContext);
  const incident = buildIncidentCandidate(item, capture.id, indicators, entities);

  return { capture, indicators, entities, incident };
}

function buildIncidentCandidate(
  item: CollectedItem,
  captureId: string,
  indicators: Indicator[],
  entities: ExtractedEntity[]
): IncidentCandidate | undefined {
  const incidentTerms = /\b(ransomware|breach|intrusion|campaign|exploit|malware|victim|leak)\b/i;
  if (!incidentTerms.test(item.rawText) && indicators.length === 0 && entities.length === 0) return undefined;

  const confidence = scoreIncidentConfidence(item.rawText, indicators, entities, item.sensitive);
  const reviewReasons = buildReviewReasons(item.rawText, confidence, indicators, entities, item.sensitive);
  const safeSummary = safeIncidentSummary(item);
  const relatedEntities = entities.filter((entity) => entity.confidence >= 0.55);
  const relatedIndicators = indicators.filter((indicator) => indicator.confidence >= 0.6);
  const title = item.title ?? inferredIncidentTitle(item.url, relatedEntities);

  return {
    id: stableId("inc", `${item.sourceId}:${item.url}:${item.contentHash}`),
    sourceId: item.sourceId,
    captureId,
    extractorVersion: EXTRACTOR_VERSION,
    title,
    summary: safeSummary,
    firstSeenAt: item.collectedAt,
    confidence,
    entities: relatedEntities,
    indicators: relatedIndicators,
    reviewReasons,
    reviewReasonDetails: reviewReasons.map((reason) => reviewReasonDetail(reason, indicators, entities))
  };
}

function safeIncidentSummary(item: CollectedItem): string {
  if (!item.sensitive) return normalizeWhitespace(item.rawText).slice(0, 500);

  const safeExcerpt = item.metadata.safeExcerpt;
  if (typeof safeExcerpt === "string" && safeExcerpt.trim()) return safeExcerpt.slice(0, 500);

  return item.title
    ? `Sensitive source metadata for ${item.title}.`
    : "Sensitive source metadata only.";
}

function scoreIncidentConfidence(text: string, indicators: Indicator[], entities: ExtractedEntity[], sensitive: boolean): number {
  const highConfidenceIndicators = indicators.filter((indicator) => indicator.confidence >= 0.75).length;
  const actorOrMalware = entities.some((entity) =>
    ["actor", "malware", "ransomware_family"].includes(entity.type) && entity.confidence >= 0.7
  );
  const victim = entities.some((entity) => entity.type === "victim" && entity.confidence >= 0.55);
  const vulnerability = indicators.some((indicator) => indicator.type === "cve") || entities.some((entity) => entity.type === "cve");
  const incidentTerm = /\b(ransomware|breach|intrusion|campaign|exploit|malware|victim|leak|compromised|targeted)\b/i.test(text);

  return clampScore(
    0.2
      + highConfidenceIndicators * 0.08
      + (actorOrMalware ? 0.22 : 0)
      + (victim ? 0.16 : 0)
      + (vulnerability ? 0.12 : 0)
      + (incidentTerm ? 0.12 : 0)
      - (sensitive ? 0.06 : 0)
  );
}

function buildReviewReasons(
  text: string,
  confidence: number,
  indicators: Indicator[],
  entities: ExtractedEntity[],
  sensitive: boolean
): string[] {
  const reasons = new Set<string>();
  if (confidence < 0.65) reasons.add("low extraction confidence");
  if (sensitive) reasons.add("sensitive source metadata only");
  if (!entities.some((entity) => entity.type === "actor" || entity.type === "ransomware_family")) {
    reasons.add("no actor or ransomware family identified");
  }
  if (!entities.some((entity) => entity.type === "victim") && /\b(victim|breach|leak|targeted|compromised)\b/i.test(text)) {
    reasons.add("incident language present but victim unresolved");
  }
  for (const indicator of indicators) for (const reason of indicator.reviewReasons ?? []) reasons.add(reason);
  for (const entity of entities) for (const reason of entity.reviewReasons ?? []) reasons.add(reason);
  return [...reasons];
}

function inferredIncidentTitle(fallbackUrl: string, entities: ExtractedEntity[]): string {
  const actor = entities.find((entity) => entity.type === "actor" || entity.type === "ransomware_family");
  const victim = entities.find((entity) => entity.type === "victim");
  const parts = [actor?.value, victim?.value].filter(Boolean);
  return parts.length ? parts.join(" / ") : fallbackUrl;
}

function reviewReasonDetail(reason: string, indicators: Indicator[], entities: ExtractedEntity[]): ExtractionReviewReason {
  return {
    reason,
    extractorVersion: EXTRACTOR_VERSION,
    provenance: [
      ...indicators.flatMap((indicator) => indicator.reviewReasons?.includes(reason) ? indicator.provenance ?? [] : []),
      ...entities.flatMap((entity) => entity.reviewReasons?.includes(reason) ? entity.provenance ?? [] : [])
    ]
  };
}
