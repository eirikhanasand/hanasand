import { describe, expect, test } from "bun:test";
import { feedItems } from "../ops/canaryFeedItems.ts";
import { fetchItems } from "../ops/canaryHelpers.ts";
import { importSeedBundle } from "../registry/sourceSeeds.ts";
import { evaluateSourceForCollection, isExecutableSource } from "../policy/collectionPolicy.ts";
import { isSellableIntelText } from "../value/sellableIntel.ts";
import { bootstrapRuntimeSources } from "../runtime/sourceBootstrap.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { runCanaryCollectionCycle } from "../ops/canaryCollection.ts";
import { AUTOMATIC_REVIEW_PROMPT_VERSION, SOURCE_AUTOMATIC_REVIEW_SCHEMA } from "../policy/sourceAutomaticReview.ts";

const source = {
  id: "src_public_telegram_test",
  name: "Public Telegram Test Channel",
  type: "telegram_public",
  url: "https://t.me/public_threat_test",
  metadata: { maxItemsPerFetch: 5 }
};

const task = {
  id: "task_public_telegram_test",
  sourceId: source.id,
  targetUrl: source.url,
  sourceType: source.type
};

const html = `
<html><body><section>
  <div class="tgme_widget_message" data-post="public_threat_test/42">
    <a class="tgme_widget_message_author">Threat research feed</a>
    <div class="tgme_widget_message_text"><a href="https://acme.example">Acme Payments</a> acme.com mentioned in Lumma C2 session cookie and OAuth token chatter. No files attached.</div>
    <div class="tgme_widget_message_footer"><span>42 views</span></div>
    <time datetime="2026-06-27T21:00:00+00:00"></time>
  </div>
  <div class="tgme_widget_message" data-post="public_threat_test/43">
    <div class="tgme_widget_message_text">Northwind Supplier appears in actor-page mirror metadata only.</div>
    <time datetime="2026-06-27T21:03:00+00:00"></time>
  </div>
</section></body></html>`;

