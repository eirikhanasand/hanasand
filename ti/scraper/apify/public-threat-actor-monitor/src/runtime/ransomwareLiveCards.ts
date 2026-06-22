export interface RansomwareLiveCard {
  victim: string;
  group: string;
  discovered: string;
  attackDate?: string;
  country?: string;
  sector?: string;
  description?: string;
}

export function parseRansomwareLiveCards(html: string, limit: number): RansomwareLiveCard[] {
  return html.split(/<div class="[^"]*victim-item">/).slice(1)
    .map((chunk) => card(chunk))
    .filter((item): item is RansomwareLiveCard => Boolean(item?.victim && item.group && item.discovered))
    .slice(0, limit);
}

function card(html: string): RansomwareLiveCard | undefined {
  const victim = text(html.match(/class="victim-title[^"]*">\s*([\s\S]*?)\s*<\/a>/)?.[1]);
  const group = text(html.match(/class="rl-group-badge">\s*([\s\S]*?)\s*<\/a>/)?.[1]);
  const discovered = text(html.match(/<strong>Discovered:<\/strong>\s*([0-9-]+)/)?.[1]);
  if (!victim || !group || !discovered || isJunkVictim(victim)) return undefined;
  return {
    victim, group, discovered,
    attackDate: text(html.match(/<strong>Attack est\.:<\/strong>\s*([0-9-]+)/)?.[1]),
    country: text(html.match(/alt="([A-Z]{2})"/)?.[1]),
    sector: sector(html),
    description: text(html.match(/<div class="victim-desc[^"]*">\s*([\s\S]*?)\s*<\/div>/)?.[1])
  };
}

function isJunkVictim(victim: string): boolean {
  return /new\s+blog|blog\s+domain|mirror\s+domain|onion\s+domain|test\s+post/i.test(victim);
}

function sector(html: string): string | undefined {
  const match = html.match(/\/activity\/([^"]+)/);
  return match ? decodeURIComponent(match[1] ?? "").trim() : undefined;
}

function text(value: string | undefined): string | undefined {
  const normalized = decode(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
