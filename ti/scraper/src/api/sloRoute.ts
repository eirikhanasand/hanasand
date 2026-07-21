import { buildLiveProductSloDashboard, type LiveProductProofMode } from "../ops/productSlo.ts";
import type { MetricsResponse } from "../types.ts";
import { nowIso } from "../utils.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

export function productSlo(options: ApiServerOptions) {
  const limits = options.config?.limits;
  return buildLiveProductSloDashboard({
    proofMode: proofMode(options),
    runs: options.store.listRuns(),
    sources: options.store.listSources(),
    captures: options.store.listCaptures(),
    incidents: options.store.listIncidents(),
    frontier: options.frontier.groupedSnapshot(),
    resource: limits ? {
      memoryTargetMb: limits.maxMemoryMbTarget,
      memoryCeilingMb: limits.maxMemoryMbCeiling
    } : undefined
  });
}

export function metrics(options: ApiServerOptions): MetricsResponse {
  const sources = options.store.listSources();
  const captures = options.store.listCaptures();
  const runs = options.store.listRuns();
  return {
    service: "ti-scraper",
    generatedAt: nowIso(),
    sources: {
      total: sources.length,
      active: sources.filter((source: any) => source.status === "active").length,
      degraded: sources.filter((source: any) => source.status === "degraded").length,
      needsReview: sources.filter((source: any) => source.status === "needs_review").length
    },
    frontier: { queued: options.frontier.size(), maxPriority: 0 },
    runs: {
      queued: runs.filter((run: any) => run.status === "queued").length,
      running: runs.filter((run: any) => run.status === "running").length,
      completed: runs.filter((run: any) => run.status === "completed").length,
      failed: runs.filter((run: any) => run.status === "failed").length,
      cancelled: runs.filter((run: any) => run.status === "cancelled").length
    },
    captures: { total: captures.length, sensitive: captures.filter((capture: any) => capture.sensitive).length },
    incidents: { total: options.store.listIncidents?.().length ?? 0, needsReview: 0 }
  };
}

function proofMode(options: ApiServerOptions): LiveProductProofMode {
  return options.config?.environment === "production" ? "public_live" : "local";
}
