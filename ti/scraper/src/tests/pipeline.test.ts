import { describe, expect, test } from "bun:test";
import { buildActiveLearningCandidateQueueDto, buildAnalystFeedbackLoopDto, buildAnalystQualityReviewQueueDto } from "../pipeline/analystFeedback.ts";
import { buildQualityRuntimeValueGatesDto, evaluateExtractionCalibration, evaluateExtractionFixtures } from "../pipeline/evaluation.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { SOURCE_SPECIFIC_EXTRACTOR_VERSION } from "../pipeline/sourceSpecificExtraction.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { hashContent } from "../utils.ts";

describe("compact pipeline value path", () => {
  test("extracts actor, victim, CVE and provenance from public text", () => {
    const rawText = "APT29 used phishing against Northwind Health with CVE-2026-1234.";
    const result = processCollectedItem({ sourceId: "src_public", url: "https://example.test/report", title: "APT29 report", collectedAt: "2026-06-21T00:00:00.000Z", rawText, contentHash: hashContent(rawText), links: [], metadata: {}, sensitive: false });
    expect(result.entities.some((entity: any) => entity.type === "actor")).toBe(true);
    expect(result.entities.some((entity: any) => entity.type === "victim")).toBe(true);
    expect(result.indicators.some((indicator: any) => indicator.type === "cve")).toBe(true);
    expect(result.capture.metadata.title).toBe("APT29 report");
    expect(result.incident?.captureId).toBe(result.capture.id);
  });

  test("scores extraction fixtures and sellable row gates", () => {
    const fixtures = [{ id: "apt29", rawText: "APT29 targeted Northwind Health with CVE-2026-1234", expected: { actor: "APT29", cve: "CVE-2026-1234" } }];
    const report = evaluateExtractionFixtures(fixtures);
    const calibration = evaluateExtractionCalibration(fixtures);
    const gates = buildQualityRuntimeValueGatesDto({ rows: [{ actor: "APT29", victim: "Northwind Health" }] });
    expect(report.fixtureCount).toBe(1);
    expect(calibration.qualityNotes.length).toBeGreaterThan(0);
    expect(gates.summary.sellableRows).toBe(1);
  });

  test("uses source-specific structured fields before the deterministic fallback", () => {
    const collectedAt = "2026-07-20T00:00:00.000Z";
    const darknet = processCollectedItem({
      sourceId: "src_darknet",
      url: `http://${"a".repeat(56)}.onion/`,
      collectedAt,
      rawText: "Blackout has just published a new victim: Example Energy AS Claimed data category: customer records.",
      contentHash: hashContent("darknet"),
      links: [],
      sensitive: true,
      metadata: { extractionProfile: "ransomware_victim_blog", leakSite: { actorName: "Blackout", victimName: "Example Energy AS", claimedSector: "energy", claimedCountry: "Norway", claimedDataType: "customer records", summary: "PENDING Publishes after: 2d remaining. Download: metadata-only release reference. If you are listed by mistake, contact us.", extortionType: "double extortion", monetizationPath: "ransom demand", publicityTactic: "countdown announcement", buyerSellerCommunication: "auction contact channel", intermediaryCommunication: "broker listing", profitabilitySignal: "claimed paid victims" } }
    });
    const cisa = processCollectedItem({
      sourceId: "src_cisa_kev",
      url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      collectedAt,
      rawText: "CVE-2026-1234 is a known exploited vulnerability.",
      contentHash: hashContent("cisa"),
      links: [],
      sensitive: false,
      metadata: { extractionProfile: "cisa_kev", structuredFields: { cveID: "CVE-2026-1234", vendorProject: "Example Vendor", product: "Example Product", knownRansomwareCampaignUse: "Known" } }
    });
    const certUa = processCollectedItem({
      sourceId: "src_ssscip_cert_ua_telegram",
      url: "https://t.me/dsszzi_official/1",
      collectedAt,
      rawText: "CERT-UA attributes this campaign to UAC-0050.",
      contentHash: hashContent("cert-ua"),
      links: [],
      sensitive: false,
      metadata: { extractionProfile: "cert_ua_public_channel" }
    });

    expect(darknet.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "ransomware_family", value: "Blackout", extractionMethod: "source_specific" }),
      expect.objectContaining({ type: "victim", value: "Example Energy AS", assertionKind: "source_claim", extractorVersion: SOURCE_SPECIFIC_EXTRACTOR_VERSION }),
      expect.objectContaining({ type: "publication_strategy", value: "public victim listing", assertionKind: "observed" }),
      expect.objectContaining({ type: "extortion_type", value: "double extortion", assertionKind: "source_claim" }),
      expect.objectContaining({ type: "monetization_path", value: "ransom demand", assertionKind: "source_claim" }),
      expect.objectContaining({ type: "publicity_tactic", value: "countdown announcement", assertionKind: "source_claim" }),
      expect.objectContaining({ type: "victim_pressure_tactic", value: "countdown to publication", assertionKind: "observed" }),
      expect.objectContaining({ type: "publication_strategy", value: "staged publication status", assertionKind: "observed" }),
      expect.objectContaining({ type: "publication_strategy", value: "public data release link", assertionKind: "observed" }),
      expect.objectContaining({ type: "buyer_seller_communication", value: "auction contact channel", assertionKind: "source_claim" }),
      expect.objectContaining({ type: "intermediary_communication", value: "broker listing", assertionKind: "source_claim" }),
      expect.objectContaining({ type: "profitability_signal", value: "claimed paid victims", reviewReasons: ["signal does not establish realized profit"] })
    ]));
    expect(darknet.entities.some((entity: any) => entity.type === "communication_channel")).toBe(false);
    expect(darknet.entities.filter((entity: any) => entity.type === "victim")).toEqual([
      expect.objectContaining({ value: "Example Energy AS", extractionMethod: "source_specific" })
    ]);
    expect(darknet.entities.some((entity: any) => entity.type === "actor" && entity.value === "Blackout")).toBe(false);
    expect(cisa.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "product", value: "Example Product", confidence: 0.94 }),
      expect.objectContaining({ type: "impact", value: "known ransomware campaign use" })
    ]));
    expect(certUa.entities).toContainEqual(expect.objectContaining({ type: "actor", value: "UAC-0050", extractionMethod: "source_specific" }));

    const store = new InMemoryScraperStore();
    store.savePipelineResult(darknet);
    expect(store.listExtractedEntities().find((entity: any) => entity.type === "victim")?.extractorVersion).toBe(SOURCE_SPECIFIC_EXTRACTOR_VERSION);
    expect(store.listActorProfiles()).toContainEqual(expect.objectContaining({ canonicalName: "Blackout", actorType: "ransomware" }));
  });

  test("keeps actor aliases distinct and matches short names on token boundaries", () => {
    const item = (rawText: string) => processCollectedItem({ sourceId: "src_alias", url: "https://example.test/alias", collectedAt: "2026-07-20T00:00:00.000Z", rawText, contentHash: hashContent(rawText), links: [], metadata: {}, sensitive: false });
    const actors = item("ShinyHunters was mentioned alongside Scattered Spider.").entities.filter((entity: any) => entity.type === "actor").map((entity: any) => entity.value);
    expect(actors).toEqual(expect.arrayContaining(["ShinyHunters", "Scattered Spider"]));
    expect(item("A malware report says ransomware activity increased. Google Play Protect blocked the unrelated Android app.").entities.some((entity: any) => entity.type === "ransomware_family" && entity.value === "Play")).toBe(false);
    expect(item("The Play ransomware group claimed a new victim.").entities).toContainEqual(expect.objectContaining({ type: "ransomware_family", value: "Play" }));
  });

  test("keeps one canonical profile when actor classification strengthens", () => {
    const item = (rawText: string, id: string) => processCollectedItem({ sourceId: `src_${id}`, url: `https://example.test/${id}`, collectedAt: "2026-07-20T00:00:00.000Z", rawText, contentHash: hashContent(rawText), links: [], metadata: {}, sensitive: false });
    const store = new InMemoryScraperStore();

    store.savePipelineResult(item("The Akira ransomware group claimed a new victim.", "ransomware"));
    store.savePipelineResult(item("Akira was referenced in a later public report.", "generic"));

    expect(store.listActorProfiles()).toEqual([
      expect.objectContaining({ canonicalName: "Akira", normalizedName: "akira", actorType: "ransomware", aliases: ["Akira"], evidenceCount: 2 })
    ]);
  });

  test("reuses a migrated global profile whose tenant is stored as null", () => {
    const store = new InMemoryScraperStore();
    store.saveActorProfile({ id: "actor_legacy_akira", tenantId: null, canonicalName: "Akira", normalizedName: "akira", actorType: "ransomware", confidence: 0.8, aliases: ["Akira"], sourceIds: ["src_legacy"], captureIds: ["cap_legacy"], evidenceCount: 1 });
    store.savePipelineResult(processCollectedItem({ sourceId: "src_current", url: "https://example.test/current", collectedAt: "2026-07-21T00:00:00.000Z", rawText: "Akira was referenced in a public report.", contentHash: hashContent("current"), links: [], metadata: {}, sensitive: false }));

    expect(store.listActorProfiles()).toEqual([
      expect.objectContaining({ id: "actor_legacy_akira", actorType: "ransomware", evidenceCount: 2, captureIds: ["cap_legacy", expect.stringMatching(/^cap_/)] })
    ]);
  });

  test("builds compact analyst feedback and learning queues", () => {
    const feedback = buildAnalystFeedbackLoopDto({ items: [{ id: "row_1", mark: "needs_review" }] });
    const review = buildAnalystQualityReviewQueueDto({ rows: [{ id: "row_1", state: "queued" }] });
    const active = buildActiveLearningCandidateQueueDto({ candidates: [{ id: "row_1", score: 0.9 }] });
    expect(feedback.corrections).toHaveLength(1);
    expect(review.releaseGate).toBe("pass");
    expect(active.summary.highPriority).toBe(1);
  });
});
