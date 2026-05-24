import { describe, expect, test } from "bun:test";
import {
  buildAdapterFailureObservation,
  buildAdapterFailureObservatory,
  buildAdapterProductionReadinessPacket,
  type AdapterFailureClass,
  type AdapterObservatoryQueryClass
} from "../adapters/adapterFailureObservatory.ts";
import { browserWorkerIsolationPlan } from "../adapters/browserWorkerIsolation.ts";
import { selectParserProfile, type ParserFailureCategory, type ParserProfileDecision } from "../adapters/parserProfiles.ts";
import type { AdapterRunResult, CollectedItem, SourceRecord, SourceStatus, SourceType } from "../types.ts";
import { hashContent } from "../utils.ts";

const generatedAt = "2026-05-24T12:00:00.000Z";
const createdAt = new Date(0).toISOString();

function source(input: {
  id: string;
  type: SourceType;
  url: string;
  status?: SourceStatus;
  metadata?: Record<string, unknown>;
}): SourceRecord {
  return {
    id: input.id,
    name: input.id.replaceAll("_", " "),
    type: input.type,
    url: input.url,
    accessMethod: input.type === "telegram_public" ? "official_api" : "public_http",
    status: input.status ?? "active",
    risk: "low",
    trustScore: 0.84,
    language: "en",
    crawlFrequencySeconds: 3600,
    legalNotes: "Public collection fixture with robots/legal notes.",
    createdAt,
    updatedAt: createdAt,
    metadata: input.metadata
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
    language: "en",
    links: [],
    metadata: { parserWarnings: [] },
    sensitive: false
  };
}

function result(src: SourceRecord, options: {
  text?: string;
  warning?: string;
  failureCategory?: ParserFailureCategory | string;
  canonicalUrl?: string;
} = {}): AdapterRunResult {
  return {
    items: options.text ? [item(src, options.text)] : [],
    discovered: [],
    warnings: options.warning ? [options.warning] : [],
    metadata: {
      ...(options.failureCategory ? { failureCategory: options.failureCategory } : {}),
      ...(options.canonicalUrl ? { canonicalUrl: options.canonicalUrl } : {})
    }
  };
}

function profile(src: SourceRecord, options: {
  contentType?: string;
  text?: string;
  requiresJavascript?: boolean;
  publicChannelHandoff?: boolean;
  parserWarnings?: string[];
  failureCategory?: ParserFailureCategory;
} = {}): ParserProfileDecision {
  return selectParserProfile({
    sourceType: src.type,
    url: src.url,
    contentType: options.contentType ?? (src.type === "rss" ? "application/rss+xml" : src.type === "pdf" ? "application/pdf" : "text/html"),
    textSample: options.text ?? "Threat report fixture text covering actor activity, CVE exploitation, malware tooling, sectors, and mitigations.",
    requiresJavascript: options.requiresJavascript,
    publicChannelHandoff: options.publicChannelHandoff,
    parserWarnings: options.parserWarnings,
    failureCategory: options.failureCategory,
    language: "en"
  });
}

