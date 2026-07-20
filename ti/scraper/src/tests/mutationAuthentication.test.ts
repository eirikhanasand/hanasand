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

  test("filters organization reads and requires an organization administrator for settings", async () => {
    const options: any = {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier(),
      serviceToken: "mutation-test-secret",
      authApiBase: "https://auth.test/api",
      authFetch: async (url: URL) => Response.json({ id: decodeURIComponent(url.pathname.split("/").at(-1)!), roles: [] })
    };
    const serviceHeaders = { "content-type": "application/json", "x-hanasand-service-token": "mutation-test-secret" };
    await handleApiRequest(new Request("http://local/v1/organizations", {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify({ id: "org_owned", name: "Owned", ownerEmail: "owner@example.test", ownerUserId: "owner-user" })
    }), options);

    const outsiderHeaders = { authorization: "Bearer valid", id: "outsider-user" };
    const outsiderList = await handleApiRequest(new Request("http://local/v1/organizations", { headers: outsiderHeaders }), options);
    expect((await outsiderList.json() as any).organizations).toEqual([]);
    const rejected = await handleApiRequest(new Request("http://local/v1/organizations/org_owned/webhooks", {
      method: "POST",
      headers: { ...outsiderHeaders, "content-type": "application/json", "x-actor-id": "owner-user" },
      body: JSON.stringify({ url: "https://hooks.example.test/alert" })
    }), options);
    expect(rejected.status).toBe(403);

    const owner = await handleApiRequest(new Request("http://local/v1/organizations/org_owned/webhooks", {
      method: "POST",
      headers: { authorization: "Bearer valid", id: "owner-user", "content-type": "application/json" },
      body: JSON.stringify({ url: "https://hooks.example.test/alert" })
    }), options);
    expect(owner.status).toBe(201);
  });
});
