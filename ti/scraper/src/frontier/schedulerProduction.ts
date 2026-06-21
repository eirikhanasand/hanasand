import type { FocusedFrontier, FrontierAck, FrontierGroupSummary, QueuedFrontierItem } from "./frontier.ts";
import type { CollectionPlan, CollectionRun, CollectionTask, LiveSearchBackpressureState, PlannerDecisionStatus, PlanningBudgetClass, RunStatus, SourceRecord } from "../types.ts";
import { stableId } from "../utils.ts";
import type {
  ActiveRunGcAction,
  ActiveRunGcDecision,
  ActiveRunGcOptions,
  FairnessSimulationInput,
  FairnessSimulationResult,
  SchedulerApplyApproval,
  SchedulerApplyExpectedDelta,
  SchedulerApplyPlanApiContractDto,
  SchedulerApplyPlanApiExample,
  SchedulerApplyPlanApiItemDto,
  SchedulerApplyPlanApiRequestDto,
  SchedulerApplyPlanApiResponseDto,
  SchedulerApplyPlanExecutionPreview,
  SchedulerApplyPlanReport,
  SchedulerApplyPlanStep,
  SchedulerApplyRiskClass,
  SchedulerBackend,
  SchedulerBackendCutoverPacket,
  SchedulerBackendMigrationPacket,
  SchedulerBackpressureSummary,
  SchedulerCanaryControlAction,
  SchedulerCanaryControlPlaneDto,
  SchedulerCanaryControlPlaneStep,
  SchedulerCapacityShiftPlanStep,
  SchedulerCutoverDesign,
  SchedulerCutoverRehearsalReport,
  SchedulerDeadLetterCauseTelemetry,
  SchedulerDiagnosticItem,
  SchedulerDiagnostics,
  SchedulerDurableBackendContract,
  SchedulerDurableBackendKind,
  SchedulerDurableBackendReadinessDto,
  SchedulerDurableFairnessLane,
  SchedulerEmergencyBrakePolicy,
  SchedulerExecutionSimulationResult,
  SchedulerExecutionSloFields,
  SchedulerExecutionSloThresholds,
  SchedulerExecutionTraffic,
  SchedulerFreshnessQueryClass,
  SchedulerDailyActorRunPlanDto,
  SchedulerFreshnessSloDashboardActor,
  SchedulerFreshnessSloDashboardDto,
  SchedulerFreshnessSloEngineDto,
  SchedulerFairnessGovernanceDto,
  SchedulerInteractiveSearchFreshnessDto,
  SchedulerLease,
  SchedulerLeaseSoakScenarioName,
  SchedulerLiveRunDrainAction,
  SchedulerLiveRunDrainStep,
  SchedulerLoadModelFixture,
  SchedulerPollingContract,
  SchedulerProductionLeaseSemanticsDto,
  SchedulerPersistenceReplayCutoverDto,
  SchedulerPostgresQueueAdapterReadinessDto,
  SchedulerPressureDto,
  SchedulerProductionAdapterContract,
  SchedulerProductionAdapterImplementation,
  SchedulerProductionAdapterTelemetryDto,
  SchedulerPromotionGate,
  SchedulerQueueBackendCandidate,
  SchedulerQueueEconomicsDto,
  SchedulerQueueRepository,
  SchedulerReconciliationItem,
  SchedulerReconciliationReasonCode,
  SchedulerReconciliationReport,
  SchedulerReleaseGateFinding,
  SchedulerReleaseGateReason,
  SchedulerReleaseGateSeverity,
  SchedulerRepairAction,
  SchedulerRepairPlanStep,
  SchedulerRuntimeAckStatus,
  SchedulerRuntimeControlAction,
  SchedulerRuntimeDelta,
  SchedulerRuntimeExecutionControl,
  SchedulerRuntimeExecutionDto,
  SchedulerRuntimeSlaDto,
  SchedulerRuntimeSlaMetric,
  SchedulerRuntimeSlaState,
  SchedulerSlaEnforcementDto,
  SchedulerSourceCadenceHint,
  SchedulerSourceGapEnqueueRehearsalOptions,
  SchedulerSourceGapEnqueueRehearsalReceipt,
  SchedulerSourceGapWorkerEntryOptions,
  SchedulerSourceGapWorkerEntryReceipt,
  SchedulerSourceGapWorkerLoopOptions,
  SchedulerSourceGapWorkerLoopReceipt,
  SchedulerSourceGapWorkerPartition,
  SchedulerSourceGapWorkerRunnerOptions,
  SchedulerSourceGapWorkerRunnerReceipt,
  SchedulerSoakEvaluation,
  SchedulerSoakScenario,
  SchedulerSoakTelemetryFixture,
  SchedulerSoakTelemetryScenario,
  SchedulerStarvationSignal,
  SchedulerTaskCheckpoint,
  SchedulerWorkClass,
  SchedulerWorkerLoopContract,
  SchedulerWorkerLoopContractStep,
  SchedulerWorkerLoopStepName,
  SchedulerWorkerLeaseSoakHarnessDto,
  SchedulerWorkerPartitionSoakSlo,
  SchedulerWorkerQueueCutoverDto,
  SchedulerWorkerQueuePartition,
  SchedulerWorkerRuntimeFixture,
  SchedulerWorkerSafetyPlan,
  SchedulerWorkerSoakMigrationDto,
  SchedulerWorkerWorkload
} from "./schedulerProductionTypes.ts";

export type {
  ActiveRunGcAction,
  ActiveRunGcDecision,
  ActiveRunGcOptions,
  FairnessSimulationInput,
  FairnessSimulationResult,
  SchedulerApplyApproval,
  SchedulerApplyExpectedDelta,
  SchedulerApplyPlanApiContractDto,
  SchedulerApplyPlanApiExample,
  SchedulerApplyPlanApiItemDto,
  SchedulerApplyPlanApiRequestDto,
  SchedulerApplyPlanApiResponseDto,
  SchedulerApplyPlanExecutionPreview,
  SchedulerApplyPlanReport,
  SchedulerApplyPlanStep,
  SchedulerApplyRiskClass,
  SchedulerBackend,
  SchedulerBackendCutoverPacket,
  SchedulerBackendMigrationPacket,
  SchedulerBackpressureSummary,
  SchedulerCanaryControlAction,
  SchedulerCanaryControlPlaneDto,
  SchedulerCanaryControlPlaneStep,
  SchedulerCapacityShiftPlanStep,
  SchedulerCutoverDesign,
  SchedulerCutoverRehearsalReport,
  SchedulerDeadLetterCauseTelemetry,
  SchedulerDiagnosticItem,
  SchedulerDiagnostics,
  SchedulerDurableBackendContract,
  SchedulerDurableBackendKind,
  SchedulerDurableBackendReadinessDto,
  SchedulerDurableFairnessLane,
  SchedulerEmergencyBrakePolicy,
  SchedulerExecutionSimulationResult,
  SchedulerExecutionSloFields,
  SchedulerExecutionSloThresholds,
  SchedulerExecutionTraffic,
  SchedulerFreshnessQueryClass,
  SchedulerDailyActorRunPlanDto,
  SchedulerFreshnessSloDashboardActor,
  SchedulerFreshnessSloDashboardDto,
  SchedulerFreshnessSloEngineDto,
  SchedulerFairnessGovernanceDto,
  SchedulerInteractiveSearchFreshnessDto,
  SchedulerLease,
  SchedulerLeaseSoakScenarioName,
  SchedulerLiveRunDrainAction,
  SchedulerLiveRunDrainStep,
  SchedulerLoadModelFixture,
  SchedulerPollingContract,
  SchedulerProductionLeaseSemanticsDto,
  SchedulerPersistenceReplayCutoverDto,
  SchedulerPostgresQueueAdapterReadinessDto,
  SchedulerPressureDto,
  SchedulerProductionAdapterContract,
  SchedulerProductionAdapterImplementation,
  SchedulerProductionAdapterTelemetryDto,
  SchedulerPromotionGate,
  SchedulerQueueBackendCandidate,
  SchedulerQueueEconomicsDto,
  SchedulerQueueRepository,
  SchedulerReconciliationItem,
  SchedulerReconciliationReasonCode,
  SchedulerReconciliationReport,
  SchedulerReleaseGateFinding,
  SchedulerReleaseGateReason,
  SchedulerReleaseGateSeverity,
  SchedulerRepairAction,
  SchedulerRepairPlanStep,
  SchedulerRuntimeAckStatus,
  SchedulerRuntimeControlAction,
  SchedulerRuntimeDelta,
  SchedulerRuntimeExecutionControl,
  SchedulerRuntimeExecutionDto,
  SchedulerRuntimeSlaDto,
  SchedulerRuntimeSlaMetric,
  SchedulerRuntimeSlaState,
  SchedulerSlaEnforcementDto,
  SchedulerSourceCadenceHint,
  SchedulerSourceGapWorkerEntryOptions,
  SchedulerSourceGapWorkerEntryReceipt,
  SchedulerSourceGapWorkerLoopOptions,
  SchedulerSourceGapWorkerLoopReceipt,
  SchedulerSourceGapWorkerPartition,
  SchedulerSourceGapWorkerRunnerOptions,
  SchedulerSourceGapWorkerRunnerReceipt,
  SchedulerSoakEvaluation,
  SchedulerSoakScenario,
  SchedulerSoakTelemetryFixture,
  SchedulerSoakTelemetryScenario,
  SchedulerStarvationSignal,
  SchedulerTaskCheckpoint,
  SchedulerWorkClass,
  SchedulerWorkerLoopContract,
  SchedulerWorkerLoopContractStep,
  SchedulerWorkerLoopStepName,
  SchedulerWorkerLeaseSoakHarnessDto,
  SchedulerWorkerPartitionSoakSlo,
  SchedulerWorkerQueueCutoverDto,
  SchedulerWorkerQueuePartition,
  SchedulerWorkerRuntimeFixture,
  SchedulerWorkerSafetyPlan,
  SchedulerWorkerSoakMigrationDto,
  SchedulerWorkerWorkload
} from "./schedulerProductionTypes.ts";

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
    maxQueueAgeSeconds: schedulerLoadFixtureQueueAges(liveSearchPollers)
  }));
}

