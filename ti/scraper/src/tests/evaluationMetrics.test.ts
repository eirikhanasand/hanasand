import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { buildEvaluationMetrics } from "../pipeline/evaluationMetrics.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { hashContent } from "../utils.ts";
import { actorIdentity } from "./apiTestHarness.ts";

describe("durable evaluation metrics", () => {
  test("reports tenant-scoped precision, recall, timeliness, coverage, and immutable labels", async () => {
    const store = new InMemoryScraperStore();
    const at = "2026-07-20T00:00:00.000Z";
    store.saveSource({ id: "src_eval", tenantId: "tenant_eval", name: "Evaluation feed", type: "rss", url: "https://example.test/feed", accessMethod: "public_http", status: "active", risk: "low", trustScore: 0.8, crawlFrequencySeconds: 3600, legalNotes: "Public evaluation source.", metadata: { sourceFamily: "government_advisory" }, createdAt: at, updatedAt: at });
    const saved = store.savePipelineResult(processCollectedItem({ tenantId: "tenant_eval", sourceId: "src_eval", url: "https://example.test/report", collectedAt: at, publishedAt: "2026-07-19T23:58:00.000Z", rawText: "APT29 used phishing against Northwind Health.", contentHash: hashContent("evaluation"), links: [], metadata: {}, sensitive: false }, {
      actorIdentities: [actorIdentity("G0016", "APT29", ["Nobelium", "Cozy Bear", "Midnight Blizzard"])]
    }));
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

  test("reports complete source-backed latency by source family, actor, and pipeline stage", () => {
    const store = new InMemoryScraperStore();
    store.saveSource({ id: "src_timing", name: "Publisher feed", type: "rss", url: "https://publisher.example/feed", accessMethod: "public_http", status: "active", risk: "low", trustScore: 0.8, crawlFrequencySeconds: 300, legalNotes: "Public source.", metadata: { sourceFamily: "public_news" }, createdAt: "2026-07-20T09:00:00.000Z", updatedAt: "2026-07-20T09:00:00.000Z" });
    store.saveExtractedEntity({ id: "entity_timing_actor", sourceId: "src_timing", captureId: "capture_timing", type: "actor", value: "APT29" });
    store.saveTimelinessRecord({
      id: "incident_timing", sourceId: "src_timing", captureId: "capture_timing", incidentId: "incident_timing",
      publisherReportedAt: "2026-07-20T09:58:00.000Z", firstReportedAt: "2026-07-20T09:58:00.000Z", reportedAt: "2026-07-20T09:58:00.000Z", firstReportedKind: "publisher",
      firstReportedProvenance: { role: "publisher", sourceId: "src_timing", captureId: "capture_timing", evidencePath: "feed.entry.publishedAt", extractionMethod: "source_field" },
      publishedAt: "2026-07-20T09:58:00.000Z", collectedAt: "2026-07-20T10:00:00.000Z", processedAt: "2026-07-20T10:00:02.000Z", firstVisibleAt: "2026-07-20T10:00:03.000Z",
      alertCreatedAt: "2026-07-20T10:01:00.000Z", alertedAt: "2026-07-20T10:01:00.000Z", deliveryAttemptedAt: "2026-07-20T10:01:02.000Z", deliveredAt: "2026-07-20T10:01:03.000Z",
      alertCreatedProvenance: { event: "alert_created", alertId: "alert_timing", evidencePath: "alert.savedAt" },
      deliveryAttemptProvenance: { event: "delivery_attempt", deliveryId: "delivery_timing", evidencePath: "delivery.attemptedAt" },
      deliveredProvenance: { event: "delivery_confirmed", deliveryId: "delivery_timing", evidencePath: "delivery.responseCompletedAt" },
      latencies: { reportToPublicationSeconds: 0, firstReportToCollectionSeconds: 120, publicationToCollectionSeconds: 120, collectionToProcessingSeconds: 2, processingToVisibilitySeconds: 1, visibilityToAlertSeconds: 57, alertToDeliveryAttemptSeconds: 2, deliveryAttemptToDeliveredSeconds: 1, reportToVisibilitySeconds: 123, reportToAlertSeconds: 180, reportToDeliveredSeconds: 183 },
      zeroSecondEvidence: { reportToPublicationSeconds: { verified: true } }, timestampAnomalies: []
    });

    const metrics = buildEvaluationMetrics(store);
    expect(metrics.timeliness).toMatchObject({ status: "measured", recordCount: 1, publisherReportedRecordCount: 1, reportedRecordCount: 1, firstReportedProvenanceCount: 1, alertCreatedRecordCount: 1, deliveryAttemptedRecordCount: 1, deliveredRecordCount: 1, reportToDeliveredRecordCount: 1, completeTimelineRecordCount: 1, firstReportedByKind: { publisher: 1 }, verifiedZeroSecondCount: 1, unverifiedZeroSecondCount: 0 });
    expect(metrics.timeliness.bySourceFamily[0]).toMatchObject({ name: "public_news", metrics: { reportToDeliveredSeconds: { sampleSize: 1, medianSeconds: 183, p95Seconds: 183 } } });
    expect(metrics.timeliness.byActor[0]).toMatchObject({ name: "APT29", metrics: { reportToDeliveredSeconds: { sampleSize: 1, medianSeconds: 183, p95Seconds: 183 } } });
    expect(metrics.timeliness.byPipelineStage).toContainEqual({ name: "reportToDeliveredSeconds", sampleSize: 1, medianSeconds: 183, p95Seconds: 183 });
  });

  test("excludes unverified zero-second values from latency statistics", () => {
    const store = new InMemoryScraperStore();
    store.saveTimelinessRecord({
      id: "incident_unverified_zero",
      latencies: { publicationToCollectionSeconds: 0 },
      zeroSecondEvidence: { publicationToCollectionSeconds: { verified: false } },
      timestampAnomalies: ["unverified_zero:publicationToCollectionSeconds"]
    });
    store.saveTimelinessRecord({
      id: "incident_verified_zero",
      latencies: { publicationToCollectionSeconds: 0 },
      zeroSecondEvidence: { publicationToCollectionSeconds: { verified: true } },
      timestampAnomalies: []
    });
    store.saveTimelinessRecord({
      id: "incident_legacy_zero",
      latencies: { publicationToCollectionSeconds: 0, processingToVisibilitySeconds: null },
      timestampAnomalies: []
    });

    const metrics = buildEvaluationMetrics(store);

    expect(metrics.timeliness.overall.publicationToCollectionSeconds).toEqual({ sampleSize: 1, medianSeconds: 0, p95Seconds: 0 });
    expect(metrics.timeliness).toMatchObject({ verifiedZeroSecondCount: 1, unverifiedZeroSecondCount: 2, anomalyCount: 2 });
  });

  test("compares drift only with the preceding benchmark from the same split", () => {
    const store = new InMemoryScraperStore();
    const benchmarks = [
      { id: "validation_old", datasetSplit: "validation", completedAt: "2026-07-18T00:00:00.000Z", outcome: "true_positive" },
      { id: "test_middle", datasetSplit: "test", completedAt: "2026-07-19T00:00:00.000Z", outcome: "false_positive" },
      { id: "validation_new", datasetSplit: "validation", completedAt: "2026-07-20T00:00:00.000Z", outcome: "false_positive" }
    ];
    for (const benchmark of benchmarks) {
      const taskId = `task_${benchmark.id}`;
      store.saveEvaluationBenchmark({ ...benchmark, status: "complete", taskCount: 1, captureIds: [`capture_${benchmark.id}`] });
      store.saveEvaluationAdjudication({ id: `adjudication_${benchmark.id}`, benchmarkId: benchmark.id, taskId });
      store.saveEvaluationLabel({
        id: `label_${benchmark.id}`, benchmarkId: benchmark.id, taskId, evaluationUnitId: benchmark.id, captureId: `capture_${benchmark.id}`,
        labelType: "actor_extraction", outcome: benchmark.outcome, datasetSplit: benchmark.datasetSplit, labeledBy: "consensus", labelingMethod: "manual_source_review",
        independentFromExtractor: true, exhaustiveExpectedValues: true, blinded: true, adjudicationStatus: "adjudicated", labeledAt: benchmark.completedAt
      });
    }

    const drift = buildEvaluationMetrics(store).quality.drift;
    expect(drift).toMatchObject({ status: "measured", latestDelta: { precision: -1 }, series: [{ benchmarkId: "validation_old" }, { benchmarkId: "test_middle" }, { benchmarkId: "validation_new" }] });
  });

  test("requires a complete stratified held-out benchmark before reporting validation", () => {
    const store = new InMemoryScraperStore();
    const labelTypes = ["actor", "ransomware", "victim", "incident", "cve", "malware", "ttp", "country", "sector", "indicator", "impact", "dataset", "business_mechanism"];
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
