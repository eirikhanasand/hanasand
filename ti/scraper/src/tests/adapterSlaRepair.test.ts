import { describe, expect, test } from "bun:test";
import {
  buildAdapterFailureObservation,
  type AdapterObservatoryQueryClass
} from "../adapters/adapterFailureObservatory.ts";
import { buildAdapterSlaRepairPacket } from "../adapters/adapterSlaRepair.ts";
import { buildTranslationHandoffPacket } from "../adapters/multilingualReportHandoff.ts";
import { selectParserProfile, type ParserFailureCategory, type ParserProfileDecision } from "../adapters/parserProfiles.ts";
import type { AdapterRunResult, CollectedItem, SourceRecord, SourceType } from "../types.ts";
import { hashContent } from "../utils.ts";

const generatedAt = "2026-05-24T16:00:00.000Z";
const createdAt = new Date(0).toISOString();

function source(id: string, type: SourceType, url: string, metadata?: Record<string, unknown>): SourceRecord {
  return {
    id,
    name: id.replaceAll("_", " "),
    type,
    url,
    accessMethod: type === "telegram_public" ? "official_api" : "public_http",
    status: "active",
    risk: "low",
    trustScore: 0.84,
    language: "en",
    crawlFrequencySeconds: 3600,
    legalNotes: "Public source fixture with legal notes.",
    createdAt,
    updatedAt: createdAt,
    metadata
  };
}

function item(src: SourceRecord, text: string, metadata: Record<string, unknown> = {}): CollectedItem {
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
    metadata,
    sensitive: false
  };
}

function result(src: SourceRecord, options: {
  text?: string;
  warnings?: string[];
  failureCategory?: ParserFailureCategory;
  canonicalUrl?: string;
  itemMetadata?: Record<string, unknown>;
} = {}): AdapterRunResult {
  return {
    items: options.text ? [item(src, options.text, options.itemMetadata)] : [],
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
  language?: string;
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
    language: options.language ?? src.language
  });
}

function observation(input: {
  src: SourceRecord;
  run: AdapterRunResult;
  prof: ParserProfileDecision;
  queryClass?: AdapterObservatoryQueryClass;
  retryAfterSeconds?: number;
  staleDate?: string;
  duplicateRate?: number;
  contentType?: string;
}): ReturnType<typeof buildAdapterFailureObservation> {
  return buildAdapterFailureObservation({
    generatedAt,
    source: input.src,
    result: input.run,
    profile: input.prof,
    queryClass: input.queryClass ?? "actor",
    retryAfterSeconds: input.retryAfterSeconds,
    staleDate: input.staleDate,
    duplicateRate: input.duplicateRate,
    contentType: input.contentType
  });
}

