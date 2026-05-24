import type { AdapterRunResult, CollectionTask, SourceRecord } from "../types.ts";
import { evaluateTaskForCollection } from "../policy/collectionPolicy.ts";
import { hashContent, nowIso } from "../utils.ts";
import type { CollectionAdapter } from "./base.ts";
import { canonicalizeUrl, extractCanonicalUrl, extractLinks, extractReadableText, extractTitle } from "./staticWeb.ts";
import {
  adapterPromotionContract,
  citationSpansForText,
  parserProfileMetadata,
  selectParserProfile,
  type ParserFailureCategory
} from "./parserProfiles.ts";

export interface DynamicPageRenderInput {
  url: string;
  timeoutMs: number;
  maxBytes: number;
  userAgent: string;
  allowPrivateAccess: false;
  allowAuthBypass: false;
  allowCaptchaSolving: false;
}

export interface DynamicPageRenderResult {
  status: number;
  url: string;
  finalUrl?: string;
  html?: string;
  text?: string;
  title?: string;
  contentType?: string;
  publishedAt?: string;
  redirectChain?: string[];
  contentBytes?: number;
  renderDurationMs?: number;
  extractionConfidence?: number;
  robotsAllowed?: boolean;
  parserWarnings?: string[];
  headers?: Record<string, string | undefined>;
}

export interface DynamicPageRenderer {
  render(input: DynamicPageRenderInput): Promise<DynamicPageRenderResult>;
}

export interface DynamicWebAdapterOptions {
  renderer: DynamicPageRenderer;
  timeoutMs?: number;
  minExtractionConfidence?: number;
}

export type DynamicCaptureFailureCategory = ParserFailureCategory;

export class DynamicWebAdapter implements CollectionAdapter {
  readonly type = "dynamic_web" as const;
  private readonly renderer: DynamicPageRenderer;
  private readonly timeoutMs: number;
  private readonly minExtractionConfidence: number;

  constructor(options: DynamicWebAdapterOptions) {
    this.renderer = options.renderer;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.minExtractionConfidence = options.minExtractionConfidence ?? 0.45;
  }

  async collect(source: SourceRecord, task?: CollectionTask): Promise<AdapterRunResult> {
    const startedAt = Date.now();
    const url = task?.targetUrl ?? source.url;
    const policy = task
      ? evaluateTaskForCollection(source, task)
      : { allowed: true, metadataOnly: false, reason: "manual run" };
    const profile = selectParserProfile({
      sourceType: "dynamic_web",
      url,
      language: source.language,
      requiresJavascript: true
    });

    const unsafeReason = unsafeDynamicSourceReason(source);
    if (unsafeReason) return emptyDynamicResult(source, url, profile, "policy_hold", startedAt, [unsafeReason]);
    if (!policy.allowed) return emptyDynamicResult(source, url, profile, policy.reason.includes("disabled") ? "source_disabled" : "policy_hold", startedAt, [policy.reason]);

    try {
      const rendered = await this.renderer.render({
        url,
        timeoutMs: this.timeoutMs,
        maxBytes: task?.maxBytes ?? 2_000_000,
        userAgent: "ti-scraper/0.1 public-cti-research dynamic",
        allowPrivateAccess: false,
        allowAuthBypass: false,
        allowCaptchaSolving: false
      });
      return dynamicResultFor(source, task, rendered, profile, startedAt, this.minExtractionConfidence);
    } catch (error) {
      const failureCategory: DynamicCaptureFailureCategory = error instanceof Error && /timeout/i.test(error.message)
        ? "timeout"
        : "unavailable";
      return emptyDynamicResult(source, url, profile, failureCategory, startedAt, [error instanceof Error ? error.message : String(error)]);
    }
  }
}

