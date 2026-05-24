import type { AdapterCertificationMode, AdapterCertificationPacketDto } from "./adapterCertification.ts";
import type { AdapterRepairTriagePacketDto } from "./adapterRepairTriage.ts";
import type { AdapterRuntimeEnablementPacketDto, AdapterRuntimeReadinessState } from "./adapterRuntimeEnablement.ts";
import type { AdapterSlaAdapterKind, AdapterSlaRepairPacketDto } from "./adapterSlaRepair.ts";
import { hashContent } from "../utils.ts";

export type ProductionAdapterKind =
  | AdapterSlaAdapterKind
  | "github_security_feed";

export type ProductionAdapterRuntimeMode = "native_public_http" | "official_public_api" | "disabled_dynamic_isolation" | "metadata_handoff";
export type ProductionParserCertificationState = "certified" | "canary_only" | "needs_fixture" | "parser_degraded" | "disabled";
export type ProductionAdapterImplementationState = "implemented" | "contract_ready" | "canary_contract" | "blocked";

export interface ProductionAdapterRuntimeInput {
  generatedAt: string;
  runtimeEnablement: AdapterRuntimeEnablementPacketDto;
  certification: AdapterCertificationPacketDto;
  slaRepair: AdapterSlaRepairPacketDto;
  repairTriage: AdapterRepairTriagePacketDto;
}

export interface ProductionAdapterCapabilityDto {
  schemaVersion: "ti.production_adapter_capability.v1";
  generatedAt: string;
  adapter: ProductionAdapterKind;
  runtimeMode: ProductionAdapterRuntimeMode;
  implementationState: ProductionAdapterImplementationState;
  sourceFamily: string;
  parserProfile: string;
  parserCertificationState: ProductionParserCertificationState;
  limits: {
    maxBytes: number;
    timeoutMs: number;
    maxWorkers: number;
    languageSupport: string[];
  };
  policy: {
    publicOnly: true;
    robotsLegalRequired: true;
    restrictedMetadataOnly: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noPrivateChannelJoining: true;
    noCredentialCollection: true;
    noLeakedFileDownload: true;
    noThreatActorInteraction: true;
  };
  captureOutput: {
    requiredFields: string[];
    canonicalUrlHashOnly: true;
    contentHashRequired: true;
    provenanceRequired: true;
    evidenceReplayRefRequired: true;
    rawRestrictedFieldsForbidden: true;
  };
  dynamicIsolation: {
    browserWorkersEnabled: false;
    screenshotHashOnly: true;
    explicitApprovalRequired: boolean;
    featureFlag: "disabled_by_default";
  };
  retryBackoff: {
    supportsRetryAfter: boolean;
    supportsConditionalRequests: boolean;
    failureClasses: string[];
  };
  fixtureReplay: {
    requiredModes: AdapterCertificationMode[];
    coveredModes: AdapterCertificationMode[];
    missingModes: AdapterCertificationMode[];
  };
  blockers: string[];
  warnings: string[];
  handoffs: {
    agent01Activation: string;
    agent02Scheduler: string;
    agent04Coverage: string;
    agent06Evidence: string;
    agent07Quality: string;
    agent09Api: string;
    agent10Release: string;
  };
}

export interface ProductionCaptureMetadataContractDto {
  schemaVersion: "ti.production_capture_metadata_contract.v1";
  requiredFields: [
    "sourceId",
    "canonicalUrlHash",
    "contentHash",
    "fetchedAt",
    "language",
    "parserConfidence",
    "extractionWarnings",
    "provenance",
    "evidenceReplayRef"
  ];
  optionalFields: string[];
  forbiddenFields: string[];
  replayRefFormat: "evidence_replay_ref:<hash>";
  noLeakProof: {
    noRawUrls: true;
    noRawText: true;
    noHtml: true;
    noScreenshots: true;
    noObjectKeys: true;
    noCredentials: true;
    noPrivateInvites: true;
    noOnionLinks: true;
    noRestrictedMaterial: true;
  };
}

