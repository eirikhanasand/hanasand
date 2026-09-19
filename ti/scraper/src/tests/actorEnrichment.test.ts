import { describe, expect, test } from "bun:test";
import { handleActorEnrichmentRequest } from "../api/actorEnrichmentRoutes.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

const options = (store: InMemoryScraperStore) => ({ store, frontier: {} as any });

describe("actor enrichment operations", () => {
  test("triggers the real worker and never fabricates a completed run", async () => {
    const store = new InMemoryScraperStore();
    const request = () => new Request("http://localhost/v1/intel/actor-enrichment/runs", { method: "POST", body: JSON.stringify({ tenantId: "default" }), headers: { "content-type": "application/json" } });
    expect((await handleActorEnrichmentRequest(request(), options(store) as any))?.status).toBe(503);
    let started = false;
    const response = await handleActorEnrichmentRequest(request(), { ...options(store), actorEnrichmentWorker: { run: () => { started = true; } } } as any);
    expect(response?.status).toBe(202);
    expect(started).toBe(true);
    expect(store.listActorEnrichmentRuns()).toEqual([]);
  });

  test("keeps profile timeline tenant-scoped", async () => {
    const store = new InMemoryScraperStore();
    (store as any).evidenceDeltas = new Map([
      ["a", { id: "a", tenantId: "tenant-a", subjectType: "actor_profile", subjectId: "actor-1", observedAt: "2026-08-11T00:00:00Z", metadata: { characterization: { sectors: [] } } }],
      ["b", { id: "b", tenantId: "tenant-b", subjectType: "actor_profile", subjectId: "actor-1", observedAt: "2026-08-11T00:00:00Z", metadata: { characterization: { sectors: [] } } }],
    ]);
    const response = await handleActorEnrichmentRequest(new Request("http://localhost/v1/intel/actor-profiles/actor-1/timeline?tenantId=tenant-a"), options(store) as any);
    expect((await response?.json()).updates.map((item: any) => item.id)).toEqual(["a"]);
  });

  test("returns stable pagination metadata for enrichment history", async () => {
    const store = new InMemoryScraperStore();
    for (let index = 0; index < 3; index += 1) {
      store.saveActorEnrichmentRun({ id: `run-${index}`, tenantId: 'tenant-a', status: 'completed', updatedAt: new Date().toISOString() });
    }
    const response = await handleActorEnrichmentRequest(new Request("http://localhost/v1/intel/actor-enrichment/runs?tenantId=tenant-a&limit=2&cursor=0"), options(store) as any);
    const body = await response?.json();
    expect(body.rows).toHaveLength(2);
    expect(body.total).toBe(3);
    expect(body.nextCursor).toBe("2");
    expect(body.pagination).toMatchObject({ sortField: "updatedAt", direction: "desc" });
  });
});
