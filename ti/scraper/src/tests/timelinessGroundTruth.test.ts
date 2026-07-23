import { describe, expect, test } from "bun:test";
import { buildTimelinessWorkbench, mergePublicReportReference } from "../pipeline/timelinessGroundTruth.ts";

const generatedAt = "2026-07-22T12:00:00.000Z";

function retainedRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "incident_northwind",
    tenantId: "tenant_timeliness",
    sourceId: "src_actor_site",
    captureId: "capture_northwind",
    incidentId: "incident_northwind",
    publishedAt: "2026-07-22T10:05:00.000Z",
    collectedAt: "2026-07-22T10:07:00.000Z",
    processedAt: "2026-07-22T10:07:04.000Z",
    firstVisibleAt: "2026-07-22T10:07:06.000Z",
    alertCreatedAt: "2026-07-22T10:08:00.000Z",
    deliveryAttemptedAt: "2026-07-22T10:08:03.000Z",
    deliveredAt: "2026-07-22T10:08:05.000Z",
    alertCreatedProvenance: { alertId: "alert_northwind", evidencePath: "alert.createdAt" },
    deliveryAttemptProvenance: { deliveryId: "delivery_northwind", evidencePath: "delivery.attemptedAt" },
    deliveredProvenance: { deliveryId: "delivery_northwind", evidencePath: "delivery.deliveredAt" },
    reportTimestamps: [{
      role: "publisher",
      timestamp: "2026-07-22T10:05:00.000Z",
      referenceUrl: "https://actor.example/reports/northwind",
      sourceId: "src_actor_site",
      captureId: "capture_northwind",
      evidencePath: "article.time[datetime]",
      extractionMethod: "source_field",
    }],
    updatedAt: "2026-07-22T10:08:05.000Z",
    ...overrides,
  };
}

function retainedContext() {
  return {
    generatedAt,
    sources: [{ id: "src_actor_site", name: "Actor disclosure", type: "static_html", metadata: { sourceFamily: "actor_site" } }],
    captures: [{
      id: "capture_northwind",
      collectedAt: "2026-07-22T10:07:00.000Z",
      processedAt: "2026-07-22T10:07:04.000Z",
      firstVisibleAt: "2026-07-22T10:07:06.000Z",
    }],
    incidents: [{ id: "incident_northwind", captureId: "capture_northwind", firstVisibleAt: "2026-07-22T10:07:06.000Z", title: "Northwind incident", actorName: "BlackCat" }],
    deliveryRecords: [{
      id: "delivery_northwind",
      status: "delivered",
      attemptedAt: "2026-07-22T10:08:03.000Z",
      deliveredAt: "2026-07-22T10:08:05.000Z",
    }],
  };
}

