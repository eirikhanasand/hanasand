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
    publicQueryCount: number;
    initialLatencyP95Ms: number;
    partialLatencyP95Ms: number;
    errorRatePercent: number;
    duplicateActiveRuns: number;
    sourceCoveragePercent: number;
    queueAgeP95Seconds: number;
    workerSaturationPercent: number;
    cpuMaxPercent: number;
    memoryRssMaxGb: number;
    policyBlocks: number;
    policyBlockRatePercent: number;
    unsafePolicyRetries: number;
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

export type EnterpriseObservabilityLaneName =
  | "queue_health"
  | "source_health"
  | "evidence_yield"
  | "extraction_quality"
  | "graph_review_holds"
  | "api_latency"
  | "public_polling_latency"
  | "memory_disk_usage"
  | "worker_saturation"
  | "error_budget"
  | "freshness_slo"
  | "deployment_drift"
  | "release_train_state";

export interface EnterpriseObservabilityLane {
  name: EnterpriseObservabilityLaneName;
  owner: string;
  status: "pass" | "warning" | "blocker";
  metricValue: number;
  warnAt: number;
  criticalAt: number;
  unit: ProductionObservabilityMetric["unit"];
  alertName:
    | "source_outage_wave"
    | "parser_failure_spike"
    | "queue_pressure"
    | "public_wrapper_regression"
    | "evidence_store_degradation"
    | "graph_export_hold"
    | "restricted_metadata_emergency_stop"
    | "api_client_compatibility_drift"
    | "memory_or_disk_pressure"
    | "freshness_slo_breach"
    | "release_train_hold";
  failureClassification: string;
  releaseImpact: "none" | "watch" | "hold" | "rollback" | "emergency-stop";
  proofCommand: string;
  rollbackRecommendation: string;
  noLeakExample: string;
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
  enterpriseViews: {
    lanes: EnterpriseObservabilityLane[];
    integrations: {
      agent01SourceGovernance: "pass" | "warning" | "blocker";
      agent02Scheduler: "pass" | "warning" | "blocker";
      agent03AdapterObservatory: "pass" | "warning" | "blocker";
      agent04CoverageRadar: "pass" | "warning" | "blocker";
      agent05RestrictedPlaybooks: "pass" | "warning" | "blocker";
      agent06EvidenceLedger: "pass" | "warning" | "blocker";
      agent07QualityGates: "pass" | "warning" | "blocker";
      agent08GraphBackend: "pass" | "warning" | "blocker";
      agent09ApiContracts: "pass" | "warning" | "blocker";
      agent10ReleaseTrain: "pass" | "warning" | "blocker";
    };
    resourceBudget: {
      scraperTargetGb: 96;
      scraperCeilingGb: 160;
      preserveCtiReserveGb: 500;
      browserPoolDisabled: true;
      boundedCaches: true;
      diskFirstEvidence: true;
      assumesGpu: false;
    };
  };
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

export type CapacitySimulationScenarioName =
  | "baseline"
  | "high_activity_actor_burst"
  | "ransomware_victim_burst"
  | "dark_metadata_60k_refresh"
  | "source_atlas_10k_import"
  | "index_replay_backfill"
  | "source_outage_wave"
  | "parser_failure_spike"
  | "restricted_review_spike"
  | "graph_export_backlog";

export interface CapacitySimulationScenario {
  name: CapacitySimulationScenarioName;
  releaseDecision: EnterpriseReleaseDecision;
  status: "pass" | "warning" | "blocker";
  workload: {
    publicSourceCollections: number;
    publicChannelWindows: number;
    restrictedMetadataReviews: number;
    graphExports: number;
    evidenceReplays: number;
    actorSweeps: number;
    sourceActivationWaves: number;
    apiPolls: number;
  };
  forecast: {
    memoryRssMaxGb: number;
    diskGrowthGb: number;
    queueAgeP95Seconds: number;
    workerSaturationPercent: number;
    sourceRateLimitPercent: number;
    apiLatencyP95Ms: number;
    evidenceGrowthGb: number;
    graphGrowthGb: number;
    operatorReviewHours: number;
    ctiReserveAfterGb: number;
  };
  bottlenecks: string[];
  rollbackRecommendation: string;
  noLeakExample: string;
}

export interface CapacityCostSimulationPacket {
  schemaVersion: "ti.capacity_cost_simulation.v1";
  dryRun: true;
  windowDays: 30;
  generatedAt: string;
  resourceBudget: {
    scraperTargetGb: 96;
    scraperCeilingGb: 160;
    preserveCtiReserveGb: 500;
    browserPoolDisabled: true;
    boundedCaches: true;
    diskFirstEvidence: true;
    assumesGpu: false;
  };
  scenarios: CapacitySimulationScenario[];
  hostBudget: {
    hostRamGb: 1_024;
    scraperTargetGb: 96;
    scraperCeilingGb: 160;
    ctiReserveGb: 500;
    osCacheAndEmergencyGb: number;
    allocatableScraperBurstGb: number;
    approvalRequiredAboveGb: 160;
  };
  workerPartitions: Array<{
    name: "interactive_live_search" | "public_collection" | "public_channel" | "restricted_metadata" | "dark_web_metadata_index" | "source_atlas_import" | "evidence_index_replay" | "graph_export" | "retention_backup";
    owner: string;
    workerCap: number;
    memoryReservationGb: number;
    memoryCeilingGb: number;
    queuePartition: string;
    throttle: string;
  }>;
  sideToolForecasts: Array<{
    name: "dark_web_metadata_index" | "source_atlas_discovery_import";
    owner: string;
    recordTarget: number;
    monthlyRecords: number;
    memoryReservationGb: number;
    memoryCeilingGb: number;
    diskGrowthGb: number;
    apiPolls: number;
    queueJobs: number;
    retryDeadLetterBudget: number;
    releaseGate: "promote" | "hold" | "rollback";
    starvationGuard: string;
  }>;
  indexReplayBudget: {
    replayWindowDays: 30;
    maxReplayBatchesPerDay: number;
    maxReplayMemoryGb: number;
    diskGrowthGb: number;
    queuePartition: "evidence_index_replay";
    rollbackTrigger: string;
    noLeakProof: string;
  };
  monthlyCostProxy: {
    currency: "capacity_units";
    totalUnits: number;
    computeUnits: number;
    storageUnits: number;
    operatorReviewUnits: number;
    highestCostScenario: CapacitySimulationScenarioName;
    reductionLevers: string[];
  };
  aggregate: {
    worstDecision: EnterpriseReleaseDecision;
    memoryPeakGb: number;
    diskGrowthPeakGb: number;
    queueAgePeakSeconds: number;
    operatorReviewPeakHours: number;
    ctiReserveMinimumGb: number;
    releaseReadyScenarioCount: number;
    rollbackScenarioCount: number;
    emergencyStopScenarioCount: number;
  };
  proofCommands: string[];
  operatorRunbook: string[];
}

export type ProductionIncidentRunbookName =
  | "public_proof_failure"
  | "queue_saturation"
  | "source_outage_wave"
  | "parser_failure_spike"
  | "evidence_store_degradation"
  | "restricted_metadata_emergency_stop"
  | "api_wrapper_regression"
  | "graph_export_corruption"
  | "canary_rollback"
  | "container_rollback"
  | "multi_service_health_degradation";

export interface ProductionIncidentRunbook {
  name: ProductionIncidentRunbookName;
  trigger: string;
  detectionFields: string[];
  operatorAction: string;
  expectedRouteApiProof: Array<{
    surface: string;
    proofCommand: string;
    expectedOutput: string;
  }>;
  rollback: string;
  noLeakGuarantees: string[];
  owningSubsystem: string;
  escalationPath: string[];
  releaseDecisionImpact: EnterpriseReleaseDecision;
}

export interface ProductionIncidentRunbookPacket {
  schemaVersion: "ti.production_incident_runbooks.v1";
  dryRun: true;
  generatedAt: string;
  resourceBudget: {
    scraperTargetGb: 96;
    scraperCeilingGb: 160;
    preserveCtiReserveGb: 500;
    browserPoolDisabled: true;
    boundedCaches: true;
    diskFirstEvidence: true;
    assumesGpu: false;
  };
  runbooks: ProductionIncidentRunbook[];
  integrations: {
    agent01SourceGovernance: "wired";
    agent02SchedulerFairness: "wired";
    agent03Adapters: "wired";
    agent04PublicCoverage: "wired";
    agent05RestrictedPlaybooks: "wired";
    agent06EvidenceDr: "wired";
    agent07QualityWorkbench: "wired";
    agent08GraphGovernance: "wired";
    agent09ApiCompatibility: "wired";
    agent10ReleaseOps: "wired";
  };
  releaseDecisionCounts: Record<EnterpriseReleaseDecision, number>;
  proofCommands: string[];
  operatorRunbook: string[];
}

export type ProductionIncidentSimulationScenarioName =
  | "queue_saturation"
  | "source_outage_wave"
  | "parser_failure_spike"
  | "evidence_object_degradation"
  | "graph_export_corruption"
  | "api_gateway_misrouting"
  | "public_proof_failure"
  | "canary_rollback"
  | "restricted_emergency_stop"
  | "memory_disk_pressure";

export type ProductionIncidentReleaseGateOutcome = "promote" | "hold" | "rollback-only" | "needs-human-approval";

export interface ProductionIncidentTimelineEvent {
  minute: number;
  phase: "detect" | "triage" | "mitigate" | "rollback" | "verify" | "postmortem";
  event: string;
  owner: string;
  evidence: string;
}

export interface ProductionIncidentPostmortemField {
  field: "summary" | "customer_impact" | "root_cause" | "detection_gap" | "rollback_result" | "follow_up";
  prompt: string;
  requiredEvidence: string[];
}

export interface ProductionIncidentSimulation {
  name: ProductionIncidentSimulationScenarioName;
  status: "pass" | "warning" | "blocker";
  releaseGateOutcome: ProductionIncidentReleaseGateOutcome;
  detectionSignals: string[];
  timeline: ProductionIncidentTimelineEvent[];
  blastRadius: {
    publicTiState: "searching" | "partial" | "metadata_review" | "degraded" | "blocked";
    affectedServices: string[];
    affectedAgents: string[];
    dataIntegrity: "preserved" | "at_risk" | "restore_required";
  };
  userVisibleDegradation: string;
  safetyPosture: {
    metadataOnly: true;
    noRawLeakMaterial: true;
    noCredentials: true;
    noUnsafeUrls: true;
    noActorInteraction: true;
    browserWorkersDisabled: true;
  };
  ownerAgents: string[];
  rollbackAction: string;
  proofCommand: string;
  postmortemFields: ProductionIncidentPostmortemField[];
  noLeakProof: string;
}

export interface ProductionIncidentSimulationPostmortemPacket {
  schemaVersion: "ti.production_incident_simulation_postmortem.v1";
  dryRun: true;
  generatedAt: string;
  resourcePolicy: {
    scraperTargetGb: 96;
    scraperCeilingGb: 160;
    preserveCtiReserveGb: 500;
    browserPoolDisabled: true;
    boundedCaches: true;
    diskFirstEvidence: true;
    assumesGpu: false;
  };
  simulations: ProductionIncidentSimulation[];
  releaseGateCounts: Record<ProductionIncidentReleaseGateOutcome, number>;
  ownerMatrix: Array<{
    owner: string;
    scenarios: ProductionIncidentSimulationScenarioName[];
    proofCommands: string[];
  }>;
  proofCommands: string[];
  operatorRunbook: string[];
}

export type DependencyDrillServiceName =
  | "scraper"
  | "public_api_wrapper"
  | "frontend_ti"
  | "postgres_source_registry"
  | "evidence_object_store"
  | "opensearch_vector_handoff"
  | "graph_backend"
  | "queue_backend"
  | "canary_collection"
  | "restricted_metadata_controls";

export type DependencyDrillScenarioName =
  | "queue_saturation"
  | "source_outage_wave"
  | "parser_failure_spike"
  | "evidence_object_degradation"
  | "graph_export_corruption"
  | "api_gateway_misrouting"
  | "public_proof_failure"
  | "canary_rollback"
  | "container_rollback";

export interface DependencyDrillRouteProof {
  surface: string;
  proofCommand: string;
  expectedOutput: string;
}

export interface DependencyHealthService {
  name: DependencyDrillServiceName;
  status: "pass" | "warning" | "blocker";
  healthCheck: string;
  failureSymptoms: string[];
  operatorActions: string[];
  rollbackAction: string;
  routeProof: DependencyDrillRouteProof[];
  userVisibleDegradation: string;
  noLeakGuarantee: string;
}

export interface DependencyRollbackDrillScenario {
  name: DependencyDrillScenarioName;
  trigger: string;
  affectedServices: DependencyDrillServiceName[];
  firstOperatorAction: string;
  rollbackOrder: DependencyDrillServiceName[];
  routeProof: DependencyDrillRouteProof[];
  expectedUserState: "searching" | "partial" | "metadata_review" | "degraded" | "blocked";
  releaseDecisionImpact: EnterpriseReleaseDecision;
  noLeakGuarantees: string[];
}

export interface MultiServiceDependencyRollbackDrillPacket {
  schemaVersion: "ti.multi_service_dependency_rollback_drill.v1";
  dryRun: true;
  generatedAt: string;
  resourceBudget: {
    scraperTargetGb: 96;
    scraperCeilingGb: 160;
    preserveCtiReserveGb: 500;
    browserPoolDisabled: true;
    boundedCaches: true;
    diskFirstEvidence: true;
    assumesGpu: false;
  };
  services: DependencyHealthService[];
  scenarios: DependencyRollbackDrillScenario[];
  rollbackOrder: DependencyDrillServiceName[];
  integrations: {
    agent01Governance: "wired";
    agent02Scheduler: "wired";
    agent03Adapters: "wired";
    agent04PublicCorrelation: "wired";
    agent05RestrictedMetadata: "wired";
    agent06EvidenceChain: "wired";
    agent07Quality: "wired";
    agent08Graph: "wired";
    agent09ApiCompatibility: "wired";
    agent10Operations: "wired";
  };
  proofCommands: string[];
  operatorRunbook: string[];
}

export type ReleaseArtifactBundleDecision = "promote" | "warning" | "hold" | "rollback-only" | "needs-human-approval";

export type ReleaseArtifactGateName =
  | "route_inventory"
  | "contract_index"
  | "api_regression"
  | "sdk_fixtures"
  | "deploy_hygiene"
  | "canary_readiness_soak"
  | "public_proof"
  | "scheduler_status"
  | "restricted_metadata_audit"
  | "evidence_chain"
  | "graph_stix_readiness"
  | "source_portfolio_readiness"
  | "dependency_rollback_drill"
  | "resource_budget"
  | "public_ti_expectations";

export type ReleaseArtifactSoakDimensionName =
  | "queue_health"
  | "freshness_slo"
  | "source_outage_wave"
  | "parser_failure_spike"
  | "evidence_object_durability"
  | "graph_drift_holds"
  | "api_latency_polling"
  | "memory_disk_budget"
  | "worker_saturation"
  | "incident_rollback_readiness";

export interface ReleaseArtifactGate {
  name: ReleaseArtifactGateName;
  owner: string;
  status: "pass" | "warning" | "blocker";
  proofCommand: string;
  evidenceSource: string;
  blocker?: string;
  noLeakProof: string;
}

export interface ReleaseArtifactSoakDimension {
  name: ReleaseArtifactSoakDimensionName;
  status: "pass" | "warning" | "blocker";
  metric: string;
  proofCommand: string;
  releaseImpact: ReleaseArtifactBundleDecision;
  owner: string;
}

export interface ReleaseArtifactPublicExpectation {
  name: "no_default_actor" | "unknown_searching_only" | "partial_updates_seconds" | "no_stale_demo_cache_prose";
  status: "pass" | "warning" | "blocker";
  proofCommand: string;
  expectedBehavior: string;
}

export interface EnterpriseSoakReleaseArtifactBundlePacket {
  schemaVersion: "ti.enterprise_soak_release_artifact_bundle.v1";
  dryRun: true;
  generatedAt: string;
  decision: ReleaseArtifactBundleDecision;
  resourcePolicy: {
    scraperTargetGb: 96;
    scraperCeilingGb: 160;
    preserveCtiReserveGb: 500;
    browserPoolDisabled: true;
    boundedCaches: true;
    diskFirstEvidence: true;
    assumesGpu: false;
  };
  gates: ReleaseArtifactGate[];
  soakEvidence: ReleaseArtifactSoakDimension[];
  publicTiExpectations: ReleaseArtifactPublicExpectation[];
  ownerBlockers: Array<{
    owner: string;
    gate: ReleaseArtifactGateName | ReleaseArtifactSoakDimensionName;
    blocker: string;
    proofCommand: string;
  }>;
  artifactManifest: Array<{
    artifact: string;
    sourcePacket: string;
    proofCommand: string;
    noLeakBoundary: string;
  }>;
  proofCommands: string[];
  operatorRunbook: string[];
}

export type ResourceArbitrationLaneName =
  | "collection_workers"
  | "public_channel_workers"
  | "dynamic_browser_disabled_pool"
  | "evidence_replay"
  | "graph_search_migration"
  | "queue_backend"
  | "api_live_search_load";

export type ResourceArbitrationGateName =
  | "over_capacity"
  | "memory_pressure"
  | "disk_pressure"
  | "queue_saturation"
  | "source_outage_wave"
  | "parser_failure_spike"
  | "public_proof_failure"
  | "restricted_emergency_stop"
  | "remote_deploy_drift";

export interface ResourceArbitrationLane {
  name: ResourceArbitrationLaneName;
  owner: string;
  status: "pass" | "warning" | "blocker";
  memoryReservationGb: number;
  memoryCeilingGb: number;
  diskReservationGb: number;
  concurrencyLimit: number;
  throttles: string[];
  proofCommand: string;
  handoff: string;
}

export interface ResourceArbitrationGate {
  name: ResourceArbitrationGateName;
  status: "pass" | "warning" | "blocker";
  releaseDecision: ReleaseArtifactBundleDecision;
  owner: string;
  signal: string;
  threshold: string;
  proofCommand: string;
  rollbackAction: string;
}

export interface MultiServiceResourceArbitrationPacket {
  schemaVersion: "ti.multi_service_resource_arbitration.v1";
  dryRun: true;
  generatedAt: string;
  hostPolicy: {
    hostMemoryGb: 1024;
    scraperTargetGb: 96;
    scraperCeilingGb: 160;
    preserveCtiReserveGb: 500;
    browserPoolDisabled: true;
    boundedCaches: true;
    diskFirstEvidence: true;
    assumesGpu: false;
  };
  summary: {
    status: "pass" | "warning" | "blocker";
    scraperReservedGb: number;
    scraperCeilingGb: 160;
    nonScraperReservedGb: number;
    ctiReserveAfterForecastGb: number;
    peakMemoryForecastGb: number;
    peakDiskGrowthGb: number;
  };
  lanes: ResourceArbitrationLane[];
  gates: ResourceArbitrationGate[];
  ownerHandoffs: Array<{
    owner: string;
    responsibility: string;
    lanes: ResourceArbitrationLaneName[];
    gates: ResourceArbitrationGateName[];
  }>;
  proofCommands: string[];
  operatorRunbook: string[];
  noLeakProof: string;
}

export type ProductionSoakDecision = "promote" | "hold" | "rollback" | "needs-human-approval";

export type ProductionSoakSignalName =
  | "scheduler_queue_leases_dead_letters"
  | "source_activation_health"
  | "adapter_parser_failure_spikes"
  | "evidence_object_index_replay_integrity"
  | "restricted_emergency_stop"
  | "quality_release_gates"
  | "graph_stix_holds"
  | "api_contract_drift"
  | "public_wrapper_proofs"
  | "memory_disk_pressure"
  | "deploy_hygiene";

export type ProductionSoakScenarioName =
  | "dark_metadata_60k_refresh"
  | "source_atlas_10k_import"
  | "source_outage_wave"
  | "parser_failure_storm"
  | "queue_runaway"
  | "object_store_failure"
  | "api_deploy_mismatch"
  | "restricted_safety_event"
  | "stale_actor_answer_regression"
  | "unknown_actor_false_ready_regression"
  | "graph_export_hold";

export interface ProductionSoakDecisionSignal {
  name: ProductionSoakSignalName;
  owner: string;
  status: "pass" | "warning" | "blocker" | "stale";
  decisionImpact: ProductionSoakDecision;
  evidence: string[];
  proofCommand: string;
  rollbackStep: string;
  staleAfterMinutes: number;
}

export interface ProductionSoakScenarioFixture {
  name: ProductionSoakScenarioName;
  expectedDecision: ProductionSoakDecision;
  trigger: string;
  proofCommand: string;
  rollbackStep: string;
  ownerHandoff: string;
  noLeakBoundary: string;
}

export interface ProductionSoakDecisionBoardPacket {
  schemaVersion: "ti.production_soak_decision_board.v1";
  dryRun: true;
  generatedAt: string;
  windowHours: 24;
  decision: ProductionSoakDecision;
  resourcePolicy: {
    scraperTargetGb: 96;
    scraperCeilingGb: 160;
    preserveCtiReserveGb: 500;
    browserPoolDisabled: true;
    boundedCaches: true;
    diskFirstEvidence: true;
    assumesGpu: false;
  };
  sideToolResourceBudgets: Array<{
    name: "dark_web_metadata_index" | "source_atlas_discovery_import";
    owner: string;
    status: "pass" | "warning" | "blocker";
    recordTarget: number;
    memoryReservationGb: number;
    memoryCeilingGb: number;
    diskReservationGb: number;
    queuePartition: string;
    proofCommand: string;
    starvationGuard: string;
  }>;
  sideToolReleaseGates: Array<{
    name: "unsafe_dark_web_target_attempt" | "raw_url_leakage" | "credential_payload_pattern" | "legal_review_overflow" | "source_atlas_auto_activation_mistake" | "source_discovery_flood";
    owner: string;
    status: "pass" | "warning" | "blocker";
    decisionImpact: ProductionSoakDecision;
    proofCommand: string;
    rollbackStep: string;
  }>;
  signals: ProductionSoakDecisionSignal[];
  staleSignals: ProductionSoakDecisionSignal[];
  scenarioFixtures: ProductionSoakScenarioFixture[];
  ownerHandoffs: Array<{
    owner: string;
    signals: ProductionSoakSignalName[];
    scenarios: ProductionSoakScenarioName[];
    nextAction: string;
  }>;
  proofCommands: string[];
  operatorRunbook: string[];
  noLeakProof: string;
}

export type OnCallDecisionState =
  | "promote"
  | "hold"
  | "rollback"
  | "pause_side_tool"
  | "drain_partition"
  | "emergency_stop_restricted"
  | "require_human_review"
  | "defer_background_work";

export type OnCallProcedureName =
  | "deploy_release"
  | "rollback_release"
  | "pause_source_atlas_import"
  | "pause_dark_web_metadata_refresh"
  | "emergency_stop_restricted_collectors"
  | "drain_queue_partitions"
  | "restore_public_ti_responsiveness";

export type OnCallIncidentName =
  | "unsafe_url_exposure"
  | "credential_payload_fetch_attempt_blocked"
  | "dangerous_collector_compromise_assumption"
  | "quarantine_overflow"
  | "evidence_object_corruption"
  | "route_contract_drift"
  | "stale_answer_regression"
  | "unknown_query_false_ready_regression"
  | "host_resource_pressure";

export interface OnCallProcedure {
  name: OnCallProcedureName;
  decisionState: OnCallDecisionState;
  trigger: string;
  operatorAction: string;
  queuePartitions: string[];
  routeProofs: Array<{
    route: string;
    proofCommand: string;
    expectedOutput: string;
  }>;
  rollbackOrResume: string;
  ownerHandoffs: string[];
  noLeakBoundary: string;
}

export interface OnCallIncidentPlaybook {
  name: OnCallIncidentName;
  decisionState: OnCallDecisionState;
  severity: "watch" | "hold" | "rollback" | "emergency";
  detectionSignals: string[];
  firstResponse: string;
  containment: string;
  recoveryProof: string;
  publicTiMode: "ready" | "partial" | "searching" | "metadata_review" | "degraded";
  ownerHandoffs: string[];
  noLeakBoundary: string;
}

export interface OnCallRunbookPack {
  schemaVersion: "ti.on_call_runbook_pack.v1";
  dryRun: true;
  generatedAt: string;
  resourcePolicy: {
    scraperTargetGb: 96;
    scraperCeilingGb: 160;
    preserveCtiReserveGb: 500;
    browserPoolDisabled: true;
    boundedCaches: true;
    diskFirstEvidence: true;
    assumesGpu: false;
  };
  decisionStates: OnCallDecisionState[];
  procedures: OnCallProcedure[];
  incidentPlaybooks: OnCallIncidentPlaybook[];
  sideToolSafeguards: Array<{
    tool: "dark_web_metadata_index" | "source_atlas_discovery_import" | "evidence_index_replay";
    pauseState: OnCallDecisionState;
    queuePartition: string;
    yieldTo: string[];
    maxMemoryGb: number;
    resumeGate: string;
  }>;
  publicResponsiveness: {
    targetFirstResponseSeconds: number;
    pollSeconds: number;
    restoreDecisionState: OnCallDecisionState;
    restoreActions: string[];
  };
  integrations: {
    capacitySimulation: "wired";
    incidentRunbooks: "wired";
    resourceArbitration: "wired";
    productionSoakDecisionBoard: "wired";
    releaseArtifactBundle: "wired";
  };
  proofCommands: string[];
  operatorRunbook: string[];
  noLeakProof: string;
}

export type ReleaseTrainHardeningDecision = "promote" | "hold" | "rollback" | "needs-human-approval";

export type ReleaseTrainHardeningSignalName =
  | "seven_day_public_ti_soak"
  | "thirty_day_capacity_forecast"
  | "deploy_mismatch_detection"
  | "image_version_pinning"
  | "migration_readiness"
  | "remote_proof_commands"
  | "public_api_wrapper_rollback"
  | "scraper_backend_rollback";

export interface ReleaseTrainHardeningSignal {
  name: ReleaseTrainHardeningSignalName;
  owner: string;
  status: "pass" | "warning" | "blocker";
  decisionImpact: ReleaseTrainHardeningDecision;
  evidence: string[];
  proofCommand: string;
  rollbackCriteria: string;
  noLeakBoundary: string;
}

export interface ReleaseTrainHardeningPacket {
  schemaVersion: "ti.release_train_hardening.v1";
  dryRun: true;
  generatedAt: string;
  decision: ReleaseTrainHardeningDecision;
  resourcePolicy: {
    scraperTargetGb: 96;
    scraperCeilingGb: 160;
    preserveCtiReserveGb: 500;
    browserPoolDisabled: true;
    boundedCaches: true;
    diskFirstEvidence: true;
    assumesGpu: false;
  };
  soakWindows: Array<{
    window: "7_day" | "30_day";
    status: "pass" | "warning" | "blocker";
    requiredSignals: ReleaseTrainHardeningSignalName[];
    publicTiExpectation: string;
    proofCommand: string;
  }>;
  deployMismatchDetectors: Array<{
    name: "scraper_image" | "public_api_wrapper_image" | "frontend_ti_image" | "route_contract" | "public_wrapper_semantics";
    status: "pass" | "warning" | "blocker";
    detector: string;
    rollbackAction: string;
  }>;
  imageVersionPins: Array<{
    service: "scraper" | "public_api_wrapper" | "frontend_ti" | "postgres_source_registry" | "queue_backend";
    pin: string;
    verification: string;
    rollbackPin: string;
  }>;
  migrationReadiness: Array<{
    migration: "source_registry" | "analyst_loop" | "evidence_search" | "graph_backend" | "queue_backend";
    status: "pass" | "warning" | "blocker";
    dryRunOnly: true;
    proofCommand: string;
    rollbackAction: string;
  }>;
  rollbackCriteria: Array<{
    target: "public_api_wrapper" | "scraper_backend";
    criteria: string[];
    command: string;
    proofAfterRollback: string;
  }>;
  remoteProofCommands: string[];
  signals: ReleaseTrainHardeningSignal[];
  integrations: {
    releaseArtifactBundle: "wired";
    productionSoakDecisionBoard: "wired";
    onCallRunbookPack: "wired";
    resourceArbitration: "wired";
    capacitySimulation: "wired";
  };
  proofCommands: string[];
  operatorRunbook: string[];
  noLeakProof: string;
}

export type ValueProgramOpsSoakDecision = "promote" | "hold" | "pause-side-tools" | "rollback" | "needs-human-approval";

export type ValueProgramOpsSideTool = "dark_web_metadata_index" | "source_atlas_discovery_import";

export type ValueProgramOpsGateName =
  | "darkweb_60k_refresh_soak"
  | "source_atlas_10k_import_soak"
  | "public_search_starvation_guard"
  | "unsafe_output_guard"
  | "host_resource_guard"
  | "inspur_deployment_proof";

export interface ValueProgramOpsReleaseGate {
  name: ValueProgramOpsGateName;
  owner: string;
  status: "pass" | "warning" | "blocker";
  decisionImpact: ValueProgramOpsSoakDecision;
  proofCommand: string;
  rollbackAction: string;
  evidence: string[];
}

export interface ValueProgramOpsSoakPacket {
  schemaVersion: "ti.value_program.ops_soak.v1";
  dryRun: true;
  generatedAt: string;
  decision: ValueProgramOpsSoakDecision;
  resourcePolicy: {
    scraperTargetGb: 96;
    scraperCeilingGb: 160;
    preserveCtiReserveGb: 500;
    browserPoolDisabled: true;
    boundedCaches: true;
    diskFirstEvidence: true;
    assumesGpu: false;
  };
  sideToolBudgets: Array<{
    tool: ValueProgramOpsSideTool;
    owner: string;
    queuePartition: string;
    recordTarget: number;
    refreshCadence: "daily_high_value_weekly_default" | "weekly_import_monthly_full_rescore";
    memoryReservationGb: number;
    memoryCeilingGb: number;
    maxQueueAgeP95Seconds: number;
    maxWorkerSaturationPercent: number;
    yieldsTo: string[];
    pauseCommand: string;
    resumeGate: string;
  }>;
  refreshSoak: {
    windowHours: 24;
    checkpointsHours: number[];
    gates: ValueProgramOpsReleaseGate[];
  };
  alertThresholds: Array<{
    name:
      | "darkweb_unsafe_attempts"
      | "darkweb_raw_url_leak"
      | "darkweb_review_backlog"
      | "source_atlas_auto_activation"
      | "source_atlas_queue_flood"
      | "public_ti_latency_starvation"
      | "scraper_memory_pressure"
      | "cti_reserve_pressure";
    severity: "watch" | "hold" | "rollback" | "emergency";
    threshold: string;
    operatorAction: string;
    proofCommand: string;
  }>;
  safetyIncidentDrills: Array<{
    name: "unsafe_target_attempt" | "raw_url_leak_regression" | "collector_quarantine_overflow" | "source_atlas_auto_activation" | "public_search_starvation";
    expectedDecision: ValueProgramOpsSoakDecision;
    firstResponse: string;
    proofCommand: string;
    rollbackOrResume: string;
  }>;
  deploymentProof: {
    localProofCommands: string[];
    inspurProofCommands: string[];
    publicProofCommand: string;
    requiredBeforePromotion: boolean;
  };
  integrations: {
    capacitySimulation: "wired";
    productionSoakDecisionBoard: "wired";
    onCallRunbookPack: "wired";
    releaseTrainHardening: "wired";
  };
  proofCommands: string[];
  operatorRunbook: string[];
  noLeakProof: string;
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
  capacitySimulation: CapacityCostSimulationPacket;
  incidentRunbooks: ProductionIncidentRunbookPacket;
  incidentSimulationPostmortems: ProductionIncidentSimulationPostmortemPacket;
  dependencyRollbackDrill: MultiServiceDependencyRollbackDrillPacket;
  releaseArtifactBundle: EnterpriseSoakReleaseArtifactBundlePacket;
  resourceArbitration: MultiServiceResourceArbitrationPacket;
  productionSoakDecisionBoard: ProductionSoakDecisionBoardPacket;
  onCallRunbookPack: OnCallRunbookPack;
  releaseTrainHardening: ReleaseTrainHardeningPacket;
  valueProgramOpsSoak: ValueProgramOpsSoakPacket;
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
      publicQueryCount: sample.publicQueryCount ?? 1,
      initialLatencyP95Ms: sample.initialLatencyP95Ms,
      partialLatencyP95Ms: sample.partialLatencyP95Ms,
      errorRatePercent: sample.errorRatePercent,
      duplicateActiveRuns: sample.duplicateActiveRuns,
      sourceCoveragePercent: sample.sourceCoveragePercent,
      queueAgeP95Seconds: sample.queueAgeP95Seconds,
      workerSaturationPercent,
      cpuMaxPercent,
      memoryRssMaxGb: sample.memoryRssMaxGb,
      policyBlocks: sample.policyBlocks,
      policyBlockRatePercent,
      unsafePolicyRetries: sample.unsafePolicyRetries,
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
  const capacitySimulation = buildCapacityCostSimulationPacket(input, observabilityDashboard, enterpriseReleaseTrain);
  const incidentRunbooks = buildProductionIncidentRunbookPacket(input, observabilityDashboard, enterpriseReleaseTrain, capacitySimulation);
  const incidentSimulationPostmortems = buildProductionIncidentSimulationPostmortemPacket(input, observabilityDashboard, enterpriseReleaseTrain, capacitySimulation, incidentRunbooks);
  const dependencyRollbackDrill = buildMultiServiceDependencyRollbackDrillPacket(input, observabilityDashboard, enterpriseReleaseTrain, incidentRunbooks);
  const releaseArtifactBundle = buildEnterpriseSoakReleaseArtifactBundlePacket(input, rcBoard, productTiBoard, realTimeSearchBoard, observabilityDashboard, enterpriseReleaseTrain, capacitySimulation, incidentRunbooks, dependencyRollbackDrill, blockers, warnings);
  const resourceArbitration = buildMultiServiceResourceArbitrationPacket(input, observabilityDashboard, enterpriseReleaseTrain, capacitySimulation, incidentSimulationPostmortems, releaseArtifactBundle);
  const productionSoakDecisionBoard = buildProductionSoakDecisionBoardPacket(input, observabilityDashboard, enterpriseReleaseTrain, capacitySimulation, releaseArtifactBundle, resourceArbitration);
  const onCallRunbookPack = buildOnCallRunbookPack(input, capacitySimulation, incidentRunbooks, resourceArbitration, productionSoakDecisionBoard, releaseArtifactBundle);
  const releaseTrainHardening = buildReleaseTrainHardeningPacket(input, capacitySimulation, releaseArtifactBundle, resourceArbitration, productionSoakDecisionBoard, onCallRunbookPack);
  const valueProgramOpsSoak = buildValueProgramOpsSoakPacket(input, capacitySimulation, productionSoakDecisionBoard, onCallRunbookPack, releaseTrainHardening);
  const nextProofCommands = uniqueStrings([
    ...blockers.map((blocker) => blocker.proofCommand),
    ...warnings.map((warning) => warning.proofCommand),
    ...deploymentProofs.map((proof) => proof.proofCommand),
    ...observabilityDashboard.proofCommands,
    ...enterpriseReleaseTrain.proofCommands,
    ...capacitySimulation.proofCommands,
    ...incidentRunbooks.proofCommands,
    ...incidentSimulationPostmortems.proofCommands,
    ...dependencyRollbackDrill.proofCommands,
    ...releaseArtifactBundle.proofCommands,
    ...resourceArbitration.proofCommands,
    ...productionSoakDecisionBoard.proofCommands,
    ...onCallRunbookPack.proofCommands,
    ...releaseTrainHardening.proofCommands,
    ...valueProgramOpsSoak.proofCommands,
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
    capacitySimulation,
    incidentRunbooks,
    incidentSimulationPostmortems,
    dependencyRollbackDrill,
    releaseArtifactBundle,
    resourceArbitration,
    productionSoakDecisionBoard,
    onCallRunbookPack,
    releaseTrainHardening,
    valueProgramOpsSoak,
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
  const enterpriseViews = buildEnterpriseObservabilityViews(input, metrics, realTimeSearchBoard, productTiBoard);
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
    enterpriseViews,
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

function buildCapacityCostSimulationPacket(
  input: CutoverSoakReleasePacketInput,
  observabilityDashboard: ProductionObservabilityDashboardPacket,
  enterpriseReleaseTrain: EnterpriseReleaseTrainPacket
): CapacityCostSimulationPacket {
  const summary = input.soak.summary;
  const publicQueryCount = Math.max(1, input.trends.publicQueries);
  const policyBlockCount = Math.max(1, Math.ceil(publicQueryCount * summary.policyBlockRatePercent / 100), summary.rejectedUnsafeActions);
  const base = {
    publicSourceCollections: Math.max(1_800, publicQueryCount * 420),
    publicChannelWindows: Math.max(240, publicQueryCount * 55),
    restrictedMetadataReviews: Math.max(36, policyBlockCount * 16),
    graphExports: Math.max(120, publicQueryCount * 28),
    evidenceReplays: Math.max(90, publicQueryCount * 20),
    actorSweeps: Math.max(60, publicQueryCount * 12),
    sourceActivationWaves: 8,
    apiPolls: Math.max(24_000, publicQueryCount * 7_200)
  };
  const hostBudget: CapacityCostSimulationPacket["hostBudget"] = {
    hostRamGb: 1_024,
    scraperTargetGb: 96,
    scraperCeilingGb: 160,
    ctiReserveGb: 500,
    osCacheAndEmergencyGb: 364,
    allocatableScraperBurstGb: 64,
    approvalRequiredAboveGb: 160
  };
  const workerPartitions: CapacityCostSimulationPacket["workerPartitions"] = [
    { name: "interactive_live_search", owner: "Agent 02/09/10", workerCap: 32, memoryReservationGb: 16, memoryCeilingGb: 28, queuePartition: "interactive_live_search", throttle: "preserve first-response SLO; reuse active runs before adding workers" },
    { name: "public_collection", owner: "Agent 03/10", workerCap: 96, memoryReservationGb: 30, memoryCeilingGb: 48, queuePartition: "public_collection", throttle: "pause broad sweeps before live-search leases" },
    { name: "public_channel", owner: "Agent 04/10", workerCap: 8, memoryReservationGb: 4, memoryCeilingGb: 8, queuePartition: "public_channel_windows", throttle: "cap windows and retry-after under API or source pressure" },
    { name: "restricted_metadata", owner: "Agent 05/10", workerCap: 4, memoryReservationGb: 4, memoryCeilingGb: 8, queuePartition: "restricted_metadata_review", throttle: "metadata-only, low-concurrency, kill switch wins over throughput" },
    { name: "dark_web_metadata_index", owner: "Agent 05/10", workerCap: 6, memoryReservationGb: 12, memoryCeilingGb: 24, queuePartition: "restricted_metadata_index_refresh", throttle: "60k record refresh yields to public search and never fetches raw payloads" },
    { name: "source_atlas_import", owner: "Agent 01/10", workerCap: 10, memoryReservationGb: 10, memoryCeilingGb: 18, queuePartition: "source_atlas_candidate_import", throttle: "10k candidates are staged only; no auto-activation or crawl leases" },
    { name: "evidence_index_replay", owner: "Agent 06/10", workerCap: 8, memoryReservationGb: 12, memoryCeilingGb: 22, queuePartition: "evidence_index_replay", throttle: "run off-peak and pause on disk pressure or cursor gaps" },
    { name: "graph_export", owner: "Agent 08/10", workerCap: 4, memoryReservationGb: 6, memoryCeilingGb: 14, queuePartition: "graph_export", throttle: "hold STIX/export work behind review and replay readiness" },
    { name: "retention_backup", owner: "Agent 06/10", workerCap: 4, memoryReservationGb: 6, memoryCeilingGb: 12, queuePartition: "retention_backup", throttle: "legal hold and backup integrity beat deletion throughput" }
  ];
  const scenario = (
    name: CapacitySimulationScenarioName,
    multiplier: number,
    overrides: Partial<CapacitySimulationScenario["workload"]>,
    pressure: {
      memory: number;
      disk: number;
      queue: number;
      worker: number;
      rateLimit: number;
      api: number;
      evidence: number;
      graph: number;
      review: number;
      decision?: EnterpriseReleaseDecision;
    },
    rollbackRecommendation: string
  ): CapacitySimulationScenario => {
    const workload = {
      publicSourceCollections: Math.round((overrides.publicSourceCollections ?? base.publicSourceCollections) * multiplier),
      publicChannelWindows: Math.round((overrides.publicChannelWindows ?? base.publicChannelWindows) * multiplier),
      restrictedMetadataReviews: Math.round((overrides.restrictedMetadataReviews ?? base.restrictedMetadataReviews) * multiplier),
      graphExports: Math.round((overrides.graphExports ?? base.graphExports) * multiplier),
      evidenceReplays: Math.round((overrides.evidenceReplays ?? base.evidenceReplays) * multiplier),
      actorSweeps: Math.round((overrides.actorSweeps ?? base.actorSweeps) * multiplier),
      sourceActivationWaves: Math.round((overrides.sourceActivationWaves ?? base.sourceActivationWaves) * multiplier),
      apiPolls: Math.round((overrides.apiPolls ?? base.apiPolls) * multiplier)
    };
    const evidenceGrowthGb = round1(Math.max(12, workload.publicSourceCollections * 0.009 + workload.publicChannelWindows * 0.018 + workload.restrictedMetadataReviews * 0.004) * pressure.evidence);
    const graphGrowthGb = round1(Math.max(4, workload.graphExports * 0.012 + workload.actorSweeps * 0.05) * pressure.graph);
    const diskGrowthGb = round1((evidenceGrowthGb + graphGrowthGb + workload.evidenceReplays * 0.006) * pressure.disk);
    const memoryRssMaxGb = round1(Math.max(summary.memoryRssMaxGb, 32) * pressure.memory);
    const queueAgeP95Seconds = Math.round(Math.max(summary.queueAgeP95Seconds, 5) * pressure.queue);
    const workerSaturationPercent = Math.min(100, round1(Math.max(summary.workerSaturationPercent, 20) * pressure.worker));
    const sourceRateLimitPercent = Math.min(100, round1(Math.max(summary.sourceUnavailableRatePercent + summary.errorRatePercent, 1) * pressure.rateLimit));
    const apiLatencyP95Ms = Math.round(Math.max(summary.initialLatencyP95Ms, 250) * pressure.api);
    const operatorReviewHours = round1((workload.restrictedMetadataReviews * 0.09 + workload.sourceActivationWaves * 0.75 + workload.graphExports * 0.015) * pressure.review);
    const ctiReserveAfterGb = round1(Math.max(0, enterpriseReleaseTrain.capacityPlan.nonScraperReservedGb - diskGrowthGb));
    const bottlenecks = [
      memoryRssMaxGb > 160 ? "memory_above_160gb_ceiling" : memoryRssMaxGb > 96 ? "memory_above_96gb_target" : undefined,
      ctiReserveAfterGb < 500 ? "cti_reserve_below_500gb" : undefined,
      queueAgeP95Seconds > DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxQueueAgeP95Seconds * 2 ? "queue_age_blocker" : queueAgeP95Seconds > DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxQueueAgeP95Seconds ? "queue_age_warning" : undefined,
      workerSaturationPercent > 95 ? "worker_saturation_blocker" : workerSaturationPercent > DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxWorkerSaturationPercent ? "worker_saturation_warning" : undefined,
      sourceRateLimitPercent > DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxSourceUnavailableRatePercent ? "source_rate_limit_pressure" : undefined,
      operatorReviewHours > 96 ? "operator_review_backlog" : undefined
    ].filter((item): item is string => Boolean(item));
    const status: CapacitySimulationScenario["status"] = bottlenecks.some((item) => item.includes("blocker") || item === "memory_above_160gb_ceiling" || item === "cti_reserve_below_500gb")
      ? "blocker"
      : bottlenecks.length > 0
        ? "warning"
        : "pass";
    const releaseDecision = pressure.decision ?? capacityScenarioDecision(status, name);
    return {
      name,
      releaseDecision,
      status,
      workload,
      forecast: {
        memoryRssMaxGb,
        diskGrowthGb,
        queueAgeP95Seconds,
        workerSaturationPercent,
        sourceRateLimitPercent,
        apiLatencyP95Ms,
        evidenceGrowthGb,
        graphGrowthGb,
        operatorReviewHours,
        ctiReserveAfterGb
      },
      bottlenecks,
      rollbackRecommendation,
      noLeakExample: "scenario output uses counts, source ids, hashes, cursors, queue ages, and aggregate GB only"
    };
  };
  const scenarios: CapacitySimulationScenario[] = [
    scenario("baseline", 1, {}, { memory: 1, disk: 1, queue: 1, worker: 1, rateLimit: 1, api: 1, evidence: 1, graph: 1, review: 1, decision: "promote" }, "continue canary and keep bounded caches/disk-first evidence"),
    scenario("high_activity_actor_burst", 2.4, { actorSweeps: base.actorSweeps * 3, apiPolls: base.apiPolls * 3 }, { memory: 1.22, disk: 1.25, queue: 1.75, worker: 1.45, rateLimit: 1.8, api: 1.35, evidence: 1.3, graph: 1.25, review: 1.15, decision: "promote-with-warnings" }, "reuse active runs, cap public polling, and defer broad actor sweeps"),
    scenario("ransomware_victim_burst", 2.1, { publicChannelWindows: base.publicChannelWindows * 3, restrictedMetadataReviews: base.restrictedMetadataReviews * 2 }, { memory: 1.35, disk: 1.6, queue: 1.9, worker: 1.55, rateLimit: 2.1, api: 1.45, evidence: 1.7, graph: 1.45, review: 1.8, decision: "canary-with-warnings" }, "keep ransomware/victim queries partial until claim-ledger review catches up"),
    scenario("dark_metadata_60k_refresh", 1.15, { restrictedMetadataReviews: 60_000, evidenceReplays: base.evidenceReplays * 2 }, { memory: 1.32, disk: 0.8, queue: 1.8, worker: 1.35, rateLimit: 1.4, api: 1.2, evidence: 0.45, graph: 0.85, review: 1.2, decision: "promote-with-warnings" }, "throttle restricted metadata index refresh and keep output hash/source-id only"),
    scenario("source_atlas_10k_import", 1.1, { sourceActivationWaves: 24, publicSourceCollections: 10_000 }, { memory: 1.18, disk: 1.05, queue: 1.55, worker: 1.25, rateLimit: 1.2, api: 1.18, evidence: 0.65, graph: 0.75, review: 1.7, decision: "canary-with-warnings" }, "stage atlas candidates and require source-governance approval before activation"),
    scenario("index_replay_backfill", 1.3, { evidenceReplays: base.evidenceReplays * 8, graphExports: base.graphExports * 2 }, { memory: 1.3, disk: 1.8, queue: 2.2, worker: 1.4, rateLimit: 1.1, api: 1.15, evidence: 1.8, graph: 1.2, review: 1.1, decision: "promote-with-warnings" }, "pause replay batches before disk reserve drops or cursor gaps appear"),
    scenario("source_outage_wave", 1.4, {}, { memory: 1.08, disk: 1.05, queue: 3.4, worker: 1.2, rateLimit: 9, api: 1.6, evidence: 0.75, graph: 0.8, review: 1.1, decision: "no-go" }, "pause unavailable sources and keep stale-source caveats visible"),
    scenario("parser_failure_spike", 1.5, { evidenceReplays: base.evidenceReplays * 3 }, { memory: 1.18, disk: 1.2, queue: 2.3, worker: 1.35, rateLimit: 4, api: 1.4, evidence: 1.1, graph: 0.7, review: 1.4, decision: "no-go" }, "hold ready wording and route parser repair to Agent 03/07 before promotion"),
    scenario("restricted_review_spike", 1.2, { restrictedMetadataReviews: base.restrictedMetadataReviews * 8 }, { memory: 1.1, disk: 1.1, queue: 1.7, worker: 1.25, rateLimit: 2, api: 1.25, evidence: 1.05, graph: 0.9, review: 5.5, decision: "emergency-stop" }, "activate restricted metadata emergency stop if review backlog or kill switch trips"),
    scenario("graph_export_backlog", 1.6, { graphExports: base.graphExports * 6, evidenceReplays: base.evidenceReplays * 2 }, { memory: 1.28, disk: 1.7, queue: 2.1, worker: 1.5, rateLimit: 1.4, api: 1.35, evidence: 1.4, graph: 4.8, review: 1.6, decision: "rollback" }, "hold graph/STIX export promotion and replay reviewed relationships only")
  ];
  const scenarioByName = new Map(scenarios.map((item) => [item.name, item]));
  const sideToolForecasts: CapacityCostSimulationPacket["sideToolForecasts"] = [
    {
      name: "dark_web_metadata_index",
      owner: "Agent 05/10",
      recordTarget: 60_000,
      monthlyRecords: 60_000,
      memoryReservationGb: 12,
      memoryCeilingGb: 24,
      diskGrowthGb: scenarioByName.get("dark_metadata_60k_refresh")?.forecast.diskGrowthGb ?? 0,
      apiPolls: 18_000,
      queueJobs: 1_200,
      retryDeadLetterBudget: 120,
      releaseGate: "hold",
      starvationGuard: "pause refresh when public search queue p95 exceeds soak SLO or scraper RSS crosses 96 GB"
    },
    {
      name: "source_atlas_discovery_import",
      owner: "Agent 01/10",
      recordTarget: 10_000,
      monthlyRecords: 10_000,
      memoryReservationGb: 10,
      memoryCeilingGb: 18,
      diskGrowthGb: scenarioByName.get("source_atlas_10k_import")?.forecast.diskGrowthGb ?? 0,
      apiPolls: 7_200,
      queueJobs: 800,
      retryDeadLetterBudget: 80,
      releaseGate: "hold",
      starvationGuard: "stage candidates without source activation; public search and 500 GB CTI reserve win over atlas imports"
    }
  ];
  const indexReplayBudget: CapacityCostSimulationPacket["indexReplayBudget"] = {
    replayWindowDays: 30,
    maxReplayBatchesPerDay: 24,
    maxReplayMemoryGb: 22,
    diskGrowthGb: scenarioByName.get("index_replay_backfill")?.forecast.diskGrowthGb ?? 0,
    queuePartition: "evidence_index_replay",
    rollbackTrigger: "pause replay if object integrity, cursor continuity, or 500 GB CTI reserve checks fail",
    noLeakProof: "replay budget exposes batch counts, cursor ids, hashes, and aggregate GB only"
  };
  const monthlyCostProxy: CapacityCostSimulationPacket["monthlyCostProxy"] = {
    currency: "capacity_units",
    computeUnits: Math.round(scenarios.reduce((sum, item) => sum + item.forecast.memoryRssMaxGb * item.workload.apiPolls / 100_000, 0)),
    storageUnits: Math.round(scenarios.reduce((sum, item) => sum + item.forecast.diskGrowthGb, 0)),
    operatorReviewUnits: Math.round(scenarios.reduce((sum, item) => sum + item.forecast.operatorReviewHours, 0)),
    totalUnits: 0,
    highestCostScenario: [...scenarios].sort((a, b) => (b.forecast.diskGrowthGb + b.forecast.operatorReviewHours + b.forecast.memoryRssMaxGb) - (a.forecast.diskGrowthGb + a.forecast.operatorReviewHours + a.forecast.memoryRssMaxGb))[0]?.name ?? "baseline",
    reductionLevers: [
      "reuse active live-search runs before adding workers",
      "pause dark metadata refresh and atlas import before public search",
      "run index replay off-peak with bounded batches",
      "keep browser pool disabled unless explicitly reallocated",
      "reduce graph export and evidence replay before crossing 96 GB target"
    ]
  };
  monthlyCostProxy.totalUnits = monthlyCostProxy.computeUnits + monthlyCostProxy.storageUnits + monthlyCostProxy.operatorReviewUnits;
  const aggregate = {
    worstDecision: worstEnterpriseDecision(scenarios.map((item) => item.releaseDecision)),
    memoryPeakGb: Math.max(...scenarios.map((item) => item.forecast.memoryRssMaxGb)),
    diskGrowthPeakGb: Math.max(...scenarios.map((item) => item.forecast.diskGrowthGb)),
    queueAgePeakSeconds: Math.max(...scenarios.map((item) => item.forecast.queueAgeP95Seconds)),
    operatorReviewPeakHours: Math.max(...scenarios.map((item) => item.forecast.operatorReviewHours)),
    ctiReserveMinimumGb: Math.min(...scenarios.map((item) => item.forecast.ctiReserveAfterGb)),
    releaseReadyScenarioCount: scenarios.filter((item) => item.releaseDecision === "promote" || item.releaseDecision === "promote-with-warnings" || item.releaseDecision === "canary-ready" || item.releaseDecision === "canary-with-warnings").length,
    rollbackScenarioCount: scenarios.filter((item) => item.releaseDecision === "rollback").length,
    emergencyStopScenarioCount: scenarios.filter((item) => item.releaseDecision === "emergency-stop").length
  };
  return {
    schemaVersion: "ti.capacity_cost_simulation.v1",
    dryRun: true,
    windowDays: 30,
    generatedAt: input.generatedAt ?? "dry-run",
    resourceBudget: {
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    },
    scenarios,
    hostBudget,
    workerPartitions,
    sideToolForecasts,
    indexReplayBudget,
    monthlyCostProxy,
    aggregate,
    proofCommands: uniqueStrings([
      "bun test src/tests/ops.test.ts",
      "bun run check",
      "bun run check:route-inventory",
      "bun run check:deploy-hygiene",
      "bun run check:docker-contexts",
      "bun run check:contract-index",
      ...observabilityDashboard.proofCommands
    ]),
    operatorRunbook: [
      "treat 96 GB as warning target and 160 GB as rollback ceiling",
      "preserve 500 GB for the rest of CTI before increasing scraper storage or replay windows",
      "keep 60k dark-web metadata refresh and 10k source-atlas import in separate partitions that yield to public search",
      "run index replay in bounded off-peak batches and pause on object/cursor/disk drift",
      "keep browser pool disabled unless explicitly reallocated",
      "defer actor sweeps, graph exports, and evidence replay before reducing public first-response SLO",
      "use restricted review spike as emergency-stop rehearsal, not automatic collection approval"
    ]
  };
}

function capacityScenarioDecision(status: "pass" | "warning" | "blocker", name: CapacitySimulationScenarioName): EnterpriseReleaseDecision {
  if (name === "restricted_review_spike") return "emergency-stop";
  if (name === "graph_export_backlog") return "rollback";
  if (status === "blocker") return "no-go";
  if (status === "warning") return "promote-with-warnings";
  return "promote";
}

function buildProductionIncidentRunbookPacket(
  input: CutoverSoakReleasePacketInput,
  observabilityDashboard: ProductionObservabilityDashboardPacket,
  enterpriseReleaseTrain: EnterpriseReleaseTrainPacket,
  capacitySimulation: CapacityCostSimulationPacket
): ProductionIncidentRunbookPacket {
  const routeProof = (surface: string, proofCommand: string, expectedOutput: string): ProductionIncidentRunbook["expectedRouteApiProof"][number] => ({
    surface,
    proofCommand,
    expectedOutput
  });
  const noLeakGuarantees = [
    "route proof uses ids, counts, status, hashes, cursors, and aggregate metrics only",
    "operator actions do not fetch restricted targets, leaked rows, credentials, private access material, or actor-interaction content",
    "rollback evidence uses manifests and DTO summaries, never raw bodies or object keys"
  ];
  const runbook = (
    name: ProductionIncidentRunbookName,
    trigger: string,
    detectionFields: string[],
    operatorAction: string,
    expectedRouteApiProof: ProductionIncidentRunbook["expectedRouteApiProof"],
    rollback: string,
    owningSubsystem: string,
    escalationPath: string[],
    releaseDecisionImpact: EnterpriseReleaseDecision
  ): ProductionIncidentRunbook => ({
    name,
    trigger,
    detectionFields,
    operatorAction,
    expectedRouteApiProof,
    rollback,
    noLeakGuarantees,
    owningSubsystem,
    escalationPath,
    releaseDecisionImpact
  });
  const publicProofStatus = proofStatusFromObservabilityMetric(observabilityDashboard, "public_proof_matrix");
  const queueScenario = capacitySimulation.scenarios.find((scenario) => scenario.name === "high_activity_actor_burst");
  const sourceOutageScenario = capacitySimulation.scenarios.find((scenario) => scenario.name === "source_outage_wave");
  const parserScenario = capacitySimulation.scenarios.find((scenario) => scenario.name === "parser_failure_spike");
  const restrictedScenario = capacitySimulation.scenarios.find((scenario) => scenario.name === "restricted_review_spike");
  const graphScenario = capacitySimulation.scenarios.find((scenario) => scenario.name === "graph_export_backlog");
  const runbooks: ProductionIncidentRunbook[] = [
    runbook(
      "public_proof_failure",
      `public proof matrix is ${publicProofStatus} or public POST/frontend proof loses run/cursor/live-state fields`,
      ["observabilityDashboard.publicProofMatrix", "deploymentProofs.public_post_api_proof", "deploymentProofs.frontend_ti_query_proof", "realTimeSearchBoard.queryMatrix"],
      "restore the public wrapper fallback, keep scraper-native search canary-only, and rerun known/random/made-up actor proof",
      [
        routeProof("/v1/intel/search", "bun run check:scraper-native-search", "HTTP 200 with stable runId/cursor/status and no raw payload fields"),
        routeProof("public POST /api/ti/search", "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "known/random/made-up actor proofs return live states and run ids")
      ],
      "restore previous api public wrapper fallback and redeploy hanasand_api",
      "Agent 09 public wrapper compatibility",
      ["Agent 09", "Agent 10", "main agent deploy owner"],
      "rollback"
    ),
    runbook(
      "queue_saturation",
      `queue p95 ${input.trends.queuePressure.p95Seconds}s or actor burst forecast decision ${queueScenario?.releaseDecision ?? "promote-with-warnings"}`,
      ["soak.summary.queueAgeP95Seconds", "frontier.status.scheduler", "capacitySimulation.high_activity_actor_burst.forecast", "runtimeProofs.queue_economics"],
      "activate low-priority drain, cap public polling, pause broad actor sweeps, and preserve cursor continuity",
      [
        routeProof("/v1/frontier/status", "bun run check:frontier-apply-plan", "dry-run drain plan preserves run reuse and cursor replay"),
        routeProof("/v1/intel/search.scheduler", "bun test src/tests/schedulerProduction.test.ts", "scheduler summaries expose queue age, retry debt, and fairness state")
      ],
      "return public search to queued-only partial responses until queue p95 is below release threshold",
      "Agent 02 scheduler fairness",
      ["Agent 02", "Agent 09", "Agent 10"],
      "no-go"
    ),
    runbook(
      "source_outage_wave",
      `source outage scenario decision ${sourceOutageScenario?.releaseDecision ?? "no-go"} or source-unavailable SLO breaches`,
      ["observabilityDashboard.sloDashboard.source_unavailable_rate_percent", "sourceCoverage.governanceDrift", "capacitySimulation.source_outage_wave.forecast", "publicChannel.status.reliability"],
      "pause unavailable sources, keep stale-source caveats visible, and route source-pack repair to governance",
      [
        routeProof("/v1/sources/coverage-plan", "bun test src/tests/sourceSeeds.test.ts", "coverage plan reports source gaps and non-mutating remediation"),
        routeProof("/v1/public-channels/status", "bun test src/tests/publicSignalFusion.test.ts", "public-channel reliability reports outage-safe partial answers")
      ],
      "quarantine failing sources and keep last known good public evidence with caveats",
      "Agent 01 source governance",
      ["Agent 01", "Agent 04", "Agent 10"],
      "no-go"
    ),
    runbook(
      "parser_failure_spike",
      `parser failure scenario decision ${parserScenario?.releaseDecision ?? "no-go"} or extraction quality drops below release gate`,
      ["adapterFailureObservatory.parserConfidence", "qualityDashboard.reviewGates", "capacitySimulation.parser_failure_spike.forecast", "pipeline.parserWarnings"],
      "hold ready wording, keep answers partial, and route parser repair plus quality regression fixtures to adapters and quality workbench",
      [
        routeProof("/v1/quality/evaluate", "bun test src/tests/pipeline.test.ts", "quality DTOs expose parser/quality holds without raw evidence"),
        routeProof("adapter observatory fixtures", "bun test src/tests/adapterFailureObservatory.test.ts src/tests/adapterFixtures.test.ts", "adapter failures are categorized by safe class")
      ],
      "disable affected parser profile or source family until fresh extraction proof passes",
      "Agent 03 adapters and Agent 07 quality workbench",
      ["Agent 03", "Agent 07", "Agent 10"],
      "no-go"
    ),
    runbook(
      "evidence_store_degradation",
      `evidence proof status ${proofStatusFromObservabilityMetric(observabilityDashboard, "evidence_write_read_proof")} or replay manifests cannot be restored`,
      ["observabilityDashboard.sloDashboard.evidence_write_read_proof", "enterpriseReleaseTrain.disasterRecovery.evidence_export_manifest", "storageCutover.backupIntegrity", "claimLedger.replay"],
      "stop evidence promotion, keep discovery metadata separate, run backup manifest verification, and hold public-ready upgrades",
      [
        routeProof("/v1/evidence/replay-plan", "bun test src/tests/storageCutover.test.ts", "replay plan exposes capture ids, hashes, deltas, and no raw object keys"),
        routeProof("/v1/evidence/cutover-report", "bun test src/tests/storage.test.ts src/tests/storageCutover.test.ts", "cutover report preserves immutable capture and claim-ledger lineage")
      ],
      "restore latest evidence manifest and replay claim ledger before re-enabling promotion",
      "Agent 06 evidence DR",
      ["Agent 06", "Agent 08", "Agent 10"],
      "rollback"
    ),
    runbook(
      "restricted_metadata_emergency_stop",
      `restricted kill switch active=${input.trends.restrictedKillSwitch.active} or restricted review scenario decision ${restrictedScenario?.releaseDecision ?? "emergency-stop"}`,
      ["trends.restrictedKillSwitch.active", "restrictedMetadata.status.killSwitch", "capacitySimulation.restricted_review_spike.forecast", "analystOperations.operationalPlaybooks"],
      "activate restricted emergency stop, drain restricted metadata workers, preserve public-safe answers, and require human approval before restore",
      [
        routeProof("/v1/restricted-metadata/status", "bun run check:restricted-metadata-status", "restricted status reports kill switch, proxy isolation, approval, retention, and redaction state"),
        routeProof("/v1/restricted-metadata/apply-plan", "bun run check:restricted-metadata-apply-plan", "apply plan remains dry-run and metadata-only")
      ],
      "keep restricted connectors disabled and restore only after approval, proxy, retention, and redaction checks pass",
      "Agent 05 restricted metadata playbooks",
      ["Agent 05", "Agent 06", "Agent 09", "Agent 10"],
      "emergency-stop"
    ),
    runbook(
      "api_wrapper_regression",
      "public wrapper response drops stable status, run id, cursor, warning, or no-leak compatibility fields",
      ["contracts.publicCompatibility", "sdkIntegration.fixturePacks", "deploymentProofs.public_post_api_proof", "api_readiness_sla"],
      "freeze wrapper rollout, run compatibility fixture pack, and preserve current /v1 contract semantics",
      [
        routeProof("/v1/contracts", "bun run check:contract-index", "contracts publish stable wrapper, SDK, auth, error, and cursor semantics"),
        routeProof("public POST /api/ti/search", "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "public wrapper remains backward-compatible for known/random/made-up queries")
      ],
      "restore previous compatibility wrapper path and redeploy hanasand_api",
      "Agent 09 API compatibility",
      ["Agent 09", "Agent 10", "main agent deploy owner"],
      "rollback"
    ),
    runbook(
      "graph_export_corruption",
      `graph export scenario decision ${graphScenario?.releaseDecision ?? "rollback"} or graph readiness proof blocks STIX/export promotion`,
      ["observabilityDashboard.sloDashboard.graph_export_readiness", "graphExport.reviewHolds", "capacitySimulation.graph_export_backlog.forecast", "stix.readiness"],
      "pause graph/STIX export promotion, replay reviewed relationships only, and require ledger-complete graph proof",
      [
        routeProof("/v1/graph/review-plan", "bun run check:graph-review-mounted", "graph review plan reports holds, actions, and provenance ids"),
        routeProof("/v1/exports/stix", "bun test src/tests/graphViews.test.ts src/tests/graphReviewRoutes.test.ts", "STIX readiness excludes weak, stale, contradicted, or missing-ledger facts")
      ],
      "rollback graph export queue to last reviewed relationship snapshot",
      "Agent 08 graph governance",
      ["Agent 08", "Agent 06", "Agent 10"],
      "rollback"
    ),
    runbook(
      "canary_rollback",
      "canary activation, run, pause, or public answer readiness proof regresses",
      ["canaryExecution.decision", "ops.canary.activationApplied", "ops.canary.activeSourceCount", "qualityRegressionSuite"],
      "pause canary loop, keep source activation human-approved, and rerun public canary extraction/readiness proof",
      [
        routeProof("/v1/ops/canary", "bun test src/tests/api.test.ts", "canary state reports active sources, approval state, extraction metrics, and partial reasons"),
        routeProof("/v1/ops/canary/console", "bun run check:route-inventory", "operator console remains mounted and safe")
      ],
      "POST /v1/sources/canary-pause and keep outer fallback active until canary proof is green",
      "Agent 07 canary and quality workbench",
      ["Agent 07", "Agent 01", "Agent 10"],
      "rollback"
    ),
    runbook(
      "container_rollback",
      "scraper, API, frontend, Docker image, compose, or route inventory proof diverges from last known good",
      ["deploymentDrift.state", "enterpriseReleaseTrain.dependencyHealth.docker", "routeInventory.routeCount", "dockerContext.status"],
      "stop promotion, redeploy last known good image/compose config, and rerun health plus route inventory proof",
      [
        routeProof("docker compose", "bun run check:deploy-hygiene && bun run check:docker-contexts", "compose, Dockerfile, memory, evidence volume, and context limits are valid"),
        routeProof("/v1/health and /v1/metrics", "bun run check:route-inventory", "mounted routes return compact safe responses")
      ],
      "docker compose up -d ti-scraper api frontend --no-build",
      "Agent 10 deployment operations",
      ["Agent 10", "main agent deploy owner"],
      "rollback"
    ),
    runbook(
      "multi_service_health_degradation",
      `enterprise dependency decision ${enterpriseReleaseTrain.decision} with dependency statuses ${enterpriseReleaseTrain.dependencyHealth.map((item) => `${item.name}:${item.status}`).join(",")}`,
      ["enterpriseReleaseTrain.dependencyHealth", "observabilityDashboard.enterpriseViews.integrations", "deploymentProofs", "runtimeProofs"],
      "degrade user-visible state to partial/searching, isolate failing dependency, preserve evidence writes, and page owning workstream",
      [
        routeProof("/v1/health", "bun run check:route-inventory", "health and route inventory remain compact and safe"),
        routeProof("release packet", "bun test src/tests/ops.test.ts", "release packet exposes owner, proof command, rollback path, and no-leak guarantees")
      ],
      "roll back only the failing service first, then public wrapper, then full scraper stack if health does not recover",
      "Agent 10 multi-service release operations",
      ["Agent 01", "Agent 02", "Agent 03", "Agent 04", "Agent 05", "Agent 06", "Agent 07", "Agent 08", "Agent 09", "Agent 10"],
      "no-go"
    )
  ];
  const releaseDecisionCounts = runbooks.reduce((counts, item) => {
    counts[item.releaseDecisionImpact] += 1;
    return counts;
  }, {
    "promote": 0,
    "canary-ready": 0,
    "promote-with-warnings": 0,
    "canary-with-warnings": 0,
    "no-go": 0,
    "rollback": 0,
    "emergency-stop": 0
  } satisfies Record<EnterpriseReleaseDecision, number>);
  return {
    schemaVersion: "ti.production_incident_runbooks.v1",
    dryRun: true,
    generatedAt: input.generatedAt ?? "dry-run",
    resourceBudget: {
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    },
    runbooks,
    integrations: {
      agent01SourceGovernance: "wired",
      agent02SchedulerFairness: "wired",
      agent03Adapters: "wired",
      agent04PublicCoverage: "wired",
      agent05RestrictedPlaybooks: "wired",
      agent06EvidenceDr: "wired",
      agent07QualityWorkbench: "wired",
      agent08GraphGovernance: "wired",
      agent09ApiCompatibility: "wired",
      agent10ReleaseOps: "wired"
    },
    releaseDecisionCounts,
    proofCommands: uniqueStrings([
      "bun test src/tests/ops.test.ts",
      "bun test src/tests/api.test.ts",
      "bun run check",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      "bun run check:deploy-hygiene",
      "bun run check:docker-contexts",
      ...runbooks.flatMap((item) => item.expectedRouteApiProof.map((proof) => proof.proofCommand))
    ]),
    operatorRunbook: [
      "start with the named incident runbook, not ad hoc shell actions",
      "keep scraper under 96 GB target and treat 160 GB as rollback ceiling",
      "preserve 500 GB for the rest of CTI before widening replay, graph export, or source activation windows",
      "keep browser workers disabled unless explicitly reallocated",
      "never include raw leaked data, credentials, private-source material, object keys, or unsafe restricted URLs in proof output"
    ]
  };
}

function buildProductionIncidentSimulationPostmortemPacket(
  input: CutoverSoakReleasePacketInput,
  observabilityDashboard: ProductionObservabilityDashboardPacket,
  enterpriseReleaseTrain: EnterpriseReleaseTrainPacket,
  capacitySimulation: CapacityCostSimulationPacket,
  incidentRunbooks: ProductionIncidentRunbookPacket
): ProductionIncidentSimulationPostmortemPacket {
  const runbookByName = new Map(incidentRunbooks.runbooks.map((runbook) => [runbook.name, runbook]));
  const scenarioByName = new Map(capacitySimulation.scenarios.map((scenario) => [scenario.name, scenario]));
  const postmortemFields = (scenarioName: ProductionIncidentSimulationScenarioName): ProductionIncidentPostmortemField[] => [
    {
      field: "summary",
      prompt: `Summarize ${scenarioName} with incident window, trigger, and release impact.`,
      requiredEvidence: ["timeline", "detectionSignals", "releaseGateOutcome"]
    },
    {
      field: "customer_impact",
      prompt: "Record public /ti state, partial/searching behavior, and whether any client saw stale or unsafe content.",
      requiredEvidence: ["blastRadius.publicTiState", "userVisibleDegradation", "noLeakProof"]
    },
    {
      field: "root_cause",
      prompt: "Name the owning subsystem and the first failed control without guessing beyond the proof packet.",
      requiredEvidence: ["ownerAgents", "detectionSignals"]
    },
    {
      field: "detection_gap",
      prompt: "Capture alert timing, missing metric coverage, and whether the 24h soak would have caught it.",
      requiredEvidence: ["timeline.detect", "proofCommand"]
    },
    {
      field: "rollback_result",
      prompt: "Record rollback action, verification command, and residual release blocker.",
      requiredEvidence: ["rollbackAction", "timeline.verify", "releaseGateOutcome"]
    },
    {
      field: "follow_up",
      prompt: "Assign follow-up tasks to owner agents with safe evidence ids, hashes, counts, and DTO fields only.",
      requiredEvidence: ["ownerAgents", "safetyPosture"]
    }
  ];
  const statusForOutcome = (outcome: ProductionIncidentReleaseGateOutcome): ProductionIncidentSimulation["status"] =>
    outcome === "promote" ? "pass" : outcome === "hold" ? "warning" : "blocker";
  const outcomeForDecision = (decision: EnterpriseReleaseDecision): ProductionIncidentReleaseGateOutcome => {
    if (decision === "emergency-stop") return "needs-human-approval";
    if (decision === "rollback") return "rollback-only";
    if (decision === "no-go") return "hold";
    return "promote";
  };
  const timeline = (
    scenarioName: ProductionIncidentSimulationScenarioName,
    owner: string,
    detection: string,
    mitigation: string,
    rollback: string,
    proofCommand: string
  ): ProductionIncidentTimelineEvent[] => [
    { minute: 0, phase: "detect", event: detection, owner, evidence: "alert ids, metric names, run ids, and counts only" },
    { minute: 5, phase: "triage", event: `classify ${scenarioName} against release gate and owner matrix`, owner: "Agent 10", evidence: "incidentSimulationPostmortems.simulations[].releaseGateOutcome" },
    { minute: 15, phase: "mitigate", event: mitigation, owner, evidence: "bounded dry-run controls and queue/source/evidence ids only" },
    { minute: 30, phase: "rollback", event: rollback, owner: "Agent 10", evidence: "rollback command text and last-known-good image/manifest ids only" },
    { minute: 45, phase: "verify", event: `run ${proofCommand}`, owner: "Agent 10", evidence: "proof command status, route status, hashes, and aggregate metrics only" },
    { minute: 60, phase: "postmortem", event: "complete postmortem fields and assign owner follow-ups before promotion resumes", owner: "Agent 10", evidence: "postmortem field checklist with no raw evidence" }
  ];
  const safetyPosture: ProductionIncidentSimulation["safetyPosture"] = {
    metadataOnly: true,
    noRawLeakMaterial: true,
    noCredentials: true,
    noUnsafeUrls: true,
    noActorInteraction: true,
    browserWorkersDisabled: true
  };
  const noLeakProof = "simulation output uses ids, counts, hashes, statuses, cursors, metric names, and proof commands only; it excludes raw bodies, object keys, credentials, unsafe URLs, private material, and actor-interaction content";
  const publicProofStatus = proofStatusFromObservabilityMetric(observabilityDashboard, "public_proof_matrix");
  const memoryDiskOutcome: ProductionIncidentReleaseGateOutcome = input.trends.resources.memoryRssMaxGb > 160
    || input.promotionPacket.resourceBudget.nonScraperReservedGb < 500
    ? "rollback-only"
    : input.trends.resources.memoryRssMaxGb > 96
      || input.trends.queuePressure.p95Seconds > 120
      ? "hold"
      : "promote";
  const simulation = (
    name: ProductionIncidentSimulationScenarioName,
    sourceRunbookName: ProductionIncidentRunbookName | undefined,
    outcome: ProductionIncidentReleaseGateOutcome,
    detectionSignals: string[],
    publicTiState: ProductionIncidentSimulation["blastRadius"]["publicTiState"],
    affectedServices: string[],
    affectedAgents: string[],
    dataIntegrity: ProductionIncidentSimulation["blastRadius"]["dataIntegrity"],
    userVisibleDegradation: string,
    ownerAgents: string[],
    rollbackAction: string,
    proofCommand: string,
    mitigation: string
  ): ProductionIncidentSimulation => {
    const runbook = sourceRunbookName ? runbookByName.get(sourceRunbookName) : undefined;
    return {
      name,
      status: statusForOutcome(outcome),
      releaseGateOutcome: outcome,
      detectionSignals,
      timeline: timeline(
        name,
        ownerAgents[0] ?? "Agent 10",
        runbook?.trigger ?? detectionSignals[0] ?? `${name} detected`,
        mitigation,
        rollbackAction,
        proofCommand
      ),
      blastRadius: {
        publicTiState,
        affectedServices,
        affectedAgents,
        dataIntegrity
      },
      userVisibleDegradation,
      safetyPosture,
      ownerAgents,
      rollbackAction,
      proofCommand,
      postmortemFields: postmortemFields(name),
      noLeakProof
    };
  };
  const simulations: ProductionIncidentSimulation[] = [
    simulation(
      "queue_saturation",
      "queue_saturation",
      outcomeForDecision(scenarioByName.get("high_activity_actor_burst")?.releaseDecision ?? "promote-with-warnings"),
      ["queue p95 above SLO", "retry debt increasing", "duplicate run reuse still active", "frontier fairness pressure"],
      "partial",
      ["queue_backend", "scraper", "public_api_wrapper"],
      ["Agent 02", "Agent 09", "Agent 10"],
      "preserved",
      "public /ti remains partial or Searching with 3s polling and no stale ready wording",
      ["Agent 02", "Agent 09", "Agent 10"],
      "activate low-priority drain, cap polling, and pause broad actor sweeps",
      "bun test src/tests/schedulerProduction.test.ts",
      "shift capacity to interactive actor search while preserving cursor continuity"
    ),
    simulation(
      "source_outage_wave",
      "source_outage_wave",
      outcomeForDecision(scenarioByName.get("source_outage_wave")?.releaseDecision ?? "no-go"),
      ["source unavailable rate above SLO", "coverage gap expands", "freshness SLO burn", "source health degraded"],
      "partial",
      ["scraper", "source_registry", "public_signal_fusion"],
      ["Agent 01", "Agent 04", "Agent 10"],
      "preserved",
      "answers keep source outage caveats and avoid promoting stale source families",
      ["Agent 01", "Agent 04", "Agent 10"],
      "quarantine failing sources and keep last-known-good public evidence with caveats",
      "bun test src/tests/sourceSeeds.test.ts src/tests/publicSignalFusion.test.ts",
      "pause unavailable sources and route source-pack repair to governance"
    ),
    simulation(
      "parser_failure_spike",
      "parser_failure_spike",
      outcomeForDecision(scenarioByName.get("parser_failure_spike")?.releaseDecision ?? "no-go"),
      ["parser warning rate spikes", "quality readiness holds", "adapter failure taxonomy changes", "low extraction confidence"],
      "partial",
      ["scraper", "adapter_runtime", "quality_evaluation"],
      ["Agent 03", "Agent 07", "Agent 10"],
      "preserved",
      "public output stays partial with parser caveats until extraction proof recovers",
      ["Agent 03", "Agent 07", "Agent 10"],
      "disable affected parser profile or source family until fresh extraction proof passes",
      "bun test src/tests/pipeline.test.ts src/tests/adapterFailureObservatory.test.ts",
      "hold ready wording and route parser repair plus quality regression fixtures"
    ),
    simulation(
      "evidence_object_degradation",
      "evidence_store_degradation",
      outcomeForDecision(runbookByName.get("evidence_store_degradation")?.releaseDecisionImpact ?? "rollback"),
      ["evidence write/read proof warning", "object manifest mismatch", "cursor replay gap", "claim ledger replay hold"],
      "searching",
      ["evidence_object_store", "scraper", "graph_backend"],
      ["Agent 06", "Agent 08", "Agent 10"],
      "restore_required",
      "promotion stops and discovery metadata remains separate until evidence replay verifies",
      ["Agent 06", "Agent 08", "Agent 10"],
      "restore latest evidence manifest and replay claim ledger before re-enabling promotion",
      "bun test src/tests/storage.test.ts src/tests/storageCutover.test.ts",
      "stop evidence promotion and run backup manifest verification"
    ),
    simulation(
      "graph_export_corruption",
      "graph_export_corruption",
      outcomeForDecision(scenarioByName.get("graph_export_backlog")?.releaseDecision ?? "rollback"),
      ["STIX readiness blocks", "graph drift monitor holds", "missing ledger ids", "contradicted relationship export"],
      "partial",
      ["graph_backend", "stix_export", "evidence_object_store"],
      ["Agent 08", "Agent 06", "Agent 10"],
      "preserved",
      "graph/STIX export pauses while public answer keeps non-export caveats",
      ["Agent 08", "Agent 06", "Agent 10"],
      "rollback graph export queue to last reviewed relationship snapshot",
      "bun test src/tests/graphViews.test.ts src/tests/graphReviewRoutes.test.ts",
      "pause graph/STIX promotion and replay reviewed relationships only"
    ),
    simulation(
      "api_gateway_misrouting",
      "api_wrapper_regression",
      outcomeForDecision(runbookByName.get("api_wrapper_regression")?.releaseDecisionImpact ?? "rollback"),
      ["public wrapper drops run id", "cursor missing", "legacy response compatibility mismatch", "wrong upstream mode"],
      "degraded",
      ["public_api_wrapper", "frontend_ti", "scraper"],
      ["Agent 09", "Agent 10"],
      "preserved",
      "public wrapper falls back or degrades without inventing actor data",
      ["Agent 09", "Agent 10"],
      "restore previous compatibility wrapper path and redeploy hanasand_api",
      "bun run check:api-regression",
      "freeze wrapper rollout and rerun compatibility fixture pack"
    ),
    simulation(
      "public_proof_failure",
      "public_proof_failure",
      publicProofStatus === "pass" ? "promote" : "rollback-only",
      ["public proof matrix warning", "POST proof missing run id", "unknown actor not Searching-only", "frontend stale demo prose"],
      "degraded",
      ["frontend_ti", "public_api_wrapper", "scraper"],
      ["Agent 09", "Agent 10"],
      "preserved",
      "public /ti returns degraded/searching only and keeps outer fallback available",
      ["Agent 09", "Agent 10"],
      "restore previous api public wrapper fallback and redeploy hanasand_api",
      "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof",
      "restore public wrapper fallback and rerun known/random/made-up actor proof"
    ),
    simulation(
      "canary_rollback",
      "canary_rollback",
      outcomeForDecision(runbookByName.get("canary_rollback")?.releaseDecisionImpact ?? "rollback"),
      ["canary activation proof regressed", "native live HTTP missing", "canary extraction count drops", "operator pause required"],
      "partial",
      ["canary_collection", "source_registry", "scraper"],
      ["Agent 07", "Agent 01", "Agent 10"],
      "preserved",
      "canary results stop promotion while public search continues from reviewed evidence",
      ["Agent 07", "Agent 01", "Agent 10"],
      "POST /v1/sources/canary-pause and keep outer fallback active until canary proof is green",
      "bun run check:canary-proof-path",
      "pause canary loop and preserve human-approved source activation"
    ),
    simulation(
      "restricted_emergency_stop",
      "restricted_metadata_emergency_stop",
      input.trends.restrictedKillSwitch.active ? "needs-human-approval" : outcomeForDecision(runbookByName.get("restricted_metadata_emergency_stop")?.releaseDecisionImpact ?? "emergency-stop"),
      ["restricted kill switch active", "proxy isolation failure", "approval expiry", "redaction repair needed"],
      "metadata_review",
      ["restricted_metadata_controls", "analyst_loop", "scraper"],
      ["Agent 05", "Agent 06", "Agent 09", "Agent 10"],
      "preserved",
      "restricted results remain metadata_review or blocked with safe victim/company/count summaries only",
      ["Agent 05", "Agent 06", "Agent 09", "Agent 10"],
      "keep restricted connectors disabled and restore only after approval, proxy, retention, and redaction checks pass",
      "bun run check:restricted-metadata-status",
      "drain restricted metadata workers and require human approval before restore"
    ),
    simulation(
      "memory_disk_pressure",
      undefined,
      memoryDiskOutcome,
      ["RSS above 96 GB warning target", "RSS above 160 GB rollback ceiling", "CTI reserve below 500 GB", "evidence disk growth above forecast"],
      memoryDiskOutcome === "rollback-only" ? "degraded" : "partial",
      ["scraper", "evidence_object_store", "queue_backend", "graph_backend"],
      ["Agent 02", "Agent 06", "Agent 08", "Agent 10"],
      memoryDiskOutcome === "rollback-only" ? "at_risk" : "preserved",
      "public /ti keeps partial/searching behavior while concurrency, replay, and graph export are reduced",
      ["Agent 02", "Agent 06", "Agent 08", "Agent 10"],
      "reduce collection concurrency, stop replay/export fanout, and keep 500 GB CTI reserve before resuming promotion",
      "bun test src/tests/ops.test.ts",
      "shed non-interactive work and preserve disk-first evidence manifests"
    )
  ];
  const releaseGateCounts = simulations.reduce((counts, item) => {
    counts[item.releaseGateOutcome] += 1;
    return counts;
  }, {
    promote: 0,
    hold: 0,
    "rollback-only": 0,
    "needs-human-approval": 0
  } satisfies Record<ProductionIncidentReleaseGateOutcome, number>);
  const owners = uniqueStrings(simulations.flatMap((item) => item.ownerAgents));
  const ownerMatrix = owners.map((owner) => ({
    owner,
    scenarios: simulations.filter((item) => item.ownerAgents.includes(owner)).map((item) => item.name),
    proofCommands: uniqueStrings(simulations.filter((item) => item.ownerAgents.includes(owner)).map((item) => item.proofCommand))
  }));
  return {
    schemaVersion: "ti.production_incident_simulation_postmortem.v1",
    dryRun: true,
    generatedAt: input.generatedAt ?? "dry-run",
    resourcePolicy: {
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    },
    simulations,
    releaseGateCounts,
    ownerMatrix,
    proofCommands: uniqueStrings([
      "bun test src/tests/ops.test.ts",
      "bun test src/tests/api.test.ts src/tests/schedulerProduction.test.ts",
      "bun run check",
      "bun run check:ti-release-candidate",
      "bun run check:deploy-hygiene",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      ...simulations.map((item) => item.proofCommand)
    ]),
    operatorRunbook: [
      "run incidentSimulationPostmortems before promotion and after any rollback-only proof",
      "treat hold outcomes as release blockers until the owning agent records the proof command output",
      "rollback-only means restore last-known-good public wrapper, scraper image, evidence manifest, or graph export snapshot before widening traffic",
      "needs-human-approval means restricted metadata controls remain disabled until legal/operator approval is recorded",
      "keep the scraper under 96 GB target, never exceed the 160 GB ceiling, and preserve 500 GB for the broader CTI stack",
      "postmortems may include ids, counts, hashes, cursors, and metric names only; never include raw bodies, object keys, credentials, unsafe URLs, private material, or actor-interaction content"
    ]
  };
}

function buildMultiServiceDependencyRollbackDrillPacket(
  input: CutoverSoakReleasePacketInput,
  observabilityDashboard: ProductionObservabilityDashboardPacket,
  enterpriseReleaseTrain: EnterpriseReleaseTrainPacket,
  incidentRunbooks: ProductionIncidentRunbookPacket
): MultiServiceDependencyRollbackDrillPacket {
  const depStatus = (name: EnterpriseReleaseTrainPacket["dependencyHealth"][number]["name"]): "pass" | "warning" | "blocker" =>
    enterpriseReleaseTrain.dependencyHealth.find((item) => item.name === name)?.status ?? "blocker";
  const proof = (surface: string, proofCommand: string, expectedOutput: string): DependencyDrillRouteProof => ({
    surface,
    proofCommand,
    expectedOutput
  });
  const routeInventoryProof = proof("/v1/health and /v1/metrics", "bun run check:route-inventory", "mounted routes return compact health, metrics, and no raw payload fields");
  const noLeakGuarantee = "health and rollback proof uses ids, counts, hashes, cursors, status, and aggregate metrics only";
  const service = (
    name: DependencyDrillServiceName,
    status: "pass" | "warning" | "blocker",
    healthCheck: string,
    failureSymptoms: string[],
    operatorActions: string[],
    rollbackAction: string,
    routeProof: DependencyDrillRouteProof[],
    userVisibleDegradation: string
  ): DependencyHealthService => ({
    name,
    status,
    healthCheck,
    failureSymptoms,
    operatorActions,
    rollbackAction,
    routeProof,
    userVisibleDegradation,
    noLeakGuarantee
  });
  const services: DependencyHealthService[] = [
    service(
      "scraper",
      depStatus("scraper"),
      "typecheck, local tests, resource snapshot, and scraper-native search proof",
      ["RSS above 96 GB warning target", "queue p95 above soak threshold", "worker saturation above release budget"],
      ["reduce collection concurrency", "pause broad actor sweeps", "keep browser workers disabled"],
      "redeploy last-known-good ti-scraper image and drain queues before widening intake",
      [
        proof("scraper typecheck", "bun run check", "TypeScript contracts compile without route or DTO drift"),
        proof("/v1/ops/resource-snapshot", "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot", "resource snapshot stays under 96 GB target and 160 GB ceiling")
      ],
      "public searches stay searching or partial with honest queue/backpressure caveats"
    ),
    service(
      "public_api_wrapper",
      depStatus("api"),
      "public POST wrapper proof plus API regression and contract index",
      ["public POST loses status/run/cursor fields", "SDK fixture compatibility drifts", "gateway routes to stale fallback"],
      ["freeze wrapper rollout", "restore previous compatibility path", "rerun known/random/made-up proof"],
      "restore previous public wrapper fallback and redeploy hanasand_api",
      [
        proof("public POST /api/ti/search", "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "HTTP 200 with stable live state, run id, cursor, and no leaked payload"),
        proof("/v1/contracts", "bun run check:contract-index", "contract index preserves wrapper and polling semantics")
      ],
      "frontend shows partial/degraded status instead of hiding scraper-native work"
    ),
    service(
      "frontend_ti",
      depStatus("frontend"),
      "frontend /ti live-search deployment proof",
      ["/ti cannot render live states", "polling stops advancing cursors", "answer caveats disappear"],
      ["keep API polling contract stable", "serve fallback queued state", "rerun live-search deploy probe"],
      "roll back frontend bundle while preserving public API wrapper path",
      [
        proof("frontend /ti", "bun run check:live-search-deploy", "/ti renders searching/partial/ready/degraded states with compact proof"),
        routeInventoryProof
      ],
      "users see queued/searching cards with retry guidance and no unverified ready wording"
    ),
    service(
      "postgres_source_registry",
      worstProofStatus([depStatus("source_freshness"), depStatus("contract_index")]),
      "source registry backup, governance audit, and source coverage contracts",
      ["approved sources disappear", "legal/governance notes are stale", "source activation packets cannot replay"],
      ["hold source activation", "restore registry snapshot", "rerun governance audit"],
      "restore source registry snapshot and keep medium/high/restricted sources approval-gated",
      [
        proof("/v1/sources/coverage-closeout", "bun run check:source-apply-plan", "source remediation remains dry-run and non-mutating"),
        proof("source registry backup", "bun test src/tests/sourceSeeds.test.ts", "seed/source snapshots replay ids, status, legal notes, and hashes only")
      ],
      "coverage gaps are visible and answers remain partial with source-caveat rows"
    ),
    service(
      "evidence_object_store",
      depStatus("evidence_writes"),
      "evidence write/read proof, replay plan, and immutable manifest check",
      ["evidence write/read proof fails", "object hashes cannot replay", "claim ledger promotion lacks evidence lineage"],
      ["stop evidence promotion", "run backup manifest verification", "keep discovery metadata separate"],
      "restore latest evidence manifest and replay claim ledger before public-ready promotion",
      [
        proof("/v1/evidence/replay-plan", "bun test src/tests/storageCutover.test.ts", "replay plan exposes capture ids, hashes, deltas, and no object keys"),
        proof("/v1/evidence/cutover-report", "bun test src/tests/evidenceEndpoints.test.ts", "cutover report preserves immutable lineage")
      ],
      "answers keep evidence-pending caveats and do not promote unverified claims"
    ),
    service(
      "opensearch_vector_handoff",
      depStatus("evidence_writes"),
      "evidence search/vector handoff document validation",
      ["safe summaries fail indexing", "embedding eligibility includes restricted metadata", "search backend replay cursor stalls"],
      ["hold vector promotion", "index metadata-only documents without embeddings", "rebuild from evidence handoff cursor"],
      "disable vector-backed ranking and fall back to lexical/public evidence ordering",
      [
        proof("evidence search handoff", "bun test src/tests/storageCutover.test.ts src/tests/ops.test.ts", "handoff documents contain hashes, summaries, eligibility, and no raw bodies"),
        routeInventoryProof
      ],
      "search quality may degrade, but public answers stay metadata-only and citation-backed"
    ),
    service(
      "graph_backend",
      depStatus("graph_export_holds"),
      "graph review mounted proof and STIX/export readiness",
      ["graph export readiness blocks", "reviewed relationship replay fails", "STIX subset includes held facts"],
      ["pause graph/STIX export", "replay reviewed relationships", "require ledger-complete proof"],
      "rollback graph export queue to last reviewed relationship snapshot",
      [
        proof("/v1/graph/review-plan", "bun run check:graph-review-mounted", "graph review plan reports holds, actions, and provenance ids"),
        proof("/v1/exports/stix", "bun test src/tests/graphViews.test.ts src/tests/graphReviewRoutes.test.ts", "STIX readiness excludes weak, stale, contradicted, or missing-ledger facts")
      ],
      "graph panels show held/degraded relationship state while answers avoid unsupported graph claims"
    ),
    service(
      "queue_backend",
      depStatus("queue_headroom"),
      "scheduler queue SLO, drain plan, stale lease recovery, and cursor continuity",
      ["queue p95 exceeds threshold", "retry debt grows", "dead letters block freshness"],
      ["pause low-priority intake", "drain leased work", "preserve run reuse and cursors"],
      "return public search to queued-only partial responses until queue p95 recovers",
      [
        proof("/v1/frontier/status", "bun run check:frontier-apply-plan", "dry-run drain plan preserves queue ids, run reuse, and cursor replay"),
        proof("/v1/intel/search.scheduler", "bun test src/tests/schedulerProduction.test.ts", "scheduler summaries expose queue age, retry debt, and fairness state")
      ],
      "users see searching/partial responses with retry-after guidance instead of stale ready answers"
    ),
    service(
      "canary_collection",
      enterpriseReleaseTrain.stages.find((stage) => stage.name === "canary_ready")?.status ?? "blocker",
      "canary activation, run, pause, and native live HTTP proof",
      ["canary source activation applies unexpectedly", "native proof falls back to injected fixtures", "operator pause fails"],
      ["pause canary loop", "keep activation human-approved", "rerun canary proof path"],
      "POST /v1/sources/canary-pause and keep outer fallback active until canary proof is green",
      [
        proof("/v1/ops/canary", "bun run check:canary-proof-path", "canary proof uses active approved sources and native live HTTP when required"),
        proof("/v1/ops/canary/console", "bun test src/tests/api.test.ts", "operator console reports approval state and safe extraction metrics")
      ],
      "canary-only findings stay partial and are not promoted into public ready answers"
    ),
    service(
      "restricted_metadata_controls",
      depStatus("restricted_metadata_safety"),
      "restricted metadata status, apply-plan, kill switch, retention, and redaction proof",
      ["restricted kill switch active", "approval backlog exceeds queue health budget", "apply-plan would mutate or fetch unsafe target"],
      ["activate emergency stop", "drain restricted workers", "require human approval before restore"],
      "keep restricted connectors disabled until approval, proxy, retention, and redaction checks pass",
      [
        proof("/v1/restricted-metadata/status", "bun run check:restricted-metadata-status", "restricted status reports kill switch, isolation, approval, retention, and redaction state"),
        proof("/v1/restricted-metadata/apply-plan", "bun run check:restricted-metadata-apply-plan", "apply plan remains dry-run and metadata-only")
      ],
      "restricted results remain metadata_review or blocked with safe victim/company/count summaries only"
    )
  ];
  const scenario = (
    name: DependencyDrillScenarioName,
    trigger: string,
    affectedServices: DependencyDrillServiceName[],
    firstOperatorAction: string,
    rollbackOrder: DependencyDrillServiceName[],
    routeProof: DependencyDrillRouteProof[],
    expectedUserState: DependencyRollbackDrillScenario["expectedUserState"],
    releaseDecisionImpact: EnterpriseReleaseDecision
  ): DependencyRollbackDrillScenario => ({
    name,
    trigger,
    affectedServices,
    firstOperatorAction,
    rollbackOrder,
    routeProof,
    expectedUserState,
    releaseDecisionImpact,
    noLeakGuarantees: [
      noLeakGuarantee,
      "operators must not fetch restricted targets, raw leaked rows, credentials, private-source material, or actor-interaction content",
      "rollback manifests expose hashes, ids, cursors, and DTO summaries only"
    ]
  });
  const serviceProofs = (names: DependencyDrillServiceName[]) =>
    services.filter((item) => names.includes(item.name)).flatMap((item) => item.routeProof);
  const scenarios: DependencyRollbackDrillScenario[] = [
    scenario(
      "queue_saturation",
      `queue p95 ${input.trends.queuePressure.p95Seconds}s or queue headroom status ${depStatus("queue_headroom")}`,
      ["scraper", "queue_backend", "public_api_wrapper", "frontend_ti"],
      "pause low-priority intake, cap public polling, and drain scheduler leases",
      ["queue_backend", "scraper", "public_api_wrapper", "frontend_ti"],
      serviceProofs(["queue_backend", "scraper"]),
      "searching",
      "no-go"
    ),
    scenario(
      "source_outage_wave",
      `source unavailable proof is ${proofStatusFromObservabilityMetric(observabilityDashboard, "source_unavailable_rate_percent")}`,
      ["postgres_source_registry", "scraper", "public_api_wrapper", "frontend_ti"],
      "quarantine unavailable sources and keep stale-source caveats visible",
      ["postgres_source_registry", "scraper", "public_api_wrapper", "frontend_ti"],
      serviceProofs(["postgres_source_registry", "public_api_wrapper"]),
      "partial",
      "no-go"
    ),
    scenario(
      "parser_failure_spike",
      "parser confidence or extraction quality drops below release gate",
      ["scraper", "postgres_source_registry", "evidence_object_store", "public_api_wrapper"],
      "hold ready wording and route parser repair to Agent 03/07",
      ["scraper", "postgres_source_registry", "evidence_object_store", "public_api_wrapper"],
      [
        proof("/v1/quality/evaluate", "bun test src/tests/pipeline.test.ts", "quality DTOs expose parser/quality holds without raw evidence"),
        proof("adapter observatory fixtures", "bun test src/tests/adapterFailureObservatory.test.ts src/tests/adapterFixtures.test.ts", "adapter failures are categorized by safe class")
      ],
      "partial",
      "no-go"
    ),
    scenario(
      "evidence_object_degradation",
      `evidence object proof status ${depStatus("evidence_writes")}`,
      ["evidence_object_store", "opensearch_vector_handoff", "graph_backend", "public_api_wrapper"],
      "stop evidence promotion and run manifest replay before answer/graph promotion",
      ["evidence_object_store", "opensearch_vector_handoff", "graph_backend", "public_api_wrapper"],
      serviceProofs(["evidence_object_store", "opensearch_vector_handoff"]),
      "partial",
      "rollback"
    ),
    scenario(
      "graph_export_corruption",
      `graph export status ${depStatus("graph_export_holds")}`,
      ["graph_backend", "evidence_object_store", "public_api_wrapper", "frontend_ti"],
      "pause graph/STIX export and replay reviewed relationships only",
      ["graph_backend", "evidence_object_store", "public_api_wrapper", "frontend_ti"],
      serviceProofs(["graph_backend"]),
      "partial",
      "rollback"
    ),
    scenario(
      "api_gateway_misrouting",
      "gateway serves stale public wrapper, wrong tenant, or non-scraper fallback while native proof is required",
      ["public_api_wrapper", "frontend_ti", "scraper"],
      "freeze gateway rollout, restore previous route map, and rerun POST plus /ti proof",
      ["public_api_wrapper", "frontend_ti", "scraper"],
      serviceProofs(["public_api_wrapper", "frontend_ti"]),
      "degraded",
      "rollback"
    ),
    scenario(
      "public_proof_failure",
      `public proof matrix status ${proofStatusFromObservabilityMetric(observabilityDashboard, "public_proof_matrix")}`,
      ["public_api_wrapper", "frontend_ti", "scraper", "canary_collection"],
      "restore public wrapper fallback and keep scraper-native search canary-only",
      ["public_api_wrapper", "frontend_ti", "scraper", "canary_collection"],
      serviceProofs(["public_api_wrapper", "frontend_ti", "canary_collection"]),
      "degraded",
      "rollback"
    ),
    scenario(
      "canary_rollback",
      "canary activation, native live HTTP, or operator pause proof regresses",
      ["canary_collection", "postgres_source_registry", "scraper", "public_api_wrapper"],
      "pause canary, preserve human-approved activation boundary, and rerun proof path",
      ["canary_collection", "postgres_source_registry", "scraper", "public_api_wrapper"],
      serviceProofs(["canary_collection", "postgres_source_registry"]),
      "partial",
      "rollback"
    ),
    scenario(
      "container_rollback",
      `deployment drift state ${input.deploymentDrift.state} or Docker dependency status ${depStatus("docker")}`,
      ["scraper", "public_api_wrapper", "frontend_ti", "queue_backend", "evidence_object_store"],
      "redeploy last-known-good containers, verify route inventory, then reopen queues",
      ["frontend_ti", "public_api_wrapper", "scraper", "queue_backend", "evidence_object_store"],
      [
        proof("docker compose", "bun run check:deploy-hygiene && bun run check:docker-contexts", "compose, Dockerfile, memory, evidence volume, and context limits are valid"),
        routeInventoryProof
      ],
      "degraded",
      "rollback"
    )
  ];
  return {
    schemaVersion: "ti.multi_service_dependency_rollback_drill.v1",
    dryRun: true,
    generatedAt: input.generatedAt ?? "dry-run",
    resourceBudget: {
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    },
    services,
    scenarios,
    rollbackOrder: ["restricted_metadata_controls", "canary_collection", "frontend_ti", "public_api_wrapper", "scraper", "queue_backend", "graph_backend", "opensearch_vector_handoff", "evidence_object_store", "postgres_source_registry"],
    integrations: {
      agent01Governance: "wired",
      agent02Scheduler: "wired",
      agent03Adapters: "wired",
      agent04PublicCorrelation: "wired",
      agent05RestrictedMetadata: "wired",
      agent06EvidenceChain: "wired",
      agent07Quality: "wired",
      agent08Graph: "wired",
      agent09ApiCompatibility: "wired",
      agent10Operations: "wired"
    },
    proofCommands: uniqueStrings([
      "bun test src/tests/ops.test.ts",
      "bun test src/tests/api.test.ts src/tests/schedulerProduction.test.ts",
      "bun run check",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      "bun run check:deploy-hygiene",
      "bun run check:docker-contexts",
      "bun run check:canary-proof-path",
      ...services.flatMap((item) => item.routeProof.map((proofItem) => proofItem.proofCommand)),
      ...scenarios.flatMap((item) => item.routeProof.map((proofItem) => proofItem.proofCommand)),
      ...incidentRunbooks.proofCommands
    ]),
    operatorRunbook: [
      "identify the failing service from services[].healthCheck before rolling back broader stacks",
      "rollback in dependency order and verify the routeProof rows after each step",
      "keep scraper target at 96 GB, treat 160 GB as rollback ceiling, and preserve 500 GB for API/frontend/DB/search/graph/object-store headroom",
      "keep browser workers disabled and do not assume GPU availability",
      "degrade user-visible /ti state to searching, partial, metadata_review, or degraded rather than publishing unverified ready answers"
    ]
  };
}

function buildEnterpriseSoakReleaseArtifactBundlePacket(
  input: CutoverSoakReleasePacketInput,
  rcBoard: FinalRcBoardPacket,
  productTiBoard: ProductTiReleaseBoardPacket,
  realTimeSearchBoard: RealTimeSearchReleaseBoardPacket,
  observabilityDashboard: ProductionObservabilityDashboardPacket,
  enterpriseReleaseTrain: EnterpriseReleaseTrainPacket,
  capacitySimulation: CapacityCostSimulationPacket,
  incidentRunbooks: ProductionIncidentRunbookPacket,
  dependencyRollbackDrill: MultiServiceDependencyRollbackDrillPacket,
  releaseBlockers: CutoverSoakReleasePacket["blockers"],
  releaseWarnings: CutoverSoakReleasePacket["warnings"]
): EnterpriseSoakReleaseArtifactBundlePacket {
  const dep = (name: EnterpriseReleaseTrainPacket["dependencyHealth"][number]["name"]) =>
    enterpriseReleaseTrain.dependencyHealth.find((item) => item.name === name)?.status ?? "blocker";
  const metric = (name: ProductionObservabilityMetricName) =>
    observabilityDashboard.sloDashboard.metrics.find((item) => item.name === name)?.status ?? "blocker";
  const dependencyStatus = worstProofStatus(dependencyRollbackDrill.services.map((service) => service.status));
  const resourceStatus: ReleaseArtifactGate["status"] = enterpriseReleaseTrain.capacityPlan.status === "blocker" || input.soak.summary.memoryRssMaxGb > 160 || input.promotionPacket.resourceBudget.nonScraperReservedGb < 500
    ? "blocker"
    : enterpriseReleaseTrain.capacityPlan.status === "warning" || input.soak.summary.memoryRssMaxGb > 96
      ? "warning"
      : "pass";
  const gate = (
    name: ReleaseArtifactGateName,
    owner: string,
    status: ReleaseArtifactGate["status"],
    proofCommand: string,
    evidenceSource: string,
    noLeakProof: string,
    blocker?: string
  ): ReleaseArtifactGate => ({
    name,
    owner,
    status,
    proofCommand,
    evidenceSource,
    noLeakProof,
    ...(blocker ? { blocker } : {})
  });
  const gates: ReleaseArtifactGate[] = [
    gate("route_inventory", "Agent 09", dep("route_inventory"), "bun run check:route-inventory", "route inventory mounted route proof", "route names, HTTP status, and response keys only"),
    gate("contract_index", "Agent 09", dep("contract_index"), "bun run check:contract-index", "/v1/contracts route truth and compatibility index", "schema names, route signatures, fixture names, and stable fields only"),
    gate("api_regression", "Agent 09", dep("contract_index"), "bun run check:api-regression", "API regression sentinel and public wrapper compatibility fixtures", "stable keys, error codes, and polling fields only"),
    gate("sdk_fixtures", "Agent 09", dep("contract_index"), "bun run check:sdk-fixtures", "SDK fixture pack and client compatibility matrix", "metadata-only JSON fixtures without raw bodies or secrets"),
    gate("deploy_hygiene", "Agent 10", dep("docker"), "bun run check:deploy-hygiene && bun run check:docker-contexts", "Dockerfile, compose, memory, evidence volume, and context checks", "image/config hashes, paths, limits, and health names only"),
    gate("canary_readiness_soak", "Agent 07/10", enterpriseReleaseTrain.stages.find((stage) => stage.name === "canary_ready")?.status ?? "blocker", "bun run check:canary-proof-path", "canary readiness, soak, native live HTTP, and operator controls", "source ids, capture ids, hashes, run ids, and readiness reasons only"),
    gate("public_proof", "Agent 09/10", dep("public_proof_matrix"), "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "public /ti and POST /api/ti/search proof matrix", "query, HTTP status, run id, cursor, and live state only"),
    gate("scheduler_status", "Agent 02", dep("queue_headroom"), "bun test src/tests/schedulerProduction.test.ts", "scheduler status, queue economics, drain, retry, and cursor continuity", "queue ids, run ids, retry causes, ages, and cursors only"),
    gate("restricted_metadata_audit", "Agent 05", dep("restricted_metadata_safety"), "bun run check:restricted-metadata-status && bun run check:restricted-metadata-apply-plan", "restricted metadata audit, kill switch, approval, retention, and redaction proof", "source hashes, claim ids, counts, review states, and redaction flags only"),
    gate("evidence_chain", "Agent 06", dep("evidence_writes"), "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts", "evidence chain, replay, backup/restore, claim-ledger lineage, and object durability", "capture ids, object hashes, manifest ids, ledger ids, and replay cursors only"),
    gate("graph_stix_readiness", "Agent 08", dep("graph_export_holds"), "bun run check:graph-review-mounted", "graph review, cost controls, drift holds, and STIX readiness", "relationship ids, review states, blocker codes, and STIX-safe descriptors only"),
    gate("source_portfolio_readiness", "Agent 01/04", dep("source_freshness"), "bun test src/tests/sourceSeeds.test.ts src/tests/publicSignalFusion.test.ts", "source portfolio, source packs, public signal reliability, and coverage readiness", "source ids, canonical hashes, coverage class, and governance status only"),
    gate("dependency_rollback_drill", "Agent 10", dependencyStatus, "bun test src/tests/ops.test.ts", "multi-service dependency rollback drill", "service names, health states, proof commands, and rollback order only"),
    gate("resource_budget", "Agent 10", resourceStatus, "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot", "96 GB scraper target, 160 GB ceiling, 500 GB CTI reserve, browser-disabled and no-GPU budget", "aggregate GB, worker counts, queue depth, and budget states only"),
    gate("public_ti_expectations", "Agent 07/09/10", realTimeSearchBoard.pollingSlo.status, "bun run check:scraper-native-search", "public /ti semantics for no default actor, unknown searching, fast partial updates, and no demo/cache prose", "status, warnings, cursors, safe summaries, and no raw evidence")
  ];
  const dimension = (
    name: ReleaseArtifactSoakDimensionName,
    status: ReleaseArtifactSoakDimension["status"],
    metricValue: string,
    proofCommand: string,
    owner: string
  ): ReleaseArtifactSoakDimension => ({
    name,
    status,
    metric: metricValue,
    proofCommand,
    releaseImpact: status === "blocker" ? "hold" : status === "warning" ? "warning" : "promote",
    owner
  });
  const sourceOutage = capacitySimulation.scenarios.find((scenario) => scenario.name === "source_outage_wave");
  const parserFailure = capacitySimulation.scenarios.find((scenario) => scenario.name === "parser_failure_spike");
  const graphBacklog = capacitySimulation.scenarios.find((scenario) => scenario.name === "graph_export_backlog");
  const soakEvidence: ReleaseArtifactSoakDimension[] = [
    dimension("queue_health", metric("queue_age_p95_seconds"), `${input.soak.summary.queueAgeP95Seconds}s p95 queue age`, "bun test src/tests/schedulerProduction.test.ts", "Agent 02"),
    dimension("freshness_slo", input.trends.sourceSlo.deltaPercent < 0 ? "warning" : "pass", `${input.trends.sourceSlo.minCoveragePercent}% min coverage, delta ${input.trends.sourceSlo.deltaPercent}%`, "bun test src/tests/sourceSeeds.test.ts src/tests/publicSignalFusion.test.ts", "Agent 01/04"),
    dimension("source_outage_wave", sourceOutage?.status ?? "blocker", `decision ${sourceOutage?.releaseDecision ?? "no-go"}`, "bun test src/tests/sourceSeeds.test.ts src/tests/publicSignalFusion.test.ts", "Agent 01/04"),
    dimension("parser_failure_spike", parserFailure?.status ?? "blocker", `decision ${parserFailure?.releaseDecision ?? "no-go"}`, "bun test src/tests/pipeline.test.ts src/tests/adapterFailureObservatory.test.ts", "Agent 03/07"),
    dimension("evidence_object_durability", dep("evidence_writes"), "write/read proof and restore manifests", "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts", "Agent 06"),
    dimension("graph_drift_holds", graphBacklog?.status ?? "blocker", `decision ${graphBacklog?.releaseDecision ?? "rollback"}`, "bun run check:graph-review-mounted", "Agent 08"),
    dimension("api_latency_polling", metric("partial_latency_p95_ms"), `${input.soak.summary.partialLatencyP95Ms}ms p95 partial latency, poll ${realTimeSearchBoard.pollingSlo.recommendedPollSeconds}s`, "bun run check:scraper-native-search", "Agent 07/09/10"),
    dimension("memory_disk_budget", resourceStatus, `${input.soak.summary.memoryRssMaxGb} GB RSS, ${capacitySimulation.aggregate.ctiReserveMinimumGb} GB reserve minimum`, "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot", "Agent 10"),
    dimension("worker_saturation", metric("worker_saturation_percent"), `${input.soak.summary.workerSaturationPercent}% worker saturation`, "bun run soak:production", "Agent 02/10"),
    dimension("incident_rollback_readiness", worstProofStatus([dependencyStatus, ...incidentRunbooks.runbooks.map((runbook) => runbook.releaseDecisionImpact === "emergency-stop" ? "warning" : "pass")]), `${incidentRunbooks.runbooks.length} incident runbooks plus ${dependencyRollbackDrill.scenarios.length} dependency drills`, "bun test src/tests/ops.test.ts", "Agent 10")
  ];
  const publicTiExpectations: ReleaseArtifactPublicExpectation[] = [
    {
      name: "no_default_actor",
      status: productTiBoard.responsivePublicSearch.noDefaultQuery ? "pass" : "blocker",
      proofCommand: "bun run check:scraper-native-search",
      expectedBehavior: "empty or absent query does not render a seeded/default actor answer"
    },
    {
      name: "unknown_searching_only",
      status: realTimeSearchBoard.queryMatrix.find((entry) => entry.query === "made_up_actor")?.status ?? "blocker",
      proofCommand: "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search",
      expectedBehavior: "unknown actor starts as Searching/queued/metadata_review only, not stale demo prose"
    },
    {
      name: "partial_updates_seconds",
      status: realTimeSearchBoard.pollingSlo.status,
      proofCommand: "bun run check:scraper-native-search",
      expectedBehavior: "partial results poll at 3 seconds and reuse the same run/cursor"
    },
    {
      name: "no_stale_demo_cache_prose",
      status: productTiBoard.responsivePublicSearch.noDemoContent && productTiBoard.responsivePublicSearch.honestFreshness ? "pass" : "blocker",
      proofCommand: "bun run check:scraper-native-search",
      expectedBehavior: "answers avoid canned demo/cache copy and expose freshness/caveat fields"
    }
  ];
  const ownerBlockers = [
    ...gates.filter((item) => item.status === "blocker").map((item) => ({
      owner: item.owner,
      gate: item.name,
      blocker: item.blocker ?? `${item.name}_blocked`,
      proofCommand: item.proofCommand
    })),
    ...soakEvidence.filter((item) => item.status === "blocker").map((item) => ({
      owner: item.owner,
      gate: item.name,
      blocker: `${item.name}_blocked`,
      proofCommand: item.proofCommand
    })),
    ...releaseBlockers.map((item) => ({
      owner: item.owner,
      gate: item.name.includes("public_post_api_proof") || item.proofCommand.includes("check:inspur-public-proof")
        ? "public_proof" as const
        : "public_ti_expectations" as const,
      blocker: item.name,
      proofCommand: item.proofCommand
    }))
  ];
  const anyPublicExpectationBlocked = publicTiExpectations.some((item) => item.status === "blocker");
  const anyWarning = releaseWarnings.length > 0 || [...gates, ...soakEvidence, ...publicTiExpectations].some((item) => item.status === "warning");
  const rollbackOnly = resourceStatus === "blocker"
    || dep("docker") === "blocker"
    || dep("public_proof_matrix") === "blocker"
    || releaseBlockers.some((item) => item.name.includes("public_post_api_proof") || item.proofCommand.includes("check:inspur-public-proof") || item.proofCommand.includes("check:deploy-hygiene"))
    || dependencyRollbackDrill.scenarios.some((scenario) => scenario.releaseDecisionImpact === "rollback" && scenario.routeProof.length === 0);
  const decision: ReleaseArtifactBundleDecision = input.trends.restrictedKillSwitch.active
    ? "needs-human-approval"
    : rollbackOnly
      ? "rollback-only"
      : ownerBlockers.length > 0 || anyPublicExpectationBlocked
        ? "hold"
        : anyWarning
          ? "warning"
          : "promote";
  return {
    schemaVersion: "ti.enterprise_soak_release_artifact_bundle.v1",
    dryRun: true,
    generatedAt: input.generatedAt ?? "dry-run",
    decision,
    resourcePolicy: {
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    },
    gates,
    soakEvidence,
    publicTiExpectations,
    ownerBlockers,
    artifactManifest: [
      { artifact: "route inventory", sourcePacket: "check-route-inventory", proofCommand: "bun run check:route-inventory", noLeakBoundary: "routes, status, and response keys only" },
      { artifact: "contract index", sourcePacket: "/v1/contracts", proofCommand: "bun run check:contract-index", noLeakBoundary: "schema names, stable fields, and fixture names only" },
      { artifact: "API regression", sourcePacket: "apiRegressionSentinel", proofCommand: "bun run check:api-regression", noLeakBoundary: "route signatures and compatibility keys only" },
      { artifact: "SDK fixtures", sourcePacket: "fixtures/sdk", proofCommand: "bun run check:sdk-fixtures", noLeakBoundary: "metadata-only JSON fixtures" },
      { artifact: "deploy hygiene", sourcePacket: "deploy hygiene and Docker contexts", proofCommand: "bun run check:deploy-hygiene && bun run check:docker-contexts", noLeakBoundary: "paths, limits, hashes, and health names only" },
      { artifact: "canary readiness/soak", sourcePacket: "canaryExecution and public canary control plane", proofCommand: "bun run check:canary-proof-path", noLeakBoundary: "source ids, run ids, capture ids, and hashes only" },
      { artifact: "public proof", sourcePacket: "public /ti and POST /api/ti/search", proofCommand: "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", noLeakBoundary: "query, status, run id, cursor, and live state only" },
      { artifact: "dependency rollback drill", sourcePacket: "dependencyRollbackDrill", proofCommand: "bun test src/tests/ops.test.ts", noLeakBoundary: "service names, statuses, rollback order, and proof commands only" }
    ],
    proofCommands: uniqueStrings([
      "bun test src/tests/ops.test.ts",
      "bun test src/tests/api.test.ts src/tests/schedulerProduction.test.ts",
      "bun run check",
      "bun run check:ti-release-candidate",
      "bun run check:deploy-hygiene",
      "bun run check:api-regression",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      "bun run check:sdk-fixtures",
      "bun run check:canary-proof-path",
      ...gates.map((item) => item.proofCommand),
      ...soakEvidence.map((item) => item.proofCommand),
      ...publicTiExpectations.map((item) => item.proofCommand)
    ]),
    operatorRunbook: [
      "use releaseArtifactBundle as the leader-review index for release proof, not as a replacement for the underlying commands",
      "promote only when every gate passes or warnings are explicitly accepted by the owning agent",
      "hold on ownerBlockers and run the exact proofCommand listed for the owning gate",
      "rollback-only on public proof, Docker/deploy, dependency rollback, or resource-ceiling blockers",
      "needs-human-approval when restricted emergency-stop or approval-controlled metadata paths are active",
      "keep public /ti honest: no default actor, unknown says Searching only, partial results update in seconds, and stale demo/cache prose stays absent"
    ]
  };
}

function buildMultiServiceResourceArbitrationPacket(
  input: CutoverSoakReleasePacketInput,
  observabilityDashboard: ProductionObservabilityDashboardPacket,
  enterpriseReleaseTrain: EnterpriseReleaseTrainPacket,
  capacitySimulation: CapacityCostSimulationPacket,
  incidentSimulationPostmortems: ProductionIncidentSimulationPostmortemPacket,
  releaseArtifactBundle: EnterpriseSoakReleaseArtifactBundlePacket
): MultiServiceResourceArbitrationPacket {
  const nonScraperReservedGb = enterpriseReleaseTrain.capacityPlan.nonScraperReservedGb;
  const peakMemoryForecastGb = Math.max(input.trends.resources.memoryRssMaxGb, capacitySimulation.aggregate.memoryPeakGb);
  const ctiReserveAfterForecastGb = Math.min(nonScraperReservedGb, capacitySimulation.aggregate.ctiReserveMinimumGb);
  const depStatus = (name: EnterpriseReleaseTrainPacket["dependencyHealth"][number]["name"]): "pass" | "warning" | "blocker" =>
    enterpriseReleaseTrain.dependencyHealth.find((item) => item.name === name)?.status ?? "blocker";
  const publicProofStatus = proofStatusFromObservabilityMetric(observabilityDashboard, "public_proof_matrix");
  const publicProofGateStatus = releaseArtifactBundle.ownerBlockers.some((item) => item.gate === "public_proof")
    ? "blocker"
    : publicProofStatus;
  const lane = (
    name: ResourceArbitrationLaneName,
    owner: string,
    status: ResourceArbitrationLane["status"],
    memoryReservationGb: number,
    memoryCeilingGb: number,
    diskReservationGb: number,
    concurrencyLimit: number,
    throttles: string[],
    proofCommand: string,
    handoff: string
  ): ResourceArbitrationLane => ({
    name,
    owner,
    status,
    memoryReservationGb,
    memoryCeilingGb,
    diskReservationGb,
    concurrencyLimit,
    throttles,
    proofCommand,
    handoff
  });
  const gate = (
    name: ResourceArbitrationGateName,
    status: ResourceArbitrationGate["status"],
    releaseDecision: ReleaseArtifactBundleDecision,
    owner: string,
    signal: string,
    threshold: string,
    proofCommand: string,
    rollbackAction: string
  ): ResourceArbitrationGate => ({ name, status, releaseDecision, owner, signal, threshold, proofCommand, rollbackAction });
  const overCapacityStatus: ResourceArbitrationGate["status"] = peakMemoryForecastGb > 160 || ctiReserveAfterForecastGb < 500
    ? "blocker"
    : peakMemoryForecastGb > 96
      ? "warning"
      : "pass";
  const memoryStatus: ResourceArbitrationGate["status"] = input.trends.resources.memoryRssMaxGb > 160
    ? "blocker"
    : input.trends.resources.memoryRssMaxGb > 96
      ? "warning"
      : "pass";
  const diskStatus: ResourceArbitrationGate["status"] = ctiReserveAfterForecastGb < 500
    ? "blocker"
    : capacitySimulation.aggregate.diskGrowthPeakGb > 80
      ? "warning"
      : "pass";
  const queueStatus: ResourceArbitrationGate["status"] = input.trends.queuePressure.p95Seconds > 300 || depStatus("queue_headroom") === "blocker"
    ? "blocker"
    : input.trends.queuePressure.p95Seconds > 120 || depStatus("queue_headroom") === "warning"
      ? "warning"
      : "pass";
  const sourceOutageStatus: ResourceArbitrationGate["status"] = capacitySimulation.scenarios.find((item) => item.name === "source_outage_wave")?.releaseDecision === "no-go"
    ? "blocker"
    : proofStatusFromObservabilityMetric(observabilityDashboard, "source_unavailable_rate_percent");
  const parserStatus: ResourceArbitrationGate["status"] = capacitySimulation.scenarios.find((item) => item.name === "parser_failure_spike")?.releaseDecision === "no-go"
    ? "blocker"
    : proofStatusFromObservabilityMetric(observabilityDashboard, "adapter_failure_rate_percent");
  const restrictedStatus: ResourceArbitrationGate["status"] = input.trends.restrictedKillSwitch.active || depStatus("restricted_metadata_safety") === "blocker" ? "blocker" : depStatus("restricted_metadata_safety");
  const remoteDeployStatus: ResourceArbitrationGate["status"] = input.deploymentDrift.state === "rollback"
    ? "blocker"
    : input.deploymentDrift.state === "drift"
      ? "warning"
      : "pass";
  const lanes: ResourceArbitrationLane[] = [
    lane("collection_workers", "Agent 03", depStatus("scraper"), 34, 52, 120, 24, ["pause broad actor sweeps", "cap per-source concurrency", "honor source SLO gates"], "bun test src/tests/adapterContracts.test.ts src/tests/adapterRegressionContracts.test.ts", "Agent 03 adapter isolation owns parser/fetch fanout before Agent 10 widens intake"),
    lane("public_channel_workers", "Agent 04", depStatus("source_freshness"), 12, 20, 60, 8, ["defer public-channel windows during queue pressure", "keep unknown actors Searching only"], "bun test src/tests/publicSignalFusion.test.ts", "Agent 04 public-channel reliability feeds source outage and public answer gates"),
    lane("dynamic_browser_disabled_pool", "Agent 03/10", "pass", 0, 0, 0, 0, ["browser workers disabled by default", "dynamic canary requires explicit reallocation"], "bun test src/tests/dynamicBrowserCutover.test.ts", "Agent 10 keeps no-browser default unless main-agent reallocates capacity"),
    lane("evidence_replay", "Agent 06", depStatus("evidence_writes"), 16, 28, 180, 6, ["disk-first replay", "stop promotion on object manifest drift", "legal hold overrides deletion"], "bun test src/tests/storage.test.ts src/tests/storageCutover.test.ts", "Agent 06 evidence replay owns manifest, retention, and restore pressure"),
    lane("graph_search_migration", "Agent 08/06", depStatus("graph_export_holds"), 18, 30, 180, 4, ["pause STIX export first", "rebuild search/vector aliases from replay cursors"], "bun test src/tests/graphViews.test.ts src/tests/graphReviewRoutes.test.ts src/tests/storageCutover.test.ts", "Agent 08 graph drift and Agent 06 index replay share migration budget"),
    lane("queue_backend", "Agent 02", queueStatus, 10, 18, 40, 12, ["drain low-priority work", "preserve run reuse", "recover stale leases before widening"], "bun test src/tests/schedulerProduction.test.ts", "Agent 02 queue backend owns fairness and lease saturation signals"),
    lane("api_live_search_load", "Agent 09", worstProofStatus([publicProofGateStatus, depStatus("api")]), 6, 12, 20, 200, ["cap polling at 3s", "keep public wrapper fallback", "never synthesize default actor"], "bun run check:api-regression", "Agent 09 public API compatibility owns wrapper load and public proof stability")
  ];
  const gates: ResourceArbitrationGate[] = [
    gate("over_capacity", overCapacityStatus, overCapacityStatus === "blocker" ? "rollback-only" : overCapacityStatus === "warning" ? "hold" : "promote", "Agent 10", `peak=${peakMemoryForecastGb}GB reserve=${ctiReserveAfterForecastGb}GB`, "peak <=160 GB and reserve >=500 GB; warning above 96 GB target", "bun test src/tests/ops.test.ts", "reduce collection/replay/graph lanes until reserve and memory return inside policy"),
    gate("memory_pressure", memoryStatus, memoryStatus === "blocker" ? "rollback-only" : memoryStatus === "warning" ? "hold" : "promote", "Agent 10", `rss=${input.trends.resources.memoryRssMaxGb}GB`, "target <=96 GB, ceiling <=160 GB", "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot", "stop browser/dynamic work, reduce worker pools, and roll back before 160 GB"),
    gate("disk_pressure", diskStatus, diskStatus === "blocker" ? "rollback-only" : diskStatus === "warning" ? "hold" : "promote", "Agent 06/10", `diskGrowthPeak=${capacitySimulation.aggregate.diskGrowthPeakGb}GB reserve=${ctiReserveAfterForecastGb}GB`, "preserve at least 500 GB for broader CTI stack", "bun test src/tests/storageCutover.test.ts", "pause evidence replay/search migration and compact safe manifests"),
    gate("queue_saturation", queueStatus, queueStatus === "blocker" ? "hold" : queueStatus === "warning" ? "hold" : "promote", "Agent 02", `p95=${input.trends.queuePressure.p95Seconds}s`, "p95 <=120s warning threshold and no queue blocker", "bun test src/tests/schedulerProduction.test.ts", "activate low-priority drain and cap public polling"),
    gate("source_outage_wave", sourceOutageStatus, sourceOutageStatus === "pass" ? "promote" : "hold", "Agent 01/04", `source outage scenario=${capacitySimulation.scenarios.find((item) => item.name === "source_outage_wave")?.releaseDecision ?? "unknown"}`, "source outage wave must not be no-go for promotion", "bun test src/tests/sourceSeeds.test.ts src/tests/publicSignalFusion.test.ts", "quarantine failing sources and keep stale-source caveats visible"),
    gate("parser_failure_spike", parserStatus, parserStatus === "pass" ? "promote" : "hold", "Agent 03/07", `parser scenario=${capacitySimulation.scenarios.find((item) => item.name === "parser_failure_spike")?.releaseDecision ?? "unknown"}`, "parser failure spike must not be no-go for promotion", "bun test src/tests/pipeline.test.ts src/tests/adapterFailureObservatory.test.ts", "disable affected parser profile and hold ready wording"),
    gate("public_proof_failure", publicProofGateStatus, publicProofGateStatus === "blocker" ? "rollback-only" : publicProofGateStatus === "warning" ? "hold" : "promote", "Agent 09/10", `publicProof=${publicProofGateStatus}`, "public proof matrix must pass", "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "restore public wrapper fallback and rerun known/random/made-up actor proof"),
    gate("restricted_emergency_stop", restrictedStatus, restrictedStatus === "blocker" ? "needs-human-approval" : restrictedStatus === "warning" ? "hold" : "promote", "Agent 05/10", `restrictedKillSwitch=${input.trends.restrictedKillSwitch.active}`, "restricted emergency stop must be inactive for promotion", "bun run check:restricted-metadata-status", "keep restricted connectors disabled until human approval clears restore"),
    gate("remote_deploy_drift", remoteDeployStatus, remoteDeployStatus === "blocker" ? "rollback-only" : remoteDeployStatus === "warning" ? "hold" : "promote", "Agent 10", `deploymentDrift=${input.deploymentDrift.state}`, "remote deployment must be aligned", "bun run check:remote-drift", input.deploymentDrift.rollbackTarget.command)
  ];
  const status = worstProofStatus(gates.map((item) => item.status));
  const ownerHandoffs: MultiServiceResourceArbitrationPacket["ownerHandoffs"] = [
    { owner: "Agent 01", responsibility: "source governance and source outage capacity gates", lanes: [], gates: ["source_outage_wave"] },
    { owner: "Agent 02", responsibility: "queue backend fairness, drain, lease, and saturation controls", lanes: ["queue_backend"], gates: ["queue_saturation", "over_capacity"] },
    { owner: "Agent 03", responsibility: "collection worker and parser isolation before capacity widening", lanes: ["collection_workers", "dynamic_browser_disabled_pool"], gates: ["parser_failure_spike"] },
    { owner: "Agent 04", responsibility: "public-channel worker cadence and outage caveats", lanes: ["public_channel_workers"], gates: ["source_outage_wave"] },
    { owner: "Agent 05", responsibility: "restricted emergency-stop, approval, proxy, and retention isolation", lanes: [], gates: ["restricted_emergency_stop"] },
    { owner: "Agent 06", responsibility: "evidence replay, object manifests, retention, and disk pressure", lanes: ["evidence_replay", "graph_search_migration"], gates: ["disk_pressure"] },
    { owner: "Agent 07", responsibility: "quality gates for parser spikes and public ready wording", lanes: [], gates: ["parser_failure_spike"] },
    { owner: "Agent 08", responsibility: "graph drift and STIX/search migration throttles", lanes: ["graph_search_migration"], gates: ["disk_pressure", "over_capacity"] },
    { owner: "Agent 09", responsibility: "API live-search load, wrapper compatibility, and public proof", lanes: ["api_live_search_load"], gates: ["public_proof_failure"] },
    { owner: "Agent 10", responsibility: "host-level reservation, remote deploy drift, and release decision arbitration", lanes: lanes.map((item) => item.name), gates: gates.map((item) => item.name) }
  ];
  return {
    schemaVersion: "ti.multi_service_resource_arbitration.v1",
    dryRun: true,
    generatedAt: input.generatedAt ?? "dry-run",
    hostPolicy: {
      hostMemoryGb: 1024,
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    },
    summary: {
      status,
      scraperReservedGb: lanes.reduce((sum, item) => sum + item.memoryReservationGb, 0),
      scraperCeilingGb: 160,
      nonScraperReservedGb,
      ctiReserveAfterForecastGb,
      peakMemoryForecastGb,
      peakDiskGrowthGb: capacitySimulation.aggregate.diskGrowthPeakGb
    },
    lanes,
    gates,
    ownerHandoffs,
    proofCommands: uniqueStrings([
      "bun test src/tests/ops.test.ts",
      "bun test src/tests/api.test.ts src/tests/schedulerProduction.test.ts",
      "bun run check",
      "bun run check:ti-release-candidate",
      "bun run check:deploy-hygiene",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      ...lanes.map((item) => item.proofCommand),
      ...gates.map((item) => item.proofCommand),
      ...incidentSimulationPostmortems.proofCommands,
      ...releaseArtifactBundle.proofCommands
    ]),
    operatorRunbook: [
      "use resourceArbitration as the host-level decision packet before widening scraper workers or replay/export fanout",
      "keep collection, public-channel, replay, graph/search migration, queue, and API lanes under their reservation unless the main agent explicitly reallocates capacity",
      "treat 96 GB scraper RSS as the warning target and 160 GB as rollback-only ceiling",
      "preserve at least 500 GB for the broader CTI stack before evidence replay, graph/search migration, or public-channel bursts",
      "keep dynamic browser workers disabled by default and assume no GPU capacity",
      "release gates are compact and proof-command driven; do not include raw bodies, object keys, credentials, unsafe URLs, private material, or actor-interaction content"
    ],
    noLeakProof: "resource arbitration output includes lane names, owner agents, aggregate GB reservations, statuses, proof commands, and rollback actions only; it excludes raw evidence, object keys, unsafe URLs, credentials, private material, and actor-interaction content"
  };
}

function buildProductionSoakDecisionBoardPacket(
  input: CutoverSoakReleasePacketInput,
  observabilityDashboard: ProductionObservabilityDashboardPacket,
  enterpriseReleaseTrain: EnterpriseReleaseTrainPacket,
  capacitySimulation: CapacityCostSimulationPacket,
  releaseArtifactBundle: EnterpriseSoakReleaseArtifactBundlePacket,
  resourceArbitration: MultiServiceResourceArbitrationPacket
): ProductionSoakDecisionBoardPacket {
  const depStatus = (name: EnterpriseReleaseTrainPacket["dependencyHealth"][number]["name"]): "pass" | "warning" | "blocker" =>
    enterpriseReleaseTrain.dependencyHealth.find((item) => item.name === name)?.status ?? "blocker";
  const metricStatus = (name: ProductionObservabilityMetricName): "pass" | "warning" | "blocker" =>
    observabilityDashboard.sloDashboard.metrics.find((item) => item.name === name)?.status ?? "blocker";
  const gateStatus = (name: ResourceArbitrationGateName): "pass" | "warning" | "blocker" =>
    resourceArbitration.gates.find((item) => item.name === name)?.status ?? "blocker";
  const staleCacheStatus: ProductionSoakDecisionSignal["status"] = input.soak.summary.staleCacheRatePercent > DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxStaleCacheRatePercent
    ? "blocker"
    : input.soak.summary.staleCacheRatePercent > 0
      ? "stale"
      : "pass";
  const statusToDecision = (
    status: ProductionSoakDecisionSignal["status"],
    rollbackOnBlocker = false
  ): ProductionSoakDecision => {
    if (status === "blocker") return rollbackOnBlocker ? "rollback" : "hold";
    if (status === "warning" || status === "stale") return "hold";
    return "promote";
  };
  const signal = (
    name: ProductionSoakSignalName,
    owner: string,
    status: ProductionSoakDecisionSignal["status"],
    evidence: string[],
    proofCommand: string,
    rollbackStep: string,
    staleAfterMinutes = 30,
    rollbackOnBlocker = false
  ): ProductionSoakDecisionSignal => ({
    name,
    owner,
    status,
    decisionImpact: statusToDecision(status, rollbackOnBlocker),
    evidence,
    proofCommand,
    rollbackStep,
    staleAfterMinutes
  });
  const signals: ProductionSoakDecisionSignal[] = [
    signal("scheduler_queue_leases_dead_letters", "Agent 02/10", worstProofStatus([depStatus("queue_headroom"), gateStatus("queue_saturation")]), [
      `queueAgeP95Seconds=${input.soak.summary.queueAgeP95Seconds}`,
      `duplicateActiveRuns=${input.trends.runReuse.duplicateActiveRuns}`,
      `workerSaturationPercent=${input.soak.summary.workerSaturationPercent}`
    ], "bun test src/tests/schedulerProduction.test.ts", "drain low-priority queues, preserve run reuse, and pause broad source fanout"),
    signal("source_activation_health", "Agent 01/03/04/10", worstProofStatus([depStatus("source_freshness"), gateStatus("source_outage_wave"), metricStatus("source_unavailable_rate_percent")]), [
      `sourceCoveragePercent=${input.soak.summary.sourceCoveragePercent}`,
      `sourceUnavailableRatePercent=${input.soak.summary.sourceUnavailableRatePercent}`,
      `coverageDeltaPercent=${input.trends.sourceSlo.deltaPercent}`
    ], "bun test src/tests/sourceSeeds.test.ts src/tests/publicSignalFusion.test.ts", "pause degraded sources, keep stale caveats, and require source health repair"),
    signal("adapter_parser_failure_spikes", "Agent 03/07/10", worstProofStatus([gateStatus("parser_failure_spike"), metricStatus("adapter_failure_rate_percent")]), [
      `errorRatePercent=${input.soak.summary.errorRatePercent}`,
      `parserScenario=${capacitySimulation.scenarios.find((item) => item.name === "parser_failure_spike")?.releaseDecision ?? "unknown"}`
    ], "bun test src/tests/pipeline.test.ts src/tests/adapterFailureObservatory.test.ts", "disable affected parser profile and hold ready wording"),
    signal("evidence_object_index_replay_integrity", "Agent 06/10", depStatus("evidence_writes"), [
      `evidenceWriteReadOk=${input.soak.checks.find((check) => check.name === "proof.evidence_write_read")?.ok !== false}`,
      `diskGrowthPeakGb=${capacitySimulation.aggregate.diskGrowthPeakGb}`
    ], "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts", "pause evidence promotion and replay from last verified manifest"),
    signal("restricted_emergency_stop", "Agent 05/10", input.trends.restrictedKillSwitch.active ? "blocker" : depStatus("restricted_metadata_safety"), [
      `restrictedKillSwitch=${input.trends.restrictedKillSwitch.active}`,
      `rollbackTriggers=${input.trends.rollbackTriggers.join(",") || "none"}`
    ], "bun run check:restricted-metadata-status && bun run check:restricted-metadata-apply-plan", "keep restricted connectors disabled and require human/legal approval", 5),
    signal("quality_release_gates", "Agent 07/10", staleCacheStatus, [
      `staleCacheRatePercent=${input.soak.summary.staleCacheRatePercent}`,
      `unsafePolicyRetriesOk=${input.soak.checks.find((check) => check.name === "policy.unsafe_retries")?.ok !== false}`,
      `rejectedUnsafeActions=${input.trends.unsafeRejections.rejectedUnsafeActions}`
    ], "bun run check:search-quality-mounted && bun test src/tests/pipeline.test.ts", "hold public ready wording and rerun quality regression fixtures"),
    signal("graph_stix_holds", "Agent 08/10", depStatus("graph_export_holds"), [
      `graphScenario=${capacitySimulation.scenarios.find((item) => item.name === "graph_export_backlog")?.releaseDecision ?? "unknown"}`,
      "stixPromotionRequiresReviewedRelationships=true"
    ], "bun run check:graph-review-mounted", "hold graph/STIX export and keep public answer caveats"),
    signal("api_contract_drift", "Agent 09/10", depStatus("contract_index"), [
      `deploymentDrift=${input.deploymentDrift.state}`,
      `apiWrapperProofOk=${input.soak.checks.find((check) => check.name === "proof.api_wrapper")?.ok !== false}`
    ], "bun run check:api-regression && bun run check:contract-index", "restore compatibility wrapper or last generated-client freeze", 30, true),
    signal("public_wrapper_proofs", "Agent 09/10", releaseArtifactBundle.ownerBlockers.some((item) => item.gate === "public_proof") ? "blocker" : depStatus("public_proof_matrix"), [
      `publicQueries=${input.trends.publicQueries}`,
      `publicProofGate=${releaseArtifactBundle.gates.find((gate) => gate.name === "public_proof")?.status ?? "unknown"}`
    ], "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "restore public wrapper fallback and rerun known/random/made-up actor proof", 15, true),
    signal("memory_disk_pressure", "Agent 10", worstProofStatus([gateStatus("memory_pressure"), gateStatus("disk_pressure"), gateStatus("over_capacity")]), [
      `rssMaxGb=${input.soak.summary.memoryRssMaxGb}`,
      `scraperTargetGb=96`,
      `scraperCeilingGb=160`,
      `ctiReserveAfterForecastGb=${resourceArbitration.summary.ctiReserveAfterForecastGb}`
    ], "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot", "halve collection/replay workers and roll back before 160 GB RSS", 10, true),
    signal("deploy_hygiene", "Agent 10", depStatus("docker"), [
      `deploymentDrift=${input.deploymentDrift.state}`,
      `lastKnownGoodImage=${input.deploymentDrift.lastKnownGood.imageId}`
    ], "bun run check:deploy-hygiene && bun run check:route-inventory", input.deploymentDrift.rollbackTarget.command, 30, true)
  ];
  const staleSignals = signals.filter((item) => item.status === "stale" || (item.status !== "pass" && input.soak.summary.durationHours < 24));
  const darkIndexStatus: "pass" | "warning" | "blocker" = input.trends.restrictedKillSwitch.active ? "blocker" : resourceArbitration.summary.status === "blocker" ? "warning" : "pass";
  const sourceAtlasStatus: "pass" | "warning" | "blocker" = input.trends.sourceSlo.deltaPercent < -10 ? "warning" : "pass";
  const sideToolResourceBudgets: ProductionSoakDecisionBoardPacket["sideToolResourceBudgets"] = [
    {
      name: "dark_web_metadata_index",
      owner: "Agent 05/10",
      status: darkIndexStatus,
      recordTarget: 60_000,
      memoryReservationGb: 12,
      memoryCeilingGb: 24,
      diskReservationGb: 80,
      queuePartition: "restricted_metadata_index_refresh",
      proofCommand: "bun run check:restricted-metadata-status && bun test src/tests/darknetMetadata.test.ts",
      starvationGuard: "metadata index refresh yields to public search, evidence replay, and API polling before the scraper crosses 96 GB RSS or the CTI reserve drops below 500 GB"
    },
    {
      name: "source_atlas_discovery_import",
      owner: "Agent 01/10",
      status: sourceAtlasStatus,
      recordTarget: 10_000,
      memoryReservationGb: 10,
      memoryCeilingGb: 18,
      diskReservationGb: 40,
      queuePartition: "source_atlas_candidate_import",
      proofCommand: "bun test src/tests/sourceSeeds.test.ts src/tests/publicSignalFusion.test.ts",
      starvationGuard: "source atlas discovery/import remains dry-run, paginated, and scheduler-throttled; it never auto-activates candidates or crowds out live /ti searches"
    }
  ];
  const sideGate = (
    name: ProductionSoakDecisionBoardPacket["sideToolReleaseGates"][number]["name"],
    owner: string,
    status: "pass" | "warning" | "blocker",
    proofCommand: string,
    rollbackStep: string,
    rollbackOnBlocker = false
  ): ProductionSoakDecisionBoardPacket["sideToolReleaseGates"][number] => ({
    name,
    owner,
    status,
    decisionImpact: statusToDecision(status, rollbackOnBlocker),
    proofCommand,
    rollbackStep
  });
  const sideToolReleaseGates: ProductionSoakDecisionBoardPacket["sideToolReleaseGates"] = [
    sideGate("unsafe_dark_web_target_attempt", "Agent 05/10", input.trends.unsafeRejections.rejectedUnsafeActions > 0 ? "warning" : "pass", "bun run check:restricted-metadata-status", "pause dark metadata refresh and keep unsafe targets hash-only"),
    sideGate("raw_url_leakage", "Agent 05/09/10", "pass", "bun run check:restricted-metadata-status && bun run check:contract-index", "rollback public/API side-tool exposure until raw URL checks are clean", true),
    sideGate("credential_payload_pattern", "Agent 05/07/10", input.trends.restrictedKillSwitch.active ? "blocker" : "pass", "bun test src/tests/darknetMetadata.test.ts src/tests/pipeline.test.ts", "activate restricted safety stop and require human/legal approval"),
    sideGate("legal_review_overflow", "Agent 05/10", input.trends.restrictedKillSwitch.active ? "blocker" : "pass", "bun run check:restricted-metadata-status", "hold restricted metadata indexing until review backlog clears"),
    sideGate("source_atlas_auto_activation_mistake", "Agent 01/10", "pass", "bun test src/tests/sourceSeeds.test.ts", "disable atlas import executor and restore dry-run-only source candidates", true),
    sideGate("source_discovery_flood", "Agent 01/02/10", sourceAtlasStatus, "bun test src/tests/sourceSeeds.test.ts src/tests/schedulerProduction.test.ts", "throttle source candidate import and drain live-search queues")
  ];
  const scenario = (
    name: ProductionSoakScenarioName,
    expectedDecision: ProductionSoakDecision,
    trigger: string,
    proofCommand: string,
    rollbackStep: string,
    ownerHandoff: string
  ): ProductionSoakScenarioFixture => ({
    name,
    expectedDecision,
    trigger,
    proofCommand,
    rollbackStep,
    ownerHandoff,
    noLeakBoundary: "scenario fixtures expose ids, counts, hashes, statuses, proof commands, and rollback steps only"
  });
  const scenarioFixtures: ProductionSoakScenarioFixture[] = [
    scenario("dark_metadata_60k_refresh", darkIndexStatus === "blocker" ? "needs-human-approval" : darkIndexStatus === "warning" ? "hold" : "promote", "60k restricted metadata records refresh without raw payloads, unsafe URL exposure, queue starvation, or CTI reserve breach", "bun run check:restricted-metadata-status && bun test src/tests/darknetMetadata.test.ts", "pause restricted metadata refresh, preserve metadata-only rows, and require review for unsafe targets", "Agent 05/10"),
    scenario("source_atlas_10k_import", sourceAtlasStatus === "warning" ? "hold" : "promote", "10k source candidates score/import as dry-run paginated atlas records without auto-activation or scheduler starvation", "bun test src/tests/sourceSeeds.test.ts src/tests/publicSignalFusion.test.ts", "keep source candidates staged and disable import executor until coverage proof is clean", "Agent 01/10"),
    scenario("source_outage_wave", "hold", "source-unavailable rate or source outage forecast breaches SLO", "bun test src/tests/sourceSeeds.test.ts src/tests/publicSignalFusion.test.ts", "quarantine failing source family and keep stale-source caveats", "Agent 01/04"),
    scenario("parser_failure_storm", "hold", "adapter/parser failure spike causes confidence or extraction warnings", "bun test src/tests/pipeline.test.ts src/tests/adapterFailureObservatory.test.ts", "disable affected parser profile and require fixture repair", "Agent 03/07"),
    scenario("queue_runaway", "hold", "queue p95, leases, worker saturation, or dead-letter debt runs away", "bun test src/tests/schedulerProduction.test.ts", "drain low-priority lanes and cap public polling", "Agent 02"),
    scenario("object_store_failure", "rollback", "evidence write/read, object manifest, or replay integrity fails", "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts", "pause promotion and restore from last verified manifest", "Agent 06"),
    scenario("api_deploy_mismatch", "rollback", "route inventory, contract index, or remote deployment drift fails", "bun run check:api-regression && bun run check:remote-drift", "redeploy last-known-good API/scraper image", "Agent 09/10"),
    scenario("restricted_safety_event", "needs-human-approval", "restricted kill switch, approval, retention, or proxy safety gate trips", "bun run check:restricted-metadata-status", "keep restricted connectors disabled pending human/legal approval", "Agent 05/10"),
    scenario("stale_actor_answer_regression", "hold", "known actor answer has stale recent activity or stale-cache wording", "bun run check:search-quality-mounted", "hold ready wording and rerun freshness evaluation", "Agent 07/09"),
    scenario("unknown_actor_false_ready_regression", "rollback", "unknown actor renders ready/default/demo answer instead of Searching", "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search", "restore public wrapper fallback and block promotion", "Agent 07/09/10"),
    scenario("graph_export_hold", "hold", "graph/STIX export has review, drift, stale, contradicted, or missing-ledger hold", "bun run check:graph-review-mounted", "hold graph/STIX promotion and keep relationship caveats", "Agent 08")
  ];
  const anyHuman = signals.some((item) => item.name === "restricted_emergency_stop" && item.status === "blocker");
  const anyRollback = signals.some((item) => item.decisionImpact === "rollback") || sideToolReleaseGates.some((item) => item.decisionImpact === "rollback");
  const anyHold = signals.some((item) => item.decisionImpact === "hold") || sideToolReleaseGates.some((item) => item.decisionImpact === "hold") || sideToolResourceBudgets.some((item) => item.status !== "pass") || staleSignals.length > 0 || releaseArtifactBundle.decision === "hold";
  const decision: ProductionSoakDecision = anyHuman
    ? "needs-human-approval"
    : anyRollback || releaseArtifactBundle.decision === "rollback-only"
      ? "rollback"
      : anyHold || releaseArtifactBundle.decision === "warning"
        ? "hold"
        : "promote";
  return {
    schemaVersion: "ti.production_soak_decision_board.v1",
    dryRun: true,
    generatedAt: input.generatedAt ?? "dry-run",
    windowHours: 24,
    decision,
    resourcePolicy: {
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    },
    sideToolResourceBudgets,
    sideToolReleaseGates,
    signals,
    staleSignals,
    scenarioFixtures,
    ownerHandoffs: [
      { owner: "Agent 02", signals: ["scheduler_queue_leases_dead_letters"], scenarios: ["queue_runaway"], nextAction: "prove queue leases, dead letters, drain, and run reuse before promotion" },
      { owner: "Agent 01", signals: ["source_activation_health"], scenarios: ["source_atlas_10k_import", "source_outage_wave"], nextAction: "prove 10k source candidates remain dry-run, paginated, and non-starving before import or activation" },
      { owner: "Agent 05", signals: ["restricted_emergency_stop"], scenarios: ["dark_metadata_60k_refresh", "restricted_safety_event"], nextAction: "prove 60k metadata refresh remains metadata-only and hold on unsafe target or legal overflow" },
      { owner: "Agent 03/04", signals: ["source_activation_health", "adapter_parser_failure_spikes"], scenarios: ["source_outage_wave", "parser_failure_storm"], nextAction: "repair source/parser failure waves and keep public answers caveated" },
      { owner: "Agent 06", signals: ["evidence_object_index_replay_integrity"], scenarios: ["object_store_failure"], nextAction: "prove object/index/replay integrity and backup/restore readiness" },
      { owner: "Agent 07/08", signals: ["quality_release_gates", "graph_stix_holds"], scenarios: ["stale_actor_answer_regression", "graph_export_hold"], nextAction: "resolve quality and graph/STIX holds before ready wording/export" },
      { owner: "Agent 09", signals: ["api_contract_drift", "public_wrapper_proofs"], scenarios: ["api_deploy_mismatch", "unknown_actor_false_ready_regression"], nextAction: "restore public/API proof and contract compatibility" },
      { owner: "Agent 10", signals: ["memory_disk_pressure", "deploy_hygiene"], scenarios: ["api_deploy_mismatch", "queue_runaway"], nextAction: "arbitrate promote/hold/rollback and preserve Inspur resource policy" }
    ],
    proofCommands: uniqueStrings([
      "bun test src/tests/ops.test.ts",
      "bun test src/tests/api.test.ts src/tests/schedulerProduction.test.ts",
      "bun run check",
      "bun run check:ti-release-candidate",
      "bun run check:deploy-hygiene",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      ...signals.map((item) => item.proofCommand),
      ...sideToolResourceBudgets.map((item) => item.proofCommand),
      ...sideToolReleaseGates.map((item) => item.proofCommand),
      ...scenarioFixtures.map((item) => item.proofCommand)
    ]),
    operatorRunbook: [
      "start with productionSoakDecisionBoard.decision, then inspect staleSignals before promotion",
      "promote only when every signal passes, 24h duration is complete, and public proof stays query-specific",
      "hold on stale signals, queue/source/parser/quality/graph holds, or any incomplete 24h signal",
      "rollback on public proof failure, API/deploy mismatch, object-store integrity failure, memory/disk ceiling breach, or unknown actor false-ready regression",
      "needs-human-approval on restricted safety events; do not re-enable restricted workers without explicit approval",
      "keep dark-web metadata indexing to metadata-only records and prove 60k record pagination/search/refresh does not starve public /ti or the rest of CTI",
      "keep source atlas discovery/import dry-run until activation approval and prove 10k candidates do not auto-activate or flood scheduler queues",
      "enforce 96 GB normal scraper target, 160 GB ceiling, 500 GB CTI reserve, browser-disabled default, bounded caches, disk-first evidence, and no GPU assumption"
    ],
    noLeakProof: "production soak board emits signal names, owner handoffs, metric counts, statuses, proof commands, rollback steps, ids, and hashes only; it excludes raw evidence bodies, object keys, unsafe URLs, credentials, private material, and actor-interaction content"
  };
}

function buildOnCallRunbookPack(
  input: CutoverSoakReleasePacketInput,
  capacitySimulation: CapacityCostSimulationPacket,
  incidentRunbooks: ProductionIncidentRunbookPacket,
  resourceArbitration: MultiServiceResourceArbitrationPacket,
  productionSoakDecisionBoard: ProductionSoakDecisionBoardPacket,
  releaseArtifactBundle: EnterpriseSoakReleaseArtifactBundlePacket
): OnCallRunbookPack {
  const routeProof = (route: string, proofCommand: string, expectedOutput: string): OnCallProcedure["routeProofs"][number] => ({
    route,
    proofCommand,
    expectedOutput
  });
  const noLeakBoundary = "runbook output is limited to routes, ids, counts, hashes, cursors, statuses, queue partitions, proof commands, and rollback states; no raw unsafe URLs, credentials, object keys, payload links, private material, leaked rows, raw bodies, or actor-interaction content";
  const procedure = (
    name: OnCallProcedureName,
    decisionState: OnCallDecisionState,
    trigger: string,
    operatorAction: string,
    queuePartitions: string[],
    routeProofs: OnCallProcedure["routeProofs"],
    rollbackOrResume: string,
    ownerHandoffs: string[]
  ): OnCallProcedure => ({
    name,
    decisionState,
    trigger,
    operatorAction,
    queuePartitions,
    routeProofs,
    rollbackOrResume,
    ownerHandoffs,
    noLeakBoundary
  });
  const incident = (
    name: OnCallIncidentName,
    decisionState: OnCallDecisionState,
    severity: OnCallIncidentPlaybook["severity"],
    detectionSignals: string[],
    firstResponse: string,
    containment: string,
    recoveryProof: string,
    publicTiMode: OnCallIncidentPlaybook["publicTiMode"],
    ownerHandoffs: string[]
  ): OnCallIncidentPlaybook => ({
    name,
    decisionState,
    severity,
    detectionSignals,
    firstResponse,
    containment,
    recoveryProof,
    publicTiMode,
    ownerHandoffs,
    noLeakBoundary
  });
  const sideToolSafeguards: OnCallRunbookPack["sideToolSafeguards"] = [
    {
      tool: "dark_web_metadata_index",
      pauseState: "pause_side_tool",
      queuePartition: "dark_web_metadata_index",
      yieldTo: ["interactive_live_search", "public_collection", "public_channel"],
      maxMemoryGb: capacitySimulation.sideToolForecasts.find((item) => item.name === "dark_web_metadata_index")?.memoryCeilingGb ?? 24,
      resumeGate: "restricted status, release candidate, no-leak scan, and public search queue proof must all pass"
    },
    {
      tool: "source_atlas_discovery_import",
      pauseState: "pause_side_tool",
      queuePartition: "source_atlas_import",
      yieldTo: ["interactive_live_search", "public_collection", "public_channel"],
      maxMemoryGb: capacitySimulation.sideToolForecasts.find((item) => item.name === "source_atlas_discovery_import")?.memoryCeilingGb ?? 18,
      resumeGate: "source atlas remains dry-run, no auto-activation, and scheduler pressure stays below hold threshold"
    },
    {
      tool: "evidence_index_replay",
      pauseState: "defer_background_work",
      queuePartition: capacitySimulation.indexReplayBudget.queuePartition,
      yieldTo: ["interactive_live_search", "public_collection", "public_channel", "restricted_metadata"],
      maxMemoryGb: capacitySimulation.indexReplayBudget.maxReplayMemoryGb,
      resumeGate: capacitySimulation.indexReplayBudget.rollbackTrigger
    }
  ];
  const procedures: OnCallProcedure[] = [
    procedure(
      "deploy_release",
      "promote",
      `release artifact decision ${releaseArtifactBundle.decision} and soak board decision ${productionSoakDecisionBoard.decision}`,
      "promote only after route inventory, contract index, release candidate, deploy hygiene, and public proof are green",
      ["interactive_live_search", "public_collection", "public_channel"],
      [
        routeProof("/v1/contracts", "bun run check:contract-index", "contract index includes stable routes and no unsafe payload fields"),
        routeProof("/v1/intel/search", "bun run check:ti-release-candidate", "release candidate decision is promote with stable run/cursor/search states")
      ],
      "rollback_release",
      ["Agent 09", "Agent 10"]
    ),
    procedure(
      "rollback_release",
      "rollback",
      "deployment drift, public proof failure, object corruption, unknown false-ready, or host resource ceiling breach",
      "restore last known good scraper/API wrapper path, keep public answers searching or partial, and rerun release proof before promotion",
      ["interactive_live_search", "public_collection"],
      [
        routeProof("/v1/health", "bun run check:route-inventory", "mounted health/routes return compact safe responses"),
        routeProof("deploy hygiene", "bun run check:deploy-hygiene", "Docker/compose/memory/evidence-volume invariants pass")
      ],
      "deploy_release after all rollback triggers clear",
      ["Agent 09", "Agent 10", "main agent deploy owner"]
    ),
    procedure(
      "pause_source_atlas_import",
      "pause_side_tool",
      "source atlas import pressure, discovery flood, auto-activation mistake, or public search starvation",
      "pause source-atlas import partition, keep candidates staged as dry-run, and preserve public search/source coverage responses",
      ["source_atlas_import"],
      [
        routeProof("/v1/sources/atlas", "bun test src/tests/sourceSeeds.test.ts", "atlas remains dry-run, paginated, and non-crawling"),
        routeProof("/v1/frontier/status", "bun test src/tests/schedulerProduction.test.ts", "scheduler partitions show public search is not starved")
      ],
      "resume after no auto-activation, no flood, and public search p95 proof is green",
      ["Agent 01", "Agent 02", "Agent 10"]
    ),
    procedure(
      "pause_dark_web_metadata_refresh",
      "pause_side_tool",
      "unsafe target attempt, raw URL leakage signal, credential/payload pattern, legal review overflow, or public search starvation",
      "pause dark-web metadata refresh partition, keep existing metadata review rows, and require no-leak and legal proof before resume",
      ["dark_web_metadata_index", "restricted_metadata"],
      [
        routeProof("/v1/restricted-metadata/status", "bun run check:restricted-metadata-status", "restricted status reports approval, kill-switch, retention, and no unsafe raw fields"),
        routeProof("/v1/intel/search", "bun run check:ti-release-candidate", "runtime no-leak surface remains clean")
      ],
      "resume only after human/legal review when unsafe or legal overflow signals are involved",
      ["Agent 05", "Agent 06", "Agent 10"]
    ),
    procedure(
      "emergency_stop_restricted_collectors",
      "emergency_stop_restricted",
      `restricted kill switch active=${input.trends.restrictedKillSwitch.active} or restricted emergency-stop runbook impact present`,
      "disable restricted collectors, drain restricted queues without retries, preserve metadata-only audit rows, and page human/legal review",
      ["restricted_metadata", "dark_web_metadata_index"],
      [
        routeProof("/v1/restricted-metadata/apply-plan", "bun run check:restricted-metadata-apply-plan", "apply plan remains dry-run and metadata-only"),
        routeProof("/v1/restricted-metadata/status", "bun run check:restricted-metadata-status", "kill switch and approval state are visible without unsafe details")
      ],
      "restore only through explicit approval after proxy isolation, retention, redaction, and no-leak proof pass",
      ["Agent 05", "Agent 06", "Agent 09", "Agent 10"]
    ),
    procedure(
      "drain_queue_partitions",
      "drain_partition",
      `queue p95 ${input.trends.queuePressure.p95Seconds}s, worker saturation, dead-letter debt, or partition starvation`,
      "drain background replay/export/import partitions first while preserving interactive search leases and cursor continuity",
      ["source_atlas_import", "dark_web_metadata_index", "evidence_index_replay", "graph_export", "retention_backup"],
      [
        routeProof("/v1/frontier/status", "bun run check:frontier-apply-plan", "dry-run drain preserves run reuse, deadlines, and cursor replay"),
        routeProof("/v1/intel/search.scheduler", "bun test src/tests/schedulerProduction.test.ts", "scheduler SLOs and partitions remain visible")
      ],
      "resume partitions one at a time after p95 queue and public polling proof recover",
      ["Agent 02", "Agent 06", "Agent 08", "Agent 10"]
    ),
    procedure(
      "restore_public_ti_responsiveness",
      "defer_background_work",
      "public /ti first response or 3-second polling is threatened by side tools, replay, graph export, or API drift",
      "defer background work, reuse active runs, return partial/searching states, and keep unknown queries from rendering ready",
      ["interactive_live_search", "public_collection", "public_channel"],
      [
        routeProof("/v1/intel/search", "bun run check:scraper-native-search", "known/random/made-up queries keep stable run ids and 3-second polling"),
        routeProof("public POST /api/ti/search", "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "public wrapper returns live states and stable run ids")
      ],
      "re-enable background partitions after public proof and route contract drift are green",
      ["Agent 07", "Agent 09", "Agent 10"]
    )
  ];
  const incidentPlaybooks: OnCallIncidentPlaybook[] = [
    incident("unsafe_url_exposure", "emergency_stop_restricted", "emergency", ["sideToolReleaseGates.raw_url_leakage", "runtime_no_leak_surface", "restrictedMetadata.redaction"], "stop restricted collectors and block promotion", "quarantine output, preserve hashes/audit ids, and rerun no-leak release candidate", "bun run check:ti-release-candidate", "metadata_review", ["Agent 05", "Agent 09", "Agent 10"]),
    incident("credential_payload_fetch_attempt_blocked", "require_human_review", "emergency", ["sideToolReleaseGates.credential_payload_pattern", "restrictedMetadata.policyBlocks"], "keep block as success and require review", "ensure no retry, no download, and no payload/object ref entered storage", "bun test src/tests/darknetMetadata.test.ts", "metadata_review", ["Agent 05", "Agent 06", "Agent 10"]),
    incident("dangerous_collector_compromise_assumption", "emergency_stop_restricted", "emergency", ["proxy isolation failure", "unexpected egress", "collector timeout storm"], "assume collector untrusted and isolate restricted partitions", "disable restricted connectors, rotate disposable boundary, and preserve hash-only audit", "bun run check:restricted-metadata-status", "degraded", ["Agent 05", "Agent 10"]),
    incident("quarantine_overflow", "pause_side_tool", "hold", ["legal_review_overflow", "quarantine queue age", "restricted review backlog"], "pause side tools and keep public answers partial", "drain analyst review queue before more dark metadata refresh", "bun run check:restricted-metadata-status", "partial", ["Agent 05", "Agent 07", "Agent 10"]),
    incident("evidence_object_corruption", "rollback", "rollback", ["object manifest mismatch", "backup integrity failure", "cursor replay gap"], "stop evidence promotion and restore from manifest", "run object integrity repair dry-run and replay ledger before resuming", "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts", "partial", ["Agent 06", "Agent 10"]),
    incident("route_contract_drift", "rollback", "rollback", ["route inventory drift", "contract index drift", "public wrapper field drift"], "freeze deploy and restore last stable wrapper/route contract", "rerun route inventory, contract index, and API regression proof", "bun run check:route-inventory && bun run check:contract-index", "degraded", ["Agent 09", "Agent 10"]),
    incident("stale_answer_regression", "hold", "hold", ["quality stale answer gate", "freshness SLO breach", "source caveat missing"], "hold ready wording and return partial/searching", "rerun quality and freshness proof with current evidence", "bun run check:search-quality-mounted", "partial", ["Agent 07", "Agent 09", "Agent 10"]),
    incident("unknown_query_false_ready_regression", "rollback", "rollback", ["unknown actor ready state", "demo/default actor fallback", "stale cache copy"], "restore searching-only behavior for unknowns and block promotion", "run made-up actor scraper-native proof and public wrapper proof", "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search", "searching", ["Agent 07", "Agent 09", "Agent 10"]),
    incident("host_resource_pressure", input.trends.resources.memoryRssMaxGb >= 160 ? "rollback" : input.trends.resources.memoryRssMaxGb > 96 ? "defer_background_work" : "hold", input.trends.resources.memoryRssMaxGb >= 160 ? "rollback" : "hold", ["resourceArbitration.memory_pressure", "capacitySimulation.hostBudget", "productionSoakDecisionBoard.memory_disk_pressure"], "preserve public /ti and defer background work before increasing memory", "pause side tools, replay, graph export, and sweeps before crossing 96 GB; rollback near 160 GB", "bun test src/tests/ops.test.ts", input.trends.resources.memoryRssMaxGb >= 160 ? "degraded" : "partial", ["Agent 02", "Agent 06", "Agent 08", "Agent 10"])
  ];
  const noLeakProof = "on-call runbook emits procedure names, decisions, owners, route proofs, aggregate budgets, ids, hashes, and status fields only; it excludes raw evidence, object keys, unsafe URLs, credentials, private material, and actor-interaction content";
  return {
    schemaVersion: "ti.on_call_runbook_pack.v1",
    dryRun: true,
    generatedAt: input.generatedAt ?? "dry-run",
    resourcePolicy: {
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    },
    decisionStates: ["promote", "hold", "rollback", "pause_side_tool", "drain_partition", "emergency_stop_restricted", "require_human_review", "defer_background_work"],
    procedures,
    incidentPlaybooks,
    sideToolSafeguards,
    publicResponsiveness: {
      targetFirstResponseSeconds: 3,
      pollSeconds: 3,
      restoreDecisionState: "defer_background_work",
      restoreActions: [
        "reuse active runs before scheduling duplicate actor work",
        "pause source-atlas import and dark-web metadata refresh before reducing public search",
        "defer evidence replay and graph export before crossing 96 GB",
        "return partial or searching states instead of stale ready wording"
      ]
    },
    integrations: {
      capacitySimulation: "wired",
      incidentRunbooks: "wired",
      resourceArbitration: "wired",
      productionSoakDecisionBoard: "wired",
      releaseArtifactBundle: "wired"
    },
    proofCommands: uniqueStrings([
      "bun run check",
      "bun test src/tests/ops.test.ts src/tests/api.test.ts src/tests/schedulerProduction.test.ts",
      "bun run check:ti-release-candidate",
      "bun run check:deploy-hygiene",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      ...procedures.flatMap((item) => item.routeProofs.map((proof) => proof.proofCommand)),
      ...incidentPlaybooks.map((item) => item.recoveryProof),
      ...incidentRunbooks.proofCommands,
      ...resourceArbitration.proofCommands,
      ...productionSoakDecisionBoard.proofCommands
    ]),
    operatorRunbook: [
      "use onCallRunbookPack.procedures for deploy, rollback, side-tool pause, restricted emergency stop, queue drain, and public responsiveness restoration",
      "when public /ti responsiveness is at risk, defer background work before reducing interactive search",
      "pause dark-web metadata refresh and source-atlas import as side tools; do not widen scraper memory above 96 GB without explicit review",
      "near 160 GB RSS, rollback instead of adding workers",
      "preserve 500 GB for the broader CTI app and assume no GPU capacity"
    ],
    noLeakProof: noLeakBoundary
  };
}

function buildReleaseTrainHardeningPacket(
  input: CutoverSoakReleasePacketInput,
  capacitySimulation: CapacityCostSimulationPacket,
  releaseArtifactBundle: EnterpriseSoakReleaseArtifactBundlePacket,
  resourceArbitration: MultiServiceResourceArbitrationPacket,
  productionSoakDecisionBoard: ProductionSoakDecisionBoardPacket,
  onCallRunbookPack: OnCallRunbookPack
): ReleaseTrainHardeningPacket {
  const statusFromDecision = (decision: ReleaseTrainHardeningDecision): ReleaseTrainHardeningSignal["status"] =>
    decision === "promote" ? "pass" : decision === "hold" ? "warning" : "blocker";
  const hardeningDecision = (
    warning: boolean,
    rollback: boolean,
    human: boolean
  ): ReleaseTrainHardeningDecision => human ? "needs-human-approval" : rollback ? "rollback" : warning ? "hold" : "promote";
  const releaseArtifactDecision: ReleaseTrainHardeningDecision = releaseArtifactBundle.decision === "promote"
    ? "promote"
    : releaseArtifactBundle.decision === "warning"
      ? "hold"
      : releaseArtifactBundle.decision === "needs-human-approval"
        ? "needs-human-approval"
        : "rollback";
  const soakBoardDecision: ReleaseTrainHardeningDecision = productionSoakDecisionBoard.decision === "promote"
    ? "promote"
    : productionSoakDecisionBoard.decision === "hold"
      ? "hold"
      : productionSoakDecisionBoard.decision === "needs-human-approval"
        ? "needs-human-approval"
        : "rollback";
  const memoryRollback = input.trends.resources.memoryRssMaxGb >= 160;
  const memoryWarning = input.trends.resources.memoryRssMaxGb > 96 || resourceArbitration.summary.status === "warning";
  const publicProofGate = String(releaseArtifactBundle.gates.find((gate) => gate.name === "public_proof")?.status ?? "blocker");
  const publicTiGate = String(releaseArtifactBundle.gates.find((gate) => gate.name === "public_ti_expectations")?.status ?? "blocker");
  const releaseBlockerPublicProof = releaseArtifactBundle.ownerBlockers.some((blocker) => blocker.gate === "public_proof");
  const deployRollback = input.deploymentDrift.state === "rollback" || input.deploymentDrift.blockedPromotionReasons.length > 0 || publicProofGate === "blocker" || releaseBlockerPublicProof;
  const deployWarning = input.deploymentDrift.state === "drift";
  const migrationBlocker = releaseArtifactBundle.gates.some((gate) =>
    (gate.name === "evidence_chain" || gate.name === "graph_stix_readiness" || gate.name === "scheduler_status") && gate.status === "blocker"
  );
  const sevenDayDecision = hardeningDecision(
    input.soak.summary.errorRatePercent > 1
      || input.soak.summary.queueAgeP95Seconds > 30
      || input.trends.sourceSlo.deltaPercent < 0
      || productionSoakDecisionBoard.staleSignals.length > 0,
    input.soak.status === "rollback" || productionSoakDecisionBoard.decision === "rollback" || deployRollback,
    input.trends.restrictedKillSwitch.active
  );
  const thirtyDayDecision = hardeningDecision(
    memoryWarning
      || capacitySimulation.aggregate.worstDecision === "canary-with-warnings"
      || capacitySimulation.aggregate.worstDecision === "promote-with-warnings"
      || capacitySimulation.aggregate.worstDecision === "no-go"
      || capacitySimulation.aggregate.worstDecision === "rollback"
      || capacitySimulation.aggregate.worstDecision === "emergency-stop",
    memoryRollback
      || (capacitySimulation.aggregate.worstDecision === "rollback" && input.soak.status === "rollback"),
    input.trends.restrictedKillSwitch.active
  );
  const deployDecision = hardeningDecision(deployWarning, deployRollback, false);
  const pinDecision = hardeningDecision(deployWarning, deployRollback, false);
  const migrationDecision = hardeningDecision(migrationBlocker, false, false);
  const publicWrapperRollback = deployRollback || publicProofGate === "blocker" || publicTiGate === "blocker";
  const scraperRollback = memoryRollback || input.soak.status === "rollback";
  const signal = (
    name: ReleaseTrainHardeningSignalName,
    owner: string,
    decisionImpact: ReleaseTrainHardeningDecision,
    evidence: string[],
    proofCommand: string,
    rollbackCriteria: string
  ): ReleaseTrainHardeningSignal => ({
    name,
    owner,
    status: statusFromDecision(decisionImpact),
    decisionImpact,
    evidence,
    proofCommand,
    rollbackCriteria,
    noLeakBoundary: "ids, hashes, image/config hashes, route names, counts, cursors, status fields, and proof commands only"
  });
  const signals: ReleaseTrainHardeningSignal[] = [
    signal("seven_day_public_ti_soak", "Agent 07/09/10", sevenDayDecision, [
      `soakStatus=${input.soak.status}`,
      `queueAgeP95Seconds=${input.soak.summary.queueAgeP95Seconds}`,
      `sourceSloDelta=${input.trends.sourceSlo.deltaPercent}`,
      `staleSignals=${productionSoakDecisionBoard.staleSignals.length}`
    ], "bun run soak:production", "rollback public wrapper if 7-day proof has stale ready answers, route drift, public proof failure, or repeated queue p95 breaches"),
    signal("thirty_day_capacity_forecast", "Agent 02/06/10", thirtyDayDecision, [
      `worstDecision=${capacitySimulation.aggregate.worstDecision}`,
      `memoryPeakGb=${capacitySimulation.aggregate.memoryPeakGb}`,
      `diskGrowthPeakGb=${capacitySimulation.aggregate.diskGrowthPeakGb}`,
      `ctiReserveMinimumGb=${capacitySimulation.aggregate.ctiReserveMinimumGb}`
    ], "bun test src/tests/ops.test.ts", "rollback scraper backend if forecast crosses 160 GB, reserve drops below 500 GB, or 30-day forecast is no-go/emergency-stop"),
    signal("deploy_mismatch_detection", "Agent 09/10", deployDecision, [
      `deploymentState=${input.deploymentDrift.state}`,
      `blockedPromotionReasons=${input.deploymentDrift.blockedPromotionReasons.length}`,
      `lastKnownGoodImage=${input.deploymentDrift.lastKnownGood.imageId}`
    ], "bun run check:remote-drift", "rollback to last known good image/config hash on source, compose, image, route, or public proof mismatch"),
    signal("image_version_pinning", "Agent 10", pinDecision, [
      `scraperImage=${input.deploymentDrift.lastKnownGood.imageId}`,
      `composeConfigHash=${input.deploymentDrift.lastKnownGood.composeConfigHash}`,
      `rollbackImage=${input.deploymentDrift.rollbackTarget.imageId}`
    ], "bun run check:deploy-hygiene", "hold promotion unless scraper/API/frontend pins and rollback target hashes are recorded"),
    signal("migration_readiness", "Agent 02/06/08/10", migrationDecision, [
      `evidenceGate=${releaseArtifactBundle.gates.find((gate) => gate.name === "evidence_chain")?.status ?? "unknown"}`,
      `graphGate=${releaseArtifactBundle.gates.find((gate) => gate.name === "graph_stix_readiness")?.status ?? "unknown"}`,
      `schedulerGate=${releaseArtifactBundle.gates.find((gate) => gate.name === "scheduler_status")?.status ?? "unknown"}`
    ], "bun test src/tests/storageCutover.test.ts src/tests/schedulerProduction.test.ts src/tests/graphReviewRoutes.test.ts", "rollback migrations if cursor replay, evidence chain, scheduler leases, graph holds, or route contracts drift"),
    signal("remote_proof_commands", "Agent 09/10", deployRollback ? "rollback" : "promote", [
      "remote proof commands are explicit and repeatable",
      "container checks may be skipped only for local fixture proof, not remote promotion",
      "public proof covers known, random, and made-up queries"
    ], "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", "hold release if remote proof cannot exercise public /ti and public API wrapper safely"),
    signal("public_api_wrapper_rollback", "Agent 09/10", publicWrapperRollback ? "rollback" : "promote", [
      `publicProofGate=${releaseArtifactBundle.gates.find((gate) => gate.name === "public_proof")?.status ?? "unknown"}`,
      `publicTiExpectationGate=${releaseArtifactBundle.gates.find((gate) => gate.name === "public_ti_expectations")?.status ?? "unknown"}`,
      `onCallProcedure=${onCallRunbookPack.procedures.find((procedure) => procedure.name === "rollback_release")?.name ?? "missing"}`
    ], "bun run check:scraper-native-search", "rollback public API wrapper on public proof failure, unknown false-ready, stale demo/cache prose, route contract drift, or wrapper/scraper semantic mismatch"),
    signal("scraper_backend_rollback", "Agent 02/06/10", scraperRollback ? "rollback" : "promote", [
      `memoryRssMaxGb=${input.trends.resources.memoryRssMaxGb}`,
      `resourceArbitration=${resourceArbitration.summary.status}`,
      `productionSoakDecision=${productionSoakDecisionBoard.decision}`
    ], "bun run check:ti-release-candidate", "rollback scraper backend on 160 GB pressure, queue runaway, evidence corruption, restricted emergency stop, or failed release candidate no-leak proof")
  ];
  const deployMismatchDetectors: ReleaseTrainHardeningPacket["deployMismatchDetectors"] = [
    { name: "scraper_image", status: deployRollback ? "blocker" : deployWarning ? "warning" : "pass", detector: "compare lastKnownGood.imageId with running scraper image id", rollbackAction: input.deploymentDrift.rollbackTarget.command },
    { name: "public_api_wrapper_image", status: deployRollback ? "blocker" : "pass", detector: "public API wrapper proof must match scraper-native semantics", rollbackAction: "rollback public API wrapper to last known good image and keep scraper route mounted" },
    { name: "frontend_ti_image", status: deployWarning ? "warning" : "pass", detector: "frontend /ti must render progressive polling fields and no default actor copy", rollbackAction: "rollback frontend /ti image while preserving public API polling" },
    { name: "route_contract", status: releaseArtifactBundle.gates.find((gate) => gate.name === "route_inventory")?.status ?? "blocker", detector: "route inventory and contract index remain the source of truth", rollbackAction: "restore previous route contract and rerun route inventory plus contract index" },
    { name: "public_wrapper_semantics", status: publicWrapperRollback ? "blocker" : "pass", detector: "known/random/made-up query proof matches scraper-native live state semantics", rollbackAction: "rollback wrapper and return Searching/partial instead of stale ready answers" }
  ];
  const imageVersionPins: ReleaseTrainHardeningPacket["imageVersionPins"] = [
    { service: "scraper", pin: input.deploymentDrift.lastKnownGood.imageId, verification: "bun run check:remote-drift", rollbackPin: input.deploymentDrift.rollbackTarget.imageId },
    { service: "public_api_wrapper", pin: input.deploymentDrift.lastKnownGood.sourceHash, verification: "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof", rollbackPin: input.deploymentDrift.rollbackTarget.sourceHash },
    { service: "frontend_ti", pin: input.deploymentDrift.lastKnownGood.composeConfigHash, verification: "bun run check:live-search-deploy", rollbackPin: input.deploymentDrift.rollbackTarget.composeConfigHash },
    { service: "postgres_source_registry", pin: "migration-dry-run-current", verification: "bun test src/tests/storageCutover.test.ts", rollbackPin: "preserve previous replay checkpoint" },
    { service: "queue_backend", pin: "embedded-default-or-explicit-postgres-flag", verification: "bun test src/tests/schedulerProduction.test.ts", rollbackPin: "embedded scheduler queue backend" }
  ];
  const migrationReadiness: ReleaseTrainHardeningPacket["migrationReadiness"] = [
    { migration: "source_registry", status: releaseArtifactBundle.gates.find((gate) => gate.name === "source_portfolio_readiness")?.status ?? "blocker", dryRunOnly: true, proofCommand: "bun test src/tests/sourceSeeds.test.ts src/tests/storageCutover.test.ts", rollbackAction: "keep source activation dry-run and replay registry snapshot" },
    { migration: "analyst_loop", status: releaseArtifactBundle.gates.find((gate) => gate.name === "restricted_metadata_audit")?.status ?? "blocker", dryRunOnly: true, proofCommand: "bun run check:restricted-metadata-status", rollbackAction: "keep metadata review queue held and do not auto-promote restricted claims" },
    { migration: "evidence_search", status: releaseArtifactBundle.gates.find((gate) => gate.name === "evidence_chain")?.status ?? "blocker", dryRunOnly: true, proofCommand: "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts", rollbackAction: "rollback search alias and replay from evidence cursor checkpoint" },
    { migration: "graph_backend", status: releaseArtifactBundle.gates.find((gate) => gate.name === "graph_stix_readiness")?.status ?? "blocker", dryRunOnly: true, proofCommand: "bun run check:graph-review-mounted", rollbackAction: "hold graph export and preserve descriptor-only STIX/TAXII output" },
    { migration: "queue_backend", status: releaseArtifactBundle.gates.find((gate) => gate.name === "scheduler_status")?.status ?? "blocker", dryRunOnly: true, proofCommand: "bun test src/tests/schedulerProduction.test.ts", rollbackAction: "drain leases and return to embedded queue backend" }
  ];
  const rollbackCriteria: ReleaseTrainHardeningPacket["rollbackCriteria"] = [
    {
      target: "public_api_wrapper",
      criteria: [
        "public /ti or POST /api/ti/search proof fails",
        "known/random/made-up query semantics diverge from scraper-native search",
        "unknown query returns ready instead of Searching/queued/metadata_review",
        "route inventory or contract index drifts",
        "stale demo/cache prose appears"
      ],
      command: input.deploymentDrift.rollbackTarget.command,
      proofAfterRollback: "bun run check:scraper-native-search && TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof"
    },
    {
      target: "scraper_backend",
      criteria: [
        "RSS reaches or exceeds 160 GB",
        "queue runaway blocks interactive search",
        "evidence object corruption or cursor replay gap is present",
        "restricted emergency stop is active",
        "release candidate no-leak proof fails"
      ],
      command: input.deploymentDrift.rollbackTarget.command,
      proofAfterRollback: "bun run check:ti-release-candidate && bun test src/tests/ops.test.ts src/tests/api.test.ts src/tests/schedulerProduction.test.ts"
    }
  ];
  const remoteProofCommands = uniqueStrings([
    "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check'",
    "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:route-inventory'",
    "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:contract-index'",
    "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:deploy-hygiene'",
    "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:ti-release-candidate'",
    "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof"
  ]);
  const decision: ReleaseTrainHardeningDecision = signals.some((item) => item.decisionImpact === "needs-human-approval")
    ? "needs-human-approval"
    : signals.some((item) => item.decisionImpact === "rollback")
      ? "rollback"
      : signals.some((item) => item.decisionImpact === "hold")
        ? "hold"
        : releaseArtifactDecision === "needs-human-approval" || soakBoardDecision === "needs-human-approval"
          ? "needs-human-approval"
          : releaseArtifactDecision === "rollback" || soakBoardDecision === "rollback"
            ? "rollback"
            : releaseArtifactDecision === "hold" || soakBoardDecision === "hold"
              ? "hold"
              : "promote";
  return {
    schemaVersion: "ti.release_train_hardening.v1",
    dryRun: true,
    generatedAt: input.generatedAt ?? "dry-run",
    decision,
    resourcePolicy: {
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    },
    soakWindows: [
      {
        window: "7_day",
        status: statusFromDecision(sevenDayDecision),
        requiredSignals: ["seven_day_public_ti_soak", "deploy_mismatch_detection", "public_api_wrapper_rollback"],
        publicTiExpectation: "known/random/made-up query proof stays honest with 3-second polling and no stale ready answers for seven days",
        proofCommand: "bun run soak:production"
      },
      {
        window: "30_day",
        status: statusFromDecision(thirtyDayDecision),
        requiredSignals: ["thirty_day_capacity_forecast", "image_version_pinning", "migration_readiness", "scraper_backend_rollback"],
        publicTiExpectation: "30-day resource forecast preserves 96 GB target, 160 GB ceiling, 500 GB CTI reserve, disk-first evidence, and no GPU assumption",
        proofCommand: "bun test src/tests/ops.test.ts"
      }
    ],
    deployMismatchDetectors,
    imageVersionPins,
    migrationReadiness,
    rollbackCriteria,
    remoteProofCommands,
    signals,
    integrations: {
      releaseArtifactBundle: "wired",
      productionSoakDecisionBoard: "wired",
      onCallRunbookPack: "wired",
      resourceArbitration: "wired",
      capacitySimulation: "wired"
    },
    proofCommands: uniqueStrings([
      "bun run check",
      "bun test src/tests/ops.test.ts src/tests/api.test.ts src/tests/schedulerProduction.test.ts",
      "bun run check:ti-release-candidate",
      "bun run check:deploy-hygiene",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      "bun run check:remote-drift",
      "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof",
      ...remoteProofCommands,
      ...signals.map((item) => item.proofCommand)
    ]),
    operatorRunbook: [
      "use releaseTrainHardening.signals before promotion after the 24h board has passed",
      "require both 7-day public /ti proof and 30-day capacity forecast before widening release scope",
      "pin scraper, public API wrapper, frontend /ti, queue backend, and migration checkpoints before remote promotion",
      "rollback the public API wrapper before the scraper when only wrapper semantics drift",
      "rollback the scraper backend when resource pressure, queue runaway, evidence corruption, restricted emergency stop, or release-candidate no-leak proof fails"
    ],
    noLeakProof: "release train hardening emits image/config hashes, route names, service names, migration labels, counts, cursors, decisions, proof commands, and rollback criteria only; it excludes raw evidence, unsafe URLs, credentials, object keys, payload links, private material, and actor-interaction content"
  };
}


function worstEnterpriseDecision(decisions: EnterpriseReleaseDecision[]): EnterpriseReleaseDecision {
  const rank: Record<EnterpriseReleaseDecision, number> = {
    "promote": 0,
    "canary-ready": 1,
    "promote-with-warnings": 2,
    "canary-with-warnings": 3,
    "no-go": 4,
    "rollback": 5,
    "emergency-stop": 6
  };
  return decisions.reduce((worst, decision) => rank[decision] > rank[worst] ? decision : worst, "promote");
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
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

function buildEnterpriseObservabilityViews(
  input: CutoverSoakReleasePacketInput,
  metrics: ProductionObservabilityMetric[],
  realTimeSearchBoard: RealTimeSearchReleaseBoardPacket,
  productTiBoard: ProductTiReleaseBoardPacket
): ProductionObservabilityDashboardPacket["enterpriseViews"] {
  const metric = (name: ProductionObservabilityMetricName) => metrics.find((item) => item.name === name);
  const lane = (
    name: EnterpriseObservabilityLaneName,
    owner: string,
    status: EnterpriseObservabilityLane["status"],
    metricValue: number,
    warnAt: number,
    criticalAt: number,
    unit: EnterpriseObservabilityLane["unit"],
    alertName: EnterpriseObservabilityLane["alertName"],
    failureClassification: string,
    releaseImpact: EnterpriseObservabilityLane["releaseImpact"],
    proofCommand: string,
    rollbackRecommendation: string,
    noLeakExample: string
  ): EnterpriseObservabilityLane => ({
    name,
    owner,
    status,
    metricValue,
    warnAt,
    criticalAt,
    unit,
    alertName,
    failureClassification,
    releaseImpact,
    proofCommand,
    rollbackRecommendation,
    noLeakExample
  });
  const releaseImpact = (status: "pass" | "warning" | "blocker"): EnterpriseObservabilityLane["releaseImpact"] => status === "blocker" ? "hold" : status === "warning" ? "watch" : "none";
  const memoryStatus = metric("memory_rss_max_gb")?.status ?? "blocker";
  const queueStatus = metric("queue_age_p95_seconds")?.status ?? "blocker";
  const sourceStatus = worstProofStatus([metric("source_unavailable_rate_percent")?.status ?? "blocker", metric("adapter_failure_rate_percent")?.status ?? "blocker"]);
  const evidenceStatus = metric("evidence_write_read_proof")?.status ?? "blocker";
  const graphStatus = metric("graph_export_readiness")?.status ?? "blocker";
  const publicProofStatus = metric("public_proof_matrix")?.status ?? "blocker";
  const apiLatencyStatus = metric("initial_latency_p95_ms")?.status ?? "blocker";
  const pollingStatus = metric("partial_latency_p95_ms")?.status ?? "blocker";
  const parserStatus = metric("adapter_failure_rate_percent")?.status ?? "blocker";
  const workerStatus = metric("worker_saturation_percent")?.status ?? "blocker";
  const policyStatus = metric("policy_block_rate_percent")?.status ?? "blocker";
  const restrictedStatus: "pass" | "warning" | "blocker" = input.trends.restrictedKillSwitch.active ? "blocker" : policyStatus;
  const releaseTrainStatus = realTimeSearchBoard.decision === "emergency-stop" || input.trends.restrictedKillSwitch.active
    ? "blocker"
    : realTimeSearchBoard.decision === "no-go" || realTimeSearchBoard.decision === "rollback"
      ? "blocker"
      : realTimeSearchBoard.decision === "canary-with-warnings" || realTimeSearchBoard.decision === "promote-with-warnings" || productTiBoard.decision === "partial-public-ok"
        ? "warning"
        : "pass";
  const lanes: EnterpriseObservabilityLane[] = [
    lane("queue_health", "Agent 02/10", queueStatus, input.soak.summary.queueAgeP95Seconds, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxQueueAgeP95Seconds, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxQueueAgeP95Seconds * 2, "seconds", "queue_pressure", "queue pressure", releaseImpact(queueStatus), "bun test src/tests/schedulerProduction.test.ts", "drain low-priority queues and reuse active runs", "queue ids, run ids, cursors, and age buckets only"),
    lane("source_health", "Agent 01/03/04/10", sourceStatus, input.soak.summary.sourceUnavailableRatePercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxSourceUnavailableRatePercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxSourceUnavailableRatePercent * 2, "percent", "source_outage_wave", "source outage wave", releaseImpact(sourceStatus), "bun test src/tests/sourceSeeds.test.ts src/tests/adapterContracts.test.ts src/tests/publicSignalFusion.test.ts", "pause failing sources and keep public answers caveated", "source ids, source families, health buckets, and URL hashes only"),
    lane("evidence_yield", "Agent 06/10", evidenceStatus, metric("evidence_write_read_proof")?.value ?? 0, 1, 0, "boolean", "evidence_store_degradation", "evidence-store degradation", releaseImpact(evidenceStatus), "bun test src/tests/storageCutover.test.ts src/tests/evidenceEndpoints.test.ts", "hold evidence promotion and run backup/restore proof", "capture ids, ledger ids, content hashes, and redacted summaries only"),
    lane("extraction_quality", "Agent 07/10", parserStatus, input.soak.summary.errorRatePercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxErrorRatePercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxErrorRatePercent * 2, "percent", "parser_failure_spike", "parser failure spike", releaseImpact(parserStatus), "bun test src/tests/pipeline.test.ts src/tests/parserProfiles.test.ts", "hold ready wording and route parser gaps to Agent 03/07", "extractor versions, parser warnings, evidence ids, and confidence buckets only"),
    lane("graph_review_holds", "Agent 08/10", graphStatus, metric("graph_export_readiness")?.value ?? 0, 1, 0, "boolean", "graph_export_hold", "graph export hold", releaseImpact(graphStatus), "bun run check:graph-review-mounted", "hold STIX/export promotion until graph review clears", "relationship ids, review states, and STIX-safe descriptors only"),
    lane("api_latency", "Agent 09/10", apiLatencyStatus, input.soak.summary.initialLatencyP95Ms, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.initialLatencyP95Ms, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.initialLatencyP95Ms * 2, "ms", "api_client_compatibility_drift", "API latency or compatibility drift", releaseImpact(apiLatencyStatus), "bun test src/tests/api.test.ts", "restore wrapper fallback or return queued/searching response", "status, run ids, cursors, and warning codes only"),
    lane("public_polling_latency", "Agent 07/09/10", pollingStatus, input.soak.summary.partialLatencyP95Ms, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.partialLatencyP95Ms, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.partialLatencyP95Ms * 2, "ms", "public_wrapper_regression", "public wrapper regression", releaseImpact(pollingStatus), "bun run check:live-search-deploy", "raise poll interval and serve partial/searching responses", "poll cursors, delta cursors, status, and summary only"),
    lane("memory_disk_usage", "Agent 10", memoryStatus, input.soak.summary.memoryRssMaxGb, 96, 160, "gb", "memory_or_disk_pressure", "memory or disk pressure", memoryStatus === "blocker" ? "rollback" : releaseImpact(memoryStatus), "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot", "stop browser workers, reduce concurrency, and preserve disk-first evidence", "RSS, disk class, object counts, and cache sizes only"),
    lane("worker_saturation", "Agent 02/10", workerStatus, input.soak.summary.workerSaturationPercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxWorkerSaturationPercent, 95, "percent", "queue_pressure", "worker saturation", releaseImpact(workerStatus), "bun test src/tests/schedulerProduction.test.ts", "reduce worker concurrency before increasing resources", "worker pool names, counts, and saturation ratios only"),
    lane("error_budget", "Agent 03/04/07/10", sourceStatus, input.soak.summary.errorRatePercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxErrorRatePercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxErrorRatePercent * 2, "percent", "parser_failure_spike", "adapter/parser error budget", releaseImpact(sourceStatus), "bun test src/tests/adapterRegressionContracts.test.ts src/tests/pipeline.test.ts", "pause noisy adapters and require fixture repair", "adapter ids, failure categories, and source hashes only"),
    lane("freshness_slo", "Agent 01/07/10", input.soak.summary.staleCacheRatePercent > DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxStaleCacheRatePercent ? "blocker" : input.soak.summary.staleCacheRatePercent > 0 ? "warning" : "pass", input.soak.summary.staleCacheRatePercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxStaleCacheRatePercent, DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxStaleCacheRatePercent * 2, "percent", "freshness_slo_breach", "freshness SLO breach", input.soak.summary.staleCacheRatePercent > DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxStaleCacheRatePercent ? "hold" : input.soak.summary.staleCacheRatePercent > 0 ? "watch" : "none", "bun test src/tests/sourceSeeds.test.ts src/tests/pipeline.test.ts", "keep stale caveats and schedule source freshness repair", "source ids, last-success timestamps, and caveat codes only"),
    lane("deployment_drift", "Agent 09/10", input.deploymentDrift.state === "rollback" ? "blocker" : input.deploymentDrift.state === "drift" ? "warning" : "pass", input.deploymentDrift.blockedPromotionReasons.length, 1, 2, "count", "api_client_compatibility_drift", "deployment drift", input.deploymentDrift.state === "rollback" ? "rollback" : input.deploymentDrift.state === "drift" ? "watch" : "none", "bun run check:remote-drift", "use last-known-good source/image/compose rollback target", "source hashes, image ids, compose hashes, and health states only"),
    lane("release_train_state", "Agent 10", releaseTrainStatus, input.trends.rollbackTriggers.length, 1, 2, "count", input.trends.restrictedKillSwitch.active ? "restricted_metadata_emergency_stop" : "release_train_hold", "release train state", releaseTrainStatus === "blocker" && input.trends.restrictedKillSwitch.active ? "emergency-stop" : releaseImpact(releaseTrainStatus), "bun run plan:cutover examples/cutover-rehearsal-pass.json", "hold release train or execute emergency stop according to rollback packet", "decision names, proof commands, and rollback paths only")
  ];
  return {
    lanes,
    integrations: {
      agent01SourceGovernance: lanes.find((item) => item.name === "source_health")?.status ?? "blocker",
      agent02Scheduler: lanes.find((item) => item.name === "queue_health")?.status ?? "blocker",
      agent03AdapterObservatory: lanes.find((item) => item.name === "error_budget")?.status ?? "blocker",
      agent04CoverageRadar: lanes.find((item) => item.name === "source_health")?.status ?? "blocker",
      agent05RestrictedPlaybooks: restrictedStatus,
      agent06EvidenceLedger: evidenceStatus,
      agent07QualityGates: lanes.find((item) => item.name === "extraction_quality")?.status ?? "blocker",
      agent08GraphBackend: graphStatus,
      agent09ApiContracts: publicProofStatus,
      agent10ReleaseTrain: releaseTrainStatus
    },
    resourceBudget: {
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    }
  };
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

function buildValueProgramOpsSoakPacket(
  input: CutoverSoakReleasePacketInput,
  capacitySimulation: CapacityCostSimulationPacket,
  productionSoakDecisionBoard: ProductionSoakDecisionBoardPacket,
  onCallRunbookPack: OnCallRunbookPack,
  releaseTrainHardening: ReleaseTrainHardeningPacket
): ValueProgramOpsSoakPacket {
  const memoryStatus: ValueProgramOpsReleaseGate["status"] = input.trends.resources.memoryRssMaxGb > 160
    ? "blocker"
    : input.trends.resources.memoryRssMaxGb > 96 || input.promotionPacket.resourceBudget.nonScraperReservedGb < 500
      ? "warning"
      : "pass";
  const unsafeStatus: ValueProgramOpsReleaseGate["status"] = input.trends.unsafeRejections.rejectedUnsafeActions > 0 || input.trends.restrictedKillSwitch.active
    ? "blocker"
    : "pass";
  const publicStarvationStatus: ValueProgramOpsReleaseGate["status"] = input.soak.summary.initialLatencyP95Ms > DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.initialLatencyP95Ms * 2
    || input.soak.summary.partialLatencyP95Ms > DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.partialLatencyP95Ms * 2
    || input.trends.queuePressure.p95Seconds > DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxQueueAgeP95Seconds * 2
    ? "blocker"
    : input.soak.summary.initialLatencyP95Ms > DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.initialLatencyP95Ms
      || input.soak.summary.partialLatencyP95Ms > DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.partialLatencyP95Ms
      || input.trends.queuePressure.p95Seconds > DEFAULT_LIVE_SEARCH_SOAK_CRITERIA.maxQueueAgeP95Seconds
        ? "warning"
        : "pass";
  const inspurStatus: ValueProgramOpsReleaseGate["status"] = input.deploymentDrift.state === "rollback"
    ? "blocker"
    : input.deploymentDrift.state === "drift"
      ? "warning"
      : "pass";
  const sourceAtlasStatus: ValueProgramOpsReleaseGate["status"] = input.trends.sourceSlo.minCoveragePercent < 40
    ? "blocker"
    : input.trends.sourceSlo.minCoveragePercent < 70
      ? "warning"
      : "pass";
  const darkwebStatus: ValueProgramOpsReleaseGate["status"] = unsafeStatus === "blocker"
    ? "blocker"
    : memoryStatus === "blocker" || publicStarvationStatus === "blocker"
      ? "warning"
      : "pass";
  const gate = (
    name: ValueProgramOpsGateName,
    owner: string,
    status: ValueProgramOpsReleaseGate["status"],
    decisionImpact: ValueProgramOpsSoakDecision,
    proofCommand: string,
    rollbackAction: string,
    evidence: string[]
  ): ValueProgramOpsReleaseGate => ({ name, owner, status, decisionImpact, proofCommand, rollbackAction, evidence });
  const gates = [
    gate("darkweb_60k_refresh_soak", "Agent 05", darkwebStatus, darkwebStatus === "blocker" ? "pause-side-tools" : "hold", "bun test src/tests/darkwebIndex.test.ts && bun run check:restricted-metadata-status", "pause dark-web metadata workers and keep the public API on indexed clear-web results", [
      "metadata-only indexing",
      `unsafeRejections=${input.trends.unsafeRejections.rejectedUnsafeActions}`,
      `queueP95=${input.trends.queuePressure.p95Seconds}`
    ]),
    gate("source_atlas_10k_import_soak", "Agent 01", sourceAtlasStatus, sourceAtlasStatus === "blocker" ? "hold" : "promote", "bun test src/tests/sourceSeeds.test.ts && bun run check:source-registry", "pause source-atlas import waves and keep manual approval required", [
      `sourceCoverage=${input.trends.sourceSlo.minCoveragePercent}`,
      "auto-activation disabled"
    ]),
    gate("public_search_starvation_guard", "Agent 10", publicStarvationStatus, publicStarvationStatus === "blocker" ? "pause-side-tools" : "hold", "bun run soak:production", "pause side-tool queues before live user search queues", [
      `initialP95=${input.soak.summary.initialLatencyP95Ms}`,
      `partialP95=${input.soak.summary.partialLatencyP95Ms}`
    ]),
    gate("unsafe_output_guard", "Agent 06", unsafeStatus, unsafeStatus === "blocker" ? "rollback" : "promote", "bun run check:restricted-metadata-status && bun test src/tests/evidenceEndpoints.test.ts", "activate restricted kill switch and quarantine affected captures", [
      `restrictedKillSwitch=${input.trends.restrictedKillSwitch.active}`,
      "no raw unsafe URLs or bodies in public outputs"
    ]),
    gate("host_resource_guard", "Agent 10", memoryStatus, memoryStatus === "blocker" ? "rollback" : "hold", "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot", "drop browser/darkweb/source-atlas worker concurrency before touching API/frontend capacity", [
      `memoryGb=${input.trends.resources.memoryRssMaxGb}`,
      `nonScraperReservedGb=${input.promotionPacket.resourceBudget.nonScraperReservedGb}`
    ]),
    gate("inspur_deployment_proof", "Agent 10", inspurStatus, inspurStatus === "blocker" ? "rollback" : "hold", "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof && bun run check:remote-drift", "restore last-known-good image and rerun public curl proof", [
      `deploymentDrift=${input.deploymentDrift.state}`,
      `capacitySimulation=${capacitySimulation.aggregate.worstDecision}`,
      `productionSoakDecision=${productionSoakDecisionBoard.decision}`
    ])
  ];
  const worst = worstProofStatus(gates.map((item) => item.status));
  const decision: ValueProgramOpsSoakDecision = input.trends.restrictedKillSwitch.active
    ? "needs-human-approval"
    : unsafeStatus === "blocker"
      ? "rollback"
    : worst === "blocker"
      ? "pause-side-tools"
      : worst === "warning"
        ? "hold"
        : "promote";
  const proofCommands = uniqueStrings([
    ...gates.map((item) => item.proofCommand),
    ...capacitySimulation.proofCommands,
    ...productionSoakDecisionBoard.proofCommands,
    ...onCallRunbookPack.proofCommands,
    ...releaseTrainHardening.proofCommands
  ]);

  return {
    schemaVersion: "ti.value_program.ops_soak.v1",
    dryRun: true,
    generatedAt: input.generatedAt ?? "dry-run",
    decision,
    resourcePolicy: {
      scraperTargetGb: 96,
      scraperCeilingGb: 160,
      preserveCtiReserveGb: 500,
      browserPoolDisabled: true,
      boundedCaches: true,
      diskFirstEvidence: true,
      assumesGpu: false
    },
    sideToolBudgets: [
      {
        tool: "dark_web_metadata_index",
        owner: "Agent 05",
        queuePartition: "restricted_metadata_low_priority",
        recordTarget: 60_000,
        refreshCadence: "daily_high_value_weekly_default",
        memoryReservationGb: 12,
        memoryCeilingGb: 24,
        maxQueueAgeP95Seconds: 900,
        maxWorkerSaturationPercent: 70,
        yieldsTo: ["interactive_live_search", "public_collection", "public_channel", "api_frontend"],
        pauseCommand: "set TI_DARKWEB_INDEX_ENABLED=false and drain restricted_metadata_low_priority workers",
        resumeGate: "unsafe_output_guard=pass public_search_starvation_guard=pass host_resource_guard=pass"
      },
      {
        tool: "source_atlas_discovery_import",
        owner: "Agent 01",
        queuePartition: "source_discovery_low_priority",
        recordTarget: 10_000,
        refreshCadence: "weekly_import_monthly_full_rescore",
        memoryReservationGb: 10,
        memoryCeilingGb: 18,
        maxQueueAgeP95Seconds: 1200,
        maxWorkerSaturationPercent: 65,
        yieldsTo: ["interactive_live_search", "public_collection", "public_channel", "api_frontend"],
        pauseCommand: "set TI_SOURCE_ATLAS_IMPORT_ENABLED=false and keep candidates in pending_review",
        resumeGate: "source_atlas_10k_import_soak=pass public_search_starvation_guard=pass"
      }
    ],
    refreshSoak: {
      windowHours: 24,
      checkpointsHours: [1, 6, 12, 24],
      gates
    },
    alertThresholds: [
      { name: "darkweb_unsafe_attempts", severity: "rollback", threshold: ">0 unsafe fetch attempts outside disposable metadata collector", operatorAction: "activate restricted kill switch and quarantine the run", proofCommand: "bun run check:restricted-metadata-status" },
      { name: "darkweb_raw_url_leak", severity: "emergency", threshold: "any raw unsafe URL/body in public API, logs, or UI", operatorAction: "rollback public API and rotate affected artifacts", proofCommand: "bun test src/tests/darkwebIndex.test.ts src/tests/evidenceEndpoints.test.ts" },
      { name: "darkweb_review_backlog", severity: "hold", threshold: "metadata review backlog grows for two checkpoints", operatorAction: "pause new darkweb indexing waves", proofCommand: "bun run check:restricted-metadata-status" },
      { name: "source_atlas_auto_activation", severity: "rollback", threshold: "candidate source activated without policy approval", operatorAction: "disable source-atlas import and mark candidates pending_review", proofCommand: "bun test src/tests/sourceSeeds.test.ts" },
      { name: "source_atlas_queue_flood", severity: "hold", threshold: "source discovery queue p95 above 20 minutes", operatorAction: "cap import waves and preserve live-search workers", proofCommand: "bun run soak:production" },
      { name: "public_ti_latency_starvation", severity: "rollback", threshold: "public initial or partial p95 exceeds 2x soak budget", operatorAction: "pause side tools before reducing user-facing search", proofCommand: "bun run soak:production" },
      { name: "scraper_memory_pressure", severity: "hold", threshold: "scraper RSS above 96 GB", operatorAction: "reduce side-tool concurrency and browser workers", proofCommand: "docker exec hanasand_ti_scraper wget -qO- http://localhost:8097/v1/ops/resource-snapshot" },
      { name: "cti_reserve_pressure", severity: "rollback", threshold: "non-scraper reserve below 500 GB", operatorAction: "stop side-tool workers and hold promotion", proofCommand: "bun run check:remote-drift" }
    ],
    safetyIncidentDrills: [
      { name: "unsafe_target_attempt", expectedDecision: "rollback", firstResponse: "kill restricted collector, quarantine capture metadata, and preserve audit hashes only", proofCommand: "bun run check:restricted-metadata-status", rollbackOrResume: "resume only after unsafe_output_guard passes" },
      { name: "raw_url_leak_regression", expectedDecision: "rollback", firstResponse: "rollback public responses and scrub public caches", proofCommand: "bun test src/tests/darkwebIndex.test.ts src/tests/evidenceEndpoints.test.ts", rollbackOrResume: "redeploy after public proof shows sanitized URLs only" },
      { name: "collector_quarantine_overflow", expectedDecision: "pause-side-tools", firstResponse: "pause dark-web metadata queue and keep clear-web live search running", proofCommand: "bun run soak:production", rollbackOrResume: "resume with lower concurrency after queue p95 recovers" },
      { name: "source_atlas_auto_activation", expectedDecision: "rollback", firstResponse: "disable source import promotion and return all candidates to pending_review", proofCommand: "bun test src/tests/sourceSeeds.test.ts", rollbackOrResume: "resume after approval ledger proof" },
      { name: "public_search_starvation", expectedDecision: "pause-side-tools", firstResponse: "pause side-tool partitions and reserve workers for user queries", proofCommand: "bun run soak:production", rollbackOrResume: "resume side tools after latency p95 returns to budget" }
    ],
    deploymentProof: {
      localProofCommands: ["bun run check", "bun test", "bun run check:route-inventory", "bun run check:contract-index"],
      inspurProofCommands: [
        "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check'",
        "ssh inspur 'cd /srv/hanasand/ti/scraper && bun test src/tests/darkwebIndex.test.ts src/tests/sourceSeeds.test.ts src/tests/ops.test.ts'",
        "ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:deploy-hygiene'"
      ],
      publicProofCommand: "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof",
      requiredBeforePromotion: true
    },
    integrations: {
      capacitySimulation: "wired",
      productionSoakDecisionBoard: "wired",
      onCallRunbookPack: "wired",
      releaseTrainHardening: "wired"
    },
    proofCommands,
    operatorRunbook: [
      "keep dark-web and source-atlas side tools on low-priority partitions",
      "pause side tools before allowing them to starve public TI search",
      "preserve metadata-only boundaries and never promote raw unsafe URLs or bodies",
      "source-atlas import remains dry-run and must not mutate source registry, lease frontier work, or auto-activate candidates",
      "hold source-atlas auto-activation until policy approval is recorded",
      "capture local, Inspur, and public proof before promotion"
    ],
    noLeakProof: "public outputs expose only safe IDs, hashes, summaries, legality labels, and review state"
  };
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
