import { api, body, describe, expect, FocusedFrontier, handleApiRequest, InMemoryScraperStore, source, test } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("returns a safe no-result answer while live collection is pending and a terminal empty result after completion", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_no_result", type: "rss" }));
    const executed: string[] = [];
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Unseen%20Quartz%20Actor&entityType=actor"), { store, frontier: new FocusedFrontier(), runExecutor: (runId: string) => executed.push(runId) })) as Record<string, any>;
    expect(response.publicTiAnswer).toMatchObject({
      status: "searching",
      noResult: true,
      displayState: "searching",
      safeSummary: ["Searching"],
      nextPoll: { pollable: true, cursorRequired: true, nextPollAfterSeconds: expect.any(Number) },
      route: { publicWrapperPath: "/api/ti/search", publicWrapperMethod: "POST" },
    });
    expect(response.publicTiAnswer.waitReasons).toEqual(expect.arrayContaining([expect.objectContaining({ code: "capture_promotion" })]));
    expect(response.publicTiAnswer.evidenceLedgerReferences).toEqual([]);
    expect(response.evidenceAssessment.reasons).toContain("No matching public capture is available for review.");
    expect(response.evidenceAssessment.reasons).not.toContain("At least one matching public capture has reviewable content.");
    expect(response).not.toHaveProperty("collectionStrategy");
    expect(response.planner).not.toHaveProperty("decisions");
    expect(response.publicChannel).not.toHaveProperty("operatorStates");
    expect(executed).toEqual([response.planner.activeRunId]);
    expect(store.getRun(response.planner.activeRunId)).toMatchObject({ status: "queued", requestHash: response.planner.reuseKey });

    const runId = response.planner.activeRunId;
    const completedAt = new Date().toISOString();
    store.saveRun({ ...store.getRun(runId), status: "completed", completedAt, updatedAt: completedAt, captureCount: 0 });
    const terminal = await body(await handleApiRequest(api("/v1/intel/search?q=Unseen%20Quartz%20Actor&entityType=actor"), { store, frontier: new FocusedFrontier(), runExecutor: (id: string) => executed.push(id) })) as Record<string, any>;

    expect(terminal).toMatchObject({
      status: "ready",
      runId,
      summary: "No captured public-intelligence evidence matched Unseen Quartz Actor after collection completed.",
      planner: { terminalRunId: runId, terminalRunStatus: "completed", nextPollSeconds: 300 },
      publicTiAnswer: { noResult: true, displayState: "ready", waitReasons: [], nextPoll: { pollable: false, cursorRequired: false } },
    });
    expect(executed).toEqual([runId]);
    expect(store.listRuns()).toHaveLength(1);
  });

  test("reports a terminal failed live search without rescheduling or inferring evidence", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_failed_result", type: "rss" }));
    const executed: string[] = [];
    const first = await body(await handleApiRequest(api("/v1/intel/search?q=Failed%20Quartz%20Actor&entityType=actor"), { store, frontier: new FocusedFrontier(), runExecutor: (id: string) => executed.push(id) })) as Record<string, any>;
    const runId = first.planner.activeRunId;
    const completedAt = new Date().toISOString();
    store.saveRun({ ...store.getRun(runId), status: "failed", completedAt, updatedAt: completedAt, error: "source timeout" });

    const terminal = await body(await handleApiRequest(api("/v1/intel/search?q=Failed%20Quartz%20Actor&entityType=actor"), { store, frontier: new FocusedFrontier(), runExecutor: (id: string) => executed.push(id) })) as Record<string, any>;
    expect(terminal).toMatchObject({
      status: "partial",
      runId,
      summary: "No captured public-intelligence evidence matched Failed Quartz Actor; collection ended failed and no result was inferred.",
      planner: { terminalRunId: runId, terminalRunStatus: "failed" },
      publicTiAnswer: { noResult: true, displayState: "partial", waitReasons: [{ code: "collection_terminal" }], nextPoll: { pollable: false, cursorRequired: false } },
    });
    expect(executed).toEqual([runId]);
    expect(store.listRuns()).toHaveLength(1);
  });
});
