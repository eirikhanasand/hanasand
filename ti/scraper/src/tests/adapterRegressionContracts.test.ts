import { describe, expect, test } from "bun:test";
import { browserWorkerCaptureContract, browserWorkerIsolationPlan } from "../adapters/browserWorkerIsolation.ts";
import { runReportCorpusBenchmark, type ReportCorpusFixture } from "../adapters/reportCorpusBenchmark.ts";
import { evaluateSourceFreshnessRegression } from "../adapters/sourceFreshnessRegression.ts";
import { selectParserProfile } from "../adapters/parserProfiles.ts";
import type { AdapterRunResult, CollectedItem, SourceRecord, SourceType } from "../types.ts";
import { hashContent } from "../utils.ts";

const createdAt = new Date(0).toISOString();

function source(id: string, type: SourceType, url: string, trustScore = 0.84): SourceRecord {
  return {
    id,
    name: id,
    type,
    url,
    accessMethod: type === "telegram_public" ? "official_api" : "public_http",
    status: "active",
    risk: "low",
    trustScore,
    language: "en",
    crawlFrequencySeconds: 3600,
    legalNotes: "Public source fixture.",
    createdAt,
    updatedAt: createdAt
  };
}

function collected(src: SourceRecord, text: string, publishedAt = "2026-05-24T00:00:00.000Z"): CollectedItem {
  return {
    sourceId: src.id,
    taskId: `task_${src.id}`,
    url: src.url,
    collectedAt: "2026-05-24T12:00:00.000Z",
    publishedAt,
    title: src.name,
    rawText: text,
    contentHash: hashContent(text),
    language: "en",
    links: [],
    metadata: {},
    sensitive: false
  };
}

