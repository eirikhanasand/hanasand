import type { RemediationOwner } from "./commonActorTypes.ts";
import type { QualityLiftExample } from "./qualityLiftExample.ts";

export interface QualityLiftGate {
  schemaVersion: "ti.apify_paid_row_quality_lift_gate.v1";
  baselineRunId: "iMQGeezZ8bx7WtlhQ";
  baselineDatasetId: "5PLmkE30luBA5Lbgc";
  evaluatedRunShape: "apt42_smoke_and_20_group_daily";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  qualityLiftAcceptedCount: number;
  qualityLiftRejectedCount: number;
  sellableRowsAdded: number;
  freshRowsAdded: number;
  usefulRowsAdded: number;
  staleRowsSuppressed: number;
  costPerUsefulRowDelta: number;
  projectedRowRevenueDeltaUsd: number;
  acceptedExamples: QualityLiftExample[];
  rejectedExamples: QualityLiftExample[];
  ownerHandoffs: Array<{
    owner: RemediationOwner;
    accepted: number;
    rejected: number;
    nextActions: string[];
  }>;
  passCriteria: {
    acceptedRequiresDecisionLift: true;
    acceptedRequiresBuyerVisibleMetricLift: true;
    acceptedRequiresSafePublicOrMetadataOnlySource: true;
    rejectedRepairsDoNotCountTowardPayworthyRate: true;
  };
}
