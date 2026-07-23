import {
  activatePublicCanarySources,
  api,
  apiRestrictedMetadataApplyPlanSources,
  body,
  buildCanaryOperatorSummary,
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
  test("records canary retry and run health when a public source fetch fails", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const canaryFetch = async () =>
      new Response("temporary upstream failure", { status: 503 });
    const options = {
      store,
      frontier,
      objectStore: new InMemoryObjectEvidenceStore(),
      canaryFetch,
    };

    await body(
      await handleApiRequest(
        api("/v1/sources/canary-activation", {
          method: "POST",
          body: JSON.stringify({
            operatorApproval: true,
            approvedBy: "analyst-1",
            generatedAt: "2026-05-24T10:00:00.000Z",
          }),
        }),
        options,
      ),
    );
    const run = await body(
      await handleApiRequest(
        api("/v1/ops/canary/run", {
          method: "POST",
          body: JSON.stringify({
            operatorApproval: true,
            approvedBy: "analyst-1",
            maxSources: 1,
            maxTasks: 1,
            generatedAt: "2026-05-24T10:01:00.000Z",
            timeoutMs: 1000,
          }),
        }),
        options,
      ),
    );

    expect(run.canaryRun).toMatchObject({
      mode: "production_canary",
      queuedTaskCount: 1,
      completedTaskCount: 0,
      failedTaskCount: 1,
      retryScheduledCount: 1,
      retryExhaustedCount: 0,
      remainingQueuedTaskCount: 1,
      health: {
        errorRate: 1,
        promotionYield: 0,
      },
    });
    expect(store.listRuns()[0]).toMatchObject({
      status: "failed",
      taskCount: 1,
      captureCount: 0,
      incidentCount: 0,
    });
    expect(frontier.snapshot()).toHaveLength(1);
    const failedSourceId = (run.canaryRun as { errors: Array<{ sourceId: string }> }).errors[0]?.sourceId;
    expect(store.getSource(failedSourceId)?.health?.status).toBe("degraded");

    const operator = await body(
      await handleApiRequest(api("/v1/ops/canary"), options),
    );
    expect(operator.operatorView).toMatchObject({
      queue: { queued: 1, leased: 0, deadLetters: 0 },
      schedulerHealth: {
        errorRate: 1,
        retryScheduledCount: 1,
        retryExhaustedCount: 0,
        failingSourceCount: 0,
        degradedSourceCount: 1,
      },
    });
  });
});
