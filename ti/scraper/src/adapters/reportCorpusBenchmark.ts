import { agent07ExtractionHandoff, selectParserProfile, type Agent07ExtractionHandoffDto, type ParserFailureCategory, type ParserProfileInput } from "./parserProfiles.ts";
import type { AdapterRunResult, CollectedItem, SourceRecord } from "../types.ts";
import { hashContent, stableId } from "../utils.ts";

export interface ReportCorpusFixture {
  id: string;
  fixtureClass?: ReportCorpusFixtureClass;
  source: SourceRecord;
  profileInput: ParserProfileInput;
  title: string;
  text: string;
  publishedAt?: string;
  expectedLanguage?: string;
  expectedQueryClasses?: ReportCorpusQueryClass[];
  parserWarnings?: string[];
  failureCategory?: ParserFailureCategory;
  pageCount?: number;
  scannedPageCount?: number;
  ocrAvailable?: boolean;
  ocrConfidence?: number;
  expectedCitationSpanCount?: number;
  canonicalUrlHash?: string;
  duplicateCanonicalKey?: string;
  robotsAllowed?: boolean;
  legalNotes?: string;
  contentLengthBytes?: number;
  maxBytes?: number;
}

export type ReportCorpusFixtureClass =
  | "vendor_report"
  | "advisory"
  | "multilingual_report"
  | "malformed_pdf"
  | "scanned_pdf"
  | "unsupported_mime"
  | "stale_report"
  | "duplicate_canonical"
  | "restricted_policy_hold"
  | "dynamic_snapshot"
  | "rss_item";

export type ReportCorpusQueryClass =
  | "actor"
  | "campaign"
  | "malware_tool"
  | "cve"
  | "sector"
  | "country"
  | "victim_company"
  | "ransomware"
  | "infrastructure";

export interface ReportCorpusBenchmarkRow {
  fixtureId: string;
  fixtureClass: ReportCorpusFixtureClass;
  parserProfile: string;
  extractionScore: number;
  confidenceBand: string;
  languageHint?: string;
  languageReadiness: {
    expected?: string;
    detected?: string;
    status: "pass" | "review" | "missing";
  };
  citationSpanCount: number;
  citationSpanCoverage: number;
  warningCount: number;
  stalePublication: boolean;
  mediaReadiness: {
    contentType?: string;
    supported: boolean;
    status: "supported" | "unsupported" | "malformed" | "policy_hold";
    blockers: string[];
  };
  provenanceContract: {
    sourceId: string;
    taskId: string;
    canonicalUrlHash: string;
    contentHash: string;
    fetchedAt: string;
    publishedAt?: string;
    robotsAllowed: boolean;
    legalNotesPresent: boolean;
    duplicateCanonicalKey?: string;
    collectedItemCompatible: true;
    preservedFields: string[];
  };
  extractionReadiness: {
    status: "pass" | "watch" | "hold";
    queryClasses: ReportCorpusQueryClass[];
    blockers: string[];
    warnings: string[];
    handoffs: {
      agent03Adapter: "certify_fixture" | "repair_parser" | "add_fixture" | "block_promotion";
      agent06Evidence: "capture_replay_ready" | "hold_capture_replay";
      agent07Quality: "accept" | "review" | "block";
      agent09Api: "safe_to_surface" | "surface_partial" | "hold_route_output";
      agent10Release: "green" | "watch" | "hold";
    };
  };
  ocrReadiness: {
    required: boolean;
    status: "not_required" | "ready" | "needs_ocr" | "blocked";
    textLayer: "present" | "thin" | "missing";
    pageCount?: number;
    scannedPageCount: number;
    ocrAvailable: boolean;
    ocrConfidence?: number;
    blockers: string[];
    warnings: string[];
    handoffs: {
      agent03Adapter: "no_action" | "add_ocr_fixture" | "block_pdf_promotion";
      agent06Evidence: "retain_text_layer_metadata" | "retain_ocr_metadata_only" | "hold_capture_replay";
      agent07Quality: "accept" | "review_ocr" | "block_low_ocr_confidence";
      agent10Release: "green" | "watch" | "hold";
    };
  };
  handoffQuality: "pass" | "warn" | "fail";
  handoff: Agent07ExtractionHandoffDto;
}

