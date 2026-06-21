import type {
  AccessMethod,
  CollectedItem,
  SourceActivationStatus,
  SourceCatalogMetadata,
  SourceCollectionSla,
  SourceCoverageExplanation,
  LiveSearchPlannerDto,
  SourceHealthStatus,
  SourceRecord,
  SourceRisk,
  SourceType
} from "../types.ts";

export interface SeedSourceBundle {
  version: 1;
  name: string;
  description?: string;
  generatedAt?: string;
  sources: SeedSourceInput[];
}

export interface SeedSourceInput {
  id?: string;
  tenantId?: string;
  name: string;
  type: SourceType;
  url: string;
  accessMethod: AccessMethod;
  risk: SourceRisk;
  trustScore: number;
  language?: string;
  crawlFrequencySeconds: number;
  legalNotes: string;
  lastSeenAt?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  catalog?: SourceCatalogMetadata;
}

export interface SeedSourceDuplicate {
  key: string;
  inputIndex: number;
  existingSourceId?: string;
  duplicateOfIndex?: number;
}

export interface SeedSourceValidationError {
  inputIndex: number;
  sourceName?: string;
  message: string;
}

export interface SeedSourceImportReport {
  dryRun: boolean;
  valid: boolean;
  accepted: SourceRecord[];
  duplicates: SeedSourceDuplicate[];
  errors: SeedSourceValidationError[];
  activation: SourceActivationSummary;
  compliance: SeedSourceComplianceReport;
}

export interface SeedSourceComplianceReport {
  missingLegalNotes: SeedSourceValidationError[];
  missingCatalog: SeedSourceValidationError[];
  stale: Array<{ sourceId: string; sourceName: string; lastSeenAt: string; freshnessTargetSeconds: number }>;
  overlappingCoverage: Array<{ leftIndex: number; rightIndex: number; overlap: string[] }>;
}

export interface SourceActivationSummary {
  approved: number;
  blocked: number;
  stale: number;
  duplicates: number;
  missingLegalNotes: number;
  adapterIncompatible: number;
}

export interface SourceActivationReport {
  query: string;
  generatedAt: string;
  sources: SourceCoverageExplanation[];
  summary: Record<SourceActivationStatus, number>;
}

export interface LiveSearchSourceActivationDto {
  query: string;
  generatedAt: string;
  coverageGaps: Array<{
    category: SourceActivationStatus;
    count: number;
    sourceIds: string[];
    reason: string;
  }>;
  activationRecommendations: Array<LiveSearchPlannerDto["recommendedSourceActivations"][number] & {
    status: SourceActivationStatus;
    sourceName: string;
    matchedTopics: string[];
    matchedActors: string[];
    matchedIndustries: string[];
    matchedRegions: string[];
  }>;
  sourceCoverage: SourceActivationReport;
}

export type SourceActivationUnderservedReasonCode =
  | "missing_actor_coverage"
  | "stale_cadence"
  | "no_public_channel_coverage"
  | "no_approved_restricted_metadata_source"
  | "source_unhealthy"
  | "source_disabled";

export interface SourceActivationApiSourceSummary extends SourceCoverageExplanation {
  tenantId?: string;
  sourceType: SourceType;
  url: string;
  approvalScope?: SourceCatalogMetadata["approvalScope"];
  healthStatus?: SourceHealthStatus;
  freshnessTargetSeconds?: number;
}

export interface SourceActivationDuplicateGroup {
  key: string;
  sourceIds: string[];
}

export interface SourceActivationUnderservedReason {
  code: SourceActivationUnderservedReasonCode;
  severity: "info" | "warning" | "critical";
  reason: string;
  sourceIds: string[];
  suggestedAction: LiveSearchPlannerDto["recommendedSourceActivations"][number]["requiredAction"];
}

export interface SourceActivationApiResponse {
  query: string;
  tenantId?: string;
  generatedAt: string;
  activeCoverage: SourceActivationApiSourceSummary[];
  approvedIdleSources: SourceActivationApiSourceSummary[];
  candidateOnlyGaps: SourceActivationApiSourceSummary[];
  missingLegalNotes: SourceActivationApiSourceSummary[];
  policyBlocks: SourceActivationApiSourceSummary[];
  staleSources: SourceActivationApiSourceSummary[];
  duplicateSources: SourceActivationDuplicateGroup[];
  adapterIncompatibilities: SourceActivationApiSourceSummary[];
  coverageGaps: Array<{
    category: SourceActivationStatus;
    count: number;
    sourceIds: string[];
    reason: string;
  }>;
  underservedReasons: SourceActivationUnderservedReason[];
  activationRecommendations: LiveSearchSourceActivationDto["activationRecommendations"];
  sourcePackRecommendations: SafePublicSourcePackRecommendation[];
  coverageSummary: Record<SourceActivationStatus, number>;
  sourceCoverage: SourceActivationReport;
}

export type SafePublicSourcePackInstallMode = "dry_run" | "install";

export interface SafePublicSourcePackRecommendation {
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  url: string;
  tenantId?: string;
  coverageTags: string[];
  requiredAction: "install_candidate" | "skip_duplicate" | "fix_compliance";
  reasons: string[];
  score: number;
}

export interface SafePublicSourcePackInstallPlan {
  mode: SafePublicSourcePackInstallMode;
  dryRun: boolean;
  safeToInstall: boolean;
  willStartCrawling: false;
  packName: string;
  tenantId?: string;
  generatedAt: string;
  acceptedSourceCount: number;
  rejectedSourceCount: number;
  duplicateSourceCount: number;
  validation: SeedSourceImportReport;
  recommendations: SafePublicSourcePackRecommendation[];
}

export interface SafePublicStarterPackCoverageQuery {
  query: string;
  coverageReady: boolean;
  activeCoverageCount: number;
  candidateCoverageCount: number;
  topSourceIds: string[];
  underservedReasons: SourceActivationUnderservedReason[];
}

export interface SafePublicStarterPackCoverageValidation {
  packName: string;
  generatedAt: string;
  valid: boolean;
  queries: SafePublicStarterPackCoverageQuery[];
}

export interface SourceCoveragePlanVertical {
  vertical: "actor_intelligence" | "vulnerability_intelligence" | "ransomware_victim_reporting" | "vendor_research" | "government_advisories" | "malware_reports" | "public_datasets" | "public_channel" | "restricted_metadata";
  present: boolean;
  activeCount: number;
  candidateCount: number;
  recommendedSourceIds: string[];
  reason: string;
}

export interface SourceCoveragePlanQuery {
  query: string;
  coverageState: "ready" | "partial" | "needs_review" | "blocked";
  slo: SourceCoverageSloEvaluation;
  drift: SourceCoverageDriftItem[];
  portfolio: SourcePortfolioQuerySummary;
  activationBatch: SourceActivationBatchQuery;
  runtimeSla: SourceRuntimeSlaQuery;
  coverageCloseout: SourceCoverageCloseoutQuery;
  executionReadiness: SourceActivationExecutionQueryPacket;
  activeSources: SourceActivationApiSourceSummary[];
  eligibleSources: SourceActivationApiSourceSummary[];
  selectedSources: SourceActivationApiSourceSummary[];
  approvedIdleSources: SourceActivationApiSourceSummary[];
  missingApprovedPublicSources: SafePublicSourcePackRecommendation[];
  missingVerticals: SourceCoveragePlanVertical[];
  staleSources: SourceActivationApiSourceSummary[];
  policyBlocks: SourceActivationApiSourceSummary[];
  adapterIncompatibilities: SourceActivationApiSourceSummary[];
  safeSourcePackRecommendations: SafePublicSourcePackRecommendation[];
  underservedReasons: SourceActivationUnderservedReason[];
}

export interface SourceCoveragePlanApiResponse {
  endpoint: "/v1/sources/coverage-plan";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  tenantId?: string;
  generatedAt: string;
  queries: SourceCoveragePlanQuery[];
  slo: SourceCoverageSloRollup;
  drift: SourceCoverageDriftItem[];
  sourcePackInstallPlans: Array<{
    packName: string;
    safeToInstall: boolean;
    acceptedSourceCount: number;
    rejectedSourceCount: number;
    duplicateSourceCount: number;
    willStartCrawling: false;
  }>;
  governanceDrift: SourceCoverageGovernanceDriftItem[];
  remediationPlans: SourceCoverageRemediationPlan[];
  forbiddenSourceClasses: string[];
  coordination: {
    agent09Fields: string[];
    agent10PromotionFields: string[];
  };
}

export type SourceCoverageGovernanceDriftCode =
  | "approval_expired"
  | "approval_not_approved"
  | "stale_legal_notes"
  | "missing_robots_notes"
  | "stale_robots_notes"
  | "stale_health"
  | "adapter_mismatch"
  | "duplicate_canonical_url"
  | "source_pack_version_skew";

export type SourceCoverageSloQueryClass = "actor" | "ransomware_victim" | "cve" | "sector" | "country" | "malware_tool";
export type SourceCoverageSloStatus = "pass" | "warning" | "fail";

export type SourceCoverageDriftCode =
  | SourceCoverageGovernanceDriftCode
  | "below_minimum_active_sources"
  | "insufficient_source_family_diversity"
  | "freshness_slo_missed"
  | "missing_geographic_coverage"
  | "missing_sector_coverage"
  | "missing_legal_review"
  | "missing_robots_review"
  | "unsafe_source_class_excluded"
  | "missing_approved_public_source_pack";

export interface SourceCoverageSloEvaluation {
  queryClass: SourceCoverageSloQueryClass;
  status: SourceCoverageSloStatus;
  requirements: {
    minActiveSafePublicSources: number;
    minSourceFamilies: number;
    maxFreshnessSeconds: number;
    requireLegalReview: true;
    requireRobotsReview: true;
    requireGeographicCoverage: boolean;
    requireSectorCoverage: boolean;
  };
  actuals: {
    activeSafePublicSources: number;
    sourceFamilies: string[];
    freshSafePublicSources: number;
    legalReviewComplete: boolean;
    robotsReviewComplete: boolean;
    geographicCoverage: string[];
    sectorCoverage: string[];
    excludedUnsafeSourceIds: string[];
  };
  failures: SourceCoverageDriftCode[];
}

export interface SourceCoverageDriftItem {
  code: SourceCoverageDriftCode;
  query?: string;
  sourceId?: string;
  sourceName?: string;
  severity: "info" | "warning" | "critical";
  reason: string;
  recommendedAction: SourceCoverageGovernanceDriftItem["recommendedAction"] | "reduce_cadence" | "increase_cadence" | "add_source_pack";
}

export interface SourceCoverageSloRollup {
  status: SourceCoverageSloStatus;
  passed: number;
  warning: number;
  failed: number;
  queryClasses: Record<SourceCoverageSloQueryClass, number>;
}

export interface SourcePortfolioGroup {
  key: string;
  label: string;
  approved: number;
  active: number;
  candidate: number;
  safePublicSloEligible: number;
  sourceIds: string[];
}

export interface SourcePortfolioQuerySummary {
  query: string;
  queryClass: SourceCoverageSloQueryClass;
  familyGroups: SourcePortfolioGroup[];
  actorGroups: SourcePortfolioGroup[];
  regionGroups: SourcePortfolioGroup[];
  sectorGroups: SourcePortfolioGroup[];
  languageGroups: SourcePortfolioGroup[];
  legalReviewAgeGroups: SourcePortfolioGroup[];
  robotsReviewAgeGroups: SourcePortfolioGroup[];
  reliabilityGroups: SourcePortfolioGroup[];
  extractionYieldGroups: SourcePortfolioGroup[];
}

export type SourceReliabilityDecision = "trusted" | "throttled" | "paused" | "retired" | "promote_candidate" | "needs_review";

export interface SourceReliabilityScoreInputs {
  freshness: number;
  usefulAnswerYield: number;
  parserHealth: number;
  legalReviewAge: number;
  robotsReviewAge: number;
  duplicateRate: number;
  evidenceReplaySuccess: number;
  analystOverrideHistory: number;
  falsePositiveHistory: number;
  familyDiversityValue: number;
  schedulerCostEfficiency: number;
}

export interface SourceReliabilityEconomicsRow {
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  sourceFamily: string;
  runtimeStatus: SourceRecord["status"];
  safePublicEligible: boolean;
  decision: SourceReliabilityDecision;
  reliabilityScore: number;
  scoreInputs: SourceReliabilityScoreInputs;
  economics: {
    marginalValue: number;
    expectedUsefulEvidenceItemsPerDay: number;
    costPerUsefulEvidenceItem: number;
    estimatedTasksPerDay: number;
    activationWaveReady: boolean;
    staleSuppressed: boolean;
    duplicateSuppressed: boolean;
  };
  reasons: string[];
  handoffs: {
    agent02SchedulerPriority: "high" | "normal" | "low" | "suppress";
    agent03ParserCapability: "supported" | "needs_parser_repair" | "restricted_metadata_handoff";
    agent04SourcePackRecommendation: "promote" | "dedupe" | "fill_family_gap" | "hold";
    agent06EvidenceReplay: "ready" | "needs_replay_proof" | "suppressed";
    agent07QualityConfidence: "confidence_input_ready" | "false_positive_watch" | "quality_hold";
    agent09ApiContract: "source_reliability_fields_ready";
    agent10SloRunbook: "slo_ready" | "watch" | "release_hold";
  };
  guardrails: {
    dryRun: true;
    willMutate: false;
    willStartCrawling: false;
    noRestrictedActivation: true;
    noLeakedDataAccess: true;
  };
}

export interface SourceReliabilityEconomicsPacket {
  schemaVersion: "ti.source_reliability_economics.v1";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  generatedAt: string;
  query: string;
  queryClass: SourceCoverageSloQueryClass;
  summary: {
    sourceCount: number;
    trusted: number;
    throttled: number;
    paused: number;
    retired: number;
    promoteCandidates: number;
    needsReview: number;
    averageReliabilityScore: number;
    sourceFamilyCoverage: number;
    marginalValueOfProposedSources: number;
    costPerUsefulEvidenceItem: number;
    staleSourceSuppression: number;
    duplicateSuppression: number;
    activationWaveReady: number;
  };
  sources: SourceReliabilityEconomicsRow[];
  portfolioEconomics: {
    familyCoverage: Array<{ family: string; sourceCount: number; activeCount: number; averageReliabilityScore: number }>;
    marginalValueLeaders: string[];
    staleSuppressedSourceIds: string[];
    duplicateSuppressedSourceIds: string[];
    activationWaveReadySourceIds: string[];
  };
  governance: {
    approvalMode: "explicit_operator_approval";
    noSilentActivation: true;
    restrictedSourcesMetadataOnly: true;
    forbiddenSourceClasses: string[];
  };
  coordination: {
    agent02Fields: string[];
    agent03Fields: string[];
    agent04Fields: string[];
    agent06Fields: string[];
    agent07Fields: string[];
    agent09Fields: string[];
    agent10Fields: string[];
  };
}