export interface ProductionAdapterRuntimeProgramDto {
  schemaVersion: "ti.production_adapter_runtime_program.v1";
  generatedAt: string;
  readyForApprovedPublicCollection: boolean;
  browserWorkersEnabled: false;
  capabilities: ProductionAdapterCapabilityDto[];
  captureMetadataContract: ProductionCaptureMetadataContractDto;
  fixtureMatrix: {
    requiredFixtures: AdapterCertificationMode[];
    adaptersCovered: ProductionAdapterKind[];
    missingByAdapter: Array<{
      adapter: ProductionAdapterKind;
      missingModes: AdapterCertificationMode[];
    }>;
  };
  implementationSummary: {
    implemented: number;
    contractReady: number;
    canaryContract: number;
    blocked: number;
    certified: number;
    canaryOnly: number;
    needsFixture: number;
    parserDegraded: number;
    disabled: number;
  };
  agentHandoffs: {
    agent01Activation: string[];
    agent02Scheduler: string[];
    agent04Coverage: string[];
    agent06Evidence: string[];
    agent07Quality: string[];
    agent09Api: string[];
    agent10Release: string[];
  };
  routeContract: {
    safeForPublicApi: true;
    stableFields: string[];
    forbiddenFields: string[];
  };
  safety: ProductionAdapterCapabilityDto["policy"] & {
    dryRunOnly: true;
    unsafeUrlExposed: false;
  };
}

const REQUIRED_FIXTURES: AdapterCertificationMode[] = [
  "success",
  "parser_drift",
  "stale_dates",
  "language_mismatch",
  "unsupported_mime",
  "timeout",
  "rate_limit",
  "duplicate_canonical",
  "truncated_capture",
  "empty_extraction"
];

export function buildProductionAdapterRuntimeProgram(input: ProductionAdapterRuntimeInput): ProductionAdapterRuntimeProgramDto {
  const capabilities = productionAdapterConfigs().map((config) => capabilityFor(config, input));
  const noBlocked = capabilities.every((capability) => capability.implementationState !== "blocked" && capability.parserCertificationState !== "disabled");
  const canCollect = capabilities.some((capability) => capability.implementationState === "implemented" && capability.parserCertificationState === "certified");

  return {
    schemaVersion: "ti.production_adapter_runtime_program.v1",
    generatedAt: input.generatedAt,
    readyForApprovedPublicCollection: noBlocked && canCollect,
    browserWorkersEnabled: false,
    capabilities,
    captureMetadataContract: captureMetadataContract(),
    fixtureMatrix: {
      requiredFixtures: REQUIRED_FIXTURES,
      adaptersCovered: capabilities.map((capability) => capability.adapter),
      missingByAdapter: capabilities
        .map((capability) => ({ adapter: capability.adapter, missingModes: capability.fixtureReplay.missingModes }))
        .filter((entry) => entry.missingModes.length > 0)
    },
    implementationSummary: {
      implemented: capabilities.filter((capability) => capability.implementationState === "implemented").length,
      contractReady: capabilities.filter((capability) => capability.implementationState === "contract_ready").length,
      canaryContract: capabilities.filter((capability) => capability.implementationState === "canary_contract").length,
      blocked: capabilities.filter((capability) => capability.implementationState === "blocked").length,
      certified: capabilities.filter((capability) => capability.parserCertificationState === "certified").length,
      canaryOnly: capabilities.filter((capability) => capability.parserCertificationState === "canary_only").length,
      needsFixture: capabilities.filter((capability) => capability.parserCertificationState === "needs_fixture").length,
      parserDegraded: capabilities.filter((capability) => capability.parserCertificationState === "parser_degraded").length,
      disabled: capabilities.filter((capability) => capability.parserCertificationState === "disabled").length
    },
    agentHandoffs: {
      agent01Activation: uniqueSorted(capabilities.map((capability) => capability.handoffs.agent01Activation)),
      agent02Scheduler: uniqueSorted(capabilities.map((capability) => capability.handoffs.agent02Scheduler)),
      agent04Coverage: uniqueSorted(capabilities.map((capability) => capability.handoffs.agent04Coverage)),
      agent06Evidence: uniqueSorted(capabilities.map((capability) => capability.handoffs.agent06Evidence)),
      agent07Quality: uniqueSorted(capabilities.map((capability) => capability.handoffs.agent07Quality)),
      agent09Api: uniqueSorted(capabilities.map((capability) => capability.handoffs.agent09Api)),
      agent10Release: uniqueSorted(capabilities.map((capability) => capability.handoffs.agent10Release))
    },
    routeContract: {
      safeForPublicApi: true,
      stableFields: ["schemaVersion", "generatedAt", "readyForApprovedPublicCollection", "browserWorkersEnabled", "capabilities", "captureMetadataContract", "fixtureMatrix", "implementationSummary", "agentHandoffs", "routeContract", "safety"],
      forbiddenFields: captureMetadataContract().forbiddenFields
    },
    safety: {
      ...policyDefaults(),
      dryRunOnly: true,
      unsafeUrlExposed: false
    }
  };
}

