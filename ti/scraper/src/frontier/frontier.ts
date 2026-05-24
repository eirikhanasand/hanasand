import type { CollectionTask, FrontierCandidate, FrontierScore, FrontierStrategy } from "../types.ts";
import { clampScore, stableId } from "../utils.ts";
import { evaluateSourceForCollection } from "../policy/collectionPolicy.ts";
import { effectiveSourceScore } from "../registry/sourceRegistry.ts";

export interface FocusedFrontierOptions {
  strategy?: FrontierStrategy;
  maxQueueSize?: number;
  reviewThreshold?: number;
  enqueueThreshold?: number;
  defaultPerSourceConcurrency?: number;
  defaultRetryBudget?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  taskLeaseMs?: number;
  crawlBudgets?: Record<string, number>;
  crawlBudgetPolicies?: Record<string, Partial<CrawlBudgetPolicy>>;
  now?: () => Date;
}

export interface QueuedFrontierItem extends CollectionTask {
  task: CollectionTask;
  candidate: FrontierCandidate;
  score: FrontierScore;
}

export interface CrawlBudgetPolicy {
  taskLimit: number;
  byteLimit: number;
  deadlineAt?: string;
}

export interface CrawlBudgetState extends CrawlBudgetPolicy {
  tasksLeased: number;
  bytesReserved: number;
}

export type FrontierAckStatus = "completed" | "failed" | "cancelled" | "not_leased" | "retry_scheduled" | "retry_exhausted";

export interface FrontierAck {
  status: FrontierAckStatus;
  taskId: string;
  task?: CollectionTask;
  retry?: QueuedFrontierItem;
  reason: string;
}

export interface FrontierGroupSummary {
  total: number;
  queued: number;
  leased: number;
  groups: {
    tenants: Record<string, number>;
    sources: Record<string, number>;
    adapterTypes: Record<string, number>;
    priorityBuckets: Record<string, number>;
    ageBuckets: Record<string, number>;
  };
  budgets: Record<string, CrawlBudgetState & { tasksRemaining: number; bytesRemaining: number; expired: boolean }>;
  metrics: FrontierSchedulingMetrics;
}

export interface FrontierSchedulingMetrics {
  queueAgeSeconds: {
    max: number;
    average: number;
    highPriorityMax: number;
  };
  throughput: {
    completed: number;
    failed: number;
    cancelled: number;
    retryScheduled: number;
    retryExhausted: number;
  };
  retryPressure: number;
  budgetExhaustion: number;
  sourceStarvation: number;
  tenantStarvation: number;
  adapterSaturation: Record<string, number>;
}

const CTI_TERMS = [
  "apt",
  "actor",
  "campaign",
  "cve",
  "exploit",
  "indicator",
  "ioc",
  "malware",
  "ransomware",
  "threat",
  "ttp",
  "victim",
  "vulnerability"
];

const ACTOR_TERMS = [
  "apt29",
  "cozy bear",
  "nobelium",
  "the dukes",
  "scattered spider",
  "octo tempest",
  "akira",
  "lockbit",
  "blackcat",
  "alphv",
  "cl0p",
  "clop",
  "turla",
  "volt typhoon"
];

const ACTION_TERMS = [
  "breach",
  "compromise",
  "exfiltration",
  "intrusion",
  "phishing",
  "loader",
  "backdoor",
  "command and control",
  "credential",
  "persistence",
  "lateral movement",
  "initial access",
  "zero-day",
  "0day"
];

const NOISE_TERMS = [
  "weekly roundup",
  "sponsored",
  "press release",
  "webinar",
  "marketing",
  "stock price",
  "career",
  "job opening",
  "product launch"
];

type HybridTradeoff = "precision" | "recall" | "balanced" | "efficiency";
type HybridClassifierName = "link" | "parent" | "destination";
type HybridClassifierOutput = NonNullable<FrontierScore["classifier"]>["link"];
type HybridWeights = NonNullable<FrontierScore["classifier"]>["weights"];

interface HybridStrategyProfile {
  selectedStrategy: string;
  tradeoff: HybridTradeoff;
  baseWeights: HybridWeights;
  requireDestinationForEnqueue?: boolean;
  requireClassifierAgreement?: boolean;
}

export class FocusedFrontier {
  private readonly strategy: FrontierStrategy;
  private readonly maxQueueSize: number;
  private readonly reviewThreshold: number;
  private readonly enqueueThreshold: number;
  private readonly defaultPerSourceConcurrency: number;
  private readonly defaultRetryBudget: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly taskLeaseMs: number;
  private readonly now: () => Date;
  private readonly queue = new Map<string, QueuedFrontierItem>();
  private readonly runningBySource = new Map<string, number>();
  private readonly sourceBackoffUntil = new Map<string, number>();
  private readonly lastScheduledAt = new Map<string, number>();
  private readonly leased = new Map<string, { item: QueuedFrontierItem; leasedUntil: number }>();
  private readonly crawlBudgets = new Map<string, CrawlBudgetState>();
  private readonly deadLetters: FrontierAck[] = [];
  private readonly counters = {
    completed: 0,
    failed: 0,
    cancelled: 0,
    retryScheduled: 0,
    retryExhausted: 0
  };

