import {
  buildTelegramPublicApplyPlan,
  buildTelegramPublicCanaryRollout,
  buildTelegramPublicCompactSearchSummary,
  buildTelegramPublicCutoverReport,
  buildTelegramPublicEvidencePromotionProgram,
  buildTelegramPublicIncrementalPollDto,
  buildTelegramPublicActorReadinessDto,
  buildTelegramPublicOperatorControlEffects,
  buildTelegramPublicOperatorStates,
  buildTelegramPublicPromotionCanaryProof,
  buildTelegramPublicPromotionCertification,
  buildTelegramPublicReliabilityReport,
  buildTelegramPublicSlaReport,
  buildTelegramPublicSourcePackCompatibility,
  buildTelegramPublicSourcePackReadiness,
  planTelegramPublicSearchBackfill,
  publicChannelEvidenceFromCapture,
  telegramPublicApplyPlanApiContract,
  type TelegramPublicApplyPlanAction,
  type TelegramPublicApplyPlanDto,
  type TelegramPublicApplyPlanStep,
  type TelegramPublicSourcePack
} from "../adapters/telegramPublic.ts";
import type { ScraperStore } from "../storage/memoryStore.ts";
import { nowIso } from "../utils.ts";

export interface PublicChannelApplyPlanRequestDto {
  query?: string;
  entityType?: string;
  clearWebEvidenceCount?: number;
  actions?: string[];
}

export interface PublicChannelStatusRequestDto {
  query: string;
  entityType?: string;
  cursor?: number;
  tenantId?: string;
}

export type PublicChannelStatusState =
  | "queued"
  | "partial"
  | "blocked"
  | "ready"
  | "rate_limited"
  | "policy_disabled"
  | "high_duplicate";

export interface PublicChannelApplyPlanRouteOptions {
  store: ScraperStore;
  publicTelegramSourcePacks?: TelegramPublicSourcePack[];
  generatedAt?: string;
}

export type PublicChannelApplyPlanRouteResult =
  | {
    ok: true;
    body: {
      contract: ReturnType<typeof telegramPublicApplyPlanApiContract>;
      applyPlan: TelegramPublicApplyPlanDto;
      canaryRollout: ReturnType<typeof buildTelegramPublicCanaryRollout>;
      promotionCanary: ReturnType<typeof buildTelegramPublicPromotionCanaryProof>;
      promotionCertification: ReturnType<typeof buildTelegramPublicPromotionCertification>;
    };
  }
  | {
    ok: false;
    status: 400;
    code: "invalid_action";
    message: string;
    details: {
      allowedActions: TelegramPublicApplyPlanAction[];
      invalidActions: string[];
    };
  };

export type PublicChannelStatusRouteResult =
  | {
    ok: true;
    body: {
      endpoint: "/v1/public-channels/status";
      status: PublicChannelStatusState;
      query: string;
      queryTerms: string[];
      queuedTasks: number;
      evidence: NonNullable<ReturnType<typeof publicChannelEvidenceFromCapture>>[];
      poll: ReturnType<typeof buildTelegramPublicIncrementalPollDto>;
      promotion: ReturnType<typeof buildTelegramPublicEvidencePromotionProgram>;
      cutoverReport: ReturnType<typeof buildTelegramPublicCutoverReport>;
      reliability: ReturnType<typeof buildTelegramPublicReliabilityReport>;
      abuseControls: ReturnType<typeof buildTelegramPublicCutoverReport>["abuseControls"];
      operatorStates: ReturnType<typeof buildTelegramPublicOperatorStates>;
      sourcePackCompatibility: ReturnType<typeof buildTelegramPublicSourcePackCompatibility>;
      sourcePackReadiness: ReturnType<typeof buildTelegramPublicSourcePackReadiness>;
      canaryRollout: ReturnType<typeof buildTelegramPublicCanaryRollout>;
      promotionCanary: ReturnType<typeof buildTelegramPublicPromotionCanaryProof>;
      promotionCertification: ReturnType<typeof buildTelegramPublicPromotionCertification>;
      actorReadiness: ReturnType<typeof buildTelegramPublicActorReadinessDto>;
      answerReadiness: ReturnType<typeof buildTelegramPublicCompactSearchSummary>;
      sla: ReturnType<typeof buildTelegramPublicSlaReport>;
      operatorControlEffects: ReturnType<typeof buildTelegramPublicOperatorControlEffects>;
      safeOutput: {
        rawPrivateDataExposed: false;
        rawMediaPayloadsExposed: false;
        credentialsExposed: false;
        mediaRetention: "metadata_only";
        piiMinimized: true;
      };
    };
  }
  | {
    ok: false;
    status: 400;
    code: "bad_request";
    message: string;
  };

