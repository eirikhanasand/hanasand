import { describe, expect, test, body, handleApiRequest, api, InMemoryScraperStore, FocusedFrontier } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("does not expose the retired placeholder coverage plan", async () => {
    const options = { store: new InMemoryScraperStore(), frontier: new FocusedFrontier() };
    const coverageResponse = await handleApiRequest(api("/v1/sources/coverage-plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ queries: ["APT29"] }) }), options);
    const coverage = await body(coverageResponse);
    const atlas = await body(await handleApiRequest(api("/v1/sources/atlas?recordLimit=500"), options));
    expect(coverageResponse.status).toBe(404);
    expect(coverage).toMatchObject({ error: { code: "not_found" } });
    expect(atlas).toBeDefined();
    const serialized = JSON.stringify({ coverage, atlas }).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");
  });
});
