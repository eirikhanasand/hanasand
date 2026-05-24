import type { AdapterRunResult, CollectionTask, SourceRecord } from "../types.ts";
import { hashContent, normalizeWhitespace, nowIso } from "../utils.ts";
import type { CollectionAdapter } from "./base.ts";
import { evaluateTaskForCollection } from "../policy/collectionPolicy.ts";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type AdapterHttpCache = Map<string, { etag?: string; lastModified?: string }>;
export type StaticWebFailureCategory =
  | "policy_blocked"
  | "robots_blocked"
  | "not_modified"
  | "rate_limited"
  | "not_found"
  | "http_error"
  | "too_large"
  | "unsupported_mime";

export interface StaticWebAdapterOptions {
  fetcher?: Fetcher;
  cache?: AdapterHttpCache;
  checkRobots?: boolean;
}

export class StaticWebAdapter implements CollectionAdapter {
  readonly type = "static_web" as const;
  private readonly fetcher: Fetcher;
  private readonly cache: AdapterHttpCache;
  private readonly robotsCache = new Map<string, RobotsRules>();
  private readonly checkRobots: boolean;

  constructor(options: StaticWebAdapterOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.cache = options.cache ?? new Map();
    this.checkRobots = options.checkRobots ?? true;
  }

  async collect(source: SourceRecord, task?: CollectionTask) {
    const policy = task
      ? evaluateTaskForCollection(source, task)
      : { allowed: true, metadataOnly: false, reason: "manual run" };

    const startedAt = Date.now();
    const url = task?.targetUrl ?? source.url;
    const warnings: string[] = [];
    if (!policy.allowed) {
      return emptyStaticResult(url, [policy.reason], "policy_blocked", startedAt, { policyReason: policy.reason });
    }

    if (!source.legalNotes.trim()) warnings.push("source has no legal notes");

    if (this.checkRobots) {
      const robots = await this.getRobotsRules(url);
      if (robots.checked && !robots.allowed) {
        return emptyStaticResult(url, [`robots.txt disallows collection for ${url}`], "robots_blocked", startedAt, {
          robotsChecked: true
        });
      }
      warnings.push(...robots.warnings);
    }

    const headers = createConditionalHeaders(url, this.cache);
    const response = await this.fetcher(url, { headers });
    if (response.status === 304) {
      return emptyStaticResult(url, [`Static page not modified for ${url}`], "not_modified", startedAt, {
        responseStatus: response.status,
        statusClass: statusClass(response.status)
      });
    }
    if (!response.ok) {
      const failureCategory = httpFailureCategory(response.status);
      return emptyStaticResult(url, [`Static fetch returned ${response.status} for ${url}`], failureCategory, startedAt, {
        responseStatus: response.status,
        statusClass: statusClass(response.status),
        retryAfterSeconds: retryAfterSeconds(response)
      });
    }

    const contentType = response.headers.get("content-type");
    if (!isSupportedStaticMediaType(contentType)) {
      return emptyStaticResult(url, [`Unsupported static content type ${contentType} for ${url}`], "unsupported_mime", startedAt, {
        responseStatus: response.status,
        statusClass: statusClass(response.status),
        contentType
      });
    }

    const finalUrl = canonicalizeUrl(response.url || url);
    rememberValidators(finalUrl, response, this.cache);
    const html = await response.text();
    const contentBytes = byteLength(html);
    if (task?.maxBytes && contentBytes > task.maxBytes) {
      return emptyStaticResult(url, [`Static page exceeds maxBytes ${task.maxBytes} for ${url}`], "too_large", startedAt, {
        responseStatus: response.status,
        statusClass: statusClass(response.status),
        finalUrl,
        contentType,
        contentBytes,
        maxBytes: task.maxBytes
      });
    }

    const canonicalUrl = extractCanonicalUrl(html, finalUrl);
    const rawText = extractReadableText(html);
    const links = extractLinks(html, canonicalUrl);
    const title = extractTitle(html);
    const robotsMeta = extractRobotsMeta(html);
    const collectedAt = nowIso();
    const contentHash = hashContent(rawText || html);
    if (robotsMeta.noindex) warnings.push("page declares noindex in robots meta");
    if (robotsMeta.nofollow) warnings.push("page declares nofollow in robots meta");

    return {
      items: [{
        sourceId: source.id,
        taskId: task?.id,
        url: canonicalUrl,
        collectedAt,
        title,
        rawText,
        html,
        contentHash,
        language: source.language,
        links,
        metadata: {
          adapter: "static_web",
          sourceType: source.type,
          requestedUrl: url,
          finalUrl,
          canonicalUrl,
          responseStatus: response.status,
          statusClass: statusClass(response.status),
          redirected: response.redirected,
          contentType,
          contentBytes,
          fetchDurationMs: Date.now() - startedAt,
          etag: response.headers.get("etag") ?? undefined,
          lastModified: response.headers.get("last-modified") ?? undefined,
          legalNotes: source.legalNotes,
          robots: robotsMeta,
          extraction: {
            rawTextLength: rawText.length,
            linkCount: links.length
          },
          provenance: {
            sourceId: source.id,
            taskId: task?.id,
            url: canonicalUrl,
            collectedAt,
            contentHash,
            extractorVersion: "static-web-adapter-v2",
            confidence: rawText ? 0.75 : 0.35
          }
        },
        sensitive: false
      }],
      discovered: links.map((link) => ({
        source,
        url: link,
        discoveredAt: collectedAt,
        anchorText: extractAnchorTextForHref(html, link, canonicalUrl),
        surroundingText: title,
        parentUrl: canonicalUrl,
        parentRelevance: 0.5,
        novelty: 0.5,
        freshness: 0.5
      })),
      warnings,
      metadata: {
        adapter: "static_web",
        requestedUrl: url,
        finalUrl,
        canonicalUrl,
        responseStatus: response.status,
        statusClass: statusClass(response.status),
        contentType,
        contentBytes,
        fetchDurationMs: Date.now() - startedAt
      }
    };
  }

