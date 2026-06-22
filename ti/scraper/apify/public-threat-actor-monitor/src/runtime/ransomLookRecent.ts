import type { TiSearchResponse } from "../types.ts";
import { safeIso, stableHash } from "../utils.ts";
import type { RansomwareLiveCard } from "./ransomwareLiveCards.ts";
import { ransomwareLiveCardResponse } from "./ransomwareLiveResponse.ts";

const RANSOMLOOK_RECENT_URL = "https://www.ransomlook.io/api/recent";
const RANSOMLOOK_POSTS_URL = "https://www.ransomlook.io/api/posts";
const RANSOMLOOK_SEARCH_URL = "https://www.ransomlook.io/api/search";
const RANSOMLOOK_RSS_URL = "https://www.ransomlook.io/rss.xml";
const RANSOMLOOK_PUBLIC_BASE = "https://www.ransomlook.io";
const RECENT_DAYS = 90;

type RansomLookRow = {
  post_title?: unknown;
  group_name?: unknown;
  discovered?: unknown;
  description?: unknown;
  link?: unknown;
};

type RansomLookSearchResponse = {
  posts?: RansomLookRow[];
};

export async function fetchRansomLookRecentResponses(): Promise<TiSearchResponse[] | undefined> {
  const response = await fetch(RANSOMLOOK_RECENT_URL, { headers: { "user-agent": "hanasand-ti-apify-actor/0.8 metadata-only" } }).catch(() => undefined);
  if (!response?.ok) return undefined;
  const rows = await response.json().catch(() => undefined) as RansomLookRow[] | undefined;
  if (!Array.isArray(rows)) return undefined;

  const grouped = new Map<string, RansomwareLiveCard[]>();
  for (const row of rows) {
    const card = cardFromRow(row);
    if (!card || !isRecent(card.discovered)) continue;
    const key = card.group.toLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), card]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, cards]) => ransomwareLiveCardResponse(group, dedupeCards(cards), RANSOMLOOK_RECENT_URL, "ransomlook_recent", "RansomLook"));
}

export async function fetchRansomLookPostIndexResponses(): Promise<TiSearchResponse[] | undefined> {
  const response = await fetch(RANSOMLOOK_POSTS_URL, { headers: { "user-agent": "hanasand-ti-apify-actor/0.8 metadata-only" } }).catch(() => undefined);
  if (!response?.ok) return undefined;
  const body = await response.json().catch(() => undefined) as { posts?: RansomLookRow[] } | RansomLookRow[] | undefined;
  const rows = Array.isArray(body) ? body : body?.posts;
  if (!Array.isArray(rows)) return undefined;

  const grouped = new Map<string, RansomwareLiveCard[]>();
  for (const row of rows) {
    const card = cardFromRow(row);
    if (!card || !isRecent(card.discovered)) continue;
    const key = card.group.toLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), card]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, cards]) => ransomwareLiveCardResponse(group, dedupeCards(cards), RANSOMLOOK_POSTS_URL, "ransomlook_posts", "RansomLook post index"));
}

