import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TorMetadataHttpBoundary } from "../adapters/torMetadataBoundary.ts";
import { buildRestrictedMetadataStatusRouteResponse } from "../api/restrictedMetadataRoutes.ts";
import { runRestrictedMetadataCollectionCycle } from "../ops/restrictedMetadataCollection.ts";
import { sourceCollectionLane } from "../policy/collectionPolicy.ts";
import { importRestrictedMetadataSeedBundle } from "../registry/restrictedSourceSeeds.ts";
import { bootstrapRuntimeSources } from "../runtime/sourceBootstrap.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
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
      ...source({ id: "src_transport_canary", type: "tor_metadata", url: `http://${"b".repeat(56)}.onion/`, accessMethod: "approved_proxy", status: "active", risk: "high", legalNotes: "Official onion transport canary metadata only.", governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-20T09:00:00.000Z", approvedBy: "reviewer" }, metadata: { transportCanary: true } }),
      tenantId: "tenant_restricted"
    });
    const boundary = new TorMetadataHttpBoundary({ proxyUrl: "http://onion-tor:8118", fetcher: async () => new Response("<title>Official transport canary</title><meta name=\"description\" content=\"Safe metadata\">", { headers: { "content-type": "text/html" } }) });

    const result = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-20T10:05:00.000Z" });

    expect(result).toMatchObject({ status: "completed", intelligenceSourceCount: 0, transportProbeCount: 1, captureCount: 1, incidentCount: 0 });
    expect(store.listCaptures()).toHaveLength(1);
    expect(store.listIncidents()).toHaveLength(0);
    expect(store.listExtractedEntities()).toHaveLength(0);
    expect(store.listSourceHealthObservations()[0]).toMatchObject({ useful: false, observedActorCount: 0 });
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
    expect(bundle.saturationReview).toMatchObject({ acceptedIntelligenceSourceCount: 5, rejectedCandidateCount: bundle.reviewedRejectedCandidates.length, unreviewedCandidateCount: 0, newlyQualifiedAfterRecheck: 0 });
    expect(bundle.saturationReview.acceptedIntelligenceSourceCount).toBe(report.accepted.filter((item) => item.metadata?.transportCanary !== true).length);
    expect(JSON.stringify(bundle.saturationReview)).not.toContain(".onion");

    delete bundle.sources[1].metadata.parserProfile;
    const invalid = importRestrictedMetadataSeedBundle(bundle, "2026-07-22T13:00:00.000Z");
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.some((error) => error.sourceId === "restricted_safepay_victim_blog" && error.message.includes("useful metadata parser"))).toBe(true);

    const leaked = JSON.parse(readFileSync(new URL("../../seeds/restricted_metadata_source_packs.json", import.meta.url), "utf8"));
    leaked.reviewedRejectedCandidates[0].locator = `http://${"z".repeat(56)}.onion/`;
    expect(importRestrictedMetadataSeedBundle(leaked, "2026-07-22T13:00:00.000Z").errors.some((error) => error.message.includes("must not retain a restricted locator"))).toBe(true);
  });

  test("bootstraps and schedules all five verified services without restart churn or locator leakage", async () => {
    const previous = Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES;
    Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES = "true";
    const dir = mkdtempSync(join(tmpdir(), "hanasand-verified-tor-pack-"));
    const seedPath = new URL("../../seeds/restricted_metadata_source_packs.json", import.meta.url).pathname;
    const store = new FileBackedScraperStore({ snapshotPath: join(dir, "store.json") });
    const pages: Record<string, string> = {
      SafePay: '<title>SafePay</title><h5 class="card-title">SafePay Victim</h5>',
      "Space Bears": '<title>Space Bears</title><div class="companies-list__item"><div class="name">Space Bears Victim</div></div>',
      Qilin: '<title>Qilin</title><div class="item_box"><h3 class="item_box-title">Qilin Victim</h3></div>',
      Nova: '<title>Nova</title><div class="post-card"><a class="logo">Nova Victim</a></div>',
      Interlock: '<title>Interlock</title><div class="advert_item"><div class="advert_info_title">Interlock Victim</div></div>'
    };

    try {
      const bootstrapped = bootstrapRuntimeSources(store, { seedPaths: [seedPath], generatedAt: "2026-07-23T12:00:00.000Z" });
      const intelligence = store.listSources().filter((item) => item.metadata?.transportCanary !== true);
      expect(bootstrapped).toMatchObject({ importedSourceCount: 6, activeSourceCount: 6, totalSourceCount: 6, errors: [] });
      expect(intelligence.map((item) => item.metadata?.actorName)).toEqual(["SafePay", "Space Bears", "Qilin", "Nova", "Interlock"]);
      expect(intelligence.every((item) => item.status === "active" && item.metadata?.productionCollection === true && sourceCollectionLane(item) === "restricted_metadata")).toBe(true);

      const boundary = new TorMetadataHttpBoundary({
        proxyUrl: "http://onion-tor:8118",
        fetcher: async (url) => {
          const actor = store.listSources().find((item) => new URL(item.url).href === String(url))?.metadata?.actorName;
          return new Response(actor ? pages[String(actor)] : "<title>Tor transport</title><meta name=\"description\" content=\"Transport available\">", { headers: { "content-type": "text/html" } });
        }
      });
      const first = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-23T13:00:00.000Z" });
      const second = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-23T13:01:00.000Z" });
      const third = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-23T13:02:00.000Z" });
      expect(first.completedSourceCount + second.completedSourceCount + third.completedSourceCount).toBe(6);
      expect(first.failedSourceCount + second.failedSourceCount + third.failedSourceCount).toBe(0);

      const restarted = new FileBackedScraperStore({ snapshotPath: join(dir, "store.json") });
      const restart = bootstrapRuntimeSources(restarted, { seedPaths: [seedPath], generatedAt: "2026-07-23T13:03:00.000Z" });
      const status = buildRestrictedMetadataStatusRouteResponse({}, { store: restarted, generatedAt: "2026-07-23T13:03:00.000Z" });
      expect(restart).toMatchObject({ importedSourceCount: 0, updatedSourceCount: 0, skippedSourceCount: 6, activeSourceCount: 6, totalSourceCount: 6, errors: [] });
      expect(restarted.listCaptures().filter((capture) => capture.sourceId !== "restricted_tor_project_transport_canary")).toHaveLength(5);
      expect(restarted.listCaptures().every((capture) => capture.storageKind === "metadata_only" && !capture.body && !capture.objectRef)).toBe(true);
      expect(status.body.coverage).toMatchObject({ intelligenceSourceCount: 5, usefulSourceCount: 5, transportProbeCount: 1 });
      expect(JSON.stringify(status.body)).not.toContain(".onion");
    } finally {
      if (previous === undefined) delete Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES;
      else Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES = previous;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("reports only collectable intelligence coverage and redacts restricted locators", () => {
    const store = new InMemoryScraperStore();
    const make = (id: string, status: string, metadata: Record<string, unknown>, governance: Record<string, unknown> = { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-22T09:00:00.000Z", approvedBy: "reviewer" }) => source({ id, type: "tor_metadata", url: `http://${id[0].repeat(56)}.onion/`, accessMethod: "approved_proxy", status, risk: "restricted", legalNotes: "Metadata-only source with explicit public research approval.", governance, metadata });
    store.saveSource({ ...make("active", "active", { actorName: "SafePay" }), health: { lastUsefulAt: "2026-07-22T09:55:00.000Z" }, crawlState: { backoffUntil: "2026-07-22T10:15:00.000Z" } });
    store.saveSource(make("candidate", "candidate", { actorName: "Candidate" }));
    store.saveSource(make("rejected", "rejected", { actorName: "Rejected" }, { approvalRequired: true, approvalState: "rejected", metadataOnly: true }));
    store.saveSource(make("transport", "active", { transportCanary: true }));

    const response = buildRestrictedMetadataStatusRouteResponse({}, { store, generatedAt: "2026-07-22T10:00:00.000Z" });
    const json = JSON.stringify(response.body);

    expect(response.body.status.sourceCount).toBe(1);
    expect(response.body.coverage).toMatchObject({ intelligenceSourceCount: 1, usefulSourceCount: 1, backedOffSourceCount: 1, candidateSourceCount: 1, rejectedSourceCount: 1, transportProbeCount: 1 });
    expect(response.body.status.liveSearch.tasks[0].targetUrl).toBeUndefined();
    expect(json).not.toContain(".onion");
  });
});
