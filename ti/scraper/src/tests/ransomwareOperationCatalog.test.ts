import { expect, test } from "bun:test";
import { parseCurrentRansomwareOperations } from "../pipeline/ransomwareOperationCatalog.ts";
import { parseMitreActorCatalog, resolveMitreActorIdentity } from "../pipeline/mitreActorCatalog.ts";
import { runCanaryCollectionCycle } from "../ops/canaryCollection.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { hashContent } from "../utils.ts";

// Exact safe fields from the public Ransomware.live feeds; restricted locators are intentionally omitted.
const groups = JSON.stringify([
  { ...group("Akira", null, "conti", "2026-07-21T21:00:00Z", 200), date: "2026-07-21T21:00:00Z" },
  { ...group("Recent Only", "Recent Alias", null, "2026-07-21T20:00:00Z", 503), description: "A documented operation with recent public claims." },
  { ...group("Live Only", null, null, "2026-07-21T20:00:00Z", 200), description: "A documented operation with a reachable publication location." },
  { ...group("Historical Group", null, null, "2026-01-01T00:00:00Z", 503), description: "A documented historical operation.", _victim_count: 4 },
  { ...group("Unreliable", null, null, "2026-07-21T20:00:00Z", 200), description: "Alleged victims cannot be verified; remove entries for this group" },
]);
const victims = JSON.stringify([
  claim("akira", "2026-07-21T19:00:00Z"),
  claim("akira", "2026-07-20T19:00:00Z"),
  claim("Recent Only", "2026-07-19T19:00:00Z"),
  claim("Unreliable", "2026-07-18T19:00:00Z"),
  claim("Missing Group", "2026-07-18T19:00:00Z"),
  claim("Historical Group", "2025-01-01T00:00:00Z")
]);

