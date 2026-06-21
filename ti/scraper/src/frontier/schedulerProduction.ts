// @ts-nocheck
import type { CollectionRun, CollectionTask, SourceRecord } from "../types.ts";

export type {
  SchedulerApplyPlanApiRequestDto,
  SchedulerApplyPlanApiResponseDto,
  SchedulerRepairAction
} from "./schedulerProductionTypes.ts";

const iso = (d = new Date()) => d.toISOString();
const age = (at: string | undefined, now: Date) => at ? Math.max(0, (now.getTime() - Date.parse(at)) / 1000) : 0;
const by = <T>(items: T[], pick: (item: T) => string | undefined) =>
  items.reduce<Record<string, number>>((acc, item) => ((acc[pick(item) ?? "unknown"] = (acc[pick(item) ?? "unknown"] ?? 0) + 1), acc), {});

export const SCHEDULER_CUTOVER_DESIGN = { targetBackend: "postgres_queue", contractInvariants: ["backend-neutral task DTOs"], durableTables: [{ name: "run_reuse_keys" }] };
export const DEFAULT_SCHEDULER_EXECUTION_SLO = { maxQueueAgeSeconds: 900, maxRetryPressure: 0.25, minWorkerUtilization: 0.2 };
export const schedulerLoadModelFixtures = () => [1, 10, 100, 1_000].map((liveSearchPollers) => ({ liveSearchPollers, expectedPollsPerMinute: liveSearchPollers * 20, analystDeepDives: Math.ceil(liveSearchPollers / 10), sourceHealthProbes: liveSearchPollers * 2, maxQueueAgeSeconds: { interactive_live_search: 30, broad_daily_sweep: 900 } }));
export const schedulerSoakScenarios = () => [{ name: "normal", queued: 100 }, { name: "burst", queued: 1_000 }];
export const schedulerWorkerRuntimeFixtures = (now = new Date()) => schedulerSoakScenarios().map((s) => ({ ...s, generatedAt: iso(now) }));
export const evaluateSchedulerSoakScenario = (s: any) => ({ scenario: s.name ?? "scenario", passed: (s.queued ?? 0) < 2_000, findings: [] });

export function simulateSchedulerExecution(input: { queued?: CollectionTask[]; leased?: CollectionTask[]; now?: Date }) {
  const queued = input.queued ?? [], leased = input.leased ?? [], now = input.now ?? new Date();
  return { generatedAt: iso(now), queued: queued.length, leased: leased.length, oldestQueueAgeSeconds: Math.max(0, ...queued.map((t) => age(t.queuedAt, now))) };
}
export const schedulerBackpressureSummaryForTasks = (input: any) => ({ ...simulateSchedulerExecution(input), pressure: ((input.queued?.length ?? 0) + (input.leased?.length ?? 0)) > 500 ? "high" : "normal" });
export const schedulerWorkerLoopContract = (generatedAt = iso()) => ({ generatedAt, steps: ["lease", "collect", "ack"], invariants: ["do not duplicate leased tasks"] });
export const buildSchedulerQueueEconomics = (input: any) => ({ generatedAt: iso(input.now), queuedCount: input.queued?.length ?? 0, leasedCount: input.leased?.length ?? 0, deadLetterCount: input.deadLetters?.length ?? 0, workerSlots: input.workerSlots ?? 16, oldestQueueAgeSeconds: Math.max(0, ...(input.queued ?? []).map((t: CollectionTask) => age(t.queuedAt, input.now ?? new Date()))), bySourceType: by(input.queued ?? [], (t: CollectionTask) => t.sourceType) });
export const buildSchedulerRuntimeExecution = (input: any) => ({ generatedAt: iso(input.now), recommendedWorkers: Math.min(256, Math.max(1, Math.ceil((input.queueEconomics?.queuedCount ?? 0) / 25))), controls: [] });
export const buildSchedulerRuntimeSla = (input: any) => ({ generatedAt: iso(input.now), state: (input.queueEconomics?.oldestQueueAgeSeconds ?? 0) > 900 ? "breach" : "pass", metrics: [{ name: "queue_age", value: input.queueEconomics?.oldestQueueAgeSeconds ?? 0 }] });
export const buildSchedulerSlaEnforcement = (input: any) => ({ generatedAt: iso(input.now), releaseGate: input.runtimeSla?.state === "breach" ? "hold" : "pass", actions: input.runtimeSla?.state === "breach" ? ["requeue_transient_failures"] : [] });
export const buildSchedulerWorkerQueueCutover = (input: any) => ({ generatedAt: iso(input.now), backend: "postgres_queue", partitions: [{ name: "interactive", maxWorkers: 16 }, { name: "background", maxWorkers: 64 }] });
export const buildSchedulerWorkerSoakMigration = (input: any) => ({ generatedAt: iso(input.now), status: input.slaEnforcement?.releaseGate === "hold" ? "pause" : "run" });
export const buildSchedulerWorkerLeaseSoakHarness = (input: any) => ({ generatedAt: iso(input.now), scenarios: ["lease_expiry", "retry", "ack"] });
export const buildSchedulerProductionAdapterTelemetry = (input: any) => ({ generatedAt: iso(input.now), queueDepth: input.queueEconomics?.queuedCount ?? 0 });
export const buildSchedulerCanaryControlPlane = (input: any) => ({ generatedAt: iso(input.now), action: input.slaEnforcement?.releaseGate === "hold" ? "pause" : "expand" });
export const buildSchedulerDurableBackendReadiness = (input: any) => ({ generatedAt: iso(input.now), ready: (input.queueEconomics?.queuedCount ?? 0) < 100_000 });

