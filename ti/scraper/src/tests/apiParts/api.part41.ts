import {
  activatePublicCanarySources,
  api,
  apiRestrictedMetadataApplyPlanSources,
  body,
  buildCanaryOperatorSummary,
  createLogger,
  describe,
  expect,
  FileBackedScraperStore,
  fixtureCapture,
  fixtureDelta,
  FocusedFrontier,
  handleApiRequest,
  hashContent,
  InMemoryObjectEvidenceStore,
  InMemoryScraperStore,
  join,
  loadRuntimeConfig,
  MetricsRegistry,
  mkdtempSync,
  processCollectedItem,
  restrictedMetadataApplyPlanSources,
  rmSync,
  runCanaryCollectionCycle,
  seedEvidenceReplayFixture,
  source,
  startApiServer,
  startCanaryCollectionLoop,
  telegramCapture,
  test,
  tmpdir,
  WorkerSupervisor,
} from "../apiTestHarness.ts";
import type {
  AnalystClaimLedgerEntry,
  CanaryOperatorResponseForTest,
  CanaryReadinessResponseForTest,
  CanarySoakResponseForTest,
  RawCapture,
  SourceRecord,
} from "../apiTestHarness.ts";

describe("api v1", () => {
  test("smokes mounted scheduler apply-plan endpoint for normal degraded emergency and invalid requests", async () => {
    const scenarios: Array<
      {
        name: string;
        queued: number;
        ageSeconds: number;
        request: Record<string, unknown>;
        status: number;
        expectedAction?: string;
        expectedError?: string;
      }
    > = [{
      name: "normal",
      queued: 2,
      ageSeconds: 5,
      request: { scenario: "normal", includeExecutionPreview: true },
      status: 200,
    }, {
      name: "degraded",
      queued: 24,
      ageSeconds: 45,
      request: {
        scenario: "degraded",
        includeExecutionPreview: true,
        workerUtilization: 0.9,
      },
      status: 200,
      expectedAction: "pause_noisy_source_queues",
    }, {
      name: "emergency_brake",
      queued: 24,
      ageSeconds: 14_400,
      request: {
        scenario: "emergency_brake",
        includeExecutionPreview: true,
        workerUtilization: 0.96,
        dbConnectionUtilization: 0.92,
        maxApiP95QueueAgeSeconds: 120,
      },
      status: 200,
      expectedAction: "trigger_emergency_brake",
    }, {
      name: "invalid_action",
      queued: 1,
      ageSeconds: 5,
      request: { selectedActions: ["mutate_queue_now"] },
      status: 400,
      expectedError: "invalid_action",
    }];
    for (const scenario of scenarios) {
      const store = new InMemoryScraperStore();
      const frontier = new FocusedFrontier();
      const activeSource = source({ id: `src_mounted_${scenario.name}` });
      store.saveSource(activeSource);
      const queuedAt = new Date(Date.now() - scenario.ageSeconds * 1000)
        .toISOString();
      for (let index = 0; index < scenario.queued; index += 1) {
        frontier.add({
          source: activeSource,
          tenantId: "tenant_mounted_scheduler",
          intelRequestId: `request_mounted_${scenario.name}_${
            Math.floor(index / 4)
          }`,
          url: `https://scheduler.example.test/${scenario.name}/${index}`,
          discoveredAt: queuedAt,
          anchorText: "APT29 mounted endpoint proof",
          parentRelevance: 0.9,
          novelty: 0.8,
          freshness: 0.8,
          fairnessKey: scenario.name === "normal"
            ? "interactive:mounted"
            : "background:mounted",
        });
      }
      const beforeQueued = frontier.snapshot().map((item) => item.task.id)
        .sort();
      const beforeLeased = frontier.leasedSnapshot().map((task) => task.id)
        .sort();
      const beforeRuns = store.listRuns().map((run) =>
        `${run.id}:${run.status}:${run.updatedAt}`
      ).sort();
      const server = startApiServer({ port: 0, store, frontier });
      try {
        const response = await fetch(
          `http://127.0.0.1:${server.port}/v1/frontier/apply-plan`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(scenario.request),
          },
        );
        const payload = await response.json() as {
          applyPlan?: {
            dryRun: boolean;
            willMutate: boolean;
            willLeaseTasks: boolean;
            willAcknowledgeTasks: boolean;
            willChangeRuns: boolean;
            items: Array<{ action: string }>;
            executionPreview?: {
              willMutate: boolean;
              steps: Array<{ wouldApply: boolean }>;
            };
          };
          error?: { code: string };
        };
        expect(response.status).toBe(scenario.status);
        if (scenario.status === 200) {
          expect(payload.applyPlan).toMatchObject({
            dryRun: true,
            willMutate: false,
            willLeaseTasks: false,
            willAcknowledgeTasks: false,
            willChangeRuns: false,
          });
          expect(payload.applyPlan?.executionPreview?.willMutate).toBe(false);
          expect(
            payload.applyPlan?.executionPreview?.steps.every((step) =>
              step.wouldApply === false
            ),
          ).toBe(true);
          if (scenario.expectedAction) {
            expect(payload.applyPlan?.items.map((item) => item.action))
              .toContain(scenario.expectedAction);
          }
        } else expect(payload.error?.code).toBe(scenario.expectedError);
      } finally {
        server.stop();
      }
      expect(frontier.snapshot().map((item) => item.task.id).sort()).toEqual(
        beforeQueued,
      );
      expect(frontier.leasedSnapshot().map((task) => task.id).sort()).toEqual(
        beforeLeased,
      );
      expect(
        store.listRuns().map((run) =>
          `${run.id}:${run.status}:${run.updatedAt}`
        ).sort(),
      ).toEqual(beforeRuns);
    }
  });
});
