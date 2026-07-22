import { describe, expect, fixtureCapture, FocusedFrontier, handleApiRequest, InMemoryScraperStore, source, test } from "./apiTestHarness.ts";
import { saveExposureClaimFromCollectedItem } from "../api/exposureQueueRoutes.ts";

Bun.env.HANASAND_AI_API_BASE = "";

const authenticatedRequest = (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("authorization", "Bearer valid-test-session");
  headers.set("id", "analyst-test");
  return new Request(url, { ...init, headers });
};

const testOptions = (store: InMemoryScraperStore, extra: Record<string, unknown> = {}) => ({
  store,
  frontier: new FocusedFrontier(),
  port: 0,
  authApiBase: "http://auth.test/api",
  authFetch: async () => Response.json({ id: "analyst-test", roles: [{ id: "analyst" }] }),
  ...extra
}) as any;

describe("DWM exposure queue pipeline", () => {
  test("rejects unauthenticated manual exposure intake", async () => {
    const store = new InMemoryScraperStore();
    const response = await handleApiRequest(new Request("http://local/v1/dwm/exposure-claims/ingest", { method: "POST", body: JSON.stringify({ items: [{ actor: "Akira", company: "Contoso" }] }) }), { store, frontier: new FocusedFrontier() });
    expect(response.status).toBe(401);
    expect(store.listCaptures()).toHaveLength(0);
  });

  test("ingests parsed actor claims into the queue and shared TI search index", async () => {
    const store = new InMemoryScraperStore();
    const options = testOptions(store);
    const item = {
      sourceName: "Example actor leak monitor",
      title: "BlackSuit has just published a new victim: Contoso Energy",
      text: "BlackSuit victim: Contoso Energy. 82 GB claimed from manufacturing systems.",
      country: "Norway",
      publishedAt: new Date().toISOString(),
      url: "https://news.example.test/contoso-energy"
    };

    const ingest = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-claims/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [item] })
    }), options);
    expect(ingest.status).toBe(200);
    const ingestBody = await ingest.json() as any;
    expect(ingestBody.accepted).toBe(1);
    expect(store.listSources()[0]).toMatchObject({ status: "candidate", governance: { approvalState: "pending", approvalRequired: true, metadataOnly: true } });

    const queue = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-queue?limit=5"), options);
    expect(queue.status).toBe(200);
    const queueBody = await queue.json() as any;
    expect(queueBody.status).toBe("live");
    expect(queueBody.items[0].actor).toBe("BlackSuit");
    expect(queueBody.items[0].company).toBe("Contoso Energy");
    expect(queueBody.items[0].country).toBe("Norway");
    expect(queueBody.items[0].metadataOnly).toBe(true);

    const countryQueue = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-queue?country=Norway&category=Documents"), options);
    const countryQueueBody = await countryQueue.json() as any;
    expect(countryQueueBody.items).toHaveLength(0);

    const filteredQueue = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-queue?country=Norway&size=82"), options);
    const filteredQueueBody = await filteredQueue.json() as any;
    expect(filteredQueueBody.items[0]).toMatchObject({ company: "Contoso Energy", country: "Norway" });

    const search = await handleApiRequest(new Request("http://local/v1/intel/search?tenantId=default&q=Contoso%20Energy"), options);
    expect(search.status).toBe(200);
    const searchBody = await search.json() as any;
    expect(searchBody.rows.some((row: any) => row.victimName === "Contoso Energy" && row.actor === "BlackSuit")).toBe(true);
  });

  test("indexes metadata-only exposure smoke captures in shared TI search", async () => {
    const store = new InMemoryScraperStore();
    const options = testOptions(store);
    const item = {
      sourceId: "src_qa_ai_parser_smoke",
      sourceName: "Hanasand AI parser smoke",
      title: "Akira has just published a new victim: Hanasand AI Parser Smoke",
      text: "Akira victim: Hanasand AI Parser Smoke. Claimed data: 12 GB claimed. Metadata-only synthetic smoke; no leaked content.",
      publishedAt: new Date().toISOString(),
      url: "https://example.com/hanasand-ai-parser-smoke",
      sourceFamily: "darkweb_metadata"
    };

    const ingest = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-claims/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [item] })
    }), options);
    expect(ingest.status).toBe(200);

    const search = await handleApiRequest(new Request("http://local/v1/intel/search?tenantId=default&q=Hanasand%20AI%20Parser%20Smoke"), options);
    expect(search.status).toBe(200);
    const searchBody = await search.json() as any;
    expect(searchBody.rows.some((row: any) => row.victimName === "Hanasand AI Parser Smoke" && row.actor === "Akira")).toBe(true);
  });

  test("bridges exposure queue captures into persisted DWM alerts without fake case state", async () => {
    const store = new InMemoryScraperStore();
    const options = testOptions(store);
    const claim = {
      sourceName: "Example actor leak monitor",
      title: "Akira has just published a new victim: Northwind Health",
      text: "Akira victim: Northwind Health. 15 GB claimed from shared drives.",
      publishedAt: "2026-07-02T00:10:00.000Z",
      url: "https://news.example.test/northwind-health"
    };

    await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-claims/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [claim] })
    }), options);

    const first = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/alerts?sourceFamily=darkweb_metadata"), options);
    const firstBody = await first.json() as any;
    const exposureAlert = firstBody.alerts.find((alert: any) => alert.workflowContext?.source === "exposure_queue" && alert.company === "Northwind Health");

    expect(first.status).toBe(200);
    expect(exposureAlert).toMatchObject({
      eventType: "darkweb.exposure.claim",
      artifactType: "exposure_claim",
      recommendedRoute: "exposure_alert",
      workflowStatus: "new",
      workflowContext: {
        source: "exposure_queue"
      }
    });
    expect(exposureAlert.caseId).toBeUndefined();
    expect(exposureAlert.caseHandoff.identity.caseIdCandidate).toMatch(/^case_/);
    expect(exposureAlert.evidence[0]).toMatchObject({
      sourceName: "Example actor leak monitor",
      captureMode: "metadata_only",
      provenance: { collector: "exposure_queue", metadataOnly: true }
    });

    const second = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/alerts?sourceFamily=darkweb_metadata"), options);
    const secondBody = await second.json() as any;
    const exposureAlerts = secondBody.alerts.filter((alert: any) => alert.workflowContext?.source === "exposure_queue" && alert.company === "Northwind Health");
    expect(exposureAlerts).toHaveLength(1);
  });

  test("promotes collected scraper findings into the exposure queue automatically", async () => {
    const store = new InMemoryScraperStore();
    const publishedAt = "2026-07-20T09:00:00.000Z";
    const collectedAt = "2026-07-20T09:04:00.000Z";
    const collected = {
      sourceId: "src_public_news",
      source: { name: "Ransomware.live Victim Feed", url: "https://www.ransomware.live/rss.xml" },
      title: "Ransomware.live Victim Feed",
      rawText: "Akira has just published a new victim: Fabrikam Manufacturing\nPENDING. Publishes after: 2d remaining. Download: release reference. If you are listed by mistake, contact us.",
      url: "https://www.ransomware.live/id/RmFicmlrYW0gTWFudWZhY3R1cmluZ0Bha2lyYQ==",
      collectedAt,
      publishedAt,
      metadata: { adapter: "public_advisory", reportTimestamps: [{ role: "publisher", timestamp: publishedAt, sourceId: "src_public_news", evidencePath: "feed.entry.publishedAt", extractionMethod: "source_field" }] }
    };
    await saveExposureClaimFromCollectedItem(store, collected);
    await saveExposureClaimFromCollectedItem(store, collected);

    const queue = await handleApiRequest(new Request("http://local/v1/dwm/exposure-queue?q=Fabrikam"), { store, frontier: new FocusedFrontier(), port: 0 } as any);
    const queueBody = await queue.json() as any;
    expect(queueBody.items[0].actor).toBe("Akira");
    expect(queueBody.items[0].company).toBe("Fabrikam Manufacturing");
    expect(store.listCaptures()).toHaveLength(1);
    expect(store.listCaptures()[0]).toMatchObject({ publishedAt, collectedAt });
    expect(store.listTimelinessRecords()[0]).toMatchObject({
      publisherReportedAt: publishedAt,
      firstReportedAt: publishedAt,
      reportedAt: publishedAt,
      firstReportedKind: "publisher",
      firstReportedProvenance: { sourceId: "src_public_news", captureId: store.listCaptures()[0].id, evidencePath: "feed.entry.publishedAt" },
      latencies: { publicationToCollectionSeconds: 240 }
    });
    expect(store.listExtractedEntities().filter((entity: any) => entity.type === "victim")).toEqual([
      expect.objectContaining({ value: "Fabrikam Manufacturing", extractionMethod: "source_specific" })
    ]);
    expect(store.listExtractedEntities()).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "publication_strategy", value: "public victim listing" }),
      expect.objectContaining({ type: "publication_strategy", value: "staged publication status", provenance: [expect.objectContaining({ evidenceText: expect.stringContaining("PENDING") })] }),
      expect.objectContaining({ type: "publication_strategy", value: "public data release link", provenance: [expect.objectContaining({ evidenceText: expect.stringContaining("Download:") })] }),
      expect.objectContaining({ type: "victim_pressure_tactic", value: "countdown to publication", provenance: [expect.objectContaining({ evidenceText: expect.stringContaining("Publishes after") })] }),
      expect.objectContaining({ type: "channel_type", value: "public victim-claim feed" })
    ]));
    expect(store.listCaptures()[0].metadata?.leakSite?.summary).toContain("Publishes after");
    expect(store.listExtractedEntities().some((entity: any) => ["communication_channel", "buyer_seller_communication", "intermediary_communication", "profitability_signal", "extortion_type"].includes(entity.type))).toBe(false);
    const search = await handleApiRequest(new Request("http://local/v1/intel/search?tenantId=default&q=Akira&entityType=actor"), { store, frontier: new FocusedFrontier(), port: 0 } as any);
    const businessModel = (await search.json() as any).actorIntelligence.businessModel;
    expect(businessModel).toMatchObject({
      evidenceState: "observed_mechanisms",
      publicationStrategies: expect.arrayContaining([expect.objectContaining({ value: "staged publication status", sourceIds: ["src_public_news"], captureIds: [store.listCaptures()[0].id] })]),
      pressureTactics: [expect.objectContaining({ value: "countdown to publication" })],
      buyerSellerCommunications: [],
      intermediaryCommunications: [],
      monetizationPaths: [],
      profitabilitySignals: []
    });
    expect(businessModel.missingEvidence).toEqual(expect.arrayContaining([
      "pricing or ransom demands",
      "payment demands or methods",
      "independently verified revenue",
      "independently verified profitability"
    ]));
  });

  test("does not turn a victim-feed label into an actor profile", async () => {
    const store = new InMemoryScraperStore();
    const collected = {
      sourceId: "src_canary_ransomwarelive",
      source: { name: "Ransomware.live Victim Feed", url: "https://www.ransomware.live/rss.xml" },
      title: "Ransomware.live Victim Feed",
      rawText: "Ransomware.live Victim Feed\nExample Manufacturing\n44 GB data leak listed with sample records.",
      url: "https://www.ransomware.live/#/recentvictims",
      collectedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      metadata: { adapter: "rss" }
    };

    expect(await saveExposureClaimFromCollectedItem(store, collected)).toBeUndefined();
    expect(store.listCaptures()).toHaveLength(0);
    expect(store.listActorProfiles()).toHaveLength(0);
  });

  test("keeps persisted exposure rows visible when the queue is stale", async () => {
    const store = new InMemoryScraperStore();
    const options = testOptions(store);
    const claim = {
      sourceName: "Example actor leak monitor",
      title: "LockBit has just published a new victim: Alpine Robotics",
      text: "LockBit victim: Alpine Robotics. 22 GB claimed from engineering systems.",
      publishedAt: "2026-01-01T00:00:00.000Z",
      capturedAt: "2026-01-01T00:05:00.000Z",
      url: "https://news.example.test/alpine-robotics"
    };

    await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-claims/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [claim] })
    }), options);

    const queue = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-queue?limit=5"), options);
    const queueBody = await queue.json() as any;
    expect(queueBody.status).toBe("stale");
    expect(queueBody.scheduler.state).toBe("due");
    expect(queueBody.items).toHaveLength(1);
    expect(queueBody.items[0].actor).toBe("LockBit");
    expect(queueBody.items[0].company).toBe("Alpine Robotics");
  });

  test("paginates live exposure queue rows for landing-page infinite scroll", async () => {
    const store = new InMemoryScraperStore();
    const options = testOptions(store);
    for (let index = 0; index < 9; index++) {
      await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-claims/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: [{
            sourceName: "Example actor leak monitor",
            title: `Akira has just published a new victim: Landing Queue ${index}`,
            text: `Akira victim: Landing Queue ${index}. 10 GB claimed from public actor page.`,
            publishedAt: new Date(Date.UTC(2026, 6, 2, 10, index)).toISOString(),
            url: `https://news.example.test/landing-queue-${index}`
          }]
        })
      }), options);
    }

    const first = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-queue?limit=4"), options);
    const firstBody = await first.json() as any;
    expect(firstBody.items).toHaveLength(4);
    expect(firstBody.counts.total).toBe(9);
    expect(firstBody.page).toMatchObject({ limit: 4, offset: 0, total: 9, nextOffset: 4, hasMore: true });

    const second = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-queue?limit=4&offset=4"), options);
    const secondBody = await second.json() as any;
    expect(secondBody.items).toHaveLength(4);
    expect(secondBody.page).toMatchObject({ limit: 4, offset: 4, total: 9, nextOffset: 8, hasMore: true });
    expect(new Set([...firstBody.items, ...secondBody.items].map((item: any) => item.id)).size).toBe(8);
  });

  test("does not promote generic advisory or ATT&CK text as victim claims", async () => {
    const store = new InMemoryScraperStore();
    await saveExposureClaimFromCollectedItem(store, {
      sourceId: "src_seed_cisa_known_exploited_vulns",
      title: "CISA Catalog of Known Exploited Vulnerabilities",
      rawText: "CVE entry says an attacker can obtain a technician session and may target victims in some configurations.",
      url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
      collectedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      metadata: { adapter: "public_advisory", sourceName: "CISA Known Exploited Vulnerabilities Catalog" }
    });
    await saveExposureClaimFromCollectedItem(store, {
      sourceId: "src_seed_mitre_attack_enterprise",
      title: "MITRE ATT&CK Enterprise",
      rawText: "Technique page mentions host information and victim environments as generic defensive context.",
      url: "https://attack.mitre.org/",
      collectedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      metadata: { adapter: "public_advisory", sourceName: "MITRE ATT&CK Enterprise" }
    });

    const queue = await handleApiRequest(new Request("http://local/v1/dwm/exposure-queue?limit=5"), { store, frontier: new FocusedFrontier(), port: 0 } as any);
    const queueBody = await queue.json() as any;
    expect(queueBody.status).toBe("empty");
    expect(queueBody.items).toEqual([]);
  });

  test("surfaces existing trusted victim-feed captures without exposure metadata backfill", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource({ ...source({
      id: "src_canary_ransomwarelive",
      name: "Ransomware.live Victim Feed",
      metadata: { sourceFamily: "public_actor_claims" }
    }), tenantId: "default" });
    store.saveCapture(fixtureCapture({
      id: "cap_akira_refinery",
      tenantId: "default",
      sourceId: "src_canary_ransomwarelive",
      title: undefined as any,
      body: "",
      url: "https://www.ransomware.live/#/recentvictims",
      publishedAt: "2026-07-01T13:50:38.000Z",
      collectedAt: "2026-07-02T01:00:48.809Z",
      metadata: {
        adapter: "rss",
        safeExcerpt: "Ransomware.live Victim Feed\n🏴‍☠️ Akira has just published a new victim : Refinery Hotel\nRefinery Hotel is a long descriptive victim-page summary. We will upload 15gb of corporate data soon."
      }
    }));
    store.saveCapture(fixtureCapture({
      id: "cap_cisa_false_positive_backfill",
      tenantId: "default",
      sourceId: "src_seed_cisa_known_exploited_vulns",
      title: "CISA Catalog of Known Exploited Vulnerabilities",
      body: "An attacker may target victims in some configurations.",
      metadata: { adapter: "public_advisory" }
    }));

    const queue = await handleApiRequest(new Request("http://local/v1/dwm/exposure-queue?q=Refinery"), { store, frontier: new FocusedFrontier(), port: 0 } as any);
    const queueBody = await queue.json() as any;
    expect(queueBody.items).toHaveLength(1);
    expect(queueBody.items[0].actor).toBe("Akira");
    expect(queueBody.items[0].company).toBe("Refinery Hotel");
    expect(queueBody.items[0].claimedData).toBe("Corporate data");
    expect(queueBody.items[0].claimedDataSize).toBe("15 GB");
  });

  test("enriches old exposure rows with country from public news records", async () => {
    const store = new InMemoryScraperStore();
    const options = testOptions(store, {
      fetch: async (url: string) => new Response(String(url).includes("gdelt")
        ? JSON.stringify({ articles: [{ title: "Contoso Energy is a Norway-based company after public breach review", url: "https://news.example.test/contoso-country" }] })
        : "<rss><channel><item><title>Contoso Energy headquartered in Norway confirms records review</title><link>https://news.example.test/contoso-norway</link></item></channel></rss>")
    });

    await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-claims/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ sourceName: "Example actor leak monitor", title: "BlackSuit has just published a new victim: Contoso Energy", text: "BlackSuit victim: Contoso Energy. 82 GB claimed.", publishedAt: new Date().toISOString() }] })
    }), options);

    const enriched = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-queue/enrich-countries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: 5 })
    }), options);
    const enrichedBody = await enriched.json() as any;
    expect(enrichedBody.updated).toBe(1);
    expect(enrichedBody.rows[0].country).toBe("Norway");

    const queue = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-queue?country=Norway"), options);
    const queueBody = await queue.json() as any;
    expect(queueBody.items[0]).toMatchObject({ company: "Contoso Energy", country: "Norway" });
  });

  test("enriches domain-only victim names from public country-code domains", async () => {
    const store = new InMemoryScraperStore();
    const options = testOptions(store, { fetch: async () => new Response(JSON.stringify({ articles: [] })) });
    store.saveSource({ ...source({ id: "src_ransomwarelive", name: "Ransomware.live Victim Feed", metadata: { sourceFamily: "public_actor_claims" } }), tenantId: "default" });
    store.saveCapture(fixtureCapture({
      id: "cap_old_domain_country",
      tenantId: "default",
      sourceId: "src_ransomwarelive",
      title: "Incransom has just published a new victim: carvalima.com.br",
      metadata: { leakSite: { actorName: "Incransom", victimName: "carvalima.com.br", claimedDataCategory: "Documents", claimedDataSize: "20 GB" } }
    }));

    const enriched = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-queue/enrich-countries", { method: "POST", body: "{}" }), options);
    const enrichedBody = await enriched.json() as any;
    expect(enrichedBody.rows[0]).toMatchObject({ company: "carvalima.com.br", country: "Brazil", status: "updated" });
  });
});
