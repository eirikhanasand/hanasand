import { describe, expect, test } from "bun:test";
import { DynamicWebAdapter, type DynamicPageRenderer } from "../adapters/dynamicWeb.ts";
import { PdfReportAdapter, type PdfReportExtractor } from "../adapters/pdfReport.ts";
import { adapterPromotionContract, selectParserProfile } from "../adapters/parserProfiles.ts";
import { canonicalizeUrl } from "../adapters/staticWeb.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { CollectionTask, SourceRecord } from "../types.ts";

const createdAt = new Date(0).toISOString();

function source(input: Partial<SourceRecord>): SourceRecord {
  return {
    id: input.id ?? "src_dynamic_report",
    name: input.name ?? "Fixture Dynamic Report",
    type: input.type ?? "dynamic_web",
    url: input.url ?? "https://reports.example.test/js/apt42?b=2&a=1#story",
    accessMethod: input.accessMethod ?? "public_http",
    status: input.status ?? "active",
    risk: input.risk ?? "low",
    trustScore: input.trustScore ?? 0.84,
    language: input.language ?? "en",
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600,
    legalNotes: input.legalNotes ?? "Public vendor report fixture.",
    createdAt,
    updatedAt: createdAt,
    metadata: input.metadata
  };
}

function task(input: Partial<CollectionTask>): CollectionTask {
  return {
    id: input.id ?? "task_adapter_contract",
    sourceId: input.sourceId ?? "src_dynamic_report",
    targetUrl: input.targetUrl ?? "https://reports.example.test/js/apt42?b=2&a=1#story",
    sourceType: input.sourceType ?? "dynamic_web",
    queuedAt: input.queuedAt ?? "2026-05-24T12:00:00.000Z",
    priority: input.priority ?? 0.9,
    reason: input.reason ?? "fixture",
    retryCount: input.retryCount ?? 0,
    maxBytes: input.maxBytes ?? 1_000_000
  };
}

