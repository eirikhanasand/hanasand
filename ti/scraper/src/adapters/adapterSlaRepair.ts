import type { AdapterFailureObservationDto, AdapterObservatorySourceFamily } from "./adapterFailureObservatory.ts";
import type { ParserProfileName } from "./parserProfiles.ts";
import type { TranslationHandoffPacketDto } from "./multilingualReportHandoff.ts";
import { hashContent } from "../utils.ts";

export type AdapterSlaAdapterKind =
  | "static_html"
  | "rss_feed"
  | "dynamic_public_browser"
  | "pdf_report"
  | "public_channel_handoff"
  | "advisory_signal"
  | "multilingual_handoff";

export type AdapterRepairCategory =
  | "parser_fixture_gap"
  | "selector_failure"
  | "readability_failure"
  | "pdf_extraction_failure"
  | "language_detection_drift"
  | "dynamic_render_failure"
  | "unsupported_mime_repair"
  | "scheduler_backoff"
  | "evidence_duplicate_suppression";

export type AdapterSlaSeverity = "pass" | "warn" | "hold";

export interface AdapterSlaThresholds {
  minParserConfidence: number;
  maxExtractionWarnings: number;
  maxFailureRatio: number;
  maxDuplicateCanonicalCount: number;
  maxStaleCount: number;
  maxRateLimitedCount: number;
  minLanguageConfidence: number;
}

export interface AdapterSlaRepairInput {
  generatedAt: string;
  observations: AdapterFailureObservationDto[];
  translationHandoffs?: TranslationHandoffPacketDto[];
  thresholds?: Partial<AdapterSlaThresholds>;
}

export interface AdapterSlaContractDto {
  schemaVersion: "ti.adapter_sla_contract.v1";
  generatedAt: string;
  adapter: AdapterSlaAdapterKind;
  sourceFamily: AdapterObservatorySourceFamily | "multilingual_handoff";
  parserProfile: ParserProfileName | "translation_handoff";
  enabledByDefault: boolean;
  canaryOnly: boolean;
  browserWorkersEnabled: false;
  metrics: {
    observationCount: number;
    failureRatio: number;
    minParserConfidenceObserved?: number;
    extractionWarningCount: number;
    unsupportedMimeCount: number;
    timeoutCount: number;
    rateLimitedCount: number;
    unavailableCount: number;
    staleCount: number;
    duplicateCanonicalCount: number;
    translationNeededCount: number;
    languageDriftCount: number;
    canonicalUrlHashes: string[];
  };
  thresholds: AdapterSlaThresholds;
  status: AdapterSlaSeverity;
  breaches: AdapterSlaBreachDto[];
  handoffs: {
    agent01SourceGovernance: "none" | "review_source" | "hold_activation";
    agent02Scheduler: "normal" | "backoff" | "pause_or_reduce";
    agent04CorrelationConfidence: "none" | "lower_confidence" | "hold_correlation";
    agent06EvidenceReplay: "none" | "suppress_duplicates" | "replay_after_parser_repair";
    agent07ExtractionQuality: "accept" | "repair_parser" | "hold_extraction";
    agent09ApiFields: "stable" | "show_warning_codes" | "show_hold_codes";
    agent10Runbooks: "green" | "watch" | "release_hold";
  };
}

export interface AdapterSlaBreachDto {
  code:
    | "failure_ratio_high"
    | "parser_confidence_low"
    | "extraction_warnings_high"
    | "unsupported_mime"
    | "timeout"
    | "rate_limited"
    | "unavailable"
    | "stale_dates"
    | "duplicate_canonical"
    | "language_detection_drift";
  severity: AdapterSlaSeverity;
  count: number;
  threshold: number;
  message: string;
}

