import type { AdapterObservatorySourceFamily } from "./adapterFailureObservatory.ts";
import { citationSpansForText, type ParserProfileDecision, type ParserProfileName } from "./parserProfiles.ts";
import type { CollectedItem, SourceRecord } from "../types.ts";
import { hashContent } from "../utils.ts";

export type PublicReportLanguageCode = "en" | "nb" | "ru" | "zh" | "fa" | "es" | "mixed" | "unknown";

export interface MultilingualPublicReportInput {
  generatedAt: string;
  source: SourceRecord;
  item: CollectedItem;
  sourceFamily: AdapterObservatorySourceFamily;
  parserProfile: ParserProfileDecision;
  targetLanguage?: "en";
  declaredLanguage?: string;
  requestedLanguage?: string;
}

export interface TranslationHandoffPacketDto {
  schemaVersion: "ti.translation_handoff.v1";
  generatedAt: string;
  sourceId: string;
  taskId?: string;
  sourceFamily: AdapterObservatorySourceFamily;
  parserProfile: ParserProfileName;
  parserVersion: string;
  contentHash: string;
  canonicalUrlHash: string;
  language: {
    declared?: string;
    detected: PublicReportLanguageCode;
    original: PublicReportLanguageCode;
    target: "en";
    requested?: string;
    confidence: number;
    mixedLanguage: boolean;
    translationNeeded: boolean;
    detectionSignals: string[];
  };
  citationSpans: Array<{ start: number; end: number; label: string; sourceLanguage: PublicReportLanguageCode; targetLanguage: "en" }>;
  extraction: {
    originalParserConfidence: number;
    adjustedParserConfidence: number;
    confidenceImpact: "none" | "minor" | "moderate" | "major";
    fallbackOrder: ParserProfileName[];
    parserWarnings: string[];
  };
  sourceLanguageScoring: {
    sourceLanguageFit: number;
    requestedLanguageFit: number;
    translationPriority: "none" | "normal" | "high";
    sourceScoringNotes: string[];
  };
  handoffs: {
    agent01SourceScoring: "no_action" | "language_boost" | "language_review";
    agent04CoverageGaps: "covered" | "translation_gap" | "mixed_language_gap";
    agent06EvidenceRetention: "retain_original_language_metadata" | "retain_translation_metadata_only";
    agent07Quality: "accept" | "review_translation" | "block_low_confidence";
    agent09ApiContracts: "stable_multilingual_fields";
    agent10Observability: "ok" | "watch_language_gap";
  };
  routeContract: {
    safeForPublicApi: true;
    stableFields: string[];
    forbiddenFields: string[];
  };
  safety: {
    publicOnly: true;
    noTranslationVendorCoupling: true;
    rawTextExposed: false;
    translatedTextExposed: false;
    unsafeUrlExposed: false;
  };
}

export interface MultilingualParserConfidenceBenchmarkInput {
  generatedAt: string;
  packets: TranslationHandoffPacketDto[];
  thresholds?: {
    minAdjustedParserConfidence?: number;
    minCitationSpanCoverage?: number;
    maxHighPriorityTranslationRatio?: number;
    maxMixedLanguageRatio?: number;
  };
}

export interface MultilingualParserConfidenceBenchmarkDto {
  schemaVersion: "ti.multilingual_parser_confidence_benchmark.v1";
  generatedAt: string;
  status: "pass" | "watch" | "hold";
  thresholds: {
    minAdjustedParserConfidence: number;
    minCitationSpanCoverage: number;
    maxHighPriorityTranslationRatio: number;
    maxMixedLanguageRatio: number;
  };
  summary: {
    packetCount: number;
    languagesCovered: PublicReportLanguageCode[];
    translationNeededCount: number;
    mixedLanguageCount: number;
    highPriorityTranslationCount: number;
    reviewTranslationCount: number;
    blockedLowConfidenceCount: number;
    averageDetectionConfidence: number;
    averageAdjustedParserConfidence: number;
    citationSpanCoverage: number;
  };
  rows: Array<{
    language: PublicReportLanguageCode;
    packetCount: number;
    packetRefs: string[];
    translationNeededCount: number;
    mixedLanguageCount: number;
    highPriorityTranslationCount: number;
    reviewTranslationCount: number;
    blockedLowConfidenceCount: number;
    averageDetectionConfidence: number;
    averageAdjustedParserConfidence: number;
    minimumAdjustedParserConfidence: number;
    citationSpanCoverage: number;
    status: "pass" | "watch" | "hold";
    blockers: string[];
    warnings: string[];
  }>;
  handoffs: {
    agent01SourceScoring: string[];
    agent04CoverageGaps: string[];
    agent06EvidenceRetention: string[];
    agent07Quality: string[];
    agent09ApiContracts: "stable_multilingual_benchmark_fields";
    agent10Release: "green" | "watch" | "hold";
  };
  routeContract: {
    safeForPublicApi: true;
    stableFields: string[];
    forbiddenFields: string[];
  };
  safety: {
    publicOnly: true;
    rawTextExposed: false;
    translatedTextExposed: false;
    unsafeUrlExposed: false;
    vendorCoupling: false;
  };
}

