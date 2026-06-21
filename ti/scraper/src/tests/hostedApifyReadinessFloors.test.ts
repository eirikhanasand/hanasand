import { describe, expect, test } from "bun:test";
import { buildHostedApifyPaidReadinessProof, type HostedApifyObservedProofImport } from "../contracts/hostedApifyPaidReadiness.ts";
import { observedProof, withHostedProofEnv } from "./helpers/hostedApifyFixtures.ts";

describe("hosted Apify paid readiness row floors", () => {
  test("production hosted100 proof holds hosted300 below 300-row and 150-finding gate", () => withHostedProofEnv({}, () => {
    const proof = buildHostedApifyPaidReadinessProof({ observedProof: observedProof({ datasetItemCount: 180, sellableRows: 125, sellableFindingCount: 60, caveatedRows: 55, publicListingStatus: "draft_copy_ready_not_promoted" }), readObservedProofFromEnvironment: false });
    const checklist = proof.hostedProofOperatorChecklist;
    expect(checklist.unlockSummary).toBe("hosted100");
    expect(checklist.gateEffects.hosted100.state).toBe("pass");
    expect(checklist.gateEffects.hosted300.state).toBe("hold");
    expect(checklist.operatorActionBoard.stillBlockedAfterCommand.join(" ")).toContain("300 sellable rows and 150 finding rows");
  }));

  test("real hosted baseline reports exact hosted100 shortfall", () => withHostedProofEnv({}, () => {
    const partial = observedProof({ runId: "THMm2ZzYxW4HVPGJ6", buildId: "L7LtCqLsKT6Luq04R", datasetId: "xLPoxMVY6cVjGsS4e", datasetItemCount: 313, sellableRows: 46, sellableFindingCount: 31, caveatedRows: 194, averageBuyerValueScore: 0.585, runtimeSeconds: 12.216, memoryMbytes: 23.375, usageUsd: 0.0047, costUsd: 0.0047, chargedEventCount: 314, chargedDatasetItemEvents: 313, chargedActorStartEvents: 1, noLeakFailures: 0, secondBatchAuditObserved: undefined, falsePositiveInflationFailures: null, publicListingStatus: "draft_copy_ready_not_promoted" }) as Partial<HostedApifyObservedProofImport>;
    for (const key of ["storeViews", "runs", "uniqueUsers", "paidUsers", "refunds", "pricingModel", "payoutEnabled", "payoutState", "analyticsVisible", "conversionRate", "listingVisibility"] as const) delete partial[key];
    const proof = buildHostedApifyPaidReadinessProof({ hasToken: true, observedProof: partial as HostedApifyObservedProofImport, readObservedProofFromEnvironment: false });
    const board = proof.programFgObservedEvidenceBoard;
    const checklist = proof.hostedProofOperatorChecklist;
    expect(proof.status).toBe("verified_hold");
    expect(proof.hostedProofImportPath.externalBlocker).toBe("hosted_100_name_run_below_paid_floor");
    expect(checklist.gateEffects.hosted100.reason).toContain("needs +54 sellable rows and +21 finding rows");
    expect(board).toMatchObject({ importState: "proof_imported_but_insufficient", hostedProofState: "insufficient", releaseBlockerState: "proof_imported_but_insufficient", observedHostedRun: { runId: "THMm2ZzYxW4HVPGJ6", buildId: "L7LtCqLsKT6Luq04R", datasetId: "xLPoxMVY6cVjGsS4e", chargedDatasetItemEvents: 313, chargedActorStartEvents: 1 } });
    expect(board.insufficientFields).toEqual(expect.arrayContaining(["hosted100", "marketplace_truth"]));
    expect(board.marketplaceMissingFieldsOnlyTemplate.missingFields).toEqual(expect.arrayContaining(["storeViews", "pricingModel", "payoutEnabled", "analyticsVisible", "listingVisibility"]));
    expect(proof.hostedProofDeltaSincePrevious).toMatchObject({ baselineRunId: "THMm2ZzYxW4HVPGJ6", currentSellableRows: 46, currentSellableFindingRows: 31, sellableRowsDelta: 0, sellableFindingRowsDelta: 0, hosted100SellableGap: 54, hosted100FindingGap: 21, direction: "regressed_or_flat_below_floor" });
  }));

  test("next hosted proof delta reports improvement below hosted100", () => withHostedProofEnv({}, () => {
    const proof = buildHostedApifyPaidReadinessProof({ hasToken: true, observedProof: observedProof({ runId: "run_after_parser_lift_001", datasetId: "dataset_after_parser_lift_001", datasetItemCount: 360, sellableRows: 68, sellableFindingCount: 44, caveatedRows: 210, noLeakFailures: 0, secondBatchAuditObserved: true, falsePositiveInflationFailures: 0, publicListingStatus: "draft_copy_ready_not_promoted" }), readObservedProofFromEnvironment: false });
    expect(proof.hostedProofImportPath.externalBlocker).toBe("hosted_100_name_run_below_paid_floor");
    expect(proof.hostedProofDeltaSincePrevious).toMatchObject({ currentRunId: "run_after_parser_lift_001", currentSellableRows: 68, currentSellableFindingRows: 44, sellableRowsDelta: 22, sellableFindingRowsDelta: 13, hosted100SellableGap: 32, hosted100FindingGap: 8, direction: "improved_below_floor" });
    expect(proof.hostedProofDeltaSincePrevious.nextAction).toContain("Hosted100 remains held");
  }));

  test("production hosted300 and hosted500 gates progress independently", () => withHostedProofEnv({}, () => {
    const hosted300 = buildHostedApifyPaidReadinessProof({ observedProof: observedProof({ sellableRows: 320, sellableFindingCount: 160, caveatedRows: 287, publicListingStatus: "draft_copy_ready_not_promoted" }), readObservedProofFromEnvironment: false }).hostedProofOperatorChecklist;
    expect(hosted300.unlockSummary).toBe("hosted100_hosted300");
    expect(hosted300.gateEffects.hosted300.state).toBe("pass");
    expect(hosted300.gateEffects.hosted500.state).toBe("hold");
    const hosted500 = buildHostedApifyPaidReadinessProof({ observedProof: observedProof({ publicListingStatus: "draft_copy_ready_not_promoted" }), readObservedProofFromEnvironment: false });
    expect(hosted500.hostedProofOperatorChecklist.unlockSummary).toBe("hosted100_hosted300_hosted500");
    expect(hosted500.hostedProofOperatorChecklist.gateEffects.marketplacePromotion.state).toBe("hold");
    expect(hosted500.conversionPayoutTruth.marketplaceListing.state).toBe("blocked");
  }));
});