export interface AdapterParserRepairPacketDto {
  schemaVersion: "ti.adapter_parser_repair.v1";
  generatedAt: string;
  repairId: string;
  sourceId: string;
  adapter: AdapterSlaAdapterKind;
  sourceFamily: AdapterObservatorySourceFamily | "multilingual_handoff";
  parserProfile: ParserProfileName | "translation_handoff";
  category: AdapterRepairCategory;
  priority: "low" | "medium" | "high";
  reason: string;
  canonicalUrlHash?: string;
  fixtureKey: string;
  evidence: {
    contentHashOnly: true;
    replayRequired: boolean;
    duplicateSuppression: boolean;
    rawContentRequired: false;
  };
  scheduler: {
    action: "none" | "retry_after" | "reduce_cadence" | "pause_source";
    retryAfterSeconds?: number;
    reason: string;
  };
  agentHandoffs: {
    agent01SourceGovernance: string;
    agent02SchedulerBackoff: string;
    agent04SourceCorrelationConfidence: string;
    agent06EvidenceReplay: string;
    agent07ExtractionQuality: string;
    agent09ApiWarningCode: string;
    agent10Runbook: string;
  };
  safety: AdapterSlaSafetyDto;
}

export interface AdapterSlaRepairPacketDto {
  schemaVersion: "ti.adapter_sla_repair_packet.v1";
  generatedAt: string;
  readyForPromotion: boolean;
  contracts: AdapterSlaContractDto[];
  repairs: AdapterParserRepairPacketDto[];
  summary: {
    contracts: number;
    pass: number;
    warn: number;
    hold: number;
    repairs: number;
    repairCategories: Record<string, number>;
    sourceIds: string[];
    canonicalUrlHashes: string[];
    agentHandoffs: {
      agent01: string[];
      agent02: string[];
      agent04: string[];
      agent06: string[];
      agent07: string[];
      agent09: string[];
      agent10: string[];
    };
  };
  routeContract: {
    safeForPublicApi: true;
    stableFields: string[];
    forbiddenFields: string[];
    compactApiProof: {
      noRawUrls: true;
      noRawText: true;
      noHtml: true;
      noPrivateAccess: true;
      dynamicBrowserDisabledByDefault: true;
      repairPacketsAreDryRun: true;
    };
  };
  safety: AdapterSlaSafetyDto;
}

interface AdapterSlaSafetyDto {
  publicOnly: true;
  noAuthBypass: true;
  noCaptchaSolving: true;
  noPrivateCommunities: true;
  noExploitPayloadDownload: true;
  noRestrictedRawMaterial: true;
  unsafeUrlExposed: false;
  dryRunOnly: true;
}

const DEFAULT_THRESHOLDS: AdapterSlaThresholds = {
  minParserConfidence: 0.62,
  maxExtractionWarnings: 2,
  maxFailureRatio: 0.25,
  maxDuplicateCanonicalCount: 0,
  maxStaleCount: 0,
  maxRateLimitedCount: 1,
  minLanguageConfidence: 0.7
};

