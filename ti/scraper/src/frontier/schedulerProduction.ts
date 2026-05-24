import type { FocusedFrontier, FrontierAck, FrontierGroupSummary, QueuedFrontierItem } from "./frontier.ts";
import type { CollectionPlan, CollectionRun, CollectionTask, LiveSearchBackpressureState, PlannerDecisionStatus, PlanningBudgetClass, RunStatus, SourceRecord } from "../types.ts";
import { stableId } from "../utils.ts";

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
  gcActiveRuns(now?: Date, options?: Parameters<typeof activeRunGcDecisions>[2]): ActiveRunGcDecision[];
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

export const SCHEDULER_CUTOVER_DESIGN: SchedulerCutoverDesign = {
  currentBackend: "embedded_memory",
  targetBackend: "postgres_queue",
  contractInvariants: [
    "Planner DTO fields remain API-facing and backend-neutral.",
    "Task ids, run ids, request ids, and reuse keys stay deterministic across retries.",
    "Leases are exclusive and expire without requiring worker cleanup.",
    "Acknowledgements are idempotent and append audit events before state changes are visible.",
    "Per-source concurrency, crawl budgets, backoff, and fairness ordering are enforced before lease acquisition."
  ],
  durableTables: [
    { name: "frontier_tasks", purpose: "Durable queued/completed task state with score, planning metadata, budgets, and fairness keys." },
    { name: "frontier_leases", purpose: "Exclusive worker leases with expiry, attempt deadlines, and acknowledgement state." },
    { name: "frontier_events", purpose: "Append-only audit trail for enqueue, lease, ack, retry, expiry, cancellation, and duplicate merge decisions." },
    { name: "crawl_budgets", purpose: "Request, tenant, source, and adapter budgets with reserved task and byte counters." },
    { name: "run_reuse_keys", purpose: "Active-run reuse key index for live search attachment and duplicate suppression." }
  ],
  leaseTransactionSteps: [
    "Requeue expired leases and release derived running counters.",
    "Merge duplicate queued work by tenant, reuse key, source, and target URL.",
    "Select eligible tasks using FOR UPDATE SKIP LOCKED.",
    "Filter exhausted budgets, source backoff, per-source concurrency, and expired deadlines.",
    "Order by effective priority, work-class boost, age, and recent fairness penalties.",
    "Insert lease, reserve budget counters, and emit a frontier_events lease record."
  ],
  acknowledgementSteps: [
    "Close the active lease if present and ignore duplicate acknowledgements.",
    "Complete tasks immediately when adapters succeed.",
    "Schedule retry with exponential backoff while retry budget remains.",
    "Move exhausted retries to dead-letter state with source backoff evidence.",
    "Cancel queued or leased tasks when policy, run, or operator state invalidates the work."
  ],
  apiContract: "Agent 09 can expose scheduler diagnostics without caring whether the implementation is embedded, Postgres-backed, or external-queue-backed."
};

export function schedulerLoadModelFixtures(): SchedulerLoadModelFixture[] {
  return [1, 10, 100, 1_000].map((liveSearchPollers) => ({
    name: `${liveSearchPollers}_live_search_pollers`,
    liveSearchPollers,
    expectedPollsPerMinute: Math.ceil(liveSearchPollers * 60 / 3),
    expectedNewRunsPerMinute: Math.max(1, Math.ceil(liveSearchPollers * 0.05)),
    analystDeepDives: Math.max(1, Math.ceil(liveSearchPollers / 25)),
    sourceHealthProbes: Math.max(5, Math.ceil(liveSearchPollers / 10)),
    restrictedMetadataSweeps: Math.max(1, Math.ceil(liveSearchPollers / 100)),
    replayRetentionJobs: Math.max(1, Math.ceil(liveSearchPollers / 200)),
    maxQueueAgeSeconds: {
      interactive_live_search: liveSearchPollers >= 1_000 ? 90 : 45,
      interactive_search: 120,
      analyst_deep_dive: 300,
      background_refresh: 1_800,
      broad_daily_sweep: 3_600,
      source_health_probe: 600,
      restricted_darknet_metadata_sweep: 900,
      replay_retention: 1_800
    }
  }));
}

export function schedulerSoakScenarios(): SchedulerSoakScenario[] {
  return [
    {
      name: "interactive_actor_search",
      liveSearchPollers: 25,
      actorQueriesPerMinute: 20,
      publicChannelPollsPerMinute: 120,
      sourceHealthProbes: 10,
      darknetApprovalQueue: 2,
      retentionReplayJobs: 1,
      analystDeepDives: 2,
      maxMemoryMb: 12_288,
      maxWorkerPoolSlots: 24
    },
    {
      name: "public_channel_polling",
      liveSearchPollers: 250,
      actorQueriesPerMinute: 75,
      publicChannelPollsPerMinute: 5_000,
      sourceHealthProbes: 25,
      darknetApprovalQueue: 5,
      retentionReplayJobs: 2,
      analystDeepDives: 5,
      maxMemoryMb: 49_152,
      maxWorkerPoolSlots: 80
    },
    {
      name: "darknet_metadata_approval_queue",
      liveSearchPollers: 100,
      actorQueriesPerMinute: 50,
      publicChannelPollsPerMinute: 1_000,
      sourceHealthProbes: 20,
      darknetApprovalQueue: 75,
      retentionReplayJobs: 2,
      analystDeepDives: 8,
      maxMemoryMb: 65_536,
      maxWorkerPoolSlots: 96
    },
    {
      name: "retention_replay_and_analyst_deep_dives",
      liveSearchPollers: 1_000,
      actorQueriesPerMinute: 150,
      publicChannelPollsPerMinute: 20_000,
      sourceHealthProbes: 100,
      darknetApprovalQueue: 10,
      retentionReplayJobs: 25,
      analystDeepDives: 40,
      maxMemoryMb: 98_304,
      maxWorkerPoolSlots: 160
    }
  ];
}

export function schedulerWorkerRuntimeFixtures(now = new Date("2026-05-24T05:00:00.000Z")): SchedulerWorkerRuntimeFixture[] {
  const baseWorkerLoop: SchedulerWorkerRuntimeFixture["workerLoop"] = {
    lease: "required",
    heartbeat: "required",
    checkpoint: "required",
    acknowledgement: "required",
    cancellation: "supported"
  };
  const polling = (input: {
    seconds: number;
    continuity: SchedulerPollingContract["cursorContinuity"];
    cursor?: string;
    promoted?: number;
    reasons?: string[];
  }): SchedulerPollingContract => ({
    nextPollSeconds: input.seconds,
    nextPollAt: new Date(now.getTime() + input.seconds * 1_000).toISOString(),
    cursorContinuity: input.continuity,
    latestCursor: input.cursor,
    promotedEvidenceCount: input.promoted ?? 0,
    partialReasons: input.reasons ?? []
  });
  const agent09Fields = ["nextPollSeconds", "nextPollAt", "cursorContinuity", "latestCursor", "promotedEvidenceCount", "partialReasons"];
  const agent10GateFields = ["queuePressure", "retryAfterSeconds", "deadLetter", "emergencyBrakeState"];
  return [
    {
      name: "normal",
      state: "normal",
      workerLoop: baseWorkerLoop,
      queuePressure: "accepted",
      deadLetter: false,
      polling: polling({ seconds: 3, continuity: "continued", cursor: "cursor_normal", promoted: 2 }),
      agent09Fields,
      agent10GateFields
    },
    {
      name: "degraded_provider_failure",
      state: "degraded",
      workerLoop: baseWorkerLoop,
      queuePressure: "deferred_by_source_backoff",
      retryAfterSeconds: 60,
      deadLetter: false,
      polling: polling({ seconds: 60, continuity: "waiting_for_deltas", cursor: "cursor_retry", reasons: ["provider_failure_retry_backoff"] }),
      agent09Fields,
      agent10GateFields
    },
    {
      name: "overloaded",
      state: "overloaded",
      workerLoop: baseWorkerLoop,
      queuePressure: "deferred_by_queue_pressure",
      retryAfterSeconds: 30,
      deadLetter: false,
      polling: polling({ seconds: 30, continuity: "waiting_for_deltas", reasons: ["queue_pressure"] }),
      agent09Fields,
      agent10GateFields
    },
    {
      name: "cancelled",
      state: "cancelled",
      workerLoop: baseWorkerLoop,
      queuePressure: "accepted",
      deadLetter: false,
      polling: polling({ seconds: 60, continuity: "cancelled", reasons: ["run_cancelled"] }),
      agent09Fields,
      agent10GateFields
    },
    {
      name: "retry_exhausted",
      state: "retry_exhausted",
      workerLoop: baseWorkerLoop,
      queuePressure: "blocked_by_policy",
      deadLetter: true,
      polling: polling({ seconds: 60, continuity: "blocked", cursor: "cursor_dead", reasons: ["retry_exhausted"] }),
      agent09Fields,
      agent10GateFields
    },
    {
      name: "duplicate_query",
      state: "duplicate_query",
      workerLoop: baseWorkerLoop,
      queuePressure: "attached_to_active_run",
      deadLetter: false,
      polling: polling({ seconds: 5, continuity: "continued", cursor: "cursor_active", promoted: 1 }),
      agent09Fields,
      agent10GateFields
    },
    {
      name: "stale_active_run",
      state: "stale_active_run",
      workerLoop: baseWorkerLoop,
      queuePressure: "deferred_by_queue_pressure",
      retryAfterSeconds: 30,
      deadLetter: false,
      polling: polling({ seconds: 30, continuity: "waiting_for_deltas", reasons: ["stale_active_run"] }),
      agent09Fields,
      agent10GateFields
    },
    {
      name: "soak_24h",
      state: "soak_24h",
      workerLoop: baseWorkerLoop,
      queuePressure: "deferred_by_queue_pressure",
      retryAfterSeconds: 30,
      deadLetter: false,
      polling: polling({ seconds: 30, continuity: "continued", cursor: "cursor_soak", promoted: 24, reasons: ["soak_window_pressure"] }),
      agent09Fields,
      agent10GateFields
    }
  ];
}

export function evaluateSchedulerSoakScenario(
  scenario: SchedulerSoakScenario,
  limits: { memoryCeilingMb?: number; workerPoolCeiling?: number; maxBackgroundSweepQueue?: number } = {}
): SchedulerSoakEvaluation {
  const memoryCeilingMb = limits.memoryCeilingMb ?? 160 * 1024;
  const workerPoolCeiling = limits.workerPoolCeiling ?? 256;
  const maxBackgroundSweepQueue = limits.maxBackgroundSweepQueue ?? 50_000;
  const expectedBackgroundQueue = scenario.retentionReplayJobs * 200 + scenario.sourceHealthProbes * 10;
  const reasons = [
    scenario.maxMemoryMb > memoryCeilingMb ? "memory_ceiling" : undefined,
    scenario.maxWorkerPoolSlots > workerPoolCeiling ? "worker_pool_ceiling" : undefined,
    expectedBackgroundQueue > maxBackgroundSweepQueue ? "background_sweep_queue_ceiling" : undefined
  ].filter((reason): reason is string => Boolean(reason));
  return {
    scenario: scenario.name,
    accepted: reasons.length === 0,
    reasons,
    expectedQueuePressure: scenario.liveSearchPollers >= 1_000 ? "deferred_by_queue_pressure" : "accepted"
  };
}

export const DEFAULT_SCHEDULER_EXECUTION_SLO: SchedulerExecutionSloThresholds = {
  queueAgeP95Seconds: 90,
  leaseAgeP95Seconds: 120,
  retryExhaustionRate: 0.02,
  perSourceFairnessWorstShare: 0.25,
  interactiveSearchLatencyP95Ms: 2_500,
  pollFreshnessP95Seconds: 30,
  workerMemoryPressure: 0.82
};

export function simulateSchedulerExecution(input: {
  durationHours?: number;
  generatedAt?: string;
  traffic: SchedulerExecutionTraffic;
  workerSlots?: number;
  memoryCeilingMb?: number;
  slo?: SchedulerExecutionSloThresholds;
}): SchedulerExecutionSimulationResult {
  const durationHours = input.durationHours ?? 24;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const workerSlots = input.workerSlots ?? 96;
  const memoryCeilingMb = input.memoryCeilingMb ?? 96 * 1024;
  const slo = input.slo ?? DEFAULT_SCHEDULER_EXECUTION_SLO;
  const traffic = input.traffic;
  const actorQueries = Math.round(traffic.actorQueriesPerHour * durationHours);
  const repeatedPolls = Math.round(traffic.repeatedPollsPerHour * durationHours);
  const backgroundSweeps = Math.round(traffic.backgroundSweepsPerHour * durationHours);
  const publicChannelWindows = Math.round(traffic.publicChannelWindowsPerHour * durationHours);
  const restrictedMetadataApprovals = traffic.restrictedSourcesDisabled ? 0 : Math.round(traffic.restrictedMetadataApprovalsPerHour * durationHours);
  const evidenceReplayJobs = Math.round(traffic.evidenceReplayJobsPerHour * durationHours);
  const graphExportJobs = Math.round(traffic.graphExportJobsPerHour * durationHours);
  const retentionJobs = Math.round(traffic.retentionJobsPerHour * durationHours);
  const interactiveLoad = actorQueries + Math.ceil(repeatedPolls * 0.2);
  const backgroundLoad = backgroundSweeps * 6 + publicChannelWindows * 2 + restrictedMetadataApprovals * 3 + evidenceReplayJobs * 4 + graphExportJobs * 5 + retentionJobs * 3;
  const totalWork = Math.max(1, interactiveLoad + backgroundLoad);
  const capacity = Math.max(1, workerSlots * durationHours * 60);
  const loadRatio = totalWork / capacity;
  const outagePenalty = traffic.providerOutage ? 1.8 : 1;
  const inactivePenalty = 1 + (traffic.inactiveClientRatio ?? 0) * 0.8;
  const emergencyRecovery = traffic.emergencyBrakeRecoveryAtHour !== undefined ? Math.max(0.55, 1 - (durationHours - traffic.emergencyBrakeRecoveryAtHour) / durationHours * 0.35) : 1;
  const queueP95 = Math.round((15 + loadRatio * 120 + repeatedPolls / Math.max(1, actorQueries) * 8) * outagePenalty * inactivePenalty * emergencyRecovery);
  const leaseP95 = Math.round((20 + loadRatio * 80 + (traffic.providerOutage ? 60 : 0)) * emergencyRecovery);
  const retryRate = clampRate(0.004 + (traffic.providerOutage ? 0.045 : 0) + (traffic.restrictedSourcesDisabled ? 0.012 : 0) + Math.max(0, loadRatio - 1) * 0.03);
  const retryTasks = Math.round(totalWork * retryRate);
  const deadLetters = Math.round(retryTasks * (traffic.providerOutage ? 0.22 : traffic.restrictedSourcesDisabled ? 0.14 : 0.04));
  const fairnessShare = clampRate(0.12 + publicChannelWindows / Math.max(1, totalWork) * 0.7 + (traffic.repeatedPollsPerHour > traffic.actorQueriesPerHour * 20 ? 0.08 : 0));
  const latencyP95 = Math.round(550 + queueP95 * 18 + (traffic.providerOutage ? 900 : 0));
  const pollFreshness = Math.round(5 + queueP95 * 0.35 + (traffic.inactiveClientRatio ?? 0) * 30);
  const memoryPressure = clampRate((totalWork * 6) / memoryCeilingMb + workerSlots / 512 + (traffic.providerOutage ? 0.08 : 0));
  const sloFields: SchedulerExecutionSloFields = {
    queueAge: { p95Seconds: queueP95, maxSeconds: Math.round(queueP95 * 2.4), ok: queueP95 <= slo.queueAgeP95Seconds },
    leaseAge: { p95Seconds: leaseP95, maxSeconds: Math.round(leaseP95 * 2), ok: leaseP95 <= slo.leaseAgeP95Seconds },
    retryExhaustion: { rate: totalWork === 0 ? 0 : deadLetters / totalWork, exhaustedTasks: deadLetters, ok: deadLetters / totalWork <= slo.retryExhaustionRate },
    perSourceFairness: { worstShare: fairnessShare, noisySourceId: fairnessShare > slo.perSourceFairnessWorstShare ? "public-channel-hot-source" : undefined, ok: fairnessShare <= slo.perSourceFairnessWorstShare },
    interactiveSearchLatency: { p95Ms: latencyP95, ok: latencyP95 <= slo.interactiveSearchLatencyP95Ms },
    pollFreshness: { p95Seconds: pollFreshness, ok: pollFreshness <= slo.pollFreshnessP95Seconds },
    workerMemoryPressure: { ratio: memoryPressure, ok: memoryPressure <= slo.workerMemoryPressure }
  };
  const totals = {
    actorQueries,
    repeatedPolls,
    backgroundSweeps,
    publicChannelWindows,
    restrictedMetadataApprovals,
    evidenceReplayJobs,
    graphExportJobs,
    retentionJobs,
    leasedTasks: totalWork,
    completedTasks: Math.max(0, totalWork - retryTasks),
    retryTasks,
    deadLetters
  };
  const backpressure = schedulerBackpressureSummaryForSlo(sloFields, traffic);
  return {
    generatedAt,
    durationHours,
    workload: traffic,
    totals,
    slo: sloFields,
    backpressure
  };
}

export function schedulerBackpressureSummaryForTasks(input: {
  queued: CollectionTask[];
  leased?: CollectionTask[];
  deadLetters?: FrontierAck[];
  runs?: CollectionRun[];
  now?: Date;
}): SchedulerBackpressureSummary {
  const now = input.now ?? new Date();
  const tasks = [...input.queued, ...(input.leased ?? [])];
  const queueAges = input.queued.map((task) => queueAgeSeconds(task, now));
  const leaseAges = (input.leased ?? []).map((task) => Math.max(0, Math.round((now.getTime() - Date.parse(task.attemptDeadlineAt ?? task.queuedAt)) / 1000)));
  const bySource = new Map<string, number>();
  for (const task of tasks) bySource.set(task.sourceId, (bySource.get(task.sourceId) ?? 0) + 1);
  const worstSource = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0];
  const fairnessApplies = tasks.length >= 10;
  const worstShare = fairnessApplies && worstSource ? worstSource[1] / tasks.length : 0;
  const retryDebt = tasks.filter((task) => task.retryCount > 0 || (task.availableAt && Date.parse(task.availableAt) > now.getTime())).length;
  const deadLetters = input.deadLetters?.length ?? 0;
  const p95Queue = percentile(queueAges, 0.95);
  const p95Lease = percentile(leaseAges, 0.95);
  const slo: SchedulerExecutionSloFields = {
    queueAge: { p95Seconds: p95Queue, maxSeconds: queueAges.length ? Math.max(...queueAges) : 0, ok: p95Queue <= DEFAULT_SCHEDULER_EXECUTION_SLO.queueAgeP95Seconds },
    leaseAge: { p95Seconds: p95Lease, maxSeconds: leaseAges.length ? Math.max(...leaseAges) : 0, ok: p95Lease <= DEFAULT_SCHEDULER_EXECUTION_SLO.leaseAgeP95Seconds },
    retryExhaustion: { rate: tasks.length ? deadLetters / tasks.length : 0, exhaustedTasks: deadLetters, ok: tasks.length ? deadLetters / tasks.length <= DEFAULT_SCHEDULER_EXECUTION_SLO.retryExhaustionRate : true },
    perSourceFairness: { worstShare, noisySourceId: worstShare > DEFAULT_SCHEDULER_EXECUTION_SLO.perSourceFairnessWorstShare ? worstSource?.[0] : undefined, ok: worstShare <= DEFAULT_SCHEDULER_EXECUTION_SLO.perSourceFairnessWorstShare },
    interactiveSearchLatency: { p95Ms: 500 + p95Queue * 18, ok: 500 + p95Queue * 18 <= DEFAULT_SCHEDULER_EXECUTION_SLO.interactiveSearchLatencyP95Ms },
    pollFreshness: { p95Seconds: Math.round(5 + p95Queue * 0.35), ok: Math.round(5 + p95Queue * 0.35) <= DEFAULT_SCHEDULER_EXECUTION_SLO.pollFreshnessP95Seconds },
    workerMemoryPressure: { ratio: clampRate(tasks.length / 1_500 + retryDebt / 2_000), ok: tasks.length / 1_500 + retryDebt / 2_000 <= DEFAULT_SCHEDULER_EXECUTION_SLO.workerMemoryPressure }
  };
  return schedulerBackpressureSummaryForSlo(slo, {
    providerOutage: false,
    restrictedSourcesDisabled: false
  });
}

export function schedulerWorkerLoopContract(generatedAt = new Date().toISOString()): SchedulerWorkerLoopContract {
  return {
    generatedAt,
    workerLoop: [
      {
        name: "lease",
        required: true,
        runtimeEvent: "task_leased",
        invariant: "workers only execute tasks after an owned lease is created with a finite expiry",
        apiFields: ["leasedTaskCount", "queueEconomics.workClassBudget.leased"]
      },
      {
        name: "heartbeat",
        required: true,
        runtimeEvent: "worker_heartbeat",
        invariant: "active leases extend only when the same worker id owns the task",
        apiFields: ["backpressure.slo.leaseAge.p95Seconds", "queueEconomics.memoryPressure.ratio"]
      },
      {
        name: "checkpoint",
        required: true,
        runtimeEvent: "task_checkpointed",
        invariant: "partial progress updates cursor-visible state without acknowledging the task",
        apiFields: ["cursorContinuity", "latestCursor", "promotedEvidenceCount", "newEvidenceDeltaCount"]
      },
      {
        name: "acknowledge",
        required: true,
        runtimeEvent: "task_completed",
        invariant: "completion removes the task from queued and leased sets exactly once",
        apiFields: ["queuedTaskCount", "leasedTaskCount"]
      },
      {
        name: "retry_backoff",
        required: true,
        runtimeEvent: "task_retry_scheduled",
        invariant: "transient failures re-enter the queue with bounded exponential backoff and max retry debt",
        apiFields: ["queueEconomics.totals.retryDebt", "backpressure.slo.retryExhaustion.rate"]
      },
      {
        name: "stale_lease_recovery",
        required: true,
        runtimeEvent: "task_retry_scheduled",
        invariant: "expired leases become visible for leasing again while preserving checkpoint cursor fields",
        apiFields: ["backpressure.slo.leaseAge.p95Seconds", "queueEconomics.workClassBudget.maxQueuedAgeSeconds"]
      },
      {
        name: "duplicate_run_reuse",
        required: true,
        runtimeEvent: "run_reused",
        invariant: "matching active tenant/reuse keys attach clients to the existing run instead of duplicating work",
        apiFields: ["attachedToActiveRun", "reuseKey", "backpressureState"]
      },
      {
        name: "abandoned_client_cleanup",
        required: true,
        runtimeEvent: "run_cancelled",
        invariant: "runs without active polling clients past the abandonment window are cancelled before more work is leased",
        apiFields: ["partialReasons", "queueEconomics.emergencyBrakeState"]
      },
      {
        name: "cancellation",
        required: true,
        runtimeEvent: "task_cancelled",
        invariant: "run cancellation cancels queued and leased tasks without crossing source policy boundaries",
        apiFields: ["runStatus", "blockedReasons"]
      },
      {
        name: "cursor_continuity",
        required: true,
        runtimeEvent: "task_checkpointed",
        invariant: "polling clients can resume from the latest known delta cursor after retries or active-run reuse",
        apiFields: ["cursorContinuity", "latestCursor", "nextPollAt"]
      }
    ],
    staleLeaseRecovery: {
      leaseTtlSeconds: 300,
      recoveryEvent: "task_retry_scheduled",
      preservesCheckpoint: true
    },
    retryBackoff: {
      baseSeconds: 30,
      maxRetriesDefault: 3,
      strategy: "exponential"
    },
    abandonedClientCleanup: {
      staleActiveRunSeconds: 1_800,
      abandonedPollingSeconds: 900,
      action: "mark_abandoned_cancelled"
    },
    cursorContinuity: {
      requiredDeltas: ["task_enqueued", "task_leased", "task_checkpointed", "worker_heartbeat", "task_completed", "task_retry_scheduled", "task_cancelled", "run_cancelled", "run_reused"],
      apiFields: ["nextPollAt", "cursorContinuity", "latestCursor", "promotedEvidenceCount", "newEvidenceDeltaCount", "partialReasons"]
    }
  };
}

