import { describe, expect, test } from "bun:test";
import { buildMultilingualParserConfidenceBenchmark, buildTranslationHandoffPacket } from "../adapters/multilingualReportHandoff.ts";
import { benchmarkCases } from "./helpers/multilingualCases.ts";
import { generatedAt, item, profile, source } from "./helpers/multilingualFixtures.ts";

describe("multilingual benchmark watch", () => {
  test("benchmarks parser confidence by language without raw text URLs or vendor coupling", () => {
    const packets = benchmarkCases.map((fixture) => {
      const src = source(`src_${fixture.id}`, fixture.type, `https://reports.example.test/${fixture.id}`, fixture.language);
      return buildTranslationHandoffPacket({ generatedAt, source: src, item: item(src, fixture.text, fixture.language), sourceFamily: fixture.family, parserProfile: profile(src, fixture.text, fixture.options), declaredLanguage: fixture.language, requestedLanguage: "en" });
    });
    const benchmark = buildMultilingualParserConfidenceBenchmark({ generatedAt, packets, thresholds: { minAdjustedParserConfidence: 0.7, minCitationSpanCoverage: 1, maxHighPriorityTranslationRatio: 0.3, maxMixedLanguageRatio: 0.1 } });

    expect(benchmark).toMatchObject({ schemaVersion: "ti.multilingual_parser_confidence_benchmark.v1", status: "watch", summary: { packetCount: 3, translationNeededCount: 2, mixedLanguageCount: 1, highPriorityTranslationCount: 1, citationSpanCoverage: 1 }, handoffs: { agent09ApiContracts: "stable_multilingual_benchmark_fields", agent10Release: "watch" }, safety: { publicOnly: true, rawTextExposed: false, translatedTextExposed: false, unsafeUrlExposed: false, vendorCoupling: false } });
    expect(benchmark.summary.languagesCovered).toEqual(expect.arrayContaining(["en", "es", "mixed"]));
    expect(benchmark.rows.find((row) => row.language === "mixed")).toMatchObject({ status: "watch", mixedLanguageCount: 1, warnings: expect.arrayContaining(["high_priority_translation_ratio_above_target", "mixed_language_ratio_above_target"]) });
    expect(benchmark.rows.every((row) => row.packetRefs.every((ref) => ref.startsWith("translation_ref:")))).toBe(true);
    expect(benchmark.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["translationVendor", "apiKey"]));
    for (const forbidden of ["https://", "Threat advisory", "La amenaza", "индикаторы"]) expect(JSON.stringify(benchmark)).not.toContain(forbidden);
  });
});