export function buildAdapterSlaRepairPacket(input: AdapterSlaRepairInput): AdapterSlaRepairPacketDto {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds };
  const contracts = adapterSlaConfigs().map((config) => buildSlaContract(config, input, thresholds));
  const repairs = dedupeRepairs([
    ...input.observations.flatMap((observation) => repairPacketsForObservation(input.generatedAt, observation)),
    ...(input.translationHandoffs ?? []).flatMap((handoff) => repairPacketsForTranslation(input.generatedAt, handoff, thresholds))
  ]);
  const hold = contracts.filter((contract) => contract.status === "hold").length;
  const warn = contracts.filter((contract) => contract.status === "warn").length;
  const pass = contracts.filter((contract) => contract.status === "pass").length;
  const canonicalUrlHashes = uniqueSorted([
    ...contracts.flatMap((contract) => contract.metrics.canonicalUrlHashes),
    ...repairs.flatMap((repair) => repair.canonicalUrlHash ? [repair.canonicalUrlHash] : [])
  ]);

  return {
    schemaVersion: "ti.adapter_sla_repair_packet.v1",
    generatedAt: input.generatedAt,
    readyForPromotion: hold === 0 && repairs.every((repair) => repair.priority !== "high"),
    contracts,
    repairs,
    summary: {
      contracts: contracts.length,
      pass,
      warn,
      hold,
      repairs: repairs.length,
      repairCategories: countBy(repairs.map((repair) => repair.category)),
      sourceIds: uniqueSorted(repairs.map((repair) => repair.sourceId)),
      canonicalUrlHashes,
      agentHandoffs: {
        agent01: uniqueSorted(repairs.map((repair) => repair.agentHandoffs.agent01SourceGovernance)),
        agent02: uniqueSorted(repairs.map((repair) => repair.agentHandoffs.agent02SchedulerBackoff)),
        agent04: uniqueSorted(repairs.map((repair) => repair.agentHandoffs.agent04SourceCorrelationConfidence)),
        agent06: uniqueSorted(repairs.map((repair) => repair.agentHandoffs.agent06EvidenceReplay)),
        agent07: uniqueSorted(repairs.map((repair) => repair.agentHandoffs.agent07ExtractionQuality)),
        agent09: uniqueSorted(repairs.map((repair) => repair.agentHandoffs.agent09ApiWarningCode)),
        agent10: uniqueSorted(repairs.map((repair) => repair.agentHandoffs.agent10Runbook))
      }
    },
    routeContract: {
      safeForPublicApi: true,
      stableFields: ["schemaVersion", "generatedAt", "readyForPromotion", "contracts", "repairs", "summary", "routeContract", "safety"],
      forbiddenFields: ["url", "canonicalUrl", "rawText", "translatedText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "screenshotBytes", "downloadUrl"],
      compactApiProof: {
        noRawUrls: true,
        noRawText: true,
        noHtml: true,
        noPrivateAccess: true,
        dynamicBrowserDisabledByDefault: true,
        repairPacketsAreDryRun: true
      }
    },
    safety: safetyDefaults()
  };
}

function buildSlaContract(
  config: AdapterSlaConfig,
  input: AdapterSlaRepairInput,
  thresholds: AdapterSlaThresholds
): AdapterSlaContractDto {
  const observations = input.observations.filter((observation) => observation.sourceFamily === config.sourceFamily);
  const translations = config.adapter === "multilingual_handoff" ? input.translationHandoffs ?? [] : [];
  const failed = observations.filter((observation) => observation.outcome !== "ok");
  const parserConfidences = observations.map((observation) => observation.diagnostics.parserConfidence);
  const warningCount = observations.reduce((count, observation) => count + observation.diagnostics.extractionWarnings.length, 0);
  const duplicateCanonicalCount = observations.filter((observation) => observation.diagnostics.duplicateCanonical).length;
  const staleCount = observations.filter((observation) => Boolean(observation.staleDate)).length;
  const rateLimitedCount = observations.filter((observation) => observation.diagnostics.rateLimited).length;
  const languageDriftCount = translations.filter((handoff) => handoff.language.confidence < thresholds.minLanguageConfidence || handoff.language.mixedLanguage).length;
  const translationNeededCount = translations.filter((handoff) => handoff.language.translationNeeded).length;
  const metrics = {
    observationCount: observations.length + translations.length,
    failureRatio: roundRatio(observations.length ? failed.length / observations.length : 0),
    minParserConfidenceObserved: parserConfidences.length ? Math.min(...parserConfidences) : undefined,
    extractionWarningCount: warningCount + translations.reduce((count, handoff) => count + handoff.extraction.parserWarnings.length, 0),
    unsupportedMimeCount: observations.filter((observation) => Boolean(observation.diagnostics.unsupportedMime)).length,
    timeoutCount: observations.filter((observation) => observation.diagnostics.timeout).length,
    rateLimitedCount,
    unavailableCount: observations.filter((observation) => observation.diagnostics.unavailable).length,
    staleCount,
    duplicateCanonicalCount,
    translationNeededCount,
    languageDriftCount,
    canonicalUrlHashes: uniqueSorted([
      ...observations.flatMap((observation) => observation.canonicalUrlHash ? [observation.canonicalUrlHash] : []),
      ...translations.map((handoff) => handoff.canonicalUrlHash)
    ])
  };
  const breaches = breachesFor(metrics, thresholds);
  const status = breaches.some((breach) => breach.severity === "hold") ? "hold" : breaches.length ? "warn" : "pass";

  return {
    schemaVersion: "ti.adapter_sla_contract.v1",
    generatedAt: input.generatedAt,
    adapter: config.adapter,
    sourceFamily: config.sourceFamily,
    parserProfile: config.parserProfile,
    enabledByDefault: config.enabledByDefault && status !== "hold",
    canaryOnly: config.canaryOnly || status !== "pass",
    browserWorkersEnabled: false,
    metrics,
    thresholds,
    status,
    breaches,
    handoffs: contractHandoffs(status, breaches, config.adapter)
  };
}

