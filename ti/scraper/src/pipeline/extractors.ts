import type { ExtractedEntity, ExtractionProvenance, Indicator } from "../types.ts";
import { normalizeWhitespace } from "../utils.ts";
import { ACTOR_ALIAS_RECORDS } from "./actorAliases.ts";

export const EXTRACTOR_VERSION = "ti-basic-extractor-v1";

export interface ExtractionContext {
  sourceId: string;
  captureId: string;
  url: string;
  collectedAt: string;
  contentHash: string;
  language?: string;
}

const CVE_RE = /\bCVE-\d{4}-\d{4,7}\b/gi;
const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const IPV6_RE = /\b(?:[a-f0-9]{1,4}:){2,7}[a-f0-9]{1,4}\b/gi;
const SHA256_RE = /\b[a-f0-9]{64}\b/gi;
const SHA1_RE = /\b[a-f0-9]{40}\b/gi;
const MD5_RE = /\b[a-f0-9]{32}\b/gi;
const URL_RE = /\b(?:https?|hxxps?):\/\/[^\s<>"')]+/gi;
const DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\[?\.\]?)+(?:com|net|org|io|ru|cn|ir|biz|info|co|uk|de|fr|no|onion)\b/gi;

const MALWARE_HINTS = ["emotet", "trickbot", "cobalt strike", "qakbot", "plugx", "sliver", "carbanak", "mimikatz", "icedid", "rclone", "anydesk", "snake", "powgoop", "wellmess"];
const TECHNIQUE_HINTS = ["phishing", "credential dumping", "lateral movement", "command and control", "exfiltration", "persistence", "spearphishing", "data exfiltration", "sms phishing", "living off the land", "exploit", "intrusion"];
const SECTOR_HINTS = ["healthcare", "government", "energy", "finance", "financial services", "telecommunications", "education", "manufacturing", "retail"];
const COUNTRY_HINTS = ["united states", "norway", "ukraine", "russia", "china", "germany", "france", "united kingdom", "japan", "south korea"];
const GENERIC_VICTIM_WORDS = new Set([
  "actor",
  "analysts",
  "campaign",
  "company",
  "customer",
  "customers",
  "data",
  "government",
  "healthcare",
  "malware",
  "organization",
  "organizations",
  "ransomware",
  "report",
  "researchers",
  "target",
  "targets",
  "telecom",
  "victim",
  "victims"
]);

export function extractIndicators(text: string, context: ExtractionContext): Indicator[] {
  const indicators: Indicator[] = [];
  addMatches(indicators, "cve", text, CVE_RE, context, 0.9);
  addMatches(indicators, "ipv4", text, IPV4_RE, context, 0.75);
  addMatches(indicators, "ipv6", text, IPV6_RE, context, 0.65);
  addMatches(indicators, "sha256", text, SHA256_RE, context, 0.95);
  addMatches(indicators, "sha1", text, SHA1_RE, context, 0.85);
  addMatches(indicators, "md5", text, MD5_RE, context, 0.8);
  addMatches(indicators, "url", text, URL_RE, context, 0.75);
  addMatches(indicators, "domain", text, DOMAIN_RE, context, 0.6);
  return dedupeIndicators(indicators);
}

