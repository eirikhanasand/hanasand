// @ts-nocheck
import type { SourceRecord, SourceReviewAction, SourceStatus, SourceType } from "../types.ts";
import { nowIso } from "../utils.ts";
import { seedDuplicateKey, validateSeedBundle, type SeedSourceBundle } from "./sourceSeeds.ts";

export type SourceRegistryReconciliationReasonCode = "missing_approved_source" | "approved_not_scheduled" | "active_unhealthy" | "active_no_recent_captures" | "disabled_by_policy" | "expired_approval" | "stale_legal_notes" | "duplicate_source" | "adapter_capability_mismatch";
export type SourceRegistryReviewPlanAction = "approve_candidates" | "quarantine_degraded_sources" | "restore_recovered_sources" | "retire_dead_sources" | "request_legal_notes";
export type SourceAdapterCapabilityState = { sourceType: SourceType; available: boolean; version?: string; reason?: string };
export type SourceSchedulerState = { scheduledSourceIds?: string[]; queuedSourceIds?: string[]; leasedSourceIds?: string[]; deadLetterSourceIds?: string[]; lastCaptureAtBySourceId?: Record<string, string> };
export type SourceRegistryReconciliationInput = { tenantId?: string; generatedAt?: string; desiredSourcePacks?: SeedSourceBundle[]; currentSources: SourceRecord[]; adapterCapabilities?: SourceAdapterCapabilityState[]; scheduler?: SourceSchedulerState; legalNotesStaleAfterSeconds?: number; recentCaptureWindowSeconds?: number; maxDriftItems?: number };
export type SourceRegistryDriftItem = any; export type SourceRegistryMissingDesiredSource = any; export type SourceRegistryBulkReviewPlan = any; export type SourceRegistryReconciliationReport = any;
const CODES: SourceRegistryReconciliationReasonCode[] = ["missing_approved_source", "approved_not_scheduled", "active_unhealthy", "active_no_recent_captures", "disabled_by_policy", "expired_approval", "stale_legal_notes", "duplicate_source", "adapter_capability_mismatch"];
const ACTIVE = new Set<SourceStatus>(["active", "probation", "degraded"]), SCHEDULABLE = new Set<SourceStatus>(["approved", "active", "probation", "degraded"]);

export function buildSourceRegistryReconciliationReport(input: SourceRegistryReconciliationInput): SourceRegistryReconciliationReport {
  const generatedAt = input.generatedAt ?? nowIso(), sources = scoped(input.currentSources, input.tenantId), scheduler = schedule(input.scheduler), duplicateKeys = duplicates(sources), caps = new Map((input.adapterCapabilities ?? []).map((cap) => [cap.sourceType, cap]));
  const desired = desiredSources(input.desiredSourcePacks ?? [], input.tenantId, generatedAt), currentKeys = new Set(sources.map(seedDuplicateKey));
  const missingDesiredSources = desired.filter((item) => !currentKeys.has(item.desiredKey)).map((item) => ({ ...item, code: "missing_approved_source", reason: "Desired safe-public source is not present in the registry.", recommendedAction: "approve_candidates" })).sort(by("packName", "sourceId"));
  const drift = sources.flatMap((source) => driftFor(source, generatedAt, scheduler, caps, duplicateKeys, input)).sort(compareDrift), max = input.maxDriftItems ?? 200, compact = drift.slice(0, max);
  const summary = Object.fromEntries(CODES.map((code) => [code, drift.filter((item) => item.code === code).length + (code === "missing_approved_source" ? missingDesiredSources.length : 0)]));
  const reviewPlans = reviewPlansFor(sources, compact, missingDesiredSources, input.tenantId);
  return { generatedAt, tenantId: input.tenantId, sourceCount: sources.length, desiredSourceCount: desired.length, drift: compact, missingDesiredSources, reviewPlans, summary, compact: { driftItemCount: compact.length, omittedDriftItemCount: Math.max(0, drift.length - compact.length), reviewPlanCount: reviewPlans.length } };
}

