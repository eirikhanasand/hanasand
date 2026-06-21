// @ts-nocheck
import { FocusedFrontier } from "../frontier/frontier.ts";
import { actorAliasesFor, ACTOR_ALIAS_RECORDS } from "../pipeline/actorAliases.ts";
import { clampScore, nowIso, stableId } from "../utils.ts";

const BUDGETS = {
  interactive_live_search: [10, 3, 192_000, 30_000, 45_000],
  interactive_search: [12, 4, 256_000, 60_000, 90_000],
  analyst_deep_dive: [60, 20, 1_000_000, 1_200_000, 120_000],
  public_channel_window: [40, 12, 256_000, 180_000, 45_000],
  public_channel_probe: [20, 6, 192_000, 120_000, 30_000],
  background_refresh: [40, 40, 512_000, 3_600_000],
  broad_daily_sweep: [200, 80, 512_000, 21_600_000, 300_000],
  source_health_probe: [25, 25, 64_000, 600_000],
  restricted_darknet_metadata_sweep: [30, 8, 64_000, 1_800_000, 300_000, true]
};

export function createCollectionPlan(input, sources, frontier = new FocusedFrontier()): any {
  const createdAt = input.createdAt ?? nowIso();
  const budget = profile(input);
  const request = { id: input.id ?? stableId("intel", `${input.entityType}:${input.query}:${createdAt}`), tenantId: input.tenantId, query: input.query, entityType: input.entityType, includeClearWeb: input.includeClearWeb ?? true, includeTelegram: input.includeTelegram ?? true, includeDarknetMetadata: input.includeDarknetMetadata ?? budget.includeDarknetMetadata ?? false, maxTasks: Math.min(input.maxTasks ?? budget.maxTasks, budget.maxTasks), createdAt, requesterId: input.requesterId, priority: input.priority ?? "normal", reason: input.reason, budgetClass: budget.class };
  const deadlineAt = iso(createdAt, budget.deadlineMs);
  const backgroundAvailableAt = budget.backgroundDelayMs ? iso(createdAt, budget.backgroundDelayMs) : undefined;
  const queryTerms = expandQueryTerms(request.query, request.entityType);
  const tasks: any[] = [], reviewRequired: any[] = [], rejected: any[] = [], explanations: any[] = [], seen = new Set();
  for (const source of rankedSources(sources, queryTerms, createdAt)) {
    const scoped = sourceMatchesScope(source, request);
    const allowed = allowedSource(source);
    if (!scoped || !allowed.ok) {
      const status = !scoped ? "skipped" : allowed.reason.includes("approval") || allowed.reason.includes("review") ? "blocked-by-approval" : "blocked-by-policy";
      const reason = !scoped ? "source is outside request scope" : allowed.reason;
      if (source.type?.endsWith("_metadata") && request.includeDarknetMetadata && tasks.length + reviewRequired.length < request.maxTasks) {
        const task = metadataTask(request, source, queryTerms, createdAt, deadlineAt, budget, reason);
        reviewRequired.push(task);
        explanations.push(decision(source, status, reason, task, budget.class, queryTerms));
      } else {
        explanations.push(decision(source, status, reason, undefined, budget.class, queryTerms));
        if (!scoped || status !== "blocked-by-approval") rejected.push({ sourceId: source.id, reason });
      }
      continue;
    }
    if (tasks.length + reviewRequired.length >= request.maxTasks) {
      explanations.push(decision(source, "skipped", "request task budget exhausted", undefined, budget.class, queryTerms));
      continue;
    }
    const targetUrl = target(source, queryTerms[0] ?? request.query);
    const key = `${source.id}:${targetUrl}`;
    if (seen.has(key)) {
      explanations.push(decision(source, "duplicate-suppressed", "duplicate source target suppressed", undefined, budget.class, queryTerms));
      continue;
    }
    seen.add(key);
    const freshness = sourceFreshness(source, createdAt);
    const waiting = source.crawlState?.backoffUntil && Date.parse(source.crawlState.backoffUntil) > Date.parse(createdAt);
    const selectedFor = source.type.endsWith("_metadata") ? "metadata" : tasks.length < budget.immediateTaskLimit ? "interactive" : "background";
    const availableAt = waiting ? source.crawlState.backoffUntil : selectedFor === "background" ? backgroundAvailableAt : undefined;
    const score = frontier.score({ source, url: targetUrl, discoveredAt: createdAt, tenantId: request.tenantId, intelRequestId: request.id, anchorText: queryTerms.join(" "), surroundingText: queryTerms.join(" "), parentRelevance: source.trustScore, novelty: novelty(source), freshness, budgetKey: request.id, fairnessKey: `${request.tenantId ?? "global"}:${request.id}:${source.type}`, maxBytes: budget.maxBytesPerTask });
    const task = buildTask(request, source, targetUrl, createdAt, deadlineAt, availableAt, budget, queryTerms, score, freshness, selectedFor);
    tasks.push(task);
    explanations.push(decision(source, waiting ? "waiting-for-backoff" : availableAt ? "delayed" : "selected", waiting ? "source backoff is active; task delayed" : availableAt ? "queued as deeper background work" : "selected by relevance, freshness, trust, and budget", task, budget.class, queryTerms, availableAt));
  }
  tasks.sort((a, b) => Number(Boolean(a.availableAt)) - Number(Boolean(b.availableAt)) || b.priority - a.priority || (a.availableAt ?? "").localeCompare(b.availableAt ?? ""));
  return { id: request.id, tenantId: request.tenantId, request, tasks, reviewRequired: reviewRequired.sort((a, b) => b.priority - a.priority), rejected, explanations, queryTerms, budget: { class: budget.class, maxTasks: request.maxTasks, immediateTaskLimit: budget.immediateTaskLimit, maxBytesPerTask: budget.maxBytesPerTask, deadlineAt, backgroundAvailableAt }, audit: [{ id: stableId("audit", `${request.id}:plan:${createdAt}`), tenantId: request.tenantId, actorId: request.requesterId, action: "intel.plan.created", subjectType: "intelligence_request", subjectId: request.id, occurredAt: createdAt, metadata: { tasks: tasks.length, reviewRequired: reviewRequired.length, rejected: rejected.length } }] };
}

