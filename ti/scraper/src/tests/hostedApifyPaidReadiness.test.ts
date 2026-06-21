import { describe, expect, test } from "bun:test";
import {
  buildHostedApifyPaidReadinessProof,
  type HostedApifyObservedProofImport
} from "../contracts/hostedApifyPaidReadiness.ts";

const envKeys = ["APIFY_TOKEN", "TI_APIFY_HOSTED_RUN_ID", "TI_APIFY_HOSTED_DATASET_ID", "TI_APIFY_OBSERVED_PROOF_JSON", "TI_APIFY_OBSERVED_PROOF_PATH"] as const;

function withHostedProofEnv<T>(env: Partial<Record<(typeof envKeys)[number], string>>, run: () => T): T {
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Partial<Record<(typeof envKeys)[number], string>>;
  for (const key of envKeys) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    return run();
  } finally {
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function observedProof(overrides: Partial<HostedApifyObservedProofImport> = {}): HostedApifyObservedProofImport {
  return {
    schemaVersion: "ti.hosted_apify_observed_proof_import.v1",
    runId: "run_observed_001",
    buildId: "build_observed_001",
    runStatus: "succeeded",
    failureState: "none",
    datasetId: "dataset_observed_001",
    proofPreset: "100_name_paid_preset",
    defaultQueryCount: 100,
    maxRowsPerQuery: 25,
    includeCoverageGaps: false,
    includeHeldRows: false,
    includeDatasets: false,
    datasetItemCount: 607,
    sellableRows: 500,
    sellableFindingCount: 275,
    caveatedRows: 107,
    averageBuyerValueScore: 0.593,
    runtimeSeconds: 900,
    memoryMbytes: 1024,
    usageUsd: 0.25,
    costUsd: 0.25,
    chargedEventCount: 608,
    chargedDatasetItemEvents: 607,
    chargedActorStartEvents: 1,
    noLeakFailures: 0,
    secondBatchAuditObserved: true,
    falsePositiveInflationFailures: 0,
    storeViews: 12,
    runs: 4,
    uniqueUsers: 3,
    paidUsers: 1,
    refunds: 0,
    pricingModel: "pay_per_event_rows",
    payoutEnabled: true,
    payoutState: "enabled",
    analyticsVisible: true,
    conversionRate: 0.333,
    listingVisibility: "public",
    publicListingStatus: "public_listed_not_promoted",
    observedAt: "2026-06-21T00:00:00.000Z",
    ...overrides
  };
}

describe("hosted Apify paid readiness operator action board", () => {
  test("reports no-token plan shape without claiming a hosted proof", () => withHostedProofEnv({}, () => {
    const proof = buildHostedApifyPaidReadinessProof({ readObservedProofFromEnvironment: false });
    const board = proof.hostedProofOperatorChecklist.operatorActionBoard;

    expect(proof.status).toBe("external_token_missing");
    expect(board).toMatchObject({
      canRunNow: false,
      canVerifyRunNow: false,
      canImportObservedProofNow: false,
      missingSecretNames: ["APIFY_TOKEN"],
      expectedUnlock: "none"
    });
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
    const proof = buildHostedApifyPaidReadinessProof({
      observedProof: observedProof({ sampleOnly: true }),
      readObservedProofFromEnvironment: false
    });
    const checklist = proof.hostedProofOperatorChecklist;

    expect(checklist.status).toBe("sample_only");
    expect(checklist.unlockSummary).toBe("none");
    expect(checklist.operatorActionBoard.canImportObservedProofNow).toBe(true);
    expect(checklist.operatorActionBoard.stillBlockedAfterCommand).toContain("sampleOnly=true cannot unlock hosted or marketplace gates");
    expect(checklist.gateEffects.hosted100.state).toBe("blocked_sample");
    expect(checklist.gateEffects.hosted300.required.sellableFindingRows).toBe(150);
    expect(checklist.gateEffects.hosted500.required.sellableFindingRows).toBe(275);
  }));

  test("production hosted100 proof holds hosted300 below 300-row and 150-finding gate", () => withHostedProofEnv({}, () => {
    const proof = buildHostedApifyPaidReadinessProof({
      observedProof: observedProof({
        datasetItemCount: 180,
        sellableRows: 125,
        sellableFindingCount: 60,
        caveatedRows: 55,
        publicListingStatus: "draft_copy_ready_not_promoted"
      }),
      readObservedProofFromEnvironment: false
    });
    const checklist = proof.hostedProofOperatorChecklist;

    expect(checklist.unlockSummary).toBe("hosted100");
    expect(checklist.gateEffects.hosted100.state).toBe("pass");
    expect(checklist.gateEffects.hosted300.state).toBe("hold");
    expect(checklist.operatorActionBoard.stillBlockedAfterCommand.join(" ")).toContain("300 sellable rows and 150 finding rows");
  }));

  test("production hosted300 proof holds hosted500 below 500-row and 275-finding gate", () => withHostedProofEnv({}, () => {
    const proof = buildHostedApifyPaidReadinessProof({
      observedProof: observedProof({
        sellableRows: 320,
        sellableFindingCount: 160,
        caveatedRows: 287,
        publicListingStatus: "draft_copy_ready_not_promoted"
      }),
      readObservedProofFromEnvironment: false
    });
    const checklist = proof.hostedProofOperatorChecklist;

    expect(checklist.unlockSummary).toBe("hosted100_hosted300");
    expect(checklist.gateEffects.hosted300.state).toBe("pass");
    expect(checklist.gateEffects.hosted500.state).toBe("hold");
    expect(checklist.operatorActionBoard.stillBlockedAfterCommand.join(" ")).toContain("500 sellable rows and 275 finding rows");
  }));

  test("production hosted500 proof holds marketplace while listing remains draft", () => withHostedProofEnv({}, () => {
    const proof = buildHostedApifyPaidReadinessProof({
      observedProof: observedProof({ publicListingStatus: "draft_copy_ready_not_promoted" }),
      readObservedProofFromEnvironment: false
    });
    const checklist = proof.hostedProofOperatorChecklist;

    expect(checklist.unlockSummary).toBe("hosted100_hosted300_hosted500");
    expect(checklist.gateEffects.hosted500.state).toBe("pass");
    expect(checklist.gateEffects.marketplacePromotion.state).toBe("hold");
    expect(checklist.operatorActionBoard.stillBlockedAfterCommand).toContain("public listing state remains draft_copy_ready_not_promoted");
    expect(proof.conversionPayoutTruth.marketplaceListing.state).toBe("blocked");
  }));

  test("marketplace observed fields unlock only when complete and safe", () => withHostedProofEnv({}, () => {
    const proof = buildHostedApifyPaidReadinessProof({
      observedProof: observedProof(),
      readObservedProofFromEnvironment: false
    });

    expect(proof.hostedProofOperatorChecklist.unlockSummary).toBe("hosted100_hosted300_hosted500_marketplace_promotion");
    expect(proof.marketplaceConversionInputs).toMatchObject({
      storeViews: 12,
      runs: 4,
      uniqueUsers: 3,
      paidUsers: 1,
      refunds: 0,
      payoutEnabled: true,
      pricingModel: "pay_per_event_rows",
      publicListingStatus: "public_listed_not_promoted"
    });
    expect(proof.localCurrent500Gate).toMatchObject({
      sellableRows: 500,
      sellableFindingRows: 275,
      countsTowardPaidPromotion: false,
      hostedProofStillRequired: true
    });
    expect(proof.conversionPayoutTruth).toMatchObject({
      pricing: { state: "observed", value: "pay_per_event_rows" },
      payout: { state: "observed", enabled: true },
      analytics: { state: "observed", storeViews: 12, runs: 4, paidUsers: 1, refunds: 0 },
      hosted500: { state: "observed", requiredSellableRows: 500, requiredSellableFindingRows: 275 }
    });
    expect(proof.programFgObservedEvidenceBoard).toMatchObject({
      schemaVersion: "ti.program_fg_observed_apify_hosted_marketplace_truth.v1",
      importState: "proof_sufficient_for_public_traffic",
      hostedProofState: "sufficient_for_public_traffic",
      marketplaceTruthState: "observed_public",
      observedHostedRun: {
        runId: "run_observed_001",
        buildId: "build_observed_001",
        runStatus: "succeeded",
        failureState: "none",
        chargedEventCount: 608
      },
      observedMarketplaceTruth: {
        listingVisibility: "public",
        payoutState: "enabled",
        analyticsVisible: true,
        conversionRate: 0.333
      }
    });
  }));

  test("partial marketplace import leaves external fields unknown", () => withHostedProofEnv({}, () => {
    const partial = observedProof() as Partial<HostedApifyObservedProofImport>;
    delete partial.pricingModel;
    delete partial.payoutEnabled;
    const proof = buildHostedApifyPaidReadinessProof({
      observedProof: partial as HostedApifyObservedProofImport,
      readObservedProofFromEnvironment: false
    });

    expect(proof.hostedProofOperatorChecklist.missingFields).toEqual(expect.arrayContaining(["pricingModel", "payoutEnabled"]));
    expect(proof.hostedProofOperatorChecklist.unlockSummary).toBe("hosted100_hosted300_hosted500");
    expect(proof.hostedProofOperatorChecklist.gateEffects.hosted100.state).toBe("pass");
    expect(proof.hostedProofOperatorChecklist.gateEffects.hosted300.state).toBe("pass");
    expect(proof.hostedProofOperatorChecklist.gateEffects.hosted500.state).toBe("pass");
    expect(proof.hostedProofOperatorChecklist.gateEffects.marketplacePromotion.state).toBe("hold");
    expect(proof.marketplaceConversionInputs.payoutEnabled).toBe("external_unknown");
    expect(proof.marketplaceConversionInputs.pricingModel).toBe("external_unknown");
    expect(proof.conversionPayoutTruth.pricing.state).toBe("external_unknown");
    expect(proof.conversionPayoutTruth.payout.state).toBe("external_unknown");
  }));

  test("unsafe no-leak proof cannot unlock hosted gates", () => withHostedProofEnv({}, () => {
    const proof = buildHostedApifyPaidReadinessProof({
      observedProof: observedProof({ noLeakFailures: 1 }),
      readObservedProofFromEnvironment: false
    });

    expect(proof.hostedProofOperatorChecklist.unlockSummary).toBe("none");
    expect(proof.hostedProofOperatorChecklist.gateEffects.hosted100.state).toBe("blocked_unsafe");
    expect(proof.hostedProofOperatorChecklist.operatorActionBoard.stillBlockedAfterCommand).toContain("no-leak and false-positive inflation failures must be zero");
  }));
});
