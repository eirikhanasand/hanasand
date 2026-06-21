import type { SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";
import { applyTelegramPublicAbuseControls, buildTelegramPublicEvidencePromotionProgram } from "./telegramPublicRuntime.ts";
import { buildTelegramPublicApplyPlan, recommendTelegramPublicSourcePacks } from "./telegramPublicPlanning.ts";
import { buildTelegramPublicReconciliation } from "./telegramPublicReconciliation.ts";
import { validateTelegramPublicSourceCompliance } from "./telegramPublicHelpers.ts";

export { buildTelegramPublicReconciliation } from "./telegramPublicReconciliation.ts";

export function buildTelegramPublicCutoverReport(input: any) {
  const reconciliation = buildTelegramPublicReconciliation(input);
  const applyPlan = buildTelegramPublicApplyPlan(input);
  return { generatedAt: input.generatedAt ?? nowIso(), status: reconciliation.summary.policy_disabled ? "watch" : "ready", summary: { rateLimitedCount: 0, evidenceCount: input.evidence?.length ?? 0 }, abuseControls: applyTelegramPublicAbuseControls(input), reconciliation, repairs: reconciliation.repairs, applyPlan, sourcePackRecommendations: recommendTelegramPublicSourcePacks(input) };
}

export function buildTelegramPublicReliabilityReport(input: any) {
  const sources = (input.sources ?? []).filter((s: SourceRecord) => s.type === "telegram_public").map((source: SourceRecord) => ({ sourceId: source.id, rating: validateTelegramPublicSourceCompliance(source).allowed ? "healthy" : "blocked", recommendedActions: [] }));
  return { generatedAt: input.generatedAt ?? nowIso(), rating: sources.some((s: any) => s.rating === "healthy") ? "healthy" : "blocked", sources };
}

export const buildTelegramPublicActorReadinessDto = (reliability: any) => ({ status: reliability.rating === "healthy" ? "ready" : "blocked", healthySources: reliability.sources?.filter((s: any) => s.rating === "healthy").length ?? 0, rating: reliability.rating ?? "none" });
export const buildTelegramPublicAnswerReadinessDto = (input: any) => ({ status: input.evidence?.length ? "ready" : "queued", evidenceCount: input.evidence?.length ?? 0 });
export const buildTelegramPublicOperatorControlEffects = (applyPlan: any) => (applyPlan.steps ?? []).map((step: any) => ({ action: step.action, execution: step.execution, effect: step.execution === "automation_safe" ? "can_apply" : "hold" }));
export const buildTelegramPublicCompactSearchSummary = (input: any) => ({ status: input.actorReadiness?.status ?? (input.evidence?.length ? "ready" : "queued"), reliability: { rating: input.reliability?.rating ?? "none" }, operatorStateCounts: { normal: input.operatorStates?.length ?? 0 }, evidenceCount: input.evidence?.length ?? input.cutoverReport?.summary?.evidenceCount ?? 0 });
export const buildTelegramPublicSlaReport = (input: any) => ({ generatedAt: input.generatedAt ?? nowIso(), status: input.actorReadiness?.status ?? "queued", proofCommand: "bun test src/tests/telegramPublic.test.ts", controls: input.operatorControlEffects ?? [] });
export const buildTelegramPublicOperatorStates = (input: any) => (input.sources ?? []).filter((s: SourceRecord) => s.type === "telegram_public").map((source: SourceRecord) => ({ sourceId: source.id, state: validateTelegramPublicSourceCompliance(source).allowed ? "normal" : "policy_disabled" }));
export const buildTelegramPublicSourcePackCompatibility = (input: any) => ({ compatible: true, sourcePackCount: input.sourcePacks?.length ?? 0 });
export const buildTelegramPublicSourcePackReadiness = (input: any) => ({ status: (input.sources ?? []).some((s: SourceRecord) => s.type === "telegram_public") ? "ready" : "needs_sources", sourcePackCount: input.sourcePacks?.length ?? 0 });
export const buildTelegramPublicCanaryRollout = (input: any) => ({ status: "ready", canaryPercent: 10, rollbackActions: ["quarantine_channel"], applyPlan: input.applyPlan });
export const buildTelegramPublicPromotionCanaryProof = (input: any) => ({ status: "ready", promotedSampleCount: input.promotion?.promoted?.length ?? 0, rollbackTriggers: ["quarantine_channel"] });
export const buildTelegramPublicPromotionCertification = (input: any) => ({ status: "ready", rollbackActions: ["quarantine_channel"], evidenceCount: input.evidence?.length ?? 0 });
