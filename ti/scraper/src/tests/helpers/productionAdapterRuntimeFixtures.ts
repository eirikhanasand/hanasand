import { replayAdapterCertificationFixtures, type AdapterCertificationFixtureInput, type AdapterCertificationMode } from "../../adapters/adapterCertification.ts";
import { buildAdapterFailureObservatory } from "../../adapters/adapterFailureObservatory.ts";
import { buildAdapterRepairTriagePacket } from "../../adapters/adapterRepairTriage.ts";
import { buildAdapterRuntimeEnablementPacket, type AdapterRuntimeCanarySourceInput } from "../../adapters/adapterRuntimeEnablement.ts";
import { buildAdapterSlaRepairPacket, type AdapterSlaAdapterKind } from "../../adapters/adapterSlaRepair.ts";
import { browserWorkerIsolationPlan } from "../../adapters/browserWorkerIsolation.ts";
import { buildProductionAdapterRuntimeProgram } from "../../adapters/productionAdapterRuntime.ts";
import { selectParserProfile, type ParserProfileDecision } from "../../adapters/parserProfiles.ts";
import type { SourceRecord, SourceType } from "../../types.ts";
import { hashContent } from "../../utils.ts";

export const generatedAt = "2026-05-24T21:00:00.000Z";
const createdAt = new Date(0).toISOString();
const adapters: AdapterSlaAdapterKind[] = ["static_html", "rss_feed", "dynamic_public_browser", "pdf_report", "public_channel_handoff", "advisory_signal", "multilingual_handoff"];
const requiredModes: AdapterCertificationMode[] = ["success"];

export function buildGreenProgram() {
  const sources = buildSources();
  const runtimeEnablement = buildAdapterRuntimeEnablementPacket({ generatedAt, observatory: buildAdapterFailureObservatory({ generatedAt, observations: [] }), browserPlan: browserWorkerIsolationPlan({ enabled: true, maxWorkers: 2, memoryCapMb: 768, timeoutMs: 15_000, allowedHosts: ["dynamic.example.test"], robotsAllowed: true, legalNotes: "Public dynamic legal notes." }), canarySources: sources.map((entry) => canary(entry.source, entry.family, entry.profile)), poolCaps: poolCaps(), thresholds: thresholds() });
  const slaRepair = buildAdapterSlaRepairPacket({ generatedAt, observations: [] });
  const certification = replayAdapterCertificationFixtures({ generatedAt, fixtures: adapters.map(fixture), requiredModes, slaRepairPacket: slaRepair });
  const repairTriage = buildAdapterRepairTriagePacket({ generatedAt, slaRepairPacket: slaRepair, certificationPacket: certification });
  return buildProductionAdapterRuntimeProgram({ generatedAt, runtimeEnablement, certification, slaRepair, repairTriage });
}

function buildSources() {
  const specs = [
    ["src_static", "static_web", "https://vendor.example.test/actor", "static_html"],
    ["src_rss", "rss", "https://feeds.example.test/rss.xml", "rss_feed"],
    ["src_dynamic", "dynamic_web", "https://dynamic.example.test/actor", "dynamic_page", true],
    ["src_pdf", "pdf", "https://reports.example.test/report.pdf", "pdf_report"],
    ["src_channel", "telegram_public", "https://t.me/public_cti", "public_channel"],
    ["src_advisory", "api", "https://advisories.example.test/feed.json", "advisory_signal"]
  ] as const;
  return specs.map(([id, type, url, family, dynamic]) => {
    const src = source(id, type, url);
    return { source: src, family, profile: profile(src, { requiresJavascript: dynamic, contentType: type === "telegram_public" ? "application/json" : undefined, publicChannelHandoff: type === "telegram_public" }) };
  });
}

function source(id: string, type: SourceType, url: string): SourceRecord {
  return { id, name: id.replaceAll("_", " "), type, url, accessMethod: type === "telegram_public" ? "official_api" : "public_http", status: "active", risk: "low", trustScore: 0.88, language: "en", crawlFrequencySeconds: 3600, legalNotes: "Public collection legal notes.", createdAt, updatedAt: createdAt };
}

function profile(src: SourceRecord, options: { contentType?: string; requiresJavascript?: boolean; publicChannelHandoff?: boolean } = {}): ParserProfileDecision {
  return selectParserProfile({ sourceType: src.type, url: src.url, contentType: options.contentType ?? (src.type === "rss" ? "application/rss+xml" : src.type === "pdf" ? "application/pdf" : "text/html"), requiresJavascript: options.requiresJavascript, publicChannelHandoff: options.publicChannelHandoff, textSample: "Public CTI source fixture with actor, campaign, malware, CVE, sector, victim, and mitigation details.", language: "en" });
}

function canary(sourceRecord: SourceRecord, sourceFamily: AdapterRuntimeCanarySourceInput["sourceFamily"], parserProfile: ParserProfileDecision): AdapterRuntimeCanarySourceInput {
  return { source: sourceRecord, sourceFamily, parserProfile, canonicalUrl: sourceRecord.url, robotsAllowed: true, legalNotesPresent: true, maxBytes: 5_000_000, observedContentLengthBytes: 120_000, expectedEvidenceYield: 0.86 };
}

function fixture(adapter: AdapterSlaAdapterKind): AdapterCertificationFixtureInput {
  return { fixtureId: `${adapter}_success`, adapter, mode: "success", sourceId: `src_${adapter}`, url: `https://fixtures.example.test/${adapter}/success?secret=must-not-leak`, objectRef: `s3://ti-fixtures/${adapter}/body.html`, contentHash: `contenthash:${hashContent(adapter).slice(0, 16)}`, parserVersion: "production-adapter-runtime-v1", parserConfidence: 0.9, extractionStats: { bytesRead: 1800, bytesAllowed: 10_000, textLength: 1000, linkCount: 4, citationSpanCount: 2, warningCount: 0 }, publishedAt: "2026-05-24T12:00:00.000Z", collectedAt: "2026-05-24T20:55:00.000Z", language: { declared: "en", detected: "en", confidence: 0.92 }, explicitBoundedDynamic: adapter === "dynamic_public_browser" };
}

const poolCaps = () => ({ staticMaxWorkers: 32, rssMaxWorkers: 24, dynamicMaxWorkers: 2, pdfMaxWorkers: 4, publicChannelMaxWorkers: 4, advisoryMaxWorkers: 8, memoryCapMb: 1024, timeoutMs: 20_000, maxBytes: 5_000_000 });
const thresholds = () => ({ staticMinParserConfidence: 0.65, rssMinParserConfidence: 0.65, dynamicMinParserConfidence: 0.72, pdfMinParserConfidence: 0.72, publicChannelMinParserConfidence: 0.65, advisoryMinParserConfidence: 0.65, maxWatchFailureRatio: 0.35, maxBlockedFailureRatio: 0.05, minEvidenceYield: 0.5 });
