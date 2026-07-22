import { expect, test } from "bun:test";
import { parseCurrentRansomwareOperations } from "../pipeline/ransomwareOperationCatalog.ts";
import { parseMitreActorCatalog, resolveMitreActorIdentity } from "../pipeline/mitreActorCatalog.ts";
import { runCanaryCollectionCycle } from "../ops/canaryCollection.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";

// Exact safe fields from the public Ransomware.live feeds; restricted locators are intentionally omitted.
const groups = JSON.stringify([
  group("Akira", null, "conti", "2026-07-21T21:00:00Z", 200),
  group("TheGentlemen", "Storm-2697", null, "2026-07-21T20:00:00Z", 200),
  group("Old Group", null, null, "2026-01-01T00:00:00Z", 200),
  { ...group("Unreliable", null, null, "2026-07-21T20:00:00Z", 200), description: "Alleged victims cannot be verified; remove entries for this group" },
  group("Unavailable", null, null, "2026-07-21T20:00:00Z", 503)
]);
const victims = JSON.stringify([
  claim("akira", "2026-07-21T19:00:00Z"),
  claim("akira", "2026-07-20T19:00:00Z"),
  claim("thegentlemen", "2026-07-19T19:00:00Z"),
  claim("Unreliable", "2026-07-18T19:00:00Z"),
  claim("Unavailable", "2026-07-18T19:00:00Z"),
  claim("Missing Group", "2026-07-18T19:00:00Z"),
  claim("Old Group", "2025-01-01T00:00:00Z")
]);

test("retains only current reachable evidence-producing operation labels", () => {
  const catalog = parseCurrentRansomwareOperations(groups, victims, { retrievedAt: "2026-07-21T22:00:00Z", minimumCurrentIdentities: 2 });
  expect(catalog.identities.map((identity) => identity.canonicalName)).toEqual(["Akira", "TheGentlemen"]);
  expect(catalog.identities[0]).toMatchObject({ relatedOperationNames: ["conti"], currentEvidence: { recentClaimCount: 2, liveLocationCount: 1 }, aptNumberDesignationPresent: false });
  expect(catalog.identities[1].associatedNames).toEqual(["Storm-2697"]);
  expect(catalog.counts).toMatchObject({ sourceGroupCount: 5, currentIdentityCount: 2, recentClaimGroupCount: 5, liveLocationGroupCount: 2, unreliableExcludedCount: 1, unmatchedRecentClaimGroupCount: 1 });
  expect(catalog.exclusions).toEqual({ unreliableGroupNames: ["Unreliable"], recentClaimNamesMissingFromGroupCatalog: ["Missing Group"] });
  expect(JSON.stringify(catalog)).not.toContain(".onion");

  const mitre = parseMitreActorCatalog(JSON.stringify({ type: "bundle", id: "bundle--75fa0b14-5b14-4d12-a377-290a5ed6590d", objects: [
    { type: "x-mitre-collection", name: "Enterprise ATT&CK", modified: "2026-05-12T14:00:00.188Z", x_mitre_version: "19.1" },
    { type: "intrusion-set", id: "intrusion-set--2f69a19d-9ea6-4d42-92e3-0e694a78acbb", name: "Akira", aliases: ["Akira"], created: "2024-04-17T19:39:25.625Z", modified: "2026-05-12T15:12:00.732Z", revoked: false, x_mitre_deprecated: false, external_references: [{ source_name: "mitre-attack", external_id: "G1024", url: "https://attack.mitre.org/groups/G1024/" }] }
  ] }), { retrievedAt: "2026-07-21T22:00:00Z", minimumCurrentIdentities: 1 });
  expect(resolveMitreActorIdentity("Akira", [...mitre.identities, ...catalog.identities]).candidates.map((candidate) => candidate.identity.externalId)).toEqual(["G1024"]);
});

test("never presents source clock skew as future activity", () => {
  const catalog = parseCurrentRansomwareOperations(
    JSON.stringify([group("Clock Skew", null, null, "2026-07-22T08:00:00Z", 200)]),
    JSON.stringify([claim("Clock Skew", "2026-07-22T00:00:00Z")]),
    { retrievedAt: "2026-07-21T20:00:00Z", minimumCurrentIdentities: 1 }
  );

  expect(catalog.activityWatermarkAt).toBe("2026-07-21T20:00:00.000Z");
  expect(catalog.catalogModifiedAt).toBe("2026-07-21T20:00:00.000Z");
  expect(catalog.identities[0].currentEvidence).toMatchObject({ latestClaimPublishedAt: "2026-07-21T20:00:00.000Z", latestLocationCheckedAt: "2026-07-21T20:00:00.000Z" });
});

test("collects both real indexes as hash-only evidence and creates no activity", async () => {
  const at = "2026-07-21T22:00:00Z";
  const sourceBundle = await Bun.file(new URL("../../seeds/verified_long_lived_sources.json", import.meta.url)).json();
  const source = sourceBundle.sources.find((row: any) => row.id === "src_ransomwarelive_current_operations_catalog");
  const sourceGroups = Array.from({ length: 25 }, (_, index) => ({ ...group(`Operation ${index}`, null, null, "2026-07-21T20:00:00Z", 200), locations: [{ enabled: true, available: true, lastscrape: "2026-07-21T20:00:00Z", fqdn: `not-retained-${index}.onion`, http: { status: 200 } }] }));
  const sourceVictims = Array.from({ length: 25 }, (_, index) => claim(`Operation ${index}`, "2026-07-21T19:00:00Z"));
  const store = new InMemoryScraperStore();
  store.saveSource({ ...source, createdAt: at, updatedAt: at });

  const result = await runCanaryCollectionCycle({
    store,
    frontier: new FocusedFrontier(),
    sourceIds: [source.id],
    maxSources: 1,
    maxTasks: 1,
    maxItemsPerTask: 2,
    now: () => at,
    fetch: async (url: string | URL | Request) => new Response(String(url).endsWith("victims.json") ? JSON.stringify(sourceVictims) : JSON.stringify(sourceGroups), { headers: { "content-type": "application/json" } })
  } as any);

  expect(result).toMatchObject({ completedTaskCount: 1, failedTaskCount: 0, insertedCaptureCount: 2, incidentCount: 0 });
  expect(store.listActorIdentities()).toHaveLength(25);
  expect(store.listActorProfiles()).toHaveLength(0);
  expect(store.listIncidents()).toHaveLength(0);
  expect(store.listCaptures().every((capture: any) => capture.sensitive && capture.storageKind === "metadata_only" && capture.body === undefined)).toBe(true);
  expect(store.listActorIdentityCatalogs()[0].evidenceCaptureIds).toHaveLength(2);
  expect(JSON.stringify(store.listCaptures())).not.toContain(".onion");
});

function group(name: string, altname: string | null, lineage: string | null, lastscrape: string, status: number) {
  return { name, altname, lineage, description: null, locations: [{ enabled: true, available: status === 200, lastscrape, http: { status } }] };
}

function claim(group_name: string, published: string) {
  return { group_name, published };
}
