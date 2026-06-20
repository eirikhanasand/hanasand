// @ts-nocheck
import type { SourceRecord } from "../types.ts";
import { hashContent, normalizeWhitespace, nowIso } from "../utils.ts";
import type { TelegramPublicEvidenceDto, TelegramPublicSourcePack } from "./telegramPublicTypes.ts";

export type PublicSignalSourceFamily =
  | "public_channel"
  | "github_advisory"
  | "cert_government"
  | "vendor_report"
  | "malware_report_feed"
  | "public_research_feed"
  | "public_social"
  | "clear_web";

export interface PublicSignalFusionInput {
  query: string;
  entityType?: string;
  sources: SourceRecord[];
  sourcePacks?: TelegramPublicSourcePack[];
  evidence?: TelegramPublicEvidenceDto[];
  advisorySignals?: PublicAdvisorySignalRecord[];
  darkwebMetadataSignals?: PublicSignalDarkwebMetadataInput[];
  previousUrls?: string[];
  tenantId?: string;
  generatedAt?: string;
  maxSelectedSources?: number;
}

export interface PublicSignalSourceSelectionDto {
  sourceId: string;
  name: string;
  url: string;
  family: PublicSignalSourceFamily;
  status: SourceRecord["status"];
  selected: boolean;
  score: number;
  reliability: number;
  freshness: number;
  queryFit: number;
  diversityBoost: number;
  decayReasons: string[];
  matchedTerms: string[];
  language?: string;
  regions: string[];
  rateLimit: {
    delayed: boolean;
    retryAfterSeconds?: number;
    backoffUntil?: string;
  };
  availability: {
    unavailable: boolean;
    takedownOrRetired: boolean;
    deletedOrUnavailablePublicMessages: number;
    editedPublicMessages: number;
  };
  hints: {
    githubAdvisory: boolean;
    certGovernment: boolean;
    vendorReport: boolean;
    malwareReportFeed: boolean;
    publicChannel: boolean;
    publicSocial: boolean;
    clearWebPromotion: boolean;
  };
  provenance: {
    sourceId: string;
    sourceType: SourceRecord["type"];
    accessMethod: SourceRecord["accessMethod"];
    legalNotes: string;
    approvedPublic: boolean;
    metadataOnly: boolean;
  };
}

export interface PublicSignalDeltaDto {
  id: string;
  sourceId: string;
  family: PublicSignalSourceFamily;
  title?: string;
  summary?: string;
  url: string;
  canonicalUrl?: string;
  contentHash?: string;
  mergeTarget?: "clear_web_capture_evidence" | "public_channel_partial_evidence";
  state: "new" | "edited" | "deleted_or_unavailable" | "duplicate_suppressed";
  confidence: number;
  reliabilityScore?: number;
  language?: string;
  region?: string;
  tags?: string[];
  matchedEntities?: Partial<PublicSignalMatchedEntities>;
  dedupeKey?: string;
  evidenceUrl?: string;
  collectedAt?: string;
  publishedAt?: string;
  observedAt?: string;
  provenance: {
    sourceId: string;
    publicOnly: true;
    evidenceBacked: boolean;
    safeUrl: boolean;
  };
}

export interface PublicSignalMatchedEntities {
  actors: string[];
  malware: string[];
  tools: string[];
  cves: string[];
  campaigns: string[];
  sectors: string[];
  countries: string[];
  victims: string[];
}

export interface PublicAdvisorySignalRecord {
  id: string;
  sourceId: string;
  family: Exclude<PublicSignalSourceFamily, "public_channel" | "public_social" | "clear_web"> | "clear_web";
  title: string;
  url: string;
  canonicalUrl?: string;
  summary?: string;
  publishedAt?: string;
  observedAt?: string;
  updatedAt?: string;
  language?: string;
  region?: string;
  tags?: string[];
  matchedEntities?: Partial<PublicSignalMatchedEntities>;
  confidence?: number;
  reliabilityScore?: number;
  state?: "active" | "edited" | "unavailable" | "policy_disabled" | "stale";
  sourceTrust?: number;
  access?: "public_http" | "official_api" | "manual_seed";
  policy?: {
    publicOnly: boolean;
    authRequired?: boolean;
    privateRepo?: boolean;
    captchaRequired?: boolean;
    exploitPayloadDownload?: boolean;
    leakedDataRedistribution?: boolean;
    termsBypass?: boolean;
  };
  provenance?: {
    connector: "github_security_advisory" | "cisa_kev" | "cert_advisory" | "vendor_report" | "malware_feed" | "public_report_index";
    collectedAt?: string;
    parserVersion?: string;
  };
}

export interface PublicAdvisorySignalConnectorInput {
  query: string;
  entityType?: string;
  sources: SourceRecord[];
  signals: PublicAdvisorySignalRecord[];
  generatedAt?: string;
  tenantId?: string;
  maxSignals?: number;
}

export interface PublicAdvisorySignalConnectorDto {
  generatedAt: string;
  query: string;
  queryTerms: string[];
  status: "ready" | "partial" | "needs_source_activation" | "blocked";
  rankedSignals: Array<PublicSignalDeltaDto & {
    rank: number;
    rankingScore: number;
    sourceFamily: PublicSignalSourceFamily;
    stale: boolean;
    policyAllowed: boolean;
    queryMatched: boolean;
    suppressionReason?: string;
  }>;
  suppressed: {
    duplicateDedupeKeys: string[];
    unsafeUrls: string[];
    unavailableSignalIds: string[];
    policyDisabledSignalIds: string[];
    staleSignalIds: string[];
  };
  sourceFamilySummary: Record<PublicSignalSourceFamily, {
    candidateCount: number;
    selectedCount: number;
    topScore: number;
  }>;
  fastInitialSummary: {
    queryClass: string;
    topTitles: string[];
    topFamilies: PublicSignalSourceFamily[];
    usefulSignalCount: number;
    canAnswerImmediately: boolean;
  };
  guardrails: {
    publicOnly: true;
    noAuthBypass: true;
    noPrivateRepoAccess: true;
    noCaptchaSolving: true;
    noTermsBypass: true;
    noExploitPayloadDownload: true;
    noLeakedDataRedistribution: true;
    unsafeUrlsExposed: false;
  };
}

export type AnalystPublicSourceDecisionReason =
  | "trusted"
  | "suppressed"
  | "merged"
  | "stale"
  | "duplicate"
  | "unavailable"
  | "edited_deleted"
  | "policy_disabled"
  | "parser_gap"
  | "legal_robots_hold"
  | "low_yield";

export type AnalystPublicSourceAction =
  | "approve_source"
  | "disable_source"
  | "lower_trust"
  | "raise_trust"
  | "raise_cadence"
  | "lower_cadence"
  | "mark_duplicate"
  | "request_parser_repair"
  | "request_legal_robots_review"
  | "promote_source_pack_candidate";

export interface AnalystPublicSourceWorkbenchInput {
  query: string;
  generatedAt?: string;
  sources: SourceRecord[];
  selectedSources?: PublicSignalSourceSelectionDto[];
  advisoryConnector?: PublicAdvisorySignalConnectorDto;
  suppressed?: PublicSignalFusionDto["suppressed"];
  missingFamilies?: PublicSignalSourceFamily[];
  tenantId?: string;
}

export interface AnalystPublicSourceDecisionDto {
  id: string;
  sourceId: string;
  sourceName: string;
  family: PublicSignalSourceFamily;
  decision: AnalystPublicSourceDecisionReason;
  reason: string;
  severity: "info" | "watch" | "review" | "hold";
  trustScore: number;
  reliability: number;
  freshness: number;
  evidenceYield: number;
  parserSupport: "ready" | "needs_repair" | "unknown";
  publicOnly: true;
  safeUrl: boolean;
  mergeTarget?: "clear_web_capture_evidence" | "public_channel_partial_evidence";
  dedupeKey?: string;
  relatedSignalIds: string[];
  handoff: {
    agent01Governance: "none" | "approval_review" | "legal_robots_review" | "source_pack_promotion";
    agent02Scheduler: "none" | "raise_cadence" | "lower_cadence" | "pause_or_disable";
    agent06EvidenceYield: "none" | "monitor_low_yield" | "merge_duplicate_evidence";
    agent07QualityGate: "none" | "review_stale_or_edited" | "hold_policy_disabled" | "parser_gap";
    agent09ApiField: "analystSourceWorkbench";
    agent10SloDashboard: "none" | "source_health_watch" | "release_hold";
  };
  provenance: {
    sourceId: string;
    publicOnly: true;
    unsafeUrlExposed: false;
    decisionAt: string;
  };
}

export interface AnalystPublicSourceWorkbenchDto {
  schemaVersion: "ti.public_source_workbench.v1";
  generatedAt: string;
  query: string;
  status: "ready" | "needs_review" | "hold";
  decisions: AnalystPublicSourceDecisionDto[];
  dryRunActions: Array<{
    id: string;
    sourceId: string;
    action: AnalystPublicSourceAction;
    reason: string;
    decisionIds: string[];
    execution: "dry_run_only" | "human_approval_required" | "blocked";
    willMutate: false;
    willStartCrawling: false;
    publicOnly: true;
    unsafeUrlExposed: false;
    handoff: AnalystPublicSourceDecisionDto["handoff"];
  }>;
  summary: {
    trusted: number;
    review: number;
    hold: number;
    stale: number;
    duplicate: number;
    parserGap: number;
    legalRobotsHold: number;
    lowYield: number;
  };
  handoffs: {
    agent01Governance: string[];
    agent02Scheduler: string[];
    agent06EvidenceYield: string[];
    agent07QualityGates: string[];
    agent09ApiFields: string[];
    agent10SloDashboard: string[];
  };
  guardrails: {
    publicOnly: true;
    noAuthBypass: true;
    noPrivateRepoAccess: true;
    noCaptchaSolving: true;
    noExploitPayloadDownload: true;
    noLeakedDataRedistribution: true;
    unsafeUrlsExposed: false;
    dryRunOnly: true;
  };
}

export type EnterpriseCoverageGapCode =
  | "actor_source_family_gap"
  | "sector_country_gap"
  | "stale_source_gap"
  | "missing_advisory_family"
  | "missing_malware_tool_feed"
  | "weak_ransomware_coverage"
  | "weak_cve_advisory_coverage"
  | "poor_useful_answer_rate"
  | "parser_gap"
  | "duplicate_source_gap";

export interface EnterpriseSourceCoverageRadarInput {
  query: string;
  entityType?: string;
  sources: SourceRecord[];
  sourcePacks?: TelegramPublicSourcePack[];
  selectedSources?: PublicSignalSourceSelectionDto[];
  advisoryConnector?: PublicAdvisorySignalConnectorDto;
  analystSourceWorkbench?: AnalystPublicSourceWorkbenchDto;
  publicSignalDeltas?: PublicSignalDeltaDto[];
  generatedAt?: string;
  tenantId?: string;
}

export interface EnterpriseSourceCoverageRadarDto {
  schemaVersion: "ti.enterprise_source_coverage_radar.v1";
  generatedAt: string;
  query: string;
  queryClass: string;
  status: "healthy" | "watch" | "needs_onboarding" | "hold";
  coverageScore: number;
  gaps: Array<{
    id: string;
    code: EnterpriseCoverageGapCode;
    label: string;
    severity: "info" | "watch" | "review" | "hold";
    scoreImpact: number;
    affectedFamilies: PublicSignalSourceFamily[];
    affectedSourceIds: string[];
    reason: string;
    taskReadyRecommendation: string;
    handoff: {
      agent01Onboarding: string;
      agent02SchedulingCadence: string;
      agent03ParserRepair: string;
      agent06EvidencePersistence: string;
      agent07QualityGates: string;
      agent08GraphPivots: string;
      agent09ApiFields: "publicSignalFusion.coverageRadar";
      agent10SloMonitoring: string;
    };
  }>;
  sourcePackRecommendations: Array<{
    id: string;
    sourcePackId: string;
    sourceId: string;
    family: PublicSignalSourceFamily;
    name: string;
    requiredAction: "promote_source_pack_candidate" | "request_legal_robots_review" | "request_parser_repair" | "raise_cadence" | "activate_approved_public_source";
    trustScore: number;
    freshness: number;
    familyDiversityGain: number;
    parserSupport: "ready" | "needs_repair" | "unknown";
    expectedEvidenceYield: number;
    legalReviewAgeDays: number | "unknown";
    robotsReviewAgeDays: number | "not_required" | "unknown";
    activationReadiness: "ready" | "needs_review" | "parser_gap" | "blocked";
    publicOnly: true;
    willMutate: false;
    willStartCrawling: false;
  }>;
  conflictIndicators: Array<{
    id: string;
    conflictType: "actor_attribution" | "cve_exploitation" | "campaign_timing" | "sector_victim_claim";
    entity: string;
    sourceIds: string[];
    families: PublicSignalSourceFamily[];
    summary: string;
    severity: "watch" | "review" | "hold";
    handoff: {
      agent07QualityGate: "contradiction_review";
      agent08GraphPivot: "hold_conflicting_relationship";
      agent09ApiField: "publicSignalFusion.coverageRadar.conflictIndicators";
    };
  }>;
  queryClassUsefulAnswer: {
    usefulSignalCount: number;
    selectedSourceCount: number;
    familyDiversity: number;
    canAnswerImmediately: boolean;
    poorUsefulAnswerRate: boolean;
  };
  handoffs: {
    agent01Onboarding: string[];
    agent02SchedulingCadence: string[];
    agent03ParserRepair: string[];
    agent06EvidencePersistence: string[];
    agent07QualityGates: string[];
    agent08GraphPivots: string[];
    agent09ApiFields: string[];
    agent10SloMonitoring: string[];
  };
  guardrails: {
    publicOnly: true;
    safePublicOnly: true;
    restrictedMetadataReviewHeldOnly: true;
    noAuthBypass: true;
    noPrivateRepoAccess: true;
    noCaptchaSolving: true;
    noExploitPayloadDownload: true;
    noLeakedDataRedistribution: true;
    unsafeUrlsExposed: false;
    dryRunOnly: true;
  };
}

export type PublicSourcePackQueryClass =
  | "apt"
  | "ransomware"
  | "cve_advisory"
  | "malware_tool"
  | "country"
  | "sector"
  | "campaign"
  | "infrastructure"
  | "victim_company"
  | "general";

export interface PublicSourcePackExpansionDto {
  schemaVersion: "ti.public_source_pack_expansion.v1";
  generatedAt: string;
  query: string;
  queryClass: PublicSourcePackQueryClass;
  status: "ready" | "needs_onboarding" | "needs_review" | "blocked";
  familyCoverage: {
    requiredFamilies: PublicSignalSourceFamily[];
    coveredFamilies: PublicSignalSourceFamily[];
    missingFamilies: PublicSignalSourceFamily[];
    diversityScore: number;
  };
  candidates: Array<{
    id: string;
    sourcePackId: string;
    sourcePackName: string;
    sourceId: string;
    name: string;
    family: PublicSignalSourceFamily;
    queryClasses: PublicSourcePackQueryClass[];
    publicUrlHash: string;
    dedupeKey: string;
    score: number;
    trustScore: number;
    freshness: number;
    familyDiversityGain: number;
    expectedEvidenceYield: number;
    staleSuppressed: boolean;
    duplicateSuppressed: boolean;
    parserCapability: "ready" | "needs_parser" | "metadata_only" | "unknown";
    onboardingRecommendation: "activate_approved_public_source" | "review_public_source" | "repair_parser_before_activation" | "suppress_duplicate" | "suppress_stale" | "blocked";
    rateLimit: {
      minIntervalSeconds: number;
      pageSize: number;
      expectedRequestsPerHour?: number;
    };
    provenance: {
      sourcePackId: string;
      sourceId: string;
      publicOnly: true;
      approvalState: TelegramPublicSourcePack["sources"][number]["approvalState"];
      approvalScope: TelegramPublicSourcePack["sources"][number]["compliance"]["approvalScope"];
      retentionClass: TelegramPublicSourcePack["sources"][number]["retentionClass"];
      unsafeUrlExposed: false;
    };
  }>;
  suppressed: {
    staleSourceIds: string[];
    duplicateDedupeKeys: string[];
    blockedSourceIds: string[];
    unsafeUrlHashes: string[];
  };
  handoffs: {
    agent01Onboarding: string[];
    agent02SchedulingCadence: string[];
    agent03ParserRepair: string[];
    agent06EvidencePersistence: string[];
    agent07QualityGates: string[];
    agent09ApiFields: string[];
    agent10SloMonitoring: string[];
  };
  guardrails: {
    publicOnly: true;
    dryRunOnly: true;
    noPrivateChannelAccess: true;
    noAccountAutomation: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noExploitPayloadDownload: true;
    noLeakedDataRedistribution: true;
    unsafeUrlsExposed: false;
  };
}

export type PublicAdvisoryCorrelationConflictType =
  | "none"
  | "actor_attribution_disagreement"
  | "stale_or_reposted_advisory"
  | "duplicate_vendor_syndication"
  | "cve_actor_overclaim"
  | "sector_country_ambiguity"
  | "edited_deleted_public_channel"
  | "public_channel_only_claim";

export interface PublicAdvisoryCorrelationDto {
  schemaVersion: "ti.public_advisory_correlation.v1";
  generatedAt: string;
  query: string;
  queryTerms: string[];
  status: "ready" | "needs_review" | "hold" | "insufficient_public_evidence";
  correlatedEvidence: Array<{
    id: string;
    entityType: keyof PublicSignalMatchedEntities;
    entity: string;
    normalizedEntity: string;
    sourceFamilies: PublicSignalSourceFamily[];
    sourceIds: string[];
    evidenceIds: string[];
    firstSeen?: string;
    lastSeen?: string;
    freshness: number;
    correlationConfidence: number;
    conflictTypes: PublicAdvisoryCorrelationConflictType[];
    analystAction: "accept_with_caveat" | "review_conflict" | "hold_graph_promotion" | "request_more_sources";
    provenance: {
      publicOnly: true;
      unsafeUrlExposed: false;
      evidenceBacked: boolean;
      publicChannelOnly: boolean;
      dedupeKeys: string[];
    };
  }>;
  conflicts: Array<{
    id: string;
    conflictType: Exclude<PublicAdvisoryCorrelationConflictType, "none">;
    entity: string;
    entityType: keyof PublicSignalMatchedEntities;
    severity: "watch" | "review" | "hold";
    sourceFamilies: PublicSignalSourceFamily[];
    sourceIds: string[];
    evidenceIds: string[];
    reason: string;
    analystHold: "quality_review" | "graph_stix_hold" | "source_reliability_review" | "scheduler_cadence_review";
    handoff: {
      agent01SourceReliability: string;
      agent02SchedulerCadence: string;
      agent06EvidenceSearch: string;
      agent07QualityGate: "public_advisory_conflict_review";
      agent08GraphStixHold: "hold_conflicted_public_relationship";
      agent09ApiField: "publicSignalFusion.advisoryCorrelation";
      agent10SloIncidentField: string;
    };
  }>;
  summary: {
    correlatedEntityCount: number;
    conflictCount: number;
    holdCount: number;
    publicChannelOnlyCount: number;
    duplicateSuppressedCount: number;
    staleEvidenceCount: number;
    familyDiversity: number;
  };
  handoffs: {
    agent01SourceReliability: string[];
    agent02SchedulerCadence: string[];
    agent06EvidenceSearch: string[];
    agent07QualityGates: string[];
    agent08GraphStixHolds: string[];
    agent09ApiFields: string[];
    agent10SloIncidentFields: string[];
  };
  guardrails: {
    publicOnly: true;
    noRawRestrictedMaterial: true;
    noLeakedData: true;
    noPrivateChannels: true;
    noAccountAutomation: true;
    noUnsafeUrlsExposed: true;
    piiMinimized: true;
  };
}

export interface PublicSourceFamilyBenchmarksInput {
  query: string;
  entityType?: string;
  selectedSources?: PublicSignalSourceSelectionDto[];
  publicSignalDeltas?: PublicSignalDeltaDto[];
  advisoryConnector?: PublicAdvisorySignalConnectorDto;
  coverageRadar?: EnterpriseSourceCoverageRadarDto;
  sourcePackExpansion?: PublicSourcePackExpansionDto;
  advisoryCorrelation?: PublicAdvisoryCorrelationDto;
  generatedAt?: string;
}

export interface PublicSourceFamilyBenchmarksDto {
  schemaVersion: "ti.public_source_family_benchmarks.v1";
  generatedAt: string;
  query: string;
  queryClass: string;
  status: "ready" | "partial" | "searching" | "needs_expansion" | "hold";
  rows: Array<{
    family: PublicSignalSourceFamily;
    selectedSourceCount: number;
    candidateSourceCount: number;
    usefulSignalCount: number;
    coverageScore: number;
    freshnessScore: number;
    contradictionRate: number;
    duplicateRate: number;
    parserReadiness: number;
    actorCampaignCveRichness: number;
    evidenceYield: number;
    benchmarkGrade: "strong" | "usable" | "thin" | "missing" | "hold";
    status: "ready" | "partial" | "searching" | "needs_expansion" | "hold";
    recommendedAction: "none" | "add_source_family" | "promote_source_pack_candidate" | "repair_parser" | "raise_cadence" | "dedupe_sources" | "contradiction_review";
    relatedSourceIds: string[];
    relatedSignalIds: string[];
  }>;
  queryClassCoverage: {
    requiredFamilies: PublicSignalSourceFamily[];
    coveredFamilies: PublicSignalSourceFamily[];
    missingFamilies: PublicSignalSourceFamily[];
    diversityScore: number;
    usefulSignalCount: number;
    canAnswerImmediately: boolean;
    unknownQuerySearching: boolean;
    partialReason?: string;
  };
  expansionRecommendations: Array<{
    id: string;
    family: PublicSignalSourceFamily;
    queryClasses: string[];
    priority: "low" | "medium" | "high";
    reason: string;
    recommendedAction: "promote_source_pack_candidate" | "add_curated_public_source" | "repair_parser" | "raise_cadence" | "dedupe_or_retire_source" | "contradiction_review";
    sourcePackCandidateIds: string[];
    expectedImpact: {
      coverageGain: number;
      freshnessGain: number;
      evidenceYieldGain: number;
    };
    dryRunOnly: true;
    willMutate: false;
    willStartCrawling: false;
    publicOnly: true;
    unsafeUrlExposed: false;
  }>;
  unknownQueryHandling: {
    noDefaultActorAssumption: true;
    displayState: "ready" | "partial" | "searching";
    allowedSummary: "Searching" | "Partial public coverage" | "Public coverage benchmark ready";
    staleCacheProseAllowed: false;
  };
  handoffs: {
    agent01SourcePortfolio: string[];
    agent02CadenceSlo: string[];
    agent03AdapterCertification: string[];
    agent06EvidenceReplay: string[];
    agent07ActorFreshness: string[];
    agent09ApiFields: string[];
    agent10ReleaseGates: string[];
  };
  guardrails: {
    publicOnly: true;
    dryRunOnly: true;
    noRestrictedCrawling: true;
    noPrivateChannels: true;
    noAccountAutomation: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noUnsafeUrlsExposed: true;
    noDemoDefaults: true;
    noDefaultActorAssumption: true;
    piiMinimized: true;
  };
}

export interface PublicIntelligenceCoveragePlanInput {
  query: string;
  entityType?: string;
  selectedSources?: PublicSignalSourceSelectionDto[];
  publicSignalDeltas?: PublicSignalDeltaDto[];
  advisoryConnector?: PublicAdvisorySignalConnectorDto;
  coverageRadar?: EnterpriseSourceCoverageRadarDto;
  sourcePackExpansion?: PublicSourcePackExpansionDto;
  advisoryCorrelation?: PublicAdvisoryCorrelationDto;
  sourceFamilyBenchmarks?: PublicSourceFamilyBenchmarksDto;
  generatedAt?: string;
}

export interface PublicIntelligenceCoveragePlanDto {
  schemaVersion: "ti.public_intelligence_coverage_plan.v1";
  generatedAt: string;
  query: string;
  queryClass: string;
  status: "ready" | "partial" | "searching" | "needs_expansion" | "hold";
  queryClassSourceMap: Array<{
    queryClass: string;
    requiredFamilies: PublicSignalSourceFamily[];
    coveredFamilies: PublicSignalSourceFamily[];
    missingFamilies: PublicSignalSourceFamily[];
    evidenceYield: number;
    responseState: "ready" | "partial" | "searching" | "hold";
    currentQuery: boolean;
  }>;
  blindSpots: Array<{
    id: string;
    code: "stale_actor_activity" | "source_family_blind_spot" | "contradiction_cluster" | "old_seed_cache_reliance" | "parser_gap" | "no_public_evidence";
    severity: "watch" | "review" | "hold";
    families: PublicSignalSourceFamily[];
    sourceIds: string[];
    evidenceIds: string[];
    reason: string;
    releaseImpact: "none" | "partial_answer_only" | "searching_only" | "hold_public_answer";
  }>;
  safeSourcePackRecommendations: Array<{
    id: string;
    family: PublicSignalSourceFamily;
    sourcePackCandidateIds: string[];
    priority: "low" | "medium" | "high";
    action: "promote_source_pack_candidate" | "add_curated_public_source" | "repair_parser" | "raise_cadence" | "dedupe_or_retire_source" | "contradiction_review";
    expectedQueryClasses: string[];
    dryRunOnly: true;
    willMutate: false;
    willStartCrawling: false;
    unsafeUrlExposed: false;
  }>;
  responsiveness: {
    initialContext: "ready" | "partial" | "searching" | "hold";
    refreshAfterSeconds: 3;
    incrementalEvidenceExpected: boolean;
    staleCacheCopyAllowed: false;
    demoFallbackAllowed: false;
    defaultActorAssumptionAllowed: false;
  };
  handoffs: {
    agent01SourcePortfolio: string[];
    agent02SchedulerCadence: string[];
    agent03AdapterCertification: string[];
    agent06EvidenceReplay: string[];
    agent07AnswerFreshness: string[];
    agent09ApiFields: string[];
    agent10ReleaseGates: string[];
  };
  guardrails: {
    publicOnly: true;
    dryRunOnly: true;
    approvedPublicSourcesPrioritized: true;
    metadataOnlyPublicChannelHandoffs: true;
    noRestrictedCollection: true;
    noPrivateChannels: true;
    noAccountAutomation: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noRawUrlsExposed: true;
    noDemoDefaults: true;
    noDefaultActorAssumption: true;
    noStaleCacheCopy: true;
    piiMinimized: true;
  };
}

export interface PublicFreshnessGapRemediationInput {
  query: string;
  entityType?: string;
  selectedSources?: PublicSignalSourceSelectionDto[];
  publicSignalDeltas?: PublicSignalDeltaDto[];
  coveragePlan?: PublicIntelligenceCoveragePlanDto;
  sourceFamilyBenchmarks?: PublicSourceFamilyBenchmarksDto;
  advisoryCorrelation?: PublicAdvisoryCorrelationDto;
  sourcePackExpansion?: PublicSourcePackExpansionDto;
  generatedAt?: string;
}

export interface PublicFreshnessGapRemediationDto {
  schemaVersion: "ti.public_freshness_gap_remediation.v1";
  generatedAt: string;
  query: string;
  queryClass: string;
  status: "ready" | "partial" | "searching" | "activation_needed" | "hold";
  answerState: {
    publicState: "ready" | "partial" | "searching" | "hold";
    compactReason: string;
    refreshAfterSeconds: 3;
    evidenceReady: boolean;
    activationNeeded: boolean;
    staleOnlyRecentActivityRejected: boolean;
  };
  highVolumeActorFreshness: {
    matchedActor?: string;
    trackedActors: string[];
    targetFreshnessSeconds: number;
    latestEvidenceAt?: string;
    latestEvidenceAgeSeconds?: number;
    state: "fresh" | "stale" | "searching" | "not_applicable";
    staleRecentActivityPromotionAllowed: false;
  };
  remediationActions: Array<{
    id: string;
    owner: "agent01_source_activation" | "agent02_scheduler_cadence" | "agent03_parser_repair" | "agent06_evidence_coverage" | "agent07_quality_hold" | "agent08_graph_pivot" | "agent09_api_field";
    action: "activate_public_source_family" | "raise_cadence" | "repair_parser_or_capture" | "replay_or_verify_evidence" | "hold_answer_quality" | "add_graph_pivot_review" | "expose_status_field";
    queryClass: string;
    families: PublicSignalSourceFamily[];
    priority: "low" | "medium" | "high";
    reason: string;
    expectedStateChange: "searching_to_partial" | "partial_to_ready" | "stale_to_partial" | "hold_to_review" | "api_explainability";
    sourcePackCandidateIds: string[];
    dryRunOnly: true;
    willMutate: false;
    willStartCrawling: false;
    unsafeUrlExposed: false;
  }>;
  releaseGate: {
    canPromoteRecentActivity: boolean;
    canPromotePublicFacts: boolean;
    holdReasons: string[];
    requiredBeforeReady: string[];
  };
  queryFixtures: Array<{
    query: string;
    queryClass: string;
    expectedState: "ready" | "partial" | "searching" | "hold";
    requiredFamilies: PublicSignalSourceFamily[];
    staleRecentActivityAllowed: false;
    defaultActorFallbackAllowed: false;
  }>;
  apiFields: {
    publicSignalFusionField: "publicSignalFusion.freshnessGapRemediation";
    stateFields: string[];
    remediationFields: string[];
  };
  guardrails: {
    publicOnly: true;
    dryRunOnly: true;
    noDefaultActorAssumption: true;
    noDemoFallback: true;
    noStaleCacheCopy: true;
    noPrivateChannels: true;
    noAccountAutomation: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noRestrictedRawCollection: true;
    noRawUrlsExposed: true;
    piiMinimized: true;
  };
}

export interface PublicIntelligenceQueryMatrixInput {
  query: string;
  entityType?: string;
  coveragePlan?: PublicIntelligenceCoveragePlanDto;
  sourceFamilyBenchmarks?: PublicSourceFamilyBenchmarksDto;
  freshnessGapRemediation?: PublicFreshnessGapRemediationDto;
  advisoryCorrelation?: PublicAdvisoryCorrelationDto;
  generatedAt?: string;
}

export interface PublicIntelligenceQueryMatrixDto {
  schemaVersion: "ti.public_intelligence_query_matrix.v1";
  generatedAt: string;
  query: string;
  currentQueryClass: string;
  status: "ready" | "partial" | "searching" | "hold";
  rows: Array<{
    query: string;
    queryClass: string;
    currentQuery: boolean;
    sourceFamilies: {
      required: PublicSignalSourceFamily[];
      covered: PublicSignalSourceFamily[];
      missing: PublicSignalSourceFamily[];
      diversityScore: number;
    };
    scores: {
      coverage: number;
      freshness: number;
      evidenceYield: number;
      contradictionRisk: number;
      parserReadiness: number;
      graphReadiness: number;
      publicAnswerReadiness: number;
      analystActionability: number;
    };
    state: "ready" | "partial" | "searching" | "hold";
    primaryBlockers: string[];
    recommendedNextActions: Array<"activate_source_family" | "raise_cadence" | "repair_parser" | "replay_evidence" | "quality_hold" | "graph_review" | "show_searching">;
    staleRecentActivityAllowed: false;
    defaultActorFallbackAllowed: false;
  }>;
  summary: {
    readyRows: number;
    partialRows: number;
    searchingRows: number;
    heldRows: number;
    weakestQueryClasses: string[];
    nextBestActions: string[];
  };
  apiFields: {
    publicSignalFusionField: "publicSignalFusion.publicIntelligenceQueryMatrix";
    compactRowFields: string[];
  };
  guardrails: {
    publicOnly: true;
    noDefaultActorAssumption: true;
    noDemoFallback: true;
    noStaleCacheCopy: true;
    noPrivateChannels: true;
    noAccountAutomation: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noRestrictedRawCollection: true;
    noRawUrlsExposed: true;
  };
}

export type PublicConflictContradictionType =
  | "actor_attribution_conflict"
  | "alias_ambiguity"
  | "old_campaign_reuse"
  | "stale_infrastructure"
  | "contradictory_victim_claim"
  | "cve_exploitation_disagreement"
  | "sector_country_ambiguity"
  | "edited_deleted_public_channel"
  | "source_family_conflict"
  | "public_channel_only_claim";

export interface PublicConflictContradictionResolverInput {
  query: string;
  entityType?: string;
  advisoryCorrelation?: PublicAdvisoryCorrelationDto;
  publicIntelligenceQueryMatrix?: PublicIntelligenceQueryMatrixDto;
  freshnessGapRemediation?: PublicFreshnessGapRemediationDto;
  coveragePlan?: PublicIntelligenceCoveragePlanDto;
  generatedAt?: string;
}

export interface PublicConflictContradictionResolverDto {
  schemaVersion: "ti.public_conflict_contradiction_resolver.v1";
  generatedAt: string;
  query: string;
  queryClass: string;
  status: "clear" | "review" | "hold" | "searching";
  rows: Array<{
    id: string;
    contradictionType: PublicConflictContradictionType;
    affectedQueryClasses: string[];
    entity: string;
    entityType: string;
    sourceFamilies: PublicSignalSourceFamily[];
    sourceIds: string[];
    evidenceIds: string[];
    freshness: number;
    confidence: number;
    publicAnswerEffect: "allow_with_caveat" | "keep_partial" | "keep_searching" | "hold_fact_promotion";
    graphStixEffect: "eligible_with_caveat" | "graph_review_required" | "stix_export_blocked";
    releaseGate: "pass" | "review" | "hold";
    analystActions: Array<
      | "compare_sources"
      | "request_more_sources"
      | "raise_cadence"
      | "review_graph_relationship"
      | "hold_public_answer"
      | "review_victim_claim"
      | "suppress_stale_repost"
      | "dedupe_source_family"
    >;
    handoffs: {
      agent06Evidence: string[];
      agent07Quality: string[];
      agent08GraphStix: string[];
      agent09ApiFields: string[];
    };
  }>;
  summary: {
    holdCount: number;
    reviewCount: number;
    passCount: number;
    affectedQueryClasses: string[];
    releaseGate: "pass" | "review" | "hold";
  };
  apiFields: {
    publicSignalFusionField: "publicSignalFusion.publicConflictContradictionResolver";
    compactRowFields: string[];
  };
  guardrails: {
    publicOnly: true;
    noRawUrlsExposed: true;
    noRestrictedRawCollection: true;
    noPrivateChannels: true;
    noAccountAutomation: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noDefaultActorAssumption: true;
    noStaleCacheCopy: true;
    piiMinimized: true;
  };
}

export interface PublicSignalDarkwebMetadataInput {
  id: string;
  redactedSiteId: string;
  category: "ransomware_leak" | "forum_metadata" | "market_metadata" | "paste_metadata" | "unknown";
  risk: "low" | "medium" | "high" | "critical";
  liveness: "active" | "intermittent" | "inactive" | "unknown";
  observedAt?: string;
  actors?: string[];
  victims?: string[];
  ttps?: string[];
  countries?: string[];
  sectors?: string[];
  blockedPayloadMarkers?: Array<"raw_url" | "credential" | "dump" | "payload_link" | "private_invite" | "contact_form">;
  metadataOnly: true;
}

export type PublicSignalLiveCollectionIntakeFamily =
  | PublicSignalSourceFamily
  | "source_atlas"
  | "darkweb_metadata";

export interface PublicSignalLiveCollectionLoopInput {
  query: string;
  entityType?: string;
  selectedSources?: PublicSignalSourceSelectionDto[];
  publicSignalDeltas?: PublicSignalDeltaDto[];
  darkwebMetadataSignals?: PublicSignalDarkwebMetadataInput[];
  coveragePlan?: PublicIntelligenceCoveragePlanDto;
  freshnessGapRemediation?: PublicFreshnessGapRemediationDto;
  publicIntelligenceQueryMatrix?: PublicIntelligenceQueryMatrixDto;
  publicConflictContradictionResolver?: PublicConflictContradictionResolverDto;
  generatedAt?: string;
}

export interface PublicSignalLiveCollectionLoopDto {
  schemaVersion: "ti.public_signal_live_collection_loop.v1";
  generatedAt: string;
  query: string;
  queryClass: string;
  status: "ready" | "partial" | "searching" | "held";
  intakeContract: {
    acceptedFamilies: PublicSignalLiveCollectionIntakeFamily[];
    normalizedPayloadOnly: true;
    collectedItemProvenanceRequired: true;
    unsafePayloadFieldsRejected: string[];
    routeVisibleFields: string[];
  };
  normalizedIntake: Array<{
    id: string;
    family: PublicSignalLiveCollectionIntakeFamily;
    sourceId: string;
    sourceRef: string;
    state: "accepted" | "partial" | "searching" | "held" | "rejected";
    evidenceIds: string[];
    redactedSiteIds: string[];
    categoryLabels: string[];
    riskLabels: string[];
    liveness?: "active" | "intermittent" | "inactive" | "unknown";
    matchedHints: Partial<PublicSignalMatchedEntities> & { ttps?: string[] };
    blockedPayloadMarkers: string[];
    scores: {
      freshness: number;
      familyDiversity: number;
      provenanceStrength: number;
      contradictionState: number;
      entitySpecificity: number;
      analystUsefulness: number;
      queryMatch: number;
      final: number;
    };
    penalties: Array<"stale_only" | "generic_summary" | "source_monoculture" | "query_mismatch" | "contradiction_hold" | "metadata_only_hold">;
    provenance: {
      normalizedToCollectedItem: true;
      publicOnly: boolean;
      metadataOnly: boolean;
      safeForApi: true;
      rawUrlExposed: false;
      unsafePayloadExposed: false;
    };
  }>;
  score: {
    overall: number;
    freshness: number;
    familyDiversity: number;
    provenanceStrength: number;
    contradictionState: number;
    entitySpecificity: number;
    analystUsefulness: number;
    queryMatch: number;
    penalties: string[];
  };
  playbook: {
    queryClass: string;
    requiredFamilies: PublicSignalSourceFamily[];
    cadenceHints: string[];
    parserExpectations: string[];
    evidenceRequirements: string[];
    graphStixHandoff: "eligible" | "review_required" | "blocked_until_review" | "not_enough_evidence";
    publicUiStateBehavior: "ready" | "partial_with_gaps" | "searching" | "held";
    missingFamilies: PublicSignalSourceFamily[];
  };
  nextSafeCollectionTasks: Array<{
    id: string;
    owner: "agent01_source_activation" | "agent02_scheduler" | "agent03_adapter_repair" | "agent05_restricted_metadata" | "agent06_evidence_replay" | "agent07_quality" | "agent08_graph_stix" | "agent09_api" | "agent10_release";
    action: "activate_source_family" | "repair_adapter" | "raise_cadence" | "request_restricted_metadata_review" | "replay_evidence" | "review_graph_pivot" | "analyst_review" | "expose_api_state" | "release_gate_watch";
    priority: "low" | "medium" | "high";
    reason: string;
    families: PublicSignalSourceFamily[];
    dryRunOnly: true;
    willMutate: false;
    willStartCrawling: false;
    noUnsafePayload: true;
  }>;
  queryFixtures: Array<{
    name: string;
    query: string;
    queryClass: string;
    expectedState: "ready" | "partial" | "searching" | "held";
    requiredFamilies: PublicSignalSourceFamily[];
    includesDarkwebMetadataHold: boolean;
  }>;
  handoffs: {
    agent01SourceAtlas: string[];
    agent02Scheduler: string[];
    agent03Adapters: string[];
    agent05DarkwebMetadata: string[];
    agent06Evidence: string[];
    agent07Quality: string[];
    agent08GraphStix: string[];
    agent09ApiFields: string[];
    agent10Release: string[];
  };
  guardrails: {
    publicOnly: true;
    safeDarkwebMetadataOnly: true;
    noRawUnsafeUrls: true;
    noCredentials: true;
    noDumps: true;
    noPayloadLinks: true;
    noPrivateChannels: true;
    noAccountAutomation: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noDefaultActorAssumption: true;
    noStaleCacheCopy: true;
    piiMinimized: true;
  };
}

export interface PublicSignalValueImpactInput {
  query: string;
  entityType?: string;
  selectedSources?: PublicSignalSourceSelectionDto[];
  publicSignalDeltas?: PublicSignalDeltaDto[];
  sourcePackExpansion?: PublicSourcePackExpansionDto;
  sourceFamilyBenchmarks?: PublicSourceFamilyBenchmarksDto;
  publicSignalLiveCollectionLoop?: PublicSignalLiveCollectionLoopDto;
  darkwebMetadataSignals?: PublicSignalDarkwebMetadataInput[];
  generatedAt?: string;
}

export interface PublicSignalValueImpactDto {
  schemaVersion: "ti.public_signal_value_impact.v1";
  generatedAt: string;
  query: string;
  queryClass: string;
  status: "improves_answer" | "needs_public_evidence" | "metadata_only_hold" | "no_lift";
  answerImpact: {
    currentReadiness: number;
    projectedWithSourceAtlas: number;
    projectedWithDarkwebMetadata: number;
    projectedWithBoth: number;
    bestLift: number;
    readyStateChange: "none" | "searching_to_partial" | "partial_to_ready" | "held_to_review";
  };
  sourceAtlasImpact: Array<{
    id: string;
    family: PublicSignalSourceFamily;
    candidateRefs: string[];
    missingFamily: boolean;
    projectedLift: number;
    usefulForQueryClasses: string[];
    evidencePrerequisites: string[];
    parserPrerequisites: string[];
    safeActivationAction: "activate_source_family" | "promote_source_pack_candidate" | "repair_parser_before_activation" | "none";
    improvesAnswer: boolean;
  }>;
  darkwebIndexImpact: Array<{
    id: string;
    redactedSiteIds: string[];
    categories: string[];
    riskLabels: string[];
    liveness: Array<"active" | "intermittent" | "inactive" | "unknown">;
    matchedHints: Partial<PublicSignalMatchedEntities> & { ttps?: string[] };
    projectedLift: number;
    reviewState: "metadata_only_context" | "review_required" | "not_relevant";
    improvesTriage: boolean;
    promotesPublicAnswer: false;
  }>;
  gapClosure: Array<{
    queryClass: string;
    requiredFamilies: PublicSignalSourceFamily[];
    coveredFamilies: PublicSignalSourceFamily[];
    missingFamilies: PublicSignalSourceFamily[];
    bestNextFamily?: PublicSignalSourceFamily;
    expectedStateAfterBestAction: "searching" | "partial" | "ready" | "held";
  }>;
  nextBestActions: Array<{
    owner: "agent01_source_atlas" | "agent02_scheduler" | "agent03_adapter" | "agent05_darkweb_index" | "agent06_evidence" | "agent07_quality" | "agent08_graph_stix" | "agent09_api";
    action: "stage_source_atlas_candidate" | "raise_refresh_cadence" | "repair_parser" | "review_metadata_only_context" | "replay_evidence" | "hold_or_caveat_answer" | "review_relationship_export" | "expose_value_lift";
    priority: "low" | "medium" | "high";
    reason: string;
    expectedLift: number;
    dryRunOnly: true;
    willMutate: false;
    noUnsafePayload: true;
  }>;
  guardrails: {
    publicOnlyAnswerPromotion: true;
    darkwebMetadataNeverPromotesPublicAnswer: true;
    noRawUnsafeUrls: true;
    noCredentials: true;
    noDumps: true;
    noPayloadLinks: true;
    noPrivateChannels: true;
    noAccountAutomation: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noDefaultActorAssumption: true;
    noStaleCacheCopy: true;
  };
}

export interface PublicCoverageFreshnessValueInput {
  query: string;
  entityType?: string;
  selectedSources?: PublicSignalSourceSelectionDto[];
  publicSignalDeltas?: PublicSignalDeltaDto[];
  sourcePackExpansion?: PublicSourcePackExpansionDto;
  sourceFamilyBenchmarks?: PublicSourceFamilyBenchmarksDto;
  freshnessGapRemediation?: PublicFreshnessGapRemediationDto;
  publicIntelligenceQueryMatrix?: PublicIntelligenceQueryMatrixDto;
  publicSignalLiveCollectionLoop?: PublicSignalLiveCollectionLoopDto;
  publicSignalValueImpact?: PublicSignalValueImpactDto;
  darkwebMetadataSignals?: PublicSignalDarkwebMetadataInput[];
  generatedAt?: string;
}

export interface PublicCoverageFreshnessValueDto {
  schemaVersion: "ti.public_coverage_freshness_value.v1";
  generatedAt: string;
  query: string;
  queryClass: string;
  status: "ready_value_fresh" | "freshness_improving" | "stale_value_risk" | "coverage_gap" | "held_metadata_only";
  summary: {
    coverageFreshnessScore: number;
    currentAnswerReadiness: number;
    expectedAnswerLift: number;
    staleFamilyCount: number;
    missingFamilyCount: number;
    highValueActorFreshnessMet: boolean;
    publicEvidenceReady: boolean;
    darkwebMetadataOnlyHold: boolean;
  };
  familyFreshness: Array<{
    family: PublicSignalSourceFamily;
    requiredForQuery: boolean;
    selectedSourceCount: number;
    usefulSignalCount: number;
    latestEvidenceAgeDays: number | "unknown";
    targetFreshnessDays: number;
    freshnessScore: number;
    coverageScore: number;
    parserReadiness: number;
    expectedAnswerLift: number;
    state: "fresh" | "aging" | "stale" | "missing" | "held";
    nextAction: "none" | "raise_cadence" | "activate_source_family" | "repair_parser" | "replay_evidence" | "quality_hold";
    sourceRefs: string[];
    signalRefs: string[];
  }>;
  queryClassFreshness: Array<{
    queryClass: string;
    currentQuery: boolean;
    requiredFamilies: PublicSignalSourceFamily[];
    coveredFamilies: PublicSignalSourceFamily[];
    missingFamilies: PublicSignalSourceFamily[];
    freshnessScore: number;
    publicAnswerReadiness: number;
    canImprovePublicAnswer: boolean;
    bestNextFamily?: PublicSignalSourceFamily;
  }>;
  sourceAtlasFreshnessImpact: Array<{
    id: string;
    family: PublicSignalSourceFamily;
    candidateRefs: string[];
    expectedFreshnessGain: number;
    expectedEvidenceYieldGain: number;
    expectedAnswerLift: number;
    parserReady: boolean;
    activationState: "ready_to_stage" | "needs_parser_repair" | "metadata_only" | "blocked_or_stale";
    safeForPublicPromotion: boolean;
  }>;
  highValueCoverage: Array<{
    entity: string;
    entityType: "actor" | "ransomware" | "query_entity";
    matchedCurrentQuery: boolean;
    state: "fresh" | "stale" | "searching" | "not_applicable";
    targetFreshnessDays: number;
    latestEvidenceAgeDays?: number | "unknown";
    coveredFamilies: PublicSignalSourceFamily[];
    missingFamilies: PublicSignalSourceFamily[];
    nextAction: "none" | "raise_cadence" | "activate_source_family" | "replay_evidence";
  }>;
  staleRisk: {
    staleOnlyRecentActivityRejected: boolean;
    staleFamilies: PublicSignalSourceFamily[];
    noEvidenceFamilies: PublicSignalSourceFamily[];
    metadataOnlyFamilies: PublicSignalLiveCollectionIntakeFamily[];
    contradictionHold: boolean;
    releaseBlockers: string[];
  };
  handoffs: {
    agent01SourceAtlas: string[];
    agent02SchedulerCadence: string[];
    agent03AdapterRepair: string[];
    agent05DarkwebMetadata: string[];
    agent06EvidenceReplay: string[];
    agent07Quality: string[];
    agent08GraphStix: string[];
    agent09ApiFields: string[];
    agent10Release: string[];
  };
  guardrails: {
    publicOnly: true;
    darkwebMetadataTriageOnly: true;
    noRawUnsafeUrls: true;
    noCredentials: true;
    noDumps: true;
    noPayloadLinks: true;
    noPrivateChannels: true;
    noAccountAutomation: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noDefaultActorAssumption: true;
    noStaleCacheCopy: true;
    piiMinimized: true;
  };
}

export type ActorSourceCoverageStatus = "ready" | "partial" | "stale" | "metadata_hold" | "coverage_gap" | "unknown_query";
export type ActorFeedPrioritySourceFamily = PublicSignalSourceFamily | "darkweb_metadata";

export interface ActorSourceCoverageMatrixInput {
  query?: string;
  actors?: string[];
  sources: SourceRecord[];
  selectedSources?: PublicSignalSourceSelectionDto[];
  publicSignalDeltas?: PublicSignalDeltaDto[];
  advisoryConnector?: PublicAdvisorySignalConnectorDto;
  darkwebMetadataSignals?: PublicSignalDarkwebMetadataInput[];
  generatedAt?: string;
}

export interface ActorSourceCoverageMatrixDto {
  schemaVersion: "ti.actor_source_coverage_matrix.v1";
  generatedAt: string;
  query?: string;
  actorCount: number;
  status: "ready" | "needs_expansion" | "metadata_hold" | "mixed";
  rows: Array<{
    actor: string;
    actorClass: "apt" | "ransomware" | "financial_crime" | "unknown";
    aliases: string[];
    requiredFamilies: PublicSignalSourceFamily[];
    coveredFamilies: PublicSignalSourceFamily[];
    staleFamilies: PublicSignalSourceFamily[];
    missingFamilies: PublicSignalSourceFamily[];
    blockedRestrictedFamilies: Array<"darkweb_metadata" | "restricted_metadata">;
    coverageStatus: ActorSourceCoverageStatus;
    freshnessExpectationDays: number;
    latestPublicEvidenceAt?: string;
    publicAdvisoryValue: "strong" | "usable" | "thin" | "missing";
    publicBlogNewsValue: "strong" | "usable" | "thin" | "missing";
	    publicChannelValue: "strong" | "usable" | "thin" | "missing";
	    malwareToolFeedValue: "strong" | "usable" | "thin" | "missing";
	    darkMetadataCaveatState: "none" | "metadata_only_context" | "review_required" | "not_applicable";
	    freshnessExpectation: "daily" | "every_3_days" | "weekly" | "biweekly" | "searching_only";
	    sourceFamilyPriorities: Array<{
	      family: ActorFeedPrioritySourceFamily;
	      rank: number;
	      currentState: "fresh" | "stale" | "missing" | "metadata_only" | "not_required";
	      expectedValue: "critical" | "high" | "medium" | "low";
	      cadenceRecommendation: "hourly" | "twice_daily" | "daily" | "twice_weekly" | "weekly" | "metadata_review_only" | "do_not_schedule";
	      fallbackFamily?: ActorFeedPrioritySourceFamily;
	      reason: string;
	    }>;
	    highestValueMissingFamily?: ActorFeedPrioritySourceFamily;
	    nextBestSourceAction: "activate_public_channel" | "activate_public_advisory" | "activate_public_blog_news" | "activate_malware_feed" | "raise_cadence" | "metadata_review" | "keep_searching" | "maintain_current_mix";
	    buyerCaveat: string;
	    expectedTimeToUsefulSignal: "same_day" | "1_3_days" | "3_7_days" | "1_2_weeks" | "unknown_until_sources_added";
	    sourceIds: string[];
	    evidenceIds: string[];
    nextSafeActivationTasks: Array<{
      id: string;
      owner: "agent01_source_activation" | "agent02_scheduler_cadence" | "agent03_adapter_repair" | "agent05_restricted_metadata" | "agent07_quality" | "agent08_graph_stix" | "agent09_api";
      action: "activate_public_source_family" | "raise_cadence" | "repair_parser" | "request_metadata_review" | "hold_stale_answer" | "review_graph_pivot" | "expose_coverage_gap";
      families: PublicSignalSourceFamily[];
      priority: "low" | "medium" | "high";
      reason: string;
      dryRunOnly: true;
      willMutate: false;
      willStartCrawling: false;
      unsafeUrlExposed: false;
    }>;
  }>;
	  compactProductFields: {
	    sourceCoverageGaps: Array<{ actor: string; missingFamilies: PublicSignalSourceFamily[]; coverageStatus: ActorSourceCoverageStatus }>;
	    coverageStatusByActor: Record<string, ActorSourceCoverageStatus>;
	    actorFeedPriorities: Array<{
	      actor: string;
	      coverageStatus: ActorSourceCoverageStatus;
	      freshnessExpectation: ActorSourceCoverageMatrixDto["rows"][number]["freshnessExpectation"];
	      highestValueMissingFamily?: ActorFeedPrioritySourceFamily;
	      nextBestSourceAction: ActorSourceCoverageMatrixDto["rows"][number]["nextBestSourceAction"];
	      buyerCaveat: string;
	      expectedTimeToUsefulSignal: ActorSourceCoverageMatrixDto["rows"][number]["expectedTimeToUsefulSignal"];
	    }>;
	    apifyDatasetFields: string[];
	  };
  handoffs: {
    agent01SourceAtlas: string[];
    agent02Scheduler: string[];
    agent03Adapters: string[];
    agent05RestrictedMetadata: string[];
    agent07Quality: string[];
    agent08GraphStix: string[];
    agent09ApiFields: string[];
  };
  guardrails: {
    publicOnly: true;
    restrictedMetadataOnly: true;
    noPrivateChannels: true;
    noAccountAutomation: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noRawUnsafeUrls: true;
    noLeakedData: true;
    noPayloadLinks: true;
    noActorInteraction: true;
    noDefaultActorAssumption: true;
  };
}

export interface PublicSignalFusionDto {
  generatedAt: string;
  query: string;
  queryTerms: string[];
  status: "ready" | "partial" | "needs_source_activation" | "blocked";
  selectedSources: PublicSignalSourceSelectionDto[];
  suppressed: {
    duplicateUrls: string[];
    duplicateContentHashes: string[];
    unsafeUrls: string[];
    unavailableSourceIds: string[];
  };
  familyCoverage: {
    familiesCovered: PublicSignalSourceFamily[];
    missingFamilies: PublicSignalSourceFamily[];
    diversityScore: number;
    minimumFamiliesForConfidence: number;
  };
  sourceHints: Record<PublicSignalSourceFamily, PublicSignalSourceSelectionDto[]>;
  publicSignalDeltas: PublicSignalDeltaDto[];
  advisoryConnector?: PublicAdvisorySignalConnectorDto;
  analystSourceWorkbench: AnalystPublicSourceWorkbenchDto;
  coverageRadar: EnterpriseSourceCoverageRadarDto;
  sourcePackExpansion: PublicSourcePackExpansionDto;
  advisoryCorrelation: PublicAdvisoryCorrelationDto;
  sourceFamilyBenchmarks: PublicSourceFamilyBenchmarksDto;
  publicIntelligenceCoveragePlan: PublicIntelligenceCoveragePlanDto;
  freshnessGapRemediation: PublicFreshnessGapRemediationDto;
  publicIntelligenceQueryMatrix: PublicIntelligenceQueryMatrixDto;
  publicConflictContradictionResolver: PublicConflictContradictionResolverDto;
  publicSignalLiveCollectionLoop: PublicSignalLiveCollectionLoopDto;
  publicSignalValueImpact: PublicSignalValueImpactDto;
  publicCoverageFreshnessValue: PublicCoverageFreshnessValueDto;
  actorSourceCoverageMatrix: ActorSourceCoverageMatrixDto;
  analystWorkQueue: Array<{
    sourceId: string;
    action: "approve_source" | "review_backoff" | "review_unavailable" | "review_duplicate_pressure" | "add_source_family" | "confirm_public_only_claim";
    reason: string;
    priority: "low" | "medium" | "high";
  }>;
  caveats: string[];
  guardrails: {
    publicOnly: true;
    officialApisOrPublicHttpOnly: true;
    privateJoinsUsed: false;
    accountAutomationUsed: false;
    captchaOrAuthBypassUsed: false;
    inviteOnlyAccessUsed: false;
    rawMediaDownloaded: false;
    unsafeUrlsExposed: false;
    publicChannelOnlyClaimsAreCaveated: true;
    piiMinimized: true;
  };
}

const PUBLIC_SIGNAL_FAMILIES: PublicSignalSourceFamily[] = [
  "public_channel",
  "github_advisory",
  "cert_government",
  "vendor_report",
  "malware_report_feed",
  "public_research_feed",
  "public_social",
  "clear_web"
];

const PROGRAM_BI_DEFAULT_ACTORS = [
  "APT29",
  "APT42",
  "Sandworm",
  "Volt Typhoon",
  "Salt Typhoon",
  "Lazarus",
  "Kimsuky",
  "Charming Kitten",
  "MuddyWater",
  "OilRig",
  "FIN7",
  "TA505",
  "Scattered Spider",
  "LockBit",
  "Akira",
  "Cl0p",
  "Play",
  "BlackSuit",
  "RansomHub",
  "Qilin",
  "Medusa",
  "DragonForce",
  "8Base",
  "Hunters International",
  "BianLian",
  "ALPHV/BlackCat",
  "Royal",
  "Conti legacy",
  "DarkSide/BlackMatter legacy",
  "Unknown Query Control"
];

type ActorCoverageProfile = {
  actor: string;
  actorClass: "apt" | "ransomware" | "financial_crime" | "unknown";
  aliases: string[];
  requiredFamilies: PublicSignalSourceFamily[];
  freshnessExpectationDays: number;
};

function actorCoverageProfile(actor: string): ActorCoverageProfile {
  const normalized = actor.toLowerCase();
  const ransomware = /lockbit|akira|cl0p|play|blacksuit|ransomhub|qilin|medusa|dragonforce|8base|hunters|bianlian|alphv|blackcat|royal|conti|darkside|blackmatter/.test(normalized);
  const financialCrime = /fin7|ta505|scattered spider/.test(normalized);
  const unknown = /unknown|made up|random|control/.test(normalized);
  const aliases = actorCoverageAliases(actor);
  const actorClass: ActorCoverageProfile["actorClass"] = unknown
    ? "unknown"
    : ransomware
      ? "ransomware"
      : financialCrime
        ? "financial_crime"
        : "apt";
  const requiredFamilies: PublicSignalSourceFamily[] = actorClass === "unknown"
    ? ["clear_web", "public_research_feed"]
    : actorClass === "ransomware"
      ? ["public_channel", "vendor_report", "public_research_feed", "clear_web"]
      : ["cert_government", "vendor_report", "public_research_feed", "github_advisory", "clear_web"];
  return {
    actor,
    actorClass,
    aliases,
    requiredFamilies,
    freshnessExpectationDays: actorClass === "ransomware" || actorClass === "financial_crime" ? 14 : 30
  };
}

function actorCoverageAliases(actor: string): string[] {
  const normalized = actor.toLowerCase();
  const aliases = new Map<string, string[]>([
    ["apt29", ["Cozy Bear", "Nobelium", "Midnight Blizzard"]],
    ["apt42", ["Charming Kitten", "Mint Sandstorm"]],
    ["volt typhoon", ["Bronze Silhouette", "Vanguard Panda"]],
    ["scattered spider", ["UNC3944", "Octo Tempest"]],
    ["lockbit", ["LockBit 3.0", "LockBit Black"]],
    ["akira", ["Akira ransomware"]]
  ]);
  return aliases.get(normalized) ?? [];
}

function sourceMatchesActorCoverage(source: SourceRecord, actorTerms: string[]): boolean {
  const haystack = JSON.stringify({
    id: source.id,
    name: source.name,
    url: source.url,
    tags: source.tags,
    description: source.description,
    query: source.query,
    family: source.family
  }).toLowerCase();
  return actorTerms.some((term) => haystack.includes(term));
}

function signalMatchesActorCoverage(delta: PublicSignalDeltaDto, actorTerms: string[]): boolean {
  const haystack = JSON.stringify(delta).toLowerCase();
  return actorTerms.some((term) => haystack.includes(term));
}

function sourceFamilyStaleForActor(source: SourceRecord, profile: ActorCoverageProfile, generatedAt: string): boolean {
  const latest = maxTimestamp([
    source.lastSeenAt,
    source.crawlState?.lastCollectedAt,
    source.health?.lastSuccessAt,
    source.updatedAt
  ]);
  return latest ? ageInDays(latest, generatedAt) > profile.freshnessExpectationDays : false;
}

function actorCoverageStatus(input: {
  actorClass: ActorCoverageProfile["actorClass"];
  coveredFamilies: PublicSignalSourceFamily[];
  missingFamilies: PublicSignalSourceFamily[];
  staleFamilies: PublicSignalSourceFamily[];
  latestAgeDays?: number;
  freshnessExpectationDays: number;
  blockedRestrictedFamilies: Array<"darkweb_metadata" | "restricted_metadata">;
}): ActorSourceCoverageStatus {
  if (input.actorClass === "unknown" && input.coveredFamilies.length === 0) return "unknown_query";
  if (input.blockedRestrictedFamilies.length > 0 && input.coveredFamilies.length === 0) return "metadata_hold";
  if (input.staleFamilies.length > 0 || (input.latestAgeDays !== undefined && input.latestAgeDays > input.freshnessExpectationDays)) return "stale";
  if (input.missingFamilies.length === 0 && input.coveredFamilies.length > 0) return "ready";
  if (input.coveredFamilies.length > 0) return "partial";
  return "coverage_gap";
}

function maxTimestamp(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function ageInDays(value: string, generatedAt: string): number {
  const ageMs = Date.parse(generatedAt) - Date.parse(value);
  return Number.isFinite(ageMs) ? Math.max(0, ageMs / 86_400_000) : Number.POSITIVE_INFINITY;
}

export function buildActorSourceCoverageMatrix(input: ActorSourceCoverageMatrixInput): ActorSourceCoverageMatrixDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const actors = uniqueCleanStrings(input.actors ?? PROGRAM_BI_DEFAULT_ACTORS);
  const selectedBySource = new Map((input.selectedSources ?? []).map((source) => [source.sourceId, source]));
  const advisorySignals = input.advisoryConnector?.rankedSignals ?? [];
  const publicDeltas = [...(input.publicSignalDeltas ?? []), ...advisorySignals];
  const rows = actors.map((actor) => {
    const profile = actorCoverageProfile(actor);
    const actorTerms = [profile.actor, ...profile.aliases].map((value) => value.toLowerCase());
    const matchedSources = input.sources.filter((source) => sourceMatchesActorCoverage(source, actorTerms));
    const matchedDeltas = publicDeltas.filter((delta) => signalMatchesActorCoverage(delta, actorTerms));
    const matchedDarkMetadata = (input.darkwebMetadataSignals ?? []).filter((signal) =>
      signal.actors.some((value) => actorTerms.includes(value.toLowerCase()))
      || actorTerms.some((term) => [...signal.victims, ...signal.sectors, ...signal.countries, ...signal.ttps].join(" ").toLowerCase().includes(term))
    );
    const coveredFamilies = uniqueSignalFamilies([
      ...matchedSources.map((source) => selectedBySource.get(source.id)?.family ?? inferPublicSignalFamily(source)),
      ...matchedDeltas.map((delta) => delta.family)
    ].filter((family) => family !== "public_social" || profile.actorClass !== "unknown"));
    const latestPublicEvidenceAt = maxTimestamp([
      ...matchedSources.flatMap((source) => [source.lastSeenAt, source.crawlState?.lastCollectedAt, source.health?.lastSuccessAt, source.updatedAt]),
      ...matchedDeltas.flatMap((delta) => [delta.observedAt, delta.publishedAt, delta.collectedAt])
    ]);
    const latestAgeDays = latestPublicEvidenceAt ? ageInDays(latestPublicEvidenceAt, generatedAt) : undefined;
    const staleFamilies = uniqueSignalFamilies([
      ...matchedSources
        .filter((source) => sourceFamilyStaleForActor(source, profile, generatedAt))
        .map((source) => selectedBySource.get(source.id)?.family ?? inferPublicSignalFamily(source)),
      ...matchedDeltas
        .filter((delta) => deltaFreshnessDays(delta, generatedAt) > profile.freshnessExpectationDays)
        .map((delta) => delta.family)
    ]);
    const missingFamilies = profile.requiredFamilies.filter((family) => !coveredFamilies.includes(family));
    const blockedRestrictedFamilies = matchedDarkMetadata.length > 0 ? ["darkweb_metadata" as const] : [];
    const status = actorCoverageStatus({
      actorClass: profile.actorClass,
      coveredFamilies,
      missingFamilies,
      staleFamilies,
      latestAgeDays,
      freshnessExpectationDays: profile.freshnessExpectationDays,
      blockedRestrictedFamilies
    });
	    const sourceIds = uniqueCleanStrings([...matchedSources.map((source) => source.id), ...matchedDeltas.map((delta) => delta.sourceId)]);
	    const evidenceIds = uniqueCleanStrings(matchedDeltas.map((delta) => delta.id));
	    const sourceFamilyPriorities = actorFeedSourceFamilyPriorities({
	      actorClass: profile.actorClass,
	      requiredFamilies: profile.requiredFamilies,
	      coveredFamilies,
	      staleFamilies,
	      missingFamilies,
	      blockedRestrictedFamilies
	    });
	    const highestValueMissingFamily = highestValueMissingActorFeedFamily(sourceFamilyPriorities);
	    const nextBestSourceAction = actorFeedNextBestSourceAction({
	      status,
	      highestValueMissingFamily,
	      staleFamilies,
	      blockedRestrictedFamilies
	    });
	    return {
	      actor: profile.actor,
	      actorClass: profile.actorClass,
      aliases: profile.aliases,
      requiredFamilies: profile.requiredFamilies,
      coveredFamilies,
      staleFamilies,
      missingFamilies,
      blockedRestrictedFamilies,
      coverageStatus: status,
      freshnessExpectationDays: profile.freshnessExpectationDays,
      latestPublicEvidenceAt,
      publicAdvisoryValue: familyValueGrade(coveredFamilies, staleFamilies, ["github_advisory", "cert_government"]),
      publicBlogNewsValue: familyValueGrade(coveredFamilies, staleFamilies, ["vendor_report", "public_research_feed", "clear_web"]),
	      publicChannelValue: familyValueGrade(coveredFamilies, staleFamilies, ["public_channel"]),
	      malwareToolFeedValue: familyValueGrade(coveredFamilies, staleFamilies, ["malware_report_feed"]),
	      darkMetadataCaveatState: matchedDarkMetadata.length > 0 ? "metadata_only_context" as const : profile.actorClass === "ransomware" ? "review_required" as const : "not_applicable" as const,
	      freshnessExpectation: actorFeedFreshnessExpectation(profile.actorClass),
	      sourceFamilyPriorities,
	      highestValueMissingFamily,
	      nextBestSourceAction,
	      buyerCaveat: actorFeedBuyerCaveat({
	        actor: profile.actor,
	        actorClass: profile.actorClass,
	        status,
	        highestValueMissingFamily,
	        blockedRestrictedFamilies
	      }),
	      expectedTimeToUsefulSignal: actorFeedExpectedTimeToUsefulSignal({
	        status,
	        actorClass: profile.actorClass,
	        highestValueMissingFamily,
	        staleFamilies
	      }),
	      sourceIds,
	      evidenceIds,
	      nextSafeActivationTasks: actorCoverageActivationTasks({
        actor: profile.actor,
        actorClass: profile.actorClass,
        status,
        missingFamilies,
        staleFamilies,
        blockedRestrictedFamilies
      })
    };
  });
  const sourceCoverageGaps = rows
    .filter((row) => row.coverageStatus !== "ready")
    .map((row) => ({ actor: row.actor, missingFamilies: row.missingFamilies, coverageStatus: row.coverageStatus }));
  const holdRows = rows.filter((row) => row.coverageStatus === "metadata_hold");
  const gapRows = rows.filter((row) => row.coverageStatus === "coverage_gap" || row.coverageStatus === "unknown_query");
  const staleRows = rows.filter((row) => row.coverageStatus === "stale");
  return {
    schemaVersion: "ti.actor_source_coverage_matrix.v1",
    generatedAt,
    query: input.query,
    actorCount: rows.length,
    status: holdRows.length > 0 ? "metadata_hold" : gapRows.length > 0 || staleRows.length > 0 ? "needs_expansion" : rows.every((row) => row.coverageStatus === "ready") ? "ready" : "mixed",
    rows,
	    compactProductFields: {
	      sourceCoverageGaps,
	      coverageStatusByActor: Object.fromEntries(rows.map((row) => [row.actor, row.coverageStatus])),
	      actorFeedPriorities: rows.map((row) => ({
	        actor: row.actor,
	        coverageStatus: row.coverageStatus,
	        freshnessExpectation: row.freshnessExpectation,
	        highestValueMissingFamily: row.highestValueMissingFamily,
	        nextBestSourceAction: row.nextBestSourceAction,
	        buyerCaveat: row.buyerCaveat,
	        expectedTimeToUsefulSignal: row.expectedTimeToUsefulSignal
	      })),
	      apifyDatasetFields: [
	        "sourceCoverageGaps",
	        "coverageStatus",
	        "sourceFamilies",
	        "missingSourceFamilies",
	        "freshnessExpectation",
	        "highestValueMissingFamily",
	        "nextBestSourceAction",
	        "buyerCaveat",
	        "expectedTimeToUsefulSignal",
	        "recommendedCollectionAction"
	      ]
	    },
    handoffs: {
      agent01SourceAtlas: uniqueCleanStrings(rows.flatMap((row) => row.missingFamilies.length ? [`stage_safe_public_sources_for:${row.actor}`] : [])),
      agent02Scheduler: uniqueCleanStrings(rows.flatMap((row) => row.staleFamilies.length ? [`raise_cadence_for:${row.actor}`] : [])),
      agent03Adapters: uniqueCleanStrings(rows.flatMap((row) => row.nextSafeActivationTasks.filter((task) => task.owner === "agent03_adapter_repair").map((task) => task.id))),
      agent05RestrictedMetadata: uniqueCleanStrings(rows.flatMap((row) => row.blockedRestrictedFamilies.length ? [`review_metadata_only_context_for:${row.actor}`] : [])),
      agent07Quality: uniqueCleanStrings(rows.flatMap((row) => row.coverageStatus === "stale" || row.coverageStatus === "metadata_hold" ? [`hold_or_caveat_public_answer_for:${row.actor}`] : [])),
      agent08GraphStix: uniqueCleanStrings(rows.flatMap((row) => row.darkMetadataCaveatState !== "not_applicable" ? [`hold_metadata_only_relationships_for:${row.actor}`] : [])),
      agent09ApiFields: ["publicSignalFusion.actorSourceCoverageMatrix", "sourceCoverageGaps", "coverageStatus"]
    },
    guardrails: {
      publicOnly: true,
      restrictedMetadataOnly: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noRawUnsafeUrls: true,
      noLeakedData: true,
      noPayloadLinks: true,
      noActorInteraction: true,
      noDefaultActorAssumption: true
    }
  };
}

export function buildPublicSignalFusionWorkbench(input: PublicSignalFusionInput): PublicSignalFusionDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryTerms = expandPublicSignalQueryTerms(input.query, input.entityType);
  const previousUrls = new Set((input.previousUrls ?? []).map(normalizeSignalUrl).filter(Boolean));
  const seenUrls = new Set<string>();
  const duplicateUrls = new Set<string>();
  const unsafeUrls = new Set<string>();
  const duplicateContentHashes = new Set<string>();
  const seenContentHashes = new Set<string>();
  const evidenceBySource = groupEvidenceBySource(input.evidence ?? []);

  const candidates = input.sources
    .filter((source) => !input.tenantId || source.tenantId === undefined || source.tenantId === input.tenantId)
    .map((source) => scorePublicSignalSource({
      source,
      queryTerms,
      generatedAt,
      evidence: evidenceBySource.get(source.id) ?? [],
      previousUrls
    }))
    .filter((candidate) => {
      const normalizedUrl = normalizeSignalUrl(candidate.url);
      if (!isSafePublicSignalUrl(candidate.url)) {
        unsafeUrls.add(unsafeSignalUrlRef(candidate.url));
        return false;
      }
      if (normalizedUrl && (seenUrls.has(normalizedUrl) || previousUrls.has(normalizedUrl))) {
        duplicateUrls.add(candidate.url);
        return false;
      }
      if (normalizedUrl) seenUrls.add(normalizedUrl);
      return true;
    });

  const selectedSources = selectDiversePublicSignalSources(candidates, input.maxSelectedSources ?? 12);
  for (const item of selectedSources) {
    const hash = hashContent(`${item.family}:${normalizeSignalUrl(item.url)}:${item.matchedTerms.join("|")}`);
    if (seenContentHashes.has(hash)) duplicateContentHashes.add(hash);
    seenContentHashes.add(hash);
  }

  const selectedFamilies = [...new Set(selectedSources.map((source) => source.family))];
  const evidenceDeltas = buildPublicSignalDeltas({
    evidence: input.evidence ?? [],
    selectedFamiliesBySource: new Map(selectedSources.map((source) => [source.sourceId, source.family])),
    seenContentHashes,
    duplicateContentHashes
  });
  const packDeltas = buildPublicSignalPackDeltas(input.sourcePacks ?? [], queryTerms, generatedAt);
  const advisoryConnector = buildPublicAdvisorySignalConnector({
    query: input.query,
    entityType: input.entityType,
    sources: input.sources,
    signals: input.advisorySignals ?? publicAdvisorySignalsFromSources(input.sources, generatedAt),
    tenantId: input.tenantId,
    generatedAt
  });
  const advisoryDeltas = advisoryConnector.rankedSignals
    .filter((signal) => signal.state !== "duplicate_suppressed" && signal.policyAllowed)
    .map(({ rank: _rank, rankingScore: _rankingScore, sourceFamily: _sourceFamily, stale: _stale, policyAllowed: _policyAllowed, queryMatched: _queryMatched, suppressionReason: _suppressionReason, ...delta }) => delta);
  const publicSignalDeltas = [...evidenceDeltas, ...packDeltas, ...advisoryDeltas].filter((delta) => {
    const normalizedUrl = normalizeSignalUrl(delta.url);
    if (!normalizedUrl || !isSafePublicSignalUrl(delta.url)) {
      unsafeUrls.add(unsafeSignalUrlRef(delta.url));
      return false;
    }
    return true;
  });

  const sourceHints = Object.fromEntries(PUBLIC_SIGNAL_FAMILIES.map((family) => [
    family,
    selectedSources.filter((source) => source.family === family)
  ])) as Record<PublicSignalSourceFamily, PublicSignalSourceSelectionDto[]>;
  const missingFamilies = PUBLIC_SIGNAL_FAMILIES.filter((family) => !selectedFamilies.includes(family));
  const diversityScore = roundMetric(selectedFamilies.length / Math.min(PUBLIC_SIGNAL_FAMILIES.length, 5));
  const unavailableSourceIds = selectedSources
    .filter((source) => source.availability.unavailable || source.availability.takedownOrRetired)
    .map((source) => source.sourceId);
  const analystWorkQueue = buildPublicSignalAnalystWorkQueue(selectedSources, missingFamilies);
  const analystSourceWorkbench = buildAnalystPublicSourceWorkbench({
    query: input.query,
    sources: input.sources,
    selectedSources,
    advisoryConnector,
    suppressed: {
      duplicateUrls: [...duplicateUrls].sort(),
      duplicateContentHashes: [...duplicateContentHashes].sort(),
      unsafeUrls: [...unsafeUrls].sort(),
      unavailableSourceIds
    },
    missingFamilies,
    tenantId: input.tenantId,
    generatedAt
  });
  const coverageRadar = buildEnterpriseSourceCoverageRadar({
    query: input.query,
    entityType: input.entityType,
    sources: input.sources,
    sourcePacks: input.sourcePacks,
    selectedSources,
    advisoryConnector,
    analystSourceWorkbench,
    publicSignalDeltas,
    tenantId: input.tenantId,
    generatedAt
  });
  const sourcePackExpansion = buildPublicSourcePackExpansion({
    query: input.query,
    entityType: input.entityType,
    sources: input.sources,
    sourcePacks: input.sourcePacks ?? [],
    selectedSources,
    generatedAt
  });
  const advisoryCorrelation = buildPublicAdvisoryCorrelation({
    query: input.query,
    entityType: input.entityType,
    advisoryConnector,
    publicSignalDeltas,
    generatedAt
  });
  const sourceFamilyBenchmarks = buildPublicSourceFamilyBenchmarks({
    query: input.query,
    entityType: input.entityType,
    selectedSources,
    publicSignalDeltas,
    advisoryConnector,
    coverageRadar,
    sourcePackExpansion,
    advisoryCorrelation,
    generatedAt
  });
  const publicIntelligenceCoveragePlan = buildPublicIntelligenceCoveragePlan({
    query: input.query,
    entityType: input.entityType,
    selectedSources,
    publicSignalDeltas,
    advisoryConnector,
    coverageRadar,
    sourcePackExpansion,
    advisoryCorrelation,
    sourceFamilyBenchmarks,
    generatedAt
  });
  const freshnessGapRemediation = buildPublicFreshnessGapRemediation({
    query: input.query,
    entityType: input.entityType,
    selectedSources,
    publicSignalDeltas,
    coveragePlan: publicIntelligenceCoveragePlan,
    sourceFamilyBenchmarks,
    advisoryCorrelation,
    sourcePackExpansion,
    generatedAt
  });
  const publicIntelligenceQueryMatrix = buildPublicIntelligenceQueryMatrix({
    query: input.query,
    entityType: input.entityType,
    coveragePlan: publicIntelligenceCoveragePlan,
    sourceFamilyBenchmarks,
    freshnessGapRemediation,
    advisoryCorrelation,
    generatedAt
  });
  const publicConflictContradictionResolver = buildPublicConflictContradictionResolver({
    query: input.query,
    entityType: input.entityType,
    advisoryCorrelation,
    publicIntelligenceQueryMatrix,
    freshnessGapRemediation,
    coveragePlan: publicIntelligenceCoveragePlan,
    generatedAt
  });
  const publicSignalLiveCollectionLoop = buildPublicSignalLiveCollectionLoopDto({
    query: input.query,
    entityType: input.entityType,
    selectedSources,
    publicSignalDeltas,
    darkwebMetadataSignals: input.darkwebMetadataSignals,
    coveragePlan: publicIntelligenceCoveragePlan,
    freshnessGapRemediation,
    publicIntelligenceQueryMatrix,
    publicConflictContradictionResolver,
    generatedAt
  });
  const publicSignalValueImpact = buildPublicSignalValueImpact({
    query: input.query,
    entityType: input.entityType,
    selectedSources,
    publicSignalDeltas,
    sourcePackExpansion,
    sourceFamilyBenchmarks,
    publicSignalLiveCollectionLoop,
    darkwebMetadataSignals: input.darkwebMetadataSignals,
    generatedAt
  });
  const publicCoverageFreshnessValue = buildPublicCoverageFreshnessValue({
    query: input.query,
    entityType: input.entityType,
    selectedSources,
    publicSignalDeltas,
    sourcePackExpansion,
    sourceFamilyBenchmarks,
    freshnessGapRemediation,
    publicIntelligenceQueryMatrix,
    publicSignalLiveCollectionLoop,
    publicSignalValueImpact,
    darkwebMetadataSignals: input.darkwebMetadataSignals,
    generatedAt
  });
  const actorSourceCoverageMatrix = buildActorSourceCoverageMatrix({
    query: input.query,
    sources: input.sources,
    selectedSources,
    publicSignalDeltas,
    advisoryConnector,
    darkwebMetadataSignals: input.darkwebMetadataSignals,
    generatedAt
  });
  const status: PublicSignalFusionDto["status"] = selectedSources.length === 0
    ? "needs_source_activation"
    : selectedSources.every((source) => source.provenance.approvedPublic === false)
      ? "blocked"
      : diversityScore >= 0.6 && publicSignalDeltas.some((delta) => delta.state !== "duplicate_suppressed")
        ? "ready"
        : "partial";

  return {
    generatedAt,
    query: input.query,
    queryTerms,
    status,
    selectedSources,
    suppressed: {
      duplicateUrls: [...duplicateUrls].sort(),
      duplicateContentHashes: [...duplicateContentHashes].sort(),
      unsafeUrls: [...unsafeUrls].sort(),
      unavailableSourceIds
    },
    familyCoverage: {
      familiesCovered: selectedFamilies,
      missingFamilies,
      diversityScore,
      minimumFamiliesForConfidence: 3
    },
    sourceHints,
    publicSignalDeltas,
    advisoryConnector,
    analystSourceWorkbench,
    coverageRadar,
    sourcePackExpansion,
    advisoryCorrelation,
    sourceFamilyBenchmarks,
    publicIntelligenceCoveragePlan,
    freshnessGapRemediation,
    publicIntelligenceQueryMatrix,
    publicConflictContradictionResolver,
    publicSignalLiveCollectionLoop,
    publicSignalValueImpact,
    publicCoverageFreshnessValue,
    actorSourceCoverageMatrix,
    analystWorkQueue,
    caveats: buildPublicSignalCaveats(selectedSources, selectedFamilies, publicSignalDeltas),
    guardrails: {
      publicOnly: true,
      officialApisOrPublicHttpOnly: true,
      privateJoinsUsed: false,
      accountAutomationUsed: false,
      captchaOrAuthBypassUsed: false,
      inviteOnlyAccessUsed: false,
      rawMediaDownloaded: false,
      unsafeUrlsExposed: false,
      publicChannelOnlyClaimsAreCaveated: true,
      piiMinimized: true
    }
  };
}

export function buildPublicAdvisorySignalConnector(input: PublicAdvisorySignalConnectorInput): PublicAdvisorySignalConnectorDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryTerms = expandPublicSignalQueryTerms(input.query, input.entityType);
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const seenDedupeKeys = new Set<string>();
  const duplicateDedupeKeys = new Set<string>();
  const unsafeUrls = new Set<string>();
  const unavailableSignalIds = new Set<string>();
  const policyDisabledSignalIds = new Set<string>();
  const staleSignalIds = new Set<string>();
  const rankedSignals = input.signals
    .filter((signal) => !input.tenantId || sourceById.get(signal.sourceId)?.tenantId === undefined || sourceById.get(signal.sourceId)?.tenantId === input.tenantId)
    .map((signal) => {
      const source = sourceById.get(signal.sourceId);
      const normalizedEntities = normalizeMatchedEntities(signal.matchedEntities);
      const canonicalUrl = signal.canonicalUrl ?? normalizeSignalUrl(signal.url);
      const dedupeKey = publicAdvisoryDedupeKey(signal, canonicalUrl, normalizedEntities);
      const duplicate = seenDedupeKeys.has(dedupeKey);
      seenDedupeKeys.add(dedupeKey);
      if (duplicate) duplicateDedupeKeys.add(dedupeKey);
      const safeUrl = isSafePublicSignalUrl(signal.url);
      if (!safeUrl) unsafeUrls.add(unsafeSignalUrlRef(signal.url));
      const policyAllowed = publicAdvisoryPolicyAllowed(signal, source);
      if (!policyAllowed) policyDisabledSignalIds.add(signal.id);
      const unavailable = signal.state === "unavailable" || source?.status === "disabled" || source?.status === "retired" || source?.status === "rejected";
      if (unavailable) unavailableSignalIds.add(signal.id);
      const stale = publicAdvisoryStale(signal, generatedAt);
      if (stale) staleSignalIds.add(signal.id);
      const outputUrl = safeUrl ? signal.url : unsafeSignalUrlRef(signal.url);
      const outputCanonicalUrl = safeUrl ? canonicalUrl : unsafeSignalUrlRef(canonicalUrl);
      const queryFit = publicAdvisoryQueryFit(signal, queryTerms, normalizedEntities);
      const familyWeight = signal.family === "cert_government" || signal.family === "github_advisory" ? 0.08 : signal.family === "vendor_report" ? 0.05 : 0.03;
      const reliabilityScore = clamp01(signal.reliabilityScore ?? signal.sourceTrust ?? source?.trustScore ?? source?.catalog?.reliability ?? 0.55);
      const freshness = publicAdvisoryFreshness(signal, generatedAt);
      const confidence = clamp01(signal.confidence ?? queryFit * 0.55 + reliabilityScore * 0.35 + familyWeight);
      const rankingScore = clamp01(
        queryFit * 0.38 +
        reliabilityScore * 0.25 +
        confidence * 0.18 +
        freshness * 0.12 +
        familyWeight -
        (duplicate ? 0.4 : 0) -
        (!safeUrl || !policyAllowed ? 0.55 : 0) -
        (unavailable ? 0.3 : 0) -
        (stale ? 0.12 : 0)
      );
      const state: PublicSignalDeltaDto["state"] = duplicate
        ? "duplicate_suppressed"
        : unavailable
          ? "deleted_or_unavailable"
          : signal.state === "edited"
            ? "edited"
            : "new";
      const suppressionReason = duplicate
        ? "duplicate canonical advisory/entity dedupe key"
        : !safeUrl
          ? "unsafe advisory URL suppressed"
          : !policyAllowed
            ? "signal violates public-only connector policy"
            : unavailable
              ? "signal source or advisory is unavailable"
              : undefined;
      return {
        id: `public_signal_delta_${hashContent(`${signal.id}:${dedupeKey}`).slice(0, 16)}`,
        sourceId: signal.sourceId,
        family: signal.family,
        title: signal.title,
        url: outputUrl,
        canonicalUrl: outputCanonicalUrl,
        contentHash: hashContent(normalizeWhitespace(`${signal.title} ${signal.summary ?? ""} ${canonicalUrl} ${JSON.stringify(normalizedEntities)}`)),
        mergeTarget: "clear_web_capture_evidence" as const,
        state,
        confidence: roundMetric(confidence),
        reliabilityScore: roundMetric(reliabilityScore),
        language: signal.language ?? source?.language,
        region: signal.region ?? stringArray(source?.metadata?.regions)[0] ?? stringArray(source?.catalog?.coverage.regions)[0],
        tags: [...new Set([...(signal.tags ?? []), ...(source?.tags ?? [])])].slice(0, 16),
        matchedEntities: normalizedEntities,
        dedupeKey,
        evidenceUrl: outputCanonicalUrl,
        collectedAt: signal.provenance?.collectedAt ?? generatedAt,
        publishedAt: signal.publishedAt,
        observedAt: signal.observedAt ?? signal.updatedAt ?? signal.publishedAt,
        provenance: {
          sourceId: signal.sourceId,
          publicOnly: true as const,
          evidenceBacked: true,
          safeUrl
        },
        rank: 0,
        rankingScore: roundMetric(rankingScore),
        sourceFamily: signal.family,
        stale,
        policyAllowed,
        queryMatched: queryFit > 0,
        suppressionReason
      };
    })
    .sort((left, right) => right.rankingScore - left.rankingScore)
    .map((signal, index): PublicAdvisorySignalConnectorDto["rankedSignals"][number] => ({ ...signal, rank: index + 1 }))
    .slice(0, input.maxSignals ?? 25);
  const usefulSignals = rankedSignals.filter((signal) =>
    signal.state !== "duplicate_suppressed" &&
    signal.policyAllowed &&
    signal.provenance.safeUrl &&
    !signal.suppressionReason &&
    publicSignalHasQueryMatch(signal) &&
    signal.rankingScore >= 0.35
  );
  const summary = publicAdvisoryFamilySummary(rankedSignals);
  const status: PublicAdvisorySignalConnectorDto["status"] = rankedSignals.length === 0
    ? "needs_source_activation"
    : usefulSignals.length === 0 && policyDisabledSignalIds.size > 0
      ? "blocked"
      : usefulSignals.length >= 2 || new Set(usefulSignals.map((signal) => signal.family)).size >= 2
        ? "ready"
        : "partial";
  return {
    generatedAt,
    query: input.query,
    queryTerms,
    status,
    rankedSignals,
    suppressed: {
      duplicateDedupeKeys: [...duplicateDedupeKeys].sort(),
      unsafeUrls: [...unsafeUrls].sort(),
      unavailableSignalIds: [...unavailableSignalIds].sort(),
      policyDisabledSignalIds: [...policyDisabledSignalIds].sort(),
      staleSignalIds: [...staleSignalIds].filter((id): id is string => typeof id === "string").sort()
    },
    sourceFamilySummary: summary,
    fastInitialSummary: {
      queryClass: input.entityType ?? inferPublicAdvisoryQueryClass(input.query),
      topTitles: usefulSignals.slice(0, 3).flatMap((signal) => signal.title ? [signal.title] : []),
      topFamilies: [...new Set(usefulSignals.map((signal) => signal.family))].slice(0, 4),
      usefulSignalCount: usefulSignals.length,
      canAnswerImmediately: usefulSignals.length > 0
    },
    guardrails: {
      publicOnly: true,
      noAuthBypass: true,
      noPrivateRepoAccess: true,
      noCaptchaSolving: true,
      noTermsBypass: true,
      noExploitPayloadDownload: true,
      noLeakedDataRedistribution: true,
      unsafeUrlsExposed: false
    }
  };
}

export function buildPublicAdvisoryCorrelation(input: {
  query: string;
  entityType?: string;
  advisoryConnector: PublicAdvisorySignalConnectorDto;
  publicSignalDeltas: PublicSignalDeltaDto[];
  generatedAt?: string;
}): PublicAdvisoryCorrelationDto {
  type CorrelationItem = {
    delta: PublicSignalDeltaDto;
    entities: PublicSignalMatchedEntities;
    stale: boolean;
    duplicate: boolean;
    editedDeleted: boolean;
  };
  const normalizeEntity = (value: string): string => normalizeWhitespace(value).toLowerCase();
  const deltaFreshness = (delta: PublicSignalDeltaDto, timestamp: string): number => {
    const latest = delta.observedAt ?? delta.publishedAt ?? delta.collectedAt;
    if (!latest) return 0.45;
    const ageMs = Date.parse(timestamp) - Date.parse(latest);
    if (!Number.isFinite(ageMs) || ageMs < 0) return 0.72;
    const days = ageMs / 86_400_000;
    if (days <= 7) return 1;
    if (days <= 30) return 0.78;
    if (days <= 120) return 0.45;
    return 0.18;
  };
  const isDeltaStale = (delta: PublicSignalDeltaDto, timestamp: string): boolean => deltaFreshness(delta, timestamp) < 0.3;
  const minTimestamp = (values: Array<string | undefined>): string | undefined => values
    .filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  const maxTimestamp = (values: Array<string | undefined>): string | undefined => values
    .filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
  const preferredEntity = (items: CorrelationItem[], entityType: keyof PublicSignalMatchedEntities, fallback: string): string =>
    items.flatMap((item) => item.entities[entityType]).find((value) => normalizeEntity(value) === fallback) ?? fallback;
  const conflictRank = (severity: PublicAdvisoryCorrelationDto["conflicts"][number]["severity"]): number =>
    severity === "hold" ? 3 : severity === "review" ? 2 : 1;
  const conflictTypesFor = (
    entityType: keyof PublicSignalMatchedEntities,
    items: CorrelationItem[],
    sourceFamilies: PublicSignalSourceFamily[],
    publicChannelOnly: boolean
  ): PublicAdvisoryCorrelationConflictType[] => {
    const conflicts = new Set<PublicAdvisoryCorrelationConflictType>();
    const actorCount = new Set(items.flatMap((item) => item.entities.actors.map(normalizeEntity))).size;
    const cveCount = new Set(items.flatMap((item) => item.entities.cves.map(normalizeEntity))).size;
    const sectorCount = new Set(items.flatMap((item) => item.entities.sectors.map(normalizeEntity))).size;
    const countryCount = new Set(items.flatMap((item) => item.entities.countries.map(normalizeEntity))).size;
    if ((entityType === "cves" || entityType === "campaigns" || entityType === "malware" || entityType === "tools" || entityType === "victims") && actorCount > 1) conflicts.add("actor_attribution_disagreement");
    if (entityType === "actors" && cveCount > 1 && sourceFamilies.length < 2) conflicts.add("cve_actor_overclaim");
    if (entityType === "cves" && actorCount > 0 && !sourceFamilies.some((family) => family === "github_advisory" || family === "cert_government")) conflicts.add("cve_actor_overclaim");
    if (sectorCount > 1 || countryCount > 1 || ((entityType === "sectors" || entityType === "countries") && sourceFamilies.length < 2)) conflicts.add("sector_country_ambiguity");
    if (items.some((item) => item.stale)) conflicts.add("stale_or_reposted_advisory");
    if (items.some((item) => item.duplicate) || new Set(items.flatMap((item) => item.delta.dedupeKey ? [item.delta.dedupeKey] : [])).size < items.filter((item) => item.delta.dedupeKey).length) conflicts.add("duplicate_vendor_syndication");
    if (items.some((item) => item.editedDeleted && item.delta.family === "public_channel")) conflicts.add("edited_deleted_public_channel");
    if (publicChannelOnly) conflicts.add("public_channel_only_claim");
    return [...conflicts].sort();
  };
  const conflictReason = (
    conflictType: Exclude<PublicAdvisoryCorrelationConflictType, "none">,
    entity: string,
    entityType: keyof PublicSignalMatchedEntities,
    sourceFamilies: PublicSignalSourceFamily[]
  ): string => {
    const familyText = sourceFamilies.join(",");
    if (conflictType === "actor_attribution_disagreement") return `${entityType}:${entity} has conflicting public actor attribution across ${familyText}`;
    if (conflictType === "stale_or_reposted_advisory") return `${entityType}:${entity} includes stale or reposted public advisory evidence`;
    if (conflictType === "duplicate_vendor_syndication") return `${entityType}:${entity} includes duplicate or syndicated public advisory evidence`;
    if (conflictType === "cve_actor_overclaim") return `${entityType}:${entity} has CVE-to-actor claims without enough advisory-family corroboration`;
    if (conflictType === "sector_country_ambiguity") return `${entityType}:${entity} has ambiguous sector or country claims across public sources`;
    if (conflictType === "edited_deleted_public_channel") return `${entityType}:${entity} includes edited or deleted public-channel evidence`;
    return `${entityType}:${entity} is supported only by public-channel metadata`;
  };
  const buildConflict = (input: {
    conflictType: Exclude<PublicAdvisoryCorrelationConflictType, "none">;
    entity: string;
    entityType: keyof PublicSignalMatchedEntities;
    sourceFamilies: PublicSignalSourceFamily[];
    sourceIds: string[];
    evidenceIds: string[];
  }): PublicAdvisoryCorrelationDto["conflicts"][number] => {
    const severity: PublicAdvisoryCorrelationDto["conflicts"][number]["severity"] =
      input.conflictType === "actor_attribution_disagreement" || input.conflictType === "cve_actor_overclaim"
        ? "hold"
        : input.conflictType === "public_channel_only_claim" || input.conflictType === "sector_country_ambiguity"
          ? "review"
          : "watch";
    const analystHold: PublicAdvisoryCorrelationDto["conflicts"][number]["analystHold"] =
      severity === "hold"
        ? "graph_stix_hold"
        : input.conflictType === "duplicate_vendor_syndication"
          ? "source_reliability_review"
          : input.conflictType === "stale_or_reposted_advisory"
            ? "scheduler_cadence_review"
            : "quality_review";
    return {
      id: `public_advisory_conflict_${hashContent(`${input.conflictType}:${input.entityType}:${input.entity}:${input.evidenceIds.join("|")}`).slice(0, 16)}`,
      conflictType: input.conflictType,
      entity: input.entity,
      entityType: input.entityType,
      severity,
      sourceFamilies: input.sourceFamilies,
      sourceIds: input.sourceIds,
      evidenceIds: input.evidenceIds,
      reason: conflictReason(input.conflictType, input.entity, input.entityType, input.sourceFamilies),
      analystHold,
      handoff: {
        agent01SourceReliability: input.conflictType === "duplicate_vendor_syndication" ? "review_duplicate_vendor_syndication_reliability" : "review_public_source_reliability_for_conflict",
        agent02SchedulerCadence: input.conflictType === "stale_or_reposted_advisory" ? "raise_or_replace_stale_public_source_cadence" : "none",
        agent06EvidenceSearch: "index_correlated_public_evidence_ids_for_vector_and_keyword_review",
        agent07QualityGate: "public_advisory_conflict_review",
        agent08GraphStixHold: "hold_conflicted_public_relationship",
        agent09ApiField: "publicSignalFusion.advisoryCorrelation",
        agent10SloIncidentField: severity === "hold" ? "public_advisory_conflict_hold" : "public_advisory_conflict_watch"
      }
    };
  };
  const generatedAt = input.generatedAt ?? nowIso();
  const queryTerms = expandPublicSignalQueryTerms(input.query, input.entityType);
  const correlationItems: CorrelationItem[] = input.publicSignalDeltas
    .filter((delta) => delta.provenance.safeUrl && delta.provenance.publicOnly)
    .map((delta) => ({
      delta,
      entities: normalizeMatchedEntities(delta.matchedEntities),
      stale: isDeltaStale(delta, generatedAt),
      duplicate: delta.state === "duplicate_suppressed",
      editedDeleted: delta.state === "edited" || delta.state === "deleted_or_unavailable"
    }));
  const buckets = new Map<string, CorrelationItem[]>();
  for (const item of correlationItems) {
    for (const [entityType, values] of Object.entries(item.entities) as Array<[keyof PublicSignalMatchedEntities, string[]]>) {
      for (const value of values) {
        const normalizedEntity = normalizeEntity(value);
        const key = `${entityType}:${normalizedEntity}`;
        const bucket = buckets.get(key) ?? [];
        bucket.push(item);
        buckets.set(key, bucket);
      }
    }
  }

  const correlatedEvidence: PublicAdvisoryCorrelationDto["correlatedEvidence"] = [];
  const conflicts: PublicAdvisoryCorrelationDto["conflicts"] = [];
  for (const [key, items] of buckets) {
    const [entityTypeRaw, normalizedEntity] = key.split(":");
    const entityType = entityTypeRaw as keyof PublicSignalMatchedEntities;
    const entity = preferredEntity(items, entityType, normalizedEntity);
    const sourceFamilies = [...new Set(items.map((item) => item.delta.family))].sort();
    const sourceIds = [...new Set(items.map((item) => item.delta.sourceId))].sort();
    const evidenceIds = [...new Set(items.map((item) => item.delta.id))].sort();
    const dedupeKeys = uniqueCleanStrings(items.flatMap((item) => item.delta.dedupeKey ? [item.delta.dedupeKey] : []));
    const firstSeen = minTimestamp(items.flatMap((item) => [item.delta.publishedAt, item.delta.observedAt, item.delta.collectedAt]));
    const lastSeen = maxTimestamp(items.flatMap((item) => [item.delta.observedAt, item.delta.publishedAt, item.delta.collectedAt]));
    const publicChannelOnly = sourceFamilies.length > 0 && sourceFamilies.every((family) => family === "public_channel");
    const conflictTypes = conflictTypesFor(entityType, items, sourceFamilies, publicChannelOnly);
    const freshness = roundMetric(Math.max(0, ...items.map((item) => deltaFreshness(item.delta, generatedAt))));
    const familyDiversityBoost = clamp01(sourceFamilies.length / 4);
    const averageConfidence = items.reduce((total, item) => total + item.delta.confidence, 0) / Math.max(1, items.length);
    const conflictPenalty = conflictTypes.filter((type) => type !== "none").length * 0.14;
    const correlationConfidence = roundMetric(clamp01(averageConfidence * 0.58 + familyDiversityBoost * 0.28 + freshness * 0.14 - conflictPenalty));
    const analystAction: PublicAdvisoryCorrelationDto["correlatedEvidence"][number]["analystAction"] = conflictTypes.some((type) => type === "actor_attribution_disagreement" || type === "cve_actor_overclaim")
      ? "hold_graph_promotion"
      : conflictTypes.some((type) => type !== "none")
        ? "review_conflict"
        : sourceFamilies.length < 2
          ? "request_more_sources"
          : "accept_with_caveat";
    correlatedEvidence.push({
      id: `public_advisory_correlation_${hashContent(`${key}:${evidenceIds.join("|")}`).slice(0, 16)}`,
      entityType,
      entity,
      normalizedEntity,
      sourceFamilies,
      sourceIds,
      evidenceIds,
      firstSeen,
      lastSeen,
      freshness,
      correlationConfidence,
      conflictTypes: conflictTypes.length > 0 ? conflictTypes : ["none"],
      analystAction,
      provenance: {
        publicOnly: true,
        unsafeUrlExposed: false,
        evidenceBacked: items.some((item) => item.delta.provenance.evidenceBacked),
        publicChannelOnly,
        dedupeKeys
      }
    });
    for (const conflictType of conflictTypes.filter((type): type is Exclude<PublicAdvisoryCorrelationConflictType, "none"> => type !== "none")) {
      conflicts.push(buildConflict({
        conflictType,
        entity,
        entityType,
        sourceFamilies,
        sourceIds,
        evidenceIds
      }));
    }
  }

  const duplicateSuppressedCount = input.advisoryConnector.suppressed.duplicateDedupeKeys.length + correlationItems.filter((item) => item.duplicate).length;
  const staleEvidenceCount = input.advisoryConnector.suppressed.staleSignalIds.length + correlationItems.filter((item) => item.stale).length;
  const holdCount = conflicts.filter((conflict) => conflict.severity === "hold").length;
  const familyDiversity = roundMetric(new Set(correlatedEvidence.flatMap((item) => item.sourceFamilies)).size / Math.min(PUBLIC_SIGNAL_FAMILIES.length, 5));
  const status: PublicAdvisoryCorrelationDto["status"] = correlatedEvidence.length === 0
    ? "insufficient_public_evidence"
    : holdCount > 0
      ? "hold"
      : conflicts.length > 0
        ? "needs_review"
        : "ready";

  return {
    schemaVersion: "ti.public_advisory_correlation.v1",
    generatedAt,
    query: input.query,
    queryTerms,
    status,
    correlatedEvidence: correlatedEvidence
      .sort((left, right) => right.correlationConfidence - left.correlationConfidence || left.entity.localeCompare(right.entity))
      .slice(0, 32),
    conflicts: conflicts
      .sort((left, right) => conflictRank(right.severity) - conflictRank(left.severity) || left.entity.localeCompare(right.entity))
      .slice(0, 24),
    summary: {
      correlatedEntityCount: correlatedEvidence.length,
      conflictCount: conflicts.length,
      holdCount,
      publicChannelOnlyCount: correlatedEvidence.filter((item) => item.provenance.publicChannelOnly).length,
      duplicateSuppressedCount,
      staleEvidenceCount,
      familyDiversity
    },
    handoffs: {
      agent01SourceReliability: uniqueCleanStrings(conflicts.map((conflict) => conflict.handoff.agent01SourceReliability)),
      agent02SchedulerCadence: uniqueCleanStrings(conflicts.map((conflict) => conflict.handoff.agent02SchedulerCadence)),
      agent06EvidenceSearch: uniqueCleanStrings(conflicts.map((conflict) => conflict.handoff.agent06EvidenceSearch)),
      agent07QualityGates: conflicts.length > 0 ? ["public_advisory_conflict_review"] : [],
      agent08GraphStixHolds: conflicts.length > 0 ? ["hold_conflicted_public_relationship"] : [],
      agent09ApiFields: ["publicSignalFusion.advisoryCorrelation"],
      agent10SloIncidentFields: uniqueCleanStrings(conflicts.map((conflict) => conflict.handoff.agent10SloIncidentField))
    },
    guardrails: {
      publicOnly: true,
      noRawRestrictedMaterial: true,
      noLeakedData: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noUnsafeUrlsExposed: true,
      piiMinimized: true
    }
  };
}

interface PublicAdvisoryCorrelationItem {
  delta: PublicSignalDeltaDto;
  entities: PublicSignalMatchedEntities;
  stale: boolean;
  duplicate: boolean;
  editedDeleted: boolean;
}

function publicAdvisoryCorrelationConflicts(
  entityType: keyof PublicSignalMatchedEntities,
  items: PublicAdvisoryCorrelationItem[],
  sourceFamilies: PublicSignalSourceFamily[],
  publicChannelOnly: boolean
): PublicAdvisoryCorrelationConflictType[] {
  const conflicts = new Set<PublicAdvisoryCorrelationConflictType>();
  const actorCount = new Set(items.flatMap((item) => item.entities.actors.map(normalizeCorrelationEntity))).size;
  const cveCount = new Set(items.flatMap((item) => item.entities.cves.map(normalizeCorrelationEntity))).size;
  const sectorCount = new Set(items.flatMap((item) => item.entities.sectors.map(normalizeCorrelationEntity))).size;
  const countryCount = new Set(items.flatMap((item) => item.entities.countries.map(normalizeCorrelationEntity))).size;
  if ((entityType === "cves" || entityType === "campaigns" || entityType === "malware" || entityType === "tools" || entityType === "victims") && actorCount > 1) {
    conflicts.add("actor_attribution_disagreement");
  }
  if (entityType === "actors" && cveCount > 1 && sourceFamilies.length < 2) {
    conflicts.add("cve_actor_overclaim");
  }
  if (entityType === "cves" && actorCount > 0 && !sourceFamilies.some((family) => family === "github_advisory" || family === "cert_government")) {
    conflicts.add("cve_actor_overclaim");
  }
  if (sectorCount > 1 || countryCount > 1 || ((entityType === "sectors" || entityType === "countries") && sourceFamilies.length < 2)) {
    conflicts.add("sector_country_ambiguity");
  }
  if (items.some((item) => item.stale)) conflicts.add("stale_or_reposted_advisory");
  if (items.some((item) => item.duplicate) || new Set(items.flatMap((item) => item.delta.dedupeKey ? [item.delta.dedupeKey] : [])).size < items.filter((item) => item.delta.dedupeKey).length) {
    conflicts.add("duplicate_vendor_syndication");
  }
  if (items.some((item) => item.editedDeleted && item.delta.family === "public_channel")) {
    conflicts.add("edited_deleted_public_channel");
  }
  if (publicChannelOnly) conflicts.add("public_channel_only_claim");
  return [...conflicts].sort();
}

function buildPublicAdvisoryCorrelationConflict(input: {
  conflictType: Exclude<PublicAdvisoryCorrelationConflictType, "none">;
  entity: string;
  entityType: keyof PublicSignalMatchedEntities;
  sourceFamilies: PublicSignalSourceFamily[];
  sourceIds: string[];
  evidenceIds: string[];
  items: PublicAdvisoryCorrelationItem[];
}): PublicAdvisoryCorrelationDto["conflicts"][number] {
  const severity: PublicAdvisoryCorrelationDto["conflicts"][number]["severity"] =
    input.conflictType === "actor_attribution_disagreement" || input.conflictType === "cve_actor_overclaim"
      ? "hold"
      : input.conflictType === "public_channel_only_claim" || input.conflictType === "sector_country_ambiguity"
        ? "review"
        : "watch";
  const analystHold: PublicAdvisoryCorrelationDto["conflicts"][number]["analystHold"] =
    severity === "hold"
      ? "graph_stix_hold"
      : input.conflictType === "duplicate_vendor_syndication"
        ? "source_reliability_review"
        : input.conflictType === "stale_or_reposted_advisory"
          ? "scheduler_cadence_review"
          : "quality_review";
  return {
    id: `public_advisory_conflict_${hashContent(`${input.conflictType}:${input.entityType}:${input.entity}:${input.evidenceIds.join("|")}`).slice(0, 16)}`,
    conflictType: input.conflictType,
    entity: input.entity,
    entityType: input.entityType,
    severity,
    sourceFamilies: input.sourceFamilies,
    sourceIds: input.sourceIds,
    evidenceIds: input.evidenceIds,
    reason: publicAdvisoryCorrelationConflictReason(input.conflictType, input),
    analystHold,
    handoff: {
      agent01SourceReliability: input.conflictType === "duplicate_vendor_syndication" ? "review_duplicate_vendor_syndication_reliability" : "review_public_source_reliability_for_conflict",
      agent02SchedulerCadence: input.conflictType === "stale_or_reposted_advisory" ? "raise_or_replace_stale_public_source_cadence" : "none",
      agent06EvidenceSearch: "index_correlated_public_evidence_ids_for_vector_and_keyword_review",
      agent07QualityGate: "public_advisory_conflict_review",
      agent08GraphStixHold: "hold_conflicted_public_relationship",
      agent09ApiField: "publicSignalFusion.advisoryCorrelation",
      agent10SloIncidentField: severity === "hold" ? "public_advisory_conflict_hold" : "public_advisory_conflict_watch"
    }
  };
}

function publicAdvisoryCorrelationConflictReason(
  conflictType: Exclude<PublicAdvisoryCorrelationConflictType, "none">,
  input: Pick<PublicAdvisoryCorrelationDto["conflicts"][number], "entity" | "entityType" | "sourceFamilies" | "sourceIds">
): string {
  const familyText = input.sourceFamilies.join(",");
  switch (conflictType) {
    case "actor_attribution_disagreement":
      return `${input.entityType}:${input.entity} has conflicting public actor attribution across ${familyText}`;
    case "stale_or_reposted_advisory":
      return `${input.entityType}:${input.entity} includes stale or reposted public advisory evidence`;
    case "duplicate_vendor_syndication":
      return `${input.entityType}:${input.entity} includes duplicate or syndicated public advisory evidence`;
    case "cve_actor_overclaim":
      return `${input.entityType}:${input.entity} has CVE-to-actor claims without enough advisory-family corroboration`;
    case "sector_country_ambiguity":
      return `${input.entityType}:${input.entity} has ambiguous sector or country claims across public sources`;
    case "edited_deleted_public_channel":
      return `${input.entityType}:${input.entity} includes edited or deleted public-channel evidence`;
    case "public_channel_only_claim":
      return `${input.entityType}:${input.entity} is supported only by public-channel metadata`;
  }
}

function preferredCorrelationEntity(
  items: PublicAdvisoryCorrelationItem[],
  entityType: keyof PublicSignalMatchedEntities,
  fallback: string
): string {
  return items.flatMap((item) => item.entities[entityType]).find((value) => normalizeCorrelationEntity(value) === fallback) ?? fallback;
}

function normalizeCorrelationEntity(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function publicDeltaFreshness(delta: PublicSignalDeltaDto, generatedAt: string): number {
  const latest = delta.observedAt ?? delta.publishedAt ?? delta.collectedAt;
  if (!latest) return 0.45;
  const ageMs = Date.parse(generatedAt) - Date.parse(latest);
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0.72;
  const days = ageMs / 86_400_000;
  if (days <= 7) return 1;
  if (days <= 30) return 0.78;
  if (days <= 120) return 0.45;
  return 0.18;
}

function publicDeltaStale(delta: PublicSignalDeltaDto, generatedAt: string): boolean {
  return publicDeltaFreshness(delta, generatedAt) < 0.3;
}

function minIso(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
}

function maxIso(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function conflictSeverityRank(severity: PublicAdvisoryCorrelationDto["conflicts"][number]["severity"]): number {
  return severity === "hold" ? 3 : severity === "review" ? 2 : 1;
}

export function buildAnalystPublicSourceWorkbench(input: AnalystPublicSourceWorkbenchInput): AnalystPublicSourceWorkbenchDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryTerms = expandPublicSignalQueryTerms(input.query);
  const selectedBySourceId = new Map((input.selectedSources ?? []).map((source) => [source.sourceId, source]));
  const advisoryBySourceId = groupAdvisorySignalsBySource(input.advisoryConnector?.rankedSignals ?? []);
  const tenantSources = input.sources.filter((source) => !input.tenantId || source.tenantId === undefined || source.tenantId === input.tenantId);
  const decisions: AnalystPublicSourceDecisionDto[] = [];

  for (const source of tenantSources) {
    const scored = selectedBySourceId.get(source.id) ?? scorePublicSignalSource({
      source,
      queryTerms,
      generatedAt,
      evidence: [],
      previousUrls: new Set<string>()
    });
    const advisorySignals = advisoryBySourceId.get(source.id) ?? [];
    const base = {
      source,
      scored,
      generatedAt,
      advisorySignals,
      duplicate: sourceIsDuplicate(source, input.suppressed, advisorySignals),
      parserGap: sourceHasParserGap(source),
      legalRobotsHold: sourceHasLegalRobotsHold(source, generatedAt),
      lowYield: sourceHasLowYield(source, scored, advisorySignals)
    };

    if (scored.provenance.approvedPublic && scored.reliability >= 0.6 && !scored.availability.unavailable) {
      decisions.push(publicSourceDecision(base, "trusted", "source is approved public, reliable, and eligible for advisory/public-signal use"));
    }
    if (advisorySignals.some((signal) => signal.suppressionReason || !signal.provenance.safeUrl)) {
      decisions.push(publicSourceDecision(base, "suppressed", "one or more advisory signals were suppressed before API exposure"));
    }
    if (advisorySignals.some((signal) => signal.mergeTarget === "clear_web_capture_evidence" && signal.state !== "duplicate_suppressed")) {
      decisions.push(publicSourceDecision(base, "merged", "source has mergeable public advisory signals for clear-web capture evidence"));
    }
    if (scored.freshness < 0.3 || advisorySignals.some((signal) => signal.stale)) {
      decisions.push(publicSourceDecision(base, "stale", "source or advisory signal is stale for the query cadence"));
    }
    if (base.duplicate) {
      decisions.push(publicSourceDecision(base, "duplicate", "source URL, content hash, or advisory dedupe key already exists"));
    }
    if (scored.availability.unavailable || scored.availability.takedownOrRetired || advisorySignals.some((signal) => signal.state === "deleted_or_unavailable")) {
      decisions.push(publicSourceDecision(base, "unavailable", "source or public record is unavailable, retired, takedown, or failing"));
    }
    if (scored.availability.editedPublicMessages > 0 || advisorySignals.some((signal) => signal.state === "edited")) {
      decisions.push(publicSourceDecision(base, "edited_deleted", "source has edited or deleted public records that require caveats"));
    }
    if (!scored.provenance.approvedPublic || advisorySignals.some((signal) => !signal.policyAllowed)) {
      decisions.push(publicSourceDecision(base, "policy_disabled", "source or signal is not approved under public-only policy"));
    }
    if (base.parserGap) {
      decisions.push(publicSourceDecision(base, "parser_gap", "source needs parser or adapter repair before reliable extraction"));
    }
    if (base.legalRobotsHold) {
      decisions.push(publicSourceDecision(base, "legal_robots_hold", "source needs legal or robots review before stronger use"));
    }
    if (base.lowYield) {
      decisions.push(publicSourceDecision(base, "low_yield", "source has low query fit, reliability, extraction yield, or intelligence value"));
    }
  }

  for (const family of (input.missingFamilies ?? []).slice(0, 4)) {
    const sourceId = `family:${family}`;
    decisions.push({
      id: `public_source_decision_${hashContent(`${sourceId}:source_pack:${input.query}`).slice(0, 16)}`,
      sourceId,
      sourceName: `Missing ${family} source family`,
      family,
      decision: "low_yield",
      reason: `no selected ${family} source family is available for this query`,
      severity: "review",
      trustScore: 0,
      reliability: 0,
      freshness: 0,
      evidenceYield: 0,
      parserSupport: "unknown",
      publicOnly: true,
      safeUrl: true,
      relatedSignalIds: [],
      handoff: publicSourceDecisionHandoff("low_yield"),
      provenance: {
        sourceId,
        publicOnly: true,
        unsafeUrlExposed: false,
        decisionAt: generatedAt
      }
    });
  }

  const dryRunActions = buildAnalystPublicSourceDryRunActions(decisions);
  const summary = {
    trusted: decisions.filter((decision) => decision.decision === "trusted").length,
    review: decisions.filter((decision) => decision.severity === "review").length,
    hold: decisions.filter((decision) => decision.severity === "hold").length,
    stale: decisions.filter((decision) => decision.decision === "stale").length,
    duplicate: decisions.filter((decision) => decision.decision === "duplicate").length,
    parserGap: decisions.filter((decision) => decision.decision === "parser_gap").length,
    legalRobotsHold: decisions.filter((decision) => decision.decision === "legal_robots_hold").length,
    lowYield: decisions.filter((decision) => decision.decision === "low_yield").length
  };
  const status: AnalystPublicSourceWorkbenchDto["status"] = summary.hold > 0
    ? "hold"
    : summary.review > 0 || dryRunActions.length > 0
      ? "needs_review"
      : "ready";
  return {
    schemaVersion: "ti.public_source_workbench.v1",
    generatedAt,
    query: input.query,
    status,
    decisions,
    dryRunActions,
    summary,
    handoffs: {
      agent01Governance: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent01Governance).filter((item) => item !== "none")),
      agent02Scheduler: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent02Scheduler).filter((item) => item !== "none")),
      agent06EvidenceYield: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent06EvidenceYield).filter((item) => item !== "none")),
      agent07QualityGates: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent07QualityGate).filter((item) => item !== "none")),
      agent09ApiFields: ["publicSignalFusion.analystSourceWorkbench"],
      agent10SloDashboard: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent10SloDashboard).filter((item) => item !== "none"))
    },
    guardrails: {
      publicOnly: true,
      noAuthBypass: true,
      noPrivateRepoAccess: true,
      noCaptchaSolving: true,
      noExploitPayloadDownload: true,
      noLeakedDataRedistribution: true,
      unsafeUrlsExposed: false,
      dryRunOnly: true
    }
  };
}

export function buildEnterpriseSourceCoverageRadar(input: EnterpriseSourceCoverageRadarInput): EnterpriseSourceCoverageRadarDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryClass = input.entityType ?? inferPublicAdvisoryQueryClass(input.query);
  const selectedSources = input.selectedSources ?? [];
  const selectedFamilies = [...new Set(selectedSources.map((source) => source.family))];
  const advisory = input.advisoryConnector;
  const workbench = input.analystSourceWorkbench;
  const usefulSignalCount = advisory?.fastInitialSummary.usefulSignalCount ?? (input.publicSignalDeltas ?? []).filter((delta) => delta.state === "new" || delta.state === "edited").length;
  const familyDiversity = roundMetric(selectedFamilies.length / Math.min(PUBLIC_SIGNAL_FAMILIES.length, 5));
  const gaps: EnterpriseSourceCoverageRadarDto["gaps"] = [];
  const addGap = (
    code: EnterpriseCoverageGapCode,
    label: string,
    severity: EnterpriseSourceCoverageRadarDto["gaps"][number]["severity"],
    scoreImpact: number,
    affectedFamilies: PublicSignalSourceFamily[],
    affectedSourceIds: string[],
    reason: string,
    taskReadyRecommendation: string
  ) => {
    gaps.push({
      id: `coverage_gap_${hashContent(`${input.query}:${code}:${affectedFamilies.join("|")}:${affectedSourceIds.join("|")}`).slice(0, 16)}`,
      code,
      label,
      severity,
      scoreImpact: roundMetric(scoreImpact),
      affectedFamilies,
      affectedSourceIds: [...new Set(affectedSourceIds)].sort(),
      reason,
      taskReadyRecommendation,
      handoff: coverageGapHandoff(code)
    });
  };

  const missingFamilies = PUBLIC_SIGNAL_FAMILIES.filter((family) => !selectedFamilies.includes(family));
  const advisoryFamilies: PublicSignalSourceFamily[] = ["github_advisory", "cert_government", "vendor_report"];
  const missingAdvisoryFamilies = advisoryFamilies.filter((family) => !selectedFamilies.includes(family) && (advisory?.sourceFamilySummary[family]?.selectedCount ?? 0) === 0);
  const staleSourceIds = (workbench?.decisions ?? []).filter((decision) => decision.decision === "stale").map((decision) => decision.sourceId);
  const parserGapSourceIds = (workbench?.decisions ?? []).filter((decision) => decision.decision === "parser_gap").map((decision) => decision.sourceId);
  const duplicateSourceIds = (workbench?.decisions ?? []).filter((decision) => decision.decision === "duplicate").map((decision) => decision.sourceId);

  if (queryClass === "actor" && selectedFamilies.length < 3) {
    addGap("actor_source_family_gap", "Actor source-family diversity is thin", "review", 0.22, missingFamilies.slice(0, 4), [], "actor queries need at least three safe-public source families", "Agent 01 should onboard another advisory/vendor/research family and Agent 10 should watch useful-answer rate.");
  }
  if ((queryClass === "sector" || queryClass === "country" || /energy|finance|health|telecom|norway|china|iran|russia/i.test(input.query)) && !selectedFamilies.some((family) => family === "cert_government" || family === "public_research_feed")) {
    addGap("sector_country_gap", "Sector or country coverage lacks government/research corroboration", "review", 0.18, ["cert_government", "public_research_feed"], selectedSources.map((source) => source.sourceId), "sector and country answers need regional public-source diversity", "Agent 01 should add national CERT/government and public research coverage for this geography or sector.");
  }
  if (staleSourceIds.length > 0) {
    addGap("stale_source_gap", "Stale public sources suppress freshness", "watch", 0.12, [], staleSourceIds, "one or more query-matching sources are stale", "Agent 02 should raise cadence or Agent 01 should replace stale sources with fresher public packs.");
  }
  if (missingAdvisoryFamilies.length > 0) {
    addGap("missing_advisory_family", "Missing advisory source family", "review", 0.2, missingAdvisoryFamilies, [], "not enough GitHub/CERT/vendor advisory coverage is selected", "Agent 01 should promote safe-public advisory sources and Agent 09 should expose this gap on publicSignalFusion.coverageRadar.");
  }
  if ((queryClass === "malware" || queryClass === "malware_tool" || /snake|malware|tool|cobalt|mimikatz/i.test(input.query)) && !selectedFamilies.includes("malware_report_feed")) {
    addGap("missing_malware_tool_feed", "Missing malware/tool feed", "review", 0.18, ["malware_report_feed"], [], "malware/tool query lacks a public malware feed", "Agent 01 should add a public malware/tool feed and Agent 07 should hold tool claims until corroborated.");
  }
  if ((queryClass === "ransomware" || /akira|lockbit|ransom/i.test(input.query)) && usefulSignalCount < 2) {
    addGap("weak_ransomware_coverage", "Weak ransomware/victim coverage", "review", 0.16, ["vendor_report", "cert_government", "public_research_feed"], selectedSources.map((source) => source.sourceId), "ransomware or victim/company query has too few useful public signals", "Agent 06 should monitor evidence yield and Agent 08 should avoid graph promotion until another public family supports the claim.");
  }
  if ((queryClass === "cve" || /\bCVE-\d{4}-\d{4,}\b/i.test(input.query)) && missingAdvisoryFamilies.length > 0) {
    addGap("weak_cve_advisory_coverage", "Weak CVE/advisory coverage", "hold", 0.22, missingAdvisoryFamilies, [], "CVE query lacks multiple advisory families", "Agent 01 should add GitHub/GHSA, CISA/NVD-style, and vendor advisory coverage before strong exploitation claims.");
  }
  if (usefulSignalCount < 1 || familyDiversity < 0.4 || advisory?.fastInitialSummary.canAnswerImmediately === false) {
    addGap("poor_useful_answer_rate", "Poor useful-answer rate", "review", 0.2, missingFamilies.slice(0, 4), [], "current public signals are insufficient for an immediate useful answer", "Agent 10 should track useful-answer SLOs and Agent 01 should prioritize source-pack onboarding.");
  }
  if (parserGapSourceIds.length > 0) {
    addGap("parser_gap", "Parser repair needed for useful public sources", "review", 0.14, [], parserGapSourceIds, "query-matching public sources need parser or adapter repair", "Agent 03 should repair parser support before these sources count toward coverage.");
  }
  if (duplicateSourceIds.length > 0) {
    addGap("duplicate_source_gap", "Duplicate sources reduce useful coverage", "watch", 0.08, [], duplicateSourceIds, "duplicate source/advisory keys are suppressing public evidence", "Agent 06 should merge duplicate evidence and Agent 01 should retire redundant sources.");
  }

  const sourcePackRecommendations = buildCoverageRadarSourcePackRecommendations({
    query: input.query,
    queryClass,
    generatedAt,
    missingFamilies: [...new Set(gaps.flatMap((gap) => gap.affectedFamilies))],
    sourcePacks: input.sourcePacks ?? [],
    sources: input.sources,
    selectedFamilies
  });
  const conflictIndicators = buildCoverageRadarConflictIndicators(advisory?.rankedSignals ?? []);
  const coverageScore = roundMetric(clamp01(1 - gaps.reduce((total, gap) => total + gap.scoreImpact, 0)));
  const status: EnterpriseSourceCoverageRadarDto["status"] = gaps.some((gap) => gap.severity === "hold") || conflictIndicators.some((conflict) => conflict.severity === "hold")
    ? "hold"
    : coverageScore < 0.55 || gaps.some((gap) => gap.severity === "review")
      ? "needs_onboarding"
      : coverageScore < 0.78 || gaps.length > 0
        ? "watch"
        : "healthy";

  return {
    schemaVersion: "ti.enterprise_source_coverage_radar.v1",
    generatedAt,
    query: input.query,
    queryClass,
    status,
    coverageScore,
    gaps,
    sourcePackRecommendations,
    conflictIndicators,
    queryClassUsefulAnswer: {
      usefulSignalCount,
      selectedSourceCount: selectedSources.length,
      familyDiversity,
      canAnswerImmediately: Boolean(advisory?.fastInitialSummary.canAnswerImmediately || usefulSignalCount > 0),
      poorUsefulAnswerRate: gaps.some((gap) => gap.code === "poor_useful_answer_rate")
    },
    handoffs: {
      agent01Onboarding: uniqueCleanStrings(gaps.map((gap) => gap.handoff.agent01Onboarding)),
      agent02SchedulingCadence: uniqueCleanStrings(gaps.map((gap) => gap.handoff.agent02SchedulingCadence)),
      agent03ParserRepair: uniqueCleanStrings(gaps.map((gap) => gap.handoff.agent03ParserRepair)),
      agent06EvidencePersistence: uniqueCleanStrings(gaps.map((gap) => gap.handoff.agent06EvidencePersistence)),
      agent07QualityGates: uniqueCleanStrings([...gaps.map((gap) => gap.handoff.agent07QualityGates), ...conflictIndicators.map((conflict) => conflict.handoff.agent07QualityGate)]),
      agent08GraphPivots: uniqueCleanStrings([...gaps.map((gap) => gap.handoff.agent08GraphPivots), ...conflictIndicators.map((conflict) => conflict.handoff.agent08GraphPivot)]),
      agent09ApiFields: ["publicSignalFusion.coverageRadar"],
      agent10SloMonitoring: uniqueCleanStrings(gaps.map((gap) => gap.handoff.agent10SloMonitoring))
    },
    guardrails: {
      publicOnly: true,
      safePublicOnly: true,
      restrictedMetadataReviewHeldOnly: true,
      noAuthBypass: true,
      noPrivateRepoAccess: true,
      noCaptchaSolving: true,
      noExploitPayloadDownload: true,
      noLeakedDataRedistribution: true,
      unsafeUrlsExposed: false,
      dryRunOnly: true
    }
  };
}

function inferPublicSourcePackQueryClass(query: string, entityType?: string): PublicSourcePackQueryClass {
  const value = `${entityType ?? ""} ${query}`.toLowerCase();
  if (/\bcve-\d{4}-\d{4,}\b|cve|vulnerab|advisory|kev|ghsa/.test(value)) return "cve_advisory";
  if (/ransom|akira|lockbit|alphv|blackcat|clop/.test(value)) return "ransomware";
  if (/malware|tool|snake|cobalt|mimikatz|implant|loader|backdoor/.test(value)) return "malware_tool";
  if (/sector|energy|finance|health|telecom|government|critical infrastructure/.test(value)) return "sector";
  if (/country|norway|china|iran|russia|ukraine|united states|europe/.test(value)) return "country";
  if (/campaign|operation|intrusion set|cluster/.test(value)) return "campaign";
  if (/infrastructure|domain|ip address|asn|botnet|c2|command and control/.test(value)) return "infrastructure";
  if (/victim|company|organization|breach|leak/.test(value)) return "victim_company";
  if (/apt|actor|threat group|cozy bear|turla|volt typhoon|scattered spider/.test(value)) return "apt";
  return "general";
}

function requiredFamiliesForSourcePackQuery(queryClass: PublicSourcePackQueryClass): PublicSignalSourceFamily[] {
  switch (queryClass) {
    case "apt":
    case "campaign":
      return ["vendor_report", "cert_government", "public_research_feed", "public_channel"];
    case "ransomware":
    case "victim_company":
      return ["vendor_report", "cert_government", "public_channel", "public_social"];
    case "cve_advisory":
      return ["github_advisory", "cert_government", "vendor_report", "public_research_feed"];
    case "malware_tool":
    case "infrastructure":
      return ["malware_report_feed", "vendor_report", "public_research_feed", "clear_web"];
    case "country":
    case "sector":
      return ["cert_government", "vendor_report", "public_research_feed", "clear_web"];
    default:
      return ["vendor_report", "cert_government", "public_channel"];
  }
}

function inferSourcePackEntryFamily(entry: TelegramPublicSourcePack["sources"][number]): PublicSignalSourceFamily {
  const value = `${entry.name} ${entry.channelHandle} ${entry.topicTags.join(" ")} ${entry.metadata?.family ?? ""}`.toLowerCase();
  if (/github|ghsa/.test(value)) return "github_advisory";
  if (/cert|cisa|kev|government|gov|ncsc|advisory/.test(value)) return "cert_government";
  if (/vendor|mandiant|microsoft|google|unit 42|crowdstrike|sentinelone|research/.test(value)) return "vendor_report";
  if (/malware|tool|ioc|threatfox|abuse|yara|sigma/.test(value)) return "malware_report_feed";
  if (/social|mastodon|bluesky|x-twitter|twitter/.test(value)) return "public_social";
  if (/clear[_ -]?web|rss|blog|html|report/.test(value)) return "clear_web";
  return "public_channel";
}

function inferSourcePackEntryQueryClasses(entry: TelegramPublicSourcePack["sources"][number]): PublicSourcePackQueryClass[] {
  const classes = new Set<PublicSourcePackQueryClass>();
  const value = sourcePackEntrySearchableText(entry);
  if (entry.focus.actors.length > 0 || /\bapt\b|actor|threat group|intrusion set/.test(value)) classes.add("apt");
  if (entry.focus.ransomware.length > 0 || /ransom|victim|leak/.test(value)) classes.add("ransomware");
  if (entry.focus.cves.length > 0 || /\bcve-\d{4}-\d{4,}\b|ghsa|kev|advisory/.test(value)) classes.add("cve_advisory");
  if (/malware|tool|implant|loader|backdoor|yara|sigma/.test(value)) classes.add("malware_tool");
  if (entry.focus.countries.length > 0 || /country|geopolitical|region/.test(value)) classes.add("country");
  if (entry.focus.sectors.length > 0 || /sector|industry|critical infrastructure/.test(value)) classes.add("sector");
  if (/campaign|operation|cluster/.test(value)) classes.add("campaign");
  if (/infrastructure|domain|ip address|asn|botnet|c2|ioc/.test(value)) classes.add("infrastructure");
  if (entry.focus.victims.length > 0 || /victim|company|organization/.test(value)) classes.add("victim_company");
  if (classes.size === 0) classes.add("general");
  return [...classes].sort();
}

function sourcePackEntrySearchableText(entry: TelegramPublicSourcePack["sources"][number]): string {
  return [
    entry.name,
    entry.channelHandle,
    entry.legalNotes,
    ...entry.topicTags,
    ...entry.focus.actors,
    ...entry.focus.ransomware,
    ...entry.focus.cves,
    ...entry.focus.victims,
    ...entry.focus.sectors,
    ...entry.focus.countries
  ].join(" ").toLowerCase();
}

function normalizeSourcePackHandle(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function sourcePackEntryFreshness(entry: TelegramPublicSourcePack["sources"][number], generatedAt: string): number {
  const reviewedAt = entry.compliance.termsReviewedAt;
  if (!reviewedAt) return entry.approvalState === "approved" ? 0.55 : 0.35;
  const age = ageDays(reviewedAt, generatedAt);
  if (age === "unknown") return 0.35;
  if (age <= 30) return 0.95;
  if (age <= 90) return 0.8;
  if (age <= 180) return 0.62;
  if (age <= 365) return 0.42;
  return 0.2;
}

function isSourcePackEntryStale(entry: TelegramPublicSourcePack["sources"][number], generatedAt: string): boolean {
  const age = entry.compliance.termsReviewedAt ? ageDays(entry.compliance.termsReviewedAt, generatedAt) : "unknown";
  return age === "unknown" ? false : age > 365;
}

function sourcePackEntryYield(entry: TelegramPublicSourcePack["sources"][number]): number {
  const focusCount = entry.focus.actors.length +
    entry.focus.ransomware.length +
    entry.focus.cves.length +
    entry.focus.victims.length +
    entry.focus.sectors.length +
    entry.focus.countries.length +
    Math.min(4, entry.topicTags.length);
  return roundMetric(clamp01(focusCount / 14));
}

function sourcePackEntryParserCapability(
  entry: TelegramPublicSourcePack["sources"][number],
  family: PublicSignalSourceFamily
): PublicSourcePackExpansionDto["candidates"][number]["parserCapability"] {
  const parserStatus = String(entry.metadata?.parserStatus ?? "").toLowerCase();
  if (parserStatus === "needs_repair" || parserStatus === "missing") return "needs_parser";
  if (entry.compliance.approvalScope === "metadata_only") return "metadata_only";
  if (family === "public_channel" || family === "cert_government" || family === "github_advisory") return "ready";
  return parserStatus === "ready" ? "ready" : "unknown";
}

function sourcePackOnboardingRecommendation(
  entry: TelegramPublicSourcePack["sources"][number],
  parserCapability: PublicSourcePackExpansionDto["candidates"][number]["parserCapability"],
  staleSuppressed: boolean,
  duplicateSuppressed: boolean
): PublicSourcePackExpansionDto["candidates"][number]["onboardingRecommendation"] {
  if (entry.approvalState === "disabled" || entry.compliance.approvalScope === "disabled") return "blocked";
  if (duplicateSuppressed) return "suppress_duplicate";
  if (staleSuppressed) return "suppress_stale";
  if (parserCapability === "needs_parser") return "repair_parser_before_activation";
  if (entry.approvalState === "approved" && parserCapability === "ready") return "activate_approved_public_source";
  return "review_public_source";
}

export function buildPublicSourcePackExpansion(input: {
  query: string;
  entityType?: string;
  sources: SourceRecord[];
  sourcePacks: TelegramPublicSourcePack[];
  selectedSources?: PublicSignalSourceSelectionDto[];
  generatedAt?: string;
}): PublicSourcePackExpansionDto {
  function localInferPublicSourcePackQueryClass(query: string, entityType?: string): PublicSourcePackQueryClass {
    const value = `${entityType ?? ""} ${query}`.toLowerCase();
    if (/\bcve-\d{4}-\d{4,}\b|cve|vulnerab|advisory|kev|ghsa/.test(value)) return "cve_advisory";
    if (/ransom|akira|lockbit|alphv|blackcat|clop/.test(value)) return "ransomware";
    if (/malware|tool|snake|cobalt|mimikatz|implant|loader|backdoor/.test(value)) return "malware_tool";
    if (/sector|energy|finance|health|telecom|government|critical infrastructure/.test(value)) return "sector";
    if (/country|norway|china|iran|russia|ukraine|united states|europe/.test(value)) return "country";
    if (/campaign|operation|intrusion set|cluster/.test(value)) return "campaign";
    if (/infrastructure|domain|ip address|asn|botnet|c2|command and control/.test(value)) return "infrastructure";
    if (/victim|company|organization|breach|leak/.test(value)) return "victim_company";
    if (/apt|actor|threat group|cozy bear|turla|volt typhoon|scattered spider/.test(value)) return "apt";
    return "general";
  }

  function localRequiredFamiliesForSourcePackQuery(queryClass: PublicSourcePackQueryClass): PublicSignalSourceFamily[] {
    switch (queryClass) {
      case "apt":
      case "campaign":
        return ["vendor_report", "cert_government", "public_research_feed", "public_channel"];
      case "ransomware":
      case "victim_company":
        return ["vendor_report", "cert_government", "public_channel", "public_social"];
      case "cve_advisory":
        return ["github_advisory", "cert_government", "vendor_report", "public_research_feed"];
      case "malware_tool":
      case "infrastructure":
        return ["malware_report_feed", "vendor_report", "public_research_feed", "clear_web"];
      case "country":
      case "sector":
        return ["cert_government", "vendor_report", "public_research_feed", "clear_web"];
      default:
        return ["vendor_report", "cert_government", "public_channel"];
    }
  }

  const generatedAt = input.generatedAt ?? nowIso();
  const queryTerms = expandPublicSignalQueryTerms(input.query, input.entityType);
  const queryClass = localInferPublicSourcePackQueryClass(input.query, input.entityType);
  const requiredFamilies = localRequiredFamiliesForSourcePackQuery(queryClass);
  const coveredFamilies = [...new Set((input.selectedSources ?? []).map((source) => source.family))];
  const missingFamilies = requiredFamilies.filter((family) => !coveredFamilies.includes(family));
  const existingSourceIds = new Set(input.sources.map((source) => source.id));
  const seenDedupeKeys = new Set<string>();
  const duplicateDedupeKeys = new Set<string>();
  const staleSourceIds = new Set<string>();
  const blockedSourceIds = new Set<string>();
  const unsafeUrlHashes = new Set<string>();
  const candidates: PublicSourcePackExpansionDto["candidates"] = [];

  for (const pack of input.sourcePacks) {
    for (const entry of pack.sources) {
      const family = inferSourcePackEntryFamily(entry);
      const candidateClasses = inferSourcePackEntryQueryClasses(entry);
      const publicUrlHash = hashContent(normalizeSignalUrl(entry.publicUrl) || entry.publicUrl).slice(0, 16);
      const dedupeKey = `pack:${family}:${normalizeSourcePackHandle(entry.channelHandle)}:${publicUrlHash}`;
      const duplicateSuppressed = seenDedupeKeys.has(dedupeKey) || existingSourceIds.has(entry.id);
      seenDedupeKeys.add(dedupeKey);
      if (duplicateSuppressed) duplicateDedupeKeys.add(dedupeKey);
      if (!isSafePublicSignalUrl(entry.publicUrl)) {
        unsafeUrlHashes.add(`unsafe_url_hash:${hashContent(entry.publicUrl).slice(0, 16)}`);
        continue;
      }

      const staleSuppressed = isSourcePackEntryStale(entry, generatedAt);
      if (staleSuppressed) staleSourceIds.add(entry.id);
      if (entry.approvalState === "disabled" || entry.compliance.approvalScope === "disabled") blockedSourceIds.add(entry.id);

      const searchable = sourcePackEntrySearchableText(entry);
      const termMatches = queryTerms.filter((term) => searchable.includes(term.toLowerCase()));
      const classFit = candidateClasses.includes(queryClass) ? 1 : candidateClasses.includes("general") ? 0.35 : 0;
      const termFit = queryTerms.length === 0 ? 0.4 : termMatches.length / queryTerms.length;
      const familyDiversityGain = missingFamilies.includes(family) ? 1 : coveredFamilies.includes(family) ? 0 : 0.45;
      const trustScore = roundMetric(clamp01(entry.trustScore ?? (entry.approvalState === "approved" ? 0.72 : 0.48)));
      const freshness = sourcePackEntryFreshness(entry, generatedAt);
      const expectedEvidenceYield = sourcePackEntryYield(entry);
      const parserCapability = sourcePackEntryParserCapability(entry, family);
      const score = roundMetric(clamp01(
        classFit * 0.28 +
        termFit * 0.2 +
        familyDiversityGain * 0.18 +
        trustScore * 0.16 +
        freshness * 0.1 +
        expectedEvidenceYield * 0.08 -
        (staleSuppressed ? 0.25 : 0) -
        (duplicateSuppressed ? 0.3 : 0) -
        (blockedSourceIds.has(entry.id) ? 0.5 : 0)
      ));

      candidates.push({
        id: `source_pack_expansion_${hashContent(`${pack.id}:${entry.id}:${queryClass}:${dedupeKey}`).slice(0, 16)}`,
        sourcePackId: pack.id,
        sourcePackName: pack.name,
        sourceId: entry.id,
        name: entry.name,
        family,
        queryClasses: candidateClasses,
        publicUrlHash,
        dedupeKey,
        score,
        trustScore,
        freshness,
        familyDiversityGain,
        expectedEvidenceYield,
        staleSuppressed,
        duplicateSuppressed,
        parserCapability,
        onboardingRecommendation: sourcePackOnboardingRecommendation(entry, parserCapability, staleSuppressed, duplicateSuppressed),
        rateLimit: {
          minIntervalSeconds: entry.rateLimit.minIntervalSeconds,
          pageSize: entry.rateLimit.pageSize,
          expectedRequestsPerHour: entry.rateLimit.expectedRequestsPerHour
        },
        provenance: {
          sourcePackId: pack.id,
          sourceId: entry.id,
          publicOnly: true,
          approvalState: entry.approvalState,
          approvalScope: entry.compliance.approvalScope,
          retentionClass: entry.retentionClass,
          unsafeUrlExposed: false
        }
      });
    }
  }

  const actionableCandidates = candidates
    .filter((candidate) => !candidate.duplicateSuppressed && !candidate.staleSuppressed && candidate.onboardingRecommendation !== "blocked")
    .sort((left, right) => right.score - left.score || right.familyDiversityGain - left.familyDiversityGain || left.sourceId.localeCompare(right.sourceId));
  const status: PublicSourcePackExpansionDto["status"] = blockedSourceIds.size > 0 && actionableCandidates.length === 0
    ? "blocked"
    : missingFamilies.length > 0 || actionableCandidates.some((candidate) => candidate.onboardingRecommendation !== "activate_approved_public_source")
      ? "needs_onboarding"
      : actionableCandidates.some((candidate) => candidate.parserCapability !== "ready")
        ? "needs_review"
        : "ready";

  return {
    schemaVersion: "ti.public_source_pack_expansion.v1",
    generatedAt,
    query: input.query,
    queryClass,
    status,
    familyCoverage: {
      requiredFamilies,
      coveredFamilies,
      missingFamilies,
      diversityScore: roundMetric(coveredFamilies.length / Math.max(1, requiredFamilies.length))
    },
    candidates: actionableCandidates.slice(0, 16),
    suppressed: {
      staleSourceIds: [...staleSourceIds].sort(),
      duplicateDedupeKeys: [...duplicateDedupeKeys].sort(),
      blockedSourceIds: [...blockedSourceIds].sort(),
      unsafeUrlHashes: [...unsafeUrlHashes].sort()
    },
    handoffs: {
      agent01Onboarding: actionableCandidates.length > 0 ? ["review_source_pack_expansion_candidates"] : [],
      agent02SchedulingCadence: actionableCandidates.some((candidate) => candidate.rateLimit.minIntervalSeconds > 300) ? ["schedule_low_cadence_sources_with_backpressure"] : ["apply_source_pack_rate_limits_before_activation"],
      agent03ParserRepair: uniqueCleanStrings(actionableCandidates.filter((candidate) => candidate.parserCapability === "needs_parser").map(() => "repair_parser_before_source_activation")),
      agent06EvidencePersistence: ["persist_dedupe_key_and_public_url_hash_with_capture_provenance"],
      agent07QualityGates: ["treat_source_pack_only_claims_as_partial_until_evidence_backed"],
      agent09ApiFields: ["publicSignalFusion.sourcePackExpansion"],
      agent10SloMonitoring: ["track_source_pack_activation_yield_and_stale_suppression"]
    },
    guardrails: {
      publicOnly: true,
      dryRunOnly: true,
      noPrivateChannelAccess: true,
      noAccountAutomation: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noExploitPayloadDownload: true,
      noLeakedDataRedistribution: true,
      unsafeUrlsExposed: false
    }
  };
}

export function buildPublicSourceFamilyBenchmarks(input: PublicSourceFamilyBenchmarksInput): PublicSourceFamilyBenchmarksDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryClass = publicSourceBenchmarkQueryClass(input.query, input.entityType);
  const requiredFamilies = requiredFamiliesForPublicBenchmark(queryClass);
  const selectedSources = input.selectedSources ?? [];
  const deltas = input.publicSignalDeltas ?? [];
  const connector = input.advisoryConnector;
  const packExpansion = input.sourcePackExpansion;
  const correlation = input.advisoryCorrelation;
  const coveredFamilies = [...new Set(selectedSources.map((source) => source.family))].sort();
  const missingFamilies = requiredFamilies.filter((family) => !coveredFamilies.includes(family));
  const usefulSignalCount = deltas.filter((delta) => delta.state === "new" || delta.state === "edited").length;
  const canAnswerImmediately = Boolean(connector?.fastInitialSummary.canAnswerImmediately || usefulSignalCount > 0);
  const unknownQuerySearching = !canAnswerImmediately && usefulSignalCount === 0;

  const rows = PUBLIC_SIGNAL_FAMILIES.map((family) => {
    const familySources = selectedSources.filter((source) => source.family === family);
    const familyDeltas = deltas.filter((delta) => delta.family === family);
    const familySignals = connector?.rankedSignals.filter((signal) => signal.sourceFamily === family) ?? [];
    const familyPackCandidates = packExpansion?.candidates.filter((candidate) => candidate.family === family) ?? [];
    const candidateSourceCount = Math.max(
      familySources.length,
      connector?.sourceFamilySummary[family]?.candidateCount ?? 0,
      familyPackCandidates.length
    );
    const duplicateCount = familyDeltas.filter((delta) => delta.state === "duplicate_suppressed").length +
      familySignals.filter((signal) => signal.state === "duplicate_suppressed").length;
    const staleSignalCount = familySignals.filter((signal) => signal.stale).length +
      familyDeltas.filter((delta) => publicBenchmarkSignalFreshness(delta, generatedAt) < 0.3).length;
    const conflictCount = correlation?.conflicts.filter((conflict) => conflict.sourceFamilies.includes(family)).length ?? 0;
    const parserGap = input.coverageRadar?.gaps.some((gap) => gap.code === "parser_gap" && (gap.affectedFamilies.includes(family) || gap.affectedSourceIds.some((sourceId) => familySources.some((source) => source.sourceId === sourceId)))) ?? false;
    const parserCandidatePenalty = familyPackCandidates.some((candidate) => candidate.parserCapability === "needs_parser") ? 0.35 : 0;
    const entityRichness = publicBenchmarkEntityRichness([...familyDeltas, ...familySignals]);
    const freshnessScore = roundMetric(familySources.length > 0
      ? familySources.reduce((total, source) => total + source.freshness, 0) / familySources.length
      : familySignals.length > 0
        ? familySignals.reduce((total, signal) => total + publicBenchmarkSignalFreshness(signal, generatedAt), 0) / familySignals.length
        : 0);
    const usefulFamilySignals = familyDeltas.filter((delta) => delta.state === "new" || delta.state === "edited").length +
      familySignals.filter((signal) => signal.state !== "duplicate_suppressed" && signal.policyAllowed && signal.queryMatched).length;
    const coverageScore = roundMetric(clamp01(
      (familySources.length > 0 ? 0.3 : 0) +
      Math.min(0.25, usefulFamilySignals * 0.08) +
      freshnessScore * 0.18 +
      entityRichness * 0.16 +
      (requiredFamilies.includes(family) ? 0.11 : 0.04) -
      Math.min(0.25, conflictCount * 0.1) -
      Math.min(0.2, duplicateCount * 0.06) -
      (parserGap ? 0.12 : 0)
    ));
    const duplicateRate = roundMetric(duplicateCount / Math.max(1, duplicateCount + usefulFamilySignals));
    const contradictionRate = roundMetric(conflictCount / Math.max(1, conflictCount + usefulFamilySignals));
    const parserReadiness = roundMetric(clamp01((parserGap ? 0.45 : familySources.length > 0 || familySignals.length > 0 ? 0.82 : familyPackCandidates.length > 0 ? 0.58 : 0.35) - parserCandidatePenalty));
    const evidenceYield = roundMetric(clamp01(usefulFamilySignals / Math.max(1, familySources.length + 2)));
    const benchmarkGrade = publicBenchmarkGrade({
      coverageScore,
      usefulFamilySignals,
      familyRequired: requiredFamilies.includes(family),
      contradictionRate,
      parserReadiness
    });
    const rowStatus: PublicSourceFamilyBenchmarksDto["rows"][number]["status"] = contradictionRate >= 0.35
      ? "hold"
      : benchmarkGrade === "missing" && unknownQuerySearching
        ? "searching"
        : benchmarkGrade === "missing" || coverageScore < 0.4
          ? "needs_expansion"
          : benchmarkGrade === "thin"
            ? "partial"
            : "ready";
    return {
      family,
      selectedSourceCount: familySources.length,
      candidateSourceCount,
      usefulSignalCount: usefulFamilySignals,
      coverageScore,
      freshnessScore,
      contradictionRate,
      duplicateRate,
      parserReadiness,
      actorCampaignCveRichness: entityRichness,
      evidenceYield,
      benchmarkGrade,
      status: rowStatus,
      recommendedAction: publicBenchmarkRecommendedAction({
        rowStatus,
        duplicateRate,
        contradictionRate,
        parserReadiness,
        freshnessScore,
        familyRequired: requiredFamilies.includes(family),
        familyPackCandidates
      }),
      relatedSourceIds: familySources.map((source) => source.sourceId).sort(),
      relatedSignalIds: uniqueCleanStrings([...familyDeltas.map((delta) => delta.id), ...familySignals.map((signal) => signal.id)]).slice(0, 12)
    };
  });

  const expansionRecommendations = buildPublicBenchmarkExpansionRecommendations({
    query: input.query,
    queryClass,
    rows,
    requiredFamilies,
    sourcePackExpansion: packExpansion,
    coverageRadar: input.coverageRadar,
    unknownQuerySearching
  });
  const status: PublicSourceFamilyBenchmarksDto["status"] = rows.some((row) => row.status === "hold") || (correlation?.summary.holdCount ?? 0) > 0
    ? "hold"
    : unknownQuerySearching
      ? "searching"
      : missingFamilies.length > 0 || expansionRecommendations.some((recommendation) => recommendation.priority === "high")
        ? "needs_expansion"
        : canAnswerImmediately && rows.some((row) => row.status === "ready")
          ? "ready"
          : "partial";

  return {
    schemaVersion: "ti.public_source_family_benchmarks.v1",
    generatedAt,
    query: input.query,
    queryClass,
    status,
    rows,
    queryClassCoverage: {
      requiredFamilies,
      coveredFamilies,
      missingFamilies,
      diversityScore: roundMetric(coveredFamilies.length / Math.max(1, requiredFamilies.length)),
      usefulSignalCount,
      canAnswerImmediately,
      unknownQuerySearching,
      partialReason: unknownQuerySearching
        ? "searching public source families; no evidence-backed public answer is available yet"
        : missingFamilies.length > 0
          ? `missing required public source families: ${missingFamilies.join(", ")}`
          : undefined
    },
    expansionRecommendations,
    unknownQueryHandling: {
      noDefaultActorAssumption: true,
      displayState: status === "searching" ? "searching" : status === "ready" ? "ready" : "partial",
      allowedSummary: status === "searching" ? "Searching" : status === "ready" ? "Public coverage benchmark ready" : "Partial public coverage",
      staleCacheProseAllowed: false
    },
    handoffs: {
      agent01SourcePortfolio: uniqueCleanStrings(expansionRecommendations.map((recommendation) => recommendation.family).map((family) => `benchmark_family_${family}`)),
      agent02CadenceSlo: rows.some((row) => row.freshnessScore < 0.55) ? ["raise_cadence_for_stale_public_families"] : [],
      agent03AdapterCertification: rows.some((row) => row.parserReadiness < 0.7) ? ["certify_or_repair_parsers_for_undercovered_families"] : [],
      agent06EvidenceReplay: rows.some((row) => row.duplicateRate > 0.2 || row.evidenceYield < 0.35) ? ["verify_dedupe_and_evidence_yield_in_replay"] : ["preserve_family_benchmark_metrics_with_evidence_replay"],
      agent07ActorFreshness: status === "searching" || rows.some((row) => row.contradictionRate > 0) ? ["keep_unknown_or_conflicted_actor_answers_partial"] : [],
      agent09ApiFields: ["publicSignalFusion.sourceFamilyBenchmarks"],
      agent10ReleaseGates: status === "ready" ? ["include_family_benchmarks_in_release_promote_packet"] : ["hold_or_warn_on_public_source_family_benchmark_gaps"]
    },
    guardrails: {
      publicOnly: true,
      dryRunOnly: true,
      noRestrictedCrawling: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noUnsafeUrlsExposed: true,
      noDemoDefaults: true,
      noDefaultActorAssumption: true,
      piiMinimized: true
    }
  };
}

export function buildPublicIntelligenceCoveragePlan(input: PublicIntelligenceCoveragePlanInput): PublicIntelligenceCoveragePlanDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryClass = publicSourceBenchmarkQueryClass(input.query, input.entityType);
  const selectedSources = input.selectedSources ?? [];
  const deltas = input.publicSignalDeltas ?? [];
  const benchmarks = input.sourceFamilyBenchmarks ?? buildPublicSourceFamilyBenchmarks({
    query: input.query,
    entityType: input.entityType,
    selectedSources,
    publicSignalDeltas: deltas,
    advisoryConnector: input.advisoryConnector,
    coverageRadar: input.coverageRadar,
    sourcePackExpansion: input.sourcePackExpansion,
    advisoryCorrelation: input.advisoryCorrelation,
    generatedAt
  });
  const coveredFamilies = [...new Set(selectedSources.map((source) => source.family))].sort();
  const usefulSignalCount = deltas.filter((delta) => delta.state === "new" || delta.state === "edited").length;
  const queryClassSourceMap = buildPublicQueryClassSourceMap(queryClass, coveredFamilies, benchmarks);
  const blindSpots: PublicIntelligenceCoveragePlanDto["blindSpots"] = buildPublicCoverageBlindSpotsLegacy({
    query: input.query,
    queryClass,
    generatedAt,
    selectedSources,
    publicSignalDeltas: deltas,
    advisoryConnector: input.advisoryConnector,
    coverageRadar: input.coverageRadar,
    advisoryCorrelation: input.advisoryCorrelation,
    sourceFamilyBenchmarks: benchmarks
  });
  const safeSourcePackRecommendations: PublicIntelligenceCoveragePlanDto["safeSourcePackRecommendations"] = buildPublicCoverageSafeSourcePackRecommendationsLegacy(input.sourcePackExpansion, benchmarks);
  const status: PublicIntelligenceCoveragePlanDto["status"] = blindSpots.some((spot) => spot.severity === "hold") || benchmarks.status === "hold"
    ? "hold"
    : benchmarks.queryClassCoverage.unknownQuerySearching || usefulSignalCount === 0 && selectedSources.length === 0
      ? "searching"
      : blindSpots.some((spot) => spot.code === "source_family_blind_spot" || spot.code === "no_public_evidence") || safeSourcePackRecommendations.some((item) => item.priority === "high")
        ? "needs_expansion"
        : benchmarks.status === "ready"
          ? "ready"
          : "partial";
  const initialContext: PublicIntelligenceCoveragePlanDto["responsiveness"]["initialContext"] = status === "hold"
    ? "hold"
    : status === "searching"
      ? "searching"
      : status === "ready"
        ? "ready"
        : "partial";

  return {
    schemaVersion: "ti.public_intelligence_coverage_plan.v1",
    generatedAt,
    query: input.query,
    queryClass,
    status,
    queryClassSourceMap,
    blindSpots,
    safeSourcePackRecommendations,
    responsiveness: {
      initialContext,
      refreshAfterSeconds: 3,
      incrementalEvidenceExpected: status !== "ready",
      staleCacheCopyAllowed: false,
      demoFallbackAllowed: false,
      defaultActorAssumptionAllowed: false
    },
    handoffs: {
      agent01SourcePortfolio: uniqueCleanStrings(safeSourcePackRecommendations.map((item) => `expand_${item.family}`)),
      agent02SchedulerCadence: blindSpots.some((spot) => spot.code === "stale_actor_activity" || spot.code === "old_seed_cache_reliance") ? ["raise_cadence_for_stale_or_seed_heavy_public_sources"] : [],
      agent03AdapterCertification: blindSpots.some((spot) => spot.code === "parser_gap") ? ["certify_parser_repairs_before_counting_family_coverage"] : [],
      agent06EvidenceReplay: blindSpots.some((spot) => spot.code === "old_seed_cache_reliance" || spot.code === "no_public_evidence") ? ["replay_public_evidence_before_answer_promotion"] : [],
      agent07AnswerFreshness: status === "searching" || blindSpots.some((spot) => spot.code === "stale_actor_activity" || spot.code === "contradiction_cluster") ? ["keep_answer_partial_or_searching_until_fresh_corroboration"] : [],
      agent09ApiFields: ["publicSignalFusion.publicIntelligenceCoveragePlan"],
      agent10ReleaseGates: status === "ready" ? ["coverage_plan_release_gate_passed"] : ["hold_or_warn_on_public_coverage_plan_gaps"]
    },
    guardrails: {
      publicOnly: true,
      dryRunOnly: true,
      approvedPublicSourcesPrioritized: true,
      metadataOnlyPublicChannelHandoffs: true,
      noRestrictedCollection: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noRawUrlsExposed: true,
      noDemoDefaults: true,
      noDefaultActorAssumption: true,
      noStaleCacheCopy: true,
      piiMinimized: true
    }
  };
}

export function buildPublicFreshnessGapRemediation(input: PublicFreshnessGapRemediationInput): PublicFreshnessGapRemediationDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryClass = publicSourceBenchmarkQueryClass(input.query, input.entityType);
  const selectedSources = input.selectedSources ?? [];
  const deltas = input.publicSignalDeltas ?? [];
  const benchmarks = input.sourceFamilyBenchmarks ?? buildPublicSourceFamilyBenchmarks({
    query: input.query,
    entityType: input.entityType,
    selectedSources,
    publicSignalDeltas: deltas,
    sourcePackExpansion: input.sourcePackExpansion,
    advisoryCorrelation: input.advisoryCorrelation,
    generatedAt
  });
  const coveragePlan = input.coveragePlan ?? buildPublicIntelligenceCoveragePlan({
    query: input.query,
    entityType: input.entityType,
    selectedSources,
    publicSignalDeltas: deltas,
    sourcePackExpansion: input.sourcePackExpansion,
    advisoryCorrelation: input.advisoryCorrelation,
    sourceFamilyBenchmarks: benchmarks,
    generatedAt
  });
  const highVolumeActorFreshness = buildHighVolumeActorFreshnessState(input.query, deltas, selectedSources, generatedAt);
  const remediationActions = buildPublicFreshnessRemediationActions({
    query: input.query,
    queryClass,
    coveragePlan,
    benchmarks,
    highVolumeActorState: highVolumeActorFreshness.state
  });
  const blindSpotCodes = new Set(coveragePlan.blindSpots.map((spot) => spot.code));
  const staleOnlyRecentActivityRejected = highVolumeActorFreshness.state === "stale" || blindSpotCodes.has("stale_actor_activity") || blindSpotCodes.has("old_seed_cache_reliance");
  const activationNeeded = remediationActions.some((action) => action.action === "activate_public_source_family");
  const holdReasons = uniqueCleanStrings([
    ...coveragePlan.blindSpots
      .filter((spot) => spot.severity === "hold" || spot.releaseImpact === "hold_public_answer" || spot.releaseImpact === "searching_only")
      .map((spot) => spot.code),
    ...(staleOnlyRecentActivityRejected ? ["stale_only_recent_activity_rejected"] : [])
  ]);
  const status: PublicFreshnessGapRemediationDto["status"] = holdReasons.length > 0
    ? "hold"
    : coveragePlan.status === "searching"
      ? "searching"
      : activationNeeded
        ? "activation_needed"
        : remediationActions.length > 0 || coveragePlan.status !== "ready"
          ? "partial"
          : "ready";
  const publicState: PublicFreshnessGapRemediationDto["answerState"]["publicState"] = status === "activation_needed"
    ? "partial"
    : status;
  const evidenceReady = status === "ready" && !staleOnlyRecentActivityRejected;

  return {
    schemaVersion: "ti.public_freshness_gap_remediation.v1",
    generatedAt,
    query: input.query,
    queryClass,
    status,
    answerState: {
      publicState,
      compactReason: publicFreshnessCompactReason(status, holdReasons, activationNeeded, staleOnlyRecentActivityRejected),
      refreshAfterSeconds: 3,
      evidenceReady,
      activationNeeded,
      staleOnlyRecentActivityRejected
    },
    highVolumeActorFreshness,
    remediationActions,
    releaseGate: {
      canPromoteRecentActivity: !staleOnlyRecentActivityRejected && status !== "hold" && status !== "searching",
      canPromotePublicFacts: evidenceReady,
      holdReasons,
      requiredBeforeReady: uniqueCleanStrings(remediationActions.map((action) => action.action))
    },
    queryFixtures: buildPublicFreshnessQueryFixtures(coveragePlan),
    apiFields: {
      publicSignalFusionField: "publicSignalFusion.freshnessGapRemediation",
      stateFields: ["status", "answerState.publicState", "answerState.compactReason", "highVolumeActorFreshness.state", "releaseGate.holdReasons"],
      remediationFields: ["remediationActions.owner", "remediationActions.action", "remediationActions.families", "remediationActions.expectedStateChange"]
    },
    guardrails: {
      publicOnly: true,
      dryRunOnly: true,
      noDefaultActorAssumption: true,
      noDemoFallback: true,
      noStaleCacheCopy: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noRestrictedRawCollection: true,
      noRawUrlsExposed: true,
      piiMinimized: true
    }
  };
}

export function buildPublicIntelligenceQueryMatrix(input: PublicIntelligenceQueryMatrixInput): PublicIntelligenceQueryMatrixDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const currentQueryClass = publicSourceBenchmarkQueryClass(input.query, input.entityType);
  const coveragePlan = input.coveragePlan ?? buildPublicIntelligenceCoveragePlan({
    query: input.query,
    entityType: input.entityType,
    sourceFamilyBenchmarks: input.sourceFamilyBenchmarks,
    advisoryCorrelation: input.advisoryCorrelation,
    generatedAt
  });
  const benchmarks = input.sourceFamilyBenchmarks ?? buildPublicSourceFamilyBenchmarks({
    query: input.query,
    entityType: input.entityType,
    advisoryCorrelation: input.advisoryCorrelation,
    generatedAt
  });
  const remediation = input.freshnessGapRemediation ?? buildPublicFreshnessGapRemediation({
    query: input.query,
    entityType: input.entityType,
    coveragePlan,
    sourceFamilyBenchmarks: benchmarks,
    advisoryCorrelation: input.advisoryCorrelation,
    generatedAt
  });
  const benchmarkRowsByFamily = new Map(benchmarks.rows.map((row) => [row.family, row]));
  const coverageRowsByClass = new Map(coveragePlan.queryClassSourceMap.map((row) => [row.queryClass, row]));
  const fixtureRows = remediation.queryFixtures;
  const classes = uniqueCleanStrings([
    currentQueryClass,
    ...fixtureRows.map((fixture) => fixture.queryClass),
    "campaign",
    "malware_tool",
    "infrastructure",
    "unknown"
  ]);
  const rows = classes.map((queryClass) => {
    const fixture = fixtureRows.find((item) => item.queryClass === queryClass);
    const coverage = coverageRowsByClass.get(queryClass);
    const required = coverage?.requiredFamilies ?? requiredFamiliesForPublicBenchmark(queryClass);
    const covered = coverage?.coveredFamilies ?? [];
    const missing = coverage?.missingFamilies ?? required;
    const familyRows = required.map((family) => benchmarkRowsByFamily.get(family)).filter((row): row is PublicSourceFamilyBenchmarksDto["rows"][number] => Boolean(row));
    const coverageScore = roundMetric(covered.length / Math.max(1, required.length));
    const freshness = roundMetric(familyRows.length > 0 ? familyRows.reduce((sum, row) => sum + row.freshnessScore, 0) / familyRows.length : 0);
    const evidenceYield = coverage?.evidenceYield ?? roundMetric(familyRows.length > 0 ? familyRows.reduce((sum, row) => sum + row.evidenceYield, 0) / familyRows.length : 0);
    const contradictionRisk = roundMetric(Math.max(0, ...familyRows.map((row) => row.contradictionRate), input.advisoryCorrelation?.summary.conflictCount ? 0.45 : 0));
    const parserReadiness = roundMetric(familyRows.length > 0 ? familyRows.reduce((sum, row) => sum + row.parserReadiness, 0) / familyRows.length : 0);
    const graphReadiness = roundMetric(clamp01(1 - contradictionRisk - (missing.length > 0 ? 0.18 : 0)));
    const publicAnswerReadiness = roundMetric(clamp01(coverageScore * 0.3 + freshness * 0.22 + evidenceYield * 0.22 + parserReadiness * 0.16 + graphReadiness * 0.1));
    const analystActionability = roundMetric(clamp01(remediation.remediationActions.filter((action) => action.queryClass === queryClass || action.families.some((family) => required.includes(family))).length / 5));
    const blockers = uniqueCleanStrings([
      ...(missing.length > 0 ? ["source_family_gap"] : []),
      ...(freshness < 0.45 && queryClass !== "unknown" ? ["freshness_gap"] : []),
      ...(parserReadiness < 0.55 ? ["parser_gap"] : []),
      ...(contradictionRisk >= 0.35 ? ["contradiction_risk"] : []),
      ...(queryClass === "unknown" ? ["unknown_query_searching_only"] : [])
    ]);
    const state: PublicIntelligenceQueryMatrixDto["rows"][number]["state"] = queryClass === "unknown" || fixture?.expectedState === "searching"
      ? "searching"
      : blockers.includes("contradiction_risk") || coveragePlan.status === "hold" && queryClass === currentQueryClass
        ? "hold"
        : publicAnswerReadiness >= 0.72 && blockers.length === 0
          ? "ready"
          : "partial";
    const recommendedNextActions: PublicIntelligenceQueryMatrixDto["rows"][number]["recommendedNextActions"] = uniqueCleanStrings([
      ...(missing.length > 0 ? ["activate_source_family"] : []),
      ...(freshness < 0.45 && queryClass !== "unknown" ? ["raise_cadence"] : []),
      ...(parserReadiness < 0.55 ? ["repair_parser"] : []),
      ...(evidenceYield < 0.45 ? ["replay_evidence"] : []),
      ...(state === "hold" ? ["quality_hold", "graph_review"] : []),
      ...(state === "searching" ? ["show_searching"] : [])
    ]) as PublicIntelligenceQueryMatrixDto["rows"][number]["recommendedNextActions"];
    return {
      query: fixture?.query ?? (queryClass === currentQueryClass ? input.query : publicQueryMatrixExampleQuery(queryClass)),
      queryClass,
      currentQuery: queryClass === currentQueryClass,
      sourceFamilies: {
        required,
        covered,
        missing,
        diversityScore: coverageScore
      },
      scores: {
        coverage: coverageScore,
        freshness,
        evidenceYield,
        contradictionRisk,
        parserReadiness,
        graphReadiness,
        publicAnswerReadiness,
        analystActionability
      },
      state,
      primaryBlockers: blockers,
      recommendedNextActions,
      staleRecentActivityAllowed: false,
      defaultActorFallbackAllowed: false
    };
  });
  const readyRows = rows.filter((row) => row.state === "ready").length;
  const partialRows = rows.filter((row) => row.state === "partial").length;
  const searchingRows = rows.filter((row) => row.state === "searching").length;
  const heldRows = rows.filter((row) => row.state === "hold").length;
  const weakestQueryClasses = rows
    .slice()
    .sort((left, right) => left.scores.publicAnswerReadiness - right.scores.publicAnswerReadiness)
    .slice(0, 4)
    .map((row) => row.queryClass);
  const nextBestActions = uniqueCleanStrings(rows.flatMap((row) => row.recommendedNextActions)).slice(0, 8);

  return {
    schemaVersion: "ti.public_intelligence_query_matrix.v1",
    generatedAt,
    query: input.query,
    currentQueryClass,
    status: heldRows > 0 && coveragePlan.status === "hold" ? "hold" : searchingRows > 0 && rows.every((row) => row.state === "searching") ? "searching" : readyRows === rows.length ? "ready" : "partial",
    rows,
    summary: {
      readyRows,
      partialRows,
      searchingRows,
      heldRows,
      weakestQueryClasses,
      nextBestActions
    },
    apiFields: {
      publicSignalFusionField: "publicSignalFusion.publicIntelligenceQueryMatrix",
      compactRowFields: ["queryClass", "state", "scores.publicAnswerReadiness", "primaryBlockers", "recommendedNextActions"]
    },
    guardrails: {
      publicOnly: true,
      noDefaultActorAssumption: true,
      noDemoFallback: true,
      noStaleCacheCopy: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noRestrictedRawCollection: true,
      noRawUrlsExposed: true
    }
  };
}

export function buildPublicConflictContradictionResolver(input: PublicConflictContradictionResolverInput): PublicConflictContradictionResolverDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryClass = publicSourceBenchmarkQueryClass(input.query, input.entityType);
  const correlation = input.advisoryCorrelation ?? buildPublicAdvisoryCorrelation({
    query: input.query,
    entityType: input.entityType,
    generatedAt
  });
  const matrix = input.publicIntelligenceQueryMatrix ?? buildPublicIntelligenceQueryMatrix({
    query: input.query,
    entityType: input.entityType,
    advisoryCorrelation: correlation,
    freshnessGapRemediation: input.freshnessGapRemediation,
    coveragePlan: input.coveragePlan,
    generatedAt
  });
  const correlationRowsByEntity = new Map(correlation.correlatedEvidence.map((row) => [`${row.entityType}:${normalizeCorrelationEntity(row.entity)}`, row]));
  const matrixRowsByClass = new Map(matrix.rows.map((row) => [row.queryClass, row]));
  const rows: PublicConflictContradictionResolverDto["rows"] = [];
  const addRow = (row: PublicConflictContradictionResolverDto["rows"][number]) => {
    const key = `${row.contradictionType}:${row.entityType}:${normalizeCorrelationEntity(row.entity)}:${row.sourceIds.join("|")}:${row.evidenceIds.join("|")}`;
    if (rows.some((existing) => `${existing.contradictionType}:${existing.entityType}:${normalizeCorrelationEntity(existing.entity)}:${existing.sourceIds.join("|")}:${existing.evidenceIds.join("|")}` === key)) return;
    rows.push(row);
  };

  for (const conflict of correlation.conflicts) {
    const correlated = correlationRowsByEntity.get(`${conflict.entityType}:${normalizeCorrelationEntity(conflict.entity)}`);
    const contradictionType = publicResolverContradictionType(conflict.conflictType, conflict.entityType, queryClass);
    const affectedQueryClasses = publicResolverAffectedQueryClasses(contradictionType, queryClass, conflict.entityType, matrix);
    const releaseGate = publicResolverReleaseGate(conflict.severity, contradictionType);
    addRow({
      id: `public_conflict_resolver_${hashContent(`${conflict.id}:${contradictionType}:${affectedQueryClasses.join("|")}`).slice(0, 16)}`,
      contradictionType,
      affectedQueryClasses,
      entity: conflict.entity,
      entityType: conflict.entityType,
      sourceFamilies: [...new Set(conflict.sourceFamilies)].sort(),
      sourceIds: uniqueCleanStrings(conflict.sourceIds).slice(0, 12),
      evidenceIds: uniqueCleanStrings(conflict.evidenceIds).slice(0, 12),
      freshness: correlated?.freshness ?? 0,
      confidence: correlated?.correlationConfidence ?? (conflict.severity === "hold" ? 0.35 : conflict.severity === "review" ? 0.52 : 0.68),
      publicAnswerEffect: publicResolverPublicAnswerEffect(releaseGate, contradictionType, matrixRowsByClass, affectedQueryClasses),
      graphStixEffect: publicResolverGraphStixEffect(releaseGate, contradictionType),
      releaseGate,
      analystActions: publicResolverAnalystActions(contradictionType, releaseGate),
      handoffs: {
        agent06Evidence: ["verify_resolver_evidence_ids", "preserve_citation_hashes_for_conflict_review"],
        agent07Quality: releaseGate === "hold" ? ["public_contradiction_quality_hold"] : ["public_contradiction_quality_review"],
        agent08GraphStix: releaseGate === "hold" ? ["block_conflicted_relationship_export"] : ["review_conflicted_relationship_before_export"],
        agent09ApiFields: ["publicSignalFusion.publicConflictContradictionResolver"]
      }
    });
  }

  for (const matrixRow of matrix.rows) {
    if (!matrixRow.primaryBlockers.includes("contradiction_risk")) continue;
    const existing = rows.some((row) => row.affectedQueryClasses.includes(matrixRow.queryClass));
    if (existing) continue;
    addRow({
      id: `public_conflict_resolver_${hashContent(`${input.query}:${matrixRow.queryClass}:source_family_conflict`).slice(0, 16)}`,
      contradictionType: "source_family_conflict",
      affectedQueryClasses: [matrixRow.queryClass],
      entity: matrixRow.query,
      entityType: matrixRow.queryClass,
      sourceFamilies: matrixRow.sourceFamilies.covered,
      sourceIds: [],
      evidenceIds: [],
      freshness: matrixRow.scores.freshness,
      confidence: roundMetric(clamp01(1 - matrixRow.scores.contradictionRisk)),
      publicAnswerEffect: matrixRow.currentQuery ? "keep_partial" : "allow_with_caveat",
      graphStixEffect: "graph_review_required",
      releaseGate: "review",
      analystActions: ["compare_sources", "request_more_sources", "review_graph_relationship"],
      handoffs: {
        agent06Evidence: ["expand_resolver_evidence_search_for_query_class"],
        agent07Quality: ["public_contradiction_quality_review"],
        agent08GraphStix: ["review_conflicted_relationship_before_export"],
        agent09ApiFields: ["publicSignalFusion.publicConflictContradictionResolver"]
      }
    });
  }

  for (const matrixRow of matrix.rows) {
    if (!matrixRow.primaryBlockers.includes("freshness_gap") || matrixRow.scores.freshness >= 0.45) continue;
    const contradictionType: PublicConflictContradictionType = matrixRow.queryClass === "infrastructure" ? "stale_infrastructure" : "old_campaign_reuse";
    const existing = rows.some((row) => row.contradictionType === contradictionType && row.affectedQueryClasses.includes(matrixRow.queryClass));
    if (existing) continue;
    addRow({
      id: `public_conflict_resolver_${hashContent(`${input.query}:${matrixRow.queryClass}:${contradictionType}`).slice(0, 16)}`,
      contradictionType,
      affectedQueryClasses: [matrixRow.queryClass],
      entity: matrixRow.query,
      entityType: matrixRow.queryClass,
      sourceFamilies: matrixRow.sourceFamilies.covered,
      sourceIds: [],
      evidenceIds: [],
      freshness: matrixRow.scores.freshness,
      confidence: matrixRow.scores.publicAnswerReadiness,
      publicAnswerEffect: matrixRow.currentQuery ? "keep_partial" : "allow_with_caveat",
      graphStixEffect: "graph_review_required",
      releaseGate: "review",
      analystActions: ["raise_cadence", "suppress_stale_repost", "request_more_sources"],
      handoffs: {
        agent06Evidence: ["refresh_stale_resolver_evidence_ids"],
        agent07Quality: ["public_contradiction_quality_review"],
        agent08GraphStix: ["review_conflicted_relationship_before_export"],
        agent09ApiFields: ["publicSignalFusion.publicConflictContradictionResolver"]
      }
    });
  }

  const sortedRows = rows
    .sort((left, right) => publicResolverGateRank(right.releaseGate) - publicResolverGateRank(left.releaseGate) || left.contradictionType.localeCompare(right.contradictionType))
    .slice(0, 24);
  const holdCount = sortedRows.filter((row) => row.releaseGate === "hold").length;
  const reviewCount = sortedRows.filter((row) => row.releaseGate === "review").length;
  const passCount = sortedRows.filter((row) => row.releaseGate === "pass").length;
  const affectedQueryClasses = uniqueCleanStrings(sortedRows.flatMap((row) => row.affectedQueryClasses)).sort();
  const releaseGate: PublicConflictContradictionResolverDto["summary"]["releaseGate"] = holdCount > 0 ? "hold" : reviewCount > 0 ? "review" : "pass";
  const status: PublicConflictContradictionResolverDto["status"] = sortedRows.length === 0
    ? matrix.status === "searching" ? "searching" : "clear"
    : releaseGate === "hold" ? "hold" : "review";

  return {
    schemaVersion: "ti.public_conflict_contradiction_resolver.v1",
    generatedAt,
    query: input.query,
    queryClass,
    status,
    rows: sortedRows,
    summary: {
      holdCount,
      reviewCount,
      passCount,
      affectedQueryClasses,
      releaseGate
    },
    apiFields: {
      publicSignalFusionField: "publicSignalFusion.publicConflictContradictionResolver",
      compactRowFields: ["contradictionType", "affectedQueryClasses", "evidenceIds", "sourceIds", "publicAnswerEffect", "graphStixEffect", "releaseGate", "analystActions"]
    },
    guardrails: {
      publicOnly: true,
      noRawUrlsExposed: true,
      noRestrictedRawCollection: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noDefaultActorAssumption: true,
      noStaleCacheCopy: true,
      piiMinimized: true
    }
  };
}

export function buildPublicSignalLiveCollectionLoopDto(input: PublicSignalLiveCollectionLoopInput): PublicSignalLiveCollectionLoopDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryClass = publicSourceBenchmarkQueryClass(input.query, input.entityType);
  const coveragePlan = input.coveragePlan ?? buildPublicIntelligenceCoveragePlan({
    query: input.query,
    entityType: input.entityType,
    selectedSources: input.selectedSources,
    publicSignalDeltas: input.publicSignalDeltas,
    generatedAt
  });
  const matrix = input.publicIntelligenceQueryMatrix ?? buildPublicIntelligenceQueryMatrix({
    query: input.query,
    entityType: input.entityType,
    coveragePlan,
    generatedAt
  });
  const resolver = input.publicConflictContradictionResolver ?? buildPublicConflictContradictionResolver({
    query: input.query,
    entityType: input.entityType,
    publicIntelligenceQueryMatrix: matrix,
    freshnessGapRemediation: input.freshnessGapRemediation,
    coveragePlan,
    generatedAt
  });
  const requiredFamilies = requiredFamiliesForPublicBenchmark(queryClass);
  const currentCoverage = coveragePlan.queryClassSourceMap.find((row) => row.currentQuery);
  const missingFamilies = currentCoverage?.missingFamilies ?? requiredFamilies;
  const selectedSources = input.selectedSources ?? [];
  const deltas = input.publicSignalDeltas ?? [];
  const darkwebSignals = (input.darkwebMetadataSignals ?? []).filter((signal) => signal.metadataOnly);
  const queryTerms = expandPublicSignalQueryTerms(input.query, input.entityType);
  const familyDiversity = roundMetric(clamp01((currentCoverage?.coveredFamilies.length ?? 0) / Math.max(1, requiredFamilies.length)));
  const contradictionState = resolver.summary.releaseGate === "hold" ? 0.1 : resolver.summary.releaseGate === "review" ? 0.48 : 0.9;
  const rows: PublicSignalLiveCollectionLoopDto["normalizedIntake"] = [];

  const addRow = (
    row: Omit<PublicSignalLiveCollectionLoopDto["normalizedIntake"][number], "scores" | "penalties"> & {
      freshness: number;
      provenanceStrength: number;
      entitySpecificity: number;
      analystUsefulness: number;
      queryMatch: number;
      metadataOnlyPenalty?: boolean;
      genericSummaryPenalty?: boolean;
    }
  ) => {
    const penalties: PublicSignalLiveCollectionLoopDto["normalizedIntake"][number]["penalties"] = [];
    if (row.freshness < 0.28) penalties.push("stale_only");
    if (row.genericSummaryPenalty) penalties.push("generic_summary");
    if (familyDiversity < 0.35) penalties.push("source_monoculture");
    if (row.queryMatch < 0.25) penalties.push("query_mismatch");
    if (resolver.summary.releaseGate === "hold") penalties.push("contradiction_hold");
    if (row.metadataOnlyPenalty) penalties.push("metadata_only_hold");
    const final = roundMetric(clamp01(
      row.freshness * 0.22 +
      familyDiversity * 0.16 +
      row.provenanceStrength * 0.18 +
      contradictionState * 0.14 +
      row.entitySpecificity * 0.14 +
      row.analystUsefulness * 0.1 +
      row.queryMatch * 0.16 -
      penalties.length * 0.055
    ));
    rows.push({
      id: row.id,
      family: row.family,
      sourceId: row.sourceId,
      sourceRef: row.sourceRef,
      state: row.state,
      evidenceIds: uniqueCleanStrings(row.evidenceIds).slice(0, 10),
      redactedSiteIds: uniqueCleanStrings(row.redactedSiteIds).slice(0, 6),
      categoryLabels: uniqueCleanStrings(row.categoryLabels).slice(0, 8),
      riskLabels: uniqueCleanStrings(row.riskLabels).slice(0, 8),
      liveness: row.liveness,
      matchedHints: row.matchedHints,
      blockedPayloadMarkers: uniqueCleanStrings(row.blockedPayloadMarkers).slice(0, 8),
      scores: {
        freshness: row.freshness,
        familyDiversity,
        provenanceStrength: row.provenanceStrength,
        contradictionState,
        entitySpecificity: row.entitySpecificity,
        analystUsefulness: row.analystUsefulness,
        queryMatch: row.queryMatch,
        final
      },
      penalties,
      provenance: row.provenance
    });
  };

  for (const source of selectedSources.slice(0, 16)) {
    const entitySpecificity = publicLiveEntitySpecificity({
      actors: source.matchedTerms.filter((term) => /apt|typhoon|lazarus|sandworm|akira|lockbit/i.test(term)),
      cves: source.matchedTerms.filter((term) => /^cve-/i.test(term)),
      sectors: source.regions.length > 0 ? source.regions : [],
      countries: source.regions
    });
    addRow({
      id: `live_intake_source_${hashContent(`${input.query}:${source.sourceId}`).slice(0, 16)}`,
      family: source.family,
      sourceId: source.sourceId,
      sourceRef: `source_ref_${hashContent(source.sourceId).slice(0, 12)}`,
      state: source.provenance.approvedPublic ? "accepted" : "partial",
      evidenceIds: [],
      redactedSiteIds: [],
      categoryLabels: ["source_atlas", source.family],
      riskLabels: source.provenance.approvedPublic ? ["approved_public"] : ["approval_review"],
      matchedHints: {},
      blockedPayloadMarkers: [],
      freshness: source.freshness,
      provenanceStrength: source.provenance.approvedPublic ? source.reliability : roundMetric(source.reliability * 0.45),
      entitySpecificity,
      analystUsefulness: roundMetric(clamp01(source.score * 0.6 + source.queryFit * 0.4)),
      queryMatch: source.queryFit,
      genericSummaryPenalty: source.matchedTerms.length <= 1 && source.queryFit < 0.35,
      provenance: {
        normalizedToCollectedItem: true,
        publicOnly: true,
        metadataOnly: source.provenance.metadataOnly,
        safeForApi: true,
        rawUrlExposed: false,
        unsafePayloadExposed: false
      }
    });
  }

  for (const delta of deltas.slice(0, 24)) {
    const matchText = `${delta.title ?? ""} ${delta.summary ?? ""} ${(delta.tags ?? []).join(" ")}`.toLowerCase();
    addRow({
      id: `live_intake_delta_${hashContent(`${input.query}:${delta.id}`).slice(0, 16)}`,
      family: delta.family,
      sourceId: delta.sourceId,
      sourceRef: `evidence_ref_${hashContent(delta.id).slice(0, 12)}`,
      state: delta.state === "deleted_or_unavailable" ? "held" : delta.state === "duplicate_suppressed" ? "rejected" : "accepted",
      evidenceIds: [delta.id],
      redactedSiteIds: [],
      categoryLabels: uniqueCleanStrings([delta.family, delta.mergeTarget ?? "public_signal", ...(delta.tags ?? [])]).slice(0, 8),
      riskLabels: delta.state === "edited" || delta.state === "deleted_or_unavailable" ? ["edited_deleted_review"] : ["public_evidence"],
      matchedHints: delta.matchedEntities ?? {},
      blockedPayloadMarkers: [],
      freshness: publicDeltaFreshness(delta, generatedAt),
      provenanceStrength: delta.provenance.evidenceBacked ? 0.86 : 0.48,
      entitySpecificity: publicLiveEntitySpecificity(delta.matchedEntities),
      analystUsefulness: delta.state === "duplicate_suppressed" ? 0.2 : delta.confidence,
      queryMatch: roundMetric(clamp01(queryTerms.filter((term) => matchText.includes(term.toLowerCase())).length / Math.max(1, Math.min(queryTerms.length, 4)))),
      genericSummaryPenalty: publicLiveGenericSummary(delta.summary ?? delta.title ?? ""),
      provenance: {
        normalizedToCollectedItem: true,
        publicOnly: true,
        metadataOnly: false,
        safeForApi: true,
        rawUrlExposed: false,
        unsafePayloadExposed: false
      }
    });
  }

  for (const signal of darkwebSignals.slice(0, 12)) {
    const hints = {
      actors: uniqueCleanStrings(signal.actors),
      victims: uniqueCleanStrings(signal.victims),
      countries: uniqueCleanStrings(signal.countries),
      sectors: uniqueCleanStrings(signal.sectors),
      ttps: uniqueCleanStrings(signal.ttps)
    };
    const matchText = `${hints.actors.join(" ")} ${hints.victims.join(" ")} ${hints.countries.join(" ")} ${hints.sectors.join(" ")} ${hints.ttps.join(" ")}`.toLowerCase();
    addRow({
      id: `live_intake_darkweb_${hashContent(`${input.query}:${signal.id}:${signal.redactedSiteId}`).slice(0, 16)}`,
      family: "darkweb_metadata",
      sourceId: signal.id,
      sourceRef: `restricted_metadata_ref_${hashContent(signal.redactedSiteId).slice(0, 12)}`,
      state: "held",
      evidenceIds: [],
      redactedSiteIds: [signal.redactedSiteId],
      categoryLabels: [signal.category, "metadata_only"],
      riskLabels: [signal.risk, "restricted_review_hold"],
      liveness: signal.liveness,
      matchedHints: hints,
      blockedPayloadMarkers: uniqueCleanStrings(signal.blockedPayloadMarkers ?? ["unsafe_locator", "credential_marker", "dump_marker", "payload_marker"])
        .map((marker) => marker === "raw_url" ? "unsafe_locator" : marker === "payload_link" ? "payload_marker" : marker === "credential" ? "credential_marker" : marker),
      freshness: signal.observedAt ? publicBenchmarkSignalFreshness({ observedAt: signal.observedAt }, generatedAt) : 0.45,
      provenanceStrength: 0.42,
      entitySpecificity: publicLiveEntitySpecificity(hints),
      analystUsefulness: signal.risk === "critical" || signal.risk === "high" ? 0.72 : 0.48,
      queryMatch: roundMetric(clamp01(queryTerms.filter((term) => matchText.includes(term.toLowerCase())).length / Math.max(1, Math.min(queryTerms.length, 4)))),
      metadataOnlyPenalty: true,
      provenance: {
        normalizedToCollectedItem: true,
        publicOnly: false,
        metadataOnly: true,
        safeForApi: true,
        rawUrlExposed: false,
        unsafePayloadExposed: false
      }
    });
  }

  const acceptedPublicRows = rows.filter((row) => row.state === "accepted" && row.provenance.publicOnly);
  const publicEvidenceRows = acceptedPublicRows.filter((row) => row.evidenceIds.length > 0);
  const aggregate = publicLiveAggregateScore(rows, resolver.summary.releaseGate);
  const allPenalties = uniqueCleanStrings(rows.flatMap((row) => row.penalties));
  const hasDarkwebOnly = rows.length > 0 && rows.every((row) => row.family === "darkweb_metadata");
  const status: PublicSignalLiveCollectionLoopDto["status"] = resolver.summary.releaseGate === "hold" || hasDarkwebOnly
    ? "held"
    : publicEvidenceRows.length === 0
      ? "searching"
      : aggregate.overall >= 0.72 && missingFamilies.length === 0
        ? "ready"
        : "partial";
  const playbook = publicLiveCollectionPlaybook({
    queryClass,
    requiredFamilies,
    missingFamilies,
    status,
    resolverGate: resolver.summary.releaseGate,
    darkwebSignals: darkwebSignals.length
  });

  return {
    schemaVersion: "ti.public_signal_live_collection_loop.v1",
    generatedAt,
    query: input.query,
    queryClass,
    status,
    intakeContract: {
      acceptedFamilies: [...PUBLIC_SIGNAL_FAMILIES, "source_atlas", "darkweb_metadata"],
      normalizedPayloadOnly: true,
      collectedItemProvenanceRequired: true,
      unsafePayloadFieldsRejected: ["url", "canonicalUrl", "rawText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "downloadUrl", "objectRef"],
      routeVisibleFields: ["status", "score", "playbook", "normalizedIntake", "nextSafeCollectionTasks", "handoffs", "guardrails"]
    },
    normalizedIntake: rows.sort((left, right) => right.scores.final - left.scores.final).slice(0, 40),
    score: { ...aggregate, penalties: allPenalties },
    playbook,
    nextSafeCollectionTasks: buildPublicLiveNextSafeTasks({
      query: input.query,
      status,
      missingFamilies,
      rows,
      resolver,
      coveragePlan,
      matrix,
      hasDarkwebMetadata: darkwebSignals.length > 0
    }),
    queryFixtures: buildPublicLiveCollectionFixtures(),
    handoffs: {
      agent01SourceAtlas: ["activate_or_import_missing_public_families", "keep_source_config_public_only_and_reviewed"],
      agent02Scheduler: ["raise_cadence_for_stale_high_value_queries", "reuse_live_collection_tasks_without_private_access"],
      agent03Adapters: ["repair_clear_web_or_public_channel_parser_before_ready_state"],
      agent05DarkwebMetadata: ["provide_redacted_metadata_only_context_with_blocked_payload_markers"],
      agent06Evidence: ["replay_public_evidence_ids_into_collected_item_provenance"],
      agent07Quality: ["hold_stale_generic_or_conflicted_answers_until_evidence_improves"],
      agent08GraphStix: ["review_relationships_before_graph_or_stix_export"],
      agent09ApiFields: ["publicSignalFusion.publicSignalLiveCollectionLoop"],
      agent10Release: ["watch_live_collection_loop_status_in_release_gate"]
    },
    guardrails: {
      publicOnly: true,
      safeDarkwebMetadataOnly: true,
      noRawUnsafeUrls: true,
      noCredentials: true,
      noDumps: true,
      noPayloadLinks: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noDefaultActorAssumption: true,
      noStaleCacheCopy: true,
      piiMinimized: true
    }
  };
}

function publicResolverContradictionType(
  conflictType: Exclude<PublicAdvisoryCorrelationConflictType, "none">,
  entityType: keyof PublicSignalMatchedEntities,
  queryClass: string
): PublicConflictContradictionType {
  if (conflictType === "actor_attribution_disagreement") {
    return entityType === "actors" ? "alias_ambiguity" : "actor_attribution_conflict";
  }
  if (conflictType === "cve_actor_overclaim") return "cve_exploitation_disagreement";
  if (conflictType === "sector_country_ambiguity") return "sector_country_ambiguity";
  if (conflictType === "edited_deleted_public_channel") return "edited_deleted_public_channel";
  if (conflictType === "duplicate_vendor_syndication") return "source_family_conflict";
  if (conflictType === "public_channel_only_claim") return entityType === "victims" || queryClass === "victim_company" ? "contradictory_victim_claim" : "public_channel_only_claim";
  if (entityType === "tools" || entityType === "campaigns" || queryClass === "campaign") return "old_campaign_reuse";
  return queryClass === "infrastructure" ? "stale_infrastructure" : "old_campaign_reuse";
}

function publicResolverAffectedQueryClasses(
  contradictionType: PublicConflictContradictionType,
  currentQueryClass: string,
  entityType: keyof PublicSignalMatchedEntities,
  matrix: PublicIntelligenceQueryMatrixDto
): string[] {
  const mapped = new Set<string>([currentQueryClass]);
  if (entityType === "actors") mapped.add("actor");
  if (entityType === "cves") mapped.add("cve_advisory");
  if (entityType === "victims") mapped.add("victim_company");
  if (entityType === "campaigns") mapped.add("campaign");
  if (entityType === "malware" || entityType === "tools") mapped.add("malware_tool");
  if (entityType === "sectors") mapped.add("sector");
  if (entityType === "countries") mapped.add("country");
  if (contradictionType === "stale_infrastructure") mapped.add("infrastructure");
  if (contradictionType === "source_family_conflict") {
    for (const row of matrix.rows.filter((row) => row.primaryBlockers.includes("contradiction_risk"))) mapped.add(row.queryClass);
  }
  return [...mapped].filter((queryClass) => matrix.rows.some((row) => row.queryClass === queryClass) || queryClass === currentQueryClass).sort();
}

function publicResolverReleaseGate(
  severity: PublicAdvisoryCorrelationDto["conflicts"][number]["severity"],
  contradictionType: PublicConflictContradictionType
): PublicConflictContradictionResolverDto["rows"][number]["releaseGate"] {
  if (severity === "hold") return "hold";
  if (contradictionType === "cve_exploitation_disagreement" || contradictionType === "actor_attribution_conflict") return "hold";
  if (contradictionType === "public_channel_only_claim" || contradictionType === "contradictory_victim_claim") return "review";
  return severity === "review" ? "review" : "pass";
}

function publicResolverPublicAnswerEffect(
  releaseGate: PublicConflictContradictionResolverDto["rows"][number]["releaseGate"],
  contradictionType: PublicConflictContradictionType,
  matrixRowsByClass: Map<string, PublicIntelligenceQueryMatrixDto["rows"][number]>,
  affectedQueryClasses: string[]
): PublicConflictContradictionResolverDto["rows"][number]["publicAnswerEffect"] {
  if (releaseGate === "hold") return "hold_fact_promotion";
  if (affectedQueryClasses.some((queryClass) => matrixRowsByClass.get(queryClass)?.state === "searching")) return "keep_searching";
  if (contradictionType === "public_channel_only_claim" || contradictionType === "contradictory_victim_claim" || contradictionType === "source_family_conflict") return "keep_partial";
  return "allow_with_caveat";
}

function publicResolverGraphStixEffect(
  releaseGate: PublicConflictContradictionResolverDto["rows"][number]["releaseGate"],
  contradictionType: PublicConflictContradictionType
): PublicConflictContradictionResolverDto["rows"][number]["graphStixEffect"] {
  if (releaseGate === "hold" || contradictionType === "cve_exploitation_disagreement" || contradictionType === "actor_attribution_conflict") return "stix_export_blocked";
  if (releaseGate === "review" || contradictionType === "source_family_conflict" || contradictionType === "contradictory_victim_claim") return "graph_review_required";
  return "eligible_with_caveat";
}

function publicResolverAnalystActions(
  contradictionType: PublicConflictContradictionType,
  releaseGate: PublicConflictContradictionResolverDto["rows"][number]["releaseGate"]
): PublicConflictContradictionResolverDto["rows"][number]["analystActions"] {
  const actions = new Set<PublicConflictContradictionResolverDto["rows"][number]["analystActions"][number]>(["compare_sources"]);
  if (releaseGate === "hold") actions.add("hold_public_answer");
  if (contradictionType === "actor_attribution_conflict" || contradictionType === "alias_ambiguity" || contradictionType === "cve_exploitation_disagreement") {
    actions.add("review_graph_relationship");
    actions.add("request_more_sources");
  }
  if (contradictionType === "contradictory_victim_claim" || contradictionType === "public_channel_only_claim" || contradictionType === "edited_deleted_public_channel") {
    actions.add("review_victim_claim");
    actions.add("request_more_sources");
  }
  if (contradictionType === "old_campaign_reuse" || contradictionType === "stale_infrastructure") {
    actions.add("raise_cadence");
    actions.add("suppress_stale_repost");
  }
  if (contradictionType === "source_family_conflict") {
    actions.add("dedupe_source_family");
    actions.add("request_more_sources");
  }
  return [...actions];
}

function publicResolverGateRank(gate: PublicConflictContradictionResolverDto["rows"][number]["releaseGate"]): number {
  if (gate === "hold") return 3;
  if (gate === "review") return 2;
  return 1;
}

function publicLiveEntitySpecificity(entities?: Partial<PublicSignalMatchedEntities> & { ttps?: string[] }): number {
  if (!entities) return 0.1;
  const score =
    Math.min(2, entities.actors?.length ?? 0) * 0.18 +
    Math.min(2, entities.cves?.length ?? 0) * 0.18 +
    Math.min(2, entities.victims?.length ?? 0) * 0.18 +
    Math.min(2, entities.malware?.length ?? 0) * 0.12 +
    Math.min(2, entities.tools?.length ?? 0) * 0.12 +
    Math.min(2, entities.campaigns?.length ?? 0) * 0.12 +
    Math.min(2, entities.ttps?.length ?? 0) * 0.12 +
    Math.min(2, entities.sectors?.length ?? 0) * 0.08 +
    Math.min(2, entities.countries?.length ?? 0) * 0.08;
  return roundMetric(clamp01(score));
}

function publicLiveGenericSummary(value: string): boolean {
  const text = normalizeWhitespace(value).toLowerCase();
  if (!text) return true;
  if (text.length < 45) return true;
  return /also known as|is a threat actor|is a hacking group|wikipedia|overview of|general information|background on/.test(text)
    && !/\bcve-\d{4}-\d{4,}\b|victim|observed|exploited|infrastructure|indicator|campaign|advisory|published|reported/.test(text);
}

function publicLiveAggregateScore(
  rows: PublicSignalLiveCollectionLoopDto["normalizedIntake"],
  resolverGate: PublicConflictContradictionResolverDto["summary"]["releaseGate"]
): Omit<PublicSignalLiveCollectionLoopDto["score"], "penalties"> {
  const publicRows = rows.filter((row) => row.provenance.publicOnly && row.state === "accepted");
  const usableRows = publicRows.length > 0 ? publicRows : rows;
  const avg = (selector: (row: PublicSignalLiveCollectionLoopDto["normalizedIntake"][number]) => number) =>
    roundMetric(usableRows.reduce((total, row) => total + selector(row), 0) / Math.max(1, usableRows.length));
  const freshness = avg((row) => row.scores.freshness);
  const familyDiversity = avg((row) => row.scores.familyDiversity);
  const provenanceStrength = avg((row) => row.scores.provenanceStrength);
  const contradictionState = resolverGate === "hold" ? 0.1 : resolverGate === "review" ? 0.48 : avg((row) => row.scores.contradictionState);
  const entitySpecificity = avg((row) => row.scores.entitySpecificity);
  const analystUsefulness = avg((row) => row.scores.analystUsefulness);
  const queryMatch = avg((row) => row.scores.queryMatch);
  const overall = roundMetric(clamp01(
    freshness * 0.18 +
    familyDiversity * 0.16 +
    provenanceStrength * 0.18 +
    contradictionState * 0.14 +
    entitySpecificity * 0.14 +
    analystUsefulness * 0.1 +
    queryMatch * 0.1
  ));
  return { overall, freshness, familyDiversity, provenanceStrength, contradictionState, entitySpecificity, analystUsefulness, queryMatch };
}

function publicLiveCollectionPlaybook(input: {
  queryClass: string;
  requiredFamilies: PublicSignalSourceFamily[];
  missingFamilies: PublicSignalSourceFamily[];
  status: PublicSignalLiveCollectionLoopDto["status"];
  resolverGate: PublicConflictContradictionResolverDto["summary"]["releaseGate"];
  darkwebSignals: number;
}): PublicSignalLiveCollectionLoopDto["playbook"] {
  const cadenceHintsByClass: Record<string, string[]> = {
    actor: ["refresh high-value actor families at least daily", "raise cadence when recent-activity wording is requested"],
    campaign: ["refresh campaign and vendor report sources weekly or on new evidence"],
    malware_tool: ["poll malware/report feeds and clear-web reports before graph promotion"],
    cve_advisory: ["poll GitHub/CERT/vendor advisory APIs frequently during fresh CVE windows"],
    ransomware: ["treat public-channel victim claims as partial until vendor/CERT corroboration"],
    victim_company: ["treat victim claims as review-held until public corroboration is replayable"],
    country: ["blend CERT/government, vendor, and public research on regional cadence"],
    sector: ["blend CERT/government, vendor, and public research on sector cadence"],
    infrastructure: ["refresh malware feeds and clear-web pivots before exporting infrastructure"],
    unknown: ["keep Searching until query-specific evidence appears"]
  };
  const parserExpectationsByClass: Record<string, string[]> = {
    actor: ["actor aliases", "campaign names", "TTPs", "citation spans"],
    campaign: ["campaign names", "actor aliases", "first/last seen dates"],
    malware_tool: ["malware/tool names", "hash/IP/domain indicators", "TTPs"],
    cve_advisory: ["CVE ids", "exploitation status", "affected products", "source timestamps"],
    ransomware: ["actor names", "victim names", "sector/country hints", "public corroboration caveats"],
    victim_company: ["victim names", "sector/country hints", "claim timestamp", "public corroboration caveats"],
    country: ["country names", "sector tags", "actor/campaign hints"],
    sector: ["sector names", "country tags", "actor/campaign hints"],
    infrastructure: ["domains/IPs/URLs as redacted indicators", "first/last seen", "malware/tool links"],
    unknown: ["query-specific entity match", "source family provenance", "freshness"]
  };
  const normalizedClass = input.queryClass === "cve" ? "cve_advisory" : input.queryClass === "malware" ? "malware_tool" : input.queryClass;
  const graphStixHandoff: PublicSignalLiveCollectionLoopDto["playbook"]["graphStixHandoff"] = input.resolverGate === "hold"
    ? "blocked_until_review"
    : input.status === "searching"
      ? "not_enough_evidence"
      : input.status === "held" || input.resolverGate === "review" || input.darkwebSignals > 0
        ? "review_required"
        : "eligible";
  return {
    queryClass: input.queryClass,
    requiredFamilies: input.requiredFamilies,
    cadenceHints: cadenceHintsByClass[normalizedClass] ?? cadenceHintsByClass.unknown,
    parserExpectations: parserExpectationsByClass[normalizedClass] ?? parserExpectationsByClass.unknown,
    evidenceRequirements: [
      "at least one evidence-backed CollectedItem delta for public answer promotion",
      "two or more public source families for strong claims",
      "fresh timestamp suitable for recent activity language",
      "contradiction resolver pass or explicit caveat/review state"
    ],
    graphStixHandoff,
    publicUiStateBehavior: input.status === "ready" ? "ready" : input.status === "partial" ? "partial_with_gaps" : input.status === "held" ? "held" : "searching",
    missingFamilies: input.missingFamilies
  };
}

function buildPublicLiveNextSafeTasks(input: {
  query: string;
  status: PublicSignalLiveCollectionLoopDto["status"];
  missingFamilies: PublicSignalSourceFamily[];
  rows: PublicSignalLiveCollectionLoopDto["normalizedIntake"];
  resolver: PublicConflictContradictionResolverDto;
  coveragePlan: PublicIntelligenceCoveragePlanDto;
  matrix: PublicIntelligenceQueryMatrixDto;
  hasDarkwebMetadata: boolean;
}): PublicSignalLiveCollectionLoopDto["nextSafeCollectionTasks"] {
  const tasks: PublicSignalLiveCollectionLoopDto["nextSafeCollectionTasks"] = [];
  const add = (task: Omit<PublicSignalLiveCollectionLoopDto["nextSafeCollectionTasks"][number], "id" | "dryRunOnly" | "willMutate" | "willStartCrawling" | "noUnsafePayload">) => {
    tasks.push({
      id: `live_task_${hashContent(`${input.query}:${task.owner}:${task.action}:${task.reason}:${task.families.join("|")}`).slice(0, 16)}`,
      ...task,
      families: [...new Set(task.families)].sort() as PublicSignalSourceFamily[],
      dryRunOnly: true,
      willMutate: false,
      willStartCrawling: false,
      noUnsafePayload: true
    });
  };
  if (input.missingFamilies.length > 0) add({ owner: "agent01_source_activation", action: "activate_source_family", priority: "high", reason: "required public source families are absent from live intake", families: input.missingFamilies });
  if (input.rows.some((row) => row.penalties.includes("stale_only"))) add({ owner: "agent02_scheduler", action: "raise_cadence", priority: "high", reason: "stale-only rows cannot support recent activity", families: uniqueCleanStrings(input.rows.filter((row) => row.penalties.includes("stale_only") && PUBLIC_SIGNAL_FAMILIES.includes(row.family as PublicSignalSourceFamily)).map((row) => row.family as PublicSignalSourceFamily)) });
  if (input.coveragePlan.blindSpots.some((spot) => spot.code === "parser_gap")) add({ owner: "agent03_adapter_repair", action: "repair_adapter", priority: "medium", reason: "parser/capture readiness blocks source-family promotion", families: input.coveragePlan.blindSpots.filter((spot) => spot.code === "parser_gap").flatMap((spot) => spot.families) });
  if (input.hasDarkwebMetadata || input.rows.some((row) => row.family === "darkweb_metadata")) add({ owner: "agent05_restricted_metadata", action: "request_restricted_metadata_review", priority: "high", reason: "restricted metadata is present only as redacted context and needs review before any downstream promotion", families: [] });
  if (input.status === "searching" || input.rows.filter((row) => row.evidenceIds.length > 0).length === 0) add({ owner: "agent06_evidence_replay", action: "replay_evidence", priority: "high", reason: "public answer needs replayable evidence-backed CollectedItem ids", families: input.coveragePlan.queryClassSourceMap.find((row) => row.currentQuery)?.requiredFamilies ?? [] });
  if (input.resolver.summary.releaseGate !== "pass") add({ owner: "agent07_quality", action: "analyst_review", priority: "high", reason: "contradiction resolver requires quality review before public fact promotion", families: uniqueCleanStrings(input.resolver.rows.flatMap((row) => row.sourceFamilies)) });
  if (input.matrix.rows.some((row) => row.recommendedNextActions.includes("graph_review")) || input.resolver.summary.releaseGate !== "pass") add({ owner: "agent08_graph_stix", action: "review_graph_pivot", priority: "medium", reason: "graph/STIX relationships must stay review-held until public evidence is corroborated", families: [] });
  add({ owner: "agent09_api", action: "expose_api_state", priority: "medium", reason: "frontends need compact ready/partial/searching/held reasons and next safe task", families: input.missingFamilies });
  add({ owner: "agent10_release", action: "release_gate_watch", priority: input.status === "ready" ? "low" : "medium", reason: "release gates should watch public signal value-loop status and no-leak guardrails", families: [] });
  const byKey = new Map<string, PublicSignalLiveCollectionLoopDto["nextSafeCollectionTasks"][number]>();
  for (const task of tasks) byKey.set(`${task.owner}:${task.action}:${task.families.join("|")}`, task);
  return [...byKey.values()].slice(0, 12);
}

function buildPublicLiveCollectionFixtures(): PublicSignalLiveCollectionLoopDto["queryFixtures"] {
  const fixtures: Array<[string, string, string, PublicSignalLiveCollectionLoopDto["queryFixtures"][number]["expectedState"], boolean]> = [
    ["high_value_known_actor", "APT29", "actor", "partial", false],
    ["stale_high_activity_actor", "APT42", "actor", "partial", false],
    ["random_unknown_actor", "Unseen Quartz Actor", "unknown", "searching", false],
    ["made_up_actor", "Made Up Actor", "unknown", "searching", false],
    ["fresh_cve", "CVE-2026-4242", "cve_advisory", "partial", false],
    ["ransomware_victim", "Akira Fjord Energy AS victim claim", "victim_company", "held", true],
    ["country_sector_surge", "Norway energy sector threats", "sector", "partial", false],
    ["infrastructure_pivot", "malicious infrastructure pivot", "infrastructure", "partial", true],
    ["public_channel_only_weak", "public channel only victim claim", "victim_company", "partial", false],
    ["darkweb_metadata_only_held", "restricted leak metadata claim", "victim_company", "held", true]
  ];
  return fixtures.map(([name, query, queryClass, expectedState, includesDarkwebMetadataHold]) => ({
    name,
    query,
    queryClass,
    expectedState,
    requiredFamilies: requiredFamiliesForPublicBenchmark(queryClass),
    includesDarkwebMetadataHold
  }));
}

export function buildPublicSignalValueImpact(input: PublicSignalValueImpactInput): PublicSignalValueImpactDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryClass = publicSourceBenchmarkQueryClass(input.query, input.entityType);
  const requiredFamilies = requiredFamiliesForPublicBenchmark(queryClass);
  const selectedFamilies = new Set((input.selectedSources ?? []).map((source) => source.family));
  const coveredFamilies = requiredFamilies.filter((family) => selectedFamilies.has(family));
  const missingFamilies = requiredFamilies.filter((family) => !selectedFamilies.has(family));
  const liveLoop = input.publicSignalLiveCollectionLoop ?? buildPublicSignalLiveCollectionLoopDto({
    query: input.query,
    entityType: input.entityType,
    selectedSources: input.selectedSources,
    publicSignalDeltas: input.publicSignalDeltas,
    darkwebMetadataSignals: input.darkwebMetadataSignals,
    generatedAt
  });
  const currentReadiness = liveLoop.score.overall;
  const sourceAtlasImpact = buildPublicValueSourceAtlasImpact({
    query: input.query,
    queryClass,
    requiredFamilies,
    missingFamilies,
    sourcePackExpansion: input.sourcePackExpansion,
    sourceFamilyBenchmarks: input.sourceFamilyBenchmarks,
    currentReadiness
  });
  const darkwebIndexImpact = buildPublicValueDarkwebImpact({
    query: input.query,
    darkwebMetadataSignals: input.darkwebMetadataSignals ?? [],
    currentReadiness,
    generatedAt
  });
  const bestAtlasLift = Math.max(0, ...sourceAtlasImpact.map((row) => row.projectedLift));
  const bestDarkwebLift = Math.max(0, ...darkwebIndexImpact.map((row) => row.projectedLift));
  const projectedWithSourceAtlas = roundMetric(clamp01(currentReadiness + bestAtlasLift));
  const projectedWithDarkwebMetadata = roundMetric(clamp01(currentReadiness + bestDarkwebLift));
  const projectedWithBoth = roundMetric(clamp01(currentReadiness + bestAtlasLift + bestDarkwebLift * 0.5));
  const bestLift = roundMetric(Math.max(projectedWithSourceAtlas, projectedWithDarkwebMetadata, projectedWithBoth) - currentReadiness);
  const hasPublicEvidence = (input.publicSignalDeltas ?? []).some((delta) => delta.provenance.evidenceBacked && delta.state !== "duplicate_suppressed");
  const darkwebOnly = darkwebIndexImpact.length > 0 && !hasPublicEvidence && sourceAtlasImpact.every((row) => !row.improvesAnswer);
  const status: PublicSignalValueImpactDto["status"] = darkwebOnly
    ? "metadata_only_hold"
    : bestLift >= 0.08
      ? "improves_answer"
      : hasPublicEvidence
        ? "no_lift"
        : "needs_public_evidence";
  const readyStateChange: PublicSignalValueImpactDto["answerImpact"]["readyStateChange"] = liveLoop.status === "held" && bestDarkwebLift > 0
    ? "held_to_review"
    : liveLoop.status === "searching" && (bestAtlasLift > 0 || hasPublicEvidence)
      ? "searching_to_partial"
      : liveLoop.status === "partial" && projectedWithBoth >= 0.72 && missingFamilies.length <= 1
        ? "partial_to_ready"
        : "none";
  const gapClosure = buildPublicValueGapClosure({
    queryClass,
    requiredFamilies,
    coveredFamilies,
    missingFamilies,
    projectedWithBoth,
    liveStatus: liveLoop.status,
    sourceAtlasImpact
  });

  return {
    schemaVersion: "ti.public_signal_value_impact.v1",
    generatedAt,
    query: input.query,
    queryClass,
    status,
    answerImpact: {
      currentReadiness,
      projectedWithSourceAtlas,
      projectedWithDarkwebMetadata,
      projectedWithBoth,
      bestLift,
      readyStateChange
    },
    sourceAtlasImpact,
    darkwebIndexImpact,
    gapClosure,
    nextBestActions: buildPublicValueNextBestActions({
      status,
      sourceAtlasImpact,
      darkwebIndexImpact,
      gapClosure,
      hasPublicEvidence,
      liveLoop
    }),
    guardrails: {
      publicOnlyAnswerPromotion: true,
      darkwebMetadataNeverPromotesPublicAnswer: true,
      noRawUnsafeUrls: true,
      noCredentials: true,
      noDumps: true,
      noPayloadLinks: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noDefaultActorAssumption: true,
      noStaleCacheCopy: true
    }
  };
}

function buildPublicValueSourceAtlasImpact(input: {
  query: string;
  queryClass: string;
  requiredFamilies: PublicSignalSourceFamily[];
  missingFamilies: PublicSignalSourceFamily[];
  sourcePackExpansion?: PublicSourcePackExpansionDto;
  sourceFamilyBenchmarks?: PublicSourceFamilyBenchmarksDto;
  currentReadiness: number;
}): PublicSignalValueImpactDto["sourceAtlasImpact"] {
  const rows: PublicSignalValueImpactDto["sourceAtlasImpact"] = [];
  const candidateByFamily = new Map<PublicSignalSourceFamily, PublicSourcePackExpansionDto["candidates"]>();
  for (const candidate of input.sourcePackExpansion?.candidates ?? []) {
    const bucket = candidateByFamily.get(candidate.family) ?? [];
    bucket.push(candidate);
    candidateByFamily.set(candidate.family, bucket);
  }
  for (const family of input.requiredFamilies) {
    const candidates = candidateByFamily.get(family) ?? [];
    const benchmark = input.sourceFamilyBenchmarks?.rows.find((row) => row.family === family);
    const missingFamily = input.missingFamilies.includes(family);
    const readyCandidates = candidates.filter((candidate) => candidate.parserCapability === "ready" || candidate.parserCapability === "metadata_only");
    const parserRepairNeeded = candidates.some((candidate) => candidate.parserCapability === "needs_parser") || (benchmark?.parserReadiness ?? 1) < 0.65;
    const rawLift = (missingFamily ? 0.16 : 0.05)
      + Math.max(0, ...(candidates.map((candidate) => candidate.familyDiversityGain * 0.09 + candidate.expectedEvidenceYield * 0.08)))
      + (benchmark ? (1 - benchmark.coverageScore) * 0.08 + (1 - benchmark.freshnessScore) * 0.04 : 0.04);
    const projectedLift = roundMetric(clamp01(rawLift));
    rows.push({
      id: `value_source_atlas_${hashContent(`${input.query}:${family}:${candidates.map((candidate) => candidate.id).join("|")}`).slice(0, 16)}`,
      family,
      candidateRefs: candidates.map((candidate) => `source_pack_ref_${hashContent(candidate.id).slice(0, 12)}`).slice(0, 8),
      missingFamily,
      projectedLift,
      usefulForQueryClasses: uniqueCleanStrings([input.queryClass, ...(candidates.flatMap((candidate) => candidate.queryClasses ?? []))]).slice(0, 6),
      evidencePrerequisites: ["CollectedItem provenance", "fresh public evidence delta", "source-family corroboration"],
      parserPrerequisites: parserRepairNeeded ? ["parser repair or adapter certification"] : ["parser capability accepted"],
      safeActivationAction: readyCandidates.length > 0 && missingFamily
        ? "promote_source_pack_candidate"
        : parserRepairNeeded
          ? "repair_parser_before_activation"
          : missingFamily
            ? "activate_source_family"
            : "none",
      improvesAnswer: missingFamily || projectedLift >= 0.08
    });
  }
  return rows.sort((left, right) => right.projectedLift - left.projectedLift).slice(0, 12);
}

function buildPublicValueDarkwebImpact(input: {
  query: string;
  darkwebMetadataSignals: PublicSignalDarkwebMetadataInput[];
  currentReadiness: number;
  generatedAt: string;
}): PublicSignalValueImpactDto["darkwebIndexImpact"] {
  const queryTerms = expandPublicSignalQueryTerms(input.query);
  return input.darkwebMetadataSignals
    .filter((signal) => signal.metadataOnly)
    .map((signal) => {
      const hints = {
        actors: uniqueCleanStrings(signal.actors),
        victims: uniqueCleanStrings(signal.victims),
        countries: uniqueCleanStrings(signal.countries),
        sectors: uniqueCleanStrings(signal.sectors),
        ttps: uniqueCleanStrings(signal.ttps)
      };
      const text = `${hints.actors.join(" ")} ${hints.victims.join(" ")} ${hints.countries.join(" ")} ${hints.sectors.join(" ")} ${hints.ttps.join(" ")}`.toLowerCase();
      const match = roundMetric(clamp01(queryTerms.filter((term) => text.includes(term.toLowerCase())).length / Math.max(1, Math.min(queryTerms.length, 4))));
      const freshness = signal.observedAt ? publicBenchmarkSignalFreshness({ observedAt: signal.observedAt }, input.generatedAt) : 0.45;
      const specificity = publicLiveEntitySpecificity(hints);
      const projectedLift = roundMetric(clamp01(match * 0.06 + freshness * 0.04 + specificity * 0.05));
      return {
        id: `value_darkweb_index_${hashContent(`${input.query}:${signal.id}:${signal.redactedSiteId}`).slice(0, 16)}`,
        redactedSiteIds: [signal.redactedSiteId],
        categories: [signal.category],
        riskLabels: [signal.risk],
        liveness: [signal.liveness],
        matchedHints: hints,
        projectedLift,
        reviewState: match > 0 ? "review_required" as const : "not_relevant" as const,
        improvesTriage: match > 0 && projectedLift > 0.03,
        promotesPublicAnswer: false as const
      };
    })
    .sort((left, right) => right.projectedLift - left.projectedLift)
    .slice(0, 10);
}

function buildPublicValueGapClosure(input: {
  queryClass: string;
  requiredFamilies: PublicSignalSourceFamily[];
  coveredFamilies: PublicSignalSourceFamily[];
  missingFamilies: PublicSignalSourceFamily[];
  projectedWithBoth: number;
  liveStatus: PublicSignalLiveCollectionLoopDto["status"];
  sourceAtlasImpact: PublicSignalValueImpactDto["sourceAtlasImpact"];
}): PublicSignalValueImpactDto["gapClosure"] {
  const best = input.sourceAtlasImpact.find((row) => row.improvesAnswer);
  return [{
    queryClass: input.queryClass,
    requiredFamilies: input.requiredFamilies,
    coveredFamilies: input.coveredFamilies,
    missingFamilies: input.missingFamilies,
    bestNextFamily: best?.family,
    expectedStateAfterBestAction: input.liveStatus === "held"
      ? "held"
      : input.projectedWithBoth >= 0.72 && input.missingFamilies.length <= 1
        ? "ready"
        : input.coveredFamilies.length === 0
          ? "searching"
          : "partial"
  }];
}

function buildPublicValueNextBestActions(input: {
  status: PublicSignalValueImpactDto["status"];
  sourceAtlasImpact: PublicSignalValueImpactDto["sourceAtlasImpact"];
  darkwebIndexImpact: PublicSignalValueImpactDto["darkwebIndexImpact"];
  gapClosure: PublicSignalValueImpactDto["gapClosure"];
  hasPublicEvidence: boolean;
  liveLoop: PublicSignalLiveCollectionLoopDto;
}): PublicSignalValueImpactDto["nextBestActions"] {
  const actions: PublicSignalValueImpactDto["nextBestActions"] = [];
  const add = (action: Omit<PublicSignalValueImpactDto["nextBestActions"][number], "dryRunOnly" | "willMutate" | "noUnsafePayload">) => actions.push({
    ...action,
    dryRunOnly: true,
    willMutate: false,
    noUnsafePayload: true
  });
  const bestAtlas = input.sourceAtlasImpact.find((row) => row.improvesAnswer);
  if (bestAtlas) add({ owner: "agent01_source_atlas", action: "stage_source_atlas_candidate", priority: "high", reason: `stage ${bestAtlas.family} because it is the highest expected public answer lift`, expectedLift: bestAtlas.projectedLift });
  if (bestAtlas?.safeActivationAction === "repair_parser_before_activation") add({ owner: "agent03_adapter", action: "repair_parser", priority: "medium", reason: "parser readiness blocks the highest-lift source-family candidate", expectedLift: bestAtlas.projectedLift });
  if (input.liveLoop.score.freshness < 0.45) add({ owner: "agent02_scheduler", action: "raise_refresh_cadence", priority: "high", reason: "freshness is the weakest answer-impact component", expectedLift: roundMetric(0.12) });
  const bestDarkweb = input.darkwebIndexImpact.find((row) => row.improvesTriage);
  if (bestDarkweb) add({ owner: "agent05_darkweb_index", action: "review_metadata_only_context", priority: "medium", reason: "redacted dark-web metadata improves triage but cannot promote a public answer", expectedLift: bestDarkweb.projectedLift });
  if (!input.hasPublicEvidence) add({ owner: "agent06_evidence", action: "replay_evidence", priority: "high", reason: "public answer impact requires replayable evidence-backed CollectedItem ids", expectedLift: roundMetric(0.16) });
  if (input.status === "metadata_only_hold" || input.liveLoop.status === "held") add({ owner: "agent07_quality", action: "hold_or_caveat_answer", priority: "high", reason: "metadata-only or held rows improve triage but must stay caveated", expectedLift: roundMetric(0.04) });
  if (input.liveLoop.playbook.graphStixHandoff !== "eligible") add({ owner: "agent08_graph_stix", action: "review_relationship_export", priority: "medium", reason: "graph/STIX export needs reviewed public evidence before promotion", expectedLift: roundMetric(0.05) });
  add({ owner: "agent09_api", action: "expose_value_lift", priority: "medium", reason: "API/frontend should show whether side-tool signals improve the answer and what action is next", expectedLift: Math.max(0, ...input.sourceAtlasImpact.map((row) => row.projectedLift), ...input.darkwebIndexImpact.map((row) => row.projectedLift)) });
  return actions.slice(0, 10);
}

export function buildPublicCoverageFreshnessValue(input: PublicCoverageFreshnessValueInput): PublicCoverageFreshnessValueDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryClass = publicSourceBenchmarkQueryClass(input.query, input.entityType);
  const selectedSources = input.selectedSources ?? [];
  const publicSignalDeltas = input.publicSignalDeltas ?? [];
  const sourceFamilyBenchmarks = input.sourceFamilyBenchmarks ?? buildPublicSourceFamilyBenchmarks({
    query: input.query,
    entityType: input.entityType,
    selectedSources,
    publicSignalDeltas,
    sourcePackExpansion: input.sourcePackExpansion,
    generatedAt
  });
  const freshnessGapRemediation = input.freshnessGapRemediation ?? buildPublicFreshnessGapRemediation({
    query: input.query,
    entityType: input.entityType,
    selectedSources,
    publicSignalDeltas,
    sourceFamilyBenchmarks,
    sourcePackExpansion: input.sourcePackExpansion,
    generatedAt
  });
  const publicIntelligenceQueryMatrix = input.publicIntelligenceQueryMatrix ?? buildPublicIntelligenceQueryMatrix({
    query: input.query,
    entityType: input.entityType,
    sourceFamilyBenchmarks,
    freshnessGapRemediation,
    generatedAt
  });
  const publicSignalLiveCollectionLoop = input.publicSignalLiveCollectionLoop ?? buildPublicSignalLiveCollectionLoopDto({
    query: input.query,
    entityType: input.entityType,
    selectedSources,
    publicSignalDeltas,
    darkwebMetadataSignals: input.darkwebMetadataSignals,
    freshnessGapRemediation,
    publicIntelligenceQueryMatrix,
    generatedAt
  });
  const publicSignalValueImpact = input.publicSignalValueImpact ?? buildPublicSignalValueImpact({
    query: input.query,
    entityType: input.entityType,
    selectedSources,
    publicSignalDeltas,
    sourcePackExpansion: input.sourcePackExpansion,
    sourceFamilyBenchmarks,
    publicSignalLiveCollectionLoop,
    darkwebMetadataSignals: input.darkwebMetadataSignals,
    generatedAt
  });
  const requiredFamilies = requiredFamiliesForPublicBenchmark(queryClass);
  const selectedByFamily = new Map<PublicSignalSourceFamily, PublicSignalSourceSelectionDto[]>();
  for (const source of selectedSources) {
    const bucket = selectedByFamily.get(source.family) ?? [];
    bucket.push(source);
    selectedByFamily.set(source.family, bucket);
  }
  const deltasByFamily = new Map<PublicSignalSourceFamily, PublicSignalDeltaDto[]>();
  for (const delta of publicSignalDeltas) {
    const bucket = deltasByFamily.get(delta.family) ?? [];
    bucket.push(delta);
    deltasByFamily.set(delta.family, bucket);
  }
  const impactByFamily = new Map(publicSignalValueImpact.sourceAtlasImpact.map((row) => [row.family, row]));
  const matrixByQueryClass = new Map(publicIntelligenceQueryMatrix.rows.map((row) => [row.queryClass, row]));
  const currentMatrixRow = matrixByQueryClass.get(queryClass);
  const familyFreshness = sourceFamilyBenchmarks.rows
    .filter((row) => requiredFamilies.includes(row.family) || row.selectedSourceCount > 0 || row.candidateSourceCount > 0)
    .map((row) => {
      const familyDeltas = deltasByFamily.get(row.family) ?? [];
      const sourceRefs = (selectedByFamily.get(row.family) ?? []).map((source) => source.sourceId).sort().slice(0, 10);
      const signalRefs = uniqueCleanStrings([...row.relatedSignalIds, ...familyDeltas.map((delta) => delta.id)]).slice(0, 10);
      const latestEvidenceAgeDays = latestPublicFamilyEvidenceAgeDays(familyDeltas, generatedAt);
      const requiredForQuery = requiredFamilies.includes(row.family);
      const targetFreshnessDays = publicCoverageTargetFreshnessDays(queryClass, row.family);
      const valueImpact = impactByFamily.get(row.family);
      const expectedAnswerLift = valueImpact?.projectedLift ?? roundMetric(clamp01((1 - row.coverageScore) * 0.08 + (1 - row.freshnessScore) * 0.06));
      const hasMetadataHold = publicSignalLiveCollectionLoop.normalizedIntake.some((item) => item.family === row.family && item.provenance.metadataOnly);
      const state: PublicCoverageFreshnessValueDto["familyFreshness"][number]["state"] = hasMetadataHold
        ? "held"
        : row.selectedSourceCount === 0 && row.usefulSignalCount === 0
          ? "missing"
          : latestEvidenceAgeDays !== "unknown" && latestEvidenceAgeDays > targetFreshnessDays || row.freshnessScore < 0.35
            ? "stale"
            : row.freshnessScore < 0.62
              ? "aging"
              : "fresh";
      const nextAction: PublicCoverageFreshnessValueDto["familyFreshness"][number]["nextAction"] = state === "held" || row.contradictionRate >= 0.35
        ? "quality_hold"
        : state === "missing"
          ? "activate_source_family"
          : row.parserReadiness < 0.6
            ? "repair_parser"
            : row.evidenceYield < 0.35
              ? "replay_evidence"
              : state === "stale" || state === "aging"
                ? "raise_cadence"
                : "none";
      return {
        family: row.family,
        requiredForQuery,
        selectedSourceCount: row.selectedSourceCount,
        usefulSignalCount: row.usefulSignalCount,
        latestEvidenceAgeDays,
        targetFreshnessDays,
        freshnessScore: row.freshnessScore,
        coverageScore: row.coverageScore,
        parserReadiness: row.parserReadiness,
        expectedAnswerLift,
        state,
        nextAction,
        sourceRefs,
        signalRefs
      };
    })
    .sort((left, right) => {
      const stateRank = { held: 0, stale: 1, missing: 2, aging: 3, fresh: 4 };
      return stateRank[left.state] - stateRank[right.state] || right.expectedAnswerLift - left.expectedAnswerLift;
    })
    .slice(0, 14);
  const queryClassFreshness = publicIntelligenceQueryMatrix.rows.map((row) => {
    const bestNextFamily = row.sourceFamilies.missing[0] ?? familyFreshness
      .filter((family) => row.sourceFamilies.required.includes(family.family) && family.nextAction !== "none")
      .sort((left, right) => right.expectedAnswerLift - left.expectedAnswerLift)[0]?.family;
    return {
      queryClass: row.queryClass,
      currentQuery: row.currentQuery,
      requiredFamilies: row.sourceFamilies.required,
      coveredFamilies: row.sourceFamilies.covered,
      missingFamilies: row.sourceFamilies.missing,
      freshnessScore: row.scores.freshness,
      publicAnswerReadiness: row.scores.publicAnswerReadiness,
      canImprovePublicAnswer: row.scores.publicAnswerReadiness < 0.78 || row.sourceFamilies.missing.length > 0 || row.primaryBlockers.length > 0,
      bestNextFamily
    };
  });
  const sourceAtlasFreshnessImpact = buildPublicCoverageSourceAtlasFreshnessImpact({
    query: input.query,
    queryClass,
    sourcePackExpansion: input.sourcePackExpansion,
    familyFreshness,
    valueImpact: publicSignalValueImpact
  });
  const highValueCoverage = buildPublicCoverageHighValueRows({
    query: input.query,
    queryClass,
    generatedAt,
    requiredFamilies,
    currentMatrixRow,
    publicSignalDeltas,
    freshnessGapRemediation
  });
  const staleFamilies = familyFreshness.filter((row) => row.state === "stale" || row.state === "aging").map((row) => row.family);
  const noEvidenceFamilies = familyFreshness.filter((row) => row.usefulSignalCount === 0 && row.requiredForQuery).map((row) => row.family);
  const metadataOnlyFamilies = uniqueCleanStrings(publicSignalLiveCollectionLoop.normalizedIntake.filter((row) => row.provenance.metadataOnly).map((row) => row.family));
  const contradictionHold = publicIntelligenceQueryMatrix.rows.some((row) => row.state === "hold" || row.primaryBlockers.includes("contradiction_risk"));
  const darkwebMetadataOnlyHold = metadataOnlyFamilies.includes("darkweb_metadata") || publicSignalValueImpact.status === "metadata_only_hold";
  const publicEvidenceReady = freshnessGapRemediation.answerState.evidenceReady && publicSignalLiveCollectionLoop.score.provenanceStrength >= 0.55;
  const staleFamilyCount = staleFamilies.length;
  const missingFamilyCount = currentMatrixRow?.sourceFamilies.missing.length ?? requiredFamilies.length;
  const expectedAnswerLift = roundMetric(Math.max(
    publicSignalValueImpact.answerImpact.bestLift,
    ...familyFreshness.map((row) => row.expectedAnswerLift),
    ...sourceAtlasFreshnessImpact.map((row) => row.expectedAnswerLift)
  ));
  const coverageFreshnessScore = roundMetric(clamp01(
    publicSignalLiveCollectionLoop.score.overall * 0.34 +
    (currentMatrixRow?.scores.freshness ?? 0) * 0.24 +
    (currentMatrixRow?.scores.coverage ?? 0) * 0.2 +
    (publicEvidenceReady ? 0.12 : 0) -
    Math.min(0.2, staleFamilyCount * 0.04) -
    Math.min(0.18, missingFamilyCount * 0.05)
  ));
  const releaseBlockers = uniqueCleanStrings([
    ...freshnessGapRemediation.releaseGate.holdReasons,
    ...(staleFamilies.length > 0 ? ["stale_public_source_family"] : []),
    ...(noEvidenceFamilies.length > 0 ? ["no_evidence_for_required_family"] : []),
    ...(darkwebMetadataOnlyHold ? ["metadata_only_context_cannot_promote_answer"] : []),
    ...(contradictionHold ? ["contradiction_hold"] : [])
  ]);
  const status: PublicCoverageFreshnessValueDto["status"] = darkwebMetadataOnlyHold
    ? "held_metadata_only"
    : contradictionHold || staleFamilyCount > 0
      ? "stale_value_risk"
      : missingFamilyCount > 0
        ? "coverage_gap"
        : expectedAnswerLift >= 0.08
          ? "freshness_improving"
          : "ready_value_fresh";

  return {
    schemaVersion: "ti.public_coverage_freshness_value.v1",
    generatedAt,
    query: input.query,
    queryClass,
    status,
    summary: {
      coverageFreshnessScore,
      currentAnswerReadiness: publicSignalLiveCollectionLoop.score.overall,
      expectedAnswerLift,
      staleFamilyCount,
      missingFamilyCount,
      highValueActorFreshnessMet: freshnessGapRemediation.highVolumeActorFreshness.state === "fresh" || freshnessGapRemediation.highVolumeActorFreshness.state === "not_applicable",
      publicEvidenceReady,
      darkwebMetadataOnlyHold
    },
    familyFreshness,
    queryClassFreshness,
    sourceAtlasFreshnessImpact,
    highValueCoverage,
    staleRisk: {
      staleOnlyRecentActivityRejected: freshnessGapRemediation.answerState.staleOnlyRecentActivityRejected,
      staleFamilies,
      noEvidenceFamilies,
      metadataOnlyFamilies,
      contradictionHold,
      releaseBlockers
    },
    handoffs: {
      agent01SourceAtlas: sourceAtlasFreshnessImpact.length > 0 ? ["stage_high_lift_public_source_candidates_by_family"] : [],
      agent02SchedulerCadence: staleFamilies.length > 0 ? ["raise_refresh_cadence_for_stale_value_families"] : [],
      agent03AdapterRepair: familyFreshness.some((row) => row.nextAction === "repair_parser") || sourceAtlasFreshnessImpact.some((row) => row.activationState === "needs_parser_repair") ? ["repair_parser_before_source_promotion"] : [],
      agent05DarkwebMetadata: darkwebMetadataOnlyHold ? ["keep_darkweb_rows_metadata_only_triage_context"] : [],
      agent06EvidenceReplay: noEvidenceFamilies.length > 0 || !publicEvidenceReady ? ["replay_collected_items_for_required_public_families"] : [],
      agent07Quality: releaseBlockers.length > 0 ? ["hold_or_caveat_stale_metadata_only_or_conflicted_public_claims"] : [],
      agent08GraphStix: publicSignalLiveCollectionLoop.playbook.graphStixHandoff === "eligible" ? ["export_only_evidence_backed_fresh_relationships"] : ["block_graph_stix_promotion_until_public_evidence_is_fresh"],
      agent09ApiFields: ["publicSignalFusion.publicCoverageFreshnessValue"],
      agent10Release: status === "ready_value_fresh" ? ["include_coverage_freshness_value_in_release_promote_packet"] : ["gate_release_on_coverage_freshness_value_blockers"]
    },
    guardrails: {
      publicOnly: true,
      darkwebMetadataTriageOnly: true,
      noRawUnsafeUrls: true,
      noCredentials: true,
      noDumps: true,
      noPayloadLinks: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noDefaultActorAssumption: true,
      noStaleCacheCopy: true,
      piiMinimized: true
    }
  };
}

function buildPublicCoverageSourceAtlasFreshnessImpact(input: {
  query: string;
  queryClass: string;
  sourcePackExpansion?: PublicSourcePackExpansionDto;
  familyFreshness: PublicCoverageFreshnessValueDto["familyFreshness"];
  valueImpact: PublicSignalValueImpactDto;
}): PublicCoverageFreshnessValueDto["sourceAtlasFreshnessImpact"] {
  const familyRows = new Map(input.familyFreshness.map((row) => [row.family, row]));
  const valueRows = new Map(input.valueImpact.sourceAtlasImpact.map((row) => [row.family, row]));
  const candidatesByFamily = new Map<PublicSignalSourceFamily, PublicSourcePackExpansionDto["candidates"]>();
  for (const candidate of input.sourcePackExpansion?.candidates ?? []) {
    const bucket = candidatesByFamily.get(candidate.family) ?? [];
    bucket.push(candidate);
    candidatesByFamily.set(candidate.family, bucket);
  }
  const families = uniqueCleanStrings([
    ...candidatesByFamily.keys(),
    ...input.valueImpact.sourceAtlasImpact.map((row) => row.family),
    ...input.familyFreshness.filter((row) => row.requiredForQuery && row.nextAction !== "none").map((row) => row.family)
  ]);
  return families.map((family) => {
    const candidates = candidatesByFamily.get(family) ?? [];
    const familyRow = familyRows.get(family);
    const valueRow = valueRows.get(family);
    const activeCandidates = candidates.filter((candidate) => !candidate.staleSuppressed && !candidate.duplicateSuppressed && candidate.onboardingRecommendation !== "blocked");
    const parserReady = activeCandidates.some((candidate) => candidate.parserCapability === "ready" || candidate.parserCapability === "metadata_only");
    const expectedFreshnessGain = roundMetric(Math.max(0, ...activeCandidates.map((candidate) => candidate.freshness * 0.14), familyRow?.state === "stale" ? 0.16 : 0));
    const expectedEvidenceYieldGain = roundMetric(Math.max(0, ...activeCandidates.map((candidate) => candidate.expectedEvidenceYield * 0.12), familyRow?.usefulSignalCount === 0 ? 0.12 : 0));
    const expectedAnswerLift = roundMetric(clamp01((valueRow?.projectedLift ?? 0) + expectedFreshnessGain * 0.35 + expectedEvidenceYieldGain * 0.4));
    const activationState: PublicCoverageFreshnessValueDto["sourceAtlasFreshnessImpact"][number]["activationState"] = activeCandidates.length === 0
      ? "blocked_or_stale"
      : activeCandidates.some((candidate) => candidate.parserCapability === "needs_parser")
        ? "needs_parser_repair"
        : activeCandidates.every((candidate) => candidate.parserCapability === "metadata_only")
          ? "metadata_only"
          : "ready_to_stage";
    return {
      id: `coverage_freshness_source_atlas_${hashContent(`${input.query}:${family}:${activeCandidates.map((candidate) => candidate.id).join("|")}`).slice(0, 16)}`,
      family,
      candidateRefs: activeCandidates.map((candidate) => `source_pack_ref_${hashContent(candidate.id).slice(0, 12)}`).slice(0, 8),
      expectedFreshnessGain,
      expectedEvidenceYieldGain,
      expectedAnswerLift,
      parserReady,
      activationState,
      safeForPublicPromotion: activationState === "ready_to_stage" && parserReady
    };
  })
    .filter((row) => row.expectedAnswerLift > 0 || row.activationState !== "blocked_or_stale")
    .sort((left, right) => right.expectedAnswerLift - left.expectedAnswerLift)
    .slice(0, 12);
}

function buildPublicCoverageHighValueRows(input: {
  query: string;
  queryClass: string;
  generatedAt: string;
  requiredFamilies: PublicSignalSourceFamily[];
  currentMatrixRow?: PublicIntelligenceQueryMatrixDto["rows"][number];
  publicSignalDeltas: PublicSignalDeltaDto[];
  freshnessGapRemediation: PublicFreshnessGapRemediationDto;
}): PublicCoverageFreshnessValueDto["highValueCoverage"] {
  const trackedActors = ["APT29", "APT42", "Sandworm", "Volt Typhoon", "Lazarus", "LockBit", "Akira"];
  const lowerQuery = input.query.toLowerCase();
  const queryEntity = uniqueCleanStrings([input.query])[0] ?? "current_query";
  const rows = trackedActors.map((actor) => {
    const matchedCurrentQuery = lowerQuery.includes(actor.toLowerCase());
    const actorDeltas = input.publicSignalDeltas.filter((delta) => publicSignalDeltaMentions(delta, actor));
    const latestEvidenceAgeDays = latestPublicFamilyEvidenceAgeDays(actorDeltas, input.generatedAt);
    const coveredFamilies = uniqueCleanStrings(actorDeltas.map((delta) => delta.family));
    const missingFamilies = input.requiredFamilies.filter((family) => !coveredFamilies.includes(family));
    const state: PublicCoverageFreshnessValueDto["highValueCoverage"][number]["state"] = matchedCurrentQuery
      ? input.freshnessGapRemediation.highVolumeActorFreshness.state === "not_applicable" ? "searching" : input.freshnessGapRemediation.highVolumeActorFreshness.state
      : actorDeltas.length === 0
        ? "not_applicable"
        : latestEvidenceAgeDays !== "unknown" && latestEvidenceAgeDays <= 14
          ? "fresh"
          : "stale";
    return {
      entity: actor,
      entityType: actor === "LockBit" || actor === "Akira" ? "ransomware" as const : "actor" as const,
      matchedCurrentQuery,
      state,
      targetFreshnessDays: 14,
      latestEvidenceAgeDays,
      coveredFamilies,
      missingFamilies,
      nextAction: state === "fresh"
        ? "none" as const
        : state === "stale"
          ? "raise_cadence" as const
          : missingFamilies.length > 0 && matchedCurrentQuery
            ? "activate_source_family" as const
            : "none" as const
    };
  });
  rows.push({
    entity: queryEntity,
    entityType: "query_entity",
    matchedCurrentQuery: true,
    state: input.currentMatrixRow?.state === "ready" ? "fresh" : input.currentMatrixRow?.state === "searching" ? "searching" : "stale",
    targetFreshnessDays: publicCoverageTargetFreshnessDays(input.queryClass, input.requiredFamilies[0]),
    latestEvidenceAgeDays: latestPublicFamilyEvidenceAgeDays(input.publicSignalDeltas, input.generatedAt),
    coveredFamilies: input.currentMatrixRow?.sourceFamilies.covered ?? [],
    missingFamilies: input.currentMatrixRow?.sourceFamilies.missing ?? input.requiredFamilies,
    nextAction: input.currentMatrixRow?.sourceFamilies.missing.length ? "activate_source_family" : input.currentMatrixRow?.scores.freshness && input.currentMatrixRow.scores.freshness < 0.55 ? "raise_cadence" : "replay_evidence"
  });
  return rows;
}

function latestPublicFamilyEvidenceAgeDays(deltas: PublicSignalDeltaDto[], generatedAt: string): number | "unknown" {
  const ages = deltas
    .filter((delta) => delta.state !== "duplicate_suppressed" && delta.provenance.evidenceBacked)
    .map((delta) => delta.observedAt ?? delta.publishedAt ?? delta.collectedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => ageDays(value, generatedAt))
    .filter((value): value is number => value !== "unknown");
  if (ages.length === 0) return "unknown";
  return Math.min(...ages);
}

function publicCoverageTargetFreshnessDays(queryClass: string, family: PublicSignalSourceFamily): number {
  if (queryClass === "victim_company" || queryClass === "ransomware") return 3;
  if (queryClass === "cve_advisory" || family === "cert_government" || family === "github_advisory") return 7;
  if (queryClass === "actor" || queryClass === "campaign") return 14;
  return 30;
}

function publicSignalDeltaMentions(delta: PublicSignalDeltaDto, entity: string): boolean {
  const lowerEntity = entity.toLowerCase();
  const fields = [
    delta.title,
    delta.summary,
    ...(delta.tags ?? []),
    ...(delta.matchedEntities?.actors ?? []),
    ...(delta.matchedEntities?.campaigns ?? []),
    ...(delta.matchedEntities?.victims ?? [])
  ];
  return fields.some((value) => value?.toLowerCase().includes(lowerEntity));
}

function publicQueryMatrixExampleQuery(queryClass: string): string {
  if (queryClass === "actor") return "APT29";
  if (queryClass === "ransomware") return "Akira ransomware";
  if (queryClass === "campaign") return "diplomatic phishing campaign";
  if (queryClass === "malware_tool") return "Snake malware";
  if (queryClass === "cve_advisory") return "CVE-2026-4242";
  if (queryClass === "sector") return "energy sector threats";
  if (queryClass === "country") return "Norway cyber activity";
  if (queryClass === "victim_company") return "Fjord Energy AS victim claim";
  if (queryClass === "infrastructure") return "malicious infrastructure";
  return "Made Up Actor";
}

function buildHighVolumeActorFreshnessState(
  query: string,
  deltas: PublicSignalDeltaDto[],
  selectedSources: PublicSignalSourceSelectionDto[],
  generatedAt: string
): PublicFreshnessGapRemediationDto["highVolumeActorFreshness"] {
  const trackedActors = ["APT29", "APT42", "Sandworm", "Volt Typhoon", "Lazarus", "LockBit", "Akira"];
  const lowerQuery = query.toLowerCase();
  const matchedActor = trackedActors.find((actor) => lowerQuery.includes(actor.toLowerCase()));
  const targetFreshnessSeconds = 14 * 86_400;
  if (!matchedActor) {
    return {
      trackedActors,
      targetFreshnessSeconds,
      state: "not_applicable",
      staleRecentActivityPromotionAllowed: false
    };
  }

  const relevantDeltas = deltas.filter((delta) => {
    const text = `${delta.title ?? ""} ${delta.matchedEntities?.actors?.join(" ") ?? ""} ${(delta.tags ?? []).join(" ")}`.toLowerCase();
    return text.includes(matchedActor.toLowerCase());
  });
  const latestEvidenceAt = latestPublicSignalTimestamp(relevantDeltas);
  if (!latestEvidenceAt) {
    const bestSourceFreshness = Math.max(0, ...selectedSources.map((source) => source.freshness));
    return {
      matchedActor,
      trackedActors,
      targetFreshnessSeconds,
      state: bestSourceFreshness > 0 ? "searching" : "stale",
      staleRecentActivityPromotionAllowed: false
    };
  }
  const ageSeconds = Math.max(0, Math.floor((Date.parse(generatedAt) - Date.parse(latestEvidenceAt)) / 1000));
  return {
    matchedActor,
    trackedActors,
    targetFreshnessSeconds,
    latestEvidenceAt,
    latestEvidenceAgeSeconds: Number.isFinite(ageSeconds) ? ageSeconds : undefined,
    state: Number.isFinite(ageSeconds) && ageSeconds <= targetFreshnessSeconds ? "fresh" : "stale",
    staleRecentActivityPromotionAllowed: false
  };
}

function latestPublicSignalTimestamp(deltas: PublicSignalDeltaDto[]): string | undefined {
  const timestamps = deltas
    .map((delta) => delta.observedAt ?? delta.publishedAt ?? delta.collectedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left));
  return timestamps[0];
}

function buildPublicFreshnessRemediationActions(input: {
  query: string;
  queryClass: string;
  coveragePlan: PublicIntelligenceCoveragePlanDto;
  benchmarks: PublicSourceFamilyBenchmarksDto;
  highVolumeActorState: PublicFreshnessGapRemediationDto["highVolumeActorFreshness"]["state"];
}): PublicFreshnessGapRemediationDto["remediationActions"] {
  const actions: PublicFreshnessGapRemediationDto["remediationActions"] = [];
  const add = (action: Omit<PublicFreshnessGapRemediationDto["remediationActions"][number], "id" | "queryClass" | "dryRunOnly" | "willMutate" | "willStartCrawling" | "unsafeUrlExposed">) => {
    const families = [...new Set(action.families)].sort() as PublicSignalSourceFamily[];
    actions.push({
      id: `fresh_gap_${hashContent(`${input.query}:${action.owner}:${action.action}:${families.join("|")}:${action.reason}`).slice(0, 16)}`,
      queryClass: input.queryClass,
      ...action,
      families,
      sourcePackCandidateIds: uniqueCleanStrings(action.sourcePackCandidateIds).slice(0, 8),
      dryRunOnly: true,
      willMutate: false,
      willStartCrawling: false,
      unsafeUrlExposed: false
    });
  };

  for (const recommendation of input.coveragePlan.safeSourcePackRecommendations) {
    if (recommendation.action === "promote_source_pack_candidate" || recommendation.action === "add_curated_public_source") {
      add({
        owner: "agent01_source_activation",
        action: "activate_public_source_family",
        families: [recommendation.family],
        priority: recommendation.priority,
        reason: "safe public source-family expansion is needed before this query class can move toward ready",
        expectedStateChange: "searching_to_partial",
        sourcePackCandidateIds: recommendation.sourcePackCandidateIds
      });
    }
  }

  const staleFamilies = input.coveragePlan.blindSpots
    .filter((spot) => spot.code === "stale_actor_activity" || spot.code === "old_seed_cache_reliance")
    .flatMap((spot) => spot.families);
  if (staleFamilies.length > 0 || input.highVolumeActorState === "stale") {
    add({
      owner: "agent02_scheduler_cadence",
      action: "raise_cadence",
      families: staleFamilies.length > 0 ? staleFamilies : input.coveragePlan.queryClassSourceMap.find((row) => row.currentQuery)?.requiredFamilies ?? [],
      priority: "high",
      reason: "recent activity would otherwise be stale-only; cadence must refresh public evidence before promotion",
      expectedStateChange: "stale_to_partial",
      sourcePackCandidateIds: []
    });
    add({
      owner: "agent07_quality_hold",
      action: "hold_answer_quality",
      families: staleFamilies,
      priority: "high",
      reason: "stale-only high-volume actor activity is not allowed to appear authoritative",
      expectedStateChange: "stale_to_partial",
      sourcePackCandidateIds: []
    });
  }

  const parserFamilies = input.coveragePlan.blindSpots.filter((spot) => spot.code === "parser_gap").flatMap((spot) => spot.families);
  if (parserFamilies.length > 0) {
    add({
      owner: "agent03_parser_repair",
      action: "repair_parser_or_capture",
      families: parserFamilies,
      priority: "medium",
      reason: "parser or capture readiness is below the threshold for counting public source-family coverage",
      expectedStateChange: "partial_to_ready",
      sourcePackCandidateIds: []
    });
  }

  if (input.coveragePlan.blindSpots.some((spot) => spot.code === "no_public_evidence" || spot.code === "old_seed_cache_reliance")) {
    add({
      owner: "agent06_evidence_coverage",
      action: "replay_or_verify_evidence",
      families: input.coveragePlan.queryClassSourceMap.find((row) => row.currentQuery)?.requiredFamilies ?? [],
      priority: "high",
      reason: "fresh public evidence must be replayable before the answer can leave Searching or partial state",
      expectedStateChange: "searching_to_partial",
      sourcePackCandidateIds: []
    });
  }

  if (input.coveragePlan.blindSpots.some((spot) => spot.code === "contradiction_cluster")) {
    add({
      owner: "agent08_graph_pivot",
      action: "add_graph_pivot_review",
      families: input.coveragePlan.blindSpots.filter((spot) => spot.code === "contradiction_cluster").flatMap((spot) => spot.families),
      priority: "high",
      reason: "contradictory public evidence needs graph/relationship review before public fact promotion",
      expectedStateChange: "hold_to_review",
      sourcePackCandidateIds: []
    });
  }

  if (actions.length > 0 || input.benchmarks.status !== "ready") {
    add({
      owner: "agent09_api_field",
      action: "expose_status_field",
      families: input.coveragePlan.queryClassSourceMap.find((row) => row.currentQuery)?.missingFamilies ?? [],
      priority: "medium",
      reason: "frontends need compact searching/partial/stale/source-gap reasons while collection catches up",
      expectedStateChange: "api_explainability",
      sourcePackCandidateIds: []
    });
  }

  const byKey = new Map<string, PublicFreshnessGapRemediationDto["remediationActions"][number]>();
  for (const action of actions) byKey.set(`${action.owner}:${action.action}:${action.families.join("|")}`, action);
  return [...byKey.values()].slice(0, 18);
}

function publicFreshnessCompactReason(
  status: PublicFreshnessGapRemediationDto["status"],
  holdReasons: string[],
  activationNeeded: boolean,
  staleOnlyRecentActivityRejected: boolean
): string {
  if (staleOnlyRecentActivityRejected) return "fresh public evidence is required before recent activity can be promoted";
  if (holdReasons.includes("no_public_evidence")) return "Searching; no evidence-backed public answer is available yet";
  if (holdReasons.length > 0 || status === "hold") return "public answer is held until coverage, contradiction, or evidence gaps are resolved";
  if (activationNeeded) return "partial public context is available; additional approved public source families are needed";
  if (status === "searching") return "Searching approved public sources for query-specific evidence";
  if (status === "ready") return "fresh public evidence coverage is ready for promotion";
  return "partial public context is available while freshness remediation continues";
}

function buildPublicFreshnessQueryFixtures(
  coveragePlan: PublicIntelligenceCoveragePlanDto
): PublicFreshnessGapRemediationDto["queryFixtures"] {
  const fixtureQueries: Array<[string, string]> = [
    ["APT29", "actor"],
    ["APT42", "actor"],
    ["Sandworm", "actor"],
    ["Volt Typhoon", "actor"],
    ["Lazarus", "actor"],
    ["LockBit ransomware", "ransomware"],
    ["Akira ransomware", "ransomware"],
    ["CVE-2026-4242", "cve_advisory"],
    ["energy sector threats", "sector"],
    ["Norway cyber activity", "country"],
    ["Fjord Energy AS victim claim", "victim_company"],
    ["Made Up Actor", "actor"]
  ];
  return fixtureQueries.map(([query, queryClass]) => {
    const requiredFamilies = requiredFamiliesForPublicBenchmark(queryClass);
    const isMadeUp = query === "Made Up Actor";
    return {
      query,
      queryClass,
      expectedState: isMadeUp
        ? "searching"
        : coveragePlan.status === "hold" && queryClass === coveragePlan.queryClass
          ? "hold"
          : requiredFamilies.every((family) => coveragePlan.queryClassSourceMap.find((row) => row.queryClass === queryClass)?.coveredFamilies.includes(family))
            ? "ready"
            : "partial",
      requiredFamilies,
      staleRecentActivityAllowed: false,
      defaultActorFallbackAllowed: false
    };
  });
}

function buildPublicCoverageBlindSpotsLegacy(input: {
  query: string;
  queryClass: string;
  generatedAt: string;
  selectedSources: PublicSignalSourceSelectionDto[];
  publicSignalDeltas: PublicSignalDeltaDto[];
  advisoryConnector?: PublicAdvisorySignalConnectorDto;
  coverageRadar?: EnterpriseSourceCoverageRadarDto;
  advisoryCorrelation?: PublicAdvisoryCorrelationDto;
  sourceFamilyBenchmarks: PublicSourceFamilyBenchmarksDto;
}): PublicIntelligenceCoveragePlanDto["blindSpots"] {
  const spots: PublicIntelligenceCoveragePlanDto["blindSpots"] = [];
  const add = (
    code: PublicIntelligenceCoveragePlanDto["blindSpots"][number]["code"],
    severity: PublicIntelligenceCoveragePlanDto["blindSpots"][number]["severity"],
    families: PublicSignalSourceFamily[],
    sourceIds: string[],
    evidenceIds: string[],
    reason: string,
    releaseImpact: PublicIntelligenceCoveragePlanDto["blindSpots"][number]["releaseImpact"]
  ) => {
    spots.push({
      id: `public_coverage_blindspot_${hashContent(`${input.query}:${code}:${families.join("|")}:${sourceIds.join("|")}:${evidenceIds.join("|")}`).slice(0, 16)}`,
      code,
      severity,
      families: [...new Set(families)].sort(),
      sourceIds: [...new Set(sourceIds)].sort().slice(0, 12),
      evidenceIds: [...new Set(evidenceIds)].sort().slice(0, 12),
      reason,
      releaseImpact
    });
  };

  const staleRows = input.sourceFamilyBenchmarks.rows.filter((row) => row.freshnessScore > 0 && row.freshnessScore < 0.45);
  if (staleRows.length > 0) {
    add("stale_actor_activity", "review", staleRows.map((row) => row.family), staleRows.flatMap((row) => row.relatedSourceIds), staleRows.flatMap((row) => row.relatedSignalIds), "freshness score is too low for current actor or campaign activity wording", "partial_answer_only");
  }
  const missingRows = input.sourceFamilyBenchmarks.rows.filter((row) => row.status === "needs_expansion" || row.status === "searching");
  if (missingRows.length > 0) {
    add("source_family_blind_spot", input.sourceFamilyBenchmarks.queryClassCoverage.unknownQuerySearching ? "hold" : "review", missingRows.map((row) => row.family), [], [], "required public source families are missing or too thin for this query class", input.sourceFamilyBenchmarks.queryClassCoverage.unknownQuerySearching ? "searching_only" : "partial_answer_only");
  }
  const conflicts = input.advisoryCorrelation?.conflicts ?? [];
  if (conflicts.length > 0) {
    add("contradiction_cluster", conflicts.some((conflict) => conflict.severity === "hold") ? "hold" : "review", conflicts.flatMap((conflict) => conflict.sourceFamilies), conflicts.flatMap((conflict) => conflict.sourceIds), conflicts.flatMap((conflict) => conflict.evidenceIds), "public signals disagree on attribution, CVE exploitation, sector/country, stale repost, or public-channel-only claims", conflicts.some((conflict) => conflict.severity === "hold") ? "hold_public_answer" : "partial_answer_only");
  }
  const parserRows = input.sourceFamilyBenchmarks.rows.filter((row) => row.parserReadiness < 0.55);
  if (parserRows.length > 0 || input.coverageRadar?.gaps.some((gap) => gap.code === "parser_gap")) {
    add("parser_gap", "review", parserRows.map((row) => row.family), parserRows.flatMap((row) => row.relatedSourceIds), parserRows.flatMap((row) => row.relatedSignalIds), "parser readiness is below the threshold for confident public coverage", "partial_answer_only");
  }
  const seedHeavySources = input.selectedSources.filter((source) =>
    source.sourceId.toLowerCase().includes("seed") ||
    source.decayReasons.some((reason) => /stale|already emitted|approval/.test(reason)) ||
    source.freshness < 0.45
  );
  if (seedHeavySources.length > 0 && input.publicSignalDeltas.length <= 1) {
    add("old_seed_cache_reliance", "review", seedHeavySources.map((source) => source.family), seedHeavySources.map((source) => source.sourceId), input.publicSignalDeltas.map((delta) => delta.id), "answer would over-rely on stale seed/cache-like source hints instead of fresh evidence deltas", "partial_answer_only");
  }
  if (input.sourceFamilyBenchmarks.queryClassCoverage.unknownQuerySearching || (input.advisoryConnector?.fastInitialSummary.canAnswerImmediately === false && input.publicSignalDeltas.length === 0)) {
    add("no_public_evidence", "hold", input.sourceFamilyBenchmarks.queryClassCoverage.requiredFamilies, [], [], "no evidence-backed public answer is available; keep the product in Searching", "searching_only");
  }
  return spots.slice(0, 12);
}

function buildPublicCoverageSafeSourcePackRecommendationsLegacy(
  sourcePackExpansion: PublicSourcePackExpansionDto | undefined,
  benchmarks: PublicSourceFamilyBenchmarksDto
): PublicIntelligenceCoveragePlanDto["safeSourcePackRecommendations"] {
  const benchmarkRecommendations = benchmarks.expansionRecommendations.map((recommendation) => ({
    id: `coverage_plan_${recommendation.id}`,
    family: recommendation.family,
    sourcePackCandidateIds: recommendation.sourcePackCandidateIds,
    priority: recommendation.priority,
    action: recommendation.recommendedAction,
    expectedQueryClasses: recommendation.queryClasses,
    dryRunOnly: true as const,
    willMutate: false as const,
    willStartCrawling: false as const,
    unsafeUrlExposed: false as const
  }));
  const candidateRecommendations = (sourcePackExpansion?.candidates ?? [])
    .filter((candidate) => !candidate.staleSuppressed && !candidate.duplicateSuppressed && candidate.onboardingRecommendation !== "blocked")
    .slice(0, 8)
    .map((candidate) => ({
      id: `coverage_plan_pack_${hashContent(`${candidate.sourcePackId}:${candidate.sourceId}:${candidate.family}`).slice(0, 16)}`,
      family: candidate.family,
      sourcePackCandidateIds: [candidate.id],
      priority: candidate.familyDiversityGain > 0.8 ? "high" as const : "medium" as const,
      action: candidate.parserCapability === "needs_parser" ? "repair_parser" as const : "promote_source_pack_candidate" as const,
      expectedQueryClasses: candidate.queryClasses,
      dryRunOnly: true as const,
      willMutate: false as const,
      willStartCrawling: false as const,
      unsafeUrlExposed: false as const
    }));
  const byKey = new Map<string, PublicIntelligenceCoveragePlanDto["safeSourcePackRecommendations"][number]>();
  for (const item of [...benchmarkRecommendations, ...candidateRecommendations]) {
    byKey.set(`${item.family}:${item.action}:${item.sourcePackCandidateIds.join("|")}`, item);
  }
  return [...byKey.values()].sort((left, right) => {
    const priorityRank = { high: 0, medium: 1, low: 2 };
    return priorityRank[left.priority] - priorityRank[right.priority] || left.family.localeCompare(right.family);
  }).slice(0, 16);
}

function publicSourceBenchmarkQueryClass(query: string, entityType?: string): string {
  const normalizedEntity = entityType?.toLowerCase();
  if (normalizedEntity === "cve" || /\bcve-\d{4}-\d{4,}\b/i.test(query)) return "cve_advisory";
  if (normalizedEntity === "malware" || normalizedEntity === "tool") return "malware_tool";
  if (normalizedEntity === "victim" || normalizedEntity === "company") return "victim_company";
  if (normalizedEntity === "campaign") return "campaign";
  if (normalizedEntity === "country") return "country";
  if (normalizedEntity === "sector") return "sector";
  if (normalizedEntity === "infrastructure") return "infrastructure";
  return inferPublicSourcePackQueryClass(query, entityType);
}

function requiredFamiliesForPublicBenchmark(queryClass: string): PublicSignalSourceFamily[] {
  switch (queryClass) {
    case "apt":
    case "actor":
    case "campaign":
      return ["vendor_report", "cert_government", "public_research_feed", "public_channel"];
    case "ransomware":
    case "victim_company":
      return ["vendor_report", "cert_government", "public_channel", "public_research_feed"];
    case "cve_advisory":
    case "cve":
      return ["github_advisory", "cert_government", "vendor_report"];
    case "malware_tool":
    case "malware":
    case "infrastructure":
      return ["malware_report_feed", "vendor_report", "public_research_feed", "clear_web"];
    case "country":
    case "sector":
      return ["cert_government", "vendor_report", "public_research_feed", "clear_web"];
    default:
      return ["vendor_report", "cert_government", "public_research_feed", "public_channel"];
  }
}

function buildPublicQueryClassSourceMap(
  queryClass: string,
  coveredFamilies: PublicSignalSourceFamily[],
  benchmarks: PublicSourceFamilyBenchmarksDto
): PublicIntelligenceCoveragePlanDto["queryClassSourceMap"] {
  const covered = new Set(coveredFamilies);
  const benchmarkYieldByFamily = new Map(benchmarks.rows.map((row) => [row.family, row.evidenceYield]));
  const queryClasses = uniqueCleanStrings([
    queryClass,
    "actor",
    "campaign",
    "ransomware",
    "victim_company",
    "cve_advisory",
    "malware_tool",
    "country",
    "sector",
    "infrastructure"
  ]);

  return queryClasses.map((item) => {
    const requiredFamilies = requiredFamiliesForPublicBenchmark(item);
    const matchedFamilies = requiredFamilies.filter((family) => covered.has(family));
    const missingFamilies = requiredFamilies.filter((family) => !covered.has(family));
    const evidenceYield = roundMetric(requiredFamilies.reduce((total, family) => total + (benchmarkYieldByFamily.get(family) ?? 0), 0) / Math.max(1, requiredFamilies.length));
    const responseState: PublicIntelligenceCoveragePlanDto["queryClassSourceMap"][number]["responseState"] = benchmarks.status === "hold"
      ? "hold"
      : benchmarks.queryClassCoverage.unknownQuerySearching && item === queryClass
        ? "searching"
        : missingFamilies.length === 0 && evidenceYield >= 0.45
          ? "ready"
          : "partial";
    return {
      queryClass: item,
      requiredFamilies,
      coveredFamilies: matchedFamilies,
      missingFamilies,
      evidenceYield,
      responseState,
      currentQuery: item === queryClass
    };
  });
}

function publicBenchmarkEntityRichness(
  signals: Array<PublicSignalDeltaDto | PublicAdvisorySignalConnectorDto["rankedSignals"][number]>
): number {
  let count = 0;
  for (const signal of signals) {
    const entities = signal.matchedEntities;
    count += Math.min(2, entities?.actors?.length ?? 0);
    count += Math.min(2, entities?.campaigns?.length ?? 0);
    count += Math.min(2, entities?.cves?.length ?? 0);
    count += Math.min(1, entities?.malware?.length ?? 0);
    count += Math.min(1, entities?.tools?.length ?? 0);
    count += Math.min(1, entities?.sectors?.length ?? 0);
    count += Math.min(1, entities?.countries?.length ?? 0);
    count += Math.min(1, entities?.victims?.length ?? 0);
  }
  return roundMetric(clamp01(count / 8));
}

function publicBenchmarkSignalFreshness(
  signal: { updatedAt?: string; observedAt?: string; publishedAt?: string },
  generatedAt: string
): number {
  const latest = signal.updatedAt ?? signal.observedAt ?? signal.publishedAt;
  if (!latest) return 0.45;
  const ageMs = Date.parse(generatedAt) - Date.parse(latest);
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0.75;
  const days = ageMs / 86_400_000;
  if (days <= 7) return 1;
  if (days <= 30) return 0.78;
  if (days <= 120) return 0.45;
  return 0.18;
}

function publicBenchmarkGrade(input: {
  coverageScore: number;
  usefulFamilySignals: number;
  familyRequired: boolean;
  contradictionRate: number;
  parserReadiness: number;
}): PublicSourceFamilyBenchmarksDto["rows"][number]["benchmarkGrade"] {
  if (input.contradictionRate >= 0.35) return "hold";
  if (input.usefulFamilySignals === 0 && input.familyRequired) return "missing";
  if (input.coverageScore >= 0.78 && input.parserReadiness >= 0.7) return "strong";
  if (input.coverageScore >= 0.55 && input.parserReadiness >= 0.55) return "usable";
  return input.usefulFamilySignals > 0 ? "thin" : "missing";
}

function publicBenchmarkRecommendedAction(input: {
  rowStatus: PublicSourceFamilyBenchmarksDto["rows"][number]["status"];
  duplicateRate: number;
  contradictionRate: number;
  parserReadiness: number;
  freshnessScore: number;
  familyRequired: boolean;
  familyPackCandidates: PublicSourcePackExpansionDto["candidates"];
}): PublicSourceFamilyBenchmarksDto["rows"][number]["recommendedAction"] {
  if (input.contradictionRate >= 0.35 || input.rowStatus === "hold") return "contradiction_review";
  if (input.duplicateRate > 0.25) return "dedupe_sources";
  if (input.parserReadiness < 0.7) return "repair_parser";
  if (input.freshnessScore < 0.55 && input.rowStatus !== "searching") return "raise_cadence";
  if (input.familyPackCandidates.some((candidate) => candidate.parserCapability === "ready" && !candidate.staleSuppressed && !candidate.duplicateSuppressed)) return "promote_source_pack_candidate";
  if (input.familyRequired && (input.rowStatus === "needs_expansion" || input.rowStatus === "searching")) return "add_source_family";
  return "none";
}

function buildPublicBenchmarkExpansionRecommendations(input: {
  query: string;
  queryClass: string;
  rows: PublicSourceFamilyBenchmarksDto["rows"];
  requiredFamilies: PublicSignalSourceFamily[];
  sourcePackExpansion?: PublicSourcePackExpansionDto;
  coverageRadar?: EnterpriseSourceCoverageRadarDto;
  unknownQuerySearching: boolean;
}): PublicSourceFamilyBenchmarksDto["expansionRecommendations"] {
  const recommendations: PublicSourceFamilyBenchmarksDto["expansionRecommendations"] = [];
  const rowsByFamily = new Map(input.rows.map((row) => [row.family, row]));
  for (const family of input.requiredFamilies) {
    const row = rowsByFamily.get(family);
    if (!row || (row.status !== "needs_expansion" && row.status !== "searching" && row.status !== "hold" && row.recommendedAction === "none")) continue;
    const candidates = input.sourcePackExpansion?.candidates.filter((candidate) => candidate.family === family && !candidate.staleSuppressed && !candidate.duplicateSuppressed) ?? [];
    const action = row.recommendedAction === "none"
      ? candidates.length > 0 ? "promote_source_pack_candidate" : "add_curated_public_source"
      : row.recommendedAction === "add_source_family"
        ? candidates.length > 0 ? "promote_source_pack_candidate" : "add_curated_public_source"
        : row.recommendedAction === "dedupe_sources"
          ? "dedupe_or_retire_source"
          : row.recommendedAction;
    recommendations.push({
      id: stableBenchmarkRecommendationId(input.query, family, action),
      family,
      queryClasses: [input.queryClass],
      priority: row.status === "hold" || input.unknownQuerySearching ? "high" : row.status === "needs_expansion" ? "medium" : "low",
      reason: row.status === "searching"
        ? `searching for public ${family} coverage for ${input.query}`
        : row.status === "hold"
          ? `public ${family} coverage has contradictions or review holds`
          : `public ${family} coverage is below enterprise benchmark`,
      recommendedAction: action,
      sourcePackCandidateIds: candidates.map((candidate) => candidate.id).slice(0, 8),
      expectedImpact: {
        coverageGain: roundMetric(clamp01(0.18 + (1 - row.coverageScore) * 0.35)),
        freshnessGain: roundMetric(clamp01(0.1 + (1 - row.freshnessScore) * 0.28)),
        evidenceYieldGain: roundMetric(clamp01(0.12 + (1 - row.evidenceYield) * 0.3))
      },
      dryRunOnly: true,
      willMutate: false,
      willStartCrawling: false,
      publicOnly: true,
      unsafeUrlExposed: false
    });
  }
  return recommendations.slice(0, 12);
}

function stableBenchmarkRecommendationId(query: string, family: PublicSignalSourceFamily, action: string): string {
  return `bench_${hashContent(`${query}:${family}:${action}`).slice(0, 12)}`;
}

function coverageGapHandoff(code: EnterpriseCoverageGapCode): EnterpriseSourceCoverageRadarDto["gaps"][number]["handoff"] {
  const graphHold = code === "weak_cve_advisory_coverage" || code === "weak_ransomware_coverage" || code === "poor_useful_answer_rate"
    ? "hold_or_caveat_graph_relationships_until_public_corroboration_improves"
    : "use_gap_as_pivot_context_without_promoting_relationships";
  return {
    agent01Onboarding: code === "parser_gap" || code === "duplicate_source_gap" ? "none" : "review_safe_public_source_pack_or_family_gap",
    agent02SchedulingCadence: code === "stale_source_gap" || code === "poor_useful_answer_rate" ? "review_cadence_and_queue_priority" : "none",
    agent03ParserRepair: code === "parser_gap" ? "repair_parser_or_adapter_before_source_counts_for_coverage" : "none",
    agent06EvidencePersistence: code === "duplicate_source_gap" || code === "poor_useful_answer_rate" ? "verify_dedupe_and_evidence_yield_survive_replay" : "none",
      agent07QualityGates: code === "weak_cve_advisory_coverage" || code === "weak_ransomware_coverage" ? "keep_answer_partial_until_corroboration" : "none",
    agent08GraphPivots: graphHold,
    agent09ApiFields: "publicSignalFusion.coverageRadar",
    agent10SloMonitoring: "include_gap_in_release_candidate_source_coverage_packet"
  };
}

function buildCoverageRadarSourcePackRecommendations(input: {
  query: string;
  queryClass: string;
  generatedAt: string;
  missingFamilies: PublicSignalSourceFamily[];
  sourcePacks: TelegramPublicSourcePack[];
  sources: SourceRecord[];
  selectedFamilies: PublicSignalSourceFamily[];
}): EnterpriseSourceCoverageRadarDto["sourcePackRecommendations"] {
  const existingSourceIds = new Set(input.sources.map((source) => source.id));
  const selectedFamilies = new Set(input.selectedFamilies);
  const missingFamilies = new Set(input.missingFamilies);
  const recommendations: EnterpriseSourceCoverageRadarDto["sourcePackRecommendations"] = [];
  for (const pack of input.sourcePacks) {
    for (const source of pack.sources) {
      const candidateFamily = source.topicTags.some((tag) => /cert|government|advisory/i.test(tag))
        ? "cert_government"
        : source.topicTags.some((tag) => /vendor/i.test(tag))
          ? "vendor_report"
          : source.topicTags.some((tag) => /malware|tool/i.test(tag))
            ? "malware_report_feed"
            : "public_channel";
      if (existingSourceIds.has(source.id) || selectedFamilies.has(candidateFamily)) continue;
      if (missingFamilies.size > 0 && !missingFamilies.has(candidateFamily)) continue;
      const parserSupport = source.approvalState === "approved" ? "ready" : "unknown";
      const activationReadiness = source.approvalState === "approved"
        ? "ready"
        : source.compliance.approvalScope === "disabled"
          ? "blocked"
          : "needs_review";
      recommendations.push({
        id: `coverage_pack_${hashContent(`${input.query}:${pack.id}:${source.id}`).slice(0, 16)}`,
        sourcePackId: pack.id,
        sourceId: source.id,
        family: candidateFamily,
        name: source.name,
        requiredAction: activationReadiness === "ready" ? "activate_approved_public_source" : "promote_source_pack_candidate",
        trustScore: source.approvalState === "approved" ? 0.7 : 0.45,
        freshness: source.compliance.termsReviewedAt ? 0.8 : 0.45,
        familyDiversityGain: selectedFamilies.has(candidateFamily) ? 0 : 1,
        parserSupport,
        expectedEvidenceYield: roundMetric((source.focus.actors.length + source.focus.cves.length + source.focus.ransomware.length + source.focus.victims.length + source.focus.sectors.length) / 10),
        legalReviewAgeDays: source.compliance.termsReviewedAt ? ageDays(source.compliance.termsReviewedAt, input.generatedAt) : "unknown",
        robotsReviewAgeDays: "not_required",
        activationReadiness,
        publicOnly: true,
        willMutate: false,
        willStartCrawling: false
      });
    }
  }
  return recommendations
    .sort((a, b) => b.familyDiversityGain - a.familyDiversityGain || b.expectedEvidenceYield - a.expectedEvidenceYield || b.trustScore - a.trustScore)
    .slice(0, 8);
}

function buildCoverageRadarConflictIndicators(
  signals: PublicAdvisorySignalConnectorDto["rankedSignals"]
): EnterpriseSourceCoverageRadarDto["conflictIndicators"] {
  const byEntity = new Map<string, PublicAdvisorySignalConnectorDto["rankedSignals"]>();
  for (const signal of signals) {
    if (signal.state === "duplicate_suppressed") continue;
    const entities = [
      ...(signal.matchedEntities?.cves ?? []),
      ...(signal.matchedEntities?.actors ?? []),
      ...(signal.matchedEntities?.victims ?? [])
    ];
    for (const entity of entities) {
      const bucket = byEntity.get(entity) ?? [];
      bucket.push(signal);
      byEntity.set(entity, bucket);
    }
  }
  const conflicts: EnterpriseSourceCoverageRadarDto["conflictIndicators"] = [...byEntity.entries()]
    .filter(([, items]) => {
      const actorCount = new Set(items.flatMap((item) => item.matchedEntities?.actors ?? [])).size;
      const familyCount = new Set(items.map((item) => item.family)).size;
      return actorCount > 1 || (familyCount > 1 && items.some((item) => item.stale || item.state === "edited"));
    })
    .slice(0, 6)
    .map(([entity, items]) => ({
      id: `coverage_conflict_${hashContent(`${entity}:${items.map((item) => item.id).sort().join("|")}`).slice(0, 16)}`,
      conflictType: "actor_attribution" as const,
      entity,
      sourceIds: [...new Set(items.map((item) => item.sourceId))].sort(),
      families: [...new Set(items.map((item) => item.family))],
      summary: "public signals disagree on freshness or edited-state confidence for the same entity",
      severity: items.some((item) => item.state === "edited") ? "review" as const : "watch" as const,
      handoff: {
        agent07QualityGate: "contradiction_review" as const,
        agent08GraphPivot: "hold_conflicting_relationship" as const,
        agent09ApiField: "publicSignalFusion.coverageRadar.conflictIndicators" as const
      }
    }));
  if (conflicts.length > 0) return conflicts;

  const cveActors = new Map<string, PublicAdvisorySignalConnectorDto["rankedSignals"]>();
  for (const signal of signals) {
    for (const cve of signal.matchedEntities?.cves ?? []) {
      if ((signal.matchedEntities?.actors ?? []).length === 0) continue;
      cveActors.set(cve, [...(cveActors.get(cve) ?? []), signal]);
    }
  }
  return [...cveActors.entries()]
    .filter(([, items]) => new Set(items.flatMap((item) => item.matchedEntities?.actors ?? [])).size > 1)
    .slice(0, 6)
    .map(([entity, items]) => ({
      id: `coverage_conflict_${hashContent(`${entity}:${items.map((item) => item.id).sort().join("|")}`).slice(0, 16)}`,
      conflictType: "actor_attribution",
      entity,
      sourceIds: [...new Set(items.map((item) => item.sourceId))].sort(),
      families: [...new Set(items.map((item) => item.family))],
      summary: "public signals attach multiple actor attributions to the same CVE",
      severity: "review",
      handoff: {
        agent07QualityGate: "contradiction_review",
        agent08GraphPivot: "hold_conflicting_relationship",
        agent09ApiField: "publicSignalFusion.coverageRadar.conflictIndicators"
      }
    }));
}

function ageDays(isoDate: string, generatedAt: string): number | "unknown" {
  const start = Date.parse(isoDate);
  const end = Date.parse(generatedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "unknown";
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

function scorePublicSignalSource(input: {
  source: SourceRecord;
  queryTerms: string[];
  generatedAt: string;
  evidence: TelegramPublicEvidenceDto[];
  previousUrls: Set<string>;
}): PublicSignalSourceSelectionDto {
  const family = inferPublicSignalFamily(input.source);
  const searchable = sourceSearchableText(input.source);
  const matchedTerms = input.queryTerms.filter((term) => searchable.includes(term.toLowerCase()));
  const queryFit = input.queryTerms.length === 0 ? 0.5 : clamp01(matchedTerms.length / input.queryTerms.length);
  const freshness = publicSignalFreshness(input.source, input.generatedAt);
  const rateLimit = publicSignalRateLimitState(input.source, input.generatedAt);
  const editedPublicMessages = input.evidence.filter((item) => item.editedAt).length;
  const deletedOrUnavailablePublicMessages = input.evidence.filter((item) => item.messageState === "deleted" || item.messageState === "unavailable").length;
  const unavailable = ["disabled", "retired", "rejected", "quarantined"].includes(input.source.status) || input.source.health?.status === "disabled" || input.source.health?.status === "failing";
  const approvedPublic = isApprovedPublicSignalSource(input.source);
  const reliability = clamp01(
    (input.source.trustScore || input.source.catalog?.reliability || 0.5) * 0.35 +
    freshness * 0.2 +
    (input.source.health?.status === "healthy" ? 0.15 : input.source.health?.status === "degraded" ? 0.05 : 0.1) +
    (approvedPublic ? 0.15 : -0.1) +
    (rateLimit.delayed ? -0.12 : 0.05) +
    (unavailable ? -0.25 : 0) +
    (deletedOrUnavailablePublicMessages > 0 ? -0.08 : 0)
  );
  const diversityBoost = family === "public_channel" ? 0.04 : 0.1;
  const score = clamp01(queryFit * 0.34 + reliability * 0.42 + freshness * 0.14 + diversityBoost);

  return {
    sourceId: input.source.id,
    name: input.source.name,
    url: input.source.url,
    family,
    status: input.source.status,
    selected: false,
    score: roundMetric(score),
    reliability: roundMetric(reliability),
    freshness: roundMetric(freshness),
    queryFit: roundMetric(queryFit),
    diversityBoost: roundMetric(diversityBoost),
    decayReasons: [
      ...(freshness < 0.45 ? ["source has stale public-signal freshness"] : []),
      ...(rateLimit.delayed ? ["source is delayed by rate-limit/backoff"] : []),
      ...(unavailable ? ["source is unavailable, retired, quarantined, or failing"] : []),
      ...(deletedOrUnavailablePublicMessages > 0 ? ["public-channel messages include deleted or unavailable states"] : []),
      ...(editedPublicMessages > 0 ? ["public-channel messages include edited states"] : []),
      ...(!approvedPublic ? ["source requires public approval before strong claims"] : []),
      ...(input.previousUrls.has(normalizeSignalUrl(input.source.url)) ? ["source URL was already emitted for this query"] : [])
    ],
    matchedTerms,
    language: input.source.language ?? stringArray(input.source.catalog?.coverage.languages)[0] ?? stringArray(input.source.metadata?.languages)[0],
    regions: [...new Set([...stringArray(input.source.catalog?.coverage.regions), ...stringArray(input.source.metadata?.regions), ...stringArray(input.source.metadata?.countries)])],
    rateLimit,
    availability: {
      unavailable,
      takedownOrRetired: input.source.status === "retired" || Boolean(input.source.metadata?.takedownAt || input.source.metadata?.unavailableAt),
      deletedOrUnavailablePublicMessages,
      editedPublicMessages
    },
    hints: {
      githubAdvisory: family === "github_advisory",
      certGovernment: family === "cert_government",
      vendorReport: family === "vendor_report",
      malwareReportFeed: family === "malware_report_feed",
      publicChannel: family === "public_channel",
      publicSocial: family === "public_social",
      clearWebPromotion: family === "clear_web"
    },
    provenance: {
      sourceId: input.source.id,
      sourceType: input.source.type,
      accessMethod: input.source.accessMethod,
      legalNotes: input.source.legalNotes,
      approvedPublic,
      metadataOnly: input.source.governance?.metadataOnly === true || input.source.catalog?.retentionClass === "restricted_metadata"
    }
  };
}

function selectDiversePublicSignalSources(candidates: PublicSignalSourceSelectionDto[], limit: number): PublicSignalSourceSelectionDto[] {
  const selected: PublicSignalSourceSelectionDto[] = [];
  const byFamily = new Map<PublicSignalSourceFamily, PublicSignalSourceSelectionDto[]>();
  for (const candidate of candidates.filter((item) => item.score > 0.2).sort((left, right) => right.score - left.score)) {
    const family = byFamily.get(candidate.family) ?? [];
    family.push(candidate);
    byFamily.set(candidate.family, family);
  }
  for (const family of PUBLIC_SIGNAL_FAMILIES) {
    const first = byFamily.get(family)?.[0];
    if (first && selected.length < limit) selected.push(first);
  }
  for (const candidate of candidates.sort((left, right) => right.score - left.score)) {
    if (selected.length >= limit) break;
    if (!selected.some((item) => item.sourceId === candidate.sourceId)) selected.push(candidate);
  }
  return selected.map((source) => ({ ...source, selected: true }));
}

function buildPublicSignalDeltas(input: {
  evidence: TelegramPublicEvidenceDto[];
  selectedFamiliesBySource: Map<string, PublicSignalSourceFamily>;
  seenContentHashes: Set<string>;
  duplicateContentHashes: Set<string>;
}): PublicSignalDeltaDto[] {
  return input.evidence.map((item) => {
    const contentHash = item.contentHash ?? hashContent(normalizeWhitespace(`${item.messageUrl} ${item.snippet}`));
    const duplicate = input.seenContentHashes.has(contentHash);
    input.seenContentHashes.add(contentHash);
    if (duplicate) input.duplicateContentHashes.add(contentHash);
    const state = duplicate
      ? "duplicate_suppressed"
      : item.messageState === "deleted" || item.messageState === "unavailable"
        ? "deleted_or_unavailable"
        : item.editedAt
          ? "edited"
          : "new";
    return {
      id: `public_signal_delta_${hashContent(`${item.sourceId}:${item.messageUrl}:${contentHash}`).slice(0, 16)}`,
      sourceId: item.sourceId,
      family: input.selectedFamiliesBySource.get(item.sourceId) ?? "public_channel",
      url: item.messageUrl,
      contentHash,
      mergeTarget: "public_channel_partial_evidence",
      state,
      confidence: roundMetric(item.confidence),
      evidenceUrl: item.messageUrl,
      collectedAt: item.messageTimestamp,
      publishedAt: item.messageTimestamp,
      matchedEntities: item.extractionHandoff
        ? normalizeMatchedEntities({
          actors: item.extractionHandoff.actorAliases,
          cves: item.extractionHandoff.cves,
          victims: item.extractionHandoff.victims
        })
        : undefined,
      provenance: {
        sourceId: item.sourceId,
        publicOnly: true,
        evidenceBacked: true,
        safeUrl: isSafePublicSignalUrl(item.messageUrl)
      }
    };
  });
}

function buildPublicSignalPackDeltas(
  sourcePacks: TelegramPublicSourcePack[],
  queryTerms: string[],
  generatedAt: string
): PublicSignalDeltaDto[] {
  const deltas: PublicSignalDeltaDto[] = [];
  for (const pack of sourcePacks) {
    for (const entry of pack.sources) {
      const searchable = [
        entry.name,
        entry.channelHandle,
        ...entry.topicTags,
        ...entry.focus.actors,
        ...entry.focus.ransomware,
        ...entry.focus.cves,
        ...entry.focus.victims,
        ...entry.focus.sectors,
        ...entry.focus.countries
      ].join(" ").toLowerCase();
      if (queryTerms.length > 0 && !queryTerms.some((term) => searchable.includes(term.toLowerCase()))) continue;
      const contentHash = hashContent(`${pack.id}:${entry.id}:${entry.publicUrl}:${queryTerms.join("|")}`);
      deltas.push({
        id: `public_signal_delta_${hashContent(`${entry.id}:${contentHash}`).slice(0, 16)}`,
        sourceId: entry.id,
        family: "public_channel",
        url: entry.publicUrl,
        contentHash,
        mergeTarget: "clear_web_capture_evidence",
        state: "new",
        confidence: roundMetric(entry.trustScore ?? 0.45),
        collectedAt: generatedAt,
        provenance: {
          sourceId: entry.id,
          publicOnly: true,
          evidenceBacked: false,
          safeUrl: isSafePublicSignalUrl(entry.publicUrl)
        }
      });
    }
  }
  return deltas.slice(0, 12);
}

function unusedBuildAnalystPublicSourceWorkbenchV2(input: AnalystPublicSourceWorkbenchInput): AnalystPublicSourceWorkbenchDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const selectedSources = input.selectedSources ?? [];
  const suppressed = input.suppressed ?? {
    duplicateUrls: [],
    duplicateContentHashes: [],
    unsafeUrls: [],
    unavailableSourceIds: []
  };
  const selectedById = new Map(selectedSources.map((source) => [source.sourceId, source]));
  const decisions = selectedSources.map((source) => analystDecisionForSelectedSource(source, generatedAt));
  for (const source of input.sources) {
    if (selectedById.has(source.id)) continue;
    const family = inferPublicSignalFamily(source);
    if (input.missingFamilies?.includes(family)) {
      decisions.push(analystDecisionForUnselectedSource(source, family, generatedAt));
    }
  }
  for (const sourceId of suppressed.unavailableSourceIds) {
    if (decisions.some((decision) => decision.sourceId === sourceId && decision.decision === "unavailable")) continue;
    const source = input.sources.find((candidate) => candidate.id === sourceId);
    if (source) decisions.push(analystDecisionForUnselectedSource(source, inferPublicSignalFamily(source), generatedAt, "unavailable"));
  }
  const dryRunActions = analystDryRunActions(decisions);
  const status: AnalystPublicSourceWorkbenchDto["status"] = decisions.some((decision) => decision.severity === "hold")
    ? "hold"
    : decisions.some((decision) => decision.severity === "review" || decision.severity === "watch")
      ? "needs_review"
      : "ready";
  return {
    schemaVersion: "ti.public_source_workbench.v1",
    generatedAt,
    query: input.query,
    status,
    decisions,
    dryRunActions,
    summary: {
      trusted: decisions.filter((decision) => decision.decision === "trusted").length,
      review: decisions.filter((decision) => decision.severity === "review").length,
      hold: decisions.filter((decision) => decision.severity === "hold").length,
      stale: decisions.filter((decision) => decision.decision === "stale").length,
      duplicate: decisions.filter((decision) => decision.decision === "duplicate").length,
      parserGap: decisions.filter((decision) => decision.decision === "parser_gap").length,
      legalRobotsHold: decisions.filter((decision) => decision.decision === "legal_robots_hold").length,
      lowYield: decisions.filter((decision) => decision.decision === "low_yield").length
    },
    handoffs: {
      agent01Governance: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent01Governance).filter((value) => value !== "none")),
      agent02Scheduler: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent02Scheduler).filter((value) => value !== "none")),
      agent06EvidenceYield: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent06EvidenceYield).filter((value) => value !== "none")),
      agent07QualityGates: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent07QualityGate).filter((value) => value !== "none")),
      agent09ApiFields: ["publicSignalFusion.analystSourceWorkbench"],
      agent10SloDashboard: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent10SloDashboard).filter((value) => value !== "none"))
    },
    guardrails: {
      publicOnly: true,
      noAuthBypass: true,
      noPrivateRepoAccess: true,
      noCaptchaSolving: true,
      noExploitPayloadDownload: true,
      noLeakedDataRedistribution: true,
      unsafeUrlsExposed: false,
      dryRunOnly: true
    }
  };
}

function analystDecisionForSelectedSource(source: PublicSignalSourceSelectionDto, generatedAt: string): AnalystPublicSourceDecisionDto {
  const unavailable = source.availability.unavailable || source.availability.takedownOrRetired;
  const editedDeleted = source.availability.deletedOrUnavailablePublicMessages > 0 || source.availability.editedPublicMessages > 0;
  const parserGap = source.hints.clearWebPromotion && source.score < 0.45;
  const decision: AnalystPublicSourceDecisionReason = !source.provenance.approvedPublic
    ? "policy_disabled"
    : unavailable
      ? "unavailable"
      : editedDeleted
        ? "edited_deleted"
        : source.freshness < 0.3
          ? "stale"
          : parserGap
            ? "parser_gap"
            : source.score < 0.35
              ? "low_yield"
              : "trusted";
  return analystDecision({
    idSeed: `${source.sourceId}:${decision}`,
    sourceId: source.sourceId,
    sourceName: source.name,
    family: source.family,
    decision,
    reason: reasonForDecision(decision),
    trustScore: source.provenance.approvedPublic ? source.score : 0,
    reliability: source.reliability,
    freshness: source.freshness,
    evidenceYield: source.queryFit,
    parserSupport: parserGap ? "needs_repair" : source.hints.publicChannel || source.hints.githubAdvisory || source.hints.certGovernment || source.hints.vendorReport || source.hints.clearWebPromotion ? "ready" : "unknown",
    safeUrl: isSafePublicSignalUrl(source.url),
    mergeTarget: source.hints.publicChannel ? "public_channel_partial_evidence" : "clear_web_capture_evidence",
    dedupeKey: hashContent(`${source.family}:${normalizeSignalUrl(source.url)}`),
    relatedSignalIds: [],
    generatedAt
  });
}

function analystDecisionForUnselectedSource(
  source: SourceRecord,
  family: PublicSignalSourceFamily,
  generatedAt: string,
  override?: AnalystPublicSourceDecisionReason
): AnalystPublicSourceDecisionDto {
  const approved = isApprovedPublicSignalSource(source);
  const decision: AnalystPublicSourceDecisionReason = override ?? (!approved ? "legal_robots_hold" : "low_yield");
  return analystDecision({
    idSeed: `${source.id}:${decision}`,
    sourceId: source.id,
    sourceName: source.name,
    family,
    decision,
    reason: reasonForDecision(decision),
    trustScore: source.trustScore,
    reliability: source.catalog?.reliability ?? source.trustScore,
    freshness: publicSignalFreshness(source, generatedAt),
    evidenceYield: 0,
    parserSupport: "unknown",
    safeUrl: isSafePublicSignalUrl(source.url),
    relatedSignalIds: [],
    generatedAt
  });
}

function analystDecision(input: {
  idSeed: string;
  sourceId: string;
  sourceName: string;
  family: PublicSignalSourceFamily;
  decision: AnalystPublicSourceDecisionReason;
  reason: string;
  trustScore: number;
  reliability: number;
  freshness: number;
  evidenceYield: number;
  parserSupport: AnalystPublicSourceDecisionDto["parserSupport"];
  safeUrl: boolean;
  mergeTarget?: AnalystPublicSourceDecisionDto["mergeTarget"];
  dedupeKey?: string;
  relatedSignalIds: string[];
  generatedAt: string;
}): AnalystPublicSourceDecisionDto {
  return {
    id: `analyst_public_source_${hashContent(input.idSeed).slice(0, 16)}`,
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    family: input.family,
    decision: input.decision,
    reason: input.reason,
    severity: severityForDecision(input.decision),
    trustScore: roundMetric(input.trustScore),
    reliability: roundMetric(input.reliability),
    freshness: roundMetric(input.freshness),
    evidenceYield: roundMetric(input.evidenceYield),
    parserSupport: input.parserSupport,
    publicOnly: true,
    safeUrl: input.safeUrl,
    mergeTarget: input.mergeTarget,
    dedupeKey: input.dedupeKey,
    relatedSignalIds: input.relatedSignalIds,
    handoff: handoffForDecision(input.decision),
    provenance: {
      sourceId: input.sourceId,
      publicOnly: true,
      unsafeUrlExposed: false,
      decisionAt: input.generatedAt
    }
  };
}

function analystDryRunActions(decisions: AnalystPublicSourceDecisionDto[]): AnalystPublicSourceWorkbenchDto["dryRunActions"] {
  return decisions
    .filter((decision) => actionForDecision(decision.decision) !== undefined)
    .map((decision) => {
      const action = actionForDecision(decision.decision)!;
      return {
        id: `analyst_public_source_action_${hashContent(`${decision.id}:${action}`).slice(0, 16)}`,
        sourceId: decision.sourceId,
        action,
        reason: decision.reason,
        decisionIds: [decision.id],
        execution: decision.severity === "hold" ? "human_approval_required" : "dry_run_only",
        willMutate: false,
        willStartCrawling: false,
        publicOnly: true,
        unsafeUrlExposed: false,
        handoff: decision.handoff
      };
    });
}

function reasonForDecision(decision: AnalystPublicSourceDecisionReason): string {
  if (decision === "trusted") return "source is useful, public, and currently supported";
  if (decision === "suppressed") return "source signal was suppressed by safety or quality filters";
  if (decision === "merged") return "source signal can merge into existing public evidence";
  if (decision === "stale") return "source freshness is below the current query target";
  if (decision === "duplicate") return "source is duplicate-heavy for this query";
  if (decision === "unavailable") return "source is unavailable, retired, or currently unreachable";
  if (decision === "edited_deleted") return "public-channel evidence was edited or deleted and needs caveats";
  if (decision === "policy_disabled") return "source is not approved for public-signal promotion";
  if (decision === "parser_gap") return "source needs parser or extraction fixture repair";
  if (decision === "legal_robots_hold") return "legal, robots, or publicness review is required before activation";
  return "source yielded too little useful evidence for this query";
}

function severityForDecision(decision: AnalystPublicSourceDecisionReason): AnalystPublicSourceDecisionDto["severity"] {
  if (decision === "trusted" || decision === "merged") return "info";
  if (decision === "stale" || decision === "edited_deleted" || decision === "low_yield") return "watch";
  if (decision === "policy_disabled" || decision === "legal_robots_hold") return "hold";
  return "review";
}

function handoffForDecision(decision: AnalystPublicSourceDecisionReason): AnalystPublicSourceDecisionDto["handoff"] {
  if (decision === "policy_disabled") return {
    agent01Governance: "approval_review",
    agent02Scheduler: "pause_or_disable",
    agent06EvidenceYield: "none",
    agent07QualityGate: "hold_policy_disabled",
    agent09ApiField: "analystSourceWorkbench",
    agent10SloDashboard: "release_hold"
  };
  if (decision === "legal_robots_hold") return {
    agent01Governance: "legal_robots_review",
    agent02Scheduler: "pause_or_disable",
    agent06EvidenceYield: "none",
    agent07QualityGate: "hold_policy_disabled",
    agent09ApiField: "analystSourceWorkbench",
    agent10SloDashboard: "release_hold"
  };
  if (decision === "parser_gap") return {
    agent01Governance: "none",
    agent02Scheduler: "none",
    agent06EvidenceYield: "none",
    agent07QualityGate: "parser_gap",
    agent09ApiField: "analystSourceWorkbench",
    agent10SloDashboard: "source_health_watch"
  };
  if (decision === "duplicate") return {
    agent01Governance: "none",
    agent02Scheduler: "lower_cadence",
    agent06EvidenceYield: "merge_duplicate_evidence",
    agent07QualityGate: "none",
    agent09ApiField: "analystSourceWorkbench",
    agent10SloDashboard: "source_health_watch"
  };
  if (decision === "stale" || decision === "edited_deleted" || decision === "unavailable" || decision === "low_yield") return {
    agent01Governance: "none",
    agent02Scheduler: decision === "unavailable" ? "pause_or_disable" : decision === "stale" ? "raise_cadence" : "none",
    agent06EvidenceYield: decision === "low_yield" ? "monitor_low_yield" : "none",
    agent07QualityGate: "review_stale_or_edited",
    agent09ApiField: "analystSourceWorkbench",
    agent10SloDashboard: "source_health_watch"
  };
  return {
    agent01Governance: "none",
    agent02Scheduler: "none",
    agent06EvidenceYield: "none",
    agent07QualityGate: "none",
    agent09ApiField: "analystSourceWorkbench",
    agent10SloDashboard: "none"
  };
}

function actionForDecision(decision: AnalystPublicSourceDecisionReason): AnalystPublicSourceAction | undefined {
  if (decision === "policy_disabled") return "approve_source";
  if (decision === "legal_robots_hold") return "request_legal_robots_review";
  if (decision === "parser_gap") return "request_parser_repair";
  if (decision === "duplicate") return "mark_duplicate";
  if (decision === "unavailable") return "disable_source";
  if (decision === "stale") return "raise_cadence";
  if (decision === "low_yield") return "lower_trust";
  return undefined;
}

function buildPublicSignalAnalystWorkQueue(
  selectedSources: PublicSignalSourceSelectionDto[],
  missingFamilies: PublicSignalSourceFamily[]
): PublicSignalFusionDto["analystWorkQueue"] {
  const queue: PublicSignalFusionDto["analystWorkQueue"] = [];
  for (const source of selectedSources) {
    if (!source.provenance.approvedPublic) {
      queue.push({ sourceId: source.sourceId, action: "approve_source", reason: "source is useful but not approved for public-signal claims", priority: "high" });
    }
    if (source.rateLimit.delayed) {
      queue.push({ sourceId: source.sourceId, action: "review_backoff", reason: "source is delayed by rate limit/backoff", priority: "medium" });
    }
    if (source.availability.unavailable || source.availability.takedownOrRetired) {
      queue.push({ sourceId: source.sourceId, action: "review_unavailable", reason: "source is unavailable or takedown/retired", priority: "high" });
    }
    if (source.availability.deletedOrUnavailablePublicMessages > 0 || source.availability.editedPublicMessages > 0) {
      queue.push({ sourceId: source.sourceId, action: "confirm_public_only_claim", reason: "edited/deleted public-channel evidence must remain caveated", priority: "medium" });
    }
  }
  for (const family of missingFamilies.slice(0, 3)) {
    queue.push({ sourceId: `family:${family}`, action: "add_source_family", reason: `no selected ${family} source for this query`, priority: "low" });
  }
  return queue;
}

function buildPublicSignalCaveats(
  selectedSources: PublicSignalSourceSelectionDto[],
  selectedFamilies: PublicSignalSourceFamily[],
  deltas: PublicSignalDeltaDto[]
): string[] {
  return [
    ...(selectedFamilies.length < 3 ? ["fewer than three public source families support this query"] : []),
    ...(selectedFamilies.length === 1 && selectedFamilies[0] === "public_channel" ? ["public-channel-only claims require external corroboration"] : []),
    ...(selectedSources.some((source) => !source.provenance.approvedPublic) ? ["one or more source hints require approval before strong claims"] : []),
    ...(selectedSources.some((source) => source.rateLimit.delayed) ? ["rate-limit/backoff may delay fresh public signals"] : []),
    ...(deltas.some((delta) => delta.state === "edited" || delta.state === "deleted_or_unavailable") ? ["edited or deleted public messages are partial evidence only"] : [])
  ];
}

function groupAdvisorySignalsBySource(
  signals: PublicAdvisorySignalConnectorDto["rankedSignals"]
): Map<string, PublicAdvisorySignalConnectorDto["rankedSignals"]> {
  const grouped = new Map<string, PublicAdvisorySignalConnectorDto["rankedSignals"]>();
  for (const signal of signals) {
    const bucket = grouped.get(signal.sourceId) ?? [];
    bucket.push(signal);
    grouped.set(signal.sourceId, bucket);
  }
  return grouped;
}

function publicSourceDecision(input: {
  source: SourceRecord;
  scored: PublicSignalSourceSelectionDto;
  generatedAt: string;
  advisorySignals: PublicAdvisorySignalConnectorDto["rankedSignals"];
  duplicate: boolean;
  parserGap: boolean;
  legalRobotsHold: boolean;
  lowYield: boolean;
}, decision: AnalystPublicSourceDecisionReason, reason: string): AnalystPublicSourceDecisionDto {
  const relatedSignalIds = input.advisorySignals.map((signal) => signal.id).slice(0, 8);
  const mergeSignal = input.advisorySignals.find((signal) => signal.mergeTarget);
  return {
    id: `public_source_decision_${hashContent(`${input.source.id}:${decision}:${reason}`).slice(0, 16)}`,
    sourceId: input.source.id,
    sourceName: input.source.name,
    family: input.scored.family,
    decision,
    reason,
    severity: publicSourceDecisionSeverity(decision),
    trustScore: roundMetric(input.source.trustScore),
    reliability: input.scored.reliability,
    freshness: input.scored.freshness,
    evidenceYield: publicSourceEvidenceYield(input.source, input.scored, input.advisorySignals),
    parserSupport: input.parserGap ? "needs_repair" : sourceParserSupportUnknown(input.source) ? "unknown" : "ready",
    publicOnly: true,
    safeUrl: isSafePublicSignalUrl(input.source.url),
    mergeTarget: mergeSignal?.mergeTarget,
    dedupeKey: mergeSignal?.dedupeKey,
    relatedSignalIds,
    handoff: publicSourceDecisionHandoff(decision),
    provenance: {
      sourceId: input.source.id,
      publicOnly: true,
      unsafeUrlExposed: false,
      decisionAt: input.generatedAt
    }
  };
}

function publicSourceDecisionSeverity(decision: AnalystPublicSourceDecisionReason): AnalystPublicSourceDecisionDto["severity"] {
  if (decision === "policy_disabled" || decision === "unavailable" || decision === "legal_robots_hold") return "hold";
  if (decision === "parser_gap" || decision === "duplicate" || decision === "stale" || decision === "suppressed") return "review";
  if (decision === "low_yield" || decision === "edited_deleted") return "watch";
  return "info";
}

function publicSourceDecisionHandoff(decision: AnalystPublicSourceDecisionReason): AnalystPublicSourceDecisionDto["handoff"] {
  return {
    agent01Governance: decision === "policy_disabled" ? "approval_review" : decision === "legal_robots_hold" ? "legal_robots_review" : decision === "low_yield" ? "source_pack_promotion" : "none",
    agent02Scheduler: decision === "stale" ? "raise_cadence" : decision === "low_yield" ? "lower_cadence" : decision === "unavailable" || decision === "policy_disabled" ? "pause_or_disable" : "none",
    agent06EvidenceYield: decision === "duplicate" || decision === "merged" ? "merge_duplicate_evidence" : decision === "low_yield" ? "monitor_low_yield" : "none",
    agent07QualityGate: decision === "parser_gap" ? "parser_gap" : decision === "policy_disabled" ? "hold_policy_disabled" : decision === "stale" || decision === "edited_deleted" ? "review_stale_or_edited" : "none",
    agent09ApiField: "analystSourceWorkbench",
    agent10SloDashboard: decision === "policy_disabled" || decision === "unavailable" || decision === "legal_robots_hold" ? "release_hold" : decision === "stale" || decision === "low_yield" || decision === "parser_gap" ? "source_health_watch" : "none"
  };
}

function buildAnalystPublicSourceDryRunActions(
  decisions: AnalystPublicSourceDecisionDto[]
): AnalystPublicSourceWorkbenchDto["dryRunActions"] {
  const actions = new Map<string, AnalystPublicSourceWorkbenchDto["dryRunActions"][number]>();
  const add = (decision: AnalystPublicSourceDecisionDto, action: AnalystPublicSourceAction, reason: string, execution: "dry_run_only" | "human_approval_required" | "blocked" = "human_approval_required") => {
    const key = `${decision.sourceId}:${action}`;
    const existing = actions.get(key);
    if (existing) {
      actions.set(key, { ...existing, decisionIds: [...new Set([...existing.decisionIds, decision.id])] });
      return;
    }
    actions.set(key, {
      id: `public_source_action_${hashContent(key).slice(0, 16)}`,
      sourceId: decision.sourceId,
      action,
      reason,
      decisionIds: [decision.id],
      execution,
      willMutate: false,
      willStartCrawling: false,
      publicOnly: true,
      unsafeUrlExposed: false,
      handoff: decision.handoff
    });
  };

  for (const decision of decisions) {
    if (decision.decision === "policy_disabled") add(decision, decision.sourceId.startsWith("family:") ? "promote_source_pack_candidate" : "approve_source", "review whether the public source can be approved for safe-public use", "human_approval_required");
    if (decision.decision === "unavailable") add(decision, "disable_source", "disable or pause unavailable source in the operator plan", "human_approval_required");
    if (decision.decision === "stale") add(decision, "raise_cadence", "raise crawl cadence or freshness target for stale public source", "dry_run_only");
    if (decision.decision === "duplicate") add(decision, "mark_duplicate", "mark duplicate source or advisory dedupe key", "dry_run_only");
    if (decision.decision === "parser_gap") add(decision, "request_parser_repair", "request parser or adapter repair before extraction promotion", "human_approval_required");
    if (decision.decision === "legal_robots_hold") add(decision, "request_legal_robots_review", "request legal or robots review before stronger use", "human_approval_required");
    if (decision.decision === "low_yield") add(decision, decision.sourceId.startsWith("family:") ? "promote_source_pack_candidate" : "lower_cadence", "reduce cadence or promote a better source-pack candidate for low-yield coverage", "dry_run_only");
    if (decision.decision === "trusted" && decision.reliability >= 0.75) add(decision, "raise_trust", "source has strong public provenance and useful signal yield", "dry_run_only");
    if (decision.decision === "suppressed") add(decision, "lower_trust", "lower trust until suppressed public signals are reviewed", "dry_run_only");
  }
  return [...actions.values()].sort((left, right) => left.sourceId.localeCompare(right.sourceId) || left.action.localeCompare(right.action));
}

function sourceIsDuplicate(
  source: SourceRecord,
  suppressed: PublicSignalFusionDto["suppressed"] | undefined,
  advisorySignals: PublicAdvisorySignalConnectorDto["rankedSignals"]
): boolean {
  const normalized = normalizeSignalUrl(source.url);
  return Boolean(
    suppressed?.duplicateUrls.some((url) => normalizeSignalUrl(url) === normalized)
    || advisorySignals.some((signal) => signal.state === "duplicate_suppressed")
    || source.metadata?.duplicateOf
    || source.catalog?.rollback?.lastQuarantineReason === "duplicate"
  );
}

function sourceHasParserGap(source: SourceRecord): boolean {
  const metadata = source.metadata ?? {};
  const parserStatus = stringValue(metadata.parserStatus) ?? stringValue(metadata.parserState);
  const adapterCompatibility = source.catalog?.adapterCompatibility ?? [];
  return Boolean(
    metadata.parserGap === true
    || parserStatus === "needs_repair"
    || parserStatus === "missing"
    || (adapterCompatibility.length > 0 && !adapterCompatibility.includes(source.type))
  );
}

function sourceParserSupportUnknown(source: SourceRecord): boolean {
  return !source.catalog?.adapterCompatibility?.length && source.metadata?.parserStatus === undefined;
}

function sourceHasLegalRobotsHold(source: SourceRecord, generatedAt: string): boolean {
  const legalText = `${source.legalNotes} ${source.governance?.reviewTicket ?? ""}`.toLowerCase();
  const approvalExpired = source.governance?.approvalExpiresAt ? Date.parse(source.governance.approvalExpiresAt) < Date.parse(generatedAt) : false;
  const robotsState = stringValue(source.metadata?.robotsReviewState) ?? stringValue(source.metadata?.robotsState);
  const legalState = stringValue(source.metadata?.legalReviewState) ?? stringValue(source.metadata?.legalState);
  return Boolean(
    !source.legalNotes.trim()
    || source.governance?.approvalState === "pending"
    || source.governance?.approvalState === "expired"
    || approvalExpired
    || robotsState === "missing"
    || robotsState === "stale"
    || legalState === "missing"
    || legalState === "stale"
    || /legal review|robots review|terms review|pending review/.test(legalText)
  );
}

function sourceHasLowYield(
  source: SourceRecord,
  scored: PublicSignalSourceSelectionDto,
  advisorySignals: PublicAdvisorySignalConnectorDto["rankedSignals"]
): boolean {
  const evidenceYield = publicSourceEvidenceYield(source, scored, advisorySignals);
  return scored.queryFit < 0.25 || scored.reliability < 0.42 || evidenceYield < 0.25 || (source.catalog?.intelligenceValue !== undefined && source.catalog.intelligenceValue < 0.35);
}

function publicSourceEvidenceYield(
  source: SourceRecord,
  scored: PublicSignalSourceSelectionDto,
  advisorySignals: PublicAdvisorySignalConnectorDto["rankedSignals"]
): number {
  const selectedSignalYield = advisorySignals.filter((signal) =>
    signal.policyAllowed &&
    signal.provenance.safeUrl &&
    signal.state !== "duplicate_suppressed" &&
    signal.queryMatched
  ).length;
  const explicitYield = typeof source.metadata?.evidenceYield === "number" ? source.metadata.evidenceYield : undefined;
  return roundMetric(clamp01(explicitYield ?? selectedSignalYield * 0.25 + scored.queryFit * 0.35 + scored.reliability * 0.25 + (source.scoring?.parseability ?? 0.5) * 0.15));
}

function publicAdvisorySignalsFromSources(sources: SourceRecord[], generatedAt: string): PublicAdvisorySignalRecord[] {
  return sources
    .filter((source) => source.type === "api" || source.type === "rss" || source.type === "static_web" || source.type === "pdf")
    .map((source) => {
      const family = inferPublicSignalFamily(source);
      const metadataEntities = normalizeMatchedEntities({
        actors: stringArray(source.metadata?.actors),
        malware: stringArray(source.metadata?.malware),
        tools: stringArray(source.metadata?.tools),
        cves: stringArray(source.metadata?.cves),
        campaigns: stringArray(source.metadata?.campaigns),
        sectors: stringArray(source.metadata?.sectors),
        countries: stringArray(source.metadata?.countries),
        victims: stringArray(source.metadata?.victims)
      });
      return {
        id: `signal_${source.id}`,
        sourceId: source.id,
        family: family === "public_channel" || family === "public_social" ? "clear_web" : family,
        title: source.name,
        url: source.url,
        canonicalUrl: normalizeSignalUrl(source.url),
        summary: stringValue(source.metadata?.description) ?? source.legalNotes,
        publishedAt: source.lastSeenAt ?? source.crawlState?.lastCollectedAt ?? source.updatedAt,
        observedAt: source.lastSeenAt ?? source.updatedAt,
        updatedAt: source.updatedAt,
        language: source.language,
        region: stringArray(source.metadata?.regions)[0] ?? stringArray(source.catalog?.coverage.regions)[0],
        tags: [...new Set([...(source.tags ?? []), ...stringArray(source.metadata?.topicTags), ...stringArray(source.catalog?.coverage.topics)])],
        matchedEntities: metadataEntities,
        confidence: source.scoring?.relevance ?? source.trustScore,
        reliabilityScore: source.catalog?.reliability ?? source.trustScore,
        sourceTrust: source.trustScore,
        state: source.status === "disabled" || source.status === "rejected" ? "policy_disabled" : source.status === "retired" || source.status === "quarantined" ? "unavailable" : publicSignalFreshness(source, generatedAt) < 0.25 ? "stale" : "active",
        access: source.accessMethod === "official_api" ? "official_api" : source.accessMethod === "manual_seed" ? "manual_seed" : "public_http",
        policy: {
          publicOnly: source.accessMethod === "official_api" || source.accessMethod === "public_http" || source.accessMethod === "manual_seed",
          authRequired: /(?:auth required|requires auth|login required|requires login|token required)/i.test(`${source.url} ${source.legalNotes}`),
          privateRepo: /private repo|private repository/i.test(`${source.url} ${source.legalNotes}`),
          captchaRequired: /(?:captcha required|requires captcha)/i.test(`${source.url} ${source.legalNotes}`),
          exploitPayloadDownload: /payload|exploit download|proof-of-concept download/i.test(`${source.url} ${source.legalNotes}`),
          leakedDataRedistribution: /leaked data|stolen data|dump/i.test(`${source.url} ${source.legalNotes}`),
          termsBypass: /(?:bypass required|scrape behind login|terms bypass)/i.test(`${source.url} ${source.legalNotes}`)
        },
        provenance: {
          connector: publicAdvisoryConnectorForFamily(family),
          collectedAt: generatedAt,
          parserVersion: "public-signal-source-derived:v1"
        }
      } satisfies PublicAdvisorySignalRecord;
    });
}

function actorCoverageProfile(actor: string): {
  actor: string;
  actorClass: ActorSourceCoverageMatrixDto["rows"][number]["actorClass"];
  aliases: string[];
  requiredFamilies: PublicSignalSourceFamily[];
  freshnessExpectationDays: number;
} {
  const normalized = actor.toLowerCase();
  const ransomware = /lockbit|akira|cl0p|play|blacksuit|ransomhub|qilin|medusa|dragonforce|8base|hunters international|bianlian|alphv|blackcat|royal|conti|darkside|blackmatter/.test(normalized);
  const financialCrime = /fin7|ta505|scattered spider/.test(normalized);
  const unknown = /unknown/.test(normalized);
  const aliases: Record<string, string[]> = {
    "APT29": ["Cozy Bear", "Nobelium", "Midnight Blizzard"],
    "APT42": ["Charming Kitten", "Mint Sandstorm"],
    "Sandworm": ["Voodoo Bear"],
    "Volt Typhoon": ["Bronze Silhouette"],
    "Salt Typhoon": ["GhostEmperor"],
    "Lazarus": ["Hidden Cobra"],
    "Kimsuky": ["Thallium"],
    "Charming Kitten": ["APT42", "Mint Sandstorm"],
    "MuddyWater": ["Static Kitten"],
    "OilRig": ["APT34"],
    "FIN7": ["Carbon Spider"],
    "TA505": ["Evil Corp"],
    "Scattered Spider": ["UNC3944", "Octo Tempest"],
    "LockBit": ["LockBitSupp"],
    "Cl0p": ["Clop"],
    "ALPHV/BlackCat": ["ALPHV", "BlackCat"],
    "Conti legacy": ["Conti"],
    "DarkSide/BlackMatter legacy": ["DarkSide", "BlackMatter"]
  };
  const actorClass: ActorSourceCoverageMatrixDto["rows"][number]["actorClass"] = unknown ? "unknown" : ransomware ? "ransomware" : financialCrime ? "financial_crime" : "apt";
  const requiredFamilies: PublicSignalSourceFamily[] = actorClass === "unknown"
    ? ["vendor_report", "public_research_feed", "clear_web"]
    : actorClass === "ransomware"
      ? ["public_channel", "vendor_report", "cert_government", "public_research_feed"]
      : actorClass === "financial_crime"
        ? ["vendor_report", "public_channel", "malware_report_feed", "public_research_feed"]
        : ["vendor_report", "cert_government", "malware_report_feed", "github_advisory", "public_research_feed"];
  return {
    actor,
    actorClass,
    aliases: uniqueCleanStrings(aliases[actor] ?? []),
    requiredFamilies,
    freshnessExpectationDays: actorClass === "ransomware" || actorClass === "financial_crime" ? 3 : actorClass === "unknown" ? 7 : 14
  };
}

function sourceMatchesActorCoverage(source: SourceRecord, actorTerms: string[]): boolean {
  const text = sourceSearchableText(source);
  return actorTerms.some((term) => text.includes(term));
}

function signalMatchesActorCoverage(signal: PublicSignalDeltaDto, actorTerms: string[]): boolean {
  const entities = normalizeMatchedEntities(signal.matchedEntities);
  const text = [
    signal.title ?? "",
    signal.summary ?? "",
    ...(signal.tags ?? []),
    ...entities.actors,
    ...entities.campaigns,
    ...entities.malware,
    ...entities.tools
  ].join(" ").toLowerCase();
  return actorTerms.some((term) => text.includes(term));
}

function uniqueSignalFamilies(values: Array<PublicSignalSourceFamily | undefined>): PublicSignalSourceFamily[] {
  return [...new Set(values.filter((value): value is PublicSignalSourceFamily => Boolean(value)))].sort((left, right) => left.localeCompare(right));
}

function maxTimestamp(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function timestampAgeDays(timestamp: string, generatedAt: string): number {
  return Math.max(0, (Date.parse(generatedAt) - Date.parse(timestamp)) / 86_400_000);
}

function sourceFamilyStaleForActor(source: SourceRecord, profile: ReturnType<typeof actorCoverageProfile>, generatedAt: string): boolean {
  const latest = maxTimestamp([source.lastSeenAt, source.crawlState?.lastCollectedAt, source.health?.lastSuccessAt, source.updatedAt]);
  return latest ? timestampAgeDays(latest, generatedAt) > profile.freshnessExpectationDays : true;
}

function deltaFreshnessDays(delta: PublicSignalDeltaDto, generatedAt: string): number {
  const latest = maxTimestamp([delta.observedAt, delta.publishedAt, delta.collectedAt]);
  return latest ? timestampAgeDays(latest, generatedAt) : Number.POSITIVE_INFINITY;
}

function familyValueGrade(
  coveredFamilies: PublicSignalSourceFamily[],
  staleFamilies: PublicSignalSourceFamily[],
  families: PublicSignalSourceFamily[]
): ActorSourceCoverageMatrixDto["rows"][number]["publicAdvisoryValue"] {
  const covered = families.filter((family) => coveredFamilies.includes(family));
  if (covered.length === 0) return "missing";
  if (covered.every((family) => staleFamilies.includes(family))) return "thin";
  if (covered.length >= 2) return "strong";
  return "usable";
}

function actorFeedFreshnessExpectation(
  actorClass: ActorSourceCoverageMatrixDto["rows"][number]["actorClass"]
): ActorSourceCoverageMatrixDto["rows"][number]["freshnessExpectation"] {
  if (actorClass === "unknown") return "searching_only";
  if (actorClass === "ransomware" || actorClass === "financial_crime") return "daily";
  return "weekly";
}

function actorFeedPriorityOrder(actorClass: ActorSourceCoverageMatrixDto["rows"][number]["actorClass"]): ActorFeedPrioritySourceFamily[] {
  if (actorClass === "unknown") return ["vendor_report", "public_research_feed", "clear_web"];
  if (actorClass === "ransomware") return ["public_channel", "clear_web", "vendor_report", "cert_government", "public_research_feed", "darkweb_metadata", "malware_report_feed"];
  if (actorClass === "financial_crime") return ["vendor_report", "public_channel", "clear_web", "malware_report_feed", "public_research_feed", "cert_government"];
  return ["vendor_report", "cert_government", "malware_report_feed", "github_advisory", "public_research_feed", "clear_web", "public_channel"];
}

function actorFeedFamilyExpectedValue(
  actorClass: ActorSourceCoverageMatrixDto["rows"][number]["actorClass"],
  family: ActorFeedPrioritySourceFamily,
  rank: number
): "critical" | "high" | "medium" | "low" {
  if (family === "darkweb_metadata") return actorClass === "ransomware" ? "medium" : "low";
  if (rank <= 2) return "critical";
  if (rank <= 4) return "high";
  return actorClass === "unknown" ? "low" : "medium";
}

function actorFeedCadenceRecommendation(input: {
  actorClass: ActorSourceCoverageMatrixDto["rows"][number]["actorClass"];
  family: ActorFeedPrioritySourceFamily;
  state: "fresh" | "stale" | "missing" | "metadata_only" | "not_required";
}): ActorSourceCoverageMatrixDto["rows"][number]["sourceFamilyPriorities"][number]["cadenceRecommendation"] {
  if (input.actorClass === "unknown" || input.state === "not_required") return "do_not_schedule";
  if (input.family === "darkweb_metadata" || input.state === "metadata_only") return "metadata_review_only";
  if (input.actorClass === "ransomware") {
    if (input.family === "public_channel" || input.family === "clear_web") return input.state === "stale" ? "hourly" : "twice_daily";
    return "daily";
  }
  if (input.actorClass === "financial_crime") {
    if (input.family === "public_channel" || input.family === "vendor_report") return input.state === "stale" ? "twice_daily" : "daily";
    return "twice_weekly";
  }
  if (input.family === "vendor_report" || input.family === "cert_government" || input.family === "malware_report_feed") return "daily";
  return "weekly";
}

function actorFeedSourceFamilyPriorities(input: {
  actorClass: ActorSourceCoverageMatrixDto["rows"][number]["actorClass"];
  requiredFamilies: PublicSignalSourceFamily[];
  coveredFamilies: PublicSignalSourceFamily[];
  staleFamilies: PublicSignalSourceFamily[];
  missingFamilies: PublicSignalSourceFamily[];
  blockedRestrictedFamilies: Array<"darkweb_metadata" | "restricted_metadata">;
}): ActorSourceCoverageMatrixDto["rows"][number]["sourceFamilyPriorities"] {
  return actorFeedPriorityOrder(input.actorClass).map((family, index) => {
    const currentState =
      family === "darkweb_metadata"
        ? input.blockedRestrictedFamilies.length > 0
          ? "metadata_only"
          : "not_required"
        : input.staleFamilies.includes(family)
          ? "stale"
          : input.coveredFamilies.includes(family)
            ? "fresh"
            : input.missingFamilies.includes(family) || input.requiredFamilies.includes(family)
              ? "missing"
              : "not_required";
    const rank = index + 1;
    const fallbackFamily = family === "public_channel"
      ? "clear_web"
      : family === "darkweb_metadata"
        ? "vendor_report"
        : family === "github_advisory"
          ? "cert_government"
          : undefined;
    return {
      family,
      rank,
      currentState,
      expectedValue: actorFeedFamilyExpectedValue(input.actorClass, family, rank),
      cadenceRecommendation: actorFeedCadenceRecommendation({ actorClass: input.actorClass, family, state: currentState }),
      fallbackFamily,
      reason: actorFeedPriorityReason(input.actorClass, family, currentState)
    };
  });
}

function actorFeedPriorityReason(
  actorClass: ActorSourceCoverageMatrixDto["rows"][number]["actorClass"],
  family: ActorFeedPrioritySourceFamily,
  state: "fresh" | "stale" | "missing" | "metadata_only" | "not_required"
): string {
  if (state === "metadata_only") return "Restricted/dark metadata can support triage only and cannot produce public product facts without public corroboration.";
  if (actorClass === "ransomware" && family === "public_channel") return "High-volume extortion actors need fast public-channel descriptors plus public corroboration for fresh buyer rows.";
  if (actorClass === "ransomware" && family === "clear_web") return "News and official victim reporting are the safest fallback when public-channel coverage is stale or missing.";
  if (actorClass === "apt" && (family === "vendor_report" || family === "cert_government")) return "APT updates usually become useful through corroborated vendor or government reporting rather than high-frequency channel chatter.";
  if (actorClass === "financial_crime" && family === "public_channel") return "Financial-crime clusters often surface infrastructure and victim churn in public-channel style reporting, but claims remain caveated.";
  if (state === "missing") return "Missing source family is a high-value safe activation candidate for this actor class.";
  if (state === "stale") return "Existing source family is present but stale enough to reject recent-activity promotion.";
  if (state === "fresh") return "Fresh enough to contribute to a public or partial answer when provenance and quality gates pass.";
  return "Not required for the current actor class unless other families are unavailable.";
}

function highestValueMissingActorFeedFamily(
  priorities: ActorSourceCoverageMatrixDto["rows"][number]["sourceFamilyPriorities"]
): ActorFeedPrioritySourceFamily | undefined {
  return priorities.find((row) => row.currentState === "missing")?.family;
}

function actorFeedNextBestSourceAction(input: {
  status: ActorSourceCoverageStatus;
  highestValueMissingFamily?: ActorFeedPrioritySourceFamily;
  staleFamilies: PublicSignalSourceFamily[];
  blockedRestrictedFamilies: Array<"darkweb_metadata" | "restricted_metadata">;
}): ActorSourceCoverageMatrixDto["rows"][number]["nextBestSourceAction"] {
  if (input.status === "unknown_query") return "keep_searching";
  if (input.blockedRestrictedFamilies.length > 0 && !input.highestValueMissingFamily) return "metadata_review";
  if (input.staleFamilies.length > 0) return "raise_cadence";
  if (input.highestValueMissingFamily === "public_channel") return "activate_public_channel";
  if (input.highestValueMissingFamily === "github_advisory" || input.highestValueMissingFamily === "cert_government") return "activate_public_advisory";
  if (input.highestValueMissingFamily === "malware_report_feed") return "activate_malware_feed";
  if (input.highestValueMissingFamily && input.highestValueMissingFamily !== "darkweb_metadata") return "activate_public_blog_news";
  if (input.highestValueMissingFamily === "darkweb_metadata") return "metadata_review";
  return "maintain_current_mix";
}

function actorFeedBuyerCaveat(input: {
  actor: string;
  actorClass: ActorSourceCoverageMatrixDto["rows"][number]["actorClass"];
  status: ActorSourceCoverageStatus;
  highestValueMissingFamily?: ActorFeedPrioritySourceFamily;
  blockedRestrictedFamilies: Array<"darkweb_metadata" | "restricted_metadata">;
}): string {
  if (input.status === "unknown_query") return `${input.actor} is treated as an unknown query until public evidence matches the full actor name or alias.`;
  if (input.status === "metadata_hold" || input.blockedRestrictedFamilies.length > 0) return `${input.actor} has metadata-only restricted context; buyer-visible facts need safe public corroboration.`;
  if (input.status === "stale") return `${input.actor} has stale-only coverage for at least one required family; recent-activity claims should stay held.`;
  if (input.highestValueMissingFamily) return `${input.actor} is partial because ${input.highestValueMissingFamily} coverage is missing or not yet useful.`;
  if (input.actorClass === "ransomware") return `${input.actor} freshness depends on public-channel, clear-web news, and official corroboration staying current.`;
  return `${input.actor} coverage is usable when vendor, advisory, malware/feed, and research families remain fresh and corroborated.`;
}

function actorFeedExpectedTimeToUsefulSignal(input: {
  status: ActorSourceCoverageStatus;
  actorClass: ActorSourceCoverageMatrixDto["rows"][number]["actorClass"];
  highestValueMissingFamily?: ActorFeedPrioritySourceFamily;
  staleFamilies: PublicSignalSourceFamily[];
}): ActorSourceCoverageMatrixDto["rows"][number]["expectedTimeToUsefulSignal"] {
  if (input.status === "unknown_query" || input.highestValueMissingFamily === undefined && input.status === "coverage_gap") return "unknown_until_sources_added";
  if (input.staleFamilies.length > 0) return input.actorClass === "ransomware" || input.actorClass === "financial_crime" ? "same_day" : "1_3_days";
  if (input.highestValueMissingFamily === "public_channel" || input.highestValueMissingFamily === "clear_web") return input.actorClass === "ransomware" ? "1_3_days" : "3_7_days";
  if (input.highestValueMissingFamily === "vendor_report" || input.highestValueMissingFamily === "cert_government") return input.actorClass === "apt" ? "1_2_weeks" : "3_7_days";
  if (input.highestValueMissingFamily) return "3_7_days";
  return input.actorClass === "ransomware" || input.actorClass === "financial_crime" ? "same_day" : "1_3_days";
}

function actorCoverageStatus(input: {
  actorClass: ActorSourceCoverageMatrixDto["rows"][number]["actorClass"];
  coveredFamilies: PublicSignalSourceFamily[];
  missingFamilies: PublicSignalSourceFamily[];
  staleFamilies: PublicSignalSourceFamily[];
  latestAgeDays?: number;
  freshnessExpectationDays: number;
  blockedRestrictedFamilies: Array<"darkweb_metadata" | "restricted_metadata">;
}): ActorSourceCoverageStatus {
  if (input.actorClass === "unknown") return "unknown_query";
  if (input.blockedRestrictedFamilies.length > 0 && input.coveredFamilies.length < 2) return "metadata_hold";
  if (input.coveredFamilies.length === 0 || input.missingFamilies.length >= input.coveredFamilies.length + 1) return "coverage_gap";
  if ((input.latestAgeDays ?? Number.POSITIVE_INFINITY) > input.freshnessExpectationDays || input.staleFamilies.length >= Math.max(1, input.coveredFamilies.length)) return "stale";
  if (input.missingFamilies.length > 0) return "partial";
  return "ready";
}

function actorCoverageActivationTasks(input: {
  actor: string;
  actorClass: ActorSourceCoverageMatrixDto["rows"][number]["actorClass"];
  status: ActorSourceCoverageStatus;
  missingFamilies: PublicSignalSourceFamily[];
  staleFamilies: PublicSignalSourceFamily[];
  blockedRestrictedFamilies: Array<"darkweb_metadata" | "restricted_metadata">;
}): ActorSourceCoverageMatrixDto["rows"][number]["nextSafeActivationTasks"] {
  const tasks: ActorSourceCoverageMatrixDto["rows"][number]["nextSafeActivationTasks"] = [];
  if (input.missingFamilies.length > 0 && input.actorClass !== "unknown") {
    tasks.push({
      id: `actor_coverage_activate_${hashContent(`${input.actor}:${input.missingFamilies.join("|")}`).slice(0, 12)}`,
      owner: "agent01_source_activation",
      action: "activate_public_source_family",
      families: input.missingFamilies,
      priority: input.status === "coverage_gap" ? "high" : "medium",
      reason: `${input.actor} is missing required safe public source families: ${input.missingFamilies.join(",")}`,
      dryRunOnly: true,
      willMutate: false,
      willStartCrawling: false,
      unsafeUrlExposed: false
    });
  }
  if (input.staleFamilies.length > 0) {
    tasks.push({
      id: `actor_coverage_cadence_${hashContent(`${input.actor}:${input.staleFamilies.join("|")}`).slice(0, 12)}`,
      owner: "agent02_scheduler_cadence",
      action: "raise_cadence",
      families: input.staleFamilies,
      priority: input.actorClass === "ransomware" || input.actorClass === "financial_crime" ? "high" : "medium",
      reason: `${input.actor} has stale public coverage for ${input.staleFamilies.join(",")}`,
      dryRunOnly: true,
      willMutate: false,
      willStartCrawling: false,
      unsafeUrlExposed: false
    });
  }
  if (input.blockedRestrictedFamilies.length > 0) {
    tasks.push({
      id: `actor_coverage_metadata_review_${hashContent(`${input.actor}:restricted`).slice(0, 12)}`,
      owner: "agent05_restricted_metadata",
      action: "request_metadata_review",
      families: [],
      priority: "medium",
      reason: `${input.actor} has restricted metadata context that must remain metadata-only and review-held`,
      dryRunOnly: true,
      willMutate: false,
      willStartCrawling: false,
      unsafeUrlExposed: false
    });
  }
  if (input.status === "stale" || input.status === "metadata_hold" || input.status === "unknown_query") {
    tasks.push({
      id: `actor_coverage_api_${hashContent(`${input.actor}:${input.status}`).slice(0, 12)}`,
      owner: "agent09_api",
      action: "expose_coverage_gap",
      families: input.missingFamilies,
      priority: input.status === "unknown_query" ? "low" : "medium",
      reason: `Expose ${input.actor} coverage status ${input.status} to public product rows`,
      dryRunOnly: true,
      willMutate: false,
      willStartCrawling: false,
      unsafeUrlExposed: false
    });
  }
  return tasks;
}

function normalizeMatchedEntities(input: Partial<PublicSignalMatchedEntities> | undefined): PublicSignalMatchedEntities {
  return {
    actors: uniqueCleanStrings(input?.actors),
    malware: uniqueCleanStrings(input?.malware),
    tools: uniqueCleanStrings(input?.tools),
    cves: uniqueCleanStrings(input?.cves).map((item) => /^cve-/i.test(item) ? item.toUpperCase() : item),
    campaigns: uniqueCleanStrings(input?.campaigns),
    sectors: uniqueCleanStrings(input?.sectors),
    countries: uniqueCleanStrings(input?.countries),
    victims: uniqueCleanStrings(input?.victims)
  };
}

function publicAdvisoryDedupeKey(signal: PublicAdvisorySignalRecord, canonicalUrl: string, entities: PublicSignalMatchedEntities): string {
  const entityKey = [
    ...entities.cves,
    ...entities.actors,
    ...entities.malware,
    ...entities.tools,
    ...entities.campaigns,
    ...entities.victims
  ].map((item) => item.toLowerCase()).sort().join("|");
  return hashContent(`${signal.family}:${canonicalUrl}:${entityKey || normalizeWhitespace(signal.title).toLowerCase()}`);
}

function publicAdvisoryPolicyAllowed(signal: PublicAdvisorySignalRecord, source: SourceRecord | undefined): boolean {
  const policy = signal.policy;
  if (policy && (!policy.publicOnly || policy.authRequired || policy.privateRepo || policy.captchaRequired || policy.exploitPayloadDownload || policy.leakedDataRedistribution || policy.termsBypass)) return false;
  if (signal.state === "policy_disabled") return false;
  if (source && !isApprovedPublicSignalSource(source)) return false;
  return true;
}

function publicAdvisoryQueryFit(signal: PublicAdvisorySignalRecord, queryTerms: string[], entities: PublicSignalMatchedEntities): number {
  const searchable = [
    signal.title,
    signal.summary ?? "",
    ...(signal.tags ?? []),
    ...entities.actors,
    ...entities.malware,
    ...entities.tools,
    ...entities.cves,
    ...entities.campaigns,
    ...entities.sectors,
    ...entities.countries,
    ...entities.victims
  ].join(" ").toLowerCase();
  if (queryTerms.length === 0) return 0.5;
  const hits = queryTerms.filter((term) => searchable.includes(term.toLowerCase())).length;
  if (hits > 0) return clamp01(0.35 + hits / queryTerms.length * 0.65);
  if (queryTerms.some((term) => /^cve-/i.test(term)) && entities.cves.length > 0) return 0.25;
  return 0;
}

function publicAdvisoryFreshness(signal: PublicAdvisorySignalRecord, generatedAt: string): number {
  const latest = signal.updatedAt ?? signal.observedAt ?? signal.publishedAt;
  if (!latest) return 0.45;
  const ageMs = Date.parse(generatedAt) - Date.parse(latest);
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0.75;
  const days = ageMs / 86_400_000;
  if (days <= 7) return 1;
  if (days <= 30) return 0.78;
  if (days <= 120) return 0.45;
  return 0.18;
}

function publicAdvisoryStale(signal: PublicAdvisorySignalRecord, generatedAt: string): boolean {
  return signal.state === "stale" || publicAdvisoryFreshness(signal, generatedAt) < 0.3;
}

function publicAdvisoryFamilySummary(
  signals: PublicAdvisorySignalConnectorDto["rankedSignals"]
): PublicAdvisorySignalConnectorDto["sourceFamilySummary"] {
  return Object.fromEntries(PUBLIC_SIGNAL_FAMILIES.map((family) => {
    const familySignals = signals.filter((signal) => signal.family === family);
    const selected = familySignals.filter((signal) => signal.policyAllowed && !signal.suppressionReason && signal.state !== "duplicate_suppressed");
    return [family, {
      candidateCount: familySignals.length,
      selectedCount: selected.length,
      topScore: roundMetric(Math.max(0, ...familySignals.map((signal) => signal.rankingScore)))
    }];
  })) as PublicAdvisorySignalConnectorDto["sourceFamilySummary"];
}

function publicSignalHasQueryMatch(signal: PublicAdvisorySignalConnectorDto["rankedSignals"][number]): boolean {
  return signal.queryMatched;
}

function inferPublicAdvisoryQueryClass(query: string): string {
  if (/\bCVE-\d{4}-\d{4,}\b/i.test(query)) return "cve";
  if (/akira|lockbit|ransom/i.test(query)) return "ransomware";
  if (/snake|cobalt strike|mimikatz|malware|tool/i.test(query)) return "malware_tool";
  if (/campaign|intrusion|operation/i.test(query)) return "campaign";
  if (/energy|finance|health|telecom|sector/i.test(query)) return "sector";
  if (/norway|china|iran|russia|country/i.test(query)) return "country";
  return "actor";
}

function publicAdvisoryConnectorForFamily(family: PublicSignalSourceFamily): NonNullable<PublicAdvisorySignalRecord["provenance"]>["connector"] {
  if (family === "github_advisory") return "github_security_advisory";
  if (family === "cert_government") return "cert_advisory";
  if (family === "vendor_report") return "vendor_report";
  if (family === "malware_report_feed") return "malware_feed";
  return "public_report_index";
}

function publicSourcePackQueryClass(value: string): PublicSourcePackQueryClass {
  if (value === "cve") return "cve_advisory";
  if (value === "malware") return "malware_tool";
  if (value === "actor") return "apt";
  if (value === "ransomware" || value === "country" || value === "sector" || value === "campaign" || value === "infrastructure") return value;
  if (value === "victim") return "victim_company";
  if (/ransom/i.test(value)) return "ransomware";
  if (/cve|advisory/i.test(value)) return "cve_advisory";
  if (/malware|tool/i.test(value)) return "malware_tool";
  if (/country/i.test(value)) return "country";
  if (/sector/i.test(value)) return "sector";
  if (/campaign/i.test(value)) return "campaign";
  if (/infra/i.test(value)) return "infrastructure";
  if (/victim|company/i.test(value)) return "victim_company";
  return "apt";
}

function publicSourcePackFamilyForEntry(source: TelegramPublicSourcePack["sources"][number]): PublicSignalSourceFamily {
  const text = [
    source.name,
    source.publicUrl,
    source.channelHandle,
    ...source.topicTags
  ].join(" ");
  if (/github|ghsa|osv|nvd|cve/i.test(text)) return "github_advisory";
  if (/cert|cisa|government|gov|csirt|advisory/i.test(text)) return "cert_government";
  if (/vendor|microsoft|google|mandiant|unit 42|crowdstrike|recorded future/i.test(text)) return "vendor_report";
  if (/malware|tool|bazaar|urlhaus|threatfox|malpedia/i.test(text)) return "malware_report_feed";
  if (/research|report|blog|labs/i.test(text)) return "public_research_feed";
  return "public_channel";
}

function publicSourcePackQueryClassesForEntry(source: TelegramPublicSourcePack["sources"][number]): PublicSourcePackQueryClass[] {
  const classes: PublicSourcePackQueryClass[] = [];
  if (source.focus.actors.length > 0) classes.push("apt");
  if (source.focus.ransomware.length > 0) classes.push("ransomware");
  if (source.focus.cves.length > 0) classes.push("cve_advisory");
  if (source.focus.victims.length > 0) classes.push("victim_company");
  if (source.focus.sectors.length > 0) classes.push("sector");
  if (source.focus.countries.length > 0) classes.push("country");
  if (source.topicTags.some((tag) => /malware|tool/i.test(tag))) classes.push("malware_tool");
  if (source.topicTags.some((tag) => /campaign|operation/i.test(tag))) classes.push("campaign");
  if (source.topicTags.some((tag) => /infra|ioc|indicator/i.test(tag))) classes.push("infrastructure");
  return uniqueCleanStrings(classes) as PublicSourcePackQueryClass[];
}

function requiredFamiliesForPublicSourcePack(queryClass: PublicSourcePackQueryClass): PublicSignalSourceFamily[] {
  if (queryClass === "cve_advisory") return ["github_advisory", "cert_government", "vendor_report"];
  if (queryClass === "malware_tool") return ["malware_report_feed", "vendor_report", "public_research_feed"];
  if (queryClass === "ransomware" || queryClass === "victim_company") return ["vendor_report", "cert_government", "public_research_feed"];
  if (queryClass === "country" || queryClass === "sector") return ["cert_government", "public_research_feed", "vendor_report"];
  if (queryClass === "campaign" || queryClass === "infrastructure") return ["vendor_report", "public_research_feed", "clear_web"];
  return ["vendor_report", "cert_government", "public_research_feed"];
}

function inferPublicSignalFamily(source: SourceRecord): PublicSignalSourceFamily {
  const text = sourceSearchableText(source);
  if (source.type === "telegram_public") return "public_channel";
  if (/github|ghsa|security-advisor|security advisory|osv|cve\.org|nvd/i.test(text)) return "github_advisory";
  if (/cert|cisa|ncsc|gov|government|us-cert|cyber\.gc\.ca|enisa|csirt/i.test(text)) return "cert_government";
  if (/malware|abuse\.ch|malpedia|bazaar|urlhaus|virustotal|hybrid-analysis|threatfox/i.test(text)) return "malware_report_feed";
  if (/vendor|microsoft|google|mandiant|crowdstrike|palo alto|unit 42|sentinelone|proofpoint|eset|kaspersky|recorded future|rapid7/i.test(text)) return "vendor_report";
  if (/mastodon|bluesky|twitter|x\.com|social|reddit/i.test(text)) return "public_social";
  if (/research|blog|report|whitepaper|analysis|labs/i.test(text)) return "public_research_feed";
  return "clear_web";
}

function sourceSearchableText(source: SourceRecord): string {
  return [
    source.id,
    source.name,
    source.type,
    source.url,
    source.language ?? "",
    source.legalNotes,
    ...(source.tags ?? []),
    ...stringArray(source.metadata?.topicTags),
    ...stringArray(source.metadata?.actors),
    ...stringArray(source.metadata?.aliases),
    ...stringArray(source.metadata?.ransomware),
    ...stringArray(source.metadata?.cves),
    ...stringArray(source.metadata?.victims),
    ...stringArray(source.metadata?.sectors),
    ...stringArray(source.metadata?.countries),
    ...stringArray(source.metadata?.sourceFamilies),
    ...stringArray(source.catalog?.coverage.topics),
    ...stringArray(source.catalog?.coverage.actors),
    ...stringArray(source.catalog?.coverage.aliases),
    ...stringArray(source.catalog?.coverage.industries),
    ...stringArray(source.catalog?.coverage.regions),
    ...stringArray(source.catalog?.coverage.countries),
    source.catalog?.publisher.name ?? "",
    source.catalog?.publisher.trustBasis ?? ""
  ].join(" ").toLowerCase();
}

function publicSignalFreshness(source: SourceRecord, generatedAt: string): number {
  const latest = source.lastSeenAt ?? source.crawlState?.lastCollectedAt ?? source.health?.lastSuccessAt ?? source.updatedAt;
  const ageMs = Date.parse(generatedAt) - Date.parse(latest);
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0.7;
  const ageSeconds = ageMs / 1000;
  const cadence = Math.max(300, source.crawlFrequencySeconds || source.catalog?.collection.crawlCadenceSeconds || 3600);
  if (ageSeconds <= cadence * 2) return 1;
  if (ageSeconds <= cadence * 8) return 0.72;
  if (ageSeconds <= cadence * 48) return 0.42;
  return 0.18;
}

function publicSignalRateLimitState(source: SourceRecord, generatedAt: string): PublicSignalSourceSelectionDto["rateLimit"] {
  const backoffUntil = source.crawlState?.backoffUntil ?? stringValue(source.metadata?.rateLimitResetAt) ?? stringValue(source.metadata?.backoffUntil);
  const retryAfterSeconds = backoffUntil ? Math.max(0, Math.ceil((Date.parse(backoffUntil) - Date.parse(generatedAt)) / 1000)) : undefined;
  return {
    delayed: retryAfterSeconds !== undefined && retryAfterSeconds > 0,
    retryAfterSeconds: retryAfterSeconds && retryAfterSeconds > 0 ? retryAfterSeconds : undefined,
    backoffUntil: retryAfterSeconds && retryAfterSeconds > 0 ? backoffUntil : undefined
  };
}

function isApprovedPublicSignalSource(source: SourceRecord): boolean {
  if (source.accessMethod !== "public_http" && source.accessMethod !== "official_api" && source.accessMethod !== "manual_seed") return false;
  if (["disabled", "rejected", "retired"].includes(source.status)) return false;
  if (source.governance?.approvalRequired && source.governance.approvalState !== "approved") return false;
  if (source.catalog?.approvalScope === "disabled" || source.catalog?.approvalScope === "restricted_protocol") return false;
  return !/(?:private repo|private repository|invite[- ]only|account automation|captcha required|requires captcha|auth required|requires auth|login required|requires login|token required|bypass required|scrape behind login|terms bypass)/i.test(`${source.url} ${source.legalNotes}`);
}

function isSafePublicSignalUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  return !/(?:invite|joinchat|\+[\w-]{8,}|onion|i2p|freenet|credential|password|token=|apikey=)/i.test(url);
}

function unsafeSignalUrlRef(url: string): string {
  return `unsafe_url_hash:${hashContent(normalizeSignalUrl(url)).slice(0, 16)}`;
}

function normalizeSignalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.searchParams.sort();
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().replace(/\/$/, "").toLowerCase();
  }
}

function groupEvidenceBySource(evidence: TelegramPublicEvidenceDto[]): Map<string, TelegramPublicEvidenceDto[]> {
  const grouped = new Map<string, TelegramPublicEvidenceDto[]>();
  for (const item of evidence) {
    const bucket = grouped.get(item.sourceId) ?? [];
    bucket.push(item);
    grouped.set(item.sourceId, bucket);
  }
  return grouped;
}

function expandPublicSignalQueryTerms(query: string, entityType?: string): string[] {
  const normalized = query.trim();
  const terms = new Set<string>([normalized]);
  const aliasGroups = [
    [/apt29|cozy bear|nobelium|dukes/i, ["APT29", "Cozy Bear", "Nobelium", "The Dukes"]],
    [/apt42|charming kitten|mint sandstorm/i, ["APT42", "Charming Kitten", "Mint Sandstorm"]],
    [/turla|snake|venomous bear/i, ["Turla", "Snake", "Venomous Bear"]],
    [/volt typhoon|vanguard panda/i, ["Volt Typhoon", "Vanguard Panda"]],
    [/scattered spider|octo tempest|unc3944/i, ["Scattered Spider", "Octo Tempest", "UNC3944"]],
    [/\bakira\b/i, ["Akira", "Akira ransomware"]],
    [/fin7|carbanak/i, ["FIN7", "Carbanak"]],
    [/lazarus|hidden cobra/i, ["Lazarus", "Hidden Cobra"]],
    [/sandworm|voodoo bear/i, ["Sandworm", "Voodoo Bear"]]
  ] as const;
  for (const [pattern, aliases] of aliasGroups) {
    if (pattern.test(normalized)) for (const alias of aliases) terms.add(alias);
  }
  for (const cve of normalized.match(/\bCVE-\d{4}-\d{4,}\b/gi) ?? []) terms.add(cve.toUpperCase());
  if (entityType === "cve") terms.add(normalized.toUpperCase());
  if (entityType === "sector" || entityType === "country" || entityType === "malware") terms.add(normalized.toLowerCase());
  return [...terms].map((term) => normalizeWhitespace(term)).filter(Boolean);
}

function publicLiveEntitySpecificity(value: Partial<PublicSignalMatchedEntities> | Record<string, readonly string[] | undefined> | undefined): number {
  if (!value) return 0;
  const highSpecificity = uniqueCleanStrings([
    ...stringArray(value.actors),
    ...stringArray(value.cves),
    ...stringArray(value.campaigns),
    ...stringArray(value.malware),
    ...stringArray(value.tools),
    ...stringArray(value.victims)
  ]);
  const contextSpecificity = uniqueCleanStrings([
    ...stringArray(value.sectors),
    ...stringArray(value.countries)
  ]);
  return roundMetric(clamp01((highSpecificity.length * 0.22) + (contextSpecificity.length * 0.12)));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function uniqueCleanStrings(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function uniqueStrings(values: readonly string[] | undefined): string[] {
  return uniqueCleanStrings(values);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function roundMetric(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export const buildPublicSignalLiveCollectionLoop = buildPublicSignalLiveCollectionLoopDto;
