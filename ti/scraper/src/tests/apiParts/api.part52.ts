import { describe, expect, test, body, handleApiRequest, api, InMemoryScraperStore, FocusedFrontier } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("fuses compact actor profile into live search output", async () => {
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&entityType=actor"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    }));
    expect(response.query).toBe("APT29");
    expect(typeof response.summary).toBe("string");
    expect(response.actorProfile).toMatchObject({ query: "APT29" });
    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");

  });
});
