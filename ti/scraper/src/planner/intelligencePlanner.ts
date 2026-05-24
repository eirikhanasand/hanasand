import { FocusedFrontier } from "../frontier/frontier.ts";
import { actorAliasesFor, ACTOR_ALIAS_RECORDS } from "../pipeline/actorAliases.ts";
import { evaluateSourceForCollection } from "../policy/collectionPolicy.ts";
import type {
  AuditEvent,
  CollectionPlan,
  CollectionTask,
  FrontierScore,
  IntelligenceRequest,
  LiveSearchBackpressureState,
  LiveSearchPlannerDto,
  LiveSearchZeroTaskReason,
  PlannerDecision,
  PlanningBudgetClass,
  CollectionRun,
  SourceRecord,
  TaskPlanningMetadata
} from "../types.ts";
import { clampScore, nowIso, stableId } from "../utils.ts";

interface BudgetProfile {
  class: PlanningBudgetClass;
  maxTasks: number;
  immediateTaskLimit: number;
  maxBytesPerTask: number;
  deadlineMs: number;
  backgroundDelayMs?: number;
  includeDarknetMetadata?: boolean;
}

const BUDGETS: Record<PlanningBudgetClass, BudgetProfile> = {
  interactive_live_search: {
    class: "interactive_live_search",
    maxTasks: 10,
    immediateTaskLimit: 3,
    maxBytesPerTask: 192_000,
    deadlineMs: 30_000,
    backgroundDelayMs: 45_000
  },
  interactive_search: {
    class: "interactive_search",
    maxTasks: 12,
    immediateTaskLimit: 4,
    maxBytesPerTask: 256_000,
    deadlineMs: 60_000,
    backgroundDelayMs: 90_000
  },
  analyst_deep_dive: {
    class: "analyst_deep_dive",
    maxTasks: 60,
    immediateTaskLimit: 20,
    maxBytesPerTask: 1_000_000,
    deadlineMs: 20 * 60_000,
    backgroundDelayMs: 2 * 60_000
  },
  background_refresh: {
    class: "background_refresh",
    maxTasks: 40,
    immediateTaskLimit: 40,
    maxBytesPerTask: 512_000,
    deadlineMs: 60 * 60_000
  },
  broad_daily_sweep: {
    class: "broad_daily_sweep",
    maxTasks: 200,
    immediateTaskLimit: 80,
    maxBytesPerTask: 512_000,
    deadlineMs: 6 * 60 * 60_000,
    backgroundDelayMs: 5 * 60_000
  },
  source_health_probe: {
    class: "source_health_probe",
    maxTasks: 25,
    immediateTaskLimit: 25,
    maxBytesPerTask: 64_000,
    deadlineMs: 10 * 60_000
  },
  restricted_darknet_metadata_sweep: {
    class: "restricted_darknet_metadata_sweep",
    maxTasks: 30,
    immediateTaskLimit: 8,
    maxBytesPerTask: 64_000,
    deadlineMs: 30 * 60_000,
    backgroundDelayMs: 5 * 60_000,
    includeDarknetMetadata: true
  }
};

