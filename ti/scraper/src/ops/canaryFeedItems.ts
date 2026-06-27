// @ts-nocheck
import { hashContent } from "../utils.ts";

const ITEM_RE = /<item\b[\s\S]*?<\/item>/gi;
const ENTRY_RE = /<entry\b[\s\S]*?<\/entry>/gi;

export function feedItems(source: any, task: any, fetched: string, at: string, metadata: any, maxItems = 40) {
  if (source.type === "telegram_public") {
    const telegram = telegramItems(source, task, fetched, at, metadata, maxItems);
    if (telegram.length) return telegram;
  }
  const blocks = [...fetched.matchAll(ITEM_RE)].map((m) => m[0]);
  if (!blocks.length) blocks.push(...[...fetched.matchAll(ENTRY_RE)].map((m) => m[0]));
  const items = blocks.slice(0, maxItems).map((block, index) => item(source, task, block, at, metadata, index)).filter((row) => row.rawText.length > 24);
  return items.length ? items : [fallback(source, task, fetched, at, metadata)];
}

function telegramItems(source: any, task: any, fetched: string, at: string, metadata: any, maxItems: number) {
  const blocks = [...fetched.matchAll(/<div\b[^>]*class=["'][^"']*\btgme_widget_message\b[^"']*["'][^>]*>[\s\S]*?(?=<div\b[^>]*class=["'][^"']*\btgme_widget_message\b|<\/section>|<\/body>|$)/gi)].map((m) => m[0]);
  return blocks.slice(0, maxItems).map((block, index) => telegramItem(source, task, block, at, metadata, index)).filter((item) => item.rawText.length > 10);
}

function telegramItem(source: any, task: any, block: string, at: string, metadata: any, index: number) {
  const dataPost = attr(block, "div", "data-post");
  const [channelFromPost, messageId] = dataPost.split("/");
  const channel = channelFromPost || telegramChannel(source.url) || "unknown";
  const messageText = text(classBlock(block, "tgme_widget_message_text"));
  const author = text(classBlock(block, "tgme_widget_message_author"));
  const title = [source.name, messageId ? `message ${messageId}` : ""].filter(Boolean).join(" ");
  const publishedAt = attr(block, "time", "datetime") || undefined;
  const messageUrl = dataPost ? `https://t.me/${dataPost}` : task.targetUrl;
  const rawText = [source.name, author, messageText].filter(Boolean).join("\n").slice(0, 24_000);
  return {
    ...row(source, task, messageUrl, title, rawText, at, publishedAt, { ...metadata, adapter: "telegram_public", channel, messageId: messageId ? Number(messageId) : undefined, messageState: "available", mediaPolicy: "metadata_only_no_download" }, index, false),
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
    sourceId: source.id, taskId: task.id, url, title, rawText, body: rawText,
    collectedAt: at, publishedAt, contentHash: hashContent(key), links: [url].filter(Boolean),
    metadata: { ...metadata, feedItem, itemIndex: index, sourceName: source.name },
    sensitive: false
  };
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
