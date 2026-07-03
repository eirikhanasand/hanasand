import { describe, expect, fixtureCapture, FocusedFrontier, handleApiRequest, InMemoryScraperStore, source, test } from "./apiTestHarness.ts";
import { saveExposureClaimFromCollectedItem } from "../api/exposureQueueRoutes.ts";

describe("DWM exposure queue pipeline", () => {
  test("ingests parsed actor claims into the queue and shared TI search index", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier(), port: 0 } as any;
    const item = {
      sourceName: "Example actor leak monitor",
      title: "BlackSuit has just published a new victim: Contoso Energy",
      text: "BlackSuit victim: Contoso Energy. 82 GB claimed from manufacturing systems.",
      publishedAt: new Date().toISOString(),
      url: "https://news.example.test/contoso-energy"
    };

    const ingest = await handleApiRequest(new Request("http://local/v1/dwm/exposure-claims/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [item] })
    }), options);
    expect(ingest.status).toBe(200);
    const ingestBody = await ingest.json() as any;
    expect(ingestBody.accepted).toBe(1);

    const queue = await handleApiRequest(new Request("http://local/v1/dwm/exposure-queue?limit=5"), options);
    expect(queue.status).toBe(200);
    const queueBody = await queue.json() as any;
    expect(queueBody.status).toBe("live");
    expect(queueBody.items[0].actor).toBe("BlackSuit");
    expect(queueBody.items[0].company).toBe("Contoso Energy");
    expect(queueBody.items[0].metadataOnly).toBe(true);

    const search = await handleApiRequest(new Request("http://local/v1/intel/search?q=Contoso%20Energy"), options);
    expect(search.status).toBe(200);
    const searchBody = await search.json() as any;
    expect(searchBody.rows.some((row: any) => row.victimName === "Contoso Energy" && row.actor === "BlackSuit")).toBe(true);
  });

  test("indexes metadata-only exposure smoke captures in shared TI search", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier(), port: 0 } as any;
    const item = {
      sourceId: "src_qa_ai_parser_smoke",
      sourceName: "Hanasand AI parser smoke",
      title: "Akira has just published a new victim: Hanasand AI Parser Smoke",
      text: "Akira victim: Hanasand AI Parser Smoke. Claimed data: 12 GB claimed. Metadata-only synthetic smoke; no leaked content.",
      publishedAt: new Date().toISOString(),
      url: "https://example.com/hanasand-ai-parser-smoke",
      sourceFamily: "darkweb_metadata"
    };

    const ingest = await handleApiRequest(new Request("http://local/v1/dwm/exposure-claims/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [item] })
    }), options);
    expect(ingest.status).toBe(200);

    const search = await handleApiRequest(new Request("http://local/v1/intel/search?q=Hanasand%20AI%20Parser%20Smoke"), options);
    expect(search.status).toBe(200);
    const searchBody = await search.json() as any;
    expect(searchBody.rows.some((row: any) => row.victimName === "Hanasand AI Parser Smoke" && row.actor === "Akira")).toBe(true);
  });

  test("bridges exposure queue captures into persisted DWM alerts without fake case state", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier(), port: 0 } as any;
    const claim = {
      sourceName: "Example actor leak monitor",
      title: "Akira has just published a new victim: Northwind Health",
      text: "Akira victim: Northwind Health. 15 GB claimed from shared drives.",
      publishedAt: "2026-07-02T00:10:00.000Z",
      url: "https://news.example.test/northwind-health"
    };

    await handleApiRequest(new Request("http://local/v1/dwm/exposure-claims/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [claim] })
    }), options);

    const first = await handleApiRequest(new Request("http://local/v1/dwm/alerts?sourceFamily=darkweb_metadata"), options);
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

    const second = await handleApiRequest(new Request("http://local/v1/dwm/alerts?sourceFamily=darkweb_metadata"), options);
    const secondBody = await second.json() as any;
    const exposureAlerts = secondBody.alerts.filter((alert: any) => alert.workflowContext?.source === "exposure_queue" && alert.company === "Northwind Health");
    expect(exposureAlerts).toHaveLength(1);
  });

  test("promotes collected scraper findings into the exposure queue automatically", async () => {
    const store = new InMemoryScraperStore();
    await saveExposureClaimFromCollectedItem(store, {
      sourceId: "src_public_news",
      title: "Akira claims victim: Fabrikam Manufacturing",
      rawText: "Akira ransomware actor page claims victim: Fabrikam Manufacturing. 44 GB data leak listed with sample records.",
      url: "https://news.example.test/fabrikam",
      collectedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      metadata: { adapter: "public_advisory" }
    });

    const queue = await handleApiRequest(new Request("http://local/v1/dwm/exposure-queue?q=Fabrikam"), { store, frontier: new FocusedFrontier(), port: 0 } as any);
    const queueBody = await queue.json() as any;
    expect(queueBody.items[0].actor).toBe("Akira");
    expect(queueBody.items[0].company).toBe("Fabrikam Manufacturing");
  });

  test("keeps persisted exposure rows visible when the queue is stale", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier(), port: 0 } as any;
    const claim = {
      sourceName: "Example actor leak monitor",
      title: "LockBit has just published a new victim: Alpine Robotics",
      text: "LockBit victim: Alpine Robotics. 22 GB claimed from engineering systems.",
      publishedAt: "2026-01-01T00:00:00.000Z",
      capturedAt: "2026-01-01T00:05:00.000Z",
      url: "https://news.example.test/alpine-robotics"
    };

    await handleApiRequest(new Request("http://local/v1/dwm/exposure-claims/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [claim] })
    }), options);

    const queue = await handleApiRequest(new Request("http://local/v1/dwm/exposure-queue?limit=5"), options);
    const queueBody = await queue.json() as any;
    expect(queueBody.status).toBe("stale");
    expect(queueBody.scheduler.state).toBe("due");
    expect(queueBody.items).toHaveLength(1);
    expect(queueBody.items[0].actor).toBe("LockBit");
    expect(queueBody.items[0].company).toBe("Alpine Robotics");
  });

  test("paginates live exposure queue rows for landing-page infinite scroll", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier(), port: 0 } as any;
    for (let index = 0; index < 9; index++) {
      await handleApiRequest(new Request("http://local/v1/dwm/exposure-claims/ingest", {
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

    const first = await handleApiRequest(new Request("http://local/v1/dwm/exposure-queue?limit=4"), options);
    const firstBody = await first.json() as any;
    expect(firstBody.items).toHaveLength(4);
    expect(firstBody.counts.total).toBe(9);
    expect(firstBody.page).toMatchObject({ limit: 4, offset: 0, total: 9, nextOffset: 4, hasMore: true });

    const second = await handleApiRequest(new Request("http://local/v1/dwm/exposure-queue?limit=4&offset=4"), options);
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
    store.saveSource(source({
      id: "src_canary_ransomwarelive",
      name: "Ransomware.live Victim Feed",
      metadata: { sourceFamily: "public_actor_claims" }
    }));
    store.saveCapture(fixtureCapture({
      id: "cap_akira_refinery",
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
    expect(queueBody.items[0].claimedData).toBe("15 GB");
  });
});
