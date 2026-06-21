import { describe, expect, test, body, handleApiRequest, api, InMemoryScraperStore, FocusedFrontier } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("exposes compact quality examples and warnings", async () => {
    const response = await body(await handleApiRequest(api("/v1/quality/evaluate?q=Akira"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    }));
    expect((response.quality as { publicWarningCodes: string[] }).publicWarningCodes).toBeDefined();
    expect(response.entityResolutionWorkbench).toBeDefined();
    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");

  });
});
