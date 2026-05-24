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
import { nowIso, stableId } from "../utils.ts";
import { validateSource } from "./sourceRegistry.ts";

const SAFE_PUBLIC_TYPES = new Set<SourceType>(["rss", "static_web", "api", "pdf"]);
const SAFE_ACCESS_METHODS = new Set<AccessMethod>(["public_http", "official_api"]);

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

export function validateSeedBundle(bundle: SeedSourceBundle, options: SeedSourceImportOptions = {}): SeedSourceImportReport {
  return buildSeedImportReport(bundle, options);
}

export function importSeedBundle(bundle: SeedSourceBundle, options: SeedSourceImportOptions = {}): SeedSourceImportReport {
  return buildSeedImportReport(bundle, { ...options, dryRun: options.dryRun ?? false });
}

export function exportSeedBundle(sources: SourceRecord[], name: string, generatedAt = nowIso()): SeedSourceBundle {
  return {
    version: 1,
    name,
    generatedAt,
    sources: sources.map((source) => ({
      id: source.id,
      tenantId: source.tenantId,
      name: source.name,
      type: source.type,
      url: source.url,
      accessMethod: source.accessMethod,
      risk: source.risk,
      trustScore: source.trustScore,
      language: source.language,
      crawlFrequencySeconds: source.crawlFrequencySeconds,
      legalNotes: source.legalNotes,
      lastSeenAt: source.lastSeenAt,
      tags: source.tags,
      metadata: source.metadata,
      catalog: source.catalog
    }))
  };
}

export function seedDuplicateKey(source: Pick<SeedSourceInput | SourceRecord, "tenantId" | "type" | "url">): string {
  return `${source.tenantId ?? "global"}:${source.type}:${canonicalizeSeedUrl(source.url)}`;
}

export function buildSourceActivationReport(query: string, sources: SourceRecord[], generatedAt = nowIso()): SourceActivationReport {
  const explanations = sources
    .map((source) => explainSourceForQuery(query, source, generatedAt))
    .sort((left, right) => right.score - left.score || left.sourceName.localeCompare(right.sourceName));
  const summary = Object.fromEntries(ACTIVATION_STATUSES.map((status) => [status, 0])) as Record<SourceActivationStatus, number>;
  for (const explanation of explanations) summary[explanation.status] += 1;
  return { query, generatedAt, sources: explanations, summary };
}

export function buildLiveSearchSourceActivationDto(
  query: string,
  sources: SourceRecord[],
  options: { generatedAt?: string; demandCount?: number } = {}
): LiveSearchSourceActivationDto {
  const generatedAt = options.generatedAt ?? nowIso();
  const sourceCoverage = buildSourceActivationReport(query, sources, generatedAt);
  const inactive = sourceCoverage.sources.filter((source) => source.status !== "active");
  const coverageGaps = ACTIVATION_STATUSES
    .map((status) => {
      const matches = inactive.filter((source) => source.status === status);
      return {
        category: status,
        count: matches.length,
        sourceIds: matches.map((source) => source.sourceId),
        reason: activationGapReason(status)
      };
    })
    .filter((gap) => gap.count > 0);
  const demandCount = Math.max(1, options.demandCount ?? 1);
  const activationRecommendations = inactive
    .filter((source) => source.score > 0 || source.status !== "candidate_only")
    .map((source) => ({
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      reason: source.reasons.join("; ") || activationGapReason(source.status),
      requiredAction: requiredActivationAction(source.status),
      priority: Math.round(source.score * 100) + demandCount * 10 + actionPriorityBoost(source.status),
      coverageGap: activationCoverageGapForStatus(source.status),
      demandCount,
      status: source.status,
      matchedTopics: source.matchedTopics,
      matchedActors: source.matchedActors,
      matchedIndustries: source.matchedIndustries,
      matchedRegions: source.matchedRegions
    }))
    .sort((left, right) => right.priority - left.priority || left.sourceId.localeCompare(right.sourceId))
    .slice(0, 10);

  return { query, generatedAt, coverageGaps, activationRecommendations, sourceCoverage };
}

export function buildSourceActivationApiResponse(
  query: string,
  sources: SourceRecord[],
  options: {
    tenantId?: string;
    generatedAt?: string;
    demandCount?: number;
    sourcePack?: SeedSourceBundle;
  } = {}
): SourceActivationApiResponse {
  const scopedSources = options.tenantId
    ? sources.filter((source) => source.tenantId === options.tenantId || source.tenantId === undefined)
    : sources;
  const generatedAt = options.generatedAt ?? nowIso();
  const liveDto = buildLiveSearchSourceActivationDto(query, scopedSources, {
    generatedAt,
    demandCount: options.demandCount
  });
  const summaries = liveDto.sourceCoverage.sources.map((explanation) =>
    apiSourceSummary(explanation, scopedSources.find((source) => source.id === explanation.sourceId)!)
  );
  const byStatus = (status: SourceActivationStatus) => summaries.filter((source) => source.status === status);
  const duplicateSources = duplicateGroups(scopedSources);
  const sourcePackRecommendations = options.sourcePack
    ? buildSafePublicSourcePackInstallPlan(options.sourcePack, {
      mode: "dry_run",
      tenantId: options.tenantId,
      existingSources: scopedSources,
      generatedAt
    }).recommendations
    : [];

  return {
    query,
    tenantId: options.tenantId,
    generatedAt,
    activeCoverage: byStatus("active"),
    approvedIdleSources: byStatus("approved_idle"),
    candidateOnlyGaps: byStatus("candidate_only"),
    missingLegalNotes: byStatus("missing_legal_notes"),
    policyBlocks: byStatus("blocked_by_policy"),
    staleSources: byStatus("stale"),
    duplicateSources,
    adapterIncompatibilities: byStatus("adapter_incompatible"),
    coverageGaps: liveDto.coverageGaps,
    underservedReasons: buildUnderservedReasons(query, scopedSources, summaries, duplicateSources),
    activationRecommendations: liveDto.activationRecommendations,
    sourcePackRecommendations,
    coverageSummary: liveDto.sourceCoverage.summary,
    sourceCoverage: liveDto.sourceCoverage
  };
}

export function buildSourceCoveragePlanApiResponse(input: {
  queries: string[];
  sources: SourceRecord[];
  sourcePacks?: SeedSourceBundle[];
  tenantId?: string;
  generatedAt?: string;
}): SourceCoveragePlanApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const scopedSources = input.tenantId
    ? input.sources.filter((source) => source.tenantId === input.tenantId || source.tenantId === undefined)
    : input.sources;
  const activationWaves = buildEnterpriseSafePublicActivationWaves(generatedAt);
  const queries = input.queries.map((query): SourceCoveragePlanQuery => {
    const activation = buildSourceActivationApiResponse(query, input.sources, {
      tenantId: input.tenantId,
      generatedAt,
      sourcePack: input.sourcePacks?.[0]
    });
    const queryRecommendations = activation.sourcePackRecommendations.filter((source) =>
      source.requiredAction === "install_candidate" && recommendationMatchesQuery(source, query)
    ).sort((left, right) => recommendationQueryRank(right, query) - recommendationQueryRank(left, query) || right.score - left.score || left.sourceId.localeCompare(right.sourceId));
    const queryActivation = { ...activation, sourcePackRecommendations: queryRecommendations };
    const missingVerticals = buildCoverageVerticals(query, queryActivation, input.sourcePacks ?? []);
    const slo = evaluateSourceCoverageSlo(query, scopedSources, queryActivation, queryRecommendations, generatedAt);
    const queryDrift = buildSourceCoverageSloDrift(query, slo, scopedSources, queryActivation, queryRecommendations);
    const blockingCount = activation.policyBlocks.length + activation.adapterIncompatibilities.length;
    const activeCount = activation.activeCoverage.filter((source) => source.score > 0).length;
    const recommendedCount = queryRecommendations.length;
    const coverageState = blockingCount > 0 && activeCount === 0
      ? "blocked"
      : slo.status === "fail" && activeCount > 0
        ? "needs_review"
        : activeCount > 0 || recommendedCount > 0
        ? "ready"
        : "partial";
    return {
      query,
      coverageState,
      slo,
      drift: queryDrift,
      portfolio: buildSourcePortfolioQuerySummary(query, scopedSources, generatedAt),
      activationBatch: buildSourceActivationBatchQuery(query, scopedSources, input.sourcePacks ?? [], queryRecommendations, generatedAt, input.tenantId),
      runtimeSla: buildSourceRuntimeSlaQuery(query, scopedSources, generatedAt),
      coverageCloseout: buildSourceCoverageCloseoutQuery(query, scopedSources, activationWaves, generatedAt),
      executionReadiness: buildSourceActivationExecutionQueryPacket(query, activationWaves, generatedAt),
      activeSources: activation.activeCoverage.filter((source) => source.score > 0).slice(0, 12),
      eligibleSources: [...activation.activeCoverage, ...activation.approvedIdleSources]
        .filter((source) => source.score > 0)
        .slice(0, 12),
      selectedSources: activation.activeCoverage
        .filter((source) => source.score > 0)
        .sort((left, right) => right.score - left.score || left.sourceId.localeCompare(right.sourceId))
        .slice(0, 5),
      approvedIdleSources: activation.approvedIdleSources.filter((source) => source.score > 0).slice(0, 12),
      missingApprovedPublicSources: queryRecommendations.slice(0, 12),
      missingVerticals,
      staleSources: activation.staleSources.filter((source) => source.score > 0).slice(0, 12),
      policyBlocks: activation.policyBlocks.filter((source) => source.score > 0).slice(0, 12),
      adapterIncompatibilities: activation.adapterIncompatibilities.filter((source) => source.score > 0).slice(0, 12),
      safeSourcePackRecommendations: queryRecommendations.slice(0, 12),
      underservedReasons: activation.underservedReasons
    };
  });
  const sourcePackInstallPlans = (input.sourcePacks ?? []).map((pack) => {
    const plan = buildSafePublicSourcePackInstallPlan(pack, {
      mode: "dry_run",
      tenantId: input.tenantId,
      existingSources: input.sources,
      generatedAt
    });
    return {
      packName: plan.packName,
      safeToInstall: plan.safeToInstall,
      acceptedSourceCount: plan.acceptedSourceCount,
      rejectedSourceCount: plan.rejectedSourceCount,
      duplicateSourceCount: plan.duplicateSourceCount,
      willStartCrawling: plan.willStartCrawling
    };
  });
  const drift = buildCoverageGovernanceDrift(input.sources, input.sourcePacks ?? [], input.tenantId, generatedAt);
  const coverageDrift = queries.flatMap((query) => query.drift);

  return {
    endpoint: "/v1/sources/coverage-plan",
    dryRun: true as const,
    willMutate: false as const,
    willStartCrawling: false as const,
    tenantId: input.tenantId,
    generatedAt,
    queries,
    slo: buildSourceCoverageSloRollup(queries),
    drift: [...coverageDrift, ...drift],
    sourcePackInstallPlans,
    governanceDrift: drift,
    remediationPlans: buildCoverageRemediationPlans([...drift, ...coverageDrift]),
    forbiddenSourceClasses: [
      "private forums",
      "credentialed sources",
      "leaked-file endpoints",
      "CAPTCHA bypass",
      "threat actor interaction",
      "restricted raw payload collection"
    ],
    coordination: {
      agent09Fields: ["queries", "slo", "drift", "eligibleSources", "selectedSources", "activeSources", "approvedIdleSources", "missingApprovedPublicSources", "missingVerticals", "governanceDrift", "safeSourcePackRecommendations", "underservedReasons"],
      agent10PromotionFields: ["dryRun", "willMutate", "willStartCrawling", "slo", "drift", "runtimeSla", "sourcePackInstallPlans", "governanceDrift", "remediationPlans", "forbiddenSourceClasses"]
    }
  };
}

export function buildSourcePortfolioApiResponse(input: {
  queries: string[];
  sources: SourceRecord[];
  sourcePacks?: SeedSourceBundle[];
  tenantId?: string;
  generatedAt?: string;
}): SourcePortfolioApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const scopedSources = input.tenantId
    ? input.sources.filter((source) => source.tenantId === input.tenantId || source.tenantId === undefined)
    : input.sources;
  const queries = input.queries.length > 0 ? input.queries : ["portfolio"];
  const coverage = buildSourceCoveragePlanApiResponse({
    queries,
    sources: scopedSources,
    sourcePacks: input.sourcePacks,
    tenantId: input.tenantId,
    generatedAt
  });
  const portfolioQueries = queries.map((query) => buildSourcePortfolioQuerySummary(query, scopedSources, generatedAt));
  const onboardingPlans = (input.sourcePacks ?? []).map((pack) =>
    buildSourcePackOnboardingPlan(pack, scopedSources, coverage.queries, input.tenantId, generatedAt)
  );
  const burnDown = coverage.queries.map((query) =>
    buildSourceCoverageBurnDownReport(query, onboardingPlans, scopedSources)
  );
  const ready = coverage.slo.failed === 0 && coverage.governanceDrift.every((item) => item.severity !== "critical");

  return {
    endpoint: "/v1/sources/portfolio",
    dryRun: true as const,
    willMutate: false as const,
    willStartCrawling: false as const,
    tenantId: input.tenantId,
    generatedAt,
    portfolio: buildSourcePortfolioQuerySummary("portfolio", scopedSources, generatedAt),
    queries: portfolioQueries,
    onboardingPlans,
    burnDown,
    promotionPacket: {
      field: "sourcePortfolioId",
      value: stableId("source_portfolio", `${input.tenantId ?? "global"}:${queries.join("|")}:${generatedAt}`),
      gate: "source_portfolio_ready",
      ready
    }
  };
}

export function buildSourceActivationBatchApiResponse(input: {
  queries: string[];
  sources: SourceRecord[];
  sourcePacks?: SeedSourceBundle[];
  tenantId?: string;
  generatedAt?: string;
}): SourceActivationBatchApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const scopedSources = input.tenantId
    ? input.sources.filter((source) => source.tenantId === input.tenantId || source.tenantId === undefined)
    : input.sources;
  const queries = input.queries.length > 0 ? input.queries : ["portfolio"];
  const activationWaves = buildEnterpriseSafePublicActivationWaves(generatedAt);
  return {
    endpoint: "/v1/sources/activation-batches",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    tenantId: input.tenantId,
    generatedAt,
    queries: queries.map((query) => {
      const activation = buildSourceActivationApiResponse(query, scopedSources, {
        tenantId: input.tenantId,
        generatedAt,
        sourcePack: input.sourcePacks?.[0]
      });
      const recommendations = activation.sourcePackRecommendations
        .filter((source) => source.requiredAction === "install_candidate" && recommendationMatchesQuery(source, query));
      return buildSourceActivationBatchQuery(query, scopedSources, input.sourcePacks ?? [], recommendations, generatedAt, input.tenantId);
    }),
    forbiddenSourceClasses: activationBatchForbiddenSourceClasses(),
    executionReadiness: buildSourceActivationExecutionReadiness(activationWaves, queries, generatedAt),
    coordination: {
      agent02Fields: ["schedulerCost", "schedulerImpact", "expectedCadenceSeconds", "estimatedTasksPerDay", "executionReadiness.queueBudgetImpact"],
      agent03Fields: ["parserOwner", "parserCompatible", "blockers", "executionReadiness.parserGapHandoff"],
      agent09Fields: ["queries", "operatorDecisionPacket", "sources", "forbiddenSourceClasses"]
    }
  };
}

