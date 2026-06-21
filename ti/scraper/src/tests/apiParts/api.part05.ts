import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("executes approved public canary activation collection and exposes operator view", async () => {
    const store = new InMemoryScraperStore();
    const objectStore = new InMemoryObjectEvidenceStore();
    const frontier = new FocusedFrontier();
    const canaryFetch = async () => new Response(`
      <rss><channel><item>
        <title>APT42 phishing campaign and CVE-2026-11111 exploitation</title>
        <link>https://example.test/apt42-campaign</link>
        <description>APT42 used malware in a phishing campaign targeting energy sector victims. Indicator 198.51.100.44 observed.</description>
        <pubDate>Sun, 24 May 2026 10:00:00 GMT</pubDate>
      </item></channel></rss>
    `, { status: 200, headers: { "content-type": "application/rss+xml" } });
    const options = { store, frontier, objectStore, canaryFetch };

    const activationBlocked = await body(await handleApiRequest(api("/v1/sources/canary-activation", { method: "POST", body: "{}" }), options));
    expect((activationBlocked.error as { code: string }).code).toBe("approval_required");

    const activation = await body(await handleApiRequest(api("/v1/sources/canary-activation", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "analyst-1", generatedAt: "2026-05-24T10:00:00.000Z" })
    }), options));
    expect((activation.activation as { activated: unknown[] }).activated.length).toBeGreaterThanOrEqual(8);
    expect(store.listSources().every((item) => item.status === "active")).toBe(true);

    const run = await body(await handleApiRequest(api("/v1/ops/canary/run", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "analyst-1", maxSources: 2, maxTasks: 1, generatedAt: "2026-05-24T10:01:00.000Z" })
    }), options));
    const canaryRunId = (run.canaryRun as { runId: string }).runId;
    expect(run.canaryRun).toMatchObject({
      mode: "production_canary",
      runId: expect.any(String),
      planId: expect.any(String),
      completedTaskCount: 1,
      failedTaskCount: 0,
      retryScheduledCount: 0,
      retryExhaustedCount: 0,
      remainingQueuedTaskCount: 1,
      insertedCaptureCount: 1,
      health: {
        freshnessSeconds: 0,
        errorRate: 0,
        duplicateRate: 0,
        promotionYield: 1
      }
    });
    const captures = store.listCaptures();
    expect(captures).toHaveLength(1);
    expect(captures[0]?.storageKind).toBe("external_object");
    expect(captures[0]?.objectRef).toBeDefined();
    expect(captures[0]?.body).toBeUndefined();
    expect(String(captures[0]?.metadata.safeExcerpt)).toContain("APT42");
    expect(captures[0]?.metadata.fetchMode).toBe("injected_proof_fetch");
    expect(captures[0]?.metadata.fetchProvenance).toMatchObject({
      mode: "injected_proof_fetch",
      adapterVersion: "public_canary_fetcher:v1",
      httpStatus: 200,
      bounded: true,
      truncated: false
    });
    expect(captures[0]?.metadata.finalUrlHash).toEqual(expect.any(String));
    expect(store.listIncidents().length).toBeGreaterThanOrEqual(1);
    expect(objectStore.getObject(captures[0]!.objectRef!)).toBeDefined();
    const canaryRunRecord = store.listRuns()[0];
    expect(canaryRunRecord?.id).toBe(canaryRunId);
    expect(canaryRunRecord).toMatchObject({
      status: "running",
      taskCount: 2,
      captureCount: 1,
      incidentCount: 1
    });

    const operator = await body(await handleApiRequest(api("/v1/ops/canary"), options)) as CanaryOperatorResponseForTest;
    const operatorView = operator.operatorView;
    expect(operatorView.activeSources.length).toBeGreaterThanOrEqual(8);
    expect(operatorView.latestRun).toMatchObject({ runId: canaryRunRecord?.id, status: "running", taskCount: 2, captureCount: 1, incidentCount: 1 });
    expect(operatorView.latestCaptures).toHaveLength(1);
    expect(operatorView.schedulerHealth).toMatchObject({ errorRate: 0, promotionYield: 1, duplicateRate: 0, retryScheduledCount: 0, retryExhaustedCount: 0 });
    expect(operatorView.runtime).toMatchObject({
      schemaVersion: "ti.public_canary_loop_runtime.v1",
      supervisorAttached: false,
      enabled: false,
      activateSources: false,
      controls: {
        canaryPortfolioOnly: true,
        activationRequiresHumanApproval: true,
        continuousLoopAutoActivation: false,
        boundedQueueRequired: true,
        dedupeBeforeWrite: true,
        retriesBounded: true,
        restrictedSourcesExcluded: true
      }
    });
    expect(operatorView.evidenceStorage).toMatchObject({
      productionEvidenceMode: "injected_proof_only",
      externalObjectCaptureCount: 1,
      inlineCaptureCount: 0,
      missingObjectReferenceCount: 0,
      nativeLiveHttpCaptureCount: 0,
      injectedProofFetchCaptureCount: 1,
      unknownFetchModeCaptureCount: 0
    });
    expect(operatorView.blockedOrHeldItems).toEqual([]);
    expect(operatorView.publicAnswerReadiness.find((item) => item.query === "APT42")?.captureCount).toBe(1);

    const consoleResponse = await handleApiRequest(api("/v1/ops/canary/console"), options);
    expect(consoleResponse.headers.get("content-type")).toContain("text/html");
    const consoleHtml = await consoleResponse.text();
    expect(consoleHtml).toContain("TI Canary Ops");
    expect(consoleHtml).toContain("Active Sources");
    expect(consoleHtml).toContain("Queued work");
    expect(consoleHtml).toContain("Runtime Loop");
    expect(consoleHtml).toContain("Evidence mode");
    expect(consoleHtml).toContain("Public Answer Readiness");
    expect(consoleHtml).toContain("Why Partial");
    expect(consoleHtml).toContain("APT42");
    expect(consoleHtml).not.toContain("198.51.100.44");
    expect(consoleHtml).not.toContain("public-canary-evidence/");
    expect(consoleHtml.toLowerCase()).not.toContain("password");

    const search = await body(await handleApiRequest(api("/v1/intel/search?q=APT42"), options));
    expect(search.status).toMatch(/ready|partial/);
    expect(JSON.stringify(search.publicTiAnswer)).toContain("public_answer_ux");
    expect(JSON.stringify(search.actorProfile)).toContain("APT42");

    const pauseBlocked = await body(await handleApiRequest(api("/v1/sources/canary-pause", { method: "POST", body: "{}" }), options));
    expect((pauseBlocked.error as { code: string }).code).toBe("approval_required");
    const pause = await body(await handleApiRequest(api("/v1/sources/canary-pause", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "analyst-1", generatedAt: "2026-05-24T10:02:00.000Z" })
    }), options));
    expect((pause.pause as { paused: unknown[] }).paused.length).toBeGreaterThanOrEqual(8);
    expect(store.listSources().filter((item) => item.metadata?.canaryPortfolio === true).every((item) => item.status === "paused")).toBe(true);
  });
});