export interface SourcePackOnboardingPlan {
  packName: string;
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  duplicateAnalysis: {
    duplicateSourceCount: number;
    duplicateSourceIds: string[];
  };
  complianceCompleteness: {
    complete: boolean;
    missingLegalNotes: number;
    missingCatalog: number;
    rejectedSourceCount: number;
  };
  expectedCoverageDelta: Array<{
    query: string;
    candidateAdditions: number;
    sourceIds: string[];
    closesSloFailures: SourceCoverageDriftCode[];
  }>;
  schedulerCost: {
    estimatedTasksPerDay: number;
    maxCadenceSeconds: number;
    budgetClasses: string[];
  };
  parserCompatibility: Array<{
    sourceId: string;
    sourceType: SourceType;
    compatible: boolean;
    adapterCompatibility: SourceType[];
  }>;
  rollbackQuarantineState: Array<{
    sourceId: string;
    rollbackReason?: string;
    quarantineReason?: string;
  }>;
  promotionSafety: {
    safeToPromote: boolean;
    forbiddenSourceClasses: string[];
    notes: string[];
  };
}

export interface SourceCoverageBurnDownReport {
  query: string;
  statusBefore: SourceCoverageSloStatus;
  statusAfterPlannedAdditions: SourceCoverageSloStatus;
  sourceAdditions: string[];
  legalReviews: string[];
  cadenceIncreases: string[];
  cadenceReductions: string[];
  parserFixes: string[];
  duplicateRetirements: string[];
  blockedUnsafeSourceIds: string[];
}

export type SourcePortfolioMigrationState = "candidate" | "sandbox" | "canary" | "active" | "degraded" | "retired";

export interface SourcePortfolioMigrationLane {
  state: SourcePortfolioMigrationState;
  sourceCount: number;
  sourceIds: string[];
  approvalRequired: boolean;
  rollbackAction: "remove_candidate" | "return_to_sandbox" | "pause_canary" | "quarantine_or_degrade" | "restore_previous_cadence" | "none";
  parserCapability: "supported" | "needs_repair" | "metadata_only_handoff";
  sourceFamilies: string[];
  averageReliability: number;
  legalReview: "current" | "stale" | "missing" | "mixed";
  robotsReview: "current" | "stale" | "missing" | "not_required" | "mixed";
  cadenceImpact: {
    estimatedTasksPerDay: number;
    maxCadenceSeconds: number;
    budgetClasses: string[];
  };
}

export interface SourcePortfolioMigrationQueryClassReadiness {
  queryClass: SourceCoverageSloQueryClass;
  readiness: "ready" | "partial" | "hold";
  activeSafePublicSources: number;
  candidateSources: number;
  canarySources: number;
  missingFamilies: string[];
  representativeQueries: string[];
  recommendedAction: "promote_to_canary" | "add_source_pack" | "repair_parser" | "legal_review" | "hold_restricted";
}

export interface SourcePortfolioMigrationReadiness {
  schemaVersion: "ti.source_portfolio_migration_readiness.v1";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  generatedAt: string;
  tenantId?: string;
  summary: {
    sourceCount: number;
    safePublicEligible: number;
    candidate: number;
    sandbox: number;
    canary: number;
    active: number;
    degraded: number;
    retired: number;
    restrictedMetadataOnly: number;
    recommendedCanaryPromotions: number;
  };
  lanes: SourcePortfolioMigrationLane[];
  queryClasses: SourcePortfolioMigrationQueryClassReadiness[];
  recommendedActions: Array<{
    action: "promote_candidate_to_sandbox" | "promote_sandbox_to_canary" | "restore_degraded_source" | "retire_duplicate" | "request_legal_review" | "request_parser_repair";
    sourceIds: string[];
    reason: string;
    approvalRequired: boolean;
    dryRun: true;
    willMutate: false;
    willStartCrawling: false;
    rollback: string;
  }>;
  guardrails: {
    approvalMode: "explicit_operator_approval";
    restrictedMetadataOnly: true;
    noSilentActivation: true;
    forbiddenSourceClasses: string[];
  };
  handoffs: {
    agent02FreshnessSlo: string[];
    agent03AdapterRepair: string[];
    agent04SourceExpansion: string[];
    agent06EvidenceChain: string[];
    agent07ActorFreshness: string[];
    agent09ApiFields: string[];
    agent10ReleaseGate: string[];
  };
}

export type SourceSloBurnRateSignal =
  | "freshness"
  | "parser_failure"
  | "low_evidence_yield"
  | "duplicate_rate"
  | "outage_wave"
  | "retirement_risk"
  | "approval_expiry"
  | "query_coverage_gap";

export type SourceSloBurnRateSeverity = "healthy" | "watch" | "burning" | "critical";

export type SourceSloBurnRateRemediationAction =
  | "lower_cadence"
  | "raise_cadence"
  | "quarantine"
  | "retire"
  | "request_parser_repair"
  | "request_source_pack_expansion"
  | "request_evidence_replay"
  | "request_analyst_approval"
  | "hold_restricted_metadata";

export type SourceSloBurnRateOwner =
  | "agent_01"
  | "agent_02"
  | "agent_03"
  | "agent_04"
  | "agent_06"
  | "agent_07"
  | "agent_09"
  | "agent_10";

export interface SourceSloBurnRateRow {
  id: string;
  signal: SourceSloBurnRateSignal;
  severity: SourceSloBurnRateSeverity;
  burnRate: number;
  window: {
    short: "1h";
    long: "24h";
    ratio: number;
  };
  sourceFamily: string;
  queryClass: SourceCoverageCloseoutQueryClass;
  sourceIds: string[];
  sourceCount: number;
  reason: string;
  recommendedAction: SourceSloBurnRateRemediationAction;
  owner: SourceSloBurnRateOwner;
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  noLeakBoundary: {
    rawUrlsExposed: false;
    restrictedMaterialExposed: false;
    automaticRestrictedActivation: false;
  };
}

export interface SourceSloBurnRateRemediationQueueItem {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  action: SourceSloBurnRateRemediationAction;
  owner: SourceSloBurnRateOwner;
  groupKey: string;
  sourceFamily: string;
  queryClass: SourceCoverageCloseoutQueryClass;
  sourceIds: string[];
  reasons: string[];
  rollback: string;
  approvalRequired: boolean;
  routeHint: "/v1/sources/portfolio" | "/v1/sources/runtime-sla" | "/v1/sources/activation-batches" | "/v1/sources/coverage-closeout" | "/v1/analyst/source-activation-packets";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
}

export interface SourceSloBurnRatePacket {
  schemaVersion: "ti.source_slo_burn_rate.v1";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  generatedAt: string;
  tenantId?: string;
  summary: {
    totalSignals: number;
    critical: number;
    burning: number;
    watch: number;
    healthy: number;
    remediationItems: number;
    worstBurnRate: number;
  };
  signals: SourceSloBurnRateRow[];
  remediationQueue: SourceSloBurnRateRemediationQueueItem[];
  groupedByFamily: Array<{
    sourceFamily: string;
    critical: number;
    burning: number;
    watch: number;
    sourceIds: string[];
  }>;
  groupedByQueryClass: Array<{
    queryClass: SourceCoverageCloseoutQueryClass;
    critical: number;
    burning: number;
    watch: number;
    sourceIds: string[];
  }>;
  guardrails: {
    dryRunOnly: true;
    noAutomaticRestrictedActivation: true;
    noRawUnsafeUrls: true;
    forbiddenSourceClasses: string[];
  };
  handoffs: {
    agent02: string[];
    agent03: string[];
    agent04: string[];
    agent06: string[];
    agent07: string[];
    agent09: string[];
    agent10: string[];
  };
}

export type SourceTenantActivationDecision =
  | "activate"
  | "stage"
  | "hold"
  | "retire"
  | "hold_restricted_metadata";

export type SourceTenantActivationSourceClass =
  | "public_rss_blog"
  | "advisory_api"
  | "public_channel"
  | "dynamic_browser_candidate"
  | "report_pdf"
  | "restricted_metadata_only";

export interface SourceTenantActivationApprovalPacket {
  id: string;
  tenantId: string;
  queryClass: SourceCoverageCloseoutQueryClass;
  sourceFamily: string;
  sourceClass: SourceTenantActivationSourceClass;
  decision: SourceTenantActivationDecision;
  sourceIds: string[];
  sourceCount: number;
  approvalState: "not_required" | "approved" | "pending" | "expired" | "blocked";
  approvalRequired: boolean;
  reasons: string[];
  blockers: Array<"policy_hold" | "parser_certification" | "parser_retention_review" | "legal_review" | "robots_review" | "freshness_debt" | "duplicate" | "low_evidence_yield" | "tenant_scope" | "restricted_metadata" | "corroboration_required">;
  expectedEffect: {
    coverageGap: "closes_gap" | "improves_gap" | "no_effect";
    freshnessDebt: "reduces" | "unchanged" | "held";
    publicSearchResponsive: true;
  };
  safetyPolicy: {
    metadataOnly: boolean;
    noRawUnsafeUrls: true;
    noRestrictedAutoActivation: true;
    noMutationWithoutApproval: true;
  };
  rollback: string;
  routeHint: "/v1/sources/portfolio" | "/v1/sources/activation-batches" | "/v1/analyst/source-activation-packets";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
}

export interface SourceTenantActivationGroup {
  tenantId: string;
  queryClass: SourceCoverageCloseoutQueryClass;
  sourceFamily: string;
  sourceClass: SourceTenantActivationSourceClass;
  decision: SourceTenantActivationDecision;
  sourceIds: string[];
  approvalPacketIds: string[];
  schedulerBudgetClass: SourceCollectionSla["budgetClass"];
  reason: string;
}

export interface SourceTenantActivationPacket {
  schemaVersion: "ti.tenant_source_activation.v1";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  generatedAt: string;
  tenantId?: string;
  summary: {
    tenantCount: number;
    approvalPacketCount: number;
    activate: number;
    stage: number;
    hold: number;
    retire: number;
    restrictedMetadataHeld: number;
    pendingApproval: number;
    expiredApproval: number;
  };
  approvalPackets: SourceTenantActivationApprovalPacket[];
  groups: SourceTenantActivationGroup[];
  tenantIsolation: Array<{
    tenantId: string;
    sourceCount: number;
    sourceIds: string[];
    defaultTenantIncluded: boolean;
    crossTenantSourcesExcluded: boolean;
  }>;
  queryClassReadiness: Array<{
    tenantId: string;
    queryClass: SourceCoverageCloseoutQueryClass;
    activeSafePublicSources: number;
    stagedSourceIds: string[];
    heldSourceIds: string[];
    restrictedMetadataSourceIds: string[];
    readiness: "ready" | "needs_approval" | "needs_expansion" | "held";
  }>;
  guardrails: {
    dryRunOnly: true;
    noSilentActivation: true;
    noCrawlingFromApprovalPackets: true;
    noRestrictedAutoActivation: true;
    noRawUnsafeUrls: true;
    forbiddenSourceClasses: string[];
  };
  handoffs: {
    agent02SchedulerBudgets: string[];
    agent03AdapterCertification: string[];
    agent04PublicExpansion: string[];
    agent05RestrictedPolicyHolds: string[];
    agent06EvidenceRetention: string[];
    agent07QualityGates: string[];
    agent09ApiContracts: string[];
    agent10CapacityReleaseGates: string[];
  };
}

export interface SourcePortfolioApiResponse {
  endpoint: "/v1/sources/portfolio";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  tenantId?: string;
  generatedAt: string;
  portfolio: SourcePortfolioQuerySummary;
  queries: SourcePortfolioQuerySummary[];
  reliabilityEconomics: SourceReliabilityEconomicsPacket;
  migrationReadiness: SourcePortfolioMigrationReadiness;
  sloBurnRate: SourceSloBurnRatePacket;
  tenantActivation: SourceTenantActivationPacket;
  sourceImportCanary: SourceImportCanaryPacket;
  onboardingPlans: SourcePackOnboardingPlan[];
  burnDown: SourceCoverageBurnDownReport[];
  promotionPacket: {
    field: "sourcePortfolioId";
    value: string;
    gate: "source_portfolio_ready";
    ready: boolean;
  };
}

export type SourceImportCanaryFixtureClass =
  | "actor_intelligence"
  | "ransomware_leak_metadata"
  | "vulnerability_advisory"
  | "malware_report"
  | "public_cert_feed"
  | "vendor_blog"
  | "public_channel_descriptor";

export type SourceImportCanaryResultDimension =
  | "tenant"
  | "query_class"
  | "source_family"
  | "source_policy"
  | "adapter_certification"
  | "scheduler_impact"
  | "evidence_store_impact"
  | "quality_gate_impact"
  | "graph_stix_impact"
  | "api_public_answer_effect";

export interface SourceImportCanaryRolloutSource {
  sourceId: string;
  sourceName: string;
  sourceHash: string;
  sourceFamily: SourceActivationWaveCategory;
  sourceType: SourceType;
  canaryOrder?: number;
  rolloutOrder: number;
  approvalScope: SourceCatalogMetadata["approvalScope"];
  parserCertified: boolean;
  policy: "safe_public" | "metadata_only_hold" | "blocked_unsafe";
  schedulerImpact: {
    budgetClass: SourceCollectionSla["budgetClass"];
    estimatedDailyTasks: number;
  };
  expectedEvidenceYield: number;
  rollbackPlanId: string;
}

export interface SourceImportCanaryActivationResult {
  dimension: SourceImportCanaryResultDimension;
  key: string;
  decision: "pass" | "hold" | "watch";
  sourceIds: string[];
  summary: string;
  nextAction: "approve_canary" | "request_parser_certification" | "hold_restricted_metadata" | "retire_duplicate" | "watch_slo" | "rollback_ready";
}

