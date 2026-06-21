import type {
  HostedApifyObservedProofImport,
  HostedApifyPaidReadinessProof,
  HostedApifyProofObservation,
  HostedProofOperatorChecklist
} from "./hostedApifyPaidReadinessTypes.ts";

export function buildConversionPayoutTruth(
  observedProof: HostedApifyObservedProofImport | undefined,
  observedFields: Required<HostedApifyProofObservation>,
  marketplaceValuesObserved: boolean,
  checklist: HostedProofOperatorChecklist
): HostedApifyPaidReadinessProof["conversionPayoutTruth"] {
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
