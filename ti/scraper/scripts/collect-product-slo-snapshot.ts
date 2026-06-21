import {
  appendLiveProductDailySnapshot,
  readLiveProductDailySnapshots,
  type LiveProductDailySnapshot
} from "../src/ops/productSlo.ts";
import { buildEndpoint, proofModeFromEnv } from "./product-slo-snapshot/endpoint.ts";
import { parseDashboard } from "./product-slo-snapshot/parse.ts";
import { requestText } from "./product-slo-snapshot/request.ts";

const proofMode = proofModeFromEnv(process.env.TI_PRODUCT_SLO_PROOF_MODE ?? process.env.PROOF_MODE ?? "local");
const baseUrl = process.env.TI_PRODUCT_SLO_BASE_URL ?? "http://127.0.0.1:8097";
const snapshotPath = process.env.TI_PRODUCT_SLO_SNAPSHOT_PATH ?? "var/ops/live-product-slo/daily.jsonl";
const generatedAt = process.env.TI_PRODUCT_SLO_GENERATED_AT ?? new Date().toISOString();
const endpoint = buildEndpoint(baseUrl, proofMode, generatedAt, snapshotPath);
const started = performance.now();

let response: { ok: boolean; status: number; bodyText: string };
try {
  response = await requestText(endpoint);
} catch (error) {
  fail({ endpoint: endpoint.href, latencyMs: round(performance.now() - started), error });
}

const latencyMs = round(performance.now() - started);
if (!response.ok) {
  fail({ endpoint: endpoint.href, status: response.status, latencyMs, error: response.bodyText.slice(0, 500) });
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
  marketplaceConversion: conversion(dashboard),
  payoutReadiness: dashboard.apifyLaunchExperiment.payoutReadiness,
  pricingProof: pricing(dashboard),
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

function conversion(dashboard: ReturnType<typeof parseDashboard>) {
  const experiment = dashboard.apifyLaunchExperiment;
  return {
    storeViewToRunRate: experiment.storeViewToRunRate,
    storeViewToUserRate: experiment.storeViewToUserRate,
    runsPerUser: experiment.runsPerUser,
    trialToPaidRate: experiment.trialToPaidRate
  };
}

function pricing(dashboard: ReturnType<typeof parseDashboard>) {
  return {
    usageCostGuard: dashboard.apifyLaunchExperiment.pricingProof.usageCostGuard,
    payoutRevenueSeparation: dashboard.apifyLaunchExperiment.pricingProof.payoutRevenueSeparation
  };
}

function fail(payload: { endpoint: string; status?: number; latencyMs: number; error: unknown }): never {
  console.log(JSON.stringify({
    ok: false,
    command: "bun run snapshot:product-slo",
    ...payload,
    error: payload.error instanceof Error ? payload.error.message : String(payload.error)
  }, null, 2));
  process.exit(1);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
