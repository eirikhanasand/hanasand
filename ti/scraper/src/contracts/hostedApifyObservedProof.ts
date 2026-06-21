import type { HostedApifyObservedProofImport } from "./hostedApifyPaidReadinessTypes.ts";

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

export function isObservedProofImport(value: unknown): value is HostedApifyObservedProofImport {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
