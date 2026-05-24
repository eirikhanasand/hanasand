import type { MetricSample, MetricsRegistry } from "./metrics.ts";
import type { GraphExportEnforcementDto, GraphExportSlaDto } from "../types.ts";
import type { TelegramPublicSlaReportDto } from "../adapters/telegramPublic.ts";

export type LiveSearchState = "searching" | "partial" | "ready" | "degraded" | "blocked" | "disabled";

export interface LiveSearchSlo {
  initialResponseMs: number;
  partialResultMs: number;
  recommendedPollIntervalMs: number;
  maxPollIntervalMs: number;
  maxActiveRunsPerTenantQuery: number;
  providerFailureBudgetPercent: number;
  zeroResultBudgetPercent: number;
}

export interface LiveSearchObservation {
  state: LiveSearchState;
  tenantId?: string;
  query: string;
  provider: "scraper" | "api_proxy" | "search_provider" | "public_channel" | "darknet_metadata";
  initialResponseMs?: number;
  partialResultMs?: number;
  pollCount?: number;
  activeRunsForQuery?: number;
  resultCount?: number;
  providerFailures?: number;
  sourceActivationGaps?: number;
  externalDependencyLatencyMs?: number;
  queueBacklogItems?: number;
  darknetKillSwitchActive?: boolean;
  disabledReason?: string;
  fallbackProviderHealthy?: boolean;
  scraperNativeHealthy?: boolean;
  outerFallbackUsed?: boolean;
}

export interface LiveSearchOpsDto {
  state: LiveSearchState;
  slo: LiveSearchSlo;
  status: "ok" | "warn" | "critical";
  recommendedPollIntervalMs: number;
  backpressure: {
    acceptNewRun: boolean;
    reason?: string;
    retryAfterMs?: number;
  };
  alerts: LiveSearchAlert[];
}

export interface LiveSearchAlert {
  name: string;
  severity: "warn" | "critical";
  message: string;
  value: number;
}

export interface LiveSearchDeployProbe {
  publicTi: {
    url: string;
    status: number;
    body: string;
  };
  apiSearch: {
    url: string;
    status: number;
    json?: unknown;
    body?: string;
  };
}

export interface LiveSearchDeployVerification {
  ok: boolean;
  checks: Array<{
    name: string;
    ok: boolean;
    message: string;
  }>;
}

export interface LiveSearchPollingImpact {
  concurrentClients: number;
  pollIntervalMs: number;
  requestsPerSecond: number;
  requestsPerMinute: number;
  estimatedQueueItemsPerMinute: number;
  estimatedMemoryMb: number;
  status: "ok" | "warn" | "critical";
}

export interface ScraperNativeSearchReadinessProbe {
  scraperHealth: {
    status: number;
    json?: unknown;
  };
  search: {
    status: number;
    json?: unknown;
  };
  cursorPoll: {
    status: number;
    json?: unknown;
  };
  degradedSearch: {
    status: number;
    json?: unknown;
  };
  publicPage: LiveSearchDeployProbe["publicTi"];
  publicApiPost?: LiveSearchDeployProbe["apiSearch"];
  publicApiGet?: LiveSearchDeployProbe["apiSearch"];
  requireGetApiProof?: boolean;
}

export interface ScraperNativeSearchReadiness {
  ok: boolean;
  checks: LiveSearchDeployVerification["checks"];
  rollback: {
    required: boolean;
    reasons: string[];
  };
}

export type LiveSearchSoakScenario = "success" | "degraded_provider" | "scraper_unavailable" | "queue_backlog" | "memory_pressure";

export interface LiveSearchSoakSample {
  scenario: LiveSearchSoakScenario;
  durationHours: number;
  publicQueryCount?: number;
  publicProofOk: boolean;
  scraperNativeProofOk: boolean;
  apiWrapperProofOk: boolean;
  sourceActivationDryRunOk: boolean;
  evidenceWriteReadOk?: boolean;
  graphExportReadinessOk?: boolean;
  publicApiCompatibilityOk?: boolean;
  runReuseOk?: boolean;
  cursorPollingOk?: boolean;
  initialLatencyP95Ms: number;
  partialLatencyP95Ms: number;
  errorRatePercent: number;
  duplicateActiveRuns: number;
  sourceCoveragePercent: number;
  queueAgeP95Seconds: number;
  workerSaturationPercent?: number;
  cpuMaxPercent?: number;
  memoryRssMaxGb: number;
  policyBlocks: number;
  policyBlockRatePercent?: number;
  rejectedUnsafeActions?: number;
  unsafePolicyRetries: number;
  restrictedKillSwitchActive?: boolean;
  sourceUnavailableRatePercent?: number;
  staleCacheRatePercent?: number;
  fallbackUsed: boolean;
}

export interface LiveSearchSoakCriteria {
  durationHours: number;
  initialLatencyP95Ms: number;
  partialLatencyP95Ms: number;
  maxErrorRatePercent: number;
  maxDuplicateActiveRuns: number;
  minSourceCoveragePercent: number;
  maxQueueAgeP95Seconds: number;
  maxWorkerSaturationPercent: number;
  maxCpuPercent: number;
  maxMemoryRssGb: number;
  maxPolicyBlockRatePercent: number;
  maxRejectedUnsafeActions: number;
  maxUnsafePolicyRetries: number;
  maxSourceUnavailableRatePercent: number;
  maxStaleCacheRatePercent: number;
  allowFallbackUse: boolean;
}

export interface LiveSearchSoakReport {
  ok: boolean;
  scenario: LiveSearchSoakScenario;
  status: "promote" | "hold" | "rollback";
  checks: LiveSearchDeployVerification["checks"];
  summary: {
    durationHours: number;
    initialLatencyP95Ms: number;
    partialLatencyP95Ms: number;
    errorRatePercent: number;
    duplicateActiveRuns: number;
    sourceCoveragePercent: number;
    queueAgeP95Seconds: number;
    workerSaturationPercent: number;
    cpuMaxPercent: number;
    memoryRssMaxGb: number;
    policyBlockRatePercent: number;
    sourceUnavailableRatePercent: number;
    staleCacheRatePercent: number;
    rejectedUnsafeActions: number;
    restrictedKillSwitchActive: boolean;
  };
  rollbackReasons: string[];
  statusReport: string;
}

export interface DeploymentDriftHealthEndpoint {
  name: "scraper" | "api" | "frontend" | string;
  url: string;
  status: number;
  ok?: boolean;
  json?: unknown;
  body?: string;
}

export interface DeploymentDriftPublicProof {
  query: string;
  url: string;
  status: number;
  body: string;
}

export interface DeploymentDriftApiProof {
  query: string;
  url: string;
  status: number;
  json?: unknown;
  body?: string;
}

export interface DeploymentDriftRollbackTarget {
  sourceHash: string;
  imageId: string;
  composeConfigHash: string;
  command: string;
}

export interface DeploymentDriftProbe {
  localSourceHash: string;
  remoteSourceHash: string;
  expectedComposeConfigHash: string;
  remoteComposeConfigHash: string;
  expectedImageId: string;
  runningImageId: string;
  healthEndpoints: DeploymentDriftHealthEndpoint[];
  publicProofs: DeploymentDriftPublicProof[];
  apiSearchProofs: DeploymentDriftApiProof[];
  rollbackTarget: DeploymentDriftRollbackTarget;
  randomActorQuery: string;
}

export interface DeploymentDriftReport {
  ok: boolean;
  state: "aligned" | "drift" | "rollback";
  checks: LiveSearchDeployVerification["checks"];
  publicProofs: DeploymentDriftPublicProof[];
  apiSearchProofs: DeploymentDriftApiProof[];
  rollbackTarget: DeploymentDriftRollbackTarget;
  lastKnownGood: {
    sourceHash: string;
    imageId: string;
    composeConfigHash: string;
  };
  blockedPromotionReasons: string[];
}

export interface LiveSearchPromotionSummary {
  ok: boolean;
  status: LiveSearchSoakReport["status"];
  deploymentDriftState: DeploymentDriftReport["state"];
  rollbackTarget: DeploymentDriftRollbackTarget;
  lastKnownGood: DeploymentDriftReport["lastKnownGood"];
  blockedPromotionReasons: string[];
  statusReport: string;
}

export type CutoverWorkstreamName =
  | "source_readiness"
  | "scheduler_readiness"
  | "public_channel_readiness"
  | "restricted_metadata_readiness"
  | "evidence_readiness"
  | "extraction_quality"
  | "graph_readiness"
  | "api_readiness"
  | "deployment_drift"
  | "live_public_proof"
  | "resource_budget"
  | string;

export interface CutoverWorkstreamReadiness {
  name: CutoverWorkstreamName;
  owner: string;
  status: "ready" | "partial" | "blocked" | "rollback";
  proofCommand: string;
  lastKnownGoodState: string;
  rollbackPath: string;
  blockers?: string[];
}

export interface CutoverResourceBudget {
  hostRamGb: number;
  scraperTargetGb: number;
  scraperCeilingGb: number;
  apiGb: number;
  frontendGb: number;
  postgresGb: number;
  openSearchVectorGb: number;
  graphGb: number;
  objectStoreGb: number;
  osCacheAndEmergencyGb: number;
}

export interface CutoverRehearsalInput {
  workstreams: CutoverWorkstreamReadiness[];
  deploymentDrift: DeploymentDriftReport;
  livePublicProofs: DeploymentDriftPublicProof[];
  apiSearchProofs: DeploymentDriftApiProof[];
  randomActorQuery: string;
  resourceBudget: CutoverResourceBudget;
  agent09ApprovedFallbackRemoval: boolean;
  mainAgentDeployGateApproved: boolean;
  fallbackRollbackPath: string;
  lastKnownGoodFallbackState: string;
}

export interface CutoverBlocker {
  name: string;
  severity: "hold" | "rollback";
  owner: string;
  workstream: CutoverWorkstreamName;
  proofCommand: string;
  lastKnownGoodState: string;
  rollbackPath: string;
}

export interface CutoverRehearsalReport {
  ok: boolean;
  decision: "pass" | "hold" | "rollback";
  blockers: CutoverBlocker[];
  requiredPublicProofQueries: string[];
  resourceBudget: {
    ok: boolean;
    totalReservedGb: number;
    spareHeadroomGb: number;
    nonScraperReservedGb: number;
    checks: LiveSearchDeployVerification["checks"];
  };
  rollbackPath: string;
  lastKnownGoodState: string;
  statusReport: string;
}

export type CutoverApplyClassification = "automation-safe" | "human-approval-required" | "blocked" | "rollback-only";

export interface CutoverApplyPlanAction {
  id: string;
  workstream: CutoverWorkstreamName;
  owner: string;
  title: string;
  classification: CutoverApplyClassification;
  applied: boolean;
  preconditions: string[];
  expectedEffect: string;
  rollback: string;
  policyImpact: string;
  proofCommand: string;
  promotionBlockers?: string[];
}

export interface CutoverApplyPlanInput {
  rehearsal: CutoverRehearsalReport;
  actions: CutoverApplyPlanAction[];
  deploymentDrift: DeploymentDriftReport;
  agent09ApiReady: boolean;
  resourceBudget: CutoverResourceBudget;
  leaderThreadContext: string;
}

export interface CutoverApplyPlanPacket {
  ok: boolean;
  decision: "pass" | "hold" | "rollback";
  classificationCounts: Record<CutoverApplyClassification, number>;
  actions: CutoverApplyPlanAction[];
  blockers: CutoverBlocker[];
  resourceBudget: CutoverRehearsalReport["resourceBudget"];
  dryRunOutput: string;
}

export type CutoverMountedRouteProofStatus = "passed" | "present" | "missing" | "stale" | "documented_only" | "failed";

export interface CutoverMountedRouteProof {
  name: string;
  owner: string;
  status: CutoverMountedRouteProofStatus;
  localCommand: string;
  inspurCommand: string;
  expectedOutput: string;
  endpoint?: string;
  rollbackPath: string;
}

export interface CutoverPromotionPacketInput extends CutoverApplyPlanInput {
  workstreams?: CutoverWorkstreamReadiness[];
  livePublicProofs?: DeploymentDriftPublicProof[];
  apiSearchProofs?: DeploymentDriftApiProof[];
  mountedRouteProofs?: CutoverMountedRouteProof[];
  fallbackRollbackPath?: string;
  lastKnownGoodFallbackState?: string;
  generatedAt?: string;
}

export interface CutoverPromotionPacket {
  schemaVersion: "ti.cutover.promotion_packet.v1";
  generatedAt: string;
  decision: CutoverApplyPlanPacket["decision"];
  ok: boolean;
  context: string;
  applyPlan: {
    actionIds: string[];
    sections: Array<{
      id: string;
      workstream: CutoverWorkstreamName;
      owner: string;
      classification: CutoverApplyClassification;
      applied: boolean;
      proofCommand: string;
    }>;
    classificationCounts: Record<CutoverApplyClassification, number>;
  };
  workstreams: Array<{
    name: CutoverWorkstreamName;
    owner: string;
    status: CutoverWorkstreamReadiness["status"];
    proofCommand: string;
    rollbackPath: string;
  }>;
  liveProof: Array<{
    query: string;
    publicUrl?: string;
    publicStatus?: number;
    apiUrl?: string;
    apiStatus?: number;
    ok: boolean;
  }>;
  mountedRouteProofs: Array<{
    name: string;
    owner: string;
    status: CutoverMountedRouteProofStatus;
    localCommand: string;
    inspurCommand: string;
    expectedOutput: string;
    endpoint?: string;
  }>;
  blockerAwareGate: Array<{
    name: "agent03_clear_web" | "agent09_compatibility";
    owner: string;
    classification: "pass" | "warning" | "blocker";
    status: string;
    proofNames: string[];
  }>;
  resourceBudget: CutoverRehearsalReport["resourceBudget"] & {
    scraperTargetGb: number;
    scraperCeilingGb: number;
  };
  deploymentDrift: {
    state: DeploymentDriftReport["state"];
    ok: boolean;
    blockedPromotionReasons: string[];
    rollbackTarget: DeploymentDriftRollbackTarget;
    lastKnownGood: DeploymentDriftReport["lastKnownGood"];
  };
  blockers: CutoverBlocker[];
  rollbackPaths: string[];
  ownerAssignments: Record<string, string[]>;
  proofCommands: string[];
  leaderMarkdown: string;
}

export type CutoverReleaseDecision = "promote" | "promote-with-warnings" | "hold-on-blocker" | "rollback" | "continue-soak" | "emergency-stop";

export interface CutoverSoakWorkstreamInput {
  name: CutoverWorkstreamName;
  owner: string;
  classification: "pass" | "warning" | "blocker";
  proofCommand: string;
  blocker?: string;
  warning?: string;
  lastKnownGoodState: string;
  rollbackPath: string;
}

export type CutoverRuntimeReleaseProofName =
  | "activation_batches"
  | "source_runtime_sla"
  | "queue_economics"
  | "scheduler_runtime_sla"
  | "clear_web_blocker_status"
  | "public_channel_answer_readiness"
  | "public_channel_sla"
  | "restricted_kill_switch"
  | "restricted_metadata_sla"
  | "claim_ledger"
  | "claim_ledger_route_proof"
  | "answer_review_gates"
  | "answer_readiness_sla"
  | "graph_export_gates"
  | "graph_export_sla"
  | "api_cutover_proof"
  | "api_readiness_sla";

export interface CutoverRuntimeReleaseProof {
  name: CutoverRuntimeReleaseProofName;
  owner: string;
  status: "pass" | "warning" | "blocker";
  proofCommand: string;
  rollbackPath: string;
  lastKnownGoodState: string;
  resourceBudgetStatus: "ok" | "warning" | "critical";
  message: string;
  publicChannelSla?: TelegramPublicSlaReportDto;
  graphExportSla?: GraphExportSlaDto;
  graphExportEnforcement?: GraphExportEnforcementDto;
}

export type CutoverDeploymentProofSlotName =
  | "local_tests"
  | "remote_typecheck"
  | "route_inventory"
  | "contracts_route"
  | "docker_image_test_enforcement"
  | "public_post_api_proof"
  | "frontend_ti_query_proof"
  | "memory_budget"
  | "non_scraper_500gb_reserve"
  | "restricted_emergency_stop"
  | "stray_root_advisory";

export interface CutoverDeploymentProofSlot {
  name: CutoverDeploymentProofSlotName;
  owner: "Agent 10";
  status: "pass" | "warning" | "blocker";
  proofCommand: string;
  localCommand: string;
  remoteCommand: string;
  expectedOutput: string;
  rollbackPath: string;
  message: string;
}

export type CutoverReleaseTrainStageName =
  | "local_proof"
  | "remote_proof"
  | "docker_and_route_inventory"
  | "public_api_and_frontend_proof"
  | "resource_and_queue_headroom"
  | "source_and_channel_readiness"
  | "safety_and_retention"
  | "evidence_graph_api_holds"
  | "release_decision";

export interface CutoverReleaseTrainStage {
  name: CutoverReleaseTrainStageName;
  owner: "Agent 10";
  status: "pass" | "warning" | "blocker";
  decisionImpact: CutoverReleaseDecision;
  proofCommands: string[];
  expectedOutput: string;
  rollbackPath: string;
  message: string;
}

export interface CutoverReleaseTrainOrchestration {
  windowHours: 24;
  currentDecision: CutoverReleaseDecision;
  stages: CutoverReleaseTrainStage[];
  localProofCommands: string[];
  remoteProofCommands: string[];
  publicProofCommands: string[];
  resourceGuardrails: {
    scraperTargetGb: number;
    scraperCeilingGb: number;
    nonScraperReservedGb: number;
    queueAgeP95Seconds: number;
    memoryRssMaxGb: number;
  };
  staleBlockers: string[];
  strayRootHandling: "advisory_no_deletion";
}

export type ReleaseCandidateDecision = "no-go" | "canary-only" | "promote-with-warnings" | "promote" | "rollback" | "emergency-stop";

export type ReleaseCandidateProofName =
  | "local_proof"
  | "remote_proof"
  | "docker_image_build_test_enforcement"
  | "route_inventory_count"
  | "contracts_route"
  | "public_post_api_proof"
  | "frontend_ti_query_proof"
  | "source_canary_readiness"
  | "worker_slo_soak"
  | "public_channel_canary"
  | "restricted_certification"
  | "evidence_cutover"
  | "graph_export_certification"
  | "memory_headroom"
  | "non_scraper_500gb_reserve"
  | "queue_pressure"
  | "agent03_fail_closed"
  | "stray_root_advisory";

export interface ReleaseCandidateProofSlot {
  name: ReleaseCandidateProofName;
  owner: "Agent 10";
  status: "pass" | "warning" | "blocker";
  proofCommand: string;
  expectedOutput: string;
  rollbackPath: string;
  message: string;
}

export interface ReleaseCandidateGatePacket {
  schemaVersion: "ti.release_candidate.gate_packet.v1";
  decision: ReleaseCandidateDecision;
  releaseDecision: CutoverReleaseDecision;
  routeInventoryCount: number;
  routeInventoryExpectedMinimum: number;
  proofSlots: ReleaseCandidateProofSlot[];
  rolloutRunbook: string[];
  guardrails: {
    scraperTargetGb: number;
    scraperCeilingGb: number;
    nonScraperReservedGb: number;
    memoryRssMaxGb: number;
    queueAgeP95Seconds: number;
    strayRootHandling: "advisory_no_deletion";
  };
  blockers: string[];
  warnings: string[];
}

export type CanaryReleaseExecutionDecision = "no-go" | "canary-ready" | "canary-with-warnings" | "rollback" | "emergency-stop";

export type CanaryReleaseExecutionProofName =
  | "source_activation_canary"
  | "scheduler_soak_telemetry"
  | "public_channel_promotion_canary"
  | "restricted_kill_switch_drill"
  | "evidence_persistence_certification"
  | "public_answer_polling_contract"
  | "graph_export_certification"
  | "contracts_route"
  | "public_post_api_proof"
  | "frontend_ti_query_proof"
  | "docker_image_test_enforcement"
  | "route_inventory"
  | "remote_drift"
  | "memory_headroom"
  | "non_scraper_500gb_reserve"
  | "queue_pressure"
  | "agent03_fail_closed"
  | "stray_root_advisory";

export interface CanaryReleaseExecutionProof {
  name: CanaryReleaseExecutionProofName;
  status: "pass" | "warning" | "blocker";
  sourceProof: ReleaseCandidateProofName | "remote_drift";
  proofCommand: string;
  expectedOutput: string;
  rollbackStep: string;
}

export interface CanaryReleaseExecutionPacket {
  schemaVersion: "ti.canary_release.execution_packet.v1";
  dryRun: true;
  decision: CanaryReleaseExecutionDecision;
  rcDecision: ReleaseCandidateDecision;
  proof: CanaryReleaseExecutionProof[];
  rollbackSteps: string[];
  operatorSignoff: {
    required: boolean;
    signedOff: boolean;
    fields: Array<"main_agent_approval" | "agent03_clear_web_current" | "restricted_safety_ack" | "rollback_target_ack" | "resource_budget_ack">;
  };
  guardrails: ReleaseCandidateGatePacket["guardrails"];
  strayRootHandling: "advisory_no_deletion";
}

export type FinalRcBoardDecision =
  | "no-go"
  | "canary-only"
  | "canary-ready"
  | "canary-with-warnings"
  | "promote-with-warnings"
  | "promote"
  | "rollback"
  | "emergency-stop";

export type FinalRcBoardGateName =
  | "agent01_source_readiness"
  | "agent02_scheduler_readiness"
  | "agent03_clear_web_fail_closed"
  | "agent04_public_channel_readiness"
  | "agent05_restricted_safety"
  | "agent06_evidence_readiness"
  | "agent07_answer_quality"
  | "agent08_graph_export_readiness"
  | "agent09_api_readiness"
  | "agent10_deployment_proof";

export interface FinalRcBoardGate {
  name: FinalRcBoardGateName;
  owner: string;
  status: "pass" | "warning" | "blocker";
  proofCommands: string[];
  rollbackPath: string;
  message: string;
}

export interface FinalRcBoardPacket {
  schemaVersion: "ti.final_rc.board.v1";
  dryRun: true;
  decision: FinalRcBoardDecision;
  releaseDecision: CutoverReleaseDecision;
  rcDecision: ReleaseCandidateDecision;
  canaryDecision: CanaryReleaseExecutionDecision;
  gates: FinalRcBoardGate[];
  proofCommands: string[];
  rollbackProcedures: string[];
  routeTruthAudit: {
    routeInventoryCount: number;
    expectedMinimum: number;
    contractsRouteStatus: ReleaseCandidateProofSlot["status"];
    proofCommand: string;
  };
  publicProofSlots: {
    publicPostApi: ReleaseCandidateProofSlot["status"];
    frontendTiQuery: ReleaseCandidateProofSlot["status"];
    proofCommands: string[];
  };
  resourceHeadroom: {
    scraperTargetGb: number;
    scraperCeilingGb: number;
    nonScraperReservedGb: number;
    memoryRssMaxGb: number;
    preserveCtiReserveGb: 500;
    status: "pass" | "warning" | "blocker";
  };
  queuePressure: {
    p95Seconds: number;
    status: "pass" | "warning" | "blocker";
  };
  agent03FailClosed: {
    active: boolean;
    status: "pass" | "blocker";
    proofCommand: string;
  };
  operatorSignoff: {
    required: boolean;
    signedOff: boolean;
    fields: Array<"main_agent_approval" | "agent03_clear_web_current" | "restricted_safety_ack" | "rollback_target_ack" | "resource_budget_ack" | "public_proof_ack" | "route_truth_ack">;
  };
  strayRootHandling: "advisory_no_deletion";
}

export type ProductTiReleaseBoardDecision =
  | "no-go"
  | "partial-public-ok"
  | "canary-ready"
  | "canary-with-warnings"
  | "promote-with-warnings"
  | "promote"
  | "rollback"
  | "emergency-stop";

export type ProductTiPublicProofQuery = "APT29" | "APT42" | "Turla" | "Akira" | "random_actor" | "made_up_actor" | "CVE-2024-3094";

export interface ProductTiReleaseBoardProof {
  name: string;
  status: "pass" | "warning" | "blocker";
  proofCommand: string;
  expectedOutput: string;
  rollbackPath: string;
}

export interface ProductTiReleaseBoardPacket {
  schemaVersion: "ti.product_ti.release_board.v1";
  dryRun: true;
  decision: ProductTiReleaseBoardDecision;
  rcBoardDecision: FinalRcBoardDecision;
  responsivePublicSearch: {
    noDefaultQuery: boolean;
    noDemoContent: boolean;
    honestFreshness: boolean;
    updatesWithoutRefresh: boolean;
    policyGatedSourcesDoNotBlockPublicEvidence: boolean;
  };
  publicApiProofs: Array<{
    query: ProductTiPublicProofQuery;
    status: "pass" | "warning" | "blocker";
    proofCommand: string;
    expectedOutput: string;
  }>;
  frontendProof: {
    emptyPageNoDefaultApt29: "pass" | "warning" | "blocker";
    queryPageLiveMarkers: "pass" | "warning" | "blocker";
    proofCommand: string;
  };
  pollingProof: {
    targetSeconds: 3;
    recommendedSeconds: number;
    status: "pass" | "warning" | "blocker";
    proofCommand: string;
  };
  scraperHealth: {
    status: "pass" | "warning" | "blocker";
    proofCommands: string[];
  };
  agentStatus: {
    agent03: "active" | "pass" | "warning" | "blocker";
    agent06: "active" | "pass" | "warning" | "blocker";
    proofCommands: string[];
  };
  noLeakGuarantees: ProductTiReleaseBoardProof[];
  resourceHeadroom: FinalRcBoardPacket["resourceHeadroom"];
  queuePressure: FinalRcBoardPacket["queuePressure"];
  routeTruthAudit: FinalRcBoardPacket["routeTruthAudit"];
  proofCommands: string[];
  rollbackCommands: string[];
  operatorSignoff: FinalRcBoardPacket["operatorSignoff"];
}

export type RealTimeSearchReleaseBoardDecision = ProductTiReleaseBoardDecision;

export type RealTimeSearchProofScenario =
  | "immediate_first_response"
  | "three_second_polling"
  | "same_run_reuse"
  | "cursor_advancement"
  | "empty_deltas"
  | "clear_web_capture_deltas"
  | "public_channel_hint_deltas"
  | "restricted_held_deltas"
  | "graph_stix_deltas"
  | "claim_ledger_holds"
  | "contradiction_downgrades"
  | "no_result_searching"
  | "provider_unavailable"
  | "scraper_unavailable"
  | "queue_pressure"
  | "stale_source_caveats"
  | "low_confidence"
  | "policy_block"
  | "no_leak_output"
  | "memory_budget"
  | "worker_queue_headroom"
  | "frontend_no_default"
  | "public_post_compatibility"
  | "remote_container_health";

export type RealTimeSearchProofQuery =
  | "APT29"
  | "APT42"
  | "Turla"
  | "Volt Typhoon"
  | "Scattered Spider"
  | "Akira"
  | "random_actor"
  | "made_up_actor"
  | "CVE-2024-3094"
  | "malware_tool"
  | "victim_ransomware"
  | "country"
  | "sector";

