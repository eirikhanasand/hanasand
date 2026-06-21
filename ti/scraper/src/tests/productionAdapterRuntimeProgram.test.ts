import { describe, expect, test } from "bun:test";
import { buildGreenProgram } from "./helpers/productionAdapterRuntimeFixtures.ts";

describe("production adapter runtime program", () => {
  test("publishes capability and capture metadata contracts without unsafe output", () => {
    const packet = buildGreenProgram();

    expect(packet.schemaVersion).toBe("ti.production_adapter_runtime_program.v1");
    expect(packet.browserWorkersEnabled).toBe(false);
    expect(packet.readyForApprovedPublicCollection).toBe(true);
    expect(packet.capabilities.map((capability) => capability.adapter)).toEqual(["rss_feed", "static_html", "pdf_report", "dynamic_public_browser", "public_channel_handoff", "advisory_signal", "github_security_feed", "multilingual_handoff"]);
    expect(packet.implementationSummary).toMatchObject({ implemented: 4, contractReady: 0, canaryContract: 4, blocked: 0 });
    expect(packet.capabilities.find((capability) => capability.adapter === "rss_feed")).toMatchObject({ runtimeMode: "native_public_http", implementationState: "implemented", parserCertificationState: "certified", retryBackoff: { supportsRetryAfter: true, supportsConditionalRequests: true } });
    expect(packet.capabilities.find((capability) => capability.adapter === "dynamic_public_browser")).toMatchObject({ runtimeMode: "disabled_dynamic_isolation", implementationState: "canary_contract", parserCertificationState: "canary_only", dynamicIsolation: { browserWorkersEnabled: false, screenshotHashOnly: true, explicitApprovalRequired: true, featureFlag: "disabled_by_default" }, handoffs: { agent06Evidence: "hash_only_dynamic_evidence" } });
    expect(packet.capabilities.find((capability) => capability.adapter === "github_security_feed")).toMatchObject({ runtimeMode: "official_public_api", implementationState: "implemented", sourceFamily: "github_security_advisory", parserProfile: "advisory_signal" });
    expect(packet.captureMetadataContract.requiredFields).toEqual(["sourceId", "canonicalUrlHash", "contentHash", "fetchedAt", "language", "parserConfidence", "extractionWarnings", "provenance", "evidenceReplayRef"]);
    expect(packet.captureMetadataContract.noLeakProof).toMatchObject({ noRawUrls: true, noRawText: true, noHtml: true, noScreenshots: true, noObjectKeys: true, noCredentials: true, noPrivateInvites: true, noOnionLinks: true, noRestrictedMaterial: true });
    expect(packet.agentHandoffs.agent01Activation).toContain("allow_approved_public_activation");
    expect(packet.agentHandoffs.agent02Scheduler).toContain("normal_public_cadence");
    expect(packet.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["url", "rawText", "html", "screenshotBytes", "objectKey"]));
    expect(JSON.stringify(packet)).not.toContain("https://");
    expect(JSON.stringify(packet)).not.toContain("s3://");
    expect(JSON.stringify(packet)).not.toContain("must-not-leak");
    expect(JSON.stringify(packet)).not.toContain(".onion");
  });
});
