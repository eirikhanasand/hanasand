import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { TorMetadataHttpBoundary } from "../adapters/torMetadataBoundary.ts";
import { buildRestrictedMetadataStatusRouteResponse } from "../api/restrictedMetadataRoutes.ts";
import { runRestrictedMetadataCollectionCycle } from "../ops/restrictedMetadataCollection.ts";
import { SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION, SOURCE_AUTOMATIC_REVIEW_SCHEMA, automaticSourceReviewIdentity } from "../policy/sourceAutomaticReview.ts";
import { sourceAutomaticReviewEvidenceBindings } from "../api/automaticReviewRoutes.ts";
import { importRestrictedMetadataSeedBundle } from "../registry/restrictedSourceSeeds.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { source } from "./helpers/apiSourceFixtures.ts";

describe("restricted metadata collection", () => {
  test("collects approved onion metadata through the proxy boundary without persisting page content", async () => {
    const store = new InMemoryScraperStore();
    const onion = `${"a".repeat(56)}.onion`;
    let proxy: unknown;
    const boundary = new TorMetadataHttpBoundary({
      proxyUrl: "http://onion-tor:8118",
      fetcher: async (_url, init) => {
        proxy = (init as any).proxy;
        return new Response(`<html><head><title>Akira notices</title><meta name="description" content="Victim: Northwind Health; Sector: healthcare; Country: NO; Data: http://${onion}/private; Data type: contracts; Extortion type: double extortion; Monetization path: ransom demand; Publicity tactic: countdown announcement; Buyer communication: auction contact channel; Intermediary communication: broker listing; Profitability signal: claimed paid victims; Token: should-not-persist; Contact: analyst@example.test; Phone: +47 12 34 56 78"></head><body><article class="news-item"><h2 class="headline"><a>Fabrikam.example</a></h2></article><div class="post-title font">Contoso Manufacturing</div><time datetime="2026-07-20T10:00:00Z"></time>raw page content that must not persist</body></html>`, { status: 200, headers: { "content-type": "text/html" } });
      }
    });
    store.saveSource({
      ...source({
        id: "src_restricted_live",
        type: "tor_metadata",
        url: `http://${onion}/posts`,
        accessMethod: "approved_proxy",
        status: "active",
        risk: "restricted",
        legalNotes: "Approved metadata-only ransomware listing research.",
        governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-20T09:00:00.000Z", approvedBy: "reviewer", policyVersion: "collection-policy:v1" },
        metadata: { actorName: "Akira" }
      }),
      tenantId: "tenant_restricted"
    });

    const result = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-20T10:05:00.000Z" });
    const capture = store.listCaptures()[0];

    expect(result).toMatchObject({ status: "completed", sourceCount: 1, completedSourceCount: 1, failedSourceCount: 0, captureCount: 1, metadataOnly: true });
    expect(proxy).toBe("http://onion-tor:8118/");
    expect(capture).toMatchObject({ sourceId: "src_restricted_live", storageKind: "metadata_only", sensitive: true, body: undefined, metadata: { captureMode: "metadata_only", leakSite: { actorName: "Akira", victimName: "Northwind Health", extortionType: "double extortion", monetizationPath: "ransom demand", publicityTactic: "countdown announcement", buyerSellerCommunication: "auction contact channel", intermediaryCommunication: "broker listing", profitabilitySignal: "claimed paid victims", metadataOnly: true } } });
    expect(capture.metadata.leakSite.victimNames).toEqual(["Fabrikam.example", "Contoso Manufacturing"]);
    expect(store.listExtractedEntities().filter((entity) => entity.type === "victim").map((entity) => entity.value)).toEqual(["Northwind Health", "Fabrikam.example", "Contoso Manufacturing"]);
    const serializedCapture = JSON.stringify(capture);
    expect(capture.url).toMatch(/^https:\/\/restricted\.invalid\/capture\/[a-f0-9]+$/);
    expect(capture.canonicalUrl).toMatch(/^https:\/\/restricted\.invalid\/capture\/[a-f0-9]+$/);
    expect(serializedCapture).not.toContain(onion);
    expect(serializedCapture).not.toContain("/posts");
    expect(serializedCapture).not.toContain("raw page content");
    expect(serializedCapture).not.toContain("should-not-persist");
    expect(serializedCapture).not.toContain("analyst@example.test");
    expect(serializedCapture).not.toContain("+47 12 34 56 78");
    expect(capture.objectRef).toBeUndefined();
    expect(store.listSourceHealthObservations()).toEqual([expect.objectContaining({ sourceId: "src_restricted_live", success: true, useful: true, legalMode: "metadata_only" })]);
    expect(store.listRuns().at(-1)).toMatchObject({ id: result.runId, status: "completed", captureCount: 1 });
  });

  test("stores official transport canary metadata without creating threat intelligence", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource({
      ...source({ id: "src_transport_canary", type: "tor_metadata", url: `http://${"b".repeat(56)}.onion/`, accessMethod: "approved_proxy", status: "active", risk: "high", legalNotes: "Official onion transport canary metadata only.", governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-20T09:00:00.000Z", approvedBy: "reviewer" }, metadata: { transportCanary: true, countsAsCoverage: true, sourcePortfolioQualificationState: "pending_sustained_productivity", sourcePortfolioProductiveCheckCount: 1 } }),
      tenantId: "tenant_restricted"
    });
    const boundary = new TorMetadataHttpBoundary({ proxyUrl: "http://onion-tor:8118", fetcher: async () => new Response("<title>Official transport canary</title><meta name=\"description\" content=\"Safe metadata\">", { headers: { "content-type": "text/html" } }) });

    const first = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-20T10:05:00.000Z" });
    const second = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-20T11:05:00.000Z" });
    const saved = store.getSource("src_transport_canary")!;

    expect(first).toMatchObject({ status: "completed", intelligenceSourceCount: 0, transportProbeCount: 1, captureCount: 1, incidentCount: 0 });
    expect(second).toMatchObject({ status: "completed", intelligenceSourceCount: 0, transportProbeCount: 1, duplicateCount: 1, incidentCount: 0 });
    expect(saved).toMatchObject({ status: "active", countsAsCoverage: false, metadata: { transportCanary: true, countsAsCoverage: false } });
    expect(saved.metadata).not.toHaveProperty("sourcePortfolioQualificationState");
    expect(saved.metadata).not.toHaveProperty("sourcePortfolioProductiveCheckCount");
    expect(saved.metadata).not.toHaveProperty("sourcePortfolioLastProductiveAt");
    expect(store.listCaptures()).toHaveLength(1);
    expect(store.listIncidents()).toHaveLength(0);
    expect(store.listExtractedEntities()).toHaveLength(0);
    expect(store.listSourceHealthObservations()).toHaveLength(2);
    expect(store.listSourceHealthObservations().every((observation) => observation.useful === false && observation.observedActorCount === 0)).toBe(true);
  });

  test("extracts current SafePay, Blackwater, and Space Bears victim-card metadata without retaining locators or dynamic page text", async () => {
    const pages: Record<string, string> = {
      SafePay: '<title>Safepay Blog</title><div class="card"><h5 class="card-title text-center">Northwind Health</h5><div>countdown 00:01</div></div><a href="http://' + "c".repeat(56) + '.onion/download/archive.zip">payload</a>',
      Blackwater: '<title>Blackwater Blog</title><div class="card"><h5 class="card-title">Minidoka Memorial Hospital</h5><div>download patient files</div></div>',
      "Space Bears": '<title>Space Bears</title><div class="companies-list__item"><div class="name">Contoso Manufacturing</div><div>countdown 00:02</div></div>'
    };
    for (const actorName of ["SafePay", "Blackwater", "Space Bears"]) {
      const actorBoundary = new TorMetadataHttpBoundary({ proxyUrl: "http://onion-tor:8118", fetcher: async () => new Response(pages[actorName], { headers: { "content-type": "text/html" } }) });
      const metadata = await actorBoundary.fetchMetadata({ url: `http://${"a".repeat(56)}.onion/`, actorName });
      expect(metadata.victimNames).toHaveLength(1);
      expect(metadata.description).not.toContain("countdown");
      expect(metadata.links).toEqual([]);
    }
  });

  test("persists Qilin, Nova, and Interlock victim-list formats as metadata only", async () => {
    const store = new InMemoryScraperStore();
    const pages: Record<string, string> = {
      q: '<title>Qilin blog</title><div class="item_box"><h3 class="item_box-title">Qilin Victim</h3><div>countdown 00:01</div></div>',
      n: '<title>Nova Blog</title><div class="post-card"><p class="post-date">JUL 22, 2026</p><a class="logo">Nova Victim</a><p class="post-excerpt">dynamic description</p></div>',
      i: '<title>Interlock</title><div class="advert_item"><div class="advert_info_title">Interlock Victim</div><div>dynamic listing detail</div></div>'
    };
    const boundary = new TorMetadataHttpBoundary({
      proxyUrl: "http://onion-tor:8118",
      fetcher: async (url) => new Response(pages[new URL(String(url)).hostname[0]] ?? "", { headers: { "content-type": "text/html" } })
    });
    for (const [host, actorName] of [["q", "Qilin"], ["n", "Nova"]]) store.saveSource(source({ id: `src_${actorName.toLowerCase()}`, type: "tor_metadata", url: `http://${host.repeat(56)}.onion/`, accessMethod: "approved_proxy", status: "active", risk: "restricted", legalNotes: "Approved public victim-listing metadata only.", governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-22T09:00:00.000Z", approvedBy: "reviewer" }, metadata: { actorName } }));

    const first = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-22T14:00:00.000Z" });
    store.saveSource(source({ id: "src_interlock", type: "tor_metadata", url: `http://${"i".repeat(56)}.onion/`, accessMethod: "approved_proxy", status: "active", risk: "restricted", legalNotes: "Approved public victim-listing metadata only.", governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-22T09:00:00.000Z", approvedBy: "reviewer" }, metadata: { actorName: "Interlock" } }));
    const second = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-22T14:01:00.000Z" });

    expect(first).toMatchObject({ status: "completed", intelligenceSourceCount: 2, captureCount: 2 });
    expect(second).toMatchObject({ status: "completed", intelligenceSourceCount: 1, captureCount: 1 });
    expect(store.listCaptures().map((capture) => capture.metadata.leakSite.victimName).sort()).toEqual(["Interlock Victim", "Nova Victim", "Qilin Victim"]);
    expect(store.listCaptures().every((capture) => capture.storageKind === "metadata_only" && !capture.body && !capture.objectRef && !capture.metadata.leakSite.links?.length)).toBe(true);
    expect(store.listExtractedEntities().filter((entity) => entity.type === "victim").map((entity) => entity.value).sort()).toEqual(["Interlock Victim", "Nova Victim", "Qilin Victim"]);
    expect(JSON.stringify(store.listCaptures())).not.toContain("dynamic");
  });

  test("persists allowlisted Lamashtu JSON victim fields without retaining other response data", async () => {
    const store = new InMemoryScraperStore();
    const restrictedHost = `${"z".repeat(56)}.onion`;
    const response = {
      posts: [
        { title: "Great Foods", publish_at: "2026-06-17T18:24:19.153Z", short_desc: `token=do-not-store http://${restrictedHost}/files`, images: ["patient-records.zip"], website: "analyst@example.test" },
        { title: "PatayaFood", publish_at: "2026-06-16T10:00:00Z" },
        { title: `http://${restrictedHost}/not-a-victim`, publish_at: "2026-06-18T10:00:00Z" }
      ],
      limit: 20,
      page: 1,
      total: 34
    };
    const boundary = new TorMetadataHttpBoundary({
      proxyUrl: "http://onion-tor:8118",
      fetcher: async () => new Response(JSON.stringify(response), { headers: { "content-type": "application/json; charset=utf-8" } })
    });
    store.saveSource(source({
      id: "src_lamashtu",
      type: "tor_metadata",
      url: `http://${"l".repeat(56)}.onion/`,
      accessMethod: "approved_proxy",
      status: "candidate",
      risk: "restricted",
      legalNotes: "Approved public JSON victim-listing metadata only; no response body retention.",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-23T19:00:00.000Z", approvedBy: "reviewer" },
      metadata: {
        actorName: "Lamashtu",
        restrictedMetadataCandidate: true,
        productionCollection: false,
        countsAsCoverage: false,
        sourcePortfolioVerification: {
          verifiedAt: "2026-07-23T19:00:00.000Z",
          legalBasisVerifiedAt: "2026-07-23T19:00:00.000Z",
          outcome: "content_parsed",
          observedItemCount: 2
        }
      }
    }));

    const result = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-23T19:30:00.000Z" });
    const captures = store.listCaptures();
    const serialized = JSON.stringify(captures);

    expect(result).toMatchObject({ status: "completed", intelligenceSourceCount: 1, completedSourceCount: 1, captureCount: 1, incidentCount: 1 });
    expect(captures[0].metadata.leakSite.victimNames).toEqual(["Great Foods", "PatayaFood"]);
    expect(captures[0].metadata.leakSite.sourceTimestamp).toBe("2026-06-17T18:24:19.153Z");
    expect(captures.every((capture) => capture.storageKind === "metadata_only" && !capture.body && !capture.objectRef && !capture.metadata.leakSite.links?.length)).toBe(true);
    expect(serialized).not.toContain(restrictedHost);
    expect(serialized).not.toContain("do-not-store");
    expect(serialized).not.toContain("patient-records.zip");
    expect(serialized).not.toContain("analyst@example.test");
    expect(store.listSources().every((item) => item.status === "candidate" && item.countsAsCoverage === false && item.metadata.productionCollection === false)).toBe(true);
  });

  test("persists allowlisted Genesis section-card names without retaining card details", async () => {
    const store = new InMemoryScraperStore();
    const restrictedHost = `${"z".repeat(56)}.onion`;
    const html = `<title>Genesis</title>
      <section class="block-bg relative"><h2>Northwind Health</h2><div>token=do-not-store analyst@example.test</div><a href="http://${restrictedHost}/files">details</a></section>
      <section class="block-bg relative"><h2>Contoso Manufacturing</h2><div>private file listing</div></section>
      <section class="block-bg relative"><h2>http://${restrictedHost}/not-a-victim</h2></section>`;
    const boundary = new TorMetadataHttpBoundary({
      proxyUrl: "http://onion-tor:8118",
      fetcher: async () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
    });
    store.saveSource(source({
      id: "src_genesis",
      type: "tor_metadata",
      url: `http://${"g".repeat(56)}.onion/`,
      accessMethod: "approved_proxy",
      status: "candidate",
      risk: "restricted",
      legalNotes: "Approved public victim-card metadata only; no card details or response body retention.",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-24T08:30:00.000Z", approvedBy: "reviewer" },
      metadata: {
        actorName: "Genesis",
        restrictedMetadataCandidate: true,
        productionCollection: false,
        countsAsCoverage: false,
        sourcePortfolioVerification: {
          verifiedAt: "2026-07-24T08:30:00.000Z",
          legalBasisVerifiedAt: "2026-07-24T08:30:00.000Z",
          outcome: "content_parsed",
          observedItemCount: 2
        }
      }
    }));

    const result = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-24T09:00:00.000Z" });
    const capture = store.listCaptures()[0];
    const serialized = JSON.stringify(capture);

    expect(result).toMatchObject({ status: "completed", intelligenceSourceCount: 1, captureCount: 1, incidentCount: 1, failedSourceCount: 0 });
    expect(capture.metadata.leakSite.victimNames).toEqual(["Northwind Health", "Contoso Manufacturing"]);
    expect(capture.storageKind).toBe("metadata_only");
    expect(capture.body).toBeUndefined();
    expect(capture.objectRef).toBeUndefined();
    expect(serialized).not.toContain(restrictedHost);
    expect(serialized).not.toContain("do-not-store");
    expect(serialized).not.toContain("analyst@example.test");
    expect(serialized).not.toContain("private file listing");
    expect(store.listSourceHealthObservations()[0]).toMatchObject({ success: true, useful: true, captureCount: 1, parserWarningCount: 0 });
    expect(store.getSource("src_genesis")).toMatchObject({ status: "candidate", countsAsCoverage: false, metadata: { productionCollection: false, countsAsCoverage: false } });
    expect((await boundary.fetchMetadata({ url: `http://${"g".repeat(56)}.onion/`, actorName: "Unapproved" })).victimNames).toEqual([]);
  });

  test("rejects malformed or non-allowlisted JSON through the Tor boundary", async () => {
    const malformed = new TorMetadataHttpBoundary({ proxyUrl: "http://onion-tor:8118", fetcher: async () => new Response("{", { headers: { "content-type": "application/json" } }) });
    const unsupported = new TorMetadataHttpBoundary({ proxyUrl: "http://onion-tor:8118", fetcher: async () => new Response('{"posts":[{"title":"Victim"}]}', { headers: { "content-type": "application/json" } }) });

    await expect(malformed.fetchMetadata({ url: `http://${"m".repeat(56)}.onion/`, actorName: "Lamashtu" })).rejects.toThrow("rejected invalid payload");
    await expect(unsupported.fetchMetadata({ url: `http://${"u".repeat(56)}.onion/`, actorName: "RansomHouse" })).rejects.toThrow("not approved for this actor");
  });

  test("fairly monitors 1,000 hourly Tor sources with the bounded production lane", async () => {
    const store = new InMemoryScraperStore();
    const onion = `${"a".repeat(56)}.onion`;
    for (let index = 0; index < 1_000; index++) {
      store.saveSource(source({
        id: `src_tor_capacity_${String(index).padStart(4, "0")}`,
        type: "tor_metadata",
        url: `http://${onion}/victims/${index}`,
        accessMethod: "approved_proxy",
        status: "active",
        risk: "restricted",
        crawlFrequencySeconds: 3_600,
        legalNotes: "Approved public victim-listing metadata only.",
        governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-23T00:00:00.000Z", approvedBy: "reviewer" },
        metadata: { actorName: `Capacity ${index}`, productionCollection: true }
      }));
    }
    let active = 0, peak = 0;
    const boundary = {
      id: "tor-approved-metadata-proxy",
      network: "tor",
      accessMethod: "approved_proxy",
      config: { maxConcurrency: 2, maxMetadataBytes: 64_000, timeoutClass: "metadata_standard" },
      async fetchMetadata(input: any) {
        active++;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active--;
        throw new Error(`bounded unavailable ${input.sourceId}`);
      }
    };

    const cycles: Awaited<ReturnType<typeof runRestrictedMetadataCollectionCycle>>[] = [];
    for (let index = 0; index < 4; index++) {
      const at = new Date(Date.parse("2026-07-23T12:00:00.000Z") + index * 900_000).toISOString();
      cycles.push(await runRestrictedMetadataCollectionCycle({ store, boundary, maxSources: 250, maxConcurrentSources: 2, now: () => at }));
    }

    expect(cycles.map((cycle) => cycle.sourceCount)).toEqual([250, 250, 250, 250]);
    expect(cycles.every((cycle) => cycle.status === "failed" && cycle.failedSourceCount === 250 && cycle.maxConcurrentSources === 2)).toBe(true);
    expect(peak).toBe(2);
    expect(store.listSourceHealthObservations()).toHaveLength(1_000);
    expect(new Set(store.listSourceHealthObservations().map((row) => row.sourceId)).size).toBe(1_000);
    expect(store.listRuns().every((run) => run.taskCount === 250 && run.status === "failed")).toBe(true);
  });

  test("keeps repeated scheduled cycles idempotent and records only novel useful victim metadata", async () => {
    const store = new InMemoryScraperStore();
    let version = 1, requestCount = 0;
    const boundary = new TorMetadataHttpBoundary({
      proxyUrl: "http://onion-tor:8118",
      fetcher: async (url) => {
        requestCount++;
        const actor = String(url).includes("a".repeat(56)) ? "SafePay" : "Space Bears";
        const victim = version === 1 ? `${actor} Victim One` : `${actor} Victim Two`;
        const html = actor === "SafePay"
          ? `<title>Safepay Blog</title><h5 class="card-title">${victim}</h5><div>countdown ${requestCount}</div>`
          : `<title>Space Bears</title><div class="companies-list__item"><div class="name">${victim}</div><div>countdown ${requestCount}</div></div>`;
        return new Response(html, { headers: { "content-type": "text/html" } });
      }
    });
    for (const [id, actorName, host] of [["src_safepay", "SafePay", "a"], ["src_space_bears", "Space Bears", "b"]]) {
      store.saveSource(source({ id, type: "tor_metadata", url: `http://${host.repeat(56)}.onion/`, accessMethod: "approved_proxy", status: "active", risk: "restricted", crawlFrequencySeconds: 900, legalNotes: "Approved public victim-listing metadata only.", governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-22T09:00:00.000Z", approvedBy: "reviewer" }, metadata: { actorName } }));
    }

    const first = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-22T10:00:00.000Z" });
    const restart = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-22T10:05:00.000Z" });
    const duplicate = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-22T10:20:00.000Z" });
    version = 2;
    const changed = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-22T10:40:00.000Z" });

    expect(first).toMatchObject({ status: "completed", intelligenceSourceCount: 2, captureCount: 2, duplicateCount: 0 });
    expect(restart).toMatchObject({ status: "completed", sourceCount: 0, captureCount: 0 });
    expect(duplicate).toMatchObject({ status: "completed", captureCount: 0, duplicateCount: 2 });
    expect(changed).toMatchObject({ status: "completed", captureCount: 2, duplicateCount: 0 });
    expect(store.listCaptures()).toHaveLength(4);
    expect(store.listCaptures().every((capture) => capture.storageKind === "metadata_only" && !capture.body && !capture.objectRef)).toBe(true);
  });

  test("monitors an approved portfolio candidate but activates it only after two novel productive cycles", async () => {
    const store = new InMemoryScraperStore();
    let victim = "Northwind Health";
    const candidate = source({
      id: "src_restricted_candidate_cycles",
      type: "tor_metadata",
      url: `http://${"e".repeat(56)}.onion/`,
      accessMethod: "approved_proxy",
      status: "candidate",
      risk: "restricted",
      crawlFrequencySeconds: 900,
      legalNotes: "Approved public victim-listing metadata only; no interaction or raw content retention.",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-22T09:00:00.000Z", approvedBy: "reviewer" },
      metadata: {
        actorName: "Candidate",
        restrictedMetadataCandidate: true,
        productionCollection: false,
        countsAsCoverage: false,
        sourcePortfolioVerification: {
          verifiedAt: "2026-07-22T09:00:00.000Z",
          legalBasisVerifiedAt: "2026-07-22T09:00:00.000Z",
          outcome: "content_parsed",
          observedItemCount: 1
        }
      }
    });
    store.saveSource(candidate);
    store.saveCapture({
      id: "cap_restricted_not_useful",
      sourceId: candidate.id,
      url: "https://restricted.invalid/capture/not-useful",
      collectedAt: "2026-07-22T09:30:00.000Z",
      publishedAt: "2026-07-22T09:30:00.000Z",
      contentHash: "not-useful-capture",
      mediaType: "application/json",
      storageKind: "metadata_only",
      metadata: { runId: "restricted-run_not_useful" },
      sensitive: true
    } as any);
    store.saveSourceHealthObservation({
      id: "health_restricted_not_useful",
      sourceId: candidate.id,
      collectionRunId: "restricted-run_not_useful",
      checkedAt: "2026-07-22T09:30:00.000Z",
      status: "healthy",
      success: true,
      useful: false,
      captureCount: 1,
      legalMode: "metadata_only"
    } as any);
    store.saveSourceHealthObservation({
      id: "health_restricted_unretained",
      sourceId: candidate.id,
      collectionRunId: "restricted-run_unretained",
      checkedAt: "2026-07-22T09:45:00.000Z",
      status: "healthy",
      success: true,
      useful: true,
      captureCount: 1,
      legalMode: "metadata_only"
    } as any);
    let approveDuringFetch = false;
    const boundary = new TorMetadataHttpBoundary({
      proxyUrl: "http://onion-tor:8118",
      fetcher: async () => {
        if (approveDuringFetch) approveSourceReview(store, candidate.id);
        return new Response(`<title>Candidate notices</title><div class="post-title">${victim}</div>`, { headers: { "content-type": "text/html" } });
      }
    });

    const first = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-22T10:00:00.000Z" });
    expect(first).toMatchObject({ sourceCount: 1, captureCount: 1 });
    expect(store.getSource(candidate.id)).toMatchObject({
      status: "candidate",
      metadata: { productionCollection: false, countsAsCoverage: false, sourcePortfolioQualificationState: "pending_sustained_productivity", sourcePortfolioProductiveCheckCount: 1 }
    });

    approveDuringFetch = true;
    victim = "Contoso Manufacturing";
    const second = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-22T10:15:00.000Z" });
    expect(second).toMatchObject({ sourceCount: 1, captureCount: 1 });
    expect(store.getSource(candidate.id)).toMatchObject({
      status: "active",
      metadata: { productionCollection: true, countsAsCoverage: true, sourcePortfolioQualificationState: "sustained_productive", sourcePortfolioProductiveCheckCount: 2, automaticSourceReview: { state: "approved" } }
    });
    expect(store.listCaptures()).toHaveLength(3);
  });

  test("backs off reachable pages that yield no useful victim metadata", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_gateway_only", type: "tor_metadata", url: `http://${"d".repeat(56)}.onion/`, accessMethod: "approved_proxy", status: "active", risk: "restricted", legalNotes: "Approved metadata-only reachability review.", governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-22T09:00:00.000Z", approvedBy: "reviewer" }, metadata: { actorName: "Gateway" } }));
    const boundary = new TorMetadataHttpBoundary({ proxyUrl: "http://onion-tor:8118", fetcher: async () => new Response("<title>Verification gateway</title><body>No public listings</body>", { headers: { "content-type": "text/html" } }) });

    const failed = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-22T10:00:00.000Z" });
    const restart = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-22T10:01:00.000Z" });

    expect(failed).toMatchObject({ status: "failed", failedSourceCount: 1, captureCount: 0 });
    expect(restart).toMatchObject({ status: "completed", sourceCount: 0 });
    expect(store.listCaptures()).toHaveLength(0);
    expect(store.listSourceHealthObservations()[0]).toMatchObject({ success: false, useful: false, adapterFailureCategory: "parser_failure", parserWarningCount: 1 });
    expect(store.listSources()[0].crawlState).toMatchObject({ retryCount: 1, backoffUntil: "2026-07-22T10:15:00.000Z" });
  });

  test("imports only verified useful intelligence seeds and keeps the transport probe separate", () => {
    const bundle = JSON.parse(readFileSync(new URL("../../seeds/restricted_metadata_source_packs.json", import.meta.url), "utf8"));
    const report = importRestrictedMetadataSeedBundle(bundle, "2026-07-22T13:00:00.000Z");

    expect(report.valid).toBe(true);
    expect(report.accepted.filter((item) => item.metadata?.transportCanary !== true).map((item) => item.id)).toEqual(["restricted_safepay_victim_blog", "restricted_space_bears_victim_blog", "restricted_blackwater_victim_blog", "restricted_qilin_victim_blog", "restricted_nova_victim_blog", "restricted_interlock_victim_blog", "restricted_lamashtu_victim_blog", "restricted_genesis_victim_blog"]);
    expect(report.accepted.filter((item) => item.metadata?.transportCanary !== true).every((item) => item.status === "candidate" && item.governance?.approvalState === "approved" && item.metadata?.productionCollectionOutcome === "metadata_only_parser_verified")).toBe(true);
    expect(report.accepted.find((item) => item.id === "restricted_blackwater_victim_blog")).toMatchObject({ countsAsCoverage: false, metadata: { qualificationState: "pending_two_productive_scheduled_cycles", sourcePortfolioVerification: { outcome: "content_parsed", observedItemCount: 8 } } });
    expect(report.accepted.find((item) => item.id === "restricted_lamashtu_victim_blog"))
      .toMatchObject({ countsAsCoverage: false, metadata: { qualificationState: "pending_two_productive_scheduled_cycles", sourcePortfolioVerification: { contentType: "application/json", observedItemCount: 20 } } });
    expect(report.accepted.find((item) => item.id === "restricted_genesis_victim_blog"))
      .toMatchObject({ status: "candidate", countsAsCoverage: false, metadata: { parserShape: "section.block-bg > h2", qualificationState: "pending_two_productive_scheduled_cycles", sourcePortfolioVerification: { contentType: "text/html", observedItemCount: 20 } } });
    expect(bundle.reviewedRejectedCandidates.find((item: any) => item.id === "restricted_ransomhouse_victim_blog"))
      .toMatchObject({ disposition: "rejected", countsAsCoverage: false });
    expect(report.accepted.some((item) => ["restricted_akira_victim_blog", "restricted_blackout_victim_blog", "restricted_braincipher_victim_blog", "restricted_deadlock_victim_blog"].includes(item.id))).toBe(false);
    expect(bundle.reviewedRejectedCandidates.length).toBeGreaterThan(10);
    expect(bundle.reviewedRejectedCandidates.every((item: any) => item.disposition === "rejected" && item.countsAsCoverage === false && !JSON.stringify(item).includes(".onion"))).toBe(true);

    delete bundle.sources[1].metadata.parserProfile;
    const invalid = importRestrictedMetadataSeedBundle(bundle, "2026-07-22T13:00:00.000Z");
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.some((error) => error.sourceId === "restricted_safepay_victim_blog" && error.message.includes("useful metadata parser"))).toBe(true);

    const leaked = JSON.parse(readFileSync(new URL("../../seeds/restricted_metadata_source_packs.json", import.meta.url), "utf8"));
    leaked.reviewedRejectedCandidates[0].locator = `http://${"z".repeat(56)}.onion/`;
    expect(importRestrictedMetadataSeedBundle(leaked, "2026-07-22T13:00:00.000Z").errors.some((error) => error.message.includes("must not retain a restricted locator"))).toBe(true);

    const duplicate = JSON.parse(readFileSync(new URL("../../seeds/restricted_metadata_source_packs.json", import.meta.url), "utf8"));
    duplicate.sources.push({ ...duplicate.sources.at(-1), id: "restricted_duplicate_endpoint", name: "Duplicate endpoint", url: `${duplicate.sources.at(-1).url}alternate` });
    expect(importRestrictedMetadataSeedBundle(duplicate, "2026-07-23T16:30:03.000Z").errors).toContainEqual({ sourceId: "restricted_duplicate_endpoint", message: "restricted source endpoint must be unique" });
  });

  test("reports only collectable intelligence coverage and redacts restricted locators", () => {
    const store = new InMemoryScraperStore();
    const make = (id: string, status: string, metadata: Record<string, unknown>, governance: Record<string, unknown> = { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-22T09:00:00.000Z", approvedBy: "reviewer" }) => source({ id, type: "tor_metadata", url: `http://${id[0].repeat(56)}.onion/`, accessMethod: "approved_proxy", status, risk: "restricted", legalNotes: "Metadata-only source with explicit public research approval.", governance, metadata });
    store.saveSource({ ...make("active", "active", { actorName: "SafePay" }), crawlState: { backoffUntil: "2026-07-22T10:15:00.000Z" } });
    store.saveSourceHealthObservation({ id: "health_active_useful", sourceId: "active", checkedAt: "2026-07-22T09:50:00.000Z", status: "healthy", success: true, useful: true, captureCount: 1, legalMode: "metadata_only" });
    store.saveSourceHealthObservation({ id: "health_active_latest", sourceId: "active", checkedAt: "2026-07-22T09:55:00.000Z", status: "healthy", success: true, useful: false, captureCount: 0, legalMode: "metadata_only" });
    store.saveSource(make("candidate", "candidate", { actorName: "Candidate" }));
    store.saveSource(make("rejected", "rejected", { actorName: "Rejected" }, { approvalRequired: true, approvalState: "rejected", metadataOnly: true }));
    store.saveSource(make("transport", "active", { transportCanary: true }));

    const response = buildRestrictedMetadataStatusRouteResponse({}, { store, generatedAt: "2026-07-22T10:00:00.000Z" });
    const json = JSON.stringify(response.body);

    expect(response.body.status.sourceCount).toBe(1);
    expect(response.body.coverage).toMatchObject({ intelligenceSourceCount: 1, everUsefulSourceCount: 1, usefulSourceCount: 0, latestUsefulSourceCount: 0, usefulWithin24hSourceCount: 1, backedOffSourceCount: 1, candidateSourceCount: 1, rejectedSourceCount: 1, transportProbeCount: 1 });
    expect(response.body.status.liveSearch.tasks[0].targetUrl).toBeUndefined();
    expect(json).not.toContain(".onion");
  });
});

function approveSourceReview(store: InMemoryScraperStore, sourceId: string) {
  const current = store.getSource(sourceId)!;
  const selectedEvidenceProvenance = sourceAutomaticReviewEvidenceBindings(current, store.listCaptures()).slice(0, 1);
  store.saveSource({
    ...current,
    metadata: {
      ...current.metadata,
      automaticSourceReview: {
        schemaVersion: SOURCE_AUTOMATIC_REVIEW_SCHEMA,
        state: "approved",
        promptVersion: SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION,
        configuredModelVersion: "hanasand",
        sourceIdentity: automaticSourceReviewIdentity(current),
        requestSha256: "a".repeat(64),
        selectedEvidenceIds: selectedEvidenceProvenance.map((item) => item.evidenceId),
        selectedEvidenceProvenance,
        runtimeIdentity: { status: "completed", conversationId: "source-review-proof" },
        decision: { subject: { type: "source", id: sourceId }, action: "confirm", claimValidity: "supported" }
      }
    }
  } as any);
}