export interface ReportCorpusBenchmarkReport {
  schemaVersion: "ti.report_corpus_benchmark.v1";
  rows: ReportCorpusBenchmarkRow[];
  summary: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
    averageScore: number;
    ocrReady: number;
    ocrNeedsReview: number;
    ocrBlocked: number;
    citationSpanCoverage: number;
    extractionReady: number;
    extractionWatch: number;
    extractionHold: number;
    unsupportedMedia: number;
    staleReports: number;
    duplicateCanonicalReports: number;
    languageReview: number;
  };
  fixtureCoverage: Record<ReportCorpusFixtureClass, number>;
  routeContract: {
    safeForPublicApi: true;
    stableFields: string[];
    forbiddenFields: string[];
  };
  safety: {
    publicOnly: true;
    rawTextExposed: false;
    unsafeUrlExposed: false;
    objectKeyExposed: false;
    ocrVendorCoupling: false;
  };
}

export function runReportCorpusBenchmark(fixtures: ReportCorpusFixture[], now: string): ReportCorpusBenchmarkReport {
  const rows = fixtures.map((fixture) => benchmarkFixture(fixture, now));
  const pass = rows.filter((row) => row.handoffQuality === "pass").length;
  const warn = rows.filter((row) => row.handoffQuality === "warn").length;
  const fail = rows.filter((row) => row.handoffQuality === "fail").length;
  const averageScore = rows.length ? rows.reduce((total, row) => total + row.extractionScore, 0) / rows.length : 0;
  const citationSpanCoverage = rows.length ? rows.filter((row) => row.citationSpanCount > 0).length / rows.length : 0;
  return {
    schemaVersion: "ti.report_corpus_benchmark.v1",
    rows,
    summary: {
      total: rows.length,
      pass,
      warn,
      fail,
      averageScore: Number(averageScore.toFixed(3)),
      ocrReady: rows.filter((row) => row.ocrReadiness.status === "ready" || row.ocrReadiness.status === "not_required").length,
      ocrNeedsReview: rows.filter((row) => row.ocrReadiness.status === "needs_ocr").length,
      ocrBlocked: rows.filter((row) => row.ocrReadiness.status === "blocked").length,
      citationSpanCoverage: Number(citationSpanCoverage.toFixed(3)),
      extractionReady: rows.filter((row) => row.extractionReadiness.status === "pass").length,
      extractionWatch: rows.filter((row) => row.extractionReadiness.status === "watch").length,
      extractionHold: rows.filter((row) => row.extractionReadiness.status === "hold").length,
      unsupportedMedia: rows.filter((row) => row.mediaReadiness.status === "unsupported").length,
      staleReports: rows.filter((row) => row.stalePublication).length,
      duplicateCanonicalReports: rows.filter((row) => Boolean(row.provenanceContract.duplicateCanonicalKey)).length,
      languageReview: rows.filter((row) => row.languageReadiness.status === "review" || row.languageReadiness.status === "missing").length
    },
    fixtureCoverage: fixtureCoverageFor(rows),
    routeContract: {
      safeForPublicApi: true,
      stableFields: ["schemaVersion", "rows", "summary", "fixtureCoverage", "routeContract", "safety"],
      forbiddenFields: ["url", "canonicalUrl", "rawUrl", "unsafeUrl", "rawText", "html", "body", "payload", "objectRef", "objectKey", "screenshotBytes", "ocrVendor", "apiKey", "credential", "cookie", "token", "privateInvite", "onionUrl"]
    },
    safety: {
      publicOnly: true,
      rawTextExposed: false,
      unsafeUrlExposed: false,
      objectKeyExposed: false,
      ocrVendorCoupling: false
    }
  };
}