export function createCollectionPlan(
  input: IntelligenceRequest,
  sources: SourceRecord[],
  frontier = new FocusedFrontier()
): CollectionPlan {
  const createdAt = input.createdAt ?? nowIso();
  const budgetProfile = budgetProfileFor(input);
  const request = {
    id: input.id ?? stableId("intel", `${input.entityType}:${input.query}:${createdAt}`),
    tenantId: input.tenantId,
    query: input.query,
    entityType: input.entityType,
    includeClearWeb: input.includeClearWeb ?? true,
    includeTelegram: input.includeTelegram ?? true,
    includeDarknetMetadata: input.includeDarknetMetadata ?? budgetProfile.includeDarknetMetadata ?? false,
    maxTasks: Math.min(input.maxTasks ?? budgetProfile.maxTasks, budgetProfile.maxTasks),
    createdAt,
    requesterId: input.requesterId,
    priority: input.priority ?? "normal",
    reason: input.reason,
    budgetClass: budgetProfile.class
  };
  const deadlineAt = new Date(Date.parse(createdAt) + budgetProfile.deadlineMs).toISOString();
  const backgroundAvailableAt = budgetProfile.backgroundDelayMs
    ? new Date(Date.parse(createdAt) + budgetProfile.backgroundDelayMs).toISOString()
    : undefined;
  const queryTerms = expandQueryTerms(request.query, request.entityType);

  const tasks: CollectionTask[] = [];
  const reviewRequired: CollectionTask[] = [];
  const rejected: Array<{ sourceId: string; reason: string }> = [];
  const explanations: PlannerDecision[] = [];
  const seenTargets = new Set<string>();

  for (const source of rankedSources(sources, request.query, queryTerms, createdAt)) {
    if (!sourceMatchesScope(source, request)) {
      explanations.push(decision(source, "skipped", "source is outside request scope", { budgetClass: budgetProfile.class, queryTerms }));
      continue;
    }

    const policy = evaluateSourceForCollection(source);
    if (!policy.allowed) {
      const status = policy.reason.includes("approval") ? "blocked-by-approval" : "blocked-by-policy";
      if (policy.metadataOnly) {
        if (tasks.length + reviewRequired.length >= request.maxTasks) {
          explanations.push(decision(source, "skipped", "request task budget exhausted", { budgetClass: budgetProfile.class, queryTerms }));
          continue;
        }

        const targetUrl = buildSourceQueryTarget(source, queryTerms[0] ?? request.query);
        const dedupeKey = `${source.id}:${targetUrl}:metadata-review`;
        if (seenTargets.has(dedupeKey)) {
          explanations.push(decision(source, "duplicate-suppressed", "duplicate metadata-only review target suppressed", { targetUrl, budgetClass: budgetProfile.class, queryTerms }));
          continue;
        }
        seenTargets.add(dedupeKey);

        const reviewTask = buildMetadataOnlyReviewTask({
          requestId: request.id,
          tenantId: request.tenantId,
          source,
          targetUrl,
          createdAt,
          deadlineAt,
          maxBytes: Math.min(budgetProfile.maxBytesPerTask, 64_000),
          budgetClass: budgetProfile.class,
          queryTerms,
          reason: policy.reason
        });
        reviewRequired.push(reviewTask);
        explanations.push(decision(source, status, policy.reason, { targetUrl, task: reviewTask, budgetClass: budgetProfile.class, queryTerms }));
        continue;
      }
      explanations.push(decision(source, status, policy.reason, { budgetClass: budgetProfile.class, queryTerms }));
      rejected.push({ sourceId: source.id, reason: policy.reason });
      continue;
    }

    if (tasks.length + reviewRequired.length >= request.maxTasks) {
      explanations.push(decision(source, "skipped", "request task budget exhausted", { budgetClass: budgetProfile.class, queryTerms }));
      continue;
    }

    const targetUrl = buildSourceQueryTarget(source, queryTerms[0] ?? request.query);
    const dedupeKey = `${source.id}:${targetUrl}`;
    if (seenTargets.has(dedupeKey)) {
      explanations.push(decision(source, "duplicate-suppressed", "duplicate source target suppressed", { targetUrl, budgetClass: budgetProfile.class, queryTerms }));
      continue;
    }
    seenTargets.add(dedupeKey);

    const freshness = sourceFreshness(source, createdAt);
    const backoffUntil = source.crawlState?.backoffUntil;
    const waitingForBackoff = Boolean(backoffUntil && Date.parse(backoffUntil) > Date.parse(createdAt));
    const selectedFor = source.type.endsWith("_metadata") ? "metadata" : tasks.length < budgetProfile.immediateTaskLimit ? "interactive" : "background";
    const availableAt = waitingForBackoff
      ? backoffUntil
      : selectedFor === "background"
        ? backgroundAvailableAt
        : undefined;

    const score = frontier.score({
      source,
      url: targetUrl,
      discoveredAt: createdAt,
      tenantId: request.tenantId,
      intelRequestId: request.id,
      anchorText: queryTerms.join(" "),
      surroundingText: `${request.entityType} intelligence ${queryTerms.join(" ")}`,
      parentRelevance: source.trustScore,
      novelty: sourceNovelty(source),
      freshness,
      budgetKey: request.id,
      fairnessKey: `${request.tenantId ?? "global"}:${request.id}:${source.type}`,
      maxBytes: budgetProfile.maxBytesPerTask
    });

    const task = buildTask({
      requestId: request.id,
      tenantId: request.tenantId,
      source,
      targetUrl,
      createdAt,
      deadlineAt,
      availableAt,
      maxBytes: budgetProfile.maxBytesPerTask,
      budgetClass: budgetProfile.class,
      queryTerms,
      score,
      freshness,
      selectedFor
    });

    if (waitingForBackoff) {
      tasks.push(task);
      explanations.push(decision(source, "waiting-for-backoff", "source backoff is active; task delayed", {
        targetUrl,
        task,
        availableAt,
        budgetClass: budgetProfile.class,
        queryTerms
      }));
    } else if (score.decision === "enqueue") {
      tasks.push(task);
      explanations.push(decision(source, availableAt ? "delayed" : "selected", availableAt ? "queued as deeper background work" : "selected by relevance, freshness, trust, and budget", {
        targetUrl,
        task,
        availableAt,
        budgetClass: budgetProfile.class,
        queryTerms
      }));
    } else if (score.decision === "review") {
      reviewRequired.push(task);
      explanations.push(decision(source, "blocked-by-approval", score.reason, { targetUrl, task, budgetClass: budgetProfile.class, queryTerms }));
    } else {
      rejected.push({ sourceId: source.id, reason: score.reason });
      explanations.push(decision(source, "skipped", score.reason, { targetUrl, budgetClass: budgetProfile.class, queryTerms }));
    }

  }

  tasks.sort((a, b) =>
    Number(Boolean(a.availableAt)) - Number(Boolean(b.availableAt))
    || b.priority - a.priority
    || (a.availableAt ?? "").localeCompare(b.availableAt ?? "")
  );
  reviewRequired.sort((a, b) => b.priority - a.priority);

  return {
    id: request.id,
    tenantId: request.tenantId,
    request,
    tasks,
    reviewRequired,
    rejected,
    explanations,
    queryTerms,
    budget: {
      class: budgetProfile.class,
      maxTasks: request.maxTasks,
      immediateTaskLimit: budgetProfile.immediateTaskLimit,
      maxBytesPerTask: budgetProfile.maxBytesPerTask,
      deadlineAt,
      backgroundAvailableAt
    },
    audit: buildPlanAudit(request.id, request.tenantId, request.requesterId, tasks.length, reviewRequired.length, rejected.length, createdAt)
  };
}

