import { describe, expect, test } from "bun:test";
import { findSearchCaptures } from "../api/searchCaptureIndex.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { fixtureCapture } from "./helpers/apiFixtures.ts";
import { source } from "./helpers/plannerFixtures.ts";

describe("search capture index", () => {
  test("indexes retained historical actor evidence", () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_apt29_history", metadata: { queryClass: "threat-intel" } }));
    store.saveCapture(fixtureCapture({ id: "cap_apt29_history", sourceId: "src_apt29_history", body: undefined, publishedAt: "2025-09-01T00:00:00.000Z", collectedAt: "2026-07-21T00:00:00.000Z", metadata: { safeExcerpt: "Amazon disrupted an APT29 watering hole campaign targeting diplomatic organizations with credential phishing and malware." } }));
    expect(findSearchCaptures(store, "APT29", 10, "tenant_api")).toEqual([expect.objectContaining({ id: "cap_apt29_history" })]);
  });
});
