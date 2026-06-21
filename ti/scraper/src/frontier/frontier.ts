// @ts-nocheck
import { clampScore, stableId } from "../utils.ts";

export type FocusedFrontierOptions = any; export type QueuedFrontierItem = any; export type CrawlBudgetPolicy = any;
export type CrawlBudgetState = any; export type FrontierAckStatus = any; export type FrontierAck = any;
export type FrontierGroupSummary = any; export type FrontierSchedulingMetrics = any;

const cti = ["apt", "actor", "campaign", "cve", "exploit", "indicator", "ioc", "malware", "ransomware", "threat", "ttp", "victim", "vulnerability"];
const actors = ["apt29", "cozy bear", "nobelium", "scattered spider", "akira", "lockbit", "turla", "volt typhoon"];
const actions = ["breach", "compromise", "exfiltration", "intrusion", "phishing", "backdoor", "credential", "initial access", "zero-day"];
const noise = ["weekly roundup", "sponsored", "press release", "webinar", "marketing", "job opening", "product launch"];
const workRank: any = { background_refresh: 0, analyst_deep_dive: 1, source_health_probe: 2, interactive_live_search: 3 };

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
  next(now = this.o.now()) {
    this.requeueExpiredLeases(now);
    for (const item of this.sorted(now)) {
      if (item.availableAt && Date.parse(item.availableAt) > +now) continue;
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
  snapshot() { return [...this.queue.values()]; }
  leasedSnapshot() { return [...this.leased.values()].map((l) => l.item.task ?? l.item); }
  deadLetterSnapshot() { return [...this.dead]; }
  size() { return this.queue.size; }
  metrics(now = this.o.now()) { return this.buildMetrics(now, [...this.snapshot(), ...this.leasedSnapshot()]); }
  groupedSnapshot(now = this.o.now()) {
    const all = [...this.snapshot(), ...this.leasedSnapshot()], queued = this.snapshot();
    return { total: all.length, queued: queued.length, leased: this.leased.size, groups: { tenants: countBy(all, (t) => t.tenantId ?? "global"), sources: countBy(all, (t) => t.sourceId), adapterTypes: countBy(all, (t) => t.sourceType), priorityBuckets: countBy(all, bucket), ageBuckets: countBy(all, (t) => ageBucket(t, now)) }, budgets: Object.fromEntries([...this.budgets].map(([k, b]) => [k, { ...b, tasksRemaining: Math.max(0, b.taskLimit - b.tasksLeased), bytesRemaining: Math.max(0, b.byteLimit - b.bytesReserved), expired: b.deadlineAt ? Date.parse(b.deadlineAt) < +now : false }])), metrics: this.metrics(now) };
  }
  private toTask(c: any, score: any) { return { id: stableId("task", `${c.source.id}:${c.url}:${c.discoveredAt}`), tenantId: c.tenantId, sourceId: c.source.id, sourceType: c.source.type, targetUrl: c.url, queuedAt: c.discoveredAt, availableAt: c.availableAt, deadlineAt: c.deadlineAt, priority: score.total, reason: score.reason, retryCount: 0, maxBytes: c.maxBytes, crawlBudgetKey: c.budgetKey, planning: c.planning, scoreBreakdown: score, fairnessKey: c.fairnessKey, intelRequestId: c.intelRequestId }; }
  private scoreObj(c: any, total: number, decision: string, reason: string, safetyPenalty = 0) { const classifier = classifierFor(c, this.o.strategy); return { total: clampScore(total), decision, reason, strategy: this.o.strategy, relevance: classifier.relevance, novelty: c.novelty ?? 0.5, freshness: c.freshness ?? 0.5, sourceTrust: c.source?.trustScore ?? 0.5, safetyPenalty, classifier }; }
  private sorted(now: Date) { return this.snapshot().sort((a, b) => workRank[(a.task?.planning ?? a.planning)?.budgetClass] - workRank[(b.task?.planning ?? b.planning)?.budgetClass] || Number((a.tenantId ?? "") === this.lastTenant) - Number((b.tenantId ?? "") === this.lastTenant) || b.priority - a.priority || a.queuedAt.localeCompare(b.queuedAt)); }
  private reserveBudget(item: any, now: Date) { const key = item.crawlBudgetKey; if (!key) return true; const b = this.budgets.get(key); if (!b || (b.deadlineAt && Date.parse(b.deadlineAt) < +now) || b.tasksLeased >= b.taskLimit || b.bytesReserved + (item.maxBytes ?? 0) > b.byteLimit) return false; b.tasksLeased++; b.bytesReserved += item.maxBytes ?? 0; return true; }
  private ack(task: any, status: string, reason: string) { this.release(task); this.counters[status]++; return { status, taskId: task.id, task, reason }; }
  private release(task: any, removeLease = true) { if (removeLease) this.leased.delete(task.id); this.running.set(task.sourceId, Math.max(0, (this.running.get(task.sourceId) ?? 1) - 1)); }
  private trim() { while (this.queue.size > this.o.maxQueueSize) this.queue.delete(this.sorted(this.o.now()).at(-1)?.id); }
  private buildMetrics(now: Date, all: any[]) { const ages = all.map((t) => Math.max(0, (+now - Date.parse(t.queuedAt ?? now.toISOString())) / 1000)); return { queueAgeSeconds: { max: Math.max(0, ...ages), average: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0, highPriorityMax: Math.max(0, ...all.filter((t) => t.priority >= 0.7).map((t) => Math.max(0, (+now - Date.parse(t.queuedAt ?? now.toISOString())) / 1000))) }, throughput: { ...this.counters }, retryPressure: rate(this.counters.retryScheduled + this.counters.retryExhausted, all.length + this.counters.failed), budgetExhaustion: [...this.budgets.values()].filter((b) => b.tasksLeased >= b.taskLimit || b.bytesReserved >= b.byteLimit).length, sourceStarvation: 0, tenantStarvation: 0, adapterSaturation: countBy(this.leasedSnapshot(), (t) => t.sourceType) }; }
}

function classifierFor(c: any, strategy: string) { const link = classify(textOf(c, "link")), parent = classify(`${c.parentTitle ?? ""} ${c.parentText ?? c.surroundingText ?? ""}`), destination = classify(`${c.destinationTitle ?? ""} ${c.destinationText ?? ""}`); const weights = weightsFor(strategy, Boolean(c.destinationText || c.destinationTitle)); const relevance = clampScore(link.score * weights.link + parent.score * weights.parent + destination.score * weights.destination); return { selectedStrategy: strategy === "hybrid_dynamic" ? "hybrid_dynamic_classifier" : strategy, tradeoff: ["precision", "recall", "efficiency"].includes(strategy) ? strategy : "balanced", weights, link, parent, destination, relevance, coverage: { hasLinkContext: Boolean(c.anchorText || c.surroundingText), hasParentPage: Boolean(c.parentTitle || c.parentText || c.parentRelevance), hasDestinationPage: Boolean(c.destinationTitle || c.destinationText || c.destinationRelevance) } }; }
function classify(text: string) { const lower = text.toLowerCase(), terms = [...cti, ...actors, ...actions, ...(lower.match(/cve-\d{4}-\d+/g) ?? [])].filter((term, i, a) => lower.includes(term) && a.indexOf(term) === i); const penalty = noise.some((term) => lower.includes(term)) ? 0.2 : 0; return { score: clampScore(terms.length / 8 - penalty), matchedTerms: terms }; }
function totalScore(c: any, strategy: string) { const cls = classifierFor(c, strategy), sourceTrust = c.source?.trustScore ?? 0.5; return clampScore(cls.relevance * 0.55 + (c.parentRelevance ?? c.destinationRelevance ?? 0.5) * 0.15 + (c.novelty ?? 0.5) * 0.12 + (c.freshness ?? 0.5) * 0.12 + sourceTrust * 0.06); }
function weightsFor(strategy: string, hasDestination: boolean) { const m: any = { link_only: [0.8, 0.1, 0.1], parent_only: [0.1, 0.8, 0.1], destination_only: [0.1, 0.1, 0.8], link_parent: [0.45, 0.45, 0.1], link_destination: [0.45, 0.1, 0.45], parent_destination: [0.1, 0.45, 0.45], precision: [0.25, 0.25, 0.5], recall: [0.45, 0.35, 0.2], efficiency: [0.65, 0.25, 0.1], hybrid_dynamic: hasDestination ? [0.33, 0.27, 0.4] : [0.52, 0.38, 0.1] }; const [link, parent, destination] = m[strategy] ?? [0.34, 0.33, 0.33]; return { link, parent, destination }; }
const threshold = (strategy: string) => strategy === "precision" || strategy === "destination_only" ? 0.58 : strategy === "recall" ? 0.36 : 0.45;
const textOf = (c: any, _: string) => `${c.anchorText ?? ""} ${c.surroundingText ?? ""} ${c.url ?? ""}`;
const taskToCandidate = (task: any) => ({ source: { id: task.sourceId, type: task.sourceType, status: "active", trustScore: 0.5 }, url: task.targetUrl, discoveredAt: task.queuedAt, anchorText: task.reason });
const fallbackScore = (task: any, strategy: string) => ({ total: task.priority ?? 0.5, decision: "enqueue", reason: task.reason, strategy });
const countBy = (items: any[], fn: (x: any) => string) => items.reduce((a, x) => ({ ...a, [fn(x)]: (a[fn(x)] ?? 0) + 1 }), {});
const bucket = (t: any) => t.priority >= 0.45 ? "critical" : t.priority >= 0.35 ? "high" : t.priority >= 0.2 ? "normal" : "low";
const ageBucket = (t: any, now: Date) => (+now - Date.parse(t.queuedAt ?? now.toISOString())) < 300_000 ? "lt_5m" : "gte_5m";
const rate = (n: number, d: number) => d ? n / d : 0;
