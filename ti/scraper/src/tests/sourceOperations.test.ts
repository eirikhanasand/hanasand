import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { api, source } from "./helpers/apiSourceFixtures.ts";
import { fixtureCapture } from "./helpers/storageFixtures.ts";

describe("source operations", () => {
  test("summarizes persisted health safely inside the requested tenant", async () => {
    const store = new InMemoryScraperStore();
    const now = new Date(Date.now() - 2_000).toISOString();
    store.saveSource({
      ...source({
        id: "src_ops_a",
        metadata: {
          sourceFamily: "vendor_blog",
          parserVersion: "vendor:v2",
          countsAsCoverage: false,
          automaticSourceReview: {
            state: "approved",
            reviewedAt: now,
            configuredModelVersion: "hanasand-review-v6",
            decision: { confidence: 0.92, claimValidity: "supported", rationale: "private rationale must stay internal" }
          }
        }
      }),
      countsAsCoverage: true,
      tenantId: "tenant_a"
    });
    store.saveSource({ ...source({ id: "src_ops_b" }), tenantId: "tenant_b" });
    store.saveCapture(fixtureCapture({ id: "cap_ops_a", tenantId: "tenant_a", sourceId: "src_ops_a", collectedAt: now, metadata: { runId: "run_ops_useful" } }));
    store.saveExtractedEntity({ id: "entity_ops_a", tenantId: "tenant_a", sourceId: "src_ops_a", captureId: "cap_ops_a", type: "actor", value: "APT29", normalizedValue: "apt29" });
    store.saveEvaluationLabel({ id: "label_tp", tenantId: "tenant_a", captureId: "cap_ops_a", outcome: "true_positive" });
    store.saveEvaluationLabel({ id: "label_fp", tenantId: "tenant_a", captureId: "cap_ops_a", outcome: "false_positive" });
    store.saveSourceHealthObservation({ id: "health_ok", tenantId: "tenant_a", sourceId: "src_ops_a", collectionRunId: "run_ops_useful", checkedAt: now, status: "degraded", success: true, useful: true, itemCount: 2, captureCount: 1, duplicateCount: 1, parserWarningCount: 1, legalMode: "public_content" });
    store.saveSourceHealthObservation({ id: "health_failed", tenantId: "tenant_a", sourceId: "src_ops_a", collectionRunId: "run_ops_failed", checkedAt: new Date(Date.parse(now) + 1_000).toISOString(), status: "failed", success: false, useful: false, itemCount: 0, captureCount: 0, duplicateCount: 0, parserWarningCount: 0, adapterFailureCategory: "network_failure", failureReason: "fetch https://secretexample.onion/post?token=unsafe failed", legalMode: "public_content" });
    store.saveSourceHealthObservation({ id: "health_other_tenant", tenantId: "tenant_b", sourceId: "src_ops_b", checkedAt: now, status: "healthy", success: true, useful: true, itemCount: 1, captureCount: 1, duplicateCount: 0, parserWarningCount: 0, legalMode: "public_content" });

    const options = { store, frontier: new FocusedFrontier(), serviceToken: "source-ops-test" };
    const response = await handleApiRequest(authenticatedApi("/v1/intel/source-operations", "tenant_a"), options);
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.summary).toMatchObject({ sourceCount: 1, retainedSourceCount: 1, checkedSourceCount: 1, successfulSourceCount: 1, everUsefulSourceCount: 1, usefulSourceCount: 0, latestUsefulSourceCount: 0, usefulWithin24hSourceCount: 1, sustainedUsefulSourceCount: 0, captureProducingSourceCount: 1, observedSourceCount: 1, failedSourceCount: 1, falsePositiveMeasuredSourceCount: 1 });
    expect(payload.sources[0]).toMatchObject({
      id: "src_ops_a",
      family: "vendor_blog",
      health: { state: "failed", collectionSuccessRate: 0.5, usefulYieldRate: 1, consecutiveFailures: 1, lastFailureCategory: "network_failure" },
      parser: { version: "vendor:v2", attemptCount: 1, successRate: 0, warningCount: 1 },
      quality: { falsePositiveRate: 0.5, falsePositiveSampleSize: 2, falsePositiveBasis: "evaluation_labels", duplicateRate: 0.5 },
      coverage: { observedActorCount: 1, observedActors: ["apt29"], captureCount: 1 },
      verification: { countsAsCoverage: true, automaticReview: { state: "approved", reviewedAt: now, confidence: 0.92, claimValidity: "supported", modelVersion: "hanasand-review-v6" } }
    });
    expect(JSON.stringify(payload)).not.toContain("private rationale");
    expect(JSON.stringify(payload)).not.toContain("secretexample.onion");
    expect(JSON.stringify(payload)).not.toContain("token=unsafe");

    const captures = await (await handleApiRequest(api("/v1/intel/captures", { headers: { "x-tenant-id": "tenant_a" } }), options)).json() as any;
    expect(captures.captures[0]).toMatchObject({ sourceId: "src_ops_a", sourceName: "Security RSS", sourceFamily: "vendor_blog" });

    const global = await handleApiRequest(authenticatedApi("/v1/intel/source-operations"), options);
    expect(await global.json() as any).toMatchObject({ tenantId: "global", summary: { sourceCount: 0, retainedSourceCount: 0 } });

    const mismatch = await handleApiRequest(api("/v1/intel/source-operations?tenantId=tenant_b", { headers: { "x-tenant-id": "tenant_a", "x-hanasand-service-token": "source-ops-test" } }), options);
    expect(mismatch.status).toBe(403);

    expect((await handleApiRequest(api("/v1/intel/source-operations"), options)).status).toBe(401);
  });

  test("does not report an unretained useful observation as useful coverage", async () => {
    const store = new InMemoryScraperStore();
    const checkedAt = new Date(Date.now() - 1_000).toISOString();
    store.saveSource(source({ id: "src_unretained" }));
    store.saveSourceHealthObservation({
      id: "health_unretained",
      sourceId: "src_unretained",
      collectionRunId: "run_without_capture",
      checkedAt,
      status: "healthy",
      success: true,
      useful: true,
      captureCount: 1,
      legalMode: "public_content"
    });

    const payload = await (await handleApiRequest(authenticatedApi("/v1/intel/source-operations"), {
      store,
      frontier: new FocusedFrontier(),
      serviceToken: "source-ops-test"
    })).json() as any;

    expect(payload.summary).toMatchObject({
      everUsefulSourceCount: 0,
      usefulSourceCount: 0,
      latestUsefulSourceCount: 0,
      usefulWithin24hSourceCount: 0
    });
    expect(payload.sources[0].health.lastUsefulItemAt).toBeUndefined();
    expect(payload.sources[0].qualification.latestCheckUseful).toBe(false);
    expect(payload.sources[0].qualification.lastUsefulAt).toBeUndefined();
  });

  test("reports historical retained usefulness without calling it recent", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_historical" }));
    store.saveCapture(fixtureCapture({
      id: "capture_historical",
      sourceId: "src_historical",
      collectedAt: "2020-07-23T10:00:00.000Z",
      metadata: { runId: "run_historical" }
    }));
    store.saveSourceHealthObservation({
      id: "health_historical",
      sourceId: "src_historical",
      collectionRunId: "run_historical",
      checkedAt: "2020-07-23T11:00:00.000Z",
      status: "healthy",
      success: true,
      useful: true,
      captureCount: 1,
      legalMode: "public_content"
    });

    const payload = await (await handleApiRequest(authenticatedApi("/v1/intel/source-operations"), {
      store,
      frontier: new FocusedFrontier(),
      serviceToken: "source-ops-test"
    })).json() as any;

    expect(payload.summary).toMatchObject({
      everUsefulSourceCount: 1,
      usefulSourceCount: 0,
      latestUsefulSourceCount: 0,
      usefulWithin24hSourceCount: 0
    });
    expect(payload.sources[0].health.lastUsefulItemAt).toBe("2020-07-23T11:00:00.000Z");
  });

  test("keeps 6,100-source totals exact while returning stable bounded pages", async () => {
    const store = new InMemoryScraperStore();
    for (let index = 0; index < 6_101; index++) {
      store.saveSource(source({ id: `src_scale_${String(index).padStart(5, "0")}`, name: `Scale ${String(index).padStart(5, "0")}` }));
    }
    const options = { store, frontier: new FocusedFrontier(), serviceToken: "source-ops-test" };
    const first = await (await handleApiRequest(authenticatedApi("/v1/intel/source-operations?limit=100"), options)).json() as any;
    const second = await (await handleApiRequest(authenticatedApi(`/v1/intel/source-operations?limit=100&cursor=${first.nextCursor}`), options)).json() as any;

    expect(first).toMatchObject({ total: 6_101, nextCursor: "100", summary: { sourceCount: 6_101 } });
    expect(first.sources).toHaveLength(100);
    expect(second.sources).toHaveLength(100);
    expect(second.sources[0].id).toBe("src_scale_00100");
    expect(new Set([...first.sources, ...second.sources].map((row: any) => row.id)).size).toBe(200);
  });

  test("uses one bounded operational query for exact sources beyond page one", async () => {
    const calls: any[] = [];
    const store = {
      querySourceOperationalPage: async (input: any) => {
        calls.push(input);
        return {
          rows: [{
            record: source({ id: "src_scale_06100", name: "Scale 06100" }),
            collection_executable: true,
            health_stats: { observationCount: 2, successCount: 2, usefulCycleCount: 2, successfulCycleCount: 2 },
            capture_stats: { captureCount: 4, observedDomains: [], resultTypes: [] },
            actor_stats: { count: 0, values: [] },
            label_stats: { classified: 0, falsePositive: 0 }
          }],
          totals: { sourceCount: 1, activeSourceCount: 1, retainedSourceCount: 1, sustainedUsefulSourceCount: 1 },
          total: 1
        };
      },
      listSources: () => { throw new Error("unbounded source read"); },
      listCaptures: () => { throw new Error("unbounded capture read"); }
    };
    const options = { store, frontier: new FocusedFrontier(), serviceToken: "source-ops-test" } as any;
    const payload = await (await handleApiRequest(authenticatedApi("/v1/intel/source-operations?sourceId=src_scale_06100"), options)).json() as any;

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ sourceId: "src_scale_06100", limit: undefined, offset: undefined });
    expect(payload.sources).toHaveLength(1);
    expect(payload.sources[0]).toMatchObject({ id: "src_scale_06100", coverage: { captureCount: 4 } });
  });

  test("does not qualify a page row whose automatic review evidence no longer matches", async () => {
    const store = {
      querySourceOperationalPage: async () => ({
        rows: [{
          record: source({
            id: "src_changed_review",
            countsAsCoverage: true,
            metadata: {
              productionCollection: true,
              sourceFeedDiscovery: { status: "accepted" },
              automaticSourceReview: {}
            }
          }),
          collection_executable: true,
          automatic_review_evidence_matches: false,
          health_stats: {
            observationCount: 3,
            scheduledCycleCount: 2,
            successCount: 2,
            usefulCycleCount: 2,
            successfulCycleCount: 2,
            latestUseful: true,
            latest: { checkedAt: new Date().toISOString(), success: true }
          },
          capture_stats: { captureCount: 2, lastContentAt: new Date().toISOString(), observedDomains: [], resultTypes: [] },
          actor_stats: { count: 0, values: [] },
          label_stats: { classified: 0, falsePositive: 0 }
        }],
        totals: { sourceCount: 1, qualifyingClearWebSourceCount: 0 },
        total: 1
      })
    };
    const payload = await (await handleApiRequest(authenticatedApi("/v1/intel/source-operations"), {
      store,
      frontier: new FocusedFrontier(),
      serviceToken: "source-ops-test"
    } as any)).json() as any;

    expect(payload.qualification.counts.clearWeb).toBe(0);
    expect(payload.sources[0].qualification).toMatchObject({
      qualifies: false,
      checkCount: 3,
      scheduledCheckCount: 2,
      reasons: expect.arrayContaining(["automatic_source_review_not_approved"])
    });
  });

  test("keeps duplicate-feed ownership when a memory lookup filters to one source", async () => {
    const store = new InMemoryScraperStore();
    const endpoint = "https://example.test/shared-feed.xml";
    const owner = source({ id: "src_owner", type: "rss", url: endpoint });
    const duplicate = source({ id: "src_duplicate", type: "api", url: endpoint });
    store.saveSource(owner);
    store.saveSource(duplicate);
    for (const [index, checkedAt] of [
      new Date(Date.now() - 2 * 3_600_000).toISOString(),
      new Date(Date.now() - 3_600_000).toISOString()
    ].entries()) {
      for (const sourceId of [owner.id, duplicate.id]) {
        const runId = `${sourceId}-run-${index}`;
        store.saveCapture(fixtureCapture({
          id: `${sourceId}-capture-${index}`,
          sourceId,
          collectedAt: checkedAt,
          publishedAt: checkedAt,
          metadata: { runId }
        }));
        store.saveSourceHealthObservation({
          id: `${sourceId}-health-${index}`,
          sourceId,
          collectionRunId: runId,
          checkedAt,
          status: "healthy",
          success: true,
          useful: true,
          captureCount: 1,
          legalMode: "public_content"
        });
      }
    }
    store.saveCapture(fixtureCapture({
      id: "src_owner-capture-extra",
      sourceId: owner.id,
      collectedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      publishedAt: new Date(Date.now() - 30 * 60_000).toISOString()
    }));
    const options = { store, frontier: new FocusedFrontier(), serviceToken: "source-ops-test" };
    const full = await (await handleApiRequest(authenticatedApi("/v1/intel/source-operations"), options)).json() as any;
    const direct = await (await handleApiRequest(authenticatedApi("/v1/intel/source-operations?sourceId=src_duplicate"), options)).json() as any;

    expect(full.sources.find((row: any) => row.id === duplicate.id).qualification.reasons).toContain("duplicate_feed");
    expect(direct.qualification.counts.clearWeb).toBe(0);
    expect(direct.sources[0].qualification).toMatchObject({ qualifies: false, reasons: expect.arrayContaining(["duplicate_feed"]) });
  });

  test("requires a source operator globally and exact admin membership for tenant operations", async () => {
    const store = new InMemoryScraperStore();
    store.saveOrganization({ id: "org_a", tenantId: "tenant_a", name: "A", status: "active" } as any);
    store.saveOrganization({ id: "org_b", tenantId: "tenant_b", name: "B", status: "active" } as any);
    store.saveOrganizationMember({ id: "member_admin_a", organizationId: "org_a", userId: "admin-a", role: "admin", status: "active" } as any);
    const options = {
      store,
      frontier: new FocusedFrontier(),
      authApiBase: "https://auth.example.test",
      authFetch: async (_url: unknown, init: any) => {
        const id = String(init.headers.authorization).includes("viewer") ? "viewer" : String(init.headers.authorization).includes("source-operator") ? "source-operator" : "admin-a";
        return Response.json({ id, roles: [{ id: id === "viewer" ? "viewer" : id === "source-operator" ? "source_operator" : "admin" }] });
      }
    };

    expect((await handleApiRequest(sessionApi("/v1/intel/source-operations", "viewer"), options as any)).status).toBe(403);
    expect((await handleApiRequest(sessionApi("/v1/intel/source-operations", "source-operator"), options as any)).status).toBe(200);
    expect((await handleApiRequest(sessionApi("/v1/intel/source-operations?tenantId=tenant_a", "admin-a", "tenant_a"), options as any)).status).toBe(200);
    expect((await handleApiRequest(sessionApi("/v1/intel/source-operations?tenantId=tenant_b", "admin-a", "tenant_b"), options as any)).status).toBe(403);
  });
});

function authenticatedApi(path: string, tenantId?: string) {
  return api(path, {
    headers: {
      "x-hanasand-service-token": "source-ops-test",
      ...(tenantId ? { "x-tenant-id": tenantId } : {})
    }
  });
}

function sessionApi(path: string, id: string, tenantId?: string) {
  return api(path, {
    headers: {
      authorization: `Bearer ${id}`,
      id,
      ...(tenantId ? { "x-tenant-id": tenantId } : {})
    }
  });
}
