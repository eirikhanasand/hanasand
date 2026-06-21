// @ts-nocheck
import { ageBucket, bucket, countBy, rate } from "./frontierScoring.ts";

export function buildFrontierMetrics(frontier: any, now: Date) {
  const all = [...frontier.snapshot(), ...frontier.leasedSnapshot()];
  const ages = all.map((t) => Math.max(0, (+now - Date.parse(t.queuedAt ?? now.toISOString())) / 1000));
  return {
    queueAgeSeconds: {
      max: Math.max(0, ...ages),
      average: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0,
      highPriorityMax: Math.max(0, ...all.filter((t) => t.priority >= 0.7).map((t) => Math.max(0, (+now - Date.parse(t.queuedAt ?? now.toISOString())) / 1000)))
    },
    throughput: { ...frontier.counters },
    retryPressure: rate(frontier.counters.retryScheduled + frontier.counters.retryExhausted, all.length + frontier.counters.failed),
    budgetExhaustion: [...frontier.budgets.values()].filter((b) => b.tasksLeased >= b.taskLimit || b.bytesReserved >= b.byteLimit).length,
    sourceStarvation: 0,
    tenantStarvation: 0,
    adapterSaturation: countBy(frontier.leasedSnapshot(), (t) => t.sourceType)
  };
}

export function buildFrontierGroupedSnapshot(frontier: any, now: Date) {
  const all = [...frontier.snapshot(), ...frontier.leasedSnapshot()], queued = frontier.snapshot();
  return { total: all.length, queued: queued.length, leased: frontier.leased.size, groups: { tenants: countBy(all, (t) => t.tenantId ?? "global"), sources: countBy(all, (t) => t.sourceId), adapterTypes: countBy(all, (t) => t.sourceType), priorityBuckets: countBy(all, bucket), ageBuckets: countBy(all, (t) => ageBucket(t, now)) }, budgets: Object.fromEntries([...frontier.budgets].map(([k, b]) => [k, { ...b, tasksRemaining: Math.max(0, b.taskLimit - b.tasksLeased), bytesRemaining: Math.max(0, b.byteLimit - b.bytesReserved), expired: b.deadlineAt ? Date.parse(b.deadlineAt) < +now : false }])), metrics: frontier.metrics(now) };
}