export interface RealTimeSearchReleaseBoardPacket {
  schemaVersion: "ti.realtime_search.release_board.v1";
  dryRun: true;
  decision: RealTimeSearchReleaseBoardDecision;
  productTiDecision: ProductTiReleaseBoardDecision;
  rcBoardDecision: FinalRcBoardDecision;
  pollingSlo: {
    firstResponseImmediate: boolean;
    targetPollSeconds: 3;
    recommendedPollSeconds: number;
    sameRunReuse: boolean;
    cursorAdvancement: boolean;
    emptyDeltasAllowed: boolean;
    status: "pass" | "warning" | "blocker";
  };
  scenarioGates: Array<{
    scenario: RealTimeSearchProofScenario;
    owner: string;
    status: "pass" | "warning" | "blocker";
    proofCommand: string;
    expectedOutput: string;
    rollbackPath: string;
  }>;
  queryMatrix: Array<{
    query: RealTimeSearchProofQuery;
    queryClass: "actor" | "cve" | "malware_tool" | "victim_ransomware" | "country" | "sector";
    status: "pass" | "warning" | "blocker";
    proofCommand: string;
    expectedOutput: string;
  }>;
  integrations: {
    contractsRoute: "pass" | "warning" | "blocker";
    intelSearchRoute: "pass" | "warning" | "blocker";
    schedulerSlo: "pass" | "warning" | "blocker";
    evidenceClaimLedger: "pass" | "warning" | "blocker";
    answerDeltas: "pass" | "warning" | "blocker";
    graphStixDeltas: "pass" | "warning" | "blocker";
    publicWrapperProof: "pass" | "warning" | "blocker";
  };
  resourceHeadroom: FinalRcBoardPacket["resourceHeadroom"];
  queuePressure: FinalRcBoardPacket["queuePressure"];
  noLeakGuarantees: ProductTiReleaseBoardProof[];
  proofCommands: string[];
  rollbackCommands: string[];
}

export type ProductionObservabilityDecision = "ready" | "watch" | "hold" | "rollback" | "emergency-stop";

export type ProductionObservabilityMetricName =
  | "initial_latency_p95_ms"
  | "partial_latency_p95_ms"
  | "queue_age_p95_seconds"
  | "worker_saturation_percent"
  | "memory_rss_max_gb"
  | "cpu_max_percent"
  | "adapter_failure_rate_percent"
  | "source_unavailable_rate_percent"
  | "policy_block_rate_percent"
  | "evidence_write_read_proof"
  | "graph_export_readiness"
  | "public_proof_matrix";

export interface ProductionObservabilityMetric {
  name: ProductionObservabilityMetricName;
  value: number;
  warnAt: number;
  criticalAt: number;
  unit: "ms" | "seconds" | "percent" | "gb" | "boolean" | "count";
  status: "pass" | "warning" | "blocker";
  alertName: string;
  proofCommand: string;
  runbookAction: string;
}

export interface ProductionFailureClassification {
  name:
    | "latency"
    | "queue"
    | "worker"
    | "resource"
    | "source"
    | "policy"
    | "evidence"
    | "graph"
    | "public_proof"
    | "deployment"
    | "restricted_safety";
  status: "pass" | "warning" | "blocker";
  rollbackTrigger: string;
  owner: string;
  runbookAction: string;
}

export interface ProductionObservabilityDashboardPacket {
  schemaVersion: "ti.production_observability.dashboard.v1";
  dryRun: true;
  decision: ProductionObservabilityDecision;
  generatedAt: string;
  sloDashboard: {
    windowHours: 24;
    metrics: ProductionObservabilityMetric[];
    alertThresholds: Array<{
      metric: ProductionObservabilityMetricName;
      warnAt: number;
      criticalAt: number;
      unit: ProductionObservabilityMetric["unit"];
      alertName: string;
    }>;
  };
  soakAutomation: {
    command: string;
    cadenceSeconds: 60;
    durationHours: 24;
    checkpointsHours: number[];
    proofCommands: string[];
    environment: {
      scraperTargetGb: 96;
      scraperCeilingGb: 160;
      preserveCtiReserveGb: 500;
      assumesGpu: false;
    };
  };
  publicProofMatrix: Array<{
    query: string;
    publicStatus?: number;
    apiStatus?: number;
    status: "pass" | "warning" | "blocker";
  }>;
  failureClassification: ProductionFailureClassification[];
  rollbackDecisionPacket: {
    decision: ProductionObservabilityDecision;
    triggers: string[];
    rollbackCommands: string[];
    operatorRunbook: string[];
  };
  proofCommands: string[];
}

export type EnterpriseReleaseDecision = "no-go" | "canary-ready" | "canary-with-warnings" | "promote-with-warnings" | "promote" | "rollback" | "emergency-stop";

export interface DisasterRecoveryProof {
  name:
    | "evidence_export_manifest"
    | "claim_ledger_replay"
    | "graph_export_replay"
    | "source_registry_backup"
    | "scheduler_queue_drain"
    | "public_wrapper_rollback"
    | "container_rollback";
  status: "pass" | "warning" | "blocker";
  proofCommand: string;
  restoreCommand: string;
  expectedRecoveryMinutes: number;
  noLeakExample: string;
}

export interface EnterpriseCapacityPlan {
  hostRamGb: number;
  scraperTargetGb: 96;
  scraperCeilingGb: 160;
  preserveCtiReserveGb: 500;
  nonScraperReservedGb: number;
  browserPool: "disabled_until_explicitly_allocated";
  assumesGpu: false;
  boundedCaches: true;
  diskFirstEvidence: true;
  status: "pass" | "warning" | "blocker";
  allocations: Array<{
    service: "scraper" | "api" | "frontend" | "postgres" | "search_vector" | "graph" | "object_store" | "os_cache_emergency";
    reservedGb: number;
    notes: string;
  }>;
  workerCaps: {
    clearWebWorkers: number;
    publicChannelWorkers: number;
    restrictedMetadataWorkers: number;
    browserWorkers: 0;
  };
}

export interface EnterpriseReleaseTrainPacket {
  schemaVersion: "ti.enterprise_release_train.v1";
  dryRun: true;
  decision: EnterpriseReleaseDecision;
  stages: Array<{
    name: "local_contract_green" | "route_inventory_green" | "public_proof_matrix_green" | "canary_ready" | "canary_with_warnings" | "promote_with_warnings" | "promote" | "rollback" | "emergency_stop" | "no_go";
    status: "pass" | "warning" | "blocker";
    proofCommand: string;
    operatorAction: string;
  }>;
  disasterRecovery: {
    proofs: DisasterRecoveryProof[];
    rollbackCommands: string[];
    backupManifests: string[];
  };
  capacityPlan: EnterpriseCapacityPlan;
  dependencyHealth: Array<{
    name: "scraper" | "api" | "frontend" | "docker" | "route_inventory" | "contract_index" | "public_proof_matrix" | "source_freshness" | "evidence_writes" | "graph_export_holds" | "restricted_metadata_safety" | "queue_headroom";
    status: "pass" | "warning" | "blocker";
    proofCommand: string;
  }>;
  noLeakReleaseExamples: string[];
  operatorRunbook: string[];
  proofCommands: string[];
}

export interface CutoverSoakTrendDeltas {
  publicQueries: number;
  runReuse: {
    duplicateActiveRuns: number;
    ok: boolean;
  };
  cursorPolling: {
    ok: boolean;
    partialToReady: number;
  };
  sourceSlo: {
    minCoveragePercent: number;
    deltaPercent: number;
  };
  queuePressure: {
    p95Seconds: number;
    deltaSeconds: number;
  };
  resources: {
    memoryRssMaxGb: number;
    cpuMaxPercent: number;
  };
  unsafeRejections: {
    rejectedUnsafeActions: number;
  };
  restrictedKillSwitch: {
    active: boolean;
  };
  rollbackTriggers: string[];
}

export interface CutoverSoakReleasePacketInput {
  generatedAt?: string;
  soak: LiveSearchSoakReport;
  deploymentDrift: DeploymentDriftReport;
  promotionPacket: CutoverPromotionPacket;
  workstreams: CutoverSoakWorkstreamInput[];
  runtimeProofs?: CutoverRuntimeReleaseProof[];
  deploymentProofs?: CutoverDeploymentProofSlot[];
  releaseTrainStages?: CutoverReleaseTrainStage[];
  trends: CutoverSoakTrendDeltas;
}

export interface CutoverSoakReleasePacket {
  schemaVersion: "ti.cutover.soak_release_packet.v1";
  generatedAt: string;
  decision: CutoverReleaseDecision;
  ok: boolean;
  soakStatus: LiveSearchSoakReport["status"];
  deploymentDriftState: DeploymentDriftReport["state"];
  resourceBudget: CutoverPromotionPacket["resourceBudget"];
  lastKnownGoodImageState: string;
  workstreams: CutoverSoakWorkstreamInput[];
  runtimeProofs: CutoverRuntimeReleaseProof[];
  deploymentProofs: CutoverDeploymentProofSlot[];
  releaseTrain: CutoverReleaseTrainOrchestration;
  rcGate: ReleaseCandidateGatePacket;
  canaryExecution: CanaryReleaseExecutionPacket;
  rcBoard: FinalRcBoardPacket;
  productTiBoard: ProductTiReleaseBoardPacket;
  realTimeSearchBoard: RealTimeSearchReleaseBoardPacket;
  observabilityDashboard: ProductionObservabilityDashboardPacket;
  enterpriseReleaseTrain: EnterpriseReleaseTrainPacket;
  trends: CutoverSoakTrendDeltas;
  blockers: Array<{
    owner: string;
    name: string;
    proofCommand: string;
    rollbackPath: string;
  }>;
  warnings: Array<{
    owner: string;
    name: string;
    proofCommand: string;
  }>;
  nextProofCommands: string[];
  statusReport: string;
}

export const CUTOVER_MOUNTED_ROUTE_PROOF_REQUIREMENTS: ReadonlyArray<Omit<CutoverMountedRouteProof, "status" | "rollbackPath">> = [
  {
    name: "source",
    owner: "Agent 01",
    localCommand: "bun run check:source-apply-plan",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:source-apply-plan'",
    expectedOutput: "pass /v1/sources/apply-plan dryRun=true willMutate=false",
    endpoint: "/v1/sources/apply-plan"
  },
  {
    name: "frontier",
    owner: "Agent 02",
    localCommand: "bun run check:frontier-apply-plan",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:frontier-apply-plan'",
    expectedOutput: "ok=true endpoint=/v1/frontier/apply-plan queue/lease/run unchanged",
    endpoint: "/v1/frontier/apply-plan"
  },
  {
    name: "clear_web",
    owner: "Agent 03",
    localCommand: "bun test src/tests/adapterFixtures.test.ts",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && bun test src/tests/adapterFixtures.test.ts'",
    expectedOutput: "pass clear-web discovery/capture fixtures",
    endpoint: "/v1/intel/search"
  },
  {
    name: "agent03_status",
    owner: "Agent 03",
    localCommand: "rg '^Status: clear_web_promotion' coordination_agent_03.md",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && rg \"^Status: clear_web_promotion\" coordination_agent_03.md'",
    expectedOutput: "top-of-file Status: clear_web_promotion from Agent 03",
    endpoint: "coordination_agent_03.md"
  },
  {
    name: "public_channel",
    owner: "Agent 04",
    localCommand: "bun test src/tests/api.test.ts",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && bun test src/tests/api.test.ts'",
    expectedOutput: "pass /v1/public-channels/apply-plan no unsafe fields",
    endpoint: "/v1/public-channels/apply-plan"
  },
  {
    name: "restricted_metadata",
    owner: "Agent 05",
    localCommand: "bun run check:restricted-metadata-apply-plan",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:restricted-metadata-apply-plan'",
    expectedOutput: "pass restricted metadata apply-plan metadata-only",
    endpoint: "/v1/restricted-metadata/apply-plan"
  },
  {
    name: "evidence",
    owner: "Agent 06",
    localCommand: "bun test src/tests/api.test.ts",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && bun test src/tests/api.test.ts'",
    expectedOutput: "pass evidence replay/cutover DTOs without sensitive fields",
    endpoint: "/v1/evidence/replay-plan"
  },
  {
    name: "quality",
    owner: "Agent 07",
    localCommand: "bun run check:search-quality-mounted",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:search-quality-mounted'",
    expectedOutput: "ok=true for /v1/intel/search.quality and /v1/quality/evaluate",
    endpoint: "/v1/quality/evaluate"
  },
  {
    name: "graph",
    owner: "Agent 08",
    localCommand: "bun run check:graph-review-mounted",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:graph-review-mounted'",
    expectedOutput: "ok=true for graph review/cutover mounted endpoint proof",
    endpoint: "/v1/graph/review-plan"
  },
  {
    name: "stix_readiness",
    owner: "Agent 08",
    localCommand: "bun run check:graph-review-mounted",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:graph-review-mounted'",
    expectedOutput: "ok=true for /v1/exports/stix readiness without publishing",
    endpoint: "/v1/exports/stix"
  },
  {
    name: "route_inventory",
    owner: "Agent 09",
    localCommand: "bun run check:route-inventory",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:route-inventory'",
    expectedOutput: "pass mounted /v1 route inventory and dry-run API contracts",
    endpoint: "/v1"
  },
  {
    name: "scraper_native_search",
    owner: "Agent 09",
    localCommand: "TI_SCRAPER_INTERNAL_BASE=http://127.0.0.1:8097 bun run check:scraper-native-search",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && TI_SCRAPER_INTERNAL_BASE=http://ti-scraper:8097 bun run check:scraper-native-search'",
    expectedOutput: "ok=true scraper-native /v1/intel/search readiness",
    endpoint: "/v1/intel/search"
  },
  {
    name: "agent09_readiness_report",
    owner: "Agent 09",
    localCommand: "rg '^Status: api_readiness_report' coordination_agent_09.md",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && rg \"^Status: api_readiness_report\" coordination_agent_09.md'",
    expectedOutput: "top-of-file Status: api_readiness_report from Agent 09",
    endpoint: "coordination_agent_09.md"
  },
  {
    name: "rehearsal",
    owner: "Agent 10",
    localCommand: "bun run rehearse:cutover examples/cutover-rehearsal-pass.json",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run rehearse:cutover examples/cutover-rehearsal-pass.json'",
    expectedOutput: "decision=pass resources green public proof green",
    endpoint: "cli:rehearse:cutover"
  },
  {
    name: "apply_plan",
    owner: "Agent 10",
    localCommand: "bun run plan:cutover examples/cutover-rehearsal-pass.json",
    inspurCommand: "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run plan:cutover examples/cutover-rehearsal-pass.json'",
    expectedOutput: "decision=pass promotion packet schema ti.cutover.promotion_packet.v1",
    endpoint: "cli:plan:cutover"
  }
];

export const DEFAULT_LIVE_SEARCH_SLO: LiveSearchSlo = {
  initialResponseMs: 1_000,
  partialResultMs: 5_000,
  recommendedPollIntervalMs: 2_000,
  maxPollIntervalMs: 10_000,
  maxActiveRunsPerTenantQuery: 1,
  providerFailureBudgetPercent: 2,
  zeroResultBudgetPercent: 25
};

export const DEFAULT_LIVE_SEARCH_SOAK_CRITERIA: LiveSearchSoakCriteria = {
  durationHours: 24,
  initialLatencyP95Ms: 1_000,
  partialLatencyP95Ms: 5_000,
  maxErrorRatePercent: 2,
  maxDuplicateActiveRuns: 0,
  minSourceCoveragePercent: 80,
  maxQueueAgeP95Seconds: 60,
  maxWorkerSaturationPercent: 75,
  maxCpuPercent: 85,
  maxMemoryRssGb: 96,
  maxPolicyBlockRatePercent: 10,
  maxRejectedUnsafeActions: 0,
  maxUnsafePolicyRetries: 0,
  maxSourceUnavailableRatePercent: 10,
  maxStaleCacheRatePercent: 5,
  allowFallbackUse: false
};

export function buildLiveSearchOpsDto(
  observation: LiveSearchObservation,
  slo: LiveSearchSlo = DEFAULT_LIVE_SEARCH_SLO
): LiveSearchOpsDto {
  const alerts = liveSearchAlerts(observation, slo);
  const status = alerts.some((alert) => alert.severity === "critical")
    ? "critical"
    : alerts.length > 0 || observation.state === "degraded"
      ? "warn"
      : "ok";
  const duplicateRun = (observation.activeRunsForQuery ?? 0) > slo.maxActiveRunsPerTenantQuery;
  const blocked = observation.state === "blocked" || observation.state === "disabled" || observation.darknetKillSwitchActive === true;
  const overloaded = observation.state === "degraded" || duplicateRun || (observation.queueBacklogItems ?? 0) > 0;
  const recommendedPollIntervalMs = overloaded ? slo.maxPollIntervalMs : slo.recommendedPollIntervalMs;

  return {
    state: observation.state,
    slo,
    status,
    recommendedPollIntervalMs,
    backpressure: {
      acceptNewRun: !blocked && !duplicateRun && observation.state !== "searching",
      reason: backpressureReason(observation, duplicateRun),
      retryAfterMs: blocked ? undefined : recommendedPollIntervalMs
    },
    alerts
  };
}

export function recordLiveSearchMetrics(
  metrics: MetricsRegistry,
  observation: LiveSearchObservation,
  slo: LiveSearchSlo = DEFAULT_LIVE_SEARCH_SLO
): LiveSearchOpsDto {
  const labels = {
    state: observation.state,
    provider: observation.provider
  };
  const ops = buildLiveSearchOpsDto(observation, slo);

  metrics.increment("scraper_live_search_requests_total", 1, labels);
  metrics.gauge("scraper_live_search_poll_count", observation.pollCount ?? 0, labels);
  metrics.gauge("scraper_live_search_active_runs_for_query", observation.activeRunsForQuery ?? 0, labels);
  metrics.gauge("scraper_live_search_source_activation_gaps", observation.sourceActivationGaps ?? 0, labels);
  metrics.gauge("scraper_live_search_provider_failures", observation.providerFailures ?? 0, labels);
  metrics.gauge("scraper_live_search_results_last", observation.resultCount ?? 0, labels);
  metrics.gauge("scraper_live_search_recommended_poll_interval_ms", ops.recommendedPollIntervalMs, labels);
  metrics.gauge("scraper_live_search_fallback_provider_healthy", observation.fallbackProviderHealthy === false ? 0 : 1, labels);
  metrics.gauge("scraper_live_search_scraper_native_healthy", observation.scraperNativeHealthy === false ? 0 : 1, labels);
  metrics.gauge("scraper_live_search_outer_fallback_used", observation.outerFallbackUsed ? 1 : 0, labels);

  if (observation.initialResponseMs !== undefined) {
    metrics.gauge("scraper_live_search_initial_response_ms", observation.initialResponseMs, labels);
  }
  if (observation.partialResultMs !== undefined) {
    metrics.gauge("scraper_live_search_partial_result_ms", observation.partialResultMs, labels);
  }
  if (observation.externalDependencyLatencyMs !== undefined) {
    metrics.gauge("scraper_live_search_external_dependency_latency_ms", observation.externalDependencyLatencyMs, labels);
  }
  if ((observation.resultCount ?? 0) === 0) {
    metrics.increment("scraper_live_search_zero_result_total", 1, { provider: observation.provider });
  }

  return ops;
}

export function evaluateLiveSearchMetricAlerts(
  samples: MetricSample[],
  slo: LiveSearchSlo = DEFAULT_LIVE_SEARCH_SLO
): LiveSearchAlert[] {
  let requests = 0;
  let zeroResults = 0;
  const alerts: LiveSearchAlert[] = [];

  for (const sample of samples) {
    if (sample.name === "scraper_live_search_requests_total") requests += sample.value;
    if (sample.name === "scraper_live_search_zero_result_total") zeroResults += sample.value;
    if (sample.name === "scraper_live_search_active_runs_for_query" && sample.value > slo.maxActiveRunsPerTenantQuery) {
      alerts.push({
        name: "live_search_duplicate_active_runs",
        severity: "warn",
        message: "duplicate active live-search runs should be reused instead of started again",
        value: sample.value
      });
    }
    if (sample.name === "scraper_live_search_provider_failures" && sample.value > 0) {
      alerts.push({
        name: "live_search_provider_failures",
        severity: sample.value >= 3 ? "critical" : "warn",
        message: "live-search provider failures are consuming the failure budget",
        value: sample.value
      });
    }
    if (sample.name === "scraper_live_search_fallback_provider_healthy" && sample.value === 0) {
      alerts.push({
        name: "live_search_fallback_provider_down",
        severity: "warn",
        message: "temporary outer fallback provider is unhealthy",
        value: sample.value
      });
    }
    if (sample.name === "scraper_live_search_scraper_native_healthy" && sample.value === 0) {
      alerts.push({
        name: "live_search_scraper_native_down",
        severity: "critical",
        message: "scraper-native live-search endpoint is unhealthy",
        value: sample.value
      });
    }
    if (sample.name === "scraper_live_search_outer_fallback_used" && sample.value > 0) {
      alerts.push({
        name: "live_search_outer_fallback_usage",
        severity: "warn",
        message: "public /ti is still using the temporary outer fallback",
        value: sample.value
      });
    }
  }

  if (requests > 0) {
    const zeroRate = (zeroResults / requests) * 100;
    if (zeroRate > slo.zeroResultBudgetPercent) {
      alerts.push({
        name: "live_search_zero_result_rate",
        severity: zeroRate >= slo.zeroResultBudgetPercent * 2 ? "critical" : "warn",
        message: `zero-result live searches are ${zeroRate.toFixed(1)}% of requests`,
        value: zeroRate
      });
    }
  }

  return alerts.sort((a, b) => a.name.localeCompare(b.name));
}

export function verifyLiveSearchDeployProbe(probe: LiveSearchDeployProbe): LiveSearchDeployVerification {
  const publicBody = probe.publicTi.body.toLowerCase();
  const apiBody = typeof probe.apiSearch.body === "string" ? probe.apiSearch.body.toLowerCase() : "";
  const apiJson = isRecord(probe.apiSearch.json) ? probe.apiSearch.json : undefined;
  const checks = [
    check("public_ti.http_ok", probe.publicTi.status >= 200 && probe.publicTi.status < 300, "public /ti search returns HTTP 2xx"),
    check("public_ti.live_search_marker", publicBody.includes("live_search"), "public /ti response includes live_search marker"),
    check("public_ti.partial_marker", publicBody.includes("partial") || publicBody.includes("ready") || publicBody.includes("searching") || publicBody.includes("queued") || publicBody.includes("metadata_review"), "public /ti response includes a live partial/ready/searching/queued/metadata_review result marker"),
    check("api_search.http_ok", probe.apiSearch.status >= 200 && probe.apiSearch.status < 300, "API /api/ti/search returns HTTP 2xx"),
    check("api_search.run_id", hasRunId(apiJson) || apiBody.includes("runid") || apiBody.includes("run_id"), "API /api/ti/search returns a run id")
  ];

  return { ok: checks.every((item) => item.ok), checks };
}

export function assertLiveSearchDeployVerification(verification: LiveSearchDeployVerification): void {
  const failures = verification.checks.filter((item) => !item.ok);
  if (failures.length === 0) return;
  throw new Error(failures.map((item) => `${item.name}: ${item.message}`).join("; "));
}

export function estimateLiveSearchPollingImpact(
  concurrentClients: number,
  pollIntervalMs = DEFAULT_LIVE_SEARCH_SLO.recommendedPollIntervalMs
): LiveSearchPollingImpact {
  const safeClients = Math.max(0, Math.floor(concurrentClients));
  const safeInterval = Math.max(250, pollIntervalMs);
  const requestsPerSecond = safeClients / (safeInterval / 1000);
  const requestsPerMinute = requestsPerSecond * 60;
  const estimatedQueueItemsPerMinute = Math.ceil(requestsPerMinute * 0.05);
  const estimatedMemoryMb = Math.ceil(64 + safeClients * 0.35 + estimatedQueueItemsPerMinute * 0.003);
  const status = requestsPerSecond >= 250 ? "critical" : requestsPerSecond >= 50 ? "warn" : "ok";

  return {
    concurrentClients: safeClients,
    pollIntervalMs: safeInterval,
    requestsPerSecond: round(requestsPerSecond),
    requestsPerMinute: round(requestsPerMinute),
    estimatedQueueItemsPerMinute,
    estimatedMemoryMb,
    status
  };
}

export function verifyScraperNativeSearchReadiness(probe: ScraperNativeSearchReadinessProbe): ScraperNativeSearchReadiness {
  const health = isRecord(probe.scraperHealth.json) ? probe.scraperHealth.json : undefined;
  const search = isRecord(probe.search.json) ? probe.search.json : undefined;
  const cursorPoll = isRecord(probe.cursorPoll.json) ? probe.cursorPoll.json : undefined;
  const degraded = isRecord(probe.degradedSearch.json) ? probe.degradedSearch.json : undefined;
  const publicApiPost = isRecord(probe.publicApiPost?.json) ? probe.publicApiPost.json : undefined;
  const publicApiPostBody = typeof probe.publicApiPost?.body === "string" ? probe.publicApiPost.body.toLowerCase() : "";
  const publicApiGet = isRecord(probe.publicApiGet?.json) ? probe.publicApiGet.json : undefined;
  const publicBody = probe.publicPage.body.toLowerCase();
  const sourceCoverage = readRecord(search, "sourceCoverage") ?? readRecord(search, "source_coverage");
  const degradedState = readString(degraded, "status") ?? readString(degraded, "state");
  const checks = [
    check("scraper.health_http_ok", probe.scraperHealth.status >= 200 && probe.scraperHealth.status < 300, "scraper health endpoint returns HTTP 2xx"),
    check("scraper.health_ok", health?.ok === true || readString(health, "status") === "ok", "scraper health body is ok"),
    check("search.http_ok", probe.search.status >= 200 && probe.search.status < 300, "scraper-native /v1/intel/search returns HTTP 2xx"),
    check("search.partial_result", hasPartialResult(search), "scraper-native search returns partial live-search evidence"),
    check("search.run_id", hasRunId(search), "scraper-native search returns a run id"),
    check("search.cursor", hasCursor(search), "scraper-native search returns a cursor for polling"),
    check("search.source_coverage", hasSourceCoverage(sourceCoverage), "scraper-native search returns source coverage details"),
    check("cursor_poll.http_ok", probe.cursorPoll.status >= 200 && probe.cursorPoll.status < 300, "cursor polling returns HTTP 2xx"),
    check("cursor_poll.cursor_or_delta", hasCursor(cursorPoll) || hasDeltas(cursorPoll), "cursor polling returns a cursor or deltas"),
    check("degraded.http_ok", probe.degradedSearch.status >= 200 && probe.degradedSearch.status < 500, "degraded search returns controlled response"),
    check("degraded.sane_state", degradedState === "degraded" || degradedState === "blocked" || degradedState === "partial", "degraded search reports a sane state"),
    check("public_page.http_ok", probe.publicPage.status >= 200 && probe.publicPage.status < 300, "public /ti page returns HTTP 2xx"),
    check("public_page.live_search_marker", publicBody.includes("live_search"), "public /ti page includes live_search marker"),
    check("public_page.partial_marker", publicBody.includes("partial") || publicBody.includes("ready") || publicBody.includes("searching") || publicBody.includes("queued") || publicBody.includes("metadata_review"), "public /ti page includes partial/ready/searching/queued/metadata_review marker"),
    ...(probe.publicApiPost ? [
      check("public_api_post.http_ok", probe.publicApiPost.status >= 200 && probe.publicApiPost.status < 300, "canonical public /api/ti/search POST returns HTTP 2xx"),
      check("public_api_post.run_id", hasRunId(publicApiPost) || publicApiPostBody.includes("runid") || publicApiPostBody.includes("run_id"), "canonical public /api/ti/search POST returns a run id"),
      check("public_api_post.live_state", hasPartialResult(publicApiPost) || ["partial", "ready", "searching", "queued", "metadata_review"].includes(readString(publicApiPost, "status") ?? "") || publicApiPostBody.includes("partial") || publicApiPostBody.includes("ready") || publicApiPostBody.includes("searching") || publicApiPostBody.includes("queued") || publicApiPostBody.includes("metadata_review"), "canonical public /api/ti/search POST returns partial, ready, searching, queued, or metadata_review state")
    ] : []),
    ...(probe.publicApiGet ? [
      check("public_api_get.optional_or_http_ok", !probe.requireGetApiProof || (probe.publicApiGet.status >= 200 && probe.publicApiGet.status < 300), "public /api/ti/search GET is optional unless TI_REQUIRE_GET_API_PROOF=true"),
      check("public_api_get.optional_or_run_id", !probe.requireGetApiProof || hasRunId(publicApiGet), "public /api/ti/search GET run id is optional unless TI_REQUIRE_GET_API_PROOF=true")
    ] : [])
  ];
  const reasons = checks.filter((item) => !item.ok).map((item) => item.name);

  return {
    ok: checks.every((item) => item.ok),
    checks,
    rollback: {
      required: reasons.length > 0,
      reasons
    }
  };
}

