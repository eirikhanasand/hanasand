import type { AdapterRunResult, CollectionTask, SourceRecord } from "../types.ts";
import { evaluateTaskForCollection } from "../policy/collectionPolicy.ts";
import { hashContent, nowIso, normalizeWhitespace } from "../utils.ts";
import type { CollectionAdapter } from "./base.ts";
import { canonicalizeUrl } from "./staticWeb.ts";
import {
  adapterPromotionContract,
  citationSpansForText,
  parserProfileMetadata,
  selectParserProfile,
  type ParserFailureCategory
} from "./parserProfiles.ts";
import { productionEvidenceReplayRef } from "./productionAdapterRuntime.ts";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface PdfExtractionInput {
  url: string;
  bytes: Uint8Array;
  contentType?: string;
  maxBytes: number;
}

export interface PdfExtractionResult {
  text: string;
  title?: string;
  canonicalUrl?: string;
  publishedAt?: string;
  pageCount?: number;
  parserWarnings?: string[];
  extractionConfidence?: number;
  language?: string;
}

export interface PdfReportExtractor {
  extract(input: PdfExtractionInput): Promise<PdfExtractionResult>;
}

export interface PdfReportAdapterOptions {
  fetcher?: Fetcher;
  extractor?: PdfReportExtractor;
  minExtractionConfidence?: number;
}

export type PdfReportFailureCategory = ParserFailureCategory;

export interface PdfReportExtractionReadinessDto {
  schemaVersion: "ti.pdf_report_extraction_readiness.v1";
  generatedAt: string;
  sourceId: string;
  status: "pass" | "watch" | "hold";
  ocr: {
    enabled: false;
    defaultState: "disabled";
    canRequestSeparateOperatorApproval: true;
    reason: string;
  };
  textOnlyProjection: {
    enabled: true;
    projectionId?: string;
    textHash?: string;
    language?: string;
    citationSpanCount: number;
    parserConfidence: number;
    extractionWarnings: string[];
  };
  evidenceReplay: {
    ready: boolean;
    replayId?: string;
    canonicalUrlHash?: string;
    contentHash?: string;
    retentionClass: "public_report";
  };
  gates: {
    publicOnly: true;
    legalNotesPresent: boolean;
    rawPdfBytesExposed: false;
    rawTextExposed: false;
    objectKeyExposed: false;
    ocrVendorCoupled: false;
  };
  failureCategory?: PdfReportFailureCategory;
  forbiddenFields: string[];
}

export class PdfReportAdapter implements CollectionAdapter {
  readonly type = "pdf" as const;
  private readonly fetcher: Fetcher;
  private readonly extractor: PdfReportExtractor;
  private readonly minExtractionConfidence: number;

  constructor(options: PdfReportAdapterOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.extractor = options.extractor ?? new PlainTextPdfExtractor();
    this.minExtractionConfidence = options.minExtractionConfidence ?? 0.45;
  }