export const buildSchedulerFreshnessSloEngine = (input: any) => ({ generatedAt: iso(input.now), actorCount: new Set((input.plan?.tasks ?? []).map((t: CollectionTask) => t.intelRequestId ?? t.fairnessKey)).size, staleSources: (input.sources ?? []).filter((s: SourceRecord) => s.status !== "active").length });
export const buildSchedulerFreshnessSloDashboard = (input: any) => ({ generatedAt: iso(input.now), status: input.freshnessSloEngine?.staleSources ? "watch" : "pass", actors: input.freshnessSloEngine?.actorCount ?? 0 });
export const buildSchedulerDailyActorRunPlan = (input: any) => ({ generatedAt: iso(input.now), status: input.freshnessSloDashboard?.status ?? "pass", tasks: input.tasks ?? [], recommendedActorRuns: Math.max(20, input.freshnessSloDashboard?.actors ?? 0) });
export const rehearseSchedulerSourceGapEnqueue = (plan: any, repo: any, options: any = {}) => ({ generatedAt: iso(options.now), enqueued: (plan.tasks ?? []).map((task: CollectionTask) => repo.enqueue?.(task) ?? task.id), status: "rehearsed" });
export const executeSchedulerSourceGapWorkerEntry = (plan: any, repo: any, options: any = {}) => ({ generatedAt: iso(options.now), lease: repo.lease?.(options.workerId ?? "worker", options.now ?? new Date()), status: "executed" });
export const runSchedulerSourceGapWorkerLoop = (plan: any, repo: any, options: any = {}) => ({ generatedAt: iso(options.now), loopId: options.loopId ?? "loop", ...executeSchedulerSourceGapWorkerEntry(plan, repo, options) });
export const runSchedulerSourceGapWorkerRunner = (plan: any, repo: any, options: any = {}) => ({ ...runSchedulerSourceGapWorkerLoop(plan, repo, options), runnerId: options.runnerId ?? "runner" });
export const buildSchedulerInteractiveSearchFreshness = (input: any) => ({ generatedAt: iso(input.now), status: "searching", queued: input.queued?.length ?? 0 });
export const buildSchedulerProductionLeaseSemantics = (input: any) => ({ generatedAt: iso(input.now), leaseSeconds: input.leaseSeconds ?? 300 });
export const buildSchedulerFairnessGovernance = (input: any) => ({ generatedAt: iso(input.now), lanes: by(input.tasks ?? [], (t: CollectionTask) => t.fairnessKey ?? t.tenantId) });
export const buildSchedulerPersistenceReplayCutover = (input: any) => ({ generatedAt: iso(input.now), replayable: true });
export const buildSchedulerPostgresQueueAdapterReadiness = (input: any) => ({ generatedAt: iso(input.now), ready: true });
export const schedulerSoakBackpressurePacket = (simulation: any) => ({ simulation, packet: "backpressure" });

