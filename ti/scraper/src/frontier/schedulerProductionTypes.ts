import type { FocusedFrontier, FrontierAck, FrontierGroupSummary, QueuedFrontierItem } from "./frontier.ts";
import type { CollectionPlan, CollectionRun, CollectionTask, LiveSearchBackpressureState, PlannerDecisionStatus, PlanningBudgetClass, RunStatus, SourceRecord } from "../types.ts";

export type SchedulerBackend = "embedded_memory" | "postgres_queue" | "external_queue";

export type SchedulerWorkClass =
  | PlanningBudgetClass
  | "public_channel_probe"
  | "replay_retention";

export interface SchedulerCutoverDesign {
  currentBackend: SchedulerBackend;
  targetBackend: SchedulerBackend;
  contractInvariants: string[];
  durableTables: Array<{
    name: string;
    purpose: string;
  }>;
  leaseTransactionSteps: string[];
  acknowledgementSteps: string[];
  apiContract: string;
}

export interface SchedulerLoadModelFixture {
  name: string;
  liveSearchPollers: number;
  expectedPollsPerMinute: number;
  expectedNewRunsPerMinute: number;
  analystDeepDives: number;
  sourceHealthProbes: number;
  restrictedMetadataSweeps: number;
  replayRetentionJobs: number;
  maxQueueAgeSeconds: Record<SchedulerWorkClass, number>;
}

export interface SchedulerStarvationSignal {
  workClass: SchedulerWorkClass;
  fairnessGroup: string;
  queued: number;
  maxQueueAgeSeconds: number;
  thresholdSeconds: number;
  recoveryAction: "raise_priority" | "reserve_worker_slot" | "split_queue_partition" | "none";
}

export type ActiveRunGcAction =
  | "keep_active"
  | "mark_stale_failed"
  | "mark_abandoned_cancelled"
  | "retain_completed_pending_deltas"
  | "archive_completed"
  | "retry_failed";

export interface ActiveRunGcDecision {
  runId: string;
  status: CollectionRun["status"];
  action: ActiveRunGcAction;
  reason: string;
  nextActionableAt?: string;
}

export interface ActiveRunGcOptions {
  staleActiveRunMs?: number;
  abandonedPollingMs?: number;
  completedDeltaHoldMs?: number;
  failedRetryDelayMs?: number;
  activePollingRunIds?: Set<string>;
  pendingDeltaRunIds?: Set<string>;
}

export interface SchedulerDiagnosticItem {
  taskId: string;
  runId?: string;
  requestId?: string;
  tenantId?: string;
  sourceId: string;
  sourceType: CollectionTask["sourceType"];
  workClass: SchedulerWorkClass;
  runReuseKey?: string;
  pressureState: LiveSearchBackpressureState;
  queueAgeSeconds: number;
  fairnessGroup: string;
  droppedMergedDuplicateCount: number;
  selectedTaskCount: number;
  skippedTaskCount: number;
  blockedTaskCount: number;
  retryAfterSeconds?: number;
  nextActionableAt?: string;
}

export interface SchedulerDiagnostics {
  generatedAt: string;
  backend: SchedulerBackend;
  summary: FrontierGroupSummary;
  loadFixtures: SchedulerLoadModelFixture[];
  starvation: SchedulerStarvationSignal[];
  activeRunGc: ActiveRunGcDecision[];
  diagnostics: SchedulerDiagnosticItem[];
}

export type SchedulerRuntimeAckStatus = "completed" | "failed" | "cancelled";

export interface SchedulerRuntimeDelta {
  cursor: string;
  at: string;
  kind:
    | "task_enqueued"
    | "task_leased"
    | "task_checkpointed"
    | "worker_heartbeat"
    | "task_completed"
    | "task_retry_scheduled"
    | "task_failed"
    | "task_cancelled"
    | "run_cancelled"
    | "run_reused"
    | "run_registered";
  taskId?: string;
  runId?: string;
  reuseKey?: string;
  message: string;
}

export interface SchedulerLease {
  task: CollectionTask;
  workerId: string;
  leasedAt: string;
  lastHeartbeatAt: string;
  leaseExpiresAt: string;
  checkpointCursor?: string;
  checkpointMessage?: string;
}

export interface SchedulerPressureDto {
  generatedAt: string;
  workClass: SchedulerWorkClass;
  fairnessGroup: string;
  queueAgeSeconds: number;
  duplicateReuseCount: number;
  selectedTaskCount: number;
  skippedTaskCount: number;
  blockedTaskCount: number;
  retryAfterSeconds?: number;
  nextActionableAt?: string;
  pressureState: LiveSearchBackpressureState;
}

export interface SchedulerQueueRepository {
  enqueueTasks(tasks: CollectionTask[], now?: Date): SchedulerRuntimeDelta[];
  leaseNext(workerId: string, now?: Date): SchedulerLease | undefined;
  heartbeatLease(taskId: string, workerId: string, now?: Date): SchedulerRuntimeDelta;
  checkpointTask(taskId: string, workerId: string, checkpoint: SchedulerTaskCheckpoint, now?: Date): SchedulerRuntimeDelta;
  acknowledge(taskId: string, status: SchedulerRuntimeAckStatus, now?: Date, reason?: string): SchedulerRuntimeDelta;
  cancelRun(runId: string, now?: Date, reason?: string): SchedulerRuntimeDelta[];
  findOrRegisterRun(run: CollectionRun, reuseKey?: string, now?: Date): { run: CollectionRun; reused: boolean; duplicateReuseCount: number };
  gcActiveRuns(now?: Date, options?: ActiveRunGcOptions): ActiveRunGcDecision[];
  pressure(now?: Date): SchedulerPressureDto[];
  deltasSince(cursor?: string): SchedulerRuntimeDelta[];
  runs(): CollectionRun[];
  tasks(): CollectionTask[];
}

export interface SchedulerTaskCheckpoint {
  cursor: string;
  message: string;
  promotedEvidenceCount?: number;
  partialReason?: string;
}

export interface SchedulerPollingContract {
  nextPollSeconds: number;
  nextPollAt: string;
  cursorContinuity: "not_started" | "continued" | "waiting_for_deltas" | "blocked" | "cancelled";
  latestCursor?: string;
  promotedEvidenceCount: number;
  partialReasons: string[];
}

export interface SchedulerWorkerRuntimeFixture {
  name:
    | "normal"
    | "degraded_provider_failure"
    | "overloaded"
    | "cancelled"
    | "retry_exhausted"
    | "duplicate_query"
    | "stale_active_run"
    | "soak_24h";
  state: "normal" | "degraded" | "overloaded" | "cancelled" | "retry_exhausted" | "duplicate_query" | "stale_active_run" | "soak_24h";
  workerLoop: {
    lease: "required";
    heartbeat: "required";
    checkpoint: "required";
    acknowledgement: "required";
    cancellation: "supported";
  };
  queuePressure: LiveSearchBackpressureState;
  retryAfterSeconds?: number;
  deadLetter: boolean;
  polling: SchedulerPollingContract;
  agent09Fields: string[];
  agent10GateFields: string[];
}

export interface SchedulerSoakScenario {
  name: string;
  liveSearchPollers: number;
  actorQueriesPerMinute: number;
  publicChannelPollsPerMinute: number;
  sourceHealthProbes: number;
  darknetApprovalQueue: number;
  retentionReplayJobs: number;
  analystDeepDives: number;
  maxMemoryMb: number;
  maxWorkerPoolSlots: number;
}

export interface SchedulerSoakEvaluation {
  scenario: string;
  accepted: boolean;
  reasons: string[];
  expectedQueuePressure: LiveSearchBackpressureState;
}

export interface SchedulerExecutionTraffic {
  actorQueriesPerHour: number;
  repeatedPollsPerHour: number;
  backgroundSweepsPerHour: number;
  publicChannelWindowsPerHour: number;
  restrictedMetadataApprovalsPerHour: number;
  evidenceReplayJobsPerHour: number;
  graphExportJobsPerHour: number;
  retentionJobsPerHour: number;
  providerOutage?: boolean;
  restrictedSourcesDisabled?: boolean;
  inactiveClientRatio?: number;
  emergencyBrakeRecoveryAtHour?: number;
}

export interface SchedulerExecutionSloThresholds {
  queueAgeP95Seconds: number;
  leaseAgeP95Seconds: number;
  retryExhaustionRate: number;
  perSourceFairnessWorstShare: number;
  interactiveSearchLatencyP95Ms: number;
  pollFreshnessP95Seconds: number;
  workerMemoryPressure: number;
}

export interface SchedulerExecutionSloFields {
  queueAge: { p95Seconds: number; maxSeconds: number; ok: boolean };
  leaseAge: { p95Seconds: number; maxSeconds: number; ok: boolean };
  retryExhaustion: { rate: number; exhaustedTasks: number; ok: boolean };
  perSourceFairness: { worstShare: number; noisySourceId?: string; ok: boolean };
  interactiveSearchLatency: { p95Ms: number; ok: boolean };
  pollFreshness: { p95Seconds: number; ok: boolean };
  workerMemoryPressure: { ratio: number; ok: boolean };
}

export interface SchedulerBackpressureSummary {
  state: LiveSearchBackpressureState;
  reasons: string[];
  recommendedAction: "accept" | "defer" | "shed" | "recover";
  emergencyBrakeState: SchedulerPromotionGate["emergencyBrakeState"];
  slo: SchedulerExecutionSloFields;
  agent09Compatibility: {
    fields: string[];
    publicStatus: "compatible" | "degraded" | "blocked";
  };
  agent10SoakPacket: {
    promotionGateFields: string[];
    soakDecision: "pass" | "hold" | "rollback";
    proofCommand: string;
  };
}

export type SchedulerWorkerLoopStepName =
  | "lease"
  | "heartbeat"
  | "checkpoint"
  | "acknowledge"
  | "retry_backoff"
  | "stale_lease_recovery"
  | "duplicate_run_reuse"
  | "abandoned_client_cleanup"
  | "cancellation"
  | "cursor_continuity";

export interface SchedulerWorkerLoopContractStep {
  name: SchedulerWorkerLoopStepName;
  required: boolean;
  runtimeEvent: SchedulerRuntimeDelta["kind"];
  invariant: string;
  apiFields: string[];
}

export interface SchedulerWorkerLoopContract {
  generatedAt: string;
  workerLoop: SchedulerWorkerLoopContractStep[];
  staleLeaseRecovery: {
    leaseTtlSeconds: number;
    recoveryEvent: Extract<SchedulerRuntimeDelta["kind"], "task_retry_scheduled">;
    preservesCheckpoint: boolean;
  };
  retryBackoff: {
    baseSeconds: number;
    maxRetriesDefault: number;
    strategy: "exponential";
  };
  abandonedClientCleanup: {
    staleActiveRunSeconds: number;
    abandonedPollingSeconds: number;
    action: ActiveRunGcAction;
  };
  cursorContinuity: {
    requiredDeltas: SchedulerRuntimeDelta["kind"][];
    apiFields: string[];
  };
}