  async collect(source: SourceRecord, task?: CollectionTask): Promise<AdapterRunResult> {
    const startedAt = Date.now();
    const url = task?.targetUrl ?? source.url;
    const profile = selectParserProfile({ sourceType: "pdf", url, contentType: "application/pdf", language: source.language });
    const policy = task
      ? evaluateTaskForCollection(source, task)
      : { allowed: true, metadataOnly: false, reason: "manual run" };
    if (!policy.allowed) return emptyPdfResult(source, url, profile, policy.reason.includes("disabled") ? "source_disabled" : "policy_hold", startedAt, [policy.reason]);

    try {
      const response = await this.fetcher(url, { headers: { "user-agent": "ti-scraper/0.1 public-cti-research pdf" } });
      if (response.status === 429) return emptyPdfResult(source, url, profile, "rate_limited", startedAt, ["PDF fetch returned 429"], { responseStatus: response.status, retryAfterSeconds: retryAfterSeconds(response) });
      if (!response.ok) return emptyPdfResult(source, url, profile, "unavailable", startedAt, [`PDF fetch returned ${response.status}`], { responseStatus: response.status });

      const contentType = response.headers.get("content-type") ?? undefined;
      if (!isSupportedPdfMedia(contentType)) return emptyPdfResult(source, url, profile, "unsupported_media", startedAt, [`unsupported PDF media type ${contentType}`], { responseStatus: response.status, contentType });

      const bytes = new Uint8Array(await response.arrayBuffer());
      const maxBytes = task?.maxBytes ?? 10_000_000;
      if (bytes.byteLength > maxBytes) return emptyPdfResult(source, url, profile, "content_too_large", startedAt, [`PDF exceeds maxBytes ${maxBytes}`], { responseStatus: response.status, contentType, contentBytes: bytes.byteLength, maxBytes });

      const finalUrl = canonicalizeUrl(response.url || url);
      const extracted = await this.extractor.extract({ url: finalUrl, bytes, contentType, maxBytes });
      const rawText = normalizeWhitespace(extracted.text);
      const confidence = extracted.extractionConfidence ?? (rawText.length > 120 ? 0.74 : 0.25);
      if (confidence < this.minExtractionConfidence) {
        return emptyPdfResult(source, url, { ...profile, extractionConfidenceBand: "low" }, "parser_confidence_low", startedAt, ["PDF extraction confidence is low"], { responseStatus: response.status, contentType, contentBytes: bytes.byteLength, extractionConfidence: confidence });
      }

      const canonicalUrl = canonicalizeUrl(extracted.canonicalUrl ?? finalUrl);
      const collectedAt = nowIso();
      const contentHash = hashContent(rawText || canonicalUrl);
      const warnings = extracted.parserWarnings ?? [];
      const item = {
        sourceId: source.id,
        taskId: task?.id,
        url: canonicalUrl,
        collectedAt,
        publishedAt: extracted.publishedAt,
        title: extracted.title,
        rawText,
        contentHash,
        language: extracted.language ?? source.language,
        links: [],
        metadata: {
          adapter: "pdf",
          sourceType: source.type,
          requestedUrl: url,
          finalUrl,
          canonicalUrl,
          responseStatus: response.status,
          statusClass: `${Math.floor(response.status / 100)}xx`,
          contentType,
          contentBytes: bytes.byteLength,
          pageCount: extracted.pageCount,
          sourceTrust: source.trustScore,
          extractionStatus: "ready_for_extraction",
          extractionConfidence: confidence,
          ...parserProfileMetadata(confidence >= 0.7 ? profile : { ...profile, extractionConfidenceBand: "medium" }),
          parserWarnings: warnings,
          citationSpans: citationSpansForText(rawText),
          fetchDurationMs: Date.now() - startedAt,
          provenance: {
            sourceId: source.id,
            taskId: task?.id,
            url: canonicalUrl,
            collectedAt,
            contentHash,
            extractorVersion: "pdf-report-adapter-v1",
            confidence
          },
          safety: {
            allowPrivateAccess: false,
            allowAuthBypass: false,
            allowCaptchaSolving: false,
            allowRawRestrictedMaterial: false
          }
        },
        sensitive: false
      };
      const result: AdapterRunResult = {
        items: [item],
        discovered: [],
        warnings,
        metadata: {
          adapter: "pdf",
          requestedUrl: url,
          finalUrl,
          canonicalUrl,
          responseStatus: response.status,
          contentBytes: bytes.byteLength,
          parserProfile: profile.profile,
          fetchDurationMs: Date.now() - startedAt
        }
      };
      (item.metadata as Record<string, unknown>)["adapterContract"] = adapterPromotionContract({ source, result, profile, adapter: "pdf", costClass: "medium" });
      (result.metadata as Record<string, unknown>)["adapterContract"] = adapterPromotionContract({ source, result, profile, adapter: "pdf", costClass: "medium" });
      return result;
    } catch (error) {
      const failureCategory: PdfReportFailureCategory = error instanceof Error && /timeout/i.test(error.message)
        ? "timeout"
        : "unavailable";
      return emptyPdfResult(source, url, profile, failureCategory, startedAt, [error instanceof Error ? error.message : String(error)]);
    }
  }
}