export interface SourceImportCanaryFixture {
  fixtureClass: SourceImportCanaryFixtureClass;
  queryClass: SourceCoverageCloseoutQueryClass;
  sourceIds: string[];
  coverageReady: boolean;
  metadataOnly: boolean;
  notes: string[];
}

export interface SourceImportCanaryPacket {
  schemaVersion: "ti.source_import_canary.v1";
  dryRun: true;
  willMutate: false;
  willImportSourcePacks: false;
  willStartCrawling: false;
  generatedAt: string;
  tenantId?: string;
  sourcePackIds: string[];
  summary: {
    first10Count: 10;
    first50Count: 50;
    activationResultCount: number;
    restrictedMetadataHoldCount: number;
    parserCertificationHoldCount: number;
    duplicateSuppressionCount: number;
    staleRetirementCandidateCount: number;
    rollbackPlanCount: number;
    releaseDecision: "promote_canary_then_expand" | "hold";
  };
  first10SourceRollout: SourceImportCanaryRolloutSource[];
  first50SourceRollout: SourceImportCanaryRolloutSource[];
  activationResults: SourceImportCanaryActivationResult[];
  fixtures: SourceImportCanaryFixture[];
  lifecycle: {
    retirements: SourceActivationExecutionReadiness["sourceRetirement"];
    duplicateSuppression: SourceActivationExecutionReadiness["duplicateSuppression"];
    staleSourceDetection: {
      dryRun: true;
      willMutate: false;
      sourceIds: string[];
      reason: string;
    };
    parserCertificationDependencies: SourceActivationExecutionReadiness["parserGapHandoff"];
    restrictedMetadataHoldPropagation: {
      dryRun: true;
      willMutate: false;
      sourceIds: string[];
      routeHint: "/v1/analyst/source-activation-packets";
      reason: string;
    };
  };
  rollbackPlans: Array<{
    rollbackPlanId: string;
    sourceIds: string[];
    trigger: string;
    action: string;
    owner: "agent_01" | "agent_02" | "agent_03" | "agent_06" | "agent_07" | "agent_09" | "agent_10";
  }>;
  guardrails: {
    approvalMode: "dry_run_packet_then_explicit_operator_approval";
    noSilentActivation: true;
    noSourcePackImport: true;
    noCrawlingFromCanary: true;
    noUnsafeRawUrls: true;
    restrictedMetadataOnly: true;
    forbiddenSourceClasses: string[];
  };
  handoffs: {
    agent02SchedulerImpact: string[];
    agent03ParserCertification: string[];
    agent04SourcePackCoverage: string[];
    agent05RestrictedMetadataPolicy: string[];
    agent06EvidenceStoreImpact: string[];
    agent07QualityGates: string[];
    agent08GraphStixImpact: string[];
    agent09ApiContracts: string[];
    agent10ReleaseRollback: string[];
  };
}

export type TiSourceAtlasFamily =
  | "vendor_threat_blog"
  | "cert_government"
  | "cve_advisory"
  | "malware_researcher"
  | "ransomware_tracker"
  | "exploit_intelligence"
  | "github_security_advisory"
  | "package_advisory"
  | "public_dataset"
  | "regional_cyber_agency"
  | "ics_ot"
  | "cloud_saas_security"
  | "phishing_brand_abuse"
  | "public_channel_descriptor";

export type TiSourceAtlasDiscoveryMethod =
  | "curated_list"
  | "public_report"
  | "github_repository"
  | "awesome_list"
  | "opml_rss"
  | "vendor_page"
  | "analyst_import"
  | "existing_source_pack";

export interface TiSourceAtlasRecord {
  id: string;
  url: string;
  domain: string;
  feedUrl?: string;
  sourceName: string;
  family: TiSourceAtlasFamily;
  discoveryMethod: TiSourceAtlasDiscoveryMethod;
  queryClassCoverage: SourceCoverageCloseoutQueryClass[];
  language: string;
  region: string[];
  sector: string[];
  reliability: number;
  freshness: number;
  evidenceYield: number;
  uniqueness: number;
  downstreamPublicAnswerImpact: number;
  sourceValueScore: number;
  parserCapability: {
    profile: SourceMarketplaceParserProfile;
    owner: "agent_03";
    certified: boolean;
    certificationRequired: boolean;
  };
  legalRobotsState: {
    legalReview: "current" | "missing" | "stale";
    robotsReview: "current" | "missing" | "stale" | "not_required";
    notes: string[];
  };
  duplicate: {
    duplicateOf?: string;
    mirrorOf?: string;
    contentSimilarity: number;
    suppressed: boolean;
  };
  schedulerEstimate: {
    budgetClass: SourceCollectionSla["budgetClass"];
    cadenceSeconds: number;
    estimatedDailyTasks: number;
  };
  evidenceEstimate: {
    expectedItemsPerDay: number;
    storageMbPerDay: number;
    retentionClass: SourceCatalogMetadata["retentionClass"];
  };
  activationReadiness: {
    state: "ready_for_dry_run" | "needs_parser_certification" | "legal_review_hold" | "duplicate_suppressed" | "descriptor_only_hold";
    approvalRequired: true;
    autoActivationAllowed: false;
    reasons: string[];
  };
  safety: {
    publicOnly: true;
    privateInviteAuthCaptcha: false;
    rawPayloadTarget: false;
    autoActivate: false;
  };
}

export interface TiSourceAtlasImportPlan {
  planId: string;
  label: "first_100" | "first_1000" | "future_10k";
  dryRun: true;
  willMutate: false;
  willImportSourcePacks: false;
  willStartCrawling: false;
  sourceCount: number;
  sourceIds: string[];
  familyCoverage: Array<{ family: TiSourceAtlasFamily; sourceCount: number }>;
  schedulerEstimate: {
    estimatedDailyTasks: number;
    budgetClasses: SourceCollectionSla["budgetClass"][];
  };
  evidenceEstimate: {
    expectedItemsPerDay: number;
    storageMbPerDay: number;
  };
  approvalPacket: {
    routeHint: "/v1/analyst/source-activation-packets";
    approvalRequired: true;
    allowedActions: Array<"approve_canary" | "request_parser_certification" | "mark_duplicate" | "hold_descriptor" | "rollback_batch">;
    forbiddenActions: Array<"auto_activate" | "start_crawl" | "import_without_review" | "add_private_source" | "bypass_captcha_or_auth">;
  };
  rollbackPacket: {
    rollbackPlanId: string;
    trigger: string;
    action: string;
  };
}

export interface TiSourceAtlasCoverageMatrixRow {
  queryClass: string;
  requiredFamilies: TiSourceAtlasFamily[];
  coveredFamilies: TiSourceAtlasFamily[];
  candidateSourceCount: number;
  highValueSourceIds: string[];
  gapFamilies: TiSourceAtlasFamily[];
  downstreamPublicAnswerImpact: number;
}

export interface TiSourceAtlasRegistryActivationHandoff {
  routeHint: "/v1/analyst/source-activation-packets";
  dryRun: true;
  willMutate: false;
  willImportSourcePacks: false;
  willStartCrawling: false;
  approvalRequired: true;
  sourceRegistryMutationAllowed: false;
  candidateCount: number;
  canarySourceIds: string[];
  parserCertificationRequiredSourceIds: string[];
  descriptorOnlyHeldSourceIds: string[];
  proposedSourceRecords: Array<{
    atlasSourceId: string;
    proposedSourceId: string;
    name: string;
    type: SourceType;
    accessMethod: AccessMethod;
    risk: Exclude<SourceRisk, "restricted">;
    url: string;
    domain: string;
    crawlFrequencySeconds: number;
    statusPreview: "candidate";
    metadata: {
      atlasFamily: TiSourceAtlasFamily;
      sourceValueScore: number;
      queryClassCoverage: SourceCoverageCloseoutQueryClass[];
      sourceHash: string;
      provenance: "ti_source_atlas";
    };
    governance: {
      legalReview: TiSourceAtlasRecord["legalRobotsState"]["legalReview"];
      robotsReview: TiSourceAtlasRecord["legalRobotsState"]["robotsReview"];
      approvalRequired: true;
      autoActivationAllowed: false;
    };
  }>;
  schedulerPreview: {
    owner: "agent_02";
    queuePartition: "source_atlas_canary";
    maxConcurrentCanaries: number;
    initialCadenceSeconds: number;
    estimatedDailyTasks: number;
    leaseMode: "dry_run_preview_only";
  };
  prerequisites: string[];
  forbiddenOperations: Array<
    | "registry_mutation"
    | "source_pack_import"
    | "crawl_enqueue"
    | "source_auto_activation"
    | "restricted_fetch"
    | "auth_or_captcha_bypass"
    | "payload_download"
  >;
  rollbackPacket: {
    rollbackPlanIds: string[];
    action: string;
  };
  downstreamHandoffs: {
    agent01RegistryReview: string[];
    agent02SchedulerDryRun: string[];
    agent03ParserCertification: string[];
    agent06EvidenceReadiness: string[];
    agent07QualityGate: string[];
    agent09ApiContract: string[];
    agent10ReleaseGate: string[];
  };
}

export interface TiSourceAtlasPublicMonitorSourceGapHandoff {
  schemaVersion: "ti.source_atlas.public_monitor_gap_handoff.v1";
  routeHint: "/v1/sources/atlas";
  consumer: "apify_public_threat_actor_monitor";
  dryRun: true;
  willMutate: false;
  willImportSourcePacks: false;
  willStartCrawling: false;
  generatedAt: string;
  queryRows: Array<{
    query: string;
    queryClass: SourceCoverageCloseoutQueryClass;
    publicMonitorState: "coverage_gap" | "partial" | "ready";
    missingFamilies: TiSourceAtlasFamily[];
    recommendedAtlasSourceIds: string[];
    freshnessCanarySourceIds: string[];
    expectedFreshRowsPerDay: number;
    expectedUsefulRowsPerDay: number;
    candidateSourceCount: number;
    expectedPublicMonitorEffect: "more_recent_activity" | "more_source_diversity" | "victim_claim_context" | "cve_advisory_context" | "no_effect_until_review";
    schedulerDryRun: {
      priority: "low" | "normal" | "high" | "urgent";
      cadenceSeconds: number;
      estimatedDailyTasks: number;
      duplicateRunReuse: true;
    };
    analystAction: "review_source_candidates" | "request_parser_certification" | "approve_canary_packet" | "hold_descriptor_only";
    noLeakBoundary: {
      metadataOnly: true;
      rawContentIncluded: false;
      unsafeUrlsIncluded: false;
      sourceActivationApplied: false;
    };
  }>;
  summary: {
    queryCount: number;
    coverageGapCount: number;
    partialCount: number;
    readyCount: number;
    recommendedCandidateCount: number;
    freshnessCanarySourceCount: number;
    expectedFreshRowsPerDay: number;
    expectedUsefulRowsPerDay: number;
    descriptorOnlyHoldCount: number;
    parserCertificationHoldCount: number;
  };
  guardrails: {
    noSourceActivation: true;
    noCrawling: true;
    noRawContent: true;
    noPrivateInviteAuthCaptcha: true;
    noThreatActorInteraction: true;
  };
  handoffs: {
    agent01SourceReview: string[];
    agent02SchedulerDryRun: string[];
    agent03ParserCertification: string[];
    agent04CoverageValue: string[];
    agent09PublicMonitorApi: string[];
    agent10ProductSlo: string[];
  };
}

export interface TiSourceAtlasLifecycleReviewPacket {
  schemaVersion: "ti.source_atlas.lifecycle_review.v1";
  routeHint: "/v1/sources/atlas";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  generatedAt: string;
  rows: Array<{
    reviewId: string;
    atlasSourceId: string;
    sourceHash: string;
    family: TiSourceAtlasFamily;
    queryClassCoverage: SourceCoverageCloseoutQueryClass[];
    currentReadiness: TiSourceAtlasRecord["activationReadiness"]["state"];
    lifecycleState: "healthy_candidate" | "degrade_review" | "quarantine_review" | "retirement_review" | "legal_review" | "parser_repair" | "descriptor_hold";
    reasonCodes: Array<"duplicate" | "stale_freshness" | "low_evidence_yield" | "low_value_score" | "parser_gap" | "legal_or_robots_review" | "descriptor_only" | "unsafe_class_hold">;
    recommendedAction: "keep_candidate" | "degrade" | "quarantine" | "retire_duplicate" | "request_parser_repair" | "request_legal_review" | "hold_descriptor_only";
    replacementCandidateSourceIds: string[];
    schedulerDryRun: {
      action: "no_change" | "reduce_cadence" | "pause_candidate" | "replace_candidate";
      estimatedDailyTaskDelta: number;
      willLeaseWork: false;
    };
    rollback: {
      rollbackPlanId: string;
      action: string;
    };
    noMutationBoundary: {
      sourceStatusChanged: false;
      registryWritePlanned: false;
      crawlEnqueued: false;
      sourceDeleted: false;
    };
  }>;
  summary: {
    reviewedSourceCount: number;
    healthyCandidateCount: number;
    degradeReviewCount: number;
    quarantineReviewCount: number;
    retirementReviewCount: number;
    parserRepairCount: number;
    legalReviewCount: number;
    descriptorHoldCount: number;
  };
  guardrails: {
    noRegistryMutation: true;
    noSourceDeletion: true;
    noCrawling: true;
    noSilentRetirement: true;
    noSilentQuarantine: true;
    publicOnly: true;
  };
  handoffs: {
    agent01LifecycleReview: string[];
    agent02SchedulerCadence: string[];
    agent03ParserRepair: string[];
    agent06EvidenceReplay: string[];
    agent09ApiUi: string[];
    agent10SloRelease: string[];
  };
}

