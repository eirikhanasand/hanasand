import type { DarkwebIndexRecord } from "./darkwebIndexTypes.ts";
import { actors, categories, hash, legal, networks, reviewFor, valueScore } from "./darkwebIndexHelpers.ts";

export function darkwebIndexFixtureRecords(count = 100): DarkwebIndexRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const actor = actors[index % actors.length], category = categories[index % categories.length], triage = legal[index % legal.length];
    const firstSeen = new Date(Date.UTC(2026, 5, 1 + (index % 20))).toISOString();
    return {
      id: `dw_${String(index + 1).padStart(5, "0")}`,
      network: networks[index % networks.length],
      category,
      legalTriage: triage,
      liveness: index % 9 === 0 ? "intermittent" : "live",
      reviewState: reviewFor(triage),
      title: `${actor} ${category.replaceAll("_", " ")} signal ${index + 1}`,
      safeSummary: `Metadata-only ${category.replaceAll("_", " ")} listing mentioning ${actor}; no raw locator, payload, files, or credentials stored.`,
      actorHints: [actor],
      victimHints: index % 3 === 0 ? [`victim-${index + 1}`] : [],
      datasetHints: index % 2 === 0 ? ["claimed dataset listing"] : [],
      sectorHints: index % 4 === 0 ? ["healthcare"] : ["unknown"],
      countryHints: index % 5 === 0 ? ["DE"] : [],
      sourceFamily: category === "leak_extortion" ? "ransomware_leak_site" : category,
      firstSeen,
      lastSeen: new Date(Date.parse(firstSeen) + 86_400_000).toISOString(),
      rawUrlHash: hash(`${actor}:${index}:raw`),
      sourceHash: hash(`${category}:${index}:source`),
      safeLocatorHash: hash(`${actor}:${category}:${index}`),
      provenance: { sourceType: "safe_search_result", sourceHash: hash(`source:${index}`) },
      isolationBoundary: { metadataOnly: true, noPayloadFollowing: true, noCredentialDownloads: true, noThreatActorInteraction: true },
      valueScore: 0
    };
  }).map((record) => ({ ...record, valueScore: valueScore(record) }));
}

export function rowsFromRuntime(input: { sources?: any[]; captures?: any[] }): DarkwebIndexRecord[] {
  const sources = new Map(((input as any).sources ?? []).map((source: any) => [source.id, source]));
  return ((input as any).captures ?? []).filter((capture: any) => capture.storageKind === "metadata_only" || capture.metadata?.leakSite).map((capture: any) => {
    const leak = capture.metadata?.leakSite ?? {};
    const source: any = sources.get(capture.sourceId);
    const network = String(source?.type ?? "tor_metadata").replace("_metadata", "");
    const firstSeen = leak.claimDate ?? leak.sourceTimestamp ?? capture.publishedAt ?? capture.collectedAt;
    return {
      id: capture.id,
      network: ["tor", "i2p", "freenet"].includes(network) ? network : "tor",
      category: "leak_extortion",
      legalTriage: "leak_or_extortion",
      liveness: "live",
      reviewState: "approved_metadata_only",
      title: [leak.actorName, leak.victimName].filter(Boolean).join(" ") || "Restricted metadata claim",
      safeSummary: `Metadata-only claim${leak.actorName ? ` mentioning ${leak.actorName}` : ""}${leak.victimName ? ` and ${leak.victimName}` : ""}; no raw locator or payload stored.`,
      actorHints: [leak.actorName].filter(Boolean),
      victimHints: [leak.victimName].filter(Boolean),
      datasetHints: [leak.claimedDataCategory].filter(Boolean),
      sectorHints: [leak.claimedSector].filter(Boolean),
      countryHints: [leak.claimedCountry].filter(Boolean),
      sourceFamily: "ransomware_leak_site",
      firstSeen,
      lastSeen: leak.sourceTimestamp ?? capture.collectedAt,
      rawUrlHash: leak.urlHash ?? hash(capture.url ?? capture.id),
      sourceHash: hash(capture.sourceId ?? capture.id),
      safeLocatorHash: leak.urlHash ?? hash(capture.url ?? capture.id),
      provenance: { sourceType: "internal_discovery", sourceHash: hash(capture.sourceId ?? capture.id) },
      isolationBoundary: { metadataOnly: true, noPayloadFollowing: true, noCredentialDownloads: true, noThreatActorInteraction: true },
      valueScore: 0.7,
    } as DarkwebIndexRecord;
  });
}
