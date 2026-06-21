import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("api gateway integration", () => {
  test("keeps public wrapper search compatible with gateway routing", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/api/ti/search?q=APT29"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(body.publicTiAnswer.route.canonicalPath).toBe("/api/ti/search");
    expect(body.status).toBe("searching");
  });
});