export function buildSourceRuntimeSlaApiResponse(input: {
  queries: string[];
  sources: SourceRecord[];
  tenantId?: string;
  generatedAt?: string;
}): SourceRuntimeSlaApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const scopedSources = input.tenantId
    ? input.sources.filter((source) => source.tenantId === input.tenantId || source.tenantId === undefined)
    : input.sources;
  const queries = input.queries.length > 0 ? input.queries : ["runtime"];
  const rows = queries.map((query) => buildSourceRuntimeSlaQuery(query, scopedSources, generatedAt));
  const passing = rows.filter((query) => query.status === "pass").length;
  const warning = rows.filter((query) => query.status === "warning").length;
  const breached = rows.filter((query) => query.status === "breach").length;

  return {
    endpoint: "/v1/sources/runtime-sla",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    tenantId: input.tenantId,
    generatedAt,
    queries: rows,
    rollup: {
      status: breached > 0 ? "breach" : warning > 0 ? "warning" : "pass",
      passing,
      warning,
      breached,
      releaseHold: rows.some((query) => query.summary.releaseHold)
    },
    releasePacket: {
      gate: "source_sla_enforcement",
      decision: rows.some((query) => query.promotionGate.decision === "rollback")
        ? "rollback"
        : rows.some((query) => query.promotionGate.decision === "hold")
          ? "hold"
          : "pass",
      heldQueries: rows.filter((query) => query.promotionGate.decision === "hold" || query.promotionGate.decision === "rollback").map((query) => query.query),
      warningQueries: rows.filter((query) => query.promotionGate.decision === "warn").map((query) => query.query),
      dryRun: true,
      willMutate: false,
      willStartCrawling: false
    },
    coordination: {
      agent02Fields: ["schedulerCost", "metrics.scheduler_cost", "remediation.change_cadence", "remediation.pause_noisy_source"],
      agent03Fields: ["metrics.parser_compatibility", "remediation.request_parser_support"],
      agent06Fields: ["metrics.evidence_yield", "metrics.claim_yield"],
      agent10Fields: ["rollup", "summary.releaseHold", "apiImpact", "remediation.releaseHold"]
    }
  };
}

export function buildSourceCoverageCloseoutApiResponse(input: {
  queries: string[];
  sources: SourceRecord[];
  tenantId?: string;
  generatedAt?: string;
}): SourceCoverageCloseoutApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const scopedSources = input.tenantId
    ? input.sources.filter((source) => source.tenantId === input.tenantId || source.tenantId === undefined)
    : input.sources;
  const waves = buildEnterpriseSafePublicActivationWaves(generatedAt);
  const queries = (input.queries.length > 0 ? input.queries : ["APT29", "Akira ransomware victims", "CVE-2024-1234", "Cobalt Strike malware tool", "Norway", "healthcare sector", "campaign infrastructure", "C2 infrastructure"])
    .map((query) => buildSourceCoverageCloseoutQuery(query, scopedSources, waves, generatedAt));
  const heldQueries = queries.filter((query) => query.readiness === "hold");
  const executionReadiness = buildSourceActivationExecutionReadiness(waves, queries.map((query) => query.query), generatedAt);

  return {
    endpoint: "/v1/sources/coverage-closeout",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    tenantId: input.tenantId,
    generatedAt,
    queries,
    activationWaves: waves,
    summary: {
      safePublicActivationSourceCount: waves.reduce((sum, wave) => sum + wave.sourceCount, 0),
      waveCount: waves.length,
      readyQueries: queries.filter((query) => query.readiness === "ready").length,
      heldQueries: heldQueries.length
    },
    forbiddenSourceClasses: activationBatchForbiddenSourceClasses(),
    executionReadiness,
    releasePacket: {
      gate: "source_coverage_closeout",
      decision: heldQueries.length > 0 || executionReadiness.agent10ReleasePacket.decision === "hold" ? "hold" : "pass",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      agent10Field: "sourceCoverageCloseout",
      agent10ExecutionField: "sourceActivationExecutionReadiness"
    }
  };
}

function buildSourcePortfolioQuerySummary(query: string, sources: SourceRecord[], generatedAt: string): SourcePortfolioQuerySummary {
  const matching = query === "portfolio"
    ? sources
    : sources.filter((source) => explainSourceForQuery(query, source, generatedAt).score > 0);
  return {
    query,
    queryClass: query === "portfolio" ? "actor" : classifyCoverageQuery(query),
    familyGroups: groupPortfolioSources(matching, (source) => sourceFamilyKey(source), (source) => source.catalog?.publisher.name ?? new URL(source.url).hostname),
    actorGroups: groupPortfolioSources(matching, (source) => source.catalog?.coverage.actors.length ? source.catalog.coverage.actors : ["unmapped_actor"], (source) => source),
    regionGroups: groupPortfolioSources(matching, (source) => source.catalog?.coverage.regions.length ? source.catalog.coverage.regions : ["unmapped_region"], (source) => source),
    sectorGroups: groupPortfolioSources(matching, (source) => source.catalog?.coverage.industries.length ? source.catalog.coverage.industries : ["unmapped_sector"], (source) => source),
    languageGroups: groupPortfolioSources(matching, (source) => source.catalog?.coverage.languages.length ? source.catalog.coverage.languages : [source.language ?? "unknown"], (source) => source),
    legalReviewAgeGroups: groupPortfolioSources(matching, (source) => reviewAgeBucket(source.metadata?.legalNotesReviewedAt, generatedAt), (source) => source),
    robotsReviewAgeGroups: groupPortfolioSources(matching, (source) => sourceNeedsRobotsReview(source) ? reviewAgeBucket(source.metadata?.robotsReviewedAt, generatedAt) : "not_required", (source) => source),
    reliabilityGroups: groupPortfolioSources(matching, (source) => scoreBucket(source.catalog?.reliability ?? source.scoring?.reliability ?? source.trustScore), (source) => source),
    extractionYieldGroups: groupPortfolioSources(matching, (source) => scoreBucket(extractionYield(source)), (source) => source)
  };
}

function groupPortfolioSources(
  sources: SourceRecord[],
  keysFor: (source: SourceRecord) => string | string[],
  labelFor: (source: SourceRecord) => string | SourceRecord
): SourcePortfolioGroup[] {
  const groups = new Map<string, SourceRecord[]>();
  for (const source of sources) {
    const rawKeys = keysFor(source);
    const keys = Array.isArray(rawKeys) ? rawKeys : [rawKeys];
    for (const key of keys.filter(Boolean)) groups.set(key, [...(groups.get(key) ?? []), source]);
  }
  return [...groups.entries()]
    .map(([key, items]) => {
      const labelCandidate = labelFor(items[0]!);
      return {
        key,
        label: typeof labelCandidate === "string" ? labelCandidate : key,
        approved: items.filter((source) => source.status === "approved").length,
        active: items.filter((source) => source.status === "active" || source.status === "probation" || source.status === "degraded").length,
        candidate: items.filter((source) => source.status === "candidate" || source.status === "needs_review").length,
        safePublicSloEligible: items.filter(sourceCanSatisfyPublicSlo).length,
        sourceIds: items.map((source) => source.id).sort()
      };
    })
    .sort((left, right) => right.safePublicSloEligible - left.safePublicSloEligible || right.active - left.active || left.key.localeCompare(right.key))
    .slice(0, 20);
}

function reviewAgeBucket(value: unknown, generatedAt: string): string {
  if (typeof value !== "string" || !value) return "missing";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "invalid";
  const days = Math.floor((Date.parse(generatedAt) - timestamp) / 86400000);
  if (days <= 30) return "0-30d";
  if (days <= 90) return "31-90d";
  if (days <= 180) return "91-180d";
  return "181d-plus";
}

function scoreBucket(score: number): string {
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  if (score > 0) return "low";
  return "unknown";
}

function extractionYield(source: SourceRecord): number {
  const explicit = source.metadata?.extractionYield;
  if (typeof explicit === "number" && Number.isFinite(explicit)) return Math.max(0, Math.min(1, explicit));
  const parsed = source.metadata?.extractionYieldScore;
  if (typeof parsed === "number" && Number.isFinite(parsed)) return Math.max(0, Math.min(1, parsed));
  return source.scoring?.parseability ?? 0;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function buildSourceActivationBatchQuery(
  query: string,
  sources: SourceRecord[],
  packs: SeedSourceBundle[],
  recommendations: SafePublicSourcePackRecommendation[],
  generatedAt: string,
  tenantId?: string
): SourceActivationBatchQuery {
  const queryClass = classifyCoverageQuery(query);
  const scopedPackSources = packs.flatMap((pack) => pack.sources.map((source) => ({ ...source, tenantId: tenantId ?? source.tenantId })));
  const candidateRecords = recommendations
    .map((recommendation) => {
      const existing = sources.find((source) => source.id === recommendation.sourceId);
      if (existing) return existing;
      const seed = scopedPackSources.find((source) => (source.id ?? stableId("src", seedDuplicateKey(source))) === recommendation.sourceId);
      return seed ? seedInputToSource(seed, generatedAt) : undefined;
    })
    .filter((source): source is SourceRecord => Boolean(source));
  const existingCandidates = sources.filter((source) => {
    if (source.status === "active") return false;
    if (!sourceCanSatisfyPublicSlo(source)) return false;
    return explainSourceForQuery(query, source, generatedAt).score > 0;
  });
  const unsafeMatching = sources.filter((source) =>
    !sourceCanSatisfyPublicSlo(source) && explainSourceForQuery(query, source, generatedAt).score > 0
  );
  const records = [...new Map([...existingCandidates, ...candidateRecords].map((source) => [source.id, source])).values()];
  const batchSources = records
    .map((source) => sourceActivationBatchSource(source, query, generatedAt))
    .filter((source) => source.safePublic && source.decision !== "blocked_unsafe")
    .slice(0, 20);
  const schedulerCost = {
    estimatedTasksPerDay: batchSources.reduce((sum, source) => sum + source.estimatedTasksPerDay, 0),
    maxCadenceSeconds: Math.max(...batchSources.map((source) => source.expectedCadenceSeconds), 0),
    queueClasses: uniqueStrings(batchSources.map((source) => source.schedulerImpact.queueClass))
  };
  const legalReviewsRequired = batchSources.filter((source) => source.legalReviewState !== "current").map((source) => source.sourceId);
  const robotsReviewsRequired = batchSources.filter((source) => source.robotsReviewState === "missing" || source.robotsReviewState === "stale").map((source) => source.sourceId);
  const parserFixesRequired = batchSources.filter((source) => !source.parserCompatible).map((source) => source.sourceId);
  const rollbackOnlySourceIds = batchSources.filter((source) => source.rollbackState.quarantineReason || source.rollbackState.rollbackReason).map((source) => source.sourceId);

  return {
    query,
    queryClass,
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    status: batchSources.length === 0 ? "empty" : parserFixesRequired.length > 0 ? "blocked" : "ready_for_review",
    sources: batchSources,
    blockedUnsafeSourceIds: unsafeMatching.map((source) => source.id).sort(),
    schedulerCost,
    runtimeSla: buildSourceRuntimeSlaQuery(query, sources, generatedAt),
    coverageCloseout: buildSourceCoverageCloseoutQuery(query, sources, buildEnterpriseSafePublicActivationWaves(generatedAt), generatedAt),
    executionReadiness: buildSourceActivationExecutionQueryPacket(query, buildEnterpriseSafePublicActivationWaves(generatedAt), generatedAt),
    operatorDecisionPacket: {
      legalReviewsRequired,
      robotsReviewsRequired,
      parserFixesRequired,
      rollbackOnlySourceIds,
      approvalRequired: batchSources.length > 0
    }
  };
}

function sourceActivationBatchSource(source: SourceRecord, query: string, generatedAt: string): SourceActivationBatchSource {
  const safePublic = sourceCanSatisfyPublicSlo(source);
  const parserCompatible = Boolean(source.catalog?.adapterCompatibility.includes(source.type));
  const legalReviewState = reviewState(source.metadata?.legalNotesReviewedAt, generatedAt, Boolean(source.legalNotes.trim()));
  const robotsReviewState = sourceNeedsRobotsReview(source)
    ? reviewState(source.metadata?.robotsReviewedAt, generatedAt, true)
    : "not_required";
  const cadence = source.catalog?.collection.crawlCadenceSeconds ?? source.crawlFrequencySeconds;
  const estimatedTasksPerDay = Math.ceil(86400 / Math.max(3600, cadence));
  const blockers = [
    ...(!safePublic ? ["unsafe_source_class"] : []),
    ...(!parserCompatible ? ["parser_adapter_mismatch"] : []),
    ...(legalReviewState !== "current" ? [`legal_review_${legalReviewState}`] : []),
    ...(robotsReviewState === "missing" || robotsReviewState === "stale" ? [`robots_review_${robotsReviewState}`] : [])
  ];
  const explanation = explainSourceForQuery(query, source, generatedAt);

  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    url: source.url,
    decision: !safePublic ? "blocked_unsafe" : !parserCompatible ? "defer_parser_gap" : legalReviewState === "current" && (robotsReviewState === "current" || robotsReviewState === "not_required") ? "activate" : "review_then_activate",
    safePublic,
    whyItMatters: [
      ...explanation.reasons.slice(0, 6),
      `query:${query}`,
      `publisher:${source.catalog?.publisher.name ?? "unknown"}`
    ],
    expectedCoverageDelta: coverageTagsForSource(source).slice(0, 10),
    adapterOwner: source.type,
    parserOwner: source.type,
    parserCompatible,
    expectedCadenceSeconds: cadence,
    estimatedTasksPerDay,
    maxBytes: typeof source.metadata?.maxBytes === "number" ? source.metadata.maxBytes : 1_000_000,
    retentionClass: source.catalog?.retentionClass ?? "standard",
    legalNotes: source.legalNotes,
    legalReviewState,
    robotsReviewState,
    schedulerImpact: {
      queueClass: source.catalog?.collection.budgetClass ?? "normal",
      cadenceSeconds: cadence,
      estimatedDailyTasks: estimatedTasksPerDay
    },
    rollbackState: {
      rollbackReason: source.catalog?.rollback?.rollbackReason,
      quarantineReason: source.catalog?.rollback?.lastQuarantineReason
    },
    safePublicRationale: safePublic ? [
      "low-risk source",
      `access:${source.accessMethod}`,
      `approval:${source.catalog?.approvalScope ?? "missing"}`,
      `retention:${source.catalog?.retentionClass ?? "standard"}`
    ] : [],
    blockers
  };
}

function reviewState(value: unknown, generatedAt: string, hasRequiredText: boolean): "current" | "missing" | "stale" {
  if (!hasRequiredText || typeof value !== "string" || !value) return "missing";
  return staleMetadataDate(value, generatedAt, 90) ? "stale" : "current";
}

function coverageTagsForSource(source: SourceRecord): string[] {
  return [...new Set([
    ...(source.catalog?.coverage.topics ?? []),
    ...(source.catalog?.coverage.actors ?? []),
    ...(source.catalog?.coverage.aliases ?? []),
    ...(source.catalog?.coverage.industries ?? []),
    ...(source.catalog?.coverage.regions ?? []),
    ...(source.catalog?.coverage.countries ?? []),
    ...(source.tags ?? [])
  ])].sort();
}

function activationBatchForbiddenSourceClasses(): string[] {
  return [
    "restricted raw payload collection",
    "private forums",
    "credentialed sources",
    "leaked-file endpoints",
    "authentication-gated sources",
    "CAPTCHA bypass",
    "public chat sources"
  ];
}

