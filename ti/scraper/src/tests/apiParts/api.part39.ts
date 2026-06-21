import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("returns frozen scheduler apply-plan contract without mutating frontier state", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const hotSource = source({ id: "src_scheduler_hot", tags: ["apt29"] });
    store.saveSource(hotSource);
    for (let index = 0; index < 24; index += 1) {
      frontier.add({
        source: hotSource,
        tenantId: "tenant_scheduler",
        intelRequestId: `request_scheduler_${Math.floor(index / 4)}`,
        url: `https://scheduler.example.test/${index}`,
        discoveredAt: "2026-01-01T00:00:00.000Z",
        anchorText: "APT29 public ti background sweep",
        parentRelevance: 0.9,
        novelty: 0.8,
        freshness: 0.7,
        fairnessKey: "background:scheduler-hot"
      });
    }
    const beforeQueued = frontier.snapshot().map((item) => item.task.id).sort();
    const beforeLeased = frontier.leasedSnapshot().map((task) => task.id).sort();
    const response = await body(await handleApiRequest(api("/v1/frontier/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenario: "api_scheduler_contract",
        includeExecutionPreview: true,
        includeSourceGapEnqueueRehearsal: true,
        includeSourceGapWorkerLoopPreview: true,
        workerUtilization: 0.96,
        dbConnectionUtilization: 0.91,
        maxApiP95QueueAgeSeconds: 120
      })
    }), { store, frontier }));
    const afterQueued = frontier.snapshot().map((item) => item.task.id).sort();
    const afterLeased = frontier.leasedSnapshot().map((task) => task.id).sort();
    const contract = response.contract as {
      endpoint: string;
      mode: string;
      response: { actions: string[]; forbiddenMutationFields: string[] };
      examples: Array<{ name: string }>;
    };
    const applyPlan = response.applyPlan as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willLeaseTasks: boolean;
      willAcknowledgeTasks: boolean;
      willChangeRuns: boolean;
      summary: { stepCount: number };
      executionPreview: { willMutate: boolean; steps: Array<{ wouldApply: boolean }> };
      sourceGapEnqueueRehearsal: {
        schemaVersion: string;
        routeField: string;
        mode: string;
        willMutate: boolean;
        blockedReasons: string[];
        mutatedRunCount: number;
        mutatedTaskCount: number;
        repositoryCalls: Array<{ executed: boolean; skippedReason?: string }>;
      };
      sourceGapWorkerLoopPreview: {
        schemaVersion: string;
        routeField: string;
        disabledByDefault: boolean;
        willMutate: boolean;
        nextLoopAction: string;
        commitPolicy: string;
        partitionPlan: Array<{ workerPartition: string; drainBehavior: string; taskIds: string[] }>;
        entry: { decision: string; nextWorkerAction: string };
      };
      promotionPacketLink: { field: string };
    };

    expect(contract.endpoint).toBe("/v1/frontier/apply-plan");
    expect(contract.mode).toBe("dry_run");
    expect(contract.response.actions).toContain("trigger_emergency_brake");
    expect(contract.response.forbiddenMutationFields).toContain("cursorPayload");
    expect(contract.examples.map((example) => example.name)).toEqual([
      "expired_lease_release",
      "abandoned_run_cancel",
      "transient_requeue",
      "low_priority_deferral",
      "noisy_source_pause",
      "quarantine_recommendation",
      "emergency_brake"
    ]);
    for (const example of contract.examples as unknown as Array<{
      response: {
        willMutate: boolean;
        willLeaseTasks: boolean;
        willAcknowledgeTasks: boolean;
        willChangeRuns: boolean;
        item: {
          execution: string;
          riskClass: string;
          preconditions: string[];
          expectedQueueRunDelta: { cursorReplayState: string };
          rollback: string;
        };
      };
    }>) {
      expect(example.response).toMatchObject({
        willMutate: false,
        willLeaseTasks: false,
        willAcknowledgeTasks: false,
        willChangeRuns: false
      });
      expect(["automation_safe", "human_approval_required", "blocked", "rollback_only"]).toContain(example.response.item.execution);
      expect(["low", "medium", "high", "emergency"]).toContain(example.response.item.riskClass);
      expect(example.response.item.preconditions.length).toBeGreaterThan(0);
      expect(example.response.item.expectedQueueRunDelta.cursorReplayState).toBe("preserved");
      expect(example.response.item.rollback.length).toBeGreaterThan(0);
    }
    expect(applyPlan.endpoint).toBe("/v1/frontier/apply-plan");
    expect(applyPlan.dryRun).toBe(true);
    expect(applyPlan.willMutate).toBe(false);
    expect(applyPlan.willLeaseTasks).toBe(false);
    expect(applyPlan.willAcknowledgeTasks).toBe(false);
    expect(applyPlan.willChangeRuns).toBe(false);
    expect(applyPlan.summary.stepCount).toBeGreaterThan(0);
    expect(applyPlan.executionPreview.willMutate).toBe(false);
    expect(applyPlan.executionPreview.steps.every((step) => step.wouldApply === false)).toBe(true);
    expect(applyPlan.sourceGapEnqueueRehearsal).toMatchObject({
      schemaVersion: "ti.scheduler_source_gap_enqueue_rehearsal.v1",
      routeField: "applyPlan.sourceGapEnqueueRehearsal",
      mode: "blocked_dry_run",
      willMutate: false,
      mutatedRunCount: 0,
      mutatedTaskCount: 0
    });
    expect(applyPlan.sourceGapEnqueueRehearsal.blockedReasons).toEqual(expect.arrayContaining(["apply_not_requested", "source_gap_enqueue_flag_disabled", "postgres_queue_disabled"]));
    expect(applyPlan.sourceGapEnqueueRehearsal.repositoryCalls.length).toBeGreaterThan(0);
    expect(applyPlan.sourceGapEnqueueRehearsal.repositoryCalls.every((call) => call.executed === false && call.skippedReason === "blocked_by_preflight")).toBe(true);
    expect(applyPlan.sourceGapWorkerLoopPreview).toMatchObject({
      schemaVersion: "ti.scheduler_source_gap_worker_loop.v1",
      routeField: "applyPlan.sourceGapWorkerLoopPreview",
      disabledByDefault: true,
      willMutate: false,
      nextLoopAction: "sleep_until_next_poll",
      commitPolicy: "return_blocked_receipt",
      entry: {
        decision: "blocked_before_repository",
        nextWorkerAction: "return_without_mutation"
      }
    });
    expect(applyPlan.sourceGapWorkerLoopPreview.partitionPlan).toEqual(expect.arrayContaining([
      expect.objectContaining({
        workerPartition: "interactive_actor_search",
        drainBehavior: "finish_or_checkpoint_before_shutdown",
        taskIds: expect.arrayContaining(["dryrun_interactive_live_search_tier_100_apt29_safe_public_sources"])
      }),
      expect.objectContaining({
        workerPartition: "public_channel_window",
        drainBehavior: "checkpoint_and_requeue_by_reuse_key"
      }),
      expect.objectContaining({
        workerPartition: "restricted_metadata_approval",
        drainBehavior: "metadata_review_hold"
      })
    ]));
    expect(applyPlan.promotionPacketLink.field).toBe("schedulerApplyPlanId");
    expect(afterQueued).toEqual(beforeQueued);
    expect(afterLeased).toEqual(beforeLeased);
    expect(JSON.stringify(response.applyPlan)).not.toContain("dbTransaction");
    expect(JSON.stringify(response.applyPlan)).not.toContain("cursorPayload");
    expect(JSON.stringify(response.applyPlan)).not.toContain("leasedTask");
  });
});
