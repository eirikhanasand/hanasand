import type { AdapterRunResult, CollectedItem, CollectionTask, RawCapture, SourceRecord } from "../types.ts";
import { evaluateTaskForCollection } from "../policy/collectionPolicy.ts";
import { hashContent, normalizeWhitespace, nowIso } from "../utils.ts";
import type { CollectionAdapter } from "./base.ts";

export type TelegramAdapterFailureCategory =
  | "policy_blocked"
  | "rate_limited"
  | "timeout"
  | "transient_api"
  | "permanent_api"
  | "parse_error";

export interface TelegramPublicSourceConfig {
  channel: string;
  api: "bot_api" | "mtproto_library";
  pageSize: number;
  minIntervalSeconds: number;
  pagination?: TelegramPaginationState;
  pii: {
    minimize: boolean;
  };
}

export interface TelegramPublicChannelSourceModel {
  sourceId: string;
  tenantId?: string;
  channelHandle: string;
  channelId?: string;
  publicUrl: string;
  accessMethod: "official_api";
  approvalNotes: string;
  approvalScope?: string;
  legalStatus: "approved_public" | "pending_review" | "blocked";
  complianceStatus: "public_only" | "blocked_private_or_automation";
  topicTags: string[];
  language?: string;
  focus: {
    actors: string[];
    ransomware: string[];
    cves: string[];
    victims: string[];
    sectors: string[];
    countries: string[];
  };
  cursorState: TelegramPaginationState;
  rateLimitState: {
    resetAt?: string;
    minIntervalSeconds: number;
  };
  retentionClass: "public_chat_text" | "restricted_metadata";
}

export interface TelegramPaginationState {
  afterMessageId?: number;
  beforeMessageId?: number;
}

export interface TelegramPublicMessage {
  id: number;
  channel: string;
  url: string;
  date: string;
  editDate?: string;
  text: string;
  quotedText?: string;
  unavailable?: boolean;
  deleted?: boolean;
  pinned?: boolean;
  authorSignature?: string;
  forwardFrom?: string;
  forward?: TelegramPublicForwardMetadata;
  replyToMessageId?: number;
  threadId?: number;
  views?: number;
  links?: string[];
  media?: TelegramPublicMediaMetadata[];
  raw?: Record<string, unknown>;
}

export interface TelegramPublicForwardMetadata {
  fromChannel?: string;
  fromMessageId?: number;
  fromUrl?: string;
  date?: string;
}

export interface TelegramPublicMediaMetadata {
  type: "photo" | "video" | "document" | "audio" | "sticker" | "other";
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  thumbnailHash?: string;
}

export interface TelegramPublicFetchRequest {
  channel: string;
  limit: number;
  pagination: TelegramPaginationState;
  task?: CollectionTask;
}

export interface TelegramPublicFetchResult {
  messages: TelegramPublicMessage[];
  nextPagination?: TelegramPaginationState;
  rateLimitResetAt?: string;
  deletedMessageIds?: number[];
  unavailableMessageIds?: number[];
  failureCategory?: TelegramAdapterFailureCategory;
  failureMessage?: string;
  warnings?: string[];
}

export interface OfficialTelegramClient {
  fetchPublicChannelMessages(request: TelegramPublicFetchRequest): Promise<TelegramPublicFetchResult>;
}

export interface TelegramPublicChannelSearchHit {
  channelHandle: string;
  publicUrl: string;
  title?: string;
  description?: string;
  subscriberCount?: number;
  language?: string;
  topicTags?: string[];
  confidence?: number;
  provenance: {
    api: "mtproto_library" | "bot_api" | "operator_seed";
    method: "contacts.search" | "messages.searchGlobal" | "getUpdates" | "operator_seed";
    searchedAt: string;
    query: string;
  };
}

export interface TelegramPublicMessageSearchHit extends TelegramPublicMessage {
  sourceId?: string;
  matchedTerms: string[];
  provenance: {
    api: "mtproto_library" | "bot_api";
    method: "messages.searchGlobal" | "getUpdates";
    searchedAt: string;
    query: string;
  };
}

export interface OfficialTelegramSearchClient {
  searchPublicChannels?(request: { query: string; limit: number }): Promise<TelegramPublicChannelSearchHit[]>;
  searchPublicMessages?(request: { query: string; limit: number; channels?: string[] }): Promise<TelegramPublicMessageSearchHit[]>;
}

export type TelegramFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface TelegramBotApiClientOptions {
  token: string;
  fetcher?: TelegramFetch;
  apiBaseUrl?: string;
  now?: () => Date;
}

export interface TelegramPublicSearchInput {
  query: string;
  entityType?: string;
  sources: SourceRecord[];
  sourcePacks?: TelegramPublicSourcePack[];
  client: OfficialTelegramClient;
  officialSearchClient?: OfficialTelegramSearchClient;
  createdAt?: string;
  tenantId?: string;
  intelRequestId?: string;
  maxTasks?: number;
  maxGlobalResults?: number;
  previousUrls?: string[];
}

export interface TelegramPublicSearchResultDto {
  generatedAt: string;
  query: string;
  queryTerms: string[];
  status: "ready" | "partial" | "pending_source_activation" | "blocked";
  searchedChannels: Array<{
    sourceId: string;
    channelHandle: string;
    itemCount: number;
    matchedItemCount: number;
    warningCount: number;
  }>;
  candidateChannels: TelegramPublicChannelSearchHit[];
  globalMessageHits: TelegramPublicMessageSearchHit[];
  matchedItems: CollectedItem[];
  evidence: TelegramPublicEvidenceDto[];
  backfill: TelegramPublicSearchBackfillPlan;
  promotion: TelegramPublicPromotionProgramDto;
  reliability: TelegramPublicReliabilityReportDto;
  operatorStates: TelegramPublicOperatorStateDto[];
  compactSummary: TelegramPublicCompactSearchSummaryDto;
  warnings: string[];
  safety: {
    publicChannelsOnly: true;
    officialApisOnly: true;
    accountCreationAutomated: false;
    privateJoinOrInviteUsed: false;
    darknetBrowsingUsed: false;
    rawMediaPayloadsFetched: false;
    piiMinimized: true;
  };
}