export interface SchedulerCapacityShiftPlanStep {
  id: string;
  fromWorkload: "interactive_actor_search" | "public_channel_windows" | "restricted_metadata_approvals" | "evidence_replay" | "graph_export" | "retention" | "background_sweeps";
  toWorkload: "interactive_actor_search" | "public_channel_windows" | "restricted_metadata_approvals" | "evidence_replay" | "graph_export" | "retention" | "background_sweeps";
  workerSlotDelta: number;
  reason: string;
  approval: SchedulerApplyApproval;
  preconditions: string[];
  rollback: string;
}

export interface SchedulerQueueEconomicsDto {
  generatedAt: string;
  apiTargets: Array<"/v1/frontier/status" | "/v1/intel/search.scheduler" | "agent10_soak_packet">;
  totals: {
    queued: number;
    leased: number;
    deadLetters: number;
    retryDebt: number;
    maxQueuedAgeSeconds: number;
  };
  workClassBudget: Array<{
    workClass: SchedulerWorkClass;
    queued: number;
    leased: number;
    budgetSlots: number;
    budgetShare: number;
    maxQueuedAgeSeconds: number;
    retryDebt: number;
    recommendedAction: "accept" | "reserve_capacity" | "defer_low_priority" | "pause_noisy_source";
  }>;
  fairness: {
    worstGroup?: string;
    worstShare: number;
    ok: boolean;
  };
  interactiveLatency: {
    p95Ms: number;
    ok: boolean;
  };
  deadLetterTrend: {
    window: "24h";
    count: number;
    direction: "flat" | "rising";
    retryExhaustionRate: number;
  };
  memoryPressure: {
    ratio: number;
    ok: boolean;
  };
  emergencyBrakeState: SchedulerPromotionGate["emergencyBrakeState"];
  dryRunCapacityShiftPlan: {
    dryRun: true;
    willMutate: false;
    steps: SchedulerCapacityShiftPlanStep[];
  };
  agent10SoakPacket: {
    fields: string[];
    decision: "pass" | "hold" | "rollback";
    proofCommands: string[];
  };
}

export type SchedulerRuntimeControlAction =
  | "pause_noisy_sources"
  | "move_background_behind_interactive"
  | "reduce_public_channel_windows"
  | "hold_restricted_metadata"
  | "hold_source_activation_batches";

export interface SchedulerRuntimeExecutionControl {
  id: string;
  action: SchedulerRuntimeControlAction;
  approval: SchedulerApplyApproval;
  reason: string;
  sourceIds: string[];
  workClasses: SchedulerWorkClass[];
  dryRun: true;
  willMutate: false;
  preconditions: string[];
  rollback: string;
}

export interface SchedulerRuntimeExecutionDto {
  generatedAt: string;
  apiTargets: Array<"/v1/intel/search.scheduler" | "/v1/intel/runs/{id}" | "/v1/frontier/status" | "agent10_soak_packet">;
  totals: {
    queued: number;
    leased: number;
    checkpointed: number;
    retried: number;
    acknowledged: number;
    cancelled: number;
    deadLettered: number;
    staleRecovered: number;
  };
  byRun: Array<{
    runId: string;
    queued: number;
    leased: number;
    checkpointed: number;
    retried: number;
    acknowledged: number;
    cancelled: number;
    deadLettered: number;
    staleRecovered: number;
    latestCursor?: string;
  }>;
  bySource: Array<{
    sourceId: string;
    queued: number;
    leased: number;
    retried: number;
    deadLettered: number;
    staleRecovered: number;
    noisy: boolean;
  }>;
  byWorkClass: Array<{
    workClass: SchedulerWorkClass;
    queued: number;
    leased: number;
    retried: number;
    cancelled: number;
    deadLettered: number;
    maxQueuedAgeSeconds: number;
  }>;
  pollingDeltas: {
    sinceCursor?: string;
    latestCursor?: string;
    cursorContinuity: "not_started" | "continued" | "waiting_for_deltas" | "blocked" | "cancelled";
    newDeltaCount: number;
    kinds: SchedulerRuntimeDelta["kind"][];
  };
  dryRunControls: {
    dryRun: true;
    willMutate: false;
    controls: SchedulerRuntimeExecutionControl[];
  };
  sourceActivationBudgetGuard: {
    state: "within_budget" | "hold_activation_batches" | "blocked_by_emergency_brake";
    estimatedActivationSlots: number;
    reason: string;
  };
  agent10SoakPacket: {
    fields: string[];
    decision: "pass" | "hold" | "rollback";
    proofCommands: string[];
  };
}

export type SchedulerRuntimeSlaState = "pass" | "watch" | "breach";

export interface SchedulerRuntimeSlaMetric {
  name:
    | "lease_latency"
    | "checkpoint_freshness"
    | "retry_debt"
    | "dead_letter_growth"
    | "abandoned_client_cleanup"
    | "run_reuse"
    | "fairness"
    | "source_sla_pressure"
    | "cursor_continuity";
  value: number;
  threshold: number;
  unit: "ms" | "seconds" | "count" | "ratio" | "percent";
  state: SchedulerRuntimeSlaState;
  impact: "none" | "public_answer_degraded" | "api_polling_degraded" | "worker_safety_risk" | "release_blocker";
  reason: string;
}

export interface SchedulerWorkerSafetyPlan {
  dryRun: true;
  willMutate: false;
  controls: SchedulerRuntimeExecutionControl[];
  recoveryActions: Array<{
    id: string;
    action: "recover_stale_leases" | "preserve_cursor_replay" | "hold_release_packet";
    approval: SchedulerApplyApproval;
    reason: string;
    preconditions: string[];
    rollback: string;
  }>;
}

export interface SchedulerRuntimeSlaDto {
  generatedAt: string;
  apiTargets: Array<"/v1/intel/search.scheduler" | "/v1/intel/runs/{id}" | "/v1/frontier/status" | "agent10_release_packet">;
  state: SchedulerRuntimeSlaState;
  metrics: SchedulerRuntimeSlaMetric[];
  breached: SchedulerRuntimeSlaMetric["name"][];
  watched: SchedulerRuntimeSlaMetric["name"][];
  publicAnswerImpact: "none" | "partial_only" | "degraded" | "blocked";
  apiPollingImpact: "normal" | "slow_poll" | "cursor_replay_required" | "blocked";
  workerSafetyPlan: SchedulerWorkerSafetyPlan;
  agent10ReleasePacket: {
    decision: "pass" | "hold" | "rollback";
    fields: string[];
    proofCommands: string[];
  };
}

export type SchedulerReleaseGateSeverity = "pass" | "warning" | "hold" | "rollback";

export type SchedulerReleaseGateReason =
  | "queue_age"
  | "lease_age"
  | "checkpoint_gap"
  | "retry_debt"
  | "dead_letters"
  | "abandoned_clients"
  | "duplicate_run_reuse"
  | "fairness_drift"
  | "source_sla_pressure"
  | "cursor_discontinuity";

export interface SchedulerReleaseGateFinding {
  reason: SchedulerReleaseGateReason;
  severity: Exclude<SchedulerReleaseGateSeverity, "pass">;
  metric?: SchedulerRuntimeSlaMetric["name"];
  value: number;
  threshold: number;
  message: string;
  apiImpact: "none" | "public_answer" | "api_polling" | "worker_safety" | "release";
}

export type SchedulerLiveRunDrainAction =
  | "drain_overloaded_live_search"
  | "drain_public_channel_backlog"
  | "hold_restricted_metadata"
  | "drain_graph_export_backlog"
  | "drain_evidence_replay_load"
  | "hold_source_activation_wave"
  | "recover_stale_leases"
  | "preserve_cursor_replay";

export interface SchedulerLiveRunDrainStep {
  id: string;
  action: SchedulerLiveRunDrainAction;
  severity: Exclude<SchedulerReleaseGateSeverity, "pass">;
  reason: SchedulerReleaseGateReason;
  sourceIds: string[];
  workClasses: SchedulerWorkClass[];
  runIds: string[];
  estimatedTaskDelta: number;
  dryRun: true;
  willMutate: false;
  approval: SchedulerApplyApproval;
  preconditions: string[];
  rollback: string;
}

export interface SchedulerSlaEnforcementDto {
  generatedAt: string;
  apiTargets: Array<"/v1/intel/search.scheduler" | "/v1/intel/runs/{id}" | "/v1/frontier/status" | "agent10_release_packet">;
  state: SchedulerReleaseGateSeverity;
  holds: SchedulerReleaseGateFinding[];
  warnings: SchedulerReleaseGateFinding[];
  releaseGate: {
    decision: "pass" | "promote_with_warnings" | "hold" | "rollback";
    dryRun: true;
    willMutate: false;
    publicAnswerImpact: SchedulerRuntimeSlaDto["publicAnswerImpact"];
    apiPollingImpact: SchedulerRuntimeSlaDto["apiPollingImpact"];
    proofCommand: string;
  };
  drainPlan: {
    dryRun: true;
    willMutate: false;
    steps: SchedulerLiveRunDrainStep[];
  };
  agent10ReleasePacket: {
    fields: string[];
    decision: "pass" | "hold" | "rollback";
    proofCommands: string[];
  };
}

export type SchedulerQueueBackendCandidate = "postgres_advisory_queue" | "redis_streams" | "nats_jetstream";

export type SchedulerWorkerWorkload =
  | "interactive_actor_search"
  | "scheduled_source_sweep"
  | "public_channel_window"
  | "restricted_metadata_approval"
  | "evidence_replay"
  | "graph_export"
  | "retention"
  | "health_probe";

export interface SchedulerWorkerQueuePartition {
  id: string;
  workload: SchedulerWorkerWorkload;
  workClasses: SchedulerWorkClass[];
  reservedWorkerSlots: number;
  maxConcurrentLeases: number;
  maxQueueAgeSeconds: number;
  leaseTtlSeconds: number;
  checkpointEverySeconds: number;
  ackMode: "idempotent_after_capture" | "idempotent_metadata_only" | "idempotent_after_export" | "idempotent_after_probe";
  retry: {
    baseSeconds: number;
    maxSeconds: number;
    maxAttempts: number;
    jitter: "deterministic";
  };
  deadLetter: {
    afterAttempts: number;
    routeTo: "operator_review" | "source_backoff" | "policy_review" | "replay_hold";
  };
  backpressurePolicy: "reserve_interactive_capacity" | "throttle_public_windows" | "hold_approval_queue" | "defer_background" | "shed_if_stale";
  drainBehavior: SchedulerLiveRunDrainAction;
  memoryBudgetMb: number;
}

