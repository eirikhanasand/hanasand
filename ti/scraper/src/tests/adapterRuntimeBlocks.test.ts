import { describe, expect, test } from "bun:test";
import { buildAdapterFailureObservation, buildAdapterFailureObservatory } from "../adapters/adapterFailureObservatory.ts";
import { buildAdapterRuntimeEnablementPacket } from "../adapters/adapterRuntimeEnablement.ts";
import { browserWorkerIsolationPlan } from "../adapters/browserWorkerIsolation.ts";
import { canary, defaultPoolCaps, defaultThresholds, generatedAt, profile, source } from "./helpers/adapterRuntimeFixtures.ts";

describe("adapter runtime enablement blockers", () => {
  test("blocks on allowlist parser confidence byte caps policy and observatory failures", () => {
    const staticSource = source("src_static_low", "static_web", "https://vendor.example.test/low");
    const dynamicSource = source("src_dynamic_policy", "dynamic_web", "https://vendor.example.test/dynamic");
    const pdfSource = source("src_pdf_large", "pdf", "https://vendor.example.test/large.pdf");
    const staticProfile = profile(staticSource, { text: "tiny" });
    const dynamicProfile = profile(dynamicSource, { requiresJavascript: true });
    const pdfProfile = profile(pdfSource);
    const blockedObservation = buildAdapterFailureObservation({ generatedAt, source: staticSource, sourceFamily: "static_html", queryClass: "actor", result: { items: [], discovered: [], warnings: [], metadata: { failureCategory: "parser_confidence_low", canonicalUrl: staticSource.url } }, profile: staticProfile });
    const packet = buildAdapterRuntimeEnablementPacket({
      generatedAt,
      observatory: buildAdapterFailureObservatory({ generatedAt, observations: [blockedObservation] }),
      browserPlan: browserWorkerIsolationPlan({ enabled: true, maxWorkers: 4, memoryCapMb: 2048, timeoutMs: 30_000, allowedHosts: ["vendor.example.test"], robotsAllowed: false, legalNotes: "" }),
      canarySources: [canary({ source: staticSource, sourceFamily: "static_html", parserProfile: staticProfile, expectedEvidenceYield: 0.2 }), canary({ source: dynamicSource, sourceFamily: "dynamic_page", parserProfile: dynamicProfile, robotsAllowed: false, legalNotesPresent: false }), canary({ source: pdfSource, sourceFamily: "pdf_report", parserProfile: pdfProfile, observedContentLengthBytes: 8_000_000, maxBytes: 5_000_000 })],
      poolCaps: { ...defaultPoolCaps(), memoryCapMb: 512, timeoutMs: 10_000, maxBytes: 5_000_000 },
      thresholds: { ...defaultThresholds(), staticMinParserConfidence: 0.9, maxBlockedFailureRatio: 0 }
    });

    const staticReadiness = packet.readiness.find((entry) => entry.adapter === "static_html");
    const dynamicReadiness = packet.readiness.find((entry) => entry.adapter === "dynamic_public_browser");
    const pdfReadiness = packet.readiness.find((entry) => entry.adapter === "pdf_report");
    expect(packet.readyForCanary).toBe(false);
    expect(packet.summary.blocked).toBeGreaterThan(0);
    expect(staticReadiness?.blockers).toEqual(expect.arrayContaining(["static_html_parser_confidence_below_threshold", "static_html_observatory_failure_ratio_high", "static_html_evidence_yield_low"]));
    expect(dynamicReadiness?.blockers).toEqual(expect.arrayContaining(["dynamic_public_browser_canary_allowlist_empty", "dynamic_public_browser_robots_policy_hold", "dynamic_public_browser_legal_notes_missing"]));
    expect(pdfReadiness?.blockers).toContain("pdf_report_byte_cap_exceeded");
    expect(packet.rolloutControls.rollbackTriggers).toContain("raw_screenshot_storage_attempt");
    expect(JSON.stringify(packet)).not.toContain("https://");
  });
});
