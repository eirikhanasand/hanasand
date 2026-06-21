import { selectParserProfile, type ParserFailureCategory, type ParserProfileDecision } from "../../adapters/parserProfiles.ts";
import type { AdapterRunResult, CollectedItem, SourceRecord, SourceStatus, SourceType } from "../../types.ts";
import { hashContent } from "../../utils.ts";

export const generatedAt = "2026-05-24T12:00:00.000Z";
const createdAt = new Date(0).toISOString();

export function source(input: { id: string; type: SourceType; url: string; status?: SourceStatus; metadata?: Record<string, unknown> }): SourceRecord {
  return {
    id: input.id,
    name: input.id.replaceAll("_", " "),
    type: input.type,
    url: input.url,
    accessMethod: input.type === "telegram_public" ? "official_api" : "public_http",
    status: input.status ?? "active",
    risk: "low",
    trustScore: 0.84,
    language: "en",
    crawlFrequencySeconds: 3600,
    legalNotes: "Public collection fixture with robots/legal notes.",
    createdAt,
    updatedAt: createdAt,
    metadata: input.metadata
  };
}

export function result(src: SourceRecord, options: { text?: string; warning?: string; failureCategory?: ParserFailureCategory | string; canonicalUrl?: string } = {}): AdapterRunResult {
  const item: CollectedItem = { sourceId: src.id, taskId: `task_${src.id}`, url: src.url, title: src.name, rawText: options.text ?? "", collectedAt: generatedAt, publishedAt: "2026-05-23T10:00:00.000Z", contentHash: hashContent(options.text ?? ""), language: "en", links: [], metadata: { parserWarnings: [] }, sensitive: false };
  return { items: options.text ? [item] : [], discovered: [], warnings: options.warning ? [options.warning] : [], metadata: { ...(options.failureCategory ? { failureCategory: options.failureCategory } : {}), ...(options.canonicalUrl ? { canonicalUrl: options.canonicalUrl } : {}) } };
}

export function profile(src: SourceRecord, options: { contentType?: string; text?: string; requiresJavascript?: boolean; publicChannelHandoff?: boolean; parserWarnings?: string[]; failureCategory?: ParserFailureCategory } = {}): ParserProfileDecision {
  return selectParserProfile({
    sourceType: src.type,
    url: src.url,
    contentType: options.contentType ?? (src.type === "rss" ? "application/rss+xml" : src.type === "pdf" ? "application/pdf" : "text/html"),
    textSample: options.text ?? "Threat report fixture text covering actor activity, CVE exploitation, malware tooling, sectors, and mitigations.",
    requiresJavascript: options.requiresJavascript,
    publicChannelHandoff: options.publicChannelHandoff,
    parserWarnings: options.parserWarnings,
    failureCategory: options.failureCategory,
    language: "en"
  });
}
