import { describe, expect, test, body, handleApiRequest, api, InMemoryScraperStore, FocusedFrontier } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("routes compact source coverage and atlas endpoints", async () => {
    const options = { store: new InMemoryScraperStore(), frontier: new FocusedFrontier() };
    const coverage = await body(await handleApiRequest(api("/v1/sources/coverage-plan?q=APT29"), options));
    const atlas = await body(await handleApiRequest(api("/v1/sources/atlas?recordLimit=500"), options));
    expect(coverage.endpoint).toBe("/v1/sources/coverage-plan");
    expect(atlas.endpoint).toBe("/v1/sources/atlas");
    const response = { coverage, atlas };
    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");

  });
});
