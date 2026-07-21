import { describe, expect, test } from "bun:test";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { handleApiRequest } from "../api/server.ts";

describe("durable mutation authentication", () => {
  test("rejects spoofed sensitive reads while leaving health public", async () => {
    const options = {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier(),
      serviceToken: "mutation-test-secret"
    };

    for (const path of ["/v1/intel/runs/run_test", "/v1/cases", "/v1/dwm/watchlists", "/api/dwm/product"]) {
      const response = await handleApiRequest(new Request(`http://local${path}`, {
        headers: { "x-tenant-id": "spoofed", "x-actor-id": "spoofed" }
      }), options);
      expect(response.status).toBe(401);
    }

    expect((await handleApiRequest(new Request("http://local/v1/health"), options)).status).toBe(200);
    expect((await handleApiRequest(new Request("http://local/v1/cases", {
      headers: { "x-hanasand-service-token": "mutation-test-secret" }
    }), options)).status).toBe(200);
  });

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
    const rejectedEntitlements = await handleApiRequest(new Request("http://local/v1/organizations/org_owned/entitlements", {
      headers: { ...outsiderHeaders, "x-user-id": "owner-user" }
    }), options);
    expect(rejectedEntitlements.status).toBe(403);
    const rejectedActorReview = await handleApiRequest(new Request("http://local/v1/ti/actor-org-relevance", {
      method: "POST",
      headers: { ...outsiderHeaders, "content-type": "application/json", "x-actor-id": "owner-user" },
      body: JSON.stringify({ organizationId: "org_owned" })
    }), options);
    expect(rejectedActorReview.status).toBe(403);

    const owner = await handleApiRequest(new Request("http://local/v1/organizations/org_owned/webhooks", {
      method: "POST",
      headers: { authorization: "Bearer valid", id: "owner-user", "content-type": "application/json" },
      body: JSON.stringify({ url: "https://hooks.example.test/alert" })
    }), options);
    expect(owner.status).toBe(201);
    const ownerEntitlements = await handleApiRequest(new Request("http://local/v1/organizations/org_owned/entitlements", {
      headers: { authorization: "Bearer valid", id: "owner-user" }
    }), options);
    expect(ownerEntitlements.status).toBe(200);
    const ownerActorReview = await handleApiRequest(new Request("http://local/v1/ti/actor-org-relevance", {
      method: "POST",
      headers: { authorization: "Bearer valid", id: "owner-user", "content-type": "application/json" },
      body: JSON.stringify({ organizationId: "org_owned" })
    }), options);
    expect(ownerActorReview.status).toBe(400);
  });

  test("creates an authenticated owner membership without inventing an email address", async () => {
    const options: any = {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier(),
      authApiBase: "https://auth.test/api",
      authFetch: async () => Response.json({ id: "owner-without-email", roles: [] })
    };
    const response = await handleApiRequest(new Request("http://local/v1/organizations", {
      method: "POST",
      headers: { authorization: "Bearer valid", id: "owner-without-email", "content-type": "application/json" },
      body: JSON.stringify({ id: "org_without_email", name: "No synthetic email" })
    }), options);
    const payload = await response.json() as any;

    expect(response.status).toBe(201);
    expect(payload.owner.userId).toBe("owner-without-email");
    expect(payload.owner.email).toBeUndefined();
    expect(options.store.listOrganizationMembers()).toHaveLength(1);
  });
});