function repairPacketsForObservation(generatedAt: string, observation: AdapterFailureObservationDto): AdapterParserRepairPacketDto[] {
  const categories = repairCategoriesForObservation(observation);
  return categories.map((category) => repairPacket({
    generatedAt,
    sourceId: observation.sourceId,
    adapter: adapterKindForFamily(observation.sourceFamily),
    sourceFamily: observation.sourceFamily,
    parserProfile: observation.parserProfile,
    category,
    canonicalUrlHash: observation.canonicalUrlHash,
    parserVersion: observation.parserVersion,
    retryAfterSeconds: observation.retryAfterSeconds,
    warnings: observation.diagnostics.extractionWarnings
  }));
}

function repairPacketsForTranslation(
  generatedAt: string,
  handoff: TranslationHandoffPacketDto,
  thresholds: AdapterSlaThresholds
): AdapterParserRepairPacketDto[] {
  if (handoff.language.confidence >= thresholds.minLanguageConfidence && !handoff.language.mixedLanguage && handoff.extraction.adjustedParserConfidence >= thresholds.minParserConfidence) return [];
  return [repairPacket({
    generatedAt,
    sourceId: handoff.sourceId,
    adapter: "multilingual_handoff",
    sourceFamily: "multilingual_handoff",
    parserProfile: "translation_handoff",
    category: "language_detection_drift",
    canonicalUrlHash: handoff.canonicalUrlHash,
    parserVersion: handoff.parserVersion,
    warnings: handoff.extraction.parserWarnings
  })];
}

