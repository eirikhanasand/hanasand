import type { BrowserWorkerIsolationPlan } from "./browserWorkerIsolation.ts";
import type { ParserFailureCategory, ParserProfileDecision, ParserProfileName } from "./parserProfiles.ts";
import type { AdapterRunResult, SourceRecord, SourceType } from "../types.ts";
import { hashContent } from "../utils.ts";

export type AdapterObservatorySourceFamily =
  | "static_html"
  | "rss_feed"
  | "dynamic_page"
  | "pdf_report"
  | "public_channel"
  | "advisory_signal"
  | "clear_web";

export type AdapterFailureClass =
  | ParserFailureCategory
  | "stale_source"
  | "parser_gap"
  | "empty_capture"
  | "noisy_source"
  | "ok";

export type AdapterObservatoryQueryClass =
  | "actor"
  | "ransomware"
  | "cve"
  | "malware_tool"
  | "country"
  | "sector"
  | "vendor_report"
  | "cert_advisory"
  | "unknown";

export interface AdapterFailureObservationInput {
  source: SourceRecord;
  result: AdapterRunResult;
  profile: ParserProfileDecision;
  queryClass: AdapterObservatoryQueryClass;
  sourceFamily?: AdapterObservatorySourceFamily;
  generatedAt: string;
  canonicalUrl?: string;
  contentType?: string;
  contentLengthBytes?: number;
  maxBytes?: number;
  retryAfterSeconds?: number;
  staleDate?: string;
  duplicateRate?: number;
  noiseRate?: number;
  handoffTarget?: "agent01" | "agent02" | "agent06" | "agent07" | "agent09" | "agent10";
}

export interface AdapterFailureObservationDto {
  schemaVersion: "ti.adapter_failure_observation.v1";
  generatedAt: string;
  sourceId: string;
  sourceType: SourceType;
  adapter: SourceType | string;
  sourceFamily: AdapterObservatorySourceFamily;
  queryClass: AdapterObservatoryQueryClass;
  parserProfile: ParserProfileName;
  parserVersion: string;
  failureClass: AdapterFailureClass;
  outcome: "ok" | "watch" | "blocked";
  canonicalUrlHash?: string;
  retryAfterSeconds?: number;
  staleDate?: string;
  diagnostics: {
    robotsLegalHold: boolean;
    unsupportedMime?: string;
    contentTooLarge: boolean;
    timeout: boolean;
    duplicateCanonical: boolean;
    rateLimited: boolean;
    unavailable: boolean;
    sourceDisabled: boolean;
    parserConfidence: number;
    extractionWarnings: string[];
    handoffTarget: "agent01" | "agent02" | "agent06" | "agent07" | "agent09" | "agent10";
  };
  handoffs: {
    agent01MarketplaceScoring: "none" | "lower_score" | "review_source" | "disable_source";
    agent02Scheduling: "none" | "retry_after" | "increase_cadence" | "decrease_cadence" | "pause_source";
    agent06EvidenceRetention: "none" | "retain_metadata_only" | "suppress_duplicate" | "legal_hold_review";
    agent07QualityGate: "none" | "parser_gap" | "low_confidence" | "blocked";
    agent09ApiContract: "captured" | "searching" | "blocked" | "needs_review";
    agent10Dashboard: "ok" | "watch" | "blocked";
  };
  safety: {
    publicOnly: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noPrivateCommunities: true;
    noExploitPayloadDownload: true;
    noRestrictedRawMaterial: true;
    unsafeUrlExposed: false;
  };
}

export interface AdapterFailureObservatoryDto {
  schemaVersion: "ti.adapter_failure_observatory.v1";
  generatedAt: string;
  observations: AdapterFailureObservationDto[];
  summary: {
    total: number;
    ok: number;
    watch: number;
    blocked: number;
    failureClasses: Record<string, number>;
    parserProfiles: Record<ParserProfileName, number>;
    sourceFamilies: Record<AdapterObservatorySourceFamily, number>;
  };
  routeContract: {
    safeForPublicApi: true;
    stableFields: string[];
    forbiddenFields: string[];
  };
}

