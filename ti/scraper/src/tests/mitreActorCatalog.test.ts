import { describe, expect, test } from "bun:test";
import { parseMitreActorCatalog, reconcileActorIdentityCoverage, resolveMitreActorIdentity } from "../pipeline/mitreActorCatalog.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { createLiveSearchPlan } from "../planner/intelligencePlanner.ts";
import { hashContent } from "../utils.ts";
import { source } from "./helpers/plannerFixtures.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";

// Exact identity fields from MITRE Enterprise ATT&CK v19.1, not product seed data.
const officialV191Excerpt = JSON.stringify({
  type: "bundle",
  id: "bundle--64af0946-bfeb-481d-96df-a38e2709e3db",
  objects: [
    { type: "x-mitre-collection", name: "Enterprise ATT&CK", modified: "2026-05-12T14:00:00.188Z", x_mitre_version: "19.1" },
    group("intrusion-set--3753cc21-2dae-4dfb-8481-d004e74502cc", "G0046", "FIN7", ["FIN7", "GOLD NIAGARA", "ITG14", "Carbon Spider", "ELBRUS", "Sangria Tempest"], "2017-05-31T21:32:09.460Z", "2026-05-12T15:12:00.732Z"),
    group("intrusion-set--c0291346-defe-48d7-9542-9e074ba1bdfb", "G1044", "APT42", ["APT42"], "2025-01-08T17:08:26.378Z", "2026-05-12T15:12:00.732Z"),
    group("intrusion-set--f9d6633a-55e6-4adc-9263-6ae080421a13", "G0059", "Magic Hound", ["Magic Hound", "TA453", "COBALT ILLUSION", "Charming Kitten", "ITG18", "Phosphorus", "Newscaster", "APT35", "Mint Sandstorm"], "2018-01-16T16:13:52.465Z", "2026-05-12T15:12:00.732Z"),
    group("intrusion-set--88b7dbc2-32d3-4e31-af2f-3fc24e1582d7", "G0030", "Lotus Blossom", ["Lotus Blossom", "DRAGONFISH", "Spring Dragon", "RADIUM", "Raspberry Typhoon", "Bilbug", "Thrip"], "2017-05-31T21:32:01.092Z", "2025-04-23T21:20:58.367Z"),
    group("intrusion-set--55033a4d-3ffe-46b2-99b4-2c1541e9ce1c", "G0008", "Carbanak", ["Carbanak", "Anunak"], "2017-05-31T21:31:49.021Z", "2025-04-25T14:49:30.378Z"),
    group("intrusion-set--d69e568e-9ac8-4c08-b32c-d93b43ba9172", "G0076", "Thrip", ["Thrip"], "2018-10-17T00:14:20.652Z", "2025-04-25T14:49:36.307Z")
  ]
});

