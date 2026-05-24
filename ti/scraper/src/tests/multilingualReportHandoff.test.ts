import { describe, expect, test } from "bun:test";
import {
  buildMultilingualParserConfidenceBenchmark,
  buildTranslationHandoffPacket,
  detectPublicReportLanguage,
  type PublicReportLanguageCode,
  type TranslationHandoffPacketDto
} from "../adapters/multilingualReportHandoff.ts";
import { selectParserProfile, type ParserProfileDecision } from "../adapters/parserProfiles.ts";
import type { AdapterObservatorySourceFamily } from "../adapters/adapterFailureObservatory.ts";
import type { CollectedItem, SourceRecord, SourceType } from "../types.ts";
import { hashContent } from "../utils.ts";

const generatedAt = "2026-05-24T14:00:00.000Z";
const createdAt = new Date(0).toISOString();

function source(id: string, type: SourceType, url: string, language?: string): SourceRecord {
  return {
    id,
    name: id.replaceAll("_", " "),
    type,
    url,
    accessMethod: type === "telegram_public" ? "official_api" : "public_http",
    status: "active",
    risk: "low",
    trustScore: 0.84,
    language,
    crawlFrequencySeconds: 3600,
    legalNotes: "Public multilingual fixture.",
    createdAt,
    updatedAt: createdAt
  };
}

function item(src: SourceRecord, text: string, language?: string): CollectedItem {
  return {
    sourceId: src.id,
    taskId: `task_${src.id}`,
    url: src.url,
    title: src.name,
    rawText: text,
    collectedAt: generatedAt,
    publishedAt: "2026-05-23T00:00:00.000Z",
    contentHash: hashContent(text),
    language,
    links: [],
    metadata: {
      citationSpans: [{ start: 0, end: Math.min(48, text.length), label: "lead_sentence" }]
    },
    sensitive: false
  };
}

function profile(src: SourceRecord, text: string, options: {
  contentType?: string;
  requiresJavascript?: boolean;
  publicChannelHandoff?: boolean;
} = {}): ParserProfileDecision {
  return selectParserProfile({
    sourceType: src.type,
    url: src.url,
    contentType: options.contentType ?? (src.type === "rss" ? "application/rss+xml" : src.type === "pdf" ? "application/pdf" : "text/html"),
    requiresJavascript: options.requiresJavascript,
    publicChannelHandoff: options.publicChannelHandoff,
    textSample: text,
    language: src.language
  });
}