export interface AdapterProductionReadinessPacketDto {
  schemaVersion: "ti.adapter_production_readiness_packet.v1";
  generatedAt: string;
  browserWorkers: {
    enabled: false;
    workerPool: "dynamic_public_browser";
    maxWorkers: number;
    memoryCapMb: number;
    timeoutMs: number;
    hostAllowlist: string[];
  };
  safetyDefaults: AdapterFailureObservationDto["safety"];
  enablementGate: {
    readyForCanary: boolean;
    blockers: string[];
    warnings: string[];
  };
  agentHandoffs: {
    agent01: string[];
    agent02: string[];
    agent06: string[];
    agent07: string[];
    agent09: string[];
    agent10: string[];
  };
}

export function buildAdapterFailureObservation(input: AdapterFailureObservationInput): AdapterFailureObservationDto {
  const failureClass = classifyFailure(input);
  const item = input.result.items[0];
  const canonicalUrl = input.canonicalUrl ?? item?.url ?? stringValue(input.result.metadata?.canonicalUrl);
  const warnings = [...input.profile.parserWarnings, ...input.result.warnings, ...arrayStringValue(item?.metadata.parserWarnings)];
  const outcome = failureClass === "ok" ? "ok" : retryableFailure(failureClass) || failureClass === "stale_source" || failureClass === "noisy_source" ? "watch" : "blocked";
  const handoffTarget = input.handoffTarget ?? defaultHandoffTarget(failureClass);
  return {
    schemaVersion: "ti.adapter_failure_observation.v1",
    generatedAt: input.generatedAt,
    sourceId: input.source.id,
    sourceType: input.source.type,
    adapter: input.source.type,
    sourceFamily: input.sourceFamily ?? sourceFamilyFor(input.source),
    queryClass: input.queryClass,
    parserProfile: input.profile.profile,
    parserVersion: input.profile.parserVersion,
    failureClass,
    outcome,
    canonicalUrlHash: canonicalUrl ? `urlhash:${hashContent(canonicalUrl).slice(0, 16)}` : undefined,
    retryAfterSeconds: input.retryAfterSeconds,
    staleDate: input.staleDate,
    diagnostics: {
      robotsLegalHold: failureClass === "robots_policy_hold" || Boolean(input.source.metadata?.robotsReviewState === "hold" || input.source.metadata?.legalReviewState === "hold"),
      unsupportedMime: failureClass === "unsupported_media" ? input.contentType : undefined,
      contentTooLarge: failureClass === "content_too_large",
      timeout: failureClass === "timeout",
      duplicateCanonical: failureClass === "duplicate_canonical",
      rateLimited: failureClass === "rate_limited",
      unavailable: failureClass === "unavailable",
      sourceDisabled: failureClass === "source_disabled",
      parserConfidence: input.profile.extractionScore,
      extractionWarnings: warnings,
      handoffTarget
    },
    handoffs: handoffsFor(failureClass, outcome),
    safety: safetyDefaults()
  };
}

export function buildAdapterFailureObservatory(input: {
  generatedAt: string;
  observations: AdapterFailureObservationDto[];
}): AdapterFailureObservatoryDto {
  return {
    schemaVersion: "ti.adapter_failure_observatory.v1",
    generatedAt: input.generatedAt,
    observations: input.observations,
    summary: {
      total: input.observations.length,
      ok: input.observations.filter((observation) => observation.outcome === "ok").length,
      watch: input.observations.filter((observation) => observation.outcome === "watch").length,
      blocked: input.observations.filter((observation) => observation.outcome === "blocked").length,
      failureClasses: countBy(input.observations.map((observation) => observation.failureClass)),
      parserProfiles: countComplete(input.observations.map((observation) => observation.parserProfile), parserProfileNames),
      sourceFamilies: countComplete(input.observations.map((observation) => observation.sourceFamily), sourceFamilies)
    },
    routeContract: {
      safeForPublicApi: true,
      stableFields: [
        "schemaVersion",
        "generatedAt",
        "observations",
        "summary",
        "routeContract"
      ],
      forbiddenFields: ["url", "canonicalUrl", "rawText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl"]
    }
  };
}

