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

    const response = await handleApiRequest(api("/v1/intel/source-operations", { headers: { "x-tenant-id": "tenant_a" } }), { store, frontier: new FocusedFrontier() });
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.summary).toMatchObject({ sourceCount: 1, observedSourceCount: 1, failedSourceCount: 1, falsePositiveMeasuredSourceCount: 1 });
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

    const mismatch = await handleApiRequest(api("/v1/intel/source-operations?tenantId=tenant_b", { headers: { "x-tenant-id": "tenant_a" } }), { store, frontier: new FocusedFrontier() });
    expect(mismatch.status).toBe(403);
  });
});
