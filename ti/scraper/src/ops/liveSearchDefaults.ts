// @ts-nocheck
export const DEFAULT_LIVE_SEARCH_SLO = {
  initialResponseMs: 1_500,
  partialResultMs: 5_000,
  recommendedPollIntervalMs: 2_000,
  maxPollIntervalMs: 15_000,
  maxActiveRunsPerTenantQuery: 2,
  providerFailureBudgetPercent: 5,
  zeroResultBudgetPercent: 15
};

export const DEFAULT_LIVE_SEARCH_SOAK_CRITERIA = {
  durationHours: 24,
  initialLatencyP95Ms: 2_000,
  partialLatencyP95Ms: 8_000,
  maxErrorRatePercent: 2,
  maxDuplicateActiveRuns: 1,
  minSourceCoveragePercent: 80,
  maxQueueAgeP95Seconds: 60,
  maxMemoryRssGb: 64,
  allowFallbackUse: true
};

export const CUTOVER_MOUNTED_ROUTE_PROOF_REQUIREMENTS = [
  { name: "public_ti_search", route: "https://hanasand.com/ti" },
  { name: "api_ti_search", route: "https://api.hanasand.com/api/ti/search" },
  { name: "scraper_health", route: "/v1/health" }
];
