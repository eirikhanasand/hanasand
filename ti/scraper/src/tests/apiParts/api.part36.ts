import { describe, expect, test, body, handleApiRequest, api, InMemoryScraperStore, FocusedFrontier } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("routes compact darkweb metadata status and search", async () => {
    const options = { store: new InMemoryScraperStore(), frontier: new FocusedFrontier() };
    const status = await body(await handleApiRequest(api("/v1/darkweb/status"), options));
    const search = await body(await handleApiRequest(api("/v1/darkweb/search?q=akira&network=tor&limit=5"), options));
    expect(status.status).toMatchObject({ indexedRecordCount: 0, monitoredSourceCount: 0 });
    expect(search).toMatchObject({ query: "akira", count: 0, rows: [], filters: { network: "tor" } });
    expect(status.status).not.toHaveProperty("targetRecordCount");
    expect(status.status).not.toHaveProperty("indexedRecordEstimate");
    const serialized = JSON.stringify({ status, search }).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");
  });
});
