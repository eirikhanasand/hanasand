import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { evaluationLabelsForAdjudication } from "../api/evaluationBenchmarkRoutes.ts";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { buildEvaluationMetrics } from "../pipeline/evaluationMetrics.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { EvaluationBenchmarkRecord, EvaluationLabelType, EvaluationTaskRecord } from "../storage/evidenceStoreTypes.ts";
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
    const tasks = [
      { ...independentTask(store, "task_tp", saved.capture.id, "actor", ["APT29"]), observedValues: ["APT29"], observedPredictions: [{ entityType: "actor", value: "APT29", confidence: 0.9, extractorVersion: "test-parser" }] },
      { ...independentTask(store, "task_fp", saved.capture.id, "ttp", []), observedValues: ["password spraying"], observedPredictions: [{ entityType: "ttp", value: "password spraying", confidence: 0.6, extractorVersion: "test-parser" }] },
      { ...independentTask(store, "task_fn", saved.capture.id, "victim", ["Northwind Health"]), observedValues: [] }
    ];
    const benchmark: EvaluationBenchmarkRecord = { id: "benchmark_eval", tenantId: "tenant_eval", name: "Held-out evaluation", status: "complete", datasetSplit: "test", taskCount: 3, captureIds: [saved.capture.id], manifest: tasks, protocol: { version: "ti.independent_extraction_benchmark.v4", testSplitLocked: true, datasetUsage: "locked_final_evaluation" } };
    store.saveEvaluationBenchmark(benchmark);
    store.saveEvaluationAnnotation({ id: "annotation_one", tenantId: "tenant_eval", benchmarkId: "benchmark_eval", taskId: "task_tp", reviewerId: "reviewer_one" });
    store.saveEvaluationAnnotation({ id: "annotation_two", tenantId: "tenant_eval", benchmarkId: "benchmark_eval", taskId: "task_tp", reviewerId: "reviewer_two" });
    const labels = tasks.flatMap((task) => saveMetricAdjudication(store, benchmark, task, task.authoritativeExpectedValues ?? [], at));
    store.saveEvaluationLabel({ ...labels[0], id: "label_other_tenant", tenantId: "tenant_other", entityId: "entity_other" });
    store.saveTimelinessRecord({ id: saved.incident.id, tenantId: "tenant_eval", sourceId: "src_eval", captureId: saved.capture.id, incidentId: saved.incident.id, alertedAt: "2026-07-20T00:03:00.000Z", latencies: { publicationToCollectionSeconds: 120, collectionToProcessingSeconds: 2, processingToVisibilitySeconds: 1, reportToVisibilitySeconds: 123, visibilityToAlertSeconds: 177, reportToAlertSeconds: 300 }, timestampAnomalies: [] });
    store.saveSourceHealthObservation({ id: "health_eval", tenantId: "tenant_eval", sourceId: "src_eval", checkedAt: at, status: "healthy", success: true, useful: true, itemCount: 4, duplicateCount: 1, legalMode: "public_content" });
    store.saveValidationRecord({ id: "validation_eval", tenantId: "tenant_eval", incidentId: saved.incident.id, validationType: "victim_disclosure", status: "supported", referenceUrl: "https://northwind.example/security", matchedAt: at });

    const response = await handleApiRequest(new Request("http://local/v1/intel/evaluation?datasetSplit=test", { headers: { "x-tenant-id": "tenant_eval" } }), { store, frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(body.quality).toMatchObject({
      labelEventCount: 3,
      evaluatedUnitCount: 3,
      overall: { truePositive: 1, falsePositive: 1, falseNegative: 1, precision: 0.5, recall: 0.5, f1: 0.5, calibration: { sampleSize: 3, brierScore: 0.457, expectedCalibrationError: 0.567 } },
      endToEnd: {
        taskSetExactMatch: { sampleSize: 3, exactMatchCount: 1, errorCount: 2, exactMatchRate: 0.333 },
        captureExactMatch: { sampleSize: 1, exactMatchCount: 0, errorCount: 1, exactMatchRate: 0 }
      },
      errorBreakdown: { byOutcome: { true_positive: 1, false_positive: 1, false_negative: 1 } }
    });
    expect(body.timeliness.overall.reportToAlertSeconds).toEqual({ sampleSize: 1, medianSeconds: 300, p95Seconds: 300 });
    expect(body.coverage).toMatchObject({ activeSourceCount: 4, attemptedSourceCount: 1, successfulSourceCount: 1, usefulSourceCount: 1, actorCount: 1, sourceAttemptCount: 1, activeSourceReliabilityRate: 1, usefulAttemptRate: 1, duplicateObservationCount: 1, duplicationRate: 0.25, falsePositiveRate: 0.333, falsePositiveSampleSize: 3 });
    expect(body.validation).toMatchObject({ recordCount: 4, statuses: { supported: 4 }, referenceHostCount: 4 });
    expect(() => store.saveEvaluationLabel({ ...labels[0], outcome: "false_positive" })).toThrow("Evaluation label is immutable");
  });

  test("keeps automated parity labels out of independent accuracy", () => {
    const store = new InMemoryScraperStore();
    store.saveEvaluationLabel({ id: "label_parity", captureId: "capture_parity", labelType: "cve_extraction", outcome: "true_positive", datasetSplit: "test", labeledBy: "cisa-kev-authoritative-v1", labelingMethod: "source_field_parity", independentFromExtractor: false, labeledAt: "2026-07-20T00:00:00.000Z" });
    store.saveEvaluationLabel({ id: "label_unblinded_manual", captureId: "capture_manual", labelType: "actor_extraction", outcome: "true_positive", datasetSplit: "test", labeledBy: "analyst", labelingMethod: "manual_source_review", independentFromExtractor: true, labeledAt: "2026-07-20T00:00:00.000Z" });
    store.saveEvaluationBenchmark({ id: "benchmark_unisolated", status: "complete", datasetSplit: "test", taskCount: 1, captureIds: ["capture_unisolated"], manifest: [unresolvedIndependentTask("task_unisolated", "capture_unisolated", "actor", ["APT29"])], protocol: { version: "ti.independent_extraction_benchmark.v4" } });
    store.saveEvaluationAdjudication({ id: "adjudication_unisolated", benchmarkId: "benchmark_unisolated", taskId: "task_unisolated" });
    store.saveEvaluationLabel({
      id: "label_unisolated", benchmarkId: "benchmark_unisolated", taskId: "task_unisolated", captureId: "capture_unisolated", labelType: "actor_extraction", outcome: "true_positive",
      datasetSplit: "test", labeledBy: "hanasand", labelingMethod: "automatic_model_review", independentFromExtractor: true, exhaustiveExpectedValues: true, blinded: true,
      adjudicationStatus: "adjudicated", reviewerModelResponseIds: ["provider-conversation"], independenceContext: { extractorPredictionsExcluded: true, reviewerContextsIsolated: true, governedEvidenceComplete: true, evaluationModelIsolated: true, evaluationModelResponseId: "provider-conversation", extractionDecisionVersions: [], truthBasis: "immutable_source_capture", truthSnapshotHash: "truth" },
      labeledAt: "2026-07-20T00:00:00.000Z"
    });

    const metrics = buildEvaluationMetrics(store, { datasetSplit: "test" });
    expect(metrics.quality).toMatchObject({
      status: "diagnostic_only",
      evaluatedUnitCount: 0,
      diagnosticUnitCount: 3,
      overall: { precision: null, recall: null },
      benchmarkEvidence: {
        benchmarkCount: 1,
        completedBenchmarkCount: 0,
        completedTaskCount: 0,
        completedCaptureCount: 0,
        annotationCount: 0,
        adjudicationCount: 0,
        heldOutBenchmarkCount: 0,
        diagnostics: { partialAdjudicationCount: 1 }
      }
    });
    expect(metrics.quality.diagnostics.overall).toMatchObject({ truePositive: 3, precision: 1, recall: 1, f1: 1 });
    expect(metrics.limitations).toContain("no independently reviewed evaluation labels in scope; automated checks are diagnostic only");
  });

  test("keeps labels diagnostic when their retained authoritative reference cannot be resolved", () => {
    const store = new InMemoryScraperStore();
    const task = independentTask(store, "task_missing_reference", "capture_missing_reference", "actor", ["APT29"]);
    store.saveEvaluationBenchmark({
      id: "benchmark_missing_reference",
      status: "complete",
      datasetSplit: "test",
      taskCount: 1,
      captureIds: [task.captureId!],
      manifest: [{ ...task, independenceContext: { ...task.independenceContext, truthReferenceValidationId: "deleted_reference" } }],
      protocol: { version: "ti.independent_extraction_benchmark.v4", testSplitLocked: true, datasetUsage: "locked_final_evaluation" }
    });
    store.saveEvaluationAdjudication({ id: "adjudication_missing_reference", benchmarkId: "benchmark_missing_reference", taskId: task.id, expectedValues: ["APT29"], independenceAttested: true });
    store.saveEvaluationLabel({
      id: "label_missing_reference",
      benchmarkId: "benchmark_missing_reference",
      taskId: task.id,
      captureId: task.captureId,
      labelType: "actor_extraction",
      expectedValue: "APT29",
      outcome: "false_negative",
      datasetSplit: "test",
      labelingMethod: "manual_source_review",
      independentFromExtractor: true,
      exhaustiveExpectedValues: true,
      blinded: true,
      adjudicationStatus: "adjudicated",
      labeledAt: "2026-07-20T00:00:00.000Z"
    });

    expect(buildEvaluationMetrics(store, { datasetSplit: "test" }).quality).toMatchObject({
      status: "diagnostic_only",
      evaluatedUnitCount: 0,
      diagnosticUnitCount: 1,
      benchmarkEvidence: { completedBenchmarkCount: 0, completedTaskCount: 0, adjudicationCount: 0 }
    });
  });

  test("rejects tampered, extra, and missing independently flagged labels", () => {
    for (const variant of ["tampered", "extra", "missing"] as const) {
      const store = new InMemoryScraperStore();
      const task = { ...independentTask(store, `task_${variant}`, `capture_${variant}`, "actor", ["APT29"]), observedValues: ["APT29"] };
      const benchmark: EvaluationBenchmarkRecord = { id: `benchmark_${variant}`, status: "complete", datasetSplit: "test", taskCount: 1, captureIds: [task.captureId!], manifest: [task], protocol: { version: "ti.independent_extraction_benchmark.v4" } };
      store.saveEvaluationBenchmark(benchmark);
      const adjudication = {
        id: `adjudication_${variant}`, benchmarkId: benchmark.id, taskId: task.id, captureId: task.captureId, labelType: task.labelType,
        expectedValues: ["APT29"], annotationIds: [], method: "independent_reviewer_consensus", adjudicatedBy: "analyst",
        independenceAttested: true, adjudicatedAt: "2026-07-20T00:00:00.000Z"
      };
      store.saveEvaluationAdjudication(adjudication);
      const expected = evaluationLabelsForAdjudication(store, benchmark, task, adjudication);
      const labels = variant === "missing"
        ? []
        : variant === "extra"
          ? [...expected, { ...expected[0], id: `${expected[0].id}_extra`, evaluationUnitId: `${expected[0].evaluationUnitId}:extra` }]
          : [{ ...expected[0], expectedValue: null, observedValue: null, outcome: "true_negative" }];
      for (const label of labels) store.saveEvaluationLabel(label);

      expect(buildEvaluationMetrics(store, { datasetSplit: "test" }).quality).toMatchObject({
        evaluatedUnitCount: 0,
        benchmarkEvidence: { completedBenchmarkCount: 0, completedTaskCount: 0, adjudicationCount: 0 }
      });
    }
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
    const benchmarks: Array<{ id: string; datasetSplit: "validation" | "test"; completedAt: string; outcome: string }> = [
      { id: "validation_old", datasetSplit: "validation", completedAt: "2026-07-18T00:00:00.000Z", outcome: "true_positive" },
      { id: "test_middle", datasetSplit: "test", completedAt: "2026-07-19T00:00:00.000Z", outcome: "false_positive" },
      { id: "validation_new", datasetSplit: "validation", completedAt: "2026-07-20T00:00:00.000Z", outcome: "false_positive" }
    ];
    for (const benchmark of benchmarks) {
      const taskId = `task_${benchmark.id}`;
      const expectedValues = benchmark.outcome === "true_positive" ? ["Expected Actor"] : [];
      const task = { ...independentTask(store, taskId, `capture_${benchmark.id}`, "actor", expectedValues), observedValues: expectedValues.length ? expectedValues : ["Unexpected Actor"] };
      const storedBenchmark = { ...benchmark, status: "complete", taskCount: 1, captureIds: [`capture_${benchmark.id}`], manifest: [task], protocol: { version: "ti.independent_extraction_benchmark.v4" } };
      store.saveEvaluationBenchmark(storedBenchmark);
      saveMetricAdjudication(store, storedBenchmark, task, expectedValues, benchmark.completedAt);
    }

    const drift = buildEvaluationMetrics(store).quality.drift;
    expect(drift).toMatchObject({ status: "measured", latestDelta: { precision: -1 }, series: [{ benchmarkId: "validation_old" }, { benchmarkId: "test_middle" }, { benchmarkId: "validation_new" }] });
  });

  test("requires a complete stratified held-out benchmark before reporting validation", () => {
    const store = new InMemoryScraperStore();
    const labelTypes: EvaluationLabelType[] = ["actor", "ransomware", "victim", "incident", "cve", "malware", "ttp", "country", "sector", "indicator", "impact", "dataset", "business_mechanism"];
    const captureIds = Array.from({ length: 50 }, (_, index) => `capture_${index}`);
    const targetEvidence = labelTypes.flatMap((labelType) => Array.from({ length: 5 }, (_, index) => `expected_${labelType}_${index}`)).join(". ");
    for (const captureId of captureIds) saveMetricTarget(store, captureId, targetEvidence);
    const manifest = labelTypes.flatMap((labelType, labelTypeIndex) => Array.from({ length: 10 }, (_, index) => ({
      ...independentTask(store, `${labelType}_${index}`, captureIds[(labelTypeIndex * 10 + index) % captureIds.length], labelType, index < 5 ? [`expected_${labelType}_${index}`] : []),
      caseTags: [],
      observedValues: index < 5 ? [`expected_${labelType}_${index}`] : labelType === "actor" && index === 5 ? ["Unsupported Actor"] : []
    })));
    const benchmark: EvaluationBenchmarkRecord = { id: "benchmark_stratified", status: "complete", datasetSplit: "test", taskCount: manifest.length, captureIds, manifest, protocol: { version: "ti.independent_extraction_benchmark.v4", testSplitLocked: true, datasetUsage: "locked_final_evaluation" } };
    store.saveEvaluationBenchmark(benchmark);
    for (const task of manifest) {
      const index = Number(task.id.slice(String(task.labelType).length + 1));
      store.saveEvaluationAnnotation({ id: `review_one_${task.id}`, benchmarkId: "benchmark_stratified", taskId: task.id, reviewerId: "reviewer_one" });
      store.saveEvaluationAnnotation({ id: `review_two_${task.id}`, benchmarkId: "benchmark_stratified", taskId: task.id, reviewerId: "reviewer_two" });
      saveMetricAdjudication(store, benchmark, task, index < 5 ? [`expected_${task.id}`] : [], "2026-07-21T00:00:00.000Z");
    }

    const easyMetrics = buildEvaluationMetrics(store, { datasetSplit: "test" });
    expect(easyMetrics.quality).toMatchObject({ status: "pilot_only", benchmarkEvidence: { validationStatus: "pilot_only", representativeFailureCoverageComplete: false } });
    const storedBenchmark = store.getEvaluationBenchmark("benchmark_stratified")!;
    store.saveEvaluationBenchmark({
      ...storedBenchmark,
      manifest: storedBenchmark.manifest!.map((task: any) => task.id === "actor_0"
        ? { ...task, caseTags: ["parser_failure"] }
        : task)
    });
    store.saveEvaluationAnnotation({ id: "review_ambiguous_victim", benchmarkId: "benchmark_stratified", taskId: "victim_0", reviewerId: "reviewer_three", decision: "ambiguous", expectedValues: ["expected_victim_0"] });
    const metrics = buildEvaluationMetrics(store, { datasetSplit: "test" });
    expect(metrics.quality).toMatchObject({ status: "measured", benchmarkEvidence: { validationStatus: "validated", heldOutCaptureCount: 50, heldOutReviewerCount: 3, stratifiedCoverageComplete: true, representativeFailureCoverageComplete: true, heldOutCaseCoverage: { ambiguousTaskCount: 1, parserFailureTaskCount: 1, unsupportedAttributionTaskCount: 1 } } });
    expect(metrics.quality.benchmarkEvidence.labelTypeCoverage).toEqual(labelTypes.map((name) => ({ name, sampleSize: 10, positiveCount: 5, negativeCount: 5 })));
  });
});

