import type { HostedApifyObservedProofImport, HostedApifyPaidReadinessProof, HostedApifyProofObservation, HostedEvidenceImportState, HostedProofOperatorChecklist, HostedProofOperatorGateState } from "./hostedApifyPaidReadinessTypes.ts";
import { marketplaceObservedFieldNames, observedProofRequiredFields, hostedProofGateRequiredFields } from "./hostedApifyPaidReadinessFields.ts";
import { gateHoldReason, hasObservedImportValue, hosted100GateHoldReason, marketplacePromotionHoldReason, nextOperatorCommand, operatorStillBlockedAfterCommand } from "./hostedApifyPaidReadinessSupportUtils.ts";
export { normalizeHostedObservation, readInlineObservedProofFromEnvironment } from "./hostedApifyPaidReadinessSupportUtils.ts";

type SupportInput = { observedProof: HostedApifyObservedProofImport | undefined; observedFields: Required<HostedApifyProofObservation>; commandExamples: string[]; marketplaceValuesObserved: boolean; hasToken?: boolean; hasRunOrDatasetId?: boolean; hasObservedProofImportSource?: boolean };
const req = { hosted100: { defaultQueryCount: 100, sellableRows: 100, sellableFindingRows: 52, noLeakFailures: 0, falsePositiveInflationFailures: 0 }, hosted300: { sellableRows: 300, sellableFindingRows: 150, noLeakFailures: 0, falsePositiveInflationFailures: 0 }, hosted500: { sellableRows: 500, sellableFindingRows: 275, noLeakFailures: 0, falsePositiveInflationFailures: 0 } };

function gate(state: boolean, blocked: HostedProofOperatorGateState, reason: string, passReason: string, required: Record<string, unknown>) {
  return { state: state ? "pass" : blocked, unlocks: state, reason: state ? passReason : reason, required };
}

function proofState(input: SupportInput) {
  const sampleOnly = input.observedProof?.sampleOnly === true;
  const productionObserved = Boolean(input.observedProof && !sampleOnly);
  const missingFields = observedProofRequiredFields.filter((field) => !hasObservedImportValue(input.observedProof, field));
  const hostedMissingFields = hostedProofGateRequiredFields.filter((field) => !hasObservedImportValue(input.observedProof, field));
  const unsafeProof = input.observedFields.noLeakFailures !== null && input.observedFields.noLeakFailures !== 0 || input.observedFields.falsePositiveInflationFailures !== null && input.observedFields.falsePositiveInflationFailures !== 0;
  const hosted100 = productionObserved && hostedMissingFields.length === 0 && (input.observedProof?.defaultQueryCount ?? 0) >= 100 && (input.observedFields.sellableRows ?? 0) >= 100 && (input.observedFields.sellableFindingCount ?? 0) >= 52 && input.observedFields.noLeakFailures === 0 && input.observedFields.secondBatchAuditObserved === true && input.observedFields.falsePositiveInflationFailures === 0;
  const hosted300 = hosted100 && (input.observedFields.sellableRows ?? 0) >= 300 && (input.observedFields.sellableFindingCount ?? 0) >= 150;
  const hosted500 = hosted300 && (input.observedFields.sellableRows ?? 0) >= 500 && (input.observedFields.sellableFindingCount ?? 0) >= 275;
  const marketplacePromotion = hosted500 && input.marketplaceValuesObserved && input.observedProof?.refunds === 0 && input.observedProof.publicListingStatus !== "draft_copy_ready_not_promoted";
  return { sampleOnly, productionObserved, missingFields, hostedMissingFields, unsafeProof, hosted100, hosted300, hosted500, marketplacePromotion };
}

