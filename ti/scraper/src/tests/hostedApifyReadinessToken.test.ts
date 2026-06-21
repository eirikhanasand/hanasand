import { describe, expect, test } from "bun:test";
import { buildHostedApifyPaidReadinessProof } from "../contracts/hostedApifyPaidReadiness.ts";
import { observedProof, withHostedProofEnv } from "./helpers/hostedApifyFixtures.ts";

describe("hosted Apify paid readiness token and sample gates", () => {
  test("reports no-token plan shape without claiming a hosted proof", () => withHostedProofEnv({}, () => {
    const proof = buildHostedApifyPaidReadinessProof({ readObservedProofFromEnvironment: false });
    const board = proof.hostedProofOperatorChecklist.operatorActionBoard;
    expect(proof.status).toBe("external_token_missing");
    expect(board).toMatchObject({ canRunNow: false, canVerifyRunNow: false, canImportObservedProofNow: false, missingSecretNames: ["APIFY_TOKEN"], expectedUnlock: "none" });
    expect(board.nextCommand).toContain("TI_APIFY_HOSTED_PROOF_MODE=run");
    expect(board.stillBlockedAfterCommand.join(" ")).toContain("APIFY_TOKEN missing");
  }));

  test("reports token plan shape without making a network call", () => withHostedProofEnv({ APIFY_TOKEN: "redacted-token" }, () => {
    const proof = buildHostedApifyPaidReadinessProof({ hasToken: true, readObservedProofFromEnvironment: false });
    const board = proof.hostedProofOperatorChecklist.operatorActionBoard;
    expect(proof.status).toBe("hosted_proof_missing");
    expect(board.canRunNow).toBe(true);
    expect(board.canVerifyRunNow).toBe(false);
    expect(board.missingSecretNames).toEqual([]);
    expect(board.nextCommand).toContain("TI_APIFY_HOSTED_PROOF_MODE=run");
  }));

  test("sample hosted300 template shape is blocked from all unlocks", () => withHostedProofEnv({ TI_APIFY_OBSERVED_PROOF_PATH: "docs/examples/hosted-apify-observed-proof.hosted300.template.json" }, () => {
    const proof = buildHostedApifyPaidReadinessProof({ observedProof: observedProof({ sampleOnly: true }), readObservedProofFromEnvironment: false });
    const checklist = proof.hostedProofOperatorChecklist;
    expect(checklist.status).toBe("sample_only");
    expect(checklist.unlockSummary).toBe("none");
    expect(checklist.operatorActionBoard.canImportObservedProofNow).toBe(true);
    expect(checklist.operatorActionBoard.stillBlockedAfterCommand).toContain("sampleOnly=true cannot unlock hosted or marketplace gates");
    expect(checklist.gateEffects.hosted100.state).toBe("blocked_sample");
    expect(checklist.gateEffects.hosted300.required.sellableFindingRows).toBe(150);
    expect(checklist.gateEffects.hosted500.required.sellableFindingRows).toBe(275);
  }));
});