  constructor(options: FocusedFrontierOptions = {}) {
    this.strategy = options.strategy ?? "balanced";
    this.maxQueueSize = Math.max(1, options.maxQueueSize ?? 10_000);
    this.reviewThreshold = clampScore(options.reviewThreshold ?? defaultFrontierReviewThreshold(this.strategy));
    this.enqueueThreshold = clampScore(options.enqueueThreshold ?? defaultEnqueueThreshold(this.strategy));
    this.defaultPerSourceConcurrency = Math.max(1, options.defaultPerSourceConcurrency ?? 2);
    this.defaultRetryBudget = Math.max(0, options.defaultRetryBudget ?? 3);
    this.baseBackoffMs = Math.max(1, options.baseBackoffMs ?? 30_000);
    this.maxBackoffMs = Math.max(this.baseBackoffMs, options.maxBackoffMs ?? 30 * 60_000);
    this.taskLeaseMs = Math.max(1, options.taskLeaseMs ?? 5 * 60_000);
    this.now = options.now ?? (() => new Date());
    for (const [key, budget] of Object.entries(options.crawlBudgets ?? {})) {
      this.crawlBudgets.set(key, {
        taskLimit: Math.max(0, Math.floor(budget)),
        byteLimit: Number.POSITIVE_INFINITY,
        tasksLeased: 0,
        bytesReserved: 0
      });
    }
    for (const [key, budget] of Object.entries(options.crawlBudgetPolicies ?? {})) {
      this.crawlBudgets.set(key, {
        taskLimit: Math.max(0, Math.floor(budget.taskLimit ?? Number.POSITIVE_INFINITY)),
        byteLimit: Math.max(0, Math.floor(budget.byteLimit ?? Number.POSITIVE_INFINITY)),
        deadlineAt: budget.deadlineAt,
        tasksLeased: 0,
        bytesReserved: 0
      });
    }
  }

  add(candidate: FrontierCandidate): FrontierScore {
    const score = this.score(candidate);
    if (score.decision !== "enqueue") return score;

    const task = this.toTask(candidate, score);
    this.queue.set(task.id, queueItem(task, candidate, score));
    this.trimToMaxSize();
    return score;
  }

  enqueueTask(task: CollectionTask): QueuedFrontierItem {
    const item = queueItem(task, taskToCandidate(task), task.scoreBreakdown ?? fallbackScore(task, this.strategy));
    this.queue.set(task.id, item);
    this.trimToMaxSize();
    return item;
  }

  score(candidate: FrontierCandidate): FrontierScore {
    const policy = evaluateSourceForCollection(candidate.source);
    if (!policy.allowed) {
      const blockedScore = this.buildScore(candidate, {
        decision: "drop",
        reason: policy.reason
      });

      if (policy.reason.includes("approval") && blockedScore.total >= this.reviewThreshold) {
        return {
          ...blockedScore,
          decision: "review",
          reason: `${policy.reason}; candidate needs analyst review before collection`
        };
      }

      return { ...blockedScore, total: 0 };
    }

    const score = this.buildScore(candidate);
    if (!candidate.source.type.endsWith("_metadata") && (candidate.source.risk === "high" || candidate.source.risk === "restricted" || score.safetyPenalty >= 0.5) && score.total >= this.reviewThreshold) {
      return { ...score, decision: "review", reason: "high-risk candidate needs analyst review before collection" };
    }

    if (score.total >= this.enqueueThreshold) {
      return { ...score, decision: "enqueue", reason: "candidate is relevant and collectable" };
    }

    if (score.total >= this.reviewThreshold) {
      return { ...score, decision: "review", reason: "candidate needs analyst review before collection" };
    }

    return { ...score, decision: "drop", reason: "candidate relevance is below threshold" };
  }

  next(now = this.now()): QueuedFrontierItem | undefined {
    this.requeueExpiredLeases(now);
    const item = this.sortedItems(now).find((queued) => this.isEligible(queued.task, now));
    if (!item) return undefined;
    this.queue.delete(item.task.id);
    this.markRunning(item.task, 1);
    this.consumeBudget(item.task);
    this.leased.set(item.task.id, { item, leasedUntil: now.getTime() + this.taskLeaseMs });
    this.markFairness(item.task, now);
    return item;
  }

  snapshot(): QueuedFrontierItem[] {
    return this.sortedItems(this.now());
  }