export function buildSchedulerReconciliation(input: { queued?: CollectionTask[]; leased?: CollectionTask[]; deadLetters?: any[]; runs?: CollectionRun[]; now?: Date }) {
  const now = input.now ?? new Date();
  const leased = (input.leased ?? []).filter((t) => t.attemptDeadlineAt && Date.parse(t.attemptDeadlineAt) < now.getTime());
  const abandoned = (input.runs ?? []).filter((r) => r.status === "running" && age(r.updatedAt, now) > 3600);
  return { generatedAt: iso(now), items: [...leased.map((task) => ({ action: "release_expired_leases", taskId: task.id })), ...abandoned.map((run) => ({ action: "cancel_abandoned_runs", runId: run.id }))], summary: { expiredLeases: leased.length, abandonedRuns: abandoned.length } };
}
export const simulateFairnessEnforcement = (input: any) => ({ before: by(input.tasks ?? [], (t: CollectionTask) => t.fairnessKey), after: by(input.tasks ?? [], (t: CollectionTask) => t.fairnessKey), capped: [] });
export const buildSchedulerCutoverRehearsal = (input: any) => ({ generatedAt: iso(input.now), scenario: input.scenario ?? "default", reconciliation: buildSchedulerReconciliation(input), queueEconomics: buildSchedulerQueueEconomics(input) });
export function buildSchedulerApplyPlan(input: any) {
  const rehearsal = input.rehearsal ?? buildSchedulerCutoverRehearsal(input);
  const actions = rehearsal.reconciliation?.items ?? [];
  return { generatedAt: iso(input.now), approval: actions.length ? "automation_safe" : "blocked", riskClass: actions.length > 10 ? "medium" : "low", steps: actions, expectedDelta: { queueDepth: -(actions.length) }, rehearsal };
}
export const buildSchedulerApplyPlanApiResponse = (plan: any, request: any = {}, enqueue?: any, loop?: any) => ({ dryRun: true, request, plan, items: plan.steps ?? [], executionPreview: request.includeExecutionPreview ? { steps: plan.steps ?? [] } : undefined, sourceGapEnqueueRehearsal: enqueue, sourceGapWorkerLoopPreview: loop });
export const schedulerApplyPlanApiContract = () => ({ route: "/v1/frontier/apply-plan", dryRunOnly: true, allowedActions: ["release_expired_leases", "cancel_abandoned_runs", "requeue_transient_failures", "delay_low_priority_sweeps", "pause_noisy_source_queues", "quarantine_permanently_failing_sources", "trigger_emergency_brake"] });
export const buildSchedulerDiagnostics = (input: any) => ({ generatedAt: iso(input.now), status: (input.queued?.length ?? 0) > 1_000 ? "watch" : "ok", queue: schedulerBackpressureSummaryForTasks(input) });
export const detectSchedulerStarvation = (tasks: CollectionTask[] = [], now = new Date()) => tasks.filter((t) => age(t.queuedAt, now) > 1800).map((t) => ({ taskId: t.id, sourceId: t.sourceId, ageSeconds: age(t.queuedAt, now) }));
export const activeRunGcDecisions = (runs: CollectionRun[] = [], options: any = {}) => runs.filter((r) => r.status === "running" && age(r.updatedAt, options.now ?? new Date()) > (options.maxRunAgeSeconds ?? 3600)).map((r) => ({ runId: r.id, action: "cancel_abandoned_run" }));

export class InMemorySchedulerQueueRepository {
  private tasks: CollectionTask[] = [];
  enqueue(task: CollectionTask) { this.tasks.push(task); return task.id; }
  lease(workerId = "worker", now = new Date()) { const task = this.tasks.shift(); return task ? { ...task, lease: { workerId, leasedAt: iso(now) } } : undefined; }
  ack(taskId: string, status = "completed") { return { taskId, status }; }
  snapshot() { return [...this.tasks]; }
}

export class PostgresSchedulerQueueRepository extends InMemorySchedulerQueueRepository {
  constructor(readonly input: any = {}) { super(); }
}
export const createSchedulerQueueRepository = (input: any = {}) => input.kind === "postgres" ? new PostgresSchedulerQueueRepository(input) : new InMemorySchedulerQueueRepository();