function responseFixture(body: string, init: ResponseInit, url: string): Response {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("dynamic PDF and report adapter contracts", () => {
  test("captures JavaScript-heavy public reports with canonical provenance and API handoff DTOs", async () => {
    const renderer: DynamicPageRenderer = {
      async render(input) {
        expect(input.allowPrivateAccess).toBe(false);
        expect(input.allowAuthBypass).toBe(false);
        expect(input.allowCaptchaSolving).toBe(false);
        return {
          status: 200,
          url: input.url,
          finalUrl: "https://reports.example.test/js/apt42?a=1&b=2",
          contentType: "text/html; charset=utf-8",
          redirectChain: ["https://reports.example.test/r/apt42", "https://reports.example.test/js/apt42?a=1&b=2"],
          publishedAt: "2026-05-20T00:00:00.000Z",
          renderDurationMs: 42,
          extractionConfidence: 0.81,
          html: reportHtml("APT42 dynamic campaign", "APT42 intrusion campaign used malware and phishing against civil society victims. CVE-2026-4242 indicators were observed.")
        };
      }
    };
    const src = source({});
    const result = await new DynamicWebAdapter({ renderer }).collect(src, task({ sourceId: src.id }));
    const item = result.items[0]!;

    expect(item.url).toBe("https://reports.example.test/research/apt42-dynamic-report");
    expect(item.rawText).toContain("APT42 intrusion campaign");
    expect(item.publishedAt).toBe("2026-05-20T00:00:00.000Z");
    expect(item.contentHash.length).toBeGreaterThan(10);
    expect(item.metadata).toMatchObject({
      adapter: "dynamic_web",
      parserProfile: "dynamic_page",
      extractionStatus: "ready_for_extraction",
      sourceTrust: 0.84,
      safety: {
        allowPrivateAccess: false,
        allowAuthBypass: false,
        allowCaptchaSolving: false,
        allowRawRestrictedMaterial: false
      }
    });
    expect(item.metadata.redirectChain).toEqual([
      "https://reports.example.test/r/apt42",
      "https://reports.example.test/js/apt42?a=1&b=2"
    ]);
    expect(item.metadata.adapterContract).toMatchObject({
      schemaVersion: "ti.adapter_capture_contract.v1",
      status: "captured",
      agent06: { captureReady: true, provenanceRequired: true },
      agent07: { parserProfile: "dynamic_page", citationSpansAvailable: true },
      agent09: { apiStatus: "captured" },
      agent10: { adapter: "dynamic_web", costClass: "high", dashboardState: "ok" }
    });
  });

  test("reports dynamic capture failure taxonomy for timeout policy rate limits and confidence holds", async () => {
    const src = source({});
    const rateLimited = await new DynamicWebAdapter({
      renderer: { async render() { return { status: 429, url: src.url, contentType: "text/html" }; } }
    }).collect(src, task({ sourceId: src.id }));
    expect(rateLimited.metadata).toMatchObject({ failureCategory: "rate_limited" });

    const lowConfidence = await new DynamicWebAdapter({
      renderer: { async render() { return { status: 200, url: src.url, contentType: "text/html", text: "short", extractionConfidence: 0.2 }; } }
    }).collect(src, task({ sourceId: src.id }));
    expect(lowConfidence.metadata).toMatchObject({ failureCategory: "parser_confidence_low" });

    const unsafe = await new DynamicWebAdapter({
      renderer: { async render() { throw new Error("should not render unsafe source"); } }
    }).collect(source({ metadata: { captchaRequired: true } }), task({}));
    expect(unsafe.metadata).toMatchObject({ failureCategory: "policy_hold" });

    const timeout = await new DynamicWebAdapter({
      renderer: { async render() { throw new Error("timeout waiting for network idle"); } }
    }).collect(src, task({ sourceId: src.id }));
    expect(timeout.metadata).toMatchObject({ failureCategory: "timeout" });
  });

  test("extracts public PDF reports with publication time parser warnings citations and storage dedupe", async () => {
    const extractor: PdfReportExtractor = {
      async extract(input) {
        expect(input.contentType).toBe("application/pdf");
        return {
          title: "APT29 PDF advisory",
          canonicalUrl: "https://reports.example.test/pdf/apt29-advisory.pdf#page=2",
          publishedAt: "2026-05-21T00:00:00.000Z",
          pageCount: 12,
          extractionConfidence: 0.79,
          parserWarnings: ["table extraction skipped in fixture"],
          text: "APT29 campaign advisory. Malware, phishing, and CVE-2026-2929 indicators were observed against government victims."
        };
      }
    };
    const src = source({ id: "src_pdf_report", type: "pdf", url: "https://reports.example.test/pdf/apt29-advisory.pdf" });
    const adapter = new PdfReportAdapter({
      fetcher: async (input) => responseFixture("fake-pdf-bytes", {
        status: 200,
        headers: { "content-type": "application/pdf" }
      }, typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url),
      extractor
    });
    const result = await adapter.collect(src, task({ sourceId: src.id, sourceType: "pdf", targetUrl: src.url }));
    const item = result.items[0]!;

    expect(item.url).toBe("https://reports.example.test/pdf/apt29-advisory.pdf");
    expect(item.metadata).toMatchObject({
      adapter: "pdf",
      parserProfile: "pdf_report",
      pageCount: 12,
      extractionStatus: "ready_for_extraction",
      parserWarnings: ["table extraction skipped in fixture"]
    });
    expect(item.metadata.adapterContract).toMatchObject({
      agent06: { captureReady: true },
      agent07: { parserProfile: "pdf_report", citationSpansAvailable: true },
      agent10: { costClass: "medium" }
    });

    const store = new InMemoryScraperStore();
    const first = store.savePipelineResult(processCollectedItem(item));
    const duplicate = store.findDuplicateCapture(processCollectedItem({ ...item, taskId: "task_duplicate_pdf" }).capture);
    expect(duplicate?.id).toBe(first.capture.id);
    expect(store.listCaptures()).toHaveLength(1);
  });

  test("reports PDF failure taxonomy for disabled source unsupported media too large unavailable and low confidence", async () => {
    const pdfSource = source({ id: "src_pdf_fail", type: "pdf", url: "https://reports.example.test/report.pdf" });
    const disabled = await new PdfReportAdapter().collect(source({ ...pdfSource, status: "disabled" }), task({ sourceId: pdfSource.id, sourceType: "pdf", targetUrl: pdfSource.url }));
    expect(disabled.metadata).toMatchObject({ failureCategory: "source_disabled" });

    const unsupported = await new PdfReportAdapter({
      fetcher: async () => responseFixture("{}", { status: 200, headers: { "content-type": "application/json" } }, pdfSource.url)
    }).collect(pdfSource, task({ sourceId: pdfSource.id, sourceType: "pdf", targetUrl: pdfSource.url }));
    expect(unsupported.metadata).toMatchObject({ failureCategory: "unsupported_media" });

    const tooLarge = await new PdfReportAdapter({
      fetcher: async () => responseFixture("123456789", { status: 200, headers: { "content-type": "application/pdf" } }, pdfSource.url)
    }).collect(pdfSource, task({ sourceId: pdfSource.id, sourceType: "pdf", targetUrl: pdfSource.url, maxBytes: 3 }));
    expect(tooLarge.metadata).toMatchObject({ failureCategory: "content_too_large" });

    const unavailable = await new PdfReportAdapter({
      fetcher: async () => responseFixture("missing", { status: 404, headers: { "content-type": "application/pdf" } }, pdfSource.url)
    }).collect(pdfSource, task({ sourceId: pdfSource.id, sourceType: "pdf", targetUrl: pdfSource.url }));
    expect(unavailable.metadata).toMatchObject({ failureCategory: "unavailable" });

    const low = await new PdfReportAdapter({
      fetcher: async () => responseFixture("pdf", { status: 200, headers: { "content-type": "application/pdf" } }, pdfSource.url),
      extractor: { async extract() { return { text: "tiny", extractionConfidence: 0.1 }; } }
    }).collect(pdfSource, task({ sourceId: pdfSource.id, sourceType: "pdf", targetUrl: pdfSource.url }));
    expect(low.metadata).toMatchObject({ failureCategory: "parser_confidence_low" });
  });

  test("selects parser profiles without one-off source logic and emits standalone contracts", () => {
    expect(selectParserProfile({ sourceType: "dynamic_web", url: "https://x.test" }).profile).toBe("dynamic_page");
    expect(selectParserProfile({ sourceType: "static_web", url: "https://x.test/report.pdf", contentType: "application/pdf" }).profile).toBe("pdf_report");
    expect(selectParserProfile({ sourceType: "rss", url: "https://x.test/feed.xml" }).fallbackOrder).toEqual(["rss_entry", "static_html"]);
    expect(selectParserProfile({ sourceType: "telegram_public", url: "https://t.me/example", publicChannelHandoff: true }).profile).toBe("public_channel_handoff");

    const profile = selectParserProfile({ sourceType: "static_web", url: "https://x.test" });
    const contract = adapterPromotionContract({
      source: source({ id: "src_contract", type: "static_web", url: "https://x.test" }),
      result: { items: [], discovered: [], warnings: [], metadata: { failureCategory: "duplicate_canonical" } },
      profile,
      adapter: "static_web",
      costClass: "low"
    });
    expect(contract).toMatchObject({
      status: "blocked",
      failureCategory: "duplicate_canonical",
      agent09: { retryable: false },
      agent10: { dashboardState: "blocked" }
    });
  });
});

function reportHtml(title: string, body: string): string {
  return `<!doctype html>
<html>
  <head>
    <title>${title}</title>
    <link rel="canonical" href="${canonicalizeUrl("https://reports.example.test/research/apt42-dynamic-report#top")}" />
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <time datetime="2026-05-20">May 20, 2026</time>
      <p>${body}</p>
      <a href="/iocs/apt42">Indicators</a>
    </main>
  </body>
</html>`;
}
