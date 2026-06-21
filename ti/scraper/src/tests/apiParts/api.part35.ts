import { describe, expect, test, body, handleApiRequest, api, InMemoryScraperStore, FocusedFrontier } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("returns compact restricted metadata operations status", async () => {
    const response = await body(await handleApiRequest(api("/v1/restricted-metadata/status"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    }));
    expect((response.status as { endpoint: string; metadataOnly: boolean }).endpoint).toBe("/v1/restricted-metadata/status");
    expect((response.status as { endpoint: string; metadataOnly: boolean }).metadataOnly).toBe(true);
    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");

  });
});