  groupedSnapshot(now = this.now()): FrontierGroupSummary {
    const queued = this.snapshot();
    const leased = this.leasedSnapshot();
    const all = [...queued, ...leased];
    const budgets: FrontierGroupSummary["budgets"] = {};
    for (const [key, budget] of this.crawlBudgets.entries()) {
      budgets[key] = {
        ...budget,
        tasksRemaining: Math.max(0, budget.taskLimit - budget.tasksLeased),
        bytesRemaining: Math.max(0, budget.byteLimit - budget.bytesReserved),
        expired: Boolean(budget.deadlineAt && Date.parse(budget.deadlineAt) <= now.getTime())
      };
    }

    return {
      total: all.length,
      queued: queued.length,
      leased: leased.length,
      groups: {
        tenants: countBy(all, (task) => task.tenantId ?? "global"),
        sources: countBy(all, (task) => task.sourceId),
        adapterTypes: countBy(all, (task) => task.sourceType),
        priorityBuckets: countBy(all, priorityBucket),
        ageBuckets: countBy(all, (task) => ageBucket(task, now))
      },
      budgets,
      metrics: this.buildMetrics(now, all)
    };
  }

  private sortedItems(now: Date): QueuedFrontierItem[] {
    return [...this.queue.values()].sort((a, b) => {
      const priorityDelta = effectivePriority(b.task, now, this.lastScheduledAt) - effectivePriority(a.task, now, this.lastScheduledAt);
      if (priorityDelta !== 0) return priorityDelta;
      return a.task.queuedAt.localeCompare(b.task.queuedAt);
    });
  }

  complete(task: CollectionTask): FrontierAck {
    const leased = this.leased.get(task.id);
    if (!leased) return { status: "not_leased", taskId: task.id, reason: "task is not currently leased" };
    this.leased.delete(task.id);
    this.markRunning(task, -1);
    this.counters.completed += 1;
    return { status: "completed", taskId: task.id, task, reason: "task lease completed" };
  }

  fail(task: CollectionTask, now?: Date): QueuedFrontierItem | undefined;
  fail(task: CollectionTask, now: Date, reason: string): FrontierAck;
  fail(task: CollectionTask, now = this.now(), reason?: string): QueuedFrontierItem | FrontierAck | undefined {
    const leased = this.leased.get(task.id);
    if (!leased && reason !== undefined) return { status: "not_leased", taskId: task.id, reason: "task is not currently leased" };
    this.leased.delete(task.id);

    const maxRetries = task.maxRetries ?? this.defaultRetryBudget;
    if (task.retryCount >= maxRetries) {
      this.markRunning(task, -1);
      this.counters.failed += 1;
      this.counters.retryExhausted += 1;
      const ack: FrontierAck = { status: "retry_exhausted", taskId: task.id, task, reason: "retry budget exhausted" };
      this.deadLetters.push(ack);
      return reason === undefined
        ? undefined
        : ack;
    }

    const retryCount = task.retryCount + 1;
    const delayMs = Math.min(this.maxBackoffMs, this.baseBackoffMs * 2 ** (retryCount - 1));
    const availableAt = new Date(now.getTime() + stableJitter(delayMs, task.id)).toISOString();
    const retryTask: CollectionTask = {
      ...task,
      retryCount,
      queuedAt: now.toISOString(),
      availableAt,
      reason: `${task.reason}; retry ${retryCount}/${maxRetries}${reason ? `: ${reason}` : ""}`
    };
    this.sourceBackoffUntil.set(task.sourceConcurrencyKey ?? task.sourceId, Date.parse(availableAt));

    const retry = queueItem(
      retryTask,
      leased?.item.candidate ?? taskToCandidate(retryTask),
      retryTask.scoreBreakdown ?? fallbackScore(retryTask, this.strategy)
    );
    this.queue.set(retryTask.id, retry);
    this.trimToMaxSize();
    this.counters.failed += 1;
    this.counters.retryScheduled += 1;
    return reason === undefined
      ? retry
      : { status: "retry_scheduled", taskId: task.id, task, retry, reason: "task failure scheduled retry" };
  }

  cancel(task: CollectionTask, reason = "cancelled by scheduler"): FrontierAck {
    const leased = this.leased.get(task.id);
    if (leased) {
      this.leased.delete(task.id);
      this.markRunning(task, -1);
      this.counters.cancelled += 1;
      return { status: "cancelled", taskId: task.id, task, reason };
    }

    const queued = this.queue.get(task.id);
    if (queued) {
      this.queue.delete(task.id);
      this.counters.cancelled += 1;
      return { status: "cancelled", taskId: task.id, task: queued.task, reason };
    }

    return { status: "not_leased", taskId: task.id, reason: "task is not queued or leased" };
  }