test("registers current and historical identities independently from per-signal activity", () => {
  const catalog = parseCurrentRansomwareOperations(groups, victims, { retrievedAt: "2026-07-21T22:00:00Z", minimumCurrentIdentities: 3 });
  expect(catalog.identities.map((identity) => [identity.canonicalName, identity.status])).toEqual([
    ["Akira", "current"],
    ["Historical Group", "retired"],
    ["Live Only", "current"],
    ["Recent Only", "current"]
  ]);
  expect(catalog.identities.find((identity) => identity.canonicalName === "Akira")).toMatchObject({
    sourceFirstReportedAt: "2026-07-21T21:00:00.000Z",
    relatedOperationNames: ["conti"],
    lineageRelations: [{ relationship: "evolved_from", name: "conti" }],
    activityEvidence: [
      { kind: "recent_public_claim", count: 2, contentHash: catalog.evidenceContentHashes[1] },
      { kind: "reachable_publication_location", count: 1, contentHash: catalog.evidenceContentHashes[0] }
    ]
  });
  expect(catalog.identities.find((identity) => identity.canonicalName === "Akira")).not.toHaveProperty("createdAt");
  expect(catalog.identities.find((identity) => identity.canonicalName === "Akira")).not.toHaveProperty("modifiedAt");
  expect(catalog.identities.find((identity) => identity.canonicalName === "Recent Only")).toMatchObject({
    associatedNames: ["Recent Alias"],
    activityEvidence: [{ kind: "recent_public_claim", contentHash: catalog.evidenceContentHashes[1] }]
  });
  expect(catalog.identities.find((identity) => identity.canonicalName === "Live Only")).toMatchObject({
    activityEvidence: [{ kind: "reachable_publication_location", contentHash: catalog.evidenceContentHashes[0] }]
  });
  expect(catalog.identities.find((identity) => identity.canonicalName === "Historical Group")).toMatchObject({
    status: "retired",
    descriptionAvailable: true,
    activityEvidence: []
  });
  expect(catalog).not.toHaveProperty("activityEvidence");
  expect(catalog.counts).toMatchObject({
    sourceGroupCount: 5,
    totalIdentityCount: 4,
    currentIdentityCount: 3,
    retiredIdentityCount: 1,
    recentClaimGroupCount: 4,
    recentClaimIdentityCount: 2,
    liveLocationGroupCount: 2,
    bothCurrentEvidenceIdentityCount: 1,
    recentClaimOnlyIdentityCount: 1,
    liveLocationOnlyIdentityCount: 1,
    historicalIdentityCount: 1,
    historicalDescriptionIdentityCount: 1,
    historicalVictimHistoryIdentityCount: 1,
    unreliableExcludedCount: 1,
    resolvedRecentClaimAliasCount: 0,
    unmatchedRecentClaimGroupCount: 1,
    identityActivityEvidenceCount: 4,
    sourceVictimRecordCount: 6
  });
  expect(catalog.exclusions).toEqual({
    unreliableGroupNames: ["Unreliable"],
    invalidIdentityLabels: [],
    generatedIdentityLabels: [],
    invalidAliasLabels: [],
    recentClaimAliasesResolvedByUniqueLocation: [],
    recentClaimNamesMissingFromGroupCatalog: ["Missing Group"]
  });
  expect(catalog.lifecycle).toEqual({
    recentClaimOnlyGroupNames: ["Recent Only"],
    liveLocationOnlyGroupNames: ["Live Only"],
    bothCurrentEvidenceGroupNames: ["Akira"],
    historicalGroupNames: ["Historical Group"]
  });
  expect(catalog.governance.identityRegistrationSource).toBe("tier_2_community_group_catalog");
  expect(catalog.governance.excludedDataClasses).toContain("victim names as identities");
  expect(JSON.stringify(catalog)).not.toContain(".onion");

  const mitre = parseMitreActorCatalog(JSON.stringify({ type: "bundle", id: "bundle--75fa0b14-5b14-4d12-a377-290a5ed6590d", objects: [
    { type: "x-mitre-collection", name: "Enterprise ATT&CK", modified: "2026-05-12T14:00:00.188Z", x_mitre_version: "19.1" },
    { type: "intrusion-set", id: "intrusion-set--2f69a19d-9ea6-4d42-92e3-0e694a78acbb", name: "Akira", aliases: ["Akira"], created: "2024-04-17T19:39:25.625Z", modified: "2026-05-12T15:12:00.732Z", revoked: false, x_mitre_deprecated: false, external_references: [{ source_name: "mitre-attack", external_id: "G1024", url: "https://attack.mitre.org/groups/G1024/" }] }
  ] }), { retrievedAt: "2026-07-21T22:00:00Z", minimumCurrentIdentities: 1 });
  expect(resolveMitreActorIdentity("Akira", [...mitre.identities, ...catalog.identities])).toMatchObject({ ambiguous: true });
  const store = new InMemoryScraperStore();
  store.replaceActorIdentityCatalog(mitre, { sourceId: "src_mitre", captureId: "cap_mitre" });
  store.replaceActorIdentityCatalog(catalog, { sourceId: "src_ransomware_live", captureId: "cap_ransomware_live" });
  expect(store.listActorIdentities().find((identity: any) => identity.canonicalName === "Akira" && identity.catalogId === catalog.catalogId)).toMatchObject({
    canonicalIdentityId: "mitre-attack-enterprise:G1024",
    canonicalIdentityEvidence: {
      matchedLabel: "Akira",
      sourceCatalogVersion: catalog.catalogVersion,
      sourceCaptureId: "cap_ransomware_live",
      targetCatalogVersion: mitre.catalogVersion,
      targetCaptureId: "cap_mitre"
    }
  });
  expect(resolveMitreActorIdentity("Akira", store.listActorIdentities()).candidates.map((candidate) => candidate.identity.externalId)).toEqual(["G1024"]);
});

test("resolves a victim-feed spelling alias only through one matching authoritative group location", () => {
  const catalog = parseCurrentRansomwareOperations(
    JSON.stringify([
      {
        ...group("secp0", null, null, "2026-07-23T10:05:45Z", 200),
        locations: [{
          enabled: true,
          available: true,
          fqdn: "secponewsxgrlnirowclps2kllzaotaf5w2bsvktdnz4qhjr2jnwvvyd.onion",
          lastscrape: "2026-07-23T10:05:45Z",
          http: { status: 200 }
        }]
      }
    ]),
    JSON.stringify([{
      group_name: "secpo",
      published: "2026-07-23T09:00:00Z",
      post_url: "http://secponewsxgrlnirowclps2kllzaotaf5w2bsvktdnz4qhjr2jnwvvyd.onion/post/example/index.html"
    }]),
    { retrievedAt: "2026-07-23T11:00:00Z", minimumCurrentIdentities: 1 }
  );

  expect(catalog.identities).toEqual([
    expect.objectContaining({
      canonicalName: "secp0",
      associatedNames: ["secpo"],
      status: "current",
      activityEvidence: expect.arrayContaining([expect.objectContaining({ kind: "recent_public_claim", count: 1 })])
    })
  ]);
  expect(catalog.counts).toMatchObject({
    recentClaimGroupCount: 1,
    recentClaimIdentityCount: 1,
    resolvedRecentClaimAliasCount: 1,
    unmatchedRecentClaimGroupCount: 0
  });
  expect(catalog.exclusions).toMatchObject({
    recentClaimAliasesResolvedByUniqueLocation: [{ claimName: "secpo", canonicalName: "secp0" }],
    recentClaimNamesMissingFromGroupCatalog: []
  });
  expect(JSON.stringify(catalog)).not.toContain(".onion");
});

