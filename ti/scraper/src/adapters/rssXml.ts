import { canonicalizeUrl } from "./staticWeb.ts";
import type { RssItem } from "./rssTypes.ts";

export function parseRssItems(xml: string, feedUrl = "https://example.invalid/feed.xml"): RssItem[] {
  const blocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  return blocks.map((block) => ({
    title: decodeXmlTag(block, "title"),
    link: normalizeFeedLink(decodeXmlTag(block, "link") || decodeLinkHref(block), feedUrl),
    description: decodeXmlTag(block, "description") || decodeXmlTag(block, "summary") || decodeXmlTag(block, "content"),
    publishedAt: decodeXmlTag(block, "pubDate") || decodeXmlTag(block, "updated") || decodeXmlTag(block, "published") || decodeXmlTag(block, "dc:date") || undefined
  }));
}

function decodeXmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeEntities(stripCdata(match?.[1] ?? ""));
}

function decodeLinkHref(block: string): string {
  const alternate = [...block.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => !/\brel=["']?(self|hub)["']?/i.test(tag));
  const match = alternate?.match(/\bhref=["']([^"']+)["']/i);
  return decodeEntities(match?.[1] ?? "");
}

function normalizeFeedLink(link: string, feedUrl: string): string {
  if (!link) return "";
  try {
    return canonicalizeUrl(new URL(link, feedUrl).toString());
  } catch {
    return link;
  }
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function decodeEntities(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
