import { api, body, describe, expect, FocusedFrontier, handleApiRequest, InMemoryScraperStore, source, test } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("returns a safe no-result answer while live collection is pending", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_no_result", type: "rss" }));
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Unseen%20Quartz%20Actor&entityType=actor"), { store, frontier: new FocusedFrontier() })) as Record<string, any>;
    expect(response.publicTiAnswer).toMatchObject({
      status: "searching",
      noResult: true,
      displayState: "searching",
      safeSummary: ["Searching"],
      nextPoll: { pollable: true, cursorRequired: true, nextPollAfterSeconds: expect.any(Number) },
      route: { publicWrapperPath: "/api/ti/search", publicWrapperMethod: "POST" },
    });
    expect(response.publicTiAnswer.waitReasons).toEqual(expect.arrayContaining([expect.objectContaining({ code: "capture_promotion" })]));
    expect(response.publicTiAnswer.evidenceLedgerReferences).toEqual([]);
  });
});