function benchmarkFixture(fixture: ReportCorpusFixture, now: string): ReportCorpusBenchmarkRow {
  const profile = selectParserProfile({
    ...fixture.profileInput,
    textSample: fixture.text,
    language: fixture.profileInput.language ?? fixture.expectedLanguage,
    parserWarnings: fixture.parserWarnings,
    failureCategory: fixture.failureCategory ?? fixture.profileInput.failureCategory,
    contentLengthBytes: fixture.contentLengthBytes ?? fixture.profileInput.contentLengthBytes,
    maxBytes: fixture.maxBytes ?? fixture.profileInput.maxBytes
  });
  const collected: CollectedItem = {
    sourceId: fixture.source.id,
    taskId: `benchmark_${fixture.id}`,
    url: fixture.source.url,
    collectedAt: now,
    publishedAt: fixture.publishedAt,
    title: fixture.title,
    rawText: fixture.text,
    contentHash: hashContent(fixture.text),
    language: profile.languageHint,
    links: [],
    sensitive: false,
    metadata: {
      citationSpans: citationSpans(fixture.text),
      parserWarnings: fixture.parserWarnings ?? []
    }
  };
  const result: AdapterRunResult = { items: [collected], discovered: [], warnings: [], metadata: {} };
  const handoff = agent07ExtractionHandoff({ source: fixture.source, result, profile, failureCategory: fixture.failureCategory });
  const safeHandoff: Agent07ExtractionHandoffDto = {
    ...handoff,
    canonicalUrl: undefined,
    safeSummary: undefined,
    forbiddenFields: [...handoff.forbiddenFields, "url", "canonicalUrl", "unsafeUrl", "objectKey", "ocrVendor", "apiKey"]
  };
  const stalePublication = fixture.publishedAt ? Date.parse(now) - Date.parse(fixture.publishedAt) > 180 * 24 * 60 * 60 * 1000 : true;
  const ocrReadiness = ocrReadinessFor(fixture, safeHandoff);
  const fixtureClass = fixture.fixtureClass ?? inferFixtureClass(fixture, now);
  const expectedCitationSpanCount = fixture.expectedCitationSpanCount ?? 1;
  const citationSpanCoverage = expectedCitationSpanCount > 0
    ? Math.min(1, safeHandoff.citationSpans.length / expectedCitationSpanCount)
    : 1;
  const languageReadiness = languageReadinessFor(fixture, profile.languageHint);
  const mediaReadiness = mediaReadinessFor(fixture);
  const provenanceContract = provenanceContractFor(fixture, collected, now);
  const extractionReadiness = extractionReadinessFor({
    fixture,
    fixtureClass,
    handoff: safeHandoff,
    stalePublication,
    ocrReadiness,
    citationSpanCoverage,
    languageReadiness,
    mediaReadiness
  });
  const handoffQuality = qualityFor(safeHandoff, stalePublication, ocrReadiness);
  return {
    fixtureId: fixture.id,
    fixtureClass,
    parserProfile: profile.profile,
    extractionScore: profile.extractionScore,
    confidenceBand: profile.extractionConfidenceBand,
    languageHint: profile.languageHint,
    languageReadiness,
    citationSpanCount: handoff.citationSpans.length,
    citationSpanCoverage,
    warningCount: handoff.parserWarnings.length,
    stalePublication,
    mediaReadiness,
    provenanceContract,
    extractionReadiness,
    ocrReadiness,
    handoffQuality,
    handoff: safeHandoff
  };
}

function fixtureCoverageFor(rows: ReportCorpusBenchmarkRow[]): Record<ReportCorpusFixtureClass, number> {
  const coverage = {
    vendor_report: 0,
    advisory: 0,
    multilingual_report: 0,
    malformed_pdf: 0,
    scanned_pdf: 0,
    unsupported_mime: 0,
    stale_report: 0,
    duplicate_canonical: 0,
    restricted_policy_hold: 0,
    dynamic_snapshot: 0,
    rss_item: 0
  } satisfies Record<ReportCorpusFixtureClass, number>;
  for (const row of rows) coverage[row.fixtureClass] += 1;
  return coverage;
}

