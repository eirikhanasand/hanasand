import { describe, expect, test } from "bun:test";
import { parseMitreActorCatalog, resolveMitreActorIdentity } from "../pipeline/mitreActorCatalog.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

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

  test("registers catalog identities without fabricating activity profiles", () => {
    const catalog = parseMitreActorCatalog(officialV191Excerpt, { retrievedAt: "2026-07-21T00:00:00.000Z", minimumCurrentIdentities: 6 });
    const store = new InMemoryScraperStore();
    const report = store.replaceActorIdentityCatalog(catalog, { sourceId: "src_mitre_enterprise_stix", captureId: "cap_mitre_enterprise_v19_1" });

    expect(report).toMatchObject({ currentIdentityCount: 6, retainedHistoricalIdentityCount: 0 });
    expect(store.listActorIdentities()).toHaveLength(6);
    expect(store.listActorProfiles()).toHaveLength(0);
    expect(store.listActorIdentityCatalogs()[0]).not.toHaveProperty("identities");
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
