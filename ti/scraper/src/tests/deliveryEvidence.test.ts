import { expect, test } from "bun:test";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { fixtureCapture } from "./helpers/storageFixtures.ts";
import { buildTimelinessWorkbench } from "../pipeline/timelinessGroundTruth.ts";
import { feedItems } from "../ops/canaryFeedItems.ts";
import { handleTimelinessRequest } from "../api/timelinessRoutes.ts";

function setup() {
  const store = new InMemoryScraperStore();
  const capture = fixtureCapture({ id: "cap_delivery", collectedAt: "2026-09-18T21:03:15.131Z", processedAt: "2026-09-18T21:03:21.409Z", firstVisibleAt: "2026-09-18T21:03:21.415Z", metadata: { reportTimestamps: [{ role: "publisher", timestamp: "Fri, 18 Sep 2026 20:43:47 +0000", referenceUrl: "https://www.ransomware.live/id/example", evidencePath: "feed.entry.publishedAt", extractionMethod: "source_field" }] } });
  const incident = { id: "inc_delivery", title: "Play has just published a new victim: Inglewood Golf", firstSeenAt: capture.collectedAt, confidence: 0.8, entities: [{ type: "ransomware_family", value: "Play" }], captureIds: [capture.id, "cap_second"] };
  store.savePipelineResult({ capture, incident, entities: [], indicators: [] } as any);
  return { store, capture, incident };
}

test("RSS dates survive ingestion and the existing family attribution is shown", () => {
  const { store, incident } = setup();
  const record = store.getTimelinessRecord(incident.id);
  expect(record.firstReportedAt).toBe("2026-09-18T20:43:47.000Z");
  expect(record.observedAt).toBe("2026-09-18T21:03:15.131Z");
  expect(record.reportTimestamps[0].rawTimestamp).toBe("Fri, 18 Sep 2026 20:43:47 +0000");
  expect(buildTimelinessWorkbench([record], { incidents: store.listIncidents() }).items[0].actorName).toBe("Play");
  expect(record.alertCreatedAt).toBeUndefined();
  expect(record.deliveredAt).toBeUndefined();
});

test("retained source evidence repairs a legacy record without inventing delivery", () => {
  const { store, incident } = setup();
  const record = { ...store.getTimelinessRecord(incident.id), reportTimestamps: [], firstReportedAt: undefined, observedAt: undefined };
  const repaired = store.reconcileTimelinessRecord(record);
  expect(repaired.firstReportedAt).toBe("2026-09-18T20:43:47.000Z");
  expect(repaired.deliveredAt).toBeUndefined();
  expect(store.reconcileTimelinessRecord(repaired)).toEqual(repaired);
});

test("later alerts referencing another capture of the same incident retain real event times", () => {
  const { store, incident } = setup();
  store.saveDwmAlert({ id: "alert_delivery", captureIds: ["cap_second"], alertCreatedEvent: { at: "2026-09-18T21:04:00.000Z" } });
  store.saveDwmWebhookDelivery({ id: "delivery_confirmed", alertId: "alert_delivery", status: "delivered", attemptedAt: "2026-09-18T21:04:01.000Z", deliveredAt: "2026-09-18T21:04:02.000Z" });
  expect(store.getTimelinessRecord(incident.id)).toMatchObject({ alertCreatedAt: "2026-09-18T21:04:00.000Z", deliveryAttemptedAt: "2026-09-18T21:04:01.000Z", deliveredAt: "2026-09-18T21:04:02.000Z" });
  expect(store.timelinessMatchesAlert(store.getTimelinessRecord(incident.id), { tenantId: "other", captureIds: ["cap_second"] })).toBe(false);
});

test("current Ransomware.live titles expose actor metadata immediately", () => {
  const source = { id: "src_test", type: "rss", name: "Ransomware.live", metadata: { exposureQueueSource: true } };
  const [item] = feedItems(source, { id: "task_test", targetUrl: "https://www.ransomware.live/rss.xml" }, '<rss><channel><item><title>🏴‍☠️ Play has just published a new victim : Inglewood Golf</title><link>https://www.ransomware.live/id/example</link><pubDate>Fri, 18 Sep 2026 20:43:47 +0000</pubDate></item></channel></rss>', "2026-09-18T21:03:15.131Z", {});
  expect(item.metadata.leakSite).toMatchObject({ actorName: "Play", victimName: "Inglewood Golf" });
});

test("summary is authenticated, global/tenant scoped, and critical only above ten", async () => {
  const store = new InMemoryScraperStore();
  for (let index = 0; index < 11; index++) store.saveTimelinessRecord({ id: `i${index}`, incidentId: `i${index}`, captureId: `c${index}`, sourceId: "s", reportTimestamps: [] });
  store.saveTimelinessRecord({ id: "tenant", tenantId: "private", incidentId: "tenant", captureId: "tenant", sourceId: "s", reportTimestamps: [] });
  const options = { store, serviceToken: "test-only" } as any;
  const call = (query = "", token = "test-only") => handleTimelinessRequest(new Request(`http://local/v1/intel/timeliness/summary${query}`, { headers: { "x-hanasand-service-token": token } }), options);
  expect((await call("", "wrong"))?.status).toBe(401);
  expect(await (await call())!.json()).toMatchObject({ summary: { needsReportCount: 11, status: "critical" } });
  store.saveTimelinessRecord({ ...store.getTimelinessRecord("i0"), tenantId: "private" });
  expect(await (await call())!.json()).toMatchObject({ summary: { needsReportCount: 10, status: "ok" } });
  expect(await (await call("?tenantId=private"))!.json()).toMatchObject({ summary: { needsReportCount: 2, status: "ok" } });
});
