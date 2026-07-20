import { expect, test } from "bun:test";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { fixtureCapture } from "./helpers/storageFixtures.ts";

test("capture dedupe compares published timestamps by instant", () => {
  const store = new InMemoryScraperStore();
  store.saveCapture(fixtureCapture({ id: "cap_utc", publishedAt: "2026-07-20T10:00:00.000Z" }));
  expect(store.saveCaptureWithDedupe(fixtureCapture({ id: "cap_offset", publishedAt: "2026-07-20T12:00:00+02:00" }))).toMatchObject({ status: "duplicate", duplicateOf: "cap_utc" });
});
