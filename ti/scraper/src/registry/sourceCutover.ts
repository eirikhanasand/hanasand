// @ts-nocheck
import type { SourceRecord } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";
import {
  buildSafePublicSourcePackInstallPlan,
  buildSourceActivationApiResponse,
  type SafePublicSourcePackInstallPlan,
  type SeedSourceBundle,
  type SourceActivationApiResponse
} from "./sourceSeeds.ts";
import {
  buildSourceRegistryReconciliationReport,
  type SourceAdapterCapabilityState,
  type SourceRegistryBulkReviewPlan,
  type SourceRegistryReconciliationReport,
  type SourceSchedulerState
} from "./sourceReconciliation.ts";

export type SourceCutoverReadinessState = "ready" | "blocked" | "needs_review";

export type SourceCutoverGovernanceEvidenceKind =
  | "activation_recommendation"
  | "review_plan"
  | "source_pack_install"
  | "reconciliation_drift";

export interface SourceCutoverGovernanceEvidence {
  id: string;
  kind: SourceCutoverGovernanceEvidenceKind;
  sourceIds: string[];
  approvalRequired: boolean;
  approvalOwner: "source_governance" | "legal" | "adapter_owner" | "scheduler_owner";
  reason: string;
  safetyCase: string;
  collectionEnabled: string[];
  remainsDisabled: string[];
  rollbackState: {
    canRollback: boolean;
    quarantineRecommended: boolean;
    rollbackReason?: string;
  };
}

export interface SourceCutoverHealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  failing: number;
  unknown: number;
  disabled: number;
  stale: number;
}

export interface SourceCutoverPromotionGate {
  gate: "source_cutover_ready";
  ready: boolean;
  state: SourceCutoverReadinessState;
  blockerCodes: string[];
  warningCodes: string[];
  proof: {
    queryCount: number;
    activeCoverageCount: number;
    driftItemCount: number;
    reviewPlanCount: number;
    governanceEvidenceCount: number;
    willStartCrawling: false;
  };
}

export interface SourceCutoverRehearsalReport {
  generatedAt: string;
  tenantId?: string;
  state: SourceCutoverReadinessState;
  queries: string[];
  activation: SourceActivationApiResponse[];
  reconciliation: SourceRegistryReconciliationReport;
  sourcePackInstallPlans: SafePublicSourcePackInstallPlan[];
  healthSummary: SourceCutoverHealthSummary;
  governanceEvidence: SourceCutoverGovernanceEvidence[];
  blockers: Array<{ code: string; reason: string; sourceIds: string[] }>;
  warnings: Array<{ code: string; reason: string; sourceIds: string[] }>;
  agent09Compatibility: {
    exposeFields: string[];
    suppressInternalFields: string[];
    maxItemsPerSection: number;
  };
  promotionGate: SourceCutoverPromotionGate;
  compact: {
    activationQueryCount: number;
    governanceEvidenceCount: number;
    omittedGovernanceEvidenceCount: number;
    maxItemsPerSection: number;
  };
}

export interface SourceCutoverRehearsalInput {
  tenantId?: string;
  generatedAt?: string;
  queries: string[];
  sources: SourceRecord[];
  desiredSourcePacks?: SeedSourceBundle[];
  adapterCapabilities?: SourceAdapterCapabilityState[];
  scheduler?: SourceSchedulerState;
  maxItemsPerSection?: number;
}

const BLOCKING_DRIFT_CODES = new Set([
  "missing_approved_source",
  "active_unhealthy",
  "expired_approval",
  "adapter_capability_mismatch"
]);

