// @ts-nocheck
import { buildTelegramPublicActorReadinessDto, buildTelegramPublicCanaryRollout, buildTelegramPublicCompactSearchSummary, buildTelegramPublicCutoverReport, buildTelegramPublicEvidencePromotionProgram, buildTelegramPublicIncrementalPollDto, buildTelegramPublicOperatorControlEffects, buildTelegramPublicOperatorStates, buildTelegramPublicPromotionCanaryProof, buildTelegramPublicPromotionCertification, buildTelegramPublicReliabilityReport, buildTelegramPublicSlaReport, buildTelegramPublicSourcePackCompatibility, buildTelegramPublicSourcePackReadiness, planTelegramPublicSearchBackfill, publicChannelEvidenceFromCapture } from "../adapters/telegramPublic.ts";
import { buildPublicSignalFusionWorkbench } from "../adapters/publicSignalFusion.ts";
import type { ScraperStore } from "../storage/memoryStore.ts";
import { nowIso } from "../utils.ts";
import { ACTIONS, abuse, certification, channelStatus, contract, enrichAnswer, enrichEffects, enrichPoll, enrichPromotion, enrichReliability, enrichStates, planSteps, promoteCanary, readiness, redact, rollout, strings, summarize } from "./publicChannelHelpers.ts";

export type PublicChannelStatusState = "queued" | "partial" | "blocked" | "ready" | "rate_limited" | "policy_disabled" | "high_duplicate";
export type PublicChannelApplyPlanRouteOptions = { store: ScraperStore; publicTelegramSourcePacks?: any[]; generatedAt?: string };

export function buildPublicChannelApplyPlanRouteResponse(input: any, options: PublicChannelApplyPlanRouteOptions): any {
  const invalidActions = (input.actions ?? []).filter((action) => !ACTIONS.includes(action));
  if (invalidActions.length) return { ok: false, status: 400, code: "invalid_action", message: "Unsupported public-channel apply-plan action", details: { allowedActions: ACTIONS, invalidActions } };
  const generatedAt = options.generatedAt ?? nowIso(), sources = options.store.listSources(), selected = new Set(input.actions ?? ["request_review"]);
  if (selected.has("activate_source_pack")) selected.delete("request_review");
  const applyPlan = summarize({ mode: "dry_run", generatedAt, steps: planSteps({ input, sources, packs: options.publicTelegramSourcePacks ?? [], selected }) });
  const canaryRollout = rollout(buildTelegramPublicCanaryRollout({ sources, sourcePacks: options.publicTelegramSourcePacks, applyPlan, generatedAt }), options.publicTelegramSourcePacks ?? []);
  const promotionCanary = promoteCanary(buildTelegramPublicPromotionCanaryProof({ query: input.query, entityType: input.entityType, sources, canaryRollout, applyPlan, generatedAt }));
  const promotionCertification = certification(buildTelegramPublicPromotionCertification({ query: input.query, entityType: input.entityType, sources, promotionCanary, generatedAt }));
  return { ok: true, body: redact({ contract: contract(), applyPlan, canaryRollout, promotionCanary, promotionCertification }) };
}

