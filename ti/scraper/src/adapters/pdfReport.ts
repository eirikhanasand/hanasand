import type { AdapterRunResult, CollectionTask, SourceRecord } from "../types.ts";
import { evaluateTaskForCollection } from "../policy/collectionPolicy.ts";
import { hashContent, nowIso, normalizeWhitespace } from "../utils.ts";
import type { CollectionAdapter } from "./base.ts";
import { canonicalizeUrl } from "./staticWeb.ts";
import { adapterPromotionContract, citationSpansForText, parserProfileMetadata, selectParserProfile, type ParserFailureCategory } from "./parserProfiles.ts";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type PdfExtractionInput = { url: string; bytes: Uint8Array; contentType?: string; maxBytes: number };
export type PdfExtractionResult = { text: string; title?: string; canonicalUrl?: string; publishedAt?: string; pageCount?: number; parserWarnings?: string[]; extractionConfidence?: number; language?: string };
export interface PdfReportExtractor { extract(input: PdfExtractionInput): Promise<PdfExtractionResult>; }
export type PdfReportAdapterOptions = { fetcher?: Fetcher; extractor?: PdfReportExtractor; minExtractionConfidence?: number };
export type PdfReportFailureCategory = ParserFailureCategory; export type PdfReportExtractionReadinessDto = any;

export class PdfReportAdapter implements CollectionAdapter {
  readonly type = "pdf" as const; private readonly fetcher: Fetcher; private readonly extractor: PdfReportExtractor; private readonly min: number;
  constructor(options: PdfReportAdapterOptions = {}) { this.fetcher = options.fetcher ?? fetch; this.extractor = options.extractor ?? new PlainTextPdfExtractor(); this.min = options.minExtractionConfidence ?? 0.45; }
  async collect(source: SourceRecord, task?: CollectionTask): Promise<AdapterRunResult> {
    const startedAt = Date.now(), url = task?.targetUrl ?? source.url, profile = selectParserProfile({ sourceType: "pdf", url, contentType: "application/pdf", language: source.language });
    const policy = task ? evaluateTaskForCollection(source, task) : { allowed: true, metadataOnly: false, reason: "manual run" };
    if (!policy.allowed) return empty(source, url, profile, policy.reason.includes("disabled") ? "source_disabled" : "policy_hold", startedAt, [policy.reason]);
    try {
      const response = await this.fetcher(url, { headers: { "user-agent": "ti-scraper/0.1 public-cti-research pdf" } });
      if (response.status === 429) return empty(source, url, profile, "rate_limited", startedAt, ["PDF fetch returned 429"], { responseStatus: response.status, retryAfterSeconds: retryAfterSeconds(response) });
      if (!response.ok) return empty(source, url, profile, "unavailable", startedAt, [`PDF fetch returned ${response.status}`], { responseStatus: response.status });
      const contentType = response.headers.get("content-type") ?? undefined;
      if (!pdfMedia(contentType)) return empty(source, url, profile, "unsupported_media", startedAt, [`unsupported PDF media type ${contentType}`], { responseStatus: response.status, contentType });
      const bytes = new Uint8Array(await response.arrayBuffer()), maxBytes = task?.maxBytes ?? 10_000_000;
      if (bytes.byteLength > maxBytes) return empty(source, url, profile, "content_too_large", startedAt, [`PDF exceeds maxBytes ${maxBytes}`], { responseStatus: response.status, contentType, contentBytes: bytes.byteLength, maxBytes });
      const finalUrl = canonicalizeUrl(response.url || url), extracted = await this.extractor.extract({ url: finalUrl, bytes, contentType, maxBytes }), rawText = normalizeWhitespace(extracted.text);
      const confidence = extracted.extractionConfidence ?? (rawText.length > 120 ? 0.74 : 0.25);
      if (confidence < this.min) return empty(source, url, { ...profile, extractionConfidenceBand: "low" }, "parser_confidence_low", startedAt, ["PDF extraction confidence is low"], { responseStatus: response.status, contentType, contentBytes: bytes.byteLength, extractionConfidence: confidence });
      return ready(source, task, url, finalUrl, canonicalizeUrl(extracted.canonicalUrl ?? finalUrl), response, bytes, extracted, rawText, confidence, profile, startedAt);
    } catch (error) { return empty(source, url, profile, error instanceof Error && /timeout/i.test(error.message) ? "timeout" : "unavailable", startedAt, [error instanceof Error ? error.message : String(error)]); }
  }
}