export interface TiSourceAtlasReliabilityEconomicsPacket {
  schemaVersion: "ti.source_atlas.reliability_economics.v1";
  routeHint: "/v1/sources/atlas";
  dryRun: true;
  willMutate: false;
  willImportSourcePacks: false;
  willStartCrawling: false;
  generatedAt: string;
  rolloutScenarios: Array<{
    label: "first_50" | "first_500" | "first_5000";
    sourceCount: number;
    selectedSourceIds: string[];
    expectedActorsCovered: number;
    expectedQueryClasses: SourceCoverageCloseoutQueryClass[];
    expectedLanguageCoverage: string[];
    expectedRegionCoverage: string[];
    expectedUniqueEvidenceItemsPerDay: number;
    duplicateRisk: "low" | "medium" | "high";
    parserRepairDependencyCount: number;
    legalReviewDependencyCount: number;
    descriptorOnlyHoldCount: number;
    estimatedStorageMbPerDay: number;
    estimatedDailySchedulerTasks: number;
    estimatedCostUnitsPerUsefulEvidence: number;
    expectedApiActorUsefulness: number;
    expectedPublicTiAnswerLift: number;
    rollbackState: "ready" | "watch" | "hold";
    noActivationBoundary: {
      sourceActivationApplied: false;
      registryMutationPlanned: false;
      crawlEnqueued: false;
      workerLeaseCreated: false;
    };
  }>;
  sourceRows: Array<{
    atlasSourceId: string;
    sourceHash: string;
    family: TiSourceAtlasFamily;
    queryClassCoverage: SourceCoverageCloseoutQueryClass[];
    expectedActorsCovered: number;
    expectedQueryClasses: SourceCoverageCloseoutQueryClass[];
    uniqueEvidenceYield: number;
    duplicateRisk: number;
    parserRepairDependency: boolean;
    legalReviewDependency: boolean;
    language: string;
    regions: string[];
    estimatedStorageMbPerDay: number;
    estimatedDailySchedulerTasks: number;
    expectedApiActorUsefulness: number;
    expectedPublicTiAnswerLift: number;
    economicsScore: number;
    decision: "promote_candidate" | "watch" | "degrade" | "hold_parser" | "hold_legal" | "hold_descriptor" | "retire_duplicate";
    rollbackState: "ready" | "watch" | "hold";
  }>;
  familyMetrics: Array<{
    family: TiSourceAtlasFamily;
    sourceCount: number;
    averageEconomicsScore: number;
    expectedUniqueEvidenceItemsPerDay: number;
    duplicateRisk: number;
    parserRepairDependencyCount: number;
    legalReviewDependencyCount: number;
    estimatedStorageMbPerDay: number;
    estimatedDailySchedulerTasks: number;
    topSourceIds: string[];
  }>;
  marketplaceValueBreakdown: {
    actorProfileValue: number;
    ransomwareVictimClaimValue: number;
    cveAdvisoryValue: number;
    publicChannelValue: number;
    darkMetadataCorroborationValue: number;
    enterpriseStixExportValue: number;
  };
  sourcePackCandidates: {
    schemaVersion: "ti.source_atlas.source_pack_candidates.v1";
    routeHint: "/v1/sources/atlas";
    dryRun: true;
    willMutate: false;
    willImportSourcePacks: false;
    willStartCrawling: false;
    baseline: {
      evaluatedCandidateCount: number;
      currentPayworthySourceCount: number;
      targetPayworthySourceCount: number;
      additionalPayworthySourcesNeeded: number;
      targetPayworthyRate: 0.72;
    };
    candidatePackCount: number;
    projectedPayworthyLift: number;
    projectedPayworthySourceCount: number;
    projectedPayworthyRate: number;
    paidActorGatePrioritization: {
      schemaVersion: "ti.source_atlas.source_pack_paid_actor_gate_prioritization.v1";
      gate: "daily_100_name_paid_actor_300_row_gate";
      projectedRowsAfterParserAdmission: number;
      nextSellableRowGate: number;
      remainingSellableRowsAfterParserAdmission: number;
      projectedSourcePackRowsCountNow: false;
      countsTowardPaidGateNow: false;
      reviewRows: Array<{
        packId: string;
        packRank: number;
        priority: "p0" | "p1" | "p2";
        family: TiSourceAtlasFamily;
        acquisitionMode: "public_source_pack" | "parser_repair_pack" | "legal_review_pack" | "replacement_pack";
        expectedPayworthyLift: number;
        expectedFreshRowsPerDay: number;
        expectedUsefulEvidenceItemsPerDay: number;
        expectedSourceFamilyDiversityLift: number;
        actorGateReason: string;
        requiredProof: Array<"operator_approval" | "legal_review_current" | "parser_certified" | "dedupe_pass" | "daily_actor_run_delta" | "no_leak_review">;
        ownerHandoff: "agent01_source_pack_review" | "agent03_parser_certification" | "agent07_quality_gate" | "agent09_marketplace_proof" | "agent10_paid_gate_measurement";
        countsTowardPaidGateNow: false;
        noActivationBoundary: {
          sourcePackImported: false;
          sourceActivationApplied: false;
          registryMutationPlanned: false;
          crawlEnqueued: false;
          rawUrlsExposed: false;
          rawPayloadsExposed: false;
        };
      }>;
    };
    packs: Array<{
      rank: number;
      packId: string;
      packLabel: string;
      family: TiSourceAtlasFamily;
      acquisitionMode: "public_source_pack" | "parser_repair_pack" | "legal_review_pack" | "replacement_pack";
      sourceIds: string[];
      safeSourceHashes: string[];
      expectedPayworthyLift: number;
      expectedFreshRowsPerDay: number;
      expectedUsefulEvidenceItemsPerDay: number;
      expectedSchedulerTasksPerDay: number;
      estimatedCostUnitsPerUsefulEvidence: number;
      buyerVisibleUseCase: string;
      requiredProof: Array<"operator_approval" | "legal_review_current" | "parser_certified" | "dedupe_pass" | "daily_actor_run_delta" | "no_leak_review">;
      ownerHandoffs: {
        agent01SourceRegistry: string;
        agent03Parser: string;
        agent07Quality: string;
        agent09Marketplace: string;
        agent10Slo: string;
      };
      noActivationBoundary: {
        sourcePackImported: false;
        sourceActivationApplied: false;
        registryMutationPlanned: false;
        crawlEnqueued: false;
        rawUrlsExposed: false;
        rawPayloadsExposed: false;
      };
    }>;
    guardrails: {
      noRegistryMutation: true;
      noSourcePackImport: true;
      noSourceActivation: true;
      noCrawling: true;
      noRawUnsafeUrls: true;
      noPayloadDownloads: true;
      publicOrMetadataOnly: true;
    };
    handoffs: {
      agent01SourcePackReview: string[];
      agent03ParserCertification: string[];
      agent07QualityGate: string[];
      agent09MarketplaceProof: string[];
      agent10RevenueMeasurement: string[];
    };
  };
  degradationQueues: Array<{
    queue: "stale" | "noisy_duplicate" | "legal_blocked" | "parser_broken" | "low_yield" | "high_cost";
    sourceIds: string[];
    owner: "agent01_source_governance" | "agent02_scheduler" | "agent03_parser" | "agent06_evidence" | "agent07_quality" | "agent10_slo";
    recommendedDryRunAction: "degrade_cadence" | "quarantine_candidate" | "request_parser_repair" | "request_legal_review" | "retire_duplicate" | "cost_review";
    willMutate: false;
    willStartCrawling: false;
  }>;
  guardrails: {
    publicOnly: true;
    noRegistryMutation: true;
    noSourceActivation: true;
    noCrawling: true;
    noWorkerLeases: true;
    noPrivateInviteAuthCaptcha: true;
    noRawUnsafeUrls: true;
    noPayloadDownloads: true;
    descriptorOnlyPublicChannels: true;
  };
  handoffs: {
    agent01ActivationPlanning: string[];
    agent02SchedulerBudget: string[];
    agent03ParserRepair: string[];
    agent06EvidenceStorage: string[];
    agent07QualityGates: string[];
    agent09ApiFrontend: string[];
    agent10OpsBudgets: string[];
  };
}

