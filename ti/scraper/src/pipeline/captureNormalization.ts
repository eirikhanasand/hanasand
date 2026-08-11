import { hashContent, normalizeWhitespace } from "../utils.ts";

export type NormalizedCapture = {
  version: "ti-capture-normalization-v1";
  status: "normalized" | "metadata_only" | "unparsed";
  failureCategory?: "dynamic_application_data" | "empty_after_cleanup" | "unsupported_media";
  failureReason?: string;
  title?: string;
  author?: string;
  publishedAt?: string;
  headings: string[];
  links: string[];
  namedEntities: string[];
  incidentLanguage: string[];
  sourceUrl?: string;
  text: string;
  excerpt: string;
  normalizedTextHash: string;
};

const NOISE_TAGS = /<(script|style|noscript|template|svg|canvas|iframe|nav|footer|header|aside)\b[\s\S]*?<\/\1\s*>/gi;
const NOISE_ELEMENTS = /<(?:[a-z][\w:-]*)\b[^>]*(?:id|class)=["'][^"']*(?:cookie|consent|banner|navigation|navbar|breadcrumb|footer|header|tracking|social|share|menu)[^"']*["'][^>]*>[\s\S]*?<\/[a-z][\w:-]*\s*>/gi;
const SCRIPT_STATE = /(?:window\.(?:WIZ_global_data|__NEXT_DATA__|dataLayer)|__NEXT_DATA__|WIZ_global_data)\s*=\s*[\s\S]{0,12000}?(?:;|<\/script>|$)/gi;
const JSON_STATE = /(?:[{[]\\?\"(?:props|page|data|config|runtimeConfig|buildId|initialState|query)\\?\"\s*:[\s\S]{0,4000}[}\]])/gi;
const DATE_META = /<meta\b[^>]*(?:property|name)=["'](?:article:published_time|date|pubdate|publish(?:ed)?|datePublished)["'][^>]*content=["']([^"']+)["'][^>]*>/i;
const AUTHOR_META = /<meta\b[^>]*(?:name|property)=["'](?:author|article:author)["'][^>]*content=["']([^"']+)["'][^>]*>/i;

export function normalizeCapturedContent(input: { body?: unknown; html?: unknown; rawText?: unknown; metadata?: Record<string, unknown>; url?: string; collectedAt?: string; publishedAt?: string; sensitive?: boolean; storageKind?: string }): NormalizedCapture {
  const metadata = input.metadata ?? {};
  const sourceUrl = safeUrl(input.url);
  if (input.sensitive || input.storageKind === "metadata_only") {
    const text = cleanText(metadata.safeExcerpt ?? metadata.excerpt ?? metadata.title ?? "");
    return result({ status: text ? "metadata_only" : "unparsed", text, excerpt: text, sourceUrl, metadata, failureCategory: text ? undefined : "unsupported_media", failureReason: text ? "The source is retained as metadata only; the readable excerpt is the safe material available for this record." : "The source was collected under a metadata-only policy and did not provide a readable excerpt." });
  }

  const raw = String(input.html ?? input.body ?? input.rawText ?? "");
  const html = /<\/?[a-z][^>]*>/i.test(raw);
  const title = first(String(metadata.title ?? ""), html ? htmlValue(raw, /<title\b[^>]*>([\s\S]*?)<\/title>/i) : undefined, html ? htmlValue(raw, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i) : undefined);
  const author = first(String(metadata.author ?? metadata.byline ?? ""), html ? htmlValue(raw, AUTHOR_META) : undefined);
  const publishedAt = first(String(input.publishedAt ?? ""), html ? htmlValue(raw, DATE_META) : undefined);
  const headings = html ? matches(raw, /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi).map(cleanText).filter(Boolean).slice(0, 20) : [];
  const links = html ? matches(raw, /<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>/gi, 1).map(safeUrl).filter(Boolean).slice(0, 50) as string[] : [];
  const cleaned = cleanText(raw, html);
  const text = meaningful(cleaned);
  if (!text) return result({ status: "unparsed", title: title || undefined, author: author || undefined, publishedAt: publishedAt || undefined, headings, links, sourceUrl, text: "", excerpt: "", metadata, failureCategory: /window\.|WIZ_global_data|__NEXT_DATA__|application\/json/i.test(raw) ? "dynamic_application_data" : "empty_after_cleanup", failureReason: /window\.|WIZ_global_data|__NEXT_DATA__|application\/json/i.test(raw) ? "The page contained dynamic application data that the parser could not interpret." : "The source was collected, but no readable article text was available." });
  const incidentLanguage = [...new Set((text.match(/\b(?:breach|compromised|exploited|attack(?:ed)?|ransomware|phishing|malware|intrusion|data theft|data leak|vulnerability|campaign|target(?:ed)?|victim)\b/gi) ?? []).map(value => value.toLowerCase()))].slice(0, 20);
  const namedEntities = [...new Set((text.match(/\b[A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){1,5}\b/g) ?? []).filter(value => !/^(The|This|Latest|Google Cloud Threat Intelligence Blog)\b/.test(value)))].slice(0, 40);
  return result({ status: "normalized", title: title || undefined, author: author || undefined, publishedAt: publishedAt || undefined, headings, links, namedEntities, incidentLanguage, sourceUrl, text, excerpt: excerpt(text), metadata });
}

function result(value: Partial<NormalizedCapture> & Pick<NormalizedCapture, "status" | "text" | "excerpt">): NormalizedCapture {
  const text = value.text ?? "";
  return { version: "ti-capture-normalization-v1", headings: [], links: [], namedEntities: [], incidentLanguage: [], normalizedTextHash: hashContent(normalizeWhitespace(text).toLowerCase()), ...value };
}

function cleanText(value: unknown, html = false): string {
  let text = String(value ?? "");
  if (html) text = text.replace(NOISE_TAGS, " ").replace(NOISE_ELEMENTS, " ");
  text = text.replace(SCRIPT_STATE, " ").replace(JSON_STATE, " ");
  return normalizeWhitespace(text.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">"));
}

function meaningful(text: string) { return text.replace(/(?:window\.|WIZ_global_data|__NEXT_DATA__|display\s*:\s*none|function\s+\w+\s*\()/gi, "").replace(/[{}\\]{2,}/g, "").trim(); }
function excerpt(text: string) { return text.length <= 700 ? text : `${text.slice(0, 697).replace(/\s+\S*$/, "")}...`; }
function matches(value: string, pattern: RegExp, group = 1) { return [...value.matchAll(pattern)].map(match => String(match[group] ?? "")); }
function htmlValue(value: string, pattern: RegExp) { const match = pattern.exec(value); return match?.[1] ? cleanText(match[1]) : undefined; }
function first(...values: Array<string | undefined>) { return values.map(value => String(value ?? "").trim()).find(Boolean) ?? ""; }
function safeUrl(value: unknown): string | undefined { try { const url = new URL(String(value ?? "")); return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined; } catch { return undefined; } }
