import { type AdapterCertificationFixtureInput } from "../../adapters/adapterCertification.ts";
import { buildAdapterFailureObservation } from "../../adapters/adapterFailureObservatory.ts";
import { type AdapterSlaAdapterKind } from "../../adapters/adapterSlaRepair.ts";
import { selectParserProfile, type ParserFailureCategory, type ParserProfileDecision } from "../../adapters/parserProfiles.ts";
import type { AdapterRunResult, CollectedItem, SourceRecord, SourceType } from "../../types.ts";
import { hashContent } from "../../utils.ts";

export const generatedAt = "2026-05-24T20:30:00.000Z";
export const adapters: AdapterSlaAdapterKind[] = ["static_html", "rss_feed", "dynamic_public_browser", "pdf_report", "public_channel_handoff", "advisory_signal", "multilingual_handoff"];
const createdAt = new Date(0).toISOString();

export function source(id: string, type: SourceType, url: string): SourceRecord {
  return { id, name: id.replaceAll("_", " "), type, url, accessMethod: type === "telegram_public" ? "official_api" : "public_http", status: "active", risk: "low", trustScore: 0.82, language: "en", crawlFrequencySeconds: 3600, legalNotes: "Public source fixture with legal notes.", createdAt, updatedAt: createdAt };
}

export function run(src: SourceRecord, options: { text?: string; warnings?: string[]; failureCategory?: ParserFailureCategory; canonicalUrl?: string } = {}): AdapterRunResult {
  const item: CollectedItem = { sourceId: src.id, taskId: `task_${src.id}`, url: src.url, title: src.name, rawText: options.text ?? "", collectedAt: generatedAt, publishedAt: "2026-05-23T10:00:00.000Z", contentHash: hashContent(options.text ?? ""), language: src.language, links: [], metadata: {}, sensitive: false };
  return { items: options.text ? [item] : [], discovered: [], warnings: options.warnings ?? [], metadata: { ...(options.failureCategory ? { failureCategory: options.failureCategory } : {}), ...(options.canonicalUrl ? { canonicalUrl: options.canonicalUrl } : {}) } };
}

export function profile(src: SourceRecord, options: { text?: string; contentType?: string; requiresJavascript?: boolean; publicChannelHandoff?: boolean; parserWarnings?: string[]; failureCategory?: ParserFailureCategory } = {}): ParserProfileDecision {
  return selectParserProfile({ sourceType: src.type, url: src.url, contentType: options.contentType ?? (src.type === "rss" ? "application/rss+xml" : src.type === "pdf" ? "application/pdf" : "text/html"), textSample: options.text ?? "APT29 public report with campaign details, malware, infrastructure, CVEs, and mitigations.", requiresJavascript: options.requiresJavascript, publicChannelHandoff: options.publicChannelHandoff, parserWarnings: options.parserWarnings, failureCategory: options.failureCategory, language: src.language });
}

export function successFixture(adapter: AdapterSlaAdapterKind, index = 0): AdapterCertificationFixtureInput {
  return { fixtureId: `${adapter}_success_${index}`, adapter, mode: "success", sourceId: `src_${adapter}`, url: `https://fixtures.example.test/${adapter}/success?secret=must-not-leak`, objectRef: `s3://ti-fixtures/${adapter}/success/body.html`, parserVersion: "adapter-triage-fixture-v1", parserConfidence: 0.88, extractionStats: { bytesRead: 1800, bytesAllowed: 10_000, textLength: 1000, linkCount: 4, citationSpanCount: 2, warningCount: 0 }, publishedAt: "2026-05-24T12:00:00.000Z", collectedAt: "2026-05-24T20:00:00.000Z", language: { declared: "en", detected: "en", confidence: 0.9 }, explicitBoundedDynamic: adapter === "dynamic_public_browser" };
}

export function repairObservations() {
  const staticSrc = source("src_static_selector", "static_web", "https://vendor.example.test/apt29");
  const rssSrc = source("src_rss_rate_limit", "rss", "https://news.example.test/feed.xml");
  const dynamicSrc = source("src_dynamic_empty", "dynamic_web", "https://dynamic.example.test/report");
  const publicChannelSrc = source("src_public_channel_duplicate", "telegram_public", "https://t.me/public_cti");
  const pdfSrc = source("src_pdf_low_confidence", "pdf", "https://reports.example.test/report.pdf");
  return [
    buildAdapterFailureObservation({ generatedAt, source: staticSrc, result: run(staticSrc, { warnings: ["parser gap: selector .article-body missing", "readability failure: boilerplate only"], canonicalUrl: staticSrc.url }), profile: profile(staticSrc, { parserWarnings: ["selector failure for vendor article"] }), queryClass: "actor" }),
    buildAdapterFailureObservation({ generatedAt, source: rssSrc, result: run(rssSrc, { canonicalUrl: rssSrc.url }), profile: profile(rssSrc), queryClass: "ransomware", retryAfterSeconds: 180 }),
    buildAdapterFailureObservation({ generatedAt, source: dynamicSrc, result: run(dynamicSrc, { failureCategory: "timeout", canonicalUrl: dynamicSrc.url }), profile: profile(dynamicSrc, { requiresJavascript: true, failureCategory: "timeout" }), queryClass: "actor" }),
    buildAdapterFailureObservation({ generatedAt, source: publicChannelSrc, result: run(publicChannelSrc, { canonicalUrl: "https://vendor.example.test/shared" }), profile: profile(publicChannelSrc, { contentType: "application/json", publicChannelHandoff: true }), queryClass: "country", duplicateRate: 0.95 }),
    buildAdapterFailureObservation({ generatedAt, source: pdfSrc, result: run(pdfSrc, { failureCategory: "parser_confidence_low", canonicalUrl: pdfSrc.url }), profile: profile(pdfSrc, { text: "tiny", failureCategory: "parser_confidence_low" }), queryClass: "vendor_report" })
  ];
}