const ENTERPRISE_SAFE_PUBLIC_SOURCE_TEMPLATES: Array<{
  name: string;
  category: SourceActivationWaveCategory;
  url: string;
  tags: string[];
}> = [
  ...[
    "Mandiant Threat Research",
    "Microsoft Threat Intelligence",
    "Google Threat Analysis Group",
    "Cisco Talos Blog",
    "Palo Alto Unit 42",
    "ESET WeLiveSecurity",
    "Sophos X-Ops",
    "Secureworks CTU",
    "CrowdStrike Counter Adversary",
    "SentinelLabs Research"
  ].map((name) => ({ name, category: "vendor_blog" as const, url: `https://example.com/vendor/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xml`, tags: ["actor", "malware", "campaign", "vendor research"] })),
  ...[
    "CISA Cybersecurity Advisories",
    "NCSC UK Advisories",
    "CERT-EU Advisories",
    "JPCERT/CC Alerts",
    "ACSC Alerts",
    "CERT-FR Alerts",
    "BSI CERT-Bund Advisories",
    "CSA Singapore Advisories",
    "NCSC Norway Advisories",
    "ENISA Threat Landscape"
  ].map((name) => ({ name, category: "advisory" as const, url: `https://example.com/advisory/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xml`, tags: ["advisory", "CVE", "sector", "government"] })),
  ...[
    "The DFIR Report RSS",
    "Malwarebytes Labs RSS",
    "KrebsOnSecurity RSS",
    "SANS ISC Diary RSS",
    "BleepingComputer Security RSS",
    "Rapid7 Blog RSS",
    "Red Canary Research RSS",
    "Proofpoint Threat Insight RSS",
    "Elastic Security Labs RSS",
    "Recorded Future Blog RSS"
  ].map((name) => ({ name, category: "rss" as const, url: `https://example.com/rss/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xml`, tags: ["rss", "incident", "ransomware", "malware"] })),
  ...[
    "GitHub Advisory Database",
    "GitLab Security Advisories",
    "OSV Vulnerability Feed",
    "RustSec Advisory Database",
    "PyPA Advisory Database",
    "npm Security Advisories",
    "Go Vulnerability Database",
    "Maven Security Advisories",
    "OpenSSF Security Advisories",
    "Kubernetes Security Announcements"
  ].map((name) => ({ name, category: "github_security_advisory" as const, url: `https://api.github.com/advisories/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, tags: ["github", "CVE", "vulnerability", "infrastructure"] })),
  ...[
    "MITRE ATT&CK Updates",
    "Malpedia Feeds",
    "Abuse.ch URLhaus",
    "Abuse.ch MalwareBazaar",
    "AlienVault OTX Pulses",
    "OpenPhish Feed",
    "PhishTank Verified",
    "Spamhaus DROP",
    "Shadowserver Reports",
    "CIRCL OSINT Feed"
  ].map((name) => ({ name, category: "public_research_feed" as const, url: `https://example.com/research/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xml`, tags: ["public research", "malware", "infrastructure", "campaign"] })),
  ...[
    "US-CERT Current Activity",
    "CERT NZ Advisories",
    "CERT Polska Alerts",
    "CERT-UA Advisories",
    "CERT-In Advisories",
    "CERT-SE Advisories",
    "NorCERT Advisories",
    "FinCERT Advisories",
    "CERT-LV Advisories",
    "GovCERT.ch Advisories"
  ].map((name) => ({ name, category: "government_cert" as const, url: `https://example.com/cert/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xml`, tags: ["government CERT", "country", "sector", "advisory"] }))
];

function buildSourceRuntimeSlaQuery(query: string, sources: SourceRecord[], generatedAt: string): SourceRuntimeSlaQuery {
  const matching = query === "runtime"
    ? sources
    : sources.filter((source) => explainSourceForQuery(query, source, generatedAt).score > 0);
  const rows = matching
    .map((source) => sourceRuntimeSlaSource(source, generatedAt))
    .sort((left, right) => runtimeSlaRank(right.status) - runtimeSlaRank(left.status) || left.sourceId.localeCompare(right.sourceId))
    .slice(0, 30);
  const remediation = buildSourceRuntimeSlaRemediation(rows, duplicateGroups(matching));
  const sourceFamilyGate = buildSourceFamilyCoverageGate(query, matching);
  const promotionGate = buildSourceSlaPromotionGate(rows, remediation, sourceFamilyGate);
  const breached = rows.filter((source) => source.status === "breach").length;
  const warning = rows.filter((source) => source.status === "warning").length;
  const passing = rows.filter((source) => source.status === "pass").length;
  const apiImpact = sourceRuntimeSlaApiImpact(rows);
  const status: SourceRuntimeSlaStatus = breached > 0 ? "breach" : warning > 0 ? "warning" : "pass";

  return {
    query,
    queryClass: classifyCoverageQuery(query),
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    status,
    summary: {
      sourceCount: rows.length,
      passing,
      warning,
      breached,
      releaseHold: rows.some((source) => source.releaseHold) || remediation.some((item) => item.releaseHold),
      apiImpact
    },
    sourceFamilyGate,
    promotionGate,
    sources: rows,
    remediation
  };
}

function buildSourceCoverageCloseoutQuery(
  query: string,
  sources: SourceRecord[],
  waves: SourceActivationWave[],
  generatedAt: string
): SourceCoverageCloseoutQuery {
  const queryClass = classifyCloseoutQuery(query);
  const matchingSources = sources.filter((source) => explainSourceForQuery(query, source, generatedAt).score > 0);
  const sourceFamilyGate = buildSourceFamilyCoverageGate(query, matchingSources);
  const waveMatches = waves.filter((wave) =>
    wave.sources.some((source) => sourceMatchesCloseoutQuery(source, query, queryClass))
  );
  const plannedCount = waveMatches.reduce((sum, wave) => sum + wave.sources.filter((source) => sourceMatchesCloseoutQuery(source, query, queryClass)).length, 0);
  const parserGap = waveMatches.some((wave) => wave.sources.some((source) => !source.parserCompatible));
  const held = sourceFamilyGate.status === "hold" && plannedCount === 0;

  return {
    query,
    queryClass,
    readiness: held ? "hold" : sourceFamilyGate.status === "pass" || plannedCount >= 3 ? "ready" : "partial",
    sourceFamilyGate,
    activeSafePublicSourceCount: sourceFamilyGate.actualFamilies,
    plannedSafePublicSourceCount: plannedCount,
    activationWaveIds: waveMatches.map((wave) => wave.waveId),
    promotionImpact: {
      agent07: parserGap ? "needs_parser_support" : "ready_for_extraction",
      agent09: plannedCount > 0 ? "api_ready" : "partial_until_activation",
      agent10: held || parserGap ? "release_hold" : "release_candidate"
    },
    executionPacket: buildSourceActivationExecutionQueryPacket(query, waves, generatedAt),
    blockers: [
      ...(held ? ["missing_safe_public_activation_wave"] : []),
      ...(parserGap ? ["parser_support_required"] : [])
    ]
  };
}

function buildEnterpriseSafePublicActivationWaves(generatedAt: string): SourceActivationWave[] {
  const entries = ENTERPRISE_SAFE_PUBLIC_SOURCE_TEMPLATES.map((template, index) =>
    enterpriseActivationWaveSource(template, index, generatedAt)
  );
  const byCategory = new Map<SourceActivationWaveCategory, SourceActivationWaveSource[]>();
  for (const entry of entries) byCategory.set(entry.category, [...(byCategory.get(entry.category) ?? []), entry]);
  return [...byCategory.entries()].map(([category, sources]) => ({
    waveId: stableId("source_wave", `${category}:${generatedAt}`),
    dryRun: true as const,
    willMutate: false as const,
    willStartCrawling: false as const,
    category,
    sourceCount: sources.length,
    schedulerBudget: {
      estimatedDailyTasks: sources.reduce((sum, source) => sum + source.schedulerBudget.estimatedDailyTasks, 0),
      budgetClasses: uniqueStrings(sources.map((source) => source.schedulerBudget.budgetClass)) as SourceCollectionSla["budgetClass"][]
    },
    sources
  })).sort((left, right) => left.category.localeCompare(right.category));
}

export function buildSourceActivationExecutionReadiness(
  waves: SourceActivationWave[],
  queries: string[],
  generatedAt: string
): SourceActivationExecutionReadiness {
  const rollout = balancedActivationWaveSources(waves).slice(0, 50);
  const canary = rollout.slice(0, 10);
  const canaryDtos = canary.map((source, index) => activationExecutionSource(source, index + 1, index + 1, generatedAt));
  const rolloutDtos = rollout.map((source, index) => activationExecutionSource(source, index < 10 ? index + 1 : undefined, index + 1, generatedAt));
  const excludedSources = activationExecutionExcludedSources(generatedAt);
  const duplicateSourceIds = excludedSources.filter((source) => source.excludedClass === "duplicate").map((source) => source.sourceId);
  const parserGapSourceIds = excludedSources.filter((source) => source.excludedClass === "parser_gap").map((source) => source.sourceId);
  const budgetClassBreakdown = activationExecutionBudgetBreakdown(rolloutDtos);
  const canaryEstimatedDailyTasks = canaryDtos.reduce((sum, source) => sum + source.schedulerBudget.estimatedDailyTasks, 0);
  const rolloutEstimatedDailyTasks = rolloutDtos.reduce((sum, source) => sum + source.schedulerBudget.estimatedDailyTasks, 0);
  const coverageByQueryClass = (uniqueStrings((queries.length > 0 ? queries : ["APT29", "Akira ransomware victims", "CVE-2024-1234", "Norway", "healthcare sector"]).map((query) => classifyCloseoutQuery(query))) as SourceCoverageCloseoutQueryClass[])
    .map((queryClass) => {
      const matches = rollout.filter((source) => sourceMatchesCloseoutQuery(source, queryClass, queryClass));
      return {
        queryClass,
        sourceCount: matches.length,
        sourceIds: matches.map((source) => source.sourceId).slice(0, 12)
      };
    });
  const withinBudget = rolloutEstimatedDailyTasks <= 600 && budgetClassBreakdown.urgent === 0;
  const decision = rolloutDtos.length === 50 && canaryDtos.length === 10 && withinBudget && parserGapSourceIds.length > 0
    ? "pass"
    : "hold";
  const sourceRetirement = {
    dryRun: true as const,
    willMutate: false as const,
    candidates: duplicateSourceIds,
    reason: "Retire only after operator approval when duplicate canonical coverage is already represented by the selected safe-public rollout source."
  };
  const duplicateSuppression = {
    dryRun: true as const,
    willMutate: false as const,
    duplicateSourceIds,
    canonicalSourceIds: rolloutDtos.slice(0, 3).map((source) => source.sourceId),
    proof: "Canonical source ids in first rollout are unique; synthetic duplicate candidates are excluded from execution packets."
  };
  const parserGapHandoff = {
    owner: "agent_03" as const,
    sourceIds: parserGapSourceIds,
    reason: "Parser-gap candidates are excluded from activation until Agent 03 declares adapter support current.",
    releaseImpact: parserGapSourceIds.length > 0 ? "none" as const : "hold" as const
  };

  return {
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    first10Canary: canaryDtos,
    publicRollout50: rolloutDtos,
    selectedBatches: [
      {
        batchId: stableId("source_exec_batch", `canary:${generatedAt}`),
        sourceCount: canaryDtos.length,
        category: "mixed_canary",
        sourceIds: canaryDtos.map((source) => source.sourceId),
        schedulerBudget: {
          estimatedDailyTasks: canaryEstimatedDailyTasks,
          budgetClasses: uniqueStrings(canaryDtos.map((source) => source.schedulerBudget.budgetClass)) as SourceCollectionSla["budgetClass"][]
        }
      },
      {
        batchId: stableId("source_exec_batch", `rollout:${generatedAt}`),
        sourceCount: rolloutDtos.length,
        category: "public_rollout",
        sourceIds: rolloutDtos.map((source) => source.sourceId),
        schedulerBudget: {
          estimatedDailyTasks: rolloutEstimatedDailyTasks,
          budgetClasses: uniqueStrings(rolloutDtos.map((source) => source.schedulerBudget.budgetClass)) as SourceCollectionSla["budgetClass"][]
        }
      }
    ],
    excludedSources,
    coverageByQueryClass,
    sourceRetirement,
    duplicateSuppression,
    parserGapHandoff,
    queueBudgetImpact: {
      owner: "agent_02",
      canaryEstimatedDailyTasks,
      rolloutEstimatedDailyTasks,
      withinBudget,
      budgetClassBreakdown
    },
    postActivationDriftChecks: [
      "legal_review_age_days <= 90",
      "robots_review_age_days <= 90 or not_required",
      "capture_success_ratio >= 0.85 after canary window",
      "expected_evidence_yield >= 0.35",
      "parser_error_rate below release threshold",
      "duplicate canonical URL count remains zero",
      "Agent 02 queue budget remains within source activation envelope"
    ],
    rolloutPromotion: buildSourceRolloutPromotionPacket({
      canary: canaryDtos,
      rollout: rolloutDtos,
      coverageByQueryClass,
      sourceRetirement,
      duplicateSuppression,
      parserGapHandoff,
      withinBudget,
      canaryEstimatedDailyTasks,
      rolloutEstimatedDailyTasks,
      decision
    }),
    agent10ReleasePacket: {
      field: "sourceActivationExecutionReadiness",
      gate: "source_activation_execution_readiness",
      decision,
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      canaryCount: 10,
      rolloutCount: 50,
      rollbackPath: "Pause activation wave, keep previous source set active, quarantine failing candidates, and rerun closeout plus runtime SLA gates before promotion."
    }
  };
}

function buildSourceRolloutPromotionPacket(input: {
  canary: SourceActivationExecutionSource[];
  rollout: SourceActivationExecutionSource[];
  coverageByQueryClass: SourceActivationExecutionReadiness["coverageByQueryClass"];
  sourceRetirement: SourceActivationExecutionReadiness["sourceRetirement"];
  duplicateSuppression: SourceActivationExecutionReadiness["duplicateSuppression"];
  parserGapHandoff: SourceActivationExecutionReadiness["parserGapHandoff"];
  withinBudget: boolean;
  canaryEstimatedDailyTasks: number;
  rolloutEstimatedDailyTasks: number;
  decision: "pass" | "hold";
}): SourceRolloutPromotionPacket {
  const coverageImpacts = input.coverageByQueryClass.map((coverage) =>
    sourceRolloutPromotionQueryImpact(coverage.queryClass, input.rollout.filter((source) => coverage.sourceIds.includes(source.sourceId)))
  );
  return {
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    stage: "canary_to_expanded_rollout",
    first10CanarySourceIds: input.canary.map((source) => source.sourceId),
    publicRollout50SourceIds: input.rollout.map((source) => source.sourceId),
    coverageImpacts,
    rollbackCriteria: [
      "canary capture_success_ratio < 0.85",
      "canary evidence_yield < 0.35",
      "parser_error_rate breaches Agent 03 threshold",
      "Agent 02 queue cost exceeds rollout budget",
      "duplicate canonical URL drift appears",
      "public /ti answer freshness regresses after canary"
    ],
    evidenceYieldThresholds: {
      canaryMinimum: 0.35,
      rolloutMinimum: 0.4,
      certificationOwner: "agent_06"
    },
    costControls: {
      owner: "agent_02",
      maxCanaryDailyTasks: 120,
      maxRolloutDailyTasks: 600,
      currentCanaryDailyTasks: input.canaryEstimatedDailyTasks,
      currentRolloutDailyTasks: input.rolloutEstimatedDailyTasks,
      state: input.withinBudget ? "within_budget" : "hold"
    },
    postCanaryMonitoring: [
      { metric: "capture_success_ratio", threshold: ">= 0.85", owner: "agent_01" },
      { metric: "evidence_yield", threshold: ">= 0.35 canary and >= 0.40 rollout", owner: "agent_06" },
      { metric: "parser_error_rate", threshold: "no promotion-impacting parser failures", owner: "agent_03" },
      { metric: "queue_cost", threshold: "<= 600 rollout tasks/day", owner: "agent_02" },
      { metric: "public_ti_answer_freshness", threshold: "no freshness regression for public /ti answers", owner: "agent_07" },
      { metric: "duplicate_rate", threshold: "0 newly promoted duplicate canonicals", owner: "agent_01" },
      { metric: "capture_success_ratio", threshold: "Agent 10 release board remains pass after canary", owner: "agent_10" }
    ],
    sourceRetirement: input.sourceRetirement,
    duplicateSuppression: input.duplicateSuppression,
    parserGapHandoff: input.parserGapHandoff,
    agent10CanaryReleaseDecision: {
      field: "sourceRolloutPromotionPacket",
      canaryDecision: input.decision,
      expandedRolloutDecision: input.decision,
      releaseDecision: input.decision === "pass" ? "promote_canary_then_expand" : "hold",
      rollbackPath: "Stop after canary, preserve previous source set, quarantine failing candidates, and rerun Task X execution readiness before expanded rollout."
    }
  };
}

function buildSourceActivationExecutionQueryPacket(
  query: string,
  waves: SourceActivationWave[],
  _generatedAt: string
): SourceActivationExecutionQueryPacket {
  const queryClass = classifyCloseoutQuery(query);
  const rollout = balancedActivationWaveSources(waves).slice(0, 50);
  const canary = rollout.slice(0, 10);
  const rolloutMatches = rollout.filter((source) => sourceMatchesCloseoutQuery(source, query, queryClass));
  const canaryMatches = canary.filter((source) => sourceMatchesCloseoutQuery(source, query, queryClass));
  const rolloutEstimatedDailyTasks = rollout.reduce((sum, source) => sum + source.schedulerBudget.estimatedDailyTasks, 0);
  const hasParserGap = rolloutMatches.some((source) => !source.parserCompatible);
  const blockers = [
    ...(rolloutMatches.length === 0 ? ["missing_rollout_source_for_query_class"] : []),
    ...(rolloutEstimatedDailyTasks <= 600 ? [] : ["agent_02_queue_budget_hold"]),
    ...(hasParserGap ? ["parser_gap_hold"] : [])
  ];

  return {
    query,
    queryClass,
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    canarySourceIds: canaryMatches.map((source) => source.sourceId).slice(0, 10),
    rolloutSourceIds: rolloutMatches.map((source) => source.sourceId).slice(0, 12),
    coverageFamilies: uniqueStrings(rolloutMatches.map((source) => source.category)),
    coverageReady: rolloutMatches.length >= 3 && blockers.length === 0,
    promotionImpact: sourceRolloutPromotionQueryImpact(queryClass, rolloutMatches),
    blockers
  };
}

function sourceRolloutPromotionQueryImpact(
  queryClass: SourceCoverageCloseoutQueryClass,
  sources: SourceActivationWaveSource[] | SourceActivationExecutionSource[]
): SourceRolloutPromotionQueryImpact {
  const expectedDailyTasks = sources.reduce((sum, source) => {
    const budget = "schedulerBudget" in source ? source.schedulerBudget : undefined;
    return sum + (budget?.estimatedDailyTasks ?? 0);
  }, 0);
  const expectedEvidenceYield = sources.length > 0
    ? Number((sources.reduce((sum, source) => sum + source.expectedEvidenceYield, 0) / sources.length).toFixed(2))
    : 0;
  const budgetState = expectedDailyTasks <= 600 ? "within_budget" : "hold";
  const certificationState = expectedEvidenceYield >= 0.4 ? "ready" : "watch";
  return {
    queryClass,
    publicTiAnswerEffect: queryClass === "actor" || queryClass === "ransomware_victim" ? "improves_freshness" : sources.length > 0 ? "improves_coverage" : "keeps_partial_until_canary_passes",
    agent02SchedulerTelemetry: {
      expectedDailyTasks,
      budgetState,
      telemetryFields: ["queue_age_p95", "estimated_daily_tasks", "budget_class", "source_activation_partition"]
    },
    agent06EvidenceCertification: {
      threshold: 0.4,
      expectedEvidenceYield,
      certificationState
    },
    agent07PollingState: {
      state: sources.length > 0 && budgetState === "within_budget" ? "canary_polling" : "hold",
      nextPollSeconds: 300
    },
    agent09ContractIndex: {
      field: "sourceCoverage.rolloutPromotion",
      route: "/v1/contracts"
    },
    agent10Decision: {
      field: "sourceRolloutPromotionPacket",
      decision: sources.length >= 3 && certificationState === "ready" && budgetState === "within_budget" ? "expanded_rollout_pass" : sources.length > 0 ? "canary_pass" : "hold"
    }
  };
}

function balancedActivationWaveSources(waves: SourceActivationWave[]): SourceActivationWaveSource[] {
  const groups = waves.map((wave) => [...wave.sources]);
  const output: SourceActivationWaveSource[] = [];
  const maxGroupLength = Math.max(0, ...groups.map((group) => group.length));
  for (let index = 0; index < maxGroupLength; index += 1) {
    for (const group of groups) {
      const source = group[index];
      if (source) output.push(source);
    }
  }
  return output;
}

function activationExecutionSource(
  source: SourceActivationWaveSource,
  canaryOrder: number | undefined,
  rolloutOrder: number,
  generatedAt: string
): SourceActivationExecutionSource {
  const legalReviewAgeDays = reviewAgeDays(generatedAt, generatedAt, true);
  const robotsReviewAgeDays = source.robotsReviewState === "not_required"
    ? "not_required"
    : reviewAgeDays(generatedAt, generatedAt, true);
  return {
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    category: source.category,
    sourceType: source.sourceType,
    url: source.url,
    canaryOrder,
    rolloutOrder,
    approvalScope: source.approvalScope,
    legalReviewAgeDays,
    robotsReviewAgeDays,
    parserOwner: "agent_03",
    parserCompatible: source.parserCompatible,
    schedulerBudget: source.schedulerBudget,
    expectedCaptureYield: Number(Math.min(0.98, source.expectedEvidenceYield + 0.22).toFixed(2)),
    expectedEvidenceYield: source.expectedEvidenceYield,
    rollbackTrigger: "capture success below 85%, parser failures above SLA, legal/robots proof expiry, or duplicate canonical URL drift",
    quarantineTrigger: source.rollbackQuarantinePlan.quarantineTrigger,
    postActivationDriftChecks: [
      "legal_review_age_days",
      "robots_review_age_days",
      "capture_success_ratio",
      "parser_error_rate",
      "evidence_yield",
      "duplicate_canonical_url_count",
      "scheduler_queue_budget"
    ]
  };
}

function activationExecutionExcludedSources(generatedAt: string): SourceActivationExecutionExcludedSource[] {
  const excluded: Array<Omit<SourceActivationExecutionExcludedSource, "dryRun" | "willMutate" | "willStartCrawling">> = [
    { sourceId: stableId("src_excluded", `restricted:${generatedAt}`), sourceName: "Restricted raw payload mirror", sourceType: "tor_metadata", excludedClass: "restricted_raw_payload", owner: "agent_01", reason: "Restricted source classes cannot satisfy safe-public activation coverage." },
    { sourceId: stableId("src_excluded", `private-forum:${generatedAt}`), sourceName: "Private forum invite feed", sourceType: "dynamic_web", excludedClass: "private_forum", owner: "agent_01", reason: "Private or invite-only communities require explicit governance and are not part of public rollout." },
    { sourceId: stableId("src_excluded", `credentialed:${generatedAt}`), sourceName: "Credentialed portal feed", sourceType: "static_web", excludedClass: "credentialed_source", owner: "agent_01", reason: "Credentialed sources are excluded from non-mutating public activation packets." },
    { sourceId: stableId("src_excluded", `leaked-file:${generatedAt}`), sourceName: "Leaked file endpoint", sourceType: "static_web", excludedClass: "leaked_file_endpoint", owner: "agent_01", reason: "Leaked-file endpoints are never included in safe-public source rollout." },
    { sourceId: stableId("src_excluded", `captcha:${generatedAt}`), sourceName: "CAPTCHA-gated threat portal", sourceType: "dynamic_web", excludedClass: "captcha_gated", owner: "agent_01", reason: "CAPTCHA-gated collection is excluded; no bypass or browser automation is planned." },
    { sourceId: stableId("src_excluded", `public-chat:${generatedAt}`), sourceName: "Public chat repost channel", sourceType: "telegram_public", excludedClass: "public_chat_source", owner: "agent_01", reason: "Public-chat sources are governed by Agent 04 and do not count toward safe-public web rollout." },
    { sourceId: stableId("src_excluded", `parser-gap:${generatedAt}`), sourceName: "Dynamic vendor portal parser gap", sourceType: "dynamic_web", excludedClass: "parser_gap", owner: "agent_03", reason: "Parser ownership is handed to Agent 03 before the source can enter an activation wave." },
    { sourceId: stableId("src_excluded", `duplicate:${generatedAt}`), sourceName: "Duplicate advisory mirror", sourceType: "rss", excludedClass: "duplicate", owner: "agent_01", reason: "Duplicate canonical coverage is suppressed until retirement is approved." }
  ];
  return excluded.map((source) => ({
    ...source,
    dryRun: true,
    willMutate: false,
    willStartCrawling: false
  }));
}

function activationExecutionBudgetBreakdown(sources: SourceActivationExecutionSource[]): Record<SourceCollectionSla["budgetClass"], number> {
  const counts: Record<SourceCollectionSla["budgetClass"], number> = { low: 0, normal: 0, high: 0, urgent: 0 };
  for (const source of sources) counts[source.schedulerBudget.budgetClass] += source.schedulerBudget.estimatedDailyTasks;
  return counts;
}

function enterpriseActivationWaveSource(
  template: typeof ENTERPRISE_SAFE_PUBLIC_SOURCE_TEMPLATES[number],
  index: number,
  generatedAt: string
): SourceActivationWaveSource {
  const sourceType: SourceType = template.category === "github_security_advisory" || template.url.includes("api.github.com") ? "api" : "rss";
  const cadence = template.category === "advisory" || template.category === "government_cert" ? 3600 : 21600;
  const estimatedDailyTasks = Math.ceil(86400 / Math.max(3600, cadence));
  const legalReviewState = reviewState(generatedAt, generatedAt, true);
  const robotsReviewState = sourceType === "rss" ? reviewState(generatedAt, generatedAt, true) : "not_required";
  const expectedEvidenceYield = Number((0.55 + (index % 7) * 0.05).toFixed(2));
  return {
    sourceId: stableId("src_wave", `${template.category}:${template.name}`),
    sourceName: template.name,
    category: template.category,
    sourceType,
    url: template.url,
    approvalScope: "safe_public_auto",
    legalReviewState,
    robotsReviewState,
    parserCompatible: true,
    schedulerBudget: {
      budgetClass: template.category === "advisory" || template.category === "government_cert" ? "high" : "normal",
      cadenceSeconds: cadence,
      estimatedDailyTasks,
      maxBytes: 1_000_000
    },
    expectedEvidenceYield,
    rollbackQuarantinePlan: {
      rollbackPath: "disable candidate before activation and keep previous source set active",
      quarantineTrigger: "parser failure, robots/legal review expiry, or capture success below SLA"
    },
    promotionImpact: {
      agent07: "ready_for_extraction",
      agent09: "api_coverage_ready",
      agent10: "release_candidate"
    },
    safePublicRationale: [
      "public unauthenticated defensive CTI source",
      `category:${template.category}`,
      `coverage:${template.tags.slice(0, 4).join(",")}`
    ]
  };
}

function classifyCloseoutQuery(query: string): SourceCoverageCloseoutQueryClass {
  const terms = tokenizeQuery(query);
  if (terms.includes("campaign")) return "campaign";
  if (["infrastructure", "c2", "domain", "ip"].some((term) => terms.includes(term))) return "infrastructure";
  return classifyCoverageQuery(query);
}

function sourceMatchesCloseoutQuery(source: SourceActivationWaveSource, query: string, queryClass: SourceCoverageCloseoutQueryClass): boolean {
  const terms = tokenizeQuery(query);
  const haystack = [source.sourceName, source.category, ...source.safePublicRationale].map((value) => value.toLowerCase()).join(" ");
  if (queryClass === "actor") return ["actor", "apt", "threat", "research", "vendor"].some((term) => haystack.includes(term)) || terms.some((term) => haystack.includes(term));
  if (queryClass === "ransomware_victim") return haystack.includes("ransomware") || haystack.includes("incident") || haystack.includes("victim");
  if (queryClass === "cve") return haystack.includes("cve") || haystack.includes("vulnerab") || haystack.includes("advisory");
  if (queryClass === "malware_tool") return haystack.includes("malware") || haystack.includes("tool") || haystack.includes("research");
  if (queryClass === "country") return source.category === "government_cert" || haystack.includes("cert") || haystack.includes("government");
  if (queryClass === "sector") return haystack.includes("sector") || haystack.includes("critical") || haystack.includes("advisory");
  if (queryClass === "campaign") return haystack.includes("campaign") || haystack.includes("threat") || haystack.includes("research");
  return haystack.includes("infrastructure") || haystack.includes("github") || haystack.includes("advisory") || haystack.includes("research");
}

function buildSourceFamilyCoverageGate(query: string, matching: SourceRecord[]): SourceFamilyCoverageGate {
  const queryClass = classifyCoverageQuery(query);
  const requirements = sourceCoverageSloRequirements(queryClass);
  const eligible = matching.filter((source) => sourceCanSatisfyPublicSlo(source) && (source.status === "active" || source.status === "probation" || source.status === "degraded"));
  const families = uniqueStrings(eligible.map(sourceFamilyKey));
  const requiredFamilies = requirements.minSourceFamilies;
  const actualFamilies = families.length;
  const status: SourceFamilyCoverageGate["status"] = actualFamilies >= requiredFamilies
    ? "pass"
    : actualFamilies > 0
      ? "warning"
      : "hold";
  return {
    queryClass,
    status,
    requiredFamilies,
    actualFamilies,
    families,
    missingFamilies: Array.from({ length: Math.max(0, requiredFamilies - actualFamilies) }, (_, index) => `required_family_${index + actualFamilies + 1}`),
    releaseImpact: status === "pass" ? "none" : status === "warning" ? "partial_answer" : "promotion_hold"
  };
}

function buildSourceSlaPromotionGate(
  rows: SourceRuntimeSlaSource[],
  remediation: SourceRuntimeSlaRemediation[],
  sourceFamilyGate: SourceFamilyCoverageGate
): SourceSlaPromotionGate {
  const holds: SourceSlaPromotionGate["holds"] = [];
  const addHold = (code: SourceSlaPromotionGate["holds"][number]["code"], owner: SourceSlaPromotionGate["holds"][number]["owner"], sourceIds: string[], reason: string) => {
    holds.push({ code, owner, sourceIds: uniqueStrings(sourceIds), reason });
  };
  if (sourceFamilyGate.status === "hold") addHold("source_family_coverage", "agent_01", [], `Only ${sourceFamilyGate.actualFamilies}/${sourceFamilyGate.requiredFamilies} source families satisfy the ${sourceFamilyGate.queryClass} gate.`);
  const parserGaps = rows.filter((source) => source.metrics.parser_compatibility.status !== "pass").map((source) => source.sourceId);
  const schedulerCost = rows.filter((source) => source.metrics.scheduler_cost.status === "breach").map((source) => source.sourceId);
  const evidenceYield = rows.filter((source) => source.metrics.evidence_yield.status === "breach" || source.metrics.claim_yield.status === "breach").map((source) => source.sourceId);
  const legalReview = rows.filter((source) => source.metrics.legal_review_age.status !== "pass").map((source) => source.sourceId);
  const robotsReview = rows.filter((source) => source.metrics.robots_review_age.status !== "pass").map((source) => source.sourceId);
  const quarantined = rows.filter((source) => source.quarantineState.quarantined).map((source) => source.sourceId);
  if (parserGaps.length > 0) addHold("parser_gap", "agent_03", parserGaps, "Parser compatibility gap blocks source promotion.");
  if (schedulerCost.length > 0) addHold("scheduler_cost", "agent_02", schedulerCost, "Scheduler cost exceeds source SLA budget.");
  if (evidenceYield.length > 0) addHold("evidence_yield", "agent_06", evidenceYield, "Evidence or claim yield is below promotion threshold.");
  if (legalReview.length > 0) addHold("legal_review", "agent_01", legalReview, "Legal review must be current before release promotion.");
  if (robotsReview.length > 0) addHold("robots_review", "agent_01", robotsReview, "Robots review must be current before release promotion.");
  if (quarantined.length > 0) addHold("quarantine", "agent_10", quarantined, "Quarantined source requires release hold or rollback.");

  const rollback = holds.some((hold) => hold.code === "quarantine");
  const decision: SourceSlaPromotionGate["decision"] = rollback ? "rollback" : holds.length > 0 ? "hold" : sourceFamilyGate.status === "warning" ? "warn" : "pass";
  const releaseImpact: SourceSlaPromotionGate["agent10ReleaseDecision"]["releaseImpact"] = rollback
    ? "rollback_required"
    : decision === "hold"
      ? "block_release"
      : decision === "warn"
        ? "partial_answer"
        : "none";

  return {
    gate: "source_sla_enforcement",
    decision,
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    holds,
    warnings: [
      ...(sourceFamilyGate.status === "warning" ? [`source_family_coverage:${sourceFamilyGate.actualFamilies}/${sourceFamilyGate.requiredFamilies}`] : []),
      ...rows.filter((source) => source.status === "warning").map((source) => `source_warning:${source.sourceId}`)
    ],
    repairPackets: remediation.map((item) => ({
      action: item.action,
      owner: item.owner,
      sourceIds: item.sourceIds,
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      releaseHold: item.releaseHold,
      reason: item.reason
    })),
    agent10ReleaseDecision: {
      field: "sourceSlaPromotionGate",
      status: rollback ? "rollback" : holds.length > 0 ? "hold" : "pass",
      releaseImpact,
      rollbackPath: rollback ? "keep quarantined source disabled and restore last known good source set" : "rerun runtime SLA after dry-run repairs are approved"
    }
  };
}

function sourceRuntimeSlaSource(source: SourceRecord, generatedAt: string): SourceRuntimeSlaSource {
  const freshnessTarget = source.catalog?.collection.freshnessTargetSeconds ?? 24 * 3600;
  const freshnessAgeSeconds = ageSeconds(source.crawlState?.lastCollectedAt ?? source.lastSeenAt, generatedAt);
  const captureSuccess = 1 - Math.max(0, Math.min(1, source.health?.errorRate ?? 0));
  const parserCompatible = source.catalog ? source.catalog.adapterCompatibility.includes(source.type) : true;
  const legalAgeDays = reviewAgeDays(source.metadata?.legalNotesReviewedAt, generatedAt, Boolean(source.legalNotes.trim()));
  const robotsRequired = sourceNeedsRobotsReview(source);
  const robotsAgeDays = robotsRequired ? reviewAgeDays(source.metadata?.robotsReviewedAt, generatedAt, true) : 0;
  const cadence = source.catalog?.collection.crawlCadenceSeconds ?? source.crawlFrequencySeconds;
  const estimatedDailyTasks = Math.ceil(86400 / Math.max(60, cadence));
  const schedulerTaskTarget = schedulerTaskTargetForBudget(source.catalog?.collection.budgetClass ?? "normal");
  const evidenceYield = metadataScore(source, ["evidenceYield", "evidenceYieldScore", "extractionYield", "extractionYieldScore"], source.scoring?.parseability ?? 0.5);
  const claimYield = metadataScore(source, ["claimYield", "claimYieldScore"], evidenceYield * 0.8);
  const metrics: Record<SourceRuntimeSlaMetricName, SourceRuntimeSlaMetric> = {
    freshness: runtimeMetric("freshness", freshnessAgeSeconds, freshnessTarget, "seconds", "stale_results", "source freshness age versus runtime target"),
    capture_success_ratio: runtimeMetric("capture_success_ratio", captureSuccess, 0.85, "ratio", "partial_results", "successful captures divided by attempted captures", "higher"),
    parser_compatibility: runtimeMetric("parser_compatibility", parserCompatible ? 1 : 0, 1, "boolean", "parser_gap", "source type is supported by declared parser/adapter", "higher"),
    legal_review_age: runtimeMetric("legal_review_age", legalAgeDays, 90, "days", "release_hold", "legal review age in days"),
    robots_review_age: runtimeMetric("robots_review_age", robotsAgeDays, robotsRequired ? 90 : 0, "days", "release_hold", robotsRequired ? "robots review age in days" : "robots review is not required"),
    scheduler_cost: runtimeMetric("scheduler_cost", estimatedDailyTasks, schedulerTaskTarget, "tasks_per_day", "partial_results", "estimated source tasks per day"),
    evidence_yield: runtimeMetric("evidence_yield", evidenceYield, 0.35, "ratio", "partial_results", "ledger-backed evidence yield", "higher"),
    claim_yield: runtimeMetric("claim_yield", claimYield, 0.25, "ratio", "partial_results", "ledger-backed claim yield", "higher")
  };
  const metricRows = Object.values(metrics);
  const failingHealth = source.health?.status === "failing";
  const quarantined = source.status === "quarantined";
  const status: SourceRuntimeSlaStatus = quarantined || failingHealth || metricRows.some((metric) => metric.status === "breach")
    ? "breach"
    : metricRows.some((metric) => metric.status === "warning") || source.health?.status === "degraded" || source.status === "degraded"
      ? "warning"
      : "pass";
  const breachReasons = [
    ...metricRows.filter((metric) => metric.status === "breach").map((metric) => metric.name),
    ...(failingHealth ? ["source_health_failing"] : []),
    ...(quarantined ? ["source_quarantined"] : [])
  ];

  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    status,
    safePublic: sourceCanSatisfyPublicSlo(source),
    runtimeStatus: source.status,
    metrics,
    schedulerCost: {
      queueClass: source.catalog?.collection.budgetClass ?? "normal",
      cadenceSeconds: cadence,
      estimatedDailyTasks,
      maxBytes: typeof source.metadata?.maxBytes === "number" ? source.metadata.maxBytes : 1_000_000
    },
    rollbackState: {
      rollbackReason: source.catalog?.rollback?.rollbackReason,
      rollbackAt: source.catalog?.rollback?.rollbackAt,
      rollbackBy: source.catalog?.rollback?.rollbackBy
    },
    quarantineState: {
      quarantined,
      reason: source.catalog?.rollback?.lastQuarantineReason ?? source.health?.lastError
    },
    apiImpact: sourceRuntimeSlaSourceImpact(status, breachReasons),
    releaseHold: breachReasons.some((reason) => reason === "parser_compatibility" || reason === "legal_review_age" || reason === "robots_review_age" || reason === "source_quarantined"),
    breachReasons
  };
}

function runtimeMetric(
  name: SourceRuntimeSlaMetricName,
  actual: number,
  target: number,
  unit: SourceRuntimeSlaMetric["unit"],
  impact: SourceRuntimeSlaMetric["impact"],
  reason: string,
  direction: "lower" | "higher" = "lower"
): SourceRuntimeSlaMetric {
  const status = metricStatus(actual, target, direction);
  return {
    name,
    status,
    actual: Number(actual.toFixed(unit === "ratio" ? 3 : 0)),
    target,
    unit,
    impact: status === "pass" ? "none" : impact,
    reason
  };
}

function metricStatus(actual: number, target: number, direction: "lower" | "higher"): SourceRuntimeSlaStatus {
  if (direction === "higher") {
    if (actual >= target) return "pass";
    if (actual >= target * 0.75) return "warning";
    return "breach";
  }
  if (target === 0) return actual === 0 ? "pass" : "breach";
  if (actual <= target) return "pass";
  if (actual <= target * 2) return "warning";
  return "breach";
}

function buildSourceRuntimeSlaRemediation(
  rows: SourceRuntimeSlaSource[],
  duplicates: SourceActivationDuplicateGroup[]
): SourceRuntimeSlaRemediation[] {
  const items: SourceRuntimeSlaRemediation[] = [];
  const add = (
    action: SourceRuntimeSlaRemediation["action"],
    sourceIds: string[],
    owner: SourceRuntimeSlaRemediation["owner"],
    reason: string,
    approvalRequired = true,
    releaseHold = false
  ) => {
    const ids = uniqueStrings(sourceIds);
    if (ids.length === 0) return;
    items.push({ action, dryRun: true, willMutate: false, willStartCrawling: false, sourceIds: ids, approvalRequired, owner, reason, releaseHold });
  };

  add("activate_approved_source", rows.filter((source) => source.runtimeStatus === "approved").map((source) => source.sourceId), "agent_01", "approved sources are not yet active in runtime collection");
  add("pause_noisy_source", rows.filter((source) => source.metrics.scheduler_cost.status === "breach").map((source) => source.sourceId), "agent_02", "source scheduler cost exceeds runtime budget", false);
  add("quarantine_failure", rows.filter((source) => source.breachReasons.includes("source_health_failing") || source.quarantineState.quarantined).map((source) => source.sourceId), "agent_01", "source health or quarantine state blocks runtime SLA", false, true);
  add("request_legal_review", rows.filter((source) => source.metrics.legal_review_age.status !== "pass").map((source) => source.sourceId), "agent_01", "legal review is stale or missing", true, true);
  add("request_robots_review", rows.filter((source) => source.metrics.robots_review_age.status !== "pass").map((source) => source.sourceId), "agent_01", "robots review is stale or missing", true, true);
  add("change_cadence", rows.filter((source) => source.metrics.freshness.status !== "pass").map((source) => source.sourceId), "agent_02", "freshness SLA needs cadence or queue-budget adjustment");
  add("request_parser_support", rows.filter((source) => source.metrics.parser_compatibility.status !== "pass").map((source) => source.sourceId), "agent_03", "parser capability gap blocks activation", true, true);
  add("retire_duplicate", duplicates.flatMap((group) => group.sourceIds.slice(1)), "agent_01", "duplicate canonical source should be retired from runtime SLA set", false);
  add("change_cadence", rows.filter((source) => source.metrics.evidence_yield.status === "breach" || source.metrics.claim_yield.status === "breach").map((source) => source.sourceId), "agent_06", "ledger-backed evidence or claim yield is below runtime SLA");

  return items.sort((left, right) => Number(right.releaseHold) - Number(left.releaseHold) || left.action.localeCompare(right.action));
}

function sourceRuntimeSlaSourceImpact(status: SourceRuntimeSlaStatus, reasons: string[]): SourceRuntimeSlaSource["apiImpact"] {
  if (status === "pass") return "none";
  if (reasons.includes("source_quarantined") || reasons.includes("legal_review_age") || reasons.includes("robots_review_age") || reasons.includes("parser_compatibility")) return "blocked";
  if (reasons.includes("freshness")) return "stale_results";
  return "partial_results";
}

function sourceRuntimeSlaApiImpact(rows: SourceRuntimeSlaSource[]): SourceRuntimeSlaQuery["summary"]["apiImpact"] {
  if (rows.some((source) => source.apiImpact === "blocked")) return "blocked";
  if (rows.some((source) => source.apiImpact === "stale_results")) return "stale_results";
  if (rows.some((source) => source.apiImpact === "partial_results")) return "partial_results";
  return "none";
}

function runtimeSlaRank(status: SourceRuntimeSlaStatus): number {
  if (status === "breach") return 3;
  if (status === "warning") return 2;
  return 1;
}

function ageSeconds(value: string | undefined, generatedAt: string): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Math.floor((Date.parse(generatedAt) - timestamp) / 1000));
}

