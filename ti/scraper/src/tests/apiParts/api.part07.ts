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
  test("publishes attached background canary loop runtime state", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const objectStore = new InMemoryObjectEvidenceStore();
    const canaryLoop = startCanaryCollectionLoop({
      store,
      frontier,
      objectStore,
      enabled: false,
      intervalSeconds: 120,
      maxSources: 7,
      maxTasks: 2,
      maxBytes: 64_000,
      timeoutMs: 5_000,
      queueLimit: 42,
      operatorId: "runtime-proof",
      activateSources: false,
      now: () => "2026-05-24T10:04:00.000Z",
    });
    try {
      const operator = await body(
        await handleApiRequest(api("/v1/ops/canary"), {
          store,
          frontier,
          objectStore,
          canaryLoop,
        }),
      ) as CanaryOperatorResponseForTest;
      expect(operator.operatorView.runtime).toMatchObject({
        schemaVersion: "ti.public_canary_loop_runtime.v1",
        supervisorAttached: true,
        enabled: false,
        running: false,
        startedAt: "2026-05-24T10:04:00.000Z",
        intervalSeconds: 120,
        cycleCount: 0,
        successCount: 0,
        errorCount: 0,
        consecutiveErrorCount: 0,
        maxSources: 7,
        maxTasks: 2,
        queueLimit: 42,
        activateSources: false,
        controls: {
          canaryPortfolioOnly: false,
          activationRequiresHumanApproval: true,
          continuousLoopAutoActivation: false,
          nativeFetchDefault: true,
          objectBoundaryConfigured: true,
          boundedQueueRequired: true,
          dedupeBeforeWrite: true,
          retriesBounded: true,
          restrictedSourcesExcluded: true,
        },
      });
      const consoleResponse = await handleApiRequest(
        api("/v1/ops/canary/console"),
        { store, frontier, objectStore, canaryLoop },
      );
      const html = await consoleResponse.text();
      expect(html).toContain("Runtime Loop");
      expect(html).toContain("Supervisor");
      expect(html).toContain("120s");
    } finally {
      canaryLoop.stop();
    }
  });
});