test("uses retrieval-time freshness and preserves future source timestamps only as anomalies", () => {
  const stale = parseCurrentRansomwareOperations(
    JSON.stringify([{ ...group("Stale Group", null, null, "2025-01-01T00:00:00Z", 503), description: "Documented historical operation." }]),
    JSON.stringify([claim("Stale Group", "2025-01-01T00:00:00Z")]),
    { retrievedAt: "2026-07-21T20:00:00Z", minimumCurrentIdentities: 0 }
  );
  expect(stale.identities[0]).toMatchObject({ status: "retired", activityEvidence: [] });
  expect(stale.counts).toMatchObject({ currentIdentityCount: 0, historicalIdentityCount: 1 });

  const catalog = parseCurrentRansomwareOperations(
    JSON.stringify([group("Clock Skew", null, null, "2026-07-22T08:00:00Z", 200)]),
    JSON.stringify([claim("Clock Skew", "2026-07-22T00:00:00Z")]),
    { retrievedAt: "2026-07-21T20:00:00Z", minimumCurrentIdentities: 0 }
  );

  expect(catalog.identities[0]).toMatchObject({ status: "retired", activityEvidence: [] });
  expect(catalog.activityWatermarkAt).toBeUndefined();
  expect(catalog.catalogModifiedAt).toBeUndefined();
  expect(catalog.identities[0]).not.toHaveProperty("createdAt");
  expect(catalog.identities[0]).not.toHaveProperty("modifiedAt");
  expect(catalog.timestampAnomalies).toEqual([
    expect.objectContaining({ field: "victim.published", sourceTimestamp: "2026-07-22T00:00:00.000Z", currentnessEligible: false }),
    expect.objectContaining({ field: "group.location.checked", sourceTimestamp: "2026-07-22T08:00:00.000Z", currentnessEligible: false })
  ]);
});

test("keeps identity versioning stable when only victim and location activity changes", () => {
  const at = "2026-07-21T20:00:00Z";
  const first = parseCurrentRansomwareOperations(
    JSON.stringify([{ ...group("Stable Identity", null, null, "2026-07-21T19:00:00Z", 200), date: "2025-01-01", description: "Stable identity description." }]),
    JSON.stringify([claim("Stable Identity", "2026-07-21T18:00:00Z")]),
    { retrievedAt: at, minimumCurrentIdentities: 1 }
  );
  const second = parseCurrentRansomwareOperations(
    JSON.stringify([{ ...group("Stable Identity", null, null, "2025-01-01T19:00:00Z", 503), date: "2025-01-01", description: "Stable identity description." }]),
    JSON.stringify([claim("Stable Identity", "2025-01-01T18:00:00Z")]),
    { retrievedAt: at, minimumCurrentIdentities: 0 }
  );

  expect(second.identities[0]).toMatchObject({ status: "retired", activityEvidence: [] });
  expect(second).toMatchObject({
    bundleSha256: first.bundleSha256,
    catalogVersion: first.catalogVersion
  });
  expect(second.catalogModifiedAt).toBeUndefined();
  expect(second.evidenceContentHashes).not.toEqual(first.evidenceContentHashes);
});

