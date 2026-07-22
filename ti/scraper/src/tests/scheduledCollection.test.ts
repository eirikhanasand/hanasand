import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { executeScheduledCollectionRun, recoverCollectionRuns } from "../ops/scheduledCollection.ts";
import type { MitreActorCatalogSnapshot } from "../pipeline/mitreActorCatalog.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { api, body, source } from "./helpers/apiSourceFixtures.ts";

describe("scheduled API collection runs", () => {
  test("executes a queued run and exposes its captured results", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.replaceActorIdentityCatalog({
      schemaVersion: "ti.actor_identity_catalog.v1", catalogId: "mitre-attack-enterprise", catalogName: "Enterprise ATT&CK",
      catalogVersion: "19.1", catalogModifiedAt: "2026-05-12T14:00:00.188Z", sourceUrl: "https://attack.mitre.org/groups/G0016/",
      bundleId: "bundle--64af0946-bfeb-481d-96df-a38e2709e3db", bundleSha256: "bdf1ce86a4e604214c5076d37ae4dcb322678afc528df8492e6fdc1b554f5da3", retrievedAt: "2026-07-21T00:00:00.000Z",
      counts: { totalIdentityCount: 1, currentIdentityCount: 1, deprecatedIdentityCount: 0, revokedIdentityCount: 0, aptNumberDesignationPresentCount: 1, associatedNameOccurrenceCount: 14, distinctAssociatedNameCount: 14, distinctLookupLabelCount: 15, aliasCollisionCount: 0 },
      identities: [{
        id: "mitre-attack-enterprise:G0016", catalogId: "mitre-attack-enterprise", externalId: "G0016", stixId: "intrusion-set--899ce53f-13a0-479b-a0e4-67d46e241542",
        canonicalName: "APT29", normalizedCanonicalName: "apt29", associatedNames: ["IRON RITUAL", "IRON HEMLOCK", "NobleBaron", "Dark Halo", "NOBELIUM", "UNC2452", "YTTRIUM", "The Dukes", "Cozy Bear", "CozyDuke", "SolarStorm", "Blue Kitsune", "UNC3524", "Midnight Blizzard"],
        status: "current", aptNumberDesignationPresent: true, createdAt: "2017-05-31T21:31:52.748Z", modifiedAt: "2026-01-20T16:22:04.140Z",
        domains: ["enterprise-attack"], contributors: ["Daniyal Naeem, BT Security", "Matt Brenton, Zurich Insurance Group", "Katie Nickels, Red Canary", "Joe Gumke, U.S. Bank", "Liran Ravich, CardinalOps", "Vicky Ray, RayvenX"],
        sourceUrl: "https://attack.mitre.org/groups/G0016", referenceUrls: ["https://attack.mitre.org/groups/G0016"], catalogVersion: "19.1", catalogModifiedAt: "2026-05-12T14:00:00.188Z", bundleSha256: "bdf1ce86a4e604214c5076d37ae4dcb322678afc528df8492e6fdc1b554f5da3", retrievedAt: "2026-07-21T00:00:00.000Z"
      }],
      aliasCollisions: []
    } satisfies MitreActorCatalogSnapshot, { sourceId: "src_mitre_enterprise_stix", captureId: "cap_mitre_enterprise_v19_1" });
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

  test("fails runs whose collection deadline expired", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.savePlan({ id: "plan_expired", tenantId: "tenant_live", budget: { deadlineAt: "2020-01-01T00:00:00.000Z" }, tasks: [{ id: "task_expired", sourceId: "src_expired" }] });
    store.saveRun({ id: "run_expired", tenantId: "tenant_live", planId: "plan_expired", requestId: "request_expired", status: "queued", createdAt: "2020-01-01T00:00:00.000Z", taskCount: 1 });
    frontier.enqueueTask({ id: "task_expired_retry", sourceId: "src_expired", runId: "run_expired", availableAt: "2099-01-01T00:00:00.000Z" });

    const run = await executeScheduledCollectionRun({ store, frontier }, "run_expired");

    expect(run).toMatchObject({ status: "failed", error: "collection plan deadline expired" });
    expect(frontier.size()).toBe(0);
  });
});