function schedulerLoadFixtureQueueAges(liveSearchPollers: number): Record<SchedulerWorkClass, number> {
  return Object.fromEntries([
    ["interactive_live_search", liveSearchPollers >= 1_000 ? 90 : 45],
    ["interactive_search", 120],
    ["analyst_deep_dive", 300],
    ["public_channel_probe", 240],
    ["public_channel_window", 180],
    ["background_refresh", 1_800],
    ["broad_daily_sweep", 3_600],
    ["source_health_probe", 600],
    ["restricted_darknet_metadata_sweep", 900],
    ["replay_retention", 1_800]
  ]) as Record<SchedulerWorkClass, number>;
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

export function buildSchedulerWorkerLeaseSoakHarness(input: {
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  runtimeSla: SchedulerRuntimeSlaDto;
  workerQueueCutover: SchedulerWorkerQueueCutoverDto;
  workerSoakMigration: SchedulerWorkerSoakMigrationDto;
  now?: Date;
}): SchedulerWorkerLeaseSoakHarnessDto {
  const now = input.now ?? new Date();
  const workerCount = Math.max(32, input.workerQueueCutover.capacityEnvelope.workerSlots);
  const totalTasks = 10_000;
  const scenarioSpecs: Array<{
    scenario: SchedulerLeaseSoakScenarioName;
    workload: SchedulerWorkerWorkload;
    taskCount: number;
    deadlineSeconds: number;
    pressure: LiveSearchBackpressureState;
    fairnessGroup: string;
  }> = [
    { scenario: "apt29_actor_burst", workload: "interactive_actor_search", taskCount: 2_200, deadlineSeconds: 45, pressure: "accepted", fairnessGroup: "tenant:actor:apt29:clear_web" },
    { scenario: "public_channel_fanout", workload: "public_channel_window", taskCount: 1_700, deadlineSeconds: 180, pressure: "deferred_by_queue_pressure", fairnessGroup: "tenant:public_channel:apt29" },
    { scenario: "restricted_metadata_holds", workload: "restricted_metadata_approval", taskCount: 1_200, deadlineSeconds: 900, pressure: "blocked_by_policy", fairnessGroup: "tenant:restricted_metadata:held" },
    { scenario: "evidence_replay_backlog", workload: "evidence_replay", taskCount: 1_400, deadlineSeconds: 600, pressure: "deferred_by_budget", fairnessGroup: "tenant:evidence:replay" },
    { scenario: "graph_export_wave", workload: "graph_export", taskCount: 900, deadlineSeconds: 720, pressure: "deferred_by_budget", fairnessGroup: "tenant:graph:export" },
    { scenario: "source_outage_wave", workload: "health_probe", taskCount: 1_000, deadlineSeconds: 300, pressure: "deferred_by_source_backoff", fairnessGroup: "tenant:source_health:outage" },
    { scenario: "parser_failure_storm", workload: "scheduled_source_sweep", taskCount: 900, deadlineSeconds: 420, pressure: "deferred_by_source_backoff", fairnessGroup: "tenant:parser:failure" },
    { scenario: "low_value_sweep_pressure", workload: "retention", taskCount: 700, deadlineSeconds: 1_800, pressure: "deferred_by_budget", fairnessGroup: "tenant:retention:low_value" }
  ];
  const partitionsByWorkload = new Map(input.workerQueueCutover.partitions.map((partition) => [partition.workload, partition]));
  const fallbackPartition = input.workerQueueCutover.partitions[0];
  const workloadSlices = scenarioSpecs.map((spec) => {
    const partition = partitionsByWorkload.get(spec.workload) ?? fallbackPartition;
    const partitionSlo = input.workerSoakMigration.partitionSlo.find((row) => row.workload === spec.workload);
    const retryBudget = Math.max(1, Math.ceil(spec.taskCount * (spec.scenario === "parser_failure_storm" ? 0.05 : 0.018)));
    const deadLetterBudget = Math.max(1, Math.ceil(spec.taskCount * (spec.scenario === "parser_failure_storm" ? 0.012 : 0.003)));
    return {
      scenario: spec.scenario,
      workload: spec.workload,
      taskCount: spec.taskCount,
      workerPartitionId: partition?.id ?? "partition_unknown",
      leaseAttempts: spec.taskCount + retryBudget,
      expectedCompletions: Math.max(0, spec.taskCount - deadLetterBudget),
      retryBudget,
      deadLetterBudget,
      requestDeadlineSeconds: spec.deadlineSeconds,
      queueAgeP95Seconds: Math.min(spec.deadlineSeconds, partitionSlo?.queueAgeP95Seconds ?? input.queueEconomics.totals.maxQueuedAgeSeconds),
      expectedPressure: spec.pressure,
      fairnessGroup: spec.fairnessGroup
    };
  });
  const workerPartitions = input.workerQueueCutover.partitions.map((partition) => {
    const estimatedTasks = workloadSlices
      .filter((slice) => slice.workload === partition.workload)
      .reduce((sum, slice) => sum + slice.taskCount, 0);
    const workerShare = Math.max(1, Math.round(workerCount * partition.reservedWorkerSlots / Math.max(1, input.workerQueueCutover.capacityEnvelope.workerSlots)));
    return {
      partitionId: partition.id,
      workload: partition.workload,
      workerCount: workerShare,
      maxConcurrentLeases: partition.maxConcurrentLeases,
      leaseTtlSeconds: partition.leaseTtlSeconds,
      checkpointEverySeconds: partition.checkpointEverySeconds,
      maxQueueAgeSeconds: partition.maxQueueAgeSeconds,
      estimatedTasks,
      expectedDrainedWithinMinutes: Math.max(1, Math.ceil(estimatedTasks / Math.max(1, partition.maxConcurrentLeases) * (partition.checkpointEverySeconds / 60))),
      concurrencyPolicy: partition.workload === "restricted_metadata_approval" ? "held_for_review" as const : partition.workload === "interactive_actor_search" ? "reserved_capacity" as const : "bounded_shared_capacity" as const,
      backpressurePolicy: partition.backpressurePolicy,
      drainBehavior: partition.drainBehavior
    };
  });
  const workloadShares = workerPartitions.map((partition) => ({
    workload: partition.workload,
    taskShare: Number((partition.estimatedTasks / totalTasks).toFixed(4)),
    reservedWorkerSlots: partition.workerCount,
    maxQueueAgeSeconds: partition.maxQueueAgeSeconds
  }));
  const worstShare = workloadShares.reduce((worst, share) => share.taskShare > 0 ? Math.min(worst, share.taskShare) : worst, 1);
  const queueHold = input.queueEconomics.totals.maxQueuedAgeSeconds > 900;
  const retryHold = input.queueEconomics.totals.retryDebt > 500 || input.runtimeExecution.totals.retried > 500;
  const deadLetterHold = input.queueEconomics.totals.deadLetters > 80 || input.runtimeExecution.totals.deadLettered > 80;
  const decision: SchedulerWorkerLeaseSoakHarnessDto["releaseGate"]["decision"] = deadLetterHold
    ? "rollback"
    : queueHold || retryHold || input.runtimeSla.state === "breach"
      ? "hold"
      : "pass";
  const reasons = [
    ...(queueHold ? ["queue_age_over_10k_replay_threshold"] : []),
    ...(retryHold ? ["retry_debt_over_10k_replay_threshold"] : []),
    ...(deadLetterHold ? ["dead_letter_over_10k_replay_threshold"] : []),
    ...(decision === "pass" ? ["10k_replay_budget_within_scheduler_lane"] : [])
  ];
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/search.scheduler", "/v1/contracts", "agent10_capacity_release_gate"],
    dryRun: true,
    willMutate: false,
    replay: {
      fixtureName: "agent02_10k_multi_worker_lease_replay",
      totalTasks,
      durationHours: 24,
      workerCount,
      simulatedTenants: 12,
      simulatedSources: 160,
      duplicateRunReuseRequired: true,
      cursorReplayRequired: true,
      restrictedMetadataPolicy: "metadata_only_approval_hold"
    },
    workloadSlices,
    workerPartitions,
    leaseSemantics: {
      exclusiveLeases: true,
      heartbeatExpiryRecovery: "retry_with_checkpoint_cursor",
      retryBackoff: "deterministic_exponential_with_jitter",
      deadLetters: "operator_visible_isolated_lane",
      requestDeadlines: "deadline_checked_before_lease_and_before_ack",
      perSourceConcurrency: "never_bypassed_by_priority_aging"
    },
    fairnessProof: {
      dimensions: ["tenant", "query_class", "source_family", "workload", "restricted_policy_state"],
      worstShare: Number(worstShare.toFixed(4)),
      ok: worstShare >= 0.05 && decision !== "rollback",
      priorityAgingEverySeconds: Math.min(...input.workerQueueCutover.partitions.map((partition) => Math.max(30, Math.floor(partition.maxQueueAgeSeconds / 4)))),
      lowValueSweepsDeferred: true,
      publicPollingProtected: true,
      workloadShares
    },
    pressureFixtures: [
      { scenario: "apt29_actor_burst", trigger: "actor_burst", expectedSchedulerAction: "reuse_active_run", agent09VisibleStatus: "attached_to_active_run", agent10ReleaseImpact: "none" },
      { scenario: "public_channel_fanout", trigger: "fanout", expectedSchedulerAction: "reserve_interactive_capacity", agent09VisibleStatus: "deferred_by_queue_pressure", agent10ReleaseImpact: "watch" },
      { scenario: "restricted_metadata_holds", trigger: "approval_hold", expectedSchedulerAction: "hold_restricted_metadata", agent09VisibleStatus: "blocked_by_policy", agent10ReleaseImpact: "watch" },
      { scenario: "evidence_replay_backlog", trigger: "replay_backlog", expectedSchedulerAction: "drain_replay", agent09VisibleStatus: "deferred_by_budget", agent10ReleaseImpact: "none" },
      { scenario: "graph_export_wave", trigger: "export_wave", expectedSchedulerAction: "drain_graph_export", agent09VisibleStatus: "deferred_by_budget", agent10ReleaseImpact: "none" },
      { scenario: "source_outage_wave", trigger: "source_outage", expectedSchedulerAction: "source_backoff", agent09VisibleStatus: "deferred_by_source_backoff", agent10ReleaseImpact: "hold" },
      { scenario: "parser_failure_storm", trigger: "parser_failure", expectedSchedulerAction: "retry_then_dead_letter", agent09VisibleStatus: "deferred_by_source_backoff", agent10ReleaseImpact: "hold" },
      { scenario: "low_value_sweep_pressure", trigger: "capacity_pressure", expectedSchedulerAction: "defer_low_value_sweeps", agent09VisibleStatus: "deferred_by_budget", agent10ReleaseImpact: "none" }
    ],
    routeContracts: {
      frontierStatusField: "scheduler.workerLeaseSoakHarness",
      frontierApplyPlanField: "applyPlan.workerLeaseSoakHarness",
      searchSchedulerField: "scheduler.workerLeaseSoakHarness",
      contractsField: "surfaces.frontier.contracts.worker_lease_soak_harness"
    },
    releaseGate: {
      decision,
      reasons,
      proofCommands: [
        "bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts",
        "bun run check",
        "bun run check:route-inventory",
        "bun run check:contract-index",
        "bun run check:api-regression"
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

export function buildSchedulerDurableBackendReadiness(input: {
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  runtimeSla: SchedulerRuntimeSlaDto;
  slaEnforcement: SchedulerSlaEnforcementDto;
  workerQueueCutover: SchedulerWorkerQueueCutoverDto;
  workerSoakMigration: SchedulerWorkerSoakMigrationDto;
  productionAdapterTelemetry: SchedulerProductionAdapterTelemetryDto;
  canaryControlPlane: SchedulerCanaryControlPlaneDto;
  now?: Date;
}): SchedulerDurableBackendReadinessDto {
  const now = input.now ?? new Date();
  const runReuseRatio = input.runtimeSla.metrics.find((metric) => metric.name === "run_reuse")?.value ?? input.workerSoakMigration.aggregate.runReuseRatio;
  const duplicatePublicPollingRatio = input.workerSoakMigration.aggregate.duplicatePublicPollingRatio;
  const emergencyBrakeState: SchedulerDurableBackendReadinessDto["emergencyBrake"]["state"] =
    input.slaEnforcement.state === "rollback" || input.workerSoakMigration.aggregate.state === "rollback" || input.canaryControlPlane.agent10ReleaseDecision.decision === "rollback"
      ? "engaged"
      : input.slaEnforcement.state === "hold" || input.workerSoakMigration.aggregate.state === "hold" || input.canaryControlPlane.agent10ReleaseDecision.decision === "hold"
        ? "armed"
        : "clear";
  const drainState: SchedulerDurableBackendReadinessDto["drainPlan"]["state"] =
    input.productionAdapterTelemetry.telemetry.drainProgress.some((item) => item.state === "blocked")
      ? "blocked"
      : input.productionAdapterTelemetry.telemetry.drainProgress.some((item) => item.state === "in_progress")
        ? "in_progress"
        : input.productionAdapterTelemetry.telemetry.drainProgress.some((item) => item.state === "planned")
          ? "planned"
          : "not_needed";
  const releaseDecision: SchedulerDurableBackendReadinessDto["releaseGate"]["decision"] =
    emergencyBrakeState === "engaged" ? "rollback" : emergencyBrakeState === "armed" || drainState === "blocked" ? "hold" : "pass";
  const releaseReasons = uniqueStrings([
    input.slaEnforcement.state,
    input.workerSoakMigration.aggregate.state,
    input.canaryControlPlane.agent10ReleaseDecision.decision,
    ...(input.queueEconomics.totals.retryDebt > input.workerSoakMigration.aggregate.retryDebtThreshold ? ["retry_debt_over_budget"] : []),
    ...(input.queueEconomics.totals.deadLetters > input.workerSoakMigration.aggregate.deadLetterBudget ? ["dead_letters_over_budget"] : []),
    ...(input.runtimeExecution.pollingDeltas.cursorContinuity === "waiting_for_deltas" ? ["cursor_waiting_for_delta_replay"] : [])
  ]).filter((reason) => !["pass", "canary-ready"].includes(reason));
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/search.scheduler", "/v1/contracts", "agent09_public_wrapper", "agent10_release_train"],
    dryRun: true,
    willMutate: false,
    backendContracts: buildDurableBackendContracts(input.productionAdapterTelemetry),
    fairnessLanes: input.workerQueueCutover.partitions.map(buildDurableFairnessLane),
    semanticInvariants: [
      "fairness and per-source concurrency are evaluated before leases are granted",
      "retry and dead-letter transitions preserve source, tenant, run, and cursor lineage",
      "3-second public polling hints never enqueue duplicate work when an active reuse key exists",
      "public wrapper cursors advance only after replayable scheduler deltas exist",
      "dry-run cutover, canary, drain, and rollback packets never mutate queue state",
      "restricted metadata lanes remain metadata-only and approval-gated across every backend"
    ],
    pollingContract: {
      nextPollSeconds: 3 as const,
      cursorContinuity: input.runtimeExecution.pollingDeltas.cursorContinuity === "waiting_for_deltas" ? "waiting_for_deltas" : "preserved",
      publicWrapperCursorSemantics: "stable_since_cursor_with_delta_replay"
    },
    runReuse: {
      contract: "duplicate_public_polling_attaches_to_active_run",
      activeRunReuseRatio: Number(clampRate(runReuseRatio).toFixed(3)),
      duplicatePublicPollingRatio: Number(clampRate(duplicatePublicPollingRatio).toFixed(3))
    },
    drainPlan: {
      state: drainState,
      preservesCursorReplayState: true,
      actions: Array.from(new Set(input.workerQueueCutover.partitions.map((partition) => partition.drainBehavior))),
      abandonClientPolicy: "cancel_or_reuse_without_losing_run_cursor"
    },
    emergencyBrake: {
      state: emergencyBrakeState,
      preservesCursorReplayState: true,
      releaseCriteria: [
        "queue age p99 is back under every affected partition budget",
        "retry debt and dead-letter growth are below release thresholds",
        "cursor replay state is preserved for public polling and active runs",
        "restricted metadata approvals remain isolated from clear-web fanout"
      ]
    },
    releaseGate: {
      decision: releaseDecision,
      reasons: releaseReasons.length > 0 ? releaseReasons : ["all_scheduler_backend_readiness_gates_clear"],
      proofCommands: [
        "bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts",
        "bun run check",
        "bun run check:route-inventory",
        "bun run check:frontier-apply-plan",
        "bun run rehearse:cutover examples/cutover-rehearsal-pass.json",
        "bun run plan:cutover examples/cutover-rehearsal-pass.json"
      ]
    },
    routeContracts: {
      frontierStatusField: "scheduler.durableBackendReadiness",
      frontierApplyPlanField: "applyPlan.durableBackendReadiness",
      searchSchedulerField: "scheduler.durableBackendReadiness",
      contractsField: "surfaces.frontier.contracts.durable_backend_readiness"
    }
  };
}

export function buildSchedulerFreshnessSloEngine(input: {
  plan: CollectionPlan;
  sources?: SourceRecord[];
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  slaEnforcement: SchedulerSlaEnforcementDto;
  workerQueueCutover: SchedulerWorkerQueueCutoverDto;
  durableBackendReadiness: SchedulerDurableBackendReadinessDto;
  now?: Date;
}): SchedulerFreshnessSloEngineDto {
  const now = input.now ?? new Date();
  const queryClass = schedulerFreshnessQueryClass(input.plan);
  const profile = freshnessProfileForQueryClass(queryClass);
  const analystPriority = analystPriorityScore(input.plan.request.priority);
  const sourceById = new Map((input.sources ?? []).map((source) => [source.id, source]));
  const tasks = [...input.plan.tasks, ...input.plan.reviewRequired];
  const sourceCadenceHints = tasks.length > 0
    ? tasks.map((task) => sourceCadenceHintForTask({
      task,
      source: sourceById.get(task.sourceId),
      queryClass,
      profile,
      analystPriority,
      queueEconomics: input.queueEconomics,
      slaEnforcement: input.slaEnforcement,
      now
    }))
    : [];
  const pressureState: SchedulerFreshnessSloEngineDto["queuePressureBehavior"]["state"] =
    input.slaEnforcement.state === "rollback" || input.durableBackendReadiness.emergencyBrake.state === "engaged"
      ? "emergency_brake"
      : input.slaEnforcement.state === "warning" || input.slaEnforcement.state === "hold" || input.queueEconomics.totals.retryDebt > 0
        ? "degraded"
        : "normal";
  const recommendedCadenceSeconds = sourceCadenceHints.length > 0
    ? Math.round(sourceCadenceHints.reduce((sum, hint) => sum + hint.recommendedCadenceSeconds, 0) / sourceCadenceHints.length)
    : profile.targetFreshnessSeconds;
  const retryAfterSeconds = pressureState === "emergency_brake"
    ? Math.min(300, profile.targetFreshnessSeconds)
    : pressureState === "degraded"
      ? Math.max(3, Math.min(60, Math.round(recommendedCadenceSeconds / 8)))
      : 3;
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/intel/search.scheduler", "/v1/frontier/status", "/v1/intel/runs/{id}", "/v1/contracts", "agent10_slo_runbooks"],
    dryRun: true,
    willMutate: false,
    queryClass,
    slo: {
      targetFreshnessSeconds: profile.targetFreshnessSeconds,
      staleAfterSeconds: profile.staleAfterSeconds,
      emergencyStaleAfterSeconds: profile.emergencyStaleAfterSeconds,
      maxQueueAgeSeconds: profile.maxQueueAgeSeconds
    },
    cadence: {
      minCadenceSeconds: profile.minCadenceSeconds,
      recommendedCadenceSeconds,
      maxCadenceSeconds: profile.maxCadenceSeconds,
      analystPriority,
      sourceHintCount: sourceCadenceHints.length
    },
    sourceCadenceHints,
    queuePressureBehavior: {
      state: pressureState,
      retryAfterSeconds,
      preservesThreeSecondPolling: true,
      duplicateRunReuse: "required" as const,
      cursorContinuity: input.runtimeExecution.pollingDeltas.cursorContinuity === "waiting_for_deltas" ? "waiting_for_deltas" : "preserved",
      degradeActions: freshnessDegradeActions(pressureState)
    },
    fairnessAging: input.workerQueueCutover.partitions.map((partition) => ({
      workload: partition.workload,
      agingBoostEverySeconds: Math.max(30, Math.round(Math.min(partition.maxQueueAgeSeconds, profile.maxQueueAgeSeconds) / 6)),
      maxBoost: Number(Math.min(0.35, analystPriority * 0.2 + 0.1).toFixed(3)),
      preservesPerSourceConcurrency: true
    })),
    handoffs: {
      agent01SourceGovernance: ["source reliability and legal/governance state influence cadence but never silently activate sources"],
      agent04PublicCoverage: ["coverage gaps and public advisory/source-family hints can raise cadence for stale high-value classes"],
      agent06EvidenceYield: ["evidence yield feeds cadence hints and dead-letter review without exposing raw captures"],
      agent07ActorFreshness: ["actor freshness, contradiction, and stale-answer gates can request higher priority aging"],
      agent09ApiPolling: ["3-second polling semantics and duplicate run reuse stay stable under queue pressure"],
      agent10Runbooks: ["emergency brake, retry-after, and drain states are route-visible for SLO runbooks"]
    },
    routeContracts: {
      frontierStatusField: "scheduler.freshnessSloEngine",
      searchSchedulerField: "scheduler.freshnessSloEngine",
      runStatusField: "scheduler.freshnessSloEngine",
      contractsField: "surfaces.frontier.contracts.freshness_slo_engine"
    }
  };
}

export function buildSchedulerFreshnessSloDashboard(input: {
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  slaEnforcement: SchedulerSlaEnforcementDto;
  workerQueueCutover: SchedulerWorkerQueueCutoverDto;
  freshnessSloEngine: SchedulerFreshnessSloEngineDto;
  workerLeaseSoakHarness?: SchedulerWorkerLeaseSoakHarnessDto;
  now?: Date;
}): SchedulerFreshnessSloDashboardDto {
  const now = input.now ?? new Date();
  const baseQueueAge = input.queueEconomics.totals.maxQueuedAgeSeconds;
  const sourceOutagePressure = input.workerLeaseSoakHarness?.pressureFixtures.some((fixture) => fixture.scenario === "source_outage_wave") ?? false;
  const actorProfiles: Array<{
    actor: SchedulerFreshnessSloDashboardActor["actor"];
    priority: SchedulerFreshnessSloDashboardActor["priority"];
    queryClass: SchedulerFreshnessSloDashboardActor["queryClass"];
    multiplier: number;
    partition: SchedulerWorkerWorkload;
  }> = [
    { actor: "APT29", priority: "daily", queryClass: "actor", multiplier: 0.78, partition: "interactive_actor_search" },
    { actor: "APT42", priority: "daily", queryClass: "actor", multiplier: 0.86, partition: "interactive_actor_search" },
    { actor: "Sandworm", priority: "daily", queryClass: "actor", multiplier: 1.08, partition: "interactive_actor_search" },
    { actor: "Volt Typhoon", priority: "daily", queryClass: "actor", multiplier: 0.94, partition: "public_channel_window" },
    { actor: "Lazarus", priority: "weekly", queryClass: "actor", multiplier: 1.22, partition: "scheduled_source_sweep" },
    { actor: "Scattered Spider", priority: "weekly", queryClass: "actor", multiplier: 0.72, partition: "public_channel_window" },
    { actor: "LockBit", priority: "weekly", queryClass: "ransomware", multiplier: 1.36, partition: "restricted_metadata_approval" },
    { actor: "Akira", priority: "weekly", queryClass: "ransomware", multiplier: 1.52, partition: "restricted_metadata_approval" }
  ];
  const targetByPriority = (priority: SchedulerFreshnessSloDashboardActor["priority"]) =>
    priority === "daily"
      ? input.freshnessSloEngine.slo.targetFreshnessSeconds
      : Math.max(input.freshnessSloEngine.slo.targetFreshnessSeconds * 3, 7 * 24 * 3600);
  const actors: SchedulerFreshnessSloDashboardActor[] = actorProfiles.map((profile, index) => {
    const targetFreshnessSeconds = targetByPriority(profile.priority);
    const observedFreshnessSeconds = Math.round(targetFreshnessSeconds * profile.multiplier + baseQueueAge * (index + 1) / 8);
    const retryDebt = profile.actor === "LockBit" || profile.actor === "Akira"
      ? Math.max(0, Math.ceil(input.queueEconomics.totals.retryDebt / 3))
      : Math.max(0, Math.floor(input.queueEconomics.totals.retryDebt / 8));
    const deadLetters = profile.partition === "restricted_metadata_approval"
      ? Math.max(0, Math.ceil(input.queueEconomics.totals.deadLetters / 2))
      : Math.max(0, Math.floor(input.queueEconomics.totals.deadLetters / 10));
    const queueAgeSeconds = Math.max(0, Math.round(baseQueueAge * profile.multiplier));
    const pressureState = input.freshnessSloEngine.queuePressureBehavior.state;
    const state: SchedulerFreshnessSloDashboardActor["state"] = pressureState === "emergency_brake"
      ? "blocked"
      : deadLetters > 0 && profile.partition === "restricted_metadata_approval"
        ? "blocked"
        : observedFreshnessSeconds >= targetFreshnessSeconds * 1.25 || queueAgeSeconds > input.freshnessSloEngine.slo.maxQueueAgeSeconds
          ? "stale"
          : observedFreshnessSeconds >= targetFreshnessSeconds * 0.9 || retryDebt > 0
            ? "aging"
            : "fresh";
    const schedulerAction: SchedulerFreshnessSloDashboardActor["schedulerAction"] = state === "blocked"
      ? profile.partition === "restricted_metadata_approval" ? "hold_for_review" : "emergency_brake"
      : state === "stale"
        ? "raise_priority"
        : state === "aging"
          ? "collect_now"
          : profile.partition === "public_channel_window"
            ? "reuse_active_run"
            : "defer_low_value_work";
    return {
      actor: profile.actor,
      priority: profile.priority,
      queryClass: profile.queryClass,
      state,
      targetFreshnessSeconds,
      observedFreshnessSeconds,
      queueAgeSeconds,
      retryDebt,
      deadLetters,
      nextPollSeconds: 3 as const,
      duplicateRunReuse: "required" as const,
      schedulerAction,
      workerPartition: profile.partition,
      cadenceReason: sourceOutagePressure && state !== "fresh"
        ? `${freshnessDashboardCadenceReason(state, profile.partition)}; soak harness covers source-outage pressure`
        : freshnessDashboardCadenceReason(state, profile.partition)
    };
  });
  const staleCount = actors.filter((actor) => actor.state === "stale").length;
  const blockedCount = actors.filter((actor) => actor.state === "blocked").length;
  const decision: SchedulerFreshnessSloDashboardDto["releaseGate"]["decision"] = input.freshnessSloEngine.queuePressureBehavior.state === "emergency_brake" || blockedCount >= 3
    ? "rollback"
    : staleCount > 0 || blockedCount > 0 || input.slaEnforcement.state === "hold"
      ? "hold"
      : "pass";
  const actionForWorkload = (workload: SchedulerWorkerWorkload): SchedulerFreshnessSloDashboardDto["workloadActions"][number]["action"] => {
    if (actors.some((actor) => actor.workerPartition === workload && actor.state === "blocked")) return workload === "restricted_metadata_approval" ? "hold_restricted_metadata" : "dead_letter_review";
    if (actors.some((actor) => actor.workerPartition === workload && actor.state === "stale")) return "raise_priority_aging";
    if (workload === "retention" || workload === "scheduled_source_sweep" || workload === "graph_export") return "drain_background";
    if (workload === "interactive_actor_search" || workload === "public_channel_window") return "reserve_capacity";
    return "no_action";
  };
  const workloadActions = input.workerQueueCutover.partitions.map((partition) => ({
    workload: partition.workload,
    action: actionForWorkload(partition.workload),
    reason: freshnessDashboardWorkloadReason(actionForWorkload(partition.workload)),
    reservedWorkerSlots: partition.reservedWorkerSlots,
    maxQueueAgeSeconds: partition.maxQueueAgeSeconds
  }));
  const reasons = [
    ...(staleCount > 0 ? ["high_priority_actor_freshness_stale"] : []),
    ...(blockedCount > 0 ? ["high_priority_actor_freshness_blocked"] : []),
    ...(input.queueEconomics.totals.retryDebt > 0 ? ["retry_debt_visible_on_dashboard"] : []),
    ...(input.queueEconomics.totals.deadLetters > 0 ? ["dead_letters_visible_on_dashboard"] : []),
    ...(decision === "pass" ? ["high_priority_actor_freshness_within_slo"] : [])
  ];
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/frontier/status", "/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/contracts", "agent10_slo_dashboard"],
    dryRun: true,
    willMutate: false,
    schemaVersion: "ti.scheduler_freshness_slo_dashboard.v1",
    summary: {
      actorCount: actors.length,
      staleCount,
      blockedCount,
      dailyDueCount: actors.filter((actor) => actor.priority === "daily" && actor.state !== "fresh").length,
      weeklyDueCount: actors.filter((actor) => actor.priority === "weekly" && actor.state !== "fresh").length,
      queueAgeP95Seconds: input.queueEconomics.totals.maxQueuedAgeSeconds,
      retryDebt: input.queueEconomics.totals.retryDebt,
      deadLetters: input.queueEconomics.totals.deadLetters,
      publicPollingProtected: true
    },
    actors,
    workloadActions,
    runbook: {
      publicApiBehavior: "return_status_with_three_second_polling",
      duplicateRunReuse: "required_before_enqueue",
      lowValueSweeps: "defer_before_actor_starvation",
      restrictedMetadata: "metadata_only_holds_do_not_block_clear_web",
      emergencyBrake: "pause_new_leases_preserve_cursors"
    },
    routeContracts: {
      frontierStatusField: "scheduler.freshnessSloDashboard",
      searchSchedulerField: "scheduler.freshnessSloDashboard",
      runStatusField: "scheduler.freshnessSloDashboard",
      contractsField: "surfaces.frontier.contracts.scheduler_freshness_slo_dashboard"
    },
    releaseGate: {
      decision,
      reasons,
      proofCommands: [
        "bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts",
        "bun run check",
        "bun run check:route-inventory",
        "bun run check:contract-index",
        "bun run check:api-regression"
      ]
    }
  };
}

export function buildSchedulerDailyActorRunPlan(input: {
  freshnessSloDashboard: SchedulerFreshnessSloDashboardDto;
  queueEconomics: SchedulerQueueEconomicsDto;
  workerQueueCutover: SchedulerWorkerQueueCutoverDto;
  now?: Date;
}): SchedulerDailyActorRunPlanDto {
  const now = input.now ?? new Date();
  const actorByName = new Map(input.freshnessSloDashboard.actors.map((actor) => [actor.actor.toLowerCase(), actor]));
  const defaultQueries = [
    "APT29", "APT28", "APT42", "Lazarus Group", "Volt Typhoon",
    "Salt Typhoon", "Turla", "Sandworm", "Kimsuky", "MuddyWater",
    "Charming Kitten", "Scattered Spider", "LockBit", "Clop", "Akira",
    "Black Basta", "Play", "RansomHub", "ALPHV", "Hunters International",
    "Qilin", "Medusa", "BianLian", "DragonForce", "INC Ransom",
    "8Base", "Royal", "BlackSuit", "Rhysida", "Everest",
    "KillSec", "Cactus", "Lynx", "SafePay", "FunkSec",
    "BlackByte", "Snatch", "Stormous", "REvil", "Conti",
    "Maze", "DarkSide", "Babuk", "Hive", "DoppelPaymer",
    "Cuba", "Ragnar Locker", "NoEscape", "Dark Angels", "Lorenz",
    "FIN7", "FIN8", "FIN11", "Evil Corp", "TA505",
    "APT41", "APT40", "APT31", "APT27", "APT10",
    "Mustang Panda", "Earth Estries", "UNC3886", "Flax Typhoon", "Bronze Starlight",
    "APT37", "APT43", "APT33", "APT34", "APT35",
    "APT36", "APT38", "APT39", "Transparent Tribe", "SideWinder",
    "Bitter", "Confucius", "Patchwork", "DoNot Team", "Gamaredon",
    "OilRig", "BlueNoroff", "Andariel", "TA410",
    "TA416", "TA428", "TA459", "TA551", "TA558",
    "TA577", "TA570", "TA866", "TA2541", "Carbanak",
    "Cobalt Group", "Lapsus$", "Storm-0501", "Storm-0978", "Storm-1811",
    "Raspberry Robin"
  ];
  const commercialBlockers = new Set(["APT29", "APT28", "APT42"]);
  const publicChannelFocus = new Set(["APT42", "Charming Kitten", "Scattered Spider", "Volt Typhoon", "Salt Typhoon"]);
  const darkMetadataFocus = new Set(["LockBit", "Clop", "Akira", "Black Basta", "Play", "RansomHub", "ALPHV", "Hunters International"]);
  const expectedRows = Math.max(80, defaultQueries.length * 5);
  const staleDashboardActors = input.freshnessSloDashboard.actors.filter((actor) => actor.state === "stale" || actor.state === "blocked");
  const usefulRowTarget = Math.max(50, Math.round(expectedRows * 0.55));
  const freshRowTarget = Math.max(42, Math.round(expectedRows * 0.48));
  const estimatedUsefulRows = Math.max(1, usefulRowTarget - Math.min(10, staleDashboardActors.length * 3));
  const estimatedRows = expectedRows;
  const formatMoney = (value: number): number => Number(value.toFixed(6));
  const estimatedGrossRevenueUsd = formatMoney((estimatedRows / 1000) * 3);
  const estimatedAfterApifyMarginUsd = formatMoney(estimatedGrossRevenueUsd * 0.8);
  const estimatedSchedulerCostUsd = formatMoney(0.00005 + estimatedRows * 0.000002 + input.queueEconomics.totals.retryDebt * 0.00001);
  const estimatedCostPerUsefulRowUsd = formatMoney(estimatedSchedulerCostUsd / estimatedUsefulRows);
  const latestPaidRowDecisionCounts: SchedulerDailyActorRunPlanDto["latestProofRun"]["paidRowDecisionCounts"] = {
    sellable: 0,
    includedWithCaveat: 7,
    coverageGapOnly: 2,
    hold: 1,
    buyerUseful: 7
  };
  const partitions = new Map(input.workerQueueCutover.partitions.map((partition) => [partition.workload, partition]));
  const watchlist = defaultQueries.map((query): SchedulerDailyActorRunPlanDto["watchlist"][number] => {
    const dashboardActor = actorByName.get(query.toLowerCase()) ?? actorByName.get(query.replace(/ group$/i, "").toLowerCase());
    const currentFreshness: SchedulerDailyActorRunPlanDto["watchlist"][number]["currentFreshness"] = dashboardActor?.state === "blocked"
      ? "blocked"
      : dashboardActor?.state === "stale"
        ? "stale"
        : dashboardActor?.state === "aging"
          ? "aging"
          : dashboardActor?.state === "fresh"
            ? "fresh"
            : "unknown";
    const priority: SchedulerDailyActorRunPlanDto["watchlist"][number]["priority"] = commercialBlockers.has(query) || currentFreshness === "stale" || currentFreshness === "unknown"
      ? "daily_until_fresh"
      : dashboardActor?.priority === "weekly" && currentFreshness === "fresh"
        ? "weekly_if_fresh"
        : "daily";
    const schedulerAction: SchedulerDailyActorRunPlanDto["watchlist"][number]["schedulerAction"] = currentFreshness === "blocked"
      ? "hold_restricted_metadata"
      : currentFreshness === "stale" || commercialBlockers.has(query)
        ? "raise_priority"
        : currentFreshness === "fresh" && dashboardActor?.schedulerAction === "reuse_active_run"
          ? "reuse_active_run"
          : currentFreshness === "aging"
            ? "run_daily"
            : "suppress_stale_only_rows";
    return {
      query,
      priority,
      currentFreshness,
      schedulerAction,
      sourceFamilyFocus: uniqueStrings([
        "clear_web_report",
        "vendor_advisory",
        ...(publicChannelFocus.has(query) ? ["public_channel"] : []),
        ...(darkMetadataFocus.has(query) ? ["approved_dark_metadata"] : []),
        ...(query.includes("CVE") ? ["public_advisory"] : [])
      ]),
      expectedUsefulRows: currentFreshness === "fresh" ? 3 : commercialBlockers.has(query) ? 5 : 4,
      staleSuppression: currentFreshness === "stale" || commercialBlockers.has(query)
        ? "drop_stale_only_activity"
        : currentFreshness === "aging"
          ? "caveat_stale_context"
          : "normal"
    };
  });
  const sourceTierCadence: SchedulerDailyActorRunPlanDto["sourceTierCadence"] = [
    {
      tier: "tier_100",
      scope: "safe_public_sources",
      targetRecords: 100,
      cadence: "hourly",
      workClass: "broad_daily_sweep",
      reservedWorkerSlots: partitions.get("scheduled_source_sweep")?.reservedWorkerSlots ?? 1,
      expectedUsefulRowLift: 0.18,
      maxDailyTasks: 600,
      advanceCriteria: ["dedupe_rate_below_35_percent", "fresh_row_rate_above_45_percent", "parser_success_above_85_percent", "no_leak_gate_green"],
      holdCriteria: ["fresh_row_rate_below_30_percent", "stale_only_rows_above_35_percent", "parser_failures_block_top_actor_rows"]
    },
    {
      tier: "tier_1000",
      scope: "safe_public_sources",
      targetRecords: 1000,
      cadence: "four_hourly",
      workClass: "broad_daily_sweep",
      reservedWorkerSlots: partitions.get("scheduled_source_sweep")?.reservedWorkerSlots ?? 1,
      expectedUsefulRowLift: 0.34,
      maxDailyTasks: 1800,
      advanceCriteria: ["tier_100_quality_gate_passed", "source_family_diversity_at_least_4", "cost_per_useful_row_under_target", "daily_actor_run_has_no_empty_commercial_blockers"],
      holdCriteria: ["queue_pressure_degrades_three_second_polling", "duplicate_rows_exceed_fresh_rows", "stale_apt29_or_apt42_rows_remain_unresolved"]
    },
    {
      tier: "tier_4000",
      scope: "approved_dark_metadata",
      targetRecords: 4000,
      cadence: "daily",
      workClass: "restricted_darknet_metadata_sweep",
      reservedWorkerSlots: partitions.get("restricted_metadata_approval")?.reservedWorkerSlots ?? 1,
      expectedUsefulRowLift: 0.22,
      maxDailyTasks: 1200,
      advanceCriteria: ["tier_1000_public_sources_stable", "metadata_only_review_holds_green", "search_quality_above_baseline", "no_unsafe_url_or_payload_output"],
      holdCriteria: ["approval_expired", "dead_letters_above_budget", "restricted_metadata_blocks_clear_web_polling"]
    }
  ];
  const affectedQueries = watchlist
    .filter((row) => row.staleSuppression !== "normal" || row.currentFreshness === "unknown")
    .map((row) => row.query);
  const decision: SchedulerDailyActorRunPlanDto["releaseGate"]["decision"] = input.freshnessSloDashboard.releaseGate.decision === "rollback"
    ? "rollback"
    : affectedQueries.length > 0 || input.queueEconomics.totals.retryDebt > 0
      ? "hold"
      : "pass";
  const publicChannelGapQueries = watchlist
    .filter((row) => row.sourceFamilyFocus.includes("public_channel") && row.currentFreshness !== "fresh")
    .map((row) => row.query);
  const darkMetadataGapQueries = watchlist
    .filter((row) => row.sourceFamilyFocus.includes("approved_dark_metadata") && row.currentFreshness !== "fresh")
    .map((row) => row.query);
  const staleActorGapQueries = watchlist
    .filter((row) => row.staleSuppression === "drop_stale_only_activity")
    .map((row) => row.query);
  const tier100 = sourceTierCadence.find((tier) => tier.tier === "tier_100") ?? sourceTierCadence[0];
  const tier1000 = sourceTierCadence.find((tier) => tier.tier === "tier_1000") ?? sourceTierCadence[1] ?? tier100;
  const tier4000 = sourceTierCadence.find((tier) => tier.tier === "tier_4000") ?? sourceTierCadence[2] ?? tier1000;
  const sourceGapClosurePlan: SchedulerDailyActorRunPlanDto["sourceGapClosurePlan"] = {
    schemaVersion: "ti.scheduler_source_gap_closure_plan.v1",
    routeVisible: true,
    targetFreshEvidenceWithinSeconds: 120,
    duplicateRunReuseKeyPattern: "tenant:query:source_family:daily_actor",
    gapClosures: Array.from(new Map([
      ...staleActorGapQueries.map((query) => ({
        query,
        missingSourceFamily: "safe_public_sources" as const,
        sourceTier: "tier_100" as const,
        workClass: "interactive_live_search" as const,
        queueAction: "suppress_ready_until_gap_closes" as const,
        reuseKey: `public:${query}:safe_public_sources:daily_actor`,
        maxAttempts: 3,
        backoffSeconds: [3, 15, 60],
        deadlineSeconds: 120,
        fairnessGroup: `actor:${query}:freshness`,
        expectedVisibleState: "searching" as const,
        paidRowEffect: "freshen_stale_row" as const
      })),
      ...publicChannelGapQueries.map((query) => ({
        query,
        missingSourceFamily: "public_channel" as const,
        sourceTier: "tier_1000" as const,
        workClass: "public_channel_probe" as const,
        queueAction: "enqueue_gap_probe" as const,
        reuseKey: `public:${query}:public_channel:daily_actor`,
        maxAttempts: 3,
        backoffSeconds: [15, 60, 180],
        deadlineSeconds: 180,
        fairnessGroup: `actor:${query}:public_channel`,
        expectedVisibleState: "partial" as const,
        paidRowEffect: "raise_caveat_quality" as const
      })),
      ...darkMetadataGapQueries.map((query) => ({
        query,
        missingSourceFamily: "approved_dark_metadata" as const,
        sourceTier: "tier_4000" as const,
        workClass: "restricted_darknet_metadata_sweep" as const,
        queueAction: "metadata_review_hold" as const,
        reuseKey: `public:${query}:approved_dark_metadata:daily_actor`,
        maxAttempts: 2,
        backoffSeconds: [60, 300],
        deadlineSeconds: 600,
        fairnessGroup: `actor:${query}:approved_metadata`,
        expectedVisibleState: "metadata_review" as const,
        paidRowEffect: "metadata_context_only" as const
      }))
    ].map((row) => [`${row.query}:${row.missingSourceFamily}`, row])).values()),
    workerLimits: {
      maxParallelGapClosures: 8,
      perSourceConcurrency: 1,
      publicChannelReservedSlots: partitions.get("public_channel_window")?.reservedWorkerSlots ?? 1,
      darkMetadataReservedSlots: partitions.get("restricted_metadata_approval")?.reservedWorkerSlots ?? 1,
      backgroundSweepMayYieldToInteractive: true
    },
    promotionRules: {
      requireFreshOrPartialEvidence: true,
      requireNoLeakProof: true,
      staleOnlyRowsRemainBlocked: true,
      metadataOnlyRowsRemainCaveated: true
    }
  };
  const readinessByClosure: SchedulerDailyActorRunPlanDto["sourceGapExecutionReadiness"]["readinessByClosure"] = sourceGapClosurePlan.gapClosures.map((closure) => {
    const executionIdentity = {
      idempotencyKey: `daily-source-gap:${closure.reuseKey}`,
      taskFingerprint: `${closure.workClass}:${closure.sourceTier}:${closure.query}:${closure.missingSourceFamily}`,
      activeRunLookup: ["tenant_query_source_family", "daily_actor_reuse_key", "latest_cursor_checkpoint"] satisfies SchedulerDailyActorRunPlanDto["sourceGapExecutionReadiness"]["readinessByClosure"][number]["activeRunLookup"]
    };
    if (closure.missingSourceFamily === "approved_dark_metadata") {
      return {
        query: closure.query,
        missingSourceFamily: closure.missingSourceFamily,
        reuseKey: closure.reuseKey,
        ...executionIdentity,
        queueAction: closure.queueAction,
        readinessState: "ready_for_metadata_review",
        executableNow: true,
        enqueueBatch: "tier_4000_metadata_sweep",
        workerPartition: "restricted_metadata_approval",
        onActiveRun: "reattach_and_poll_existing_run",
        onNoActiveRun: "enqueue_metadata_review_hold",
        visibleStateAfterDecision: "metadata_review",
        drainPriority: 5,
        maxLeaseSeconds: 600,
        heartbeatSeconds: 60,
        cursorCheckpoint: "metadata_review_delta",
        blockingReasons: ["metadata_only_rows_remain_caveated_until_review"],
        nextOperatorAction: "review_metadata_summary"
      };
    }
    if (closure.missingSourceFamily === "public_channel") {
      return {
        query: closure.query,
        missingSourceFamily: closure.missingSourceFamily,
        reuseKey: closure.reuseKey,
        ...executionIdentity,
        queueAction: closure.queueAction,
        readinessState: "ready_to_enqueue",
        executableNow: true,
        enqueueBatch: "public_channel_gap_fill",
        workerPartition: "public_channel_window",
        onActiveRun: "reattach_and_poll_existing_run",
        onNoActiveRun: "enqueue_idempotent_source_sweep",
        visibleStateAfterDecision: "partial",
        drainPriority: 3,
        maxLeaseSeconds: 180,
        heartbeatSeconds: 15,
        cursorCheckpoint: "source_gap_delta",
        blockingReasons: [],
        nextOperatorAction: "attach_or_enqueue"
      };
    }
    return {
      query: closure.query,
      missingSourceFamily: closure.missingSourceFamily,
      reuseKey: closure.reuseKey,
      ...executionIdentity,
      queueAction: closure.queueAction,
      readinessState: closure.queueAction === "reuse_active_run" ? "reattach_existing_run" : "ready_to_enqueue",
      executableNow: true,
      enqueueBatch: "interactive_commercial_refresh",
      workerPartition: "interactive_actor_search",
      onActiveRun: "reattach_and_poll_existing_run",
      onNoActiveRun: closure.queueAction === "suppress_ready_until_gap_closes" ? "keep_paid_ready_suppressed" : "enqueue_idempotent_source_sweep",
      visibleStateAfterDecision: "searching",
      drainPriority: 2,
      maxLeaseSeconds: 120,
      heartbeatSeconds: 15,
      cursorCheckpoint: "answer_delta",
      blockingReasons: closure.queueAction === "suppress_ready_until_gap_closes" ? ["stale_only_rows_remain_blocked_from_ready"] : [],
      nextOperatorAction: closure.queueAction === "suppress_ready_until_gap_closes" ? "suppress_paid_ready" : "attach_or_enqueue"
    };
  });
  const materializedTasks: SchedulerDailyActorRunPlanDto["sourceGapExecutionReadiness"]["materializedTasks"] = readinessByClosure.map((readiness) => {
    const closure = sourceGapClosurePlan.gapClosures.find((row) => row.reuseKey === readiness.reuseKey) ?? sourceGapClosurePlan.gapClosures[0];
    return {
      dryRunTaskId: `dryrun_${readiness.taskFingerprint.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase()}`,
      query: readiness.query,
      workClass: closure.workClass,
      sourceTier: closure.sourceTier,
      reuseKey: readiness.reuseKey,
      idempotencyKey: readiness.idempotencyKey,
      enqueueBatch: readiness.missingSourceFamily === "approved_dark_metadata"
        ? "tier_4000_metadata_sweep"
        : readiness.missingSourceFamily === "public_channel"
          ? "public_channel_gap_fill"
          : "interactive_commercial_refresh",
      workerPartition: readiness.missingSourceFamily === "approved_dark_metadata"
        ? "restricted_metadata_approval"
        : readiness.missingSourceFamily === "public_channel"
          ? "public_channel_window"
          : "interactive_actor_search",
      leaseSeconds: readiness.maxLeaseSeconds,
      heartbeatSeconds: readiness.heartbeatSeconds,
      maxAttempts: closure.maxAttempts,
      deadlineSeconds: closure.deadlineSeconds,
      cursorCheckpoint: readiness.cursorCheckpoint,
      noLeakMode: readiness.missingSourceFamily === "approved_dark_metadata" ? "metadata_only_no_raw_download" : "public_fetch_only",
      paidRowGate: readiness.missingSourceFamily === "approved_dark_metadata"
        ? "metadata_context_only"
        : readiness.missingSourceFamily === "public_channel"
          ? "caveat_until_correlated"
          : "suppress_until_fresh"
    };
  });
  const queueTaskSpecs: SchedulerDailyActorRunPlanDto["sourceGapExecutionReadiness"]["queueTaskSpecs"] = materializedTasks.map((task, index) => {
    const sourceType: CollectionTask["sourceType"] = task.noLeakMode === "metadata_only_no_raw_download"
      ? "tor_metadata"
      : task.workClass === "public_channel_probe"
        ? "telegram_public"
        : "static_web";
    return {
      willEnqueue: false,
      task: {
        id: task.dryRunTaskId,
        tenantId: "default",
        sourceId: `scheduler_${task.sourceTier}_${task.workerPartition}`,
        targetUrl: `ti://scheduler/source-gap/${encodeURIComponent(task.query)}/${task.sourceTier}`,
        sourceType,
        queuedAt: now.toISOString(),
        priority: Math.max(1, 100 - index),
        reason: `dry-run source gap closure for ${task.query}; ${task.paidRowGate}`,
        retryCount: 0,
        intelRequestId: task.idempotencyKey,
        runId: task.reuseKey,
        deadlineAt: new Date(now.getTime() + task.deadlineSeconds * 1000).toISOString(),
        maxBytes: task.noLeakMode === "metadata_only_no_raw_download" ? 0 : 262_144,
        availableAt: now.toISOString(),
        attemptDeadlineAt: new Date(now.getTime() + task.leaseSeconds * 1000).toISOString(),
        crawlBudgetKey: `${task.workerPartition}:${task.sourceTier}`,
        maxRetries: task.maxAttempts,
        sourceConcurrencyKey: task.reuseKey,
        fairnessKey: `${task.workerPartition}:${task.query}`,
        planning: {
          budgetClass: task.workClass as PlanningBudgetClass,
          decision: task.noLeakMode === "metadata_only_no_raw_download" ? "blocked-by-policy" : "selected",
          reason: task.paidRowGate,
          queryTerms: [task.query, task.sourceTier],
          freshness: task.paidRowGate === "suppress_until_fresh" ? 0.2 : task.paidRowGate === "caveat_until_correlated" ? 0.55 : 0.4,
          freshnessTargetSeconds: task.deadlineSeconds,
          maxCost: {
            tasks: 1,
            bytes: task.noLeakMode === "metadata_only_no_raw_download" ? 0 : 262_144
          },
          safetyEnvelope: {
            allowClearWeb: task.noLeakMode === "public_fetch_only",
            allowPublicChannel: task.workClass === "public_channel_probe",
            allowRestrictedMetadata: task.noLeakMode === "metadata_only_no_raw_download",
            metadataOnlyRestricted: task.noLeakMode === "metadata_only_no_raw_download",
            forbiddenOperations: ["raw_url_output", "payload_download", "credential_access", "actor_interaction"]
          },
          idempotencyKey: task.idempotencyKey,
          sourceTrust: task.noLeakMode === "metadata_only_no_raw_download" ? 0.68 : 0.82,
          selectedFor: task.noLeakMode === "metadata_only_no_raw_download" ? "metadata" : task.workClass === "public_channel_probe" ? "probe" : "interactive"
        }
      },
      enqueuePreconditions: task.noLeakMode === "metadata_only_no_raw_download"
        ? ["reuse_key_not_active", "metadata_only_review_current", "paid_row_gate_not_ready"]
        : ["reuse_key_not_active", "source_policy_allows_public_fetch", "paid_row_gate_not_ready"],
      expectedRepositoryOperation: "findOrRegisterRun_then_enqueueTasks",
      forbiddenMutations: ["network_fetch", "raw_url_output", "payload_download", "credential_access", "actor_interaction"]
    };
  });
  const visibleStateByReuseKey = new Map(readinessByClosure.map((readiness) => [readiness.reuseKey, readiness.visibleStateAfterDecision]));
  const enqueueAdapterPreview: SchedulerDailyActorRunPlanDto["sourceGapExecutionReadiness"]["enqueueAdapterPreview"] = {
    disabledByDefault: true,
    willMutate: false,
    adapterMode: "dry_run_embedded_repository_preview",
    promotionRequired: "enable_source_gap_enqueue_flag_and_postgres_scheduler_executor",
    preflight: {
      requiredFlags: ["SCHEDULER_SOURCE_GAP_ENQUEUE_ENABLED", "SCHEDULER_POSTGRES_QUEUE_ENABLED"],
      requiredRuntimeState: ["postgres_dsn_configured", "executor_available", "source_policy_current", "paid_row_gate_open"],
      rollback: "disable_source_gap_enqueue_flag_and_replay_cursor_events"
    },
    repositoryCalls: queueTaskSpecs.flatMap((spec, index) => {
      const run: CollectionRun = {
        id: `dryrun_run_${spec.task.id}`,
        tenantId: spec.task.tenantId,
        planId: "scheduler_daily_actor_source_gap",
        requestId: spec.task.intelRequestId ?? spec.task.id,
        status: "queued",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        idempotencyKey: spec.task.planning?.idempotencyKey ?? spec.task.intelRequestId,
        requestHash: spec.task.runId,
        taskCount: 1,
        reviewTaskCount: spec.task.sourceType === "tor_metadata" ? 1 : 0,
        rejectedSourceCount: 0,
        captureCount: 0,
        incidentCount: 0
      };
      const blockedUntil: SchedulerDailyActorRunPlanDto["sourceGapExecutionReadiness"]["enqueueAdapterPreview"]["repositoryCalls"][number]["blockedUntil"] = [
        "feature_flag_enabled",
        "postgres_adapter_promoted",
        "source_policy_verified",
        "paid_row_gate_open"
      ];
      if (spec.enqueuePreconditions.includes("metadata_only_review_current")) {
        blockedUntil.push("metadata_review_current");
      }
      return [
        {
          callOrder: (index * 2) + 1,
          reuseKey: spec.task.runId ?? spec.task.id,
          run,
          taskId: spec.task.id,
          dryRunOperation: "findOrRegisterRun",
          expectedResult: "reattach_active_run_or_register_queued_run",
          blockedUntil,
          visibleStateAfterDryRun: visibleStateByReuseKey.get(spec.task.runId ?? "") ?? "searching"
        },
        {
          callOrder: (index * 2) + 2,
          reuseKey: spec.task.runId ?? spec.task.id,
          run,
          taskId: spec.task.id,
          dryRunOperation: "enqueueTasks",
          expectedResult: "enqueue_task_after_reuse_check",
          blockedUntil,
          visibleStateAfterDryRun: visibleStateByReuseKey.get(spec.task.runId ?? "") ?? "searching"
        }
      ];
    }),
    impactSummary: {
      candidateTaskCount: queueTaskSpecs.length,
      publicFetchTaskCount: queueTaskSpecs.filter((spec) => spec.task.sourceType !== "tor_metadata").length,
      metadataOnlyTaskCount: queueTaskSpecs.filter((spec) => spec.task.sourceType === "tor_metadata").length,
      stalePaidRowsRemainSuppressed: true,
      metadataRowsRemainCaveated: true
    }
  };
  const drainExecution: SchedulerDailyActorRunPlanDto["sourceGapExecutionReadiness"]["drainExecution"] = [
    {
      step: "finish_active_dataset_emit",
      appliesToBatch: "daily_actor_dataset_emit",
      action: "finish_if_under_deadline",
      maxWaitSeconds: 30,
      preserves: ["run_id", "poll_cursor", "delta_cursor"],
      visibleState: decision === "pass" ? "ready" : "partial"
    },
    {
      step: "checkpoint_interactive_refresh",
      appliesToBatch: "interactive_commercial_refresh",
      action: "checkpoint_and_requeue_by_reuse_key",
      maxWaitSeconds: 15,
      preserves: ["run_id", "reuse_key", "poll_cursor", "delta_cursor"],
      visibleState: "searching"
    },
    {
      step: "checkpoint_public_gap_fill",
      appliesToBatch: "public_channel_gap_fill",
      action: "checkpoint_and_requeue_by_reuse_key",
      maxWaitSeconds: 15,
      preserves: ["run_id", "reuse_key", "source_gap_cursor", "delta_cursor"],
      visibleState: "partial"
    },
    {
      step: "checkpoint_source_sweeps",
      appliesToBatch: "tier_100_source_sweep",
      action: "pause_new_leases",
      maxWaitSeconds: 10,
      preserves: ["reuse_key", "source_gap_cursor"],
      visibleState: "partial"
    },
    {
      step: "checkpoint_source_sweeps",
      appliesToBatch: "tier_1000_source_sweep",
      action: "pause_new_leases",
      maxWaitSeconds: 10,
      preserves: ["reuse_key", "source_gap_cursor"],
      visibleState: "partial"
    },
    {
      step: "checkpoint_metadata_review",
      appliesToBatch: "tier_4000_metadata_sweep",
      action: "checkpoint_and_requeue_by_reuse_key",
      maxWaitSeconds: 60,
      preserves: ["reuse_key", "metadata_review_cursor", "delta_cursor"],
      visibleState: "metadata_review"
    }
  ];
  const sourceGapExecutionReadiness: SchedulerDailyActorRunPlanDto["sourceGapExecutionReadiness"] = {
    schemaVersion: "ti.scheduler_source_gap_execution_readiness.v1",
    routeVisible: true,
    closureCount: readinessByClosure.length,
    executableClosureCount: readinessByClosure.filter((closure) => closure.executableNow).length,
    runReuse: {
      requiredBeforeEnqueue: true,
      attachBy: "reuseKey",
      duplicatePolicy: "reattach_active_run_before_new_task",
      cursorPolicy: "preserve_answer_evidence_and_source_gap_cursors",
      stormGuard: "one_active_closure_per_tenant_query_source_family"
    },
    workerDrain: {
      pressurePolicy: "interactive_freshness_first",
      drainOrder: [
        "daily_actor_dataset_emit",
        "interactive_commercial_refresh",
        "public_channel_gap_fill",
        "tier_100_source_sweep",
        "tier_1000_source_sweep",
        "tier_4000_metadata_sweep"
      ],
      controlledShutdownDeadlineSeconds: 90,
      heartbeatExpiryRecovery: "requeue_with_last_checkpoint",
      backgroundSweepYield: true
    },
    readinessByClosure,
    sourceSweepBatches: [
      {
        enqueueBatch: "interactive_commercial_refresh",
        queryCount: readinessByClosure.filter((closure) => closure.enqueueBatch === "interactive_commercial_refresh").length,
        reuseKeys: readinessByClosure.filter((closure) => closure.enqueueBatch === "interactive_commercial_refresh").map((closure) => closure.reuseKey),
        idempotencyScope: "tenant_query_source_family_daily",
        leaseMode: "exclusive_per_reuse_key",
        drainBehavior: "finish_or_checkpoint_before_shutdown",
        nextPollSeconds: 3,
        promotesToVisibleState: "searching"
      },
      {
        enqueueBatch: "public_channel_gap_fill",
        queryCount: readinessByClosure.filter((closure) => closure.enqueueBatch === "public_channel_gap_fill").length,
        reuseKeys: readinessByClosure.filter((closure) => closure.enqueueBatch === "public_channel_gap_fill").map((closure) => closure.reuseKey),
        idempotencyScope: "tenant_query_source_family_daily",
        leaseMode: "exclusive_per_reuse_key",
        drainBehavior: "finish_or_checkpoint_before_shutdown",
        nextPollSeconds: 15,
        promotesToVisibleState: "partial"
      },
      {
        enqueueBatch: "tier_4000_metadata_sweep",
        queryCount: readinessByClosure.filter((closure) => closure.enqueueBatch === "tier_4000_metadata_sweep").length,
        reuseKeys: readinessByClosure.filter((closure) => closure.enqueueBatch === "tier_4000_metadata_sweep").map((closure) => closure.reuseKey),
        idempotencyScope: "tenant_query_source_family_daily",
        leaseMode: "exclusive_per_reuse_key",
        drainBehavior: "finish_or_checkpoint_before_shutdown",
        nextPollSeconds: 60,
        promotesToVisibleState: "metadata_review"
      }
    ],
    materializedTasks,
    queueTaskSpecs,
    enqueueAdapterPreview,
    drainExecution
  };
  const executionQueuePlan: SchedulerDailyActorRunPlanDto["executionQueuePlan"] = {
    enqueueWindow: "source_sweeps_before_actor_run",
    duplicateRunReuseBeforeEnqueue: true,
    batches: [
      {
        batchId: "interactive_commercial_refresh",
        workClass: "interactive_live_search",
        target: "watchlist",
        queries: watchlist.filter((row) => row.priority === "daily_until_fresh").map((row) => row.query),
        enqueueAfter: "now",
        maxTasks: 60,
        reservedWorkerSlots: partitions.get("interactive_actor_search")?.reservedWorkerSlots ?? 1,
        freshnessGate: "must_produce_fresh_or_partial",
        staleOnlyRowsBlocked: true,
        expectedVisibleState: "searching"
      },
      {
        batchId: "public_channel_gap_fill",
        workClass: "public_channel_probe",
        target: "watchlist",
        queries: publicChannelGapQueries,
        enqueueAfter: "after_interactive_reuse_check",
        maxTasks: Math.max(20, publicChannelGapQueries.length * 8),
        reservedWorkerSlots: partitions.get("public_channel_window")?.reservedWorkerSlots ?? 1,
        freshnessGate: "must_produce_fresh_or_partial",
        staleOnlyRowsBlocked: true,
        expectedVisibleState: "partial"
      },
      {
        batchId: "tier_100_source_sweep",
        workClass: tier100.workClass,
        target: "source_tier",
        queries: defaultQueries,
        tier: "tier_100",
        enqueueAfter: "after_public_gap_probe",
        maxTasks: tier100.maxDailyTasks,
        reservedWorkerSlots: tier100.reservedWorkerSlots,
        freshnessGate: "dedupe_and_parser_gate",
        staleOnlyRowsBlocked: true,
        expectedVisibleState: "partial"
      },
      {
        batchId: "tier_1000_source_sweep",
        workClass: tier1000.workClass,
        target: "source_tier",
        queries: defaultQueries,
        tier: "tier_1000",
        enqueueAfter: "after_public_gap_probe",
        maxTasks: tier1000.maxDailyTasks,
        reservedWorkerSlots: tier1000.reservedWorkerSlots,
        freshnessGate: "dedupe_and_parser_gate",
        staleOnlyRowsBlocked: true,
        expectedVisibleState: "partial"
      },
      {
        batchId: "tier_4000_metadata_sweep",
        workClass: tier4000.workClass,
        target: "source_tier",
        queries: darkMetadataGapQueries,
        tier: "tier_4000",
        enqueueAfter: "after_source_sweeps",
        maxTasks: tier4000.maxDailyTasks,
        reservedWorkerSlots: tier4000.reservedWorkerSlots,
        freshnessGate: "metadata_review_gate",
        staleOnlyRowsBlocked: true,
        expectedVisibleState: "metadata_review"
      },
      {
        batchId: "daily_actor_dataset_emit",
        workClass: "interactive_live_search",
        target: "apify_actor_dataset",
        queries: defaultQueries,
        enqueueAfter: "after_source_sweeps",
        maxTasks: defaultQueries.length,
        reservedWorkerSlots: 1,
        freshnessGate: "paid_row_gate",
        staleOnlyRowsBlocked: true,
        expectedVisibleState: decision === "pass" ? "ready" : "partial"
      }
    ],
    fairnessGuards: {
      maxActorQueriesPerTenantPerDay: defaultQueries.length,
      publicChannelReservedWorkerSlots: partitions.get("public_channel_window")?.reservedWorkerSlots ?? 1,
      darkMetadataReservedWorkerSlots: partitions.get("restricted_metadata_approval")?.reservedWorkerSlots ?? 1,
      backgroundSweepMaxWorkerShare: 0.42,
      priorityAgingAfterSeconds: 180,
      retryDebtDeadLetterAtAttempts: 3
    },
    paidRowGate: {
      rowsWithOnlyStaleActivity: "suppress_from_ready",
      rowsMissingPublicChannelForFocusedActors: "include_caveat_and_enqueue_gap_fill",
      rowsMissingApprovedDarkMetadataForRansomware: "include_caveat_and_enqueue_metadata_review",
      weakVictimExtraction: "hold_paid_row_until_review_or_caveat"
    },
    suppressionDecisions: Array.from(new Map([
      ...watchlist
        .filter((row) => row.staleSuppression === "drop_stale_only_activity")
        .map((row) => ({
          query: row.query,
          reason: "stale_only_activity" as const,
          action: "raise_priority" as const,
          visibleState: "searching" as const
        })),
      ...publicChannelGapQueries.map((query) => ({
        query,
        reason: "missing_public_channel" as const,
        action: "enqueue_gap_fill" as const,
        visibleState: "partial" as const
      })),
      ...darkMetadataGapQueries.map((query) => ({
        query,
        reason: "missing_dark_metadata" as const,
        action: "metadata_review" as const,
        visibleState: "metadata_review" as const
      })),
      ...watchlist
        .filter((row) => row.currentFreshness === "unknown")
        .map((row) => ({
          query: row.query,
          reason: "unknown_freshness" as const,
          action: "suppress_ready_state" as const,
          visibleState: "searching" as const
        }))
    ].map((row) => [`${row.query}:${row.reason}`, row])).values())
  };
  const paidRowCadenceInputs: SchedulerDailyActorRunPlanDto["paidRowCadenceInputs"] = {
    schemaVersion: "ti.scheduler_paid_row_cadence_inputs.v1",
    routeVisible: true,
    paidActorFloor: {
      gate: "hosted_300_sellable_rows",
      targetSellableRows: 300,
      currentLocalSellableRows: 300,
      hostedObservedSellableRows: null,
      hostedProofRequired: true,
      countsTowardHostedPaidGateNow: false
    },
    localPresetBaseline: {
      defaultQueryCount: 100,
      usefulRows: 607,
      sellableRowsBeforeCurrentLift: 187,
      sellableRowsAfterCurrentLift: 300,
      sourceProvenanceShare: 0.357,
      promotionState: "local_gate_ready_hosted_gate_held"
    },
    admissionInputs: [
      {
        inputId: "parser_current_local_lift",
        owner: "agent_03",
        schedulerUse: "raise_daily_actor_cadence",
        rows: 50,
        countsTowardLocalFloorNow: true,
        countsTowardHostedPaidGateNow: false,
        nextCadenceAction: "run_100_name_preset_after_source_sweeps"
      },
      {
        inputId: "dark_metadata_chargeable_support",
        owner: "agent_05",
        schedulerUse: "reserve_metadata_review",
        rows: darkMetadataGapQueries.length,
        countsTowardLocalFloorNow: false,
        countsTowardHostedPaidGateNow: false,
        nextCadenceAction: "schedule_metadata_review_before_emit"
      },
      {
        inputId: "graph_public_corroboration_handoff",
        owner: "agent_08",
        schedulerUse: "reserve_public_corroboration",
        rows: 175,
        countsTowardLocalFloorNow: false,
        countsTowardHostedPaidGateNow: false,
        nextCadenceAction: "schedule_public_corroboration_before_emit"
      },
      {
        inputId: "source_pack_gate_alignment",
        owner: "agent_01",
        schedulerUse: "hold_as_review_only",
        rows: 0,
        countsTowardLocalFloorNow: false,
        countsTowardHostedPaidGateNow: false,
        nextCadenceAction: "keep_review_only_no_enqueue"
      },
      {
        inputId: "hosted_observed_proof",
        owner: "agent_09",
        schedulerUse: "hold_until_external_proof",
        rows: 0,
        countsTowardLocalFloorNow: false,
        countsTowardHostedPaidGateNow: false,
        nextCadenceAction: "wait_for_hosted_proof_import"
      }
    ],
    schedulerActions: [
      {
        actionId: "daily_actor_100_name_preset",
        visibleState: "searching",
        cadence: "daily",
        reason: "local 300-row gate is ready; hosted paid promotion remains held until observed hosted proof is imported",
        protectedBy: ["duplicate_run_reuse", "paid_row_gate", "no_leak_gate", "hosted_proof_gate"]
      },
      {
        actionId: "public_corroboration_before_emit",
        visibleState: "partial",
        cadence: "four_hourly",
        reason: `${publicChannelGapQueries.length} watchlist queries need public-channel or public-corroboration support before caveats can lift`,
        protectedBy: ["duplicate_run_reuse", "source_policy", "paid_row_gate", "no_leak_gate"]
      },
      {
        actionId: "dark_metadata_review_before_emit",
        visibleState: "metadata_review",
        cadence: "daily",
        reason: `${darkMetadataGapQueries.length} ransomware or intrusion-set queries need approved metadata review before metadata-only context improves paid rows`,
        protectedBy: ["metadata_review", "paid_row_gate", "no_leak_gate"]
      },
      {
        actionId: "source_pack_review_hold",
        visibleState: "queued",
        cadence: "hourly",
        reason: "source-pack alignment can influence priority, but review-only rows do not enqueue or count as paid rows",
        protectedBy: ["source_policy", "paid_row_gate", "no_leak_gate"]
      },
      {
        actionId: "hosted_proof_hold",
        visibleState: "queued",
        cadence: "on_external_proof",
        reason: "hosted 300-row promotion stays held until the external Apify proof import has observed sellable rows",
        protectedBy: ["hosted_proof_gate", "paid_row_gate", "no_leak_gate"]
      }
    ],
    nextSchedulerAction: "run_daily_actor_after_source_gap_sweeps",
    uiSummary: {
      headline: "local_300_gate_ready_hosted_proof_held",
      operatorMessage: "Run the 100-name Actor preset after public corroboration and approved metadata review sweeps; keep hosted paid promotion held until external proof is imported.",
      suppressedClaim: "do_not_count_projection_or_review_only_rows_as_paid"
    }
  };

  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/frontier/status", "/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/contracts", "apify_public_threat_actor_monitor", "agent10_revenue_slo"],
    dryRun: true,
    willMutate: false,
    schemaVersion: "ti.scheduler_daily_actor_run_plan.v1",
    apifyActor: {
      actorId: "eirikhanasand/public-threat-actor-monitor",
      publishedBuild: "0.6.7",
      defaultQueryCount: 100,
      defaultQueries,
      runCadence: "daily",
      window: "00:15_utc_after_source_sweeps",
      pricing: {
        resultEvent: "apify-default-dataset-item",
        actorStartEvent: "apify-actor-start",
        resultPricePerThousandUsd: 3,
        actorStartPriceUsd: 0.00005,
        apifyMarginPercent: 20
      }
    },
    latestProofRun: {
      runId: "iMQGeezZ8bx7WtlhQ",
      datasetId: "5PLmkE30luBA5Lbgc",
      query: "APT42",
      runtimeSeconds: 4,
      safeRowCount: 10,
      usageUsdApprox: 0.001,
      paidRowDecisionCounts: latestPaidRowDecisionCounts,
      blockers: ["caveated_rows", "stale_or_held_rows", "weak_victim_extraction", "missing_public_channel_coverage", "missing_dark_metadata_coverage"]
    },
    runTargets: {
      expectedRows,
      usefulRowTarget,
      freshRowTarget,
      staleRowSuppressionTarget: Math.max(20, Math.round(expectedRows * 0.25)),
      sourceFamilyDiversityTarget: 4,
      maxCostPerUsefulRowUsd: 0.0025,
      duplicateRunReuseRequired: true,
      nextPollSeconds: 3
    },
    watchlist,
    sourceTierCadence,
    economics: {
      estimatedRowsPerRun: estimatedRows,
      estimatedUsefulRowsPerRun: estimatedUsefulRows,
      estimatedGrossRevenueUsd,
      estimatedAfterApifyMarginUsd,
      estimatedSchedulerCostUsd,
      estimatedCostPerUsefulRowUsd,
      usefulRowRate: Number((estimatedUsefulRows / estimatedRows).toFixed(3)),
      freshRowRate: Number((freshRowTarget / estimatedRows).toFixed(3))
    },
    staleSuppression: {
      staleOnlyRowsExcludedFromReady: true,
      maxStaleRowsPerActor: 1,
      actions: ["raise_source_cadence", "request_source_family_expansion", "caveat_old_context", "suppress_ready_state"],
      affectedQueries
    },
    freshCollectionRetryPlan: {
      visibleWithinSeconds: 3,
      targetFreshEvidenceWithinSeconds: 120,
      maxRetryAttemptsBeforeDeadLetter: 3,
      retryBackoffSeconds: [3, 15, 60],
      retryAfterSecondsByWorkClass: [
        { workClass: "interactive_live_search", retryAfterSeconds: 3, deadlineSeconds: 30, visibleState: "searching" },
        { workClass: "public_channel_probe", retryAfterSeconds: 15, deadlineSeconds: 120, visibleState: "partial" },
        { workClass: "restricted_darknet_metadata_sweep", retryAfterSeconds: 60, deadlineSeconds: 600, visibleState: "metadata_review" },
        { workClass: "broad_daily_sweep", retryAfterSeconds: 60, deadlineSeconds: 900, visibleState: "queued" }
      ],
      escalation: [
        { condition: "stale_commercial_actor", action: "raise_priority", visibleToClient: true },
        { condition: "public_channel_gap", action: "reserve_worker_slot", visibleToClient: true },
        { condition: "dark_metadata_gap", action: "request_source_activation", visibleToClient: true },
        { condition: "weak_victim_extraction", action: "hold_paid_row", visibleToClient: true },
        { condition: "retry_debt", action: "dead_letter_review", visibleToClient: true }
      ]
    },
    executionQueuePlan,
    paidRowCadenceInputs,
    sourceGapClosurePlan,
    sourceGapExecutionReadiness,
    routeContracts: {
      frontierStatusField: "scheduler.dailyActorRunPlan",
      searchSchedulerField: "scheduler.dailyActorRunPlan",
      runStatusField: "scheduler.dailyActorRunPlan",
      contractsField: "surfaces.frontier.contracts.scheduler_daily_actor_run_plan"
    },
    releaseGate: {
      decision,
      reasons: uniqueStrings([
        ...(decision === "pass" ? ["daily_actor_run_plan_ready"] : []),
        ...(affectedQueries.length > 0 ? ["stale_or_unknown_watchlist_rows_require_suppression_or_source_expansion"] : []),
        ...(input.queueEconomics.totals.retryDebt > 0 ? ["retry_debt_must_not_hide_paid_row_freshness"] : []),
        ...(input.freshnessSloDashboard.releaseGate.decision === "rollback" ? ["freshness_dashboard_rollback"] : [])
      ]),
      proofCommands: [
        "bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts",
        "bun run check",
        "bun run check:route-inventory",
        "bun run check:contract-index",
        "bun run check:api-regression",
        "bun run check:apify-publication"
      ]
    }
  };
}

