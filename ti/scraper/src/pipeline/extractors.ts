import type { ExtractedEntity, ExtractionProvenance, Indicator } from "../types.ts";
import { normalizeWhitespace } from "../utils.ts";
import { ACTOR_ALIAS_RECORDS } from "./actorAliases.ts";

export const EXTRACTOR_VERSION = "ti-extractor-v2";
export type ExtractionContext = { sourceId: string; captureId: string; url: string; collectedAt: string; contentHash: string; language?: string };
const RES = { cve: /\bCVE-\d{4}-\d{4,7}\b/gi, ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, ipv6: /\b(?:[a-f0-9]{1,4}:){2,7}[a-f0-9]{1,4}\b/gi, sha256: /\b[a-f0-9]{64}\b/gi, sha1: /\b[a-f0-9]{40}\b/gi, md5: /\b[a-f0-9]{32}\b/gi, url: /\b(?:https?|hxxps?):\/\/[^\s<>"')]+/gi, domain: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\[?\.\]?)+(?:com|net|org|io|ru|cn|ir|biz|info|co|uk|de|fr|no|onion)\b/gi };
const CONF = { cve: 0.9, ipv4: 0.75, ipv6: 0.65, sha256: 0.95, sha1: 0.85, md5: 0.8, url: 0.75, domain: 0.6 };
const MALWARE = ["emotet", "trickbot", "cobalt strike", "qakbot", "plugx", "sliver", "carbanak", "mimikatz", "icedid", "rclone", "anydesk", "snake", "powgoop", "wellmess", "ngrok", "cloudflared", "meshagent", "screenconnect", "brute ratel", "systembc", "darkgate", "lumma", "redline", "stealc"];
const RANSOMWARE_FAMILIES = ["akira", "lockbit", "alphv", "blackcat", "black cat", "clop", "ransomhub", "black basta", "play", "bianlian"];
const TECHNIQUES = ["phishing", "credential dumping", "valid accounts", "lateral movement", "remote desktop protocol", "powershell", "command and control", "exfiltration", "persistence", "spearphishing", "data exfiltration", "data theft", "sms phishing", "living off the land", "exploit", "intrusion", "mfa fatigue", "oauth abuse", "token theft", "password spraying", "remote services", "cloud identity abuse", "initial access"];
const SECTORS = ["healthcare", "government", "energy", "finance", "financial services", "telecommunications", "education", "manufacturing", "retail", "technology", "cloud services", "legal", "transportation", "insurance", "media", "defense", "critical infrastructure"];
const COUNTRIES = ["united states", "norway", "ukraine", "russia", "china", "germany", "france", "united kingdom", "japan", "south korea", "canada", "australia", "netherlands", "sweden", "finland", "denmark", "spain", "italy"];
const GENERIC = new Set(["actor", "analysts", "campaign", "company", "customer", "customers", "data", "government", "healthcare", "malware", "organization", "organizations", "ransomware", "report", "researchers", "target", "targets", "telecom", "victim", "victims"]);

export function extractIndicators(text: string, context: ExtractionContext): Indicator[] {
  const rows: Indicator[] = []; for (const [type, pattern] of Object.entries(RES)) addMatches(rows, type as Indicator["type"], text, pattern, context, CONF[type]); return dedupe(rows, (i) => `${i.type}:${i.value.toLowerCase()}`);
}

export function extractEntities(text: string, context: ExtractionContext): ExtractedEntity[] {
  const rows: ExtractedEntity[] = [], lower = text.toLowerCase();
  for (const record of ACTOR_ALIAS_RECORDS) for (const alias of record.aliases) { const index = phraseIndex(lower, alias); if (index >= 0) { rows.push({ ...ent("actor", record.canonical, text.slice(index, index + alias.length), context, index, index + alias.length, record.confidence), aliases: record.aliases }); break; } }
  for (const [type, hints, confidence, transform] of [["malware", MALWARE, 0.72, same], ["sector", SECTORS, 0.54, same], ["country", COUNTRIES, 0.54, title], ["ttp", TECHNIQUES, 0.72, same]] as const) for (const hint of hints) { const index = phraseIndex(lower, hint); if (index >= 0) rows.push(ent(type, transform(hint), text.slice(index, index + hint.length), context, index, index + hint.length, confidence)); }
  if (/\b(?:ransomware|leak|claimed|victim|extortion|data theft)\b/i.test(text)) for (const family of RANSOMWARE_FAMILIES) { const index = phraseIndex(lower, family), nearby = text.slice(Math.max(0, index - 48), index + family.length + 48); if (index >= 0 && (family !== "play" || /(?:\bplay\b.{0,24}\b(?:ransomware|gang|group|operators?|extortion)|\b(?:ransomware|gang|group|operators?|extortion)\b.{0,24}\bplay\b)/i.test(nearby))) rows.push(ent("ransomware_family", title(family), text.slice(index, index + family.length), context, index, index + family.length, 0.76)); }
  addEntityMatches(rows, "victim", text, /\b(?:victim|customer|target(?:ed)?|against|compromised)\s*:\s*([A-Z][A-Za-z0-9&.,' -]{2,80})/g, context, 0.68);
  addEntityMatches(rows, "victim", text, /\b(?:victim|target(?:ed)?|compromised)\s+([A-Z][A-Za-z0-9&.,' -]{2,80})\s+(?:in|using|after|with|on)\b/g, context, 0.6);
  addEntityMatches(rows, "victim", text, /\bagainst\s+([A-Z][A-Za-z0-9&.,' -]{2,80})\s+(?:in|using|after|with)\b/g, context, 0.58);
  addEntityMatches(rows, "victim", text, /\bagainst\s+([A-Z][A-Za-z0-9&.,' -]{2,80})(?:[.,;]|$)/g, context, 0.56);
  addEntityMatches(rows, "sector", text, /\bsector\s*:\s*([A-Za-z][A-Za-z -]{2,60})/gi, context, 0.58); addEntityMatches(rows, "country", text, /\bcountry\s*:\s*([A-Za-z][A-Za-z -]{1,60})/gi, context, 0.58); addEntityMatches(rows, "cve", text, RES.cve, context, 0.9);
  const ransomware = /\bransomware\b/i.exec(text); if (ransomware) rows.push(ent("ttp", "ransomware activity", ransomware[0], context, ransomware.index, ransomware.index + ransomware[0].length, 0.62));
  return dedupe(rows, (e) => `${e.type}:${e.value.toLowerCase()}`);
}

export function detectLanguageHooks(text: string, language?: string): string[] {
  return [language && `declared:${language}`, /[æøå]/i.test(text) && "nordic-characters", /\b(?:victim|actor|sector|country|data type)\s*:/i.test(text) && "metadata-field-labels", /\bhxxps?:|\[\.\]/i.test(text) && "defanged-indicators"].filter(Boolean) as string[];
}

function addMatches(rows: Indicator[], type: Indicator["type"], text: string, pattern: RegExp, context: ExtractionContext, confidence: number) { for (const match of text.matchAll(pattern)) { const rawValue = match[0], value = indicatorValue(rawValue); rows.push({ type, value, rawValue, normalizedValue: value, confidence, provenance: [prov(context, match.index ?? 0, (match.index ?? 0) + rawValue.length, rawValue)], reviewReasons: review(type, value) }); } }
function addEntityMatches(rows: ExtractedEntity[], type: ExtractedEntity["type"], text: string, pattern: RegExp, context: ExtractionContext, confidence: number) { for (const match of text.matchAll(pattern)) { const rawValue = match[1] ?? match[0], value = clean(rawValue); if (type === "victim" && !victim(value)) continue; rows.push(ent(type, value, rawValue, context, match.index ?? 0, (match.index ?? 0) + match[0].length, confidence)); } }
function ent(type: ExtractedEntity["type"], value: string, rawValue: string, context: ExtractionContext, start: number, end: number, confidence: number): ExtractedEntity { return { type, value: clean(value), rawValue, normalizedValue: clean(value), confidence, extractionMethod: "deterministic_fallback", extractorVersion: EXTRACTOR_VERSION, assertionKind: type === "actor" || type === "ransomware_family" ? "mention" : "extracted", provenance: [prov(context, start, end, rawValue)], reviewReasons: confidence < 0.65 ? ["weak entity signal"] : [] }; }
function prov(context: ExtractionContext, startOffset: number, endOffset: number, evidenceText: string): ExtractionProvenance { return { sourceId: context.sourceId, captureId: context.captureId, url: context.url, collectedAt: context.collectedAt, contentHash: context.contentHash, extractorVersion: EXTRACTOR_VERSION, startOffset, endOffset, evidenceText: evidenceText.slice(0, 240) }; }
function clean(value: string) { return normalizeWhitespace(value).split(/\s+(?:and|then)\s+(?:posted|listed|published|shared|used|exploited|claimed)\b/i)[0]?.split(/\.\s+(?:First seen|Last seen|Published|Observed|The campaign)\b/i)[0]?.split(/\s+in\s+the\s+(?:healthcare|government|energy|finance|financial services|telecommunications|education|manufacturing|retail|technology|cloud services|legal|transportation|insurance|media|defense|critical infrastructure)\s+sector\b/i)[0]?.split(/\s+(?:with|using|on)\s+(?:Cobalt|PlugX|QakBot|Emotet|TrickBot|Sliver|AnyDesk|Rclone|Ngrok|Cloudflared|ScreenConnect|Brute Ratel|SystemBC|DarkGate|Lumma|RedLine|Stealc|20\d{2}-\d{2}-\d{2})\b/i)[0]?.replace(/[.,;:]+$/, "").trim() ?? ""; }
function victim(value: string) { const n = value.toLowerCase(); return n.length >= 3 && !GENERIC.has(n) && !/^(?:a|an|the)\s/.test(n) && (/\b(?:inc|corp|corporation|ltd|llc|plc|gmbh|as|asa|bank|energy|health|telecom|university|hospital|systems|technologies)\b/i.test(value) || /[A-Z][a-z]+(?:\s+[A-Z][A-Za-z0-9&.'-]+)+/.test(value)); }
const indicatorValue = (value: string) => value.replace(/^hxxp/i, "http").replace(/\[\.\]/g, ".").replace(/\.$/, "");
const review = (type: Indicator["type"], value: string) => type === "ipv4" && privateIpv4(value) || type === "ipv6" && value.toLowerCase().startsWith("2001:db8") ? ["private or reserved IP address"] : [];
const privateIpv4 = (value: string) => { const [a, b] = value.split(".").map(Number); return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127; };
const title = (value: string) => value.split(" ").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");
const same = (value: string) => value;
function phraseIndex(text: string, phrase: string): number { const match = new RegExp(`(^|[^a-z0-9])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`, "i").exec(text); return match?.index === undefined ? -1 : match.index + match[1].length; }
function dedupe<T>(items: T[], key: (item: T) => string): T[] { const seen = new Set<string>(); return items.filter((item) => { const k = key(item); if (seen.has(k)) return false; seen.add(k); return true; }); }
