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
  const sourceRows = ((input as any).sources ?? []).filter((s: any) => String(s.type ?? "").includes("metadata")).map((source: any, index: number) => ({ ...darkwebIndexFixtureRecords(1)[0], id: `src_${source.id ?? index}`, title: source.name ?? "Darkweb metadata source", sourceHash: hash(source.id ?? source.url ?? String(index)) }));
  return sourceRows.length ? sourceRows : darkwebIndexFixtureRecords(Math.max(100, input.captures?.length ?? 0));
}
