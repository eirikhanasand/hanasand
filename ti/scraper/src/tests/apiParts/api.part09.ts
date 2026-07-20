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
  test("accepts human-approved canary console form actions without weakening API gates", async () => {
    const store = new InMemoryScraperStore();
    const objectStore = new InMemoryObjectEvidenceStore();
    const frontier = new FocusedFrontier();
    const canaryFetch = async () =>
      new Response(
        `
      <rss><channel><item>
        <title>APT42 public canary form action proof</title>
        <link>https://example.test/forms/apt42</link>
        <description>APT42 targeted public sector victims with phishing infrastructure and malware. Indicator 203.0.113.55 observed.</description>
        <pubDate>Sun, 24 May 2026 10:08:00 GMT</pubDate>
      </item></channel></rss>
    `,
        { status: 200, headers: { "content-type": "application/rss+xml" } },
      );
    const options = { store, frontier, objectStore, canaryFetch };
    const form = (fields: Record<string, string>) =>
      new URLSearchParams(fields).toString();
    const formHeaders = { "content-type": "application/x-www-form-urlencoded" };

    const activate = await handleApiRequest(
      api("/v1/sources/canary-activation", {
        method: "POST",
        headers: formHeaders,
        body: form({
          operatorApproval: "true",
          approvedBy: "console-test",
          generatedAt: "2026-05-24T10:08:00.000Z",
        }),
      }),
      options,
    );
    expect(activate.status).toBe(303);
    expect(activate.headers.get("location")).toContain(
      "/v1/ops/canary/console?status=activated",
    );
    expect(
      store.listSources().filter((item) =>
        item.metadata?.canaryPortfolio === true && item.status === "active"
      ).length,
    ).toBeGreaterThanOrEqual(8);

    const run = await handleApiRequest(
      api("/v1/ops/canary/run", {
        method: "POST",
        headers: formHeaders,
        body: form({
          operatorApproval: "true",
          approvedBy: "console-test",
          maxSources: "1",
          maxTasks: "1",
          generatedAt: "2026-05-24T10:09:00.000Z",
        }),
      }),
      options,
    );
    expect(run.status).toBe(303);
    expect(run.headers.get("location")).toContain(
      "/v1/ops/canary/console?status=ran",
    );
    expect(store.listCaptures()).toHaveLength(1);
    expect(store.listCaptures()[0]?.storageKind).toBe("external_object");

    const pause = await handleApiRequest(
      api("/v1/sources/canary-pause", {
        method: "POST",
        headers: formHeaders,
        body: form({
          operatorApproval: "true",
          approvedBy: "console-test",
          generatedAt: "2026-05-24T10:10:00.000Z",
        }),
      }),
      options,
    );
    expect(pause.status).toBe(303);
    expect(pause.headers.get("location")).toContain(
      "/v1/ops/canary/console?status=paused",
    );
    expect(
      store.listSources().filter((item) =>
        item.metadata?.canaryPortfolio === true
      ).every((item) => item.status === "paused"),
    ).toBe(true);
  });
});
