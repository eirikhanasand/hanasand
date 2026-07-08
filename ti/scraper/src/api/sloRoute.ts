import { buildLiveProductSloDashboard, type LiveProductProofMode } from "../ops/productSlo.ts";
import type { MetricsResponse } from "../types.ts";
import { nowIso } from "../utils.ts";
import { numberQuery } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

export function productSlo(options: ApiServerOptions, url: URL) {
  return buildLiveProductSloDashboard({ generatedAt: url.searchParams.get("generatedAt") ?? undefined, proofMode: proofMode(url.searchParams.get("proofMode")), runs: options.store.listRuns(), sources: options.store.listSources(), captures: options.store.listCaptures(), incidents: options.store.listIncidents(), frontier: options.frontier.groupedSnapshot(), actorRun: actorRun(url) });
}

export function metrics(options: ApiServerOptions): MetricsResponse {
  const sources = options.store.listSources();
  const captures = options.store.listCaptures();
  const runs = options.store.listRuns();
  return { service: "ti-scraper", generatedAt: nowIso(), sources: { total: sources.length, active: sources.filter((s: any) => s.status === "active").length, degraded: 0, needsReview: 0 }, frontier: { queued: options.frontier.size(), maxPriority: 0 }, runs: { queued: runs.filter((r: any) => r.status === "queued").length, running: 0, completed: 0, failed: 0, cancelled: 0 }, captures: { total: captures.length, sensitive: captures.filter((c: any) => c.sensitive).length }, incidents: { total: options.store.listIncidents?.().length ?? 0, needsReview: 0 } };
}

function actorRun(url: URL) {
  return { rowCount: numberQuery(url.searchParams.get("actorRowCount")) ?? null, usefulRowCount: numberQuery(url.searchParams.get("actorUsefulRowCount")) ?? null, freshRowCount: numberQuery(url.searchParams.get("actorFreshRowCount")) ?? null, sellableRowCount: numberQuery(url.searchParams.get("actorSellableRows")) ?? null, targetSellableRows: numberQuery(url.searchParams.get("actorTargetSellableRows")) ?? 100 };
}

function proofMode(value: string | null): LiveProductProofMode {
  return value === "fixture" || value === "inspur" || value === "public_live" ? value : "local";
}
