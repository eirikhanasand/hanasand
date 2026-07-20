import { api, body, describe, expect, FocusedFrontier, handleApiRequest, InMemoryScraperStore, source, test } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("keeps unknown actor searches in a safe searching state", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_generic_actor_feed", type: "rss", tags: ["actor"] }));
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Made%20Up%20Actor&entityType=actor"), { store, frontier: new FocusedFrontier() })) as Record<string, any>;
    expect(response.publicTiAnswer).toMatchObject({ status: "searching", displayState: "searching", safeSummary: ["Searching"], evidenceLedgerReferences: [] });
    expect(response.rows).toEqual([]);
    expect(response.results).toEqual([]);
  });
});