export interface TiSourceAtlasProductSourceLadderPacket {
  schemaVersion: "ti.source_atlas.product_source_ladder.v1";
  routeHint: "/v1/sources/atlas";
  consumer: "apify_public_threat_actor_monitor";
  dryRun: true;
  willMutate: false;
  willImportSourcePacks: false;
  willStartCrawling: false;
  generatedAt: string;
  first100: {
    sourceCount: 100;
    rejectedCandidateCount: number;
    acceptedFamilyCount: number;
    acquisitionStatus: "ready_for_operator_review";
    usefulWithin1To3DaysCount: number;
    apifyRowProducingSourceCount: number;
    actorCoverage: Array<{
      actor: "APT29" | "APT28" | "Volt Typhoon" | "Sandworm" | "Lazarus" | "LockBit" | "Akira";
      sourceIds: string[];
      sourceFamilyCount: number;
      expectedFreshRowsPerDay: number;
      expectedActorRowImprovement: number;
      currentActorBlocker: "stale_rows" | "missing_evidence" | "thin_single_source_rows" | "metadata_only_hold";
    }>;
    rows: Array<{
      order: number;
      atlasSourceId: string;
      sourceName: string;
      family: TiSourceAtlasFamily;
      domain: string;
      safeLocatorHash: string;
      legalReview: TiSourceAtlasRecord["legalRobotsState"]["legalReview"];
      robotsReview: TiSourceAtlasRecord["legalRobotsState"]["robotsReview"];
      parserFamily: SourceMarketplaceParserProfile;
      actorsImproved: string[];
      queryClassesImproved: SourceCoverageCloseoutQueryClass[];
      expectedFreshness: "daily" | "three_day" | "weekly";
      expectedEntities: string[];
      dedupeGroup: string;
      rejectionReason?: "duplicate" | "legal_review" | "parser_gap" | "descriptor_only" | "low_buyer_value";
      buyerValue: string;
      buyerValueScore: number;
      canImproveApifyRowsWithin1To3Days: boolean;
      acquisitionPriority: "urgent" | "high" | "normal" | "hold";
      highestValueMissingFamilyForDefaultGroups: Array<{
        actor: "APT29" | "APT28" | "APT42" | "Volt Typhoon" | "Sandworm" | "Lazarus" | "Scattered Spider" | "FIN7" | "LockBit" | "Akira";
        missingFamily: TiSourceAtlasFamily;
        reason: string;
      }>;
      expectedActorRowsPerDay: number;
      expectedRansomwareRowsPerDay: number;
    }>;
  };
  candidate1000: {
    candidateCount: 1000;
    evaluatedCandidateCount: number;
    unevaluatedCandidateCount: number;
    acceptedCandidateCount: number;
    duplicateRejectedCount: number;
    legalRejectedCount: number;
    parserGapCount: number;
    descriptorOnlyHoldCount: number;
    lowBuyerValueRejectedCount: number;
    topCandidateSourceIds: string[];
    decisionCounts: {
      activateCanary: number;
      parserNeeded: number;
      reviewNeeded: number;
      duplicate: number;
      lowValue: number;
      reject: number;
    };
    rankedRows: Array<{
      rank: number;
      atlasSourceId: string;
      sourceName: string;
      domain: string;
      safeLocatorHash: string;
      family: TiSourceAtlasFamily;
      publicAccessMethod: "rss" | "static_html" | "public_api" | "public_report" | "public_dataset" | "public_channel_descriptor";
      legalReview: TiSourceAtlasRecord["legalRobotsState"]["legalReview"];
      robotsReview: TiSourceAtlasRecord["legalRobotsState"]["robotsReview"];
      parserFamily: SourceMarketplaceParserProfile;
      expectedActorCoverage: string[];
      expectedQueryCoverage: SourceCoverageCloseoutQueryClass[];
      expectedEntities: Array<"actor" | "alias" | "victim" | "cve" | "malware_tool" | "campaign" | "sector" | "country" | "reported_date">;
      freshnessExpectation: "daily" | "three_day" | "weekly";
      dedupeGroup: string;
      decision: "activate_canary" | "parser_needed" | "review_needed" | "duplicate" | "low_value" | "reject";
      rejectionReason?: "duplicate" | "legal_review" | "parser_gap" | "descriptor_only" | "low_buyer_value" | "low_freshness" | "low_evidence_yield" | "low_public_answer_impact";
      buyerValueScore: number;
      rowLiftEstimate: number;
      acquisitionPriority: "urgent" | "high" | "normal" | "hold";
      canImproveApifyRowsWithin1To3Days: boolean;
      buyerValue: string;
      ownerHandoff: "agent_01_source_review" | "agent_03_parser_repair" | "agent_04_source_acquisition" | "agent_07_paid_row_gate";
    }>;
    familyBreakdown: Array<{
      family: TiSourceAtlasFamily;
      candidateCount: number;
      acceptedCount: number;
      rejectedCount: number;
      expectedFreshRowsPerDay: number;
    }>;
    transitionSummary: Array<{
      actor: "APT29" | "APT28" | "Volt Typhoon" | "Sandworm" | "Lazarus" | "LockBit" | "Clop" | "Akira" | "Black Basta" | "Play" | "Scattered Spider";
      currentBlocker: "stale_rows" | "missing_evidence" | "thin_single_source_rows" | "metadata_only_hold" | "parser_gap" | "low_value_sources";
      highestValueMissingFamilies: TiSourceAtlasFamily[];
      topCandidateSourceIds: string[];
      expectedLift: "fresh_actor_activity" | "ransomware_victim_activity" | "advisory_corroboration" | "ttp_tooling_context" | "public_channel_corroboration";
      nextAction: "activate_canary" | "repair_parser" | "request_review" | "replace_low_value_sources";
    }>;
  };
  paidSourceTierPlan: {
    schemaVersion: "ti.source_atlas.paid_source_tier_plan.v1";
    thesisAlignment: string;
    monetizationAlignment: string;
    tiers: Array<{
      tier: 100 | 1000 | 4000 | 10000 | 20000 | 60000;
      state: "ready_for_review" | "needs_more_payworthy_sources" | "hold_until_evaluated";
      evaluatedCandidateCount: number;
      payworthySourceCount: number;
      payworthyRate: number;
      minimumPayworthyRate: number;
      minimumSourceValueScore: number;
      rejectedCandidateCount: number;
      topPayworthySourceIds: string[];
      measurableRevenueReason: string;
      requiredBeforeAdvance: string[];
    }>;
    currentPass: {
      evaluatedTier: 100 | 1000 | 4000 | 10000 | 20000 | 60000;
      readyTierCount: number;
      heldTierCount: number;
      payworthySourceCount: number;
      monetizationValueDelta: string;
    };
    gapClosure: {
      schemaVersion: "ti.source_atlas.paid_source_gap_closure.v1";
      evaluatedCandidateCount: number;
      payworthySourceCount: number;
      targetPayworthySourceCount: number;
      additionalPayworthySourcesNeeded: number;
      rejectedCandidateCount: number;
      repairableCandidateCount: number;
      replacementRequiredCount: number;
      projectedPayworthyRateAfterRepair: number;
      failureBreakdown: Array<{
        reason:
          | "low_source_value"
          | "low_freshness"
          | "low_evidence_yield"
          | "low_public_answer_impact"
          | "parser_not_certified"
          | "legal_review_not_current"
          | "duplicate_suppressed"
          | "not_ready_for_dry_run";
        candidateCount: number;
        owner: "agent_01" | "agent_03" | "agent_04" | "agent_07";
        revenueAction: string;
      }>;
      topRepairableCandidateIds: string[];
      topReplacementCandidateIds: string[];
      nextMeasuredPass: string;
    };
    payworthyRepairQueue: {
      schemaVersion: "ti.source_atlas.payworthy_repair_queue.v1";
      routeHint: "/v1/sources/atlas";
      dryRun: true;
      willMutate: false;
      willStartCrawling: false;
      evaluatedCandidateCount: number;
      currentPayworthySourceCount: number;
      targetPayworthySourceCount: number;
      additionalPayworthySourcesNeeded: number;
      queues: {
        duplicateSuppressed: TiSourceAtlasProductSourceLadderPacket["paidSourceTierPlan"]["payworthyRepairQueue"]["queue"];
        legalReviewNotCurrent: TiSourceAtlasProductSourceLadderPacket["paidSourceTierPlan"]["payworthyRepairQueue"]["queue"];
        notReadyForDryRun: TiSourceAtlasProductSourceLadderPacket["paidSourceTierPlan"]["payworthyRepairQueue"]["queue"];
      };
      queue: {
        blocker: "duplicate_suppressed" | "legal_review_not_current" | "not_ready_for_dry_run";
        candidateCount: number;
        sampledRowCount: number;
        repairableCount: number;
        replaceCount: number;
        expectedPayworthyLiftIfCleared: number;
        rows: Array<{
          rank: number;
          atlasSourceId: string;
          sourceName: string;
          family: TiSourceAtlasFamily;
          domain: string;
          safeSourceHash: string;
          blocker: "duplicate_suppressed" | "legal_review_not_current" | "not_ready_for_dry_run";
          currentState: TiSourceAtlasRecord["activationReadiness"]["state"];
          repairDecision: "repair" | "replace" | "retire_duplicate";
          repairability: "plausible_public_review" | "operator_legal_required" | "replace_with_better_source";
          exactUnblockAction: string;
          whyBuyerWouldCare: string;
          expectedRowLift: number;
          expectedFreshRowsPerDay: number;
          replacementCandidateIds: string[];
          legalRobotsEvidence: {
            legalReview: TiSourceAtlasRecord["legalRobotsState"]["legalReview"];
            robotsReview: TiSourceAtlasRecord["legalRobotsState"]["robotsReview"];
            notes: string;
            canClearWithoutPrivateAuthCaptcha: boolean;
          };
          noLeakBoundary: {
            rawUrlExposed: false;
            rawPayloadExposed: false;
            privateAuthCaptchaRequired: false;
            crawlStarted: false;
          };
        }>;
      };
      replacementCandidateIds: string[];
      aggregateProjectedPayworthyLift: number;
      projectedPayworthySourceCount: number;
      projectedPayworthyRate: number;
      nonMutatingApplyPlan: {
        routeHint: "/v1/analyst/source-activation-packets";
        allowedActions: Array<"refresh_legal_review" | "retire_duplicate" | "request_readiness_review" | "replace_candidate">;
        forbiddenActions: Array<"auto_activate" | "start_crawl" | "import_without_review" | "download_payload" | "bypass_auth_or_captcha" | "contact_actor">;
        agent01Inputs: string[];
        agent02Inputs: string[];
        agent03Inputs: string[];
        agent07Inputs: string[];
        agent10Inputs: string[];
      };
      sourceActivationPacketInputs: {
        schemaVersion: "ti.source_atlas.payworthy_repair_activation_packet_inputs.v1";
        routeHint: "/v1/analyst/source-activation-packets";
        dryRun: true;
        willMutate: false;
        willStartCrawling: false;
        packetCount: number;
        totalSourceCount: number;
        expectedPayworthyLift: number;
        expectedFreshRowsPerDay: number;
        packets: Array<{
          packetId: string;
          priority: "p0_revenue_blocker" | "p1_payworthy_lift" | "p2_review_batch";
          approvalMode: "operator_legal_required";
          action: "refresh_legal_review" | "retire_duplicate" | "request_readiness_review" | "replace_candidate";
          repairDecision: "repair" | "replace" | "retire_duplicate";
          blocker: "duplicate_suppressed" | "legal_review_not_current" | "not_ready_for_dry_run";
          atlasSourceIds: string[];
          replacementCandidateIds: string[];
          sourceFamilies: TiSourceAtlasFamily[];
          expectedPayworthyLift: number;
          expectedFreshRowsPerDay: number;
          expectedRowLift: number;
          buyerVisibleReason: string;
          prerequisites: Array<"operator_approval" | "legal_review_refresh" | "robots_review_refresh" | "parser_certification" | "duplicate_retirement" | "replacement_review" | "canary_packet_after_approval">;
          routeHints: string[];
          forbiddenActions: Array<"auto_activate" | "start_crawl" | "import_without_review" | "download_payload" | "bypass_auth_or_captcha" | "contact_actor">;
          noLeakBoundary: {
            rawUrlExposed: false;
            rawPayloadExposed: false;
            privateAuthCaptchaRequired: false;
            crawlStarted: false;
            sourceActivationApplied: false;
          };
        }>;
        ownerHandoffs: {
          agent01SourceRegistry: string[];
          agent02Scheduler: string[];
          agent03Parser: string[];
          agent07Quality: string[];
          agent10Revenue: string[];
        };
      };
    };
    highValueReplacementBatch: {
      schemaVersion: "ti.source_atlas.high_value_replacement_batch.v1";
      routeHint: "/v1/sources/atlas";
      dryRun: true;
      willMutate: false;
      willStartCrawling: false;
      evaluatedCandidateCount: number;
      targetCandidateCount: number;
      currentPayworthySourceCount: number;
      targetPayworthySourceCount: number;
      additionalPayworthySourcesNeeded: number;
      replacementRows: Array<{
        rank: number;
        atlasSourceId: string;
        sourceName: string;
        domain: string;
        safeSourceHash: string;
        family: TiSourceAtlasFamily;
        replacementForBlocker: "low_source_value" | "low_freshness" | "low_evidence_yield" | "low_public_answer_impact";
        publicAccessMethod: "public_http" | "official_api" | "public_rss" | "public_dataset" | "public_channel_descriptor";
        parserFamily: SourceMarketplaceParserProfile;
        parserReadiness: "certified" | "parser_repair_needed" | "descriptor_review_only";
        legalReview: TiSourceAtlasRecord["legalRobotsState"]["legalReview"];
        robotsReview: TiSourceAtlasRecord["legalRobotsState"]["robotsReview"];
        expectedFreshRowsPerDay: number;
        expectedEvidenceYield: number;
        expectedActorCoverage: string[];
        expectedRansomwareCoverage: string[];
        expectedEntities: Array<"actor" | "victim" | "sector" | "country" | "ttp" | "malware_tool" | "cve" | "infrastructure" | "source_family">;
        buyerVisibleRowEffect: "fresh_actor_activity" | "ransomware_victim_activity" | "advisory_corroboration" | "ttp_tooling_context" | "source_family_diversity";
        activationPriority: "urgent" | "high" | "normal" | "hold";
        canImprovePaidRowsWithin1To3Days: boolean;
        noLeakBoundary: {
          rawUrlExposed: false;
          rawPayloadExposed: false;
          privateAuthCaptchaRequired: false;
          crawlStarted: false;
          actorInteractionRequired: false;
        };
      }>;
      familyPlans: Array<{
        family: TiSourceAtlasFamily;
        sampledReplacementCount: number;
        payworthyCandidateCount: number;
        replacementNeedCount: number;
        expectedFreshRowsPerDay: number;
        averageEvidenceYield: number;
        parserReadyCount: number;
        legalCurrentCount: number;
        buyerVisibleEffect: string;
      }>;
      actorPlans: Array<{
        actor: "APT29" | "APT28" | "APT42" | "Volt Typhoon" | "Lazarus" | "Scattered Spider" | "FIN7" | "LockBit" | "Akira";
        currentBlockers: Array<"low_source_value" | "low_freshness" | "low_evidence_yield" | "low_public_answer_impact">;
        topReplacementSourceIds: string[];
        expectedFreshRowsPerDay: number;
        buyerVisibleEffect: string;
      }>;
      activationRunbook: {
        schemaVersion: "ti.source_atlas.high_value_replacement_activation_runbook.v1";
        dryRun: true;
        willMutate: false;
        willStartCrawling: false;
        batchSourceCount: number;
        day1CandidateCount: number;
        day3CandidateCount: number;
        heldCandidateCount: number;
        expectedFreshRowsPerDay: number;
        expectedActorRowsPerDay: number;
        expectedRansomwareRowsPerDay: number;
        expectedPayworthyLift: number;
        actionRows: Array<{
          sequence: number;
          actionId: string;
          phase: "day_1_canary" | "day_3_parser_or_legal_clearance" | "hold_for_replacement";
          atlasSourceIds: string[];
          sourceFamilies: TiSourceAtlasFamily[];
          actors: string[];
          blockersAddressed: Array<"low_source_value" | "low_freshness" | "low_evidence_yield" | "low_public_answer_impact">;
          expectedFreshRowsPerDay: number;
          expectedActorRowsPerDay: number;
          expectedRansomwareRowsPerDay: number;
          expectedPayworthyLift: number;
          publicAccessMethods: Array<"public_http" | "official_api" | "public_rss" | "public_dataset" | "public_channel_descriptor">;
          parserFamilies: SourceMarketplaceParserProfile[];
          parserWork: "none" | "certify_parser" | "descriptor_review";
          legalWork: "none" | "refresh_legal_review" | "robots_review";
          schedulerWork: "stage_canary_packet" | "hold_until_review";
          measurementWork: string;
          buyerVisibleRowEffect: string;
          noLeakBoundary: {
            rawUrlExposed: false;
            rawPayloadExposed: false;
            privateAuthCaptchaRequired: false;
            crawlStarted: false;
            actorInteractionRequired: false;
          };
        }>;
        ownerHandoffs: {
          agent01SourceRegistry: string[];
          agent02Scheduler: string[];
          agent03Parser: string[];
          agent07Quality: string[];
          agent09ApiApify: string[];
          agent10Revenue: string[];
        };
      };
      freshnessPriorityQueue: {
        schemaVersion: "ti.source_atlas.high_value_freshness_priority_queue.v1";
        dryRun: true;
        willMutate: false;
        willStartCrawling: false;
        queueSourceCount: number;
        p0SourceCount: number;
        p1SourceCount: number;
        heldSourceCount: number;
        expectedFreshRowsPerDay: number;
        expectedUsefulRowsPerDay: number;
        expectedPayworthyLift: number;
        rows: Array<{
          rank: number;
          priority: "p0_fresh_paid_row_lift" | "p1_actor_or_ransomware_gap" | "p2_hold_until_review";
          atlasSourceId: string;
          sourceName: string;
          sourceFamily: TiSourceAtlasFamily;
          safeSourceHash: string;
          actors: string[];
          ransomwareGroups: string[];
          blockerAddressed: "low_source_value" | "low_freshness" | "low_evidence_yield" | "low_public_answer_impact";
          freshnessWindowHours: 6 | 24 | 72;
          expectedFreshRowsPerDay: number;
          expectedUsefulRowsPerDay: number;
          expectedPayworthyLift: number;
          sourceAction: "stage_day1_canary_packet" | "repair_parser_then_stage" | "refresh_legal_or_robots_review" | "hold_for_replacement";
          schedulerCadenceSeconds: number;
          measurementGate: string;
          noLeakBoundary: {
            rawUrlExposed: false;
            rawPayloadExposed: false;
            privateAuthCaptchaRequired: false;
            crawlStarted: false;
            actorInteractionRequired: false;
          };
        }>;
        actorRollup: Array<{
          actor: "APT29" | "APT28" | "APT42" | "Volt Typhoon" | "Lazarus" | "Scattered Spider" | "FIN7" | "LockBit" | "Akira";
          p0SourceIds: string[];
          expectedFreshRowsPerDay: number;
          primaryFreshnessGap: "stale_actor_rows" | "thin_source_family_diversity" | "ransomware_victim_gap" | "parser_or_review_hold";
          nextAction: string;
        }>;
        familyRollup: Array<{
          family: TiSourceAtlasFamily;
          sourceCount: number;
          p0SourceCount: number;
          expectedFreshRowsPerDay: number;
          expectedUsefulRowsPerDay: number;
          nextAction: string;
        }>;
      };
      dailyActorPresetCanaryPacket: {
        schemaVersion: "ti.source_atlas.daily_actor_preset_canary_packet.v1";
        routeHint: "/v1/sources/atlas";
        dryRun: true;
        willMutate: false;
        willStartCrawling: false;
        presetName: "daily_paid_actor_100";
        targetActorCount: 100;
        sampledActorCount: number;
        uncoveredActorSlots: number;
        canarySourceCount: number;
        p0SourceCount: number;
        expectedFreshRowsPerDay: number;
        expectedUsefulRowsPerDay: number;
        expectedActorCoverageCount: number;
        expectedRansomwareCoverageCount: number;
        sourceFamilyDiversityCount: number;
        sourceFamilyCoverage: Array<{
          family: TiSourceAtlasFamily;
          actorCount: number;
          sourceCount: number;
          expectedUsefulRowsPerDay: number;
        }>;
        rows: Array<{
          rank: number;
          actor: "APT29" | "APT28" | "APT42" | "Volt Typhoon" | "Lazarus" | "Scattered Spider" | "FIN7" | "LockBit" | "Akira";
          atlasSourceIds: string[];
          sourceFamilies: TiSourceAtlasFamily[];
          supportMode: "direct_actor_sources" | "default_watchlist_freshness_fallback";
          schedulerCadenceSeconds: number;
          expectedFreshRowsPerDay: number;
          expectedUsefulRowsPerDay: number;
          coverageReason: string;
          canaryAcceptance: {
            minFreshRowsPerDay: number;
            minUsefulRowsPerDay: number;
            maxCostPerUsefulRowUsd: number;
            requireSourceFamilyDiversity: boolean;
          };
          noLeakBoundary: {
            rawUrlExposed: false;
            rawPayloadExposed: false;
            privateAuthCaptchaRequired: false;
            crawlStarted: false;
            actorInteractionRequired: false;
            sourceActivationApplied: false;
          };
        }>;
        actorSpecificGapRows: Array<{
          actor: "APT29" | "APT28" | "APT42" | "Volt Typhoon" | "Lazarus" | "Scattered Spider" | "FIN7" | "LockBit" | "Akira";
          currentDirectSourceCount: number;
          fallbackSourceCount: number;
          requiredFamilies: TiSourceAtlasFamily[];
          acquisitionPriority: "p0_actor_specific_gap" | "p1_diversity_gap" | "p2_monitor";
          expectedFreshRowsPerDayNeeded: number;
          nextSourceCriteria: string;
          ownerHandoff: "agent_04_source_acquisition" | "agent_03_parser_repair";
        }>;
        sourceFamilyGapRows: Array<{
          family: TiSourceAtlasFamily;
          actorCount: number;
          actors: Array<"APT29" | "APT28" | "APT42" | "Volt Typhoon" | "Lazarus" | "Scattered Spider" | "FIN7" | "LockBit" | "Akira">;
          acquisitionPriority: "p0_actor_specific_gap" | "p1_diversity_gap";
          expectedFreshRowsPerDayNeeded: number;
          nextSourceCriteria: string;
          ownerHandoff: "agent_04_source_acquisition";
        }>;
        ownerHandoffs: {
          agent02Scheduler: string[];
          agent07Quality: string[];
          agent09Apify: string[];
          agent10Revenue: string[];
        };
      };
      aggregate: {
        sampledReplacementCount: number;
        projectedAdditionalPayworthySources: number;
        projectedPayworthySourceCount: number;
        projectedPayworthyRate: number;
        expectedFreshRowsPerDay: number;
        expectedRansomwareRowsPerDay: number;
        expectedActorRowsPerDay: number;
        nextMeasuredPass: string;
      };
    };
    graphRelationshipQuality: {
      schemaVersion: "ti.source_atlas.graph_relationship_tier_quality.v1";
      evaluatedCandidateCount: number;
      relationshipReadySourceCount: number;
      relationshipReadyRate: number;
      minimumRelationshipReadyRate: number;
      decision: "ready_for_actor_proof" | "needs_more_relationship_ready_sources" | "hold_until_evaluated";
      metricRows: Array<{
        metric:
          | "actor_pivot_coverage"
          | "victim_ttp_pivot_coverage"
          | "source_family_diversity"
          | "freshness_corroboration"
          | "contradiction_hold_readiness"
          | "no_leak_provenance";
        score: number;
        passAt: number;
        state: "pass" | "warn" | "hold";
        relationshipEffect: string;
      }>;
      actorRows: Array<{
        actor: "APT29" | "APT28" | "APT42" | "Volt Typhoon" | "Sandworm" | "Lazarus" | "Scattered Spider" | "FIN7" | "LockBit" | "Akira";
        sourceIds: string[];
        sourceFamilyCount: number;
        expectedRelationshipPivots: Array<"actor" | "victim" | "sector" | "country" | "malware_tool" | "ttp" | "campaign" | "source_family">;
        expectedFreshRowsPerDay: number;
        relationshipReady: boolean;
        blocker: "insufficient_sources" | "single_source_family" | "low_freshness" | "parser_gap" | "legal_or_duplicate_hold" | "ready_for_actor_proof";
        nextAction: string;
      }>;
      topRelationshipReadySourceIds: string[];
      advancementCriteria: string[];
      noLeakBoundary: {
        rawUrlsExposed: false;
        rawPayloadsExposed: false;
        restrictedContentExposed: false;
        actorInteractionRequired: false;
      };
    };
  };
  activationReadinessPlan: {
    schemaVersion: "ti.source_atlas.activation_readiness_plan.v1";
    routeHint: "/v1/sources/atlas";
    dryRun: true;
    willMutate: false;
    willImportSourcePacks: false;
    willStartCrawling: false;
    generatedAt: string;
    first25: {
      sourceCount: 25;
      decisions: Array<TiSourceAtlasProductSourceLadderPacket["activationReadinessPlan"]["decisionRows"][number]>;
      aggregate: TiSourceAtlasProductSourceLadderPacket["activationReadinessPlan"]["aggregateImpact"];
    };
    first100: {
      sourceCount: 100;
      decisions: Array<TiSourceAtlasProductSourceLadderPacket["activationReadinessPlan"]["decisionRows"][number]>;
      aggregate: TiSourceAtlasProductSourceLadderPacket["activationReadinessPlan"]["aggregateImpact"];
    };
    decisionRows: Array<{
      order: number;
      atlasSourceId: string;
      proposedSourceId: string;
      sourceName: string;
      family: TiSourceAtlasFamily;
      domain: string;
      safeLocatorHash: string;
      decision: "approve" | "canary" | "hold" | "reject" | "retire_duplicate";
      decisionReason: string;
      sourceHealth: {
        status: "healthy" | "watch" | "blocked";
        lastObservedState: "observable" | "legal_review_needed" | "parser_needed" | "duplicate" | "low_yield";
        expectedFreshnessSloSeconds: number;
        healthCheckCadenceSeconds: number;
      };
      governance: {
        legalReview: TiSourceAtlasRecord["legalRobotsState"]["legalReview"];
        robotsReview: TiSourceAtlasRecord["legalRobotsState"]["robotsReview"];
        legalNotes: string;
        approvalRequired: true;
        autoActivationAllowed: false;
      };
      parser: {
        owner: "agent_03";
        parserFamily: SourceMarketplaceParserProfile;
        certificationRequired: boolean;
        expectedEntities: string[];
      };
      coverage: {
        actorsImproved: string[];
        queryClassesImproved: SourceCoverageCloseoutQueryClass[];
        duplicateGroup: string;
        canarySampleExpectation: string;
      };
      paidActorImpact: {
        whyThisImprovesPaidActor: string;
        expectedActorRowsPerDay: number;
        expectedRansomwareRowsPerDay: number;
        expectedUsefulRowsPerDay: number;
        expectedFreshRowsPerDay: number;
        estimatedGrossRevenueUsdPerDay: number;
        estimatedCostPerUsefulRowUsd: number;
      };
      applyPlan: {
        action: "stage_approval_packet" | "stage_canary" | "hold_for_review" | "reject_candidate" | "retire_duplicate";
        agent02SchedulerHandoff: string;
        agent07QualityGate: string;
        agent09ApiSurface: string;
        agent10Measurement: string;
        rollbackPlanId: string;
      };
    }>;
    aggregateImpact: {
      sourceCount: number;
      approveCount: number;
      canaryCount: number;
      holdCount: number;
      rejectCount: number;
      retireDuplicateCount: number;
      expectedActorRowsPerDay: number;
      expectedRansomwareRowsPerDay: number;
      expectedUsefulRowsPerDay: number;
      expectedFreshRowsPerDay: number;
      estimatedGrossRevenueUsdPerDay: number;
      estimatedCostPerUsefulRowUsd: number;
      payworthySourceCount: number;
      payworthyRate: number;
      expectedSourceFamilyDiversity: number;
      whyThisImprovesPaidActor: string;
    };
    nonMutatingApplyPlan: {
      planId: string;
      routeHint: "/v1/analyst/source-activation-packets";
      allowedActions: Array<"approve" | "canary" | "hold" | "reject" | "retire_duplicate">;
      forbiddenActions: Array<"auto_activate" | "start_crawl" | "import_without_review" | "download_payload" | "bypass_auth_or_captcha" | "contact_actor">;
      agent02SchedulerInputs: string[];
      agent03ParserInputs: string[];
      agent07QualityInputs: string[];
      agent09ApiInputs: string[];
      agent10MeasurementInputs: string[];
    };
  };
  parsedSourceExamples: Array<{
    exampleId: string;
    atlasSourceId: string;
    actorOrTopic: string;
    parserFamily: SourceMarketplaceParserProfile;
    extractedFields: Array<"actor" | "alias" | "victim" | "cve" | "malware_tool" | "campaign" | "sector" | "country" | "reported_date">;
    expectedDatasetRowType: "actor_activity" | "ransomware_victim_activity" | "cve_context" | "source_coverage_gap";
    safeSummary: string;
    noRawContent: true;
  }>;
  parserCoverageProof: {
    sourcePack: "first_100";
    parsedCount: number;
    failedCount: number;
    heldCount: number;
    publicReportSampleCount: number;
    publicAdvisorySampleCount: number;
    publicBlogSampleCount: number;
    noLeakBoundary: {
      collectedItemShape: true;
      rawContentIncluded: false;
      unsafeUrlsIncluded: false;
      sourceActivationApplied: false;
    };
  };
  parserImpactTable: Array<{
    atlasSourceId: string;
    sourceName: string;
    family: TiSourceAtlasFamily;
    actorCoverage: string[];
    parsedFields: Array<"actor" | "alias" | "victim" | "cve" | "malware_tool" | "campaign" | "sector" | "country" | "reported_date">;
    summaryQuality: "rich_extracted_facts" | "specific_but_partial" | "generic_source_reported" | "held_no_public_fact";
    failureMode: "none" | "parser_certification_required" | "legal_or_robots_hold" | "descriptor_only_hold" | "duplicate_suppressed" | "thin_summary";
    repairPriority: "p0_revenue_blocker" | "p1_default_watchlist_lift" | "p2_source_diversity" | "p3_watch";
    expectedRowLift: number;
    expectedPublicMonitorEffect: "apt28_evidence_recovery" | "apt29_freshness" | "ransomware_victim_activity" | "public_advisory_context" | "source_diversity";
    safeLocatorHash: string;
  }>;
  parserRepairPriorities: Array<{
    rank: number;
    repair: "apt28_evidence_recovery" | "apt29_freshness" | "public_advisory_blog_extraction" | "ransomware_victim_activity_extraction" | "specific_summary_extraction";
    affectedSourceIds: string[];
    expectedDefaultWatchlistRows: number;
    currentFailure: string;
    repairAction: string;
  }>;
  beforeAfterSampleRows: Array<{
    sampleId: string;
    atlasSourceId: string;
    before: Pick<CollectedItem, "sourceId" | "url" | "collectedAt" | "title" | "rawText" | "contentHash" | "links" | "metadata" | "sensitive">;
    after: Pick<CollectedItem, "sourceId" | "url" | "collectedAt" | "publishedAt" | "title" | "rawText" | "contentHash" | "language" | "links" | "metadata" | "sensitive">;
    extractedFields: Array<"actor" | "alias" | "victim" | "cve" | "malware_tool" | "campaign" | "sector" | "country" | "reported_date">;
  }>;
  parserRepairExecution: {
    schemaVersion: "ti.source_atlas.parser_repair_execution.v1";
    sourcePack: "first_100";
    generatedAt: string;
    baseline: {
      evaluatedCandidateCount: number;
      rejectedCandidateCount: number;
      payworthySourceCountBefore: number;
      targetPayworthySourceCount: number;
      targetPayworthyRate: 0.72;
    };
    repairedFixtureCount: number;
    movedRejectedToPayworthySourceCount: number;
    payworthySourceCountAfterFixtures: number;
    projectedPayworthyRateAfterFixtures: number;
    failureTaxonomy: Array<{
      code:
        | "generic_summary"
        | "missing_actor"
        | "missing_victim"
        | "missing_sector_country"
        | "missing_ttp_tool"
        | "missing_reported_time"
        | "missing_corroboration"
        | "parser_not_certified";
      owner: "agent_03" | "agent_07" | "agent_10";
      repairAction: string;
      qualityGate: string;
      measurement: string;
    }>;
    fixtures: Array<{
      fixtureId: string;
      atlasSourceId: string;
      sourceName: string;
      family: TiSourceAtlasFamily;
      safeLocatorHash: string;
      failureBefore: "generic_summary" | "missing_entities" | "missing_time" | "parser_not_certified" | "thin_ransomware_activity";
      repairApplied: "apt29_freshness" | "apt28_evidence_recovery" | "ransomware_victim_activity" | "public_advisory_context" | "specific_summary_extraction";
      beforePayworthy: boolean;
      afterPayworthy: boolean;
      before: Pick<CollectedItem, "sourceId" | "url" | "collectedAt" | "title" | "rawText" | "contentHash" | "links" | "metadata" | "sensitive">;
      after: Pick<CollectedItem, "sourceId" | "url" | "collectedAt" | "publishedAt" | "title" | "rawText" | "contentHash" | "language" | "links" | "metadata" | "sensitive">;
      extractedFacts: {
        actor: string;
        victim: string;
        sector: string;
        country: string;
        impact: string;
        ttp: string;
        malwareTool: string;
        firstReportedAt: string;
        lastReportedAt: string;
        publisher: string;
        corroboratingSourceIds: string[];
        summarySpecificFacts: string[];
      };
      ownership: {
        parserRepair: "agent_03";
        qualityGate: "agent_07";
        costUsefulRowLift: "agent_10";
      };
      safety: {
        normalizedTo: "CollectedItem";
        provenancePreserved: true;
        rawSourceBodyIncluded: false;
        unsafeUrlIncluded: false;
        privateAuthCaptchaMaterialIncluded: false;
      };
    }>;
    ownership: {
      agent03: string[];
      agent07: string[];
      agent10: string[];
    };
  };
  parserRepairBatch1000: {
    schemaVersion: "ti.source_atlas.parser_repair_batch_1000.v1";
    sourcePack: "first_1000";
    generatedAt: string;
    dryRun: true;
    willMutate: false;
    willStartCrawling: false;
    baseline: {
      candidateCount: 1000;
      evaluatedCandidateCount: number;
      parserFailureCandidateCount: number;
      repairableParserFailureCount: number;
      rejectedParserFailureCount: number;
      replacementRequiredCount: number;
      payworthySourceCountBefore: number;
      targetPayworthyRate: 0.72;
    };
    groupRows: Array<{
      groupId: string;
      family: TiSourceAtlasFamily;
      parserFamily: SourceMarketplaceParserProfile;
      candidateCount: number;
      parserFailureCount: number;
      repairableCount: number;
      rejectedCount: number;
      replacementRequiredCount: number;
      expectedPayworthyLift: number;
      sampleSourceIds: string[];
      requiredExtractedFields: Array<"actor" | "alias" | "victim" | "cve" | "malware_tool" | "campaign" | "sector" | "country" | "reported_date">;
      qualityGate: string;
    }>;
    fixtures: TiSourceAtlasProductSourceLadderPacket["parserRepairExecution"]["fixtures"];
    summary: {
      repairedFixtureCount: number;
      movedRejectedToPayworthySourceCount: number;
      repairableCount: number;
      rejectedCount: number;
      replacementRequiredCount: number;
      projectedPayworthySourceCount: number;
      projectedPayworthyRate: number;
    };
    agent07QualityLiftRows: Array<{
      fixtureId: string;
      atlasSourceId: string;
      requiredFacts: Array<"actor" | "victim" | "sector" | "country" | "ttp" | "malware_tool" | "reported_date" | "publisher" | "corroboration">;
      beforeGenericSummary: true;
      afterSpecificFactCount: number;
      agent07AcceptIf: string[];
      rejectIf: string[];
    }>;
    safety: {
      normalizedToCollectedItem: true;
      provenancePreserved: true;
      rawSourceBodiesIncluded: false;
      unsafeUrlsIncluded: false;
      sourceActivationApplied: false;
      crawlStarted: false;
    };
    handoffs: {
      agent03ParserRepair: string[];
      agent07QualityGate: string[];
      agent10ProductSlo: string[];
    };
  };
  expectedActorOutputImpact: {
    dailyDefaultGroupCount: 20;
    baselineRows: number;
    expectedRowsAfterFirst100: number;
    expectedUsefulRowsAfterFirst100: number;
    expectedFreshRowsAfterFirst100: number;
    expectedSingleSourceRowsAfterFirst100: number;
    specificImprovements: Array<{
      query: "APT29" | "APT28" | "Volt Typhoon" | "Sandworm" | "Lazarus" | "LockBit" | "Akira";
      currentProblem: string;
      expectedImprovement: string;
      sourceIds: string[];
    }>;
  };
  handoffs: {
    agent02SchedulerCadence: string[];
    agent03ParserCoverage: string[];
    agent04SourceAcquisition: string[];
    agent09ApifyDataset: string[];
    agent10ProductSlo: string[];
  };
  guardrails: {
    publicOnly: true;
    noRegistryMutation: true;
    noSourceActivation: true;
    noCrawling: true;
    noWorkerLeases: true;
    noPrivateInviteAuthCaptcha: true;
    noRawUnsafeUrls: true;
    noRawSourcePayloads: true;
    noPayloadDownloads: true;
  };
}