function capabilityFor(config: ProductionAdapterConfig, input: ProductionAdapterRuntimeInput): ProductionAdapterCapabilityDto {
  const runtime = input.runtimeEnablement.readiness.find((entry) => entry.adapter === config.runtimeAdapter);
  const gate = config.certificationAdapter
    ? input.certification.adapterGates.find((entry) => entry.adapter === config.certificationAdapter)
    : undefined;
  const contract = config.certificationAdapter
    ? input.slaRepair.contracts.find((entry) => entry.adapter === config.certificationAdapter)
    : undefined;
  const triage = input.repairTriage.recommendations.filter((recommendation) => recommendation.adapter === config.certificationAdapter);
  const missingModes = uniqueModes([...(gate?.missingModes ?? []), ...(config.extraMissingModes ?? [])]);
  const certificationState = certificationStateFor(runtime?.readiness, gate?.status, contract?.status, missingModes, config);
  const implementationState = implementationStateFor(config, runtime?.readiness, certificationState);
  const blockers = uniqueSorted([
    ...(runtime?.blockers ?? []),
    ...(gate?.holdReasons ?? []),
    ...triage.filter((recommendation) => recommendation.handoffs.agent10ReleaseGate === "hold").map((recommendation) => recommendation.action),
    ...(implementationState === "blocked" ? [`${config.adapter}_implementation_blocked`] : [])
  ]);
  const warnings = uniqueSorted([
    ...(runtime?.warnings ?? []),
    ...(contract?.breaches.map((breach) => breach.code) ?? []),
    ...triage.filter((recommendation) => recommendation.handoffs.agent10ReleaseGate === "watch").map((recommendation) => recommendation.action)
  ]);

  return {
    schemaVersion: "ti.production_adapter_capability.v1",
    generatedAt: input.generatedAt,
    adapter: config.adapter,
    runtimeMode: config.runtimeMode,
    implementationState,
    sourceFamily: config.sourceFamily,
    parserProfile: config.parserProfile,
    parserCertificationState: certificationState,
    limits: {
      maxBytes: runtime?.workerPool.maxBytes ?? config.maxBytes,
      timeoutMs: runtime?.workerPool.timeoutMs ?? config.timeoutMs,
      maxWorkers: runtime?.workerPool.maxWorkers ?? config.maxWorkers,
      languageSupport: config.languageSupport
    },
    policy: policyDefaults(),
    captureOutput: {
      requiredFields: [...captureMetadataContract().requiredFields],
      canonicalUrlHashOnly: true,
      contentHashRequired: true,
      provenanceRequired: true,
      evidenceReplayRefRequired: true,
      rawRestrictedFieldsForbidden: true
    },
    dynamicIsolation: {
      browserWorkersEnabled: false,
      screenshotHashOnly: true,
      explicitApprovalRequired: config.adapter === "dynamic_public_browser",
      featureFlag: "disabled_by_default"
    },
    retryBackoff: {
      supportsRetryAfter: config.supportsRetryAfter,
      supportsConditionalRequests: config.supportsConditionalRequests,
      failureClasses: config.failureClasses
    },
    fixtureReplay: {
      requiredModes: REQUIRED_FIXTURES,
      coveredModes: uniqueModes(REQUIRED_FIXTURES.filter((mode) => !missingModes.includes(mode))),
      missingModes
    },
    blockers,
    warnings,
    handoffs: handoffsFor(config, implementationState, certificationState, blockers, warnings)
  };
}

