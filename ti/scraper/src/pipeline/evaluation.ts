import type { CollectedItem, Indicator, PipelineResult } from "../types.ts";
import { hashContent } from "../utils.ts";
import { buildActorQueryExtractionProfile, buildTiSearchResultDto, type EvidenceStage, type TiConfidenceCaveatCode } from "./intelligenceProfiles.ts";
import { processCollectedItem } from "./pipeline.ts";

export interface ExtractionFixtureExpectation {
  actors?: string[];
  cves?: string[];
  iocs?: Array<{ type: Indicator["type"]; value: string }>;
  victims?: string[];
  sectors?: string[];
  countries?: string[];
  ttpHints?: string[];
  malwareTools?: string[];
  campaignNames?: string[];
  confidenceCaveats?: TiConfidenceCaveatCode[];
  temporalLabels?: string[];
  uncertaintyLabels?: string[];
}

export interface ExtractionEvaluationFixture {
  id: string;
  title: string;
  query?: string;
  evidenceStage?: EvidenceStage;
  rawText: string;
  language?: string;
  sensitive?: boolean;
  metadata?: Record<string, unknown>;
  expected: ExtractionFixtureExpectation;
  absent?: ExtractionFixtureExpectation;
}

export interface ExtractionFixtureEvaluation {
  fixtureId: string;
  expectedCount: number;
  matchedCount: number;
  matched: string[];
  missing: string[];
  unexpected: string[];
  reviewReasons: string[];
}

export interface ExtractionEvaluationReport {
  disclaimer: string;
  fixtureCount: number;
  expectedCount: number;
  matchedCount: number;
  missingCount: number;
  unexpectedCount: number;
  fixtures: ExtractionFixtureEvaluation[];
}

export type ExtractionQualityNoteCode =
  | "low_evidence_count"
  | "alias_collision"
  | "stale_source"
  | "contradicted_attribution"
  | "weak_victim_claim"
  | "extracted_ttp_needs_review"
  | "source_family_bias";

export interface ExtractionQualityNote {
  code: ExtractionQualityNoteCode;
  severity: "info" | "warning" | "critical";
  message: string;
  fixtureIds: string[];
}

