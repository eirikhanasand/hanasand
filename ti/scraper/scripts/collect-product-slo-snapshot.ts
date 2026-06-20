import {
  appendLiveProductDailySnapshot,
  readLiveProductDailySnapshots,
  type LiveProductDailySnapshot,
  type LiveProductProofMode,
  type LiveProductSloDashboard
} from "../src/ops/productSlo.ts";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const DEFAULT_BASE_URL = "http://127.0.0.1:8097";
const DEFAULT_SNAPSHOT_PATH = "var/ops/live-product-slo/daily.jsonl";

const proofMode = proofModeFromEnv(process.env.TI_PRODUCT_SLO_PROOF_MODE ?? process.env.PROOF_MODE ?? "local");
const baseUrl = process.env.TI_PRODUCT_SLO_BASE_URL ?? DEFAULT_BASE_URL;
const snapshotPath = process.env.TI_PRODUCT_SLO_SNAPSHOT_PATH ?? DEFAULT_SNAPSHOT_PATH;
const generatedAt = process.env.TI_PRODUCT_SLO_GENERATED_AT ?? new Date().toISOString();
const endpoint = buildEndpoint(baseUrl, proofMode, generatedAt, snapshotPath);

const started = performance.now();
let response: { ok: boolean; status: number; bodyText: string };
try {
  response = await requestText(endpoint);
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    command: "bun run snapshot:product-slo",
    endpoint: endpoint.href,
    latencyMs: round(performance.now() - started),
    error: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exit(1);
}
const latencyMs = round(performance.now() - started);

if (!response.ok) {
  console.log(JSON.stringify({
    ok: false,
    command: "bun run snapshot:product-slo",
    endpoint: endpoint.href,
    status: response.status,
    latencyMs,
    error: response.bodyText.slice(0, 500)
  }, null, 2));
  process.exit(1);
}

const dashboard = parseDashboard(response.bodyText);
const snapshot: LiveProductDailySnapshot = {
  ...dashboard.dailySnapshot,
  storagePath: snapshotPath
};

await appendLiveProductDailySnapshot(snapshotPath, snapshot);
const snapshots = await readLiveProductDailySnapshots(snapshotPath);

console.log(JSON.stringify({
  ok: true,
  command: "bun run snapshot:product-slo",
  expectedOutput: "ok=true; product SLO route fetched and daily snapshot appended exactly once for this invocation",
  endpoint: endpoint.href,
  status: response.status,
  latencyMs,
  proofMode: dashboard.proofMode,
  dashboardState: dashboard.dashboard.state,
  snapshotPath,
  snapshotId: snapshot.snapshotId,
  snapshotDate: snapshot.snapshotDate,
  appendedSnapshotCount: snapshots.length,
  metrics: snapshot.metrics,
  monetizationReadiness: snapshot.monetizationReadiness,
  marketplaceTelemetry: dashboard.apifyLaunchExperiment.marketplaceTelemetry,
  marketplaceConversion: {
    storeViewToRunRate: dashboard.apifyLaunchExperiment.storeViewToRunRate,
    storeViewToUserRate: dashboard.apifyLaunchExperiment.storeViewToUserRate,
    runsPerUser: dashboard.apifyLaunchExperiment.runsPerUser,
    trialToPaidRate: dashboard.apifyLaunchExperiment.trialToPaidRate
  },
  payoutReadiness: dashboard.apifyLaunchExperiment.payoutReadiness,
  pricingProof: {
    usageCostGuard: dashboard.apifyLaunchExperiment.pricingProof.usageCostGuard,
    payoutRevenueSeparation: dashboard.apifyLaunchExperiment.pricingProof.payoutRevenueSeparation
  },
  nextRevenueAction: dashboard.apifyLaunchExperiment.nextRevenueAction,
  fakeTractionGuards: dashboard.apifyLaunchExperiment.fakeTractionGuards,
  apifyUnknowns: dashboard.apifyLaunchExperiment.unknowns,
  paidProductEconomics: dashboard.paidProductEconomics,
  sourceMonetizationGate: dashboard.sourceMonetizationGate,
  nonMonetizingWorkDetector: snapshot.nonMonetizingWorkDetector,
  scaleStepGates: snapshot.scaleStepGates,
  revenueBlockerBoard: dashboard.revenueBlockerBoard,
  deploymentProof: dashboard.deploymentProof,
  resourceGuardrails: dashboard.resourceGuardrails
}, null, 2));

