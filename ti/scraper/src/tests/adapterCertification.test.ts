import { describe, expect, test } from "bun:test";
import {
  replayAdapterCertificationFixtures,
  type AdapterCertificationFixtureInput,
  type AdapterCertificationMode
} from "../adapters/adapterCertification.ts";
import { buildAdapterSlaRepairPacket, type AdapterSlaAdapterKind } from "../adapters/adapterSlaRepair.ts";
import { hashContent } from "../utils.ts";

const generatedAt = "2026-05-24T17:15:00.000Z";
const collectedAt = "2026-05-24T17:00:00.000Z";
const adapterKinds: AdapterSlaAdapterKind[] = ["static_html", "rss_feed", "dynamic_public_browser", "pdf_report", "public_channel_handoff", "advisory_signal", "multilingual_handoff"];
const modes: AdapterCertificationMode[] = ["success", "parser_drift", "stale_dates", "language_mismatch", "unsupported_mime", "timeout", "rate_limit", "duplicate_canonical", "truncated_capture", "empty_extraction"];

function fixture(adapter: AdapterSlaAdapterKind, mode: AdapterCertificationMode, index = 0): AdapterCertificationFixtureInput {
  const textLength = mode === "empty_extraction" ? 0 : mode === "parser_drift" ? 18 : 900;
  const bytesAllowed = 10_000;
  const bytesRead = mode === "truncated_capture" ? bytesAllowed : 1800;
  return {
    fixtureId: `${adapter}_${mode}_${index}`,
    adapter,
    mode,
    sourceId: `src_${adapter}`,
    url: `https://fixtures.example.test/${adapter}/${mode}?token=should-not-leak`,
    objectRef: `s3://ti-fixtures/${adapter}/${mode}/body.html`,
    contentHash: `contenthash:${hashContent(`${adapter}:${mode}:${index}`).slice(0, 16)}`,
    parserVersion: "adapter-cert-fixture-v1",
    parserConfidence: mode === "parser_drift" ? 0.31 : 0.86,
    extractionStats: {
      bytesRead,
      bytesAllowed,
      textLength,
      linkCount: mode === "empty_extraction" ? 0 : 4,
      citationSpanCount: mode === "empty_extraction" ? 0 : 2,
      warningCount: mode === "success" ? 0 : 1
    },
    publishedAt: mode === "stale_dates" ? "2025-01-01T00:00:00.000Z" : "2026-05-24T12:00:00.000Z",
    collectedAt,
    language: mode === "language_mismatch"
      ? { declared: "es", detected: "en", confidence: 0.62 }
      : { declared: "en", detected: "en", confidence: 0.92 },
    retryAfterSeconds: mode === "rate_limit" ? 120 : undefined,
    explicitBoundedDynamic: adapter === "dynamic_public_browser"
  };
}

