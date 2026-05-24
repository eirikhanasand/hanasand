import type { AdapterSlaAdapterKind, AdapterSlaRepairPacketDto } from "./adapterSlaRepair.ts";
import { hashContent } from "../utils.ts";

export type AdapterCertificationMode =
  | "success"
  | "parser_drift"
  | "stale_dates"
  | "language_mismatch"
  | "unsupported_mime"
  | "timeout"
  | "rate_limit"
  | "duplicate_canonical"
  | "truncated_capture"
  | "empty_extraction";

export type AdapterCertificationStatus = "certified" | "watch" | "hold";

export interface AdapterCertificationFixtureInput {
  fixtureId: string;
  adapter: AdapterSlaAdapterKind;
  mode: AdapterCertificationMode;
  sourceId: string;
  url: string;
  objectRef?: string;
  contentHash?: string;
  parserVersion: string;
  parserConfidence: number;
  extractionStats: {
    bytesRead: number;
    bytesAllowed: number;
    textLength: number;
    linkCount: number;
    citationSpanCount: number;
    warningCount: number;
  };
  publishedAt?: string;
  collectedAt: string;
  language?: {
    declared?: string;
    detected?: string;
    confidence?: number;
  };
  retryAfterSeconds?: number;
  explicitBoundedDynamic?: boolean;
}

export interface AdapterFixtureReplayResultDto {
  schemaVersion: "ti.adapter_fixture_replay.v1";
  generatedAt: string;
  fixtureId: string;
  adapter: AdapterSlaAdapterKind;
  mode: AdapterCertificationMode;
  sourceId: string;
  fixtureUrlHash: string;
  objectRefHash?: string;
  contentHash: string;
  parserVersion: string;
  status: AdapterCertificationStatus;
  failureCode?: AdapterCertificationMode | "dynamic_requires_explicit_bounded_flag";
  evidence: {
    objectRefHashOnly: boolean;
    contentHashOnly: true;
    rawContentExposed: false;
    screenshotBytesExposed: false;
  };
  extractionStats: AdapterCertificationFixtureInput["extractionStats"];
  replaySignals: {
    parserConfidence: number;
    staleDate: boolean;
    languageMismatch: boolean;
    unsupportedMime: boolean;
    timeout: boolean;
    rateLimited: boolean;
    duplicateCanonical: boolean;
    truncatedCapture: boolean;
    emptyExtraction: boolean;
    dynamicExplicitlyBounded: boolean;
    retryAfterSeconds?: number;
  };
  handoffs: {
    agent01SourceActivation: "allow_certified" | "hold_source_activation" | "review_source";
    agent02CadenceBackoff: "normal" | "retry_after" | "reduce_cadence" | "pause";
    agent04PublicSourceExpansion: "eligible" | "watch" | "exclude_until_repaired";
    agent06EvidenceReplay: "replay_hash_only" | "suppress_duplicate" | "hold_replay";
    agent07QualityGate: "pass" | "review" | "hold";
    agent09ApiWarningField: "none" | `adapter_cert.${AdapterCertificationMode}` | "adapter_cert.dynamic_requires_explicit_bounded_flag";
    agent10ReleaseHold: "none" | "watch" | "hold";
  };
}

export interface AdapterCertificationPacketDto {
  schemaVersion: "ti.adapter_certification_packet.v1";
  generatedAt: string;
  readyForLiveActorCollection: boolean;
  browserWorkersEnabled: false;
  dynamicRequiresExplicitBoundedFlag: true;
  fixtures: AdapterFixtureReplayResultDto[];
  adapterGates: AdapterCertificationGateDto[];
  slaRepairSummary: {
    readyForPromotion: boolean;
    holdContracts: number;
    repairCount: number;
    highPriorityRepairCount: number;
  };
  summary: {
    totalFixtures: number;
    certified: number;
    watch: number;
    hold: number;
    modesCovered: AdapterCertificationMode[];
    adaptersCovered: AdapterSlaAdapterKind[];
    warningCodes: string[];
    sourceIds: string[];
    fixtureUrlHashes: string[];
  };
  routeContract: {
    safeForPublicApi: true;
    stableFields: string[];
    forbiddenFields: string[];
    compactApiProof: {
      noRawUrls: true;
      noRawText: true;
      noHtml: true;
      noScreenshots: true;
      noCredentials: true;
      noPrivateInvites: true;
      noOnionLinks: true;
      noRestrictedMaterial: true;
    };
  };
  safety: {
    publicOnly: true;
    dryRunOnly: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noPrivateCommunities: true;
    noExploitPayloadDownload: true;
    noRestrictedRawMaterial: true;
    unsafeUrlExposed: false;
  };
  agentHandoffs: {
    agent01: string[];
    agent02: string[];
    agent04: string[];
    agent06: string[];
    agent07: string[];
    agent09: string[];
    agent10: string[];
  };
}

