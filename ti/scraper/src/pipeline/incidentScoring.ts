import type { ExtractedEntity, ExtractionReviewReason, Indicator } from "../types.ts";
import { clampScore } from "../utils.ts";
import { EXTRACTOR_VERSION } from "./extractors.ts";

export function scoreIncidentConfidence(
  text: string,
  indicators: Indicator[],
  entities: ExtractedEntity[],
  sensitive: boolean
): number {
  const highConfidenceIndicators = indicators.filter((indicator) => indicator.confidence >= 0.75).length;
  const actorOrMalware = entities.some((entity) =>
    ["actor", "malware", "ransomware_family"].includes(entity.type) && entity.confidence >= 0.7
  );
  const victim = entities.some((entity) => entity.type === "victim" && entity.confidence >= 0.55);
  const vulnerability = indicators.some((indicator) => indicator.type === "cve") ||
    entities.some((entity) => entity.type === "cve");
  const incidentTerm = /\b(ransomware|breach|intrusion|campaign|exploit|malware|victim|leak|compromised|targeted)\b/i.test(text);

  return clampScore(0.2 + highConfidenceIndicators * 0.08 + (actorOrMalware ? 0.22 : 0) +
    (victim ? 0.16 : 0) + (vulnerability ? 0.12 : 0) + (incidentTerm ? 0.12 : 0) -
    (sensitive ? 0.06 : 0));
}

export function buildReviewReasons(
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

export function reviewReasonDetail(
  reason: string,
  indicators: Indicator[],
  entities: ExtractedEntity[]
): ExtractionReviewReason {
  return {
    reason,
    extractorVersion: EXTRACTOR_VERSION,
    provenance: [
      ...indicators.flatMap((indicator) => indicator.reviewReasons?.includes(reason) ? indicator.provenance ?? [] : []),
      ...entities.flatMap((entity) => entity.reviewReasons?.includes(reason) ? entity.provenance ?? [] : [])
    ]
  };
}
