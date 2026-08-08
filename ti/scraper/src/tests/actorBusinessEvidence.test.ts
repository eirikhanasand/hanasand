import { describe, expect, FocusedFrontier, handleApiRequest, InMemoryScraperStore, processCollectedItem, source, test } from "./apiTestHarness.ts";
import { hashContent } from "../utils.ts";
import { actorBusinessEntitiesFromRetainedCapture, actorBusinessLineageCounts } from "../pipeline/actorBusinessBackfill.ts";
import type { ActorIdentityRecord } from "../pipeline/mitreActorCatalog.ts";
import { feedItems } from "../ops/canaryFeedItems.ts";

const collectedAt = "2026-07-20T15:45:45.322Z";
const publishedAt = "2026-07-18T09:30:00.000Z";
const feedPublishedAt = "Sat, 18 Jul 2026 11:30:00 +0200";
const catalogSource = source({
  id: "src_ransomwarelive_current_operations_catalog",
  name: "Ransomware.live Public Groups Dataset",
  type: "api",
  url: "https://data.ransomware.live/groups.json",
  metadata: { extractionProfile: "ransomware_operation_catalog", productionCollection: true },
});
const mirrorSource = source({
  ...catalogSource,
  id: "src_independent_actor_report",
  name: "Independent Public Ransomware Report",
  url: "https://reports.example.test/ransomware",
});
const publicReportSource = source({
  ...catalogSource,
  id: "src_public_ransomware_report",
  name: "Independent Security News",
  type: "rss",
  url: "https://news.example.test/security.xml",
  metadata: { productionCollection: true },
});
const retainedGroupSource = source({
  ...catalogSource,
  id: "src_seed_ransomwarelive_groups",
  status: "retired",
});
const brainCipher = "The Ransom demand ranges from $150,000 to $1,00,0000. Demand to be paid with Monero (XMR) cryptocurrency. They shifted their Negotiation portal to a new server.";

