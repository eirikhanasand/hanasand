// @ts-nocheck
import { FocusedFrontier } from "../frontier/frontier.ts";
import { nowIso, stableId } from "../utils.ts";
import { iso, profile } from "./plannerBudgets.ts";
import { expandQueryTerms } from "./plannerQuery.ts";
import { allowedSource, novelty, rankedSources, sourceAvailableAt, sourceFreshness, sourceMatchesScope, target } from "./plannerSources.ts";
import { buildTask, decision, metadataTask } from "./plannerTasks.ts";

export function createCollectionPlan(input, sources, frontier = new FocusedFrontier()): any {
  const createdAt = input.createdAt ?? nowIso(), budget = profile(input);
  const request = { id: input.id ?? stableId("intel", `${input.entityType}:${input.query}:${createdAt}`), tenantId: input.tenantId, query: input.query, entityType: input.entityType, includeClearWeb: input.includeClearWeb ?? true, includeTelegram: input.includeTelegram ?? true, includeDarknetMetadata: input.includeDarknetMetadata ?? budget.includeDarknetMetadata ?? false, maxTasks: Math.min(input.maxTasks ?? budget.maxTasks, budget.maxTasks), createdAt, requesterId: input.requesterId, priority: input.priority ?? "normal", reason: input.reason, budgetClass: budget.class };
  const deadlineAt = iso(createdAt, budget.deadlineMs), backgroundAvailableAt = budget.backgroundDelayMs ? iso(createdAt, budget.backgroundDelayMs) : undefined;
  const queryTerms = expandQueryTerms(request.query, request.entityType);
  const tasks: any[] = [], reviewRequired: any[] = [], rejected: any[] = [], explanations: any[] = [], seen = new Set();
  for (const source of rankedSources(sources, queryTerms, createdAt)) {
    const scoped = sourceMatchesScope(source, request, queryTerms), allowed = allowedSource(source);
    if (!scoped || !allowed.ok) { handleBlocked(source, request, tasks, reviewRequired, rejected, explanations, queryTerms, createdAt, deadlineAt, budget, scoped, allowed); continue; }
    const sourceDelayUntil = sourceAvailableAt(source, createdAt);
    if (tasks.length + reviewRequired.length >= request.maxTasks) { explanations.push(decision(source, sourceDelayUntil ? "waiting-for-backoff" : "skipped", sourceDelayUntil ? "source cadence or backoff remains active beyond the task budget" : "request task budget exhausted", undefined, budget.class, queryTerms, sourceDelayUntil)); continue; }
    const targetUrl = target(source, queryTerms[0] ?? request.query), key = `${source.id}:${targetUrl}`;
    if (seen.has(key)) { explanations.push(decision(source, "duplicate-suppressed", "duplicate source target suppressed", undefined, budget.class, queryTerms)); continue; }
    seen.add(key);
    const freshness = sourceFreshness(source, createdAt), waiting = Boolean(sourceDelayUntil);
    const selectedFor = source.type.endsWith("_metadata") ? "metadata" : tasks.length < budget.immediateTaskLimit ? "interactive" : "background";
    const availableAt = sourceDelayUntil ?? (selectedFor === "background" ? backgroundAvailableAt : undefined);
    const score = frontier.score({ source, url: targetUrl, discoveredAt: createdAt, tenantId: request.tenantId, intelRequestId: request.id, anchorText: queryTerms.join(" "), surroundingText: queryTerms.join(" "), parentRelevance: source.trustScore, novelty: novelty(source), freshness, budgetKey: request.id, fairnessKey: `${request.tenantId ?? "global"}:${request.id}:${source.type}`, maxBytes: budget.maxBytesPerTask });
    tasks.push(buildTask(request, source, targetUrl, createdAt, deadlineAt, availableAt, budget, queryTerms, score, freshness, selectedFor));
    explanations.push(decision(source, waiting ? "waiting-for-backoff" : availableAt ? "delayed" : "selected", waiting ? "source cadence or backoff is active; task delayed" : availableAt ? "queued as deeper background work" : "selected by relevance, freshness, trust, and budget", tasks.at(-1), budget.class, queryTerms, availableAt));
  }
  tasks.sort((a, b) => Number(Boolean(a.availableAt)) - Number(Boolean(b.availableAt)) || b.priority - a.priority || (a.availableAt ?? "").localeCompare(b.availableAt ?? ""));
  return { id: request.id, tenantId: request.tenantId, request, tasks, reviewRequired: reviewRequired.sort((a, b) => b.priority - a.priority), rejected, explanations, queryTerms, budget: { class: budget.class, maxTasks: request.maxTasks, immediateTaskLimit: budget.immediateTaskLimit, maxBytesPerTask: budget.maxBytesPerTask, deadlineAt, backgroundAvailableAt }, audit: [{ id: stableId("audit", `${request.id}:plan:${createdAt}`), tenantId: request.tenantId, actorId: request.requesterId, action: "intel.plan.created", subjectType: "intelligence_request", subjectId: request.id, occurredAt: createdAt, metadata: { tasks: tasks.length, reviewRequired: reviewRequired.length, rejected: rejected.length } }] };
}

function handleBlocked(source, request, tasks, reviewRequired, rejected, explanations, queryTerms, createdAt, deadlineAt, budget, scoped, allowed) {
  const status = !scoped ? "skipped" : allowed.reason.includes("approval") || allowed.reason.includes("review") ? "blocked-by-approval" : "blocked-by-policy";
  const reason = !scoped ? "source is outside request scope" : allowed.reason;
  if (source.type?.endsWith("_metadata") && request.includeDarknetMetadata && tasks.length + reviewRequired.length < request.maxTasks) {
    const task = metadataTask(request, source, queryTerms, createdAt, deadlineAt, budget, reason);
    reviewRequired.push(task); explanations.push(decision(source, status, reason, task, budget.class, queryTerms));
  } else { explanations.push(decision(source, status, reason, undefined, budget.class, queryTerms)); if (!scoped || status !== "blocked-by-approval") rejected.push({ sourceId: source.id, reason }); }
}
