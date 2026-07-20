import { describe, expect, test } from "bun:test";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { handleApiRequest } from "../api/server.ts";

describe("durable mutation authentication", () => {
  test("rejects spoofed user headers and accepts the configured service caller", async () => {
    const options = {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier(),
      serviceToken: "mutation-test-secret"
    };
    const body = JSON.stringify({ id: "org_test", name: "Test", createdBy: "spoofed" });

    const rejected = await handleApiRequest(new Request("http://local/v1/organizations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor-id": "spoofed" },
      body
    }), options);
    expect(rejected.status).toBe(401);

    const accepted = await handleApiRequest(new Request("http://local/v1/organizations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hanasand-service-token": "mutation-test-secret" },
      body
    }), options);
    expect(accepted.status).toBe(201);
  });
});