describe("actor business-model reviewed evidence", () => {
  test("keeps exact but unreviewed findings pending and out of reviewed case counts", async () => {
    const store = actorStore(["BrainCipher"]);
    const result = groupResult("BrainCipher", brainCipher, { publishedAt: undefined });
    store.savePipelineResult(result);

    const response = await searchResult(store, "BrainCipher");
    const model = response.actorIntelligence.businessModel;
    expect(model.schemaVersion).toBe("ti.actor.business_model.v3");
    expect(model.evidenceState).toBe("pending_review");
    expect(model.pricingClaims).toEqual([]);
    expect(model.negotiationClaims).toEqual([]);
    expect(model.paymentClaims).toEqual([]);
    expect(model.pendingFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "$150,000 to $1,00,0000", reviewState: "needs_review" }),
    ]));
    expect(model.profitabilityConclusion).toMatchObject({ status: "unknown", sourceIds: [], captureIds: [] });
    const pendingEvidence = response.actorIntelligence.businessModel.pendingFindings[0].evidence[0];
    expect(pendingEvidence.publishedAt).toBeUndefined();
    expect(pendingEvidence.collectedAt).toBe(collectedAt);
    expect(pendingEvidence.contentHash).toBe(result.capture.contentHash);
    expect(pendingEvidence.claimId).toMatch(/^claim_/);
    expect(pendingEvidence.claimEvidenceId).toMatch(/^claim-evidence_/);
    expect(pendingEvidence.entityId).toMatch(/^entity_/);
    expect(response.actorCaseStudies).toMatchObject({
      schemaVersion: "ti.actor.case_studies.v2",
      supportedActorCount: 0,
      caseStudyCount: 0,
      pendingActorCount: 1,
      pendingFindingCount: 3,
      actorClassCounts: { ransomwareOrExtortion: 0, aptOrIntrusionSet: 0, otherThreatActor: 0 },
      cases: [],
      missingContexts: ["reviewed state/APT business-model evidence"],
    });
  });

  test("projects a reviewed multi-category case only after current exact confirmations", async () => {
    const store = actorStore(["BrainCipher"]);
    const result = groupResult("BrainCipher", brainCipher, { publishedAt });
    store.savePipelineResult(result);
    confirmBusinessClaims(store, result.capture.id);

    const response = await searchResult(store, "BrainCipher");
    const model = response.actorIntelligence.businessModel;
    expect(model.evidenceState).toBe("reviewed_mechanisms");
    expect(model.pricingClaims[0]).toMatchObject({ value: "$150,000 to $1,00,0000", reviewState: "confirmed", firstPublishedAt: publishedAt, firstCollectedAt: collectedAt });
    expect(model.negotiationClaims[0]).toMatchObject({ value: "Negotiation portal", reviewState: "confirmed" });
    expect(model.paymentClaims[0]).toMatchObject({ value: "Monero (XMR) cryptocurrency", reviewState: "confirmed" });
    expect(model.pendingFindings).toEqual([]);
    expect(model.pricingClaims[0].evidence[0]).toMatchObject({
      sourceId: catalogSource.id,
      captureId: result.capture.id,
      claimId: expect.stringMatching(/^claim_/),
      claimEvidenceId: expect.stringMatching(/^claim-evidence_/),
      entityId: expect.stringMatching(/^entity_/),
      contentHash: result.capture.contentHash,
      publishedAt,
      collectedAt,
    });
    expect(response.actorCaseStudies).toMatchObject({
      supportedActorCount: 1,
      caseStudyCount: 1,
      pendingActorCount: 0,
      pendingFindingCount: 0,
      actorClassCounts: { ransomwareOrExtortion: 1, aptOrIntrusionSet: 0, otherThreatActor: 0 },
      cases: [expect.objectContaining({
        actor: "BrainCipher",
        categories: ["negotiation", "payment", "pricing"],
        sourceCount: 1,
        firstPublishedAt: publishedAt,
        firstCollectedAt: collectedAt,
        reviewStates: ["confirmed"],
        findings: expect.arrayContaining([expect.objectContaining({
          relationship: "supports",
          evidenceStage: "metadata_only_claim",
          reviewedBy: "analyst",
        })]),
      })],
    });
  });

  test("keeps current reviewed evidence when the aggregate claim also retains retired source history", async () => {
    const store = actorStore(["BrainCipher"]);
    store.saveSource(retainedGroupSource);
    const active = groupResult("BrainCipher", brainCipher, { publishedAt });
    const retired = groupResult("BrainCipher", brainCipher, { inputSource: retainedGroupSource, publishedAt });
    store.savePipelineResult(active);
    store.savePipelineResult(retired);
    confirmBusinessClaims(store, active.capture.id);

    const pricingClaim = businessClaimsForCapture(store, active.capture.id).find((claim: any) => claim.claimType === "pricing_claim");
    expect(pricingClaim.sourceIds).toEqual(expect.arrayContaining([catalogSource.id, retainedGroupSource.id]));
    const pricing = (await searchResult(store, "BrainCipher")).actorIntelligence.businessModel.pricingClaims[0];
    expect(pricing).toMatchObject({ value: "$150,000 to $1,00,0000", reviewState: "confirmed", corroborationState: "single_source" });
    expect(pricing.captureIds).toEqual([active.capture.id]);
    expect(pricing.evidence.map((row: any) => row.captureId)).toEqual([active.capture.id]);
  });

  test("extracts an exact dated single-actor public report and rejects undated or multi-actor reports", async () => {
    const identities = [identity("Everest", []), identity("Helix", []), identity("LockBit", [])];
    const store = actorStore(["Everest", "Helix", "LockBit"]);
    store.saveSource(publicReportSource);
    const text = "Stadler Rail says the Everest ransomware gang demanded about $12.3 million after breaching its supplier platform.";
    const report = publicReportResult(text, identities);
    store.savePipelineResult(report);

    expect(report.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "actor", value: "Everest", assertionKind: "third_party_report", extractionMethod: "source_specific" }),
      expect.objectContaining({ type: "pricing_claim", value: "$12.3 million", assertionKind: "third_party_report", extractionMethod: "source_specific" }),
    ]));
    expect((await searchResult(store, "Everest")).actorIntelligence.businessModel.pendingFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "$12.3 million", sourceIds: [publicReportSource.id], captureIds: [report.capture.id] }),
    ]));
    confirmBusinessClaims(store, report.capture.id);
    expect((await searchResult(store, "Everest")).actorIntelligence.businessModel.pricingClaims[0]).toMatchObject({
      value: "$12.3 million",
      evidence: [expect.objectContaining({ captureId: report.capture.id, publishedAt })],
    });

    expect(publicReportResult(text, identities, { publishedAt: undefined }).entities.some((entity: any) => entity.type === "pricing_claim")).toBe(false);
    expect(publicReportResult(`${text} LockBit was also discussed in the report.`, identities).entities.some((entity: any) => entity.type === "pricing_claim")).toBe(false);

    const communication = publicReportResult("Helix has just published a new victim: Morguard. Morguard reached out, took extensions, then ignored the negotiation with no real offer. Contacting us and stalling is not a strategy. Deadlines stand. Silence after outreach gets a private board and a countdown then publication.", identities);
    const { reportTimestamps: _legacyReportTimestamps, ...legacyMetadata } = communication.capture.metadata ?? {};
    store.savePipelineResult({ capture: { ...communication.capture, metadata: legacyMetadata }, entities: communication.entities.filter((entity: any) => entity.extractionMethod === "deterministic_fallback"), indicators: [] });
    const savedCommunication = store.savePipelineResult(communication);
    expect(savedCommunication.capture.metadata?.reportTimestamps).toBeUndefined();
    expect(communication.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "buyer_seller_communication", value: "Victim outreach followed by stalled negotiation without an offer", assertionKind: "third_party_report", extractionMethod: "source_specific" }),
    ]));
    expect((await searchResult(store, "Helix")).actorIntelligence.businessModel.pendingFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "buyer_seller_communication", value: "Victim outreach followed by stalled negotiation without an offer", sourceIds: [publicReportSource.id], captureIds: [communication.capture.id] }),
    ]));
    const communicationClaim = store.listIntelligenceClaims().find((claim: any) => claim.claimType === "buyer_seller_communication" && claim.captureIds.includes(communication.capture.id));
    review(store, communicationClaim, "confirm");
    expect((await searchResult(store, "Helix")).actorIntelligence.businessModel.buyerSellerCommunications[0]).toMatchObject({
      value: "Victim outreach followed by stalled negotiation without an offer",
      reviewState: "confirmed",
      evidence: [expect.objectContaining({ captureId: communication.capture.id, sourceId: publicReportSource.id })],
    });
    expect(publicReportResult("Helix says: If you are listed by mistake, contact us.", identities).entities.some((entity: any) => entity.type === "buyer_seller_communication")).toBe(false);
  });

  test("treats equivalent ISO review timestamp forms identically", async () => {
    for (const reviewedAt of ["2026-07-20T16:00:00Z", "2026-07-20T16:00:00.000Z"]) {
      const store = actorStore(["DarkPower"]);
      const result = groupResult("DarkPower", "DarkPower demanded $10,000 ransoms.");
      store.savePipelineResult(result);
      review(store, businessClaimsForCapture(store, result.capture.id).find((claim: any) => claim.claimType === "pricing_claim"), "confirm", { reviewedAt });
      expect((await searchResult(store, "DarkPower")).actorIntelligence.businessModel.pricingClaims).toHaveLength(1);
    }
  });

  test("excludes rejected, contradicted and unsupported automatic review decisions", async () => {
    const store = actorStore(["DarkPower"]);
    const result = groupResult("DarkPower", "DarkPower demanded $10,000 ransoms payable in Monero.");
    store.savePipelineResult(result);
    const claims = businessClaimsForCapture(store, result.capture.id);
    review(store, claims.find((claim: any) => claim.claimType === "pricing_claim"), "confirm");
    review(store, claims.find((claim: any) => claim.claimType === "payment_claim"), "confirm", {
      reviewerId: "hanasand-ai:automatic:test",
      automaticDecision: { claimValidity: "invalid" },
    });
    review(store, claims.find((claim: any) => claim.claimType === "pricing_claim"), "reject", { reviewedAt: "2026-07-20T17:00:00.000Z" });

    const response = await searchResult(store, "DarkPower");
    expect(response.actorIntelligence.businessModel).toMatchObject({ pricingClaims: [], paymentClaims: [], pendingFindings: [] });
    expect(response.actorCaseStudies).toMatchObject({ supportedActorCount: 0, caseStudyCount: 0, pendingFindingCount: 0 });
  });

  test("rejects ambiguous catalog labels, unresolved actors and duplicate governed profiles", async () => {
    const ambiguous = actorStore(["Alpha", "Beta"], { Alpha: ["Shared"], Beta: ["Shared"] });
    ambiguous.savePipelineResult(groupResult("Shared", "Shared demanded $10,000 ransoms payable in Monero."));
    expect((await searchResult(ambiguous, "Shared")).actorCaseStudies).toMatchObject({ supportedActorCount: 0, pendingFindingCount: 0, cases: [] });

    const unresolved = actorStore(["Known"]);
    unresolved.savePipelineResult(groupResult("UnknownRawActor", "UnknownRawActor demanded $10,000 ransoms payable in Monero."));
    expect((await searchResult(unresolved, "UnknownRawActor")).actorCaseStudies).toMatchObject({ supportedActorCount: 0, pendingFindingCount: 0, cases: [] });

    const governed = actorStore(["Canonical"]);
    governed.saveActorProfile(profile("profile_one", "Operator X", "test-actors:Canonical"));
    governed.saveActorProfile(profile("profile_two", "Operator X", "test-actors:Canonical"));
    governed.savePipelineResult(groupResult("Operator X", "Operator X demanded $10,000 ransoms payable in Monero."));
    expect((await searchResult(governed, "Operator X")).actorCaseStudies).toMatchObject({ supportedActorCount: 0, pendingFindingCount: 0, cases: [] });
  });

  test("accepts one explicitly governed unique profile when the raw label is not cataloged", async () => {
    const store = actorStore(["Canonical"]);
    store.saveActorProfile(profile("profile_one", "Operator X", "test-actors:Canonical"));
    store.savePipelineResult(groupResult("Operator X", "Operator X demanded $10,000 ransoms payable in Monero."));

    const response = await searchResult(store, "Operator X");
    expect(response.actorCaseStudies).toMatchObject({ supportedActorCount: 0, pendingActorCount: 1, pendingFindingCount: 2, cases: [] });
    expect(response.actorCaseStudies.pendingFindings).toEqual(expect.arrayContaining([expect.objectContaining({ actor: "Canonical" })]));
  });

  test("requires exact source, stage, relationship, hash provenance and non-dangling ids", async () => {
    for (const corrupt of ["source", "stage", "relationship", "hash", "dangling"] as const) {
      const store = actorStore(["DarkPower"]);
      const result = groupResult("DarkPower", "DarkPower demanded $10,000 ransoms payable in Monero.");
      store.savePipelineResult(result);
      const evidence = store.listClaimEvidence().find((row: any) => {
        const linkedClaim = store.getIntelligenceClaim(row.claimId);
        return row.captureId === result.capture.id && ["pricing_claim", "payment_claim"].includes(linkedClaim?.claimType);
      });
      const claim = store.getIntelligenceClaim(evidence.claimId);
      if (corrupt === "source") store.saveClaimEvidence({ ...evidence, sourceId: "src_missing" });
      if (corrupt === "stage") store.saveClaimEvidence({ ...evidence, evidenceStage: "live_discovery" });
      if (corrupt === "relationship") store.saveClaimEvidence({ ...evidence, relationship: "mentions" });
      if (corrupt === "hash") store.saveClaimEvidence({ ...evidence, provenance: [{ ...evidence.provenance[0], contentHash: "wrong" }] });
      if (corrupt === "dangling") store.saveIntelligenceClaim({ ...claim, sourceIds: [...claim.sourceIds, "src_missing"] });
      expect((await searchResult(store, "DarkPower")).actorCaseStudies.pendingFindingCount).toBeLessThan(2);
    }
  });

  test("rejects an exact evidence link when the claim substitutes unrelated live source and capture ids", async () => {
    const store = actorStore(["DarkPower"]);
    store.saveSource(mirrorSource);
    const result = groupResult("DarkPower", "DarkPower demanded $10,000 ransoms.");
    const unrelated = groupResult("Unrelated", "Routine operations report.", { inputSource: mirrorSource });
    store.savePipelineResult(result);
    store.savePipelineResult({ capture: unrelated.capture, entities: [], indicators: [] });
    const claim = businessClaimsForCapture(store, result.capture.id).find((row: any) => row.claimType === "pricing_claim");
    store.saveIntelligenceClaim({ ...claim, sourceIds: [mirrorSource.id], captureIds: [unrelated.capture.id] });
    review(store, claim, "confirm");

    const response = await searchResult(store, "DarkPower");
    expect(response.actorIntelligence.businessModel.pricingClaims).toEqual([]);
    expect(response.actorCaseStudies.reviewedFindings).toEqual([]);
  });

  test("includes global plus exact-tenant evidence and never another tenant", async () => {
    const store = actorStore(["DarkPower"]);
    const global = groupResult("DarkPower", "DarkPower demanded $10,000 ransoms payable in Monero.", { tenantId: undefined });
    const tenantA = groupResult("DarkPower", "DarkPower demanded $20,000 ransoms payable in Bitcoin.", { tenantId: "tenant-a", inputSource: mirrorSource });
    const tenantB = groupResult("DarkPower", "DarkPower demanded $30,000 ransoms payable in Bitcoin.", { tenantId: "tenant-b", inputSource: mirrorSource });
    store.saveSource(mirrorSource);
    for (const result of [global, tenantA, tenantB]) {
      store.savePipelineResult(result);
      confirmBusinessClaims(store, result.capture.id);
    }

    const response = await searchResult(store, "DarkPower", "tenant-a");
    const prices = response.actorIntelligence.businessModel.pricingClaims.map((row: any) => row.value);
    expect(prices).toEqual(expect.arrayContaining(["$10,000", "$20,000"]));
    expect(prices).not.toContain("$30,000");
  });

  test("removes private links, public-channel handles and customer contact data from output", async () => {
    const store = actorStore(["DarkPower"]);
    const result = groupResult("DarkPower", "DarkPower demanded $10,000 ransoms. Contact @ops_channel or +47 1234 5678 at https://t.me/ops_channel.", {
      url: "http://127.0.0.1/admin?token=secret",
      sensitive: false,
    });
    store.savePipelineResult(result);
    confirmBusinessClaims(store, result.capture.id);

    const serialized = JSON.stringify(await searchResult(store, "DarkPower"));
    expect(serialized).not.toContain("127.0.0.1");
    expect(serialized).not.toContain("ops_channel");
    expect(serialized).not.toContain("+47 1234 5678");
    expect(serialized).toContain("Contact handle or phone");
  });

  test("backfills retained metadata without multiplying lineage", () => {
    const store = actorStore(["BrainCipher"]);
    store.saveSource(retainedGroupSource);
    const result = groupResult("BrainCipher", brainCipher);
    const retainedCapture = { ...result.capture, sourceId: retainedGroupSource.id, provenance: { ...result.capture.provenance, sourceId: retainedGroupSource.id } };
    const oldEntities = result.entities.filter((entity: any) => !["pricing_claim", "payment_claim", "negotiation_claim"].includes(entity.type));
    store.savePipelineResult({ capture: retainedCapture, entities: oldEntities, indicators: [] });
    expect(actorBusinessLineageCounts(store, new Set([retainedCapture.id]))).toEqual({ entities: 0, claims: 0, claimEvidence: 0 });
    const entities = actorBusinessEntitiesFromRetainedCapture(retainedCapture);
    store.savePipelineResult({ capture: retainedCapture, entities, indicators: [] });
    const counts = actorBusinessLineageCounts(store, new Set([retainedCapture.id]));
    store.savePipelineResult({ capture: retainedCapture, entities: actorBusinessEntitiesFromRetainedCapture(retainedCapture), indicators: [] });
    expect(actorBusinessLineageCounts(store, new Set([retainedCapture.id]))).toEqual(counts);
  });

  test("backfills one retained public report with the same exact evidence boundary", () => {
    const identities = [identity("Everest", [])];
    const store = actorStore(["Everest"]);
    store.saveSource(publicReportSource);
    const result = publicReportResult("Everest ransomware demanded approximately $8 million from the victim.", identities);
    const retainedCapture = { ...result.capture, publishedAt: new Date(feedPublishedAt).toISOString() };
    store.savePipelineResult({ capture: retainedCapture, entities: result.entities.filter((entity: any) => entity.extractionMethod === "deterministic_fallback"), indicators: [] });
    expect(actorBusinessLineageCounts(store, new Set([retainedCapture.id]))).toEqual({ entities: 0, claims: 0, claimEvidence: 0 });

    const entities = actorBusinessEntitiesFromRetainedCapture(retainedCapture, identities);
    store.savePipelineResult({ capture: retainedCapture, entities, indicators: [] });
    expect(entities).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "actor", value: "Everest", extractionMethod: "source_specific" }),
      expect.objectContaining({ type: "pricing_claim", value: "$8 million", extractionMethod: "source_specific" }),
    ]));
    expect(actorBusinessLineageCounts(store, new Set([retainedCapture.id]))).toEqual({ entities: 1, claims: 1, claimEvidence: 1 });
  });
});

