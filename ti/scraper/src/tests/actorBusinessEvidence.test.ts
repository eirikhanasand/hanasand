import { describe, expect, FocusedFrontier, handleApiRequest, InMemoryScraperStore, processCollectedItem, source, test } from "./apiTestHarness.ts";
import { hashContent } from "../utils.ts";
import { actorBusinessEntitiesFromRetainedCapture, actorBusinessLineageCounts } from "../pipeline/actorBusinessBackfill.ts";

const collectedAt = "2026-07-20T15:45:45.322Z";
const catalogSource = source({
  id: "src_ransomwarelive_current_operations_catalog",
  name: "Ransomware.live Public Groups Dataset",
  type: "api",
  url: "https://data.ransomware.live/groups.json",
  metadata: { extractionProfile: "ransomware_operation_catalog", productionCollection: true },
});
const retainedGroupSource = source({
  id: "src_seed_ransomwarelive_groups",
  name: "Ransomware.live Public Groups Dataset",
  type: "api",
  url: "https://data.ransomware.live/groups.json",
  status: "retired",
  metadata: { extractionProfile: "ransomware_group_metadata", productionCollection: false },
});
const secondCatalogSource = source({
  ...catalogSource,
  id: "src_ransomwarelive_current_operations_catalog_mirror",
  name: "Independent Public Ransomware Report",
  url: "https://example.test/independent-ransomware-report",
});
const samePublisherCatalogSource = source({
  ...catalogSource,
  id: "src_ransomwarelive_current_operations_catalog_copy",
  name: "Ransomware.live Public Groups Copy",
  url: "https://data.ransomware.live/archive/groups.json",
});

const cases = {
  BrainCipher: "Brain Cipher emerged in July 2024. The Ransom demand ranges from $150,000 to $1,00,0000. Demand to be paid with Monero (XMR) cryptocurrency. In 2025, they shifted their Negotiation portal to a new server.",
  Arkana: "Arkana is a ransomware group operating a three-phase ransom/sale/leak extortion model primarily focused on telecom and internet service providers.",
  AiLock: "AiLock is a ransomware operation using double-extortion tactics, actively recruiting affiliates and threatening regulatory reporting if ransoms are unpaid.",
  Babuk2: "Babuk Locker 2.0, after failing to make any profit from selling public databases on forums, launched a blog where it claimed public breaches as ransomware attacks.",
  CryLock: "CryLock targeted roughly 400,000 victims over eight years and earned over €64 million in Bitcoin; the operators were later arrested.",
  DarkAngels: "Dark Angels secured the largest known single ransom payment of $75 million from a Fortune 50 company in early 2024.",
  DarkPower: "Dark Power targeted multiple sectors, demanding $10,000 ransoms payable in Monero.",
  HitlerRansomware: "The proof-of-concept did not encrypt files and demanded a 25-euro Vodafone card payment.",
};