function buildEndpoint(baseUrl: string, proofMode: LiveProductProofMode, generatedAt: string, snapshotPath: string): URL {
  const url = new URL("/v1/ops/product-slo", normalizeBaseUrl(baseUrl));
  url.searchParams.set("proofMode", proofMode);
  url.searchParams.set("generatedAt", generatedAt);
  url.searchParams.set("snapshotStoragePath", snapshotPath);

  copyEnvParam(url, "actorId", "TI_PRODUCT_SLO_ACTOR_ID");
  copyEnvParam(url, "actorVersion", "TI_PRODUCT_SLO_ACTOR_VERSION");
  copyEnvParam(url, "actorBuildId", "TI_PRODUCT_SLO_ACTOR_BUILD_ID");
  copyEnvParam(url, "actorImageId", "TI_PRODUCT_SLO_ACTOR_IMAGE_ID");
  copyEnvParam(url, "actorRunId", "TI_PRODUCT_SLO_ACTOR_RUN_ID");
  copyEnvParam(url, "actorDatasetId", "TI_PRODUCT_SLO_ACTOR_DATASET_ID");
  copyEnvParam(url, "actorStatus", "TI_PRODUCT_SLO_ACTOR_STATUS");
  copyEnvParam(url, "actorQueryCount", "TI_PRODUCT_SLO_ACTOR_QUERY_COUNT");
  copyEnvParam(url, "actorRowCount", "TI_PRODUCT_SLO_ACTOR_ROW_COUNT");
  copyEnvParam(url, "actorUsefulRowCount", "TI_PRODUCT_SLO_ACTOR_USEFUL_ROW_COUNT");
  copyEnvParam(url, "actorFreshRowCount", "TI_PRODUCT_SLO_ACTOR_FRESH_ROW_COUNT");
  copyEnvParam(url, "actorStaleRowCount", "TI_PRODUCT_SLO_ACTOR_STALE_ROW_COUNT");
  copyEnvParam(url, "actorActivityClaimRows", "TI_PRODUCT_SLO_ACTOR_ACTIVITY_CLAIM_ROWS");
  copyEnvParam(url, "actorSellableRows", "TI_PRODUCT_SLO_ACTOR_SELLABLE_ROWS");
  copyEnvParam(url, "actorIncludedWithCaveatRows", "TI_PRODUCT_SLO_ACTOR_INCLUDED_WITH_CAVEAT_ROWS");
  copyEnvParam(url, "actorCoverageGapOnlyRows", "TI_PRODUCT_SLO_ACTOR_COVERAGE_GAP_ONLY_ROWS");
  copyEnvParam(url, "actorHoldRows", "TI_PRODUCT_SLO_ACTOR_HOLD_ROWS");
  copyEnvParam(url, "actorSuppressRows", "TI_PRODUCT_SLO_ACTOR_SUPPRESS_ROWS");
  copyEnvParam(url, "actorTargetSellableRows", "TI_PRODUCT_SLO_ACTOR_TARGET_SELLABLE_ROWS");
  copyEnvParam(url, "actorAverageBuyerValueScore", "TI_PRODUCT_SLO_ACTOR_AVERAGE_BUYER_VALUE_SCORE");
  copyEnvParam(url, "actorDefaultWatchlistRun", "TI_PRODUCT_SLO_ACTOR_DEFAULT_WATCHLIST_RUN");
  copyEnvParam(url, "grossPpeRevenueUsd", "TI_PRODUCT_SLO_GROSS_PPE_REVENUE_USD");
  copyEnvParam(url, "apifyCommissionUsd", "TI_PRODUCT_SLO_APIFY_COMMISSION_USD");
  copyEnvParam(url, "computeCostUsd", "TI_PRODUCT_SLO_COMPUTE_COST_USD");
  copyEnvParam(url, "backendCostAllocationUsd", "TI_PRODUCT_SLO_BACKEND_COST_ALLOCATION_USD");
  copyEnvParam(url, "refundsFailuresUsd", "TI_PRODUCT_SLO_REFUNDS_FAILURES_USD");
  copyEnvParam(url, "actorStartCostUsd", "TI_PRODUCT_SLO_ACTOR_START_COST_USD");
  copyEnvParam(url, "resultPriceUsdPerThousand", "TI_PRODUCT_SLO_RESULT_PRICE_USD_PER_THOUSAND");
  copyEnvParam(url, "actorStartPriceUsd", "TI_PRODUCT_SLO_ACTOR_START_PRICE_USD");
  copyEnvParam(url, "apifyMarginRate", "TI_PRODUCT_SLO_APIFY_MARGIN_RATE");
  copyEnvParam(url, "apifyActorViewCount", "TI_PRODUCT_SLO_APIFY_ACTOR_VIEW_COUNT");
  copyEnvParam(url, "apifyActorRunCount", "TI_PRODUCT_SLO_APIFY_ACTOR_RUN_COUNT");
  copyEnvParam(url, "apifyUniqueUserCount", "TI_PRODUCT_SLO_APIFY_UNIQUE_USER_COUNT");
  copyEnvParam(url, "apifyTrialRunCount", "TI_PRODUCT_SLO_APIFY_TRIAL_RUN_COUNT");
  copyEnvParam(url, "apifyPaidRunCount", "TI_PRODUCT_SLO_APIFY_PAID_RUN_COUNT");
  copyEnvParam(url, "apifyActorStartCount", "TI_PRODUCT_SLO_APIFY_ACTOR_START_COUNT");
  copyEnvParam(url, "apifyDatasetRowCount", "TI_PRODUCT_SLO_APIFY_DATASET_ROW_COUNT");
  copyEnvParam(url, "apifyFailedRunCount", "TI_PRODUCT_SLO_APIFY_FAILED_RUN_COUNT");
  copyEnvParam(url, "apifyRepeatUserCount", "TI_PRODUCT_SLO_APIFY_REPEAT_USER_COUNT");
  copyEnvParam(url, "apifyRefundCount", "TI_PRODUCT_SLO_APIFY_REFUND_COUNT");
  copyEnvParam(url, "apifyPlatformUsageCostUsd", "TI_PRODUCT_SLO_APIFY_PLATFORM_USAGE_COST_USD");
  copyEnvParam(url, "apifyEstimatedCreatorRevenueUsd", "TI_PRODUCT_SLO_APIFY_ESTIMATED_CREATOR_REVENUE_USD");
  copyEnvParam(url, "apifyBeneficiaryVerified", "TI_PRODUCT_SLO_APIFY_BENEFICIARY_VERIFIED");
  copyEnvParam(url, "apifyPayoutMethodReady", "TI_PRODUCT_SLO_APIFY_PAYOUT_METHOD_READY");
  copyEnvParam(url, "apifyWithdrawalReady", "TI_PRODUCT_SLO_APIFY_WITHDRAWAL_READY");
  copyEnvParam(url, "apifyPricingEffectiveAt", "TI_PRODUCT_SLO_APIFY_PRICING_EFFECTIVE_AT");
  copyEnvParam(url, "sourceEvaluatedCandidateCount", "TI_PRODUCT_SLO_SOURCE_EVALUATED_CANDIDATE_COUNT");
  copyEnvParam(url, "sourcePayworthyCount", "TI_PRODUCT_SLO_SOURCE_PAYWORTHY_COUNT");
  copyEnvParam(url, "sourcePayworthyThresholdRate", "TI_PRODUCT_SLO_SOURCE_PAYWORTHY_THRESHOLD_RATE");
  copyEnvParam(url, "sourceValueScoreThreshold", "TI_PRODUCT_SLO_SOURCE_VALUE_SCORE_THRESHOLD");
  copyEnvParam(url, "sourceFreshnessThreshold", "TI_PRODUCT_SLO_SOURCE_FRESHNESS_THRESHOLD");
  copyEnvParam(url, "sourceEvidenceYieldThreshold", "TI_PRODUCT_SLO_SOURCE_EVIDENCE_YIELD_THRESHOLD");
  copyEnvParam(url, "sourceDownstreamImpactThreshold", "TI_PRODUCT_SLO_SOURCE_DOWNSTREAM_IMPACT_THRESHOLD");
  copyEnvParam(url, "sourceCostPerUsefulRowImpactUsd", "TI_PRODUCT_SLO_SOURCE_COST_PER_USEFUL_ROW_IMPACT_USD");
  copyEnvParam(url, "sourceCurrentProofRunId", "TI_PRODUCT_SLO_SOURCE_CURRENT_PROOF_RUN_ID");
  copyEnvParam(url, "sourceCurrentProofDatasetId", "TI_PRODUCT_SLO_SOURCE_CURRENT_PROOF_DATASET_ID");
  copyEnvParam(url, "sourceBaselineProofRunId", "TI_PRODUCT_SLO_SOURCE_BASELINE_PROOF_RUN_ID");
  copyEnvParam(url, "sourceBaselineProofDatasetId", "TI_PRODUCT_SLO_SOURCE_BASELINE_PROOF_DATASET_ID");
  copyEnvParam(url, "diskGrowthGbPerDay", "TI_PRODUCT_SLO_DISK_GROWTH_GB_PER_DAY");
  copyEnvParam(url, "diskFreeGb", "TI_PRODUCT_SLO_DISK_FREE_GB");
  copyEnvParam(url, "diskUsedGb", "TI_PRODUCT_SLO_DISK_USED_GB");

  return url;
}

