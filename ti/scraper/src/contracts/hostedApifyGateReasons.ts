import type { HostedApifyObservedProofImport, HostedApifyProofObservation } from "./hostedApifyPaidReadinessTypes.ts";

export function gateHoldReason(sampleOnly: boolean, unsafeProof: boolean, missingFields: string[], fallback: string): string {
  if (sampleOnly) return "sampleOnly=true imports are accepted for shape checks but cannot unlock production gates";
  if (unsafeProof) return "unsafe proof was observed; no-leak and false-positive inflation failures must be zero";
  if (missingFields.length > 0) return `missing required fields: ${missingFields.join(", ")}`;
  return fallback;
}

export function hosted100GateHoldReason(sampleOnly: boolean, unsafeProof: boolean, missingFields: string[], observedFields: Required<HostedApifyProofObservation>): string {
  if (sampleOnly) return "sampleOnly=true imports are accepted for shape checks but cannot unlock production gates";
  if (unsafeProof) return "unsafe proof was observed; no-leak and false-positive inflation failures must be zero";
  const observedSellableRows = observedFields.sellableRows;
  const observedFindingRows = observedFields.sellableFindingCount;
  if (observedSellableRows !== null && observedFindingRows !== null && (observedSellableRows < 100 || observedFindingRows < 52)) return hosted100ThresholdBlocker(observedFields);
  if (missingFields.length > 0) return `missing required fields: ${missingFields.join(", ")}`;
  return "hosted 100-name proof is incomplete";
}

export function hosted100ThresholdBlocker(observedFields: Required<HostedApifyProofObservation>): string {
  const observedSellableRows = observedFields.sellableRows;
  const observedFindingRows = observedFields.sellableFindingCount;
  if (observedSellableRows === null || observedFindingRows === null) return "hosted100 remains held until a production observed proof reaches 100 sellable rows and 52 finding rows";
  const sellableGap = Math.max(0, 100 - observedSellableRows);
  const findingGap = Math.max(0, 52 - observedFindingRows);
  return `hosted100_below_threshold: observed ${observedSellableRows} sellable rows and ${observedFindingRows} finding rows; needs +${sellableGap} sellable rows and +${findingGap} finding rows`;
}

export function marketplacePromotionHoldReason(sampleOnly: boolean, unsafeProof: boolean, hosted500Pass: boolean, marketplaceValuesObserved: boolean, publicListingStatus: HostedApifyObservedProofImport["publicListingStatus"] | undefined): string {
  if (sampleOnly) return "sampleOnly=true imports cannot unlock marketplace promotion";
  if (unsafeProof) return "unsafe proof blocks marketplace promotion";
  if (!hosted500Pass) return "hosted500 must pass before marketplace promotion can unlock";
  if (!marketplaceValuesObserved) return "pricing, payout, Store analytics, paid users, runs, and refunds must be observed";
  if (publicListingStatus === "draft_copy_ready_not_promoted") return "listing state is still draft_copy_ready_not_promoted";
  return "marketplace promotion remains held until observed external state is complete";
}