  requeueExpiredLeases(now = this.now()): QueuedFrontierItem[] {
    const requeued: QueuedFrontierItem[] = [];
    for (const [taskId, lease] of this.leased.entries()) {
      if (lease.leasedUntil > now.getTime()) continue;
      this.leased.delete(taskId);
      this.markRunning(lease.item.task, -1);
      const task = { ...lease.item.task, availableAt: now.toISOString(), reason: `${lease.item.task.reason}; lease expired` };
      const item = queueItem(task, lease.item.candidate, lease.item.score);
      this.queue.set(taskId, item);
      requeued.push(item);
    }
    return requeued;
  }

  leasedSnapshot(): CollectionTask[] {
    return [...this.leased.values()].map((lease) => lease.item.task);
  }

  deadLetterSnapshot(): FrontierAck[] {
    return [...this.deadLetters];
  }

  metrics(now = this.now()): FrontierSchedulingMetrics {
    return this.buildMetrics(now, [...this.snapshot(), ...this.leasedSnapshot()]);
  }

  size(): number {
    return this.queue.size;
  }

  private buildScore(
    candidate: FrontierCandidate,
    override?: Partial<Pick<FrontierScore, "decision" | "reason" | "total">>
  ): FrontierScore {
    const link = classifyFrontierText("link", [
      candidate.url,
      candidate.anchorText,
      candidate.surroundingText
    ], candidate.url);
    const parent = classifyFrontierText("parent", [
      candidate.parentUrl,
      candidate.parentTitle,
      candidate.parentText,
      candidate.surroundingText
    ], candidate.url, candidate.parentRelevance);
    const destination = classifyFrontierText("destination", [
      candidate.destinationTitle,
      candidate.destinationText
    ], candidate.url, candidate.destinationRelevance);
    const coverage = {
      hasLinkContext: Boolean(candidate.anchorText || candidate.surroundingText || candidate.url),
      hasParentPage: Boolean(candidate.parentTitle || candidate.parentText || candidate.parentRelevance !== undefined),
      hasDestinationPage: Boolean(candidate.destinationTitle || candidate.destinationText || candidate.destinationRelevance !== undefined)
    };
    const sourceReputation = effectiveSourceScore(candidate.source);
    const novelty = clampScore(candidate.novelty ?? 0.5);
    const freshness = clampScore(candidate.freshness ?? 0.5);
    const safetyPenalty = clampScore(candidate.safetyRisk ?? riskPenalty(candidate.source.risk));
    const agingBoost = calculateAgingBoost(candidate.discoveredAt);
    const profile = frontierStrategyProfile(this.strategy);
    const weights = adaptiveHybridWeights(profile, { link, parent, destination }, coverage);
    const classifierTotal = (
      link.score * weights.link +
      parent.score * weights.parent +
      destination.score * weights.destination +
      sourceReputation * weights.sourceReputation +
      novelty * weights.novelty +
      freshness * weights.freshness +
      agingBoost * weights.agingBoost
    );
    const agreementPenalty = classifierAgreementPenalty(profile, { link, parent, destination }, coverage);
    const destinationPenalty = profile.requireDestinationForEnqueue && !coverage.hasDestinationPage ? 0.12 : 0;
    const depthPenalty = clampScore((candidate.depth ?? 0) / 20) * 0.08;
    const total = clampScore(
      classifierTotal -
      safetyPenalty * weights.safetyPenalty -
      agreementPenalty -
      destinationPenalty -
      depthPenalty
    );

    return {
      total: override?.total ?? total,
      linkContext: link.score,
      parentRelevance: parent.score,
      destinationRelevance: destination.score,
      sourceReputation,
      novelty,
      freshness,
      safetyPenalty,
      agingBoost,
      strategy: this.strategy,
      decision: override?.decision ?? "drop",
      reason: override?.reason ?? `${profile.selectedStrategy} hybrid classifier scored candidate`,
      classifier: {
        strategy: this.strategy,
        selectedStrategy: profile.selectedStrategy,
        link,
        parent,
        destination,
        weights,
        coverage,
        tradeoff: profile.tradeoff
      }
    };
  }

  private toTask(candidate: FrontierCandidate, score: FrontierScore): CollectionTask {
    return {
      id: stableId("task", `${candidate.source.id}:${candidate.url}`),
      tenantId: candidate.tenantId,
      sourceId: candidate.source.id,
      targetUrl: candidate.url,
      sourceType: candidate.source.type,
      queuedAt: candidate.discoveredAt,
      priority: score.total,
      reason: score.reason,
      parentUrl: candidate.parentUrl,
      retryCount: 0,
      intelRequestId: candidate.intelRequestId,
      maxBytes: candidate.maxBytes,
      availableAt: candidate.discoveredAt,
      attemptDeadlineAt: new Date(Date.parse(candidate.discoveredAt) + this.taskLeaseMs).toISOString(),
      crawlBudgetKey: candidate.budgetKey,
      maxRetries: this.defaultRetryBudget,
      fairnessKey: candidate.fairnessKey,
      sourceConcurrencyKey: candidate.source.id,
      scoreBreakdown: score
    };
  }