export function assertScraperNativeSearchReadiness(readiness: ScraperNativeSearchReadiness): void {
  const failures = readiness.checks.filter((item) => !item.ok);
  if (failures.length === 0) return;
  throw new Error(failures.map((item) => `${item.name}: ${item.message}`).join("; "));
}

export function evaluateLiveSearchSoak(
  sample: LiveSearchSoakSample,
  criteria: LiveSearchSoakCriteria = DEFAULT_LIVE_SEARCH_SOAK_CRITERIA
): LiveSearchSoakReport {
  const workerSaturationPercent = sample.workerSaturationPercent ?? 0;
  const cpuMaxPercent = sample.cpuMaxPercent ?? 0;
  const policyBlockRatePercent = sample.policyBlockRatePercent ?? safeRate(sample.policyBlocks, 100);
  const sourceUnavailableRatePercent = sample.sourceUnavailableRatePercent ?? 0;
  const staleCacheRatePercent = sample.staleCacheRatePercent ?? 0;
  const rejectedUnsafeActions = sample.rejectedUnsafeActions ?? 0;
  const checks = [
    check("soak.duration", sample.durationHours >= criteria.durationHours, "24h soak window completed"),
    check("soak.public_queries", (sample.publicQueryCount ?? 1) >= 1, "public actor queries were sampled"),
    check("proof.public_ti", sample.publicProofOk, "public /ti proof command passed"),
    check("proof.scraper_native", sample.scraperNativeProofOk, "scraper-native /v1/intel/search proof passed"),
    check("proof.api_wrapper", sample.apiWrapperProofOk, "API wrapper proof passed"),
    check("proof.source_activation_dry_run", sample.sourceActivationDryRunOk, "source activation dry run passed"),
    check("proof.evidence_write_read", sample.evidenceWriteReadOk ?? true, "evidence write/read health proof passed"),
    check("proof.graph_export_readiness", sample.graphExportReadinessOk ?? true, "graph export readiness proof passed"),
    check("proof.public_api_compatibility", sample.publicApiCompatibilityOk ?? true, "public API compatibility proof passed"),
    check("proof.run_reuse", sample.runReuseOk ?? sample.duplicateActiveRuns <= criteria.maxDuplicateActiveRuns, "active run reuse stayed deterministic"),
    check("proof.cursor_polling", sample.cursorPollingOk ?? true, "cursor polling returned continuity or deltas"),
    check("latency.initial_p95", sample.initialLatencyP95Ms <= criteria.initialLatencyP95Ms, "initial response p95 within SLO"),
    check("latency.partial_p95", sample.partialLatencyP95Ms <= criteria.partialLatencyP95Ms, "partial result p95 within SLO"),
    check("errors.rate", sample.errorRatePercent <= criteria.maxErrorRatePercent, "error rate within budget"),
    check("runs.duplicates", sample.duplicateActiveRuns <= criteria.maxDuplicateActiveRuns, "duplicate active runs stayed at zero"),
    check("sources.coverage", sample.sourceCoveragePercent >= criteria.minSourceCoveragePercent, "source coverage met threshold"),
    check("queue.age_p95", sample.queueAgeP95Seconds <= criteria.maxQueueAgeP95Seconds, "queue age p95 stayed bounded"),
    check("workers.saturation", workerSaturationPercent <= criteria.maxWorkerSaturationPercent, "worker saturation stayed below limit"),
    check("cpu.max", cpuMaxPercent <= criteria.maxCpuPercent, "CPU stayed below normal soak threshold"),
    check("memory.rss_max", sample.memoryRssMaxGb <= criteria.maxMemoryRssGb, "RSS memory stayed under target"),
    check("policy.block_rate", policyBlockRatePercent <= criteria.maxPolicyBlockRatePercent, "policy-block rate stayed explainable"),
    check("policy.rejected_unsafe_actions", rejectedUnsafeActions <= criteria.maxRejectedUnsafeActions, "unsafe actions stayed rejected without operator bypass"),
    check("policy.no_unsafe_retries", sample.unsafePolicyRetries <= criteria.maxUnsafePolicyRetries, "policy blocks did not become unsafe retries"),
    check("restricted.kill_switch_state", sample.restrictedKillSwitchActive !== true, "restricted metadata kill switch is not active during promotion soak"),
    check("sources.unavailable_rate", sourceUnavailableRatePercent <= criteria.maxSourceUnavailableRatePercent, "source-unavailable rate stayed bounded"),
    check("cache.stale_rate", staleCacheRatePercent <= criteria.maxStaleCacheRatePercent, "stale-cache rate stayed bounded"),
    check("fallback.not_used", criteria.allowFallbackUse || !sample.fallbackUsed, "temporary outer fallback was not used")
  ];
  const rollbackReasons = checks.filter((item) => !item.ok).map((item) => item.name);
  const critical = sample.scenario === "scraper_unavailable"
    || sample.memoryRssMaxGb > criteria.maxMemoryRssGb
    || sample.queueAgeP95Seconds > criteria.maxQueueAgeP95Seconds * 2
    || workerSaturationPercent > 95
    || (sample.evidenceWriteReadOk === false || sample.graphExportReadinessOk === false || sample.publicApiCompatibilityOk === false)
    || sourceUnavailableRatePercent > criteria.maxSourceUnavailableRatePercent * 2
    || staleCacheRatePercent > criteria.maxStaleCacheRatePercent * 2
    || rejectedUnsafeActions > criteria.maxRejectedUnsafeActions
    || cpuMaxPercent > criteria.maxCpuPercent * 1.25
    || sample.restrictedKillSwitchActive === true
    || sample.errorRatePercent > criteria.maxErrorRatePercent * 2;
  const ok = checks.every((item) => item.ok);
  const status: LiveSearchSoakReport["status"] = ok ? "promote" : critical ? "rollback" : "hold";

  return {
    ok,
    scenario: sample.scenario,
    status,
    checks,
    summary: {
      durationHours: sample.durationHours,
      initialLatencyP95Ms: sample.initialLatencyP95Ms,
      partialLatencyP95Ms: sample.partialLatencyP95Ms,
      errorRatePercent: sample.errorRatePercent,
      duplicateActiveRuns: sample.duplicateActiveRuns,
      sourceCoveragePercent: sample.sourceCoveragePercent,
      queueAgeP95Seconds: sample.queueAgeP95Seconds,
      workerSaturationPercent,
      cpuMaxPercent,
      memoryRssMaxGb: sample.memoryRssMaxGb,
      policyBlockRatePercent,
      sourceUnavailableRatePercent,
      staleCacheRatePercent,
      rejectedUnsafeActions,
      restrictedKillSwitchActive: sample.restrictedKillSwitchActive === true
    },
    rollbackReasons,
    statusReport: buildSoakStatusReport({ ...sample, workerSaturationPercent, policyBlockRatePercent, sourceUnavailableRatePercent, staleCacheRatePercent }, status, rollbackReasons)
  };
}

export function assertLiveSearchSoakPromotion(report: LiveSearchSoakReport): void {
  if (report.ok) return;
  throw new Error(`live search soak ${report.status}: ${report.rollbackReasons.join(", ")}`);
}

export function evaluateDeploymentDrift(probe: DeploymentDriftProbe): DeploymentDriftReport {
  const requiredQueries = new Set(["APT29", "Scattered Spider", probe.randomActorQuery]);
  const publicChecks = Array.from(requiredQueries).flatMap((query) => {
    const proof = probe.publicProofs.find((item) => item.query === query);
    const body = proof?.body.toLowerCase() ?? "";
    return [
      check(`public_ti.${slugQuery(query)}.present`, proof !== undefined, `public /ti proof exists for ${query}`),
      check(`public_ti.${slugQuery(query)}.http_ok`, (proof?.status ?? 0) >= 200 && (proof?.status ?? 0) < 300, `public /ti returns HTTP 2xx for ${query}`),
      check(`public_ti.${slugQuery(query)}.live_search_marker`, body.includes("live_search"), `public /ti includes live_search marker for ${query}`),
      check(`public_ti.${slugQuery(query)}.partial_marker`, body.includes("partial"), `public /ti includes partial evidence for ${query}`),
      check(`public_ti.${slugQuery(query)}.queued_run_marker`, body.includes("queued") || body.includes("run"), `public /ti shows queued/run state for ${query}`)
    ];
  });
  const apiChecks = Array.from(requiredQueries).flatMap((query) => {
    const proof = probe.apiSearchProofs.find((item) => item.query === query);
    const body = typeof proof?.body === "string" ? proof.body.toLowerCase() : "";
    const json = isRecord(proof?.json) ? proof.json : undefined;
    return [
      check(`api_search.${slugQuery(query)}.present`, proof !== undefined, `API search proof exists for ${query}`),
      check(`api_search.${slugQuery(query)}.http_ok`, (proof?.status ?? 0) >= 200 && (proof?.status ?? 0) < 300, `API search returns HTTP 2xx for ${query}`),
      check(`api_search.${slugQuery(query)}.run_id`, hasRunId(json) || body.includes("runid") || body.includes("run_id"), `API search returns a run id for ${query}`),
      check(`api_search.${slugQuery(query)}.partial_result`, hasPartialResult(json) || body.includes("partial"), `API search returns partial evidence for ${query}`)
    ];
  });
  const healthChecks = probe.healthEndpoints.flatMap((endpoint) => {
    const json = isRecord(endpoint.json) ? endpoint.json : undefined;
    const body = endpoint.body?.toLowerCase() ?? "";
    return [
      check(`health.${endpoint.name}.http_ok`, endpoint.status >= 200 && endpoint.status < 300, `${endpoint.name} health endpoint returns HTTP 2xx`),
      check(`health.${endpoint.name}.ok`, endpoint.ok === true || readString(json, "status") === "ok" || body.includes("ok"), `${endpoint.name} health endpoint reports ok`)
    ];
  });
  const checks = [
    check("source.local_remote_match", probe.localSourceHash === probe.remoteSourceHash, "local source hash matches remote Inspur source hash"),
    check("compose.config_match", probe.expectedComposeConfigHash === probe.remoteComposeConfigHash, "Docker compose config hash matches the deployed config"),
    check("image.running_expected_match", probe.expectedImageId === probe.runningImageId, "running scraper container image id matches the expected promoted image"),
    check("health.required_endpoints_present", probe.healthEndpoints.length >= 3, "scraper, API, and frontend health endpoints are present"),
    ...healthChecks,
    ...publicChecks,
    ...apiChecks
  ];
  const blockedPromotionReasons = checks.filter((item) => !item.ok).map((item) => item.name);
  const rollbackSignals = blockedPromotionReasons.some((reason) => reason.startsWith("image.")
    || reason.startsWith("health.")
    || reason.includes(".http_ok")
    || reason.includes(".run_id")
    || reason.includes(".live_search_marker")
    || reason.includes(".partial_marker"));
  const state: DeploymentDriftReport["state"] = blockedPromotionReasons.length === 0 ? "aligned" : rollbackSignals ? "rollback" : "drift";

  return {
    ok: blockedPromotionReasons.length === 0,
    state,
    checks,
    publicProofs: probe.publicProofs,
    apiSearchProofs: probe.apiSearchProofs,
    rollbackTarget: probe.rollbackTarget,
    lastKnownGood: {
      sourceHash: probe.rollbackTarget.sourceHash,
      imageId: probe.rollbackTarget.imageId,
      composeConfigHash: probe.rollbackTarget.composeConfigHash
    },
    blockedPromotionReasons
  };
}

export function buildLiveSearchPromotionSummary(
  soakReport: LiveSearchSoakReport,
  driftReport: DeploymentDriftReport
): LiveSearchPromotionSummary {
  const blockedPromotionReasons = [
    ...soakReport.rollbackReasons,
    ...driftReport.blockedPromotionReasons.map((reason) => `deployment.${reason}`)
  ];
  const ok = soakReport.ok && driftReport.ok;
  const status: LiveSearchPromotionSummary["status"] = ok
    ? "promote"
    : soakReport.status === "rollback" || driftReport.state === "rollback"
      ? "rollback"
      : "hold";

  return {
    ok,
    status,
    deploymentDriftState: driftReport.state,
    rollbackTarget: driftReport.rollbackTarget,
    lastKnownGood: driftReport.lastKnownGood,
    blockedPromotionReasons,
    statusReport: [
      soakReport.statusReport,
      `deploymentDriftState: ${driftReport.state}`,
      `lastKnownGoodSourceHash: ${driftReport.lastKnownGood.sourceHash}`,
      `lastKnownGoodImageId: ${driftReport.lastKnownGood.imageId}`,
      `lastKnownGoodComposeConfigHash: ${driftReport.lastKnownGood.composeConfigHash}`,
      `rollbackTarget: ${driftReport.rollbackTarget.command}`,
      `blockedPromotionReasons: ${blockedPromotionReasons.length > 0 ? blockedPromotionReasons.join(", ") : "none"}`
    ].join("\n")
  };
}

export function assertLiveSearchPromotionSummary(summary: LiveSearchPromotionSummary): void {
  if (summary.ok) return;
  throw new Error(`live search promotion ${summary.status}: ${summary.blockedPromotionReasons.join(", ")}`);
}

export function evaluateCutoverRehearsal(input: CutoverRehearsalInput): CutoverRehearsalReport {
  const requiredPublicProofQueries = ["APT29", "Scattered Spider", "Volt Typhoon", "Turla", "Akira", input.randomActorQuery];
  const blockers: CutoverBlocker[] = [];
  const resourceBudget = evaluateCutoverResourceBudget(input.resourceBudget);

  for (const workstream of input.workstreams) {
    if (workstream.status === "ready") continue;
    const severity = workstream.status === "rollback" || workstream.status === "blocked" ? "rollback" : "hold";
    for (const blocker of workstream.blockers?.length ? workstream.blockers : [`${workstream.name}.${workstream.status}`]) {
      blockers.push({
        name: blocker,
        severity,
        owner: workstream.owner,
        workstream: workstream.name,
        proofCommand: workstream.proofCommand,
        lastKnownGoodState: workstream.lastKnownGoodState,
        rollbackPath: workstream.rollbackPath
      });
    }
  }

  if (!input.deploymentDrift.ok) {
    for (const reason of input.deploymentDrift.blockedPromotionReasons) {
      blockers.push({
        name: `deployment.${reason}`,
        severity: input.deploymentDrift.state === "rollback" ? "rollback" : "hold",
        owner: "Agent 10",
        workstream: "deployment_drift",
        proofCommand: "bun run check:deployment-drift",
        lastKnownGoodState: `${input.deploymentDrift.lastKnownGood.sourceHash}/${input.deploymentDrift.lastKnownGood.imageId}`,
        rollbackPath: input.deploymentDrift.rollbackTarget.command
      });
    }
  }

  for (const query of requiredPublicProofQueries) {
    const publicProof = input.livePublicProofs.find((proof) => proof.query === query);
    const apiProof = input.apiSearchProofs.find((proof) => proof.query === query);
    const publicBody = publicProof?.body.toLowerCase() ?? "";
    const apiBody = typeof apiProof?.body === "string" ? apiProof.body.toLowerCase() : "";
    const apiJson = isRecord(apiProof?.json) ? apiProof.json : undefined;

    pushCutoverProofBlocker(blockers, publicProof !== undefined, `public_ti.${slugQuery(query)}.present`, query, input);
    pushCutoverProofBlocker(blockers, (publicProof?.status ?? 0) >= 200 && (publicProof?.status ?? 0) < 300, `public_ti.${slugQuery(query)}.http_ok`, query, input);
    pushCutoverProofBlocker(blockers, publicBody.includes("live_search"), `public_ti.${slugQuery(query)}.live_search_marker`, query, input);
    pushCutoverProofBlocker(blockers, publicBody.includes("partial"), `public_ti.${slugQuery(query)}.partial_marker`, query, input);
    pushCutoverProofBlocker(blockers, publicBody.includes("queued") || publicBody.includes("run"), `public_ti.${slugQuery(query)}.queued_run_marker`, query, input);
    pushCutoverProofBlocker(blockers, (apiProof?.status ?? 0) >= 200 && (apiProof?.status ?? 0) < 300, `api_search.${slugQuery(query)}.http_ok`, query, input);
    pushCutoverProofBlocker(blockers, hasRunId(apiJson) || apiBody.includes("runid") || apiBody.includes("run_id"), `api_search.${slugQuery(query)}.run_id`, query, input);
    pushCutoverProofBlocker(blockers, hasPartialResult(apiJson) || apiBody.includes("partial"), `api_search.${slugQuery(query)}.partial_result`, query, input);
  }

  for (const failed of resourceBudget.checks.filter((item) => !item.ok)) {
    blockers.push({
      name: `resource.${failed.name}`,
      severity: "rollback",
      owner: "Agent 10",
      workstream: "resource_budget",
      proofCommand: "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot",
      lastKnownGoodState: "scraper target <=96 GB, ceiling <=160 GB, >=500 GB non-scraper CTI reserve",
      rollbackPath: "lower scraper workers, keep outer fallback, and restore the last known-good stack"
    });
  }

  if (!input.agent09ApprovedFallbackRemoval) {
    blockers.push({
      name: "api.agent09_fallback_removal_approval_missing",
      severity: "hold",
      owner: "Agent 09",
      workstream: "api_readiness",
      proofCommand: "TI_SCRAPER_INTERNAL_BASE=http://ti-scraper:8097 bun run check:scraper-native-search",
      lastKnownGoodState: lastKnownGoodFallbackState(input),
      rollbackPath: fallbackRollbackPath(input)
    });
  }
  if (!input.mainAgentDeployGateApproved) {
    blockers.push({
      name: "deploy.main_agent_gate_missing",
      severity: "hold",
      owner: "Main agent",
      workstream: "deployment_drift",
      proofCommand: "bun test && bun run check && bun run check:deployment-drift",
      lastKnownGoodState: lastKnownGoodFallbackState(input),
      rollbackPath: fallbackRollbackPath(input)
    });
  }

  const decision: CutoverRehearsalReport["decision"] = blockers.some((blocker) => blocker.severity === "rollback")
    ? "rollback"
    : blockers.length > 0
      ? "hold"
      : "pass";

  return {
    ok: decision === "pass",
    decision,
    blockers: blockers.sort((a, b) => a.name.localeCompare(b.name)),
    requiredPublicProofQueries,
    resourceBudget,
    rollbackPath: decision === "pass" ? "none" : fallbackRollbackPath(input),
    lastKnownGoodState: lastKnownGoodFallbackState(input),
    statusReport: buildCutoverStatusReport(decision, blockers, resourceBudget, input)
  };
}

export function assertCutoverRehearsalPass(report: CutoverRehearsalReport): void {
  if (report.ok) return;
  throw new Error(`cutover rehearsal ${report.decision}: ${report.blockers.map((blocker) => blocker.name).join(", ")}`);
}

export function buildCutoverApplyPlanPacket(input: CutoverApplyPlanInput): CutoverApplyPlanPacket {
  const resourceBudget = evaluateCutoverResourceBudget(input.resourceBudget);
  const classificationCounts: CutoverApplyPlanPacket["classificationCounts"] = {
    "automation-safe": 0,
    "human-approval-required": 0,
    blocked: 0,
    "rollback-only": 0
  };
  const blockers: CutoverBlocker[] = [...input.rehearsal.blockers];

  for (const action of input.actions) {
    classificationCounts[action.classification] += 1;
    const needsApplication = !action.applied && action.classification !== "rollback-only";
    const isRollbackOnly = action.classification === "rollback-only";
    const isBlocked = action.classification === "blocked";
    const isManual = action.classification === "human-approval-required";
    const actionBlockers = action.promotionBlockers?.length ? action.promotionBlockers : needsApplication ? [`${action.id}.unapplied`] : [];

    if (isBlocked || isRollbackOnly || isManual || needsApplication) {
      for (const reason of actionBlockers) {
        blockers.push({
          name: `apply_plan.${reason}`,
          severity: isBlocked || isRollbackOnly ? "rollback" : "hold",
          owner: action.owner,
          workstream: action.workstream,
          proofCommand: action.proofCommand,
          lastKnownGoodState: action.applied ? "action already applied in dry-run packet" : "action not yet applied",
          rollbackPath: action.rollback
        });
      }
    }
  }

  if (!input.deploymentDrift.ok) {
    for (const reason of input.deploymentDrift.blockedPromotionReasons) {
      blockers.push({
        name: `deployment.${reason}`,
        severity: input.deploymentDrift.state === "rollback" ? "rollback" : "hold",
        owner: "Agent 10",
        workstream: "deployment_drift",
        proofCommand: "bun run check:deployment-drift",
        lastKnownGoodState: `${input.deploymentDrift.lastKnownGood.sourceHash}/${input.deploymentDrift.lastKnownGood.imageId}`,
        rollbackPath: input.deploymentDrift.rollbackTarget.command
      });
    }
  }

  if (!input.agent09ApiReady) {
    blockers.push({
      name: "api.agent09_readiness_missing",
      severity: "hold",
      owner: "Agent 09",
      workstream: "api_readiness",
      proofCommand: "TI_SCRAPER_INTERNAL_BASE=http://ti-scraper:8097 bun run check:scraper-native-search",
      lastKnownGoodState: "outer fallback still installed",
      rollbackPath: "keep the outer fallback and do not promote scraper-native search"
    });
  }

  for (const failed of resourceBudget.checks.filter((item) => !item.ok)) {
    blockers.push({
      name: `resource.${failed.name}`,
      severity: "rollback",
      owner: "Agent 10",
      workstream: "resource_budget",
      proofCommand: "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot",
      lastKnownGoodState: "scraper target <=96 GB, ceiling <=160 GB, >=500 GB non-scraper CTI reserve",
      rollbackPath: "lower scraper workers and keep the outer fallback"
    });
  }

  const uniqueBlockersForPacket = uniqueBlockers(blockers);
  const decision: CutoverApplyPlanPacket["decision"] = uniqueBlockersForPacket.some((blocker) => blocker.severity === "rollback")
    || input.rehearsal.decision === "rollback"
    ? "rollback"
    : uniqueBlockersForPacket.length > 0 || input.rehearsal.decision === "hold"
      ? "hold"
      : "pass";

  return {
    ok: decision === "pass",
    decision,
    classificationCounts,
    actions: [...input.actions].sort((a, b) => a.id.localeCompare(b.id)),
    blockers: uniqueBlockersForPacket.sort((a, b) => a.name.localeCompare(b.name)),
    resourceBudget,
    dryRunOutput: buildApplyPlanDryRunOutput(decision, classificationCounts, uniqueBlockersForPacket, resourceBudget, input)
  };
}

export function assertCutoverApplyPlanPass(packet: CutoverApplyPlanPacket): void {
  if (packet.ok) return;
  throw new Error(`cutover apply plan ${packet.decision}: ${packet.blockers.map((blocker) => blocker.name).join(", ")}`);
}

export function buildCutoverPromotionPacket(input: CutoverPromotionPacketInput): CutoverPromotionPacket {
  const applyPlan = buildCutoverApplyPlanPacket(input);
  const liveProof = buildPromotionLiveProof(input);
  const mountedRouteProofs = normalizeMountedRouteProofs(input.mountedRouteProofs ?? []);
  const blockerAwareGate = buildBlockerAwareGate(mountedRouteProofs);
  const routeProofBlockers = buildMountedRouteProofBlockers(mountedRouteProofs);
  const liveProofBlockers = buildPromotionLiveProofBlockers(liveProof, input);
  const blockers = uniqueBlockers([...applyPlan.blockers, ...routeProofBlockers, ...liveProofBlockers]).sort((a, b) => a.name.localeCompare(b.name));
  const decision: CutoverApplyPlanPacket["decision"] = blockers.some((blocker) => blocker.severity === "rollback")
    || applyPlan.decision === "rollback"
    ? "rollback"
    : blockers.length > 0 || applyPlan.decision === "hold"
      ? "hold"
      : "pass";
  const proofCommands = uniqueStrings([
    ...input.actions.map((action) => action.proofCommand),
    ...(input.workstreams ?? []).map((workstream) => workstream.proofCommand),
    ...input.rehearsal.blockers.map((blocker) => blocker.proofCommand),
    ...blockers.map((blocker) => blocker.proofCommand),
    ...mountedRouteProofs.flatMap((proof) => [proof.localCommand, proof.inspurCommand])
  ]);
  const rollbackPaths = uniqueStrings([
    ...input.actions.map((action) => action.rollback),
    ...blockers.map((blocker) => blocker.rollbackPath),
    input.deploymentDrift.rollbackTarget.command
  ]);
  const ownerAssignments = buildOwnerAssignments(input.actions, blockers);
  const packetWithoutMarkdown = {
    schemaVersion: "ti.cutover.promotion_packet.v1" as const,
    generatedAt: input.generatedAt ?? "dry-run",
    decision,
    ok: decision === "pass",
    context: input.leaderThreadContext,
    applyPlan: {
      actionIds: applyPlan.actions.map((action) => action.id),
      sections: applyPlan.actions.map((action) => ({
        id: action.id,
        workstream: action.workstream,
        owner: action.owner,
        classification: action.classification,
        applied: action.applied,
        proofCommand: action.proofCommand
      })),
      classificationCounts: applyPlan.classificationCounts
    },
    workstreams: (input.workstreams ?? []).map((workstream) => ({
      name: workstream.name,
      owner: workstream.owner,
      status: workstream.status,
      proofCommand: workstream.proofCommand,
      rollbackPath: workstream.rollbackPath
    })),
    liveProof,
    mountedRouteProofs: mountedRouteProofs.map((proof) => ({
      name: proof.name,
      owner: proof.owner,
      status: proof.status,
      localCommand: proof.localCommand,
      inspurCommand: proof.inspurCommand,
      expectedOutput: proof.expectedOutput,
      endpoint: proof.endpoint
    })),
    blockerAwareGate,
    resourceBudget: {
      ...applyPlan.resourceBudget,
      scraperTargetGb: input.resourceBudget.scraperTargetGb,
      scraperCeilingGb: input.resourceBudget.scraperCeilingGb
    },
    deploymentDrift: {
      state: input.deploymentDrift.state,
      ok: input.deploymentDrift.ok,
      blockedPromotionReasons: input.deploymentDrift.blockedPromotionReasons,
      rollbackTarget: input.deploymentDrift.rollbackTarget,
      lastKnownGood: input.deploymentDrift.lastKnownGood
    },
    blockers,
    rollbackPaths,
    ownerAssignments,
    proofCommands
  };
  const leaderMarkdown = buildCutoverLeaderMarkdown(packetWithoutMarkdown);

  return {
    ...packetWithoutMarkdown,
    leaderMarkdown
  };
}

