import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { buildEvaluationMetrics } from "../pipeline/evaluationMetrics.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { hashContent } from "../utils.ts";

describe("durable evaluation metrics", () => {
  test("reports tenant-scoped precision, recall, timeliness, coverage, and immutable labels", async () => {
    const store = new InMemoryScraperStore();
    const at = "2026-07-20T00:00:00.000Z";
    store.saveSource({ id: "src_eval", tenantId: "tenant_eval", name: "Evaluation feed", type: "rss", url: "https://example.test/feed", accessMethod: "public_http", status: "active", risk: "low", trustScore: 0.8, crawlFrequencySeconds: 3600, legalNotes: "Public evaluation source.", metadata: { sourceFamily: "government_advisory" }, createdAt: at, updatedAt: at });
    const saved = store.savePipelineResult(processCollectedItem({ tenantId: "tenant_eval", sourceId: "src_eval", url: "https://example.test/report", collectedAt: at, publishedAt: "2026-07-19T23:58:00.000Z", rawText: "APT29 used phishing against Northwind Health.", contentHash: hashContent("evaluation"), links: [], metadata: {}, sensitive: false }));
    const actor = store.listExtractedEntities().find((entity: any) => entity.type === "actor");
    const falsePositive = store.saveExtractedEntity({ id: "entity_false_positive", tenantId: "tenant_eval", sourceId: "src_eval", captureId: saved.capture.id, type: "ttp", value: "password spraying", extractorVersion: "test-parser", confidence: 0.6 });
    const labels = [
      { id: "label_tp", tenantId: "tenant_eval", benchmarkId: "benchmark_eval", taskId: "task_tp", entityId: actor.id, labelType: "actor_extraction", expectedValue: "APT29", observedValue: "APT29", outcome: "true_positive", predictionConfidence: 0.9, datasetSplit: "test", labeledBy: "analyst", labelingMethod: "manual_source_review", independentFromExtractor: true, exhaustiveExpectedValues: true, blinded: true, adjudicationStatus: "adjudicated", labeledAt: at },
      { id: "label_fp", tenantId: "tenant_eval", benchmarkId: "benchmark_eval", taskId: "task_fp", entityId: falsePositive.id, labelType: "ttp_extraction", observedValue: "password spraying", outcome: "false_positive", predictionConfidence: 0.6, datasetSplit: "test", labeledBy: "analyst", labelingMethod: "manual_source_review", independentFromExtractor: true, exhaustiveExpectedValues: true, blinded: true, adjudicationStatus: "adjudicated", labeledAt: at },
      { id: "label_fn", tenantId: "tenant_eval", benchmarkId: "benchmark_eval", taskId: "task_fn", captureId: saved.capture.id, labelType: "victim_extraction", expectedValue: "Missing Victim Ltd", outcome: "false_negative", predictionConfidence: 0, datasetSplit: "test", labeledBy: "analyst", labelingMethod: "manual_source_review", independentFromExtractor: true, exhaustiveExpectedValues: true, blinded: true, adjudicationStatus: "adjudicated", labeledAt: at }
    ];
    for (const label of labels) store.saveEvaluationLabel(label);
    store.saveEvaluationBenchmark({ id: "benchmark_eval", tenantId: "tenant_eval", name: "Held-out evaluation", status: "complete", datasetSplit: "test", taskCount: 3, captureIds: [saved.capture.id], protocol: { testSplitLocked: true, datasetUsage: "locked_final_evaluation" } });
    store.saveEvaluationAnnotation({ id: "annotation_one", tenantId: "tenant_eval", benchmarkId: "benchmark_eval", taskId: "task_tp", reviewerId: "reviewer_one" });
    store.saveEvaluationAnnotation({ id: "annotation_two", tenantId: "tenant_eval", benchmarkId: "benchmark_eval", taskId: "task_tp", reviewerId: "reviewer_two" });
    for (const taskId of ["task_tp", "task_fp", "task_fn"]) store.saveEvaluationAdjudication({ id: `adjudication_${taskId}`, tenantId: "tenant_eval", benchmarkId: "benchmark_eval", taskId });
    store.saveEvaluationLabel({ ...labels[0], id: "label_other_tenant", tenantId: "tenant_other", entityId: "entity_other" });
    store.saveTimelinessRecord({ id: saved.incident.id, tenantId: "tenant_eval", sourceId: "src_eval", captureId: saved.capture.id, incidentId: saved.incident.id, alertedAt: "2026-07-20T00:03:00.000Z", latencies: { publicationToCollectionSeconds: 120, collectionToProcessingSeconds: 2, processingToVisibilitySeconds: 1, reportToVisibilitySeconds: 123, visibilityToAlertSeconds: 177, reportToAlertSeconds: 300 }, timestampAnomalies: [] });
    store.saveSourceHealthObservation({ id: "health_eval", tenantId: "tenant_eval", sourceId: "src_eval", checkedAt: at, status: "healthy", success: true, useful: true, itemCount: 4, duplicateCount: 1, legalMode: "public_content" });
    store.saveValidationRecord({ id: "validation_eval", tenantId: "tenant_eval", incidentId: saved.incident.id, validationType: "victim_disclosure", status: "supported", referenceUrl: "https://northwind.example/security", matchedAt: at });

    const response = await handleApiRequest(new Request("http://local/v1/intel/evaluation?datasetSplit=test", { headers: { "x-tenant-id": "tenant_eval" } }), { store, frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(body.quality).toMatchObject({ labelEventCount: 3, evaluatedUnitCount: 3, overall: { truePositive: 1, falsePositive: 1, falseNegative: 1, precision: 0.5, recall: 0.5, f1: 0.5, calibration: { sampleSize: 3, brierScore: 0.457, expectedCalibrationError: 0.567 } }, errorBreakdown: { byOutcome: { true_positive: 1, false_positive: 1, false_negative: 1 } } });
    expect(body.timeliness.overall.reportToAlertSeconds).toEqual({ sampleSize: 1, medianSeconds: 300, p95Seconds: 300 });
    expect(body.coverage).toMatchObject({ activeSourceCount: 1, attemptedSourceCount: 1, successfulSourceCount: 1, usefulSourceCount: 1, actorCount: 1, sourceAttemptCount: 1, activeSourceReliabilityRate: 1, usefulAttemptRate: 1, duplicateObservationCount: 1, duplicationRate: 0.25, falsePositiveRate: 0.333, falsePositiveSampleSize: 3 });
    expect(body.validation).toMatchObject({ recordCount: 1, statuses: { supported: 1 }, referenceHostCount: 1 });
    expect(() => store.saveEvaluationLabel({ ...labels[0], outcome: "false_positive" })).toThrow("Evaluation label is immutable");
  });

  test("keeps automated parity labels out of independent accuracy", () => {
    const store = new InMemoryScraperStore();
    store.saveEvaluationLabel({ id: "label_parity", captureId: "capture_parity", labelType: "cve_extraction", outcome: "true_positive", datasetSplit: "test", labeledBy: "cisa-kev-authoritative-v1", labelingMethod: "source_field_parity", independentFromExtractor: false, labeledAt: "2026-07-20T00:00:00.000Z" });
    store.saveEvaluationLabel({ id: "label_unblinded_manual", captureId: "capture_manual", labelType: "actor_extraction", outcome: "true_positive", datasetSplit: "test", labeledBy: "analyst", labelingMethod: "manual_source_review", independentFromExtractor: true, labeledAt: "2026-07-20T00:00:00.000Z" });

    const metrics = buildEvaluationMetrics(store, { datasetSplit: "test" });
    expect(metrics.quality).toMatchObject({ status: "diagnostic_only", evaluatedUnitCount: 0, diagnosticUnitCount: 2, overall: { precision: null, recall: null } });
    expect(metrics.quality.diagnostics.overall).toMatchObject({ truePositive: 2, precision: 1, recall: null, f1: null });
    expect(metrics.limitations).toContain("no independently reviewed evaluation labels in scope; automated checks are diagnostic only");
  });

  test("requires a complete stratified held-out benchmark before reporting validation", () => {
    const store = new InMemoryScraperStore();
    const labelTypes = ["actor", "ransomware", "victim", "cve", "malware", "ttp", "country", "sector", "impact", "dataset"];
    const captureIds = Array.from({ length: 50 }, (_, index) => `capture_${index}`);
    const taskIds = labelTypes.flatMap((labelType) => Array.from({ length: 10 }, (_, index) => `${labelType}_${index}`));
    store.saveEvaluationBenchmark({ id: "benchmark_stratified", status: "complete", datasetSplit: "test", taskCount: taskIds.length, captureIds, protocol: { testSplitLocked: true, datasetUsage: "locked_final_evaluation" } });
    store.saveEvaluationAnnotation({ id: "review_one", benchmarkId: "benchmark_stratified", taskId: taskIds[0], reviewerId: "reviewer_one" });
    store.saveEvaluationAnnotation({ id: "review_two", benchmarkId: "benchmark_stratified", taskId: taskIds[0], reviewerId: "reviewer_two" });
    for (const taskId of taskIds) store.saveEvaluationAdjudication({ id: `adjudication_${taskId}`, benchmarkId: "benchmark_stratified", taskId });
    for (const labelType of labelTypes) for (let index = 0; index < 10; index++) store.saveEvaluationLabel({
      id: `label_${labelType}_${index}`, benchmarkId: "benchmark_stratified", taskId: `${labelType}_${index}`, evaluationUnitId: `${labelType}_${index}`,
      captureId: captureIds[index % captureIds.length], labelType: `${labelType}_extraction`, outcome: index < 5 ? "true_positive" : "true_negative", predictionConfidence: index < 5 ? 0.8 : 0,
      datasetSplit: "test", labeledBy: "consensus", labelingMethod: "manual_source_review", independentFromExtractor: true, exhaustiveExpectedValues: true, blinded: true, adjudicationStatus: "adjudicated", labeledAt: "2026-07-21T00:00:00.000Z"
    });

    const metrics = buildEvaluationMetrics(store, { datasetSplit: "test" });
    expect(metrics.quality.benchmarkEvidence).toMatchObject({ validationStatus: "validated", heldOutCaptureCount: 50, heldOutReviewerCount: 2, stratifiedCoverageComplete: true });
    expect(metrics.quality.benchmarkEvidence.labelTypeCoverage).toEqual(labelTypes.map((name) => ({ name, sampleSize: 10, positiveCount: 5, negativeCount: 5 })));
  });
});