const PUBLIC_CHANNEL_APPLY_ACTIONS: TelegramPublicApplyPlanAction[] = [
  "activate_source_pack",
  "request_review",
  "delay_poll",
  "refresh_cursor",
  "reduce_window",
  "quarantine_channel",
  "suppress_repeated_urls"
];

export function buildPublicChannelApplyPlanRouteResponse(
  input: PublicChannelApplyPlanRequestDto,
  options: PublicChannelApplyPlanRouteOptions
): PublicChannelApplyPlanRouteResult {
  const invalidActions = (input.actions ?? []).filter((action) => !PUBLIC_CHANNEL_APPLY_ACTIONS.includes(action as TelegramPublicApplyPlanAction));
  if (invalidActions.length > 0) {
    return {
      ok: false,
      status: 400,
      code: "invalid_action",
      message: "Unsupported public-channel apply-plan action",
      details: {
        allowedActions: PUBLIC_CHANNEL_APPLY_ACTIONS,
        invalidActions
      }
    };
  }

  const selectedActions = new Set((input.actions ?? []) as TelegramPublicApplyPlanAction[]);
  const applyPlan = buildTelegramPublicApplyPlan({
    query: input.query,
    entityType: input.entityType,
    clearWebEvidenceCount: input.clearWebEvidenceCount,
    sources: options.store.listSources(),
    sourcePacks: options.publicTelegramSourcePacks,
    generatedAt: options.generatedAt ?? nowIso()
  });
  const canaryRollout = buildTelegramPublicCanaryRollout({
    sources: options.store.listSources(),
    sourcePacks: options.publicTelegramSourcePacks,
    applyPlan,
    generatedAt: options.generatedAt
  });
  const promotionCanary = buildTelegramPublicPromotionCanaryProof({
    query: input.query,
    entityType: input.entityType,
    sources: options.store.listSources(),
    canaryRollout,
    applyPlan,
    generatedAt: options.generatedAt
  });
  const promotionCertification = buildTelegramPublicPromotionCertification({
    query: input.query,
    entityType: input.entityType,
    sources: options.store.listSources(),
    promotionCanary,
    generatedAt: options.generatedAt
  });

  return {
    ok: true,
    body: {
      contract: telegramPublicApplyPlanApiContract(),
      applyPlan: selectedActions.size > 0 ? filterTelegramPublicApplyPlan(applyPlan, selectedActions) : applyPlan,
      canaryRollout,
      promotionCanary,
      promotionCertification
    }
  };
}