export interface TelegramCrawlStateOutput {
  channel: string;
  afterMessageId?: number;
  beforeMessageId?: number;
  nextAfterMessageId?: number;
  nextBeforeMessageId?: number;
  rateLimitResetAt?: string;
  lastMessageDate?: string;
  lastMessageId?: number;
  fetchDurationMs: number;
}

export interface TelegramPublicQueryWindowPlan {
  tasks: CollectionTask[];
  blocked: Array<{ sourceId: string; reason: string }>;
  skipped: Array<{ sourceId: string; reason: string }>;
  queryTerms: string[];
}

export interface TelegramPublicActivationRecommendation {
  sourceId: string;
  channelHandle: string;
  publicUrl: string;
  reason: string;
  coverageTags: string[];
  requiredAction: "review" | "approve" | "activate" | "fix_policy";
  sourcePackId?: string;
  sourcePackName?: string;
}

export interface TelegramPublicSearchBackfillPlan extends TelegramPublicQueryWindowPlan {
  status: "partial" | "pending_channel_search" | "blocked";
  activationRecommendations: TelegramPublicActivationRecommendation[];
  coverageGaps: TelegramPublicCoverageGapExplanation[];
  sourcePackRecommendations: TelegramPublicSourcePackRecommendation[];
  activationProgram: TelegramPublicActivationProgramDto;
  reconciliation: TelegramPublicReconciliationDto;
  cutoverReport: TelegramPublicCutoverReportDto;
}

export type TelegramPublicReliabilityRating = "healthy" | "watch" | "degraded" | "quarantine" | "blocked";

export interface TelegramPublicReliabilityInput {
  query?: string;
  entityType?: string;
  language?: string;
  sources: SourceRecord[];
  evidence?: TelegramPublicEvidenceDto[];
  healthUpdates?: TelegramPublicSourceHealthUpdate[];
  generatedAt?: string;
}

export interface TelegramPublicReliabilitySourceDto {
  sourceId: string;
  channelHandle: string;
  publicUrl: string;
  score: number;
  rating: TelegramPublicReliabilityRating;
  needsReview: boolean;
  partialEvidenceOnly: boolean;
  metrics: {
    freshness: number;
    duplicateUrlRatio: number;
    editDeleteChurn: number;
    unavailableWindowRatio: number;
    languageCoverage: number;
    topicFit: number;
    rateLimitPenalty: number;
    promotionYield: number;
  };
  latestEvidenceAt?: string;
  latestMessageId?: number;
  recommendedActions: TelegramPublicRepairAction[];
  reasons: string[];
}

export interface TelegramPublicReliabilityReportDto {
  generatedAt: string;
  query?: string;
  queryTerms: string[];
  sources: TelegramPublicReliabilitySourceDto[];
  summary: {
    sourceCount: number;
    healthyCount: number;
    watchCount: number;
    degradedCount: number;
    quarantineCount: number;
    blockedCount: number;
    needsReviewCount: number;
    averageScore: number;
  };
  safeOutput: {
    rawPrivateDataExposed: false;
    rawMediaPayloadsExposed: false;
    credentialsExposed: false;
    mediaRetention: "metadata_only";
    piiMinimized: true;
  };
}

export type TelegramPublicOperatorState =
  | "actively_collectable"
  | "delayed"
  | "pending_review"
  | "quarantined"
  | "policy_blocked";

export interface TelegramPublicOperatorStateDto {
  sourceId: string;
  channelHandle: string;
  state: TelegramPublicOperatorState;
  reason: string;
  nextEligibleAt?: string;
  reviewRequired: boolean;
  collectable: boolean;
}

export interface TelegramPublicSourcePackCompatibilityDto {
  sourceId: string;
  sourcePackId?: string;
  sourcePackName?: string;
  channelHandle: string;
  publicUrl: string;
  compatible: boolean;
  approvalState: SourceApprovalStateLike;
  channelPublicnessProof: {
    publicUrlParseable: boolean;
    inviteOrPrivateUrl: boolean;
    accountAutomationFieldsPresent: boolean;
  };
  retentionClass: "public_chat_text" | "restricted_metadata";
  coverageTags: string[];
  abuseControlDefaults: {
    pageSize: number;
    minIntervalSeconds: number;
    publicQueryWindowLimit: number;
    mediaRetention: "metadata_only";
    piiMinimized: true;
  };
  notes: string[];
}

export interface TelegramPublicSourcePackReadinessDto {
  generatedAt: string;
  status: "ready" | "review_required" | "blocked";
  summary: {
    sourcePackCount: number;
    candidateCount: number;
    approvedPublicCount: number;
    blockedCount: number;
    replayableEvidenceCount: number;
    releaseHold: boolean;
  };
  sources: Array<{
    sourceId: string;
    sourcePackId?: string;
    sourcePackName?: string;
    channelHandle: string;
    publicUrl: string;
    approvalScope: "public_requires_review" | "metadata_only" | "disabled" | "approved_public" | "unknown";
    approvalState: SourceApprovalStateLike;
    collectionWindow: {
      pageSize: number;
      minIntervalSeconds: number;
      expectedRequestsPerHour?: number;
      publicQueryWindowLimit: number;
    };
    rateLimitBudget: {
      bounded: boolean;
      resetAt?: string;
      delayed: boolean;
    };
    dedupePolicy: {
      repeatedUrlSuppression: true;
      contentHashRequired: true;
      duplicateUrlPressure: "low" | "watch" | "high";
    };
    editDeleteHandling: {
      editedMessagesPreserved: true;
      deletedUnavailableReplayableAsMetadata: true;
      churn: "low" | "watch" | "high";
    };
    languageHints: string[];
    coverage: {
      actors: string[];
      ransomware: string[];
      cves: string[];
      victims: string[];
      sectors: string[];
      countries: string[];
      topicTags: string[];
    };
    replayableEvidenceHandoff: {
      targetAgent: "agent_06";
      ledgerIds: string[];
      messageUrls: string[];
      cursorReplayReady: boolean;
      metadataOnly: true;
    };
    answerCaveats: {
      targetAgent: "agent_07";
      caveatCodes: string[];
      readiness: "ready" | "partial" | "needs_review";
    };
    releaseGate: {
      targetAgent: "agent_10";
      status: "pass" | "warning" | "blocker";
      reasons: string[];
    };
  }>;
  safeOutput: {
    rawPrivateDataExposed: false;
    rawMediaPayloadsExposed: false;
    credentialsExposed: false;
    mediaRetention: "metadata_only";
    piiMinimized: true;
  };
}

