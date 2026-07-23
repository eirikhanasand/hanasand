import { describe, expect, fixtureCapture, FocusedFrontier, handleApiRequest, InMemoryScraperStore, source, test } from "./apiTestHarness.ts";
import { pinnedPublicAdvisoryLookup, resolvePublicAdvisoryTarget, saveExposureClaimFromCollectedItem } from "../api/exposureQueueRoutes.ts";
import { responseFixture } from "./helpers/adapterFixtureHelpers.ts";

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

  test("fetches real tenant public-incident evidence without fabricating a dark-web victim claim", async () => {
    const store = new InMemoryScraperStore();
    store.saveOrganization({ id: "org_ntnu_research", tenantId: "org_ntnu_research", name: "NTNU research monitor", status: "active" });
    store.saveOrganizationMember({ id: "analyst-test", organizationId: "org_ntnu_research", role: "analyst", status: "active" });
    store.saveDwmWatchlist({
      id: "watch_ntnu_research",
      tenantId: "org_ntnu_research",
      organizationId: "org_ntnu_research",
      name: "NTNU",
      terms: [{ id: "watch_item_ntnu", value: "NTNU", kind: "company" }],
      status: "active",
      createdAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-22T00:00:00.000Z"
    });
    const pageUrl = "https://news.example.test/ntnu-cyberattack";
    const reportUrl = "https://news.example.test/ntnu-cyberattack/";
    const publishedAt = "2025-07-09T11:00:00.000Z";
    const options = testOptions(store, { fetch: async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/robots.txt")) return responseFixture("", { status: 404 }, url);
      if (url === pageUrl) return responseFixture("", { status: 302, headers: { location: reportUrl } }, pageUrl);
      return responseFixture(`<!doctype html><html><head><title>NTNU hit by cyberattack</title><meta property="article:published_time" content="${publishedAt}"></head><body><main><h1>NTNU hit by cyberattack</h1><p>NTNU reports that a supplier ransomware attack exposed names and email addresses.</p></main></body></html>`, { status: 200, headers: { "content-type": "text/html" } }, reportUrl);
    } });
    const ingest = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-claims/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "org_ntnu_research",
        organizationId: "org_ntnu_research",
        items: [{ tenantId: "org_ntnu_research", organizationId: "org_ntnu_research", company: "NTNU", sourceFamily: "public_advisory", url: pageUrl }]
      })
    }), options);
    const ingestBody = await ingest.json() as any;
    expect(ingestBody.accepted).toBe(1);
    expect(store.listSources()[0]).toMatchObject({ tenantId: "org_ntnu_research", type: "public_advisory", status: "active", accessMethod: "public_http", metadata: { canaryPortfolio: true, organizationId: "org_ntnu_research" } });
    expect(store.listCaptures()[0]).toMatchObject({ tenantId: "org_ntnu_research", url: reportUrl, title: "NTNU hit by cyberattack", publishedAt, sensitive: false, metadata: { adapter: "static_web", sourceFamily: "public_advisory", organizationId: "org_ntnu_research" } });
    expect(store.listTimelinessRecords()[0]).toMatchObject({ captureId: store.listCaptures()[0].id, publishedAt, publisherReportedAt: publishedAt, reportTimestamps: [expect.objectContaining({ evidencePath: "page.metadata.datePublished", extractionMethod: "source_field" })] });
    expect(store.listCaptures()[0].metadata?.leakSite).toBeUndefined();
    expect(JSON.stringify(store.listCaptures()[0])).not.toContain("has just published a new victim");

    const rebuild = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/alerts/rebuild", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "org_ntnu_research", organizationId: "org_ntnu_research" })
    }), options);
    const rebuildBody = await rebuild.json() as any;
    expect(rebuildBody.savedAlertCount).toBe(1);
    expect(rebuildBody.alerts[0]).toMatchObject({ tenantId: "org_ntnu_research", organizationId: "org_ntnu_research", sourceFamily: "public_advisory" });
    expect(rebuildBody.alerts[0].evidence.map((row: any) => row.provenance?.captureId)).toContain(store.listCaptures()[0].id);
  });

  test("rejects nonincidents, watch-term-absent pages, redirect downgrades, and private targets", async () => {
    const cases = [
      {
        url: "https://support.example.test/ntnu",
        html: "<html><head><title>NTNU support</title></head><body>If you are listed by mistake, contact us.</body></html>"
      },
      {
        url: "https://news.example.test/other-university",
        html: "<html><head><title>Other university cyberattack</title></head><body>Another university reports a ransomware incident.</body></html>"
      },
      {
        url: "https://news.example.test/downgrade",
        redirect: "http://127.0.0.1/internal"
      },
      {
        url: "https://127.0.0.1/internal",
        html: "<html><body>NTNU cyberattack</body></html>"
      }
    ];
    for (const testCase of cases) {
      const store = new InMemoryScraperStore();
      const options = testOptions(store, { fetch: async (input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
        if (testCase.redirect) return new Response("", { status: 302, headers: { location: testCase.redirect } });
        return new Response(testCase.html, { status: 200, headers: { "content-type": "text/html" } });
      } });
      const ingest = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-claims/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [{ company: "NTNU", sourceFamily: "public_advisory", publishedAt: "2025-07-09T11:00:00.000Z", url: testCase.url }] })
      }), options);
      expect(await ingest.json()).toMatchObject({ accepted: 0, rejected: 1 });
      expect(store.listSources()).toHaveLength(0);
      expect(store.listCaptures()).toHaveLength(0);
    }
  });

  test("rejects oversized and timed-out advisory responses without persistence", async () => {
    for (const fetcher of [
      async (input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
        let sent = 0;
        return new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(750_000)); if (++sent === 3) controller.close(); } }), { headers: { "content-type": "text/html" } });
      },
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
        return await new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true }));
      }
    ]) {
      const store = new InMemoryScraperStore();
      const ingest = await handleApiRequest(authenticatedRequest("http://local/v1/dwm/exposure-claims/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [{ company: "NTNU", sourceFamily: "public_advisory", publishedAt: "2025-07-09T11:00:00.000Z", url: "https://news.example.test/ntnu-incident" }] })
      }), testOptions(store, { fetch: fetcher, publicAdvisoryTimeoutMs: 20 }));
      expect(await ingest.json()).toMatchObject({ accepted: 0, rejected: 1 });
      expect(store.listSources()).toHaveLength(0);
      expect(store.listCaptures()).toHaveLength(0);
    }
  });

  test("rejects private and rebinding DNS answers and pins public IPv4 and IPv6", async () => {
    const publicAddresses = [{ address: "93.184.216.34", family: 4 }, { address: "2606:4700:4700::1111", family: 6 }];
    await expect(resolvePublicAdvisoryTarget("https://news.example.com/report", async () => publicAddresses)).resolves.toMatchObject({ addresses: publicAddresses });
    await expect(resolvePublicAdvisoryTarget("https://127.0.0.1/report", async () => publicAddresses)).rejects.toThrow("public network");
    await expect(resolvePublicAdvisoryTarget("https://[::1]/report", async () => publicAddresses)).rejects.toThrow("public network");
    await expect(resolvePublicAdvisoryTarget("https://news.example.com/report", async () => [publicAddresses[0], { address: "10.0.0.4", family: 4 }])).rejects.toThrow("private network");
    await expect(resolvePublicAdvisoryTarget("https://news.example.com/report", async () => [{ address: "fd00::4", family: 6 }])).rejects.toThrow("private network");

    let resolutions = 0;
    const validated = await resolvePublicAdvisoryTarget("https://news.example.com/report", async () => ++resolutions === 1 ? [publicAddresses[0]] : [{ address: "127.0.0.1", family: 4 }]);
    const pinned = await new Promise<{ address: string; family: number }>((resolve, reject) => pinnedPublicAdvisoryLookup(validated.addresses)("news.example.com", { family: 0, hints: 0, all: false } as any, (cause, address, family) => cause ? reject(cause) : resolve({ address: String(address), family: Number(family) })));
    expect(pinned).toEqual(publicAddresses[0]);
    expect(resolutions).toBe(1);
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
