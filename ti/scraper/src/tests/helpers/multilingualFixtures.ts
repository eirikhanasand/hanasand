import { selectParserProfile, type ParserProfileDecision } from "../../adapters/parserProfiles.ts";
import type { CollectedItem, SourceRecord, SourceType } from "../../types.ts";
import { hashContent } from "../../utils.ts";

export const generatedAt = "2026-05-24T14:00:00.000Z";
const createdAt = new Date(0).toISOString();

export function source(id: string, type: SourceType, url: string, language?: string): SourceRecord {
  return {
    id,
    name: id.replaceAll("_", " "),
    type,
    url,
    accessMethod: type === "telegram_public" ? "official_api" : "public_http",
    status: "active",
    risk: "low",
    trustScore: 0.84,
    language,
    crawlFrequencySeconds: 3600,
    legalNotes: "Public multilingual fixture.",
    createdAt,
    updatedAt: createdAt
  };
}

export function item(src: SourceRecord, text: string, language?: string): CollectedItem {
  return { sourceId: src.id, taskId: `task_${src.id}`, url: src.url, title: src.name, rawText: text, collectedAt: generatedAt, publishedAt: "2026-05-23T00:00:00.000Z", contentHash: hashContent(text), language, links: [], metadata: { citationSpans: [{ start: 0, end: Math.min(48, text.length), label: "lead_sentence" }] }, sensitive: false };
}

export function profile(src: SourceRecord, text: string, options: { contentType?: string; requiresJavascript?: boolean; publicChannelHandoff?: boolean } = {}): ParserProfileDecision {
  return selectParserProfile({
    sourceType: src.type,
    url: src.url,
    contentType: options.contentType ?? (src.type === "rss" ? "application/rss+xml" : src.type === "pdf" ? "application/pdf" : "text/html"),
    requiresJavascript: options.requiresJavascript,
    publicChannelHandoff: options.publicChannelHandoff,
    textSample: text,
    language: src.language
  });
}
