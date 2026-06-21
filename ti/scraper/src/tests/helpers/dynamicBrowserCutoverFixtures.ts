import { type DynamicBrowserFailureMode, type DynamicBrowserFixtureInput, buildDynamicBrowserCutoverPacket } from "../../adapters/dynamicBrowserCutover.ts";
import { hashContent } from "../../utils.ts";

export const generatedAt = "2026-05-24T18:15:00.000Z";

export function fixture(mode: DynamicBrowserFailureMode, index = 0): DynamicBrowserFixtureInput {
  const screenshotHash = `screenshot:${hashContent(`screenshot:${mode}:${index}`).slice(0, 16)}`;
  return {
    fixtureId: `dynamic_${mode}_${index}`,
    sourceId: `src_dynamic_${mode}`,
    mode,
    requestedUrl: `https://dynamic.example.test/${mode}?secret=must-not-leak`,
    finalUrl: mode === "redirect_chain" ? `https://dynamic.example.test/final/${mode}` : undefined,
    objectRef: `s3://ti-dynamic-fixtures/${mode}/capture.html`,
    screenshotHash,
    expectedScreenshotHash: mode === "screenshot_hash_mismatch" ? `screenshot:${hashContent("different").slice(0, 16)}` : screenshotHash,
    contentType: mode === "unsupported_mime" ? "application/zip" : "text/html",
    renderDurationMs: mode === "js_render_timeout" ? 35_000 : 1400,
    redirectCount: mode === "redirect_chain" ? 7 : 1,
    bytesRead: mode === "capture_truncation" ? 5_000_000 : mode === "blank_page" ? 0 : 120_000,
    textLength: mode === "parser_empty_extraction" || mode === "blank_page" ? 0 : 2400,
    parserConfidence: mode === "parser_empty_extraction" ? 0.2 : 0.82
  };
}

export function baseInput(overrides: Partial<Parameters<typeof buildDynamicBrowserCutoverPacket>[0]> = {}): Parameters<typeof buildDynamicBrowserCutoverPacket>[0] {
  return {
    generatedAt,
    approval: { explicitlyApproved: true, approvalId: "approval_dynamic_canary_1", approvedBy: "operator", expiresAt: "2026-06-24T00:00:00.000Z" },
    pool: { maxWorkers: 2, memoryCapMb: 1024, timeoutMs: 30_000, maxBytes: 5_000_000, queueMaxDepth: 20, currentQueueDepth: 3 },
    policy: { robotsAllowed: true, legalNotesPresent: true, killSwitchActive: false, hostAllowlist: ["dynamic.example.test", "reports.example.test"] },
    fixtures: [fixture("success")],
    ...overrides
  };
}