export function buildAdapterProductionReadinessPacket(input: {
  generatedAt: string;
  observatory: AdapterFailureObservatoryDto;
  browserPlan: BrowserWorkerIsolationPlan;
}): AdapterProductionReadinessPacketDto {
  const blockers = [
    ...(!input.browserPlan.policy.robotsAllowed ? ["dynamic_browser_robots_policy_hold"] : []),
    ...(!input.browserPlan.policy.legalNotesPresent ? ["dynamic_browser_legal_notes_missing"] : []),
    ...(input.observatory.summary.blocked > 0 ? ["blocked_adapter_failures_present"] : [])
  ];
  const warnings = [
    ...(input.observatory.summary.watch > 0 ? ["watch_adapter_failures_present"] : []),
    ...(input.browserPlan.resourceCaps.memoryCapMb < 512 ? ["dynamic_browser_memory_cap_low"] : [])
  ];
  return {
    schemaVersion: "ti.adapter_production_readiness_packet.v1",
    generatedAt: input.generatedAt,
    browserWorkers: {
      enabled: false,
      workerPool: "dynamic_public_browser",
      maxWorkers: input.browserPlan.resourceCaps.maxWorkers,
      memoryCapMb: input.browserPlan.resourceCaps.memoryCapMb,
      timeoutMs: input.browserPlan.resourceCaps.timeoutMs,
      hostAllowlist: input.browserPlan.networkIsolation.hostAllowlist
    },
    safetyDefaults: safetyDefaults(),
    enablementGate: {
      readyForCanary: blockers.length === 0,
      blockers,
      warnings
    },
    agentHandoffs: {
      agent01: ["source marketplace scoring consumes sourceId, sourceFamily, failureClass, and outcome"],
      agent02: ["scheduler cadence/backoff consumes retryAfterSeconds, staleDate, and handoffs.agent02Scheduling"],
      agent06: ["evidence retention consumes canonicalUrlHash and handoffs.agent06EvidenceRetention"],
      agent07: ["quality gates consume parserProfile, parserConfidence, extractionWarnings, and handoffs.agent07QualityGate"],
      agent09: ["API contracts consume routeContract.stableFields and no-leak route DTO shape"],
      agent10: ["observability dashboards consume summary, failureClasses, sourceFamilies, and enablementGate"]
    }
  };
}

function classifyFailure(input: AdapterFailureObservationInput): AdapterFailureClass {
  const metadataFailure = parserFailureValue(input.result.metadata?.failureCategory);
  if (metadataFailure) return metadataFailure;
  if (input.source.status === "disabled" || input.source.status === "rejected" || input.source.status === "retired") return "source_disabled";
  if (input.retryAfterSeconds !== undefined && input.retryAfterSeconds > 0) return "rate_limited";
  if (input.contentType && unsupportedMime(input.profile.profile, input.contentType)) return "unsupported_media";
  if (input.maxBytes !== undefined && input.contentLengthBytes !== undefined && input.contentLengthBytes > input.maxBytes) return "content_too_large";
  if ((input.duplicateRate ?? 0) >= 0.75) return "duplicate_canonical";
  if ((input.noiseRate ?? 0) >= 0.65) return "noisy_source";
  if (input.staleDate && Date.parse(input.staleDate) < Date.parse(input.generatedAt)) return "stale_source";
  if (input.profile.extractionConfidenceBand === "low") return "parser_confidence_low";
  if (input.profile.parserWarnings.some((warning) => /parser gap|parser repair|missing parser/i.test(warning)) || input.result.warnings.some((warning) => /parser gap|parser repair|missing parser/i.test(warning))) return "parser_gap";
  if (!input.result.items.length) return "empty_capture";
  return "ok";
}

function sourceFamilyFor(source: SourceRecord): AdapterObservatorySourceFamily {
  if (source.type === "rss") return "rss_feed";
  if (source.type === "dynamic_web") return "dynamic_page";
  if (source.type === "pdf") return "pdf_report";
  if (source.type === "telegram_public") return "public_channel";
  if (source.type === "api") return "advisory_signal";
  if (source.type === "static_web") return "static_html";
  return "clear_web";
}

