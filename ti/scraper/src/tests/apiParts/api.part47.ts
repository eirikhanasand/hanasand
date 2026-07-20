import { api, body, describe, expect, FocusedFrontier, handleApiRequest, InMemoryScraperStore, source, test } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("searches restricted metadata by actor victim country and sector without locators", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_runtime_tor", type: "tor_metadata", url: "http://runtime.onion/posts", accessMethod: "approved_proxy", status: "active" }));
    store.saveCapture({
      id: "akira",
      sourceId: "src_runtime_tor",
      url: "http://redacted-akira.onion/post",
      collectedAt: "2026-05-24T00:00:00.000Z",
      contentHash: "hash_akira",
      mediaType: "text/plain",
      storageKind: "metadata_only",
      metadata: { leakSite: { actorName: "Akira", victimName: "Fjord Energy AS", claimedSector: "Energy", claimedCountry: "NO", claimedDataCategory: "contracts", urlHash: "urlhash_akira" } },
      sensitive: true,
    } as any);

    for (const query of ["Akira", "Fjord Energy", "NO", "Energy"]) {
      const response = await body(await handleApiRequest(api(`/v1/intel/search?q=${encodeURIComponent(query)}&entityType=actor`), { store, frontier: new FocusedFrontier() })) as Record<string, any>;
      expect(response.restrictedMetadata).toMatchObject({ metadataOnly: true, status: "partial_metadata", sourceCount: 1, matchingResultCount: 1, noLeakSerialization: { passed: true } });
      expect(response.restrictedMetadata.results[0]).toMatchObject({ id: "akira", actorHints: ["Akira"], victimHints: ["Fjord Energy AS"] });
      const serialized = JSON.stringify(response.restrictedMetadata);
      expect(serialized).not.toContain("http://");
      expect(serialized).not.toContain(".onion");
    }
    const unknown = await body(await handleApiRequest(api("/v1/intel/search?q=unknown&entityType=actor"), { store, frontier: new FocusedFrontier() })) as Record<string, any>;
    expect(unknown.restrictedMetadata).toMatchObject({ status: "searching", matchingResultCount: 0 });
  });
});
