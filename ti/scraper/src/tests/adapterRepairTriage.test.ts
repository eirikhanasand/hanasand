import { describe, expect, test } from "bun:test";
import {
  replayAdapterCertificationFixtures,
  type AdapterCertificationFixtureInput
} from "../adapters/adapterCertification.ts";
import {
  buildAdapterRepairTriagePacket,
  type AdapterRepairTriageImpactInput
} from "../adapters/adapterRepairTriage.ts";
import { buildAdapterFailureObservation } from "../adapters/adapterFailureObservatory.ts";
import { buildAdapterSlaRepairPacket, type AdapterSlaAdapterKind } from "../adapters/adapterSlaRepair.ts";
import { selectParserProfile, type ParserFailureCategory, type ParserProfileDecision } from "../adapters/parserProfiles.ts";
import type { AdapterRunResult, CollectedItem, SourceRecord, SourceType } from "../types.ts";
import { hashContent } from "../utils.ts";

const generatedAt = "2026-05-24T20:30:00.000Z";
const collectedAt = "2026-05-24T20:00:00.000Z";
const createdAt = new Date(0).toISOString();
const adapters: AdapterSlaAdapterKind[] = ["static_html", "rss_feed", "dynamic_public_browser", "pdf_report", "public_channel_handoff", "advisory_signal", "multilingual_handoff"];

function source(id: string, type: SourceType, url: string): SourceRecord {
  return {
    id,
    name: id.replaceAll("_", " "),
    type,
    url,
    accessMethod: type === "telegram_public" ? "official_api" : "public_http",
    status: "active",
    risk: "low",
    trustScore: 0.82,
    language: "en",
    crawlFrequencySeconds: 3600,
    legalNotes: "Public source fixture with legal notes.",
    createdAt,
    updatedAt: createdAt
  };
}

function item(src: SourceRecord, text: string): CollectedItem {
  return {
    sourceId: src.id,
    taskId: `task_${src.id}`,
    url: src.url,
    title: src.name,
    rawText: text,
    collectedAt: generatedAt,
    publishedAt: "2026-05-23T10:00:00.000Z",
    contentHash: hashContent(text),
    language: src.language,
    links: [],
    metadata: {},
    sensitive: false
  };
}

function run(src: SourceRecord, options: {
  text?: string;
  warnings?: string[];
  failureCategory?: ParserFailureCategory;
  canonicalUrl?: string;
} = {}): AdapterRunResult {
  return {
    items: options.text ? [item(src, options.text)] : [],
    discovered: [],
    warnings: options.warnings ?? [],
    metadata: {
      ...(options.failureCategory ? { failureCategory: options.failureCategory } : {}),
      ...(options.canonicalUrl ? { canonicalUrl: options.canonicalUrl } : {})
    }
  };
}

function profile(src: SourceRecord, options: {
  text?: string;
  contentType?: string;
  requiresJavascript?: boolean;
  publicChannelHandoff?: boolean;
  parserWarnings?: string[];
  failureCategory?: ParserFailureCategory;
} = {}): ParserProfileDecision {
  return selectParserProfile({
    sourceType: src.type,
    url: src.url,
    contentType: options.contentType ?? (src.type === "rss" ? "application/rss+xml" : src.type === "pdf" ? "application/pdf" : "text/html"),
    textSample: options.text ?? "APT29 public report with campaign details, malware, infrastructure, CVEs, and mitigations.",
    requiresJavascript: options.requiresJavascript,
    publicChannelHandoff: options.publicChannelHandoff,
    parserWarnings: options.parserWarnings,
    failureCategory: options.failureCategory,
    language: src.language
  });
}