function independentTask(store: InMemoryScraperStore, id: string, captureId: string, labelType: EvaluationLabelType, authoritativeExpectedValues: string[]): EvaluationTaskRecord {
  const target = store.getCapture(captureId) ?? saveMetricTarget(store, captureId, authoritativeExpectedValues.join(". ") || `No supported ${labelType} value.`);
  const canonical = authoritativeExpectedValues.map((value) => value.trim().toLowerCase().replace(/\s+/g, " ")).sort().join("\n");
  const valueSetHash = createHash("sha256").update(JSON.stringify([labelType, canonical])).digest("hex");
  const referenceSourceId = `reference_source_${id}`;
  const referenceCaptureId = `reference_capture_${id}`;
  const validationId = `reference_${id}`;
  const referenceUrl = `https://${referenceSourceId.replaceAll("_", "-")}.test/reference`;
  const referenceBody = authoritativeExpectedValues.length ? `Frozen ${labelType} truth: ${authoritativeExpectedValues.join(". ")}.` : `Frozen exhaustive ${labelType} truth: none.`;
  const referenceContentHash = hashContent(referenceBody);
  const frozenAt = "2026-07-20T00:00:00.000Z";
  store.saveSource({ id: referenceSourceId, tenantId: target.tenantId, name: `Independent ${labelType} authority`, type: "json_api", url: referenceUrl, accessMethod: "public_http", status: "active", risk: "low", trustScore: 1, crawlFrequencySeconds: 3600, legalNotes: "Separately retained authoritative reference.", metadata: { sourceFamily: "authoritative_reference" }, createdAt: frozenAt, updatedAt: frozenAt });
  store.saveCapture({ id: referenceCaptureId, tenantId: target.tenantId, sourceId: referenceSourceId, url: referenceUrl, collectedAt: frozenAt, publishedAt: frozenAt, contentHash: referenceContentHash, mediaType: "text/plain", storageKind: "inline_text", body: referenceBody, metadata: { parserVersion: "authoritative-reference:v1" }, sensitive: false });
  store.saveValidationRecord({ id: validationId, tenantId: target.tenantId, captureId, validationType: "independent_evaluation_reference", status: "supported", referenceUrl, referenceCaptureId, referenceSourceId, referenceContentHash, labelType, expectedValues: authoritativeExpectedValues, expectedValuesHash: valueSetHash, exhaustiveExpectedValues: true, truthSchemaVersion: "ti.independent_evaluation_reference.v1", truthFrozenAt: frozenAt, matchedAt: frozenAt, reviewerId: "independent-reference-curator" });
  const targetBody = String(target.body);
  const targetExcerptHash = createHash("sha256").update(targetBody).digest("hex");
  const referenceExcerptHash = createHash("sha256").update(referenceBody).digest("hex");
  const truthSnapshotHash = createHash("sha256").update(JSON.stringify({
    captureId,
    contentHash: target.contentHash,
    excerptHash: targetExcerptHash,
    validationId,
    referenceCaptureId,
    referenceSourceId,
    referenceContentHash,
    referenceExcerptHash,
    valueSetHash,
    schema: "ti.independent_evaluation_reference.v1",
    frozenAt
  })).digest("hex");
  return {
    id,
    captureId,
    labelType,
    authoritativeExpectedValues,
    contentHash: target.contentHash,
    excerptHash: targetExcerptHash,
    evidenceHashAlgorithm: "sha256",
    referenceEvidence: [{
      id: validationId,
      kind: "independent_authoritative_reference" as const,
      referenceCaptureId,
      referenceSourceId,
      referenceContentHash,
      excerptHash: referenceExcerptHash,
      frozenAt
    }],
    independenceContext: {
      governedEvidenceComplete: true,
      authoritativeReferenceSetComplete: true,
      authoritativeReferenceSetHash: valueSetHash,
      authoritativeReferenceSchema: "ti.independent_evaluation_reference.v1",
      truthBasis: "separately_retained_authoritative_reference",
      truthReferenceValidationId: validationId,
      truthReferenceCaptureId: referenceCaptureId,
      truthReferenceSourceId: referenceSourceId,
      truthReferenceContentHash: referenceContentHash,
      truthReferenceExcerptHash: referenceExcerptHash,
      truthSnapshotHash
    }
  };
}