export function extractEntities(text: string, context: ExtractionContext): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const lower = text.toLowerCase();

  for (const record of ACTOR_ALIAS_RECORDS) {
    for (const alias of record.aliases) {
      const index = lower.indexOf(alias);
      if (index >= 0) {
        const rawValue = text.slice(index, index + alias.length);
        entities.push({
          ...entity("actor", record.canonical, rawValue, context, index, index + alias.length, record.confidence),
          aliases: record.aliases
        });
        break;
      }
    }
  }

  for (const malware of MALWARE_HINTS) {
    const index = lower.indexOf(malware);
    if (index >= 0) {
      entities.push(entity("malware", malware, text.slice(index, index + malware.length), context, index, index + malware.length, 0.72));
    }
  }

  addEntityMatches(entities, "victim", text, /\b(?:victim|customer|target(?:ed)?|against|compromised)\s*:\s*([A-Z][A-Za-z0-9&.,' -]{2,80})/g, context, 0.68);
  addEntityMatches(entities, "victim", text, /\bagainst\s+([A-Z][A-Za-z0-9&.,' -]{2,80})\s+(?:in|using|after|with)\b/g, context, 0.58);
  addEntityMatches(entities, "victim", text, /\bagainst\s+([A-Z][A-Za-z0-9&.,' -]{2,80})(?:[.,;]|$)/g, context, 0.56);
  addEntityMatches(entities, "sector", text, /\bsector\s*:\s*([A-Za-z][A-Za-z -]{2,60})/gi, context, 0.58);
  addEntityMatches(entities, "country", text, /\bcountry\s*:\s*([A-Za-z][A-Za-z -]{1,60})/gi, context, 0.58);
  addEntityMatches(entities, "cve", text, CVE_RE, context, 0.9);

  for (const sector of SECTOR_HINTS) {
    const index = lower.indexOf(sector);
    if (index >= 0) {
      entities.push(entity("sector", sector, text.slice(index, index + sector.length), context, index, index + sector.length, 0.54));
    }
  }

  for (const country of COUNTRY_HINTS) {
    const index = lower.indexOf(country);
    if (index >= 0) {
      entities.push(entity("country", titleCase(country), text.slice(index, index + country.length), context, index, index + country.length, 0.54));
    }
  }

  for (const technique of TECHNIQUE_HINTS) {
    const index = lower.indexOf(technique);
    if (index >= 0) {
      entities.push(entity("ttp", technique, text.slice(index, index + technique.length), context, index, index + technique.length, 0.72));
    }
  }

  if (/\bransomware\b/i.test(text)) {
    const match = /\bransomware\b/i.exec(text);
    entities.push(entity("ttp", "ransomware activity", match?.[0] ?? "ransomware", context, match?.index ?? 0, (match?.index ?? 0) + (match?.[0].length ?? 10), 0.62));
  }

  return dedupeEntities(entities);
}

export function detectLanguageHooks(text: string, language?: string): string[] {
  const hooks = new Set<string>();
  if (language) hooks.add(`declared:${language}`);
  if (/[æøå]/i.test(text)) hooks.add("nordic-characters");
  if (/\b(?:victim|actor|sector|country|data type)\s*:/i.test(text)) hooks.add("metadata-field-labels");
  if (/\bhxxps?:|\[\.\]/i.test(text)) hooks.add("defanged-indicators");
  return [...hooks];
}

function addMatches(
  indicators: Indicator[],
  type: Indicator["type"],
  text: string,
  pattern: RegExp,
  context: ExtractionContext,
  confidence: number
): void {
  for (const match of text.matchAll(pattern)) {
    const rawValue = match[0];
    const normalizedValue = normalizeIndicator(rawValue);
    indicators.push({
      type,
      value: normalizedValue,
      rawValue,
      normalizedValue,
      confidence,
      provenance: [provenance(context, match.index ?? 0, (match.index ?? 0) + rawValue.length, rawValue)],
      reviewReasons: indicatorReviewReasons(type, normalizedValue)
    });
  }
}

function addEntityMatches(
  entities: ExtractedEntity[],
  type: ExtractedEntity["type"],
  text: string,
  pattern: RegExp,
  context: ExtractionContext,
  confidence: number
): void {
  for (const match of text.matchAll(pattern)) {
    const rawValue = match[1] ?? match[0];
    const value = cleanEntityValue(rawValue);
    if (type === "victim" && !isLikelyVictim(value)) continue;
    const start = match.index ?? 0;
    entities.push(entity(type, value, rawValue, context, start, start + match[0].length, confidence));
  }
}

function cleanEntityValue(value: string): string {
  return normalizeWhitespace(value)
    .split(/\s+(?:and|then)\s+(?:posted|listed|published|shared|used|exploited|claimed)\b/i)[0]
    ?.split(/\.\s+(?:First seen|Last seen|Published|Observed|The campaign)\b/i)[0]
    ?.split(/\s+in\s+the\s+(?:healthcare|government|energy|finance|financial services|telecommunications|education|manufacturing|retail)\s+sector\b/i)[0]
    ?.split(/\s+(?:with|using|on)\s+(?:Cobalt|PlugX|QakBot|Emotet|TrickBot|Sliver|AnyDesk|Rclone|20\d{2}-\d{2}-\d{2})\b/i)[0]
    ?.replace(/[.,;:]+$/, "")
    .trim() ?? "";
}

function entity(
  type: ExtractedEntity["type"],
  value: string,
  rawValue: string,
  context: ExtractionContext,
  startOffset: number,
  endOffset: number,
  confidence: number
): ExtractedEntity {
  return {
    type,
    value: cleanEntityValue(value),
    rawValue,
    normalizedValue: cleanEntityValue(value),
    confidence,
    provenance: [provenance(context, startOffset, endOffset, rawValue)],
    reviewReasons: confidence < 0.65 ? ["weak entity signal"] : []
  };
}

function provenance(
  context: ExtractionContext,
  startOffset: number,
  endOffset: number,
  evidenceText: string
): ExtractionProvenance {
  return {
    sourceId: context.sourceId,
    captureId: context.captureId,
    url: context.url,
    collectedAt: context.collectedAt,
    contentHash: context.contentHash,
    extractorVersion: EXTRACTOR_VERSION,
    startOffset,
    endOffset,
    evidenceText: evidenceText.slice(0, 240)
  };
}

function isLikelyVictim(value: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized.length < 3) return false;
  if (GENERIC_VICTIM_WORDS.has(normalized)) return false;
  if (/^(?:a|an|the)\s/.test(normalized)) return false;
  if (/\b(?:inc|corp|corporation|ltd|llc|plc|gmbh|as|asa|bank|energy|health|telecom|university|hospital|systems|technologies)\b/i.test(value)) {
    return true;
  }
  return /[A-Z][a-z]+(?:\s+[A-Z][A-Za-z0-9&.'-]+)+/.test(value);
}

function titleCase(value: string): string {
  return value.split(" ").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");
}

function normalizeIndicator(value: string): string {
  return value
    .replace(/^hxxp/i, "http")
    .replace(/\[\.\]/g, ".")
    .replace(/\.$/, "");
}

function indicatorReviewReasons(type: Indicator["type"], value: string): string[] {
  const reasons: string[] = [];
  if (type === "ipv4" && isPrivateIpv4(value)) reasons.push("private or reserved IP address");
  if (type === "ipv6" && value.toLowerCase().startsWith("2001:db8")) reasons.push("private or reserved IP address");
  return reasons;
}

function isPrivateIpv4(value: string): boolean {
  const [first, second] = value.split(".").map(Number);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || first === 127;
}

function dedupeIndicators(indicators: Indicator[]): Indicator[] {
  const seen = new Set<string>();
  return indicators.filter((indicator) => {
    const key = `${indicator.type}:${indicator.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Set<string>();
  return entities.filter((item) => {
    const key = `${item.type}:${item.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
