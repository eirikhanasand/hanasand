import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("organization watchlist collection requests", () => {
  test("persists lifecycle status and hides requests from foreign tenants", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource({
      id: "src_public_query",
      name: "Public news query",
      type: "rss",
      url: "https://news.example.test/search?q={query}",
      accessMethod: "public_http",
      status: "active",
      risk: "low",
      trustScore: 0.8,
      crawlFrequencySeconds: 3600,
      legalNotes: "Public news search provider approved for lawful organization monitoring.",
      createdAt: "2026-08-08T00:00:00.000Z",
      updatedAt: "2026-08-08T00:00:00.000Z",
      metadata: { sourceFamily: "public_news_search", productionCollection: true }
    } as any);
    saveOrganization(store, "tenant_a", "org_a", "owner_a", "owner");
    saveOrganization(store, "tenant_a", "org_a", "analyst_a", "analyst");
    saveOrganization(store, "tenant_b", "org_b", "owner_b", "owner");
    store.saveDwmWatchlist(watchlist("tenant_a", "org_a", "Alpha Corp"));
    store.saveDwmWatchlist(watchlist("tenant_b", "org_b", "Beta Corp"));

    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let executionCount = 0;
    let failNext = false;
    const options: any = {
      store,
      frontier: new FocusedFrontier(),
      authApiBase: "http://auth.test/api",
      authFetch: async (request: string | URL | Request) => {
        const id = new URL(typeof request === "string" ? request : request instanceof URL ? request : request.url).pathname.split("/").pop();
        return Response.json({ id, roles: [{ id: "customer" }] });
      },
      runExecutor: async (runId: string) => {
        executionCount++;
        const queued = store.getRun(runId)!;
        store.saveRun({ ...queued, status: "running", startedAt: "2026-08-08T01:00:00.000Z", updatedAt: "2026-08-08T01:00:00.000Z" });
        if (failNext) {
          store.saveRun({ ...store.getRun(runId), status: "failed", error: "provider unavailable", completedAt: "2026-08-08T01:01:00.000Z", updatedAt: "2026-08-08T01:01:00.000Z" });
          return;
        }
        await gate;
        const captureId = "cap_collection_a";
        store.saveDwmAlert({ id: "alert_collection_a", tenantId: "tenant_a", organizationId: "org_a", workflowContext: { captureIds: [captureId] } });
        store.saveRun({ ...store.getRun(runId), status: "completed", captureCount: 1, captureIds: [captureId], completedAt: "2026-08-08T01:02:00.000Z", updatedAt: "2026-08-08T01:02:00.000Z" });
      }
    };

    const created = await handleApiRequest(request("/v1/dwm/collection-requests", "owner_a", "POST", {
      tenantId: "tenant_a",
      organizationId: "org_a"
    }, { "idempotency-key": "fresh-alpha-1" }), options);
    expect(created.status).toBe(202);
    const initial = await created.json() as any;
    const requestId = initial.collectionRequest.requestId;
    expect(initial.collectionRequest).toMatchObject({ requestId: expect.any(String), status: expect.stringMatching(/queued|running/), captureCount: 0, alertCount: 0 });

    expect(store.listPlans().map((plan: any) => ({ tenantId: plan.tenantId ?? plan.request?.tenantId, organizationId: plan.request?.organizationId, requestId: plan.request?.collectionRequestId })))
      .toContainEqual({ tenantId: "tenant_a", organizationId: "org_a", requestId });
    await Promise.resolve();
    const running = await handleApiRequest(request(`/v1/dwm/collection-requests/${requestId}?tenantId=tenant_a&organizationId=org_a`, "owner_a"), options);
    expect(await running.json()).toMatchObject({ collectionRequest: { requestId, status: "running", captureCount: 0, alertCount: 0 } });

    const foreign = await handleApiRequest(request(`/v1/dwm/collection-requests/${requestId}?tenantId=tenant_b&organizationId=org_b`, "owner_b"), options);
    expect(foreign.status).toBe(404);
    const analyst = await handleApiRequest(request("/v1/dwm/collection-requests", "analyst_a", "POST", { tenantId: "tenant_a", organizationId: "org_a" }), options);
    expect(analyst.status).toBe(403);

    release();
    await Bun.sleep(0);
    const completed = await handleApiRequest(request(`/v1/dwm/collection-requests/${requestId}?tenantId=tenant_a&organizationId=org_a`, "owner_a"), options);
    expect(await completed.json()).toMatchObject({ collectionRequest: { requestId, status: "completed", captureCount: 1, alertCount: 1, alertIds: ["alert_collection_a"], errors: [] } });

    const repeated = await handleApiRequest(request("/v1/dwm/collection-requests", "owner_a", "POST", {
      tenantId: "tenant_a",
      organizationId: "org_a"
    }, { "idempotency-key": "fresh-alpha-1" }), options);
    expect(repeated.status).toBe(200);
    expect((await repeated.json() as any).collectionRequest.requestId).toBe(requestId);
    expect(executionCount).toBe(1);

    failNext = true;
    const failed = await handleApiRequest(request("/v1/dwm/collection-requests", "owner_a", "POST", {
      tenantId: "tenant_a",
      organizationId: "org_a"
    }, { "idempotency-key": "fresh-alpha-2" }), options);
    const failedId = (await failed.json() as any).collectionRequest.requestId;
    await Bun.sleep(0);
    const failedStatus = await handleApiRequest(request(`/v1/dwm/collection-requests/${failedId}?tenantId=tenant_a&organizationId=org_a`, "owner_a"), options);
    expect(await failedStatus.json()).toMatchObject({ collectionRequest: { requestId: failedId, status: "failed", captureCount: 0, alertCount: 0, errors: ["provider unavailable"] } });
  });
});

function saveOrganization(store: InMemoryScraperStore, tenantId: string, organizationId: string, userId: string, role: string) {
  if (!(store as any).listOrganizations().some((row: any) => row.id === organizationId)) {
    store.saveOrganization({ id: organizationId, tenantId, name: organizationId, slug: organizationId, status: "active", kind: "customer", createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z" });
  }
  store.saveOrganizationMember({ id: userId, userId, organizationId, role, status: "active", createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z" });
}

function watchlist(tenantId: string, organizationId: string, value: string) {
  return { id: `watch_${organizationId}`, tenantId, organizationId, name: value, status: "active", terms: [{ id: `term_${organizationId}`, value, kind: "company" }], createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z" };
}

function request(path: string, id: string, method = "GET", body?: any, headers?: Record<string, string>) {
  return new Request(`http://local${path}`, {
    method,
    headers: { authorization: "Bearer valid-session", id, ...(body ? { "content-type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
}
