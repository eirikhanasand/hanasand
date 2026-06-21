import type { AnalystCaveatPack } from "./searchQualityTypes.ts";

const PACKS: Record<string, AnalystCaveatPack> = {
  apt29: pack("APT29", "APT29 reporting is alias-heavy; separate current activity from historical tradecraft.", ["current campaign dates", "victim attribution", "TTP freshness"]),
  "scattered spider": pack("Scattered Spider", "Scattered Spider reporting often overlaps adjacent cybercrime naming.", ["alias collision", "social engineering TTPs", "victim confidence"]),
  "volt typhoon": pack("Volt Typhoon", "Volt Typhoon infrastructure claims require freshness and source diversity.", ["critical infrastructure targeting", "contradictions"]),
  turla: pack("Turla", "Turla profiles often include long-lived tooling and stale background material.", ["staleness", "current victim claims"]),
  akira: pack("Akira", "Akira evidence often arrives as metadata-only victim claims.", ["victim claim strength", "restricted metadata"]),
  muddywater: pack("MuddyWater", "MuddyWater reporting mixes vendor aliases, campaigns, and malware names.", ["alias mapping", "government targeting"]),
  shinyhunters: pack("ShinyHunters", "ShinyHunters reporting has naming drift with adjacent cybercrime clusters.", ["alias collision", "relationship confidence"]),
  unknown: pack("Unknown actor", "Unknown actor searches stay partial until attributed evidence is captured.", ["low evidence count", "capture completeness"])
};

export const analystCaveatPackFor = (actor: string): AnalystCaveatPack => PACKS[String(actor).toLowerCase()] ?? PACKS.unknown;
export const analystCaveatPacks = (): AnalystCaveatPack[] => Object.values(PACKS);

function pack(actor: string, summary: string, reviewFocus: string[]): AnalystCaveatPack {
  return { actor, summary, caveats: [summary], reviewFocus };
}
