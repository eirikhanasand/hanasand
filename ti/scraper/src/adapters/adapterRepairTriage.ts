import type { AdapterCertificationMode, AdapterCertificationPacketDto, AdapterCertificationStatus } from "./adapterCertification.ts";
import type { AdapterParserRepairPacketDto, AdapterSlaAdapterKind, AdapterSlaContractDto, AdapterSlaRepairPacketDto } from "./adapterSlaRepair.ts";
import { hashContent } from "../utils.ts";

export type AdapterRepairTriageAction =
  | "certify_adapter"
  | "fix_parser"
  | "disable_or_pause_source"
  | "reduce_cadence"
  | "suppress_duplicate"
  | "escalate_release_hold";

export type AdapterRepairTriageDecision = "certify" | "repair" | "disable" | "escalate";
export type AdapterRepairTriagePriority = "p0" | "p1" | "p2" | "p3";

export interface AdapterRepairTriageImpactInput {
  sourceId: string;
  adapter: AdapterSlaAdapterKind;
  customerVisibleSearchImpact: number;
  sourceFamilyCoverage: number;
  freshnessDebtHours?: number;
  duplicateRate?: number;
  queryClasses?: string[];
}

export interface AdapterRepairTriageInput {
  generatedAt: string;
  slaRepairPacket: AdapterSlaRepairPacketDto;
  certificationPacket: AdapterCertificationPacketDto;
  impacts?: AdapterRepairTriageImpactInput[];
}

export interface AdapterRepairRecommendationDto {
  schemaVersion: "ti.adapter_repair_recommendation.v1";
  generatedAt: string;
  recommendationId: string;
  rank: number;
  adapter: AdapterSlaAdapterKind;
  sourceId?: string;
  sourceFamily: string;
  action: AdapterRepairTriageAction;
  priority: AdapterRepairTriagePriority;
  score: number;
  rationale: string[];
  customerImpact: {
    searchImpact: number;
    sourceFamilyCoverage: number;
    queryClasses: string[];
  };
  repairSignals: {
    parserConfidence?: number;
    freshnessDebtHours: number;
    duplicateRate: number;
    unsupportedMimeCount: number;
    timeoutCount: number;
    rateLimitedCount: number;
    certificationGap: number;
    languageDriftCount: number;
    releaseHold: boolean;
  };
  sandboxFixtureReplay: {
    required: boolean;
    expectedModes: AdapterCertificationMode[];
    hashOnly: true;
    rawMaterialRequired: false;
    dynamicBrowserDisabledByDefault: true;
    dynamicRequiresExplicitApproval: boolean;
  };
  handoffs: {
    agent01Activation: "allow_certification" | "hold_activation" | "disable_or_review_source";
    agent02Cadence: "normal" | "backoff" | "pause" | "reduce_duplicate_pressure";
    agent04Coverage: "count_as_covered" | "mark_gap" | "deprioritize_duplicate";
    agent06EvidenceReplay: "none" | "hash_only_replay" | "suppress_duplicate" | "hold_replay";
    agent07QualityGate: "pass" | "repair" | "hold";
    agent09WarningField: string;
    agent10ReleaseGate: "none" | "watch" | "hold";
  };
}