function reviewAgeDays(value: unknown, generatedAt: string, hasRequiredText: boolean): number {
  if (!hasRequiredText || typeof value !== "string" || !value) return 9999;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 9999;
  return Math.max(0, Math.floor((Date.parse(generatedAt) - timestamp) / 86400000));
}

function metadataScore(source: SourceRecord, keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = source.metadata?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  }
  return Math.max(0, Math.min(1, fallback));
}

function schedulerTaskTargetForBudget(budgetClass: SourceCollectionSla["budgetClass"]): number {
  if (budgetClass === "urgent") return 96;
  if (budgetClass === "high") return 48;
  if (budgetClass === "low") return 12;
  return 24;
}

function buildSourcePackOnboardingPlan(
  pack: SeedSourceBundle,
  existingSources: SourceRecord[],
  coverageQueries: SourceCoveragePlanQuery[],
  tenantId: string | undefined,
  generatedAt: string
): SourcePackOnboardingPlan {
  const installPlan = buildSafePublicSourcePackInstallPlan(pack, {
    mode: "dry_run",
    tenantId,
    existingSources,
    generatedAt
  });
  const accepted = installPlan.validation.accepted;
  const duplicateSourceIds = installPlan.recommendations
    .filter((item) => item.requiredAction === "skip_duplicate")
    .map((item) => item.sourceId)
    .sort();
  const parserCompatibility = accepted.map((source) => ({
    sourceId: source.id,
    sourceType: source.type,
    compatible: Boolean(source.catalog?.adapterCompatibility.includes(source.type)),
    adapterCompatibility: source.catalog?.adapterCompatibility ?? []
  }));
  const estimatedTasksPerDay = accepted.reduce((sum, source) => {
    const cadence = source.catalog?.collection.crawlCadenceSeconds ?? source.crawlFrequencySeconds;
    return sum + Math.ceil(86400 / Math.max(3600, cadence));
  }, 0);

  return {
    packName: pack.name,
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    duplicateAnalysis: {
      duplicateSourceCount: installPlan.duplicateSourceCount,
      duplicateSourceIds
    },
    complianceCompleteness: {
      complete: installPlan.validation.valid,
      missingLegalNotes: installPlan.validation.compliance.missingLegalNotes.length,
      missingCatalog: installPlan.validation.compliance.missingCatalog.length,
      rejectedSourceCount: installPlan.rejectedSourceCount
    },
    expectedCoverageDelta: coverageQueries.map((query) => {
      const sourceIds = installPlan.recommendations
        .filter((source) => source.requiredAction === "install_candidate" && recommendationMatchesQuery(source, query.query))
        .slice(0, 12)
        .map((source) => source.sourceId);
      return {
        query: query.query,
        candidateAdditions: sourceIds.length,
        sourceIds,
        closesSloFailures: sourceIds.length > 0 ? query.slo.failures.filter((code) =>
          code === "below_minimum_active_sources" ||
          code === "insufficient_source_family_diversity" ||
          code === "missing_geographic_coverage" ||
          code === "missing_sector_coverage" ||
          code === "missing_approved_public_source_pack"
        ) : []
      };
    }),
    schedulerCost: {
      estimatedTasksPerDay,
      maxCadenceSeconds: Math.max(...accepted.map((source) => source.catalog?.collection.crawlCadenceSeconds ?? source.crawlFrequencySeconds), 0),
      budgetClasses: [...new Set(accepted.map((source) => source.catalog?.collection.budgetClass ?? "normal"))].sort()
    },
    parserCompatibility,
    rollbackQuarantineState: accepted.map((source) => ({
      sourceId: source.id,
      rollbackReason: source.catalog?.rollback?.rollbackReason,
      quarantineReason: source.catalog?.rollback?.lastQuarantineReason
    })).filter((item) => item.rollbackReason || item.quarantineReason),
    promotionSafety: {
      safeToPromote: installPlan.safeToInstall && parserCompatibility.every((item) => item.compatible),
      forbiddenSourceClasses: [
        "restricted raw payload collection",
        "private forums",
        "credentialed sources",
        "leaked-file endpoints",
        "CAPTCHA bypass",
        "public chat sources"
      ],
      notes: [
        "Dry-run onboarding creates candidates only.",
        "Scheduler cost is estimated and does not enqueue work.",
        "Restricted, private, auth, CAPTCHA, leaked-file, and public-chat sources cannot satisfy safe-public SLOs."
      ]
    }
  };
}

