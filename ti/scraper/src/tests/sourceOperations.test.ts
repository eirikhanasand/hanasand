import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { api, source } from "./helpers/apiSourceFixtures.ts";
import { fixtureCapture } from "./helpers/storageFixtures.ts";

describe("source operations", () => {
  test("summarizes persisted health safely inside the requested tenant", async () => {
    const store = new InMemoryScraperStore();
    const now = new Date().toISOString();
    store.saveSource({ ...source({ id: "src_ops_a", metadata: { sourceFamily: "vendor_blog", parserVersion: "vendor:v2" } }), tenantId: "tenant_a" });
    store.saveSource({ ...source({ id: "src_ops_b" }), tenantId: "tenant_b" });
    store.saveCapture(fixtureCapture({ id: "cap_ops_a", tenantId: "tenant_a", sourceId: "src_ops_a", collectedAt: now }));
    store.saveExtractedEntity({ id: "entity_ops_a", tenantId: "tenant_a", sourceId: "src_ops_a", captureId: "cap_ops_a", type: "actor", value: "APT29", normalizedValue: "apt29" });
    store.saveEvaluationLabel({ id: "label_tp", tenantId: "tenant_a", captureId: "cap_ops_a", outcome: "true_positive" });
    store.saveEvaluationLabel({ id: "label_fp", tenantId: "tenant_a", captureId: "cap_ops_a", outcome: "false_positive" });
    store.saveSourceHealthObservation({ id: "health_ok", tenantId: "tenant_a", sourceId: "src_ops_a", checkedAt: now, status: "degraded", success: true, useful: true, itemCount: 2, captureCount: 1, duplicateCount: 1, parserWarningCount: 1, legalMode: "public_content" });
    store.saveSourceHealthObservation({ id: "health_failed", tenantId: "tenant_a", sourceId: "src_ops_a", checkedAt: new Date(Date.now() + 1_000).toISOString(), status: "failed", success: false, useful: false, itemCount: 0, captureCount: 0, duplicateCount: 0, parserWarningCount: 0, adapterFailureCategory: "network_failure", failureReason: "fetch https://secretexample.onion/post?token=unsafe failed", legalMode: "public_content" });
    store.saveSourceHealthObservation({ id: "health_other_tenant", tenantId: "tenant_b", sourceId: "src_ops_b", checkedAt: now, status: "healthy", success: true, useful: true, itemCount: 1, captureCount: 1, duplicateCount: 0, parserWarningCount: 0, legalMode: "public_content" });

    const options = { store, frontier: new FocusedFrontier(), serviceToken: "source-ops-test" };
    const response = await handleApiRequest(authenticatedApi("/v1/intel/source-operations", "tenant_a"), options);
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.summary).toMatchObject({ sourceCount: 1, retainedSourceCount: 1, checkedSourceCount: 1, successfulSourceCount: 1, usefulSourceCount: 0, sustainedUsefulSourceCount: 0, captureProducingSourceCount: 1, observedSourceCount: 1, failedSourceCount: 1, falsePositiveMeasuredSourceCount: 1 });
    expect(payload.sources[0]).toMatchObject({
      id: "src_ops_a",
      family: "vendor_blog",
      health: { state: "failed", collectionSuccessRate: 0.5, usefulYieldRate: 1, consecutiveFailures: 1, lastFailureCategory: "network_failure" },
      parser: { version: "vendor:v2", attemptCount: 1, successRate: 0, warningCount: 1 },
      quality: { falsePositiveRate: 0.5, falsePositiveSampleSize: 2, falsePositiveBasis: "evaluation_labels", duplicateRate: 0.5 },
      coverage: { observedActorCount: 1, observedActors: ["apt29"], captureCount: 1 }
    });
    expect(JSON.stringify(payload)).not.toContain("secretexample.onion");
    expect(JSON.stringify(payload)).not.toContain("token=unsafe");

    const global = await handleApiRequest(authenticatedApi("/v1/intel/source-operations"), options);
    expect(await global.json() as any).toMatchObject({ tenantId: "global", summary: { sourceCount: 0, retainedSourceCount: 0 } });

    const mismatch = await handleApiRequest(api("/v1/intel/source-operations?tenantId=tenant_b", { headers: { "x-tenant-id": "tenant_a", "x-hanasand-service-token": "source-ops-test" } }), options);
    expect(mismatch.status).toBe(403);

    expect((await handleApiRequest(api("/v1/intel/source-operations"), options)).status).toBe(401);
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