export interface TelegramPublicCanaryRolloutDto {
  generatedAt: string;
  mode: "dry_run";
  status: "ready" | "watch" | "hold";
  summary: {
    approvedSourceCount: number;
    selectedSourceCount: number;
    pendingReviewCount: number;
    pausedOrQuarantinedCount: number;
    rollbackStepCount: number;
    replayableEvidenceCount: number;
    maxParallelSources: number;
    releaseTrain: "canary_ready" | "canary_with_warnings" | "hold";
  };
  selectedSources: Array<{
    sourceId: string;
    channelHandle: string;
    phase: "first_channel" | "five_channel";
    collectionWindow: {
      pageSize: number;
      minIntervalSeconds: number;
      expectedRequestsPerHour: number;
      publicQueryWindowLimit: number;
    };
    rateLimitEnvelope: {
      bounded: boolean;
      delayed: boolean;
      resetAt?: string;
      maxRequestsPerHour: number;
    };
    queryDedupe: {
      repeatedActorQuerySuppression: true;
      repeatedUrlSuppression: true;
      suppressedUrlCount: number;
      duplicateUrlPressure: "low" | "watch" | "high";
    };
    languageCoverage: {
      hints: string[];
      status: "covered" | "unknown" | "mismatch";
    };
    spamChurnDetection: {
      duplicateUrlPressure: "low" | "watch" | "high";
      editDeleteChurn: "low" | "watch" | "high";
      unavailableWindowPressure: "low" | "watch" | "high";
    };
    replay: {
      editedMessages: number;
      deletedOrUnavailableMessages: number;
      cursorReplayReady: boolean;
      ledgerIds: string[];
    };
    agent06EvidenceHandoff: {
      verified: boolean;
      ledgerIds: string[];
      metadataOnly: true;
    };
    agent07AnswerCaveats: string[];
    agent10ReleaseTrain: {
      status: "pass" | "warning" | "blocker";
      reasons: string[];
    };
  }>;
  pendingCandidates: Array<{
    sourceId: string;
    channelHandle: string;
    sourcePackId?: string;
    requiredAction: "review" | "approve" | "activate";
    coverageTags: string[];
  }>;
  controls: {
    queryDedupe: {
      repeatedActorQueryControls: true;
      actorQueryCooldownSeconds: number;
      duplicateUrlSuppression: true;
    };
    abuse: {
      burstySpamDetection: true;
      editDeleteReplay: true;
      unavailableWindowHandling: "metadata_only_replay";
      sourcePauseQuarantine: true;
    };
    rollback: {
      dryRunOnly: true;
      rollbackActions: TelegramPublicApplyPlanAction[];
      sourcePauseSupported: true;
      quarantineSupported: true;
    };
  };
  safeOutput: {
    rawPrivateDataExposed: false;
    rawMediaPayloadsExposed: false;
    credentialsExposed: false;
    mediaRetention: "metadata_only";
    piiMinimized: true;
  };
}

export interface TelegramPublicPromotionCanaryProofDto {
  generatedAt: string;
  mode: "dry_run";
  status: "pass" | "warning" | "hold";
  summary: {
    sourceCount: number;
    evidenceCount: number;
    promotedEvidenceCount: number;
    claimCandidateCount: number;
    graphHintCount: number;
    replayableEvidenceCount: number;
    lowYieldSourceCount: number;
    rollbackTriggerCount: number;
    noLeakSerialization: true;
  };
  sourceHealth: Array<{
    sourceId: string;
    channelHandle: string;
    rateLimitDebt: "none" | "delayed";
    duplicateUrlPressure: "low" | "watch" | "high";
    editDeleteChurn: "low" | "watch" | "high";
    unavailableWindows: "low" | "watch" | "high";
    languageDrift: "none" | "watch";
    spamChurn: "low" | "watch" | "high";
    evidenceYield: number;
    claimYield: number;
    rollbackTriggers: TelegramPublicApplyPlanAction[];
  }>;
  evidenceFlow: Array<{
    sourceId: string;
    messageUrl: string;
    messageId?: number;
    contentHash?: string;
    state: "available" | "edited" | "deleted" | "unavailable";
    replayable: boolean;
    promotedToAgent06: boolean;
    claimCandidateIds: string[];
    graphHintIds: string[];
  }>;
  claimCandidates: Array<{
    claimId: string;
    sourceId: string;
    ledgerId: string;
    kind: "actor" | "cve" | "victim" | "ransomware" | "sector" | "country" | "url";
    value: string;
    confidence: number;
    needsReview: boolean;
  }>;
  graphHints: Array<{
    hintId: string;
    sourceId: string;
    ledgerId: string;
    relationship: "actor-cve" | "actor-victim" | "ransomware-victim" | "actor-sector" | "actor-country" | "message-url";
    endpointIds: string[];
    reviewRequired: boolean;
  }>;
  handoffs: {
    agent06EvidenceCutover: {
      replayableLedgerIds: string[];
      promotedMessageUrls: string[];
      evidenceCutoverReady: boolean;
    };
    agent07PublicAnswer: {
      caveatCodes: string[];
      answerState: "ready" | "partial" | "needs_review";
    };
    agent10RcGate: {
      status: "pass" | "warning" | "blocker";
      reasons: string[];
    };
  };
  safeOutput: {
    rawPrivateDataExposed: false;
    rawMediaPayloadsExposed: false;
    credentialsExposed: false;
    mediaRetention: "metadata_only";
    piiMinimized: true;
  };
}

