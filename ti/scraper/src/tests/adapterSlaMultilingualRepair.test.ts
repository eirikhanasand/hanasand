import { describe, expect, test } from "bun:test";
import { buildAdapterSlaRepairPacket } from "../adapters/adapterSlaRepair.ts";
import { buildTranslationHandoffPacket } from "../adapters/multilingualReportHandoff.ts";
import { generatedAt, item, profile, source } from "./helpers/adapterSlaFixtures.ts";

describe("adapter SLA multilingual repair", () => {
  test("adds multilingual fallback repair when language detection drifts", () => {
    const src = source("src_mixed_language_report", "static_web", "https://vendor.example.test/mixed", { language: "es" });
    const text = "APT29 threat advisory. La amenaza usa infraestructura nueva y campaña activa.";
    const handoff = buildTranslationHandoffPacket({ generatedAt, source: src, item: item(src, text), sourceFamily: "static_html", parserProfile: profile(src, { text, language: "es" }), declaredLanguage: "es", requestedLanguage: "en" });
    const packet = buildAdapterSlaRepairPacket({ generatedAt, observations: [], translationHandoffs: [handoff] });

    expect(handoff.language.detected).toBe("mixed");
    expect(packet.repairs).toHaveLength(1);
    expect(packet.repairs[0]).toMatchObject({ sourceId: "src_mixed_language_report", adapter: "multilingual_handoff", category: "language_detection_drift", priority: "medium", canonicalUrlHash: expect.stringMatching(/^urlhash:/), evidence: { contentHashOnly: true, rawContentRequired: false }, agentHandoffs: { agent07ExtractionQuality: "review_multilingual_fallback", agent09ApiWarningCode: "adapter_repair.language_detection_drift" } });
    expect(packet.contracts.find((contract) => contract.adapter === "multilingual_handoff")?.status).toBe("warn");
    expect(packet.contracts.find((contract) => contract.adapter === "multilingual_handoff")?.metrics).toMatchObject({ translationNeededCount: 1, languageDriftCount: 1 });
    expect(JSON.stringify(packet)).not.toContain("https://vendor.example.test/mixed");
  });
});