function repairPacket(input: {
  generatedAt: string;
  sourceId: string;
  adapter: AdapterSlaAdapterKind;
  sourceFamily: AdapterObservatorySourceFamily | "multilingual_handoff";
  parserProfile: ParserProfileName | "translation_handoff";
  category: AdapterRepairCategory;
  canonicalUrlHash?: string;
  parserVersion: string;
  retryAfterSeconds?: number;
  warnings: string[];
}): AdapterParserRepairPacketDto {
  const priority = priorityFor(input.category);
  const schedulerAction = schedulerActionFor(input.category);
  const reason = repairReason(input.category, input.warnings);
  const fixtureKey = `fixture:${hashContent(`${input.adapter}:${input.sourceId}:${input.parserVersion}:${input.category}`).slice(0, 16)}`;

  return {
    schemaVersion: "ti.adapter_parser_repair.v1",
    generatedAt: input.generatedAt,
    repairId: `repair:${hashContent(`${input.generatedAt}:${input.sourceId}:${input.category}:${input.canonicalUrlHash ?? ""}`).slice(0, 16)}`,
    sourceId: input.sourceId,
    adapter: input.adapter,
    sourceFamily: input.sourceFamily,
    parserProfile: input.parserProfile,
    category: input.category,
    priority,
    reason,
    canonicalUrlHash: input.canonicalUrlHash,
    fixtureKey,
    evidence: {
      contentHashOnly: true,
      replayRequired: input.category !== "scheduler_backoff",
      duplicateSuppression: input.category === "evidence_duplicate_suppression",
      rawContentRequired: false
    },
    scheduler: {
      action: schedulerAction,
      retryAfterSeconds: input.retryAfterSeconds,
      reason: schedulerReason(input.category)
    },
    agentHandoffs: {
      agent01SourceGovernance: input.category === "parser_fixture_gap" || input.category === "unsupported_mime_repair" ? "hold_activation_until_parser_support" : "no_source_mutation",
      agent02SchedulerBackoff: schedulerAction === "none" ? "no_scheduler_change" : `${schedulerAction}_until_repair_or_retry_after`,
      agent04SourceCorrelationConfidence: input.category === "evidence_duplicate_suppression" ? "suppress_duplicate_correlation" : priority === "high" ? "lower_source_correlation_confidence" : "preserve_correlation_with_warning",
      agent06EvidenceReplay: input.category === "evidence_duplicate_suppression" ? "suppress_duplicate_canonical_hash" : input.category === "scheduler_backoff" ? "no_replay_required" : "replay_hash_only_after_parser_repair",
      agent07ExtractionQuality: input.category === "language_detection_drift" ? "review_multilingual_fallback" : "repair_parser_fixture_or_selector",
      agent09ApiWarningCode: `adapter_repair.${input.category}`,
      agent10Runbook: priority === "high" ? "adapter_sla_release_hold" : "adapter_sla_watch"
    },
    safety: safetyDefaults()
  };
}

function repairCategoriesForObservation(observation: AdapterFailureObservationDto): AdapterRepairCategory[] {
  const categories = new Set<AdapterRepairCategory>();
  if (observation.failureClass === "parser_gap") categories.add("parser_fixture_gap");
  if (observation.failureClass === "parser_confidence_low") {
    categories.add(observation.sourceFamily === "static_html" ? "readability_failure" : "parser_fixture_gap");
  }
  if (observation.diagnostics.extractionWarnings.some((warning) => /selector/i.test(warning))) categories.add("selector_failure");
  if (observation.diagnostics.extractionWarnings.some((warning) => /readability|empty text|boilerplate/i.test(warning))) categories.add("readability_failure");
  if (observation.sourceFamily === "pdf_report" && (observation.failureClass === "empty_capture" || observation.failureClass === "parser_confidence_low")) categories.add("pdf_extraction_failure");
  if (observation.sourceFamily === "dynamic_page" && (observation.failureClass === "timeout" || observation.failureClass === "empty_capture")) categories.add("dynamic_render_failure");
  if (observation.diagnostics.unsupportedMime) categories.add("unsupported_mime_repair");
  if (observation.diagnostics.rateLimited || observation.diagnostics.timeout || observation.diagnostics.unavailable) categories.add("scheduler_backoff");
  if (observation.diagnostics.duplicateCanonical) categories.add("evidence_duplicate_suppression");
  return [...categories];
}