export interface TelegramPublicPromotionCertificationDto {
  generatedAt: string;
  mode: "dry_run";
  status: "certified" | "review_required" | "blocked";
  summary: {
    certifiedEvidenceCount: number;
    heldEvidenceCount: number;
    blockedEvidenceCount: number;
    answerEligibleClaimCount: number;
    graphEligibleHintCount: number;
    sourceHealthUpdateCount: number;
    releaseDecision: "promote" | "watch" | "hold";
    rollbackRequired: boolean;
    noLeakSerialization: true;
  };
  decisionRules: Array<{
    ruleId: string;
    surface: "public_answer" | "graph" | "source_health" | "release";
    allowWhen: string[];
    holdWhen: string[];
    current: "allow" | "hold" | "block";
  }>;
  evidenceCertification: Array<{
    ledgerId: string;
    sourceId: string;
    messageUrl: string;
    state: "available" | "edited" | "deleted" | "unavailable";
    influence: "answer_and_graph" | "source_health_only" | "blocked";
    publicAnswerAllowed: boolean;
    graphHintAllowed: boolean;
    sourceHealthUpdateAllowed: true;
    releaseEligible: boolean;
    reasons: string[];
  }>;
  claimCertification: Array<{
    claimId: string;
    kind: "actor" | "cve" | "victim" | "ransomware" | "sector" | "country" | "url";
    value: string;
    answerInfluence: "ready" | "partial" | "blocked";
    reasons: string[];
  }>;
  graphCertification: Array<{
    hintId: string;
    relationship: "actor-cve" | "actor-victim" | "ransomware-victim" | "actor-sector" | "actor-country" | "message-url";
    influence: "candidate" | "review_required" | "blocked";
    agent08GraphCertification: "certified_candidate" | "needs_review" | "blocked";
    reasons: string[];
  }>;
  handoffs: {
    agent06EvidenceCertification: {
      certifiedLedgerIds: string[];
      heldLedgerIds: string[];
      blockedLedgerIds: string[];
    };
    agent07AnswerStateMachine: {
      state: "ready" | "partial" | "needs_review";
      answerMayUseEvidence: boolean;
      transition: "promote_public_channel_claims" | "keep_partial_with_caveats" | "block_public_channel_claims";
      caveatCodes: string[];
    };
    agent08GraphCertification: {
      status: "certified" | "review_required" | "blocked";
      candidateHintIds: string[];
      reviewRequiredHintIds: string[];
      blockedHintIds: string[];
    };
    agent10RcGate: {
      status: "pass" | "warning" | "blocker";
      decision: "promote" | "watch" | "hold";
      reasons: string[];
      rollbackActions: TelegramPublicApplyPlanAction[];
    };
  };
  safeOutput: {
    rawPrivateDataExposed: false;
    rawMediaPayloadsExposed: false;
    credentialsExposed: false;
    mediaRetention: "metadata_only";
    piiMinimized: true;
  };
}

export type SourceApprovalStateLike = "not_required" | "pending" | "approved" | "rejected" | "expired" | "candidate";

export interface TelegramPublicActorReadinessDto {
  status: "ready" | "partial" | "needs_review";
  downgradeReasons: string[];
  sourceRatings: Array<{
    sourceId: string;
    rating: TelegramPublicReliabilityRating;
    partialEvidenceOnly: boolean;
    needsReview: boolean;
  }>;
}

export interface TelegramPublicAnswerReadinessDto {
  generatedAt: string;
  sourceId?: string;
  status: "ready" | "partial" | "needs_review";
  downgradeReasons: string[];
  ledgerLinks: Array<{
    sourceId: string;
    messageId?: number;
    messageUrl: string;
    ledgerId: string;
    deltaKind: "new" | "edited" | "deleted_or_unavailable" | "unchanged";
    state: "available" | "deleted" | "unavailable";
    contentHash?: string;
    confidence: number;
    promotedToAgent06: boolean;
  }>;
  agent06: {
    targetAgent: "agent_06";
    promotedLedgerIds: string[];
    promotedCount: number;
    extractionInputCount: number;
    ledgerBackedClaimYield: {
      ledgerBackedClaimCount: number;
      candidateClaimCount: number;
      ratio: number;
      enforcementState: "pass" | "warning" | "hold";
    };
  };
  agent07: {
    claimStatus: "ready" | "partial_evidence" | "needs_review";
    analystReviewState: "not_required" | "queued" | "required";
    enforcementState: "pass" | "warning" | "hold";
    caveatCodes: string[];
    downgradeReasons: string[];
  };
  safeOutput: {
    rawPrivateDataExposed: false;
    rawMediaPayloadsExposed: false;
    credentialsExposed: false;
    mediaRetention: "metadata_only";
    piiMinimized: true;
  };
}

export interface TelegramPublicOperatorControlEffectDto {
  action: TelegramPublicApplyPlanAction;
  execution: TelegramPublicApplyPlanExecution;
  sourceId?: string;
  channelHandle?: string;
  expectedAnswerQualityEffect:
    | "delays_freshness_keeps_claims_partial"
    | "reduces_noise_improves_precision"
    | "stops_untrusted_evidence_requires_review"
    | "queues_human_review_for_readiness"
    | "restores_delta_continuity"
    | "reduces_duplicate_claim_pressure"
    | "no_answer_change";
  expectedFreshnessEffect: "delayed" | "reduced_window" | "paused" | "review_pending" | "cursor_refreshed" | "unchanged";
  expectedPromotionEffect: "hold_promotions" | "reduce_promotions" | "resume_promotions" | "suppress_duplicate_promotions" | "unchanged";
  keepsEvidencePartial: boolean;
  requiresReview: boolean;
  safeOutput: {
    rawPrivateDataExposed: false;
    rawMediaPayloadsExposed: false;
    credentialsExposed: false;
    mediaRetention: "metadata_only";
    piiMinimized: true;
  };
}

