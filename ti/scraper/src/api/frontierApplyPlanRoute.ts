import {
  buildSchedulerApplyPlan,
  buildSchedulerApplyPlanApiResponse,
  buildSchedulerCanaryControlPlane,
  buildSchedulerCutoverRehearsal,
  buildSchedulerDailyActorRunPlan,
  buildSchedulerDurableBackendReadiness,
  buildSchedulerFreshnessSloDashboard,
  buildSchedulerFreshnessSloEngine,
  buildSchedulerProductionAdapterTelemetry,
  buildSchedulerQueueEconomics,
  buildSchedulerRuntimeExecution,
  buildSchedulerRuntimeSla,
  buildSchedulerSlaEnforcement,
  buildSchedulerWorkerLeaseSoakHarness,
  buildSchedulerWorkerQueueCutover,
  buildSchedulerWorkerSoakMigration,
  InMemorySchedulerQueueRepository,
  rehearseSchedulerSourceGapEnqueue,
  schedulerApplyPlanApiContract,
  type SchedulerApplyPlanApiResponseDto,
  type SchedulerApplyPlanApiRequestDto,
  type SchedulerRepairAction
} from "../frontier/schedulerProduction.ts";
import type { FrontierAck } from "../frontier/frontier.ts";
import type { CollectionPlan, CollectionRun, CollectionTask, SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";

export interface FrontierApplyPlanRouteResult {
  status: number;
  body: FrontierApplyPlanRouteResponse | FrontierApplyPlanRouteError;
}

export interface FrontierApplyPlanRouteResponse {
  contract: ReturnType<typeof schedulerApplyPlanApiContract>;
  applyPlan: ReturnType<typeof buildSchedulerApplyPlanApiResponse>;
}

export interface FrontierApplyPlanRouteError {
  error: {
    code: "invalid_action" | "dry_run_required";
    message: string;
    details?: Record<string, unknown>;
  };
}

const FRONTIER_APPLY_ACTIONS: Exclude<SchedulerRepairAction, "no_action">[] = [
  "release_expired_leases",
  "cancel_abandoned_runs",
  "requeue_transient_failures",
  "delay_low_priority_sweeps",
  "pause_noisy_source_queues",
  "quarantine_permanently_failing_sources",
  "trigger_emergency_brake"
];

export function handleFrontierApplyPlanRoute(input: {
  request: Partial<SchedulerApplyPlanApiRequestDto> & Record<string, unknown>;
  sources: SourceRecord[];
  queued: CollectionTask[];
  leased: CollectionTask[];
  deadLetters: FrontierAck[];
  runs: CollectionRun[];
  generatedAt?: string;
}): FrontierApplyPlanRouteResult {
  const validation = validateFrontierApplyPlanRequest(input.request);
  if (validation) return { status: validation.error.code === "dry_run_required" ? 409 : 400, body: validation };

  const generatedAt = input.generatedAt ?? nowIso();
  const request: SchedulerApplyPlanApiRequestDto = {
    dryRun: true,
    scenario: typeof input.request.scenario === "string" ? input.request.scenario : undefined,
    selectedActions: input.request.selectedActions as SchedulerRepairAction[] | undefined,
    includeExecutionPreview: input.request.includeExecutionPreview === true,
    includeSourceGapEnqueueRehearsal: input.request.includeSourceGapEnqueueRehearsal === true,
    hostMemoryMb: numberOrUndefined(input.request.hostMemoryMb),
    dbConnectionUtilization: numberOrUndefined(input.request.dbConnectionUtilization),
    workerUtilization: numberOrUndefined(input.request.workerUtilization),
    maxApiP95QueueAgeSeconds: numberOrUndefined(input.request.maxApiP95QueueAgeSeconds)
  };
  const now = new Date(generatedAt);
  const rehearsal = buildSchedulerCutoverRehearsal({
    scenario: request.scenario ?? "frontier_apply_plan",
    sources: input.sources,
    queued: input.queued,
    leased: input.leased,
    deadLetters: input.deadLetters,
    runs: input.runs,
    now
  });

  return {
    status: 200,
    body: {
      contract: schedulerApplyPlanApiContract(),
      applyPlan: buildSchedulerApplyPlanApiResponse(buildSchedulerApplyPlan({
        rehearsal,
        tasks: [...input.queued, ...input.leased],
        now,
        hostMemoryMb: request.hostMemoryMb,
        dbConnectionUtilization: request.dbConnectionUtilization,
        workerUtilization: request.workerUtilization,
        maxApiP95QueueAgeSeconds: request.maxApiP95QueueAgeSeconds
      }), request, request.includeSourceGapEnqueueRehearsal
        ? buildSourceGapEnqueueRehearsalForApplyPlan({
            queued: input.queued,
            leased: input.leased,
            deadLetters: input.deadLetters,
            runs: input.runs,
            sources: input.sources,
            now
          })
        : undefined)
    }
  };
}

function buildSourceGapEnqueueRehearsalForApplyPlan(input: {
  queued: CollectionTask[];
  leased: CollectionTask[];
  deadLetters: FrontierAck[];
  runs: CollectionRun[];
  sources: SourceRecord[];
  now: Date;
}): NonNullable<SchedulerApplyPlanApiResponseDto["sourceGapEnqueueRehearsal"]> {
  const queueEconomics = buildSchedulerQueueEconomics({
    queued: input.queued,
    leased: input.leased,
    deadLetters: input.deadLetters,
    workerSlots: 64,
    memoryCeilingMb: 96 * 1024,
    now: input.now
  });
  const runtimeExecution = buildSchedulerRuntimeExecution({
    queued: input.queued,
    leased: input.leased,
    deadLetters: input.deadLetters,
    queueEconomics,
    pendingActivationBatchCount: 0,
    now: input.now
  });
  const runtimeSla = buildSchedulerRuntimeSla({
    queueEconomics,
    runtimeExecution,
    runs: input.runs,
    now: input.now
  });
  const slaEnforcement = buildSchedulerSlaEnforcement({
    queueEconomics,
    runtimeExecution,
    runtimeSla,
    runs: input.runs,
    now: input.now
  });
  const workerQueueCutover = buildSchedulerWorkerQueueCutover({
    queueEconomics,
    runtimeExecution,
    runtimeSla,
    slaEnforcement,
    now: input.now
  });
  const workerSoakMigration = buildSchedulerWorkerSoakMigration({
    queueEconomics,
    runtimeExecution,
    runtimeSla,
    slaEnforcement,
    workerQueueCutover,
    now: input.now
  });
  const workerLeaseSoakHarness = buildSchedulerWorkerLeaseSoakHarness({
    queueEconomics,
    runtimeExecution,
    runtimeSla,
    workerQueueCutover,
    workerSoakMigration,
    now: input.now
  });
  const productionAdapterTelemetry = buildSchedulerProductionAdapterTelemetry({
    queueEconomics,
    runtimeExecution,
    runtimeSla,
    slaEnforcement,
    workerQueueCutover,
    workerSoakMigration,
    now: input.now
  });
  const canaryControlPlane = buildSchedulerCanaryControlPlane({
    productionAdapterTelemetry,
    queueEconomics,
    slaEnforcement,
    workerQueueCutover,
    workerSoakMigration,
    now: input.now
  });
  const durableBackendReadiness = buildSchedulerDurableBackendReadiness({
    queueEconomics,
    runtimeExecution,
    runtimeSla,
    slaEnforcement,
    workerQueueCutover,
    workerSoakMigration,
    productionAdapterTelemetry,
    canaryControlPlane,
    now: input.now
  });
  const plan = applyPlanSyntheticCollectionPlan(input.queued, input.leased, input.now);
  const freshnessSloEngine = buildSchedulerFreshnessSloEngine({
    plan,
    sources: input.sources,
    queueEconomics,
    runtimeExecution,
    slaEnforcement,
    workerQueueCutover,
    durableBackendReadiness,
    now: input.now
  });
  const freshnessSloDashboard = buildSchedulerFreshnessSloDashboard({
    queueEconomics,
    runtimeExecution,
    slaEnforcement,
    workerQueueCutover,
    freshnessSloEngine,
    workerLeaseSoakHarness,
    now: input.now
  });
  const dailyPlan = buildSchedulerDailyActorRunPlan({
    freshnessSloDashboard,
    queueEconomics,
    workerQueueCutover,
    now: input.now
  });
  return {
    ...rehearseSchedulerSourceGapEnqueue(dailyPlan, new InMemorySchedulerQueueRepository(), { now: input.now }),
    routeField: "applyPlan.sourceGapEnqueueRehearsal"
  };
}

function applyPlanSyntheticCollectionPlan(queued: CollectionTask[], leased: CollectionTask[], now: Date): CollectionPlan {
  const tasks = [...queued, ...leased];
  return {
    id: "plan_frontier_apply_source_gap_rehearsal",
    tenantId: "default",
    request: {
      id: "request_frontier_apply_source_gap_rehearsal",
      tenantId: "default",
      query: "default watchlist source gap rehearsal",
      entityType: "actor",
      includeClearWeb: true,
      includeTelegram: true,
      includeDarknetMetadata: false,
      maxTasks: Math.max(20, tasks.length),
      createdAt: now.toISOString(),
      priority: "high"
    },
    tasks,
    reviewRequired: tasks.filter((task) => task.sourceType.endsWith("_metadata")),
    rejected: [],
    explanations: tasks.map((task) => ({
      sourceId: task.sourceId,
      status: "selected",
      reason: "frontier apply-plan source-gap rehearsal snapshot",
      targetUrl: task.targetUrl,
      taskId: task.id,
      priority: task.priority,
      budgetClass: task.planning?.budgetClass,
      queryTerms: task.planning?.queryTerms
    })),
    queryTerms: ["default", "watchlist", "source-gap"],
    audit: []
  };
}

function validateFrontierApplyPlanRequest(input: Partial<SchedulerApplyPlanApiRequestDto> & Record<string, unknown>): FrontierApplyPlanRouteError | undefined {
  const dryRunValue = (input as Record<string, unknown>)["dryRun"];
  if (dryRunValue === false) {
    return { error: { code: "dry_run_required", message: "/v1/frontier/apply-plan is dry-run only" } };
  }
  if (input.selectedActions !== undefined) {
    if (!Array.isArray(input.selectedActions)) {
      return { error: { code: "invalid_action", message: "selectedActions must be an array" } };
    }
    const invalid = input.selectedActions.filter((action) => !FRONTIER_APPLY_ACTIONS.includes(action as Exclude<SchedulerRepairAction, "no_action">));
    if (invalid.length) {
      return {
        error: {
          code: "invalid_action",
          message: "selectedActions contains unsupported frontier apply actions",
          details: { invalid, allowed: FRONTIER_APPLY_ACTIONS }
        }
      };
    }
  }
  return undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
