import type { TiSearchResponse } from "../types.ts";
import { safeIso, stableHash } from "../utils.ts";
import type { RansomwareLiveCard } from "./ransomwareLiveCards.ts";
import { ransomwareLiveCardResponse } from "./ransomwareLiveResponse.ts";

const VICTIMS_JSON_URL = "https://data.ransomware.live/victims.json";
const GROUPS_JSON_URL = "https://data.ransomware.live/groups.json";
const RECENT_DAYS = 90;

type VictimJsonRow = {
  post_title?: string;
  group_name?: string;
  discovered?: string;
  published?: string;
  website?: string;
  country?: string;
  activity?: string;
  description?: string;
  post_url?: string;
  extrainfos?: {
    data_size?: unknown;
    ransom?: unknown;
  };
};

type GroupJsonRow = {
  name?: string;
  meta?: string | null;
  description?: string | null;
};

export async function fetchRansomwareLiveVictimsJsonResponses(): Promise<TiSearchResponse[] | undefined> {
  const [response, unreliableGroups] = await Promise.all([
    fetch(VICTIMS_JSON_URL, { headers: { "user-agent": "hanasand-ti-apify-actor/0.8 metadata-only" } }).catch(() => undefined),
    fetchUnreliableGroups()
  ]);
  if (!response?.ok) return undefined;
  const rows = await response.json().catch(() => undefined) as VictimJsonRow[] | undefined;
  if (!Array.isArray(rows)) return undefined;

  const grouped = new Map<string, RansomwareLiveCard[]>();
  for (const row of rows) {
    const card = cardFromJson(row, unreliableGroups);
    if (!card || !isRecent(card.discovered)) continue;
    const key = card.group.toLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), card]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, cards]) => ransomwareLiveCardResponse(group, dedupeCards(cards), VICTIMS_JSON_URL, "ransomware_live_victims_json"));
}

async function fetchUnreliableGroups(): Promise<Set<string>> {
  const response = await fetch(GROUPS_JSON_URL, { headers: { "user-agent": "hanasand-ti-apify-actor/0.8 metadata-only" } }).catch(() => undefined);
  if (!response?.ok) return new Set();
  const rows = await response.json().catch(() => undefined) as GroupJsonRow[] | undefined;
  if (!Array.isArray(rows)) return new Set();
  return new Set(rows
    .filter((row) => /unreliable|cannot be verified|randomly selected|remove entries|removed entries/i.test(`${row.description ?? ""} ${row.meta ?? ""}`))
    .map((row) => row.name?.toLowerCase().trim())
    .filter((name): name is string => Boolean(name)));
}

function cardFromJson(row: VictimJsonRow, unreliableGroups: Set<string>): RansomwareLiveCard | undefined {
  const victim = clean(row.post_title || row.website);
  const group = clean(row.group_name);
  const discovered = safeIso(row.discovered ?? row.published ?? "");
  if (!victim || !group || !discovered || hasTestMarker(victim)) return undefined;
  if (unreliableGroups.has(group.toLowerCase())) return undefined;
  return {
    victim,
    group,
    discovered,
    attackDate: safeIso(row.published ?? ""),
    country: clean(row.country),
    sector: clean(row.activity),
    description: clean(row.description),
    dataSize: clean(typeof row.extrainfos?.data_size === "string" ? row.extrainfos.data_size : undefined),
    website: clean(row.website),
    publicUrl: ransomwareLiveVictimUrl(victim, group),
    postUrl: clean(row.post_url)
  };
}

function ransomwareLiveVictimUrl(victim: string, group: string): string {
  return `https://www.ransomware.live/id/${encodeURIComponent(btoa(unescape(encodeURIComponent(`${victim}@${group}`))))}`;
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

function clean(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function hasTestMarker(value: string): boolean {
  return /\b(test|example|fixture|demo|sample)\b/i.test(value);
}
