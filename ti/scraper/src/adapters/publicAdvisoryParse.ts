import type { PublicAdvisoryRecord, PublicAdvisorySourceFamily } from "./publicAdvisoryTypes.ts";
import { entities } from "./publicAdvisorySignals.ts";

export function parsePublicAdvisoryRecords(input: any): { records: PublicAdvisoryRecord[]; warnings: string[] } {
  const entries = input.contentType?.includes("json") ? jsonEntries(input.body) : xmlEntries(input.body);
  const warnings = entries.length ? [] : ["no advisory entries parsed"];
  return { records: entries.map((entry: any, index: number) => normalizeRecord({ ...entry, id: entry.id ?? `${input.source.id}_${index}`, source: input.source, feedUrl: input.feedUrl, family: input.family ?? inferAdvisoryFamily(input.source, input.feedUrl), collectedAt: input.collectedAt })), warnings };
}

export function inferAdvisoryFamily(source: any, url = source.url): PublicAdvisorySourceFamily {
  const text = `${source.name ?? ""} ${url}`.toLowerCase();
  if (text.includes("cisa") || text.includes("cert")) return "government_advisory";
  if (text.includes("microsoft") || text.includes("google") || text.includes("unit42") || text.includes("mandiant")) return "vendor_advisory";
  return "public_advisory";
}

const jsonEntries = (body: string) => { try { const parsed = JSON.parse(body); return Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : []; } catch { return []; } };
const xmlEntries = (body: string) => [...body.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => ({ title: tag(m[0], "title"), url: tag(m[0], "link"), summary: tag(m[0], "description"), publishedAt: tag(m[0], "pubDate") }));
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1]?.replace(/<[^>]+>/g, "").trim();
function normalizeRecord(input: any) { const text = `${input.title ?? ""} ${input.summary ?? ""}`; return { id: input.id, title: input.title ?? input.url ?? "Untitled advisory", url: input.url ?? input.feedUrl, summary: input.summary ?? "", family: input.family, state: input.state ?? "observed", publishedAt: input.publishedAt, collectedAt: input.collectedAt, matchedEntities: input.matchedEntities ?? entities(text), confidence: confidence(input.family, text), sourceId: input.source.id }; }
const confidence = (family: string, text: string) => Math.min(0.95, 0.55 + (family?.includes("government") ? 0.2 : 0.1) + (entities(text).cves.length ? 0.1 : 0) + (entities(text).actors.length ? 0.1 : 0));
