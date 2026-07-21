import { describe, expect, test, body, handleApiRequest, api, fixtureCapture, InMemoryScraperStore, FocusedFrontier, source } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("fuses compact actor profile into live search output", async () => {
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&entityType=actor"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    }));
    expect(response.query).toBe("APT29");
    expect(typeof response.summary).toBe("string");
    expect(response.actorProfile).toMatchObject({ query: "APT29" });
    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");

  });

  test("does not present same-source captures as cross-source corroboration", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_single", tenantId: "tenant_api", name: "Single publisher" }));
    store.saveCapture(fixtureCapture({ id: "cap_single_a", sourceId: "src_single", body: "APT29 launched a credential phishing campaign against diplomatic organizations using malware.", publishedAt: "2026-07-20T00:00:00.000Z" }));
    store.saveCapture(fixtureCapture({ id: "cap_single_b", sourceId: "src_single", url: "https://example.test/second", body: "APT29 watering hole activity targeted diplomatic organizations through Microsoft authentication.", publishedAt: "2026-07-19T00:00:00.000Z" }));
    store.saveIntelligenceClaim({ id: "claim_single", tenantId: "tenant_api", sourceIds: ["src_single"], captureIds: ["cap_single_a", "cap_single_b"], claimType: "actor_activity", value: { actor: "APT29" }, summary: "APT29 activity", confidence: 0.8, reviewState: "needs_review", corroborationState: "corroborated" });

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;
    expect(response.status).toBe("partial");
    expect(response.evidenceAssessment.corroboratedClaimCount).toBe(0);
    expect(response.claims).toEqual([expect.objectContaining({ id: "claim_single", corroborationState: "single_source", sourceCount: 1 })]);
  });
});
