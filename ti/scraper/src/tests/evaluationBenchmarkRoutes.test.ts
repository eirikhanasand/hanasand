import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
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
    const retainedBody = "APT29 (Cozy Bear) targeted Northwind Health.";
    store.saveCapture({ id: "cap_benchmark", tenantId: "tenant_benchmark", sourceId: "src_benchmark", url: "https://example.test/report", collectedAt: at, publishedAt: at, contentHash: hashContent(retainedBody), mediaType: "text/plain", storageKind: "inline_text", body: retainedBody, metadata: { safeExcerpt: "APT29 targeted Northwind Health.", extractionProfile: "ransomware_victim_blog", leakSite: { actorName: "APT29", victimName: "Northwind Health", claimedCountry: "" } }, sensitive: false });
    store.saveCapture({ id: "cap_metadata_only", tenantId: "tenant_benchmark", sourceId: "src_benchmark", url: "metadata://restricted/report", collectedAt: at, publishedAt: at, contentHash: hashContent("HALLUCINATED ACTOR"), mediaType: "text/plain", storageKind: "metadata_only", metadata: { safeExcerpt: "HALLUCINATED ACTOR", excerpt: "HALLUCINATED ACTOR" }, sensitive: true });
    store.saveExtractedEntity({ id: "entity_actor", tenantId: "tenant_benchmark", sourceId: "src_benchmark", captureId: "cap_benchmark", type: "actor", value: "APT29", normalizedValue: "apt29", confidence: 0.9 });
    store.saveExtractedEntity({ id: "entity_false_victim", tenantId: "tenant_benchmark", sourceId: "src_benchmark", captureId: "cap_benchmark", type: "victim", value: "WrongCo", normalizedValue: "wrongco", confidence: 0.5 });
    store.saveSource({ id: "src_benchmark_authority", tenantId: "tenant_benchmark", name: "Independent benchmark authority", type: "json_api", url: "https://authority.test/reference", accessMethod: "public_http", status: "active", risk: "low", trustScore: 1, crawlFrequencySeconds: 3600, legalNotes: "Separately retained authoritative reference.", metadata: { sourceFamily: "authoritative_reference" }, createdAt: at, updatedAt: at });
    const authorityBody = "Frozen actor: APT29. Frozen victim: Northwind Health.";
    store.saveCapture({ id: "cap_benchmark_authority", tenantId: "tenant_benchmark", sourceId: "src_benchmark_authority", url: "https://authority.test/reference", collectedAt: at, publishedAt: at, contentHash: hashContent(authorityBody), mediaType: "text/plain", storageKind: "inline_text", body: authorityBody, metadata: { parserVersion: "authority:v1" }, sensitive: false });
    for (const [labelType, expectedValues] of [["actor", ["APT29"]], ["victim", ["Northwind Health"]]] as const) {
      const canonical = expectedValues.map((value) => value.toLowerCase()).sort().join("\n");
      store.saveValidationRecord({
        id: `benchmark_reference_${labelType}`,
        tenantId: "tenant_benchmark",
        captureId: "cap_benchmark",
        validationType: "independent_evaluation_reference",
        status: "supported",
        referenceUrl: "https://authority.test/reference",
        referenceCaptureId: "cap_benchmark_authority",
        referenceSourceId: "src_benchmark_authority",
        referenceContentHash: hashContent(authorityBody),
        labelType,
        expectedValues: [...expectedValues],
        expectedValuesHash: createHash("sha256").update(JSON.stringify([labelType, canonical])).digest("hex"),
        exhaustiveExpectedValues: true,
        truthSchemaVersion: "ti.independent_evaluation_reference.v1",
        truthFrozenAt: "2026-07-21T08:30:00.000Z",
        matchedAt: "2026-07-21T08:30:00.000Z",
        reviewerId: "reference-curator"
      });
    }
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

    const createdResponse = await call("/v1/intel/evaluation/benchmarks", "reviewer_one", { tenantId: "tenant_benchmark", name: "Blind test", sampleSize: 1, labelTypes: ["actor", "victim"], requiredReviewers: 2 });
    const created = await createdResponse.json() as any;
    expect(createdResponse.status).toBe(201);
    expect(created.benchmark).toMatchObject({ status: "annotating", taskCount: 2, selectionSeedSource: "server_generated", protocol: { blinded: true, predictionHiddenFromReviewers: true }, progress: { pendingTaskCount: 2 } });
    expect(created.benchmark.manifest).toBeUndefined();
    expect(JSON.stringify(created)).not.toContain("observedValues");
    store.saveExtractedEntity({ id: "entity_late_victim", tenantId: "tenant_benchmark", sourceId: "src_benchmark", captureId: "cap_benchmark", type: "victim", value: "Northwind Health", normalizedValue: "northwind health", confidence: 1, extractorVersion: "changed-after-sampling" });

    const tasksResponse = await call(`/v1/intel/evaluation/benchmarks/${created.benchmark.id}/tasks`, "reviewer_one");
    const tasks = await tasksResponse.json() as any;
    expect(tasks.tasks).toHaveLength(2);
    expect(tasks.tasks[0]).toMatchObject({ protocol: { predictionHidden: true, exhaustiveExpectedValues: true }, evidence: { contentHash: expect.any(String) } });
    for (const forbidden of ["observedValue", "observedValues", "extractorVersion", "predictionValue"]) expect(JSON.stringify(tasks)).not.toContain(forbidden);

    const expected: Record<string, string[]> = { actor: ["APT29"], victim: ["Northwind Health"] };
    const actorTask = tasks.tasks.find((task: any) => task.labelType === "actor");
    const hallucinated = await call(`/v1/intel/evaluation/benchmarks/${created.benchmark.id}/annotations`, "hallucinating_reviewer", { tenantId: "tenant_benchmark", taskId: actorTask.id, expectedValues: ["HALLUCINATED ACTOR"], independenceAttested: true });
    expect(hallucinated.status).toBe(400);
    expect(await hallucinated.json()).toMatchObject({ error: { code: "annotation_value_not_grounded" } });
    for (const task of tasks.tasks) {
      expect((await call(`/v1/intel/evaluation/benchmarks/${created.benchmark.id}/annotations`, "reviewer_one", { tenantId: "tenant_benchmark", taskId: task.id, expectedValues: expected[task.labelType], independenceAttested: true })).status).toBe(201);
    }
    const secondReviewerView = await (await call(`/v1/intel/evaluation/benchmarks/${created.benchmark.id}/tasks`, "reviewer_two")).json() as any;
    expect(JSON.stringify(secondReviewerView)).not.toContain("expectedValues");
    for (const task of secondReviewerView.tasks) {
      expect((await call(`/v1/intel/evaluation/benchmarks/${created.benchmark.id}/annotations`, "reviewer_two", { tenantId: "tenant_benchmark", taskId: task.id, expectedValues: expected[task.labelType], independenceAttested: true })).status).toBe(201);
    }

    const completed = await (await call("/v1/intel/evaluation/benchmarks", "reviewer_one")).json() as any;
    expect(completed.benchmarks[0]).toMatchObject({ status: "complete", progress: { adjudicatedTaskCount: 2, reviewerCount: 2, exactSetAgreement: 1 } });
    expect(store.listEvaluationLabels().map((label: any) => label.outcome).sort()).toEqual(["false_negative", "false_positive", "true_positive"]);
    expect(store.listEvaluationLabels().every((label: any) => label.blinded && label.adjudicationStatus === "adjudicated" && label.exhaustiveExpectedValues)).toBe(true);
    expect(store.listEvaluationLabels().map((label: any) => label.predictionConfidence).sort()).toEqual([0, 0.5, 0.9]);

    const metrics = buildEvaluationMetrics(store, { tenantId: "tenant_benchmark", datasetSplit: "test" });
    expect(metrics.quality).toMatchObject({ overall: { precision: 0.5, recall: 0.5, specificity: 0, recallSampleSize: 2, f1: 0.5 }, benchmarkEvidence: { completedBenchmarkCount: 1, completedTaskCount: 2, completedCaptureCount: 1, reviewerCount: 2, heldOutBenchmarkCount: 1, heldOutCaptureCount: 1, heldOutReviewerCount: 2, validationStatus: "pilot_only" } });
    expect(metrics.limitations).not.toContain("recall is unmeasured until an exhaustive prediction-hidden benchmark is adjudicated");

    const disputed = await (await call("/v1/intel/evaluation/benchmarks", "reviewer_three", { tenantId: "tenant_benchmark", name: "Adjudication test", sampleSize: 1, labelTypes: ["actor"], requiredReviewers: 2 })).json() as any;
    const [disputedTask] = (await (await call(`/v1/intel/evaluation/benchmarks/${disputed.benchmark.id}/tasks`, "reviewer_three")).json() as any).tasks;
    expect((await call(`/v1/intel/evaluation/benchmarks/${disputed.benchmark.id}/annotations`, "reviewer_three", { tenantId: "tenant_benchmark", taskId: disputedTask.id, expectedValues: [], independenceAttested: true })).status).toBe(201);
    expect((await call(`/v1/intel/evaluation/benchmarks/${disputed.benchmark.id}/annotations`, "reviewer_four", { tenantId: "tenant_benchmark", taskId: disputedTask.id, expectedValues: ["APT29"], independenceAttested: true })).status).toBe(201);
    expect((await call(`/v1/intel/evaluation/benchmarks/${disputed.benchmark.id}/tasks/${disputedTask.id}/adjudicate`, "reviewer_three", { tenantId: "tenant_benchmark", expectedValues: ["APT29"], independenceAttested: true })).status).toBe(409);
    const adjudicated = await call(`/v1/intel/evaluation/benchmarks/${disputed.benchmark.id}/tasks/${disputedTask.id}/adjudicate`, "reviewer_five", { tenantId: "tenant_benchmark", expectedValues: ["APT29"], independenceAttested: true });
    expect(adjudicated.status).toBe(201);
    expect(await adjudicated.json()).toMatchObject({ adjudication: { method: "independent_adjudicator", adjudicatedBy: "reviewer_five" }, predictionDisclosed: false });

    const changed = await (await call("/v1/intel/evaluation/benchmarks", "reviewer_one", { tenantId: "tenant_benchmark", sampleSize: 1, labelTypes: ["actor"] })).json() as any;
    const [changedTask] = (await (await call(`/v1/intel/evaluation/benchmarks/${changed.benchmark.id}/tasks`, "reviewer_one")).json() as any).tasks;
    const changedStored = store.getEvaluationBenchmark(changed.benchmark.id)!;
    store.saveEvaluationBenchmark({ ...changedStored, manifest: changedStored.manifest!.map((task: any) => task.id === changedTask.id ? { ...task, excerptHash: "changed-after-sampling" } : task) });
    const changedView = await (await call(`/v1/intel/evaluation/benchmarks/${changed.benchmark.id}/tasks`, "reviewer_one")).json() as any;
    expect(changedView.tasks[0].evidence).toMatchObject({ unavailable: true, reason: "evidence_changed_after_sampling" });
    expect((await call(`/v1/intel/evaluation/benchmarks/${changed.benchmark.id}/annotations`, "reviewer_one", { tenantId: "tenant_benchmark", taskId: changedTask.id, expectedValues: [], independenceAttested: true })).status).toBe(409);

    const metadataOnlyStore = new InMemoryScraperStore();
    metadataOnlyStore.saveSource(store.getSource("src_benchmark")!);
    metadataOnlyStore.saveCapture(store.getCapture("cap_metadata_only")!);
    const metadataOnlyResponse = await handleApiRequest(new Request("http://local/v1/intel/evaluation/benchmarks", {
      method: "POST",
      headers: { authorization: "Bearer test", id: "reviewer_one", "x-tenant-id": "tenant_benchmark", "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "tenant_benchmark", sampleSize: 1, labelTypes: ["actor"] })
    }), { ...options, store: metadataOnlyStore });
    expect(metadataOnlyResponse.status).toBe(409);
    expect(await metadataOnlyResponse.json()).toMatchObject({ error: { code: "benchmark_corpus_empty" } });

    for (const [id, type, value] of [
      ["entity_ransomware", "ransomware_family", "Akira"], ["entity_cve", "cve", "CVE-2026-11111"],
      ["entity_malware", "malware", "Cobalt Strike"], ["entity_country", "country", "Norway"],
      ["entity_sector", "sector", "healthcare"], ["entity_impact", "impact", "data theft"], ["entity_dataset", "dataset", "customer records"]
    ]) store.saveExtractedEntity({ id, tenantId: "tenant_benchmark", sourceId: "src_benchmark", captureId: "cap_benchmark", type, value, normalizedValue: String(value).toLowerCase(), confidence: 0.7, extractorVersion: "comprehensive-parser" });
    const comprehensiveResponse = await call("/v1/intel/evaluation/benchmarks", "reviewer_one", { tenantId: "tenant_benchmark", name: "Comprehensive test", sampleSize: 1, requiredReviewers: 2 });
    const comprehensive = await comprehensiveResponse.json() as any;
    expect(comprehensiveResponse.status).toBe(201);
    expect(comprehensive.benchmark).toMatchObject({ taskCount: 2, labelTypes: ["actor", "ransomware", "victim", "incident", "cve", "malware", "ttp", "country", "sector", "indicator", "impact", "dataset", "business_mechanism"], protocol: { version: "ti.independent_extraction_benchmark.v4", datasetUsage: "locked_final_evaluation", reviewerIndependenceAttestationRequired: true }, progress: { diagnostics: { contextOnlyTaskCount: 11 } } });
    const manifest = store.getEvaluationBenchmark(comprehensive.benchmark.id)!.manifest!;
    for (const labelType of comprehensive.benchmark.labelTypes) expect(manifest.find((task: any) => task.labelType === labelType)).toBeDefined();
    const comprehensiveTasks = await (await call(`/v1/intel/evaluation/benchmarks/${comprehensive.benchmark.id}/tasks`, "reviewer_one")).text();
    for (const forbidden of ["observedPredictions", "observedValues", "predictionConfidence", "comprehensive-parser"]) expect(comprehensiveTasks).not.toContain(forbidden);

    const unattested = await call(`/v1/intel/evaluation/benchmarks/${comprehensive.benchmark.id}/annotations`, "reviewer_one", { tenantId: "tenant_benchmark", taskId: manifest[0].id, expectedValues: [] });
    expect(unattested.status).toBe(400);
    expect(await unattested.json()).toMatchObject({ error: { code: "reviewer_independence_required" } });

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
