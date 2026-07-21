import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { buildEvaluationMetrics } from "../pipeline/evaluationMetrics.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { hashContent } from "../utils.ts";

describe("independent evaluation benchmark", () => {
  test("hides predictions and materializes exhaustive labels only after two-reviewer consensus", async () => {
    const store = new InMemoryScraperStore();
    const at = "2026-07-21T08:00:00.000Z";
    store.saveSource({ id: "src_benchmark", tenantId: "tenant_benchmark", name: "Public report", type: "rss", url: "https://example.test/feed", accessMethod: "public_http", status: "active", risk: "low", trustScore: 0.8, crawlFrequencySeconds: 3600, legalNotes: "Public evaluation source.", metadata: { sourceFamily: "vendor" }, createdAt: at, updatedAt: at });
    store.saveCapture({ id: "cap_benchmark", tenantId: "tenant_benchmark", sourceId: "src_benchmark", url: "https://example.test/report", collectedAt: at, publishedAt: at, contentHash: hashContent("APT29 targeted Northwind Health."), mediaType: "text/plain", storageKind: "inline_text", body: "APT29 targeted Northwind Health.", metadata: {}, sensitive: false });
    store.saveExtractedEntity({ id: "entity_actor", tenantId: "tenant_benchmark", sourceId: "src_benchmark", captureId: "cap_benchmark", type: "actor", value: "APT29", normalizedValue: "apt29", confidence: 0.9 });
    store.saveExtractedEntity({ id: "entity_false_ttp", tenantId: "tenant_benchmark", sourceId: "src_benchmark", captureId: "cap_benchmark", type: "ttp", value: "ransomware activity", normalizedValue: "ransomware activity", confidence: 0.5 });
    const options = {
      store,
      frontier: new FocusedFrontier(),
      authApiBase: "http://auth.test/api",
      authFetch: async (input: RequestInfo | URL) => {
        const id = new URL(String(input)).pathname.split("/").at(-1);
        return Response.json({ id, roles: [{ id: "analyst" }] });
      }
    } as any;
    const call = (path: string, reviewerId: string, payload?: unknown) => handleApiRequest(new Request(`http://local${path}`, {
      method: payload === undefined ? "GET" : "POST",
      headers: { authorization: "Bearer test", id: reviewerId, "x-tenant-id": "tenant_benchmark", ...(payload === undefined ? {} : { "content-type": "application/json" }) },
      body: payload === undefined ? undefined : JSON.stringify(payload)
    }), options);

    const createdResponse = await call("/v1/intel/evaluation/benchmarks", "reviewer_one", { tenantId: "tenant_benchmark", name: "Blind test", sampleSize: 1, labelTypes: ["actor", "victim", "ttp", "impact"], requiredReviewers: 2 });
    const created = await createdResponse.json() as any;
    expect(createdResponse.status).toBe(201);
    expect(created.benchmark).toMatchObject({ status: "annotating", taskCount: 4, selectionSeedSource: "server_generated", protocol: { blinded: true, predictionHiddenFromReviewers: true }, progress: { pendingTaskCount: 4 } });
    expect(created.benchmark.manifest).toBeUndefined();
    expect(JSON.stringify(created)).not.toContain("observedValues");
    store.saveExtractedEntity({ id: "entity_late_victim", tenantId: "tenant_benchmark", sourceId: "src_benchmark", captureId: "cap_benchmark", type: "victim", value: "Northwind Health", normalizedValue: "northwind health", confidence: 1, extractorVersion: "changed-after-sampling" });

    const tasksResponse = await call(`/v1/intel/evaluation/benchmarks/${created.benchmark.id}/tasks`, "reviewer_one");
    const tasks = await tasksResponse.json() as any;
    expect(tasks.tasks).toHaveLength(4);
    expect(tasks.tasks[0]).toMatchObject({ protocol: { predictionHidden: true, exhaustiveExpectedValues: true }, evidence: { contentHash: expect.any(String) } });
    for (const forbidden of ["observedValue", "observedValues", "extractorVersion", "predictionValue"]) expect(JSON.stringify(tasks)).not.toContain(forbidden);

    const expected: Record<string, string[]> = { actor: ["APT29"], victim: ["Northwind Health"], ttp: [], impact: [] };
    for (const task of tasks.tasks) {
      expect((await call(`/v1/intel/evaluation/benchmarks/${created.benchmark.id}/annotations`, "reviewer_one", { tenantId: "tenant_benchmark", taskId: task.id, expectedValues: expected[task.labelType] })).status).toBe(201);
    }
    const secondReviewerView = await (await call(`/v1/intel/evaluation/benchmarks/${created.benchmark.id}/tasks`, "reviewer_two")).json() as any;
    expect(JSON.stringify(secondReviewerView)).not.toContain("expectedValues");
    for (const task of secondReviewerView.tasks) {
      expect((await call(`/v1/intel/evaluation/benchmarks/${created.benchmark.id}/annotations`, "reviewer_two", { tenantId: "tenant_benchmark", taskId: task.id, expectedValues: expected[task.labelType] })).status).toBe(201);
    }

    const completed = await (await call("/v1/intel/evaluation/benchmarks", "reviewer_one")).json() as any;
    expect(completed.benchmarks[0]).toMatchObject({ status: "complete", progress: { adjudicatedTaskCount: 4, reviewerCount: 2, exactSetAgreement: 1 } });
    expect(store.listEvaluationLabels().map((label: any) => label.outcome).sort()).toEqual(["false_negative", "false_positive", "true_negative", "true_positive"]);
    expect(store.listEvaluationLabels().every((label: any) => label.blinded && label.adjudicationStatus === "adjudicated" && label.exhaustiveExpectedValues)).toBe(true);

    const metrics = buildEvaluationMetrics(store, { tenantId: "tenant_benchmark", datasetSplit: "test" });
    expect(metrics.quality).toMatchObject({ overall: { precision: 0.5, recall: 0.5, specificity: 0.5, recallSampleSize: 2, f1: 0.5 }, benchmarkEvidence: { completedBenchmarkCount: 1, completedTaskCount: 4, completedCaptureCount: 1, reviewerCount: 2, validationStatus: "pilot_only" } });
    expect(metrics.limitations).not.toContain("recall is unmeasured until an exhaustive prediction-hidden benchmark is adjudicated");

    const disputed = await (await call("/v1/intel/evaluation/benchmarks", "reviewer_three", { tenantId: "tenant_benchmark", name: "Adjudication test", sampleSize: 1, labelTypes: ["actor"], requiredReviewers: 2 })).json() as any;
    const [disputedTask] = (await (await call(`/v1/intel/evaluation/benchmarks/${disputed.benchmark.id}/tasks`, "reviewer_three")).json() as any).tasks;
    expect((await call(`/v1/intel/evaluation/benchmarks/${disputed.benchmark.id}/annotations`, "reviewer_three", { tenantId: "tenant_benchmark", taskId: disputedTask.id, expectedValues: ["APT28"] })).status).toBe(201);
    expect((await call(`/v1/intel/evaluation/benchmarks/${disputed.benchmark.id}/annotations`, "reviewer_four", { tenantId: "tenant_benchmark", taskId: disputedTask.id, expectedValues: ["APT29"] })).status).toBe(201);
    expect((await call(`/v1/intel/evaluation/benchmarks/${disputed.benchmark.id}/tasks/${disputedTask.id}/adjudicate`, "reviewer_three", { tenantId: "tenant_benchmark", expectedValues: ["APT29"] })).status).toBe(409);
    const adjudicated = await call(`/v1/intel/evaluation/benchmarks/${disputed.benchmark.id}/tasks/${disputedTask.id}/adjudicate`, "reviewer_five", { tenantId: "tenant_benchmark", expectedValues: ["APT29"] });
    expect(adjudicated.status).toBe(201);
    expect(await adjudicated.json()).toMatchObject({ adjudication: { method: "independent_adjudicator", adjudicatedBy: "reviewer_five" }, predictionDisclosed: false });

    const changed = await (await call("/v1/intel/evaluation/benchmarks", "reviewer_one", { tenantId: "tenant_benchmark", sampleSize: 1, labelTypes: ["impact"] })).json() as any;
    const [changedTask] = (await (await call(`/v1/intel/evaluation/benchmarks/${changed.benchmark.id}/tasks`, "reviewer_one")).json() as any).tasks;
    store.updateCaptureMetadata("cap_benchmark", (metadata) => ({ ...metadata, safeExcerpt: "Evidence changed after benchmark creation." }));
    const changedView = await (await call(`/v1/intel/evaluation/benchmarks/${changed.benchmark.id}/tasks`, "reviewer_one")).json() as any;
    expect(changedView.tasks[0].evidence).toMatchObject({ unavailable: true, reason: "evidence_changed_after_sampling" });
    expect((await call(`/v1/intel/evaluation/benchmarks/${changed.benchmark.id}/annotations`, "reviewer_one", { tenantId: "tenant_benchmark", taskId: changedTask.id, expectedValues: [] })).status).toBe(409);

    const serviceOptions = { ...options, serviceToken: "evaluation-service-token" };
    const serviceCreate = await handleApiRequest(new Request("http://local/v1/intel/evaluation/benchmarks", {
      method: "POST", headers: { "content-type": "application/json", "x-hanasand-service-token": "evaluation-service-token", "x-tenant-id": "tenant_benchmark" }, body: JSON.stringify({ sampleSize: 1, labelTypes: ["actor"] })
    }), serviceOptions);
    const serviceBenchmark = await serviceCreate.json() as any;
    expect(serviceCreate.status).toBe(201);
    const serviceTasks = await handleApiRequest(new Request(`http://local/v1/intel/evaluation/benchmarks/${serviceBenchmark.benchmark.id}/tasks`, { headers: { "x-hanasand-service-token": "evaluation-service-token", "x-tenant-id": "tenant_benchmark" } }), serviceOptions);
    expect(serviceTasks.status).toBe(403);
  });
});
