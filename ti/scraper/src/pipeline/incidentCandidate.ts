import type { CollectedItem, ExtractedEntity, IncidentCandidate, Indicator } from "../types.ts";
import { normalizeWhitespace, stableId } from "../utils.ts";
import { EXTRACTOR_VERSION } from "./extractors.ts";
import { buildReviewReasons, reviewReasonDetail, scoreIncidentConfidence } from "./incidentScoring.ts";

export function buildIncidentCandidate(
  item: CollectedItem,
  captureId: string,
  indicators: Indicator[],
  entities: ExtractedEntity[]
): IncidentCandidate | undefined {
  const incidentTerms = /\b(ransomware|breach|intrusion|campaign|exploit|malware|victim|leak)\b/i;
  if (!incidentTerms.test(item.rawText) && indicators.length === 0 && entities.length === 0) return undefined;

  const confidence = scoreIncidentConfidence(item.rawText, indicators, entities, item.sensitive);
  const reviewReasons = buildReviewReasons(item.rawText, confidence, indicators, entities, item.sensitive);
  const relatedEntities = entities.filter((entity) => entity.confidence >= 0.55);
  const relatedIndicators = indicators.filter((indicator) => indicator.confidence >= 0.6);

  return {
    id: stableId("inc", `${item.sourceId}:${item.url}:${item.contentHash}`),
    sourceId: item.sourceId,
    captureId,
    extractorVersion: EXTRACTOR_VERSION,
    title: item.title ?? inferredIncidentTitle(item.url, relatedEntities),
    summary: safeIncidentSummary(item),
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
  return item.title ? `Sensitive source metadata for ${item.title}.` : "Sensitive source metadata only.";
}

function inferredIncidentTitle(fallbackUrl: string, entities: ExtractedEntity[]): string {
  const actor = entities.find((entity) => entity.type === "actor" || entity.type === "ransomware_family");
  const victim = entities.find((entity) => entity.type === "victim");
  const parts = [actor?.value, victim?.value].filter(Boolean);
  return parts.length ? parts.join(" / ") : fallbackUrl;
}
