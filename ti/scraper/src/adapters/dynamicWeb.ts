import type { AdapterRunResult, CollectionTask, SourceRecord } from "../types.ts";
import { evaluateTaskForCollection } from "../policy/collectionPolicy.ts";
import { hashContent, nowIso } from "../utils.ts";
import type { CollectionAdapter } from "./base.ts";
import { canonicalizeUrl, extractCanonicalUrl, extractLinks, extractReadableText, extractTitle } from "./staticWeb.ts";
import { adapterPromotionContract, citationSpansForText, parserProfileMetadata, selectParserProfile, type ParserFailureCategory } from "./parserProfiles.ts";

export type DynamicPageRenderInput = { url: string; timeoutMs: number; maxBytes: number; userAgent: string; allowPrivateAccess: false; allowAuthBypass: false; allowCaptchaSolving: false };
export type DynamicPageRenderResult = { status: number; url: string; finalUrl?: string; html?: string; text?: string; title?: string; contentType?: string; publishedAt?: string; redirectChain?: string[]; contentBytes?: number; renderDurationMs?: number; extractionConfidence?: number; robotsAllowed?: boolean; parserWarnings?: string[]; headers?: Record<string, string | undefined> };
export interface DynamicPageRenderer { render(input: DynamicPageRenderInput): Promise<DynamicPageRenderResult>; }
export type DynamicWebAdapterOptions = { renderer: DynamicPageRenderer; timeoutMs?: number; minExtractionConfidence?: number };
export type DynamicCaptureFailureCategory = ParserFailureCategory;

export class DynamicWebAdapter implements CollectionAdapter {
  readonly type = "dynamic_web" as const; private readonly renderer: DynamicPageRenderer; private readonly timeoutMs: number; private readonly min: number;
  constructor(options: DynamicWebAdapterOptions) { this.renderer = options.renderer; this.timeoutMs = options.timeoutMs ?? 15_000; this.min = options.minExtractionConfidence ?? 0.45; }
  async collect(source: SourceRecord, task?: CollectionTask): Promise<AdapterRunResult> {
    const startedAt = Date.now(), url = task?.targetUrl ?? source.url, profile = selectParserProfile({ sourceType: "dynamic_web", url, language: source.language, requiresJavascript: true });
    const policy = task ? evaluateTaskForCollection(source, task) : { allowed: true, metadataOnly: false, reason: "manual run" }, unsafe = unsafeReason(source);
    if (unsafe) return empty(source, url, profile, "policy_hold", startedAt, [unsafe]);
    if (!policy.allowed) return empty(source, url, profile, policy.reason.includes("disabled") ? "source_disabled" : "policy_hold", startedAt, [policy.reason]);
    try { const rendered = await this.renderer.render({ url, timeoutMs: this.timeoutMs, maxBytes: task?.maxBytes ?? 2_000_000, userAgent: "ti-scraper/0.1 public-cti-research dynamic", allowPrivateAccess: false, allowAuthBypass: false, allowCaptchaSolving: false }); return resultFor(source, task, rendered, profile, startedAt, this.min); }
    catch (error) { return empty(source, url, profile, error instanceof Error && /timeout/i.test(error.message) ? "timeout" : "unavailable", startedAt, [error instanceof Error ? error.message : String(error)]); }
  }
}

