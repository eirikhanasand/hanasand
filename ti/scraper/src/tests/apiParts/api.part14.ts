import { describe, expect, test, body, handleApiRequest, api, InMemoryScraperStore, FocusedFrontier } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("publishes compact contract index without unsafe example leaks", async () => {
    const response = await body(await handleApiRequest(api("/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    }));
    expect(Array.isArray(response.surfaces)).toBe(true);
    expect((response.routeInventory as { count: number }).count).toBeGreaterThan(0);
    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");

  });
});
