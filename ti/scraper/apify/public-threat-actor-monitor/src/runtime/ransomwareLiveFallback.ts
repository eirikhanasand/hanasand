import type { TiSearchResponse } from "../types.ts";
import { parseNewsRss } from "../newsFallback/rss.ts";
import { safeIso, stableHash } from "../utils.ts";

const FEED_URL = "https://www.ransomware.live/rss.xml";

export async function fetchRansomwareLiveFallback(query: string): Promise<TiSearchResponse | undefined> {
  if (!isRansomwareQuery(query)) return undefined;
  const response = await fetch(FEED_URL, { headers: { "user-agent": "hanasand-ti-apify-actor/0.7 metadata-only" } }).catch(() => undefined);
  if (!response?.ok) return undefined;
  const items = parseNewsRss(await response.text(), 160).filter((item) => matches(query, item.title));
  return items.length ? ransomwareLiveResponse(query, items.slice(0, 80)) : undefined;
}

function ransomwareLiveResponse(query: string, items: ReturnType<typeof parseNewsRss>): TiSearchResponse {
  const generatedAt = new Date().toISOString();
  const dated = items.map((item) => ({ item, iso: safeIso(item.pubDate) ?? generatedAt }));
  return {
    query, generatedAt, mode: "ransomware_live_rss_fallback", status: "partial",
    runId: `rwlive_${stableHash(`${query}:${generatedAt}`)}`,
    refreshAfterSeconds: 900,
    summary: `Fresh ransomware victim-claim metadata matching ${query}.`,
    confidence: dated.length >= 3 ? 0.7 : 0.62,
    lastSeen: dated[0]?.iso ?? generatedAt,
    aliases: [], targets: [], ttps: [], datasets: [],
    recentActivity: dated.map(({ item, iso }, index) => ({
      date: iso, title: item.title, detail: `${item.source} metadata-only victim-claim signal for ${query}.`,
      confidence: 0.66, sourceIds: [`rwlive_${index}`], url: item.link,
      claimType: "victim_claim", victimName: victim(item.title),
      firstReportedAt: iso, lastReportedAt: iso, publisherCount: 1,
      impact: "public ransomware victim claim metadata"
    })),
    sources: dated.map(({ item }, index) => ({
      id: `rwlive_${index}`, name: item.title, type: "captured_public_source",
      provenance: "Ransomware.live public RSS metadata", url: item.link
    })),
    notes: ["Ransomware.live RSS fallback; metadata only; no leaked files or credentials"]
  };
}

function isRansomwareQuery(query: string): boolean {
  return /ransom|lockbit|akira|qilin|play|clop|black basta|ransomhub|hunters|medusa|rhysida|inc/i.test(query);
}

function matches(query: string, title: string): boolean {
  const haystack = title.toLowerCase();
  return query.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2 && token !== "ransomware").some((token) => haystack.includes(token));
}

function victim(title: string): string | undefined {
  return title.match(/victim\s*:\s*([^|]+)$/i)?.[1]?.trim();
}