export interface SchedulerBackendCutoverPacket {
  backend: SchedulerQueueBackendCandidate;
  dryRun: true;
  willMutate: false;
  readiness: "ready_for_rehearsal" | "hold_for_operator" | "blocked";
  requiredPrimitives: string[];
  transactionModel: string;
  leaseModel: string;
  checkpointModel: string;
  deadLetterModel: string;
  rollback: string;
}

export interface SchedulerWorkerQueueCutoverDto {
  generatedAt: string;
  apiTargets: Array<"/v1/intel/search.scheduler" | "/v1/intel/runs/{id}" | "/v1/frontier/status" | "agent10_release_packet">;
  runtime: {
    engine: "bun_worker_runtime";
    dryRun: true;
    willMutate: false;
    contractFields: string[];
  };
  semantics: {
    lease: string;
    checkpoint: string;
    acknowledgement: string;
    retryBackoff: string;
    deadLetter: string;
    runReuse: string;
    drain: string;
  };
  partitions: SchedulerWorkerQueuePartition[];
  capacityEnvelope: {
    normalMemoryTargetMb: 98304;
    hardCeilingMb: 163840;
    workerSlots: number;
    estimatedMemoryMb: number;
    normalTargetOk: boolean;
    hardCeilingOk: boolean;
    p95QueueAgeSeconds: number;
    p95LeaseAgeSeconds: number;
    expected24hTasks: number;
  };
  backendCutoverPackets: SchedulerBackendCutoverPacket[];
  releaseGate: {
    decision: "pass" | "hold" | "rollback";
    reasons: SchedulerReleaseGateReason[];
    proofCommands: string[];
  };
  agent10ReleasePacket: {
    fields: string[];
    decision: "pass" | "hold" | "rollback";
    proofCommands: string[];
  };
}

export interface SchedulerWorkerPartitionSoakSlo {
  partitionId: string;
  workload: SchedulerWorkerWorkload;
  queueAgeP95Seconds: number;
  queueAgeP99Seconds: number;
  leaseAgeP95Seconds: number;
  checkpointCadenceSeconds: number;
  retryDebtThreshold: number;
  deadLetterBudget: number;
  memoryPressureMax: number;
  runReuseMinRatio: number;
  duplicatePublicPollingMaxRatio: number;
  safeDrainControls: SchedulerLiveRunDrainAction[];
  state: "pass" | "watch" | "hold" | "rollback";
}

export interface SchedulerBackendMigrationPacket {
  id: "embedded_to_postgres" | "embedded_to_redis" | "embedded_to_nats";
  targetBackend: SchedulerQueueBackendCandidate;
  dryRun: true;
  willMutate: false;
  prerequisites: string[];
  cursorContinuity: "preserved";
  replayPreservation: "required";
  agent09WarningCodes: string[];
  rollback: string;
  readiness: "ready_for_rehearsal" | "hold_for_operator" | "blocked";
}

export interface SchedulerWorkerSoakMigrationDto {
  generatedAt: string;
  apiTargets: Array<"/v1/intel/search.scheduler" | "/v1/intel/runs/{id}" | "/v1/frontier/status" | "/v1/contracts" | "agent10_release_train">;
  durationHours: 24;
  dryRun: true;
  willMutate: false;
  partitionSlo: SchedulerWorkerPartitionSoakSlo[];
  aggregate: {
    state: "pass" | "watch" | "hold" | "rollback";
    queueAgeP95Seconds: number;
    queueAgeP99Seconds: number;
    retryDebtThreshold: number;
    deadLetterBudget: number;
    memoryPressure: number;
    runReuseRatio: number;
    duplicatePublicPollingRatio: number;
  };
  migrationPackets: SchedulerBackendMigrationPacket[];
  routeContracts: {
    frontierStatusField: "scheduler.workerSoakMigration";
    searchSchedulerField: "scheduler.workerSoakMigration";
    runStatusField: "scheduler.workerSoakMigration";
    contractsField: "surfaces.frontier.contracts.worker_soak_migration";
  };
  releaseTrain: {
    decision: "pass" | "hold" | "rollback";
    agent10Fields: string[];
    proofCommands: string[];
  };
}

export type SchedulerLeaseSoakScenarioName =
  | "apt29_actor_burst"
  | "public_channel_fanout"
  | "restricted_metadata_holds"
  | "evidence_replay_backlog"
  | "graph_export_wave"
  | "source_outage_wave"
  | "parser_failure_storm"
  | "low_value_sweep_pressure";

export interface SchedulerLeaseSoakWorkloadSlice {
  scenario: SchedulerLeaseSoakScenarioName;
  workload: SchedulerWorkerWorkload;
  taskCount: number;
  workerPartitionId: string;
  leaseAttempts: number;
  expectedCompletions: number;
  retryBudget: number;
  deadLetterBudget: number;
  requestDeadlineSeconds: number;
  queueAgeP95Seconds: number;
  expectedPressure: LiveSearchBackpressureState;
  fairnessGroup: string;
}

export interface SchedulerLeaseSoakWorkerPartition {
  partitionId: string;
  workload: SchedulerWorkerWorkload;
  workerCount: number;
  maxConcurrentLeases: number;
  leaseTtlSeconds: number;
  checkpointEverySeconds: number;
  maxQueueAgeSeconds: number;
  estimatedTasks: number;
  expectedDrainedWithinMinutes: number;
  concurrencyPolicy: "reserved_capacity" | "bounded_shared_capacity" | "held_for_review";
  backpressurePolicy: SchedulerWorkerQueuePartition["backpressurePolicy"];
  drainBehavior: SchedulerLiveRunDrainAction;
}

export interface SchedulerWorkerLeaseSoakHarnessDto {
  generatedAt: string;
  apiTargets: Array<"/v1/frontier/status" | "/v1/frontier/apply-plan" | "/v1/intel/search.scheduler" | "/v1/contracts" | "agent10_capacity_release_gate">;
  dryRun: true;
  willMutate: false;
  replay: {
    fixtureName: "agent02_10k_multi_worker_lease_replay";
    totalTasks: 10000;
    durationHours: 24;
    workerCount: number;
    simulatedTenants: number;
    simulatedSources: number;
    duplicateRunReuseRequired: true;
    cursorReplayRequired: true;
    restrictedMetadataPolicy: "metadata_only_approval_hold";
  };
  workloadSlices: SchedulerLeaseSoakWorkloadSlice[];
  workerPartitions: SchedulerLeaseSoakWorkerPartition[];
  leaseSemantics: {
    exclusiveLeases: true;
    heartbeatExpiryRecovery: "retry_with_checkpoint_cursor";
    retryBackoff: "deterministic_exponential_with_jitter";
    deadLetters: "operator_visible_isolated_lane";
    requestDeadlines: "deadline_checked_before_lease_and_before_ack";
    perSourceConcurrency: "never_bypassed_by_priority_aging";
  };
  fairnessProof: {
    dimensions: Array<"tenant" | "query_class" | "source_family" | "workload" | "restricted_policy_state">;
    worstShare: number;
    ok: boolean;
    priorityAgingEverySeconds: number;
    lowValueSweepsDeferred: boolean;
    publicPollingProtected: boolean;
    workloadShares: Array<{
      workload: SchedulerWorkerWorkload;
      taskShare: number;
      reservedWorkerSlots: number;
      maxQueueAgeSeconds: number;
    }>;
  };
  pressureFixtures: Array<{
    scenario: SchedulerLeaseSoakScenarioName;
    trigger: "actor_burst" | "fanout" | "approval_hold" | "replay_backlog" | "export_wave" | "source_outage" | "parser_failure" | "capacity_pressure";
    expectedSchedulerAction: "reuse_active_run" | "reserve_interactive_capacity" | "hold_restricted_metadata" | "drain_replay" | "drain_graph_export" | "source_backoff" | "retry_then_dead_letter" | "defer_low_value_sweeps";
    agent09VisibleStatus: LiveSearchBackpressureState;
    agent10ReleaseImpact: "none" | "watch" | "hold";
  }>;
  routeContracts: {
    frontierStatusField: "scheduler.workerLeaseSoakHarness";
    frontierApplyPlanField: "applyPlan.workerLeaseSoakHarness";
    searchSchedulerField: "scheduler.workerLeaseSoakHarness";
    contractsField: "surfaces.frontier.contracts.worker_lease_soak_harness";
  };
  releaseGate: {
    decision: "pass" | "hold" | "rollback";
    reasons: string[];
    proofCommands: string[];
  };
}

export type SchedulerProductionAdapterImplementation =
  | "embedded_memory"
  | "postgres_advisory_queue"
  | "redis_streams"
  | "nats_jetstream";

export type SchedulerSoakTelemetryScenario =
  | "source_canary_rollout"
  | "public_channel_canary"
  | "restricted_certification"
  | "evidence_replay"
  | "graph_export"
  | "public_ti_traffic";

export interface SchedulerProductionAdapterContract {
  implementation: SchedulerProductionAdapterImplementation;
  mode: "active" | "shadow" | "candidate";
  methods: Array<"enqueue" | "lease" | "checkpoint" | "acknowledge" | "retry" | "dead_letter" | "heartbeat" | "cancel" | "drain">;
  invariants: string[];
  telemetryFields: string[];
}

export interface SchedulerDeadLetterCauseTelemetry {
  cause: "provider_failure" | "policy_block" | "retry_exhausted" | "deadline_expired" | "adapter_error";
  count: number;
  releaseImpact: "none" | "warning" | "hold" | "rollback";
}

export interface SchedulerSoakTelemetryFixture {
  scenario: SchedulerSoakTelemetryScenario;
  expected24hTasks: number;
  expectedLeaseThroughputPerMinute: number;
  expectedAckLatencyP95Ms: number;
  expectedRetryDebtMax: number;
  expectedDeadLetterBudget: number;
  requiredTelemetry: string[];
  safeDrainControls: SchedulerLiveRunDrainAction[];
}

