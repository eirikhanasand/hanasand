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
    expect(findSearchCaptures(store, "APT29 diplomatic", 10, "tenant_api")).toEqual([expect.objectContaining({ id: "cap_apt29_history" })]);
    expect(findSearchCaptures(store, "Definitely Not A Real Actor 2026", 10, "tenant_api")).toEqual([]);
  });

  test("refreshes only changed capture documents", () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_incremental_search", metadata: { queryClass: "threat-intel" } }));
    let oldTitleReads = 0;
    const old = fixtureCapture({ id: "cap_old", sourceId: "src_incremental_search", body: undefined, collectedAt: "2026-05-23T00:00:00.000Z", metadata: { safeExcerpt: "APT29 launched a retained credential phishing campaign against diplomatic organizations." } });
    Object.defineProperty(old, "title", { configurable: true, enumerable: true, get: () => { oldTitleReads++; return "Retained report"; } });
    store.saveCapture(old);
    expect(findSearchCaptures(store, "APT29", 10, "tenant_api").map((capture) => capture.id)).toEqual(["cap_old"]);
    const readsAfterInitialIndex = oldTitleReads;

    store.saveCapture(fixtureCapture({ id: "cap_new", sourceId: "src_incremental_search", title: "New report", body: undefined, contentHash: "new-capture-hash", collectedAt: "2026-05-24T00:00:00.000Z", metadata: { safeExcerpt: "APT29 launched another credential phishing campaign against diplomatic organizations." } }));
    expect(findSearchCaptures(store, "APT29", 10, "tenant_api").map((capture) => capture.id)).toEqual(["cap_new", "cap_old"]);
    expect(oldTitleReads).toBe(readsAfterInitialIndex);

    store.updateCaptureMetadata("cap_old", (metadata) => ({ ...metadata, safeExcerpt: "A retained credential phishing report no longer names the queried actor or activity cluster." }));
    expect(findSearchCaptures(store, "APT29", 10, "tenant_api").map((capture) => capture.id)).toEqual(["cap_new"]);
  });
});
