// @ts-nocheck
import type { CollectionTask, SourceRecord } from "../types.ts";
import { by, iso } from "./schedulerProductionCore.ts";

export const buildSchedulerFreshnessSloEngine = (input: any) => ({ generatedAt: iso(input.now), actorCount: new Set((input.plan?.tasks ?? []).map((t: CollectionTask) => t.intelRequestId ?? t.fairnessKey)).size, staleSources: (input.sources ?? []).filter((s: SourceRecord) => s.status !== "active").length });
export const buildSchedulerFreshnessSloDashboard = (input: any) => ({ generatedAt: iso(input.now), status: input.freshnessSloEngine?.staleSources ? "watch" : "pass", actors: input.freshnessSloEngine?.actorCount ?? 0 });
export const buildSchedulerDailyActorRunPlan = (input: any) => ({ generatedAt: iso(input.now), status: input.freshnessSloDashboard?.status ?? "pass", tasks: input.tasks ?? [], recommendedActorRuns: Math.max(20, input.freshnessSloDashboard?.actors ?? 0) });
export const rehearseSchedulerSourceGapEnqueue = (plan: any, repo: any, options: any = {}) => ({ generatedAt: iso(options.now), enqueued: (plan.tasks ?? []).map((task: CollectionTask) => repo.enqueue?.(task) ?? task.id), status: "rehearsed" });
export const executeSchedulerSourceGapWorkerEntry = (plan: any, repo: any, options: any = {}) => ({ generatedAt: iso(options.now), lease: repo.lease?.(options.workerId ?? "worker", options.now ?? new Date()), status: "executed" });
export const runSchedulerSourceGapWorkerLoop = (plan: any, repo: any, options: any = {}) => ({ generatedAt: iso(options.now), loopId: options.loopId ?? "loop", ...executeSchedulerSourceGapWorkerEntry(plan, repo, options) });
export const runSchedulerSourceGapWorkerRunner = (plan: any, repo: any, options: any = {}) => ({ ...runSchedulerSourceGapWorkerLoop(plan, repo, options), runnerId: options.runnerId ?? "runner" });
export const buildSchedulerInteractiveSearchFreshness = (input: any) => ({ generatedAt: iso(input.now), status: "searching", queued: input.queued?.length ?? 0 });
export const buildSchedulerFairnessGovernance = (input: any) => ({ generatedAt: iso(input.now), lanes: by(input.tasks ?? [], (t: CollectionTask) => t.fairnessKey ?? t.tenantId) });
export const simulateFairnessEnforcement = (input: any) => ({ before: by(input.tasks ?? [], (t: CollectionTask) => t.fairnessKey), after: by(input.tasks ?? [], (t: CollectionTask) => t.fairnessKey), capped: [] });
