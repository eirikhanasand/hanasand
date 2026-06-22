import type { MarketplaceRow } from "../types.ts";
import { uniqueStrings } from "../utils.ts";
import { displayValue } from "./display.ts";

export function keyPivotsForRow(row: MarketplaceRow): string[] {
  return uniqueStrings([
    displayValue(row.actor),
    row.victimName ?? "",
    row.victimWebsite ?? "",
    row.sector ?? "",
    ...(row.affectedSectors ?? []),
    row.country ?? "",
    ...(row.countries ?? []),
    row.ttp ?? "",
    row.attackId ?? "",
    row.matchedSearchTerm ?? "",
    ...cleanBuyerPivots(row.nextSearchPivots)
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
    ...(row.sourceName ? [row.sourceName] : []),
    ...row.sourceFamilies.map(displaySourceFamily),
    ...(row.publisherCount && row.publisherCount > 1 ? [`${row.publisherCount} public sources`] : []),
    ...(row.corroboratingSourceIds?.length ? [`${row.corroboratingSourceIds.length} corroborating sources`] : [])
  ]).slice(0, 6);
  return { victimsTargets, ttpTools, sourcePivots };
}

export function cleanBuyerPivots(pivots: string[]): string[] {
  return pivots
    .filter((pivot) => !/^(source|source_family|family|id|publishers|corroborating|paid|billing):/i.test(pivot))
    .filter((pivot) => !/\b(clear_web|public_channel|darknet_metadata|public channel|source family|advisories)\b/i.test(pivot))
    .map((pivot) => pivot.replace(/^(victim|actor|company|domain|sector|country|ttp|attack):/i, ""))
    .filter(Boolean)
    .slice(0, 3);
}

function displaySourceFamily(family: string): string {
  const normalized = family.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (normalized === "clear web") return "public web";
  if (normalized === "dark web") return "dark web";
  return displayValue(normalized);
}