export function buildSchedulerQueueEconomics(input: {
  queued: CollectionTask[];
  leased?: CollectionTask[];
  deadLetters?: FrontierAck[];
  workerSlots?: number;
  memoryCeilingMb?: number;
  now?: Date;
}): SchedulerQueueEconomicsDto {
  const now = input.now ?? new Date();
  const queued = input.queued;
  const leased = input.leased ?? [];
  const tasks = [...queued, ...leased];
  const deadLetters = input.deadLetters ?? [];
  const retryDebt = tasks.filter((task) => task.retryCount > 0 || (task.availableAt && Date.parse(task.availableAt) > now.getTime())).length;
  const maxQueuedAgeSeconds = queued.length ? Math.max(...queued.map((task) => queueAgeSeconds(task, now))) : 0;
  const workerSlots = Math.max(1, input.workerSlots ?? 96);
  const memoryCeilingMb = Math.max(1, input.memoryCeilingMb ?? 96 * 1024);
  const grouped = new Map<SchedulerWorkClass, { queued: CollectionTask[]; leased: CollectionTask[] }>();
  for (const task of queued) {
    const workClass = workClassForTask(task);
    const group = grouped.get(workClass) ?? { queued: [], leased: [] };
    group.queued.push(task);
    grouped.set(workClass, group);
  }
  for (const task of leased) {
    const workClass = workClassForTask(task);
    const group = grouped.get(workClass) ?? { queued: [], leased: [] };
    group.leased.push(task);
    grouped.set(workClass, group);
  }
  const fairnessGroups = new Map<string, number>();
  for (const task of tasks) fairnessGroups.set(task.sourceId, (fairnessGroups.get(task.sourceId) ?? 0) + 1);
  const worstFairness = [...fairnessGroups.entries()].sort((a, b) => b[1] - a[1])[0];
  const worstShare = tasks.length && worstFairness ? worstFairness[1] / tasks.length : 0;
  const memoryPressureRatio = clampRate((tasks.length * 7 + retryDebt * 3 + leased.length * 12) / memoryCeilingMb);
  const interactiveTasks = tasks.filter((task) => workClassForTask(task) === "interactive_live_search" || workClassForTask(task) === "interactive_search");
  const interactiveMaxAge = interactiveTasks.length ? Math.max(...interactiveTasks.map((task) => queueAgeSeconds(task, now))) : 0;
  const interactiveLatencyP95 = Math.round(500 + interactiveMaxAge * 18 + retryDebt * 12);
  const retryExhaustionRate = tasks.length ? deadLetters.length / tasks.length : 0;
  const workClassBudget = [...grouped.entries()]
    .map(([workClass, group]) => {
      const classTasks = [...group.queued, ...group.leased];
      const classRetryDebt = classTasks.filter((task) => task.retryCount > 0 || (task.availableAt && Date.parse(task.availableAt) > now.getTime())).length;
      const classMaxAge = group.queued.length ? Math.max(...group.queued.map((task) => queueAgeSeconds(task, now))) : 0;
      const budgetShare = budgetShareForWorkClass(workClass);
      const budgetSlots = Math.max(1, Math.round(workerSlots * budgetShare));
      return {
        workClass,
        queued: group.queued.length,
        leased: group.leased.length,
        budgetSlots,
        budgetShare,
        maxQueuedAgeSeconds: classMaxAge,
        retryDebt: classRetryDebt,
        recommendedAction: recommendedEconomicsAction(workClass, classMaxAge, classRetryDebt, classTasks.length, budgetSlots)
      };
    })
    .sort((a, b) => b.maxQueuedAgeSeconds - a.maxQueuedAgeSeconds || a.workClass.localeCompare(b.workClass));
  const emergencyBrakeState: SchedulerPromotionGate["emergencyBrakeState"] = memoryPressureRatio > DEFAULT_SCHEDULER_EXECUTION_SLO.workerMemoryPressure || maxQueuedAgeSeconds > DEFAULT_SCHEDULER_EXECUTION_SLO.queueAgeP95Seconds * 2
    ? "engaged"
    : memoryPressureRatio > 0.7 || maxQueuedAgeSeconds > DEFAULT_SCHEDULER_EXECUTION_SLO.queueAgeP95Seconds || retryExhaustionRate > DEFAULT_SCHEDULER_EXECUTION_SLO.retryExhaustionRate
      ? "armed"
      : "clear";
  const shiftSteps = capacityShiftPlanSteps(workClassBudget, {
    worstShare,
    worstGroup: worstFairness?.[0],
    retryExhaustionRate,
    memoryPressureRatio,
    emergencyBrakeState
  });
  const decision: SchedulerQueueEconomicsDto["agent10SoakPacket"]["decision"] = emergencyBrakeState === "engaged"
    ? "rollback"
    : emergencyBrakeState === "armed" || shiftSteps.length > 0
      ? "hold"
      : "pass";
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/frontier/status", "/v1/intel/search.scheduler", "agent10_soak_packet"],
    totals: {
      queued: queued.length,
      leased: leased.length,
      deadLetters: deadLetters.length,
      retryDebt,
      maxQueuedAgeSeconds
    },
    workClassBudget,
    fairness: {
      worstGroup: worstFairness?.[0],
      worstShare,
      ok: worstShare <= DEFAULT_SCHEDULER_EXECUTION_SLO.perSourceFairnessWorstShare
    },
    interactiveLatency: {
      p95Ms: interactiveLatencyP95,
      ok: interactiveLatencyP95 <= DEFAULT_SCHEDULER_EXECUTION_SLO.interactiveSearchLatencyP95Ms
    },
    deadLetterTrend: {
      window: "24h",
      count: deadLetters.length,
      direction: deadLetters.length > Math.max(2, tasks.length * DEFAULT_SCHEDULER_EXECUTION_SLO.retryExhaustionRate) ? "rising" : "flat",
      retryExhaustionRate
    },
    memoryPressure: {
      ratio: memoryPressureRatio,
      ok: memoryPressureRatio <= DEFAULT_SCHEDULER_EXECUTION_SLO.workerMemoryPressure
    },
    emergencyBrakeState,
    dryRunCapacityShiftPlan: {
      dryRun: true,
      willMutate: false,
      steps: shiftSteps
    },
    agent10SoakPacket: {
      fields: ["workClassBudget", "fairness", "interactiveLatency", "maxQueuedAgeSeconds", "retryDebt", "deadLetterTrend", "memoryPressure", "emergencyBrakeState"],
      decision,
      proofCommands: ["bun test src/tests/schedulerProduction.test.ts", "bun run check:frontier-apply-plan"]
    }
  };
}

export function buildSchedulerRuntimeExecution(input: {
  queued: CollectionTask[];
  leased?: CollectionTask[];
  deadLetters?: FrontierAck[];
  deltas?: SchedulerRuntimeDelta[];
  sinceCursor?: string;
  now?: Date;
  queueEconomics?: SchedulerQueueEconomicsDto;
  restrictedKillSwitchActive?: boolean;
  approvedRestrictedMetadata?: boolean;
  pendingActivationBatchCount?: number;
}): SchedulerRuntimeExecutionDto {
  const now = input.now ?? new Date();
  const queued = input.queued;
  const leased = input.leased ?? [];
  const deadLetters = input.deadLetters ?? [];
  const allTasks = [...queued, ...leased];
  const allDeltas = input.deltas ?? [];
  const visibleDeltas = deltasSinceCursor(allDeltas, input.sinceCursor);
  const queueEconomics = input.queueEconomics ?? buildSchedulerQueueEconomics({ queued, leased, deadLetters, now });
  const retryDeltas = visibleDeltas.filter((delta) => delta.kind === "task_retry_scheduled");
  const checkpointed = visibleDeltas.filter((delta) => delta.kind === "task_checkpointed").length;
  const acknowledged = visibleDeltas.filter((delta) => delta.kind === "task_completed").length;
  const cancelled = visibleDeltas.filter((delta) => delta.kind === "task_cancelled" || delta.kind === "run_cancelled").length;
  const staleRecovered = retryDeltas.filter((delta) => delta.message.toLowerCase().includes("lease expired")).length;
  const latestCursor = visibleDeltas.at(-1)?.cursor ?? allDeltas.at(-1)?.cursor;
  const cursorContinuity: SchedulerRuntimeExecutionDto["pollingDeltas"]["cursorContinuity"] = input.sinceCursor
    ? visibleDeltas.length > 0 ? "continued" : "waiting_for_deltas"
    : allDeltas.length > 0 ? "continued" : "not_started";
  const controls = runtimeExecutionControls({
    tasks: allTasks,
    queueEconomics,
    restrictedKillSwitchActive: input.restrictedKillSwitchActive,
    approvedRestrictedMetadata: input.approvedRestrictedMetadata,
    pendingActivationBatchCount: input.pendingActivationBatchCount ?? 0
  });
  const activationGuard = sourceActivationBudgetGuard(queueEconomics, controls, input.pendingActivationBatchCount ?? 0);
  const decision: SchedulerRuntimeExecutionDto["agent10SoakPacket"]["decision"] = queueEconomics.emergencyBrakeState === "engaged" || activationGuard.state === "blocked_by_emergency_brake"
    ? "rollback"
    : controls.length > 0 || activationGuard.state === "hold_activation_batches"
      ? "hold"
      : "pass";
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/frontier/status", "agent10_soak_packet"],
    totals: {
      queued: queued.length,
      leased: leased.length,
      checkpointed,
      retried: retryDeltas.length,
      acknowledged,
      cancelled,
      deadLettered: deadLetters.length + visibleDeltas.filter((delta) => delta.kind === "task_failed").length,
      staleRecovered
    },
    byRun: runtimeByRun(allTasks, deadLetters, visibleDeltas),
    bySource: runtimeBySource(allTasks, deadLetters, visibleDeltas),
    byWorkClass: runtimeByWorkClass(queued, leased, deadLetters, visibleDeltas, now),
    pollingDeltas: {
      sinceCursor: input.sinceCursor,
      latestCursor,
      cursorContinuity,
      newDeltaCount: visibleDeltas.length,
      kinds: [...new Set(visibleDeltas.map((delta) => delta.kind))]
    },
    dryRunControls: {
      dryRun: true,
      willMutate: false,
      controls
    },
    sourceActivationBudgetGuard: activationGuard,
    agent10SoakPacket: {
      fields: ["totals", "byRun", "bySource", "byWorkClass", "pollingDeltas", "dryRunControls", "sourceActivationBudgetGuard"],
      decision,
      proofCommands: ["bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts", "bun run check:frontier-apply-plan"]
    }
  };
}

export function buildSchedulerRuntimeSla(input: {
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  runs?: CollectionRun[];
  now?: Date;
  thresholds?: Partial<{
    leaseLatencyMs: number;
    checkpointFreshnessSeconds: number;
    retryDebt: number;
    deadLetterGrowth: number;
    abandonedClientCleanupCount: number;
    runReuseRatio: number;
    fairnessWorstShare: number;
    sourceSlaPressureCount: number;
    cursorContinuityGapCount: number;
  }>;
}): SchedulerRuntimeSlaDto {
  const now = input.now ?? new Date();
  const thresholds = {
    leaseLatencyMs: input.thresholds?.leaseLatencyMs ?? 2_500,
    checkpointFreshnessSeconds: input.thresholds?.checkpointFreshnessSeconds ?? 45,
    retryDebt: input.thresholds?.retryDebt ?? 24,
    deadLetterGrowth: input.thresholds?.deadLetterGrowth ?? 3,
    abandonedClientCleanupCount: input.thresholds?.abandonedClientCleanupCount ?? 0,
    runReuseRatio: input.thresholds?.runReuseRatio ?? 0.6,
    fairnessWorstShare: input.thresholds?.fairnessWorstShare ?? DEFAULT_SCHEDULER_EXECUTION_SLO.perSourceFairnessWorstShare,
    sourceSlaPressureCount: input.thresholds?.sourceSlaPressureCount ?? 3,
    cursorContinuityGapCount: input.thresholds?.cursorContinuityGapCount ?? 0
  };
  const runs = input.runs ?? [];
  const activeRuns = runs.filter((run) => run.status === "queued" || run.status === "running");
  const reusableRuns = activeRuns.filter((run) => Boolean(run.requestHash));
  const abandonedRuns = activeRuns.filter((run) => {
    const updatedAt = Date.parse(run.updatedAt);
    return Number.isFinite(updatedAt) && now.getTime() - updatedAt >= 15 * 60_000;
  });
  const latestCursorFreshness = input.runtimeExecution.pollingDeltas.latestCursor
    ? Math.max(0, Math.round((now.getTime() - Date.parse(input.runtimeExecution.pollingDeltas.latestCursor.split("#")[0] ?? "")) / 1000))
    : input.runtimeExecution.pollingDeltas.cursorContinuity === "not_started" ? 0 : 999;
  const sourceSlaPressure = input.queueEconomics.workClassBudget.filter((budget) =>
    budget.recommendedAction !== "accept" || budget.maxQueuedAgeSeconds > DEFAULT_SCHEDULER_EXECUTION_SLO.queueAgeP95Seconds
  ).length;
  const cursorGapCount = input.runtimeExecution.pollingDeltas.cursorContinuity === "waiting_for_deltas" && input.queueEconomics.totals.queued > 0 ? 1 : 0;
  const leaseLatencyMs = input.queueEconomics.interactiveLatency.p95Ms;
  const runReuseRatio = activeRuns.length ? reusableRuns.length / activeRuns.length : 1;
  const metrics: SchedulerRuntimeSlaMetric[] = [
    slaMetric("lease_latency", leaseLatencyMs, thresholds.leaseLatencyMs, "ms", leaseLatencyMs <= thresholds.leaseLatencyMs, leaseLatencyMs <= thresholds.leaseLatencyMs * 1.5, "api_polling_degraded", "interactive lease latency p95"),
    slaMetric("checkpoint_freshness", latestCursorFreshness, thresholds.checkpointFreshnessSeconds, "seconds", latestCursorFreshness <= thresholds.checkpointFreshnessSeconds, latestCursorFreshness <= thresholds.checkpointFreshnessSeconds * 3, "api_polling_degraded", "latest checkpoint or polling cursor freshness"),
    slaMetric("retry_debt", input.queueEconomics.totals.retryDebt, thresholds.retryDebt, "count", input.queueEconomics.totals.retryDebt <= thresholds.retryDebt, input.queueEconomics.totals.retryDebt <= thresholds.retryDebt * 2, "worker_safety_risk", "queued retry debt"),
    slaMetric("dead_letter_growth", input.queueEconomics.deadLetterTrend.count, thresholds.deadLetterGrowth, "count", input.queueEconomics.deadLetterTrend.count <= thresholds.deadLetterGrowth && input.queueEconomics.deadLetterTrend.direction === "flat", input.queueEconomics.deadLetterTrend.count <= thresholds.deadLetterGrowth * 2, "worker_safety_risk", "24h dead-letter growth"),
    slaMetric("abandoned_client_cleanup", abandonedRuns.length, thresholds.abandonedClientCleanupCount, "count", abandonedRuns.length <= thresholds.abandonedClientCleanupCount, abandonedRuns.length <= Math.max(1, thresholds.abandonedClientCleanupCount + 2), "worker_safety_risk", "active runs past abandoned polling window"),
    slaMetric("run_reuse", runReuseRatio, thresholds.runReuseRatio, "ratio", runReuseRatio >= thresholds.runReuseRatio, runReuseRatio >= thresholds.runReuseRatio * 0.75, "public_answer_degraded", "active run reuse coverage"),
    slaMetric("fairness", input.queueEconomics.fairness.worstShare, thresholds.fairnessWorstShare, "ratio", input.queueEconomics.fairness.worstShare <= thresholds.fairnessWorstShare, input.queueEconomics.fairness.worstShare <= thresholds.fairnessWorstShare * 1.5, "public_answer_degraded", "worst source scheduler share"),
    slaMetric("source_sla_pressure", sourceSlaPressure, thresholds.sourceSlaPressureCount, "count", sourceSlaPressure <= thresholds.sourceSlaPressureCount, sourceSlaPressure <= thresholds.sourceSlaPressureCount * 2, "public_answer_degraded", "work classes under source SLA pressure"),
    slaMetric("cursor_continuity", cursorGapCount, thresholds.cursorContinuityGapCount, "count", cursorGapCount <= thresholds.cursorContinuityGapCount, cursorGapCount <= thresholds.cursorContinuityGapCount + 1, "api_polling_degraded", "cursor polling continuity gaps")
  ];
  const breached = metrics.filter((metric) => metric.state === "breach").map((metric) => metric.name);
  const watched = metrics.filter((metric) => metric.state === "watch").map((metric) => metric.name);
  const state: SchedulerRuntimeSlaState = breached.length > 0 ? "breach" : watched.length > 0 ? "watch" : "pass";
  const workerSafetyPlan = schedulerWorkerSafetyPlan(input.runtimeExecution, metrics);
  const decision: SchedulerRuntimeSlaDto["agent10ReleasePacket"]["decision"] = state === "breach"
    ? breached.some((metric) => metric === "dead_letter_growth" || metric === "retry_debt" || metric === "abandoned_client_cleanup") ? "rollback" : "hold"
    : state === "watch" || workerSafetyPlan.controls.length > 0 || workerSafetyPlan.recoveryActions.length > 0 ? "hold" : "pass";
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/frontier/status", "agent10_release_packet"],
    state,
    metrics,
    breached,
    watched,
    publicAnswerImpact: publicAnswerImpactFor(metrics),
    apiPollingImpact: apiPollingImpactFor(metrics),
    workerSafetyPlan,
    agent10ReleasePacket: {
      decision,
      fields: ["state", "metrics", "breached", "watched", "publicAnswerImpact", "apiPollingImpact", "workerSafetyPlan"],
      proofCommands: ["bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts", "bun run check:frontier-apply-plan"]
    }
  };
}

export function buildSchedulerSlaEnforcement(input: {
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  runtimeSla: SchedulerRuntimeSlaDto;
  runs?: CollectionRun[];
  now?: Date;
}): SchedulerSlaEnforcementDto {
  const now = input.now ?? new Date();
  const findings: SchedulerReleaseGateFinding[] = [];
  const metric = (name: SchedulerRuntimeSlaMetric["name"]) => input.runtimeSla.metrics.find((item) => item.name === name);
  const addMetricFinding = (
    reason: SchedulerReleaseGateReason,
    metricName: SchedulerRuntimeSlaMetric["name"],
    message: string,
    apiImpact: SchedulerReleaseGateFinding["apiImpact"]
  ) => {
    const item = metric(metricName);
    if (!item || item.state === "pass") return;
    findings.push({
      reason,
      severity: item.state === "breach" ? metricSeverity(metricName) : "warning",
      metric: item.name,
      value: item.value,
      threshold: item.threshold,
      message,
      apiImpact
    });
  };

  if (input.queueEconomics.totals.maxQueuedAgeSeconds > DEFAULT_SCHEDULER_EXECUTION_SLO.queueAgeP95Seconds * 2) {
    findings.push(releaseFinding("queue_age", "hold", input.queueEconomics.totals.maxQueuedAgeSeconds, DEFAULT_SCHEDULER_EXECUTION_SLO.queueAgeP95Seconds * 2, "queued live-search work is older than the release gate allows", "api_polling"));
  } else if (input.queueEconomics.totals.maxQueuedAgeSeconds > DEFAULT_SCHEDULER_EXECUTION_SLO.queueAgeP95Seconds) {
    findings.push(releaseFinding("queue_age", "warning", input.queueEconomics.totals.maxQueuedAgeSeconds, DEFAULT_SCHEDULER_EXECUTION_SLO.queueAgeP95Seconds, "queued live-search work is approaching the release gate", "api_polling"));
  }
  addMetricFinding("lease_age", "lease_latency", "leased work is not turning over fast enough for public polling", "api_polling");
  addMetricFinding("checkpoint_gap", "checkpoint_freshness", "checkpoint freshness is outside the cursor-safe polling window", "api_polling");
  addMetricFinding("retry_debt", "retry_debt", "retry debt requires worker safety review before promotion", "worker_safety");
  addMetricFinding("dead_letters", "dead_letter_growth", "dead-letter growth blocks scheduler promotion until reviewed", "release");
  addMetricFinding("abandoned_clients", "abandoned_client_cleanup", "abandoned active clients need cleanup before release", "worker_safety");
  addMetricFinding("duplicate_run_reuse", "run_reuse", "duplicate active runs are not being reused consistently", "public_answer");
  addMetricFinding("fairness_drift", "fairness", "scheduler fairness drift can starve public-channel or analyst work", "public_answer");
  addMetricFinding("source_sla_pressure", "source_sla_pressure", "one or more source work classes are under scheduler SLA pressure", "public_answer");
  addMetricFinding("cursor_discontinuity", "cursor_continuity", "cursor continuity is broken or waiting behind queued work", "api_polling");

  if (!input.queueEconomics.fairness.ok && !findings.some((item) => item.reason === "fairness_drift")) {
    findings.push(releaseFinding("fairness_drift", "hold", input.queueEconomics.fairness.worstShare, DEFAULT_SCHEDULER_EXECUTION_SLO.perSourceFairnessWorstShare, "worst source share exceeds scheduler fairness policy", "public_answer"));
  }
  const activeRuns = (input.runs ?? []).filter((run) => run.status === "queued" || run.status === "running");
  const duplicateRunGaps = activeRuns.filter((run) => !run.requestHash).length;
  if (duplicateRunGaps > 0 && !findings.some((item) => item.reason === "duplicate_run_reuse")) {
    findings.push(releaseFinding("duplicate_run_reuse", duplicateRunGaps > 2 ? "hold" : "warning", duplicateRunGaps, 0, "active runs without reuse keys can duplicate analyst workload", "public_answer"));
  }

  const holds = uniqueFindings(findings.filter((item) => item.severity === "hold" || item.severity === "rollback"));
  const warnings = uniqueFindings(findings.filter((item) => item.severity === "warning"));
  const hasRollback = input.runtimeSla.agent10ReleasePacket.decision === "rollback" || holds.some((item) => item.severity === "rollback");
  const state: SchedulerReleaseGateSeverity = hasRollback ? "rollback" : holds.length > 0 ? "hold" : warnings.length > 0 ? "warning" : "pass";
  const drainPlan = schedulerLiveRunDrainPlan({
    queueEconomics: input.queueEconomics,
    runtimeExecution: input.runtimeExecution,
    holds,
    warnings
  });
  const releaseDecision: SchedulerSlaEnforcementDto["releaseGate"]["decision"] = state === "rollback"
    ? "rollback"
    : state === "hold"
      ? "hold"
      : state === "warning" || drainPlan.steps.length > 0
        ? "promote_with_warnings"
        : "pass";
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/frontier/status", "agent10_release_packet"],
    state,
    holds,
    warnings,
    releaseGate: {
      decision: releaseDecision,
      dryRun: true,
      willMutate: false,
      publicAnswerImpact: input.runtimeSla.publicAnswerImpact,
      apiPollingImpact: input.runtimeSla.apiPollingImpact,
      proofCommand: "bun run check:frontier-apply-plan"
    },
    drainPlan,
    agent10ReleasePacket: {
      fields: ["state", "holds", "warnings", "releaseGate", "drainPlan", "publicAnswerImpact", "apiPollingImpact"],
      decision: releaseDecision === "rollback" ? "rollback" : releaseDecision === "hold" ? "hold" : "pass",
      proofCommands: ["bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts", "bun run check:frontier-apply-plan"]
    }
  };
}