export interface SchedulerProductionAdapterTelemetryDto {
  generatedAt: string;
  apiTargets: Array<"/v1/intel/search.scheduler" | "/v1/frontier/status" | "/v1/contracts" | "agent09_warning_codes" | "agent10_rc_gates">;
  dryRun: true;
  willMutate: false;
  adapterContracts: SchedulerProductionAdapterContract[];
  telemetry: {
    leaseThroughputPerMinute: number;
    ackLatencyP95Ms: number;
    retryDebt: number;
    deadLetterCauses: SchedulerDeadLetterCauseTelemetry[];
    queueAge: { p95Seconds: number; p99Seconds: number };
    cursorContinuity: SchedulerRuntimeExecutionDto["pollingDeltas"]["cursorContinuity"];
    replayPreservation: "preserved" | "at_risk";
    runReuseRatio: number;
    duplicatePublicPollingRatio: number;
    staleClients: number;
    workerHeartbeats: number;
    cancellations: number;
    drainProgress: Array<{
      action: SchedulerLiveRunDrainAction;
      state: "not_needed" | "planned" | "in_progress" | "blocked";
      estimatedTaskDelta: number;
    }>;
  };
  soakFixtures: SchedulerSoakTelemetryFixture[];
  agent09WarningCodes: string[];
  agent10RcGate: {
    decision: "pass" | "hold" | "rollback";
    fields: string[];
    proofCommands: string[];
  };
}

export type SchedulerCanaryControlAction = "start" | "pause" | "drain" | "rollback" | "expand";

export interface SchedulerCanaryControlPlaneStep {
  id: string;
  scenario: SchedulerSoakTelemetryScenario;
  action: SchedulerCanaryControlAction;
  dryRun: true;
  willMutate: false;
  preconditions: string[];
  expectedQueueDelta: {
    queuedVisibleDelta: number;
    leasedDelta: number;
    retryDebtDelta: number;
    deadLetterDelta: number;
  };
  workerPartitionEffects: Array<{
    partitionId: string;
    workload: SchedulerWorkerWorkload;
    reservedWorkerSlotDelta: number;
    maxConcurrentLeaseDelta: number;
    expectedMemoryMbDelta: number;
  }>;
  cursorReplayGuarantee: {
    cursorContinuity: SchedulerProductionAdapterTelemetryDto["telemetry"]["cursorContinuity"] | "preserved";
    replayPreservation: SchedulerProductionAdapterTelemetryDto["telemetry"]["replayPreservation"];
  };
  rollbackSteps: string[];
  warningCodes: string[];
}

export interface SchedulerCanaryControlPlaneDto {
  generatedAt: string;
  apiTargets: Array<"/v1/frontier/status" | "/v1/frontier/apply-plan" | "/v1/intel/search.scheduler" | "/v1/contracts" | "agent09_public_cutover_semantics" | "agent10_release_decisions">;
  dryRun: true;
  willMutate: false;
  controls: SchedulerCanaryControlPlaneStep[];
  headroom: {
    memoryTargetMb: number;
    memoryCeilingMb: number;
    estimatedMemoryMb: number;
    memoryHeadroomMb: number;
    queueHeadroomTasks: number;
    p95QueueAgeSeconds: number;
    p99QueueAgeSeconds: number;
    queueAgeWithinCanaryLimit: boolean;
  };
  warningCodes: string[];
  routeContracts: {
    frontierStatusField: "scheduler.canaryControlPlane";
    frontierApplyPlanField: "applyPlan.canaryControlPlane";
    searchSchedulerField: "scheduler.canaryControlPlane";
    contractsField: "surfaces.frontier.contracts.scheduler_canary_control_plane";
  };
  agent10ReleaseDecision: {
    decision: "canary-ready" | "canary-with-warnings" | "hold" | "rollback";
    fields: string[];
    proofCommands: string[];
  };
}

export type SchedulerDurableBackendKind =
  | "embedded_memory"
  | SchedulerQueueBackendCandidate;

export interface SchedulerDurableBackendContract {
  backend: SchedulerDurableBackendKind;
  mode: "active" | "shadow" | "candidate";
  dryRun: true;
  willMutate: false;
  primitives: Array<
    | "enqueue"
    | "lease"
    | "heartbeat"
    | "checkpoint"
    | "acknowledge"
    | "retry"
    | "dead_letter"
    | "cancel"
    | "reuse_run"
    | "drain"
    | "rollback"
  >;
  leaseSemantics: string;
  retryBackoffSemantics: string;
  deadLetterSemantics: string;
  cursorContinuity: "preserved";
  duplicateRunReuse: "required";
  drainSemantics: string;
  rollbackSemantics: string;
}

export interface SchedulerDurableFairnessLane {
  workload: SchedulerWorkerWorkload;
  partitionId: string;
  reservedWorkerSlots: number;
  maxConcurrentLeases: number;
  maxQueueAgeSeconds: number;
  agingBoostEverySeconds: number;
  fairnessKeys: string[];
  backpressurePolicy: SchedulerWorkerQueuePartition["backpressurePolicy"];
  drainBehavior: SchedulerLiveRunDrainAction;
  retryBudget: {
    maxAttempts: number;
    retryBaseSeconds: number;
    retryMaxSeconds: number;
    deadLetterAfterAttempts: number;
  };
}

export interface SchedulerDurableBackendReadinessDto {
  generatedAt: string;
  apiTargets: Array<"/v1/frontier/status" | "/v1/frontier/apply-plan" | "/v1/intel/search.scheduler" | "/v1/contracts" | "agent09_public_wrapper" | "agent10_release_train">;
  dryRun: true;
  willMutate: false;
  backendContracts: SchedulerDurableBackendContract[];
  fairnessLanes: SchedulerDurableFairnessLane[];
  semanticInvariants: string[];
  pollingContract: {
    nextPollSeconds: 3;
    cursorContinuity: SchedulerRuntimeExecutionDto["pollingDeltas"]["cursorContinuity"] | "preserved";
    publicWrapperCursorSemantics: "stable_since_cursor_with_delta_replay";
  };
  runReuse: {
    contract: "duplicate_public_polling_attaches_to_active_run";
    activeRunReuseRatio: number;
    duplicatePublicPollingRatio: number;
  };
  drainPlan: {
    state: "not_needed" | "planned" | "in_progress" | "blocked";
    preservesCursorReplayState: true;
    actions: SchedulerLiveRunDrainAction[];
    abandonClientPolicy: "cancel_or_reuse_without_losing_run_cursor";
  };
  emergencyBrake: {
    state: "clear" | "armed" | "engaged";
    preservesCursorReplayState: true;
    releaseCriteria: string[];
  };
  releaseGate: {
    decision: "pass" | "hold" | "rollback";
    reasons: string[];
    proofCommands: string[];
  };
  routeContracts: {
    frontierStatusField: "scheduler.durableBackendReadiness";
    frontierApplyPlanField: "applyPlan.durableBackendReadiness";
    searchSchedulerField: "scheduler.durableBackendReadiness";
    contractsField: "surfaces.frontier.contracts.durable_backend_readiness";
  };
}

export type SchedulerFreshnessQueryClass =
  | "actor"
  | "ransomware"
  | "cve_advisory"
  | "campaign"
  | "malware_tool"
  | "sector"
  | "country"
  | "victim_company"
  | "infrastructure"
  | "unknown";

export interface SchedulerSourceCadenceHint {
  sourceId: string;
  sourceType: CollectionTask["sourceType"];
  queryClass: SchedulerFreshnessQueryClass;
  reliability: number;
  parserHealth: number;
  evidenceYield: number;
  analystPriority: number;
  sourceFreshnessTargetSeconds: number;
  recommendedCadenceSeconds: number;
  nextEligibleAt: string;
  freshnessDebtSeconds: number;
  priorityAgingBoost: number;
  budgetClass: SchedulerWorkClass;
  queueAction: "collect_now" | "schedule_next" | "defer_pressure" | "hold_backoff" | "dead_letter_review" | "emergency_hold";
  reason: string;
}

export interface SchedulerFreshnessSloEngineDto {
  generatedAt: string;
  apiTargets: Array<"/v1/intel/search.scheduler" | "/v1/frontier/status" | "/v1/intel/runs/{id}" | "/v1/contracts" | "agent10_slo_runbooks">;
  dryRun: true;
  willMutate: false;
  queryClass: SchedulerFreshnessQueryClass;
  slo: {
    targetFreshnessSeconds: number;
    staleAfterSeconds: number;
    emergencyStaleAfterSeconds: number;
    maxQueueAgeSeconds: number;
  };
  cadence: {
    minCadenceSeconds: number;
    recommendedCadenceSeconds: number;
    maxCadenceSeconds: number;
    analystPriority: number;
    sourceHintCount: number;
  };
  sourceCadenceHints: SchedulerSourceCadenceHint[];
  queuePressureBehavior: {
    state: "normal" | "degraded" | "emergency_brake";
    retryAfterSeconds: number;
    preservesThreeSecondPolling: true;
    duplicateRunReuse: "required";
    cursorContinuity: SchedulerRuntimeExecutionDto["pollingDeltas"]["cursorContinuity"] | "preserved";
    degradeActions: Array<"raise_high_value_stale_items" | "defer_low_yield_sources" | "hold_dead_letters" | "preserve_active_run_reuse" | "pause_new_leases" | "emergency_brake">;
  };
  fairnessAging: Array<{
    workload: SchedulerWorkerWorkload;
    agingBoostEverySeconds: number;
    maxBoost: number;
    preservesPerSourceConcurrency: true;
  }>;
  handoffs: {
    agent01SourceGovernance: string[];
    agent04PublicCoverage: string[];
    agent06EvidenceYield: string[];
    agent07ActorFreshness: string[];
    agent09ApiPolling: string[];
    agent10Runbooks: string[];
  };
  routeContracts: {
    frontierStatusField: "scheduler.freshnessSloEngine";
    searchSchedulerField: "scheduler.freshnessSloEngine";
    runStatusField: "scheduler.freshnessSloEngine";
    contractsField: "surfaces.frontier.contracts.freshness_slo_engine";
  };
}

export interface SchedulerFreshnessSloDashboardActor {
  actor: "APT29" | "APT42" | "Sandworm" | "Volt Typhoon" | "Lazarus" | "LockBit" | "Akira" | "Scattered Spider";
  priority: "daily" | "weekly";
  queryClass: "actor" | "ransomware";
  state: "fresh" | "aging" | "stale" | "blocked";
  targetFreshnessSeconds: number;
  observedFreshnessSeconds: number;
  queueAgeSeconds: number;
  retryDebt: number;
  deadLetters: number;
  nextPollSeconds: 3;
  duplicateRunReuse: "required";
  schedulerAction: "collect_now" | "raise_priority" | "reuse_active_run" | "defer_low_value_work" | "hold_for_review" | "emergency_brake";
  workerPartition: SchedulerWorkerWorkload;
  cadenceReason: string;
}

