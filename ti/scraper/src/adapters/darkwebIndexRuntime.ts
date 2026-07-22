import type { DarkwebIndexRecord } from "./darkwebIndexTypes.ts";
import { hash, networks, valueScore } from "./darkwebIndexHelpers.ts";

export function rowsFromRuntime(input: { sources?: any[]; captures?: any[] }): DarkwebIndexRecord[] {
  const sources = new Map(((input as any).sources ?? []).map((source: any) => [source.id, source]));
  return ((input as any).captures ?? []).flatMap((capture: any) => {
    const leak = capture.metadata?.leakSite ?? {};
    const source: any = sources.get(capture.sourceId);
    const network = networks.find((candidate) => candidate === String(source?.type ?? "").replace("_metadata", ""));
    if (!network) return [];
    const actorName = meaningfulHint(leak.actorName);
    const victimName = meaningfulHint(leak.victimName);
    const datasetHint = meaningfulHint(leak.claimedDataCategory);
    const sectorHint = meaningfulHint(leak.claimedSector);
    const countryHint = meaningfulHint(leak.claimedCountry);
    if (!actorName && !victimName) return [];
    const firstSeen = leak.claimDate ?? leak.sourceTimestamp ?? capture.publishedAt ?? capture.collectedAt;
    const record: DarkwebIndexRecord = {
      id: capture.id,
      network,
      category: "leak_extortion",
      legalTriage: "leak_or_extortion",
      liveness: "live",
      reviewState: "approved_metadata_only",
      title: [actorName, victimName].filter(Boolean).join(" "),
      safeSummary: `Metadata-only claim${actorName ? ` mentioning ${actorName}` : ""}${victimName ? `${actorName ? " and" : " mentioning"} ${victimName}` : ""}; no raw locator or payload stored.`,
      actorHints: actorName ? [actorName] : [],
      victimHints: victimName ? [victimName] : [],
      datasetHints: datasetHint ? [datasetHint] : [],
      sectorHints: sectorHint ? [sectorHint] : [],
      countryHints: countryHint ? [countryHint] : [],
      sourceFamily: "ransomware_leak_site",
      firstSeen,
      lastSeen: leak.sourceTimestamp ?? capture.collectedAt,
      rawUrlHash: leak.urlHash ?? hash(capture.url ?? capture.id),
      sourceHash: hash(capture.sourceId ?? capture.id),
      safeLocatorHash: leak.urlHash ?? hash(capture.url ?? capture.id),
      provenance: { sourceType: "internal_discovery", sourceHash: hash(capture.sourceId ?? capture.id) },
      isolationBoundary: { metadataOnly: true, noPayloadFollowing: true, noCredentialDownloads: true, noThreatActorInteraction: true },
      valueScore: 0,
    };
    return [{ ...record, valueScore: valueScore(record) }];
  });
}

function meaningfulHint(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text && !/^(?:unknown|n\/?a|not available|not disclosed(?: by (?:the )?ta)?|new victim claim)$/i.test(text) ? text : undefined;
}
