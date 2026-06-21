import { describe, expect, test } from "bun:test";
import { buildPdfReportExtractionReadiness, PdfReportAdapter, type PdfReportExtractor } from "../adapters/pdfReport.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { responseFixture, source, task } from "./helpers/adapterContractFixtures.ts";

describe("PDF adapter contracts", () => {
  test("extracts public PDF reports with readiness and storage dedupe", async () => {
    const extractor: PdfReportExtractor = { async extract(input) {
      expect(input.contentType).toBe("application/pdf");
      return { title: "APT29 PDF advisory", canonicalUrl: "https://reports.example.test/pdf/apt29-advisory.pdf#page=2", publishedAt: "2026-05-21T00:00:00.000Z", pageCount: 12, extractionConfidence: 0.79, parserWarnings: ["table extraction skipped in fixture"], text: "APT29 campaign advisory. Malware, phishing, and CVE-2026-2929 indicators were observed against government victims." };
    } };
    const src = source({ id: "src_pdf_report", type: "pdf", url: "https://reports.example.test/pdf/apt29-advisory.pdf" });
    const adapter = new PdfReportAdapter({ fetcher: async (input) => responseFixture("fake-pdf-bytes", { status: 200, headers: { "content-type": "application/pdf" } }, typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url), extractor });
    const result = await adapter.collect(src, task({ sourceId: src.id, sourceType: "pdf", targetUrl: src.url }));
    const item = result.items[0]!;
    const readiness = buildPdfReportExtractionReadiness({ source: src, result, generatedAt: "2026-05-24T12:00:00.000Z" });

    expect(item.metadata).toMatchObject({ adapter: "pdf", parserProfile: "pdf_report", pageCount: 12, extractionStatus: "ready_for_extraction", parserWarnings: ["table extraction skipped in fixture"] });
    expect(item.metadata.adapterContract).toMatchObject({ agent06: { captureReady: true }, agent07: { parserProfile: "pdf_report", citationSpansAvailable: true }, agent10: { costClass: "medium" } });
    expect(readiness).toMatchObject({ schemaVersion: "ti.pdf_report_extraction_readiness.v1", status: "watch", ocr: { enabled: false, defaultState: "disabled", canRequestSeparateOperatorApproval: true }, textOnlyProjection: { enabled: true, textHash: expect.stringMatching(/^texthash:/), parserConfidence: 0.79 }, evidenceReplay: { ready: true, replayId: expect.stringMatching(/^evidence_replay_ref:/), retentionClass: "public_report" }, gates: { rawPdfBytesExposed: false, rawTextExposed: false, objectKeyExposed: false, ocrVendorCoupled: false } });
    expect(JSON.stringify(readiness)).not.toContain("APT29 campaign advisory");
    expect(readiness.forbiddenFields).toEqual(expect.arrayContaining(["pdfBytes", "ocrVendor", "objectKey"]));
    const store = new InMemoryScraperStore();
    const first = store.savePipelineResult(processCollectedItem(item));
    const duplicate = store.findDuplicateCapture(processCollectedItem({ ...item, taskId: "task_duplicate_pdf" }).capture);
    expect(duplicate?.id).toBe(first.capture.id);
    expect(store.listCaptures()).toHaveLength(1);
  });

  test("reports PDF failure taxonomy", async () => {
    const pdfSource = source({ id: "src_pdf_fail", type: "pdf", url: "https://reports.example.test/report.pdf" });
    const disabled = await new PdfReportAdapter().collect(source({ ...pdfSource, status: "disabled" }), task({ sourceId: pdfSource.id, sourceType: "pdf", targetUrl: pdfSource.url }));
    const unsupported = await new PdfReportAdapter({ fetcher: async () => responseFixture("{}", { status: 200, headers: { "content-type": "application/json" } }, pdfSource.url) }).collect(pdfSource, task({ sourceId: pdfSource.id, sourceType: "pdf", targetUrl: pdfSource.url }));
    const tooLarge = await new PdfReportAdapter({ fetcher: async () => responseFixture("123456789", { status: 200, headers: { "content-type": "application/pdf" } }, pdfSource.url) }).collect(pdfSource, task({ sourceId: pdfSource.id, sourceType: "pdf", targetUrl: pdfSource.url, maxBytes: 3 }));
    const unavailable = await new PdfReportAdapter({ fetcher: async () => responseFixture("missing", { status: 404, headers: { "content-type": "application/pdf" } }, pdfSource.url) }).collect(pdfSource, task({ sourceId: pdfSource.id, sourceType: "pdf", targetUrl: pdfSource.url }));
    const low = await new PdfReportAdapter({ fetcher: async () => responseFixture("pdf", { status: 200, headers: { "content-type": "application/pdf" } }, pdfSource.url), extractor: { async extract() { return { text: "tiny", extractionConfidence: 0.1 }; } } }).collect(pdfSource, task({ sourceId: pdfSource.id, sourceType: "pdf", targetUrl: pdfSource.url }));
    expect(disabled.metadata).toMatchObject({ failureCategory: "source_disabled" });
    expect(unsupported.metadata).toMatchObject({ failureCategory: "unsupported_media" });
    expect(tooLarge.metadata).toMatchObject({ failureCategory: "content_too_large" });
    expect(unavailable.metadata).toMatchObject({ failureCategory: "unavailable" });
    expect(low.metadata).toMatchObject({ failureCategory: "parser_confidence_low" });
  });
});