export interface TelegramPublicCompactSearchSummaryDto {
  generatedAt: string;
  freshness: {
    latestMessageTimestamp?: string;
    latestMessageId?: number;
    safePartialEvidenceCount: number;
    publicChannelAddsEvidence: boolean;
  };
  reliability: {
    sourceCount: number;
    rating: TelegramPublicReliabilityRating | "none";
    needsReviewCount: number;
    averageScore: number;
  };
  promotionYield: {
    rating: "none" | "low" | "medium" | "high";
    promotedCount: number;
    evidenceCount: number;
  };
  operatorStateCounts: Record<TelegramPublicOperatorState, number>;
  answerReadiness: {
    status: TelegramPublicActorReadinessDto["status"];
    downgradeReasonCount: number;
  };
}

export interface TelegramPublicSlaReportDto {
  generatedAt: string;
  status: "pass" | "warning" | "blocker";
  enforcement: {
    status: "pass" | "warning" | "hold";
    releaseAction: "promote" | "promote_with_warnings" | "hold_on_blocker";
    checks: Array<{
      name:
        | "cursor_freshness"
        | "rate_limit_debt"
        | "collection_success"
        | "duplicate_url_pressure"
        | "edit_delete_churn"
        | "unavailable_windows"
        | "promotion_yield"
        | "ledger_backed_claim_yield"
        | "answer_readiness";
      state: "pass" | "warning" | "hold";
      reason: string;
      value: number | string;
      threshold: string;
      answerImpact: "none" | "partial" | "review_required" | "blocked";
    }>;
    agent06LedgerHandoff: {
      state: "pass" | "warning" | "hold";
      ledgerBackedClaimCount: number;
      candidateClaimCount: number;
      ratio: number;
    };
    agent07AnswerReadiness: {
      state: "pass" | "warning" | "hold";
      claimStatus: "ready" | "partial_evidence" | "needs_review";
      analystReviewState: "not_required" | "queued" | "required";
      downgradeReasonCount: number;
    };
    agent10ReleasePacket: {
      runtimeProofName: "public_channel_sla";
      status: "pass" | "warning" | "blocker";
      decisionImpact: "promote" | "promote_with_warnings" | "hold_on_blocker";
    };
  };
  releaseGate: {
    owner: "Agent 04";
    agent10ProofName: "public_channel_sla";
    decisionImpact: "promote" | "promote_with_warnings" | "hold_on_blocker";
    proofCommand: "bun test src/tests/telegramPublic.test.ts";
    rollbackPath: "keep public-channel collection in partial/read-only mode and leave outer fallback active";
    blockers: string[];
    warnings: string[];
  };
  metrics: {
    cursorFreshness: {
      averageScore: number;
      staleSourceCount: number;
      latestMessageTimestamp?: string;
    };
    collectionSuccess: {
      healthyOrWatchCount: number;
      sourceCount: number;
      ratio: number;
    };
    rateLimitDebt: {
      delayedSourceCount: number;
      averagePenalty: number;
    };
    duplicateUrlPressure: {
      averageRatio: number;
      highPressureSourceCount: number;
    };
    editDeleteChurn: {
      averageRatio: number;
      highChurnSourceCount: number;
    };
    unavailableWindows: {
      averageRatio: number;
      affectedSourceCount: number;
    };
    languageTopicFit: {
      averageLanguageCoverage: number;
      averageTopicFit: number;
    };
    promotionYield: {
      averageRatio: number;
      lowYieldSourceCount: number;
    };
    ledgerBackedClaimYield: {
      ledgerBackedClaimCount: number;
      candidateClaimCount: number;
      ratio: number;
    };
    answerReadinessImpact: {
      status: TelegramPublicActorReadinessDto["status"];
      downgradeReasonCount: number;
      partialEvidenceOnly: boolean;
    };
  };
  controls: TelegramPublicOperatorControlEffectDto[];
  safeOutput: {
    rawPrivateDataExposed: false;
    rawMediaPayloadsExposed: false;
    credentialsExposed: false;
    mediaRetention: "metadata_only";
    piiMinimized: true;
  };
}

export interface TelegramPublicRuntimeConnectorContractDto {
  generatedAt: string;
  sourceId: string;
  channelHandle: string;
  operatorState: TelegramPublicOperatorStateDto;
  cursorLease: {
    leaseKey: string;
    requested: TelegramPaginationState;
    next: TelegramPaginationState;
    lastMessageId?: number;
    lastMessageDate?: string;
  };
  rateLimitState: {
    minIntervalSeconds: number;
    resetAt?: string;
    retryAfterSeconds?: number;
  };
  windowSizing: {
    requested: number;
    effective: number;
    perChannelLimit: number;
    suppressedUrlCount: number;
    notes: string[];
  };
  sourceHealthPatch: TelegramPublicSourceHealthUpdate;
  publicMessageProvenance: Array<{
    sourceId: string;
    channel: string;
    messageId?: number;
    messageUrl: string;
    messageTimestamp?: string;
    contentHash?: string;
    confidence: number;
    state: "available" | "deleted" | "unavailable";
  }>;
  deltas: {
    newMessageIds: number[];
    editedMessageIds: number[];
    deletedOrUnavailableMessageIds: number[];
  };
  promotionHandoff: {
    promotedCount: number;
    extractionInputCount: number;
    targetAgent: "agent_06";
    promotedMessageUrls: string[];
    partialEvidenceOnly: boolean;
  };
  actorReadiness: TelegramPublicActorReadinessDto;
  answerReadiness: TelegramPublicAnswerReadinessDto;
  safeOutput: {
    rawPrivateDataExposed: false;
    rawMediaPayloadsExposed: false;
    credentialsExposed: false;
    mediaRetention: "metadata_only";
    piiMinimized: true;
  };
}

