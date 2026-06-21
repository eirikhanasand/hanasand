import type { SourceRecord } from "../types.ts";
import type { PublicSignalSourceFamily } from "./publicSignalTypes.ts";

export const FAMILIES: PublicSignalSourceFamily[] = [
  "public_channel", "github_advisory", "cert_government", "vendor_report",
  "malware_report_feed", "public_research_feed", "public_social",
  "clear_web", "darkweb_metadata"
];

export function familyForSource(source: SourceRecord): PublicSignalSourceFamily {
  if (source.type === "telegram_public") return "public_channel";
  if (source.type === "github_advisory") return "github_advisory";
  if (source.type === "tor_metadata" || source.type === "i2p_metadata") return "darkweb_metadata";
  if (source.name.toLowerCase().includes("cert")) return "cert_government";
  if (source.name.toLowerCase().includes("vendor")) return "vendor_report";
  return source.type === "rss" ? "public_research_feed" : "clear_web";
}

export function missingFamilies(selected: any[]) {
  const present = new Set(selected.map((source) => source.family ?? familyForSource(source)));
  return FAMILIES.filter((family) => !present.has(family));
}
