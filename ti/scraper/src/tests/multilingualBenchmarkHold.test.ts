import { describe, expect, test } from "bun:test";
import { buildMultilingualParserConfidenceBenchmark, buildTranslationHandoffPacket, type TranslationHandoffPacketDto } from "../adapters/multilingualReportHandoff.ts";
import { generatedAt, item, profile, source } from "./helpers/multilingualFixtures.ts";

describe("multilingual benchmark hold", () => {
  test("holds when low-confidence packets lack citation spans", () => {
    const src = source("src_low_confidence", "static_web", "https://reports.example.test/low", "es");
    const packet = buildTranslationHandoffPacket({
      generatedAt,
      source: src,
      item: { ...item(src, "La amenaza publicó indicadores.", "es"), metadata: {} },
      sourceFamily: "static_html",
      parserProfile: { ...profile(src, "La amenaza publicó indicadores."), extractionScore: 0.48 },
      requestedLanguage: "en"
    });
    const benchmark = buildMultilingualParserConfidenceBenchmark({ generatedAt, packets: [{ ...packet, citationSpans: [] } satisfies TranslationHandoffPacketDto] });

    expect(benchmark.status).toBe("hold");
    expect(benchmark.summary.citationSpanCoverage).toBe(0);
    expect(benchmark.rows[0]).toMatchObject({ status: "hold", blockers: expect.arrayContaining(["minimum_adjusted_confidence_below_hold_threshold", "citation_span_coverage_below_hold_threshold"]) });
  });
});
