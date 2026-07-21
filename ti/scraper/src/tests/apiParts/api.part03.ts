import { describe, expect, test, body, handleApiRequest, api, fixtureCapture, source, loadRuntimeConfig, InMemoryScraperStore, FocusedFrontier } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("exposes measured product operational SLO dashboard", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_api" }));
    store.saveCapture(fixtureCapture());
    const response = await body(await handleApiRequest(api("/v1/ops/product-slo?actorSellableRows=999999"), {
      store,
      frontier: new FocusedFrontier(),
      config: loadRuntimeConfig({ SCRAPER_ENV: "production" })
    }));
    expect(response.schemaVersion).toBe("ti.product_operational_slo.v1");
    expect(response.route).toBe("/v1/ops/product-slo");
    expect(response.proofMode).toBe("public_live");
    expect(response.metrics).toMatchObject({ sources: { total: 1, active: 1 }, captures: { total: 1 } });
    expect(response.resourceGuardrails).toMatchObject({ scraperTargetRamMb: 8192, scraperNormalCeilingMb: 14336 });
    const serialized = JSON.stringify(response).toLowerCase();
    expect(response.productLaunch).toBeUndefined();
    expect(response.monetizationReadiness).toBeUndefined();
    expect(response.paidProductEconomics).toBeUndefined();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");

  });
});
