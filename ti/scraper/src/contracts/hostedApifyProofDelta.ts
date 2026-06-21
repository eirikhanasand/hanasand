import type { HostedApifyPaidReadinessProof, HostedApifyProofObservation } from "./hostedApifyPaidReadinessTypes.ts";

export function buildHostedProofDeltaSincePrevious(
  observedFields: Required<HostedApifyProofObservation>
): HostedApifyPaidReadinessProof["hostedProofDeltaSincePrevious"] {
  const baselineSellableRows = 46, baselineSellableFindingRows = 31;
  const currentSellableRows = observedFields.sellableRows;
  const currentSellableFindingRows = observedFields.sellableFindingCount;
  const sellableRowsDelta = currentSellableRows === null ? null : currentSellableRows - baselineSellableRows;
  const sellableFindingRowsDelta = currentSellableFindingRows === null ? null : currentSellableFindingRows - baselineSellableFindingRows;
  const hosted100SellableGap = currentSellableRows === null ? null : Math.max(0, 100 - currentSellableRows);
  const hosted100FindingGap = currentSellableFindingRows === null ? null : Math.max(0, 52 - currentSellableFindingRows);
  const floorReached = currentSellableRows !== null && currentSellableFindingRows !== null && currentSellableRows >= 100 && currentSellableFindingRows >= 52;
  const improved = (sellableRowsDelta ?? 0) > 0 || (sellableFindingRowsDelta ?? 0) > 0;
  const direction = !observedFields.runId ? "no_current_hosted_proof_imported" : floorReached ? "hosted100_floor_reached" : improved ? "improved_below_floor" : "regressed_or_flat_below_floor";
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
    nextAction: direction === "no_current_hosted_proof_imported" ? "Rerun or verify the hosted 100-name Apify proof when parser/public-corroboration fixes land." : floorReached ? "Import second-batch audit, false-positive audit, and marketplace truth before paid readiness can unlock." : `Hosted100 remains held; close ${hosted100SellableGap ?? 100} sellable rows and ${hosted100FindingGap ?? 52} finding rows versus the 100/52 floor.`
  };
}
