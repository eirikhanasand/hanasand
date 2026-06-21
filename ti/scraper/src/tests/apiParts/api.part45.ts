import { describe, expect, test, body, handleApiRequest, api, InMemoryScraperStore, FocusedFrontier } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("routes compact source coverage and atlas endpoints", async () => {
    const options = { store: new InMemoryScraperStore(), frontier: new FocusedFrontier() };
    const coverage = await body(await handleApiRequest(api("/v1/sources/coverage-plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ queries: ["APT29"] }) }), options));
    const atlas = await body(await handleApiRequest(api("/v1/sources/atlas?recordLimit=500"), options));
    expect(coverage).toBeDefined();
    expect(atlas).toBeDefined();
    const serialized = JSON.stringify({ coverage, atlas }).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");
  });
});
