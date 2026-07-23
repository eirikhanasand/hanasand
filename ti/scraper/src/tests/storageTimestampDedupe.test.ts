import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { fixtureCapture } from "./helpers/storageFixtures.ts";

test("capture dedupe compares published timestamps by instant", () => {
  const store = new InMemoryScraperStore();
  store.saveCapture(fixtureCapture({ id: "cap_utc", publishedAt: "2026-07-20T10:00:00.000Z" }));
  expect(store.saveCaptureWithDedupe(fixtureCapture({ id: "cap_offset", publishedAt: "2026-07-20T12:00:00+02:00" }))).toMatchObject({ status: "duplicate", duplicateOf: "cap_utc" });
});

test("capture storage drops malformed published timestamps", () => {
  const stored = new InMemoryScraperStore().saveCapture(fixtureCapture({ publishedAt: "Thu, 07/16/2026 - 07:25" }));
  expect(stored.publishedAt).toBeUndefined();
});

test("pipeline storage drops malformed incident timestamps", () => {
  const capture = fixtureCapture();
  const stored = new InMemoryScraperStore().savePipelineResult({
    capture,
    incident: { id: "incident_bad_date", sourceId: capture.sourceId, captureId: capture.id, title: "Incident", summary: "Summary", firstSeenAt: "Wed, 07/08/2026 - 06:25", reportedAt: "bad", publishedAt: "bad", confidence: 0.5, extractorVersion: "test", reviewState: "unreviewed" },
    entities: [],
    indicators: []
  });
  expect(stored.incident).toMatchObject({ firstSeenAt: capture.collectedAt, reportedAt: undefined, publishedAt: undefined });
});

test("later evidence preserves the incident's first capture timing", () => {
  const store = new InMemoryScraperStore();
  const capture = fixtureCapture({
    processedAt: "2026-05-24T10:00:01.000Z",
    firstVisibleAt: "2026-05-24T10:00:02.000Z"
  });
  const incident = {
    id: "incident_reprocessed",
    sourceId: capture.sourceId,
    captureId: capture.id,
    title: "Incident",
    summary: "Summary",
    firstSeenAt: capture.collectedAt,
    processedAt: capture.processedAt,
    confidence: 0.5,
    extractorVersion: "test",
    reviewState: "unreviewed"
  };

  store.savePipelineResult({ capture, incident, entities: [], indicators: [] });
  store.savePipelineResult({
    capture: { ...capture, id: "cap_reprocessed_followup", url: "https://example.test/followup", contentHash: "hash_reprocessed_followup", collectedAt: "2026-05-24T11:00:00.000Z", processedAt: "2026-05-24T11:00:01.000Z", firstVisibleAt: "2026-05-24T11:00:02.000Z" },
    incident: { ...incident, captureId: "cap_reprocessed_followup", collectedAt: "2026-05-24T11:00:00.000Z", processedAt: "2026-05-24T11:00:01.000Z", firstVisibleAt: "2026-05-24T11:00:02.000Z" },
    entities: [],
    indicators: []
  });

  expect(store.getTimelinessRecord(incident.id)).toMatchObject({
    captureId: capture.id,
    processedAt: "2026-05-24T10:00:01.000Z",
    collectedAt: "2026-05-24T10:00:00.000Z",
    firstVisibleAt: "2026-05-24T10:00:02.000Z",
    latencies: { collectionToProcessingSeconds: 1, processingToVisibilitySeconds: 1 },
    timestampAnomalies: []
  });
});

