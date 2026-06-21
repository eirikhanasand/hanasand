import { describe, expect, test } from "bun:test";
import { buildDynamicBrowserCutoverPacket, type DynamicBrowserFailureMode } from "../adapters/dynamicBrowserCutover.ts";
import { baseInput, fixture } from "./helpers/dynamicBrowserCutoverFixtures.ts";

const modes: DynamicBrowserFailureMode[] = ["js_render_timeout", "redirect_chain", "unsupported_mime", "robots_legal_hold", "capture_truncation", "blank_page", "parser_empty_extraction", "screenshot_hash_mismatch", "queue_pressure", "private_network_target", "credential_prompt", "captcha_challenge", "download_attempt", "onion_redirect", "third_party_request_leak"];

describe("dynamic browser failure modes", () => {
  test("maps all failure modes to gates warning fields and handoffs", () => {
    const packet = buildDynamicBrowserCutoverPacket(baseInput({
      pool: { maxWorkers: 2, memoryCapMb: 1024, timeoutMs: 30_000, maxBytes: 5_000_000, queueMaxDepth: 20, currentQueueDepth: 21 },
      fixtures: modes.map((mode, index) => fixture(mode, index))
    }));

    expect(packet.decision).toBe("hold");
    expect(packet.summary.warningCodes).toEqual(expect.arrayContaining(modes.map((mode) => `dynamic_browser.${mode}`)));
    expect(packet.summary.hold).toBeGreaterThan(0);
    expect(packet.fixtures.find((item) => item.mode === "redirect_chain")?.status).toBe("hold");
    expect(packet.fixtures.find((item) => item.mode === "capture_truncation")?.checks.truncated).toBe(true);
    expect(packet.fixtures.find((item) => item.mode === "screenshot_hash_mismatch")?.handoffs.agent06EvidenceChain).toBe("hold_evidence_replay");
    expect(packet.agentHandoffs.agent02SchedulerBudgets).toContain("pause_pool");
    expect(packet.agentHandoffs.agent04PublicSourceExpansion).toContain("exclude_until_repaired");
    expect(packet.agentHandoffs.agent07QualityGates).toContain("hold");
    expect(packet.agentHandoffs.agent10ResourceGates).toContain("hold");
    expect(packet.gates.find((gate) => gate.name === "queue_pressure")?.status).toBe("hold");
    expect(packet.gates.find((gate) => gate.name === "isolation_hazards_blocked")?.status).toBe("hold");
    expect(packet.summary.isolationHoldCount).toBe(6);
    expect(packet.summary.blockedTargetClasses).toEqual(["captcha_challenge", "credential_prompt", "download_attempt", "onion_redirect", "private_network_target", "third_party_request_leak"]);
    expect(packet.promotionReadiness.requiredBeforeLiveCanary).toEqual(expect.arrayContaining(["clear_hold_gate:isolation_hazards_blocked"]));
    expect(packet.promotionReadiness.rollbackTriggers).toEqual(expect.arrayContaining(["fixture_warning:private_network_target", "fixture_warning:third_party_request_leak", "download_or_private_network_attempt"]));
  });
});
