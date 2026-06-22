import type { TiSearchResponse } from "../types.ts";
import { newsFallbackResponse } from "../newsFallback/response.ts";
import { parseNewsRss } from "../newsFallback/rss.ts";

export async function fetchPublicNewsFallback(query: string): Promise<TiSearchResponse | undefined> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} cyber threat when:30d`)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const response = await fetch(url, { headers: { "user-agent": "hanasand-ti-apify-actor/0.6 public-news-fallback" } });
    if (!response.ok) return undefined;
    const items = parseNewsRss(await response.text(), 12).filter((item) => isRelevantRecent(query, item.title, item.pubDate));
    return items.length ? newsFallbackResponse(query, items) : undefined;
  } catch {
    return undefined;
  }
}

function isRelevantRecent(query: string, title: string, pubDate: string): boolean {
  const ageDays = (Date.now() - Date.parse(pubDate)) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays < -1 || ageDays > 45) return false;
  const normalizedTitle = title.toLowerCase();
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(isDistinctiveToken);
  if (!tokens.length) return false;
  return tokens.length <= 2
    ? tokens.every((token) => normalizedTitle.includes(token))
    : tokens.some((token) => normalizedTitle.includes(token));
}

function isDistinctiveToken(token: string): boolean {
  return token.length > 2 && !["the", "cyber", "threat", "actor", "group", "ransomware", "malware", "leak", "extortion"].includes(token);
}
