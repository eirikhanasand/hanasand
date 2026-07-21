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

  test("does not present corroborated actor identity as corroborated activity", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_identity_a", tenantId: "tenant_api", name: "MITRE APT29" }));
    store.saveSource(source({ id: "src_identity_b", tenantId: "tenant_api", name: "Vendor APT29" }));
    store.saveCapture(fixtureCapture({ id: "cap_identity_a", sourceId: "src_identity_a", title: "MITRE APT29.display: none; window.dataLayer = window.dataLayer || []", body: "MITRE APT29 .osano-cm-widget{display: none;} window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'UA-62667723-1'); APT29 actor reference &reg; &nbsp; evidence.", publishedAt: "2026-07-20T00:00:00.000Z" }));
    store.saveCapture(fixtureCapture({ id: "cap_identity_b", sourceId: "src_identity_b", url: "https://example.test/vendor", title: "Vendor APT29 reference", body: "APT29 actor reference.", publishedAt: "2026-07-19T00:00:00.000Z" }));
    store.saveIntelligenceClaim({ id: "claim_identity", tenantId: "tenant_api", sourceIds: ["src_identity_a", "src_identity_b"], captureIds: ["cap_identity_a", "cap_identity_b"], claimType: "actor", value: { actor: "APT29" }, summary: "actor: APT29", confidence: 0.84, reviewState: "unreviewed", corroborationState: "corroborated" });

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;
    expect(response.status).toBe("partial");
    expect(response.evidenceAssessment.corroboratedClaimCount).toBe(0);
    expect(response.claims).toEqual([expect.objectContaining({ id: "claim_identity", corroborationState: "corroborated", sourceCount: 2 })]);
    expect(response.rows[0].title).toBe("MITRE APT29");
    expect(response.rows[0].summary).toBe("MITRE APT29 APT29 actor reference ® evidence.");
    expect(JSON.stringify(response)).not.toContain("window.dataLayer");
    expect(JSON.stringify(response)).not.toContain("osano-cm-widget");
    expect(response.recentActivity).toEqual(expect.arrayContaining([
      expect.objectContaining({ publisherCount: 1, corroboratingSourceIds: [], corroborationState: "single_source" })
    ]));
  });
});
