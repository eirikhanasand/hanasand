// @ts-nocheck
import { hashContent } from "../utils.ts";
import { parseRssItems } from "../adapters/rssXml.ts";

const ITEM_RE = /<item\b[\s\S]*?<\/item>/gi;
const ENTRY_RE = /<entry\b[\s\S]*?<\/entry>/gi;

export function feedItems(source: any, task: any, fetched: string, at: string, metadata: any, maxItems = 40) {
  if (source.type === "telegram_public") {
    const telegram = telegramItems(source, task, fetched, at, metadata, maxItems);
    if (telegram.length) return telegram;
    return [fallback(source, task, fetched, at, { ...metadata, parserWarnings: ["public Telegram preview contained no messages"] })];
  }
  if (source.type === "json_api") {
    const json = jsonItems(source, task, fetched, at, metadata, maxItems);
    if (json.length) return json;
    return [fallback(source, task, fetched, at, { ...metadata, parserWarnings: ["JSON source contained no supported records"] })];
  }
  if (source.type === "rss") {
    const rss = parseRssItems(fetched, task.targetUrl).slice(0, maxItems).map((entry, index) => row(
      source,
      task,
      entry.link || task.targetUrl,
      entry.title || source.name,
      [source.name, entry.title, entry.description].filter(Boolean).join("\n").slice(0, 24_000),
      at,
      entry.publishedAt,
      { ...metadata, adapter: "rss", parserVersion: "rss-adapter-v2" },
      index,
      true
    )).filter((item) => item.rawText.length > 24);
    return rss.length ? rss : [fallback(source, task, fetched, at, { ...metadata, adapter: "rss", parserVersion: "rss-adapter-v2", parserWarnings: ["feed contained no RSS or Atom entries"] })];
  }
  const blocks = [...fetched.matchAll(ITEM_RE)].map((m) => m[0]);
  if (!blocks.length) blocks.push(...[...fetched.matchAll(ENTRY_RE)].map((m) => m[0]));
  const items = blocks.slice(0, maxItems).map((block, index) => item(source, task, block, at, metadata, index)).filter((row) => row.rawText.length > 24);
  return items.length ? items : [fallback(source, task, fetched, at, metadata)];
}

function jsonItems(source: any, task: any, fetched: string, at: string, metadata: any, maxItems: number) {
  const parsed = safeJson(fetched);
  const rows = jsonRows(parsed).slice(0, maxItems);
  return rows.map((entry, index) => jsonItem(source, task, entry, at, metadata, index)).filter((item) => item.rawText.length > 24);
}