export function createLiveSearchPlan(input: {
  request: IntelligenceRequest;
  sources: SourceRecord[];
  activeRuns?: CollectionRun[];
  activePlans?: CollectionPlan[];
  frontier?: FocusedFrontier;
  queryDemand?: Record<string, number>;
  queuePressureLimit?: number;
}): { plan: CollectionPlan; dto: LiveSearchPlannerDto } {
  const request: IntelligenceRequest = {
    ...input.request,
    budgetClass: "interactive_live_search",
    priority: input.request.priority ?? "urgent",
    maxTasks: input.request.maxTasks ?? BUDGETS.interactive_live_search.maxTasks
  };
  const plan = createCollectionPlan(request, input.sources, input.frontier ?? new FocusedFrontier({ strategy: "balanced" }));
  const reuseKey = liveSearchReuseKey(plan.request, input.sources, plan.queryTerms ?? [plan.request.query]);
  const activeRun = findActiveRunForPlan(plan, input.activeRuns ?? [], input.activePlans ?? [], reuseKey);
  const zeroTaskReason = zeroTaskReasonFor(plan, activeRun);
  const blockedSourceCount = plan.explanations?.filter((item) =>
    item.status === "blocked-by-policy" || item.status === "blocked-by-approval"
  ).length ?? 0;
  const skippedTaskCount = plan.explanations?.filter((item) =>
    item.status === "skipped" || item.status === "duplicate-suppressed"
  ).length ?? 0;
  const recommendedSourceActivations = recommendedSourceActivationsFor(plan, input.sources, input.queryDemand);
  const backpressure = backpressureFor(plan, {
    activeRun,
    zeroTaskReason,
    frontier: input.frontier,
    recommendedSourceActivations,
    queuePressureLimit: input.queuePressureLimit
  });

  return {
    plan,
    dto: {
      mode: "interactive_live_search",
      planId: plan.id,
      reuseKey,
      activeRunId: activeRun?.id,
      attachedToActiveRun: Boolean(activeRun),
      backpressureState: backpressure.state,
      backpressureReason: backpressure.reason,
      retryAfterSeconds: backpressure.retryAfterSeconds,
      queuedTaskCount: plan.tasks.length,
      reviewTaskCount: plan.reviewRequired.length,
      blockedSourceCount,
      skippedTaskCount,
      nextPollSeconds: nextPollSecondsFor(plan, activeRun, backpressure.state),
      zeroTaskReason,
      coverageGaps: coverageGapsFor(plan),
      recommendedSourceActivations,
      decisions: plan.explanations ?? [],
      queryTerms: plan.queryTerms ?? [plan.request.query]
    }
  };
}

