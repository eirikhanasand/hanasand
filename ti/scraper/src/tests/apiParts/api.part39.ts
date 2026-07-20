import {
  api,
  body,
  describe,
  expect,
  FocusedFrontier,
  handleApiRequest,
  InMemoryScraperStore,
  source,
  test,
} from "../apiTestHarness.ts";

describe("api v1", () => {
  test("returns a dry-run scheduler plan without mutating frontier state", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const activeSource = source({ id: "src_scheduler_hot", tags: ["apt29"] });
    store.saveSource(activeSource);
    for (let index = 0; index < 24; index += 1) {
      frontier.add({
        source: activeSource,
        tenantId: "tenant_scheduler",
        intelRequestId: `request_scheduler_${Math.floor(index / 4)}`,
        url: `https://scheduler.example.test/${index}`,
        discoveredAt: "2026-01-01T00:00:00.000Z",
        anchorText: "APT29 public ti background sweep",
        parentRelevance: 0.9,
        novelty: 0.8,
        freshness: 0.7,
        fairnessKey: "background:scheduler-hot",
      });
    }
    const beforeQueued = frontier.snapshot().map((item) => item.task.id).sort();
    const beforeLeased = frontier.leasedSnapshot().map((task) => task.id)
      .sort();
    const response = await body(
      await handleApiRequest(
        api("/v1/frontier/apply-plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            scenario: "api_scheduler_contract",
            includeExecutionPreview: true,
          }),
        }),
        { store, frontier },
      ),
    ) as Record<string, any>;

    expect(response.contract).toMatchObject({
      route: "/v1/frontier/apply-plan",
      dryRunOnly: true,
    });
    expect(response.contract.allowedActions).toContain(
      "trigger_emergency_brake",
    );
    expect(response.applyPlan).toMatchObject({
      dryRun: true,
      willMutate: false,
      willLeaseTasks: false,
      willAcknowledgeTasks: false,
      willChangeRuns: false,
      executionPreview: { willMutate: false },
    });
    expect(
      response.applyPlan.executionPreview.steps.every((step: any) =>
        step.wouldApply === false
      ),
    ).toBe(true);
    expect(frontier.snapshot().map((item) => item.task.id).sort()).toEqual(
      beforeQueued,
    );
    expect(frontier.leasedSnapshot().map((task) => task.id).sort()).toEqual(
      beforeLeased,
    );
    expect(JSON.stringify(response.applyPlan)).not.toContain("cursorPayload");
  });
});
