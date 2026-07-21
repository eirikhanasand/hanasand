import type { AdapterRunResult, CollectionTask, SourceRecord } from "../types.ts";
import { evaluateTaskForCollection } from "../policy/collectionPolicy.ts";
import { hashContent, normalizeWhitespace, nowIso } from "../utils.ts";
import type { CollectionAdapter } from "./base.ts";
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type AdapterHttpCache = Map<string, { etag?: string; lastModified?: string }>;
export type StaticWebFailureCategory = "policy_blocked" | "robots_blocked" | "not_modified" | "rate_limited" | "not_found" | "http_error" | "too_large" | "unsupported_mime";
export interface StaticWebAdapterOptions { fetcher?: Fetcher; cache?: AdapterHttpCache; checkRobots?: boolean; } interface RobotsRules { checked: boolean; allowed: boolean; warnings: string[]; disallow?: string[]; }
export class StaticWebAdapter implements CollectionAdapter {
  readonly type = "static_web" as const;
  private readonly fetcher: Fetcher; private readonly cache: AdapterHttpCache; private readonly robotsCache = new Map<string, RobotsRules>(); private readonly checkRobots: boolean;
  constructor(options: StaticWebAdapterOptions = {}) { this.fetcher = options.fetcher ?? fetch; this.cache = options.cache ?? new Map(); this.checkRobots = options.checkRobots ?? true; }
  async collect(source: SourceRecord, task?: CollectionTask) {
    const startedAt = Date.now(), url = task?.targetUrl ?? source.url, warnings: string[] = [];
    const policy = task ? evaluateTaskForCollection(source, task) : { allowed: true, metadataOnly: false, reason: "manual run" };
    if (!policy.allowed) return emptyStaticResult(url, [policy.reason], "policy_blocked", startedAt, { policyReason: policy.reason });
    if (!source.legalNotes.trim()) warnings.push("source has no legal notes");
    if (this.checkRobots) { const robots = await this.getRobotsRules(url); if (robots.checked && !robots.allowed) return emptyStaticResult(url, [`robots.txt disallows collection for ${url}`], "robots_blocked", startedAt, { robotsChecked: true }); warnings.push(...robots.warnings); }
    const response = await this.fetcher(url, { headers: createConditionalHeaders(url, this.cache) });
    const base = { responseStatus: response.status, statusClass: statusClass(response.status) };
    if (response.status === 304) return emptyStaticResult(url, [`Static page not modified for ${url}`], "not_modified", startedAt, base);
    if (!response.ok) return emptyStaticResult(url, [`Static fetch returned ${response.status} for ${url}`], httpFailureCategory(response.status), startedAt, { ...base, retryAfterSeconds: retryAfterSeconds(response) });
    const contentType = response.headers.get("content-type");
    if (!isSupportedStaticMediaType(contentType)) return emptyStaticResult(url, [`Unsupported static content type ${contentType} for ${url}`], "unsupported_mime", startedAt, { ...base, contentType });
    const finalUrl = canonicalizeUrl(response.url || url), html = await response.text(), contentBytes = byteLength(html);
    rememberValidators(finalUrl, response, this.cache);
    if (task?.maxBytes && contentBytes > task.maxBytes) return emptyStaticResult(url, [`Static page exceeds maxBytes ${task.maxBytes} for ${url}`], "too_large", startedAt, { ...base, finalUrl, contentType, contentBytes, maxBytes: task.maxBytes });
    const canonicalUrl = extractCanonicalUrl(html, finalUrl), rawText = extractReadableText(html), links = extractLinks(html, canonicalUrl), title = extractTitle(html), robots = extractRobotsMeta(html), collectedAt = nowIso(), contentHash = hashContent(rawText || html);
    if (robots.noindex) warnings.push("page declares noindex in robots meta"); if (robots.nofollow) warnings.push("page declares nofollow in robots meta");
    const meta = { adapter: "static_web", requestedUrl: url, finalUrl, canonicalUrl, responseStatus: response.status, statusClass: statusClass(response.status), contentType, contentBytes, fetchDurationMs: Date.now() - startedAt };
    return { items: [{ tenantId: source.tenantId, sourceId: source.id, taskId: task?.id, url: canonicalUrl, collectedAt, title, rawText, html, contentHash, language: source.language, links, metadata: { ...meta, sourceType: source.type, redirected: response.redirected, etag: response.headers.get("etag") ?? undefined, lastModified: response.headers.get("last-modified") ?? undefined, legalNotes: source.legalNotes, robots, extraction: { rawTextLength: rawText.length, linkCount: links.length }, provenance: { sourceId: source.id, taskId: task?.id, url: canonicalUrl, collectedAt, contentHash, extractorVersion: "static-web-adapter-v2", confidence: rawText ? 0.75 : 0.35 } }, sensitive: false }], discovered: links.map((link) => ({ source, url: link, discoveredAt: collectedAt, anchorText: extractAnchorTextForHref(html, link, canonicalUrl), surroundingText: title, parentUrl: canonicalUrl, parentRelevance: 0.5, novelty: 0.5, freshness: 0.5 })), warnings, metadata: meta };
  }
  private async getRobotsRules(pageUrl: string): Promise<RobotsRules> {
    const robotsUrl = robotsUrlFor(pageUrl); if (!robotsUrl) return { checked: false, allowed: true, warnings: [] };
    const cached = this.robotsCache.get(robotsUrl); if (cached) return applyRobotsRules(cached, pageUrl);
    try { const response = await this.fetcher(robotsUrl, { headers: baseHeaders() }); if (response.status === 404) return cacheRobots(this.robotsCache, robotsUrl, { checked: true, allowed: true, warnings: [] }); if (!response.ok) return { checked: true, allowed: true, warnings: [`robots.txt fetch returned ${response.status}`] }; return applyRobotsRules(cacheRobots(this.robotsCache, robotsUrl, parseRobotsTxt(await response.text())), pageUrl); }
    catch (error) { return { checked: true, allowed: true, warnings: [`robots.txt check failed: ${error instanceof Error ? error.message : String(error)}`] }; }
  }
}
function emptyStaticResult(requestedUrl: string, warnings: string[], failureCategory: StaticWebFailureCategory, startedAt: number, metadata: Record<string, unknown> = {}): AdapterRunResult { return { items: [], discovered: [], warnings, metadata: { adapter: "static_web", requestedUrl, failureCategory, fetchDurationMs: Date.now() - startedAt, ...metadata } }; }
export function extractReadableText(html: string): string { return normalizeWhitespace(html.replace(/<(script|style|noscript|nav|header|footer|form|dialog)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))).replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16))).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")); }
export function extractTitle(html: string): string | undefined { const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); return match?.[1] ? extractReadableText(match[1]) : undefined; }
export function extractLinks(html: string, baseUrl: string): string[] { const links = new Set<string>(); for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)) try { const href = match[1]; if (href && !shouldIgnoreHref(href)) links.add(canonicalizeUrl(new URL(href, baseUrl).toString())); } catch {} return [...links]; }
export function extractCanonicalUrl(html: string, fallbackUrl: string): string { const tag = html.match(/<link\b[^>]*rel=["'][^"']*\bcanonical\b[^"']*["'][^>]*>/i)?.[0], href = tag?.match(/\bhref=["']([^"']+)["']/i)?.[1]; try { return canonicalizeUrl(href ? new URL(href, fallbackUrl).toString() : fallbackUrl); } catch { return canonicalizeUrl(fallbackUrl); } }
export function canonicalizeUrl(value: string): string { const url = new URL(value); url.hash = ""; if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = ""; url.hostname = url.hostname.toLowerCase(); url.pathname = url.pathname.replace(/\/{2,}/g, "/"); const sorted = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)); url.search = ""; for (const [key, valuePart] of sorted) url.searchParams.append(key, valuePart); return url.toString(); }
export function createConditionalHeaders(url: string, cache: AdapterHttpCache): Record<string, string> { const validators = cache.get(canonicalizeUrl(url)); return { ...baseHeaders(), ...(validators?.etag ? { "if-none-match": validators.etag } : {}), ...(validators?.lastModified ? { "if-modified-since": validators.lastModified } : {}) }; }
export function rememberValidators(url: string, response: Response, cache: AdapterHttpCache): void { const etag = response.headers.get("etag") ?? undefined, lastModified = response.headers.get("last-modified") ?? undefined; if (etag || lastModified) cache.set(canonicalizeUrl(url), { etag, lastModified }); }
function baseHeaders(): Record<string, string> { return { "user-agent": "ti-scraper/0.1 public-cti-research" }; }
function httpFailureCategory(status: number): StaticWebFailureCategory { return status === 429 ? "rate_limited" : status === 404 ? "not_found" : "http_error"; }
function statusClass(status: number): string { return `${Math.floor(status / 100)}xx`; }
function retryAfterSeconds(response: Response): number | undefined { const value = response.headers.get("retry-after"); if (!value) return undefined; const seconds = Number.parseInt(value, 10), date = Date.parse(value); return Number.isFinite(seconds) ? seconds : Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : undefined; }
function isSupportedStaticMediaType(value: string | null): boolean { const type = value?.split(";")[0]?.trim().toLowerCase(); return !type || ["text/html", "application/xhtml+xml", "text/plain", "application/xml", "text/xml"].includes(type); }
function byteLength(value: string): number { return new TextEncoder().encode(value).byteLength; }
function shouldIgnoreHref(href: string): boolean { return /^(#|mailto:|tel:|javascript:)/i.test(href.trim()); }
function extractRobotsMeta(html: string): { noindex: boolean; nofollow: boolean } { const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]).filter((tag) => /\bname=["']robots["']/i.test(tag)).map((tag) => tag.match(/\bcontent=["']([^"']+)["']/i)?.[1].toLowerCase() ?? "").join(","); return { noindex: meta.includes("noindex"), nofollow: meta.includes("nofollow") }; }
function extractAnchorTextForHref(html: string, target: string, baseUrl: string): string | undefined { for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) try { if (canonicalizeUrl(new URL(match[1], baseUrl).toString()) === target) return extractReadableText(match[2]); } catch {} }
function robotsUrlFor(pageUrl: string): string | undefined { try { return `${new URL(pageUrl).origin}/robots.txt`; } catch { return undefined; } }
function parseRobotsTxt(text: string): RobotsRules { const disallow: string[] = []; let applies = false; for (const rawLine of text.split(/\r?\n/)) { const line = rawLine.replace(/#.*/, "").trim(); if (!line) continue; const [rawKey, ...rest] = line.split(":"), key = rawKey.trim().toLowerCase(), value = rest.join(":").trim(); if (key === "user-agent") applies = value === "*" || value.toLowerCase().includes("ti-scraper"); if (applies && key === "disallow" && value) disallow.push(value); } return { checked: true, allowed: true, warnings: [], disallow }; }
function applyRobotsRules(rules: RobotsRules, pageUrl: string): RobotsRules { try { const path = new URL(pageUrl).pathname, blocked = rules.disallow?.some((rule) => rule !== "/" ? path.startsWith(rule) : true) ?? false; return { ...rules, allowed: !blocked }; } catch { return rules; } }
function cacheRobots(cache: Map<string, RobotsRules>, url: string, rules: RobotsRules): RobotsRules { cache.set(url, rules); return rules; }