function groupResult(actorName: string, description: string, options: {
  tenantId?: string
  inputSource?: any
  publishedAt?: string
  url?: string
  sensitive?: boolean
} = {}) {
  const inputSource = options.inputSource ?? catalogSource;
  const rawText = `${inputSource.name}\n${actorName}\n${description}`;
  return processCollectedItem({
    tenantId: options.tenantId === undefined && !Object.prototype.hasOwnProperty.call(options, "tenantId") ? "default" : options.tenantId,
    sourceId: inputSource.id,
    url: options.url ?? `${inputSource.url}#${encodeURIComponent(actorName)}-${hashContent(description).slice(0, 8)}`,
    title: `${inputSource.name}: ${actorName}`,
    rawText,
    body: rawText,
    collectedAt,
    publishedAt: options.publishedAt,
    contentHash: hashContent(rawText),
    links: [inputSource.url],
    metadata: {
      extractionProfile: "ransomware_group_metadata",
      ransomwareGroup: { actorName, description, metadataOnly: options.sensitive !== false, locatorsRetained: false },
    },
    sensitive: options.sensitive !== false,
  } as any);
}

function publicReportResult(rawText: string, actorIdentities: any[], options: { publishedAt?: string; url?: string } = {}) {
  const reportPublishedAt = options.publishedAt === undefined && !Object.prototype.hasOwnProperty.call(options, "publishedAt") ? feedPublishedAt : options.publishedAt;
  const url = options.url ?? `https://news.example.test/reports/${hashContent(rawText).slice(0, 8)}`;
  const published = reportPublishedAt ? `<pubDate>${reportPublishedAt}</pubDate>` : "";
  const [item] = feedItems(publicReportSource, { id: "task_public_report", targetUrl: publicReportSource.url }, `<rss><channel><item><title>Independent ransomware report</title><link>${url}</link>${published}<description>${rawText}</description></item></channel></rss>`, collectedAt, {});
  return processCollectedItem({ ...item, tenantId: "default" }, { actorIdentities });
}

