import { describe, expect, test } from "bun:test";
import { DynamicWebAdapter, type DynamicPageRenderer } from "../adapters/dynamicWeb.ts";
import { reportHtml, source, task } from "./helpers/adapterContractFixtures.ts";

describe("dynamic adapter contracts", () => {
  test("captures JavaScript-heavy public reports with canonical provenance and handoff DTOs", async () => {
    const renderer: DynamicPageRenderer = { async render(input) {
      expect(input.allowPrivateAccess).toBe(false);
      expect(input.allowAuthBypass).toBe(false);
      expect(input.allowCaptchaSolving).toBe(false);
      return { status: 200, url: input.url, finalUrl: "https://reports.example.test/js/apt42?a=1&b=2", contentType: "text/html; charset=utf-8", redirectChain: ["https://reports.example.test/r/apt42", "https://reports.example.test/js/apt42?a=1&b=2"], publishedAt: "2026-05-20T00:00:00.000Z", renderDurationMs: 42, extractionConfidence: 0.81, html: reportHtml("APT42 dynamic campaign", "APT42 intrusion campaign used malware and phishing against civil society victims. CVE-2026-4242 indicators were observed.") };
    } };
    const src = source({});
    const item = (await new DynamicWebAdapter({ renderer }).collect(src, task({ sourceId: src.id }))).items[0]!;

    expect(item.url).toBe("https://reports.example.test/research/apt42-dynamic-report");
    expect(item.rawText).toContain("APT42 intrusion campaign");
    expect(item.publishedAt).toBe("2026-05-20T00:00:00.000Z");
    expect(item.contentHash.length).toBeGreaterThan(10);
    expect(item.metadata).toMatchObject({ adapter: "dynamic_web", parserProfile: "dynamic_page", extractionStatus: "ready_for_extraction", sourceTrust: 0.84, safety: { allowPrivateAccess: false, allowAuthBypass: false, allowCaptchaSolving: false, allowRawRestrictedMaterial: false } });
    expect(item.metadata.redirectChain).toEqual(["https://reports.example.test/r/apt42", "https://reports.example.test/js/apt42?a=1&b=2"]);
    expect(item.metadata.adapterContract).toMatchObject({ schemaVersion: "ti.adapter_capture_contract.v1", status: "captured", agent06: { captureReady: true, provenanceRequired: true }, agent07: { parserProfile: "dynamic_page", citationSpansAvailable: true }, agent09: { apiStatus: "captured" }, agent10: { adapter: "dynamic_web", costClass: "high", dashboardState: "ok" } });
  });

  test("reports dynamic capture failure taxonomy", async () => {
    const src = source({});
    const rateLimited = await new DynamicWebAdapter({ renderer: { async render() { return { status: 429, url: src.url, contentType: "text/html" }; } } }).collect(src, task({ sourceId: src.id }));
    const lowConfidence = await new DynamicWebAdapter({ renderer: { async render() { return { status: 200, url: src.url, contentType: "text/html", text: "short", extractionConfidence: 0.2 }; } } }).collect(src, task({ sourceId: src.id }));
    const unsafe = await new DynamicWebAdapter({ renderer: { async render() { throw new Error("should not render unsafe source"); } } }).collect(source({ metadata: { captchaRequired: true } }), task({}));
    const timeout = await new DynamicWebAdapter({ renderer: { async render() { throw new Error("timeout waiting for network idle"); } } }).collect(src, task({ sourceId: src.id }));
    expect(rateLimited.metadata).toMatchObject({ failureCategory: "rate_limited" });
    expect(lowConfidence.metadata).toMatchObject({ failureCategory: "parser_confidence_low" });
    expect(unsafe.metadata).toMatchObject({ failureCategory: "policy_hold" });
    expect(timeout.metadata).toMatchObject({ failureCategory: "timeout" });
  });
});