test("requires structured attribution for common-word operation names", () => {
  const catalog = parseCurrentRansomwareOperations(
    JSON.stringify([group("Payload", null, null, "2026-07-21T19:00:00Z", 200)]),
    JSON.stringify([claim("Payload", "2026-07-21T18:00:00Z")]),
    { retrievedAt: "2026-07-21T20:00:00Z", minimumCurrentIdentities: 1 }
  );
  expect(catalog.identities[0]).toMatchObject({ canonicalName: "Payload", lookupPolicy: "structured_only" });
  const context = (rawText: string, metadata: any = {}) => processCollectedItem({
    sourceId: "src_public_report",
    url: "https://publisher.example/report",
    collectedAt: "2026-07-21T20:00:00Z",
    rawText,
    contentHash: hashContent(rawText),
    links: [],
    metadata,
    sensitive: false
  }, { actorIdentities: catalog.identities });
  expect(context("The payload loader executed in memory.").entities.some((entity: any) => entity.type === "actor" || entity.type === "ransomware_family")).toBe(false);
  expect(context("Structured operation metadata.", { extractionProfile: "ransomware_group_metadata", ransomwareGroup: { actorName: "Payload" } }).entities)
    .toContainEqual(expect.objectContaining({ type: "ransomware_family", value: "Payload", actorIdentityIds: [catalog.identities[0].id] }));
});

test("collects both real indexes as hash-only evidence without retaining restricted locators", async () => {
  const at = "2026-07-21T22:00:00Z";
  const sourceBundle = await Bun.file(new URL("../../seeds/verified_long_lived_sources.json", import.meta.url)).json();
  const source = sourceBundle.sources.find((row: any) => row.id === "src_ransomwarelive_current_operations_catalog");
  const operationNames = ["Akira", "Abyss", "AiLock", "APT73", "AuditTeam", "Aurora", "Black X", "BlackNevas", "Blackout", "BlackWater", "Booba Project", "BrainCipher", "Bravox", "Clop", "CRPxO", "D1R", "Deadlock", "Doommageddon", "DragonForce", "Embargo", "Genesis", "Gunra", "Inc Ransom", "Insomnia", "Interlock"];
  const sourceGroups = [...operationNames.map((name, index) => ({ ...group(name, null, null, "2026-07-21T20:00:00Z", 200), locations: [{ enabled: true, available: true, lastscrape: "2026-07-21T20:00:00Z", fqdn: `not-retained-${index}.onion`, http: { status: 200 } }] })), group("Operation 0", null, null, "2026-07-21T20:00:00Z", 200)];
  const sourceVictims = [...operationNames.map((name) => claim(name, "2026-07-21T19:00:00Z")), claim("Operation 0", "2026-07-21T19:00:00Z")];
  const store = new InMemoryScraperStore();
  const fetchedUrls: string[] = [];
  store.saveSource({ ...source, createdAt: at, updatedAt: at });

  const result = await runCanaryCollectionCycle({
    store,
    frontier: new FocusedFrontier(),
    sourceIds: [source.id],
    maxSources: 1,
    maxTasks: 1,
    maxItemsPerTask: 2,
    now: () => at,
    fetch: async (url: string | URL | Request) => {
      fetchedUrls.push(String(url));
      return new Response(String(url).endsWith("victims.json") ? JSON.stringify(sourceVictims) : JSON.stringify(sourceGroups), { headers: { "content-type": "application/json" } });
    }
  } as any);

  expect(result).toMatchObject({ queuedTaskCount: 1, completedTaskCount: 1, failedTaskCount: 0, insertedCaptureCount: 28, incidentCount: 0 });
  expect(fetchedUrls).toEqual(["https://data.ransomware.live/groups.json", "https://data.ransomware.live/victims.json"]);
  expect(store.listActorIdentities()).toHaveLength(25);
  expect(store.listActorProfiles()).toHaveLength(0);
  expect(store.listIncidents()).toHaveLength(0);
  expect(store.listCaptures().slice(0, 2).every((capture: any) => capture.sensitive && capture.storageKind === "metadata_only" && capture.body === undefined)).toBe(true);
  expect(store.listCaptures().filter((capture: any) => capture.metadata?.extractionProfile === "ransomware_group_metadata")).toHaveLength(26);
  expect(store.listActorIdentityCatalogs()[0].evidenceCaptureIds).toHaveLength(2);
  expect(store.listActorIdentityCatalogs()[0].exclusions.generatedIdentityLabels).toEqual(["Operation 0"]);
  expect(JSON.stringify(store.listCaptures())).not.toContain(".onion");
});

function group(name: string, altname: string | null, lineage: string | null, lastscrape: string, status: number) {
  return { name, altname, lineage, description: null, locations: [{ enabled: true, available: status === 200, lastscrape, http: { status } }] };
}

function claim(group_name: string, published: string) {
  return { group_name, published };
}
