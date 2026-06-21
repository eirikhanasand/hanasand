import { describe, expect, test } from "bun:test";
import { replayAdapterCertificationFixtures } from "../adapters/adapterCertification.ts";
import { buildAdapterRepairTriagePacket } from "../adapters/adapterRepairTriage.ts";
import { buildAdapterSlaRepairPacket } from "../adapters/adapterSlaRepair.ts";
import { adapters, generatedAt, successFixture } from "./helpers/adapterRepairTriageFixtures.ts";

describe("adapter repair triage certification", () => {
  test("certifies adapters when SLA and success replay gates are clean", () => {
    const slaRepairPacket = buildAdapterSlaRepairPacket({ generatedAt, observations: [] });
    const certificationPacket = replayAdapterCertificationFixtures({ generatedAt, fixtures: adapters.map(successFixture), requiredModes: ["success"], slaRepairPacket });
    const packet = buildAdapterRepairTriagePacket({ generatedAt, slaRepairPacket, certificationPacket });
    expect(packet.decision).toBe("certify");
    expect(packet.readyForCertification).toBe(true);
    expect(packet.summary.actions).toMatchObject({ certify_adapter: adapters.length });
    expect(packet.recommendations.every((recommendation) => recommendation.action === "certify_adapter")).toBe(true);
    expect(packet.adapterSummaries.every((summary) => summary.releaseHold === false)).toBe(true);
    expect(packet.summary.agentHandoffs).toMatchObject({ agent01: ["allow_certification"], agent02: ["normal"], agent04: ["count_as_covered"], agent06: ["none"], agent07: ["pass"], agent09: [], agent10: ["none"] });
  });
});
