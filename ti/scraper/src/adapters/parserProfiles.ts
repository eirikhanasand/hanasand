import type { AdapterRunResult, CollectedItem, SourceRecord } from "../types.ts";

export type ParserProfileName =
  | "static_html"
  | "dynamic_page"
  | "pdf_report"
  | "rss_entry"
  | "public_channel_handoff";

export type ParserFailureCategory =
  | "timeout"
  | "robots_policy_hold"
  | "policy_hold"
  | "unsupported_media"
  | "content_too_large"
  | "parser_confidence_low"
  | "duplicate_canonical"
  | "rate_limited"
  | "unavailable"
  | "source_disabled";

export type ParserExtractionConfidenceBand = "high" | "medium" | "low" | "blocked";

export interface ParserProfileDecision {
  profile: ParserProfileName;
  fallbackOrder: ParserProfileName[];
  fallbackReasons: string[];
  reason: string;
  extractionScore: number;
  extractionConfidenceBand: ParserExtractionConfidenceBand;
  languageHint?: string;
  parserVersion: string;
  parserWarnings: string[];
  expectedMediaTypes: string[];
  qualitySignals: {
    parserSpecificity: number;
    contentFitness: number;
    policyFitness: number;
  };
}

export interface ParserProfileInput {
  sourceType: SourceRecord["type"];
  url: string;
  contentType?: string;
  language?: string;
  requiresJavascript?: boolean;
  publicChannelHandoff?: boolean;
  textSample?: string;
  parserWarnings?: string[];
  failureCategory?: ParserFailureCategory;
  contentLengthBytes?: number;
  maxBytes?: number;
}

export interface AdapterPromotionContractDto {
  schemaVersion: "ti.adapter_capture_contract.v1";
  sourceId: string;
  taskId?: string;
  adapter: SourceRecord["type"] | string;
  status: "captured" | "blocked" | "empty";
  canonicalUrl?: string;
  contentHash?: string;
  parserProfile: ParserProfileName;
  parserVersion: string;
  parserWarnings: string[];
  sourceTrust: number;
  extractionStatus: "ready_for_extraction" | "blocked" | "needs_review";
  failureCategory?: ParserFailureCategory;
  agent06: {
    captureReady: boolean;
    canonicalUrl?: string;
    contentHash?: string;
    provenanceRequired: true;
  };
  agent07: {
    parserProfile: ParserProfileName;
    extractionConfidenceBand: ParserProfileDecision["extractionConfidenceBand"];
    languageHint?: string;
    citationSpansAvailable: boolean;
  };
  agent09: {
    apiStatus: "captured" | "blocked" | "searching";
    failureCategory?: ParserFailureCategory;
    retryable: boolean;
  };
  agent10: {
    adapter: SourceRecord["type"] | string;
    costClass: "low" | "medium" | "high";
    dashboardState: "ok" | "watch" | "blocked";
  };
}

export interface Agent07ExtractionHandoffDto {
  schemaVersion: "ti.agent07.extraction_handoff.v1";
  redactionSafe: true;
  sourceId: string;
  taskId?: string;
  canonicalUrl?: string;
  contentHash?: string;
  publishedAt?: string;
  parserProfile: ParserProfileName;
  parserVersion: string;
  extractionScore: number;
  extractionConfidenceBand: ParserExtractionConfidenceBand;
  languageHint?: string;
  citationSpans: Array<{ start: number; end: number; label: string }>;
  parserWarnings: string[];
  fallbackOrder: ParserProfileName[];
  fallbackReasons: string[];
  sourceTrust: number;
  extractionStatus: "ready_for_extraction" | "blocked" | "needs_review";
  blockedReason?: ParserFailureCategory;
  safeSummary?: string;
  forbiddenFields: string[];
}

export function selectParserProfile(input: ParserProfileInput): ParserProfileDecision {
  const contentType = input.contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  const bySource = profileForSource(input.sourceType);
  const profile = input.publicChannelHandoff
    ? "public_channel_handoff"
    : input.requiresJavascript
      ? "dynamic_page"
      : contentType === "application/pdf"
        ? "pdf_report"
        : bySource;
  const qualitySignals = qualitySignalsFor(profile, input);
  const extractionScore = parserExtractionScore(qualitySignals, input);

  return {
    profile,
    fallbackOrder: fallbackOrderFor(profile),
    fallbackReasons: fallbackReasonsFor(profile),
    reason: decisionReason(profile, input.sourceType, contentType, input.requiresJavascript),
    extractionScore,
    extractionConfidenceBand: confidenceBandFor(extractionScore, input.failureCategory),
    languageHint: languageHintFor(input.language, input.textSample),
    parserVersion: "parser-profile-matrix-v1",
    parserWarnings: input.parserWarnings ?? [],
    expectedMediaTypes: expectedMediaTypes(profile),
    qualitySignals
  };
}

