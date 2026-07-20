import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { executeScheduledCollectionRun, recoverCollectionRuns } from "../ops/scheduledCollection.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { api, body, source } from "./helpers/apiSourceFixtures.ts";

describe("scheduled API collection runs", () => {
  test("executes a queued run and exposes its captured results", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.saveSource(source({ id: "src_live_run", name: "Live APT feed", url: "https://public.example/feed.xml", type: "rss", tags: ["apt29"], tenantId: undefined }));
    store.savePlan({ id: "plan_live", tenantId: "tenant_live", request: { query: "APT29", entityType: "actor" }, tasks: [{ id: "task_live", sourceId: "src_live_run", sourceType: "rss", targetUrl: "https://public.example/feed.xml", queuedAt: new Date().toISOString(), priority: 1, maxRetries: 0, planning: { queryTerms: ["APT29"] } }] });
    store.saveRun({ id: "run_live", tenantId: "tenant_live", planId: "plan_live", requestId: "request_live", status: "queued", createdAt: new Date().toISOString(), taskCount: 1 });

    const run = await executeScheduledCollectionRun({
      store,
      frontier,
      fetch: async () => new Response("<rss><channel><item><title>APT29 targets diplomatic organizations</title><description>APT29 used credential theft against Example Ministry in government.</description><link>https://public.example/report</link><pubDate>2026-07-20T20:00:00Z</pubDate></item></channel></rss>", { status: 200, headers: { "content-type": "application/rss+xml" } }),
      maxConcurrentTasks: 1,
      maxItemsPerTask: 2,
    }, "run_live");

    expect(run).toMatchObject({ status: "completed", completedTaskCount: 1, failedTaskCount: 0, captureIds: [expect.any(String)] });
    store.saveExtractedEntity({ id: "cross_tenant_entity", tenantId: "other_tenant", captureId: run.captureIds[0], sourceId: "src_live_run", type: "actor", value: "LEAKED ACTOR", confidence: 1 });
    const response = await handleApiRequest(api("/v1/intel/runs/run_live/results", { headers: { "x-tenant-id": "tenant_live" } }), { store, frontier });
    const result = await body(response) as any;
    expect(response.status).toBe(200);
    expect(result.results.captures.total).toBe(1);
    expect(result.results.entities.items).toContainEqual(expect.objectContaining({ type: "actor", value: "APT29" }));
    expect(JSON.stringify(result)).not.toContain("LEAKED ACTOR");
  });

  test("recovers interactive runs and closes abandoned canary runs", () => {
    const store = new InMemoryScraperStore();
    const old = "2026-07-20T10:00:00.000Z";
    const fresh = "2026-07-20T10:59:00.000Z";
    store.saveRun({ id: "queued", planId: "plan", requestId: "public", status: "queued", createdAt: fresh, updatedAt: fresh });
    store.saveRun({ id: "stale", planId: "old-plan", requestId: "public", status: "queued", createdAt: old, updatedAt: old });
    store.saveRun({ id: "abandoned", planId: "canary", requestId: "req_public_canary", status: "running", createdAt: old, updatedAt: old });
    const executed: string[] = [];
    const result = recoverCollectionRuns({ store, execute: (runId: string) => executed.push(runId) }, new Date("2026-07-20T11:00:00.000Z"));
    expect(result).toEqual({ scheduled: ["queued"], failed: ["stale", "abandoned"] });
    expect(executed).toEqual(["queued"]);
    expect(store.getRun("stale")).toMatchObject({ status: "failed", error: "abandoned collection run recovered during startup" });
    expect(store.getRun("abandoned")).toMatchObject({ status: "failed", error: "abandoned collection run recovered during startup" });
  });

  test("creates executable run tasks and starts the worker", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.saveSource(source({ id: "src_api_run", tags: ["apt29"] }));
    const executed: string[] = [];
    const response = await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_live", "idempotency-key": "apt29-hour-1" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", priority: "urgent", maxTasks: 1 }),
    }), { store, frontier, runExecutor: (runId: string) => executed.push(runId) });
    const result = await body(response) as any;

    expect(response.status).toBe(201);
    expect(executed).toEqual([result.run.id]);
    expect(result.run.status).toBe("queued");
    expect(result.run.startedAt).toBeUndefined();
    expect(result.plan.tasks).toEqual([expect.objectContaining({ runId: result.run.id, planId: result.plan.id })]);
    const leased = frontier.next();
    expect(frontier.fail(leased, new Date(), "proof failure").status).toBe("retry_scheduled");
    expect(frontier.size()).toBe(1);
  });

  test("keeps delayed tasks queued for their next eligible time", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const availableAt = "2099-01-01T00:00:00.000Z";
    store.savePlan({ id: "plan_delayed", tenantId: "tenant_live", request: { query: "APT29", entityType: "actor" }, tasks: [{ id: "task_delayed", sourceId: "src_delayed", availableAt }] });
    store.saveRun({ id: "run_delayed", tenantId: "tenant_live", planId: "plan_delayed", requestId: "request_delayed", status: "queued", createdAt: new Date().toISOString(), taskCount: 1 });

    const run = await executeScheduledCollectionRun({ store, frontier }, "run_delayed");

    expect(run).toMatchObject({ status: "queued", nextAttemptAt: availableAt, completedTaskCount: 0 });
    expect(frontier.size()).toBe(1);
  });
});