describe("adapter certification fixture replay", () => {
  test("covers every public adapter family and replay failure mode with hash-only output", () => {
    const fixtures = adapterKinds.flatMap((adapter) => modes.map((mode, index) => fixture(adapter, mode, index)));
    const packet = replayAdapterCertificationFixtures({
      generatedAt,
      fixtures,
      slaRepairPacket: buildAdapterSlaRepairPacket({ generatedAt, observations: [] })
    });

    expect(packet.schemaVersion).toBe("ti.adapter_certification_packet.v1");
    expect(packet.browserWorkersEnabled).toBe(false);
    expect(packet.dynamicRequiresExplicitBoundedFlag).toBe(true);
    expect(packet.summary.totalFixtures).toBe(adapterKinds.length * modes.length);
    expect(packet.summary.adaptersCovered).toEqual(adapterKinds);
    expect(packet.summary.modesCovered).toEqual(modes);
    expect(packet.summary.warningCodes).toContain("adapter_cert.parser_drift");
    expect(packet.summary.warningCodes).toContain("adapter_cert.timeout");
    expect(packet.summary.warningCodes).toContain("adapter_cert.duplicate_canonical");
    expect(packet.fixtures.every((replay) => replay.fixtureUrlHash.startsWith("urlhash:"))).toBe(true);
    expect(packet.fixtures.every((replay) => replay.objectRefHash?.startsWith("objectref:"))).toBe(true);
    expect(packet.fixtures.every((replay) => replay.evidence.rawContentExposed === false)).toBe(true);

    const byMode = new Map(packet.fixtures.map((replay) => [`${replay.adapter}:${replay.mode}`, replay]));
    expect(byMode.get("static_html:parser_drift")?.status).toBe("hold");
    expect(byMode.get("rss_feed:stale_dates")?.status).toBe("watch");
    expect(byMode.get("pdf_report:unsupported_mime")?.handoffs.agent07QualityGate).toBe("hold");
    expect(byMode.get("public_channel_handoff:duplicate_canonical")?.handoffs.agent06EvidenceReplay).toBe("suppress_duplicate");
    expect(byMode.get("advisory_signal:rate_limit")?.handoffs.agent02CadenceBackoff).toBe("retry_after");
    expect(byMode.get("multilingual_handoff:language_mismatch")?.replaySignals.languageMismatch).toBe(true);
    expect(packet.adapterGates.every((gate) => gate.releaseDecision === "hold")).toBe(true);

    const serialized = JSON.stringify(packet);
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("s3://");
    expect(serialized).not.toContain("should-not-leak");
    expect(serialized).not.toContain(".onion");
    expect(packet.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["url", "rawText", "html", "screenshotBytes", "credential", "privateInvite", "onionUrl", "objectRef"]));
    expect(packet.routeContract.compactApiProof).toMatchObject({
      noRawUrls: true,
      noRawText: true,
      noHtml: true,
      noScreenshots: true,
      noCredentials: true,
      noPrivateInvites: true,
      noOnionLinks: true,
      noRestrictedMaterial: true
    });
  });

  test("certifies success-only replay when SLA is clean and dynamic fixtures are explicitly bounded", () => {
    const packet = replayAdapterCertificationFixtures({
      generatedAt,
      fixtures: adapterKinds.map((adapter, index) => fixture(adapter, "success", index)),
      requiredModes: ["success"],
      slaRepairPacket: buildAdapterSlaRepairPacket({ generatedAt, observations: [] })
    });

    expect(packet.readyForLiveActorCollection).toBe(true);
    expect(packet.summary).toMatchObject({
      totalFixtures: adapterKinds.length,
      certified: adapterKinds.length,
      watch: 0,
      hold: 0,
      warningCodes: []
    });
    expect(packet.adapterGates.every((gate) => gate.status === "certified")).toBe(true);
    expect(packet.agentHandoffs).toMatchObject({
      agent01: ["allow_certified"],
      agent02: ["normal"],
      agent04: ["eligible"],
      agent06: ["replay_hash_only"],
      agent07: ["pass"],
      agent09: [],
      agent10: ["none"]
    });
  });

  test("holds dynamic certification without an explicit bounded dynamic flag", () => {
    const dynamic = fixture("dynamic_public_browser", "success");
    const packet = replayAdapterCertificationFixtures({
      generatedAt,
      fixtures: [{ ...dynamic, explicitBoundedDynamic: false }],
      requiredModes: ["success"],
      slaRepairPacket: buildAdapterSlaRepairPacket({ generatedAt, observations: [] })
    });

    expect(packet.readyForLiveActorCollection).toBe(false);
    expect(packet.fixtures[0]).toMatchObject({
      adapter: "dynamic_public_browser",
      status: "hold",
      failureCode: "dynamic_requires_explicit_bounded_flag",
      replaySignals: {
        dynamicExplicitlyBounded: false
      },
      handoffs: {
        agent01SourceActivation: "hold_source_activation",
        agent09ApiWarningField: "adapter_cert.dynamic_requires_explicit_bounded_flag",
        agent10ReleaseHold: "hold"
      }
    });
    expect(packet.adapterGates.find((gate) => gate.adapter === "dynamic_public_browser")?.holdReasons).toContain("fixture_hold_present");
  });
});
