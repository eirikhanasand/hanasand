import type { AdapterFailureClass, AdapterObservatoryQueryClass } from "../../adapters/adapterFailureObservatory.ts";
import type { ParserFailureCategory, ParserProfileDecision } from "../../adapters/parserProfiles.ts";
import type { AdapterRunResult, SourceRecord } from "../../types.ts";
import { profile, result, source } from "./adapterFailureFixtures.ts";

export interface FailureCase {
  label: string;
  queryClass: AdapterObservatoryQueryClass;
  source: SourceRecord;
  run: AdapterRunResult;
  profile: ParserProfileDecision;
  expected: AdapterFailureClass;
  retryAfterSeconds?: number;
  staleDate?: string;
  duplicateRate?: number;
  noiseRate?: number;
  contentType?: string;
  contentLengthBytes?: number;
  maxBytes?: number;
}

export function failureCases(): FailureCase[] {
  const cases: FailureCase[] = [];
  add(cases, "APT29 vendor HTML", "actor", "src_apt29_vendor_static", "static_web", "https://vendor.example.test/research/apt29", "ok", { text: "APT29 campaign report with observed infrastructure, malware, CVEs, and defensive guidance." });
  add(cases, "APT42 dynamic timeout", "actor", "src_apt42_dynamic", "dynamic_web", "https://vendor.example.test/research/apt42", "timeout", { failureCategory: "timeout", requiresJavascript: true });
  add(cases, "ransomware feed stale", "ransomware", "src_ransomware_rss", "rss", "https://ransom.example.test/feed.xml", "stale_source", { staleDate: "2026-04-01T00:00:00.000Z" });
  add(cases, "CVE advisory rate-limited", "cve", "src_cve_advisory", "api", "https://advisories.example.test/cve-2026-1000.json", "rate_limited", { retryAfterSeconds: 180, contentType: "application/json" });
  add(cases, "malware/tool unsupported media", "malware_tool", "src_malware_tool_zip", "static_web", "https://tools.example.test/downloads/tool.zip", "unsupported_media", { contentType: "application/zip" });
  add(cases, "country public channel handoff parser gap", "country", "src_country_public_channel", "telegram_public", "https://t.me/public_country_cti", "parser_gap", { warning: "parser gap: country/sector channel schema missing", contentType: "application/json", publicChannelHandoff: true, parserWarnings: ["parser gap: normalized public channel fields missing"] });
  add(cases, "sector public channel duplicate canonical", "sector", "src_sector_public_channel", "telegram_public", "https://t.me/public_sector_cti", "duplicate_canonical", { contentType: "application/json", publicChannelHandoff: true, duplicateRate: 0.9, canonicalUrl: "https://vendor.example.test/shared-report" });
  add(cases, "vendor report content too large", "vendor_report", "src_vendor_report_pdf", "pdf", "https://vendor.example.test/reports/long.pdf", "content_too_large", { contentType: "application/pdf", contentLengthBytes: 5_000_001, maxBytes: 5_000_000 });
  add(cases, "CERT advisory robots hold", "cert_advisory", "src_cert_policy_hold", "static_web", "https://cert.example.test/advisories/ta26-001", "robots_policy_hold", { failureCategory: "robots_policy_hold", metadata: { robotsReviewState: "hold" } });
  add(cases, "unavailable source", "vendor_report", "src_unavailable_vendor", "static_web", "https://vendor.example.test/unavailable", "unavailable", { failureCategory: "unavailable" });
  add(cases, "source disabled", "vendor_report", "src_disabled_vendor", "static_web", "https://vendor.example.test/disabled", "source_disabled", { status: "disabled" });
  add(cases, "empty capture", "unknown", "src_empty_static", "static_web", "https://vendor.example.test/empty", "empty_capture", { failureCategory: "unknown_new_failure" });
  add(cases, "noisy RSS", "ransomware", "src_noisy_feed", "rss", "https://news.example.test/noisy.xml", "noisy_source", { noiseRate: 0.8 });
  add(cases, "parser confidence low", "actor", "src_low_confidence", "static_web", "https://vendor.example.test/low-confidence", "parser_confidence_low", { text: "tiny", failureCategory: "parser_confidence_low" });
  return cases;
}

function add(cases: FailureCase[], label: string, queryClass: AdapterObservatoryQueryClass, id: string, type: SourceRecord["type"], url: string, expected: AdapterFailureClass, options: Record<string, unknown> = {}) {
  const src = source({ id, type, url, status: options.status as SourceRecord["status"], metadata: options.metadata as Record<string, unknown> | undefined });
  cases.push({ label, queryClass, source: src, expected, run: result(src, { text: options.text as string | undefined, warning: options.warning as string | undefined, failureCategory: options.failureCategory as ParserFailureCategory | undefined, canonicalUrl: (options.canonicalUrl as string | undefined) ?? url }), profile: profile(src, { contentType: options.contentType as string | undefined, text: options.text as string | undefined, requiresJavascript: options.requiresJavascript as boolean | undefined, publicChannelHandoff: options.publicChannelHandoff as boolean | undefined, parserWarnings: options.parserWarnings as string[] | undefined, failureCategory: options.failureCategory as ParserFailureCategory | undefined }), retryAfterSeconds: options.retryAfterSeconds as number | undefined, staleDate: options.staleDate as string | undefined, duplicateRate: options.duplicateRate as number | undefined, noiseRate: options.noiseRate as number | undefined, contentType: options.contentType as string | undefined, contentLengthBytes: options.contentLengthBytes as number | undefined, maxBytes: options.maxBytes as number | undefined });
}