describe("MITRE actor identity catalog", () => {
  test("keeps authoritative identities separate and preserves ambiguous associated names", () => {
    expect(() => parseMitreActorCatalog(officialV191Excerpt, { retrievedAt: "2026-07-21T00:00:00.000Z" })).toThrow("expected at least 100");
    const catalog = parseMitreActorCatalog(officialV191Excerpt, { retrievedAt: "2026-07-21T00:00:00.000Z", minimumCurrentIdentities: 6 });

    expect(ids(resolveMitreActorIdentity("APT42", catalog.identities))).toEqual(["G1044"]);
    expect(ids(resolveMitreActorIdentity("Charming Kitten", catalog.identities))).toEqual(["G0059"]);
    expect(ids(resolveMitreActorIdentity("FIN7", catalog.identities))).toEqual(["G0046"]);
    expect(ids(resolveMitreActorIdentity("Carbanak", catalog.identities))).toEqual(["G0008"]);
    expect(resolveMitreActorIdentity("Thrip", catalog.identities)).toMatchObject({ ambiguous: true });
    expect(ids(resolveMitreActorIdentity("Thrip", catalog.identities))).toEqual(["G0030", "G0076"]);
    expect(resolveMitreActorIdentity("not a registered group", catalog.identities).candidates).toEqual([]);
  });

  test("registers and serves catalog identities without fabricating activity profiles", async () => {
    const catalog = parseMitreActorCatalog(officialV191Excerpt, { retrievedAt: "2026-07-21T00:00:00.000Z", minimumCurrentIdentities: 6 });
    const store = new InMemoryScraperStore();
    const report = store.replaceActorIdentityCatalog(catalog, { sourceId: "src_mitre_enterprise_stix", captureId: "cap_mitre_enterprise_v19_1" });

    expect(report).toMatchObject({ currentIdentityCount: 6, retainedHistoricalIdentityCount: 0 });
    expect(store.listActorIdentities()).toHaveLength(6);
    expect(store.listActorProfiles()).toHaveLength(0);
    expect(store.listActorIdentityCatalogs()[0]).not.toHaveProperty("identities");
    const coverageResponse = await handleApiRequest(new Request("http://localhost/v1/intel/actor-identity-coverage"), { store, frontier: new FocusedFrontier() } as any);
    expect(await coverageResponse.json()).toMatchObject({ catalogCoverage: { canonicalIdentityCount: 6, mitreCurrentIdentityCount: 6, ransomwareCurrentOperationCount: 0 }, activityCoverage: { actorProfileCount: 0, evidenceBackedProfileCount: 0, recentActivityProfileCount: 0 } });
    const response = await handleApiRequest(new Request("http://localhost/v1/intel/actor-identities?q=charming%20kitten&limit=10"), { store, frontier: new FocusedFrontier() } as any);
    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ total: 1, actorIdentities: [{ externalId: "G0059", canonicalName: "Magic Hound", status: "current" }] });
    const tenantResponse = await handleApiRequest(new Request("http://localhost/v1/intel/actor-identities?q=charming%20kitten&limit=10", { headers: { "x-tenant-id": "tenant_customer" } }), { store, frontier: new FocusedFrontier() } as any);
    expect(await tenantResponse.json()).toMatchObject({ total: 1, actorIdentities: [{ externalId: "G0059" }] });

    const searchResponse = await handleApiRequest(new Request("http://localhost/v1/intel/search?q=charming%20kitten"), { store, frontier: new FocusedFrontier() } as any);
    const search = await searchResponse.json() as any;
    expect(search).toMatchObject({
      status: "partial",
      actorIdentity: { catalogMatched: true, ambiguous: false, activityEvidenceAvailable: false, candidates: [{ externalId: "G0059", canonicalName: "Magic Hound", matchKinds: ["associated"] }] },
      recentActivity: []
    });
    expect(search.actorProfile.actor).toBeUndefined();
    expect(search.lastSeen).toBeUndefined();

    const collisionResponse = await handleApiRequest(new Request("http://localhost/v1/intel/search?q=thrip"), { store, frontier: new FocusedFrontier() } as any);
    const collision = await collisionResponse.json() as any;
    expect(collision.actorIdentity).toMatchObject({ catalogMatched: true, ambiguous: true });
    expect(collision.actorIdentity.candidates.map((candidate: any) => candidate.externalId)).toEqual(["G0030", "G0076"]);
    expect(collision.actorProfile.actor).toBeUndefined();
  });

  test("uses canonical catalog identities without conflating associated designations", async () => {
    const catalog = parseMitreActorCatalog(officialV191Excerpt, { retrievedAt: "2026-07-21T00:00:00.000Z", minimumCurrentIdentities: 6 });
    const context = (rawText: string) => processCollectedItem({ sourceId: "src_real_report", url: "https://example.test/report", collectedAt: "2026-07-21T00:00:00.000Z", rawText, contentHash: hashContent(rawText), links: [], metadata: {}, sensitive: false }, { actorIdentities: catalog.identities });

    expect(context("Magic Hound was named in the report.").entities).toContainEqual(expect.objectContaining({ type: "actor", value: "Magic Hound" }));
    expect(context("Charming Kitten was named in the report.").entities).toContainEqual(expect.objectContaining({ type: "actor", value: "Charming Kitten", actorIdentityIds: ["mitre-attack-enterprise:G0059"] }));
    expect(context("Thrip was named in the report.").entities).toContainEqual(expect.objectContaining({ type: "actor", value: "Thrip", actorIdentityIds: ["mitre-attack-enterprise:G0030", "mitre-attack-enterprise:G0076"] }));
    const activityStore = new InMemoryScraperStore();
    activityStore.savePipelineResult(context("Charming Kitten was named in the report."));
    expect(activityStore.listActorProfiles()).toContainEqual(expect.objectContaining({ canonicalName: "Charming Kitten", actorIdentityIds: ["mitre-attack-enterprise:G0059"], evidenceCount: 1 }));

    const structured = processCollectedItem({
      sourceId: "src_real_claim_feed", url: "https://example.test/claim", collectedAt: "2026-07-21T00:00:00.000Z",
      rawText: "Charming Kitten claimed Example Systems.", contentHash: hashContent("structured-claim"), links: [], sensitive: false,
      metadata: { extractionProfile: "ransomware_victim_blog", leakSite: { actorName: "Charming Kitten", victimName: "Example Systems" } }
    }, { actorIdentities: catalog.identities });
    expect(structured.entities).toContainEqual(expect.objectContaining({ type: "ransomware_family", value: "Charming Kitten", actorIdentityIds: ["mitre-attack-enterprise:G0059"] }));

    const plan = createLiveSearchPlan({ request: { query: "Charming Kitten", entityType: "actor", createdAt: "2026-07-21T00:00:00.000Z" }, actorIdentities: catalog.identities, sources: [source({ id: "src_actor_reports", type: "rss" })] });
    expect(plan.dto.queryTerms).toEqual(["Charming Kitten"]);

    const beforeRefresh = processCollectedItem({ sourceId: "src_before_catalog", url: "https://example.test/before", collectedAt: "2026-07-21T00:00:00.000Z", rawText: "APT29 was named.", contentHash: hashContent("before-catalog"), links: [], metadata: {}, sensitive: false }, { actorIdentities: [] });
    expect(beforeRefresh.entities.some((entity: any) => entity.type === "actor")).toBe(false);
    const beforeRefreshStore = new InMemoryScraperStore();
    beforeRefreshStore.saveSource({ id: "src_catalog_pending", name: "Catalog pending first fetch", type: "json_api", url: "https://example.test/catalog.json", accessMethod: "public_http", status: "active", risk: "low", trustScore: 0.9, crawlFrequencySeconds: 3600, legalNotes: "Authoritative public catalog.", metadata: { extractionProfile: "mitre_actor_catalog", productionCollection: true } } as any);
    const beforeRefreshResponse = await handleApiRequest(new Request("http://localhost/v1/intel/search?q=apt29"), { store: beforeRefreshStore, frontier: new FocusedFrontier() } as any);
    expect(await beforeRefreshResponse.json()).toMatchObject({ status: "searching", actorIdentity: { catalogMatched: false, candidates: [] } });
  });

  test("merges only exact canonical names across catalogs", () => {
    const catalog = parseMitreActorCatalog(officialV191Excerpt, { retrievedAt: "2026-07-21T00:00:00.000Z", minimumCurrentIdentities: 6 });
    const supplemental = (canonicalName: string, externalId: string) => ({ ...catalog.identities[0], id: `actor_${externalId}`, catalogId: "ransomware-live-current-operations", externalId, canonicalName, normalizedCanonicalName: canonicalName.toLowerCase(), associatedNames: [] });
    const coverage = reconcileActorIdentityCoverage([...catalog.identities, supplemental("Magic Hound", "magic-hound"), supplemental("Charming Kitten", "charming-kitten")]);

    expect(coverage.currentCatalogRecordCount).toBe(8);
    expect(coverage.canonicalIdentityCount).toBe(7);
    expect(coverage.crossCatalogMergedIdentityCount).toBe(1);
  });
});

function group(id: string, externalId: string, name: string, aliases: string[], created: string, modified: string) {
  return {
    type: "intrusion-set",
    id,
    name,
    aliases,
    created,
    modified,
    revoked: false,
    x_mitre_deprecated: false,
    x_mitre_domains: ["enterprise-attack"],
    external_references: [{ source_name: "mitre-attack", url: `https://attack.mitre.org/groups/${externalId}`, external_id: externalId }]
  };
}

function ids(resolution: ReturnType<typeof resolveMitreActorIdentity>) {
  return resolution.candidates.map((candidate) => candidate.identity.externalId);
}