export function buildSchedulerWorkerQueueCutover(input: {
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  runtimeSla: SchedulerRuntimeSlaDto;
  slaEnforcement: SchedulerSlaEnforcementDto;
  workerSlots?: number;
  memoryCeilingMb?: number;
  now?: Date;
}): SchedulerWorkerQueueCutoverDto {
  const now = input.now ?? new Date();
  const workerSlots = Math.max(1, input.workerSlots ?? 96);
  const memoryCeilingMb = Math.max(1, input.memoryCeilingMb ?? 96 * 1024);
  const workload24h = cutoverWorkloadFromRuntime(input.queueEconomics, input.runtimeExecution);
  const estimatedMemoryMb = Math.round(
    workerSlots * 384 +
    input.queueEconomics.totals.queued * 3 +
    input.queueEconomics.totals.leased * 18 +
    input.queueEconomics.totals.retryDebt * 12 +
    input.queueEconomics.totals.deadLetters * 24 +
    workload24h.expected24hTasks * 0.15
  );
  const reasons = uniqueReleaseReasons([
    ...input.slaEnforcement.holds.map((finding) => finding.reason),
    ...input.slaEnforcement.warnings.map((finding) => finding.reason),
    ...(estimatedMemoryMb > 160 * 1024 ? ["source_sla_pressure" as const] : [])
  ]);
  const decision: SchedulerWorkerQueueCutoverDto["releaseGate"]["decision"] = estimatedMemoryMb > 160 * 1024 || input.slaEnforcement.state === "rollback"
    ? "rollback"
    : estimatedMemoryMb > memoryCeilingMb || input.slaEnforcement.state === "hold" || input.slaEnforcement.state === "warning"
      ? "hold"
      : "pass";
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/frontier/status", "agent10_release_packet"],
    runtime: {
      engine: "bun_worker_runtime",
      dryRun: true,
      willMutate: false,
      contractFields: [
        "partitions",
        "leaseTtlSeconds",
        "checkpointEverySeconds",
        "ackMode",
        "retry",
        "deadLetter",
        "backpressurePolicy",
        "drainBehavior",
        "backendCutoverPackets"
      ]
    },
    semantics: {
      lease: "exclusive finite leases are acquired per partition after per-source concurrency, budget, and reuse-key checks",
      checkpoint: "workers emit cursor-visible checkpoints before partial capture, replay, graph, or metadata progress is hidden behind retries",
      acknowledgement: "acks are idempotent and only close a lease after capture/export/probe side effects are durably represented",
      retryBackoff: "transient failures use bounded deterministic exponential backoff with retry debt exposed in route DTOs",
      deadLetter: "exhausted tasks move to an operator-visible dead-letter lane with source backoff or policy review routing",
      runReuse: "active tenant/query/reuse keys attach new clients to existing runs before any work is enqueued",
      drain: "dry-run drain plans reserve live-search capacity first while preserving cursor replay and restricted metadata policy gates"
    },
    partitions: workerQueuePartitions(workerSlots, workload24h.expected24hTasks),
    capacityEnvelope: {
      normalMemoryTargetMb: 98_304,
      hardCeilingMb: 163_840,
      workerSlots,
      estimatedMemoryMb,
      normalTargetOk: estimatedMemoryMb <= 98_304,
      hardCeilingOk: estimatedMemoryMb <= 163_840,
      p95QueueAgeSeconds: input.queueEconomics.totals.maxQueuedAgeSeconds,
      p95LeaseAgeSeconds: input.runtimeSla.metrics.find((metric) => metric.name === "lease_latency")?.value ?? 0,
      expected24hTasks: workload24h.expected24hTasks
    },
    backendCutoverPackets: backendCutoverPackets(decision),
    releaseGate: {
      decision,
      reasons,
      proofCommands: ["bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts", "bun run check:frontier-apply-plan", "bun run check:route-inventory"]
    },
    agent10ReleasePacket: {
      fields: ["runtime", "semantics", "partitions", "capacityEnvelope", "backendCutoverPackets", "releaseGate"],
      decision,
      proofCommands: ["bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts", "bun run check", "bun run check:frontier-apply-plan", "bun run check:route-inventory"]
    }
  };
}

export function buildSchedulerWorkerSoakMigration(input: {
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  runtimeSla: SchedulerRuntimeSlaDto;
  slaEnforcement: SchedulerSlaEnforcementDto;
  workerQueueCutover: SchedulerWorkerQueueCutoverDto;
  now?: Date;
}): SchedulerWorkerSoakMigrationDto {
  const now = input.now ?? new Date();
  const retryDebtThreshold = Math.max(4, Math.ceil(input.workerQueueCutover.capacityEnvelope.expected24hTasks * 0.012));
  const deadLetterBudget = Math.max(1, Math.ceil(input.workerQueueCutover.capacityEnvelope.expected24hTasks * 0.002));
  const memoryPressure = clampRate(input.workerQueueCutover.capacityEnvelope.estimatedMemoryMb / input.workerQueueCutover.capacityEnvelope.normalMemoryTargetMb);
  const runReuseMetric = input.runtimeSla.metrics.find((metric) => metric.name === "run_reuse");
  const runReuseRatio = runReuseMetric?.value ?? 1;
  const duplicatePublicPollingRatio = clampRate(input.runtimeExecution.bySource.filter((row) => row.noisy).length / Math.max(1, input.runtimeExecution.bySource.length));
  const partitionSlo = input.workerQueueCutover.partitions.map((partition) => partitionSoakSlo(partition, {
    queueAgeP95Seconds: input.queueEconomics.totals.maxQueuedAgeSeconds,
    retryDebt: input.queueEconomics.totals.retryDebt,
    deadLetters: input.queueEconomics.totals.deadLetters,
    memoryPressure,
    runReuseRatio,
    duplicatePublicPollingRatio
  }));
  const aggregateState = aggregateSoakState(partitionSlo, input.slaEnforcement.state);
  const decision: SchedulerWorkerSoakMigrationDto["releaseTrain"]["decision"] = aggregateState === "rollback"
    ? "rollback"
    : aggregateState === "hold" || aggregateState === "watch"
      ? "hold"
      : "pass";
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/frontier/status", "/v1/contracts", "agent10_release_train"],
    durationHours: 24,
    dryRun: true,
    willMutate: false,
    partitionSlo,
    aggregate: {
      state: aggregateState,
      queueAgeP95Seconds: input.queueEconomics.totals.maxQueuedAgeSeconds,
      queueAgeP99Seconds: Math.round(input.queueEconomics.totals.maxQueuedAgeSeconds * 1.35),
      retryDebtThreshold,
      deadLetterBudget,
      memoryPressure,
      runReuseRatio,
      duplicatePublicPollingRatio
    },
    migrationPackets: migrationPacketsForSoak(aggregateState),
    routeContracts: {
      frontierStatusField: "scheduler.workerSoakMigration",
      searchSchedulerField: "scheduler.workerSoakMigration",
      runStatusField: "scheduler.workerSoakMigration",
      contractsField: "surfaces.frontier.contracts.worker_soak_migration"
    },
    releaseTrain: {
      decision,
      agent10Fields: ["durationHours", "partitionSlo", "aggregate", "migrationPackets", "routeContracts"],
      proofCommands: [
        "bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts",
        "bun run check",
        "bun run check:route-inventory",
        "bun run check:frontier-apply-plan",
        "bun run rehearse:cutover examples/cutover-rehearsal-pass.json"
      ]
    }
  };
}

export function buildSchedulerProductionAdapterTelemetry(input: {
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  runtimeSla: SchedulerRuntimeSlaDto;
  slaEnforcement: SchedulerSlaEnforcementDto;
  workerQueueCutover: SchedulerWorkerQueueCutoverDto;
  workerSoakMigration: SchedulerWorkerSoakMigrationDto;
  now?: Date;
}): SchedulerProductionAdapterTelemetryDto {
  const now = input.now ?? new Date();
  const runReuseRatio = input.runtimeSla.metrics.find((metric) => metric.name === "run_reuse")?.value ?? input.workerSoakMigration.aggregate.runReuseRatio;
  const duplicatePublicPollingRatio = input.workerSoakMigration.aggregate.duplicatePublicPollingRatio;
  const leaseThroughputPerMinute = Number((input.workerQueueCutover.capacityEnvelope.expected24hTasks / (24 * 60)).toFixed(2));
  const ackLatencyP95Ms = Math.round(input.queueEconomics.interactiveLatency.p95Ms * 0.65 + input.runtimeExecution.totals.retried * 20);
  const staleClients = input.runtimeSla.metrics.find((metric) => metric.name === "abandoned_client_cleanup")?.value ?? 0;
  const workerHeartbeats = Math.max(input.runtimeExecution.totals.leased, input.runtimeExecution.totals.checkpointed, input.workerQueueCutover.capacityEnvelope.workerSlots);
  const cancellations = input.runtimeExecution.totals.cancelled;
  const replayPreservation: SchedulerProductionAdapterTelemetryDto["telemetry"]["replayPreservation"] =
    input.workerSoakMigration.migrationPackets.every((packet) => packet.cursorContinuity === "preserved" && packet.replayPreservation === "required")
      ? "preserved"
      : "at_risk";
  const releaseDecision: SchedulerProductionAdapterTelemetryDto["agent10RcGate"]["decision"] =
    input.workerSoakMigration.releaseTrain.decision === "rollback" || input.slaEnforcement.state === "rollback"
      ? "rollback"
      : input.workerSoakMigration.releaseTrain.decision === "hold" || input.slaEnforcement.state === "hold"
        ? "hold"
        : "pass";
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/intel/search.scheduler", "/v1/frontier/status", "/v1/contracts", "agent09_warning_codes", "agent10_rc_gates"],
    dryRun: true,
    willMutate: false,
    adapterContracts: schedulerProductionAdapterContracts(),
    telemetry: {
      leaseThroughputPerMinute,
      ackLatencyP95Ms,
      retryDebt: input.queueEconomics.totals.retryDebt,
      deadLetterCauses: deadLetterCauseTelemetry(input.queueEconomics, input.runtimeExecution),
      queueAge: {
        p95Seconds: input.workerSoakMigration.aggregate.queueAgeP95Seconds,
        p99Seconds: input.workerSoakMigration.aggregate.queueAgeP99Seconds
      },
      cursorContinuity: input.runtimeExecution.pollingDeltas.cursorContinuity,
      replayPreservation,
      runReuseRatio,
      duplicatePublicPollingRatio,
      staleClients,
      workerHeartbeats,
      cancellations,
      drainProgress: drainProgressTelemetry(input.slaEnforcement)
    },
    soakFixtures: schedulerSoakTelemetryFixtures(input.workerQueueCutover),
    agent09WarningCodes: uniqueStrings([
      ...input.workerSoakMigration.migrationPackets.flatMap((packet) => packet.agent09WarningCodes),
      ...(input.queueEconomics.totals.retryDebt > 0 ? ["scheduler_retry_debt_watch"] : []),
      ...(input.queueEconomics.totals.deadLetters > 0 ? ["scheduler_dead_letter_watch"] : []),
      ...(input.runtimeExecution.pollingDeltas.cursorContinuity === "waiting_for_deltas" ? ["scheduler_cursor_waiting_for_deltas"] : [])
    ]),
    agent10RcGate: {
      decision: releaseDecision,
      fields: ["adapterContracts", "telemetry", "soakFixtures", "agent09WarningCodes", "drainProgress"],
      proofCommands: [
        "bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts",
        "bun run check",
        "bun run check:route-inventory",
        "bun run check:frontier-apply-plan",
        "bun run rehearse:cutover examples/cutover-rehearsal-pass.json",
        "bun run plan:cutover examples/cutover-rehearsal-pass.json"
      ]
    }
  };
}

export function buildSchedulerCanaryControlPlane(input: {
  productionAdapterTelemetry: SchedulerProductionAdapterTelemetryDto;
  queueEconomics: SchedulerQueueEconomicsDto;
  slaEnforcement: SchedulerSlaEnforcementDto;
  workerQueueCutover: SchedulerWorkerQueueCutoverDto;
  workerSoakMigration: SchedulerWorkerSoakMigrationDto;
  now?: Date;
}): SchedulerCanaryControlPlaneDto {
  const now = input.now ?? new Date();
  const controls = input.productionAdapterTelemetry.soakFixtures.flatMap((fixture) => canaryControlStepsForFixture(fixture, input));
  const warningCodes = uniqueStrings([
    ...input.productionAdapterTelemetry.agent09WarningCodes,
    ...controls.flatMap((control) => control.warningCodes),
    ...(input.workerQueueCutover.capacityEnvelope.normalTargetOk ? [] : ["scheduler_canary_memory_target_watch"]),
    ...(input.workerQueueCutover.capacityEnvelope.hardCeilingOk ? [] : ["scheduler_canary_memory_ceiling_hold"]),
    ...(input.workerSoakMigration.aggregate.state === "hold" ? ["scheduler_canary_soak_hold"] : []),
    ...(input.workerSoakMigration.aggregate.state === "rollback" ? ["scheduler_canary_soak_rollback"] : [])
  ]);
  const decision: SchedulerCanaryControlPlaneDto["agent10ReleaseDecision"]["decision"] =
    input.productionAdapterTelemetry.agent10RcGate.decision === "rollback" || input.workerSoakMigration.aggregate.state === "rollback"
      ? "rollback"
      : input.productionAdapterTelemetry.agent10RcGate.decision === "hold" || input.workerSoakMigration.aggregate.state === "hold" || warningCodes.some((code) => code.endsWith("_hold"))
        ? "hold"
        : warningCodes.length > 0 || input.workerSoakMigration.aggregate.state === "watch"
          ? "canary-with-warnings"
          : "canary-ready";
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/search.scheduler", "/v1/contracts", "agent09_public_cutover_semantics", "agent10_release_decisions"],
    dryRun: true,
    willMutate: false,
    controls,
    headroom: {
      memoryTargetMb: input.workerQueueCutover.capacityEnvelope.normalMemoryTargetMb,
      memoryCeilingMb: input.workerQueueCutover.capacityEnvelope.hardCeilingMb,
      estimatedMemoryMb: input.workerQueueCutover.capacityEnvelope.estimatedMemoryMb,
      memoryHeadroomMb: Math.max(0, input.workerQueueCutover.capacityEnvelope.hardCeilingMb - input.workerQueueCutover.capacityEnvelope.estimatedMemoryMb),
      queueHeadroomTasks: Math.max(0, input.workerQueueCutover.capacityEnvelope.expected24hTasks - input.queueEconomics.totals.queued),
      p95QueueAgeSeconds: input.workerSoakMigration.aggregate.queueAgeP95Seconds,
      p99QueueAgeSeconds: input.workerSoakMigration.aggregate.queueAgeP99Seconds,
      queueAgeWithinCanaryLimit: input.workerSoakMigration.aggregate.queueAgeP99Seconds <= Math.max(...input.workerQueueCutover.partitions.map((partition) => partition.maxQueueAgeSeconds))
    },
    warningCodes,
    routeContracts: {
      frontierStatusField: "scheduler.canaryControlPlane",
      frontierApplyPlanField: "applyPlan.canaryControlPlane",
      searchSchedulerField: "scheduler.canaryControlPlane",
      contractsField: "surfaces.frontier.contracts.scheduler_canary_control_plane"
    },
    agent10ReleaseDecision: {
      decision,
      fields: ["controls", "headroom", "warningCodes", "routeContracts", "dryRun", "willMutate"],
      proofCommands: [
        "bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts",
        "bun run check",
        "bun run check:route-inventory",
        "bun run check:frontier-apply-plan",
        "bun run rehearse:cutover examples/cutover-rehearsal-pass.json",
        "bun run plan:cutover examples/cutover-rehearsal-pass.json"
      ]
    }
  };
}

export function schedulerSoakBackpressurePacket(simulation: SchedulerExecutionSimulationResult) {
  return simulation.backpressure.agent10SoakPacket;
}

function metricSeverity(metric: SchedulerRuntimeSlaMetric["name"]): Exclude<SchedulerReleaseGateSeverity, "pass"> {
  return metric === "dead_letter_growth" || metric === "retry_debt" || metric === "abandoned_client_cleanup" ? "rollback" : "hold";
}

function schedulerProductionAdapterContracts(): SchedulerProductionAdapterContract[] {
  const methods: SchedulerProductionAdapterContract["methods"] = ["enqueue", "lease", "checkpoint", "acknowledge", "retry", "dead_letter", "heartbeat", "cancel", "drain"];
  const telemetryFields = [
    "leaseThroughputPerMinute",
    "ackLatencyP95Ms",
    "retryDebt",
    "deadLetterCauses",
    "queueAge.p95Seconds",
    "queueAge.p99Seconds",
    "cursorContinuity",
    "replayPreservation",
    "runReuseRatio",
    "duplicatePublicPollingRatio",
    "staleClients",
    "workerHeartbeats",
    "cancellations",
    "drainProgress"
  ];
  const invariants = [
    "API DTO contracts remain identical across embedded, Postgres, Redis, and NATS backends",
    "checkpoint and replay cursors are emitted before acknowledgement or redelivery",
    "leases are exclusive and finite for every worker partition",
    "dead-letter causes are route-visible without exposing raw evidence or restricted payloads",
    "drain operations remain dry-run until an explicit future apply path is approved"
  ];
  return [
    { implementation: "embedded_memory", mode: "active", methods, invariants, telemetryFields },
    { implementation: "postgres_advisory_queue", mode: "candidate", methods, invariants, telemetryFields },
    { implementation: "redis_streams", mode: "candidate", methods, invariants, telemetryFields },
    { implementation: "nats_jetstream", mode: "candidate", methods, invariants, telemetryFields }
  ];
}

function canaryControlStepsForFixture(
  fixture: SchedulerSoakTelemetryFixture,
  input: {
    productionAdapterTelemetry: SchedulerProductionAdapterTelemetryDto;
    queueEconomics: SchedulerQueueEconomicsDto;
    slaEnforcement: SchedulerSlaEnforcementDto;
    workerQueueCutover: SchedulerWorkerQueueCutoverDto;
    workerSoakMigration: SchedulerWorkerSoakMigrationDto;
  }
): SchedulerCanaryControlPlaneStep[] {
  const primary = primaryPartitionForScenario(fixture.scenario, input.workerQueueCutover.partitions);
  const warnings = warningCodesForCanaryFixture(fixture, input);
  const startOrPause: SchedulerCanaryControlAction =
    input.workerSoakMigration.aggregate.state === "rollback"
      ? "rollback"
      : "start";
  const base = canaryControlStep({
    fixture,
    action: startOrPause,
    partition: primary,
    warningCodes: warnings,
    queuedVisibleDelta: startOrPause === "start" ? fixture.expected24hTasks : 0,
    leasedDelta: startOrPause === "start" ? Math.min(primary.maxConcurrentLeases, Math.ceil(fixture.expectedLeaseThroughputPerMinute)) : 0
  });
  const drain = fixture.safeDrainControls.map((control, index) => canaryControlStep({
    fixture,
    action: control === "hold_source_activation_wave" || control === "hold_restricted_metadata" ? "pause" : "drain",
    partition: primary,
    warningCodes: uniqueStrings([...warnings, `scheduler_canary_${control}`]),
    queuedVisibleDelta: -Math.min(fixture.expected24hTasks, primary.maxConcurrentLeases * (index + 1)),
    leasedDelta: -Math.min(primary.maxConcurrentLeases, Math.ceil(fixture.expectedLeaseThroughputPerMinute))
  }));
  const rollback = canaryControlStep({
    fixture,
    action: "rollback",
    partition: primary,
    warningCodes: uniqueStrings([...warnings, "scheduler_canary_rollback_path_ready"]),
    queuedVisibleDelta: -fixture.expected24hTasks,
    leasedDelta: -Math.min(primary.maxConcurrentLeases, Math.ceil(fixture.expectedLeaseThroughputPerMinute))
  });
  const expand = canaryControlStep({
    fixture,
    action: "expand",
    partition: primary,
    warningCodes: warnings,
    queuedVisibleDelta: Math.ceil(fixture.expected24hTasks * 0.5),
    leasedDelta: Math.min(primary.maxConcurrentLeases, Math.ceil(fixture.expectedLeaseThroughputPerMinute * 1.25))
  });
  return [base, ...drain, rollback, expand];
}

function canaryControlStep(input: {
  fixture: SchedulerSoakTelemetryFixture;
  action: SchedulerCanaryControlAction;
  partition: SchedulerWorkerQueuePartition;
  warningCodes: string[];
  queuedVisibleDelta: number;
  leasedDelta: number;
}): SchedulerCanaryControlPlaneStep {
  const id = stableId("scheduler-canary-control", `${input.fixture.scenario}:${input.action}:${input.partition.id}:${input.queuedVisibleDelta}:${input.leasedDelta}`);
  return {
    id,
    scenario: input.fixture.scenario,
    action: input.action,
    dryRun: true,
    willMutate: false,
    preconditions: [
      "production adapter telemetry is route-visible",
      "frontier apply-plan remains dry-run-only",
      "cursor and replay state are preserved before any future mutation path",
      "Agent 10 release board consumes this packet before operator signoff"
    ],
    expectedQueueDelta: {
      queuedVisibleDelta: input.queuedVisibleDelta,
      leasedDelta: input.leasedDelta,
      retryDebtDelta: input.action === "rollback" ? -input.fixture.expectedRetryDebtMax : 0,
      deadLetterDelta: input.action === "rollback" ? -input.fixture.expectedDeadLetterBudget : 0
    },
    workerPartitionEffects: [{
      partitionId: input.partition.id,
      workload: input.partition.workload,
      reservedWorkerSlotDelta: input.action === "expand" ? 1 : input.action === "pause" || input.action === "rollback" ? -1 : 0,
      maxConcurrentLeaseDelta: input.leasedDelta,
      expectedMemoryMbDelta: Math.round(input.partition.memoryBudgetMb * (input.action === "expand" ? 0.35 : input.action === "start" ? 0.15 : -0.15))
    }],
    cursorReplayGuarantee: {
      cursorContinuity: "preserved",
      replayPreservation: "preserved"
    },
    rollbackSteps: [
      "pause canary partition leasing",
      "preserve latest checkpoint cursor",
      "drain visible queued canary work through dry-run apply-plan first",
      "return public /ti polling to existing stable scheduler path"
    ],
    warningCodes: input.warningCodes
  };
}