interface PlannerScope {
  includeClearWeb: boolean;
  includeTelegram: boolean;
  includeDarknetMetadata: boolean;
}

function budgetProfileFor(input: IntelligenceRequest): BudgetProfile {
  if (input.budgetClass) return BUDGETS[input.budgetClass];
  if (input.includeDarknetMetadata && input.priority !== "urgent") return BUDGETS.restricted_darknet_metadata_sweep;
  if (input.priority === "urgent") return BUDGETS.interactive_search;
  if (input.priority === "high") return BUDGETS.analyst_deep_dive;
  return BUDGETS.background_refresh;
}

function expandQueryTerms(query: string, entityType: IntelligenceRequest["entityType"]): string[] {
  const normalized = query.trim();
  const terms = new Set<string>([normalized]);
  if (entityType === "actor" || entityType === "alias" || entityType === "free_text") {
    const record = ACTOR_ALIAS_RECORDS.find((candidate) =>
      candidate.canonical.toLowerCase() === normalized.toLowerCase()
      || candidate.aliases.includes(normalized.toLowerCase())
    );
    if (record) {
      terms.add(record.canonical);
      for (const alias of actorAliasesFor(record.canonical)) terms.add(alias);
    }
  }

  if (entityType === "cve" || entityType === "indicator") terms.add(normalized.toUpperCase());
  return [...terms].filter(Boolean).slice(0, 12);
}

export function liveSearchReuseKey(request: IntelligenceRequest, sources: SourceRecord[], queryTerms: string[]): string {
  const terms = reuseQueryTerms(request.query, request.entityType, queryTerms);
  const scopedSources = sources.filter((source) => sourceMatchesScope(source, {
    includeClearWeb: request.includeClearWeb ?? true,
    includeTelegram: request.includeTelegram ?? true,
    includeDarknetMetadata: request.includeDarknetMetadata ?? false
  }));
  const sourceScope = [...new Set(scopedSources.map((source) => source.type))].sort();
  const riskScope = [...new Set(scopedSources.map((source) => source.risk))].sort();
  const freshnessWindow = hourlyFreshnessWindow(request.createdAt ?? nowIso());
  return stableId("live-reuse", JSON.stringify({
    tenantId: request.tenantId ?? "global",
    entityType: request.entityType,
    terms,
    sourceScope,
    riskScope,
    freshnessWindow
  }));
}

function findActiveRunForPlan(plan: CollectionPlan, runs: CollectionRun[], plans: CollectionPlan[], reuseKey: string): CollectionRun | undefined {
  const planByRequestId = new Map(plans.map((candidate) => [candidate.request.id, candidate]));
  return runs.find((run) =>
    run.tenantId === plan.tenantId
    && (run.status === "queued" || run.status === "running")
    && run.requestHash === reuseKey
  ) ?? runs.find((run) =>
    run.tenantId === plan.tenantId
    && (run.status === "queued" || run.status === "running")
    && run.requestId === plan.request.id
  ) ?? runs.find((run) =>
    run.tenantId === plan.tenantId
    && (run.status === "queued" || run.status === "running")
    && planByRequestId.get(run.requestId)?.request.query.toLowerCase() === plan.request.query.toLowerCase()
    && planByRequestId.get(run.requestId)?.request.entityType === plan.request.entityType
  );
}

