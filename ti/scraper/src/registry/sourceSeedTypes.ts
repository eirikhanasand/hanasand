import type {
  AccessMethod,
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

export interface SourcePortfolioApiResponse {
  endpoint: "/v1/sources/portfolio";
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  tenantId?: string;
  generatedAt: string;
  portfolio: SourcePortfolioQuerySummary;
  queries: SourcePortfolioQuerySummary[];
  onboardingPlans: SourcePackOnboardingPlan[];
  burnDown: SourceCoverageBurnDownReport[];
  promotionPacket: {
    field: "sourcePortfolioId";
    value: string;
    gate: "source_portfolio_ready";
    ready: boolean;
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

export type SourceCoverageCloseoutQueryClass = SourceCoverageSloQueryClass | "campaign" | "infrastructure";
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
