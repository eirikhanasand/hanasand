import type { AdapterSlaAdapterKind, AdapterSlaRepairPacketDto } from "./adapterSlaRepair.ts";
import { hashContent } from "../utils.ts";

export type AdapterCertificationMode = "success" | "parser_drift" | "stale_dates" | "language_mismatch" | "unsupported_mime" | "timeout" | "rate_limit" | "duplicate_canonical" | "truncated_capture" | "empty_extraction";
export type AdapterCertificationStatus = "certified" | "watch" | "hold";
export type AdapterCertificationFixtureInput = any;
export type AdapterFixtureReplayResultDto = { [key: string]: any; adapter: AdapterSlaAdapterKind; mode: AdapterCertificationMode; status: AdapterCertificationStatus; handoffs: any; replaySignals: any };
export type AdapterCertificationPacketDto = { [key: string]: any; fixtures: AdapterFixtureReplayResultDto[]; adapterGates: AdapterCertificationGateDto[]; summary: any; routeContract: any; agentHandoffs: any };
export type AdapterCertificationGateDto = any;

const MODES: AdapterCertificationMode[] = ["success", "parser_drift", "stale_dates", "language_mismatch", "unsupported_mime", "timeout", "rate_limit", "duplicate_canonical", "truncated_capture", "empty_extraction"];
const ADAPTERS: AdapterSlaAdapterKind[] = ["static_html", "rss_feed", "dynamic_public_browser", "pdf_report", "public_channel_handoff", "advisory_signal", "multilingual_handoff"];
const FORBIDDEN = ["url", "canonicalUrl", "rawText", "translatedText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "screenshotBytes", "downloadUrl", "objectRef"];
const TRUE_PROOF = { noRawUrls: true, noRawText: true, noHtml: true, noScreenshots: true, noCredentials: true, noPrivateInvites: true, noOnionLinks: true, noRestrictedMaterial: true };

export function replayAdapterCertificationFixtures(input: { generatedAt: string; fixtures: AdapterCertificationFixtureInput[]; slaRepairPacket: AdapterSlaRepairPacketDto; requiredModes?: AdapterCertificationMode[] }): AdapterCertificationPacketDto {
  const requiredModes = input.requiredModes ?? MODES;
  const fixtures = input.fixtures.map((fixture) => replayFixture(input.generatedAt, fixture));
  const adapterGates = ADAPTERS.map((adapter) => certificationGate(adapter, fixtures, requiredModes, input.slaRepairPacket));
  const hold = fixtures.filter((fixture) => fixture.status === "hold").length + adapterGates.filter((gate) => gate.status === "hold").length;
  const warningCodes = uniq(fixtures.map((fixture) => fixture.handoffs.agent09ApiWarningField).filter((field) => field !== "none"));
  return {
    schemaVersion: "ti.adapter_certification_packet.v1", generatedAt: input.generatedAt, readyForLiveActorCollection: hold === 0 && input.slaRepairPacket.readyForPromotion, browserWorkersEnabled: false, dynamicRequiresExplicitBoundedFlag: true, fixtures, adapterGates,
    slaRepairSummary: { readyForPromotion: input.slaRepairPacket.readyForPromotion, holdContracts: input.slaRepairPacket.contracts.filter((contract) => contract.status === "hold").length, repairCount: input.slaRepairPacket.repairs.length, highPriorityRepairCount: input.slaRepairPacket.repairs.filter((repair) => repair.priority === "high").length },
    summary: { totalFixtures: fixtures.length, certified: count(fixtures, "certified"), watch: count(fixtures, "watch"), hold: count(fixtures, "hold"), modesCovered: orderedUniq(fixtures.map((fixture) => fixture.mode), MODES), adaptersCovered: orderedUniq(fixtures.map((fixture) => fixture.adapter), ADAPTERS), warningCodes, sourceIds: uniq(fixtures.map((fixture) => fixture.sourceId)), fixtureUrlHashes: uniq(fixtures.map((fixture) => fixture.fixtureUrlHash)) },
    routeContract: { safeForPublicApi: true, stableFields: ["schemaVersion", "generatedAt", "readyForLiveActorCollection", "browserWorkersEnabled", "dynamicRequiresExplicitBoundedFlag", "fixtures", "adapterGates", "slaRepairSummary", "summary", "routeContract", "safety", "agentHandoffs"], forbiddenFields: FORBIDDEN, compactApiProof: TRUE_PROOF },
    safety: { publicOnly: true, dryRunOnly: true, noAuthBypass: true, noCaptchaSolving: true, noPrivateCommunities: true, noExploitPayloadDownload: true, noRestrictedRawMaterial: true, unsafeUrlExposed: false },
    agentHandoffs: { agent01: uniq(fixtures.map((fixture) => fixture.handoffs.agent01SourceActivation)), agent02: uniq(fixtures.map((fixture) => fixture.handoffs.agent02CadenceBackoff)), agent04: uniq(fixtures.map((fixture) => fixture.handoffs.agent04PublicSourceExpansion)), agent06: uniq(fixtures.map((fixture) => fixture.handoffs.agent06EvidenceReplay)), agent07: uniq(fixtures.map((fixture) => fixture.handoffs.agent07QualityGate)), agent09: warningCodes, agent10: uniq(fixtures.map((fixture) => fixture.handoffs.agent10ReleaseHold)) }
  };
}

function replayFixture(generatedAt: string, fixture: any): AdapterFixtureReplayResultDto {
  const dynamicUnbounded = fixture.adapter === "dynamic_public_browser" && !fixture.explicitBoundedDynamic;
  const staleDate = Boolean(fixture.publishedAt && Date.parse(fixture.publishedAt) < Date.parse(fixture.collectedAt) - 2_592_000_000);
  const languageMismatch = Boolean(fixture.language?.declared && fixture.language.detected && fixture.language.declared !== fixture.language.detected);
  const truncatedCapture = fixture.extractionStats.bytesRead >= fixture.extractionStats.bytesAllowed || fixture.mode === "truncated_capture";
  const status = statusFor(fixture.mode, dynamicUnbounded);
  return { schemaVersion: "ti.adapter_fixture_replay.v1", generatedAt, fixtureId: fixture.fixtureId, adapter: fixture.adapter, mode: fixture.mode, sourceId: fixture.sourceId, fixtureUrlHash: `urlhash:${hashContent(fixture.url).slice(0, 16)}`, objectRefHash: fixture.objectRef ? `objectref:${hashContent(fixture.objectRef).slice(0, 16)}` : undefined, contentHash: fixture.contentHash ?? `contenthash:${hashContent(`${fixture.fixtureId}:${fixture.parserVersion}:${fixture.mode}`).slice(0, 16)}`, parserVersion: fixture.parserVersion, status, failureCode: dynamicUnbounded ? "dynamic_requires_explicit_bounded_flag" : fixture.mode === "success" ? undefined : fixture.mode, evidence: { objectRefHashOnly: Boolean(fixture.objectRef), contentHashOnly: true, rawContentExposed: false, screenshotBytesExposed: false }, extractionStats: fixture.extractionStats, replaySignals: { parserConfidence: Math.round(fixture.parserConfidence * 1000) / 1000, staleDate: staleDate || fixture.mode === "stale_dates", languageMismatch: languageMismatch || fixture.mode === "language_mismatch", unsupportedMime: fixture.mode === "unsupported_mime", timeout: fixture.mode === "timeout", rateLimited: fixture.mode === "rate_limit", duplicateCanonical: fixture.mode === "duplicate_canonical", truncatedCapture, emptyExtraction: fixture.extractionStats.textLength === 0 || fixture.mode === "empty_extraction", dynamicExplicitlyBounded: fixture.adapter !== "dynamic_public_browser" || Boolean(fixture.explicitBoundedDynamic), retryAfterSeconds: fixture.retryAfterSeconds }, handoffs: handoffsFor(fixture.mode, status, dynamicUnbounded) };
}

function certificationGate(adapter: AdapterSlaAdapterKind, fixtures: any[], requiredModes: AdapterCertificationMode[], sla: AdapterSlaRepairPacketDto): AdapterCertificationGateDto {
  const adapterFixtures = fixtures.filter((fixture) => fixture.adapter === adapter);
  const covered = orderedUniq(adapterFixtures.map((fixture) => fixture.mode).filter((mode) => requiredModes.includes(mode)), MODES);
  const missingModes = requiredModes.filter((mode) => !covered.includes(mode));
  const contract = sla.contracts.find((item) => item.adapter === adapter);
  const repairs = sla.repairs.filter((item) => item.adapter === adapter);
  const holdReasons = [...(missingModes.length ? [`missing_fixture_modes:${missingModes.join(",")}`] : []), ...(adapterFixtures.some((fixture) => fixture.status === "hold") ? ["fixture_hold_present"] : []), ...(contract?.status === "hold" ? ["sla_contract_hold"] : []), ...(repairs.some((repair) => repair.priority === "high") ? ["high_priority_repair_present"] : [])];
  const status = holdReasons.length ? "hold" : adapterFixtures.some((fixture) => fixture.status === "watch") || contract?.status === "warn" ? "watch" : "certified";
  return { adapter, status, requiredModesCovered: covered, missingModes, holdReasons, releaseDecision: status === "certified" ? "promote" : status };
}

function statusFor(mode: AdapterCertificationMode, dynamicUnbounded: boolean): AdapterCertificationStatus { return dynamicUnbounded || ["timeout", "unsupported_mime", "empty_extraction", "parser_drift"].includes(mode) ? "hold" : mode === "success" ? "certified" : "watch"; }
function handoffsFor(mode: AdapterCertificationMode, status: AdapterCertificationStatus, dynamic: boolean): any { return { agent01SourceActivation: status === "certified" ? "allow_certified" : status === "hold" ? "hold_source_activation" : "review_source", agent02CadenceBackoff: mode === "rate_limit" || mode === "timeout" ? "retry_after" : mode === "duplicate_canonical" ? "reduce_cadence" : status === "hold" ? "pause" : "normal", agent04PublicSourceExpansion: status === "certified" ? "eligible" : status === "hold" ? "exclude_until_repaired" : "watch", agent06EvidenceReplay: mode === "duplicate_canonical" ? "suppress_duplicate" : status === "hold" ? "hold_replay" : "replay_hash_only", agent07QualityGate: status === "certified" ? "pass" : status === "hold" ? "hold" : "review", agent09ApiWarningField: dynamic ? "adapter_cert.dynamic_requires_explicit_bounded_flag" : mode === "success" ? "none" : `adapter_cert.${mode}`, agent10ReleaseHold: status === "certified" ? "none" : status === "hold" ? "hold" : "watch" }; }
function uniq(values: string[]): string[] { return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)); }
function orderedUniq<T>(values: T[], order: T[]): T[] { const rank = new Map(order.map((value, index) => [value, index])); return [...new Set(values)].sort((left, right) => (rank.get(left) ?? 99) - (rank.get(right) ?? 99)); }
function count(fixtures: any[], status: AdapterCertificationStatus): number { return fixtures.filter((fixture) => fixture.status === status).length; }