test("aggregate alert and delivery events update every linked evidence incident without conflating timestamps", () => {
  const store = new InMemoryScraperStore();
  const publishedAt = "2026-05-24T09:59:59.000Z";
  const first = fixtureCapture({ id: "cap_alert_first", contentHash: "hash_alert_first", publishedAt, firstVisibleAt: "2026-05-24T10:00:02.000Z", metadata: { reportTimestamps: [{ role: "publisher", timestamp: publishedAt, referenceUrl: "https://example.test/report", sourceId: "src_fixture", evidencePath: "feed.entry.publishedAt", extractionMethod: "source_field" }] } });
  const second = fixtureCapture({ id: "cap_alert_second", sourceId: "src_fixture_second", url: "https://example.test/second-report", contentHash: "hash_alert_second", collectedAt: "2026-05-24T10:00:01.000Z", publishedAt, firstVisibleAt: "2026-05-24T10:00:03.000Z", metadata: { reportTimestamps: [{ role: "publisher", timestamp: publishedAt, referenceUrl: "https://example.test/second-report", sourceId: "src_fixture_second", evidencePath: "feed.entry.publishedAt", extractionMethod: "source_field" }] } });
  const windowOnly = fixtureCapture({ id: "cap_alert_window", sourceId: "src_fixture_window", url: "https://example.test/window-report", contentHash: "hash_alert_window", collectedAt: "2026-05-24T10:00:02.000Z", publishedAt, firstVisibleAt: "2026-05-24T10:00:03.000Z", metadata: { reportTimestamps: [{ role: "publisher", timestamp: publishedAt, referenceUrl: "https://example.test/window-report", sourceId: "src_fixture_window", evidencePath: "feed.entry.publishedAt", extractionMethod: "source_field" }] } });
  for (const capture of [first, second, windowOnly]) store.savePipelineResult({
    capture,
    incident: { id: `incident_${capture.id}`, sourceId: capture.sourceId, captureId: capture.id, title: "Incident", summary: "Summary", firstSeenAt: capture.collectedAt, confidence: 0.5, extractorVersion: "test", reviewState: "unreviewed" },
    entities: [],
    indicators: []
  });

  store.saveDwmAlert({
    id: "alert_aggregate",
    savedAt: "2026-05-24T10:00:04.000Z",
    deliveryState: "pending_review",
    provenance: { captureIds: [first.id] },
    evidence: [{ provenance: { captureId: second.id } }],
    workflowContext: { generationEvidenceWindow: { captureIds: [windowOnly.id] } }
  });
  store.saveDwmWebhookDelivery({
    id: "delivery_aggregate",
    alertId: "alert_aggregate",
    attemptedAt: "2026-05-24T10:01:00.000Z",
    deliveredAt: "2026-05-24T10:01:02.000Z",
    status: "delivered",
    httpStatus: 204
  });

  expect(store.getTimelinessRecord(`incident_${first.id}`)).toMatchObject({ alertCreatedAt: "2026-05-24T10:00:04.000Z", alertedAt: "2026-05-24T10:00:04.000Z", alertCreatedProvenance: { evidencePath: "alert.savedAt" }, deliveryAttemptedAt: "2026-05-24T10:01:00.000Z", deliveredAt: "2026-05-24T10:01:02.000Z", latencies: { visibilityToAlertSeconds: 2, reportToAlertSeconds: 5, alertToDeliveryAttemptSeconds: 56, deliveryAttemptToDeliveredSeconds: 2, reportToDeliveredSeconds: 63 } });
  expect(store.getTimelinessRecord(`incident_${second.id}`)).toMatchObject({ alertCreatedAt: "2026-05-24T10:00:04.000Z", deliveryAttemptedAt: "2026-05-24T10:01:00.000Z", deliveredAt: "2026-05-24T10:01:02.000Z", latencies: { visibilityToAlertSeconds: 1, reportToDeliveredSeconds: 63 } });
  expect(store.getTimelinessRecord(`incident_${windowOnly.id}`)).toMatchObject({ alertCreatedAt: "2026-05-24T10:00:04.000Z", deliveryAttemptedAt: "2026-05-24T10:01:00.000Z", deliveredAt: "2026-05-24T10:01:02.000Z", latencies: { visibilityToAlertSeconds: 1, reportToDeliveredSeconds: 63 } });
});

test("unknown report times stay unknown and impossible event order is rejected", () => {
  const store = new InMemoryScraperStore();
  const capture = fixtureCapture({
    id: "cap_unknown_report",
    contentHash: "hash_unknown_report",
    collectedAt: "2026-05-24T10:00:00.000Z",
    processedAt: "2026-05-24T09:59:59.000Z",
    firstVisibleAt: "2026-05-24T09:59:58.000Z",
    metadata: { reportedAt: "2026-05-24T09:00:00.000Z" }
  });
  expect(() => store.savePipelineResult({ capture, incident: { id: "incident_unknown_report", sourceId: capture.sourceId, captureId: capture.id, title: "Incident", summary: "Summary", firstSeenAt: capture.collectedAt, confidence: 0.5, extractorVersion: "test", reviewState: "unreviewed" }, entities: [], indicators: [] }))
    .toThrow("collected_at must not follow processed_at");
  expect(store.getTimelinessRecord("incident_unknown_report")).toBeUndefined();
});

test("unverified actor report metadata is retained only as publisher provenance", () => {
  const store = new InMemoryScraperStore();
  store.saveSource({ id: "src_unverified_actor", name: "Unverified actor feed", metadata: { reporterRole: "actor" } } as any);
  const at = "2026-05-24T09:00:00.000Z";
  const capture = fixtureCapture({ id: "cap_unverified_actor", sourceId: "src_unverified_actor", contentHash: "hash_unverified_actor", publishedAt: at, metadata: { reportTimestamps: [{ role: "actor", timestamp: at, referenceUrl: "https://example.test/report", sourceId: "src_unverified_actor", evidencePath: "feed.entry.publishedAt", extractionMethod: "source_field" }] } });
  store.savePipelineResult({ capture, incident: { id: "incident_unverified_actor", sourceId: capture.sourceId, captureId: capture.id, title: "Incident", summary: "Summary", firstSeenAt: at, confidence: 0.5, extractorVersion: "test", reviewState: "unreviewed" }, entities: [], indicators: [] });

  expect(store.getTimelinessRecord("incident_unverified_actor")).toMatchObject({ actorReportedAt: undefined, publisherReportedAt: at, firstReportedKind: "publisher" });
});