function successFixture(adapter: AdapterSlaAdapterKind, index = 0): AdapterCertificationFixtureInput {
  return {
    fixtureId: `${adapter}_success_${index}`,
    adapter,
    mode: "success",
    sourceId: `src_${adapter}`,
    url: `https://fixtures.example.test/${adapter}/success?secret=must-not-leak`,
    objectRef: `s3://ti-fixtures/${adapter}/success/body.html`,
    parserVersion: "adapter-triage-fixture-v1",
    parserConfidence: 0.88,
    extractionStats: {
      bytesRead: 1800,
      bytesAllowed: 10_000,
      textLength: 1000,
      linkCount: 4,
      citationSpanCount: 2,
      warningCount: 0
    },
    publishedAt: "2026-05-24T12:00:00.000Z",
    collectedAt,
    language: { declared: "en", detected: "en", confidence: 0.9 },
    explicitBoundedDynamic: adapter === "dynamic_public_browser"
  };
}

describe("adapter repair recommendation triage", () => {
  test("ranks repair disable cadence duplicate certification actions by public search impact", () => {
    const staticSrc = source("src_static_selector", "static_web", "https://vendor.example.test/apt29");
    const rssSrc = source("src_rss_rate_limit", "rss", "https://news.example.test/feed.xml");
    const dynamicSrc = source("src_dynamic_empty", "dynamic_web", "https://dynamic.example.test/report");
    const publicChannelSrc = source("src_public_channel_duplicate", "telegram_public", "https://t.me/public_cti");
    const pdfSrc = source("src_pdf_low_confidence", "pdf", "https://reports.example.test/report.pdf");

    const observations = [
      buildAdapterFailureObservation({
        generatedAt,
        source: staticSrc,
        result: run(staticSrc, {
          warnings: ["parser gap: selector .article-body missing", "readability failure: boilerplate only"],
          canonicalUrl: staticSrc.url
        }),
        profile: profile(staticSrc, { parserWarnings: ["selector failure for vendor article"] }),
        queryClass: "actor"
      }),
      buildAdapterFailureObservation({
        generatedAt,
        source: rssSrc,
        result: run(rssSrc, { canonicalUrl: rssSrc.url }),
        profile: profile(rssSrc),
        queryClass: "ransomware",
        retryAfterSeconds: 180
      }),
      buildAdapterFailureObservation({
        generatedAt,
        source: dynamicSrc,
        result: run(dynamicSrc, { failureCategory: "timeout", canonicalUrl: dynamicSrc.url }),
        profile: profile(dynamicSrc, { requiresJavascript: true, failureCategory: "timeout" }),
        queryClass: "actor"
      }),
      buildAdapterFailureObservation({
        generatedAt,
        source: publicChannelSrc,
        result: run(publicChannelSrc, { canonicalUrl: "https://vendor.example.test/shared" }),
        profile: profile(publicChannelSrc, { contentType: "application/json", publicChannelHandoff: true }),
        queryClass: "country",
        duplicateRate: 0.95
      }),
      buildAdapterFailureObservation({
        generatedAt,
        source: pdfSrc,
        result: run(pdfSrc, { failureCategory: "parser_confidence_low", canonicalUrl: pdfSrc.url }),
        profile: profile(pdfSrc, { text: "tiny", failureCategory: "parser_confidence_low" }),
        queryClass: "vendor_report"
      })
    ];
    const slaRepairPacket = buildAdapterSlaRepairPacket({ generatedAt, observations });
    const certificationPacket = replayAdapterCertificationFixtures({
      generatedAt,
      fixtures: adapters.map((adapter, index) => adapter === "dynamic_public_browser"
        ? { ...successFixture(adapter, index), explicitBoundedDynamic: false }
        : successFixture(adapter, index)),
      requiredModes: ["success"],
      slaRepairPacket
    });
    const impacts: AdapterRepairTriageImpactInput[] = [
      { sourceId: "src_dynamic_empty", adapter: "dynamic_public_browser", customerVisibleSearchImpact: 0.96, sourceFamilyCoverage: 0.84, freshnessDebtHours: 12, queryClasses: ["actor"] },
      { sourceId: "src_pdf_low_confidence", adapter: "pdf_report", customerVisibleSearchImpact: 0.82, sourceFamilyCoverage: 0.74, freshnessDebtHours: 36, queryClasses: ["vendor_report"] },
      { sourceId: "src_rss_rate_limit", adapter: "rss_feed", customerVisibleSearchImpact: 0.68, sourceFamilyCoverage: 0.7, freshnessDebtHours: 8, queryClasses: ["ransomware"] },
      { sourceId: "src_public_channel_duplicate", adapter: "public_channel_handoff", customerVisibleSearchImpact: 0.42, sourceFamilyCoverage: 0.35, duplicateRate: 0.95, queryClasses: ["country"] }
    ];

    const packet = buildAdapterRepairTriagePacket({ generatedAt, slaRepairPacket, certificationPacket, impacts });

    expect(packet.schemaVersion).toBe("ti.adapter_repair_triage_packet.v1");
    expect(packet.browserWorkersEnabled).toBe(false);
    expect(packet.decision).toBe("escalate");
    expect(packet.recommendations[0]).toMatchObject({
      adapter: "dynamic_public_browser",
      sourceId: "src_dynamic_empty",
      action: "disable_or_pause_source",
      priority: "p0",
      sandboxFixtureReplay: {
        required: true,
        expectedModes: ["success", "timeout", "empty_extraction"],
        hashOnly: true,
        rawMaterialRequired: false,
        dynamicBrowserDisabledByDefault: true,
        dynamicRequiresExplicitApproval: true
      },
      handoffs: {
        agent01Activation: "hold_activation",
        agent02Cadence: "pause",
        agent10ReleaseGate: "hold"
      }
    });
    expect(packet.recommendations.some((recommendation) => recommendation.action === "fix_parser" && recommendation.adapter === "pdf_report")).toBe(true);
    expect(packet.recommendations.some((recommendation) => recommendation.action === "reduce_cadence" && recommendation.adapter === "rss_feed")).toBe(true);
    expect(packet.recommendations.some((recommendation) => recommendation.action === "suppress_duplicate" && recommendation.adapter === "public_channel_handoff")).toBe(true);
    expect(packet.summary.warningCodes).toContain("adapter_triage.disable_or_pause_source");
    expect(packet.summary.agentHandoffs.agent06).toContain("suppress_duplicate");
    expect(packet.sandboxFixtureReplay).toMatchObject({
      hashOnly: true,
      rawMaterialRequired: false,
      dynamicBrowserDisabledByDefault: true,
      dynamicRequiresExplicitApproval: true
    });
    expect(packet.sandboxFixtureReplay.expectedModesByAdapter.find((entry) => entry.adapter === "dynamic_public_browser")?.modes).toEqual(["success", "timeout", "rate_limit", "empty_extraction"]);

    const serialized = JSON.stringify(packet);
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("s3://");
    expect(serialized).not.toContain("must-not-leak");
    expect(serialized).not.toContain("APT29 public report");
    expect(serialized).not.toContain(".onion");
    expect(packet.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["url", "rawText", "html", "screenshotBytes", "objectRef"]));
  });

  test("certifies adapters when SLA and success replay gates are clean", () => {
    const slaRepairPacket = buildAdapterSlaRepairPacket({ generatedAt, observations: [] });
    const certificationPacket = replayAdapterCertificationFixtures({
      generatedAt,
      fixtures: adapters.map(successFixture),
      requiredModes: ["success"],
      slaRepairPacket
    });

    const packet = buildAdapterRepairTriagePacket({ generatedAt, slaRepairPacket, certificationPacket });

    expect(packet.decision).toBe("certify");
    expect(packet.readyForCertification).toBe(true);
    expect(packet.summary.actions).toMatchObject({ certify_adapter: adapters.length });
    expect(packet.recommendations.every((recommendation) => recommendation.action === "certify_adapter")).toBe(true);
    expect(packet.adapterSummaries.every((summary) => summary.releaseHold === false)).toBe(true);
    expect(packet.summary.agentHandoffs).toMatchObject({
      agent01: ["allow_certification"],
      agent02: ["normal"],
      agent04: ["count_as_covered"],
      agent06: ["none"],
      agent07: ["pass"],
      agent09: [],
      agent10: ["none"]
    });
  });
});