function buildSourceCoverageBurnDownReport(
  query: SourceCoveragePlanQuery,
  onboardingPlans: SourcePackOnboardingPlan[],
  sources: SourceRecord[]
): SourceCoverageBurnDownReport {
  const sourceAdditions = uniqueStrings(onboardingPlans.flatMap((plan) =>
    plan.expectedCoverageDelta.find((delta) => delta.query === query.query)?.sourceIds ?? []
  )).slice(0, 20);
  const unsafeSourceIds = uniqueStrings(query.drift
    .filter((item) => item.code === "unsafe_source_class_excluded" && item.sourceId)
    .map((item) => item.sourceId!));
  const staleSourceIds = uniqueStrings(query.drift
    .filter((item) => item.code === "freshness_slo_missed" && item.sourceId)
    .map((item) => item.sourceId!));
  return {
    query: query.query,
    statusBefore: query.slo.status,
    statusAfterPlannedAdditions: sourceAdditions.length > 0 && query.slo.failures.every((code) =>
      code === "below_minimum_active_sources" ||
      code === "insufficient_source_family_diversity" ||
      code === "missing_geographic_coverage" ||
      code === "missing_sector_coverage" ||
      code === "missing_approved_public_source_pack"
    ) ? "warning" : query.slo.status,
    sourceAdditions,
    legalReviews: uniqueStrings(query.drift.filter((item) => item.code === "missing_legal_review" && item.sourceId).map((item) => item.sourceId!)),
    cadenceIncreases: staleSourceIds,
    cadenceReductions: sources.filter((source) => unsafeSourceIds.includes(source.id) && source.status !== "active").map((source) => source.id).sort(),
    parserFixes: uniqueStrings(query.drift.filter((item) => item.code === "adapter_mismatch" && item.sourceId).map((item) => item.sourceId!)),
    duplicateRetirements: uniqueStrings(query.drift.filter((item) => item.code === "duplicate_canonical_url" && item.sourceId).map((item) => item.sourceId!)),
    blockedUnsafeSourceIds: unsafeSourceIds
  };
}

