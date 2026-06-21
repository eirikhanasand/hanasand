import type { HostedApifyObservedProofImport, HostedApifyProofObservation } from "./hostedApifyPaidReadinessTypes.ts";
import { observedProofRequiredFields } from "./hostedApifyPaidReadinessFields.ts";
export { gateHoldReason, hosted100GateHoldReason, hosted100ThresholdBlocker, marketplacePromotionHoldReason } from "./hostedApifyGateReasons.ts";
export { isObservedProofImport, isRecord, readInlineObservedProofFromEnvironment } from "./hostedApifyObservedProof.ts";
export { normalizeHostedObservation } from "./hostedApifyObservationNormalize.ts";
import { hosted100ThresholdBlocker } from "./hostedApifyGateReasons.ts";

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