function unsupportedMime(profile: ParserProfileName, contentType: string): boolean {
  const media = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (profile === "pdf_report") return media !== "application/pdf";
  if (profile === "rss_entry") return !["application/rss+xml", "application/atom+xml", "application/xml", "text/xml"].includes(media);
  if (profile === "dynamic_page" || profile === "static_html") return !["text/html", "application/xhtml+xml", "text/plain"].includes(media);
  return false;
}

function retryableFailure(failureClass: AdapterFailureClass): boolean {
  return failureClass === "timeout" || failureClass === "rate_limited" || failureClass === "unavailable";
}

function defaultHandoffTarget(failureClass: AdapterFailureClass): AdapterFailureObservationDto["diagnostics"]["handoffTarget"] {
  if (failureClass === "robots_policy_hold" || failureClass === "policy_hold" || failureClass === "source_disabled") return "agent01";
  if (failureClass === "rate_limited" || failureClass === "timeout" || failureClass === "stale_source") return "agent02";
  if (failureClass === "duplicate_canonical") return "agent06";
  if (failureClass === "parser_confidence_low" || failureClass === "parser_gap" || failureClass === "unsupported_media") return "agent07";
  if (failureClass === "ok") return "agent10";
  return "agent09";
}

function handoffsFor(failureClass: AdapterFailureClass, outcome: AdapterFailureObservationDto["outcome"]): AdapterFailureObservationDto["handoffs"] {
  return {
    agent01MarketplaceScoring: failureClass === "source_disabled" ? "disable_source" : failureClass === "policy_hold" || failureClass === "robots_policy_hold" ? "review_source" : outcome === "blocked" ? "lower_score" : "none",
    agent02Scheduling: failureClass === "rate_limited" ? "retry_after" : failureClass === "stale_source" ? "increase_cadence" : failureClass === "noisy_source" || failureClass === "duplicate_canonical" ? "decrease_cadence" : outcome === "blocked" ? "pause_source" : "none",
    agent06EvidenceRetention: failureClass === "duplicate_canonical" ? "suppress_duplicate" : failureClass === "policy_hold" || failureClass === "robots_policy_hold" ? "legal_hold_review" : outcome === "blocked" ? "retain_metadata_only" : "none",
    agent07QualityGate: failureClass === "parser_gap" || failureClass === "unsupported_media" ? "parser_gap" : failureClass === "parser_confidence_low" ? "low_confidence" : outcome === "blocked" ? "blocked" : "none",
    agent09ApiContract: outcome === "ok" ? "captured" : outcome === "watch" ? "needs_review" : "blocked",
    agent10Dashboard: outcome
  };
}

function safetyDefaults(): AdapterFailureObservationDto["safety"] {
  return {
    publicOnly: true,
    noAuthBypass: true,
    noCaptchaSolving: true,
    noPrivateCommunities: true,
    noExploitPayloadDownload: true,
    noRestrictedRawMaterial: true,
    unsafeUrlExposed: false
  };
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce<Record<T, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

function countComplete<T extends string>(values: T[], knownValues: readonly T[]): Record<T, number> {
  const counts = Object.fromEntries(knownValues.map((value) => [value, 0])) as Record<T, number>;
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function parserFailureValue(value: unknown): ParserFailureCategory | undefined {
  if (typeof value !== "string") return undefined;
  return parserFailureCategories.has(value as ParserFailureCategory) ? value as ParserFailureCategory : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function arrayStringValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const parserFailureCategories = new Set<ParserFailureCategory>([
  "timeout",
  "robots_policy_hold",
  "policy_hold",
  "unsupported_media",
  "content_too_large",
  "parser_confidence_low",
  "duplicate_canonical",
  "rate_limited",
  "unavailable",
  "source_disabled"
]);

const parserProfileNames = [
  "static_html",
  "dynamic_page",
  "pdf_report",
  "rss_entry",
  "public_channel_handoff"
] as const satisfies readonly ParserProfileName[];

const sourceFamilies = [
  "static_html",
  "rss_feed",
  "dynamic_page",
  "pdf_report",
  "public_channel",
  "advisory_signal",
  "clear_web"
] as const satisfies readonly AdapterObservatorySourceFamily[];
