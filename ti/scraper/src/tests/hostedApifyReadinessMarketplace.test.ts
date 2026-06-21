import { describe, expect, test } from "bun:test";
import { buildHostedApifyPaidReadinessProof, type HostedApifyObservedProofImport } from "../contracts/hostedApifyPaidReadiness.ts";
import { observedProof, withHostedProofEnv } from "./helpers/hostedApifyFixtures.ts";

describe("hosted Apify paid readiness marketplace and safety", () => {
  test("marketplace observed fields unlock only when complete and safe", () => withHostedProofEnv({}, () => {
    const proof = buildHostedApifyPaidReadinessProof({ observedProof: observedProof(), readObservedProofFromEnvironment: false });
    expect(proof.hostedProofOperatorChecklist.unlockSummary).toBe("hosted100_hosted300_hosted500_marketplace_promotion");
    expect(proof.marketplaceConversionInputs).toMatchObject({ storeViews: 12, runs: 4, uniqueUsers: 3, paidUsers: 1, refunds: 0, payoutEnabled: true, pricingModel: "pay_per_event_rows", publicListingStatus: "public_listed_not_promoted" });
    expect(proof.localCurrent500Gate).toMatchObject({ sellableRows: 500, sellableFindingRows: 275, countsTowardPaidPromotion: false, hostedProofStillRequired: true });
    expect(proof.conversionPayoutTruth).toMatchObject({ pricing: { state: "observed", value: "pay_per_event_rows" }, payout: { state: "observed", enabled: true }, analytics: { state: "observed", storeViews: 12, runs: 4, paidUsers: 1, refunds: 0 }, hosted500: { state: "observed", requiredSellableRows: 500, requiredSellableFindingRows: 275 } });
    expect(proof.programFgObservedEvidenceBoard).toMatchObject({ schemaVersion: "ti.program_fg_observed_apify_hosted_marketplace_truth.v1", importState: "proof_sufficient_for_public_traffic", hostedProofState: "sufficient_for_public_traffic", marketplaceTruthState: "observed_public", observedHostedRun: { runId: "run_observed_001", buildId: "build_observed_001", runStatus: "succeeded", failureState: "none", chargedEventCount: 608 }, observedMarketplaceTruth: { listingVisibility: "public", payoutState: "enabled", analyticsVisible: true, conversionRate: 0.333 } });
  }));

  test("partial marketplace import leaves external fields unknown", () => withHostedProofEnv({}, () => {
    const partial = observedProof() as Partial<HostedApifyObservedProofImport>;
    delete partial.pricingModel;
    delete partial.payoutEnabled;
    const proof = buildHostedApifyPaidReadinessProof({ observedProof: partial as HostedApifyObservedProofImport, readObservedProofFromEnvironment: false });
    expect(proof.hostedProofOperatorChecklist.missingFields).toEqual(expect.arrayContaining(["pricingModel", "payoutEnabled"]));
    expect(proof.hostedProofOperatorChecklist.unlockSummary).toBe("hosted100_hosted300_hosted500");
    expect(proof.hostedProofOperatorChecklist.gateEffects.marketplacePromotion.state).toBe("hold");
    expect(proof.marketplaceConversionInputs.payoutEnabled).toBe("external_unknown");
    expect(proof.marketplaceConversionInputs.pricingModel).toBe("external_unknown");
    expect(proof.conversionPayoutTruth.pricing.state).toBe("external_unknown");
    expect(proof.conversionPayoutTruth.payout.state).toBe("external_unknown");
  }));

  test("unsafe no-leak proof cannot unlock hosted gates", () => withHostedProofEnv({}, () => {
    const proof = buildHostedApifyPaidReadinessProof({ observedProof: observedProof({ noLeakFailures: 1 }), readObservedProofFromEnvironment: false });
    expect(proof.hostedProofOperatorChecklist.unlockSummary).toBe("none");
    expect(proof.hostedProofOperatorChecklist.gateEffects.hosted100.state).toBe("blocked_unsafe");
    expect(proof.hostedProofOperatorChecklist.operatorActionBoard.stillBlockedAfterCommand).toContain("no-leak and false-positive inflation failures must be zero");
  }));
});