export function buildSafePublicSourcePackInstallPlan(
  bundle: SeedSourceBundle,
  options: {
    mode?: SafePublicSourcePackInstallMode;
    tenantId?: string;
    existingSources?: SourceRecord[];
    generatedAt?: string;
  } = {}
): SafePublicSourcePackInstallPlan {
  const generatedAt = options.generatedAt ?? nowIso();
  const scopedBundle: SeedSourceBundle = {
    ...bundle,
    sources: bundle.sources.map((source) => ({ ...source, tenantId: options.tenantId ?? source.tenantId }))
  };
  const validation = validateSeedBundle(scopedBundle, {
    dryRun: true,
    existingSources: options.existingSources,
    importedAt: generatedAt,
    referenceAt: generatedAt
  });
  const duplicateIds = new Set(validation.duplicates.map((duplicate) => scopedBundle.sources[duplicate.inputIndex]?.id).filter(Boolean));
  const erroredIds = new Set(validation.errors.map((error) =>
    scopedBundle.sources[error.inputIndex]?.id
  ).filter(Boolean));
  const recommendations = scopedBundle.sources
    .map((source): SafePublicSourcePackRecommendation => {
      const coverageTags = coverageTagsForSeed(source);
      const duplicate = source.id ? duplicateIds.has(source.id) : false;
      const errored = source.id ? erroredIds.has(source.id) : false;
      return {
        sourceId: source.id ?? stableId("src", seedDuplicateKey(source)),
        sourceName: source.name,
        sourceType: source.type,
        url: canonicalizeSeedUrl(source.url),
        tenantId: options.tenantId ?? source.tenantId,
        coverageTags,
        requiredAction: duplicate ? "skip_duplicate" : errored ? "fix_compliance" : "install_candidate",
        reasons: [
          `approval scope:${source.catalog?.approvalScope ?? "missing"}`,
          `adapter:${source.type}`,
          ...coverageTags.slice(0, 6).map((tag) => `coverage:${tag}`)
        ],
        score: source.trustScore + (source.catalog?.intelligenceValue ?? 0) + (source.catalog?.reliability ?? 0)
      };
    })
    .sort((left, right) => {
      const actionOrder = actionRank(left.requiredAction) - actionRank(right.requiredAction);
      return actionOrder || right.score - left.score || left.sourceId.localeCompare(right.sourceId);
    });

  return {
    mode: options.mode ?? "dry_run",
    dryRun: true,
    safeToInstall: validation.valid,
    willStartCrawling: false,
    packName: bundle.name,
    tenantId: options.tenantId,
    generatedAt,
    acceptedSourceCount: validation.accepted.length,
    rejectedSourceCount: validation.errors.length,
    duplicateSourceCount: validation.duplicates.length,
    validation,
    recommendations
  };
}

export function validateSafePublicStarterPackCoverage(
  bundle: SeedSourceBundle,
  queries: string[],
  options: { tenantId?: string; generatedAt?: string } = {}
): SafePublicStarterPackCoverageValidation {
  const generatedAt = options.generatedAt ?? nowIso();
  const installPlan = buildSafePublicSourcePackInstallPlan(bundle, {
    mode: "dry_run",
    tenantId: options.tenantId,
    generatedAt
  });
  const sources = installPlan.validation.accepted;
  const queryReports = queries.map((query): SafePublicStarterPackCoverageQuery => {
    const response = buildSourceActivationApiResponse(query, sources, {
      tenantId: options.tenantId,
      generatedAt
    });
    const matchingCandidates = response.candidateOnlyGaps.filter((source) => source.score > 0);
    const matchingActive = response.activeCoverage.filter((source) => source.score > 0);
    return {
      query,
      coverageReady: matchingCandidates.length + matchingActive.length > 0 && response.adapterIncompatibilities.length === 0,
      activeCoverageCount: matchingActive.length,
      candidateCoverageCount: matchingCandidates.length,
      topSourceIds: [...matchingActive, ...matchingCandidates]
        .sort((left, right) => right.score - left.score || left.sourceId.localeCompare(right.sourceId))
        .slice(0, 5)
        .map((source) => source.sourceId),
      underservedReasons: response.underservedReasons
    };
  });

  return {
    packName: bundle.name,
    generatedAt,
    valid: installPlan.validation.valid && queryReports.every((report) => report.coverageReady),
    queries: queryReports
  };
}

export function explainSourceForQuery(query: string, source: SourceRecord, referenceAt = nowIso()): SourceCoverageExplanation {
  const terms = tokenizeQuery(query);
  const catalog = source.catalog;
  const matchedTopics = matchTerms(terms, [...(catalog?.coverage.topics ?? []), ...(source.tags ?? [])]);
  const matchedActors = matchTerms(terms, [...(catalog?.coverage.actors ?? []), ...(catalog?.coverage.aliases ?? [])]);
  const matchedIndustries = matchTerms(terms, catalog?.coverage.industries ?? []);
  const matchedRegions = matchTerms(terms, [...(catalog?.coverage.regions ?? []), ...(catalog?.coverage.countries ?? [])]);
  const queryPatternHits = matchTerms(terms, catalog?.coverage.queryPatterns ?? []);
  const missingLegal = !source.legalNotes.trim();
  const stale = isStale(source, referenceAt);
  const adapterCompatible = !catalog || catalog.adapterCompatibility.includes(source.type);
  const status = activationStatus(source, { missingLegal, stale, adapterCompatible });
  const matchScore = matchedTopics.length * 0.14 +
    matchedActors.length * 0.24 +
    matchedIndustries.length * 0.16 +
    matchedRegions.length * 0.16 +
    queryPatternHits.length * 0.12;
  const catalogBoost = catalog ? 0.2 * catalog.intelligenceValue + 0.15 * catalog.reliability : 0;
  const statusPenalty = status === "active" || status === "approved_idle" || status === "candidate_only" ? 0 : 0.35;
  const score = Math.max(0, Math.min(1, matchScore + catalogBoost + source.trustScore * 0.15 - statusPenalty));
  const reasons = [
    ...matchedActors.map((value) => `actor match:${value}`),
    ...matchedTopics.map((value) => `topic match:${value}`),
    ...matchedIndustries.map((value) => `industry match:${value}`),
    ...matchedRegions.map((value) => `region match:${value}`),
    ...queryPatternHits.map((value) => `query pattern:${value}`)
  ];
  if (status !== "active") reasons.push(`activation:${status}`);
  if (catalog?.approvalScope) reasons.push(`approval scope:${catalog.approvalScope}`);

  return {
    sourceId: source.id,
    sourceName: source.name,
    status,
    score,
    reasons,
    matchedTopics,
    matchedActors,
    matchedIndustries,
    matchedRegions
  };
}