function driftFor(source: SourceRecord, generatedAt: string, scheduler, caps, duplicateKeys: Set<string>, input: SourceRegistryReconciliationInput): SourceRegistryDriftItem[] {
  const state = { scheduled: scheduler.scheduled.has(source.id), queued: scheduler.queued.has(source.id), leased: scheduler.leased.has(source.id), deadLettered: scheduler.deadLettered.has(source.id), lastCaptureAt: scheduler.lastCaptureAtBySourceId[source.id] ?? source.crawlState?.lastCollectedAt }, drift: SourceRegistryDriftItem[] = [];
  const push = (code: SourceRegistryReconciliationReasonCode, severity, reason, recommendedAction: SourceRegistryReviewPlanAction) => drift.push({ code, sourceId: source.id, sourceName: source.name, sourceType: source.type, tenantId: source.tenantId, severity, reason, recommendedAction, schedulerState: state });
  if (SCHEDULABLE.has(source.status) && !state.scheduled && !state.queued && !state.leased) push("approved_not_scheduled", "warning", "Approved or active source is not visible in active scheduler state.", "restore_recovered_sources");
  if (ACTIVE.has(source.status) && (["degraded", "failing"].includes(source.health?.status) || (source.health?.errorRate ?? 0) >= 0.5)) push("active_unhealthy", source.health?.status === "failing" ? "critical" : "warning", "Active source health is degraded or failing.", "quarantine_degraded_sources");
  if (ACTIVE.has(source.status) && !recent(source, generatedAt, state.lastCaptureAt, input.recentCaptureWindowSeconds)) push("active_no_recent_captures", "warning", "Active source has no recent capture inside its freshness window.", "restore_recovered_sources");
  if (source.status === "disabled" || source.status === "rejected" || source.accessMethod === "disabled" || source.catalog?.approvalScope === "disabled") push("disabled_by_policy", "warning", "Source is disabled, rejected, or blocked by policy.", "request_legal_notes");
  if (source.governance?.approvalExpiresAt && Date.parse(source.governance.approvalExpiresAt) <= Date.parse(generatedAt)) push("expired_approval", "critical", "Source approval has expired.", "request_legal_notes");
  if (staleLegal(source, generatedAt, input.legalNotesStaleAfterSeconds ?? 90 * 86400)) push("stale_legal_notes", "warning", "Source legal notes or terms review are stale.", "request_legal_notes");
  if (duplicateKeys.has(seedDuplicateKey(source))) push("duplicate_source", "info", "Source duplicates another tenant/type/canonical URL entry.", "retire_dead_sources");
  const cap = caps.get(source.type); if ((source.catalog && !source.catalog.adapterCompatibility.includes(source.type)) || cap?.available === false) push("adapter_capability_mismatch", "critical", cap?.reason ?? "Source type is not compatible with available adapter capability.", "request_legal_notes");
  return drift;
}

function reviewPlansFor(sources: SourceRecord[], drift: SourceRegistryDriftItem[], missing: SourceRegistryMissingDesiredSource[], tenantId?: string): SourceRegistryBulkReviewPlan[] {
  const plans = [], candidates = sources.filter((s) => ["candidate", "needs_review"].includes(s.status) && s.catalog?.approvalScope === "safe_public_auto").map((s) => s.id);
  if (candidates.length || missing.length) plans.push(plan("approve_candidates", [...candidates, ...missing.map((s) => s.sourceId)], tenantId, "approve", "Approve safe public candidate sources after operator review.", "high"));
  const degraded = ids(drift, "active_unhealthy"); if (degraded.length) plans.push(plan("quarantine_degraded_sources", degraded, tenantId, "quarantine", "Quarantine degraded or failing active sources.", "high"));
  const restore = sources.filter((s) => ["quarantined", "paused"].includes(s.status) && s.health?.status === "healthy").map((s) => s.id); if (restore.length) plans.push(plan("restore_recovered_sources", restore, tenantId, "restore", "Restore recovered sources to controlled operation.", "medium"));
  const retire = uniq([...ids(drift, "duplicate_source"), ...drift.filter((d) => d.schedulerState.deadLettered && ACTIVE.has(sources.find((s) => s.id === d.sourceId)?.status)).map((d) => d.sourceId)]); if (retire.length) plans.push(plan("retire_dead_sources", retire, tenantId, "reject", "Retire duplicate or dead-lettered sources after review.", "low"));
  const legal = uniq(["stale_legal_notes", "expired_approval", "disabled_by_policy", "adapter_capability_mismatch"].flatMap((code) => ids(drift, code))); if (legal.length) plans.push(plan("request_legal_notes", legal, tenantId, undefined, "Request refreshed legal notes, approval, or adapter review.", "medium"));
  return plans.sort((a, b) => rank(b.priority) - rank(a.priority) || a.action.localeCompare(b.action));
}