export async function fetchRansomLookSearchResponses(queries: string[], limit = 25): Promise<TiSearchResponse[] | undefined> {
  const responses: TiSearchResponse[] = [];
  for (const query of uniqueQueries(queries).slice(0, limit)) {
    const url = `${RANSOMLOOK_SEARCH_URL}?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { "user-agent": "hanasand-ti-apify-actor/0.8 metadata-only" } }).catch(() => undefined);
    if (!response?.ok) continue;
    const body = await response.json().catch(() => undefined) as RansomLookSearchResponse | undefined;
    const cards = (body?.posts ?? [])
      .map(cardFromRow)
      .filter((card): card is RansomwareLiveCard => Boolean(card && isRecent(card.discovered)))
      .map((card) => ({ ...card, matchedSearchTerm: query }));
    const grouped = new Map<string, RansomwareLiveCard[]>();
    for (const card of cards) {
      const key = card.group.toLowerCase();
      grouped.set(key, [...(grouped.get(key) ?? []), card]);
    }
    for (const [group, groupCards] of grouped.entries()) {
      responses.push(ransomwareLiveCardResponse(group, dedupeCards(groupCards), url, "ransomlook_search", `RansomLook search: ${query}`));
    }
  }
  return responses.length ? responses : undefined;
}

export async function fetchRansomLookRssResponses(): Promise<TiSearchResponse[] | undefined> {
  const response = await fetch(RANSOMLOOK_RSS_URL, { headers: { "user-agent": "hanasand-ti-apify-actor/0.8 metadata-only" } }).catch(() => undefined);
  if (!response?.ok) return undefined;
  const cards = rssItems(await response.text())
    .map(cardFromRssItem)
    .filter((card): card is RansomwareLiveCard => Boolean(card && isRecent(card.discovered)));
  const grouped = new Map<string, RansomwareLiveCard[]>();
  for (const card of cards) {
    const key = card.group.toLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), card]);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, groupCards]) => ransomwareLiveCardResponse(group, dedupeCards(groupCards), RANSOMLOOK_RSS_URL, "ransomlook_rss", "RansomLook RSS"));
}

function cardFromRow(row: RansomLookRow): RansomwareLiveCard | undefined {
  const victim = clean(row.post_title);
  const group = clean(row.group_name);
  const discovered = safeIso(stringValue(row.discovered) ?? "");
  if (!victim || !group || !discovered || isJunk(victim)) return undefined;
  return {
    victim,
    group,
    discovered,
    description: clean(row.description),
    postUrl: publicLink(row.link)
  };
}

function cardFromRssItem(xml: string): RansomwareLiveCard | undefined {
  const title = xmlText(xml, "title");
  const match = title?.match(/^(.+?)\s+By\s+(.+)$/i);
  const victim = clean(match?.[1]);
  const group = clean(match?.[2]);
  const discovered = safeIso(xmlText(xml, "pubDate") ?? "");
  if (!victim || !group || !discovered || isJunk(victim)) return undefined;
  return {
    victim,
    group,
    discovered,
    description: clean(xmlText(xml, "description")),
    postUrl: publicLink(xmlText(xml, "link"))
  };
}

function publicLink(link: unknown): string | undefined {
  const cleaned = clean(link);
  if (!cleaned) return undefined;
  if (/^https?:\/\//i.test(cleaned)) return normalizeAbsoluteRansomLookUrl(cleaned);
  const path = cleaned.replace(/^\/+/, "/");
  return `${RANSOMLOOK_PUBLIC_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

function normalizeAbsoluteRansomLookUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.hostname === "www.ransomlook.io" || url.hostname === "ransomlook.io") {
      url.pathname = url.pathname.replace(/\/{2,}/g, "/");
      return url.toString();
    }
  } catch {
    return value;
  }
  return value;
}

function dedupeCards(cards: RansomwareLiveCard[]): RansomwareLiveCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = stableHash([card.group, card.victim, card.discovered].join("|"));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRecent(iso: string): boolean {
  const time = Date.parse(iso);
  return Number.isFinite(time) && Date.now() - time <= RECENT_DAYS * 86_400_000;
}

function clean(value: unknown): string | undefined {
  const normalized = stringValue(value)?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function rssItems(xml: string): string[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1] ?? "");
}

function xmlText(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}(?: [^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  return clean(decodeXml(match?.[1] ?? ""));
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isJunk(value: string): boolean {
  return /\b(not a case file|new\s+blog|new\s+site|old\s+site|blog\s+domain|mirror\s+domain|onion\s+domain|test|example|fixture|demo|sample)\b/i.test(value);
}

function uniqueQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  return queries
    .map((query) => query.trim())
    .filter((query) => query.length >= 2)
    .filter((query) => {
      const key = query.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
