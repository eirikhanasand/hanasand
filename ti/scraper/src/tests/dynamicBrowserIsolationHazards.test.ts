import { describe, expect, test } from "bun:test";
import { buildDynamicBrowserCutoverPacket } from "../adapters/dynamicBrowserCutover.ts";
import { baseInput, fixture } from "./helpers/dynamicBrowserCutoverFixtures.ts";

describe("dynamic browser isolation hazards", () => {
  test("blocks isolation hazards even when fixture mode is otherwise successful", () => {
    const packet = buildDynamicBrowserCutoverPacket(baseInput({
      fixtures: [{ ...fixture("success"), fixtureId: "dynamic_success_with_isolation_leak", isolation: { privateNetworkTarget: true, credentialPromptDetected: true, captchaDetected: true, downloadAttempted: true, onionRedirect: true, thirdPartyRequestCount: 3, blockedThirdPartyRequestCount: 2 } }]
    }));

    expect(packet.decision).toBe("hold");
    expect(packet.summary).toMatchObject({ isolationHoldCount: 1, blockedTargetClasses: ["captcha_challenge", "credential_prompt", "download_attempt", "onion_redirect", "private_network_target", "third_party_request_leak"] });
    expect(packet.fixtures[0]).toMatchObject({
      status: "hold",
      failureCode: "private_network_target",
      provenance: { extractionWarnings: expect.arrayContaining(["private_network_target", "credential_prompt", "captcha_challenge", "download_attempt", "onion_redirect", "third_party_request_leak"]), collectedItemCompatible: true },
      checks: { privateNetworkTarget: true, credentialPrompt: true, captchaChallenge: true, downloadAttempt: true, onionRedirect: true, thirdPartyRequestLeak: true },
      handoffs: { agent01SourceActivation: "hold_activation", agent06EvidenceChain: "hold_evidence_replay", agent07QualityGate: "hold", agent09ApiWarningField: "dynamic_browser.private_network_target", agent10ResourceGate: "hold" }
    });
    const serialized = JSON.stringify(packet);
    expect(serialized).not.toContain("https://dynamic.example.test");
    expect(serialized).not.toContain("s3://ti-dynamic-fixtures");
    expect(serialized).not.toContain("must-not-leak");
    expect(packet.routeContract.forbiddenFields).toContain("screenshotBytes");
    expect(packet.routeContract.forbiddenFields).toContain("downloadUrl");
  });
});