export function rehearseSchedulerSourceGapEnqueue(
  plan: SchedulerDailyActorRunPlanDto,
  repository: SchedulerQueueRepository,
  options: SchedulerSourceGapEnqueueRehearsalOptions = {}
): SchedulerSourceGapEnqueueRehearsalReceipt {
  const now = options.now ?? new Date();
  const preview = plan.sourceGapExecutionReadiness.enqueueAdapterPreview;
  const blockedReasons: SchedulerSourceGapEnqueueRehearsalReceipt["blockedReasons"] = [
    ...(!options.apply ? ["apply_not_requested" as const] : []),
    ...(!options.sourceGapEnqueueEnabled ? ["source_gap_enqueue_flag_disabled" as const] : []),
    ...(!options.postgresQueueEnabled ? ["postgres_queue_disabled" as const] : []),
    ...(!options.postgresDsnConfigured ? ["postgres_dsn_missing" as const] : []),
    ...(!options.executorAvailable ? ["executor_unavailable" as const] : []),
    ...(!options.sourcePolicyCurrent ? ["source_policy_not_current" as const] : []),
    ...(!options.paidRowGateOpen ? ["paid_row_gate_closed" as const] : []),
    ...(preview.repositoryCalls.some((call) => call.blockedUntil.includes("metadata_review_current")) && !options.metadataReviewCurrent
      ? ["metadata_review_not_current" as const]
      : [])
  ];
  const willMutate = blockedReasons.length === 0;
  const uniqueBlockedReasons: SchedulerSourceGapEnqueueRehearsalReceipt["blockedReasons"] = [...new Set(blockedReasons)];
  const taskById = new Map(plan.sourceGapExecutionReadiness.queueTaskSpecs.map((spec) => [spec.task.id, spec.task]));
  let mutatedRunCount = 0;
  let mutatedTaskCount = 0;
  let emittedDeltaCount = 0;

  const repositoryCalls: SchedulerSourceGapEnqueueRehearsalReceipt["repositoryCalls"] = preview.repositoryCalls.map((call) => {
    if (!willMutate) {
      return {
        callOrder: call.callOrder,
        reuseKey: call.reuseKey,
        taskId: call.taskId,
        operation: call.dryRunOperation,
        executed: false,
        skippedReason: "blocked_by_preflight"
      };
    }
    if (call.dryRunOperation === "findOrRegisterRun") {
      const result = repository.findOrRegisterRun(call.run, call.reuseKey, now);
      mutatedRunCount += result.reused ? 0 : 1;
      return {
        callOrder: call.callOrder,
        reuseKey: call.reuseKey,
        taskId: call.taskId,
        operation: call.dryRunOperation,
        executed: true,
        result: {
          runId: result.run.id,
          reused: result.reused,
          duplicateReuseCount: result.duplicateReuseCount
        }
      };
    }

    const task = taskById.get(call.taskId);
    const deltas = task ? repository.enqueueTasks([task], now) : [];
    mutatedTaskCount += task ? 1 : 0;
    emittedDeltaCount += deltas.length;
    return {
      callOrder: call.callOrder,
      reuseKey: call.reuseKey,
      taskId: call.taskId,
      operation: call.dryRunOperation,
      executed: true,
      result: {
        deltaCount: deltas.length
      }
    };
  });

  return {
    schemaVersion: "ti.scheduler_source_gap_enqueue_rehearsal.v1",
    generatedAt: now.toISOString(),
    mode: willMutate ? "applied_explicitly" : "blocked_dry_run",
    willMutate,
    blockedReasons: uniqueBlockedReasons,
    repositoryCalls,
    mutatedRunCount,
    mutatedTaskCount,
    emittedDeltaCount
  };
}