test("publication latency exists only with source-field evidence", () => {
  const at = "2026-05-24T10:00:00.000Z";
  const save = (id: string, metadata: any) => {
    const store = new InMemoryScraperStore();
    const capture = fixtureCapture({ id: `cap_${id}`, contentHash: `hash_${id}`, collectedAt: at, publishedAt: at, metadata });
    store.savePipelineResult({ capture, incident: { id: `incident_${id}`, sourceId: capture.sourceId, captureId: capture.id, title: "Incident", summary: "Summary", firstSeenAt: at, confidence: 0.5, extractorVersion: "test", reviewState: "unreviewed" }, entities: [], indicators: [] });
    return store.getTimelinessRecord(`incident_${id}`);
  };

  const verified = save("verified_zero", { reportTimestamps: [{ role: "publisher", timestamp: at, referenceUrl: "https://example.test/report", sourceId: "src_fixture", evidencePath: "feed.entry.publishedAt", extractionMethod: "source_field" }] });
  const unverified = save("unverified_zero", {});

  expect(verified.zeroSecondEvidence.publicationToCollectionSeconds).toMatchObject({ verified: true, from: at, to: at });
  expect(verified.timestampAnomalies).not.toContain("unverified_zero:publicationToCollectionSeconds");
  expect(unverified.publishedAt).toBeUndefined();
  expect(unverified.zeroSecondEvidence.publicationToCollectionSeconds).toBeUndefined();
  expect(unverified.timestampAnomalies).not.toContain("unverified_zero:publicationToCollectionSeconds");
});

test("later producer evidence repairs the matching historical report reference", () => {
  const store = new InMemoryScraperStore();
  const publishedAt = "2026-05-24T09:59:59.000Z";
  const capture = fixtureCapture({
    id: "cap_repaired_reference",
    contentHash: "hash_repaired_reference",
    publishedAt,
    metadata: { reportTimestamps: [{ role: "publisher", timestamp: publishedAt, referenceUrl: "https://example.test/report", sourceId: "src_fixture", evidencePath: "feed.entry.publishedAt", extractionMethod: "source_field" }] }
  });
  const incident = { id: "incident_repaired_reference", sourceId: capture.sourceId, captureId: capture.id, title: "Incident", summary: "Summary", firstSeenAt: publishedAt, confidence: 0.5, extractorVersion: "test", reviewState: "unreviewed" };
  store.saveCapture(capture);
  store.saveIncident({ ...incident, publishedAt, reportTimestamps: [{ role: "publisher", timestamp: publishedAt, sourceId: capture.sourceId, captureId: capture.id, evidencePath: "feed.entry.publishedAt", extractionMethod: "source_field" }] } as any);

  store.savePipelineResult({ capture, incident, entities: [], indicators: [] });

  expect(store.getIncident(incident.id)?.reportTimestamps).toEqual([expect.objectContaining({ referenceUrl: "https://example.test/report" })]);
  expect(store.getTimelinessRecord(incident.id)?.reportTimestamps).toEqual([expect.objectContaining({ referenceUrl: "https://example.test/report" })]);
});

test("restart preserves historical anomalies while rejecting new inverted timelines", () => {
  const directory = mkdtempSync(join(tmpdir(), "ti-timeliness-restart-"));
  const snapshotPath = join(directory, "store.json");
  const inverted = {
    id: "incident_historical_inversion",
    sourceId: "src_fixture",
    captureId: "cap_fixture",
    incidentId: "incident_historical_inversion",
    collectedAt: "2026-05-24T10:00:00.000Z",
    processedAt: "2026-05-24T09:59:59.000Z",
  };
  try {
    writeFileSync(snapshotPath, JSON.stringify({ timelinessRecords: [inverted] }));
    const restarted = new FileBackedScraperStore({ snapshotPath });
    expect(restarted.getTimelinessRecord(inverted.id)).toEqual(inverted);
    expect(() => restarted.saveTimelinessRecord({ ...inverted, id: "incident_new_inversion", incidentId: "incident_new_inversion" }))
      .toThrow("collected_at must not follow processed_at");
    expect(restarted.getTimelinessRecord("incident_new_inversion")).toBeUndefined();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