export function buildPublicChannelStatusRouteResponse(input: any, options: PublicChannelApplyPlanRouteOptions): any {
  if (!input.query.trim()) return { ok: false, status: 400, code: "bad_request", message: "query is required" };
  const sources = options.store.listSources(), packs = options.publicTelegramSourcePacks, generatedAt = options.generatedAt;
  const queuedSourceIds = options.store.listPlans().flatMap((p) => p.tasks ?? []).filter((t) => t.sourceType === "telegram_public").map((t) => t.sourceId);
  const captures = options.store.listCaptures();
  const backfill = planTelegramPublicSearchBackfill({ query: input.query, entityType: input.entityType, sources, sourcePacks: packs, tenantId: input.tenantId, maxTasks: 8, queuedSourceIds });
  const terms = backfill.queryTerms.map((term) => term.toLowerCase());
  const evidence = captures.map(publicChannelEvidenceFromCapture).filter(Boolean).filter((e) => terms.some((term) => `${e.channel} ${e.snippet} ${e.extractedUrls.join(" ")}`.toLowerCase().includes(term))).slice(0, 20);
  const cutoverReport = buildTelegramPublicCutoverReport({ query: input.query, entityType: input.entityType, sources, sourcePacks: packs, evidence, scheduler: { queuedSourceIds: backfill.tasks.map((t) => t.sourceId) }, generatedAt });
  cutoverReport.reconciliation.summary.high_edit_delete_churn ??= 0;
  const previousUrls = sources.flatMap((s) => strings(s.metadata?.lastDiscoveredUrls)), promotion = buildTelegramPublicEvidencePromotionProgram({ query: input.query, sources, evidence, previousUrls, generatedAt });
  enrichPromotion(promotion, sources, evidence);
  const poll = enrichPoll(buildTelegramPublicIncrementalPollDto({ cursor: input.cursor, evidence, promotedExtractionIds: promotion.promoted.map((item) => item.promotedExtractionId).filter(Boolean), rateLimitResetAt: promotion.rateLimitBackoff[0]?.resetAt, generatedAt }), captures);
  const reliability = buildTelegramPublicReliabilityReport({ query: input.query, entityType: input.entityType, sources, evidence, generatedAt });
  enrichReliability(reliability, promotion);
  const operatorStates = enrichStates(buildTelegramPublicOperatorStates({ sources, generatedAt, reliability }), sources);
  const sourcePackCompatibility = buildTelegramPublicSourcePackCompatibility({ sources, sourcePacks: packs, generatedAt }), actorReadiness = buildTelegramPublicActorReadinessDto(reliability);
  const answerReadiness = enrichAnswer(buildTelegramPublicCompactSearchSummary({ cutoverReport, reliability, operatorStates, actorReadiness }), reliability, promotion), operatorControlEffects = enrichEffects(buildTelegramPublicOperatorControlEffects(cutoverReport.applyPlan));
  const sla = buildTelegramPublicSlaReport({ cutoverReport, reliability, operatorStates, actorReadiness, operatorControlEffects, generatedAt });
  const sourcePackReadiness = readiness(buildTelegramPublicSourcePackReadiness({ sources, sourcePacks: packs, evidence, reliability, sla, generatedAt }), packs ?? []);
  const canaryRollout = rollout(buildTelegramPublicCanaryRollout({ sources, sourcePacks: packs, evidence, reliability, sla, applyPlan: cutoverReport.applyPlan, generatedAt }), packs ?? []);
  const promotionCanary = promoteCanary(buildTelegramPublicPromotionCanaryProof({ query: input.query, entityType: input.entityType, sources, evidence, promotion, reliability, canaryRollout, applyPlan: cutoverReport.applyPlan, generatedAt }));
  const promotionCertification = certification(buildTelegramPublicPromotionCertification({ query: input.query, entityType: input.entityType, sources, evidence, promotionCanary, generatedAt }));
  const publicSignalFusion = buildPublicSignalFusionWorkbench({ query: input.query, entityType: input.entityType, sources, sourcePacks: packs, evidence, tenantId: input.tenantId, previousUrls: [...promotion.duplicateSuppressed.map((item) => item.messageUrl), ...previousUrls], generatedAt });
  const status = channelStatus({ promotedCount: promotion.promoted.length, evidenceCount: evidence.length, queuedTaskCount: backfill.tasks.length, duplicateSuppressedCount: promotion.duplicateSuppressed.length, policyDisabledCount: promotion.policyDisabled.length, rateLimitedCount: promotion.rateLimitBackoff.length, blocked: backfill.status === "blocked" });
  return { ok: true, body: redact({ endpoint: "/v1/public-channels/status", status, query: input.query, queryTerms: backfill.queryTerms, queuedTasks: backfill.tasks.length, evidence, poll, promotion, cutoverReport, reliability, abuseControls: abuse(promotion), operatorStates, sourcePackCompatibility: Array.isArray(sourcePackCompatibility) ? sourcePackCompatibility : [], sourcePackReadiness, canaryRollout, promotionCanary, promotionCertification, actorReadiness, answerReadiness, sla, operatorControlEffects, publicSignalFusion, safeOutput: promotion.safeOutput }) };
}
