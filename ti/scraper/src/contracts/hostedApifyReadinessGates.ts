import type { HostedApifyObservedProofImport, HostedApifyPaidReadinessProof, HostedApifyProofImportPath, HostedApifyProofObservation } from "./hostedApifyPaidReadinessTypes.ts";

export function hasHostedRun(fields: Required<HostedApifyProofObservation>): boolean {
  return Boolean(fields.runId && fields.datasetId && fields.datasetItemCount !== null && fields.sellableRows !== null && fields.sellableFindingCount !== null && fields.caveatedRows !== null && fields.averageBuyerValueScore !== null && fields.noLeakFailures === 0);
}

export function hasMarketplaceValues(proof: HostedApifyObservedProofImport | undefined): boolean {
  return Boolean(proof && proof.sampleOnly !== true && Number.isFinite(proof.storeViews) && Number.isFinite(proof.runs) && Number.isFinite(proof.uniqueUsers) && Number.isFinite(proof.paidUsers) && Number.isFinite(proof.refunds) && typeof proof.pricingModel === "string" && proof.pricingModel.length > 0 && proof.payoutEnabled === true && proof.payoutState === "enabled" && proof.analyticsVisible === true && Number.isFinite(proof.conversionRate) && (proof.listingVisibility === "private" || proof.listingVisibility === "public"));
}

export function hostedPaidProofExternalBlocker(input: {
  importedPaidFloorProof: boolean;
  tokenState: HostedApifyPaidReadinessProof["tokenState"];
  hosted100NameRunObserved: boolean;
  hosted100NameProofObserved: boolean;
  marketplaceValuesObserved: boolean;
  observedFields: Required<HostedApifyProofObservation>;
}): HostedApifyProofImportPath["externalBlocker"] {
  if (input.importedPaidFloorProof) return null;
  if (input.tokenState === "external_token_missing") return "external_token_missing";
  if (!input.hosted100NameRunObserved) return "hosted_100_name_run_not_observed";
  if ((input.observedFields.sellableRows ?? 0) < 100 || (input.observedFields.sellableFindingCount ?? 0) < 52) return "hosted_100_name_run_below_paid_floor";
  if (input.observedFields.secondBatchAuditObserved !== true) return "hosted_second_batch_audit_not_observed";
  if (input.observedFields.falsePositiveInflationFailures !== 0) return "hosted_false_positive_audit_not_observed";
  if (input.hosted100NameProofObserved && !input.marketplaceValuesObserved) return "external_payout_pricing_analytics_not_yet_verified";
  return null;
}

export function paidRowIntegrityGate() {
  return {
    schemaVersion: "ti.program_cp_hosted_paid_row_integrity_gate.v1",
    sourceProofField: "falsePositiveSuppressionGate.programCpHardening.secondBatchAudit",
    requiredForPaidPromotion: true,
    hostedProofCountsTowardPaidPromotion: false,
    sourceProvenanceRowsCountTowardFindingFloor: false,
    requiredZeroCounts: { staleLatestActivitySellableRows: 0, aliasOrWrongActorSellableRows: 0, genericSourcePageSellableRows: 0, graphOnlySellableRows: 0, restrictedOnlySellableRows: 0 },
    caveatedRowsCountTowardChargeable: false,
    requiredSignals: ["current_public_support", "actor_specific", "finding_context", "freshness_not_stale", "provenance_hash", "no_leak", "buyer_action"],
    blockers: ["hosted_100_name_cp_second_batch_audit_not_yet_observed", "source_provenance_rows_do_not_count_as_findings", "stale_alias_generic_graph_restricted_rows_must_be_zero"],
    noLeakProof: { rawEvidenceExposed: false, unsafeUrlsExposed: false, restrictedPayloadsExposed: false, objectKeysExposed: false, privateMaterialExposed: false, actorInteractionContentExposed: false }
  };
}
