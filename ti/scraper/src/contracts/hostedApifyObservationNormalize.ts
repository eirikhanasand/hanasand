import type { HostedApifyProofObservation } from "./hostedApifyPaidReadinessTypes.ts";
import { isRecord } from "./hostedApifyObservedProof.ts";

export function normalizeHostedObservation(input: HostedApifyProofObservation | undefined): Required<HostedApifyProofObservation> {
  const inputRecord = isRecord(input) ? input : {};
  return {
    runId: input?.runId ?? null,
    buildId: input?.buildId ?? null,
    runStatus: input?.runStatus ?? null,
    failureState: input?.failureState ?? null,
    datasetId: input?.datasetId ?? null,
    datasetItemCount: finiteNumberOrNull(input?.datasetItemCount),
    sellableRows: finiteNumberOrNull(input?.sellableRows),
    sellableFindingCount: finiteNumberOrNull(input?.sellableFindingCount),
    caveatedRows: finiteNumberOrNull(input?.caveatedRows),
    averageBuyerValueScore: finiteNumberOrNull(input?.averageBuyerValueScore),
    runtimeSeconds: finiteNumberOrNull(input?.runtimeSeconds),
    memoryMbytes: finiteNumberOrNull(input?.memoryMbytes),
    usageUsd: finiteNumberOrNull(input?.usageUsd),
    costUsd: finiteNumberOrNull(input?.costUsd),
    chargedEventCount: finiteNumberOrNull(input?.chargedEventCount),
    chargedDatasetItemEvents: finiteNumberOrNull(input?.chargedDatasetItemEvents),
    chargedActorStartEvents: finiteNumberOrNull(input?.chargedActorStartEvents),
    noLeakFailures: finiteNumberOrNull(input?.noLeakFailures),
    secondBatchAuditObserved: input?.secondBatchAuditObserved === true,
    falsePositiveInflationFailures: finiteNumberOrNull(input?.falsePositiveInflationFailures),
    lastVerifiedAt: input?.lastVerifiedAt ?? (typeof inputRecord.observedAt === "string" ? inputRecord.observedAt : null)
  };
}

function finiteNumberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