export function adapterPromotionContract(input: {
  source: SourceRecord;
  result: AdapterRunResult;
  profile: ParserProfileDecision;
  adapter: SourceRecord["type"] | string;
  costClass: AdapterPromotionContractDto["agent10"]["costClass"];
}): AdapterPromotionContractDto {
  const item = input.result.items[0];
  const failureCategory = stringValue(input.result.metadata?.failureCategory) as ParserFailureCategory | undefined;
  const parserWarnings = [
    ...input.profile.parserWarnings,
    ...input.result.warnings,
    ...arrayStringValue(item?.metadata.parserWarnings)
  ];
  const extractionStatus = failureCategory
    ? "blocked"
    : item && input.profile.extractionConfidenceBand !== "low"
      ? "ready_for_extraction"
      : "needs_review";
  return {
    schemaVersion: "ti.adapter_capture_contract.v1",
    sourceId: input.source.id,
    taskId: item?.taskId,
    adapter: input.adapter,
    status: item ? "captured" : failureCategory ? "blocked" : "empty",
    canonicalUrl: item?.url,
    contentHash: item?.contentHash,
    parserProfile: input.profile.profile,
    parserVersion: input.profile.parserVersion,
    parserWarnings,
    sourceTrust: input.source.trustScore,
    extractionStatus,
    failureCategory,
    agent06: {
      captureReady: Boolean(item),
      canonicalUrl: item?.url,
      contentHash: item?.contentHash,
      provenanceRequired: true
    },
    agent07: {
      parserProfile: input.profile.profile,
      extractionConfidenceBand: input.profile.extractionConfidenceBand,
      languageHint: input.profile.languageHint,
      citationSpansAvailable: Boolean(item?.metadata.citationSpans)
    },
    agent09: {
      apiStatus: item ? "captured" : failureCategory ? "blocked" : "searching",
      failureCategory,
      retryable: failureCategory === "timeout" || failureCategory === "rate_limited" || failureCategory === "unavailable"
    },
    agent10: {
      adapter: input.adapter,
      costClass: input.costClass,
      dashboardState: item ? "ok" : failureCategory ? "blocked" : "watch"
    }
  };
}

export function agent07ExtractionHandoff(input: {
  source: SourceRecord;
  result: AdapterRunResult;
  profile: ParserProfileDecision;
  failureCategory?: ParserFailureCategory;
}): Agent07ExtractionHandoffDto {
  const item = input.result.items[0];
  const failureCategory = input.failureCategory ?? stringValue(input.result.metadata?.failureCategory) as ParserFailureCategory | undefined;
  const parserWarnings = [
    ...input.profile.parserWarnings,
    ...input.result.warnings,
    ...arrayStringValue(item?.metadata.parserWarnings)
  ];
  const extractionStatus = failureCategory
    ? "blocked"
    : item && input.profile.extractionConfidenceBand !== "low"
      ? "ready_for_extraction"
      : "needs_review";
  return {
    schemaVersion: "ti.agent07.extraction_handoff.v1",
    redactionSafe: true,
    sourceId: input.source.id,
    taskId: item?.taskId,
    canonicalUrl: item?.url,
    contentHash: item?.contentHash,
    publishedAt: item?.publishedAt,
    parserProfile: input.profile.profile,
    parserVersion: input.profile.parserVersion,
    extractionScore: input.profile.extractionScore,
    extractionConfidenceBand: failureCategory ? "blocked" : input.profile.extractionConfidenceBand,
    languageHint: input.profile.languageHint,
    citationSpans: citationSpanValue(item?.metadata.citationSpans),
    parserWarnings,
    fallbackOrder: input.profile.fallbackOrder,
    fallbackReasons: input.profile.fallbackReasons,
    sourceTrust: input.source.trustScore,
    extractionStatus,
    blockedReason: failureCategory,
    safeSummary: safeSummaryFor(item?.rawText),
    forbiddenFields: ["rawText", "rawHtml", "html", "body", "payload", "credential", "password", "cookie", "session", "privateInvite"]
  };
}

export function citationSpansForText(text: string): Array<{ start: number; end: number; label: string }> {
  const spans: Array<{ start: number; end: number; label: string }> = [];
  const sentence = text.match(/[^.!?]+[.!?]/);
  if (sentence?.index !== undefined) {
    spans.push({ start: sentence.index, end: sentence.index + sentence[0].length, label: "lead_sentence" });
  }
  return spans;
}

export function parserProfileMetadata(profile: ParserProfileDecision): Record<string, unknown> {
  return {
    parserProfile: profile.profile,
    parserFallbackOrder: profile.fallbackOrder,
    parserFallbackReasons: profile.fallbackReasons,
    parserVersion: profile.parserVersion,
    parserWarnings: profile.parserWarnings,
    extractionScore: profile.extractionScore,
    extractionConfidenceBand: profile.extractionConfidenceBand,
    languageHint: profile.languageHint,
    parserQualitySignals: profile.qualitySignals
  };
}

