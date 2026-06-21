// @ts-nocheck
import type { CollectionRun, CollectionTask } from "../types.ts";
import { age, iso } from "./schedulerProductionCore.ts";
import { buildSchedulerQueueEconomics, schedulerBackpressureSummaryForTasks } from "./schedulerProductionRuntime.ts";

export function buildSchedulerReconciliation(input: { queued?: CollectionTask[]; leased?: CollectionTask[]; deadLetters?: any[]; runs?: CollectionRun[]; now?: Date }) {
  const now = input.now ?? new Date();
  const leased = (input.leased ?? []).filter((t) => t.attemptDeadlineAt && Date.parse(t.attemptDeadlineAt) < now.getTime());
  const abandoned = (input.runs ?? []).filter((r) => r.status === "running" && age(r.updatedAt, now) > 3600);
  return { generatedAt: iso(now), items: [...leased.map((task) => ({ action: "release_expired_leases", taskId: task.id })), ...abandoned.map((run) => ({ action: "cancel_abandoned_runs", runId: run.id }))], summary: { expiredLeases: leased.length, abandonedRuns: abandoned.length } };
}

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
