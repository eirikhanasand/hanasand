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
import { SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION, SOURCE_AUTOMATIC_REVIEW_SCHEMA, automaticSourceReviewIdentity } from "../policy/sourceAutomaticReview.ts";
import { sourceAutomaticReviewEvidenceBindings } from "../api/automaticReviewRoutes.ts";

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
    expect(report.accepted).toHaveLength(bundle.sourceCount);
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
      "src_uzcert_live_telegram",
      "src_red_hot_cyber_telegram",
      "src_segu_info_telegram",
      "src_securitylab_ru_telegram",
      "src_csirt_italia_telegram",
      "src_bizone_telegram",
      "src_ruscadasec_news_telegram",
      "src_scadax_news_telegram",
      "src_security_vision_telegram",
      "src_angara_security_telegram",
      "src_anti_malware_ru_telegram",
      "src_netlas_telegram",
      "src_f6_cybersecurity_telegram",
      "src_tumar_one_telegram",
      "src_lukas_stefanko_android_malware_telegram",
      "src_ransomfeed_ransomware_telegram",
      "src_threat_hunting_father_telegram",
      "src_dciber_brazil_telegram",
      "src_redseg_latam_telegram",
      "src_alexander_leonov_english_telegram",
      "src_zhassulan_maldevcc_telegram",
      "src_hispasec_unaaldia_telegram",
      "src_cyber_bro_uzbekistan_telegram",
      "src_codeby_security_telegram",
      "src_eset_ukraine_telegram"
    ]));
    expect(report.accepted.map((item: any) => item.language)).toEqual(expect.arrayContaining(["en", "es", "it", "ru", "hi", "uk", "az", "uz"]));
    expect(report.accepted.find((item: any) => item.id === "src_red_hot_cyber_telegram")).toMatchObject({
      url: "https://t.me/redhotcyber",
      language: "it",
      metadata: { publisherReference: "https://www.redhotcyber.com/", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 3 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_segu_info_telegram")).toMatchObject({
      url: "https://t.me/SeguInfoChannel",
      language: "es",
      metadata: { publisherReference: "https://blog.segu-info.com.ar/", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 5 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_securitylab_ru_telegram")).toMatchObject({
      url: "https://t.me/SecLabNews",
      language: "ru",
      metadata: { searchQuery: "уязвимость", publisherReference: "https://www.securitylab.ru/news/487639.php", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 1 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_csirt_italia_telegram")).toMatchObject({
      url: "https://t.me/CSIRT_italia",
      language: "it",
      metadata: { publisherReference: "https://www.acn.gov.it/portale/csirt-italia", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 1 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_bizone_telegram")).toMatchObject({
      url: "https://t.me/bizone_channel",
      language: "ru",
      metadata: { publisherReference: "https://bi.zone/", sourcePortfolioVerification: { observedItemCount: 17, observedUsefulItemCount: 2 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_ruscadasec_news_telegram")).toMatchObject({
      url: "https://t.me/ruscadasecnews",
      language: "ru",
      metadata: { publisherReference: "https://ruscadasec.com/", sourcePortfolioVerification: { observedItemCount: 19, observedUsefulItemCount: 7 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_scadax_news_telegram")).toMatchObject({
      url: "https://t.me/ScadaXNews",
      language: "en",
      metadata: { publisherReference: "https://ruscadasec.com/", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 18 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_security_vision_telegram")).toMatchObject({
      url: "https://t.me/svplatform",
      language: "ru",
      metadata: { publisherReference: "https://www.securityvision.ru/", sourcePortfolioVerification: { observedItemCount: 19, observedUsefulItemCount: 1 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_angara_security_telegram")).toMatchObject({
      url: "https://t.me/angarasecurity",
      language: "ru",
      metadata: { publisherReference: "https://www.angarasecurity.ru/", sourcePortfolioVerification: { observedItemCount: 11, observedUsefulItemCount: 1 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_anti_malware_ru_telegram")).toMatchObject({
      url: "https://t.me/anti_malware",
      language: "ru",
      metadata: { publisherReference: "https://www.anti-malware.ru/", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 20 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_netlas_telegram")).toMatchObject({
      url: "https://t.me/netlas",
      language: "en",
      metadata: { publisherReference: "https://netlas.io/", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 16 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_f6_cybersecurity_telegram")).toMatchObject({
      url: "https://t.me/f6_cybersecurity",
      language: "ru",
      metadata: { publisherReference: "https://www.f6.ru/media-center/news/", sourcePortfolioVerification: { observedItemCount: 15, observedUsefulItemCount: 2 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_tumar_one_telegram")).toMatchObject({
      url: "https://t.me/tumar_one",
      language: "ru",
      metadata: { publisherReference: "https://tumar.one/", sourcePortfolioVerification: { observedItemCount: 4, observedUsefulItemCount: 1 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_lukas_stefanko_android_malware_telegram")).toMatchObject({
      url: "https://t.me/androidMalware",
      language: "en",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://www.linkedin.com/posts/lukasstefanko_telegram-activity-7324047394982027264-d4PL", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 12 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_ransomfeed_ransomware_telegram")).toMatchObject({
      url: "https://t.me/RansomFeedNews",
      language: "en",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://ransomfeed.it/data/cards/recap-2025-01-31.pdf", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 20 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_threat_hunting_father_telegram")).toMatchObject({
      url: "https://t.me/ThreatHuntingFather",
      language: "ru",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://www.linkedin.com/posts/rarh1k_dfir-incidentresponse-threathunting-activity-7464006053022654465-mWAa", sourcePortfolioVerification: { observedItemCount: 12, observedUsefulItemCount: 4 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_dciber_brazil_telegram")).toMatchObject({
      url: "https://t.me/dciber",
      language: "pt",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://www.linkedin.com/company/dciber-org/", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 3 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_redseg_latam_telegram")).toMatchObject({
      url: "https://t.me/redseg",
      language: "es",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://www.linkedin.com/company/ciberseg-redseg", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 5 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_alexander_leonov_english_telegram")).toMatchObject({
      url: "https://t.me/avleonovcom",
      language: "en",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://avleonov.com/", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 7 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_zhassulan_maldevcc_telegram")).toMatchObject({
      url: "https://t.me/maldevcc",
      language: "en",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://www.linkedin.com/in/zhassulan-zhussupov-cocomelonc/", sourcePortfolioVerification: { observedItemCount: 16, observedUsefulItemCount: 13 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_hispasec_unaaldia_telegram")).toMatchObject({
      url: "https://t.me/unaaldia",
      language: "es",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://unaaldia.hispasec.com/reto-ctf-uam-diciembre-porropwnpwn/", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 10 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_cyber_bro_uzbekistan_telegram")).toMatchObject({
      url: "https://t.me/cyberbrosecurity",
      language: "uz",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://cyber-bro.uz/", sourcePortfolioVerification: { observedItemCount: 9, observedUsefulItemCount: 1 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_codeby_security_telegram")).toMatchObject({
      url: "https://t.me/codeby_sec",
      language: "ru",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://codeby.net/", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 2 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_eset_ukraine_telegram")).toMatchObject({
      url: "https://t.me/eset_ua_news",
      language: "uk",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://www.eset.com/ua/", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 2 } }
    });
    for (const expected of [
      ["src_stormwall_ddos_telegram", "https://t.me/stormwallpro", "https://stormwall.pro/", 10],
      ["src_rvision_security_telegram", "https://t.me/rvision_pro", "https://rvision.ru/", 10],
      ["src_jet_infosystems_telegram", "https://t.me/jetinfosystems", "https://jet.su/", 20],
      ["src_k2_tech_security_telegram", "https://t.me/k2_tech", "https://k2.tech/", 4],
      ["src_security_code_telegram", "https://t.me/Kodnaprovode", "https://www.securitycode.ru/", 20],
      ["src_aktiv_security_telegram", "https://t.me/aktivcompany", "https://www.aktiv-company.ru/", 13],
      ["src_phishman_security_telegram", "https://t.me/cyberphishman", "https://phishman.ru/", 7],
      ["src_cryptopro_security_telegram", "https://t.me/cryptopro_news", "https://www.cryptopro.ru/", 18],
      ["src_tsarka_certkznews_telegram", "https://t.me/certkznews", "https://cybersec.kz/", 12]
    ] as const) {
      expect(report.accepted.find((item: any) => item.id === expected[0])).toMatchObject({
        url: expected[1],
        status: "candidate",
        metadata: { productionCollection: false, publisherReference: expected[2], sourcePortfolioVerification: { observedItemCount: expected[3], observedUsefulItemCount: 0 } }
      });
    }
    expect(report.accepted.find((item: any) => item.id === "src_armenia_cyberpolice_telegram")).toMatchObject({
      url: "https://t.me/cyberpolice_arm",
      language: "hy",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://mia.gov.am/2025/09/16/cyber-15/", sourcePortfolioVerification: { observedItemCount: 19, observedUsefulItemCount: 0 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_s2w_dailybrief_telegram")).toMatchObject({
      url: "https://t.me/s2wdailybrief",
      language: "en",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://www.s2w.inc/en/news/detail/566", sourcePortfolioVerification: { observedItemCount: 20, observedUsefulItemCount: 0 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_uzbekistan_mia_cyberpolice_telegram")).toMatchObject({
      url: "https://t.me/cyberpolice_iiv",
      language: "uz",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://gov.uz/oz/iiv/news/view/198883", sourcePortfolioVerification: { observedItemCount: 8, observedUsefulItemCount: 0 } }
    });
    expect(report.accepted.find((item: any) => item.id === "src_armenia_hti_telegram")).toMatchObject({
      url: "https://t.me/HTI_Armenia",
      language: "hy",
      status: "candidate",
      metadata: { productionCollection: false, publisherReference: "https://old.hightech.gov.am/en/national-center-for-information-security-and-cryptography", sourcePortfolioVerification: { observedItemCount: 8, observedUsefulItemCount: 0 } }
    });
    for (const expected of [
      ["src_infotecs_official_telegram", "https://t.me/infotecs_official", "ru", "https://infotecs.ru/press-center/social/", 18],
      ["src_usergate_news_telegram", "https://t.me/usergatenews", "ru", "https://docs.usergate.com/hardware/usergate-ngfw-f8010-datasheet-ru.pdf", 14],
      ["src_ideco_ngfw_telegram", "https://t.me/ideco", "ru", "https://ideco.ru/links", 20],
      ["src_ideco_security_news_telegram", "https://t.me/ideco_news", "ru", "https://ideco.ru/links", 13],
      ["src_infowatch_security_telegram", "https://t.me/infowatchout", "ru", "https://www.infowatch.ru/company/about", 16]
    ] as const) {
      expect(report.accepted.find((item: any) => item.id === expected[0])).toMatchObject({
        url: expected[1],
        language: expected[2],
        status: "candidate",
        metadata: { productionCollection: false, publisherReference: expected[3], sourcePortfolioVerification: { observedItemCount: expected[4], observedUsefulItemCount: 0 } }
      });
    }
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
      "src_uzcert_live_telegram",
      "src_red_hot_cyber_telegram",
      "src_segu_info_telegram",
      "src_securitylab_ru_telegram",
      "src_csirt_italia_telegram",
      "src_bizone_telegram",
      "src_ruscadasec_news_telegram",
      "src_scadax_news_telegram",
      "src_security_vision_telegram",
      "src_angara_security_telegram",
      "src_anti_malware_ru_telegram",
      "src_netlas_telegram",
      "src_f6_cybersecurity_telegram",
      "src_tumar_one_telegram",
      "src_lukas_stefanko_android_malware_telegram",
      "src_ransomfeed_ransomware_telegram",
      "src_threat_hunting_father_telegram",
      "src_dciber_brazil_telegram",
      "src_redseg_latam_telegram",
      "src_alexander_leonov_english_telegram",
      "src_zhassulan_maldevcc_telegram",
      "src_hispasec_unaaldia_telegram",
      "src_cyber_bro_uzbekistan_telegram",
      "src_codeby_security_telegram",
      "src_eset_ukraine_telegram",
      "src_stormwall_ddos_telegram",
      "src_rvision_security_telegram",
      "src_jet_infosystems_telegram",
      "src_k2_tech_security_telegram",
      "src_security_code_telegram",
      "src_aktiv_security_telegram",
      "src_phishman_security_telegram",
      "src_cryptopro_security_telegram",
      "src_tsarka_certkznews_telegram",
      "src_armenia_cyberpolice_telegram",
      "src_s2w_dailybrief_telegram",
      "src_uzbekistan_mia_cyberpolice_telegram",
      "src_armenia_hti_telegram",
      "src_infotecs_official_telegram",
      "src_usergate_news_telegram",
      "src_ideco_ngfw_telegram",
      "src_ideco_security_news_telegram",
      "src_infowatch_security_telegram"
    ]);
    expect(candidates.every((item: any) => item.countsAsCoverage !== true
      && item.metadata.productionCollection === false
      && item.metadata.countsAsCoverage === false
      && item.metadata.sourcePortfolioQualificationState === "pending_sustained_productivity"
      && item.metadata.sourcePortfolioVerification.outcome === "content_parsed"
      && item.metadata.sourcePortfolioVerification.observedItemCount > 0
      && item.metadata.sourcePortfolioVerification.observedUsefulItemCount >= 0
      && !evaluateSourceForCollection(item).allowed
      && !isExecutableSource(item))).toBe(true);
    expect(candidates.filter((item: any) => item.metadata.sourcePortfolioVerification.observedUsefulItemCount === 0)).toHaveLength(18);
    expect(report.accepted.map((item: any) => item.url)).not.toEqual(expect.arrayContaining([
      "https://t.me/FalconFeedsio",
      "https://t.me/noname05716",
      "https://t.me/dailydarkweb",
      "https://t.me/darkwebinformer_news",
      "https://t.me/kzcert"
    ]));

    const store = new InMemoryScraperStore();
    const first = bootstrapRuntimeSources(store, { seedPaths: [seedPath.pathname], generatedAt: bundle.generatedAt });
    const restart = bootstrapRuntimeSources(store, { seedPaths: [seedPath.pathname], generatedAt: bundle.generatedAt });

    expect(first).toMatchObject({ importedSourceCount: bundle.sourceCount, updatedSourceCount: 0, activeSourceCount: 7, errors: [] });
    expect(restart).toMatchObject({ importedSourceCount: 0, updatedSourceCount: 0, skippedSourceCount: bundle.sourceCount, activeSourceCount: 7, totalSourceCount: bundle.sourceCount, errors: [] });
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

  test("keeps reviewed Telegram candidates collecting after seed verification expires", async () => {
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

    expect(await collect("2026-08-09T09:00:00.000Z")).toMatchObject({ completedTaskCount: 1, insertedCaptureCount: 1, failedTaskCount: 0 });
    expect(store.getSource(sourceId)).toMatchObject({
      status: "candidate",
      countsAsCoverage: false,
      metadata: {
        productionCollection: false,
        sourcePortfolioQualificationState: "pending_sustained_productivity",
        sourcePortfolioProductiveCheckCount: 1
      }
    });

    expect(await collect("2026-08-24T09:00:00.000Z")).toMatchObject({ queuedTaskCount: 0, completedTaskCount: 0 });
    approveSourceReview(store, sourceId, "needs_review");
    expect(await collect("2026-08-24T09:00:01.000Z")).toMatchObject({ completedTaskCount: 1, insertedCaptureCount: 1, failedTaskCount: 0 });
    expect(store.getSource(sourceId)).toMatchObject({ status: "candidate", countsAsCoverage: false, metadata: { automaticSourceReview: { state: "needs_review" } } });
    approveSourceReview(store, sourceId);
    expect(await collect("2026-08-24T09:30:01.000Z")).toMatchObject({ completedTaskCount: 1, insertedCaptureCount: 1, failedTaskCount: 0 });
    expect(store.getSource(sourceId)).toMatchObject({
      status: "active",
      countsAsCoverage: true,
      metadata: {
        productionCollection: true,
        sourcePortfolioQualificationState: "sustained_productive",
        sourcePortfolioProductiveCheckCount: 3
      }
    });
    expect(isExecutableSource(store.getSource(sourceId)!)).toBe(true);
    expect(store.listSourceHealthObservations().filter((row: any) => row.sourceId === sourceId)).toHaveLength(3);

    const restart = bootstrapRuntimeSources(store, { seedPaths: [seedPath.pathname], generatedAt: "2026-08-24T09:31:00.000Z" });
    expect(restart).toMatchObject({ importedSourceCount: 0, activeSourceCount: 8, totalSourceCount: bundle.sourceCount, errors: [] });
    expect(bootstrapRuntimeSources(store, { seedPaths: [seedPath.pathname], generatedAt: restart.generatedAt })).toMatchObject({
      importedSourceCount: 0,
      updatedSourceCount: 0,
      skippedSourceCount: bundle.sourceCount,
      activeSourceCount: 8,
      totalSourceCount: bundle.sourceCount,
      errors: []
    });
    expect(store.listSources().filter((item: any) => item.id === sourceId)).toHaveLength(1);
    expect(store.getSource(sourceId)).toMatchObject({
      status: "active",
      countsAsCoverage: true,
      metadata: { productionCollection: true, sourcePortfolioProductiveCheckCount: 3 }
    });
  });
});

function approveSourceReview(store: InMemoryScraperStore, sourceId: string, state: "approved" | "needs_review" = "approved") {
  const current = store.getSource(sourceId)!;
  const selectedEvidenceProvenance = sourceAutomaticReviewEvidenceBindings(current, store.listCaptures()).slice(0, 1);
  store.saveSource({
    ...current,
    metadata: {
      ...current.metadata,
      automaticSourceReview: {
        schemaVersion: SOURCE_AUTOMATIC_REVIEW_SCHEMA,
        state,
        promptVersion: SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION,
        configuredModelVersion: "hanasand",
        sourceIdentity: automaticSourceReviewIdentity(current),
        requestSha256: "a".repeat(64),
        selectedEvidenceIds: selectedEvidenceProvenance.map((item) => item.evidenceId),
        selectedEvidenceProvenance,
        runtimeIdentity: { status: "completed", conversationId: "source-review-proof" },
        decision: { subject: { type: "source", id: sourceId }, action: state === "approved" ? "confirm" : "mark_needs_review", claimValidity: state === "approved" ? "supported" : "unresolved" }
      }
    }
  } as any);
}
