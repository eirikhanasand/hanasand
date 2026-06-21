import { describe, expect, test } from "bun:test";
import { buildTranslationHandoffPacket } from "../adapters/multilingualReportHandoff.ts";
import { languageCases } from "./helpers/multilingualCases.ts";
import { generatedAt, item, profile, source } from "./helpers/multilingualFixtures.ts";

describe("multilingual translation handoff packets", () => {
  test("detects public CTI report languages without raw text or URLs", () => {
    for (const fixture of languageCases) {
      const src = source(`src_${fixture.expected}_${fixture.type}`, fixture.type, `https://reports.example.test/${fixture.expected}`, fixture.language);
      const collected = item(src, fixture.text, fixture.language);
      const parserProfile = profile(src, fixture.text, fixture.options);
      const packet = buildTranslationHandoffPacket({ generatedAt, source: src, item: collected, sourceFamily: fixture.family, parserProfile, declaredLanguage: fixture.language, requestedLanguage: "en" });

      expect(packet).toMatchObject({ schemaVersion: "ti.translation_handoff.v1", sourceId: src.id, sourceFamily: fixture.family, parserProfile: parserProfile.profile, language: { original: fixture.expected, target: "en", translationNeeded: fixture.translationNeeded } });
      expect(packet.language.detected).toBe(fixture.expected);
      expect(packet.citationSpans).toEqual([{ start: 0, end: Math.min(48, fixture.text.length), label: "lead_sentence", sourceLanguage: fixture.expected, targetLanguage: "en" }]);
      expect(packet.contentHash).toBe(collected.contentHash);
      expect(packet.canonicalUrlHash).toStartWith("urlhash:");
      expect(packet.extraction.fallbackOrder).toEqual(parserProfile.fallbackOrder);
      expect(packet.handoffs.agent09ApiContracts).toBe("stable_multilingual_fields");
      expect(packet.routeContract.forbiddenFields).toContain("translationVendor");
      expect(JSON.stringify(packet)).not.toContain("https://");
      expect(JSON.stringify(packet)).not.toContain(fixture.text);
    }
  });
});