describe("multilingual public report translation handoff", () => {
  test("detects public CTI report languages and emits translation handoffs without raw text or URLs", () => {
    const fixtures: Array<{
      label: string;
      type: SourceType;
      family: AdapterObservatorySourceFamily;
      language?: PublicReportLanguageCode;
      text: string;
      expected: PublicReportLanguageCode;
      translationNeeded: boolean;
      options?: { contentType?: string; requiresJavascript?: boolean; publicChannelHandoff?: boolean };
    }> = [
      {
        label: "English HTML",
        type: "static_web",
        family: "static_html",
        language: "en",
        text: "APT29 threat advisory describes vulnerability exploitation, malware staging, and indicators.",
        expected: "en",
        translationNeeded: false
      },
      {
        label: "Norwegian RSS",
        type: "rss",
        family: "rss_feed",
        language: "nb",
        text: "Nasjonal trusselaktør utnyttet sårbarhet mot offentlig sektor og delte indikatorer.",
        expected: "nb",
        translationNeeded: true
      },
      {
        label: "Russian dynamic page",
        type: "dynamic_web",
        family: "dynamic_page",
        language: "ru",
        text: "Группа описала атаку на инфраструктуру и новые индикаторы компрометации.",
        expected: "ru",
        translationNeeded: true,
        options: { requiresJavascript: true }
      },
      {
        label: "Chinese PDF",
        type: "pdf",
        family: "pdf_report",
        language: "zh",
        text: "报告描述了攻击活动、漏洞利用、基础设施和防御建议。",
        expected: "zh",
        translationNeeded: true,
        options: { contentType: "application/pdf" }
      },
      {
        label: "Persian advisory",
        type: "api",
        family: "advisory_signal",
        language: "fa",
        text: "گزارش درباره حمله، زیرساخت و شاخص‌های نفوذ توضیح می‌دهد.",
        expected: "fa",
        translationNeeded: true,
        options: { contentType: "application/json" }
      },
      {
        label: "Spanish public channel handoff",
        type: "telegram_public",
        family: "public_channel",
        language: "es",
        text: "La amenaza explotó una vulnerabilidad durante la campaña y publicó indicadores.",
        expected: "es",
        translationNeeded: true,
        options: { contentType: "application/json", publicChannelHandoff: true }
      },
      {
        label: "Mixed public report",
        type: "static_web",
        family: "static_html",
        text: "APT29 threat advisory includes инфраструктура and индикаторы from multiple sources.",
        expected: "mixed",
        translationNeeded: true
      }
    ];

    for (const fixture of fixtures) {
      const src = source(`src_${fixture.expected}_${fixture.type}`, fixture.type, `https://reports.example.test/${fixture.expected}`, fixture.language);
      const collected = item(src, fixture.text, fixture.language);
      const parserProfile = profile(src, fixture.text, fixture.options);
      const packet = buildTranslationHandoffPacket({
        generatedAt,
        source: src,
        item: collected,
        sourceFamily: fixture.family,
        parserProfile,
        declaredLanguage: fixture.language,
        requestedLanguage: "en"
      });

      expect(packet).toMatchObject({
        schemaVersion: "ti.translation_handoff.v1",
        sourceId: src.id,
        sourceFamily: fixture.family,
        parserProfile: parserProfile.profile,
        language: {
          original: fixture.expected,
          target: "en",
          translationNeeded: fixture.translationNeeded
        }
      });
      expect(packet.language.detected).toBe(fixture.expected);
      expect(packet.citationSpans).toEqual([{ start: 0, end: Math.min(48, fixture.text.length), label: "lead_sentence", sourceLanguage: fixture.expected, targetLanguage: "en" }]);
      expect(packet.contentHash).toBe(collected.contentHash);
      expect(packet.canonicalUrlHash).toStartWith("urlhash:");
      expect(packet.extraction.fallbackOrder).toEqual(parserProfile.fallbackOrder);
      expect(packet.extraction.adjustedParserConfidence).toBeLessThanOrEqual(packet.extraction.originalParserConfidence);
      expect(packet.handoffs.agent09ApiContracts).toBe("stable_multilingual_fields");
      expect(packet.routeContract.forbiddenFields).toContain("translationVendor");
      expect(JSON.stringify(packet)).not.toContain("https://");
      expect(JSON.stringify(packet)).not.toContain(fixture.text);
    }
  });

  test("preserves parser fallback and quality impact when citation spans are inferred", () => {
    const text = "La amenaza publicó indicadores. La campaña usó infraestructura compartida.";
    const src = source("src_span_inference", "static_web", "https://reports.example.test/es-span", "es");
    const collected = { ...item(src, text, "es"), metadata: {} };
    const parserProfile = profile(src, text);
    const packet = buildTranslationHandoffPacket({
      generatedAt,
      source: src,
      item: collected,
      sourceFamily: "static_html",
      parserProfile,
      requestedLanguage: "nb"
    });

    expect(packet.citationSpans).toHaveLength(1);
    expect(packet.citationSpans[0]?.label).toBe("lead_sentence");
    expect(packet.language.requested).toBe("nb");
    expect(packet.sourceLanguageScoring.requestedLanguageFit).toBeLessThan(0.7);
    expect(packet.sourceLanguageScoring.translationPriority).toBe("normal");
    expect(packet.handoffs.agent04CoverageGaps).toBe("translation_gap");
    expect(packet.handoffs.agent07Quality).toBe("review_translation");
    expect(packet.extraction.parserWarnings).toContain("translation handoff required for es->en");
  });

  test("language detector remains deterministic for supported fixture scripts", () => {
    expect(detectPublicReportLanguage("Группа описала атаку и индикаторы.").language).toBe("ru");
    expect(detectPublicReportLanguage("报告描述了攻击活动和基础设施。").language).toBe("zh");
    expect(detectPublicReportLanguage("گزارش درباره حمله توضیح می‌دهد.").language).toBe("fa");
    expect(detectPublicReportLanguage("Nasjonal trusselaktør utnyttet sårbarhet.").language).toBe("nb");
    expect(detectPublicReportLanguage("La amenaza explotó una vulnerabilidad.").language).toBe("es");
    expect(detectPublicReportLanguage("Threat advisory describes malware indicators.").language).toBe("en");
    expect(detectPublicReportLanguage("Threat advisory includes индикаторы.").language).toBe("mixed");
  });

  test("benchmarks multilingual parser confidence by language without raw text URLs or vendor coupling", () => {
    const packetFixtures: Array<{
      id: string;
      type: SourceType;
      family: AdapterObservatorySourceFamily;
      language?: PublicReportLanguageCode;
      text: string;
      options?: { contentType?: string; requiresJavascript?: boolean; publicChannelHandoff?: boolean };
    }> = [
      {
        id: "english_html",
        type: "static_web",
        family: "static_html",
        language: "en",
        text: "Threat advisory describes malware indicators and mitigations."
      },
      {
        id: "spanish_channel",
        type: "telegram_public",
        family: "public_channel",
        language: "es",
        text: "La amenaza explotó una vulnerabilidad durante la campaña y publicó indicadores.",
        options: { contentType: "application/json", publicChannelHandoff: true }
      },
      {
        id: "mixed_report",
        type: "static_web",
        family: "static_html",
        text: "Threat advisory includes индикаторы and shared infrastructure details."
      }
    ];
    const packets = packetFixtures.map((fixture) => {
      const src = source(`src_${fixture.id}`, fixture.type, `https://reports.example.test/${fixture.id}`, fixture.language);
      const collected = item(src, fixture.text, fixture.language);
      return buildTranslationHandoffPacket({
        generatedAt,
        source: src,
        item: collected,
        sourceFamily: fixture.family,
        parserProfile: profile(src, fixture.text, fixture.options),
        declaredLanguage: fixture.language,
        requestedLanguage: "en"
      });
    });
    const benchmark = buildMultilingualParserConfidenceBenchmark({
      generatedAt,
      packets,
      thresholds: {
        minAdjustedParserConfidence: 0.7,
        minCitationSpanCoverage: 1,
        maxHighPriorityTranslationRatio: 0.3,
        maxMixedLanguageRatio: 0.1
      }
    });

    expect(benchmark).toMatchObject({
      schemaVersion: "ti.multilingual_parser_confidence_benchmark.v1",
      status: "watch",
      summary: {
        packetCount: 3,
        translationNeededCount: 2,
        mixedLanguageCount: 1,
        highPriorityTranslationCount: 1,
        citationSpanCoverage: 1
      },
      handoffs: {
        agent09ApiContracts: "stable_multilingual_benchmark_fields",
        agent10Release: "watch"
      },
      safety: {
        publicOnly: true,
        rawTextExposed: false,
        translatedTextExposed: false,
        unsafeUrlExposed: false,
        vendorCoupling: false
      }
    });
    expect(benchmark.summary.languagesCovered).toEqual(expect.arrayContaining(["en", "es", "mixed"]));
    expect(benchmark.rows.find((row) => row.language === "mixed")).toMatchObject({
      status: "watch",
      mixedLanguageCount: 1,
      warnings: expect.arrayContaining(["high_priority_translation_ratio_above_target", "mixed_language_ratio_above_target"])
    });
    expect(benchmark.rows.every((row) => row.packetRefs.every((ref) => ref.startsWith("translation_ref:")))).toBe(true);
    expect(benchmark.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["translationVendor", "apiKey"]));
    const serialized = JSON.stringify(benchmark);
    for (const forbidden of ["https://", "Threat advisory", "La amenaza", "индикаторы"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test("holds multilingual benchmark when low-confidence packets lack citation spans", () => {
    const src = source("src_low_confidence", "static_web", "https://reports.example.test/low", "es");
    const packet = buildTranslationHandoffPacket({
      generatedAt,
      source: src,
      item: { ...item(src, "La amenaza publicó indicadores.", "es"), metadata: {} },
      sourceFamily: "static_html",
      parserProfile: {
        ...profile(src, "La amenaza publicó indicadores."),
        extractionScore: 0.48
      },
      requestedLanguage: "en"
    });
    const benchmark = buildMultilingualParserConfidenceBenchmark({
      generatedAt,
      packets: [{ ...packet, citationSpans: [] } satisfies TranslationHandoffPacketDto]
    });

    expect(benchmark.status).toBe("hold");
    expect(benchmark.summary.citationSpanCoverage).toBe(0);
    expect(benchmark.rows[0]).toMatchObject({
      status: "hold",
      blockers: expect.arrayContaining(["minimum_adjusted_confidence_below_hold_threshold", "citation_span_coverage_below_hold_threshold"])
    });
  });
});
