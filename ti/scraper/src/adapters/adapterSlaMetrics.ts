import { round, uniq } from "./adapterSlaUtils.ts";

export function metricsFor(observations: any[], translations: any[], thresholds: any) {
  const failed = observations.filter((o) => o.outcome !== "ok");
  const confidences = observations.map((o) => o.diagnostics.parserConfidence).filter((n) => n !== undefined);
  return {
    observationCount: observations.length + translations.length,
    failureRatio: round(observations.length ? failed.length / observations.length : 0),
    minParserConfidenceObserved: confidences.length ? Math.min(...confidences) : undefined,
    extractionWarningCount: observations.reduce((n, o) => n + o.diagnostics.extractionWarnings.length, 0) + translations.reduce((n, h) => n + h.extraction.parserWarnings.length, 0),
    unsupportedMimeCount: observations.filter((o) => o.diagnostics.unsupportedMime).length,
    timeoutCount: observations.filter((o) => o.diagnostics.timeout).length,
    rateLimitedCount: observations.filter((o) => o.diagnostics.rateLimited).length,
    unavailableCount: observations.filter((o) => o.diagnostics.unavailable).length,
    staleCount: observations.filter((o) => Boolean(o.staleDate)).length,
    duplicateCanonicalCount: observations.filter((o) => o.diagnostics.duplicateCanonical).length,
    translationNeededCount: translations.filter((h) => h.language.translationNeeded).length,
    languageDriftCount: translations.filter((h) => h.language.confidence < thresholds.minLanguageConfidence || h.language.mixedLanguage).length,
    canonicalUrlHashes: uniq([...observations.flatMap((o) => o.canonicalUrlHash ? [o.canonicalUrlHash] : []), ...translations.map((h) => h.canonicalUrlHash)])
  };
}

export function breachesFor(m: any, t: any) {
  const b: any[] = [], add = (code: string, severity: string, count: number, threshold: number, message: string) => { if (count > threshold) b.push({ code, severity, count, threshold, message }); };
  add("failure_ratio_high", "hold", m.failureRatio, t.maxFailureRatio, "adapter failure ratio exceeds release SLA");
  if (m.minParserConfidenceObserved !== undefined && m.minParserConfidenceObserved < t.minParserConfidence) b.push({ code: "parser_confidence_low", severity: "hold", count: m.minParserConfidenceObserved, threshold: t.minParserConfidence, message: "minimum parser confidence is below promotion threshold" });
  add("extraction_warnings_high", "warn", m.extractionWarningCount, t.maxExtractionWarnings, "extraction warning count exceeds repair threshold");
  add("unsupported_mime", "hold", m.unsupportedMimeCount, 0, "unsupported media types require parser or source repair");
  add("timeout", "warn", m.timeoutCount, 0, "timeouts require scheduler backoff or dynamic-render repair");
  add("rate_limited", "warn", m.rateLimitedCount, t.maxRateLimitedCount, "rate-limit count exceeds scheduler SLA");
  add("unavailable", "hold", m.unavailableCount, 0, "unavailable sources hold adapter promotion");
  add("stale_dates", "warn", m.staleCount, t.maxStaleCount, "stale publication or collection dates require cadence review");
  add("duplicate_canonical", "warn", m.duplicateCanonicalCount, t.maxDuplicateCanonicalCount, "duplicate canonical keys require evidence suppression");
  add("language_detection_drift", "warn", m.languageDriftCount, 0, "language detection drift requires multilingual fallback review");
  return b;
}
