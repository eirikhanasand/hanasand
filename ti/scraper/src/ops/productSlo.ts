import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CollectionRun, IncidentCandidate, RawCapture, SourceRecord } from "../types.ts";
import type { FrontierGroupSummary } from "../frontier/frontier.ts";
import { nowIso, stableId } from "../utils.ts";

export type LiveProductProofMode = "fixture" | "local" | "inspur" | "public_live";
export type LiveProductSloState = "pass" | "warn" | "alert" | "unavailable";
export interface LiveProductQueryMeasurement { query: string; proofMode: LiveProductProofMode; firstResponseMs?: number | null; firstFreshEvidenceMs?: number | null; pollIntervalMs?: number | null; status?: string; rowCount?: number | null; usefulRowCount?: number | null; freshRowCount?: number | null; activityClaimCount?: number | null; duplicateArticleRate?: number | null; sourceProviderFailures?: number | null; staleRejected?: boolean | null; emptyResultHonest?: boolean | null; apiError?: boolean | null; }
export interface LiveProductActorRunMeasurement { actorId?: string; actorVersion?: string; buildId?: string; imageId?: string; runId?: string; datasetId?: string; startedAt?: string; finishedAt?: string; status?: string; queryCount?: number | null; rowCount?: number | null; usefulRowCount?: number | null; freshRowCount?: number | null; staleRowCount?: number | null; activityClaimRowCount?: number | null; sellableRowCount?: number | null; includedWithCaveatRowCount?: number | null; coverageGapOnlyRowCount?: number | null; holdRowCount?: number | null; suppressRowCount?: number | null; targetSellableRows?: number | null; averageBuyerValueScore?: number | null; defaultWatchlistRun?: boolean | null; }
export interface BuildLiveProductSloDashboardInput { generatedAt?: string; proofMode?: LiveProductProofMode; runs: CollectionRun[]; sources: SourceRecord[]; captures: RawCapture[]; incidents: IncidentCandidate[]; frontier: FrontierGroupSummary; queryMeasurements?: LiveProductQueryMeasurement[]; actorRun?: LiveProductActorRunMeasurement; cost?: Record<string, number | null>; sourceMonetization?: Record<string, number | string | null>; resource?: Record<string, number | null | undefined>; snapshotStoragePath?: string; }
export type LiveProductDailySnapshot = any;
export type LiveProductSloDashboard = any;

export function buildLiveProductSloDashboard(input: BuildLiveProductSloDashboardInput): LiveProductSloDashboard {
  const generatedAt = input.generatedAt ?? nowIso();
  const rows = value(input.actorRun?.rowCount) ?? sum(input.queryMeasurements?.map((item) => item.rowCount));
  const useful = value(input.actorRun?.usefulRowCount) ?? sum(input.queryMeasurements?.map((item) => item.usefulRowCount));
  const fresh = value(input.actorRun?.freshRowCount) ?? sum(input.queryMeasurements?.map((item) => item.freshRowCount));
  const sellable = value(input.actorRun?.sellableRowCount) ?? Math.min(useful ?? 0, rows ?? 0);
  const target = value(input.actorRun?.targetSellableRows) ?? 10000;
  const usefulRate = rate(useful, rows);
  const freshRate = rate(fresh, rows);
  const sourceGate = sourceMonetizationGate(input.sourceMonetization);
  const monetizationReadiness = { minimumProductionSellableRows: target, sellableRows: sellable, usefulForBuyerRows: useful, freshRows: fresh, usefulRowRate: usefulRate, freshRowRate: freshRate, averageBuyerValueScore: value(input.actorRun?.averageBuyerValueScore), status: sellable >= target ? "ready_for_paid_traffic" : "needs_more_sellable_rows", remainingRowsToFloor: Math.max(0, target - sellable) };
  const paidProductEconomics = economics(input.cost, useful);
  const dashboard = { state: sellable >= target ? "pass" : "warn", generatedAt, rows, useful, fresh, sellable };
  const productLaunch = { monetizationReadiness, pricing: pricing(input.cost), nextRevenueAction: sellable >= target ? "paid_traffic" : "add_sellable_rows", fakeTractionGuards: ["do not count owner traffic as paid demand", "unknown analytics means no traction claim"], revenueConversionChecklist: { paidTrafficState: sellable >= target ? "ready" : "blocked" } };
  const dailySnapshot = { snapshotId: stableId("product-slo", generatedAt), snapshotDate: generatedAt.slice(0, 10), generatedAt, appendOnly: true, proofMode: input.proofMode ?? "local", storagePath: input.snapshotStoragePath, metrics: { rows, useful, fresh, sellable, usefulRate, freshRate }, monetizationReadiness, sourceMonetizationGate: sourceGate, scaleStepGates: scaleGates(sellable, usefulRate, freshRate), nonMonetizingWorkDetector: { allowedWork: ["add real rows", "improve parser extraction", "increase source value"], blockedWork: ["governance-only", "proof-only", "schema-only"] } };
  return { schemaVersion: "ti.live_product_slo.compact.v3", generatedAt, proofMode: input.proofMode ?? "local", dashboard, metrics: dailySnapshot.metrics, slos: slos(dashboard.state as LiveProductSloState, sellable, target, usefulRate, freshRate), monetizationReadiness, paidProductEconomics, sourceMonetizationGate: sourceGate, productLaunch, dailySnapshot, scaleStepGates: dailySnapshot.scaleStepGates, nonMonetizingWorkDetector: dailySnapshot.nonMonetizingWorkDetector, revenueBlockerBoard: blockers(sellable, target), deploymentProof: { actorBuildId: input.actorRun?.buildId ?? null, actorRunId: input.actorRun?.runId ?? null, datasetId: input.actorRun?.datasetId ?? null }, resourceGuardrails: { scraperTargetRamGb: 96, scraperNormalCeilingGb: 160, browserPoolDefault: "disabled", gpuRequired: false } };
}

