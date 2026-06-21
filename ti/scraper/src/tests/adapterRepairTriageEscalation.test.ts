import { describe, expect, test } from "bun:test";
import { replayAdapterCertificationFixtures } from "../adapters/adapterCertification.ts";
import { buildAdapterRepairTriagePacket, type AdapterRepairTriageImpactInput } from "../adapters/adapterRepairTriage.ts";
import { buildAdapterSlaRepairPacket } from "../adapters/adapterSlaRepair.ts";
import { adapters, generatedAt, repairObservations, successFixture } from "./helpers/adapterRepairTriageFixtures.ts";

describe("adapter repair triage escalation", () => {
  test("ranks repair disable cadence duplicate certification actions by public search impact", () => {
    const slaRepairPacket = buildAdapterSlaRepairPacket({ generatedAt, observations: repairObservations() });
    const certificationPacket = replayAdapterCertificationFixtures({ generatedAt, fixtures: adapters.map((adapter, index) => adapter === "dynamic_public_browser" ? { ...successFixture(adapter, index), explicitBoundedDynamic: false } : successFixture(adapter, index)), requiredModes: ["success"], slaRepairPacket });
    const impacts: AdapterRepairTriageImpactInput[] = [
      { sourceId: "src_dynamic_empty", adapter: "dynamic_public_browser", customerVisibleSearchImpact: 0.96, sourceFamilyCoverage: 0.84, freshnessDebtHours: 12, queryClasses: ["actor"] },
      { sourceId: "src_pdf_low_confidence", adapter: "pdf_report", customerVisibleSearchImpact: 0.82, sourceFamilyCoverage: 0.74, freshnessDebtHours: 36, queryClasses: ["vendor_report"] },
      { sourceId: "src_rss_rate_limit", adapter: "rss_feed", customerVisibleSearchImpact: 0.68, sourceFamilyCoverage: 0.7, freshnessDebtHours: 8, queryClasses: ["ransomware"] },
      { sourceId: "src_public_channel_duplicate", adapter: "public_channel_handoff", customerVisibleSearchImpact: 0.42, sourceFamilyCoverage: 0.35, duplicateRate: 0.95, queryClasses: ["country"] }
    ];
    const packet = buildAdapterRepairTriagePacket({ generatedAt, slaRepairPacket, certificationPacket, impacts });

    expect(packet.schemaVersion).toBe("ti.adapter_repair_triage_packet.v1");
    expect(packet.browserWorkersEnabled).toBe(false);
    expect(packet.decision).toBe("escalate");
    expect(packet.recommendations[0]).toMatchObject({ adapter: "dynamic_public_browser", sourceId: "src_dynamic_empty", action: "disable_or_pause_source", priority: "p0", sandboxFixtureReplay: { required: true, expectedModes: ["success", "timeout", "empty_extraction"], hashOnly: true, rawMaterialRequired: false, dynamicBrowserDisabledByDefault: true, dynamicRequiresExplicitApproval: true }, handoffs: { agent01Activation: "hold_activation", agent02Cadence: "pause", agent10ReleaseGate: "hold" } });
    expect(packet.recommendations.some((recommendation) => recommendation.action === "fix_parser" && recommendation.adapter === "pdf_report")).toBe(true);
    expect(packet.recommendations.some((recommendation) => recommendation.action === "reduce_cadence" && recommendation.adapter === "rss_feed")).toBe(true);
    expect(packet.recommendations.some((recommendation) => recommendation.action === "suppress_duplicate" && recommendation.adapter === "public_channel_handoff")).toBe(true);
    expect(packet.summary.warningCodes).toContain("adapter_triage.disable_or_pause_source");
    expect(packet.sandboxFixtureReplay.expectedModesByAdapter.find((entry) => entry.adapter === "dynamic_public_browser")?.modes).toEqual(["success", "timeout", "rate_limit", "empty_extraction"]);
    expect(JSON.stringify(packet)).not.toContain("https://");
    expect(JSON.stringify(packet)).not.toContain("APT29 public report");
    expect(packet.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["url", "rawText", "html", "screenshotBytes", "objectRef"]));
  });
});
