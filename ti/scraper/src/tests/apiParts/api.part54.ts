import { describe, expect, test, body, handleApiRequest, api, InMemoryScraperStore, FocusedFrontier } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("exposes compact scraper-native search fields", async () => {
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Scattered%20Spider&entityType=actor"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    }));
    expect(response.query).toBe("Scattered Spider");
    expect(response.runId).toEqual(expect.any(String));
    expect(response.refreshAfterSeconds).toEqual(expect.any(Number));
    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");

  });
});
