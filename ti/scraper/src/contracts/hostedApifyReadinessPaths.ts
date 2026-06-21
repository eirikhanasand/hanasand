import type { HostedApifyObservedProofImport, HostedApifyProofImportPath, HostedApifyProofObservation } from "./hostedApifyPaidReadinessTypes.ts";
import { commandExamples } from "./hostedApifyReadinessConstants.ts";

export function hostedProofImportPath(
  externalBlocker: HostedApifyProofImportPath["externalBlocker"],
  observedFields: Required<HostedApifyProofObservation>,
  observedProof: HostedApifyObservedProofImport | undefined
): HostedApifyProofImportPath {
  return {
    schemaVersion: "ti.hosted_apify_proof_import_path.v1",
    mode: "json_import_or_run_or_verify_with_apify_token",
    observedOnly: true,
    noSyntheticFallback: true,
    oldProofTreatment: "historical_shape_safety_only",
    externalBlocker,
    commandExamples,
    requiredEnvironment: ["APIFY_TOKEN", "TI_APIFY_ACTOR_ID=eirikhanasand/public-threat-actor-monitor", "TI_APIFY_HOSTED_PROOF_MODE=run|verify", "TI_APIFY_HOSTED_RUN_ID=<run id for verify mode>", "TI_APIFY_HOSTED_DATASET_ID=<dataset id when run metadata is unavailable>", "TI_APIFY_OBSERVED_PROOF_JSON=<single observed proof JSON>", "TI_APIFY_OBSERVED_PROOF_PATH=<path to observed proof JSON>"],
    observedFields,
    observedProofImport: { schemaVersion: "ti.hosted_apify_observed_proof_import_path.v1", acceptedSources: ["TI_APIFY_OBSERVED_PROOF_JSON", "TI_APIFY_OBSERVED_PROOF_PATH"], sampleOnly: observedProof?.sampleOnly === true, observedAt: observedProof?.observedAt ?? null, validationState: observedProof ? "accepted" : "missing", validationErrors: [] }
  };
}

export function marketplaceConversionInputs(observed: boolean, proof: HostedApifyObservedProofImport | undefined) {
  return {
    storeViews: observed && proof ? proof.storeViews : null,
    runs: observed && proof ? proof.runs : null,
    uniqueUsers: observed && proof ? proof.uniqueUsers : null,
    paidUsers: observed && proof ? proof.paidUsers : null,
    refunds: observed && proof ? proof.refunds : null,
    payoutEnabled: observed && proof ? proof.payoutEnabled : "external_unknown",
    pricingModel: observed && proof ? proof.pricingModel : "external_unknown",
    publicListingStatus: observed && proof ? proof.publicListingStatus : "draft_copy_ready_not_promoted",
    lastVerifiedAt: observed && proof ? proof.observedAt : null,
    unknownMeansNoClaim: true
  };
}