export function buildSourceCutoverRehearsalReport(input: SourceCutoverRehearsalInput): SourceCutoverRehearsalReport {
  const generatedAt = input.generatedAt ?? nowIso();
  const maxItemsPerSection = input.maxItemsPerSection ?? 50;
  const sources = input.tenantId
    ? input.sources.filter((source) => source.tenantId === input.tenantId || source.tenantId === undefined)
    : input.sources;
  const activation = input.queries.map((query) => buildSourceActivationApiResponse(query, sources, {
    tenantId: input.tenantId,
    generatedAt,
    demandCount: 1,
    sourcePack: input.desiredSourcePacks?.[0]
  }));
  const reconciliation = buildSourceRegistryReconciliationReport({
    tenantId: input.tenantId,
    generatedAt,
    desiredSourcePacks: input.desiredSourcePacks,
    currentSources: sources,
    adapterCapabilities: input.adapterCapabilities,
    scheduler: input.scheduler,
    maxDriftItems: maxItemsPerSection
  });
  const sourcePackInstallPlans = (input.desiredSourcePacks ?? []).map((pack) => buildSafePublicSourcePackInstallPlan(pack, {
    mode: "dry_run",
    tenantId: input.tenantId,
    existingSources: sources,
    generatedAt
  }));
  const healthSummary = summarizeHealth(sources, generatedAt);
  const allEvidence = [
    ...activation.flatMap((item) => evidenceFromActivation(item)),
    ...reconciliation.reviewPlans.flatMap((plan) => evidenceFromReviewPlan(plan)),
    ...sourcePackInstallPlans.flatMap((plan) => evidenceFromInstallPlan(plan)),
    ...reconciliation.drift.map((item) => evidenceFromDrift(item.code, item.sourceId, item.reason, item.severity === "critical"))
  ].sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
  const governanceEvidence = allEvidence.slice(0, maxItemsPerSection);
  const blockers = buildBlockers(activation, reconciliation);
  const warnings = buildWarnings(activation, reconciliation, healthSummary);
  const state: SourceCutoverReadinessState = blockers.length > 0
    ? "blocked"
    : warnings.length > 0 || governanceEvidence.some((item) => item.approvalRequired)
      ? "needs_review"
      : "ready";
  const promotionGate = buildPromotionGate(state, blockers, warnings, activation, reconciliation, governanceEvidence);

  return {
    generatedAt,
    tenantId: input.tenantId,
    state,
    queries: input.queries,
    activation,
    reconciliation,
    sourcePackInstallPlans,
    healthSummary,
    governanceEvidence,
    blockers,
    warnings,
    agent09Compatibility: {
      exposeFields: [
        "state",
        "queries",
        "activation.coverageSummary",
        "activation.coverageGaps",
        "reconciliation.summary",
        "healthSummary",
        "governanceEvidence",
        "promotionGate"
      ],
      suppressInternalFields: [
        "sourceCoverage.sources.reasons",
        "validation.accepted",
        "validation.errors.stack",
        "reconciliation.drift.schedulerState"
      ],
      maxItemsPerSection
    },
    promotionGate,
    compact: {
      activationQueryCount: activation.length,
      governanceEvidenceCount: governanceEvidence.length,
      omittedGovernanceEvidenceCount: Math.max(0, allEvidence.length - governanceEvidence.length),
      maxItemsPerSection
    }
  };
}

function summarizeHealth(sources: SourceRecord[], generatedAt: string): SourceCutoverHealthSummary {
  const summary: SourceCutoverHealthSummary = { total: sources.length, healthy: 0, degraded: 0, failing: 0, unknown: 0, disabled: 0, stale: 0 };
  for (const source of sources) {
    const status = source.health?.status ?? "unknown";
    if (status === "healthy") summary.healthy += 1;
    else if (status === "degraded") summary.degraded += 1;
    else if (status === "failing") summary.failing += 1;
    else if (status === "disabled") summary.disabled += 1;
    else summary.unknown += 1;
    const target = source.catalog?.collection.freshnessTargetSeconds;
    const lastCollected = source.crawlState?.lastCollectedAt ?? source.lastSeenAt;
    if (target && lastCollected && Date.parse(generatedAt) - Date.parse(lastCollected) > target * 1000) summary.stale += 1;
  }
  return summary;
}

function evidenceFromActivation(activation: SourceActivationApiResponse): SourceCutoverGovernanceEvidence[] {
  return activation.activationRecommendations.map((recommendation) => ({
    id: stableId("gov", `activation:${activation.query}:${recommendation.sourceId}:${recommendation.requiredAction}`),
    kind: "activation_recommendation",
    sourceIds: [recommendation.sourceId],
    approvalRequired: recommendation.requiredAction === "approve" || recommendation.requiredAction === "enable_adapter",
    approvalOwner: recommendation.requiredAction === "enable_adapter" ? "adapter_owner" : "source_governance",
    reason: recommendation.reason,
    safetyCase: "Activation recommendation is derived from registry metadata and does not fetch or crawl.",
    collectionEnabled: recommendation.requiredAction === "approve" ? ["safe-public source scheduling after approval"] : [],
    remainsDisabled: ["restricted-source raw payload collection", "private channels", "credentialed collection"],
    rollbackState: {
      canRollback: true,
      quarantineRecommended: recommendation.requiredAction === "restore",
      rollbackReason: recommendation.coverageGap
    }
  }));
}

function evidenceFromReviewPlan(plan: SourceRegistryBulkReviewPlan): SourceCutoverGovernanceEvidence[] {
  return [{
    id: stableId("gov", `review:${plan.action}:${plan.sourceIds.join(",")}`),
    kind: "review_plan",
    sourceIds: plan.sourceIds,
    approvalRequired: true,
    approvalOwner: plan.action === "request_legal_notes" ? "legal" : "source_governance",
    reason: plan.reason,
    safetyCase: "Bulk review plan is dry-run-only and tenant-scoped.",
    collectionEnabled: plan.action === "approve_candidates" ? ["candidate safe-public registry activation after review"] : [],
    remainsDisabled: ["automatic crawling from review plan", "restricted-source activation without metadata-only approval"],
    rollbackState: {
      canRollback: true,
      quarantineRecommended: plan.action === "quarantine_degraded_sources",
      rollbackReason: plan.action
    }
  }];
}