export interface TelegramPublicEvidenceDto {
  sourceId: string;
  channel: string;
  messageUrl: string;
  messageTimestamp?: string;
  snippet: string;
  extractedUrls: string[];
  forward?: TelegramPublicForwardMetadata;
  replyToMessageId?: number;
  media?: {
    retention: "metadata_only";
    rawFetchAllowed: false;
    items: TelegramPublicMediaMetadata[];
  };
  languageHint?: string;
  extractionHandoff?: {
    actorAliases: string[];
    cves: string[];
    victims: string[];
    uncertaintyMarkers: string[];
  };
  confidence: number;
  messageId?: number;
  messageState?: "available" | "deleted" | "unavailable";
  editedAt?: string;
  contentHash?: string;
  promotedExtractionId?: string;
}

export interface TelegramPublicPromotionInput {
  evidence: TelegramPublicEvidenceDto;
  source: SourceRecord;
  task?: CollectionTask;
  promotedAt?: string;
  promotedBy?: "planner" | "collector" | "pipeline" | "manual";
  query?: string;
  mediaPayload?: unknown;
}

export type TelegramPublicPromotionResult =
  | {
    allowed: true;
    item: CollectedItem;
    extractionInput: {
      sourceId: string;
      taskId?: string;
      url: string;
      collectedAt: string;
      publishedAt?: string;
      rawText: string;
      contentHash: string;
      metadata: Record<string, unknown>;
    };
  }
  | {
    allowed: false;
    reason: string;
  };

export interface TelegramPublicPromotionProgramInput {
  query: string;
  sources: SourceRecord[];
  evidence: TelegramPublicEvidenceDto[];
  previousUrls?: string[];
  generatedAt?: string;
}

export interface TelegramPublicPromotionProgramDto {
  generatedAt: string;
  query: string;
  status: "ready" | "partial" | "blocked";
  candidates: TelegramPublicEvidenceDto[];
  promoted: Array<{
    sourceId: string;
    messageUrl: string;
    contentHash: string;
    promotedExtractionId?: string;
    extractionHandoff: TelegramPublicEvidenceDto["extractionHandoff"];
  }>;
  duplicateSuppressed: Array<{ sourceId: string; messageUrl: string; reason: "duplicate_url" | "duplicate_hash" }>;
  editedMessages: TelegramPublicEvidenceDto[];
  deletedOrUnavailable: TelegramPublicEvidenceDto[];
  blocked: Array<{ sourceId: string; messageUrl?: string; reason: string }>;
  rateLimitBackoff: Array<{ sourceId: string; channelHandle: string; resetAt: string }>;
  policyDisabled: Array<{ sourceId: string; reason: string }>;
  safeOutput: {
    rawPrivateDataExposed: false;
    rawMediaPayloadsExposed: false;
    credentialsExposed: false;
    mediaRetention: "metadata_only";
    piiMinimized: true;
  };
}

export type TelegramPublicRuntimeStatus =
  | "ready"
  | "partial"
  | "blocked"
  | "rate_limited"
  | "policy_disabled"
  | "unavailable"
  | "high_duplicate"
  | "high_churn";

export interface TelegramPublicRuntimeCollectionInput {
  source: SourceRecord;
  task?: CollectionTask;
  result: AdapterRunResult;
  query?: string;
  previousUrls?: string[];
  generatedAt?: string;
}

export interface TelegramPublicRuntimeCollectionDto {
  generatedAt: string;
  sourceId: string;
  channelHandle: string;
  status: TelegramPublicRuntimeStatus;
  connector: TelegramPublicRuntimeConnectorContractDto;
  cursorWindow: {
    requested: TelegramPaginationState;
    next: TelegramPaginationState;
    lastMessageId?: number;
    lastMessageDate?: string;
  };
  collection: {
    itemCount: number;
    newCount: number;
    editedCount: number;
    deletedOrUnavailableCount: number;
    duplicateSuppressedCount: number;
    urlMentionCount: number;
    forwardCount: number;
    replyCount: number;
    mediaMetadataCount: number;
    warnings: string[];
  };
  evidence: TelegramPublicEvidenceDto[];
  poll: TelegramPublicIncrementalPollDto;
  promotion: TelegramPublicPromotionProgramDto;
  promotedItems: CollectedItem[];
  extractionInputs: Array<{
    sourceId: string;
    taskId?: string;
    url: string;
    collectedAt: string;
    publishedAt?: string;
    rawText: string;
    contentHash: string;
    metadata: Record<string, unknown>;
  }>;
  sourcePatch: Pick<SourceRecord, "id" | "updatedAt" | "crawlState" | "metadata">;
  schedulerHints: {
    acknowledge: "complete" | "retry" | "block" | "quarantine";
    retryAfterSeconds?: number;
    reason: string;
  };
  safeOutput: {
    privateDataExposed: false;
    mediaPayloadsExposed: false;
    credentialsExposed: false;
    mediaRetention: "metadata_only";
    piiMinimized: true;
  };
}

export interface TelegramPublicAbuseControlInput {
  source: SourceRecord;
  requestedWindow?: number;
  now?: string;
  urls?: string[];
  previousUrls?: string[];
  query?: string;
  entityType?: string;
  language?: string;
  topicTags?: string[];
}

export interface TelegramPublicAbuseControlDto {
  allowed: boolean;
  channel: string;
  requestedWindow: number;
  effectiveWindow: number;
  perChannelWindowLimit: number;
  rateLimitResetAt?: string;
  cooldownResetAt?: string;
  queryTerms: string[];
  coverageMatched: boolean;
  languageMatched: boolean;
  suppressedUrls: string[];
  notes: string[];
}