describe("adapter failure observatory", () => {
  test("classifies production public-source fixture failures and emits route-safe DTOs", () => {
    const fixtures: Array<{
      label: string;
      queryClass: AdapterObservatoryQueryClass;
      source: SourceRecord;
      run: AdapterRunResult;
      profile: ParserProfileDecision;
      expected: AdapterFailureClass;
      retryAfterSeconds?: number;
      staleDate?: string;
      duplicateRate?: number;
      noiseRate?: number;
      contentType?: string;
      contentLengthBytes?: number;
      maxBytes?: number;
    }> = [];

    const apt29 = source({ id: "src_apt29_vendor_static", type: "static_web", url: "https://vendor.example.test/research/apt29" });
    fixtures.push({
      label: "APT29 vendor HTML",
      queryClass: "actor",
      source: apt29,
      run: result(apt29, { text: "APT29 campaign report with observed infrastructure, malware, CVEs, and defensive guidance." }),
      profile: profile(apt29),
      expected: "ok"
    });

    const apt42 = source({ id: "src_apt42_dynamic", type: "dynamic_web", url: "https://vendor.example.test/research/apt42" });
    fixtures.push({
      label: "APT42 dynamic timeout",
      queryClass: "actor",
      source: apt42,
      run: result(apt42, { failureCategory: "timeout", canonicalUrl: apt42.url }),
      profile: profile(apt42, { requiresJavascript: true }),
      expected: "timeout"
    });

    const ransom = source({ id: "src_ransomware_rss", type: "rss", url: "https://ransom.example.test/feed.xml" });
    fixtures.push({
      label: "ransomware feed stale",
      queryClass: "ransomware",
      source: ransom,
      run: result(ransom, { canonicalUrl: ransom.url }),
      profile: profile(ransom),
      expected: "stale_source",
      staleDate: "2026-04-01T00:00:00.000Z"
    });

    const cve = source({ id: "src_cve_advisory", type: "api", url: "https://advisories.example.test/cve-2026-1000.json" });
    fixtures.push({
      label: "CVE advisory rate-limited",
      queryClass: "cve",
      source: cve,
      run: result(cve, { canonicalUrl: cve.url }),
      profile: profile(cve, { contentType: "application/json" }),
      expected: "rate_limited",
      retryAfterSeconds: 180
    });

    const malware = source({ id: "src_malware_tool_zip", type: "static_web", url: "https://tools.example.test/downloads/tool.zip" });
    fixtures.push({
      label: "malware/tool unsupported media",
      queryClass: "malware_tool",
      source: malware,
      run: result(malware, { canonicalUrl: malware.url }),
      profile: profile(malware),
      expected: "unsupported_media",
      contentType: "application/zip"
    });

    const country = source({ id: "src_country_public_channel", type: "telegram_public", url: "https://t.me/public_country_cti" });
    fixtures.push({
      label: "country public channel handoff parser gap",
      queryClass: "country",
      source: country,
      run: result(country, { warning: "parser gap: country/sector channel schema missing", canonicalUrl: country.url }),
      profile: profile(country, { contentType: "application/json", publicChannelHandoff: true, parserWarnings: ["parser gap: normalized public channel fields missing"] }),
      expected: "parser_gap"
    });

    const sector = source({ id: "src_sector_public_channel", type: "telegram_public", url: "https://t.me/public_sector_cti" });
    fixtures.push({
      label: "sector public channel duplicate canonical",
      queryClass: "sector",
      source: sector,
      run: result(sector, { canonicalUrl: "https://vendor.example.test/shared-report" }),
      profile: profile(sector, { contentType: "application/json", publicChannelHandoff: true }),
      expected: "duplicate_canonical",
      duplicateRate: 0.9
    });

    const vendorPdf = source({ id: "src_vendor_report_pdf", type: "pdf", url: "https://vendor.example.test/reports/long.pdf" });
    fixtures.push({
      label: "vendor report content too large",
      queryClass: "vendor_report",
      source: vendorPdf,
      run: result(vendorPdf, { canonicalUrl: vendorPdf.url }),
      profile: profile(vendorPdf),
      expected: "content_too_large",
      contentType: "application/pdf",
      contentLengthBytes: 5_000_001,
      maxBytes: 5_000_000
    });

    const cert = source({ id: "src_cert_policy_hold", type: "static_web", url: "https://cert.example.test/advisories/ta26-001", metadata: { robotsReviewState: "hold" } });
    fixtures.push({
      label: "CERT advisory robots hold",
      queryClass: "cert_advisory",
      source: cert,
      run: result(cert, { failureCategory: "robots_policy_hold", canonicalUrl: cert.url }),
      profile: profile(cert, { failureCategory: "robots_policy_hold" }),
      expected: "robots_policy_hold"
    });

    const unavailable = source({ id: "src_unavailable_vendor", type: "static_web", url: "https://vendor.example.test/unavailable" });
    fixtures.push({
      label: "unavailable source",
      queryClass: "vendor_report",
      source: unavailable,
      run: result(unavailable, { failureCategory: "unavailable", canonicalUrl: unavailable.url }),
      profile: profile(unavailable),
      expected: "unavailable"
    });

    const disabled = source({ id: "src_disabled_vendor", type: "static_web", url: "https://vendor.example.test/disabled", status: "disabled" });
    fixtures.push({
      label: "source disabled",
      queryClass: "vendor_report",
      source: disabled,
      run: result(disabled, { canonicalUrl: disabled.url }),
      profile: profile(disabled),
      expected: "source_disabled"
    });

    const empty = source({ id: "src_empty_static", type: "static_web", url: "https://vendor.example.test/empty" });
    fixtures.push({
      label: "empty capture",
      queryClass: "unknown",
      source: empty,
      run: result(empty, { failureCategory: "unknown_new_failure", canonicalUrl: empty.url }),
      profile: profile(empty),
      expected: "empty_capture"
    });

    const noisy = source({ id: "src_noisy_feed", type: "rss", url: "https://news.example.test/noisy.xml" });
    fixtures.push({
      label: "noisy RSS",
      queryClass: "ransomware",
      source: noisy,
      run: result(noisy, { canonicalUrl: noisy.url }),
      profile: profile(noisy),
      expected: "noisy_source",
      noiseRate: 0.8
    });

    const lowConfidence = source({ id: "src_low_confidence", type: "static_web", url: "https://vendor.example.test/low-confidence" });
    fixtures.push({
      label: "parser confidence low",
      queryClass: "actor",
      source: lowConfidence,
      run: result(lowConfidence, { failureCategory: "parser_confidence_low", canonicalUrl: lowConfidence.url }),
      profile: profile(lowConfidence, { text: "tiny", failureCategory: "parser_confidence_low" }),
      expected: "parser_confidence_low"
    });

    const observations = fixtures.map((fixture) => buildAdapterFailureObservation({
      generatedAt,
      queryClass: fixture.queryClass,
      source: fixture.source,
      result: fixture.run,
      profile: fixture.profile,
      retryAfterSeconds: fixture.retryAfterSeconds,
      staleDate: fixture.staleDate,
      duplicateRate: fixture.duplicateRate,
      noiseRate: fixture.noiseRate,
      contentType: fixture.contentType,
      contentLengthBytes: fixture.contentLengthBytes,
      maxBytes: fixture.maxBytes
    }));

    expect(observations.map((observation) => observation.failureClass)).toEqual(fixtures.map((fixture) => fixture.expected));
    expect(observations.every((observation) => observation.canonicalUrlHash?.startsWith("urlhash:"))).toBe(true);
    expect(JSON.stringify(observations)).not.toContain("https://");
    expect(JSON.stringify(observations)).not.toContain(".onion");

    const byFailure = new Map(observations.map((observation) => [observation.failureClass, observation]));
    expect(byFailure.get("rate_limited")?.handoffs.agent02Scheduling).toBe("retry_after");
    expect(byFailure.get("parser_gap")?.handoffs.agent07QualityGate).toBe("parser_gap");
    expect(byFailure.get("duplicate_canonical")?.handoffs.agent06EvidenceRetention).toBe("suppress_duplicate");
    expect(byFailure.get("robots_policy_hold")?.diagnostics.robotsLegalHold).toBe(true);
    expect(byFailure.get("unsupported_media")?.diagnostics.unsupportedMime).toBe("application/zip");

    const observatory = buildAdapterFailureObservatory({ generatedAt, observations });
    expect(observatory).toMatchObject({
      schemaVersion: "ti.adapter_failure_observatory.v1",
      summary: {
        total: fixtures.length,
        ok: 1
      },
      routeContract: {
        safeForPublicApi: true
      }
    });
    expect(observatory.summary.failureClasses.parser_gap).toBe(1);
    expect(observatory.summary.parserProfiles.public_channel_handoff).toBe(2);
    expect(observatory.summary.sourceFamilies.public_channel).toBe(2);
    expect(observatory.routeContract.forbiddenFields).toContain("rawText");
    expect(observatory.routeContract.forbiddenFields).toContain("onionUrl");
  });

  test("emits production readiness packet with dynamic browser workers disabled and API handoff notes", () => {
    const src = source({ id: "src_ready_static", type: "static_web", url: "https://vendor.example.test/ready" });
    const observation = buildAdapterFailureObservation({
      generatedAt,
      source: src,
      result: result(src, { text: "APT29 public report fixture with enough detail for extraction and routing." }),
      profile: profile(src),
      queryClass: "actor"
    });
    const observatory = buildAdapterFailureObservatory({ generatedAt, observations: [observation] });
    const packet = buildAdapterProductionReadinessPacket({
      generatedAt,
      observatory,
      browserPlan: browserWorkerIsolationPlan({
        enabled: true,
        maxWorkers: 4,
        memoryCapMb: 1024,
        timeoutMs: 15_000,
        allowedHosts: ["vendor.example.test"],
        robotsAllowed: true,
        legalNotes: "Public dynamic worker canary notes."
      })
    });

    expect(packet.browserWorkers).toMatchObject({
      enabled: false,
      workerPool: "dynamic_public_browser",
      maxWorkers: 4,
      memoryCapMb: 1024,
      timeoutMs: 15_000,
      hostAllowlist: ["vendor.example.test"]
    });
    expect(packet.safetyDefaults).toMatchObject({
      publicOnly: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noPrivateCommunities: true,
      unsafeUrlExposed: false
    });
    expect(packet.enablementGate).toEqual({
      readyForCanary: true,
      blockers: [],
      warnings: []
    });
    expect(packet.agentHandoffs.agent09[0]).toContain("routeContract.stableFields");
  });
});