describe("adapter regression contracts", () => {
  test("classifies stale feeds broken parsers empty captures noisy duplicates and disabled sources", () => {
    const src = source("src_stale_rss", "rss", "https://feeds.example.test/rss.xml");
    const profile = selectParserProfile({
      sourceType: "rss",
      url: src.url,
      contentType: "application/rss+xml",
      textSample: "short",
      parserWarnings: ["parser emitted empty body"]
    });
    const staleResult: AdapterRunResult = {
      items: [collected(src, "CVE and actor mention from an old feed", "2025-01-01T00:00:00.000Z")],
      discovered: [],
      warnings: ["parser emitted empty body"],
      metadata: {}
    };
    const stale = evaluateSourceFreshnessRegression({
      source: src,
      result: staleResult,
      profile,
      now: "2026-05-24T00:00:00.000Z",
      freshnessTargetSeconds: 7 * 24 * 60 * 60,
      duplicateRate: 0.2,
      noiseRate: 0.6
    });
    expect(stale).toMatchObject({
      status: "review",
      recommendedAction: "move_to_review"
    });
    expect(stale.findings).toEqual(expect.arrayContaining(["stale_feed", "broken_parser_profile", "noisy_source"]));

    const emptyDuplicate = evaluateSourceFreshnessRegression({
      source: src,
      result: { items: [], discovered: [], warnings: [], metadata: {} },
      profile,
      now: "2026-05-24T00:00:00.000Z",
      freshnessTargetSeconds: 3600,
      duplicateRate: 0.9,
      noiseRate: 0.1
    });
    expect(emptyDuplicate).toMatchObject({ status: "disable", recommendedAction: "disable_source" });
    expect(emptyDuplicate.findings).toEqual(expect.arrayContaining(["empty_capture", "duplicate_heavy"]));
  });

  test("keeps browser worker isolation disabled by default with hash-only dynamic capture contracts", () => {
    const plan = browserWorkerIsolationPlan({
      enabled: true,
      maxWorkers: 2,
      memoryCapMb: 1024,
      timeoutMs: 30000,
      allowedHosts: ["reports.example.test"],
      robotsAllowed: true,
      legalNotes: "Public report rendering approved."
    });
    expect(plan).toMatchObject({
      enabled: false,
      networkIsolation: {
        publicOnly: true,
        blockPrivateNetworks: true,
        blockCredentials: true,
        blockCaptchaSolving: true,
        blockDownloads: true
      }
    });
    const capture = browserWorkerCaptureContract(plan, {
      url: "https://reports.example.test/js/apt42",
      finalUrl: "https://reports.example.test/js/apt42",
      contentType: "text/html",
      text: "APT42 dynamic report text",
      html: "<main>APT42 dynamic report text</main>",
      screenshotBytes: new TextEncoder().encode("fake screenshot")
    });
    expect(capture).toMatchObject({
      status: "ready",
      extractionStatus: "ready_for_extraction"
    });
    expect(capture.screenshotHash).toBeDefined();
    expect(JSON.stringify(capture)).not.toContain("fake screenshot");

    const robotsHold = browserWorkerCaptureContract({ ...plan, policy: { ...plan.policy, robotsAllowed: false } }, {
      url: "https://reports.example.test/js/apt42"
    });
    expect(robotsHold).toMatchObject({ status: "blocked", failureCategory: "robots_policy_hold" });
  });

  test("benchmarks public report corpus fixtures across HTML RSS PDF advisory and dynamic snapshots", () => {
    const fixtures: ReportCorpusFixture[] = [
      {
        id: "apt29_pdf",
        source: source("src_bench_apt29_pdf", "pdf", "https://vendor.example.test/apt29.pdf", 0.92),
        profileInput: { sourceType: "pdf", url: "https://vendor.example.test/apt29.pdf", contentType: "application/pdf" },
        title: "APT29 PDF report",
        text: "APT29 malware and CVE-2026-2929 indicators are documented with government victim context.",
        publishedAt: "2026-05-20T00:00:00.000Z",
        pageCount: 12,
        scannedPageCount: 0,
        ocrAvailable: true,
        ocrConfidence: 0.91
      },
      {
        id: "apt42_dynamic",
        source: source("src_bench_apt42_dynamic", "dynamic_web", "https://vendor.example.test/apt42"),
        profileInput: { sourceType: "dynamic_web", url: "https://vendor.example.test/apt42", contentType: "text/html", requiresJavascript: true },
        title: "APT42 dynamic snapshot",
        text: "APT42 phishing infrastructure and malware lures were observed against civil society victims.",
        publishedAt: "2026-05-19T00:00:00.000Z"
      },
      {
        id: "rss_ransomware",
        source: source("src_bench_rss", "rss", "https://news.example.test/feed.xml"),
        profileInput: { sourceType: "rss", url: "https://news.example.test/feed.xml", contentType: "application/rss+xml" },
        title: "Ransomware RSS item",
        text: "Akira ransomware victim claim is summarized with timestamped public-source provenance.",
        publishedAt: "2026-05-18T00:00:00.000Z"
      },
      {
        id: "cert_cve",
        source: source("src_bench_cert", "static_web", "https://cert.example.test/cve-2024-3094"),
        profileInput: { sourceType: "static_web", url: "https://cert.example.test/cve-2024-3094", contentType: "text/html" },
        title: "CERT CVE advisory",
        text: "CERT advisory for CVE-2024-3094 describes affected versions, exploitation risk, and mitigations.",
        publishedAt: "2026-05-17T00:00:00.000Z"
      }
    ];
    const report = runReportCorpusBenchmark(fixtures, "2026-05-24T00:00:00.000Z");
    expect(report).toMatchObject({
      schemaVersion: "ti.report_corpus_benchmark.v1",
      summary: { total: 4, fail: 0 }
    });
    expect(report.summary.averageScore).toBeGreaterThan(0.7);
    expect(report.rows.map((row) => row.parserProfile)).toEqual(["pdf_report", "dynamic_page", "rss_entry", "static_html"]);
    expect(report.summary).toMatchObject({
      ocrReady: 4,
      ocrNeedsReview: 0,
      ocrBlocked: 0,
      citationSpanCoverage: 1
    });
    expect(report.rows.find((row) => row.fixtureId === "apt29_pdf")?.ocrReadiness).toMatchObject({
      required: true,
      status: "ready",
      textLayer: "thin",
      handoffs: {
        agent07Quality: "accept",
        agent10Release: "green"
      }
    });
    expect(report.rows.every((row) => row.handoff.redactionSafe)).toBe(true);
    expect(report.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["rawText", "objectKey", "ocrVendor", "apiKey"]));
    expect(report.safety).toMatchObject({
      publicOnly: true,
      rawTextExposed: false,
      unsafeUrlExposed: false,
      objectKeyExposed: false,
      ocrVendorCoupling: false
    });
  });

  test("gates scanned PDF report fixtures on OCR readiness and citation spans", () => {
    const fixtures: ReportCorpusFixture[] = [
      {
        id: "scanned_pdf_needs_ocr",
        source: source("src_bench_scanned_pdf", "pdf", "https://vendor.example.test/scanned.pdf", 0.82),
        profileInput: { sourceType: "pdf", url: "https://vendor.example.test/scanned.pdf", contentType: "application/pdf" },
        title: "Scanned PDF report",
        text: "APT29",
        publishedAt: "2026-05-20T00:00:00.000Z",
        pageCount: 20,
        scannedPageCount: 18,
        ocrAvailable: false
      },
      {
        id: "scanned_pdf_blocked",
        source: source("src_bench_image_pdf", "pdf", "https://vendor.example.test/image-only.pdf", 0.82),
        profileInput: { sourceType: "pdf", url: "https://vendor.example.test/image-only.pdf", contentType: "application/pdf" },
        title: "Image-only PDF report",
        text: "",
        publishedAt: "2026-05-20T00:00:00.000Z",
        pageCount: 15,
        scannedPageCount: 15,
        ocrAvailable: false,
        expectedCitationSpanCount: 1
      },
      {
        id: "scanned_pdf_low_ocr",
        source: source("src_bench_low_ocr_pdf", "pdf", "https://vendor.example.test/low-ocr.pdf", 0.82),
        profileInput: { sourceType: "pdf", url: "https://vendor.example.test/low-ocr.pdf", contentType: "application/pdf" },
        title: "Low OCR PDF report",
        text: "APT42 phishing report includes indicators from scanned appendix.",
        publishedAt: "2026-05-20T00:00:00.000Z",
        pageCount: 18,
        scannedPageCount: 10,
        ocrAvailable: true,
        ocrConfidence: 0.62
      }
    ];

    const report = runReportCorpusBenchmark(fixtures, "2026-05-24T00:00:00.000Z");
    expect(report.summary).toMatchObject({
      total: 3,
      warn: 2,
      fail: 1,
      ocrReady: 0,
      ocrNeedsReview: 2,
      ocrBlocked: 1
    });
    expect(report.rows.find((row) => row.fixtureId === "scanned_pdf_needs_ocr")?.ocrReadiness).toMatchObject({
      status: "needs_ocr",
      warnings: expect.arrayContaining(["thin_text_layer_needs_ocr_fixture"]),
      handoffs: {
        agent03Adapter: "add_ocr_fixture",
        agent07Quality: "review_ocr",
        agent10Release: "watch"
      }
    });
    expect(report.rows.find((row) => row.fixtureId === "scanned_pdf_blocked")?.ocrReadiness).toMatchObject({
      status: "blocked",
      blockers: expect.arrayContaining(["missing_text_layer_without_ocr", "citation_spans_unavailable_for_scanned_report"]),
      handoffs: {
        agent03Adapter: "block_pdf_promotion",
        agent06Evidence: "hold_capture_replay",
        agent10Release: "hold"
      }
    });
    expect(report.rows.find((row) => row.fixtureId === "scanned_pdf_low_ocr")?.ocrReadiness).toMatchObject({
      status: "needs_ocr",
      warnings: expect.arrayContaining(["ocr_confidence_below_target"])
    });
    expect(report.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["ocrVendor", "apiKey"]));
    const serialized = JSON.stringify(report);
    for (const forbidden of ["https://vendor.example.test/scanned.pdf", "https://vendor.example.test/image-only.pdf"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test("builds Program BB report extraction readiness across malformed unsupported stale duplicate policy and multilingual fixtures", () => {
    const fixtures: ReportCorpusFixture[] = [
      {
        id: "vendor_report_ready",
        fixtureClass: "vendor_report",
        source: source("src_report_vendor", "static_web", "https://vendor.example.test/reports/apt29"),
        profileInput: { sourceType: "static_web", url: "https://vendor.example.test/reports/apt29", contentType: "text/html", language: "en" },
        title: "APT29 vendor report",
        text: "APT29 public report describes malware tooling, infrastructure, and CVE-2026-2929 exploitation against government victims.",
        publishedAt: "2026-05-20T00:00:00.000Z",
        expectedLanguage: "en",
        expectedQueryClasses: ["actor", "malware_tool", "cve", "infrastructure", "victim_company"]
      },
      {
        id: "cert_advisory_ready",
        fixtureClass: "advisory",
        source: source("src_report_cert", "static_web", "https://cert.example.test/advisories/cve-2026-4242"),
        profileInput: { sourceType: "static_web", url: "https://cert.example.test/advisories/cve-2026-4242", contentType: "text/html", language: "en" },
        title: "CERT advisory CVE-2026-4242",
        text: "CERT advisory for CVE-2026-4242 describes exploitation risk, affected versions, mitigations, and energy sector impact.",
        publishedAt: "2026-05-21T00:00:00.000Z",
        expectedLanguage: "en",
        expectedQueryClasses: ["cve", "sector"]
      },
      {
        id: "multilingual_report_review",
        fixtureClass: "multilingual_report",
        source: source("src_report_multilingual", "pdf", "https://vendor.example.test/reports/rapport-apt42.pdf"),
        profileInput: { sourceType: "pdf", url: "https://vendor.example.test/reports/rapport-apt42.pdf", contentType: "application/pdf" },
        title: "APT42 rapport",
        text: "Le rapport APT42 décrit une attaque de phishing contre des victimes gouvernementales.",
        publishedAt: "2026-05-20T00:00:00.000Z",
        expectedLanguage: "fr",
        pageCount: 8,
        scannedPageCount: 0,
        ocrAvailable: true,
        ocrConfidence: 0.88
      },
      {
        id: "malformed_pdf_hold",
        fixtureClass: "malformed_pdf",
        source: source("src_report_malformed", "pdf", "https://vendor.example.test/reports/broken.pdf"),
        profileInput: { sourceType: "pdf", url: "https://vendor.example.test/reports/broken.pdf", contentType: "application/pdf" },
        title: "Malformed PDF report",
        text: "",
        publishedAt: "2026-05-20T00:00:00.000Z",
        parserWarnings: ["malformed xref table"],
        pageCount: 0,
        scannedPageCount: 0,
        ocrAvailable: false
      },
      {
        id: "unsupported_mime_hold",
        fixtureClass: "unsupported_mime",
        source: source("src_report_archive", "pdf", "https://vendor.example.test/reports/archive.zip"),
        profileInput: { sourceType: "pdf", url: "https://vendor.example.test/reports/archive.zip", contentType: "application/zip" },
        title: "Unsupported report archive",
        text: "Archive wrapper is not a parseable public report body.",
        publishedAt: "2026-05-20T00:00:00.000Z"
      },
      {
        id: "stale_report_watch",
        fixtureClass: "stale_report",
        source: source("src_report_stale", "static_web", "https://vendor.example.test/reports/old-campaign"),
        profileInput: { sourceType: "static_web", url: "https://vendor.example.test/reports/old-campaign", contentType: "text/html", language: "en" },
        title: "Old campaign report",
        text: "Old campaign report describes APT29 historical phishing infrastructure and malware tooling.",
        publishedAt: "2025-01-01T00:00:00.000Z"
      },
      {
        id: "duplicate_report_hold",
        fixtureClass: "duplicate_canonical",
        source: source("src_report_duplicate", "static_web", "https://mirror.example.test/reports/apt29-copy"),
        profileInput: { sourceType: "static_web", url: "https://mirror.example.test/reports/apt29-copy", contentType: "text/html", language: "en" },
        title: "APT29 mirrored report",
        text: "APT29 public report duplicate mirror with the same malware tooling and infrastructure claims.",
        publishedAt: "2026-05-20T00:00:00.000Z",
        canonicalUrlHash: "sha256:canonical-apt29-report",
        duplicateCanonicalKey: "canonical-apt29-report"
      },
      {
        id: "policy_hold_report",
        fixtureClass: "restricted_policy_hold",
        source: source("src_report_policy_hold", "static_web", "https://restricted.example.test/reports/private"),
        profileInput: { sourceType: "static_web", url: "https://restricted.example.test/reports/private", contentType: "text/html", failureCategory: "policy_hold" },
        title: "Policy hold report",
        text: "Restricted target metadata is held without raw report extraction.",
        publishedAt: "2026-05-20T00:00:00.000Z",
        failureCategory: "policy_hold",
        robotsAllowed: false,
        legalNotes: "Policy hold fixture."
      }
    ];

    const report = runReportCorpusBenchmark(fixtures, "2026-05-24T00:00:00.000Z");

    expect(report.summary).toMatchObject({
      total: 8,
      extractionReady: 2,
      extractionWatch: 2,
      extractionHold: 4,
      unsupportedMedia: 1,
      staleReports: 1,
      duplicateCanonicalReports: 1,
      languageReview: 1
    });
    expect(report.fixtureCoverage).toMatchObject({
      vendor_report: 1,
      advisory: 1,
      multilingual_report: 1,
      malformed_pdf: 1,
      unsupported_mime: 1,
      stale_report: 1,
      duplicate_canonical: 1,
      restricted_policy_hold: 1
    });
    expect(report.rows.find((row) => row.fixtureId === "vendor_report_ready")?.extractionReadiness).toMatchObject({
      status: "pass",
      queryClasses: ["actor", "malware_tool", "cve", "infrastructure", "victim_company"],
      handoffs: {
        agent03Adapter: "certify_fixture",
        agent09Api: "safe_to_surface",
        agent10Release: "green"
      }
    });
    expect(report.rows.find((row) => row.fixtureId === "multilingual_report_review")?.extractionReadiness).toMatchObject({
      status: "pass",
      handoffs: {
        agent03Adapter: "certify_fixture",
        agent07Quality: "accept"
      }
    });
    expect(report.rows.find((row) => row.fixtureId === "malformed_pdf_hold")?.mediaReadiness).toMatchObject({
      status: "malformed",
      blockers: expect.arrayContaining(["malformed_report_parser_warning"])
    });
    expect(report.rows.find((row) => row.fixtureId === "unsupported_mime_hold")?.mediaReadiness).toMatchObject({
      status: "unsupported",
      blockers: expect.arrayContaining(["unsupported_media:application/zip"])
    });
    expect(report.rows.find((row) => row.fixtureId === "stale_report_watch")?.extractionReadiness).toMatchObject({
      status: "watch",
      warnings: expect.arrayContaining(["stale_publication"])
    });
    expect(report.rows.find((row) => row.fixtureId === "duplicate_report_hold")?.extractionReadiness).toMatchObject({
      status: "hold",
      blockers: expect.arrayContaining(["duplicate_canonical_report"])
    });
    expect(report.rows.find((row) => row.fixtureId === "policy_hold_report")?.extractionReadiness).toMatchObject({
      status: "hold",
      blockers: expect.arrayContaining(["policy_or_robots_hold"]),
      handoffs: {
        agent03Adapter: "block_promotion",
        agent06Evidence: "hold_capture_replay",
        agent09Api: "hold_route_output",
        agent10Release: "hold"
      }
    });
    expect(report.rows.every((row) => row.provenanceContract.collectedItemCompatible)).toBe(true);
    expect(report.rows.every((row) => row.provenanceContract.canonicalUrlHash)).toBe(true);
    expect(report.routeContract.stableFields).toEqual(expect.arrayContaining(["fixtureCoverage"]));
    expect(report.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["rawUrl", "unsafeUrl", "rawText", "objectKey", "ocrVendor"]));

    const serialized = JSON.stringify(report);
    for (const forbidden of [
      "https://vendor.example.test/reports/apt29",
      "https://cert.example.test/advisories/cve-2026-4242",
      "https://restricted.example.test/reports/private",
      "rawText",
      "objectKey"
    ]) {
      if (forbidden === "rawText" || forbidden === "objectKey") {
        expect(report.routeContract.forbiddenFields).toContain(forbidden);
      } else {
        expect(serialized).not.toContain(forbidden);
      }
    }
  });
});