describe("public Telegram canary collection", () => {
  test("parses t.me public preview messages into safe collected rows", () => {
    const rows = feedItems(source, task, html, "2026-06-27T21:05:00.000Z", { fetchMode: "test" }, 10);

    expect(rows).toHaveLength(2);
    expect(rows[0].url).toBe("https://t.me/public_threat_test/42");
    expect(rows[0].metadata.adapter).toBe("telegram_public");
    expect(rows[0].metadata.channel).toBe("public_threat_test");
    expect(rows[0].metadata.messageId).toBe(42);
    expect(rows[0].metadata.mediaPolicy).toBe("metadata_only_no_download");
    expect(rows[0].rawText).toContain("acme.com");
  });

  test("fetches Telegram public preview URL instead of the channel landing page", async () => {
    let requested = "";
    const rows = await fetchItems(source, task, async (url: string) => {
      requested = url;
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    }, "injected_proof_fetch", "2026-06-27T21:05:00.000Z", 100_000);

    expect(requested).toBe("https://t.me/s/public_threat_test");
    expect(rows[0].metadata.fetchProvenance.sourceUrlHash).toBeDefined();
    expect(rows[0].metadata.adapter).toBe("telegram_public");
  });

  test("keeps the verified CERT-UA channel collectable only through the approved public preview", async () => {
    const bundle = await Bun.file(new URL("../../seeds/verified_long_lived_sources.json", import.meta.url)).json();
    const verifiedSources = importSeedBundle(bundle, { importedAt: "2026-07-20T00:00:00.000Z" }).accepted;
    const verified = verifiedSources.find((source: any) => source.id === "src_ssscip_cert_ua_telegram");

    expect(verified).toMatchObject({ id: "src_ssscip_cert_ua_telegram", accessMethod: "public_http", governance: { approvalState: "approved" }, metadata: { collectionMode: "public_web_preview", searchQuery: "CERT-UA", mediaPolicy: "metadata_only_no_download" } });
    expect(evaluateSourceForCollection(verified)).toMatchObject({ allowed: true, reason: expect.stringContaining("public web preview") });
    expect(verifiedSources.find((source: any) => source.id === "src_ccn_cert_telegram")).toMatchObject({ id: "src_ccn_cert_telegram", language: "es", metadata: { collectionMode: "public_web_preview" } });
    expect(isSellableIntelText({ sourceId: verified.id, text: "CERT-UA зафіксувала кібератаку угруповання UAC-0010 проти державної установи з використанням шкідливого програмного забезпечення.", publishedAt: "2026-07-20T00:00:00.000Z", now: "2026-07-20T01:00:00.000Z" })).toBe(true);
    expect(isSellableIntelText({ sourceId: verifiedSources[1].id, text: "CCN-CERT investiga un ciberataque y una campaña de phishing contra infraestructura crítica con credenciales comprometidas.", publishedAt: "2026-07-20T00:00:00.000Z", now: "2026-07-20T01:00:00.000Z" })).toBe(true);
  });

  test("imports the current production pack idempotently with the required coverage families", async () => {
    const seedPath = new URL("../../seeds/public_telegram_channel_packs.json", import.meta.url);
    const bundle = await Bun.file(seedPath).json();
    const report = importSeedBundle(bundle, { importedAt: bundle.generatedAt });
    const families = new Set(report.accepted.flatMap((item: any) => item.metadata.sourceFamilies));

    expect(report).toMatchObject({ valid: true, errors: [], duplicates: [] });
    expect(report.accepted).toHaveLength(12);
    expect(report.accepted.every((item: any) => item.tenantId === undefined)).toBe(true);
    expect(report.accepted.map((item: any) => item.id)).toEqual(expect.arrayContaining([
      "src_group_ib_telegram",
      "src_kaspersky_ru_telegram",
      "src_hackmanac_telegram",
      "src_positive_technologies_telegram",
      "src_i4c_cyberdost_telegram",
      "src_ukraine_cyberpolice_telegram",
      "src_ctt_report_hub_telegram",
      "src_cert_agid_telegram",
      "src_solar_4rays_telegram",
      "src_d3lab_telegram",
      "src_cert_gov_az_telegram",
      "src_uzcert_live_telegram"
    ]));
    expect(report.accepted.map((item: any) => item.language)).toEqual(expect.arrayContaining(["en", "it", "ru", "hi", "uk", "az", "uz"]));
    expect([...families]).toEqual(expect.arrayContaining([
      "apt_research",
      "malware_research",
      "actor_announcement_reporting",
      "victim_publication_reporting",
      "cert_government",
      "cybercrime_reporting",
      "regional_language"
    ]));
    for (const family of ["apt_research", "malware_research", "ransomware_research", "actor_announcement_reporting", "victim_publication_reporting", "cert_government", "regional_language"]) {
      expect(report.accepted.filter((item: any) => item.metadata.sourceFamilies.includes(family)).length).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(report.accepted.map((item: any) => item.catalog.canonicalId)).size).toBe(report.accepted.length);
    expect(report.accepted.every((item: any) => item.accessMethod === "public_http" && item.governance.approvalState === "approved" && item.metadata.collectionMode === "public_web_preview" && item.metadata.mediaPolicy === "metadata_only_no_download" && item.metadata.publisherReference.startsWith("https://"))).toBe(true);
    const production = report.accepted.filter((item: any) => item.status === "active");
    const candidates = report.accepted.filter((item: any) => item.status === "candidate");
    expect(production).toHaveLength(7);
    expect(production.every((item: any) => item.metadata.productionCollection === true && evaluateSourceForCollection(item).allowed && isExecutableSource(item))).toBe(true);
    expect(candidates.map((item: any) => item.id)).toEqual([
      "src_cert_agid_telegram",
      "src_solar_4rays_telegram",
      "src_d3lab_telegram",
      "src_cert_gov_az_telegram",
      "src_uzcert_live_telegram"
    ]);
    expect(candidates.every((item: any) => item.countsAsCoverage !== true
      && item.metadata.productionCollection === false
      && item.metadata.countsAsCoverage === false
      && item.metadata.sourcePortfolioQualificationState === "pending_sustained_productivity"
      && item.metadata.sourcePortfolioVerification.outcome === "content_parsed"
      && item.metadata.sourcePortfolioVerification.observedUsefulItemCount > 0
      && !evaluateSourceForCollection(item).allowed
      && !isExecutableSource(item))).toBe(true);
    expect(report.accepted.map((item: any) => item.url)).not.toEqual(expect.arrayContaining([
      "https://t.me/FalconFeedsio",
      "https://t.me/noname05716",
      "https://t.me/dailydarkweb",
      "https://t.me/darkwebinformer_news",
      "https://t.me/bizone_channel",
      "https://t.me/kzcert",
      "https://t.me/certkznews"
    ]));

    const store = new InMemoryScraperStore();
    const first = bootstrapRuntimeSources(store, { seedPaths: [seedPath.pathname], generatedAt: bundle.generatedAt });
    const restart = bootstrapRuntimeSources(store, { seedPaths: [seedPath.pathname], generatedAt: bundle.generatedAt });

    expect(first).toMatchObject({ importedSourceCount: 12, updatedSourceCount: 0, activeSourceCount: 7, errors: [] });
    expect(restart).toMatchObject({ importedSourceCount: 0, updatedSourceCount: 0, skippedSourceCount: 12, activeSourceCount: 7, totalSourceCount: 12, errors: [] });
  });

  test("backs off a public-preview source after a bounded upstream failure", async () => {
    const bundle = await Bun.file(new URL("../../seeds/public_telegram_channel_packs.json", import.meta.url)).json();
    const [publicSource] = importSeedBundle(bundle, { importedAt: bundle.generatedAt }).accepted;
    const store = new InMemoryScraperStore();
    store.saveSource(publicSource);

    const cycle = await runCanaryCollectionCycle({
      store,
      frontier: new FocusedFrontier({ defaultRetryBudget: 3, baseBackoffMs: 30_000 }),
      sourceIds: [publicSource.id],
      maxSources: 1,
      maxTasks: 1,
      now: () => "2026-07-22T12:50:00.000Z",
      fetch: async () => new Response("rate limited", { status: 429, headers: { "content-type": "text/plain" } })
    });

    expect(cycle).toMatchObject({ failedTaskCount: 1, completedTaskCount: 0, retryScheduledCount: 1, retryExhaustedCount: 0 });
    expect(store.getSource(publicSource.id)).toMatchObject({
      health: { status: "degraded", checkedAt: "2026-07-22T12:50:00.000Z", lastError: "HTTP 429" },
      crawlState: { retryCount: 1, backoffUntil: "2026-07-22T12:55:00.000Z", nextEligibleAt: "2026-07-22T12:55:00.000Z" }
    });
  });

  test("promotes a verified Telegram candidate only after two useful scheduled cycles and preserves it on restart", async () => {
    const seedPath = new URL("../../seeds/public_telegram_channel_packs.json", import.meta.url);
    const bundle = await Bun.file(seedPath).json();
    const store = new InMemoryScraperStore();
    bootstrapRuntimeSources(store, { seedPaths: [seedPath.pathname], generatedAt: bundle.generatedAt });
    const sourceId = "src_cert_agid_telegram";
    const frontier = new FocusedFrontier({ defaultRetryBudget: 3, baseBackoffMs: 30_000 });
    let cycle = 0;
    const collect = (checkedAt: string) => runCanaryCollectionCycle({
      store,
      frontier,
      sourceIds: [sourceId],
      maxSources: 1,
      maxTasks: 1,
      now: () => checkedAt,
      fetch: async () => {
        cycle++;
        return new Response(`<html><body><section>
          <div class="tgme_widget_message" data-post="certagid/${1200 + cycle}">
            <div class="tgme_widget_message_text">CERT-AgID segnala una nuova campagna malware ransomware contro enti pubblici con credenziali compromesse e indicatori di attacco.</div>
            <time datetime="${checkedAt}"></time>
          </div>
        </section></body></html>`, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      }
    });

    expect(store.getSource(sourceId)?.countsAsCoverage).not.toBe(true);
    expect(store.getSource(sourceId)).toMatchObject({
      status: "candidate",
      metadata: { productionCollection: false, sourcePortfolioQualificationState: "pending_sustained_productivity" }
    });

    expect(await collect("2026-07-23T16:30:00.000Z")).toMatchObject({ completedTaskCount: 1, insertedCaptureCount: 1, failedTaskCount: 0 });
    expect(store.getSource(sourceId)).toMatchObject({
      status: "candidate",
      countsAsCoverage: false,
      metadata: {
        productionCollection: false,
        sourcePortfolioQualificationState: "pending_sustained_productivity",
        sourcePortfolioProductiveCheckCount: 1
      }
    });

    approveSourceReview(store, sourceId);
    expect(await collect("2026-07-23T17:00:00.000Z")).toMatchObject({ completedTaskCount: 1, insertedCaptureCount: 1, failedTaskCount: 0 });
    expect(store.getSource(sourceId)).toMatchObject({
      status: "active",
      countsAsCoverage: true,
      metadata: {
        productionCollection: true,
        sourcePortfolioQualificationState: "sustained_productive",
        sourcePortfolioProductiveCheckCount: 2
      }
    });
    expect(isExecutableSource(store.getSource(sourceId)!)).toBe(true);
    expect(store.listSourceHealthObservations().filter((row: any) => row.sourceId === sourceId)).toHaveLength(2);

    const restart = bootstrapRuntimeSources(store, { seedPaths: [seedPath.pathname], generatedAt: "2026-07-23T19:35:00.000Z" });
    expect(restart).toMatchObject({ importedSourceCount: 0, updatedSourceCount: 0, skippedSourceCount: 12, activeSourceCount: 8, totalSourceCount: 12, errors: [] });
    expect(store.listSources().filter((item: any) => item.id === sourceId)).toHaveLength(1);
    expect(store.getSource(sourceId)).toMatchObject({
      status: "active",
      countsAsCoverage: true,
      metadata: { productionCollection: true, sourcePortfolioProductiveCheckCount: 2 }
    });
  });
});

function approveSourceReview(store: InMemoryScraperStore, sourceId: string) {
  const current = store.getSource(sourceId)!;
  store.saveSource({
    ...current,
    metadata: {
      ...current.metadata,
      automaticSourceReview: {
        schemaVersion: SOURCE_AUTOMATIC_REVIEW_SCHEMA,
        state: "approved",
        promptVersion: AUTOMATIC_REVIEW_PROMPT_VERSION,
        configuredModelVersion: "hanasand",
        requestSha256: "a".repeat(64),
        selectedEvidenceIds: ["retained-source-output"],
        runtimeIdentity: { status: "completed", conversationId: "source-review-proof" },
        decision: { subject: { type: "source", id: sourceId }, action: "confirm", claimValidity: "supported" }
      }
    }
  } as any);
}
