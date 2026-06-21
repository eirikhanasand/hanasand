import type { HostedApifyObservedProofImport, HostedApifyProofObservation } from "./hostedApifyPaidReadinessTypes.ts";
import { observedProofRequiredFields } from "./hostedApifyPaidReadinessFields.ts";

export function nextOperatorCommand(input: {
  commandExamples: string[];
  hasToken: boolean;
  hasRunOrDatasetId: boolean;
  hasObservedProofImportSource: boolean;
}): string {
  if (input.hasObservedProofImportSource) return "bun run check:hosted-apify-paid-readiness";
  if (input.hasToken && input.hasRunOrDatasetId) return "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=verify TI_APIFY_HOSTED_RUN_ID=<run id> bun run check:hosted-apify-paid-readiness";
  if (input.hasToken) return "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=run bun run check:hosted-apify-paid-readiness";
  return input.commandExamples.find((command) => command.includes("APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=run")) ?? "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=run bun run check:hosted-apify-paid-readiness";
}

export function operatorStillBlockedAfterCommand(input: {
  sampleOnly: boolean;
  unsafeProof: boolean;
  hosted100Pass: boolean;
  hosted300Pass: boolean;
  hosted500Pass: boolean;
  marketplacePromotionPass: boolean;
  marketplaceValuesObserved: boolean;
  missingFields: string[];
  observedFields: Required<HostedApifyProofObservation>;
  hasToken: boolean;
  hasObservedProofImportSource: boolean;
  publicListingStatus: HostedApifyObservedProofImport["publicListingStatus"] | undefined;
}): string[] {
  const blockers: string[] = [];
  if (!input.hasToken && !input.hasObservedProofImportSource) blockers.push("APIFY_TOKEN missing or observed proof JSON/path missing");
  if (input.missingFields.length > 0) blockers.push(`observed proof fields missing: ${input.missingFields.join(", ")}`);
  if (input.sampleOnly) blockers.push("sampleOnly=true cannot unlock hosted or marketplace gates");
  if (input.unsafeProof) blockers.push("no-leak and false-positive inflation failures must be zero");
  if (!input.hosted100Pass) blockers.push(hosted100ThresholdBlocker(input.observedFields));
  if (input.hosted100Pass && !input.hosted300Pass) blockers.push("hosted300 remains held until a production observed proof reaches 300 sellable rows and 150 finding rows");
  if (input.hosted300Pass && !input.hosted500Pass) blockers.push("hosted500 remains held until a production observed proof reaches 500 sellable rows and 275 finding rows");
  if (input.hosted500Pass && !input.marketplaceValuesObserved) blockers.push("marketplace analytics, pricing, payout, paid users, runs, and refunds remain external_unknown/null");
  if (input.hosted500Pass && input.publicListingStatus === "draft_copy_ready_not_promoted") blockers.push("public listing state remains draft_copy_ready_not_promoted");
  if (!input.marketplacePromotionPass) blockers.push("paid marketplace promotion remains blocked");
  return [...new Set(blockers)];
}

export function hasObservedImportValue(proof: HostedApifyObservedProofImport | undefined, field: (typeof observedProofRequiredFields)[number]): boolean {
  if (!proof) return false;
  const value = proof[field];
  if (value === null || value === undefined) return false;
  return typeof value !== "string" || value.trim().length > 0;
}

export function gateHoldReason(sampleOnly: boolean, unsafeProof: boolean, missingFields: string[], fallback: string): string {
  if (sampleOnly) return "sampleOnly=true imports are accepted for shape checks but cannot unlock production gates";
  if (unsafeProof) return "unsafe proof was observed; no-leak and false-positive inflation failures must be zero";
  if (missingFields.length > 0) return `missing required fields: ${missingFields.join(", ")}`;
  return fallback;
}

export function hosted100GateHoldReason(
  sampleOnly: boolean,
  unsafeProof: boolean,
  missingFields: string[],
  observedFields: Required<HostedApifyProofObservation>
): string {
  if (sampleOnly) return "sampleOnly=true imports are accepted for shape checks but cannot unlock production gates";
  if (unsafeProof) return "unsafe proof was observed; no-leak and false-positive inflation failures must be zero";
  const observedSellableRows = observedFields.sellableRows;
  const observedFindingRows = observedFields.sellableFindingCount;
  if (observedSellableRows !== null && observedFindingRows !== null && (observedSellableRows < 100 || observedFindingRows < 52)) {
    return hosted100ThresholdBlocker(observedFields);
  }
  if (missingFields.length > 0) return `missing required fields: ${missingFields.join(", ")}`;
  return "hosted 100-name proof is incomplete";
}

export function hosted100ThresholdBlocker(observedFields: Required<HostedApifyProofObservation>): string {
  const observedSellableRows = observedFields.sellableRows;
  const observedFindingRows = observedFields.sellableFindingCount;
  if (observedSellableRows === null || observedFindingRows === null) {
    return "hosted100 remains held until a production observed proof reaches 100 sellable rows and 52 finding rows";
  }
  const sellableGap = Math.max(0, 100 - observedSellableRows);
  const findingGap = Math.max(0, 52 - observedFindingRows);
  return `hosted100_below_threshold: observed ${observedSellableRows} sellable rows and ${observedFindingRows} finding rows; needs +${sellableGap} sellable rows and +${findingGap} finding rows`;
}

export function marketplacePromotionHoldReason(
  sampleOnly: boolean,
  unsafeProof: boolean,
  hosted500Pass: boolean,
  marketplaceValuesObserved: boolean,
  publicListingStatus: HostedApifyObservedProofImport["publicListingStatus"] | undefined
): string {
  if (sampleOnly) return "sampleOnly=true imports cannot unlock marketplace promotion";
  if (unsafeProof) return "unsafe proof blocks marketplace promotion";
  if (!hosted500Pass) return "hosted500 must pass before marketplace promotion can unlock";
  if (!marketplaceValuesObserved) return "pricing, payout, Store analytics, paid users, runs, and refunds must be observed";
  if (publicListingStatus === "draft_copy_ready_not_promoted") return "listing state is still draft_copy_ready_not_promoted";
  return "marketplace promotion remains held until observed external state is complete";
}

export function readInlineObservedProofFromEnvironment(): HostedApifyObservedProofImport | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const raw = env?.TI_APIFY_OBSERVED_PROOF_JSON;
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isObservedProofImport(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isObservedProofImport(value: unknown): value is HostedApifyObservedProofImport {
  if (!isRecord(value)) return false;
  return value.schemaVersion === "ti.hosted_apify_observed_proof_import.v1"
    && value.proofPreset === "100_name_paid_preset"
    && value.maxRowsPerQuery === 25
    && value.includeCoverageGaps === false
    && value.includeHeldRows === false
    && value.includeDatasets === false
    && typeof value.buildId === "string"
    && typeof value.runStatus === "string"
    && typeof value.failureState === "string"
    && typeof value.pricingModel === "string"
    && typeof value.payoutEnabled === "boolean"
    && typeof value.payoutState === "string"
    && typeof value.analyticsVisible === "boolean"
    && typeof value.conversionRate === "number"
    && typeof value.listingVisibility === "string"
    && typeof value.publicListingStatus === "string"
    && typeof value.observedAt === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