function zeroTaskReasonFor(plan: CollectionPlan, activeRun: CollectionRun | undefined): LiveSearchZeroTaskReason {
  if (activeRun) return "duplicate_run_already_active";
  if (plan.tasks.length > 0 || plan.reviewRequired.length > 0) return "none";
  const explanations = plan.explanations ?? [];
  if (isQueryTooBroad(plan.request.query)) return "query_too_broad";
  if (explanations.length === 0) return "no_approved_sources";
  if (explanations.every((item) => item.status === "waiting-for-backoff" || item.status === "delayed")) return "all_sources_stale_or_backoff";
  if (explanations.every((item) => item.status === "blocked-by-policy" || item.status === "blocked-by-approval")) return "all_sources_blocked_by_risk";
  if (explanations.every((item) => item.reason.includes("disabled") || item.reason.includes("outside request scope"))) return "adapter_disabled";
  if (explanations.every((item) => item.reason.includes("budget"))) return "tenant_budget_exhausted";
  return "no_approved_sources";
}

function isQueryTooBroad(query: string): boolean {
  return query.trim().length < 3 || /^(apt|ransomware|malware|cve|threat|actor|victim)$/i.test(query.trim());
}

function nextPollSecondsFor(plan: CollectionPlan, activeRun: CollectionRun | undefined, state: LiveSearchBackpressureState): number {
  if (activeRun) return 5;
  if (state === "deferred_by_queue_pressure") return 30;
  if (state === "deferred_by_budget") return 60;
  if (state === "needs_source_activation" || state === "blocked_by_policy") return 60;
  if (plan.tasks.some((task) => task.planning?.selectedFor === "interactive")) return 3;
  if (plan.tasks.some((task) => task.availableAt)) return 15;
  return 30;
}

function coverageGapsFor(plan: CollectionPlan): string[] {
  const tasks = plan.tasks;
  const gaps = new Set<string>();
  if (!tasks.some((task) => task.sourceType === "rss" || task.sourceType === "static_web" || task.sourceType === "api")) {
    gaps.add("clear_web");
  }
  if (plan.request.includeTelegram && !tasks.some((task) => task.sourceType === "telegram_public")) {
    gaps.add("public_chat");
  }
  if (plan.request.includeDarknetMetadata && !tasks.some((task) => task.sourceType.endsWith("_metadata"))) {
    gaps.add("darknet_metadata");
  }
  if ((plan.explanations ?? []).some((item) => item.status === "waiting-for-backoff")) {
    gaps.add("freshness_waiting_for_backoff");
  }
  return [...gaps];
}

function backpressureFor(plan: CollectionPlan, input: {
  activeRun?: CollectionRun;
  zeroTaskReason: LiveSearchZeroTaskReason;
  frontier?: FocusedFrontier;
  recommendedSourceActivations: LiveSearchPlannerDto["recommendedSourceActivations"];
  queuePressureLimit?: number;
}): { state: LiveSearchBackpressureState; reason?: string; retryAfterSeconds?: number } {
  if (input.activeRun) {
    return {
      state: "attached_to_active_run",
      reason: `attached to active run ${input.activeRun.id}`,
      retryAfterSeconds: 5
    };
  }

  if (input.zeroTaskReason === "tenant_budget_exhausted") {
    return { state: "deferred_by_budget", reason: "live-search task budget is exhausted", retryAfterSeconds: 60 };
  }

  const queuePressureLimit = input.queuePressureLimit ?? 1_000;
  const queueDepth = input.frontier?.groupedSnapshot().queued ?? 0;
  if (queueDepth >= queuePressureLimit) {
    return { state: "deferred_by_queue_pressure", reason: `frontier queue depth ${queueDepth} exceeds live-search pressure limit ${queuePressureLimit}`, retryAfterSeconds: 30 };
  }

  if (input.zeroTaskReason === "all_sources_stale_or_backoff" || (plan.tasks.length > 0 && plan.tasks.some((task) => Boolean(task.availableAt)))) {
    return { state: "deferred_by_source_backoff", reason: "one or more matching sources are delayed by crawl backoff or background freshness windows", retryAfterSeconds: 15 };
  }

  if (input.zeroTaskReason === "all_sources_blocked_by_risk" && input.recommendedSourceActivations.some((item) => !item.reason.includes("restricted"))) {
    return { state: "needs_source_activation", reason: "matching sources need approval, restore, or adapter activation", retryAfterSeconds: 60 };
  }

  if (input.zeroTaskReason === "all_sources_blocked_by_risk") {
    return { state: "blocked_by_policy", reason: "matching sources are blocked by policy or approval requirements", retryAfterSeconds: 60 };
  }

  if (plan.tasks.length === 0 && input.recommendedSourceActivations.length > 0) {
    return { state: "needs_source_activation", reason: "matching sources need approval, restore, or adapter activation", retryAfterSeconds: 60 };
  }

  if (input.zeroTaskReason === "no_approved_sources" || input.zeroTaskReason === "adapter_disabled") {
    return { state: "needs_source_activation", reason: "no approved active source currently covers this query", retryAfterSeconds: 60 };
  }

  return { state: "accepted" };
}