  private trimToMaxSize(): void {
    if (this.queue.size <= this.maxQueueSize) return;
    const keep = this.sortedItems(this.now()).slice(0, this.maxQueueSize);
    this.queue.clear();
    for (const item of keep) {
      this.queue.set(item.task.id, item);
    }
  }

  private isEligible(task: CollectionTask, now: Date): boolean {
    if (task.availableAt && Date.parse(task.availableAt) > now.getTime()) return false;
    if (task.deadlineAt && Date.parse(task.deadlineAt) <= now.getTime()) return false;
    if (task.crawlBudgetKey && !this.hasBudget(task, now)) return false;
    const sourceBackoff = this.sourceBackoffUntil.get(task.sourceConcurrencyKey ?? task.sourceId);
    if (sourceBackoff && sourceBackoff > now.getTime()) return false;
    if (sourceBackoff && sourceBackoff <= now.getTime()) this.sourceBackoffUntil.delete(task.sourceConcurrencyKey ?? task.sourceId);
    return (this.runningBySource.get(task.sourceConcurrencyKey ?? task.sourceId) ?? 0) < this.defaultPerSourceConcurrency;
  }

  private markRunning(task: CollectionTask, delta: 1 | -1): void {
    const key = task.sourceConcurrencyKey ?? task.sourceId;
    const next = Math.max(0, (this.runningBySource.get(key) ?? 0) + delta);
    if (next === 0) this.runningBySource.delete(key);
    else this.runningBySource.set(key, next);
  }

  private consumeBudget(task: CollectionTask): void {
    if (!task.crawlBudgetKey || !this.crawlBudgets.has(task.crawlBudgetKey)) return;
    const budget = this.crawlBudgets.get(task.crawlBudgetKey);
    if (!budget) return;
    budget.tasksLeased += 1;
    budget.bytesReserved += task.maxBytes ?? 0;
  }

  private hasBudget(task: CollectionTask, now: Date): boolean {
    if (!task.crawlBudgetKey) return true;
    const budget = this.crawlBudgets.get(task.crawlBudgetKey);
    if (!budget) return true;
    if (budget.deadlineAt && Date.parse(budget.deadlineAt) <= now.getTime()) return false;
    if (budget.tasksLeased >= budget.taskLimit) return false;
    if (budget.bytesReserved + (task.maxBytes ?? 0) > budget.byteLimit) return false;
    return true;
  }

  private markFairness(task: CollectionTask, now: Date): void {
    for (const key of fairnessKeys(task)) {
      this.lastScheduledAt.set(key, now.getTime());
    }
  }

  private buildMetrics(now: Date, tasks: CollectionTask[]): FrontierSchedulingMetrics {
    const ages = tasks.map((task) => Math.max(0, (now.getTime() - Date.parse(task.queuedAt)) / 1000));
    const highPriorityAges = tasks
      .filter((task) => task.priority >= 0.75)
      .map((task) => Math.max(0, (now.getTime() - Date.parse(task.queuedAt)) / 1000));
    const retryPressure = tasks.length
      ? tasks.filter((task) => task.retryCount > 0).length / tasks.length
      : 0;
    const exhaustedBudgets = [...this.crawlBudgets.values()].filter((budget) =>
      budget.tasksLeased >= budget.taskLimit || budget.bytesReserved >= budget.byteLimit || Boolean(budget.deadlineAt && Date.parse(budget.deadlineAt) <= now.getTime())
    ).length;

    return {
      queueAgeSeconds: {
        max: Math.max(0, ...ages),
        average: ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : 0,
        highPriorityMax: Math.max(0, ...highPriorityAges)
      },
      throughput: { ...this.counters },
      retryPressure: clampScore(retryPressure),
      budgetExhaustion: exhaustedBudgets,
      sourceStarvation: starvationCount(tasks, now, (task) => task.sourceId),
      tenantStarvation: starvationCount(tasks, now, (task) => task.tenantId ?? "global"),
      adapterSaturation: countBy(this.leasedSnapshot(), (task) => task.sourceType)
    };
  }
}

function queueItem(task: CollectionTask, candidate: FrontierCandidate, score: FrontierScore): QueuedFrontierItem {
  return { ...task, task, candidate, score };
}

function effectivePriority(task: CollectionTask, now: Date, lastScheduledAt: Map<string, number>): number {
  const ageMs = Math.max(0, now.getTime() - Date.parse(task.queuedAt));
  const ageBoost = Math.min(0.15, ageMs / (60 * 60_000) * 0.05);
  const recentPenalty = fairnessKeys(task).reduce((penalty, key) => {
    const last = lastScheduledAt.get(key);
    if (!last) return penalty;
    const sinceMs = Math.max(0, now.getTime() - last);
    return penalty + Math.max(0, 0.18 - sinceMs / (10 * 60_000) * 0.18);
  }, 0);
  return task.priority + budgetClassBoost(task) + ageBoost - recentPenalty;
}