export interface TiSourceAtlasApiResponse {
  endpoint: "/v1/sources/atlas";
  schemaVersion: "ti.source_atlas.v1";
  dryRun: true;
  willMutate: false;
  willImportSourcePacks: false;
  willStartCrawling: false;
  tenantId?: string;
  generatedAt: string;
  summary: {
    recordCount: number;
    syntheticScaleCandidateCount: 10_000;
    first100Count: 100;
    first1000Count: 1000;
    readyForDryRun: number;
    parserCertificationHolds: number;
    duplicateSuppressed: number;
    descriptorOnlyHolds: number;
    averageSourceValueScore: number;
  };
  records: TiSourceAtlasRecord[];
  importPlans: TiSourceAtlasImportPlan[];
  coverageMatrix: TiSourceAtlasCoverageMatrixRow[];
  publicMonitorSourceGapHandoff: TiSourceAtlasPublicMonitorSourceGapHandoff;
  lifecycleReview: TiSourceAtlasLifecycleReviewPacket;
  sourceEconomics: TiSourceAtlasReliabilityEconomicsPacket;
  sourceLadder: TiSourceAtlasProductSourceLadderPacket;
  activationCanary: {
    dryRun: true;
    willMutate: false;
    willStartCrawling: false;
    first100SourceIds: string[];
    first1000SourceIds: string[];
    freshnessFirstSourceIds: string[];
    freshnessFirstExpectedFreshRowsPerDay: number;
    freshnessFirstExpectedUsefulRowsPerDay: number;
    freshnessFirstAcceptanceCriteria: string[];
    freshnessFirstRollbackTriggers: string[];
    parserCertificationRequiredSourceIds: string[];
    descriptorOnlySourceIds: string[];
    rollbackPlanIds: string[];
    registryActivationHandoff: TiSourceAtlasRegistryActivationHandoff;
  };
  discoveryInputs: Array<{
    method: TiSourceAtlasDiscoveryMethod;
    sourceCount: number;
    refreshCadence: "daily" | "weekly" | "monthly";
    owner: "agent_01";
  }>;
  exportImportSchema: {
    schemaVersion: "ti.source_atlas_export.v1";
    primaryKey: "id";
    requiredFields: Array<keyof Pick<TiSourceAtlasRecord, "id" | "url" | "domain" | "family" | "queryClassCoverage" | "sourceValueScore" | "activationReadiness">>;
    noUnsafeSourceClasses: string[];
  };
  guardrails: {
    publicOnly: true;
    noPrivateInviteAuthCaptcha: true;
    noSilentActivation: true;
    noSourcePackImport: true;
    noCrawlingFromAtlas: true;
    descriptorOnlyPublicChannels: true;
  };
  handoffs: {
    agent02SchedulerBudgets: string[];
    agent03ParserCertification: string[];
    agent04CoverageFreshness: string[];
    agent06EvidenceEstimates: string[];
    agent07QualityScorecards: string[];
    agent09ApiContracts: string[];
    agent10ReleaseGates: string[];
  };
}

