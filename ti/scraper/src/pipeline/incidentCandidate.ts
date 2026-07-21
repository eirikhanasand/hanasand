import { createHash } from "node:crypto";
import type { CollectedItem, ExtractedEntity, IncidentCandidate, Indicator } from "../types.ts";
import { normalizeWhitespace } from "../utils.ts";
import { canonicalizeUrl } from "../storage/memoryStoreHelpers.ts";
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
  if (isCollectionFallback(item.metadata)) return undefined;
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
  const logicalIdentity = logicalIncidentIdentity(item);

  return {
    id: `inc_${logicalIdentity.keyHash.slice(0, 24)}`,
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
    reviewReasonDetails: reviewReasons.map((reason) => reviewReasonDetail(reason, indicators, entities)),
    logicalIdentity
  };
}

export function logicalIncidentIdentity(item: CollectedItem) {
  const tenant = String(item.tenantId ?? "global");
  const source = String(item.sourceId);
  const metadata = item.metadata ?? {};
  const fields = metadata.structuredFields && typeof metadata.structuredFields === "object" ? metadata.structuredFields as Record<string, unknown> : {};
  const cve = normalizeCve(fields.cveID);
  const messageId = meaningful(metadata.messageId) || typeof metadata.messageId === "number" ? String(metadata.messageId) : undefined;
  const channel = meaningful(metadata.channel) ? normalizeIdentity(metadata.channel) : undefined;
  const canonicalUrl = canonicalizeUrl(item.url);
  const sourceUrl = meaningful(metadata.sourceUrl) ? canonicalizeUrl(metadata.sourceUrl) : undefined;
  const publishedAt = normalizedTimestamp(item.publishedAt);
  const title = normalizeIdentity(item.title);
  const sharedFeedUrl = metadata.feedItem === true && (!sourceUrl || canonicalUrl === sourceUrl);
  const strategy = cve ? "cve" : messageId && channel ? "public_message" : sharedFeedUrl ? "feed_entry_fallback" : "canonical_url";
  const subject = cve ?? (messageId && channel ? `${channel}:${messageId}` : strategy === "feed_entry_fallback" ? `${canonicalUrl}:${publishedAt ?? "unknown"}:${title}` : canonicalUrl);
  const keyHash = createHash("sha256").update(`${tenant}:${source}:${strategy}:${subject}`).digest("hex");
  return { version: "incident-identity-v1", strategy, keyHash, sourceScoped: true };
}

function meaningful(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeIdentity(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeCve(value: unknown): string | undefined {
  const match = String(value ?? "").trim().toUpperCase().match(/^CVE-\d{4}-\d{4,}$/);
  return match?.[0];
}

function normalizedTimestamp(value: unknown): string | undefined {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function isCollectionFallback(metadata: Record<string, any> | undefined): boolean {
  if (metadata?.feedItem !== false || !Array.isArray(metadata.parserWarnings)) return false;
  return metadata.parserWarnings.some((warning: unknown) => typeof warning === "string" && /contained no (?:messages|rss|atom|supported records)|preview contained no messages/i.test(warning));
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
