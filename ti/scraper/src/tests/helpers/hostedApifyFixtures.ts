import type { HostedApifyObservedProofImport } from "../../contracts/hostedApifyPaidReadiness.ts";

const envKeys = ["APIFY_TOKEN", "TI_APIFY_HOSTED_RUN_ID", "TI_APIFY_HOSTED_DATASET_ID", "TI_APIFY_OBSERVED_PROOF_JSON", "TI_APIFY_OBSERVED_PROOF_PATH"] as const;

export function withHostedProofEnv<T>(env: Partial<Record<(typeof envKeys)[number], string>>, run: () => T): T {
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Partial<Record<(typeof envKeys)[number], string>>;
  for (const key of envKeys) env[key] === undefined ? delete process.env[key] : process.env[key] = env[key];
  try {
    return run();
  } finally {
    for (const key of envKeys) previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key];
  }
}

export function observedProof(overrides: Partial<HostedApifyObservedProofImport> = {}): HostedApifyObservedProofImport {
  return {
    schemaVersion: "ti.hosted_apify_observed_proof_import.v1",
    runId: "run_observed_001",
    buildId: "build_observed_001",
    runStatus: "succeeded",
    failureState: "none",
    datasetId: "dataset_observed_001",
    proofPreset: "100_name_paid_preset",
    defaultQueryCount: 100,
    maxRowsPerQuery: 25,
    includeCoverageGaps: false,
    includeHeldRows: false,
    includeDatasets: false,
    datasetItemCount: 607,
    sellableRows: 500,
    sellableFindingCount: 275,
    caveatedRows: 107,
    averageBuyerValueScore: 0.593,
    runtimeSeconds: 900,
    memoryMbytes: 1024,
    usageUsd: 0.25,
    costUsd: 0.25,
    chargedEventCount: 608,
    chargedDatasetItemEvents: 607,
    chargedActorStartEvents: 1,
    noLeakFailures: 0,
    secondBatchAuditObserved: true,
    falsePositiveInflationFailures: 0,
    storeViews: 12,
    runs: 4,
    uniqueUsers: 3,
    paidUsers: 1,
    refunds: 0,
    pricingModel: "pay_per_event_rows",
    payoutEnabled: true,
    payoutState: "enabled",
    analyticsVisible: true,
    conversionRate: 0.333,
    listingVisibility: "public",
    publicListingStatus: "public_listed_not_promoted",
    observedAt: "2026-06-21T00:00:00.000Z",
    ...overrides
  };
}