export interface AdapterRepairTriagePacketDto {
  schemaVersion: "ti.adapter_repair_triage_packet.v1";
  generatedAt: string;
  decision: AdapterRepairTriageDecision;
  readyForCertification: boolean;
  browserWorkersEnabled: false;
  recommendations: AdapterRepairRecommendationDto[];
  adapterSummaries: AdapterRepairAdapterSummaryDto[];
  summary: {
    recommendations: number;
    p0: number;
    p1: number;
    p2: number;
    p3: number;
    actions: Record<string, number>;
    sourceIds: string[];
    adapters: AdapterSlaAdapterKind[];
    warningCodes: string[];
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
  sandboxFixtureReplay: {
    requiredAdapters: AdapterSlaAdapterKind[];
    hashOnly: true;
    rawMaterialRequired: false;
    dynamicBrowserDisabledByDefault: true;
    dynamicRequiresExplicitApproval: true;
    expectedModesByAdapter: Array<{
      adapter: AdapterSlaAdapterKind;
      modes: AdapterCertificationMode[];
    }>;
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
      dryRunOnly: true;
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
}

export interface AdapterRepairAdapterSummaryDto {
  adapter: AdapterSlaAdapterKind;
  status: AdapterCertificationStatus | "not_observed";
  slaStatus: AdapterSlaContractDto["status"] | "missing";
  recommendationCount: number;
  topAction?: AdapterRepairTriageAction;
  releaseHold: boolean;
  missingCertificationModes: AdapterCertificationMode[];
}

interface Candidate {
  adapter: AdapterSlaAdapterKind;
  sourceId?: string;
  sourceFamily: string;
  action: AdapterRepairTriageAction;
  rationale: string[];
  repair?: AdapterParserRepairPacketDto;
  contract?: AdapterSlaContractDto;
  gate?: AdapterCertificationPacketDto["adapterGates"][number];
}

export function buildAdapterRepairTriagePacket(input: AdapterRepairTriageInput): AdapterRepairTriagePacketDto {
  const candidates = dedupeCandidates([
    ...input.slaRepairPacket.repairs.map((repair) => candidateFromRepair(repair, input)),
    ...input.certificationPacket.adapterGates.flatMap((gate) => candidatesFromGate(gate, input)),
    ...input.slaRepairPacket.contracts.flatMap((contract) => candidateFromContract(contract, input))
  ]);
  const recommendations = rankRecommendations(candidates.map((candidate) => recommendationFromCandidate(input, candidate)));
  const adapterSummaries = adapterKinds().map((adapter) => adapterSummary(adapter, input, recommendations));
  const p0 = recommendations.filter((recommendation) => recommendation.priority === "p0").length;
  const p1 = recommendations.filter((recommendation) => recommendation.priority === "p1").length;
  const p2 = recommendations.filter((recommendation) => recommendation.priority === "p2").length;
  const p3 = recommendations.filter((recommendation) => recommendation.priority === "p3").length;
  const decision = decisionFor(recommendations);

  return {
    schemaVersion: "ti.adapter_repair_triage_packet.v1",
    generatedAt: input.generatedAt,
    decision,
    readyForCertification: decision === "certify",
    browserWorkersEnabled: false,
    recommendations,
    adapterSummaries,
    summary: {
      recommendations: recommendations.length,
      p0,
      p1,
      p2,
      p3,
      actions: countBy(recommendations.map((recommendation) => recommendation.action)),
      sourceIds: uniqueSorted(recommendations.flatMap((recommendation) => recommendation.sourceId ? [recommendation.sourceId] : [])),
      adapters: uniqueAdapters(recommendations.map((recommendation) => recommendation.adapter)),
      warningCodes: uniqueSorted(recommendations.map((recommendation) => recommendation.handoffs.agent09WarningField).filter((code) => code !== "none")),
      agentHandoffs: {
        agent01: uniqueSorted(recommendations.map((recommendation) => recommendation.handoffs.agent01Activation)),
        agent02: uniqueSorted(recommendations.map((recommendation) => recommendation.handoffs.agent02Cadence)),
        agent04: uniqueSorted(recommendations.map((recommendation) => recommendation.handoffs.agent04Coverage)),
        agent06: uniqueSorted(recommendations.map((recommendation) => recommendation.handoffs.agent06EvidenceReplay)),
        agent07: uniqueSorted(recommendations.map((recommendation) => recommendation.handoffs.agent07QualityGate)),
        agent09: uniqueSorted(recommendations.map((recommendation) => recommendation.handoffs.agent09WarningField).filter((code) => code !== "none")),
        agent10: uniqueSorted(recommendations.map((recommendation) => recommendation.handoffs.agent10ReleaseGate))
      }
    },
    sandboxFixtureReplay: {
      requiredAdapters: uniqueAdapters(recommendations.filter((recommendation) => recommendation.sandboxFixtureReplay.required).map((recommendation) => recommendation.adapter)),
      hashOnly: true,
      rawMaterialRequired: false,
      dynamicBrowserDisabledByDefault: true,
      dynamicRequiresExplicitApproval: true,
      expectedModesByAdapter: adapterKinds().map((adapter) => ({
        adapter,
        modes: expectedModesForAdapter(adapter, input)
      })).filter((entry) => entry.modes.length > 0)
    },
    routeContract: {
      safeForPublicApi: true,
      stableFields: ["schemaVersion", "generatedAt", "decision", "readyForCertification", "browserWorkersEnabled", "recommendations", "adapterSummaries", "summary", "sandboxFixtureReplay", "routeContract", "safety"],
      forbiddenFields: ["url", "canonicalUrl", "rawText", "translatedText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "screenshotBytes", "downloadUrl", "objectRef"],
      compactApiProof: {
        noRawUrls: true,
        noRawText: true,
        noHtml: true,
        noScreenshots: true,
        noCredentials: true,
        noPrivateInvites: true,
        noOnionLinks: true,
        noRestrictedMaterial: true,
        dryRunOnly: true
      }
    },
    safety: safetyDefaults()
  };
}

function candidateFromRepair(repair: AdapterParserRepairPacketDto, input: AdapterRepairTriageInput): Candidate {
  const contract = input.slaRepairPacket.contracts.find((item) => item.adapter === repair.adapter);
  const gate = input.certificationPacket.adapterGates.find((item) => item.adapter === repair.adapter);
  return {
    adapter: repair.adapter,
    sourceId: repair.sourceId,
    sourceFamily: repair.sourceFamily,
    action: actionForRepair(repair),
    repair,
    contract,
    gate,
    rationale: [repair.reason, `repair_category:${repair.category}`, `repair_priority:${repair.priority}`]
  };
}

function candidatesFromGate(gate: AdapterCertificationPacketDto["adapterGates"][number], input: AdapterRepairTriageInput): Candidate[] {
  if (gate.status === "certified") {
    return [{
      adapter: gate.adapter,
      sourceFamily: sourceFamilyForAdapter(gate.adapter),
      action: "certify_adapter",
      contract: input.slaRepairPacket.contracts.find((item) => item.adapter === gate.adapter),
      gate,
      rationale: ["adapter fixture replay and SLA gates are green"]
    }];
  }
  if (gate.missingModes.length === 0 && gate.status !== "hold") return [];
  return [{
    adapter: gate.adapter,
    sourceFamily: sourceFamilyForAdapter(gate.adapter),
    action: gate.status === "hold" ? "escalate_release_hold" : "fix_parser",
    contract: input.slaRepairPacket.contracts.find((item) => item.adapter === gate.adapter),
    gate,
    rationale: [
      ...(gate.missingModes.length ? [`missing_fixture_modes:${gate.missingModes.join(",")}`] : []),
      ...gate.holdReasons
    ]
  }];
}

function candidateFromContract(contract: AdapterSlaContractDto, input: AdapterRepairTriageInput): Candidate[] {
  if (contract.status === "pass") return [];
  const gate = input.certificationPacket.adapterGates.find((item) => item.adapter === contract.adapter);
  return [{
    adapter: contract.adapter,
    sourceFamily: contract.sourceFamily,
    action: contract.status === "hold" ? "escalate_release_hold" : "fix_parser",
    contract,
    gate,
    rationale: contract.breaches.map((breach) => `${breach.code}:${breach.message}`)
  }];
}

function recommendationFromCandidate(input: AdapterRepairTriageInput, candidate: Candidate): AdapterRepairRecommendationDto {
  const impact = impactFor(candidate, input.impacts ?? []);
  const contract = candidate.contract;
  const gate = candidate.gate;
  const missingModes = gate?.missingModes ?? [];
  const releaseHold = candidate.action === "escalate_release_hold" || gate?.status === "hold" || contract?.status === "hold" || candidate.repair?.priority === "high";
  const repairSignals = {
    parserConfidence: contract?.metrics.minParserConfidenceObserved,
    freshnessDebtHours: impact.freshnessDebtHours ?? contract?.metrics.staleCount ? (impact.freshnessDebtHours ?? 24 * (contract?.metrics.staleCount ?? 0)) : 0,
    duplicateRate: impact.duplicateRate ?? (contract?.metrics.duplicateCanonicalCount ? 1 : 0),
    unsupportedMimeCount: contract?.metrics.unsupportedMimeCount ?? 0,
    timeoutCount: contract?.metrics.timeoutCount ?? 0,
    rateLimitedCount: contract?.metrics.rateLimitedCount ?? 0,
    certificationGap: missingModes.length,
    languageDriftCount: contract?.metrics.languageDriftCount ?? 0,
    releaseHold
  };
  const score = scoreFor(candidate, impact, repairSignals);
  const priority = priorityFor(score, releaseHold, candidate.repair?.priority);
  const replayModes = expectedModesFor(candidate, missingModes);

  return {
    schemaVersion: "ti.adapter_repair_recommendation.v1",
    generatedAt: input.generatedAt,
    recommendationId: `triage:${hashContent(`${candidate.adapter}:${candidate.sourceId ?? "adapter"}:${candidate.action}:${candidate.rationale.join("|")}`).slice(0, 16)}`,
    rank: 0,
    adapter: candidate.adapter,
    sourceId: candidate.sourceId,
    sourceFamily: candidate.sourceFamily,
    action: candidate.action,
    priority,
    score,
    rationale: uniqueSorted(candidate.rationale),
    customerImpact: {
      searchImpact: roundScore(impact.customerVisibleSearchImpact),
      sourceFamilyCoverage: roundScore(impact.sourceFamilyCoverage),
      queryClasses: uniqueSorted(impact.queryClasses ?? [])
    },
    repairSignals,
    sandboxFixtureReplay: {
      required: candidate.action !== "reduce_cadence" && candidate.action !== "suppress_duplicate" && candidate.action !== "certify_adapter" || replayModes.length > 0,
      expectedModes: replayModes,
      hashOnly: true,
      rawMaterialRequired: false,
      dynamicBrowserDisabledByDefault: true,
      dynamicRequiresExplicitApproval: candidate.adapter === "dynamic_public_browser"
    },
    handoffs: handoffsFor(candidate, releaseHold)
  };
}

function scoreFor(
  candidate: Candidate,
  impact: AdapterRepairTriageImpactInput,
  signals: AdapterRepairRecommendationDto["repairSignals"]
): number {
  const repairWeight = candidate.repair?.priority === "high" ? 30 : candidate.repair?.priority === "medium" ? 18 : candidate.repair ? 8 : 0;
  const actionWeight: Record<AdapterRepairTriageAction, number> = {
    escalate_release_hold: 34,
    disable_or_pause_source: 30,
    fix_parser: 24,
    reduce_cadence: 14,
    suppress_duplicate: 12,
    certify_adapter: -20
  };
  return roundScore(
    actionWeight[candidate.action]
    + repairWeight
    + impact.customerVisibleSearchImpact * 24
    + impact.sourceFamilyCoverage * 18
    + signals.certificationGap * 4
    + Math.min(10, signals.freshnessDebtHours / 24)
    + signals.duplicateRate * 8
    + signals.unsupportedMimeCount * 6
    + signals.timeoutCount * 5
    + signals.rateLimitedCount * 3
    + signals.languageDriftCount * 4
  );
}

function actionForRepair(repair: AdapterParserRepairPacketDto): AdapterRepairTriageAction {
  if (repair.category === "scheduler_backoff") return "reduce_cadence";
  if (repair.category === "evidence_duplicate_suppression") return "suppress_duplicate";
  if (repair.category === "unsupported_mime_repair" || repair.category === "dynamic_render_failure") return "disable_or_pause_source";
  return "fix_parser";
}

function handoffsFor(candidate: Candidate, releaseHold: boolean): AdapterRepairRecommendationDto["handoffs"] {
  return {
    agent01Activation: candidate.action === "certify_adapter" ? "allow_certification" : releaseHold ? "hold_activation" : "disable_or_review_source",
    agent02Cadence: candidate.action === "reduce_cadence" ? "backoff" : candidate.action === "suppress_duplicate" ? "reduce_duplicate_pressure" : candidate.action === "disable_or_pause_source" || releaseHold ? "pause" : "normal",
    agent04Coverage: candidate.action === "certify_adapter" ? "count_as_covered" : candidate.action === "suppress_duplicate" ? "deprioritize_duplicate" : "mark_gap",
    agent06EvidenceReplay: candidate.action === "suppress_duplicate" ? "suppress_duplicate" : releaseHold ? "hold_replay" : candidate.action === "certify_adapter" ? "none" : "hash_only_replay",
    agent07QualityGate: candidate.action === "certify_adapter" ? "pass" : releaseHold ? "hold" : "repair",
    agent09WarningField: candidate.action === "certify_adapter" ? "none" : `adapter_triage.${candidate.action}`,
    agent10ReleaseGate: releaseHold ? "hold" : candidate.action === "certify_adapter" ? "none" : "watch"
  };
}

function priorityFor(score: number, releaseHold: boolean, repairPriority?: AdapterParserRepairPacketDto["priority"]): AdapterRepairTriagePriority {
  if (releaseHold && score >= 70 || repairPriority === "high" && score >= 62) return "p0";
  if (score >= 52 || releaseHold) return "p1";
  if (score >= 28) return "p2";
  return "p3";
}

function rankRecommendations(recommendations: AdapterRepairRecommendationDto[]): AdapterRepairRecommendationDto[] {
  return recommendations
    .sort((left, right) => right.score - left.score || priorityOrder(left.priority) - priorityOrder(right.priority) || left.adapter.localeCompare(right.adapter))
    .map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));
}

function adapterSummary(adapter: AdapterSlaAdapterKind, input: AdapterRepairTriageInput, recommendations: AdapterRepairRecommendationDto[]): AdapterRepairAdapterSummaryDto {
  const gate = input.certificationPacket.adapterGates.find((item) => item.adapter === adapter);
  const contract = input.slaRepairPacket.contracts.find((item) => item.adapter === adapter);
  const adapterRecommendations = recommendations.filter((recommendation) => recommendation.adapter === adapter);
  return {
    adapter,
    status: gate?.status ?? "not_observed",
    slaStatus: contract?.status ?? "missing",
    recommendationCount: adapterRecommendations.length,
    topAction: adapterRecommendations[0]?.action,
    releaseHold: adapterRecommendations.some((recommendation) => recommendation.handoffs.agent10ReleaseGate === "hold") || gate?.status === "hold" || contract?.status === "hold",
    missingCertificationModes: gate?.missingModes ?? []
  };
}

function impactFor(candidate: Candidate, impacts: AdapterRepairTriageImpactInput[]): AdapterRepairTriageImpactInput {
  const exact = impacts.find((impact) => impact.sourceId === candidate.sourceId && impact.adapter === candidate.adapter);
  if (exact) return exact;
  const adapterImpact = impacts.find((impact) => impact.adapter === candidate.adapter);
  if (adapterImpact) return adapterImpact;
  return {
    sourceId: candidate.sourceId ?? `adapter:${candidate.adapter}`,
    adapter: candidate.adapter,
    customerVisibleSearchImpact: defaultSearchImpact(candidate.adapter),
    sourceFamilyCoverage: defaultCoverageImpact(candidate.adapter),
    freshnessDebtHours: candidate.contract?.metrics.staleCount ? 24 * candidate.contract.metrics.staleCount : 0,
    duplicateRate: candidate.contract?.metrics.duplicateCanonicalCount ? 1 : 0,
    queryClasses: []
  };
}

function expectedModesFor(candidate: Candidate, missingModes: AdapterCertificationMode[]): AdapterCertificationMode[] {
  if (missingModes.length) return uniqueModes(missingModes);
  if (candidate.repair?.category === "dynamic_render_failure") return ["success", "timeout", "empty_extraction"];
  if (candidate.repair?.category === "pdf_extraction_failure") return ["success", "truncated_capture", "empty_extraction"];
  if (candidate.repair?.category === "unsupported_mime_repair") return ["success", "unsupported_mime"];
  if (candidate.repair?.category === "language_detection_drift") return ["success", "language_mismatch"];
  if (candidate.repair?.category === "scheduler_backoff") return ["rate_limit", "timeout"];
  if (candidate.repair?.category === "evidence_duplicate_suppression") return ["duplicate_canonical"];
  if (candidate.action === "fix_parser") return ["success", "parser_drift", "empty_extraction"];
  return [];
}

function expectedModesForAdapter(adapter: AdapterSlaAdapterKind, input: AdapterRepairTriageInput): AdapterCertificationMode[] {
  const gate = input.certificationPacket.adapterGates.find((item) => item.adapter === adapter);
  const repairs = input.slaRepairPacket.repairs.filter((repair) => repair.adapter === adapter);
  return uniqueModes([
    ...(gate?.missingModes ?? []),
    ...repairs.flatMap((repair) => expectedModesFor({ adapter, sourceFamily: sourceFamilyForAdapter(adapter), action: actionForRepair(repair), repair, rationale: [] }, []))
  ]);
}

function decisionFor(recommendations: AdapterRepairRecommendationDto[]): AdapterRepairTriageDecision {
  if (recommendations.some((recommendation) => recommendation.action === "escalate_release_hold" && recommendation.priority === "p0")) return "escalate";
  if (recommendations.some((recommendation) => recommendation.action === "disable_or_pause_source" && (recommendation.priority === "p0" || recommendation.priority === "p1"))) return "disable";
  if (recommendations.some((recommendation) => recommendation.action !== "certify_adapter")) return "repair";
  return "certify";
}

function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.adapter}:${candidate.sourceId ?? "adapter"}:${candidate.action}:${candidate.repair?.category ?? candidate.gate?.status ?? candidate.contract?.status ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function adapterKinds(): AdapterSlaAdapterKind[] {
  return ["static_html", "rss_feed", "dynamic_public_browser", "pdf_report", "public_channel_handoff", "advisory_signal", "multilingual_handoff"];
}

function sourceFamilyForAdapter(adapter: AdapterSlaAdapterKind): string {
  const families: Record<AdapterSlaAdapterKind, string> = {
    static_html: "static_html",
    rss_feed: "rss_feed",
    dynamic_public_browser: "dynamic_page",
    pdf_report: "pdf_report",
    public_channel_handoff: "public_channel",
    advisory_signal: "advisory_signal",
    multilingual_handoff: "multilingual_handoff"
  };
  return families[adapter];
}

function defaultSearchImpact(adapter: AdapterSlaAdapterKind): number {
  if (adapter === "static_html" || adapter === "rss_feed" || adapter === "advisory_signal") return 0.78;
  if (adapter === "pdf_report" || adapter === "dynamic_public_browser") return 0.66;
  return 0.52;
}

function defaultCoverageImpact(adapter: AdapterSlaAdapterKind): number {
  if (adapter === "advisory_signal" || adapter === "rss_feed") return 0.72;
  if (adapter === "static_html" || adapter === "pdf_report") return 0.64;
  return 0.5;
}

function priorityOrder(priority: AdapterRepairTriagePriority): number {
  return { p0: 0, p1: 1, p2: 2, p3: 3 }[priority];
}

function uniqueModes(values: AdapterCertificationMode[]): AdapterCertificationMode[] {
  const order = new Map<AdapterCertificationMode, number>([
    ["success", 0],
    ["parser_drift", 1],
    ["stale_dates", 2],
    ["language_mismatch", 3],
    ["unsupported_mime", 4],
    ["timeout", 5],
    ["rate_limit", 6],
    ["duplicate_canonical", 7],
    ["truncated_capture", 8],
    ["empty_extraction", 9]
  ]);
  return [...new Set(values)].sort((left, right) => (order.get(left) ?? 99) - (order.get(right) ?? 99));
}

function uniqueAdapters(values: AdapterSlaAdapterKind[]): AdapterSlaAdapterKind[] {
  const order = new Map(adapterKinds().map((adapter, index) => [adapter, index]));
  return [...new Set(values)].sort((left, right) => (order.get(left) ?? 99) - (order.get(right) ?? 99));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce<Record<T, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function safetyDefaults(): AdapterRepairTriagePacketDto["safety"] {
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