function recommendedSourceActivationsFor(plan: CollectionPlan, sources: SourceRecord[], queryDemand: Record<string, number> = {}): LiveSearchPlannerDto["recommendedSourceActivations"] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const gaps = coverageGapsFor(plan);
  const demandCount = demandFor(plan.queryTerms ?? [plan.request.query], queryDemand);
  return (plan.explanations ?? [])
    .filter((item) => item.status === "blocked-by-approval" || item.status === "blocked-by-policy" || item.reason.includes("outside request scope"))
    .map((item) => {
      const source = sourceById.get(item.sourceId);
      const coverageGap = activationCoverageGap(source);
      const action: LiveSearchPlannerDto["recommendedSourceActivations"][number]["requiredAction"] = source?.accessMethod === "disabled"
        ? "enable_adapter"
        : source?.status === "paused" || source?.status === "disabled" || source?.status === "quarantined"
          ? "restore"
          : source?.status === "candidate" || source?.status === "needs_review" || source?.approvalRequired
            ? "approve"
            : "add_source";
      const gapBoost = coverageGap && gaps.includes(coverageGap) ? 30 : 0;
      const actionBoost = action === "enable_adapter" ? 20 : action === "approve" ? 15 : action === "restore" ? 10 : 5;
      return {
        sourceId: item.sourceId,
        reason: item.reason,
        requiredAction: action,
        priority: demandCount * 10 + gapBoost + actionBoost,
        coverageGap,
        demandCount
      };
    })
    .sort((a, b) => b.priority - a.priority || a.sourceId.localeCompare(b.sourceId))
    .slice(0, 10);
}

function reuseQueryTerms(query: string, entityType: IntelligenceRequest["entityType"], queryTerms: string[]): string[] {
  const normalized = query.trim().toLowerCase();
  if (entityType === "actor" || entityType === "alias" || entityType === "free_text") {
    const record = ACTOR_ALIAS_RECORDS.find((candidate) =>
      candidate.canonical.toLowerCase() === normalized
      || candidate.aliases.includes(normalized)
      || queryTerms.some((term) => candidate.aliases.includes(term.toLowerCase()))
    );
    if (record) return [record.canonical, ...actorAliasesFor(record.canonical)].map((term) => term.toLowerCase()).sort();
  }
  return [...new Set(queryTerms.map((term) => term.trim().toLowerCase()).filter(Boolean))].sort();
}

function hourlyFreshnessWindow(createdAt: string): string {
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) return "unknown";
  return new Date(Math.floor(timestamp / 3_600_000) * 3_600_000).toISOString();
}

function demandFor(queryTerms: string[], queryDemand: Record<string, number>): number {
  const normalizedDemand = new Map(Object.entries(queryDemand).map(([key, value]) => [key.toLowerCase(), value]));
  return Math.max(1, ...queryTerms.map((term) => normalizedDemand.get(term.toLowerCase()) ?? 0));
}