export function executeSchedulerSourceGapWorkerEntry(
  plan: SchedulerDailyActorRunPlanDto,
  repository: SchedulerQueueRepository,
  options: SchedulerSourceGapWorkerEntryOptions = {}
): SchedulerSourceGapWorkerEntryReceipt {
  const now = options.now ?? new Date();
  const queueTaskSpecs = plan.sourceGapExecutionReadiness.queueTaskSpecs;
  const workerMutationEnabled = options.workerMutationEnabled === true;
  const requestedApply = options.apply === true;
  const rehearsal = rehearseSchedulerSourceGapEnqueue(plan, repository, {
    ...options,
    apply: workerMutationEnabled && requestedApply,
    now
  });
  const selectedTaskIds = queueTaskSpecs.map((spec) => spec.task.id);
  const decision: SchedulerSourceGapWorkerEntryReceipt["decision"] = selectedTaskIds.length === 0
    ? "skip_no_tasks"
    : rehearsal.willMutate
      ? "ready_for_explicit_repository_apply"
      : "blocked_before_repository";

  return {
    schemaVersion: "ti.scheduler_source_gap_worker_entry.v1",
    generatedAt: now.toISOString(),
    worker: {
      workerId: options.workerId ?? "source_gap_worker_dry_run",
      partition: options.workerPartition ?? "background_sweep",
      mutationGate: workerMutationEnabled ? "enabled" : "disabled",
      requestedApply
    },
    decision,
    queueTaskCount: selectedTaskIds.length,
    selectedTaskIds,
    repositoryCallCount: rehearsal.repositoryCalls.length,
    allowedOperations: rehearsal.willMutate
      ? ["inspect_daily_actor_source_gap_plan", "findOrRegisterRun", "enqueueTasks"]
      : ["inspect_daily_actor_source_gap_plan", "return_blocked_receipt"],
    forbiddenOperations: ["network_fetch", "lease_task", "ack_task", "raw_url_output", "payload_download", "credential_access", "actor_interaction"],
    rehearsal,
    nextWorkerAction: rehearsal.willMutate ? "handoff_to_repository_adapter" : "return_without_mutation"
  };
}

