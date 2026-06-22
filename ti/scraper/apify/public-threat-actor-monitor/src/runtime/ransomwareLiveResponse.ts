import type { TiSearchResponse } from "../types.ts";
import { safeIso, stableHash } from "../utils.ts";
import type { RansomwareLiveCard } from "./ransomwareLiveCards.ts";

export function ransomwareLiveCardResponse(query: string, cards: RansomwareLiveCard[], sourceUrl: string): TiSearchResponse {
  const generatedAt = new Date().toISOString();
  const dated = cards.map((card) => ({ card, iso: safeIso(card.discovered) ?? generatedAt }));
  return {
    query, generatedAt, mode: "ransomware_live_group_page", status: "partial",
    runId: `rwlive_group_${stableHash(`${query}:${cards.length}:${generatedAt}`)}`,
    refreshAfterSeconds: 1800,
    summary: `Public ransomware victim-claim metadata matching ${query}.`,
    confidence: dated.length >= 10 ? 0.72 : 0.64,
    lastSeen: dated[0]?.iso ?? generatedAt,
    aliases: [], targets: [], ttps: [], datasets: [],
    recentActivity: dated.map(({ card, iso }, index) => ({
      date: iso,
      title: `${card.group} victim claim: ${card.victim}`,
      detail: detail(card),
      confidence: 0.68,
      sourceIds: [`rwlive_group_${index}`],
      url: sourceUrl,
      claimType: "victim_claim",
      victimName: card.victim,
      affectedSectors: card.sector ? [card.sector] : undefined,
      countries: card.country ? [card.country] : undefined,
      firstReportedAt: iso,
      lastReportedAt: iso,
      publisherCount: 1,
      impact: "public ransomware victim claim metadata"
    })),
    sources: dated.map(({ card }, index) => ({
      id: `rwlive_group_${index}`,
      name: `${card.group} victim metadata: ${card.victim}`,
      type: "captured_public_source",
      provenance: "Ransomware.live public group page metadata",
      url: sourceUrl
    })),
    notes: ["Ransomware.live group page fallback; metadata only; no leaked files or credentials"]
  };
}

function detail(card: RansomwareLiveCard): string {
  return [card.description, card.sector && `Sector: ${card.sector}`, card.country && `Country: ${card.country}`, card.attackDate && `Estimated attack: ${card.attackDate}`]
    .filter(Boolean)
    .join(" ");
}