export type TiSourceAtlasReviewDecision =
  | "stage_for_canary"
  | "request_parser_certification"
  | "hold_duplicate"
  | "hold_descriptor_only"
  | "legal_review_required";

export interface TiSourceAtlasExportManifestRow {
  atlasSourceId: string;
  sourceHash: string;
  sourceName: string;
  url: string;
  domain: string;
  family: TiSourceAtlasFamily;
  queryClassCoverage: SourceCoverageCloseoutQueryClass[];
  sourceValueScore: number;
  parserProfile: SourceMarketplaceParserProfile;
  schedulerCadenceSeconds: number;
  expectedItemsPerDay: number;
  legalReview: TiSourceAtlasRecord["legalRobotsState"]["legalReview"];
  robotsReview: TiSourceAtlasRecord["legalRobotsState"]["robotsReview"];
  approvalRequired: true;
  autoActivationAllowed: false;
}

export interface TiSourceAtlasReviewQueueRow {
  reviewId: string;
  atlasSourceId: string;
  sourceName: string;
  family: TiSourceAtlasFamily;
  domain: string;
  sourceHash: string;
  decision: TiSourceAtlasReviewDecision;
  reasons: string[];
  approvalRoute: "/v1/analyst/source-activation-packets";
  parserOwner: "agent_03";
  schedulerOwner: "agent_02";
  qualityOwner: "agent_07";
  releaseOwner: "agent_10";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
}

export interface TiSourceAtlasExportManifestApiResponse {
  endpoint: "/v1/sources/atlas/export";
  schemaVersion: "ti.source_atlas_export_manifest.v1";
  dryRun: true;
  willMutate: false;
  willImportSourcePacks: false;
  willStartCrawling: false;
  tenantId?: string;
  generatedAt: string;
  requestedPlan: TiSourceAtlasImportPlan["label"];
  summary: {
    plannedSourceCount: number;
    manifestRowCount: number;
    stagedForCanary: number;
    parserCertificationRequired: number;
    duplicateHolds: number;
    descriptorOnlyHolds: number;
    legalReviewRequired: number;
  };
  reviewQueue: TiSourceAtlasReviewQueueRow[];
  exportManifest: {
    schemaVersion: "ti.source_atlas_export.v1";
    format: "source_pack_import_dry_run_json";
    hashAlgorithm: "stable_sha256";
    primaryKey: "atlasSourceId";
    rows: TiSourceAtlasExportManifestRow[];
  };
  approvalPacket: {
    routeHint: "/v1/analyst/source-activation-packets";
    approvalRequired: true;
    allowedActions: Array<"approve_canary" | "request_parser_certification" | "mark_duplicate" | "hold_descriptor" | "rollback_batch" | "export_manifest">;
    forbiddenActions: Array<"auto_activate" | "start_crawl" | "import_without_review" | "add_private_source" | "bypass_captcha_or_auth" | "download_payload">;
  };
  rollbackPacket: {
    rollbackPlanId: string;
    trigger: string;
    action: string;
  };
  guardrails: TiSourceAtlasApiResponse["guardrails"] & {
    noManifestImport: true;
    explicitApprovalRequired: true;
  };
  handoffs: TiSourceAtlasApiResponse["handoffs"] & {
    agent01RegistryImport: string[];
  };
}

export type SourceMarketplaceParserProfile =
  | "static_html"
  | "rss"
  | "dynamic_page"
  | "pdf_report"
  | "public_channel"
  | "advisory_security_signal"
  | "restricted_metadata_handoff";

export interface SourceMarketplaceParserCapability {
  profile: SourceMarketplaceParserProfile;
  owner: "agent_03" | "agent_04" | "agent_05";
  supportedSourceTypes: SourceType[];
  supported: boolean;
  marketplaceSourceCount: number;
  compatibleSourceCount: number;
  activationBlockedUntilSupported: boolean;
  notes: string[];
}

export interface SourceMarketplaceSource {
  sourceId: string;
  sourceName: string;
  sourceFamily: SourceActivationWaveCategory;
  sourceType: SourceType;
  url: string;
  trustScore: number;
  reliability: number;
  region: string[];
  language: string;
  sectorUtility: string[];
  parserProfile: SourceMarketplaceParserProfile;
  parserSupported: boolean;
  parserOwner: "agent_03" | "agent_04" | "agent_05";
  legalReviewState: "current" | "missing" | "stale";
  robotsReviewState: "current" | "missing" | "stale" | "not_required";
  schedulerCost: {
    budgetClass: SourceCollectionSla["budgetClass"];
    cadenceSeconds: number;
    estimatedDailyTasks: number;
    maxBytes: number;
  };
  expectedEvidenceYield: number;
  duplicateRate: number;
  activationReadiness: "ready_for_dry_run" | "needs_parser_support" | "needs_legal_review" | "blocked_unsafe";
  rollbackState: {
    rollbackPath: string;
    quarantineTrigger: string;
  };
  recommendedAction: "dry_run_activation_packet" | "request_parser_support" | "request_legal_review" | "exclude_unsafe";
  handoffs: {
    agent02: "scheduler_budget_ready" | "budget_review";
    agent03: "parser_supported" | "parser_gap";
    agent04: "public_signal_candidate" | "not_public_channel";
    agent06: "evidence_yield_ready" | "yield_watch";
    agent07: "quality_input_ready" | "quality_watch";
    agent09: "api_contract_ready";
    agent10: "slo_ready" | "release_hold";
  };
}

export interface SourceMarketplaceApiResponse {
  endpoint: "/v1/sources/marketplace";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  tenantId?: string;
  generatedAt: string;
  marketplace: {
    sourceCount: number;
    safePublicSourceCount: number;
    sourceFamilies: SourceActivationWaveCategory[];
    sources: SourceMarketplaceSource[];
  };
  parserCapabilityMatrix: SourceMarketplaceParserCapability[];
  activationReadiness: {
    readyForDryRun: number;
    needsParserSupport: number;
    needsLegalReview: number;
    blockedUnsafe: number;
  };
  unsupportedSourceClasses: Array<{
    sourceClass: string;
    reason: string;
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05";
    activationAllowed: false;
  }>;
  governance: {
    approvalMode: "dry_run_packets_only";
    noSilentActivation: true;
    noCrawlingFromMarketplace: true;
    requiredBeforeActivation: string[];
  };
  coordination: {
    agent02Fields: string[];
    agent03Fields: string[];
    agent04Fields: string[];
    agent06Fields: string[];
    agent07Fields: string[];
    agent09Fields: string[];
    agent10Fields: string[];
  };
}

export interface SourceActivationBatchSource {
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  url: string;
  decision: "activate" | "review_then_activate" | "defer_parser_gap" | "blocked_unsafe";
  safePublic: boolean;
  whyItMatters: string[];
  expectedCoverageDelta: string[];
  adapterOwner: SourceType;
  parserOwner: SourceType;
  parserCompatible: boolean;
  expectedCadenceSeconds: number;
  estimatedTasksPerDay: number;
  maxBytes: number;
  retentionClass: SourceCatalogMetadata["retentionClass"];
  legalNotes: string;
  legalReviewState: "current" | "missing" | "stale";
  robotsReviewState: "current" | "missing" | "stale" | "not_required";
  schedulerImpact: {
    queueClass: string;
    cadenceSeconds: number;
    estimatedDailyTasks: number;
  };
  rollbackState: {
    rollbackReason?: string;
    quarantineReason?: string;
  };
  safePublicRationale: string[];
  blockers: string[];
}

export interface SourceActivationBatchQuery {
  query: string;
  queryClass: SourceCoverageSloQueryClass;
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  status: "ready_for_review" | "blocked" | "empty";
  sources: SourceActivationBatchSource[];
  blockedUnsafeSourceIds: string[];
  schedulerCost: {
    estimatedTasksPerDay: number;
    maxCadenceSeconds: number;
    queueClasses: string[];
  };
  runtimeSla: SourceRuntimeSlaQuery;
  coverageCloseout: SourceCoverageCloseoutQuery;
  executionReadiness: SourceActivationExecutionQueryPacket;
  operatorDecisionPacket: {
    legalReviewsRequired: string[];
    robotsReviewsRequired: string[];
    parserFixesRequired: string[];
    rollbackOnlySourceIds: string[];
    approvalRequired: boolean;
  };
}

export type SourceRuntimeSlaStatus = "pass" | "warning" | "breach";
export type SourceRuntimeSlaMetricName =
  | "freshness"
  | "capture_success_ratio"
  | "parser_compatibility"
  | "legal_review_age"
  | "robots_review_age"
  | "scheduler_cost"
  | "evidence_yield"
  | "claim_yield";

