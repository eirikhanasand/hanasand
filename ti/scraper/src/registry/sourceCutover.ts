// @ts-nocheck
import type { SourceRecord } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";
import { buildSafePublicSourcePackInstallPlan, buildSourceActivationApiResponse } from "./sourceSeeds.ts";
import { buildSourceRegistryReconciliationReport } from "./sourceReconciliation.ts";

export type SourceCutoverReadinessState = "ready" | "blocked" | "needs_review";
export type SourceCutoverGovernanceEvidenceKind = any; export type SourceCutoverGovernanceEvidence = any; export type SourceCutoverHealthSummary = any; export type SourceCutoverPromotionGate = any; export type SourceCutoverRehearsalReport = any; export type SourceCutoverRehearsalInput = any;

const BLOCKING = new Set(["missing_approved_source", "active_unhealthy", "expired_approval", "adapter_capability_mismatch"]);
const EXPOSE = ["state", "queries", "activation.coverageSummary", "activation.coverageGaps", "reconciliation.summary", "healthSummary", "governanceEvidence", "promotionGate"];
const SUPPRESS = ["sourceCoverage.sources.reasons", "validation.accepted", "validation.errors.stack", "reconciliation.drift.schedulerState"];

export function buildSourceCutoverRehearsalReport(input: SourceCutoverRehearsalInput): SourceCutoverRehearsalReport {
  const generatedAt = input.generatedAt ?? nowIso(), max = input.maxItemsPerSection ?? 50;
  const sources = input.tenantId ? input.sources.filter((s) => s.tenantId === input.tenantId || s.tenantId === undefined) : input.sources;
  const activation = input.queries.map((query) => buildSourceActivationApiResponse(query, sources, { tenantId: input.tenantId, generatedAt, demandCount: 1, sourcePack: input.desiredSourcePacks?.[0] }));
  const reconciliation = buildSourceRegistryReconciliationReport({ tenantId: input.tenantId, generatedAt, desiredSourcePacks: input.desiredSourcePacks, currentSources: sources, adapterCapabilities: input.adapterCapabilities, scheduler: input.scheduler, maxDriftItems: max });
  const sourcePackInstallPlans = (input.desiredSourcePacks ?? []).map((pack) => buildSafePublicSourcePackInstallPlan(pack, { mode: "dry_run", tenantId: input.tenantId, existingSources: sources, generatedAt }));
  const healthSummary = health(sources, generatedAt);
  const allEvidence = [...activation.flatMap(evidenceFromActivation), ...reconciliation.reviewPlans.flatMap(evidenceFromReview), ...sourcePackInstallPlans.flatMap(evidenceFromInstall), ...reconciliation.drift.map((d) => evidenceFromDrift(d.code, d.sourceId, d.reason, d.severity === "critical"))].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  const governanceEvidence = allEvidence.slice(0, max), blockers = blockerRows(activation, reconciliation), warnings = warningRows(activation, reconciliation, healthSummary);
  const state: SourceCutoverReadinessState = blockers.length ? "blocked" : warnings.length || governanceEvidence.some((item) => item.approvalRequired) ? "needs_review" : "ready";
  const promotionGate = gate(state, blockers, warnings, activation, reconciliation, governanceEvidence);
  return { generatedAt, tenantId: input.tenantId, state, queries: input.queries, activation, reconciliation, sourcePackInstallPlans, healthSummary, governanceEvidence, blockers, warnings, agent09Compatibility: { exposeFields: EXPOSE, suppressInternalFields: SUPPRESS, maxItemsPerSection: max }, promotionGate, compact: { activationQueryCount: activation.length, governanceEvidenceCount: governanceEvidence.length, omittedGovernanceEvidenceCount: Math.max(0, allEvidence.length - governanceEvidence.length), maxItemsPerSection: max } };
}

