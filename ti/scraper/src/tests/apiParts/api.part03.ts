import { describe, expect, test, body, handleApiRequest, api, InMemoryScraperStore, FocusedFrontier } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("exposes compact live product SLO dashboard", async () => {
    const response = await body(await handleApiRequest(api("/v1/ops/product-slo?generatedAt=2026-06-20T12:00:00.000Z&actorRowCount=100&actorSellableRows=100&actorFreshRowCount=100&actorUsefulRowCount=100"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    }));
    expect(response.schemaVersion).toBe("ti.live_product_slo.compact.v3");
    expect(response.route).toBe("/v1/ops/product-slo");
    expect(response.productLaunch).toBeDefined();
    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");

  });
});
