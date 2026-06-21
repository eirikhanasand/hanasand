import type { HostedApifyObservedProofImport, HostedApifyPaidReadinessProof, HostedApifyProofObservation, HostedEvidenceImportState, HostedProofOperatorChecklist, HostedProofOperatorGateState } from "./hostedApifyPaidReadinessTypes.ts";
import { gateHoldReason, hasObservedImportValue, hosted100GateHoldReason, marketplacePromotionHoldReason, nextOperatorCommand, operatorStillBlockedAfterCommand } from "./hostedApifyPaidReadinessSupportUtils.ts";
export { normalizeHostedObservation, readInlineObservedProofFromEnvironment } from "./hostedApifyPaidReadinessSupportUtils.ts";

import { hostedProofGateRequiredFields, marketplaceObservedFieldNames, observedProofRequiredFields } from "./hostedApifyPaidReadinessFields.ts";
export function buildHostedProofOperatorChecklist(input: {
  observedProof: HostedApifyObservedProofImport | undefined;
  observedFields: Required<HostedApifyProofObservation>;
  commandExamples: string[];
  marketplaceValuesObserved: boolean;
  hasToken: boolean;
  hasRunOrDatasetId: boolean;
  hasObservedProofImportSource: boolean;
}): HostedProofOperatorChecklist {
  const sampleOnly = input.observedProof?.sampleOnly === true;
  const productionObserved = Boolean(input.observedProof && !sampleOnly);
  const missingFields = observedProofRequiredFields.filter((field) => !hasObservedImportValue(input.observedProof, field));
  const hostedMissingFields = hostedProofGateRequiredFields.filter((field) => !hasObservedImportValue(input.observedProof, field));
  const acceptedObservedFields = observedProofRequiredFields.filter((field) => hasObservedImportValue(input.observedProof, field));
  const unsafeProof = input.observedFields.noLeakFailures !== null && input.observedFields.noLeakFailures !== 0
    || input.observedFields.falsePositiveInflationFailures !== null && input.observedFields.falsePositiveInflationFailures !== 0;
  const hosted100Pass = productionObserved
    && hostedMissingFields.length === 0
    && (input.observedProof?.defaultQueryCount ?? 0) >= 100
    && (input.observedFields.sellableRows ?? 0) >= 100
    && (input.observedFields.sellableFindingCount ?? 0) >= 52
    && input.observedFields.noLeakFailures === 0
    && input.observedFields.secondBatchAuditObserved === true
    && input.observedFields.falsePositiveInflationFailures === 0;
  const hosted300Pass = hosted100Pass
    && (input.observedFields.sellableRows ?? 0) >= 300
    && (input.observedFields.sellableFindingCount ?? 0) >= 150;
  const hosted500Pass = hosted300Pass
    && (input.observedFields.sellableRows ?? 0) >= 500
    && (input.observedFields.sellableFindingCount ?? 0) >= 275;
  const marketplacePromotionPass = hosted500Pass
    && input.marketplaceValuesObserved
    && input.observedProof?.refunds === 0
    && input.observedProof.publicListingStatus !== "draft_copy_ready_not_promoted";

  const blockedState: HostedProofOperatorGateState = sampleOnly ? "blocked_sample" : unsafeProof ? "blocked_unsafe" : "hold";
  const unlockSummary: HostedProofOperatorChecklist["unlockSummary"] = marketplacePromotionPass
    ? "hosted100_hosted300_hosted500_marketplace_promotion"
    : hosted500Pass
      ? "hosted100_hosted300_hosted500"
      : hosted300Pass
        ? "hosted100_hosted300"
        : hosted100Pass
          ? "hosted100"
          : "none";
  const stillBlockedAfterCommand = operatorStillBlockedAfterCommand({
    sampleOnly,
    unsafeProof,
    hosted100Pass,
    hosted300Pass,
    hosted500Pass,
    marketplacePromotionPass,
    marketplaceValuesObserved: input.marketplaceValuesObserved,
    missingFields,
    observedFields: input.observedFields,
    hasToken: input.hasToken,
    hasObservedProofImportSource: input.hasObservedProofImportSource,
    publicListingStatus: input.observedProof?.publicListingStatus
  });

  return {
    schemaVersion: "ti.hosted_apify_proof_operator_checklist.v1",
    status: sampleOnly ? "sample_only" : productionObserved ? "production_observed" : "missing_proof",
    requiredFields: [...observedProofRequiredFields],
    missingFields,
    acceptedObservedFields,
    lastObservedTimestamp: input.observedProof?.observedAt ?? input.observedFields.lastVerifiedAt ?? null,
    sampleOnly,
    unlockSummary,
    operatorActionBoard: {
      canRunNow: input.hasToken,
      canVerifyRunNow: input.hasToken && input.hasRunOrDatasetId,
      canImportObservedProofNow: input.hasObservedProofImportSource,
      missingSecretNames: input.hasToken ? [] : ["APIFY_TOKEN"],
      missingObservedFields: missingFields,
      nextCommand: nextOperatorCommand(input),
      expectedUnlock: unlockSummary,
      stillBlockedAfterCommand
    },
    gateEffects: {
      hosted100: {
        state: hosted100Pass ? "pass" : blockedState,
        unlocks: hosted100Pass,
        reason: hosted100Pass ? "production observed proof satisfies the hosted 100-name floor" : hosted100GateHoldReason(sampleOnly, unsafeProof, hostedMissingFields, input.observedFields),
        required: { defaultQueryCount: 100, sellableRows: 100, sellableFindingRows: 52, noLeakFailures: 0, falsePositiveInflationFailures: 0 }
      },
      hosted300: {
        state: hosted300Pass ? "pass" : blockedState,
        unlocks: hosted300Pass,
        reason: hosted300Pass ? "production observed proof satisfies the hosted 300-row gate" : hosted100Pass ? "hosted 100 passes, but hosted sellable rows or finding rows are below the 300 gate" : gateHoldReason(sampleOnly, unsafeProof, hostedMissingFields, "hosted 100 must pass before hosted 300 can unlock"),
        required: { sellableRows: 300, sellableFindingRows: 150, noLeakFailures: 0, falsePositiveInflationFailures: 0 }
      },
      hosted500: {
        state: hosted500Pass ? "pass" : blockedState,
        unlocks: hosted500Pass,
        reason: hosted500Pass ? "production observed proof satisfies the hosted 500-row paid promotion gate" : hosted300Pass ? "hosted 300 passes, but hosted sellable rows or finding rows are below the hosted 500 paid promotion gate" : gateHoldReason(sampleOnly, unsafeProof, hostedMissingFields, "hosted 300 must pass before hosted 500 can unlock"),
        required: { sellableRows: 500, sellableFindingRows: 275, noLeakFailures: 0, falsePositiveInflationFailures: 0 }
      },
      marketplacePromotion: {
        state: marketplacePromotionPass ? "pass" : blockedState,
        unlocks: marketplacePromotionPass,
        reason: marketplacePromotionPass ? "hosted 500 and observed marketplace state allow promotion review" : marketplacePromotionHoldReason(sampleOnly, unsafeProof, hosted500Pass, input.marketplaceValuesObserved, input.observedProof?.publicListingStatus),
        required: { hosted500: true, payoutEnabled: true, pricingModelObserved: true, analyticsObserved: true, refunds: 0, publicListingState: "public_listed_not_promoted_or_public_promoted" }
      }
    },
    copyPasteCommands: input.commandExamples,
    validationExamples: [
      {
        name: "missing_proof",
        expectedStatus: "accepted_hold",
        unlockSummary: "none",
        reason: "no observed JSON was supplied, so every required hosted and marketplace field remains missing"
      },
      {
        name: "sample_proof_rejected_for_promotion",
        expectedStatus: "accepted_sample_no_unlock",
        unlockSummary: "none",
        reason: "sampleOnly=true imports can prove shape but cannot unlock hosted or marketplace gates"
      },
      {
        name: "valid_hosted100_hosted300_hold",
        expectedStatus: "accepted_hold",
        unlockSummary: "hosted100",
        reason: "a production proof with at least 100 sellable rows and 52 findings unlocks hosted100 while hosted300 stays held below 300 sellable rows"
      },
      {
        name: "valid_hosted300_hosted500_hold",
        expectedStatus: "accepted_hold",
        unlockSummary: "hosted100_hosted300",
        reason: "a production proof with 300 hosted sellable rows and 150 findings still keeps hosted500 held below 500 sellable rows and 275 findings"
      },
      {
        name: "valid_hosted500_marketplace_hold",
        expectedStatus: "accepted_hold",
        unlockSummary: "hosted100_hosted300_hosted500",
        reason: "a production proof with 500 hosted sellable rows and 275 findings still keeps marketplace promotion held when listing state remains draft or marketplace fields are not observed"
      },
      {
        name: "invalid_unsafe_no_leak_proof",
        expectedStatus: "rejected",
        unlockSummary: "none",
        reason: "any noLeakFailures value above 0 or false-positive inflation failure is rejected by the import checker"
      }
    ]
  };
}