export function runSchedulerSourceGapWorkerLoop(
  plan: SchedulerDailyActorRunPlanDto,
  repository: SchedulerQueueRepository,
  options: SchedulerSourceGapWorkerLoopOptions = {}
): SchedulerSourceGapWorkerLoopReceipt {
  const now = options.now ?? new Date();
  const entry = executeSchedulerSourceGapWorkerEntry(plan, repository, { ...options, now });
  const readinessByPartition = new Map<SchedulerSourceGapWorkerPartition, {
    taskIds: string[];
    reuseKeys: string[];
    visibleStates: Array<"searching" | "partial" | "metadata_review">;
    drainBehavior: "finish_or_checkpoint_before_shutdown" | "checkpoint_and_requeue_by_reuse_key" | "metadata_review_hold";
  }>();
  const taskIdByReuseKey = new Map(plan.sourceGapExecutionReadiness.queueTaskSpecs.map((spec) => [spec.task.sourceConcurrencyKey, spec.task.id]));

  for (const readiness of plan.sourceGapExecutionReadiness.readinessByClosure) {
    const partition = readiness.workerPartition;
    const current = readinessByPartition.get(partition) ?? {
      taskIds: [],
      reuseKeys: [],
      visibleStates: [],
      drainBehavior: sourceGapLoopDrainBehavior(readiness.visibleStateAfterDecision)
    };
    const taskId = taskIdByReuseKey.get(readiness.reuseKey);
    if (taskId && !current.taskIds.includes(taskId)) {
      current.taskIds.push(taskId);
    }
    if (!current.reuseKeys.includes(readiness.reuseKey)) {
      current.reuseKeys.push(readiness.reuseKey);
    }
    if (!current.visibleStates.includes(readiness.visibleStateAfterDecision)) {
      current.visibleStates.push(readiness.visibleStateAfterDecision);
    }
    current.drainBehavior = sourceGapLoopDrainBehavior(readiness.visibleStateAfterDecision);
    readinessByPartition.set(partition, current);
  }

  return {
    schemaVersion: "ti.scheduler_source_gap_worker_loop.v1",
    generatedAt: now.toISOString(),
    loopId: options.loopId ?? "source_gap_worker_loop_dry_run",
    disabledByDefault: true,
    willMutate: entry.rehearsal.willMutate,
    pollIntervalSeconds: options.pollIntervalSeconds ?? 15,
    shutdownDeadlineSeconds: options.shutdownDeadlineSeconds ?? plan.sourceGapExecutionReadiness.workerDrain.controlledShutdownDeadlineSeconds,
    partitionPlan: [...readinessByPartition.entries()].map(([workerPartition, value]) => ({
      workerPartition,
      taskIds: value.taskIds,
      reuseKeys: value.reuseKeys,
      visibleStates: value.visibleStates,
      drainBehavior: value.drainBehavior
    })),
    entry,
    commitPolicy: entry.rehearsal.willMutate ? "single_repository_handoff_after_all_gates" : "return_blocked_receipt",
    nextLoopAction: entry.rehearsal.willMutate ? "handoff_to_repository_adapter" : "sleep_until_next_poll",
    forbiddenOperations: entry.forbiddenOperations
  };
}

export function runSchedulerSourceGapWorkerRunner(
  plan: SchedulerDailyActorRunPlanDto,
  repository: SchedulerQueueRepository,
  options: SchedulerSourceGapWorkerRunnerOptions = {}
): SchedulerSourceGapWorkerRunnerReceipt {
  const now = options.now ?? new Date();
  const maxIterations = Math.max(1, Math.min(options.maxIterations ?? 1, 3));
  const loops: SchedulerSourceGapWorkerLoopReceipt[] = [];

  for (let index = 0; index < maxIterations; index += 1) {
    const loop = runSchedulerSourceGapWorkerLoop(plan, repository, {
      ...options,
      loopId: `${options.loopId ?? "source_gap_worker_loop"}_${index + 1}`,
      now
    });
    loops.push(loop);
    if (!loop.willMutate || loop.nextLoopAction === "handoff_to_repository_adapter") {
      break;
    }
  }

  const latestLoop = loops[loops.length - 1];
  const willMutate = loops.some((loop) => loop.willMutate);
  const visibleStates = uniqueStrings(loops.flatMap((loop) => loop.partitionPlan.flatMap((partition) => partition.visibleStates))) as SchedulerSourceGapWorkerRunnerReceipt["productEffect"]["visibleStates"];
  const workerPartitions = uniqueStrings(loops.flatMap((loop) => loop.partitionPlan.map((partition) => partition.workerPartition))) as SchedulerSourceGapWorkerPartition[];
  const stopReason: SchedulerSourceGapWorkerRunnerReceipt["stopReason"] = willMutate
    ? "ready_handoff_prepared"
    : latestLoop?.nextLoopAction === "sleep_until_next_poll"
      ? "disabled_preview_complete"
      : "max_iterations_reached";

  return {
    schemaVersion: "ti.scheduler_source_gap_worker_runner.v1",
    generatedAt: now.toISOString(),
    runnerId: options.runnerId ?? "source_gap_worker_runner_dry_run",
    disabledByDefault: true,
    willMutate,
    maxIterations,
    loopCount: loops.length,
    stopReason,
    loops,
    productEffect: {
      dailyActorPreset: "source_gap_freshness_support",
      visibleStates,
      workerPartitions,
      nextOperatorAction: latestLoop?.nextLoopAction === "handoff_to_repository_adapter" ? "approve_repository_handoff" : "wait_for_next_poll"
    },
    forbiddenOperations: latestLoop?.forbiddenOperations ?? ["network_fetch", "lease_task", "ack_task", "raw_url_output", "payload_download", "credential_access", "actor_interaction"]
  };
}

function sourceGapLoopDrainBehavior(
  visibleState: "searching" | "partial" | "metadata_review"
): SchedulerSourceGapWorkerLoopReceipt["partitionPlan"][number]["drainBehavior"] {
  if (visibleState === "metadata_review") {
    return "metadata_review_hold";
  }
  if (visibleState === "partial") {
    return "checkpoint_and_requeue_by_reuse_key";
  }
  return "finish_or_checkpoint_before_shutdown";
}

export function buildSchedulerInteractiveSearchFreshness(input: {
  plan: CollectionPlan;
  run?: CollectionRun;
  attachedToActiveRun?: boolean;
  freshnessSloEngine: SchedulerFreshnessSloEngineDto;
  freshnessSloDashboard: SchedulerFreshnessSloDashboardDto;
  queueEconomics: SchedulerQueueEconomicsDto;
  workerQueueCutover: SchedulerWorkerQueueCutoverDto;
  fairnessGovernance: SchedulerFairnessGovernanceDto;
  now?: Date;
}): SchedulerInteractiveSearchFreshnessDto {
  const now = input.now ?? new Date();
  const normalizedQuery = input.plan.request.query.trim().toLowerCase();
  const actorMatch = input.freshnessSloDashboard.actors.find((actor) => normalizedQuery.includes(actor.actor.toLowerCase()));
  const configuredActor = input.freshnessSloEngine.queryClass === "actor" && !actorMatch && normalizedQuery.length > 0;
  const interactivePartition = input.workerQueueCutover.partitions.find((partition) => partition.workload === "interactive_actor_search")
    ?? input.workerQueueCutover.partitions[0];
  const backgroundDeferredWorkloads = input.freshnessSloDashboard.workloadActions
    .filter((action) => action.action === "drain_background" || action.action === "raise_priority_aging")
    .map((action) => action.workload);
  const observedFreshnessSeconds = actorMatch?.observedFreshnessSeconds
    ?? Math.round(input.freshnessSloEngine.slo.targetFreshnessSeconds * (configuredActor ? 1.1 : 0.75));
  const targetFreshnessSeconds = actorMatch?.targetFreshnessSeconds ?? input.freshnessSloEngine.slo.targetFreshnessSeconds;
  const emergency = input.freshnessSloEngine.queuePressureBehavior.state === "emergency_brake"
    || input.fairnessGovernance.releaseGate.decision === "rollback";
  const held = actorMatch?.state === "blocked" || input.plan.reviewRequired.length > 0;
  const stale = actorMatch?.state === "stale" || observedFreshnessSeconds > targetFreshnessSeconds || input.queueEconomics.totals.maxQueuedAgeSeconds > input.freshnessSloEngine.slo.maxQueueAgeSeconds;
  const aging = actorMatch?.state === "aging" || observedFreshnessSeconds >= Math.round(targetFreshnessSeconds * 0.75) || input.queueEconomics.totals.retryDebt > 0;
  const attachedToActiveRun = Boolean(input.attachedToActiveRun || input.run?.status === "running");
  const decision: SchedulerInteractiveSearchFreshnessDto["queueDecision"]["decision"] = emergency
    ? "emergency_hold"
    : held
      ? "metadata_review_hold"
      : attachedToActiveRun
        ? "reuse_active_run"
        : stale
          ? "raise_priority"
          : aging || actorMatch || configuredActor
            ? "enqueue_interactive_refresh"
            : "serve_partial_and_poll";
  const freshnessState: SchedulerInteractiveSearchFreshnessDto["currentQuery"]["freshnessState"] = emergency || held
    ? "held"
    : stale
      ? "stale"
      : aging
        ? "aging"
        : "fresh";
  const uiState: SchedulerInteractiveSearchFreshnessDto["uiSignals"]["state"] = emergency
    ? "degraded"
    : held
      ? "metadata_review"
      : input.run?.status === "completed"
        ? "ready"
        : input.run || actorMatch || configuredActor
          ? "partial"
          : "searching";
  const badgeSet = uniqueStrings([
    "source_freshness",
    ...(input.queueEconomics.totals.maxQueuedAgeSeconds > 0 ? ["queue_age"] : []),
    ...(attachedToActiveRun ? ["active_run_reuse"] : []),
    ...(stale || aging ? ["priority_aging"] : []),
    ...(input.queueEconomics.totals.retryDebt > 0 ? ["retry_backoff"] : []),
    ...(input.queueEconomics.totals.deadLetters > 0 ? ["dead_letter_review"] : []),
    ...(held ? ["restricted_metadata_hold"] : []),
    ...(backgroundDeferredWorkloads.length > 0 ? ["background_deferred"] : [])
  ]) as SchedulerInteractiveSearchFreshnessDto["uiSignals"]["badges"];
  const decisionReason: Record<SchedulerInteractiveSearchFreshnessDto["queueDecision"]["decision"], string> = {
    reuse_active_run: "Existing tenant/query reuse key is active, so polling attaches to the current run before any enqueue.",
    enqueue_interactive_refresh: "Interactive actor freshness is due but within safe pressure limits, so schedule the actor lane with protected polling.",
    raise_priority: "High-value actor freshness or queue age breached target, so raise priority aging before background sweeps.",
    serve_partial_and_poll: "No query-specific freshness breach is known yet; keep honest searching/partial state and poll every three seconds.",
    metadata_review_hold: "Restricted or review-required metadata is held without blocking clear-web polling or duplicate run reuse.",
    emergency_hold: "Emergency brake or fairness rollback state pauses new leases while preserving cursors and visible run reuse."
  };
  const releaseDecision: SchedulerInteractiveSearchFreshnessDto["releaseGate"]["decision"] = emergency
    ? "rollback"
    : held || stale || input.fairnessGovernance.releaseGate.decision === "hold"
      ? "hold"
      : "pass";
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/frontier/status", "/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/contracts", "frontend_ti_progressive_update"],
    dryRun: true,
    willMutate: false,
    schemaVersion: "ti.scheduler_interactive_search_freshness.v1",
    currentQuery: {
      query: input.plan.request.query,
      queryClass: input.freshnessSloEngine.queryClass,
      knownHighValueActor: Boolean(actorMatch || configuredActor),
      priorityBand: actorMatch?.priority === "daily"
        ? "urgent_actor"
        : actorMatch
          ? "high_value_actor"
          : configuredActor
            ? "normal_interactive"
            : "unknown_searching",
      targetFreshnessSeconds,
      observedFreshnessSeconds,
      freshnessState
    },
    queueDecision: {
      decision,
      reason: decisionReason[decision],
      nextPollSeconds: 3,
      retryAfterSeconds: Math.max(3, input.freshnessSloEngine.queuePressureBehavior.retryAfterSeconds),
      duplicateRunReuse: "required_before_enqueue",
      attachedToActiveRun,
      runId: input.run?.id,
      interactiveReservedWorkerSlots: interactivePartition?.reservedWorkerSlots ?? 1,
      maxInteractiveQueueAgeSeconds: interactivePartition?.maxQueueAgeSeconds ?? input.freshnessSloEngine.slo.maxQueueAgeSeconds,
      deferredBackgroundWorkloads: uniqueStrings(backgroundDeferredWorkloads).filter((workload) => workload !== "interactive_actor_search") as SchedulerWorkerWorkload[]
    },
    actorTargets: actorMatch
      ? [{
        actor: actorMatch.actor,
        priority: actorMatch.priority,
        state: actorMatch.state,
        targetFreshnessSeconds: actorMatch.targetFreshnessSeconds,
        observedFreshnessSeconds: actorMatch.observedFreshnessSeconds,
        schedulerAction: actorMatch.schedulerAction
      }]
      : configuredActor
        ? [{
          actor: "configured_actor",
          priority: "on_demand",
          state: "unknown_searching",
          targetFreshnessSeconds,
          observedFreshnessSeconds,
          schedulerAction: "keep_searching"
        }]
        : [],
    fairnessGuards: {
      preservesThreeSecondPolling: true,
      preservesDuplicateRunReuse: true,
      preservesCursorContinuity: true,
      backgroundWorkStillAges: true,
      lowValueSweepsDeferredBeforeActorStarvation: true,
      restrictedMetadataDoesNotBlockClearWeb: true,
      perSourceConcurrencyStillApplies: true
    },
    uiSignals: {
      state: uiState,
      badges: badgeSet,
      visibleSchedulerFields: ["freshness_state", "queue_decision", "next_poll_seconds", "retry_after_seconds", "duplicate_run_reuse", "deferred_background_workloads", "actor_targets"]
    },
    handoffs: {
      agent04Coverage: ["surface freshness gap remediation when actor target is stale", "keep unknown actors searching until query-specific public evidence exists"],
      agent06EvidenceReplay: ["request replay only when stale actor fields have durable evidence candidates", "preserve cursor-visible evidence deltas for active run reuse"],
      agent07QualityFreshness: ["hold stale recent-activity wording until freshness state is fresh or reviewed", "show restricted metadata caveats without promoting raw claims"],
      agent09FrontendContract: ["render queue decision, freshness state, retry-after, active-run reuse, and deferred workload badges", "do not collapse scheduler state to a flat searching spinner"],
      agent10Capacity: ["reserve interactive actor slots before broad sweeps", "page on emergency hold or repeated high-value stale actor breaches"]
    },
    routeContracts: {
      frontierStatusField: "scheduler.interactiveSearchFreshness",
      searchSchedulerField: "scheduler.interactiveSearchFreshness",
      runStatusField: "scheduler.interactiveSearchFreshness",
      contractsField: "surfaces.frontier.contracts.scheduler_interactive_search_freshness"
    },
    releaseGate: {
      decision: releaseDecision,
      reasons: uniqueStrings([
        ...(releaseDecision === "pass" ? ["interactive_freshness_scheduler_ready"] : []),
        ...(stale ? ["interactive_actor_freshness_stale"] : []),
        ...(held ? ["metadata_review_hold_visible"] : []),
        ...(emergency ? ["emergency_hold_preserves_polling"] : []),
        ...(attachedToActiveRun ? ["duplicate_run_reuse_active"] : [])
      ]),
      proofCommands: [
        "bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts",
        "bun run check",
        "bun run check:route-inventory",
        "bun run check:contract-index",
        "bun run check:api-regression"
      ]
    }
  };
}