export function buildPdfReportExtractionReadiness(input: {
  source: SourceRecord;
  result: AdapterRunResult;
  generatedAt?: string;
}): PdfReportExtractionReadinessDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const item = input.result.items[0];
  const failureCategory = input.result.metadata?.failureCategory as PdfReportFailureCategory | undefined;
  const parserConfidence = numberValue(item?.metadata.extractionConfidence) ?? numberValue(item?.metadata.provenance, "confidence") ?? 0;
  const canonicalUrlHash = item?.url ? `urlhash:${hashContent(item.url).slice(0, 16)}` : undefined;
  const contentHash = item?.contentHash;
  const replayId = item && canonicalUrlHash && contentHash
    ? productionEvidenceReplayRef({ sourceId: input.source.id, canonicalUrlHash, contentHash, fetchedAt: item.collectedAt })
    : undefined;
  const warnings = [
    ...input.result.warnings,
    ...arrayStrings(item?.metadata.parserWarnings),
    ...arrayStrings(item?.metadata.extractionWarnings)
  ];
  const citationSpanCount = Array.isArray(item?.metadata.citationSpans) ? item.metadata.citationSpans.length : 0;
  const status: PdfReportExtractionReadinessDto["status"] = !item || failureCategory
    ? "hold"
    : parserConfidence < 0.7 || citationSpanCount === 0 || warnings.length > 0
      ? "watch"
      : "pass";

  return {
    schemaVersion: "ti.pdf_report_extraction_readiness.v1",
    generatedAt,
    sourceId: input.source.id,
    status,
    ocr: {
      enabled: false,
      defaultState: "disabled",
      canRequestSeparateOperatorApproval: true,
      reason: "OCR remains disabled by default; text-layer extraction must pass before separate OCR allocation is requested."
    },
    textOnlyProjection: {
      enabled: true,
      projectionId: item ? `pdf_text_projection_${hashContent(`${input.source.id}:${contentHash}`).slice(0, 16)}` : undefined,
      textHash: item?.rawText ? `texthash:${hashContent(item.rawText).slice(0, 16)}` : undefined,
      language: item?.language ?? input.source.language,
      citationSpanCount,
      parserConfidence,
      extractionWarnings: warnings
    },
    evidenceReplay: {
      ready: Boolean(replayId),
      replayId,
      canonicalUrlHash,
      contentHash,
      retentionClass: "public_report"
    },
    gates: {
      publicOnly: true,
      legalNotesPresent: Boolean(input.source.legalNotes.trim()),
      rawPdfBytesExposed: false,
      rawTextExposed: false,
      objectKeyExposed: false,
      ocrVendorCoupled: false
    },
    failureCategory,
    forbiddenFields: ["url", "canonicalUrl", "rawText", "html", "body", "pdfBytes", "ocrImageBytes", "objectRef", "objectKey", "ocrVendor", "apiKey", "credential", "token", "onionUrl"]
  };
}

class PlainTextPdfExtractor implements PdfReportExtractor {
  async extract(input: PdfExtractionInput): Promise<PdfExtractionResult> {
    const text = new TextDecoder().decode(input.bytes);
    return {
      text,
      canonicalUrl: input.url,
      extractionConfidence: text.trim().length > 0 ? 0.5 : 0.1,
      parserWarnings: ["default PDF extractor treats bytes as text; production should inject a real PDF parser"]
    };
  }
}

function emptyPdfResult(
  source: SourceRecord,
  requestedUrl: string,
  profile: ReturnType<typeof selectParserProfile>,
  failureCategory: PdfReportFailureCategory,
  startedAt: number,
  warnings: string[],
  extra: Record<string, unknown> = {}
): AdapterRunResult {
  const result: AdapterRunResult = {
    items: [],
    discovered: [],
    warnings,
    metadata: {
      adapter: "pdf",
      requestedUrl,
      failureCategory,
      parserProfile: profile.profile,
      fetchDurationMs: Date.now() - startedAt,
      ...extra
    }
  };
  (result.metadata as Record<string, unknown>)["adapterContract"] = adapterPromotionContract({ source, result, profile, adapter: "pdf", costClass: "medium" });
  return result;
}

function isSupportedPdfMedia(value: string | undefined): boolean {
  if (!value) return true;
  const mediaType = value.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/pdf" || mediaType === "text/plain";
}

function retryAfterSeconds(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number.parseInt(value, 10);
  return Number.isFinite(seconds) ? seconds : undefined;
}

function arrayStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function numberValue(value: unknown, key?: string): number | undefined {
  const candidate = key && typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : value;
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : undefined;
}
