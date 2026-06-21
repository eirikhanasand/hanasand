// @ts-nocheck
import { clampScore, stableId } from "../utils.ts";
import { buildFrontierGroupedSnapshot, buildFrontierMetrics } from "./frontierMetrics.ts";
import { classifierFor, classify, fallbackScore, taskToCandidate, textOf, threshold, totalScore, workRank } from "./frontierScoring.ts";
export type * from "./frontierTypes.ts";

export class FocusedFrontier {
  private queue = new Map<string, any>(); private leased = new Map<string, any>(); private dead: any[] = []; private running = new Map<string, number>();
  private counters = { completed: 0, failed: 0, cancelled: 0, retryScheduled: 0, retryExhausted: 0 }; private lastTenant = "";
  private budgets = new Map<string, any>(); private o: any;
  constructor(options: FocusedFrontierOptions = {}) {
    this.o = { strategy: "balanced", maxQueueSize: 10_000, enqueueThreshold: threshold(options.strategy ?? "balanced"), reviewThreshold: 0.35, defaultPerSourceConcurrency: 2, defaultRetryBudget: 3, baseBackoffMs: 30_000, taskLeaseMs: 300_000, now: () => new Date(), ...options };
    for (const [key, limit] of Object.entries(options.crawlBudgets ?? {})) this.budgets.set(key, { taskLimit: Number(limit), byteLimit: Infinity, tasksLeased: 0, bytesReserved: 0 });
    for (const [key, b] of Object.entries(options.crawlBudgetPolicies ?? {})) this.budgets.set(key, { taskLimit: b.taskLimit ?? Infinity, byteLimit: b.byteLimit ?? Infinity, deadlineAt: b.deadlineAt, tasksLeased: 0, bytesReserved: 0 });
  }
  add(candidate: any) { const score = this.score(candidate); if (score.decision === "enqueue") this.enqueueTask(this.toTask(candidate, score)); return score; }
  enqueueTask(task: any) { const item = { ...task, task, candidate: taskToCandidate(task), score: task.scoreBreakdown ?? fallbackScore(task, this.o.strategy) }; this.queue.set(task.id, item); this.trim(); return item; }
  score(candidate: any) {
    if (candidate.source?.status && candidate.source.status !== "active") return this.scoreObj(candidate, 0, "drop", "source is not active");
    const total = totalScore(candidate, this.o.strategy), safety = candidate.safetyRisk ?? (candidate.source?.risk === "high" ? 0.6 : 0);
    const destinationRequired = this.o.strategy === "destination_only" && !candidate.destinationText && !candidate.destinationTitle && candidate.destinationRelevance === undefined;
    const disagreement = this.o.strategy === "precision" && classify(candidate.destinationText ?? candidate.destinationTitle ?? "").score < 0.15 && classify(textOf(candidate, "link")).score > 0.4;
    if (destinationRequired) return this.scoreObj(candidate, total * 0.4, "drop", "destination evidence required");
    if (safety >= 0.5 && total >= this.o.reviewThreshold) return this.scoreObj(candidate, total, "review", "high-risk candidate needs analyst review before collection", safety);
    if (disagreement) return this.scoreObj(candidate, total * 0.55, "review", "link and destination disagree", safety);
    const decision = total >= this.o.enqueueThreshold ? "enqueue" : total >= this.o.reviewThreshold ? "review" : "drop";
    return this.scoreObj(candidate, total, decision, decision === "enqueue" ? "candidate is relevant and collectable" : "candidate needs more evidence", safety);
  }
  next(now = this.o.now(), predicate = (_task: any) => true) {
    this.requeueExpiredLeases(now);
    for (const item of this.sorted(now)) {
      if ((item.availableAt && Date.parse(item.availableAt) > +now) || !predicate(item.task ?? item)) continue;
      if ((this.running.get(item.sourceId) ?? 0) >= this.o.defaultPerSourceConcurrency) continue;
      if (!this.reserveBudget(item, now)) continue;
      this.queue.delete(item.id); this.leased.set(item.id, { item, leasedUntil: +now + this.o.taskLeaseMs });
      this.running.set(item.sourceId, (this.running.get(item.sourceId) ?? 0) + 1); this.lastTenant = item.tenantId ?? "";
      return item;
    }
  }
  complete(task: any) { return this.ack(task, "completed", "completed"); }
  cancel(task: any, reason = "cancelled by scheduler") { return this.ack(task, "cancelled", reason); }
  fail(task: any, now = this.o.now(), reason?: string): any {
    this.release(task); this.counters.failed++;
    if ((task.retryCount ?? 0) >= this.o.defaultRetryBudget) { const ack = { status: "retry_exhausted", taskId: task.id, task, reason: reason ?? "failed" }; this.dead.push(ack); this.counters.retryExhausted++; return ack; }
    const retry = { ...task, retryCount: (task.retryCount ?? 0) + 1, availableAt: new Date(+now + this.o.baseBackoffMs * Math.max(1, (task.retryCount ?? 0) + 1)).toISOString() };
    if (retry.crawlBudgetKey && this.budgets.has(retry.crawlBudgetKey)) this.budgets.get(retry.crawlBudgetKey).tasksLeased++;
    const item = this.enqueueTask(retry); this.counters.retryScheduled++; return reason === undefined ? item : { status: "retry_scheduled", taskId: task.id, task, retry: item, reason };
  }
  requeueExpiredLeases(now = this.o.now()) { const out: any[] = []; for (const [id, lease] of this.leased) if (lease.leasedUntil <= +now) { this.leased.delete(id); this.release(lease.item, false); this.queue.set(id, lease.item); out.push(lease.item); } return out; }
  snapshot() { return [...this.queue.values()]; } leasedSnapshot() { return [...this.leased.values()].map((l) => l.item.task ?? l.item); }
  deadLetterSnapshot() { return [...this.dead]; } size() { return this.queue.size; }
  metrics(now = this.o.now()) { return buildFrontierMetrics(this, now); } groupedSnapshot(now = this.o.now()) { return buildFrontierGroupedSnapshot(this, now); }
  private toTask(c: any, score: any) { return { id: stableId("task", `${c.source.id}:${c.url}:${c.discoveredAt}`), tenantId: c.tenantId, sourceId: c.source.id, sourceType: c.source.type, targetUrl: c.url, queuedAt: c.discoveredAt, availableAt: c.availableAt, deadlineAt: c.deadlineAt, priority: score.total, reason: score.reason, retryCount: 0, maxBytes: c.maxBytes, crawlBudgetKey: c.budgetKey, planning: c.planning, scoreBreakdown: score, fairnessKey: c.fairnessKey, intelRequestId: c.intelRequestId }; }
  private scoreObj(c: any, total: number, decision: string, reason: string, safetyPenalty = 0) { const classifier = classifierFor(c, this.o.strategy); return { total: clampScore(total), decision, reason, strategy: this.o.strategy, relevance: classifier.relevance, novelty: c.novelty ?? 0.5, freshness: c.freshness ?? 0.5, sourceTrust: c.source?.trustScore ?? 0.5, safetyPenalty, classifier }; }
  private sorted(now: Date) { return this.snapshot().sort((a, b) => workRank[(a.task?.planning ?? a.planning)?.budgetClass] - workRank[(b.task?.planning ?? b.planning)?.budgetClass] || Number((a.tenantId ?? "") === this.lastTenant) - Number((b.tenantId ?? "") === this.lastTenant) || b.priority - a.priority || a.queuedAt.localeCompare(b.queuedAt)); }
  private reserveBudget(item: any, now: Date) { const key = item.crawlBudgetKey; if (!key) return true; const b = this.budgets.get(key); if (!b || (b.deadlineAt && Date.parse(b.deadlineAt) < +now) || b.tasksLeased >= b.taskLimit || b.bytesReserved + (item.maxBytes ?? 0) > b.byteLimit) return false; b.tasksLeased++; b.bytesReserved += item.maxBytes ?? 0; return true; }
  private ack(task: any, status: string, reason: string) { this.release(task); this.counters[status]++; return { status, taskId: task.id, task, reason }; }
  private release(task: any, removeLease = true) { if (removeLease) this.leased.delete(task.id); this.running.set(task.sourceId, Math.max(0, (this.running.get(task.sourceId) ?? 1) - 1)); }
  private trim() { while (this.queue.size > this.o.maxQueueSize) this.queue.delete(this.sorted(this.o.now()).at(-1)?.id); }
}
