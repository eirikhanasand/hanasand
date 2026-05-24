import { describe, expect, test } from "bun:test";
import {
  buildAdapterFailureObservation,
  buildAdapterFailureObservatory,
  type AdapterObservatoryQueryClass,
  type AdapterObservatorySourceFamily
} from "../adapters/adapterFailureObservatory.ts";
import { buildAdapterRuntimeEnablementPacket, type AdapterRuntimeCanarySourceInput } from "../adapters/adapterRuntimeEnablement.ts";
import { browserWorkerIsolationPlan } from "../adapters/browserWorkerIsolation.ts";
import { selectParserProfile, type ParserProfileDecision } from "../adapters/parserProfiles.ts";
import type { AdapterRunResult, CollectedItem, SourceRecord, SourceType } from "../types.ts";
import { hashContent } from "../utils.ts";

const generatedAt = "2026-05-24T13:00:00.000Z";
const createdAt = new Date(0).toISOString();

function source(id: string, type: SourceType, url: string, legalNotes = "Public collection legal notes."): SourceRecord {
  return {
    id,
    name: id.replaceAll("_", " "),
    type,
    url,
    accessMethod: type === "telegram_public" ? "official_api" : "public_http",
    status: "active",
    risk: "low",
    trustScore: 0.86,
    language: "en",
    crawlFrequencySeconds: 3600,
    legalNotes,
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
    publishedAt: "2026-05-23T00:00:00.000Z",
    contentHash: hashContent(text),
    language: "en",
    links: [],
    metadata: {},
    sensitive: false
  };
}

function result(src: SourceRecord, text = "Public CTI source fixture with actor, CVE, malware, sector, and mitigation details."): AdapterRunResult {
  return { items: [item(src, text)], discovered: [], warnings: [], metadata: {} };
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
    textSample: options.text ?? "Public CTI source fixture with enough detail to clear parser confidence gates and evidence yield checks.",
    language: "en"
  });
}

function canary(input: {
  source: SourceRecord;
  sourceFamily: AdapterObservatorySourceFamily;
  parserProfile: ParserProfileDecision;
  maxBytes?: number;
  observedContentLengthBytes?: number;
  expectedEvidenceYield?: number;
  robotsAllowed?: boolean;
  legalNotesPresent?: boolean;
}): AdapterRuntimeCanarySourceInput {
  return {
    source: input.source,
    sourceFamily: input.sourceFamily,
    parserProfile: input.parserProfile,
    canonicalUrl: input.source.url,
    robotsAllowed: input.robotsAllowed ?? true,
    legalNotesPresent: input.legalNotesPresent ?? true,
    maxBytes: input.maxBytes ?? 5_000_000,
    observedContentLengthBytes: input.observedContentLengthBytes ?? 100_000,
    expectedEvidenceYield: input.expectedEvidenceYield ?? 0.82
  };
}

function healthyObservatory(fixtures: Array<{
  src: SourceRecord;
  sourceFamily?: AdapterObservatorySourceFamily;
  queryClass: AdapterObservatoryQueryClass;
  parserProfile: ParserProfileDecision;
}> = []) {
  const observations = fixtures.map((fixture) => buildAdapterFailureObservation({
    generatedAt,
    source: fixture.src,
    sourceFamily: fixture.sourceFamily,
    queryClass: fixture.queryClass,
    result: result(fixture.src),
    profile: fixture.parserProfile
  }));
  return buildAdapterFailureObservatory({ generatedAt, observations });
}

function defaultThresholds() {
  return {
    staticMinParserConfidence: 0.65,
    rssMinParserConfidence: 0.65,
    dynamicMinParserConfidence: 0.72,
    pdfMinParserConfidence: 0.72,
    publicChannelMinParserConfidence: 0.65,
    advisoryMinParserConfidence: 0.65,
    maxWatchFailureRatio: 0.35,
    maxBlockedFailureRatio: 0.05,
    minEvidenceYield: 0.5
  };
}

function defaultPoolCaps() {
  return {
    staticMaxWorkers: 32,
    rssMaxWorkers: 24,
    dynamicMaxWorkers: 2,
    pdfMaxWorkers: 4,
    publicChannelMaxWorkers: 4,
    advisoryMaxWorkers: 8,
    memoryCapMb: 1024,
    timeoutMs: 20_000,
    maxBytes: 5_000_000
  };
}

