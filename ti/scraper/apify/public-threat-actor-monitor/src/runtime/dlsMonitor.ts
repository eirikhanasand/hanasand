import type { TiSearchResponse } from "../types.ts";
import { safeIso, stableHash } from "../utils.ts";
import type { RansomwareLiveCard } from "./ransomwareLiveCards.ts";
import { ransomwareLiveCardResponse } from "./ransomwareLiveResponse.ts";

const DLS_MONITOR_POSTS_URL = "https://raw.githubusercontent.com/cyberiskvision/dls-monitor/main/posts.json";
const DLS_MONITOR_PUBLIC_URL = "https://github.com/cyberiskvision/dls-monitor/blob/main/posts.json";
const RECENT_DAYS = 90;

type DlsMonitorPost = {
  post_title?: unknown;
  group_name?: unknown;
  discovered?: unknown;
};

export async function fetchDlsMonitorNovelResponses(existingResponses: TiSearchResponse[]): Promise<TiSearchResponse[] | undefined> {
  const response = await fetch(DLS_MONITOR_POSTS_URL, { headers: { "user-agent": "hanasand-ti-apify-actor/0.8 metadata-only" } }).catch(() => undefined);
  if (!response?.ok) return undefined;
  const rows = await response.json().catch(() => undefined) as DlsMonitorPost[] | undefined;
  if (!Array.isArray(rows)) return undefined;

  const existingKeys = victimKeys(existingResponses);
  const grouped = new Map<string, RansomwareLiveCard[]>();
  for (const row of rows) {
    const card = cardFromPost(row);
    if (!card || !isRecent(card.discovered) || existingKeys.has(victimKey(card.group, card.victim))) continue;
    const key = card.group.toLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), card]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, cards]) => ransomwareLiveCardResponse(group, dedupeCards(cards), DLS_MONITOR_PUBLIC_URL, "dls_monitor_recent", "DLS Monitor"));
}

function cardFromPost(row: DlsMonitorPost): RansomwareLiveCard | undefined {
  const victim = cleanVictim(row.post_title);
  const group = clean(row.group_name);
  const discovered = safeIso(stringValue(row.discovered) ?? "");
  if (!victim || !group || !discovered || isJunk(victim)) return undefined;
  return { victim, group, discovered };
}

function victimKeys(responses: TiSearchResponse[]): Set<string> {
  const keys = new Set<string>();
  for (const response of responses) {
    for (const item of response.recentActivity) {
      if (item.victimName) keys.add(victimKey(response.query, item.victimName));
    }
  }
  return keys;
}

function victimKey(group: string, victim: string): string {
  return `${normalize(group)}|${normalize(victim)}`;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function dedupeCards(cards: RansomwareLiveCard[]): RansomwareLiveCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = stableHash([card.group, card.victim].join("|"));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRecent(iso: string): boolean {
  const time = Date.parse(iso);
  return Number.isFinite(time) && Date.now() - time <= RECENT_DAYS * 86_400_000;
}

function cleanVictim(value: unknown): string | undefined {
  return clean(value)?.replace(/^\[(?:DISCLOSED|LEAKED|PUBLISHED)\]\s*/i, "").trim() || undefined;
}

function clean(value: unknown): string | undefined {
  const normalized = stringValue(value)?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isJunk(value: string): boolean {
  return /\b(not a case file|new\s+blog|new\s+site|old\s+site|blog\s+domain|mirror\s+domain|onion\s+domain|hello world|test|example|fixture|demo|sample)\b/i.test(value);
}