export interface TelegramPublicIncrementalPollInput {
  cursor?: number;
  evidence: TelegramPublicEvidenceDto[];
  promotedExtractionIds?: string[];
  rateLimitResetAt?: string;
  generatedAt?: string;
}

export interface TelegramPublicIncrementalPollDto {
  cursor?: number;
  nextCursor?: number;
  cursorState: TelegramPaginationState;
  generatedAt: string;
  newMessages: TelegramPublicEvidenceDto[];
  updatedMessages: TelegramPublicEvidenceDto[];
  deletedOrUnavailable: TelegramPublicEvidenceDto[];
  forwardedMessages: TelegramPublicEvidenceDto[];
  urlMentionedMessages: TelegramPublicEvidenceDto[];
  promotedExtractionIds: string[];
  rateLimitResetAt?: string;
  media: {
    retention: "metadata_only";
    rawFetchAllowed: false;
  };
}

export type TelegramPublicCoverageGapReason =
  | "no_approved_channels"
  | "matching_channels_rate_limited"
  | "matching_channels_pending_review"
  | "matching_channels_disabled_by_policy"
  | "matching_channels_actively_queued";

export interface TelegramPublicCoverageGapExplanation {
  reason: TelegramPublicCoverageGapReason;
  sourceId?: string;
  channelHandle?: string;
  publicUrl?: string;
  requiredAction: "approve" | "activate" | "wait" | "fix_policy" | "none";
  message: string;
  coverageTags: string[];
  availableAt?: string;
}

export interface TelegramPublicActivationBridgeDto {
  source: SourceRecord;
  channelHandle: string;
  publicUrl: string;
  coverageTags: string[];
  strippedPrivateFields: string[];
  planningMetadata: Pick<TelegramPublicChannelSourceModel, "focus" | "topicTags" | "cursorState" | "rateLimitState" | "retentionClass">;
}

export interface TelegramPublicSourceHealthUpdate {
  sourceId: string;
  channel: string;
  lastSeenMessageId?: number;
  lastSeenMessageDate?: string;
  fetchOutcome: "success" | "partial" | "rate_limited" | "policy_blocked" | "failed";
  rateLimitResetAt?: string;
  duplicateUrlRate: number;
  deletedUnavailableRate: number;
  policyBlockRate: number;
  provenance: {
    adapter: "telegram_public";
    updatedAt: string;
    messageCount: number;
    promotedMessageIds: number[];
  };
}

export interface TelegramPublicSourcePack {
  version: 1;
  id: string;
  name: string;
  description?: string;
  disabledByDefault: true;
  generatedAt?: string;
  sources: TelegramPublicSourcePackEntry[];
}

export interface TelegramPublicSourcePackEntry {
  id: string;
  name: string;
  channelHandle: string;
  publicUrl: string;
  legalNotes: string;
  approvalState: "pending" | "approved" | "disabled";
  retentionClass: "public_chat_text";
  topicTags: string[];
  focus: {
    actors: string[];
    ransomware: string[];
    cves: string[];
    victims: string[];
    sectors: string[];
    countries: string[];
  };
  rateLimit: {
    minIntervalSeconds: number;
    pageSize: number;
    expectedRequestsPerHour?: number;
  };
  compliance: {
    legalBasis: string;
    license: string;
    approvalScope: "public_requires_review" | "metadata_only" | "disabled";
    takedownContact?: string;
    termsReviewedAt?: string;
  };
  language?: string;
  trustScore?: number;
  metadata?: Record<string, unknown>;
}

export interface TelegramPublicSourcePackValidation {
  valid: boolean;
  packId: string;
  accepted: SourceRecord[];
  errors: Array<{ sourceId?: string; message: string }>;
  warnings: Array<{ sourceId?: string; message: string }>;
}

export interface TelegramPublicSourcePackRecommendation {
  sourcePackId: string;
  sourcePackName: string;
  sourceId: string;
  channelHandle: string;
  publicUrl: string;
  score: number;
  requiredAction: "review" | "approve" | "activate";
  coverageTags: string[];
  reasons: string[];
}

export interface TelegramPublicActivationProgramDto {
  generatedAt: string;
  query: string;
  queryTerms: string[];
  recommendedPublicPacks: TelegramPublicSourcePackRecommendation[];
  matchingActiveChannels: TelegramPublicActivationChannelSummary[];
  pendingReviewChannels: TelegramPublicActivationChannelSummary[];
  rateLimitedChannels: TelegramPublicActivationChannelSummary[];
  disabledByPolicyChannels: TelegramPublicActivationChannelSummary[];
  noApprovedChannelGaps: TelegramPublicCoverageGapExplanation[];
}

export interface TelegramPublicActivationChannelSummary {
  sourceId: string;
  channelHandle: string;
  publicUrl: string;
  status: SourceRecord["status"];
  coverageTags: string[];
  rateLimitResetAt?: string;
  requiredAction: "none" | "approve" | "activate" | "wait" | "fix_policy";
}

export type TelegramPublicChannelDiagnosticStatus =
  | "active"
  | "approved_idle"
  | "pending_review"
  | "rate_limited"
  | "unavailable"
  | "policy_disabled"
  | "stale_cursor"
  | "high_duplicate_url_rate"
  | "high_edit_delete_churn"
  | "no_query_coverage";

export type TelegramPublicRepairAction =
  | "reduce_window"
  | "delay_poll"
  | "refresh_cursor"
  | "quarantine_channel"
  | "request_review"
  | "activate_source_pack"
  | "suppress_repeated_urls";

export interface TelegramPublicSchedulerState {
  queuedSourceIds?: string[];
  leasedSourceIds?: string[];
  deadLetterSourceIds?: string[];
  retryAfterBySourceId?: Record<string, number>;
}

