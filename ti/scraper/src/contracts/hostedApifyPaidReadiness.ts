import type { HostedApifyObservedProofImport, HostedApifyPaidReadinessProof, HostedApifyPaidReadinessStatus, HostedApifyProofImportPath, HostedApifyProofObservation } from "./hostedApifyPaidReadinessTypes.ts";
import { buildConversionPayoutTruth, buildHostedProofDeltaSincePrevious, buildHostedProofOperatorChecklist, buildProgramFgObservedEvidenceBoard, normalizeHostedObservation, readInlineObservedProofFromEnvironment } from "./hostedApifyPaidReadinessSupport.ts";
import { commandExamples, manualVerificationSteps, requiredHostedMetrics } from "./hostedApifyReadinessConstants.ts";
import { hasHostedRun, hasMarketplaceValues, hostedPaidProofExternalBlocker, paidRowIntegrityGate } from "./hostedApifyReadinessGates.ts";
import { hostedProofImportPath, marketplaceConversionInputs } from "./hostedApifyReadinessPaths.ts";

export type { HostedApifyObservedProofImport, HostedApifyPaidReadinessProof, HostedApifyPaidReadinessStatus, HostedApifyProofImportPath, HostedApifyProofObservation, HostedEvidenceImportState, HostedProofOperatorChecklist, HostedProofOperatorGateState } from "./hostedApifyPaidReadinessTypes.ts";

type ProofInput = { hasToken?: boolean; status?: HostedApifyPaidReadinessStatus; hostedImport?: HostedApifyProofObservation; observedProof?: HostedApifyObservedProofImport; readObservedProofFromEnvironment?: boolean };

export function buildHostedApifyPaidReadinessProof(input: ProofInput = {}): HostedApifyPaidReadinessProof {
  const tokenState = input.hasToken === true ? "token_present_manual_verification_required" : "external_token_missing";
  const observedProof = input.observedProof ?? (input.readObservedProofFromEnvironment === false ? undefined : readInlineObservedProofFromEnvironment());
  const observedFields = normalizeHostedObservation(observedProof ?? input.hostedImport);
  const hosted100NameRunObserved = hasHostedRun(observedFields);
  const hosted100NameProofObserved = hosted100NameRunObserved && observedFields.secondBatchAuditObserved === true && observedFields.falsePositiveInflationFailures === 0 && (observedFields.sellableRows ?? 0) >= 100 && (observedFields.sellableFindingCount ?? 0) >= 52;
  const marketplaceValuesObserved = hasMarketplaceValues(observedProof);
  const importedPaidFloorProof = hosted100NameProofObserved && marketplaceValuesObserved;
  const externalBlocker = hostedPaidProofExternalBlocker({ importedPaidFloorProof, tokenState, hosted100NameRunObserved, hosted100NameProofObserved, marketplaceValuesObserved, observedFields });
  const hostedProofOperatorChecklist = buildHostedProofOperatorChecklist({ observedProof, observedFields, commandExamples, marketplaceValuesObserved, hasToken: input.hasToken === true, hasRunOrDatasetId: Boolean(process.env.TI_APIFY_HOSTED_RUN_ID || process.env.TI_APIFY_HOSTED_DATASET_ID), hasObservedProofImportSource: Boolean(process.env.TI_APIFY_OBSERVED_PROOF_JSON || process.env.TI_APIFY_OBSERVED_PROOF_PATH) });
  const conversionPayoutTruth = buildConversionPayoutTruth(observedProof, observedFields, marketplaceValuesObserved, hostedProofOperatorChecklist);
  const programFgObservedEvidenceBoard = buildProgramFgObservedEvidenceBoard({ observedProof, observedFields, checklist: hostedProofOperatorChecklist, marketplaceValuesObserved, commandExamples });
  const hostedProofDeltaSincePrevious = buildHostedProofDeltaSincePrevious(observedFields);
  return {
    schemaVersion: "ti.hosted_apify_paid_readiness_proof.v1",
    status: input.status ?? (importedPaidFloorProof ? "paid_floor_hosted_proof" : tokenState === "external_token_missing" ? "external_token_missing" : hosted100NameRunObserved ? "verified_hold" : "hosted_proof_missing"),
    sourceOfTruth: "Apify hosted Actor run, default dataset, Store analytics, pricing, and billing/payout pages",
    actorId: "eirikhanasand/public-threat-actor-monitor",
    command: "bun run check:hosted-apify-paid-readiness",
    tokenState,
    paidTrafficAllowed: false,
    countsTowardPaidPromotion: false,
    localProof: { source: "local 100-name buyer preset", defaultQueryCount: 100, datasetItemCount: 607, sellableRows: 187, sellableFindingCount: 52, caveatedRows: 420, averageBuyerValueScore: 0.593, proofDecision: "local_paid_floor_pass_hosted_proof_required", countsTowardPaidPromotion: false },
    localCurrent500Gate: { schemaVersion: "ti.hosted_apify_local_current500_gate.v1", source: "local current sellable-row packet", sellableRows: 500, sellableFindingRows: 275, noLeakFailures: 0, falsePositiveInflationFailures: 0, proofDecision: "local_current500_pass_hosted500_proof_required", countsTowardPaidPromotion: false, hostedProofStillRequired: true },
    latestHostedProof: { source: "Apify hosted single-query shape/safety proof", historical: true, runId: "OThlfd0uzSCNnedAO", datasetId: "LSen2fYtwFTtOr7vK", querySetCount: 1, datasetItemCount: 10, sellableRows: 4, sellableFindingCount: null, caveatedRows: 2, averageBuyerValueScore: 0.577, runtimeSeconds: null, memoryMbytes: null, usageUsd: null, costUsd: null, proofDecision: "shape_safety_proof", paidFloorProof: false, countsTowardPaidPromotion: false },
    hostedProofImportPath: hostedProofImportPath(externalBlocker, observedFields, observedProof),
    hostedProofOperatorChecklist,
    requiredHostedPreset: { defaultQueryCount: 100, maxRowsPerQuery: 25, includeCoverageGaps: false, includeHeldRows: false, includeDatasets: false, customQueriesAllowedForPaidProof: false },
    requiredHostedMetrics,
    paidProofAcceptance: { minimumDefaultQueryCount: 100, minimumSellableRows: 100, minimumSellableFindingRows: 52, hostedProofLadder: { hosted100: { minimumSellableRows: 100, minimumSellableFindingRows: 52 }, hosted300: { minimumSellableRows: 300, minimumSellableFindingRows: 150 }, hosted500: { minimumSellableRows: 500, minimumSellableFindingRows: 275 } }, sourceProvenanceRowsCountTowardFindingFloor: false, noLeakFailures: 0, falsePositiveInflationFailures: 0, pricingStateMustBeObserved: true, payoutStateMustBeObserved: true, marketplaceTelemetryMustBeObserved: true },
    paidRowIntegrityGate: paidRowIntegrityGate(),
    marketplaceConversionInputs: marketplaceConversionInputs(marketplaceValuesObserved, observedProof),
    conversionPayoutTruth,
    programFgObservedEvidenceBoard,
    hostedProofDeltaSincePrevious,
    manualVerificationSteps,
    blockers: ["hosted_100_name_apify_run_not_yet_verified", "hosted_100_name_cp_second_batch_audit_not_yet_observed", "external_payout_pricing_analytics_not_yet_verified"]
  };
}
