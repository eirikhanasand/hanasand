// @ts-nocheck
import type { CollectionTask } from "../types.ts";

export const iso = (d = new Date()) => d.toISOString();
export const age = (at: string | undefined, now: Date) => at ? Math.max(0, (now.getTime() - Date.parse(at)) / 1000) : 0;
export const by = <T>(items: T[], pick: (item: T) => string | undefined) =>
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
