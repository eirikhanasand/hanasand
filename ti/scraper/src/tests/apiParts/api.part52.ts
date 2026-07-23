import { actorIdentity, describe, expect, test, body, handleApiRequest, api, fixtureCapture, InMemoryScraperStore, FocusedFrontier, seedActorIdentityCatalog, source } from "../apiTestHarness.ts";

const apt29 = actorIdentity("G0016", "APT29", ["Nobelium", "Cozy Bear", "Midnight Blizzard"]);

describe("api v1", () => {
  test("fuses compact actor profile into live search output", async () => {
    const store = new InMemoryScraperStore();
    seedActorIdentityCatalog(store, [apt29]);
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&entityType=actor"), {
      store,
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
    expect(response.claims).toEqual([expect.objectContaining({ id: "claim_identity", corroborationState: "single_source", sourceCount: 1 })]);
    expect(response.rows[0].title).toBe("MITRE APT29");
    expect(response.rows[0].summary).toBe("APT29 actor reference ® evidence.");
    expect(response.targets).toEqual([]);
    expect(response.actorIntelligence.targetSectors).toEqual([]);
    expect(response.actorIntelligence.geographies).toEqual([]);
    expect(JSON.stringify(response)).not.toContain("window.dataLayer");
    expect(JSON.stringify(response)).not.toContain("osano-cm-widget");
    expect(response.recentActivity).toEqual([]);
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
    seedActorIdentityCatalog(store, [apt29]);
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
    seedActorIdentityCatalog(store, [apt29]);
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
      url: "https://news.google.com/rss/articles/opaque-aggregator-id?oc=5",
      title: "Amazon stops attack attributed to Russia's APT29 - Recorded Future News",
      body: "Google News threat RSS: APT29 Amazon stops attack attributed to Russia's APT29 - Recorded Future News Amazon stops attack attributed to Russia's APT29 Recorded Future News",
      publishedAt: "2025-09-02T07:00:00.000Z"
    }));
    store.saveExtractedEntity({ id: "actor_google_attribution", tenantId: "tenant_api", captureId: "cap_google_attribution", sourceId: "src_google_attribution", type: "actor", value: "APT29", normalizedValue: "apt29", confidence: 0.9 });
    store.saveIndicator({ id: "indicator_google_wrapper", tenantId: "tenant_api", captureId: "cap_google_attribution", sourceId: "src_google_attribution", type: "url", value: "https://news.google.com/rss/articles/opaque-aggregator-id?oc=5", normalizedValue: "https://news.google.com/rss/articles/opaque-aggregator-id?oc=5", confidence: 0.9 });
    store.saveIndicator({ id: "indicator_public_infrastructure", tenantId: "tenant_api", captureId: "cap_google_attribution", sourceId: "src_google_attribution", type: "url", value: "https://infra.example.test/path", normalizedValue: "https://infra.example.test/path", confidence: 0.9 });

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&entityType=actor&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;

    expect(response.rows[0].summary).toBe("Captured source record from Google News threat RSS: APT29.");
    expect(response.actorIntelligence.attribution).toBe("Amazon stops attack attributed to Russia's APT29 - Recorded Future News");
    expect(response.actorIntelligence.attributionEvidence).toMatchObject({ sourceId: "src_google_attribution", reportDate: "2025-09-02T07:00:00.000Z", captureId: "cap_google_attribution" });
    expect(response.actorIntelligence.infrastructure).toEqual(["https://infra.example.test/path"]);
    expect(JSON.stringify(response)).not.toContain("news.google.com/rss/articles");
  });

  test("uses persisted incident headlines for legacy captures without trusting inferred actor titles", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_legacy_actor", tenantId: "tenant_api", name: "Legacy public feed", metadata: { queryClass: "threat-intel" } }));
    store.saveCapture(fixtureCapture({
      id: "cap_legacy_headline",
      sourceId: "src_legacy_actor",
      title: undefined,
      body: "APT29 campaign activity was disrupted in this historical public report.",
      publishedAt: "2026-02-12T08:00:00.000Z"
    }));
    store.saveIncident({ id: "inc_legacy_headline", sourceId: "src_legacy_actor", captureId: "cap_legacy_headline", title: "APT29 campaign disrupted", summary: "Historical public report.", firstSeenAt: "2026-07-21T00:00:00.000Z", confidence: 0.8, extractorVersion: "legacy", reviewReasons: [] });
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

    expect(response.rows).toEqual([expect.objectContaining({ id: "cap_legacy_headline", title: "APT29 campaign disrupted" })]);
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
    expect(response.recentActivity.map((item: any) => item.title)).toEqual(["APT29 public report"]);
    expect(response.actorProfile.provenance.find((item: any) => item.captureId === "cap_apt29_undated").reportDate).toBeUndefined();
  });

  test("derives actor activity dates only from event-bearing evidence", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_apt29_activity", tenantId: "tenant_api", name: "APT29 source", metadata: { queryClass: "threat-intel", queryTerm: "APT29" } }));
    store.saveCapture(fixtureCapture({
      id: "cap_apt29_profile",
      sourceId: "src_apt29_activity",
      title: "MITRE ATT&CK APT29 Group",
      body: "APT29 aliases and reference material.",
      metadata: { actorName: "APT29" },
      publishedAt: undefined
    }));
    store.saveCapture(fixtureCapture({
      id: "cap_apt29_group_dataset",
      sourceId: "src_apt29_activity",
      url: "https://example.test/apt29-group",
      title: "APT29",
      body: "Lineage profile. Public channel classes: DLS, Chat. Public victim listing count: 1387.",
      metadata: { actorName: "APT29" },
      publishedAt: undefined
    }));
    store.saveCapture(fixtureCapture({
      id: "cap_apt29_explainer",
      sourceId: "src_apt29_activity",
      url: "https://example.test/apt29-explainer",
      title: "What is APT29?",
      body: "An explainer about APT29.",
      metadata: { actorName: "APT29" },
      publishedAt: "2026-02-12T08:00:00.000Z"
    }));
    store.saveCapture(fixtureCapture({
      id: "cap_apt29_attack",
      sourceId: "src_apt29_activity",
      url: "https://example.test/apt29-attack",
      title: "Amazon shuts down watering hole attack attributed to APT29",
      body: "Amazon disrupted the APT29 watering hole attack.",
      metadata: { actorName: "APT29" },
      publishedAt: "2025-09-02T07:00:00.000Z"
    }));
    for (const [captureId, title] of [
      ["cap_apt29_profile", "MITRE ATT&CK APT29 Group"],
      ["cap_apt29_group_dataset", "APT29"],
      ["cap_apt29_explainer", "What is APT29?"],
      ["cap_apt29_attack", "Amazon shuts down watering hole attack attributed to APT29"],
    ]) store.saveIncident({ id: `inc_${captureId}`, tenantId: "tenant_api", sourceId: "src_apt29_activity", captureId, title, summary: title, firstSeenAt: "2026-07-21T00:00:00.000Z", confidence: 0.7, extractorVersion: "legacy" });

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&entityType=actor&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;

    expect(response.rows).toHaveLength(4);
    expect(response.recentActivity.map((item: any) => item.title)).toEqual(["Amazon shuts down watering hole attack attributed to APT29"]);
    expect(response.lastSeen).toBe("2025-09-02T07:00:00.000Z");
    expect(response.actorIntelligence.firstSeen).toBe("2025-09-02T07:00:00.000Z");
    expect(response.incidents.map((incident: any) => incident.captureId)).toEqual(["cap_apt29_attack"]);
    expect(response.actorIntelligence.campaigns).toEqual(["Amazon shuts down watering hole attack attributed to APT29"]);
  });

  test("classifies domain, CVE, and indicator queries without forcing actor semantics", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_indicator_report", tenantId: "tenant_api", name: "Indicator report" }));
    store.saveCapture(fixtureCapture({ id: "cap_indicator_report", sourceId: "src_indicator_report", title: "Observed malware network indicator", body: "A public malware investigation reports 203.0.113.10 as observed command-and-control infrastructure and preserves the source evidence for review.", publishedAt: "2026-07-20T00:00:00.000Z" }));
    store.saveIndicator({ id: "indicator_ip", tenantId: "tenant_api", captureId: "cap_indicator_report", sourceId: "src_indicator_report", type: "ipv4", value: "203.0.113.10", normalizedValue: "203.0.113.10", confidence: 0.9 });
    const domain = await body(await handleApiRequest(api("/v1/intel/search?q=example.com"), { store, frontier: new FocusedFrontier() })) as any;
    const cve = await body(await handleApiRequest(api("/v1/intel/search?q=CVE-2026-1234"), { store, frontier: new FocusedFrontier() })) as any;
    const indicator = await body(await handleApiRequest(api("/v1/intel/search?q=203.0.113.10&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;
    expect(domain.queryKind).toBe("domain");
    expect(cve.queryKind).toBe("cve");
    expect(indicator.queryKind).toBe("indicator");
    expect(indicator.rows).toEqual([expect.objectContaining({ id: "cap_indicator_report" })]);
    expect(indicator.actorProfile).toBeUndefined();
    expect(indicator.actorIdentity).toBeUndefined();
    expect(indicator.actorIntelligence).toBeUndefined();
    expect(indicator.evidenceAssessment.missingFields).not.toContain("indicator evidence");
    expect(domain.actorProfile).toBeUndefined();
    expect(domain.actorIdentity).toBeUndefined();
    expect(domain.actorIntelligence).toBeUndefined();
    expect(domain.evidenceAssessment.missingFields).not.toContain("actor");
    expect(domain.actionability.watchlistCandidates).toEqual([{
      kind: "domain",
      value: "example.com",
      reason: "Exact domain supplied by the user; no activity is inferred from the query itself.",
      confidence: 1
    }]);
  });

  test("classifies an exact single-name victim as an organization without creating an actor profile", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_microsoft_report", tenantId: "tenant_api", name: "Microsoft disclosure" }));
    store.saveCapture(fixtureCapture({
      id: "cap_microsoft_report",
      sourceId: "src_microsoft_report",
      title: "Microsoft publishes incident disclosure",
      body: "Microsoft publishes a source-backed incident disclosure.",
      metadata: { exposureClaim: true },
      publishedAt: "2026-07-20T00:00:00.000Z"
    }));
    store.saveExtractedEntity({ id: "victim_microsoft", tenantId: "tenant_api", captureId: "cap_microsoft_report", sourceId: "src_microsoft_report", type: "victim", value: "Microsoft", normalizedValue: "microsoft", confidence: 0.8, extractionMethod: "source_specific" });

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Microsoft&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;

    expect(response.queryKind).toBe("organization");
    expect(response.actorProfile).toBeUndefined();
    expect(response.actorIdentity).toBeUndefined();
    expect(response.actorIntelligence).toBeUndefined();
    expect(response.evidenceAssessment.missingFields).not.toContain("organization evidence");
    expect(response.actionability.watchlistCandidates).toContainEqual(expect.objectContaining({ kind: "company", value: "Microsoft", confidence: 1 }));
  });

  test("keeps deterministic keyword TTPs as row assertions instead of actor characterization", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_ttp_report", tenantId: "tenant_api", name: "TTP report" }));
    store.saveCapture(fixtureCapture({
      id: "cap_ttp_report",
      sourceId: "src_ttp_report",
      title: "APT29 phishing campaign",
      body: "APT29 phishing campaign used source-documented spearphishing.",
      metadata: { actorName: "APT29" },
      publishedAt: "2026-07-20T00:00:00.000Z"
    }));
    store.saveExtractedEntity({ id: "ttp_keyword", tenantId: "tenant_api", captureId: "cap_ttp_report", sourceId: "src_ttp_report", type: "ttp", value: "phishing", normalizedValue: "phishing", confidence: 0.72, extractionMethod: "deterministic_fallback", extractorVersion: "ti-extractor-v2", assertionKind: "extracted" });
    store.saveExtractedEntity({ id: "ttp_documented", tenantId: "tenant_api", captureId: "cap_ttp_report", sourceId: "src_ttp_report", type: "ttp", value: "spearphishing attachment", normalizedValue: "spearphishing attachment", confidence: 0.9, extractionMethod: "source_specific", extractorVersion: "vendor-parser-v1", assertionKind: "observed" });

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;

    expect(response.ttps.map((ttp: any) => ttp.name)).toEqual(["spearphishing attachment"]);
    expect(response.ttps[0]).toMatchObject({ extractionMethod: "source_specific", extractorVersion: "vendor-parser-v1" });
    expect(response.rows[0].assertions).toContainEqual(expect.objectContaining({ id: "ttp_keyword", value: "phishing", extractionMethod: "deterministic_fallback" }));
  });

  test("counts mirrored captures as one activity publisher", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_mirror_a", tenantId: "tenant_api", name: "Publisher mirror A", url: "https://publisher.example/feed-a" }));
    store.saveSource(source({ id: "src_mirror_b", tenantId: "tenant_api", name: "Publisher mirror B", url: "https://publisher.example/feed-b" }));
    for (const [id, sourceId, url] of [["a", "src_mirror_a", "https://publisher.example/a"], ["b", "src_mirror_b", "https://publisher.example/b"]]) {
      store.saveCapture(fixtureCapture({ id: `cap_mirror_${id}`, sourceId, url, title: "APT29 campaign report", body: "A public malware investigation reports that APT29 conducted a credential phishing campaign against diplomatic organizations.", metadata: { actorName: "APT29" }, publishedAt: "2026-07-20T00:00:00.000Z" }));
    }
    store.saveIntelligenceClaim({ id: "claim_mirrored", tenantId: "tenant_api", sourceIds: ["src_mirror_a", "src_mirror_b"], captureIds: ["cap_mirror_a", "cap_mirror_b"], claimType: "incident", value: { actor: "APT29" }, summary: "Mirrored claim", confidence: 0.95, reviewState: "confirmed", corroborationState: "corroborated" });

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;

    expect(response.evidenceAssessment).toMatchObject({ sourceCount: 1, corroboratedClaimCount: 0, confidence: 0.69, ready: true });
    expect(response.evidenceAssessment.reasons).toContain("Single-source evidence is capped below high confidence.");
    expect(response.claims).toEqual([expect.objectContaining({ id: "claim_mirrored", sourceCount: 1, corroborationState: "single_source", reviewState: "confirmed" })]);
    expect(response.recentActivity).toHaveLength(2);
    expect(response.recentActivity.every((item: any) => item.publisherCount === 1 && item.corroboratingSourceIds.length === 0 && item.corroborationState === "single_source")).toBe(true);
  });

  test("keeps ineligible claims visible without treating them as corroborated support", async () => {
    for (const input of [
      { id: "rejected", reviewState: "rejected", corroborationState: "corroborated" },
      { id: "contradicted", reviewState: "contradicted", corroborationState: "contradicted" },
      { id: "needs_review", reviewState: "needs_review", corroborationState: "corroborated" },
      { id: "stale", reviewState: "confirmed", corroborationState: "corroborated", staleAfter: "2026-07-21T00:00:00.000Z" }
    ]) {
      const store = new InMemoryScraperStore();
      store.saveSource(source({ id: `src_${input.id}_a`, tenantId: "tenant_api", name: "Publisher A", url: "https://publisher-a.example/feed" }));
      store.saveSource(source({ id: `src_${input.id}_b`, tenantId: "tenant_api", name: "Publisher B", url: "https://publisher-b.example/feed" }));
      for (const suffix of ["a", "b"]) {
        store.saveCapture(fixtureCapture({ id: `cap_${input.id}_${suffix}`, sourceId: `src_${input.id}_${suffix}`, url: `https://publisher-${suffix}.example/${input.id}`, title: `APT29 ${input.id} campaign report`, body: `A public malware investigation ${suffix} reports that APT29 conducted a credential phishing campaign against diplomatic organizations.`, metadata: { actorName: "APT29" }, publishedAt: "2026-07-20T00:00:00.000Z" }));
      }
      store.saveIntelligenceClaim({ ...input, id: `claim_${input.id}`, tenantId: "tenant_api", sourceIds: [`src_${input.id}_a`, `src_${input.id}_b`], captureIds: [`cap_${input.id}_a`, `cap_${input.id}_b`], claimType: "incident", value: { actor: "APT29" }, summary: `${input.id} claim`, confidence: 0.95 });

      const response = await body(await handleApiRequest(api("/v1/intel/search?q=APT29&tenantId=tenant_api"), { store, frontier: new FocusedFrontier() })) as any;
      const expectedState = input.id === "stale" ? "stale" : input.reviewState;

      expect(response.evidenceAssessment).toMatchObject({ ready: false, confidence: 0.35, corroboratedClaimCount: 0 });
      expect(response.evidenceAssessment.missingFields).toContain("analyst-confirmed claim");
      expect(response.claims).toEqual([expect.objectContaining({ id: `claim_${input.id}`, reviewState: expectedState, corroborationState: input.id === "contradicted" ? "contradicted" : "single_source", sourceCount: 2 })]);
      expect(response.rows.every((row: any) => row.reviewState === expectedState)).toBe(true);
      expect(response.recentActivity.every((item: any) => item.reviewState === expectedState && item.publisherCount === 1 && item.corroboratingSourceIds.length === 0 && item.corroborationState !== "corroborated")).toBe(true);
    }
  });
});