function ready(source: SourceRecord, task: CollectionTask | undefined, requestedUrl: string, finalUrl: string, canonicalUrl: string, response: Response, bytes: Uint8Array, extracted: PdfExtractionResult, rawText: string, confidence: number, profile: ReturnType<typeof selectParserProfile>, startedAt: number): AdapterRunResult {
  const collectedAt = nowIso(), contentHash = hashContent(rawText || canonicalUrl), warnings = extracted.parserWarnings ?? [];
  const item: any = { tenantId: source.tenantId, sourceId: source.id, taskId: task?.id, url: canonicalUrl, collectedAt, publishedAt: extracted.publishedAt, title: extracted.title, rawText, contentHash, language: extracted.language ?? source.language, links: [], metadata: { adapter: "pdf", sourceType: source.type, requestedUrl, finalUrl, canonicalUrl, responseStatus: response.status, statusClass: `${Math.floor(response.status / 100)}xx`, contentType: response.headers.get("content-type") ?? undefined, contentBytes: bytes.byteLength, pageCount: extracted.pageCount, sourceTrust: source.trustScore, extractionStatus: "ready_for_extraction", extractionConfidence: confidence, ...parserProfileMetadata(confidence >= 0.7 ? profile : { ...profile, extractionConfidenceBand: "medium" }), parserWarnings: warnings, citationSpans: citationSpansForText(rawText), fetchDurationMs: Date.now() - startedAt, provenance: { sourceId: source.id, taskId: task?.id, url: canonicalUrl, collectedAt, contentHash, extractorVersion: "pdf-report-adapter-v1", confidence }, safety: { allowPrivateAccess: false, allowAuthBypass: false, allowCaptchaSolving: false, allowRawRestrictedMaterial: false } }, sensitive: false };
  const result: AdapterRunResult = { items: [item], discovered: [], warnings, metadata: { adapter: "pdf", requestedUrl, finalUrl, canonicalUrl, responseStatus: response.status, contentBytes: bytes.byteLength, parserProfile: profile.profile, fetchDurationMs: Date.now() - startedAt } };
  item.metadata.adapterContract = adapterPromotionContract({ source, result, profile, adapter: "pdf", costClass: "medium" }); (result.metadata as any).adapterContract = item.metadata.adapterContract; return result;
}

export function buildPdfReportExtractionReadiness(input: { source: SourceRecord; result: AdapterRunResult; generatedAt?: string }): PdfReportExtractionReadinessDto {
  const item: any = input.result.items[0], failureCategory = input.result.metadata?.failureCategory as PdfReportFailureCategory | undefined, parserConfidence = num(item?.metadata.extractionConfidence) ?? num(item?.metadata.provenance, "confidence") ?? 0;
  const canonicalUrlHash = item?.url ? `urlhash:${hashContent(item.url).slice(0, 16)}` : undefined, contentHash = item?.contentHash, replayId = item && canonicalUrlHash && contentHash ? productionEvidenceReplayRef({ sourceId: input.source.id, canonicalUrlHash, contentHash, fetchedAt: item.collectedAt }) : undefined;
  const warnings = [...input.result.warnings, ...strings(item?.metadata.parserWarnings), ...strings(item?.metadata.extractionWarnings)], citationSpanCount = Array.isArray(item?.metadata.citationSpans) ? item.metadata.citationSpans.length : 0;
  const status = !item || failureCategory ? "hold" : parserConfidence < 0.7 || citationSpanCount === 0 || warnings.length > 0 ? "watch" : "pass";
  return { schemaVersion: "ti.pdf_report_extraction_readiness.v1", generatedAt: input.generatedAt ?? nowIso(), sourceId: input.source.id, status, ocr: { enabled: false, defaultState: "disabled", canRequestSeparateOperatorApproval: true, reason: "OCR remains disabled by default; text-layer extraction must pass before separate OCR allocation is requested." }, textOnlyProjection: { enabled: true, projectionId: item ? `pdf_text_projection_${hashContent(`${input.source.id}:${contentHash}`).slice(0, 16)}` : undefined, textHash: item?.rawText ? `texthash:${hashContent(item.rawText).slice(0, 16)}` : undefined, language: item?.language ?? input.source.language, citationSpanCount, parserConfidence, extractionWarnings: warnings }, evidenceReplay: { ready: Boolean(replayId), replayId, canonicalUrlHash, contentHash, retentionClass: "public_report" }, gates: { publicOnly: true, legalNotesPresent: Boolean(input.source.legalNotes.trim()), rawPdfBytesExposed: false, rawTextExposed: false, objectKeyExposed: false, ocrVendorCoupled: false }, failureCategory, forbiddenFields: ["url", "canonicalUrl", "rawText", "html", "body", "pdfBytes", "ocrImageBytes", "objectRef", "objectKey", "ocrVendor", "apiKey", "credential", "token", "onionUrl"] };
}

class PlainTextPdfExtractor implements PdfReportExtractor { async extract(input: PdfExtractionInput): Promise<PdfExtractionResult> { const text = new TextDecoder().decode(input.bytes); return { text, canonicalUrl: input.url, extractionConfidence: text.trim().length > 0 ? 0.5 : 0.1, parserWarnings: ["default PDF extractor treats bytes as text; production should inject a real PDF parser"] }; } }
function empty(source: SourceRecord, requestedUrl: string, profile: ReturnType<typeof selectParserProfile>, failureCategory: PdfReportFailureCategory, startedAt: number, warnings: string[], extra: Record<string, unknown> = {}): AdapterRunResult { const result: AdapterRunResult = { items: [], discovered: [], warnings, metadata: { adapter: "pdf", requestedUrl, failureCategory, parserProfile: profile.profile, fetchDurationMs: Date.now() - startedAt, ...extra } }; (result.metadata as any).adapterContract = adapterPromotionContract({ source, result, profile, adapter: "pdf", costClass: "medium" }); return result; }
const pdfMedia = (value?: string) => !value || ["application/pdf", "text/plain"].includes(value.split(";")[0]?.trim().toLowerCase() ?? "");
const retryAfterSeconds = (response: Response) => { const seconds = Number.parseInt(response.headers.get("retry-after") ?? "", 10); return Number.isFinite(seconds) ? seconds : undefined; };
const productionEvidenceReplayRef = (input: { sourceId: string; canonicalUrlHash: string; contentHash: string; fetchedAt: string }) => `evidence_replay_ref:${hashContent(`${input.sourceId}:${input.canonicalUrlHash}:${input.contentHash}:${input.fetchedAt}`).slice(0, 16)}`;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
const num = (value: unknown, key?: string): number | undefined => { const candidate = key && typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : value; return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : undefined; };