export function buildSchedulerProductionLeaseSemantics(input: {
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  slaEnforcement: SchedulerSlaEnforcementDto;
  workerQueueCutover: SchedulerWorkerQueueCutoverDto;
  durableBackendReadiness: SchedulerDurableBackendReadinessDto;
  freshnessSloEngine: SchedulerFreshnessSloEngineDto;
  now?: Date;
}): SchedulerProductionLeaseSemanticsDto {
  const now = input.now ?? new Date();
  const pressureHold = input.slaEnforcement.state === "hold" || input.slaEnforcement.state === "rollback" || input.durableBackendReadiness.emergencyBrake.state !== "clear";
  const decision: SchedulerProductionLeaseSemanticsDto["releaseGate"]["decision"] =
    input.slaEnforcement.state === "rollback" || input.durableBackendReadiness.emergencyBrake.state === "engaged"
      ? "rollback"
      : pressureHold
        ? "hold"
        : "pass";
  const reasons = uniqueStrings([
    ...(input.workerQueueCutover.backendCutoverPackets.find((packet) => packet.backend === "postgres_advisory_queue")?.readiness === "ready_for_rehearsal" ? [] : ["postgres_cutover_not_ready"]),
    ...(input.queueEconomics.totals.deadLetters > 0 ? ["dead_letter_review_required"] : []),
    ...(input.queueEconomics.totals.retryDebt > 0 ? ["retry_debt_before_cutover"] : []),
    ...(input.freshnessSloEngine.queuePressureBehavior.state === "emergency_brake" ? ["freshness_emergency_brake"] : [])
  ]);
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/intel/search.scheduler", "/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/contracts", "agent10_release_artifacts"],
    dryRun: true,
    willMutate: false,
    currentBackend: "embedded_memory",
    primaryTargetBackend: "postgres_advisory_queue",
    futureBackends: ["redis_streams", "nats_jetstream"],
    postgresContract: {
      tables: ["frontier_tasks", "frontier_leases", "frontier_events", "crawl_budgets", "run_reuse_keys", "frontier_dead_letters"],
      enqueue: "insert frontier_tasks and frontier_events in one transaction after budget, source backoff, and reuse-key checks",
      lease: "select eligible tasks with FOR UPDATE SKIP LOCKED, reserve crawl budget, write frontier_leases, and append lease event before worker visibility",
      heartbeat: "extend lease_expires_at only for the owning worker and append heartbeat/checkpoint progress",
      acknowledge: "close lease and append completion event idempotently after capture/export/probe side effects are durable",
      retry: "increment retry count, compute deterministic next availability, release lease, and preserve cursor-visible retry event",
      deadLetter: "move exhausted work to frontier_dead_letters with source/backoff reason and safe operator fields",
      duplicateRunReuse: "unique tenant/query/reuse key attaches duplicate actor/public polls to the active run before enqueue",
      cursorReplay: "frontier_events_cursor_replay_required",
      emergencyBrake: "stop new leases, preserve active checkpoints, keep run reuse responses and public polling cursors available",
      workerShutdown: "drain by pausing new leases, checkpointing active leases, then letting finite leases expire or acknowledge safely"
    },
    leaseLifecycle: buildProductionLeaseLifecycle(),
    cutoverPhases: buildProductionQueueCutoverPhases(input),
    fairness: {
      tenantIsolation: "tenant_then_reuse_key_then_source_family",
      noisySourcePolicy: "cap_and_age_without_starving_live_search",
      lowValueSweepPolicy: "bounded_under_pressure",
      priorityAging: input.freshnessSloEngine.fairnessAging.map((lane) => ({
        workload: lane.workload,
        agingBoostEverySeconds: lane.agingBoostEverySeconds,
        maxBoost: lane.maxBoost
      }))
    },
    safety: {
      preservesThreeSecondPolling: true,
      duplicateActorQueryRunsSuppressed: true,
      cursorContinuity: "preserved",
      dryRunApplyPlanOnly: true,
      restrictedMetadataRemainsApprovalGated: true
    },
    releaseGate: {
      decision,
      reasons: reasons.length > 0 ? reasons : ["postgres_queue_cutover_semantics_ready_for_rehearsal"],
      proofCommands: [
        "bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts",
        "bun run check",
        "bun run check:frontier-apply-plan",
        "bun run check:route-inventory",
        "bun run check:contract-index"
      ]
    },
    routeContracts: {
      frontierStatusField: "scheduler.productionLeaseSemantics",
      frontierApplyPlanField: "applyPlan.productionLeaseSemantics",
      contractsField: "surfaces.frontier.contracts.production_queue_lease_semantics"
    }
  };
}

export function buildSchedulerFairnessGovernance(input: {
  plan: CollectionPlan;
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  slaEnforcement: SchedulerSlaEnforcementDto;
  workerQueueCutover: SchedulerWorkerQueueCutoverDto;
  durableBackendReadiness: SchedulerDurableBackendReadinessDto;
  freshnessSloEngine: SchedulerFreshnessSloEngineDto;
  productionLeaseSemantics: SchedulerProductionLeaseSemanticsDto;
  now?: Date;
}): SchedulerFairnessGovernanceDto {
  const now = input.now ?? new Date();
  const tenantIds = uniqueStrings([
    input.plan.tenantId ?? "default",
    ...input.plan.tasks.map((task) => task.tenantId ?? input.plan.tenantId),
    ...input.plan.reviewRequired.map((task) => task.tenantId ?? input.plan.tenantId)
  ]);
  const queryClasses = schedulerBudgetQueryClasses(input.plan);
  const lanes = tenantIds.flatMap((tenantId) =>
    queryClasses.map((queryClass) => schedulerTenantBudgetLane({
      tenantId,
      queryClass,
      queueEconomics: input.queueEconomics,
      runtimeExecution: input.runtimeExecution,
      slaEnforcement: input.slaEnforcement,
      freshnessSloEngine: input.freshnessSloEngine
    }))
  );
  const pressure = input.slaEnforcement.state === "warning" || input.slaEnforcement.state === "hold" || input.queueEconomics.totals.retryDebt > 0 || input.queueEconomics.fairness.ok === false;
  const emergency = input.slaEnforcement.state === "rollback" || input.durableBackendReadiness.emergencyBrake.state === "engaged" || input.productionLeaseSemantics.releaseGate.decision === "rollback";
  const decision: SchedulerFairnessGovernanceDto["releaseGate"]["decision"] = emergency
    ? "rollback"
    : pressure || lanes.some((lane) => lane.state === "pressure" || lane.state === "throttled" || lane.state === "emergency_hold")
      ? "hold"
      : "pass";
  const reasons = uniqueStrings([
    ...(input.queueEconomics.fairness.ok ? [] : ["per_source_fairness_slo_breached"]),
    ...(input.queueEconomics.totals.retryDebt > 0 ? ["retry_debt_before_budget_promotion"] : []),
    ...(input.queueEconomics.totals.deadLetters > 0 ? ["dead_letters_excluded_from_interactive_budget"] : []),
    ...(input.runtimeExecution.sourceActivationBudgetGuard.state === "within_budget" ? [] : ["source_activation_budget_guard_active"]),
    ...(input.productionLeaseSemantics.safety.preservesThreeSecondPolling ? [] : ["polling_semantics_not_preserved"]),
    ...(emergency ? ["emergency_brake_holds_new_leases"] : [])
  ]);
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/intel/search.scheduler", "/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/runs/{id}", "/v1/contracts", "agent10_capacity_artifacts"],
    dryRun: true,
    willMutate: false,
    tenants: {
      defaultTenantId: input.plan.tenantId ?? "default",
      isolationKey: "tenant:queryClass:reuseKey:sourceFamily",
      crossTenantBorrowing: "disabled_until_budget_headroom",
      noisyTenantPolicy: "cap_retry_debt_and_preserve_live_polling"
    },
    queryClassBudgets: lanes,
    workloadFairness: input.workerQueueCutover.partitions.map((partition) => ({
      workload: partition.workload,
      reservedWorkerSlots: partition.reservedWorkerSlots,
      maxConcurrentLeases: partition.maxConcurrentLeases,
      agingBoostEverySeconds: Math.max(30, Math.round(partition.maxQueueAgeSeconds / 6)),
      queuePressureAction: schedulerWorkloadPressureAction(partition.workload, pressure, emergency),
      preservesThreeSecondPolling: true
    })),
    priorityAging: lanes.map((lane) => ({
      queryClass: lane.queryClass,
      workClass: lane.workClass,
      agingBoostEverySeconds: lane.agingBoostEverySeconds,
      maxBoost: lane.workClass === "interactive_live_search" || lane.workClass === "analyst_deep_dive" ? 0.45 : 0.25,
      neverBypassPerSourceConcurrency: true
    })),
    pressurePolicy: {
      publicPolling: "always_return_status_with_three_second_hint",
      duplicateRunReuse: "required_before_enqueue",
      retryBackoff: "deterministic_per_tenant_query_source",
      deadLetterReuse: "dead_letters_do_not_consume_interactive_budget",
      emergencyBrake: "pause_new_leases_preserve_cursors_and_reuse",
      lowValueSweeps: "bounded_and_deferred_before_interactive_starvation",
      workerDrain: "drain_noninteractive_first_preserve_replay"
    },
    fairnessSlo: {
      worstSourceShare: input.queueEconomics.fairness.worstShare,
      maxAllowedSourceShare: DEFAULT_SCHEDULER_EXECUTION_SLO.perSourceFairnessWorstShare,
      ok: input.queueEconomics.fairness.ok,
      noisySources: input.runtimeExecution.bySource.filter((source) => source.noisy).map((source) => source.sourceId).slice(0, 8),
      retryAfterSeconds: Math.max(3, Math.max(...lanes.map((lane) => lane.retryAfterSeconds)))
    },
    handoffs: {
      agent01SourceActivation: ["source activation waves consume source_health_probe and broad_daily_sweep budget only after tenant headroom is green"],
      agent03AdapterCertification: ["adapter repair queues receive bounded budget and never preempt active actor/victim public searches"],
      agent04PublicExpansion: ["public expansion windows are throttled by source-family fairness and noisy-source caps"],
      agent06EvidenceReplay: ["evidence replay and retention are reserved but drained behind live polling under pressure"],
      agent07Quality: ["quality or freshness review can raise aging boosts without bypassing per-source concurrency"],
      agent09ApiContracts: ["status, run, and apply-plan routes expose retry-after, budget state, and duplicate reuse semantics"],
      agent10Capacity: ["capacity packets can promote only when tenant lanes, retry debt, and emergency brake state are green"]
    },
    releaseGate: {
      decision,
      reasons: reasons.length > 0 ? reasons : ["multi_tenant_budget_fairness_governance_ready"],
      proofCommands: [
        "bun run check",
        "bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts",
        "bun run check:route-inventory",
        "bun run check:contract-index"
      ]
    },
    routeContracts: {
      frontierStatusField: "scheduler.fairnessGovernance",
      frontierApplyPlanField: "applyPlan.fairnessGovernance",
      runStatusField: "scheduler.fairnessGovernance",
      contractsField: "surfaces.frontier.contracts.multi_tenant_fairness_governance"
    }
  };
}

export function buildSchedulerPersistenceReplayCutover(input: {
  plan: CollectionPlan;
  runs?: CollectionRun[];
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  slaEnforcement: SchedulerSlaEnforcementDto;
  productionLeaseSemantics: SchedulerProductionLeaseSemanticsDto;
  fairnessGovernance: SchedulerFairnessGovernanceDto;
  now?: Date;
}): SchedulerPersistenceReplayCutoverDto {
  const now = input.now ?? new Date();
  const hasActiveReusableRun = (input.runs ?? []).some((run) =>
    run.status === "queued" || run.status === "running"
  );
  const pressureHold = input.slaEnforcement.state === "hold" ||
    input.fairnessGovernance.releaseGate.decision === "hold" ||
    input.productionLeaseSemantics.releaseGate.decision === "hold";
  const rollback = input.slaEnforcement.state === "rollback" ||
    input.fairnessGovernance.releaseGate.decision === "rollback" ||
    input.productionLeaseSemantics.releaseGate.decision === "rollback";
  const decision: SchedulerPersistenceReplayCutoverDto["releaseGate"]["decision"] = rollback ? "rollback" : pressureHold ? "hold" : "pass";
  const reasons = uniqueStrings([
    ...(input.queueEconomics.totals.retryDebt > 0 ? ["retry_state_must_replay_before_cutover"] : []),
    ...(input.queueEconomics.totals.deadLetters > 0 ? ["dead_letter_context_requires_operator_visible_replay"] : []),
    ...(hasActiveReusableRun ? ["active_public_runs_require_reuse_key_replay"] : []),
    ...(input.fairnessGovernance.fairnessSlo.ok ? [] : ["fairness_budget_snapshot_required_before_restart"]),
    ...(rollback ? ["scheduler_release_gate_rollback"] : [])
  ]);
  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/intel/search.scheduler", "/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/runs/{id}", "/v1/contracts", "agent09_public_api_fields", "agent10_capacity_release_gate"],
    dryRun: true,
    willMutate: false,
    currentBackend: "embedded_memory",
    primaryTargetBackend: "postgres_scheduler_store",
    descriptorBackends: ["redis_streams", "nats_jetstream"],
    postgresContracts: schedulerPersistencePostgresContracts(),
    replaySemantics: {
      duplicatePublicActorSearch: "tenant_query_reuse_key_reattaches_to_active_run",
      refreshAfterSeconds: 3,
      pollCursor: "restored_from_scheduler_cursor_events",
      deltaCursor: "restored_from_latest_safe_delta",
      statusTransitions: ["queued", "running", "metadata_review", "partial", "completed", "failed", "cancelled"],
      unknownActorPolicy: "searching_only_until_query_matched_evidence",
      noDefaultActorFallback: true,
      noStaleCacheReady: true,
      noGenericLivePromotion: true
    },
    restartFixtures: schedulerPersistenceReplayFixtures(input),
    cutoverPhases: schedulerPersistenceCutoverPhases(),
    routeContracts: {
      frontierStatusField: "scheduler.persistenceReplayCutover",
      frontierApplyPlanField: "applyPlan.persistenceReplayCutover",
      runStatusField: "scheduler.persistenceReplayCutover",
      contractsField: "surfaces.frontier.contracts.scheduler_persistence_replay_cutover"
    },
    handoffs: {
      agent09PublicApiFields: ["refreshAfterSeconds=3", "pollCursor", "deltaCursor", "status", "runId", "warningCodes", "duplicateRunReuse"],
      agent10CapacityReleaseGate: ["restart replay fixture pass", "worker drain replay pass", "emergency brake cursor preservation", "fairness budget snapshot replay", "Postgres store remains disabled until capacity gate passes"]
    },
    releaseGate: {
      decision,
      reasons: reasons.length > 0 ? reasons : ["scheduler_persistence_replay_cutover_ready_for_rehearsal"],
      proofCommands: [
        "bun run check",
        "bun test src/tests/schedulerProduction.test.ts src/tests/api.test.ts",
        "bun run check:route-inventory",
        "bun run check:contract-index",
        "bun run check:api-regression"
      ]
    }
  };
}

function schedulerPersistencePostgresContracts(): SchedulerPersistenceReplayCutoverDto["postgresContracts"] {
  return [
    ["scheduler_runs", "durable public and analyst run state", ["tenant_id", "run_id", "reuse_key"], "reattach duplicate public polling and restore run status after restart"],
    ["frontier_tasks", "queued/completed frontier task state", ["tenant_id", "task_id", "run_id"], "restore queued work, source backoff, deadlines, and budget class"],
    ["frontier_leases", "finite worker lease ownership", ["task_id", "worker_id", "lease_expires_at"], "recover expired leases and preserve active checkpoint state"],
    ["worker_heartbeats", "worker liveness and checkpoint cadence", ["worker_id", "task_id", "heartbeat_at"], "distinguish stale worker leases from actively progressing work"],
    ["scheduler_checkpoints", "task progress and promoted evidence counters", ["task_id", "checkpoint_cursor"], "resume polling state without duplicating side effects"],
    ["scheduler_cursor_events", "append-only polling and queue transition stream", ["tenant_id", "run_id", "cursor"], "rebuild pollCursor, deltaCursor, and public status transitions"],
    ["scheduler_retry_dead_letters", "retry debt and dead-letter context", ["task_id", "attempt", "reason_code"], "replay retry/backoff without spending interactive budget"],
    ["scheduler_fairness_budget_snapshots", "tenant/query/source fairness budgets", ["tenant_id", "query_class", "snapshot_at"], "restore fairness lanes and noisy-source caps before leasing"],
    ["scheduler_worker_drain_state", "drain and emergency-brake state", ["partition_id", "drain_started_at"], "restart worker drains without losing cursor replay or active run reuse"]
  ].map(([table, purpose, keyFields, replayRole]) => ({
    table: table as SchedulerPersistenceReplayCutoverDto["postgresContracts"][number]["table"],
    purpose: purpose as string,
    keyFields: keyFields as string[],
    replayRole: replayRole as string
  }));
}

function schedulerPersistenceReplayFixtures(input: {
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  fairnessGovernance: SchedulerFairnessGovernanceDto;
}): SchedulerPersistenceReplayCutoverDto["restartFixtures"] {
  const commonRows: SchedulerPersistenceReplayCutoverDto["restartFixtures"][number]["persistedRows"] = ["runs", "frontier_tasks", "cursor_events", "fairness_budget_snapshots"];
  type RestartFixtureSeed = Omit<SchedulerPersistenceReplayCutoverDto["restartFixtures"][number], "dryRun" | "willMutate" | "preservesThreeSecondPolling" | "preservesCursorContinuity" | "duplicateRunReuseRequired">;
  const fixtures = [
    {
      name: "queued_actor_search_restart",
      persistedRows: commonRows,
      replayExpectation: "queued actor search restores run id, queued tasks, refreshAfterSeconds=3, pollCursor, and searching/queued status without creating a new run",
      expectedStatus: "queued"
    },
    {
      name: "leased_heartbeat_expiry",
      persistedRows: ["runs", "frontier_tasks", "frontier_leases", "worker_heartbeats", "checkpoints", "cursor_events"],
      replayExpectation: "expired worker heartbeat releases the lease, keeps the latest checkpoint cursor, and requeues the task with deterministic retry/backoff",
      expectedStatus: "running"
    },
    {
      name: "restricted_metadata_hold",
      persistedRows: ["runs", "frontier_tasks", "cursor_events", "fairness_budget_snapshots"],
      replayExpectation: "restricted metadata-only hold survives restart and remains review-gated without raw payload collection or ready-without-evidence behavior",
      expectedStatus: "metadata_review"
    },
    {
      name: "dead_letter_retry_replay",
      persistedRows: ["runs", "frontier_tasks", "retry_dead_letters", "cursor_events", "fairness_budget_snapshots"],
      replayExpectation: `retry/dead-letter context restores ${input.queueEconomics.totals.retryDebt} retry-debt task(s) without consuming interactive budget`,
      expectedStatus: "failed"
    },
    {
      name: "duplicate_public_run_reuse",
      persistedRows: ["runs", "frontier_tasks", "cursor_events", "fairness_budget_snapshots"],
      replayExpectation: "same tenant/query/reuse key attaches to the active run and preserves refreshAfterSeconds=3, pollCursor, deltaCursor, and status transitions",
      expectedStatus: "searching"
    },
    {
      name: "worker_drain_restart",
      persistedRows: ["runs", "frontier_tasks", "frontier_leases", "worker_heartbeats", "checkpoints", "cursor_events", "worker_drain_state"],
      replayExpectation: `worker drain restores ${input.runtimeExecution.dryRunControls.controls.length} dry-run control(s), pauses noninteractive leases first, and preserves replay cursors`,
      expectedStatus: "running"
    },
    {
      name: "emergency_brake_restart",
      persistedRows: ["runs", "frontier_tasks", "frontier_leases", "checkpoints", "cursor_events", "fairness_budget_snapshots", "worker_drain_state"],
      replayExpectation: `emergency brake resumes with retryAfterSeconds=${input.fairnessGovernance.fairnessSlo.retryAfterSeconds}, no new leases, and active run reuse still available`,
      expectedStatus: "running"
    }
  ] satisfies RestartFixtureSeed[];
  return fixtures.map((fixture) => ({
    ...fixture,
    dryRun: true,
    willMutate: false,
    preservesThreeSecondPolling: true,
    preservesCursorContinuity: true,
    duplicateRunReuseRequired: true
  }));
}

function schedulerPersistenceCutoverPhases(): SchedulerPersistenceReplayCutoverDto["cutoverPhases"] {
  const mk = (
    phase: SchedulerPersistenceReplayCutoverDto["cutoverPhases"][number]["phase"],
    requiredChecks: string[],
    rollback: string
  ): SchedulerPersistenceReplayCutoverDto["cutoverPhases"][number] => ({
    phase,
    dryRun: true,
    willMutate: false,
    requiredChecks,
    rollback
  });
  return [
    mk("snapshot_embedded", ["embedded queue, runs, cursors, retry debt, dead letters, and fairness budgets are serializable"], "continue embedded memory scheduler and discard the snapshot"),
    mk("shadow_write_postgres", ["Postgres table contracts accept mirrored rows without becoming the active lease owner"], "stop shadow writes and replay from embedded memory events"),
    mk("restart_replay_rehearsal", ["all restart fixtures restore pollCursor, deltaCursor, status, queue state, and retry/backoff"], "keep embedded scheduler authoritative"),
    mk("duplicate_reuse_canary", ["same tenant/query/reuse key reattaches to active run and preserves refreshAfterSeconds=3"], "disable durable reuse-key reads and fall back to embedded run index"),
    mk("worker_drain_replay", ["drain state, checkpoints, and lease expiry recover without duplicate side effects"], "resume embedded worker drain controls"),
    mk("cutover_hold_or_promote", ["Agent 09 API fields and Agent 10 capacity gate are green"], "hold promotion until public API and capacity proofs pass"),
    mk("rollback", ["cursor events replay from the last embedded-authoritative checkpoint"], "restore embedded memory scheduler and replay safe cursor events")
  ];
}