describe("actor business-model evidence", () => {
  test("extracts literal third-party business evidence without promoting it to fact", () => {
    const result = groupResult("BrainCipher", cases.BrainCipher, ["DLS"]);
    expect(result.entities.find((row: any) => row.type === "pricing_claim")).toMatchObject({ value: "$150,000 to $1,00,0000", assertionKind: "third_party_report" });
    expect(result.entities.find((row: any) => row.type === "payment_claim")).toMatchObject({ value: "Monero (XMR) cryptocurrency", assertionKind: "third_party_report" });
    expect(result.entities.find((row: any) => row.type === "communication_channel")).toMatchObject({ value: "Negotiation portal", assertionKind: "third_party_report" });
    expect(result.entities.some((row: any) => row.type === "buyer_seller_communication")).toBe(false);
    for (const entity of result.entities.filter((row: any) => ["pricing_claim", "payment_claim", "communication_channel"].includes(row.type))) {
      expect(entity.reviewReasons.length).toBeGreaterThan(0);
      expect(entity.provenance[0]).toMatchObject({ sourceId: catalogSource.id, captureId: result.capture.id, collectedAt });
      expect(entity.provenance[0].evidenceText).toContain(entity.type === "pricing_claim" ? "Ransom demand" : entity.type === "payment_claim" ? "paid with Monero" : "Negotiation portal");
    }
  });

  test("persists idempotent claim lineage and projects real review metadata", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(catalogSource);
    const result = groupResult("BrainCipher", cases.BrainCipher, ["DLS"]);
    store.savePipelineResult(result);
    expect(store.listCaptures()[0]).toMatchObject({ storageKind: "metadata_only", sensitive: true });
    expect(store.listCaptures()[0]?.body).toBeUndefined();
    const firstCounts = lineageCounts(store);
    store.savePipelineResult(result);
    expect(lineageCounts(store)).toEqual(firstCounts);

    const response = await handleApiRequest(new Request("http://local/v1/intel/search?tenantId=default&q=BrainCipher&entityType=actor"), { store, frontier: new FocusedFrontier(), port: 0 } as any);
    expect(response.status).toBe(200);
    const model = (await response.json() as any).actorIntelligence.businessModel;
    expect(model.schemaVersion).toBe("ti.actor.business_model.v2");
    expect(model.pricingClaims[0]).toMatchObject({
      value: "$150,000 to $1,00,0000",
      evidenceKind: "third_party_report",
      reviewState: "needs_review",
      corroborationState: "single_source",
      firstSeenAt: collectedAt,
      lastSeenAt: collectedAt,
      sourceCount: 1,
      evidenceCount: 1,
      sourceIds: [catalogSource.id],
      claimIds: [expect.stringMatching(/^claim_/)],
      evidence: [expect.objectContaining({ captureId: result.capture.id, excerpt: expect.stringContaining("Ransom demand") })],
    });
    expect(model.paymentClaims[0]).toMatchObject({ value: "Monero (XMR) cryptocurrency", reviewState: "needs_review" });
    expect(model.communicationChannels[0]).toMatchObject({ value: "Negotiation portal", reviewState: "needs_review" });
    expect(model.buyerSellerCommunications).toEqual([]);
    expect(model.profitabilityConclusion).toMatchObject({ status: "unknown", sourceIds: [], captureIds: [] });
    expect(model.missingEvidence).not.toContain("pricing or ransom demands");
    expect(model.missingEvidence).not.toContain("payment demands or methods");
    expect(model.missingEvidence).toContain("buyer and seller conversations");
    expect(model.missingEvidence).toContain("independently verified revenue");
    expect(model.missingEvidence).toContain("independently verified profitability");
  });

  test("keeps shared price and payment claims isolated by actor evidence", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(catalogSource);
    store.saveSource(secondCatalogSource);
    const first = groupResult("DarkPower", "DarkPower demanded $10,000 ransoms payable in Monero.");
    const second = groupResult("ExampleLock", "ExampleLock demanded $10,000 ransoms payable in Monero.", [], undefined, secondCatalogSource);
    store.savePipelineResult(first);
    store.savePipelineResult(second);

    const priceClaim = store.listIntelligenceClaims().find((claim: any) => claim.claimType === "pricing_claim" && claim.value?.value === "$10,000");
    expect(priceClaim).toMatchObject({ corroborationState: "corroborated", sourceCount: 2 });
    store.saveClaimReview({ id: "review_shared_price", claimId: priceClaim.id, action: "confirm", reviewerId: "analyst", reason: "Confirmed only for the retained subject association.", reviewedAt: "2026-07-20T16:00:00.000Z" });

    const firstResponse = await searchResult(store, "DarkPower");
    const secondResponse = await searchResult(store, "ExampleLock");
    const firstModel = firstResponse.actorIntelligence.businessModel;
    const secondModel = secondResponse.actorIntelligence.businessModel;
    expect(firstModel.pricingClaims[0]).toMatchObject({ value: "$10,000", reviewState: "confirmed", corroborationState: "single_source", sourceIds: [catalogSource.id], captureIds: [first.capture.id] });
    expect(secondModel.pricingClaims[0]).toMatchObject({ value: "$10,000", reviewState: "needs_review", corroborationState: "single_source", sourceIds: [secondCatalogSource.id], captureIds: [second.capture.id] });
    expect(firstModel.paymentClaims[0]).toMatchObject({ value: "Monero", sourceIds: [catalogSource.id], captureIds: [first.capture.id] });
    expect(secondModel.paymentClaims[0]).toMatchObject({ value: "Monero", sourceIds: [secondCatalogSource.id], captureIds: [second.capture.id] });
    expect(firstResponse.claims.find((claim: any) => claim.claimType === "pricing_claim")).toMatchObject({ reviewState: "confirmed", corroborationState: "single_source", sourceCount: 1, evidenceCount: 1 });
    expect(secondResponse.claims.find((claim: any) => claim.claimType === "pricing_claim")).toMatchObject({ reviewState: "needs_review", corroborationState: "single_source", sourceCount: 1, evidenceCount: 1 });
  });

  test("uses one reviewed actor-local projection across independent captures", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(catalogSource);
    store.saveSource(secondCatalogSource);
    store.savePipelineResult(groupResult("DarkPower", "DarkPower demanded $10,000 ransoms payable in Monero."));
    store.savePipelineResult(groupResult("DarkPower", "A second report says DarkPower demanded $10,000 ransoms payable in Monero.", [], undefined, secondCatalogSource));
    const priceClaim = store.listIntelligenceClaims().find((claim: any) => claim.claimType === "pricing_claim" && claim.value?.value === "$10,000");
    store.saveClaimReview({ id: "review_actor_price", claimId: priceClaim.id, action: "confirm", reviewerId: "analyst", reason: "Confirmed for this actor association.", reviewedAt: "2026-07-20T16:00:00.000Z" });

    const response = await searchResult(store, "DarkPower");
    expect(response.claims.find((claim: any) => claim.claimType === "pricing_claim")).toMatchObject({ reviewState: "confirmed", corroborationState: "corroborated", sourceCount: 2, evidenceCount: 2 });
    expect(response.actorIntelligence.businessModel.pricingClaims[0]).toMatchObject({ reviewState: "confirmed", corroborationState: "corroborated", sourceCount: 2, evidenceCount: 2 });
  });

  test("counts two source records from one publisher as one independent source", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(catalogSource);
    store.saveSource(samePublisherCatalogSource);
    store.savePipelineResult(groupResult("DarkPower", "DarkPower demanded $10,000 ransoms payable in Monero."));
    store.savePipelineResult(groupResult("DarkPower", "An archive says DarkPower demanded $10,000 ransoms payable in Monero.", [], undefined, samePublisherCatalogSource));

    const response = await searchResult(store, "DarkPower");
    expect(response.claims.find((claim: any) => claim.claimType === "pricing_claim")).toMatchObject({ corroborationState: "single_source", sourceCount: 1, evidenceCount: 2 });
    expect(response.actorIntelligence.businessModel.pricingClaims[0]).toMatchObject({ corroborationState: "single_source", sourceCount: 1, evidenceCount: 2 });
  });

  test("backfills retained metadata captures without multiplying lineage", () => {
    const store = new InMemoryScraperStore();
    store.saveSource(retainedGroupSource);
    const result = groupResult("BrainCipher", cases.BrainCipher, ["DLS"]);
    const retainedCapture = {
      ...result.capture,
      sourceId: retainedGroupSource.id,
      provenance: { ...result.capture.provenance, sourceId: retainedGroupSource.id },
    };
    const oldEntities = result.entities.filter((entity: any) => !["pricing_claim", "payment_claim", "communication_channel"].includes(entity.type));
    expect(oldEntities.map((entity: any) => entity.type)).toEqual(expect.arrayContaining(["ransomware_family", "channel_type"]));
    store.savePipelineResult({ capture: retainedCapture, entities: oldEntities, indicators: [] });
    expect(actorBusinessLineageCounts(store, new Set([retainedCapture.id]))).toEqual({ entities: 0, claims: 0, claimEvidence: 0 });
    const entities = actorBusinessEntitiesFromRetainedCapture(retainedCapture);
    expect(entities.map((entity: any) => entity.type)).toEqual(expect.arrayContaining(["pricing_claim", "payment_claim", "communication_channel"]));
    expect(entities.every((entity: any) => entity.provenance[0].sourceId === retainedGroupSource.id)).toBe(true);

    store.savePipelineResult({ capture: retainedCapture, entities, indicators: [] });
    expect(actorBusinessLineageCounts(store, new Set([retainedCapture.id]))).toMatchObject({ entities: entities.length });
    const firstCounts = lineageCounts(store);
    store.savePipelineResult({ capture: retainedCapture, entities: actorBusinessEntitiesFromRetainedCapture(retainedCapture), indicators: [] });
    expect(lineageCounts(store)).toEqual(firstCounts);
  });

  test("builds reproducible cases for operating model, intermediaries, pressure and profitability", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(catalogSource);
    for (const [actor, description] of Object.entries(cases)) store.savePipelineResult(groupResult(actor, description));

    const arkana = await searchModel(store, "Arkana");
    expect(arkana.extortionModels).toContainEqual(expect.objectContaining({ value: "three-phase ransom/sale/leak extortion model", evidenceKind: "third_party_report" }));
    expect(arkana.monetizationPaths).toContainEqual(expect.objectContaining({ value: "Ransom demand, data sale, then publication" }));

    const aiLock = await searchModel(store, "AiLock");
    expect(aiLock.extortionModels).toContainEqual(expect.objectContaining({ value: "double-extortion" }));
    expect(aiLock.intermediaryCommunications).toContainEqual(expect.objectContaining({ value: "Affiliate recruitment", reviewState: "needs_review" }));
    expect(aiLock.pressureTactics).toContainEqual(expect.objectContaining({ value: "Threat of regulatory reporting" }));

    const babuk = await searchModel(store, "Babuk2");
    expect(babuk.advertisedData).toContainEqual(expect.objectContaining({ value: "Public databases" }));
    expect(babuk.monetizationPaths).toContainEqual(expect.objectContaining({ value: "Public database sales" }));
    expect(babuk.profitabilitySignals).toContainEqual(expect.objectContaining({ value: "Reported failure to profit from public database sales", reviewState: "needs_review" }));
    expect(babuk.profitabilityConclusion.status).toBe("profitability_reported");
    expect(babuk.profitabilityConclusion.summary).toContain("unverified");

    const cryLock = await searchModel(store, "CryLock");
    expect(cryLock.revenueClaims).toContainEqual(expect.objectContaining({ value: "Reported proceeds of €64 million in Bitcoin", evidenceKind: "third_party_report" }));
    expect(cryLock.profitabilityConclusion).toMatchObject({ status: "revenue_reported", summary: expect.stringContaining("profit remain unknown") });

    const darkAngels = await searchModel(store, "DarkAngels");
    expect(darkAngels.paymentClaims).toContainEqual(expect.objectContaining({ value: "Reported $75 million ransom payment" }));
    expect(darkAngels.revenueClaims).toContainEqual(expect.objectContaining({ value: "Reported $75 million ransom payment" }));

    const darkPower = await searchModel(store, "DarkPower");
    expect(darkPower.pricingClaims).toContainEqual(expect.objectContaining({ value: "$10,000" }));
    expect(darkPower.paymentClaims).toContainEqual(expect.objectContaining({ value: "Monero" }));

    const cardDemand = await searchModel(store, "HitlerRansomware");
    expect(cardDemand.pricingClaims).toContainEqual(expect.objectContaining({ value: "25-euro" }));
    expect(cardDemand.paymentClaims).toContainEqual(expect.objectContaining({ value: "Vodafone card payment" }));
  });

  test("does not project channel labels or victim counts as business evidence", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(catalogSource);
    const result = groupResult("Example", "Example has 500 publicly listed victims.", ["Chat", "DLS"], 500);
    expect(result.entities.some((entity: any) => ["communication_channel", "buyer_seller_communication", "intermediary_communication", "profitability_signal", "revenue_claim", "pricing_claim", "payment_claim"].includes(entity.type))).toBe(false);
    store.savePipelineResult(result);
    const model = await searchModel(store, "Example");
    expect(model).toMatchObject({
      evidenceState: "not_observed",
      extortionModels: [],
      publicationStrategies: [],
      publicityTactics: [],
      communicationChannels: [],
      buyerSellerCommunications: [],
      intermediaryCommunications: [],
      revenueClaims: [],
      profitabilitySignals: [],
    });
  });
});