export interface SchedulerFreshnessSloDashboardDto {
  generatedAt: string;
  apiTargets: Array<"/v1/frontier/status" | "/v1/intel/search.scheduler" | "/v1/intel/runs/{id}" | "/v1/contracts" | "agent10_slo_dashboard">;
  dryRun: true;
  willMutate: false;
  schemaVersion: "ti.scheduler_freshness_slo_dashboard.v1";
  summary: {
    actorCount: number;
    staleCount: number;
    blockedCount: number;
    dailyDueCount: number;
    weeklyDueCount: number;
    queueAgeP95Seconds: number;
    retryDebt: number;
    deadLetters: number;
    publicPollingProtected: true;
  };
  actors: SchedulerFreshnessSloDashboardActor[];
  workloadActions: Array<{
    workload: SchedulerWorkerWorkload;
    action: "reserve_capacity" | "raise_priority_aging" | "drain_background" | "hold_restricted_metadata" | "dead_letter_review" | "no_action";
    reason: string;
    reservedWorkerSlots: number;
    maxQueueAgeSeconds: number;
  }>;
  runbook: {
    publicApiBehavior: "return_status_with_three_second_polling";
    duplicateRunReuse: "required_before_enqueue";
    lowValueSweeps: "defer_before_actor_starvation";
    restrictedMetadata: "metadata_only_holds_do_not_block_clear_web";
    emergencyBrake: "pause_new_leases_preserve_cursors";
  };
  routeContracts: {
    frontierStatusField: "scheduler.freshnessSloDashboard";
    searchSchedulerField: "scheduler.freshnessSloDashboard";
    runStatusField: "scheduler.freshnessSloDashboard";
    contractsField: "surfaces.frontier.contracts.scheduler_freshness_slo_dashboard";
  };
  releaseGate: {
    decision: "pass" | "hold" | "rollback";
    reasons: string[];
    proofCommands: string[];
  };
}

export interface SchedulerDailyActorRunPlanDto {
  generatedAt: string;
  apiTargets: Array<"/v1/frontier/status" | "/v1/intel/search.scheduler" | "/v1/intel/runs/{id}" | "/v1/contracts" | "apify_public_threat_actor_monitor" | "agent10_revenue_slo">;
  dryRun: true;
  willMutate: false;
  schemaVersion: "ti.scheduler_daily_actor_run_plan.v1";
  apifyActor: {
    actorId: "eirikhanasand/public-threat-actor-monitor";
    publishedBuild: "0.6.4";
    defaultQueryCount: 20;
    defaultQueries: string[];
    runCadence: "daily";
    window: "00:15_utc_after_source_sweeps";
    pricing: {
      resultEvent: "apify-default-dataset-item";
      actorStartEvent: "apify-actor-start";
      resultPricePerThousandUsd: 3;
      actorStartPriceUsd: 0.00005;
      apifyMarginPercent: 20;
    };
  };
  latestProofRun: {
    runId: "iMQGeezZ8bx7WtlhQ";
    datasetId: "5PLmkE30luBA5Lbgc";
    query: "APT42";
    runtimeSeconds: 4;
    safeRowCount: 10;
    usageUsdApprox: 0.001;
    paidRowDecisionCounts: {
      sellable: number;
      includedWithCaveat: number;
      coverageGapOnly: number;
      hold: number;
      buyerUseful: number;
    };
    blockers: Array<"caveated_rows" | "stale_or_held_rows" | "weak_victim_extraction" | "missing_public_channel_coverage" | "missing_dark_metadata_coverage">;
  };
  runTargets: {
    expectedRows: number;
    usefulRowTarget: number;
    freshRowTarget: number;
    staleRowSuppressionTarget: number;
    sourceFamilyDiversityTarget: number;
    maxCostPerUsefulRowUsd: number;
    duplicateRunReuseRequired: true;
    nextPollSeconds: 3;
  };
  watchlist: Array<{
    query: string;
    priority: "daily" | "daily_until_fresh" | "weekly_if_fresh";
    currentFreshness: "fresh" | "aging" | "stale" | "unknown" | "blocked";
    schedulerAction: "run_daily" | "raise_priority" | "suppress_stale_only_rows" | "hold_restricted_metadata" | "reuse_active_run";
    sourceFamilyFocus: string[];
    expectedUsefulRows: number;
    staleSuppression: "drop_stale_only_activity" | "caveat_stale_context" | "normal";
  }>;
  sourceTierCadence: Array<{
    tier: "tier_100" | "tier_1000" | "tier_4000";
    scope: "safe_public_sources" | "approved_dark_metadata";
    targetRecords: number;
    cadence: "hourly" | "four_hourly" | "daily";
    workClass: SchedulerWorkClass;
    reservedWorkerSlots: number;
    expectedUsefulRowLift: number;
    maxDailyTasks: number;
    advanceCriteria: string[];
    holdCriteria: string[];
  }>;
  economics: {
    estimatedRowsPerRun: number;
    estimatedUsefulRowsPerRun: number;
    estimatedGrossRevenueUsd: number;
    estimatedAfterApifyMarginUsd: number;
    estimatedSchedulerCostUsd: number;
    estimatedCostPerUsefulRowUsd: number;
    usefulRowRate: number;
    freshRowRate: number;
  };
  staleSuppression: {
    staleOnlyRowsExcludedFromReady: true;
    maxStaleRowsPerActor: number;
    actions: Array<"raise_source_cadence" | "request_source_family_expansion" | "caveat_old_context" | "suppress_ready_state">;
    affectedQueries: string[];
  };
  freshCollectionRetryPlan: {
    visibleWithinSeconds: number;
    targetFreshEvidenceWithinSeconds: number;
    maxRetryAttemptsBeforeDeadLetter: number;
    retryBackoffSeconds: number[];
    retryAfterSecondsByWorkClass: Array<{
      workClass: SchedulerWorkClass;
      retryAfterSeconds: number;
      deadlineSeconds: number;
      visibleState: "searching" | "partial" | "metadata_review" | "queued";
    }>;
    escalation: Array<{
      condition: "stale_commercial_actor" | "public_channel_gap" | "dark_metadata_gap" | "weak_victim_extraction" | "retry_debt";
      action: "raise_priority" | "reserve_worker_slot" | "request_source_activation" | "hold_paid_row" | "dead_letter_review";
      visibleToClient: true;
    }>;
  };
  executionQueuePlan: {
    enqueueWindow: "source_sweeps_before_actor_run";
    duplicateRunReuseBeforeEnqueue: true;
    batches: Array<{
      batchId: "interactive_commercial_refresh" | "public_channel_gap_fill" | "tier_100_source_sweep" | "tier_1000_source_sweep" | "tier_4000_metadata_sweep" | "daily_actor_dataset_emit";
      workClass: SchedulerWorkClass;
      target: "watchlist" | "source_tier" | "apify_actor_dataset";
      queries: string[];
      tier?: "tier_100" | "tier_1000" | "tier_4000";
      enqueueAfter: "now" | "after_interactive_reuse_check" | "after_public_gap_probe" | "after_source_sweeps";
      maxTasks: number;
      reservedWorkerSlots: number;
      freshnessGate: "must_produce_fresh_or_partial" | "dedupe_and_parser_gate" | "metadata_review_gate" | "paid_row_gate";
      staleOnlyRowsBlocked: boolean;
      expectedVisibleState: "searching" | "partial" | "metadata_review" | "ready";
    }>;
    fairnessGuards: {
      maxActorQueriesPerTenantPerDay: number;
      publicChannelReservedWorkerSlots: number;
      darkMetadataReservedWorkerSlots: number;
      backgroundSweepMaxWorkerShare: number;
      priorityAgingAfterSeconds: number;
      retryDebtDeadLetterAtAttempts: number;
    };
    paidRowGate: {
      rowsWithOnlyStaleActivity: "suppress_from_ready";
      rowsMissingPublicChannelForFocusedActors: "include_caveat_and_enqueue_gap_fill";
      rowsMissingApprovedDarkMetadataForRansomware: "include_caveat_and_enqueue_metadata_review";
      weakVictimExtraction: "hold_paid_row_until_review_or_caveat";
    };
    suppressionDecisions: Array<{
      query: string;
      reason: "stale_only_activity" | "missing_public_channel" | "missing_dark_metadata" | "unknown_freshness";
      action: "raise_priority" | "enqueue_gap_fill" | "metadata_review" | "suppress_ready_state";
      visibleState: "searching" | "partial" | "metadata_review";
    }>;
  };
  sourceGapClosurePlan: {
    schemaVersion: "ti.scheduler_source_gap_closure_plan.v1";
    routeVisible: true;
    targetFreshEvidenceWithinSeconds: number;
    duplicateRunReuseKeyPattern: "tenant:query:source_family:daily_actor";
    gapClosures: Array<{
      query: string;
      missingSourceFamily: "safe_public_sources" | "public_channel" | "approved_dark_metadata";
      sourceTier: "tier_100" | "tier_1000" | "tier_4000";
      workClass: SchedulerWorkClass;
      queueAction: "reuse_active_run" | "enqueue_gap_probe" | "metadata_review_hold" | "suppress_ready_until_gap_closes";
      reuseKey: string;
      maxAttempts: number;
      backoffSeconds: number[];
      deadlineSeconds: number;
      fairnessGroup: string;
      expectedVisibleState: "searching" | "partial" | "metadata_review";
      paidRowEffect: "freshen_stale_row" | "raise_caveat_quality" | "metadata_context_only" | "suppress_until_fresh";
    }>;
    workerLimits: {
      maxParallelGapClosures: number;
      perSourceConcurrency: number;
      publicChannelReservedSlots: number;
      darkMetadataReservedSlots: number;
      backgroundSweepMayYieldToInteractive: true;
    };
    promotionRules: {
      requireFreshOrPartialEvidence: true;
      requireNoLeakProof: true;
      staleOnlyRowsRemainBlocked: true;
      metadataOnlyRowsRemainCaveated: true;
    };
  };
  sourceGapExecutionReadiness: {
    schemaVersion: "ti.scheduler_source_gap_execution_readiness.v1";
    routeVisible: true;
    closureCount: number;
    executableClosureCount: number;
    runReuse: {
      requiredBeforeEnqueue: true;
      attachBy: "reuseKey";
      duplicatePolicy: "reattach_active_run_before_new_task";
      cursorPolicy: "preserve_answer_evidence_and_source_gap_cursors";
      stormGuard: "one_active_closure_per_tenant_query_source_family";
    };
    workerDrain: {
      pressurePolicy: "interactive_freshness_first";
      drainOrder: Array<"daily_actor_dataset_emit" | "interactive_commercial_refresh" | "public_channel_gap_fill" | "tier_100_source_sweep" | "tier_1000_source_sweep" | "tier_4000_metadata_sweep">;
      controlledShutdownDeadlineSeconds: number;
      heartbeatExpiryRecovery: "requeue_with_last_checkpoint";
      backgroundSweepYield: true;
    };
    readinessByClosure: Array<{
      query: string;
      missingSourceFamily: "safe_public_sources" | "public_channel" | "approved_dark_metadata";
      reuseKey: string;
      idempotencyKey: string;
      taskFingerprint: string;
      queueAction: "reuse_active_run" | "enqueue_gap_probe" | "metadata_review_hold" | "suppress_ready_until_gap_closes";
      readinessState: "reattach_existing_run" | "ready_to_enqueue" | "ready_for_metadata_review" | "blocked_until_source_activation";
      executableNow: boolean;
      enqueueBatch: "interactive_commercial_refresh" | "public_channel_gap_fill" | "tier_100_source_sweep" | "tier_1000_source_sweep" | "tier_4000_metadata_sweep";
      workerPartition: "interactive_actor_search" | "public_channel_window" | "restricted_metadata_approval" | "background_source_sweep";
      activeRunLookup: Array<"tenant_query_source_family" | "daily_actor_reuse_key" | "latest_cursor_checkpoint">;
      onActiveRun: "reattach_and_poll_existing_run";
      onNoActiveRun: "enqueue_idempotent_source_sweep" | "enqueue_metadata_review_hold" | "keep_paid_ready_suppressed";
      visibleStateAfterDecision: "searching" | "partial" | "metadata_review";
      drainPriority: number;
      maxLeaseSeconds: number;
      heartbeatSeconds: number;
      cursorCheckpoint: "answer_delta" | "source_gap_delta" | "metadata_review_delta";
      blockingReasons: string[];
      nextOperatorAction: "attach_or_enqueue" | "activate_source_candidate" | "review_metadata_summary" | "suppress_paid_ready";
    }>;
    sourceSweepBatches: Array<{
      enqueueBatch: "interactive_commercial_refresh" | "public_channel_gap_fill" | "tier_4000_metadata_sweep";
      queryCount: number;
      reuseKeys: string[];
      idempotencyScope: "tenant_query_source_family_daily";
      leaseMode: "exclusive_per_reuse_key";
      drainBehavior: "finish_or_checkpoint_before_shutdown";
      nextPollSeconds: 3 | 15 | 60;
      promotesToVisibleState: "searching" | "partial" | "metadata_review";
    }>;
    materializedTasks: Array<{
      dryRunTaskId: string;
      query: string;
      workClass: SchedulerWorkClass;
      sourceTier: "tier_100" | "tier_1000" | "tier_4000";
      reuseKey: string;
      idempotencyKey: string;
      enqueueBatch: "interactive_commercial_refresh" | "public_channel_gap_fill" | "tier_4000_metadata_sweep";
      workerPartition: "interactive_actor_search" | "public_channel_window" | "restricted_metadata_approval";
      leaseSeconds: number;
      heartbeatSeconds: number;
      maxAttempts: number;
      deadlineSeconds: number;
      cursorCheckpoint: "answer_delta" | "source_gap_delta" | "metadata_review_delta";
      noLeakMode: "public_fetch_only" | "metadata_only_no_raw_download";
      paidRowGate: "suppress_until_fresh" | "caveat_until_correlated" | "metadata_context_only";
    }>;
    queueTaskSpecs: Array<{
      willEnqueue: false;
      task: CollectionTask;
      enqueuePreconditions: Array<"reuse_key_not_active" | "source_policy_allows_public_fetch" | "metadata_only_review_current" | "paid_row_gate_not_ready">;
      expectedRepositoryOperation: "findOrRegisterRun_then_enqueueTasks";
      forbiddenMutations: Array<"network_fetch" | "raw_url_output" | "payload_download" | "credential_access" | "actor_interaction">;
    }>;
    enqueueAdapterPreview: {
      disabledByDefault: true;
      willMutate: false;
      adapterMode: "dry_run_embedded_repository_preview";
      promotionRequired: "enable_source_gap_enqueue_flag_and_postgres_scheduler_executor";
      preflight: {
        requiredFlags: Array<"SCHEDULER_SOURCE_GAP_ENQUEUE_ENABLED" | "SCHEDULER_POSTGRES_QUEUE_ENABLED">;
        requiredRuntimeState: Array<"postgres_dsn_configured" | "executor_available" | "source_policy_current" | "paid_row_gate_open">;
        rollback: "disable_source_gap_enqueue_flag_and_replay_cursor_events";
      };
      repositoryCalls: Array<{
        callOrder: number;
        reuseKey: string;
        run: CollectionRun;
        taskId: string;
        dryRunOperation: "findOrRegisterRun" | "enqueueTasks";
        expectedResult: "reattach_active_run_or_register_queued_run" | "enqueue_task_after_reuse_check";
        blockedUntil: Array<"feature_flag_enabled" | "postgres_adapter_promoted" | "source_policy_verified" | "paid_row_gate_open" | "metadata_review_current">;
        visibleStateAfterDryRun: "searching" | "partial" | "metadata_review";
      }>;
      impactSummary: {
        candidateTaskCount: number;
        publicFetchTaskCount: number;
        metadataOnlyTaskCount: number;
        stalePaidRowsRemainSuppressed: true;
        metadataRowsRemainCaveated: true;
      };
    };
    drainExecution: Array<{
      step: "finish_active_dataset_emit" | "checkpoint_interactive_refresh" | "checkpoint_public_gap_fill" | "checkpoint_source_sweeps" | "checkpoint_metadata_review";
      appliesToBatch: "daily_actor_dataset_emit" | "interactive_commercial_refresh" | "public_channel_gap_fill" | "tier_100_source_sweep" | "tier_1000_source_sweep" | "tier_4000_metadata_sweep";
      action: "finish_if_under_deadline" | "checkpoint_and_requeue_by_reuse_key" | "pause_new_leases";
      maxWaitSeconds: number;
      preserves: Array<"run_id" | "reuse_key" | "poll_cursor" | "delta_cursor" | "source_gap_cursor" | "metadata_review_cursor">;
      visibleState: "searching" | "partial" | "metadata_review" | "ready";
    }>;
  };
  routeContracts: {
    frontierStatusField: "scheduler.dailyActorRunPlan";
    searchSchedulerField: "scheduler.dailyActorRunPlan";
    runStatusField: "scheduler.dailyActorRunPlan";
    contractsField: "surfaces.frontier.contracts.scheduler_daily_actor_run_plan";
  };
  releaseGate: {
    decision: "pass" | "hold" | "rollback";
    reasons: string[];
    proofCommands: string[];
  };
}

