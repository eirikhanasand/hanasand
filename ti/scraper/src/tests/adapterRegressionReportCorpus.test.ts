import { describe, expect, test } from "bun:test";
import { runReportCorpusBenchmark, type ReportCorpusFixture } from "../adapters/reportCorpusBenchmark.ts";
import { source } from "./helpers/adapterRegressionFixtures.ts";

describe("adapter report corpus benchmarks", () => {
  test("benchmarks public report corpus fixtures across HTML RSS PDF advisory and dynamic snapshots", () => {
    const fixtures: ReportCorpusFixture[] = [
      { id: "apt29_pdf", source: source("src_bench_apt29_pdf", "pdf", "https://vendor.example.test/apt29.pdf", 0.92), profileInput: { sourceType: "pdf", url: "https://vendor.example.test/apt29.pdf", contentType: "application/pdf" }, title: "APT29 PDF report", text: "APT29 malware and CVE-2026-2929 indicators are documented with government victim context.", publishedAt: "2026-05-20T00:00:00.000Z", pageCount: 12, scannedPageCount: 0, ocrAvailable: true, ocrConfidence: 0.91 },
      { id: "apt42_dynamic", source: source("src_bench_apt42_dynamic", "dynamic_web", "https://vendor.example.test/apt42"), profileInput: { sourceType: "dynamic_web", url: "https://vendor.example.test/apt42", contentType: "text/html", requiresJavascript: true }, title: "APT42 dynamic snapshot", text: "APT42 phishing infrastructure and malware lures were observed against civil society victims.", publishedAt: "2026-05-19T00:00:00.000Z" },
      { id: "rss_ransomware", source: source("src_bench_rss", "rss", "https://news.example.test/feed.xml"), profileInput: { sourceType: "rss", url: "https://news.example.test/feed.xml", contentType: "application/rss+xml" }, title: "Ransomware RSS item", text: "Akira ransomware victim claim is summarized with timestamped public-source provenance.", publishedAt: "2026-05-18T00:00:00.000Z" },
      { id: "cert_cve", source: source("src_bench_cert", "static_web", "https://cert.example.test/cve-2024-3094"), profileInput: { sourceType: "static_web", url: "https://cert.example.test/cve-2024-3094", contentType: "text/html" }, title: "CERT CVE advisory", text: "CERT advisory for CVE-2024-3094 describes affected versions, exploitation risk, and mitigations.", publishedAt: "2026-05-17T00:00:00.000Z" }
    ];
    const report = runReportCorpusBenchmark(fixtures, "2026-05-24T00:00:00.000Z");
    expect(report).toMatchObject({ schemaVersion: "ti.report_corpus_benchmark.v1", summary: { total: 4, fail: 0 } });
    expect(report.summary.averageScore).toBeGreaterThan(0.7);
    expect(report.rows.map((row) => row.parserProfile)).toEqual(["pdf_report", "dynamic_page", "rss_entry", "static_html"]);
    expect(report.summary).toMatchObject({ ocrReady: 4, ocrNeedsReview: 0, ocrBlocked: 0, citationSpanCoverage: 1 });
    expect(report.rows.find((row) => row.fixtureId === "apt29_pdf")?.ocrReadiness).toMatchObject({ required: true, status: "ready", textLayer: "thin", handoffs: { agent07Quality: "accept", agent10Release: "green" } });
    expect(report.rows.every((row) => row.handoff.redactionSafe)).toBe(true);
    expect(report.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["rawText", "objectKey", "ocrVendor", "apiKey"]));
    expect(report.safety).toMatchObject({ publicOnly: true, rawTextExposed: false, unsafeUrlExposed: false, objectKeyExposed: false, ocrVendorCoupling: false });
  });

  test("gates scanned PDF report fixtures on OCR readiness and citation spans", () => {
    const fixtures: ReportCorpusFixture[] = [
      { id: "scanned_pdf_needs_ocr", source: source("src_bench_scanned_pdf", "pdf", "https://vendor.example.test/scanned.pdf", 0.82), profileInput: { sourceType: "pdf", url: "https://vendor.example.test/scanned.pdf", contentType: "application/pdf" }, title: "Scanned PDF report", text: "APT29", publishedAt: "2026-05-20T00:00:00.000Z", pageCount: 20, scannedPageCount: 18, ocrAvailable: false },
      { id: "scanned_pdf_blocked", source: source("src_bench_image_pdf", "pdf", "https://vendor.example.test/image-only.pdf", 0.82), profileInput: { sourceType: "pdf", url: "https://vendor.example.test/image-only.pdf", contentType: "application/pdf" }, title: "Image-only PDF report", text: "", publishedAt: "2026-05-20T00:00:00.000Z", pageCount: 15, scannedPageCount: 15, ocrAvailable: false, expectedCitationSpanCount: 1 },
      { id: "scanned_pdf_low_ocr", source: source("src_bench_low_ocr_pdf", "pdf", "https://vendor.example.test/low-ocr.pdf", 0.82), profileInput: { sourceType: "pdf", url: "https://vendor.example.test/low-ocr.pdf", contentType: "application/pdf" }, title: "Low OCR PDF report", text: "APT42 phishing report includes indicators from scanned appendix.", publishedAt: "2026-05-20T00:00:00.000Z", pageCount: 18, scannedPageCount: 10, ocrAvailable: true, ocrConfidence: 0.62 }
    ];
    const report = runReportCorpusBenchmark(fixtures, "2026-05-24T00:00:00.000Z");
    expect(report.summary).toMatchObject({ total: 3, warn: 2, fail: 1, ocrReady: 0, ocrNeedsReview: 2, ocrBlocked: 1 });
    expect(report.rows.find((row) => row.fixtureId === "scanned_pdf_needs_ocr")?.ocrReadiness).toMatchObject({ status: "needs_ocr", warnings: expect.arrayContaining(["thin_text_layer_needs_ocr_fixture"]), handoffs: { agent03Adapter: "add_ocr_fixture", agent07Quality: "review_ocr", agent10Release: "watch" } });
    expect(report.rows.find((row) => row.fixtureId === "scanned_pdf_blocked")?.ocrReadiness).toMatchObject({ status: "blocked", blockers: expect.arrayContaining(["missing_text_layer_without_ocr", "citation_spans_unavailable_for_scanned_report"]), handoffs: { agent03Adapter: "block_pdf_promotion", agent06Evidence: "hold_capture_replay", agent10Release: "hold" } });
    expect(report.rows.find((row) => row.fixtureId === "scanned_pdf_low_ocr")?.ocrReadiness).toMatchObject({ status: "needs_ocr", warnings: expect.arrayContaining(["ocr_confidence_below_target"]) });
    expect(report.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["ocrVendor", "apiKey"]));
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("https://vendor.example.test/scanned.pdf");
    expect(serialized).not.toContain("https://vendor.example.test/image-only.pdf");
  });
});
