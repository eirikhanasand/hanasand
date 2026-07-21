import { expect, test } from "bun:test";
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

test("duplicate processing preserves the incident's first processing timestamp", () => {
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
    capture: { ...capture, processedAt: "2026-05-24T11:00:00.000Z" },
    incident: { ...incident, processedAt: "2026-05-24T11:00:00.000Z" },
    entities: [],
    indicators: []
  });

  expect(store.getTimelinessRecord(incident.id)).toMatchObject({
    processedAt: "2026-05-24T10:00:01.000Z",
    firstVisibleAt: "2026-05-24T10:00:02.000Z",
    latencies: { processingToVisibilitySeconds: 1 },
    timestampAnomalies: []
  });
});

test("aggregate alert delivery updates every linked evidence incident", () => {
  const store = new InMemoryScraperStore();
  const first = fixtureCapture({ id: "cap_alert_first", contentHash: "hash_alert_first", publishedAt: "2026-05-24T09:59:59.000Z", firstVisibleAt: "2026-05-24T10:00:02.000Z" });
  const second = fixtureCapture({ id: "cap_alert_second", sourceId: "src_fixture_second", url: "https://example.test/second-report", contentHash: "hash_alert_second", collectedAt: "2026-05-24T10:00:01.000Z", publishedAt: "2026-05-24T09:59:59.000Z", firstVisibleAt: "2026-05-24T10:00:03.000Z" });
  for (const capture of [first, second]) store.savePipelineResult({
    capture,
    incident: { id: `incident_${capture.id}`, sourceId: capture.sourceId, captureId: capture.id, title: "Incident", summary: "Summary", firstSeenAt: capture.collectedAt, confidence: 0.5, extractorVersion: "test", reviewState: "unreviewed" },
    entities: [],
    indicators: []
  });

  store.saveDwmAlert({
    id: "alert_aggregate",
    deliveryState: "delivered",
    deliveredAt: "2026-05-24T10:01:00.000Z",
    provenance: { captureIds: [first.id] },
    evidence: [{ provenance: { captureId: second.id } }]
  });

  expect(store.getTimelinessRecord(`incident_${first.id}`)).toMatchObject({ alertedAt: "2026-05-24T10:01:00.000Z", latencies: { visibilityToAlertSeconds: 58, publicationToAlertSeconds: 61, reportToAlertSeconds: undefined } });
  expect(store.getTimelinessRecord(`incident_${second.id}`)).toMatchObject({ alertedAt: "2026-05-24T10:01:00.000Z", latencies: { visibilityToAlertSeconds: 57, publicationToAlertSeconds: 61, reportToAlertSeconds: undefined } });
});
