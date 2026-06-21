// @ts-nocheck
import { hashContent } from "../utils.ts";

export type AdapterSlaAdapterKind =
  | "static_html" | "rss_feed" | "dynamic_public_browser" | "pdf_report"
  | "public_channel_handoff" | "advisory_signal" | "multilingual_handoff";
export type AdapterRepairCategory =
  | "parser_fixture_gap" | "selector_failure" | "readability_failure"
  | "pdf_extraction_failure" | "language_detection_drift" | "dynamic_render_failure"
  | "unsupported_mime_repair" | "scheduler_backoff" | "evidence_duplicate_suppression";
export type AdapterSlaSeverity = "pass" | "warn" | "hold";
export type AdapterSlaRepairInput = any;
export type AdapterSlaContractDto = any;
export type AdapterSlaBreachDto = any;
export type AdapterParserRepairPacketDto = any;
export type AdapterSlaRepairPacketDto = any;

const THRESHOLDS = { minParserConfidence: 0.62, maxExtractionWarnings: 2, maxFailureRatio: 0.25, maxDuplicateCanonicalCount: 0, maxStaleCount: 0, maxRateLimitedCount: 1, minLanguageConfidence: 0.7 };
const CONFIGS = [
  ["static_html", "static_html", "static_html", true, false],
  ["rss_feed", "rss_feed", "rss_entry", true, false],
  ["dynamic_public_browser", "dynamic_page", "dynamic_page", false, true],
  ["pdf_report", "pdf_report", "pdf_report", false, true],
  ["public_channel_handoff", "public_channel", "public_channel_handoff", false, true],
  ["advisory_signal", "advisory_signal", "static_html", true, false],
  ["multilingual_handoff", "multilingual_handoff", "translation_handoff", false, true]
];
const FORBIDDEN = ["url", "canonicalUrl", "rawText", "translatedText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "screenshotBytes", "downloadUrl"];

export function buildAdapterSlaRepairPacket(input: AdapterSlaRepairInput): AdapterSlaRepairPacketDto {
  const thresholds = { ...THRESHOLDS, ...(input.thresholds ?? {}) };
  const contracts = CONFIGS.map((config) => contractFor(config, input, thresholds));
  const repairs = dedupe([
    ...(input.observations ?? []).flatMap((observation) => observationRepairs(input.generatedAt, observation)),
    ...(input.translationHandoffs ?? []).flatMap((handoff) => translationRepairs(input.generatedAt, handoff, thresholds))
  ]);
  const counts = { pass: contracts.filter((c) => c.status === "pass").length, warn: contracts.filter((c) => c.status === "warn").length, hold: contracts.filter((c) => c.status === "hold").length };
  const canonicalUrlHashes = uniq([...contracts.flatMap((c) => c.metrics.canonicalUrlHashes), ...repairs.flatMap((r) => r.canonicalUrlHash ? [r.canonicalUrlHash] : [])]);
  return {
    schemaVersion: "ti.adapter_sla_repair_packet.v1", generatedAt: input.generatedAt,
    readyForPromotion: counts.hold === 0 && repairs.every((r) => r.priority !== "high"),
    contracts, repairs,
    summary: { contracts: contracts.length, ...counts, repairs: repairs.length, repairCategories: countBy(repairs.map((r) => r.category)), sourceIds: uniq(repairs.map((r) => r.sourceId)), canonicalUrlHashes, agentHandoffs: { agent01: uniq(repairs.map((r) => r.agentHandoffs.agent01SourceGovernance)), agent02: uniq(repairs.map((r) => r.agentHandoffs.agent02SchedulerBackoff)), agent04: uniq(repairs.map((r) => r.agentHandoffs.agent04SourceCorrelationConfidence)), agent06: uniq(repairs.map((r) => r.agentHandoffs.agent06EvidenceReplay)), agent07: uniq(repairs.map((r) => r.agentHandoffs.agent07ExtractionQuality)), agent09: uniq(repairs.map((r) => r.agentHandoffs.agent09ApiWarningCode)), agent10: uniq(repairs.map((r) => r.agentHandoffs.agent10Runbook)) } },
    routeContract: { safeForPublicApi: true, stableFields: ["schemaVersion", "generatedAt", "readyForPromotion", "contracts", "repairs", "summary", "routeContract", "safety"], forbiddenFields: FORBIDDEN, compactApiProof: { noRawUrls: true, noRawText: true, noHtml: true, noPrivateAccess: true, dynamicBrowserDisabledByDefault: true, repairPacketsAreDryRun: true } },
    safety: safety()
  };
}

function contractFor([adapter, sourceFamily, parserProfile, enabledByDefault, canaryOnly], input, thresholds) {
  const observations = (input.observations ?? []).filter((o) => o.sourceFamily === sourceFamily);
  const translations = adapter === "multilingual_handoff" ? input.translationHandoffs ?? [] : [];
  const metrics = metricsFor(observations, translations, thresholds);
  const breaches = breachesFor(metrics, thresholds);
  const status = breaches.some((b) => b.severity === "hold") ? "hold" : breaches.length ? "warn" : "pass";
  return { schemaVersion: "ti.adapter_sla_contract.v1", generatedAt: input.generatedAt, adapter, sourceFamily, parserProfile, enabledByDefault: enabledByDefault && status !== "hold", canaryOnly: canaryOnly || status !== "pass", browserWorkersEnabled: false, metrics, thresholds, status, breaches, handoffs: contractHandoffs(status, breaches, adapter) };
}
function metricsFor(observations, translations, thresholds) {
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
function observationRepairs(generatedAt, observation) {
  return repairCategories(observation).map((category) => repair({ generatedAt, sourceId: observation.sourceId, adapter: adapterFor(observation.sourceFamily), sourceFamily: observation.sourceFamily, parserProfile: observation.parserProfile, category, canonicalUrlHash: observation.canonicalUrlHash, parserVersion: observation.parserVersion, retryAfterSeconds: observation.retryAfterSeconds, warnings: observation.diagnostics.extractionWarnings }));
}
function translationRepairs(generatedAt, handoff, thresholds) {
  if (handoff.language.confidence >= thresholds.minLanguageConfidence && !handoff.language.mixedLanguage && handoff.extraction.adjustedParserConfidence >= thresholds.minParserConfidence) return [];
  return [repair({ generatedAt, sourceId: handoff.sourceId, adapter: "multilingual_handoff", sourceFamily: "multilingual_handoff", parserProfile: "translation_handoff", category: "language_detection_drift", canonicalUrlHash: handoff.canonicalUrlHash, parserVersion: handoff.parserVersion, warnings: handoff.extraction.parserWarnings })];
}
function repair(input) {
  const prio = priority(input.category), action = schedulerAction(input.category);
  return { schemaVersion: "ti.adapter_parser_repair.v1", generatedAt: input.generatedAt, repairId: `repair:${hash(`${input.generatedAt}:${input.sourceId}:${input.category}:${input.canonicalUrlHash ?? ""}`)}`, sourceId: input.sourceId, adapter: input.adapter, sourceFamily: input.sourceFamily, parserProfile: input.parserProfile, category: input.category, priority: prio, reason: `${reason(input.category)}${input.warnings.find((w) => w.trim()) ? ` (${input.warnings.find((w) => w.trim())})` : ""}`, canonicalUrlHash: input.canonicalUrlHash, fixtureKey: `fixture:${hash(`${input.adapter}:${input.sourceId}:${input.parserVersion}:${input.category}`)}`, evidence: { contentHashOnly: true, replayRequired: input.category !== "scheduler_backoff", duplicateSuppression: input.category === "evidence_duplicate_suppression", rawContentRequired: false }, scheduler: { action, retryAfterSeconds: input.retryAfterSeconds, reason: schedulerReason(input.category) }, agentHandoffs: { agent01SourceGovernance: ["parser_fixture_gap", "unsupported_mime_repair"].includes(input.category) ? "hold_activation_until_parser_support" : "no_source_mutation", agent02SchedulerBackoff: action === "none" ? "no_scheduler_change" : `${action}_until_repair_or_retry_after`, agent04SourceCorrelationConfidence: input.category === "evidence_duplicate_suppression" ? "suppress_duplicate_correlation" : prio === "high" ? "lower_source_correlation_confidence" : "preserve_correlation_with_warning", agent06EvidenceReplay: input.category === "evidence_duplicate_suppression" ? "suppress_duplicate_canonical_hash" : input.category === "scheduler_backoff" ? "no_replay_required" : "replay_hash_only_after_parser_repair", agent07ExtractionQuality: input.category === "language_detection_drift" ? "review_multilingual_fallback" : "repair_parser_fixture_or_selector", agent09ApiWarningCode: `adapter_repair.${input.category}`, agent10Runbook: prio === "high" ? "adapter_sla_release_hold" : "adapter_sla_watch" }, safety: safety() };
}
function repairCategories(o) {
  const cats = new Set();
  if (o.failureClass === "parser_gap") cats.add("parser_fixture_gap");
  if (o.failureClass === "parser_confidence_low") cats.add(o.sourceFamily === "static_html" ? "readability_failure" : "parser_fixture_gap");
  if (o.diagnostics.extractionWarnings.some((w) => /selector/i.test(w))) cats.add("selector_failure");
  if (o.diagnostics.extractionWarnings.some((w) => /readability|empty text|boilerplate/i.test(w))) cats.add("readability_failure");
  if (o.sourceFamily === "pdf_report" && ["empty_capture", "parser_confidence_low"].includes(o.failureClass)) cats.add("pdf_extraction_failure");
  if (o.sourceFamily === "dynamic_page" && ["timeout", "empty_capture"].includes(o.failureClass)) cats.add("dynamic_render_failure");
  if (o.diagnostics.unsupportedMime) cats.add("unsupported_mime_repair");
  if (o.diagnostics.rateLimited || o.diagnostics.timeout || o.diagnostics.unavailable) cats.add("scheduler_backoff");
  if (o.diagnostics.duplicateCanonical) cats.add("evidence_duplicate_suppression");
  return [...cats];
}
function breachesFor(m, t) {
  const b = [], add = (code, severity, count, threshold, message) => { if (count > threshold) b.push({ code, severity, count, threshold, message }); };
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
function contractHandoffs(status, breaches, adapter) {
  const has = (codes) => breaches.some((b) => codes.includes(b.code));
  return { agent01SourceGovernance: status === "hold" ? "hold_activation" : status === "warn" ? "review_source" : "none", agent02Scheduler: has(["rate_limited", "timeout", "stale_dates"]) ? status === "hold" ? "pause_or_reduce" : "backoff" : "normal", agent04CorrelationConfidence: status === "hold" ? "hold_correlation" : status === "warn" ? "lower_confidence" : "none", agent06EvidenceReplay: has(["duplicate_canonical"]) ? "suppress_duplicates" : has(["parser_confidence_low", "unsupported_mime", "extraction_warnings_high", "language_detection_drift"]) ? "replay_after_parser_repair" : "none", agent07ExtractionQuality: has(["parser_confidence_low", "unsupported_mime", "extraction_warnings_high", "language_detection_drift"]) ? status === "hold" ? "hold_extraction" : "repair_parser" : "accept", agent09ApiFields: status === "hold" ? "show_hold_codes" : status === "warn" ? "show_warning_codes" : "stable", agent10Runbooks: status === "hold" || adapter === "dynamic_public_browser" && has(["parser_confidence_low", "unsupported_mime", "extraction_warnings_high", "language_detection_drift"]) ? "release_hold" : status === "warn" ? "watch" : "green" };
}
function adapterFor(family) { return family === "rss_feed" ? "rss_feed" : family === "dynamic_page" ? "dynamic_public_browser" : family === "pdf_report" ? "pdf_report" : family === "public_channel" ? "public_channel_handoff" : family === "advisory_signal" ? "advisory_signal" : "static_html"; }
function priority(c) { return ["parser_fixture_gap", "dynamic_render_failure", "pdf_extraction_failure", "unsupported_mime_repair"].includes(c) ? "high" : ["readability_failure", "selector_failure", "language_detection_drift"].includes(c) ? "medium" : "low"; }
function schedulerAction(c) { return c === "scheduler_backoff" ? "retry_after" : c === "evidence_duplicate_suppression" ? "reduce_cadence" : ["dynamic_render_failure", "unsupported_mime_repair"].includes(c) ? "pause_source" : "none"; }
function schedulerReason(c) { return c === "scheduler_backoff" ? "honor retry-after/backoff before next public collection attempt" : c === "evidence_duplicate_suppression" ? "reduce duplicate canonical scheduling pressure" : c === "dynamic_render_failure" ? "pause dynamic render canary until bounded repair proof passes" : c === "unsupported_mime_repair" ? "pause source until adapter media support or source target is corrected" : "parser repair does not require scheduler mutation"; }
function reason(c) { return ({ parser_fixture_gap: "add or update parser fixture coverage for this public adapter", selector_failure: "repair selector assumptions before extraction promotion", readability_failure: "repair readability extraction before claim promotion", pdf_extraction_failure: "repair PDF/report extraction fixture and citation spans", language_detection_drift: "review multilingual fallback and language detection confidence", dynamic_render_failure: "repair bounded public dynamic-render plan with browser workers still disabled by default", unsupported_mime_repair: "repair source target or parser media support for unsupported MIME", scheduler_backoff: "honor public-source backoff for timeout/rate-limit/unavailable state", evidence_duplicate_suppression: "suppress duplicate canonical evidence before replay promotion" })[c]; }
function dedupe(repairs) { const seen = new Set(); return repairs.filter((r) => { const key = `${r.sourceId}:${r.category}:${r.canonicalUrlHash ?? ""}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function countBy(values) { return values.reduce((out, value) => ({ ...out, [value]: (out[value] ?? 0) + 1 }), {}); }
function uniq(values) { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
function round(value) { return Math.round(value * 1000) / 1000; }
function hash(value) { return hashContent(value).slice(0, 16); }
function safety() { return { publicOnly: true, noAuthBypass: true, noCaptchaSolving: true, noPrivateCommunities: true, noExploitPayloadDownload: true, noRestrictedRawMaterial: true, unsafeUrlExposed: false, dryRunOnly: true }; }
