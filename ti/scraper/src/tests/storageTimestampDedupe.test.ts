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
