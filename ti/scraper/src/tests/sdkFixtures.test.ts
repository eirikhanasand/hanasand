import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("sdk fixture surface", () => {
  test("exposes enough contract data for simple client generation", async () => {
    const body = await (await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    })).json() as any;
    expect(body.schemaVersion).toContain("compact");
    expect(body.routeInventory.count).toBeGreaterThan(5);
  });
});
