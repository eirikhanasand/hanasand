import { describe, expect, FocusedFrontier, handleApiRequest, InMemoryScraperStore, test } from "./apiTestHarness.ts";
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
    expect(queueBody.items).toEqual([]);
  });
});
