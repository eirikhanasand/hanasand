import { describe, expect, test, body, handleApiRequest, api, InMemoryScraperStore, FocusedFrontier, processCollectedItem, hashContent } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("exposes compact search quality DTOs without raw evidence", async () => {
    const store = new InMemoryScraperStore();
    store.savePipelineResult(processCollectedItem({ sourceId: "src_quality", url: "https://quality.example.test/apt29", collectedAt: "2026-07-20T00:00:00.000Z", rawText: "APT29 targeted Northwind Health with CVE-2026-1234.", contentHash: hashContent("quality-resolution"), links: [], metadata: {}, sensitive: false }));
    const response = await body(await handleApiRequest(api("/v1/quality/evaluate?q=Akira"), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(response.quality).toBeDefined();
    expect(response.dashboard).toBeDefined();
    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");

  });

  test("returns provenance-backed actor and victim resolution candidates", async () => {
    const store = new InMemoryScraperStore();
    store.savePipelineResult(processCollectedItem({ sourceId: "src_quality", url: "https://quality.example.test/apt29", collectedAt: "2026-07-20T00:00:00.000Z", rawText: "APT29 targeted Northwind Health with CVE-2026-1234.", contentHash: hashContent("quality-resolution"), links: [], metadata: {}, sensitive: false }));
    const response = await body(await handleApiRequest(api("/v1/quality/evaluate?q=APT29"), { store, frontier: new FocusedFrontier() }));
    const workbench = response.entityResolutionWorkbench as any;
    expect(workbench.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "actor_alias", canonicalValue: "APT29", provenance: [expect.objectContaining({ captureId: expect.any(String), sourceId: "src_quality" })] }),
      expect.objectContaining({ kind: "victim_company", canonicalValue: "Northwind Health", reviewState: expect.stringMatching(/proposed|review_required/) })
    ]));
    expect(workbench.humanReview).toMatchObject({ appendOnly: true, endpointTemplate: "/v1/intel/claims/{claimId}/reviews" });
    expect(JSON.stringify(workbench)).not.toContain("APT29 targeted Northwind Health");
  });
});