function jsonItem(source: any, task: any, entry: any, at: string, metadata: any, index: number) {
  const title = stringField(entry, ["post_title", "title", "cveID", "id", "name", "group_name", "vendorProject"]) || source.name;
  const publishedAt = stringField(entry, ["discovered", "dateAdded", "published", "publishedDate", "lastModified", "lastModifiedDate", "updated"]);
  const url = stringField(entry, ["post_url", "link", "url", "source", "reference"]) || task.targetUrl;
  const rawText = [source.name, title, jsonSummary(entry)].filter(Boolean).join("\n").slice(0, 24_000);
  return row(source, task, /^https?:\/\//i.test(url) ? url : task.targetUrl, title, rawText, at, publishedAt, { ...metadata, jsonApi: true, structuredFields: structuredFields(entry) }, index, false);
}

function jsonRows(value: any): any[] {
  if (Array.isArray(value)) return value;
  for (const key of ["vulnerabilities", "vulnerabilitiesList", "items", "posts", "data", "results"]) {
    const rows = value?.[key];
    if (Array.isArray(rows)) return rows.map((row) => row?.cve ?? row);
  }
  return value && typeof value === "object" ? [value] : [];
}

function jsonSummary(value: any) {
  return JSON.stringify(value, (_key, item) => typeof item === "string" && item.length > 800 ? `${item.slice(0, 800)}...` : item);
}

function structuredFields(value: any) {
  const fields = ["cveID", "vendorProject", "product", "vulnerabilityName", "dateAdded", "shortDescription", "requiredAction", "dueDate", "knownRansomwareCampaignUse"];
  return Object.fromEntries(fields.flatMap((field) => typeof value?.[field] === "string" && value[field].trim() ? [[field, value[field].trim().slice(0, 1_000)]] : []));
}

function safeJson(value: string) {
  try { return JSON.parse(value); } catch { return undefined; }
}

function stringField(row: any, fields: string[]) {
  for (const field of fields) {
    const value = field.split(".").reduce((current, key) => current?.[key], row);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function telegramItems(source: any, task: any, fetched: string, at: string, metadata: any, maxItems: number) {
  const blocks = [...fetched.matchAll(/<div\b[^>]*class=["'][^"']*\btgme_widget_message\b[^"']*["'][^>]*>[\s\S]*?(?=<div\b[^>]*class=["'][^"']*\btgme_widget_message\b|<\/section>|<\/body>|$)/gi)].map((m) => m[0]);
  return blocks.slice(0, maxItems).map((block, index) => telegramItem(source, task, block, at, metadata, index)).filter((item) => item.rawText.length > 10);
}

function telegramItem(source: any, task: any, block: string, at: string, metadata: any, index: number) {
  const dataPost = attr(block, "div", "data-post");
  const [channelFromPost, messageId] = dataPost.split("/");
  const channel = channelFromPost || telegramChannel(source.url) || "unknown";
  const messageText = text(messageTextBlock(block));
  const author = text(classBlock(block, "tgme_widget_message_author"));
  const title = [source.name, messageId ? `message ${messageId}` : ""].filter(Boolean).join(" ");
  const publishedAt = attr(block, "time", "datetime") || undefined;
  const messageUrl = dataPost ? `https://t.me/${dataPost}` : task.targetUrl;
  const rawText = [source.name, author, messageText].filter(Boolean).join("\n").slice(0, 24_000);
  return {
    ...row(source, task, messageUrl, title, rawText, at, publishedAt, { ...metadata, adapter: "telegram_public", parserVersion: "telegram-public-preview:v1", channel, messageId: messageId ? Number(messageId) : undefined, messageState: "available", mediaPolicy: "metadata_only_no_download" }, index, false),
    links: [messageUrl, ...links(block)].slice(0, 12),
  };
}

function item(source: any, task: any, block: string, at: string, metadata: any, index: number) {
  const title = text(tag(block, "title")) || source.name;
  const summary = text(tag(block, "description") || tag(block, "summary") || tag(block, "content:encoded") || tag(block, "content"));
  const url = text(tag(block, "link")) || attr(block, "link", "href") || task.targetUrl;
  const publishedAt = text(tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date")) || undefined;
  const rawText = [source.name, title, summary].filter(Boolean).join("\n").slice(0, 24_000);
  return row(source, task, url, title, rawText, at, publishedAt, metadata, index, true);
}

function fallback(source: any, task: any, fetched: string, at: string, metadata: any) {
  const rawText = `${source.name}\n${text(fetched)}`.slice(0, 48_000);
  return row(source, task, task.targetUrl, source.name, rawText, at, undefined, metadata, 0, false);
}

function row(source: any, task: any, url: string, title: string, rawText: string, at: string, publishedAt: string | undefined, metadata: any, index: number, feedItem: boolean) {
  const key = `${source.id}:${url}:${title}:${hashContent(rawText)}`;
  return {
    tenantId: source.tenantId, sourceId: source.id, taskId: task.id, url, title, rawText, body: rawText,
    collectedAt: at, publishedAt, contentHash: hashContent(key), links: [url].filter(Boolean),
    metadata: { ...metadata, feedItem, itemIndex: index, sourceName: source.name, extractionProfile: extractionProfile(source) },
    sensitive: false
  };
}

function extractionProfile(source: any) {
  if (source.metadata?.extractionProfile) return source.metadata.extractionProfile;
  if (source.catalog?.canonicalId === "gov:us:cisa:known-exploited-vulnerabilities") return "cisa_kev";
  if (source.id === "src_ssscip_cert_ua_telegram") return "cert_ua_public_channel";
  if (source.id === "src_ccn_cert_telegram") return "ccn_cert_public_channel";
  return undefined;
}

function tag(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m?.[1] ?? "";
}

function attr(block: string, tagName: string, attrName: string) {
  const m = block.match(new RegExp(`<${tagName}\\b[^>]*\\s${attrName}=["']([^"']+)["'][^>]*>`, "i"));
  return m?.[1] ?? "";
}

function classBlock(block: string, className: string) {
  const m = block.match(new RegExp(`<[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i"));
  return m?.[1] ?? "";
}

function messageTextBlock(block: string) {
  const opening = /<[^>]+class=["'][^"']*\btgme_widget_message_text\b[^"']*["'][^>]*>/i.exec(block);
  if (!opening || opening.index === undefined) return "";
  const tail = block.slice(opening.index + opening[0].length);
  const footer = tail.search(/<[^>]+class=["'][^"']*\btgme_widget_message_footer\b/i);
  return footer >= 0 ? tail.slice(0, footer) : tail;
}

function links(block: string) {
  return [...block.matchAll(/\bhref=["']([^"']+)["']/gi)].map((match) => match[1]).filter((url) => /^https?:\/\//i.test(url));
}

function telegramChannel(url: string) {
  return url.match(/(?:https?:\/\/)?t\.me\/(?:s\/)?([a-zA-Z0-9_]+)/)?.[1];
}

function text(value: string) {
  return value.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10))).replace(/\s+/g, " ").trim();
}