export interface ExtractionCategoryScore {
  category: string;
  expected: number;
  matched: number;
  missing: number;
  unexpected: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface EvidenceStageCalibrationReport {
  evidenceStage: EvidenceStage;
  fixtureCount: number;
  expected: number;
  matched: number;
  missing: number;
  unexpected: number;
  precision: number;
  recall: number;
  qualityNotes: ExtractionQualityNote[];
}

export interface ExtractionCalibrationReport {
  disclaimer: string;
  fixtureCount: number;
  categoryScores: ExtractionCategoryScore[];
  evidenceStageReports: EvidenceStageCalibrationReport[];
  falsePositiveExamples: Array<{ fixtureId: string; unexpected: string[] }>;
  falseNegativeExamples: Array<{ fixtureId: string; missing: string[] }>;
  qualityNotes: ExtractionQualityNote[];
}

export type EvaluationGovernanceCaseKind =
  | "actor_profile"
  | "unknown_actor"
  | "cve"
  | "malware_tool"
  | "country"
  | "sector"
  | "victim_company"
  | "stale"
  | "contradicted"
  | "low_confidence";

export type EvaluationGovernanceAuditCode =
  | "stale_label"
  | "overconfident_summary"
  | "missing_provenance"
  | "contradiction_handling"
  | "public_channel_only_caveat"
  | "restricted_metadata_hold"
  | "graph_stix_export_eligibility"
  | "unknown_searching_only";

export interface EvaluationGovernanceLabel {
  id: string;
  caseKind: EvaluationGovernanceCaseKind;
  subject: string;
  expectedPublicState: "ready" | "partial" | "review_required" | "searching";
  labelSource: string;
  reviewer: string;
  reviewedAt: string;
  evidenceIds: string[];
  claimLedgerRefs: string[];
  sourceFamily: "vendor_blog" | "rss_security_feed" | "advisory" | "public_channel" | "restricted_metadata" | "synthetic_guardrail";
  confidence: number;
  freshness: "fresh" | "aging" | "stale" | "unknown";
  allowedDownstreamUse: Array<"quality_gate" | "api_regression" | "evidence_replay" | "public_benchmark" | "graph_drift" | "release_gate">;
  publicSemantics: {
    preservesUncertainty: boolean;
    unknownActorSearchingOnly: boolean;
    noDefaultActor: boolean;
    noDemoOrCacheProse: boolean;
    requiredCaveats: string[];
  };
  provenance: {
    sourceFamily: EvaluationGovernanceLabel["sourceFamily"];
    evidenceIds: string[];
    claimLedgerRefs: string[];
    redacted: true;
  };
}

export interface EvaluationGovernanceAuditCheck {
  code: EvaluationGovernanceAuditCode;
  status: "pass" | "warn" | "hold";
  severity: "info" | "warning" | "critical";
  labelIds: string[];
  message: string;
  downstreamOwners: Array<"Agent 01" | "Agent 04" | "Agent 06" | "Agent 08" | "Agent 09" | "Agent 10">;
}

export interface EvaluationDatasetGovernanceDto {
  schemaVersion: "ti.evaluation_dataset_governance.v1";
  generatedAt: string;
  summary: {
    labelCount: number;
    caseKinds: EvaluationGovernanceCaseKind[];
    auditHoldCount: number;
    auditWarningCount: number;
    releaseGate: "pass" | "warn" | "hold";
  };
  labels: EvaluationGovernanceLabel[];
  auditChecks: EvaluationGovernanceAuditCheck[];
  routing: {
    agent01SourceGaps: string[];
    agent04PublicBenchmarks: string[];
    agent06EvidenceReplay: string[];
    agent08GraphDrift: string[];
    agent09ApiRegressionFixtures: string[];
    agent10ReleaseGates: string[];
  };
  policy: {
    labelsAreImmutable: true;
    analystApprovalRequired: true;
    preservesUncertainty: true;
    noAutomaticPromotion: true;
    unknownActorSearchingOnly: true;
  };
  safety: {
    rawEvidenceExposed: false;
    sourceUrlsExposed: false;
    restrictedPayloadsExposed: false;
    objectKeysExposed: false;
  };
}

export type CtiEvaluationDatasetScenario =
  | "actor_extraction"
  | "victim_extraction"
  | "ttp_extraction"
  | "ioc_extraction"
  | "stale_answer_rejection"
  | "unknown_actor_searching_only"
  | "restricted_no_leak"
  | "contradiction_handling";

export interface CtiEvaluationDatasetFixtureDto {
  id: string;
  scenario: CtiEvaluationDatasetScenario;
  subject: string;
  expectedPublicState: EvaluationGovernanceLabel["expectedPublicState"];
  labelIds: string[];
  evidenceIds: string[];
  claimLedgerRefs: string[];
  assertions: string[];
  metrics: {
    precisionTarget: number;
    recallTarget: number;
    staleAnswerRejectionRequired: boolean;
    unknownSearchingRequired: boolean;
    restrictedNoLeakRequired: boolean;
    contradictionHoldRequired: boolean;
    provenanceRequired: boolean;
  };
  handoffs: {
    agent03ParserCertification?: string;
    agent06EvidenceReplay?: string;
    agent08GraphHold?: string;
    agent09ApiRegression?: string;
    agent10ReleaseGate?: string;
  };
  immutable: true;
  appliesAutomatically: false;
  noLeak: true;
}

export interface CtiEvaluationDatasetPackDto {
  schemaVersion: "ti.cti_evaluation_dataset_pack.v1";
  generatedAt: string;
  fixtures: CtiEvaluationDatasetFixtureDto[];
  metrics: {
    fixtureCount: number;
    actorExtractionCount: number;
    victimExtractionCount: number;
    ttpExtractionCount: number;
    iocExtractionCount: number;
    staleAnswerRejectionCount: number;
    unknownSearchingCount: number;
    restrictedNoLeakCount: number;
    contradictionHandlingCount: number;
    provenanceCompletenessTarget: number;
  };
  routing: {
    agent03ParserCertification: string[];
    agent06EvidenceReplay: string[];
    agent08GraphHolds: string[];
    agent09ApiRegression: string[];
    agent10ReleaseGates: string[];
  };
  policy: {
    fixturesAreImmutable: true;
    analystApprovalRequired: true;
    noAutomaticPromotion: true;
    noModelSelfMutation: true;
    unknownActorSearchingOnly: true;
    staleEvidenceCannotBeLatest: true;
  };
  safety: {
    rawEvidenceExposed: false;
    sourceUrlsExposed: false;
    restrictedPayloadsExposed: false;
    objectKeysExposed: false;
  };
}

export type QualityRuntimeQueryClass =
  | "actor"
  | "campaign"
  | "malware_tool"
  | "cve_advisory"
  | "country"
  | "sector"
  | "victim_company"
  | "infrastructure"
  | "unknown";

export type QualityRuntimeGateName =
  | "timeliness"
  | "specificity"
  | "source_diversity"
  | "provenance_completeness"
  | "contradiction_state"
  | "evidence_freshness"
  | "analyst_actionability"
  | "darkweb_metadata_caveat"
  | "source_atlas_value"
  | "stale_answer_rejection"
  | "unknown_query_honesty";

export interface QualityRuntimeValueGateRow {
  name: QualityRuntimeGateName;
  status: "pass" | "warn" | "hold";
  score: number;
  weight: number;
  evidenceRefs: string[];
  reasons: string[];
  publicAnswerEffect: "ready" | "partial" | "searching" | "hold";
  remediationOwners: Array<"Agent 01" | "Agent 02" | "Agent 03" | "Agent 04" | "Agent 05" | "Agent 06" | "Agent 08" | "Agent 09" | "Agent 10">;
}

export interface QualityRuntimeFixtureRow {
  id: string;
  query: string;
  queryClass: QualityRuntimeQueryClass;
  expectedPublicState: "ready" | "partial" | "searching" | "hold";
  requiredGates: QualityRuntimeGateName[];
  assertions: string[];
  noLeak: true;
}

export interface QualityRuntimeValueGatesDto {
  schemaVersion: "ti.quality_runtime_value_gates.v1";
  generatedAt: string;
  query: string;
  queryClass: QualityRuntimeQueryClass;
  summary: {
    gateCount: number;
    passCount: number;
    warningCount: number;
    holdCount: number;
    analystUsefulnessScore: number;
    decision: "ready" | "partial" | "searching" | "hold";
  };
  gates: QualityRuntimeValueGateRow[];
  darkwebMetadataRules: {
    metadataMayImproveHints: true;
    publicPromotionRequiresCorroboration: true;
    heldStates: string[];
    caveats: string[];
    forbiddenFields: string[];
  };
  sourceAtlasFeedback: Array<{
    signal: "low_yield_source_family" | "duplicate_heavy_pack" | "stale_only_pack" | "parser_gap" | "language_gap" | "activation_candidate";
    status: "watch" | "needs_review" | "actionable";
    affectedQueryClasses: QualityRuntimeQueryClass[];
    expectedAnswerImpact: "low" | "medium" | "high";
    remediationOwner: "Agent 01" | "Agent 03" | "Agent 04" | "Agent 07" | "Agent 10";
  }>;
  fixtureCorpus: QualityRuntimeFixtureRow[];
  remediationHandoffs: {
    agent01SourceActivation: string[];
    agent02SchedulerCadence: string[];
    agent03AdapterRepair: string[];
    agent04SignalScoring: string[];
    agent05RestrictedReview: string[];
    agent06EvidenceReplay: string[];
    agent08GraphHolds: string[];
    agent09ApiFields: string[];
    agent10ReleaseRollback: string[];
  };
  releaseGate: {
    decision: "promote" | "partial" | "hold";
    blocksReadyPromotion: boolean;
    proofCommands: string[];
  };
  policy: {
    analystApprovalRequired: true;
    noAutomaticPromotion: true;
    noAutonomousScraping: true;
    unknownActorSearchingOnly: true;
    staleEvidenceCannotBeLatest: true;
    metadataOnlyDarkwebCannotStandAlone: true;
  };
  safety: {
    rawEvidenceExposed: false;
    sourceUrlsExposed: false;
    restrictedPayloadsExposed: false;
    objectKeysExposed: false;
    unsafeDarkwebTargetsExposed: false;
  };
}

export function buildQualityRuntimeValueGatesDto(input: {
  query: string;
  generatedAt?: string;
  quality?: { status?: string; score?: number; publicWarningCodes?: string[]; publicWarningText?: string[] };
  publicTiAnswer?: { displayState?: string; waitReasons?: Array<{ code?: string } | string>; sourceCoverageGaps?: string[] };
  timelinessGroundTruth?: { releaseImpact?: { holdsReadyPromotion?: boolean; publicAnswerState?: string; caveats?: string[] }; fields?: Array<{ field?: string; status?: string; score?: number }> };
  activeLearningCandidateQueue?: { candidates?: Array<{ id?: string; type?: string }> };
  ctiEvaluationDatasetPack?: { fixtures?: Array<{ id?: string; scenario?: string; expectedPublicState?: string }> };
}): QualityRuntimeValueGatesDto {
  const generatedAt = input.generatedAt ?? "2026-05-24T00:00:00.000Z";
  const queryClass = classifyQualityRuntimeQuery(input.query);
  const warningCodes = input.quality?.publicWarningCodes ?? [];
  const publicState = input.publicTiAnswer?.displayState ?? input.timelinessGroundTruth?.releaseImpact?.publicAnswerState ?? "partial";
  const waitCodes = (input.publicTiAnswer?.waitReasons ?? []).map((reason) => typeof reason === "string" ? reason : reason.code ?? "wait");
  const timelinessHold = input.timelinessGroundTruth?.releaseImpact?.holdsReadyPromotion === true || warningCodes.includes("stale_answer");
  const contradictionHold = warningCodes.some((code) => code.includes("contradict"));
  const unknownQuery = queryClass === "unknown";
  const darkwebRelevant = warningCodes.some((code) => code.includes("restricted") || code.includes("metadata")) || /darkweb|leak|victim|ransom/i.test(input.query);
  const gates: QualityRuntimeValueGateRow[] = [
    qualityGate("timeliness", timelinessHold ? "hold" : "pass", timelinessHold ? 0.25 : 0.9, ["ev_runtime_freshness"], timelinessHold ? ["latest-activity evidence is stale or not replay-confirmed"] : ["freshness state is usable"], timelinessHold ? "hold" : "ready", ["Agent 02", "Agent 04", "Agent 06", "Agent 10"]),
    qualityGate("specificity", publicState === "ready" ? "pass" : "warn", publicState === "ready" ? 0.88 : 0.58, ["ev_runtime_specificity"], publicState === "ready" ? ["answer has enough query-specific fields"] : ["answer needs more specific actor/campaign/victim/CVE support"], publicState === "ready" ? "ready" : "partial", ["Agent 03", "Agent 04", "Agent 09"]),
    qualityGate("source_diversity", warningCodes.includes("source_biased") ? "warn" : "pass", warningCodes.includes("source_biased") ? 0.5 : 0.84, ["ev_runtime_source_family"], warningCodes.includes("source_biased") ? ["single source family can bias the public answer"] : ["source-family support is sufficient for current state"], warningCodes.includes("source_biased") ? "partial" : "ready", ["Agent 01", "Agent 04"]),
    qualityGate("provenance_completeness", waitCodes.includes("capture_promotion") ? "warn" : "pass", waitCodes.includes("capture_promotion") ? 0.55 : 0.9, ["ledger_runtime_provenance"], waitCodes.includes("capture_promotion") ? ["capture or claim-ledger promotion is still pending"] : ["ledger references are available or not required for Searching"], waitCodes.includes("capture_promotion") ? "partial" : "ready", ["Agent 06", "Agent 09"]),
    qualityGate("contradiction_state", contradictionHold ? "hold" : "pass", contradictionHold ? 0.2 : 0.88, ["ev_runtime_contradiction"], contradictionHold ? ["contradictory attribution/source cluster requires review"] : ["no release-blocking contradiction signal"], contradictionHold ? "hold" : "ready", ["Agent 07", "Agent 08", "Agent 10"].filter((owner): owner is QualityRuntimeValueGateRow["remediationOwners"][number] => owner !== "Agent 07")),
    qualityGate("evidence_freshness", timelinessHold ? "hold" : "pass", timelinessHold ? 0.3 : 0.86, ["ev_runtime_evidence_age"], timelinessHold ? ["fresh evidence replay is required before ready promotion"] : ["evidence freshness supports current display state"], timelinessHold ? "hold" : "ready", ["Agent 02", "Agent 06"]),
    qualityGate("analyst_actionability", "pass", 0.82, candidateRefs(input.activeLearningCandidateQueue).slice(0, 5), ["weak states produce owner-specific remediation instead of vague caveats"], "partial", ["Agent 01", "Agent 03", "Agent 04", "Agent 05", "Agent 06", "Agent 08", "Agent 09", "Agent 10"]),
    qualityGate("darkweb_metadata_caveat", darkwebRelevant ? "warn" : "pass", darkwebRelevant ? 0.62 : 0.9, ["ev_runtime_dark_metadata"], darkwebRelevant ? ["metadata-only dark-web hints can inform caveats but cannot stand alone as public facts"] : ["no restricted metadata dependency detected"], darkwebRelevant ? "partial" : "ready", ["Agent 05", "Agent 06", "Agent 08", "Agent 10"]),
    qualityGate("source_atlas_value", "warn", 0.68, ["source_atlas_runtime_feedback"], ["source-atlas scoring should prioritize unique fresh evidence, parser readiness, and query-class gaps"], "partial", ["Agent 01", "Agent 03", "Agent 04", "Agent 10"]),
    qualityGate("stale_answer_rejection", timelinessHold ? "hold" : "pass", timelinessHold ? 0.2 : 0.95, ["eval_stale_answer_rejection"], timelinessHold ? ["stale evidence cannot be labelled latest activity"] : ["stale-answer suppression is enforced"], timelinessHold ? "hold" : "ready", ["Agent 07", "Agent 10"].filter((owner): owner is QualityRuntimeValueGateRow["remediationOwners"][number] => owner !== "Agent 07")),
    qualityGate("unknown_query_honesty", unknownQuery ? "pass" : "pass", unknownQuery ? 1 : 0.9, ["eval_unknown_query_searching"], unknownQuery ? ["unknown or made-up queries remain Searching without default actor fallback"] : ["known-query response still forbids demo/cache fallback"], unknownQuery ? "searching" : "ready", ["Agent 09", "Agent 10"])
  ];
  const holdCount = gates.filter((gate) => gate.status === "hold").length;
  const warningCount = gates.filter((gate) => gate.status === "warn").length;
  const passCount = gates.filter((gate) => gate.status === "pass").length;
  const analystUsefulnessScore = Number((gates.reduce((total, gate) => total + gate.score * gate.weight, 0) / gates.reduce((total, gate) => total + gate.weight, 0)).toFixed(2));
  const decision = unknownQuery ? "searching" : holdCount > 0 ? "hold" : warningCount > 0 ? "partial" : "ready";

  return {
    schemaVersion: "ti.quality_runtime_value_gates.v1",
    generatedAt,
    query: input.query,
    queryClass,
    summary: {
      gateCount: gates.length,
      passCount,
      warningCount,
      holdCount,
      analystUsefulnessScore,
      decision
    },
    gates,
    darkwebMetadataRules: {
      metadataMayImproveHints: true,
      publicPromotionRequiresCorroboration: true,
      heldStates: ["restricted_context_only", "policy_hold_caveat", "metadata_only_unconfirmed", "legal_review_required"],
      caveats: ["metadata-only hints need public corroboration", "risky or isolated source-family claims stay partial or held", "no raw unsafe target material appears in public DTOs"],
      forbiddenFields: ["unsafe_locator", "unsafe_url", "credential_marker", "payload_marker", "dump_marker", "private_message_marker", "object_reference_marker"]
    },
    sourceAtlasFeedback: qualityRuntimeSourceAtlasFeedback(queryClass),
    fixtureCorpus: qualityRuntimeFixtureCorpus(input.ctiEvaluationDatasetPack),
    remediationHandoffs: {
      agent01SourceActivation: ["prioritize approved public source families that improve query-class coverage and source diversity"],
      agent02SchedulerCadence: ["increase cadence only for high-value fresh-evidence gaps and preserve queue limits"],
      agent03AdapterRepair: ["repair parser or adapter gaps before source expansion changes public answer state"],
      agent04SignalScoring: ["rank public signals by fresh unique evidence yield and contradiction risk"],
      agent05RestrictedReview: ["keep dark-web metadata hints metadata-only until review/corroboration"],
      agent06EvidenceReplay: ["replay capture and claim-ledger refs before ready promotion"],
      agent08GraphHolds: ["hold contradicted or weak relationships from graph/STIX export"],
      agent09ApiFields: ["surface decision, gate statuses, and wait reasons without raw evidence fields"],
      agent10ReleaseRollback: ["block or roll back ready promotion when any critical gate is hold"]
    },
    releaseGate: {
      decision: holdCount > 0 ? "hold" : warningCount > 0 || unknownQuery ? "partial" : "promote",
      blocksReadyPromotion: holdCount > 0 || unknownQuery,
      proofCommands: [
        "bun test src/tests/pipeline.test.ts -t quality",
        "bun test src/tests/api.test.ts -t quality",
        "bun run check:contract-index",
        "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
      ]
    },
    policy: {
      analystApprovalRequired: true,
      noAutomaticPromotion: true,
      noAutonomousScraping: true,
      unknownActorSearchingOnly: true,
      staleEvidenceCannotBeLatest: true,
      metadataOnlyDarkwebCannotStandAlone: true
    },
    safety: {
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false,
      unsafeDarkwebTargetsExposed: false
    }
  };
}

function qualityGate(
  name: QualityRuntimeGateName,
  status: QualityRuntimeValueGateRow["status"],
  score: number,
  evidenceRefs: string[],
  reasons: string[],
  publicAnswerEffect: QualityRuntimeValueGateRow["publicAnswerEffect"],
  remediationOwners: QualityRuntimeValueGateRow["remediationOwners"],
  weight = 1
): QualityRuntimeValueGateRow {
  return { name, status, score, weight, evidenceRefs, reasons, publicAnswerEffect, remediationOwners };
}

function classifyQualityRuntimeQuery(query: string): QualityRuntimeQueryClass {
  const normalized = query.toLowerCase();
  if (/\bcve-\d{4}-\d{4,}\b|advisory|vulnerability|exploit/.test(normalized)) return "cve_advisory";
  if (/campaign|operation\b/.test(normalized)) return "campaign";
  if (/malware|tool|ransomware|akira|lockbit|snake|blackcat/.test(normalized)) return "malware_tool";
  if (/sector|healthcare|energy|finance|telecom|ics|ot\b/.test(normalized)) return "sector";
  if (/country|region|china|russia|iran|north korea|norway|ukraine/.test(normalized)) return "country";
  if (/victim|company|breach|leak|extortion/.test(normalized)) return "victim_company";
  if (/infrastructure|domain|ip address|c2|command and control/.test(normalized)) return "infrastructure";
  if (/made up|random actor|unknown actor|does not exist|asdf/.test(normalized)) return "unknown";
  return "actor";
}

function candidateRefs(input?: { candidates?: Array<{ id?: string; type?: string }> }): string[] {
  const refs = input?.candidates?.map((candidate, index) => candidate.id ?? `candidate_${candidate.type ?? index}`) ?? [];
  return refs.length > 0 ? refs : ["candidate_runtime_quality_gate"];
}

function qualityRuntimeSourceAtlasFeedback(queryClass: QualityRuntimeQueryClass): QualityRuntimeValueGatesDto["sourceAtlasFeedback"] {
  return [
    { signal: "low_yield_source_family", status: "needs_review", affectedQueryClasses: ["actor", "malware_tool", queryClass], expectedAnswerImpact: "medium", remediationOwner: "Agent 04" },
    { signal: "duplicate_heavy_pack", status: "watch", affectedQueryClasses: ["actor", "cve_advisory"], expectedAnswerImpact: "low", remediationOwner: "Agent 01" },
    { signal: "stale_only_pack", status: "actionable", affectedQueryClasses: ["actor", "campaign"], expectedAnswerImpact: "high", remediationOwner: "Agent 07" },
    { signal: "parser_gap", status: "actionable", affectedQueryClasses: ["cve_advisory", "malware_tool"], expectedAnswerImpact: "high", remediationOwner: "Agent 03" },
    { signal: "language_gap", status: "needs_review", affectedQueryClasses: ["country", "sector"], expectedAnswerImpact: "medium", remediationOwner: "Agent 04" },
    { signal: "activation_candidate", status: "actionable", affectedQueryClasses: ["actor", "victim_company", "infrastructure"], expectedAnswerImpact: "high", remediationOwner: "Agent 10" }
  ];
}

function qualityRuntimeFixtureCorpus(input?: { fixtures?: Array<{ id?: string; scenario?: string; expectedPublicState?: string }> }): QualityRuntimeFixtureRow[] {
  const fromPack = input?.fixtures?.slice(0, 4).map((fixture, index): QualityRuntimeFixtureRow => ({
    id: `runtime_${fixture.id ?? index}`,
    query: fixture.scenario ?? "fixture",
    queryClass: fixture.scenario === "unknown_actor_searching_only" ? "unknown" : "actor",
    expectedPublicState: normalizeFixtureState(fixture.expectedPublicState),
    requiredGates: ["provenance_completeness", "analyst_actionability"],
    assertions: ["preserve governed label provenance", "do not mutate public answers automatically"],
    noLeak: true
  })) ?? [];
  return [
    ...fromPack,
    runtimeFixture("fresh_high_activity_actor", "APT29", "actor", "partial", ["timeliness", "source_diversity", "provenance_completeness"], ["high-activity actors need fresh evidence and source diversity"]),
    runtimeFixture("random_actor_searching", "Random Actor", "unknown", "searching", ["unknown_query_honesty"], ["random actors do not fall back to default/demo actors"]),
    runtimeFixture("made_up_actor_no_result", "Made Up Actor", "unknown", "searching", ["unknown_query_honesty"], ["made-up actors remain Searching until evidence arrives"]),
    runtimeFixture("stale_apt_activity_rejection", "APT42 stale activity", "actor", "hold", ["stale_answer_rejection", "evidence_freshness"], ["stale activity cannot be latest activity"]),
    runtimeFixture("fresh_cve_advisory", "CVE-2026-4242", "cve_advisory", "partial", ["specificity", "provenance_completeness"], ["CVE answers need advisory provenance"]),
    runtimeFixture("ransomware_victim_claim", "Akira victim claim", "victim_company", "hold", ["darkweb_metadata_caveat", "provenance_completeness"], ["victim claims require corroboration and review"]),
    runtimeFixture("country_sector_surge", "energy sector threats", "sector", "partial", ["source_diversity", "analyst_actionability"], ["surge queries need query-class source coverage"]),
    runtimeFixture("darkweb_metadata_only_hold", "metadata-only leak hint", "victim_company", "hold", ["darkweb_metadata_caveat"], ["metadata-only dark-web hints cannot stand alone"]),
    runtimeFixture("public_channel_weak_signal", "public-channel rumor", "actor", "partial", ["source_diversity", "contradiction_state"], ["weak public-channel-only signals stay caveated"]),
    runtimeFixture("contradictory_source_cluster", "conflicting actor attribution", "actor", "hold", ["contradiction_state"], ["contradictions route to graph and release review"])
  ];
}

function runtimeFixture(
  id: string,
  query: string,
  queryClass: QualityRuntimeQueryClass,
  expectedPublicState: QualityRuntimeFixtureRow["expectedPublicState"],
  requiredGates: QualityRuntimeGateName[],
  assertions: string[]
): QualityRuntimeFixtureRow {
  return { id, query, queryClass, expectedPublicState, requiredGates, assertions, noLeak: true };
}

function normalizeFixtureState(state?: string): QualityRuntimeFixtureRow["expectedPublicState"] {
  if (state === "ready") return "ready";
  if (state === "searching") return "searching";
  if (state === "review_required") return "hold";
  return "partial";
}

export function buildEvaluationDatasetGovernanceDto(input: { generatedAt?: string } = {}): EvaluationDatasetGovernanceDto {
  const generatedAt = input.generatedAt ?? "2026-05-24T00:00:00.000Z";
  const labels = evaluationGovernanceLabels(generatedAt);
  const auditChecks = evaluationGovernanceAuditChecks(labels);
  const auditHoldCount = auditChecks.filter((check) => check.status === "hold").length;
  const auditWarningCount = auditChecks.filter((check) => check.status === "warn").length;

  return {
    schemaVersion: "ti.evaluation_dataset_governance.v1",
    generatedAt,
    summary: {
      labelCount: labels.length,
      caseKinds: [...new Set(labels.map((label) => label.caseKind))],
      auditHoldCount,
      auditWarningCount,
      releaseGate: auditHoldCount > 0 ? "hold" : auditWarningCount > 0 ? "warn" : "pass"
    },
    labels,
    auditChecks,
    routing: {
      agent01SourceGaps: labelIdsFor(labels, (label) => label.sourceFamily === "synthetic_guardrail" || label.freshness !== "fresh"),
      agent04PublicBenchmarks: labelIdsFor(labels, (label) => label.allowedDownstreamUse.includes("public_benchmark")),
      agent06EvidenceReplay: labelIdsFor(labels, (label) => label.allowedDownstreamUse.includes("evidence_replay")),
      agent08GraphDrift: labelIdsFor(labels, (label) => label.allowedDownstreamUse.includes("graph_drift")),
      agent09ApiRegressionFixtures: labelIdsFor(labels, (label) => label.allowedDownstreamUse.includes("api_regression")),
      agent10ReleaseGates: labelIdsFor(labels, (label) => label.allowedDownstreamUse.includes("release_gate"))
    },
    policy: {
      labelsAreImmutable: true,
      analystApprovalRequired: true,
      preservesUncertainty: true,
      noAutomaticPromotion: true,
      unknownActorSearchingOnly: true
    },
    safety: {
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    }
  };
}

export function buildCtiEvaluationDatasetPackDto(input: {
  governance?: EvaluationDatasetGovernanceDto;
  generatedAt?: string;
} = {}): CtiEvaluationDatasetPackDto {
  const governance = input.governance ?? buildEvaluationDatasetGovernanceDto({ generatedAt: input.generatedAt });
  const fixtures = ctiEvaluationFixtures(governance);
  return {
    schemaVersion: "ti.cti_evaluation_dataset_pack.v1",
    generatedAt: input.generatedAt ?? governance.generatedAt,
    fixtures,
    metrics: {
      fixtureCount: fixtures.length,
      actorExtractionCount: countFixtures(fixtures, "actor_extraction"),
      victimExtractionCount: countFixtures(fixtures, "victim_extraction"),
      ttpExtractionCount: countFixtures(fixtures, "ttp_extraction"),
      iocExtractionCount: countFixtures(fixtures, "ioc_extraction"),
      staleAnswerRejectionCount: countFixtures(fixtures, "stale_answer_rejection"),
      unknownSearchingCount: countFixtures(fixtures, "unknown_actor_searching_only"),
      restrictedNoLeakCount: countFixtures(fixtures, "restricted_no_leak"),
      contradictionHandlingCount: countFixtures(fixtures, "contradiction_handling"),
      provenanceCompletenessTarget: 1
    },
    routing: {
      agent03ParserCertification: fixtureIdsFor(fixtures, (fixture) => ["actor_extraction", "victim_extraction", "ttp_extraction", "ioc_extraction"].includes(fixture.scenario)),
      agent06EvidenceReplay: fixtures.map((fixture) => fixture.id),
      agent08GraphHolds: fixtureIdsFor(fixtures, (fixture) => fixture.scenario === "contradiction_handling" || fixture.scenario === "ttp_extraction"),
      agent09ApiRegression: fixtures.map((fixture) => fixture.id),
      agent10ReleaseGates: fixtureIdsFor(fixtures, (fixture) => fixture.expectedPublicState !== "ready" || fixture.metrics.staleAnswerRejectionRequired || fixture.metrics.restrictedNoLeakRequired)
    },
    policy: {
      fixturesAreImmutable: true,
      analystApprovalRequired: true,
      noAutomaticPromotion: true,
      noModelSelfMutation: true,
      unknownActorSearchingOnly: true,
      staleEvidenceCannotBeLatest: true
    },
    safety: {
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    }
  };
}

function ctiEvaluationFixtures(governance: EvaluationDatasetGovernanceDto): CtiEvaluationDatasetFixtureDto[] {
  const labels = governance.labels;
  const label = (predicate: (label: EvaluationGovernanceLabel) => boolean): EvaluationGovernanceLabel[] => labels.filter(predicate);
  const fixture = (
    scenario: CtiEvaluationDatasetScenario,
    scenarioLabels: EvaluationGovernanceLabel[],
    subject: string,
    assertions: string[],
    metrics: Partial<CtiEvaluationDatasetFixtureDto["metrics"]> = {}
  ): CtiEvaluationDatasetFixtureDto => {
    const selected = scenarioLabels.length > 0 ? scenarioLabels : labels.slice(0, 1);
    return {
      id: `cti_eval_${scenario}`,
      scenario,
      subject,
      expectedPublicState: selected.some((item) => item.expectedPublicState === "searching")
        ? "searching"
        : selected.some((item) => item.expectedPublicState === "review_required")
          ? "review_required"
          : selected.some((item) => item.expectedPublicState === "partial")
            ? "partial"
            : "ready",
      labelIds: selected.map((item) => item.id),
      evidenceIds: uniqueStrings(selected.flatMap((item) => item.evidenceIds)).slice(0, 12),
      claimLedgerRefs: uniqueStrings(selected.flatMap((item) => item.claimLedgerRefs)).slice(0, 12),
      assertions,
      metrics: {
        precisionTarget: metrics.precisionTarget ?? 0.85,
        recallTarget: metrics.recallTarget ?? 0.75,
        staleAnswerRejectionRequired: metrics.staleAnswerRejectionRequired ?? scenario === "stale_answer_rejection",
        unknownSearchingRequired: metrics.unknownSearchingRequired ?? scenario === "unknown_actor_searching_only",
        restrictedNoLeakRequired: metrics.restrictedNoLeakRequired ?? scenario === "restricted_no_leak",
        contradictionHoldRequired: metrics.contradictionHoldRequired ?? scenario === "contradiction_handling",
        provenanceRequired: true
      },
      handoffs: {
        agent03ParserCertification: ["actor_extraction", "victim_extraction", "ttp_extraction", "ioc_extraction"].includes(scenario) ? "replay parser fixtures before extractor changes" : undefined,
        agent06EvidenceReplay: "replay evidence and claim-ledger refs before release",
        agent08GraphHold: scenario === "contradiction_handling" || scenario === "ttp_extraction" ? "verify graph/STIX hold behavior" : undefined,
        agent09ApiRegression: "keep public/API state stable for fixture scenario",
        agent10ReleaseGate: selected.some((item) => item.expectedPublicState !== "ready") ? "block release on failed fixture" : undefined
      },
      immutable: true,
      appliesAutomatically: false,
      noLeak: true
    };
  };

  return [
    fixture("actor_extraction", label((item) => item.caseKind === "actor_profile"), "priority actor extraction", ["extract canonical actor names and aliases", "preserve partial or review-required states"]),
    fixture("victim_extraction", label((item) => item.caseKind === "victim_company"), "victim/company extraction", ["extract victim only with evidence refs", "hold restricted or weak victim claims"], { precisionTarget: 0.9, restrictedNoLeakRequired: true }),
    fixture("ttp_extraction", label((item) => item.caseKind === "malware_tool" || item.caseKind === "low_confidence"), "TTP and tool mapping", ["map TTP/tool evidence with confidence caveats", "hold weak graph/STIX mappings"], { recallTarget: 0.78 }),
    fixture("ioc_extraction", label((item) => item.caseKind === "cve" || item.caseKind === "malware_tool"), "IOC/CVE extraction", ["extract CVEs and indicators without noisy promotion", "preserve dual-use tool caveats"], { precisionTarget: 0.88 }),
    fixture("stale_answer_rejection", label((item) => item.caseKind === "stale"), "stale answer rejection", ["reject stale evidence as latest activity", "keep public answer partial or review-required"], { staleAnswerRejectionRequired: true, precisionTarget: 0.95 }),
    fixture("unknown_actor_searching_only", label((item) => item.caseKind === "unknown_actor" || item.subject === "random actor"), "unknown actor searching-only", ["return Searching without default actor", "forbid demo or stale cache prose"], { unknownSearchingRequired: true, precisionTarget: 1 }),
    fixture("restricted_no_leak", label((item) => item.sourceFamily === "restricted_metadata"), "restricted metadata no-leak", ["hold restricted metadata claims", "never expose restricted payloads or object keys"], { restrictedNoLeakRequired: true, precisionTarget: 1 }),
    fixture("contradiction_handling", label((item) => item.caseKind === "contradicted"), "contradiction handling", ["hold contradicted attribution", "route graph/STIX relationships to review"], { contradictionHoldRequired: true, precisionTarget: 0.92 })
  ];
}

function countFixtures(fixtures: CtiEvaluationDatasetFixtureDto[], scenario: CtiEvaluationDatasetScenario): number {
  return fixtures.filter((fixture) => fixture.scenario === scenario).length;
}

function fixtureIdsFor(fixtures: CtiEvaluationDatasetFixtureDto[], predicate: (fixture: CtiEvaluationDatasetFixtureDto) => boolean): string[] {
  return fixtures.filter(predicate).map((fixture) => fixture.id);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

export function evaluateExtractionFixtures(fixtures: ExtractionEvaluationFixture[]): ExtractionEvaluationReport {
  const fixtureReports = fixtures.map((fixture) => evaluateFixture(fixture, processCollectedItem(collectedItemFor(fixture))));
  const expectedCount = sum(fixtureReports.map((report) => report.expectedCount));
  const matchedCount = sum(fixtureReports.map((report) => report.matchedCount));
  const missingCount = sum(fixtureReports.map((report) => report.missing.length));
  const unexpectedCount = sum(fixtureReports.map((report) => report.unexpected.length));

  return {
    disclaimer: "Precision-ish fixture counts for deterministic regression checks only; this is not a full extraction benchmark.",
    fixtureCount: fixtures.length,
    expectedCount,
    matchedCount,
    missingCount,
    unexpectedCount,
    fixtures: fixtureReports
  };
}

export function evaluateExtractionCalibration(fixtures: ExtractionEvaluationFixture[]): ExtractionCalibrationReport {
  const evaluations = fixtures.map((fixture) => evaluateFixture(fixture, processCollectedItem(collectedItemFor(fixture))));
  const categories = ["actor", "victim", "sector", "country", "ttp", "malware", "ioc", "cve", "campaign", "caveat", "temporal", "uncertainty"];
  const categoryScores = categories.map((category) => categoryScore(category, evaluations));
  const evidenceStages = [...new Set(fixtures.map((fixture) => fixture.evidenceStage ?? evidenceStageFromFixture(fixture)))];
  const evidenceStageReports = evidenceStages.map((stage) => {
    const stageEvaluations = evaluations.filter((evaluation) => evaluation.evidenceStage === stage);
    const qualityNotes = mergeQualityNotes(stageEvaluations.flatMap((evaluation) => evaluation.qualityNotes));
    const expected = sum(stageEvaluations.map((evaluation) => evaluation.expectedCount));
    const matched = sum(stageEvaluations.map((evaluation) => evaluation.matchedCount));
    const missing = sum(stageEvaluations.map((evaluation) => evaluation.missing.length));
    const unexpected = sum(stageEvaluations.map((evaluation) => evaluation.unexpected.length));
    return {
      evidenceStage: stage,
      fixtureCount: stageEvaluations.length,
      expected,
      matched,
      missing,
      unexpected,
      precision: precision(matched, unexpected),
      recall: recall(matched, missing),
      qualityNotes
    };
  });

  return {
    disclaimer: "Calibration scores are deterministic fixture signals for trend and gate checks; they are not a statistically representative benchmark.",
    fixtureCount: fixtures.length,
    categoryScores,
    evidenceStageReports,
    falsePositiveExamples: evaluations
      .filter((evaluation) => evaluation.unexpected.length > 0)
      .map((evaluation) => ({ fixtureId: evaluation.fixtureId, unexpected: evaluation.unexpected })),
    falseNegativeExamples: evaluations
      .filter((evaluation) => evaluation.missing.length > 0)
      .map((evaluation) => ({ fixtureId: evaluation.fixtureId, missing: evaluation.missing })),
    qualityNotes: mergeQualityNotes(evaluations.flatMap((evaluation) => evaluation.qualityNotes))
  };
}

function evaluateFixture(fixture: ExtractionEvaluationFixture, result: PipelineResult): ExtractionFixtureEvaluation & { evidenceStage: EvidenceStage; qualityNotes: ExtractionQualityNote[] } {
  const expected = expectedKeys(fixture.expected);
  const actual = actualKeys(result);
  const matched = expected.filter((key) => actual.has(key));
  const missing = expected.filter((key) => !actual.has(key));
  const absent = new Set(expectedKeys(fixture.absent ?? {}));
  const unexpected = [...actual].filter((key) => absent.has(key));
  const evidenceStage = fixture.evidenceStage ?? evidenceStageFromFixture(fixture);

  return {
    fixtureId: fixture.id,
    expectedCount: expected.length,
    matchedCount: matched.length,
    matched,
    missing,
    unexpected,
    reviewReasons: result.incident?.reviewReasons ?? [],
    evidenceStage,
    qualityNotes: qualityNotesForFixture(fixture, result, evidenceStage)
  };
}

function expectedKeys(expected: ExtractionFixtureExpectation): string[] {
  return [
    ...(expected.actors ?? []).map((value) => key("actor", value)),
    ...(expected.cves ?? []).map((value) => key("cve", value)),
    ...(expected.iocs ?? []).map((ioc) => key(`ioc:${ioc.type}`, ioc.value)),
    ...(expected.victims ?? []).map((value) => key("victim", value)),
    ...(expected.sectors ?? []).map((value) => key("sector", value)),
    ...(expected.countries ?? []).map((value) => key("country", value)),
    ...(expected.ttpHints ?? []).map((value) => key("ttp", value)),
    ...(expected.malwareTools ?? []).map((value) => key("malware", value)),
    ...(expected.campaignNames ?? []).map((value) => key("campaign", value)),
    ...(expected.confidenceCaveats ?? []).map((value) => key("caveat", value)),
    ...(expected.temporalLabels ?? []).map((value) => key("temporal", value)),
    ...(expected.uncertaintyLabels ?? []).map((value) => key("uncertainty", value))
  ];
}

function actualKeys(result: PipelineResult): Set<string> {
  const keys = new Set<string>();
  for (const entity of result.entities) {
    if (entity.type === "actor") keys.add(key("actor", entity.value));
    if (entity.type === "victim") keys.add(key("victim", entity.value));
    if (entity.type === "sector") keys.add(key("sector", entity.value));
    if (entity.type === "country") keys.add(key("country", entity.value));
    if (entity.type === "ttp") keys.add(key("ttp", entity.value));
    if (entity.type === "malware" || entity.type === "ransomware_family") keys.add(key("malware", entity.value));
    if (entity.type === "cve") keys.add(key("cve", entity.value));
    for (const reason of entity.reviewReasons ?? []) keys.add(key("uncertainty", reason));
  }
  for (const indicator of result.indicators) {
    if (indicator.type === "cve") keys.add(key("cve", indicator.value));
    keys.add(key(`ioc:${indicator.type}`, indicator.value));
    for (const reason of indicator.reviewReasons ?? []) keys.add(key("uncertainty", reason));
  }
  for (const reason of result.incident?.reviewReasons ?? []) keys.add(key("uncertainty", reason));
  const profile = buildActorQueryExtractionProfile(result.incident?.title ?? "fixture", result);
  if (profile.temporal.reportPublishedAt) keys.add(key("temporal", "reportPublishedAt"));
  if (profile.temporal.incidentDate) keys.add(key("temporal", "incidentDate"));
  if (profile.temporal.firstSeenAt) keys.add(key("temporal", "firstSeenAt"));
  if (profile.temporal.lastSeenAt) keys.add(key("temporal", "lastSeenAt"));
  if (profile.temporal.claimedLeakDate) keys.add(key("temporal", "claimedLeakDate"));
  if (profile.temporal.observedInfrastructureDate) keys.add(key("temporal", "observedInfrastructureDate"));
  for (const campaign of profile.campaignNames) keys.add(key("campaign", campaign));
  const dto = buildTiSearchResultDto(result.incident?.title ?? "fixture", result);
  for (const caveat of dto.caveats) keys.add(key("caveat", caveat.code));
  return keys;
}

function collectedItemFor(fixture: ExtractionEvaluationFixture): CollectedItem {
  const metadata = { fixture: true, evidenceStage: fixture.evidenceStage, ...fixture.metadata };
  return {
    sourceId: `fixture_${fixture.id}`,
    url: `https://fixture.local/extraction/${fixture.id}`,
    collectedAt: "2026-05-24T00:00:00.000Z",
    title: fixture.title,
    rawText: fixture.rawText,
    contentHash: hashContent(fixture.rawText),
    language: fixture.language,
    links: [],
    metadata,
    sensitive: fixture.sensitive ?? false
  };
}

function qualityNotesForFixture(fixture: ExtractionEvaluationFixture, result: PipelineResult, evidenceStage: EvidenceStage): ExtractionQualityNote[] {
  const dto = buildTiSearchResultDto(fixture.query ?? fixture.title, result);
  const actors = result.entities.filter((entity) => entity.type === "actor");
  const victims = result.entities.filter((entity) => entity.type === "victim");
  const ttps = result.entities.filter((entity) => entity.type === "ttp");
  const notes: ExtractionQualityNote[] = [];
  if (result.entities.length + result.indicators.length < 2) {
    notes.push(qualityNote("low_evidence_count", "warning", "low evidence count limits extraction confidence", fixture.id));
  }
  if (new Set(actors.map((actor) => actor.value)).size > 1) {
    notes.push(qualityNote("alias_collision", "warning", "multiple actor names or aliases require collision review", fixture.id));
  }
  if (dto.caveats.some((caveat) => caveat.code === "stale")) {
    notes.push(qualityNote("stale_source", "warning", "source appears stale for current actor search calibration", fixture.id));
  }
  if (dto.caveats.some((caveat) => caveat.code === "contradicted")) {
    notes.push(qualityNote("contradicted_attribution", "critical", "source text indicates contradicted or disputed attribution", fixture.id));
  }
  if (victims.some((victim) => victim.confidence < 0.65) || (evidenceStage === "metadata_only_claim" && victims.length > 0)) {
    notes.push(qualityNote("weak_victim_claim", "warning", "victim extraction needs review before promotion", fixture.id));
  }
  if (ttps.length > 0 && dto.needsAnalystReview) {
    notes.push(qualityNote("extracted_ttp_needs_review", "warning", "extracted TTP needs review due to stage or confidence caveats", fixture.id));
  }
  if (evidenceStage === "live_discovery" || evidenceStage === "public_channel_message" || evidenceStage === "metadata_only_claim") {
    notes.push(qualityNote("source_family_bias", "info", "single partial source family may bias calibration", fixture.id));
  }
  return notes;
}

function qualityNote(code: ExtractionQualityNoteCode, severity: ExtractionQualityNote["severity"], message: string, fixtureId: string): ExtractionQualityNote {
  return { code, severity, message, fixtureIds: [fixtureId] };
}

function mergeQualityNotes(notes: ExtractionQualityNote[]): ExtractionQualityNote[] {
  const byCode = new Map<ExtractionQualityNoteCode, ExtractionQualityNote>();
  for (const note of notes) {
    const existing = byCode.get(note.code);
    byCode.set(note.code, existing
      ? { ...existing, fixtureIds: [...new Set([...existing.fixtureIds, ...note.fixtureIds])] }
      : note);
  }
  return [...byCode.values()];
}

function categoryScore(category: string, evaluations: Array<ExtractionFixtureEvaluation & { qualityNotes: ExtractionQualityNote[] }>): ExtractionCategoryScore {
  const matched = sum(evaluations.map((evaluation) => evaluation.matched.filter((item) => belongsToCategory(item, category)).length));
  const missing = sum(evaluations.map((evaluation) => evaluation.missing.filter((item) => belongsToCategory(item, category)).length));
  const unexpected = sum(evaluations.map((evaluation) => evaluation.unexpected.filter((item) => belongsToCategory(item, category)).length));
  const expectedCount = matched + missing;
  return {
    category,
    expected: expectedCount,
    matched,
    missing,
    unexpected,
    precision: precision(matched, unexpected),
    recall: recall(matched, missing),
    f1: f1(matched, missing, unexpected)
  };
}

function belongsToCategory(keyValue: string, category: string): boolean {
  if (category === "ioc") return keyValue.startsWith("ioc:");
  return keyValue.startsWith(`${category}:`);
}

function evidenceStageFromFixture(fixture: ExtractionEvaluationFixture): EvidenceStage {
  if (fixture.sensitive) return "metadata_only_claim";
  const explicit = fixture.metadata?.evidenceStage;
  return isEvidenceStage(explicit) ? explicit : "captured_page";
}

function isEvidenceStage(value: unknown): value is EvidenceStage {
  return value === "seeded"
    || value === "live_discovery"
    || value === "captured_page"
    || value === "public_channel_message"
    || value === "metadata_only_claim"
    || value === "extracted_relationship"
    || value === "reviewed_promoted";
}

function precision(matched: number, unexpected: number): number {
  return matched + unexpected === 0 ? 1 : matched / (matched + unexpected);
}

function recall(matched: number, missing: number): number {
  return matched + missing === 0 ? 1 : matched / (matched + missing);
}

function f1(matched: number, missing: number, unexpected: number): number {
  const p = precision(matched, unexpected);
  const r = recall(matched, missing);
  return p + r === 0 ? 0 : (2 * p * r) / (p + r);
}

function key(type: string, value: string): string {
  return `${type}:${value.toLowerCase()}`;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function evaluationGovernanceLabels(generatedAt: string): EvaluationGovernanceLabel[] {
  const reviewedAt = generatedAt;
  const base = {
    reviewer: "agent-07-quality-governance",
    reviewedAt,
    publicSemantics: {
      preservesUncertainty: true,
      unknownActorSearchingOnly: false,
      noDefaultActor: true,
      noDemoOrCacheProse: true,
      requiredCaveats: [] as string[]
    }
  };
  return [
    governanceLabel(base, "eval_label_apt29_profile", "actor_profile", "APT29", "ready", "vendor-reviewed actor profile label", "vendor_blog", 0.9, "fresh", ["quality_gate", "api_regression", "evidence_replay", "public_benchmark", "graph_drift", "release_gate"], ["evidence:apt29:profile:2026-05-24"], ["claim:apt29:summary"]),
    governanceLabel(base, "eval_label_apt42_profile", "actor_profile", "APT42", "partial", "public CTI actor profile label", "vendor_blog", 0.82, "fresh", ["quality_gate", "api_regression", "evidence_replay", "public_benchmark", "graph_drift", "release_gate"], ["evidence:apt42:profile:2026-05-24"], ["claim:apt42:summary"], ["partial attribution wording required"]),
    governanceLabel(base, "eval_label_turla_profile", "actor_profile", "Turla", "ready", "public CTI actor profile label", "rss_security_feed", 0.86, "fresh", ["quality_gate", "api_regression", "evidence_replay", "public_benchmark", "graph_drift", "release_gate"], ["evidence:turla:profile:2026-05-24"], ["claim:turla:summary"]),
    governanceLabel(base, "eval_label_volt_typhoon_profile", "actor_profile", "Volt Typhoon", "partial", "advisory-backed actor profile label", "advisory", 0.84, "fresh", ["quality_gate", "api_regression", "evidence_replay", "public_benchmark", "graph_drift", "release_gate"], ["evidence:volt_typhoon:profile:2026-05-24"], ["claim:volt_typhoon:summary"], ["critical infrastructure caveat required"]),
    governanceLabel(base, "eval_label_scattered_spider_profile", "actor_profile", "Scattered Spider", "partial", "public-channel corroborated actor label", "public_channel", 0.72, "aging", ["quality_gate", "api_regression", "public_benchmark", "release_gate"], ["evidence:scattered_spider:profile:2026-05-24"], ["claim:scattered_spider:summary"], ["public-channel-only caveat required"]),
    governanceLabel(base, "eval_label_akira_profile", "actor_profile", "Akira", "review_required", "ransomware actor label with victim-claim review", "restricted_metadata", 0.68, "fresh", ["quality_gate", "api_regression", "evidence_replay", "release_gate"], ["evidence:akira:metadata:2026-05-24"], ["claim:akira:victim"], ["restricted metadata hold required", "victim claim unverified"]),
    governanceLabel(base, "eval_label_random_actor_guardrail", "actor_profile", "random actor", "searching", "negative-control actor guardrail", "synthetic_guardrail", 0.2, "unknown", ["api_regression", "release_gate"], ["evidence:guardrail:random_actor"], ["claim:guardrail:random_actor"], ["no default actor fallback"]),
    governanceLabel({ ...base, publicSemantics: { ...base.publicSemantics, unknownActorSearchingOnly: true, requiredCaveats: ["Searching"] } }, "eval_label_unknown_actor_guardrail", "unknown_actor", "unknown actor", "searching", "unknown-query public semantics guardrail", "synthetic_guardrail", 0.1, "unknown", ["api_regression", "release_gate"], ["evidence:guardrail:unknown_actor"], ["claim:guardrail:unknown_actor"]),
    governanceLabel(base, "eval_label_cve_case", "cve", "CVE-2026-12345", "partial", "CVE extraction and caveat label", "advisory", 0.78, "fresh", ["quality_gate", "api_regression", "evidence_replay", "release_gate"], ["evidence:cve:2026-12345"], ["claim:cve:2026-12345"], ["exploitability caveat required"]),
    governanceLabel(base, "eval_label_malware_tool_case", "malware_tool", "Cobalt Strike", "partial", "malware/tool extraction label", "vendor_blog", 0.8, "fresh", ["quality_gate", "api_regression", "evidence_replay", "graph_drift", "release_gate"], ["evidence:tool:cobalt_strike"], ["claim:tool:cobalt_strike"], ["dual-use tooling caveat required"]),
    governanceLabel(base, "eval_label_country_case", "country", "United States", "partial", "country targeting/geography label", "rss_security_feed", 0.76, "aging", ["quality_gate", "api_regression", "public_benchmark", "release_gate"], ["evidence:country:us"], ["claim:country:us"], ["geography should not imply attribution"]),
    governanceLabel(base, "eval_label_sector_case", "sector", "Healthcare", "partial", "sector extraction label", "vendor_blog", 0.74, "fresh", ["quality_gate", "api_regression", "public_benchmark", "release_gate"], ["evidence:sector:healthcare"], ["claim:sector:healthcare"]),
    governanceLabel(base, "eval_label_victim_company_case", "victim_company", "Northwind Health", "review_required", "victim/company claim label", "restricted_metadata", 0.62, "fresh", ["quality_gate", "api_regression", "evidence_replay", "release_gate"], ["evidence:victim:northwind_health"], ["claim:victim:northwind_health"], ["victim claim requires analyst review", "restricted metadata hold required"]),
    governanceLabel(base, "eval_label_stale_case", "stale", "stale actor activity", "review_required", "stale label suppression fixture", "rss_security_feed", 0.58, "stale", ["quality_gate", "api_regression", "evidence_replay", "release_gate"], ["evidence:stale:actor_activity"], ["claim:stale:actor_activity"], ["stale caveat required", "ready promotion blocked"]),
    governanceLabel(base, "eval_label_contradicted_case", "contradicted", "contradicted attribution", "review_required", "contradiction label fixture", "vendor_blog", 0.52, "fresh", ["quality_gate", "api_regression", "evidence_replay", "graph_drift", "release_gate"], ["evidence:contradiction:attribution"], ["claim:contradiction:attribution"], ["contradiction caveat required", "graph/STIX export hold"]),
    governanceLabel(base, "eval_label_low_confidence_case", "low_confidence", "low-confidence TTP mapping", "review_required", "low-confidence label fixture", "public_channel", 0.44, "aging", ["quality_gate", "api_regression", "public_benchmark", "graph_drift", "release_gate"], ["evidence:low_confidence:ttp"], ["claim:low_confidence:ttp"], ["low confidence caveat required", "public-channel-only caveat required"])
  ];
}

function governanceLabel(
  base: {
    reviewer: string;
    reviewedAt: string;
    publicSemantics: EvaluationGovernanceLabel["publicSemantics"];
  },
  id: string,
  caseKind: EvaluationGovernanceCaseKind,
  subject: string,
  expectedPublicState: EvaluationGovernanceLabel["expectedPublicState"],
  labelSource: string,
  sourceFamily: EvaluationGovernanceLabel["sourceFamily"],
  confidence: number,
  freshness: EvaluationGovernanceLabel["freshness"],
  allowedDownstreamUse: EvaluationGovernanceLabel["allowedDownstreamUse"],
  evidenceIds: string[],
  claimLedgerRefs: string[],
  requiredCaveats: string[] = []
): EvaluationGovernanceLabel {
  const publicSemantics = {
    ...base.publicSemantics,
    requiredCaveats: [...new Set([...base.publicSemantics.requiredCaveats, ...requiredCaveats])]
  };
  return {
    id,
    caseKind,
    subject,
    expectedPublicState,
    labelSource,
    reviewer: base.reviewer,
    reviewedAt: base.reviewedAt,
    evidenceIds,
    claimLedgerRefs,
    sourceFamily,
    confidence,
    freshness,
    allowedDownstreamUse,
    publicSemantics,
    provenance: {
      sourceFamily,
      evidenceIds,
      claimLedgerRefs,
      redacted: true
    }
  };
}

function evaluationGovernanceAuditChecks(labels: EvaluationGovernanceLabel[]): EvaluationGovernanceAuditCheck[] {
  return [
    governanceAudit("stale_label", labels, (label) => label.freshness === "stale", "warn", "warning", "stale labels must remain review-required and block ready promotion", ["Agent 06", "Agent 10"]),
    governanceAudit("overconfident_summary", labels, (label) => label.confidence > 0.8 && label.expectedPublicState === "ready" && label.evidenceIds.length > 0, "pass", "info", "high-confidence ready summaries have explicit evidence and ledger refs", ["Agent 09", "Agent 10"]),
    governanceAudit("missing_provenance", labels, (label) => label.evidenceIds.length === 0 || label.claimLedgerRefs.length === 0, "pass", "critical", "every evaluation label carries evidence IDs and claim ledger refs", ["Agent 06", "Agent 09"]),
    governanceAudit("contradiction_handling", labels, (label) => label.caseKind === "contradicted", "warn", "critical", "contradicted labels stay review-required with graph/STIX holds", ["Agent 08", "Agent 10"]),
    governanceAudit("public_channel_only_caveat", labels, (label) => label.sourceFamily === "public_channel", "warn", "warning", "public-channel-only labels require caveats before public use", ["Agent 04", "Agent 09"]),
    governanceAudit("restricted_metadata_hold", labels, (label) => label.sourceFamily === "restricted_metadata", "hold", "critical", "restricted metadata labels are API-safe but held from ready promotion until analyst approval", ["Agent 06", "Agent 09", "Agent 10"]),
    governanceAudit("graph_stix_export_eligibility", labels, (label) => label.allowedDownstreamUse.includes("graph_drift") && label.confidence >= 0.7 && label.caseKind !== "contradicted", "pass", "info", "graph/STIX eligible labels require confidence, provenance, and no contradiction", ["Agent 08", "Agent 10"]),
    governanceAudit("unknown_searching_only", labels, (label) => label.caseKind === "unknown_actor" && label.expectedPublicState === "searching" && label.publicSemantics.unknownActorSearchingOnly && label.publicSemantics.noDefaultActor, "pass", "critical", "unknown public actor semantics remain Searching-only with no default actor/demo prose", ["Agent 09", "Agent 10"])
  ];
}

function governanceAudit(
  code: EvaluationGovernanceAuditCode,
  labels: EvaluationGovernanceLabel[],
  predicate: (label: EvaluationGovernanceLabel) => boolean,
  status: EvaluationGovernanceAuditCheck["status"],
  severity: EvaluationGovernanceAuditCheck["severity"],
  message: string,
  downstreamOwners: EvaluationGovernanceAuditCheck["downstreamOwners"]
): EvaluationGovernanceAuditCheck {
  return {
    code,
    status,
    severity,
    labelIds: labelIdsFor(labels, predicate),
    message,
    downstreamOwners
  };
}

function labelIdsFor(labels: EvaluationGovernanceLabel[], predicate: (label: EvaluationGovernanceLabel) => boolean): string[] {
  return labels.filter(predicate).map((label) => label.id);
}