function certificationStateFor(
  readiness: AdapterRuntimeReadinessState | undefined,
  gateStatus: "certified" | "watch" | "hold" | undefined,
  slaStatus: "pass" | "warn" | "hold" | undefined,
  missingModes: AdapterCertificationMode[],
  config: ProductionAdapterConfig
): ProductionParserCertificationState {
  if (readiness === "blocked" || gateStatus === "hold" || slaStatus === "hold") return "disabled";
  if (slaStatus === "warn" || gateStatus === "watch") return "parser_degraded";
  if (missingModes.length > 0) return "needs_fixture";
  if (config.canaryOnly || readiness === "canary_only") return "canary_only";
  return "certified";
}

function implementationStateFor(
  config: ProductionAdapterConfig,
  readiness: AdapterRuntimeReadinessState | undefined,
  certificationState: ProductionParserCertificationState
): ProductionAdapterImplementationState {
  if (certificationState === "disabled" || readiness === "blocked") return "blocked";
  if (config.implemented && certificationState === "certified") return "implemented";
  if (config.implemented) return "canary_contract";
  if (config.canaryOnly || certificationState === "canary_only") return "canary_contract";
  return "contract_ready";
}

function handoffsFor(
  config: ProductionAdapterConfig,
  implementationState: ProductionAdapterImplementationState,
  certificationState: ProductionParserCertificationState,
  blockers: string[],
  warnings: string[]
): ProductionAdapterCapabilityDto["handoffs"] {
  const blocked = blockers.length > 0 || implementationState === "blocked" || certificationState === "disabled";
  return {
    agent01Activation: blocked ? "hold_or_disable_source_activation" : implementationState === "implemented" ? "allow_approved_public_activation" : "approve_canary_only",
    agent02Scheduler: blocked ? "pause_adapter_pool" : warnings.length ? "canary_or_backoff_cadence" : "normal_public_cadence",
    agent04Coverage: blocked ? "do_not_count_as_public_coverage" : certificationState === "certified" ? "count_certified_public_coverage" : "count_canary_coverage_with_caveat",
    agent06Evidence: config.adapter === "dynamic_public_browser" ? "hash_only_dynamic_evidence" : blocked ? "hold_evidence_replay" : "record_capture_metadata_and_replay_ref",
    agent07Quality: blocked ? "hold_extraction" : certificationState === "parser_degraded" || certificationState === "needs_fixture" ? "review_parser_quality" : "accept_certified_parser",
    agent09Api: blocked ? "show_adapter_hold_warning" : "expose_stable_capture_metadata",
    agent10Release: blocked ? "release_hold" : warnings.length ? "watch" : "green"
  };
}

interface ProductionAdapterConfig {
  adapter: ProductionAdapterKind;
  runtimeAdapter: Exclude<ProductionAdapterKind, "multilingual_handoff" | "github_security_feed">;
  certificationAdapter?: AdapterSlaAdapterKind;
  runtimeMode: ProductionAdapterRuntimeMode;
  sourceFamily: string;
  parserProfile: string;
  implemented: boolean;
  canaryOnly: boolean;
  maxBytes: number;
  timeoutMs: number;
  maxWorkers: number;
  languageSupport: string[];
  supportsRetryAfter: boolean;
  supportsConditionalRequests: boolean;
  failureClasses: string[];
  extraMissingModes?: AdapterCertificationMode[];
}

