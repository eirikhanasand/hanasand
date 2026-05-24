import type { AdapterFailureObservatoryDto, AdapterFailureObservationDto, AdapterObservatorySourceFamily } from "./adapterFailureObservatory.ts";
import type { BrowserWorkerIsolationPlan } from "./browserWorkerIsolation.ts";
import type { ParserProfileDecision, ParserProfileName } from "./parserProfiles.ts";
import type { SourceRecord, SourceType } from "../types.ts";
import { hashContent } from "../utils.ts";

export type AdapterRuntimePoolName =
  | "static_html"
  | "rss_feed"
  | "dynamic_public_browser"
  | "pdf_report"
  | "public_channel_handoff"
  | "advisory_signal";

export type AdapterRuntimeReadinessState = "enabled" | "canary_only" | "disabled" | "blocked";

export interface AdapterRuntimeCanarySourceInput {
  source: SourceRecord;
  sourceFamily: AdapterObservatorySourceFamily;
  parserProfile: ParserProfileDecision;
  canonicalUrl?: string;
  robotsAllowed: boolean;
  legalNotesPresent?: boolean;
  maxBytes: number;
  observedContentLengthBytes?: number;
  expectedEvidenceYield?: number;
}

export interface AdapterRuntimeEnablementInput {
  generatedAt: string;
  observatory: AdapterFailureObservatoryDto;
  browserPlan: BrowserWorkerIsolationPlan;
  canarySources: AdapterRuntimeCanarySourceInput[];
  poolCaps: {
    staticMaxWorkers: number;
    rssMaxWorkers: number;
    dynamicMaxWorkers: number;
    pdfMaxWorkers: number;
    publicChannelMaxWorkers: number;
    advisoryMaxWorkers: number;
    memoryCapMb: number;
    timeoutMs: number;
    maxBytes: number;
  };
  thresholds: {
    staticMinParserConfidence: number;
    rssMinParserConfidence: number;
    dynamicMinParserConfidence: number;
    pdfMinParserConfidence: number;
    publicChannelMinParserConfidence: number;
    advisoryMinParserConfidence: number;
    maxWatchFailureRatio: number;
    maxBlockedFailureRatio: number;
    minEvidenceYield: number;
  };
}

export interface AdapterRuntimeReadinessDto {
  schemaVersion: "ti.adapter_runtime_readiness.v1";
  generatedAt: string;
  adapter: AdapterRuntimePoolName;
  sourceFamily: AdapterObservatorySourceFamily;
  parserProfile: ParserProfileName;
  readiness: AdapterRuntimeReadinessState;
  enabledByDefault: boolean;
  canaryOnly: boolean;
  canarySourceIds: string[];
  canaryUrlHashes: string[];
  workerPool: {
    maxWorkers: number;
    memoryCapMb: number;
    timeoutMs: number;
    maxBytes: number;
  };
  gates: {
    canaryAllowlist: boolean;
    robotsAllowed: boolean;
    legalNotesPresent: boolean;
    parserConfidenceMet: boolean;
    byteCapMet: boolean;
    observatoryHealthy: boolean;
    browserDisabledByDefault: boolean;
    screenshotHashOnly: boolean;
  };
  rollbackTriggers: string[];
  blockers: string[];
  warnings: string[];
  handoffs: AdapterRuntimeHandoffDto;
  safety: AdapterFailureObservationDto["safety"];
}