export function buildTranslationHandoffPacket(input: MultilingualPublicReportInput): TranslationHandoffPacketDto {
  const declared = normalizedLanguage(input.declaredLanguage ?? input.item.language ?? input.source.language);
  const detectedResult = detectPublicReportLanguage(input.item.rawText, declared);
  const original = declared && declared !== "unknown" ? declared : detectedResult.language;
  const target = input.targetLanguage ?? "en";
  const translationNeeded = original !== "en" || detectedResult.language === "mixed";
  const citationSpans = citationSpanValue(input.item.metadata.citationSpans);
  const normalizedSpans = (citationSpans.length ? citationSpans : citationSpansForText(input.item.rawText))
    .map((span) => ({
      start: span.start,
      end: span.end,
      label: span.label,
      sourceLanguage: original,
      targetLanguage: target
    }));
  const adjustedParserConfidence = adjustedConfidence(input.parserProfile.extractionScore, detectedResult.language, translationNeeded, normalizedSpans.length);
  const confidenceImpact = confidenceImpactFor(input.parserProfile.extractionScore, adjustedParserConfidence);
  const requested = normalizedLanguage(input.requestedLanguage);
  const requestedLanguageFit = requested ? languageFit(requested, original, detectedResult.language) : 1;
  const sourceLanguageFit = languageFit(original, detectedResult.language, detectedResult.language);
  const translationPriority = !translationNeeded ? "none" : confidenceImpact === "major" || detectedResult.language === "mixed" ? "high" : "normal";
  const quality = adjustedParserConfidence < 0.45 ? "block_low_confidence" : translationNeeded ? "review_translation" : "accept";

  return {
    schemaVersion: "ti.translation_handoff.v1",
    generatedAt: input.generatedAt,
    sourceId: input.source.id,
    taskId: input.item.taskId,
    sourceFamily: input.sourceFamily,
    parserProfile: input.parserProfile.profile,
    parserVersion: input.parserProfile.parserVersion,
    contentHash: input.item.contentHash,
    canonicalUrlHash: `urlhash:${hashContent(input.item.url).slice(0, 16)}`,
    language: {
      ...(declared ? { declared } : {}),
      detected: detectedResult.language,
      original,
      target,
      ...(requested ? { requested } : {}),
      confidence: detectedResult.confidence,
      mixedLanguage: detectedResult.language === "mixed",
      translationNeeded,
      detectionSignals: detectedResult.signals
    },
    citationSpans: normalizedSpans,
    extraction: {
      originalParserConfidence: input.parserProfile.extractionScore,
      adjustedParserConfidence,
      confidenceImpact,
      fallbackOrder: input.parserProfile.fallbackOrder,
      parserWarnings: [
        ...input.parserProfile.parserWarnings,
        ...(translationNeeded ? [`translation handoff required for ${original}->${target}`] : []),
        ...(detectedResult.language === "mixed" ? ["mixed-language public report requires analyst review after translation"] : [])
      ]
    },
    sourceLanguageScoring: {
      sourceLanguageFit,
      requestedLanguageFit,
      translationPriority,
      sourceScoringNotes: sourceScoringNotes(original, requested, detectedResult.language, translationNeeded)
    },
    handoffs: {
      agent01SourceScoring: sourceLanguageFit >= 0.9 && !translationNeeded ? "language_boost" : translationNeeded ? "language_review" : "no_action",
      agent04CoverageGaps: detectedResult.language === "mixed" ? "mixed_language_gap" : translationNeeded ? "translation_gap" : "covered",
      agent06EvidenceRetention: translationNeeded ? "retain_translation_metadata_only" : "retain_original_language_metadata",
      agent07Quality: quality,
      agent09ApiContracts: "stable_multilingual_fields",
      agent10Observability: translationNeeded || requestedLanguageFit < 0.7 ? "watch_language_gap" : "ok"
    },
    routeContract: {
      safeForPublicApi: true,
      stableFields: ["schemaVersion", "generatedAt", "sourceId", "sourceFamily", "parserProfile", "contentHash", "canonicalUrlHash", "language", "citationSpans", "extraction", "sourceLanguageScoring", "handoffs", "routeContract", "safety"],
      forbiddenFields: ["url", "canonicalUrl", "rawText", "translatedText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "translationVendor", "apiKey"]
    },
    safety: {
      publicOnly: true,
      noTranslationVendorCoupling: true,
      rawTextExposed: false,
      translatedTextExposed: false,
      unsafeUrlExposed: false
    }
  };
}

export function buildMultilingualParserConfidenceBenchmark(input: MultilingualParserConfidenceBenchmarkInput): MultilingualParserConfidenceBenchmarkDto {
  const thresholds = {
    minAdjustedParserConfidence: input.thresholds?.minAdjustedParserConfidence ?? 0.62,
    minCitationSpanCoverage: input.thresholds?.minCitationSpanCoverage ?? 0.8,
    maxHighPriorityTranslationRatio: input.thresholds?.maxHighPriorityTranslationRatio ?? 0.35,
    maxMixedLanguageRatio: input.thresholds?.maxMixedLanguageRatio ?? 0.2
  };
  const rows = languageRows(input.packets, thresholds);
  const status = worstStatus(rows.map((row) => row.status));
  const translationNeededCount = input.packets.filter((packet) => packet.language.translationNeeded).length;
  const mixedLanguageCount = input.packets.filter((packet) => packet.language.mixedLanguage).length;
  const highPriorityTranslationCount = input.packets.filter((packet) => packet.sourceLanguageScoring.translationPriority === "high").length;
  const reviewTranslationCount = input.packets.filter((packet) => packet.handoffs.agent07Quality === "review_translation").length;
  const blockedLowConfidenceCount = input.packets.filter((packet) => packet.handoffs.agent07Quality === "block_low_confidence").length;

  return {
    schemaVersion: "ti.multilingual_parser_confidence_benchmark.v1",
    generatedAt: input.generatedAt,
    status,
    thresholds,
    summary: {
      packetCount: input.packets.length,
      languagesCovered: uniqueLanguages(input.packets.map((packet) => packet.language.original)),
      translationNeededCount,
      mixedLanguageCount,
      highPriorityTranslationCount,
      reviewTranslationCount,
      blockedLowConfidenceCount,
      averageDetectionConfidence: average(input.packets.map((packet) => packet.language.confidence)),
      averageAdjustedParserConfidence: average(input.packets.map((packet) => packet.extraction.adjustedParserConfidence)),
      citationSpanCoverage: ratio(input.packets.filter((packet) => packet.citationSpans.length > 0).length, input.packets.length)
    },
    rows,
    handoffs: {
      agent01SourceScoring: uniqueStrings(rows.flatMap((row) => row.status === "pass" ? [`language_benchmark_pass:${row.language}`] : [`language_benchmark_${row.status}:${row.language}`])),
      agent04CoverageGaps: uniqueStrings(rows.filter((row) => row.status !== "pass").map((row) => `translation_coverage_${row.status}:${row.language}`)),
      agent06EvidenceRetention: ["retain_original_language_metadata", "retain_translation_metadata_only"],
      agent07Quality: uniqueStrings(rows.map((row) => row.status === "hold" ? `hold_low_confidence_language:${row.language}` : row.status === "watch" ? `review_language_quality:${row.language}` : `accept_language_quality:${row.language}`)),
      agent09ApiContracts: "stable_multilingual_benchmark_fields",
      agent10Release: status === "pass" ? "green" : status
    },
    routeContract: {
      safeForPublicApi: true,
      stableFields: ["schemaVersion", "generatedAt", "status", "thresholds", "summary", "rows", "handoffs", "routeContract", "safety"],
      forbiddenFields: ["url", "canonicalUrl", "rawText", "translatedText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "translationVendor", "apiKey"]
    },
    safety: {
      publicOnly: true,
      rawTextExposed: false,
      translatedTextExposed: false,
      unsafeUrlExposed: false,
      vendorCoupling: false
    }
  };
}

interface LanguageDetectionResult {
  language: PublicReportLanguageCode;
  confidence: number;
  signals: string[];
}

export function detectPublicReportLanguage(text: string, declared?: PublicReportLanguageCode): LanguageDetectionResult {
  const signals: Array<{ language: PublicReportLanguageCode; signal: string; weight: number }> = [];
  const normalized = text.toLowerCase();
  if (/[а-яё]/i.test(text)) signals.push({ language: "ru", signal: "cyrillic", weight: 0.95 });
  if (/[\u4e00-\u9fff]/u.test(text)) signals.push({ language: "zh", signal: "han_script", weight: 0.95 });
  if (/[\u0600-\u06ff]/u.test(text)) signals.push({ language: "fa", signal: "persian_arabic_script", weight: 0.95 });
  if (/\b(?:trusselaktør|sårbarhet|angrep|etterretning|skadevare|løsepengevirus)\b/i.test(text)) signals.push({ language: "nb", signal: "norwegian_cti_terms", weight: 0.78 });
  if (/\b(?:amenaza|vulnerabilidad|ataque|campaña|infraestructura|indicadores)\b/i.test(normalized)) signals.push({ language: "es", signal: "spanish_cti_terms", weight: 0.78 });
  if (/\b(?:threat|vulnerability|attack|malware|campaign|infrastructure|indicators|advisory)\b/i.test(normalized)) signals.push({ language: "en", signal: "english_cti_terms", weight: 0.74 });
  if (declared && declared !== "unknown") signals.push({ language: declared, signal: `declared:${declared}`, weight: 0.65 });
  if (signals.length === 0) return { language: declared ?? "unknown", confidence: declared && declared !== "unknown" ? 0.58 : 0.2, signals: declared ? [`declared:${declared}`] : ["no_language_signal"] };

  const scores = new Map<PublicReportLanguageCode, number>();
  for (const signal of signals) scores.set(signal.language, (scores.get(signal.language) ?? 0) + signal.weight);
  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1]);
  const strongLanguages = ranked.filter(([, score]) => score >= 0.7).map(([language]) => language).filter((language) => language !== "unknown");
  if (strongLanguages.length >= 2) {
    return { language: "mixed", confidence: 0.76, signals: signals.map((signal) => signal.signal) };
  }
  const [language, score] = ranked[0] ?? ["unknown", 0.2];
  return {
    language,
    confidence: Math.min(0.98, Math.max(0.35, score)),
    signals: signals.map((signal) => signal.signal)
  };
}