function saveMetricTarget(store: InMemoryScraperStore, captureId: string, body: string) {
  const sourceId = `target_source_${captureId}`;
  const url = `https://${sourceId.replaceAll("_", "-")}.test/report`;
  store.saveSource({ id: sourceId, name: "Retained target publisher", type: "rss", url, accessMethod: "public_http", status: "active", risk: "low", trustScore: 0.8, crawlFrequencySeconds: 3600, legalNotes: "Public retained target.", metadata: { sourceFamily: "vendor" }, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z" });
  return store.saveCapture({ id: captureId, sourceId, url, collectedAt: "2026-07-20T00:00:00.000Z", publishedAt: "2026-07-20T00:00:00.000Z", contentHash: hashContent(body), mediaType: "text/plain", storageKind: "inline_text", body, metadata: { parserVersion: "target-parser:v1" }, sensitive: false });
}

function saveMetricAdjudication(store: InMemoryScraperStore, benchmark: EvaluationBenchmarkRecord, task: EvaluationTaskRecord, expectedValues: string[], at: string) {
  const adjudication = {
    id: `adjudication_${task.id}`,
    tenantId: benchmark.tenantId,
    benchmarkId: benchmark.id,
    taskId: task.id,
    captureId: task.captureId,
    labelType: task.labelType,
    expectedValues,
    annotationIds: [],
    method: "independent_reviewer_consensus",
    adjudicatedBy: "analyst",
    independenceAttested: true,
    adjudicatedAt: at
  };
  store.saveEvaluationAdjudication(adjudication);
  const labels = evaluationLabelsForAdjudication(store, benchmark, task, adjudication);
  for (const label of labels) store.saveEvaluationLabel(label);
  return labels;
}

function unresolvedIndependentTask(id: string, captureId: string, labelType: string, authoritativeExpectedValues: string[]) {
  const canonical = authoritativeExpectedValues.map((value) => value.trim().toLowerCase().replace(/\s+/g, " ")).sort().join("\n");
  return {
    id,
    captureId,
    labelType,
    authoritativeExpectedValues,
    independenceContext: {
      governedEvidenceComplete: true,
      authoritativeReferenceSetComplete: true,
      authoritativeReferenceSetHash: createHash("sha256").update(JSON.stringify([labelType, canonical])).digest("hex"),
      truthBasis: "separately_retained_authoritative_reference",
      truthReferenceValidationId: `missing_${id}`,
      truthReferenceCaptureId: `missing_capture_${id}`,
      truthReferenceSourceId: `missing_source_${id}`,
      truthReferenceContentHash: `missing_content_${id}`,
      truthReferenceExcerptHash: `missing_excerpt_${id}`,
      truthSnapshotHash: "missing_truth"
    }
  };
}
