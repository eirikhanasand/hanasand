import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("api regression sentinel", () => {
  test("keeps the compact buyer-visible route inventory available", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const contract = await response.json() as any;
    expect(contract.routeInventory.routes.map((route: any) => route.path)).toEqual(expect.arrayContaining([
      "/v1/intel/search",
      "/api/ti/search",
      "/v1/darkweb/search",
      "/v1/ops/product-slo"
    ]));
    expect(contract.semantics.noCredentialCollection).toBe(true);
  });
});