function profileForSource(sourceType: SourceRecord["type"]): ParserProfileName {
  if (sourceType === "dynamic_web") return "dynamic_page";
  if (sourceType === "pdf") return "pdf_report";
  if (sourceType === "rss") return "rss_entry";
  if (sourceType === "telegram_public") return "public_channel_handoff";
  return "static_html";
}

function fallbackOrderFor(profile: ParserProfileName): ParserProfileName[] {
  if (profile === "dynamic_page") return ["dynamic_page", "static_html"];
  if (profile === "pdf_report") return ["pdf_report", "static_html"];
  if (profile === "rss_entry") return ["rss_entry", "static_html"];
  if (profile === "public_channel_handoff") return ["public_channel_handoff", "static_html"];
  return ["static_html"];
}

function fallbackReasonsFor(profile: ParserProfileName): string[] {
  if (profile === "dynamic_page") return ["rendered DOM first", "fall back to static HTML when rendered text is empty or renderer is unavailable"];
  if (profile === "pdf_report") return ["structured PDF/report extraction first", "fall back to static HTML for landing pages or converted report text"];
  if (profile === "rss_entry") return ["feed item metadata first", "fall back to linked static article for full body extraction"];
  if (profile === "public_channel_handoff") return ["public-channel normalized evidence first", "fall back to static linked references when citation URLs are available"];
  return ["static HTML readability extraction"];
}

function expectedMediaTypes(profile: ParserProfileName): string[] {
  if (profile === "pdf_report") return ["application/pdf"];
  if (profile === "rss_entry") return ["application/rss+xml", "application/atom+xml", "application/xml", "text/xml"];
  if (profile === "public_channel_handoff") return ["application/json", "text/plain"];
  return ["text/html", "application/xhtml+xml", "text/plain"];
}

function decisionReason(
  profile: ParserProfileName,
  sourceType: SourceRecord["type"],
  contentType: string,
  requiresJavascript: boolean | undefined
): string {
  if (requiresJavascript) return "source or handoff requires rendered JavaScript capture";
  if (contentType === "application/pdf") return "response media type is PDF";
  return `selected ${profile} for ${sourceType}`;
}

function qualitySignalsFor(profile: ParserProfileName, input: ParserProfileInput): ParserProfileDecision["qualitySignals"] {
  const contentType = input.contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  const expected = expectedMediaTypes(profile);
  const mediaMatch = !contentType || expected.includes(contentType) || (profile === "static_html" && contentType === "text/plain");
  const textLength = input.textSample?.trim().length ?? 0;
  const tooLarge = input.maxBytes !== undefined && input.contentLengthBytes !== undefined && input.contentLengthBytes > input.maxBytes;
  return {
    parserSpecificity: profile === "static_html" ? 0.72 : profile === "public_channel_handoff" ? 0.78 : 0.9,
    contentFitness: tooLarge ? 0.1 : mediaMatch ? textFitness(textLength) : 0.35,
    policyFitness: input.failureCategory === "policy_hold" || input.failureCategory === "robots_policy_hold" || input.failureCategory === "source_disabled" ? 0 : 1
  };
}

function parserExtractionScore(signals: ParserProfileDecision["qualitySignals"], input: ParserProfileInput): number {
  if (input.failureCategory) return 0;
  const warningPenalty = Math.min((input.parserWarnings?.length ?? 0) * 0.06, 0.24);
  return clamp01((signals.parserSpecificity * 0.35) + (signals.contentFitness * 0.45) + (signals.policyFitness * 0.2) - warningPenalty);
}

function textFitness(textLength: number): number {
  if (textLength === 0) return 0.72;
  if (textLength < 24) return 0.35;
  if (textLength < 120) return 0.68;
  return 0.95;
}

function confidenceBandFor(score: number, failureCategory?: ParserFailureCategory): ParserExtractionConfidenceBand {
  if (failureCategory) return "blocked";
  if (score >= 0.82) return "high";
  if (score >= 0.58) return "medium";
  return "low";
}

function languageHintFor(language: string | undefined, textSample: string | undefined): string | undefined {
  if (language) return language;
  if (!textSample) return undefined;
  if (/\b(der|die|das|und|nicht|bericht)\b/i.test(textSample)) return "de";
  if (/\b(le|la|les|rapport|attaque)\b/i.test(textSample)) return "fr";
  return "en";
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function arrayStringValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function citationSpanValue(value: unknown): Array<{ start: number; end: number; label: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter((span): span is { start: number; end: number; label: string } => {
    if (!span || typeof span !== "object") return false;
    const record = span as Record<string, unknown>;
    return typeof record.start === "number" && typeof record.end === "number" && typeof record.label === "string";
  });
}

function safeSummaryFor(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return text.replace(/\s+/g, " ").trim().slice(0, 280);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}
