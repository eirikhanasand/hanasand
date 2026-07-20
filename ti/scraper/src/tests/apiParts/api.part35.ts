import {
  api,
  body,
  describe,
  expect,
  FocusedFrontier,
  handleApiRequest,
  InMemoryScraperStore,
  test,
} from "../apiTestHarness.ts";

describe("api v1", () => {
  test("returns compact restricted metadata operations status", async () => {
    const response = await body(
      await handleApiRequest(api("/v1/restricted-metadata/status"), {
        store: new InMemoryScraperStore(),
        frontier: new FocusedFrontier(),
      }),
    );
    expect(response.status).toMatchObject({
      metadataOnly: true,
      sourceCount: 0,
      captureCount: 0,
      readiness: { ready: 0, blocked: 0 },
    });
    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");
  });
});
