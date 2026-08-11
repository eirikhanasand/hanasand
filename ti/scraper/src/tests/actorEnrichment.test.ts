import { describe, expect, test } from "bun:test";
import { handleActorEnrichmentRequest } from "../api/actorEnrichmentRoutes.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

const options = (store: InMemoryScraperStore) => ({ store, frontier: {} as any });

describe("actor enrichment operations", () => {
  test("records a durable run and reports idle status with its last successful run", async () => {
    const store = new InMemoryScraperStore();
    const created = await handleActorEnrichmentRequest(new Request("http://localhost/v1/intel/actor-enrichment/runs", { method: "POST", body: JSON.stringify({ tenantId: "tenant-a" }), headers: { "content-type": "application/json" } }), options(store) as any);
    expect(created?.status).toBe(201);
    const status = await handleActorEnrichmentRequest(new Request("http://localhost/v1/intel/actor-enrichment/status?tenantId=tenant-a"), options(store) as any);
    const body = await status?.json();
    expect(body.worker).toMatchObject({ state: "idle", snapshotFresh: true });
    expect(body.latestRun).toMatchObject({ status: "completed", actorCount: 0, failureCount: 0 });
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
});
