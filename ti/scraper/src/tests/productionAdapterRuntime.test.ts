import { describe, expect, test } from "bun:test";
import {
  replayAdapterCertificationFixtures,
  type AdapterCertificationFixtureInput,
  type AdapterCertificationMode
} from "../adapters/adapterCertification.ts";
import { buildAdapterFailureObservatory } from "../adapters/adapterFailureObservatory.ts";
import { buildAdapterRepairTriagePacket } from "../adapters/adapterRepairTriage.ts";
import { buildAdapterRuntimeEnablementPacket, type AdapterRuntimeCanarySourceInput } from "../adapters/adapterRuntimeEnablement.ts";
import { buildAdapterSlaRepairPacket, type AdapterSlaAdapterKind } from "../adapters/adapterSlaRepair.ts";
import { browserWorkerIsolationPlan } from "../adapters/browserWorkerIsolation.ts";
import {
  buildProductionAdapterRuntimeProgram,
  productionEvidenceReplayRef
} from "../adapters/productionAdapterRuntime.ts";
import { selectParserProfile, type ParserProfileDecision } from "../adapters/parserProfiles.ts";
import type { SourceRecord, SourceType } from "../types.ts";
import { hashContent } from "../utils.ts";

const generatedAt = "2026-05-24T21:00:00.000Z";
const collectedAt = "2026-05-24T20:55:00.000Z";
const createdAt = new Date(0).toISOString();
const certificationAdapters: AdapterSlaAdapterKind[] = ["static_html", "rss_feed", "dynamic_public_browser", "pdf_report", "public_channel_handoff", "advisory_signal", "multilingual_handoff"];
const requiredModes: AdapterCertificationMode[] = ["success"];

function source(id: string, type: SourceType, url: string): SourceRecord {
  return {
    id,
    name: id.replaceAll("_", " "),
    type,
    url,
    accessMethod: type === "telegram_public" ? "official_api" : "public_http",
    status: "active",
    risk: "low",
    trustScore: 0.88,
    language: "en",
    crawlFrequencySeconds: 3600,
    legalNotes: "Public collection legal notes.",
    createdAt,
    updatedAt: createdAt
  };
}

function profile(src: SourceRecord, options: {
  contentType?: string;
  requiresJavascript?: boolean;
  publicChannelHandoff?: boolean;
  text?: string;
} = {}): ParserProfileDecision {
  return selectParserProfile({
    sourceType: src.type,
    url: src.url,
    contentType: options.contentType ?? (src.type === "rss" ? "application/rss+xml" : src.type === "pdf" ? "application/pdf" : "text/html"),
    requiresJavascript: options.requiresJavascript,
    publicChannelHandoff: options.publicChannelHandoff,
    textSample: options.text ?? "Public CTI source fixture with actor, campaign, malware, CVE, sector, victim, and mitigation details.",
    language: "en"
  });
}

function canary(sourceRecord: SourceRecord, sourceFamily: AdapterRuntimeCanarySourceInput["sourceFamily"], parserProfile: ParserProfileDecision): AdapterRuntimeCanarySourceInput {
  return {
    source: sourceRecord,
    sourceFamily,
    parserProfile,
    canonicalUrl: sourceRecord.url,
    robotsAllowed: true,
    legalNotesPresent: true,
    maxBytes: 5_000_000,
    observedContentLengthBytes: 120_000,
    expectedEvidenceYield: 0.86
  };
}

function fixture(adapter: AdapterSlaAdapterKind): AdapterCertificationFixtureInput {
  return {
    fixtureId: `${adapter}_success`,
    adapter,
    mode: "success",
    sourceId: `src_${adapter}`,
    url: `https://fixtures.example.test/${adapter}/success?secret=must-not-leak`,
    objectRef: `s3://ti-fixtures/${adapter}/body.html`,
    contentHash: `contenthash:${hashContent(adapter).slice(0, 16)}`,
    parserVersion: "production-adapter-runtime-v1",
    parserConfidence: 0.9,
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
    language: { declared: "en", detected: "en", confidence: 0.92 },
    explicitBoundedDynamic: adapter === "dynamic_public_browser"
  };
}