function citationSpans(text: string): Array<{ start: number; end: number; label: string }> {
  if (!text.trim()) return [];
  return [{ start: 0, end: Math.min(140, text.length), label: "benchmark_excerpt" }];
}

function qualityFor(
  handoff: Agent07ExtractionHandoffDto,
  stalePublication: boolean,
  ocrReadiness: ReportCorpusBenchmarkRow["ocrReadiness"]
): ReportCorpusBenchmarkRow["handoffQuality"] {
  if (handoff.extractionConfidenceBand === "blocked" || handoff.extractionConfidenceBand === "low" || handoff.citationSpans.length === 0) return "fail";
  if (ocrReadiness.status === "blocked") return "fail";
  if (ocrReadiness.status === "needs_ocr") return "warn";
  if (handoff.parserWarnings.length > 1 || stalePublication || handoff.extractionConfidenceBand === "medium") return "warn";
  return "pass";
}

function inferFixtureClass(fixture: ReportCorpusFixture, now: string): ReportCorpusFixtureClass {
  const contentType = normalizedContentType(fixture);
  if (fixture.failureCategory === "policy_hold" || fixture.profileInput.failureCategory === "policy_hold" || fixture.robotsAllowed === false) return "restricted_policy_hold";
  if (fixture.duplicateCanonicalKey) return "duplicate_canonical";
  if (fixture.publishedAt && Date.parse(now) - Date.parse(fixture.publishedAt) > 180 * 24 * 60 * 60 * 1000) return "stale_report";
  if (contentType && !supportedContentTypes().has(contentType)) return "unsupported_mime";
  if (fixture.profileInput.sourceType === "pdf" && (fixture.text.trim().length === 0 || fixture.parserWarnings?.some((warning) => /malformed|xref|encrypted/i.test(warning)))) return "malformed_pdf";
  if (fixture.profileInput.sourceType === "pdf" && (fixture.scannedPageCount ?? 0) > 0) return "scanned_pdf";
  if (fixture.expectedLanguage && fixture.expectedLanguage !== "en") return "multilingual_report";
  if (fixture.profileInput.sourceType === "dynamic_web" || fixture.profileInput.requiresJavascript) return "dynamic_snapshot";
  if (fixture.profileInput.sourceType === "rss") return "rss_item";
  if (/cve|advisory|cert/i.test(`${fixture.title} ${fixture.text}`)) return "advisory";
  return "vendor_report";
}

function languageReadinessFor(fixture: ReportCorpusFixture, detected: string | undefined): ReportCorpusBenchmarkRow["languageReadiness"] {
  const expected = fixture.expectedLanguage ?? fixture.profileInput.language;
  if (!expected) return { expected, detected, status: detected ? "pass" : "missing" };
  if (!detected) return { expected, detected, status: "missing" };
  return { expected, detected, status: detected === expected ? "pass" : "review" };
}

function mediaReadinessFor(fixture: ReportCorpusFixture): ReportCorpusBenchmarkRow["mediaReadiness"] {
  const contentType = normalizedContentType(fixture);
  const blockers = [
    ...(contentType && !supportedContentTypes().has(contentType) ? [`unsupported_media:${contentType}`] : []),
    ...((fixture.parserWarnings ?? []).some((warning) => /malformed|xref|encrypted/i.test(warning)) ? ["malformed_report_parser_warning"] : []),
    ...(fixture.failureCategory === "policy_hold" || fixture.profileInput.failureCategory === "policy_hold" || fixture.robotsAllowed === false ? ["policy_or_robots_hold"] : [])
  ];
  const status: ReportCorpusBenchmarkRow["mediaReadiness"]["status"] = blockers.some((blocker) => blocker.startsWith("unsupported_media"))
    ? "unsupported"
    : blockers.includes("policy_or_robots_hold")
      ? "policy_hold"
      : blockers.includes("malformed_report_parser_warning")
        ? "malformed"
        : "supported";
  return {
    contentType,
    supported: status === "supported",
    status,
    blockers
  };
}