export function createLiveSearchPlan(input): any {
  const request = { ...input.request, budgetClass: "interactive_live_search", priority: input.request.priority ?? "urgent", maxTasks: input.request.maxTasks ?? BUDGETS.interactive_live_search[0] };
  const plan = createCollectionPlan(request, input.sources, input.frontier ?? new FocusedFrontier({ strategy: "balanced" }));
  const reuseKey = liveSearchReuseKey(plan.request, input.sources, plan.queryTerms);
  const activeRun = activeFor(plan, input.activeRuns ?? [], input.activePlans ?? [], reuseKey);
  const zeroTaskReason = zeroReason(plan, activeRun);
  const recommendedSourceActivations = recommended(plan, input.sources, input.queryDemand ?? {});
  const back = backpressure(plan, activeRun, zeroTaskReason, input.frontier, recommendedSourceActivations, input.queuePressureLimit);
  return { plan, dto: { mode: "interactive_live_search", planId: plan.id, reuseKey, activeRunId: activeRun?.id, attachedToActiveRun: Boolean(activeRun), backpressureState: back.state, backpressureReason: back.reason, retryAfterSeconds: back.retryAfterSeconds, queuedTaskCount: plan.tasks.length, reviewTaskCount: plan.reviewRequired.length, blockedSourceCount: (plan.explanations ?? []).filter((x) => x.status === "blocked-by-policy" || x.status === "blocked-by-approval").length, skippedTaskCount: (plan.explanations ?? []).filter((x) => x.status === "skipped" || x.status === "duplicate-suppressed").length, nextPollSeconds: nextPoll(plan, activeRun, back.state), zeroTaskReason, coverageGaps: gaps(plan), recommendedSourceActivations, decisions: plan.explanations ?? [], queryTerms: plan.queryTerms ?? [plan.request.query] } };
}

export function liveSearchReuseKey(request, sources, queryTerms) {
  const scoped = sources.filter((s) => sourceMatchesScope(s, { includeClearWeb: request.includeClearWeb ?? true, includeTelegram: request.includeTelegram ?? true, includeDarknetMetadata: request.includeDarknetMetadata ?? false }));
  return stableId("live-reuse", JSON.stringify({ tenantId: request.tenantId ?? "global", entityType: request.entityType, terms: reuseTerms(request.query, request.entityType, queryTerms), sourceScope: uniq(scoped.map((s) => s.type)), riskScope: uniq(scoped.map((s) => s.risk)), freshnessWindow: hour(request.createdAt ?? nowIso()) }));
}