export function buildHostedProofOperatorChecklist(input: SupportInput): HostedProofOperatorChecklist {
  const s = proofState(input);
  const blocked: HostedProofOperatorGateState = s.sampleOnly ? "blocked_sample" : s.unsafeProof ? "blocked_unsafe" : "hold";
  const unlockSummary = s.marketplacePromotion ? "hosted100_hosted300_hosted500_marketplace_promotion" : s.hosted500 ? "hosted100_hosted300_hosted500" : s.hosted300 ? "hosted100_hosted300" : s.hosted100 ? "hosted100" : "none";
  return {
    schemaVersion: "ti.hosted_apify_proof_operator_checklist.v1",
    status: s.sampleOnly ? "sample_only" : s.productionObserved ? "production_observed" : "missing_proof",
    requiredFields: [...observedProofRequiredFields],
    missingFields: s.missingFields,
    acceptedObservedFields: observedProofRequiredFields.filter((field) => hasObservedImportValue(input.observedProof, field)),
    lastObservedTimestamp: input.observedProof?.observedAt ?? input.observedFields.lastVerifiedAt ?? null,
    sampleOnly: s.sampleOnly,
    unlockSummary,
    operatorActionBoard: { canRunNow: input.hasToken === true, canVerifyRunNow: input.hasToken === true && input.hasRunOrDatasetId === true, canImportObservedProofNow: input.hasObservedProofImportSource === true, missingSecretNames: input.hasToken ? [] : ["APIFY_TOKEN"], missingObservedFields: s.missingFields, nextCommand: nextOperatorCommand({ commandExamples: input.commandExamples, hasToken: input.hasToken === true, hasRunOrDatasetId: input.hasRunOrDatasetId === true, hasObservedProofImportSource: input.hasObservedProofImportSource === true }), expectedUnlock: unlockSummary, stillBlockedAfterCommand: operatorStillBlockedAfterCommand({ sampleOnly: s.sampleOnly, unsafeProof: s.unsafeProof, hosted100Pass: s.hosted100, hosted300Pass: s.hosted300, hosted500Pass: s.hosted500, marketplacePromotionPass: s.marketplacePromotion, marketplaceValuesObserved: input.marketplaceValuesObserved, missingFields: s.missingFields, observedFields: input.observedFields, hasToken: input.hasToken === true, hasObservedProofImportSource: input.hasObservedProofImportSource === true, publicListingStatus: input.observedProof?.publicListingStatus }) },
    gateEffects: {
      hosted100: gate(s.hosted100, blocked, hosted100GateHoldReason(s.sampleOnly, s.unsafeProof, s.hostedMissingFields, input.observedFields), "production observed proof satisfies the hosted 100-name floor", req.hosted100),
      hosted300: gate(s.hosted300, blocked, s.hosted100 ? "hosted 100 passes, but hosted sellable rows or finding rows are below the 300 gate" : gateHoldReason(s.sampleOnly, s.unsafeProof, s.hostedMissingFields, "hosted 100 must pass before hosted 300 can unlock"), "production observed proof satisfies the hosted 300-row gate", req.hosted300),
      hosted500: gate(s.hosted500, blocked, s.hosted300 ? "hosted 300 passes, but hosted sellable rows or finding rows are below the hosted 500 paid promotion gate" : gateHoldReason(s.sampleOnly, s.unsafeProof, s.hostedMissingFields, "hosted 300 must pass before hosted 500 can unlock"), "production observed proof satisfies the hosted 500-row paid promotion gate", req.hosted500),
      marketplacePromotion: gate(s.marketplacePromotion, blocked, marketplacePromotionHoldReason(s.sampleOnly, s.unsafeProof, s.hosted500, input.marketplaceValuesObserved, input.observedProof?.publicListingStatus), "hosted 500 and observed marketplace state allow promotion review", { hosted500: true, payoutEnabled: true, pricingModelObserved: true, analyticsObserved: true, refunds: 0, publicListingState: "public_listed_not_promoted_or_public_promoted" })
    },
    copyPasteCommands: input.commandExamples,
    validationExamples: [
      { name: "missing_proof", expectedStatus: "accepted_hold", unlockSummary: "none", reason: "no observed JSON was supplied, so every required hosted and marketplace field remains missing" },
      { name: "sample_proof_rejected_for_promotion", expectedStatus: "accepted_sample_no_unlock", unlockSummary: "none", reason: "sampleOnly=true imports can prove shape but cannot unlock hosted or marketplace gates" },
      { name: "valid_hosted100_hosted300_hold", expectedStatus: "accepted_hold", unlockSummary: "hosted100", reason: "a production proof with at least 100 sellable rows and 52 findings unlocks hosted100 while hosted300 stays held below 300 sellable rows" },
      { name: "valid_hosted300_hosted500_hold", expectedStatus: "accepted_hold", unlockSummary: "hosted100_hosted300", reason: "a production proof with 300 hosted sellable rows and 150 findings still keeps hosted500 held below 500 sellable rows and 275 findings" },
      { name: "valid_hosted500_marketplace_hold", expectedStatus: "accepted_hold", unlockSummary: "hosted100_hosted300_hosted500", reason: "a production proof with 500 hosted sellable rows and 275 findings still keeps marketplace promotion held when listing state remains draft or marketplace fields are not observed" },
      { name: "invalid_unsafe_no_leak_proof", expectedStatus: "rejected", unlockSummary: "none", reason: "any noLeakFailures value above 0 or false-positive inflation failure is rejected by the import checker" }
    ]
  };
}