function provenanceContractFor(fixture: ReportCorpusFixture, collected: CollectedItem, now: string): ReportCorpusBenchmarkRow["provenanceContract"] {
  return {
    sourceId: fixture.source.id,
    taskId: collected.taskId ?? stableId("report-corpus-task", `${fixture.id}:${fixture.source.id}`),
    canonicalUrlHash: fixture.canonicalUrlHash ?? hashContent(fixture.source.url),
    contentHash: collected.contentHash,
    fetchedAt: now,
    publishedAt: fixture.publishedAt,
    robotsAllowed: fixture.robotsAllowed ?? true,
    legalNotesPresent: Boolean(fixture.legalNotes ?? fixture.source.legalNotes),
    duplicateCanonicalKey: fixture.duplicateCanonicalKey,
    collectedItemCompatible: true,
    preservedFields: ["sourceId", "taskId", "canonicalUrlHash", "contentHash", "fetchedAt", "publishedAt", "language", "parserConfidence", "citationSpans", "robotsAllowed", "legalNotesPresent"]
  };
}

function extractionReadinessFor(input: {
  fixture: ReportCorpusFixture;
  fixtureClass: ReportCorpusFixtureClass;
  handoff: Agent07ExtractionHandoffDto;
  stalePublication: boolean;
  ocrReadiness: ReportCorpusBenchmarkRow["ocrReadiness"];
  citationSpanCoverage: number;
  languageReadiness: ReportCorpusBenchmarkRow["languageReadiness"];
  mediaReadiness: ReportCorpusBenchmarkRow["mediaReadiness"];
}): ReportCorpusBenchmarkRow["extractionReadiness"] {
  const blockers = [
    ...(input.handoff.extractionConfidenceBand === "blocked" || input.handoff.extractionConfidenceBand === "low" ? ["parser_confidence_not_ready"] : []),
    ...(input.handoff.citationSpans.length === 0 ? ["missing_citation_spans"] : []),
    ...(input.ocrReadiness.status === "blocked" ? input.ocrReadiness.blockers : []),
    ...(input.mediaReadiness.status === "unsupported" || input.mediaReadiness.status === "malformed" || input.mediaReadiness.status === "policy_hold" ? input.mediaReadiness.blockers : []),
    ...(input.fixture.duplicateCanonicalKey ? ["duplicate_canonical_report"] : [])
  ];
  const warnings = [
    ...(input.stalePublication ? ["stale_publication"] : []),
    ...(input.ocrReadiness.status === "needs_ocr" ? input.ocrReadiness.warnings : []),
    ...(input.citationSpanCoverage < 1 && input.handoff.citationSpans.length > 0 ? ["citation_span_coverage_below_expected"] : []),
    ...(input.languageReadiness.status === "review" ? ["language_detection_mismatch"] : []),
    ...(input.languageReadiness.status === "missing" ? ["language_detection_missing"] : []),
    ...(input.handoff.parserWarnings.length > 0 ? ["parser_warnings_present"] : [])
  ];
  const status = blockers.length > 0 ? "hold" : warnings.length > 0 || input.handoff.extractionConfidenceBand === "medium" ? "watch" : "pass";
  return {
    status,
    queryClasses: input.fixture.expectedQueryClasses ?? queryClassesFor(input.fixture),
    blockers,
    warnings,
    handoffs: {
      agent03Adapter: status === "hold" ? "block_promotion" : status === "watch" ? "repair_parser" : "certify_fixture",
      agent06Evidence: status === "hold" ? "hold_capture_replay" : "capture_replay_ready",
      agent07Quality: status === "hold" ? "block" : status === "watch" ? "review" : "accept",
      agent09Api: status === "hold" ? "hold_route_output" : status === "watch" ? "surface_partial" : "safe_to_surface",
      agent10Release: status === "hold" ? "hold" : status === "watch" ? "watch" : "green"
    }
  };
}

