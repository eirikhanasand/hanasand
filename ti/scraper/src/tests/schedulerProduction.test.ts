import { describe, expect, test } from "bun:test";
import { FocusedFrontier } from "../frontier/frontier.ts";
import {
  activeRunGcDecisions,
  buildSchedulerApplyPlan,
  buildSchedulerApplyPlanApiResponse,
  buildSchedulerCutoverRehearsal,
  buildSchedulerDiagnostics,
  buildSchedulerQueueEconomics,
  buildSchedulerReconciliation,
  buildSchedulerRuntimeExecution,
  buildSchedulerRuntimeSla,
  buildSchedulerSlaEnforcement,
  buildSchedulerWorkerQueueCutover,
  buildSchedulerWorkerSoakMigration,
  buildSchedulerWorkerLeaseSoakHarness,
  buildSchedulerProductionAdapterTelemetry,
  buildSchedulerCanaryControlPlane,
  buildSchedulerDurableBackendReadiness,
  buildSchedulerFreshnessSloEngine,
  buildSchedulerFreshnessSloDashboard,
  buildSchedulerDailyActorRunPlan,
  buildSchedulerInteractiveSearchFreshness,
  buildSchedulerProductionLeaseSemantics,
  buildSchedulerFairnessGovernance,
  buildSchedulerPersistenceReplayCutover,
  buildSchedulerPostgresQueueAdapterReadiness,
  createSchedulerQueueRepository,
  detectSchedulerStarvation,
  evaluateSchedulerSoakScenario,
  InMemorySchedulerQueueRepository,
  PostgresSchedulerQueueRepository,
  schedulerBackpressureSummaryForTasks,
  schedulerLoadModelFixtures,
  schedulerSoakScenarios,
  schedulerSoakBackpressurePacket,
  schedulerWorkerLoopContract,
  schedulerWorkerRuntimeFixtures,
  schedulerApplyPlanApiContract,
  simulateSchedulerExecution,
  simulateFairnessEnforcement,
  SCHEDULER_CUTOVER_DESIGN
} from "../frontier/schedulerProduction.ts";
import type { CollectionPlan, CollectionRun, CollectionTask, PlanningBudgetClass, SourceRecord, TaskPlanningMetadata } from "../types.ts";