function productionAdapterConfigs(): ProductionAdapterConfig[] {
  return [
    {
      adapter: "rss_feed",
      runtimeAdapter: "rss_feed",
      certificationAdapter: "rss_feed",
      runtimeMode: "native_public_http",
      sourceFamily: "rss_feed",
      parserProfile: "rss_entry",
      implemented: true,
      canaryOnly: false,
      maxBytes: 2_000_000,
      timeoutMs: 15_000,
      maxWorkers: 24,
      languageSupport: ["en", "nb", "es", "ru", "zh", "fa"],
      supportsRetryAfter: true,
      supportsConditionalRequests: true,
      failureClasses: ["not_modified", "rate_limited", "unsupported_mime", "timeout", "malformed_feed"]
    },
    {
      adapter: "static_html",
      runtimeAdapter: "static_html",
      certificationAdapter: "static_html",
      runtimeMode: "native_public_http",
      sourceFamily: "static_html",
      parserProfile: "static_html",
      implemented: true,
      canaryOnly: false,
      maxBytes: 5_000_000,
      timeoutMs: 15_000,
      maxWorkers: 32,
      languageSupport: ["en", "nb", "es", "ru", "zh", "fa"],
      supportsRetryAfter: true,
      supportsConditionalRequests: true,
      failureClasses: ["robots_blocked", "not_modified", "rate_limited", "unsupported_mime", "too_large", "parser_confidence_low"]
    },
    {
      adapter: "pdf_report",
      runtimeAdapter: "pdf_report",
      certificationAdapter: "pdf_report",
      runtimeMode: "native_public_http",
      sourceFamily: "pdf_report",
      parserProfile: "pdf_report",
      implemented: true,
      canaryOnly: true,
      maxBytes: 10_000_000,
      timeoutMs: 20_000,
      maxWorkers: 4,
      languageSupport: ["en", "nb", "es", "ru", "zh", "fa"],
      supportsRetryAfter: true,
      supportsConditionalRequests: false,
      failureClasses: ["unsupported_media", "content_too_large", "parser_confidence_low", "truncated_capture"]
    },
    {
      adapter: "dynamic_public_browser",
      runtimeAdapter: "dynamic_public_browser",
      certificationAdapter: "dynamic_public_browser",
      runtimeMode: "disabled_dynamic_isolation",
      sourceFamily: "dynamic_page",
      parserProfile: "dynamic_page",
      implemented: false,
      canaryOnly: true,
      maxBytes: 2_000_000,
      timeoutMs: 15_000,
      maxWorkers: 2,
      languageSupport: ["en", "nb", "es", "ru", "zh", "fa"],
      supportsRetryAfter: true,
      supportsConditionalRequests: false,
      failureClasses: ["js_render_timeout", "redirect_chain", "blank_page", "screenshot_hash_mismatch", "queue_pressure"]
    },
    {
      adapter: "public_channel_handoff",
      runtimeAdapter: "public_channel_handoff",
      certificationAdapter: "public_channel_handoff",
      runtimeMode: "official_public_api",
      sourceFamily: "public_channel",
      parserProfile: "public_channel_handoff",
      implemented: true,
      canaryOnly: true,
      maxBytes: 1_000_000,
      timeoutMs: 15_000,
      maxWorkers: 4,
      languageSupport: ["en", "nb", "es", "ru", "zh", "fa"],
      supportsRetryAfter: true,
      supportsConditionalRequests: false,
      failureClasses: ["rate_limited", "policy_disabled", "duplicate_message", "edited_or_deleted"]
    },
    {
      adapter: "advisory_signal",
      runtimeAdapter: "advisory_signal",
      certificationAdapter: "advisory_signal",
      runtimeMode: "native_public_http",
      sourceFamily: "advisory_signal",
      parserProfile: "static_html",
      implemented: true,
      canaryOnly: false,
      maxBytes: 2_000_000,
      timeoutMs: 15_000,
      maxWorkers: 8,
      languageSupport: ["en"],
      supportsRetryAfter: true,
      supportsConditionalRequests: true,
      failureClasses: ["rate_limited", "unavailable", "unsupported_mime", "stale_dates"]
    },
    {
      adapter: "github_security_feed",
      runtimeAdapter: "advisory_signal",
      certificationAdapter: "advisory_signal",
      runtimeMode: "official_public_api",
      sourceFamily: "github_security_advisory",
      parserProfile: "advisory_signal",
      implemented: false,
      canaryOnly: false,
      maxBytes: 1_000_000,
      timeoutMs: 15_000,
      maxWorkers: 4,
      languageSupport: ["en"],
      supportsRetryAfter: true,
      supportsConditionalRequests: true,
      failureClasses: ["rate_limited", "unavailable", "api_schema_drift"]
    },
    {
      adapter: "multilingual_handoff",
      runtimeAdapter: "static_html",
      certificationAdapter: "multilingual_handoff",
      runtimeMode: "metadata_handoff",
      sourceFamily: "multilingual_handoff",
      parserProfile: "translation_handoff",
      implemented: true,
      canaryOnly: true,
      maxBytes: 0,
      timeoutMs: 0,
      maxWorkers: 0,
      languageSupport: ["en", "nb", "es", "ru", "zh", "fa", "mixed"],
      supportsRetryAfter: false,
      supportsConditionalRequests: false,
      failureClasses: ["language_detection_drift", "mixed_language", "citation_span_missing"]
    }
  ];
}

