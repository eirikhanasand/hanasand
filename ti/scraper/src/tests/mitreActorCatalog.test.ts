import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMitreActorCatalog, reconcileActorIdentityCoverage, resolveMitreActorIdentity } from "../pipeline/mitreActorCatalog.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { createLiveSearchPlan } from "../planner/intelligencePlanner.ts";
import { hashContent } from "../utils.ts";
import { source } from "./helpers/plannerFixtures.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
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
    expect(() => parseMitreActorCatalog(officialV191Excerpt, { retrievedAt: "2026-07-21T00:00:00.000Z" })).toThrow("does not match its authoritative manifest");
    const catalog = parseMitreActorCatalog(officialV191Excerpt, { retrievedAt: "2026-07-21T00:00:00.000Z", minimumCurrentIdentities: 6 });

    expect(ids(resolveMitreActorIdentity("APT42", catalog.identities))).toEqual(["G1044"]);
    expect(ids(resolveMitreActorIdentity("Charming Kitten", catalog.identities))).toEqual(["G0059"]);
    expect(ids(resolveMitreActorIdentity("FIN7", catalog.identities))).toEqual(["G0046"]);
    expect(ids(resolveMitreActorIdentity("Carbanak", catalog.identities))).toEqual(["G0008"]);
    expect(resolveMitreActorIdentity("Thrip", catalog.identities)).toMatchObject({ ambiguous: true });
    expect(ids(resolveMitreActorIdentity("Thrip", catalog.identities))).toEqual(["G0030", "G0076"]);
    expect(resolveMitreActorIdentity("not a registered group", catalog.identities).candidates).toEqual([]);

    const manifestStore = new InMemoryScraperStore();
    const accepted = { ...catalog, authoritativeManifestValidated: true as const };
    manifestStore.replaceActorIdentityCatalog(accepted, { sourceId: "src_mitre", captureId: "cap_mitre_v1" });
    expect(() => manifestStore.replaceActorIdentityCatalog({
      ...accepted,
      identities: accepted.identities.slice(0, -1),
      counts: {
        ...accepted.counts,
        totalIdentityCount: accepted.identities.length - 1,
        currentIdentityCount: accepted.counts.currentIdentityCount - 1
      }
    }, { sourceId: "src_mitre", captureId: "cap_mitre_v2" })).toThrow("omitted 1 identities");
  });

  test("counts all current MITRE APT designation forms and keeps generic labels structured-only", () => {
    const catalog = parseMitreActorCatalog(JSON.stringify({
      type: "bundle",
      id: "bundle--3036ce41-acde-4e7e-acde-30f0281775cb",
      objects: [
        { type: "x-mitre-collection", name: "Enterprise ATT&CK", modified: "2026-05-12T14:00:00.188Z", x_mitre_version: "19.1" },
        group("intrusion-set--b8b24a3b-a8d2-4a52-9a66-c5c9a2c7b6de", "G0099", "APT-C-36", ["APT-C-36", "APT-Q-98"], "2020-01-01T00:00:00.000Z", "2026-05-12T15:12:00.732Z"),
        group("intrusion-set--7a219c7f-4a6f-43e0-83b2-115b9af0aef1", "G0095", "Machete", ["Machete", "APT-C-43"], "2020-01-01T00:00:00.000Z", "2026-05-12T15:12:00.732Z"),
        group("intrusion-set--a7f94322-9037-4d4e-a597-1e0a8a3e59a4", "G1028", "APT-C-23", ["APT-C-23"], "2020-01-01T00:00:00.000Z", "2026-05-12T15:12:00.732Z"),
        group("intrusion-set--9b0702e0-e4fb-4f02-a4e0-02a05b458f0a", "G9999", "Play", ["Play"], "2020-01-01T00:00:00.000Z", "2026-05-12T15:12:00.732Z")
      ]
    }), { retrievedAt: "2026-07-21T00:00:00.000Z", minimumCurrentIdentities: 4 });

    expect(catalog.counts.aptNumberDesignationPresentCount).toBe(3);
    expect(catalog.identities.filter((identity) => identity.aptNumberDesignationPresent).map((identity) => identity.externalId)).toEqual(["G0095", "G0099", "G1028"]);
    expect(resolveMitreActorIdentity("play", catalog.identities).candidates).toEqual([]);
    expect(resolveMitreActorIdentity("play", catalog.identities, { allowStructuredOnly: true }).candidates).toEqual([
      expect.objectContaining({ identity: expect.objectContaining({ externalId: "G9999", canonicalName: "Play" }) })
    ]);
  });

  test("resolves authoritative renames while retaining unresolved retired identities as history", () => {
    const old = {
      ...group("intrusion-set--92d5b3fd-3b39-438e-af68-770e447beada", "G0118", "Charming Kitten", ["Charming Kitten"], "2024-01-01T00:00:00.000Z", "2026-05-12T15:12:00.732Z"),
      revoked: true
    };
    const current = group("intrusion-set--f9d6633a-55e6-4adc-9263-6ae080421a13", "G0059", "Magic Hound", ["Magic Hound", "Charming Kitten"], "2018-01-16T16:13:52.465Z", "2026-05-12T15:12:00.732Z");
    const catalog = parseMitreActorCatalog(JSON.stringify({
      type: "bundle",
      id: "bundle--8c1792e7-6d7a-47ec-b665-e2234631edc8",
      objects: [
        { type: "x-mitre-collection", name: "Enterprise ATT&CK", modified: "2026-05-12T14:00:00.188Z", x_mitre_version: "19.1" },
        old,
        current,
        { type: "relationship", id: "relationship--f9f98126-0b17-4ac1-8e16-7f7cc257b3c5", relationship_type: "revoked-by", source_ref: old.id, target_ref: current.id }
      ]
    }), { retrievedAt: "2026-07-21T00:00:00.000Z", minimumCurrentIdentities: 1 });

    expect(catalog.identities.find((identity) => identity.externalId === "G0118")).toMatchObject({ status: "revoked", revokedByExternalId: "G0059" });
    expect(resolveMitreActorIdentity("Charming Kitten", catalog.identities)).toMatchObject({
      ambiguous: false,
      candidates: [{
        identity: { externalId: "G0059", canonicalName: "Magic Hound", status: "current" },
        matchedIdentityIds: ["mitre-attack-enterprise:G0059", "mitre-attack-enterprise:G0118"],
        resolutionKinds: ["direct", "revoked_by"]
      }]
    });

    const beforeRename = parseMitreActorCatalog(JSON.stringify({
      type: "bundle",
      id: "bundle--922dc4c9-967a-4eb4-b5c8-8da8f9605974",
      objects: [
        { type: "x-mitre-collection", name: "Enterprise ATT&CK", modified: "2026-01-01T00:00:00.000Z", x_mitre_version: "19.1" },
        { ...old, revoked: false }
      ]
    }), { retrievedAt: "2026-01-02T00:00:00.000Z", minimumCurrentIdentities: 1 });
    const directory = mkdtempSync(join(tmpdir(), "actor-profile-rename-"));
    try {
      const snapshotPath = join(directory, "store.json");
      const renamedStore = new FileBackedScraperStore({ snapshotPath });
      renamedStore.replaceActorIdentityCatalog(beforeRename, { sourceId: "src_mitre", captureId: "cap_mitre_before" });
      const observation = processCollectedItem({
        sourceId: "src_report", url: "https://publisher.example/rename", collectedAt: "2026-01-03T00:00:00.000Z",
        rawText: "Charming Kitten claimed Example Systems.", contentHash: hashContent("rename-observation"), links: [], sensitive: false,
        metadata: { extractionProfile: "ransomware_victim_blog", leakSite: { actorName: "Charming Kitten", victimName: "Example Systems" } }
      }, { actorIdentities: renamedStore.listActorIdentities() });
      renamedStore.savePipelineResult(observation);
      const originalProfile = renamedStore.listActorProfiles()[0];
      const refresh = renamedStore.replaceActorIdentityCatalog(catalog, { sourceId: "src_mitre", captureId: "cap_mitre_after" });
      expect(refresh).toMatchObject({ archivedActorProfileIds: [], reboundActorProfileIds: [originalProfile.id] });
      expect(renamedStore.listActorProfiles()).toEqual([
        expect.objectContaining({
          id: originalProfile.id,
          canonicalName: "Magic Hound",
          actorIdentityIds: ["mitre-attack-enterprise:G0059"],
          captureIds: originalProfile.captureIds,
          identityResolutionState: "canonical"
        })
      ]);

      const restarted = new FileBackedScraperStore({ snapshotPath });
      expect(restarted.listActorProfiles()).toEqual([
        expect.objectContaining({
          id: originalProfile.id,
          canonicalName: "Magic Hound",
          actorIdentityIds: ["mitre-attack-enterprise:G0059"],
          captureIds: originalProfile.captureIds
        })
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }

    const retired = { ...catalog.identities.find((identity) => identity.externalId === "G0118")!, status: "retired" as const, revokedByExternalId: undefined };
    expect(resolveMitreActorIdentity("Charming Kitten", [retired]).candidates).toEqual([
      expect.objectContaining({ identity: expect.objectContaining({ externalId: "G0118", status: "retired" }), resolutionKinds: ["direct"] })
    ]);
    const store = new InMemoryScraperStore();
    store.replaceActorIdentityCatalog({ ...catalog, identities: [retired], counts: { ...catalog.counts, totalIdentityCount: 1, currentIdentityCount: 0, revokedIdentityCount: 0 } }, { sourceId: "src_actor_catalog", captureId: "cap_actor_catalog" });
    const observed = processCollectedItem({
      sourceId: "src_report", url: "https://publisher.example/retired", collectedAt: "2026-07-21T00:00:00.000Z",
      rawText: "Structured attribution.", contentHash: hashContent("retired"), links: [], sensitive: false,
      metadata: { extractionProfile: "ransomware_group_metadata", ransomwareGroup: { actorName: "Charming Kitten" } }
    }, { actorIdentities: [retired] });
    store.savePipelineResult(observed);
    expect(store.listActorProfiles()).toEqual([]);
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

  test("binds global catalog activity to its retained evidence captures in tenant coverage", async () => {
    const mitre = parseMitreActorCatalog(officialV191Excerpt, { retrievedAt: "2026-07-21T00:00:00.000Z", minimumCurrentIdentities: 6 });
    const capture = (id: string, contentHash: string, tenantId?: string) => ({
      id, tenantId, sourceId: "src_catalog_evidence", url: `https://example.test/${id}`, collectedAt: "2026-07-21T00:00:00.000Z",
      mediaType: "application/json", storageKind: "metadata_only", contentHash, sensitive: false, metadata: {}
    } as any);
    const store = new InMemoryScraperStore();
    store.saveCapture(capture("cap_catalog", "catalog-hash"));
    store.saveCapture(capture("cap_bound_global", "bound-evidence-hash"));
    store.saveCapture(capture("cap_unbound_global", "unbound-evidence-hash"));
    store.saveCapture(capture("cap_tenant_duplicate", "unbound-evidence-hash", "tenant_customer"));
    const identity = (id: string, contentHash: string) => ({
      ...mitre.identities[0],
      id: `ransomware-live-current-operations:${id}`,
      catalogId: "ransomware-live-current-operations",
      externalId: `ransomwarelive:${id}`,
      canonicalName: id,
      normalizedCanonicalName: id,
      associatedNames: [],
      activityEvidence: [{ kind: "recent_public_claim", observedAt: "2026-07-21T00:00:00.000Z", count: 1, contentHash }]
    });
    store.replaceActorIdentityCatalog({
      ...mitre,
      catalogId: "ransomware-live-current-operations",
      catalogName: "Ransomware.live community group catalog",
      evidenceCaptureIds: ["cap_bound_global"],
      identities: [identity("bound", "bound-evidence-hash"), identity("unbound", "unbound-evidence-hash")],
      counts: { ...mitre.counts, totalIdentityCount: 2, currentIdentityCount: 2 }
    } as any, { sourceId: "src_catalog_evidence", captureId: "cap_catalog" });

    const response = await handleApiRequest(new Request("http://localhost/v1/intel/actor-identity-coverage", {
      headers: { "x-tenant-id": "tenant_customer" }
    }), { store, frontier: new FocusedFrontier() } as any);
    expect(await response.json()).toMatchObject({
      catalogCoverage: { ransomwareCurrentOperationCount: 2 },
      activityCoverage: { catalogActivityIdentityCount: 1, recentCatalogActivityIdentityCount: 1 }
    });
  });

  test("uses canonical catalog identities without conflating associated designations", async () => {
    const catalog = parseMitreActorCatalog(officialV191Excerpt, { retrievedAt: "2026-07-21T00:00:00.000Z", minimumCurrentIdentities: 6 });
    const context = (rawText: string) => processCollectedItem({ sourceId: "src_real_report", url: "https://example.test/report", collectedAt: "2026-07-21T00:00:00.000Z", rawText, contentHash: hashContent(rawText), links: [], metadata: {}, sensitive: false }, { actorIdentities: catalog.identities });

    expect(context("Magic Hound was named in the report.").entities).toContainEqual(expect.objectContaining({ type: "actor", value: "Magic Hound" }));
    expect(context("Charming Kitten was named in the report.").entities).toContainEqual(expect.objectContaining({ type: "actor", value: "Charming Kitten", actorIdentityIds: ["mitre-attack-enterprise:G0059"] }));
    expect(context("Thrip was named in the report.").entities).toContainEqual(expect.objectContaining({ type: "actor", value: "Thrip", actorIdentityIds: ["mitre-attack-enterprise:G0030", "mitre-attack-enterprise:G0076"] }));
    const activityStore = new InMemoryScraperStore();
    activityStore.savePipelineResult(context("Charming Kitten was named in the report."));
    expect(activityStore.listActorProfiles()).toEqual([]);

    activityStore.replaceActorIdentityCatalog(catalog, { sourceId: "src_mitre_enterprise_stix", captureId: "cap_mitre_enterprise_v19_1" });
    const genericMention = context("Magic Hound was named in a second report.");
    const negatedMention = context("There is no evidence that Charming Kitten was involved.");
    const mentionStore = new InMemoryScraperStore();
    mentionStore.replaceActorIdentityCatalog(catalog, { sourceId: "src_mitre_enterprise_stix", captureId: "cap_mitre_enterprise_v19_1" });
    mentionStore.savePipelineResult(genericMention);
    mentionStore.savePipelineResult({ ...negatedMention, capture: { ...negatedMention.capture, tenantId: "default" } });
    expect(mentionStore.listActorProfiles()).toEqual([]);
    expect(mentionStore.listExtractedEntities().filter((entity: any) => entity.type === "actor")).toHaveLength(2);
    expect(mentionStore.listEvidenceLinks().filter((link: any) => link.subjectType === "entity" && link.relationship === "mentions")).toHaveLength(2);

    const governed = (sourceId: string, tenantId?: string) => {
      const result = processCollectedItem({
        sourceId,
        url: `https://example.test/${sourceId}`,
        collectedAt: "2026-07-21T00:00:00.000Z",
        rawText: "Charming Kitten claimed Example Systems.",
        contentHash: hashContent(sourceId),
        links: [],
        sensitive: false,
        metadata: { extractionProfile: "ransomware_victim_blog", leakSite: { actorName: "Charming Kitten", victimName: "Example Systems" } }
      }, { actorIdentities: catalog.identities });
      return tenantId ? { ...result, capture: { ...result.capture, tenantId } } : result;
    };
    activityStore.savePipelineResult(governed("src_governed_global"));
    activityStore.savePipelineResult(governed("src_governed_default", "default"));
    expect(activityStore.listActorProfiles()).toEqual([
      expect.objectContaining({ tenantId: undefined, canonicalName: "Magic Hound", normalizedName: "magic hound", actorIdentityIds: ["mitre-attack-enterprise:G0059"], evidenceCount: 2 })
    ]);

    activityStore.savePipelineResult(governed("src_governed_customer", "tenant_customer"));
    expect(activityStore.listActorProfiles()).toHaveLength(2);
    expect(activityStore.listActorProfiles()).toContainEqual(expect.objectContaining({ tenantId: "tenant_customer", canonicalName: "Magic Hound", evidenceCount: 1 }));

    const ambiguousStore = new InMemoryScraperStore();
    ambiguousStore.replaceActorIdentityCatalog(catalog, { sourceId: "src_mitre_enterprise_stix", captureId: "cap_mitre_enterprise_v19_1" });
    ambiguousStore.savePipelineResult(context("Thrip was named in the report."));
    expect(ambiguousStore.listActorProfiles()).toEqual([]);

    const revokedCatalog = { ...catalog, identities: catalog.identities.map((identity) => identity.externalId === "G0046" ? { ...identity, status: "revoked" as const } : identity) };
    const revokedStore = new InMemoryScraperStore();
    revokedStore.replaceActorIdentityCatalog(revokedCatalog, { sourceId: "src_mitre_enterprise_stix", captureId: "cap_mitre_enterprise_v19_1" });
    revokedStore.savePipelineResult(context("FIN7 was named in the report."));
    expect(revokedStore.listActorProfiles()).toEqual([]);

    const unresolvedStore = new InMemoryScraperStore();
    const unresolved = context("Magic Hound was named in an unresolved report.");
    unresolvedStore.savePipelineResult({
      ...unresolved,
      entities: unresolved.entities.map((entity: any) => entity.type === "actor"
        ? { ...entity, value: "Unregistered Group", normalizedValue: "unregistered group", actorIdentityIds: [] }
        : entity)
    });
    expect(unresolvedStore.listActorProfiles()).toEqual([]);
    expect(unresolvedStore.listExtractedEntities()).toContainEqual(expect.objectContaining({ type: "actor", value: "Unregistered Group" }));
    expect(unresolvedStore.listEvidenceLinks()).toContainEqual(expect.objectContaining({ subjectType: "entity", relationship: "mentions" }));

    const unknownExplicitStore = new InMemoryScraperStore();
    unknownExplicitStore.savePipelineResult({
      ...unresolved,
      entities: unresolved.entities.map((entity: any) => entity.type === "actor"
        ? { ...entity, value: "Catalog Pending Group", normalizedValue: "catalog pending group", actorIdentityIds: ["future-catalog:pending"] }
        : entity)
    });
    expect(unknownExplicitStore.listActorProfiles()).toEqual([]);

    const archivedStore = new InMemoryScraperStore();
    archivedStore.saveActorProfile({
      id: "actor_legacy_charming_kitten", canonicalName: "Charming Kitten", normalizedName: "charming kitten",
      actorType: "apt", aliases: ["Charming Kitten"], actorIdentityIds: [], confidence: 0.7,
      firstSeenAt: "2026-07-20T00:00:00.000Z", lastSeenAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z",
      sourceIds: ["src_legacy"], captureIds: ["cap_legacy"], evidenceCount: 1,
      identityResolutionState: "archived", identityResolutionReason: "unresolved"
    });
    expect(archivedStore.listActorProfiles()).toEqual([]);
    expect(archivedStore.listActorAliases()).toEqual([]);
    expect(await archivedStore.listActorProfilesForOwnership()).toContainEqual(expect.objectContaining({ id: "actor_legacy_charming_kitten", identityResolutionState: "archived" }));
    expect(await archivedStore.listActorAliasesForOwnership()).toEqual([]);
    archivedStore.replaceActorIdentityCatalog(catalog, { sourceId: "src_mitre_enterprise_stix", captureId: "cap_mitre_enterprise_v19_1" });
    archivedStore.savePipelineResult(governed("src_governed_reactivation"));
    expect(archivedStore.listActorProfiles()).toEqual([
      expect.objectContaining({ id: "actor_legacy_charming_kitten", canonicalName: "Magic Hound", actorIdentityIds: ["mitre-attack-enterprise:G0059"], identityResolutionState: "canonical", evidenceCount: 2 })
    ]);
    expect(archivedStore.listActorProfiles()[0]).not.toHaveProperty("identityResolutionReason");

    const structured = processCollectedItem({
      sourceId: "src_real_claim_feed", url: "https://example.test/claim", collectedAt: "2026-07-21T00:00:00.000Z",
      rawText: "Charming Kitten claimed Example Systems.", contentHash: hashContent("structured-claim"), links: [], sensitive: false,
      metadata: { extractionProfile: "ransomware_victim_blog", leakSite: { actorName: "Charming Kitten", victimName: "Example Systems" } }
    }, { actorIdentities: catalog.identities });
    expect(structured.entities).toContainEqual(expect.objectContaining({ type: "ransomware_family", value: "Charming Kitten", actorIdentityIds: ["mitre-attack-enterprise:G0059"] }));

    const plan = createLiveSearchPlan({ request: { query: "Charming Kitten", entityType: "actor", createdAt: "2026-07-21T00:00:00.000Z" }, actorIdentities: catalog.identities, sources: [source({ id: "src_actor_reports", type: "rss" })] });
    expect(plan.dto.queryTerms).toEqual(expect.arrayContaining(["Charming Kitten", "Magic Hound", "APT35"]));
    expect(plan.dto.reuseKey).toBe(createLiveSearchPlan({ request: { query: "Magic Hound", entityType: "actor", createdAt: "2026-07-21T00:00:00.000Z" }, actorIdentities: catalog.identities, sources: [source({ id: "src_actor_reports", type: "rss" })] }).dto.reuseKey);
    expect(createLiveSearchPlan({ request: { query: "Thrip", entityType: "actor", createdAt: "2026-07-21T00:00:00.000Z" }, actorIdentities: catalog.identities, sources: [source({ id: "src_actor_reports", type: "rss" })] }).dto.queryTerms).toEqual(["Thrip"]);

    const beforeRefresh = processCollectedItem({ sourceId: "src_before_catalog", url: "https://example.test/before", collectedAt: "2026-07-21T00:00:00.000Z", rawText: "APT29 was named.", contentHash: hashContent("before-catalog"), links: [], metadata: {}, sensitive: false }, { actorIdentities: [] });
    expect(beforeRefresh.entities.some((entity: any) => entity.type === "actor")).toBe(false);
    const beforeRefreshStore = new InMemoryScraperStore();
    beforeRefreshStore.saveSource({ id: "src_catalog_pending", name: "Catalog pending first fetch", type: "json_api", url: "https://example.test/catalog.json", accessMethod: "public_http", status: "active", risk: "low", trustScore: 0.9, crawlFrequencySeconds: 3600, legalNotes: "Authoritative public catalog.", metadata: { extractionProfile: "mitre_actor_catalog", productionCollection: true } } as any);
    const beforeRefreshResponse = await handleApiRequest(new Request("http://localhost/v1/intel/search?q=apt29"), { store: beforeRefreshStore, frontier: new FocusedFrontier() } as any);
    expect(await beforeRefreshResponse.json()).toMatchObject({ status: "searching", actorIdentity: { catalogMatched: false, candidates: [] } });
  });

  test("merges exact canonical names across catalogs without treating associated names as identity equality", () => {
    const catalog = parseMitreActorCatalog(officialV191Excerpt, { retrievedAt: "2026-07-21T00:00:00.000Z", minimumCurrentIdentities: 6 });
    const supplemental = (canonicalName: string, externalId: string) => ({ ...catalog.identities[0], id: `actor_${externalId}`, catalogId: "ransomware-live-current-operations", externalId, canonicalName, normalizedCanonicalName: canonicalName.toLowerCase(), associatedNames: [] });
    const magicHound = supplemental("Magic Hound", "magic-hound");
    const ransomware = {
      ...catalog,
      catalogId: "ransomware-live-current-operations",
      catalogName: "Ransomware.live community group catalog",
      identities: [magicHound, supplemental("Charming Kitten", "charming-kitten"), supplemental("Thrip", "thrip")],
      counts: { ...catalog.counts, totalIdentityCount: 3, currentIdentityCount: 3 }
    } as any;
    const store = new InMemoryScraperStore();
    store.replaceActorIdentityCatalog(catalog, { sourceId: "src_mitre", captureId: "cap_mitre" });
    store.replaceActorIdentityCatalog(ransomware, { sourceId: "src_ransomware", captureId: "cap_ransomware" });
    const identities = store.listActorIdentities();
    const coverage = reconcileActorIdentityCoverage(identities);

    expect(coverage.currentCatalogRecordCount).toBe(9);
    expect(coverage.canonicalIdentityCount).toBe(8);
    expect(coverage.crossCatalogMergedIdentityCount).toBe(1);
    expect(identities.find((identity: any) => identity.id === magicHound.id)).toMatchObject({
      canonicalIdentityId: "mitre-attack-enterprise:G0059",
      canonicalIdentityEvidence: {
        matchedLabel: "Magic Hound",
        sourceCatalogVersion: ransomware.catalogVersion,
        sourceCaptureId: "cap_ransomware",
        targetCatalogVersion: catalog.catalogVersion,
        targetCaptureId: "cap_mitre"
      }
    });
    expect(identities.find((identity: any) => identity.externalId === "thrip" && identity.catalogId === ransomware.catalogId)).not.toHaveProperty("canonicalIdentityId");
    expect(resolveMitreActorIdentity("Charming Kitten", identities)).toMatchObject({ ambiguous: true });
    expect(resolveMitreActorIdentity("Charming Kitten", identities).candidates.map((candidate) => candidate.identity.externalId).sort()).toEqual(["G0059", "charming-kitten"]);
    expect(resolveMitreActorIdentity("Thrip", identities)).toMatchObject({ ambiguous: true });

    const item = processCollectedItem({
      sourceId: "src_real_report", url: "https://example.test/converged-identities", collectedAt: "2026-07-21T00:00:00.000Z",
      rawText: "Magic Hound claimed Example Systems.", contentHash: hashContent("converged-identities"), links: [],
      metadata: { extractionProfile: "ransomware_victim_blog", leakSite: { actorName: "Magic Hound", victimName: "Example Systems" } }, sensitive: false
    }, { actorIdentities: identities });
    store.savePipelineResult({
      ...item,
      entities: item.entities.map((entity: any) => entity.type === "actor"
        ? { ...entity, actorIdentityIds: ["mitre-attack-enterprise:G0059", magicHound.id] }
        : entity)
    });
    expect(store.listActorProfiles()).toEqual([
      expect.objectContaining({ canonicalName: "Magic Hound", actorIdentityIds: ["mitre-attack-enterprise:G0059"] })
    ]);
  });

  test("keeps archived actor ownership rows across file-backed restart without public exposure", async () => {
    const directory = mkdtempSync(join(tmpdir(), "actor-profile-archive-"));
    try {
      const snapshotPath = join(directory, "store.json");
      const archived = {
        id: "actor_archived_file", tenantId: "tenant_file", canonicalName: "Historical Name", normalizedName: "archived:actor_archived_file",
        actorType: "threat_actor", aliases: ["Historical Name"], actorIdentityIds: [], confidence: 0.7,
        firstSeenAt: "2026-07-20T00:00:00.000Z", lastSeenAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z",
        sourceIds: ["src_file"], captureIds: ["cap_file"], evidenceCount: 1,
        identityResolutionState: "archived", identityResolutionReason: "unresolved"
      };
      const first = new FileBackedScraperStore({ snapshotPath });
      first.saveActorProfile(archived);
      expect(first.listActorProfiles()).toEqual([]);
      expect(first.listActorAliases()).toEqual([]);

      const restarted = new FileBackedScraperStore({ snapshotPath });
      expect(restarted.listActorProfiles()).toEqual([]);
      expect(restarted.listActorAliases()).toEqual([]);
      expect(await restarted.listActorProfilesForOwnership()).toEqual([archived]);
      expect(await restarted.listActorAliasesForOwnership()).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
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
