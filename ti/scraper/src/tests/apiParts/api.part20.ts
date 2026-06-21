import { describe, expect, test, body, handleApiRequest, api, InMemoryScraperStore, FocusedFrontier, InMemoryObjectEvidenceStore } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("returns compact evidence replay and cutover DTOs without unsafe bodies", async () => {
    const options = { store: new InMemoryScraperStore(), frontier: new FocusedFrontier(), objectStore: new InMemoryObjectEvidenceStore() };
    const response = await body(await handleApiRequest(api("/v1/evidence/replay-plan?q=APT29&runId=run_api"), options));
    const replayPlan = response.replayPlan as { endpoint: string; redaction: { sensitiveBodiesExposed: boolean } };
    expect(replayPlan.endpoint).toBe("/v1/evidence/replay-plan");
    expect(replayPlan.redaction.sensitiveBodiesExposed).toBe(false);
    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");

  });
});
