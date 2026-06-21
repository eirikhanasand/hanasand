import { buildAdapterFailureObservation, type AdapterObservatoryQueryClass } from "../../adapters/adapterFailureObservatory.ts";
import { selectParserProfile, type ParserFailureCategory, type ParserProfileDecision } from "../../adapters/parserProfiles.ts";
import type { AdapterRunResult, CollectedItem, SourceRecord, SourceType } from "../../types.ts";
import { hashContent } from "../../utils.ts";

export const generatedAt = "2026-05-24T16:00:00.000Z";
const createdAt = new Date(0).toISOString();

export function source(id: string, type: SourceType, url: string, metadata?: Record<string, unknown>): SourceRecord {
  return { id, name: id.replaceAll("_", " "), type, url, accessMethod: type === "telegram_public" ? "official_api" : "public_http", status: "active", risk: "low", trustScore: 0.84, language: "en", crawlFrequencySeconds: 3600, legalNotes: "Public source fixture with legal notes.", createdAt, updatedAt: createdAt, metadata };
}

export function item(src: SourceRecord, text: string, metadata: Record<string, unknown> = {}): CollectedItem {
  return { sourceId: src.id, taskId: `task_${src.id}`, url: src.url, title: src.name, rawText: text, collectedAt: generatedAt, publishedAt: "2026-05-23T10:00:00.000Z", contentHash: hashContent(text), language: src.language, links: [], metadata, sensitive: false };
}

export function result(src: SourceRecord, options: { text?: string; warnings?: string[]; failureCategory?: ParserFailureCategory; canonicalUrl?: string; itemMetadata?: Record<string, unknown> } = {}): AdapterRunResult {
  return { items: options.text ? [item(src, options.text, options.itemMetadata)] : [], discovered: [], warnings: options.warnings ?? [], metadata: { ...(options.failureCategory ? { failureCategory: options.failureCategory } : {}), ...(options.canonicalUrl ? { canonicalUrl: options.canonicalUrl } : {}) } };
}

export function profile(src: SourceRecord, options: { text?: string; contentType?: string; requiresJavascript?: boolean; publicChannelHandoff?: boolean; parserWarnings?: string[]; failureCategory?: ParserFailureCategory; language?: string } = {}): ParserProfileDecision {
  return selectParserProfile({ sourceType: src.type, url: src.url, contentType: options.contentType ?? (src.type === "rss" ? "application/rss+xml" : src.type === "pdf" ? "application/pdf" : "text/html"), textSample: options.text ?? "APT29 public report with campaign details, malware, infrastructure, CVEs, and mitigations.", requiresJavascript: options.requiresJavascript, publicChannelHandoff: options.publicChannelHandoff, parserWarnings: options.parserWarnings, failureCategory: options.failureCategory, language: options.language ?? src.language });
}

export function observation(input: { src: SourceRecord; run: AdapterRunResult; prof: ParserProfileDecision; queryClass?: AdapterObservatoryQueryClass; retryAfterSeconds?: number; staleDate?: string; duplicateRate?: number; contentType?: string }) {
  return buildAdapterFailureObservation({ generatedAt, source: input.src, result: input.run, profile: input.prof, queryClass: input.queryClass ?? "actor", retryAfterSeconds: input.retryAfterSeconds, staleDate: input.staleDate, duplicateRate: input.duplicateRate, contentType: input.contentType });
}
