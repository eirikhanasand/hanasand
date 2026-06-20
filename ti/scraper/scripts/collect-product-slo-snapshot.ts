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
  apifyUnknowns: dashboard.apifyLaunchExperiment.unknowns,
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
  copyEnvParam(url, "actorActivityClaimRows", "TI_PRODUCT_SLO_ACTOR_ACTIVITY_CLAIM_ROWS");
  copyEnvParam(url, "grossPpeRevenueUsd", "TI_PRODUCT_SLO_GROSS_PPE_REVENUE_USD");
  copyEnvParam(url, "apifyCommissionUsd", "TI_PRODUCT_SLO_APIFY_COMMISSION_USD");
  copyEnvParam(url, "computeCostUsd", "TI_PRODUCT_SLO_COMPUTE_COST_USD");
  copyEnvParam(url, "backendCostAllocationUsd", "TI_PRODUCT_SLO_BACKEND_COST_ALLOCATION_USD");
  copyEnvParam(url, "refundsFailuresUsd", "TI_PRODUCT_SLO_REFUNDS_FAILURES_USD");
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
  return record.schemaVersion === "ti.live_product_slo_dashboard.v1"
    && record.route === "/v1/ops/product-slo"
    && Boolean(snapshot)
    && typeof snapshot?.snapshotId === "string"
    && snapshot?.appendOnly === true;
}

function proofModeFromEnv(value: string): LiveProductProofMode {
  if (value === "fixture" || value === "local" || value === "inspur" || value === "public_live") return value;
  throw new Error(`Invalid TI_PRODUCT_SLO_PROOF_MODE: ${value}`);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
