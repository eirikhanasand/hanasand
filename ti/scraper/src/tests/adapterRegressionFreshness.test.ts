import { describe, expect, test } from "bun:test";
import { browserWorkerCaptureContract, browserWorkerIsolationPlan } from "../adapters/browserWorkerIsolation.ts";
import { selectParserProfile } from "../adapters/parserProfiles.ts";
import { evaluateSourceFreshnessRegression } from "../adapters/sourceFreshnessRegression.ts";
import type { AdapterRunResult } from "../types.ts";
import { collected, source } from "./helpers/adapterRegressionFixtures.ts";

describe("adapter freshness and browser isolation contracts", () => {
  test("classifies stale feeds broken parsers empty captures noisy duplicates and disabled sources", () => {
    const src = source("src_stale_rss", "rss", "https://feeds.example.test/rss.xml");
    const profile = selectParserProfile({ sourceType: "rss", url: src.url, contentType: "application/rss+xml", textSample: "short", parserWarnings: ["parser emitted empty body"] });
    const staleResult: AdapterRunResult = { items: [collected(src, "CVE and actor mention from an old feed", "2025-01-01T00:00:00.000Z")], discovered: [], warnings: ["parser emitted empty body"], metadata: {} };
    const stale = evaluateSourceFreshnessRegression({ source: src, result: staleResult, profile, now: "2026-05-24T00:00:00.000Z", freshnessTargetSeconds: 7 * 24 * 60 * 60, duplicateRate: 0.2, noiseRate: 0.6 });
    expect(stale).toMatchObject({ status: "review", recommendedAction: "move_to_review" });
    expect(stale.findings).toEqual(expect.arrayContaining(["stale_feed", "broken_parser_profile", "noisy_source"]));
    const emptyDuplicate = evaluateSourceFreshnessRegression({ source: src, result: { items: [], discovered: [], warnings: [], metadata: {} }, profile, now: "2026-05-24T00:00:00.000Z", freshnessTargetSeconds: 3600, duplicateRate: 0.9, noiseRate: 0.1 });
    expect(emptyDuplicate).toMatchObject({ status: "disable", recommendedAction: "disable_source" });
    expect(emptyDuplicate.findings).toEqual(expect.arrayContaining(["empty_capture", "duplicate_heavy"]));
  });

  test("keeps browser worker isolation disabled by default with hash-only dynamic capture contracts", () => {
    const plan = browserWorkerIsolationPlan({ enabled: true, maxWorkers: 2, memoryCapMb: 1024, timeoutMs: 30000, allowedHosts: ["reports.example.test"], robotsAllowed: true, legalNotes: "Public report rendering approved." });
    expect(plan).toMatchObject({ enabled: false, networkIsolation: { publicOnly: true, blockPrivateNetworks: true, blockCredentials: true, blockCaptchaSolving: true, blockDownloads: true } });
    const capture = browserWorkerCaptureContract(plan, { url: "https://reports.example.test/js/apt42", finalUrl: "https://reports.example.test/js/apt42", contentType: "text/html", text: "APT42 dynamic report text", html: "<main>APT42 dynamic report text</main>", screenshotBytes: new TextEncoder().encode("fake screenshot") });
    expect(capture).toMatchObject({ status: "ready", extractionStatus: "ready_for_extraction" });
    expect(capture.screenshotHash).toBeDefined();
    expect(JSON.stringify(capture)).not.toContain("fake screenshot");
    expect(browserWorkerCaptureContract({ ...plan, policy: { ...plan.policy, robotsAllowed: false } }, { url: "https://reports.example.test/js/apt42" })).toMatchObject({ status: "blocked", failureCategory: "robots_policy_hold" });
  });
});