function copyEnvParam(url: URL, param: string, envKey: string): void {
  const value = process.env[envKey]?.trim();
  if (value) url.searchParams.set(param, value);
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

async function requestText(url: URL): Promise<{ ok: boolean; status: number; bodyText: string }> {
  const errors: string[] = [];
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await requestTextWithNodeHttp(url);
    } catch (error) {
      errors.push(`node-http attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      return await requestTextWithCurl(url);
    } catch (error) {
      errors.push(`curl attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await Bun.sleep(250 * attempt);
  }
  throw new Error(errors.join("; "));
}

async function requestTextWithNodeHttp(url: URL): Promise<{ ok: boolean; status: number; bodyText: string }> {
  return await new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      method: "GET",
      headers: { accept: "application/json" }
    }, (response) => {
      const chunks: Uint8Array[] = [];
      response.on("data", (chunk: Uint8Array | string) => {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      });
      response.on("end", () => {
        const status = response.statusCode ?? 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          bodyText: Buffer.concat(chunks).toString("utf8")
        });
      });
    });
    request.setTimeout(10_000, () => {
      request.destroy(new Error("Timed out fetching product SLO endpoint"));
    });
    request.on("error", reject);
    request.end();
  });
}

async function requestTextWithCurl(url: URL): Promise<{ ok: boolean; status: number; bodyText: string }> {
  const process = Bun.spawn(["curl", "-sS", "-w", "\n%{http_code}", url.href], {
    stdout: "pipe",
    stderr: "pipe"
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited
  ]);
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `curl exited with ${exitCode}`);
  }
  const marker = stdout.lastIndexOf("\n");
  if (marker === -1) {
    throw new Error("curl response did not include HTTP status");
  }
  const bodyText = stdout.slice(0, marker);
  const status = Number(stdout.slice(marker + 1));
  if (!Number.isFinite(status)) {
    throw new Error(`curl response included invalid HTTP status: ${stdout.slice(marker + 1)}`);
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    bodyText
  };
}