  private async getRobotsRules(pageUrl: string): Promise<RobotsRules> {
    const robotsUrl = robotsUrlFor(pageUrl);
    if (!robotsUrl) return { checked: false, allowed: true, warnings: [] };
    const cached = this.robotsCache.get(robotsUrl);
    if (cached) return applyRobotsRules(cached, pageUrl);

    try {
      const response = await this.fetcher(robotsUrl, { headers: baseHeaders() });
      if (response.status === 404) {
        const rules = { checked: true, allowed: true, warnings: [] };
        this.robotsCache.set(robotsUrl, rules);
        return rules;
      }
      if (!response.ok) {
        return { checked: true, allowed: true, warnings: [`robots.txt fetch returned ${response.status}`] };
      }
      const rules = parseRobotsTxt(await response.text());
      this.robotsCache.set(robotsUrl, rules);
      return applyRobotsRules(rules, pageUrl);
    } catch (error) {
      return {
        checked: true,
        allowed: true,
        warnings: [`robots.txt check failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }
}

function emptyStaticResult(
  requestedUrl: string,
  warnings: string[],
  failureCategory: StaticWebFailureCategory,
  startedAt: number,
  metadata: Record<string, unknown> = {}
): AdapterRunResult {
  return {
    items: [],
    discovered: [],
    warnings,
    metadata: {
      adapter: "static_web",
      requestedUrl,
      failureCategory,
      fetchDurationMs: Date.now() - startedAt,
      ...metadata
    }
  };
}

export function extractReadableText(html: string): string {
  return normalizeWhitespace(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
  );
}

export function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? extractReadableText(match[1]) : undefined;
}

export function extractLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
    try {
      const href = match[1];
      if (!href || shouldIgnoreHref(href)) continue;
      links.add(canonicalizeUrl(new URL(href, baseUrl).toString()));
    } catch {
      continue;
    }
  }

  return [...links];
}

export function extractCanonicalUrl(html: string, fallbackUrl: string): string {
  const match = html.match(/<link\b[^>]*rel=["'][^"']*\bcanonical\b[^"']*["'][^>]*>/i);
  const href = match?.[0].match(/\bhref=["']([^"']+)["']/i)?.[1];
  if (!href) return canonicalizeUrl(fallbackUrl);
  try {
    return canonicalizeUrl(new URL(href, fallbackUrl).toString());
  } catch {
    return canonicalizeUrl(fallbackUrl);
  }
}

export function canonicalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  const sorted = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [key, valuePart] of sorted) url.searchParams.append(key, valuePart);
  return url.toString();
}

export function createConditionalHeaders(url: string, cache: AdapterHttpCache): Record<string, string> {
  const validators = cache.get(canonicalizeUrl(url));
  return {
    ...baseHeaders(),
    ...(validators?.etag ? { "if-none-match": validators.etag } : {}),
    ...(validators?.lastModified ? { "if-modified-since": validators.lastModified } : {})
  };
}

export function rememberValidators(url: string, response: Response, cache: AdapterHttpCache): void {
  const etag = response.headers.get("etag") ?? undefined;
  const lastModified = response.headers.get("last-modified") ?? undefined;
  if (etag || lastModified) cache.set(canonicalizeUrl(url), { etag, lastModified });
}

interface RobotsRules {
  checked: boolean;
  allowed: boolean;
  warnings: string[];
  disallow?: string[];
}

function baseHeaders(): Record<string, string> {
  return { "user-agent": "ti-scraper/0.1 public-cti-research" };
}

function httpFailureCategory(status: number): StaticWebFailureCategory {
  if (status === 429) return "rate_limited";
  if (status === 404) return "not_found";
  return "http_error";
}

function statusClass(status: number): string {
  return `${Math.floor(status / 100)}xx`;
}

function retryAfterSeconds(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds)) return seconds;
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function isSupportedStaticMediaType(value: string | null): boolean {
  if (!value) return true;
  const mediaType = value.split(";")[0]?.trim().toLowerCase();
  return mediaType === "text/html" ||
    mediaType === "application/xhtml+xml" ||
    mediaType === "text/plain" ||
    mediaType === "application/xml" ||
    mediaType === "text/xml";
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function shouldIgnoreHref(href: string): boolean {
  const normalized = href.trim().toLowerCase();
  return normalized.startsWith("#") ||
    normalized.startsWith("mailto:") ||
    normalized.startsWith("tel:") ||
    normalized.startsWith("javascript:");
}

function extractRobotsMeta(html: string): { noindex: boolean; nofollow: boolean } {
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => /\bname=["']robots["']/i.test(tag))
    .map((tag) => tag.match(/\bcontent=["']([^"']+)["']/i)?.[1].toLowerCase() ?? "")
    .join(",");
  return { noindex: meta.includes("noindex"), nofollow: meta.includes("nofollow") };
}

function extractAnchorTextForHref(html: string, target: string, baseUrl: string): string | undefined {
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      if (canonicalizeUrl(new URL(match[1], baseUrl).toString()) === target) {
        return extractReadableText(match[2]);
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function robotsUrlFor(pageUrl: string): string | undefined {
  try {
    const url = new URL(pageUrl);
    return `${url.origin}/robots.txt`;
  } catch {
    return undefined;
  }
}

function parseRobotsTxt(text: string): RobotsRules {
  const disallow: string[] = [];
  let applies = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") applies = value === "*" || value.toLowerCase().includes("ti-scraper");
    if (applies && key === "disallow" && value) disallow.push(value);
  }
  return { checked: true, allowed: true, warnings: [], disallow };
}

function applyRobotsRules(rules: RobotsRules, pageUrl: string): RobotsRules {
  try {
    const path = new URL(pageUrl).pathname;
    const blocked = rules.disallow?.some((rule) => rule !== "/" ? path.startsWith(rule) : true) ?? false;
    return { ...rules, allowed: !blocked };
  } catch {
    return rules;
  }
}