function breachesFor(metrics: AdapterSlaContractDto["metrics"], thresholds: AdapterSlaThresholds): AdapterSlaBreachDto[] {
  const breaches: AdapterSlaBreachDto[] = [];
  const add = (code: AdapterSlaBreachDto["code"], severity: AdapterSlaSeverity, count: number, threshold: number, message: string) => {
    if (count > threshold) breaches.push({ code, severity, count, threshold, message });
  };
  add("failure_ratio_high", "hold", metrics.failureRatio, thresholds.maxFailureRatio, "adapter failure ratio exceeds release SLA");
  if (metrics.minParserConfidenceObserved !== undefined && metrics.minParserConfidenceObserved < thresholds.minParserConfidence) {
    breaches.push({
      code: "parser_confidence_low",
      severity: "hold",
      count: metrics.minParserConfidenceObserved,
      threshold: thresholds.minParserConfidence,
      message: "minimum parser confidence is below promotion threshold"
    });
  }
  add("extraction_warnings_high", "warn", metrics.extractionWarningCount, thresholds.maxExtractionWarnings, "extraction warning count exceeds repair threshold");
  add("unsupported_mime", "hold", metrics.unsupportedMimeCount, 0, "unsupported media types require parser or source repair");
  add("timeout", "warn", metrics.timeoutCount, 0, "timeouts require scheduler backoff or dynamic-render repair");
  add("rate_limited", "warn", metrics.rateLimitedCount, thresholds.maxRateLimitedCount, "rate-limit count exceeds scheduler SLA");
  add("unavailable", "hold", metrics.unavailableCount, 0, "unavailable sources hold adapter promotion");
  add("stale_dates", "warn", metrics.staleCount, thresholds.maxStaleCount, "stale publication or collection dates require cadence review");
  add("duplicate_canonical", "warn", metrics.duplicateCanonicalCount, thresholds.maxDuplicateCanonicalCount, "duplicate canonical keys require evidence suppression");
  add("language_detection_drift", "warn", metrics.languageDriftCount, 0, "language detection drift requires multilingual fallback review");
  return breaches;
}

interface AdapterSlaConfig {
  adapter: AdapterSlaAdapterKind;
  sourceFamily: AdapterObservatorySourceFamily | "multilingual_handoff";
  parserProfile: ParserProfileName | "translation_handoff";
  enabledByDefault: boolean;
  canaryOnly: boolean;
}

function adapterSlaConfigs(): AdapterSlaConfig[] {
  return [
    { adapter: "static_html", sourceFamily: "static_html", parserProfile: "static_html", enabledByDefault: true, canaryOnly: false },
    { adapter: "rss_feed", sourceFamily: "rss_feed", parserProfile: "rss_entry", enabledByDefault: true, canaryOnly: false },
    { adapter: "dynamic_public_browser", sourceFamily: "dynamic_page", parserProfile: "dynamic_page", enabledByDefault: false, canaryOnly: true },
    { adapter: "pdf_report", sourceFamily: "pdf_report", parserProfile: "pdf_report", enabledByDefault: false, canaryOnly: true },
    { adapter: "public_channel_handoff", sourceFamily: "public_channel", parserProfile: "public_channel_handoff", enabledByDefault: false, canaryOnly: true },
    { adapter: "advisory_signal", sourceFamily: "advisory_signal", parserProfile: "static_html", enabledByDefault: true, canaryOnly: false },
    { adapter: "multilingual_handoff", sourceFamily: "multilingual_handoff", parserProfile: "translation_handoff", enabledByDefault: false, canaryOnly: true }
  ];
}

function adapterKindForFamily(family: AdapterObservatorySourceFamily): AdapterSlaAdapterKind {
  if (family === "rss_feed") return "rss_feed";
  if (family === "dynamic_page") return "dynamic_public_browser";
  if (family === "pdf_report") return "pdf_report";
  if (family === "public_channel") return "public_channel_handoff";
  if (family === "advisory_signal") return "advisory_signal";
  return "static_html";
}