function parseDashboard(bodyText: string): LiveProductSloDashboard {
  let value: unknown;
  try {
    value = JSON.parse(bodyText);
  } catch (error) {
    throw new Error(`Product SLO response was not JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isDashboard(value)) {
    throw new Error("Product SLO response did not match ti.live_product_slo_dashboard.v1");
  }
  return value;
}

function isDashboard(value: unknown): value is LiveProductSloDashboard {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const snapshot = record.dailySnapshot as Record<string, unknown> | undefined;
  const sourceMonetizationGate = record.sourceMonetizationGate as Record<string, unknown> | undefined;
  const nonMonetizingWorkDetector = record.nonMonetizingWorkDetector as Record<string, unknown> | undefined;
  const scaleStepGates = record.scaleStepGates as Record<string, unknown> | undefined;
  const revenueBlockerBoard = record.revenueBlockerBoard as Record<string, unknown> | undefined;
  const monetizationReadiness = record.apifyLaunchExperiment && typeof record.apifyLaunchExperiment === "object"
    ? (record.apifyLaunchExperiment as Record<string, unknown>).monetizationReadiness as Record<string, unknown> | undefined
    : undefined;
  return record.schemaVersion === "ti.live_product_slo_dashboard.v1"
    && record.route === "/v1/ops/product-slo"
    && Boolean(snapshot)
    && typeof snapshot?.snapshotId === "string"
    && snapshot?.appendOnly === true
    && sourceMonetizationGate?.schemaVersion === "ti.live_product_source_monetization_gate.v1"
    && nonMonetizingWorkDetector?.schemaVersion === "ti.non_monetizing_work_detector.v1"
    && scaleStepGates?.schemaVersion === "ti.product_scale_step_gates.v1"
    && revenueBlockerBoard?.schemaVersion === "ti.revenue_blocker_board.v1"
    && monetizationReadiness?.schemaVersion === "ti.live_product_monetization_readiness.v1";
}

function proofModeFromEnv(value: string): LiveProductProofMode {
  if (value === "fixture" || value === "local" || value === "inspur" || value === "public_live") return value;
  throw new Error(`Invalid TI_PRODUCT_SLO_PROOF_MODE: ${value}`);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