function activationCoverageGap(source: SourceRecord | undefined): string | undefined {
  if (!source) return undefined;
  if (source.type === "telegram_public") return "public_chat";
  if (source.type.endsWith("_metadata")) return "darknet_metadata";
  if (source.type === "rss" || source.type === "static_web" || source.type === "dynamic_web" || source.type === "api" || source.type === "pdf") {
    return "clear_web";
  }
  return undefined;
}

function rankedSources(sources: SourceRecord[], query: string, queryTerms: string[], now: string): SourceRecord[] {
  return [...sources].sort((a, b) =>
    sourcePlanScore(b, query, queryTerms, now) - sourcePlanScore(a, query, queryTerms, now)
    || a.id.localeCompare(b.id)
  );
}

function sourcePlanScore(source: SourceRecord, query: string, queryTerms: string[], now: string): number {
  const text = `${source.name} ${source.url} ${(source.tags ?? []).join(" ")} ${JSON.stringify(source.metadata ?? {})}`.toLowerCase();
  const relevance = queryTerms.some((term) => text.includes(term.toLowerCase())) ? 0.2 : 0;
  const typeBoost = source.type === "api" ? 0.08 : source.type === "rss" ? 0.06 : source.type === "telegram_public" ? 0.04 : 0;
  return clampScore(source.trustScore * 0.45 + sourceFreshness(source, now) * 0.3 + sourceNovelty(source) * 0.15 + relevance + typeBoost);
}

function sourceMatchesScope(source: SourceRecord, request: PlannerScope): boolean {
  if (source.type === "telegram_public") return request.includeTelegram;
  if (source.type.endsWith("_metadata")) return request.includeDarknetMetadata;
  if (source.type === "rss" || source.type === "static_web" || source.type === "dynamic_web" || source.type === "api" || source.type === "pdf") {
    return request.includeClearWeb;
  }
  return request.includeClearWeb;
}

function buildSourceQueryTarget(source: SourceRecord, query: string): string {
  if (source.url.includes("{query}")) return source.url.replaceAll("{query}", encodeURIComponent(query));
  return source.url;
}

function sourceFreshness(source: SourceRecord, now: string): number {
  const reference = source.crawlState?.lastCollectedAt ?? source.lastSeenAt ?? source.health?.lastSuccessAt;
  if (!reference) return 0.55;
  const ageMs = Math.max(0, Date.parse(now) - Date.parse(reference));
  if (!Number.isFinite(ageMs)) return 0.55;
  return clampScore(1 - ageMs / (14 * 24 * 60 * 60_000));
}

function sourceNovelty(source: SourceRecord): number {
  if (!source.crawlState?.lastCollectedAt && !source.lastSeenAt) return 0.75;
  if (source.health?.status === "failing") return 0.2;
  return 0.55;
}

function buildTask(input: {
  requestId: string;
  tenantId?: string;
  source: SourceRecord;
  targetUrl: string;
  createdAt: string;
  deadlineAt: string;
  availableAt?: string;
  maxBytes: number;
  budgetClass: PlanningBudgetClass;
  queryTerms: string[];
  score: FrontierScore;
  freshness: number;
  selectedFor: TaskPlanningMetadata["selectedFor"];
}): CollectionTask {
  return {
    id: stableId("task", `${input.requestId}:${input.source.id}:${input.targetUrl}`),
    tenantId: input.tenantId,
    sourceId: input.source.id,
    sourceType: input.source.type,
    targetUrl: input.targetUrl,
    queuedAt: input.createdAt,
    availableAt: input.availableAt,
    deadlineAt: input.deadlineAt,
    priority: input.score.total,
    reason: `intel request ${input.queryTerms[0] ?? input.targetUrl}: ${input.score.reason}`,
    retryCount: 0,
    maxRetries: input.budgetClass === "interactive_search" ? 1 : 3,
    maxBytes: input.maxBytes,
    intelRequestId: input.requestId,
    crawlBudgetKey: input.requestId,
    sourceConcurrencyKey: input.source.id,
    fairnessKey: `${input.tenantId ?? "global"}:${input.requestId}:${input.source.type}`,
    scoreBreakdown: input.score,
    planning: {
      budgetClass: input.budgetClass,
      decision: input.availableAt ? "delayed" : "selected",
      reason: input.score.reason,
      queryTerms: input.queryTerms,
      freshness: input.freshness,
      freshnessTargetSeconds: input.source.crawlFrequencySeconds,
      maxCost: {
        tasks: 1,
        bytes: input.maxBytes
      },
      safetyEnvelope: {
        allowClearWeb: !input.source.type.endsWith("_metadata"),
        allowPublicChannel: input.source.type === "telegram_public",
        allowRestrictedMetadata: input.source.type.endsWith("_metadata") && input.source.governance?.approvalState === "approved",
        metadataOnlyRestricted: input.source.type.endsWith("_metadata"),
        forbiddenOperations: input.source.type.endsWith("_metadata")
          ? ["payload_download", "credential_bypass", "captcha_solving", "private_community_access"]
          : ["credential_bypass", "captcha_solving", "private_community_access"]
      },
      sourceTrust: input.source.trustScore,
      selectedFor: input.selectedFor
    }
  };
}

