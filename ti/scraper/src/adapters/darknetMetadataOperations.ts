import type { SourceRecord } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";
import { BLOCKED_OPERATIONS } from "./darknetMetadataConstants.ts";
import { darknetMetadataResultFromCapture } from "./darknetMetadataCapture.ts";
import { restrictedMetadataAnalystOperationsContract, restrictedMetadataComplianceReport } from "./darknetMetadataContracts.ts";

function summarizeActions(actions: any[]) {
  return { automation_safe: actions.filter((a) => a.safety === "automation_safe").length, human_approval_required: actions.filter((a) => a.safety === "human_approval_required").length, blocked: actions.filter((a) => a.safety === "blocked").length, rollback_only: actions.filter((a) => a.safety === "rollback_only").length };
}

export function planDarknetMetadataLiveSearch(input: any) {
  const sources = (input.sources ?? []).filter((source: SourceRecord) => String(source.type).endsWith("_metadata"));
  const tasks = sources.filter((source: SourceRecord) => source.status !== "disabled").slice(0, input.maxTasks ?? 8).map((source: SourceRecord) => ({ id: stableId("darknet-task", `${source.id}:${input.query ?? ""}`), sourceId: source.id, targetUrl: source.url, query: input.query, entityType: input.entityType, captureMode: "metadata_only", blockedOperations: BLOCKED_OPERATIONS }));
  const status = input.disabled ? "disabled" : tasks.length > 0 ? "queued_metadata_only" : "approval_required";
  return { status, metadataOnly: true, query: input.query, entityType: input.entityType, tenantId: input.tenantId, tasks, taskCount: tasks.length, partial: status !== "queued_metadata_only", warnings: tasks.length ? [] : ["no approved darknet metadata source available"], captures: (input.captures ?? []).map(darknetMetadataResultFromCapture).filter(Boolean) };
}

export function buildRestrictedMetadataOperationsStatus(input: any) {
  const sources = input.sources ?? [];
  const captures = input.captures ?? [];
  const applyPlan = buildRestrictedMetadataApplyPlan(input);
  return { generatedAt: input.generatedAt ?? nowIso(), runId: input.runId, query: input.query, entityType: input.entityType, metadataOnly: true, sourceCount: sources.length, captureCount: captures.length, liveSearch: planDarknetMetadataLiveSearch(input), applyPlan, readiness: buildRestrictedMetadataOperationsReadiness(input), analystOperations: restrictedMetadataAnalystOperationsContract(), compliance: restrictedMetadataComplianceReport(sources, captures) };
}

export function buildRestrictedMetadataApplyPlan(input: any) {
  const sources = input.sources ?? [];
  const actions = sources.map((source: SourceRecord) => ({ id: stableId("restricted-action", source.id), sourceId: source.id, action: source.status === "disabled" ? "keep_source_blocked" : "enable_metadata_only_queue", safety: source.status === "disabled" ? "rollback_only" : "automation_safe", reason: source.status === "disabled" ? "source disabled" : "source can queue metadata-only collection", metadataOnly: true, forbiddenAlternatives: BLOCKED_OPERATIONS }));
  return { generatedAt: input.generatedAt ?? nowIso(), metadataOnly: true, actions, summary: summarizeActions(actions), analystOperations: restrictedMetadataAnalystOperationsContract() };
}

export const buildRestrictedMetadataCutoverReport = (input: any) => ({
  generatedAt: input.generatedAt ?? nowIso(),
  metadataOnly: true,
  applyPlan: buildRestrictedMetadataApplyPlan(input),
  status: "ready_metadata_only"
});

export const buildRestrictedMetadataOperationsReadiness = (input: any) => ({
  metadataOnly: true,
  sourceCount: (input.sources ?? []).length,
  ready: (input.sources ?? []).filter((s: SourceRecord) => s.status !== "disabled").length,
  blocked: (input.sources ?? []).filter((s: SourceRecord) => s.status === "disabled").length
});
