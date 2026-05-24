import type { RawCapture, RetentionClass, RetentionJob, RetentionPolicy, SourceType } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";

export const DEFAULT_RETENTION_POLICIES: Record<RetentionPolicy["retentionClass"], RetentionPolicy> = {
  public_raw: {
    retentionClass: "public_raw",
    ttlDays: 365,
    action: "delete_object",
    preserveMetadata: true,
    preserveHashes: true
  },
  discovery_snippet: {
    retentionClass: "discovery_snippet",
    ttlDays: 14,
    action: "delete_capture_metadata",
    preserveMetadata: true,
    preserveHashes: true
  },
  live_search_snapshot: {
    retentionClass: "live_search_snapshot",
    ttlDays: 7,
    action: "delete_capture_metadata",
    preserveMetadata: true,
    preserveHashes: true
  },
  evidence_delta: {
    retentionClass: "evidence_delta",
    ttlDays: 90,
    action: "delete_capture_metadata",
    preserveMetadata: true,
    preserveHashes: true
  },
  public_report: {
    retentionClass: "public_report",
    ttlDays: 730,
    action: "delete_object",
    preserveMetadata: true,
    preserveHashes: true
  },
  public_chat_text: {
    retentionClass: "public_chat_text",
    ttlDays: 180,
    action: "delete_body",
    preserveMetadata: true,
    preserveHashes: true
  },
  darknet_metadata: {
    retentionClass: "darknet_metadata",
    ttlDays: 365,
    action: "delete_body",
    preserveMetadata: true,
    preserveHashes: true
  },
  screenshot_hash: {
    retentionClass: "screenshot_hash",
    ttlDays: 365,
    action: "retain",
    preserveMetadata: true,
    preserveHashes: true
  },
  sensitive_metadata: {
    retentionClass: "sensitive_metadata",
    ttlDays: 90,
    action: "delete_body",
    preserveMetadata: true,
    preserveHashes: true
  },
  standard: {
    retentionClass: "standard",
    ttlDays: 180,
    action: "delete_object",
    preserveMetadata: true,
    preserveHashes: true
  },
  short: {
    retentionClass: "short",
    ttlDays: 30,
    action: "delete_body",
    preserveMetadata: true,
    preserveHashes: true
  },
  restricted_metadata: {
    retentionClass: "restricted_metadata",
    ttlDays: 90,
    action: "delete_body",
    preserveMetadata: true,
    preserveHashes: true
  },
  legal_hold: {
    retentionClass: "legal_hold",
    action: "legal_hold",
    preserveMetadata: true,
    preserveHashes: true
  }
};

export function buildRetentionJob(
  captures: RawCapture[],
  policy: RetentionPolicy,
  scheduledAt = nowIso()
): RetentionJob {
  const cutoffCollectedAt = policy.ttlDays === undefined
    ? undefined
    : new Date(Date.parse(scheduledAt) - policy.ttlDays * 24 * 60 * 60 * 1000).toISOString();
  const affectedCaptureIds = cutoffCollectedAt
    ? captures
      .filter((capture) => (capture.retentionClass ?? "standard") === policy.retentionClass)
      .filter((capture) => Date.parse(capture.collectedAt) <= Date.parse(cutoffCollectedAt))
      .map((capture) => capture.id)
    : [];

  return {
    id: stableId("retention", `${policy.retentionClass}:${scheduledAt}:${affectedCaptureIds.join(",")}`),
    retentionClass: policy.retentionClass,
    action: policy.action,
    scheduledAt,
    cutoffCollectedAt,
    status: "queued",
    affectedCaptureIds
  };
}

export function defaultRetentionClassForCapture(input: {
  sourceType?: SourceType;
  mediaType?: string;
  sensitive?: boolean;
  storageKind?: RawCapture["storageKind"];
  metadata?: Record<string, unknown>;
}): RetentionClass {
  if (input.metadata?.screenshotHash || input.mediaType?.startsWith("image/")) return "screenshot_hash";
  if (input.sourceType === "telegram_public") return "public_chat_text";
  if (input.sourceType === "tor_metadata" || input.sourceType === "i2p_metadata" || input.sourceType === "freenet_metadata") return "darknet_metadata";
  if (input.sensitive || input.storageKind === "metadata_only") return "sensitive_metadata";
  if (input.sourceType === "rss" || input.sourceType === "static_web" || input.sourceType === "pdf") return "public_report";
  return "standard";
}

export interface RetentionSimulationResult {
  job: RetentionJob;
  retained: RawCapture[];
  mutated: RawCapture[];
  deletionAudit: Array<{ captureId: string; action: RetentionPolicy["action"]; reason: string }>;
}

export interface RetentionInterruptionResult extends RetentionSimulationResult {
  interruptedAfter: number;
}

export function simulateRetentionEnforcement(
  captures: RawCapture[],
  policy: RetentionPolicy,
  scheduledAt = nowIso()
): RetentionSimulationResult {
  const job = buildRetentionJob(captures, policy, scheduledAt);
  const affected = new Set(job.affectedCaptureIds);
  const deletionAudit: RetentionSimulationResult["deletionAudit"] = [];
  const mutated = captures.map((capture) => {
    if (!affected.has(capture.id) || capture.legalHold || capture.retentionClass === "legal_hold") return capture;
    deletionAudit.push({ captureId: capture.id, action: policy.action, reason: `retention:${policy.retentionClass}` });
    if (policy.action === "delete_body") return { ...capture, body: undefined };
    if (policy.action === "delete_object") return { ...capture, body: undefined, objectRef: undefined };
    if (policy.action === "delete_capture_metadata") {
      return {
        ...capture,
        body: undefined,
        objectRef: undefined,
        metadata: policy.preserveMetadata ? capture.metadata : {},
        contentHash: policy.preserveHashes ? capture.contentHash : "purged",
        normalizedTextHash: policy.preserveHashes ? capture.normalizedTextHash : undefined
      };
    }
    return capture;
  });

  return {
    job: { ...job, status: "completed", completedAt: scheduledAt },
    retained: mutated.filter((capture) => !affected.has(capture.id) || capture.legalHold || capture.retentionClass === "legal_hold"),
    mutated,
    deletionAudit
  };
}

export function simulateInterruptedRetentionEnforcement(
  captures: RawCapture[],
  policy: RetentionPolicy,
  interruptAfter: number,
  scheduledAt = nowIso()
): RetentionInterruptionResult {
  const simulation = simulateRetentionEnforcement(captures, policy, scheduledAt);
  const applied = new Set(simulation.deletionAudit.slice(0, interruptAfter).map((event) => event.captureId));
  return {
    ...simulation,
    job: {
      ...simulation.job,
      status: "failed",
      error: `retention interrupted after ${interruptAfter} mutation(s)`
    },
    interruptedAfter: interruptAfter,
    mutated: captures.map((capture) => {
      if (!applied.has(capture.id)) return capture;
      return simulation.mutated.find((item) => item.id === capture.id) ?? capture;
    }),
    deletionAudit: simulation.deletionAudit.slice(0, interruptAfter)
  };
}