function resultFor(source: SourceRecord, task: CollectionTask | undefined, rendered: DynamicPageRenderResult, profile: ReturnType<typeof selectParserProfile>, startedAt: number, min: number): AdapterRunResult {
  const requestedUrl = task?.targetUrl ?? source.url, finalUrl = canonicalizeUrl(rendered.finalUrl ?? rendered.url ?? requestedUrl), status = rendered.status;
  if (rendered.robotsAllowed === false) return empty(source, requestedUrl, profile, "robots_policy_hold", startedAt, ["robots policy holds rendered capture"], { responseStatus: status, finalUrl });
  if (status === 429) return empty(source, requestedUrl, profile, "rate_limited", startedAt, ["dynamic page renderer returned 429"], { responseStatus: status, finalUrl });
  if (status === 404 || status >= 500) return empty(source, requestedUrl, profile, "unavailable", startedAt, [`dynamic page renderer returned ${status}`], { responseStatus: status, finalUrl });
  if (!media(rendered.contentType)) return empty(source, requestedUrl, profile, "unsupported_media", startedAt, [`unsupported dynamic media type ${rendered.contentType}`], { responseStatus: status, finalUrl, contentType: rendered.contentType });
  const contentBytes = rendered.contentBytes ?? bytes(rendered.html ?? rendered.text ?? ""), maxBytes = task?.maxBytes ?? 2_000_000;
  if (contentBytes > maxBytes) return empty(source, requestedUrl, profile, "content_too_large", startedAt, [`dynamic page exceeds maxBytes ${maxBytes}`], { responseStatus: status, finalUrl, contentBytes, maxBytes });
  const html = rendered.html, canonicalUrl = html ? extractCanonicalUrl(html, finalUrl) : finalUrl, rawText = rendered.text?.trim() || (html ? extractReadableText(html) : ""), confidence = rendered.extractionConfidence ?? (rawText.length > 80 ? 0.72 : 0.25);
  if (confidence < min) return empty(source, requestedUrl, { ...profile, extractionConfidenceBand: "low" }, "parser_confidence_low", startedAt, ["dynamic page extraction confidence is low"], { responseStatus: status, finalUrl, contentBytes, extractionConfidence: confidence });
  const collectedAt = nowIso(), contentHash = hashContent(rawText || html || canonicalUrl), links = html ? extractLinks(html, canonicalUrl) : [], warnings = rendered.parserWarnings ?? [];
  const item: any = { tenantId: source.tenantId, sourceId: source.id, taskId: task?.id, url: canonicalUrl, collectedAt, publishedAt: rendered.publishedAt, title: rendered.title ?? (html ? extractTitle(html) : undefined), rawText, html, contentHash, language: source.language, links, metadata: { adapter: "dynamic_web", sourceType: source.type, requestedUrl, finalUrl, canonicalUrl, responseStatus: status, statusClass: `${Math.floor(status / 100)}xx`, redirectChain: (rendered.redirectChain ?? []).map(canonicalizeUrl), contentType: rendered.contentType, contentBytes, fetchDurationMs: Date.now() - startedAt, renderDurationMs: rendered.renderDurationMs, sourceTrust: source.trustScore, extractionStatus: "ready_for_extraction", extractionConfidence: confidence, ...parserProfileMetadata(confidence >= 0.7 ? profile : { ...profile, extractionConfidenceBand: "medium" }), parserWarnings: warnings, citationSpans: citationSpansForText(rawText), provenance: { sourceId: source.id, taskId: task?.id, url: canonicalUrl, collectedAt, contentHash, extractorVersion: "dynamic-web-adapter-v1", confidence }, safety: safety() }, sensitive: false };
  const result: AdapterRunResult = { items: [item], discovered: links.map((link) => ({ source, url: link, discoveredAt: collectedAt, parentUrl: canonicalUrl, surroundingText: item.title, parentRelevance: 0.5, novelty: 0.5, freshness: 0.5 })), warnings, metadata: { adapter: "dynamic_web", requestedUrl, finalUrl, canonicalUrl, responseStatus: status, contentBytes, parserProfile: profile.profile, fetchDurationMs: Date.now() - startedAt } };
  item.metadata.adapterContract = adapterPromotionContract({ source, result, profile, adapter: "dynamic_web", costClass: "high" }); (result.metadata as any).adapterContract = item.metadata.adapterContract; return result;
}

function empty(source: SourceRecord, requestedUrl: string, profile: ReturnType<typeof selectParserProfile>, failureCategory: DynamicCaptureFailureCategory, startedAt: number, warnings: string[], extra: Record<string, unknown> = {}): AdapterRunResult { const result: AdapterRunResult = { items: [], discovered: [], warnings, metadata: { adapter: "dynamic_web", requestedUrl, failureCategory, parserProfile: profile.profile, fetchDurationMs: Date.now() - startedAt, safety: safety(), ...extra } }; (result.metadata as any).adapterContract = adapterPromotionContract({ source, result, profile, adapter: "dynamic_web", costClass: "high" }); return result; }
function unsafeReason(source: SourceRecord) { const metadata = source.metadata ?? {}; for (const key of ["requiresLogin", "captchaRequired", "privateAccess", "authBypass", "sessionCookie", "credentialed"]) if (metadata[key]) return `dynamic public capture blocks unsafe source metadata: ${key}`; return undefined; }
const safety = () => ({ allowPrivateAccess: false, allowAuthBypass: false, allowCaptchaSolving: false, allowRawRestrictedMaterial: false });
const media = (contentType?: string) => !contentType || ["text/html", "application/xhtml+xml", "text/plain"].includes(contentType.split(";")[0]?.trim().toLowerCase() ?? "");
const bytes = (value: string) => new TextEncoder().encode(value).byteLength;
