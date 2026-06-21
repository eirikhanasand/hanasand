import { safety } from "./adapterSlaConfig.ts";
import { hash } from "./adapterSlaUtils.ts";

export function observationRepairs(generatedAt: string, observation: any) {
  return repairCategories(observation).map((category) => repair({ generatedAt, sourceId: observation.sourceId, adapter: adapterFor(observation.sourceFamily), sourceFamily: observation.sourceFamily, parserProfile: observation.parserProfile, category, canonicalUrlHash: observation.canonicalUrlHash, parserVersion: observation.parserVersion, retryAfterSeconds: observation.retryAfterSeconds, warnings: observation.diagnostics.extractionWarnings }));
}

export function translationRepairs(generatedAt: string, handoff: any, thresholds: any) {
  if (handoff.language.confidence >= thresholds.minLanguageConfidence && !handoff.language.mixedLanguage && handoff.extraction.adjustedParserConfidence >= thresholds.minParserConfidence) return [];
  return [repair({ generatedAt, sourceId: handoff.sourceId, adapter: "multilingual_handoff", sourceFamily: "multilingual_handoff", parserProfile: "translation_handoff", category: "language_detection_drift", canonicalUrlHash: handoff.canonicalUrlHash, parserVersion: handoff.parserVersion, warnings: handoff.extraction.parserWarnings })];
}

function repair(input: any) {
  const prio = priority(input.category), action = schedulerAction(input.category);
  return { schemaVersion: "ti.adapter_parser_repair.v1", generatedAt: input.generatedAt, repairId: `repair:${hash(`${input.generatedAt}:${input.sourceId}:${input.category}:${input.canonicalUrlHash ?? ""}`)}`, sourceId: input.sourceId, adapter: input.adapter, sourceFamily: input.sourceFamily, parserProfile: input.parserProfile, category: input.category, priority: prio, reason: `${reason(input.category)}${input.warnings.find((w: string) => w.trim()) ? ` (${input.warnings.find((w: string) => w.trim())})` : ""}`, canonicalUrlHash: input.canonicalUrlHash, fixtureKey: `fixture:${hash(`${input.adapter}:${input.sourceId}:${input.parserVersion}:${input.category}`)}`, evidence: { contentHashOnly: true, replayRequired: input.category !== "scheduler_backoff", duplicateSuppression: input.category === "evidence_duplicate_suppression", rawContentRequired: false }, scheduler: { action, retryAfterSeconds: input.retryAfterSeconds, reason: schedulerReason(input.category) }, agentHandoffs: handoffs(input.category, prio, action), safety: safety() };
}

function repairCategories(o: any) {
  const cats = new Set<string>();
  if (o.failureClass === "parser_gap") cats.add("parser_fixture_gap");
  if (o.failureClass === "parser_confidence_low") cats.add(o.sourceFamily === "static_html" ? "readability_failure" : "parser_fixture_gap");
  if (o.diagnostics.extractionWarnings.some((w: string) => /selector/i.test(w))) cats.add("selector_failure");
  if (o.diagnostics.extractionWarnings.some((w: string) => /readability|empty text|boilerplate/i.test(w))) cats.add("readability_failure");
  if (o.sourceFamily === "pdf_report" && ["empty_capture", "parser_confidence_low"].includes(o.failureClass)) cats.add("pdf_extraction_failure");
  if (o.sourceFamily === "dynamic_page" && ["timeout", "empty_capture"].includes(o.failureClass)) cats.add("dynamic_render_failure");
  if (o.diagnostics.unsupportedMime) cats.add("unsupported_mime_repair");
  if (o.diagnostics.rateLimited || o.diagnostics.timeout || o.diagnostics.unavailable) cats.add("scheduler_backoff");
  if (o.diagnostics.duplicateCanonical) cats.add("evidence_duplicate_suppression");
  return [...cats];
}

const adapterFor = (f: string) => f === "rss_feed" ? "rss_feed" : f === "dynamic_page" ? "dynamic_public_browser" : f === "pdf_report" ? "pdf_report" : f === "public_channel" ? "public_channel_handoff" : f === "advisory_signal" ? "advisory_signal" : "static_html";
const priority = (c: string) => ["parser_fixture_gap", "dynamic_render_failure", "pdf_extraction_failure", "unsupported_mime_repair"].includes(c) ? "high" : ["readability_failure", "selector_failure", "language_detection_drift"].includes(c) ? "medium" : "low";
const schedulerAction = (c: string) => c === "scheduler_backoff" ? "retry_after" : c === "evidence_duplicate_suppression" ? "reduce_cadence" : ["dynamic_render_failure", "unsupported_mime_repair"].includes(c) ? "pause_source" : "none";
const schedulerReason = (c: string) => c === "scheduler_backoff" ? "honor retry-after/backoff before next public collection attempt" : c === "evidence_duplicate_suppression" ? "reduce duplicate canonical scheduling pressure" : c === "dynamic_render_failure" ? "pause dynamic render canary until bounded repair proof passes" : c === "unsupported_mime_repair" ? "pause source until adapter media support or source target is corrected" : "parser repair does not require scheduler mutation";
const reason = (c: string) => ({ parser_fixture_gap: "add or update parser fixture coverage for this public adapter", selector_failure: "repair selector assumptions before extraction promotion", readability_failure: "repair readability extraction before claim promotion", pdf_extraction_failure: "repair PDF/report extraction fixture and citation spans", language_detection_drift: "review multilingual fallback and language detection confidence", dynamic_render_failure: "repair bounded public dynamic-render plan with browser workers still disabled by default", unsupported_mime_repair: "repair source target or parser media support for unsupported MIME", scheduler_backoff: "honor public-source backoff for timeout/rate-limit/unavailable state", evidence_duplicate_suppression: "suppress duplicate canonical evidence before replay promotion" } as Record<string, string>)[c];
function handoffs(category: string, prio: string, action: string) {
  return { agent01SourceGovernance: ["parser_fixture_gap", "unsupported_mime_repair"].includes(category) ? "hold_activation_until_parser_support" : "no_source_mutation", agent02SchedulerBackoff: action === "none" ? "no_scheduler_change" : `${action}_until_repair_or_retry_after`, agent04SourceCorrelationConfidence: category === "evidence_duplicate_suppression" ? "suppress_duplicate_correlation" : prio === "high" ? "lower_source_correlation_confidence" : "preserve_correlation_with_warning", agent06EvidenceReplay: category === "evidence_duplicate_suppression" ? "suppress_duplicate_canonical_hash" : category === "scheduler_backoff" ? "no_replay_required" : "replay_hash_only_after_parser_repair", agent07ExtractionQuality: category === "language_detection_drift" ? "review_multilingual_fallback" : "repair_parser_fixture_or_selector", agent09ApiWarningCode: `adapter_repair.${category}`, agent10Runbook: prio === "high" ? "adapter_sla_release_hold" : "adapter_sla_watch" };
}
