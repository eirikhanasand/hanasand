export interface NewsRssItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

export function parseNewsRss(xml: string, limit = 6): NewsRssItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((match) => itemFromXml(match[1] ?? ""))
    .filter((item): item is NewsRssItem => Boolean(item?.title && item.link && item.pubDate))
    .slice(0, limit);
}

function itemFromXml(xml: string): NewsRssItem | undefined {
  const title = text(xml, "title");
  const link = text(xml, "link");
  const pubDate = text(xml, "pubDate");
  if (!title || !link || !pubDate) return undefined;
  return { title, link, pubDate, source: text(xml, "source") || host(link) || "public news" };
}

function text(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}(?: [^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  return decode(match?.[1] ?? "").replace(/\s+/g, " ").trim();
}

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function host(value: string): string | undefined {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return undefined; }
}
