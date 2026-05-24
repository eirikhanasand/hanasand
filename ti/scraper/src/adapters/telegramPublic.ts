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

type TelegramFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

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

type SourceApprovalStateLike = "not_required" | "pending" | "approved" | "rejected" | "expired" | "candidate";

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

export class TelegramPublicAdapterError extends Error {
  readonly category: TelegramAdapterFailureCategory;
  readonly rateLimitResetAt?: string;

  constructor(category: TelegramAdapterFailureCategory, message: string, options: { rateLimitResetAt?: string } = {}) {
    super(message);
    this.name = "TelegramPublicAdapterError";
    this.category = category;
    this.rateLimitResetAt = options.rateLimitResetAt;
  }
}

export class TelegramPublicAdapter implements CollectionAdapter {
  readonly type = "telegram_public" as const;

  constructor(private readonly client: OfficialTelegramClient) {}

  async collect(source: SourceRecord, task?: CollectionTask): Promise<AdapterRunResult> {
    const startedAt = Date.now();
    const policy = task
      ? evaluateTaskForCollection(source, task)
      : { allowed: true, metadataOnly: false, reason: "manual run" };

    const targetUrl = task?.targetUrl ?? source.url;
    if (!policy.allowed) {
      return telegramRunResult({
        warnings: [policy.reason],
        failureCategory: "policy_blocked",
        crawlState: emptyCrawlState(targetUrl, startedAt)
      });
    }

    let config: TelegramPublicSourceConfig;
    try {
      config = parseTelegramPublicSourceConfig(source, task);
    } catch (error) {
      const category = error instanceof TelegramPublicAdapterError ? error.category : "parse_error";
      return telegramRunResult({
        warnings: [error instanceof Error ? error.message : String(error)],
        failureCategory: category,
        crawlState: emptyCrawlState(targetUrl, startedAt)
      });
    }

    const collectedAt = nowIso();
    let response: TelegramPublicFetchResult;
    try {
      response = await this.client.fetchPublicChannelMessages({
        channel: config.channel,
        limit: config.pageSize,
        pagination: config.pagination ?? {},
        task
      });
    } catch (error) {
      const failure = classifyTelegramClientError(error);
      return telegramRunResult({
        warnings: [failure.message],
        failureCategory: failure.category,
        crawlState: buildTelegramCrawlState(config, {
          messages: [],
          rateLimitResetAt: failure.rateLimitResetAt,
          fetchDurationMs: Date.now() - startedAt
        })
      });
    }

    const crawlState = buildTelegramCrawlState(config, {
      messages: response.messages,
      nextPagination: response.nextPagination,
      rateLimitResetAt: response.rateLimitResetAt,
      fetchDurationMs: Date.now() - startedAt
    });

    if (response.failureCategory) {
      return telegramRunResult({
        warnings: [response.failureMessage ?? `telegram adapter failure: ${response.failureCategory}`, ...(response.warnings ?? [])],
        failureCategory: response.failureCategory,
        crawlState
      });
    }

    const items = response.messages.map((message) => {
      const messageUnavailable = Boolean(message.unavailable || message.deleted);
      const messageText = normalizeTelegramMessageText(message);
      const rawText = config.pii.minimize ? minimizeTelegramPii(messageText) : normalizeWhitespace(messageText);
      const links = normalizeTelegramLinks([...(message.links ?? []), ...extractUrls(rawText)]);
      const contentHash = hashContent(`${message.channel}:${message.id}:${message.editDate ?? ""}:${rawText}:${messageUnavailable}`);
      const publicForward = minimizeForwardMetadata(message.forward);
      const mediaMetadata = normalizeMediaMetadata(message.media ?? []);

      return {
        sourceId: source.id,
        taskId: task?.id,
        url: message.url,
        collectedAt,
        publishedAt: message.date,
        title: buildTelegramTitle(config.channel, message),
        rawText,
        contentHash,
        language: source.language,
        links,
        metadata: {
          adapter: "telegram_public",
          accessMethod: source.accessMethod,
          api: config.api,
          channel: config.channel,
          messageId: message.id,
          messageState: message.deleted ? "deleted" : message.unavailable ? "unavailable" : "available",
          editDate: message.editDate,
          edited: Boolean(message.editDate),
          pinned: Boolean(message.pinned),
          authorSignature: message.authorSignature,
          forwardFrom: message.forwardFrom ? "[minimized]" : undefined,
          forward: publicForward,
          replyToMessageId: message.replyToMessageId,
          threadId: message.threadId,
          views: message.views,
          media: {
            retention: "metadata_only",
            items: mediaMetadata
          },
          urlMentions: links,
          extractionHandoff: {
            messageText: rawText,
            quotedText: message.quotedText ? (config.pii.minimize ? minimizeTelegramPii(message.quotedText) : normalizeWhitespace(message.quotedText)) : undefined,
            urlContext: links.map((url) => ({ url, messageId: message.id, channel: config.channel })),
            actorAliases: extractActorAliasMarkers(rawText),
            cves: extractCveMarkers(rawText),
            victims: extractVictimMarkers(rawText),
            uncertaintyMarkers: buildUncertaintyMarkers(message, rawText)
          },
          retentionClass: "public_chat_text",
          pagination: response.nextPagination,
          rateLimit: {
            minIntervalSeconds: config.minIntervalSeconds,
            resetAt: response.rateLimitResetAt
          },
          crawlState,
          deletedMessageIds: response.deletedMessageIds ?? [],
          unavailableMessageIds: response.unavailableMessageIds ?? [],
          failureCategory: undefined,
          provenance: {
            sourceId: source.id,
            sourceType: source.type,
            channel: config.channel,
            messageId: message.id,
            messageUrl: message.url,
            collectedAt,
            publishedAt: message.date,
            contentHash,
            extractorVersion: "telegram_public_adapter_v1",
            confidence: 0.95
          }
        },
        sensitive: false
      };
    });

    return {
      items,
      discovered: [],
      warnings: [
        ...(response.messages.length === 0 ? ["telegram_public empty channel window"] : []),
        ...(response.deletedMessageIds?.length ? [`telegram_public deleted messages: ${response.deletedMessageIds.join(",")}`] : []),
        ...(response.unavailableMessageIds?.length ? [`telegram_public unavailable messages: ${response.unavailableMessageIds.join(",")}`] : []),
        ...(response.warnings ?? [])
      ],
      metadata: {
        adapter: "telegram_public",
        failureCategory: undefined,
        crawlState,
        deletedMessageIds: response.deletedMessageIds ?? [],
        unavailableMessageIds: response.unavailableMessageIds ?? []
      }
    };
  }
}

export class TelegramBotApiClient implements OfficialTelegramClient {
  private readonly token: string;
  private readonly fetcher: TelegramFetch;
  private readonly apiBaseUrl: string;
  private readonly now: () => Date;

  constructor(options: TelegramBotApiClientOptions) {
    if (!options.token.trim()) throw new TelegramPublicAdapterError("policy_blocked", "Telegram Bot API token is required");
    this.fetcher = options.fetcher ?? fetch;
    this.apiBaseUrl = options.apiBaseUrl ?? "https://api.telegram.org";
    this.now = options.now ?? (() => new Date());
    this.token = options.token;
  }

  async fetchPublicChannelMessages(request: TelegramPublicFetchRequest): Promise<TelegramPublicFetchResult> {
    const body = {
      limit: Math.max(1, Math.min(100, request.limit)),
      allowed_updates: ["channel_post", "edited_channel_post"]
    };
    const response = await this.fetcher(`${this.apiBaseUrl}/bot${this.token}/getUpdates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    const payload = await safeTelegramJson(response);
    if (response.status === 429) {
      const retryAfter = numberMetadata((payload.parameters as Record<string, unknown> | undefined)?.retry_after) ?? 60;
      return {
        messages: [],
        rateLimitResetAt: new Date(this.now().getTime() + retryAfter * 1000).toISOString(),
        failureCategory: "rate_limited",
        failureMessage: "Telegram Bot API rate limited getUpdates"
      };
    }

    if (!response.ok || payload.ok === false) {
      return {
        messages: [],
        failureCategory: response.status >= 500 ? "transient_api" : "permanent_api",
        failureMessage: stringMetadata(payload.description) ?? `Telegram Bot API returned ${response.status}`
      };
    }

    const updates = Array.isArray(payload.result) ? payload.result.filter(isTelegramBotUpdate) : [];
    const channel = normalizeChannel(request.channel);
    const afterMessageId = request.pagination.afterMessageId ?? 0;
    const messages = updates
      .map((update) => update.channel_post ?? update.edited_channel_post)
      .filter((message): message is TelegramBotApiMessage => Boolean(message))
      .filter((message) => normalizeChannel(message.chat.username ?? message.chat.title ?? "") === channel)
      .map((message) => telegramBotMessageToPublicMessage(message, channel))
      .filter((message) => message.id > afterMessageId)
      .sort((left, right) => left.id - right.id)
      .slice(0, body.limit);
    const nextAfterMessageId = messages.reduce<number | undefined>((max, message) =>
      max === undefined || message.id > max ? message.id : max,
    request.pagination.afterMessageId);

    return {
      messages,
      nextPagination: {
        afterMessageId: nextAfterMessageId
      }
    };
  }
}

export async function searchTelegramPublicChannels(input: TelegramPublicSearchInput): Promise<TelegramPublicSearchResultDto> {
  const generatedAt = input.createdAt ?? nowIso();
  const queryTerms = expandTelegramQueryTerms(input.query, input.entityType);
  const backfill = planTelegramPublicSearchBackfill({
    query: input.query,
    entityType: input.entityType,
    sources: input.sources,
    sourcePacks: input.sourcePacks,
    createdAt: generatedAt,
    tenantId: input.tenantId,
    intelRequestId: input.intelRequestId,
    maxTasks: input.maxTasks
  });
  const adapter = new TelegramPublicAdapter(input.client);
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const searchedChannels: TelegramPublicSearchResultDto["searchedChannels"] = [];
  const matchedItems: CollectedItem[] = [];
  const warnings: string[] = [];

  for (const task of backfill.tasks) {
    const source = sourceById.get(task.sourceId);
    if (!source) {
      warnings.push(`telegram source ${task.sourceId} was selected but not present in registry`);
      continue;
    }
    const result = await adapter.collect(source, task);
    const channel = telegramPublicChannelSourceModel(source).channelHandle;
    const matches = result.items.filter((item) => telegramCollectedItemMatchesQuery(item, queryTerms));
    searchedChannels.push({
      sourceId: source.id,
      channelHandle: channel,
      itemCount: result.items.length,
      matchedItemCount: matches.length,
      warningCount: result.warnings.length
    });
    matchedItems.push(...matches);
    warnings.push(...result.warnings);
  }

  const candidateChannels = input.officialSearchClient?.searchPublicChannels
    ? await input.officialSearchClient.searchPublicChannels({ query: input.query, limit: Math.min(20, Math.max(1, input.maxGlobalResults ?? 10)) })
    : [];
  const globalMessageHits = input.officialSearchClient?.searchPublicMessages
    ? await input.officialSearchClient.searchPublicMessages({
      query: input.query,
      limit: Math.min(50, Math.max(1, input.maxGlobalResults ?? 20)),
      channels: input.sources.filter((source) => source.type === "telegram_public").map((source) => telegramPublicChannelSourceModel(source).channelHandle)
    })
    : [];

  const globalItems = telegramGlobalHitsToCollectedItems(globalMessageHits, input.sources, generatedAt);
  matchedItems.push(...globalItems.filter((item) => telegramCollectedItemMatchesQuery(item, queryTerms)));

  const evidence = matchedItems
    .map(publicChannelEvidenceFromCollectedItem)
    .filter((item): item is TelegramPublicEvidenceDto => Boolean(item));
  const promotion = buildTelegramPublicEvidencePromotionProgram({
    query: input.query,
    sources: input.sources,
    evidence,
    previousUrls: input.previousUrls,
    generatedAt
  });
  const reliability = buildTelegramPublicReliabilityReport({
    query: input.query,
    entityType: input.entityType,
    sources: input.sources,
    evidence,
    generatedAt
  });
  const operatorStates = buildTelegramPublicOperatorStates({ sources: input.sources, reliability, generatedAt });
  const cutoverReport = buildTelegramPublicCutoverReport({
    query: input.query,
    entityType: input.entityType,
    sources: input.sources,
    sourcePacks: input.sourcePacks,
    evidence,
    generatedAt
  });
  const actorReadiness = buildTelegramPublicActorReadinessDto(reliability);
  const compactSummary = buildTelegramPublicCompactSearchSummary({ cutoverReport, reliability, operatorStates, actorReadiness });
  const status: TelegramPublicSearchResultDto["status"] = evidence.length > 0
    ? reliability.summary.blockedCount === reliability.summary.sourceCount && reliability.summary.sourceCount > 0 ? "partial" : "ready"
    : backfill.status === "blocked" ? "blocked" : candidateChannels.length || backfill.activationRecommendations.length ? "pending_source_activation" : "partial";

  return {
    generatedAt,
    query: input.query,
    queryTerms,
    status,
    searchedChannels,
    candidateChannels: candidateChannels.map((candidate) => sanitizeTelegramChannelSearchHit(candidate, input.query, generatedAt)),
    globalMessageHits: globalMessageHits.map((hit) => sanitizeTelegramMessageSearchHit(hit, input.query, generatedAt)),
    matchedItems,
    evidence,
    backfill,
    promotion,
    reliability,
    operatorStates,
    compactSummary,
    warnings: [...new Set(warnings)],
    safety: {
      publicChannelsOnly: true,
      officialApisOnly: true,
      accountCreationAutomated: false,
      privateJoinOrInviteUsed: false,
      darknetBrowsingUsed: false,
      rawMediaPayloadsFetched: false,
      piiMinimized: true
    }
  };
}

export function telegramPublicChannelSearchHitToCandidateSource(input: {
  hit: TelegramPublicChannelSearchHit;
  generatedAt?: string;
  tenantId?: string;
  sourcePackId?: string;
}): SourceRecord {
  const generatedAt = input.generatedAt ?? nowIso();
  const channel = normalizeChannel(input.hit.channelHandle);
  return {
    id: `src_tg_candidate_${hashContent(`${input.sourcePackId ?? "official-search"}:${channel}`).slice(0, 12)}`,
    tenantId: input.tenantId,
    name: input.hit.title ?? `Public Telegram ${channel}`,
    type: "telegram_public",
    url: `https://t.me/${channel}`,
    accessMethod: "official_api",
    status: "needs_review",
    risk: "medium",
    trustScore: clamp01(input.hit.confidence ?? 0.45),
    language: input.hit.language,
    crawlFrequencySeconds: 900,
    legalNotes: "Candidate discovered through official Telegram public search boundary; public posts only after source review.",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    governance: {
      approvalRequired: true,
      approvalState: "pending",
      metadataOnly: false,
      policyVersion: "collection-policy:v1",
      riskJustification: "Public Telegram channel candidate requires operator review before activation."
    },
    metadata: {
      channelHandle: channel,
      topicTags: input.hit.topicTags ?? [],
      telegramApi: input.hit.provenance.api,
      sourcePackId: input.sourcePackId,
      officialSearchProvenance: input.hit.provenance,
      description: input.hit.description,
      subscriberCount: input.hit.subscriberCount,
      pageSize: 25,
      minIntervalSeconds: 900,
      minimizePii: true,
      mediaDownload: false
    },
    catalog: {
      canonicalId: `telegram:${channel}`,
      publisher: {
        name: input.hit.title ?? channel,
        trustBasis: "community"
      },
      tier: "watchlist",
      approvalScope: "public_requires_review",
      license: "Public Telegram posts; terms and takedown handling require review before activation.",
      legalBasis: "Defensive CTI monitoring of public channels after operator approval.",
      reliability: clamp01(input.hit.confidence ?? 0.45),
      intelligenceValue: clamp01(input.hit.confidence ?? 0.45),
      retentionClass: "public_chat_text",
      coverage: {
        topics: input.hit.topicTags ?? [],
        actors: [],
        aliases: [],
        industries: [],
        regions: [],
        countries: [],
        languages: input.hit.language ? [input.hit.language] : [],
        queryPatterns: []
      },
      collection: {
        freshnessTargetSeconds: 3600,
        collectionSlaSeconds: 900,
        budgetClass: "normal",
        crawlCadenceSeconds: 900
      },
      adapterCompatibility: ["telegram_public"]
    }
  };
}

export function telegramPublicChannelSourceModel(source: SourceRecord): TelegramPublicChannelSourceModel {
  const target = parseTelegramTarget(source.url);
  const compliance = validateTelegramPublicSourceCompliance(source);
  const metadata = sourceMetadata(source);
  return {
    sourceId: source.id,
    tenantId: source.tenantId,
    channelHandle: target.channel ?? readMetadataString(source, "channelHandle") ?? source.name.toLowerCase().replace(/\W+/g, "_"),
    channelId: readMetadataString(source, "channelId"),
    publicUrl: compliance.allowed && target.channel ? source.url : "[blocked_telegram_target]",
    accessMethod: "official_api",
    approvalNotes: source.legalNotes,
    approvalScope: readMetadataString(source, "approvalScope"),
    legalStatus: compliance.allowed && isTelegramApproved(source) ? "approved_public" : compliance.allowed ? "pending_review" : "blocked",
    complianceStatus: compliance.allowed ? "public_only" : "blocked_private_or_automation",
    topicTags: [...new Set([...(source.tags ?? []), ...readStringArray(metadata, "topicTags")])],
    language: source.language,
    focus: {
      actors: readStringArray(metadata, "actors"),
      ransomware: readStringArray(metadata, "ransomware"),
      cves: readStringArray(metadata, "cves").map((value) => value.toUpperCase()),
      victims: readStringArray(metadata, "victims"),
      sectors: readStringArray(metadata, "sectors"),
      countries: readStringArray(metadata, "countries")
    },
    cursorState: {
      afterMessageId: readOptionalPositiveInteger(source, "afterMessageId"),
      beforeMessageId: readOptionalPositiveInteger(source, "beforeMessageId")
    },
    rateLimitState: {
      resetAt: readMetadataString(source, "rateLimitResetAt") ?? source.crawlState?.backoffUntil,
      minIntervalSeconds: readPositiveInteger(source, "minIntervalSeconds", 60, 1, 3600)
    },
    retentionClass: compliance.allowed ? "public_chat_text" : "restricted_metadata"
  };
}

export function planTelegramPublicQueryWindows(input: {
  query: string;
  entityType?: string;
  sources: SourceRecord[];
  createdAt?: string;
  tenantId?: string;
  intelRequestId?: string;
  maxTasks?: number;
}): TelegramPublicQueryWindowPlan {
  const createdAt = input.createdAt ?? nowIso();
  const queryTerms = expandTelegramQueryTerms(input.query, input.entityType);
  const tasks: CollectionTask[] = [];
  const blocked: TelegramPublicQueryWindowPlan["blocked"] = [];
  const skipped: TelegramPublicQueryWindowPlan["skipped"] = [];
  const maxTasks = Math.max(1, input.maxTasks ?? 20);

  for (const source of input.sources.filter((candidate) => candidate.type === "telegram_public")) {
    const compliance = validateTelegramPublicSourceCompliance(source);
    if (!compliance.allowed) {
      blocked.push({ sourceId: source.id, reason: compliance.reason });
      continue;
    }

    const policy = evaluateTaskForCollection(source, {
      id: "policy_probe",
      sourceId: source.id,
      sourceType: source.type,
      targetUrl: source.url,
      queuedAt: createdAt,
      priority: 0,
      reason: "telegram query-window policy probe",
      retryCount: 0
    });
    if (!policy.allowed) {
      blocked.push({ sourceId: source.id, reason: policy.reason });
      continue;
    }

    const model = telegramPublicChannelSourceModel(source);
    const relevance = scoreTelegramSourceForQuery(model, queryTerms);
    if (relevance <= 0) {
      skipped.push({ sourceId: source.id, reason: "channel focus does not match query terms" });
      continue;
    }

    const availableAt = model.rateLimitState.resetAt && Date.parse(model.rateLimitState.resetAt) > Date.parse(createdAt)
      ? model.rateLimitState.resetAt
      : undefined;
    const priority = Math.max(0.1, relevance * source.trustScore);
    tasks.push({
      id: stableTelegramTaskId(input.intelRequestId ?? "telegram-query", source.id, source.url, queryTerms),
      tenantId: input.tenantId ?? source.tenantId,
      sourceId: source.id,
      targetUrl: source.url,
      sourceType: "telegram_public",
      queuedAt: createdAt,
      availableAt,
      priority,
      reason: `public Telegram query window for ${queryTerms.join(", ")}`,
      retryCount: 0,
      intelRequestId: input.intelRequestId,
      maxBytes: 128_000,
      sourceConcurrencyKey: source.id,
      fairnessKey: `${input.tenantId ?? source.tenantId ?? "global"}:${input.intelRequestId ?? "telegram"}:telegram_public`,
      planning: {
        budgetClass: "background_refresh",
        decision: availableAt ? "waiting-for-backoff" : "selected",
        reason: availableAt ? "source rate-limit state delays collection" : "public channel focus matches query",
        queryTerms,
        freshness: source.crawlState?.lastCollectedAt ? 0.6 : 0.8,
        sourceTrust: source.trustScore,
        selectedFor: "background"
      }
    });
    if (tasks.length >= maxTasks) break;
  }

  tasks.sort((a, b) => b.priority - a.priority || a.sourceId.localeCompare(b.sourceId));
  return { tasks, blocked, skipped, queryTerms };
}

export function planTelegramPublicSearchBackfill(input: {
  query: string;
  entityType?: string;
  sources: SourceRecord[];
  sourcePacks?: TelegramPublicSourcePack[];
  healthUpdates?: TelegramPublicSourceHealthUpdate[];
  scheduler?: TelegramPublicSchedulerState;
  createdAt?: string;
  tenantId?: string;
  intelRequestId?: string;
  maxTasks?: number;
  queuedSourceIds?: string[];
}): TelegramPublicSearchBackfillPlan {
  const plan = planTelegramPublicQueryWindows(input);
  const sourcePackRecommendations = recommendTelegramPublicSourcePacks({
    query: input.query,
    entityType: input.entityType,
    packs: input.sourcePacks ?? [],
    maxRecommendations: 8
  });
  const coverageGaps = explainTelegramPublicCoverageGaps({
    query: input.query,
    entityType: input.entityType,
    sources: input.sources,
    createdAt: input.createdAt,
    queuedSourceIds: input.queuedSourceIds
  });
  const activationProgram = buildTelegramPublicActivationProgram({
    query: input.query,
    entityType: input.entityType,
    sources: input.sources,
    sourcePacks: input.sourcePacks,
    createdAt: input.createdAt,
    queuedSourceIds: input.queuedSourceIds
  });
  const reconciliation = buildTelegramPublicReconciliation({
    query: input.query,
    entityType: input.entityType,
    sources: input.sources,
    sourcePacks: input.sourcePacks,
    healthUpdates: input.healthUpdates,
    scheduler: input.scheduler ?? { queuedSourceIds: input.queuedSourceIds },
    generatedAt: input.createdAt
  });
  const cutoverReport = buildTelegramPublicCutoverReport({
    query: input.query,
    entityType: input.entityType,
    sources: input.sources,
    sourcePacks: input.sourcePacks,
    healthUpdates: input.healthUpdates,
    scheduler: input.scheduler ?? { queuedSourceIds: input.queuedSourceIds },
    generatedAt: input.createdAt
  });
  const activationRecommendations = input.sources
    .filter((source) => source.type === "telegram_public")
    .flatMap((source): TelegramPublicActivationRecommendation[] => {
      const model = telegramPublicChannelSourceModel(source);
      const relevance = scoreTelegramSourceForQuery(model, plan.queryTerms);
      if (relevance <= 0) return [];

      const compliance = validateTelegramPublicSourceCompliance(source);
      if (!compliance.allowed) {
        return [{
          sourceId: source.id,
          channelHandle: model.channelHandle,
          publicUrl: model.publicUrl,
          reason: compliance.reason,
          coverageTags: coverageTagsForModel(model),
          requiredAction: "fix_policy"
        }];
      }

      if (model.legalStatus !== "approved_public") {
        return [{
          sourceId: source.id,
          channelHandle: model.channelHandle,
          publicUrl: model.publicUrl,
          reason: "public channel matches query but requires source approval",
          coverageTags: coverageTagsForModel(model),
          requiredAction: "approve"
        }];
      }

      if (source.status !== "active" && source.status !== "probation" && source.status !== "degraded") {
        return [{
        sourceId: source.id,
        channelHandle: model.channelHandle,
        publicUrl: model.publicUrl,
        reason: `public channel matches query but source status is ${source.status}`,
        coverageTags: coverageTagsForModel(model),
        requiredAction: "activate"
      }];
      }

      return [];
    });

  const status = plan.tasks.length > 0
    ? "partial"
    : activationRecommendations.length > 0
      ? "pending_channel_search"
      : plan.blocked.length > 0
        ? "blocked"
        : "pending_channel_search";

  return {
    ...plan,
    status,
    activationRecommendations: [
      ...activationRecommendations,
      ...sourcePackRecommendations.map((recommendation): TelegramPublicActivationRecommendation => ({
        sourceId: recommendation.sourceId,
        channelHandle: recommendation.channelHandle,
        publicUrl: recommendation.publicUrl,
        reason: `source pack ${recommendation.sourcePackName} matches query: ${recommendation.reasons.join("; ")}`,
        coverageTags: recommendation.coverageTags,
        requiredAction: recommendation.requiredAction === "review" ? "review" : recommendation.requiredAction,
        sourcePackId: recommendation.sourcePackId,
        sourcePackName: recommendation.sourcePackName
      }))
    ],
    coverageGaps,
    sourcePackRecommendations,
    activationProgram,
    reconciliation,
    cutoverReport
  };
}

export function buildTelegramPublicReconciliation(input: TelegramPublicReconciliationInput): TelegramPublicReconciliationDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryTerms = input.query ? expandTelegramQueryTerms(input.query, input.entityType) : [];
  const healthBySource = new Map((input.healthUpdates ?? []).map((health) => [health.sourceId, health]));
  const scheduler = input.scheduler ?? {};
  const queued = new Set(scheduler.queuedSourceIds ?? []);
  const leased = new Set(scheduler.leasedSourceIds ?? []);
  const deadLettered = new Set(scheduler.deadLetterSourceIds ?? []);
  const diagnostics: TelegramPublicChannelDiagnostic[] = input.sources
    .filter((source) => source.type === "telegram_public")
    .map((source) => {
      const bridged = bridgeTelegramPublicActivationSource(source)?.source ?? source;
      const model = telegramPublicChannelSourceModel(bridged);
      const health = healthBySource.get(source.id);
      const coverageTags = coverageTagsForModel(model);
      const statuses = diagnosticStatusesForChannel({
        source,
        bridged,
        model,
        health,
        queryTerms,
        generatedAt,
        staleCursorAfterSeconds: input.staleCursorAfterSeconds
      });
      const schedulerState = {
        queued: queued.has(source.id),
        leased: leased.has(source.id),
        deadLettered: deadLettered.has(source.id),
        retryAfterSeconds: scheduler.retryAfterBySourceId?.[source.id]
      };
      const repairs = repairRecommendationsForChannel(source, model, statuses, schedulerState, health);
      return {
        sourceId: source.id,
        channelHandle: model.channelHandle,
        publicUrl: model.publicUrl,
        statuses,
        coverageTags,
        cursorState: model.cursorState,
        rateLimitResetAt: model.rateLimitState.resetAt,
        schedulerState,
        health: health ? {
          fetchOutcome: health.fetchOutcome,
          lastSeenMessageId: health.lastSeenMessageId,
          lastSeenMessageDate: health.lastSeenMessageDate,
          duplicateUrlRate: health.duplicateUrlRate,
          deletedUnavailableRate: health.deletedUnavailableRate,
          policyBlockRate: health.policyBlockRate
        } : undefined,
        repairs
      };
    });
  const packRepairs = recommendTelegramPublicSourcePacks({
    query: input.query ?? "",
    entityType: input.entityType,
    packs: input.sourcePacks ?? [],
    maxRecommendations: 5
  }).map((recommendation): TelegramPublicRepairRecommendation => ({
    action: "activate_source_pack",
    sourceId: recommendation.sourceId,
    channelHandle: recommendation.channelHandle,
    reason: `source pack ${recommendation.sourcePackName} matches query coverage`,
    priority: "medium"
  }));
  const repairs = dedupeRepairs([...diagnostics.flatMap((diagnostic) => diagnostic.repairs), ...packRepairs]);
  const summary = Object.fromEntries(DIAGNOSTIC_STATUSES.map((status) => [
    status,
    diagnostics.filter((diagnostic) => diagnostic.statuses.includes(status)).length
  ])) as Record<TelegramPublicChannelDiagnosticStatus, number>;