function desiredSources(packs: SeedSourceBundle[], tenantId: string | undefined, generatedAt: string) { return packs.flatMap((pack) => validateSeedBundle({ ...pack, sources: pack.sources.map((source) => ({ ...source, tenantId: tenantId ?? source.tenantId })) }, { dryRun: true, importedAt: generatedAt, referenceAt: generatedAt }).accepted.filter((source) => source.catalog?.approvalScope === "safe_public_auto").map((source) => ({ sourceId: source.id, sourceName: source.name, sourceType: source.type, tenantId: source.tenantId, desiredKey: seedDuplicateKey(source), packName: pack.name }))); }
function plan(action: SourceRegistryReviewPlanAction, sourceIds: string[], tenantId: string | undefined, reviewAction: SourceReviewAction | undefined, reason: string, priority: "low" | "medium" | "high") { return { action, dryRun: true, tenantId, sourceIds: uniq(sourceIds), reviewAction, reason, priority, willStartCrawling: false }; }
function scoped(sources: SourceRecord[], tenantId?: string): SourceRecord[] { return (tenantId ? sources.filter((source) => source.tenantId === tenantId || source.tenantId === undefined) : sources).sort(by("id")); }
function schedule(scheduler: SourceSchedulerState = {}) { return { scheduled: new Set(scheduler.scheduledSourceIds ?? []), queued: new Set(scheduler.queuedSourceIds ?? []), leased: new Set(scheduler.leasedSourceIds ?? []), deadLettered: new Set(scheduler.deadLetterSourceIds ?? []), lastCaptureAtBySourceId: scheduler.lastCaptureAtBySourceId ?? {} }; }
function duplicates(sources: SourceRecord[]): Set<string> { const counts = new Map<string, number>(); for (const source of sources) counts.set(seedDuplicateKey(source), (counts.get(seedDuplicateKey(source)) ?? 0) + 1); return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key)); }
function recent(source: SourceRecord, generatedAt: string, last?: string, override?: number): boolean { return Boolean(last) && Date.parse(generatedAt) - Date.parse(last) <= (override ?? source.catalog?.collection.freshnessTargetSeconds ?? source.crawlFrequencySeconds * 2) * 1000; }
function staleLegal(source: SourceRecord, generatedAt: string, seconds: number): boolean { const reviewedAt = typeof source.metadata?.legalNotesReviewedAt === "string" ? source.metadata.legalNotesReviewedAt : source.governance?.approvedAt ?? source.updatedAt; return !source.legalNotes.trim() || Date.parse(generatedAt) - Date.parse(reviewedAt) > seconds * 1000; }
function ids(drift: SourceRegistryDriftItem[], code: SourceRegistryReconciliationReasonCode): string[] { return uniq(drift.filter((item) => item.code === code).map((item) => item.sourceId)); }
function compareDrift(a, b): number { return rank(b.severity) - rank(a.severity) || a.code.localeCompare(b.code) || a.sourceId.localeCompare(b.sourceId); }
function by(...keys: string[]) { return (a, b) => keys.map((key) => String(a[key]).localeCompare(String(b[key]))).find(Boolean) ?? 0; }
function rank(value: string): number { return value === "critical" || value === "high" ? 3 : value === "warning" || value === "medium" ? 2 : 1; }
function uniq(values: string[]): string[] { return [...new Set(values)].sort(); }
