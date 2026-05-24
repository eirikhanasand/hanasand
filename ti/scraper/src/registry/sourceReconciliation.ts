import type { SourceRecord, SourceReviewAction, SourceStatus, SourceType } from "../types.ts";
import { nowIso } from "../utils.ts";
import {
  seedDuplicateKey,
  validateSeedBundle,
  type SeedSourceBundle
} from "./sourceSeeds.ts";

export type SourceRegistryReconciliationReasonCode =
  | "missing_approved_source"
  | "approved_not_scheduled"
  | "active_unhealthy"
  | "active_no_recent_captures"
  | "disabled_by_policy"
  | "expired_approval"
  | "stale_legal_notes"
  | "duplicate_source"
  | "adapter_capability_mismatch";

export type SourceRegistryReviewPlanAction =
  | "approve_candidates"
  | "quarantine_degraded_sources"
  | "restore_recovered_sources"
  | "retire_dead_sources"
  | "request_legal_notes";

export interface SourceAdapterCapabilityState {
  sourceType: SourceType;
  available: boolean;
  version?: string;
  reason?: string;
}

export interface SourceSchedulerState {
  scheduledSourceIds?: string[];
  queuedSourceIds?: string[];
  leasedSourceIds?: string[];
  deadLetterSourceIds?: string[];
  lastCaptureAtBySourceId?: Record<string, string>;
}

export interface SourceRegistryReconciliationInput {
  tenantId?: string;
  generatedAt?: string;
  desiredSourcePacks?: SeedSourceBundle[];
  currentSources: SourceRecord[];
  adapterCapabilities?: SourceAdapterCapabilityState[];
  scheduler?: SourceSchedulerState;
  legalNotesStaleAfterSeconds?: number;
  recentCaptureWindowSeconds?: number;
  maxDriftItems?: number;
}

export interface SourceRegistryDriftItem {
  code: SourceRegistryReconciliationReasonCode;
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  tenantId?: string;
  severity: "info" | "warning" | "critical";
  reason: string;
  recommendedAction: SourceRegistryReviewPlanAction;
  schedulerState: {
    scheduled: boolean;
    queued: boolean;
    leased: boolean;
    deadLettered: boolean;
    lastCaptureAt?: string;
  };
}

export interface SourceRegistryMissingDesiredSource {
  code: "missing_approved_source";
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  tenantId?: string;
  desiredKey: string;
  packName: string;
  reason: string;
  recommendedAction: SourceRegistryReviewPlanAction;
}

export interface SourceRegistryBulkReviewPlan {
  action: SourceRegistryReviewPlanAction;
  dryRun: true;
  tenantId?: string;
  sourceIds: string[];
  reviewAction?: SourceReviewAction;
  reason: string;
  priority: "low" | "medium" | "high";
  willStartCrawling: false;
}

export interface SourceRegistryReconciliationReport {
  generatedAt: string;
  tenantId?: string;
  sourceCount: number;
  desiredSourceCount: number;
  drift: SourceRegistryDriftItem[];
  missingDesiredSources: SourceRegistryMissingDesiredSource[];
  reviewPlans: SourceRegistryBulkReviewPlan[];
  summary: Record<SourceRegistryReconciliationReasonCode, number>;
  compact: {
    driftItemCount: number;
    omittedDriftItemCount: number;
    reviewPlanCount: number;
  };
}

const RECONCILIATION_CODES: SourceRegistryReconciliationReasonCode[] = [
  "missing_approved_source",
  "approved_not_scheduled",
  "active_unhealthy",
  "active_no_recent_captures",
  "disabled_by_policy",
  "expired_approval",
  "stale_legal_notes",
  "duplicate_source",
  "adapter_capability_mismatch"
];

const ACTIVE_STATUSES = new Set<SourceStatus>(["active", "probation", "degraded"]);
const SCHEDULABLE_STATUSES = new Set<SourceStatus>(["approved", "active", "probation", "degraded"]);