export function buildConversionPayoutTruth(
  observedProof: HostedApifyObservedProofImport | undefined,
  observedFields: Required<HostedApifyProofObservation>,
  marketplaceValuesObserved: boolean,
  checklist: HostedProofOperatorChecklist
): HostedApifyPaidReadinessProof["conversionPayoutTruth"] {
  const hosted500Pass = checklist.gateEffects.hosted500.unlocks;
  const analyticsObserved = marketplaceValuesObserved && Boolean(observedProof);
  const listingStatus = observedProof?.publicListingStatus;
  const listingObserved = marketplaceValuesObserved && Boolean(listingStatus);
  const listingBlocked = listingObserved && listingStatus === "draft_copy_ready_not_promoted";
  return {
    schemaVersion: "ti.hosted_apify_conversion_payout_truth.v1",
    observedOnly: true,
    noSyntheticFallback: true,
    pricing: {
      state: marketplaceValuesObserved && observedProof ? "observed" : "external_unknown",
      value: marketplaceValuesObserved && observedProof ? observedProof.pricingModel : "external_unknown",
      proofField: "pricingModel",
      nextOperatorAction: marketplaceValuesObserved ? "retain observed Store pricing evidence with timestamp" : "open Apify Store pricing and import pricingModel from authenticated evidence"
    },
    payout: {
      state: marketplaceValuesObserved && observedProof ? "observed" : "external_unknown",
      enabled: marketplaceValuesObserved && observedProof ? observedProof.payoutEnabled : "external_unknown",
      proofField: "payoutEnabled",
      nextOperatorAction: marketplaceValuesObserved ? "retain observed billing/payout evidence with timestamp" : "open Apify billing/payouts and import payoutEnabled from authenticated evidence"
    },
    analytics: {
      state: analyticsObserved ? "observed" : "external_unknown",
      storeViews: analyticsObserved && observedProof ? observedProof.storeViews : null,
      runs: analyticsObserved && observedProof ? observedProof.runs : null,
      uniqueUsers: analyticsObserved && observedProof ? observedProof.uniqueUsers : null,
      paidUsers: analyticsObserved && observedProof ? observedProof.paidUsers : null,
      refunds: analyticsObserved && observedProof ? observedProof.refunds : null,
      nextOperatorAction: analyticsObserved ? "retain observed Store analytics with timestamp" : "open Apify Store analytics and import views, runs, users, paid users, and refunds from authenticated evidence"
    },
    marketplaceListing: {
      state: listingBlocked ? "blocked" : listingObserved ? "observed" : "external_unknown",
      publicListingStatus: listingObserved && listingStatus ? listingStatus : "external_unknown",
      nextOperatorAction: listingBlocked ? "publish or promote listing only after hosted500, payout, pricing, analytics, and refunds are observed" : listingObserved ? "retain observed listing state with timestamp" : "open Apify Store listing and import publicListingStatus from authenticated evidence"
    },
    hosted500: {
      state: hosted500Pass ? "observed" : observedProof ? "blocked" : "external_unknown",
      requiredSellableRows: 500,
      requiredSellableFindingRows: 275,
      observedSellableRows: observedFields.sellableRows,
      observedSellableFindingRows: observedFields.sellableFindingCount,
      nextOperatorAction: hosted500Pass ? "retain hosted500 proof and continue marketplace evidence review" : "run or import hosted proof with at least 500 sellable rows, 275 finding rows, no leaks, and zero false-positive inflation failures"
    }
  };
}