  return {
    generatedAt,
    query: input.query,
    queryTerms,
    packCount: input.sourcePacks?.length ?? 0,
    registrySourceCount: input.sources.filter((source) => source.type === "telegram_public").length,
    diagnostics,
    repairs,
    summary
  };
}

export function buildTelegramPublicCutoverReport(input: TelegramPublicCutoverReportInput): TelegramPublicCutoverReportDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const reconciliation = buildTelegramPublicReconciliation({ ...input, generatedAt });
  const sourcePackRecommendations = recommendTelegramPublicSourcePacks({
    query: input.query ?? "",
    entityType: input.entityType,
    packs: input.sourcePacks ?? [],
    maxRecommendations: 8
  });
  const evidence = input.evidence ?? [];
  const safeEvidence = evidence.filter((item) => item.messageState !== "deleted" && item.messageState !== "unavailable");
  const latest = [...safeEvidence]
    .filter((item) => item.messageTimestamp || item.messageId !== undefined)
    .sort((a, b) => {
      const dateDelta = Date.parse(b.messageTimestamp ?? "") - Date.parse(a.messageTimestamp ?? "");
      if (Number.isFinite(dateDelta) && dateDelta !== 0) return dateDelta;
      return (b.messageId ?? 0) - (a.messageId ?? 0);
    })[0];
  const readyChannelCount = reconciliation.diagnostics.filter((diagnostic) =>
    diagnostic.statuses.includes("active") &&
    !diagnostic.statuses.some((status) => status === "rate_limited" || status === "unavailable" || status === "policy_disabled" || status === "stale_cursor")
  ).length;
  const pendingReviewCount = reconciliation.diagnostics.filter((diagnostic) =>
    !diagnostic.statuses.includes("policy_disabled") &&
    (diagnostic.statuses.includes("pending_review") || diagnostic.statuses.includes("approved_idle"))
  ).length;
  const rateLimitedCount = reconciliation.summary.rate_limited;
  const staleCursorCount = reconciliation.summary.stale_cursor;
  const highDuplicateUrlCount = reconciliation.summary.high_duplicate_url_rate;
  const policyBlockedCount = reconciliation.summary.policy_disabled + reconciliation.summary.unavailable;
  const recommendedNextAction = chooseTelegramPublicCutoverNextAction({
    readyChannelCount,
    pendingReviewCount,
    rateLimitedCount,
    staleCursorCount,
    highDuplicateUrlCount,
    safePartialEvidenceCount: safeEvidence.length,
    clearWebEvidenceCount: input.clearWebEvidenceCount ?? 0,
    policyBlockedCount,
    sourcePackRecommendationCount: sourcePackRecommendations.length
  });
  const evidenceUrlsBySource = new Map<string, string[]>();
  for (const item of safeEvidence) {
    evidenceUrlsBySource.set(item.sourceId, [
      ...(evidenceUrlsBySource.get(item.sourceId) ?? []),
      item.messageUrl,
      ...item.extractedUrls
    ]);
  }
  const abuseControls = input.sources
    .filter((source) => source.type === "telegram_public")
    .map((source) => {
      const control = applyTelegramPublicAbuseControls({
        source,
        query: input.query,
        entityType: input.entityType,
        now: generatedAt,
        urls: evidenceUrlsBySource.get(source.id) ?? [],
        previousUrls: readMetadataStringArray(source, "lastDiscoveredUrls")
      });
      return {
        sourceId: source.id,
        channel: control.channel,
        allowed: control.allowed,
        effectiveWindow: control.effectiveWindow,
        rateLimitResetAt: control.rateLimitResetAt,
        suppressedUrlCount: control.suppressedUrls.length,
        notes: control.notes
      };
    });

  const reportBase = {
    generatedAt,
    query: input.query,
    queryTerms: reconciliation.queryTerms,
    summary: {
      readyChannelCount,
      pendingReviewCount,
      rateLimitedCount,
      staleCursorCount,
      highDuplicateUrlCount,
      safePartialEvidenceCount: safeEvidence.length,
      recommendedNextAction
    },
    sourcePackRecommendations,
    reconciliation,
    cursorRateLimitState: reconciliation.diagnostics.map((diagnostic) => ({
      sourceId: diagnostic.sourceId,
      channelHandle: diagnostic.channelHandle,
      cursorState: diagnostic.cursorState,
      rateLimitResetAt: diagnostic.rateLimitResetAt,
      schedulerState: diagnostic.schedulerState
    })),
    abuseControls,
    evidenceFreshness: {
      latestMessageTimestamp: latest?.messageTimestamp,
      latestMessageId: latest?.messageId,
      safePartialEvidenceCount: safeEvidence.length,
      clearWebEvidenceCount: input.clearWebEvidenceCount ?? 0,
      publicChannelAddsEvidence: safeEvidence.length > 0 && (input.clearWebEvidenceCount ?? 0) > 0
    },
    repairs: reconciliation.repairs
  };
  return {
    ...reportBase,
    applyPlan: buildTelegramPublicApplyPlanFromReport(reportBase, input.sources)
  };
}

export function buildTelegramPublicReliabilityReport(input: TelegramPublicReliabilityInput): TelegramPublicReliabilityReportDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryTerms = input.query ? expandTelegramQueryTerms(input.query, input.entityType) : [];
  const healthBySource = new Map((input.healthUpdates ?? []).map((health) => [health.sourceId, health]));
  const evidence = input.evidence ?? [];
  const promotion = buildTelegramPublicEvidencePromotionProgram({
    query: input.query ?? "",
    sources: input.sources,
    evidence,
    previousUrls: input.sources.flatMap((source) => readMetadataStringArray(source, "lastDiscoveredUrls") ?? []),
    generatedAt
  });
  const promotedBySource = countBy(promotion.promoted.map((item) => item.sourceId));
  const reportSources = input.sources
    .filter((source) => source.type === "telegram_public")
    .map((source) => {
      const model = telegramPublicChannelSourceModel(source);
      const health = healthBySource.get(source.id);
      const sourceEvidence = evidence.filter((item) => item.sourceId === source.id);
      const safeEvidence = sourceEvidence.filter((item) => item.messageState !== "deleted" && item.messageState !== "unavailable");
      const latest = latestTelegramEvidence(sourceEvidence);
      const topicFit = topicFitScore(model, queryTerms, sourceEvidence);
      const languageCoverage = languageCoverageScore(input.language, model.language, sourceEvidence, topicFit);
      const duplicateSuppressed = promotion.duplicateSuppressed.filter((item) => item.sourceId === source.id).length;
      const duplicateUrlRatio = Math.max(
        health?.duplicateUrlRate ?? 0,
        duplicateUrlRatioForEvidence(sourceEvidence),
        rateFromCounts(duplicateSuppressed, sourceEvidence.length)
      );
      const editDeleteChurn = editDeleteChurnForEvidence(sourceEvidence, health);
      const unavailableWindowRatio = unavailableWindowRatioForEvidence(source, sourceEvidence, health);
      const freshness = freshnessScore({
        generatedAt,
        latestEvidenceAt: latest?.messageTimestamp ?? health?.lastSeenMessageDate ?? source.crawlState?.lastCollectedAt,
        cadenceSeconds: Math.max(60, source.crawlFrequencySeconds || model.rateLimitState.minIntervalSeconds)
      });
      const rateLimitPenalty = rateLimitPenaltyForSource(source, health, generatedAt);
      const promotionYield = safeEvidence.length > 0 ? clamp01((promotedBySource.get(source.id) ?? 0) / safeEvidence.length) : sourceEvidence.length > 0 ? 0 : 0.5;
      const compliance = validateTelegramPublicSourceCompliance(source);
      const policyBlocked = !compliance.allowed || source.accessMethod === "disabled" || source.status === "disabled" || source.status === "rejected" || source.catalog?.approvalScope === "disabled";
      const score = policyBlocked
        ? 0
        : clamp01(
          freshness * 0.18 +
          (1 - duplicateUrlRatio) * 0.14 +
          (1 - editDeleteChurn) * 0.14 +
          (1 - unavailableWindowRatio) * 0.12 +
          languageCoverage * 0.1 +
          topicFit * 0.16 +
          (1 - rateLimitPenalty) * 0.08 +
          promotionYield * 0.08
        );
      const recommendedActions = reliabilityRecommendedActions({
        policyBlocked,
        duplicateUrlRatio,
        editDeleteChurn,
        unavailableWindowRatio,
        freshness,
        rateLimitPenalty,
        topicFit,
        score,
        status: source.status
      });
      const rating = reliabilityRating({ policyBlocked, score, recommendedActions, unavailableWindowRatio });
      return {
        sourceId: source.id,
        channelHandle: model.channelHandle,
        publicUrl: model.publicUrl,
        score: roundMetric(score),
        rating,
        needsReview: rating === "degraded" || rating === "quarantine" || rating === "blocked" || recommendedActions.includes("request_review"),
        partialEvidenceOnly: promotionYield < 0.5 || rating === "degraded" || rating === "quarantine",
        metrics: {
          freshness: roundMetric(freshness),
          duplicateUrlRatio: roundMetric(duplicateUrlRatio),
          editDeleteChurn: roundMetric(editDeleteChurn),
          unavailableWindowRatio: roundMetric(unavailableWindowRatio),
          languageCoverage: roundMetric(languageCoverage),
          topicFit: roundMetric(topicFit),
          rateLimitPenalty: roundMetric(rateLimitPenalty),
          promotionYield: roundMetric(promotionYield)
        },
        latestEvidenceAt: latest?.messageTimestamp ?? health?.lastSeenMessageDate ?? source.crawlState?.lastCollectedAt,
        latestMessageId: latest?.messageId ?? health?.lastSeenMessageId,
        recommendedActions,
        reasons: reliabilityReasons({
          complianceReason: policyBlocked ? compliance.allowed ? "public-channel source is disabled by policy" : compliance.reason : undefined,
          duplicateUrlRatio,
          editDeleteChurn,
          unavailableWindowRatio,
          languageCoverage,
          topicFit,
          freshness,
          rateLimitPenalty,
          promotionYield
        })
      } satisfies TelegramPublicReliabilitySourceDto;
    });

  const countRating = (rating: TelegramPublicReliabilityRating) => reportSources.filter((source) => source.rating === rating).length;
  return {
    generatedAt,
    query: input.query,
    queryTerms,
    sources: reportSources,
    summary: {
      sourceCount: reportSources.length,
      healthyCount: countRating("healthy"),
      watchCount: countRating("watch"),
      degradedCount: countRating("degraded"),
      quarantineCount: countRating("quarantine"),
      blockedCount: countRating("blocked"),
      needsReviewCount: reportSources.filter((source) => source.needsReview).length,
      averageScore: roundMetric(reportSources.length ? reportSources.reduce((sum, source) => sum + source.score, 0) / reportSources.length : 0)
    },
    safeOutput: {
      rawPrivateDataExposed: false,
      rawMediaPayloadsExposed: false,
      credentialsExposed: false,
      mediaRetention: "metadata_only",
      piiMinimized: true
    }
  };
}

export function buildTelegramPublicActorReadinessDto(reliability: TelegramPublicReliabilityReportDto): TelegramPublicActorReadinessDto {
  const sourceRatings = reliability.sources.map((source) => ({
    sourceId: source.sourceId,
    rating: source.rating,
    partialEvidenceOnly: source.partialEvidenceOnly,
    needsReview: source.needsReview
  }));
  const downgradeReasons = reliability.sources.flatMap((source) => [
    ...(source.partialEvidenceOnly ? [`${source.channelHandle}: public-channel evidence is partial only`] : []),
    ...(source.needsReview ? [`${source.channelHandle}: public-channel source needs review`] : []),
    ...(source.rating === "quarantine" || source.rating === "blocked" ? [`${source.channelHandle}: public-channel source is ${source.rating}`] : [])
  ]);
  return {
    status: reliability.sources.length === 0
      ? "partial"
      : downgradeReasons.length > 0
        ? "needs_review"
        : reliability.sources.some((source) => source.rating === "healthy" || source.rating === "watch")
          ? "ready"
          : "partial",
    downgradeReasons: [...new Set(downgradeReasons)],
    sourceRatings
  };
}

export function buildTelegramPublicAnswerReadinessDto(input: {
  connector: Omit<TelegramPublicRuntimeConnectorContractDto, "answerReadiness">;
  generatedAt?: string;
}): TelegramPublicAnswerReadinessDto {
  const connector = input.connector;
  const generatedAt = input.generatedAt ?? connector.generatedAt;
  const promotedUrls = new Set(connector.promotionHandoff.promotedMessageUrls);
  const newIds = new Set(connector.deltas.newMessageIds);
  const editedIds = new Set(connector.deltas.editedMessageIds);
  const deletedIds = new Set(connector.deltas.deletedOrUnavailableMessageIds);
  const ledgerLinks = connector.publicMessageProvenance.map((item) => {
    const deltaKind: TelegramPublicAnswerReadinessDto["ledgerLinks"][number]["deltaKind"] = item.messageId !== undefined && deletedIds.has(item.messageId)
      ? "deleted_or_unavailable"
      : item.messageId !== undefined && editedIds.has(item.messageId)
        ? "edited"
        : item.messageId !== undefined && newIds.has(item.messageId)
          ? "new"
          : "unchanged";
    return {
      sourceId: item.sourceId,
      messageId: item.messageId,
      messageUrl: item.messageUrl,
      ledgerId: telegramPublicLedgerId(item.sourceId, item.messageUrl, item.contentHash),
      deltaKind,
      state: item.state,
      contentHash: item.contentHash,
      confidence: item.confidence,
      promotedToAgent06: promotedUrls.has(item.messageUrl)
    };
  });
  const promotedLedgerIds = ledgerLinks.filter((item) => item.promotedToAgent06).map((item) => item.ledgerId);
  const ledgerYieldRatio = roundMetric(ledgerLinks.length ? promotedLedgerIds.length / ledgerLinks.length : 0);
  const ledgerEnforcementState = ledgerLinks.length === 0 || ledgerYieldRatio >= 0.8 ? "pass" : ledgerYieldRatio >= 0.5 ? "warning" : "hold";
  const deltaDowngrades = [
    ...(ledgerLinks.some((item) => item.deltaKind === "edited") ? ["public-channel evidence includes edited messages"] : []),
    ...(ledgerLinks.some((item) => item.deltaKind === "deleted_or_unavailable") ? ["public-channel evidence includes deleted or unavailable messages"] : []),
    ...(connector.windowSizing.suppressedUrlCount > 0 ? ["public-channel repeated URLs were suppressed"] : []),
    ...(!connector.operatorState.collectable ? [`public-channel operator state is ${connector.operatorState.state}`] : []),
    ...(connector.rateLimitState.retryAfterSeconds !== undefined ? ["public-channel collection is delayed by rate limits"] : [])
  ];
  const downgradeReasons = [...new Set([...connector.actorReadiness.downgradeReasons, ...deltaDowngrades])];
  const status: TelegramPublicAnswerReadinessDto["status"] = connector.actorReadiness.status === "ready" && downgradeReasons.length === 0
    ? "ready"
    : connector.actorReadiness.status === "needs_review" || !connector.operatorState.collectable || ledgerLinks.some((item) => item.deltaKind === "deleted_or_unavailable")
      ? "needs_review"
      : "partial";
  const caveatCodes = [
    ...(ledgerLinks.some((item) => item.deltaKind === "edited") ? ["public_channel_edited_messages"] : []),
    ...(ledgerLinks.some((item) => item.deltaKind === "deleted_or_unavailable") ? ["public_channel_deleted_or_unavailable"] : []),
    ...(connector.windowSizing.suppressedUrlCount > 0 ? ["public_channel_repeated_urls_suppressed"] : []),
    ...(connector.rateLimitState.retryAfterSeconds !== undefined ? ["public_channel_rate_limited"] : []),
    ...(connector.promotionHandoff.partialEvidenceOnly ? ["public_channel_partial_evidence"] : [])
  ];

  return {
    generatedAt,
    sourceId: connector.sourceId,
    status,
    downgradeReasons,
    ledgerLinks,
    agent06: {
      targetAgent: "agent_06",
      promotedLedgerIds,
      promotedCount: connector.promotionHandoff.promotedCount,
      extractionInputCount: connector.promotionHandoff.extractionInputCount,
      ledgerBackedClaimYield: {
        ledgerBackedClaimCount: promotedLedgerIds.length,
        candidateClaimCount: ledgerLinks.length,
        ratio: ledgerYieldRatio,
        enforcementState: ledgerEnforcementState
      }
    },
    agent07: {
      claimStatus: status === "ready" ? "ready" : status === "needs_review" ? "needs_review" : "partial_evidence",
      analystReviewState: status === "ready" ? "not_required" : status === "needs_review" ? "required" : "queued",
      enforcementState: status === "ready" ? "pass" : status === "partial" ? "warning" : "hold",
      caveatCodes,
      downgradeReasons
    },
    safeOutput: {
      rawPrivateDataExposed: false,
      rawMediaPayloadsExposed: false,
      credentialsExposed: false,
      mediaRetention: "metadata_only",
      piiMinimized: true
    }
  };
}

export function buildTelegramPublicOperatorControlEffects(applyPlan: TelegramPublicApplyPlanDto): TelegramPublicOperatorControlEffectDto[] {
  return applyPlan.steps.map((step) => ({
    action: step.action,
    execution: step.execution,
    sourceId: step.sourceId,
    channelHandle: step.channelHandle,
    expectedAnswerQualityEffect: telegramPublicAnswerQualityEffect(step.action),
    expectedFreshnessEffect: telegramPublicFreshnessEffect(step.action),
    expectedPromotionEffect: telegramPublicPromotionEffect(step.action),
    keepsEvidencePartial: step.action === "delay_poll" || step.action === "request_review" || step.action === "quarantine_channel",
    requiresReview: step.execution === "human_approval_required" || step.execution === "rollback_only" || step.execution === "blocked",
    safeOutput: {
      rawPrivateDataExposed: false,
      rawMediaPayloadsExposed: false,
      credentialsExposed: false,
      mediaRetention: "metadata_only",
      piiMinimized: true
    }
  }));
}

export const buildTelegramPublicCompactSearchSummary = (input: {
  cutoverReport: TelegramPublicCutoverReportDto;
  reliability: TelegramPublicReliabilityReportDto;
  operatorStates: TelegramPublicOperatorStateDto[];
  actorReadiness: TelegramPublicActorReadinessDto;
}): TelegramPublicCompactSearchSummaryDto => {
  const promotedCount = input.cutoverReport.evidenceFreshness.safePartialEvidenceCount;
  const evidenceCount = input.reliability.sources.reduce((total, source) => total + (source.latestMessageId !== undefined ? 1 : 0), 0);
  const averagePromotionYield = input.reliability.sources.length
    ? input.reliability.sources.reduce((sum, source) => sum + source.metrics.promotionYield, 0) / input.reliability.sources.length
    : 0;
  const sortedRatings = [...input.reliability.sources].sort((left, right) => ratingRank(right.rating) - ratingRank(left.rating));
  return {
    generatedAt: input.cutoverReport.generatedAt,
    freshness: input.cutoverReport.evidenceFreshness,
    reliability: {
      sourceCount: input.reliability.summary.sourceCount,
      rating: sortedRatings[0]?.rating ?? "none",
      needsReviewCount: input.reliability.summary.needsReviewCount,
      averageScore: input.reliability.summary.averageScore
    },
    promotionYield: {
      rating: averagePromotionYield >= 0.7 ? "high" : averagePromotionYield >= 0.35 ? "medium" : averagePromotionYield > 0 ? "low" : "none",
      promotedCount,
      evidenceCount
    },
    operatorStateCounts: {
      actively_collectable: input.operatorStates.filter((state) => state.state === "actively_collectable").length,
      delayed: input.operatorStates.filter((state) => state.state === "delayed").length,
      pending_review: input.operatorStates.filter((state) => state.state === "pending_review").length,
      quarantined: input.operatorStates.filter((state) => state.state === "quarantined").length,
      policy_blocked: input.operatorStates.filter((state) => state.state === "policy_blocked").length
    },
    answerReadiness: {
      status: input.actorReadiness.status,
      downgradeReasonCount: input.actorReadiness.downgradeReasons.length
    }
  };
};