export function buildConversionPayoutTruth(observedProof: HostedApifyObservedProofImport | undefined, observedFields: Required<HostedApifyProofObservation>, marketplaceValuesObserved: boolean, checklist: HostedProofOperatorChecklist): HostedApifyPaidReadinessProof["conversionPayoutTruth"] {
  const observed = marketplaceValuesObserved && Boolean(observedProof);
  const listingStatus = observedProof?.publicListingStatus;
  return {
    schemaVersion: "ti.hosted_apify_conversion_payout_truth.v1", observedOnly: true, noSyntheticFallback: true,
    pricing: { state: observed ? "observed" : "external_unknown", value: observed ? observedProof!.pricingModel : "external_unknown", proofField: "pricingModel", nextOperatorAction: observed ? "retain observed Store pricing evidence with timestamp" : "open Apify Store pricing and import pricingModel from authenticated evidence" },
    payout: { state: observed ? "observed" : "external_unknown", enabled: observed ? observedProof!.payoutEnabled : "external_unknown", proofField: "payoutEnabled", nextOperatorAction: observed ? "retain observed billing/payout evidence with timestamp" : "open Apify billing/payouts and import payoutEnabled from authenticated evidence" },
    analytics: { state: observed ? "observed" : "external_unknown", storeViews: observed ? observedProof!.storeViews : null, runs: observed ? observedProof!.runs : null, uniqueUsers: observed ? observedProof!.uniqueUsers : null, paidUsers: observed ? observedProof!.paidUsers : null, refunds: observed ? observedProof!.refunds : null, nextOperatorAction: observed ? "retain observed Store analytics with timestamp" : "open Apify Store analytics and import views, runs, users, paid users, and refunds from authenticated evidence" },
    marketplaceListing: { state: observed && listingStatus === "draft_copy_ready_not_promoted" ? "blocked" : observed ? "observed" : "external_unknown", publicListingStatus: observed && listingStatus ? listingStatus : "external_unknown", nextOperatorAction: observed && listingStatus === "draft_copy_ready_not_promoted" ? "publish or promote listing only after hosted500, payout, pricing, analytics, and refunds are observed" : observed ? "retain observed listing state with timestamp" : "open Apify Store listing and import publicListingStatus from authenticated evidence" },
    hosted500: { state: checklist.gateEffects.hosted500.unlocks ? "observed" : observedProof ? "blocked" : "external_unknown", requiredSellableRows: 500, requiredSellableFindingRows: 275, observedSellableRows: observedFields.sellableRows, observedSellableFindingRows: observedFields.sellableFindingCount, nextOperatorAction: checklist.gateEffects.hosted500.unlocks ? "retain hosted500 proof and continue marketplace evidence review" : "run or import hosted proof with at least 500 sellable rows, 275 finding rows, no leaks, and zero false-positive inflation failures" }
  };
}

