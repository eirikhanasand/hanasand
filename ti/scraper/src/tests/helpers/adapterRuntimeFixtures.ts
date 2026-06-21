import { buildAdapterFailureObservation, buildAdapterFailureObservatory, type AdapterObservatoryQueryClass, type AdapterObservatorySourceFamily } from "../../adapters/adapterFailureObservatory.ts";
import { type AdapterRuntimeCanarySourceInput } from "../../adapters/adapterRuntimeEnablement.ts";
import { selectParserProfile, type ParserProfileDecision } from "../../adapters/parserProfiles.ts";
import type { AdapterRunResult, CollectedItem, SourceRecord, SourceType } from "../../types.ts";
import { hashContent } from "../../utils.ts";

export const generatedAt = "2026-05-24T13:00:00.000Z";
const createdAt = new Date(0).toISOString();

export function source(id: string, type: SourceType, url: string, legalNotes = "Public collection legal notes."): SourceRecord {
  return { id, name: id.replaceAll("_", " "), type, url, accessMethod: type === "telegram_public" ? "official_api" : "public_http", status: "active", risk: "low", trustScore: 0.86, language: "en", crawlFrequencySeconds: 3600, legalNotes, createdAt, updatedAt: createdAt };
}

export function result(src: SourceRecord, text = "Public CTI source fixture with actor, CVE, malware, sector, and mitigation details."): AdapterRunResult {
  const item: CollectedItem = { sourceId: src.id, taskId: `task_${src.id}`, url: src.url, title: src.name, rawText: text, collectedAt: generatedAt, publishedAt: "2026-05-23T00:00:00.000Z", contentHash: hashContent(text), language: "en", links: [], metadata: {}, sensitive: false };
  return { items: [item], discovered: [], warnings: [], metadata: {} };
}

export function profile(src: SourceRecord, options: { contentType?: string; requiresJavascript?: boolean; publicChannelHandoff?: boolean; text?: string } = {}): ParserProfileDecision {
  return selectParserProfile({ sourceType: src.type, url: src.url, contentType: options.contentType ?? (src.type === "rss" ? "application/rss+xml" : src.type === "pdf" ? "application/pdf" : "text/html"), requiresJavascript: options.requiresJavascript, publicChannelHandoff: options.publicChannelHandoff, textSample: options.text ?? "Public CTI source fixture with enough detail to clear parser confidence gates and evidence yield checks.", language: "en" });
}

export function canary(input: { source: SourceRecord; sourceFamily: AdapterObservatorySourceFamily; parserProfile: ParserProfileDecision; maxBytes?: number; observedContentLengthBytes?: number; expectedEvidenceYield?: number; robotsAllowed?: boolean; legalNotesPresent?: boolean }): AdapterRuntimeCanarySourceInput {
  return { source: input.source, sourceFamily: input.sourceFamily, parserProfile: input.parserProfile, canonicalUrl: input.source.url, robotsAllowed: input.robotsAllowed ?? true, legalNotesPresent: input.legalNotesPresent ?? true, maxBytes: input.maxBytes ?? 5_000_000, observedContentLengthBytes: input.observedContentLengthBytes ?? 100_000, expectedEvidenceYield: input.expectedEvidenceYield ?? 0.82 };
}

export function healthyObservatory(fixtures: Array<{ src: SourceRecord; sourceFamily?: AdapterObservatorySourceFamily; queryClass: AdapterObservatoryQueryClass; parserProfile: ParserProfileDecision }> = []) {
  const observations = fixtures.map((fixture) => buildAdapterFailureObservation({ generatedAt, source: fixture.src, sourceFamily: fixture.sourceFamily, queryClass: fixture.queryClass, result: result(fixture.src), profile: fixture.parserProfile }));
  return buildAdapterFailureObservatory({ generatedAt, observations });
}

export const defaultThresholds = () => ({ staticMinParserConfidence: 0.65, rssMinParserConfidence: 0.65, dynamicMinParserConfidence: 0.72, pdfMinParserConfidence: 0.72, publicChannelMinParserConfidence: 0.65, advisoryMinParserConfidence: 0.65, maxWatchFailureRatio: 0.35, maxBlockedFailureRatio: 0.05, minEvidenceYield: 0.5 });
export const defaultPoolCaps = () => ({ staticMaxWorkers: 32, rssMaxWorkers: 24, dynamicMaxWorkers: 2, pdfMaxWorkers: 4, publicChannelMaxWorkers: 4, advisoryMaxWorkers: 8, memoryCapMb: 1024, timeoutMs: 20_000, maxBytes: 5_000_000 });
