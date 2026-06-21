import { describe, expect, test, body, handleApiRequest, api, InMemoryScraperStore, FocusedFrontier } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("schedules compact actor run with API-ready status", async () => {
    const request = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "APT29", entityType: "actor", maxTasks: 4 }) };
    const response = await body(await handleApiRequest(api("/v1/intel/runs", request), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    }));
    const run = response.run as { id: string };
    const scheduler = response.scheduler as { runId: string };
    expect(run.id).toEqual(expect.any(String));
    expect(scheduler.runId).toBe(run.id);
    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");

  });
});
