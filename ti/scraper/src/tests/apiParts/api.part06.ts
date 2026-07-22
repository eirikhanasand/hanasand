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
  test("blocks native live HTTP collection from localhost targets", async () => {
    const store = new InMemoryScraperStore();
    const objectStore = new InMemoryObjectEvidenceStore();
    const frontier = new FocusedFrontier();
    store.saveSource(source({
      id: "src_native_canary_localhost",
      name: "Blocked localhost canary",
      type: "rss",
      url: "http://127.0.0.1:8099/feed.xml",
      status: "active",
      metadata: { canaryPortfolio: true },
    }));
    const run = await runCanaryCollectionCycle({
      store,
      frontier,
      objectStore,
      maxSources: 1,
      maxTasks: 1,
      now: () => "2026-05-24T10:03:00.000Z",
    });
    expect(run).toMatchObject({
      activationApplied: false,
      completedTaskCount: 0,
      failedTaskCount: 1,
      insertedCaptureCount: 0,
      incidentCount: 0,
      retryScheduledCount: 1,
      errors: [expect.objectContaining({ message: "public fetch policy blocked target" })],
    });
    expect(store.listCaptures()).toHaveLength(0);
    expect(store.getSource("src_native_canary_localhost")?.health).toMatchObject({
      status: "degraded",
      lastError: "public fetch policy blocked target",
    });
    const operator = buildCanaryOperatorSummary({ store, frontier, generatedAt: "2026-05-24T10:03:00.000Z" });
    expect(operator.evidenceStorage).toMatchObject({
      productionEvidenceMode: "none",
      nativeLiveHttpCaptureCount: 0,
      externalObjectCaptureCount: 0,
    });
  });
});
