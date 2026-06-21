import type { MarketplaceRow } from "../types.ts";
import { uniqueStrings } from "../utils.ts";

export function keyPivotsForRow(row: MarketplaceRow): string[] {
  return uniqueStrings([
    row.actor,
    row.victimName ?? "",
    row.sector ?? "",
    ...(row.affectedSectors ?? []),
    row.country ?? "",
    ...(row.countries ?? []),
    row.ttp ?? "",
    row.attackId ?? "",
    ...row.sourceFamilies.map((family) => `source:${family}`),
    ...row.nextSearchPivots.slice(0, 3)
  ].filter(Boolean)).slice(0, 8);
}

export function cardPivots(row: MarketplaceRow) {
  const victimsTargets = uniqueStrings([
    row.victimName ?? "",
    row.sector ?? "",
    ...(row.affectedSectors ?? []),
    row.country ?? "",
    ...(row.countries ?? []),
    ...(row.regions ?? [])
  ].filter(Boolean)).slice(0, 6);
  const ttpTools = uniqueStrings([
    row.ttp ?? "",
    row.attackId ?? "",
    row.tactic ?? "",
    ...row.relationshipPivots.filter((pivot) => /^(ttp|attack|tactic|tool|malware|cve):/i.test(pivot)).map((pivot) => pivot.replace(/^[^:]+:/, ""))
  ].filter(Boolean)).slice(0, 6);
  const sourcePivots = uniqueStrings([
    ...(row.sourceName ? [`source:${row.sourceName}`] : []),
    ...row.sourceFamilies.map((family) => `family:${family}`),
    ...(row.sourceId ? [`id:${row.sourceId}`] : []),
    ...(row.publisherCount ? [`publishers:${row.publisherCount}`] : []),
    ...(row.corroboratingSourceIds?.length ? [`corroborating:${row.corroboratingSourceIds.length}`] : [])
  ]).slice(0, 6);
  return { victimsTargets, ttpTools, sourcePivots };
}