export interface SchedulerInteractiveSearchFreshnessDto {
  generatedAt: string;
  apiTargets: Array<"/v1/frontier/status" | "/v1/intel/search.scheduler" | "/v1/intel/runs/{id}" | "/v1/contracts" | "frontend_ti_progressive_update">;
  dryRun: true;
  willMutate: false;
  schemaVersion: "ti.scheduler_interactive_search_freshness.v1";
  currentQuery: {
    query: string;
    queryClass: SchedulerFreshnessQueryClass;
    knownHighValueActor: boolean;
    priorityBand: "urgent_actor" | "high_value_actor" | "normal_interactive" | "unknown_searching";
    targetFreshnessSeconds: number;
    observedFreshnessSeconds: number;
    freshnessState: "fresh" | "aging" | "stale" | "held";
  };
  queueDecision: {
    decision: "reuse_active_run" | "enqueue_interactive_refresh" | "raise_priority" | "serve_partial_and_poll" | "metadata_review_hold" | "emergency_hold";
    reason: string;
    nextPollSeconds: 3;
    retryAfterSeconds: number;
    duplicateRunReuse: "required_before_enqueue";
    attachedToActiveRun: boolean;
    runId?: string;
    interactiveReservedWorkerSlots: number;
    maxInteractiveQueueAgeSeconds: number;
    deferredBackgroundWorkloads: SchedulerWorkerWorkload[];
  };
  actorTargets: Array<{
    actor: SchedulerFreshnessSloDashboardActor["actor"] | "configured_actor";
    priority: "daily" | "weekly" | "on_demand";
    state: SchedulerFreshnessSloDashboardActor["state"] | "unknown_searching";
    targetFreshnessSeconds: number;
    observedFreshnessSeconds: number;
    schedulerAction: SchedulerFreshnessSloDashboardActor["schedulerAction"] | "keep_searching";
  }>;
  fairnessGuards: {
    preservesThreeSecondPolling: true;
    preservesDuplicateRunReuse: true;
    preservesCursorContinuity: true;
    backgroundWorkStillAges: true;
    lowValueSweepsDeferredBeforeActorStarvation: true;
    restrictedMetadataDoesNotBlockClearWeb: true;
    perSourceConcurrencyStillApplies: true;
  };
  uiSignals: {
    state: "searching" | "partial" | "ready" | "metadata_review" | "degraded";
    badges: Array<"queue_age" | "source_freshness" | "active_run_reuse" | "priority_aging" | "retry_backoff" | "dead_letter_review" | "restricted_metadata_hold" | "background_deferred">;
    visibleSchedulerFields: Array<"freshness_state" | "queue_decision" | "next_poll_seconds" | "retry_after_seconds" | "duplicate_run_reuse" | "deferred_background_workloads" | "actor_targets">;
  };
  handoffs: {
    agent04Coverage: string[];
    agent06EvidenceReplay: string[];
    agent07QualityFreshness: string[];
    agent09FrontendContract: string[];
    agent10Capacity: string[];
  };
  routeContracts: {
    frontierStatusField: "scheduler.interactiveSearchFreshness";
    searchSchedulerField: "scheduler.interactiveSearchFreshness";
    runStatusField: "scheduler.interactiveSearchFreshness";
    contractsField: "surfaces.frontier.contracts.scheduler_interactive_search_freshness";
  };
  releaseGate: {
    decision: "pass" | "hold" | "rollback";
    reasons: string[];
    proofCommands: string[];
  };
}

export interface SchedulerProductionQueueLeasePhase {
  phase:
    | "shadow_mirror"
    | "dual_write_audit"
    | "postgres_lease_canary"
    | "worker_drain"
    | "cutover"
    | "rollback";
  targetBackend: "postgres_advisory_queue";
  dryRun: true;
  willMutate: false;
  willLeaseTasks: false;
  requiredChecks: string[];
  expectedQueueEffect: {
    queuedDelta: number;
    leasedDelta: number;
    retryDebtDelta: number;
    deadLetterDelta: number;
  };
  rollback: string;
}