function dynamicResultFor(
  source: SourceRecord,
  task: CollectionTask | undefined,
  rendered: DynamicPageRenderResult,
  profile: ReturnType<typeof selectParserProfile>,
  startedAt: number,
  minExtractionConfidence: number
): AdapterRunResult {
  const requestedUrl = task?.targetUrl ?? source.url;
  const finalUrl = canonicalizeUrl(rendered.finalUrl ?? rendered.url ?? requestedUrl);
  const responseStatus = rendered.status;
  if (rendered.robotsAllowed === false) return emptyDynamicResult(source, requestedUrl, profile, "robots_policy_hold", startedAt, ["robots policy holds rendered capture"], { responseStatus, finalUrl });
  if (responseStatus === 429) return emptyDynamicResult(source, requestedUrl, profile, "rate_limited", startedAt, ["dynamic page renderer returned 429"], { responseStatus, finalUrl });
  if (responseStatus === 404 || responseStatus >= 500) return emptyDynamicResult(source, requestedUrl, profile, "unavailable", startedAt, [`dynamic page renderer returned ${responseStatus}`], { responseStatus, finalUrl });
  if (!isSupportedDynamicMedia(rendered.contentType)) return emptyDynamicResult(source, requestedUrl, profile, "unsupported_media", startedAt, [`unsupported dynamic media type ${rendered.contentType}`], { responseStatus, finalUrl, contentType: rendered.contentType });

  const contentBytes = rendered.contentBytes ?? byteLength(rendered.html ?? rendered.text ?? "");
  const maxBytes = task?.maxBytes ?? 2_000_000;
  if (contentBytes > maxBytes) return emptyDynamicResult(source, requestedUrl, profile, "content_too_large", startedAt, [`dynamic page exceeds maxBytes ${maxBytes}`], { responseStatus, finalUrl, contentBytes, maxBytes });

  const html = rendered.html;
  const canonicalUrl = html ? extractCanonicalUrl(html, finalUrl) : finalUrl;
  const rawText = rendered.text?.trim() || (html ? extractReadableText(html) : "");
  const confidence = rendered.extractionConfidence ?? (rawText.length > 80 ? 0.72 : 0.25);
  if (confidence < minExtractionConfidence) {
    return emptyDynamicResult(source, requestedUrl, { ...profile, extractionConfidenceBand: "low" }, "parser_confidence_low", startedAt, ["dynamic page extraction confidence is low"], { responseStatus, finalUrl, contentBytes, extractionConfidence: confidence });
  }

  const collectedAt = nowIso();
  const contentHash = hashContent(rawText || html || canonicalUrl);
  const links = html ? extractLinks(html, canonicalUrl) : [];
  const warnings = rendered.parserWarnings ?? [];
  const item = {
    sourceId: source.id,
    taskId: task?.id,
    url: canonicalUrl,
    collectedAt,
    publishedAt: rendered.publishedAt,
    title: rendered.title ?? (html ? extractTitle(html) : undefined),
    rawText,
    html,
    contentHash,
    language: source.language,
    links,
    metadata: {
      adapter: "dynamic_web",
      sourceType: source.type,
      requestedUrl,
      finalUrl,
      canonicalUrl,
      responseStatus,
      statusClass: `${Math.floor(responseStatus / 100)}xx`,
      redirectChain: (rendered.redirectChain ?? []).map(canonicalizeUrl),
      contentType: rendered.contentType,
      contentBytes,
      fetchDurationMs: Date.now() - startedAt,
      renderDurationMs: rendered.renderDurationMs,
      sourceTrust: source.trustScore,
      extractionStatus: "ready_for_extraction",
      extractionConfidence: confidence,
      ...parserProfileMetadata(confidence >= 0.7 ? profile : { ...profile, extractionConfidenceBand: "medium" }),
      parserWarnings: warnings,
      citationSpans: citationSpansForText(rawText),
      provenance: {
        sourceId: source.id,
        taskId: task?.id,
        url: canonicalUrl,
        collectedAt,
        contentHash,
        extractorVersion: "dynamic-web-adapter-v1",
        confidence
      },
      safety: publicOnlySafety()
    },
    sensitive: false
  };
  const result: AdapterRunResult = {
    items: [item],
    discovered: links.map((link) => ({
      source,
      url: link,
      discoveredAt: collectedAt,
      parentUrl: canonicalUrl,
      surroundingText: item.title,
      parentRelevance: 0.5,
      novelty: 0.5,
      freshness: 0.5
    })),
    warnings,
    metadata: {
      adapter: "dynamic_web",
      requestedUrl,
      finalUrl,
      canonicalUrl,
      responseStatus,
      contentBytes,
      parserProfile: profile.profile,
      fetchDurationMs: Date.now() - startedAt
    }
  };
  (item.metadata as Record<string, unknown>)["adapterContract"] = adapterPromotionContract({ source, result, profile, adapter: "dynamic_web", costClass: "high" });
  (result.metadata as Record<string, unknown>)["adapterContract"] = adapterPromotionContract({ source, result, profile, adapter: "dynamic_web", costClass: "high" });
  return result;
}

function emptyDynamicResult(
  source: SourceRecord,
  requestedUrl: string,
  profile: ReturnType<typeof selectParserProfile>,
  failureCategory: DynamicCaptureFailureCategory,
  startedAt: number,
  warnings: string[],
  extra: Record<string, unknown> = {}
): AdapterRunResult {
  const result: AdapterRunResult = {
    items: [],
    discovered: [],
    warnings,
    metadata: {
      adapter: "dynamic_web",
      requestedUrl,
      failureCategory,
      parserProfile: profile.profile,
      fetchDurationMs: Date.now() - startedAt,
      safety: publicOnlySafety(),
      ...extra
    }
  };
  (result.metadata as Record<string, unknown>)["adapterContract"] = adapterPromotionContract({ source, result, profile, adapter: "dynamic_web", costClass: "high" });
  return result;
}

function unsafeDynamicSourceReason(source: SourceRecord): string | undefined {
  const metadata = source.metadata ?? {};
  for (const key of ["requiresLogin", "captchaRequired", "privateAccess", "authBypass", "sessionCookie", "credentialed"]) {
    if (metadata[key]) return `dynamic public capture blocks unsafe source metadata: ${key}`;
  }
  return undefined;
}

function publicOnlySafety(): Record<string, boolean> {
  return {
    allowPrivateAccess: false,
    allowAuthBypass: false,
    allowCaptchaSolving: false,
    allowRawRestrictedMaterial: false
  };
}

function isSupportedDynamicMedia(contentType: string | undefined): boolean {
  if (!contentType) return true;
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();
  return mediaType === "text/html" || mediaType === "application/xhtml+xml" || mediaType === "text/plain";
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