export function buildTelegramPublicSlaReport(input: {
  cutoverReport: TelegramPublicCutoverReportDto;
  reliability: TelegramPublicReliabilityReportDto;
  operatorStates: TelegramPublicOperatorStateDto[];
  actorReadiness: TelegramPublicActorReadinessDto;
  operatorControlEffects?: TelegramPublicOperatorControlEffectDto[];
  answerReadiness?: TelegramPublicAnswerReadinessDto;
  generatedAt?: string;
}): TelegramPublicSlaReportDto {
  const generatedAt = input.generatedAt ?? input.cutoverReport.generatedAt;
  const sources = input.reliability.sources;
  const sourceCount = sources.length;
  const avg = (values: number[]) => roundMetric(values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
  const staleSourceCount = sources.filter((source) => source.metrics.freshness < 0.5).length;
  const delayedSourceCount = input.operatorStates.filter((state) => state.state === "delayed").length;
  const highDuplicateCount = sources.filter((source) => source.metrics.duplicateUrlRatio >= 0.4).length;
  const highChurnCount = sources.filter((source) => source.metrics.editDeleteChurn >= 0.3).length;
  const unavailableCount = sources.filter((source) => source.metrics.unavailableWindowRatio > 0).length;
  const lowYieldCount = sources.filter((source) => source.metrics.promotionYield < 0.35).length;
  const healthyOrWatchCount = sources.filter((source) => source.rating === "healthy" || source.rating === "watch").length;
  const ledgerBackedClaimCount = input.answerReadiness?.agent06.promotedLedgerIds.length ?? input.cutoverReport.evidenceFreshness.safePartialEvidenceCount;
  const candidateClaimCount = input.answerReadiness?.ledgerLinks.length ?? Math.max(input.cutoverReport.evidenceFreshness.safePartialEvidenceCount, sourceCount);
  const collectionSuccessRatio = roundMetric(sourceCount ? healthyOrWatchCount / sourceCount : 0);
  const promotionYieldRatio = avg(sources.map((source) => source.metrics.promotionYield));
  const ledgerBackedClaimRatio = roundMetric(candidateClaimCount ? ledgerBackedClaimCount / candidateClaimCount : 0);
  const enforcementChecks = telegramPublicSlaEnforcementChecks({
    sourceCount,
    staleSourceCount,
    delayedSourceCount,
    collectionSuccessRatio,
    highDuplicateCount,
    highChurnCount,
    unavailableCount,
    promotionYieldRatio,
    ledgerBackedClaimRatio,
    candidateClaimCount,
    actorReadiness: input.actorReadiness,
    answerReadiness: input.answerReadiness
  });
  const enforcementStatus = enforcementChecks.some((check) => check.state === "hold")
    ? "hold"
    : enforcementChecks.some((check) => check.state === "warning")
      ? "warning"
      : "pass";
  const blockers = [
    ...(input.operatorStates.some((state) => state.state === "policy_blocked" || state.state === "quarantined") ? ["public_channel_policy_or_quarantine_blocker"] : []),
    ...(input.actorReadiness.status === "needs_review" ? ["public_channel_answer_readiness_needs_review"] : []),
    ...(sourceCount > 0 && highChurnCount / sourceCount >= 0.5 ? ["public_channel_edit_delete_churn_high"] : []),
    ...(sourceCount > 0 && unavailableCount / sourceCount >= 0.5 ? ["public_channel_unavailable_windows_high"] : []),
    ...enforcementChecks.filter((check) => check.state === "hold").map((check) => `public_channel_${check.name}_hold`)
  ];
  const warnings = [
    ...(delayedSourceCount > 0 ? ["public_channel_rate_limit_debt"] : []),
    ...(staleSourceCount > 0 ? ["public_channel_cursor_freshness_low"] : []),
    ...(highDuplicateCount > 0 ? ["public_channel_duplicate_url_pressure"] : []),
    ...(lowYieldCount > 0 ? ["public_channel_promotion_yield_low"] : []),
    ...(input.actorReadiness.status === "partial" ? ["public_channel_answer_readiness_partial"] : []),
    ...enforcementChecks.filter((check) => check.state === "warning").map((check) => `public_channel_${check.name}_warning`)
  ].filter((warning) => !blockers.includes(warning));
  const status: TelegramPublicSlaReportDto["status"] = blockers.length > 0 ? "blocker" : warnings.length > 0 ? "warning" : "pass";
  const agent07ClaimStatus = input.answerReadiness?.agent07.claimStatus ?? (input.actorReadiness.status === "ready" ? "ready" : input.actorReadiness.status === "needs_review" ? "needs_review" : "partial_evidence");
  const agent07ReviewState = input.answerReadiness?.agent07.analystReviewState ?? (agent07ClaimStatus === "ready" ? "not_required" : agent07ClaimStatus === "needs_review" ? "required" : "queued");

  return {
    generatedAt,
    status,
    enforcement: {
      status: enforcementStatus,
      releaseAction: enforcementStatus === "pass" ? "promote" : enforcementStatus === "warning" ? "promote_with_warnings" : "hold_on_blocker",
      checks: enforcementChecks,
      agent06LedgerHandoff: {
        state: input.answerReadiness?.agent06.ledgerBackedClaimYield.enforcementState ?? (ledgerBackedClaimRatio >= 0.8 ? "pass" : ledgerBackedClaimRatio >= 0.5 ? "warning" : "hold"),
        ledgerBackedClaimCount,
        candidateClaimCount,
        ratio: ledgerBackedClaimRatio
      },
      agent07AnswerReadiness: {
        state: input.answerReadiness?.agent07.enforcementState ?? (agent07ClaimStatus === "ready" ? "pass" : agent07ClaimStatus === "partial_evidence" ? "warning" : "hold"),
        claimStatus: agent07ClaimStatus,
        analystReviewState: agent07ReviewState,
        downgradeReasonCount: input.answerReadiness?.agent07.downgradeReasons.length ?? input.actorReadiness.downgradeReasons.length
      },
      agent10ReleasePacket: {
        runtimeProofName: "public_channel_sla",
        status,
        decisionImpact: status === "pass" ? "promote" : status === "warning" ? "promote_with_warnings" : "hold_on_blocker"
      }
    },
    releaseGate: {
      owner: "Agent 04",
      agent10ProofName: "public_channel_sla",
      decisionImpact: status === "pass" ? "promote" : status === "warning" ? "promote_with_warnings" : "hold_on_blocker",
      proofCommand: "bun test src/tests/telegramPublic.test.ts",
      rollbackPath: "keep public-channel collection in partial/read-only mode and leave outer fallback active",
      blockers,
      warnings
    },
    metrics: {
      cursorFreshness: {
        averageScore: avg(sources.map((source) => source.metrics.freshness)),
        staleSourceCount,
        latestMessageTimestamp: input.cutoverReport.evidenceFreshness.latestMessageTimestamp
      },
      collectionSuccess: {
        healthyOrWatchCount,
        sourceCount,
        ratio: collectionSuccessRatio
      },
      rateLimitDebt: {
        delayedSourceCount,
        averagePenalty: avg(sources.map((source) => source.metrics.rateLimitPenalty))
      },
      duplicateUrlPressure: {
        averageRatio: avg(sources.map((source) => source.metrics.duplicateUrlRatio)),
        highPressureSourceCount: highDuplicateCount
      },
      editDeleteChurn: {
        averageRatio: avg(sources.map((source) => source.metrics.editDeleteChurn)),
        highChurnSourceCount: highChurnCount
      },
      unavailableWindows: {
        averageRatio: avg(sources.map((source) => source.metrics.unavailableWindowRatio)),
        affectedSourceCount: unavailableCount
      },
      languageTopicFit: {
        averageLanguageCoverage: avg(sources.map((source) => source.metrics.languageCoverage)),
        averageTopicFit: avg(sources.map((source) => source.metrics.topicFit))
      },
      promotionYield: {
        averageRatio: promotionYieldRatio,
        lowYieldSourceCount: lowYieldCount
      },
      ledgerBackedClaimYield: {
        ledgerBackedClaimCount,
        candidateClaimCount,
        ratio: ledgerBackedClaimRatio
      },
      answerReadinessImpact: {
        status: input.actorReadiness.status,
        downgradeReasonCount: input.actorReadiness.downgradeReasons.length,
        partialEvidenceOnly: input.actorReadiness.status !== "ready"
      }
    },
    controls: input.operatorControlEffects ?? buildTelegramPublicOperatorControlEffects(input.cutoverReport.applyPlan),
    safeOutput: {
      rawPrivateDataExposed: false,
      rawMediaPayloadsExposed: false,
      credentialsExposed: false,
      mediaRetention: "metadata_only",
      piiMinimized: true
    }
  };
}

function telegramPublicSlaEnforcementChecks(input: {
  sourceCount: number;
  staleSourceCount: number;
  delayedSourceCount: number;
  collectionSuccessRatio: number;
  highDuplicateCount: number;
  highChurnCount: number;
  unavailableCount: number;
  promotionYieldRatio: number;
  ledgerBackedClaimRatio: number;
  candidateClaimCount: number;
  actorReadiness: TelegramPublicActorReadinessDto;
  answerReadiness?: TelegramPublicAnswerReadinessDto;
}): TelegramPublicSlaReportDto["enforcement"]["checks"] {
  const sourceRatio = (count: number) => input.sourceCount ? count / input.sourceCount : 0;
  const check = (
    name: TelegramPublicSlaReportDto["enforcement"]["checks"][number]["name"],
    state: "pass" | "warning" | "hold",
    reason: string,
    value: number | string,
    threshold: string,
    answerImpact: TelegramPublicSlaReportDto["enforcement"]["checks"][number]["answerImpact"]
  ) => ({ name, state, reason, value, threshold, answerImpact });

  return [
    check(
      "cursor_freshness",
      input.sourceCount > 0 && input.staleSourceCount === input.sourceCount ? "hold" : input.staleSourceCount > 0 ? "warning" : "pass",
      input.staleSourceCount > 0 ? "one or more public-channel cursors are stale" : "public-channel cursor freshness is inside SLA",
      input.staleSourceCount,
      "hold when all matching sources are stale; warn when any source is stale",
      input.staleSourceCount > 0 ? "partial" : "none"
    ),
    check(
      "rate_limit_debt",
      input.sourceCount > 0 && sourceRatio(input.delayedSourceCount) >= 0.5 ? "hold" : input.delayedSourceCount > 0 ? "warning" : "pass",
      input.delayedSourceCount > 0 ? "official API rate-limit debt delays public-channel evidence" : "no public-channel rate-limit debt",
      input.delayedSourceCount,
      "hold at >=50% delayed sources; warn on any delayed source",
      input.delayedSourceCount > 0 ? "partial" : "none"
    ),
    check(
      "collection_success",
      input.sourceCount > 0 && input.collectionSuccessRatio < 0.5 ? "hold" : input.sourceCount > 0 && input.collectionSuccessRatio < 0.8 ? "warning" : "pass",
      input.collectionSuccessRatio < 0.8 ? "healthy/watch public-channel collection ratio is low" : "public-channel collection success is inside SLA",
      input.collectionSuccessRatio,
      "pass >=0.8; warn <0.8; hold <0.5",
      input.collectionSuccessRatio < 0.8 ? "partial" : "none"
    ),
    check(
      "duplicate_url_pressure",
      input.sourceCount > 0 && sourceRatio(input.highDuplicateCount) >= 0.5 ? "hold" : input.highDuplicateCount > 0 ? "warning" : "pass",
      input.highDuplicateCount > 0 ? "duplicate URL pressure may overstate repeated public-channel claims" : "duplicate URL pressure is inside SLA",
      input.highDuplicateCount,
      "hold at >=50% high-duplicate sources; warn on any high-duplicate source",
      input.highDuplicateCount > 0 ? "partial" : "none"
    ),
    check(
      "edit_delete_churn",
      input.sourceCount > 0 && sourceRatio(input.highChurnCount) >= 0.5 ? "hold" : input.highChurnCount > 0 ? "warning" : "pass",
      input.highChurnCount > 0 ? "edit/delete churn can make public-channel claims unstable" : "edit/delete churn is inside SLA",
      input.highChurnCount,
      "hold at >=50% high-churn sources; warn on any high-churn source",
      input.highChurnCount > 0 ? "review_required" : "none"
    ),
    check(
      "unavailable_windows",
      input.sourceCount > 0 && sourceRatio(input.unavailableCount) >= 0.5 ? "hold" : input.unavailableCount > 0 ? "warning" : "pass",
      input.unavailableCount > 0 ? "unavailable public-channel windows reduce claim replayability" : "public-channel windows are replayable",
      input.unavailableCount,
      "hold at >=50% unavailable sources; warn on any unavailable source",
      input.unavailableCount > 0 ? "review_required" : "none"
    ),
    check(
      "promotion_yield",
      input.sourceCount > 0 && input.promotionYieldRatio === 0 ? "hold" : input.sourceCount > 0 && input.promotionYieldRatio < 0.35 ? "warning" : "pass",
      input.promotionYieldRatio < 0.35 ? "public-channel promotion yield is too low for confident answer readiness" : "public-channel promotion yield is inside SLA",
      input.promotionYieldRatio,
      "pass >=0.35; warn <0.35; hold at 0 with matching sources",
      input.promotionYieldRatio < 0.35 ? "partial" : "none"
    ),
    check(
      "ledger_backed_claim_yield",
      input.candidateClaimCount > 0 && input.ledgerBackedClaimRatio < 0.5 ? "hold" : input.candidateClaimCount > 0 && input.ledgerBackedClaimRatio < 0.8 ? "warning" : "pass",
      input.ledgerBackedClaimRatio < 0.8 ? "too few public-channel candidate claims are backed by Agent 06 ledger ids" : "public-channel candidate claims have ledger support",
      input.ledgerBackedClaimRatio,
      "pass >=0.8; warn <0.8; hold <0.5",
      input.ledgerBackedClaimRatio < 0.8 ? "review_required" : "none"
    ),
    check(
      "answer_readiness",
      (input.answerReadiness?.agent07.enforcementState ?? (input.actorReadiness.status === "needs_review" ? "hold" : input.actorReadiness.status === "partial" ? "warning" : "pass")),
      input.actorReadiness.status === "ready" ? "public-channel answer readiness is ready" : "public-channel evidence downgrades public answer readiness",
      input.answerReadiness?.agent07.claimStatus ?? input.actorReadiness.status,
      "hold on needs_review; warn on partial evidence",
      input.actorReadiness.status === "ready" ? "none" : input.actorReadiness.status === "partial" ? "partial" : "review_required"
    )
  ];
}

export function buildTelegramPublicOperatorStates(input: {
  sources: SourceRecord[];
  generatedAt?: string;
  reliability?: TelegramPublicReliabilityReportDto;
}): TelegramPublicOperatorStateDto[] {
  const generatedAt = input.generatedAt ?? nowIso();
  const reliabilityBySource = new Map((input.reliability?.sources ?? []).map((source) => [source.sourceId, source]));
  return input.sources
    .filter((source) => source.type === "telegram_public")
    .map((source) => {
      const model = telegramPublicChannelSourceModel(source);
      const compliance = validateTelegramPublicSourceCompliance(source);
      const reliability = reliabilityBySource.get(source.id);
      const rateLimitResetAt = model.rateLimitState.resetAt && Date.parse(model.rateLimitState.resetAt) > Date.parse(generatedAt)
        ? model.rateLimitState.resetAt
        : undefined;
      if (!compliance.allowed || source.status === "disabled" || source.status === "rejected" || source.accessMethod === "disabled" || source.catalog?.approvalScope === "disabled") {
        return operatorState(source, model, "policy_blocked", compliance.allowed ? "public-channel source is disabled by policy" : compliance.reason, true, false);
      }
      if (source.status === "quarantined" || reliability?.rating === "quarantine") {
        return operatorState(source, model, "quarantined", "public-channel source is quarantined or reliability requires quarantine", true, false);
      }
      if (model.legalStatus !== "approved_public" || source.status === "candidate" || source.status === "needs_review" || source.status === "approved") {
        return operatorState(source, model, "pending_review", "public-channel source needs approval or activation before collection", true, false);
      }
      if (rateLimitResetAt) {
        return { ...operatorState(source, model, "delayed", "official API rate-limit state delays collection", false, false), nextEligibleAt: rateLimitResetAt };
      }
      return operatorState(source, model, "actively_collectable", "approved public channel can be collected through official API boundary", false, true);
    });
}

export function buildTelegramPublicSourcePackCompatibility(input: {
  sources: SourceRecord[];
  sourcePacks?: TelegramPublicSourcePack[];
  generatedAt?: string;
}): TelegramPublicSourcePackCompatibilityDto[] {
  const generatedAt = input.generatedAt ?? nowIso();
  const packSources: Array<{ source: SourceRecord; sourcePackId?: string; sourcePackName?: string }> = (input.sourcePacks ?? []).flatMap((pack) =>
    validateTelegramPublicSourcePack(pack, generatedAt).accepted.map((source) => ({
      source,
      sourcePackId: pack.id,
      sourcePackName: pack.name
    }))
  );
  const directSources: Array<{ source: SourceRecord; sourcePackId?: string; sourcePackName?: string }> = input.sources
    .filter((source) => source.type === "telegram_public")
    .map((source) => ({ source }));
  return [
    ...directSources,
    ...packSources
  ].map(({ source, sourcePackId, sourcePackName }) => {
    const model = telegramPublicChannelSourceModel(source);
    const compliance = validateTelegramPublicSourceCompliance(source);
    const target = parseTelegramTarget(source.url);
    const privateKeys = privateTelegramMetadataKeys(source.metadata ?? {});
    const approvalState = source.governance?.approvalState ?? (source.approvedAt && source.approvedBy ? "approved" : source.status === "candidate" ? "candidate" : "pending");
    const pageSize = readPositiveInteger(source, "pageSize", 50, 1, 100);
    const minIntervalSeconds = readPositiveInteger(source, "minIntervalSeconds", 60, 1, 3600);
    const publicQueryWindowLimit = readPositiveInteger(source, "publicQueryWindowLimit", 50, 1, 100);
    return {
      sourceId: source.id,
      sourcePackId,
      sourcePackName,
      channelHandle: model.channelHandle,
      publicUrl: model.publicUrl,
      compatible: compliance.allowed && Boolean(target.channel) && model.retentionClass === "public_chat_text",
      approvalState,
      channelPublicnessProof: {
        publicUrlParseable: Boolean(target.channel),
        inviteOrPrivateUrl: !target.channel,
        accountAutomationFieldsPresent: privateKeys.length > 0
      },
      retentionClass: model.retentionClass,
      coverageTags: coverageTagsForModel(model),
      abuseControlDefaults: {
        pageSize,
        minIntervalSeconds,
        publicQueryWindowLimit,
        mediaRetention: "metadata_only",
        piiMinimized: true
      },
      notes: [
        ...(sourcePackId ? [`source-pack:${sourcePackId}`] : ["registry-source"]),
        ...(compliance.allowed ? ["public-channel compliance checks passed"] : [compliance.reason]),
        "raw media fetches disabled by default"
      ]
    } satisfies TelegramPublicSourcePackCompatibilityDto;
  });
}

export function buildTelegramPublicSourcePackReadiness(input: {
  sources: SourceRecord[];
  sourcePacks?: TelegramPublicSourcePack[];
  evidence?: TelegramPublicEvidenceDto[];
  reliability?: TelegramPublicReliabilityReportDto;
  sla?: TelegramPublicSlaReportDto;
  generatedAt?: string;
}): TelegramPublicSourcePackReadinessDto {
  const generatedAt = input.generatedAt ?? input.sla?.generatedAt ?? input.reliability?.generatedAt ?? nowIso();
  const packSources: Array<{ source: SourceRecord; sourcePackId?: string; sourcePackName?: string }> = (input.sourcePacks ?? []).flatMap((pack) =>
    validateTelegramPublicSourcePack(pack, generatedAt).accepted.map((source) => ({
      source,
      sourcePackId: pack.id,
      sourcePackName: pack.name
    }))
  );
  const directSources: Array<{ source: SourceRecord; sourcePackId?: string; sourcePackName?: string }> = input.sources
    .filter((source) => source.type === "telegram_public")
    .map((source) => ({
      source,
      sourcePackId: readMetadataString(source, "sourcePackId"),
      sourcePackName: readMetadataString(source, "sourcePackName")
    }));
  const evidenceBySource = new Map<string, TelegramPublicEvidenceDto[]>();
  for (const item of input.evidence ?? []) {
    const bucket = evidenceBySource.get(item.sourceId) ?? [];
    bucket.push(item);
    evidenceBySource.set(item.sourceId, bucket);
  }
  const reliabilityBySource = new Map((input.reliability?.sources ?? []).map((source) => [source.sourceId, source]));
  const seen = new Set<string>();
  const sources: TelegramPublicSourcePackReadinessDto["sources"] = [...directSources, ...packSources].flatMap(({ source, sourcePackId, sourcePackName }) => {
    const key = `${source.id}:${sourcePackId ?? "registry"}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const model = telegramPublicChannelSourceModel(source);
    const compliance = validateTelegramPublicSourceCompliance(source);
    const approvalState: SourceApprovalStateLike = source.governance?.approvalState ?? (source.approvedAt && source.approvedBy ? "approved" : source.status === "candidate" ? "candidate" : "pending");
    const approvalScope = telegramPublicApprovalScope(model.approvalScope ?? source.catalog?.approvalScope ?? (model.legalStatus === "approved_public" ? "approved_public" : undefined));
    const pageSize = readPositiveInteger(source, "pageSize", 50, 1, 100);
    const minIntervalSeconds = readPositiveInteger(source, "minIntervalSeconds", 60, 30, 3600);
    const publicQueryWindowLimit = readPositiveInteger(source, "publicQueryWindowLimit", pageSize, 1, 100);
    const expectedRequestsPerHour = numberMetadata(source.metadata?.expectedRequestsPerHour);
    const sourceEvidence = evidenceBySource.get(source.id) ?? [];
    const reliability = reliabilityBySource.get(source.id);
    const duplicateUrlPressure = pressureLabel(reliability?.metrics.duplicateUrlRatio ?? duplicateUrlRatio(sourceEvidence));
    const editDeleteChurn = pressureLabel(reliability?.metrics.editDeleteChurn ?? editDeleteChurnRatio(sourceEvidence));
    const ledgerIds = sourceEvidence
      .filter((item) => item.messageUrl)
      .map((item) => telegramPublicLedgerId(item.sourceId, item.messageUrl, item.contentHash));
    const messageUrls = [...new Set(sourceEvidence.map((item) => item.messageUrl).filter(Boolean))];
    const releaseReasons = [
      ...(!compliance.allowed ? [compliance.reason] : []),
      ...(model.legalStatus === "blocked" || approvalScope === "disabled" ? ["source is blocked or disabled by public-channel policy"] : []),
      ...(model.legalStatus === "pending_review" || approvalState !== "approved" ? ["source requires public-channel approval before collection"] : []),
      ...(model.rateLimitState.resetAt ? [`rate limit reset pending until ${model.rateLimitState.resetAt}`] : []),
      ...(duplicateUrlPressure === "high" ? ["duplicate URL pressure requires suppression before release"] : []),
      ...(editDeleteChurn === "high" ? ["edit/delete churn requires analyst caveat before release"] : [])
    ];
    const caveatCodes = [
      ...(model.legalStatus !== "approved_public" || approvalState !== "approved" ? ["public_channel_source_requires_review"] : []),
      ...(sourceEvidence.some((item) => item.messageState === "deleted" || item.messageState === "unavailable") ? ["public_channel_deleted_or_unavailable_messages"] : []),
      ...(sourceEvidence.some((item) => item.editedAt) ? ["public_channel_edited_messages_preserved"] : []),
      ...(duplicateUrlPressure !== "low" ? ["public_channel_duplicate_url_pressure"] : []),
      ...(model.rateLimitState.resetAt ? ["public_channel_rate_limited"] : [])
    ];
    const releaseStatus: "pass" | "warning" | "blocker" = !compliance.allowed || model.legalStatus === "blocked" || approvalScope === "disabled"
      ? "blocker"
      : releaseReasons.length > 0 || input.sla?.status === "warning"
        ? "warning"
        : "pass";
    const answerReadiness: "ready" | "partial" | "needs_review" = releaseStatus === "pass" ? "ready" : releaseStatus === "warning" ? "partial" : "needs_review";
    return [{
      sourceId: source.id,
      sourcePackId,
      sourcePackName,
      channelHandle: model.channelHandle,
      publicUrl: model.publicUrl,
      approvalScope,
      approvalState,
      collectionWindow: {
        pageSize,
        minIntervalSeconds,
        expectedRequestsPerHour,
        publicQueryWindowLimit
      },
      rateLimitBudget: {
        bounded: minIntervalSeconds >= 30 && pageSize <= 100,
        resetAt: model.rateLimitState.resetAt,
        delayed: Boolean(model.rateLimitState.resetAt && Date.parse(model.rateLimitState.resetAt) > Date.parse(generatedAt))
      },
      dedupePolicy: {
        repeatedUrlSuppression: true as const,
        contentHashRequired: true as const,
        duplicateUrlPressure
      },
      editDeleteHandling: {
        editedMessagesPreserved: true as const,
        deletedUnavailableReplayableAsMetadata: true as const,
        churn: editDeleteChurn
      },
      languageHints: model.language ? [model.language] : [],
      coverage: {
        actors: model.focus.actors,
        ransomware: model.focus.ransomware,
        cves: model.focus.cves,
        victims: model.focus.victims,
        sectors: model.focus.sectors,
        countries: model.focus.countries,
        topicTags: model.topicTags
      },
      replayableEvidenceHandoff: {
        targetAgent: "agent_06" as const,
        ledgerIds,
        messageUrls,
        cursorReplayReady: sourceEvidence.length > 0 && sourceEvidence.every((item) => Boolean(item.messageUrl && item.contentHash && item.messageId !== undefined)),
        metadataOnly: true as const
      },
      answerCaveats: {
        targetAgent: "agent_07" as const,
        caveatCodes,
        readiness: answerReadiness
      },
      releaseGate: {
        targetAgent: "agent_10" as const,
        status: releaseStatus,
        reasons: releaseReasons
      }
    }];
  });
  const blockedCount = sources.filter((source) => source.releaseGate.status === "blocker").length;
  const approvedPublicCount = sources.filter((source) => source.approvalScope === "approved_public" && source.approvalState === "approved").length;
  const candidateCount = sources.filter((source) => source.approvalState === "candidate" || source.approvalState === "pending" || source.approvalScope === "public_requires_review").length;
  const replayableEvidenceCount = sources.reduce((count, source) => count + source.replayableEvidenceHandoff.ledgerIds.length, 0);
  const releaseHold = blockedCount > 0 || input.sla?.status === "blocker";
  return {
    generatedAt,
    status: releaseHold ? "blocked" : candidateCount > 0 || sources.some((source) => source.releaseGate.status === "warning") ? "review_required" : "ready",
    summary: {
      sourcePackCount: input.sourcePacks?.length ?? 0,
      candidateCount,
      approvedPublicCount,
      blockedCount,
      replayableEvidenceCount,
      releaseHold
    },
    sources,
    safeOutput: {
      rawPrivateDataExposed: false,
      rawMediaPayloadsExposed: false,
      credentialsExposed: false,
      mediaRetention: "metadata_only",
      piiMinimized: true
    }
  };
}

export function buildTelegramPublicCanaryRollout(input: {
  sources: SourceRecord[];
  sourcePacks?: TelegramPublicSourcePack[];
  evidence?: TelegramPublicEvidenceDto[];
  reliability?: TelegramPublicReliabilityReportDto;
  sla?: TelegramPublicSlaReportDto;
  applyPlan?: TelegramPublicApplyPlanDto;
  generatedAt?: string;
  maxParallelSources?: number;
}): TelegramPublicCanaryRolloutDto {
  const generatedAt = input.generatedAt ?? input.sla?.generatedAt ?? input.reliability?.generatedAt ?? nowIso();
  const maxParallelSources = Math.max(1, Math.min(5, input.maxParallelSources ?? 5));
  const readiness = buildTelegramPublicSourcePackReadiness({
    sources: input.sources,
    sourcePacks: input.sourcePacks,
    evidence: input.evidence,
    reliability: input.reliability,
    sla: input.sla,
    generatedAt
  });
  const evidenceBySource = new Map<string, TelegramPublicEvidenceDto[]>();
  for (const item of input.evidence ?? []) {
    const bucket = evidenceBySource.get(item.sourceId) ?? [];
    bucket.push(item);
    evidenceBySource.set(item.sourceId, bucket);
  }
  const reliabilityBySource = new Map((input.reliability?.sources ?? []).map((source) => [source.sourceId, source]));
  const registrySourceById = new Map(input.sources.map((source) => [source.id, source]));
  const approvedRows = readiness.sources
    .filter((source) => {
      const registrySource = registrySourceById.get(source.sourceId);
      return source.approvalScope === "approved_public"
        && source.approvalState === "approved"
        && source.releaseGate.status !== "blocker"
        && registrySource?.status !== "paused"
        && registrySource?.status !== "quarantined"
        && registrySource?.status !== "disabled";
    })
    .sort((left, right) => {
      const leftReliability = reliabilityBySource.get(left.sourceId)?.score ?? 0;
      const rightReliability = reliabilityBySource.get(right.sourceId)?.score ?? 0;
      return rightReliability - leftReliability || left.sourceId.localeCompare(right.sourceId);
    })
    .slice(0, maxParallelSources);
  const selectedSources: TelegramPublicCanaryRolloutDto["selectedSources"] = approvedRows.map((source, index) => {
    const sourceEvidence = evidenceBySource.get(source.sourceId) ?? [];
    const reliability = reliabilityBySource.get(source.sourceId);
    const unavailableWindowPressure = pressureLabel(reliability?.metrics.unavailableWindowRatio ?? unavailableWindowRatio(sourceEvidence));
    const editedMessages = sourceEvidence.filter((item) => item.editedAt).length;
    const deletedOrUnavailableMessages = sourceEvidence.filter((item) => item.messageState === "deleted" || item.messageState === "unavailable").length;
    const expectedRequestsPerHour = source.collectionWindow.expectedRequestsPerHour ?? Math.max(1, Math.floor(3600 / source.collectionWindow.minIntervalSeconds));
    const caveats = [
      ...source.answerCaveats.caveatCodes,
      ...(unavailableWindowPressure !== "low" ? ["public_channel_unavailable_window_canary_watch"] : []),
      ...(source.rateLimitBudget.delayed ? ["public_channel_canary_rate_limit_delay"] : []),
      ...(source.languageHints.length === 0 ? ["public_channel_language_coverage_unknown"] : [])
    ];
    const releaseReasons = [
      ...source.releaseGate.reasons,
      ...(source.rateLimitBudget.delayed ? ["canary delayed by active rate-limit reset"] : []),
      ...(source.dedupePolicy.duplicateUrlPressure === "high" ? ["canary requires repeated URL suppression"] : []),
      ...(source.editDeleteHandling.churn === "high" ? ["canary requires edit/delete replay caveat"] : []),
      ...(unavailableWindowPressure === "high" ? ["canary requires unavailable-window metadata replay caveat"] : [])
    ];
    const gateStatus: "pass" | "warning" | "blocker" = source.releaseGate.status === "blocker"
      ? "blocker"
      : releaseReasons.length > 0
        ? "warning"
        : "pass";
    return {
      sourceId: source.sourceId,
      channelHandle: source.channelHandle,
      phase: index === 0 ? "first_channel" : "five_channel",
      collectionWindow: {
        pageSize: Math.min(source.collectionWindow.pageSize, index === 0 ? 25 : 50),
        minIntervalSeconds: source.collectionWindow.minIntervalSeconds,
        expectedRequestsPerHour,
        publicQueryWindowLimit: Math.min(source.collectionWindow.publicQueryWindowLimit, index === 0 ? 25 : 50)
      },
      rateLimitEnvelope: {
        bounded: source.rateLimitBudget.bounded,
        delayed: source.rateLimitBudget.delayed,
        resetAt: source.rateLimitBudget.resetAt,
        maxRequestsPerHour: expectedRequestsPerHour
      },
      queryDedupe: {
        repeatedActorQuerySuppression: true,
        repeatedUrlSuppression: true,
        suppressedUrlCount: sourceEvidence.flatMap((item) => item.extractedUrls).length - new Set(sourceEvidence.flatMap((item) => item.extractedUrls).map((url) => url.toLowerCase())).size,
        duplicateUrlPressure: source.dedupePolicy.duplicateUrlPressure
      },
      languageCoverage: {
        hints: source.languageHints,
        status: source.languageHints.length > 0 ? "covered" : "unknown"
      },
      spamChurnDetection: {
        duplicateUrlPressure: source.dedupePolicy.duplicateUrlPressure,
        editDeleteChurn: source.editDeleteHandling.churn,
        unavailableWindowPressure
      },
      replay: {
        editedMessages,
        deletedOrUnavailableMessages,
        cursorReplayReady: source.replayableEvidenceHandoff.cursorReplayReady,
        ledgerIds: source.replayableEvidenceHandoff.ledgerIds
      },
      agent06EvidenceHandoff: {
        verified: source.replayableEvidenceHandoff.cursorReplayReady || source.replayableEvidenceHandoff.ledgerIds.length === 0,
        ledgerIds: source.replayableEvidenceHandoff.ledgerIds,
        metadataOnly: true
      },
      agent07AnswerCaveats: [...new Set(caveats)],
      agent10ReleaseTrain: {
        status: gateStatus,
        reasons: [...new Set(releaseReasons)]
      }
    };
  });
  const pendingCandidates = readiness.sources
    .filter((source) => source.approvalScope === "public_requires_review" || source.approvalState === "pending" || source.approvalState === "candidate")
    .map((source) => ({
      sourceId: source.sourceId,
      channelHandle: source.channelHandle,
      sourcePackId: source.sourcePackId,
      requiredAction: source.approvalState === "approved" ? "activate" as const : source.approvalScope === "approved_public" ? "approve" as const : "review" as const,
      coverageTags: [...new Set([
        ...source.coverage.topicTags,
        ...source.coverage.actors,
        ...source.coverage.ransomware,
        ...source.coverage.cves,
        ...source.coverage.victims,
        ...source.coverage.sectors,
        ...source.coverage.countries
      ])]
    }));
  const pausedOrQuarantinedCount = input.sources.filter((source) => source.type === "telegram_public" && (source.status === "paused" || source.status === "quarantined" || source.status === "disabled")).length;
  const rollbackStepCount = input.applyPlan?.steps.filter((step) => step.execution === "rollback_only" || step.action === "quarantine_channel").length ?? 0;
  const blocker = selectedSources.some((source) => source.agent10ReleaseTrain.status === "blocker") || input.sla?.status === "blocker";
  const warning = selectedSources.some((source) => source.agent10ReleaseTrain.status === "warning") || input.sla?.status === "warning" || pendingCandidates.length > 0;
  return {
    generatedAt,
    mode: "dry_run",
    status: blocker || selectedSources.length === 0 ? "hold" : warning ? "watch" : "ready",
    summary: {
      approvedSourceCount: readiness.summary.approvedPublicCount,
      selectedSourceCount: selectedSources.length,
      pendingReviewCount: pendingCandidates.length,
      pausedOrQuarantinedCount,
      rollbackStepCount,
      replayableEvidenceCount: readiness.summary.replayableEvidenceCount,
      maxParallelSources,
      releaseTrain: blocker || selectedSources.length === 0 ? "hold" : warning ? "canary_with_warnings" : "canary_ready"
    },
    selectedSources,
    pendingCandidates,
    controls: {
      queryDedupe: {
        repeatedActorQueryControls: true,
        actorQueryCooldownSeconds: 300,
        duplicateUrlSuppression: true
      },
      abuse: {
        burstySpamDetection: true,
        editDeleteReplay: true,
        unavailableWindowHandling: "metadata_only_replay",
        sourcePauseQuarantine: true
      },
      rollback: {
        dryRunOnly: true,
        rollbackActions: ["quarantine_channel", "reduce_window", "delay_poll"],
        sourcePauseSupported: true,
        quarantineSupported: true
      }
    },
    safeOutput: {
      rawPrivateDataExposed: false,
      rawMediaPayloadsExposed: false,
      credentialsExposed: false,
      mediaRetention: "metadata_only",
      piiMinimized: true
    }
  };
}

export function buildTelegramPublicPromotionCanaryProof(input: {
  query?: string;
  entityType?: string;
  sources: SourceRecord[];
  evidence?: TelegramPublicEvidenceDto[];
  promotion?: TelegramPublicPromotionProgramDto;
  reliability?: TelegramPublicReliabilityReportDto;
  canaryRollout?: TelegramPublicCanaryRolloutDto;
  applyPlan?: TelegramPublicApplyPlanDto;
  generatedAt?: string;
}): TelegramPublicPromotionCanaryProofDto {
  const generatedAt = input.generatedAt ?? input.canaryRollout?.generatedAt ?? input.reliability?.generatedAt ?? nowIso();
  const evidence = input.evidence ?? [];
  const promotion = input.promotion ?? buildTelegramPublicEvidencePromotionProgram({
    query: input.query ?? "",
    sources: input.sources,
    evidence,
    previousUrls: input.sources.flatMap((source) => readMetadataStringArray(source, "lastDiscoveredUrls") ?? []),
    generatedAt
  });
  const reliability = input.reliability ?? buildTelegramPublicReliabilityReport({
    query: input.query,
    entityType: input.entityType,
    sources: input.sources,
    evidence,
    generatedAt
  });
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const reliabilityBySource = new Map(reliability.sources.map((source) => [source.sourceId, source]));
  const promotedUrls = new Set(promotion.promoted.map((item) => item.messageUrl));
  const evidenceBySource = new Map<string, TelegramPublicEvidenceDto[]>();
  for (const item of evidence) {
    const bucket = evidenceBySource.get(item.sourceId) ?? [];
    bucket.push(item);
    evidenceBySource.set(item.sourceId, bucket);
  }
  const claimCandidates = evidence.flatMap((item) => telegramPublicClaimCandidatesForEvidence(item));
  const claimIdsByMessageUrl = new Map<string, string[]>();
  for (const claim of claimCandidates) {
    claimIdsByMessageUrl.set(claim.messageUrl, [...(claimIdsByMessageUrl.get(claim.messageUrl) ?? []), claim.claimId]);
  }
  const graphHints = telegramPublicGraphHintsForClaims(claimCandidates);
  const graphHintIdsByMessageUrl = new Map<string, string[]>();
  for (const hint of graphHints) {
    graphHintIdsByMessageUrl.set(hint.messageUrl, [...(graphHintIdsByMessageUrl.get(hint.messageUrl) ?? []), hint.hintId]);
  }
  const sourceHealth: TelegramPublicPromotionCanaryProofDto["sourceHealth"] = reliability.sources.map((source) => {
    const sourceEvidence = evidenceBySource.get(source.sourceId) ?? [];
    const sourceClaims = claimCandidates.filter((claim) => claim.sourceId === source.sourceId);
    const rateLimitDebt = source.metrics.rateLimitPenalty > 0 || Boolean(sourceById.get(source.sourceId)?.metadata?.rateLimitResetAt) ? "delayed" : "none";
    const duplicateUrlPressure = pressureLabel(source.metrics.duplicateUrlRatio);
    const editDeleteChurn = pressureLabel(source.metrics.editDeleteChurn);
    const unavailableWindows = pressureLabel(source.metrics.unavailableWindowRatio);
    const languageDrift = source.metrics.languageCoverage < 0.8 ? "watch" : "none";
    const spamChurn = pressureLabel(Math.max(source.metrics.duplicateUrlRatio, source.metrics.editDeleteChurn, source.metrics.unavailableWindowRatio));
    const rollbackTriggers: TelegramPublicApplyPlanAction[] = [
      ...(rateLimitDebt === "delayed" ? ["delay_poll" as const] : []),
      ...(duplicateUrlPressure !== "low" ? ["suppress_repeated_urls" as const] : []),
      ...(editDeleteChurn !== "low" || unavailableWindows !== "low" ? ["reduce_window" as const] : []),
      ...(source.rating === "quarantine" || source.rating === "blocked" ? ["quarantine_channel" as const] : [])
    ];
    return {
      sourceId: source.sourceId,
      channelHandle: source.channelHandle,
      rateLimitDebt,
      duplicateUrlPressure,
      editDeleteChurn,
      unavailableWindows,
      languageDrift,
      spamChurn,
      evidenceYield: roundMetric(sourceEvidence.length ? promotion.promoted.filter((item) => item.sourceId === source.sourceId).length / sourceEvidence.length : 0),
      claimYield: roundMetric(sourceEvidence.length ? sourceClaims.length / sourceEvidence.length : 0),
      rollbackTriggers: [...new Set([...(input.applyPlan?.steps.filter((step) => step.sourceId === source.sourceId).map((step) => step.action) ?? []), ...rollbackTriggers])]
    };
  });
  const evidenceFlow: TelegramPublicPromotionCanaryProofDto["evidenceFlow"] = evidence.map((item) => {
    const ledgerId = telegramPublicLedgerId(item.sourceId, item.messageUrl, item.contentHash);
    return {
      sourceId: item.sourceId,
      messageUrl: item.messageUrl,
      messageId: item.messageId,
      contentHash: item.contentHash,
      state: item.editedAt ? "edited" : item.messageState === "deleted" ? "deleted" : item.messageState === "unavailable" ? "unavailable" : "available",
      replayable: Boolean(item.messageUrl && item.contentHash && item.messageId !== undefined),
      promotedToAgent06: promotedUrls.has(item.messageUrl),
      claimCandidateIds: claimIdsByMessageUrl.get(item.messageUrl) ?? [],
      graphHintIds: graphHintIdsByMessageUrl.get(item.messageUrl) ?? []
    };
  });
  const replayableLedgerIds = evidenceFlow
    .filter((item) => item.replayable)
    .map((item) => telegramPublicLedgerId(item.sourceId, item.messageUrl, item.contentHash));
  const caveatCodes = [
    ...(sourceHealth.some((source) => source.rateLimitDebt === "delayed") ? ["public_channel_rate_limit_debt"] : []),
    ...(sourceHealth.some((source) => source.duplicateUrlPressure !== "low") ? ["public_channel_duplicate_url_pressure"] : []),
    ...(sourceHealth.some((source) => source.editDeleteChurn !== "low") ? ["public_channel_edit_delete_churn"] : []),
    ...(sourceHealth.some((source) => source.unavailableWindows !== "low") ? ["public_channel_unavailable_windows"] : []),
    ...(sourceHealth.some((source) => source.languageDrift === "watch") ? ["public_channel_language_drift"] : []),
    ...(sourceHealth.some((source) => source.evidenceYield < 0.35) ? ["public_channel_low_evidence_yield"] : []),
    ...(sourceHealth.some((source) => source.claimYield < 0.35) ? ["public_channel_low_claim_yield"] : [])
  ];
  const blockerReasons = [
    ...(sourceHealth.some((source) => telegramPublicRollbackTriggers(source).includes("quarantine_channel")) ? ["public-channel canary has quarantine rollback trigger"] : []),
    ...(input.canaryRollout?.status === "hold" ? ["public-channel rollout is on hold"] : [])
  ];
  const warningReasons = [
    ...caveatCodes,
    ...(input.canaryRollout?.status === "watch" ? ["public-channel rollout has canary warnings"] : [])
  ];
  const rcStatus: "pass" | "warning" | "blocker" = blockerReasons.length > 0 ? "blocker" : warningReasons.length > 0 ? "warning" : "pass";
  return {
    generatedAt,
    mode: "dry_run",
    status: rcStatus === "blocker" ? "hold" : rcStatus === "warning" ? "warning" : "pass",
    summary: {
      sourceCount: sourceHealth.length,
      evidenceCount: evidence.length,
      promotedEvidenceCount: promotion.promoted.length,
      claimCandidateCount: claimCandidates.length,
      graphHintCount: graphHints.length,
      replayableEvidenceCount: replayableLedgerIds.length,
      lowYieldSourceCount: sourceHealth.filter((source) => source.evidenceYield < 0.35 || source.claimYield < 0.35).length,
      rollbackTriggerCount: sourceHealth.filter((source) => telegramPublicRollbackTriggers(source).length > 0).length,
      noLeakSerialization: true
    },
    sourceHealth,
    evidenceFlow,
    claimCandidates: claimCandidates.map(({ messageUrl: _messageUrl, ...claim }) => claim),
    graphHints: graphHints.map(({ messageUrl: _messageUrl, ...hint }) => hint),
    handoffs: {
      agent06EvidenceCutover: {
        replayableLedgerIds,
        promotedMessageUrls: promotion.promoted.map((item) => item.messageUrl),
        evidenceCutoverReady: replayableLedgerIds.length >= promotion.promoted.length && promotion.policyDisabled.length === 0
      },
      agent07PublicAnswer: {
        caveatCodes: [...new Set(caveatCodes)],
        answerState: blockerReasons.length > 0 ? "needs_review" : warningReasons.length > 0 ? "partial" : "ready"
      },
      agent10RcGate: {
        status: rcStatus,
        reasons: [...new Set([...blockerReasons, ...warningReasons])]
      }
    },
    safeOutput: {
      rawPrivateDataExposed: false,
      rawMediaPayloadsExposed: false,
      credentialsExposed: false,
      mediaRetention: "metadata_only",
      piiMinimized: true
    }
  };
}

export function buildTelegramPublicPromotionCertification(input: {
  query?: string;
  entityType?: string;
  sources: SourceRecord[];
  evidence?: TelegramPublicEvidenceDto[];
  promotionCanary?: TelegramPublicPromotionCanaryProofDto;
  generatedAt?: string;
}): TelegramPublicPromotionCertificationDto {
  const generatedAt = input.generatedAt ?? input.promotionCanary?.generatedAt ?? nowIso();
  const promotionCanary = input.promotionCanary ?? buildTelegramPublicPromotionCanaryProof({
    query: input.query,
    entityType: input.entityType,
    sources: input.sources,
    evidence: input.evidence,
    generatedAt
  });
  const healthBySource = new Map(promotionCanary.sourceHealth.map((source) => [source.sourceId, source]));
  const claimsById = new Map(promotionCanary.claimCandidates.map((claim) => [claim.claimId, claim]));
  const hintsById = new Map(promotionCanary.graphHints.map((hint) => [hint.hintId, hint]));
  const rcReasons = telegramPublicStringList(promotionCanary.handoffs.agent10RcGate.reasons);
  const rollbackActions = uniqueApplyPlanActions([
    ...promotionCanary.sourceHealth.flatMap((source) => telegramPublicRollbackTriggers(source)),
    ...(rcReasons.includes("public_channel_rate_limit_debt") ? ["delay_poll" as const] : [])
  ]);
  const canaryBlocked = promotionCanary.handoffs.agent10RcGate.status === "blocker";
  const evidenceCertification: TelegramPublicPromotionCertificationDto["evidenceCertification"] = promotionCanary.evidenceFlow.map((item) => {
    const health = healthBySource.get(item.sourceId);
    const hasSourceBlock = telegramPublicRollbackTriggers(health).includes("quarantine_channel");
    const hasStateBlock = item.state === "deleted" || item.state === "unavailable";
    const hasReviewState = item.state === "edited";
    const messageClaims = item.claimCandidateIds.map((claimId) => claimsById.get(claimId)).filter((claim): claim is NonNullable<typeof claim> => Boolean(claim));
    const messageHints = item.graphHintIds.map((hintId) => hintsById.get(hintId)).filter((hint): hint is NonNullable<typeof hint> => Boolean(hint));
    const answerAllowed = item.promotedToAgent06 && item.replayable && item.state === "available" && !hasSourceBlock && messageClaims.some((claim) => !claim.needsReview);
    const graphAllowed = item.replayable && !hasStateBlock && !hasSourceBlock && messageHints.some((hint) => !hint.reviewRequired);
    const blocked = hasSourceBlock || hasStateBlock || !item.replayable;
    const reasons = [
      ...(item.promotedToAgent06 ? ["promoted_to_agent06"] : ["not_promoted_to_agent06"]),
      ...(item.replayable ? ["replayable_public_message"] : ["missing_replayable_message_provenance"]),
      ...(hasReviewState ? ["edited_message_requires_review_before_answer_promotion"] : []),
      ...(hasStateBlock ? ["deleted_or_unavailable_messages_update_source_health_only"] : []),
      ...(hasSourceBlock ? ["source_has_quarantine_rollback_trigger"] : []),
      ...(health?.rateLimitDebt === "delayed" ? ["rate_limit_debt_keeps_freshness_partial"] : []),
      ...(health && health.duplicateUrlPressure !== "low" ? ["duplicate_url_pressure_requires_caveat"] : []),
      ...(answerAllowed ? ["public_answer_may_use_supported_claims"] : []),
      ...(graphAllowed ? ["graph_hint_may_enter_agent08_candidate_queue"] : [])
    ];
    return {
      ledgerId: telegramPublicLedgerId(item.sourceId, item.messageUrl, item.contentHash),
      sourceId: item.sourceId,
      messageUrl: item.messageUrl,
      state: item.state,
      influence: blocked ? "blocked" : answerAllowed && graphAllowed ? "answer_and_graph" : "source_health_only",
      publicAnswerAllowed: answerAllowed,
      graphHintAllowed: graphAllowed,
      sourceHealthUpdateAllowed: true,
      releaseEligible: answerAllowed && graphAllowed && !canaryBlocked,
      reasons: uniqueStrings(reasons)
    };
  });
  const evidenceByLedger = new Map(evidenceCertification.map((item) => [item.ledgerId, item]));
  const claimCertification: TelegramPublicPromotionCertificationDto["claimCertification"] = promotionCanary.claimCandidates.map((claim) => {
    const evidence = evidenceByLedger.get(claim.ledgerId);
    const answerInfluence = evidence?.publicAnswerAllowed && !claim.needsReview ? "ready" : evidence?.influence === "blocked" ? "blocked" : "partial";
    return {
      claimId: claim.claimId,
      kind: claim.kind,
      value: claim.value,
      answerInfluence,
      reasons: uniqueStrings([
        ...(claim.needsReview ? ["claim_requires_review"] : ["claim_is_high_confidence"]),
        ...(evidence?.publicAnswerAllowed ? ["answer_state_machine_can_reference_claim"] : ["answer_state_machine_keeps_claim_caveated"]),
        ...(evidence?.sourceHealthUpdateAllowed ? ["source_health_always_receives_safe_metadata_update"] : [])
      ])
    };
  });
  const graphCertification: TelegramPublicPromotionCertificationDto["graphCertification"] = promotionCanary.graphHints.map((hint) => {
    const evidence = evidenceByLedger.get(hint.ledgerId);
    const blocked = !evidence || evidence.influence === "blocked";
    const needsReview = hint.reviewRequired || !evidence?.graphHintAllowed;
    return {
      hintId: hint.hintId,
      relationship: hint.relationship,
      influence: blocked ? "blocked" : needsReview ? "review_required" : "candidate",
      agent08GraphCertification: blocked ? "blocked" : needsReview ? "needs_review" : "certified_candidate",
      reasons: uniqueStrings([
        ...(hint.reviewRequired ? ["graph_hint_contains_review_required_claim"] : ["graph_hint_has_supported_public_claims"]),
        ...(evidence?.graphHintAllowed ? ["agent08_may_queue_candidate_hint"] : ["agent08_holds_hint_for_review_or_block"]),
        ...(blocked ? ["source_message_blocked_from_graph_influence"] : [])
      ])
    };
  });
  const certifiedLedgerIds = evidenceCertification.filter((item) => item.influence === "answer_and_graph").map((item) => item.ledgerId);
  const blockedLedgerIds = evidenceCertification.filter((item) => item.influence === "blocked").map((item) => item.ledgerId);
  const heldLedgerIds = evidenceCertification.filter((item) => item.influence === "source_health_only").map((item) => item.ledgerId);
  const candidateHintIds = graphCertification.filter((item) => item.influence === "candidate").map((item) => item.hintId);
  const reviewRequiredHintIds = graphCertification.filter((item) => item.influence === "review_required").map((item) => item.hintId);
  const blockedHintIds = graphCertification.filter((item) => item.influence === "blocked").map((item) => item.hintId);
  const releaseDecision: TelegramPublicPromotionCertificationDto["summary"]["releaseDecision"] = canaryBlocked || blockedLedgerIds.length > 0 ? "hold" : heldLedgerIds.length > 0 || reviewRequiredHintIds.length > 0 || promotionCanary.status === "warning" ? "watch" : "promote";
  const status: TelegramPublicPromotionCertificationDto["status"] = releaseDecision === "hold" ? "blocked" : releaseDecision === "watch" ? "review_required" : "certified";
  const caveatCodes = uniqueStrings([
    ...telegramPublicStringList(promotionCanary.handoffs.agent07PublicAnswer.caveatCodes),
    ...rcReasons.filter((reason) => reason.startsWith("public_channel_")),
    ...(heldLedgerIds.length > 0 ? ["public_channel_certification_partial_evidence"] : []),
    ...(blockedLedgerIds.length > 0 ? ["public_channel_certification_blocked_evidence"] : []),
    ...(reviewRequiredHintIds.length > 0 ? ["public_channel_graph_hint_review_required"] : [])
  ]);
  return {
    generatedAt,
    mode: "dry_run",
    status,
    summary: {
      certifiedEvidenceCount: certifiedLedgerIds.length,
      heldEvidenceCount: heldLedgerIds.length,
      blockedEvidenceCount: blockedLedgerIds.length,
      answerEligibleClaimCount: claimCertification.filter((claim) => claim.answerInfluence === "ready").length,
      graphEligibleHintCount: candidateHintIds.length,
      sourceHealthUpdateCount: promotionCanary.sourceHealth.length,
      releaseDecision,
      rollbackRequired: rollbackActions.length > 0,
      noLeakSerialization: true
    },
    decisionRules: [
      {
        ruleId: "public_answer_influence",
        surface: "public_answer",
        allowWhen: ["message is replayable", "message is promoted to Agent 06", "message is available", "at least one claim is high confidence", "source is not quarantined"],
        holdWhen: ["claim needs review", "message is edited", "source has duplicate/rate-limit caveats"],
        current: certifiedLedgerIds.length > 0 ? "allow" : blockedLedgerIds.length > 0 ? "block" : "hold"
      },
      {
        ruleId: "graph_hint_influence",
        surface: "graph",
        allowWhen: ["message is replayable", "hint does not require review", "source is not quarantined"],
        holdWhen: ["weak co-mentions", "edited messages", "review-required claims"],
        current: candidateHintIds.length > 0 ? "allow" : blockedHintIds.length > 0 ? "block" : "hold"
      },
      {
        ruleId: "source_health_influence",
        surface: "source_health",
        allowWhen: ["safe metadata fields are present", "no raw message or media payload is serialized"],
        holdWhen: ["never held for deleted/unavailable messages because health updates are metadata-only"],
        current: "allow"
      },
      {
        ruleId: "release_decision",
        surface: "release",
        allowWhen: ["Agent 10 RC gate passes", "no rollback triggers remain", "answer and graph candidates are certified"],
        holdWhen: ["RC gate warning", "partial evidence", "rollback triggers", "review-required graph hints"],
        current: releaseDecision === "promote" ? "allow" : releaseDecision === "hold" ? "block" : "hold"
      }
    ],
    evidenceCertification,
    claimCertification,
    graphCertification,
    handoffs: {
      agent06EvidenceCertification: {
        certifiedLedgerIds,
        heldLedgerIds,
        blockedLedgerIds
      },
      agent07AnswerStateMachine: {
        state: releaseDecision === "promote" ? "ready" : releaseDecision === "watch" ? "partial" : "needs_review",
        answerMayUseEvidence: certifiedLedgerIds.length > 0 && releaseDecision !== "hold",
        transition: releaseDecision === "promote" ? "promote_public_channel_claims" : releaseDecision === "watch" ? "keep_partial_with_caveats" : "block_public_channel_claims",
        caveatCodes
      },
      agent08GraphCertification: {
        status: blockedHintIds.length > 0 ? "blocked" : reviewRequiredHintIds.length > 0 ? "review_required" : "certified",
        candidateHintIds,
        reviewRequiredHintIds,
        blockedHintIds
      },
      agent10RcGate: {
        status: releaseDecision === "hold" ? "blocker" : releaseDecision === "watch" ? "warning" : "pass",
        decision: releaseDecision,
        reasons: uniqueStrings([
          ...promotionCanary.handoffs.agent10RcGate.reasons,
          ...(blockedLedgerIds.length > 0 ? ["public-channel certification has blocked evidence"] : []),
          ...(heldLedgerIds.length > 0 ? ["public-channel certification has held partial evidence"] : []),
          ...(reviewRequiredHintIds.length > 0 ? ["public-channel graph hints require review"] : [])
        ]),
        rollbackActions
      }
    },
    safeOutput: {
      rawPrivateDataExposed: false,
      rawMediaPayloadsExposed: false,
      credentialsExposed: false,
      mediaRetention: "metadata_only",
      piiMinimized: true
    }
  };
}

export function buildTelegramPublicApplyPlan(input: TelegramPublicApplyPlanInput): TelegramPublicApplyPlanDto {
  return buildTelegramPublicCutoverReport(input).applyPlan;
}

export function telegramPublicApplyPlanApiContract(): TelegramPublicApplyPlanApiContractDto {
  return {
    endpoint: "/v1/public-channels/apply-plan",
    method: "POST",
    mode: "dry_run",
    request: {
      contentType: "application/json",
      fields: [
        { name: "query", type: "string", required: false, description: "Actor, CVE, victim, ransomware, sector, or free-text query used to scope public-channel recommendations." },
        { name: "entityType", type: "string", required: false, description: "Optional query type hint such as actor, malware, cve, victim, sector, or country." },
        { name: "clearWebEvidenceCount", type: "number", required: false, description: "Optional count used only for cutover readiness context." }
      ]
    },
    response: {
      fields: ["contract", "applyPlan", "canaryRollout", "promotionCanary", "promotionCertification"],
      stepFields: ["id", "action", "execution", "sourceId", "channelHandle", "priority", "reason", "prerequisites", "expectedSchedulerEffects", "expectedEvidenceEffects", "rollback", "rateLimitSafety", "mediaPolicy", "piiMinimizationRequired", "manual", "automationSafe"],
      forbiddenFields: ["rawText", "body", "html", "messageBody", "rawMessage", "mediaPayload", "sessionString", "phoneNumber", "password", "inviteLink", "userSession"],
      actions: ["activate_source_pack", "request_review", "delay_poll", "refresh_cursor", "reduce_window", "quarantine_channel", "suppress_repeated_urls"],
      executions: ["automation_safe", "human_approval_required", "blocked", "rollback_only"]
    },
    examples: {
      automationSafe: telegramPublicApplyPlanExampleStep("reduce_window", "automation_safe"),
      humanApprovalRequired: telegramPublicApplyPlanExampleStep("request_review", "human_approval_required"),
      blockedPrivateTarget: telegramPublicApplyPlanExampleStep("request_review", "blocked"),
      rateLimitedChannel: telegramPublicApplyPlanExampleStep("delay_poll", "automation_safe"),
      rollbackOnlyQuarantine: telegramPublicApplyPlanExampleStep("quarantine_channel", "rollback_only")
    }
  };
}

function telegramPublicApplyPlanExampleStep(
  action: TelegramPublicApplyPlanAction,
  execution: TelegramPublicApplyPlanExecution
): TelegramPublicApplyPlanStep {
  return {
    id: `example_${action}_${execution}`,
    action,
    execution,
    sourceId: execution === "blocked" ? "unsafe_private_example" : "public_channel_example",
    channelHandle: execution === "blocked" ? "private_invite_blocked" : "public_cti_channel",
    priority: execution === "blocked" || execution === "rollback_only" ? "high" : "medium",
    reason: execution === "blocked"
      ? "private, invite, and account-automation targets are blocked from public-channel activation"
      : `${action} example for public-channel apply-plan contract`,
    prerequisites: execution === "blocked"
      ? ["blocked: private, invite, or account-automation targets cannot be activated", "source must remain a public Telegram channel using official_api access"]
      : ["source must remain a public Telegram channel using official_api access", "legal notes and approval scope must be present before collection"],
    expectedSchedulerEffects: action === "delay_poll"
      ? ["set next eligible poll after rate-limit or retry-after", "do not enqueue a new public-channel task"]
      : ["dry-run only; no scheduler mutation is performed"],
    expectedEvidenceEffects: ["no raw message body or media payload is included in this contract"],
    rollback: action === "quarantine_channel"
      ? ["restore channel to previous status after review"]
      : ["discard dry-run plan without changing source or scheduler state"],
    rateLimitSafety: action === "delay_poll"
      ? ["honor current Telegram rate-limit reset before polling"]
      : ["no Telegram API request is made by this apply plan"],
    mediaPolicy: "metadata_only",
    piiMinimizationRequired: true,
    manual: execution === "human_approval_required" || execution === "rollback_only",
    automationSafe: execution === "automation_safe"
  };
}

function buildTelegramPublicApplyPlanFromReport(
  report: Omit<TelegramPublicCutoverReportDto, "applyPlan">,
  sources: SourceRecord[]
): TelegramPublicApplyPlanDto {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const steps = report.repairs.map((repair) => buildTelegramPublicApplyPlanStep(repair, sourceById.get(repair.sourceId ?? ""), report.generatedAt));
  const priorityRank = { low: 1, medium: 2, high: 3 } as const;
  const highestPriority = steps
    .map((step) => step.priority)
    .sort((a, b) => priorityRank[b] - priorityRank[a])[0];
  const automationSafeCount = steps.filter((step) => step.execution === "automation_safe").length;
  const humanApprovalRequiredCount = steps.filter((step) => step.execution === "human_approval_required").length;
  const blockedCount = steps.filter((step) => step.execution === "blocked").length;
  const rollbackOnlyCount = steps.filter((step) => step.execution === "rollback_only").length;
  return {
    generatedAt: report.generatedAt,
    mode: "dry_run",
    query: report.query,
    steps,
    summary: {
      stepCount: steps.length,
      automationSafeCount,
      humanApprovalRequiredCount,
      blockedCount,
      rollbackOnlyCount,
      highestPriority,
      canAutoApply: steps.length > 0 && steps.every((step) => step.execution === "automation_safe")
    },
    promotionGate: {
      publicChannelApplyPlanReady: blockedCount === 0,
      blockedUnsafeActivationCount: steps.filter((step) => step.action === "activate_source_pack" && step.execution === "blocked").length,
      manualApprovalCount: humanApprovalRequiredCount,
      automationSafeCount,
      metadataOnlyMedia: true,
      piiMinimizationRequired: true
    }
  };
}

function buildTelegramPublicApplyPlanStep(
  repair: TelegramPublicRepairRecommendation,
  source: SourceRecord | undefined,
  generatedAt: string
): TelegramPublicApplyPlanStep {
  const unsafe = source ? !validateTelegramPublicSourceCompliance(source).allowed : false;
  const execution = telegramPublicApplyExecution(repair, source, unsafe);
  const action = repair.action;
  return {
    id: `tg_apply_${hashContent(`${generatedAt}:${action}:${repair.sourceId ?? ""}:${repair.channelHandle ?? ""}:${repair.reason}`).slice(0, 16)}`,
    action,
    execution,
    sourceId: repair.sourceId,
    channelHandle: repair.channelHandle,
    priority: repair.priority,
    reason: repair.reason,
    prerequisites: telegramPublicApplyPrerequisites(action, execution, source),
    expectedSchedulerEffects: telegramPublicApplySchedulerEffects(action, repair),
    expectedEvidenceEffects: telegramPublicApplyEvidenceEffects(action),
    rollback: telegramPublicApplyRollback(action, source),
    rateLimitSafety: telegramPublicApplyRateLimitSafety(action, source),
    mediaPolicy: "metadata_only",
    piiMinimizationRequired: true,
    manual: execution === "human_approval_required" || execution === "rollback_only",
    automationSafe: execution === "automation_safe"
  };
}

function telegramPublicApplyExecution(
  repair: TelegramPublicRepairRecommendation,
  source: SourceRecord | undefined,
  unsafe: boolean
): TelegramPublicApplyPlanExecution {
  if (unsafe && repair.action !== "quarantine_channel") return "blocked";
  if (repair.action === "activate_source_pack" || repair.action === "request_review") return "human_approval_required";
  if (repair.action === "quarantine_channel") return source?.status === "active" || source?.status === "probation" || source?.status === "degraded" ? "rollback_only" : "human_approval_required";
  return "automation_safe";
}

function telegramPublicApplyPrerequisites(
  action: TelegramPublicApplyPlanAction,
  execution: TelegramPublicApplyPlanExecution,
  source?: SourceRecord
): string[] {
  const publicPrereq = "source must remain a public Telegram channel using official_api access";
  const legalPrereq = "legal notes and approval scope must be present before collection";
  if (execution === "blocked") return ["blocked: private, invite, or account-automation targets cannot be activated", publicPrereq];
  if (action === "activate_source_pack") return ["operator selects the candidate source-pack entry", legalPrereq, publicPrereq, "activation remains disabled until source review is approved"];
  if (action === "request_review") return [legalPrereq, publicPrereq, "reviewer confirms retention class public_chat_text and PII minimization"];
  if (action === "delay_poll") return ["scheduler retry/backoff state is present", "delay does not bypass Telegram rate limits"];
  if (action === "refresh_cursor") return ["source has an approved public-channel record", "refresh uses stored cursor metadata only"];
  if (action === "reduce_window") return ["current query window exceeds the safe public-channel window", "media fetch remains disabled"];
  if (action === "suppress_repeated_urls") return ["duplicate URL evidence is above threshold", "suppression uses URL hashes or normalized public URLs only"];
  return [publicPrereq, source?.status === "active" ? "operator confirms rollback/quarantine reason" : "operator confirms channel should be quarantined"];
}

function telegramPublicApplySchedulerEffects(action: TelegramPublicApplyPlanAction, repair: TelegramPublicRepairRecommendation): string[] {
  if (action === "delay_poll") return ["set next eligible poll after rate-limit or retry-after", "do not enqueue a new public-channel task"];
  if (action === "refresh_cursor") return ["schedule a bounded cursor refresh for the approved public source", "preserve current cursor for rollback"];
  if (action === "reduce_window") return ["lower per-channel query window for future public-channel tasks"];
  if (action === "quarantine_channel") return ["remove channel from active public polling until restored"];
  if (action === "activate_source_pack") return ["create candidate/approved source records only after review", "no immediate crawl is triggered"];
  if (action === "request_review") return ["create or update review queue item", "scheduler remains unchanged until approval"];
  return [`suppress repeated URL scheduling for ${repair.channelHandle ?? repair.sourceId ?? "public channel"}`];
}

function telegramPublicApplyEvidenceEffects(action: TelegramPublicApplyPlanAction): string[] {
  if (action === "suppress_repeated_urls") return ["future evidence keeps provenance but repeated URLs are suppressed from promotion"];
  if (action === "refresh_cursor") return ["future deltas can resume from refreshed public message cursor"];
  if (action === "quarantine_channel") return ["existing public evidence remains auditable; new captures are stopped"];
  if (action === "activate_source_pack" || action === "request_review") return ["no evidence changes during dry-run planning"];
  if (action === "reduce_window") return ["future evidence volume is reduced without deleting existing captures"];
  return ["no evidence mutation during dry-run planning"];
}

function telegramPublicApplyRollback(action: TelegramPublicApplyPlanAction, source?: SourceRecord): string[] {
  if (action === "activate_source_pack") return ["remove unapproved candidate source record before activation", "keep source-pack fixture unchanged"];
  if (action === "request_review") return ["close review request without activating source"];
  if (action === "delay_poll") return ["restore previous nextEligibleAt or retry-after value"];
  if (action === "refresh_cursor") return ["restore previous cursor/afterMessageId metadata"];
  if (action === "reduce_window") return ["restore previous publicQueryWindowLimit metadata"];
  if (action === "quarantine_channel") return [`restore channel to ${source?.status ?? "previous"} status after review`];
  return ["remove repeated-URL suppression rule"];
}

function telegramPublicApplyRateLimitSafety(action: TelegramPublicApplyPlanAction, source?: SourceRecord): string[] {
  const resetAt = readMetadataString(source ?? ({ metadata: {} } as SourceRecord), "rateLimitResetAt");
  if (action === "delay_poll") return [resetAt ? `honor current rate-limit reset at ${resetAt}` : "honor scheduler retry-after before polling"];
  if (action === "activate_source_pack" || action === "request_review") return ["no API request is made by this apply plan"];
  if (action === "refresh_cursor") return ["cursor refresh must respect minIntervalSeconds and pageSize caps"];
  if (action === "reduce_window") return ["reduced windows lower request pressure"];
  if (action === "quarantine_channel") return ["quarantine stops new public-channel polling"];
  return ["suppression reduces repeated promotion pressure without additional Telegram calls"];
}

function telegramPublicLedgerId(sourceId: string, messageUrl: string, contentHash?: string): string {
  return `ledger_tg_${hashContent(`${sourceId}:${messageUrl}:${contentHash ?? ""}`).slice(0, 20)}`;
}

function telegramPublicApprovalScope(value: unknown): TelegramPublicSourcePackReadinessDto["sources"][number]["approvalScope"] {
  return value === "public_requires_review" || value === "metadata_only" || value === "disabled" || value === "approved_public" ? value : "unknown";
}

function pressureLabel(value: number): "low" | "watch" | "high" {
  return value >= 0.4 ? "high" : value >= 0.2 ? "watch" : "low";
}

function duplicateUrlRatio(evidence: TelegramPublicEvidenceDto[]): number {
  const urls = evidence.flatMap((item) => item.extractedUrls);
  if (urls.length === 0) return 0;
  return 1 - new Set(urls.map((url) => url.toLowerCase())).size / urls.length;
}

function editDeleteChurnRatio(evidence: TelegramPublicEvidenceDto[]): number {
  if (evidence.length === 0) return 0;
  const changed = evidence.filter((item) => item.editedAt || item.messageState === "deleted" || item.messageState === "unavailable").length;
  return changed / evidence.length;
}

function unavailableWindowRatio(evidence: TelegramPublicEvidenceDto[]): number {
  if (evidence.length === 0) return 0;
  return evidence.filter((item) => item.messageState === "unavailable").length / evidence.length;
}

function telegramPublicClaimCandidatesForEvidence(item: TelegramPublicEvidenceDto): Array<TelegramPublicPromotionCanaryProofDto["claimCandidates"][number] & { messageUrl: string }> {
  const ledgerId = telegramPublicLedgerId(item.sourceId, item.messageUrl, item.contentHash);
  const claims: Array<TelegramPublicPromotionCanaryProofDto["claimCandidates"][number] & { messageUrl: string }> = [];
  const push = (kind: TelegramPublicPromotionCanaryProofDto["claimCandidates"][number]["kind"], value: string, confidence = item.confidence) => {
    const normalized = normalizeWhitespace(value);
    if (!normalized) return;
    claims.push({
      claimId: `tg_claim_${hashContent(`${ledgerId}:${kind}:${normalized.toLowerCase()}`).slice(0, 18)}`,
      sourceId: item.sourceId,
      ledgerId,
      kind,
      value: normalized,
      confidence: clamp01(confidence),
      needsReview: item.messageState === "deleted" || item.messageState === "unavailable" || Boolean(item.editedAt) || confidence < 0.7,
      messageUrl: item.messageUrl
    });
  };
  for (const actor of item.extractionHandoff?.actorAliases ?? extractActorAliasMarkers(item.snippet)) push("actor", actor);
  for (const cve of item.extractionHandoff?.cves ?? extractCveMarkers(item.snippet)) push("cve", cve.toUpperCase());
  for (const victim of item.extractionHandoff?.victims ?? extractVictimMarkers(item.snippet)) push("victim", victim);
  for (const ransomware of uniqueMatches(item.snippet, /\b(?:Akira|LockBit|BlackCat|ALPHV|Cl0p|Clop)\b/gi)) push("ransomware", ransomware);
  for (const sector of uniqueMatches(item.snippet, /\b(?:energy|telecommunications|finance|healthcare|government|technology|retail|hospitality)\b/gi)) push("sector", sector.toLowerCase(), Math.min(item.confidence, 0.75));
  for (const country of uniqueMatches(item.snippet, /\b(?:NO|Norway|US|United States|UK|Ukraine|UA)\b/g)) push("country", country, Math.min(item.confidence, 0.75));
  for (const url of item.extractedUrls) push("url", url, Math.min(item.confidence, 0.7));
  return claims;
}

function telegramPublicGraphHintsForClaims(
  claims: Array<TelegramPublicPromotionCanaryProofDto["claimCandidates"][number] & { messageUrl: string }>
): Array<TelegramPublicPromotionCanaryProofDto["graphHints"][number] & { messageUrl: string }> {
  const byMessage = new Map<string, Array<TelegramPublicPromotionCanaryProofDto["claimCandidates"][number] & { messageUrl: string }>>();
  for (const claim of claims) byMessage.set(claim.messageUrl, [...(byMessage.get(claim.messageUrl) ?? []), claim]);
  const hints: Array<TelegramPublicPromotionCanaryProofDto["graphHints"][number] & { messageUrl: string }> = [];
  const push = (
    messageUrl: string,
    sourceId: string,
    ledgerId: string,
    relationship: TelegramPublicPromotionCanaryProofDto["graphHints"][number]["relationship"],
    endpoints: string[],
    reviewRequired: boolean
  ) => {
    hints.push({
      hintId: `tg_graph_hint_${hashContent(`${ledgerId}:${relationship}:${endpoints.join(":").toLowerCase()}`).slice(0, 18)}`,
      sourceId,
      ledgerId,
      relationship,
      endpointIds: endpoints,
      reviewRequired,
      messageUrl
    });
  };
  for (const [messageUrl, items] of byMessage) {
    const actors = items.filter((claim) => claim.kind === "actor");
    const cves = items.filter((claim) => claim.kind === "cve");
    const victims = items.filter((claim) => claim.kind === "victim");
    const ransomware = items.filter((claim) => claim.kind === "ransomware");
    const sectors = items.filter((claim) => claim.kind === "sector");
    const countries = items.filter((claim) => claim.kind === "country");
    const urls = items.filter((claim) => claim.kind === "url");
    for (const actor of actors) {
      for (const cve of cves) push(messageUrl, actor.sourceId, actor.ledgerId, "actor-cve", [actor.value, cve.value], actor.needsReview || cve.needsReview);
      for (const victim of victims) push(messageUrl, actor.sourceId, actor.ledgerId, "actor-victim", [actor.value, victim.value], actor.needsReview || victim.needsReview);
      for (const sector of sectors) push(messageUrl, actor.sourceId, actor.ledgerId, "actor-sector", [actor.value, sector.value], actor.needsReview || sector.needsReview);
      for (const country of countries) push(messageUrl, actor.sourceId, actor.ledgerId, "actor-country", [actor.value, country.value], actor.needsReview || country.needsReview);
      for (const url of urls) push(messageUrl, actor.sourceId, actor.ledgerId, "message-url", [actor.value, url.value], actor.needsReview || url.needsReview);
    }
    for (const group of ransomware) {
      for (const victim of victims) push(messageUrl, group.sourceId, group.ledgerId, "ransomware-victim", [group.value, victim.value], group.needsReview || victim.needsReview);
    }
  }
  return hints;
}

function ratingRank(rating: TelegramPublicReliabilityRating): number {
  if (rating === "healthy") return 5;
  if (rating === "watch") return 4;
  if (rating === "degraded") return 3;
  if (rating === "quarantine") return 2;
  return 1;
}

function telegramPublicAnswerQualityEffect(action: TelegramPublicApplyPlanAction): TelegramPublicOperatorControlEffectDto["expectedAnswerQualityEffect"] {
  if (action === "delay_poll") return "delays_freshness_keeps_claims_partial";
  if (action === "reduce_window") return "reduces_noise_improves_precision";
  if (action === "quarantine_channel") return "stops_untrusted_evidence_requires_review";
  if (action === "request_review" || action === "activate_source_pack") return "queues_human_review_for_readiness";
  if (action === "refresh_cursor") return "restores_delta_continuity";
  if (action === "suppress_repeated_urls") return "reduces_duplicate_claim_pressure";
  return "no_answer_change";
}

function telegramPublicRollbackTriggers(source: { rollbackTriggers?: unknown } | undefined): TelegramPublicApplyPlanAction[] {
  if (Array.isArray(source?.rollbackTriggers)) {
    return source.rollbackTriggers.filter((action): action is TelegramPublicApplyPlanAction => typeof action === "string");
  }
  if (!source) return [];
  const health = source as Record<string, unknown>;
  return uniqueApplyPlanActions([
    ...(health.rateLimitDebt === "delayed" ? ["delay_poll" as const] : []),
    ...(health.duplicateUrlPressure !== undefined && health.duplicateUrlPressure !== "low" ? ["suppress_repeated_urls" as const] : []),
    ...(health.editDeleteChurn !== undefined && health.editDeleteChurn !== "low" ? ["reduce_window" as const] : []),
    ...(health.unavailableWindows !== undefined && health.unavailableWindows !== "low" ? ["reduce_window" as const] : [])
  ]);
}

function telegramPublicStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (value && typeof value === "object") return Object.values(value).flatMap((item) => telegramPublicStringList(item));
  return typeof value === "string" ? [value] : [];
}

function telegramPublicCertificationCaveats(promotionCanary: TelegramPublicPromotionCanaryProofDto): string[] {
  const explicit = telegramPublicStringList(promotionCanary.handoffs.agent07PublicAnswer.caveatCodes);
  if (explicit.length > 0) return explicit;
  return uniqueStrings([
    ...(promotionCanary.sourceHealth.some((source) => source.rateLimitDebt === "delayed") ? ["public_channel_rate_limit_debt"] : []),
    ...(promotionCanary.sourceHealth.some((source) => source.duplicateUrlPressure !== "low") ? ["public_channel_duplicate_url_pressure"] : []),
    ...(promotionCanary.sourceHealth.some((source) => source.editDeleteChurn !== "low") ? ["public_channel_edit_delete_churn"] : []),
    ...(promotionCanary.sourceHealth.some((source) => source.unavailableWindows !== "low") ? ["public_channel_unavailable_windows"] : []),
    ...(promotionCanary.sourceHealth.some((source) => source.languageDrift === "watch") ? ["public_channel_language_drift"] : []),
    ...(promotionCanary.sourceHealth.some((source) => source.evidenceYield < 0.35) ? ["public_channel_low_evidence_yield"] : []),
    ...(promotionCanary.sourceHealth.some((source) => source.claimYield < 0.35) ? ["public_channel_low_claim_yield"] : [])
  ]);
}

function uniqueApplyPlanActions(values: TelegramPublicApplyPlanAction[]): TelegramPublicApplyPlanAction[] {
  const actions: TelegramPublicApplyPlanAction[] = [];
  for (const value of values) {
    if (!actions.includes(value)) actions.push(value);
  }
  return actions;
}

function telegramPublicFreshnessEffect(action: TelegramPublicApplyPlanAction): TelegramPublicOperatorControlEffectDto["expectedFreshnessEffect"] {
  if (action === "delay_poll") return "delayed";
  if (action === "reduce_window") return "reduced_window";
  if (action === "quarantine_channel") return "paused";
  if (action === "request_review" || action === "activate_source_pack") return "review_pending";
  if (action === "refresh_cursor") return "cursor_refreshed";
  return "unchanged";
}

const telegramPublicPromotionEffect = (action: TelegramPublicApplyPlanAction): TelegramPublicOperatorControlEffectDto["expectedPromotionEffect"] => {
  if (action === "delay_poll" || action === "request_review" || action === "activate_source_pack") return "hold_promotions";
  if (action === "reduce_window" || action === "quarantine_channel") return "reduce_promotions";
  if (action === "refresh_cursor") return "resume_promotions";
  if (action === "suppress_repeated_urls") return "suppress_duplicate_promotions";
  return "unchanged";
};

const runtimeCrawlState = (value: unknown): Partial<TelegramCrawlStateOutput> => {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return {
    nextAfterMessageId: numberMetadata(record.nextAfterMessageId),
    nextBeforeMessageId: numberMetadata(record.nextBeforeMessageId),
    rateLimitResetAt: stringMetadata(record.rateLimitResetAt),
    lastMessageDate: stringMetadata(record.lastMessageDate),
    lastMessageId: numberMetadata(record.lastMessageId)
  };
};

const telegramRuntimeStatus = (input: {
  failureCategory?: string;
  evidenceCount: number;
  promotedCount: number;
  duplicateSuppressedCount: number;
  deletedOrUnavailableCount: number;
  editedCount: number;
  policyDisabledCount: number;
}): TelegramPublicRuntimeStatus => {
  if (input.failureCategory === "rate_limited") return "rate_limited";
  if (input.failureCategory === "policy_blocked" || input.policyDisabledCount > 0) return "policy_disabled";
  if (input.failureCategory === "permanent_api" || input.failureCategory === "transient_api" || input.failureCategory === "timeout") return "unavailable";
  if (input.evidenceCount > 0 && input.duplicateSuppressedCount / input.evidenceCount >= 0.4) return "high_duplicate";
  if (input.evidenceCount > 0 && (input.deletedOrUnavailableCount + input.editedCount) / input.evidenceCount > 0.5) return "high_churn";
  if (input.promotedCount > 0) return "ready";
  if (input.evidenceCount > 0) return "partial";
  return "blocked";
};

const telegramRuntimeSchedulerHints = (
  status: TelegramPublicRuntimeStatus,
  retryAfterSeconds?: number
): TelegramPublicRuntimeCollectionDto["schedulerHints"] => {
  if (status === "ready" || status === "partial") return { acknowledge: "complete", reason: "public-channel runtime produced safe evidence state" };
  if (status === "rate_limited") return { acknowledge: "retry", retryAfterSeconds, reason: "official API rate-limit state must be honored before polling again" };
  if (status === "unavailable") return { acknowledge: "retry", retryAfterSeconds, reason: "public-channel API unavailable or transiently failed" };
  if (status === "policy_disabled") return { acknowledge: "block", reason: "public-channel source is disabled by policy or unsafe config" };
  if (status === "high_duplicate") return { acknowledge: "complete", reason: "runtime completed but repeated URL suppression should remain active" };
  if (status === "high_churn") return { acknowledge: "complete", reason: "runtime completed but edit/delete churn should reduce future windows" };
  return { acknowledge: "quarantine", reason: "public-channel runtime did not produce promotable evidence" };
};

function retryAfterSecondsFromReset(resetAt: string | undefined, generatedAt: string): number | undefined {
  if (!resetAt) return undefined;
  const delta = Date.parse(resetAt) - Date.parse(generatedAt);
  return Number.isFinite(delta) && delta > 0 ? Math.ceil(delta / 1000) : undefined;
}

function chooseTelegramPublicCutoverNextAction(input: {
  readyChannelCount: number;
  pendingReviewCount: number;
  rateLimitedCount: number;
  staleCursorCount: number;
  highDuplicateUrlCount: number;
  safePartialEvidenceCount: number;
  clearWebEvidenceCount: number;
  policyBlockedCount: number;
  sourcePackRecommendationCount: number;
}): TelegramPublicCutoverNextAction {
  if (input.policyBlockedCount > 0 && input.readyChannelCount === 0 && input.pendingReviewCount === 0) return "keep_policy_blocked";
  if (input.staleCursorCount > 0) return "refresh_stale_cursors";
  if (input.rateLimitedCount > 0 && input.readyChannelCount === 0) return "wait_for_rate_limit";
  if (input.highDuplicateUrlCount > 0) return "suppress_repeated_urls";
  if (input.pendingReviewCount > 0) return "review_public_channels";
  if (input.readyChannelCount === 0 && input.sourcePackRecommendationCount > 0) return "activate_source_pack";
  if (input.readyChannelCount > 0 && input.safePartialEvidenceCount > 0) return "ready_for_cutover";
  if (input.readyChannelCount > 0 && input.clearWebEvidenceCount === 0) return "collect_more_clear_web";
  return input.sourcePackRecommendationCount > 0 ? "activate_source_pack" : "review_public_channels";
}

export function buildTelegramPublicActivationProgram(input: {
  query: string;
  entityType?: string;
  sources: SourceRecord[];
  sourcePacks?: TelegramPublicSourcePack[];
  createdAt?: string;
  queuedSourceIds?: string[];
}): TelegramPublicActivationProgramDto {
  const generatedAt = input.createdAt ?? nowIso();
  const queryTerms = expandTelegramQueryTerms(input.query, input.entityType);
  const queued = new Set(input.queuedSourceIds ?? []);
  const recommendedPublicPacks = recommendTelegramPublicSourcePacks({
    query: input.query,
    entityType: input.entityType,
    packs: input.sourcePacks ?? [],
    maxRecommendations: 8
  });
  const coverageGaps = explainTelegramPublicCoverageGaps({
    query: input.query,
    entityType: input.entityType,
    sources: input.sources,
    createdAt: generatedAt,
    queuedSourceIds: input.queuedSourceIds
  });
  const matching = input.sources
    .filter((source) => source.type === "telegram_public")
    .map((source) => ({ original: source, source: bridgeTelegramPublicActivationSource(source)?.source ?? source }))
    .map(({ original, source }) => ({ original, source, model: telegramPublicChannelSourceModel(source) }))
    .filter(({ model }) => scoreTelegramSourceForQuery(model, queryTerms) > 0);
  const active: TelegramPublicActivationChannelSummary[] = [];
  const pending: TelegramPublicActivationChannelSummary[] = [];
  const rateLimited: TelegramPublicActivationChannelSummary[] = [];
  const disabled: TelegramPublicActivationChannelSummary[] = [];

  for (const { original, source, model } of matching) {
    const summary = activationChannelSummary(source, model, "none");
    const compliance = validateTelegramPublicSourceCompliance(source);
    if (!compliance.allowed || original.accessMethod === "disabled" || source.status === "disabled" || source.status === "rejected" || source.catalog?.approvalScope === "disabled") {
      disabled.push({ ...summary, requiredAction: "fix_policy" });
      continue;
    }
    if (model.legalStatus !== "approved_public") {
      pending.push({ ...summary, requiredAction: "approve" });
      continue;
    }
    if (queued.has(source.id)) {
      active.push({ ...summary, requiredAction: "wait" });
      continue;
    }
    if (model.rateLimitState.resetAt && Date.parse(model.rateLimitState.resetAt) > Date.parse(generatedAt)) {
      rateLimited.push({ ...summary, requiredAction: "wait", rateLimitResetAt: model.rateLimitState.resetAt });
      continue;
    }
    if (source.status === "active" || source.status === "probation" || source.status === "degraded") {
      active.push(summary);
    } else {
      pending.push({ ...summary, requiredAction: "activate" });
    }
  }

  return {
    generatedAt,
    query: input.query,
    queryTerms,
    recommendedPublicPacks,
    matchingActiveChannels: active,
    pendingReviewChannels: pending,
    rateLimitedChannels: rateLimited,
    disabledByPolicyChannels: disabled,
    noApprovedChannelGaps: coverageGaps.filter((gap) => gap.reason === "no_approved_channels")
  };
}

export function validateTelegramPublicSourcePack(
  pack: TelegramPublicSourcePack,
  importedAt = nowIso()
): TelegramPublicSourcePackValidation {
  const errors: TelegramPublicSourcePackValidation["errors"] = [];
  const warnings: TelegramPublicSourcePackValidation["warnings"] = [];
  const accepted: SourceRecord[] = [];

  if (pack.version !== 1) errors.push({ message: "Unsupported public Telegram source-pack version" });
  if (pack.disabledByDefault !== true) errors.push({ message: "Public Telegram source packs must be disabled by default" });
  if (!pack.sources.length) errors.push({ message: "Public Telegram source pack must contain at least one source" });

  for (const entry of pack.sources) {
    const source = telegramPublicSourcePackEntryToSource(pack, entry, importedAt);
    const compliance = validateTelegramPublicSourceCompliance(source, entry.publicUrl);
    const blockedPrivateKeys = privateTelegramMetadataKeys(entry.metadata ?? {});
    if (!entry.legalNotes.trim()) errors.push({ sourceId: entry.id, message: "Public channel source-pack entry requires legal notes" });
    if (!entry.compliance.legalBasis.trim() || !entry.compliance.license.trim()) {
      errors.push({ sourceId: entry.id, message: "Public channel source-pack entry requires legal basis and license/compliance notes" });
    }
    if (blockedPrivateKeys.length) {
      errors.push({ sourceId: entry.id, message: `Public channel source-pack entry includes prohibited private/account/media fields: ${blockedPrivateKeys.join(", ")}` });
    }
    if (entry.retentionClass !== "public_chat_text") errors.push({ sourceId: entry.id, message: "Public channel source-pack retention must be public_chat_text" });
    if (entry.rateLimit.minIntervalSeconds < 30 || entry.rateLimit.pageSize < 1 || entry.rateLimit.pageSize > 100) {
      errors.push({ sourceId: entry.id, message: "Public channel source-pack rate limits must be bounded" });
    }
    if (!parseTelegramTarget(entry.publicUrl).channel) errors.push({ sourceId: entry.id, message: "Public channel source-pack entry must use a public Telegram channel URL" });
    if (!compliance.allowed) errors.push({ sourceId: entry.id, message: compliance.reason });
    if (entry.approvalState === "approved") warnings.push({ sourceId: entry.id, message: "Source pack entries should still dry-run through operator review before activation" });
    if (!errors.some((error) => error.sourceId === entry.id)) accepted.push(source);
  }

  return {
    valid: errors.length === 0,
    packId: pack.id,
    accepted,
    errors,
    warnings
  };
}

export function telegramPublicSourcePackEntryToSource(
  pack: Pick<TelegramPublicSourcePack, "id" | "name">,
  entry: TelegramPublicSourcePackEntry,
  importedAt = nowIso()
): SourceRecord {
  return {
    id: entry.id,
    name: entry.name,
    type: "telegram_public",
    url: entry.publicUrl,
    accessMethod: "official_api",
    status: entry.approvalState === "disabled" ? "disabled" : "candidate",
    risk: "medium",
    trustScore: Math.max(0, Math.min(1, entry.trustScore ?? 0.55)),
    language: entry.language,
    crawlFrequencySeconds: Math.max(60, entry.rateLimit.minIntervalSeconds),
    legalNotes: entry.legalNotes,
    approvalRequired: true,
    governance: {
      approvalRequired: true,
      approvalState: entry.approvalState === "disabled" ? "rejected" : "pending",
      metadataOnly: false,
      policyVersion: "collection-policy:v1",
      riskJustification: entry.compliance.legalBasis
    },
    createdAt: importedAt,
    updatedAt: importedAt,
    tags: [...new Set(["public-channel-pack", pack.id, ...entry.topicTags])],
    metadata: {
      ...entry.metadata,
      channelHandle: entry.channelHandle,
      sourcePackId: pack.id,
      sourcePackName: pack.name,
      topicTags: entry.topicTags,
      actors: entry.focus.actors,
      ransomware: entry.focus.ransomware,
      cves: entry.focus.cves.map((value) => value.toUpperCase()),
      victims: entry.focus.victims,
      sectors: entry.focus.sectors,
      countries: entry.focus.countries,
      minIntervalSeconds: entry.rateLimit.minIntervalSeconds,
      pageSize: entry.rateLimit.pageSize,
      expectedRequestsPerHour: entry.rateLimit.expectedRequestsPerHour,
      retentionClass: entry.retentionClass,
      approvalScope: entry.compliance.approvalScope,
      takedownContact: entry.compliance.takedownContact,
      termsReviewedAt: entry.compliance.termsReviewedAt
    },
    catalog: {
      canonicalId: `telegram:${pack.id}:${entry.channelHandle}`,
      publisher: {
        name: entry.name,
        trustBasis: "community"
      },
      tier: "watchlist",
      approvalScope: entry.compliance.approvalScope,
      license: entry.compliance.license,
      legalBasis: entry.compliance.legalBasis,
      reliability: Math.max(0, Math.min(1, entry.trustScore ?? 0.55)),
      intelligenceValue: 0.65,
      retentionClass: "public_chat_text",
      coverage: {
        topics: entry.topicTags,
        actors: entry.focus.actors,
        aliases: [],
        industries: entry.focus.sectors,
        regions: [],
        countries: entry.focus.countries,
        languages: entry.language ? [entry.language] : [],
        queryPatterns: [
          ...entry.focus.actors,
          ...entry.focus.ransomware,
          ...entry.focus.cves,
          ...entry.focus.victims,
          ...entry.focus.sectors,
          ...entry.focus.countries
        ]
      },
      collection: {
        freshnessTargetSeconds: Math.max(300, entry.rateLimit.minIntervalSeconds * 4),
        collectionSlaSeconds: Math.max(600, entry.rateLimit.minIntervalSeconds * 8),
        budgetClass: "normal",
        crawlCadenceSeconds: Math.max(60, entry.rateLimit.minIntervalSeconds)
      },
      adapterCompatibility: ["telegram_public"]
    }
  };
}

export function recommendTelegramPublicSourcePacks(input: {
  query: string;
  entityType?: string;
  packs: TelegramPublicSourcePack[];
  maxRecommendations?: number;
}): TelegramPublicSourcePackRecommendation[] {
  const queryTerms = expandTelegramQueryTerms(input.query, input.entityType);
  const recommendations: TelegramPublicSourcePackRecommendation[] = [];
  for (const pack of input.packs) {
    const validation = validateTelegramPublicSourcePack(pack);
    if (!validation.valid) continue;
    for (const source of validation.accepted) {
      const model = telegramPublicChannelSourceModel(source);
      const score = scoreTelegramSourceForQuery(model, queryTerms);
      if (score <= 0) continue;
      const coverageTags = coverageTagsForModel(model);
      const matched = queryTerms.filter((term) => coverageTags.some((tag) => tag.toLowerCase().includes(term.toLowerCase()) || term.toLowerCase().includes(tag.toLowerCase())));
      recommendations.push({
        sourcePackId: pack.id,
        sourcePackName: pack.name,
        sourceId: source.id,
        channelHandle: model.channelHandle,
        publicUrl: model.publicUrl,
        score,
        requiredAction: source.status === "disabled" ? "activate" : "review",
        coverageTags,
        reasons: matched.length ? matched.map((term) => `coverage match:${term}`) : ["broad public-channel CTI coverage"]
      });
    }
  }

  return recommendations
    .sort((left, right) => right.score - left.score || left.channelHandle.localeCompare(right.channelHandle))
    .slice(0, input.maxRecommendations ?? 5);
}

export function bridgeTelegramPublicActivationSource(source: SourceRecord): TelegramPublicActivationBridgeDto | undefined {
  const target = parseTelegramTarget(source.url);
  if (source.type !== "telegram_public" || !target.channel) return undefined;

  const metadata = sourceMetadata(source);
  const strippedPrivateFields = privateTelegramMetadataKeys(metadata);
  const catalogCoverage = source.catalog?.coverage;
  const safeMetadata = Object.fromEntries(Object.entries(metadata).filter(([key]) => !strippedPrivateFields.includes(key)));
  const bridged: SourceRecord = {
    ...source,
    accessMethod: "official_api",
    metadata: {
      ...safeMetadata,
      topicTags: [...new Set([
        ...readStringArray(safeMetadata, "topicTags"),
        ...(source.tags ?? []),
        ...(catalogCoverage?.topics ?? [])
      ])],
      actors: [...new Set([...readStringArray(safeMetadata, "actors"), ...(catalogCoverage?.actors ?? []), ...(catalogCoverage?.aliases ?? [])])],
      ransomware: [...new Set(readStringArray(safeMetadata, "ransomware"))],
      cves: [...new Set(readStringArray(safeMetadata, "cves").map((value) => value.toUpperCase()))],
      victims: [...new Set(readStringArray(safeMetadata, "victims"))],
      sectors: [...new Set([...readStringArray(safeMetadata, "sectors"), ...(catalogCoverage?.industries ?? [])])],
      countries: [...new Set([...readStringArray(safeMetadata, "countries"), ...(catalogCoverage?.countries ?? [])])]
    }
  };
  const model = telegramPublicChannelSourceModel(bridged);

  return {
    source: bridged,
    channelHandle: model.channelHandle,
    publicUrl: model.publicUrl,
    coverageTags: coverageTagsForModel(model),
    strippedPrivateFields,
    planningMetadata: {
      focus: model.focus,
      topicTags: model.topicTags,
      cursorState: model.cursorState,
      rateLimitState: model.rateLimitState,
      retentionClass: model.retentionClass
    }
  };
}

export function bridgeTelegramPublicActivationSources(sources: SourceRecord[]): TelegramPublicActivationBridgeDto[] {
  return sources.map(bridgeTelegramPublicActivationSource).filter((item): item is TelegramPublicActivationBridgeDto => Boolean(item));
}

export function explainTelegramPublicCoverageGaps(input: {
  query: string;
  entityType?: string;
  sources: SourceRecord[];
  createdAt?: string;
  queuedSourceIds?: string[];
}): TelegramPublicCoverageGapExplanation[] {
  const createdAt = input.createdAt ?? nowIso();
  const queryTerms = expandTelegramQueryTerms(input.query, input.entityType);
  const queuedSourceIds = new Set(input.queuedSourceIds ?? []);
  const matching = input.sources
    .filter((source) => source.type === "telegram_public")
    .map((source) => ({ original: source, source: bridgeTelegramPublicActivationSource(source)?.source ?? source }))
    .map(({ original, source }) => ({ original, source, model: telegramPublicChannelSourceModel(source) }))
    .filter(({ model }) => scoreTelegramSourceForQuery(model, queryTerms) > 0);

  if (matching.length === 0) {
    return [{
      reason: "no_approved_channels",
      requiredAction: "none",
      message: "No public Telegram channel source currently matches this query coverage.",
      coverageTags: queryTerms
    }];
  }

  const gaps: TelegramPublicCoverageGapExplanation[] = [];
  for (const { original, source, model } of matching) {
    const coverageTags = coverageTagsForModel(model);
    const compliance = validateTelegramPublicSourceCompliance(source);
    if (!compliance.allowed || original.accessMethod === "disabled" || source.status === "disabled" || source.status === "rejected" || source.catalog?.approvalScope === "disabled") {
      gaps.push({
        reason: "matching_channels_disabled_by_policy",
        sourceId: source.id,
        channelHandle: model.channelHandle,
        publicUrl: model.publicUrl,
        requiredAction: "fix_policy",
        message: compliance.allowed ? "Matching public channel is disabled by source policy." : compliance.reason,
        coverageTags
      });
      continue;
    }

    if (model.legalStatus !== "approved_public") {
      gaps.push({
        reason: "matching_channels_pending_review",
        sourceId: source.id,
        channelHandle: model.channelHandle,
        publicUrl: model.publicUrl,
        requiredAction: "approve",
        message: "Matching public channel requires review approval before collection.",
        coverageTags
      });
      continue;
    }

    if (queuedSourceIds.has(source.id)) {
      gaps.push({
        reason: "matching_channels_actively_queued",
        sourceId: source.id,
        channelHandle: model.channelHandle,
        publicUrl: model.publicUrl,
        requiredAction: "wait",
        message: "Matching public channel already has active queued collection work.",
        coverageTags
      });
      continue;
    }

    if (model.rateLimitState.resetAt && Date.parse(model.rateLimitState.resetAt) > Date.parse(createdAt)) {
      gaps.push({
        reason: "matching_channels_rate_limited",
        sourceId: source.id,
        channelHandle: model.channelHandle,
        publicUrl: model.publicUrl,
        requiredAction: "wait",
        message: "Matching public channel is delayed by official API rate-limit state.",
        coverageTags,
        availableAt: model.rateLimitState.resetAt
      });
    }
  }

  return gaps;
}

export function buildTelegramPublicSourceHealthUpdate(input: {
  source: SourceRecord;
  items: CollectedItem[];
  fetchOutcome?: TelegramPublicSourceHealthUpdate["fetchOutcome"];
  rateLimitResetAt?: string;
  policyBlockedCount?: number;
  promotedMessageIds?: number[];
  updatedAt?: string;
}): TelegramPublicSourceHealthUpdate {
  const channel = parseTelegramTarget(input.source.url).channel ?? readMetadataString(input.source, "channelHandle") ?? input.source.name;
  const messageItems = input.items.filter((item) => item.metadata.adapter === "telegram_public");
  const last = [...messageItems].sort((left, right) => (numberMetadata(left.metadata.messageId) ?? 0) - (numberMetadata(right.metadata.messageId) ?? 0)).at(-1);
  const urlMentions = messageItems.flatMap((item) => Array.isArray(item.metadata.urlMentions) ? item.metadata.urlMentions.filter((value): value is string => typeof value === "string") : item.links);
  const duplicateUrlRate = rateFromCounts(urlMentions.length - new Set(urlMentions).size, urlMentions.length);
  const unavailable = messageItems.filter((item) => item.metadata.messageState === "deleted" || item.metadata.messageState === "unavailable").length;
  const policyBlockedCount = input.policyBlockedCount ?? 0;
  const totalPolicyChecks = messageItems.length + policyBlockedCount;

  return {
    sourceId: input.source.id,
    channel,
    lastSeenMessageId: numberMetadata(last?.metadata.messageId),
    lastSeenMessageDate: last?.publishedAt,
    fetchOutcome: input.fetchOutcome ?? (input.rateLimitResetAt ? "rate_limited" : policyBlockedCount > 0 && messageItems.length === 0 ? "policy_blocked" : messageItems.length > 0 ? "success" : "partial"),
    rateLimitResetAt: input.rateLimitResetAt,
    duplicateUrlRate,
    deletedUnavailableRate: rateFromCounts(unavailable, messageItems.length),
    policyBlockRate: rateFromCounts(policyBlockedCount, totalPolicyChecks),
    provenance: {
      adapter: "telegram_public",
      updatedAt: input.updatedAt ?? nowIso(),
      messageCount: messageItems.length,
      promotedMessageIds: input.promotedMessageIds ?? messageItems
        .filter((item) => item.metadata.messageState !== "deleted" && item.metadata.messageState !== "unavailable")
        .filter((item) => (item.metadata.promotion as Record<string, unknown> | undefined)?.stage === "promoted")
        .map((item) => numberMetadata(item.metadata.messageId))
        .filter((item): item is number => item !== undefined)
    }
  };
}

export function publicChannelEvidenceFromCollectedItem(item: CollectedItem): TelegramPublicEvidenceDto | undefined {
  if (item.metadata.adapter !== "telegram_public") return undefined;
  const handoff = publicExtractionHandoff(item.metadata.extractionHandoff);
  return {
    sourceId: item.sourceId,
    channel: stringMetadata(item.metadata.channel) ?? "unknown",
    messageUrl: item.url,
    messageTimestamp: item.publishedAt,
    snippet: normalizeWhitespace(item.rawText).slice(0, 280),
    extractedUrls: Array.isArray(item.metadata.urlMentions) ? item.metadata.urlMentions.filter((value): value is string => typeof value === "string") : item.links,
    forward: publicForwardMetadata(item.metadata.forward),
    replyToMessageId: numberMetadata(item.metadata.replyToMessageId),
    media: publicMediaMetadata(item.metadata.media),
    languageHint: item.language,
    extractionHandoff: handoff,
    confidence: numberMetadata((item.metadata.provenance as Record<string, unknown> | undefined)?.confidence) ?? 0.75,
    messageId: numberMetadata(item.metadata.messageId),
    messageState: messageStateMetadata(item.metadata.messageState),
    editedAt: stringMetadata(item.metadata.editDate),
    contentHash: item.contentHash
  };
}

export function publicChannelEvidenceFromCapture(capture: RawCapture): TelegramPublicEvidenceDto | undefined {
  if (capture.metadata.adapter !== "telegram_public") return undefined;
  const handoff = publicExtractionHandoff(capture.metadata.extractionHandoff);
  return {
    sourceId: capture.sourceId,
    channel: stringMetadata(capture.metadata.channel) ?? "unknown",
    messageUrl: capture.url,
    messageTimestamp: capture.publishedAt,
    snippet: normalizeWhitespace(capture.body ?? String((capture.metadata.extractionHandoff as Record<string, unknown> | undefined)?.messageText ?? "")).slice(0, 280),
    extractedUrls: Array.isArray(capture.metadata.urlMentions) ? capture.metadata.urlMentions.filter((value): value is string => typeof value === "string") : [],
    forward: publicForwardMetadata(capture.metadata.forward),
    replyToMessageId: numberMetadata(capture.metadata.replyToMessageId),
    media: publicMediaMetadata(capture.metadata.media),
    languageHint: capture.language,
    extractionHandoff: handoff,
    confidence: numberMetadata((capture.metadata.provenance as Record<string, unknown> | undefined)?.confidence) ?? 0.75,
    messageId: numberMetadata(capture.metadata.messageId),
    messageState: messageStateMetadata(capture.metadata.messageState),
    editedAt: stringMetadata(capture.metadata.editDate),
    contentHash: capture.contentHash
  };
}

export function buildTelegramPublicEvidencePromotionProgram(input: TelegramPublicPromotionProgramInput): TelegramPublicPromotionProgramDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const previousUrls = new Set(normalizeTelegramLinks(input.previousUrls ?? []));
  const seenHashes = new Set<string>();
  const candidates: TelegramPublicEvidenceDto[] = [];
  const promoted: TelegramPublicPromotionProgramDto["promoted"] = [];
  const duplicateSuppressed: TelegramPublicPromotionProgramDto["duplicateSuppressed"] = [];
  const editedMessages: TelegramPublicEvidenceDto[] = [];
  const deletedOrUnavailable: TelegramPublicEvidenceDto[] = [];
  const blocked: TelegramPublicPromotionProgramDto["blocked"] = [];

  for (const item of input.evidence) {
    if (item.messageState === "deleted" || item.messageState === "unavailable") {
      deletedOrUnavailable.push(item);
      continue;
    }
    if (item.editedAt) editedMessages.push(item);
    if (previousUrls.has(item.messageUrl)) {
      duplicateSuppressed.push({ sourceId: item.sourceId, messageUrl: item.messageUrl, reason: "duplicate_url" });
      continue;
    }
    if (item.contentHash && seenHashes.has(item.contentHash)) {
      duplicateSuppressed.push({ sourceId: item.sourceId, messageUrl: item.messageUrl, reason: "duplicate_hash" });
      continue;
    }
    if (item.contentHash) seenHashes.add(item.contentHash);

    const source = sourceById.get(item.sourceId);
    if (!source) {
      blocked.push({ sourceId: item.sourceId, messageUrl: item.messageUrl, reason: "source not found for public-channel promotion" });
      continue;
    }
    const promotion = promotePublicChannelEvidence({
      source,
      evidence: item,
      query: input.query,
      promotedAt: generatedAt,
      promotedBy: "pipeline"
    });
    if (!promotion.allowed) {
      blocked.push({ sourceId: item.sourceId, messageUrl: item.messageUrl, reason: promotion.reason });
      continue;
    }
    candidates.push(item);
    promoted.push({
      sourceId: item.sourceId,
      messageUrl: item.messageUrl,
      contentHash: promotion.item.contentHash,
      promotedExtractionId: item.promotedExtractionId,
      extractionHandoff: item.extractionHandoff
    });
  }

  const rateLimitBackoff = input.sources
    .filter((source) => source.type === "telegram_public")
    .flatMap((source) => {
      const model = telegramPublicChannelSourceModel(source);
      return model.rateLimitState.resetAt && Date.parse(model.rateLimitState.resetAt) > Date.parse(generatedAt)
        ? [{ sourceId: source.id, channelHandle: model.channelHandle, resetAt: model.rateLimitState.resetAt }]
        : [];
    });
  const policyDisabled = input.sources
    .filter((source) => source.type === "telegram_public")
    .flatMap((source) => {
      const compliance = validateTelegramPublicSourceCompliance(source);
      if (!compliance.allowed) return [{ sourceId: source.id, reason: compliance.reason }];
      if (source.accessMethod === "disabled" || source.status === "disabled" || source.status === "rejected" || source.catalog?.approvalScope === "disabled") {
        return [{ sourceId: source.id, reason: "public-channel source is disabled by policy" }];
      }
      return [];
    });

  return {
    generatedAt,
    query: input.query,
    status: promoted.length > 0 ? "ready" : blocked.length || policyDisabled.length ? "blocked" : "partial",
    candidates,
    promoted,
    duplicateSuppressed,
    editedMessages,
    deletedOrUnavailable,
    blocked,
    rateLimitBackoff,
    policyDisabled,
    safeOutput: {
      rawPrivateDataExposed: false,
      rawMediaPayloadsExposed: false,
      credentialsExposed: false,
      mediaRetention: "metadata_only",
      piiMinimized: true
    }
  };
}

export function buildTelegramPublicRuntimeCollection(input: TelegramPublicRuntimeCollectionInput): TelegramPublicRuntimeCollectionDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const model = telegramPublicChannelSourceModel(input.source);
  const evidence = input.result.items
    .map(publicChannelEvidenceFromCollectedItem)
    .filter((item): item is TelegramPublicEvidenceDto => Boolean(item));
  const promotion = buildTelegramPublicEvidencePromotionProgram({
    query: input.query ?? input.task?.reason ?? input.source.name,
    sources: [input.source],
    evidence,
    previousUrls: input.previousUrls ?? readMetadataStringArray(input.source, "lastDiscoveredUrls") ?? [],
    generatedAt
  });
  const promoted = evidence
    .map((item) => promotePublicChannelEvidence({
      source: input.source,
      task: input.task,
      evidence: item,
      query: input.query,
      promotedAt: generatedAt,
      promotedBy: "collector"
    }))
    .filter((item): item is Extract<TelegramPublicPromotionResult, { allowed: true }> => item.allowed);
  const crawlState = runtimeCrawlState(input.result.metadata?.crawlState);
  const deletedOrUnavailable = evidence.filter((item) => item.messageState === "deleted" || item.messageState === "unavailable");
  const edited = evidence.filter((item) => item.editedAt);
  const mediaMetadataCount = evidence.reduce((total, item) => total + (item.media?.items.length ?? 0), 0);
  const duplicateSuppressedCount = promotion.duplicateSuppressed.length;
  const status = telegramRuntimeStatus({
    failureCategory: stringMetadata(input.result.metadata?.failureCategory),
    evidenceCount: evidence.length,
    promotedCount: promotion.promoted.length,
    duplicateSuppressedCount,
    deletedOrUnavailableCount: deletedOrUnavailable.length,
    editedCount: edited.length,
    policyDisabledCount: promotion.policyDisabled.length
  });
  const poll = buildTelegramPublicIncrementalPollDto({
    cursor: model.cursorState.afterMessageId,
    evidence,
    promotedExtractionIds: promotion.promoted.map((item) => item.promotedExtractionId).filter((item): item is string => Boolean(item)),
    rateLimitResetAt: crawlState.rateLimitResetAt ?? model.rateLimitState.resetAt,
    generatedAt
  });
  const discoveredUrls = uniqueStrings([
    ...(readMetadataStringArray(input.source, "lastDiscoveredUrls") ?? []),
    ...evidence.flatMap((item) => [item.messageUrl, ...item.extractedUrls])
  ]).slice(-100);
  const nextCursor = crawlState.nextAfterMessageId ?? poll.nextCursor;
  const retryAfterSeconds = retryAfterSecondsFromReset(crawlState.rateLimitResetAt ?? model.rateLimitState.resetAt, generatedAt);
  const abuseControl = applyTelegramPublicAbuseControls({
    source: input.source,
    requestedWindow: readPositiveInteger(input.source, "pageSize", 50, 1, 100),
    now: generatedAt,
    query: input.query,
    urls: evidence.flatMap((item) => [item.messageUrl, ...item.extractedUrls]),
    previousUrls: input.previousUrls ?? readMetadataStringArray(input.source, "lastDiscoveredUrls") ?? []
  });
  const healthPatch = buildTelegramPublicSourceHealthUpdate({
    source: input.source,
    items: input.result.items,
    fetchOutcome: status === "rate_limited"
      ? "rate_limited"
      : status === "policy_disabled"
        ? "policy_blocked"
        : status === "unavailable" || status === "blocked"
          ? "failed"
          : promotion.promoted.length > 0
            ? "success"
            : "partial",
    rateLimitResetAt: crawlState.rateLimitResetAt ?? model.rateLimitState.resetAt,
    promotedMessageIds: promotion.promoted
      .map((item) => evidence.find((candidate) => candidate.messageUrl === item.messageUrl)?.messageId)
      .filter((item): item is number => item !== undefined),
    updatedAt: generatedAt
  });
  const reliability = buildTelegramPublicReliabilityReport({
    query: input.query,
    sources: [input.source],
    evidence,
    healthUpdates: [healthPatch],
    generatedAt
  });
  const operatorStates = buildTelegramPublicOperatorStates({
    sources: [input.source],
    generatedAt,
    reliability
  });
  const actorReadiness = buildTelegramPublicActorReadinessDto(reliability);
  const connectorBase: Omit<TelegramPublicRuntimeConnectorContractDto, "answerReadiness"> = {
    generatedAt,
    sourceId: input.source.id,
    channelHandle: model.channelHandle,
    operatorState: operatorStates[0] ?? operatorState(input.source, model, "policy_blocked", "public-channel source has no operator state", true, false),
    cursorLease: {
      leaseKey: `${input.source.id}:${input.task?.id ?? "manual"}:${model.cursorState.afterMessageId ?? "start"}`,
      requested: model.cursorState,
      next: {
        afterMessageId: nextCursor,
        beforeMessageId: crawlState.nextBeforeMessageId
      },
      lastMessageId: crawlState.lastMessageId ?? nextCursor,
      lastMessageDate: crawlState.lastMessageDate
    },
    rateLimitState: {
      minIntervalSeconds: model.rateLimitState.minIntervalSeconds,
      resetAt: crawlState.rateLimitResetAt ?? model.rateLimitState.resetAt,
      retryAfterSeconds
    },
    windowSizing: {
      requested: abuseControl.requestedWindow,
      effective: abuseControl.effectiveWindow,
      perChannelLimit: abuseControl.perChannelWindowLimit,
      suppressedUrlCount: abuseControl.suppressedUrls.length,
      notes: abuseControl.notes
    },
    sourceHealthPatch: healthPatch,
    publicMessageProvenance: evidence.map((item) => ({
      sourceId: item.sourceId,
      channel: item.channel,
      messageId: item.messageId,
      messageUrl: item.messageUrl,
      messageTimestamp: item.messageTimestamp,
      contentHash: item.contentHash,
      confidence: item.confidence,
      state: item.messageState ?? "available"
    })),
    deltas: {
      newMessageIds: poll.newMessages.map((item) => item.messageId).filter((item): item is number => item !== undefined),
      editedMessageIds: poll.updatedMessages.map((item) => item.messageId).filter((item): item is number => item !== undefined),
      deletedOrUnavailableMessageIds: poll.deletedOrUnavailable.map((item) => item.messageId).filter((item): item is number => item !== undefined)
    },
    promotionHandoff: {
      promotedCount: promotion.promoted.length,
      extractionInputCount: promoted.length,
      targetAgent: "agent_06",
      promotedMessageUrls: promotion.promoted.map((item) => item.messageUrl),
      partialEvidenceOnly: actorReadiness.status !== "ready"
    },
    actorReadiness,
    safeOutput: {
      rawPrivateDataExposed: false,
      rawMediaPayloadsExposed: false,
      credentialsExposed: false,
      mediaRetention: "metadata_only",
      piiMinimized: true
    }
  };
  const connector: TelegramPublicRuntimeConnectorContractDto = {
    ...connectorBase,
    answerReadiness: buildTelegramPublicAnswerReadinessDto({ connector: connectorBase, generatedAt })
  };

  return {
    generatedAt,
    sourceId: input.source.id,
    channelHandle: model.channelHandle,
    status,
    connector,
    cursorWindow: {
      requested: model.cursorState,
      next: {
        afterMessageId: nextCursor,
        beforeMessageId: crawlState.nextBeforeMessageId
      },
      lastMessageId: crawlState.lastMessageId ?? nextCursor,
      lastMessageDate: crawlState.lastMessageDate
    },
    collection: {
      itemCount: evidence.length,
      newCount: poll.newMessages.length,
      editedCount: edited.length,
      deletedOrUnavailableCount: deletedOrUnavailable.length,
      duplicateSuppressedCount,
      urlMentionCount: poll.urlMentionedMessages.length,
      forwardCount: poll.forwardedMessages.length,
      replyCount: evidence.filter((item) => item.replyToMessageId !== undefined).length,
      mediaMetadataCount,
      warnings: input.result.warnings
    },
    evidence,
    poll,
    promotion,
    promotedItems: promoted.map((item) => item.item),
    extractionInputs: promoted.map((item) => item.extractionInput),
    sourcePatch: {
      id: input.source.id,
      updatedAt: generatedAt,
      crawlState: {
        ...(input.source.crawlState ?? { retryCount: 0 }),
        cursor: nextCursor !== undefined ? String(nextCursor) : input.source.crawlState?.cursor,
        lastScheduledAt: input.task?.queuedAt ?? input.source.crawlState?.lastScheduledAt,
        lastCollectedAt: evidence.length > 0 ? generatedAt : input.source.crawlState?.lastCollectedAt,
        backoffUntil: crawlState.rateLimitResetAt ?? input.source.crawlState?.backoffUntil,
        retryCount: status === "rate_limited" || status === "unavailable" ? (input.source.crawlState?.retryCount ?? 0) + 1 : 0
      },
      metadata: {
        ...(input.source.metadata ?? {}),
        afterMessageId: nextCursor,
        beforeMessageId: crawlState.nextBeforeMessageId,
        rateLimitResetAt: crawlState.rateLimitResetAt,
        lastDiscoveredUrls: discoveredUrls,
        lastTelegramRuntimeStatus: status,
        lastTelegramRuntimeAt: generatedAt,
        lastTelegramRuntimeCounts: {
          evidence: evidence.length,
          promoted: promotion.promoted.length,
          duplicates: duplicateSuppressedCount,
          edited: edited.length,
          deletedOrUnavailable: deletedOrUnavailable.length
        }
      }
    },
    schedulerHints: telegramRuntimeSchedulerHints(status, retryAfterSeconds),
    safeOutput: {
      privateDataExposed: promotion.safeOutput.rawPrivateDataExposed,
      mediaPayloadsExposed: promotion.safeOutput.rawMediaPayloadsExposed,
      credentialsExposed: promotion.safeOutput.credentialsExposed,
      mediaRetention: promotion.safeOutput.mediaRetention,
      piiMinimized: promotion.safeOutput.piiMinimized
    }
  };
}

export function promotePublicChannelEvidence(input: TelegramPublicPromotionInput): TelegramPublicPromotionResult {
  if (input.mediaPayload !== undefined) {
    return { allowed: false, reason: "telegram public-channel promotion cannot include raw media payloads" };
  }

  const compliance = validateTelegramPublicSourceCompliance(input.source, input.evidence.messageUrl);
  if (!compliance.allowed) return { allowed: false, reason: compliance.reason };

  if (input.source.type !== "telegram_public" || input.source.accessMethod !== "official_api") {
    return { allowed: false, reason: "public-channel promotion requires a telegram_public source using official_api access" };
  }

  const expectedChannel = normalizeChannel(input.evidence.channel);
  const stability = validateStablePublicMessageUrl(input.evidence.messageUrl, expectedChannel, input.evidence.messageId);
  if (!stability.allowed) return { allowed: false, reason: stability.reason };

  if (input.evidence.messageState === "deleted" || input.evidence.messageState === "unavailable") {
    return { allowed: false, reason: `cannot promote ${input.evidence.messageState} public-channel messages to capture input` };
  }

  const promotedAt = input.promotedAt ?? nowIso();
  const rawText = minimizeTelegramPii(input.evidence.snippet);
  const extractedUrls = normalizeTelegramLinks(input.evidence.extractedUrls);
  const contentHash = input.evidence.contentHash ?? hashContent(`${input.evidence.sourceId}:${input.evidence.messageUrl}:${input.evidence.messageTimestamp ?? ""}:${rawText}`);
  const metadata = {
    adapter: "telegram_public",
    promotedFrom: "public_channel_partial_evidence",
    promotion: {
      stage: "promoted",
      promotedAt,
      promotedBy: input.promotedBy ?? "planner",
      query: input.query,
      urlStable: true
    },
    accessMethod: input.source.accessMethod,
    channel: expectedChannel,
    messageId: input.evidence.messageId,
    messageState: input.evidence.messageState ?? "available",
    editDate: input.evidence.editedAt,
    forward: input.evidence.forward,
    urlMentions: extractedUrls,
    media: {
      retention: "metadata_only",
      items: []
    },
    extractionHandoff: {
      messageText: rawText,
      urlContext: extractedUrls.map((url) => ({ url, messageId: input.evidence.messageId, channel: expectedChannel })),
      actorAliases: extractActorAliasMarkers(rawText),
      cves: extractCveMarkers(rawText),
      victims: extractVictimMarkers(rawText),
      uncertaintyMarkers: ["public_channel_partial_promotion"]
    },
    retentionClass: "public_chat_text",
    provenance: {
      sourceId: input.source.id,
      sourceType: input.source.type,
      channel: expectedChannel,
      messageId: input.evidence.messageId,
      messageUrl: input.evidence.messageUrl,
      collectedAt: promotedAt,
      publishedAt: input.evidence.messageTimestamp,
      contentHash,
      extractorVersion: "telegram_public_adapter_v1",
      confidence: input.evidence.confidence,
      evidenceStage: "promoted"
    }
  };

  const item: CollectedItem = {
    sourceId: input.source.id,
    taskId: input.task?.id,
    url: input.evidence.messageUrl,
    collectedAt: promotedAt,
    publishedAt: input.evidence.messageTimestamp,
    title: `${expectedChannel} #${input.evidence.messageId ?? "unknown"}: promoted public-channel evidence`,
    rawText,
    contentHash,
    language: input.source.language,
    links: extractedUrls,
    metadata,
    sensitive: false
  };

  return {
    allowed: true,
    item,
    extractionInput: {
      sourceId: item.sourceId,
      taskId: item.taskId,
      url: item.url,
      collectedAt: item.collectedAt,
      publishedAt: item.publishedAt,
      rawText: item.rawText,
      contentHash: item.contentHash,
      metadata: item.metadata
    }
  };
}

function operatorState(
  source: SourceRecord,
  model: TelegramPublicChannelSourceModel,
  state: TelegramPublicOperatorState,
  reason: string,
  reviewRequired: boolean,
  collectable: boolean
): TelegramPublicOperatorStateDto {
  return {
    sourceId: source.id,
    channelHandle: model.channelHandle,
    state,
    reason,
    reviewRequired,
    collectable
  };
}

function latestTelegramEvidence(evidence: TelegramPublicEvidenceDto[]): TelegramPublicEvidenceDto | undefined {
  return [...evidence]
    .filter((item) => item.messageTimestamp || item.messageId !== undefined)
    .sort((left, right) => {
      const dateDelta = Date.parse(right.messageTimestamp ?? "") - Date.parse(left.messageTimestamp ?? "");
      if (Number.isFinite(dateDelta) && dateDelta !== 0) return dateDelta;
      return (right.messageId ?? 0) - (left.messageId ?? 0);
    })[0];
}

function topicFitScore(model: TelegramPublicChannelSourceModel, queryTerms: string[], evidence: TelegramPublicEvidenceDto[]): number {
  const modelScore = queryTerms.length > 0 ? scoreTelegramSourceForQuery(model, queryTerms) : 0.5;
  if (modelScore > 0) return modelScore;
  const searchableEvidence = evidence.map((item) => `${item.channel} ${item.snippet} ${item.extractedUrls.join(" ")}`).join(" ").toLowerCase();
  const evidenceHits = queryTerms.filter((term) => searchableEvidence.includes(term.toLowerCase())).length;
  if (evidenceHits > 0) return Math.min(1, 0.45 + evidenceHits * 0.2);
  return queryTerms.length === 0 ? 0.5 : 0;
}

function languageCoverageScore(
  requestedLanguage: string | undefined,
  sourceLanguage: string | undefined,
  evidence: TelegramPublicEvidenceDto[],
  topicFit: number
): number {
  if (!requestedLanguage) return 1;
  const requested = requestedLanguage.toLowerCase();
  const evidenceLanguages = evidence.map((item) => item.languageHint?.toLowerCase()).filter((item): item is string => Boolean(item));
  if (sourceLanguage?.toLowerCase() === requested || evidenceLanguages.includes(requested)) return 1;
  if (!sourceLanguage && evidenceLanguages.length === 0) return topicFit > 0 ? 0.75 : 0.5;
  return topicFit > 0 ? 0.65 : 0.25;
}

function duplicateUrlRatioForEvidence(evidence: TelegramPublicEvidenceDto[]): number {
  const urls = evidence.flatMap((item) => [item.messageUrl, ...item.extractedUrls]).map((url) => url.trim()).filter(Boolean);
  return urls.length ? clamp01((urls.length - new Set(urls).size) / urls.length) : 0;
}

function editDeleteChurnForEvidence(evidence: TelegramPublicEvidenceDto[], health?: TelegramPublicSourceHealthUpdate): number {
  const editedOrDeleted = evidence.filter((item) => item.editedAt || item.messageState === "deleted" || item.messageState === "unavailable").length;
  return Math.max(health?.deletedUnavailableRate ?? 0, rateFromCounts(editedOrDeleted, evidence.length));
}

function unavailableWindowRatioForEvidence(
  source: SourceRecord,
  evidence: TelegramPublicEvidenceDto[],
  health?: TelegramPublicSourceHealthUpdate
): number {
  if (source.status === "quarantined" || health?.fetchOutcome === "failed" || health?.fetchOutcome === "policy_blocked") return 1;
  const unavailable = evidence.filter((item) => item.messageState === "deleted" || item.messageState === "unavailable").length;
  return Math.max(health?.deletedUnavailableRate ?? 0, rateFromCounts(unavailable, evidence.length));
}

function freshnessScore(input: { generatedAt: string; latestEvidenceAt?: string; cadenceSeconds: number }): number {
  if (!input.latestEvidenceAt) return 0.45;
  const ageMs = Date.parse(input.generatedAt) - Date.parse(input.latestEvidenceAt);
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0.7;
  const ageSeconds = ageMs / 1000;
  const target = Math.max(300, input.cadenceSeconds * 4);
  if (ageSeconds <= target) return 1;
  if (ageSeconds <= target * 3) return 0.7;
  if (ageSeconds <= target * 8) return 0.4;
  return 0.15;
}

function rateLimitPenaltyForSource(source: SourceRecord, health: TelegramPublicSourceHealthUpdate | undefined, generatedAt: string): number {
  const model = telegramPublicChannelSourceModel(source);
  const activeReset = model.rateLimitState.resetAt && Date.parse(model.rateLimitState.resetAt) > Date.parse(generatedAt);
  const failurePenalty = source.health ? Math.min(0.5, source.health.errorRate) + Math.min(0.3, source.health.consecutiveFailures * 0.05) : 0;
  return clamp01((activeReset || health?.fetchOutcome === "rate_limited" ? 0.75 : 0) + failurePenalty);
}

function reliabilityRecommendedActions(input: {
  policyBlocked: boolean;
  duplicateUrlRatio: number;
  editDeleteChurn: number;
  unavailableWindowRatio: number;
  freshness: number;
  rateLimitPenalty: number;
  topicFit: number;
  score: number;
  status: SourceRecord["status"];
}): TelegramPublicRepairAction[] {
  const actions = new Set<TelegramPublicRepairAction>();
  if (input.policyBlocked || input.status === "quarantined" || input.unavailableWindowRatio >= 0.6) actions.add("quarantine_channel");
  if (input.duplicateUrlRatio >= 0.4) actions.add("suppress_repeated_urls");
  if (input.editDeleteChurn >= 0.3) actions.add("reduce_window");
  if (input.rateLimitPenalty >= 0.5) actions.add("delay_poll");
  if (input.freshness <= 0.4) actions.add("refresh_cursor");
  if (input.topicFit <= 0 || input.score < 0.5 || input.editDeleteChurn >= 0.5) actions.add("request_review");
  return [...actions];
}

function reliabilityRating(input: {
  policyBlocked: boolean;
  score: number;
  recommendedActions: TelegramPublicRepairAction[];
  unavailableWindowRatio: number;
}): TelegramPublicReliabilityRating {
  if (input.policyBlocked) return "blocked";
  if (input.recommendedActions.includes("quarantine_channel") || input.unavailableWindowRatio >= 0.6) return "quarantine";
  if (input.score < 0.5) return "degraded";
  if (input.score < 0.75 || input.recommendedActions.length > 0) return "watch";
  return "healthy";
}

function reliabilityReasons(input: {
  complianceReason?: string;
  duplicateUrlRatio: number;
  editDeleteChurn: number;
  unavailableWindowRatio: number;
  languageCoverage: number;
  topicFit: number;
  freshness: number;
  rateLimitPenalty: number;
  promotionYield: number;
}): string[] {
  return [
    ...(input.complianceReason ? [input.complianceReason] : []),
    ...(input.freshness < 0.4 ? ["freshness below public-channel cadence target"] : []),
    ...(input.duplicateUrlRatio >= 0.4 ? ["duplicate URL ratio is high"] : []),
    ...(input.editDeleteChurn >= 0.3 ? ["edit/delete churn is high"] : []),
    ...(input.unavailableWindowRatio >= 0.3 ? ["deleted or unavailable windows are elevated"] : []),
    ...(input.languageCoverage < 0.7 ? ["language coverage is weak for the requested query"] : []),
    ...(input.topicFit <= 0 ? ["source topic metadata does not fit the query"] : []),
    ...(input.rateLimitPenalty >= 0.5 ? ["rate-limit or failure history requires delayed polling"] : []),
    ...(input.promotionYield < 0.5 ? ["promotion yield is low; keep evidence partial or needs-review"] : []),
    ...(input.topicFit > 0 && input.languageCoverage >= 0.65 ? ["topic-relevant public evidence preserved even with imperfect language match"] : [])
  ];
}

function countBy(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function roundMetric(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function applyTelegramPublicAbuseControls(input: TelegramPublicAbuseControlInput): TelegramPublicAbuseControlDto {
  const model = telegramPublicChannelSourceModel(input.source);
  const now = Date.parse(input.now ?? nowIso());
  const rateLimitResetAt = model.rateLimitState.resetAt && Date.parse(model.rateLimitState.resetAt) > now
    ? model.rateLimitState.resetAt
    : undefined;
  const cooldownResetAt = readMetadataString(input.source, "channelCooldownUntil");
  const activeCooldown = cooldownResetAt && Date.parse(cooldownResetAt) > now ? cooldownResetAt : undefined;
  const queryTerms = input.query ? expandTelegramQueryTerms(input.query, input.entityType) : [];
  const coverage = coverageTagsForModel(model);
  const requestedTopics = input.topicTags ?? [];
  const coverageMatched = queryTerms.length === 0 && requestedTopics.length === 0
    ? true
    : [...queryTerms, ...requestedTopics].some((term) => coverage.some((tag) => tag.toLowerCase().includes(term.toLowerCase()) || term.toLowerCase().includes(tag.toLowerCase())));
  const languageMatched = !input.language || !model.language || input.language.toLowerCase() === model.language.toLowerCase();
  const requestedWindow = Math.max(1, Math.round(input.requestedWindow ?? readPositiveInteger(input.source, "pageSize", 50, 1, 100)));
  const perChannelWindowLimit = readPositiveInteger(input.source, "publicQueryWindowLimit", 50, 1, 100);
  const effectiveWindow = Math.min(requestedWindow, perChannelWindowLimit);
  const previous = new Set(normalizeTelegramLinks(input.previousUrls ?? []));
  const suppressedUrls = normalizeTelegramLinks(input.urls ?? []).filter((url) => previous.has(url));
  const notes = [
    ...(requestedWindow > effectiveWindow ? [`requested window clamped to per-channel limit ${perChannelWindowLimit}`] : []),
    ...(rateLimitResetAt ? [`source rate-limit state reused until ${rateLimitResetAt}`] : []),
    ...(activeCooldown ? [`channel cooldown active until ${activeCooldown}`] : []),
    ...(!coverageMatched ? ["query terms do not match public-channel coverage metadata"] : []),
    ...(!languageMatched ? ["requested language does not match public-channel language hint"] : []),
    ...(suppressedUrls.length ? [`suppressed ${suppressedUrls.length} repeated public-channel URLs`] : []),
    "raw media fetches are disabled; media remains metadata-only"
  ];

  return {
    allowed: !rateLimitResetAt && !activeCooldown && coverageMatched && languageMatched,
    channel: model.channelHandle,
    requestedWindow,
    effectiveWindow,
    perChannelWindowLimit,
    rateLimitResetAt,
    cooldownResetAt: activeCooldown,
    queryTerms,
    coverageMatched,
    languageMatched,
    suppressedUrls,
    notes
  };
}

export function buildTelegramPublicIncrementalPollDto(input: TelegramPublicIncrementalPollInput): TelegramPublicIncrementalPollDto {
  const cursor = input.cursor;
  const byId = [...input.evidence].sort((a, b) => (a.messageId ?? 0) - (b.messageId ?? 0));
  const visibleAfterCursor = byId.filter((item) => item.messageId !== undefined && (cursor === undefined || item.messageId > cursor));
  const deletedOrUnavailable = byId.filter((item) => item.messageState === "deleted" || item.messageState === "unavailable");
  const updatedMessages = byId.filter((item) => item.editedAt !== undefined && item.messageState !== "deleted" && item.messageState !== "unavailable");
  const updatedIds = new Set(updatedMessages.map((item) => item.messageId));
  const deletedIds = new Set(deletedOrUnavailable.map((item) => item.messageId));
  const newMessages = visibleAfterCursor.filter((item) =>
    item.messageState !== "deleted" &&
    item.messageState !== "unavailable" &&
    !updatedIds.has(item.messageId) &&
    !deletedIds.has(item.messageId)
  );
  const nextCursor = byId.reduce<number | undefined>((max, item) => {
    if (item.messageId === undefined) return max;
    return max === undefined || item.messageId > max ? item.messageId : max;
  }, cursor);

  return {
    cursor,
    nextCursor,
    cursorState: {
      afterMessageId: nextCursor
    },
    generatedAt: input.generatedAt ?? nowIso(),
    newMessages,
    updatedMessages,
    deletedOrUnavailable,
    forwardedMessages: byId.filter((item) => item.forward !== undefined),
    urlMentionedMessages: byId.filter((item) => item.extractedUrls.length > 0),
    promotedExtractionIds: [...new Set([
      ...(input.promotedExtractionIds ?? []),
      ...byId.map((item) => item.promotedExtractionId).filter((item): item is string => typeof item === "string" && Boolean(item))
    ])],
    rateLimitResetAt: input.rateLimitResetAt,
    media: {
      retention: "metadata_only",
      rawFetchAllowed: false
    }
  };
}

export function parseTelegramPublicSourceConfig(source: SourceRecord, task?: CollectionTask): TelegramPublicSourceConfig {
  if (source.type !== "telegram_public") {
    throw new Error(`Telegram adapter cannot collect source type ${source.type}`);
  }

  if (source.accessMethod !== "official_api") {
    throw new TelegramPublicAdapterError("policy_blocked", "telegram_public sources must use official_api access");
  }

  const targetUrl = task?.targetUrl ?? source.url;
  const compliance = validateTelegramPublicSourceCompliance(source, targetUrl);
  if (!compliance.allowed) {
    throw new TelegramPublicAdapterError("policy_blocked", compliance.reason);
  }

  const target = parseTelegramTarget(targetUrl);
  if (!target.channel) {
    throw new TelegramPublicAdapterError("policy_blocked", `Unsupported Telegram public channel target: ${targetUrl}`);
  }

  return {
    channel: target.channel,
    api: readMetadataString(source, "telegramApi") === "mtproto_library" ? "mtproto_library" : "bot_api",
    pageSize: readPositiveInteger(source, "pageSize", 50, 1, 100),
    minIntervalSeconds: readPositiveInteger(source, "minIntervalSeconds", 60, 1, 3600),
    pagination: {
      afterMessageId: readOptionalPositiveInteger(source, "afterMessageId"),
      beforeMessageId: readOptionalPositiveInteger(source, "beforeMessageId")
    },
    pii: {
      minimize: readMetadataBoolean(source, "minimizePii", true)
    }
  };
}

export function parseTelegramTarget(value: string): { channel?: string } {
  try {
    const url = new URL(value);
    if (url.hostname === "t.me" || url.hostname === "telegram.me") {
      const [channel, privateMarker] = url.pathname.split("/").filter(Boolean);
      if (!channel || channel === "joinchat" || channel === "+" || channel === "c" || privateMarker === "joinchat") return {};
      if (channel.startsWith("+")) return {};
      return { channel: normalizeChannel(channel) };
    }

    if (url.protocol === "tg:" && url.hostname === "resolve") {
      const domain = url.searchParams.get("domain");
      return domain ? { channel: normalizeChannel(domain) } : {};
    }
  } catch {
    const plain = value.trim();
    if (/^@?[a-zA-Z][\w\d_]{4,}$/.test(plain)) return { channel: normalizeChannel(plain) };
  }

  return {};
}

type TelegramBotApiPayload = {
  ok?: boolean;
  description?: string;
  parameters?: Record<string, unknown>;
  result?: unknown;
};

type TelegramBotApiUpdate = {
  update_id: number;
  channel_post?: TelegramBotApiMessage;
  edited_channel_post?: TelegramBotApiMessage;
};

type TelegramBotApiMessage = {
  message_id: number;
  date: number;
  edit_date?: number;
  text?: string;
  caption?: string;
  author_signature?: string;
  views?: number;
  chat: {
    id: number;
    title?: string;
    username?: string;
  };
  entities?: TelegramBotApiEntity[];
  caption_entities?: TelegramBotApiEntity[];
};

type TelegramBotApiEntity = {
  type: string;
  offset: number;
  length: number;
  url?: string;
};

async function safeTelegramJson(response: Response): Promise<TelegramBotApiPayload> {
  try {
    return await response.json() as TelegramBotApiPayload;
  } catch {
    return {};
  }
}

function isTelegramBotUpdate(value: unknown): value is TelegramBotApiUpdate {
  if (!value || typeof value !== "object") return false;
  const update = value as Record<string, unknown>;
  return typeof update.update_id === "number" && (isTelegramBotMessage(update.channel_post) || isTelegramBotMessage(update.edited_channel_post));
}

function isTelegramBotMessage(value: unknown): value is TelegramBotApiMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  const chat = message.chat as Record<string, unknown> | undefined;
  return typeof message.message_id === "number" && typeof message.date === "number" && Boolean(chat);
}

function telegramBotMessageToPublicMessage(message: TelegramBotApiMessage, channel: string): TelegramPublicMessage {
  const text = message.text ?? message.caption ?? "";
  return {
    id: message.message_id,
    channel,
    url: `https://t.me/${channel}/${message.message_id}`,
    date: new Date(message.date * 1000).toISOString(),
    editDate: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : undefined,
    text,
    authorSignature: message.author_signature,
    views: message.views,
    links: normalizeTelegramLinks([
      ...extractBotEntityUrls(text, message.entities ?? []),
      ...extractBotEntityUrls(text, message.caption_entities ?? []),
      ...extractUrls(text)
    ])
  };
}

function extractBotEntityUrls(text: string, entities: TelegramBotApiEntity[]): string[] {
  return entities.flatMap((entity) => {
    if (entity.type === "text_link" && entity.url) return [entity.url];
    if (entity.type !== "url") return [];
    return [text.slice(entity.offset, entity.offset + entity.length)];
  });
}

function telegramCollectedItemMatchesQuery(item: CollectedItem, queryTerms: string[]): boolean {
  if (queryTerms.length === 0) return true;
  const searchable = `${item.title ?? ""} ${item.rawText} ${item.url} ${item.links.join(" ")} ${String(item.metadata.channel ?? "")}`.toLowerCase();
  return queryTerms.some((term) => searchable.includes(term.toLowerCase()));
}

function telegramGlobalHitsToCollectedItems(
  hits: TelegramPublicMessageSearchHit[],
  sources: SourceRecord[],
  collectedAt: string
): CollectedItem[] {
  const sourceByChannel = new Map(sources
    .filter((source) => source.type === "telegram_public")
    .map((source) => [telegramPublicChannelSourceModel(source).channelHandle, source]));
  return hits.map((hit) => {
    const channel = normalizeChannel(hit.channel);
    const source = hit.sourceId ? sources.find((candidate) => candidate.id === hit.sourceId) : sourceByChannel.get(channel);
    const sourceId = source?.id ?? `official_search:${channel}`;
    const rawText = minimizeTelegramPii(normalizeTelegramMessageText(hit));
    const links = normalizeTelegramLinks([...(hit.links ?? []), ...extractUrls(rawText)]);
    const contentHash = hashContent(`${channel}:${hit.id}:${hit.editDate ?? ""}:${rawText}:${hit.deleted === true || hit.unavailable === true}`);
    return {
      sourceId,
      url: hit.url,
      collectedAt,
      publishedAt: hit.date,
      title: buildTelegramTitle(channel, hit),
      rawText,
      contentHash,
      language: source?.language,
      links,
      metadata: {
        adapter: "telegram_public",
        accessMethod: "official_api",
        api: hit.provenance.api,
        channel,
        messageId: hit.id,
        messageState: hit.deleted ? "deleted" : hit.unavailable ? "unavailable" : "available",
        editDate: hit.editDate,
        urlMentions: links,
        matchedTerms: hit.matchedTerms,
        media: {
          retention: "metadata_only",
          items: normalizeMediaMetadata(hit.media ?? [])
        },
        extractionHandoff: {
          messageText: rawText,
          urlContext: links.map((url) => ({ url, messageId: hit.id, channel })),
          actorAliases: extractActorAliasMarkers(rawText),
          cves: extractCveMarkers(rawText),
          victims: extractVictimMarkers(rawText),
          uncertaintyMarkers: buildUncertaintyMarkers(hit, rawText)
        },
        retentionClass: "public_chat_text",
        officialSearchProvenance: hit.provenance,
        provenance: {
          sourceId,
          sourceType: "telegram_public",
          channel,
          messageId: hit.id,
          messageUrl: hit.url,
          collectedAt,
          publishedAt: hit.date,
          contentHash,
          extractorVersion: "telegram_public_search_v1",
          confidence: 0.82
        }
      },
      sensitive: false
    };
  });
}

function sanitizeTelegramChannelSearchHit(hit: TelegramPublicChannelSearchHit, query: string, searchedAt: string): TelegramPublicChannelSearchHit {
  const channel = normalizeChannel(hit.channelHandle);
  return {
    channelHandle: channel,
    publicUrl: `https://t.me/${channel}`,
    title: hit.title,
    description: hit.description ? normalizeWhitespace(hit.description).slice(0, 280) : undefined,
    subscriberCount: hit.subscriberCount,
    language: hit.language,
    topicTags: hit.topicTags ?? [],
    confidence: clamp01(hit.confidence ?? 0.5),
    provenance: {
      api: hit.provenance.api,
      method: hit.provenance.method,
      searchedAt: hit.provenance.searchedAt || searchedAt,
      query: hit.provenance.query || query
    }
  };
}

function sanitizeTelegramMessageSearchHit(hit: TelegramPublicMessageSearchHit, query: string, searchedAt: string): TelegramPublicMessageSearchHit {
  const channel = normalizeChannel(hit.channel);
  const text = minimizeTelegramPii(hit.text);
  return {
    ...hit,
    channel,
    url: hit.url || `https://t.me/${channel}/${hit.id}`,
    text,
    quotedText: hit.quotedText ? minimizeTelegramPii(hit.quotedText) : undefined,
    matchedTerms: [...new Set(hit.matchedTerms)],
    media: normalizeMediaMetadata(hit.media ?? []),
    raw: undefined,
    provenance: {
      api: hit.provenance.api,
      method: hit.provenance.method,
      searchedAt: hit.provenance.searchedAt || searchedAt,
      query: hit.provenance.query || query
    }
  };
}

export function minimizeTelegramPii(value: string): string {
  return normalizeWhitespace(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted_email]")
    .replace(/\+\d[\d .()/-]{7,}\d/g, "[redacted_phone]");
}

export function validateTelegramPublicSourceCompliance(
  source: SourceRecord,
  targetUrl = source.url
): { allowed: true } | { allowed: false; reason: string } {
  const loweredTarget = targetUrl.trim().toLowerCase();
  if (/\bt\.me\/(?:joinchat|\+|c\/)|\btelegram\.me\/(?:joinchat|\+|c\/)|^tg:\/\/join/i.test(loweredTarget)) {
    return { allowed: false, reason: "telegram invite links, joinchat links, and private-channel URLs are prohibited" };
  }

  const metadata = sourceMetadata(source);
  const blockedConfigKeys = [
    "accountAutomation",
    "autoJoin",
    "joinGroups",
    "joinChannels",
    "privateChannel",
    "inviteLink",
    "sessionString",
    "userSession",
    "phoneNumber",
    "password",
    "bypassAccessControls",
    "mediaDownload",
    "downloadMedia",
    "rawMedia",
    "fileDownload"
  ];

  for (const key of blockedConfigKeys) {
    const value = metadata[key];
    if (value === undefined || value === false || value === "") continue;
    return { allowed: false, reason: `telegram source config implies prohibited account automation or private access: ${key}` };
  }

  return { allowed: true };
}

export function buildTelegramCrawlState(
  config: Pick<TelegramPublicSourceConfig, "channel" | "pagination">,
  input: {
    messages: TelegramPublicMessage[];
    nextPagination?: TelegramPaginationState;
    rateLimitResetAt?: string;
    fetchDurationMs: number;
  }
): TelegramCrawlStateOutput {
  const ordered = [...input.messages].sort((a, b) => a.id - b.id);
  const last = ordered.at(-1);
  return {
    channel: config.channel,
    afterMessageId: config.pagination?.afterMessageId,
    beforeMessageId: config.pagination?.beforeMessageId,
    nextAfterMessageId: input.nextPagination?.afterMessageId ?? last?.id,
    nextBeforeMessageId: input.nextPagination?.beforeMessageId,
    rateLimitResetAt: input.rateLimitResetAt,
    lastMessageDate: last?.date,
    lastMessageId: last?.id,
    fetchDurationMs: Math.max(0, Math.round(input.fetchDurationMs))
  };
}

function buildTelegramTitle(channel: string, message: TelegramPublicMessage): string {
  if (message.deleted) return `${channel} #${message.id}: deleted message`;
  if (message.unavailable) return `${channel} #${message.id}: unavailable message`;
  const preview = normalizeWhitespace(message.text).slice(0, 80);
  return preview ? `${channel} #${message.id}: ${preview}` : `${channel} #${message.id}`;
}

function normalizeTelegramMessageText(message: TelegramPublicMessage): string {
  const parts = [message.text, message.quotedText ? `quoted: ${message.quotedText}` : ""];
  return normalizeWhitespace(parts.filter(Boolean).join(" "));
}

function minimizeForwardMetadata(forward?: TelegramPublicForwardMetadata): TelegramPublicForwardMetadata | undefined {
  if (!forward) return undefined;
  return {
    fromChannel: forward.fromChannel,
    fromMessageId: forward.fromMessageId,
    fromUrl: forward.fromUrl,
    date: forward.date
  };
}

function normalizeMediaMetadata(media: TelegramPublicMediaMetadata[]): TelegramPublicMediaMetadata[] {
  return media.map((item) => ({
    type: item.type,
    fileName: item.fileName,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    durationSeconds: item.durationSeconds,
    width: item.width,
    height: item.height,
    thumbnailHash: item.thumbnailHash
  }));
}

function extractActorAliasMarkers(text: string): string[] {
  return uniqueMatches(text, /\b(?:APT\d{1,3}|Cozy Bear|The Dukes|Nobelium|Scattered Spider|Octo Tempest|UNC3944|Scatter Swine|LockBit|Akira|BlackCat|ALPHV|Cl0p|Clop)\b/gi);
}

function extractCveMarkers(text: string): string[] {
  return uniqueMatches(text, /\bCVE-\d{4}-\d{4,}\b/gi).map((value) => value.toUpperCase());
}

function extractVictimMarkers(text: string): string[] {
  const victims = new Set<string>();
  for (const match of text.matchAll(/\b(?:victim|target|against|listed)\s*:?\s+([A-Z][A-Za-z0-9&., -]{2,80})/g)) {
    const value = normalizeWhitespace(match[1] ?? "").replace(/\s+\b(?:and|with|after|on|in|for|posted)\b.*$/i, "");
    if (value) victims.add(value);
  }
  return [...victims];
}

function buildUncertaintyMarkers(message: TelegramPublicMessage, text: string): string[] {
  const markers = new Set<string>();
  if (message.deleted) markers.add("message_deleted");
  if (message.unavailable) markers.add("message_unavailable");
  if (/\b(?:alleged|claim(?:ed|s)?|unconfirmed|rumou?r)\b/i.test(text)) markers.add("claim_uncorroborated");
  if (message.forward || message.forwardFrom) markers.add("forwarded_public_message");
  return [...markers];
}

function expandTelegramQueryTerms(query: string, entityType?: string): string[] {
  const normalized = query.trim();
  const terms = new Set<string>([normalized]);
  if (/^apt29$/i.test(normalized) || /cozy bear/i.test(normalized) || /nobelium/i.test(normalized)) {
    for (const alias of ["APT29", "Cozy Bear", "The Dukes", "Nobelium"]) terms.add(alias);
  }
  if (/scattered spider|octo tempest|unc3944|scatter swine/i.test(normalized)) {
    for (const alias of ["Scattered Spider", "Octo Tempest", "UNC3944", "Scatter Swine"]) terms.add(alias);
  }
  if (/lockbit/i.test(normalized)) {
    for (const alias of ["LockBit", "LockBit 3.0", "LockBitSupp"]) terms.add(alias);
  }
  if (/akira/i.test(normalized)) {
    for (const alias of ["Akira", "Akira ransomware"]) terms.add(alias);
  }
  if (/blackcat|alphv/i.test(normalized)) {
    for (const alias of ["BlackCat", "ALPHV", "ALPHV BlackCat"]) terms.add(alias);
  }
  if (/cl0p|clop/i.test(normalized)) {
    for (const alias of ["Cl0p", "Clop"]) terms.add(alias);
  }
  for (const cve of normalized.match(/\bCVE-\d{4}-\d{4,}\b/gi) ?? []) terms.add(cve.toUpperCase());
  if (entityType === "cve") terms.add(normalized.toUpperCase());
  if (entityType === "sector") terms.add(normalized.toLowerCase());
  if (entityType === "victim") terms.add(normalized);
  return [...terms].filter(Boolean);
}

function scoreTelegramSourceForQuery(model: TelegramPublicChannelSourceModel, queryTerms: string[]): number {
  const searchable = [
    model.channelHandle,
    model.channelId ?? "",
    ...model.topicTags,
    ...model.focus.actors,
    ...model.focus.ransomware,
    ...model.focus.cves,
    ...model.focus.victims,
    ...model.focus.sectors,
    ...model.focus.countries
  ].join(" ").toLowerCase();

  const hits = queryTerms.filter((term) => searchable.includes(term.toLowerCase())).length;
  if (hits > 0) return Math.min(1, 0.45 + hits * 0.2);
  if (model.topicTags.some((tag) => /apt|ransomware|cve|victim|sector|country|threat|crime/i.test(tag))) return 0.25;
  return 0;
}

function coverageTagsForModel(model: TelegramPublicChannelSourceModel): string[] {
  return [...new Set([
    ...model.topicTags,
    ...model.focus.actors,
    ...model.focus.ransomware,
    ...model.focus.cves,
    ...model.focus.victims,
    ...model.focus.sectors,
    ...model.focus.countries
  ])];
}

function activationChannelSummary(
  source: SourceRecord,
  model: TelegramPublicChannelSourceModel,
  requiredAction: TelegramPublicActivationChannelSummary["requiredAction"]
): TelegramPublicActivationChannelSummary {
  return {
    sourceId: source.id,
    channelHandle: model.channelHandle,
    publicUrl: model.publicUrl,
    status: source.status,
    coverageTags: coverageTagsForModel(model),
    rateLimitResetAt: model.rateLimitState.resetAt,
    requiredAction
  };
}

const DIAGNOSTIC_STATUSES: TelegramPublicChannelDiagnosticStatus[] = [
  "active",
  "approved_idle",
  "pending_review",
  "rate_limited",
  "unavailable",
  "policy_disabled",
  "stale_cursor",
  "high_duplicate_url_rate",
  "high_edit_delete_churn",
  "no_query_coverage"
];

function diagnosticStatusesForChannel(input: {
  source: SourceRecord;
  bridged: SourceRecord;
  model: TelegramPublicChannelSourceModel;
  health?: TelegramPublicSourceHealthUpdate;
  queryTerms: string[];
  generatedAt: string;
  staleCursorAfterSeconds?: number;
}): TelegramPublicChannelDiagnosticStatus[] {
  const statuses = new Set<TelegramPublicChannelDiagnosticStatus>();
  const compliance = validateTelegramPublicSourceCompliance(input.bridged);
  const rateLimitResetAt = input.model.rateLimitState.resetAt;
  const coverageTags = coverageTagsForModel(input.model);
  const staleSeconds = input.staleCursorAfterSeconds ?? Math.max(1_800, input.model.rateLimitState.minIntervalSeconds * 4);
  if (!compliance.allowed || input.source.accessMethod === "disabled" || input.source.status === "disabled" || input.source.status === "rejected" || input.source.catalog?.approvalScope === "disabled") {
    statuses.add("policy_disabled");
  }
  if (input.health?.fetchOutcome === "failed" || input.health?.fetchOutcome === "policy_blocked") statuses.add("unavailable");
  if (input.model.legalStatus !== "approved_public") statuses.add("pending_review");
  if (input.model.legalStatus === "approved_public" && (input.source.status === "approved" || input.source.status === "candidate" || input.source.status === "needs_review")) {
    statuses.add("approved_idle");
  }
  if (input.model.legalStatus === "approved_public" && (input.source.status === "active" || input.source.status === "probation" || input.source.status === "degraded")) {
    statuses.add("active");
  }
  if (rateLimitResetAt && Date.parse(rateLimitResetAt) > Date.parse(input.generatedAt)) statuses.add("rate_limited");
  if (input.source.crawlState?.cursor && input.source.crawlState.lastCollectedAt && Date.parse(input.generatedAt) - Date.parse(input.source.crawlState.lastCollectedAt) > staleSeconds * 1000) {
    statuses.add("stale_cursor");
  }
  if ((input.health?.duplicateUrlRate ?? 0) >= 0.4) statuses.add("high_duplicate_url_rate");
  if ((input.health?.deletedUnavailableRate ?? 0) >= 0.3) statuses.add("high_edit_delete_churn");
  if (input.queryTerms.length > 0 && !input.queryTerms.some((term) => coverageTags.some((tag) => tag.toLowerCase().includes(term.toLowerCase()) || term.toLowerCase().includes(tag.toLowerCase())))) {
    statuses.add("no_query_coverage");
  }
  return [...statuses];
}

function repairRecommendationsForChannel(
  source: SourceRecord,
  model: TelegramPublicChannelSourceModel,
  statuses: TelegramPublicChannelDiagnosticStatus[],
  schedulerState: TelegramPublicChannelDiagnostic["schedulerState"],
  health?: TelegramPublicSourceHealthUpdate
): TelegramPublicRepairRecommendation[] {
  const repairs: TelegramPublicRepairRecommendation[] = [];
  const base = { sourceId: source.id, channelHandle: model.channelHandle };
  if (statuses.includes("high_duplicate_url_rate")) repairs.push({ ...base, action: "suppress_repeated_urls", reason: "duplicate URL rate is high for public-channel evidence", priority: "medium" });
  if (statuses.includes("high_edit_delete_churn")) repairs.push({ ...base, action: "reduce_window", reason: "edited/deleted/unavailable churn is high; reduce polling window", priority: "medium" });
  if (statuses.includes("rate_limited") || schedulerState.retryAfterSeconds !== undefined) repairs.push({ ...base, action: "delay_poll", reason: "channel is rate-limited or scheduler retry is active", priority: "high" });
  if (statuses.includes("stale_cursor")) repairs.push({ ...base, action: "refresh_cursor", reason: "cursor state is stale relative to the channel cadence", priority: "medium" });
  if (statuses.includes("unavailable") || statuses.includes("policy_disabled") || schedulerState.deadLettered || health?.fetchOutcome === "failed") repairs.push({ ...base, action: "quarantine_channel", reason: "channel is unavailable, policy-disabled, or dead-lettered", priority: "high" });
  if (statuses.includes("pending_review") || statuses.includes("approved_idle")) repairs.push({ ...base, action: "request_review", reason: "public channel needs review or activation before collection", priority: "medium" });
  if (statuses.includes("no_query_coverage")) repairs.push({ ...base, action: "request_review", reason: "channel does not cover the current query terms", priority: "low" });
  return repairs;
}

function dedupeRepairs(repairs: TelegramPublicRepairRecommendation[]): TelegramPublicRepairRecommendation[] {
  const seen = new Set<string>();
  const output: TelegramPublicRepairRecommendation[] = [];
  for (const repair of repairs) {
    const key = `${repair.action}:${repair.sourceId ?? ""}:${repair.channelHandle ?? ""}:${repair.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(repair);
  }
  return output;
}

function stableTelegramTaskId(requestId: string, sourceId: string, url: string, queryTerms: string[]): string {
  return `task_${hashContent(`${requestId}:${sourceId}:${url}:${queryTerms.join("|")}`)}`;
}

function uniqueMatches(text: string, pattern: RegExp): string[] {
  return [...new Set([...text.matchAll(pattern)].map((match) => normalizeWhitespace(match[0])))];
}

function telegramRunResult(input: {
  warnings: string[];
  failureCategory?: TelegramAdapterFailureCategory;
  crawlState: TelegramCrawlStateOutput;
}): AdapterRunResult {
  return {
    items: [],
    discovered: [],
    warnings: input.warnings,
    metadata: {
      adapter: "telegram_public",
      failureCategory: input.failureCategory,
      crawlState: input.crawlState
    }
  };
}

function emptyCrawlState(targetUrl: string, startedAt: number): TelegramCrawlStateOutput {
  return {
    channel: parseTelegramTarget(targetUrl).channel ?? "unknown",
    fetchDurationMs: Math.max(0, Date.now() - startedAt)
  };
}

function classifyTelegramClientError(error: unknown): {
  category: TelegramAdapterFailureCategory;
  message: string;
  rateLimitResetAt?: string;
} {
  if (error instanceof TelegramPublicAdapterError) {
    return { category: error.category, message: error.message, rateLimitResetAt: error.rateLimitResetAt };
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();
  if (lowered.includes("rate") || lowered.includes("flood") || lowered.includes("retry-after")) {
    return { category: "rate_limited", message };
  }
  if (lowered.includes("timeout") || lowered.includes("timed out") || lowered.includes("abort")) {
    return { category: "timeout", message };
  }
  if (lowered.includes("not found") || lowered.includes("forbidden") || lowered.includes("unauthorized") || lowered.includes("bad request")) {
    return { category: "permanent_api", message };
  }
  return { category: "transient_api", message };
}

function normalizeChannel(value: string): string {
  return value.replace(/^@/, "").toLowerCase();
}

function extractUrls(value: string): string[] {
  return [...value.matchAll(/\bhttps?:\/\/[^\s<>"')]+/gi)].map((match) => match[0]);
}

function normalizeTelegramLinks(links: string[]): string[] {
  return [...new Set(links.map((link) => link.trim()).filter(Boolean))];
}

function privateTelegramMetadataKeys(metadata: Record<string, unknown>): string[] {
  return [
    "accountAutomation",
    "autoJoin",
    "joinGroups",
    "joinChannels",
    "privateChannel",
    "inviteLink",
    "sessionString",
    "userSession",
    "phoneNumber",
    "password",
    "bypassAccessControls",
    "mediaDownload",
    "downloadMedia",
    "rawMedia",
    "fileDownload"
  ].filter((key) => metadata[key] !== undefined);
}

function rateFromCounts(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, count / total));
}

function validateStablePublicMessageUrl(
  value: string,
  expectedChannel: string,
  expectedMessageId?: number
): { allowed: true } | { allowed: false; reason: string } {
  try {
    const url = new URL(value);
    if (url.hostname !== "t.me" && url.hostname !== "telegram.me") {
      return { allowed: false, reason: "public-channel promotion requires a stable t.me message URL" };
    }
    const [channel, messageId, extra] = url.pathname.split("/").filter(Boolean);
    if (!channel || channel === "joinchat" || channel === "c" || channel.startsWith("+")) {
      return { allowed: false, reason: "telegram private, invite, and internal channel URLs cannot be promoted" };
    }
    if (extra || !/^\d+$/.test(messageId ?? "")) {
      return { allowed: false, reason: "public-channel promotion requires a message-level URL" };
    }
    if (normalizeChannel(channel) !== expectedChannel) {
      return { allowed: false, reason: "public-channel promotion URL channel does not match evidence channel" };
    }
    if (expectedMessageId !== undefined && Number(messageId) !== expectedMessageId) {
      return { allowed: false, reason: "public-channel promotion URL message id does not match evidence message id" };
    }
    return { allowed: true };
  } catch {
    return { allowed: false, reason: "public-channel promotion requires a parseable public Telegram URL" };
  }
}

function readMetadataString(source: SourceRecord, key: string): string | undefined {
  const metadata = sourceMetadata(source);
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

function readMetadataStringArray(source: SourceRecord, key: string): string[] | undefined {
  const metadata = sourceMetadata(source);
  const value = metadata[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

function readMetadataBoolean(source: SourceRecord, key: string, fallback: boolean): boolean {
  const metadata = sourceMetadata(source);
  const value = metadata[key];
  return typeof value === "boolean" ? value : fallback;
}

function readOptionalPositiveInteger(source: SourceRecord, key: string): number | undefined {
  const metadata = sourceMetadata(source);
  const value = metadata[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function readPositiveInteger(source: SourceRecord, key: string, fallback: number, min: number, max: number): number {
  const metadata = sourceMetadata(source);
  const value = metadata[key];
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function sourceMetadata(source: SourceRecord): Record<string, unknown> {
  return source.metadata ?? {};
}

function readStringArray(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function isTelegramApproved(source: SourceRecord): boolean {
  if (source.governance) return source.governance.approvalState === "approved" && Boolean(source.governance.approvedAt && source.governance.approvedBy);
  return Boolean(source.approvedAt && source.approvedBy);
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberMetadata(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function messageStateMetadata(value: unknown): TelegramPublicEvidenceDto["messageState"] | undefined {
  return value === "available" || value === "deleted" || value === "unavailable" ? value : undefined;
}

function publicForwardMetadata(value: unknown): TelegramPublicForwardMetadata | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const forward = {
    fromChannel: stringMetadata(record.fromChannel),
    fromMessageId: numberMetadata(record.fromMessageId),
    fromUrl: stringMetadata(record.fromUrl),
    date: stringMetadata(record.date)
  };
  return Object.values(forward).some((item) => item !== undefined) ? forward : undefined;
}

function publicMediaMetadata(value: unknown): TelegramPublicEvidenceDto["media"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const items = Array.isArray(record.items) ? normalizeMediaMetadata(record.items.filter(isTelegramPublicMediaMetadata)) : [];
  return {
    retention: "metadata_only",
    rawFetchAllowed: false,
    items
  };
}

function publicExtractionHandoff(value: unknown): TelegramPublicEvidenceDto["extractionHandoff"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return {
    actorAliases: unknownStringArray(record.actorAliases),
    cves: unknownStringArray(record.cves).map((item) => item.toUpperCase()),
    victims: unknownStringArray(record.victims),
    uncertaintyMarkers: unknownStringArray(record.uncertaintyMarkers)
  };
}

function unknownStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function isTelegramPublicMediaMetadata(value: unknown): value is TelegramPublicMediaMetadata {
  if (!value || typeof value !== "object") return false;
  const type = (value as Record<string, unknown>).type;
  return type === "photo" || type === "video" || type === "document" || type === "audio" || type === "sticker" || type === "other";
}