export function buildProgramFgObservedEvidenceBoard(input: {
  observedProof: HostedApifyObservedProofImport | undefined;
  observedFields: Required<HostedApifyProofObservation>;
  checklist: HostedProofOperatorChecklist;
  marketplaceValuesObserved: boolean;
  commandExamples: string[];
}): HostedApifyPaidReadinessProof["programFgObservedEvidenceBoard"] {
  const noProofImported = !input.observedProof;
  const sampleOnly = input.observedProof?.sampleOnly === true;
  const hosted100Pass = input.checklist.gateEffects.hosted100.unlocks;
  const hosted500Pass = input.checklist.gateEffects.hosted500.unlocks;
  const marketplacePromotionPass = input.checklist.gateEffects.marketplacePromotion.unlocks;
  const listingVisibility = input.marketplaceValuesObserved && input.observedProof ? input.observedProof.listingVisibility : "external_unknown";
  const publicListingStatus = input.marketplaceValuesObserved && input.observedProof ? input.observedProof.publicListingStatus : "external_unknown";
  const publicListingReady = listingVisibility === "public" && publicListingStatus !== "draft_copy_ready_not_promoted";
  const importState: HostedEvidenceImportState = noProofImported
    ? "no_proof_imported"
    : hosted500Pass && marketplacePromotionPass && publicListingReady
      ? "proof_sufficient_for_public_traffic"
      : hosted100Pass && input.marketplaceValuesObserved
        ? "proof_sufficient_for_private_beta"
        : "proof_imported_but_insufficient";
  const hostedProofState = importState === "proof_sufficient_for_public_traffic"
    ? "sufficient_for_public_traffic"
    : importState === "proof_sufficient_for_private_beta"
      ? "sufficient_for_private_beta"
      : noProofImported
        ? "missing"
        : "insufficient";
  const marketplaceTruthState = input.marketplaceValuesObserved && publicListingReady
    ? "observed_public"
    : input.marketplaceValuesObserved
      ? "observed_private"
      : noProofImported
        ? "external_unknown"
        : "insufficient";
  const releaseBlockerState = importState === "proof_sufficient_for_public_traffic"
    ? "ready_for_public_traffic_review"
    : importState === "proof_sufficient_for_private_beta"
      ? "ready_for_private_beta_review"
      : importState;
  const missingExternalFields = noProofImported
    ? [...observedProofRequiredFields]
    : input.checklist.missingFields;
  const marketplaceMissingFields = marketplaceObservedFieldNames.filter((field) => !hasObservedImportValue(input.observedProof, field));
  const insufficientFields = [
    sampleOnly ? "sampleOnly" : null,
    !hosted100Pass ? "hosted100" : null,
    hosted100Pass && !hosted500Pass ? "hosted500" : null,
    !input.marketplaceValuesObserved ? "marketplace_truth" : null,
    input.marketplaceValuesObserved && !publicListingReady ? "public_listing_visibility" : null,
    input.observedProof?.refunds !== undefined && input.observedProof.refunds !== 0 ? "refunds" : null,
    input.observedFields.failureState && input.observedFields.failureState !== "none" ? "failureState" : null
  ].filter((value): value is string => Boolean(value));

  return {
    schemaVersion: "ti.program_fg_observed_apify_hosted_marketplace_truth.v1",
    importState,
    hostedProofState,
    marketplaceTruthState,
    releaseBlockerState,
    noSyntheticFallback: true,
    blockedProofClasses: ["sample", "template", "partial", "local_only", "historical_shape_safety"],
    observedHostedRun: {
      runId: input.observedFields.runId,
      buildId: input.observedFields.buildId,
      datasetId: input.observedFields.datasetId,
      runStatus: input.observedFields.runStatus,
      failureState: input.observedFields.failureState,
      runDurationSeconds: input.observedFields.runtimeSeconds,
      usageUsd: input.observedFields.usageUsd,
      costUsd: input.observedFields.costUsd,
      chargedEventCount: input.observedFields.chargedEventCount,
      chargedDatasetItemEvents: input.observedFields.chargedDatasetItemEvents,
      chargedActorStartEvents: input.observedFields.chargedActorStartEvents
    },
    observedMarketplaceTruth: {
      listingVisibility,
      publicListingStatus,
      pricingModel: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.pricingModel : "external_unknown",
      payoutState: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.payoutState : "external_unknown",
      analyticsVisible: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.analyticsVisible : "external_unknown",
      storeViews: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.storeViews : null,
      runs: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.runs : null,
      uniqueUsers: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.uniqueUsers : null,
      paidUsers: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.paidUsers : null,
      refunds: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.refunds : null,
      conversionRate: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.conversionRate : null,
      lastVerifiedAt: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.observedAt : null
    },
    missingExternalFields,
    insufficientFields,
    marketplaceMissingFieldsOnlyTemplate: {
      schemaVersion: "ti.program_fh_marketplace_missing_fields_template.v1",
      safeToCommit: true,
      containsSecrets: false,
      importCommand: "TI_APIFY_OBSERVED_PROOF_PATH=<path-to-observed-proof.json> bun run check:hosted-apify-paid-readiness",
      missingFields: marketplaceMissingFields,
      fields: {
        storeViews: null,
        runs: null,
        uniqueUsers: null,
        paidUsers: null,
        refunds: null,
        pricingModel: "external_unknown",
        payoutEnabled: "external_unknown",
        payoutState: "external_unknown",
        analyticsVisible: "external_unknown",
        conversionRate: null,
        listingVisibility: "external_unknown",
        publicListingStatus: "external_unknown",
        observedAt: null
      }
    },
    nextSafeCommands: [
      "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=run bun run check:hosted-apify-paid-readiness",
      "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=verify TI_APIFY_HOSTED_RUN_ID=<run id> bun run check:hosted-apify-paid-readiness",
      "TI_APIFY_OBSERVED_PROOF_PATH=<path-to-observed-proof.json> bun run check:hosted-apify-paid-readiness",
      ...input.commandExamples.filter((command) => command.includes("hosted-apify-observed-proof"))
    ]
  };
}