export interface AdapterCertificationGateDto {
  adapter: AdapterSlaAdapterKind;
  status: AdapterCertificationStatus;
  requiredModesCovered: AdapterCertificationMode[];
  missingModes: AdapterCertificationMode[];
  holdReasons: string[];
  releaseDecision: "promote" | "watch" | "hold";
}

export function replayAdapterCertificationFixtures(input: {
  generatedAt: string;
  fixtures: AdapterCertificationFixtureInput[];
  slaRepairPacket: AdapterSlaRepairPacketDto;
  requiredModes?: AdapterCertificationMode[];
}): AdapterCertificationPacketDto {
  const requiredModes = input.requiredModes ?? DEFAULT_REQUIRED_MODES;
  const fixtures = input.fixtures.map((fixture) => replayFixture(input.generatedAt, fixture));
  const adapterGates = adapterKinds().map((adapter) => certificationGate(adapter, fixtures, requiredModes, input.slaRepairPacket));
  const hold = fixtures.filter((fixture) => fixture.status === "hold").length + adapterGates.filter((gate) => gate.status === "hold").length;
  const watch = fixtures.filter((fixture) => fixture.status === "watch").length + adapterGates.filter((gate) => gate.status === "watch").length;
  const warningCodes = uniqueSorted(fixtures.map((fixture) => fixture.handoffs.agent09ApiWarningField).filter((field) => field !== "none"));
  const highPriorityRepairCount = input.slaRepairPacket.repairs.filter((repair) => repair.priority === "high").length;

  return {
    schemaVersion: "ti.adapter_certification_packet.v1",
    generatedAt: input.generatedAt,
    readyForLiveActorCollection: hold === 0 && input.slaRepairPacket.readyForPromotion,
    browserWorkersEnabled: false,
    dynamicRequiresExplicitBoundedFlag: true,
    fixtures,
    adapterGates,
    slaRepairSummary: {
      readyForPromotion: input.slaRepairPacket.readyForPromotion,
      holdContracts: input.slaRepairPacket.contracts.filter((contract) => contract.status === "hold").length,
      repairCount: input.slaRepairPacket.repairs.length,
      highPriorityRepairCount
    },
    summary: {
      totalFixtures: fixtures.length,
      certified: fixtures.filter((fixture) => fixture.status === "certified").length,
      watch: fixtures.filter((fixture) => fixture.status === "watch").length,
      hold: fixtures.filter((fixture) => fixture.status === "hold").length,
      modesCovered: uniqueModes(fixtures.map((fixture) => fixture.mode)),
      adaptersCovered: uniqueAdapters(fixtures.map((fixture) => fixture.adapter)),
      warningCodes,
      sourceIds: uniqueSorted(fixtures.map((fixture) => fixture.sourceId)),
      fixtureUrlHashes: uniqueSorted(fixtures.map((fixture) => fixture.fixtureUrlHash))
    },
    routeContract: {
      safeForPublicApi: true,
      stableFields: ["schemaVersion", "generatedAt", "readyForLiveActorCollection", "browserWorkersEnabled", "dynamicRequiresExplicitBoundedFlag", "fixtures", "adapterGates", "slaRepairSummary", "summary", "routeContract", "safety", "agentHandoffs"],
      forbiddenFields: ["url", "canonicalUrl", "rawText", "translatedText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "screenshotBytes", "downloadUrl", "objectRef"],
      compactApiProof: {
        noRawUrls: true,
        noRawText: true,
        noHtml: true,
        noScreenshots: true,
        noCredentials: true,
        noPrivateInvites: true,
        noOnionLinks: true,
        noRestrictedMaterial: true
      }
    },
    safety: safetyDefaults(),
    agentHandoffs: {
      agent01: uniqueSorted(fixtures.map((fixture) => fixture.handoffs.agent01SourceActivation)),
      agent02: uniqueSorted(fixtures.map((fixture) => fixture.handoffs.agent02CadenceBackoff)),
      agent04: uniqueSorted(fixtures.map((fixture) => fixture.handoffs.agent04PublicSourceExpansion)),
      agent06: uniqueSorted(fixtures.map((fixture) => fixture.handoffs.agent06EvidenceReplay)),
      agent07: uniqueSorted(fixtures.map((fixture) => fixture.handoffs.agent07QualityGate)),
      agent09: warningCodes,
      agent10: uniqueSorted(fixtures.map((fixture) => fixture.handoffs.agent10ReleaseHold))
    }
  };
}

function replayFixture(generatedAt: string, fixture: AdapterCertificationFixtureInput): AdapterFixtureReplayResultDto {
  const dynamicUnbounded = fixture.adapter === "dynamic_public_browser" && !fixture.explicitBoundedDynamic;
  const staleDate = Boolean(fixture.publishedAt && Date.parse(fixture.publishedAt) < Date.parse(fixture.collectedAt) - 1000 * 60 * 60 * 24 * 30);
  const languageMismatch = Boolean(fixture.language?.declared && fixture.language.detected && fixture.language.declared !== fixture.language.detected);
  const truncatedCapture = fixture.extractionStats.bytesRead >= fixture.extractionStats.bytesAllowed || fixture.mode === "truncated_capture";
  const emptyExtraction = fixture.extractionStats.textLength === 0 || fixture.mode === "empty_extraction";
  const failureCode = dynamicUnbounded ? "dynamic_requires_explicit_bounded_flag" : fixture.mode === "success" ? undefined : fixture.mode;
  const status = statusFor(fixture.mode, dynamicUnbounded);

  return {
    schemaVersion: "ti.adapter_fixture_replay.v1",
    generatedAt,
    fixtureId: fixture.fixtureId,
    adapter: fixture.adapter,
    mode: fixture.mode,
    sourceId: fixture.sourceId,
    fixtureUrlHash: `urlhash:${hashContent(fixture.url).slice(0, 16)}`,
    objectRefHash: fixture.objectRef ? `objectref:${hashContent(fixture.objectRef).slice(0, 16)}` : undefined,
    contentHash: fixture.contentHash ?? `contenthash:${hashContent(`${fixture.fixtureId}:${fixture.parserVersion}:${fixture.mode}`).slice(0, 16)}`,
    parserVersion: fixture.parserVersion,
    status,
    failureCode,
    evidence: {
      objectRefHashOnly: Boolean(fixture.objectRef),
      contentHashOnly: true,
      rawContentExposed: false,
      screenshotBytesExposed: false
    },
    extractionStats: fixture.extractionStats,
    replaySignals: {
      parserConfidence: roundScore(fixture.parserConfidence),
      staleDate: staleDate || fixture.mode === "stale_dates",
      languageMismatch: languageMismatch || fixture.mode === "language_mismatch",
      unsupportedMime: fixture.mode === "unsupported_mime",
      timeout: fixture.mode === "timeout",
      rateLimited: fixture.mode === "rate_limit",
      duplicateCanonical: fixture.mode === "duplicate_canonical",
      truncatedCapture,
      emptyExtraction,
      dynamicExplicitlyBounded: fixture.adapter !== "dynamic_public_browser" || Boolean(fixture.explicitBoundedDynamic),
      retryAfterSeconds: fixture.retryAfterSeconds
    },
    handoffs: handoffsFor(fixture.mode, status, dynamicUnbounded)
  };
}

function certificationGate(
  adapter: AdapterSlaAdapterKind,
  fixtures: AdapterFixtureReplayResultDto[],
  requiredModes: AdapterCertificationMode[],
  slaRepairPacket: AdapterSlaRepairPacketDto
): AdapterCertificationGateDto {
  const adapterFixtures = fixtures.filter((fixture) => fixture.adapter === adapter);
  const covered = uniqueModes(adapterFixtures.map((fixture) => fixture.mode).filter((mode) => requiredModes.includes(mode)));
  const missingModes = requiredModes.filter((mode) => !covered.includes(mode));
  const slaContract = slaRepairPacket.contracts.find((contract) => contract.adapter === adapter);
  const adapterRepairs = slaRepairPacket.repairs.filter((repair) => repair.adapter === adapter);
  const holdReasons = [
    ...(missingModes.length ? [`missing_fixture_modes:${missingModes.join(",")}`] : []),
    ...(adapterFixtures.some((fixture) => fixture.status === "hold") ? ["fixture_hold_present"] : []),
    ...(slaContract?.status === "hold" ? ["sla_contract_hold"] : []),
    ...(adapterRepairs.some((repair) => repair.priority === "high") ? ["high_priority_repair_present"] : [])
  ];
  const watchReasons = [
    ...(adapterFixtures.some((fixture) => fixture.status === "watch") ? ["fixture_watch_present"] : []),
    ...(slaContract?.status === "warn" ? ["sla_contract_warn"] : [])
  ];
  const status = holdReasons.length ? "hold" : watchReasons.length ? "watch" : "certified";
  return {
    adapter,
    status,
    requiredModesCovered: covered,
    missingModes,
    holdReasons,
    releaseDecision: status === "certified" ? "promote" : status
  };
}

function statusFor(mode: AdapterCertificationMode, dynamicUnbounded: boolean): AdapterCertificationStatus {
  if (dynamicUnbounded) return "hold";
  if (mode === "success") return "certified";
  if (mode === "timeout" || mode === "unsupported_mime" || mode === "empty_extraction" || mode === "parser_drift") return "hold";
  return "watch";
}

function handoffsFor(
  mode: AdapterCertificationMode,
  status: AdapterCertificationStatus,
  dynamicUnbounded: boolean
): AdapterFixtureReplayResultDto["handoffs"] {
  const warning = dynamicUnbounded ? "adapter_cert.dynamic_requires_explicit_bounded_flag" : mode === "success" ? "none" : `adapter_cert.${mode}` as const;
  return {
    agent01SourceActivation: status === "certified" ? "allow_certified" : status === "hold" ? "hold_source_activation" : "review_source",
    agent02CadenceBackoff: mode === "rate_limit" || mode === "timeout" ? "retry_after" : mode === "duplicate_canonical" ? "reduce_cadence" : status === "hold" ? "pause" : "normal",
    agent04PublicSourceExpansion: status === "certified" ? "eligible" : status === "hold" ? "exclude_until_repaired" : "watch",
    agent06EvidenceReplay: mode === "duplicate_canonical" ? "suppress_duplicate" : status === "hold" ? "hold_replay" : "replay_hash_only",
    agent07QualityGate: status === "certified" ? "pass" : status === "hold" ? "hold" : "review",
    agent09ApiWarningField: warning,
    agent10ReleaseHold: status === "certified" ? "none" : status === "hold" ? "hold" : "watch"
  };
}

const DEFAULT_REQUIRED_MODES: AdapterCertificationMode[] = ["success", "parser_drift", "stale_dates", "language_mismatch", "unsupported_mime", "timeout", "rate_limit", "duplicate_canonical", "truncated_capture", "empty_extraction"];

function adapterKinds(): AdapterSlaAdapterKind[] {
  return ["static_html", "rss_feed", "dynamic_public_browser", "pdf_report", "public_channel_handoff", "advisory_signal", "multilingual_handoff"];
}

function uniqueModes(values: AdapterCertificationMode[]): AdapterCertificationMode[] {
  const order = new Map(DEFAULT_REQUIRED_MODES.map((mode, index) => [mode, index]));
  return [...new Set(values)].sort((left, right) => (order.get(left) ?? 99) - (order.get(right) ?? 99));
}

function uniqueAdapters(values: AdapterSlaAdapterKind[]): AdapterSlaAdapterKind[] {
  const order = new Map(adapterKinds().map((adapter, index) => [adapter, index]));
  return [...new Set(values)].sort((left, right) => (order.get(left) ?? 99) - (order.get(right) ?? 99));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function safetyDefaults(): AdapterCertificationPacketDto["safety"] {
  return {
    publicOnly: true,
    dryRunOnly: true,
    noAuthBypass: true,
    noCaptchaSolving: true,
    noPrivateCommunities: true,
    noExploitPayloadDownload: true,
    noRestrictedRawMaterial: true,
    unsafeUrlExposed: false
  };
}
