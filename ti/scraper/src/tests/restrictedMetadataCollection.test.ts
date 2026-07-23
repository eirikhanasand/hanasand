import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { TorMetadataHttpBoundary } from "../adapters/torMetadataBoundary.ts";
import { buildRestrictedMetadataStatusRouteResponse } from "../api/restrictedMetadataRoutes.ts";
import { runRestrictedMetadataCollectionCycle } from "../ops/restrictedMetadataCollection.ts";
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
        return new Response("<html><head><title>Akira notices</title><meta name=\"description\" content=\"Victim: Northwind Health; Sector: healthcare; Country: NO; Data type: contracts; Extortion type: double extortion; Monetization path: ransom demand; Publicity tactic: countdown announcement; Buyer communication: auction contact channel; Intermediary communication: broker listing; Profitability signal: claimed paid victims\"></head><body><article class=\"news-item\"><h2 class=\"headline\"><a>Fabrikam.example</a></h2></article><div class=\"post-title font\">Contoso Manufacturing</div><time datetime=\"2026-07-20T10:00:00Z\"></time>raw page content that must not persist</body></html>", { status: 200, headers: { "content-type": "text/html" } });
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
    expect(JSON.stringify(capture)).not.toContain("raw page content");
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

  test("extracts current SafePay and Space Bears victim-card metadata without retaining locators or dynamic page text", async () => {
    const pages: Record<string, string> = {
      SafePay: '<title>Safepay Blog</title><div class="card"><h5 class="card-title text-center">Northwind Health</h5><div>countdown 00:01</div></div><a href="http://' + "c".repeat(56) + '.onion/download/archive.zip">payload</a>',
      "Space Bears": '<title>Space Bears</title><div class="companies-list__item"><div class="name">Contoso Manufacturing</div><div>countdown 00:02</div></div>'
    };
    for (const actorName of ["SafePay", "Space Bears"]) {
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
    expect(store.listCaptures().map((capture) => capture.metadata.leakSite.victimName)).toEqual(["Qilin Victim", "Nova Victim", "Interlock Victim"]);
    expect(store.listCaptures().every((capture) => capture.storageKind === "metadata_only" && !capture.body && !capture.objectRef && !capture.metadata.leakSite.links?.length)).toBe(true);
    expect(store.listExtractedEntities().filter((entity) => entity.type === "victim").map((entity) => entity.value)).toEqual(["Qilin Victim", "Nova Victim", "Interlock Victim"]);
    expect(JSON.stringify(store.listCaptures())).not.toContain("dynamic");
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
    const boundary = new TorMetadataHttpBoundary({
      proxyUrl: "http://onion-tor:8118",
      fetcher: async () => new Response(`<title>Candidate notices</title><div class="post-title">${victim}</div>`, { headers: { "content-type": "text/html" } })
    });

    const first = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-22T10:00:00.000Z" });
    expect(first).toMatchObject({ sourceCount: 1, captureCount: 1 });
    expect(store.getSource(candidate.id)).toMatchObject({
      status: "candidate",
      metadata: { productionCollection: false, countsAsCoverage: false, sourcePortfolioQualificationState: "pending_sustained_productivity", sourcePortfolioProductiveCheckCount: 1 }
    });

    victim = "Contoso Manufacturing";
    const second = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-22T10:15:00.000Z" });
    expect(second).toMatchObject({ sourceCount: 1, captureCount: 1 });
    expect(store.getSource(candidate.id)).toMatchObject({
      status: "active",
      metadata: { productionCollection: true, countsAsCoverage: true, sourcePortfolioQualificationState: "sustained_productive", sourcePortfolioProductiveCheckCount: 2 }
    });
    expect(store.listCaptures()).toHaveLength(2);
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
    expect(report.accepted.filter((item) => item.metadata?.transportCanary !== true).map((item) => item.id)).toEqual(["restricted_safepay_victim_blog", "restricted_space_bears_victim_blog", "restricted_qilin_victim_blog", "restricted_nova_victim_blog", "restricted_interlock_victim_blog"]);
    expect(report.accepted.filter((item) => item.metadata?.transportCanary !== true).every((item) => item.status === "candidate" && item.governance?.approvalState === "approved" && item.metadata?.productionCollectionOutcome === "metadata_only_parser_verified")).toBe(true);
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