function evidenceFromInstallPlan(plan: SafePublicSourcePackInstallPlan): SourceCutoverGovernanceEvidence[] {
  return plan.recommendations.map((recommendation) => ({
    id: stableId("gov", `install:${plan.packName}:${recommendation.sourceId}:${recommendation.requiredAction}`),
    kind: "source_pack_install",
    sourceIds: [recommendation.sourceId],
    approvalRequired: recommendation.requiredAction !== "skip_duplicate",
    approvalOwner: recommendation.requiredAction === "fix_compliance" ? "legal" : "source_governance",
    reason: recommendation.reasons.join("; "),
    safetyCase: "Source-pack install plan validates safe-public metadata and reports willStartCrawling:false.",
    collectionEnabled: recommendation.requiredAction === "install_candidate" ? ["registry candidate creation only"] : [],
    remainsDisabled: ["live crawling", "restricted protocols", "unsafe source classes"],
    rollbackState: {
      canRollback: true,
      quarantineRecommended: false,
      rollbackReason: recommendation.requiredAction
    }
  }));
}

function evidenceFromDrift(code: string, sourceId: string, reason: string, critical: boolean): SourceCutoverGovernanceEvidence {
  return {
    id: stableId("gov", `drift:${code}:${sourceId}`),
    kind: "reconciliation_drift",
    sourceIds: [sourceId],
    approvalRequired: critical,
    approvalOwner: code === "adapter_capability_mismatch" ? "adapter_owner" : code === "approved_not_scheduled" ? "scheduler_owner" : "source_governance",
    reason,
    safetyCase: "Reconciliation drift is observational and does not mutate source or scheduler state.",
    collectionEnabled: [],
    remainsDisabled: ["new crawling", "restricted activation"],
    rollbackState: {
      canRollback: true,
      quarantineRecommended: code === "active_unhealthy",
      rollbackReason: code
    }
  };
}

function buildBlockers(activation: SourceActivationApiResponse[], reconciliation: SourceRegistryReconciliationReport): SourceCutoverRehearsalReport["blockers"] {
  const blockers = reconciliation.missingDesiredSources.map((item) => ({
    code: "missing_approved_source",
    reason: item.reason,
    sourceIds: [item.sourceId]
  }));
  for (const [code, count] of Object.entries(reconciliation.summary)) {
    if (BLOCKING_DRIFT_CODES.has(code) && count > 0) {
      blockers.push({
        code,
        reason: `Reconciliation reported ${count} ${code} item(s).`,
        sourceIds: reconciliation.drift.filter((item) => item.code === code).map((item) => item.sourceId)
      });
    }
  }
  for (const item of activation) {
    if (item.activeCoverage.length === 0) {
      blockers.push({ code: "query_without_active_coverage", reason: `No active source coverage for ${item.query}.`, sourceIds: [] });
    }
  }
  return blockers.sort((left, right) => left.code.localeCompare(right.code));
}

function buildWarnings(
  activation: SourceActivationApiResponse[],
  reconciliation: SourceRegistryReconciliationReport,
  health: SourceCutoverHealthSummary
): SourceCutoverRehearsalReport["warnings"] {
  const warnings: SourceCutoverRehearsalReport["warnings"] = [];
  if (reconciliation.summary.approved_not_scheduled > 0) {
    warnings.push({ code: "approved_not_scheduled", reason: "Some approved or active sources are absent from scheduler state.", sourceIds: reconciliation.drift.filter((item) => item.code === "approved_not_scheduled").map((item) => item.sourceId) });
  }
  if (health.degraded > 0 || health.unknown > 0 || health.stale > 0) {
    warnings.push({ code: "source_health_review", reason: "Some sources are degraded, unknown, or stale.", sourceIds: [] });
  }
  for (const item of activation) {
    if (item.activationRecommendations.length > 0) {
      warnings.push({ code: "activation_recommendations_pending", reason: `${item.query} has pending activation recommendations.`, sourceIds: item.activationRecommendations.map((recommendation) => recommendation.sourceId) });
    }
  }
  return warnings.sort((left, right) => left.code.localeCompare(right.code));
}

function buildPromotionGate(
  state: SourceCutoverReadinessState,
  blockers: SourceCutoverRehearsalReport["blockers"],
  warnings: SourceCutoverRehearsalReport["warnings"],
  activation: SourceActivationApiResponse[],
  reconciliation: SourceRegistryReconciliationReport,
  governanceEvidence: SourceCutoverGovernanceEvidence[]
): SourceCutoverPromotionGate {
  return {
    gate: "source_cutover_ready",
    ready: state === "ready",
    state,
    blockerCodes: [...new Set(blockers.map((blocker) => blocker.code))].sort(),
    warningCodes: [...new Set(warnings.map((warning) => warning.code))].sort(),
    proof: {
      queryCount: activation.length,
      activeCoverageCount: activation.reduce((sum, item) => sum + item.activeCoverage.length, 0),
      driftItemCount: reconciliation.compact.driftItemCount,
      reviewPlanCount: reconciliation.reviewPlans.length,
      governanceEvidenceCount: governanceEvidence.length,
      willStartCrawling: false
    }
  };
}