export function buildSourceRegistryReconciliationReport(
  input: SourceRegistryReconciliationInput
): SourceRegistryReconciliationReport {
  const generatedAt = input.generatedAt ?? nowIso();
  const maxDriftItems = input.maxDriftItems ?? 200;
  const sources = scopedSources(input.currentSources, input.tenantId);
  const scheduler = schedulerSets(input.scheduler);
  const adapterCapabilities = new Map((input.adapterCapabilities ?? []).map((capability) => [capability.sourceType, capability]));
  const duplicateKeys = duplicateSourceKeys(sources);
  const desired = desiredSources(input.desiredSourcePacks ?? [], input.tenantId, generatedAt);
  const currentKeys = new Set(sources.map(seedDuplicateKey));
  const missingDesiredSources = desired
    .filter((desiredSource) => !currentKeys.has(desiredSource.desiredKey))
    .map((desiredSource): SourceRegistryMissingDesiredSource => ({
      code: "missing_approved_source",
      sourceId: desiredSource.sourceId,
      sourceName: desiredSource.sourceName,
      sourceType: desiredSource.sourceType,
      tenantId: desiredSource.tenantId,
      desiredKey: desiredSource.desiredKey,
      packName: desiredSource.packName,
      reason: "Desired safe-public source is not present in the registry.",
      recommendedAction: "approve_candidates"
    }))
    .sort((left, right) => left.packName.localeCompare(right.packName) || left.sourceId.localeCompare(right.sourceId));

  const drift = sources
    .flatMap((source) => driftForSource({
      source,
      generatedAt,
      scheduler,
      adapterCapabilities,
      duplicateKeys,
      legalNotesStaleAfterSeconds: input.legalNotesStaleAfterSeconds ?? 90 * 86400,
      recentCaptureWindowSeconds: input.recentCaptureWindowSeconds
    }))
    .sort(compareDrift);
  const summary = Object.fromEntries(RECONCILIATION_CODES.map((code) => [
    code,
    drift.filter((item) => item.code === code).length + (code === "missing_approved_source" ? missingDesiredSources.length : 0)
  ])) as Record<SourceRegistryReconciliationReasonCode, number>;
  const compactDrift = drift.slice(0, maxDriftItems);
  const reviewPlans = buildReviewPlans(sources, compactDrift, missingDesiredSources, input.tenantId);

  return {
    generatedAt,
    tenantId: input.tenantId,
    sourceCount: sources.length,
    desiredSourceCount: desired.length,
    drift: compactDrift,
    missingDesiredSources,
    reviewPlans,
    summary,
    compact: {
      driftItemCount: compactDrift.length,
      omittedDriftItemCount: Math.max(0, drift.length - compactDrift.length),
      reviewPlanCount: reviewPlans.length
    }
  };
}

function scopedSources(sources: SourceRecord[], tenantId?: string): SourceRecord[] {
  return (tenantId
    ? sources.filter((source) => source.tenantId === tenantId || source.tenantId === undefined)
    : sources
  ).sort((left, right) => left.id.localeCompare(right.id));
}

function schedulerSets(scheduler: SourceSchedulerState = {}) {
  return {
    scheduled: new Set(scheduler.scheduledSourceIds ?? []),
    queued: new Set(scheduler.queuedSourceIds ?? []),
    leased: new Set(scheduler.leasedSourceIds ?? []),
    deadLettered: new Set(scheduler.deadLetterSourceIds ?? []),
    lastCaptureAtBySourceId: scheduler.lastCaptureAtBySourceId ?? {}
  };
}

function desiredSources(packs: SeedSourceBundle[], tenantId: string | undefined, generatedAt: string) {
  return packs.flatMap((pack) => {
    const scopedPack: SeedSourceBundle = {
      ...pack,
      sources: pack.sources.map((source) => ({ ...source, tenantId: tenantId ?? source.tenantId }))
    };
    const validation = validateSeedBundle(scopedPack, {
      dryRun: true,
      importedAt: generatedAt,
      referenceAt: generatedAt
    });
    return validation.accepted
      .filter((source) => source.catalog?.approvalScope === "safe_public_auto")
      .map((source) => ({
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.type,
        tenantId: source.tenantId,
        desiredKey: seedDuplicateKey(source),
        packName: pack.name
      }));
  });
}

