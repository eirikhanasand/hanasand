import { describe, expect, test } from "bun:test";
import { buildAdapterFailureObservation, buildAdapterFailureObservatory, buildAdapterProductionReadinessPacket } from "../adapters/adapterFailureObservatory.ts";
import { browserWorkerIsolationPlan } from "../adapters/browserWorkerIsolation.ts";
import { generatedAt, profile, result, source } from "./helpers/adapterFailureFixtures.ts";

describe("adapter failure production readiness", () => {
  test("emits readiness packet with dynamic browser workers disabled and API handoff notes", () => {
    const src = source({ id: "src_ready_static", type: "static_web", url: "https://vendor.example.test/ready" });
    const observation = buildAdapterFailureObservation({
      generatedAt,
      source: src,
      result: result(src, { text: "APT29 public report fixture with enough detail for extraction and routing." }),
      profile: profile(src),
      queryClass: "actor"
    });
    const observatory = buildAdapterFailureObservatory({ generatedAt, observations: [observation] });
    const packet = buildAdapterProductionReadinessPacket({
      generatedAt,
      observatory,
      browserPlan: browserWorkerIsolationPlan({ enabled: true, maxWorkers: 4, memoryCapMb: 1024, timeoutMs: 15_000, allowedHosts: ["vendor.example.test"], robotsAllowed: true, legalNotes: "Public dynamic worker canary notes." })
    });

    expect(packet.browserWorkers).toMatchObject({ enabled: false, workerPool: "dynamic_public_browser", maxWorkers: 4, memoryCapMb: 1024, timeoutMs: 15_000, hostAllowlist: ["vendor.example.test"] });
    expect(packet.safetyDefaults).toMatchObject({ publicOnly: true, noAuthBypass: true, noCaptchaSolving: true, noPrivateCommunities: true, unsafeUrlExposed: false });
    expect(packet.enablementGate).toEqual({ readyForCanary: true, blockers: [], warnings: [] });
    expect(packet.agentHandoffs.agent09[0]).toContain("routeContract.stableFields");
  });
});
