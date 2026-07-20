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
      { id: "label_tp", tenantId: "tenant_eval", entityId: actor.id, labelType: "actor_extraction", expectedValue: "APT29", observedValue: "APT29", outcome: "true_positive", datasetSplit: "test", labeledBy: "analyst", labelingMethod: "manual_source_review", independentFromExtractor: true, labeledAt: at },
      { id: "label_fp", tenantId: "tenant_eval", entityId: falsePositive.id, labelType: "ttp_extraction", observedValue: "password spraying", outcome: "false_positive", datasetSplit: "test", labeledBy: "analyst", labelingMethod: "manual_source_review", independentFromExtractor: true, labeledAt: at },
      { id: "label_fn", tenantId: "tenant_eval", captureId: saved.capture.id, labelType: "victim_extraction", expectedValue: "Missing Victim Ltd", outcome: "false_negative", datasetSplit: "test", labeledBy: "analyst", labelingMethod: "manual_source_review", independentFromExtractor: true, labeledAt: at }
    ];
    for (const label of labels) store.saveEvaluationLabel(label);
    store.saveEvaluationLabel({ ...labels[0], id: "label_other_tenant", tenantId: "tenant_other", entityId: "entity_other" });
    store.saveTimelinessRecord({ id: saved.incident.id, tenantId: "tenant_eval", sourceId: "src_eval", captureId: saved.capture.id, incidentId: saved.incident.id, alertedAt: "2026-07-20T00:03:00.000Z", latencies: { publicationToCollectionSeconds: 120, collectionToProcessingSeconds: 2, processingToVisibilitySeconds: 1, reportToVisibilitySeconds: 123, visibilityToAlertSeconds: 177, reportToAlertSeconds: 300 }, timestampAnomalies: [] });
    store.saveSourceHealthObservation({ id: "health_eval", tenantId: "tenant_eval", sourceId: "src_eval", checkedAt: at, status: "healthy", success: true, useful: true, itemCount: 4, duplicateCount: 1, legalMode: "public_content" });
    store.saveValidationRecord({ id: "validation_eval", tenantId: "tenant_eval", incidentId: saved.incident.id, validationType: "victim_disclosure", status: "supported", referenceUrl: "https://northwind.example/security", matchedAt: at });

    const response = await handleApiRequest(new Request("http://local/v1/intel/evaluation?datasetSplit=test", { headers: { "x-tenant-id": "tenant_eval" } }), { store, frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(body.quality).toMatchObject({ labelEventCount: 3, evaluatedUnitCount: 3, overall: { truePositive: 1, falsePositive: 1, falseNegative: 1, precision: 0.5, recall: 0.5, f1: 0.5 } });
    expect(body.timeliness.overall.reportToAlertSeconds).toEqual({ sampleSize: 1, medianSeconds: 300, p95Seconds: 300 });
    expect(body.coverage).toMatchObject({ activeSourceCount: 1, attemptedSourceCount: 1, successfulSourceCount: 1, usefulSourceCount: 1, actorCount: 1, sourceAttemptCount: 1, activeSourceReliabilityRate: 1, usefulAttemptRate: 1, duplicateObservationCount: 1, duplicationRate: 0.25, falsePositiveRate: 0.333, falsePositiveSampleSize: 3 });
    expect(body.validation).toMatchObject({ recordCount: 1, statuses: { supported: 1 }, referenceHostCount: 1 });
    expect(() => store.saveEvaluationLabel({ ...labels[0], outcome: "false_positive" })).toThrow("Evaluation label is immutable");
  });

  test("keeps automated parity labels out of independent accuracy", () => {
    const store = new InMemoryScraperStore();
    store.saveEvaluationLabel({ id: "label_parity", captureId: "capture_parity", labelType: "cve_extraction", outcome: "true_positive", datasetSplit: "test", labeledBy: "cisa-kev-authoritative-v1", labelingMethod: "source_field_parity", independentFromExtractor: false, labeledAt: "2026-07-20T00:00:00.000Z" });

    const metrics = buildEvaluationMetrics(store, { datasetSplit: "test" });
    expect(metrics.quality).toMatchObject({ status: "diagnostic_only", evaluatedUnitCount: 0, diagnosticUnitCount: 1, overall: { precision: null, recall: null } });
    expect(metrics.quality.diagnostics.overall).toMatchObject({ truePositive: 1, precision: 1 });
    expect(metrics.limitations).toContain("no independently reviewed evaluation labels in scope; automated checks are diagnostic only");
  });
});