export function buildPublicChannelStatusRouteResponse(
  input: PublicChannelStatusRequestDto,
  options: PublicChannelApplyPlanRouteOptions
): PublicChannelStatusRouteResult {
  if (!input.query.trim()) {
    return {
      ok: false,
      status: 400,
      code: "bad_request",
      message: "query is required"
    };
  }

  const sources = options.store.listSources();
  const backfill = planTelegramPublicSearchBackfill({
    query: input.query,
    entityType: input.entityType,
    sources,
    sourcePacks: options.publicTelegramSourcePacks,
    tenantId: input.tenantId,
    maxTasks: 8,
    queuedSourceIds: options.store.listPlans()
      .filter((plan) => !input.tenantId || plan.tenantId === input.tenantId)
      .flatMap((plan) => plan.tasks)
      .filter((task) => task.sourceType === "telegram_public")
      .map((task) => task.sourceId)
  });
  const queryTerms = backfill.queryTerms.map((term) => term.toLowerCase());
  const evidence = options.store.listCaptures()
    .filter((capture) => !input.tenantId || capture.tenantId === input.tenantId)
    .map(publicChannelEvidenceFromCapture)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => queryTerms.some((term) =>
      `${item.channel} ${item.snippet} ${item.extractedUrls.join(" ")}`.toLowerCase().includes(term)
    ))
    .slice(0, 20);
  const cutoverReport = buildTelegramPublicCutoverReport({
    query: input.query,
    entityType: input.entityType,
    sources,
    sourcePacks: options.publicTelegramSourcePacks,
    evidence,
    scheduler: {
      queuedSourceIds: backfill.tasks.map((task) => task.sourceId)
    },
    generatedAt: options.generatedAt
  });
  const promotion = buildTelegramPublicEvidencePromotionProgram({
    query: input.query,
    sources,
    evidence,
    previousUrls: sources.flatMap((source) => Array.isArray(source.metadata?.lastDiscoveredUrls) ? source.metadata.lastDiscoveredUrls.filter((value): value is string => typeof value === "string") : []),
    generatedAt: options.generatedAt
  });
  const poll = buildTelegramPublicIncrementalPollDto({
    cursor: input.cursor,
    evidence,
    promotedExtractionIds: promotion.promoted.map((item) => item.promotedExtractionId).filter((item): item is string => Boolean(item)),
    rateLimitResetAt: promotion.rateLimitBackoff[0]?.resetAt,
    generatedAt: options.generatedAt
  });
  const reliability = buildTelegramPublicReliabilityReport({
    query: input.query,
    entityType: input.entityType,
    sources,
    evidence,
    generatedAt: options.generatedAt
  });
  const operatorStates = buildTelegramPublicOperatorStates({
    sources,
    generatedAt: options.generatedAt,
    reliability
  });
  const sourcePackCompatibility = buildTelegramPublicSourcePackCompatibility({
    sources,
    sourcePacks: options.publicTelegramSourcePacks,
    generatedAt: options.generatedAt
  });
  const actorReadiness = buildTelegramPublicActorReadinessDto(reliability);
  const answerReadiness = buildTelegramPublicCompactSearchSummary({
    cutoverReport,
    reliability,
    operatorStates,
    actorReadiness
  });
  const operatorControlEffects = buildTelegramPublicOperatorControlEffects(cutoverReport.applyPlan);
  const sla = buildTelegramPublicSlaReport({
    cutoverReport,
    reliability,
    operatorStates,
    actorReadiness,
    operatorControlEffects,
    generatedAt: options.generatedAt
  });
  const sourcePackReadiness = buildTelegramPublicSourcePackReadiness({
    sources,
    sourcePacks: options.publicTelegramSourcePacks,
    evidence,
    reliability,
    sla,
    generatedAt: options.generatedAt
  });
  const canaryRollout = buildTelegramPublicCanaryRollout({
    sources,
    sourcePacks: options.publicTelegramSourcePacks,
    evidence,
    reliability,
    sla,
    applyPlan: cutoverReport.applyPlan,
    generatedAt: options.generatedAt
  });
  const promotionCanary = buildTelegramPublicPromotionCanaryProof({
    query: input.query,
    entityType: input.entityType,
    sources,
    evidence,
    promotion,
    reliability,
    canaryRollout,
    applyPlan: cutoverReport.applyPlan,
    generatedAt: options.generatedAt
  });
  const promotionCertification = buildTelegramPublicPromotionCertification({
    query: input.query,
    entityType: input.entityType,
    sources,
    evidence,
    promotionCanary,
    generatedAt: options.generatedAt
  });
  const status = publicChannelStatus({
    promotedCount: promotion.promoted.length,
    evidenceCount: evidence.length,
    queuedTaskCount: backfill.tasks.length,
    duplicateSuppressedCount: promotion.duplicateSuppressed.length,
    policyDisabledCount: promotion.policyDisabled.length + (cutoverReport.reconciliation.summary.policy_disabled ?? 0),
    rateLimitedCount: promotion.rateLimitBackoff.length + cutoverReport.summary.rateLimitedCount,
    blocked: backfill.status === "blocked"
  });

  return {
    ok: true,
    body: {
      endpoint: "/v1/public-channels/status",
      status,
      query: input.query,
      queryTerms: backfill.queryTerms,
      queuedTasks: backfill.tasks.length,
      evidence,
      poll,
      promotion,
      cutoverReport,
      reliability,
      abuseControls: cutoverReport.abuseControls,
      operatorStates,
      sourcePackCompatibility,
      sourcePackReadiness,
      canaryRollout,
      promotionCanary,
      promotionCertification,
      actorReadiness,
      answerReadiness,
      sla,
      operatorControlEffects,
      safeOutput: promotion.safeOutput
    }
  };
}