export async function appendLiveProductDailySnapshot(path: string, snapshot: LiveProductDailySnapshot): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify({ ...snapshot, appendOnly: true })}\n`, "utf8");
}

export async function readLiveProductDailySnapshots(path: string): Promise<LiveProductDailySnapshot[]> {
  try {
    const text = await readFile(path, "utf8");
    return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function value(input: number | null | undefined): number | null { return typeof input === "number" && Number.isFinite(input) ? input : null; }
function sum(values: readonly (number | null | undefined)[] | undefined): number | null { const nums = (values ?? []).map(value).filter((item): item is number => item !== null); return nums.length ? nums.reduce((total, item) => total + item, 0) : null; }
function rate(part: number | null | undefined, total: number | null | undefined): number | null { return value(part) === null || !total ? null : round((part as number) / total); }
function round(input: number): number { return Math.round(input * 1000) / 1000; }
function sourceMonetizationGate(input: any = {}) { const evaluated = value(input.evaluatedSourceCandidateCount); const payworthy = value(input.payworthySourceCount); return { evaluatedSourceCandidateCount: evaluated, payworthySourceCount: payworthy, payworthyRate: rate(payworthy, evaluated), status: payworthy && payworthy >= 100 ? "useful" : "needs_more_sources" }; }
function economics(input: any = {}, usefulRows: number | null) { const gross = value(input.grossPpeRevenueUsd); const cost = [input.computeCostUsd, input.backendCostAllocationUsd, input.refundsFailuresUsd].map(value).filter((item): item is number => item !== null).reduce((a, b) => a + b, 0); return { grossRevenueUsd: gross, estimatedCostUsd: round(cost), estimatedNetUsd: gross === null ? null : round(gross - cost), costPerUsefulRowUsd: usefulRows ? round(cost / usefulRows) : null }; }
function pricing(cost: any = {}) { return { resultPriceUsdPerThousand: value(cost.resultPriceUsdPerThousand) ?? 3, noLeakRequired: true }; }
function scaleGates(sellable: number, usefulRate: number | null, freshRate: number | null) { return [100, 1000, 4000, 5000, 10000, 20000, 60000].map((target) => ({ targetSellableRows: target, currentSellableRows: sellable, ready: sellable >= target && (usefulRate ?? 0) >= 0.25 && (freshRate ?? 0) >= 0.4 })); }
function slos(state: LiveProductSloState, sellable: number, target: number, usefulRate: number | null, freshRate: number | null) { return [{ id: "sellable_rows", state: sellable >= target ? "pass" : state, value: sellable, target }, { id: "useful_row_rate", state: (usefulRate ?? 0) >= 0.25 ? "pass" : "warn", value: usefulRate, target: 0.25 }, { id: "fresh_row_rate", state: (freshRate ?? 0) >= 0.4 ? "pass" : "warn", value: freshRate, target: 0.4 }]; }
function blockers(sellable: number, target: number) { return [{ blocker: "sellable_row_floor", active: sellable < target, nextAction: "collect fresh useful rows" }]; }