function actorStore(names: string[], associatedNames: Record<string, string[]> = {}) {
  const store = new InMemoryScraperStore();
  store.saveSource(catalogSource);
  seedActorCatalog(store, names.map((name) => identity(name, associatedNames[name] ?? [])));
  return store;
}

function identity(name: string, associatedNames: string[]): ActorIdentityRecord {
  return {
    id: `test-actors:${name}`,
    catalogId: "test-actors",
    externalId: name,
    canonicalName: name,
    normalizedCanonicalName: name.toLowerCase(),
    associatedNames,
    status: "current",
    aptNumberDesignationPresent: /^APT\d+$/i.test(name),
    sourceUrl: "https://catalog.example.test/actors",
    catalogVersion: "1",
    catalogModifiedAt: collectedAt,
    createdAt: collectedAt,
    modifiedAt: collectedAt,
    bundleSha256: "a".repeat(64),
    retrievedAt: collectedAt,
  };
}

function seedActorCatalog(store: InMemoryScraperStore, identities: any[]) {
  store.replaceActorIdentityCatalog({
    schemaVersion: "ti.actor_identity_catalog.v1",
    catalogId: "test-actors",
    catalogName: "Test actors",
    catalogVersion: "1",
    catalogModifiedAt: collectedAt,
    sourceUrl: "https://catalog.example.test/actors",
    bundleId: "bundle--test",
    bundleSha256: "a".repeat(64),
    retrievedAt: collectedAt,
    counts: {
      totalIdentityCount: identities.length,
      currentIdentityCount: identities.length,
      deprecatedIdentityCount: 0,
      revokedIdentityCount: 0,
      aptNumberDesignationPresentCount: identities.filter((item) => item.aptNumberDesignationPresent).length,
      associatedNameOccurrenceCount: identities.reduce((count, item) => count + item.associatedNames.length, 0),
      distinctAssociatedNameCount: new Set(identities.flatMap((item) => item.associatedNames)).size,
      distinctLookupLabelCount: new Set(identities.flatMap((item) => [item.canonicalName, ...item.associatedNames])).size,
      aliasCollisionCount: 0,
    },
    identities,
    aliasCollisions: [],
  } as any, { sourceId: catalogSource.id, captureId: "cap_actor_catalog", importedAt: collectedAt });
}