function normalizedLanguage(value: string | undefined): PublicReportLanguageCode | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "no" || normalized === "nn" || normalized === "nb-nb") return "nb";
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("nb") || normalized.startsWith("no") || normalized.startsWith("nn")) return "nb";
  if (normalized.startsWith("ru")) return "ru";
  if (normalized.startsWith("zh") || normalized.startsWith("cn")) return "zh";
  if (normalized.startsWith("fa") || normalized.startsWith("per")) return "fa";
  if (normalized.startsWith("es")) return "es";
  if (normalized === "mixed") return "mixed";
  return "unknown";
}

function adjustedConfidence(score: number, language: PublicReportLanguageCode, translationNeeded: boolean, citationSpanCount: number): number {
  const translationPenalty = translationNeeded ? 0.08 : 0;
  const mixedPenalty = language === "mixed" ? 0.08 : 0;
  const spanPenalty = citationSpanCount === 0 ? 0.12 : 0;
  return roundScore(Math.max(0, Math.min(1, score - translationPenalty - mixedPenalty - spanPenalty)));
}

function confidenceImpactFor(original: number, adjusted: number): TranslationHandoffPacketDto["extraction"]["confidenceImpact"] {
  const delta = original - adjusted;
  if (delta <= 0.02) return "none";
  if (delta <= 0.08) return "minor";
  if (delta <= 0.16) return "moderate";
  return "major";
}