function source(input: Partial<SourceRecord> = {}): SourceRecord {
  const type = input.type ?? "rss";
  const metadataOnly = type.endsWith("_metadata");
  return {
    id: input.id ?? "src",
    tenantId: input.tenantId,
    name: input.name ?? "Source",
    type,
    url: input.url ?? `https://example.test/${input.id ?? "src"}/search?q={query}`,
    accessMethod: input.accessMethod ?? (metadataOnly ? "approved_proxy" : "public_http"),
    status: input.status ?? "active",
    risk: input.risk ?? (metadataOnly ? "high" : "low"),
    trustScore: input.trustScore ?? 0.9,
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600,
    legalNotes: input.legalNotes ?? "Public fixture.",
    approvedAt: input.approvedAt ?? (metadataOnly ? "2026-01-01T00:00:00.000Z" : undefined),
    approvedBy: input.approvedBy ?? (metadataOnly ? "analyst_1" : undefined),
    governance: input.governance ?? (metadataOnly ? {
      approvalState: "approved",
      approvalRequired: true,
      metadataOnly: true,
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "analyst_1"
    } : undefined),
    health: input.health,
    crawlState: input.crawlState,
    catalog: input.catalog,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function addWork(frontier: FocusedFrontier, input: {
  id: string;
  budgetClass: PlanningBudgetClass;
  selectedFor: TaskPlanningMetadata["selectedFor"];
  queuedAt: string;
  fairnessKey?: string;
  tenantId?: string;
  sourceType?: SourceRecord["type"];
}): void {
  frontier.add({
    source: source({ id: `src_${input.id}`, type: input.sourceType }),
    tenantId: input.tenantId ?? `tenant_${input.id}`,
    intelRequestId: `request_${input.id}`,
    url: `https://scheduler.example.test/${input.id}`,
    discoveredAt: input.queuedAt,
    anchorText: "APT29 ransomware campaign exploit",
    parentRelevance: 0.9,
    novelty: 0.8,
    freshness: 0.8,
    fairnessKey: input.fairnessKey
  });
  const queued = frontier.snapshot().find((task) => task.sourceId === `src_${input.id}`);
  if (!queued) throw new Error(`missing queued task ${input.id}`);
  queued.task.planning = {
    budgetClass: input.budgetClass,
    decision: "selected",
    reason: "scheduler production fixture",
    queryTerms: ["APT29"],
    freshness: 0.8,
    sourceTrust: 0.9,
    selectedFor: input.selectedFor
  };
}

function run(input: Partial<CollectionRun>): CollectionRun {
  return {
    id: input.id ?? "run",
    tenantId: input.tenantId,
    planId: input.planId ?? "plan",
    requestId: input.requestId ?? "request",
    status: input.status ?? "running",
    createdAt: input.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-01-01T00:00:00.000Z",
    completedAt: input.completedAt,
    requestHash: input.requestHash,
    taskCount: input.taskCount ?? 1,
    reviewTaskCount: input.reviewTaskCount ?? 0,
    rejectedSourceCount: input.rejectedSourceCount ?? 0,
    captureCount: input.captureCount ?? 0,
    incidentCount: input.incidentCount ?? 0,
    error: input.error
  };
}

function task(input: Partial<CollectionTask> & { id: string; sourceId: string; budgetClass?: PlanningBudgetClass }): CollectionTask {
  return {
    id: input.id,
    tenantId: input.tenantId ?? "tenant_test",
    sourceId: input.sourceId,
    sourceType: input.sourceType ?? "rss",
    targetUrl: input.targetUrl ?? `https://example.test/${input.id}`,
    queuedAt: input.queuedAt ?? "2026-01-01T00:00:00.000Z",
    priority: input.priority ?? 0.8,
    reason: input.reason ?? "test task",
    retryCount: input.retryCount ?? 0,
    intelRequestId: input.intelRequestId ?? `request_${input.id}`,
    runId: input.runId,
    availableAt: input.availableAt,
    attemptDeadlineAt: input.attemptDeadlineAt,
    maxRetries: input.maxRetries,
    fairnessKey: input.fairnessKey,
    planning: input.planning ?? {
      budgetClass: input.budgetClass ?? "background_refresh",
      decision: "selected",
      reason: "test",
      queryTerms: ["APT29"],
      freshness: 0.8,
      sourceTrust: 0.9,
      selectedFor: input.budgetClass === "source_health_probe" ? "probe" : input.budgetClass === "restricted_darknet_metadata_sweep" ? "metadata" : "background"
    }
  };
}

function plan(input: {
  query?: string;
  entityType?: CollectionPlan["request"]["entityType"];
  priority?: CollectionPlan["request"]["priority"];
  tasks: CollectionTask[];
  reviewRequired?: CollectionTask[];
}): CollectionPlan {
  return {
    id: "plan_freshness",
    tenantId: "tenant_test",
    request: {
      id: "request_freshness",
      tenantId: "tenant_test",
      query: input.query ?? "APT29",
      entityType: input.entityType ?? "actor",
      includeClearWeb: true,
      includeTelegram: true,
      includeDarknetMetadata: false,
      maxTasks: 10,
      createdAt: "2026-05-24T10:00:00.000Z",
      priority: input.priority ?? "high"
    },
    tasks: input.tasks,
    reviewRequired: input.reviewRequired ?? [],
    rejected: [],
    explanations: input.tasks.map((item) => ({
      sourceId: item.sourceId,
      status: "selected",
      reason: "freshness fixture",
      targetUrl: item.targetUrl,
      taskId: item.id,
      priority: item.priority,
      budgetClass: item.planning?.budgetClass,
      queryTerms: item.planning?.queryTerms
    })),
    queryTerms: ["APT29"],
    audit: []
  };
}

describe("scheduler production readiness", () => {
  test("documents a backend-neutral cutover design and live-search load fixtures", () => {
    expect(SCHEDULER_CUTOVER_DESIGN.targetBackend).toBe("postgres_queue");
    expect(SCHEDULER_CUTOVER_DESIGN.contractInvariants).toContain("Planner DTO fields remain API-facing and backend-neutral.");
    expect(SCHEDULER_CUTOVER_DESIGN.durableTables.map((table) => table.name)).toContain("run_reuse_keys");

    const fixtures = schedulerLoadModelFixtures();
    expect(fixtures.map((fixture) => fixture.liveSearchPollers)).toEqual([1, 10, 100, 1_000]);
    expect(fixtures[3]?.expectedPollsPerMinute).toBe(20_000);
    expect(fixtures[3]?.analystDeepDives).toBeGreaterThan(0);
    expect(fixtures[3]?.sourceHealthProbes).toBeGreaterThan(fixtures[0]?.sourceHealthProbes ?? 0);
    expect(fixtures[3]?.maxQueueAgeSeconds.interactive_live_search).toBeLessThan(fixtures[3]?.maxQueueAgeSeconds.broad_daily_sweep ?? 0);
  });

  test("detects starvation and recovery actions across production work classes", () => {
    const now = new Date("2026-01-01T02:00:00.000Z");
    const frontier = new FocusedFrontier({ now: () => now, defaultPerSourceConcurrency: 20 });
    addWork(frontier, { id: "live", budgetClass: "interactive_live_search", selectedFor: "interactive", queuedAt: "2026-01-01T01:55:00.000Z" });
    addWork(frontier, { id: "analyst", budgetClass: "analyst_deep_dive", selectedFor: "interactive", queuedAt: "2026-01-01T01:30:00.000Z" });
    addWork(frontier, { id: "probe", budgetClass: "source_health_probe", selectedFor: "probe", queuedAt: "2026-01-01T01:40:00.000Z" });
    addWork(frontier, { id: "metadata", budgetClass: "restricted_darknet_metadata_sweep", selectedFor: "metadata", queuedAt: "2026-01-01T01:20:00.000Z", sourceType: "tor_metadata" });
    addWork(frontier, { id: "sweep", budgetClass: "broad_daily_sweep", selectedFor: "background", queuedAt: "2026-01-01T00:30:00.000Z" });
    addWork(frontier, { id: "replay", budgetClass: "background_refresh", selectedFor: "background", queuedAt: "2026-01-01T01:00:00.000Z", fairnessKey: "retention:replay" });

    const signals = detectSchedulerStarvation(frontier.snapshot().map((item) => item.task), now);
    expect(signals.map((signal) => signal.workClass)).toContain("interactive_live_search");
    expect(signals.map((signal) => signal.workClass)).toContain("analyst_deep_dive");
    expect(signals.map((signal) => signal.workClass)).toContain("source_health_probe");
    expect(signals.map((signal) => signal.workClass)).toContain("restricted_darknet_metadata_sweep");
    expect(signals.map((signal) => signal.workClass)).toContain("broad_daily_sweep");
    expect(signals.map((signal) => signal.workClass)).toContain("replay_retention");
    expect(signals.find((signal) => signal.workClass === "replay_retention")?.recoveryAction).toBe("reserve_worker_slot");
  });

  test("builds API-ready scheduler diagnostics with reuse keys, pressure, fairness, and next actions", () => {
    const now = new Date("2026-01-01T00:10:00.000Z");
    const frontier = new FocusedFrontier({
      now: () => now,
      crawlBudgetPolicies: {
        request_live: { taskLimit: 0, byteLimit: 1_000, deadlineAt: "2026-01-01T01:00:00.000Z" }
      }
    });
    addWork(frontier, {
      id: "live",
      budgetClass: "interactive_live_search",
      selectedFor: "interactive",
      queuedAt: "2026-01-01T00:00:00.000Z",
      tenantId: "tenant_live"
    });
    const queued = frontier.snapshot()[0];
    if (!queued) throw new Error("missing queued live task");
    queued.task.intelRequestId = "request_live";
    queued.task.crawlBudgetKey = "request_live";
    queued.task.availableAt = "2026-01-01T00:15:00.000Z";

    const diagnostics = buildSchedulerDiagnostics({
      frontier,
      now,
      runs: [run({ id: "run_live", requestId: "request_live", requestHash: "live-reuse_actor_tenant" })]
    });
    expect(diagnostics.backend).toBe("embedded_memory");
    expect(diagnostics.loadFixtures).toHaveLength(4);
    expect(diagnostics.diagnostics[0]).toMatchObject({
      taskId: queued.task.id,
      runId: "run_live",
      requestId: "request_live",
      workClass: "interactive_live_search",
      runReuseKey: "live-reuse_actor_tenant",
      pressureState: "deferred_by_budget",
      fairnessGroup: "tenant_live:request_live:rss"
    });
    expect(diagnostics.diagnostics[0]?.nextActionableAt).toBe("2026-01-01T00:15:00.000Z");
  });

  test("classifies active-run garbage collection decisions without mutating storage", () => {
    const now = new Date("2026-01-01T01:00:00.000Z");
    const decisions = activeRunGcDecisions([
      run({ id: "stale", status: "running", updatedAt: "2026-01-01T00:00:00.000Z" }),
      run({ id: "abandoned", status: "queued", updatedAt: "2026-01-01T00:40:00.000Z" }),
      run({ id: "completed_delta", status: "completed", updatedAt: "2026-01-01T00:58:00.000Z" }),
      run({ id: "completed_archive", status: "completed", updatedAt: "2026-01-01T00:30:00.000Z" }),
      run({ id: "failed_retry", status: "failed", updatedAt: "2026-01-01T00:50:00.000Z" })
    ], now, {
      activePollingRunIds: new Set(["stale"]),
      pendingDeltaRunIds: new Set(["completed_delta"])
    });

    expect(decisions.find((decision) => decision.runId === "stale")?.action).toBe("mark_stale_failed");
    expect(decisions.find((decision) => decision.runId === "abandoned")?.action).toBe("mark_abandoned_cancelled");
    expect(decisions.find((decision) => decision.runId === "completed_delta")?.action).toBe("retain_completed_pending_deltas");
    expect(decisions.find((decision) => decision.runId === "completed_archive")?.action).toBe("archive_completed");
    expect(decisions.find((decision) => decision.runId === "failed_retry")?.action).toBe("retry_failed");
  });

  test("in-memory scheduler repository leases acknowledges retries backoff and cursor deltas", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const later = new Date("2026-01-01T00:00:31.000Z");
    const frontier = new FocusedFrontier({ now: () => now });
    addWork(frontier, {
      id: "runtime",
      budgetClass: "interactive_live_search",
      selectedFor: "interactive",
      queuedAt: now.toISOString(),
      tenantId: "tenant_runtime"
    });
    const task = frontier.snapshot()[0]?.task;
    if (!task) throw new Error("missing runtime task");

    const repo = new InMemorySchedulerQueueRepository({ retryBaseMs: 30_000, leaseMs: 1_000 });
    const enqueue = repo.enqueueTasks([task], now);
    expect(enqueue[0]?.kind).toBe("task_enqueued");

    const lease = repo.leaseNext("worker_1", now);
    expect(lease?.task.id).toBe(task.id);
    const heartbeat = repo.heartbeatLease(task.id, "worker_1", new Date("2026-01-01T00:00:00.500Z"));
    expect(heartbeat.kind).toBe("worker_heartbeat");
    const checkpoint = repo.checkpointTask(task.id, "worker_1", {
      cursor: "capture_cursor_1",
      message: "captured first partial result",
      promotedEvidenceCount: 1,
      partialReason: "partial_capture_available"
    }, new Date("2026-01-01T00:00:00.750Z"));
    expect(checkpoint.kind).toBe("task_checkpointed");
    const cursor = repo.deltasSince().at(-1)?.cursor;
    const retry = repo.acknowledge(task.id, "failed", now);
    expect(retry.kind).toBe("task_retry_scheduled");
    expect(repo.pressure(now)[0]).toMatchObject({
      workClass: "interactive_live_search",
      retryAfterSeconds: 30,
      pressureState: "deferred_by_source_backoff",
      selectedTaskCount: 1
    });
    expect(repo.leaseNext("worker_1", now)).toBeUndefined();
    expect(repo.leaseNext("worker_1", later)?.task.retryCount).toBe(1);
    expect(repo.deltasSince(cursor).map((delta) => delta.kind)).toContain("task_retry_scheduled");
  });

  test("worker runtime contracts cover normal degraded overloaded cancellation retry exhaustion duplicates stale runs and 24h soak states", () => {
    const fixtures = schedulerWorkerRuntimeFixtures(new Date("2026-05-24T05:00:00.000Z"));
    expect(fixtures.map((fixture) => fixture.name)).toEqual([
      "normal",
      "degraded_provider_failure",
      "overloaded",
      "cancelled",
      "retry_exhausted",
      "duplicate_query",
      "stale_active_run",
      "soak_24h"
    ]);
    expect(fixtures.every((fixture) => fixture.workerLoop.lease === "required" && fixture.workerLoop.heartbeat === "required" && fixture.workerLoop.checkpoint === "required")).toBe(true);
    expect(fixtures.find((fixture) => fixture.name === "overloaded")?.queuePressure).toBe("deferred_by_queue_pressure");
    expect(fixtures.find((fixture) => fixture.name === "retry_exhausted")?.deadLetter).toBe(true);
    expect(fixtures.find((fixture) => fixture.name === "duplicate_query")?.queuePressure).toBe("attached_to_active_run");
    expect(fixtures.flatMap((fixture) => fixture.agent09Fields)).toContain("cursorContinuity");
    expect(fixtures.flatMap((fixture) => fixture.agent10GateFields)).toContain("emergencyBrakeState");
  });

  test("defines production worker-loop contracts and queue economics for route and soak DTOs", () => {
    const now = new Date("2026-05-24T06:30:00.000Z");
    const contract = schedulerWorkerLoopContract("2026-05-24T06:30:00.000Z");
    expect(contract.workerLoop.map((step) => step.name)).toEqual([
      "lease",
      "heartbeat",
      "checkpoint",
      "acknowledge",
      "retry_backoff",
      "stale_lease_recovery",
      "duplicate_run_reuse",
      "abandoned_client_cleanup",
      "cancellation",
      "cursor_continuity"
    ]);
    expect(contract.workerLoop.every((step) => step.required)).toBe(true);
    expect(contract.staleLeaseRecovery.preservesCheckpoint).toBe(true);
    expect(contract.cursorContinuity.apiFields).toContain("latestCursor");

    const queued = [
      ...Array.from({ length: 10 }, (_, index) => task({
        id: `task_interactive_economics_${index}`,
        sourceId: "src_public_interactive",
        budgetClass: "interactive_live_search",
        queuedAt: "2026-05-24T06:20:00.000Z",
        retryCount: index % 3 === 0 ? 1 : 0,
        availableAt: index % 3 === 0 ? "2026-05-24T06:35:00.000Z" : undefined
      })),
      ...Array.from({ length: 24 }, (_, index) => task({
        id: `task_sweep_economics_${index}`,
        sourceId: index < 20 ? "src_public_hot" : `src_public_${index}`,
        budgetClass: "broad_daily_sweep",
        fairnessKey: index < 20 ? "public-channel:hot-source" : undefined,
        queuedAt: "2026-05-24T05:50:00.000Z"
      })),
      task({
        id: "task_restricted_economics",
        sourceId: "src_restricted_metadata",
        sourceType: "tor_metadata",
        budgetClass: "restricted_darknet_metadata_sweep",
        queuedAt: "2026-05-24T06:00:00.000Z",
        retryCount: 2,
        availableAt: "2026-05-24T06:40:00.000Z"
      })
    ];
    const economics = buildSchedulerQueueEconomics({
      queued,
      leased: [task({ id: "task_leased_economics", sourceId: "src_public_interactive", budgetClass: "interactive_live_search", queuedAt: "2026-05-24T06:25:00.000Z" })],
      deadLetters: Array.from({ length: 4 }, (_, index) => ({
        status: "retry_exhausted",
        taskId: `task_dead_economics_${index}`,
        task: queued[0]!,
        reason: "provider outage"
      })),
      workerSlots: 16,
      memoryCeilingMb: 512,
      now
    });

    expect(economics.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(economics.totals.retryDebt).toBeGreaterThan(0);
    expect(economics.workClassBudget.map((budget) => budget.workClass)).toContain("interactive_live_search");
    expect(economics.workClassBudget.map((budget) => budget.workClass)).toContain("restricted_darknet_metadata_sweep");
    expect(economics.fairness.ok).toBe(false);
    expect(economics.deadLetterTrend.direction).toBe("rising");
    expect(economics.dryRunCapacityShiftPlan.dryRun).toBe(true);
    expect(economics.dryRunCapacityShiftPlan.willMutate).toBe(false);
    expect(economics.dryRunCapacityShiftPlan.steps.map((step) => step.toWorkload)).toContain("interactive_actor_search");
    expect(economics.dryRunCapacityShiftPlan.steps.map((step) => step.toWorkload)).toContain("restricted_metadata_approvals");
    expect(economics.agent10SoakPacket.fields).toContain("deadLetterTrend");
    expect(["hold", "rollback"]).toContain(economics.agent10SoakPacket.decision);
  });

  test("bridges runtime scheduler execution state into cursor-safe route DTOs and controls", () => {
    const now = new Date("2026-05-24T07:00:00.000Z");
    const later = new Date("2026-05-24T07:00:02.000Z");
    const repo = new InMemorySchedulerQueueRepository({ leaseMs: 1_000, retryBaseMs: 1_000 });
    const runtimeTasks = [
      ...Array.from({ length: 9 }, (_, index) => task({
        id: `task_runtime_hot_${index}`,
        sourceId: "src_public_hot",
        sourceType: index % 3 === 0 ? "telegram_public" : "rss",
        budgetClass: index < 3 ? "interactive_live_search" : "broad_daily_sweep",
        runId: "run_runtime",
        queuedAt: "2026-05-24T06:40:00.000Z",
        retryCount: index % 4 === 0 ? 1 : 0,
        fairnessKey: "public-channel:hot-source"
      })),
      task({
        id: "task_runtime_restricted",
        sourceId: "src_restricted",
        sourceType: "tor_metadata",
        budgetClass: "restricted_darknet_metadata_sweep",
        runId: "run_runtime",
        queuedAt: "2026-05-24T06:45:00.000Z"
      }),
      task({
        id: "task_runtime_graph",
        sourceId: "src_graph",
        budgetClass: "background_refresh",
        fairnessKey: "graph:export",
        runId: "run_graph",
        queuedAt: "2026-05-24T06:30:00.000Z"
      })
    ];
    repo.enqueueTasks(runtimeTasks, now);
    const lease = repo.leaseNext("worker_runtime", now);
    if (!lease) throw new Error("missing runtime lease");
    repo.checkpointTask(lease.task.id, "worker_runtime", {
      cursor: "capture_cursor_runtime",
      message: "runtime checkpoint",
      promotedEvidenceCount: 1
    }, now);
    const beforeRetryCursor = repo.deltasSince().at(-1)?.cursor;
    repo.leaseNext("worker_recovery", later);
    repo.acknowledge(lease.task.id, "failed", later, "provider outage");
    const economics = buildSchedulerQueueEconomics({
      queued: repo.tasks(),
      deadLetters: [{
        status: "retry_exhausted",
        taskId: "task_runtime_dead",
        task: runtimeTasks[0]!,
        reason: "retry exhaustion"
      }],
      workerSlots: 8,
      memoryCeilingMb: 128,
      now: later
    });
    const runtime = buildSchedulerRuntimeExecution({
      queued: repo.tasks(),
      deadLetters: [{
        status: "retry_exhausted",
        taskId: "task_runtime_dead",
        task: runtimeTasks[0]!,
        reason: "retry exhaustion"
      }],
      deltas: repo.deltasSince(),
      sinceCursor: beforeRetryCursor,
      queueEconomics: economics,
      restrictedKillSwitchActive: true,
      approvedRestrictedMetadata: false,
      pendingActivationBatchCount: 20,
      now: later
    });

    expect(runtime.apiTargets).toContain("/v1/intel/runs/{id}");
    expect(runtime.totals.retried).toBeGreaterThan(0);
    expect(runtime.totals.staleRecovered).toBeGreaterThan(0);
    expect(runtime.totals.deadLettered).toBeGreaterThan(0);
    expect(runtime.byRun.find((row) => row.runId === "run_runtime")?.retried).toBeGreaterThan(0);
    expect(runtime.bySource.find((row) => row.sourceId === "src_public_hot")?.noisy).toBe(true);
    expect(runtime.byWorkClass.map((row) => row.workClass)).toContain("restricted_darknet_metadata_sweep");
    expect(runtime.pollingDeltas.cursorContinuity).toBe("continued");
    expect(runtime.pollingDeltas.kinds).toContain("task_retry_scheduled");
    expect(runtime.dryRunControls.dryRun).toBe(true);
    expect(runtime.dryRunControls.willMutate).toBe(false);
    expect(runtime.dryRunControls.controls.map((control) => control.action)).toContain("pause_noisy_sources");
    expect(runtime.dryRunControls.controls.map((control) => control.action)).toContain("reduce_public_channel_windows");
    expect(runtime.dryRunControls.controls.map((control) => control.action)).toContain("hold_restricted_metadata");
    expect(runtime.sourceActivationBudgetGuard.state).toBe("blocked_by_emergency_brake");
    expect(runtime.agent10SoakPacket.fields).toContain("pollingDeltas");
    expect(runtime.agent10SoakPacket.decision).toBe("rollback");
  });

  test("builds runtime SLA DTOs and worker safety plans for 24h scheduler operation", () => {
    const now = new Date("2026-05-24T07:30:00.000Z");
    const queued = [
      ...Array.from({ length: 16 }, (_, index) => task({
        id: `task_sla_public_${index}`,
        sourceId: "src_sla_public_hot",
        sourceType: index % 4 === 0 ? "telegram_public" : "rss",
        budgetClass: index < 8 ? "interactive_live_search" : "broad_daily_sweep",
        runId: "run_sla_public",
        queuedAt: "2026-05-24T07:00:00.000Z",
        retryCount: index % 3 === 0 ? 2 : 0,
        availableAt: index % 3 === 0 ? "2026-05-24T07:35:00.000Z" : undefined,
        fairnessKey: "public-channel:sla-hot-source"
      })),
      task({
        id: "task_sla_restricted",
        sourceId: "src_sla_restricted",
        sourceType: "tor_metadata",
        budgetClass: "restricted_darknet_metadata_sweep",
        runId: "run_sla_restricted",
        queuedAt: "2026-05-24T07:05:00.000Z"
      }),
      task({
        id: "task_sla_graph",
        sourceId: "src_sla_graph",
        budgetClass: "background_refresh",
        fairnessKey: "graph:export",
        runId: "run_sla_graph",
        queuedAt: "2026-05-24T06:45:00.000Z"
      })
    ];
    const deadLetters = Array.from({ length: 5 }, (_, index) => ({
      status: "retry_exhausted" as const,
      taskId: `task_sla_dead_${index}`,
      task: queued[0]!,
      reason: "provider outage"
    }));
    const deltas = [
      {
        cursor: "2026-05-24T07:00:10.000Z#lease",
        at: "2026-05-24T07:00:10.000Z",
        kind: "task_leased" as const,
        taskId: queued[0]!.id,
        runId: "run_sla_public",
        message: "leased task"
      },
      {
        cursor: "2026-05-24T07:00:20.000Z#checkpoint",
        at: "2026-05-24T07:00:20.000Z",
        kind: "task_checkpointed" as const,
        taskId: queued[0]!.id,
        runId: "run_sla_public",
        message: "checkpointed"
      },
      {
        cursor: "2026-05-24T07:00:30.000Z#retry",
        at: "2026-05-24T07:00:30.000Z",
        kind: "task_retry_scheduled" as const,
        taskId: queued[0]!.id,
        runId: "run_sla_public",
        message: "lease expired for task_sla_public_0"
      }
    ];
    const economics = buildSchedulerQueueEconomics({
      queued,
      deadLetters,
      workerSlots: 8,
      memoryCeilingMb: 128,
      now
    });
    const runtime = buildSchedulerRuntimeExecution({
      queued,
      deadLetters,
      deltas,
      sinceCursor: "2026-05-24T07:00:20.000Z#checkpoint",
      queueEconomics: economics,
      restrictedKillSwitchActive: true,
      approvedRestrictedMetadata: false,
      pendingActivationBatchCount: 20,
      now
    });
    const sla = buildSchedulerRuntimeSla({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runs: [
        run({ id: "run_sla_public", status: "running", requestHash: "live-reuse-sla", updatedAt: "2026-05-24T07:20:00.000Z" }),
        run({ id: "run_sla_abandoned", status: "running", updatedAt: "2026-05-24T07:00:00.000Z" })
      ],
      now,
      thresholds: {
        retryDebt: 0,
        deadLetterGrowth: 2,
        sourceSlaPressureCount: 1,
        leaseLatencyMs: 1_000,
        checkpointFreshnessSeconds: 60
      }
    });

    expect(sla.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(sla.state).toBe("breach");
    expect(sla.breached).toContain("retry_debt");
    expect(sla.breached).toContain("dead_letter_growth");
    expect(sla.metrics.map((metric) => metric.name)).toContain("cursor_continuity");
    expect(sla.publicAnswerImpact).toMatch(/degraded|blocked|partial_only/);
    expect(sla.apiPollingImpact).toMatch(/normal|slow_poll|cursor_replay_required|blocked/);
    expect(sla.workerSafetyPlan.dryRun).toBe(true);
    expect(sla.workerSafetyPlan.willMutate).toBe(false);
    expect(sla.workerSafetyPlan.controls.map((control) => control.action)).toContain("pause_noisy_sources");
    expect(sla.workerSafetyPlan.controls.map((control) => control.action)).toContain("hold_restricted_metadata");
    expect(sla.workerSafetyPlan.recoveryActions.map((action) => action.action)).toContain("recover_stale_leases");
    expect(sla.workerSafetyPlan.recoveryActions.map((action) => action.action)).toContain("hold_release_packet");
    expect(sla.agent10ReleasePacket.fields).toContain("workerSafetyPlan");
    expect(["hold", "rollback"]).toContain(sla.agent10ReleasePacket.decision);
  });

  test("enforces scheduler SLA release gates and live-run drain plans without mutating queues", () => {
    const now = new Date("2026-05-24T08:00:00.000Z");
    const queued = [
      ...Array.from({ length: 18 }, (_, index) => task({
        id: `task_enforce_live_${index}`,
        sourceId: "src_enforce_public_hot",
        sourceType: index % 3 === 0 ? "telegram_public" : "rss",
        budgetClass: index < 10 ? "interactive_live_search" : "broad_daily_sweep",
        runId: "run_enforce_live",
        queuedAt: "2026-05-24T07:40:00.000Z",
        retryCount: index % 2 === 0 ? 2 : 0,
        availableAt: index % 2 === 0 ? "2026-05-24T08:05:00.000Z" : undefined,
        fairnessKey: "public-channel:enforce-hot-source"
      })),
      task({
        id: "task_enforce_restricted",
        sourceId: "src_enforce_restricted",
        sourceType: "tor_metadata",
        budgetClass: "restricted_darknet_metadata_sweep",
        runId: "run_enforce_restricted",
        queuedAt: "2026-05-24T07:41:00.000Z"
      }),
      task({
        id: "task_enforce_graph",
        sourceId: "src_enforce_graph",
        budgetClass: "background_refresh",
        fairnessKey: "graph:export",
        runId: "run_enforce_graph",
        queuedAt: "2026-05-24T07:30:00.000Z"
      }),
      task({
        id: "task_enforce_replay",
        sourceId: "src_enforce_replay",
        budgetClass: "background_refresh",
        fairnessKey: "retention:replay",
        runId: "run_enforce_replay",
        queuedAt: "2026-05-24T07:20:00.000Z"
      })
    ];
    const deadLetters = Array.from({ length: 6 }, (_, index) => ({
      status: "retry_exhausted" as const,
      taskId: `task_enforce_dead_${index}`,
      task: queued[0]!,
      reason: "provider outage"
    }));
    const deltas = [
      {
        cursor: "2026-05-24T07:20:00.000Z#checkpoint",
        at: "2026-05-24T07:20:00.000Z",
        kind: "task_checkpointed" as const,
        taskId: queued[0]!.id,
        runId: "run_enforce_live",
        message: "checkpointed before queue spike"
      },
      {
        cursor: "2026-05-24T07:21:00.000Z#retry",
        at: "2026-05-24T07:21:00.000Z",
        kind: "task_retry_scheduled" as const,
        taskId: queued[0]!.id,
        runId: "run_enforce_live",
        message: "lease expired for task_enforce_live_0"
      }
    ];
    const economics = buildSchedulerQueueEconomics({
      queued,
      deadLetters,
      workerSlots: 8,
      memoryCeilingMb: 128,
      now
    });
    const runtime = buildSchedulerRuntimeExecution({
      queued,
      deadLetters,
      deltas,
      sinceCursor: "2026-05-24T07:21:00.000Z#retry",
      queueEconomics: economics,
      restrictedKillSwitchActive: true,
      approvedRestrictedMetadata: false,
      pendingActivationBatchCount: 24,
      now
    });
    const sla = buildSchedulerRuntimeSla({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runs: [
        run({ id: "run_enforce_live", status: "running", updatedAt: "2026-05-24T07:30:00.000Z" }),
        run({ id: "run_enforce_graph", status: "running", requestHash: "graph-export-reuse", updatedAt: "2026-05-24T07:55:00.000Z" })
      ],
      now,
      thresholds: {
        retryDebt: 0,
        deadLetterGrowth: 2,
        abandonedClientCleanupCount: 0,
        leaseLatencyMs: 1_000,
        checkpointFreshnessSeconds: 60,
        sourceSlaPressureCount: 1,
        cursorContinuityGapCount: 0
      }
    });
    const enforcement = buildSchedulerSlaEnforcement({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runtimeSla: sla,
      runs: [
        run({ id: "run_enforce_live", status: "running", updatedAt: "2026-05-24T07:30:00.000Z" }),
        run({ id: "run_enforce_graph", status: "running", requestHash: "graph-export-reuse", updatedAt: "2026-05-24T07:55:00.000Z" })
      ],
      now
    });

    expect(enforcement.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(enforcement.apiTargets).toContain("/v1/frontier/status");
    expect(enforcement.state).toBe("rollback");
    expect([...enforcement.holds, ...enforcement.warnings].map((finding) => finding.reason)).toEqual(expect.arrayContaining([
      "queue_age",
      "lease_age",
      "checkpoint_gap",
      "retry_debt",
      "dead_letters",
      "abandoned_clients",
      "duplicate_run_reuse",
      "fairness_drift",
      "source_sla_pressure",
      "cursor_discontinuity"
    ]));
    expect(enforcement.releaseGate.dryRun).toBe(true);
    expect(enforcement.releaseGate.willMutate).toBe(false);
    expect(enforcement.releaseGate.decision).toBe("rollback");
    expect(enforcement.drainPlan.dryRun).toBe(true);
    expect(enforcement.drainPlan.willMutate).toBe(false);
    expect(enforcement.drainPlan.steps.map((step) => step.action)).toEqual(expect.arrayContaining([
      "drain_overloaded_live_search",
      "drain_public_channel_backlog",
      "hold_restricted_metadata",
      "drain_graph_export_backlog",
      "drain_evidence_replay_load",
      "hold_source_activation_wave",
      "recover_stale_leases",
      "preserve_cursor_replay"
    ]));
    expect(enforcement.drainPlan.steps.every((step) => step.dryRun && step.willMutate === false)).toBe(true);
    expect(enforcement.agent10ReleasePacket.fields).toContain("drainPlan");
    expect(enforcement.agent10ReleasePacket.proofCommands).toContain("bun run check:frontier-apply-plan");
  });

  test("models production worker queue cutover contracts across backend candidates", () => {
    const now = new Date("2026-05-24T08:20:00.000Z");
    const queued = [
      ...Array.from({ length: 12 }, (_, index) => task({
        id: `task_cutover_live_${index}`,
        sourceId: index < 9 ? "src_cutover_public_hot" : `src_cutover_public_${index}`,
        sourceType: index % 4 === 0 ? "telegram_public" : "rss",
        budgetClass: index < 6 ? "interactive_live_search" : "broad_daily_sweep",
        runId: "run_cutover_live",
        queuedAt: "2026-05-24T08:00:00.000Z",
        retryCount: index % 5 === 0 ? 1 : 0,
        fairnessKey: index < 9 ? "public-channel:cutover-hot" : undefined
      })),
      task({
        id: "task_cutover_restricted",
        sourceId: "src_cutover_restricted",
        sourceType: "tor_metadata",
        budgetClass: "restricted_darknet_metadata_sweep",
        runId: "run_cutover_restricted",
        queuedAt: "2026-05-24T08:03:00.000Z"
      }),
      task({
        id: "task_cutover_health",
        sourceId: "src_cutover_health",
        budgetClass: "source_health_probe",
        runId: "run_cutover_health",
        queuedAt: "2026-05-24T08:04:00.000Z"
      }),
      task({
        id: "task_cutover_replay",
        sourceId: "src_cutover_replay",
        budgetClass: "background_refresh",
        fairnessKey: "retention:replay",
        runId: "run_cutover_replay",
        queuedAt: "2026-05-24T07:55:00.000Z"
      })
    ];
    const economics = buildSchedulerQueueEconomics({
      queued,
      workerSlots: 96,
      memoryCeilingMb: 96 * 1024,
      now
    });
    const runtime = buildSchedulerRuntimeExecution({
      queued,
      queueEconomics: economics,
      pendingActivationBatchCount: 8,
      now
    });
    const sla = buildSchedulerRuntimeSla({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runs: [run({ id: "run_cutover_live", status: "running", requestHash: "cutover-reuse", updatedAt: "2026-05-24T08:19:00.000Z" })],
      now
    });
    const enforcement = buildSchedulerSlaEnforcement({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runtimeSla: sla,
      runs: [run({ id: "run_cutover_live", status: "running", requestHash: "cutover-reuse", updatedAt: "2026-05-24T08:19:00.000Z" })],
      now
    });
    const cutover = buildSchedulerWorkerQueueCutover({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runtimeSla: sla,
      slaEnforcement: enforcement,
      workerSlots: 96,
      memoryCeilingMb: 96 * 1024,
      now
    });

    expect(cutover.apiTargets).toContain("/v1/frontier/status");
    expect(cutover.runtime.engine).toBe("bun_worker_runtime");
    expect(cutover.runtime.dryRun).toBe(true);
    expect(cutover.runtime.willMutate).toBe(false);
    expect(cutover.partitions.map((partition) => partition.workload)).toEqual(expect.arrayContaining([
      "interactive_actor_search",
      "scheduled_source_sweep",
      "public_channel_window",
      "restricted_metadata_approval",
      "evidence_replay",
      "graph_export",
      "retention",
      "health_probe"
    ]));
    expect(cutover.partitions.every((partition) =>
      partition.reservedWorkerSlots > 0 &&
      partition.leaseTtlSeconds > 0 &&
      partition.checkpointEverySeconds > 0 &&
      partition.retry.jitter === "deterministic" &&
      partition.deadLetter.afterAttempts > partition.retry.maxAttempts
    )).toBe(true);
    expect(cutover.semantics.lease).toContain("exclusive");
    expect(cutover.semantics.runReuse).toContain("reuse");
    expect(cutover.capacityEnvelope.normalMemoryTargetMb).toBe(98_304 as const);
    expect(cutover.capacityEnvelope.hardCeilingMb).toBe(163_840 as const);
    expect(cutover.capacityEnvelope.normalTargetOk).toBe(true);
    expect(cutover.capacityEnvelope.hardCeilingOk).toBe(true);
    expect(cutover.backendCutoverPackets.map((packet) => packet.backend)).toEqual([
      "postgres_advisory_queue",
      "redis_streams",
      "nats_jetstream"
    ]);
    expect(cutover.backendCutoverPackets.every((packet) => packet.dryRun && packet.willMutate === false)).toBe(true);
    expect(cutover.releaseGate.proofCommands).toContain("bun run check:route-inventory");
    expect(cutover.agent10ReleasePacket.fields).toContain("backendCutoverPackets");
  });

  test("builds runtime worker 24h soak SLOs and backend migration packets", () => {
    const now = new Date("2026-05-24T08:40:00.000Z");
    const queued = [
      ...Array.from({ length: 20 }, (_, index) => task({
        id: `task_soak_live_${index}`,
        sourceId: index < 14 ? "src_soak_public_hot" : `src_soak_public_${index}`,
        sourceType: index % 5 === 0 ? "telegram_public" : "rss",
        budgetClass: index < 8 ? "interactive_live_search" : "broad_daily_sweep",
        runId: "run_soak_live",
        queuedAt: "2026-05-24T08:25:00.000Z",
        retryCount: index % 6 === 0 ? 1 : 0,
        fairnessKey: index < 14 ? "public-channel:soak-hot" : undefined
      })),
      task({ id: "task_soak_restricted", sourceId: "src_soak_restricted", sourceType: "tor_metadata", budgetClass: "restricted_darknet_metadata_sweep", runId: "run_soak_restricted", queuedAt: "2026-05-24T08:28:00.000Z" }),
      task({ id: "task_soak_replay", sourceId: "src_soak_replay", budgetClass: "background_refresh", fairnessKey: "retention:replay", runId: "run_soak_replay", queuedAt: "2026-05-24T08:10:00.000Z" }),
      task({ id: "task_soak_graph", sourceId: "src_soak_graph", budgetClass: "background_refresh", fairnessKey: "graph:export", runId: "run_soak_graph", queuedAt: "2026-05-24T08:12:00.000Z" }),
      task({ id: "task_soak_health", sourceId: "src_soak_health", budgetClass: "source_health_probe", runId: "run_soak_health", queuedAt: "2026-05-24T08:32:00.000Z" })
    ];
    const economics = buildSchedulerQueueEconomics({ queued, workerSlots: 96, memoryCeilingMb: 96 * 1024, now });
    const runtime = buildSchedulerRuntimeExecution({ queued, queueEconomics: economics, pendingActivationBatchCount: 8, now });
    const sla = buildSchedulerRuntimeSla({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runs: [run({ id: "run_soak_live", status: "running", requestHash: "soak-reuse", updatedAt: "2026-05-24T08:39:00.000Z" })],
      now
    });
    const enforcement = buildSchedulerSlaEnforcement({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runtimeSla: sla,
      runs: [run({ id: "run_soak_live", status: "running", requestHash: "soak-reuse", updatedAt: "2026-05-24T08:39:00.000Z" })],
      now
    });
    const cutover = buildSchedulerWorkerQueueCutover({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, now });
    const soak = buildSchedulerWorkerSoakMigration({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runtimeSla: sla,
      slaEnforcement: enforcement,
      workerQueueCutover: cutover,
      now
    });

    expect(soak.apiTargets).toContain("/v1/contracts");
    expect(soak.apiTargets).toContain("agent10_release_train");
    expect(soak.durationHours).toBe(24);
    expect(soak.dryRun).toBe(true);
    expect(soak.willMutate).toBe(false);
    expect(soak.partitionSlo.map((partition) => partition.workload)).toEqual(expect.arrayContaining([
      "interactive_actor_search",
      "public_channel_window",
      "restricted_metadata_approval",
      "evidence_replay",
      "graph_export",
      "retention",
      "health_probe"
    ]));
    expect(soak.partitionSlo.every((partition) =>
      partition.queueAgeP95Seconds >= 0 &&
      partition.queueAgeP99Seconds >= partition.queueAgeP95Seconds &&
      partition.checkpointCadenceSeconds > 0 &&
      partition.retryDebtThreshold > 0 &&
      partition.deadLetterBudget > 0 &&
      partition.safeDrainControls.length > 0
    )).toBe(true);
    expect(["pass", "watch", "hold", "rollback"]).toContain(soak.aggregate.state);
    expect(soak.migrationPackets.map((packet) => packet.id)).toEqual([
      "embedded_to_postgres",
      "embedded_to_redis",
      "embedded_to_nats"
    ]);
    expect(soak.migrationPackets.every((packet) =>
      packet.dryRun &&
      packet.willMutate === false &&
      packet.cursorContinuity === "preserved" &&
      packet.replayPreservation === "required" &&
      packet.agent09WarningCodes.length > 0
    )).toBe(true);
    expect(soak.routeContracts.contractsField).toBe("surfaces.frontier.contracts.worker_soak_migration");
    expect(soak.releaseTrain.proofCommands).toContain("bun run rehearse:cutover examples/cutover-rehearsal-pass.json");
  });

  test("builds 10k multi-worker lease replay harness for enterprise scheduler soak", () => {
    const now = new Date("2026-05-24T21:45:00.000Z");
    const queued = Array.from({ length: 64 }, (_, index) => task({
      id: `task_lease_soak_${index}`,
      sourceId: index < 20 ? "src_lease_soak_public_hot" : `src_lease_soak_${index}`,
      sourceType: index % 7 === 0 ? "tor_metadata" : index % 4 === 0 ? "telegram_public" : "rss",
      budgetClass: index < 24 ? "interactive_live_search" : index % 7 === 0 ? "restricted_darknet_metadata_sweep" : "broad_daily_sweep",
      runId: "run_lease_soak",
      queuedAt: "2026-05-24T21:30:00.000Z",
      retryCount: index % 11 === 0 ? 1 : 0,
      fairnessKey: index < 20 ? "tenant:actor:apt29:clear_web" : undefined
    }));
    const economics = buildSchedulerQueueEconomics({ queued, workerSlots: 128, memoryCeilingMb: 128 * 1024, now });
    const runtime = buildSchedulerRuntimeExecution({ queued, queueEconomics: economics, pendingActivationBatchCount: 4, now });
    const sla = buildSchedulerRuntimeSla({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runs: [run({ id: "run_lease_soak", status: "running", requestHash: "lease-soak-reuse", updatedAt: "2026-05-24T21:44:00.000Z" })],
      now
    });
    const enforcement = buildSchedulerSlaEnforcement({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runtimeSla: sla,
      runs: [run({ id: "run_lease_soak", status: "running", requestHash: "lease-soak-reuse", updatedAt: "2026-05-24T21:44:00.000Z" })],
      now
    });
    const cutover = buildSchedulerWorkerQueueCutover({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, now });
    const soak = buildSchedulerWorkerSoakMigration({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, now });
    const harness = buildSchedulerWorkerLeaseSoakHarness({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runtimeSla: sla,
      workerQueueCutover: cutover,
      workerSoakMigration: soak,
      now
    });

    expect(harness.apiTargets).toContain("/v1/frontier/status");
    expect(harness.apiTargets).toContain("/v1/contracts");
    expect(harness.dryRun).toBe(true);
    expect(harness.willMutate).toBe(false);
    expect(harness.replay.fixtureName).toBe("agent02_10k_multi_worker_lease_replay");
    expect(harness.replay.totalTasks).toBe(10_000);
    expect(harness.replay.duplicateRunReuseRequired).toBe(true);
    expect(harness.workloadSlices.reduce((sum, slice) => sum + slice.taskCount, 0)).toBe(10_000);
    expect(harness.workloadSlices.map((slice) => slice.scenario)).toEqual([
      "apt29_actor_burst",
      "public_channel_fanout",
      "restricted_metadata_holds",
      "evidence_replay_backlog",
      "graph_export_wave",
      "source_outage_wave",
      "parser_failure_storm",
      "low_value_sweep_pressure"
    ]);
    expect(harness.workloadSlices.every((slice) =>
      slice.leaseAttempts >= slice.taskCount &&
      slice.retryBudget > 0 &&
      slice.deadLetterBudget > 0 &&
      slice.requestDeadlineSeconds > 0 &&
      slice.workerPartitionId.length > 0
    )).toBe(true);
    expect(harness.workerPartitions.map((partition) => partition.workload)).toEqual(expect.arrayContaining([
      "interactive_actor_search",
      "public_channel_window",
      "restricted_metadata_approval",
      "evidence_replay",
      "graph_export",
      "retention",
      "health_probe"
    ]));
    expect(harness.leaseSemantics.exclusiveLeases).toBe(true);
    expect(harness.leaseSemantics.perSourceConcurrency).toContain("never_bypassed");
    expect(harness.fairnessProof.dimensions).toEqual(["tenant", "query_class", "source_family", "workload", "restricted_policy_state"]);
    expect(harness.fairnessProof.publicPollingProtected).toBe(true);
    expect(harness.fairnessProof.lowValueSweepsDeferred).toBe(true);
    expect(harness.pressureFixtures.map((fixture) => fixture.expectedSchedulerAction)).toEqual(expect.arrayContaining([
      "reuse_active_run",
      "hold_restricted_metadata",
      "retry_then_dead_letter",
      "defer_low_value_sweeps"
    ]));
    expect(harness.routeContracts.contractsField).toBe("surfaces.frontier.contracts.worker_lease_soak_harness");
    expect(harness.releaseGate.proofCommands).toContain("bun run check:contract-index");
  });

  test("defines scheduler production adapter telemetry for canary and RC gates", () => {
    const now = new Date("2026-05-24T09:45:00.000Z");
    const queued = [
      ...Array.from({ length: 18 }, (_, index) => task({
        id: `task_adapter_live_${index}`,
        sourceId: index < 12 ? "src_adapter_public_hot" : `src_adapter_public_${index}`,
        sourceType: index % 3 === 0 ? "telegram_public" : "rss",
        budgetClass: index < 8 ? "interactive_live_search" : "broad_daily_sweep",
        runId: "run_adapter_live",
        queuedAt: "2026-05-24T09:30:00.000Z",
        retryCount: index % 5 === 0 ? 1 : 0,
        fairnessKey: index < 12 ? "public-channel:adapter-hot" : undefined
      })),
      task({ id: "task_adapter_restricted", sourceId: "src_adapter_restricted", sourceType: "tor_metadata", budgetClass: "restricted_darknet_metadata_sweep", runId: "run_adapter_restricted", queuedAt: "2026-05-24T09:31:00.000Z" }),
      task({ id: "task_adapter_replay", sourceId: "src_adapter_replay", budgetClass: "background_refresh", fairnessKey: "retention:replay", runId: "run_adapter_replay", queuedAt: "2026-05-24T09:20:00.000Z" }),
      task({ id: "task_adapter_graph", sourceId: "src_adapter_graph", budgetClass: "background_refresh", fairnessKey: "graph:export", runId: "run_adapter_graph", queuedAt: "2026-05-24T09:22:00.000Z" })
    ];
    const economics = buildSchedulerQueueEconomics({ queued, workerSlots: 96, memoryCeilingMb: 96 * 1024, now });
    const runtime = buildSchedulerRuntimeExecution({ queued, queueEconomics: economics, pendingActivationBatchCount: 10, now });
    const sla = buildSchedulerRuntimeSla({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runs: [run({ id: "run_adapter_live", status: "running", requestHash: "adapter-reuse", updatedAt: "2026-05-24T09:44:00.000Z" })],
      now
    });
    const enforcement = buildSchedulerSlaEnforcement({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runtimeSla: sla,
      runs: [run({ id: "run_adapter_live", status: "running", requestHash: "adapter-reuse", updatedAt: "2026-05-24T09:44:00.000Z" })],
      now
    });
    const cutover = buildSchedulerWorkerQueueCutover({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, now });
    const soak = buildSchedulerWorkerSoakMigration({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, now });
    const telemetry = buildSchedulerProductionAdapterTelemetry({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runtimeSla: sla,
      slaEnforcement: enforcement,
      workerQueueCutover: cutover,
      workerSoakMigration: soak,
      now
    });
    const controlPlane = buildSchedulerCanaryControlPlane({
      productionAdapterTelemetry: telemetry,
      queueEconomics: economics,
      slaEnforcement: enforcement,
      workerQueueCutover: cutover,
      workerSoakMigration: soak,
      now
    });

    expect(telemetry.apiTargets).toContain("/v1/contracts");
    expect(telemetry.apiTargets).toContain("agent10_rc_gates");
    expect(telemetry.dryRun).toBe(true);
    expect(telemetry.willMutate).toBe(false);
    expect(telemetry.adapterContracts.map((contract) => contract.implementation)).toEqual([
      "embedded_memory",
      "postgres_advisory_queue",
      "redis_streams",
      "nats_jetstream"
    ]);
    expect(telemetry.adapterContracts.find((contract) => contract.implementation === "embedded_memory")?.mode).toBe("active");
    expect(telemetry.adapterContracts.every((contract) => contract.methods.includes("checkpoint") && contract.telemetryFields.includes("drainProgress"))).toBe(true);
    expect(telemetry.telemetry.leaseThroughputPerMinute).toBeGreaterThan(0);
    expect(telemetry.telemetry.ackLatencyP95Ms).toBeGreaterThan(0);
    expect(telemetry.telemetry.queueAge.p99Seconds).toBeGreaterThanOrEqual(telemetry.telemetry.queueAge.p95Seconds);
    expect(telemetry.telemetry.replayPreservation).toBe("preserved");
    expect(telemetry.telemetry.deadLetterCauses.map((cause) => cause.cause)).toContain("retry_exhausted");
    expect(telemetry.telemetry.drainProgress.length).toBeGreaterThan(0);
    expect(telemetry.soakFixtures.map((fixture) => fixture.scenario)).toEqual([
      "source_canary_rollout",
      "public_channel_canary",
      "restricted_certification",
      "evidence_replay",
      "graph_export",
      "public_ti_traffic"
    ]);
    expect(telemetry.soakFixtures.every((fixture) => fixture.requiredTelemetry.includes("cursorContinuity"))).toBe(true);
    expect(telemetry.agent09WarningCodes).toEqual(expect.arrayContaining(["scheduler_migration_postgres_shadow"]));
    expect(telemetry.agent10RcGate.fields).toContain("telemetry");
    expect(telemetry.agent10RcGate.proofCommands).toContain("bun run plan:cutover examples/cutover-rehearsal-pass.json");
    expect(controlPlane.apiTargets).toEqual(expect.arrayContaining(["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/search.scheduler", "/v1/contracts"]));
    expect(controlPlane.dryRun).toBe(true);
    expect(controlPlane.willMutate).toBe(false);
    expect(controlPlane.controls.map((control) => control.scenario)).toEqual(expect.arrayContaining(["source_canary_rollout", "public_channel_canary", "restricted_certification", "evidence_replay", "graph_export", "public_ti_traffic"]));
    expect(controlPlane.controls.map((control) => control.action)).toEqual(expect.arrayContaining(["start", "pause", "drain", "rollback", "expand"]));
    expect(controlPlane.controls.every((control) => control.dryRun && control.willMutate === false && control.cursorReplayGuarantee.replayPreservation === "preserved")).toBe(true);
    expect(controlPlane.controls.flatMap((control) => control.workerPartitionEffects).map((effect) => effect.workload)).toEqual(expect.arrayContaining(["interactive_actor_search", "public_channel_window", "restricted_metadata_approval", "evidence_replay", "graph_export"]));
    expect(controlPlane.headroom.memoryCeilingMb).toBe(160 * 1024);
    expect(controlPlane.headroom.memoryHeadroomMb).toBeGreaterThanOrEqual(0);
    expect(controlPlane.routeContracts.frontierApplyPlanField).toBe("applyPlan.canaryControlPlane");
    expect(controlPlane.agent10ReleaseDecision.fields).toContain("headroom");
    expect(controlPlane.agent10ReleaseDecision.proofCommands).toContain("bun run check:frontier-apply-plan");
  });

  test("defines durable backend readiness with fairness, drain, emergency brake, and cursor semantics", () => {
    const now = new Date("2026-05-24T10:25:00.000Z");
    const queued = [
      ...Array.from({ length: 16 }, (_, index) => task({
        id: `task_durable_live_${index}`,
        sourceId: index < 10 ? "src_durable_public_hot" : `src_durable_public_${index}`,
        sourceType: index % 4 === 0 ? "telegram_public" : "rss",
        budgetClass: index < 7 ? "interactive_live_search" : "broad_daily_sweep",
        runId: "run_durable_live",
        queuedAt: "2026-05-24T10:12:00.000Z",
        retryCount: index % 5 === 0 ? 1 : 0,
        fairnessKey: index < 10 ? "public-channel:durable-hot" : undefined
      })),
      task({ id: "task_durable_restricted", sourceId: "src_durable_restricted", sourceType: "tor_metadata", budgetClass: "restricted_darknet_metadata_sweep", runId: "run_durable_restricted", queuedAt: "2026-05-24T10:14:00.000Z" }),
      task({ id: "task_durable_replay", sourceId: "src_durable_replay", budgetClass: "background_refresh", fairnessKey: "evidence:replay", runId: "run_durable_replay", queuedAt: "2026-05-24T10:00:00.000Z" }),
      task({ id: "task_durable_graph", sourceId: "src_durable_graph", budgetClass: "background_refresh", fairnessKey: "graph:export", runId: "run_durable_graph", queuedAt: "2026-05-24T10:01:00.000Z" }),
      task({ id: "task_durable_retention", sourceId: "src_durable_retention", budgetClass: "background_refresh", fairnessKey: "retention:daily", runId: "run_durable_retention", queuedAt: "2026-05-24T09:58:00.000Z" }),
      task({ id: "task_durable_health", sourceId: "src_durable_health", budgetClass: "source_health_probe", runId: "run_durable_health", queuedAt: "2026-05-24T10:18:00.000Z" })
    ];
    const economics = buildSchedulerQueueEconomics({ queued, workerSlots: 96, memoryCeilingMb: 96 * 1024, now });
    const runtime = buildSchedulerRuntimeExecution({ queued, queueEconomics: economics, pendingActivationBatchCount: 6, now });
    const sla = buildSchedulerRuntimeSla({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runs: [run({ id: "run_durable_live", status: "running", requestHash: "durable-reuse", updatedAt: "2026-05-24T10:24:00.000Z" })],
      now
    });
    const enforcement = buildSchedulerSlaEnforcement({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runtimeSla: sla,
      runs: [run({ id: "run_durable_live", status: "running", requestHash: "durable-reuse", updatedAt: "2026-05-24T10:24:00.000Z" })],
      now
    });
    const cutover = buildSchedulerWorkerQueueCutover({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, now });
    const soak = buildSchedulerWorkerSoakMigration({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, now });
    const telemetry = buildSchedulerProductionAdapterTelemetry({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runtimeSla: sla,
      slaEnforcement: enforcement,
      workerQueueCutover: cutover,
      workerSoakMigration: soak,
      now
    });
    const controlPlane = buildSchedulerCanaryControlPlane({
      productionAdapterTelemetry: telemetry,
      queueEconomics: economics,
      slaEnforcement: enforcement,
      workerQueueCutover: cutover,
      workerSoakMigration: soak,
      now
    });
    const readiness = buildSchedulerDurableBackendReadiness({
      queueEconomics: economics,
      runtimeExecution: runtime,
      runtimeSla: sla,
      slaEnforcement: enforcement,
      workerQueueCutover: cutover,
      workerSoakMigration: soak,
      productionAdapterTelemetry: telemetry,
      canaryControlPlane: controlPlane,
      now
    });

    expect(readiness.apiTargets).toEqual(expect.arrayContaining(["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/search.scheduler", "/v1/contracts"]));
    expect(readiness.dryRun).toBe(true);
    expect(readiness.willMutate).toBe(false);
    expect(readiness.backendContracts.map((contract) => contract.backend)).toEqual([
      "embedded_memory",
      "postgres_advisory_queue",
      "redis_streams",
      "nats_jetstream"
    ]);
    expect(readiness.backendContracts.every((contract) =>
      contract.dryRun &&
      contract.willMutate === false &&
      contract.primitives.includes("lease") &&
      contract.primitives.includes("checkpoint") &&
      contract.primitives.includes("dead_letter") &&
      contract.primitives.includes("reuse_run") &&
      contract.cursorContinuity === "preserved" &&
      contract.duplicateRunReuse === "required"
    )).toBe(true);
    expect(readiness.fairnessLanes.map((lane) => lane.workload)).toEqual(expect.arrayContaining([
      "interactive_actor_search",
      "scheduled_source_sweep",
      "public_channel_window",
      "restricted_metadata_approval",
      "evidence_replay",
      "graph_export",
      "retention",
      "health_probe"
    ]));
    expect(readiness.fairnessLanes.every((lane) =>
      lane.reservedWorkerSlots > 0 &&
      lane.maxConcurrentLeases >= lane.reservedWorkerSlots &&
      lane.agingBoostEverySeconds > 0 &&
      lane.fairnessKeys.length > 0 &&
      lane.retryBudget.deadLetterAfterAttempts > lane.retryBudget.maxAttempts
    )).toBe(true);
    expect(readiness.semanticInvariants).toContain("fairness and per-source concurrency are evaluated before leases are granted");
    expect(readiness.semanticInvariants).toContain("3-second public polling hints never enqueue duplicate work when an active reuse key exists");
    expect(readiness.pollingContract.nextPollSeconds).toBe(3);
    expect(readiness.pollingContract.publicWrapperCursorSemantics).toBe("stable_since_cursor_with_delta_replay");
    expect(readiness.runReuse.contract).toBe("duplicate_public_polling_attaches_to_active_run");
    expect(readiness.drainPlan.preservesCursorReplayState).toBe(true);
    expect(readiness.drainPlan.actions).toEqual(expect.arrayContaining(["drain_overloaded_live_search", "drain_public_channel_backlog", "hold_restricted_metadata"]));
    expect(readiness.emergencyBrake.preservesCursorReplayState).toBe(true);
    expect(readiness.emergencyBrake.releaseCriteria).toContain("cursor replay state is preserved for public polling and active runs");
    expect(["pass", "hold", "rollback"]).toContain(readiness.releaseGate.decision);
    expect(readiness.releaseGate.proofCommands).toContain("bun run check");
    expect(readiness.routeContracts.contractsField).toBe("surfaces.frontier.contracts.durable_backend_readiness");
  });

  test("builds freshness SLO cadence hints from source reliability parser health yield and queue pressure", () => {
    const now = new Date("2026-05-24T11:00:00.000Z");
    const sources = [
      source({
        id: "src_fresh_primary",
        type: "rss",
        trustScore: 0.94,
        crawlFrequencySeconds: 1_800,
        health: { status: "healthy", consecutiveFailures: 0, errorRate: 0.01, lastSuccessAt: "2026-05-24T08:00:00.000Z" },
        scoring: { reliability: 0.95, freshness: 0.3, relevance: 0.9, uniqueness: 0.8, parseability: 0.92, policyRiskPenalty: 0, operatorBoost: 0.2 },
        crawlState: { lastCollectedAt: "2026-05-24T08:00:00.000Z", retryCount: 0 }
      }),
      source({
        id: "src_fresh_backoff",
        type: "telegram_public",
        trustScore: 0.78,
        crawlFrequencySeconds: 900,
        health: { status: "degraded", consecutiveFailures: 2, errorRate: 0.2, lastFailureAt: "2026-05-24T10:40:00.000Z" },
        scoring: { reliability: 0.72, freshness: 0.5, relevance: 0.7, uniqueness: 0.7, parseability: 0.5, policyRiskPenalty: 0, operatorBoost: 0.1 },
        crawlState: { lastCollectedAt: "2026-05-24T10:00:00.000Z", backoffUntil: "2026-05-24T11:20:00.000Z", retryCount: 2 }
      })
    ];
    const queued = [
      task({ id: "task_fresh_primary", sourceId: "src_fresh_primary", budgetClass: "interactive_live_search", queuedAt: "2026-05-24T10:45:00.000Z", planning: {
        budgetClass: "interactive_live_search",
        decision: "selected",
        reason: "stale actor source",
        queryTerms: ["APT29"],
        freshness: 0.2,
        freshnessTargetSeconds: 1_800,
        sourceTrust: 0.95,
        selectedFor: "interactive"
      } }),
      task({ id: "task_fresh_backoff", sourceId: "src_fresh_backoff", sourceType: "telegram_public", budgetClass: "broad_daily_sweep", queuedAt: "2026-05-24T10:48:00.000Z", availableAt: "2026-05-24T11:20:00.000Z", retryCount: 1, planning: {
        budgetClass: "broad_daily_sweep",
        decision: "waiting-for-backoff",
        reason: "public channel backoff",
        queryTerms: ["APT29"],
        freshness: 0.5,
        freshnessTargetSeconds: 900,
        sourceTrust: 0.72,
        selectedFor: "background"
      } })
    ];
    const economics = buildSchedulerQueueEconomics({ queued, workerSlots: 96, memoryCeilingMb: 96 * 1024, now });
    const runtime = buildSchedulerRuntimeExecution({ queued, queueEconomics: economics, pendingActivationBatchCount: 0, now });
    const sla = buildSchedulerRuntimeSla({ queueEconomics: economics, runtimeExecution: runtime, runs: [], now });
    const enforcement = buildSchedulerSlaEnforcement({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, runs: [], now });
    const cutover = buildSchedulerWorkerQueueCutover({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, now });
    const soak = buildSchedulerWorkerSoakMigration({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, now });
    const telemetry = buildSchedulerProductionAdapterTelemetry({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const canary = buildSchedulerCanaryControlPlane({ productionAdapterTelemetry: telemetry, queueEconomics: economics, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const readiness = buildSchedulerDurableBackendReadiness({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, productionAdapterTelemetry: telemetry, canaryControlPlane: canary, now });
    const freshness = buildSchedulerFreshnessSloEngine({
      plan: plan({ query: "APT29", entityType: "actor", priority: "urgent", tasks: queued }),
      sources,
      queueEconomics: economics,
      runtimeExecution: runtime,
      slaEnforcement: enforcement,
      workerQueueCutover: cutover,
      durableBackendReadiness: readiness,
      now
    });

    expect(freshness.apiTargets).toEqual(expect.arrayContaining(["/v1/frontier/status", "/v1/intel/runs/{id}", "/v1/contracts"]));
    expect(freshness.dryRun).toBe(true);
    expect(freshness.willMutate).toBe(false);
    expect(freshness.queryClass).toBe("actor");
    expect(freshness.slo.targetFreshnessSeconds).toBe(1_800);
    expect(freshness.cadence.analystPriority).toBe(1);
    expect(freshness.cadence.sourceHintCount).toBe(2);
    expect(freshness.sourceCadenceHints.map((hint) => hint.sourceId)).toEqual(["src_fresh_primary", "src_fresh_backoff"]);
    expect(freshness.sourceCadenceHints[0]).toMatchObject({
      queueAction: "collect_now",
      reliability: 0.94,
      parserHealth: 0.9,
      evidenceYield: 0.2
    });
    expect(freshness.sourceCadenceHints[0]?.freshnessDebtSeconds).toBeGreaterThan(0);
    expect(freshness.sourceCadenceHints[0]?.priorityAgingBoost).toBeGreaterThan(0);
    expect(freshness.sourceCadenceHints[1]).toMatchObject({ queueAction: "hold_backoff", nextEligibleAt: "2026-05-24T11:20:00.000Z" });
    expect(freshness.queuePressureBehavior.preservesThreeSecondPolling).toBe(true);
    expect(freshness.queuePressureBehavior.duplicateRunReuse).toBe("required");
    expect(freshness.queuePressureBehavior.retryAfterSeconds).toBeGreaterThanOrEqual(3);
    expect(freshness.fairnessAging.every((lane) => lane.preservesPerSourceConcurrency && lane.agingBoostEverySeconds > 0)).toBe(true);
    expect(freshness.handoffs.agent09ApiPolling[0]).toContain("3-second polling");
    expect(freshness.routeContracts.contractsField).toBe("surfaces.frontier.contracts.freshness_slo_engine");
  });

  test("builds route-visible freshness SLO dashboard for high-priority actor workload fairness", () => {
    const now = new Date("2026-05-24T11:30:00.000Z");
    const queued = [
      task({ id: "task_dash_actor", sourceId: "src_dash_actor", budgetClass: "interactive_live_search", queuedAt: "2026-05-24T11:24:00.000Z", runId: "run_dash_actor" }),
      task({ id: "task_dash_channel", sourceId: "src_dash_channel", sourceType: "telegram_public", budgetClass: "background_refresh", queuedAt: "2026-05-24T11:20:00.000Z", runId: "run_dash_channel" }),
      task({ id: "task_dash_restricted", sourceId: "src_dash_restricted", sourceType: "tor_metadata", budgetClass: "restricted_darknet_metadata_sweep", queuedAt: "2026-05-24T11:10:00.000Z", runId: "run_dash_restricted", retryCount: 2, maxRetries: 3 })
    ];
    const economics = buildSchedulerQueueEconomics({
      queued,
      deadLetters: [{ taskId: "task_dash_restricted", task: queued[2], reason: "metadata approval hold", status: "retry_exhausted" }],
      workerSlots: 64,
      memoryCeilingMb: 96 * 1024,
      now
    });
    const runtime = buildSchedulerRuntimeExecution({ queued, queueEconomics: economics, pendingActivationBatchCount: 0, now });
    const sla = buildSchedulerRuntimeSla({ queueEconomics: economics, runtimeExecution: runtime, runs: [], now });
    const enforcement = buildSchedulerSlaEnforcement({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, runs: [], now });
    const cutover = buildSchedulerWorkerQueueCutover({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, now });
    const soak = buildSchedulerWorkerSoakMigration({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, now });
    const harness = buildSchedulerWorkerLeaseSoakHarness({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const telemetry = buildSchedulerProductionAdapterTelemetry({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const canary = buildSchedulerCanaryControlPlane({ productionAdapterTelemetry: telemetry, queueEconomics: economics, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const readiness = buildSchedulerDurableBackendReadiness({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, productionAdapterTelemetry: telemetry, canaryControlPlane: canary, now });
    const freshness = buildSchedulerFreshnessSloEngine({ plan: plan({ query: "APT29", entityType: "actor", priority: "urgent", tasks: queued }), queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, durableBackendReadiness: readiness, now });
    const dashboard = buildSchedulerFreshnessSloDashboard({
      queueEconomics: economics,
      runtimeExecution: runtime,
      slaEnforcement: enforcement,
      workerQueueCutover: cutover,
      freshnessSloEngine: freshness,
      workerLeaseSoakHarness: harness,
      now
    });

    expect(dashboard.schemaVersion).toBe("ti.scheduler_freshness_slo_dashboard.v1");
    expect(dashboard.apiTargets).toEqual(expect.arrayContaining(["/v1/frontier/status", "/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/contracts"]));
    expect(dashboard.dryRun).toBe(true);
    expect(dashboard.willMutate).toBe(false);
    expect(dashboard.summary.actorCount).toBe(8);
    expect(dashboard.summary.publicPollingProtected).toBe(true);
    expect(dashboard.actors.map((actor) => actor.actor)).toEqual(expect.arrayContaining(["APT29", "APT42", "Sandworm", "Volt Typhoon", "Lazarus", "LockBit", "Akira", "Scattered Spider"]));
    expect(dashboard.actors.every((actor) => actor.nextPollSeconds === 3 && actor.duplicateRunReuse === "required" && actor.targetFreshnessSeconds > 0)).toBe(true);
    expect(dashboard.actors.find((actor) => actor.actor === "APT29")).toMatchObject({
      priority: "daily",
      queryClass: "actor",
      workerPartition: "interactive_actor_search"
    });
    expect(dashboard.actors.find((actor) => actor.actor === "LockBit")).toMatchObject({
      priority: "weekly",
      queryClass: "ransomware",
      workerPartition: "restricted_metadata_approval"
    });
    expect(dashboard.workloadActions.map((action) => action.workload)).toEqual(expect.arrayContaining(["interactive_actor_search", "public_channel_window", "restricted_metadata_approval"]));
    expect(dashboard.runbook).toMatchObject({
      publicApiBehavior: "return_status_with_three_second_polling",
      duplicateRunReuse: "required_before_enqueue",
      restrictedMetadata: "metadata_only_holds_do_not_block_clear_web"
    });
    expect(dashboard.routeContracts.contractsField).toBe("surfaces.frontier.contracts.scheduler_freshness_slo_dashboard");
    expect(dashboard.releaseGate.proofCommands).toContain("bun run check:contract-index");
  });

  test("builds daily Apify Actor run plan with source-tier cadence economics and stale suppression", () => {
    const now = new Date("2026-06-20T17:10:00.000Z");
    const queued = [
      task({ id: "task_daily_apt29", sourceId: "src_daily_apt29", budgetClass: "interactive_live_search", queuedAt: "2026-06-20T16:50:00.000Z", runId: "run_daily_apt29" }),
      task({ id: "task_daily_source_sweep", sourceId: "src_daily_sweep", budgetClass: "broad_daily_sweep", queuedAt: "2026-06-20T15:45:00.000Z", runId: "run_daily_sweep" }),
      task({ id: "task_daily_dark_metadata", sourceId: "src_daily_dark", sourceType: "tor_metadata", budgetClass: "restricted_darknet_metadata_sweep", queuedAt: "2026-06-20T15:30:00.000Z", retryCount: 1, runId: "run_daily_dark" })
    ];
    const economics = buildSchedulerQueueEconomics({ queued, workerSlots: 64, memoryCeilingMb: 96 * 1024, now });
    const runtime = buildSchedulerRuntimeExecution({ queued, queueEconomics: economics, pendingActivationBatchCount: 0, now });
    const sla = buildSchedulerRuntimeSla({ queueEconomics: economics, runtimeExecution: runtime, runs: [], now });
    const enforcement = buildSchedulerSlaEnforcement({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, runs: [], now });
    const cutover = buildSchedulerWorkerQueueCutover({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, now });
    const soak = buildSchedulerWorkerSoakMigration({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, now });
    const harness = buildSchedulerWorkerLeaseSoakHarness({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const telemetry = buildSchedulerProductionAdapterTelemetry({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const canary = buildSchedulerCanaryControlPlane({ productionAdapterTelemetry: telemetry, queueEconomics: economics, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const readiness = buildSchedulerDurableBackendReadiness({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, productionAdapterTelemetry: telemetry, canaryControlPlane: canary, now });
    const freshness = buildSchedulerFreshnessSloEngine({ plan: plan({ query: "APT29", entityType: "actor", priority: "urgent", tasks: queued }), queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, durableBackendReadiness: readiness, now });
    const dashboard = buildSchedulerFreshnessSloDashboard({ queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, freshnessSloEngine: freshness, workerLeaseSoakHarness: harness, now });
    const daily = buildSchedulerDailyActorRunPlan({
      freshnessSloDashboard: dashboard,
      queueEconomics: economics,
      workerQueueCutover: cutover,
      now
    });

    expect(daily.schemaVersion).toBe("ti.scheduler_daily_actor_run_plan.v1");
    expect(daily.apiTargets).toEqual(expect.arrayContaining(["/v1/frontier/status", "/v1/intel/search.scheduler", "apify_public_threat_actor_monitor"]));
    expect(daily.apifyActor).toMatchObject({
      actorId: "eirikhanasand/public-threat-actor-monitor",
      publishedBuild: "0.6.4",
      defaultQueryCount: 20,
      runCadence: "daily"
    });
    expect(daily.apifyActor.defaultQueries).toEqual(expect.arrayContaining(["APT29", "APT42", "LockBit", "Hunters International"]));
    expect(daily.runTargets).toMatchObject({
      duplicateRunReuseRequired: true,
      nextPollSeconds: 3,
      sourceFamilyDiversityTarget: 4
    });
    expect(daily.watchlist).toHaveLength(20);
    expect(daily.watchlist.find((row) => row.query === "APT29")).toMatchObject({
      priority: "daily_until_fresh",
      schedulerAction: "raise_priority",
      staleSuppression: "drop_stale_only_activity"
    });
    expect(daily.watchlist.find((row) => row.query === "APT42")?.sourceFamilyFocus).toContain("public_channel");
    expect(daily.watchlist.find((row) => row.query === "LockBit")?.sourceFamilyFocus).toContain("approved_dark_metadata");
    expect(daily.sourceTierCadence.map((tier) => tier.tier)).toEqual(["tier_100", "tier_1000", "tier_4000"]);
    expect(daily.sourceTierCadence.find((tier) => tier.tier === "tier_100")).toMatchObject({
      scope: "safe_public_sources",
      cadence: "hourly",
      workClass: "broad_daily_sweep"
    });
    expect(daily.sourceTierCadence.find((tier) => tier.tier === "tier_4000")).toMatchObject({
      scope: "approved_dark_metadata",
      workClass: "restricted_darknet_metadata_sweep"
    });
    expect(daily.economics.estimatedGrossRevenueUsd).toBeGreaterThan(0);
    expect(daily.economics.estimatedCostPerUsefulRowUsd).toBeLessThanOrEqual(daily.runTargets.maxCostPerUsefulRowUsd);
    expect(daily.staleSuppression).toMatchObject({
      staleOnlyRowsExcludedFromReady: true,
      maxStaleRowsPerActor: 1
    });
    expect(daily.staleSuppression.affectedQueries).toEqual(expect.arrayContaining(["APT29", "APT28", "APT42"]));
    expect(daily.routeContracts.contractsField).toBe("surfaces.frontier.contracts.scheduler_daily_actor_run_plan");
    expect(daily.releaseGate.proofCommands).toContain("bun run check:apify-publication");
  });

  test("builds interactive search freshness decisions with run reuse and visible scheduler state", () => {
    const now = new Date("2026-05-24T12:00:00.000Z");
    const queued = [
      task({ id: "task_interactive_actor", sourceId: "src_interactive_actor", budgetClass: "interactive_live_search", queuedAt: "2026-05-24T11:56:00.000Z", runId: "run_interactive_actor" }),
      task({ id: "task_interactive_sweep", sourceId: "src_interactive_sweep", budgetClass: "broad_daily_sweep", queuedAt: "2026-05-24T11:30:00.000Z", runId: "run_interactive_sweep" })
    ];
    const economics = buildSchedulerQueueEconomics({ queued, workerSlots: 64, memoryCeilingMb: 96 * 1024, now });
    const runtime = buildSchedulerRuntimeExecution({ queued, queueEconomics: economics, pendingActivationBatchCount: 0, now });
    const sla = buildSchedulerRuntimeSla({ queueEconomics: economics, runtimeExecution: runtime, runs: [run({ id: "run_interactive_actor", status: "running", requestHash: "tenant:APT29" })], now });
    const enforcement = buildSchedulerSlaEnforcement({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, runs: [], now });
    const cutover = buildSchedulerWorkerQueueCutover({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, now });
    const soak = buildSchedulerWorkerSoakMigration({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, now });
    const telemetry = buildSchedulerProductionAdapterTelemetry({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const canary = buildSchedulerCanaryControlPlane({ productionAdapterTelemetry: telemetry, queueEconomics: economics, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const readiness = buildSchedulerDurableBackendReadiness({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, productionAdapterTelemetry: telemetry, canaryControlPlane: canary, now });
    const searchPlan = plan({ query: "APT29", entityType: "actor", priority: "urgent", tasks: queued });
    const freshness = buildSchedulerFreshnessSloEngine({ plan: searchPlan, queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, durableBackendReadiness: readiness, now });
    const dashboard = buildSchedulerFreshnessSloDashboard({ queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, freshnessSloEngine: freshness, now });
    const productionLeaseSemantics = buildSchedulerProductionLeaseSemantics({ queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, durableBackendReadiness: readiness, freshnessSloEngine: freshness, now });
    const fairness = buildSchedulerFairnessGovernance({ plan: searchPlan, queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, durableBackendReadiness: readiness, freshnessSloEngine: freshness, productionLeaseSemantics, now });
    const interactive = buildSchedulerInteractiveSearchFreshness({
      plan: searchPlan,
      run: run({ id: "run_interactive_actor", status: "running", requestHash: "tenant:APT29" }),
      attachedToActiveRun: true,
      freshnessSloEngine: freshness,
      freshnessSloDashboard: dashboard,
      queueEconomics: economics,
      workerQueueCutover: cutover,
      fairnessGovernance: fairness,
      now
    });

    expect(interactive.schemaVersion).toBe("ti.scheduler_interactive_search_freshness.v1");
    expect(interactive.apiTargets).toEqual(expect.arrayContaining(["/v1/frontier/status", "/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/contracts"]));
    expect(interactive.currentQuery).toMatchObject({ query: "APT29", knownHighValueActor: true, priorityBand: "urgent_actor" });
    expect(interactive.queueDecision).toMatchObject({
      decision: "reuse_active_run",
      nextPollSeconds: 3,
      duplicateRunReuse: "required_before_enqueue",
      attachedToActiveRun: true,
      runId: "run_interactive_actor"
    });
    expect(interactive.queueDecision.deferredBackgroundWorkloads).toContain("scheduled_source_sweep");
    expect(interactive.actorTargets[0]).toMatchObject({ actor: "APT29" });
    expect(interactive.fairnessGuards).toMatchObject({
      preservesThreeSecondPolling: true,
      preservesDuplicateRunReuse: true,
      lowValueSweepsDeferredBeforeActorStarvation: true
    });
    expect(interactive.uiSignals.badges).toEqual(expect.arrayContaining(["source_freshness", "active_run_reuse", "background_deferred"]));
    expect(interactive.routeContracts.contractsField).toBe("surfaces.frontier.contracts.scheduler_interactive_search_freshness");
  });

  test("defines Postgres-first production queue cutover and lease semantics without mutating leases", () => {
    const now = new Date("2026-05-24T12:00:00.000Z");
    const queued = [
      task({ id: "task_lease_actor", sourceId: "src_lease_actor", budgetClass: "interactive_live_search", queuedAt: "2026-05-24T11:55:00.000Z", runId: "run_lease_actor" }),
      task({ id: "task_lease_sweep", sourceId: "src_lease_sweep", budgetClass: "broad_daily_sweep", queuedAt: "2026-05-24T11:40:00.000Z", runId: "run_lease_sweep" }),
      task({ id: "task_lease_retry", sourceId: "src_lease_retry", budgetClass: "background_refresh", queuedAt: "2026-05-24T11:30:00.000Z", runId: "run_lease_retry", retryCount: 1 })
    ];
    const sources = [
      source({ id: "src_lease_actor", trustScore: 0.9, crawlFrequencySeconds: 1_800 }),
      source({ id: "src_lease_sweep", trustScore: 0.7, crawlFrequencySeconds: 7_200 }),
      source({ id: "src_lease_retry", trustScore: 0.6, crawlFrequencySeconds: 3_600 })
    ];
    const economics = buildSchedulerQueueEconomics({ queued, workerSlots: 64, memoryCeilingMb: 96 * 1024, now });
    const runtime = buildSchedulerRuntimeExecution({ queued, queueEconomics: economics, pendingActivationBatchCount: 0, now });
    const sla = buildSchedulerRuntimeSla({ queueEconomics: economics, runtimeExecution: runtime, runs: [run({ id: "run_lease_actor", status: "running", requestHash: "tenant:APT29" })], now });
    const enforcement = buildSchedulerSlaEnforcement({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, runs: [], now });
    const cutover = buildSchedulerWorkerQueueCutover({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, now });
    const soak = buildSchedulerWorkerSoakMigration({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, now });
    const telemetry = buildSchedulerProductionAdapterTelemetry({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const canary = buildSchedulerCanaryControlPlane({ productionAdapterTelemetry: telemetry, queueEconomics: economics, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const readiness = buildSchedulerDurableBackendReadiness({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, productionAdapterTelemetry: telemetry, canaryControlPlane: canary, now });
    const freshness = buildSchedulerFreshnessSloEngine({ plan: plan({ query: "APT29", entityType: "actor", tasks: queued }), sources, queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, durableBackendReadiness: readiness, now });
    const semantics = buildSchedulerProductionLeaseSemantics({
      queueEconomics: economics,
      runtimeExecution: runtime,
      slaEnforcement: enforcement,
      workerQueueCutover: cutover,
      durableBackendReadiness: readiness,
      freshnessSloEngine: freshness,
      now
    });

    expect(semantics.apiTargets).toEqual(expect.arrayContaining(["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/contracts"]));
    expect(semantics.dryRun).toBe(true);
    expect(semantics.willMutate).toBe(false);
    expect(semantics.currentBackend).toBe("embedded_memory");
    expect(semantics.primaryTargetBackend).toBe("postgres_advisory_queue");
    expect(semantics.futureBackends).toEqual(["redis_streams", "nats_jetstream"]);
    expect(semantics.postgresContract.tables).toEqual(expect.arrayContaining(["frontier_tasks", "frontier_leases", "frontier_events", "crawl_budgets", "run_reuse_keys", "frontier_dead_letters"]));
    expect(semantics.postgresContract.lease).toContain("FOR UPDATE SKIP LOCKED");
    expect(semantics.postgresContract.duplicateRunReuse).toContain("active run");
    expect(semantics.leaseLifecycle.map((step) => step.step)).toEqual(["enqueue", "lease", "heartbeat", "checkpoint", "ack", "retry", "dead_letter", "expire", "drain", "shutdown"]);
    expect(semantics.leaseLifecycle.every((step) => step.cursorVisible && step.idempotencyKey.length > 0)).toBe(true);
    expect(semantics.cutoverPhases.map((phase) => phase.phase)).toEqual(["shadow_mirror", "dual_write_audit", "postgres_lease_canary", "worker_drain", "cutover", "rollback"]);
    expect(semantics.cutoverPhases.every((phase) => phase.dryRun && phase.willMutate === false && phase.willLeaseTasks === false)).toBe(true);
    expect(semantics.fairness.tenantIsolation).toBe("tenant_then_reuse_key_then_source_family");
    expect(semantics.fairness.priorityAging.length).toBeGreaterThan(0);
    expect(semantics.safety).toMatchObject({
      preservesThreeSecondPolling: true,
      duplicateActorQueryRunsSuppressed: true,
      cursorContinuity: "preserved",
      dryRunApplyPlanOnly: true,
      restrictedMetadataRemainsApprovalGated: true
    });
    expect(["pass", "hold", "rollback"]).toContain(semantics.releaseGate.decision);
    expect(semantics.releaseGate.proofCommands).toContain("bun run check:frontier-apply-plan");
    expect(semantics.routeContracts.contractsField).toBe("surfaces.frontier.contracts.production_queue_lease_semantics");
  });

  test("governs multi-tenant query-class budgets and fairness without mutating queues", () => {
    const now = new Date("2026-05-24T12:30:00.000Z");
    const queued = [
      task({ id: "task_budget_actor_a", tenantId: "tenant_alpha", sourceId: "src_budget_actor", budgetClass: "interactive_live_search", queuedAt: "2026-05-24T12:26:00.000Z", runId: "run_budget_actor" }),
      task({ id: "task_budget_actor_b", tenantId: "tenant_beta", sourceId: "src_budget_actor", budgetClass: "interactive_live_search", queuedAt: "2026-05-24T12:27:00.000Z", runId: "run_budget_actor_beta" }),
      task({ id: "task_budget_sweep", tenantId: "tenant_alpha", sourceId: "src_budget_sweep", budgetClass: "broad_daily_sweep", queuedAt: "2026-05-24T11:30:00.000Z", fairnessKey: "public-channel:noisy-source" }),
      task({ id: "task_budget_replay", tenantId: "tenant_alpha", sourceId: "src_budget_replay", budgetClass: "background_refresh", queuedAt: "2026-05-24T11:20:00.000Z", retryCount: 1, fairnessKey: "evidence:replay" })
    ];
    const economics = buildSchedulerQueueEconomics({ queued, workerSlots: 48, memoryCeilingMb: 96 * 1024, now });
    const runtime = buildSchedulerRuntimeExecution({ queued, queueEconomics: economics, pendingActivationBatchCount: 1, now });
    const sla = buildSchedulerRuntimeSla({ queueEconomics: economics, runtimeExecution: runtime, runs: [], now });
    const enforcement = buildSchedulerSlaEnforcement({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, runs: [], now });
    const cutover = buildSchedulerWorkerQueueCutover({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, now });
    const soak = buildSchedulerWorkerSoakMigration({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, now });
    const telemetry = buildSchedulerProductionAdapterTelemetry({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const canary = buildSchedulerCanaryControlPlane({ productionAdapterTelemetry: telemetry, queueEconomics: economics, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const readiness = buildSchedulerDurableBackendReadiness({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, productionAdapterTelemetry: telemetry, canaryControlPlane: canary, now });
    const freshness = buildSchedulerFreshnessSloEngine({ plan: plan({ query: "APT29", entityType: "actor", tasks: queued }), queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, durableBackendReadiness: readiness, now });
    const semantics = buildSchedulerProductionLeaseSemantics({ queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, durableBackendReadiness: readiness, freshnessSloEngine: freshness, now });
    const governance = buildSchedulerFairnessGovernance({
      plan: plan({ query: "APT29", entityType: "actor", tasks: queued }),
      queueEconomics: economics,
      runtimeExecution: runtime,
      slaEnforcement: enforcement,
      workerQueueCutover: cutover,
      durableBackendReadiness: readiness,
      freshnessSloEngine: freshness,
      productionLeaseSemantics: semantics,
      now
    });

    expect(governance.apiTargets).toEqual(expect.arrayContaining(["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/runs/{id}", "/v1/contracts"]));
    expect(governance.dryRun).toBe(true);
    expect(governance.willMutate).toBe(false);
    expect(governance.tenants.defaultTenantId).toBe("tenant_test");
    expect(governance.tenants.isolationKey).toBe("tenant:queryClass:reuseKey:sourceFamily");
    expect(governance.queryClassBudgets.map((lane) => lane.queryClass)).toEqual(expect.arrayContaining(["actor", "ransomware", "cve_advisory", "campaign", "malware_tool", "sector", "country", "victim_company", "infrastructure", "unknown"]));
    expect(governance.queryClassBudgets.map((lane) => lane.tenantId)).toEqual(expect.arrayContaining(["tenant_alpha", "tenant_beta", "tenant_test"]));
    expect(governance.queryClassBudgets.every((lane) => lane.reservedWorkerSlots > 0 && lane.maxConcurrentLeases > 0 && lane.maxQueueAgeSeconds > 0 && lane.retryAfterSeconds >= 3)).toBe(true);
    expect(governance.queryClassBudgets.find((lane) => lane.queryClass === "actor")?.actions).toEqual(expect.arrayContaining(["preserve_live_polling", "reuse_duplicate_run", "reserve_interactive_capacity", "age_priority"]));
    expect(governance.workloadFairness.map((lane) => lane.workload)).toEqual(expect.arrayContaining(["interactive_actor_search", "scheduled_source_sweep", "public_channel_window", "restricted_metadata_approval", "evidence_replay"]));
    expect(governance.workloadFairness.every((lane) => lane.preservesThreeSecondPolling && lane.maxConcurrentLeases >= lane.reservedWorkerSlots)).toBe(true);
    expect(governance.priorityAging.every((lane) => lane.neverBypassPerSourceConcurrency && lane.agingBoostEverySeconds > 0)).toBe(true);
    expect(governance.pressurePolicy).toMatchObject({
      publicPolling: "always_return_status_with_three_second_hint",
      duplicateRunReuse: "required_before_enqueue",
      lowValueSweeps: "bounded_and_deferred_before_interactive_starvation"
    });
    expect(governance.fairnessSlo.retryAfterSeconds).toBeGreaterThanOrEqual(3);
    expect(governance.handoffs.agent09ApiContracts[0]).toContain("retry-after");
    expect(["pass", "hold", "rollback"]).toContain(governance.releaseGate.decision);
    expect(governance.releaseGate.proofCommands).toContain("bun run check");
    expect(governance.routeContracts.contractsField).toBe("surfaces.frontier.contracts.multi_tenant_fairness_governance");
  });

  test("defines scheduler persistence and restart replay cutover without live dependencies", () => {
    const now = new Date("2026-05-24T13:00:00.000Z");
    const queued = [
      task({ id: "task_replay_actor", tenantId: "tenant_replay", sourceId: "src_replay_actor", budgetClass: "interactive_live_search", queuedAt: "2026-05-24T12:58:00.000Z", runId: "run_replay_actor" }),
      task({ id: "task_replay_leased", tenantId: "tenant_replay", sourceId: "src_replay_leased", budgetClass: "interactive_live_search", queuedAt: "2026-05-24T12:50:00.000Z", runId: "run_replay_actor", retryCount: 1 }),
      task({ id: "task_replay_metadata", tenantId: "tenant_replay", sourceId: "src_replay_metadata", sourceType: "tor_metadata", budgetClass: "restricted_darknet_metadata_sweep", queuedAt: "2026-05-24T12:40:00.000Z", runId: "run_replay_metadata" }),
      task({ id: "task_replay_dead", tenantId: "tenant_replay", sourceId: "src_replay_dead", budgetClass: "background_refresh", queuedAt: "2026-05-24T12:30:00.000Z", retryCount: 3, maxRetries: 3, runId: "run_replay_dead" })
    ];
    const economics = buildSchedulerQueueEconomics({ queued, deadLetters: [{ status: "retry_exhausted", taskId: "task_replay_dead", task: queued[3], reason: "retry budget exhausted" }], workerSlots: 48, memoryCeilingMb: 96 * 1024, now });
    const runtime = buildSchedulerRuntimeExecution({ queued, queueEconomics: economics, pendingActivationBatchCount: 0, now });
    const sla = buildSchedulerRuntimeSla({ queueEconomics: economics, runtimeExecution: runtime, runs: [run({ id: "run_replay_actor", status: "running", requestHash: "tenant_replay:apt29" })], now });
    const enforcement = buildSchedulerSlaEnforcement({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, runs: [], now });
    const cutover = buildSchedulerWorkerQueueCutover({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, now });
    const soak = buildSchedulerWorkerSoakMigration({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, now });
    const telemetry = buildSchedulerProductionAdapterTelemetry({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const canary = buildSchedulerCanaryControlPlane({ productionAdapterTelemetry: telemetry, queueEconomics: economics, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const readiness = buildSchedulerDurableBackendReadiness({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, productionAdapterTelemetry: telemetry, canaryControlPlane: canary, now });
    const replayPlan = plan({ query: "APT29", entityType: "actor", tasks: queued });
    const freshness = buildSchedulerFreshnessSloEngine({ plan: replayPlan, queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, durableBackendReadiness: readiness, now });
    const semantics = buildSchedulerProductionLeaseSemantics({ queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, durableBackendReadiness: readiness, freshnessSloEngine: freshness, now });
    const governance = buildSchedulerFairnessGovernance({ plan: replayPlan, queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, durableBackendReadiness: readiness, freshnessSloEngine: freshness, productionLeaseSemantics: semantics, now });
    const persistence = buildSchedulerPersistenceReplayCutover({
      plan: replayPlan,
      runs: [run({ id: "run_replay_actor", status: "running", requestHash: "tenant_replay:apt29" })],
      queueEconomics: economics,
      runtimeExecution: runtime,
      slaEnforcement: enforcement,
      productionLeaseSemantics: semantics,
      fairnessGovernance: governance,
      now
    });

    expect(persistence.apiTargets).toEqual(expect.arrayContaining(["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/runs/{id}", "/v1/contracts"]));
    expect(persistence.dryRun).toBe(true);
    expect(persistence.willMutate).toBe(false);
    expect(persistence.currentBackend).toBe("embedded_memory");
    expect(persistence.primaryTargetBackend).toBe("postgres_scheduler_store");
    expect(persistence.descriptorBackends).toEqual(["redis_streams", "nats_jetstream"]);
    expect(persistence.postgresContracts.map((contract) => contract.table)).toEqual(expect.arrayContaining([
      "scheduler_runs",
      "frontier_tasks",
      "frontier_leases",
      "worker_heartbeats",
      "scheduler_checkpoints",
      "scheduler_cursor_events",
      "scheduler_retry_dead_letters",
      "scheduler_fairness_budget_snapshots",
      "scheduler_worker_drain_state"
    ]));
    expect(persistence.postgresContracts.every((contract) => contract.keyFields.length > 0 && contract.replayRole.length > 0)).toBe(true);
    expect(persistence.replaySemantics).toMatchObject({
      duplicatePublicActorSearch: "tenant_query_reuse_key_reattaches_to_active_run",
      refreshAfterSeconds: 3,
      pollCursor: "restored_from_scheduler_cursor_events",
      deltaCursor: "restored_from_latest_safe_delta",
      unknownActorPolicy: "searching_only_until_query_matched_evidence",
      noDefaultActorFallback: true,
      noStaleCacheReady: true,
      noGenericLivePromotion: true
    });
    expect(persistence.restartFixtures.map((fixture) => fixture.name)).toEqual([
      "queued_actor_search_restart",
      "leased_heartbeat_expiry",
      "restricted_metadata_hold",
      "dead_letter_retry_replay",
      "duplicate_public_run_reuse",
      "worker_drain_restart",
      "emergency_brake_restart"
    ]);
    expect(persistence.restartFixtures.every((fixture) => fixture.dryRun && fixture.willMutate === false && fixture.preservesThreeSecondPolling && fixture.preservesCursorContinuity && fixture.duplicateRunReuseRequired)).toBe(true);
    expect(persistence.cutoverPhases.map((phase) => phase.phase)).toEqual(["snapshot_embedded", "shadow_write_postgres", "restart_replay_rehearsal", "duplicate_reuse_canary", "worker_drain_replay", "cutover_hold_or_promote", "rollback"]);
    expect(persistence.cutoverPhases.every((phase) => phase.dryRun && phase.willMutate === false && phase.requiredChecks.length > 0)).toBe(true);
    expect(persistence.handoffs.agent09PublicApiFields).toEqual(expect.arrayContaining(["refreshAfterSeconds=3", "pollCursor", "deltaCursor", "duplicateRunReuse"]));
    expect(persistence.handoffs.agent10CapacityReleaseGate).toContain("restart replay fixture pass");
    expect(["pass", "hold", "rollback"]).toContain(persistence.releaseGate.decision);
    expect(persistence.releaseGate.proofCommands).toContain("bun run check:api-regression");
    expect(persistence.routeContracts.contractsField).toBe("surfaces.frontier.contracts.scheduler_persistence_replay_cutover");
  });

  test("keeps the Postgres scheduler queue adapter disabled and fail-closed until explicitly promoted", () => {
    const now = new Date("2026-05-24T14:00:00.000Z");
    const queued = [
      task({ id: "task_pg_actor", tenantId: "tenant_pg", sourceId: "src_pg_actor", budgetClass: "interactive_live_search", queuedAt: "2026-05-24T13:58:00.000Z", runId: "run_pg_actor" })
    ];
    const economics = buildSchedulerQueueEconomics({ queued, workerSlots: 48, memoryCeilingMb: 96 * 1024, now });
    const runtime = buildSchedulerRuntimeExecution({ queued, queueEconomics: economics, pendingActivationBatchCount: 0, now });
    const sla = buildSchedulerRuntimeSla({ queueEconomics: economics, runtimeExecution: runtime, runs: [run({ id: "run_pg_actor", status: "running", requestHash: "tenant_pg:apt29" })], now });
    const enforcement = buildSchedulerSlaEnforcement({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, runs: [], now });
    const cutover = buildSchedulerWorkerQueueCutover({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, now });
    const soak = buildSchedulerWorkerSoakMigration({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, now });
    const telemetry = buildSchedulerProductionAdapterTelemetry({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const canary = buildSchedulerCanaryControlPlane({ productionAdapterTelemetry: telemetry, queueEconomics: economics, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, now });
    const readiness = buildSchedulerDurableBackendReadiness({ queueEconomics: economics, runtimeExecution: runtime, runtimeSla: sla, slaEnforcement: enforcement, workerQueueCutover: cutover, workerSoakMigration: soak, productionAdapterTelemetry: telemetry, canaryControlPlane: canary, now });
    const replayPlan = plan({ query: "APT29", entityType: "actor", tasks: queued });
    const freshness = buildSchedulerFreshnessSloEngine({ plan: replayPlan, queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, durableBackendReadiness: readiness, now });
    const semantics = buildSchedulerProductionLeaseSemantics({ queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, durableBackendReadiness: readiness, freshnessSloEngine: freshness, now });
    const governance = buildSchedulerFairnessGovernance({ plan: replayPlan, queueEconomics: economics, runtimeExecution: runtime, slaEnforcement: enforcement, workerQueueCutover: cutover, durableBackendReadiness: readiness, freshnessSloEngine: freshness, productionLeaseSemantics: semantics, now });
    const persistence = buildSchedulerPersistenceReplayCutover({
      plan: replayPlan,
      runs: [run({ id: "run_pg_actor", status: "running", requestHash: "tenant_pg:apt29" })],
      queueEconomics: economics,
      runtimeExecution: runtime,
      slaEnforcement: enforcement,
      productionLeaseSemantics: semantics,
      fairnessGovernance: governance,
      now
    });
    const adapter = buildSchedulerPostgresQueueAdapterReadiness({
      config: {
        queueBackend: "postgres_scheduler_store",
        postgresQueueEnabled: false,
        postgresDsnConfigured: false,
        postgresShadowWritesEnabled: false,
        postgresLeaseMode: "disabled"
      },
      persistenceReplayCutover: persistence,
      now
    });
    const shadow = buildSchedulerPostgresQueueAdapterReadiness({
      config: {
        queueBackend: "postgres_scheduler_store",
        postgresQueueEnabled: true,
        postgresDsnConfigured: true,
        postgresShadowWritesEnabled: true,
        postgresLeaseMode: "shadow"
      },
      persistenceReplayCutover: persistence,
      now
    });

    expect(adapter.backendSelection.requestedBackend).toBe("postgres_scheduler_store");
    expect(adapter.backendSelection.activeBackend).toBe("embedded_memory");
    expect(adapter.backendSelection.effectiveLeaseOwner).toBe("embedded_memory");
    expect(adapter.backendSelection.postgresEnabled).toBe(false);
    expect(adapter.safety).toMatchObject({
      disabledByDefault: true,
      failClosedWithoutDsn: true,
      failClosedWithoutExecutor: true,
      noImplicitNetworkDependency: true,
      embeddedMemoryRemainsAuthoritative: true,
      publicSearchPollingProtected: true
    });
    expect(adapter.operationContracts.map((contract) => contract.operation)).toEqual(expect.arrayContaining(["enqueueTasks", "leaseNext", "heartbeatLease", "checkpointTask", "acknowledge", "findOrRegisterRun", "deltasSince"]));
    expect(adapter.operationContracts.find((contract) => contract.operation === "leaseNext")?.postgresTableContracts).toEqual(expect.arrayContaining(["frontier_tasks", "frontier_leases", "worker_heartbeats"]));
    expect(adapter.operationContracts.find((contract) => contract.operation === "leaseNext")?.disabledBehavior).toBe("throws_fail_closed");
    expect(adapter.preparedStatements.map((statement) => statement.name)).toEqual(expect.arrayContaining(["scheduler_runs_upsert_reuse_key_v1", "frontier_tasks_lease_fair_next_v1", "scheduler_worker_drain_restore_v1"]));
    expect(adapter.releaseGate.reasons).toContain("postgres_queue_feature_flag_disabled");
    expect(adapter.routeContracts.contractsField).toBe("surfaces.frontier.contracts.scheduler_postgres_queue_adapter");
    expect(shadow.backendSelection.activeBackend).toBe("embedded_memory");
    expect(shadow.backendSelection.leaseMode).toBe("shadow");
    expect(shadow.releaseGate.reasons).toContain("postgres_shadow_writes_do_not_own_leases");
    expect(createSchedulerQueueRepository({ backend: "postgres_scheduler_store", postgresEnabled: false })).toBeInstanceOf(InMemorySchedulerQueueRepository);
    expect(() => new PostgresSchedulerQueueRepository({ enabled: false, dsnConfigured: false }).leaseNext("worker_pg", now)).toThrow(/fail-closed/);
  });

  test("simulates 24h scheduler execution and emits backpressure SLO packets", () => {
    const normal = simulateSchedulerExecution({
      generatedAt: "2026-05-24T05:30:00.000Z",
      durationHours: 24,
      workerSlots: 128,
      traffic: {
        actorQueriesPerHour: 40,
        repeatedPollsPerHour: 180,
        backgroundSweepsPerHour: 8,
        publicChannelWindowsPerHour: 20,
        restrictedMetadataApprovalsPerHour: 4,
        evidenceReplayJobsPerHour: 10,
        graphExportJobsPerHour: 2,
        retentionJobsPerHour: 3
      }
    });
    expect(normal.backpressure.state).toBe("accepted");
    expect(normal.slo.queueAge.ok).toBe(true);
    expect(normal.slo.pollFreshness.ok).toBe(true);
    expect(schedulerSoakBackpressurePacket(normal).soakDecision).toBe("pass");

    const noisyPublicTraffic = simulateSchedulerExecution({
      generatedAt: "2026-05-24T05:30:00.000Z",
      durationHours: 24,
      workerSlots: 32,
      traffic: {
        actorQueriesPerHour: 80,
        repeatedPollsPerHour: 8_000,
        backgroundSweepsPerHour: 80,
        publicChannelWindowsPerHour: 3_500,
        restrictedMetadataApprovalsPerHour: 12,
        evidenceReplayJobsPerHour: 25,
        graphExportJobsPerHour: 12,
        retentionJobsPerHour: 20,
        providerOutage: true,
        inactiveClientRatio: 0.35
      }
    });
    expect(noisyPublicTraffic.backpressure.state).toBe("deferred_by_queue_pressure");
    expect(noisyPublicTraffic.backpressure.reasons).toContain("provider_outage");
    expect(noisyPublicTraffic.backpressure.reasons).toContain("per_source_fairness_slo_breached");
    expect(noisyPublicTraffic.slo.retryExhaustion.exhaustedTasks).toBeGreaterThan(0);
    expect(["hold", "rollback"]).toContain(schedulerSoakBackpressurePacket(noisyPublicTraffic).soakDecision);

    const restrictedDisabled = simulateSchedulerExecution({
      generatedAt: "2026-05-24T05:30:00.000Z",
      durationHours: 24,
      workerSlots: 96,
      traffic: {
        actorQueriesPerHour: 20,
        repeatedPollsPerHour: 100,
        backgroundSweepsPerHour: 4,
        publicChannelWindowsPerHour: 40,
        restrictedMetadataApprovalsPerHour: 30,
        evidenceReplayJobsPerHour: 4,
        graphExportJobsPerHour: 1,
        retentionJobsPerHour: 2,
        restrictedSourcesDisabled: true
      }
    });
    expect(restrictedDisabled.backpressure.state).toBe("blocked_by_policy");
    expect(restrictedDisabled.backpressure.agent09Compatibility.publicStatus).toBe("blocked");

    const recovery = simulateSchedulerExecution({
      generatedAt: "2026-05-24T05:30:00.000Z",
      durationHours: 24,
      workerSlots: 64,
      traffic: {
        actorQueriesPerHour: 70,
        repeatedPollsPerHour: 3_000,
        backgroundSweepsPerHour: 35,
        publicChannelWindowsPerHour: 900,
        restrictedMetadataApprovalsPerHour: 10,
        evidenceReplayJobsPerHour: 15,
        graphExportJobsPerHour: 6,
        retentionJobsPerHour: 10,
        emergencyBrakeRecoveryAtHour: 8
      }
    });
    expect(recovery.backpressure.recommendedAction).toBe("recover");
    expect(recovery.backpressure.emergencyBrakeState).toBe("armed");
  });

  test("builds API-ready backpressure summaries from queued tasks for Agent 09 and Agent 10", () => {
    const now = new Date("2026-05-24T06:00:00.000Z");
    const hotTasks = Array.from({ length: 12 }, (_, index) => task({
      id: `task_hot_${index}`,
      sourceId: "src_public_hot",
      queuedAt: "2026-05-24T05:40:00.000Z",
      budgetClass: index < 2 ? "interactive_live_search" : "broad_daily_sweep",
      retryCount: index % 3 === 0 ? 1 : 0
    }));
    const summary = schedulerBackpressureSummaryForTasks({
      queued: hotTasks,
      deadLetters: [{ status: "retry_exhausted", taskId: "task_dead", task: hotTasks[0]!, reason: "provider outage" }],
      now
    });
    expect(summary.state).toBe("deferred_by_queue_pressure");
    expect(summary.reasons).toContain("queue_age_slo_breached");
    expect(summary.reasons).toContain("per_source_fairness_slo_breached");
    expect(summary.agent09Compatibility.fields).toContain("slo.pollFreshness.p95Seconds");
    expect(summary.agent10SoakPacket.promotionGateFields).toContain("workerMemoryPressure");
  });

  test("repository reuses duplicate actor runs and reports abandoned polling and stale active runs", () => {
    const now = new Date("2026-01-01T01:00:00.000Z");
    const repo = new InMemorySchedulerQueueRepository();
    const first = repo.findOrRegisterRun(run({
      id: "run_actor",
      tenantId: "tenant_actor",
      requestId: "request_actor",
      requestHash: "live-reuse-apt29",
      status: "running",
      updatedAt: "2026-01-01T00:55:00.000Z"
    }), "live-reuse-apt29", now);
    const duplicate = repo.findOrRegisterRun(run({
      id: "run_actor_duplicate",
      tenantId: "tenant_actor",
      requestId: "request_actor_duplicate",
      requestHash: "live-reuse-apt29",
      status: "queued",
      updatedAt: "2026-01-01T00:59:00.000Z"
    }), "live-reuse-apt29", now);
    repo.findOrRegisterRun(run({
      id: "run_stale",
      tenantId: "tenant_actor",
      requestId: "request_stale",
      status: "running",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }), undefined, now);
    repo.findOrRegisterRun(run({
      id: "run_abandoned",
      tenantId: "tenant_actor",
      requestId: "request_abandoned",
      status: "queued",
      updatedAt: "2026-01-01T00:40:00.000Z"
    }), undefined, now);

    expect(first.reused).toBe(false);
    expect(duplicate.reused).toBe(true);
    expect(duplicate.run.id).toBe("run_actor");
    expect(duplicate.duplicateReuseCount).toBe(1);
    const gc = repo.gcActiveRuns(now, { activePollingRunIds: new Set(["run_actor"]) });
    expect(gc.find((decision) => decision.runId === "run_stale")?.action).toBe("mark_stale_failed");
    expect(gc.find((decision) => decision.runId === "run_abandoned")?.action).toBe("mark_abandoned_cancelled");

    const queuedTask = task({ id: "task_cancelled", sourceId: "src_cancelled", runId: "run_abandoned", budgetClass: "interactive_live_search" });
    repo.enqueueTasks([queuedTask], now);
    const cancelled = repo.cancelRun("run_abandoned", now, "polling client cancelled run");
    expect(cancelled.map((delta) => delta.kind)).toEqual(["run_cancelled", "task_cancelled"]);
    expect(repo.runs().find((candidate) => candidate.id === "run_abandoned")?.status).toBe("cancelled");
  });

  test("soak scenarios cover public polling restricted approval retention replay and worker memory ceilings", () => {
    const scenarios = schedulerSoakScenarios();
    expect(scenarios.map((scenario) => scenario.name)).toEqual([
      "interactive_actor_search",
      "public_channel_polling",
      "darknet_metadata_approval_queue",
      "retention_replay_and_analyst_deep_dives"
    ]);
    expect(scenarios[2]?.darknetApprovalQueue).toBeGreaterThan(scenarios[0]?.darknetApprovalQueue ?? 0);
    expect(scenarios[3]?.retentionReplayJobs).toBeGreaterThan(0);
    expect(scenarios[3]?.analystDeepDives).toBeGreaterThan(0);

    const accepted = evaluateSchedulerSoakScenario(scenarios[3] ?? scenarios[0]!);
    expect(accepted.accepted).toBe(true);
    expect(accepted.expectedQueuePressure).toBe("deferred_by_queue_pressure");

    const rejected = evaluateSchedulerSoakScenario({
      ...(scenarios[3] ?? scenarios[0]!),
      maxMemoryMb: 200 * 1024,
      maxWorkerPoolSlots: 300,
      retentionReplayJobs: 1_000
    }, { maxBackgroundSweepQueue: 10_000 });
    expect(rejected.accepted).toBe(false);
    expect(rejected.reasons).toContain("memory_ceiling");
    expect(rejected.reasons).toContain("worker_pool_ceiling");
    expect(rejected.reasons).toContain("background_sweep_queue_ceiling");
  });

  test("interactive leases progress before sweeps while sweeps remain bounded by pressure DTOs", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const repo = new InMemorySchedulerQueueRepository();
    const frontier = new FocusedFrontier({ now: () => now, defaultPerSourceConcurrency: 100 });
    for (let index = 0; index < 20; index += 1) {
      addWork(frontier, {
        id: `sweep_${index}`,
        budgetClass: "broad_daily_sweep",
        selectedFor: "background",
        queuedAt: now.toISOString(),
        fairnessKey: "background:sweep"
      });
    }
    addWork(frontier, {
      id: "live_priority",
      budgetClass: "interactive_live_search",
      selectedFor: "interactive",
      queuedAt: now.toISOString(),
      tenantId: "tenant_live"
    });
    repo.enqueueTasks(frontier.snapshot().map((item) => item.task), now);

    const first = repo.leaseNext("worker_1", now);
    expect(first?.task.planning?.budgetClass).toBe("interactive_live_search");
    const pressure = repo.pressure(now);
    expect(pressure.find((item) => item.workClass === "broad_daily_sweep")?.selectedTaskCount).toBe(20);
    expect(pressure.find((item) => item.workClass === "broad_daily_sweep")?.pressureState).toBe("accepted");
  });

  test("reconciles registry activation leases backoff dead letters and run reuse with stable reason codes", () => {
    const now = new Date("2026-01-01T01:00:00.000Z");
    const sources = [
      source({ id: "active_scheduled", status: "active" }),
      source({ id: "approved_idle", status: "approved", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "analyst_1" }),
      source({ id: "needs_approval", status: "needs_review" }),
      source({ id: "failing", status: "active", health: { status: "failing", consecutiveFailures: 6, errorRate: 1 } }),
      source({ id: "disabled", status: "disabled", accessMethod: "disabled" }),
      source({
        id: "expired",
        status: "active",
        governance: {
          approvalState: "approved",
          approvalRequired: true,
          metadataOnly: false,
          approvedAt: "2025-01-01T00:00:00.000Z",
          approvedBy: "analyst_1",
          approvalExpiresAt: "2025-12-31T00:00:00.000Z"
        }
      }),
      source({ id: "no_legal", status: "active", legalNotes: "" }),
      source({ id: "dup_a", status: "active", tenantId: "tenant_dup", url: "https://dup.example.test/feed" }),
      source({ id: "dup_b", status: "active", tenantId: "tenant_dup", url: "https://dup.example.test/feed" })
    ];
    const queued = [
      task({ id: "task_active", sourceId: "active_scheduled", runId: "run_reuse" }),
      task({ id: "task_backoff", sourceId: "active_scheduled", availableAt: "2026-01-01T01:05:00.000Z" }),
      task({ id: "task_sweep", sourceId: "active_scheduled", budgetClass: "broad_daily_sweep" })
    ];
    const leased = [task({ id: "task_leased", sourceId: "active_scheduled", attemptDeadlineAt: "2026-01-01T00:50:00.000Z" })];
    const report = buildSchedulerReconciliation({
      sources,
      queued,
      leased,
      deadLetters: [{ status: "retry_exhausted", taskId: "task_dead", task: task({ id: "task_dead", sourceId: "failing" }), reason: "retry budget exhausted" }],
      runs: [
        run({ id: "run_reuse", requestHash: "live-reuse-apt29", status: "running", updatedAt: "2026-01-01T00:55:00.000Z" }),
        run({ id: "run_stale", status: "running", updatedAt: "2026-01-01T00:00:00.000Z" }),
        run({ id: "run_abandoned", status: "queued", updatedAt: "2026-01-01T00:40:00.000Z" })
      ],
      now,
      queuePressureThreshold: 3
    });

    expect(report.reasonCounts.active_source_scheduled).toBeGreaterThan(0);
    expect(report.reasonCounts.approved_not_scheduled).toBe(1);
    expect(report.reasonCounts.missing_approved_source).toBe(1);
    expect(report.reasonCounts.unhealthy_active_source).toBe(1);
    expect(report.reasonCounts.policy_disabled_source).toBe(1);
    expect(report.reasonCounts.expired_approval).toBe(1);
    expect(report.reasonCounts.stale_legal_notes).toBe(1);
    expect(report.reasonCounts.duplicate_source).toBe(1);
    expect(report.reasonCounts.retry_backoff).toBe(1);
    expect(report.reasonCounts.dead_letter).toBe(1);
    expect(report.reasonCounts.active_run_reused).toBe(1);
    expect(report.reasonCounts.stale_active_run).toBe(1);
    expect(report.reasonCounts.abandoned_run).toBe(1);
    expect(report.reasonCounts.queue_pressure).toBe(1);
    expect(report.repairRecommendations.map((item) => item.action)).toContain("quarantine_permanently_failing_sources");
    expect(report.repairRecommendations.map((item) => item.action)).toContain("release_expired_leases");
    expect(report.repairRecommendations.map((item) => item.action)).toContain("delay_low_priority_sweeps");
  });

  test("simulates fairness enforcement for public searches sweeps channels metadata and retention", () => {
    const result = simulateFairnessEnforcement({
      publicLiveSearches: 1_000,
      actorSweeps: 4_000,
      publicChannelPolls: 2_000,
      restrictedMetadataQueues: 300,
      retentionReplayJobs: 250,
      workerSlots: 100
    });
    expect(result.leasedByClass.interactive_live_search).toBeGreaterThan(0);
    expect(result.leasedByClass.source_health_probe).toBeGreaterThan(0);
    expect(result.leasedByClass.restricted_darknet_metadata_sweep).toBeGreaterThan(0);
    expect(result.leasedByClass.replay_retention).toBeGreaterThan(0);
    expect(result.liveSearchStarved).toBe(false);
    expect(result.delayedLowPrioritySweeps).toBeGreaterThan(0);
    expect(result.repairRecommendations).toContain("delay_low_priority_sweeps");
  });

  test("keeps reconciliation snapshots bounded for 100 1k and 10k queued tasks", () => {
    const now = new Date("2026-01-01T01:00:00.000Z");
    for (const size of [100, 1_000, 10_000]) {
      const queued = Array.from({ length: size }, (_, index) => task({
        id: `task_${size}_${index}`,
        sourceId: `source_${index % 10}`,
        budgetClass: index % 5 === 0 ? "interactive_live_search" : "broad_daily_sweep",
        queuedAt: "2026-01-01T00:00:00.000Z"
      }));
      const report = buildSchedulerReconciliation({
        sources: Array.from({ length: 10 }, (_, index) => source({ id: `source_${index}`, status: "active" })),
        queued,
        leased: [],
        now,
        maxDiagnostics: 125,
        queuePressureThreshold: 1_000
      });
      expect(report.totals.queuedTasks).toBe(size);
      expect(report.totals.diagnosticsReturned).toBeLessThanOrEqual(125);
      if (size >= 1_000) expect(report.reasonCounts.queue_pressure).toBe(1);
      if (size === 10_000) expect(report.totals.diagnosticsTruncated).toBeGreaterThan(9_000);
    }
  });

  test("builds a non-mutating run cutover rehearsal for mixed actor live search and background work", () => {
    const now = new Date("2026-01-01T01:00:00.000Z");
    const actors = ["APT29", "Scattered Spider", "Volt Typhoon", "Turla", "Akira", "Random Actor"];
    const sources = [
      ...actors.map((actor, index) => source({ id: `src_actor_${index}`, status: "active", name: `${actor} RSS`, tags: [actor.toLowerCase()] })),
      source({ id: "src_health", status: "active", name: "Source health probe" }),
      source({ id: "src_telegram", type: "telegram_public", accessMethod: "official_api", status: "active", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "analyst_1" }),
      source({ id: "src_metadata", type: "tor_metadata", status: "active" }),
      source({ id: "src_failing", status: "active", health: { status: "failing", consecutiveFailures: 7, errorRate: 1 } })
    ];
    const queued = [
      ...actors.map((actor, index) => task({
        id: `task_live_${index}`,
        sourceId: `src_actor_${index}`,
        budgetClass: "interactive_live_search",
        runId: `run_live_${index}`,
        intelRequestId: `request_live_${index}`,
        queuedAt: index === 0 ? "2026-01-01T00:54:00.000Z" : "2026-01-01T00:58:00.000Z",
        targetUrl: `https://example.test/search?q=${encodeURIComponent(actor)}`
      })),
      ...Array.from({ length: 12 }, (_, index) => task({
        id: `task_sweep_${index}`,
        sourceId: `src_actor_${index % actors.length}`,
        budgetClass: "broad_daily_sweep",
        fairnessKey: "background:actor-sweep",
        queuedAt: "2026-01-01T00:30:00.000Z"
      })),
      task({ id: "task_health", sourceId: "src_health", budgetClass: "source_health_probe", queuedAt: "2026-01-01T00:50:00.000Z" }),
      task({ id: "task_telegram", sourceId: "src_telegram", sourceType: "telegram_public", budgetClass: "interactive_live_search", availableAt: "2026-01-01T01:05:00.000Z" }),
      task({ id: "task_metadata", sourceId: "src_metadata", sourceType: "tor_metadata", budgetClass: "restricted_darknet_metadata_sweep" })
    ];
    const leased = [
      task({ id: "task_replay", sourceId: "src_actor_0", budgetClass: "background_refresh", fairnessKey: "retention:replay", attemptDeadlineAt: "2026-01-01T01:02:00.000Z" })
    ];
    const runs = actors.map((actor, index) => run({
      id: `run_live_${index}`,
      requestId: `request_live_${index}`,
      requestHash: `live-reuse-${actor.toLowerCase().replaceAll(" ", "-")}`,
      status: "running",
      updatedAt: index === 5 ? "2026-01-01T00:30:00.000Z" : "2026-01-01T00:59:00.000Z"
    }));
    const report = buildSchedulerCutoverRehearsal({
      scenario: "mixed_actor_cutover",
      sources,
      queued,
      leased,
      deadLetters: [{ status: "retry_exhausted", taskId: "task_dead_failing", task: task({ id: "task_dead_failing", sourceId: "src_failing" }), reason: "permanent source failure" }],
      runs,
      now,
      workerSlots: 12,
      queuePressureThreshold: 10
    });

    expect(report.scenario).toBe("mixed_actor_cutover");
    expect(report.activeRunReuse.activeRuns).toBe(6);
    expect(report.activeRunReuse.reusableRuns).toBe(6);
    expect(report.promotionGate.duplicateReuseRate).toBe(1);
    expect(report.promotionGate.p95QueueAgeSeconds).toBeGreaterThan(0);
    expect(report.promotionGate.retryDebt).toBeGreaterThan(0);
    expect(report.promotionGate.deadLetterRate).toBeGreaterThan(0);
    expect(report.promotionGate.lowPriorityDeferralRate).toBeGreaterThan(0);
    expect(report.promotionGate.emergencyBrakeState).toBe("armed");
    expect(report.pressure.some((item) => item.workClass === "interactive_live_search")).toBe(true);
    expect(report.fairness.delayedLowPrioritySweeps).toBeGreaterThan(0);
    expect(report.repairPlan.every((step) => step.applyMode === "dry_run")).toBe(true);
    expect(report.repairPlan.map((step) => step.action)).toContain("delay_low_priority_sweeps");
    expect(report.recommendedNextAction).toBe("apply_repairs");
  });

  test("builds empty dry-run apply plans for normal public ti traffic", () => {
    const now = new Date("2026-01-01T01:00:00.000Z");
    const queued = [
      task({ id: "task_live_normal", sourceId: "src_live", budgetClass: "interactive_live_search", queuedAt: "2026-01-01T00:59:30.000Z" }),
      task({ id: "task_probe_normal", sourceId: "src_probe", budgetClass: "source_health_probe", queuedAt: "2026-01-01T00:58:00.000Z" })
    ];
    const rehearsal = buildSchedulerCutoverRehearsal({
      scenario: "normal_public_ti",
      sources: [source({ id: "src_live", status: "active" }), source({ id: "src_probe", status: "active" })],
      queued,
      leased: [],
      runs: [run({ id: "run_live_normal", requestHash: "normal-public-ti", updatedAt: "2026-01-01T00:59:45.000Z" })],
      now,
      workerSlots: 12,
      queuePressureThreshold: 100
    });
    const plan = buildSchedulerApplyPlan({ rehearsal, tasks: queued, now });

    expect(plan.dryRun).toBe(true);
    expect(plan.recommendation).toBe("safe_to_promote");
    expect(plan.steps).toEqual([]);
    expect(plan.emergencyBrake.state).toBe("clear");
    expect(plan.emergencyBrake.apiMode).toBe("normal");
    expect(plan.expectedTotalDelta.cursorReplayState).toBe("preserved");
  });

  test("builds degraded public ti apply plans with low-priority delay and noisy-source pause", () => {
    const now = new Date("2026-01-01T01:00:00.000Z");
    const queued = [
      ...Array.from({ length: 28 }, (_, index) => task({
        id: `task_noisy_sweep_${index}`,
        sourceId: "src_noisy",
        budgetClass: "broad_daily_sweep",
        fairnessKey: "background:noisy-source",
        queuedAt: "2026-01-01T00:40:00.000Z"
      })),
      ...Array.from({ length: 4 }, (_, index) => task({
        id: `task_live_degraded_${index}`,
        sourceId: `src_live_${index}`,
        budgetClass: "interactive_live_search",
        queuedAt: "2026-01-01T00:59:00.000Z"
      }))
    ];
    const rehearsal = buildSchedulerCutoverRehearsal({
      scenario: "degraded_public_ti",
      sources: [
        source({ id: "src_noisy", status: "active" }),
        ...Array.from({ length: 4 }, (_, index) => source({ id: `src_live_${index}`, status: "active" }))
      ],
      queued,
      leased: [],
      now,
      workerSlots: 8,
      queuePressureThreshold: 10
    });
    const plan = buildSchedulerApplyPlan({ rehearsal, tasks: queued, now, workerUtilization: 0.9 });
    const actions = plan.steps.map((step) => step.action);

    expect(plan.recommendation).toBe("hold_for_operator");
    expect(actions).toContain("delay_low_priority_sweeps");
    expect(actions).toContain("pause_noisy_source_queues");
    expect(plan.steps.find((step) => step.action === "delay_low_priority_sweeps")?.approval).toBe("automation_safe");
    expect(plan.steps.find((step) => step.action === "pause_noisy_source_queues")?.operatorApprovalRequired).toBe(true);
    expect(plan.steps.find((step) => step.action === "pause_noisy_source_queues")?.sourceIds).toEqual(["src_noisy"]);
    expect(plan.apiWarnings).toContain("scheduler_low_priority_delayed");
    expect(plan.apiWarnings).toContain("scheduler_source_queue_paused");
    expect(plan.apiWarnings).toContain("scheduler_worker_headroom_low");
    expect(plan.emergencyBrake.state).toBe("armed");
    expect(plan.emergencyBrake.frontendMode).toBe("show_degraded_banner");
    expect(plan.expectedTotalDelta.pausedSourceQueueDelta).toBeGreaterThan(0);
  });

  test("builds overloaded public ti emergency-brake apply plans without losing cursor or replay state", () => {
    const now = new Date("2026-01-01T03:00:00.000Z");
    const queued = Array.from({ length: 24 }, (_, index) => task({
      id: `task_overloaded_live_${index}`,
      sourceId: index < 16 ? "src_public_hot" : `src_public_${index}`,
      budgetClass: index % 3 === 0 ? "interactive_live_search" : "broad_daily_sweep",
      queuedAt: "2026-01-01T00:30:00.000Z",
      retryCount: index % 4 === 0 ? 2 : 0,
      availableAt: index % 4 === 0 ? "2026-01-01T03:15:00.000Z" : undefined
    }));
    const deadLetters = Array.from({ length: 4 }, (_, index) => ({
      status: "retry_exhausted" as const,
      taskId: `task_dead_overloaded_${index}`,
      task: task({ id: `task_dead_overloaded_${index}`, sourceId: "src_public_hot" }),
      reason: "public ti overload retry exhausted"
    }));
    const rehearsal = buildSchedulerCutoverRehearsal({
      scenario: "overloaded_public_ti",
      sources: [source({ id: "src_public_hot", status: "active" })],
      queued,
      leased: [
        task({ id: "task_expired_lease", sourceId: "src_public_hot", budgetClass: "interactive_live_search", attemptDeadlineAt: "2026-01-01T02:00:00.000Z" })
      ],
      deadLetters,
      runs: [
        run({ id: "run_abandoned_1", status: "running", updatedAt: "2026-01-01T01:30:00.000Z", requestHash: "overloaded-public-ti" }),
        run({ id: "run_abandoned_2", status: "running", updatedAt: "2026-01-01T01:20:00.000Z", requestHash: "overloaded-public-ti-2" })
      ],
      now,
      workerSlots: 4,
      queuePressureThreshold: 10
    });
    const plan = buildSchedulerApplyPlan({
      rehearsal,
      tasks: queued,
      now,
      hostMemoryMb: 1_048_576,
      dbConnectionUtilization: 0.92,
      workerUtilization: 0.96,
      maxApiP95QueueAgeSeconds: 120
    });

    expect(rehearsal.promotionGate.emergencyBrakeState).toBe("engaged");
    expect(plan.recommendation).toBe("emergency_brake_required");
    expect(plan.steps[0]?.action).toBe("trigger_emergency_brake");
    expect(plan.steps[0]?.approval).toBe("rollback_only");
    expect(plan.steps[0]?.riskClass).toBe("emergency");
    expect(plan.steps[0]?.preconditions).toContain("cursor and replay state are durable before worker throttling");
    expect(plan.emergencyBrake.apiMode).toBe("shed_new_live_search");
    expect(plan.emergencyBrake.frontendMode).toBe("disable_new_live_search");
    expect(plan.emergencyBrake.dbMode).toBe("protect_connections");
    expect(plan.emergencyBrake.workerMode).toBe("pause_noninteractive");
    expect(plan.emergencyBrake.preservesCursorReplayState).toBe(true);
    expect(plan.emergencyBrake.protectedHeadroom.maxSchedulerMemoryMb).toBe(98_304);
    expect(plan.apiWarnings).toContain("scheduler_emergency_brake");
    expect(plan.apiWarnings).toContain("scheduler_db_headroom_low");
    expect(plan.expectedTotalDelta.cursorReplayState).toBe("preserved");
    expect(plan.expectedTotalDelta.delayedTaskDelta).toBeGreaterThan(0);
  });

  test("freezes OpenAPI-ready scheduler apply-plan DTOs for Agent 09 and Agent 10", () => {
    const now = new Date("2026-01-01T03:00:00.000Z");
    const queued = Array.from({ length: 24 }, (_, index) => task({
      id: `task_contract_${index}`,
      sourceId: index < 14 ? "src_contract_hot" : `src_contract_${index}`,
      budgetClass: index % 2 === 0 ? "broad_daily_sweep" : "interactive_live_search",
      queuedAt: "2026-01-01T00:30:00.000Z"
    }));
    const rehearsal = buildSchedulerCutoverRehearsal({
      scenario: "api_contract_freeze",
      sources: [source({ id: "src_contract_hot", status: "active" })],
      queued,
      leased: [task({ id: "task_contract_expired", sourceId: "src_contract_hot", budgetClass: "interactive_live_search", attemptDeadlineAt: "2026-01-01T02:00:00.000Z" })],
      deadLetters: [{
        status: "retry_exhausted",
        taskId: "task_contract_dead",
        task: task({ id: "task_contract_dead", sourceId: "src_contract_hot" }),
        reason: "contract fixture dead letter"
      }],
      now,
      workerSlots: 4,
      queuePressureThreshold: 10
    });
    const plan = buildSchedulerApplyPlan({
      rehearsal,
      tasks: queued,
      now,
      dbConnectionUtilization: 0.9,
      workerUtilization: 0.95,
      maxApiP95QueueAgeSeconds: 120
    });
    const response = buildSchedulerApplyPlanApiResponse(plan, {
      dryRun: true,
      scenario: "api_contract_freeze",
      includeExecutionPreview: true
    });
    const contract = schedulerApplyPlanApiContract();

    expect(contract.endpoint).toBe("/v1/frontier/apply-plan");
    expect(contract.response.actions).toEqual([
      "release_expired_leases",
      "cancel_abandoned_runs",
      "requeue_transient_failures",
      "delay_low_priority_sweeps",
      "pause_noisy_source_queues",
      "quarantine_permanently_failing_sources",
      "trigger_emergency_brake"
    ]);
    expect(contract.response.forbiddenMutationFields).toContain("dbTransaction");
    expect(contract.examples.map((example) => example.name)).toContain("emergency_brake");
    expect(response.endpoint).toBe("/v1/frontier/apply-plan");
    expect(response.dryRun).toBe(true);
    expect(response.willMutate).toBe(false);
    expect(response.willLeaseTasks).toBe(false);
    expect(response.willAcknowledgeTasks).toBe(false);
    expect(response.willChangeRuns).toBe(false);
    expect(response.items.length).toBeGreaterThan(0);
    expect(response.items[0]).toHaveProperty("expectedQueueRunDelta");
    expect(response.executionPreview?.willMutate).toBe(false);
    expect(response.executionPreview?.steps.every((step) => step.wouldApply === false)).toBe(true);
    expect(response.emergencyBrake.preservesCursorReplayState).toBe(true);
    expect(response.promotionPacketLink.field).toBe("schedulerApplyPlanId");
    expect(JSON.stringify(response)).not.toContain("dbTransaction");
  });
});