describe("adapter SLA repair packets", () => {
  test("classifies parser gaps, selector/readability failures, dynamic/PDF repair, and safe scheduler/evidence handoffs", () => {
    const staticSrc = source("src_static_selector", "static_web", "https://vendor.example.test/apt29");
    const rssSrc = source("src_rss_rate_limit", "rss", "https://news.example.test/feed.xml");
    const dynamicSrc = source("src_dynamic_empty", "dynamic_web", "https://dynamic.example.test/report");
    const pdfSrc = source("src_pdf_low_confidence", "pdf", "https://reports.example.test/report.pdf");
    const publicChannelSrc = source("src_public_channel_duplicate", "telegram_public", "https://t.me/public_cti");
    const mimeSrc = source("src_zip_target", "static_web", "https://vendor.example.test/report.zip");

    const observations = [
      observation({
        src: staticSrc,
        run: result(staticSrc, {
          warnings: ["parser gap: selector .article-body missing", "readability failure: boilerplate only"],
          canonicalUrl: staticSrc.url
        }),
        prof: profile(staticSrc, { parserWarnings: ["selector failure for vendor article"] })
      }),
      observation({
        src: rssSrc,
        run: result(rssSrc, { canonicalUrl: rssSrc.url }),
        prof: profile(rssSrc),
        queryClass: "ransomware",
        retryAfterSeconds: 120
      }),
      observation({
        src: dynamicSrc,
        run: result(dynamicSrc, { failureCategory: "timeout", canonicalUrl: dynamicSrc.url }),
        prof: profile(dynamicSrc, { requiresJavascript: true, failureCategory: "timeout" })
      }),
      observation({
        src: pdfSrc,
        run: result(pdfSrc, { failureCategory: "parser_confidence_low", canonicalUrl: pdfSrc.url }),
        prof: profile(pdfSrc, { text: "tiny", failureCategory: "parser_confidence_low" }),
        queryClass: "vendor_report"
      }),
      observation({
        src: publicChannelSrc,
        run: result(publicChannelSrc, { canonicalUrl: "https://vendor.example.test/shared" }),
        prof: profile(publicChannelSrc, { contentType: "application/json", publicChannelHandoff: true }),
        queryClass: "country",
        duplicateRate: 0.9
      }),
      observation({
        src: mimeSrc,
        run: result(mimeSrc, { canonicalUrl: mimeSrc.url }),
        prof: profile(mimeSrc),
        contentType: "application/zip"
      })
    ];

    const packet = buildAdapterSlaRepairPacket({ generatedAt, observations });
    const categories = packet.repairs.map((repair) => repair.category);

    expect(categories).toContain("parser_fixture_gap");
    expect(categories).toContain("selector_failure");
    expect(categories).toContain("readability_failure");
    expect(categories).toContain("scheduler_backoff");
    expect(categories).toContain("dynamic_render_failure");
    expect(categories).toContain("pdf_extraction_failure");
    expect(categories).toContain("evidence_duplicate_suppression");
    expect(categories).toContain("unsupported_mime_repair");
    expect(packet.readyForPromotion).toBe(false);
    expect(packet.summary.agentHandoffs.agent02).toContain("retry_after_until_repair_or_retry_after");
    expect(packet.summary.agentHandoffs.agent06).toContain("suppress_duplicate_canonical_hash");
    expect(packet.summary.agentHandoffs.agent07).toContain("repair_parser_fixture_or_selector");
    expect(packet.summary.agentHandoffs.agent09).toContain("adapter_repair.dynamic_render_failure");
    expect(packet.summary.agentHandoffs.agent10).toContain("adapter_sla_release_hold");

    const dynamicContract = packet.contracts.find((contract) => contract.adapter === "dynamic_public_browser");
    expect(dynamicContract).toMatchObject({
      browserWorkersEnabled: false,
      status: "hold",
      handoffs: {
        agent02Scheduler: "pause_or_reduce",
        agent10Runbooks: "release_hold"
      }
    });
    expect(dynamicContract?.breaches.map((breach) => breach.code)).toContain("timeout");

    const serialized = JSON.stringify(packet);
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain(".onion");
    expect(serialized).not.toContain("APT29 public report");
    expect(packet.routeContract.forbiddenFields).toContain("rawText");
    expect(packet.routeContract.compactApiProof).toEqual({
      noRawUrls: true,
      noRawText: true,
      noHtml: true,
      noPrivateAccess: true,
      dynamicBrowserDisabledByDefault: true,
      repairPacketsAreDryRun: true
    });
  });

  test("adds multilingual fallback repair when language detection drifts", () => {
    const src = source("src_mixed_language_report", "static_web", "https://vendor.example.test/mixed", { language: "es" });
    const text = "APT29 threat advisory. La amenaza usa infraestructura nueva y campaña activa.";
    const prof = profile(src, { text, language: "es" });
    const handoff = buildTranslationHandoffPacket({
      generatedAt,
      source: src,
      item: item(src, text),
      sourceFamily: "static_html",
      parserProfile: prof,
      declaredLanguage: "es",
      requestedLanguage: "en"
    });
    const packet = buildAdapterSlaRepairPacket({
      generatedAt,
      observations: [],
      translationHandoffs: [handoff]
    });

    expect(handoff.language.detected).toBe("mixed");
    expect(packet.repairs).toHaveLength(1);
    expect(packet.repairs[0]).toMatchObject({
      sourceId: "src_mixed_language_report",
      adapter: "multilingual_handoff",
      sourceFamily: "multilingual_handoff",
      parserProfile: "translation_handoff",
      category: "language_detection_drift",
      priority: "medium",
      canonicalUrlHash: expect.stringMatching(/^urlhash:/),
      evidence: {
        contentHashOnly: true,
        rawContentRequired: false
      },
      agentHandoffs: {
        agent07ExtractionQuality: "review_multilingual_fallback",
        agent09ApiWarningCode: "adapter_repair.language_detection_drift"
      }
    });

    const multilingualContract = packet.contracts.find((contract) => contract.adapter === "multilingual_handoff");
    expect(multilingualContract?.status).toBe("warn");
    expect(multilingualContract?.metrics).toMatchObject({
      translationNeededCount: 1,
      languageDriftCount: 1
    });
    expect(JSON.stringify(packet)).not.toContain("https://vendor.example.test/mixed");
  });

  test("passes clean RSS/static/advisory SLA contracts without repairs", () => {
    const staticSrc = source("src_static_clean", "static_web", "https://vendor.example.test/clean");
    const rssSrc = source("src_rss_clean", "rss", "https://news.example.test/feed.xml");
    const apiSrc = source("src_api_clean", "api", "https://advisories.example.test/cve.json");
    const observations = [
      observation({
        src: staticSrc,
        run: result(staticSrc, { text: "APT29 public report with malware, infrastructure, CVEs, mitigations, and sectors.", canonicalUrl: staticSrc.url }),
        prof: profile(staticSrc)
      }),
      observation({
        src: rssSrc,
        run: result(rssSrc, { text: "Ransomware incident summary with victim context, sectors, and defensive guidance.", canonicalUrl: rssSrc.url }),
        prof: profile(rssSrc),
        queryClass: "ransomware"
      }),
      observation({
        src: apiSrc,
        run: result(apiSrc, { text: "CVE advisory record with exploitation status, vendor mitigation, and affected products.", canonicalUrl: apiSrc.url }),
        prof: profile(apiSrc),
        queryClass: "cve"
      })
    ];

    const packet = buildAdapterSlaRepairPacket({ generatedAt, observations });
    expect(packet.repairs).toEqual([]);
    expect(packet.contracts.find((contract) => contract.adapter === "static_html")?.status).toBe("pass");
    expect(packet.contracts.find((contract) => contract.adapter === "rss_feed")?.status).toBe("pass");
    expect(packet.contracts.find((contract) => contract.adapter === "advisory_signal")?.status).toBe("pass");
    expect(packet.summary.canonicalUrlHashes.every((hash) => hash.startsWith("urlhash:"))).toBe(true);
  });
});