export function buildProgramFgObservedEvidenceBoard(input: SupportInput & { checklist: HostedProofOperatorChecklist }): HostedApifyPaidReadinessProof["programFgObservedEvidenceBoard"] {
  const noProof = !input.observedProof, sampleOnly = input.observedProof?.sampleOnly === true, hosted100 = input.checklist.gateEffects.hosted100.unlocks, hosted500 = input.checklist.gateEffects.hosted500.unlocks, promotion = input.checklist.gateEffects.marketplacePromotion.unlocks;
  const listingVisibility = input.marketplaceValuesObserved && input.observedProof ? input.observedProof.listingVisibility : "external_unknown";
  const publicListingStatus = input.marketplaceValuesObserved && input.observedProof ? input.observedProof.publicListingStatus : "external_unknown";
  const publicReady = listingVisibility === "public" && publicListingStatus !== "draft_copy_ready_not_promoted";
  const importState: HostedEvidenceImportState = noProof ? "no_proof_imported" : hosted500 && promotion && publicReady ? "proof_sufficient_for_public_traffic" : hosted100 && input.marketplaceValuesObserved ? "proof_sufficient_for_private_beta" : "proof_imported_but_insufficient";
  const marketplaceMissingFields = marketplaceObservedFieldNames.filter((field) => !hasObservedImportValue(input.observedProof, field));
  return {
    schemaVersion: "ti.program_fg_observed_apify_hosted_marketplace_truth.v1", importState, hostedProofState: importState === "proof_sufficient_for_public_traffic" ? "sufficient_for_public_traffic" : importState === "proof_sufficient_for_private_beta" ? "sufficient_for_private_beta" : noProof ? "missing" : "insufficient", marketplaceTruthState: input.marketplaceValuesObserved && publicReady ? "observed_public" : input.marketplaceValuesObserved ? "observed_private" : noProof ? "external_unknown" : "insufficient", releaseBlockerState: importState === "proof_sufficient_for_public_traffic" ? "ready_for_public_traffic_review" : importState === "proof_sufficient_for_private_beta" ? "ready_for_private_beta_review" : importState, noSyntheticFallback: true,
    blockedProofClasses: ["sample", "template", "partial", "local_only", "historical_shape_safety"],
    observedHostedRun: { runId: input.observedFields.runId, buildId: input.observedFields.buildId, datasetId: input.observedFields.datasetId, runStatus: input.observedFields.runStatus, failureState: input.observedFields.failureState, runDurationSeconds: input.observedFields.runtimeSeconds, usageUsd: input.observedFields.usageUsd, costUsd: input.observedFields.costUsd, chargedEventCount: input.observedFields.chargedEventCount, chargedDatasetItemEvents: input.observedFields.chargedDatasetItemEvents, chargedActorStartEvents: input.observedFields.chargedActorStartEvents },
    observedMarketplaceTruth: { listingVisibility, publicListingStatus, pricingModel: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.pricingModel : "external_unknown", payoutState: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.payoutState : "external_unknown", analyticsVisible: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.analyticsVisible : "external_unknown", storeViews: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.storeViews : null, runs: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.runs : null, uniqueUsers: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.uniqueUsers : null, paidUsers: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.paidUsers : null, refunds: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.refunds : null, conversionRate: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.conversionRate : null, lastVerifiedAt: input.marketplaceValuesObserved && input.observedProof ? input.observedProof.observedAt : null },
    missingExternalFields: noProof ? [...observedProofRequiredFields] : input.checklist.missingFields,
    insufficientFields: [sampleOnly ? "sampleOnly" : null, !hosted100 ? "hosted100" : null, hosted100 && !hosted500 ? "hosted500" : null, !input.marketplaceValuesObserved ? "marketplace_truth" : null, input.marketplaceValuesObserved && !publicReady ? "public_listing_visibility" : null, input.observedProof?.refunds !== undefined && input.observedProof.refunds !== 0 ? "refunds" : null, input.observedFields.failureState && input.observedFields.failureState !== "none" ? "failureState" : null].filter(Boolean),
    marketplaceMissingFieldsOnlyTemplate: { schemaVersion: "ti.program_fh_marketplace_missing_fields_template.v1", safeToCommit: true, containsSecrets: false, importCommand: "TI_APIFY_OBSERVED_PROOF_PATH=<path-to-observed-proof.json> bun run check:hosted-apify-paid-readiness", missingFields: marketplaceMissingFields, fields: { storeViews: null, runs: null, uniqueUsers: null, paidUsers: null, refunds: null, pricingModel: "external_unknown", payoutEnabled: "external_unknown", payoutState: "external_unknown", analyticsVisible: "external_unknown", conversionRate: null, listingVisibility: "external_unknown", publicListingStatus: "external_unknown", observedAt: null } },
    nextSafeCommands: ["APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=run bun run check:hosted-apify-paid-readiness", "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=verify TI_APIFY_HOSTED_RUN_ID=<run id> bun run check:hosted-apify-paid-readiness", "TI_APIFY_OBSERVED_PROOF_PATH=<path-to-observed-proof.json> bun run check:hosted-apify-paid-readiness", ...input.commandExamples.filter((command) => command.includes("hosted-apify-observed-proof"))]
  };
}