describe("adapter runtime enablement", () => {
  test("builds a canary runtime packet with disabled dynamic browser defaults and route-safe hashes", () => {
    const staticSource = source("src_static_apt29", "static_web", "https://vendor.example.test/apt29");
    const rssSource = source("src_rss_ransomware", "rss", "https://ransom.example.test/feed.xml");
    const dynamicSource = source("src_dynamic_apt42", "dynamic_web", "https://vendor.example.test/apt42");
    const pdfSource = source("src_pdf_vendor_report", "pdf", "https://vendor.example.test/report.pdf");
    const channelSource = source("src_public_channel", "telegram_public", "https://t.me/public_cti");
    const advisorySource = source("src_cert_advisory", "api", "https://cert.example.test/advisory.json");

    const staticProfile = profile(staticSource);
    const rssProfile = profile(rssSource);
    const dynamicProfile = profile(dynamicSource, { requiresJavascript: true });
    const pdfProfile = profile(pdfSource);
    const channelProfile = profile(channelSource, { contentType: "application/json", publicChannelHandoff: true });
    const advisoryProfile = profile(advisorySource);

    const observatory = healthyObservatory([
      { src: staticSource, sourceFamily: "static_html", queryClass: "actor", parserProfile: staticProfile },
      { src: rssSource, sourceFamily: "rss_feed", queryClass: "ransomware", parserProfile: rssProfile },
      { src: dynamicSource, sourceFamily: "dynamic_page", queryClass: "actor", parserProfile: dynamicProfile },
      { src: pdfSource, sourceFamily: "pdf_report", queryClass: "vendor_report", parserProfile: pdfProfile },
      { src: channelSource, sourceFamily: "public_channel", queryClass: "country", parserProfile: channelProfile },
      { src: advisorySource, sourceFamily: "advisory_signal", queryClass: "cert_advisory", parserProfile: advisoryProfile }
    ]);
    const packet = buildAdapterRuntimeEnablementPacket({
      generatedAt,
      observatory,
      browserPlan: browserWorkerIsolationPlan({
        enabled: true,
        maxWorkers: 2,
        memoryCapMb: 768,
        timeoutMs: 15_000,
        allowedHosts: ["vendor.example.test"],
        robotsAllowed: true,
        legalNotes: "Public dynamic canary notes."
      }),
      canarySources: [
        canary({ source: staticSource, sourceFamily: "static_html", parserProfile: staticProfile }),
        canary({ source: rssSource, sourceFamily: "rss_feed", parserProfile: rssProfile }),
        canary({ source: dynamicSource, sourceFamily: "dynamic_page", parserProfile: dynamicProfile }),
        canary({ source: pdfSource, sourceFamily: "pdf_report", parserProfile: pdfProfile }),
        canary({ source: channelSource, sourceFamily: "public_channel", parserProfile: channelProfile }),
        canary({ source: advisorySource, sourceFamily: "advisory_signal", parserProfile: advisoryProfile })
      ],
      poolCaps: defaultPoolCaps(),
      thresholds: defaultThresholds()
    });

    expect(packet.schemaVersion).toBe("ti.adapter_runtime_enablement_packet.v1");
    expect(packet.readyForCanary).toBe(true);
    expect(packet.readyForDefaultEnablement).toBe(false);
    expect(packet.rolloutControls).toMatchObject({
      browserWorkersEnabled: false,
      dynamicRequiresExplicitAllocation: true,
      screenshotStorage: "hash_only"
    });
    expect(packet.summary).toMatchObject({ totalAdapters: 6, enabled: 3, canaryOnly: 3, blocked: 0 });
    expect(packet.readiness.find((entry) => entry.adapter === "dynamic_public_browser")).toMatchObject({
      readiness: "canary_only",
      enabledByDefault: false,
      canaryOnly: true,
      gates: {
        browserDisabledByDefault: true,
        screenshotHashOnly: true
      },
      handoffs: {
        agent06EvidenceStorage: "hash_only_screenshots",
        agent09ApiContracts: "canary_only"
      }
    });
    expect(packet.readiness.find((entry) => entry.adapter === "pdf_report")?.workerPool.maxBytes).toBe(5_000_000);
    expect(packet.rolloutControls.canaryUrlHashes.every((value) => value.startsWith("urlhash:"))).toBe(true);
    expect(JSON.stringify(packet)).not.toContain("https://");
    expect(JSON.stringify(packet)).not.toContain(".onion");
    expect(packet.routeContract.forbiddenFields).toContain("screenshotBytes");
    expect(packet.safety).toMatchObject({
      publicOnly: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noPrivateCommunities: true,
      noExploitPayloadDownload: true,
      noRestrictedRawMaterial: true,
      unsafeUrlExposed: false
    });
  });

  test("blocks runtime enablement on allowlist, parser confidence, byte caps, policy, and observatory failures", () => {
    const staticSource = source("src_static_low", "static_web", "https://vendor.example.test/low");
    const dynamicSource = source("src_dynamic_policy", "dynamic_web", "https://vendor.example.test/dynamic");
    const pdfSource = source("src_pdf_large", "pdf", "https://vendor.example.test/large.pdf");
    const staticProfile = profile(staticSource, { text: "tiny" });
    const dynamicProfile = profile(dynamicSource, { requiresJavascript: true });
    const pdfProfile = profile(pdfSource);
    const blockedObservation = buildAdapterFailureObservation({
      generatedAt,
      source: staticSource,
      sourceFamily: "static_html",
      queryClass: "actor",
      result: { items: [], discovered: [], warnings: [], metadata: { failureCategory: "parser_confidence_low", canonicalUrl: staticSource.url } },
      profile: staticProfile
    });
    const observatory = buildAdapterFailureObservatory({ generatedAt, observations: [blockedObservation] });

    const packet = buildAdapterRuntimeEnablementPacket({
      generatedAt,
      observatory,
      browserPlan: browserWorkerIsolationPlan({
        enabled: true,
        maxWorkers: 4,
        memoryCapMb: 2048,
        timeoutMs: 30_000,
        allowedHosts: ["vendor.example.test"],
        robotsAllowed: false,
        legalNotes: ""
      }),
      canarySources: [
        canary({ source: staticSource, sourceFamily: "static_html", parserProfile: staticProfile, expectedEvidenceYield: 0.2 }),
        canary({ source: dynamicSource, sourceFamily: "dynamic_page", parserProfile: dynamicProfile, robotsAllowed: false, legalNotesPresent: false }),
        canary({ source: pdfSource, sourceFamily: "pdf_report", parserProfile: pdfProfile, observedContentLengthBytes: 8_000_000, maxBytes: 5_000_000 })
      ],
      poolCaps: { ...defaultPoolCaps(), memoryCapMb: 512, timeoutMs: 10_000, maxBytes: 5_000_000 },
      thresholds: { ...defaultThresholds(), staticMinParserConfidence: 0.9, maxBlockedFailureRatio: 0 }
    });

    const staticReadiness = packet.readiness.find((entry) => entry.adapter === "static_html");
    const dynamicReadiness = packet.readiness.find((entry) => entry.adapter === "dynamic_public_browser");
    const pdfReadiness = packet.readiness.find((entry) => entry.adapter === "pdf_report");

    expect(packet.readyForCanary).toBe(false);
    expect(packet.summary.blocked).toBeGreaterThan(0);
    expect(staticReadiness?.readiness).toBe("blocked");
    expect(staticReadiness?.blockers).toContain("static_html_parser_confidence_below_threshold");
    expect(staticReadiness?.blockers).toContain("static_html_observatory_failure_ratio_high");
    expect(staticReadiness?.blockers).toContain("static_html_evidence_yield_low");
    expect(dynamicReadiness?.blockers).toContain("dynamic_public_browser_canary_allowlist_empty");
    expect(dynamicReadiness?.blockers).toContain("dynamic_public_browser_robots_policy_hold");
    expect(dynamicReadiness?.blockers).toContain("dynamic_public_browser_legal_notes_missing");
    expect(pdfReadiness?.blockers).toContain("pdf_report_byte_cap_exceeded");
    expect(packet.rolloutControls.rollbackTriggers).toContain("raw_screenshot_storage_attempt");
    expect(packet.agentHandoffs.agent10Observability[0]).toContain("rollbackTriggers");
    expect(JSON.stringify(packet)).not.toContain("https://");
  });
});