export interface TelegramPublicReconciliationInput {
  query?: string;
  entityType?: string;
  sources: SourceRecord[];
  sourcePacks?: TelegramPublicSourcePack[];
  healthUpdates?: TelegramPublicSourceHealthUpdate[];
  scheduler?: TelegramPublicSchedulerState;
  generatedAt?: string;
  staleCursorAfterSeconds?: number;
}

export interface TelegramPublicChannelDiagnostic {
  sourceId: string;
  channelHandle: string;
  publicUrl: string;
  statuses: TelegramPublicChannelDiagnosticStatus[];
  coverageTags: string[];
  cursorState: TelegramPaginationState;
  rateLimitResetAt?: string;
  schedulerState: {
    queued: boolean;
    leased: boolean;
    deadLettered: boolean;
    retryAfterSeconds?: number;
  };
  health?: Pick<TelegramPublicSourceHealthUpdate, "fetchOutcome" | "lastSeenMessageId" | "lastSeenMessageDate" | "duplicateUrlRate" | "deletedUnavailableRate" | "policyBlockRate">;
  repairs: TelegramPublicRepairRecommendation[];
}

export interface TelegramPublicRepairRecommendation {
  action: TelegramPublicRepairAction;
  sourceId?: string;
  channelHandle?: string;
  reason: string;
  priority: "low" | "medium" | "high";
}

export interface TelegramPublicReconciliationDto {
  generatedAt: string;
  query?: string;
  queryTerms: string[];
  packCount: number;
  registrySourceCount: number;
  diagnostics: TelegramPublicChannelDiagnostic[];
  repairs: TelegramPublicRepairRecommendation[];
  summary: Record<TelegramPublicChannelDiagnosticStatus, number>;
}

export type TelegramPublicCutoverNextAction =
  | "ready_for_cutover"
  | "review_public_channels"
  | "wait_for_rate_limit"
  | "refresh_stale_cursors"
  | "suppress_repeated_urls"
  | "activate_source_pack"
  | "collect_more_clear_web"
  | "keep_policy_blocked";

export interface TelegramPublicCutoverReportInput extends TelegramPublicReconciliationInput {
  evidence?: TelegramPublicEvidenceDto[];
  clearWebEvidenceCount?: number;
}

export interface TelegramPublicCutoverReportDto {
  generatedAt: string;
  query?: string;
  queryTerms: string[];
  summary: {
    readyChannelCount: number;
    pendingReviewCount: number;
    rateLimitedCount: number;
    staleCursorCount: number;
    highDuplicateUrlCount: number;
    safePartialEvidenceCount: number;
    recommendedNextAction: TelegramPublicCutoverNextAction;
  };
  sourcePackRecommendations: TelegramPublicSourcePackRecommendation[];
  reconciliation: TelegramPublicReconciliationDto;
  cursorRateLimitState: Array<{
    sourceId: string;
    channelHandle: string;
    cursorState: TelegramPaginationState;
    rateLimitResetAt?: string;
    schedulerState: TelegramPublicChannelDiagnostic["schedulerState"];
  }>;
  abuseControls: Array<{
    sourceId: string;
    channel: string;
    allowed: boolean;
    effectiveWindow: number;
    rateLimitResetAt?: string;
    suppressedUrlCount: number;
    notes: string[];
  }>;
  evidenceFreshness: {
    latestMessageTimestamp?: string;
    latestMessageId?: number;
    safePartialEvidenceCount: number;
    clearWebEvidenceCount: number;
    publicChannelAddsEvidence: boolean;
  };
  repairs: TelegramPublicRepairRecommendation[];
  applyPlan: TelegramPublicApplyPlanDto;
}

export type TelegramPublicApplyPlanAction = TelegramPublicRepairAction;

export type TelegramPublicApplyPlanExecution =
  | "automation_safe"
  | "human_approval_required"
  | "blocked"
  | "rollback_only";

export interface TelegramPublicApplyPlanInput extends TelegramPublicCutoverReportInput {}

export interface TelegramPublicApplyPlanStep {
  id: string;
  action: TelegramPublicApplyPlanAction;
  execution: TelegramPublicApplyPlanExecution;
  sourceId?: string;
  channelHandle?: string;
  priority: "low" | "medium" | "high";
  reason: string;
  prerequisites: string[];
  expectedSchedulerEffects: string[];
  expectedEvidenceEffects: string[];
  rollback: string[];
  rateLimitSafety: string[];
  mediaPolicy: "metadata_only";
  piiMinimizationRequired: true;
  manual: boolean;
  automationSafe: boolean;
}

export interface TelegramPublicApplyPlanDto {
  generatedAt: string;
  mode: "dry_run";
  query?: string;
  steps: TelegramPublicApplyPlanStep[];
  summary: {
    stepCount: number;
    automationSafeCount: number;
    humanApprovalRequiredCount: number;
    blockedCount: number;
    rollbackOnlyCount: number;
    highestPriority?: "low" | "medium" | "high";
    canAutoApply: boolean;
  };
  promotionGate: {
    publicChannelApplyPlanReady: boolean;
    blockedUnsafeActivationCount: number;
    manualApprovalCount: number;
    automationSafeCount: number;
    metadataOnlyMedia: true;
    piiMinimizationRequired: true;
  };
}

export interface TelegramPublicApplyPlanApiContractDto {
  endpoint: "/v1/public-channels/apply-plan";
  method: "POST";
  mode: "dry_run";
  request: {
    contentType: "application/json";
    fields: Array<{
      name: string;
      type: string;
      required: boolean;
      description: string;
    }>;
  };
  response: {
    fields: string[];
    stepFields: string[];
    forbiddenFields: string[];
    actions: TelegramPublicApplyPlanAction[];
    executions: TelegramPublicApplyPlanExecution[];
  };
  examples: Record<
    "automationSafe" | "humanApprovalRequired" | "blockedPrivateTarget" | "rateLimitedChannel" | "rollbackOnlyQuarantine",
    TelegramPublicApplyPlanStep
  >;
}