export interface AdapterRuntimeEnablementPacketDto {
  schemaVersion: "ti.adapter_runtime_enablement_packet.v1";
  generatedAt: string;
  readyForCanary: boolean;
  readyForDefaultEnablement: boolean;
  readiness: AdapterRuntimeReadinessDto[];
  summary: {
    totalAdapters: number;
    enabled: number;
    canaryOnly: number;
    disabled: number;
    blocked: number;
    blockers: string[];
    warnings: string[];
  };
  rolloutControls: {
    canarySourceIds: string[];
    canaryUrlHashes: string[];
    browserWorkersEnabled: false;
    dynamicRequiresExplicitAllocation: true;
    screenshotStorage: "hash_only";
    rollbackTriggers: string[];
  };
  agentHandoffs: {
    agent01SourceRollout: string[];
    agent02Scheduler: string[];
    agent06EvidenceStorage: string[];
    agent07Quality: string[];
    agent09ApiContracts: string[];
    agent10Observability: string[];
  };
  routeContract: {
    safeForPublicApi: true;
    stableFields: string[];
    forbiddenFields: string[];
  };
  safety: AdapterFailureObservationDto["safety"];
}

interface AdapterRuntimeHandoffDto {
  agent01SourceRollout: "no_action" | "approve_canary" | "hold_source" | "rollback_source";
  agent02Scheduler: "normal_cadence" | "canary_cadence" | "pause_pool" | "reduce_cadence";
  agent06EvidenceStorage: "normal_capture" | "hash_only_screenshots" | "metadata_only" | "suppress_capture";
  agent07Quality: "accept" | "watch_confidence" | "parser_repair" | "block_extraction";
  agent09ApiContracts: "ready" | "canary_only" | "blocked";
  agent10Observability: "green" | "watch" | "hold";
}