function contractHandoffs(
  status: AdapterSlaSeverity,
  breaches: AdapterSlaBreachDto[],
  adapter: AdapterSlaAdapterKind
): AdapterSlaContractDto["handoffs"] {
  const schedulerBreach = breaches.some((breach) => breach.code === "rate_limited" || breach.code === "timeout" || breach.code === "stale_dates");
  const duplicateBreach = breaches.some((breach) => breach.code === "duplicate_canonical");
  const parserBreach = breaches.some((breach) => breach.code === "parser_confidence_low" || breach.code === "unsupported_mime" || breach.code === "extraction_warnings_high" || breach.code === "language_detection_drift");
  return {
    agent01SourceGovernance: status === "hold" ? "hold_activation" : status === "warn" ? "review_source" : "none",
    agent02Scheduler: schedulerBreach ? status === "hold" ? "pause_or_reduce" : "backoff" : "normal",
    agent04CorrelationConfidence: status === "hold" ? "hold_correlation" : status === "warn" ? "lower_confidence" : "none",
    agent06EvidenceReplay: duplicateBreach ? "suppress_duplicates" : parserBreach ? "replay_after_parser_repair" : "none",
    agent07ExtractionQuality: parserBreach ? status === "hold" ? "hold_extraction" : "repair_parser" : "accept",
    agent09ApiFields: status === "hold" ? "show_hold_codes" : status === "warn" ? "show_warning_codes" : "stable",
    agent10Runbooks: status === "hold" || adapter === "dynamic_public_browser" && parserBreach ? "release_hold" : status === "warn" ? "watch" : "green"
  };
}

function priorityFor(category: AdapterRepairCategory): AdapterParserRepairPacketDto["priority"] {
  if (category === "parser_fixture_gap" || category === "dynamic_render_failure" || category === "pdf_extraction_failure" || category === "unsupported_mime_repair") return "high";
  if (category === "readability_failure" || category === "selector_failure" || category === "language_detection_drift") return "medium";
  return "low";
}

function schedulerActionFor(category: AdapterRepairCategory): AdapterParserRepairPacketDto["scheduler"]["action"] {
  if (category === "scheduler_backoff") return "retry_after";
  if (category === "evidence_duplicate_suppression") return "reduce_cadence";
  if (category === "dynamic_render_failure" || category === "unsupported_mime_repair") return "pause_source";
  return "none";
}

function schedulerReason(category: AdapterRepairCategory): string {
  if (category === "scheduler_backoff") return "honor retry-after/backoff before next public collection attempt";
  if (category === "evidence_duplicate_suppression") return "reduce duplicate canonical scheduling pressure";
  if (category === "dynamic_render_failure") return "pause dynamic render canary until bounded repair proof passes";
  if (category === "unsupported_mime_repair") return "pause source until adapter media support or source target is corrected";
  return "parser repair does not require scheduler mutation";
}

function repairReason(category: AdapterRepairCategory, warnings: string[]): string {
  const warning = warnings.find((item) => item.trim());
  const suffix = warning ? ` (${warning})` : "";
  const reasons: Record<AdapterRepairCategory, string> = {
    parser_fixture_gap: "add or update parser fixture coverage for this public adapter",
    selector_failure: "repair selector assumptions before extraction promotion",
    readability_failure: "repair readability extraction before claim promotion",
    pdf_extraction_failure: "repair PDF/report extraction fixture and citation spans",
    language_detection_drift: "review multilingual fallback and language detection confidence",
    dynamic_render_failure: "repair bounded public dynamic-render plan with browser workers still disabled by default",
    unsupported_mime_repair: "repair source target or parser media support for unsupported MIME",
    scheduler_backoff: "honor public-source backoff for timeout/rate-limit/unavailable state",
    evidence_duplicate_suppression: "suppress duplicate canonical evidence before replay promotion"
  };
  return `${reasons[category]}${suffix}`;
}

function dedupeRepairs(repairs: AdapterParserRepairPacketDto[]): AdapterParserRepairPacketDto[] {
  const seen = new Set<string>();
  return repairs.filter((repair) => {
    const key = `${repair.sourceId}:${repair.category}:${repair.canonicalUrlHash ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce<Record<T, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function safetyDefaults(): AdapterSlaSafetyDto {
  return {
    publicOnly: true,
    noAuthBypass: true,
    noCaptchaSolving: true,
    noPrivateCommunities: true,
    noExploitPayloadDownload: true,
    noRestrictedRawMaterial: true,
    unsafeUrlExposed: false,
    dryRunOnly: true
  };
}