function buildSeedImportReport(bundle: SeedSourceBundle, options: SeedSourceImportOptions): SeedSourceImportReport {
  const accepted: SourceRecord[] = [];
  const duplicates: SeedSourceDuplicate[] = [];
  const errors: SeedSourceValidationError[] = [];
  const compliance: SeedSourceComplianceReport = {
    missingLegalNotes: [],
    missingCatalog: [],
    stale: [],
    overlappingCoverage: []
  };
  const importedAt = options.importedAt ?? nowIso();
  const referenceAt = options.referenceAt ?? importedAt;
  const existing = new Map((options.existingSources ?? []).map((source) => [seedDuplicateKey(source), source.id]));
  const seen = new Map<string, number>();

  if (bundle.version !== 1) {
    errors.push({ inputIndex: -1, message: "Unsupported seed bundle version" });
  }

  bundle.sources.forEach((input, inputIndex) => {
    if (!input.legalNotes.trim()) {
      compliance.missingLegalNotes.push({ inputIndex, sourceName: input.name, message: "Source legal notes are required" });
    }
    if (!input.catalog) {
      compliance.missingCatalog.push({ inputIndex, sourceName: input.name, message: "Seed source catalog metadata is required" });
    }

    try {
      const key = seedDuplicateKey(input);
      const existingSourceId = existing.get(key);
      const duplicateOfIndex = seen.get(key);
      if (existingSourceId || duplicateOfIndex !== undefined) {
        duplicates.push({ key, inputIndex, existingSourceId, duplicateOfIndex });
      }
      seen.set(key, inputIndex);

      validateSafeSeedSource(input);
      const source = seedInputToSource(input, importedAt);
      validateSource(source);
      accepted.push(source);
    } catch (error) {
      errors.push({
        inputIndex,
        sourceName: input.name,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  compliance.overlappingCoverage = findCoverageOverlap(bundle.sources);

  return {
    dryRun: options.dryRun ?? true,
    valid: errors.length === 0 && duplicates.length === 0,
    accepted: errors.length === 0 ? accepted : accepted.filter((source) =>
      !errors.some((error) => error.sourceName === source.name)
    ),
    duplicates,
    errors,
    activation: {
      approved: accepted.filter((source) => source.catalog?.approvalScope === "safe_public_auto").length,
      blocked: accepted.filter((source) => source.catalog?.approvalScope === "disabled").length,
      stale: accepted.filter((source) => isStale(source, referenceAt)).length,
      duplicates: duplicates.length,
      missingLegalNotes: accepted.filter((source) => !source.legalNotes.trim()).length,
      adapterIncompatible: accepted.filter((source) => source.catalog && !source.catalog.adapterCompatibility.includes(source.type)).length
    },
    compliance: {
      ...compliance,
      stale: accepted.flatMap((source) => staleSourceReport(source, referenceAt))
    }
  };
}

function seedInputToSource(input: SeedSourceInput, importedAt: string): SourceRecord {
  return {
    ...input,
    id: input.id ?? stableId("src", seedDuplicateKey(input)),
    status: "candidate",
    url: canonicalizeSeedUrl(input.url),
    lastSeenAt: input.lastSeenAt,
    createdAt: importedAt,
    updatedAt: importedAt,
    governance: {
      approvalRequired: false,
      approvalState: "not_required",
      metadataOnly: false,
      policyVersion: "collection-policy:v1"
    },
    health: {
      status: "unknown",
      consecutiveFailures: 0,
      errorRate: 0
    },
    crawlState: {
      retryCount: 0
    },
    catalog: input.catalog,
    scoring: {
      reliability: input.trustScore,
      freshness: 0.5,
      relevance: 0.7,
      uniqueness: 0.5,
      parseability: 0.6,
      policyRiskPenalty: 0,
      operatorBoost: 0
    },
    tags: [...new Set([...(input.tags ?? []), "seed", "public-cti"])]
  };
}

function validateSafeSeedSource(input: SeedSourceInput): void {
  if (!SAFE_PUBLIC_TYPES.has(input.type)) throw new Error("Seed source type must be safe public CTI");
  if (!SAFE_ACCESS_METHODS.has(input.accessMethod)) throw new Error("Seed source access must be public or official API");
  if (input.risk !== "low") throw new Error("Seed source risk must be low");
  if (input.type === "api" && input.accessMethod !== "official_api" && input.accessMethod !== "public_http") {
    throw new Error("API seed source must use public HTTP or official API access");
  }
  validateCatalog(input);
}

function validateCatalog(input: SeedSourceInput): void {
  const catalog = input.catalog;
  if (!catalog) throw new Error("Seed source catalog metadata is required");
  if (catalog.approvalScope !== "safe_public_auto") throw new Error("Safe public seeds must use safe_public_auto approval scope");
  if (!catalog.license.trim() || !catalog.legalBasis.trim()) throw new Error("Catalog license and legal basis are required");
  if (!catalog.publisher.name.trim()) throw new Error("Catalog publisher identity is required");
  if (catalog.collection.crawlCadenceSeconds < 60) throw new Error("Catalog crawl cadence must be at least 60 seconds");
  if (!catalog.adapterCompatibility.includes(input.type)) throw new Error("Catalog adapter compatibility must include source type");
  if (catalog.reliability < 0 || catalog.reliability > 1 || catalog.intelligenceValue < 0 || catalog.intelligenceValue > 1) {
    throw new Error("Catalog reliability and intelligence value must be between 0 and 1");
  }
}

function canonicalizeSeedUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  const search = [...url.searchParams.entries()].sort(([left], [right]) => left.localeCompare(right));
  url.search = "";
  for (const [key, item] of search) url.searchParams.append(key, item);
  return url.toString();
}

const ACTIVATION_STATUSES: SourceActivationStatus[] = [
  "active",
  "approved_idle",
  "candidate_only",
  "blocked_by_policy",
  "missing_legal_notes",
  "stale",
  "duplicate",
  "adapter_incompatible"
];

function activationStatus(
  source: SourceRecord,
  checks: { missingLegal: boolean; stale: boolean; adapterCompatible: boolean }
): SourceActivationStatus {
  if (checks.missingLegal) return "missing_legal_notes";
  if (!checks.adapterCompatible) return "adapter_incompatible";
  if (source.catalog?.approvalScope === "disabled" || source.accessMethod === "disabled" || source.status === "disabled" || source.status === "rejected") {
    return "blocked_by_policy";
  }
  if (checks.stale) return "stale";
  if (source.status === "active" || source.status === "probation" || source.status === "degraded") return "active";
  if (source.status === "approved") return "approved_idle";
  if (source.status === "candidate" || source.status === "needs_review") return "candidate_only";
  return "blocked_by_policy";
}

function requiredActivationAction(status: SourceActivationStatus): LiveSearchPlannerDto["recommendedSourceActivations"][number]["requiredAction"] {
  if (status === "blocked_by_policy" || status === "adapter_incompatible") return "enable_adapter";
  if (status === "stale" || status === "approved_idle") return "restore";
  if (status === "candidate_only" || status === "missing_legal_notes") return "approve";
  return "add_source";
}

function activationCoverageGapForStatus(status: SourceActivationStatus): string | undefined {
  if (status === "candidate_only" || status === "approved_idle") return "source_activation";
  if (status === "missing_legal_notes") return "source_compliance";
  if (status === "stale") return "source_freshness";
  if (status === "adapter_incompatible") return "adapter_compatibility";
  if (status === "blocked_by_policy") return "source_policy";
  if (status === "duplicate") return "source_duplicate";
  return undefined;
}

function actionPriorityBoost(status: SourceActivationStatus): number {
  if (status === "candidate_only") return 25;
  if (status === "approved_idle") return 20;
  if (status === "missing_legal_notes") return 15;
  if (status === "stale") return 12;
  if (status === "adapter_incompatible") return 10;
  return 5;
}

function activationGapReason(status: SourceActivationStatus): string {
  if (status === "approved_idle") return "Matching sources are approved but not active in collection.";
  if (status === "candidate_only") return "Matching safe-public candidate sources need activation.";
  if (status === "blocked_by_policy") return "Matching sources are blocked by policy or disabled access.";
  if (status === "missing_legal_notes") return "Matching sources are missing required legal notes.";
  if (status === "stale") return "Matching sources missed their freshness target.";
  if (status === "duplicate") return "Matching sources duplicate existing canonical source URLs.";
  if (status === "adapter_incompatible") return "Matching sources require adapter compatibility work before scheduling.";
  return "Matching sources are already active.";
}

function apiSourceSummary(explanation: SourceCoverageExplanation, source: SourceRecord): SourceActivationApiSourceSummary {
  return {
    ...explanation,
    tenantId: source.tenantId,
    sourceType: source.type,
    url: source.url,
    approvalScope: source.catalog?.approvalScope,
    healthStatus: source.health?.status,
    freshnessTargetSeconds: source.catalog?.collection.freshnessTargetSeconds
  };
}

function duplicateGroups(sources: SourceRecord[]): SourceActivationDuplicateGroup[] {
  const groups = new Map<string, string[]>();
  for (const source of sources) {
    const key = seedDuplicateKey(source);
    groups.set(key, [...(groups.get(key) ?? []), source.id]);
  }
  return [...groups.entries()]
    .filter(([, sourceIds]) => sourceIds.length > 1)
    .map(([key, sourceIds]) => ({ key, sourceIds: sourceIds.sort() }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function buildUnderservedReasons(
  query: string,
  sources: SourceRecord[],
  summaries: SourceActivationApiSourceSummary[],
  duplicates: SourceActivationDuplicateGroup[]
): SourceActivationUnderservedReason[] {
  const reasons: SourceActivationUnderservedReason[] = [];
  const matching = summaries.filter((source) => source.score > 0);
  const activeMatching = matching.filter((source) => source.status === "active");
  const terms = tokenizeQuery(query);
  const actorish = !terms.includes("cve") && !terms.includes("vulnerability") && terms.some((term) => term.length >= 4);

  if (actorish && !activeMatching.some((source) => source.matchedActors.length > 0)) {
    reasons.push({
      code: "missing_actor_coverage",
      severity: matching.some((source) => source.matchedActors.length > 0) ? "warning" : "critical",
      reason: "No active source has actor or alias coverage for this query.",
      sourceIds: matching.filter((source) => source.matchedActors.length > 0).map((source) => source.sourceId),
      suggestedAction: "add_source"
    });
  }

  const stale = matching.filter((source) => source.status === "stale");
  if (stale.length) {
    reasons.push({
      code: "stale_cadence",
      severity: "warning",
      reason: "Matching sources missed their freshness target and should be restored or re-polled.",
      sourceIds: stale.map((source) => source.sourceId),
      suggestedAction: "restore"
    });
  }

  if (!sources.some((source) => source.type === "telegram_public" && source.status !== "disabled" && source.status !== "rejected")) {
    reasons.push({
      code: "no_public_channel_coverage",
      severity: "info",
      reason: "No safe public-channel source is available for this query.",
      sourceIds: [],
      suggestedAction: "add_source"
    });
  }

  if (!sources.some((source) =>
    (source.type === "tor_metadata" || source.type === "i2p_metadata" || source.type === "freenet_metadata") &&
    source.governance?.metadataOnly === true &&
    source.governance.approvalState === "approved"
  )) {
    reasons.push({
      code: "no_approved_restricted_metadata_source",
      severity: "info",
      reason: "No approved metadata-only restricted source is available for restricted-source corroboration.",
      sourceIds: [],
      suggestedAction: "approve"
    });
  }

  const unhealthy = matching.filter((source) => source.healthStatus === "degraded" || source.healthStatus === "failing");
  if (unhealthy.length) {
    reasons.push({
      code: "source_unhealthy",
      severity: unhealthy.some((source) => source.healthStatus === "failing") ? "critical" : "warning",
      reason: "Matching sources have degraded or failing health.",
      sourceIds: unhealthy.map((source) => source.sourceId),
      suggestedAction: "restore"
    });
  }

  const disabled = matching.filter((source) => source.status === "blocked_by_policy");
  if (disabled.length) {
    reasons.push({
      code: "source_disabled",
      severity: "warning",
      reason: "Matching sources are disabled, rejected, or blocked by policy.",
      sourceIds: disabled.map((source) => source.sourceId),
      suggestedAction: "enable_adapter"
    });
  }

  if (duplicates.length) {
    const duplicateIds = new Set(duplicates.flatMap((group) => group.sourceIds));
    const duplicateMatching = matching.filter((source) => duplicateIds.has(source.sourceId));
    if (duplicateMatching.length) {
      reasons.push({
        code: "source_disabled",
        severity: "info",
        reason: "Matching coverage includes duplicate canonical source URLs; install plans should skip duplicates.",
        sourceIds: duplicateMatching.map((source) => source.sourceId),
        suggestedAction: "add_source"
      });
    }
  }

  return reasons.sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || left.code.localeCompare(right.code));
}

function buildCoverageVerticals(
  query: string,
  activation: SourceActivationApiResponse,
  packs: SeedSourceBundle[]
): SourceCoveragePlanVertical[] {
  const allSources = [
    ...activation.activeCoverage,
    ...activation.approvedIdleSources,
    ...activation.candidateOnlyGaps,
    ...activation.staleSources,
    ...activation.adapterIncompatibilities,
    ...activation.policyBlocks
  ];
  const packRecommendations = activation.sourcePackRecommendations;
  const verticals: Array<{ vertical: SourceCoveragePlanVertical["vertical"]; terms: string[]; reason: string }> = [
    { vertical: "actor_intelligence", terms: actorishQuery(query) ? ["actor", "campaign", "threat-report"] : ["actor"], reason: "Actor searches need vendor, government, and standards-backed actor reporting." },
    { vertical: "vulnerability_intelligence", terms: ["CVE", "vulnerability", "exploitation"], reason: "Vulnerability searches need government catalogs and advisory datasets." },
    { vertical: "ransomware_victim_reporting", terms: ["ransomware", "victimology", "incident"], reason: "Ransomware and victim searches need public ransomware reporting and incident news." },
    { vertical: "vendor_research", terms: ["vendor", "research", "threat-report"], reason: "Vendor research improves freshness and corroboration for named actor searches." },
    { vertical: "government_advisories", terms: ["government", "advisory", "CERT", "CISA", "NCSC"], reason: "Government advisories provide high-trust defensive context." },
    { vertical: "malware_reports", terms: ["malware", "TTP", "tooling"], reason: "Malware reports connect actors to tooling and techniques." },
    { vertical: "public_datasets", terms: ["ATT&CK", "GitHub advisory", "public dataset", "CVE"], reason: "Public datasets make enrichment and cross-product interpretation stable." }
  ];
  const rows = verticals.map((vertical): SourceCoveragePlanVertical => {
    const active = allSources.filter((source) => source.status === "active" && sourceMatchesTerms(source, vertical.terms));
    const candidates = allSources.filter((source) =>
      (source.status === "candidate_only" || source.status === "approved_idle") && sourceMatchesTerms(source, vertical.terms)
    );
    const recommended = packRecommendations.filter((source) =>
      source.coverageTags.some((tag) => vertical.terms.some((term) => includesTerm(tag, term)))
    );
    return {
      vertical: vertical.vertical,
      present: active.length + candidates.length + recommended.length > 0,
      activeCount: active.length,
      candidateCount: candidates.length,
      recommendedSourceIds: recommended.slice(0, 8).map((source) => source.sourceId),
      reason: vertical.reason
    };
  });

  rows.push({
    vertical: "public_channel",
    present: false,
    activeCount: 0,
    candidateCount: 0,
    recommendedSourceIds: [],
    reason: "Public-channel packs are owned separately and should be joined by Agent 04/09 when available."
  });
  rows.push({
    vertical: "restricted_metadata",
    present: false,
    activeCount: 0,
    candidateCount: 0,
    recommendedSourceIds: [],
    reason: "Restricted metadata remains metadata-only and requires separate legal approval; no clear-web pack may enable it."
  });

  if (packs.length === 0) return rows;
  return rows.sort((left, right) => Number(left.present) - Number(right.present) || left.vertical.localeCompare(right.vertical));
}

function buildCoverageGovernanceDrift(
  allSources: SourceRecord[],
  packs: SeedSourceBundle[],
  tenantId: string | undefined,
  generatedAt: string
): SourceCoverageGovernanceDriftItem[] {
  const sources = tenantId
    ? allSources.filter((source) => source.tenantId === tenantId || source.tenantId === undefined)
    : allSources;
  const duplicateKeys = duplicateGroups(sources);
  const duplicateIds = new Set(duplicateKeys.flatMap((group) => group.sourceIds));
  const packVersionByCanonicalId = new Map(packs.flatMap((pack) =>
    pack.sources.map((source) => [source.catalog?.canonicalId, pack.generatedAt ?? pack.name] as const)
  ).filter(([canonicalId]) => Boolean(canonicalId)));
  const items: SourceCoverageGovernanceDriftItem[] = [];

  for (const source of sources) {
    const governance = source.governance;
    if (governance?.approvalExpiresAt && Date.parse(governance.approvalExpiresAt) < Date.parse(generatedAt)) {
      items.push(drift(source, "approval_expired", "critical", "Source approval has expired.", "request_legal_review"));
    }
    if ((source.status === "approved" || source.status === "active") && governance?.approvalRequired && governance.approvalState !== "approved") {
      items.push(drift(source, "approval_not_approved", "critical", "Source is eligible for collection but approval state is not approved.", "request_legal_review"));
    }
    if (staleMetadataDate(source.metadata?.legalNotesReviewedAt, generatedAt, 90)) {
      items.push(drift(source, "stale_legal_notes", "warning", "Legal notes review is missing or stale.", "request_legal_review"));
    }
    if (source.type === "rss" || source.type === "static_web" || source.type === "pdf") {
      if (!source.metadata?.robotsReviewedAt) {
        items.push(drift(source, "missing_robots_notes", "warning", "Robots review notes are missing for a crawlable public source.", "request_legal_review"));
      } else if (staleMetadataDate(source.metadata.robotsReviewedAt, generatedAt, 90)) {
        items.push(drift(source, "stale_robots_notes", "warning", "Robots review notes are stale.", "request_legal_review"));
      }
    }
    if (source.health?.status === "failing" || source.health?.status === "degraded") {
      items.push(drift(source, "stale_health", source.health.status === "failing" ? "critical" : "warning", "Source health is degraded or failing.", "quarantine"));
    }
    if (source.catalog && !source.catalog.adapterCompatibility.includes(source.type)) {
      items.push(drift(source, "adapter_mismatch", "critical", "Source type is not compatible with catalog adapter compatibility.", "reassign_adapter"));
    }
    if (duplicateIds.has(source.id)) {
      items.push(drift(source, "duplicate_canonical_url", "info", "Source duplicates another tenant/type/canonical URL.", "retire_duplicate"));
    }
    const expectedPackVersion = source.catalog?.canonicalId ? packVersionByCanonicalId.get(source.catalog.canonicalId) : undefined;
    if (expectedPackVersion && source.metadata?.sourcePackVersion && source.metadata.sourcePackVersion !== expectedPackVersion) {
      items.push(drift(source, "source_pack_version_skew", "warning", "Source pack version differs from the current approved pack.", "approve"));
    }
  }

  return items.sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || left.code.localeCompare(right.code) || left.sourceId.localeCompare(right.sourceId));
}

function drift(
  source: SourceRecord,
  code: SourceCoverageGovernanceDriftCode,
  severity: SourceCoverageGovernanceDriftItem["severity"],
  reason: string,
  recommendedAction: SourceCoverageGovernanceDriftItem["recommendedAction"]
): SourceCoverageGovernanceDriftItem {
  return { code, sourceId: source.id, sourceName: source.name, severity, reason, recommendedAction };
}

function buildCoverageRemediationPlans(driftItems: SourceCoverageDriftItem[]): SourceCoverageRemediationPlan[] {
  const actionByDrift: Record<SourceCoverageDriftItem["recommendedAction"], SourceCoverageRemediationPlan["action"]> = {
    approve: "activate",
    quarantine: "quarantine",
    change_cadence: "change_cadence",
    request_legal_review: "request_legal_review",
    reassign_adapter: "reassign_adapter",
    retire_duplicate: "retire_duplicate",
    reduce_cadence: "reduce_cadence",
    increase_cadence: "increase_cadence",
    add_source_pack: "add_source_pack"
  };
  return [...new Set(driftItems.map((item) => item.recommendedAction))]
    .map((recommendedAction) => {
      const matching = driftItems.filter((item) => item.recommendedAction === recommendedAction);
      return {
        action: actionByDrift[recommendedAction],
        dryRun: true as const,
        willMutate: false as const,
        willStartCrawling: false as const,
        sourceIds: matching.map((item) => item.sourceId).filter((sourceId): sourceId is string => Boolean(sourceId)).sort(),
        reason: matching.map((item) => item.code).sort().join(", "),
        approvalRequired: recommendedAction !== "quarantine" && recommendedAction !== "retire_duplicate" && recommendedAction !== "reduce_cadence"
      };
    })
    .sort((left, right) => left.action.localeCompare(right.action));
}

function evaluateSourceCoverageSlo(
  query: string,
  sources: SourceRecord[],
  activation: SourceActivationApiResponse,
  recommendations: SafePublicSourcePackRecommendation[],
  generatedAt: string
): SourceCoverageSloEvaluation {
  const queryClass = classifyCoverageQuery(query);
  const requirements = sourceCoverageSloRequirements(queryClass);
  const matchingSummaries = new Map(
    [...activation.activeCoverage, ...activation.approvedIdleSources, ...activation.candidateOnlyGaps, ...activation.staleSources, ...activation.policyBlocks, ...activation.adapterIncompatibilities]
      .filter((summary) => summary.score > 0)
      .map((summary) => [summary.sourceId, summary])
  );
  const matchingSources = sources.filter((source) => matchingSummaries.has(source.id));
  const safePublic = matchingSources.filter((source) => sourceCanSatisfyPublicSlo(source));
  const activeSafePublic = safePublic.filter((source) => source.status === "active" || source.status === "probation" || source.status === "degraded");
  const freshSafePublic = activeSafePublic.filter((source) => !sourceMissesFreshnessSlo(source, requirements.maxFreshnessSeconds, generatedAt));
  const sourceFamilies = [...new Set(activeSafePublic.map(sourceFamilyKey))].sort();
  const legalReviewComplete = activeSafePublic.length > 0 && activeSafePublic.every((source) =>
    Boolean(source.legalNotes.trim()) && !staleMetadataDate(source.metadata?.legalNotesReviewedAt, generatedAt, 90)
  );
  const robotsReviewComplete = activeSafePublic.length > 0 && activeSafePublic.every((source) =>
    !sourceNeedsRobotsReview(source) || !staleMetadataDate(source.metadata?.robotsReviewedAt, generatedAt, 90)
  );
  const geographicCoverage = [...new Set(activeSafePublic.flatMap((source) => [
    ...(source.catalog?.coverage.regions ?? []),
    ...(source.catalog?.coverage.countries ?? [])
  ]))].sort();
  const sectorCoverage = [...new Set(activeSafePublic.flatMap((source) => source.catalog?.coverage.industries ?? []))].sort();
  const excludedUnsafeSourceIds = matchingSources
    .filter((source) => !sourceCanSatisfyPublicSlo(source))
    .map((source) => source.id)
    .sort();
  const failures: SourceCoverageDriftCode[] = [];

  if (activeSafePublic.length < requirements.minActiveSafePublicSources) failures.push("below_minimum_active_sources");
  if (sourceFamilies.length < requirements.minSourceFamilies) failures.push("insufficient_source_family_diversity");
  if (freshSafePublic.length < Math.min(requirements.minActiveSafePublicSources, activeSafePublic.length || requirements.minActiveSafePublicSources)) failures.push("freshness_slo_missed");
  if (!legalReviewComplete) failures.push("missing_legal_review");
  if (!robotsReviewComplete) failures.push("missing_robots_review");
  if (requirements.requireGeographicCoverage && geographicCoverage.length === 0) failures.push("missing_geographic_coverage");
  if (requirements.requireSectorCoverage && sectorCoverage.length === 0) failures.push("missing_sector_coverage");
  if (excludedUnsafeSourceIds.length > 0) failures.push("unsafe_source_class_excluded");
  if (activeSafePublic.length < requirements.minActiveSafePublicSources && recommendations.length > 0) failures.push("missing_approved_public_source_pack");

  const criticalFailures = failures.filter((code) =>
    code !== "missing_approved_public_source_pack" && code !== "unsafe_source_class_excluded"
  );
  const status: SourceCoverageSloStatus = criticalFailures.length === 0
    ? failures.length === 0 ? "pass" : "warning"
    : "fail";

  return {
    queryClass,
    status,
    requirements,
    actuals: {
      activeSafePublicSources: activeSafePublic.length,
      sourceFamilies,
      freshSafePublicSources: freshSafePublic.length,
      legalReviewComplete,
      robotsReviewComplete,
      geographicCoverage,
      sectorCoverage,
      excludedUnsafeSourceIds
    },
    failures
  };
}

function buildSourceCoverageSloDrift(
  query: string,
  slo: SourceCoverageSloEvaluation,
  sources: SourceRecord[],
  activation: SourceActivationApiResponse,
  recommendations: SafePublicSourcePackRecommendation[]
): SourceCoverageDriftItem[] {
  const summaries = [
    ...activation.activeCoverage,
    ...activation.approvedIdleSources,
    ...activation.candidateOnlyGaps,
    ...activation.staleSources,
    ...activation.policyBlocks,
    ...activation.adapterIncompatibilities
  ].filter((summary) => summary.score > 0);
  const matchingSourceIds = new Set(summaries.map((summary) => summary.sourceId));
  const unsafeSources = sources.filter((source) => matchingSourceIds.has(source.id) && !sourceCanSatisfyPublicSlo(source));
  const staleSources = sources.filter((source) =>
    matchingSourceIds.has(source.id) &&
    sourceCanSatisfyPublicSlo(source) &&
    sourceMissesFreshnessSlo(source, slo.requirements.maxFreshnessSeconds, activation.generatedAt)
  );
  const rows: SourceCoverageDriftItem[] = [];
  const add = (
    code: SourceCoverageDriftCode,
    severity: SourceCoverageDriftItem["severity"],
    reason: string,
    recommendedAction: SourceCoverageDriftItem["recommendedAction"],
    source?: SourceRecord
  ) => rows.push({
    code,
    query,
    sourceId: source?.id,
    sourceName: source?.name,
    severity,
    reason,
    recommendedAction
  });

  for (const failure of slo.failures) {
    if (failure === "below_minimum_active_sources") add(failure, "critical", `Query has ${slo.actuals.activeSafePublicSources} active safe-public sources; SLO requires ${slo.requirements.minActiveSafePublicSources}.`, "add_source_pack");
    if (failure === "insufficient_source_family_diversity") add(failure, "critical", `Query has ${slo.actuals.sourceFamilies.length} source families; SLO requires ${slo.requirements.minSourceFamilies}.`, "add_source_pack");
    if (failure === "freshness_slo_missed") {
      if (staleSources.length === 0) add(failure, "warning", "Matching safe-public source freshness is below SLO.", "increase_cadence");
      for (const source of staleSources) add(failure, "warning", "Safe-public source missed freshness SLO.", "increase_cadence", source);
    }
    if (failure === "missing_geographic_coverage") add(failure, "warning", "No active safe-public source provides geographic coverage for the query class.", "add_source_pack");
    if (failure === "missing_sector_coverage") add(failure, "warning", "No active safe-public source provides sector coverage for the query class.", "add_source_pack");
    if (failure === "missing_legal_review") add(failure, "critical", "Active safe-public sources need complete current legal review notes.", "request_legal_review");
    if (failure === "missing_robots_review") add(failure, "critical", "Active crawlable safe-public sources need current robots review notes.", "request_legal_review");
    if (failure === "unsafe_source_class_excluded") {
      for (const source of unsafeSources) add(failure, "warning", "Source is excluded from public-source SLOs because it is not safe public approved coverage.", unsafeRemediationAction(source), source);
    }
    if (failure === "missing_approved_public_source_pack" && recommendations.length > 0) add(failure, "warning", "Safe public source-pack recommendations are available to close the SLO gap.", "add_source_pack");
  }

  return rows.sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || left.code.localeCompare(right.code) || (left.sourceId ?? "").localeCompare(right.sourceId ?? ""));
}

function buildSourceCoverageSloRollup(queries: SourceCoveragePlanQuery[]): SourceCoverageSloRollup {
  const queryClasses = {
    actor: 0,
    ransomware_victim: 0,
    cve: 0,
    sector: 0,
    country: 0,
    malware_tool: 0
  } satisfies Record<SourceCoverageSloQueryClass, number>;
  for (const query of queries) queryClasses[query.slo.queryClass] += 1;
  const passed = queries.filter((query) => query.slo.status === "pass").length;
  const warning = queries.filter((query) => query.slo.status === "warning").length;
  const failed = queries.filter((query) => query.slo.status === "fail").length;
  return {
    status: failed > 0 ? "fail" : warning > 0 ? "warning" : "pass",
    passed,
    warning,
    failed,
    queryClasses
  };
}

function classifyCoverageQuery(query: string): SourceCoverageSloQueryClass {
  const terms = tokenizeQuery(query);
  const text = query.toLowerCase();
  if (terms.includes("cve") || terms.includes("vulnerability") || /cve-\d{4}/i.test(query)) return "cve";
  if (terms.includes("ransomware") || terms.includes("victim") || ["akira", "lockbit", "alphv", "blackcat"].some((term) => text.includes(term))) return "ransomware_victim";
  if (["healthcare", "finance", "financial", "energy", "government", "telecom", "education"].some((term) => terms.includes(term))) return "sector";
  if (["norway", "ukraine", "china", "iran", "russia", "united", "states", "europe"].some((term) => terms.includes(term))) return "country";
  if (["cobalt", "strike", "malware", "tool", "loader", "backdoor", "ransomware"].some((term) => terms.includes(term))) return "malware_tool";
  return "actor";
}

function sourceCoverageSloRequirements(queryClass: SourceCoverageSloQueryClass): SourceCoverageSloEvaluation["requirements"] {
  const base = {
    minActiveSafePublicSources: 2,
    minSourceFamilies: 2,
    maxFreshnessSeconds: 36 * 3600,
    requireLegalReview: true as const,
    requireRobotsReview: true as const,
    requireGeographicCoverage: false,
    requireSectorCoverage: false
  };
  if (queryClass === "actor") return { ...base, minActiveSafePublicSources: 3, maxFreshnessSeconds: 24 * 3600, requireGeographicCoverage: true, requireSectorCoverage: true };
  if (queryClass === "ransomware_victim") return { ...base, minActiveSafePublicSources: 3, minSourceFamilies: 2, maxFreshnessSeconds: 12 * 3600, requireSectorCoverage: true };
  if (queryClass === "cve") return { ...base, minActiveSafePublicSources: 2, minSourceFamilies: 2, maxFreshnessSeconds: 12 * 3600 };
  if (queryClass === "sector") return { ...base, minActiveSafePublicSources: 2, requireSectorCoverage: true };
  if (queryClass === "country") return { ...base, minActiveSafePublicSources: 2, requireGeographicCoverage: true };
  return { ...base, minActiveSafePublicSources: 2, maxFreshnessSeconds: 24 * 3600 };
}

function sourceCanSatisfyPublicSlo(source: SourceRecord): boolean {
  return SAFE_PUBLIC_TYPES.has(source.type) &&
    SAFE_ACCESS_METHODS.has(source.accessMethod) &&
    source.risk === "low" &&
    source.catalog?.approvalScope === "safe_public_auto" &&
    source.governance?.metadataOnly !== true &&
    source.status !== "disabled" &&
    source.status !== "rejected" &&
    source.status !== "retired";
}

function sourceFamilyKey(source: SourceRecord): string {
  return source.catalog?.publisher.trustBasis
    ? `${source.catalog.publisher.trustBasis}:${source.catalog.publisher.name}`
    : `${source.type}:${new URL(source.url).hostname}`;
}

function sourceNeedsRobotsReview(source: SourceRecord): boolean {
  return source.type === "rss" || source.type === "static_web" || source.type === "pdf";
}

function sourceMissesFreshnessSlo(source: SourceRecord, maxFreshnessSeconds: number, generatedAt: string): boolean {
  const last = source.crawlState?.lastCollectedAt ?? source.lastSeenAt;
  if (!last) return false;
  return Date.parse(generatedAt) - Date.parse(last) > maxFreshnessSeconds * 1000;
}

function unsafeRemediationAction(source: SourceRecord): SourceCoverageDriftItem["recommendedAction"] {
  if (source.status === "active" || source.status === "degraded" || source.status === "probation") return "quarantine";
  if (source.status === "approved" || source.status === "candidate" || source.status === "needs_review") return "request_legal_review";
  return "reduce_cadence";
}

function staleMetadataDate(value: unknown, generatedAt: string, staleAfterDays: number): boolean {
  if (typeof value !== "string" || !value) return true;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return true;
  return Date.parse(generatedAt) - timestamp > staleAfterDays * 86400 * 1000;
}

function sourceMatchesTerms(source: SourceActivationApiSourceSummary, terms: string[]): boolean {
  const haystack = [
    source.sourceName,
    source.sourceType,
    ...(source.reasons ?? []),
    ...(source.matchedTopics ?? []),
    ...(source.matchedActors ?? []),
    ...(source.matchedIndustries ?? []),
    ...(source.matchedRegions ?? [])
  ];
  return haystack.some((value) => terms.some((term) => includesTerm(value, term)));
}

function includesTerm(value: string, term: string): boolean {
  return value.toLowerCase().includes(term.toLowerCase()) || term.toLowerCase().includes(value.toLowerCase());
}

function recommendationMatchesQuery(source: SafePublicSourcePackRecommendation, query: string): boolean {
  const terms = tokenizeQuery(query);
  const haystack = [source.sourceName, ...source.coverageTags, ...source.reasons];
  if (terms.includes("unknown") || terms.includes("actor")) {
    return haystack.some((value) => ["actor", "threat-report", "malware", "campaign", "ttp"].some((term) => includesTerm(value, term)));
  }
  return haystack.some((value) => terms.some((term) => includesTerm(value, term)));
}

function recommendationQueryRank(source: SafePublicSourcePackRecommendation, query: string): number {
  const terms = tokenizeQuery(query);
  const coverage = source.coverageTags;
  const directMatches = coverage.filter((value) => terms.some((term) => includesTerm(value, term))).length;
  const reasonMatches = source.reasons.filter((value) => terms.some((term) => includesTerm(value, term))).length;
  const nameMatches = terms.some((term) => includesTerm(source.sourceName, term)) ? 1 : 0;
  return directMatches * 10 + nameMatches * 5 + reasonMatches;
}

function actorishQuery(query: string): boolean {
  const terms = tokenizeQuery(query);
  return !terms.includes("cve") && !terms.includes("vulnerability") && !terms.includes("ransomware");
}

function coverageTagsForSeed(source: SeedSourceInput): string[] {
  return [...new Set([
    ...(source.catalog?.coverage.topics ?? []),
    ...(source.catalog?.coverage.actors ?? []),
    ...(source.catalog?.coverage.aliases ?? []),
    ...(source.catalog?.coverage.industries ?? []),
    ...(source.catalog?.coverage.regions ?? []),
    ...(source.catalog?.coverage.countries ?? []),
    ...(source.tags ?? [])
  ])].sort((left, right) => left.localeCompare(right));
}

function actionRank(action: SafePublicSourcePackRecommendation["requiredAction"]): number {
  if (action === "install_candidate") return 0;
  if (action === "fix_compliance") return 1;
  return 2;
}

function severityRank(severity: SourceActivationUnderservedReason["severity"]): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function isStale(source: SourceRecord, referenceAt = nowIso()): boolean {
  const target = source.catalog?.collection.freshnessTargetSeconds;
  if (!target || !source.lastSeenAt) return false;
  return Date.parse(referenceAt) - Date.parse(source.lastSeenAt) > target * 1000;
}

function staleSourceReport(
  source: SourceRecord,
  referenceAt: string
): SeedSourceComplianceReport["stale"] {
  const target = source.catalog?.collection.freshnessTargetSeconds;
  if (!target || !source.lastSeenAt || !isStale(source, referenceAt)) return [];
  return [{
    sourceId: source.id,
    sourceName: source.name,
    lastSeenAt: source.lastSeenAt,
    freshnessTargetSeconds: target
  }];
}

function tokenizeQuery(query: string): string[] {
  const normalized = query.toLowerCase().replace(/[^a-z0-9* -]/g, " ");
  const terms = normalized.split(/\s+/).filter(Boolean);
  if (/cve-\d{4}/i.test(query)) terms.push("cve", "vulnerability");
  if (/ransomware/i.test(query)) terms.push("ransomware");
  return [...new Set(terms)];
}

function matchTerms(terms: string[], values: string[]): string[] {
  const matches = new Set<string>();
  for (const value of values) {
    const normalized = value.toLowerCase();
    if (terms.some((term) => normalized.includes(term) || term.includes(normalized))) matches.add(value);
  }
  return [...matches];
}

function findCoverageOverlap(inputs: SeedSourceInput[]): SeedSourceComplianceReport["overlappingCoverage"] {
  const overlaps: SeedSourceComplianceReport["overlappingCoverage"] = [];
  for (let left = 0; left < inputs.length; left += 1) {
    for (let right = left + 1; right < inputs.length; right += 1) {
      const leftCoverage = coverageSet(inputs[left]);
      const rightCoverage = coverageSet(inputs[right]);
      const overlap = [...leftCoverage].filter((value) => rightCoverage.has(value));
      if (overlap.length >= 5) overlaps.push({ leftIndex: left, rightIndex: right, overlap: overlap.slice(0, 12) });
    }
  }
  return overlaps;
}

function coverageSet(input: SeedSourceInput | undefined): Set<string> {
  const coverage = input?.catalog?.coverage;
  return new Set([
    ...(coverage?.topics ?? []),
    ...(coverage?.actors ?? []),
    ...(coverage?.aliases ?? []),
    ...(coverage?.industries ?? []),
    ...(coverage?.regions ?? []),
    ...(coverage?.countries ?? []),
    ...(coverage?.queryPatterns ?? [])
  ].map((value) => value.toLowerCase()));
}