function profile(input) {
  const key = input.budgetClass ?? (input.includeDarknetMetadata && input.priority !== "urgent" ? "restricted_darknet_metadata_sweep" : input.priority === "urgent" ? "interactive_search" : input.priority === "high" ? "analyst_deep_dive" : "background_refresh");
  const [maxTasks, immediateTaskLimit, maxBytesPerTask, deadlineMs, backgroundDelayMs, includeDarknetMetadata] = BUDGETS[key];
  return { class: key, maxTasks, immediateTaskLimit, maxBytesPerTask, deadlineMs, backgroundDelayMs, includeDarknetMetadata };
}
function expandQueryTerms(query, entityType) {
  const terms = new Set([query.trim()]);
  const record = ACTOR_ALIAS_RECORDS.find((r) => r.canonical.toLowerCase() === query.trim().toLowerCase() || r.aliases.includes(query.trim().toLowerCase()));
  if ((entityType === "actor" || entityType === "alias" || entityType === "free_text") && record) [record.canonical, ...actorAliasesFor(record.canonical)].forEach((t) => terms.add(t));
  if (entityType === "cve" || entityType === "indicator") terms.add(query.trim().toUpperCase());
  return [...terms].filter(Boolean).slice(0, 12);
}
function allowedSource(source) {
  if (["paused", "disabled", "quarantined", "candidate", "needs_review"].includes(source.status)) return { ok: false, reason: source.status === "needs_review" || source.status === "candidate" ? "source needs approval or review" : `source is ${source.status}` };
  if (source.accessMethod === "disabled") return { ok: false, reason: "adapter disabled" };
  if (source.risk !== "low" && source.governance?.approvalState !== "approved") return { ok: false, reason: "restricted source requires approval" };
  return { ok: true };
}
function buildTask(request, source, targetUrl, createdAt, deadlineAt, availableAt, budget, queryTerms, score, freshness, selectedFor) {
  return { id: stableId("task", `${request.id}:${source.id}:${targetUrl}`), tenantId: request.tenantId, sourceId: source.id, sourceType: source.type, targetUrl, queuedAt: createdAt, availableAt, deadlineAt, priority: score.total ?? source.trustScore, reason: `intel request ${queryTerms[0] ?? targetUrl}: ${score.reason}`, retryCount: 0, maxRetries: budget.class === "interactive_search" ? 1 : 3, maxBytes: budget.maxBytesPerTask, intelRequestId: request.id, crawlBudgetKey: request.id, sourceConcurrencyKey: source.id, fairnessKey: `${request.tenantId ?? "global"}:${request.id}:${source.type}`, scoreBreakdown: score, planning: planMeta(source, budget, queryTerms, score.reason, freshness, selectedFor) };
}
function metadataTask(request, source, queryTerms, createdAt, deadlineAt, budget, reason) {
  const targetUrl = target(source, queryTerms[0] ?? request.query);
  return { id: stableId("task", `${request.id}:${source.id}:${targetUrl}:metadata-review`), tenantId: request.tenantId, sourceId: source.id, sourceType: source.type, targetUrl, queuedAt: createdAt, deadlineAt, priority: clampScore(source.trustScore * 0.9), reason: `metadata-only review for ${queryTerms[0] ?? targetUrl}: ${reason}; capture allowed fields only (actor, victim/company, affected accounts, dataset size, actor statement, timestamps, hashes, provenance)`, retryCount: 0, maxRetries: 0, maxBytes: Math.min(budget.maxBytesPerTask, 64_000), intelRequestId: request.id, crawlBudgetKey: request.id, sourceConcurrencyKey: source.id, fairnessKey: `${request.tenantId ?? "global"}:${request.id}:${source.type}:metadata-review`, planning: planMeta(source, budget, queryTerms, reason, sourceFreshness(source, createdAt), "metadata") };
}
function planMeta(source, budget, queryTerms, reason, freshness, selectedFor) {
  const meta = source.type.endsWith("_metadata");
  return { budgetClass: budget.class, decision: selectedFor === "metadata" ? "blocked-by-approval" : "selected", reason, queryTerms, freshness, freshnessTargetSeconds: source.crawlFrequencySeconds, maxCost: { tasks: 1, bytes: budget.maxBytesPerTask }, safetyEnvelope: { allowClearWeb: !meta, allowPublicChannel: source.type === "telegram_public", allowRestrictedMetadata: meta && source.governance?.approvalState === "approved", metadataOnlyRestricted: meta, forbiddenOperations: meta ? ["payload_download", "credential_bypass", "captcha_solving", "private_community_access"] : ["credential_bypass", "captcha_solving", "private_community_access"] }, sourceTrust: source.trustScore, selectedFor };
}
function decision(source, status, reason, task, budgetClass, queryTerms, availableAt = task?.availableAt) { return { sourceId: source.id, status, reason, targetUrl: task?.targetUrl, taskId: task?.id, priority: task?.priority, availableAt, budgetClass, queryTerms }; }
function rankedSources(sources, terms, at) { return [...sources].sort((a, b) => sourceScore(b, terms, at) - sourceScore(a, terms, at) || a.id.localeCompare(b.id)); }
function sourceScore(source, terms, at) { const text = `${source.name} ${source.url} ${(source.tags ?? []).join(" ")} ${JSON.stringify(source.metadata ?? {})}`.toLowerCase(); return clampScore(source.trustScore * 0.45 + sourceFreshness(source, at) * 0.3 + novelty(source) * 0.15 + (terms.some((t) => text.includes(t.toLowerCase())) ? 0.2 : 0) + (source.type === "api" ? 0.08 : source.type === "rss" ? 0.06 : source.type === "telegram_public" ? 0.04 : 0)); }
function sourceMatchesScope(source, request) { return source.type === "telegram_public" ? request.includeTelegram : source.type?.endsWith("_metadata") ? request.includeDarknetMetadata : request.includeClearWeb; }
function target(source, query) { return source.url.includes("{query}") ? source.url.replaceAll("{query}", encodeURIComponent(query)) : source.url; }
function sourceFreshness(source, at) { const ref = source.crawlState?.lastCollectedAt ?? source.lastSeenAt ?? source.health?.lastSuccessAt; if (!ref) return 0.55; const age = Math.max(0, Date.parse(at) - Date.parse(ref)); return Number.isFinite(age) ? clampScore(1 - age / 1_209_600_000) : 0.55; }
function novelty(source) { return !source.crawlState?.lastCollectedAt && !source.lastSeenAt ? 0.75 : source.health?.status === "failing" ? 0.2 : 0.55; }
function zeroReason(plan, activeRun) { const ex = plan.explanations ?? []; if (activeRun) return "duplicate_run_already_active"; if (plan.tasks.length || plan.reviewRequired.length) return "none"; if (/^(apt|ransomware|malware|cve|threat|actor|victim)$/i.test(plan.request.query.trim())) return "query_too_broad"; if (!ex.length) return "no_approved_sources"; if (ex.every((x) => x.status === "waiting-for-backoff" || x.status === "delayed")) return "all_sources_stale_or_backoff"; if (ex.every((x) => x.status === "blocked-by-policy" || x.status === "blocked-by-approval")) return "all_sources_blocked_by_risk"; if (ex.every((x) => x.reason.includes("disabled") || x.reason.includes("outside request scope"))) return "adapter_disabled"; if (ex.every((x) => x.reason.includes("budget"))) return "tenant_budget_exhausted"; return "no_approved_sources"; }
function activeFor(plan, runs, plans, reuseKey) { const byReq = new Map(plans.map((p) => [p.request.id, p])); return runs.find((r) => same(r, plan) && r.requestHash === reuseKey) ?? runs.find((r) => same(r, plan) && r.requestId === plan.request.id) ?? runs.find((r) => same(r, plan) && byReq.get(r.requestId)?.request.query.toLowerCase() === plan.request.query.toLowerCase() && byReq.get(r.requestId)?.request.entityType === plan.request.entityType); }
function same(run, plan) { return run.tenantId === plan.tenantId && (run.status === "queued" || run.status === "running"); }
function backpressure(plan, activeRun, zero, frontier, recommended, limit = 1000) { if (activeRun) return { state: "attached_to_active_run", reason: `attached to active run ${activeRun.id}`, retryAfterSeconds: 5 }; if (zero === "tenant_budget_exhausted") return { state: "deferred_by_budget", reason: "live-search task budget is exhausted", retryAfterSeconds: 60 }; if ((frontier?.groupedSnapshot().queued ?? 0) >= limit) return { state: "deferred_by_queue_pressure", retryAfterSeconds: 30 }; if (zero === "all_sources_stale_or_backoff" || (plan.tasks.length && plan.tasks.some((t) => t.availableAt))) return { state: "deferred_by_source_backoff", retryAfterSeconds: 15 }; if (zero === "all_sources_blocked_by_risk" && !recommended.some((r) => r.reason.includes("restricted"))) return { state: "needs_source_activation", retryAfterSeconds: 60 }; if (zero === "all_sources_blocked_by_risk") return { state: "blocked_by_policy", retryAfterSeconds: 60 }; if (!plan.tasks.length && recommended.length) return { state: "needs_source_activation", retryAfterSeconds: 60 }; if (zero === "no_approved_sources" || zero === "adapter_disabled") return { state: "needs_source_activation", retryAfterSeconds: 60 }; return { state: "accepted" }; }
function recommended(plan, sources, demand) { const byId = new Map(sources.map((s) => [s.id, s])); const gapsNow = gaps(plan); const demandCount = Math.max(1, ...plan.queryTerms.map((t) => demand[t.toLowerCase()] ?? 0)); return (plan.explanations ?? []).filter((x) => x.status === "blocked-by-approval" || x.status === "blocked-by-policy" || x.reason.includes("outside request scope")).map((x) => { const s = byId.get(x.sourceId), coverageGap = coverage(s); const requiredAction = s?.accessMethod === "disabled" ? "enable_adapter" : ["paused", "disabled", "quarantined"].includes(s?.status) ? "restore" : ["candidate", "needs_review"].includes(s?.status) || s?.approvalRequired ? "approve" : "add_source"; return { sourceId: x.sourceId, reason: x.reason, requiredAction, priority: demandCount * 10 + (coverageGap && gapsNow.includes(coverageGap) ? 30 : 0), coverageGap, demandCount }; }).sort((a, b) => b.priority - a.priority || a.sourceId.localeCompare(b.sourceId)).slice(0, 10); }
function gaps(plan) { const gaps = new Set(); if (!plan.tasks.some((t) => ["rss", "static_web", "api"].includes(t.sourceType))) gaps.add("clear_web"); if (plan.request.includeTelegram && !plan.tasks.some((t) => t.sourceType === "telegram_public")) gaps.add("public_chat"); if (plan.request.includeDarknetMetadata && !plan.tasks.some((t) => t.sourceType.endsWith("_metadata"))) gaps.add("darknet_metadata"); if ((plan.explanations ?? []).some((x) => x.status === "waiting-for-backoff")) gaps.add("freshness_waiting_for_backoff"); return [...gaps]; }
function coverage(s) { return !s ? undefined : s.type === "telegram_public" ? "public_chat" : s.type.endsWith("_metadata") ? "darknet_metadata" : "clear_web"; }
function nextPoll(plan, activeRun, state) { return activeRun ? 5 : state === "deferred_by_queue_pressure" ? 30 : state === "deferred_by_budget" || state === "needs_source_activation" || state === "blocked_by_policy" ? 60 : plan.tasks.some((t) => t.planning?.selectedFor === "interactive") ? 3 : plan.tasks.some((t) => t.availableAt) ? 15 : 30; }
function reuseTerms(query, entityType, terms) { const record = ACTOR_ALIAS_RECORDS.find((r) => r.canonical.toLowerCase() === query.trim().toLowerCase() || r.aliases.includes(query.trim().toLowerCase()) || terms.some((t) => r.aliases.includes(t.toLowerCase()))); return record && ["actor", "alias", "free_text"].includes(entityType) ? [record.canonical, ...actorAliasesFor(record.canonical)].map((t) => t.toLowerCase()).sort() : uniq(terms.map((t) => t.trim().toLowerCase())); }
function iso(from, addMs) { return new Date(Date.parse(from) + addMs).toISOString(); }
function hour(at) { const ts = Date.parse(at); return Number.isFinite(ts) ? new Date(Math.floor(ts / 3_600_000) * 3_600_000).toISOString() : "unknown"; }
function uniq(values) { return [...new Set(values.filter(Boolean))].sort(); }