function groupResult(actorName: string, description: string, channelTypes: string[] = [], victimCount?: number, inputSource = catalogSource) {
  const rawText = [inputSource.name, actorName, channelTypes.length ? `Public channel classes: ${channelTypes.join(", ")}` : "", description].filter(Boolean).join("\n");
  return processCollectedItem({
    tenantId: "default",
    sourceId: inputSource.id,
    url: `${inputSource.url}#${encodeURIComponent(actorName)}`,
    title: `${inputSource.name}: ${actorName}`,
    rawText,
    body: rawText,
    collectedAt,
    contentHash: hashContent(rawText),
    links: [inputSource.url],
    metadata: {
      extractionProfile: "ransomware_group_metadata",
      ransomwareGroup: { actorName, description, channelTypes, victimCount, metadataOnly: true, locatorsRetained: false },
    },
    sensitive: true,
  } as any);
}

async function searchModel(store: InMemoryScraperStore, actor: string) {
  return (await searchResult(store, actor)).actorIntelligence.businessModel;
}

async function searchResult(store: InMemoryScraperStore, actor: string) {
  const response = await handleApiRequest(new Request(`http://local/v1/intel/search?tenantId=default&q=${encodeURIComponent(actor)}&entityType=actor`), { store, frontier: new FocusedFrontier(), port: 0 } as any);
  expect(response.status).toBe(200);
  return response.json() as any;
}

function lineageCounts(store: InMemoryScraperStore) {
  return {
    captures: store.listCaptures().length,
    entities: store.listExtractedEntities().length,
    claims: store.listIntelligenceClaims().length,
    claimEvidence: store.listClaimEvidence().length,
    evidenceLinks: store.listEvidenceLinks().length,
  };
}
