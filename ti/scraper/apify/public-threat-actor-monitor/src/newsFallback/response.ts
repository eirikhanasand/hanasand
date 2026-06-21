import type { TiSearchResponse } from "../types.ts";
import { safeIso, stableHash, uniqueStrings } from "../utils.ts";
import type { NewsRssItem } from "./rss.ts";
import { inferClaimType, inferNewsTtp } from "./ttp.ts";

export function newsFallbackResponse(query: string, items: NewsRssItem[]): TiSearchResponse {
  const generatedAt = new Date().toISOString();
  const dated = items.map((item) => ({ item, iso: safeIso(item.pubDate) ?? generatedAt }));
  const ttps = uniqueStrings(dated.map(({ item }) => inferNewsTtp(item.title).name)).slice(0, 4);
  return {
    query, generatedAt, mode: "public_news_rss_fallback", status: "partial",
    runId: `news_${stableHash(`${query}:${generatedAt}`)}`,
    refreshAfterSeconds: 900,
    summary: `Fresh public news mentions for ${query}.`,
    confidence: dated.length >= 2 ? 0.68 : 0.6,
    lastSeen: dated[0]?.iso ?? generatedAt,
    aliases: [], recentActivity: dated.map(({ item, iso }, index) => activity(query, item, iso, index)),
    targets: [], ttps: ttps.map((name) => ttp(name)), datasets: [], sources: dated.map(({ item }, index) => source(item, index)),
    notes: ["public news RSS fallback; metadata only; no raw article body"]
  };
}

function activity(query: string, item: NewsRssItem, iso: string, index: number) {
  return {
    date: iso, title: item.title, detail: `${query} appeared in public reporting from ${item.source}.`,
    confidence: 0.64, sourceIds: [`news_${index}`], url: item.link,
    claimType: inferClaimType(item.title), firstReportedAt: iso, lastReportedAt: iso,
    publisherCount: 1, impact: "fresh public reporting signal"
  };
}

function source(item: NewsRssItem, index: number) {
  return { id: `news_${index}`, name: item.source, type: "clear_web", provenance: "Google News RSS", url: item.link };
}

function ttp(name: string) {
  const inferred = inferNewsTtp(name);
  return { ...inferred, name, detail: "Inferred from public news headline for monitoring triage.", confidence: 0.58 };
}