function health(sources: SourceRecord[], generatedAt: string): SourceCutoverHealthSummary {
  const out = { total: sources.length, healthy: 0, degraded: 0, failing: 0, unknown: 0, disabled: 0, stale: 0 };
  for (const s of sources) { const status = s.health?.status ?? "unknown"; out[status in out ? status : "unknown"] += 1; const target = s.catalog?.collection.freshnessTargetSeconds, last = s.crawlState?.lastCollectedAt ?? s.lastSeenAt; if (target && last && Date.parse(generatedAt) - Date.parse(last) > target * 1000) out.stale += 1; }
  return out;
}
const evidenceFromActivation = (a) => a.activationRecommendations.map((r) => evidence("activation_recommendation", `activation:${a.query}:${r.sourceId}:${r.requiredAction}`, [r.sourceId], r.requiredAction === "approve" || r.requiredAction === "enable_adapter", r.requiredAction === "enable_adapter" ? "adapter_owner" : "source_governance", r.reason, r.requiredAction === "approve" ? ["safe-public source scheduling after approval"] : [], ["restricted-source raw payload collection", "private channels", "credentialed collection"], r.requiredAction === "restore", r.coverageGap));
const evidenceFromReview = (p) => [evidence("review_plan", `review:${p.action}:${p.sourceIds.join(",")}`, p.sourceIds, true, p.action === "request_legal_notes" ? "legal" : "source_governance", p.reason, p.action === "approve_candidates" ? ["candidate safe-public registry activation after review"] : [], ["automatic crawling from review plan", "restricted-source activation without metadata-only approval"], p.action === "quarantine_degraded_sources", p.action)];
const evidenceFromInstall = (p) => p.recommendations.map((r) => evidence("source_pack_install", `install:${p.packName}:${r.sourceId}:${r.requiredAction}`, [r.sourceId], r.requiredAction !== "skip_duplicate", r.requiredAction === "fix_compliance" ? "legal" : "source_governance", r.reasons.join("; "), r.requiredAction === "install_candidate" ? ["registry candidate creation only"] : [], ["live crawling", "restricted protocols", "unsafe source classes"], false, r.requiredAction));
const evidenceFromDrift = (code: string, sourceId: string, reason: string, critical: boolean) => evidence("reconciliation_drift", `drift:${code}:${sourceId}`, [sourceId], critical, code === "adapter_capability_mismatch" ? "adapter_owner" : code === "approved_not_scheduled" ? "scheduler_owner" : "source_governance", reason, [], ["new crawling", "restricted activation"], code === "active_unhealthy", code);
function evidence(kind, key, sourceIds, approvalRequired, approvalOwner, reason, collectionEnabled, remainsDisabled, quarantineRecommended, rollbackReason) {
  return { id: stableId("gov", key), kind, sourceIds, approvalRequired, approvalOwner, reason, safetyCase: "Registry-derived dry-run metadata; no crawling starts here.", collectionEnabled, remainsDisabled, rollbackState: { canRollback: true, quarantineRecommended, rollbackReason } };
}
function blockerRows(activation, reconciliation) {
  const rows = reconciliation.missingDesiredSources.map((item) => ({ code: "missing_approved_source", reason: item.reason, sourceIds: [item.sourceId] }));
  for (const [code, count] of Object.entries(reconciliation.summary)) if (BLOCKING.has(code) && count > 0) rows.push({ code, reason: `Reconciliation reported ${count} ${code} item(s).`, sourceIds: reconciliation.drift.filter((item) => item.code === code).map((item) => item.sourceId) });
  for (const item of activation) if (item.activeCoverage.length === 0) rows.push({ code: "query_without_active_coverage", reason: `No active source coverage for ${item.query}.`, sourceIds: [] });
  return rows.sort((a, b) => a.code.localeCompare(b.code));
}
function warningRows(activation, reconciliation, h) {
  const rows = [];
  if (reconciliation.summary.approved_not_scheduled > 0) rows.push({ code: "approved_not_scheduled", reason: "Some approved or active sources are absent from scheduler state.", sourceIds: reconciliation.drift.filter((item) => item.code === "approved_not_scheduled").map((item) => item.sourceId) });
  if (h.degraded > 0 || h.unknown > 0 || h.stale > 0) rows.push({ code: "source_health_review", reason: "Some sources are degraded, unknown, or stale.", sourceIds: [] });
  for (const item of activation) if (item.activationRecommendations.length > 0) rows.push({ code: "activation_recommendations_pending", reason: `${item.query} has pending activation recommendations.`, sourceIds: item.activationRecommendations.map((r) => r.sourceId) });
  return rows.sort((a, b) => a.code.localeCompare(b.code));
}
function gate(state, blockers, warnings, activation, reconciliation, governanceEvidence): SourceCutoverPromotionGate {
  return { gate: "source_cutover_ready", ready: state === "ready", state, blockerCodes: uniq(blockers.map((b) => b.code)), warningCodes: uniq(warnings.map((w) => w.code)), proof: { queryCount: activation.length, activeCoverageCount: activation.reduce((sum, item) => sum + item.activeCoverage.length, 0), driftItemCount: reconciliation.compact.driftItemCount, reviewPlanCount: reconciliation.reviewPlans.length, governanceEvidenceCount: governanceEvidence.length, willStartCrawling: false } };
}

const uniq = (values: string[]) => [...new Set(values)].sort();