function budgetClassBoost(task: CollectionTask): number {
  const fairnessKey = task.fairnessKey?.toLowerCase() ?? "";
  if (fairnessKey.includes("retention") || fairnessKey.includes("replay")) return 0.09;
  switch (task.planning?.budgetClass) {
    case "analyst_deep_dive":
      return 0.08;
    case "source_health_probe":
      return 0.07;
    case "restricted_darknet_metadata_sweep":
      return 0.04;
    case "background_refresh":
    case "broad_daily_sweep":
      return 0.02;
    case "interactive_search":
      return 0.01;
    case "interactive_live_search":
      return 0;
    default:
      return 0;
  }
}

function fairnessKeys(task: CollectionTask): string[] {
  return [
    `tenant:${task.tenantId ?? "global"}`,
    `request:${task.intelRequestId ?? "none"}`,
    `source:${task.sourceId}`,
    `adapter:${task.sourceType}`,
    `custom:${task.fairnessKey ?? "none"}`
  ];
}

function countBy(tasks: CollectionTask[], keyFor: (task: CollectionTask) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const task of tasks) {
    const key = keyFor(task);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function priorityBucket(task: CollectionTask): string {
  if (task.priority >= 0.5) return "critical";
  if (task.priority >= 0.6) return "high";
  if (task.priority >= 0.4) return "normal";
  return "low";
}

function ageBucket(task: CollectionTask, now: Date): string {
  const ageMs = Math.max(0, now.getTime() - Date.parse(task.queuedAt));
  if (ageMs < 5 * 60_000) return "lt_5m";
  if (ageMs < 30 * 60_000) return "5m_30m";
  if (ageMs < 2 * 60 * 60_000) return "30m_2h";
  return "gte_2h";
}

function starvationCount(tasks: CollectionTask[], now: Date, keyFor: (task: CollectionTask) => string): number {
  const latest = new Map<string, number>();
  for (const task of tasks) {
    latest.set(keyFor(task), Math.min(latest.get(keyFor(task)) ?? Number.POSITIVE_INFINITY, Date.parse(task.queuedAt)));
  }
  return [...latest.values()].filter((queuedAt) => now.getTime() - queuedAt > 2 * 60 * 60_000).length;
}

function riskPenalty(risk: FrontierCandidate["source"]["risk"]): number {
  if (risk === "restricted") return 1;
  if (risk === "high") return 0.25;
  if (risk === "medium") return 0.1;
  return 0;
}

function calculateAgingBoost(discoveredAt: string): number {
  const ageMs = Date.now() - Date.parse(discoveredAt);
  if (!Number.isFinite(ageMs) || ageMs <= 0) return 0;
  return clampScore(ageMs / (24 * 60 * 60 * 1000) * 0.1);
}

function frontierStrategyProfile(strategy: FrontierStrategy): HybridStrategyProfile {
  const weights = (
    link: number,
    parent: number,
    destination: number,
    sourceReputation: number,
    novelty: number,
    freshness: number,
    safetyPenalty: number,
    agingBoost: number
  ): HybridWeights => ({ link, parent, destination, sourceReputation, novelty, freshness, safetyPenalty, agingBoost });

  switch (strategy) {
    case "precision":
      return { selectedStrategy: "precision_dynamic", tradeoff: "precision", baseWeights: weights(0.22, 0.14, 0.34, 0.12, 0.06, 0.08, 0.48, 0.02), requireClassifierAgreement: true };
    case "recall":
      return { selectedStrategy: "recall_dynamic", tradeoff: "recall", baseWeights: weights(0.24, 0.24, 0.12, 0.16, 0.14, 0.12, 0.2, 0.05) };
    case "efficiency":
      return { selectedStrategy: "efficiency_dynamic", tradeoff: "efficiency", baseWeights: weights(0.38, 0.26, 0.02, 0.16, 0.08, 0.1, 0.3, 0.03) };
    case "link_only":
      return { selectedStrategy: "link_classifier_only", tradeoff: "efficiency", baseWeights: weights(0.72, 0, 0, 0.1, 0.08, 0.1, 0.28, 0.03) };
    case "parent_only":
      return { selectedStrategy: "parent_page_classifier_only", tradeoff: "efficiency", baseWeights: weights(0, 0.72, 0, 0.1, 0.08, 0.1, 0.28, 0.03) };
    case "destination_only":
      return { selectedStrategy: "destination_page_classifier_only", tradeoff: "precision", baseWeights: weights(0, 0, 0.72, 0.1, 0.08, 0.1, 0.4, 0.01), requireDestinationForEnqueue: true };
    case "link_parent":
      return { selectedStrategy: "link_parent_classifier", tradeoff: "efficiency", baseWeights: weights(0.42, 0.34, 0, 0.1, 0.06, 0.08, 0.28, 0.03) };
    case "link_destination":
      return { selectedStrategy: "link_destination_classifier", tradeoff: "precision", baseWeights: weights(0.34, 0, 0.38, 0.1, 0.08, 0.1, 0.38, 0.02), requireClassifierAgreement: true };
    case "parent_destination":
      return { selectedStrategy: "parent_destination_classifier", tradeoff: "balanced", baseWeights: weights(0, 0.36, 0.34, 0.12, 0.08, 0.1, 0.32, 0.02) };
    case "hybrid_dynamic":
      return { selectedStrategy: "hybrid_dynamic_classifier", tradeoff: "balanced", baseWeights: weights(0.28, 0.22, 0.22, 0.12, 0.08, 0.08, 0.3, 0.04) };
    case "balanced":
    default:
      return { selectedStrategy: "balanced_static_hybrid", tradeoff: "balanced", baseWeights: weights(0.3, 0.2, 0.12, 0.16, 0.1, 0.12, 0.28, 0.04) };
  }
}

function classifyFrontierText(
  classifier: HybridClassifierName,
  rawParts: Array<string | undefined>,
  url: string,
  priorScore?: number
): HybridClassifierOutput {
  const text = normalizeClassifierText(rawParts);
  const urlText = classifier === "link" ? normalizeClassifierText([url.replace(/^https?:\/\//, "").replace(/[/?#=&._-]+/g, " ")]) : "";
  const combined = `${text} ${urlText}`.trim();
  const markerText = `${rawParts.filter((part): part is string => typeof part === "string").join(" ")} ${classifier === "link" ? url : ""}`.trim();
  const matchedTerms = uniqueTerms([
    ...CTI_TERMS.filter((term) => includesTerm(combined, term)),
    ...ACTOR_TERMS.filter((term) => includesTerm(combined, term)),
    ...ACTION_TERMS.filter((term) => includesTerm(combined, term)),
    ...extractPatternMarkers(markerText)
  ]);
  const noiseMatches = NOISE_TERMS.filter((term) => includesTerm(combined, term)).length;
  const exactEntityBoost = Math.min(0.35, extractPatternMarkers(markerText).length * 0.12);
  const actorBoost = Math.min(0.25, ACTOR_TERMS.filter((term) => includesTerm(combined, term)).length * 0.08);
  const ctiBoost = Math.min(0.32, CTI_TERMS.filter((term) => includesTerm(combined, term)).length * 0.055);
  const actionBoost = Math.min(0.2, ACTION_TERMS.filter((term) => includesTerm(combined, term)).length * 0.045);
  const prior = priorScore === undefined ? 0 : clampScore(priorScore);
  const priorWeight = !text && priorScore !== undefined ? 1 : classifier === "destination" ? 0.45 : classifier === "parent" ? 0.38 : 0.18;
  const lexicalScore = clampScore(exactEntityBoost + actorBoost + ctiBoost + actionBoost - noiseMatches * 0.08);
  const score = clampScore(lexicalScore * (1 - priorWeight) + prior * priorWeight);
  const tokenCount = combined ? combined.split(/\s+/).length : 0;
  const confidence = clampScore(
    (tokenCount > 0 ? 0.18 : 0) +
    Math.min(0.36, tokenCount / 120) +
    Math.min(0.28, matchedTerms.length * 0.045) +
    (priorScore === undefined ? 0 : 0.18)
  );
  return {
    score,
    confidence,
    matchedTerms
  };
}

function adaptiveHybridWeights(
  profile: HybridStrategyProfile,
  classifiers: Record<HybridClassifierName, HybridClassifierOutput>,
  coverage: NonNullable<FrontierScore["classifier"]>["coverage"]
): HybridWeights {
  const weights = { ...profile.baseWeights };
  const classifierKeys: HybridClassifierName[] = ["link", "parent", "destination"];
  let missingWeight = 0;
  for (const key of classifierKeys) {
    const hasCoverage = key === "link" ? coverage.hasLinkContext : key === "parent" ? coverage.hasParentPage : coverage.hasDestinationPage;
    if (hasCoverage) continue;
    missingWeight += weights[key];
    weights[key] = 0;
  }
  const available = classifierKeys.filter((key) => weights[key] > 0);
  const confidenceTotal = available.reduce((sum, key) => sum + Math.max(0.1, classifiers[key].confidence), 0);
  for (const key of available) {
    weights[key] += missingWeight * (Math.max(0.1, classifiers[key].confidence) / Math.max(0.1, confidenceTotal));
  }
  if (profile.tradeoff === "precision" && coverage.hasDestinationPage && classifiers.destination.confidence >= 0.25) {
    const shift = Math.min(0.08, weights.link + weights.parent);
    weights.destination += shift;
    weights.link = Math.max(0, weights.link - shift / 2);
    weights.parent = Math.max(0, weights.parent - shift / 2);
  }
  if (profile.tradeoff === "efficiency" && coverage.hasLinkContext && classifiers.link.confidence >= 0.25) {
    const shift = Math.min(0.06, weights.destination);
    weights.link += shift;
    weights.destination = Math.max(0, weights.destination - shift);
  }
  return weights;
}

function classifierAgreementPenalty(
  profile: HybridStrategyProfile,
  classifiers: Record<HybridClassifierName, HybridClassifierOutput>,
  coverage: NonNullable<FrontierScore["classifier"]>["coverage"]
): number {
  if (!profile.requireClassifierAgreement) return 0;
  const active = ([
    ["link", coverage.hasLinkContext],
    ["parent", coverage.hasParentPage],
    ["destination", coverage.hasDestinationPage]
  ] as const)
    .filter(([, hasCoverage]) => hasCoverage)
    .map(([key]) => classifiers[key]);
  if (active.length < 2) return 0.04;
  const highSignals = active.filter((item) => item.score >= 0.55).length;
  if (highSignals >= 2) return 0;
  const spread = Math.max(...active.map((item) => item.score)) - Math.min(...active.map((item) => item.score));
  return spread > 0.35 ? 0.08 : 0.04;
}

function emptyClassifierOutput(): HybridClassifierOutput {
  return {
    score: 0,
    confidence: 0,
    matchedTerms: []
  };
}

function normalizeClassifierText(parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesTerm(text: string, term: string): boolean {
  if (!text) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function extractPatternMarkers(text: string): string[] {
  const cves = [...text.matchAll(/\bcve[-\s](\d{4})[-\s](\d{4,7})\b/gi)].map((match) => `cve-${match[1]}-${match[2]}`);
  return uniqueTerms([
    ...cves,
    ...(text.match(/\bcve-\d{4}-\d{4,7}\b/gi) ?? []),
    ...(text.match(/\bapt\d{1,4}\b/gi) ?? []),
    ...(text.match(/\bttps?\b/gi) ?? []),
    ...(text.match(/\biocs?\b/gi) ?? [])
  ]);
}

function uniqueTerms(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function defaultFrontierReviewThreshold(strategy: FrontierStrategy): number {
  if (strategy === "precision" || strategy === "destination_only" || strategy === "link_destination") return 0.23;
  if (strategy === "recall") return 0.2;
  if (strategy === "efficiency" || strategy === "link_only" || strategy === "parent_only" || strategy === "link_parent") return 0.28;
  return 0.25;
}

function defaultEnqueueThreshold(strategy: FrontierStrategy): number {
  if (strategy === "precision") return 0.55;
  if (strategy === "destination_only" || strategy === "link_destination") return 0.61;
  if (strategy === "recall") return 0.35;
  if (strategy === "efficiency" || strategy === "link_only" || strategy === "parent_only" || strategy === "link_parent") return 0.42;
  return 0.4;
}

function stableJitter(delayMs: number, key: string): number {
  const spread = Math.floor(delayMs * 0.15);
  if (spread <= 0) return delayMs;
  return delayMs - spread + (Number(Bun.hash(key)) % (spread * 2 + 1));
}

function taskToCandidate(task: CollectionTask): FrontierCandidate {
  return {
    source: {
      id: task.sourceId,
      name: task.sourceId,
      type: task.sourceType,
      url: task.targetUrl,
      accessMethod: "manual_seed",
      status: "active",
      risk: "low",
      trustScore: task.priority,
      crawlFrequencySeconds: 3600,
      legalNotes: "Retry task reconstructed from scheduler state.",
      createdAt: task.queuedAt,
      updatedAt: task.queuedAt
    },
    url: task.targetUrl,
    discoveredAt: task.queuedAt,
    parentUrl: task.parentUrl,
    tenantId: task.tenantId,
    intelRequestId: task.intelRequestId,
    budgetKey: task.crawlBudgetKey,
    fairnessKey: task.fairnessKey,
    maxBytes: task.maxBytes
  };
}

function fallbackScore(task: CollectionTask, strategy: FrontierStrategy): FrontierScore {
  const profile = frontierStrategyProfile(strategy);
  return {
    total: task.priority,
    linkContext: 0,
    parentRelevance: 0,
    destinationRelevance: 0,
    sourceReputation: 0,
    novelty: 0,
    freshness: 0,
    safetyPenalty: 0,
    agingBoost: 0,
    strategy,
    decision: "enqueue",
    reason: task.reason,
    classifier: {
      strategy,
      selectedStrategy: profile.selectedStrategy,
      link: emptyClassifierOutput(),
      parent: emptyClassifierOutput(),
      destination: emptyClassifierOutput(),
      weights: profile.baseWeights,
      coverage: {
        hasLinkContext: false,
        hasParentPage: false,
        hasDestinationPage: false
      },
      tradeoff: profile.tradeoff
    }
  };
}
