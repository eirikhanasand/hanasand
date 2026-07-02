import type { ApiServerOptions } from "./serverTypes.ts";
import { json } from "./http.ts";
import { exposureClaimsFromStore } from "./exposureQueueRoutes.ts";
import { nowIso } from "../utils.ts";

export function collectionSchedulerStatus(options: ApiServerOptions) {
  const generatedAt = nowIso();
  const sources = options.store.listSources();
  const runs = options.store.listRuns?.() ?? [];
  const latestRun = [...runs].filter((run: any) => run.requestId === "req_public_canary").sort((a: any, b: any) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  const successfulRuns = runs.filter((run: any) => run.requestId === "req_public_canary" && run.status === "completed");
  const lastSuccessfulRun = [...successfulRuns].sort((a: any, b: any) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  const activeSources = sources.filter((source: any) => source.status === "active" || source.status === "canary");
  const dailySources = activeSources.filter((source: any) => Number(source.crawlFrequencySeconds ?? 86400) <= 86400);
  const dailyCovered = dailySources.filter((source: any) => withinDailyWindow(source.crawlState?.lastCollectedAt, generatedAt));
  const exposureItems = exposureClaimsFromStore(options.store, "");
  const canaryState = readCanaryState(options.canaryLoop);
  const nextRunAt = canaryState?.nextCycleAt ?? nextEligibleSourceAt(activeSources);
  const sourceTarget = Number((options.sourceBootstrap as any)?.sourceTarget ?? Bun.env.TI_SOURCE_TARGET_COUNT ?? "1000");
  const totalSourceCount = sources.length;
  const sourceShortfall = Math.max(0, sourceTarget - totalSourceCount);
  const deadLetters = options.frontier.deadLetterSnapshot?.() ?? [];

  return json({
    schemaVersion: "ti.collection_scheduler_status.v1",
    generatedAt,
    decision: sourceShortfall || !lastSuccessfulRun ? "not_operational" : "operational",
    sourceBootstrap: options.sourceBootstrap,
    sourceCoverage: {
      sourceTarget,
      totalSourceCount,
      sourceShortfall,
      activeSourceCount: activeSources.length,
      dailySourceCount: dailySources.length,
      dailyCoveredCount: dailyCovered.length,
      dailyCoverageRatio: dailySources.length ? dailyCovered.length / dailySources.length : 0
    },
    scheduler: {
      enabled: canaryState?.enabled ?? Bun.env.TI_CANARY_ENABLED !== "false",
      running: canaryState?.running ?? false,
      intervalSeconds: canaryState?.intervalSeconds ?? Number(Bun.env.TI_CANARY_INTERVAL_SECONDS ?? "300"),
      maxSources: canaryState?.maxSources ?? Number(Bun.env.TI_CANARY_MAX_SOURCES ?? "50"),
      maxTasks: canaryState?.maxTasks ?? Number(Bun.env.TI_CANARY_MAX_TASKS ?? "25"),
      lastRun: latestRun,
      lastSuccessfulRun,
      nextRunAt,
      queue: {
        queued: options.frontier.size?.() ?? options.frontier.snapshot?.().length ?? 0,
        leased: options.frontier.leasedSnapshot?.().length ?? 0,
        deadLetterCount: deadLetters.length
      }
    },
    parser: {
      aiEndpointConfigured: Boolean(Bun.env.HANASAND_AI_API_BASE),
      endpoint: Bun.env.HANASAND_AI_API_BASE ? new URL(Bun.env.HANASAND_AI_EXPOSURE_PARSE_PATH || "/v1/parse/exposure-claim", Bun.env.HANASAND_AI_API_BASE).toString() : undefined,
      parsedExposureCount: exposureItems.length,
      acceptedExposureCount: exposureItems.filter((item: any) => item.status !== "needs_review").length,
      reviewExposureCount: exposureItems.filter((item: any) => item.status === "needs_review").length
    },
    failures: deadLetters.slice(-50).map((item: any) => ({
      taskId: item.taskId,
      sourceId: item.task?.sourceId,
      reason: item.reason
    })),
    sources: activeSources.slice(0, 250).map((source: any) => ({
      sourceId: source.id,
      name: source.name,
      type: source.type,
      status: source.status,
      crawlFrequencySeconds: source.crawlFrequencySeconds,
      lastCollectedAt: source.crawlState?.lastCollectedAt,
      nextEligibleAt: source.crawlState?.nextEligibleAt,
      retryCount: source.crawlState?.retryCount ?? 0,
      dailyCovered: withinDailyWindow(source.crawlState?.lastCollectedAt, generatedAt)
    }))
  });
}

function readCanaryState(canaryLoop: unknown) {
  if (!canaryLoop || typeof canaryLoop !== "object" || !("getState" in canaryLoop) || typeof (canaryLoop as any).getState !== "function") return undefined;
  return (canaryLoop as any).getState();
}

function withinDailyWindow(value: unknown, generatedAt: string) {
  const time = Date.parse(String(value ?? ""));
  if (!Number.isFinite(time)) return false;
  return Date.parse(generatedAt) - time <= 86_400_000;
}

function nextEligibleSourceAt(sources: any[]) {
  return sources.map((source) => source.crawlState?.nextEligibleAt).filter(Boolean).sort()[0];
}
