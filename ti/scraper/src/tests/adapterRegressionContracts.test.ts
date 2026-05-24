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
        publishedAt: "2026-05-20T00:00:00.000Z"
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
    expect(report.rows.every((row) => row.handoff.redactionSafe)).toBe(true);
  });
});
