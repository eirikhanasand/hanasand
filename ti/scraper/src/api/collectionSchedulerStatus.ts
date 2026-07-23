import type { ApiServerOptions } from "./serverTypes.ts";
import { json, readJson } from "./http.ts";
import { exposureClaimsFromStore } from "./exposureQueueRoutes.ts";
import { nowIso } from "../utils.ts";
import { authenticateOperatorRequest } from "./requestAuthentication.ts";
import { isExecutableSource } from "../policy/collectionPolicy.ts";
import { resolveTenantScope } from "./tenantScope.ts";
import { qualifySourcePortfolio, SOURCE_PORTFOLIO_BASELINE } from "../ops/sourcePortfolioQualification.ts";

export function collectionSchedulerStatus(options: ApiServerOptions, lastControlAction?: Record<string, unknown>, tenantId?: string) {
  const generatedAt = nowIso();
  const inScope = (record: any) => tenantId === undefined || record.tenantId === undefined || record.tenantId === tenantId;
  const sources = options.store.listSources().filter(inScope);
  const sourceIds = new Set(sources.map((source: any) => source.id));
  const observations = (options.store.listSourceHealthObservations?.() ?? []).filter((record: any) => sourceIds.has(record.sourceId));
  const captures = (options.store.listCaptures?.() ?? []).filter((record: any) => sourceIds.has(record.sourceId));
  const portfolio = qualifySourcePortfolio({ sources, observations, captures, generatedAt });
  const qualificationBySource = new Map(portfolio.sources.map((source) => [source.sourceId, source]));
  const runs = (options.store.listRuns?.() ?? []).filter(inScope);
  const latestRun = [...runs].filter((run: any) => run.requestId === "req_public_canary").sort((a: any, b: any) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  const successfulRuns = runs.filter((run: any) => run.requestId === "req_public_canary" && ["completed", "degraded"].includes(run.status));
  const lastSuccessfulRun = [...successfulRuns].sort((a: any, b: any) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  const retainedSources = sources.filter(isExecutableSource);
  const activeSources = retainedSources;
  const dailySources = activeSources.filter((source: any) => Number(source.crawlFrequencySeconds ?? 86400) <= 86400);
  const observationsBySource = groupBySource(observations);
  const capturesBySource = groupBySource(captures);
  const dailyAttempted = dailySources.filter((source: any) => observationsBySource.get(source.id)?.some((row: any) => withinDailyWindow(row.checkedAt, generatedAt)));
  const dailyCovered = dailySources.filter((source: any) => observationsBySource.get(source.id)?.some((row: any) => row.success === true && withinDailyWindow(row.checkedAt, generatedAt)));
  const exposureItems = tenantId === undefined
    ? exposureClaimsFromStore(options.store, "")
    : exposureClaimsFromStore(options.store, "", { tenantId });
  const canaryState = readCanaryState(options.canaryLoop);
  const schedulerEnabled = canaryState?.enabled ?? Bun.env.TI_CANARY_ENABLED !== "false";
  const intervalSeconds = canaryState?.intervalSeconds ?? Number(Bun.env.TI_CANARY_INTERVAL_SECONDS ?? "300");
  const nextRunAt = nextSchedulerRunAt({
    generatedAt,
    enabled: schedulerEnabled,
    intervalSeconds,
    canaryNextCycleAt: canaryState?.nextCycleAt,
    nextEligibleAt: nextEligibleSourceAt(activeSources)
  });
  const totalSourceCount = sources.length;
  const deadLetters = options.frontier.deadLetterSnapshot?.() ?? [];
  const queuedTaskCount = options.frontier.size?.() ?? options.frontier.snapshot?.().length ?? 0;
  const queueLimit = canaryState?.queueLimit ?? Number(Bun.env.TI_CANARY_MAX_QUEUE_SIZE ?? "500");
  const maxTasks = canaryState?.maxTasks ?? Number(Bun.env.TI_CANARY_MAX_TASKS ?? "25");
  const maxSources = canaryState?.maxSources ?? Number(Bun.env.TI_CANARY_MAX_SOURCES ?? "50");
  const scheduledCheckCapacityPerDay = Math.floor(86_400 / Math.max(5, intervalSeconds)) * Math.min(maxTasks, maxSources);
  const requiredChecksPerDay = activeSources.reduce((total: number, source: any) => total + Math.max(1, Math.ceil(86_400 / Math.max(300, positiveNumber(source.crawlFrequencySeconds, 86_400)))), 0);
  const sourceRows = activeSources.map((source: any) => describeSource(source, generatedAt, observationsBySource.get(source.id) ?? [], capturesBySource.get(source.id) ?? [], qualificationBySource.get(source.id)));
  const control = schedulerControls({ schedulerEnabled, canaryLoop: options.canaryLoop, activeSourceCount: activeSources.length });
  const operationalBlockers = schedulerBlockers({
    activeSourceCount: activeSources.length,
    lastSuccessfulRun,
    dailySourceCount: dailySources.length,
    dailyCoverageRatio: dailySources.length ? dailyCovered.length / dailySources.length : 0,
    deadLetterCount: deadLetters.length,
    aiEndpointConfigured: Boolean(Bun.env.HANASAND_AI_API_BASE),
    canaryLoop: options.canaryLoop
  });

  return json({
    schemaVersion: "ti.collection_scheduler_status.v1",
    generatedAt,
    tenantId: tenantId ?? "all",
    decision: operationalBlockers.some((blocker) => blocker.severity === "blocker") ? "not_operational" : operationalBlockers.length ? "degraded" : "operational",
    operationalBlockers,
    lastControlAction,
    sourceBootstrap: options.sourceBootstrap,
    sourceCoverage: {
      totalSourceCount,
      retainedSourceCount: retainedSources.length,
      inactiveSourceCount: totalSourceCount - retainedSources.length,
      retiredSourceCount: sources.filter((source: any) => source.status === "retired").length,
      activeSourceCount: activeSources.length,
      checkedSourceCount: activeSources.filter((source: any) => (observationsBySource.get(source.id)?.length ?? 0) > 0).length,
      successfulSourceCount: activeSources.filter((source: any) => observationsBySource.get(source.id)?.some((row: any) => row.success === true)).length,
      usefulSourceCount: activeSources.filter((source: any) => qualificationBySource.get(source.id)?.latestCheckUseful === true).length,
      latestUsefulSourceCount: activeSources.filter((source: any) => qualificationBySource.get(source.id)?.latestCheckUseful === true).length,
      sustainedUsefulSourceCount: activeSources.filter((source: any) => (qualificationBySource.get(source.id)?.usefulCheckCount ?? 0) >= 2 && (qualificationBySource.get(source.id)?.retainedCaptureCount ?? 0) > 0).length,
      captureProducingSourceCount: activeSources.filter((source: any) => (capturesBySource.get(source.id)?.length ?? 0) > 0).length,
      recentlySeenSourceCount: activeSources.filter((source: any) => withinDailyWindow(qualificationBySource.get(source.id)?.lastContentAt, generatedAt)).length,
      backoffSourceCount: activeSources.filter((source: any) => Date.parse(String(source.crawlState?.backoffUntil ?? "")) > Date.parse(generatedAt)).length,
      neverObservedSourceCount: activeSources.filter((source: any) => (observationsBySource.get(source.id)?.length ?? 0) === 0).length,
      dailySourceCount: dailySources.length,
      dailyAttemptedCount: dailyAttempted.length,
      dailyAttemptCoverageRatio: dailySources.length ? dailyAttempted.length / dailySources.length : 0,
      dailyCoveredCount: dailyCovered.length,
      dailyCoverageRatio: dailySources.length ? dailyCovered.length / dailySources.length : 0,
      qualifyingSourceCount: portfolio.counts.total,
      qualifyingClearWebSourceCount: portfolio.counts.clearWeb,
      qualifyingLawfulDarkWebSourceCount: portfolio.counts.lawfulDarkWeb,
      qualifyingPublicTelegramSourceCount: portfolio.counts.publicTelegram
    },
    sourceQualification: {
      schemaVersion: portfolio.schemaVersion,
      baseline: portfolio.baseline,
      counts: portfolio.counts,
      gaps: portfolio.gaps,
      baselineMet: portfolio.baselineMet
    },
    scheduler: {
      enabled: schedulerEnabled,
      running: canaryState?.running ?? false,
      intervalSeconds,
      maxSources,
      maxTasks,
      maxConcurrentTasks: canaryState?.maxConcurrentTasks ?? Number(Bun.env.TI_CANARY_MAX_CONCURRENT_TASKS ?? "16"),
      maxItemsPerTask: canaryState?.maxItemsPerTask ?? Number(Bun.env.TI_CANARY_MAX_ITEMS_PER_TASK ?? "4"),
      timeoutMs: canaryState?.timeoutMs ?? Number(Bun.env.TI_CANARY_TIMEOUT_MS ?? Bun.env.SCRAPER_DEFAULT_TIMEOUT_MS ?? "12000"),
      lastRun: latestRun,
      lastSuccessfulRun,
      nextRunAt,
      queue: {
        queued: queuedTaskCount,
        leased: options.frontier.leasedSnapshot?.().length ?? 0,
        deadLetterCount: deadLetters.length,
        limit: queueLimit,
        utilization: queueLimit ? Math.round(queuedTaskCount / queueLimit * 10_000) / 10_000 : 0,
        backpressureState: queueLimit && queuedTaskCount / queueLimit >= 0.8 ? "throttled" : "accepting"
      },
      capacity: {
        scheduledCheckCapacityPerDay,
        requiredChecksPerDay,
        baselineMinimumChecksPerDay: SOURCE_PORTFOLIO_BASELINE.total,
        headroomChecksPerDay: scheduledCheckCapacityPerDay - requiredChecksPerDay,
        sufficientForCurrentFleet: scheduledCheckCapacityPerDay >= requiredChecksPerDay,
        sufficientForMinimumBaseline: scheduledCheckCapacityPerDay >= SOURCE_PORTFOLIO_BASELINE.total
      }
    },
    operatorActions: control.actions,
    sourceHealth: {
      healthy: sourceRows.filter((source) => source.healthState === "healthy").length,
      stale: sourceRows.filter((source) => source.healthState === "stale").length,
      retrying: sourceRows.filter((source) => source.healthState === "retrying").length,
      blocked: sourceRows.filter((source) => source.healthState === "blocked").length,
      idle: sourceRows.filter((source) => source.healthState === "idle").length
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
    sources: sourceRows
  });
}

export async function updateCollectionSchedulerControl(request: Request, options: ApiServerOptions) {
  const body = await readJson(request);
  const authentication = await authenticateOperatorRequest(request, options);
  if (authentication.error) return authentication.error;
  const scope = resolveTenantScope(request, new URL(request.url), body.tenantId);
  if (scope.error) return scope.error;
  const action = body.action === "resume" || body.enabled === true
    ? "resume"
    : body.action === "pause" || body.enabled === false
      ? "pause"
      : body.action === "run_now"
        ? "run_now"
        : "";

  if (!action) {
    return json({ error: { code: "unsupported_action", message: "Use action pause, resume, or run_now." } }, 400);
  }

  const loop = options.canaryLoop as any;
  if (!loop) {
    return json({ error: { code: "scheduler_unavailable", message: "Collection scheduler loop is not attached." } }, 409);
  }

  if (action === "run_now") {
    if (typeof loop.runOnce !== "function") {
      return json({ error: { code: "run_now_unavailable", message: "Collection scheduler does not expose runOnce." } }, 409);
    }
    await loop.runOnce();
  } else {
    if (typeof loop.setEnabled !== "function") {
      return json({ error: { code: "control_unavailable", message: "Collection scheduler does not expose pause/resume controls." } }, 409);
    }
    loop.setEnabled(action === "resume", body);
  }

  return collectionSchedulerStatus(options, {
    action,
    approvedBy: authentication.identity?.id ?? (typeof body.approvedBy === "string" ? body.approvedBy : undefined),
    requestedAt: nowIso(),
    applied: true
  }, scope.tenantId);
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

function nextSchedulerRunAt(input: { generatedAt: string; enabled: boolean; intervalSeconds: number; canaryNextCycleAt?: string; nextEligibleAt?: string }) {
  if (!input.enabled) return input.canaryNextCycleAt ?? input.nextEligibleAt;
  if (input.canaryNextCycleAt && Date.parse(input.canaryNextCycleAt) >= Date.parse(input.generatedAt)) return input.canaryNextCycleAt;
  const intervalMs = Math.max(5, Number(input.intervalSeconds) || 300) * 1000;
  return new Date(Date.parse(input.generatedAt) + intervalMs).toISOString();
}

function describeSource(source: any, generatedAt: string, observations: any[], captures: any[], qualification?: any) {
  const latest = [...observations].sort((a, b) => String(b.checkedAt).localeCompare(String(a.checkedAt)))[0];
  const lastCollectedAt = [...observations].filter((row) => row.success === true).map((row) => row.checkedAt).sort().at(-1) ?? source.crawlState?.lastCollectedAt;
  const lastFailure = [...observations].filter((row) => row.success === false).sort((a, b) => String(b.checkedAt).localeCompare(String(a.checkedAt)))[0];
  const lastFailureAt = lastFailure?.checkedAt ?? source.crawlState?.lastErrorAt ?? source.health?.lastFailureAt;
  const lastFailureReason = lastFailure?.failureReason ?? source.crawlState?.lastError ?? source.health?.lastFailureReason ?? source.health?.message;
  const retryCount = Number(source.crawlState?.retryCount ?? 0);
  const backoffUntil = source.crawlState?.backoffUntil;
  const dailyCovered = withinDailyWindow(lastCollectedAt, generatedAt);
  const dailyAttempted = dailyCovered || withinDailyWindow(lastFailureAt, generatedAt);
  const backoffActive = Boolean(backoffUntil && Date.parse(String(backoffUntil)) > Date.parse(generatedAt));
  const healthState = source.status === "blocked" || source.status === "disabled"
    ? "blocked"
    : backoffActive || retryCount > 0 && lastFailureAt
      ? "retrying"
      : dailyCovered
        ? "healthy"
        : lastCollectedAt
          ? "stale"
          : "idle";

  return {
    sourceId: source.id,
    name: source.name,
    type: source.type,
    status: source.status,
    healthState,
    crawlFrequencySeconds: source.crawlFrequencySeconds,
    parserStatus: source.health?.parserStatus ?? source.metadata?.parserStatus ?? "unknown",
    lastCheckedAt: latest?.checkedAt,
    lastSuccessAt: lastCollectedAt,
    lastUsefulAt: qualification?.lastUsefulAt,
    lastSeenAt: source.lastSeenAt,
    captureCount: captures.length,
    lastContentAt: qualification?.lastContentAt,
    usefulCheckCount: qualification?.usefulCheckCount ?? 0,
    qualifiesForBaseline: qualification?.qualifies === true,
    qualificationReasons: qualification?.reasons ?? [],
    baselineFamily: qualification?.family,
    lastCollectedAt,
    lastFailureAt,
    lastFailureReason,
    nextEligibleAt: source.crawlState?.nextEligibleAt,
    backoffUntil,
    retryCount,
    nextAction: nextSourceAction({ healthState, backoffUntil, lastFailureReason }),
    dailyCovered,
    dailyAttempted
  };
}

function latestObservation(observations: any[] | undefined) {
  return [...(observations ?? [])].sort((left, right) => String(right.checkedAt).localeCompare(String(left.checkedAt)))[0];
}

function nextSourceAction(input: { healthState: string; backoffUntil?: string; lastFailureReason?: string }) {
  if (input.healthState === "blocked") return "review_policy_or_enable_source";
  if (input.healthState === "retrying") return input.backoffUntil ? "wait_for_backoff_or_manual_retry" : "manual_retry_available";
  if (input.healthState === "stale") return "queue_refresh";
  if (input.healthState === "idle") return "run_activation_test";
  return input.lastFailureReason ? "inspect_recent_failure" : "continue_collection";
}

function schedulerControls(input: { schedulerEnabled: boolean; canaryLoop: unknown; activeSourceCount: number }) {
  const canPauseResume = Boolean(input.canaryLoop && typeof (input.canaryLoop as any).setEnabled === "function");
  const canRunOnce = Boolean(input.canaryLoop && typeof (input.canaryLoop as any).runOnce === "function");
  return {
    actions: [
      action("pause", "POST", { action: "pause" }, input.schedulerEnabled && canPauseResume, disabledReasons(!input.schedulerEnabled && "scheduler_already_paused", !canPauseResume && "pause_resume_control_unavailable")),
      action("resume", "POST", { action: "resume" }, !input.schedulerEnabled && canPauseResume, disabledReasons(input.schedulerEnabled && "scheduler_already_enabled", !canPauseResume && "pause_resume_control_unavailable")),
      action("run_now", "POST", { action: "run_now" }, canRunOnce && input.activeSourceCount > 0, disabledReasons(!canRunOnce && "run_once_control_unavailable", input.activeSourceCount === 0 && "no_active_sources"))
    ]
  };
}

function action(action: string, method: string, body: Record<string, string>, enabled: boolean, disabledReasons: string[]) {
  return { action, method, endpoint: "/v1/ops/collection-scheduler", body, enabled, disabledReasons };
}

function disabledReasons(...reasons: Array<string | false>): string[] {
  return reasons.filter(Boolean) as string[];
}

function schedulerBlockers(input: { activeSourceCount: number; lastSuccessfulRun?: unknown; dailySourceCount: number; dailyCoverageRatio: number; deadLetterCount: number; aiEndpointConfigured: boolean; canaryLoop: unknown }): Array<{ code: string; severity: "blocker" | "warning"; nextAction: string }> {
  const blockers = [
    input.activeSourceCount === 0 && blocker("no_active_sources", "blocker", "Add or activate at least one source before collection can run."),
    !input.lastSuccessfulRun && blocker("no_recent_successful_collection_run", "blocker", "Run the scheduler or repair the latest failed run before relying on freshness."),
    input.dailySourceCount > 0 && input.dailyCoverageRatio < 0.8 && blocker("daily_coverage_below_target", "warning", "Fewer than 80% of daily sources have a recent successful collection."),
    input.deadLetterCount > 0 && blocker("dead_letter_tasks", "warning", "Dead-lettered collection tasks need inspection or replay."),
    !input.aiEndpointConfigured && blocker("parser_endpoint_missing", "warning", "AI exposure parser endpoint is not configured; extraction will use local deterministic parsing only."),
    !input.canaryLoop && blocker("scheduler_loop_unattached", "warning", "Collection loop is not attached, so pause/resume/run-now controls are unavailable.")
  ];
  return blockers.filter((item): item is { code: string; severity: "blocker" | "warning"; nextAction: string } => Boolean(item));
}

function groupBySource(records: any[]) {
  const grouped = new Map<string, any[]>();
  for (const record of records) {
    const rows = grouped.get(record.sourceId);
    if (rows) rows.push(record);
    else grouped.set(record.sourceId, [record]);
  }
  return grouped;
}

function blocker(code: string, severity: "blocker" | "warning", nextAction: string) {
  return { code, severity, nextAction };
}

function positiveNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
