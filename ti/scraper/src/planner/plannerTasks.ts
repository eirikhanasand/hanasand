// @ts-nocheck
import { clampScore, stableId } from "../utils.ts";
import { sourceFreshness, target } from "./plannerSources.ts";

export function buildTask(request, source, targetUrl, createdAt, deadlineAt, availableAt, budget, queryTerms, score, freshness, selectedFor) {
  return { id: stableId("task", `${request.id}:${source.id}:${targetUrl}`), tenantId: request.tenantId, sourceId: source.id, sourceType: source.type, targetUrl, queuedAt: createdAt, availableAt, deadlineAt, priority: score.total ?? source.trustScore, reason: `intel request ${queryTerms[0] ?? targetUrl}: ${score.reason}`, retryCount: 0, maxRetries: budget.class === "interactive_live_search" ? 0 : budget.class === "interactive_search" ? 1 : 3, maxBytes: budget.maxBytesPerTask, intelRequestId: request.id, crawlBudgetKey: request.id, sourceConcurrencyKey: source.id, fairnessKey: `${request.tenantId ?? "global"}:${request.id}:${source.type}`, scoreBreakdown: score, planning: planMeta(source, budget, queryTerms, score.reason, freshness, selectedFor) };
}

export function metadataTask(request, source, queryTerms, createdAt, deadlineAt, budget, reason) {
  const targetUrl = target(source, queryTerms[0] ?? request.query);
  return { id: stableId("task", `${request.id}:${source.id}:${targetUrl}:metadata-review`), tenantId: request.tenantId, sourceId: source.id, sourceType: source.type, targetUrl, queuedAt: createdAt, deadlineAt, priority: clampScore(source.trustScore * 0.9), reason: `metadata-only review for ${queryTerms[0] ?? targetUrl}: ${reason}; capture allowed fields only (actor, victim/company, affected accounts, dataset size, actor statement, timestamps, hashes, provenance)`, retryCount: 0, maxRetries: 0, maxBytes: Math.min(budget.maxBytesPerTask, 64_000), intelRequestId: request.id, crawlBudgetKey: request.id, sourceConcurrencyKey: source.id, fairnessKey: `${request.tenantId ?? "global"}:${request.id}:${source.type}:metadata-review`, planning: planMeta(source, budget, queryTerms, reason, sourceFreshness(source, createdAt), "metadata") };
}

export function decision(source, status, reason, task, budgetClass, queryTerms, availableAt = task?.availableAt) {
  return { sourceId: source.id, status, reason, targetUrl: task?.targetUrl, taskId: task?.id, priority: task?.priority, availableAt, budgetClass, queryTerms };
}

function planMeta(source, budget, queryTerms, reason, freshness, selectedFor) {
  const meta = source.type.endsWith("_metadata");
  return { budgetClass: budget.class, decision: selectedFor === "metadata" ? "blocked-by-approval" : "selected", reason, queryTerms, freshness, freshnessTargetSeconds: source.crawlFrequencySeconds, maxCost: { tasks: 1, bytes: budget.maxBytesPerTask }, safetyEnvelope: { allowClearWeb: !meta, allowPublicChannel: source.type === "telegram_public", allowRestrictedMetadata: meta && source.governance?.approvalState === "approved", metadataOnlyRestricted: meta, forbiddenOperations: meta ? ["payload_download", "credential_bypass", "captcha_solving", "private_community_access"] : ["credential_bypass", "captcha_solving", "private_community_access"] }, sourceTrust: source.trustScore, selectedFor };
}
