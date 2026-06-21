export type HostedApifyPaidReadinessStatus =
  | "external_token_missing"
  | "hosted_proof_missing"
  | "verified_hold"
  | "paid_floor_hosted_proof";

export interface HostedApifyProofObservation {
  runId?: string | null;
  buildId?: string | null;
  runStatus?: "succeeded" | "failed" | "timed_out" | "aborted" | "external_unknown" | null;
  failureState?: "none" | "failed" | "timed_out" | "aborted" | "external_unknown" | null;
  datasetId?: string | null;
  datasetItemCount?: number | null;
  sellableRows?: number | null;
  sellableFindingCount?: number | null;
  caveatedRows?: number | null;
  averageBuyerValueScore?: number | null;
  runtimeSeconds?: number | null;
  memoryMbytes?: number | null;
  usageUsd?: number | null;
  costUsd?: number | null;
  chargedEventCount?: number | null;
  chargedDatasetItemEvents?: number | null;
  chargedActorStartEvents?: number | null;
  noLeakFailures?: number | null;
  secondBatchAuditObserved?: boolean;
  falsePositiveInflationFailures?: number | null;
  lastVerifiedAt?: string | null;
}

export type HostedApifyObservedProofImport = HostedApifyProofObservation & Record<string, any>;
export type HostedApifyProofImportPath = Record<string, any>;
export type HostedProofOperatorChecklist = Record<string, any>;
export type HostedProofOperatorGateState = "pass" | "hold" | "blocked_sample" | "blocked_unsafe";
export type HostedEvidenceImportState =
  | "no_proof_imported"
  | "proof_imported_but_insufficient"
  | "proof_sufficient_for_private_beta"
  | "proof_sufficient_for_public_traffic";
export type HostedApifyPaidReadinessProof = Record<string, any>;
