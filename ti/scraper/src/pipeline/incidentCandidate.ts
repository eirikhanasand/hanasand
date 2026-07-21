import type { CollectedItem, ExtractedEntity, IncidentCandidate, Indicator } from "../types.ts";
import { normalizeWhitespace, stableId } from "../utils.ts";
import { buildReviewReasons, reviewReasonDetail, scoreIncidentConfidence } from "./incidentScoring.ts";

export const INCIDENT_CLASSIFIER_VERSION = "ti-incident-classifier-v3";

const EVENT_LANGUAGE = /\b(?:attack(?:ed|s|ing)?|breach(?:ed|es)?|campaign|compromis(?:e|ed|es|ing)|disrupt(?:ed|s|ion)|espionage operation|exfiltrat(?:e|ed|es|ing|ion)|exploit(?:ed|s|ing|ation)|intrusion|leak(?:ed|s|ing)?|malware operation|phishing operation|ransomware (?:attack|campaign)|shut(?:s|ting)? down|stole|stolen|target(?:ed|s|ing)|watering hole)\b|\b(?:used|uses|deployed|delivered)\s+(?:(?:credential\s+)?phishing|.{0,80}\b(?:malware|command(?:\s+and\s+control)? infrastructure))\b/i;
const PROFILE_TITLE = /^\s*(?:what|who)\s+is\b|\bmitre\s+att&?ck\b|\b(?:actor|group|threat)\s+(?:profile|overview|reference)\b|\bthreat\s+profile\b|\b(?:reference|explainer|guide)\b/i;

export function hasIncidentEvidence(input: {
  title?: unknown;
  text?: unknown;
  actorNames?: unknown[];
  victimNames?: unknown[];
  extractionProfile?: unknown;
}): boolean {
  if (input.extractionProfile === "ransomware_group_metadata") return false;

  const title = normalizeWhitespace(String(input.title ?? ""));
  const normalizedTitle = normalizeIdentity(title);
  if (input.extractionProfile === "ransomware_victim_blog" && (input.victimNames ?? []).some(meaningful)) return true;
  if ((input.actorNames ?? []).some((actor) => normalizeIdentity(actor) === normalizedTitle)) return false;
  if (PROFILE_TITLE.test(title)) return false;
  if ((input.victimNames ?? []).some(meaningful)) return true;

  return EVENT_LANGUAGE.test(`${title} ${normalizeWhitespace(String(input.text ?? ""))}`);
}

export function buildIncidentCandidate(
  item: CollectedItem,
  captureId: string,
  indicators: Indicator[],
  entities: ExtractedEntity[]
): IncidentCandidate | undefined {
  if (!hasIncidentEvidence({
    title: item.title,
    text: item.rawText,
    actorNames: entities.filter((entity) => entity.type === "actor" || entity.type === "ransomware_family").map((entity) => entity.value),
    victimNames: entities.filter((entity) => entity.type === "victim").map((entity) => entity.value),
    extractionProfile: item.metadata?.extractionProfile,
  })) return undefined;

  const confidence = scoreIncidentConfidence(item.rawText, indicators, entities, item.sensitive);
  const reviewReasons = buildReviewReasons(item.rawText, confidence, indicators, entities, item.sensitive);
  const relatedEntities = entities.filter((entity) => entity.confidence >= 0.55);
  const relatedIndicators = indicators.filter((indicator) => indicator.confidence >= 0.6);

  return {
    id: stableId("inc", `${item.sourceId}:${item.url}:${item.contentHash}`),
    sourceId: item.sourceId,
    captureId,
    extractorVersion: INCIDENT_CLASSIFIER_VERSION,
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

function meaningful(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeIdentity(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
