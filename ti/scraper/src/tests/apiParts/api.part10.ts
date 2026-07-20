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
  test("keeps continuous canary collection separate from source activation approval", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const objectStore = new InMemoryObjectEvidenceStore();
    store.saveSource(
      source({
        id: "src_non_canary_public",
        status: "active",
        type: "rss",
        url: "https://non-canary.example.test/feed.xml",
        metadata: { canaryPortfolio: false },
      }),
    );
    const canaryFetch = async () =>
      new Response(
        `       <rss><channel><item>         <title>Turla public canary continuous collection proof</title>         <link>https://example.test/canary/turla</link>         <description>Turla operators used Snake malware and command infrastructure. Indicator 198.51.100.88 observed.</description>         <pubDate>Sun, 24 May 2026 10:12:00 GMT</pubDate>       </item></channel></rss>     `,
        { status: 200, headers: { "content-type": "application/rss+xml" } },
      );
    const unapprovedRun = await runCanaryCollectionCycle({
      store,
      frontier,
      objectStore,
      fetch: canaryFetch,
      activateSources: false,
      maxSources: 2,
      maxTasks: 2,
      operatorId: "background-loop",
      now: () => "2026-05-24T10:11:00.000Z",
    });
    expect(unapprovedRun).toMatchObject({
      activationApplied: false,
      activatedSourceCount: 0,
      activeSourceCount: 1,
      queuedTaskCount: 1,
      completedTaskCount: 1,
      insertedCaptureCount: 1,
    });
    expect(store.listSources()).toHaveLength(1);
    expect(store.listCaptures()).toHaveLength(1);
    const activation = activatePublicCanarySources({
      store,
      operatorId: "operator-approved",
      now: "2026-05-24T10:12:00.000Z",
    });
    expect(activation.activated.length).toBeGreaterThanOrEqual(8);
    const approvedRun = await runCanaryCollectionCycle({
      store,
      frontier,
      objectStore,
      fetch: canaryFetch,
      activateSources: false,
      maxSources: 1,
      maxTasks: 1,
      operatorId: "background-loop",
      now: () => "2026-05-24T10:13:00.000Z",
    });
    expect(approvedRun).toMatchObject({
      activationApplied: false,
      activatedSourceCount: 0,
      activeSourceCount: 1,
      queuedTaskCount: 1,
      completedTaskCount: 1,
      insertedCaptureCount: 1,
      incidentCount: 1,
    });
    expect(store.listCaptures()[0]?.storageKind).toBe("external_object");
    expect(store.listCaptures().some((capture) => capture.sourceId === "src_non_canary_public")).toBe(true);
    expect(
      store.listSources().filter((item) =>
        item.metadata?.canaryPortfolio === true && item.status === "active"
      ).length,
    ).toBeGreaterThanOrEqual(8);
  });
});
