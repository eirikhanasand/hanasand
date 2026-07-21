import { describe, expect, test, body, handleApiRequest, api, fixtureCapture, InMemoryScraperStore, FocusedFrontier, source } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("fuses compact actor profile into live search output", async () => {
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&entityType=actor"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    })) as any;
    expect(response.query).toBe("APT29");
    expect(response.queryKind).toBe("actor");
    expect(typeof response.summary).toBe("string");
    expect(response.actorProfile).toMatchObject({ query: "APT29" });
    expect(response.lastSeen).toBeUndefined();
    expect(response.actorIntelligence.firstSeen).toBeUndefined();
    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("cookie=");
    expect(serialized).not.toContain("password=");

  });

  test("does not present same-source captures as cross-source corroboration", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_single", tenantId: "tenant_api", name: "Single publisher" }));
    store.saveCapture(fixtureCapture({ id: "cap_single_a", sourceId: "src_single", body: "APT29 launched a credential phishing campaign against diplomatic organizations using malware.", metadata: { actorName: "APT29" }, publishedAt: "2026-07-20T00:00:00.000Z" }));
    store.saveCapture(fixtureCapture({ id: "cap_single_b", sourceId: "src_single", url: "https://example.test/second", body: "APT29 watering hole activity targeted diplomatic organizations through Microsoft authentication.", metadata: { actorName: "APT29" }, publishedAt: "2026-07-19T00:00:00.000Z" }));
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
    store.saveCapture(fixtureCapture({ id: "cap_identity_a", sourceId: "src_identity_a", title: "MITRE APT29.display: none; window.dataLayer = window.dataLayer || []", body: "MITRE APT29 .osano-cm-widget{display: none;} window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'UA-62667723-1'); APT29 actor reference &reg; &nbsp; evidence.", metadata: { actorName: "APT29" }, publishedAt: "2026-07-20T00:00:00.000Z" }));
    store.saveCapture(fixtureCapture({ id: "cap_identity_b", sourceId: "src_identity_b", url: "https://example.test/vendor", title: "Vendor APT29 reference", body: "APT29 actor reference.", metadata: { actorName: "APT29" }, publishedAt: "2026-07-19T00:00:00.000Z" }));
    store.saveExtractedEntity({ id: "country_identity", tenantId: "tenant_api", captureId: "cap_identity_a", sourceId: "src_identity_a", type: "country", value: "Russia", normalizedValue: "russia", confidence: 0.8 });
    store.saveExtractedEntity({ id: "sector_identity", tenantId: "tenant_api", captureId: "cap_identity_a", sourceId: "src_identity_a", type: "sector", value: "defense", normalizedValue: "defense", confidence: 0.8 });
    store.saveIntelligenceClaim({ id: "claim_identity", tenantId: "tenant_api", sourceIds: ["src_identity_a", "src_identity_b"], captureIds: ["cap_identity_a", "cap_identity_b"], claimType: "actor", value: { actor: "APT29", summary: "window.dataLayer = window.dataLayer || []; APT29 actor reference." }, summary: "actor: APT29", confidence: 0.84, reviewState: "unreviewed", corroborationState: "corroborated" });

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;
    expect(response.status).toBe("partial");
    expect(response.evidenceAssessment.corroboratedClaimCount).toBe(0);
    expect(response.claims).toEqual([expect.objectContaining({ id: "claim_identity", corroborationState: "corroborated", sourceCount: 2 })]);
    expect(response.rows[0].title).toBe("MITRE APT29");
    expect(response.rows[0].summary).toBe("APT29 actor reference ® evidence.");
    expect(response.targets).toEqual([]);
    expect(response.actorIntelligence.targetSectors).toEqual([]);
    expect(response.actorIntelligence.geographies).toEqual([]);
    expect(JSON.stringify(response)).not.toContain("window.dataLayer");
    expect(JSON.stringify(response)).not.toContain("osano-cm-widget");
    expect(response.recentActivity).toEqual(expect.arrayContaining([
      expect.objectContaining({ publisherCount: 1, corroboratingSourceIds: [], corroborationState: "single_source" })
    ]));
  });

  test("keeps structured ransomware identity ahead of incidental actor mentions", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_braincipher", tenantId: "tenant_api", name: "Ransomware.live BrainCipher" }));
    store.saveCapture(fixtureCapture({
      id: "cap_braincipher",
      sourceId: "src_braincipher",
      title: "BrainCipher victim publication",
      body: "BrainCipher published a victim and referenced a leaked LockBit Black builder in the background section.",
      metadata: { ransomwareGroup: { actorName: "BrainCipher", aliases: [] } },
      publishedAt: "2026-07-20T00:00:00.000Z"
    }));
    store.saveExtractedEntity({ id: "actor_braincipher", tenantId: "tenant_api", captureId: "cap_braincipher", sourceId: "src_braincipher", type: "ransomware_family", value: "BrainCipher", normalizedValue: "braincipher", confidence: 0.9 });

    const lockbit = await body(await handleApiRequest(api("/v1/intel/search?q=LockBit&entityType=actor&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;
    const brainCipher = await body(await handleApiRequest(api("/v1/intel/search?q=BrainCipher&entityType=actor&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;

    expect(lockbit.rows).toEqual([]);
    expect(lockbit.lastSeen).toBeUndefined();
    expect(brainCipher.rows).toEqual([expect.objectContaining({ id: "cap_braincipher", actor: "BrainCipher" })]);
    expect(brainCipher.actorProfile.actor).toBe("BrainCipher");
  });

  test("resolves actor aliases and only emits source-backed attribution", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_apt29_attribution", tenantId: "tenant_api", name: "Public attribution report" }));
    store.saveCapture(fixtureCapture({
      id: "cap_apt29_attribution",
      sourceId: "src_apt29_attribution",
      title: "APT29 attribution report",
      body: "APT29 is linked to Russia's SVR in the cited public report. The report describes espionage activity.",
      publishedAt: "2026-07-18T00:00:00.000Z"
    }));
    store.saveExtractedEntity({ id: "actor_apt29", tenantId: "tenant_api", captureId: "cap_apt29_attribution", sourceId: "src_apt29_attribution", type: "actor", value: "APT29", normalizedValue: "apt29", confidence: 0.9 });
    store.saveExtractedEntity({ id: "country_apt29", tenantId: "tenant_api", captureId: "cap_apt29_attribution", sourceId: "src_apt29_attribution", type: "country", value: "Russia", normalizedValue: "russia", confidence: 0.8 });

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Midnight%20Blizzard&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;

    expect(response.queryKind).toBe("actor");
    expect(response.rows).toEqual([expect.objectContaining({ id: "cap_apt29_attribution" })]);
    expect(response.actorProfile.actor).toBe("APT29");
    expect(response.actorIntelligence.attribution).toBe("APT29 is linked to Russia's SVR in the cited public report.");
    expect(response.actorIntelligence.attributionEvidence).toEqual({
      sourceId: "src_apt29_attribution",
      sourceName: "Public attribution report",
      provenance: "https://example.test/api-evidence",
      reportDate: "2026-07-18T00:00:00.000Z",
      captureId: "cap_apt29_attribution"
    });
    expect(response.targets).toEqual([]);
    expect(response.actorIntelligence.geographies).toEqual([]);
  });

  test("requires complete actor alias phrases instead of matching common alias words", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_actor_noise", tenantId: "tenant_api", name: "Public Babuk feed", metadata: { queryClass: "threat-intel", queryTerm: "Babuk" } }));
    store.saveSource(source({ id: "src_actor_identity", tenantId: "tenant_api", name: "Public APT29 feed", metadata: { queryClass: "threat-intel", queryTerm: "APT29" } }));
    store.saveCapture(fixtureCapture({
      id: "cap_space_bears",
      sourceId: "src_actor_noise",
      title: "Space Bears surge in ransomware attacks",
      body: "The report covers manufacturing attacks by unrelated ransomware groups.",
      publishedAt: "2026-07-18T00:00:00.000Z"
    }));
    store.saveCapture(fixtureCapture({
      id: "cap_the_gentlemen",
      sourceId: "src_actor_noise",
      title: "Inside The Gentlemen leak",
      body: "The report describes a new ransomware service.",
      publishedAt: "2026-07-19T00:00:00.000Z"
    }));
    store.saveCapture(fixtureCapture({
      id: "cap_midnight_blizzard",
      sourceId: "src_actor_identity",
      title: "Midnight Blizzard attribution",
      body: "Midnight Blizzard is linked to Russia's SVR in this public threat-actor espionage report.",
      publishedAt: "2026-07-20T00:00:00.000Z"
    }));
    store.saveExtractedEntity({ id: "actor_midnight_blizzard", tenantId: "tenant_api", captureId: "cap_midnight_blizzard", sourceId: "src_actor_identity", type: "actor", value: "APT29", normalizedValue: "apt29", confidence: 0.9 });

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&entityType=actor&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;

    expect(response.rows.map((row: any) => row.id)).toEqual(["cap_midnight_blizzard"]);
    expect(response.actorIntelligence.attribution).toBe("Midnight Blizzard is linked to Russia's SVR in this public threat-actor espionage report.");
    expect(response.actorIntelligence.attributionEvidence).toMatchObject({ sourceId: "src_actor_identity", reportDate: "2026-07-20T00:00:00.000Z", captureId: "cap_midnight_blizzard" });
  });

  test("keeps headline-only attribution after repeated feed wrappers are removed", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_google_attribution", tenantId: "tenant_api", name: "Google News threat RSS: APT29", metadata: { queryClass: "threat-intel", queryTerm: "APT29" } }));
    store.saveCapture(fixtureCapture({
      id: "cap_google_attribution",
      sourceId: "src_google_attribution",
      title: "Amazon stops attack attributed to Russia's APT29 - Recorded Future News",
      body: "Google News threat RSS: APT29 Amazon stops attack attributed to Russia's APT29 - Recorded Future News Amazon stops attack attributed to Russia's APT29 Recorded Future News",
      publishedAt: "2025-09-02T07:00:00.000Z"
    }));
    store.saveExtractedEntity({ id: "actor_google_attribution", tenantId: "tenant_api", captureId: "cap_google_attribution", sourceId: "src_google_attribution", type: "actor", value: "APT29", normalizedValue: "apt29", confidence: 0.9 });

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&entityType=actor&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;

    expect(response.rows[0].summary).toBe("Captured source record from Google News threat RSS: APT29.");
    expect(response.actorIntelligence.attribution).toBe("Amazon stops attack attributed to Russia's APT29 - Recorded Future News");
    expect(response.actorIntelligence.attributionEvidence).toMatchObject({ sourceId: "src_google_attribution", reportDate: "2025-09-02T07:00:00.000Z", captureId: "cap_google_attribution" });
  });

  test("uses persisted incident headlines for legacy captures without trusting inferred actor titles", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_legacy_actor", tenantId: "tenant_api", name: "Legacy public feed", metadata: { queryClass: "threat-intel" } }));
    store.saveCapture(fixtureCapture({
      id: "cap_legacy_headline",
      sourceId: "src_legacy_actor",
      title: undefined,
      body: "APT29 is linked to Russia's SVR in this historical public report.",
      publishedAt: "2026-02-12T08:00:00.000Z"
    }));
    store.saveIncident({ id: "inc_legacy_headline", sourceId: "src_legacy_actor", captureId: "cap_legacy_headline", title: "What is APT29?", summary: "Historical public report.", firstSeenAt: "2026-07-21T00:00:00.000Z", confidence: 0.8, extractorVersion: "legacy", reviewReasons: [] });
    store.saveCapture(fixtureCapture({
      id: "cap_inferred_actor_title",
      sourceId: "src_legacy_actor",
      url: "https://example.test/inferred",
      title: undefined,
      body: "A page that only mentions APT29 in passing.",
      publishedAt: "2026-02-13T08:00:00.000Z"
    }));
    store.saveIncident({ id: "inc_inferred_actor_title", sourceId: "src_legacy_actor", captureId: "cap_inferred_actor_title", title: "APT29", summary: "Extractor-inferred title.", firstSeenAt: "2026-07-21T00:00:00.000Z", confidence: 0.4, extractorVersion: "legacy", reviewReasons: ["low_context"] });

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&entityType=actor&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;

    expect(response.rows).toEqual([expect.objectContaining({ id: "cap_legacy_headline", title: "What is APT29?" })]);
    expect(response.lastSeen).toBe("2026-02-12T08:00:00.000Z");
  });

  test("keeps collection time separate from actor activity dates", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_apt29_dates", tenantId: "tenant_api", name: "APT29 source", metadata: { queryClass: "threat-intel", queryTerm: "APT29" } }));
    store.saveCapture(fixtureCapture({
      id: "cap_apt29_undated",
      sourceId: "src_apt29_dates",
      title: "APT29 reference profile",
      body: "APT29 reference material without an event date.",
      metadata: { actorName: "APT29" },
      publishedAt: undefined,
      collectedAt: "2026-07-21T10:00:00.000Z"
    }));
    store.saveCapture(fixtureCapture({
      id: "cap_apt29_dated",
      sourceId: "src_apt29_dates",
      url: "https://example.test/apt29-dated",
      title: "APT29 public report",
      body: "APT29 campaign report with a publisher timestamp.",
      metadata: { actorName: "APT29" },
      publishedAt: "2026-06-01T00:00:00.000Z",
      collectedAt: "2026-07-21T10:00:00.000Z"
    }));

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&entityType=actor&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;

    expect(response.lastSeen).toBe("2026-06-01T00:00:00.000Z");
    expect(response.actorIntelligence.firstSeen).toBe("2026-06-01T00:00:00.000Z");
    expect(response.recentActivity.find((item: any) => item.title.includes("reference profile")).date).toBeUndefined();
    expect(response.actorProfile.provenance.find((item: any) => item.captureId === "cap_apt29_undated").reportDate).toBeUndefined();
  });

  test("classifies domain and CVE queries without forcing actor semantics", async () => {
    const store = new InMemoryScraperStore();
    const domain = await body(await handleApiRequest(api("/v1/intel/search?q=example.com"), { store, frontier: new FocusedFrontier() })) as any;
    const cve = await body(await handleApiRequest(api("/v1/intel/search?q=CVE-2026-1234"), { store, frontier: new FocusedFrontier() })) as any;
    expect(domain.queryKind).toBe("domain");
    expect(cve.queryKind).toBe("cve");
  });
});
