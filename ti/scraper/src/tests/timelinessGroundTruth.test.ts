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
    reportTimestamps: [],
    updatedAt: "2026-07-22T10:08:05.000Z",
    ...overrides,
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
    const snapshot = buildTimelinessWorkbench([duplicate.record], {
      generatedAt,
      sources: [{ id: "src_actor_site", name: "Actor disclosure", type: "static_html", metadata: { sourceFamily: "actor_site" } }],
      incidents: [{ id: "incident_northwind", captureId: "capture_northwind", title: "Northwind incident", actorName: "BlackCat" }],
    });

    expect(merged.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(duplicate.record.reportTimestamps).toHaveLength(1);
    expect(snapshot.items[0]).toMatchObject({
      status: "complete",
      actorName: "BlackCat",
      stages: { first_report: "2026-07-22T10:00:00.000Z", delivered: "2026-07-22T10:08:05.000Z" },
      provenance: { first_report: { role: "actor", referenceUrl: "https://actor.example/reports/northwind", evidencePath: "article.time[datetime]" } },
      latencies: { reportToAlertSeconds: 480, reportToDeliveredSeconds: 485 },
      timestampAnomalies: [],
    });
    expect(snapshot.summary).toMatchObject({ reportToAlertCoverage: 1, reportToDeliveredCoverage: 1, completeCount: 1 });
    expect(snapshot.metrics.overall.reportToDeliveredSeconds).toEqual({ sampleSize: 1, medianSeconds: 485, p95Seconds: 485 });
    expect(snapshot.metrics.bySourceFamily[0].name).toBe("actor_site");
  });

  test("keeps unknown first reports explicit and excludes impossible ordering from metrics", () => {
    const impossible = mergePublicReportReference(retainedRecord({ id: "incident_future", incidentId: "incident_future" }), {
      role: "victim",
      timestamp: "2026-07-22T10:09:00.000Z",
      referenceUrl: "https://victim.example/security/notice",
      evidencePath: "jsonLd.datePublished",
      recordedBy: "analyst_2",
      recordedAt: "2026-07-22T11:10:00.000Z",
    }).record;
    const snapshot = buildTimelinessWorkbench([retainedRecord(), impossible], { generatedAt });

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
});