function buildGreenProgram() {
  const staticSource = source("src_static", "static_web", "https://vendor.example.test/actor");
  const rssSource = source("src_rss", "rss", "https://feeds.example.test/rss.xml");
  const dynamicSource = source("src_dynamic", "dynamic_web", "https://dynamic.example.test/actor");
  const pdfSource = source("src_pdf", "pdf", "https://reports.example.test/report.pdf");
  const channelSource = source("src_channel", "telegram_public", "https://t.me/public_cti");
  const advisorySource = source("src_advisory", "api", "https://advisories.example.test/feed.json");

  const staticProfile = profile(staticSource);
  const rssProfile = profile(rssSource);
  const dynamicProfile = profile(dynamicSource, { requiresJavascript: true });
  const pdfProfile = profile(pdfSource);
  const channelProfile = profile(channelSource, { contentType: "application/json", publicChannelHandoff: true });
  const advisoryProfile = profile(advisorySource);

  const runtimeEnablement = buildAdapterRuntimeEnablementPacket({
    generatedAt,
    observatory: buildAdapterFailureObservatory({ generatedAt, observations: [] }),
    browserPlan: browserWorkerIsolationPlan({
      enabled: true,
      maxWorkers: 2,
      memoryCapMb: 768,
      timeoutMs: 15_000,
      allowedHosts: ["dynamic.example.test"],
      robotsAllowed: true,
      legalNotes: "Public dynamic legal notes."
    }),
    canarySources: [
      canary(staticSource, "static_html", staticProfile),
      canary(rssSource, "rss_feed", rssProfile),
      canary(dynamicSource, "dynamic_page", dynamicProfile),
      canary(pdfSource, "pdf_report", pdfProfile),
      canary(channelSource, "public_channel", channelProfile),
      canary(advisorySource, "advisory_signal", advisoryProfile)
    ],
    poolCaps: {
      staticMaxWorkers: 32,
      rssMaxWorkers: 24,
      dynamicMaxWorkers: 2,
      pdfMaxWorkers: 4,
      publicChannelMaxWorkers: 4,
      advisoryMaxWorkers: 8,
      memoryCapMb: 1024,
      timeoutMs: 20_000,
      maxBytes: 5_000_000
    },
    thresholds: {
      staticMinParserConfidence: 0.65,
      rssMinParserConfidence: 0.65,
      dynamicMinParserConfidence: 0.72,
      pdfMinParserConfidence: 0.72,
      publicChannelMinParserConfidence: 0.65,
      advisoryMinParserConfidence: 0.65,
      maxWatchFailureRatio: 0.35,
      maxBlockedFailureRatio: 0.05,
      minEvidenceYield: 0.5
    }
  });
  const slaRepair = buildAdapterSlaRepairPacket({ generatedAt, observations: [] });
  const certification = replayAdapterCertificationFixtures({
    generatedAt,
    fixtures: certificationAdapters.map(fixture),
    requiredModes,
    slaRepairPacket: slaRepair
  });
  const repairTriage = buildAdapterRepairTriagePacket({ generatedAt, slaRepairPacket: slaRepair, certificationPacket: certification });
  return buildProductionAdapterRuntimeProgram({ generatedAt, runtimeEnablement, certification, slaRepair, repairTriage });
}

describe("production adapter runtime program", () => {
  test("publishes production adapter capability and capture metadata contracts without unsafe output", () => {
    const packet = buildGreenProgram();

    expect(packet.schemaVersion).toBe("ti.production_adapter_runtime_program.v1");
    expect(packet.browserWorkersEnabled).toBe(false);
    expect(packet.readyForApprovedPublicCollection).toBe(true);
    expect(packet.capabilities.map((capability) => capability.adapter)).toEqual([
      "rss_feed",
      "static_html",
      "pdf_report",
      "dynamic_public_browser",
      "public_channel_handoff",
      "advisory_signal",
      "github_security_feed",
      "multilingual_handoff"
    ]);
    expect(packet.implementationSummary).toMatchObject({
      implemented: 3,
      contractReady: 1,
      canaryContract: 4,
      blocked: 0
    });

    const rss = packet.capabilities.find((capability) => capability.adapter === "rss_feed");
    expect(rss).toMatchObject({
      runtimeMode: "native_public_http",
      implementationState: "implemented",
      parserCertificationState: "certified",
      retryBackoff: {
        supportsRetryAfter: true,
        supportsConditionalRequests: true
      }
    });

    const dynamic = packet.capabilities.find((capability) => capability.adapter === "dynamic_public_browser");
    expect(dynamic).toMatchObject({
      runtimeMode: "disabled_dynamic_isolation",
      implementationState: "canary_contract",
      parserCertificationState: "canary_only",
      dynamicIsolation: {
        browserWorkersEnabled: false,
        screenshotHashOnly: true,
        explicitApprovalRequired: true,
        featureFlag: "disabled_by_default"
      },
      handoffs: {
        agent06Evidence: "hash_only_dynamic_evidence"
      }
    });

    const github = packet.capabilities.find((capability) => capability.adapter === "github_security_feed");
    expect(github).toMatchObject({
      runtimeMode: "official_public_api",
      implementationState: "contract_ready",
      sourceFamily: "github_security_advisory",
      parserProfile: "advisory_signal"
    });

    expect(packet.captureMetadataContract.requiredFields).toEqual([
      "sourceId",
      "canonicalUrlHash",
      "contentHash",
      "fetchedAt",
      "language",
      "parserConfidence",
      "extractionWarnings",
      "provenance",
      "evidenceReplayRef"
    ]);
    expect(packet.captureMetadataContract.noLeakProof).toMatchObject({
      noRawUrls: true,
      noRawText: true,
      noHtml: true,
      noScreenshots: true,
      noObjectKeys: true,
      noCredentials: true,
      noPrivateInvites: true,
      noOnionLinks: true,
      noRestrictedMaterial: true
    });
    expect(packet.agentHandoffs.agent01Activation).toContain("allow_approved_public_activation");
    expect(packet.agentHandoffs.agent02Scheduler).toContain("normal_public_cadence");
    expect(packet.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["url", "rawText", "html", "screenshotBytes", "objectKey"]));

    const serialized = JSON.stringify(packet);
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("s3://");
    expect(serialized).not.toContain("must-not-leak");
    expect(serialized).not.toContain(".onion");
  });

  test("builds deterministic evidence replay refs for extraction-ready capture metadata", () => {
    const replayRef = productionEvidenceReplayRef({
      sourceId: "src_static",
      canonicalUrlHash: "urlhash:abc",
      contentHash: "contenthash:def",
      fetchedAt: generatedAt
    });

    expect(replayRef).toMatch(/^evidence_replay_ref:[a-f0-9]{16}$/);
    expect(productionEvidenceReplayRef({
      sourceId: "src_static",
      canonicalUrlHash: "urlhash:abc",
      contentHash: "contenthash:def",
      fetchedAt: generatedAt
    })).toBe(replayRef);
  });
});
