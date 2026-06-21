import { describe, expect, test, body, handleApiRequest, api, InMemoryScraperStore, FocusedFrontier } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("returns compact public-channel status DTO", async () => {
    const response = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor&cursor=19"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    }));
    expect((response.status as { endpoint: string; metadataOnly: boolean }).endpoint).toBe("/v1/public-channels/status");
    expect((response.status as { endpoint: string; metadataOnly: boolean }).metadataOnly).toBe(true);
    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");

  });
});