function captureMetadataContract(): ProductionCaptureMetadataContractDto {
  return {
    schemaVersion: "ti.production_capture_metadata_contract.v1",
    requiredFields: ["sourceId", "canonicalUrlHash", "contentHash", "fetchedAt", "language", "parserConfidence", "extractionWarnings", "provenance", "evidenceReplayRef"],
    optionalFields: ["etag", "lastModified", "responseStatus", "statusClass", "retryAfterSeconds", "redirectChainHash", "contentBytes", "citationSpanCount", "linkCount", "screenshotHash", "objectRefHash", "legalNotesHash", "robotsState"],
    forbiddenFields: ["url", "canonicalUrl", "requestedUrl", "finalUrl", "rawText", "translatedText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "screenshotBytes", "downloadUrl", "objectRef", "objectKey"],
    replayRefFormat: "evidence_replay_ref:<hash>",
    noLeakProof: {
      noRawUrls: true,
      noRawText: true,
      noHtml: true,
      noScreenshots: true,
      noObjectKeys: true,
      noCredentials: true,
      noPrivateInvites: true,
      noOnionLinks: true,
      noRestrictedMaterial: true
    }
  };
}

export function productionEvidenceReplayRef(input: { sourceId: string; canonicalUrlHash: string; contentHash: string; fetchedAt: string }): string {
  return `evidence_replay_ref:${hashContent(`${input.sourceId}:${input.canonicalUrlHash}:${input.contentHash}:${input.fetchedAt}`).slice(0, 16)}`;
}

function policyDefaults(): ProductionAdapterCapabilityDto["policy"] {
  return {
    publicOnly: true,
    robotsLegalRequired: true,
    restrictedMetadataOnly: true,
    noAuthBypass: true,
    noCaptchaSolving: true,
    noPrivateChannelJoining: true,
    noCredentialCollection: true,
    noLeakedFileDownload: true,
    noThreatActorInteraction: true
  };
}

function uniqueModes(values: AdapterCertificationMode[]): AdapterCertificationMode[] {
  const order = new Map(REQUIRED_FIXTURES.map((mode, index) => [mode, index]));
  return [...new Set(values)].sort((left, right) => (order.get(left) ?? 99) - (order.get(right) ?? 99));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