function languageFit(requested: PublicReportLanguageCode, original: PublicReportLanguageCode, detected: PublicReportLanguageCode): number {
  if (requested === "unknown" || requested === "mixed") return 0.5;
  if (requested === original || requested === detected) return 1;
  if (detected === "mixed") return 0.65;
  return 0.35;
}

function sourceScoringNotes(
  original: PublicReportLanguageCode,
  requested: PublicReportLanguageCode | undefined,
  detected: PublicReportLanguageCode,
  translationNeeded: boolean
): string[] {
  return [
    `original_language:${original}`,
    `detected_language:${detected}`,
    ...(requested ? [`requested_language:${requested}`] : []),
    ...(translationNeeded ? ["translation_needed_without_vendor_coupling"] : ["source_language_matches_target"]),
    ...(detected === "mixed" ? ["mixed_language_requires_quality_review"] : [])
  ];
}

function citationSpanValue(value: unknown): Array<{ start: number; end: number; label: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { start: number; end: number; label: string } => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Record<string, unknown>;
    return typeof candidate.start === "number" && typeof candidate.end === "number" && typeof candidate.label === "string";
  });
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function languageRows(
  packets: TranslationHandoffPacketDto[],
  thresholds: MultilingualParserConfidenceBenchmarkDto["thresholds"]
): MultilingualParserConfidenceBenchmarkDto["rows"] {
  const groups = new Map<PublicReportLanguageCode, TranslationHandoffPacketDto[]>();
  for (const packet of packets) {
    const language = packet.language.original;
    groups.set(language, [...groups.get(language) ?? [], packet]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([language, languagePackets]) => {
      const adjustedScores = languagePackets.map((packet) => packet.extraction.adjustedParserConfidence);
      const translationNeededCount = languagePackets.filter((packet) => packet.language.translationNeeded).length;
      const mixedLanguageCount = languagePackets.filter((packet) => packet.language.mixedLanguage).length;
      const highPriorityTranslationCount = languagePackets.filter((packet) => packet.sourceLanguageScoring.translationPriority === "high").length;
      const reviewTranslationCount = languagePackets.filter((packet) => packet.handoffs.agent07Quality === "review_translation").length;
      const blockedLowConfidenceCount = languagePackets.filter((packet) => packet.handoffs.agent07Quality === "block_low_confidence").length;
      const averageAdjustedParserConfidence = average(adjustedScores);
      const minimumAdjustedParserConfidence = adjustedScores.length ? roundScore(Math.min(...adjustedScores)) : 0;
      const citationSpanCoverage = ratio(languagePackets.filter((packet) => packet.citationSpans.length > 0).length, languagePackets.length);
      const highPriorityRatio = ratio(highPriorityTranslationCount, languagePackets.length);
      const mixedLanguageRatio = ratio(mixedLanguageCount, languagePackets.length);
      const blockers = uniqueStrings([
        ...(blockedLowConfidenceCount > 0 ? ["low_confidence_translation_block"] : []),
        ...(minimumAdjustedParserConfidence < 0.45 ? ["minimum_adjusted_confidence_below_hold_threshold"] : []),
        ...(citationSpanCoverage < 0.5 ? ["citation_span_coverage_below_hold_threshold"] : [])
      ]);
      const warnings = uniqueStrings([
        ...(averageAdjustedParserConfidence < thresholds.minAdjustedParserConfidence ? ["average_adjusted_confidence_below_target"] : []),
        ...(citationSpanCoverage < thresholds.minCitationSpanCoverage ? ["citation_span_coverage_below_target"] : []),
        ...(highPriorityRatio > thresholds.maxHighPriorityTranslationRatio ? ["high_priority_translation_ratio_above_target"] : []),
        ...(mixedLanguageRatio > thresholds.maxMixedLanguageRatio ? ["mixed_language_ratio_above_target"] : [])
      ]);
      const status = blockers.length > 0 ? "hold" : warnings.length > 0 ? "watch" : "pass";

      return {
        language,
        packetCount: languagePackets.length,
        packetRefs: languagePackets.map(packetRef).sort((left, right) => left.localeCompare(right)),
        translationNeededCount,
        mixedLanguageCount,
        highPriorityTranslationCount,
        reviewTranslationCount,
        blockedLowConfidenceCount,
        averageDetectionConfidence: average(languagePackets.map((packet) => packet.language.confidence)),
        averageAdjustedParserConfidence,
        minimumAdjustedParserConfidence,
        citationSpanCoverage,
        status,
        blockers,
        warnings
      };
    });
}

function packetRef(packet: TranslationHandoffPacketDto): string {
  return `translation_ref:${hashContent(`${packet.sourceId}:${packet.contentHash}:${packet.canonicalUrlHash}`).slice(0, 16)}`;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return roundScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function ratio(count: number, total: number): number {
  if (total === 0) return 0;
  return roundScore(count / total);
}

function worstStatus(statuses: Array<"pass" | "watch" | "hold">): "pass" | "watch" | "hold" {
  if (statuses.includes("hold")) return "hold";
  if (statuses.includes("watch")) return "watch";
  return "pass";
}

function uniqueLanguages(values: PublicReportLanguageCode[]): PublicReportLanguageCode[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
