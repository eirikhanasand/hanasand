export const observedProofIdentityFields = [
  "schemaVersion",
  "runId",
  "buildId",
  "runStatus",
  "failureState",
  "datasetId",
  "proofPreset",
  "defaultQueryCount",
  "maxRowsPerQuery",
  "includeCoverageGaps",
  "includeHeldRows",
  "includeDatasets"
] as const;

export const observedProofDatasetFields = [
  "datasetItemCount",
  "sellableRows",
  "sellableFindingCount",
  "caveatedRows",
  "averageBuyerValueScore"
] as const;

export const observedProofRuntimeFields = [
  "runtimeSeconds",
  "memoryMbytes",
  "usageUsd",
  "costUsd",
  "chargedEventCount",
  "chargedDatasetItemEvents",
  "chargedActorStartEvents"
] as const;

export const observedProofSafetyFields = [
  "noLeakFailures",
  "secondBatchAuditObserved",
  "falsePositiveInflationFailures"
] as const;