function profile(id: string, alias: string, actorIdentityId: string) {
  return {
    id,
    canonicalName: alias,
    normalizedName: alias.toLowerCase(),
    aliases: [alias],
    actorIdentityIds: [actorIdentityId],
    identityResolutionState: "canonical",
    actorType: "ransomware",
    confidence: 1,
    sourceIds: [catalogSource.id],
    captureIds: ["cap_governed"],
    evidenceCount: 1,
    updatedAt: collectedAt,
  };
}

function businessClaimsForCapture(store: InMemoryScraperStore, captureId: string) {
  const claimIds = new Set(store.listClaimEvidence().filter((row: any) => row.captureId === captureId && row.subjectType === "entity").map((row: any) => row.claimId));
  return store.listIntelligenceClaims().filter((claim: any) => claimIds.has(claim.id) && ["pricing_claim", "payment_claim", "negotiation_claim"].includes(claim.claimType));
}

function confirmBusinessClaims(store: InMemoryScraperStore, captureId: string) {
  for (const claim of businessClaimsForCapture(store, captureId)) review(store, claim, "confirm");
}

function review(store: InMemoryScraperStore, claim: any, action: string, changes: Record<string, unknown> = {}) {
  if (!claim) throw new Error("Expected business claim");
  const reviewedAt = String(changes.reviewedAt ?? "2026-07-20T16:00:00.000Z");
  return store.saveClaimReview({
    id: `review_${claim.id}_${action}_${reviewedAt}`,
    tenantId: claim.tenantId,
    claimId: claim.id,
    action,
    reviewerId: "analyst",
    reason: "Reviewed against the exact retained evidence.",
    reviewedAt,
    ...changes,
  });
}

async function searchResult(store: InMemoryScraperStore, actor: string, tenantId = "default") {
  const response = await handleApiRequest(new Request(`http://local/v1/intel/search?tenantId=${encodeURIComponent(tenantId)}&q=${encodeURIComponent(actor)}&entityType=actor`), { store, frontier: new FocusedFrontier(), port: 0 } as any);
  expect(response.status).toBe(200);
  return response.json() as any;
}