function duplicateSourceKeys(sources: SourceRecord[]): Set<string> {
  const counts = new Map<string, number>();
  for (const source of sources) counts.set(seedDuplicateKey(source), (counts.get(seedDuplicateKey(source)) ?? 0) + 1);
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function driftForSource(input: {
  source: SourceRecord;
  generatedAt: string;
  scheduler: ReturnType<typeof schedulerSets>;
  adapterCapabilities: Map<SourceType, SourceAdapterCapabilityState>;
  duplicateKeys: Set<string>;
  legalNotesStaleAfterSeconds: number;
  recentCaptureWindowSeconds?: number;
}): SourceRegistryDriftItem[] {
  const drift: SourceRegistryDriftItem[] = [];
  const { source, generatedAt, scheduler } = input;
  const schedulerState = {
    scheduled: scheduler.scheduled.has(source.id),
    queued: scheduler.queued.has(source.id),
    leased: scheduler.leased.has(source.id),
    deadLettered: scheduler.deadLettered.has(source.id),
    lastCaptureAt: scheduler.lastCaptureAtBySourceId[source.id] ?? source.crawlState?.lastCollectedAt
  };
  const push = (
    code: SourceRegistryReconciliationReasonCode,
    severity: SourceRegistryDriftItem["severity"],
    reason: string,
    recommendedAction: SourceRegistryReviewPlanAction
  ) => drift.push({
    code,
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    tenantId: source.tenantId,
    severity,
    reason,
    recommendedAction,
    schedulerState
  });

  if (SCHEDULABLE_STATUSES.has(source.status) && !schedulerState.scheduled && !schedulerState.queued && !schedulerState.leased) {
    push("approved_not_scheduled", "warning", "Approved or active source is not visible in active scheduler state.", "restore_recovered_sources");
  }
  if (ACTIVE_STATUSES.has(source.status) && (source.health?.status === "degraded" || source.health?.status === "failing" || (source.health?.errorRate ?? 0) >= 0.5)) {
    push("active_unhealthy", source.health?.status === "failing" ? "critical" : "warning", "Active source health is degraded or failing.", "quarantine_degraded_sources");
  }
  if (ACTIVE_STATUSES.has(source.status) && !recentCaptureOkay(source, generatedAt, schedulerState.lastCaptureAt, input.recentCaptureWindowSeconds)) {
    push("active_no_recent_captures", "warning", "Active source has no recent capture inside its freshness window.", "restore_recovered_sources");
  }
  if (source.status === "disabled" || source.status === "rejected" || source.accessMethod === "disabled" || source.catalog?.approvalScope === "disabled") {
    push("disabled_by_policy", "warning", "Source is disabled, rejected, or blocked by policy.", "request_legal_notes");
  }
  if (source.governance?.approvalExpiresAt && Date.parse(source.governance.approvalExpiresAt) <= Date.parse(generatedAt)) {
    push("expired_approval", "critical", "Source approval has expired.", "request_legal_notes");
  }
  if (legalNotesAreStale(source, generatedAt, input.legalNotesStaleAfterSeconds)) {
    push("stale_legal_notes", "warning", "Source legal notes or terms review are stale.", "request_legal_notes");
  }
  if (input.duplicateKeys.has(seedDuplicateKey(source))) {
    push("duplicate_source", "info", "Source duplicates another tenant/type/canonical URL entry.", "retire_dead_sources");
  }
  const capability = input.adapterCapabilities.get(source.type);
  if ((source.catalog && !source.catalog.adapterCompatibility.includes(source.type)) || capability?.available === false) {
    push(
      "adapter_capability_mismatch",
      "critical",
      capability?.reason ?? "Source type is not compatible with available adapter capability.",
      "request_legal_notes"
    );
  }

  return drift;
}

function recentCaptureOkay(source: SourceRecord, generatedAt: string, lastCaptureAt?: string, overrideWindow?: number): boolean {
  if (!lastCaptureAt) return false;
  const windowSeconds = overrideWindow ?? source.catalog?.collection.freshnessTargetSeconds ?? source.crawlFrequencySeconds * 2;
  return Date.parse(generatedAt) - Date.parse(lastCaptureAt) <= windowSeconds * 1000;
}

function legalNotesAreStale(source: SourceRecord, generatedAt: string, staleAfterSeconds: number): boolean {
  if (!source.legalNotes.trim()) return true;
  const reviewedAt = typeof source.metadata?.legalNotesReviewedAt === "string"
    ? source.metadata.legalNotesReviewedAt
    : source.governance?.approvedAt ?? source.updatedAt;
  return Date.parse(generatedAt) - Date.parse(reviewedAt) > staleAfterSeconds * 1000;
}

function buildReviewPlans(
  sources: SourceRecord[],
  drift: SourceRegistryDriftItem[],
  missingDesiredSources: SourceRegistryMissingDesiredSource[],
  tenantId?: string
): SourceRegistryBulkReviewPlan[] {
  const plans: SourceRegistryBulkReviewPlan[] = [];
  const candidates = sources
    .filter((source) => (source.status === "candidate" || source.status === "needs_review") && source.catalog?.approvalScope === "safe_public_auto")
    .map((source) => source.id);
  if (candidates.length || missingDesiredSources.length) {
    plans.push(plan("approve_candidates", [...candidates, ...missingDesiredSources.map((source) => source.sourceId)], tenantId, "approve", "Approve safe public candidate sources after operator review.", "high"));
  }
  const degraded = sourceIdsFor(drift, "active_unhealthy");
  if (degraded.length) plans.push(plan("quarantine_degraded_sources", degraded, tenantId, "quarantine", "Quarantine degraded or failing active sources.", "high"));
  const restore = sources
    .filter((source) => (source.status === "quarantined" || source.status === "paused") && source.health?.status === "healthy")
    .map((source) => source.id);
  if (restore.length) plans.push(plan("restore_recovered_sources", restore, tenantId, "restore", "Restore recovered sources to controlled operation.", "medium"));
  const retire = [...new Set([...sourceIdsFor(drift, "duplicate_source"), ...schedulerDeadLetters(sources, drift)])];
  if (retire.length) plans.push(plan("retire_dead_sources", retire, tenantId, "reject", "Retire duplicate or dead-lettered sources after review.", "low"));
  const legal = [...new Set([
    ...sourceIdsFor(drift, "stale_legal_notes"),
    ...sourceIdsFor(drift, "expired_approval"),
    ...sourceIdsFor(drift, "disabled_by_policy"),
    ...sourceIdsFor(drift, "adapter_capability_mismatch")
  ])];
  if (legal.length) plans.push(plan("request_legal_notes", legal, tenantId, undefined, "Request refreshed legal notes, approval, or adapter review.", "medium"));
  return plans.sort((left, right) => priorityRank(right.priority) - priorityRank(left.priority) || left.action.localeCompare(right.action));
}

function plan(
  action: SourceRegistryReviewPlanAction,
  sourceIds: string[],
  tenantId: string | undefined,
  reviewAction: SourceReviewAction | undefined,
  reason: string,
  priority: SourceRegistryBulkReviewPlan["priority"]
): SourceRegistryBulkReviewPlan {
  return {
    action,
    dryRun: true,
    tenantId,
    sourceIds: [...new Set(sourceIds)].sort(),
    reviewAction,
    reason,
    priority,
    willStartCrawling: false
  };
}

function sourceIdsFor(drift: SourceRegistryDriftItem[], code: SourceRegistryReconciliationReasonCode): string[] {
  return [...new Set(drift.filter((item) => item.code === code).map((item) => item.sourceId))].sort();
}

function schedulerDeadLetters(sources: SourceRecord[], drift: SourceRegistryDriftItem[]): string[] {
  const activeIds = new Set(sources.filter((source) => ACTIVE_STATUSES.has(source.status)).map((source) => source.id));
  return drift
    .filter((item) => item.schedulerState.deadLettered && activeIds.has(item.sourceId))
    .map((item) => item.sourceId);
}

function compareDrift(left: SourceRegistryDriftItem, right: SourceRegistryDriftItem): number {
  return severityRank(right.severity) - severityRank(left.severity) ||
    left.code.localeCompare(right.code) ||
    left.sourceId.localeCompare(right.sourceId);
}

function severityRank(severity: SourceRegistryDriftItem["severity"]): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function priorityRank(priority: SourceRegistryBulkReviewPlan["priority"]): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}