export function buildCutoverSoakReleasePacket(input: CutoverSoakReleasePacketInput): CutoverSoakReleasePacket {
  const runtimeProofs = normalizeRuntimeReleaseProofs(input.runtimeProofs);
  const deploymentProofs = normalizeDeploymentProofSlots(input.deploymentProofs);
  const releaseTrainStages = normalizeReleaseTrainStages(input, runtimeProofs, deploymentProofs);
  const blockers = [
    ...input.workstreams
      .filter((workstream) => workstream.classification === "blocker")
      .map((workstream) => ({
        owner: workstream.owner,
        name: workstream.blocker ?? `${workstream.name}.blocker`,
        proofCommand: workstream.proofCommand,
        rollbackPath: workstream.rollbackPath
      })),
    ...runtimeProofs
      .filter((proof) => proof.status === "blocker" || proof.resourceBudgetStatus === "critical")
      .map((proof) => ({
        owner: proof.owner,
        name: `runtime.${proof.name}`,
        proofCommand: proof.proofCommand,
        rollbackPath: proof.rollbackPath
      })),
    ...deploymentProofs
      .filter((proof) => proof.status === "blocker")
      .map((proof) => ({
        owner: proof.owner,
        name: `deployment_proof.${proof.name}`,
        proofCommand: proof.proofCommand,
        rollbackPath: proof.rollbackPath
      })),
    ...releaseTrainStages
      .filter((stage) => stage.status === "blocker")
      .map((stage) => ({
        owner: stage.owner,
        name: `release_train.${stage.name}`,
        proofCommand: stage.proofCommands.join(" && "),
        rollbackPath: stage.rollbackPath
      })),
    ...(input.soak.status === "rollback" ? input.soak.rollbackReasons.filter((reason) => reason !== "soak.duration").map((reason) => ({
      owner: "Agent 10",
      name: `soak.${reason}`,
      proofCommand: "bun run soak:production",
      rollbackPath: input.promotionPacket.rollbackPaths[0] ?? "keep outer fallback and continue soak"
    })) : []),
    ...input.deploymentDrift.blockedPromotionReasons.map((reason) => ({
      owner: "Agent 10",
      name: `deployment.${reason}`,
      proofCommand: "bun run check:remote-drift",
      rollbackPath: input.deploymentDrift.rollbackTarget.command
    })),
    ...input.promotionPacket.blockers.map((blocker) => ({
      owner: blocker.owner,
      name: `promotion.${blocker.name}`,
      proofCommand: blocker.proofCommand,
      rollbackPath: blocker.rollbackPath
    }))
  ];
  const warnings = [
    ...input.workstreams
      .filter((workstream) => workstream.classification === "warning")
      .map((workstream) => ({
        owner: workstream.owner,
        name: workstream.warning ?? `${workstream.name}.warning`,
        proofCommand: workstream.proofCommand
      })),
    ...runtimeProofs
      .filter((proof) => proof.status === "warning" || proof.resourceBudgetStatus === "warning")
      .map((proof) => ({
        owner: proof.owner,
        name: `runtime.${proof.name}`,
        proofCommand: proof.proofCommand
      })),
    ...deploymentProofs
      .filter((proof) => proof.status === "warning")
      .map((proof) => ({
        owner: proof.owner,
        name: `deployment_proof.${proof.name}`,
        proofCommand: proof.proofCommand
      })),
    ...releaseTrainStages
      .filter((stage) => stage.status === "warning")
      .map((stage) => ({
        owner: stage.owner,
        name: `release_train.${stage.name}`,
        proofCommand: stage.proofCommands.join(" && ")
      })),
    ...input.promotionPacket.blockerAwareGate
      .filter((gate) => gate.classification === "warning")
      .map((gate) => ({
        owner: gate.owner,
        name: `${gate.name}.${gate.status}`,
        proofCommand: proofCommandForGate(gate.name)
      })),
    ...input.soak.rollbackReasons.filter((reason) => reason === "soak.duration").map((reason) => ({
      owner: "Agent 10",
      name: reason,
      proofCommand: "bun run soak:production"
      }))
  ];
  const decision = releaseDecision(input, runtimeProofs, deploymentProofs, blockers, warnings);
  const releaseTrain = buildReleaseTrainOrchestration(input, decision, releaseTrainStages, runtimeProofs, deploymentProofs);
  const rcGate = buildReleaseCandidateGatePacket(input, decision, releaseTrain, runtimeProofs, deploymentProofs, blockers, warnings);
  const canaryExecution = buildCanaryReleaseExecutionPacket(input, rcGate);
  const rcBoard = buildFinalRcBoardPacket(input, decision, rcGate, canaryExecution, releaseTrain, runtimeProofs, deploymentProofs, blockers, warnings);
  const productTiBoard = buildProductTiReleaseBoardPacket(input, rcBoard, runtimeProofs, deploymentProofs, blockers, warnings);
  const realTimeScenarios: RealTimeSearchProofScenario[] = [
    "immediate_first_response",
    "three_second_polling",
    "same_run_reuse",
    "cursor_advancement",
    "empty_deltas",
    "clear_web_capture_deltas",
    "public_channel_hint_deltas",
    "restricted_held_deltas",
    "graph_stix_deltas",
    "claim_ledger_holds",
    "contradiction_downgrades",
    "no_result_searching",
    "provider_unavailable",
    "scraper_unavailable",
    "queue_pressure",
    "stale_source_caveats",
    "low_confidence",
    "policy_block",
    "no_leak_output",
    "memory_budget",
    "worker_queue_headroom",
    "frontend_no_default",
    "public_post_compatibility",
    "remote_container_health"
  ];
  const realTimeQueries: Array<{ query: RealTimeSearchProofQuery; queryClass: RealTimeSearchReleaseBoardPacket["queryMatrix"][number]["queryClass"] }> = [
    { query: "APT29", queryClass: "actor" },
    { query: "APT42", queryClass: "actor" },
    { query: "Turla", queryClass: "actor" },
    { query: "Volt Typhoon", queryClass: "actor" },
    { query: "Scattered Spider", queryClass: "actor" },
    { query: "Akira", queryClass: "actor" },
    { query: "random_actor", queryClass: "actor" },
    { query: "made_up_actor", queryClass: "actor" },
    { query: "CVE-2024-3094", queryClass: "cve" },
    { query: "malware_tool", queryClass: "malware_tool" },
    { query: "victim_ransomware", queryClass: "victim_ransomware" },
    { query: "country", queryClass: "country" },
    { query: "sector", queryClass: "sector" }
  ];
  const realTimeStatus: RealTimeSearchReleaseBoardPacket["pollingSlo"]["status"] = input.trends.cursorPolling.ok && input.trends.runReuse.ok && blockers.length === 0 ? "pass" : "warning";
  const realTimeSearchBoard: RealTimeSearchReleaseBoardPacket = {
    schemaVersion: "ti.realtime_search.release_board.v1",
    dryRun: true,
    decision: productTiBoard.decision,
    productTiDecision: productTiBoard.decision,
    rcBoardDecision: rcBoard.decision,
    pollingSlo: {
      firstResponseImmediate: true,
      targetPollSeconds: 3,
      recommendedPollSeconds: 3,
      sameRunReuse: input.trends.runReuse.ok,
      cursorAdvancement: input.trends.cursorPolling.ok,
      emptyDeltasAllowed: true,
      status: realTimeStatus
    },
    scenarioGates: realTimeScenarios.map((scenario) => ({
      scenario,
      owner: "Agent 07/09/10",
      status: realTimeStatus,
      proofCommand: scenario === "public_post_compatibility" ? "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof" : "bun run check:scraper-native-search",
      expectedOutput: `${scenario} proof remains compact, pollable, provenance-backed, and no-leak safe`,
      rollbackPath: "pause real-time delta promotion and return Searching/queued-only public answers"
    })),
    queryMatrix: realTimeQueries.map((entry) => ({
      ...entry,
      status: realTimeStatus,
      proofCommand: "bun run check:scraper-native-search",
      expectedOutput: `${entry.query} returns stable run/cursor fields, honest freshness, and pollable partial/ready/searching/metadata_review state`
    })),
    integrations: {
      contractsRoute: realTimeStatus,
      intelSearchRoute: realTimeStatus,
      schedulerSlo: realTimeStatus,
      evidenceClaimLedger: realTimeStatus,
      answerDeltas: realTimeStatus,
      graphStixDeltas: realTimeStatus,
      publicWrapperProof: realTimeStatus
    },
    resourceHeadroom: productTiBoard.resourceHeadroom,
    queuePressure: productTiBoard.queuePressure,
    noLeakGuarantees: productTiBoard.noLeakGuarantees,
    proofCommands: uniqueStrings([
      ...productTiBoard.proofCommands,
      "bun run check:contract-index",
      "bun run check:route-inventory",
      "bun run check:live-search-deploy",
      "bun run check:scraper-native-search"
    ]),
    rollbackCommands: uniqueStrings([
      ...productTiBoard.rollbackCommands,
      "pause real-time delta promotion and return Searching/queued-only public answers"
    ])
  };
  const observabilityDashboard = buildProductionObservabilityDashboardPacket(input, realTimeSearchBoard, productTiBoard, deploymentProofs);
  const enterpriseReleaseTrain = buildEnterpriseReleaseTrainPacket(input, releaseTrain, rcBoard, realTimeSearchBoard, observabilityDashboard, deploymentProofs);
  const nextProofCommands = uniqueStrings([
    ...blockers.map((blocker) => blocker.proofCommand),
    ...warnings.map((warning) => warning.proofCommand),
    ...deploymentProofs.map((proof) => proof.proofCommand),
    ...observabilityDashboard.proofCommands,
    ...enterpriseReleaseTrain.proofCommands,
    "bun test",
    "bun run check",
    "bun run check:route-inventory",
    "bun run check:remote-drift",
    "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof",
    "bun run check:deploy-hygiene",
    "bun run check:docker-contexts",
    "bun run check:live-search-deploy",
    "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot",
    "bun run rehearse:cutover examples/cutover-rehearsal-pass.json",
    "bun run plan:cutover examples/cutover-rehearsal-pass.json"
  ]);

  return {
    schemaVersion: "ti.cutover.soak_release_packet.v1",
    generatedAt: input.generatedAt ?? "dry-run",
    decision,
    ok: decision === "promote" || decision === "promote-with-warnings",
    soakStatus: input.soak.status,
    deploymentDriftState: input.deploymentDrift.state,
    resourceBudget: input.promotionPacket.resourceBudget,
    lastKnownGoodImageState: input.deploymentDrift.lastKnownGood.imageId,
    workstreams: input.workstreams,
    runtimeProofs,
    deploymentProofs,
    releaseTrain,
    rcGate,
    canaryExecution,
    rcBoard,
    productTiBoard,
    realTimeSearchBoard,
    observabilityDashboard,
    enterpriseReleaseTrain,
    trends: input.trends,
    blockers,
    warnings,
    nextProofCommands,
    statusReport: buildReleaseStatusReport(decision, input, blockers, warnings, nextProofCommands, rcBoard, productTiBoard, realTimeSearchBoard, observabilityDashboard, enterpriseReleaseTrain)
  };
}

function buildProductionObservabilityDashboardPacket(
  input: CutoverSoakReleasePacketInput,
  realTimeSearchBoard: RealTimeSearchReleaseBoardPacket,
  productTiBoard: ProductTiReleaseBoardPacket,
  deploymentProofs: CutoverDeploymentProofSlot[]
): ProductionObservabilityDashboardPacket {
  const summary = input.soak.summary;
  const proofCommand = "bun run soak:production";
  const lowerIsBetter = (
    name: ProductionObservabilityMetricName,
    value: number,
    warnAt: number,
    criticalAt: number,
    unit: ProductionObservabilityMetric["unit"],
    alertName: string,
    runbookAction: string,
    metricProofCommand = proofCommand
  ): ProductionObservabilityMetric => ({
    name,
    value,
    warnAt,
    criticalAt,
    unit,
    status: value > criticalAt ? "blocker" : value > warnAt ? "warning" : "pass",
    alertName,
    proofCommand: metricProofCommand,
    runbookAction
  });
  const booleanProof = (
    name: ProductionObservabilityMetricName,
    ok: boolean,
    alertName: string,
    runbookAction: string,
    metricProofCommand: string
  ): ProductionObservabilityMetric => ({
    name,
    value: ok ? 1 : 0,
    warnAt: 1,
    criticalAt: 0,
    unit: "boolean",
    status: ok ? "pass" : "blocker",
    alertName,
    proofCommand: metricProofCommand,
    runbookAction
  });
  const publicProofMatrix = buildObservabilityPublicProofMatrix(input.deploymentDrift);
  const publicProofOk = publicProofMatrix.every((proof) => proof.status !== "blocker");
  const metrics: ProductionObservabilityMetric[] = [
    lowerIsBetter("initial_latency_p95_ms", summary.initialLatencyP95Ms, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.initialLatencyP95Ms, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.initialLatencyP95Ms * 2, "ms", "ti_initial_latency_p95_high", "return immediate queued/searching response and defer slow source work"),
    lowerIsBetter("partial_latency_p95_ms", summary.partialLatencyP95Ms, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.partialLatencyP95Ms, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.partialLatencyP95Ms * 2, "ms", "ti_partial_latency_p95_high", "pause slow adapters and keep public answers in partial mode"),
    lowerIsBetter("queue_age_p95_seconds", summary.queueAgeP95Seconds, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxQueueAgeP95Seconds, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxQueueAgeP95Seconds * 2, "seconds", "ti_queue_age_p95_high", "drain low-priority queues and stop new canary fanout"),
    lowerIsBetter("worker_saturation_percent", summary.workerSaturationPercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxWorkerSaturationPercent, 95, "percent", "ti_worker_saturation_high", "reduce worker concurrency and defer source activation waves"),
    lowerIsBetter("memory_rss_max_gb", summary.memoryRssMaxGb, 96, 160, "gb", "ti_scraper_memory_rss_high", "stop browser workers first, then roll back scraper-native search before 160 GB"),
    lowerIsBetter("cpu_max_percent", summary.cpuMaxPercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxCpuPercent, 95, "percent", "ti_cpu_max_high", "reduce live-search workers and keep API/frontend headroom"),
    lowerIsBetter("adapter_failure_rate_percent", summary.errorRatePercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxErrorRatePercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxErrorRatePercent * 2, "percent", "ti_adapter_failure_rate_high", "classify failing adapters and keep affected sources partial"),
    lowerIsBetter("source_unavailable_rate_percent", summary.sourceUnavailableRatePercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxSourceUnavailableRatePercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxSourceUnavailableRatePercent * 2, "percent", "ti_source_unavailable_rate_high", "pause noisy unavailable sources and preserve stale-source caveats"),
    lowerIsBetter("policy_block_rate_percent", summary.policyBlockRatePercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxPolicyBlockRatePercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxPolicyBlockRatePercent * 2, "percent", "ti_policy_block_rate_high", "keep restricted sources metadata-only and alert on repeated unsafe attempts"),
    booleanProof("evidence_write_read_proof", input.soak.checks.find((check) => check.name === "proof.evidence_write_read")?.ok !== false, "ti_evidence_write_read_proof_failed", "hold evidence promotion and run backup/restore proof", "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts"),
    booleanProof("graph_export_readiness", input.soak.checks.find((check) => check.name === "proof.graph_export_readiness")?.ok !== false, "ti_graph_export_readiness_failed", "hold graph/STIX export promotion", "bun run check:graph-review-mounted"),
    booleanProof("public_proof_matrix", publicProofOk, "ti_public_proof_matrix_failed", "restore public API fallback and rerun Inspur public proof", "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof")
  ];
  const metricStatus = worstProofStatus(metrics.map((metric) => metric.status));
  const failureClassification = buildProductionFailureClassification(metrics, input, realTimeSearchBoard);
  const blockerNames = metrics.filter((metric) => metric.status === "blocker").map((metric) => metric.name);
  const warningNames = metrics.filter((metric) => metric.status === "warning").map((metric) => metric.name);
  const emergencyStop = input.trends.restrictedKillSwitch.active || input.trends.rollbackTriggers.some((trigger) => trigger.includes("restricted"));
  const decision: ProductionObservabilityDecision = emergencyStop
    ? "emergency-stop"
    : input.soak.status === "rollback" || input.deploymentDrift.state === "rollback" || metricStatus === "blocker"
      ? "rollback"
      : input.soak.status === "hold"
        ? "hold"
        : warningNames.length > 0 || input.deploymentDrift.state === "drift"
          ? "watch"
          : "ready";
  const proofCommands = uniqueStrings([
    "bun run soak:production",
    "bun run check:live-search-deploy",
    "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof",
    "bun run check:remote-drift",
    "bun run check:route-inventory",
    "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot",
    ...metrics.map((metric) => metric.proofCommand),
    ...deploymentProofs.map((proof) => proof.proofCommand)
  ]);
  return {
    schemaVersion: "ti.production_observability.dashboard.v1",
    dryRun: true,
    decision,
    generatedAt: input.generatedAt ?? "dry-run",
    sloDashboard: {
      windowHours: 24,
      metrics,
      alertThresholds: metrics.map((metric) => ({
        metric: metric.name,
        warnAt: metric.warnAt,
        criticalAt: metric.criticalAt,
        unit: metric.unit,
        alertName: metric.alertName
      }))
    },
    soakAutomation: {
      command: "TI_SCRAPER_INTERNAL_BASE=http://ti-scraper:8097 PUBLIC_TI_API_BASE_URL=https://api.hanasand.com/api/ti/search TI_SOAK_DURATION_MINUTES=1440 TI_SOAK_INTERVAL_SECONDS=60 bun run soak:production",
      cadenceSeconds: 60,
      durationHours: 24,
      checkpointsHours: [0, 6, 12, 18, 24],
      proofCommands,
      environment: {
        scraperTargetGb: 96,
        scraperCeilingGb: 160,
        preserveCtiReserveGb: 500,
        assumesGpu: false
      }
    },
    publicProofMatrix,
    failureClassification,
    rollbackDecisionPacket: {
      decision,
      triggers: uniqueStrings([...blockerNames, ...input.trends.rollbackTriggers]),
      rollbackCommands: uniqueStrings([
        ...realTimeSearchBoard.rollbackCommands,
        ...productTiBoard.rollbackCommands,
        input.deploymentDrift.rollbackTarget.command,
        "set public TI search to queued-only and pause source activation waves",
        "reduce scraper worker concurrency until RSS is below 96 GB"
      ]),
      operatorRunbook: [
        "start 24h soak with soakAutomation.command and record checkpoints at 0h, 6h, 12h, 18h, and 24h",
        "page on warning metrics; hold promotion on blocker metrics",
        "preserve 500 GB for the rest of CTI before increasing scraper capacity",
        "do not assume GPU availability for any worker lane",
        "rerun public proof matrix before canary promotion or rollback closure"
      ]
    },
    proofCommands
  };
}

