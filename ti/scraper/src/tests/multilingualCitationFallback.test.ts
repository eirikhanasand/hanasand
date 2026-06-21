import { describe, expect, test } from "bun:test";
import { buildTranslationHandoffPacket } from "../adapters/multilingualReportHandoff.ts";
import { generatedAt, item, profile, source } from "./helpers/multilingualFixtures.ts";

describe("multilingual citation fallback", () => {
  test("preserves parser fallback and quality impact when citation spans are inferred", () => {
    const text = "La amenaza publicó indicadores. La campaña usó infraestructura compartida.";
    const src = source("src_span_inference", "static_web", "https://reports.example.test/es-span", "es");
    const collected = { ...item(src, text, "es"), metadata: {} };
    const packet = buildTranslationHandoffPacket({ generatedAt, source: src, item: collected, sourceFamily: "static_html", parserProfile: profile(src, text), requestedLanguage: "nb" });

    expect(packet.citationSpans).toHaveLength(1);
    expect(packet.citationSpans[0]?.label).toBe("lead_sentence");
    expect(packet.language.requested).toBe("nb");
    expect(packet.sourceLanguageScoring.requestedLanguageFit).toBeLessThan(0.7);
    expect(packet.sourceLanguageScoring.translationPriority).toBe("normal");
    expect(packet.handoffs.agent04CoverageGaps).toBe("translation_gap");
    expect(packet.handoffs.agent07Quality).toBe("review_translation");
    expect(packet.extraction.parserWarnings).toContain("translation handoff required for es->en");
  });
});