export function buildAdapterRuntimeEnablementPacket(input: AdapterRuntimeEnablementInput): AdapterRuntimeEnablementPacketDto {
  const observationsByFamily = new Map<AdapterObservatorySourceFamily, AdapterFailureObservationDto[]>();
  for (const observation of input.observatory.observations) {
    observationsByFamily.set(observation.sourceFamily, [...(observationsByFamily.get(observation.sourceFamily) ?? []), observation]);
  }

  const readiness = adapterRuntimeConfigs(input).map((config) => buildRuntimeReadiness(config, input, observationsByFamily.get(config.sourceFamily) ?? []));
  const blockers = uniqueSorted(readiness.flatMap((entry) => entry.blockers));
  const warnings = uniqueSorted(readiness.flatMap((entry) => entry.warnings));
  const canarySources = input.canarySources.filter((source) => source.robotsAllowed && (source.legalNotesPresent ?? Boolean(source.source.legalNotes.trim())));
  const rollbackTriggers = uniqueSorted(readiness.flatMap((entry) => entry.rollbackTriggers));

  return {
    schemaVersion: "ti.adapter_runtime_enablement_packet.v1",
    generatedAt: input.generatedAt,
    readyForCanary: readiness.some((entry) => entry.readiness === "canary_only" || entry.readiness === "enabled") && blockers.length === 0,
    readyForDefaultEnablement: readiness.every((entry) => entry.readiness === "enabled") && blockers.length === 0,
    readiness,
    summary: {
      totalAdapters: readiness.length,
      enabled: readiness.filter((entry) => entry.readiness === "enabled").length,
      canaryOnly: readiness.filter((entry) => entry.readiness === "canary_only").length,
      disabled: readiness.filter((entry) => entry.readiness === "disabled").length,
      blocked: readiness.filter((entry) => entry.readiness === "blocked").length,
      blockers,
      warnings
    },
    rolloutControls: {
      canarySourceIds: uniqueSorted(canarySources.map((source) => source.source.id)),
      canaryUrlHashes: uniqueSorted(canarySources.map((source) => hashUrl(source.canonicalUrl ?? source.source.url))),
      browserWorkersEnabled: false,
      dynamicRequiresExplicitAllocation: true,
      screenshotStorage: "hash_only",
      rollbackTriggers
    },
    agentHandoffs: {
      agent01SourceRollout: ["approve canary source ids only when readiness is canary_only or enabled and blockers are empty"],
      agent02Scheduler: ["schedule canary cadence from pool caps; pause pools when readiness is blocked"],
      agent06EvidenceStorage: ["store screenshot hashes only; suppress raw screenshots and unsafe URLs"],
      agent07Quality: ["enforce parser confidence thresholds before extraction promotion"],
      agent09ApiContracts: ["expose readiness, rolloutControls, routeContract, and no-leak forbidden fields"],
      agent10Observability: ["gate release on blockers, rollbackTriggers, watch failure ratio, blocked failure ratio, and memory caps"]
    },
    routeContract: {
      safeForPublicApi: true,
      stableFields: ["schemaVersion", "generatedAt", "readyForCanary", "readyForDefaultEnablement", "readiness", "summary", "rolloutControls", "agentHandoffs", "routeContract", "safety"],
      forbiddenFields: ["url", "canonicalUrl", "rawText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "screenshotBytes"]
    },
    safety: safetyDefaults()
  };
}

function buildRuntimeReadiness(
  config: AdapterRuntimeConfig,
  input: AdapterRuntimeEnablementInput,
  observations: AdapterFailureObservationDto[]
): AdapterRuntimeReadinessDto {
  const canarySources = input.canarySources.filter((source) => source.sourceFamily === config.sourceFamily);
  const acceptedCanaries = canarySources.filter((source) => source.robotsAllowed && (source.legalNotesPresent ?? Boolean(source.source.legalNotes.trim())));
  const parserConfidenceMet = acceptedCanaries.every((source) => source.parserProfile.profile === config.parserProfile && source.parserProfile.extractionScore >= config.minParserConfidence);
  const byteCapMet = acceptedCanaries.every((source) => source.observedContentLengthBytes === undefined || source.observedContentLengthBytes <= Math.min(source.maxBytes, input.poolCaps.maxBytes));
  const failureRatio = observations.length ? observations.filter((observation) => observation.outcome !== "ok").length / observations.length : 0;
  const blockedRatio = observations.length ? observations.filter((observation) => observation.outcome === "blocked").length / observations.length : 0;
  const observatoryHealthy = failureRatio <= input.thresholds.maxWatchFailureRatio && blockedRatio <= input.thresholds.maxBlockedFailureRatio;
  const evidenceYieldMet = acceptedCanaries.every((source) => (source.expectedEvidenceYield ?? 1) >= input.thresholds.minEvidenceYield);
  const memoryCapMet = config.memoryCapMb <= input.poolCaps.memoryCapMb;
  const timeoutCapMet = config.timeoutMs <= input.poolCaps.timeoutMs;
  const dynamicDisabled = config.adapter !== "dynamic_public_browser" || !input.browserPlan.enabled;

  const blockers = [
    ...(acceptedCanaries.length === 0 ? [`${config.adapter}_canary_allowlist_empty`] : []),
    ...(!parserConfidenceMet ? [`${config.adapter}_parser_confidence_below_threshold`] : []),
    ...(!byteCapMet ? [`${config.adapter}_byte_cap_exceeded`] : []),
    ...(!observatoryHealthy ? [`${config.adapter}_observatory_failure_ratio_high`] : []),
    ...(!evidenceYieldMet ? [`${config.adapter}_evidence_yield_low`] : []),
    ...(!memoryCapMet ? [`${config.adapter}_memory_cap_exceeded`] : []),
    ...(!timeoutCapMet ? [`${config.adapter}_timeout_cap_exceeded`] : []),
    ...(!dynamicDisabled ? ["dynamic_public_browser_not_disabled_by_default"] : []),
    ...(config.adapter === "dynamic_public_browser" && !input.browserPlan.policy.robotsAllowed ? ["dynamic_public_browser_robots_policy_hold"] : []),
    ...(config.adapter === "dynamic_public_browser" && !input.browserPlan.policy.legalNotesPresent ? ["dynamic_public_browser_legal_notes_missing"] : [])
  ];
  const warnings = [
    ...(observations.some((observation) => observation.outcome === "watch") ? [`${config.adapter}_watch_failures_present`] : []),
    ...(acceptedCanaries.some((source) => (source.expectedEvidenceYield ?? 1) < input.thresholds.minEvidenceYield + 0.15) ? [`${config.adapter}_evidence_yield_near_floor`] : [])
  ];
  const readiness = blockers.length
    ? "blocked"
    : config.enabledByDefault
      ? "enabled"
      : config.canaryEligible
        ? "canary_only"
        : "disabled";

  return {
    schemaVersion: "ti.adapter_runtime_readiness.v1",
    generatedAt: input.generatedAt,
    adapter: config.adapter,
    sourceFamily: config.sourceFamily,
    parserProfile: config.parserProfile,
    readiness,
    enabledByDefault: config.enabledByDefault && readiness === "enabled",
    canaryOnly: readiness === "canary_only",
    canarySourceIds: uniqueSorted(acceptedCanaries.map((source) => source.source.id)),
    canaryUrlHashes: uniqueSorted(acceptedCanaries.map((source) => hashUrl(source.canonicalUrl ?? source.source.url))),
    workerPool: {
      maxWorkers: config.maxWorkers,
      memoryCapMb: config.memoryCapMb,
      timeoutMs: config.timeoutMs,
      maxBytes: Math.min(config.maxBytes, input.poolCaps.maxBytes)
    },
    gates: {
      canaryAllowlist: acceptedCanaries.length > 0,
      robotsAllowed: acceptedCanaries.every((source) => source.robotsAllowed),
      legalNotesPresent: acceptedCanaries.every((source) => source.legalNotesPresent ?? Boolean(source.source.legalNotes.trim())),
      parserConfidenceMet,
      byteCapMet,
      observatoryHealthy,
      browserDisabledByDefault: dynamicDisabled,
      screenshotHashOnly: true
    },
    rollbackTriggers: rollbackTriggersFor(config.adapter),
    blockers,
    warnings,
    handoffs: handoffsFor(readiness, config.adapter),
    safety: safetyDefaults()
  };
}

interface AdapterRuntimeConfig {
  adapter: AdapterRuntimePoolName;
  sourceFamily: AdapterObservatorySourceFamily;
  parserProfile: ParserProfileName;
  enabledByDefault: boolean;
  canaryEligible: boolean;
  maxWorkers: number;
  memoryCapMb: number;
  timeoutMs: number;
  maxBytes: number;
  minParserConfidence: number;
}

function adapterRuntimeConfigs(input: AdapterRuntimeEnablementInput): AdapterRuntimeConfig[] {
  return [
    {
      adapter: "static_html",
      sourceFamily: "static_html",
      parserProfile: "static_html",
      enabledByDefault: true,
      canaryEligible: true,
      maxWorkers: input.poolCaps.staticMaxWorkers,
      memoryCapMb: Math.min(256, input.poolCaps.memoryCapMb),
      timeoutMs: Math.min(10_000, input.poolCaps.timeoutMs),
      maxBytes: input.poolCaps.maxBytes,
      minParserConfidence: input.thresholds.staticMinParserConfidence
    },
    {
      adapter: "rss_feed",
      sourceFamily: "rss_feed",
      parserProfile: "rss_entry",
      enabledByDefault: true,
      canaryEligible: true,
      maxWorkers: input.poolCaps.rssMaxWorkers,
      memoryCapMb: Math.min(192, input.poolCaps.memoryCapMb),
      timeoutMs: Math.min(8_000, input.poolCaps.timeoutMs),
      maxBytes: Math.min(1_000_000, input.poolCaps.maxBytes),
      minParserConfidence: input.thresholds.rssMinParserConfidence
    },
    {
      adapter: "dynamic_public_browser",
      sourceFamily: "dynamic_page",
      parserProfile: "dynamic_page",
      enabledByDefault: false,
      canaryEligible: true,
      maxWorkers: Math.min(input.poolCaps.dynamicMaxWorkers, input.browserPlan.resourceCaps.maxWorkers),
      memoryCapMb: input.browserPlan.resourceCaps.memoryCapMb,
      timeoutMs: input.browserPlan.resourceCaps.timeoutMs,
      maxBytes: Math.min(5_000_000, input.poolCaps.maxBytes),
      minParserConfidence: input.thresholds.dynamicMinParserConfidence
    },
    {
      adapter: "pdf_report",
      sourceFamily: "pdf_report",
      parserProfile: "pdf_report",
      enabledByDefault: false,
      canaryEligible: true,
      maxWorkers: input.poolCaps.pdfMaxWorkers,
      memoryCapMb: Math.min(768, input.poolCaps.memoryCapMb),
      timeoutMs: Math.min(20_000, input.poolCaps.timeoutMs),
      maxBytes: Math.min(10_000_000, input.poolCaps.maxBytes),
      minParserConfidence: input.thresholds.pdfMinParserConfidence
    },
    {
      adapter: "public_channel_handoff",
      sourceFamily: "public_channel",
      parserProfile: "public_channel_handoff",
      enabledByDefault: false,
      canaryEligible: true,
      maxWorkers: input.poolCaps.publicChannelMaxWorkers,
      memoryCapMb: Math.min(256, input.poolCaps.memoryCapMb),
      timeoutMs: Math.min(10_000, input.poolCaps.timeoutMs),
      maxBytes: Math.min(500_000, input.poolCaps.maxBytes),
      minParserConfidence: input.thresholds.publicChannelMinParserConfidence
    },
    {
      adapter: "advisory_signal",
      sourceFamily: "advisory_signal",
      parserProfile: "static_html",
      enabledByDefault: true,
      canaryEligible: true,
      maxWorkers: input.poolCaps.advisoryMaxWorkers,
      memoryCapMb: Math.min(256, input.poolCaps.memoryCapMb),
      timeoutMs: Math.min(8_000, input.poolCaps.timeoutMs),
      maxBytes: Math.min(1_000_000, input.poolCaps.maxBytes),
      minParserConfidence: input.thresholds.advisoryMinParserConfidence
    }
  ];
}

function rollbackTriggersFor(adapter: AdapterRuntimePoolName): string[] {
  const common = ["parser_confidence_below_threshold", "blocked_failure_ratio_exceeded", "policy_hold_detected", "unsafe_serialization_detected"];
  if (adapter === "dynamic_public_browser") return [...common, "browser_memory_cap_exceeded", "browser_timeout_spike", "raw_screenshot_storage_attempt"];
  if (adapter === "pdf_report") return [...common, "pdf_byte_cap_exceeded", "pdf_extraction_timeout_spike"];
  return common;
}

function handoffsFor(readiness: AdapterRuntimeReadinessState, adapter: AdapterRuntimePoolName): AdapterRuntimeHandoffDto {
  if (readiness === "blocked") {
    return {
      agent01SourceRollout: "hold_source",
      agent02Scheduler: "pause_pool",
      agent06EvidenceStorage: "suppress_capture",
      agent07Quality: "block_extraction",
      agent09ApiContracts: "blocked",
      agent10Observability: "hold"
    };
  }
  if (readiness === "canary_only" || adapter === "dynamic_public_browser" || adapter === "pdf_report") {
    return {
      agent01SourceRollout: "approve_canary",
      agent02Scheduler: "canary_cadence",
      agent06EvidenceStorage: adapter === "dynamic_public_browser" ? "hash_only_screenshots" : "normal_capture",
      agent07Quality: "watch_confidence",
      agent09ApiContracts: "canary_only",
      agent10Observability: "watch"
    };
  }
  return {
    agent01SourceRollout: "no_action",
    agent02Scheduler: "normal_cadence",
    agent06EvidenceStorage: "normal_capture",
    agent07Quality: "accept",
    agent09ApiContracts: "ready",
    agent10Observability: "green"
  };
}

function hashUrl(url: string): string {
  return `urlhash:${hashContent(url).slice(0, 16)}`;
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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}