function buildEnterpriseReleaseTrainPacket(
  input: CutoverSoakReleasePacketInput,
  releaseTrain: CutoverReleaseTrainOrchestration,
  rcBoard: FinalRcBoardPacket,
  realTimeSearchBoard: RealTimeSearchReleaseBoardPacket,
  observabilityDashboard: ProductionObservabilityDashboardPacket,
  deploymentProofs: CutoverDeploymentProofSlot[]
): EnterpriseReleaseTrainPacket {
  const deployment = (name: CutoverDeploymentProofSlotName) => deploymentProofs.find((proof) => proof.name === name);
  const dependencyHealth: EnterpriseReleaseTrainPacket["dependencyHealth"] = [
    { name: "scraper", status: deployment("remote_typecheck")?.status ?? "blocker", proofCommand: "bun run check" },
    { name: "api", status: deployment("public_post_api_proof")?.status ?? "blocker", proofCommand: "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof" },
    { name: "frontend", status: deployment("frontend_ti_query_proof")?.status ?? "blocker", proofCommand: "bun run check:live-search-deploy" },
    { name: "docker", status: deployment("docker_image_test_enforcement")?.status ?? "blocker", proofCommand: "bun run check:deploy-hygiene && bun run check:docker-contexts" },
    { name: "route_inventory", status: deployment("route_inventory")?.status ?? "blocker", proofCommand: "bun run check:route-inventory" },
    { name: "contract_index", status: deployment("contracts_route")?.status ?? "blocker", proofCommand: "bun run check:contract-index" },
    { name: "public_proof_matrix", status: proofStatusFromObservabilityMetric(observabilityDashboard, "public_proof_matrix"), proofCommand: "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof" },
    { name: "source_freshness", status: releaseTrain.stages.find((stage) => stage.name === "source_and_channel_readiness")?.status ?? "blocker", proofCommand: "bun test src/tests/sourceSeeds.test.ts src/tests/telegramPublic.test.ts" },
    { name: "evidence_writes", status: proofStatusFromObservabilityMetric(observabilityDashboard, "evidence_write_read_proof"), proofCommand: "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts" },
    { name: "graph_export_holds", status: proofStatusFromObservabilityMetric(observabilityDashboard, "graph_export_readiness"), proofCommand: "bun run check:graph-review-mounted" },
    { name: "restricted_metadata_safety", status: deployment("restricted_emergency_stop")?.status ?? "blocker", proofCommand: "bun run check:restricted-metadata-status && bun run check:restricted-metadata-apply-plan" },
    { name: "queue_headroom", status: rcBoard.queuePressure.status, proofCommand: "bun test src/tests/schedulerProduction.test.ts" }
  ];
  const capacityPlan = buildEnterpriseCapacityPlan(input);
  const drStatus: DisasterRecoveryProof["status"] = worstProofStatus([
    proofStatusFromObservabilityMetric(observabilityDashboard, "evidence_write_read_proof"),
    proofStatusFromObservabilityMetric(observabilityDashboard, "graph_export_readiness"),
    deployment("public_post_api_proof")?.status ?? "blocker",
    deployment("docker_image_test_enforcement")?.status ?? "blocker"
  ]);
  const disasterRecoveryProofs: DisasterRecoveryProof[] = [
    drProof("evidence_export_manifest", drStatus, "bun test src/tests/storageCutover.test.ts", "restore evidence objects from manifest and rerun replay-plan", 30, "capture ids, object hashes, and redacted metadata only"),
    drProof("claim_ledger_replay", proofStatusFromObservabilityMetric(observabilityDashboard, "evidence_write_read_proof"), "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts", "replay claim ledger rows from backup without raw leak material", 20, "ledger ids, source hashes, claim summaries, and confidence only"),
    drProof("graph_export_replay", proofStatusFromObservabilityMetric(observabilityDashboard, "graph_export_readiness"), "bun run check:graph-review-mounted", "rebuild graph export queue from reviewed relationships", 20, "relationship ids, review states, and STIX-safe descriptors only"),
    drProof("source_registry_backup", releaseTrain.stages.find((stage) => stage.name === "source_and_channel_readiness")?.status ?? "blocker", "bun test src/tests/sourceSeeds.test.ts", "restore source registry snapshot and keep restricted sources approval-gated", 15, "source ids, canonical URLs, legal notes, and status only"),
    drProof("scheduler_queue_drain", rcBoard.queuePressure.status, "bun test src/tests/schedulerProduction.test.ts", "pause intake, drain leased work, preserve cursors, and replay dead letters", 10, "run ids, queue ids, retry causes, and cursors only"),
    drProof("public_wrapper_rollback", deployment("public_post_api_proof")?.status ?? "blocker", "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "restore previous public wrapper fallback and verify POST proof", 10, "public status, run ids, and live state only"),
    drProof("container_rollback", deployment("docker_image_test_enforcement")?.status ?? "blocker", "bun run check:deploy-hygiene && bun run check:remote-drift", input.deploymentDrift.rollbackTarget.command, 15, "image id, compose hash, and health status only")
  ];
  const dependencyStatus = worstProofStatus(dependencyHealth.map((health) => health.status));
  const drWorstStatus = worstProofStatus(disasterRecoveryProofs.map((proof) => proof.status));
  const decision = enterpriseReleaseDecision(rcBoard, realTimeSearchBoard, observabilityDashboard, dependencyStatus, drWorstStatus, capacityPlan.status);
  const stages: EnterpriseReleaseTrainPacket["stages"] = [
    releaseStage("local_contract_green", deployment("local_tests")?.status ?? "blocker", "bun test && bun run check", "block release until local contracts are green"),
    releaseStage("route_inventory_green", deployment("route_inventory")?.status ?? "blocker", "bun run check:route-inventory", "hold route rollout until mounted route inventory is current"),
    releaseStage("public_proof_matrix_green", proofStatusFromObservabilityMetric(observabilityDashboard, "public_proof_matrix"), "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "restore public fallback on proof failure"),
    releaseStage("canary_ready", rcBoard.decision === "canary-ready" || rcBoard.decision === "promote" || rcBoard.decision === "promote-with-warnings" ? "pass" : rcBoard.decision === "canary-with-warnings" ? "warning" : "blocker", "bun run soak:production", "start canary only after proof and capacity gates pass"),
    releaseStage("canary_with_warnings", rcBoard.decision === "canary-with-warnings" || decision === "canary-with-warnings" ? "warning" : "pass", "bun run soak:production", "allow only bounded canary while warnings are active"),
    releaseStage("promote_with_warnings", decision === "promote-with-warnings" ? "warning" : "pass", "bun run plan:cutover examples/cutover-rehearsal-pass.json", "require operator acknowledgement for warning promotion"),
    releaseStage("promote", decision === "promote" ? "pass" : decision === "promote-with-warnings" ? "warning" : "blocker", "bun run plan:cutover examples/cutover-rehearsal-pass.json", "promote only when release packet is pass or acknowledged warning"),
    releaseStage("rollback", decision === "rollback" ? "blocker" : "pass", input.deploymentDrift.rollbackTarget.command, "execute last-known-good rollback on rollback decision"),
    releaseStage("emergency_stop", decision === "emergency-stop" ? "blocker" : "pass", "bun run check:restricted-metadata-status", "activate restricted emergency stop and pause risky workers"),
    releaseStage("no_go", decision === "no-go" ? "blocker" : "pass", "bun test && bun run check", "do not promote while proof is incomplete")
  ];
  const proofCommands = uniqueStrings([
    ...stages.map((stage) => stage.proofCommand),
    ...dependencyHealth.map((health) => health.proofCommand),
    ...disasterRecoveryProofs.map((proof) => proof.proofCommand),
    ...observabilityDashboard.proofCommands
  ]);
  return {
    schemaVersion: "ti.enterprise_release_train.v1",
    dryRun: true,
    decision,
    stages,
    disasterRecovery: {
      proofs: disasterRecoveryProofs,
      rollbackCommands: uniqueStrings([
        input.deploymentDrift.rollbackTarget.command,
        "restore previous public wrapper fallback and redeploy hanasand_api",
        "pause source activation waves and drain scheduler queues",
        "hold graph/STIX export until replay proof passes"
      ]),
      backupManifests: ["evidence-export-manifest", "claim-ledger-replay", "graph-export-replay", "source-registry-snapshot"]
    },
    capacityPlan,
    dependencyHealth,
    noLeakReleaseExamples: [
      "public proof matrix stores query, status, run id, cursor, and live state only",
      "DR manifests use hashes, capture ids, ledger ids, and source ids; no raw bodies or credentials",
      "restricted metadata rollback preserves approval state and URL hashes without unsafe target URLs",
      "graph replay uses reviewed relationship ids and STIX-safe descriptors only"
    ],
    operatorRunbook: [
      "run local, route, contract, public proof, deploy hygiene, Docker context, and remote drift checks before canary",
      "keep scraper target at 96 GB and normal ceiling at 160 GB unless explicitly reallocated",
      "preserve at least 500 GB outside scraper for API, frontend, DB, search/vector, graph, object store, and OS cache",
      "keep browser workers disabled and do not assume GPU capacity",
      "execute DR proof before promotion and after rollback closure"
    ],
    proofCommands
  };
}

function buildEnterpriseCapacityPlan(input: CutoverSoakReleasePacketInput): EnterpriseCapacityPlan {
  const budget = input.promotionPacket.resourceBudget;
  const nonScraperReservedGb = budget.nonScraperReservedGb;
  const status: EnterpriseCapacityPlan["status"] = budget.scraperTargetGb > 96 || budget.scraperCeilingGb > 160 || nonScraperReservedGb < 500 || input.soak.summary.memoryRssMaxGb > 160
    ? "blocker"
    : input.soak.summary.memoryRssMaxGb > 96 || input.soak.summary.workerSaturationPercent > DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxWorkerSaturationPercent
      ? "warning"
      : "pass";
  return {
    hostRamGb: Math.max(1_024, nonScraperReservedGb + budget.scraperCeilingGb),
    scraperTargetGb: 96,
    scraperCeilingGb: 160,
    preserveCtiReserveGb: 500,
    nonScraperReservedGb,
    browserPool: "disabled_until_explicitly_allocated",
    assumesGpu: false,
    boundedCaches: true,
    diskFirstEvidence: true,
    status,
    allocations: [
      { service: "scraper", reservedGb: 96, notes: "default target for scraper runtime, queues, adapters, and compact caches" },
      { service: "api", reservedGb: 24, notes: "public and enterprise API headroom outside scraper budget" },
      { service: "frontend", reservedGb: 8, notes: "frontend service headroom outside scraper budget" },
      { service: "postgres", reservedGb: 96, notes: "future durable metadata and queue storage" },
      { service: "search_vector", reservedGb: 160, notes: "future OpenSearch/vector workload reserve" },
      { service: "graph", reservedGb: 96, notes: "future graph store and query reserve" },
      { service: "object_store", reservedGb: 160, notes: "disk-first evidence/object cache reserve" },
      { service: "os_cache_emergency", reservedGb: 192, notes: "OS cache and emergency rollback headroom" }
    ],
    workerCaps: {
      clearWebWorkers: 128,
      publicChannelWorkers: 8,
      restrictedMetadataWorkers: 4,
      browserWorkers: 0
    }
  };
}

function enterpriseReleaseDecision(
  rcBoard: FinalRcBoardPacket,
  realTimeSearchBoard: RealTimeSearchReleaseBoardPacket,
  observabilityDashboard: ProductionObservabilityDashboardPacket,
  dependencyStatus: "pass" | "warning" | "blocker",
  drStatus: "pass" | "warning" | "blocker",
  capacityStatus: "pass" | "warning" | "blocker"
): EnterpriseReleaseDecision {
  if (rcBoard.decision === "emergency-stop" || realTimeSearchBoard.decision === "emergency-stop" || observabilityDashboard.decision === "emergency-stop") return "emergency-stop";
  if (rcBoard.decision === "rollback" || realTimeSearchBoard.decision === "rollback" || observabilityDashboard.decision === "rollback") return "rollback";
  if (dependencyStatus === "blocker" || drStatus === "blocker" || capacityStatus === "blocker" || rcBoard.decision === "no-go" || realTimeSearchBoard.decision === "no-go") return "no-go";
  if (dependencyStatus === "warning" || drStatus === "warning" || capacityStatus === "warning" || observabilityDashboard.decision === "watch" || rcBoard.decision === "promote-with-warnings" || realTimeSearchBoard.decision === "promote-with-warnings") return "promote-with-warnings";
  if (rcBoard.decision === "canary-with-warnings" || realTimeSearchBoard.decision === "canary-with-warnings") return "canary-with-warnings";
  if (rcBoard.decision === "canary-ready" || realTimeSearchBoard.decision === "canary-ready" || rcBoard.decision === "canary-only") return "canary-ready";
  if (rcBoard.decision === "promote" && realTimeSearchBoard.decision === "promote") return "promote";
  return "no-go";
}

function proofStatusFromObservabilityMetric(
  dashboard: ProductionObservabilityDashboardPacket,
  name: ProductionObservabilityMetricName
): "pass" | "warning" | "blocker" {
  return dashboard.sloDashboard.metrics.find((metric) => metric.name === name)?.status ?? "blocker";
}

function drProof(
  name: DisasterRecoveryProof["name"],
  status: DisasterRecoveryProof["status"],
  proofCommand: string,
  restoreCommand: string,
  expectedRecoveryMinutes: number,
  noLeakExample: string
): DisasterRecoveryProof {
  return { name, status, proofCommand, restoreCommand, expectedRecoveryMinutes, noLeakExample };
}

function releaseStage(
  name: EnterpriseReleaseTrainPacket["stages"][number]["name"],
  status: EnterpriseReleaseTrainPacket["stages"][number]["status"],
  proofCommand: string,
  operatorAction: string
): EnterpriseReleaseTrainPacket["stages"][number] {
  return { name, status, proofCommand, operatorAction };
}

function buildObservabilityPublicProofMatrix(
  deploymentDrift: DeploymentDriftReport
): ProductionObservabilityDashboardPacket["publicProofMatrix"] {
  const apiByQuery = new Map(deploymentDrift.apiSearchProofs.map((proof) => [proof.query, proof]));
  const publicByQuery = new Map(deploymentDrift.publicProofs.map((proof) => [proof.query, proof]));
  const queries: string[] = [];
  const seen = new Set<string>();
  for (const query of [...deploymentDrift.publicProofs.map((proof) => proof.query), ...deploymentDrift.apiSearchProofs.map((proof) => proof.query)]) {
    if (seen.has(query)) continue;
    seen.add(query);
    queries.push(query);
  }
  return queries.map((query) => {
    const publicProof = publicByQuery.get(query);
    const apiProof = apiByQuery.get(query);
    const publicOk = publicProof ? publicProof.status >= 200 && publicProof.status < 300 : true;
    const apiOk = apiProof ? apiProof.status >= 200 && apiProof.status < 300 : true;
    return {
      query,
      publicStatus: publicProof?.status,
      apiStatus: apiProof?.status,
      status: publicOk && apiOk ? "pass" : "blocker"
    };
  });
}

function buildProductionFailureClassification(
  metrics: ProductionObservabilityMetric[],
  input: CutoverSoakReleasePacketInput,
  realTimeSearchBoard: RealTimeSearchReleaseBoardPacket
): ProductionFailureClassification[] {
  const metric = (name: ProductionObservabilityMetricName) => metrics.find((item) => item.name === name)?.status ?? "blocker";
  const status = (...names: ProductionObservabilityMetricName[]): ProductionFailureClassification["status"] => worstProofStatus(names.map(metric));
  const classify = (
    name: ProductionFailureClassification["name"],
    metricStatus: ProductionFailureClassification["status"],
    rollbackTrigger: string,
    owner: string,
    runbookAction: string
  ): ProductionFailureClassification => ({ name, status: metricStatus, rollbackTrigger, owner, runbookAction });
  return [
    classify("latency", status("initial_latency_p95_ms", "partial_latency_p95_ms"), "latency.p95", "Agent 09/10", "keep first response queued/searching and pause slow sources"),
    classify("queue", status("queue_age_p95_seconds"), "queue.age_p95", "Agent 02/10", "drain low-priority work and block duplicate live runs"),
    classify("worker", status("worker_saturation_percent"), "workers.saturation", "Agent 02/10", "reduce worker concurrency and defer canaries"),
    classify("resource", status("memory_rss_max_gb", "cpu_max_percent"), "resource.memory_or_cpu", "Agent 10", "keep scraper under 96 GB target and roll back before 160 GB"),
    classify("source", status("adapter_failure_rate_percent", "source_unavailable_rate_percent"), "source.adapter_or_unavailable", "Agent 01/03/04", "pause failing sources and keep caveated partials"),
    classify("policy", status("policy_block_rate_percent"), "policy.block_rate", "Agent 05/10", "hold restricted metadata and alert without exposing raw material"),
    classify("evidence", status("evidence_write_read_proof"), "proof.evidence_write_read", "Agent 06", "hold evidence promotion until write/read proof is green"),
    classify("graph", status("graph_export_readiness"), "proof.graph_export_readiness", "Agent 08", "hold graph/STIX export until review gates pass"),
    classify("public_proof", status("public_proof_matrix"), "proof.public_matrix", "Agent 09/10", "restore public fallback and rerun public proof matrix"),
    classify("deployment", input.deploymentDrift.state === "rollback" ? "blocker" : input.deploymentDrift.state === "drift" ? "warning" : "pass", "deployment.drift", "Agent 10", "use last-known-good source/image/compose rollback target"),
    classify("restricted_safety", input.trends.restrictedKillSwitch.active || realTimeSearchBoard.decision === "emergency-stop" ? "blocker" : "pass", "restricted.kill_switch_state", "Agent 05/10", "activate emergency stop and pause restricted metadata workers")
  ];
}

function liveSearchAlerts(observation: LiveSearchObservation, slo: LiveSearchSlo): LiveSearchAlert[] {
  const alerts: LiveSearchAlert[] = [];

  pushThreshold(alerts, "live_search_initial_response_slow", observation.initialResponseMs, slo.initialResponseMs, slo.initialResponseMs * 3);
  pushThreshold(alerts, "live_search_partial_result_slow", observation.partialResultMs, slo.partialResultMs, slo.partialResultMs * 3);
  pushThreshold(alerts, "live_search_external_dependency_slow", observation.externalDependencyLatencyMs, slo.initialResponseMs, slo.partialResultMs);

  if ((observation.activeRunsForQuery ?? 0) > slo.maxActiveRunsPerTenantQuery) {
    alerts.push({
      name: "live_search_duplicate_active_runs",
      severity: "warn",
      message: "reuse the existing active run for this tenant/query",
      value: observation.activeRunsForQuery ?? 0
    });
  }
  if ((observation.providerFailures ?? 0) > 0) {
    alerts.push({
      name: "live_search_provider_failure",
      severity: (observation.providerFailures ?? 0) >= 3 ? "critical" : "warn",
      message: "live-search provider failure observed",
      value: observation.providerFailures ?? 0
    });
  }
  if ((observation.sourceActivationGaps ?? 0) > 0 && observation.state !== "blocked") {
    alerts.push({
      name: "live_search_source_activation_gap",
      severity: "warn",
      message: "query has source activation gaps",
      value: observation.sourceActivationGaps ?? 0
    });
  }
  if ((observation.resultCount ?? 0) === 0 && (observation.state === "ready" || observation.state === "partial")) {
    alerts.push({
      name: "live_search_zero_result",
      severity: "warn",
      message: "live search returned no usable results",
      value: 0
    });
  }
  if (observation.darknetKillSwitchActive) {
    alerts.push({
      name: "live_search_darknet_kill_switch",
      severity: "critical",
      message: "darknet metadata workers are disabled by kill switch",
      value: 1
    });
  }
  if (observation.state === "disabled") {
    alerts.push({
      name: "live_search_disabled",
      severity: "critical",
      message: observation.disabledReason ?? "live search is disabled",
      value: 1
    });
  }
  if (observation.fallbackProviderHealthy === false) {
    alerts.push({
      name: "live_search_fallback_provider_down",
      severity: "warn",
      message: "temporary outer fallback provider is unhealthy",
      value: 0
    });
  }
  if (observation.scraperNativeHealthy === false) {
    alerts.push({
      name: "live_search_scraper_native_down",
      severity: "critical",
      message: "scraper-native live-search endpoint is unhealthy",
      value: 0
    });
  }
  if (observation.outerFallbackUsed) {
    alerts.push({
      name: "live_search_outer_fallback_usage",
      severity: "warn",
      message: "temporary outer fallback was used for this search",
      value: 1
    });
  }

  return alerts.sort((a, b) => a.name.localeCompare(b.name));
}

function pushThreshold(
  alerts: LiveSearchAlert[],
  name: string,
  value: number | undefined,
  warn: number,
  critical: number
): void {
  if (value === undefined) return;
  if (value >= critical) {
    alerts.push({ name, severity: "critical", message: `${name} exceeded critical threshold`, value });
  } else if (value >= warn) {
    alerts.push({ name, severity: "warn", message: `${name} exceeded warning threshold`, value });
  }
}

function backpressureReason(observation: LiveSearchObservation, duplicateRun: boolean): string | undefined {
  if (observation.state === "disabled") return observation.disabledReason ?? "live search disabled";
  if (observation.state === "blocked") return "collection blocked by policy or source approval";
  if (observation.darknetKillSwitchActive) return "darknet metadata kill switch active";
  if (duplicateRun) return "reuse active tenant/query run";
  if (observation.state === "searching") return "initial run is already searching";
  if (observation.state === "degraded") return "live search degraded; use polling and cached partials";
  return undefined;
}

function check(name: string, ok: boolean, message: string): LiveSearchDeployVerification["checks"][number] {
  return { name, ok, message };
}

function hasRunId(value: Record<string, unknown> | undefined): boolean {
  if (!value) return false;
  if (typeof value.runId === "string" || typeof value.run_id === "string") return true;
  const run = value.run;
  return isRecord(run) && typeof run.id === "string";
}

function hasPartialResult(value: Record<string, unknown> | undefined): boolean {
  if (!value) return false;
  const status = readString(value, "status") ?? readString(value, "state");
  if (["partial", "ready", "searching", "queued", "metadata_review"].includes(status ?? "")) return true;
  const mode = readString(value, "mode");
  if (mode === "live_search" || mode === "interactive") {
    const publicChannel = readRecord(value, "publicChannel");
    return readString(publicChannel, "status") === "partial" || hasArray(publicChannel?.evidence);
  }
  return hasArray(value.results) || hasArray(value.evidence);
}

function hasCursor(value: Record<string, unknown> | undefined): boolean {
  if (!value) return false;
  return typeof value.cursor === "string"
    || typeof value.nextCursor === "string"
    || typeof value.pollCursor === "string"
    || typeof value.deltaCursor === "string";
}

function hasDeltas(value: Record<string, unknown> | undefined): boolean {
  return hasArray(value?.deltas) || hasArray(readRecord(value, "delta")?.items);
}

function hasSourceCoverage(value: Record<string, unknown> | undefined): boolean {
  if (!value) return false;
  if (hasArray(value.sources) || hasArray(value.gaps) || hasArray(value.activationRecommendations)) return true;
  if (typeof value.coverageState === "string") return true;
  if (hasArray(value.activeSources) || hasArray(value.eligibleSources) || hasArray(value.selectedSources)) return true;
  if (hasArray(value.missingVerticals) || hasArray(value.safeSourcePackRecommendations)) return true;
  return typeof value.active === "number"
    || typeof value.sourceActivationGaps === "number"
    || typeof value.covered === "number";
}

function buildSoakStatusReport(
  sample: LiveSearchSoakSample,
  status: LiveSearchSoakReport["status"],
  reasons: string[]
): string {
  return [
    `Agent 10 live-search soak status: ${status}`,
    `scenario: ${sample.scenario}`,
    `durationHours: ${sample.durationHours}`,
    `publicQueryCount: ${sample.publicQueryCount ?? 0}`,
    `runReuseOk: ${sample.runReuseOk ?? sample.duplicateActiveRuns === 0}`,
    `cursorPollingOk: ${sample.cursorPollingOk ?? true}`,
    `latencyP95Ms: initial=${sample.initialLatencyP95Ms} partial=${sample.partialLatencyP95Ms}`,
    `errorRatePercent: ${sample.errorRatePercent}`,
    `duplicateActiveRuns: ${sample.duplicateActiveRuns}`,
    `sourceCoveragePercent: ${sample.sourceCoveragePercent}`,
    `queueAgeP95Seconds: ${sample.queueAgeP95Seconds}`,
    `workerSaturationPercent: ${sample.workerSaturationPercent ?? 0}`,
    `cpuMaxPercent: ${sample.cpuMaxPercent ?? 0}`,
    `memoryRssMaxGb: ${sample.memoryRssMaxGb}`,
    `policyBlocks: ${sample.policyBlocks} rate=${sample.policyBlockRatePercent ?? safeRate(sample.policyBlocks, 100)} rejectedUnsafeActions=${sample.rejectedUnsafeActions ?? 0} unsafeRetries=${sample.unsafePolicyRetries}`,
    `restrictedKillSwitchActive: ${sample.restrictedKillSwitchActive === true}`,
    `proofs: evidenceWriteRead=${sample.evidenceWriteReadOk ?? true} graphExportReadiness=${sample.graphExportReadinessOk ?? true} publicApiCompatibility=${sample.publicApiCompatibilityOk ?? true}`,
    `sourceUnavailableRatePercent: ${sample.sourceUnavailableRatePercent ?? 0}`,
    `staleCacheRatePercent: ${sample.staleCacheRatePercent ?? 0}`,
    `fallbackUsed: ${sample.fallbackUsed}`,
    `rollbackReasons: ${reasons.length > 0 ? reasons.join(", ") : "none"}`
  ].join("\n");
}

function releaseDecision(
  input: CutoverSoakReleasePacketInput,
  runtimeProofs: CutoverRuntimeReleaseProof[],
  deploymentProofs: CutoverDeploymentProofSlot[],
  blockers: Array<{ name: string }>,
  warnings: Array<{ name: string }>
): CutoverReleaseDecision {
  const restrictedEmergencyStopActive = input.trends.restrictedKillSwitch.active
    || runtimeProofs.some((proof) => proof.name === "restricted_kill_switch" && proof.status === "blocker")
    || deploymentProofs.some((proof) => proof.name === "restricted_emergency_stop" && proof.status === "blocker");
  if (restrictedEmergencyStopActive) return "emergency-stop";
  if (input.soak.status === "rollback" || input.deploymentDrift.state === "rollback" || input.promotionPacket.decision === "rollback") return "rollback";
  if (blockers.length > 0) return "hold-on-blocker";
  if (input.soak.status === "hold" || input.soak.summary.durationHours < DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.durationHours) return "continue-soak";
  if (warnings.length > 0 || input.deploymentDrift.state === "drift" || input.promotionPacket.decision === "hold") return "promote-with-warnings";
  return "promote";
}

function normalizeReleaseTrainStages(
  input: CutoverSoakReleasePacketInput,
  runtimeProofs: CutoverRuntimeReleaseProof[],
  deploymentProofs: CutoverDeploymentProofSlot[]
): CutoverReleaseTrainStage[] {
  const generated = DEFAULT_RELEASE_TRAIN_STAGE_SPECS.map((spec) => buildReleaseTrainStage(spec, input, runtimeProofs, deploymentProofs));
  const byName = new Map((input.releaseTrainStages ?? []).map((stage) => [stage.name, stage]));
  return generated.map((stage) => byName.get(stage.name) ?? stage);
}

function buildReleaseTrainOrchestration(
  input: CutoverSoakReleasePacketInput,
  decision: CutoverReleaseDecision,
  stages: CutoverReleaseTrainStage[],
  runtimeProofs: CutoverRuntimeReleaseProof[],
  deploymentProofs: CutoverDeploymentProofSlot[]
): CutoverReleaseTrainOrchestration {
  return {
    windowHours: 24,
    currentDecision: decision,
    stages,
    localProofCommands: uniqueStrings(deploymentProofs.map((proof) => proof.localCommand)),
    remoteProofCommands: uniqueStrings(deploymentProofs.map((proof) => proof.remoteCommand)),
    publicProofCommands: uniqueStrings(deploymentProofs
      .filter((proof) => proof.name === "public_post_api_proof" || proof.name === "frontend_ti_query_proof")
      .map((proof) => proof.proofCommand)),
    resourceGuardrails: {
      scraperTargetGb: input.promotionPacket.resourceBudget.scraperTargetGb,
      scraperCeilingGb: input.promotionPacket.resourceBudget.scraperCeilingGb,
      nonScraperReservedGb: input.promotionPacket.resourceBudget.nonScraperReservedGb,
      queueAgeP95Seconds: input.trends.queuePressure.p95Seconds,
      memoryRssMaxGb: input.trends.resources.memoryRssMaxGb
    },
    staleBlockers: runtimeProofs
      .filter((proof) => proof.name === "clear_web_blocker_status" && proof.status === "blocker")
      .map((proof) => `runtime.${proof.name}`),
    strayRootHandling: "advisory_no_deletion"
  };
}

function buildReleaseCandidateGatePacket(
  input: CutoverSoakReleasePacketInput,
  releaseDecisionValue: CutoverReleaseDecision,
  releaseTrain: CutoverReleaseTrainOrchestration,
  runtimeProofs: CutoverRuntimeReleaseProof[],
  deploymentProofs: CutoverDeploymentProofSlot[],
  blockers: Array<{ owner: string; name: string }>,
  warnings: Array<{ owner: string; name: string }>
): ReleaseCandidateGatePacket {
  const rcDecision = releaseCandidateDecision(releaseDecisionValue, blockers, warnings);
  const proofSlots = buildReleaseCandidateProofSlots(input, releaseTrain, runtimeProofs, deploymentProofs);
  return {
    schemaVersion: "ti.release_candidate.gate_packet.v1",
    decision: rcDecision,
    releaseDecision: releaseDecisionValue,
    routeInventoryCount: routeInventoryCountFromProof(input.deploymentDrift),
    routeInventoryExpectedMinimum: 26,
    proofSlots,
    rolloutRunbook: releaseCandidateRunbook(rcDecision),
    guardrails: {
      scraperTargetGb: releaseTrain.resourceGuardrails.scraperTargetGb,
      scraperCeilingGb: releaseTrain.resourceGuardrails.scraperCeilingGb,
      nonScraperReservedGb: releaseTrain.resourceGuardrails.nonScraperReservedGb,
      memoryRssMaxGb: releaseTrain.resourceGuardrails.memoryRssMaxGb,
      queueAgeP95Seconds: releaseTrain.resourceGuardrails.queueAgeP95Seconds,
      strayRootHandling: releaseTrain.strayRootHandling
    },
    blockers: blockers.map((blocker) => `${blocker.owner}:${blocker.name}`),
    warnings: warnings.map((warning) => `${warning.owner}:${warning.name}`)
  };
}

function releaseCandidateDecision(
  releaseDecisionValue: CutoverReleaseDecision,
  blockers: Array<{ name: string }>,
  warnings: Array<{ name: string }>
): ReleaseCandidateDecision {
  if (releaseDecisionValue === "emergency-stop") return "emergency-stop";
  if (releaseDecisionValue === "rollback") return "rollback";
  if (blockers.length > 0 || releaseDecisionValue === "hold-on-blocker") return "no-go";
  if (releaseDecisionValue === "continue-soak") return "canary-only";
  if (warnings.length > 0 || releaseDecisionValue === "promote-with-warnings") return "promote-with-warnings";
  return "promote";
}

function buildReleaseCandidateProofSlots(
  input: CutoverSoakReleasePacketInput,
  releaseTrain: CutoverReleaseTrainOrchestration,
  runtimeProofs: CutoverRuntimeReleaseProof[],
  deploymentProofs: CutoverDeploymentProofSlot[]
): ReleaseCandidateProofSlot[] {
  const deployment = (name: CutoverDeploymentProofSlotName) => deploymentProofs.find((proof) => proof.name === name);
  const runtime = (name: CutoverRuntimeReleaseProofName) => runtimeProofs.find((proof) => proof.name === name);
  const stage = (name: CutoverReleaseTrainStageName) => releaseTrain.stages.find((item) => item.name === name);
  const slot = (
    name: ReleaseCandidateProofName,
    status: ReleaseCandidateProofSlot["status"],
    proofCommand: string,
    expectedOutput: string,
    rollbackPath: string,
    message: string
  ): ReleaseCandidateProofSlot => ({ name, owner: "Agent 10", status, proofCommand, expectedOutput, rollbackPath, message });

  const routeInventoryCount = routeInventoryCountFromProof(input.deploymentDrift);
  const routeStatus: ReleaseCandidateProofSlot["status"] = routeInventoryCount >= 26 && deployment("route_inventory")?.status === "pass"
    ? "pass"
    : routeInventoryCount >= 24
      ? "warning"
      : "blocker";

  return [
    slot("local_proof", deployment("local_tests")?.status ?? "blocker", "bun test", "full local test suite passes", deployment("local_tests")?.rollbackPath ?? "stop release candidate", "local tests are required before RC certification"),
    slot("remote_proof", deployment("remote_typecheck")?.status ?? "blocker", "bun run check", "local and remote typecheck pass", deployment("remote_typecheck")?.rollbackPath ?? "hold RC", "remote typecheck and sync proof are required"),
    slot("docker_image_build_test_enforcement", deployment("docker_image_test_enforcement")?.status ?? "blocker", "bun run check:deploy-hygiene && bun run check:docker-contexts", "Docker image build enforces bun test and bun run check", deployment("docker_image_test_enforcement")?.rollbackPath ?? "keep existing image", "image build/test enforcement must stay green"),
    slot("route_inventory_count", routeStatus, "bun run check:route-inventory", "route inventory includes current mounted route count and no unsafe raw proof payloads", deployment("route_inventory")?.rollbackPath ?? "hold route rollout", `routeInventoryCount=${routeInventoryCount}`),
    slot("contracts_route", deployment("contracts_route")?.status ?? routeStatus, "bun run check:route-inventory", "/v1/contracts is present and advertises route-visible contracts", deployment("contracts_route")?.rollbackPath ?? "hold API contract promotion", "/v1/contracts proof is covered by route inventory"),
    slot("public_post_api_proof", deployment("public_post_api_proof")?.status ?? "blocker", "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "public POST API returns run ids and live state", deployment("public_post_api_proof")?.rollbackPath ?? "restore API fallback", "canonical public API proof remains POST JSON"),
    slot("frontend_ti_query_proof", deployment("frontend_ti_query_proof")?.status ?? "blocker", "bun run check:live-search-deploy", "frontend /ti?q= returns live_search and partial markers", deployment("frontend_ti_query_proof")?.rollbackPath ?? "keep frontend fallback", "frontend proof guards user-facing RC canary"),
    slot("source_canary_readiness", runtime("source_runtime_sla")?.status ?? "blocker", runtime("source_runtime_sla")?.proofCommand ?? "bun test src/tests/sourceSeeds.test.ts", "source activation/canary readiness is dry-run and safe-public only", runtime("source_runtime_sla")?.rollbackPath ?? "hold source activation waves", runtime("source_runtime_sla")?.message ?? "source canary status missing"),
    slot("worker_slo_soak", stage("resource_and_queue_headroom")?.status ?? "blocker", "bun test src/tests/schedulerProduction.test.ts", "worker SLO soak preserves queue pressure and memory headroom", stage("resource_and_queue_headroom")?.rollbackPath ?? "continue soak", stage("resource_and_queue_headroom")?.message ?? "worker soak stage missing"),
    slot("public_channel_canary", runtime("public_channel_sla")?.status ?? "blocker", runtime("public_channel_sla")?.proofCommand ?? "bun test src/tests/telegramPublic.test.ts", "public-channel canary is approved public data only", runtime("public_channel_sla")?.rollbackPath ?? "hold public-channel canary", runtime("public_channel_sla")?.message ?? "public-channel canary status missing"),
    slot("restricted_certification", stage("safety_and_retention")?.status ?? "blocker", "bun run check:restricted-metadata-status && bun run check:restricted-metadata-apply-plan", "restricted certification keeps emergency stop and metadata-only controls available", stage("safety_and_retention")?.rollbackPath ?? "activate restricted emergency stop", stage("safety_and_retention")?.message ?? "restricted certification stage missing"),
    slot("evidence_cutover", runtime("claim_ledger_route_proof")?.status ?? "blocker", runtime("claim_ledger_route_proof")?.proofCommand ?? "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts", "evidence cutover proof keeps replay and claim ledger safe", runtime("claim_ledger_route_proof")?.rollbackPath ?? "hold evidence cutover", runtime("claim_ledger_route_proof")?.message ?? "evidence cutover status missing"),
    slot("graph_export_certification", runtime("graph_export_sla")?.status ?? "blocker", runtime("graph_export_sla")?.proofCommand ?? "bun run check:graph-review-mounted", "graph/export certification allows only reviewed or accepted relationships", runtime("graph_export_sla")?.rollbackPath ?? "hold graph export", runtime("graph_export_sla")?.message ?? "graph export status missing"),
    slot("memory_headroom", deployment("memory_budget")?.status ?? "blocker", deployment("memory_budget")?.proofCommand ?? "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot", "RSS remains under 96 GB target and 160 GB ceiling", deployment("memory_budget")?.rollbackPath ?? "reduce workers and continue fallback", `memoryRssMaxGb=${releaseTrain.resourceGuardrails.memoryRssMaxGb}`),
    slot("non_scraper_500gb_reserve", deployment("non_scraper_500gb_reserve")?.status ?? "blocker", "bun run check:remote-drift", "at least 500 GB remains available for the rest of CTI", deployment("non_scraper_500gb_reserve")?.rollbackPath ?? "hold RC", `nonScraperReservedGb=${releaseTrain.resourceGuardrails.nonScraperReservedGb}`),
    slot("queue_pressure", stage("resource_and_queue_headroom")?.status ?? "blocker", "bun test src/tests/schedulerProduction.test.ts", "queue p95 remains inside soak budget", stage("resource_and_queue_headroom")?.rollbackPath ?? "continue soak", `queueAgeP95Seconds=${releaseTrain.resourceGuardrails.queueAgeP95Seconds}`),
    slot("agent03_fail_closed", releaseTrain.staleBlockers.length > 0 ? "blocker" : "pass", "rg '^Status: clear_web_promotion' coordination_agent_03.md && bun test src/tests/adapterFixtures.test.ts", "Agent 03 clear-web proof is current or release fails closed", "keep outer fallback until Agent 03 proof is current", releaseTrain.staleBlockers.length > 0 ? releaseTrain.staleBlockers.join(", ") : "Agent 03 clear-web proof is current"),
    slot("stray_root_advisory", deployment("stray_root_advisory")?.status ?? "warning", "bun run check:remote-drift", "stray-root files are reported as advisory only; no deletion performed", deployment("stray_root_advisory")?.rollbackPath ?? "report only; do not delete", "stray-root handling remains advisory")
  ];
}

function routeInventoryCountFromProof(deploymentDrift: DeploymentDriftReport): number {
  const routeCountReason = deploymentDrift.blockedPromotionReasons.find((reason) => reason.startsWith("route.inventory_count."));
  if (routeCountReason) {
    const parsed = Number(routeCountReason.split(".").at(-1));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 26;
}

function releaseCandidateRunbook(decision: ReleaseCandidateDecision): string[] {
  if (decision === "emergency-stop") {
    return [
      "activate restricted emergency stop and keep restricted metadata sources disabled",
      "leave public API on last-known-good fallback",
      "capture resource, route, and public proof outputs for incident review"
    ];
  }
  if (decision === "rollback") {
    return [
      "run the deployment drift rollback command for last-known-good image/source/compose",
      "verify public /ti and POST API proof after rollback",
      "continue soak only after remote drift and route inventory are green"
    ];
  }
  if (decision === "no-go") {
    return [
      "do not start production canary",
      "clear listed blockers with owner proof commands",
      "rerun local tests, typecheck, route inventory, remote drift, and public proof"
    ];
  }
  if (decision === "canary-only") {
    return [
      "limit rollout to canary traffic and keep outer fallback active",
      "watch source canary, worker SLO, public-channel canary, memory, and queue pressure",
      "continue 24h soak until duration and proof gates are complete"
    ];
  }
  return [
    "promote scraper-native path according to main-agent deploy approval",
    "keep rollback target and emergency-stop commands ready during the canary window",
    "repeat route inventory, public POST API proof, frontend /ti?q= proof, and resource snapshot after promotion"
  ];
}

function buildCanaryReleaseExecutionPacket(
  input: CutoverSoakReleasePacketInput,
  rcGate: ReleaseCandidateGatePacket
): CanaryReleaseExecutionPacket {
  const decision = canaryReleaseDecision(rcGate);
  const proof = buildCanaryReleaseProofs(rcGate);
  const rollbackSteps = canaryRollbackSteps(input, rcGate, decision);
  return {
    schemaVersion: "ti.canary_release.execution_packet.v1",
    dryRun: true,
    decision,
    rcDecision: rcGate.decision,
    proof,
    rollbackSteps,
    operatorSignoff: {
      required: decision === "canary-ready" || decision === "canary-with-warnings",
      signedOff: false,
      fields: ["main_agent_approval", "agent03_clear_web_current", "restricted_safety_ack", "rollback_target_ack", "resource_budget_ack"]
    },
    guardrails: rcGate.guardrails,
    strayRootHandling: "advisory_no_deletion"
  };
}

function canaryReleaseDecision(rcGate: ReleaseCandidateGatePacket): CanaryReleaseExecutionDecision {
  if (rcGate.decision === "emergency-stop") return "emergency-stop";
  if (rcGate.decision === "rollback") return "rollback";
  if (rcGate.decision === "no-go") return "no-go";
  if (rcGate.decision === "promote-with-warnings" || rcGate.decision === "canary-only") return "canary-with-warnings";
  return "canary-ready";
}

function buildCanaryReleaseProofs(rcGate: ReleaseCandidateGatePacket): CanaryReleaseExecutionProof[] {
  const slot = (name: ReleaseCandidateProofName) => rcGate.proofSlots.find((proof) => proof.name === name);
  const proof = (
    name: CanaryReleaseExecutionProofName,
    sourceProof: CanaryReleaseExecutionProof["sourceProof"],
    fallbackCommand: string,
    expectedOutput: string,
    rollbackStep: string
  ): CanaryReleaseExecutionProof => {
    const source = sourceProof === "remote_drift" ? undefined : slot(sourceProof);
    return {
      name,
      status: source?.status ?? (sourceProof === "remote_drift" ? "pass" : "blocker"),
      sourceProof,
      proofCommand: source?.proofCommand ?? fallbackCommand,
      expectedOutput: source?.expectedOutput ?? expectedOutput,
      rollbackStep: source?.rollbackPath ?? rollbackStep
    };
  };
  return [
    proof("source_activation_canary", "source_canary_readiness", "bun test src/tests/sourceSeeds.test.ts", "source activation canary remains dry-run and safe-public only", "pause source activation canary and keep sources in candidate/review state"),
    proof("scheduler_soak_telemetry", "worker_slo_soak", "bun test src/tests/schedulerProduction.test.ts", "scheduler soak telemetry keeps queue and worker SLOs inside budget", "pause canary fanout and drain live-search queue"),
    proof("public_channel_promotion_canary", "public_channel_canary", "bun test src/tests/telegramPublic.test.ts", "public-channel canary promotes approved public evidence only", "revert public-channel canary to partial/read-only mode"),
    proof("restricted_kill_switch_drill", "restricted_certification", "bun run check:restricted-metadata-status && bun run check:restricted-metadata-apply-plan", "restricted kill-switch drill and metadata-only certification pass", "activate restricted emergency stop and disable restricted metadata workers"),
    proof("evidence_persistence_certification", "evidence_cutover", "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts", "evidence persistence and replay certification pass", "hold evidence cutover and continue in-memory/last-known-good persistence path"),
    proof("public_answer_polling_contract", "frontend_ti_query_proof", "bun run check:live-search-deploy", "public answer polling exposes run id, live state, and partial markers", "restore public wrapper fallback and increase polling interval"),
    proof("graph_export_certification", "graph_export_certification", "bun run check:graph-review-mounted", "graph/export certification passes", "hold graph/STIX export promotion"),
    proof("contracts_route", "contracts_route", "bun run check:route-inventory", "/v1/contracts advertises canary and integration surfaces", "hold API contract promotion"),
    proof("public_post_api_proof", "public_post_api_proof", "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "public POST API proof returns run ids and live state", "restore public API fallback"),
    proof("frontend_ti_query_proof", "frontend_ti_query_proof", "bun run check:live-search-deploy", "frontend /ti?q= proof returns live-search markers", "restore frontend fallback"),
    proof("docker_image_test_enforcement", "docker_image_build_test_enforcement", "bun run check:deploy-hygiene && bun run check:docker-contexts", "Docker image test enforcement is green", "keep existing image and stop canary"),
    proof("route_inventory", "route_inventory_count", "bun run check:route-inventory", "route inventory count is current and safe", "hold route rollout"),
    proof("remote_drift", "remote_drift", "bun run check:remote-drift", "remote drift check passes and reports stray-root files only", "restore last-known-good source/image/compose"),
    proof("memory_headroom", "memory_headroom", "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot", "memory remains under 96 GB target and 160 GB ceiling", "reduce workers and stop canary traffic"),
    proof("non_scraper_500gb_reserve", "non_scraper_500gb_reserve", "bun run check:remote-drift", "500 GB remains reserved for non-scraper CTI components", "stop rollout until reserve is restored"),
    proof("queue_pressure", "queue_pressure", "bun test src/tests/schedulerProduction.test.ts", "queue pressure remains inside soak budget", "pause source/public-channel canaries and drain queue"),
    proof("agent03_fail_closed", "agent03_fail_closed", "rg '^Status: clear_web_promotion' coordination_agent_03.md && bun test src/tests/adapterFixtures.test.ts", "Agent 03 clear-web proof is current or canary is no-go", "keep outer fallback until Agent 03 proof is current"),
    proof("stray_root_advisory", "stray_root_advisory", "bun run check:remote-drift", "stray-root findings are advisory-only and no deletion is performed", "report only; do not delete without explicit approval")
  ];
}

function canaryRollbackSteps(
  input: CutoverSoakReleasePacketInput,
  rcGate: ReleaseCandidateGatePacket,
  decision: CanaryReleaseExecutionDecision
): string[] {
  if (decision === "emergency-stop") {
    return [
      "activate restricted emergency stop and pause restricted metadata workers",
      "keep public API/frontend on last-known-good fallback",
      "run bun run check:restricted-metadata-status and preserve audit evidence"
    ];
  }
  const base = [
    input.deploymentDrift.rollbackTarget.command,
    "bun run check:live-search-deploy",
    "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof",
    "bun run check:remote-drift"
  ];
  if (rcGate.proofSlots.some((slot) => slot.name === "agent03_fail_closed" && slot.status === "blocker")) {
    base.unshift("keep outer fallback active until Agent 03 clear-web proof is current");
  }
  return uniqueStrings(base);
}

function buildFinalRcBoardPacket(
  input: CutoverSoakReleasePacketInput,
  releaseDecisionValue: CutoverReleaseDecision,
  rcGate: ReleaseCandidateGatePacket,
  canaryExecution: CanaryReleaseExecutionPacket,
  releaseTrain: CutoverReleaseTrainOrchestration,
  runtimeProofs: CutoverRuntimeReleaseProof[],
  deploymentProofs: CutoverDeploymentProofSlot[],
  blockers: Array<{ owner: string; name: string; proofCommand: string; rollbackPath: string }>,
  warnings: Array<{ owner: string; name: string; proofCommand: string }>
): FinalRcBoardPacket {
  const gates = buildFinalRcBoardGates(runtimeProofs, deploymentProofs, releaseTrain);
  const proofCommands = uniqueStrings([
    "bun test",
    "bun run check",
    "bun run check:route-inventory",
    "bun run check:deploy-hygiene",
    "bun run check:docker-contexts",
    "bun run check:remote-drift",
    "bun run rehearse:cutover examples/cutover-rehearsal-pass.json",
    "bun run plan:cutover examples/cutover-rehearsal-pass.json",
    "bun run check:live-search-deploy",
    "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof",
    ...rcGate.proofSlots.map((slot) => slot.proofCommand),
    ...canaryExecution.proof.map((proof) => proof.proofCommand),
    ...gates.flatMap((gate) => gate.proofCommands)
  ]);
  const rollbackProcedures = uniqueStrings([
    ...canaryExecution.rollbackSteps,
    input.deploymentDrift.rollbackTarget.command,
    ...blockers.map((blocker) => blocker.rollbackPath),
    ...rcGate.proofSlots.map((slot) => slot.rollbackPath)
  ]);
  const proofSlot = (name: ReleaseCandidateProofName) => rcGate.proofSlots.find((slot) => slot.name === name);
  const contractsRoute = proofSlot("contracts_route");
  const publicPost = proofSlot("public_post_api_proof");
  const frontendTi = proofSlot("frontend_ti_query_proof");
  const memoryHeadroom = proofSlot("memory_headroom");
  const queuePressure = proofSlot("queue_pressure");
  const agent03 = proofSlot("agent03_fail_closed");
  const resourceStatuses: ReleaseCandidateProofSlot["status"][] = [
    memoryHeadroom?.status ?? "blocker",
    proofSlot("non_scraper_500gb_reserve")?.status ?? "blocker"
  ];
  const decision = finalRcBoardDecision(releaseDecisionValue, rcGate, canaryExecution, blockers, warnings);

  return {
    schemaVersion: "ti.final_rc.board.v1",
    dryRun: true,
    decision,
    releaseDecision: releaseDecisionValue,
    rcDecision: rcGate.decision,
    canaryDecision: canaryExecution.decision,
    gates,
    proofCommands,
    rollbackProcedures,
    routeTruthAudit: {
      routeInventoryCount: rcGate.routeInventoryCount,
      expectedMinimum: rcGate.routeInventoryExpectedMinimum,
      contractsRouteStatus: contractsRoute?.status ?? "blocker",
      proofCommand: contractsRoute?.proofCommand ?? "bun run check:route-inventory"
    },
    publicProofSlots: {
      publicPostApi: publicPost?.status ?? "blocker",
      frontendTiQuery: frontendTi?.status ?? "blocker",
      proofCommands: uniqueStrings([
        publicPost?.proofCommand ?? "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof",
        frontendTi?.proofCommand ?? "bun run check:live-search-deploy"
      ])
    },
    resourceHeadroom: {
      scraperTargetGb: rcGate.guardrails.scraperTargetGb,
      scraperCeilingGb: rcGate.guardrails.scraperCeilingGb,
      nonScraperReservedGb: rcGate.guardrails.nonScraperReservedGb,
      memoryRssMaxGb: rcGate.guardrails.memoryRssMaxGb,
      preserveCtiReserveGb: 500,
      status: worstProofStatus(resourceStatuses)
    },
    queuePressure: {
      p95Seconds: rcGate.guardrails.queueAgeP95Seconds,
      status: queuePressure?.status ?? "blocker"
    },
    agent03FailClosed: {
      active: agent03?.status === "blocker",
      status: agent03?.status === "blocker" ? "blocker" : "pass",
      proofCommand: agent03?.proofCommand ?? "rg '^Status: clear_web_promotion' coordination_agent_03.md && bun test src/tests/adapterFixtures.test.ts"
    },
    operatorSignoff: {
      required: decision === "canary-ready"
        || decision === "canary-with-warnings"
        || decision === "promote-with-warnings"
        || decision === "promote",
      signedOff: false,
      fields: ["main_agent_approval", "agent03_clear_web_current", "restricted_safety_ack", "rollback_target_ack", "resource_budget_ack", "public_proof_ack", "route_truth_ack"]
    },
    strayRootHandling: "advisory_no_deletion"
  };
}

function finalRcBoardDecision(
  releaseDecisionValue: CutoverReleaseDecision,
  rcGate: ReleaseCandidateGatePacket,
  canaryExecution: CanaryReleaseExecutionPacket,
  blockers: Array<{ name: string }>,
  warnings: Array<{ name: string }>
): FinalRcBoardDecision {
  if (releaseDecisionValue === "emergency-stop" || rcGate.decision === "emergency-stop" || canaryExecution.decision === "emergency-stop") return "emergency-stop";
  if (releaseDecisionValue === "rollback" || rcGate.decision === "rollback" || canaryExecution.decision === "rollback") return "rollback";
  if (rcGate.decision === "no-go" || canaryExecution.decision === "no-go" || blockers.length > 0 || releaseDecisionValue === "hold-on-blocker") return "no-go";
  if (rcGate.decision === "canary-only" || releaseDecisionValue === "continue-soak") return "canary-only";
  if (canaryExecution.decision === "canary-ready" && rcGate.decision === "promote") return "canary-ready";
  if (canaryExecution.decision === "canary-with-warnings") return "canary-with-warnings";
  if (rcGate.decision === "promote-with-warnings" || warnings.length > 0 || releaseDecisionValue === "promote-with-warnings") return "promote-with-warnings";
  return "promote";
}

function buildFinalRcBoardGates(
  runtimeProofs: CutoverRuntimeReleaseProof[],
  deploymentProofs: CutoverDeploymentProofSlot[],
  releaseTrain: CutoverReleaseTrainOrchestration
): FinalRcBoardGate[] {
  const runtime = (name: CutoverRuntimeReleaseProofName) => runtimeProofs.find((proof) => proof.name === name);
  const deployment = (name: CutoverDeploymentProofSlotName) => deploymentProofs.find((proof) => proof.name === name);
  const gate = (
    name: FinalRcBoardGateName,
    owner: string,
    proofs: Array<CutoverRuntimeReleaseProof | CutoverDeploymentProofSlot | undefined>,
    fallbackProofCommands: string[],
    rollbackPath: string,
    message: string
  ): FinalRcBoardGate => {
    const statuses = proofs.map((proof) => proof?.status ?? "blocker");
    const resourceStatuses = proofs
      .filter((proof): proof is CutoverRuntimeReleaseProof => isRuntimeProof(proof))
      .map((proof) => proof.resourceBudgetStatus === "critical" ? "blocker" : proof.resourceBudgetStatus);
    return {
      name,
      owner,
      status: worstProofStatus([...statuses, ...resourceStatuses]),
      proofCommands: uniqueStrings([
        ...proofs.map((proof) => proof?.proofCommand).filter((command): command is string => typeof command === "string"),
        ...fallbackProofCommands
      ]),
      rollbackPath,
      message
    };
  };

  return [
    gate("agent01_source_readiness", "Agent 01", [runtime("activation_batches"), runtime("source_runtime_sla")], ["bun run check:source-apply-plan"], "hold source activation waves", "source activation batches and source runtime SLA"),
    gate("agent02_scheduler_readiness", "Agent 02", [runtime("queue_economics"), runtime("scheduler_runtime_sla")], ["bun run check:frontier-apply-plan"], "pause scheduler fanout and drain live-search queue", "scheduler queue economics and worker SLA"),
    gate("agent03_clear_web_fail_closed", "Agent 03", [runtime("clear_web_blocker_status")], ["rg '^Status: clear_web_promotion' coordination_agent_03.md && bun test src/tests/adapterFixtures.test.ts"], "keep outer fallback until clear-web proof is current", releaseTrain.staleBlockers.length > 0 ? "Agent 03 stale proof is fail-closed" : "Agent 03 clear-web proof is current"),
    gate("agent04_public_channel_readiness", "Agent 04", [runtime("public_channel_answer_readiness"), runtime("public_channel_sla")], ["bun test src/tests/telegramPublic.test.ts"], "keep public-channel evidence partial/read-only", "public-channel answer readiness and SLA"),
    gate("agent05_restricted_safety", "Agent 05", [runtime("restricted_kill_switch"), runtime("restricted_metadata_sla"), deployment("restricted_emergency_stop")], ["bun run check:restricted-metadata-status"], "activate restricted emergency stop and pause restricted workers", "restricted safety, kill-switch, and metadata-only certification"),
    gate("agent06_evidence_readiness", "Agent 06", [runtime("claim_ledger"), runtime("claim_ledger_route_proof")], ["bun test src/tests/storageCutover.test.ts"], "hold evidence cutover and continue last-known-good persistence path", "claim ledger, replay, and evidence persistence"),
    gate("agent07_answer_quality", "Agent 07", [runtime("answer_review_gates"), runtime("answer_readiness_sla")], ["bun run check:search-quality-mounted"], "keep weak-evidence answers held for review", "answer quality and public-answer readiness"),
    gate("agent08_graph_export_readiness", "Agent 08", [runtime("graph_export_gates"), runtime("graph_export_sla")], ["bun run check:graph-review-mounted"], "hold graph/STIX export promotion", "graph review and export certification"),
    gate("agent09_api_readiness", "Agent 09", [runtime("api_cutover_proof"), runtime("api_readiness_sla"), deployment("contracts_route")], ["bun run check:route-inventory"], "restore public API wrapper fallback", "API cutover proof, /v1/contracts, and public compatibility"),
    gate("agent10_deployment_proof", "Agent 10", deploymentProofs, ["bun test", "bun run check", "bun run check:remote-drift"], "execute last-known-good deployment rollback path", "local/remote/public/Docker/resource proof")
  ];
}

function isRuntimeProof(proof: CutoverRuntimeReleaseProof | CutoverDeploymentProofSlot | undefined): proof is CutoverRuntimeReleaseProof {
  return Boolean(proof && "resourceBudgetStatus" in proof);
}

function worstProofStatus(statuses: Array<ReleaseCandidateProofSlot["status"] | CutoverRuntimeReleaseProof["resourceBudgetStatus"]>): "pass" | "warning" | "blocker" {
  if (statuses.includes("blocker") || statuses.includes("critical")) return "blocker";
  if (statuses.includes("warning")) return "warning";
  return "pass";
}

function buildProductTiReleaseBoardPacket(
  input: CutoverSoakReleasePacketInput,
  rcBoard: FinalRcBoardPacket,
  runtimeProofs: CutoverRuntimeReleaseProof[],
  deploymentProofs: CutoverDeploymentProofSlot[],
  blockers: Array<{ owner: string; name: string; proofCommand: string; rollbackPath: string }>,
  warnings: Array<{ owner: string; name: string; proofCommand: string }>
): ProductTiReleaseBoardPacket {
  const deployment = (name: CutoverDeploymentProofSlotName) => deploymentProofs.find((proof) => proof.name === name);
  const runtime = (name: CutoverRuntimeReleaseProofName) => runtimeProofs.find((proof) => proof.name === name);
  const publicStatus = deployment("public_post_api_proof")?.status ?? "blocker";
  const frontendStatus = deployment("frontend_ti_query_proof")?.status ?? "blocker";
  const routeStatus = deployment("route_inventory")?.status ?? "blocker";
  const checkStatus = deployment("local_tests")?.status ?? "blocker";
  const typecheckStatus = deployment("remote_typecheck")?.status ?? "blocker";
  const recommendedSeconds = DEFAULT_LIVE_SEARCH_SLO.recommendedPollIntervalMs / 1_000;
  const pollingStatus: ProductTiReleaseBoardPacket["pollingProof"]["status"] = recommendedSeconds <= 3 ? "pass" : recommendedSeconds <= 10 ? "warning" : "blocker";
  const policyGatedSourcesDoNotBlockPublicEvidence = publicStatus !== "blocker" && frontendStatus !== "blocker";
  const noLeakGuarantees: ProductTiReleaseBoardProof[] = [
    productProof("route_truth_no_raw_payload", routeStatus, "bun run check:route-inventory", "mounted route inventory returns compact safe responses without raw proof payloads", "hold route promotion"),
    productProof("restricted_metadata_no_leak", runtime("restricted_metadata_sla")?.status ?? "blocker", runtime("restricted_metadata_sla")?.proofCommand ?? "bun run check:restricted-metadata-status", "restricted metadata remains metadata-only without raw URLs, bodies, credentials, or object keys", "activate restricted emergency stop"),
    productProof("public_answer_no_demo_cache", frontendStatus, "bun run check:live-search-deploy", "public /ti renders no default APT29, no local-cache/demo prose, and live markers for queried pages", "restore public frontend fallback")
  ];
  const agent03Status = runtime("clear_web_blocker_status")?.status === "blocker" ? "active" : runtime("clear_web_blocker_status")?.status ?? "warning";
  const agent06Status = runtime("claim_ledger_route_proof")?.status === "blocker" ? "active" : runtime("claim_ledger_route_proof")?.status ?? "warning";
  const decision = productTiBoardDecision(rcBoard, {
    publicStatus,
    frontendStatus,
    pollingStatus,
    blockers,
    warnings,
    agent03Status,
    agent06Status,
    policyGatedSourcesDoNotBlockPublicEvidence
  });

  const publicApiProofs: ProductTiReleaseBoardPacket["publicApiProofs"] = PRODUCT_TI_PUBLIC_PROOF_QUERIES.map((query) => ({
    query,
    status: publicStatus,
    proofCommand: `TI_PUBLIC_PROOF_ACTORS=APT42,Turla,Akira,RandomActor,MadeUpActor,CVE-2024-3094 TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof`,
    expectedOutput: `${query} public POST proof returns HTTP 2xx, run id, live state, and honest partial/ready/metadata_review status`
  }));
  const proofCommands = uniqueStrings([
    ...rcBoard.proofCommands,
    ...publicApiProofs.map((proof) => proof.proofCommand),
    "bun run check:live-search-deploy",
    "bun run check:route-inventory",
    "bun run check:remote-drift",
    "bun run check:deploy-hygiene",
    "bun run check:docker-contexts",
    "bun test",
    "bun run check"
  ]);

  return {
    schemaVersion: "ti.product_ti.release_board.v1",
    dryRun: true,
    decision,
    rcBoardDecision: rcBoard.decision,
    responsivePublicSearch: {
      noDefaultQuery: frontendStatus !== "blocker",
      noDemoContent: frontendStatus !== "blocker",
      honestFreshness: publicStatus !== "blocker",
      updatesWithoutRefresh: pollingStatus !== "blocker",
      policyGatedSourcesDoNotBlockPublicEvidence
    },
    publicApiProofs,
    frontendProof: {
      emptyPageNoDefaultApt29: frontendStatus,
      queryPageLiveMarkers: frontendStatus,
      proofCommand: "bun run check:live-search-deploy"
    },
    pollingProof: {
      targetSeconds: 3,
      recommendedSeconds,
      status: pollingStatus,
      proofCommand: "bun test src/tests/ops.test.ts"
    },
    scraperHealth: {
      status: worstProofStatus([checkStatus, typecheckStatus, deployment("docker_image_test_enforcement")?.status ?? "blocker"]),
      proofCommands: ["bun test", "bun run check", "bun run check:deploy-hygiene", "bun run check:docker-contexts"]
    },
    agentStatus: {
      agent03: agent03Status,
      agent06: agent06Status,
      proofCommands: [
        "rg '^Status:' coordination_agent_03.md",
        "rg '^Status:' coordination_agent_06.md",
        runtime("claim_ledger_route_proof")?.proofCommand ?? "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts"
      ]
    },
    noLeakGuarantees,
    resourceHeadroom: rcBoard.resourceHeadroom,
    queuePressure: rcBoard.queuePressure,
    routeTruthAudit: rcBoard.routeTruthAudit,
    proofCommands,
    rollbackCommands: uniqueStrings([
      ...rcBoard.rollbackProcedures,
      input.deploymentDrift.rollbackTarget.command,
      "restore previous api/src/utils/ti/search.ts fallback path and redeploy hanasand_api",
      "raise public polling interval to 10 seconds and return queued-only responses while proof recovers"
    ]),
    operatorSignoff: rcBoard.operatorSignoff
  };
}

const PRODUCT_TI_PUBLIC_PROOF_QUERIES: ProductTiPublicProofQuery[] = ["APT29", "APT42", "Turla", "Akira", "random_actor", "made_up_actor", "CVE-2024-3094"];

function productProof(
  name: string,
  status: ProductTiReleaseBoardProof["status"],
  proofCommand: string,
  expectedOutput: string,
  rollbackPath: string
): ProductTiReleaseBoardProof {
  return { name, status, proofCommand, expectedOutput, rollbackPath };
}

function productTiBoardDecision(
  rcBoard: FinalRcBoardPacket,
  input: {
    publicStatus: ProductTiReleaseBoardProof["status"];
    frontendStatus: ProductTiReleaseBoardProof["status"];
    pollingStatus: ProductTiReleaseBoardProof["status"];
    blockers: Array<{ name: string }>;
    warnings: Array<{ name: string }>;
    agent03Status: ProductTiReleaseBoardPacket["agentStatus"]["agent03"];
    agent06Status: ProductTiReleaseBoardPacket["agentStatus"]["agent06"];
    policyGatedSourcesDoNotBlockPublicEvidence: boolean;
  }
): ProductTiReleaseBoardDecision {
  if (rcBoard.decision === "emergency-stop") return "emergency-stop";
  if (rcBoard.decision === "rollback") return "rollback";
  if (input.publicStatus === "blocker" || input.frontendStatus === "blocker" || input.pollingStatus === "blocker") return "no-go";
  const onlyActiveCriticalPath = input.blockers.length > 0
    && input.blockers.every((blocker) =>
      blocker.name === "runtime.clear_web_blocker_status"
      || blocker.name === "runtime.claim_ledger_route_proof"
      || blocker.name === "release_train.evidence_graph_api_holds"
    );
  if (onlyActiveCriticalPath && input.policyGatedSourcesDoNotBlockPublicEvidence) return "partial-public-ok";
  if (input.blockers.length > 0) return "no-go";
  if (input.warnings.length > 0 || input.pollingStatus === "warning" || rcBoard.decision === "canary-with-warnings") return "canary-with-warnings";
  if (rcBoard.decision === "promote-with-warnings") return "promote-with-warnings";
  if (rcBoard.decision === "canary-ready") return "canary-ready";
  if (rcBoard.decision === "canary-only") return "partial-public-ok";
  if (rcBoard.decision === "promote") return "promote";
  return "no-go";
}

function buildSupersededRealTimeSearchReleaseBoardPacket(
  input: CutoverSoakReleasePacketInput,
  rcBoard: FinalRcBoardPacket,
  productTiBoard: ProductTiReleaseBoardPacket,
  runtimeProofs: CutoverRuntimeReleaseProof[],
  deploymentProofs: CutoverDeploymentProofSlot[],
  blockers: Array<{ owner: string; name: string; proofCommand: string; rollbackPath: string }>,
  warnings: Array<{ owner: string; name: string; proofCommand: string }>
): RealTimeSearchReleaseBoardPacket {
  const deployment = (name: CutoverDeploymentProofSlotName) => deploymentProofs.find((proof) => proof.name === name);
  const runtime = (name: CutoverRuntimeReleaseProofName) => runtimeProofs.find((proof) => proof.name === name);
  const routeStatus = deployment("route_inventory")?.status ?? "blocker";
  const contractsStatus = deployment("contracts_route")?.status ?? routeStatus;
  const publicStatus = deployment("public_post_api_proof")?.status ?? "blocker";
  const frontendStatus = deployment("frontend_ti_query_proof")?.status ?? "blocker";
  const remoteStatus = deployment("remote_typecheck")?.status ?? "blocker";
  const schedulerStatus = worstProofStatus([runtime("queue_economics")?.status ?? "blocker", runtime("scheduler_runtime_sla")?.status ?? "blocker"]);
  const evidenceStatus = worstProofStatus([runtime("claim_ledger")?.status ?? "blocker", runtime("claim_ledger_route_proof")?.status ?? "blocker"]);
  const answerStatus = worstProofStatus([runtime("answer_review_gates")?.status ?? "blocker", runtime("answer_readiness_sla")?.status ?? "blocker"]);
  const graphStatus = worstProofStatus([runtime("graph_export_gates")?.status ?? "blocker", runtime("graph_export_sla")?.status ?? "blocker"]);
  const restrictedStatus = runtime("restricted_metadata_sla")?.status ?? "blocker";
  const clearWebStatus = runtime("clear_web_blocker_status")?.status === "blocker" ? "warning" : runtime("clear_web_blocker_status")?.status ?? "warning";
  const publicChannelStatus = worstProofStatus([runtime("public_channel_answer_readiness")?.status ?? "blocker", runtime("public_channel_sla")?.status ?? "blocker"]);
  const recommendedPollSeconds = DEFAULT_LIVE_SEARCH_SLO.recommendedPollIntervalMs / 1_000;
  const pollingStatus: RealTimeSearchReleaseBoardPacket["pollingSlo"]["status"] = recommendedPollSeconds <= 3 && input.trends.cursorPolling.ok
    ? "pass"
    : recommendedPollSeconds <= 10
      ? "warning"
      : "blocker";
  const scenario = (
    scenarioName: RealTimeSearchProofScenario,
    owner: string,
    status: "pass" | "warning" | "blocker",
    proofCommand: string,
    expectedOutput: string,
    rollbackPath: string
  ): RealTimeSearchReleaseBoardPacket["scenarioGates"][number] => ({
    scenario: scenarioName,
    owner,
    status,
    proofCommand,
    expectedOutput,
    rollbackPath
  });
  const scenarioGates: RealTimeSearchReleaseBoardPacket["scenarioGates"] = [
    scenario("immediate_first_response", "Agent 09", publicStatus, "bun test src/tests/api.test.ts", "first response includes stable run/cursor/status fields without waiting for full collection", "restore public wrapper fallback"),
    scenario("three_second_polling", "Agent 07/09/10", pollingStatus, "bun test src/tests/api.test.ts src/tests/ops.test.ts", "public answers expose 3-second polling and refreshAfterSeconds=3 where applicable", "raise public polling interval and return queued-only responses"),
    scenario("same_run_reuse", "Agent 02/09", schedulerStatus, "bun test src/tests/planner.test.ts src/tests/api.test.ts", "duplicate public polls reuse the same active run and reuse key", "pause new live-run creation and drain duplicates"),
    scenario("cursor_advancement", "Agent 02/06/09", worstProofStatus([schedulerStatus, evidenceStatus]), "bun test src/tests/storageCutover.test.ts src/tests/api.test.ts", "poll cursors advance when evidence deltas arrive", "hold cursor promotion and replay last-known-good deltas"),
    scenario("empty_deltas", "Agent 07/09", answerStatus, "bun test src/tests/api.test.ts src/tests/pipeline.test.ts", "empty deltas render as Searching/partial without stale demo content", "return searching-only copy until deltas are safe"),
    scenario("clear_web_capture_deltas", "Agent 03/06", clearWebStatus, "bun test src/tests/adapterFixtures.test.ts src/tests/storageCutover.test.ts", "clear-web discoveries can promote into capture deltas when Agent 03 proof is current", "keep clear-web capture promotion partial"),
    scenario("public_channel_hint_deltas", "Agent 04/07", publicChannelStatus, "bun test src/tests/telegramPublic.test.ts", "public-channel hints remain caveated deltas until corroborated", "hold public-channel hints as caveats only"),
    scenario("restricted_held_deltas", "Agent 05/06/07", restrictedStatus, "bun test src/tests/darknetMetadata.test.ts", "restricted metadata appears only as held metadata-only context", "activate restricted emergency stop"),
    scenario("graph_stix_deltas", "Agent 08", graphStatus, "bun run check:graph-review-mounted && bun test src/tests/graphViews.test.ts", "graph/STIX deltas are held unless reviewed or export-eligible", "hold graph/STIX promotion"),
    scenario("claim_ledger_holds", "Agent 06", evidenceStatus, "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts", "claim-ledger holds block ready promotion without hiding public partial results", "hold evidence cutover"),
    scenario("contradiction_downgrades", "Agent 07/08", worstProofStatus([answerStatus, graphStatus]), "bun test src/tests/pipeline.test.ts src/tests/graphViews.test.ts", "contradictions downgrade claims and graph edges instead of promoting facts", "force review_required public answer state"),
    scenario("no_result_searching", "Agent 07/09", answerStatus, "bun test src/tests/api.test.ts", "unknown/no-result states show Searching without overstating absence", "return searching-only copy"),
    scenario("provider_unavailable", "Agent 09/10", publicStatus, "bun run check:live-search-deploy", "provider unavailable states remain pollable partial/searching responses", "restore public wrapper fallback"),
    scenario("scraper_unavailable", "Agent 09/10", remoteStatus, "bun run check:remote-drift", "scraper unavailable states fail closed to bounded fallback", "docker compose up -d ti-scraper api frontend --no-build"),
    scenario("queue_pressure", "Agent 02/10", schedulerStatus, "bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts", "queue pressure defers work without duplicate active runs", "apply live-run drain plan"),
    scenario("stale_source_caveats", "Agent 01/07", worstProofStatus([runtime("source_runtime_sla")?.status ?? "blocker", answerStatus]), "bun test src/tests/sourceSeeds.test.ts src/tests/pipeline.test.ts", "stale source caveats are visible and block confident wording", "hold source activation waves"),
    scenario("low_confidence", "Agent 07", answerStatus, "bun test src/tests/pipeline.test.ts", "low-confidence claims stay partial/review-required", "hold ready answer promotion"),
    scenario("policy_block", "Agent 05/09", restrictedStatus, "bun test src/tests/darknetMetadata.test.ts src/tests/api.test.ts", "policy blocks do not leak restricted details or block clear-web/public evidence", "activate restricted emergency stop"),
    scenario("no_leak_output", "Agent 05/06/09/10", worstProofStatus([restrictedStatus, evidenceStatus, routeStatus]), "bun run check:route-inventory && bun test src/tests/api.test.ts", "public DTOs exclude raw bodies, credentials, object keys, and restricted URLs", "hold public route promotion"),
    scenario("memory_budget", "Agent 10", productTiBoard.resourceHeadroom.status, "bun run check:remote-drift", "scraper stays below 96 GB target and 160 GB normal ceiling", "reduce workers and keep fallback"),
    scenario("worker_queue_headroom", "Agent 02/10", productTiBoard.queuePressure.status, "bun test src/tests/schedulerProduction.test.ts", "worker queue headroom stays within release SLO", "drain low-priority live-search queue"),
    scenario("frontend_no_default", "Agent 09/10", frontendStatus, "bun run check:live-search-deploy", "frontend /ti has no default APT29 or stale demo content", "restore previous frontend build"),
    scenario("public_post_compatibility", "Agent 09/10", publicStatus, "TI_PUBLIC_PROOF_ACTORS=APT42,Turla,Akira,RandomActor,MadeUpActor,CVE-2024-3094 TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "canonical public POST returns run id and partial/ready/metadata_review state", "restore public API fallback"),
    scenario("remote_container_health", "Agent 10", remoteStatus, "bun run check:remote-drift", "remote containers are healthy/running and source drift is aligned", "docker compose up -d ti-scraper api frontend --no-build")
  ];
  const queryMatrix: RealTimeSearchReleaseBoardPacket["queryMatrix"] = REAL_TIME_SEARCH_PROOF_QUERIES.map((entry) => ({
    ...entry,
    status: publicStatus,
    proofCommand: entry.query === "CVE-2024-3094"
      ? "TI_PUBLIC_PROOF_ACTORS=APT42,Turla,Akira,RandomActor,MadeUpActor,CVE-2024-3094 TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof"
      : "bun test src/tests/api.test.ts",
    expectedOutput: `${entry.query} returns stable run/cursor fields, honest freshness, and pollable partial/ready/searching/metadata_review state`
  }));
  const proofCommands = uniqueStrings([
    ...productTiBoard.proofCommands,
    ...scenarioGates.map((gate) => gate.proofCommand),
    "bun run check:contract-index",
    "bun run check:route-inventory",
    "bun run check:live-search-deploy",
    "bun run check:remote-drift",
    "bun run check:deploy-hygiene",
    "bun run check:docker-contexts",
    "bun test",
    "bun run check"
  ]);
  const decision = realTimeSearchBoardDecision(productTiBoard, scenarioGates, blockers, warnings);

  return {
    schemaVersion: "ti.realtime_search.release_board.v1",
    dryRun: true,
    decision,
    productTiDecision: productTiBoard.decision,
    rcBoardDecision: rcBoard.decision,
    pollingSlo: {
      firstResponseImmediate: publicStatus !== "blocker",
      targetPollSeconds: 3,
      recommendedPollSeconds,
      sameRunReuse: schedulerStatus !== "blocker",
      cursorAdvancement: input.trends.cursorPolling.ok && evidenceStatus !== "blocker",
      emptyDeltasAllowed: answerStatus !== "blocker",
      status: pollingStatus
    },
    scenarioGates,
    queryMatrix,
    integrations: {
      contractsRoute: contractsStatus,
      intelSearchRoute: routeStatus,
      schedulerSlo: schedulerStatus,
      evidenceClaimLedger: evidenceStatus,
      answerDeltas: answerStatus,
      graphStixDeltas: graphStatus,
      publicWrapperProof: publicStatus
    },
    resourceHeadroom: productTiBoard.resourceHeadroom,
    queuePressure: productTiBoard.queuePressure,
    noLeakGuarantees: productTiBoard.noLeakGuarantees,
    proofCommands,
    rollbackCommands: uniqueStrings([
      ...productTiBoard.rollbackCommands,
      "pause real-time delta promotion and return Searching/queued-only public answers",
      "disable public graph/STIX deltas until Agent 08 review holds are green",
      "restore previous public wrapper POST compatibility path"
    ])
  };
}

const REAL_TIME_SEARCH_PROOF_QUERIES: Array<{
  query: RealTimeSearchProofQuery;
  queryClass: RealTimeSearchReleaseBoardPacket["queryMatrix"][number]["queryClass"];
}> = [
  { query: "APT29", queryClass: "actor" },
  { query: "APT42", queryClass: "actor" },
  { query: "Turla", queryClass: "actor" },
  { query: "Volt Typhoon", queryClass: "actor" },
  { query: "Scattered Spider", queryClass: "actor" },
  { query: "Akira", queryClass: "actor" },
  { query: "random_actor", queryClass: "actor" },
  { query: "made_up_actor", queryClass: "actor" },
  { query: "CVE-2024-3094", queryClass: "cve" },
  { query: "malware_tool", queryClass: "malware_tool" },
  { query: "victim_ransomware", queryClass: "victim_ransomware" },
  { query: "country", queryClass: "country" },
  { query: "sector", queryClass: "sector" }
];

function realTimeSearchBoardDecision(
  productTiBoard: ProductTiReleaseBoardPacket,
  scenarioGates: RealTimeSearchReleaseBoardPacket["scenarioGates"],
  blockers: Array<{ name: string }>,
  warnings: Array<{ name: string }>
): RealTimeSearchReleaseBoardDecision {
  if (productTiBoard.decision === "emergency-stop" || scenarioGates.some((gate) => gate.scenario === "restricted_held_deltas" && gate.status === "blocker")) return "emergency-stop";
  if (productTiBoard.decision === "rollback") return "rollback";
  const blockerScenarios = scenarioGates.filter((gate) => gate.status === "blocker");
  if (blockerScenarios.some((gate) =>
    gate.scenario === "immediate_first_response"
    || gate.scenario === "three_second_polling"
    || gate.scenario === "public_post_compatibility"
    || gate.scenario === "frontend_no_default"
    || gate.scenario === "no_leak_output"
  )) return "no-go";
  if (blockerScenarios.length > 0 || blockers.some((blocker) => ![
    "runtime.clear_web_blocker_status",
    "runtime.claim_ledger_route_proof",
    "release_train.evidence_graph_api_holds"
  ].includes(blocker.name))) return "no-go";
  if (blockers.length > 0 || productTiBoard.decision === "partial-public-ok") return "partial-public-ok";
  if (warnings.length > 0 || scenarioGates.some((gate) => gate.status === "warning") || productTiBoard.decision === "canary-with-warnings") return "canary-with-warnings";
  if (productTiBoard.decision === "promote-with-warnings") return "promote-with-warnings";
  if (productTiBoard.decision === "promote") return "promote";
  if (productTiBoard.decision === "canary-ready") return "canary-ready";
  return "no-go";
}

interface ReleaseTrainStageSpec {
  name: CutoverReleaseTrainStageName;
  deploymentProofNames: CutoverDeploymentProofSlotName[];
  runtimeProofNames: CutoverRuntimeReleaseProofName[];
  expectedOutput: string;
  rollbackPath: string;
}

const DEFAULT_RELEASE_TRAIN_STAGE_SPECS: ReleaseTrainStageSpec[] = [
  {
    name: "local_proof",
    deploymentProofNames: ["local_tests"],
    runtimeProofNames: [],
    expectedOutput: "local full tests pass before release train advances",
    rollbackPath: "stop release train locally and keep last-known-good deployment"
  },
  {
    name: "remote_proof",
    deploymentProofNames: ["remote_typecheck", "non_scraper_500gb_reserve", "stray_root_advisory"],
    runtimeProofNames: [],
    expectedOutput: "remote typecheck, 500 GB reserve, and advisory-only stray-root reporting are green",
    rollbackPath: "hold cutover until Inspur drift proof is aligned"
  },
  {
    name: "docker_and_route_inventory",
    deploymentProofNames: ["docker_image_test_enforcement", "route_inventory", "contracts_route"],
    runtimeProofNames: ["api_readiness_sla"],
    expectedOutput: "Docker image test enforcement and mounted route inventory are green",
    rollbackPath: "do not promote image; keep existing running image"
  },
  {
    name: "public_api_and_frontend_proof",
    deploymentProofNames: ["public_post_api_proof", "frontend_ti_query_proof"],
    runtimeProofNames: ["api_cutover_proof"],
    expectedOutput: "public POST API and frontend /ti?q= proofs return run ids and live state",
    rollbackPath: "restore public API wrapper fallback and redeploy api"
  },
  {
    name: "resource_and_queue_headroom",
    deploymentProofNames: ["memory_budget", "non_scraper_500gb_reserve"],
    runtimeProofNames: ["queue_economics", "scheduler_runtime_sla"],
    expectedOutput: "memory stays below 96 GB target, normal ceiling remains 160 GB, queue pressure is within soak budget, and 500 GB CTI reserve is preserved",
    rollbackPath: "reduce workers, pause source activation waves, and continue outer fallback"
  },
  {
    name: "source_and_channel_readiness",
    deploymentProofNames: [],
    runtimeProofNames: ["activation_batches", "source_runtime_sla", "public_channel_answer_readiness", "public_channel_sla"],
    expectedOutput: "safe source activation waves and public-channel readiness can support production CTI answers",
    rollbackPath: "keep source activation waves dry-run and public-channel evidence partial/read-only"
  },
  {
    name: "safety_and_retention",
    deploymentProofNames: ["restricted_emergency_stop", "stray_root_advisory"],
    runtimeProofNames: ["restricted_kill_switch", "restricted_metadata_sla", "claim_ledger", "claim_ledger_route_proof"],
    expectedOutput: "restricted emergency-stop, metadata-only boundaries, evidence ledger, and advisory-only stray-root reporting are green",
    rollbackPath: "activate restricted emergency stop, keep metadata sources disabled, and preserve evidence without unsafe deletion"
  },
  {
    name: "evidence_graph_api_holds",
    deploymentProofNames: ["route_inventory"],
    runtimeProofNames: ["clear_web_blocker_status", "answer_review_gates", "answer_readiness_sla", "graph_export_gates", "graph_export_sla", "api_readiness_sla"],
    expectedOutput: "evidence, answer, graph/export, API compatibility, and stale Agent 03 blocker state are visible before promotion",
    rollbackPath: "hold public promotion and keep outer fallback until holds clear"
  },
  {
    name: "release_decision",
    deploymentProofNames: ["local_tests", "remote_typecheck", "public_post_api_proof", "frontend_ti_query_proof", "memory_budget"],
    runtimeProofNames: ["source_runtime_sla", "scheduler_runtime_sla", "restricted_kill_switch", "answer_readiness_sla", "graph_export_sla", "api_readiness_sla"],
    expectedOutput: "release train can decide promote, promote-with-warnings, continue-soak, hold-on-blocker, rollback, or emergency-stop",
    rollbackPath: "execute last-known-good rollback path from deployment drift packet"
  }
];

function buildReleaseTrainStage(
  spec: ReleaseTrainStageSpec,
  input: CutoverSoakReleasePacketInput,
  runtimeProofs: CutoverRuntimeReleaseProof[],
  deploymentProofs: CutoverDeploymentProofSlot[]
): CutoverReleaseTrainStage {
  const referencedDeploymentProofs = deploymentProofs.filter((proof) => spec.deploymentProofNames.includes(proof.name));
  const referencedRuntimeProofs = runtimeProofs.filter((proof) => spec.runtimeProofNames.includes(proof.name));
  const proofStatuses = [
    ...referencedDeploymentProofs.map((proof) => proof.status),
    ...referencedRuntimeProofs.map((proof) => proof.status),
    ...referencedRuntimeProofs.map((proof) => proof.resourceBudgetStatus === "critical" ? "blocker" : proof.resourceBudgetStatus)
  ];
  const emergencyStop = spec.name === "safety_and_retention" && input.trends.restrictedKillSwitch.active;
  const status = emergencyStop || proofStatuses.includes("blocker")
    ? "blocker"
    : proofStatuses.includes("warning")
      ? "warning"
      : "pass";
  const proofCommands = uniqueStrings([
    ...referencedDeploymentProofs.map((proof) => proof.proofCommand),
    ...referencedRuntimeProofs.map((proof) => proof.proofCommand),
    ...(spec.name === "release_decision" ? ["bun run soak:production", "bun run plan:cutover examples/cutover-rehearsal-pass.json"] : [])
  ]);
  const decisionImpact: CutoverReleaseDecision = emergencyStop
    ? "emergency-stop"
    : status === "blocker"
      ? "hold-on-blocker"
      : status === "warning"
        ? "promote-with-warnings"
        : input.soak.summary.durationHours < DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.durationHours
          ? "continue-soak"
          : "promote";

  return {
    name: spec.name,
    owner: "Agent 10",
    status,
    decisionImpact,
    proofCommands,
    expectedOutput: spec.expectedOutput,
    rollbackPath: spec.rollbackPath,
    message: `${spec.name}=${status}; proofs=${proofCommands.length}`
  };
}

function normalizeRuntimeReleaseProofs(proofs: CutoverRuntimeReleaseProof[] | undefined): CutoverRuntimeReleaseProof[] {
  const byName = new Map((proofs ?? []).map((proof) => [proof.name, normalizeRuntimeReleaseProof(proof)]));
  return DEFAULT_RUNTIME_RELEASE_PROOFS.map((proof) => byName.get(proof.name) ?? proof);
}

function normalizeDeploymentProofSlots(proofs: CutoverDeploymentProofSlot[] | undefined): CutoverDeploymentProofSlot[] {
  const byName = new Map((proofs ?? []).map((proof) => [proof.name, proof]));
  return DEFAULT_DEPLOYMENT_PROOF_SLOTS.map((proof) => byName.get(proof.name) ?? proof);
}

function normalizeRuntimeReleaseProof(proof: CutoverRuntimeReleaseProof): CutoverRuntimeReleaseProof {
  if (proof.name !== "public_channel_sla" || !proof.publicChannelSla) return proof;
  return {
    ...proof,
    status: proof.publicChannelSla.status === "pass" ? "pass" : proof.publicChannelSla.status === "warning" ? "warning" : "blocker",
    resourceBudgetStatus: proof.publicChannelSla.status === "blocker" ? "critical" : proof.publicChannelSla.status === "warning" ? "warning" : proof.resourceBudgetStatus,
    message: `${proof.message}; enforcement=${proof.publicChannelSla.enforcement.status}; ledgerYield=${proof.publicChannelSla.metrics.ledgerBackedClaimYield.ratio}`
  };
}

const DEFAULT_RUNTIME_RELEASE_PROOFS: CutoverRuntimeReleaseProof[] = [
  runtimeProof("activation_batches", "Agent 01", "bun run check:source-apply-plan", "/v1/sources/activation-batches dry-run activation batches pass"),
  runtimeProof("source_runtime_sla", "Agent 01", "bun run check:source-apply-plan && bun test src/tests/sourceSeeds.test.ts", "source runtime SLA covers activation batches, governance drift, freshness, and safe-public coverage"),
  runtimeProof("queue_economics", "Agent 02", "bun run check:frontier-apply-plan", "queue economics, run reuse, and emergency brake proof pass"),
  runtimeProof("scheduler_runtime_sla", "Agent 02", "bun run check:frontier-apply-plan && bun test src/tests/schedulerProduction.test.ts", "scheduler runtime SLA covers lease latency, retry debt, dead letters, fairness, and cursor continuity"),
  {
    ...runtimeProof("clear_web_blocker_status", "Agent 03", "rg '^Status: clear_web_promotion' coordination_agent_03.md && bun test src/tests/adapterFixtures.test.ts", "Agent 03 stale clear-web status remains a release blocker until a fresh top-of-file proof is present"),
    status: "blocker",
    rollbackPath: "keep outer fallback and do not promote until Agent 03 publishes current clear-web proof"
  },
  runtimeProof("public_channel_answer_readiness", "Agent 04", "bun test src/tests/telegramPublic.test.ts", "public-channel evidence can support answer readiness without unsafe media/private content"),
  runtimeProof("public_channel_sla", "Agent 04", "bun test src/tests/telegramPublic.test.ts && bun test src/tests/api.test.ts", "public-channel SLA and release gate proof pass"),
  runtimeProof("restricted_kill_switch", "Agent 05", "bun run check:restricted-metadata-apply-plan", "restricted metadata kill-switch and metadata-only proof pass"),
  runtimeProof("restricted_metadata_sla", "Agent 05", "bun run check:restricted-metadata-status && bun test src/tests/darknetMetadata.test.ts", "restricted metadata SLA covers audit, approval age, kill-switch, isolation, and retention safety"),
  runtimeProof("claim_ledger", "Agent 06", "bun test src/tests/storageCutover.test.ts", "claim ledger and replay provenance proof pass"),
  runtimeProof("claim_ledger_route_proof", "Agent 06", "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts", "claim ledger route proof covers replay, persistence, and API-safe provenance"),
  runtimeProof("answer_review_gates", "Agent 07", "bun test src/tests/pipeline.test.ts", "answer quality and review gates pass"),
  runtimeProof("answer_readiness_sla", "Agent 07", "bun run check:search-quality-mounted && bun test src/tests/pipeline.test.ts", "answer readiness SLA covers caveats, source support, weak-evidence holds, and public-answer impact"),
  runtimeProof("graph_export_gates", "Agent 08", "bun run check:graph-review-mounted", "graph/STIX export gates pass"),
  runtimeProof("graph_export_sla", "Agent 08", "bun run check:graph-review-mounted && bun test src/tests/graphViews.test.ts", "graph export SLA covers accepted/reviewed edges, blocked weak edges, and STIX readiness"),
  runtimeProof("api_cutover_proof", "Agent 09", "bun test src/tests/api.test.ts && bun run check:scraper-native-search", "scraper-native API cutover proof passes"),
  runtimeProof("api_readiness_sla", "Agent 09", "bun run check:route-inventory && bun run check:scraper-native-search && bun test src/tests/api.test.ts", "API readiness SLA covers compatibility fields, route inventory, public proof semantics, and cursor-safe search")
];

const DEFAULT_DEPLOYMENT_PROOF_SLOTS: CutoverDeploymentProofSlot[] = [
  deploymentProof("local_tests", "bun test", "bun test", "ssh inspur 'cd /srv/hanasand/ti/scraper && bun test'", "full local test suite passes"),
  deploymentProof("remote_typecheck", "bun run check", "bun run check", "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check'", "local and remote typecheck pass"),
  deploymentProof("route_inventory", "bun run check:route-inventory", "bun run check:route-inventory", "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:route-inventory'", "mounted route inventory is green"),
  deploymentProof("contracts_route", "bun run check:route-inventory", "bun run check:route-inventory", "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:route-inventory'", "/v1/contracts is mounted and advertises integration surfaces"),
  deploymentProof("docker_image_test_enforcement", "bun run check:deploy-hygiene && bun run check:docker-contexts", "bun run check:deploy-hygiene && bun run check:docker-contexts", "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:deploy-hygiene && bun run check:docker-contexts'", "Docker image build enforces bun test and bun run check"),
  deploymentProof("public_post_api_proof", "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:inspur-public-proof'", "canonical public POST /api/ti/search proof returns run ids and live state"),
  deploymentProof("frontend_ti_query_proof", "bun run check:live-search-deploy", "bun run check:live-search-deploy", "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:live-search-deploy'", "frontend GET /ti?q= proof shows live-search partial markers"),
  deploymentProof("memory_budget", "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot", "bun run check:remote-drift", "ssh inspur 'docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot'", "scraper RSS stays under 96 GB target and 160 GB normal ceiling"),
  deploymentProof("non_scraper_500gb_reserve", "bun run check:remote-drift", "bun run check:remote-drift", "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:remote-drift'", "at least 500 GB remains reserved outside scraper"),
  deploymentProof("restricted_emergency_stop", "bun run check:restricted-metadata-status && bun run check:restricted-metadata-apply-plan", "bun run check:restricted-metadata-status && bun run check:restricted-metadata-apply-plan", "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:restricted-metadata-status && bun run check:restricted-metadata-apply-plan'", "restricted metadata emergency stop and metadata-only rollback proof are available"),
  deploymentProof("stray_root_advisory", "bun run check:remote-drift", "bun run check:remote-drift", "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:remote-drift'", "known stray-root files are advisory only and no deletion is performed")
];

function runtimeProof(
  name: CutoverRuntimeReleaseProofName,
  owner: string,
  proofCommand: string,
  message: string
): CutoverRuntimeReleaseProof {
  return {
    name,
    owner,
    status: "pass",
    proofCommand,
    rollbackPath: "keep outer fallback and do not promote scraper-native release",
    lastKnownGoodState: "last-known-good scraper image and outer fallback remain available",
    resourceBudgetStatus: "ok",
    message
  };
}

function deploymentProof(
  name: CutoverDeploymentProofSlotName,
  proofCommand: string,
  localCommand: string,
  remoteCommand: string,
  expectedOutput: string
): CutoverDeploymentProofSlot {
  return {
    name,
    owner: "Agent 10",
    status: "pass",
    proofCommand,
    localCommand,
    remoteCommand,
    expectedOutput,
    rollbackPath: "keep outer fallback and do not promote scraper-native release",
    message: expectedOutput
  };
}

function proofCommandForGate(name: CutoverPromotionPacket["blockerAwareGate"][number]["name"]): string {
  return name === "agent03_clear_web"
    ? "rg '^Status: clear_web_promotion' coordination_agent_03.md && bun test src/tests/adapterFixtures.test.ts"
    : "rg '^Status: api_readiness_report' coordination_agent_09.md && bun run check:scraper-native-search";
}

function buildReleaseStatusReport(
  decision: CutoverReleaseDecision,
  input: CutoverSoakReleasePacketInput,
  blockers: Array<{ owner: string; name: string }>,
  warnings: Array<{ owner: string; name: string }>,
  nextProofCommands: string[],
  rcBoard: FinalRcBoardPacket,
  productTiBoard: ProductTiReleaseBoardPacket,
  realTimeSearchBoard: RealTimeSearchReleaseBoardPacket,
  observabilityDashboard: ProductionObservabilityDashboardPacket,
  enterpriseReleaseTrain: EnterpriseReleaseTrainPacket
): string {
  return [
    `Agent 10 soak release decision: ${decision}`,
    `soakStatus: ${input.soak.status}`,
    `deploymentDriftState: ${input.deploymentDrift.state}`,
    `promotionDecision: ${input.promotionPacket.decision}`,
    `lastKnownGoodImageState: ${input.deploymentDrift.lastKnownGood.imageId}`,
    `resourceBudget: scraperTargetGb=${input.promotionPacket.resourceBudget.scraperTargetGb} scraperCeilingGb=${input.promotionPacket.resourceBudget.scraperCeilingGb} nonScraperReservedGb=${input.promotionPacket.resourceBudget.nonScraperReservedGb}`,
    `trends: publicQueries=${input.trends.publicQueries} duplicateRuns=${input.trends.runReuse.duplicateActiveRuns} cursorPolling=${input.trends.cursorPolling.ok} partialToReady=${input.trends.cursorPolling.partialToReady} sourceCoverage=${input.trends.sourceSlo.minCoveragePercent} queueP95=${input.trends.queuePressure.p95Seconds} memoryGb=${input.trends.resources.memoryRssMaxGb} cpuPercent=${input.trends.resources.cpuMaxPercent}`,
    `runtimeProofs: ${normalizeRuntimeReleaseProofs(input.runtimeProofs).map((proof) => `${proof.owner}:${proof.name}=${proof.status}/${proof.resourceBudgetStatus}`).join(", ")}`,
    `deploymentProofs: ${normalizeDeploymentProofSlots(input.deploymentProofs).map((proof) => `${proof.name}=${proof.status}`).join(", ")}`,
    `releaseTrain: ${normalizeReleaseTrainStages(input, normalizeRuntimeReleaseProofs(input.runtimeProofs), normalizeDeploymentProofSlots(input.deploymentProofs)).map((stage) => `${stage.name}=${stage.status}/${stage.decisionImpact}`).join(", ")}`,
    `rcGate: ${buildReleaseCandidateGatePacket(input, decision, buildReleaseTrainOrchestration(input, decision, normalizeReleaseTrainStages(input, normalizeRuntimeReleaseProofs(input.runtimeProofs), normalizeDeploymentProofSlots(input.deploymentProofs)), normalizeRuntimeReleaseProofs(input.runtimeProofs), normalizeDeploymentProofSlots(input.deploymentProofs)), normalizeRuntimeReleaseProofs(input.runtimeProofs), normalizeDeploymentProofSlots(input.deploymentProofs), blockers, warnings).decision}`,
    `canaryExecution: ${buildCanaryReleaseExecutionPacket(input, buildReleaseCandidateGatePacket(input, decision, buildReleaseTrainOrchestration(input, decision, normalizeReleaseTrainStages(input, normalizeRuntimeReleaseProofs(input.runtimeProofs), normalizeDeploymentProofSlots(input.deploymentProofs)), normalizeRuntimeReleaseProofs(input.runtimeProofs), normalizeDeploymentProofSlots(input.deploymentProofs)), normalizeRuntimeReleaseProofs(input.runtimeProofs), normalizeDeploymentProofSlots(input.deploymentProofs), blockers, warnings)).decision}`,
    `rcBoard: ${rcBoard.decision}`,
    `productTiBoard: ${productTiBoard.decision}`,
    `realTimeSearchBoard: ${realTimeSearchBoard.decision}`,
    `observabilityDashboard: ${observabilityDashboard.decision}`,
    `enterpriseReleaseTrain: ${enterpriseReleaseTrain.decision}`,
    `restrictedKillSwitchActive: ${input.trends.restrictedKillSwitch.active}`,
    `rollbackTriggers: ${input.trends.rollbackTriggers.length > 0 ? input.trends.rollbackTriggers.join(", ") : "none"}`,
    `blockers: ${blockers.length > 0 ? blockers.map((blocker) => `${blocker.owner}:${blocker.name}`).join(", ") : "none"}`,
    `warnings: ${warnings.length > 0 ? warnings.map((warning) => `${warning.owner}:${warning.name}`).join(", ") : "none"}`,
    `nextProofCommands: ${nextProofCommands.join(" | ")}`
  ].join("\n");
}

function evaluateCutoverResourceBudget(budget: CutoverResourceBudget): CutoverRehearsalReport["resourceBudget"] {
  const totalReservedGb = budget.scraperCeilingGb
    + budget.apiGb
    + budget.frontendGb
    + budget.postgresGb
    + budget.openSearchVectorGb
    + budget.graphGb
    + budget.objectStoreGb
    + budget.osCacheAndEmergencyGb;
  const nonScraperReservedGb = budget.hostRamGb - budget.scraperCeilingGb;
  const spareHeadroomGb = budget.hostRamGb - totalReservedGb;
  const checks = [
    check("host_1tb", budget.hostRamGb >= 1_000, "host budget is at least 1 TB class"),
    check("scraper_target_96gb", budget.scraperTargetGb <= 96, "scraper target stays at or below 96 GB"),
    check("scraper_ceiling_160gb", budget.scraperCeilingGb <= 160, "scraper ceiling stays at or below 160 GB"),
    check("non_scraper_500gb", nonScraperReservedGb >= 500, "at least 500 GB remains outside the scraper budget"),
    check("api_frontend_budget", budget.apiGb >= 16 && budget.frontendGb >= 4, "API and frontend have explicit RAM reservations"),
    check("postgres_budget", budget.postgresGb >= 64, "Postgres has an explicit production RAM reservation"),
    check("search_vector_budget", budget.openSearchVectorGb >= 128, "OpenSearch/vector has an explicit production RAM reservation"),
    check("graph_budget", budget.graphGb >= 64, "graph store has an explicit production RAM reservation"),
    check("object_store_budget", budget.objectStoreGb >= 128, "object store/page cache has an explicit RAM reservation"),
    check("emergency_headroom", budget.osCacheAndEmergencyGb >= 160 && spareHeadroomGb >= 0, "OS cache and emergency headroom remain available")
  ];

  return {
    ok: checks.every((item) => item.ok),
    totalReservedGb,
    spareHeadroomGb,
    nonScraperReservedGb,
    checks
  };
}

function pushCutoverProofBlocker(
  blockers: CutoverBlocker[],
  ok: boolean,
  name: string,
  query: string,
  input: CutoverRehearsalInput
): void {
  if (ok) return;
  blockers.push({
    name,
    severity: "rollback",
    owner: "Agent 10",
    workstream: "live_public_proof",
    proofCommand: `curl -fsS 'https://hanasand.com/ti?q=${encodeURIComponent(query)}' && curl -fsS -H 'content-type: application/json' --data '{"query":"${query.replace(/'/g, "")}"}' 'https://api.hanasand.com/api/ti/search'`,
    lastKnownGoodState: lastKnownGoodFallbackState(input),
    rollbackPath: fallbackRollbackPath(input)
  });
}

function buildCutoverStatusReport(
  decision: CutoverRehearsalReport["decision"],
  blockers: CutoverBlocker[],
  resourceBudget: CutoverRehearsalReport["resourceBudget"],
  input: CutoverRehearsalInput
): string {
  return [
    `Agent 10 cutover rehearsal decision: ${decision}`,
    `publicProofQueries: APT29, Scattered Spider, Volt Typhoon, Turla, Akira, ${input.randomActorQuery}`,
    `deploymentDriftState: ${input.deploymentDrift.state}`,
    `resourceBudget: totalReservedGb=${resourceBudget.totalReservedGb} spareHeadroomGb=${resourceBudget.spareHeadroomGb} nonScraperReservedGb=${resourceBudget.nonScraperReservedGb}`,
    `agent09ApprovedFallbackRemoval: ${input.agent09ApprovedFallbackRemoval}`,
    `mainAgentDeployGateApproved: ${input.mainAgentDeployGateApproved}`,
    `rollbackPath: ${decision === "pass" ? "none" : fallbackRollbackPath(input)}`,
    `blockers: ${blockers.length > 0 ? blockers.map((blocker) => `${blocker.owner}:${blocker.name}`).join(", ") : "none"}`
  ].join("\n");
}

function buildApplyPlanDryRunOutput(
  decision: CutoverApplyPlanPacket["decision"],
  counts: CutoverApplyPlanPacket["classificationCounts"],
  blockers: CutoverBlocker[],
  resourceBudget: CutoverRehearsalReport["resourceBudget"],
  input: CutoverApplyPlanInput
): string {
  const unapplied = input.actions.filter((action) => !action.applied && action.classification !== "rollback-only");
  return [
    `Agent 10 cutover apply plan: decision=${decision}`,
    `context=${input.leaderThreadContext}`,
    `actions automation_safe=${counts["automation-safe"]} human_approval_required=${counts["human-approval-required"]} blocked=${counts.blocked} rollback_only=${counts["rollback-only"]}`,
    `unapplied_actions=${unapplied.length > 0 ? unapplied.map((action) => `${action.owner}:${action.id}`).join(",") : "none"}`,
    `rehearsal_decision=${input.rehearsal.decision}`,
    `deployment_drift=${input.deploymentDrift.state}`,
    `agent09_api_ready=${input.agent09ApiReady}`,
    `resources scraper_target_gb=${input.resourceBudget.scraperTargetGb} scraper_ceiling_gb=${input.resourceBudget.scraperCeilingGb} non_scraper_reserved_gb=${resourceBudget.nonScraperReservedGb} spare_headroom_gb=${resourceBudget.spareHeadroomGb}`,
    `blockers=${blockers.length > 0 ? blockers.map((blocker) => `${blocker.owner}:${blocker.name}`).join(",") : "none"}`
  ].join("\n");
}

function buildPromotionLiveProof(input: CutoverPromotionPacketInput): CutoverPromotionPacket["liveProof"] {
  const queryNames = uniqueStrings([
    ...input.rehearsal.requiredPublicProofQueries,
    ...(input.livePublicProofs ?? []).map((proof) => proof.query),
    ...(input.apiSearchProofs ?? []).map((proof) => proof.query)
  ]);

  return queryNames.map((query) => {
    const publicProof = input.livePublicProofs?.find((proof) => proof.query === query);
    const apiProof = input.apiSearchProofs?.find((proof) => proof.query === query);
    const publicBody = publicProof?.body.toLowerCase() ?? "";
    const apiBody = typeof apiProof?.body === "string" ? apiProof.body.toLowerCase() : "";
    const apiJson = isRecord(apiProof?.json) ? apiProof.json : undefined;
    return {
      query,
      publicUrl: publicProof?.url,
      publicStatus: publicProof?.status,
      apiUrl: apiProof?.url,
      apiStatus: apiProof?.status,
      ok: (publicProof?.status ?? 0) >= 200
        && (publicProof?.status ?? 0) < 300
        && publicBody.includes("live_search")
        && publicBody.includes("partial")
        && (publicBody.includes("queued") || publicBody.includes("run"))
        && (apiProof?.status ?? 0) >= 200
        && (apiProof?.status ?? 0) < 300
        && (hasRunId(apiJson) || apiBody.includes("runid") || apiBody.includes("run_id"))
        && (hasPartialResult(apiJson) || apiBody.includes("partial"))
    };
  });
}

function fallbackRollbackPath(input: {
  fallbackRollbackPath?: string;
  rehearsal?: Pick<CutoverRehearsalReport, "rollbackPath">;
}): string {
  return input.fallbackRollbackPath ?? input.rehearsal?.rollbackPath ?? "restore outer fallback and keep scraper-native cutover paused";
}

function lastKnownGoodFallbackState(input: {
  lastKnownGoodFallbackState?: string;
  rehearsal?: Pick<CutoverRehearsalReport, "lastKnownGoodState">;
}): string {
  return input.lastKnownGoodFallbackState ?? input.rehearsal?.lastKnownGoodState ?? "outer fallback enabled and scraper-native cutover paused";
}

function buildOwnerAssignments(actions: CutoverApplyPlanAction[], blockers: CutoverBlocker[]): Record<string, string[]> {
  const assignments: Record<string, string[]> = {};
  for (const action of actions) {
    assignments[action.owner] = assignments[action.owner] ?? [];
    assignments[action.owner]?.push(action.id);
  }
  for (const blocker of blockers) {
    assignments[blocker.owner] = assignments[blocker.owner] ?? [];
    assignments[blocker.owner]?.push(blocker.name);
  }
  return Object.fromEntries(Object.entries(assignments).map(([owner, items]) => [owner, uniqueStrings(items)]));
}

function normalizeMountedRouteProofs(proofs: CutoverMountedRouteProof[]): CutoverMountedRouteProof[] {
  const byName = new Map(proofs.map((proof) => [proof.name, proof]));
  const fallbackStatus: CutoverMountedRouteProofStatus = proofs.length > 0 ? "present" : "missing";
  return CUTOVER_MOUNTED_ROUTE_PROOF_REQUIREMENTS.map((required) => {
    const provided = byName.get(required.name);
    const status = provided?.status ?? (isFailClosedMountedRouteProof(required.name) ? "missing" : fallbackStatus);
    return {
      ...required,
      status,
      localCommand: provided?.localCommand ?? required.localCommand,
      inspurCommand: provided?.inspurCommand ?? required.inspurCommand,
      expectedOutput: provided?.expectedOutput ?? required.expectedOutput,
      endpoint: provided?.endpoint ?? required.endpoint,
      rollbackPath: provided?.rollbackPath ?? `keep outer fallback until ${required.name} mounted proof is green`
    };
  });
}

function isFailClosedMountedRouteProof(name: string): boolean {
  return ["clear_web", "agent03_status", "route_inventory", "scraper_native_search", "agent09_readiness_report"].includes(name);
}

function buildMountedRouteProofBlockers(proofs: CutoverMountedRouteProof[]): CutoverBlocker[] {
  return proofs
    .filter((proof) => proof.status !== "passed" && proof.status !== "present")
    .map((proof) => ({
      name: `mounted_route.${slugQuery(proof.name)}.${proof.status}`,
      severity: proof.status === "failed" ? "rollback" as const : "hold" as const,
      owner: proof.owner,
      workstream: proof.name,
      proofCommand: proof.localCommand,
      lastKnownGoodState: proof.expectedOutput,
      rollbackPath: proof.rollbackPath
    }));
}

function buildBlockerAwareGate(proofs: CutoverMountedRouteProof[]): CutoverPromotionPacket["blockerAwareGate"] {
  return [
    gateStatus("agent03_clear_web", "Agent 03", proofs, ["clear_web", "agent03_status"]),
    gateStatus("agent09_compatibility", "Agent 09", proofs, ["route_inventory", "scraper_native_search", "agent09_readiness_report"])
  ];
}

function gateStatus(
  name: CutoverPromotionPacket["blockerAwareGate"][number]["name"],
  owner: string,
  proofs: CutoverMountedRouteProof[],
  proofNames: string[]
): CutoverPromotionPacket["blockerAwareGate"][number] {
  const statuses = proofNames.map((proofName) => proofs.find((proof) => proof.name === proofName)?.status ?? "missing");
  const classification: CutoverPromotionPacket["blockerAwareGate"][number]["classification"] = statuses.some((status) => status === "missing" || status === "failed")
    ? "blocker"
    : statuses.some((status) => status === "stale" || status === "documented_only")
      ? "warning"
      : "pass";
  return {
    name,
    owner,
    classification,
    status: proofNames.map((proofName, index) => `${proofName}:${statuses[index]}`).join(","),
    proofNames
  };
}

function buildPromotionLiveProofBlockers(
  proofs: CutoverPromotionPacket["liveProof"],
  input: CutoverPromotionPacketInput
): CutoverBlocker[] {
  return proofs
    .filter((proof) => !proof.ok)
    .map((proof) => ({
      name: `live_proof.${slugQuery(proof.query)}.mismatch`,
      severity: "rollback" as const,
      owner: "Agent 10",
      workstream: "live_public_proof",
      proofCommand: `bun run check:inspur-public-proof`,
      lastKnownGoodState: lastKnownGoodFallbackState(input),
      rollbackPath: fallbackRollbackPath(input)
    }));
}

function buildCutoverLeaderMarkdown(packet: Omit<CutoverPromotionPacket, "leaderMarkdown">): string {
  const blockers = packet.blockers.length > 0
    ? packet.blockers.map((blocker) => `- ${blocker.severity}: ${blocker.owner} ${blocker.name} | proof: \`${blocker.proofCommand}\` | rollback: ${blocker.rollbackPath}`)
    : ["- none"];
  const proofCommands = packet.proofCommands.length > 0
    ? packet.proofCommands.map((command) => `- \`${command}\``)
    : ["- none"];
  return [
    `## Agent 10 Cutover Promotion Packet`,
    `decision: ${packet.decision}`,
    `context: ${packet.context}`,
    `deployment_drift: ${packet.deploymentDrift.state}`,
    `resources: scraper_target_gb=${packet.resourceBudget.scraperTargetGb} scraper_ceiling_gb=${packet.resourceBudget.scraperCeilingGb} non_scraper_reserved_gb=${packet.resourceBudget.nonScraperReservedGb} spare_headroom_gb=${packet.resourceBudget.spareHeadroomGb}`,
    `actions: automation_safe=${packet.applyPlan.classificationCounts["automation-safe"]} human_approval_required=${packet.applyPlan.classificationCounts["human-approval-required"]} blocked=${packet.applyPlan.classificationCounts.blocked} rollback_only=${packet.applyPlan.classificationCounts["rollback-only"]}`,
    `live_proof: ${packet.liveProof.every((proof) => proof.ok) ? "green" : "red"}`,
    `mounted_route_proof: ${packet.mountedRouteProofs.every((proof) => proof.status === "passed" || proof.status === "present") ? "green" : "red"}`,
    `blocker_aware_gate: ${packet.blockerAwareGate.map((gate) => `${gate.name}=${gate.classification}`).join(" ")}`,
    `rollback_paths: ${packet.rollbackPaths.length > 0 ? packet.rollbackPaths.join(" | ") : "none"}`,
    `blockers:`,
    ...blockers,
    `proof_commands:`,
    ...proofCommands
  ].join("\n");
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0))).sort();
}

function uniqueBlockers(blockers: CutoverBlocker[]): CutoverBlocker[] {
  const byKey = new Map<string, CutoverBlocker>();
  for (const blocker of blockers) {
    const key = `${blocker.owner}:${blocker.name}:${blocker.proofCommand}`;
    const existing = byKey.get(key);
    if (!existing || existing.severity === "hold" && blocker.severity === "rollback") {
      byKey.set(key, blocker);
    }
  }
  return Array.from(byKey.values());
}

function safeRate(count: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return round((count / denominator) * 100);
}

function slugQuery(query: string): string {
  return query.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "query";
}

function readRecord(record: Record<string, unknown> | undefined, key: string): Record<string, unknown> | undefined {
  const value = record?.[key];
  return isRecord(value) ? value : undefined;
}

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
}

function hasArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