export function buildHostedProofDeltaSincePrevious(observedFields: Required<HostedApifyProofObservation>): HostedApifyPaidReadinessProof["hostedProofDeltaSincePrevious"] {
  const baselineSellableRows = 46, baselineSellableFindingRows = 31, currentSellableRows = observedFields.sellableRows, currentSellableFindingRows = observedFields.sellableFindingCount;
  const sellableRowsDelta = currentSellableRows === null ? null : currentSellableRows - baselineSellableRows, sellableFindingRowsDelta = currentSellableFindingRows === null ? null : currentSellableFindingRows - baselineSellableFindingRows;
  const hosted100SellableGap = currentSellableRows === null ? null : Math.max(0, 100 - currentSellableRows), hosted100FindingGap = currentSellableFindingRows === null ? null : Math.max(0, 52 - currentSellableFindingRows);
  const floorReached = currentSellableRows !== null && currentSellableFindingRows !== null && currentSellableRows >= 100 && currentSellableFindingRows >= 52, improved = (sellableRowsDelta ?? 0) > 0 || (sellableFindingRowsDelta ?? 0) > 0;
  const direction = !observedFields.runId ? "no_current_hosted_proof_imported" : floorReached ? "hosted100_floor_reached" : improved ? "improved_below_floor" : "regressed_or_flat_below_floor";
  return { schemaVersion: "ti.program_fi_hosted_proof_delta_since_previous.v1", baselineRunId: "THMm2ZzYxW4HVPGJ6", baselineDatasetId: "xLPoxMVY6cVjGsS4e", baselineSellableRows, baselineSellableFindingRows, currentRunId: observedFields.runId, currentDatasetId: observedFields.datasetId, currentSellableRows, currentSellableFindingRows, sellableRowsDelta, sellableFindingRowsDelta, hosted100SellableGap, hosted100FindingGap, direction, nextAction: direction === "no_current_hosted_proof_imported" ? "Rerun or verify the hosted 100-name Apify proof when parser/public-corroboration fixes land." : floorReached ? "Import second-batch audit, false-positive audit, and marketplace truth before paid readiness can unlock." : `Hosted100 remains held; close ${hosted100SellableGap ?? 100} sellable rows and ${hosted100FindingGap ?? 52} finding rows versus the 100/52 floor.` };
}
