// @ts-nocheck
import { hashContent, stableId } from "../utils.ts";

export type PublicAdvisorySourceFamily = any; export type PublicAdvisoryRecordState = any; export type PublicAdvisoryAdapterOptions = any;
export type PublicAdvisoryRecord = any; export type PublicAdvisorySafeDelta = any; export type PublicAdvisorySearchHit = any; export type PublicAdvisorySignalBridgeOptions = any;

export class PublicAdvisoryAdapter {
  constructor(private options: PublicAdvisoryAdapterOptions = {}) {}
  async collect(source: any, task: any) {
    const collectedAt = this.options.now?.() ?? new Date().toISOString();
    const response = await (this.options.fetcher ?? fetch)(task.targetUrl ?? source.url);
    const body = await response.text();
    const parsed = parsePublicAdvisoryRecords({ body, contentType: response.headers?.get?.("content-type") ?? "", source, feedUrl: response.url ?? source.url, collectedAt });
    return { items: parsed.records.map((record: any) => publicAdvisoryRecordToCollectedItem({ record, source, task, collectedAt })), discovered: [], warnings: parsed.warnings };
  }
}

export function parsePublicAdvisoryRecords(input: any): { records: PublicAdvisoryRecord[]; warnings: string[] } {
  const entries = input.contentType?.includes("json") ? jsonEntries(input.body) : xmlEntries(input.body);
  const warnings = entries.length ? [] : ["no advisory entries parsed"];
  return { records: entries.map((entry: any, index: number) => normalizeRecord({ ...entry, id: entry.id ?? `${input.source.id}_${index}`, source: input.source, feedUrl: input.feedUrl, family: input.family ?? inferAdvisoryFamily(input.source, input.feedUrl), collectedAt: input.collectedAt })), warnings };
}

export function publicAdvisoryRecordToCollectedItem(input: any) {
  const r = input.record, source = input.source, urlHash = publicAdvisoryUrlHash(r.url);
  const safeDelta = publicAdvisorySafeDelta({ record: r, source, collectedAt: input.collectedAt });
  const rawText = [r.title, r.summary, r.url].filter(Boolean).join("\n");
  return { source, task: input.task, url: r.url, title: r.title, rawText, body: rawText, collectedAt: input.collectedAt, contentHash: hashContent(rawText), metadata: { adapter: "public_advisory", state: r.state, family: r.family, canonicalUrlHash: urlHash, matchedEntities: r.matchedEntities, safeDelta } };
}

export function publicAdvisorySafeDelta(input: any): PublicAdvisorySafeDelta {
  const r = input.record;
  return { schemaVersion: "ti.public_advisory_signal_delta.v1", id: r.id, title: r.title, urlHash: publicAdvisoryUrlHash(r.url), family: r.family, state: r.state, publishedAt: r.publishedAt, matchedEntities: r.matchedEntities, confidence: r.confidence, safeOutput: { rawBodyExposed: false, credentialsExposed: false } };
}

export function searchPublicAdvisoryItems(items: any[], query: string, limit = 10): PublicAdvisorySearchHit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.map((item) => ({ item, score: terms.filter((t) => JSON.stringify(item).toLowerCase().includes(t)).length / Math.max(1, terms.length) })).filter((hit) => hit.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function publicAdvisoryItemsToSignalRecords(items: any[], options: PublicAdvisorySignalBridgeOptions = {}) {
  return items.flatMap((item) => {
    const metadata = item.metadata ?? {}, delta = metadata.safeDelta ?? {}, source = options.sourceById?.get?.(item.source?.id ?? item.sourceId);
    if (metadata.adapter !== "public_advisory" && delta.schemaVersion !== "ti.public_advisory_signal_delta.v1" && !options.includeNonAdvisoryItems) return [];
    return [{ id: stableId("public-advisory-signal", `${item.url}:${item.contentHash}`), sourceId: item.source?.id ?? item.sourceId, sourceName: source?.name ?? item.source?.name, urlHash: metadata.canonicalUrlHash ?? delta.urlHash ?? publicAdvisoryUrlHash(item.url), title: item.title, summary: item.rawText, family: bridgeFamily(metadata.family ?? delta.family), state: metadata.state ?? delta.state ?? "observed", matchedEntities: metadata.matchedEntities ?? delta.matchedEntities ?? entities(item.rawText ?? ""), confidence: delta.confidence ?? 0.65, publishedAt: delta.publishedAt, collectedAt: item.collectedAt, provenance: { connector: "public_advisory", rawBodyExposed: false } }];
  });
}

export function inferAdvisoryFamily(source: any, url = source.url): PublicAdvisorySourceFamily {
  const text = `${source.name ?? ""} ${url}`.toLowerCase();
  if (text.includes("cisa") || text.includes("cert")) return "government_advisory";
  if (text.includes("microsoft") || text.includes("google") || text.includes("unit42") || text.includes("mandiant")) return "vendor_advisory";
  return "public_advisory";
}

export const publicAdvisoryUrlHash = (url: string) => hashContent(new URL(url, "https://example.invalid").toString().split("#")[0]);
const bridgeFamily = (family: string) => family?.includes("government") ? "government" : family?.includes("vendor") ? "vendor" : "community";
const jsonEntries = (body: string) => { try { const parsed = JSON.parse(body); return Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : []; } catch { return []; } };
const xmlEntries = (body: string) => [...body.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => ({ title: tag(m[0], "title"), url: tag(m[0], "link"), summary: tag(m[0], "description"), publishedAt: tag(m[0], "pubDate") }));
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1]?.replace(/<[^>]+>/g, "").trim();
function normalizeRecord(input: any) { const text = `${input.title ?? ""} ${input.summary ?? ""}`; return { id: input.id, title: input.title ?? input.url ?? "Untitled advisory", url: input.url ?? input.feedUrl, summary: input.summary ?? "", family: input.family, state: input.state ?? "observed", publishedAt: input.publishedAt, collectedAt: input.collectedAt, matchedEntities: input.matchedEntities ?? entities(text), confidence: confidence(input.family, text), sourceId: input.source.id }; }
function entities(text: string) { return { actors: uniq(text.match(/\bAPT\d+\b|Volt Typhoon|Turla|Akira|Scattered Spider/gi) ?? []), cves: uniq(text.match(/CVE-\d{4}-\d{4,7}/gi) ?? []), victims: uniq([...text.matchAll(/victim:?\s+([A-Z][\w .&-]+)/g)].map((m) => m[1])), sectors: uniq(text.match(/\b(government|energy|healthcare|finance|telecom)\b/gi) ?? []) }; }
const confidence = (family: string, text: string) => Math.min(0.95, 0.55 + (family?.includes("government") ? 0.2 : 0.1) + (entities(text).cves.length ? 0.1 : 0) + (entities(text).actors.length ? 0.1 : 0));
const uniq = (values: string[]) => [...new Set(values.filter(Boolean).map((v) => v.trim()))];
