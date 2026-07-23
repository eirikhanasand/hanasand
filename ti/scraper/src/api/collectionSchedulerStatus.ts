import type { ApiServerOptions } from "./serverTypes.ts";
import { error, json, readJson } from "./http.ts";
import { exposureClaimsFromStore } from "./exposureQueueRoutes.ts";
import { nowIso } from "../utils.ts";
import { authenticateOperatorRequest, authorizeOperatorScope } from "./requestAuthentication.ts";
import { isExecutableSource } from "../policy/collectionPolicy.ts";
import { resolveTenantScope } from "./tenantScope.ts";
import { inTenantScope } from "./tenantScope.ts";
import { qualifySourcePortfolio, SOURCE_PORTFOLIO_BASELINE } from "../ops/sourcePortfolioQualification.ts";
import { buildSourceOperationsSnapshot } from "./sourceOperations.ts";

export async function collectionSchedulerStatus(options: ApiServerOptions, lastControlAction?: Record<string, unknown>, tenantId?: string, page: { limit?: number; cursor?: number } = {}) {
  const generatedAt = nowIso();
  if (typeof (options.store as any).querySourceOperationalPage === "function") {
    return boundedCollectionSchedulerStatus(options, lastControlAction, tenantId, page, generatedAt);
  }
  const inScope = (record: any) => inTenantScope(record, tenantId);
  const sources = options.store.listSources().filter(inScope);
  const sourceIds = new Set(sources.map((source: any) => source.id));
  const observations = (options.store.listSourceHealthObservations?.() ?? []).filter((record: any) => inScope(record) && sourceIds.has(record.sourceId));
  const captures = (options.store.listCaptures?.() ?? []).filter((record: any) => inScope(record) && sourceIds.has(record.sourceId));
  const portfolio = qualifySourcePortfolio({ sources, observations, captures, generatedAt });
  const qualificationBySource = new Map(portfolio.sources.map((source) => [source.sourceId, source]));
  const runs = (options.store.listRuns?.() ?? []).filter(inScope);
  const latestRun = [...runs].filter((run: any) => run.requestId === "req_public_canary").sort((a: any, b: any) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  const successfulRuns = runs.filter((run: any) => run.requestId === "req_public_canary" && ["completed", "degraded"].includes(run.status));
  const lastSuccessfulRun = [...successfulRuns].sort((a: any, b: any) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  const retainedSources = sources.filter(isExecutableSource);
  const canaryLoop = schedulerLoop(options, tenantId);
  const activeSources = canaryLoop ? retainedSources : [];
  const dailySources = activeSources.filter((source: any) => Number(source.crawlFrequencySeconds ?? 86400) <= 86400);
  const observationsBySource = groupBySource(observations);
  const capturesBySource = groupBySource(captures);
  const dailyAttempted = dailySources.filter((source: any) => observationsBySource.get(source.id)?.some((row: any) => withinDailyWindow(row.checkedAt, generatedAt)));
  const dailyCovered = dailySources.filter((source: any) => observationsBySource.get(source.id)?.some((row: any) => row.success === true && withinDailyWindow(row.checkedAt, generatedAt)));
  const exposureItems = exposureClaimsFromStore(options.store, "", { tenantId });
  const canaryState = readCanaryState(canaryLoop);
  const schedulerEnabled = Boolean(canaryLoop) && (canaryState?.enabled ?? Bun.env.TI_CANARY_ENABLED !== "false");
  const intervalSeconds = canaryState?.intervalSeconds ?? Number(Bun.env.TI_CANARY_INTERVAL_SECONDS ?? "300");
  const nextRunAt = nextSchedulerRunAt({
    generatedAt,
    enabled: schedulerEnabled,
    intervalSeconds,
    canaryNextCycleAt: canaryState?.nextCycleAt,
    nextEligibleAt: nextEligibleSourceAt(activeSources)
  });
  const totalSourceCount = sources.length;
  const queued = (options.frontier.snapshot?.() ?? []).filter((item: any) => inFrontierScope(item, tenantId));
  const leased = (options.frontier.leasedSnapshot?.() ?? []).filter((item: any) => inFrontierScope(item, tenantId));
  const deadLetters = (options.frontier.deadLetterSnapshot?.() ?? []).filter((item: any) => inFrontierScope(item, tenantId));
  const queuedTaskCount = queued.length;
  const queueLimit = canaryState?.queueLimit ?? Number(Bun.env.TI_CANARY_MAX_QUEUE_SIZE ?? "500");
  const maxTasks = canaryState?.maxTasks ?? Number(Bun.env.TI_CANARY_MAX_TASKS ?? "25");
  const maxSources = canaryState?.maxSources ?? Number(Bun.env.TI_CANARY_MAX_SOURCES ?? "50");
  const scheduledCheckCapacityPerDay = Math.floor(86_400 / Math.max(5, intervalSeconds)) * Math.min(maxTasks, maxSources);
  const requiredChecksPerDay = activeSources.reduce((total: number, source: any) => total + Math.max(1, Math.ceil(86_400 / Math.max(300, positiveNumber(source.crawlFrequencySeconds, 86_400)))), 0);
  const sourceRows = activeSources.map((source: any) => describeSource(source, generatedAt, observationsBySource.get(source.id) ?? [], capturesBySource.get(source.id) ?? [], qualificationBySource.get(source.id)))
    .sort((left, right) => left.name.localeCompare(right.name) || left.sourceId.localeCompare(right.sourceId));
  const limit = Math.max(1, Math.min(500, Number(page.limit ?? 100) || 100));
  const cursor = Math.max(0, Number(page.cursor ?? 0) || 0);
  const sourcePage = sourceRows.slice(cursor, cursor + limit);
  const control = schedulerControls({ schedulerEnabled, canaryLoop, activeSourceCount: activeSources.length, tenantId });
  const operationalBlockers = schedulerBlockers({
    activeSourceCount: activeSources.length,
    lastSuccessfulRun,
    dailySourceCount: dailySources.length,
    dailyCoverageRatio: dailySources.length ? dailyCovered.length / dailySources.length : 0,
    deadLetterCount: deadLetters.length,
    aiEndpointConfigured: Boolean(Bun.env.HANASAND_AI_API_BASE),
    canaryLoop
  });

  return json({
    schemaVersion: "ti.collection_scheduler_status.v1",
    generatedAt,
    tenantId: tenantId ?? "global",
    total: sourceRows.length,
    nextCursor: cursor + sourcePage.length < sourceRows.length ? String(cursor + sourcePage.length) : undefined,
    decision: operationalBlockers.some((blocker) => blocker.severity === "blocker") ? "not_operational" : operationalBlockers.length ? "degraded" : "operational",
    operationalBlockers,
    lastControlAction,
    sourceBootstrap: options.sourceBootstrap,
    sourceCoverage: {
      totalSourceCount,
      retainedSourceCount: retainedSources.length,
      inactiveSourceCount: totalSourceCount - retainedSources.length,
      unscheduledExecutableSourceCount: retainedSources.length - activeSources.length,
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
        leased: leased.length,
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
    sources: sourcePage
  });
}

async function boundedCollectionSchedulerStatus(
  options: ApiServerOptions,
  lastControlAction: Record<string, unknown> | undefined,
  tenantId: string | undefined,
  page: { limit?: number; cursor?: number },
  generatedAt: string
) {
  const operations = await buildSourceOperationsSnapshot(options.store, {
    tenantId,
    generatedAt,
    limit: page.limit,
    cursor: page.cursor,
    executableOnly: true
  }) as any;
  const totals = operations.summary;
  const operationalTotals = operations.operationalTotals ?? {};
  const qualification = operations.qualification;
  const canaryLoop = schedulerLoop(options, tenantId);
  const canaryState = readCanaryState(canaryLoop);
  const schedulerEnabled = Boolean(canaryLoop) && (canaryState?.enabled ?? Bun.env.TI_CANARY_ENABLED !== "false");
  const intervalSeconds = canaryState?.intervalSeconds ?? Number(Bun.env.TI_CANARY_INTERVAL_SECONDS ?? "300");
  const queue = typeof (options.frontier as any).scopedStatus === "function"
    ? (options.frontier as any).scopedStatus(tenantId, 50)
    : { queued: 0, leased: 0, deadLetterCount: 0, failures: [] };
  const queueLimit = canaryState?.queueLimit ?? Number(Bun.env.TI_CANARY_MAX_QUEUE_SIZE ?? "500");
  const maxTasks = canaryState?.maxTasks ?? Number(Bun.env.TI_CANARY_MAX_TASKS ?? "25");
  const maxSources = canaryState?.maxSources ?? Number(Bun.env.TI_CANARY_MAX_SOURCES ?? "50");
  const scheduledCheckCapacityPerDay = Math.floor(86_400 / Math.max(5, intervalSeconds)) * Math.min(maxTasks, maxSources);
  const requiredChecksPerDay = Number(operationalTotals.requiredChecksPerDay ?? 0);
  const activeSourceCount = Number(totals.activeSourceCount ?? 0);
  const dailySourceCount = Number(operationalTotals.dailySourceCount ?? 0);
  const dailyAttemptedCount = Number(operationalTotals.dailyAttemptedCount ?? 0);
  const dailyCoveredCount = Number(operationalTotals.dailyCoveredCount ?? 0);
  const latestRun = operationalTotals.latestRun;
  const lastSuccessfulRun = operationalTotals.lastSuccessfulRun;
  const blockers = schedulerBlockers({
    activeSourceCount,
    lastSuccessfulRun,
    dailySourceCount,
    dailyCoverageRatio: dailySourceCount ? dailyCoveredCount / dailySourceCount : 0,
    deadLetterCount: queue.deadLetterCount,
    aiEndpointConfigured: Boolean(Bun.env.HANASAND_AI_API_BASE),
    canaryLoop
  });
  const sourceRows = operations.sources.map((source: any) => ({
    sourceId: source.id,
    name: source.name,
    type: source.type,
    status: source.lifecycleStatus,
    healthState: source.health.state,
    crawlFrequencySeconds: source.collection?.cadenceSeconds,
    parserStatus: source.parser.status,
    lastCheckedAt: source.health.lastAttemptAt,
    lastSuccessAt: source.health.lastSuccessAt,
    lastUsefulAt: source.health.lastUsefulItemAt,
    captureCount: source.coverage.captureCount,
    lastContentAt: source.coverage.lastContentAt,
    usefulCheckCount: source.coverage.usefulCheckCount,
    qualifiesForBaseline: source.qualification.qualifies,
    qualificationReasons: source.qualification.reasons,
    baselineFamily: source.qualification.family,
    nextEligibleAt: source.nextRunAt,
    backoffUntil: source.qualification.backoffUntil,
    retryCount: 0,
    nextAction: source.health.state === "failed" ? "retry_after_backoff" : "collect_when_due",
    dailyCovered: withinDailyWindow(source.health.lastSuccessAt, generatedAt),
    dailyAttempted: withinDailyWindow(source.health.lastAttemptAt, generatedAt)
  }));
  const controls = schedulerControls({ schedulerEnabled, canaryLoop, activeSourceCount, tenantId });

  return json({
    schemaVersion: "ti.collection_scheduler_status.v1",
    generatedAt,
    tenantId: tenantId ?? "global",
    total: operations.total,
    nextCursor: operations.nextCursor,
    decision: blockers.some((blocker) => blocker.severity === "blocker") ? "not_operational" : blockers.length ? "degraded" : "operational",
    operationalBlockers: blockers,
    lastControlAction,
    sourceBootstrap: options.sourceBootstrap,
    sourceCoverage: {
      totalSourceCount: Number(totals.sourceCount ?? 0),
      retainedSourceCount: activeSourceCount,
      inactiveSourceCount: Number(totals.inactiveSourceCount ?? 0),
      unscheduledExecutableSourceCount: canaryLoop ? 0 : activeSourceCount,
      retiredSourceCount: Number(totals.retiredSourceCount ?? 0),
      activeSourceCount: canaryLoop ? activeSourceCount : 0,
      checkedSourceCount: Number(totals.checkedSourceCount ?? 0),
      successfulSourceCount: Number(totals.successfulSourceCount ?? 0),
      usefulSourceCount: Number(totals.usefulSourceCount ?? 0),
      latestUsefulSourceCount: Number(totals.latestUsefulSourceCount ?? totals.usefulSourceCount ?? 0),
      sustainedUsefulSourceCount: Number(totals.sustainedUsefulSourceCount ?? 0),
      captureProducingSourceCount: Number(totals.captureProducingSourceCount ?? 0),
      recentlySeenSourceCount: Number(totals.recentlySeenSourceCount ?? 0),
      backoffSourceCount: Number(totals.backoffSourceCount ?? 0),
      neverObservedSourceCount: Number(totals.neverObservedSourceCount ?? 0),
      dailySourceCount,
      dailyAttemptedCount,
      dailyAttemptCoverageRatio: dailySourceCount ? dailyAttemptedCount / dailySourceCount : 0,
      dailyCoveredCount,
      dailyCoverageRatio: dailySourceCount ? dailyCoveredCount / dailySourceCount : 0,
      qualifyingSourceCount: qualification.counts.total,
      qualifyingClearWebSourceCount: qualification.counts.clearWeb,
      qualifyingLawfulDarkWebSourceCount: qualification.counts.lawfulDarkWeb,
      qualifyingPublicTelegramSourceCount: qualification.counts.publicTelegram
    },
    sourceQualification: qualification,
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
      nextRunAt: nextSchedulerRunAt({ generatedAt, enabled: schedulerEnabled, intervalSeconds, canaryNextCycleAt: canaryState?.nextCycleAt, nextEligibleAt: operationalTotals.nextEligibleAt }),
      queue: {
        queued: queue.queued,
        leased: queue.leased,
        deadLetterCount: queue.deadLetterCount,
        limit: queueLimit,
        utilization: queueLimit ? Math.round(queue.queued / queueLimit * 10_000) / 10_000 : 0,
        backpressureState: queueLimit && queue.queued / queueLimit >= 0.8 ? "throttled" : "accepting"
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
    operatorActions: controls.actions,
    sourceHealth: {
      healthy: Number(totals.healthySourceCount ?? 0),
      stale: Number(totals.degradedSourceCount ?? 0),
      retrying: Number(totals.failedSourceCount ?? 0),
      blocked: 0,
      idle: Number(totals.neverObservedSourceCount ?? 0)
    },
    parser: {
      aiEndpointConfigured: Boolean(Bun.env.HANASAND_AI_API_BASE),
      endpoint: Bun.env.HANASAND_AI_API_BASE ? new URL(Bun.env.HANASAND_AI_EXPOSURE_PARSE_PATH || "/v1/parse/exposure-claim", Bun.env.HANASAND_AI_API_BASE).toString() : undefined,
      parsedExposureCount: 0,
      acceptedExposureCount: 0,
      reviewExposureCount: 0,
      boundedAggregateOnly: true
    },
    failures: queue.failures,
    sources: sourceRows
  });
}

export async function updateCollectionSchedulerControl(request: Request, options: ApiServerOptions) {
  const body = await readJson(request);
  const authentication = await authenticateOperatorRequest(request, options);
  if (authentication.error) return authentication.error;
  if (!authentication.identity) return error("authentication_unavailable", "Collection scheduler authentication is not configured", 503);
  const scope = resolveTenantScope(request, new URL(request.url), body.tenantId);
  if (scope.error) return scope.error;
  const accessError = authorizeOperatorScope(authentication.identity, options, scope.tenantId);
  if (accessError) return accessError;
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

  const loop = schedulerLoop(options, scope.tenantId) as any;
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

function schedulerControls(input: { schedulerEnabled: boolean; canaryLoop: unknown; activeSourceCount: number; tenantId?: string }) {
  const canPauseResume = Boolean(input.canaryLoop && typeof (input.canaryLoop as any).setEnabled === "function");
  const canRunOnce = Boolean(input.canaryLoop && typeof (input.canaryLoop as any).runOnce === "function");
  return {
    actions: [
      action("pause", "POST", scopedBody("pause", input.tenantId), input.schedulerEnabled && canPauseResume, disabledReasons(!input.schedulerEnabled && "scheduler_already_paused", !canPauseResume && "pause_resume_control_unavailable")),
      action("resume", "POST", scopedBody("resume", input.tenantId), !input.schedulerEnabled && canPauseResume, disabledReasons(input.schedulerEnabled && "scheduler_already_enabled", !canPauseResume && "pause_resume_control_unavailable")),
      action("run_now", "POST", scopedBody("run_now", input.tenantId), canRunOnce && input.activeSourceCount > 0, disabledReasons(!canRunOnce && "run_once_control_unavailable", input.activeSourceCount === 0 && "no_active_sources"))
    ]
  };
}

function action(action: string, method: string, body: Record<string, string>, enabled: boolean, disabledReasons: string[]) {
  return { action, method, endpoint: "/v1/ops/collection-scheduler", body, enabled, disabledReasons };
}

function scopedBody(action: string, tenantId?: string): Record<string, string> {
  return tenantId ? { action, tenantId } : { action };
}

function schedulerLoop(options: ApiServerOptions, tenantId?: string) {
  if (tenantId === undefined) return options.canaryLoop;
  if (tenantId === "default") return options.defaultCanaryLoop;
  return undefined;
}

function inFrontierScope(item: any, tenantId?: string) {
  return inTenantScope(item?.task ?? item, tenantId);
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