export interface SourceRuntimeSlaMetric {
  name: SourceRuntimeSlaMetricName;
  status: SourceRuntimeSlaStatus;
  actual: number;
  target: number;
  unit: "seconds" | "ratio" | "days" | "tasks_per_day" | "boolean";
  impact: "none" | "partial_results" | "stale_results" | "parser_gap" | "release_hold";
  reason: string;
}

export interface SourceRuntimeSlaRemediation {
  action:
    | "activate_approved_source"
    | "pause_noisy_source"
    | "quarantine_failure"
    | "request_legal_review"
    | "request_robots_review"
    | "change_cadence"
    | "retire_duplicate"
    | "request_parser_support";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  sourceIds: string[];
  approvalRequired: boolean;
  owner: "agent_01" | "agent_02" | "agent_03" | "agent_06" | "agent_10";
  reason: string;
  releaseHold: boolean;
}

export interface SourceFamilyCoverageGate {
  queryClass: SourceCoverageSloQueryClass;
  status: "pass" | "warning" | "hold";
  requiredFamilies: number;
  actualFamilies: number;
  families: string[];
  missingFamilies: string[];
  releaseImpact: "none" | "partial_answer" | "promotion_hold";
}

export interface SourceSlaPromotionRepairPacket {
  action: SourceRuntimeSlaRemediation["action"];
  owner: SourceRuntimeSlaRemediation["owner"];
  sourceIds: string[];
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  releaseHold: boolean;
  reason: string;
}

export interface SourceSlaPromotionGate {
  gate: "source_sla_enforcement";
  decision: "pass" | "warn" | "hold" | "rollback";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  holds: Array<{
    code: "source_family_coverage" | "parser_gap" | "scheduler_cost" | "evidence_yield" | "legal_review" | "robots_review" | "quarantine";
    owner: "agent_01" | "agent_02" | "agent_03" | "agent_06" | "agent_10";
    sourceIds: string[];
    reason: string;
  }>;
  warnings: string[];
  repairPackets: SourceSlaPromotionRepairPacket[];
  agent10ReleaseDecision: {
    field: "sourceSlaPromotionGate";
    status: "pass" | "hold" | "rollback";
    releaseImpact: "none" | "partial_answer" | "block_release" | "rollback_required";
    rollbackPath: string;
  };
}

export interface SourceRuntimeSlaSource {
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  status: SourceRuntimeSlaStatus;
  safePublic: boolean;
  runtimeStatus: SourceRecord["status"];
  metrics: Record<SourceRuntimeSlaMetricName, SourceRuntimeSlaMetric>;
  schedulerCost: {
    queueClass: string;
    cadenceSeconds: number;
    estimatedDailyTasks: number;
    maxBytes: number;
  };
  rollbackState: {
    rollbackReason?: string;
    rollbackAt?: string;
    rollbackBy?: string;
  };
  quarantineState: {
    quarantined: boolean;
    reason?: string;
  };
  apiImpact: "none" | "partial_results" | "stale_results" | "blocked";
  releaseHold: boolean;
  breachReasons: string[];
}

export interface SourceRuntimeSlaQuery {
  query: string;
  queryClass: SourceCoverageSloQueryClass;
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  status: SourceRuntimeSlaStatus;
  summary: {
    sourceCount: number;
    passing: number;
    warning: number;
    breached: number;
    releaseHold: boolean;
    apiImpact: "none" | "partial_results" | "stale_results" | "blocked";
  };
  sourceFamilyGate: SourceFamilyCoverageGate;
  promotionGate: SourceSlaPromotionGate;
  sources: SourceRuntimeSlaSource[];
  remediation: SourceRuntimeSlaRemediation[];
}

export interface SourceRuntimeSlaApiResponse {
  endpoint: "/v1/sources/runtime-sla";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  tenantId?: string;
  generatedAt: string;
  queries: SourceRuntimeSlaQuery[];
  rollup: {
    status: SourceRuntimeSlaStatus;
    passing: number;
    warning: number;
    breached: number;
    releaseHold: boolean;
  };
  releasePacket: {
    gate: "source_sla_enforcement";
    decision: "pass" | "hold" | "rollback";
    heldQueries: string[];
    warningQueries: string[];
    dryRun: true;
    willMutate: false;
    willStartCrawling: false;
  };
  coordination: {
    agent02Fields: string[];
    agent03Fields: string[];
    agent06Fields: string[];
    agent10Fields: string[];
  };
}

export type SourceCoverageCloseoutQueryClass = SourceCoverageSloQueryClass | "campaign" | "infrastructure" | "victim_company";
export type SourceActivationWaveCategory = "vendor_blog" | "advisory" | "rss" | "github_security_advisory" | "public_research_feed" | "government_cert";

export interface SourceActivationWaveSource {
  sourceId: string;
  sourceName: string;
  category: SourceActivationWaveCategory;
  sourceType: SourceType;
  url: string;
  approvalScope: SourceCatalogMetadata["approvalScope"];
  legalReviewState: "current" | "missing" | "stale";
  robotsReviewState: "current" | "missing" | "stale" | "not_required";
  parserCompatible: boolean;
  schedulerBudget: {
    budgetClass: SourceCollectionSla["budgetClass"];
    cadenceSeconds: number;
    estimatedDailyTasks: number;
    maxBytes: number;
  };
  expectedEvidenceYield: number;
  rollbackQuarantinePlan: {
    rollbackPath: string;
    quarantineTrigger: string;
  };
  promotionImpact: {
    agent07: "ready_for_extraction" | "parser_gap_hold";
    agent09: "api_coverage_ready" | "partial_until_approved";
    agent10: "release_candidate" | "promotion_hold";
  };
  safePublicRationale: string[];
}

export interface SourceActivationWave {
  waveId: string;
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  category: SourceActivationWaveCategory;
  sourceCount: number;
  schedulerBudget: {
    estimatedDailyTasks: number;
    budgetClasses: SourceCollectionSla["budgetClass"][];
  };
  sources: SourceActivationWaveSource[];
}

export interface SourceActivationExecutionSource {
  sourceId: string;
  sourceName: string;
  category: SourceActivationWaveCategory;
  sourceType: SourceType;
  url: string;
  canaryOrder?: number;
  rolloutOrder: number;
  approvalScope: SourceCatalogMetadata["approvalScope"];
  legalReviewAgeDays: number;
  robotsReviewAgeDays: number | "not_required";
  parserOwner: "agent_03";
  parserCompatible: boolean;
  schedulerBudget: SourceActivationWaveSource["schedulerBudget"];
  expectedCaptureYield: number;
  expectedEvidenceYield: number;
  rollbackTrigger: string;
  quarantineTrigger: string;
  postActivationDriftChecks: string[];
}

export interface SourceActivationExecutionExcludedSource {
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  excludedClass: "restricted_raw_payload" | "private_forum" | "credentialed_source" | "leaked_file_endpoint" | "captcha_gated" | "public_chat_source" | "parser_gap" | "duplicate";
  owner: "agent_01" | "agent_03";
  reason: string;
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
}

export interface SourceActivationExecutionQueryPacket {
  query: string;
  queryClass: SourceCoverageCloseoutQueryClass;
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  canarySourceIds: string[];
  rolloutSourceIds: string[];
  coverageFamilies: string[];
  coverageReady: boolean;
  promotionImpact: SourceRolloutPromotionQueryImpact;
  blockers: string[];
}

export interface SourceRolloutPromotionQueryImpact {
  queryClass: SourceCoverageCloseoutQueryClass;
  publicTiAnswerEffect: "improves_freshness" | "improves_coverage" | "keeps_partial_until_canary_passes";
  agent02SchedulerTelemetry: {
    expectedDailyTasks: number;
    budgetState: "within_budget" | "hold";
    telemetryFields: string[];
  };
  agent06EvidenceCertification: {
    threshold: number;
    expectedEvidenceYield: number;
    certificationState: "ready" | "watch";
  };
  agent07PollingState: {
    state: "canary_polling" | "expanded_polling" | "hold";
    nextPollSeconds: number;
  };
  agent09ContractIndex: {
    field: "sourceCoverage.rolloutPromotion";
    route: "/v1/contracts";
  };
  agent10Decision: {
    field: "sourceRolloutPromotionPacket";
    decision: "canary_pass" | "expanded_rollout_pass" | "hold";
  };
}

export interface SourceRolloutPromotionPacket {
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  stage: "canary_to_expanded_rollout";
  first10CanarySourceIds: string[];
  publicRollout50SourceIds: string[];
  coverageImpacts: SourceRolloutPromotionQueryImpact[];
  rollbackCriteria: string[];
  evidenceYieldThresholds: {
    canaryMinimum: number;
    rolloutMinimum: number;
    certificationOwner: "agent_06";
  };
  costControls: {
    owner: "agent_02";
    maxCanaryDailyTasks: number;
    maxRolloutDailyTasks: number;
    currentCanaryDailyTasks: number;
    currentRolloutDailyTasks: number;
    state: "within_budget" | "hold";
  };
  postCanaryMonitoring: Array<{
    metric: "capture_success_ratio" | "evidence_yield" | "parser_error_rate" | "queue_cost" | "public_ti_answer_freshness" | "duplicate_rate";
    threshold: string;
    owner: "agent_01" | "agent_02" | "agent_03" | "agent_06" | "agent_07" | "agent_09" | "agent_10";
  }>;
  sourceRetirement: SourceActivationExecutionReadiness["sourceRetirement"];
  duplicateSuppression: SourceActivationExecutionReadiness["duplicateSuppression"];
  parserGapHandoff: SourceActivationExecutionReadiness["parserGapHandoff"];
  agent10CanaryReleaseDecision: {
    field: "sourceRolloutPromotionPacket";
    canaryDecision: "pass" | "hold";
    expandedRolloutDecision: "pass" | "hold";
    releaseDecision: "promote_canary_then_expand" | "hold";
    rollbackPath: string;
  };
}

export interface SourceActivationExecutionReadiness {
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  first10Canary: SourceActivationExecutionSource[];
  publicRollout50: SourceActivationExecutionSource[];
  selectedBatches: Array<{
    batchId: string;
    sourceCount: number;
    category: SourceActivationWaveCategory | "mixed_canary" | "public_rollout";
    sourceIds: string[];
    schedulerBudget: {
      estimatedDailyTasks: number;
      budgetClasses: SourceCollectionSla["budgetClass"][];
    };
  }>;
  excludedSources: SourceActivationExecutionExcludedSource[];
  coverageByQueryClass: Array<{
    queryClass: SourceCoverageCloseoutQueryClass;
    sourceCount: number;
    sourceIds: string[];
  }>;
  sourceRetirement: {
    dryRun: true;
    willMutate: false;
    candidates: string[];
    reason: string;
  };
  duplicateSuppression: {
    dryRun: true;
    willMutate: false;
    duplicateSourceIds: string[];
    canonicalSourceIds: string[];
    proof: string;
  };
  parserGapHandoff: {
    owner: "agent_03";
    sourceIds: string[];
    reason: string;
    releaseImpact: "none" | "hold";
  };
  queueBudgetImpact: {
    owner: "agent_02";
    canaryEstimatedDailyTasks: number;
    rolloutEstimatedDailyTasks: number;
    withinBudget: boolean;
    budgetClassBreakdown: Record<SourceCollectionSla["budgetClass"], number>;
  };
  postActivationDriftChecks: string[];
  rolloutPromotion: SourceRolloutPromotionPacket;
  agent10ReleasePacket: {
    field: "sourceActivationExecutionReadiness";
    gate: "source_activation_execution_readiness";
    decision: "pass" | "hold";
    dryRun: true;
    willMutate: false;
    willStartCrawling: false;
    canaryCount: 10;
    rolloutCount: 50;
    rollbackPath: string;
  };
}

export interface SourceCoverageCloseoutQuery {
  query: string;
  queryClass: SourceCoverageCloseoutQueryClass;
  readiness: "ready" | "partial" | "hold";
  sourceFamilyGate: SourceFamilyCoverageGate;
  activeSafePublicSourceCount: number;
  plannedSafePublicSourceCount: number;
  activationWaveIds: string[];
  promotionImpact: {
    agent07: "ready_for_extraction" | "needs_parser_support";
    agent09: "api_ready" | "partial_until_activation";
    agent10: "release_candidate" | "release_hold";
  };
  executionPacket: SourceActivationExecutionQueryPacket;
  blockers: string[];
}

export interface SourceCoverageCloseoutApiResponse {
  endpoint: "/v1/sources/coverage-closeout";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  tenantId?: string;
  generatedAt: string;
  queries: SourceCoverageCloseoutQuery[];
  activationWaves: SourceActivationWave[];
  summary: {
    safePublicActivationSourceCount: number;
    waveCount: number;
    readyQueries: number;
    heldQueries: number;
  };
  forbiddenSourceClasses: string[];
  executionReadiness: SourceActivationExecutionReadiness;
  releasePacket: {
    gate: "source_coverage_closeout";
    decision: "pass" | "hold";
    dryRun: true;
    willMutate: false;
    willStartCrawling: false;
    agent10Field: "sourceCoverageCloseout";
    agent10ExecutionField: "sourceActivationExecutionReadiness";
  };
}

export interface SourceActivationBatchApiResponse {
  endpoint: "/v1/sources/activation-batches";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  tenantId?: string;
  generatedAt: string;
  queries: SourceActivationBatchQuery[];
  forbiddenSourceClasses: string[];
  executionReadiness: SourceActivationExecutionReadiness;
  coordination: {
    agent02Fields: string[];
    agent03Fields: string[];
    agent09Fields: string[];
  };
}

export interface SourceCoverageGovernanceDriftItem {
  code: SourceCoverageGovernanceDriftCode;
  sourceId: string;
  sourceName: string;
  severity: "info" | "warning" | "critical";
  reason: string;
  recommendedAction: "approve" | "quarantine" | "change_cadence" | "request_legal_review" | "reassign_adapter" | "retire_duplicate";
}

export interface SourceCoverageRemediationPlan {
  action: "activate" | "quarantine" | "change_cadence" | "request_legal_review" | "reassign_adapter" | "retire_duplicate" | "reduce_cadence" | "increase_cadence" | "add_source_pack";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  sourceIds: string[];
  reason: string;
  approvalRequired: boolean;
}

export interface SeedSourceImportOptions {
  existingSources?: SourceRecord[];
  dryRun?: boolean;
  importedAt?: string;
  referenceAt?: string;
}
