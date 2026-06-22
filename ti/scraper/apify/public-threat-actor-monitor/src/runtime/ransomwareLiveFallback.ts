import type { TiSearchResponse } from "../types.ts";
import { parseRansomwareLiveCards } from "./ransomwareLiveCards.ts";
import { ransomwareLiveGroupUrl } from "./ransomwareLiveGroups.ts";
import { ransomwareLiveCardResponse } from "./ransomwareLiveResponse.ts";
import { fetchRansomwareLiveRss } from "./ransomwareLiveRss.ts";

export async function fetchRansomwareLiveFallback(query: string): Promise<TiSearchResponse | undefined> {
  return await fetchRansomwareLiveGroup(query) ?? (isRansomwareQuery(query) ? await fetchRansomwareLiveRss(query) : undefined);
}

function isRansomwareQuery(query: string): boolean {
  return /ransom|lockbit|akira|qilin|play|clop|black|hub|hunters|medusa|rhysida|inc|alphv/i.test(query);
}

async function fetchRansomwareLiveGroup(query: string): Promise<TiSearchResponse | undefined> {
  const url = ransomwareLiveGroupUrl(query);
  if (!url) return undefined;
  const response = await fetch(url, { headers: { "user-agent": "hanasand-ti-apify-actor/0.8 metadata-only" } }).catch(() => undefined);
  if (!response?.ok) return undefined;
  const cards = parseRansomwareLiveCards(await response.text(), 500);
  return cards.length ? ransomwareLiveCardResponse(query, cards, url) : undefined;
}