function buildMetadataOnlyReviewTask(input: {
  requestId: string;
  tenantId?: string;
  source: SourceRecord;
  targetUrl: string;
  createdAt: string;
  deadlineAt: string;
  maxBytes: number;
  budgetClass: PlanningBudgetClass;
  queryTerms: string[];
  reason: string;
}): CollectionTask {
  return {
    id: stableId("task", `${input.requestId}:${input.source.id}:${input.targetUrl}:metadata-review`),
    tenantId: input.tenantId,
    sourceId: input.source.id,
    sourceType: input.source.type,
    targetUrl: input.targetUrl,
    queuedAt: input.createdAt,
    deadlineAt: input.deadlineAt,
    priority: clampScore(input.source.trustScore * 0.9),
    reason: `metadata-only review for ${input.queryTerms[0] ?? input.targetUrl}: ${input.reason}; capture allowed fields only (actor, victim/company, affected accounts, dataset size, actor statement, timestamps, hashes, provenance)`,
    retryCount: 0,
    maxRetries: 0,
    maxBytes: input.maxBytes,
    intelRequestId: input.requestId,
    crawlBudgetKey: input.requestId,
    sourceConcurrencyKey: input.source.id,
    fairnessKey: `${input.tenantId ?? "global"}:${input.requestId}:${input.source.type}:metadata-review`,
    planning: {
      budgetClass: input.budgetClass,
      decision: input.reason.includes("approval") ? "blocked-by-approval" : "blocked-by-policy",
      reason: input.reason,
      queryTerms: input.queryTerms,
      freshness: sourceFreshness(input.source, input.createdAt),
      freshnessTargetSeconds: input.source.crawlFrequencySeconds,
      maxCost: {
        tasks: 1,
        bytes: input.maxBytes
      },
      safetyEnvelope: {
        allowClearWeb: false,
        allowPublicChannel: false,
        allowRestrictedMetadata: false,
        metadataOnlyRestricted: true,
        forbiddenOperations: ["payload_download", "credential_bypass", "captcha_solving", "private_community_access", "threat_actor_interaction"]
      },
      sourceTrust: input.source.trustScore,
      selectedFor: "metadata"
    }
  };
}

function decision(
  source: SourceRecord,
  status: PlannerDecision["status"],
  reason: string,
  options: {
    targetUrl?: string;
    task?: CollectionTask;
    availableAt?: string;
    budgetClass?: PlanningBudgetClass;
    queryTerms?: string[];
  }
): PlannerDecision {
  return {
    sourceId: source.id,
    status,
    reason,
    targetUrl: options.targetUrl,
    taskId: options.task?.id,
    priority: options.task?.priority,
    availableAt: options.availableAt,
    budgetClass: options.budgetClass,
    queryTerms: options.queryTerms
  };
}

function buildPlanAudit(
  requestId: string,
  tenantId: string | undefined,
  actorId: string | undefined,
  tasks: number,
  reviewRequired: number,
  rejected: number,
  occurredAt: string
): AuditEvent[] {
  return [{
    id: stableId("audit", `${requestId}:plan:${occurredAt}`),
    tenantId,
    actorId,
    action: "intel.plan.created",
    subjectType: "intelligence_request",
    subjectId: requestId,
    occurredAt,
    metadata: { tasks, reviewRequired, rejected }
  }];
}