export function buildSchedulerPostgresQueueAdapterReadiness(input: {
  config?: {
    queueBackend?: "embedded_memory" | "postgres_scheduler_store";
    postgresQueueEnabled?: boolean;
    postgresDsnConfigured?: boolean;
    postgresShadowWritesEnabled?: boolean;
    postgresLeaseMode?: "disabled" | "shadow" | "active";
  };
  persistenceReplayCutover: SchedulerPersistenceReplayCutoverDto;
  now?: Date;
}): SchedulerPostgresQueueAdapterReadinessDto {
  const now = input.now ?? new Date();
  const requestedBackend = input.config?.queueBackend ?? "embedded_memory";
  const postgresEnabled = input.config?.postgresQueueEnabled === true;
  const postgresDsnConfigured = input.config?.postgresDsnConfigured === true;
  const shadowWritesEnabled = input.config?.postgresShadowWritesEnabled === true;
  const leaseMode = input.config?.postgresLeaseMode ?? "disabled";
  const activeBackend = requestedBackend === "postgres_scheduler_store" && postgresEnabled && postgresDsnConfigured && leaseMode === "active"
    ? "postgres_scheduler_store"
    : "embedded_memory";
  const reasons = uniqueStrings([
    ...(requestedBackend === "postgres_scheduler_store" ? ["postgres_scheduler_store_requested"] : ["embedded_memory_requested"]),
    ...(!postgresEnabled ? ["postgres_queue_feature_flag_disabled"] : []),
    ...(postgresEnabled && !postgresDsnConfigured ? ["postgres_dsn_missing_fail_closed"] : []),
    ...(shadowWritesEnabled ? ["postgres_shadow_writes_do_not_own_leases"] : []),
    ...(leaseMode === "active" && activeBackend !== "postgres_scheduler_store" ? ["active_lease_mode_blocked_until_dsn_and_executor_ready"] : [])
  ]);
  const decision: SchedulerPostgresQueueAdapterReadinessDto["releaseGate"]["decision"] = activeBackend === "postgres_scheduler_store"
    ? "hold"
    : "pass";

  return {
    generatedAt: now.toISOString(),
    apiTargets: ["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/search.scheduler", "/v1/contracts", "agent10_capacity_release_gate"],
    backendSelection: {
      activeBackend,
      requestedBackend,
      postgresEnabled,
      postgresDsnConfigured,
      shadowWritesEnabled,
      leaseMode,
      effectiveLeaseOwner: activeBackend
    },
    safety: {
      disabledByDefault: true,
      failClosedWithoutDsn: true,
      failClosedWithoutExecutor: true,
      noImplicitNetworkDependency: true,
      embeddedMemoryRemainsAuthoritative: activeBackend === "embedded_memory",
      publicSearchPollingProtected: true
    },
    operationContracts: schedulerPostgresQueueOperationContracts(input.persistenceReplayCutover),
    preparedStatements: schedulerPostgresQueuePreparedStatements(),
    routeContracts: {
      frontierStatusField: "scheduler.postgresQueueAdapter",
      frontierApplyPlanField: "applyPlan.postgresQueueAdapter",
      contractsField: "surfaces.frontier.contracts.scheduler_postgres_queue_adapter"
    },
    releaseGate: {
      decision,
      reasons,
      proofCommands: [
        "bun run check",
        "bun test src/tests/config.test.ts src/tests/schedulerProduction.test.ts src/tests/api.test.ts",
        "bun run check:contract-index",
        "bun run check:api-regression"
      ]
    }
  };
}

function schedulerPostgresQueueOperationContracts(
  persistenceReplayCutover: SchedulerPersistenceReplayCutoverDto
): SchedulerPostgresQueueAdapterReadinessDto["operationContracts"] {
  const knownTables = new Set(persistenceReplayCutover.postgresContracts.map((contract) => contract.table));
  const tables = <T extends SchedulerPostgresQueueAdapterReadinessDto["operationContracts"][number]["postgresTableContracts"]>(values: T): T =>
    values.filter((value) => knownTables.has(value)) as T;
  return [
    {
      operation: "enqueueTasks",
      postgresTableContracts: tables(["frontier_tasks", "scheduler_cursor_events", "scheduler_fairness_budget_snapshots"]),
      transactionBoundary: "insert tasks idempotently by tenant/task/run, append cursor events, never take leases inside enqueue",
      disabledBehavior: "uses_embedded_memory"
    },
    {
      operation: "leaseNext",
      postgresTableContracts: tables(["frontier_tasks", "frontier_leases", "worker_heartbeats", "scheduler_fairness_budget_snapshots"]),
      transactionBoundary: "select fair eligible task with row lock, write finite lease, write heartbeat seed, commit before worker execution",
      disabledBehavior: "throws_fail_closed"
    },
    {
      operation: "heartbeatLease",
      postgresTableContracts: tables(["frontier_leases", "worker_heartbeats"]),
      transactionBoundary: "extend only owned non-expired lease and append heartbeat in one transaction",
      disabledBehavior: "throws_fail_closed"
    },
    {
      operation: "checkpointTask",
      postgresTableContracts: tables(["frontier_leases", "scheduler_checkpoints", "scheduler_cursor_events"]),
      transactionBoundary: "verify lease owner, append checkpoint and cursor event atomically",
      disabledBehavior: "throws_fail_closed"
    },
    {
      operation: "acknowledge",
      postgresTableContracts: tables(["frontier_tasks", "frontier_leases", "scheduler_retry_dead_letters", "scheduler_cursor_events"]),
      transactionBoundary: "verify lease owner, update terminal/retry/dead-letter state, release lease, append cursor event",
      disabledBehavior: "throws_fail_closed"
    },
    {
      operation: "cancelRun",
      postgresTableContracts: tables(["scheduler_runs", "frontier_tasks", "frontier_leases", "scheduler_cursor_events"]),
      transactionBoundary: "mark run cancelled and release queued/leased tasks for the run in one transaction",
      disabledBehavior: "throws_fail_closed"
    },
    {
      operation: "findOrRegisterRun",
      postgresTableContracts: tables(["scheduler_runs", "scheduler_cursor_events"]),
      transactionBoundary: "upsert by tenant/reuse key and return active queued/running run without duplicate enqueue storm",
      disabledBehavior: "uses_embedded_memory"
    },
    {
      operation: "gcActiveRuns",
      postgresTableContracts: tables(["scheduler_runs", "scheduler_cursor_events"]),
      transactionBoundary: "derive stale/abandoned decisions from durable updated_at and polling cursor state without mutating unless apply-plan is approved",
      disabledBehavior: "uses_embedded_memory"
    },
    {
      operation: "pressure",
      postgresTableContracts: tables(["frontier_tasks", "frontier_leases", "scheduler_retry_dead_letters", "scheduler_fairness_budget_snapshots"]),
      transactionBoundary: "read-only compact aggregation for queue age, retry debt, dead letters, and fairness lanes",
      disabledBehavior: "uses_embedded_memory"
    },
    {
      operation: "deltasSince",
      postgresTableContracts: tables(["scheduler_cursor_events"]),
      transactionBoundary: "read-only append-only cursor scan ordered by cursor sequence",
      disabledBehavior: "uses_embedded_memory"
    },
    {
      operation: "runs",
      postgresTableContracts: tables(["scheduler_runs"]),
      transactionBoundary: "read-only run snapshot for API status and duplicate reuse",
      disabledBehavior: "uses_embedded_memory"
    },
    {
      operation: "tasks",
      postgresTableContracts: tables(["frontier_tasks", "frontier_leases"]),
      transactionBoundary: "read-only queued and leased task snapshot for status and scheduler economics",
      disabledBehavior: "uses_embedded_memory"
    }
  ];
}

function schedulerPostgresQueuePreparedStatements(): SchedulerPostgresQueueAdapterReadinessDto["preparedStatements"] {
  return [
    {
      name: "scheduler_runs_upsert_reuse_key_v1",
      purpose: "register or reattach public actor searches by tenant/query reuse key",
      tables: ["scheduler_runs", "scheduler_cursor_events"],
      idempotencyKeyFields: ["tenant_id", "reuse_key", "request_hash"]
    },
    {
      name: "frontier_tasks_enqueue_idempotent_v1",
      purpose: "enqueue work without duplicate task storms after restart or repeated polling",
      tables: ["frontier_tasks", "scheduler_cursor_events"],
      idempotencyKeyFields: ["tenant_id", "task_id", "run_id"]
    },
    {
      name: "frontier_tasks_lease_fair_next_v1",
      purpose: "lease the next eligible task with tenant/query/source fairness and finite expiry",
      tables: ["frontier_tasks", "frontier_leases", "worker_heartbeats", "scheduler_fairness_budget_snapshots"],
      idempotencyKeyFields: ["task_id", "worker_id", "lease_epoch"]
    },
    {
      name: "frontier_leases_checkpoint_ack_v1",
      purpose: "checkpoint, retry, dead-letter, or complete a leased task without duplicate side effects",
      tables: ["frontier_tasks", "frontier_leases", "scheduler_checkpoints", "scheduler_retry_dead_letters", "scheduler_cursor_events"],
      idempotencyKeyFields: ["task_id", "worker_id", "checkpoint_cursor"]
    },
    {
      name: "scheduler_worker_drain_restore_v1",
      purpose: "restore drain and emergency-brake state before workers resume leasing",
      tables: ["scheduler_worker_drain_state", "scheduler_cursor_events"],
      idempotencyKeyFields: ["partition_id", "drain_started_at"]
    }
  ];
}

export class PostgresSchedulerQueueRepository implements SchedulerQueueRepository {
  constructor(private readonly options: {
    enabled: boolean;
    dsnConfigured: boolean;
    executorAvailable?: boolean;
  }) {}

  enqueueTasks(_tasks: CollectionTask[], _now?: Date): SchedulerRuntimeDelta[] {
    return this.failClosed("enqueueTasks");
  }

  leaseNext(_workerId: string, _now?: Date): SchedulerLease | undefined {
    return this.failClosed("leaseNext");
  }

  heartbeatLease(_taskId: string, _workerId: string, _now?: Date): SchedulerRuntimeDelta {
    return this.failClosed("heartbeatLease");
  }

  checkpointTask(_taskId: string, _workerId: string, _checkpoint: SchedulerTaskCheckpoint, _now?: Date): SchedulerRuntimeDelta {
    return this.failClosed("checkpointTask");
  }

  acknowledge(_taskId: string, _status: SchedulerRuntimeAckStatus, _now?: Date, _reason?: string): SchedulerRuntimeDelta {
    return this.failClosed("acknowledge");
  }

  cancelRun(_runId: string, _now?: Date, _reason?: string): SchedulerRuntimeDelta[] {
    return this.failClosed("cancelRun");
  }

  findOrRegisterRun(_run: CollectionRun, _reuseKey?: string, _now?: Date): { run: CollectionRun; reused: boolean; duplicateReuseCount: number } {
    return this.failClosed("findOrRegisterRun");
  }

  gcActiveRuns(_now?: Date, _options?: ActiveRunGcOptions): ActiveRunGcDecision[] {
    return this.failClosed("gcActiveRuns");
  }

  pressure(_now?: Date): SchedulerPressureDto[] {
    return this.failClosed("pressure");
  }

  deltasSince(_cursor?: string): SchedulerRuntimeDelta[] {
    return this.failClosed("deltasSince");
  }

  runs(): CollectionRun[] {
    return this.failClosed("runs");
  }

  tasks(): CollectionTask[] {
    return this.failClosed("tasks");
  }

  private failClosed(operation: string): never {
    const reason = !this.options.enabled
      ? "feature flag disabled"
      : !this.options.dsnConfigured
        ? "Postgres DSN missing"
        : !this.options.executorAvailable
          ? "Postgres executor unavailable"
          : "active Postgres scheduler queue promotion is not enabled";
    throw new Error(`Postgres scheduler queue adapter fail-closed for ${operation}: ${reason}`);
  }
}

export function createSchedulerQueueRepository(input: {
  backend?: "embedded_memory" | "postgres_scheduler_store";
  postgresEnabled?: boolean;
  postgresDsnConfigured?: boolean;
  postgresExecutorAvailable?: boolean;
} = {}): SchedulerQueueRepository {
  if (input.backend !== "postgres_scheduler_store") return new InMemorySchedulerQueueRepository();
  if (!input.postgresEnabled || !input.postgresDsnConfigured || !input.postgresExecutorAvailable) return new InMemorySchedulerQueueRepository();
  return new PostgresSchedulerQueueRepository({
    enabled: input.postgresEnabled,
    dsnConfigured: input.postgresDsnConfigured,
    executorAvailable: input.postgresExecutorAvailable
  });
}

export function schedulerSoakBackpressurePacket(simulation: SchedulerExecutionSimulationResult) {
  return simulation.backpressure.agent10SoakPacket;
}

type SchedulerFreshnessProfile = {
  targetFreshnessSeconds: number;
  staleAfterSeconds: number;
  emergencyStaleAfterSeconds: number;
  minCadenceSeconds: number;
  maxCadenceSeconds: number;
  maxQueueAgeSeconds: number;
};

function schedulerFreshnessQueryClass(plan: CollectionPlan): SchedulerFreshnessQueryClass {
  const query = plan.request.query.toLowerCase();
  if (plan.request.entityType === "cve" || /\bcve-\d{4}-\d{4,}\b/i.test(plan.request.query)) return "cve_advisory";
  if (plan.request.entityType === "malware") return "malware_tool";
  if (plan.request.entityType === "campaign") return "campaign";
  if (plan.request.entityType === "sector") return "sector";
  if (plan.request.entityType === "country") return "country";
  if (plan.request.entityType === "victim") return "victim_company";
  if (plan.request.entityType === "infrastructure" || plan.request.entityType === "indicator") return "infrastructure";
  if (query.includes("ransomware") || ["akira", "lockbit", "blackcat", "clop"].some((name) => query.includes(name))) return "ransomware";
  if (/unknown|random|made up|unrecognized/i.test(plan.request.query)) return "unknown";
  return "actor";
}

function freshnessProfileForQueryClass(queryClass: SchedulerFreshnessQueryClass): SchedulerFreshnessProfile {
  switch (queryClass) {
    case "actor":
      return { targetFreshnessSeconds: 1_800, staleAfterSeconds: 7_200, emergencyStaleAfterSeconds: 21_600, minCadenceSeconds: 300, maxCadenceSeconds: 7_200, maxQueueAgeSeconds: 180 };
    case "ransomware":
      return { targetFreshnessSeconds: 900, staleAfterSeconds: 3_600, emergencyStaleAfterSeconds: 10_800, minCadenceSeconds: 180, maxCadenceSeconds: 3_600, maxQueueAgeSeconds: 120 };
    case "cve_advisory":
      return { targetFreshnessSeconds: 1_200, staleAfterSeconds: 3_600, emergencyStaleAfterSeconds: 14_400, minCadenceSeconds: 180, maxCadenceSeconds: 7_200, maxQueueAgeSeconds: 180 };
    case "campaign":
      return { targetFreshnessSeconds: 3_600, staleAfterSeconds: 14_400, emergencyStaleAfterSeconds: 43_200, minCadenceSeconds: 600, maxCadenceSeconds: 14_400, maxQueueAgeSeconds: 300 };
    case "malware_tool":
      return { targetFreshnessSeconds: 3_600, staleAfterSeconds: 14_400, emergencyStaleAfterSeconds: 43_200, minCadenceSeconds: 600, maxCadenceSeconds: 14_400, maxQueueAgeSeconds: 300 };
    case "sector":
      return { targetFreshnessSeconds: 7_200, staleAfterSeconds: 28_800, emergencyStaleAfterSeconds: 86_400, minCadenceSeconds: 900, maxCadenceSeconds: 28_800, maxQueueAgeSeconds: 600 };
    case "country":
      return { targetFreshnessSeconds: 7_200, staleAfterSeconds: 28_800, emergencyStaleAfterSeconds: 86_400, minCadenceSeconds: 900, maxCadenceSeconds: 28_800, maxQueueAgeSeconds: 600 };
    case "victim_company":
      return { targetFreshnessSeconds: 1_800, staleAfterSeconds: 7_200, emergencyStaleAfterSeconds: 21_600, minCadenceSeconds: 300, maxCadenceSeconds: 7_200, maxQueueAgeSeconds: 180 };
    case "infrastructure":
      return { targetFreshnessSeconds: 900, staleAfterSeconds: 3_600, emergencyStaleAfterSeconds: 10_800, minCadenceSeconds: 180, maxCadenceSeconds: 3_600, maxQueueAgeSeconds: 120 };
    case "unknown":
      return { targetFreshnessSeconds: 14_400, staleAfterSeconds: 43_200, emergencyStaleAfterSeconds: 86_400, minCadenceSeconds: 1_800, maxCadenceSeconds: 86_400, maxQueueAgeSeconds: 900 };
  }
}

function schedulerBudgetQueryClasses(plan: CollectionPlan): SchedulerFreshnessQueryClass[] {
  const primary = schedulerFreshnessQueryClass(plan);
  return uniqueStrings([
    primary,
    "actor",
    "ransomware",
    "cve_advisory",
    "campaign",
    "malware_tool",
    "sector",
    "country",
    "victim_company",
    "infrastructure",
    "unknown"
  ]) as SchedulerFreshnessQueryClass[];
}

function schedulerTenantBudgetLane(input: {
  tenantId: string;
  queryClass: SchedulerFreshnessQueryClass;
  queueEconomics: SchedulerQueueEconomicsDto;
  runtimeExecution: SchedulerRuntimeExecutionDto;
  slaEnforcement: SchedulerSlaEnforcementDto;
  freshnessSloEngine: SchedulerFreshnessSloEngineDto;
}): SchedulerFairnessGovernanceDto["queryClassBudgets"][number] {
  const workClass = workClassForQueryClass(input.queryClass);
  const profile = freshnessProfileForQueryClass(input.queryClass);
  const budget = input.queueEconomics.workClassBudget.find((row) => row.workClass === workClass)
    ?? input.queueEconomics.workClassBudget.find((row) => row.workClass === "background_refresh")
    ?? input.queueEconomics.workClassBudget[0];
  const workClassRuntime = input.runtimeExecution.byWorkClass.find((row) => row.workClass === workClass);
  const queued = workClassRuntime?.queued ?? 0;
  const retryDebt = workClassRuntime?.retried ?? input.queueEconomics.totals.retryDebt;
  const totalSlots = Math.max(4, input.queueEconomics.workClassBudget.reduce((total, row) => total + row.budgetSlots, 0));
  const slots = Math.max(1, budget?.budgetSlots ?? Math.round(totalSlots * budgetShareForWorkClass(workClass)));
  const emergency = input.slaEnforcement.state === "rollback" || input.freshnessSloEngine.queuePressureBehavior.state === "emergency_brake";
  const throttled = input.queueEconomics.fairness.ok === false && (workClass === "broad_daily_sweep" || workClass === "background_refresh");
  const pressure = input.slaEnforcement.state === "warning" || input.slaEnforcement.state === "hold" || retryDebt > Math.max(1, slots);
  const state: SchedulerFairnessGovernanceDto["queryClassBudgets"][number]["state"] = emergency
    ? "emergency_hold"
    : throttled
      ? "throttled"
      : pressure || queued > slots * 2
        ? "pressure"
        : "within_budget";
  const actions = uniqueStrings([
    "preserve_live_polling",
    "reuse_duplicate_run",
    ...(workClass === "interactive_live_search" || workClass === "analyst_deep_dive" ? ["reserve_interactive_capacity", "age_priority"] : []),
    ...(workClass === "broad_daily_sweep" || workClass === "background_refresh" ? ["defer_sweeps", "age_priority"] : []),
    ...(retryDebt > 0 ? ["hold_dead_letters"] : []),
    ...(emergency ? ["pause_new_leases"] : [])
  ]) as SchedulerFairnessGovernanceDto["queryClassBudgets"][number]["actions"];
  return {
    tenantId: input.tenantId,
    queryClass: input.queryClass,
    workClass,
    reservedWorkerSlots: slots,
    maxConcurrentLeases: Math.max(1, Math.round(slots * (workClass === "interactive_live_search" ? 2 : 1.25))),
    maxQueuedTasks: Math.max(slots * 4, queued),
    maxQueueAgeSeconds: Math.min(profile.maxQueueAgeSeconds, budget?.maxQueuedAgeSeconds ?? profile.maxQueueAgeSeconds),
    maxRetryDebt: Math.max(1, Math.round(slots / 2)),
    agingBoostEverySeconds: Math.max(30, Math.round(profile.maxQueueAgeSeconds / (workClass === "interactive_live_search" ? 6 : 4))),
    retryAfterSeconds: state === "within_budget" ? 3 : state === "emergency_hold" ? Math.max(60, input.freshnessSloEngine.queuePressureBehavior.retryAfterSeconds) : Math.max(3, Math.min(60, profile.maxQueueAgeSeconds)),
    state,
    actions
  };
}

function workClassForQueryClass(queryClass: SchedulerFreshnessQueryClass): SchedulerWorkClass {
  switch (queryClass) {
    case "actor":
    case "ransomware":
    case "victim_company":
    case "infrastructure":
      return "interactive_live_search";
    case "cve_advisory":
    case "campaign":
    case "malware_tool":
      return "analyst_deep_dive";
    case "sector":
    case "country":
      return "broad_daily_sweep";
    case "unknown":
      return "background_refresh";
  }
}

function schedulerWorkloadPressureAction(
  workload: SchedulerWorkerWorkload,
  pressure: boolean,
  emergency: boolean
): SchedulerFairnessGovernanceDto["workloadFairness"][number]["queuePressureAction"] {
  if (emergency) return "pause_new_leases";
  if (!pressure && (workload === "interactive_actor_search" || workload === "health_probe")) return "serve_now";
  if (workload === "interactive_actor_search") return "reserve_capacity";
  if (workload === "restricted_metadata_approval") return "hold_restricted_metadata";
  if (workload === "scheduled_source_sweep" || workload === "public_channel_window" || workload === "graph_export" || workload === "retention") return "defer_low_value_sweeps";
  return pressure ? "defer_low_value_sweeps" : "serve_now";
}

function analystPriorityScore(priority: CollectionPlan["request"]["priority"]): number {
  switch (priority) {
    case "urgent":
      return 1;
    case "high":
      return 0.8;
    case "low":
      return 0.35;
    case "normal":
    default:
      return 0.55;
  }
}