export interface SchedulerProductionLeaseSemanticsDto {
  generatedAt: string;
  apiTargets: Array<"/v1/intel/search.scheduler" | "/v1/frontier/status" | "/v1/frontier/apply-plan" | "/v1/contracts" | "agent10_release_artifacts">;
  dryRun: true;
  willMutate: false;
  currentBackend: "embedded_memory";
  primaryTargetBackend: "postgres_advisory_queue";
  futureBackends: Array<"redis_streams" | "nats_jetstream">;
  postgresContract: {
    tables: Array<"frontier_tasks" | "frontier_leases" | "frontier_events" | "crawl_budgets" | "run_reuse_keys" | "frontier_dead_letters">;
    enqueue: string;
    lease: string;
    heartbeat: string;
    acknowledge: string;
    retry: string;
    deadLetter: string;
    duplicateRunReuse: string;
    cursorReplay: "frontier_events_cursor_replay_required";
    emergencyBrake: string;
    workerShutdown: string;
  };
  leaseLifecycle: Array<{
    step: "enqueue" | "lease" | "heartbeat" | "checkpoint" | "ack" | "retry" | "dead_letter" | "expire" | "drain" | "shutdown";
    semantics: string;
    idempotencyKey: string;
    cursorVisible: boolean;
  }>;
  cutoverPhases: SchedulerProductionQueueLeasePhase[];
  fairness: {
    tenantIsolation: "tenant_then_reuse_key_then_source_family";
    noisySourcePolicy: "cap_and_age_without_starving_live_search";
    lowValueSweepPolicy: "bounded_under_pressure";
    priorityAging: Array<{ workload: SchedulerWorkerWorkload; agingBoostEverySeconds: number; maxBoost: number }>;
  };
  safety: {
    preservesThreeSecondPolling: true;
    duplicateActorQueryRunsSuppressed: true;
    cursorContinuity: "preserved";
    dryRunApplyPlanOnly: true;
    restrictedMetadataRemainsApprovalGated: true;
  };
  releaseGate: {
    decision: "pass" | "hold" | "rollback";
    reasons: string[];
    proofCommands: string[];
  };
  routeContracts: {
    frontierStatusField: "scheduler.productionLeaseSemantics";
    frontierApplyPlanField: "applyPlan.productionLeaseSemantics";
    contractsField: "surfaces.frontier.contracts.production_queue_lease_semantics";
  };
}

export interface SchedulerTenantBudgetLane {
  tenantId: string;
  queryClass: SchedulerFreshnessQueryClass;
  workClass: SchedulerWorkClass;
  reservedWorkerSlots: number;
  maxConcurrentLeases: number;
  maxQueuedTasks: number;
  maxQueueAgeSeconds: number;
  maxRetryDebt: number;
  agingBoostEverySeconds: number;
  retryAfterSeconds: number;
  state: "within_budget" | "pressure" | "throttled" | "emergency_hold";
  actions: Array<"preserve_live_polling" | "reserve_interactive_capacity" | "age_priority" | "defer_sweeps" | "reuse_duplicate_run" | "hold_dead_letters" | "pause_new_leases">;
}

export interface SchedulerFairnessGovernanceDto {
  generatedAt: string;
  apiTargets: Array<"/v1/intel/search.scheduler" | "/v1/frontier/status" | "/v1/frontier/apply-plan" | "/v1/intel/runs/{id}" | "/v1/contracts" | "agent10_capacity_artifacts">;
  dryRun: true;
  willMutate: false;
  tenants: {
    defaultTenantId: string;
    isolationKey: "tenant:queryClass:reuseKey:sourceFamily";
    crossTenantBorrowing: "disabled_until_budget_headroom";
    noisyTenantPolicy: "cap_retry_debt_and_preserve_live_polling";
  };
  queryClassBudgets: SchedulerTenantBudgetLane[];
  workloadFairness: Array<{
    workload: SchedulerWorkerWorkload;
    reservedWorkerSlots: number;
    maxConcurrentLeases: number;
    agingBoostEverySeconds: number;
    queuePressureAction: "serve_now" | "reserve_capacity" | "defer_low_value_sweeps" | "hold_restricted_metadata" | "pause_new_leases";
    preservesThreeSecondPolling: true;
  }>;
  priorityAging: Array<{
    queryClass: SchedulerFreshnessQueryClass;
    workClass: SchedulerWorkClass;
    agingBoostEverySeconds: number;
    maxBoost: number;
    neverBypassPerSourceConcurrency: true;
  }>;
  pressurePolicy: {
    publicPolling: "always_return_status_with_three_second_hint";
    duplicateRunReuse: "required_before_enqueue";
    retryBackoff: "deterministic_per_tenant_query_source";
    deadLetterReuse: "dead_letters_do_not_consume_interactive_budget";
    emergencyBrake: "pause_new_leases_preserve_cursors_and_reuse";
    lowValueSweeps: "bounded_and_deferred_before_interactive_starvation";
    workerDrain: "drain_noninteractive_first_preserve_replay";
  };
  fairnessSlo: {
    worstSourceShare: number;
    maxAllowedSourceShare: number;
    ok: boolean;
    noisySources: string[];
    retryAfterSeconds: number;
  };
  handoffs: {
    agent01SourceActivation: string[];
    agent03AdapterCertification: string[];
    agent04PublicExpansion: string[];
    agent06EvidenceReplay: string[];
    agent07Quality: string[];
    agent09ApiContracts: string[];
    agent10Capacity: string[];
  };
  releaseGate: {
    decision: "pass" | "hold" | "rollback";
    reasons: string[];
    proofCommands: string[];
  };
  routeContracts: {
    frontierStatusField: "scheduler.fairnessGovernance";
    frontierApplyPlanField: "applyPlan.fairnessGovernance";
    runStatusField: "scheduler.fairnessGovernance";
    contractsField: "surfaces.frontier.contracts.multi_tenant_fairness_governance";
  };
}

export interface SchedulerPersistenceReplayFixture {
  name:
    | "queued_actor_search_restart"
    | "leased_heartbeat_expiry"
    | "restricted_metadata_hold"
    | "dead_letter_retry_replay"
    | "duplicate_public_run_reuse"
    | "worker_drain_restart"
    | "emergency_brake_restart";
  dryRun: true;
  willMutate: false;
  persistedRows: Array<"runs" | "frontier_tasks" | "frontier_leases" | "worker_heartbeats" | "checkpoints" | "cursor_events" | "retry_dead_letters" | "fairness_budget_snapshots" | "worker_drain_state">;
  replayExpectation: string;
  preservesThreeSecondPolling: boolean;
  preservesCursorContinuity: boolean;
  duplicateRunReuseRequired: boolean;
  expectedStatus: RunStatus | "metadata_review" | "searching";
}

export interface SchedulerPersistenceReplayCutoverDto {
  generatedAt: string;
  apiTargets: Array<"/v1/intel/search.scheduler" | "/v1/frontier/status" | "/v1/frontier/apply-plan" | "/v1/intel/runs/{id}" | "/v1/contracts" | "agent09_public_api_fields" | "agent10_capacity_release_gate">;
  dryRun: true;
  willMutate: false;
  currentBackend: "embedded_memory";
  primaryTargetBackend: "postgres_scheduler_store";
  descriptorBackends: Array<"redis_streams" | "nats_jetstream">;
  postgresContracts: Array<{
    table: "scheduler_runs" | "frontier_tasks" | "frontier_leases" | "worker_heartbeats" | "scheduler_checkpoints" | "scheduler_cursor_events" | "scheduler_retry_dead_letters" | "scheduler_fairness_budget_snapshots" | "scheduler_worker_drain_state";
    purpose: string;
    keyFields: string[];
    replayRole: string;
  }>;
  replaySemantics: {
    duplicatePublicActorSearch: "tenant_query_reuse_key_reattaches_to_active_run";
    refreshAfterSeconds: 3;
    pollCursor: "restored_from_scheduler_cursor_events";
    deltaCursor: "restored_from_latest_safe_delta";
    statusTransitions: Array<"queued" | "running" | "metadata_review" | "partial" | "completed" | "failed" | "cancelled">;
    unknownActorPolicy: "searching_only_until_query_matched_evidence";
    noDefaultActorFallback: true;
    noStaleCacheReady: true;
    noGenericLivePromotion: true;
  };
  restartFixtures: SchedulerPersistenceReplayFixture[];
  cutoverPhases: Array<{
    phase: "snapshot_embedded" | "shadow_write_postgres" | "restart_replay_rehearsal" | "duplicate_reuse_canary" | "worker_drain_replay" | "cutover_hold_or_promote" | "rollback";
    dryRun: true;
    willMutate: false;
    requiredChecks: string[];
    rollback: string;
  }>;
  routeContracts: {
    frontierStatusField: "scheduler.persistenceReplayCutover";
    frontierApplyPlanField: "applyPlan.persistenceReplayCutover";
    runStatusField: "scheduler.persistenceReplayCutover";
    contractsField: "surfaces.frontier.contracts.scheduler_persistence_replay_cutover";
  };
  handoffs: {
    agent09PublicApiFields: string[];
    agent10CapacityReleaseGate: string[];
  };
  releaseGate: {
    decision: "pass" | "hold" | "rollback";
    reasons: string[];
    proofCommands: string[];
  };
}

export interface SchedulerPostgresQueueAdapterReadinessDto {
  generatedAt: string;
  apiTargets: Array<"/v1/frontier/status" | "/v1/frontier/apply-plan" | "/v1/intel/search.scheduler" | "/v1/contracts" | "agent10_capacity_release_gate">;
  backendSelection: {
    activeBackend: "embedded_memory" | "postgres_scheduler_store";
    requestedBackend: "embedded_memory" | "postgres_scheduler_store";
    postgresEnabled: boolean;
    postgresDsnConfigured: boolean;
    shadowWritesEnabled: boolean;
    leaseMode: "disabled" | "shadow" | "active";
    effectiveLeaseOwner: "embedded_memory" | "postgres_scheduler_store";
  };
  safety: {
    disabledByDefault: true;
    failClosedWithoutDsn: true;
    failClosedWithoutExecutor: true;
    noImplicitNetworkDependency: true;
    embeddedMemoryRemainsAuthoritative: boolean;
    publicSearchPollingProtected: boolean;
  };
  operationContracts: Array<{
    operation: "enqueueTasks" | "leaseNext" | "heartbeatLease" | "checkpointTask" | "acknowledge" | "cancelRun" | "findOrRegisterRun" | "gcActiveRuns" | "pressure" | "deltasSince" | "runs" | "tasks";
    postgresTableContracts: SchedulerPersistenceReplayCutoverDto["postgresContracts"][number]["table"][];
    transactionBoundary: string;
    disabledBehavior: "uses_embedded_memory" | "throws_fail_closed";
  }>;
  preparedStatements: Array<{
    name: string;
    purpose: string;
    tables: SchedulerPersistenceReplayCutoverDto["postgresContracts"][number]["table"][];
    idempotencyKeyFields: string[];
  }>;
  routeContracts: {
    frontierStatusField: "scheduler.postgresQueueAdapter";
    frontierApplyPlanField: "applyPlan.postgresQueueAdapter";
    contractsField: "surfaces.frontier.contracts.scheduler_postgres_queue_adapter";
  };
  releaseGate: {
    decision: "pass" | "hold" | "rollback";
    reasons: string[];
    proofCommands: string[];
  };
}