describe("timeliness ground truth", () => {
  test("records independently sourced first-report evidence and reproduces delivered-alert latency", () => {
    const merged = mergePublicReportReference(retainedRecord(), {
      role: "actor",
      timestamp: "2026-07-22T10:00:00.000Z",
      referenceUrl: "https://actor.example/reports/northwind",
      referenceTitle: "Northwind notice",
      evidencePath: "article.time[datetime]",
      recordedBy: "analyst_1",
      recordedAt: "2026-07-22T11:00:00.000Z",
    });
    const duplicate = mergePublicReportReference(merged.record, {
      role: "actor",
      timestamp: "2026-07-22T10:00:00.000Z",
      referenceUrl: "https://actor.example/reports/northwind",
      referenceTitle: "Northwind notice",
      evidencePath: "article.time[datetime]",
      recordedBy: "analyst_1",
      recordedAt: "2026-07-22T11:05:00.000Z",
    });
    const snapshot = buildTimelinessWorkbench([duplicate.record], retainedContext());

    expect(merged.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(duplicate.record.reportTimestamps).toHaveLength(2);
    expect(snapshot.items[0]).toMatchObject({
      status: "complete",
      actorName: "BlackCat",
      stages: { first_report: "2026-07-22T10:00:00.000Z", delivered: "2026-07-22T10:08:05.000Z" },
      provenance: { first_report: { role: "actor", referenceUrl: "https://actor.example/reports/northwind", evidencePath: "article.time[datetime]" } },
      latencies: { reportToAlertSeconds: 480, reportToDeliveredSeconds: 485 },
      timestampAnomalies: [],
    });
    expect(snapshot.summary).toMatchObject({ reportToAlertCoverage: 1, reportToDeliveredCoverage: 1, completeCount: 1 });
    expect(snapshot.metrics.overall.reportToDeliveredSeconds).toEqual({
      populationSize: 1,
      sampleSize: 1,
      missingCount: 0,
      excludedCount: 0,
      exclusions: [],
      medianSeconds: 485,
      p95Seconds: 485,
      p99Seconds: 485,
    });
    expect(snapshot.metrics.bySourceFamily[0].name).toBe("actor_site");
  });

  test("keeps unknown first reports explicit and excludes impossible ordering from metrics", () => {
    const impossible = mergePublicReportReference(retainedRecord({ id: "incident_future", incidentId: "incident_future", reportTimestamps: [] }), {
      role: "victim",
      timestamp: "2026-07-22T10:09:00.000Z",
      referenceUrl: "https://victim.example/security/notice",
      evidencePath: "jsonLd.datePublished",
      recordedBy: "analyst_2",
      recordedAt: "2026-07-22T11:10:00.000Z",
    }).record;
    const snapshot = buildTimelinessWorkbench([retainedRecord({ reportTimestamps: [], publishedAt: undefined }), impossible], retainedContext());

    expect(snapshot.items.find((item) => item.id === "incident_northwind")).toMatchObject({
      status: "unresolved_reference",
      stages: { first_report: undefined },
      missingStages: expect.arrayContaining(["first_report"]),
    });
    expect(snapshot.items.find((item) => item.id === "incident_future")).toMatchObject({
      status: "anomaly",
      timestampAnomalies: expect.arrayContaining(["negative:reportToPublicationSeconds", "negative:reportToAlertSeconds", "negative:reportToDeliveredSeconds"]),
    });
    expect(snapshot.metrics.overall.reportToDeliveredSeconds.sampleSize).toBe(0);
    expect(snapshot.summary.reportToDeliveredCoverage).toBe(0);
  });

  test("does not hide timestamp anomalies behind an unresolved first report", () => {
    const snapshot = buildTimelinessWorkbench([retainedRecord({
      reportTimestamps: [],
      publishedAt: undefined,
      processedAt: "2026-07-22T10:07:08.000Z",
      firstVisibleAt: "2026-07-22T10:07:06.000Z",
    })], { generatedAt });

    expect(snapshot.items[0]).toMatchObject({
      status: "anomaly",
      missingStages: expect.arrayContaining(["first_report"]),
      timestampAnomalies: expect.arrayContaining(["negative:processingToVisibilitySeconds"]),
    });
    expect(snapshot.summary).toMatchObject({ anomalyCount: 1, unresolvedReferenceCount: 1, excludedMetricRecordCount: 1 });
  });

  test("uses retained observation and validation evidence while excluding source corruption", () => {
    const record = retainedRecord({
      publishedAt: "2026-07-22T10:07:00.000Z",
      collectedAt: "2026-07-22T10:07:00.000Z",
      reportTimestamps: [{
        role: "publisher", timestamp: "2026-07-22T10:05:00.000Z", sourceId: "src_actor_site", captureId: "capture_northwind",
        referenceUrl: "https://actor.example/reports/northwind", evidencePath: "article.time[datetime]", extractionMethod: "source_field",
      }],
    });
    const snapshot = buildTimelinessWorkbench([record], {
      generatedAt,
      sources: [{ id: "src_actor_site", name: "Actor disclosure", type: "static_html", metadata: { sourceFamily: "actor_site" } }],
      captures: [{ id: "capture_northwind", observedAt: "2026-07-22T09:59:00.000Z", publishedAt: "2026-07-22T10:07:00.000Z", collectedAt: "2026-07-22T10:07:00.000Z", processedAt: "2026-07-22T10:07:03.000Z" }],
      validationRecords: [{ id: "validation_northwind", captureId: "capture_northwind", matchedAt: "2026-07-22T10:07:30.000Z", reviewerId: "analyst_1", status: "supported", referenceUrl: "https://news.example/northwind" }],
    });

    expect(snapshot.items[0]).toMatchObject({
      status: "anomaly",
      stages: { observed: "2026-07-22T09:59:00.000Z", reviewed: "2026-07-22T10:07:30.000Z" },
      provenance: { observed: { evidencePath: "capture.observedAt" }, reviewed: { validationId: "validation_northwind", reviewerId: "analyst_1", evidencePath: "validation.matchedAt" } },
      timestampAnomalies: expect.arrayContaining(["source_mismatch:processing", "suspected_copy:publication_collection"]),
    });
    expect(snapshot.summary).toMatchObject({ observedCoverage: 1, reviewedCoverage: 1, excludedMetricRecordCount: 1 });
    expect(snapshot.quality.bySourceClass[0]).toMatchObject({ name: "actor_site", recordCount: 1, missing: { observed: 0, reviewed: 0 }, issues: { "source_mismatch:processing": 1, "suspected_copy:publication_collection": 1 } });
  });

  test("rejects first-report references without an explicit timezone", () => {
    expect(() => mergePublicReportReference(retainedRecord(), {
      role: "actor",
      timestamp: "2026-07-22T10:00:00",
      referenceUrl: "https://actor.example/reports/northwind",
      evidencePath: "article.time[datetime]",
      recordedBy: "analyst_1",
      recordedAt: generatedAt,
    })).toThrow("include an explicit timezone");
  });

  test("keeps copy-derived delivery clocks visible but out of delivery distributions", () => {
    const snapshot = buildTimelinessWorkbench([retainedRecord({ deliveredAt: "2026-07-22T10:08:03.000Z" })], {
      ...retainedContext(),
      deliveryRecords: [{
        id: "delivery_northwind",
        status: "delivered",
        attemptedAt: "2026-07-22T10:08:03.000Z",
        deliveredAt: "2026-07-22T10:08:03.000Z",
      }],
    });

    expect(snapshot.items[0]).toMatchObject({
      stages: { delivery_attempt: "2026-07-22T10:08:03.000Z", delivered: "2026-07-22T10:08:03.000Z" },
      timestampAnomalies: expect.arrayContaining(["suspected_copy:delivery_attempt_delivered"]),
    });
    expect(snapshot.metrics.overall.reportToAlertSeconds).toMatchObject({ sampleSize: 1, excludedCount: 0 });
    expect(snapshot.metrics.overall.reportToDeliveredSeconds).toMatchObject({
      sampleSize: 0,
      excludedCount: 1,
      exclusions: [{ name: "suspected_copy:delivery_attempt_delivered", count: 1 }],
    });
  });

  test("preserves explicitly proven retained stages and excludes unproven copies", () => {
    const proven = retainedRecord({
      observedAt: "2026-07-22T10:04:00.000Z",
      observedProvenance: { timestamp: "2026-07-22T10:04:00.000Z", evidencePath: "capture.metadata.observedAt" },
      reviewedAt: "2026-07-22T10:07:30.000Z",
      reviewedProvenance: { timestamp: "2026-07-22T10:07:30.000Z", evidencePath: "validation.matchedAt" },
    });
    const unproven = retainedRecord({
      id: "incident_unproven",
      incidentId: "incident_unproven",
      observedAt: "2026-07-22T10:04:00.000Z",
    });
    const snapshot = buildTimelinessWorkbench([proven, unproven], retainedContext());

    expect(snapshot.items.find((item) => item.id === "incident_northwind")?.stages).toMatchObject({ observed: "2026-07-22T10:04:00.000Z", reviewed: "2026-07-22T10:07:30.000Z" });
    expect(snapshot.metrics.overall.observationToCollectionSeconds).toMatchObject({
      sampleSize: 1,
      excludedCount: 1,
      exclusions: [{ name: "provenance_missing:observed", count: 1 }],
    });
  });

  test("keeps the historical Cisco publisher-after-collection record visible and excluded", () => {
    const record = retainedRecord({
      id: "inc_b2d7e51e3315f1601f28db63",
      sourceId: "src_canary_cisco_psirt",
      captureId: "capture_cisco_psirt",
      incidentId: "inc_b2d7e51e3315f1601f28db63",
      publishedAt: "2026-07-20T15:47:15.000Z",
      collectedAt: "2026-07-20T12:27:08.419Z",
      processedAt: "2026-07-20T12:27:09.761Z",
      firstVisibleAt: "2026-07-20T12:27:09.766Z",
      alertCreatedAt: undefined,
      deliveryAttemptedAt: undefined,
      deliveredAt: undefined,
      reportTimestamps: [{
        role: "publisher",
        timestamp: "2026-07-20T15:47:15.000Z",
        sourceId: "src_canary_cisco_psirt",
        captureId: "capture_cisco_psirt",
        evidencePath: "feed.entry.publishedAt",
        extractionMethod: "source_field",
      }],
    });
    const snapshot = buildTimelinessWorkbench([record], {
      generatedAt,
      sources: [{ id: "src_canary_cisco_psirt", name: "Cisco PSIRT", type: "rss", metadata: { sourceFamily: "vendor" } }],
      captures: [{ id: "capture_cisco_psirt", collectedAt: "2026-07-20T12:27:08.419Z", processedAt: "2026-07-20T12:27:09.761Z", firstVisibleAt: "2026-07-20T12:27:09.766Z" }],
      incidents: [{ id: "inc_b2d7e51e3315f1601f28db63", captureId: "capture_cisco_psirt", firstVisibleAt: "2026-07-20T12:27:09.766Z" }],
    });

    expect(snapshot.items[0]).toMatchObject({
      stages: { publication: "2026-07-20T15:47:15.000Z", collection: "2026-07-20T12:27:08.419Z" },
      timestampAnomalies: expect.arrayContaining(["negative:publicationToCollectionSeconds", "provenance_missing_public_reference:publication"]),
    });
    expect(snapshot.metrics.overall.publicationToCollectionSeconds).toMatchObject({
      sampleSize: 0,
      excludedCount: 1,
      exclusions: expect.arrayContaining([{ name: "negative:publicationToCollectionSeconds", count: 1 }]),
    });
    expect(snapshot.metrics.overall.collectionToProcessingSeconds).toMatchObject({ sampleSize: 1, excludedCount: 0 });
  });

  test("does not accept private public-reference URLs", () => {
    expect(() => mergePublicReportReference(retainedRecord(), {
      role: "actor",
      timestamp: "2026-07-22T10:00:00Z",
      referenceUrl: "http://127.0.0.1/private",
      evidencePath: "article.time[datetime]",
      recordedBy: "analyst_1",
      recordedAt: generatedAt,
    })).toThrow("Invalid public reference URL");
  });
});