export function buildHostedProofDeltaSincePrevious(
  observedFields: Required<HostedApifyProofObservation>
): HostedApifyPaidReadinessProof["hostedProofDeltaSincePrevious"] {
  const baselineSellableRows = 46;
  const baselineSellableFindingRows = 31;
  const currentSellableRows = observedFields.sellableRows;
  const currentSellableFindingRows = observedFields.sellableFindingCount;
  const sellableRowsDelta = currentSellableRows === null ? null : currentSellableRows - baselineSellableRows;
  const sellableFindingRowsDelta = currentSellableFindingRows === null ? null : currentSellableFindingRows - baselineSellableFindingRows;
  const hosted100SellableGap = currentSellableRows === null ? null : Math.max(0, 100 - currentSellableRows);
  const hosted100FindingGap = currentSellableFindingRows === null ? null : Math.max(0, 52 - currentSellableFindingRows);
  const floorReached = currentSellableRows !== null && currentSellableFindingRows !== null && currentSellableRows >= 100 && currentSellableFindingRows >= 52;
  const improved = (sellableRowsDelta ?? 0) > 0 || (sellableFindingRowsDelta ?? 0) > 0;
  const direction: HostedApifyPaidReadinessProof["hostedProofDeltaSincePrevious"]["direction"] = !observedFields.runId
    ? "no_current_hosted_proof_imported"
    : floorReached
      ? "hosted100_floor_reached"
      : improved
        ? "improved_below_floor"
        : "regressed_or_flat_below_floor";
  const nextAction = direction === "no_current_hosted_proof_imported"
    ? "Rerun or verify the hosted 100-name Apify proof when parser/public-corroboration fixes land."
    : floorReached
      ? "Import second-batch audit, false-positive audit, and marketplace truth before paid readiness can unlock."
      : `Hosted100 remains held; close ${hosted100SellableGap ?? 100} sellable rows and ${hosted100FindingGap ?? 52} finding rows versus the 100/52 floor.`;
  return {
    schemaVersion: "ti.program_fi_hosted_proof_delta_since_previous.v1",
    baselineRunId: "THMm2ZzYxW4HVPGJ6",
    baselineDatasetId: "xLPoxMVY6cVjGsS4e",
    baselineSellableRows,
    baselineSellableFindingRows,
    currentRunId: observedFields.runId,
    currentDatasetId: observedFields.datasetId,
    currentSellableRows,
    currentSellableFindingRows,
    sellableRowsDelta,
    sellableFindingRowsDelta,
    hosted100SellableGap,
    hosted100FindingGap,
    direction,
    nextAction
  };
}
