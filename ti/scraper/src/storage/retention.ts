import type { RawCapture, RetentionClass, RetentionJob, RetentionPolicy, SourceType } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";

const policy = (retentionClass: RetentionPolicy["retentionClass"], ttlDays: number | undefined, action: RetentionPolicy["action"]): RetentionPolicy => ({ retentionClass, ttlDays, action, preserveMetadata: true, preserveHashes: true });
export const DEFAULT_RETENTION_POLICIES: Record<RetentionPolicy["retentionClass"], RetentionPolicy> = {
  public_raw: policy("public_raw", 365, "delete_object"), discovery_snippet: policy("discovery_snippet", 14, "delete_capture_metadata"), live_search_snapshot: policy("live_search_snapshot", 7, "delete_capture_metadata"), evidence_delta: policy("evidence_delta", 90, "delete_capture_metadata"), public_report: policy("public_report", 730, "delete_object"), public_chat_text: policy("public_chat_text", 180, "delete_body"), darknet_metadata: policy("darknet_metadata", 365, "delete_body"), screenshot_hash: policy("screenshot_hash", 365, "retain"), sensitive_metadata: policy("sensitive_metadata", 90, "delete_body"), standard: policy("standard", 180, "delete_object"), short: policy("short", 30, "delete_body"), restricted_metadata: policy("restricted_metadata", 90, "delete_body"), legal_hold: policy("legal_hold", undefined, "legal_hold")
};
export type RetentionSimulationResult = { job: RetentionJob; retained: RawCapture[]; mutated: RawCapture[]; deletionAudit: Array<{ captureId: string; action: RetentionPolicy["action"]; reason: string }> };
export type RetentionInterruptionResult = RetentionSimulationResult & { interruptedAfter: number };

export function buildRetentionJob(captures: RawCapture[], policy: RetentionPolicy, scheduledAt = nowIso()): RetentionJob {
  const cutoffCollectedAt = policy.ttlDays === undefined ? undefined : new Date(Date.parse(scheduledAt) - policy.ttlDays * 86_400_000).toISOString();
  const affectedCaptureIds = cutoffCollectedAt ? captures.filter((c) => (c.retentionClass ?? "standard") === policy.retentionClass && Date.parse(c.collectedAt) <= Date.parse(cutoffCollectedAt)).map((c) => c.id) : [];
  return { id: stableId("retention", `${policy.retentionClass}:${scheduledAt}:${affectedCaptureIds.join(",")}`), retentionClass: policy.retentionClass, action: policy.action, scheduledAt, cutoffCollectedAt, status: "queued", affectedCaptureIds };
}

export function defaultRetentionClassForCapture(input: { sourceType?: SourceType; mediaType?: string; sensitive?: boolean; storageKind?: RawCapture["storageKind"]; metadata?: Record<string, unknown> }): RetentionClass {
  return input.metadata?.screenshotHash || input.mediaType?.startsWith("image/") ? "screenshot_hash" : input.sourceType === "telegram_public" ? "public_chat_text" : ["tor_metadata", "i2p_metadata", "freenet_metadata"].includes(input.sourceType ?? "") ? "darknet_metadata" : input.sensitive || input.storageKind === "metadata_only" ? "sensitive_metadata" : ["rss", "static_web", "pdf"].includes(input.sourceType ?? "") ? "public_report" : "standard";
}

export function simulateRetentionEnforcement(captures: RawCapture[], policy: RetentionPolicy, scheduledAt = nowIso()): RetentionSimulationResult {
  const job = buildRetentionJob(captures, policy, scheduledAt), affected = new Set(job.affectedCaptureIds), deletionAudit: RetentionSimulationResult["deletionAudit"] = [];
  const mutated = captures.map((capture) => { if (!affected.has(capture.id) || held(capture)) return capture; deletionAudit.push({ captureId: capture.id, action: policy.action, reason: `retention:${policy.retentionClass}` }); return mutate(capture, policy); });
  return { job: { ...job, status: "completed", completedAt: scheduledAt }, retained: mutated.filter((capture) => !affected.has(capture.id) || held(capture)), mutated, deletionAudit };
}

export function simulateInterruptedRetentionEnforcement(captures: RawCapture[], policy: RetentionPolicy, interruptAfter: number, scheduledAt = nowIso()): RetentionInterruptionResult {
  const simulation = simulateRetentionEnforcement(captures, policy, scheduledAt), applied = new Set(simulation.deletionAudit.slice(0, interruptAfter).map((e) => e.captureId));
  return { ...simulation, job: { ...simulation.job, status: "failed", error: `retention interrupted after ${interruptAfter} mutation(s)` }, interruptedAfter: interruptAfter, mutated: captures.map((capture) => applied.has(capture.id) ? simulation.mutated.find((item) => item.id === capture.id) ?? capture : capture), deletionAudit: simulation.deletionAudit.slice(0, interruptAfter) };
}

const held = (capture: RawCapture) => Boolean(capture.legalHold || capture.retentionClass === "legal_hold");
function mutate(capture: RawCapture, policy: RetentionPolicy): RawCapture { return policy.action === "delete_body" ? { ...capture, body: undefined } : policy.action === "delete_object" ? { ...capture, body: undefined, objectRef: undefined } : policy.action === "delete_capture_metadata" ? { ...capture, body: undefined, objectRef: undefined, metadata: policy.preserveMetadata ? capture.metadata : {}, contentHash: policy.preserveHashes ? capture.contentHash : "purged", normalizedTextHash: policy.preserveHashes ? capture.normalizedTextHash : undefined } : capture; }
