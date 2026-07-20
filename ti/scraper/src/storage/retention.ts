import type { RawCapture, RetentionClass, RetentionJob, RetentionPolicy, SourceType } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";

const policy = (retentionClass: RetentionPolicy["retentionClass"], ttlDays: number | undefined, action: RetentionPolicy["action"]): RetentionPolicy => ({ retentionClass, ttlDays, action, preserveMetadata: true, preserveHashes: true });
export const DEFAULT_RETENTION_POLICIES: Record<RetentionPolicy["retentionClass"], RetentionPolicy> = {
  public_raw: policy("public_raw", 365, "delete_object"), discovery_snippet: policy("discovery_snippet", 14, "delete_capture_metadata"), live_search_snapshot: policy("live_search_snapshot", 7, "delete_capture_metadata"), evidence_delta: policy("evidence_delta", 90, "delete_capture_metadata"), public_report: policy("public_report", 730, "delete_object"), public_chat_text: policy("public_chat_text", 180, "delete_body"), darknet_metadata: policy("darknet_metadata", 365, "delete_body"), screenshot_hash: policy("screenshot_hash", 365, "retain"), sensitive_metadata: policy("sensitive_metadata", 90, "delete_body"), standard: policy("standard", 180, "delete_object"), short: policy("short", 30, "delete_body"), restricted_metadata: policy("restricted_metadata", 90, "delete_body"), legal_hold: policy("legal_hold", undefined, "legal_hold")
};
export type RetentionSimulationResult = { job: RetentionJob; retained: RawCapture[]; mutated: RawCapture[]; deletionAudit: Array<{ captureId: string; action: RetentionPolicy["action"]; reason: string }> };
export type RetentionInterruptionResult = RetentionSimulationResult & { interruptedAfter: number };
type RetentionStore = { listCaptures(): RawCapture[]; replaceCaptureForRetention(capture: RawCapture): RawCapture; batch?<T>(write: () => T | Promise<T>): T | Promise<T> };
type RetentionObjectStore = { deleteObject(ref: NonNullable<RawCapture["objectRef"]>, reason: string): boolean };

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

export function enforceRetentionPolicy(store: RetentionStore, policy: RetentionPolicy, objectStore?: RetentionObjectStore, scheduledAt = nowIso()): RetentionSimulationResult {
  const captures = store.listCaptures();
  const simulation = simulateRetentionEnforcement(captures, policy, scheduledAt);
  const current = new Map(captures.map((capture) => [capture.id, capture]));
  const simulated = new Map(simulation.mutated.map((capture) => [capture.id, capture]));
  const applied = new Set<string>();
  for (const audit of simulation.deletionAudit) {
    const previous = current.get(audit.captureId);
    const next = simulated.get(audit.captureId);
    if (!previous || !next || !requiresMutation(previous, policy)) continue;
    if (previous.objectRef && policy.action !== "delete_body") objectStore?.deleteObject(previous.objectRef, audit.reason);
    store.replaceCaptureForRetention({
      ...next,
      storageKind: next.body || next.objectRef ? next.storageKind : "metadata_only",
      metadata: { ...next.metadata, retentionAudit: [...(Array.isArray(next.metadata?.retentionAudit) ? next.metadata.retentionAudit : []), { ...audit, appliedAt: scheduledAt }] }
    });
    applied.add(audit.captureId);
  }
  return { ...simulation, mutated: store.listCaptures(), deletionAudit: simulation.deletionAudit.filter((audit) => applied.has(audit.captureId)) };
}

export async function enforceDefaultRetentionPolicies(store: RetentionStore, objectStore?: RetentionObjectStore, scheduledAt = nowIso()) {
  const enforce = () => Object.values(DEFAULT_RETENTION_POLICIES).map((entry) => enforceRetentionPolicy(store, entry, objectStore, scheduledAt));
  return store.batch ? await store.batch(enforce) : enforce();
}

const held = (capture: RawCapture) => Boolean(capture.legalHold || capture.retentionClass === "legal_hold");
const requiresMutation = (capture: RawCapture, policy: RetentionPolicy) => policy.action === "delete_body" ? capture.body !== undefined : ["delete_object", "delete_capture_metadata"].includes(policy.action) ? capture.body !== undefined || capture.objectRef !== undefined : false;
function mutate(capture: RawCapture, policy: RetentionPolicy): RawCapture { return policy.action === "delete_body" ? { ...capture, body: undefined } : policy.action === "delete_object" ? { ...capture, body: undefined, objectRef: undefined } : policy.action === "delete_capture_metadata" ? { ...capture, body: undefined, objectRef: undefined, metadata: policy.preserveMetadata ? capture.metadata : {}, contentHash: policy.preserveHashes ? capture.contentHash : "purged", normalizedTextHash: policy.preserveHashes ? capture.normalizedTextHash : undefined } : capture; }