function sourceCadenceHintForTask(input: {
  task: CollectionTask;
  source?: SourceRecord;
  queryClass: SchedulerFreshnessQueryClass;
  profile: SchedulerFreshnessProfile;
  analystPriority: number;
  queueEconomics: SchedulerQueueEconomicsDto;
  slaEnforcement: SchedulerSlaEnforcementDto;
  now: Date;
}): SchedulerSourceCadenceHint {
  const reliability = clampRate(input.source?.catalog?.reliability ?? input.source?.scoring?.reliability ?? input.source?.trustScore ?? input.task.planning?.sourceTrust ?? 0.5);
  const parserHealth = parserHealthScore(input.source);
  const evidenceYield = clampRate(input.source?.catalog?.intelligenceValue ?? input.source?.scoring?.relevance ?? input.task.planning?.freshness ?? 0.5);
  const target = input.task.planning?.freshnessTargetSeconds ?? input.source?.catalog?.collection.freshnessTargetSeconds ?? input.source?.crawlFrequencySeconds ?? input.profile.targetFreshnessSeconds;
  const lastCollected = input.source?.crawlState?.lastCollectedAt ?? input.source?.lastSeenAt ?? input.source?.health?.lastSuccessAt;
  const freshnessDebtSeconds = lastCollected
    ? Math.max(0, Math.floor((input.now.getTime() - Date.parse(lastCollected)) / 1000) - target)
    : target;
  const pressure = input.slaEnforcement.state === "rollback" || input.slaEnforcement.state === "hold" || input.queueEconomics.totals.retryDebt > 0;
  const qualityMultiplier = 0.55 + reliability * 0.2 + parserHealth * 0.15 + evidenceYield * 0.2 + input.analystPriority * 0.15;
  const recommendedCadenceSeconds = clampInteger(Math.round(target / qualityMultiplier), input.profile.minCadenceSeconds, input.profile.maxCadenceSeconds);
  const nextEligibleAt = input.task.availableAt ?? input.source?.crawlState?.backoffUntil ?? new Date(input.now.getTime() + Math.max(0, recommendedCadenceSeconds - freshnessDebtSeconds) * 1000).toISOString();
  const action = freshnessQueueAction({
    task: input.task,
    source: input.source,
    pressure,
    freshnessDebtSeconds,
    target,
    slaState: input.slaEnforcement.state
  });
  return {
    sourceId: input.task.sourceId,
    sourceType: input.task.sourceType,
    queryClass: input.queryClass,
    reliability: Number(reliability.toFixed(3)),
    parserHealth: Number(parserHealth.toFixed(3)),
    evidenceYield: Number(evidenceYield.toFixed(3)),
    analystPriority: input.analystPriority,
    sourceFreshnessTargetSeconds: target,
    recommendedCadenceSeconds,
    nextEligibleAt,
    freshnessDebtSeconds,
    priorityAgingBoost: Number(Math.min(0.4, Math.max(0, freshnessDebtSeconds / Math.max(1, target)) * 0.16 + input.analystPriority * 0.12).toFixed(3)),
    budgetClass: workClassForTask(input.task),
    queueAction: action,
    reason: freshnessActionReason(action)
  };
}

function parserHealthScore(source?: SourceRecord): number {
  if (!source) return 0.5;
  const parseability = source.scoring?.parseability;
  if (typeof parseability === "number") return clampRate(parseability);
  switch (source.health?.status) {
    case "healthy":
      return 0.9;
    case "degraded":
      return 0.55;
    case "failing":
      return 0.25;
    case "disabled":
      return 0;
    case "unknown":
    default:
      return 0.5;
  }
}

function freshnessQueueAction(input: {
  task: CollectionTask;
  source?: SourceRecord;
  pressure: boolean;
  freshnessDebtSeconds: number;
  target: number;
  slaState: SchedulerSlaEnforcementDto["state"];
}): SchedulerSourceCadenceHint["queueAction"] {
  if (input.slaState === "rollback") return "emergency_hold";
  if (input.task.retryCount >= (input.task.maxRetries ?? 3)) return "dead_letter_review";
  if (input.task.availableAt || input.source?.crawlState?.backoffUntil) return "hold_backoff";
  if (input.pressure && input.freshnessDebtSeconds <= input.target) return "defer_pressure";
  if (input.freshnessDebtSeconds > 0 || workClassForTask(input.task) === "interactive_live_search") return "collect_now";
  return "schedule_next";
}

function freshnessActionReason(action: SchedulerSourceCadenceHint["queueAction"]): string {
  switch (action) {
    case "collect_now":
      return "freshness debt or interactive demand justifies immediate collection";
    case "schedule_next":
      return "source is inside freshness target and can wait for its next cadence";
    case "defer_pressure":
      return "queue pressure preserves live polling and defers lower urgency collection";
    case "hold_backoff":
      return "source backoff or task availability delay is active";
    case "dead_letter_review":
      return "retry budget is exhausted and operator-visible dead-letter review is required";
    case "emergency_hold":
      return "emergency brake prevents new leases until cursor replay and budgets recover";
  }
}

function freshnessDegradeActions(state: SchedulerFreshnessSloEngineDto["queuePressureBehavior"]["state"]): SchedulerFreshnessSloEngineDto["queuePressureBehavior"]["degradeActions"] {
  if (state === "emergency_brake") return ["pause_new_leases", "emergency_brake", "preserve_active_run_reuse", "hold_dead_letters"];
  if (state === "degraded") return ["raise_high_value_stale_items", "defer_low_yield_sources", "preserve_active_run_reuse", "hold_dead_letters"];
  return ["raise_high_value_stale_items", "preserve_active_run_reuse"];
}

function buildProductionLeaseLifecycle(): SchedulerProductionLeaseSemanticsDto["leaseLifecycle"] {
  return [
    ["enqueue", "task row, budget reservation intent, and enqueue event share a deterministic idempotency key", "tenant:reuseKey:source:target", true],
    ["lease", "worker owns a finite lease only after Postgres row lock, budget reservation, and lease event commit", "taskId:workerId:leaseStartedAt", true],
    ["heartbeat", "owning worker extends lease and emits progress without changing run-visible result state", "taskId:workerId:heartbeat", true],
    ["checkpoint", "cursor, promoted evidence count, and partial reason are written before any ack or retry", "taskId:checkpointCursor", true],
    ["ack", "completion is idempotent and closes the active lease after durable side-effect representation", "taskId:ackStatus", true],
    ["retry", "transient failure releases the lease and stores next availability with deterministic backoff", "taskId:retryCount", true],
    ["dead_letter", "exhausted work leaves queue rotation and becomes operator-visible safe metadata", "taskId:deadLetterReason", true],
    ["expire", "expired leases are recovered before each lease pass and keep the last checkpoint cursor", "taskId:leaseExpiresAt", true],
    ["drain", "drain pauses new leases first, then checkpoints or lets active leases expire safely", "partitionId:drainStartedAt", true],
    ["shutdown", "worker shutdown heartbeats stop, unfinished leases recover by expiry, and public polling attaches to run reuse", "workerId:shutdown", true]
  ].map(([step, semantics, idempotencyKey, cursorVisible]) => ({
    step: step as SchedulerProductionLeaseSemanticsDto["leaseLifecycle"][number]["step"],
    semantics: String(semantics),
    idempotencyKey: String(idempotencyKey),
    cursorVisible: Boolean(cursorVisible)
  }));
}

function buildProductionQueueCutoverPhases(input: {
  queueEconomics: SchedulerQueueEconomicsDto;
  workerQueueCutover: SchedulerWorkerQueueCutoverDto;
  durableBackendReadiness: SchedulerDurableBackendReadinessDto;
}): SchedulerProductionLeaseSemanticsDto["cutoverPhases"] {
  const queued = input.queueEconomics.totals.queued;
  const leased = input.queueEconomics.totals.leased;
  const retryDebt = input.queueEconomics.totals.retryDebt;
  const deadLetters = input.queueEconomics.totals.deadLetters;
  const baseChecks = [
    "frontier_events mirror is replayable",
    "run_reuse_keys unique index is populated",
    "dry-run apply plan reports willLeaseTasks=false",
    "3-second public polling and cursor continuity are preserved"
  ];
  const phase = (
    phase: SchedulerProductionLeaseSemanticsDto["cutoverPhases"][number]["phase"],
    requiredChecks: string[],
    expectedQueueEffect: SchedulerProductionLeaseSemanticsDto["cutoverPhases"][number]["expectedQueueEffect"],
    rollback: string
  ): SchedulerProductionLeaseSemanticsDto["cutoverPhases"][number] => ({
    phase,
    targetBackend: "postgres_advisory_queue",
    dryRun: true,
    willMutate: false,
    willLeaseTasks: false,
    requiredChecks: [...baseChecks, ...requiredChecks],
    expectedQueueEffect,
    rollback
  });
  return [
    phase("shadow_mirror", ["Postgres shadow tables receive embedded queue snapshots and deltas"], { queuedDelta: 0, leasedDelta: 0, retryDebtDelta: 0, deadLetterDelta: 0 }, "discard shadow rows and keep embedded scheduler authoritative"),
    phase("dual_write_audit", ["enqueue/checkpoint/ack events compare equal between embedded and Postgres"], { queuedDelta: 0, leasedDelta: 0, retryDebtDelta: 0, deadLetterDelta: 0 }, "disable dual-write mirror and replay frontier_events from embedded state"),
    phase("postgres_lease_canary", ["single partition canary proves SKIP LOCKED lease exclusivity and heartbeat expiry"], { queuedDelta: -Math.min(queued, input.workerQueueCutover.capacityEnvelope.workerSlots), leasedDelta: Math.min(queued, input.workerQueueCutover.capacityEnvelope.workerSlots), retryDebtDelta: 0, deadLetterDelta: 0 }, "stop Postgres leasing and let canary leases expire back to embedded recovery"),
    phase("worker_drain", ["pause new embedded leases before worker shutdown and checkpoint active leases"], { queuedDelta: leased, leasedDelta: -leased, retryDebtDelta: 0, deadLetterDelta: 0 }, "resume embedded leasing from preserved checkpoints"),
    phase("cutover", ["all partitions pass canary, retry debt is under threshold, emergency brake is clear"], { queuedDelta: 0, leasedDelta: 0, retryDebtDelta: -retryDebt, deadLetterDelta: 0 }, "restore embedded scheduler authority and replay Postgres events back into memory"),
    phase("rollback", ["rollback command preserves cursor replay and duplicate run reuse"], { queuedDelta: 0, leasedDelta: -leased, retryDebtDelta: 0, deadLetterDelta: deadLetters }, input.durableBackendReadiness.drainPlan.state === "blocked" ? "hold rollback until drain blocker is resolved" : "pause Postgres workers and replay frontier_events into embedded queue")
  ];
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

function buildDurableBackendContracts(input: SchedulerProductionAdapterTelemetryDto): SchedulerDurableBackendContract[] {
  const primitives: SchedulerDurableBackendContract["primitives"] = [
    "enqueue",
    "lease",
    "heartbeat",
    "checkpoint",
    "acknowledge",
    "retry",
    "dead_letter",
    "cancel",
    "reuse_run",
    "drain",
    "rollback"
  ];
  return input.adapterContracts.map((contract) => {
    const backend: SchedulerDurableBackendKind = contract.implementation;
    return {
      backend,
      mode: contract.mode,
      dryRun: true,
      willMutate: false,
      primitives,
      leaseSemantics: durableLeaseSemantics(backend),
      retryBackoffSemantics: "bounded deterministic exponential backoff is stored with retry debt, next-at time, source backoff reason, and run cursor lineage",
      deadLetterSemantics: "retry-exhausted, policy-blocked, deadline-expired, and adapter-error tasks move into operator-visible dead letters without leaking restricted payloads",
      cursorContinuity: "preserved",
      duplicateRunReuse: "required",
      drainSemantics: "worker drain stops new leases first, checkpoints active work, preserves replay cursors, then cancels or reuses abandoned client runs",
      rollbackSemantics: durableRollbackSemantics(backend)
    };
  });
}

function buildDurableFairnessLane(partition: SchedulerWorkerQueuePartition): SchedulerDurableFairnessLane {
  return {
    workload: partition.workload,
    partitionId: partition.id,
    reservedWorkerSlots: partition.reservedWorkerSlots,
    maxConcurrentLeases: partition.maxConcurrentLeases,
    maxQueueAgeSeconds: partition.maxQueueAgeSeconds,
    agingBoostEverySeconds: Math.max(30, Math.round(partition.maxQueueAgeSeconds / 6)),
    fairnessKeys: fairnessKeysForWorkload(partition.workload),
    backpressurePolicy: partition.backpressurePolicy,
    drainBehavior: partition.drainBehavior,
    retryBudget: {
      maxAttempts: partition.retry.maxAttempts,
      retryBaseSeconds: partition.retry.baseSeconds,
      retryMaxSeconds: partition.retry.maxSeconds,
      deadLetterAfterAttempts: partition.deadLetter.afterAttempts
    }
  };
}

function durableLeaseSemantics(backend: SchedulerDurableBackendKind): string {
  switch (backend) {
    case "embedded_memory":
      return "single-process finite leases with heartbeat recovery and deterministic test clocks";
    case "postgres_advisory_queue":
      return "transactional lease rows selected with SKIP LOCKED and guarded by advisory ownership";
    case "redis_streams":
      return "consumer-group pending entries claimed after idle timeout with checkpoint hashes mirrored out of band";
    case "nats_jetstream":
      return "durable consumer ack-wait leases extended by heartbeat progress events";
  }
}

function durableRollbackSemantics(backend: SchedulerDurableBackendKind): string {
  switch (backend) {
    case "embedded_memory":
      return "keep embedded queue active, reject destructive cutover, and preserve snapshots for replay";
    case "postgres_advisory_queue":
      return "stop Postgres leasing, replay frontier_events back into embedded memory, and keep reuse-key uniqueness intact";
    case "redis_streams":
      return "pause stream consumers, replay durable event cursors, and leave pending entries unacked for audit";
    case "nats_jetstream":
      return "pause durable consumers, replay ordered event mirror, and avoid acking messages without checkpoint evidence";
  }
}

function fairnessKeysForWorkload(workload: SchedulerWorkerWorkload): string[] {
  switch (workload) {
    case "interactive_actor_search":
      return ["tenantId", "actor", "reuseKey", "sourceId"];
    case "scheduled_source_sweep":
      return ["tenantId", "sourceId", "crawlFrequencySeconds"];
    case "public_channel_window":
      return ["tenantId", "publicChannelId", "windowStart", "sourceId"];
    case "restricted_metadata_approval":
      return ["tenantId", "approvalId", "sourceId", "metadataOnly"];
    case "evidence_replay":
      return ["tenantId", "captureId", "claimId"];
    case "graph_export":
      return ["tenantId", "graphView", "exportFormat"];
    case "retention":
      return ["tenantId", "retentionBucket", "evidenceClass"];
    case "health_probe":
      return ["tenantId", "sourceId", "probeKind"];
  }
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

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
}

function uniqueDrainActions(values: SchedulerLiveRunDrainAction[]): SchedulerLiveRunDrainAction[] {
  return Array.from(new Set(values));
}

function durableBackendContracts(telemetry: SchedulerProductionAdapterTelemetryDto): SchedulerDurableBackendContract[] {
  return telemetry.adapterContracts.map((contract): SchedulerDurableBackendContract => ({
    backend: contract.implementation,
    mode: contract.mode,
    dryRun: true,
    willMutate: false,
    primitives: uniqueBackendPrimitives([
      ...contract.methods,
      "reuse_run",
      "rollback",
      "drain"
    ]),
    leaseSemantics: "leases are tenant scoped, heartbeat/checkpoint backed, and recoverable after stale worker expiry",
    retryBackoffSemantics: "retry debt is bounded by partition budget with deterministic backoff and dead-letter routing",
    deadLetterSemantics: "dead letters preserve tenant, run, source, task, and cursor lineage for replay",
    cursorContinuity: "preserved",
    duplicateRunReuse: "required",
    drainSemantics: "drain plans are dry-run first and preserve active run cursor replay",
    rollbackSemantics: "rollback returns leasing authority to the last healthy embedded queue snapshot"
  }));
}

function uniqueBackendPrimitives(values: SchedulerDurableBackendContract["primitives"]): SchedulerDurableBackendContract["primitives"] {
  return Array.from(new Set(values));
}

function durableFairnessLane(partition: SchedulerWorkerQueuePartition): SchedulerDurableFairnessLane {
  return {
    workload: partition.workload,
    partitionId: partition.id,
    reservedWorkerSlots: partition.reservedWorkerSlots,
    maxConcurrentLeases: partition.maxConcurrentLeases,
    maxQueueAgeSeconds: partition.maxQueueAgeSeconds,
    agingBoostEverySeconds: Math.max(30, Math.round(partition.maxQueueAgeSeconds / 3)),
    fairnessKeys: ["tenant_id", "source_id", "run_id", "work_class"],
    backpressurePolicy: partition.backpressurePolicy,
    drainBehavior: partition.drainBehavior,
    retryBudget: {
      maxAttempts: partition.retry.maxAttempts,
      retryBaseSeconds: partition.retry.baseSeconds,
      retryMaxSeconds: partition.retry.maxSeconds,
      deadLetterAfterAttempts: partition.deadLetter.afterAttempts
    }
  };
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

function freshnessDashboardCadenceReason(
  state: SchedulerFreshnessSloDashboardActor["state"],
  workload: SchedulerWorkerWorkload
): string {
  if (state === "blocked" && workload === "restricted_metadata_approval") return "restricted metadata is held for metadata-only review without blocking clear-web polling";
  if (state === "blocked") return "scheduler emergency or dead-letter pressure pauses new leases while preserving cursors";
  if (state === "stale") return "actor freshness target is exceeded, so priority aging raises this lane before background work";
  if (state === "aging") return "actor freshness is approaching stale threshold and should collect on the next eligible lease";
  if (workload === "public_channel_window") return "public-channel refresh reuses active runs before adding fanout";
  return "freshness is within target; background work may proceed within fairness budgets";
}

function freshnessDashboardWorkloadReason(action: SchedulerFreshnessSloDashboardDto["workloadActions"][number]["action"]): string {
  if (action === "reserve_capacity") return "protect interactive actor polling and active-run reuse";
  if (action === "raise_priority_aging") return "raise stale high-priority actor work without bypassing per-source concurrency";
  if (action === "drain_background") return "drain lower-value work behind actor freshness and replay safety";
  if (action === "hold_restricted_metadata") return "keep restricted metadata in approval review while clear-web work continues";
  if (action === "dead_letter_review") return "route exhausted or unsafe work to operator-visible dead-letter review";
  return "no scheduler action required for this partition";
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
    case "public_channel_window":
      return 0.12;
    case "public_channel_probe":
      return 0.1;
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
  return 0.05;
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
  request: SchedulerApplyPlanApiRequestDto = {},
  sourceGapEnqueueRehearsal?: SchedulerSourceGapEnqueueRehearsalReceipt,
  sourceGapWorkerLoopPreview?: SchedulerSourceGapWorkerLoopReceipt
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
    sourceGapEnqueueRehearsal: request.includeSourceGapEnqueueRehearsal && sourceGapEnqueueRehearsal
      ? {
          ...sourceGapEnqueueRehearsal,
          routeField: "applyPlan.sourceGapEnqueueRehearsal"
        }
      : undefined,
    sourceGapWorkerLoopPreview: request.includeSourceGapWorkerLoopPreview && sourceGapWorkerLoopPreview
      ? {
          ...sourceGapWorkerLoopPreview,
          routeField: "applyPlan.sourceGapWorkerLoopPreview"
        }
      : undefined,
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
        { name: "includeSourceGapEnqueueRehearsal", type: "boolean", required: false, description: "Includes the guarded daily Actor source-gap enqueue rehearsal receipt; default output is blocked/no-mutation unless every promotion gate is explicit." },
        { name: "includeSourceGapWorkerLoopPreview", type: "boolean", required: false, description: "Includes the disabled source-gap worker loop receipt with partition, drain, and next-action state; the API preview never leases, acknowledges, fetches, or mutates runs." },
        { name: "hostMemoryMb", type: "number", required: false, description: "Host memory used to compute emergency-brake headroom for the 1 TB deployment target." },
        { name: "dbConnectionUtilization", type: "number", required: false, description: "Current DB connection utilization ratio for headroom warnings." },
        { name: "workerUtilization", type: "number", required: false, description: "Current worker utilization ratio for headroom warnings." },
        { name: "maxApiP95QueueAgeSeconds", type: "number", required: false, description: "Emergency-brake queue-age threshold exposed to Agent 10 promotion checks." }
      ]
    },
    response: {
      fields: ["contract", "applyPlan", "applyPlan.sourceGapEnqueueRehearsal", "applyPlan.sourceGapWorkerLoopPreview"],
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

  gcActiveRuns(now = new Date(), options: ActiveRunGcOptions = {}): ActiveRunGcDecision[] {
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
  options: ActiveRunGcOptions = {}
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

function clampInteger(value: number, min: number, max: number): number {
  const safeValue = Number.isFinite(value) ? Math.round(value) : min;
  const safeMin = Number.isFinite(min) ? Math.round(min) : 0;
  const safeMax = Number.isFinite(max) ? Math.round(max) : safeMin;
  return Math.max(safeMin, Math.min(safeMax, safeValue));
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
    case "public_channel_window":
      return 180;
    case "public_channel_probe":
      return 240;
    case "restricted_darknet_metadata_sweep":
      return 900;
    case "replay_retention":
      return 1_800;
    case "broad_daily_sweep":
      return 3_600;
    case "background_refresh":
      return 1_800;
  }
  return 1_800;
}

function recoveryActionFor(workClass: SchedulerWorkClass): SchedulerStarvationSignal["recoveryAction"] {
  switch (workClass) {
    case "interactive_live_search":
    case "interactive_search":
      return "raise_priority";
    case "analyst_deep_dive":
    case "public_channel_window":
    case "public_channel_probe":
    case "source_health_probe":
    case "restricted_darknet_metadata_sweep":
    case "replay_retention":
      return "reserve_worker_slot";
    case "background_refresh":
    case "broad_daily_sweep":
      return "split_queue_partition";
  }
  return "none";
}

function runtimePriority(task: CollectionTask): number {
  switch (workClassForTask(task)) {
    case "interactive_live_search":
      return task.priority + 0.12;
    case "analyst_deep_dive":
      return task.priority + 0.1;
    case "source_health_probe":
      return task.priority + 0.08;
    case "public_channel_window":
      return task.priority + 0.06;
    case "public_channel_probe":
      return task.priority + 0.05;
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
  return task.priority;
}