function publicChannelStatus(input: {
  promotedCount: number;
  evidenceCount: number;
  queuedTaskCount: number;
  duplicateSuppressedCount: number;
  policyDisabledCount: number;
  rateLimitedCount: number;
  blocked: boolean;
}): PublicChannelStatusState {
  if (input.promotedCount > 0) return "ready";
  if (input.evidenceCount > 0 && input.duplicateSuppressedCount / input.evidenceCount >= 0.4) return "high_duplicate";
  if (input.evidenceCount > 0) return "partial";
  if (input.policyDisabledCount > 0) return "policy_disabled";
  if (input.rateLimitedCount > 0) return "rate_limited";
  if (input.queuedTaskCount > 0) return "queued";
  return input.blocked ? "blocked" : "queued";
}

function filterTelegramPublicApplyPlan(
  applyPlan: TelegramPublicApplyPlanDto,
  selectedActions: Set<TelegramPublicApplyPlanAction>
): TelegramPublicApplyPlanDto {
  return summarizeTelegramPublicApplyPlan({
    ...applyPlan,
    steps: applyPlan.steps.filter((step) => selectedActions.has(step.action))
  });
}

function summarizeTelegramPublicApplyPlan(applyPlan: TelegramPublicApplyPlanDto): TelegramPublicApplyPlanDto {
  const priorityRank = { low: 1, medium: 2, high: 3 } as const;
  const highestPriority = applyPlan.steps
    .map((step) => step.priority)
    .sort((a, b) => priorityRank[b] - priorityRank[a])[0];
  const count = (predicate: (step: TelegramPublicApplyPlanStep) => boolean) => applyPlan.steps.filter(predicate).length;
  const automationSafeCount = count((step) => step.execution === "automation_safe");
  const humanApprovalRequiredCount = count((step) => step.execution === "human_approval_required");
  const blockedCount = count((step) => step.execution === "blocked");
  const rollbackOnlyCount = count((step) => step.execution === "rollback_only");
  return {
    ...applyPlan,
    summary: {
      stepCount: applyPlan.steps.length,
      automationSafeCount,
      humanApprovalRequiredCount,
      blockedCount,
      rollbackOnlyCount,
      highestPriority,
      canAutoApply: applyPlan.steps.length > 0 && applyPlan.steps.every((step) => step.execution === "automation_safe")
    },
    promotionGate: {
      publicChannelApplyPlanReady: blockedCount === 0,
      blockedUnsafeActivationCount: count((step) => step.action === "activate_source_pack" && step.execution === "blocked"),
      manualApprovalCount: humanApprovalRequiredCount,
      automationSafeCount,
      metadataOnlyMedia: true,
      piiMinimizationRequired: true
    }
  };
}
