import type { FocusedFrontier, FrontierAck, FrontierGroupSummary, QueuedFrontierItem } from "./frontier.ts";
import type { CollectionPlan, CollectionRun, CollectionTask, LiveSearchBackpressureState, PlannerDecisionStatus, PlanningBudgetClass, RunStatus, SourceRecord } from "../types.ts";

export type SchedulerBackend = "embedded_memory" | "postgres_queue" | "external_queue";

export type SchedulerWorkClass =
  | PlanningBudgetClass
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
