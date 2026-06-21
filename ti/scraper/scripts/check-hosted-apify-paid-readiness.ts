import { buildHostedApifyPaidReadinessProof } from "../src/contracts/hostedApifyPaidReadiness.ts";

const proof = buildHostedApifyPaidReadinessProof({ hasToken: Boolean(process.env.APIFY_TOKEN) });
const actorId = process.env.TI_APIFY_ACTOR_ID ?? proof.actorId;
const runId = process.env.TI_APIFY_HOSTED_RUN_ID ?? "";
const datasetId = process.env.TI_APIFY_HOSTED_DATASET_ID ?? "";

const payload = {
  ...proof,
  paidPromotionReady: false,
  actorId,
  observedHostedRun: {
    runId: runId || null,
    datasetId: datasetId || null,
    suppliedViaEnvironment: Boolean(runId && datasetId),
    note: runId && datasetId
      ? "Run and dataset ids were supplied, but dataset counts still need observed Apify verification before paid promotion."
      : "No hosted 100-name run id or dataset id supplied."
  }
};

const paidRowIntegrityGate = payload.paidRowIntegrityGate;
const requiredZeroCountsPass = Object.values(paidRowIntegrityGate.requiredZeroCounts).every((value) => value === 0);
const integrityGatePass = paidRowIntegrityGate.schemaVersion === "ti.program_cp_hosted_paid_row_integrity_gate.v1"
  && paidRowIntegrityGate.sourceProofField === "falsePositiveSuppressionGate.programCpHardening.secondBatchAudit"
  && paidRowIntegrityGate.requiredForPaidPromotion === true
  && paidRowIntegrityGate.hostedProofCountsTowardPaidPromotion === false
  && paidRowIntegrityGate.sourceProvenanceRowsCountTowardFindingFloor === false
  && paidRowIntegrityGate.caveatedRowsCountTowardChargeable === false
  && requiredZeroCountsPass
  && paidRowIntegrityGate.requiredSignals.includes("current_public_support")
  && paidRowIntegrityGate.requiredSignals.includes("actor_specific")
  && paidRowIntegrityGate.requiredSignals.includes("finding_context")
  && paidRowIntegrityGate.requiredSignals.includes("freshness_not_stale")
  && paidRowIntegrityGate.requiredSignals.includes("provenance_hash")
  && paidRowIntegrityGate.requiredSignals.includes("no_leak")
  && paidRowIntegrityGate.requiredSignals.includes("buyer_action")
  && paidRowIntegrityGate.blockers.includes("hosted_100_name_cp_second_batch_audit_not_yet_observed")
  && paidRowIntegrityGate.blockers.includes("source_provenance_rows_do_not_count_as_findings")
  && paidRowIntegrityGate.blockers.includes("stale_alias_generic_graph_restricted_rows_must_be_zero");

if (!integrityGatePass) {
  console.error("Hosted Apify paid readiness proof is missing Program CP paid-row integrity gates.");
  process.exit(1);
}

const okForPaidPromotion = payload.status === "paid_floor_hosted_proof"
  && payload.marketplaceConversionInputs.payoutEnabled !== "external_unknown"
  && payload.marketplaceConversionInputs.pricingModel !== "external_unknown"
  && payload.paidProofAcceptance.minimumSellableRows === 100
  && payload.paidProofAcceptance.minimumSellableFindingRows >= 52
  && payload.paidProofAcceptance.sourceProvenanceRowsCountTowardFindingFloor === false
  && payload.paidProofAcceptance.falsePositiveInflationFailures === 0
  && integrityGatePass;

console.log(JSON.stringify(payload, null, 2));

if (okForPaidPromotion) {
  process.exit(0);
}

console.warn([
  "Hosted Apify paid readiness is not complete.",
  `status=${payload.status}`,
  `tokenState=${payload.tokenState}`,
  "paidRowIntegrityGate=hold_until_hosted_second_batch_audit_observed",
  "This is expected when APIFY_TOKEN or externally copied hosted metrics are unavailable; do not promote paid traffic from local proof alone."
].join("\n"));
process.exit(0);
