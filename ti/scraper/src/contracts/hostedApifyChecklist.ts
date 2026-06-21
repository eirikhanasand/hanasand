import type { HostedProofOperatorGateState } from "./hostedApifyPaidReadinessTypes.ts";
import { hostedProofGateRequiredFields, observedProofRequiredFields } from "./hostedApifyPaidReadinessFields.ts";
import { hostedReadinessRequirements, type HostedApifySupportInput } from "./hostedApifySupportTypes.ts";
import { gateHoldReason, hasObservedImportValue, hosted100GateHoldReason, marketplacePromotionHoldReason, nextOperatorCommand, operatorStillBlockedAfterCommand } from "./hostedApifyPaidReadinessSupportUtils.ts";

function gate(state: boolean, blocked: HostedProofOperatorGateState, reason: string, passReason: string, required: Record<string, unknown>) {
  return { state: state ? "pass" : blocked, unlocks: state, reason: state ? passReason : reason, required };
}

function proofState(input: HostedApifySupportInput) {
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

export function buildHostedProofOperatorChecklist(input: HostedApifySupportInput) {
  const s = proofState(input);
  const blocked: HostedProofOperatorGateState = s.sampleOnly ? "blocked_sample" : s.unsafeProof ? "blocked_unsafe" : "hold";
  const unlockSummary = s.marketplacePromotion ? "hosted100_hosted300_hosted500_marketplace_promotion" : s.hosted500 ? "hosted100_hosted300_hosted500" : s.hosted300 ? "hosted100_hosted300" : s.hosted100 ? "hosted100" : "none";
  return {
    schemaVersion: "ti.hosted_apify_proof_operator_checklist.v1", status: s.sampleOnly ? "sample_only" : s.productionObserved ? "production_observed" : "missing_proof", requiredFields: [...observedProofRequiredFields], missingFields: s.missingFields, acceptedObservedFields: observedProofRequiredFields.filter((field) => hasObservedImportValue(input.observedProof, field)), lastObservedTimestamp: input.observedProof?.observedAt ?? input.observedFields.lastVerifiedAt ?? null, sampleOnly: s.sampleOnly, unlockSummary,
    operatorActionBoard: { canRunNow: input.hasToken === true, canVerifyRunNow: input.hasToken === true && input.hasRunOrDatasetId === true, canImportObservedProofNow: input.hasObservedProofImportSource === true, missingSecretNames: input.hasToken ? [] : ["APIFY_TOKEN"], missingObservedFields: s.missingFields, nextCommand: nextOperatorCommand({ commandExamples: input.commandExamples, hasToken: input.hasToken === true, hasRunOrDatasetId: input.hasRunOrDatasetId === true, hasObservedProofImportSource: input.hasObservedProofImportSource === true }), expectedUnlock: unlockSummary, stillBlockedAfterCommand: operatorStillBlockedAfterCommand({ sampleOnly: s.sampleOnly, unsafeProof: s.unsafeProof, hosted100Pass: s.hosted100, hosted300Pass: s.hosted300, hosted500Pass: s.hosted500, marketplacePromotionPass: s.marketplacePromotion, marketplaceValuesObserved: input.marketplaceValuesObserved, missingFields: s.missingFields, observedFields: input.observedFields, hasToken: input.hasToken === true, hasObservedProofImportSource: input.hasObservedProofImportSource === true, publicListingStatus: input.observedProof?.publicListingStatus }) },
    gateEffects: { hosted100: gate(s.hosted100, blocked, hosted100GateHoldReason(s.sampleOnly, s.unsafeProof, s.hostedMissingFields, input.observedFields), "production observed proof satisfies the hosted 100-name floor", hostedReadinessRequirements.hosted100), hosted300: gate(s.hosted300, blocked, s.hosted100 ? "hosted 100 passes, but hosted sellable rows or finding rows are below the 300 gate" : gateHoldReason(s.sampleOnly, s.unsafeProof, s.hostedMissingFields, "hosted 100 must pass before hosted 300 can unlock"), "production observed proof satisfies the hosted 300-row gate", hostedReadinessRequirements.hosted300), hosted500: gate(s.hosted500, blocked, s.hosted300 ? "hosted 300 passes, but hosted sellable rows or finding rows are below the hosted 500 paid promotion gate" : gateHoldReason(s.sampleOnly, s.unsafeProof, s.hostedMissingFields, "hosted 300 must pass before hosted 500 can unlock"), "production observed proof satisfies the hosted 500-row paid promotion gate", hostedReadinessRequirements.hosted500), marketplacePromotion: gate(s.marketplacePromotion, blocked, marketplacePromotionHoldReason(s.sampleOnly, s.unsafeProof, s.hosted500, input.marketplaceValuesObserved, input.observedProof?.publicListingStatus), "hosted 500 and observed marketplace state allow promotion review", { hosted500: true, payoutEnabled: true, pricingModelObserved: true, analyticsObserved: true, refunds: 0, publicListingState: "public_listed_not_promoted_or_public_promoted" }) },
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