export interface SchedulerExecutionSimulationResult {
  generatedAt: string;
  durationHours: number;
  workload: SchedulerExecutionTraffic;
  totals: {
    actorQueries: number;
    repeatedPolls: number;
    backgroundSweeps: number;
    publicChannelWindows: number;
    restrictedMetadataApprovals: number;
    evidenceReplayJobs: number;
    graphExportJobs: number;
    retentionJobs: number;
    leasedTasks: number;
    completedTasks: number;
    retryTasks: number;
    deadLetters: number;
  };
  slo: SchedulerExecutionSloFields;
  backpressure: SchedulerBackpressureSummary;
}

export type SchedulerReconciliationReasonCode =
  | "active_source_scheduled"
  | "approved_not_scheduled"
  | "missing_approved_source"
  | "unhealthy_active_source"
  | "active_without_recent_capture"
  | "policy_disabled_source"
  | "expired_approval"
  | "stale_legal_notes"
  | "duplicate_source"
  | "adapter_capability_mismatch"
  | "queued_task"
  | "leased_task"
  | "retry_backoff"
  | "dead_letter"
  | "active_run_reused"
  | "abandoned_run"
  | "stale_active_run"
  | "queue_pressure"
  | "low_priority_deferred";

export type SchedulerRepairAction =
  | "release_expired_leases"
  | "cancel_abandoned_runs"
  | "requeue_transient_failures"
  | "quarantine_permanently_failing_sources"
  | "delay_low_priority_sweeps"
  | "pause_noisy_source_queues"
  | "trigger_emergency_brake"
  | "no_action";

export interface SchedulerReconciliationItem {
  id: string;
  subjectType: "source" | "task" | "run" | "queue";
  subjectId: string;
  sourceId?: string;
  runId?: string;
  reasonCode: SchedulerReconciliationReasonCode;
  severity: "info" | "warn" | "critical";
  detail: string;
  repairAction: SchedulerRepairAction;
  nextActionableAt?: string;
}

export interface SchedulerReconciliationReport {
  generatedAt: string;
  totals: {
    sources: number;
    queuedTasks: number;
    leasedTasks: number;
    deadLetters: number;
    activeRuns: number;
    diagnosticsReturned: number;
    diagnosticsTruncated: number;
  };
  reasonCounts: Partial<Record<SchedulerReconciliationReasonCode, number>>;
  repairRecommendations: Array<{
    action: SchedulerRepairAction;
    count: number;
    reasonCodes: SchedulerReconciliationReasonCode[];
  }>;
  diagnostics: SchedulerReconciliationItem[];
}

export interface FairnessSimulationInput {
  publicLiveSearches: number;
  actorSweeps: number;
  publicChannelPolls: number;
  restrictedMetadataQueues: number;
  retentionReplayJobs: number;
  workerSlots: number;
}

export interface FairnessSimulationResult {
  totalTasks: number;
  workerSlots: number;
  leasedByClass: Partial<Record<SchedulerWorkClass, number>>;
  delayedLowPrioritySweeps: number;
  liveSearchStarved: boolean;
  backgroundSweepStarved: boolean;
  repairRecommendations: SchedulerRepairAction[];
}

export interface SchedulerPromotionGate {
  p95QueueAgeSeconds: number;
  abandonedRunCount: number;
  duplicateReuseRate: number;
  retryDebt: number;
  deadLetterRate: number;
  lowPriorityDeferralRate: number;
  emergencyBrakeState: "clear" | "armed" | "engaged";
}

export interface SchedulerRepairPlanStep {
  id: string;
  action: SchedulerRepairAction;
  reasonCodes: SchedulerReconciliationReasonCode[];
  affectedCount: number;
  applyMode: "dry_run";
  description: string;
}

export interface SchedulerCutoverRehearsalReport {
  generatedAt: string;
  scenario: string;
  promotionGate: SchedulerPromotionGate;
  reconciliation: SchedulerReconciliationReport;
  pressure: SchedulerPressureDto[];
  fairness: FairnessSimulationResult;
  activeRunReuse: {
    activeRuns: number;
    reusableRuns: number;
    duplicateReuseRate: number;
  };
  repairPlan: SchedulerRepairPlanStep[];
  blockers: string[];
  recommendedNextAction: "promote" | "hold" | "apply_repairs";
}

export type SchedulerApplyApproval = "automation_safe" | "human_approval_required" | "blocked" | "rollback_only";
export type SchedulerApplyRiskClass = "low" | "medium" | "high" | "emergency";

export interface SchedulerApplyExpectedDelta {
  queuedVisibleDelta: number;
  leasedDelta: number;
  activeRunDelta: number;
  deadLetterDelta: number;
  delayedTaskDelta: number;
  pausedSourceQueueDelta: number;
  workerSlotDelta: number;
  cursorReplayState: "preserved";
}

export interface SchedulerEmergencyBrakePolicy {
  state: SchedulerPromotionGate["emergencyBrakeState"];
  apiMode: "normal" | "warning_headers" | "shed_new_live_search";
  frontendMode: "normal" | "show_degraded_banner" | "disable_new_live_search";
  dbMode: "normal" | "read_mostly" | "protect_connections";
  workerMode: "normal" | "pause_low_priority" | "pause_noninteractive";
  preservesCursorReplayState: true;
  protectedHeadroom: {
    hostMemoryMb: number;
    maxSchedulerMemoryMb: number;
    maxDbConnectionUtilization: number;
    maxWorkerUtilization: number;
    maxApiP95QueueAgeSeconds: number;
  };
  warnings: string[];
}

export interface SchedulerApplyPlanStep {
  id: string;
  action: SchedulerRepairAction;
  dryRun: true;
  affectedCount: number;
  reasonCodes: SchedulerReconciliationReasonCode[];
  riskClass: SchedulerApplyRiskClass;
  approval: SchedulerApplyApproval;
  operatorApprovalRequired: boolean;
  preconditions: string[];
  expectedDelta: SchedulerApplyExpectedDelta;
  rollbackNotes: string;
  apiWarningCode?: string;
  sourceIds?: string[];
}

export interface SchedulerApplyPlanReport {
  generatedAt: string;
  scenario: string;
  dryRun: true;
  emergencyBrake: SchedulerEmergencyBrakePolicy;
  steps: SchedulerApplyPlanStep[];
  expectedTotalDelta: SchedulerApplyExpectedDelta;
  apiWarnings: string[];
  recommendation: "safe_to_promote" | "apply_repairs_first" | "hold_for_operator" | "emergency_brake_required";
}

export interface SchedulerApplyPlanApiRequestDto {
  dryRun?: true;
  scenario?: string;
  selectedActions?: SchedulerRepairAction[];
  includeExecutionPreview?: boolean;
  hostMemoryMb?: number;
  dbConnectionUtilization?: number;
  workerUtilization?: number;
  maxApiP95QueueAgeSeconds?: number;
}

export interface SchedulerApplyPlanApiItemDto {
  stepId: string;
  action: SchedulerRepairAction;
  dryRun: true;
  execution: SchedulerApplyApproval;
  riskClass: SchedulerApplyRiskClass;
  operatorApprovalRequired: boolean;
  affectedCount: number;
  reasonCodes: SchedulerReconciliationReasonCode[];
  preconditions: string[];
  expectedQueueRunDelta: SchedulerApplyExpectedDelta;
  rollback: string;
  apiWarningCode?: string;
  sourceIds?: string[];
}

export interface SchedulerApplyPlanExecutionPreview {
  dryRun: true;
  willMutate: false;
  willLeaseTasks: false;
  willAcknowledgeTasks: false;
  willChangeRuns: false;
  steps: Array<{
    stepId: string;
    action: SchedulerRepairAction;
    wouldApply: false;
    reason: string;
  }>;
}

export interface SchedulerApplyPlanApiExample {
  name:
    | "expired_lease_release"
    | "abandoned_run_cancel"
    | "transient_requeue"
    | "low_priority_deferral"
    | "noisy_source_pause"
    | "quarantine_recommendation"
    | "emergency_brake";
  description: string;
  request: SchedulerApplyPlanApiRequestDto;
  response: Pick<
    SchedulerApplyPlanApiResponseDto,
    "apiVersion" | "endpoint" | "dryRun" | "willMutate" | "willLeaseTasks" | "willAcknowledgeTasks" | "willChangeRuns"
  > & {
    item: SchedulerApplyPlanApiItemDto;
  };
}

export interface SchedulerApplyPlanApiResponseDto {
  apiVersion: "v1";
  endpoint: "/v1/frontier/apply-plan";
  applyPlanId: string;
  generatedAt: string;
  dryRun: true;
  willMutate: false;
  willLeaseTasks: false;
  willAcknowledgeTasks: false;
  willChangeRuns: false;
  request: SchedulerApplyPlanApiRequestDto & { dryRun: true };
  summary: {
    scenario: string;
    recommendation: SchedulerApplyPlanReport["recommendation"];
    stepCount: number;
    automationSafeCount: number;
    humanApprovalRequiredCount: number;
    rollbackOnlyCount: number;
    blockedCount: number;
    highestRiskClass: SchedulerApplyRiskClass;
    apiWarningCount: number;
  };
  emergencyBrake: SchedulerEmergencyBrakePolicy;
  expectedTotalDelta: SchedulerApplyExpectedDelta;
  apiWarnings: string[];
  items: SchedulerApplyPlanApiItemDto[];
  executionPreview?: SchedulerApplyPlanExecutionPreview;
  canaryControlPlane: {
    dryRun: true;
    willMutate: false;
    routeField: "applyPlan.canaryControlPlane";
    controls: Array<{
      action: SchedulerCanaryControlAction;
      expectedQueueRunDelta: SchedulerApplyExpectedDelta;
      warningCode?: string;
      rollback: string;
    }>;
    cursorReplayState: "preserved";
  };
  promotionPacketLink: {
    field: "schedulerApplyPlanId";
    value: string;
    recommendation: SchedulerApplyPlanReport["recommendation"];
    emergencyBrakeState: SchedulerPromotionGate["emergencyBrakeState"];
    unappliedActionCount: number;
  };
  schemaExamples: SchedulerApplyPlanApiExample[];
}

export interface SchedulerApplyPlanApiContractDto {
  endpoint: "/v1/frontier/apply-plan";
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
    itemFields: string[];
    forbiddenMutationFields: string[];
    actions: Exclude<SchedulerRepairAction, "no_action">[];
    executions: SchedulerApplyApproval[];
    riskClasses: SchedulerApplyRiskClass[];
  };
  examples: SchedulerApplyPlanApiExample[];
}