function queryClassesFor(fixture: ReportCorpusFixture): ReportCorpusQueryClass[] {
  const text = `${fixture.title} ${fixture.text}`.toLowerCase();
  const classes: ReportCorpusQueryClass[] = [];
  if (/apt|actor|lazarus|sandworm|volt typhoon/.test(text)) classes.push("actor");
  if (/campaign|operation/.test(text)) classes.push("campaign");
  if (/malware|tool|ransomware|akira|lockbit/.test(text)) classes.push(/ransomware|akira|lockbit/.test(text) ? "ransomware" : "malware_tool");
  if (/cve-\d{4}-\d+/i.test(text)) classes.push("cve");
  if (/sector|energy|finance|healthcare/.test(text)) classes.push("sector");
  if (/country|china|russia|iran|norway/.test(text)) classes.push("country");
  if (/victim|company|organization/.test(text)) classes.push("victim_company");
  if (/infrastructure|domain|ip address|server/.test(text)) classes.push("infrastructure");
  return classes.length > 0 ? [...new Set(classes)] : ["actor"];
}

function normalizedContentType(fixture: ReportCorpusFixture): string | undefined {
  return fixture.profileInput.contentType?.split(";")[0]?.trim().toLowerCase();
}

function supportedContentTypes(): Set<string> {
  return new Set(["application/pdf", "text/html", "application/xhtml+xml", "text/plain", "application/rss+xml", "application/atom+xml", "application/xml", "text/xml"]);
}

function ocrReadinessFor(fixture: ReportCorpusFixture, handoff: Agent07ExtractionHandoffDto): ReportCorpusBenchmarkRow["ocrReadiness"] {
  const pageCount = fixture.pageCount;
  const scannedPageCount = fixture.scannedPageCount ?? 0;
  const textLength = fixture.text.trim().length;
  const expectedCitationSpanCount = fixture.expectedCitationSpanCount ?? 1;
  const textLayer = textLength >= 120 ? "present" : textLength > 0 ? "thin" : "missing";
  const required = fixture.profileInput.contentType?.split(";")[0]?.trim().toLowerCase() === "application/pdf" && (scannedPageCount > 0 || textLayer !== "present");
  const ocrAvailable = fixture.ocrAvailable ?? false;
  const ocrConfidence = fixture.ocrConfidence;
  const blockers = [
    ...(required && !ocrAvailable && textLayer === "missing" ? ["missing_text_layer_without_ocr"] : []),
    ...(required && ocrAvailable && typeof ocrConfidence === "number" && ocrConfidence < 0.5 ? ["ocr_confidence_below_hold_threshold"] : []),
    ...(required && handoff.citationSpans.length < expectedCitationSpanCount && textLayer === "missing" ? ["citation_spans_unavailable_for_scanned_report"] : [])
  ];
  const warnings = [
    ...(required && !ocrAvailable && textLayer === "thin" ? ["thin_text_layer_needs_ocr_fixture"] : []),
    ...(required && ocrAvailable && typeof ocrConfidence === "number" && ocrConfidence < 0.7 && ocrConfidence >= 0.5 ? ["ocr_confidence_below_target"] : []),
    ...(required && handoff.citationSpans.length < expectedCitationSpanCount && textLayer !== "missing" ? ["citation_span_count_below_expected"] : [])
  ];
  const status = !required
    ? "not_required"
    : blockers.length > 0
      ? "blocked"
      : warnings.length > 0 || !ocrAvailable
        ? "needs_ocr"
        : "ready";

  return {
    required,
    status,
    textLayer,
    pageCount,
    scannedPageCount,
    ocrAvailable,
    ocrConfidence,
    blockers,
    warnings,
    handoffs: {
      agent03Adapter: status === "blocked" ? "block_pdf_promotion" : status === "needs_ocr" ? "add_ocr_fixture" : "no_action",
      agent06Evidence: status === "blocked" ? "hold_capture_replay" : required ? "retain_ocr_metadata_only" : "retain_text_layer_metadata",
      agent07Quality: status === "blocked" ? "block_low_ocr_confidence" : status === "needs_ocr" ? "review_ocr" : "accept",
      agent10Release: status === "blocked" ? "hold" : status === "needs_ocr" ? "watch" : "green"
    }
  };
}
