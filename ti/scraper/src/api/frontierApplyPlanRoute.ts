import { buildSchedulerApplyPlan, buildSchedulerApplyPlanApiResponse, buildSchedulerCanaryControlPlane, buildSchedulerCutoverRehearsal, buildSchedulerDailyActorRunPlan, buildSchedulerDurableBackendReadiness, buildSchedulerFreshnessSloDashboard, buildSchedulerFreshnessSloEngine, buildSchedulerProductionAdapterTelemetry, buildSchedulerQueueEconomics, buildSchedulerRuntimeExecution, buildSchedulerRuntimeSla, buildSchedulerSlaEnforcement, buildSchedulerWorkerLeaseSoakHarness, buildSchedulerWorkerQueueCutover, buildSchedulerWorkerSoakMigration, InMemorySchedulerQueueRepository, rehearseSchedulerSourceGapEnqueue, runSchedulerSourceGapWorkerLoop, schedulerApplyPlanApiContract, type SchedulerRepairAction } from "../frontier/schedulerProduction.ts";
import type { FrontierAck } from "../frontier/frontier.ts";
import type { CollectionPlan, CollectionRun, CollectionTask, SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";

export type FrontierApplyPlanRouteResult = any; export type FrontierApplyPlanRouteResponse = any; export type FrontierApplyPlanRouteError = any;
const ACTIONS: Exclude<SchedulerRepairAction, "no_action">[] = ["release_expired_leases", "cancel_abandoned_runs", "requeue_transient_failures", "delay_low_priority_sweeps", "pause_noisy_source_queues", "quarantine_permanently_failing_sources", "trigger_emergency_brake"];

export function handleFrontierApplyPlanRoute(input: { request: any; sources: SourceRecord[]; queued: CollectionTask[]; leased: CollectionTask[]; deadLetters: FrontierAck[]; runs: CollectionRun[]; generatedAt?: string }): FrontierApplyPlanRouteResult {
  const validation = validate(input.request);
  if (validation) return { status: validation.error.code === "dry_run_required" ? 409 : 400, body: validation };
  const generatedAt = input.generatedAt ?? nowIso(), now = new Date(generatedAt), request = normalizeRequest(input.request);
  const base = { sources: input.sources, queued: input.queued, leased: input.leased, deadLetters: input.deadLetters, runs: input.runs, now };
  const rehearsal = buildSchedulerCutoverRehearsal({ scenario: request.scenario ?? "frontier_apply_plan", ...base });
  const apply = buildSchedulerApplyPlan({ rehearsal, tasks: [...input.queued, ...input.leased], now, hostMemoryMb: request.hostMemoryMb, dbConnectionUtilization: request.dbConnectionUtilization, workerUtilization: request.workerUtilization, maxApiP95QueueAgeSeconds: request.maxApiP95QueueAgeSeconds });
  return { status: 200, body: { contract: schedulerApplyPlanApiContract(), applyPlan: buildSchedulerApplyPlanApiResponse(apply, request, request.includeSourceGapEnqueueRehearsal ? enqueuePreview(base) : undefined, request.includeSourceGapWorkerLoopPreview ? workerPreview(base) : undefined) } };
}

function normalizeRequest(input: any) {
  return { dryRun: true, scenario: typeof input.scenario === "string" ? input.scenario : undefined, selectedActions: input.selectedActions, includeExecutionPreview: input.includeExecutionPreview === true, includeSourceGapEnqueueRehearsal: input.includeSourceGapEnqueueRehearsal === true, includeSourceGapWorkerLoopPreview: input.includeSourceGapWorkerLoopPreview === true, hostMemoryMb: num(input.hostMemoryMb), dbConnectionUtilization: num(input.dbConnectionUtilization), workerUtilization: num(input.workerUtilization), maxApiP95QueueAgeSeconds: num(input.maxApiP95QueueAgeSeconds) };
}

function daily(input: { queued: CollectionTask[]; leased: CollectionTask[]; deadLetters: FrontierAck[]; runs: CollectionRun[]; sources: SourceRecord[]; now: Date }) {
  const queueEconomics = buildSchedulerQueueEconomics({ queued: input.queued, leased: input.leased, deadLetters: input.deadLetters, workerSlots: 64, memoryCeilingMb: 96 * 1024, now: input.now });
  const runtimeExecution = buildSchedulerRuntimeExecution({ queued: input.queued, leased: input.leased, deadLetters: input.deadLetters, queueEconomics, pendingActivationBatchCount: 0, now: input.now });
  const runtimeSla = buildSchedulerRuntimeSla({ queueEconomics, runtimeExecution, runs: input.runs, now: input.now });
  const slaEnforcement = buildSchedulerSlaEnforcement({ queueEconomics, runtimeExecution, runtimeSla, runs: input.runs, now: input.now });
  const workerQueueCutover = buildSchedulerWorkerQueueCutover({ queueEconomics, runtimeExecution, runtimeSla, slaEnforcement, now: input.now });
  const workerSoakMigration = buildSchedulerWorkerSoakMigration({ queueEconomics, runtimeExecution, runtimeSla, slaEnforcement, workerQueueCutover, now: input.now });
  const workerLeaseSoakHarness = buildSchedulerWorkerLeaseSoakHarness({ queueEconomics, runtimeExecution, runtimeSla, workerQueueCutover, workerSoakMigration, now: input.now });
  const productionAdapterTelemetry = buildSchedulerProductionAdapterTelemetry({ queueEconomics, runtimeExecution, runtimeSla, slaEnforcement, workerQueueCutover, workerSoakMigration, now: input.now });
  const canaryControlPlane = buildSchedulerCanaryControlPlane({ productionAdapterTelemetry, queueEconomics, slaEnforcement, workerQueueCutover, workerSoakMigration, now: input.now });
  const durableBackendReadiness = buildSchedulerDurableBackendReadiness({ queueEconomics, runtimeExecution, runtimeSla, slaEnforcement, workerQueueCutover, workerSoakMigration, productionAdapterTelemetry, canaryControlPlane, now: input.now });
  const freshnessSloEngine = buildSchedulerFreshnessSloEngine({ plan: syntheticPlan(input.queued, input.leased, input.now), sources: input.sources, queueEconomics, runtimeExecution, slaEnforcement, workerQueueCutover, durableBackendReadiness, now: input.now });
  const freshnessSloDashboard = buildSchedulerFreshnessSloDashboard({ queueEconomics, runtimeExecution, slaEnforcement, workerQueueCutover, freshnessSloEngine, workerLeaseSoakHarness, now: input.now });
  return buildSchedulerDailyActorRunPlan({ freshnessSloDashboard, queueEconomics, workerQueueCutover, now: input.now });
}

function enqueuePreview(input: Parameters<typeof daily>[0]) { return { ...rehearseSchedulerSourceGapEnqueue(daily(input), new InMemorySchedulerQueueRepository(), { now: input.now }), routeField: "applyPlan.sourceGapEnqueueRehearsal" }; }
function workerPreview(input: Parameters<typeof daily>[0]) { return { ...runSchedulerSourceGapWorkerLoop(daily(input), new InMemorySchedulerQueueRepository(), { loopId: "frontier_apply_plan_source_gap_loop_preview", workerId: "frontier_apply_plan_source_gap_worker_preview", workerPartition: "background_source_sweep", now: input.now }), routeField: "applyPlan.sourceGapWorkerLoopPreview" }; }

function syntheticPlan(queued: CollectionTask[], leased: CollectionTask[], now: Date): CollectionPlan {
  const tasks = [...queued, ...leased];
  return { id: "plan_frontier_apply_source_gap_rehearsal", tenantId: "default", request: { id: "request_frontier_apply_source_gap_rehearsal", tenantId: "default", query: "default watchlist source gap rehearsal", entityType: "actor", includeClearWeb: true, includeTelegram: true, includeDarknetMetadata: false, maxTasks: Math.max(20, tasks.length), createdAt: now.toISOString(), priority: "high" }, tasks, reviewRequired: tasks.filter((task) => task.sourceType.endsWith("_metadata")), rejected: [], explanations: tasks.map((task) => ({ sourceId: task.sourceId, status: "selected", reason: "frontier apply-plan source-gap rehearsal snapshot", targetUrl: task.targetUrl, taskId: task.id, priority: task.priority, budgetClass: task.planning?.budgetClass, queryTerms: task.planning?.queryTerms })), queryTerms: ["default", "watchlist", "source-gap"], audit: [] };
}

function validate(input: any): FrontierApplyPlanRouteError | undefined {
  if (input.dryRun === false) return { error: { code: "dry_run_required", message: "/v1/frontier/apply-plan is dry-run only" } };
  if (input.selectedActions === undefined) return undefined;
  if (!Array.isArray(input.selectedActions)) return { error: { code: "invalid_action", message: "selectedActions must be an array" } };
  const invalid = input.selectedActions.filter((action) => !ACTIONS.includes(action));
  return invalid.length ? { error: { code: "invalid_action", message: "selectedActions contains unsupported frontier apply actions", details: { invalid, allowed: ACTIONS } } } : undefined;
}

const num = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
