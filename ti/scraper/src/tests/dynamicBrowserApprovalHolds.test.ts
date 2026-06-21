import { describe, expect, test } from "bun:test";
import { buildDynamicBrowserCutoverPacket } from "../adapters/dynamicBrowserCutover.ts";
import { baseInput, fixture } from "./helpers/dynamicBrowserCutoverFixtures.ts";

describe("dynamic browser approval holds", () => {
  test("holds cutover when approval is missing or kill switch is active", () => {
    const missingApproval = buildDynamicBrowserCutoverPacket(baseInput({ approval: { explicitlyApproved: false }, fixtures: [fixture("success")] }));
    expect(missingApproval).toMatchObject({
      decision: "hold",
      fixtures: [{ status: "hold", failureCode: "approval_missing", handoffs: { agent01SourceActivation: "hold_activation", agent09ApiWarningField: "dynamic_browser.approval_missing", agent10ResourceGate: "hold" } }]
    });
    expect(missingApproval.gates.find((gate) => gate.name === "explicit_approval")?.status).toBe("hold");

    const killSwitch = buildDynamicBrowserCutoverPacket(baseInput({
      policy: { robotsAllowed: true, legalNotesPresent: true, killSwitchActive: true, hostAllowlist: ["dynamic.example.test"] },
      fixtures: [fixture("success")]
    }));
    expect(killSwitch.decision).toBe("kill_switch");
    expect(killSwitch.killSwitch).toMatchObject({ active: true, rollbackAction: "pause_canary_pool" });
    expect(killSwitch.fixtures[0]).toMatchObject({
      status: "hold",
      failureCode: "kill_switch_active",
      handoffs: { agent02SchedulerBudget: "pause_pool", agent09ApiWarningField: "dynamic_browser.kill_switch_active" }
    });
  });
});