function primaryPartitionForScenario(
  scenario: SchedulerSoakTelemetryScenario,
  partitions: SchedulerWorkerQueuePartition[]
): SchedulerWorkerQueuePartition {
  const workloadByScenario: Record<SchedulerSoakTelemetryScenario, SchedulerWorkerWorkload> = {
    source_canary_rollout: "scheduled_source_sweep",
    public_channel_canary: "public_channel_window",
    restricted_certification: "restricted_metadata_approval",
    evidence_replay: "evidence_replay",
    graph_export: "graph_export",
    public_ti_traffic: "interactive_actor_search"
  };
  return partitions.find((partition) => partition.workload === workloadByScenario[scenario]) ?? partitions[0]!;
}

function warningCodesForCanaryFixture(
  fixture: SchedulerSoakTelemetryFixture,
  input: {
    productionAdapterTelemetry: SchedulerProductionAdapterTelemetryDto;
    queueEconomics: SchedulerQueueEconomicsDto;
    slaEnforcement: SchedulerSlaEnforcementDto;
    workerSoakMigration: SchedulerWorkerSoakMigrationDto;
  }
): string[] {
  return uniqueStrings([
    ...input.productionAdapterTelemetry.agent09WarningCodes,
    ...(input.queueEconomics.totals.retryDebt > fixture.expectedRetryDebtMax ? ["scheduler_canary_retry_debt_hold"] : []),
    ...(input.queueEconomics.totals.deadLetters > fixture.expectedDeadLetterBudget ? ["scheduler_canary_dead_letter_hold"] : []),
    ...(input.workerSoakMigration.aggregate.queueAgeP99Seconds > fixture.expected24hTasks ? ["scheduler_canary_queue_age_watch"] : []),
    ...(input.slaEnforcement.state === "hold" ? ["scheduler_canary_sla_hold"] : []),
    ...(input.slaEnforcement.state === "rollback" ? ["scheduler_canary_sla_rollback_hold"] : [])
  ]);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

function deadLetterCauseTelemetry(
  economics: SchedulerQueueEconomicsDto,
  runtime: SchedulerRuntimeExecutionDto
): SchedulerDeadLetterCauseTelemetry[] {
  const total = economics.totals.deadLetters + runtime.totals.deadLettered;
  const retryCount = Math.max(0, Math.min(total, economics.totals.retryDebt + runtime.totals.retried));
  const providerCount = Math.max(0, total - retryCount);
  const causes: SchedulerDeadLetterCauseTelemetry[] = [
    deadLetterCause("retry_exhausted", retryCount, retryCount > 8 ? "hold" : retryCount > 0 ? "warning" : "none"),
    deadLetterCause("provider_failure", providerCount, providerCount > 8 ? "hold" : providerCount > 0 ? "warning" : "none"),
    deadLetterCause("policy_block", runtime.totals.cancelled, runtime.totals.cancelled > 0 ? "warning" : "none"),
    deadLetterCause("deadline_expired", runtime.totals.staleRecovered, runtime.totals.staleRecovered > 0 ? "warning" : "none"),
    deadLetterCause("adapter_error", Math.max(0, total - retryCount - providerCount), "none")
  ];
  return causes.filter((cause) => cause.count > 0 || cause.cause === "retry_exhausted" || cause.cause === "provider_failure");
}

function deadLetterCause(
  cause: SchedulerDeadLetterCauseTelemetry["cause"],
  count: number,
  releaseImpact: SchedulerDeadLetterCauseTelemetry["releaseImpact"]
): SchedulerDeadLetterCauseTelemetry {
  return { cause, count, releaseImpact };
}

function drainProgressTelemetry(enforcement: SchedulerSlaEnforcementDto): SchedulerProductionAdapterTelemetryDto["telemetry"]["drainProgress"] {
  const planned = enforcement.drainPlan.steps.map((step) => ({
    action: step.action,
    state: step.approval === "blocked" ? "blocked" as const : "planned" as const,
    estimatedTaskDelta: step.estimatedTaskDelta
  }));
  if (planned.length > 0) return planned;
  return [
    { action: "drain_overloaded_live_search", state: "not_needed", estimatedTaskDelta: 0 },
    { action: "preserve_cursor_replay", state: "not_needed", estimatedTaskDelta: 0 }
  ];
}

function schedulerSoakTelemetryFixtures(cutover: SchedulerWorkerQueueCutoverDto): SchedulerSoakTelemetryFixture[] {
  const expected24hTasks = cutover.capacityEnvelope.expected24hTasks;
  const fixture = (
    scenario: SchedulerSoakTelemetryScenario,
    share: number,
    controls: SchedulerLiveRunDrainAction[]
  ): SchedulerSoakTelemetryFixture => ({
    scenario,
    expected24hTasks: Math.max(1, Math.round(expected24hTasks * share)),
    expectedLeaseThroughputPerMinute: Number((Math.max(1, expected24hTasks * share) / (24 * 60)).toFixed(2)),
    expectedAckLatencyP95Ms: Math.round(450 + share * 2_500),
    expectedRetryDebtMax: Math.max(1, Math.ceil(expected24hTasks * share * 0.012)),
    expectedDeadLetterBudget: Math.max(1, Math.ceil(expected24hTasks * share * 0.002)),
    requiredTelemetry: ["leaseThroughputPerMinute", "ackLatencyP95Ms", "retryDebt", "deadLetterCauses", "queueAge", "cursorContinuity", "drainProgress"],
    safeDrainControls: controls
  });
  return [
    fixture("source_canary_rollout", 0.14, ["hold_source_activation_wave"]),
    fixture("public_channel_canary", 0.18, ["drain_public_channel_backlog", "preserve_cursor_replay"]),
    fixture("restricted_certification", 0.08, ["hold_restricted_metadata"]),
    fixture("evidence_replay", 0.16, ["drain_evidence_replay_load", "preserve_cursor_replay"]),
    fixture("graph_export", 0.1, ["drain_graph_export_backlog"]),
    fixture("public_ti_traffic", 0.34, ["drain_overloaded_live_search", "recover_stale_leases", "preserve_cursor_replay"])
  ];
}

function partitionSoakSlo(
  partition: SchedulerWorkerQueuePartition,
  aggregate: {
    queueAgeP95Seconds: number;
    retryDebt: number;
    deadLetters: number;
    memoryPressure: number;
    runReuseRatio: number;
    duplicatePublicPollingRatio: number;
  }
): SchedulerWorkerPartitionSoakSlo {
  const queueAgeP95Seconds = Math.min(partition.maxQueueAgeSeconds * 2, Math.max(0, aggregate.queueAgeP95Seconds));
  const queueAgeP99Seconds = Math.round(queueAgeP95Seconds * 1.35);
  const retryDebtThreshold = Math.max(1, Math.ceil(partition.maxConcurrentLeases * 0.4));
  const deadLetterBudget = Math.max(1, Math.ceil(partition.maxConcurrentLeases * 0.06));
  const maxQueueOk = queueAgeP95Seconds <= partition.maxQueueAgeSeconds && queueAgeP99Seconds <= partition.maxQueueAgeSeconds * 1.5;
  const retryOk = aggregate.retryDebt <= retryDebtThreshold;
  const deadLetterOk = aggregate.deadLetters <= deadLetterBudget;
  const memoryOk = aggregate.memoryPressure <= 0.82;
  const reuseOk = aggregate.runReuseRatio >= 0.72;
  const duplicateOk = partition.workload !== "public_channel_window" || aggregate.duplicatePublicPollingRatio <= 0.2;
  const state: SchedulerWorkerPartitionSoakSlo["state"] = !memoryOk || aggregate.memoryPressure > 1 || aggregate.deadLetters > deadLetterBudget * 4
    ? "rollback"
    : !maxQueueOk || !retryOk || !deadLetterOk
      ? "hold"
      : !reuseOk || !duplicateOk || aggregate.memoryPressure > 0.72
        ? "watch"
        : "pass";
  return {
    partitionId: partition.id,
    workload: partition.workload,
    queueAgeP95Seconds,
    queueAgeP99Seconds,
    leaseAgeP95Seconds: Math.round(partition.leaseTtlSeconds * 0.65),
    checkpointCadenceSeconds: partition.checkpointEverySeconds,
    retryDebtThreshold,
    deadLetterBudget,
    memoryPressureMax: 0.82,
    runReuseMinRatio: 0.72,
    duplicatePublicPollingMaxRatio: partition.workload === "public_channel_window" ? 0.2 : 0.35,
    safeDrainControls: [partition.drainBehavior, ...(partition.workload === "interactive_actor_search" ? ["preserve_cursor_replay" as const] : [])],
    state
  };
}

function aggregateSoakState(
  partitionSlo: SchedulerWorkerPartitionSoakSlo[],
  enforcementState: SchedulerReleaseGateSeverity
): SchedulerWorkerSoakMigrationDto["aggregate"]["state"] {
  if (enforcementState === "rollback" || partitionSlo.some((partition) => partition.state === "rollback")) return "rollback";
  if (enforcementState === "hold" || partitionSlo.some((partition) => partition.state === "hold")) return "hold";
  if (enforcementState === "warning" || partitionSlo.some((partition) => partition.state === "watch")) return "watch";
  return "pass";
}

function migrationPacketsForSoak(state: SchedulerWorkerSoakMigrationDto["aggregate"]["state"]): SchedulerBackendMigrationPacket[] {
  const readiness: SchedulerBackendMigrationPacket["readiness"] = state === "rollback" ? "blocked" : state === "hold" || state === "watch" ? "hold_for_operator" : "ready_for_rehearsal";
  const sharedPrerequisites = [
    "24h partition soak packet is green or explicitly accepted by release train",
    "cursor continuity proof passes for /v1/intel/runs/{id} polling",
    "frontier apply-plan dry-run proves queue, lease, and run snapshots unchanged",
    "route inventory exposes scheduler.workerSoakMigration without raw evidence leaks"
  ];
  return [
    migrationPacket("embedded_to_postgres", "postgres_advisory_queue", readiness, [
      ...sharedPrerequisites,
      "frontier_tasks, frontier_leases, frontier_events, and run_reuse_keys migrations are applied",
      "transactional outbox replay has caught up to the embedded queue cursor"
    ], "disable Postgres leasing, replay frontier_events from last embedded cursor, and leave embedded queue authoritative", ["scheduler_migration_postgres_shadow", "scheduler_cursor_replay_required"]),
    migrationPacket("embedded_to_redis", "redis_streams", readiness, [
      ...sharedPrerequisites,
      "Redis consumer groups and dedupe TTL keys exist for every worker partition",
      "durable frontier_events mirror is ahead of Redis stream acknowledgements"
    ], "pause Redis consumers, drain pending entries back through frontier_events, and resume embedded queue leasing", ["scheduler_migration_redis_shadow", "scheduler_stream_pending_review"]),
    migrationPacket("embedded_to_nats", "nats_jetstream", readiness, [
      ...sharedPrerequisites,
      "JetStream durable consumers exist with ack wait and max delivery per partition",
      "ordered event mirror preserves checkpoint and replay events before message ack"
    ], "pause durable consumers, replay ordered event mirror into embedded queue, and clear unacked delivery state", ["scheduler_migration_nats_shadow", "scheduler_ack_wait_review"])
  ];
}

function migrationPacket(
  id: SchedulerBackendMigrationPacket["id"],
  targetBackend: SchedulerQueueBackendCandidate,
  readiness: SchedulerBackendMigrationPacket["readiness"],
  prerequisites: string[],
  rollback: string,
  agent09WarningCodes: string[]
): SchedulerBackendMigrationPacket {
  return {
    id,
    targetBackend,
    dryRun: true,
    willMutate: false,
    prerequisites,
    cursorContinuity: "preserved",
    replayPreservation: "required",
    agent09WarningCodes,
    rollback,
    readiness
  };
}

function cutoverWorkloadFromRuntime(
  economics: SchedulerQueueEconomicsDto,
  runtime: SchedulerRuntimeExecutionDto
): { expected24hTasks: number } {
  const queued = economics.totals.queued + economics.totals.leased;
  const runtimeEvents = runtime.totals.checkpointed + runtime.totals.retried + runtime.totals.acknowledged + runtime.totals.cancelled + runtime.totals.staleRecovered;
  const expected24hTasks = Math.max(queued * 96, runtimeEvents * 288, economics.totals.retryDebt * 72, 1_000);
  return { expected24hTasks };
}

function workerQueuePartitions(workerSlots: number, expected24hTasks: number): SchedulerWorkerQueuePartition[] {
  const reserve = (share: number) => Math.max(1, Math.round(workerSlots * share));
  const scaleMemory = (base: number, share: number) => Math.round(base + expected24hTasks * share * 0.02);
  return [
    workerQueuePartition("interactive-actor-search", "interactive_actor_search", ["interactive_live_search", "interactive_search", "analyst_deep_dive"], reserve(0.34), 90, 300, "idempotent_after_capture", 30, 300, 3, "operator_review", "reserve_interactive_capacity", "drain_overloaded_live_search", scaleMemory(18_432, 0.34)),
    workerQueuePartition("scheduled-source-sweep", "scheduled_source_sweep", ["broad_daily_sweep", "background_refresh"], reserve(0.16), 900, 600, "idempotent_after_capture", 60, 900, 4, "source_backoff", "defer_background", "drain_graph_export_backlog", scaleMemory(10_240, 0.16)),
    workerQueuePartition("public-channel-window", "public_channel_window", ["interactive_live_search", "broad_daily_sweep"], reserve(0.14), 180, 300, "idempotent_after_capture", 45, 900, 3, "source_backoff", "throttle_public_windows", "drain_public_channel_backlog", scaleMemory(12_288, 0.14)),
    workerQueuePartition("restricted-metadata-approval", "restricted_metadata_approval", ["restricted_darknet_metadata_sweep"], reserve(0.08), 900, 900, "idempotent_metadata_only", 120, 1_800, 2, "policy_review", "hold_approval_queue", "hold_restricted_metadata", scaleMemory(6_144, 0.08)),
    workerQueuePartition("evidence-replay", "evidence_replay", ["replay_retention", "background_refresh"], reserve(0.09), 600, 900, "idempotent_after_capture", 60, 1_200, 4, "replay_hold", "defer_background", "drain_evidence_replay_load", scaleMemory(8_192, 0.09)),
    workerQueuePartition("graph-export", "graph_export", ["background_refresh"], reserve(0.07), 900, 900, "idempotent_after_export", 120, 1_800, 3, "operator_review", "defer_background", "drain_graph_export_backlog", scaleMemory(7_168, 0.07)),
    workerQueuePartition("retention", "retention", ["replay_retention", "background_refresh"], reserve(0.06), 1_800, 1_200, "idempotent_after_capture", 300, 3_600, 2, "replay_hold", "shed_if_stale", "drain_evidence_replay_load", scaleMemory(5_120, 0.06)),
    workerQueuePartition("health-probe", "health_probe", ["source_health_probe"], reserve(0.06), 300, 300, "idempotent_after_probe", 60, 900, 3, "source_backoff", "defer_background", "hold_source_activation_wave", scaleMemory(4_096, 0.06))
  ];
}

function workerQueuePartition(
  id: string,
  workload: SchedulerWorkerWorkload,
  workClasses: SchedulerWorkClass[],
  reservedWorkerSlots: number,
  maxQueueAgeSeconds: number,
  leaseTtlSeconds: number,
  ackMode: SchedulerWorkerQueuePartition["ackMode"],
  retryBaseSeconds: number,
  retryMaxSeconds: number,
  maxAttempts: number,
  deadLetterRoute: SchedulerWorkerQueuePartition["deadLetter"]["routeTo"],
  backpressurePolicy: SchedulerWorkerQueuePartition["backpressurePolicy"],
  drainBehavior: SchedulerLiveRunDrainAction,
  memoryBudgetMb: number
): SchedulerWorkerQueuePartition {
  return {
    id,
    workload,
    workClasses,
    reservedWorkerSlots,
    maxConcurrentLeases: Math.max(1, reservedWorkerSlots * 2),
    maxQueueAgeSeconds,
    leaseTtlSeconds,
    checkpointEverySeconds: Math.max(15, Math.round(leaseTtlSeconds / 3)),
    ackMode,
    retry: {
      baseSeconds: retryBaseSeconds,
      maxSeconds: retryMaxSeconds,
      maxAttempts,
      jitter: "deterministic"
    },
    deadLetter: {
      afterAttempts: maxAttempts + 1,
      routeTo: deadLetterRoute
    },
    backpressurePolicy,
    drainBehavior,
    memoryBudgetMb
  };
}

function backendCutoverPackets(decision: SchedulerWorkerQueueCutoverDto["releaseGate"]["decision"]): SchedulerBackendCutoverPacket[] {
  const readiness: SchedulerBackendCutoverPacket["readiness"] = decision === "rollback" ? "blocked" : decision === "hold" ? "hold_for_operator" : "ready_for_rehearsal";
  return [
    {
      backend: "postgres_advisory_queue",
      dryRun: true,
      willMutate: false,
      readiness,
      requiredPrimitives: ["FOR UPDATE SKIP LOCKED", "advisory locks", "transactional outbox", "unique reuse-key index"],
      transactionModel: "single SQL transaction owns selection, lease insert, budget reservation, and event append",
      leaseModel: "frontier_leases rows expire by lease_expires_at and are recovered before each selection pass",
      checkpointModel: "frontier_events stores checkpoint cursors and promoted evidence counts before acknowledgement",
      deadLetterModel: "retry-exhausted rows move to frontier_dead_letters with source backoff evidence",
      rollback: "keep embedded queue active and replay frontier_events into Postgres shadow tables"
    },
    {
      backend: "redis_streams",
      dryRun: true,
      willMutate: false,
      readiness,
      requiredPrimitives: ["consumer groups", "pending entry list", "Lua compare-and-set", "dedupe keys with TTL"],
      transactionModel: "Lua script reserves budget and moves a stream entry into an owned pending lease atomically",
      leaseModel: "pending entries are claimed after idle timeout while checkpoint cursors remain in hash state",
      checkpointModel: "worker checkpoint hashes are mirrored to durable event storage before acking stream entries",
      deadLetterModel: "max-delivery entries are copied to dead-letter streams and source backoff keys",
      rollback: "stop stream consumers and continue from durable frontier_events cursor in embedded/Postgres mode"
    },
    {
      backend: "nats_jetstream",
      dryRun: true,
      willMutate: false,
      readiness,
      requiredPrimitives: ["durable consumers", "ack wait", "max deliveries", "ordered event mirror"],
      transactionModel: "message ack is delayed until an external durable event append confirms task state",
      leaseModel: "ack wait and redelivery model leases; worker heartbeat extends visibility through progress events",
      checkpointModel: "checkpoint events are published to the event mirror before message ack or nak",
      deadLetterModel: "max-delivery advisories route to operator-visible dead-letter subjects",
      rollback: "pause durable consumers and replay from the ordered event mirror into the active scheduler"
    }
  ];
}

function uniqueReleaseReasons(reasons: SchedulerReleaseGateReason[]): SchedulerReleaseGateReason[] {
  return [...new Set(reasons)].sort();
}

function releaseFinding(
  reason: SchedulerReleaseGateReason,
  severity: Exclude<SchedulerReleaseGateSeverity, "pass">,
  value: number,
  threshold: number,
  message: string,
  apiImpact: SchedulerReleaseGateFinding["apiImpact"]
): SchedulerReleaseGateFinding {
  return {
    reason,
    severity,
    value: Number.isFinite(value) ? Number(value.toFixed(3)) : 0,
    threshold,
    message,
    apiImpact
  };
}

function uniqueFindings(findings: SchedulerReleaseGateFinding[]): SchedulerReleaseGateFinding[] {
  const seen = new Set<string>();
  const out: SchedulerReleaseGateFinding[] = [];
  for (const finding of findings) {
    const key = `${finding.reason}:${finding.severity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(finding);
  }
  return out.sort((a, b) => releaseSeverityRank(b.severity) - releaseSeverityRank(a.severity) || a.reason.localeCompare(b.reason));
}

function releaseSeverityRank(severity: SchedulerReleaseGateSeverity): number {
  if (severity === "rollback") return 3;
  if (severity === "hold") return 2;
  if (severity === "warning") return 1;
  return 0;
}

function schedulerLiveRunDrainPlan(input: {
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  holds: SchedulerReleaseGateFinding[];
  warnings: SchedulerReleaseGateFinding[];
}): SchedulerSlaEnforcementDto["drainPlan"] {
  const findings = [...input.holds, ...input.warnings];
  const has = (reason: SchedulerReleaseGateReason) => findings.some((finding) => finding.reason === reason);
  const steps: SchedulerLiveRunDrainStep[] = [];
  const add = (action: SchedulerLiveRunDrainAction, reason: SchedulerReleaseGateReason, workClasses: SchedulerWorkClass[], approval: SchedulerApplyApproval, message: string) => {
    const sourceIds = sourceIdsForWorkClasses(input.runtimeExecution, workClasses);
    const runIds = runIdsForWorkClasses(input.runtimeExecution, workClasses);
    const estimatedTaskDelta = input.runtimeExecution.byWorkClass
      .filter((row) => workClasses.includes(row.workClass))
      .reduce((sum, row) => sum + row.queued + row.leased + row.retried + row.deadLettered, 0);
    steps.push({
      id: stableId("scheduler-live-drain", `${action}:${reason}:${workClasses.join(",")}:${steps.length}`),
      action,
      severity: findings.find((finding) => finding.reason === reason)?.severity ?? "warning",
      reason,
      sourceIds,
      workClasses,
      runIds,
      estimatedTaskDelta,
      dryRun: true,
      willMutate: false,
      approval,
      preconditions: [
        message,
        "dry run only; no queue leases, acknowledgements, or run transitions are applied",
        "cursor replay state remains visible through /v1/intel/runs/{id} and /v1/frontier/status"
      ],
      rollback: "drop this dry-run drain step and rerun scheduler SLA enforcement proof"
    });
  };

  if (has("queue_age") || has("lease_age") || has("retry_debt")) {
    add("drain_overloaded_live_search", has("retry_debt") ? "retry_debt" : "queue_age", ["interactive_live_search", "interactive_search"], "human_approval_required", "reserve live-search capacity and defer noninteractive work before promotion");
  }
  if (has("fairness_drift") || input.runtimeExecution.dryRunControls.controls.some((control) => control.action === "reduce_public_channel_windows")) {
    add("drain_public_channel_backlog", "fairness_drift", ["broad_daily_sweep", "interactive_live_search"], "human_approval_required", "reduce public-channel windows until noisy-source share is back under the fairness gate");
  }
  if (input.runtimeExecution.dryRunControls.controls.some((control) => control.action === "hold_restricted_metadata")) {
    add("hold_restricted_metadata", "source_sla_pressure", ["restricted_darknet_metadata_sweep"], "blocked", "hold approved darknet metadata sweeps while restricted policy or kill-switch pressure is active");
  }
  if (has("queue_age") || input.runtimeExecution.byWorkClass.some((row) => row.workClass === "background_refresh" && row.maxQueuedAgeSeconds > DEFAULT_SCHEDULER_EXECUTION_SLO.queueAgeP95Seconds)) {
    add("drain_graph_export_backlog", "queue_age", ["background_refresh"], "human_approval_required", "move graph export backlog behind live-search and cursor replay recovery");
  }
  if (has("checkpoint_gap") || has("cursor_discontinuity") || input.runtimeExecution.byWorkClass.some((row) => row.workClass === "replay_retention")) {
    add("drain_evidence_replay_load", has("cursor_discontinuity") ? "cursor_discontinuity" : "checkpoint_gap", ["replay_retention"], "automation_safe", "preserve replay retention and evidence cursor continuity before promotion");
  }
  if (input.runtimeExecution.sourceActivationBudgetGuard.state !== "within_budget" || input.runtimeExecution.dryRunControls.controls.some((control) => control.action === "hold_source_activation_batches")) {
    add("hold_source_activation_wave", "source_sla_pressure", ["source_health_probe", "broad_daily_sweep"], "human_approval_required", "hold source activation waves until scheduler budget guard returns within budget");
  }
  if (has("lease_age") || input.runtimeExecution.totals.staleRecovered > 0) {
    add("recover_stale_leases", "lease_age", input.runtimeExecution.byWorkClass.map((row) => row.workClass), "automation_safe", "recover stale leases without changing completed acknowledgements");
  }
  if (has("cursor_discontinuity") || has("checkpoint_gap")) {
    add("preserve_cursor_replay", has("cursor_discontinuity") ? "cursor_discontinuity" : "checkpoint_gap", ["replay_retention", "background_refresh"], "automation_safe", "preserve cursor replay before draining or throttling queued work");
  }

  return {
    dryRun: true,
    willMutate: false,
    steps: uniqueDrainSteps(steps)
  };
}

function uniqueDrainSteps(steps: SchedulerLiveRunDrainStep[]): SchedulerLiveRunDrainStep[] {
  const seen = new Set<string>();
  const out: SchedulerLiveRunDrainStep[] = [];
  for (const step of steps) {
    if (seen.has(step.action)) continue;
    seen.add(step.action);
    out.push(step);
  }
  return out.sort((a, b) => releaseSeverityRank(b.severity) - releaseSeverityRank(a.severity) || a.action.localeCompare(b.action));
}

function sourceIdsForWorkClasses(runtime: SchedulerRuntimeExecutionDto, workClasses: SchedulerWorkClass[]): string[] {
  if (workClasses.length === 0) return runtime.bySource.slice(0, 8).map((row) => row.sourceId);
  const noisySources = runtime.bySource.filter((row) => row.noisy).map((row) => row.sourceId);
  return noisySources.length > 0 ? noisySources.slice(0, 8) : runtime.bySource.slice(0, 8).map((row) => row.sourceId);
}

function runIdsForWorkClasses(runtime: SchedulerRuntimeExecutionDto, workClasses: SchedulerWorkClass[]): string[] {
  const runIds = new Set<string>();
  const activeWorkClasses = new Set(workClasses);
  for (const row of runtime.byRun) {
    if (row.queued > 0 || row.leased > 0 || row.retried > 0 || activeWorkClasses.size === 0) runIds.add(row.runId);
    if (runIds.size >= 8) break;
  }
  return [...runIds];
}

function slaMetric(
  name: SchedulerRuntimeSlaMetric["name"],
  value: number,
  threshold: number,
  unit: SchedulerRuntimeSlaMetric["unit"],
  pass: boolean,
  watch: boolean,
  impact: Exclude<SchedulerRuntimeSlaMetric["impact"], "none" | "release_blocker">,
  reason: string
): SchedulerRuntimeSlaMetric {
  const state: SchedulerRuntimeSlaState = pass ? "pass" : watch ? "watch" : "breach";
  return {
    name,
    value: Number.isFinite(value) ? Number(value.toFixed(unit === "ratio" ? 3 : 0)) : 0,
    threshold,
    unit,
    state,
    impact: state === "pass" ? "none" : state === "breach" && (impact === "worker_safety_risk" || impact === "api_polling_degraded") ? "release_blocker" : impact,
    reason
  };
}

function schedulerWorkerSafetyPlan(
  runtime: SchedulerRuntimeExecutionDto,
  metrics: SchedulerRuntimeSlaMetric[]
): SchedulerWorkerSafetyPlan {
  const controls = [...runtime.dryRunControls.controls];
  const recoveryActions: SchedulerWorkerSafetyPlan["recoveryActions"] = [];
  const metricState = (name: SchedulerRuntimeSlaMetric["name"]) => metrics.find((metric) => metric.name === name)?.state ?? "pass";
  if (metricState("lease_latency") !== "pass" || runtime.totals.staleRecovered > 0) {
    recoveryActions.push(workerRecoveryAction("recover_stale_leases", "lease latency or stale recovery pressure requires cursor-safe lease recovery", "automation_safe"));
  }
  if (metricState("cursor_continuity") !== "pass" || metricState("checkpoint_freshness") !== "pass") {
    recoveryActions.push(workerRecoveryAction("preserve_cursor_replay", "cursor continuity or checkpoint freshness requires replay preservation before throttling", "automation_safe"));
  }
  if (metrics.some((metric) => metric.state === "breach")) {
    recoveryActions.push(workerRecoveryAction("hold_release_packet", "one or more scheduler runtime SLAs are breached", "rollback_only"));
  }
  return {
    dryRun: true,
    willMutate: false,
    controls,
    recoveryActions
  };
}

function workerRecoveryAction(
  action: SchedulerWorkerSafetyPlan["recoveryActions"][number]["action"],
  reason: string,
  approval: SchedulerApplyApproval
): SchedulerWorkerSafetyPlan["recoveryActions"][number] {
  return {
    id: stableId("scheduler-worker-safety", `${action}:${reason}:${approval}`),
    action,
    approval,
    reason,
    preconditions: [
      "dry run only; no worker state changes are applied",
      "checkpoint cursors remain visible to polling clients",
      "restricted metadata policy and approval gates stay authoritative"
    ],
    rollback: "clear the safety action and rerun scheduler SLA proof"
  };
}

function publicAnswerImpactFor(metrics: SchedulerRuntimeSlaMetric[]): SchedulerRuntimeSlaDto["publicAnswerImpact"] {
  if (metrics.some((metric) => metric.state === "breach" && (metric.name === "fairness" || metric.name === "source_sla_pressure" || metric.name === "run_reuse"))) return "blocked";
  if (metrics.some((metric) => metric.state === "breach")) return "degraded";
  if (metrics.some((metric) => metric.state === "watch" && metric.impact === "public_answer_degraded")) return "partial_only";
  return "none";
}

function apiPollingImpactFor(metrics: SchedulerRuntimeSlaMetric[]): SchedulerRuntimeSlaDto["apiPollingImpact"] {
  if (metrics.some((metric) => metric.state === "breach" && (metric.name === "cursor_continuity" || metric.name === "checkpoint_freshness"))) return "blocked";
  if (metrics.some((metric) => metric.name === "cursor_continuity" && metric.state !== "pass")) return "cursor_replay_required";
  if (metrics.some((metric) => metric.name === "lease_latency" && metric.state !== "pass")) return "slow_poll";
  return "normal";
}

function deltasSinceCursor(deltas: SchedulerRuntimeDelta[], cursor?: string): SchedulerRuntimeDelta[] {
  if (!cursor) return [...deltas];
  const index = deltas.findIndex((delta) => delta.cursor === cursor);
  return index < 0 ? [...deltas] : deltas.slice(index + 1);
}

function runtimeByRun(
  tasks: CollectionTask[],
  deadLetters: FrontierAck[],
  deltas: SchedulerRuntimeDelta[]
): SchedulerRuntimeExecutionDto["byRun"] {
  const groups = new Map<string, SchedulerRuntimeExecutionDto["byRun"][number]>();
  const ensure = (runId: string) => {
    const existing = groups.get(runId);
    if (existing) return existing;
    const created: SchedulerRuntimeExecutionDto["byRun"][number] = { runId, queued: 0, leased: 0, checkpointed: 0, retried: 0, acknowledged: 0, cancelled: 0, deadLettered: 0, staleRecovered: 0 };
    groups.set(runId, created);
    return created;
  };
  for (const task of tasks) {
    if (!task.runId) continue;
    const group = ensure(task.runId);
    group.queued += 1;
  }
  for (const dead of deadLetters) {
    const task = dead.task;
    if (!task?.runId) continue;
    ensure(task.runId).deadLettered += 1;
  }
  for (const delta of deltas) {
    if (!delta.runId) continue;
    const group = ensure(delta.runId);
    if (delta.kind === "task_leased") group.leased += 1;
    if (delta.kind === "task_checkpointed") group.checkpointed += 1;
    if (delta.kind === "task_retry_scheduled") group.retried += 1;
    if (delta.kind === "task_completed") group.acknowledged += 1;
    if (delta.kind === "task_cancelled" || delta.kind === "run_cancelled") group.cancelled += 1;
    if (delta.kind === "task_failed") group.deadLettered += 1;
    if (delta.kind === "task_retry_scheduled" && delta.message.toLowerCase().includes("lease expired")) group.staleRecovered += 1;
    group.latestCursor = delta.cursor;
  }
  return [...groups.values()].sort((a, b) => a.runId.localeCompare(b.runId));
}

function runtimeBySource(
  tasks: CollectionTask[],
  deadLetters: FrontierAck[],
  deltas: SchedulerRuntimeDelta[]
): SchedulerRuntimeExecutionDto["bySource"] {
  const groups = new Map<string, SchedulerRuntimeExecutionDto["bySource"][number]>();
  const ensure = (sourceId: string) => {
    const existing = groups.get(sourceId);
    if (existing) return existing;
    const created = { sourceId, queued: 0, leased: 0, retried: 0, deadLettered: 0, staleRecovered: 0, noisy: false };
    groups.set(sourceId, created);
    return created;
  };
  for (const task of tasks) ensure(task.sourceId).queued += 1;
  for (const dead of deadLetters) {
    const task = dead.task;
    if (!task) continue;
    ensure(task.sourceId).deadLettered += 1;
  }
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  for (const delta of deltas) {
    const task = delta.taskId ? taskById.get(delta.taskId) : undefined;
    if (!task) continue;
    const group = ensure(task.sourceId);
    if (delta.kind === "task_leased") group.leased += 1;
    if (delta.kind === "task_retry_scheduled") group.retried += 1;
    if (delta.kind === "task_failed") group.deadLettered += 1;
    if (delta.kind === "task_retry_scheduled" && delta.message.toLowerCase().includes("lease expired")) group.staleRecovered += 1;
  }
  const total = Math.max(1, tasks.length);
  for (const group of groups.values()) group.noisy = group.queued / total > DEFAULT_SCHEDULER_EXECUTION_SLO.perSourceFairnessWorstShare;
  return [...groups.values()].sort((a, b) => b.queued - a.queued || a.sourceId.localeCompare(b.sourceId));
}

function runtimeByWorkClass(
  queued: CollectionTask[],
  leased: CollectionTask[],
  deadLetters: FrontierAck[],
  deltas: SchedulerRuntimeDelta[],
  now: Date
): SchedulerRuntimeExecutionDto["byWorkClass"] {
  const groups = new Map<SchedulerWorkClass, SchedulerRuntimeExecutionDto["byWorkClass"][number]>();
  const ensure = (workClass: SchedulerWorkClass) => {
    const existing = groups.get(workClass);
    if (existing) return existing;
    const created = { workClass, queued: 0, leased: 0, retried: 0, cancelled: 0, deadLettered: 0, maxQueuedAgeSeconds: 0 };
    groups.set(workClass, created);
    return created;
  };
  const taskById = new Map([...queued, ...leased].map((task) => [task.id, task]));
  for (const task of queued) {
    const group = ensure(workClassForTask(task));
    group.queued += 1;
    group.maxQueuedAgeSeconds = Math.max(group.maxQueuedAgeSeconds, queueAgeSeconds(task, now));
  }
  for (const task of leased) ensure(workClassForTask(task)).leased += 1;
  for (const dead of deadLetters) {
    const task = dead.task;
    if (!task) continue;
    ensure(workClassForTask(task)).deadLettered += 1;
  }
  for (const delta of deltas) {
    const task = delta.taskId ? taskById.get(delta.taskId) : undefined;
    if (!task) continue;
    const group = ensure(workClassForTask(task));
    if (delta.kind === "task_retry_scheduled") group.retried += 1;
    if (delta.kind === "task_cancelled" || delta.kind === "run_cancelled") group.cancelled += 1;
    if (delta.kind === "task_failed") group.deadLettered += 1;
  }
  return [...groups.values()].sort((a, b) => b.maxQueuedAgeSeconds - a.maxQueuedAgeSeconds || a.workClass.localeCompare(b.workClass));
}

function runtimeExecutionControls(input: {
  tasks: CollectionTask[];
  queueEconomics: SchedulerQueueEconomicsDto;
  restrictedKillSwitchActive?: boolean;
  approvedRestrictedMetadata?: boolean;
  pendingActivationBatchCount: number;
}): SchedulerRuntimeExecutionControl[] {
  const controls: SchedulerRuntimeExecutionControl[] = [];
  const noisySources = runtimeBySource(input.tasks, [], []).filter((source) => source.noisy).map((source) => source.sourceId);
  if (noisySources.length > 0) {
    controls.push(runtimeControl({
      index: controls.length,
      action: "pause_noisy_sources",
      approval: "human_approval_required",
      reason: "one source family exceeds scheduler fairness share",
      sourceIds: noisySources,
      workClasses: [...new Set(input.tasks.filter((task) => noisySources.includes(task.sourceId)).map(workClassForTask))]
    }));
  }
  const hasInteractivePressure = input.queueEconomics.workClassBudget.some((budget) =>
    (budget.workClass === "interactive_live_search" || budget.workClass === "interactive_search") &&
    budget.recommendedAction === "reserve_capacity"
  );
  const hasBackgroundBacklog = input.queueEconomics.workClassBudget.some((budget) =>
    (budget.workClass === "background_refresh" || budget.workClass === "broad_daily_sweep" || budget.workClass === "replay_retention") &&
    budget.queued > budget.budgetSlots
  );
  if (hasInteractivePressure || hasBackgroundBacklog) {
    controls.push(runtimeControl({
      index: controls.length,
      action: "move_background_behind_interactive",
      approval: "automation_safe",
      reason: "interactive actor queries need budget protection during release rehearsal",
      sourceIds: [],
      workClasses: ["background_refresh", "broad_daily_sweep", "replay_retention"]
    }));
  }
  const publicChannelSources = input.tasks.filter((task) => task.sourceType === "telegram_public");
  if (publicChannelSources.length > 0 && (input.queueEconomics.fairness.ok === false || input.queueEconomics.deadLetterTrend.direction === "rising")) {
    controls.push(runtimeControl({
      index: controls.length,
      action: "reduce_public_channel_windows",
      approval: "human_approval_required",
      reason: "public-channel windows are contributing to fairness pressure or retry exhaustion",
      sourceIds: [...new Set(publicChannelSources.map((task) => task.sourceId))],
      workClasses: [...new Set(publicChannelSources.map(workClassForTask))]
    }));
  }
  const restrictedSources = input.tasks.filter((task) => task.sourceType.endsWith("_metadata"));
  if (restrictedSources.length > 0 && (input.restrictedKillSwitchActive || input.approvedRestrictedMetadata === false)) {
    controls.push(runtimeControl({
      index: controls.length,
      action: "hold_restricted_metadata",
      approval: "blocked",
      reason: input.restrictedKillSwitchActive ? "restricted metadata kill switch is active" : "restricted metadata approval state is not ready",
      sourceIds: [...new Set(restrictedSources.map((task) => task.sourceId))],
      workClasses: ["restricted_darknet_metadata_sweep"]
    }));
  }
  if (input.pendingActivationBatchCount > 0 && (input.queueEconomics.emergencyBrakeState !== "clear" || input.queueEconomics.memoryPressure.ok === false)) {
    controls.push(runtimeControl({
      index: controls.length,
      action: "hold_source_activation_batches",
      approval: "human_approval_required",
      reason: "pending source activation batches would overrun current queue or memory budgets",
      sourceIds: [],
      workClasses: ["interactive_live_search", "background_refresh", "broad_daily_sweep"]
    }));
  }
  return controls;
}

function runtimeControl(input: {
  index: number;
  action: SchedulerRuntimeControlAction;
  approval: SchedulerApplyApproval;
  reason: string;
  sourceIds: string[];
  workClasses: SchedulerWorkClass[];
}): SchedulerRuntimeExecutionControl {
  return {
    id: stableId("scheduler-runtime-control", `${input.index}:${input.action}:${input.reason}:${input.sourceIds.join(",")}:${input.workClasses.join(",")}`),
    action: input.action,
    approval: input.approval,
    reason: input.reason,
    sourceIds: input.sourceIds,
    workClasses: input.workClasses,
    dryRun: true,
    willMutate: false,
    preconditions: [
      "dry run only; no queue, source, run, or worker mutation is performed",
      "source policy approval and metadata-only restrictions remain authoritative",
      "cursor polling state must remain replayable before an operator applies changes"
    ],
    rollback: "clear the runtime control and rerun scheduler route proof"
  };
}

function sourceActivationBudgetGuard(
  queueEconomics: SchedulerQueueEconomicsDto,
  controls: SchedulerRuntimeExecutionControl[],
  pendingActivationBatchCount: number
): SchedulerRuntimeExecutionDto["sourceActivationBudgetGuard"] {
  if (queueEconomics.emergencyBrakeState === "engaged") {
    return {
      state: "blocked_by_emergency_brake",
      estimatedActivationSlots: 0,
      reason: "emergency brake is engaged; activation batches cannot add scheduler load"
    };
  }
  const budgetSlots = queueEconomics.workClassBudget.reduce((sum, budget) => sum + budget.budgetSlots, 0);
  const used = queueEconomics.totals.queued + queueEconomics.totals.leased + queueEconomics.totals.retryDebt;
  const estimatedActivationSlots = Math.max(0, budgetSlots - used);
  if (pendingActivationBatchCount > estimatedActivationSlots || controls.some((control) => control.action === "hold_source_activation_batches")) {
    return {
      state: "hold_activation_batches",
      estimatedActivationSlots,
      reason: "activation batch demand exceeds available scheduler budget"
    };
  }
  return {
    state: "within_budget",
    estimatedActivationSlots,
    reason: "source activation batches fit current scheduler budget"
  };
}

function budgetShareForWorkClass(workClass: SchedulerWorkClass): number {
  switch (workClass) {
    case "interactive_live_search":
      return 0.28;
    case "interactive_search":
      return 0.14;
    case "analyst_deep_dive":
      return 0.16;
    case "restricted_darknet_metadata_sweep":
      return 0.1;
    case "source_health_probe":
      return 0.08;
    case "replay_retention":
      return 0.08;
    case "broad_daily_sweep":
      return 0.08;
    case "background_refresh":
      return 0.08;
  }
}

function recommendedEconomicsAction(
  workClass: SchedulerWorkClass,
  maxQueuedAgeSeconds: number,
  retryDebt: number,
  taskCount: number,
  budgetSlots: number
): SchedulerQueueEconomicsDto["workClassBudget"][number]["recommendedAction"] {
  if ((workClass === "broad_daily_sweep" || workClass === "background_refresh" || workClass === "replay_retention") && taskCount > budgetSlots * 4) return "defer_low_priority";
  if (workClass === "restricted_darknet_metadata_sweep" && retryDebt > 0) return "reserve_capacity";
  if (retryDebt > Math.max(2, budgetSlots) && (workClass === "interactive_live_search" || workClass === "restricted_darknet_metadata_sweep")) return "reserve_capacity";
  if (maxQueuedAgeSeconds > DEFAULT_SCHEDULER_EXECUTION_SLO.queueAgeP95Seconds && (workClass === "interactive_live_search" || workClass === "interactive_search" || workClass === "analyst_deep_dive")) return "reserve_capacity";
  if (taskCount > budgetSlots * 6) return "pause_noisy_source";
  return "accept";
}

function capacityShiftPlanSteps(
  budgets: SchedulerQueueEconomicsDto["workClassBudget"],
  state: {
    worstShare: number;
    worstGroup?: string;
    retryExhaustionRate: number;
    memoryPressureRatio: number;
    emergencyBrakeState: SchedulerPromotionGate["emergencyBrakeState"];
  }
): SchedulerCapacityShiftPlanStep[] {
  const steps: SchedulerCapacityShiftPlanStep[] = [];
  const needsInteractive = budgets.some((budget) =>
    (budget.workClass === "interactive_live_search" || budget.workClass === "interactive_search" || budget.workClass === "analyst_deep_dive") &&
    budget.recommendedAction === "reserve_capacity"
  );
  const lowPriorityBacklog = budgets.some((budget) =>
    (budget.workClass === "background_refresh" || budget.workClass === "broad_daily_sweep" || budget.workClass === "replay_retention") &&
    budget.recommendedAction === "defer_low_priority"
  );
  if (needsInteractive) {
    steps.push(capacityShiftStep({
      index: steps.length,
      fromWorkload: lowPriorityBacklog ? "background_sweeps" : "retention",
      toWorkload: "interactive_actor_search",
      workerSlotDelta: 2,
      reason: "interactive queue age or retry debt needs reserved worker slots",
      approval: "automation_safe"
    }));
  }
  if (state.worstShare > DEFAULT_SCHEDULER_EXECUTION_SLO.perSourceFairnessWorstShare) {
    steps.push(capacityShiftStep({
      index: steps.length,
      fromWorkload: "public_channel_windows",
      toWorkload: "interactive_actor_search",
      workerSlotDelta: 1,
      reason: `fairness group ${state.worstGroup ?? "unknown"} is consuming too much scheduler share`,
      approval: "human_approval_required"
    }));
  }
  const restrictedPressure = budgets.some((budget) => budget.workClass === "restricted_darknet_metadata_sweep" && budget.recommendedAction === "reserve_capacity");
  if (restrictedPressure) {
    steps.push(capacityShiftStep({
      index: steps.length,
      fromWorkload: "background_sweeps",
      toWorkload: "restricted_metadata_approvals",
      workerSlotDelta: 1,
      reason: "approved metadata-only restricted queue has retry debt but must stay inside policy gates",
      approval: "human_approval_required"
    }));
  }
  if (state.memoryPressureRatio > DEFAULT_SCHEDULER_EXECUTION_SLO.workerMemoryPressure || state.emergencyBrakeState === "engaged") {
    steps.push(capacityShiftStep({
      index: steps.length,
      fromWorkload: "graph_export",
      toWorkload: "retention",
      workerSlotDelta: 2,
      reason: "memory pressure requires pausing graph export and preserving retention/replay safety work",
      approval: "rollback_only"
    }));
  }
  if (state.retryExhaustionRate > DEFAULT_SCHEDULER_EXECUTION_SLO.retryExhaustionRate) {
    steps.push(capacityShiftStep({
      index: steps.length,
      fromWorkload: "public_channel_windows",
      toWorkload: "evidence_replay",
      workerSlotDelta: 1,
      reason: "retry exhaustion is rising; reserve capacity for replay and dead-letter inspection",
      approval: "human_approval_required"
    }));
  }
  return steps;
}

function capacityShiftStep(input: {
  index: number;
  fromWorkload: SchedulerCapacityShiftPlanStep["fromWorkload"];
  toWorkload: SchedulerCapacityShiftPlanStep["toWorkload"];
  workerSlotDelta: number;
  reason: string;
  approval: SchedulerApplyApproval;
}): SchedulerCapacityShiftPlanStep {
  return {
    id: stableId("scheduler-capacity-shift", `${input.index}:${input.fromWorkload}:${input.toWorkload}:${input.workerSlotDelta}:${input.reason}`),
    fromWorkload: input.fromWorkload,
    toWorkload: input.toWorkload,
    workerSlotDelta: input.workerSlotDelta,
    reason: input.reason,
    approval: input.approval,
    preconditions: [
      "dry run only; no worker slots are changed by this DTO",
      "policy approvals and metadata-only boundaries remain unchanged",
      "cursor continuity and replay state are durable before any operator applies changes"
    ],
    rollback: "restore default work-class budget shares and rerun scheduler proofs"
  };
}

function schedulerBackpressureSummaryForSlo(slo: SchedulerExecutionSloFields, traffic: Pick<SchedulerExecutionTraffic, "providerOutage" | "restrictedSourcesDisabled" | "emergencyBrakeRecoveryAtHour">): SchedulerBackpressureSummary {
  const reasons = [
    !slo.queueAge.ok ? "queue_age_slo_breached" : undefined,
    !slo.leaseAge.ok ? "lease_age_slo_breached" : undefined,
    !slo.retryExhaustion.ok ? "retry_exhaustion_slo_breached" : undefined,
    !slo.perSourceFairness.ok ? "per_source_fairness_slo_breached" : undefined,
    !slo.interactiveSearchLatency.ok ? "interactive_latency_slo_breached" : undefined,
    !slo.pollFreshness.ok ? "poll_freshness_slo_breached" : undefined,
    !slo.workerMemoryPressure.ok ? "worker_memory_pressure_slo_breached" : undefined,
    traffic.providerOutage ? "provider_outage" : undefined,
    traffic.restrictedSourcesDisabled ? "restricted_source_disabled" : undefined
  ].filter((reason): reason is string => Boolean(reason));
  const emergencyBrakeState: SchedulerPromotionGate["emergencyBrakeState"] = reasons.includes("worker_memory_pressure_slo_breached") || reasons.includes("queue_age_slo_breached")
    ? traffic.emergencyBrakeRecoveryAtHour !== undefined ? "armed" : "engaged"
    : reasons.length > 0 ? "armed" : "clear";
  const state: LiveSearchBackpressureState = reasons.length === 0
    ? "accepted"
    : reasons.includes("restricted_source_disabled")
      ? "blocked_by_policy"
      : reasons.includes("queue_age_slo_breached") || reasons.includes("worker_memory_pressure_slo_breached")
        ? "deferred_by_queue_pressure"
        : "deferred_by_source_backoff";
  const soakDecision = emergencyBrakeState === "engaged" || !slo.retryExhaustion.ok ? "rollback" : reasons.length > 0 ? "hold" : "pass";
  return {
    state,
    reasons,
    recommendedAction: reasons.length === 0 ? "accept" : emergencyBrakeState === "engaged" ? "shed" : traffic.emergencyBrakeRecoveryAtHour !== undefined ? "recover" : "defer",
    emergencyBrakeState,
    slo,
    agent09Compatibility: {
      fields: ["backpressure.state", "backpressure.reasons", "slo.queueAge.p95Seconds", "slo.pollFreshness.p95Seconds", "slo.interactiveSearchLatency.p95Ms"],
      publicStatus: state === "accepted" ? "compatible" : state === "blocked_by_policy" ? "blocked" : "degraded"
    },
    agent10SoakPacket: {
      promotionGateFields: ["queueAge", "leaseAge", "retryExhaustion", "perSourceFairness", "interactiveSearchLatency", "pollFreshness", "workerMemoryPressure", "emergencyBrakeState"],
      soakDecision,
      proofCommand: "bun test src/tests/schedulerProduction.test.ts && bun run check:frontier-apply-plan"
    }
  };
}

export function buildSchedulerReconciliation(input: {
  sources: SourceRecord[];
  queued: CollectionTask[];
  leased: CollectionTask[];
  deadLetters?: FrontierAck[];
  runs?: CollectionRun[];
  now?: Date;
  maxDiagnostics?: number;
  queuePressureThreshold?: number;
}): SchedulerReconciliationReport {
  const now = input.now ?? new Date();
  const maxDiagnostics = Math.max(1, input.maxDiagnostics ?? 250);
  const queued = input.queued;
  const leased = input.leased;
  const deadLetters = input.deadLetters ?? [];
  const activeRuns = (input.runs ?? []).filter((run) => run.status === "queued" || run.status === "running");
  const tasksBySource = new Map<string, CollectionTask[]>();
  for (const task of [...queued, ...leased]) {
    tasksBySource.set(task.sourceId, [...(tasksBySource.get(task.sourceId) ?? []), task]);
  }
  const items: SchedulerReconciliationItem[] = [];

  for (const source of input.sources) {
    const sourceTasks = tasksBySource.get(source.id) ?? [];
    if (source.status === "active" && sourceTasks.length > 0) {
      items.push(reconciliationItem(now, "source", source.id, "active_source_scheduled", "info", "active source has queued or leased scheduler work", "no_action", { sourceId: source.id }));
    }
    if ((source.status === "approved" || source.status === "probation") && sourceTasks.length === 0) {
      items.push(reconciliationItem(now, "source", source.id, "approved_not_scheduled", "warn", "approved source is not represented in scheduler work", "requeue_transient_failures", { sourceId: source.id }));
    }
    if (source.status === "needs_review" && !source.approvedAt) {
      items.push(reconciliationItem(now, "source", source.id, "missing_approved_source", "warn", "source needs approval before scheduler can collect it", "no_action", { sourceId: source.id }));
    }
    if (source.status === "active" && (source.health?.status === "failing" || (source.health?.consecutiveFailures ?? 0) >= 5)) {
      items.push(reconciliationItem(now, "source", source.id, "unhealthy_active_source", "critical", "active source is failing health checks", "quarantine_permanently_failing_sources", { sourceId: source.id }));
    }
    if (source.status === "active" && source.crawlState?.lastScheduledAt && !source.crawlState.lastCollectedAt) {
      items.push(reconciliationItem(now, "source", source.id, "active_without_recent_capture", "warn", "active source has scheduled work but no recent capture", "requeue_transient_failures", { sourceId: source.id, nextActionableAt: source.crawlState.nextEligibleAt }));
    }
    if (source.accessMethod === "disabled" || source.status === "disabled" || source.status === "paused") {
      items.push(reconciliationItem(now, "source", source.id, "policy_disabled_source", "warn", "source is disabled or paused by policy/runtime state", "no_action", { sourceId: source.id }));
    }
    if (source.governance?.approvalExpiresAt && Date.parse(source.governance.approvalExpiresAt) <= now.getTime()) {
      items.push(reconciliationItem(now, "source", source.id, "expired_approval", "critical", "source approval has expired", "no_action", { sourceId: source.id }));
    }
    if (!source.legalNotes.trim()) {
      items.push(reconciliationItem(now, "source", source.id, "stale_legal_notes", "warn", "source lacks current legal notes", "no_action", { sourceId: source.id }));
    }
    if (source.catalog && !source.catalog.adapterCompatibility.includes(source.type)) {
      items.push(reconciliationItem(now, "source", source.id, "adapter_capability_mismatch", "warn", "source type is outside declared adapter compatibility", "no_action", { sourceId: source.id }));
    }
  }

  const seenSourceUrls = new Set<string>();
  for (const source of input.sources) {
    const key = `${source.tenantId ?? "global"}:${source.type}:${source.url.toLowerCase()}`;
    if (seenSourceUrls.has(key)) {
      items.push(reconciliationItem(now, "source", source.id, "duplicate_source", "warn", "source duplicates another tenant/type/url registration", "no_action", { sourceId: source.id }));
    }
    seenSourceUrls.add(key);
  }

  for (const task of queued) {
    items.push(reconciliationItem(now, "task", task.id, task.availableAt && Date.parse(task.availableAt) > now.getTime() ? "retry_backoff" : "queued_task", "info", "task is queued for scheduler leasing", "no_action", {
      sourceId: task.sourceId,
      runId: task.runId,
      nextActionableAt: nextActionableAt(task, now)
    }));
    if (workClassForTask(task) === "broad_daily_sweep" && (queued.length + leased.length) >= (input.queuePressureThreshold ?? 1_000)) {
      items.push(reconciliationItem(now, "task", task.id, "low_priority_deferred", "warn", "low-priority sweep should be delayed while queue pressure is high", "delay_low_priority_sweeps", {
        sourceId: task.sourceId,
        runId: task.runId,
        nextActionableAt: task.availableAt
      }));
    }
  }
  for (const task of leased) {
    items.push(reconciliationItem(now, "task", task.id, "leased_task", "info", "task has an active scheduler lease", "no_action", {
      sourceId: task.sourceId,
      runId: task.runId,
      nextActionableAt: task.attemptDeadlineAt
    }));
  }
  for (const letter of deadLetters) {
    items.push(reconciliationItem(now, "task", letter.taskId, "dead_letter", "critical", letter.reason, "quarantine_permanently_failing_sources", {
      sourceId: letter.task?.sourceId,
      runId: letter.task?.runId
    }));
  }
  for (const run of activeRuns) {
    if (run.requestHash) {
      items.push(reconciliationItem(now, "run", run.id, "active_run_reused", "info", "active run has a durable reuse key", "no_action", { runId: run.id }));
    }
  }
  for (const decision of activeRunGcDecisions(input.runs ?? [], now)) {
    if (decision.action === "mark_abandoned_cancelled") {
      items.push(reconciliationItem(now, "run", decision.runId, "abandoned_run", "warn", decision.reason, "cancel_abandoned_runs", { runId: decision.runId, nextActionableAt: decision.nextActionableAt }));
    }
    if (decision.action === "mark_stale_failed") {
      items.push(reconciliationItem(now, "run", decision.runId, "stale_active_run", "critical", decision.reason, "release_expired_leases", { runId: decision.runId, nextActionableAt: decision.nextActionableAt }));
    }
  }
  if (queued.length + leased.length >= (input.queuePressureThreshold ?? 1_000)) {
    items.push(reconciliationItem(now, "queue", "frontier", "queue_pressure", "warn", "scheduler queue exceeds pressure threshold", "delay_low_priority_sweeps"));
  }

  const reasonCounts: SchedulerReconciliationReport["reasonCounts"] = {};
  for (const item of items) reasonCounts[item.reasonCode] = (reasonCounts[item.reasonCode] ?? 0) + 1;
  const repairRecommendations = repairRecommendationsFor(items);
  const diagnostics = items.slice(0, maxDiagnostics);
  return {
    generatedAt: now.toISOString(),
    totals: {
      sources: input.sources.length,
      queuedTasks: queued.length,
      leasedTasks: leased.length,
      deadLetters: deadLetters.length,
      activeRuns: activeRuns.length,
      diagnosticsReturned: diagnostics.length,
      diagnosticsTruncated: Math.max(0, items.length - diagnostics.length)
    },
    reasonCounts,
    repairRecommendations,
    diagnostics
  };
}

export function simulateFairnessEnforcement(input: FairnessSimulationInput): FairnessSimulationResult {
  const totalTasks = input.publicLiveSearches
    + input.actorSweeps
    + input.publicChannelPolls
    + input.restrictedMetadataQueues
    + input.retentionReplayJobs;
  const reserved: Partial<Record<SchedulerWorkClass, number>> = {
    interactive_live_search: Math.min(input.publicLiveSearches, Math.max(1, Math.ceil(input.workerSlots * 0.3))),
    source_health_probe: Math.min(input.publicChannelPolls, Math.max(1, Math.ceil(input.workerSlots * 0.15))),
    restricted_darknet_metadata_sweep: Math.min(input.restrictedMetadataQueues, Math.max(1, Math.ceil(input.workerSlots * 0.1))),
    replay_retention: Math.min(input.retentionReplayJobs, Math.max(1, Math.ceil(input.workerSlots * 0.1))),
    broad_daily_sweep: 0
  };
  const used = Object.values(reserved).reduce((sum, value) => sum + (value ?? 0), 0);
  reserved.broad_daily_sweep = Math.min(input.actorSweeps, Math.max(0, input.workerSlots - used));
  const delayedLowPrioritySweeps = Math.max(0, input.actorSweeps - (reserved.broad_daily_sweep ?? 0));
  const liveSearchStarved = input.publicLiveSearches > 0 && (reserved.interactive_live_search ?? 0) === 0;
  const backgroundSweepStarved = input.actorSweeps > 0 && (reserved.broad_daily_sweep ?? 0) === 0;
  return {
    totalTasks,
    workerSlots: input.workerSlots,
    leasedByClass: reserved,
    delayedLowPrioritySweeps,
    liveSearchStarved,
    backgroundSweepStarved,
    repairRecommendations: [
      ...(delayedLowPrioritySweeps > 0 ? ["delay_low_priority_sweeps" as const] : []),
      ...(input.restrictedMetadataQueues > input.workerSlots ? ["quarantine_permanently_failing_sources" as const] : [])
    ]
  };
}

export function buildSchedulerCutoverRehearsal(input: {
  scenario: string;
  sources: SourceRecord[];
  queued: CollectionTask[];
  leased: CollectionTask[];
  deadLetters?: FrontierAck[];
  runs?: CollectionRun[];
  now?: Date;
  workerSlots?: number;
  maxDiagnostics?: number;
  queuePressureThreshold?: number;
}): SchedulerCutoverRehearsalReport {
  const now = input.now ?? new Date();
  const queued = input.queued;
  const leased = input.leased;
  const allTasks = [...queued, ...leased];
  const runs = input.runs ?? [];
  const deadLetters = input.deadLetters ?? [];
  const reconciliation = buildSchedulerReconciliation({
    sources: input.sources,
    queued,
    leased,
    deadLetters,
    runs,
    now,
    maxDiagnostics: input.maxDiagnostics,
    queuePressureThreshold: input.queuePressureThreshold
  });
  const pressure = pressureDtosForTasks(allTasks, runs, now);
  const fairness = simulateFairnessEnforcement({
    publicLiveSearches: countTasksByWorkClass(allTasks, "interactive_live_search"),
    actorSweeps: countTasksByWorkClass(allTasks, "broad_daily_sweep"),
    publicChannelPolls: allTasks.filter((task) => task.sourceType === "telegram_public").length,
    restrictedMetadataQueues: allTasks.filter((task) => task.sourceType.endsWith("_metadata")).length,
    retentionReplayJobs: countTasksByWorkClass(allTasks, "replay_retention"),
    workerSlots: input.workerSlots ?? 128
  });
  const activeRuns = runs.filter((run) => run.status === "queued" || run.status === "running");
  const reusableRuns = activeRuns.filter((run) => Boolean(run.requestHash)).length;
  const promotionGate = promotionGateFor({
    tasks: allTasks,
    deadLetters,
    reconciliation,
    activeRuns,
    reusableRuns,
    now
  });
  const repairPlan = repairPlanFor(reconciliation, now);
  const blockers = [
    ...(promotionGate.emergencyBrakeState === "engaged" ? ["emergency_brake_engaged"] : []),
    ...(promotionGate.abandonedRunCount > 0 ? ["abandoned_runs_present"] : []),
    ...(promotionGate.deadLetterRate > 0.05 ? ["dead_letter_rate_high"] : []),
    ...(fairness.liveSearchStarved ? ["live_search_starved"] : []),
    ...(fairness.backgroundSweepStarved ? ["background_sweep_starved"] : [])
  ];
  return {
    generatedAt: now.toISOString(),
    scenario: input.scenario,
    promotionGate,
    reconciliation,
    pressure,
    fairness,
    activeRunReuse: {
      activeRuns: activeRuns.length,
      reusableRuns,
      duplicateReuseRate: promotionGate.duplicateReuseRate
    },
    repairPlan,
    blockers,
    recommendedNextAction: repairPlan.length > 0
        ? "apply_repairs"
        : blockers.length === 0
          ? "promote"
          : "hold"
  };
}

export function buildSchedulerApplyPlan(input: {
  rehearsal: SchedulerCutoverRehearsalReport;
  tasks?: CollectionTask[];
  sources?: SourceRecord[];
  now?: Date;
  hostMemoryMb?: number;
  dbConnectionUtilization?: number;
  workerUtilization?: number;
  maxApiP95QueueAgeSeconds?: number;
}): SchedulerApplyPlanReport {
  const now = input.now ?? new Date(input.rehearsal.generatedAt);
  const tasks = input.tasks ?? [];
  const noisySourceIds = noisySourceQueues(tasks);
  const repairSteps = input.rehearsal.repairPlan
    .filter((step) => step.action !== "no_action")
    .map((step) => applyStepForRepair({
      action: step.action,
      affectedCount: step.affectedCount,
      reasonCodes: step.reasonCodes,
      now,
      sourceIds: sourceIdsForRepair(step.action, input.rehearsal.reconciliation, noisySourceIds)
    }));
  const noisySteps = noisySourceIds.length > 0 && !repairSteps.some((step) => step.action === "pause_noisy_source_queues")
    ? [applyStepForRepair({
        action: "pause_noisy_source_queues",
        affectedCount: tasks.filter((task) => noisySourceIds.includes(task.sourceId)).length,
        reasonCodes: ["queue_pressure"],
        now,
        sourceIds: noisySourceIds
      })]
    : [];
  const emergencyBrake = emergencyBrakePolicyFor({
    gate: input.rehearsal.promotionGate,
    hostMemoryMb: input.hostMemoryMb,
    dbConnectionUtilization: input.dbConnectionUtilization,
    workerUtilization: input.workerUtilization,
    maxApiP95QueueAgeSeconds: input.maxApiP95QueueAgeSeconds
  });
  const brakeStep = emergencyBrake.state === "engaged"
    ? [applyStepForRepair({
        action: "trigger_emergency_brake",
        affectedCount: Math.max(1, input.rehearsal.reconciliation.totals.queuedTasks + input.rehearsal.reconciliation.totals.leasedTasks),
        reasonCodes: ["queue_pressure"],
        now
      })]
    : [];
  const steps = [...repairSteps, ...noisySteps, ...brakeStep]
    .filter((step, index, all) => all.findIndex((candidate) => candidate.action === step.action && candidate.sourceIds?.join(",") === step.sourceIds?.join(",")) === index)
    .sort((a, b) => applyActionOrder(a.action) - applyActionOrder(b.action) || a.action.localeCompare(b.action));
  const expectedTotalDelta = sumExpectedDeltas(steps.map((step) => step.expectedDelta));
  const apiWarnings = [...new Set([
    ...emergencyBrake.warnings,
    ...steps.map((step) => step.apiWarningCode).filter((code): code is string => Boolean(code))
  ])].sort();
  const hasEmergency = steps.some((step) => step.action === "trigger_emergency_brake");
  const hasHumanApproval = steps.some((step) => step.operatorApprovalRequired);
  return {
    generatedAt: now.toISOString(),
    scenario: input.rehearsal.scenario,
    dryRun: true,
    emergencyBrake,
    steps,
    expectedTotalDelta,
    apiWarnings,
    recommendation: hasEmergency
      ? "emergency_brake_required"
      : hasHumanApproval
        ? "hold_for_operator"
        : steps.length > 0
          ? "apply_repairs_first"
          : "safe_to_promote"
  };
}

export function buildSchedulerApplyPlanApiResponse(
  plan: SchedulerApplyPlanReport,
  request: SchedulerApplyPlanApiRequestDto = {}
): SchedulerApplyPlanApiResponseDto {
  const selectedActions = new Set(request.selectedActions ?? plan.steps.map((step) => step.action));
  const items = plan.steps
    .filter((step) => selectedActions.has(step.action))
    .map(schedulerApplyApiItem);
  const applyPlanId = stableId("scheduler-apply-plan", `${plan.scenario}:${plan.generatedAt}:${items.map((item) => item.stepId).join(",")}`);
  return {
    apiVersion: "v1",
    endpoint: "/v1/frontier/apply-plan",
    applyPlanId,
    generatedAt: plan.generatedAt,
    dryRun: true,
    willMutate: false,
    willLeaseTasks: false,
    willAcknowledgeTasks: false,
    willChangeRuns: false,
    request: {
      ...request,
      dryRun: true
    },
    summary: {
      scenario: plan.scenario,
      recommendation: plan.recommendation,
      stepCount: items.length,
      automationSafeCount: items.filter((item) => item.execution === "automation_safe").length,
      humanApprovalRequiredCount: items.filter((item) => item.execution === "human_approval_required").length,
      rollbackOnlyCount: items.filter((item) => item.execution === "rollback_only").length,
      blockedCount: items.filter((item) => item.execution === "blocked").length,
      highestRiskClass: highestRiskClass(items.map((item) => item.riskClass)),
      apiWarningCount: plan.apiWarnings.length
    },
    emergencyBrake: plan.emergencyBrake,
    expectedTotalDelta: plan.expectedTotalDelta,
    apiWarnings: plan.apiWarnings,
    items,
    executionPreview: request.includeExecutionPreview ? schedulerApplyExecutionPreview(items) : undefined,
    canaryControlPlane: schedulerApplyPlanCanaryControlPlane(items),
    promotionPacketLink: {
      field: "schedulerApplyPlanId",
      value: applyPlanId,
      recommendation: plan.recommendation,
      emergencyBrakeState: plan.emergencyBrake.state,
      unappliedActionCount: items.length
    },
    schemaExamples: schedulerApplyPlanApiExamples()
  };
}

export function schedulerApplyPlanApiContract(): SchedulerApplyPlanApiContractDto {
  return {
    endpoint: "/v1/frontier/apply-plan",
    method: "POST",
    mode: "dry_run",
    request: {
      contentType: "application/json",
      fields: [
        { name: "dryRun", type: "true", required: false, description: "Must remain true or omitted; plan creation never mutates scheduler state." },
        { name: "scenario", type: "string", required: false, description: "Optional label for Agent 10 promotion packets and operator audit." },
        { name: "selectedActions", type: "SchedulerRepairAction[]", required: false, description: "Optional action filter for compact Agent 09 responses." },
        { name: "includeExecutionPreview", type: "boolean", required: false, description: "Includes a dry-run preview that explicitly reports no mutation, leasing, acknowledgement, or run changes." },
        { name: "hostMemoryMb", type: "number", required: false, description: "Host memory used to compute emergency-brake headroom for the 1 TB deployment target." },
        { name: "dbConnectionUtilization", type: "number", required: false, description: "Current DB connection utilization ratio for headroom warnings." },
        { name: "workerUtilization", type: "number", required: false, description: "Current worker utilization ratio for headroom warnings." },
        { name: "maxApiP95QueueAgeSeconds", type: "number", required: false, description: "Emergency-brake queue-age threshold exposed to Agent 10 promotion checks." }
      ]
    },
    response: {
      fields: ["contract", "applyPlan"],
      itemFields: ["stepId", "action", "dryRun", "execution", "riskClass", "operatorApprovalRequired", "affectedCount", "reasonCodes", "preconditions", "expectedQueueRunDelta", "rollback", "apiWarningCode", "sourceIds", "canaryControlPlane"],
      forbiddenMutationFields: ["leasedTask", "acknowledgedTask", "mutatedRun", "updatedSource", "startedWorker", "rawQueueRow", "dbTransaction", "cursorPayload", "replayPayload"],
      actions: ["release_expired_leases", "cancel_abandoned_runs", "requeue_transient_failures", "delay_low_priority_sweeps", "pause_noisy_source_queues", "quarantine_permanently_failing_sources", "trigger_emergency_brake"],
      executions: ["automation_safe", "human_approval_required", "blocked", "rollback_only"],
      riskClasses: ["low", "medium", "high", "emergency"]
    },
    examples: schedulerApplyPlanApiExamples()
  };
}

export function buildSchedulerDiagnostics(input: {
  frontier: FocusedFrontier;
  runs?: CollectionRun[];
  plans?: CollectionPlan[];
  now?: Date;
  activePollingRunIds?: Set<string>;
  pendingDeltaRunIds?: Set<string>;
}): SchedulerDiagnostics {
  const now = input.now ?? new Date();
  const summary = input.frontier.groupedSnapshot(now);
  const queued = input.frontier.snapshot();
  const leased = input.frontier.leasedSnapshot();
  const all = [...queued.map((item) => item.task), ...leased];
  const duplicateCounts = duplicateTaskCounts(all, input.runs ?? []);
  const runByRequestId = new Map((input.runs ?? []).map((run) => [run.requestId, run]));
  const runById = new Map((input.runs ?? []).map((run) => [run.id, run]));

  return {
    generatedAt: now.toISOString(),
    backend: "embedded_memory",
    summary,
    loadFixtures: schedulerLoadModelFixtures(),
    starvation: detectSchedulerStarvation(all, now),
    activeRunGc: activeRunGcDecisions(input.runs ?? [], now, {
      activePollingRunIds: input.activePollingRunIds,
      pendingDeltaRunIds: input.pendingDeltaRunIds
    }),
    diagnostics: all
      .sort((a, b) => queueAgeSeconds(b, now) - queueAgeSeconds(a, now))
      .slice(0, 100)
      .map((task) => {
        const run = task.runId ? runById.get(task.runId) : runByRequestId.get(task.intelRequestId ?? "");
        return {
          taskId: task.id,
          runId: run?.id ?? task.runId,
          requestId: task.intelRequestId,
          tenantId: task.tenantId,
          sourceId: task.sourceId,
          sourceType: task.sourceType,
          workClass: workClassForTask(task),
          runReuseKey: run?.requestHash,
          pressureState: pressureStateForTask(task, summary, now),
          queueAgeSeconds: queueAgeSeconds(task, now),
          fairnessGroup: fairnessGroupForTask(task),
          droppedMergedDuplicateCount: Math.max(0, (duplicateCounts.get(duplicateKeyForTask(task, run)) ?? 1) - 1),
          ...taskDecisionCounts([task]),
          retryAfterSeconds: retryAfterSecondsForTask(task, now),
          nextActionableAt: nextActionableAt(task, now)
        };
      })
  };
}

export class InMemorySchedulerQueueRepository implements SchedulerQueueRepository {
  private readonly queued = new Map<string, CollectionTask>();
  private readonly leased = new Map<string, SchedulerLease>();
  private readonly completed = new Map<string, CollectionTask>();
  private readonly runById = new Map<string, CollectionRun>();
  private readonly runIdByReuseKey = new Map<string, string>();
  private readonly reuseCounts = new Map<string, number>();
  private readonly events: SchedulerRuntimeDelta[] = [];
  private readonly retryBaseMs: number;
  private readonly leaseMs: number;

  constructor(options: { retryBaseMs?: number; leaseMs?: number } = {}) {
    this.retryBaseMs = options.retryBaseMs ?? 30_000;
    this.leaseMs = options.leaseMs ?? 5 * 60_000;
  }

  enqueueTasks(tasks: CollectionTask[], now = new Date()): SchedulerRuntimeDelta[] {
    return tasks.map((task) => {
      const existing = this.queued.get(task.id) ?? this.leased.get(task.id)?.task;
      if (existing) {
        const delta = this.delta("task_enqueued", now, `merged duplicate task ${task.id}`, { taskId: task.id, runId: task.runId });
        return delta;
      }
      this.queued.set(task.id, task);
      return this.delta("task_enqueued", now, `enqueued task ${task.id}`, { taskId: task.id, runId: task.runId });
    });
  }

  leaseNext(workerId: string, now = new Date()): SchedulerLease | undefined {
    this.requeueExpiredLeases(now);
    const task = [...this.queued.values()]
      .filter((candidate) => !candidate.availableAt || Date.parse(candidate.availableAt) <= now.getTime())
      .sort((a, b) => runtimePriority(b) - runtimePriority(a) || a.queuedAt.localeCompare(b.queuedAt))[0];
    if (!task) return undefined;
    this.queued.delete(task.id);
    const lease = {
      task,
      workerId,
      leasedAt: now.toISOString(),
      lastHeartbeatAt: now.toISOString(),
      leaseExpiresAt: new Date(now.getTime() + this.leaseMs).toISOString()
    };
    this.leased.set(task.id, lease);
    this.delta("task_leased", now, `leased task ${task.id}`, { taskId: task.id, runId: task.runId });
    return lease;
  }

  heartbeatLease(taskId: string, workerId: string, now = new Date()): SchedulerRuntimeDelta {
    const lease = this.leased.get(taskId);
    if (!lease) return this.delta("task_failed", now, `heartbeat rejected for missing lease ${taskId}`, { taskId });
    if (lease.workerId !== workerId) return this.delta("task_failed", now, `heartbeat rejected for non-owner worker ${workerId}`, { taskId, runId: lease.task.runId });
    this.leased.set(taskId, {
      ...lease,
      lastHeartbeatAt: now.toISOString(),
      leaseExpiresAt: new Date(now.getTime() + this.leaseMs).toISOString()
    });
    return this.delta("worker_heartbeat", now, `heartbeat for task ${taskId}`, { taskId, runId: lease.task.runId });
  }

  checkpointTask(taskId: string, workerId: string, checkpoint: SchedulerTaskCheckpoint, now = new Date()): SchedulerRuntimeDelta {
    const lease = this.leased.get(taskId);
    if (!lease) return this.delta("task_failed", now, `checkpoint rejected for missing lease ${taskId}`, { taskId });
    if (lease.workerId !== workerId) return this.delta("task_failed", now, `checkpoint rejected for non-owner worker ${workerId}`, { taskId, runId: lease.task.runId });
    this.leased.set(taskId, {
      ...lease,
      lastHeartbeatAt: now.toISOString(),
      leaseExpiresAt: new Date(now.getTime() + this.leaseMs).toISOString(),
      checkpointCursor: checkpoint.cursor,
      checkpointMessage: checkpoint.message,
      task: {
        ...lease.task,
        planning: lease.task.planning
          ? {
              ...lease.task.planning,
              reason: checkpoint.partialReason ?? lease.task.planning.reason
            }
          : lease.task.planning
      }
    });
    return this.delta("task_checkpointed", now, checkpoint.message, { taskId, runId: lease.task.runId });
  }

  acknowledge(taskId: string, status: SchedulerRuntimeAckStatus, now = new Date(), reason: string = status): SchedulerRuntimeDelta {
    const lease = this.leased.get(taskId);
    const queued = this.queued.get(taskId);
    const task = lease?.task ?? queued;
    if (!task) return this.delta("task_failed", now, `task ${taskId} was not queued or leased`);
    this.leased.delete(taskId);
    this.queued.delete(taskId);

    if (status === "completed") {
      this.completed.set(taskId, { ...task });
      return this.delta("task_completed", now, reason, { taskId, runId: task.runId });
    }

    if (status === "cancelled") {
      return this.delta("task_cancelled", now, reason, { taskId, runId: task.runId });
    }

    const retryCount = task.retryCount + 1;
    const maxRetries = task.maxRetries ?? 3;
    if (retryCount > maxRetries) {
      return this.delta("task_failed", now, `retry exhausted: ${reason}`, { taskId, runId: task.runId });
    }
    const retryAfterMs = this.retryBaseMs * 2 ** Math.max(0, retryCount - 1);
    const retryTask: CollectionTask = {
      ...task,
      retryCount,
      queuedAt: now.toISOString(),
      availableAt: new Date(now.getTime() + retryAfterMs).toISOString(),
      reason: `${task.reason}; retry ${retryCount}/${maxRetries}: ${reason}`
    };
    this.queued.set(taskId, retryTask);
    return this.delta("task_retry_scheduled", now, reason, { taskId, runId: task.runId });
  }

  cancelRun(runId: string, now = new Date(), reason = "run cancelled by scheduler"): SchedulerRuntimeDelta[] {
    const run = this.runById.get(runId);
    if (run) {
      this.runById.set(runId, {
        ...run,
        status: "cancelled",
        updatedAt: now.toISOString(),
        completedAt: now.toISOString(),
        error: reason
      });
    }
    const affected = [...this.queued.values(), ...this.leased.values()].map((leaseOrTask) => "task" in leaseOrTask ? leaseOrTask.task : leaseOrTask)
      .filter((task) => task.runId === runId);
    const deltas = affected.map((task) => this.acknowledge(task.id, "cancelled", now, reason));
    return [this.delta("run_cancelled", now, reason, { runId }), ...deltas];
  }

  findOrRegisterRun(run: CollectionRun, reuseKey = run.requestHash, now = new Date()): { run: CollectionRun; reused: boolean; duplicateReuseCount: number } {
    if (reuseKey) {
      const existingRunId = this.runIdByReuseKey.get(`${run.tenantId ?? "global"}:${reuseKey}`);
      const existing = existingRunId ? this.runById.get(existingRunId) : undefined;
      if (existing && (existing.status === "queued" || existing.status === "running")) {
        const key = `${run.tenantId ?? "global"}:${reuseKey}`;
        const duplicateReuseCount = (this.reuseCounts.get(key) ?? 0) + 1;
        this.reuseCounts.set(key, duplicateReuseCount);
        this.delta("run_reused", now, `reused active run ${existing.id}`, { runId: existing.id, reuseKey });
        return {
          run: existing,
          reused: true,
          duplicateReuseCount
        };
      }
    }

    this.runById.set(run.id, run);
    if (reuseKey) this.runIdByReuseKey.set(`${run.tenantId ?? "global"}:${reuseKey}`, run.id);
    this.delta("run_registered", now, `registered run ${run.id}`, { runId: run.id, reuseKey });
    return { run, reused: false, duplicateReuseCount: 0 };
  }

  gcActiveRuns(now = new Date(), options: Parameters<typeof activeRunGcDecisions>[2] = {}): ActiveRunGcDecision[] {
    return activeRunGcDecisions([...this.runById.values()], now, options);
  }

  pressure(now = new Date()): SchedulerPressureDto[] {
    const tasks = [...this.queued.values(), ...this.leased.values()].map((leaseOrTask) => "task" in leaseOrTask ? leaseOrTask.task : leaseOrTask);
    const groups = new Map<string, CollectionTask[]>();
    for (const task of tasks) {
      const key = `${workClassForTask(task)}:${fairnessGroupForTask(task)}`;
      groups.set(key, [...(groups.get(key) ?? []), task]);
    }
    return [...groups.values()].map((group): SchedulerPressureDto => {
      const representative = group[0];
      if (!representative) throw new Error("empty pressure group");
      const counts = taskDecisionCounts(group);
      const duplicateReuseCount = duplicateReuseCountForTask(representative, this.runById, this.reuseCounts);
      const nextActionable = group.map((task) => nextActionableAt(task, now)).filter((value): value is string => Boolean(value)).sort()[0];
      const pressureState: LiveSearchBackpressureState = group.some((task) => task.availableAt && Date.parse(task.availableAt) > now.getTime())
        ? "deferred_by_source_backoff"
        : tasks.length >= 1_000
          ? "deferred_by_queue_pressure"
          : "accepted";
      return {
        generatedAt: now.toISOString(),
        workClass: workClassForTask(representative),
        fairnessGroup: fairnessGroupForTask(representative),
        queueAgeSeconds: Math.max(...group.map((task) => queueAgeSeconds(task, now))),
        duplicateReuseCount,
        ...counts,
        retryAfterSeconds: retryAfterSecondsForTask(representative, now),
        nextActionableAt: nextActionable,
        pressureState
      };
    }).sort((a, b) => b.queueAgeSeconds - a.queueAgeSeconds);
  }

  deltasSince(cursor?: string): SchedulerRuntimeDelta[] {
    if (!cursor) return [...this.events];
    const index = this.events.findIndex((event) => event.cursor === cursor);
    return index < 0 ? [...this.events] : this.events.slice(index + 1);
  }

  runs(): CollectionRun[] {
    return [...this.runById.values()];
  }

  tasks(): CollectionTask[] {
    return [...this.queued.values(), ...this.leased.values()].map((item) => "task" in item ? item.task : item);
  }

  private requeueExpiredLeases(now: Date): void {
    for (const [taskId, lease] of this.leased.entries()) {
      if (Date.parse(lease.leaseExpiresAt) > now.getTime()) continue;
      this.leased.delete(taskId);
      this.queued.set(taskId, { ...lease.task, availableAt: now.toISOString(), reason: `${lease.task.reason}; lease expired` });
      this.delta("task_retry_scheduled", now, `lease expired for task ${taskId}`, { taskId, runId: lease.task.runId });
    }
  }

  private delta(
    kind: SchedulerRuntimeDelta["kind"],
    now: Date,
    message: string,
    ids: Pick<SchedulerRuntimeDelta, "taskId" | "runId" | "reuseKey"> = {}
  ): SchedulerRuntimeDelta {
    const event = {
      cursor: stableId("scheduler-delta", `${this.events.length}:${kind}:${ids.taskId ?? ""}:${ids.runId ?? ""}:${now.toISOString()}`),
      at: now.toISOString(),
      kind,
      ...ids,
      message
    };
    this.events.push(event);
    return event;
  }
}

export function detectSchedulerStarvation(
  tasks: CollectionTask[],
  now: Date,
  thresholds: Partial<Record<SchedulerWorkClass, number>> = {}
): SchedulerStarvationSignal[] {
  const groups = new Map<string, { task: CollectionTask; queued: number; maxAge: number }>();
  for (const task of tasks) {
    const workClass = workClassForTask(task);
    const key = `${workClass}:${fairnessGroupForTask(task)}`;
    const age = queueAgeSeconds(task, now);
    const existing = groups.get(key);
    if (!existing || age > existing.maxAge) groups.set(key, { task, queued: (existing?.queued ?? 0) + 1, maxAge: age });
    else existing.queued += 1;
  }

  return [...groups.values()]
    .map((group) => {
      const workClass = workClassForTask(group.task);
      const thresholdSeconds = thresholds[workClass] ?? defaultStarvationThresholdSeconds(workClass);
      return {
        workClass,
        fairnessGroup: fairnessGroupForTask(group.task),
        queued: group.queued,
        maxQueueAgeSeconds: group.maxAge,
        thresholdSeconds,
        recoveryAction: group.maxAge > thresholdSeconds ? recoveryActionFor(workClass) : "none"
      } satisfies SchedulerStarvationSignal;
    })
    .filter((signal) => signal.recoveryAction !== "none")
    .sort((a, b) => b.maxQueueAgeSeconds - a.maxQueueAgeSeconds);
}

export function activeRunGcDecisions(
  runs: CollectionRun[],
  now: Date,
  options: {
    staleActiveRunMs?: number;
    abandonedPollingMs?: number;
    completedDeltaHoldMs?: number;
    failedRetryDelayMs?: number;
    activePollingRunIds?: Set<string>;
    pendingDeltaRunIds?: Set<string>;
  } = {}
): ActiveRunGcDecision[] {
  const staleActiveRunMs = options.staleActiveRunMs ?? 30 * 60_000;
  const abandonedPollingMs = options.abandonedPollingMs ?? 15 * 60_000;
  const completedDeltaHoldMs = options.completedDeltaHoldMs ?? 10 * 60_000;
  const failedRetryDelayMs = options.failedRetryDelayMs ?? 5 * 60_000;
  return runs.map((run) => {
    const updatedAt = Date.parse(run.updatedAt);
    const ageMs = Number.isFinite(updatedAt) ? now.getTime() - updatedAt : Number.POSITIVE_INFINITY;
    if ((run.status === "queued" || run.status === "running") && ageMs >= staleActiveRunMs) {
      return {
        runId: run.id,
        status: run.status,
        action: "mark_stale_failed",
        reason: "active run exceeded stale lease window",
        nextActionableAt: now.toISOString()
      };
    }
    if ((run.status === "queued" || run.status === "running") && !options.activePollingRunIds?.has(run.id) && ageMs >= abandonedPollingMs) {
      return {
        runId: run.id,
        status: run.status,
        action: "mark_abandoned_cancelled",
        reason: "run has no active polling client inside abandonment window",
        nextActionableAt: now.toISOString()
      };
    }
    if (run.status === "failed" && ageMs >= failedRetryDelayMs) {
      return {
        runId: run.id,
        status: run.status,
        action: "retry_failed",
        reason: "failed run is past retry delay and can be requeued",
        nextActionableAt: now.toISOString()
      };
    }
    if (run.status === "completed" && options.pendingDeltaRunIds?.has(run.id)) {
      return {
        runId: run.id,
        status: run.status,
        action: "retain_completed_pending_deltas",
        reason: "completed run still has pending evidence deltas for polling clients",
        nextActionableAt: new Date(now.getTime() + completedDeltaHoldMs).toISOString()
      };
    }
    if (run.status === "completed" && ageMs >= completedDeltaHoldMs) {
      return {
        runId: run.id,
        status: run.status,
        action: "archive_completed",
        reason: "completed run passed delta hold window",
        nextActionableAt: now.toISOString()
      };
    }
    return {
      runId: run.id,
      status: run.status,
      action: "keep_active",
      reason: "run remains inside active or retention window"
    };
  });
}

function duplicateTaskCounts(tasks: CollectionTask[], runs: CollectionRun[]): Map<string, number> {
  const runByRequestId = new Map(runs.map((run) => [run.requestId, run]));
  const counts = new Map<string, number>();
  for (const task of tasks) {
    const key = duplicateKeyForTask(task, runByRequestId.get(task.intelRequestId ?? ""));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function duplicateKeyForTask(task: CollectionTask, run?: CollectionRun): string {
  return [
    task.tenantId ?? "global",
    run?.requestHash ?? task.intelRequestId ?? "no_request",
    task.sourceId,
    task.targetUrl
  ].join(":");
}

function pressureStateForTask(task: CollectionTask, summary: FrontierGroupSummary, now: Date): LiveSearchBackpressureState {
  const budget = task.crawlBudgetKey ? summary.budgets[task.crawlBudgetKey] : undefined;
  if (budget && (budget.expired || budget.tasksRemaining <= 0 || budget.bytesRemaining <= 0)) return "deferred_by_budget";
  if (task.availableAt && Date.parse(task.availableAt) > now.getTime()) return "deferred_by_source_backoff";
  if (summary.queued >= 1_000) return "deferred_by_queue_pressure";
  return "accepted";
}

function nextActionableAt(task: CollectionTask, now: Date): string | undefined {
  if (task.deadlineAt && Date.parse(task.deadlineAt) <= now.getTime()) return undefined;
  if (task.availableAt && Date.parse(task.availableAt) > now.getTime()) return task.availableAt;
  return now.toISOString();
}

function queueAgeSeconds(task: CollectionTask, now: Date): number {
  const queuedAt = Date.parse(task.queuedAt);
  if (!Number.isFinite(queuedAt)) return 0;
  return Math.max(0, Math.round((now.getTime() - queuedAt) / 1000));
}

function fairnessGroupForTask(task: CollectionTask): string {
  return task.fairnessKey ?? `${task.tenantId ?? "global"}:${task.intelRequestId ?? "none"}:${task.sourceType}`;
}

function workClassForTask(task: CollectionTask): SchedulerWorkClass {
  const fairnessKey = task.fairnessKey?.toLowerCase() ?? "";
  if (fairnessKey.includes("retention") || fairnessKey.includes("replay")) return "replay_retention";
  return task.planning?.budgetClass ?? "background_refresh";
}

function taskDecisionCounts(tasks: CollectionTask[]): Pick<SchedulerDiagnosticItem, "selectedTaskCount" | "skippedTaskCount" | "blockedTaskCount"> {
  const statusCounts = new Map<PlannerDecisionStatus | "selected", number>();
  for (const task of tasks) {
    const status = task.planning?.decision ?? "selected";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }
  return {
    selectedTaskCount: (statusCounts.get("selected") ?? 0) + (statusCounts.get("delayed") ?? 0) + (statusCounts.get("waiting-for-backoff") ?? 0),
    skippedTaskCount: (statusCounts.get("skipped") ?? 0) + (statusCounts.get("duplicate-suppressed") ?? 0) + (statusCounts.get("stale-cache-used") ?? 0),
    blockedTaskCount: (statusCounts.get("blocked-by-policy") ?? 0) + (statusCounts.get("blocked-by-approval") ?? 0)
  };
}

function retryAfterSecondsForTask(task: CollectionTask, now: Date): number | undefined {
  if (!task.availableAt) return undefined;
  const availableAt = Date.parse(task.availableAt);
  if (!Number.isFinite(availableAt) || availableAt <= now.getTime()) return undefined;
  return Math.ceil((availableAt - now.getTime()) / 1000);
}

function duplicateReuseCountForTask(task: CollectionTask, runs: Map<string, CollectionRun>, reuseCounts: Map<string, number>): number {
  const run = task.runId ? runs.get(task.runId) : [...runs.values()].find((candidate) => candidate.requestId === task.intelRequestId);
  if (!run?.requestHash) return 0;
  return reuseCounts.get(`${run.tenantId ?? "global"}:${run.requestHash}`) ?? 0;
}

function pressureDtosForTasks(tasks: CollectionTask[], runs: CollectionRun[], now: Date): SchedulerPressureDto[] {
  const groups = new Map<string, CollectionTask[]>();
  for (const task of tasks) {
    const key = `${workClassForTask(task)}:${fairnessGroupForTask(task)}`;
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }
  const runByRequestId = new Map(runs.map((run) => [run.requestId, run]));
  const duplicateCounts = duplicateTaskCounts(tasks, runs);
  return [...groups.values()]
    .map((group) => {
      const representative = group[0];
      if (!representative) throw new Error("empty pressure group");
      const run = representative.runId
        ? runs.find((candidate) => candidate.id === representative.runId)
        : runByRequestId.get(representative.intelRequestId ?? "");
      const counts = taskDecisionCounts(group);
      const nextActionable = group.map((task) => nextActionableAt(task, now)).filter((value): value is string => Boolean(value)).sort()[0];
      const pressureState: LiveSearchBackpressureState = group.some((task) => task.availableAt && Date.parse(task.availableAt) > now.getTime())
        ? "deferred_by_source_backoff"
        : tasks.length >= 1_000
          ? "deferred_by_queue_pressure"
          : "accepted";
      return {
        generatedAt: now.toISOString(),
        workClass: workClassForTask(representative),
        fairnessGroup: fairnessGroupForTask(representative),
        queueAgeSeconds: Math.max(...group.map((task) => queueAgeSeconds(task, now))),
        duplicateReuseCount: Math.max(0, (duplicateCounts.get(duplicateKeyForTask(representative, run)) ?? 1) - 1),
        ...counts,
        retryAfterSeconds: retryAfterSecondsForTask(representative, now),
        nextActionableAt: nextActionable,
        pressureState
      };
    })
    .sort((a, b) => b.queueAgeSeconds - a.queueAgeSeconds);
}

function promotionGateFor(input: {
  tasks: CollectionTask[];
  deadLetters: FrontierAck[];
  reconciliation: SchedulerReconciliationReport;
  activeRuns: CollectionRun[];
  reusableRuns: number;
  now: Date;
}): SchedulerPromotionGate {
  const taskCount = Math.max(1, input.tasks.length);
  const deadLetterRate = input.deadLetters.length / taskCount;
  const lowPriorityDeferrals = input.reconciliation.reasonCounts.low_priority_deferred ?? 0;
  const retryDebt = input.tasks.filter((task) =>
    task.retryCount > 0 || Boolean(task.availableAt && Date.parse(task.availableAt) > input.now.getTime())
  ).length + input.deadLetters.length;
  const duplicateReuseRate = input.activeRuns.length ? input.reusableRuns / input.activeRuns.length : 0;
  const abandonedRunCount = input.reconciliation.reasonCounts.abandoned_run ?? 0;
  const p95QueueAgeSeconds = percentile(input.tasks.map((task) => queueAgeSeconds(task, input.now)), 0.95);
  const lowPriorityDeferralRate = lowPriorityDeferrals / taskCount;
  const emergencyBrakeState: SchedulerPromotionGate["emergencyBrakeState"] =
    deadLetterRate > 0.1 || abandonedRunCount > 5 || p95QueueAgeSeconds > 3_600
      ? "engaged"
      : deadLetterRate > 0.03 || abandonedRunCount > 0 || lowPriorityDeferralRate > 0.25
        ? "armed"
        : "clear";
  return {
    p95QueueAgeSeconds,
    abandonedRunCount,
    duplicateReuseRate,
    retryDebt,
    deadLetterRate,
    lowPriorityDeferralRate,
    emergencyBrakeState
  };
}

function repairPlanFor(reconciliation: SchedulerReconciliationReport, now: Date): SchedulerRepairPlanStep[] {
  return reconciliation.repairRecommendations.map((recommendation) => ({
    id: stableId("scheduler-repair", `${recommendation.action}:${recommendation.reasonCodes.join(",")}:${now.toISOString()}`),
    action: recommendation.action,
    reasonCodes: recommendation.reasonCodes,
    affectedCount: recommendation.count,
    applyMode: "dry_run",
    description: repairDescription(recommendation.action)
  }));
}

function repairDescription(action: SchedulerRepairAction): string {
  switch (action) {
    case "release_expired_leases":
      return "Release expired leases and make eligible tasks visible to workers again.";
    case "cancel_abandoned_runs":
      return "Cancel abandoned active runs so later live-search polls can attach to fresh work.";
    case "requeue_transient_failures":
      return "Requeue transient scheduler gaps and approved idle sources without changing source approval state.";
    case "quarantine_permanently_failing_sources":
      return "Recommend source quarantine for repeated permanent failures; do not collect until reviewed.";
    case "delay_low_priority_sweeps":
      return "Delay low-priority sweeps while live search, public-channel, metadata, and replay work drain.";
    case "pause_noisy_source_queues":
      return "Pause noisy source queues that dominate scheduler capacity until headroom recovers.";
    case "trigger_emergency_brake":
      return "Engage the scheduler emergency brake to protect API, frontend, and database headroom while preserving cursors and replay state.";
    case "no_action":
      return "No operator repair is required.";
  }
}

function applyStepForRepair(input: {
  action: SchedulerRepairAction;
  affectedCount: number;
  reasonCodes: SchedulerReconciliationReasonCode[];
  now: Date;
  sourceIds?: string[];
}): SchedulerApplyPlanStep {
  return {
    id: stableId("scheduler-apply", `${input.action}:${input.reasonCodes.join(",")}:${input.sourceIds?.join(",") ?? ""}:${input.now.toISOString()}`),
    action: input.action,
    dryRun: true,
    affectedCount: input.affectedCount,
    reasonCodes: [...new Set(input.reasonCodes)].sort(),
    riskClass: riskClassForApplyAction(input.action),
    approval: approvalForApplyAction(input.action),
    operatorApprovalRequired: approvalForApplyAction(input.action) !== "automation_safe",
    preconditions: preconditionsForApplyAction(input.action),
    expectedDelta: expectedDeltaForApplyAction(input.action, input.affectedCount),
    rollbackNotes: rollbackNotesForApplyAction(input.action),
    apiWarningCode: apiWarningForApplyAction(input.action),
    sourceIds: input.sourceIds?.sort()
  };
}

function schedulerApplyApiItem(step: SchedulerApplyPlanStep): SchedulerApplyPlanApiItemDto {
  return {
    stepId: step.id,
    action: step.action,
    dryRun: true,
    execution: step.approval,
    riskClass: step.riskClass,
    operatorApprovalRequired: step.operatorApprovalRequired,
    affectedCount: step.affectedCount,
    reasonCodes: step.reasonCodes,
    preconditions: step.preconditions,
    expectedQueueRunDelta: step.expectedDelta,
    rollback: step.rollbackNotes,
    apiWarningCode: step.apiWarningCode,
    sourceIds: step.sourceIds
  };
}

function schedulerApplyExecutionPreview(items: SchedulerApplyPlanApiItemDto[]): SchedulerApplyPlanExecutionPreview {
  return {
    dryRun: true,
    willMutate: false,
    willLeaseTasks: false,
    willAcknowledgeTasks: false,
    willChangeRuns: false,
    steps: items.map((item) => ({
      stepId: item.stepId,
      action: item.action,
      wouldApply: false,
      reason: item.execution === "blocked"
        ? "Blocked action remains unapplied; no scheduler state changes are attempted."
        : "Dry-run execution preview only; no scheduler mutation is performed."
    }))
  };
}

function schedulerApplyPlanCanaryControlPlane(items: SchedulerApplyPlanApiItemDto[]): SchedulerApplyPlanApiResponseDto["canaryControlPlane"] {
  const controls = items.map((item) => ({
    action: canaryActionForRepair(item.action),
    expectedQueueRunDelta: item.expectedQueueRunDelta,
    warningCode: item.apiWarningCode,
    rollback: item.rollback
  }));
  return {
    dryRun: true,
    willMutate: false,
    routeField: "applyPlan.canaryControlPlane",
    controls,
    cursorReplayState: "preserved"
  };
}

function canaryActionForRepair(action: SchedulerRepairAction): SchedulerCanaryControlAction {
  if (action === "trigger_emergency_brake" || action === "quarantine_permanently_failing_sources") return "rollback";
  if (action === "pause_noisy_source_queues" || action === "delay_low_priority_sweeps") return "pause";
  if (action === "release_expired_leases" || action === "cancel_abandoned_runs") return "drain";
  return "start";
}

function schedulerApplyPlanApiExamples(): SchedulerApplyPlanApiExample[] {
  return [
    schedulerApplyPlanApiExample("expired_lease_release", "release_expired_leases"),
    schedulerApplyPlanApiExample("abandoned_run_cancel", "cancel_abandoned_runs"),
    schedulerApplyPlanApiExample("transient_requeue", "requeue_transient_failures"),
    schedulerApplyPlanApiExample("low_priority_deferral", "delay_low_priority_sweeps"),
    schedulerApplyPlanApiExample("noisy_source_pause", "pause_noisy_source_queues"),
    schedulerApplyPlanApiExample("quarantine_recommendation", "quarantine_permanently_failing_sources"),
    schedulerApplyPlanApiExample("emergency_brake", "trigger_emergency_brake")
  ];
}

function schedulerApplyPlanApiExample(
  name: SchedulerApplyPlanApiExample["name"],
  action: Exclude<SchedulerRepairAction, "no_action">
): SchedulerApplyPlanApiExample {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const step = applyStepForRepair({
    action,
    affectedCount: action === "trigger_emergency_brake" ? 250 : 3,
    reasonCodes: exampleReasonCodesForApplyAction(action),
    now,
    sourceIds: action === "pause_noisy_source_queues" || action === "quarantine_permanently_failing_sources" ? ["src_example_noisy"] : undefined
  });
  const item = schedulerApplyApiItem(step);
  return {
    name,
    description: `${action} schema-ready dry-run example for the scheduler apply-plan contract.`,
    request: {
      dryRun: true,
      scenario: `${name}_example`,
      selectedActions: [action],
      includeExecutionPreview: true
    },
    response: {
      apiVersion: "v1",
      endpoint: "/v1/frontier/apply-plan",
      dryRun: true,
      willMutate: false,
      willLeaseTasks: false,
      willAcknowledgeTasks: false,
      willChangeRuns: false,
      item
    }
  };
}

function exampleReasonCodesForApplyAction(action: SchedulerRepairAction): SchedulerReconciliationReasonCode[] {
  switch (action) {
    case "release_expired_leases":
      return ["leased_task"];
    case "cancel_abandoned_runs":
      return ["abandoned_run"];
    case "requeue_transient_failures":
      return ["approved_not_scheduled"];
    case "delay_low_priority_sweeps":
    case "pause_noisy_source_queues":
    case "trigger_emergency_brake":
      return ["queue_pressure"];
    case "quarantine_permanently_failing_sources":
      return ["dead_letter"];
    case "no_action":
      return [];
  }
}

function highestRiskClass(risks: SchedulerApplyRiskClass[]): SchedulerApplyRiskClass {
  if (risks.includes("emergency")) return "emergency";
  if (risks.includes("high")) return "high";
  if (risks.includes("medium")) return "medium";
  return "low";
}

function riskClassForApplyAction(action: SchedulerRepairAction): SchedulerApplyRiskClass {
  switch (action) {
    case "release_expired_leases":
    case "requeue_transient_failures":
      return "low";
    case "delay_low_priority_sweeps":
    case "pause_noisy_source_queues":
      return "medium";
    case "cancel_abandoned_runs":
    case "quarantine_permanently_failing_sources":
      return "high";
    case "trigger_emergency_brake":
      return "emergency";
    case "no_action":
      return "low";
  }
}

function approvalForApplyAction(action: SchedulerRepairAction): SchedulerApplyApproval {
  switch (action) {
    case "release_expired_leases":
    case "requeue_transient_failures":
    case "delay_low_priority_sweeps":
      return "automation_safe";
    case "cancel_abandoned_runs":
    case "pause_noisy_source_queues":
    case "quarantine_permanently_failing_sources":
      return "human_approval_required";
    case "trigger_emergency_brake":
      return "rollback_only";
    case "no_action":
      return "automation_safe";
  }
}

function preconditionsForApplyAction(action: SchedulerRepairAction): string[] {
  switch (action) {
    case "release_expired_leases":
      return ["lease expiry is earlier than scheduler now", "worker heartbeat is absent or older than the lease grace period", "task policy and source approval remain valid"];
    case "cancel_abandoned_runs":
      return ["run is queued or running", "last poll/update exceeds the abandonment threshold", "cursor deltas have been persisted before cancellation"];
    case "requeue_transient_failures":
      return ["retry budget remains", "failure category is transient", "next available time is not in the future"];
    case "quarantine_permanently_failing_sources":
      return ["source has repeated permanent failures", "replacement coverage exists or operator accepts the coverage gap", "governance audit note is attached"];
    case "delay_low_priority_sweeps":
      return ["queue pressure or live-search deferral is present", "affected work is not interactive", "deadlines remain inside crawl budget policy"];
    case "pause_noisy_source_queues":
      return ["one source dominates queued work", "source pause will not drop cursor state", "Agent 09 can surface a source-paused warning"];
    case "trigger_emergency_brake":
      return ["promotion gate is engaged", "API p95 queue age or retry/dead-letter pressure breaches the emergency threshold", "cursor and replay state are durable before worker throttling"];
    case "no_action":
      return ["no scheduler repair is pending"];
  }
}

function expectedDeltaForApplyAction(action: SchedulerRepairAction, affectedCount: number): SchedulerApplyExpectedDelta {
  const base: SchedulerApplyExpectedDelta = {
    queuedVisibleDelta: 0,
    leasedDelta: 0,
    activeRunDelta: 0,
    deadLetterDelta: 0,
    delayedTaskDelta: 0,
    pausedSourceQueueDelta: 0,
    workerSlotDelta: 0,
    cursorReplayState: "preserved"
  };
  switch (action) {
    case "release_expired_leases":
      return { ...base, queuedVisibleDelta: affectedCount, leasedDelta: -affectedCount, workerSlotDelta: affectedCount };
    case "cancel_abandoned_runs":
      return { ...base, activeRunDelta: -affectedCount };
    case "requeue_transient_failures":
      return { ...base, queuedVisibleDelta: affectedCount, deadLetterDelta: -affectedCount };
    case "quarantine_permanently_failing_sources":
      return { ...base, delayedTaskDelta: affectedCount, pausedSourceQueueDelta: affectedCount };
    case "delay_low_priority_sweeps":
      return { ...base, queuedVisibleDelta: -affectedCount, delayedTaskDelta: affectedCount, workerSlotDelta: affectedCount };
    case "pause_noisy_source_queues":
      return { ...base, queuedVisibleDelta: -affectedCount, delayedTaskDelta: affectedCount, pausedSourceQueueDelta: affectedCount };
    case "trigger_emergency_brake":
      return { ...base, queuedVisibleDelta: -affectedCount, delayedTaskDelta: affectedCount, workerSlotDelta: affectedCount };
    case "no_action":
      return base;
  }
}

function rollbackNotesForApplyAction(action: SchedulerRepairAction): string {
  switch (action) {
    case "release_expired_leases":
      return "Rollback by restoring the previous lease row only if the original worker heartbeat returns before another worker leases the task.";
    case "cancel_abandoned_runs":
      return "Rollback by creating a new run with the same reuse key and cursor watermark; do not resurrect the cancelled run id.";
    case "requeue_transient_failures":
      return "Rollback by returning the task to retry backoff with its original attempt count and next available time.";
    case "quarantine_permanently_failing_sources":
      return "Rollback requires source restore approval and a fresh health probe before queueing resumes.";
    case "delay_low_priority_sweeps":
      return "Rollback by clearing the delay marker after interactive queue age and worker utilization recover.";
    case "pause_noisy_source_queues":
      return "Rollback by resuming the source queue from the last cursor watermark; no replay cursor is discarded.";
    case "trigger_emergency_brake":
      return "Rollback by downgrading to armed, then clear, after API p95 queue age, DB utilization, worker utilization, and retry debt stay below threshold for one soak window.";
    case "no_action":
      return "No rollback is required.";
  }
}

function apiWarningForApplyAction(action: SchedulerRepairAction): string | undefined {
  switch (action) {
    case "release_expired_leases":
      return "scheduler_lease_released";
    case "cancel_abandoned_runs":
      return "scheduler_run_cancel_pending";
    case "requeue_transient_failures":
      return "scheduler_retry_requeued";
    case "quarantine_permanently_failing_sources":
      return "scheduler_source_quarantine_pending";
    case "delay_low_priority_sweeps":
      return "scheduler_low_priority_delayed";
    case "pause_noisy_source_queues":
      return "scheduler_source_queue_paused";
    case "trigger_emergency_brake":
      return "scheduler_emergency_brake";
    case "no_action":
      return undefined;
  }
}

function noisySourceQueues(tasks: CollectionTask[]): string[] {
  if (tasks.length < 20) return [];
  const counts = new Map<string, number>();
  for (const task of tasks) counts.set(task.sourceId, (counts.get(task.sourceId) ?? 0) + 1);
  const threshold = Math.max(20, Math.ceil(tasks.length * 0.4));
  return [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([sourceId]) => sourceId);
}

function sourceIdsForRepair(action: SchedulerRepairAction, reconciliation: SchedulerReconciliationReport, fallbackSourceIds: string[]): string[] | undefined {
  if (action === "pause_noisy_source_queues") return fallbackSourceIds;
  if (action !== "quarantine_permanently_failing_sources") return undefined;
  const sourceIds = reconciliation.diagnostics
    .filter((item) => item.repairAction === action && item.sourceId)
    .map((item) => item.sourceId as string);
  return sourceIds.length > 0 ? [...new Set(sourceIds)].sort() : undefined;
}

function emergencyBrakePolicyFor(input: {
  gate: SchedulerPromotionGate;
  hostMemoryMb?: number;
  dbConnectionUtilization?: number;
  workerUtilization?: number;
  maxApiP95QueueAgeSeconds?: number;
}): SchedulerEmergencyBrakePolicy {
  const hostMemoryMb = input.hostMemoryMb ?? 1_048_576;
  const maxSchedulerMemoryMb = Math.min(98_304, Math.floor(hostMemoryMb * 0.1));
  const maxDbConnectionUtilization = 0.8;
  const maxWorkerUtilization = 0.85;
  const maxApiP95QueueAgeSeconds = input.maxApiP95QueueAgeSeconds ?? 120;
  const pressureWarnings = [
    ...(input.gate.p95QueueAgeSeconds > maxApiP95QueueAgeSeconds ? ["scheduler_queue_age_high"] : []),
    ...((input.dbConnectionUtilization ?? 0) > maxDbConnectionUtilization ? ["scheduler_db_headroom_low"] : []),
    ...((input.workerUtilization ?? 0) > maxWorkerUtilization ? ["scheduler_worker_headroom_low"] : []),
    ...(input.gate.retryDebt > 0 ? ["scheduler_retry_debt_present"] : []),
    ...(input.gate.deadLetterRate > 0 ? ["scheduler_dead_letters_present"] : [])
  ];
  return {
    state: input.gate.emergencyBrakeState,
    apiMode: input.gate.emergencyBrakeState === "engaged" ? "shed_new_live_search" : input.gate.emergencyBrakeState === "armed" ? "warning_headers" : "normal",
    frontendMode: input.gate.emergencyBrakeState === "engaged" ? "disable_new_live_search" : input.gate.emergencyBrakeState === "armed" ? "show_degraded_banner" : "normal",
    dbMode: input.gate.emergencyBrakeState === "engaged" ? "protect_connections" : input.gate.emergencyBrakeState === "armed" ? "read_mostly" : "normal",
    workerMode: input.gate.emergencyBrakeState === "engaged" ? "pause_noninteractive" : input.gate.emergencyBrakeState === "armed" ? "pause_low_priority" : "normal",
    preservesCursorReplayState: true,
    protectedHeadroom: {
      hostMemoryMb,
      maxSchedulerMemoryMb,
      maxDbConnectionUtilization,
      maxWorkerUtilization,
      maxApiP95QueueAgeSeconds
    },
    warnings: [...new Set(pressureWarnings)].sort()
  };
}

function sumExpectedDeltas(deltas: SchedulerApplyExpectedDelta[]): SchedulerApplyExpectedDelta {
  return deltas.reduce<SchedulerApplyExpectedDelta>((total, delta) => ({
    queuedVisibleDelta: total.queuedVisibleDelta + delta.queuedVisibleDelta,
    leasedDelta: total.leasedDelta + delta.leasedDelta,
    activeRunDelta: total.activeRunDelta + delta.activeRunDelta,
    deadLetterDelta: total.deadLetterDelta + delta.deadLetterDelta,
    delayedTaskDelta: total.delayedTaskDelta + delta.delayedTaskDelta,
    pausedSourceQueueDelta: total.pausedSourceQueueDelta + delta.pausedSourceQueueDelta,
    workerSlotDelta: total.workerSlotDelta + delta.workerSlotDelta,
    cursorReplayState: "preserved"
  }), {
    queuedVisibleDelta: 0,
    leasedDelta: 0,
    activeRunDelta: 0,
    deadLetterDelta: 0,
    delayedTaskDelta: 0,
    pausedSourceQueueDelta: 0,
    workerSlotDelta: 0,
    cursorReplayState: "preserved"
  });
}

function applyActionOrder(action: SchedulerRepairAction): number {
  switch (action) {
    case "trigger_emergency_brake":
      return 0;
    case "release_expired_leases":
      return 1;
    case "cancel_abandoned_runs":
      return 2;
    case "requeue_transient_failures":
      return 3;
    case "delay_low_priority_sweeps":
      return 4;
    case "pause_noisy_source_queues":
      return 5;
    case "quarantine_permanently_failing_sources":
      return 6;
    case "no_action":
      return 7;
  }
}

function countTasksByWorkClass(tasks: CollectionTask[], workClass: SchedulerWorkClass): number {
  return tasks.filter((task) => workClassForTask(task) === workClass).length;
}

function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return sorted[index] ?? 0;
}

function clampRate(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function reconciliationItem(
  now: Date,
  subjectType: SchedulerReconciliationItem["subjectType"],
  subjectId: string,
  reasonCode: SchedulerReconciliationReasonCode,
  severity: SchedulerReconciliationItem["severity"],
  detail: string,
  repairAction: SchedulerRepairAction,
  ids: Pick<SchedulerReconciliationItem, "sourceId" | "runId" | "nextActionableAt"> = {}
): SchedulerReconciliationItem {
  return {
    id: stableId("scheduler-reconcile", `${subjectType}:${subjectId}:${reasonCode}:${now.toISOString()}`),
    subjectType,
    subjectId,
    reasonCode,
    severity,
    detail,
    repairAction,
    ...ids
  };
}

function repairRecommendationsFor(items: SchedulerReconciliationItem[]): SchedulerReconciliationReport["repairRecommendations"] {
  const grouped = new Map<SchedulerRepairAction, SchedulerReconciliationReasonCode[]>();
  for (const item of items) {
    if (item.repairAction === "no_action") continue;
    grouped.set(item.repairAction, [...(grouped.get(item.repairAction) ?? []), item.reasonCode]);
  }
  return [...grouped.entries()]
    .map(([action, reasonCodes]) => ({
      action,
      count: reasonCodes.length,
      reasonCodes: [...new Set(reasonCodes)].sort()
    }))
    .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action));
}

function defaultStarvationThresholdSeconds(workClass: SchedulerWorkClass): number {
  switch (workClass) {
    case "interactive_live_search":
      return 90;
    case "interactive_search":
      return 120;
    case "analyst_deep_dive":
      return 300;
    case "source_health_probe":
      return 600;
    case "restricted_darknet_metadata_sweep":
      return 900;
    case "replay_retention":
      return 1_800;
    case "broad_daily_sweep":
      return 3_600;
    case "background_refresh":
      return 1_800;
  }
}

function recoveryActionFor(workClass: SchedulerWorkClass): SchedulerStarvationSignal["recoveryAction"] {
  switch (workClass) {
    case "interactive_live_search":
    case "interactive_search":
      return "raise_priority";
    case "analyst_deep_dive":
    case "source_health_probe":
    case "restricted_darknet_metadata_sweep":
    case "replay_retention":
      return "reserve_worker_slot";
    case "background_refresh":
    case "broad_daily_sweep":
      return "split_queue_partition";
  }
}

function runtimePriority(task: CollectionTask): number {
  switch (workClassForTask(task)) {
    case "interactive_live_search":
      return task.priority + 0.12;
    case "analyst_deep_dive":
      return task.priority + 0.1;
    case "source_health_probe":
      return task.priority + 0.08;
    case "replay_retention":
      return task.priority + 0.07;
    case "restricted_darknet_metadata_sweep":
      return task.priority + 0.04;
    case "interactive_search":
      return task.priority + 0.03;
    case "background_refresh":
    case "broad_daily_sweep":
      return task.priority;
  }
}
